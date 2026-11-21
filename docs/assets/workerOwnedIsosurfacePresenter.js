import{Ct as e,Un as t,Wn as n,f as r,m as i,v as a}from"./sphReactionLineageGpu-DF0aiFdD.js";import{$p as o,G as s,Vp as c,dp as l,fp as u,m as d,mp as f,ot as p,zp as m}from"./sphGpuBuffers-DXi6z5Dj.js";import{computeBufferBinding as h,createCachedExplicitComputePipeline as g,deferSubmittedWorkCleanup as _}from"../runtime/webgpuComputeLayout.js";import{E as v,L as y,M as b,R as x,a as S,b as C,d as w,f as T,i as E,l as D,m as O,o as ee,r as te,u as ne,v as re,y as k}from"./nativeSurfaceTemperatureWgsl-BV_23LkM.js";import{ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE as ie,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_INCLUDED as ae,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED as oe}from"../runtime/sph/sphWorkerPresentationQos.js";import{createIsosurfaceMotionPacing as se,createPresentationPauseClock as ce,isosurfaceMotionAge as A,resumeIsosurfaceMotionPacing as le,slowIsosurfaceMotionPacing as ue,snapshotIsosurfaceSourceTimingBootstrap as j}from"./workerOwnedIsosurfaceMotion.js";var de=`
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
`;function fe(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`}={}){let r=e.createShaderModule({label:`ulg-solid-member-shape`,code:de}),i=e.createRenderPipeline({label:`ulg-solid-member-shape`,layout:`auto`,vertex:{module:r,entryPoint:`vs_member`},fragment:{module:r,entryPoint:`fs_member`,targets:[{format:t}]},primitive:{topology:`triangle-list`,cullMode:`back`,frontFace:`ccw`},depthStencil:n?{format:n,depthWriteEnabled:!0,depthCompare:`less`}:void 0}),a=e.createBuffer({label:`ulg-solid-member-shape-uniforms`,size:112,usage:72}),o=new WeakMap;return Object.freeze({draw(t,n,{viewProjection:r,colorLinear:s=[.78,.9,.98],ambient:c=.35,lightDirection:l=[.3,.8,.5]}){let u=new ArrayBuffer(112),d=new Float32Array(u),f=new Uint32Array(u);d.set(r,0),f.set([0,n.memberCount,0,0],16),d.set([...s,1],20),d.set([...l,c],24),e.queue.writeBuffer(a,0,u);let p=o.get(n);p||(p=e.createBindGroup({layout:i.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:n.frameBuffer}},{binding:2,resource:{buffer:n.memberBuffer}},{binding:3,resource:{buffer:n.neighborBuffer}},{binding:4,resource:{buffer:n.latticeBuffer}}]}),o.set(n,p)),t.setPipeline(i),t.setBindGroup(0,p),t.draw(n.memberCount*36)}})}var pe=Object.freeze({wavelengthM:55e-8,refractiveIndex:1.333,asymmetry:.85}),me=Object.freeze({STORAGE:128,UNIFORM:64,COPY_DST:8}),he=`
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
`;function ge({device:e,encoder:t,parcels:n,fieldRowsBuffer:r,fieldOffset:i,resolution:a,fieldPadding:o,refEdgeM:s}={}){if(!n?.count||!r||!(a>0)||!(s>0))return null;let c=n.boxDimensionsM[0]/n.cellsPerAxis;if(!(c>0))throw TypeError(`Ledger parcel optics require the parcel gas-cell size`);let l=g(e,{cacheKey:`ulg-ledger-parcel-optics.v1`,label:`ulg-ledger-parcel-optics`,code:he,entryPoint:`add_parcel_optics`,bindings:[`uniform`,`read-only-storage`,`storage`].map((e,t)=>h(t,e))}),u=e.createBuffer({label:`ulg-ledger-parcel-optics-params`,size:48,usage:me.UNIFORM|me.COPY_DST}),d=new ArrayBuffer(48),f=new Uint32Array(d),p=new Float32Array(d);f.set([n.count,a,i,0],0),p.set([o,s,pe.wavelengthM,pe.refractiveIndex],4),p.set([pe.asymmetry,c,0,0],8),e.queue.writeBuffer(u,0,d);let m=e.createBindGroup({layout:l.bindGroupLayout,entries:[u,n.paramsBuffer,r].map((e,t)=>({binding:t,resource:{buffer:e}}))}),_=t.beginComputePass({label:`ulg-ledger-parcel-optics`});return _.setPipeline(l.pipeline),_.setBindGroup(0,m),_.dispatchWorkgroups(Math.ceil(a**3/64)),_.end(),u}var M=`peercompute.ulg.sph-participating-medium-descriptor.v0`,N=`peercompute.ulg.sph-participating-medium-gpu.v0`,P=`peercompute.ulg.sph-participating-medium-packed-frame.v0`,F=Object.freeze({ready:`participating-medium-ready`,empty:`participating-medium-empty`,blocked:`participating-medium-blocked`}),_e=`participating-medium-packed-gpu-resident`,I=`rgba16float`,L=65504,R=Object.freeze({COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256}),z=Object.freeze({TEXTURE_BINDING:globalThis.GPUTextureUsage?.TEXTURE_BINDING??4,STORAGE_BINDING:globalThis.GPUTextureUsage?.STORAGE_BINDING??8}),ve=8*Uint32Array.BYTES_PER_ELEMENT,B=8*Uint32Array.BYTES_PER_ELEMENT,V=40,ye=V*Float32Array.BYTES_PER_ELEMENT,be=80,xe=1e-6,Se=40,H=8,U=128,Ce=new WeakMap,we=new WeakMap,Te=new WeakMap,Ee=`
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
`,De=`
struct VolumeUniforms {
  inverse_view_projection: mat4x4<f32>,
  camera_step_count: vec4<f32>,
  bounds_min_cell_edge: vec4<f32>,
  bounds_max_ambient: vec4<f32>,
  light_direction_intensity: vec4<f32>,
  viewport_depth_epsilon: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: VolumeUniforms;
@group(0) @binding(1) var optical_volume: texture_3d<f32>;
@group(0) @binding(2) var scattering_volume: texture_3d<f32>;
@group(0) @binding(3) var volume_sampler: sampler;
@group(0) @binding(4) var opaque_depth: texture_depth_2d;

const HALF_FLOAT_MAX: f32 = 65504.0;

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
    let optical = textureSampleLevel(optical_volume, volume_sampler, uvw, 0.0);
    let scattering_color_depth = textureSampleLevel(
      scattering_volume,
      volume_sampler,
      uvw,
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
`;function W(e){return typeof e==`object`&&!!e||typeof e==`function`}function G(e,t=null){let n=Number(e);return Number.isFinite(n)?n:t}function K(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function q(e,t,n){let r=K(e,n),i=K(t,n);return!!(r&&i&&r.every((e,t)=>e===i[t]))}function J(e){return Array.isArray(e)&&e.length===n.length&&e.every((e,t)=>e===n[t])}function Y(e){let t=Number(e?.descriptor?.surfaceIndex);if(Number.isSafeInteger(t)&&t>=0)return t;let n=Number(e?.metadata?.index);return Number.isSafeInteger(n)&&n>=0?n:null}function Oe(e){return Object.freeze(Array.isArray(e)?e.map(Y).filter(e=>e!=null):[])}function ke(e){let t=e?.metadata;return!!(W(t)&&Number.isSafeInteger(Number(t.opticalStateId))&&Number(t.opticalStateId)===0)}function X(e,t=[],n={}){return Object.freeze({schema:M,ok:!1,status:F.blocked,reason:e,routeCount:0,collectiveSurfaceCount:t.length,consumedSurfaceIndices:Oe(t),readback:!1,fullReadback:!1,...n})}function Ae(){return Object.freeze({schema:M,ok:!0,status:F.empty,reason:null,routeCount:0,collectiveSurfaceCount:0,consumedSurfaceIndices:Object.freeze([]),readback:!1,fullReadback:!1})}function je(e,t){return!!(W(e)&&W(t)&&[`index`,`resolution`,`fieldOffset`,`fieldCellCount`,`opticalStateId`,`collectiveOpticalRoute`,`collectiveOpticalRouteSchema`,`collectiveOpticalRouteKey`,`collectiveOpticalRouteId`,`opticalResponseAuthorityFlag`,`opticalResponseReady`,`opticalVisibilityFlag`,`opticalBlockedFlag`].every(n=>e[n]===t[n])&&q(e.colorLinear,t.colorLinear,3)&&(e.opticalScatteringSourceLinear==null?t.opticalScatteringSourceLinear==null:q(e.opticalScatteringSourceLinear,t.opticalScatteringSourceLinear,3)))}function Me(e){let t=K(e?.opticalScatteringSourceLinear,3),n=K(e?.colorLinear,3),r=t||n;return!r||r.some(e=>e<0)?null:r.map(e=>Math.min(e,1))}function Ne(t,r){if(!W(t))return`participating medium requires a GPUDevice`;if(!W(r)||r.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return`participating medium requires the exact ULG render-field schema`;if(r.backend!==`webgpu`)return`participating medium requires a WebGPU render field`;if(r.fieldRowsBufferRetained!==!0||!W(r.fieldRowsBuffer))return`participating medium requires a retained render-field GPU buffer`;if(!e(r.fieldRowsBuffer,t))return`participating medium rejects a cross-device render-field buffer`;if(r.rowStrideFloats!==n.length)return`participating medium requires the exact render-field cell stride`;if(!J(r.rowLayout))return`participating medium requires the exact render-field row layout`;let i=Number(r.fieldRowsBufferByteLength),a=Number(r.fieldRowsBuffer.size),o=Number(r.totalFieldCells)*n.length*Float32Array.BYTES_PER_ELEMENT;return!Number.isSafeInteger(Number(r.totalFieldCells))||Number(r.totalFieldCells)<=0||!Number.isSafeInteger(i)||i!==o||!Number.isSafeInteger(a)||a<i?`participating medium rejects inconsistent render-field buffer bounds`:r.surfaceTable?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!Array.isArray(r.surfaceTable.metadata)||r.surfaceTable.metadata.length!==r.surfaceTable.surfaceCount?`participating medium requires the exact render-field surface table`:null}function Pe({device:e,renderField:t,volumeDescriptor:r,metadata:i,sourceMetadata:a}){if(!W(r)||r.schema!==`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`||r.ok!==!0||r.status!==`ulg-render-field-buffer-volume-descriptor-ready`||r.device!==e||r.scalarBuffer!==t.fieldRowsBuffer||r.storageBuffer!==t.fieldRowsBuffer||r.buffer!==t.fieldRowsBuffer||r.sameDeviceStatus===`cross-device-resource`)return`participating medium rejected an unauthenticated field-volume descriptor`;let o=Number(r.surfaceIndex),s=Number(a?.resolution),c=Number(a?.fieldOffset),l=Number(a?.fieldCellCount);return!Number.isSafeInteger(o)||o<0||a!==t.surfaceTable.metadata[o]||!je(i,a)||!Number.isSafeInteger(s)||s<2||!Number.isSafeInteger(c)||c<0||l!==s**3||r.fieldOffset!==c||r.fieldCellCount!==l||r.scalarOffset!==c*n.length||r.scalarOffsetBytes!==r.scalarOffset*Float32Array.BYTES_PER_ELEMENT||r.cellRowStrideFloats!==n.length||!q(r.dims,[s,s,s],3)?`participating medium rejected inconsistent field-volume bounds`:r.positionTransform?.enabled!==!0||r.positionTransformStatus!==`ulg-render-field-grid-to-world-transform-ready`||!q(r.positionTransformOriginM,r.positionTransform.originM,3)||!(Number(r.positionTransformScaleM)>0)||r.positionTransformScaleM!==r.positionTransform.scaleM?`participating medium requires an authenticated grid-to-world transform`:t.schroederSpatialSourceFamily&&!O(r,{device:e,sourceFamily:t.schroederSpatialSourceFamily})?`participating medium rejected stale successor field lineage`:null}function Fe(e){let t=Number(e?.opticalStateId);return!!(Object.isFrozen(e)&&e.collectiveOpticalRoute===!0&&e.collectiveOpticalRouteSchema===`peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0`&&typeof e.collectiveOpticalRouteKey==`string`&&e.collectiveOpticalRouteKey.length>0&&Number.isSafeInteger(t)&&t>0&&Number(e.collectiveOpticalRouteId)===t&&e.opticalResponseAuthorityFlag===1&&e.opticalResponseReady===!0&&e.opticalVisibilityFlag===1&&e.opticalBlockedFlag===0&&Me(e))}function Ie(e){return Object.freeze({surfaceIndex:e.surfaceIndex,scalarBuffer:e.scalarBuffer,fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,scalarOffset:e.scalarOffset,scalarOffsetBytes:e.scalarOffsetBytes,cellRowStrideFloats:e.cellRowStrideFloats,positionTransform:e.positionTransform,positionTransformStatus:e.positionTransformStatus,positionTransformScaleM:e.positionTransformScaleM,positionTransformGridBias:e.positionTransformGridBias,positionTransformOriginM:Object.freeze([...e.positionTransformOriginM]),dims:Object.freeze([...e.dims])})}function Le(e,t){return!!(e.surfaceIndex===t.surfaceIndex&&e.scalarBuffer===t.scalarBuffer&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformScaleM===t.positionTransformScaleM&&e.positionTransformGridBias===t.positionTransformGridBias&&q(e.positionTransformOriginM,t.positionTransformOriginM,3)&&q(e.dims,t.dims,3))}function Re({device:e=null,renderField:r=null,surfaceDescriptors:i=[]}={}){if(!Array.isArray(i))return X(`participating medium surfaceDescriptors must be an array`);if(i.length===0)return Ae();let a=i.filter(e=>!ke(e));if(a.length===0)return Ae();let o=Ne(e,r);if(o)return X(o,a);let s=[...a].sort((e,t)=>Y(e)-Y(t)),c=new Set,l=new Set,u=new ArrayBuffer(s.length*ve),d=new Uint32Array(u),f=new Float32Array(u),p=[],m=null,h=null,g=null,_=null;for(let t=0;t<s.length;t+=1){let n=s[t],i=n?.descriptor??null,o=n?.metadata??null,u=Y(n),v=Number.isSafeInteger(u)?r.surfaceTable.metadata[u]:null;if(!Fe(o))return X(`participating medium rejected a blocked or noncanonical collective route`,a,{blockedSurfaceIndex:u});let y=Pe({device:e,renderField:r,volumeDescriptor:i,metadata:o,sourceMetadata:v});if(y)return X(y,a,{blockedSurfaceIndex:u});let b=Number(o.opticalStateId);if(c.has(b)||l.has(u))return X(`participating medium rejects duplicate route or surface identity`,a,{blockedSurfaceIndex:u});c.add(b),l.add(u);let x=Number(v.resolution),S=Number(i.positionTransformScaleM),C=Number(i.positionTransformGridBias),w=K(i.positionTransformOriginM,3);if(t===0)m=x,h=S,g=C,_=w;else if(x!==m||S!==h||C!==g||!q(w,_,3))return X(`participating medium requires one exact shared grid transform`,a,{blockedSurfaceIndex:u});let T=Me(o),E=t*8;d[E]=Number(v.fieldOffset),d[E+1]=x,d[E+2]=b,d[E+3]=u,f[E+4]=T[0],f[E+5]=T[1],f[E+6]=T[2],f[E+7]=1,p.push(Object.freeze({surfaceIndex:u,opticalStateId:b,fieldOffset:Number(v.fieldOffset),resolution:x,scatteringColorLinear:Object.freeze([...T]),volumeDescriptor:i,volumeDescriptorSnapshot:Ie(i),metadata:o,sourceMetadata:v}))}let v=Number(e.limits?.maxTextureDimension3D);if(Number.isFinite(v)&&m>v)return X(`participating medium grid exceeds maxTextureDimension3D`,a);let y=_.map(e=>e-.5*h),b=_.map(e=>e+(m-.5)*h),x={schema:M,ok:!0,status:F.ready,reason:null,sourceRenderFieldSchema:r.schema,sourceRenderFieldBackend:r.backend,routeCount:p.length,collectiveSurfaceCount:p.length,consumedSurfaceIndices:Object.freeze(p.map(e=>e.surfaceIndex)),opticalStateIds:Object.freeze(p.map(e=>e.opticalStateId)),resolution:m,dims:Object.freeze([m,m,m]),cellEdgeM:h,fieldMinM:Object.freeze(y),fieldMaxM:Object.freeze(b),fieldRowsBuffer:r.fieldRowsBuffer,fieldRowsBufferByteLength:r.fieldRowsBufferByteLength,fieldCellRowStrideFloats:n.length,temperatureLaneIndex:t.temperatureK,scatteringOpticalDepthLaneIndex:t.scatteringOpticalDepth,absorptionOpticalDepthLaneIndex:t.absorptionOpticalDepth,scatteringAsymmetryOpticalDepthLaneIndex:t.scatteringAsymmetryOpticalDepth,aggregateTextureCount:2,textureFormat:I,storageComponentMax:L,readback:!1,fullReadback:!1,activityMode:`gpu-indirect-not-read-back`,sourceReleaseBoundary:`after-containing-command-buffer-submit`};return Ce.set(x,{active:!0,device:e,renderField:r,surfaceTable:r.surfaceTable,surfaceMetadataArray:r.surfaceTable.metadata,fieldRowsBuffer:r.fieldRowsBuffer,routeRowsBytes:new Uint8Array(u),routes:p,resolution:m,cellEdgeM:h,fieldMinM:y,fieldMaxM:b}),Object.freeze(x)}function ze(e,t){if(typeof e?.[t]!=`function`)throw TypeError(`participating medium requires device.${t}()`)}function Be(e,t,n,r){return typeof e[t]==`function`?Promise.resolve(e[t](r)):(ze(e,n),Promise.resolve(e[n](r)))}function Ve(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`,maxOpticalDepth:r=be,activityEpsilon:i=xe}={}){for(let t of[`createBuffer`,`createTexture`,`createShaderModule`,`createBindGroup`,`createSampler`])ze(e,t);if(ze(e?.queue,`writeBuffer`),typeof t!=`string`||t.length===0)throw TypeError(`participating medium requires a color format`);if(typeof n!=`string`||n.length===0)throw TypeError(`participating medium requires a depth format`);let a=G(r),o=G(i);if(!(a>0)||!(o>=0))throw RangeError(`participating medium optical limits must be finite and nonnegative`);let s=Math.min(a,L),c=e.createShaderModule({label:`ulg-sph-participating-medium-pack-wgsl`,code:Ee}),l=e.createShaderModule({label:`ulg-sph-participating-medium-render-wgsl`,code:De}),u=Be(e,`createComputePipelineAsync`,`createComputePipeline`,{label:`ulg-sph-participating-medium-pack`,layout:`auto`,compute:{module:c,entryPoint:`pack_main`}}),d=Be(e,`createRenderPipelineAsync`,`createRenderPipeline`,{label:`ulg-sph-participating-medium-render`,layout:`auto`,vertex:{module:l,entryPoint:`vertex_main`},fragment:{module:l,entryPoint:`fragment_main`,targets:[{format:t,blend:{color:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`}},writeMask:15}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),f={active:!0,device:e,colorFormat:t,depthFormat:n,maxOpticalDepth:s,activityEpsilon:o,packPipelinePromise:u,renderPipelinePromise:d,sampler:e.createSampler({label:`ulg-sph-participating-medium-linear-sampler`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`nearest`}),frames:new Set},p={schema:N,status:`participating-medium-gpu-ready-pending-pipelines`,colorFormat:t,depthFormat:n,textureFormat:I,maxOpticalDepth:s,storageComponentMax:L,readback:!1,get destroyed(){return!f.active},ready:Promise.all([u,d]).then(()=>!0),destroy(){if(!f.active)return!1;f.active=!1;for(let e of[...f.frames])Je(e);return f.frames.clear(),!0}};return we.set(p,f),Object.freeze(p)}function Z(e){let t=we.get(e);if(!t||!t.active)throw TypeError(`participating medium GPU runtime is missing or destroyed`);return t}function He(t,n){let r=Ce.get(t);if(!r||!r.active||t.status!==F.ready)throw TypeError(`participating medium descriptor is missing, consumed, or blocked`);if(r.device!==n.device||t.fieldRowsBuffer!==r.fieldRowsBuffer)throw TypeError(`participating medium descriptor belongs to a different GPU runtime`);let i=Ne(n.device,r.renderField);if(i)throw TypeError(`participating medium render-field source failed revalidation: ${i}`);if(r.renderField.fieldRowsBuffer!==r.fieldRowsBuffer||r.renderField.fieldRowsBufferRetained!==!0||r.renderField.surfaceTable!==r.surfaceTable||r.surfaceTable.metadata!==r.surfaceMetadataArray||!e(r.fieldRowsBuffer,n.device))throw TypeError(`participating medium render-field/table identity is stale or cross-device`);for(let e of r.routes){if(r.surfaceMetadataArray[e.surfaceIndex]!==e.sourceMetadata||!je(e.metadata,e.sourceMetadata)||!Fe(e.metadata)||!Le(e.volumeDescriptor,e.volumeDescriptorSnapshot))throw TypeError(`participating medium route authority changed after descriptor creation`);if(r.renderField.schroederSpatialSourceFamily&&!O(e.volumeDescriptor,{device:n.device,sourceFamily:r.renderField.schroederSpatialSourceFamily}))throw TypeError(`participating medium successor lineage expired before packing`)}return r}function Ue(e){try{e?.destroy?.()}catch{}}function We(e,t,n,r,i){let a={active:!0,runtime:e,runtimeRecord:t,descriptor:n,descriptorRecord:r,...i},o={schema:P,ok:!0,status:_e,resolution:n.resolution,dims:n.dims,routeCount:n.routeCount,collectiveSurfaceCount:n.collectiveSurfaceCount,consumedSurfaceIndices:n.consumedSurfaceIndices,opticalStateIds:n.opticalStateIds,opticalTexture:i.opticalTexture,scatteringTexture:i.scatteringTexture,drawIndirectBuffer:i.drawIndirectBuffer,drawIndirectOffsetBytes:0,drawCountMode:`gpu-indirect-not-read-back`,sourceBufferConsumptionEncoded:!0,sourceReleaseBoundary:n.sourceReleaseBoundary,readback:!1,fullReadback:!1,get destroyed(){return!a.active},destroy(){return Je(o)}};return a.frame=o,Te.set(o,a),t.frames.add(o),Object.freeze(o)}async function Ge(e,t,r){let i=Z(e);if(!W(t)||typeof t.clearBuffer!=`function`||typeof t.beginComputePass!=`function`)throw TypeError(`participating medium pack requires a GPUCommandEncoder`);let a=He(r,i),o=await i.packPipelinePromise;Z(e),He(r,i);let s=a.resolution,c={size:{width:s,height:s,depthOrArrayLayers:s},dimension:`3d`,format:I,mipLevelCount:1,sampleCount:1,usage:z.STORAGE_BINDING|z.TEXTURE_BINDING},l=[];try{let u=i.device.createTexture({...c,label:`ulg-sph-participating-medium-optical-volume`});l.push(u);let d=i.device.createTexture({...c,label:`ulg-sph-participating-medium-scattering-volume`});l.push(d);let f=u.createView({dimension:`3d`}),p=d.createView({dimension:`3d`}),m=i.device.createBuffer({label:`ulg-sph-participating-medium-route-rows`,size:a.routeRowsBytes.byteLength,usage:R.STORAGE|R.COPY_DST});l.push(m);let h=i.device.createBuffer({label:`ulg-sph-participating-medium-pack-params`,size:B,usage:R.UNIFORM|R.COPY_DST});l.push(h);let g=i.device.createBuffer({label:`ulg-sph-participating-medium-draw-indirect`,size:4*Uint32Array.BYTES_PER_ELEMENT,usage:R.STORAGE|R.INDIRECT|R.COPY_DST});l.push(g);let _=i.device.createBuffer({label:`ulg-sph-participating-medium-render-uniforms`,size:ye,usage:R.UNIFORM|R.COPY_DST});l.push(_);let v=new ArrayBuffer(B),y=new Uint32Array(v),b=new Float32Array(v);y[0]=s,y[1]=r.routeCount,y[2]=n.length/4,b[4]=i.maxOpticalDepth,b[5]=i.activityEpsilon,i.device.queue.writeBuffer(m,0,a.routeRowsBytes),i.device.queue.writeBuffer(h,0,new Uint8Array(v));let x=i.device.createBindGroup({label:`ulg-sph-participating-medium-pack-bind-group`,layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a.fieldRowsBuffer}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:h}},{binding:3,resource:f},{binding:4,resource:p},{binding:5,resource:{buffer:g}}]});t.clearBuffer(g,0,4*Uint32Array.BYTES_PER_ELEMENT);let S=t.beginComputePass({label:`ulg-sph-participating-medium-pack-pass`});S.setPipeline(o),S.setBindGroup(0,x);let C=Math.ceil(s/4);return S.dispatchWorkgroups(C,C,C),S.end(),a.active=!1,We(e,i,r,a,{opticalTexture:u,scatteringTexture:d,opticalTextureView:f,scatteringTextureView:p,routeRowsBuffer:m,packParamsBuffer:h,drawIndirectBuffer:g,renderUniformBuffer:_,packDispatch:Object.freeze([C,C,C])})}catch(e){a.active=!1;for(let e of l)Ue(e);throw e}}function Ke(e,{inverseViewProjectionMatrix:t,cameraPositionM:n,viewportSize:r,lightDirection:i=[.38,.82,.42],lightIntensity:a=1,ambientIntensity:o=.18,stepCount:s=Se,depthEpsilon:c=1e-6}){let l=K(t,16),u=K(n,3),d=K(r,2),f=K(i,3),p=G(a),m=G(o),h=G(c);if(!l||!u||!d||d.some(e=>!(e>0))||!f||Math.hypot(...f)<=1e-12||!(p>=0)||!(m>=0)||!(h>=0))throw TypeError(`participating medium render uniforms are incomplete or non-finite`);let g=Math.max(H,Math.min(U,Math.round(G(s,Se)))),_=new Float32Array(V);_.set(l,0),_.set(u,16),_[19]=g,_.set(e.descriptorRecord.fieldMinM,20),_[23]=e.descriptorRecord.cellEdgeM,_.set(e.descriptorRecord.fieldMaxM,24),_[27]=m;let v=Math.hypot(...f);return _[28]=f[0]/v,_[29]=f[1]/v,_[30]=f[2]/v,_[31]=p,_[32]=d[0],_[33]=d[1],_[34]=h,e.runtimeRecord.device.queue.writeBuffer(e.renderUniformBuffer,0,_),Object.freeze({stepCount:g,viewportSize:Object.freeze([...d]),readback:!1})}async function qe(e,t,{packedFrame:n=null,inverseViewProjectionMatrix:r=null,cameraPositionM:i=null,viewportSize:a=null,depthTextureView:o=null,lightDirection:s=[.38,.82,.42],lightIntensity:c=1,ambientIntensity:l=.18,stepCount:u=Se,depthEpsilon:d=1e-6}={}){let f=Z(e),p=Te.get(n);if(!p||!p.active||p.runtime!==e||!W(t)||typeof t.setPipeline!=`function`||typeof t.setBindGroup!=`function`||typeof t.drawIndirect!=`function`||!W(o))throw TypeError(`participating medium render requires a live packed frame, pass, and depth view`);let m=await f.renderPipelinePromise;if(Z(e),!p.active)throw TypeError(`participating medium packed frame was destroyed before rendering`);let h=Ke(p,{inverseViewProjectionMatrix:r,cameraPositionM:i,viewportSize:a,lightDirection:s,lightIntensity:c,ambientIntensity:l,stepCount:u,depthEpsilon:d}),g=f.device.createBindGroup({label:`ulg-sph-participating-medium-render-bind-group`,layout:m.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p.renderUniformBuffer}},{binding:1,resource:p.opticalTextureView},{binding:2,resource:p.scatteringTextureView},{binding:3,resource:f.sampler},{binding:4,resource:o}]});return t.setPipeline(m),t.setBindGroup(0,g),t.drawIndirect(p.drawIndirectBuffer,0),Object.freeze({status:`participating-medium-render-encoded`,routeCount:n.routeCount,consumedSurfaceIndices:n.consumedSurfaceIndices,drawCountMode:n.drawCountMode,readback:!1,...h})}function Je(e){let t=Te.get(e);if(!t||!t.active)return!1;t.active=!1,t.runtimeRecord.frames.delete(e);for(let e of[t.opticalTexture,t.scatteringTexture,t.routeRowsBuffer,t.packParamsBuffer,t.drawIndirectBuffer,t.renderUniformBuffer])Ue(e);return!0}var Ye=`
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
`,Xe=`
struct WorkerSurfaceMotionUniform {
  grid: vec4<u32>,
  motion: vec4<f32>,
};
@group(0) @binding(6) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> surface_motion: WorkerSurfaceMotionUniform;
${Ye}
`,Ze=`@vertex
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
`,Qe=/@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n/;if(!Qe.test(ee))throw Error(`shared native compact vertex entry unavailable for retained motion`);var $e=Xe+ee.replace(Qe,Ze);function et({pixels:e,width:t,height:n,mipLevelCount:r,sampleCount:i=64}={}){let a=Math.max(1,Math.round(Number(t)||0)),o=Math.max(1,Math.round(Number(n)||0)),s=Math.max(1,Math.round(Number(r)||1)),c=Math.max(1,Math.round(Number(i)||1)),l=new Float32Array(a*o*3);for(let t=0;t<a*o;t+=1)l[t*3+0]=((e[t*4+0]||0)/255)**2.2,l[t*3+1]=((e[t*4+1]||0)/255)**2.2,l[t*3+2]=((e[t*4+2]||0)/255)**2.2;let u=(e,t,n)=>{let r=e*a-.5,i=Math.min(Math.max(t*o-.5,0),o-1),s=Math.floor(r),c=Math.floor(i),u=r-s,d=i-c,f=(s%a+a)%a,p=(f+1)%a,m=Math.min(Math.max(c,0),o-1),h=Math.min(m+1,o-1);for(let e=0;e<3;e+=1){let t=l[(m*a+f)*3+e]*(1-u)+l[(m*a+p)*3+e]*u,r=l[(h*a+f)*3+e]*(1-u)+l[(h*a+p)*3+e]*u;n[e]=t*(1-d)+r*d}},d=[],f=a,p=o,m=[0,0,0];for(let t=0;t<s;t+=1){let n=new Uint8ClampedArray(f*p*4);if(t===0)for(let t=0;t<f*p;t+=1)n[t*4+0]=e[t*4+0],n[t*4+1]=e[t*4+1],n[t*4+2]=e[t*4+2],n[t*4+3]=255;else{let e=t/Math.max(1,s-1),r=e*e,i=new Float32Array(c*3);for(let e=0;e<c;e+=1){let t=(e+.5)/c,n=e;n=(n<<16|n>>>16)>>>0,n=((n&1431655765)<<1|(n&2863311530)>>>1)>>>0,n=((n&858993459)<<2|(n&3435973836)>>>2)>>>0,n=((n&252645135)<<4|(n&4042322160)>>>4)>>>0,n=((n&16711935)<<8|(n&4278255360)>>>8)>>>0;let a=n*23283064365386963e-26,o=2*Math.PI*t,s=Math.sqrt((1-a)/(1+(r*r-1)*a)),l=Math.sqrt(Math.max(0,1-s*s));i[e*3+0]=Math.cos(o)*l,i[e*3+1]=Math.sin(o)*l,i[e*3+2]=s}for(let e=0;e<p;e+=1){let t=(e+.5)/p*Math.PI,r=Math.cos(t),a=Math.sin(t);for(let t=0;t<f;t+=1){let o=((t+.5)/f-.5)*2*Math.PI,s=Math.cos(o)*a,l=Math.sin(o)*a,d=Math.abs(r)<.999,p=+!d,h=+!!d,g=h*l-0*r,_=0*s-p*l,v=p*r-h*s,y=Math.hypot(g,_,v)||1;g/=y,_/=y,v/=y;let b=r*v-l*_,x=l*g-s*v,S=s*_-r*g,C=0,w=0,T=0,E=0;for(let e=0;e<c;e+=1){let t=i[e*3+0]*g+i[e*3+1]*b+i[e*3+2]*s,n=i[e*3+0]*_+i[e*3+1]*x+i[e*3+2]*r,a=i[e*3+0]*v+i[e*3+1]*S+i[e*3+2]*l,o=s*t+r*n+l*a,c=2*o*t-s,d=2*o*n-r,f=2*o*a-l,p=s*c+r*d+l*f;p<=0||(u(Math.atan2(f,c)*.15915494+.5,Math.acos(Math.min(Math.max(d,-1),1))*.31830989,m),C+=m[0]*p,w+=m[1]*p,T+=m[2]*p,E+=p)}let D=E>0?1/E:0,O=(e*f+t)*4;n[O+0]=Math.round(Math.min(Math.max(C*D,0),1)**(1/2.2)*255),n[O+1]=Math.round(Math.min(Math.max(w*D,0),1)**(1/2.2)*255),n[O+2]=Math.round(Math.min(Math.max(T*D,0),1)**(1/2.2)*255),n[O+3]=255}}}d.push({width:f,height:p,pixels:n}),f=Math.max(1,f>>1),p=Math.max(1,p>>1)}return d}var tt=S,nt=136,rt=6,it=20,at=(e,t)=>(Array.isArray(e)||ArrayBuffer.isView(e))&&e.length===t&&Array.from(e).every(Number.isFinite);function ot(e,t){if(e.byteLength!==t.byteLength)return!1;let n=new Uint8Array(e.buffer,e.byteOffset,e.byteLength),r=new Uint8Array(t.buffer,t.byteOffset,t.byteLength);return n.every((e,t)=>e===r[t])}function st(e,t){return e.schema===t.schema&&e.recordCount===t.recordCount&&e.spectralSampleCount===t.spectralSampleCount&&e.recordStrideBytes===t.recordStrideBytes&&e.spectralSampleStrideBytes===t.spectralSampleStrideBytes&&ot(e.records,t.records)&&ot(e.spectralSamples,t.spectralSamples)}function ct(e){let t=e?.opticalTable;if(e?.schema!==`peercompute.ulg.worker-native-surface-material.v0`||t?.schema!==`peercompute.ulg.optical-gpu-table.v0`||!(t.records instanceof Float32Array)||!(t.spectralSamples instanceof Float32Array)||!Number.isSafeInteger(t.recordCount)||t.recordCount<=0||!Number.isSafeInteger(t.spectralSampleCount)||t.spectralSampleCount<0||t.recordStrideFloats!==m||t.recordStrideBytes!==m*4||t.spectralSampleStrideFloats!==c||t.spectralSampleStrideBytes!==c*4||t.records.length!==t.recordCount*m||t.spectralSamples.length!==t.spectralSampleCount*c||!t.records.every(Number.isFinite)||!t.spectralSamples.every(Number.isFinite))throw TypeError(`worker native surface requires the exact finite optical closure table`);return Object.freeze({...e,lightingProfile:Object.freeze({...e.lightingProfile}),backgroundClearValue:Object.freeze({...e.backgroundClearValue}),opticalTable:Object.freeze({schema:t.schema,recordCount:t.recordCount,recordStrideFloats:m,recordStrideBytes:m*4,spectralSampleCount:t.spectralSampleCount,spectralSampleStrideFloats:c,spectralSampleStrideBytes:c*4,records:new Float32Array(t.records),spectralSamples:new Float32Array(t.spectralSamples)})})}function lt(e,t,n){let r=new Float32Array(tt/4),i=new Uint32Array(r.buffer);if(!at(e.viewProjectionMatrix,16)||!at(n,16))throw TypeError(`native surface requires finite forward and inverse camera matrices`);r.set(e.viewProjectionMatrix,0),r.set(n,64);let a=t.metadata||{},o=t.translation?.surfaceDraw||{},s=t.translation?.surfaceVertices||{},c=t.translation?.positionTransform||t.descriptor?.positionTransform||{},l=t.translation?.positionClamp||{},u=(e.nativeSurfaceAppearance||e.request?.nativeSurfaceMaterial||{}).lightingProfile||{};i[16]=s.compactPositionRowsVertexCount??s.compactPositionRowsBufferRowCount??0,i[17]=s.compactPositionRowsStrideFloats??o.compactPositionRowsStrideFloats??4,i[18]=t.descriptor?.surfaceIndex||0,r[20]=Number(a.materialId)||0,r[21]=Number(a.phaseId)||0,r[22]=Number(a.opticalStateId)||0,r[23]=Number(a.density)||0,r[24]=Number(t.descriptor?.isovalue)||0,r[26]=Number(a.transparencyClassId)||0,r[27]=Number(a.depthWriteFlag)===0?0:1,r[28]=Number(a.renderOrder)||0,r.set([0,1,0],29);let d=c.enabled===!0;r[32]=d&&Number.isFinite(c.scaleM)?c.scaleM:1,r.set(d&&at(c.originM,3)?c.originM:[0,0,0],33),r[36]=d&&Number.isFinite(c.gridBias)?c.gridBias:0,r[37]=+!!d,r[38]=Number(u.nativeAmbientSuppression)||0,r[39]=Number(u.nativeDirectSuppression)||0,l.enabled===!0&&at(l.minM,3)&&at(l.maxM,3)&&(r.set(l.minM,40),r.set(l.maxM,43),r[46]=1),r[47]=Number(u.nativeEnvironmentSuppression)||0;let f=e.boxDimsM;return r[51]=at(f,3)?Math.hypot(...f)/2:0,r.set(at(e.cameraPositionM,3)?e.cameraPositionM:[0,0,0],60),r[63]=Math.max(0,Number(a.emissiveTemperatureK)||0),r}function ut(e,t,n){let r=new Float32Array(32/4);if(!e.motionField?.buffer)return r;let i=new Uint32Array(r.buffer);return i[0]=t.descriptor?.fieldOffset??0,i[1]=t.metadata?.resolution??0,i[2]=e.motionField.rowCount,r[4]=Math.max(0,Number(e.drawMotionAgeS)||0),r[5]=Math.abs(n[32]),r}function dt(e){let t=e?.metadata||{};return t.renderLayer===`vapor-surface`||Number(t.transparencyClassId)===1?`vapor`:t.renderLayer===`refractive-surface`||Number(t.transparencyClassId)===2?`refractive`:`opaque`}function ft({device:e,format:t,depthFormat:n,onAppearanceReady:r=null,fetchImage:i=(...e)=>globalThis.fetch(...e),decodeImage:a=(...e)=>globalThis.createImageBitmap(...e),createEnvironmentCanvas:s=(e,t)=>new globalThis.OffscreenCanvas(e,t),createBackgroundCanvas:c=s}){let l=!1,u=null,d=new Map,f=new Map,p=new Set,m=new Set,h=e=>(m.add(e),e),g=t=>{let n=[...new Set(t.filter(e=>e&&m.has(e)))];for(let e of n)m.delete(e);n.length!==0&&_(e,()=>{for(let e of n)e.destroy?.()})},v=e.createSampler({magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),y=e.createSampler({magFilter:`linear`,minFilter:`linear`,mipmapFilter:`linear`,addressModeU:`repeat`,addressModeV:`clamp-to-edge`}),b=h(e.createTexture({label:`ulg-worker-native-dummy-color`,size:[1,1],format:`rgba8unorm`,usage:rt}));e.queue.writeTexture({texture:b},new Uint8Array([0,0,0,255]),{bytesPerRow:4},[1,1]);let x=h(e.createTexture({label:`ulg-worker-native-dummy-back-depth`,size:[1,1],format:`depth32float`,usage:it})),S=h(e.createBuffer({label:`ulg-worker-native-no-vertex-temperature`,size:16,usage:nt})),C=h(e.createBuffer({label:`ulg-worker-native-no-motion`,size:16,usage:nt})),w=e.createShaderModule({label:`ulg-worker-shared-native-surface`,code:$e}),T=e.createBindGroupLayout({entries:[{binding:0,visibility:1,buffer:{type:`read-only-storage`}},{binding:1,visibility:3,buffer:{type:`uniform`}},{binding:2,visibility:2,buffer:{type:`read-only-storage`}},{binding:3,visibility:2,buffer:{type:`read-only-storage`}},{binding:4,visibility:1,buffer:{type:`read-only-storage`}},{binding:5,visibility:1,buffer:{type:`read-only-storage`}},{binding:6,visibility:1,buffer:{type:`read-only-storage`}},{binding:7,visibility:1,buffer:{type:`uniform`,minBindingSize:32}}]}),D=e.createBindGroupLayout({entries:[{binding:0,visibility:2,texture:{sampleType:`float`}},{binding:1,visibility:2,sampler:{type:`filtering`}},{binding:2,visibility:2,texture:{sampleType:`float`}},{binding:3,visibility:2,sampler:{type:`filtering`}},{binding:4,visibility:2,texture:{sampleType:`depth`}}]}),O=e.createPipelineLayout({bindGroupLayouts:[T,D]}),ee=t=>e.createRenderPipelineAsync?e.createRenderPipelineAsync(t):Promise.resolve(e.createRenderPipeline(t)),te={},ne={color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},re=(async()=>{let r=(await w.getCompilationInfo?.())?.messages?.filter(e=>e.type===`error`)||[];if(r.length)throw Error(r.map(e=>e.message).join(`; `));await Promise.all([`opaque`,`vapor`,`backface`].map(async e=>{let r=e===`backface`;te[e]=await ee({label:`ulg-worker-native-surface-${e}`,layout:O,vertex:{module:w,entryPoint:`vs_main`},...r?{}:{fragment:{module:w,entryPoint:`fs_main`,targets:[{format:t,...e===`vapor`?{blend:ne}:{}}]}},primitive:{topology:`triangle-list`,cullMode:r?`front`:`back`},depthStencil:{format:r?`depth32float`:n,depthWriteEnabled:e!==`vapor`,depthCompare:r?`less`:`less-equal`}})}));let i=e.createShaderModule({code:E});te.background=await ee({label:`ulg-worker-native-background`,layout:`auto`,vertex:{module:i,entryPoint:`vs_main`},fragment:{module:i,entryPoint:`fs_main`,targets:[{format:t}]},primitive:{topology:`triangle-list`},depthStencil:{format:n,depthWriteEnabled:!1,depthCompare:`always`}})})(),k=e=>{if(!(l||f.get(e.url)!==e||e.refs<=0))try{r?.({backgroundImageUrl:e.url,status:e.status,error:e.error})}catch{}},ie=e=>{e&&(e.width=1,e.height=1)},ae=t=>{if(!t)return null;let n=f.get(t);return n||(n={url:t,refs:0,texture:null,status:`pending`,error:null,environmentTexture:null,environmentStatus:`pending`,environmentError:null,abort:new AbortController},f.set(t,n),n.ready=Promise.resolve().then(async()=>{let r=await i(t,{signal:n.abort.signal});if(!r.ok)throw Error(`native background image HTTP ${r.status}`);if(l||f.get(t)!==n)return;let o=await a(await r.blob()),u=null;try{if(l||f.get(t)!==n)return;let r=Math.max(1,Number(o.width)||1),i=Math.max(1,Number(o.height)||1),a=Math.max(1,Math.floor(Number(e.limits?.maxTextureDimension2D)||2048)),d=Math.min(1,Math.min(2048,a)/Math.max(r,i));n.width=Math.max(1,Math.round(r*d)),n.height=Math.max(1,Math.round(i*d)),u=c(n.width,n.height);let p=u.getContext(`2d`,{willReadFrequently:!0});if(!p)throw Error(`native background resize sampler unavailable`);p.drawImage(o,0,0,n.width,n.height);let m=p.getImageData(0,0,n.width,n.height).data,_=n.width*4,v=Math.ceil(_/256)*256,y=m;if(v!==_){y=new Uint8Array(v*n.height);for(let e=0;e<n.height;e++)y.set(m.subarray(e*_,(e+1)*_),e*v)}n.texture=h(e.createTexture({label:`ulg-worker-native-background-image`,size:[n.width,n.height,1],format:`rgba8unorm`,usage:rt})),e.queue.writeTexture({texture:n.texture},y,{bytesPerRow:v,rowsPerImage:n.height},[n.width,n.height,1]),ie(u),u=null,n.status=`ready`;let b=null;try{b=s(256,128);let t=b.getContext(`2d`,{willReadFrequently:!0});if(!t)throw Error(`native environment 2D image sampler unavailable`);t.drawImage(o,0,0,256,128);let r=et({pixels:t.getImageData(0,0,256,128).data,width:256,height:128,mipLevelCount:9,sampleCount:64});n.environmentTexture=h(e.createTexture({label:`ulg-worker-native-environment-prefilter`,size:[256,128],format:`rgba8unorm`,mipLevelCount:9,usage:rt}));for(let t=0;t<r.length;t++)e.queue.writeTexture({texture:n.environmentTexture,mipLevel:t},r[t].pixels,{bytesPerRow:r[t].width*4,rowsPerImage:r[t].height},[r[t].width,r[t].height,1]);n.environmentStatus=`ready`}catch(e){g([n.environmentTexture]),n.environmentTexture=null,n.environmentStatus=`failed`,n.environmentError=String(e?.message||e)}finally{ie(b)}}finally{ie(u),o.close()}}).catch(e=>{g([n.texture]),n.texture=null,n.status=`failed`,n.error=String(e?.message||e),n.environmentStatus=`unavailable-background-failed`}).finally(()=>k(n))),n.refs+=1,n},oe=e=>{!e||--e.refs>0||(f.get(e.url)===e&&f.delete(e.url),e.abort.abort(),g([e.texture,e.environmentTexture]))},se=t=>{for(let e of p)if(st(e.table,t))return e.refs+=1,e;let n=o(e,t);h(n.recordsBuffer),h(n.spectralSamplesBuffer);let r={buffers:n,refs:1,table:{...t,records:new Float32Array(t.records),spectralSamples:new Float32Array(t.spectralSamples)}};return p.add(r),r},ce=e=>{!e||--e.refs>0||(p.delete(e),g([e.buffers.recordsBuffer,e.buffers.spectralSamplesBuffer]))},A=e=>{let t=d.get(e);t&&(d.delete(e),oe(t.background),ce(t.optical),g([t.backgroundUniform,...[...t.bindGroups.values()].map(e=>e.motionUniform)]))},le=async(n,r)=>{if(await re,l)throw Error(`worker native material disposed`);let[i,a]=r.map(Math.floor);if(!(Number.isFinite(i)&&Number.isFinite(a)&&i>0&&a>0))throw TypeError(`native material viewport unavailable`);(!u||u.width!==i||u.height!==a)&&(u&&g([u.color,u.backDepth]),u={width:i,height:a,color:h(e.createTexture({label:`ulg-worker-native-scene-copy`,size:[i,a],format:t,usage:rt})),backDepth:h(e.createTexture({label:`ulg-worker-native-back-depth`,size:[i,a],format:`depth32float`,usage:it}))});let o=n.request.nativeSurfaceMaterial,s=n.nativeSurfaceAppearance||o,c=d.get(n);if(!c){let t=se(o.opticalTable);try{c={optical:t,background:null,backgroundUrl:null,bindGroups:new Map,backgroundUniform:h(e.createBuffer({label:`ulg-worker-native-background-uniform`,size:16,usage:72}))},d.set(n,c)}catch(e){throw ce(t),e}}let f=s.backgroundImageUrl||null;c.backgroundUrl!==f&&(oe(c.background),c.backgroundUrl=f,c.background=ae(f));let p=c.background?.environmentTexture||b;return(c.opticsTargets!==u||c.environmentTexture!==p)&&(c.opticsBindGroup=e.createBindGroup({layout:D,entries:[{binding:0,resource:u.color.createView()},{binding:1,resource:v},{binding:2,resource:p.createView()},{binding:3,resource:y},{binding:4,resource:u.backDepth.createView()}]}),c.opaqueOpticsBindGroup=e.createBindGroup({layout:D,entries:[{binding:0,resource:b.createView()},{binding:1,resource:v},{binding:2,resource:p.createView()},{binding:3,resource:y},{binding:4,resource:x.createView()}]}),c.opticsTargets=u,c.environmentTexture=p),c.diagnostics=de(n),c},ue=(t,n,r,{inverse:i,refractive:a=!1,backface:o=!1}={})=>{let s=d.get(n),c=r.translation?.surfaceVertices,u=r.translation?.surfaceDraw?.drawIndirectRowsBuffer;if(l||!s||!c?.compactPositionRowsBuffer||!c?.compactNormalRowsBuffer||!u||!r.uniformBuffer)return!1;let f=lt(n,r,i);e.queue.writeBuffer(r.uniformBuffer,0,f);let p=r.translation?.surfaceDraw?.compactTemperatureRowsBuffer||S,m=n.motionField?.buffer||C,g=[c.compactPositionRowsBuffer,r.uniformBuffer,s.optical.buffers.recordsBuffer,s.optical.buffers.spectralSamplesBuffer,c.compactNormalRowsBuffer,p,m],_=s.bindGroups.get(r);return _||(_={motionUniform:h(e.createBuffer({label:`ulg-worker-native-surface-motion-uniform`,size:32,usage:72}))},s.bindGroups.set(r,_)),(!_.inputs||g.some((e,t)=>e!==_.inputs[t]))&&(_.bindGroup=e.createBindGroup({layout:T,entries:[{binding:0,resource:{buffer:c.compactPositionRowsBuffer}},{binding:1,resource:{buffer:r.uniformBuffer}},{binding:2,resource:{buffer:s.optical.buffers.recordsBuffer}},{binding:3,resource:{buffer:s.optical.buffers.spectralSamplesBuffer}},{binding:4,resource:{buffer:c.compactNormalRowsBuffer}},{binding:5,resource:{buffer:p}},{binding:6,resource:{buffer:m}},{binding:7,resource:{buffer:_.motionUniform}}]}),_.inputs=g),_.temperatureMode=p===S?`uniform-temperature-fallback`:`retained-compact-temperature-rows`,e.queue.writeBuffer(_.motionUniform,0,ut(n,r,f)),t.setPipeline(te[o?`backface`:dt(r)===`vapor`?`vapor`:`opaque`]),t.setBindGroup(0,_.bindGroup),t.setBindGroup(1,a?s.opticsBindGroup:s.opaqueOpticsBindGroup),t.drawIndirect(u,0),!0},j=(t,n)=>{let r=d.get(n);if(!r?.background?.texture)return!1;let i=r.background.width/r.background.height,a=u.width/u.height,o=i>a?[a/i,1]:[1,i/a];return e.queue.writeBuffer(r.backgroundUniform,0,new Float32Array([...o,0,0])),t.setPipeline(te.background),r.backgroundBindTexture!==r.background.texture&&(r.backgroundBindGroup=e.createBindGroup({layout:te.background.getBindGroupLayout(0),entries:[{binding:0,resource:r.background.texture.createView()},{binding:1,resource:v},{binding:2,resource:{buffer:r.backgroundUniform}}]}),r.backgroundBindTexture=r.background.texture),t.setBindGroup(0,r.backgroundBindGroup),t.draw(3),!0},de=e=>{let t=d.get(e);return Object.freeze({backgroundStatus:t?.background?.status||`not-requested`,backgroundError:t?.background?.error||null,backgroundImageUrl:t?.backgroundUrl||null,environmentPrefilterStatus:t?.background?.environmentStatus||`not-requested`,environmentPrefilterError:t?.background?.environmentError||null,environmentLightingSource:t?.background?.environmentTexture?`native-ggx-prefilter-256x128-9mips-64samples`:`native-analytic-fallback`,opticalTableCacheEntryCount:p.size,temperatureModes:[...new Set(Array.from(t?.bindGroups?.values()??[]).map(e=>e.temperatureMode).filter(Boolean))]})};return{ready:re,prepare:le,draw:ue,drawBackground:j,releaseFrame:A,getDiagnostics:de,clearValue:e=>{let t=e?.nativeSurfaceAppearance||e?.request?.nativeSurfaceMaterial||{};if(t.backgroundImageUrl)return{r:0,g:0,b:0,a:1};let n=t.backgroundClearValue;if(n&&[`r`,`g`,`b`].every(e=>Number.isFinite(n[e])&&n[e]>=0&&n[e]<=1)&&n.a===1)return{r:n.r,g:n.g,b:n.b,a:1};let r=String(t.backgroundColor||``).replace(/^#/,``);return/^[0-9a-f]{6}$/i.test(r)?{r:parseInt(r.slice(0,2),16)/255,g:parseInt(r.slice(2,4),16)/255,b:parseInt(r.slice(4,6),16)/255,a:1}:{r:0,g:0,b:0,a:1}},transferFrame(e,t){let n=d.get(e);n&&e!==t&&(A(t),d.delete(e),d.set(t,n))},copySceneColor(e,t){e.copyTextureToTexture({texture:t},{texture:u.color},[u.width,u.height])},backDepthView(){return u.backDepth.createView()},dispose(){if(!l){l=!0;for(let e of d.keys())A(e);g([...m])}}}}var pt=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0`,mt=`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`,ht=`worker-offscreen-resident-isosurface-presentation-enqueued`,gt=`worker-offscreen-resident-isosurface-presentation-rendered`,_t=`worker-offscreen-resident-isosurface-presentation-failed`,vt=`worker-offscreen-resident-isosurface-presentation-superseded`,yt=`worker-owned-true-isosurface`,bt=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0`,xt=`peercompute.ulg.sph-gpu-render-field.v1`,St=1e3/30;function Ct(e){let t=new Float32Array(16);for(let n=0;n<16;n+=1)t[n]=Number(e[n])||0;for(let e=0;e<4;e+=1){let n=e*4;t[n+2]=.5*t[n+2]+.5*t[n+3]}return t}var wt=`no-full-readback`,Tt=`gpu-conservative-no-readback`,Et=`depth24plus`,Dt=`peercompute.ulg.worker-participating-medium-presentation.v0`,Ot=`not-requested`,kt=F.ready,At=F.empty,jt=F.blocked,Mt=Object.freeze([`ordered-isosurface-and-overlay`]),Nt=Object.freeze([`opaque-isosurface`,`depth-clipped-participating-medium`,`transparent-isosurface-and-overlay`]),Pt=4,Ft=8,It=64,Lt=128,Rt=class extends Error{};`${Ye}`;function Q(){return globalThis.performance?.now?.()??Date.now()}function zt(e,t){return globalThis.GPUBufferUsage?.[e]??t}function Bt(e){return!!(e&&typeof e==`object`&&(e.constructor?.name===`GPUBuffer`||typeof e.mapAsync==`function`||typeof e.getMappedRange==`function`))}function Vt({device:e,retained:t}={}){let n=t?.residentProductMass??null;if(!n)return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let o=n.productEventBuffer??null,s=Number(n.productEventRowCount),c=Number(n.productEventRowCapacity??n.productEventRowCount);if(!(o||n.productEventLiveCountAuthority||i(n)||Number.isFinite(s)&&s>0||Number.isFinite(c)&&c>0))return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let l=o?r(n,e):null,u=l?.expectedRowCapacity??0,d=u*k*Float32Array.BYTES_PER_ELEMENT;if(n.productEventBufferRetained!==!0||!o||!l||!a(l,{handle:n,device:e})||l.hostObserved!==!1||!Number.isSafeInteger(u)||u<=0||l.rowCapacity!==u||l.expectedRowStrideVec4!==k/4||l.rowStrideFloats!==k||!Number.isSafeInteger(s)||s!==u||!Number.isSafeInteger(c)||c!==u||!(Number(o.size)>=d))throw TypeError(`worker-owned isosurface requires an exact retained product-event buffer and authenticated GPU live-count capacity`);return Object.freeze({productEventBuffer:o,productEventSource:n,productEventCount:u,productEventLiveCountDescriptor:l})}function Ht(e){if(!e)return null;if(!Object.hasOwn(e,`__ulgActiveBorrowCount`))throw TypeError(`worker-owned isosurface requires a borrowable retained product-event source`);let t=Math.max(0,Math.floor(Number(e.__ulgActiveBorrowCount)||0));if(e.__ulgActiveBorrowCount=t+1,Number(e.__ulgActiveBorrowCount)!==t+1)throw TypeError(`worker-owned isosurface could not pin its retained product-event source`);let n=!1;return()=>n?!1:(n=!0,e.__ulgActiveBorrowCount=Math.max(0,(Number(e.__ulgActiveBorrowCount)||0)-1),!0)}function Ut(e,t){if(!s(t))return null;let n=t?.dispersedMediumOptics??null,r=Number(t?.particleCount),i=Number(n?.rowCount),a=Number(n?.rowStrideFloats),o=Number(n?.bufferByteLength),c=i*a*Float32Array.BYTES_PER_ELEMENT;if(!n||n.ownsBuffer!==!0||n.destroyed===!0||t.ownsDispersedMediumOpticsBuffer!==!0||t.dispersedMediumOpticsAuthority!==n.authority||t.dispersedMediumOpticsBuffer!==n.buffer||t.dispersedMediumOpticsRowCount!==n.rowCount||t.dispersedMediumOpticsRowStrideFloats!==n.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==n.bufferByteLength||!Number.isSafeInteger(r)||r<=0||n.particleCount!==r||!Number.isSafeInteger(i)||i!==r||!Number.isSafeInteger(a)||a<=0||!Number.isSafeInteger(o)||o<=0||o!==c||!Number.isSafeInteger(Number(n.buffer?.size))||Number(n.buffer?.size)!==o)throw TypeError(`worker-owned isosurface rejected torn dispersed-medium particle-upload aliases`);return Object.freeze({sidecar:n,release:p(e,n)})}function Wt(e){if(!e||typeof e!=`object`)throw TypeError(`worker-owned isosurface requires object surface metadata`);let t={...e};return(Array.isArray(e.boundsCenterM)||ArrayBuffer.isView(e.boundsCenterM))&&(t.boundsCenterM=Object.freeze(Array.from(e.boundsCenterM))),(Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear))&&(t.colorLinear=Object.freeze(Array.from(e.colorLinear))),(Array.isArray(e.opticalScatteringSourceLinear)||ArrayBuffer.isView(e.opticalScatteringSourceLinear))&&(t.opticalScatteringSourceLinear=Object.freeze(Array.from(e.opticalScatteringSourceLinear))),e.opticalState&&typeof e.opticalState==`object`&&(t.opticalState=Object.freeze({...e.opticalState})),Object.freeze(t)}function $(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function Gt(e){let t=$(e,16);if(!t)return null;let n=Array.from({length:4},(e,n)=>Array.from({length:8},(e,r)=>r<4?t[r*4+n]:+(r-4===n)));for(let e=0;e<4;e+=1){let t=e;for(let r=e+1;r<4;r+=1)Math.abs(n[r][e])>Math.abs(n[t][e])&&(t=r);let r=n[t][e];if(!Number.isFinite(r)||Math.abs(r)<=1e-12)return null;t!==e&&([n[e],n[t]]=[n[t],n[e]]);for(let t=0;t<8;t+=1)n[e][t]/=r;for(let t=0;t<4;t+=1){if(t===e)continue;let r=n[t][e];if(r!==0)for(let i=0;i<8;i+=1)n[t][i]-=r*n[e][i]}}let r=new Float32Array(16);for(let e=0;e<4;e+=1)for(let t=0;t<4;t+=1){let i=n[e][t+4];if(!Number.isFinite(i))return null;r[t*4+e]=i}return r}function Kt(e){if(e?.collectiveOpticalRoute===!0||e?.collectiveOpticalRouteSchema!=null||e?.collectiveOpticalRouteKey!=null||e?.collectiveOpticalRouteId!=null)return!0;if(e?.opticalStateId==null)return!1;let t=Number(e?.opticalStateId);return!Number.isSafeInteger(t)||t!==0}function qt(e){let t=e?.participatingMedium??null,n=t?.status??Ot,r=n===kt&&!!t?.packedFrame,i=Math.max(0,Number(t?.collectiveSurfaceCount)||0);return Object.freeze({schema:Dt,status:n,presentationComposition:i>0?`marching-cubes-isosurfaces-plus-participating-medium`:`marching-cubes-isosurfaces`,marchingCubesSurfaceCount:e?.surfaces?.length??0,collectiveOpticalSurfaceCount:i,participatingMediumAggregateDrawCount:+!!r,collectiveOpticalShellFallbackCount:0,participatingMediumDepthClipped:r,participatingMediumPremultipliedAlpha:r,presentationPassOrder:e?.presentationPassOrder??(r?Nt:Mt)})}function Jt(e={},t={}){let n=t.metadata||{},r=t.translation?.positionTransform||t.descriptor?.positionTransform||{},i=new Float32Array(44),a=$(e.viewProjectionMatrix,16)||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];i.set(a,0);let o=$(r.originM,3)||[0,0,0];i.set(o,16),i[19]=Number(r.scaleM)||1;let s=Number.isFinite(Number(r.gridBias))?Number(r.gridBias):-.5;i[20]=s,i[21]=s,i[22]=s;let c=Math.max(0,Number(n.transparencyClassId)||0),l=Math.max(0,Number(n.phaseId)||0),u=Number(n.opticalResponseAuthorityFlag)>0,d=c>.5&&c<1.5||l>2.5&&l<3.5,f=Number(n.opticalEffectiveOpacity);i[23]=u&&d?Math.min(1,Math.max(0,Number.isFinite(f)?f:0)):1;let p=$(n.colorLinear,3)||[.72,.82,.94];i.set(p,24);let m=Number(n.opticalRoughness);if(i[27]=Number.isFinite(m)?Math.min(1,Math.max(.05,m)):c>0?.12:.42,i.set($(e.cameraPositionM,3)||[0,0,0],28),i[31]=Math.max(0,Number(n.emissiveTemperatureK)||0),i[32]=c,i[33]=l,i[34]=Number(n.depthWriteFlag)===0?0:1,i[35]=+!!u,e.motionField?.buffer){let n=new Uint32Array(i.buffer);n[36]=t.descriptor?.fieldOffset??0,n[37]=t.metadata?.resolution??0,n[38]=e.motionField.rowCount,i[40]=Math.max(0,Number(e.drawMotionAgeS)||0),i[41]=Math.abs(i[19])}return i}function Yt(e=[]){let t=(Array.isArray(e)?e:[]).map(e=>e?.metadata??e).filter(Boolean).filter(e=>{let t=Number(e.transparencyClassId)||0,n=Number(e.phaseId)||0;return t>.5&&t<1.5||n>2.5&&n<3.5}),n=t.filter(e=>Number(e.opticalResponseAuthorityFlag)>0),r=n.filter(e=>Number(e.opticalEffectiveOpacity)>0);return Object.freeze({schema:`peercompute.ulg.worker-isosurface-optical-presentation.v0`,status:t.length===0?`no-gas-surfaces`:n.length===t.length?`all-gas-surfaces-closure-governed`:`gas-surface-optical-authority-incomplete`,gasSurfaceCount:t.length,closureGovernedGasSurfaceCount:n.length,visibleClosureGasSurfaceCount:r.length,opticallyThinHiddenGasSurfaceCount:n.length-r.length,allGasSurfacesClosureGoverned:t.length>0&&n.length===t.length,heuristicGasOpacityUsed:t.length>n.length,opticalProvenanceSources:[...new Set(n.map(e=>e.opticalProvenanceSource).filter(Boolean))].sort()})}function Xt(e){return{errorName:e instanceof Error?e.name:null,errorMessage:e instanceof Error?e.message:String(e),errorStack:e instanceof Error?String(e.stack||``).slice(0,2e3):null}}function Zt(e={}){return Object.freeze({schema:pt,presentationGeometry:yt,sameDevicePresentation:!0,gpuToCpuReadbackBytes:0,fullParticleReadbackPerformed:!1,fullParticleReadbackFree:!0,authoritativeStateMutation:!1,scientificValidation:!1,sphValidation:!1,fullPhysicsValidation:!1,...e})}function Qt({request:e=null,retained:t=null}={}){let n=e?.surfaceTable,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3),a=[],o=null;try{o=ct(e?.nativeSurfaceMaterial)}catch{a.push(`native-surface-material`)}return e?.schema!==`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`&&a.push(`request-schema`),e?.enabled!==!0&&a.push(`request-disabled`),(n?.schema!==xt||!(n?.records instanceof Float32Array)||!Array.isArray(n?.metadata)||n.metadata.length!==Number(n.surfaceCount)||n.surfaceCount<=0||n.totalFieldCells<=0)&&a.push(`surface-table`),r||a.push(`view-projection`),i||a.push(`camera-position`),Number.isFinite(Number(e?.fieldPadding))||a.push(`field-padding`),Number(e?.refEdgeM)>0||a.push(`reference-edge`),(t?.status!==`worker-retained-particle-state-ready`||t?.sameWorkerPrivateReferences!==!0||t?.postMessageTransportAllowed!==!1)&&a.push(`same-worker-retained-authority`),(!t?.sphParticleState||!t?.mlsMpmParticleState||!t?.sphParticleUpload||!t?.mlsMpmParticleUpload||!t?.successorSourceFamily&&t?.executionMode!==`tier0-fused-resident-sequence`)&&a.push(`retained-private-references`),(!Bt(t?.sourceStateBuffer)||!Bt(t?.sourceThermoBuffer)||!Bt(t?.sourceMechanicsBuffer)||!Bt(t?.sourceIdentityBuffer))&&a.push(`retained-gpu-buffers`),Object.freeze({ok:a.length===0,status:a.length===0?`worker-owned-isosurface-admission-ready`:`worker-owned-isosurface-admission-blocked`,reason:a.length===0?null:a.join(`,`),blockers:Object.freeze(a),surfaceCount:Math.max(0,Math.floor(Number(n?.surfaceCount)||0)),totalFieldCells:Math.max(0,Math.floor(Number(n?.totalFieldCells)||0)),particleCount:Math.max(0,Math.floor(Number(t?.particleCount)||0)),viewProjectionMatrix:r,cameraPositionM:i,nativeSurfaceMaterial:o})}function $t(e={}){return[e.surfaceIndex??0,e.surfaceKey??``,...e.dims||[],...e.scalarStrides||[],e.scalarOffset??0,e.scalarBufferByteLength??0,e.normalSign??-1,e.scalarType??`f32`].join(`|`)}function en(e){return y({device:e.device,scalarBuffer:e.scalarBuffer,dims:e.dims,scalarStrides:e.scalarStrides,scalarOffset:e.scalarOffset,bufferByteLength:e.scalarBufferByteLength,scalarType:e.scalarType||`f32`,normalSign:e.normalSign,label:e.label||`ulg-worker-isosurface-${e.surfaceKey||e.surfaceIndex||0}`,source:e.source||`ulg-render-field-density-storage-buffer`})}function tn(e){return e?.extensionExecution||null}function nn(e,t){try{e?.releaseTemperatureRows?.()}catch{}try{e?.translation?.destroyExtensionSurfaceBuffers?.({force:!0,releaseLeases:!0,reason:t})}catch{}try{e?.rawExecution?.result?.release?.()}catch{}try{e?.uniformBuffer?.destroy?.()}catch{}}function rn({device:e,context:t,format:n,depthFormat:r=Et,getDepthView:i,getViewportSize:a=null,drawOverlay:o=null,onTerminal:s=null,onFrameSubmitted:c=null,waitForPresentationOpportunity:p=null,getFramebufferEpoch:m=null,nextPresentationQueueCompletionSerial:h=null,temporalNowMs:g=Q,presentationPauseClock:y=ce(),captureRenderRows:S=b,buildRenderField:E=v,buildPresentationFrame:O=null,createNativeSurfaceMaterial:ee=ft,createParticipatingMediumDescriptor:k=Re,createParticipatingMediumGpu:de=Ve,encodeParticipatingMediumPack:pe=Ge,encodeParticipatingMediumRender:me=qe,destroyParticipatingMediumPackedFrame:he=Je}={}){if(!e?.createBuffer||!e?.queue?.submit)throw TypeError(`worker-owned isosurface presenter requires a WebGPU device`);if(!t?.getCurrentTexture||!n)throw TypeError(`worker-owned isosurface presenter requires a configured WebGPU canvas context`);if(typeof i!=`function`)throw TypeError(`worker-owned isosurface presenter requires a depth-view provider`);if(typeof m!=`function`)throw TypeError(`worker-owned isosurface presenter requires a framebuffer-epoch provider`);let M=!1,N=0,P=0,F=!1,_e=null,I=null,L=null,R=null,z=null,ve=0,B=!0,V=0,ye=new AbortController,be=null,xe=null,Se=null,H=null,U=0,Ce=0,we=null,Te=null,Ee=null,De=Promise.resolve(),W=null,G=null,K=()=>{W?.abort(),G?.abort()},q=null,J=null,Y=0,Oe=null,ke=new Set,X=null,Ae=0,je=null,Me=!1,Ne=0,Pe=new Map,Fe=(e,t,n={})=>{try{s?.(Zt({status:t,requestGeneration:e.generation,sourceCapturedBeforePhysicsContinuation:!0,...e.receiptFields,...n,updatedAtMs:Q()}))}catch{}},Ie=(t,n)=>{if(!t)return;let r=()=>{try{t.destroyRenderRowsBuffer?.({reason:n})}catch{try{t.destroyRenderRowsBuffer?.()}catch{}}};try{_(e,r)}catch{r()}},Le=e=>!e||e.productEventSourceBorrowReleased?!1:(e.productEventSourceBorrowReleased=!0,e.releaseProductEventSourceBorrow?.()===!0),ze=e=>!e||e.dispersedMediumSourceBorrowReleased?!1:(e.dispersedMediumSourceBorrowReleased=!0,e.releaseDispersedMediumSourceBorrow?.()===!0),Be=e=>{if(!e?.ledgerParcelsBorrow)return;let t=e.ledgerParcelsBorrow;e.ledgerParcelsBorrow=null,t.release()},Z=(t,n)=>{if(!t)return;if(H?.releaseFrame(t),t.motionField){let n=t.motionField;t.motionField=null,_(e,()=>n.destroy())}for(let e of t.surfaces||[])nn(e,n);let r=t.participatingMedium;if(r?.packedFrame&&r.released!==!0){r.released=!0;try{he(r.packedFrame)}catch{}}},He=t=>{let n=z;z=null,n&&ct(()=>{_(e,()=>Z(n.frame,t))}).catch(()=>{})},Ue=t=>{if(t)try{_(e,()=>t.destroy())}catch{t.destroy()}},We=()=>(je||=de(e,{colorFormat:n,depthFormat:r}),je),Ke=()=>(H||=ee({device:e,format:n,depthFormat:r,onAppearanceReady(){M||dn({reason:`worker-native-appearance-ready`}).catch(()=>{})}}),H),Ye=async e=>{if(!(!e||e.released)){e.released=!0;try{await e.wrapper?.adapter?.release?.({destroyDevice:!1})}catch{}}},Xe=async()=>{let e=[...Pe.values()];Pe.clear(),await Promise.all(e.map(Ye))},Ze=async t=>X&&Ae>=t?X:(await Xe(),X?.destroy?.(),Ae=Math.max(4,Math.ceil(t)),X=e.createBuffer({label:`ulg-worker-owned-isosurface-render-field`,size:Ae,usage:zt(`STORAGE`,Lt)|zt(`COPY_SRC`,Pt)|zt(`COPY_DST`,Ft)}),X),Qe=async t=>{let n=$t(t),r=Pe.get(n);if(r&&!r.released&&r.scalarBuffer===t.scalarBuffer)return r;r&&await Ye(r);let i=en(t),a=T({device:e,volume:i,adapterId:`webgpu-marching-cubes.buffer-volume.v0`,adapterFactory({device:e,volume:t}){return x({device:e,volume:t,adapterId:`webgpu-marching-cubes.buffer-volume.v0`})}}),o={signature:n,scalarBuffer:t.scalarBuffer,volume:i,wrapper:a,released:!1};return Pe.set(n,o),o},$e=e=>[...e.surfaces||[]].sort((t,n)=>{let r=e=>e.translation?.surfaceDraw?.surfaces?.[0]||e.metadata||{},i=e=>Number.isFinite(Number(r(e).renderOrder))?Number(r(e).renderOrder):Number(r(e).transparencyClassId)||0,a=t=>{let n=$(r(t).boundsCenterM,3),i=$(e.cameraPositionM,3);return n&&i?n.reduce((e,t,n)=>e+(t-i[n])**2,0):0};return i(t)-i(n)||(dt(t)===`opaque`?a(t)-a(n):a(n)-a(t))}),et=null,nt=Object.freeze({h2o:[.78,.9,.98],ice:[.78,.9,.98],fe:[.55,.56,.6]}),rt=(t,i)=>{if(i?.solidRigidIsosurfaceSplatted===!0)return!1;let a=i?.solidRigidFamily??u(e);return!a||a.destroyed||a.device!==e||!Array.isArray(i.viewProjectionMatrix)?!1:(et??=fe(e,{colorFormat:n,depthFormat:r}),et.draw(t,a,{viewProjection:Ct(i.viewProjectionMatrix),colorLinear:nt[String(a.materials?.[0]).toLowerCase()]??[.7,.7,.72]}),!0)},it=async(n,{viewProjectionMatrix:r=n.viewProjectionMatrix,cameraPositionM:s=n.cameraPositionM,reason:l=`worker-owned-isosurface-frame`,allowLaggedGeneration:u=!1,requiresVisibleFrame:d=!1,requiresRecoverableFrame:f=!1,playbackRevision:_=null,motionOnly:v=!1,submissionBoundary:y=null,onSubmissionQueued:b=null,submissionDeadlineMs:x=null,expectedFramebufferEpoch:S=null,signal:C=null,motionAgeS:w=n.lastDisplayedMotionAgeS||0}={})=>{let T=!1,E=()=>!!(!M&&C?.aborted!==!0&&(T||x==null||Number.isFinite(x)&&g()<=x)&&(_==null||_===V)&&(!v||B)&&n?.invalidationEpoch===P&&(S==null||Number(m())===S)&&n.generation>=U&&(!d||R===n)&&(!f||z?.frame===n)&&(N===n.generation||u===!0));if(!E())return!1;let D=n.participatingMedium?.status===kt?n.participatingMedium.packedFrame:null,O=D?We():null;if(await Promise.all([Ke().ready,O?.ready]),!E())return!1;let ee=be||$(r,16),te=xe||$(s,3);ee&&(n.viewProjectionMatrix=[...ee]),te&&(n.cameraPositionM=[...te]);let ne=Ke(),re=typeof a==`function`?null:t.getCurrentTexture(),k=$(typeof a==`function`?a():[re?.width,re?.height],2);if(!k||k.some(e=>!(e>0)))throw Error(`native material presentation requires a positive viewport`);let se;do if(se=Se,n.nativeSurfaceAppearance=se||n.request.nativeSurfaceMaterial,await ne.prepare(n,k),!E())return!1;while(se!==Se);be&&(n.viewProjectionMatrix=[...be]),xe&&(n.cameraPositionM=[...xe]);let ce=Gt(n.viewProjectionMatrix);if(!ce)throw Error(`native material requires an invertible camera`);w=Math.max(w,n.lastDisplayedMotionAgeS||0),n.drawMotionAgeS=w;let A=!Me&&typeof e.pushErrorScope==`function`&&typeof e.popErrorScope==`function`,le=!1,ue=async()=>le?(le=!1,e.popErrorScope()):null,j,de,fe;A&&(e.pushErrorScope(`validation`),le=!0);try{let r=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-presentation`}),a=t.getCurrentTexture(),s=a.createView(),c=i(),l=$e(n),u=[`opaque-isosurface`],d=(e,t,r={})=>{if(ne.draw(e,n,t,{inverse:ce,...r})!==!0)throw Error(`native isosurface draw is missing mandatory GPU buffers`)},f=r.beginRenderPass({label:`ulg-worker-owned-isosurface-opaque-pass`,colorAttachments:[{view:s,clearValue:ne.clearValue(n),loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:c,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{ne.drawBackground(f,n);for(let e of l)dt(e)===`opaque`&&d(f,e);rt(f,n)}finally{f.end()}let p=l.filter(e=>dt(e)===`refractive`);p.length&&u.push(`refractive-isosurface`);for(let e of p){ne.copySceneColor(r,a);let t=r.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-backface-pass`,colorAttachments:[],depthStencilAttachment:{view:ne.backDepthView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{d(t,e,{backface:!0})}finally{t.end()}let n=r.beginRenderPass({label:`ulg-worker-owned-isosurface-refractive-pass`,colorAttachments:[{view:s,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:c,depthLoadOp:`load`,depthStoreOp:`store`}});try{d(n,e,{refractive:!0})}finally{n.end()}}if(D){u.push(`depth-clipped-participating-medium`);let e=r.beginRenderPass({label:`ulg-worker-owned-participating-medium-pass`,colorAttachments:[{view:s,loadOp:`load`,storeOp:`store`}]});try{await me(O,e,{packedFrame:D,inverseViewProjectionMatrix:ce,cameraPositionM:n.cameraPositionM,viewportSize:k,depthTextureView:c,lightDirection:[.38,.82,.42]})}finally{e.end()}}u.push(`transparent-isosurface-and-overlay`);let h=r.beginRenderPass({label:`ulg-worker-owned-isosurface-transparent-overlay-pass`,colorAttachments:[{view:s,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:c,depthLoadOp:`load`,depthStoreOp:`discard`}});try{for(let e of l)dt(e)===`vapor`&&d(h,e);o?.(h,n.viewProjectionMatrix,n.boxDimsM)}finally{h.end()}if(fe=Object.freeze(u),!E())return await ue(),!1;if(j=Number(m()),!Number.isSafeInteger(j)||j<=0)throw Error(`worker-owned isosurface framebuffer epoch is unavailable`);let g=r.finish();if(de=Q(),Number(m())!==j||!E())return await ue(),!1;e.queue.submit([g]),T=!0,n.lastSubmittedMotionAgeS=w,U=Math.max(U,n.generation);let _=le?await ue():null;if(_)throw Error(_.message||String(_));A&&(Me=!0)}catch(e){try{await ue()}catch{}throw e}if(!E()||Number(m())!==j)return!1;if(typeof e.queue?.onSubmittedWorkDone!=`function`)throw Error(`worker-owned isosurface presentation queue completion is unavailable`);let pe=typeof h==`function`?Number(h()):Ne+1;if(!Number.isSafeInteger(pe)||pe<=Ne)throw Error(`worker-owned isosurface presentation queue completion serial did not advance`);Ne=pe;let he=e.queue.onSubmittedWorkDone(),ge=!1;Promise.resolve(he).then(()=>{ge=!0},()=>{});let F=(()=>{try{if(typeof p!=`function`)throw Error(`worker-owned isosurface presentation opportunity observer is unavailable`);return Promise.resolve(p({afterGpuCompletion:he,isCurrent:()=>E()&&Number(m())===j,signal:C})).then(e=>{if(e?.available===!0&&!ge)throw Error(`worker-owned isosurface presentation opportunity preceded GPU completion`);return e})}catch(e){return Promise.reject(e)}})();if(F.catch(()=>{}),b?.(),await he,!E()||Number(m())!==j)return!1;let _e=Q(),I=await F,L=I?.available===!1&&I.method===`worker-request-animation-frame-timeout`;if(!L&&(!E()||Number(m())!==j))return!1;if(I?.available!==!0)throw new(L?Rt:Error)(`worker-owned isosurface lacked a post-GPU presentation opportunity`);let ve=Number.isFinite(Number(I.observedAtMs))?Number(I.observedAtMs):Q(),ye=Yt(n.opticalMetadataSnapshots||n.surfaces);n.presentationPassOrder=fe;let H=qt(n),Ce=Object.freeze({presentationFrameSchema:bt,presentationFrameStatus:`worker-owned-isosurface-presentation-opportunity`,presentationFrameAdmitted:!0,nativeMaterialShader:`existing-native-compact-surface-with-retained-motion`,condensedDepthTestEnabled:!0,condensedDepthWriteEnabled:!0,vaporDepthTestEnabled:!0,vaporDepthWriteEnabled:!1,isosurfaceTemporalPresentation:w>0,isosurfacePresentationMotionAgeS:w,isosurfacePresentationSourceTimeS:n.sourceTimeS??null,isosurfacePresentationMotionMethod:w>0?`bounded-gpu-field-velocity-extrapolation`:`committed-source-mesh`,presentationOnly:w>0,authoritativeStateMutation:!1,presentationFrameGpuCompleted:!0,presentationFrameGpuCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationFramePresentationOpportunity:!0,presentationFramePresentationOpportunityMethod:I.method??null,presentationFrameSubmitToGpuCompleteMs:Math.max(0,_e-de),presentationFrameSubmitToPresentationOpportunityMs:Math.max(0,ve-de),presentationQueueCompletionCount:Ne,presentationQueueCompletionSerial:pe,presentationQueueCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationQueueCompletionScope:ie,physicsQueuePrefixCoverage:y?ae:oe,physicsHostQueueFenceParticipation:y?!0:null,...y?{physicsContinuationBlocked:!0,presentationQosHostQueueFenceCount:1,motionPresentationQosBoundary:y}:{},workerFramebufferEpoch:j,workerOwnedOpticalPresentation:ye,workerOwnedParticipatingMediumPresentation:H,presentationComposition:H.presentationComposition,marchingCubesSurfaceCount:H.marchingCubesSurfaceCount,collectiveOpticalSurfaceCount:H.collectiveOpticalSurfaceCount,participatingMediumStatus:H.status,participatingMediumAggregateDrawCount:H.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:H.collectiveOpticalShellFallbackCount,participatingMediumDepthClipped:H.participatingMediumDepthClipped,participatingMediumPremultipliedAlpha:H.participatingMediumPremultipliedAlpha,presentationPassOrder:H.presentationPassOrder});n.lastDisplayedMotionAgeS=w;try{c?.({reason:l,generation:n.generation,surfaceCount:n.totalSurfaceCount??n.surfaces.length,sphStep:n.sphStep,...Ce})}catch{}return Ce},at=0,ot=0,st=null,ct=e=>{ot+=1;let t=De.then(e);return De=t.then(e=>{--ot,e&&(st=g())},()=>{--ot}),t},lt=()=>st==null||g()-st>33.333333333333336,ut=(e,t)=>ct(()=>it(e,t)),mt=e=>{if(M||!B||R!==e||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==P||e.generation<U)return!1;let t=A(e.motionPacing,g());return t>(e.lastDisplayedMotionAgeS||0)&&t<e.motionPacing.maxSimulationAgeS},yt=({waitForPendingSlot:e=!1}={})=>typeof e!=`boolean`||G||!lt()&&(W||ot>0)?!1:(e||!W)&&mt(R),xt=()=>{Ce+=1,we!=null&&globalThis.clearTimeout(we),we=null,Te?.(),Te=null},St=e=>{if(xt(),!B||!e?.motionField?.buffer||!e.motionPacing)return;let t=Ce,n=V,r=ye.signal,i=()=>!M&&R===e&&B&&n===V&&e.invalidationEpoch===P&&Ce===t,a=Symbol(`coalesced-isosurface-temporal-frame`),o=!1;(async()=>{for(;i();){let t=g(),s=A(e.motionPacing,t);if(s==null||o&&s>=e.motionPacing.maxSimulationAgeS)return;if(s>(e.lastDisplayedMotionAgeS||0)){let t;try{t=await ct(()=>{if(!i())return!1;let t=A(e.motionPacing,g());return t==null||o&&t>=e.motionPacing.maxSimulationAgeS?!1:t>(e.lastDisplayedMotionAgeS||0)?it(e,{reason:`worker-owned-isosurface-temporal-presentation`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:n,motionOnly:!0,signal:r,motionAgeS:t}):a})}catch(n){if(!(n instanceof Rt))throw n;if(!i())return;e.temporalPresentationError=n.message;let r=A(e.motionPacing,g());if(!Number.isFinite(r)||r>=e.motionPacing.maxSimulationAgeS)return;o=!0,t=a}if(!t||!i())return;t!==a&&(o=!1,e.temporalPresentationError=null,Dt(e,`presentation-only retained GPU field motion`,t))}if((e.lastDisplayedMotionAgeS||0)>=e.motionPacing.maxSimulationAgeS)return;let c=1e3/e.motionPacing.targetHz-(g()-t);c>0&&i()&&await new Promise(e=>{Te=e,we=globalThis.setTimeout(()=>{we=null,Te=null,e()},c)})}})().catch(t=>{i()&&(e.temporalPresentationError=String(t?.message||t))})},Dt=(e,t,n)=>{let i=qt(e),a=e.surfaces.length+i.participatingMediumAggregateDrawCount;Fe({generation:e.generation,receiptFields:e.receiptFields},gt,{reason:t,surfaceCount:e.totalSurfaceCount??e.surfaces.length,submittedSurfaceCount:a,activeSurfaceCount:null,indirectDrawCount:a,depthAttachmentFormat:r,depthAttachmentReady:!0,boxWireframeDrawCount:+!!e.boxDimsM,boxDimsM:e.boxDimsM?[...e.boxDimsM]:null,nonemptySurfaceCountMode:`gpu-indirect-not-read-back`,triangleCountMode:`gpu-indirect-not-read-back`,readbackMode:wt,...n})},Ot=(t,n,r,i)=>{let a=t.ledgerParcelsBorrow?.parcels??null;if(!a||a.device!==e||globalThis.__ulgDisableLedgerParcelOptics)return null;let o=r.surfaceTable.metadata,s=i.consumedSurfaceIndices.find(e=>Number(o[e]?.materialId)===a.vaporMaterialId),c=s==null?null:o[s],l=globalThis.__ulgLedgerParcelOptics??={frames:0,routed:0,unrouted:0};return l.frames++,c?(l.routed++,ge({device:e,encoder:n,parcels:a,fieldRowsBuffer:i.fieldRowsBuffer,fieldOffset:Number(c.fieldOffset),resolution:Number(c.resolution),fieldPadding:Number(r.fieldPadding),refEdgeM:Number(r.refEdgeM)})):(l.unrouted++,null)},Mt=async(t,n)=>{if((n?.dispersedMediumOptics??null)!==t.dispersedMediumOptics)throw TypeError(`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`);let r=await Ze(t.request.surfaceTable.totalFieldCells*C*Float32Array.BYTES_PER_ELEMENT),i=t.productEvents,a=await E({device:e,renderRows:n.renderRows,renderRowsBuffer:n.renderRowsBuffer,renderRowsSource:n,dispersedMediumOptics:t.dispersedMediumOptics,schroederSpatialSourceFamily:n.schroederSpatialSourceFamily,surfaceTable:t.request.surfaceTable,particleCount:n.particleCount,productEventBuffer:i.productEventBuffer,productEventSource:i.productEventSource,productEventCount:i.productEventCount,productEventLiveCountDescriptor:i.productEventLiveCountDescriptor,fieldPadding:Number(t.request.fieldPadding),refEdgeM:Number(t.request.refEdgeM),renderSmearDtS:Math.max(0,Number(t.request.renderSmearDtS)||0),readbackMode:wt,retainFieldRowsBuffer:!0,retainMotionFieldBuffer:!0,retainSurfaceBuffer:!1,waitForQueueCompletion:!1,deferCleanup:!0,targetFieldRowsBuffer:r,targetFieldRowsBufferByteLength:Ae});Le(t),ze(t),Ie(n,`worker-isosurface-render-field-submitted`),t.capturedReleased=!0;let o=a.surfaceTable.metadata.map(Wt),s=o.map((t,n)=>w({device:e,renderField:a,surface:a.surfaceTable.metadata[n],surfaceIndex:n})),c=s.find(e=>e?.ok!==!0);if(c)throw a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-descriptor-blocked`}),Error(c.reason||c.status);let l,u,d=null,f=new Set,p;try{if(l=Object.freeze(s.map((e,t)=>Object.freeze({descriptor:e,metadata:o[t]}))),u=o.map((e,t)=>Kt(e)?t:-1).filter(e=>e>=0),u.length>0){d=k({device:e,renderField:a,surfaceDescriptors:u.map(e=>l[e])});let t=d?.status;if(![kt,At,jt].includes(t))throw TypeError(`participating-medium descriptor returned an unknown route status`);let n=d.consumedSurfaceIndices;if(!Array.isArray(n))throw TypeError(`participating-medium descriptor omitted consumed surface indices`);f=new Set(n);let r=new Set(u);if(!(f.size===r.size&&[...f].every(e=>Number.isSafeInteger(e)&&r.has(e))))throw TypeError(`participating-medium descriptor did not consume the exact collective optical route set`)}p=s.filter((e,t)=>!f.has(t))}catch(e){throw a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-participating-medium-descriptor-failed`}),e}let m=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-marching-cubes`}),h=[],g=[],v=null,y=null,b=null,x=t.solidRigidFamily??null,S=!1;try{x&&(b=re({device:e,encoder:m,family:x,renderField:a}),S=!!b);for(let n of p){let r=await Qe(n);D({device:e,descriptor:n,volume:r.volume});let i=await r.wrapper.extractSurface({volume:r.volume,isovalue:n.isovalue,ownsBuffer:!0,readbackMode:Tt,vertexRowsBudget:Math.max(3,Math.floor(Number(t.request.vertexRowsBudget)||3)),commandEncoder:m}),a=tn(i);if(a?.ok===!1||!a?.result)throw Error(i?.reason||a?.status||`worker-owned marching-cubes extraction failed`);let o={descriptor:n,wrapped:i,rawExecution:a,temperatureRows:null};h.push(o);let s=a.result,c=s.outputDescriptors?.rows?.position||s.rowMetadata?.position,l=c?.buffer||s.outputDescriptors?.retainedBuffers?.position||s.buffer,u=s.actualVertexCounterBuffer||s.vertexCounterBuffer;o.temperatureRows=te({device:e,commandEncoder:m,compactPositions:{buffer:l,byteLength:c?.bufferByteLength??s.bufferByteLength??l?.size,rowCount:c?.rowCount??s.vertexCount,strideFloats:c?.rowStrideFloats??s.vertexStrideFloats,surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId},actualVertexCounter:{buffer:u,byteLength:s.actualVertexCounterBufferByteLength??s.vertexCounterBufferByteLength??u?.size},renderField:{buffer:n.scalarBuffer,byteLength:n.scalarBufferByteLength,dims:n.dims,scalarStrides:n.scalarStrides,scalarOffsetFloats:n.scalarOffset,volumeGenerationId:s.volumeGenerationId},generation:{surfaceGenerationId:s.surfaceGenerationId,volumeGenerationId:s.volumeGenerationId}})}if(d?.status===kt&&(y=Ot(t,m,a,d),v=await pe(We(),m,d),v?.status!==`participating-medium-packed-gpu-resident`||v.readback!==!1))throw TypeError(`participating-medium pack did not return an exact GPU-resident no-readback frame`);if(e.queue.submit([m.finish()]),b){let t=b;b=null,_(e,()=>t.destroy())}if(y){let t=y;y=null,_(e,()=>t.destroy())}for(let e of h)e.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();let n=[];for(let t of h){let r=t.descriptor,i=o[r.surfaceIndex],s=await ne({device:e,extensionExecution:t.rawExecution,schroederSpatialSourceFamily:a.schroederSpatialSourceFamily,surfaceIndex:r.surfaceIndex,materialId:i.materialId,phaseId:i.phaseId,opticalStateId:i.opticalStateId,material:i.material,phase:i.phase,renderKey:i.renderKey,surfaceKey:i.surfaceKey,isolation:r.isovalue,transparencyClassId:i.transparencyClassId,depthWriteFlag:i.depthWriteFlag,renderOrder:i.renderOrder,positionTransform:r.positionTransform,positionTransformResolution:i.resolution,sourceVoxelLinearIndex:r.fieldOffset,fieldPadding:a.fieldPadding,refEdgeM:a.refEdgeM,positionGridBias:r.positionTransformGridBias,fieldGradient:{buffer:r.scalarBuffer,scalarOffsetFloats:r.scalarOffset,rowStrideFloats:r.cellRowStrideFloats,resolution:i.resolution},readbackMode:wt,compactSummaryReadback:!1,translateVertexRows:!1,allowExtensionDrawIndirectBuffer:!0,retainVertexRowsBuffer:!0,retainDrawRowsBuffer:!0,retainDrawIndirectRowsBuffer:!0,waitForQueueCompletion:!1}),c=e.createBuffer({label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:tt,usage:zt(`UNIFORM`,It)|zt(`COPY_DST`,Ft)}),l=t.temperatureRows;s.nativeSurfaceTemperatureRows=l,Object.assign(s.surfaceDraw,{compactTemperatureRowsBuffer:l.temperatureRowsBuffer,compactTemperatureRowsBufferRetained:!0,compactTemperatureRowsBufferByteLength:l.temperatureRowsBufferByteLength,compactTemperatureRowsBufferRowCount:l.temperatureRowsBufferRowCount,compactTemperatureRowsStrideFloats:l.temperatureRowsStrideFloats,compactTemperatureRowsSchema:l.temperatureRowsSchema,compactTemperatureRowsLayoutName:l.temperatureRowsLayoutName,compactTemperatureRowsEncoding:l.encoding,compactTemperatureRowsSemantic:l.semantic,compactTemperatureRowsSurfaceGenerationId:l.surfaceGenerationId,compactTemperatureRowsVolumeGenerationId:l.volumeGenerationId,compactTemperatureRowsCoverageSchema:l.coverage.schema,compactTemperatureRowsCoverageComplete:l.coverage.complete,compactTemperatureRowsCoverageRowCount:l.coverage.rowCount,compactTemperatureRowsOwnership:l.temperatureRowsOwnership,compactTemperatureRowsAdditionalSubmitCount:0}),n.push({descriptor:r,metadata:i,translation:s,rawExecution:t.rawExecution,uniformBuffer:c,releaseTemperatureRows:()=>Ue(l),bindGroups:new Map}),g.push(n[n.length-1])}let r=a.takeMotionField?.()||null;return a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-submitted`}),{generation:t.generation,invalidationEpoch:t.invalidationEpoch,sphStep:t.sphStep,sourceTimeS:t.sourceTimeS,motionField:r,request:t.request,receiptFields:t.receiptFields,viewProjectionMatrix:[...t.admission.viewProjectionMatrix],cameraPositionM:[...t.admission.cameraPositionM],boxDimsM:$(t.request.boxDimsM,3),totalSurfaceCount:o.length,opticalMetadataSnapshots:o,participatingMedium:d?{status:d.status,reason:d.reason??null,collectiveSurfaceCount:u.length,consumedSurfaceCount:f.size,packedFrame:v,released:!1}:null,solidRigidFamily:x??null,solidRigidIsosurfaceSplatted:S,surfaces:n}}catch(e){b?.destroy(),y?.destroy(),a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-failed`});for(let e of g)nn(e,`worker-isosurface-partial-translation-failed`);let t=new Set(g.map(e=>e.rawExecution));for(let e of h)if(!t.has(e.rawExecution)){e.temperatureRows&&Ue(e.temperatureRows);try{e.rawExecution?.result?.release?.()}catch{}}if(v)try{he(v)}catch{}throw e}},Nt=(t,n,r,i)=>{let a=R;R=t,R.sourcePresentedAtMs=g(),R.sourcePresentationPausedWallMs=y.pausedAt(R.sourcePresentedAtMs);let o=a?a.sourcePresentationPausedWallMs:t.sourceTimingPausedWallMs;R.motionPacing=se(R,a,R.sourcePresentedAtMs,n,{pausedWallDeltaMs:o==null?NaN:R.sourcePresentationPausedWallMs-o}),St(R),a&&_(e,()=>{Z(a,`worker-isosurface-replaced`)}),Dt(R,r,i)},Bt=async()=>{if(!(F||M)){F=!0;try{for(;L&&!M;){let e=L;L=null,I=e;let t=null,n=null;try{if(t=await e.capturePromise,e.invalidationEpoch!==P||M){Fe(e,vt,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(n=await(O??Mt)(e,t),n.request=e.request,n.sourceTimeS=e.sourceTimeS,n.sourceTimingPausedWallMs=e.sourceTimingPausedWallMs,e.invalidationEpoch!==P||M)if(!M&&e.invalidationEpoch!==P&&N===e.generation&&Oe===P)e.invalidationEpoch=P,n.invalidationEpoch=P;else{Z(n,`worker-isosurface-superseded-before-presentation`),n=null,Fe(e,vt,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(R&&R.generation>=n.generation){Z(n,`worker-isosurface-older-than-visible-frame`),n=null,Fe(e,vt,{reason:`a newer isosurface generation is already visible`});continue}let r=!1,i=()=>!M&&I===e&&N===e.generation,a=async e=>{for(;;)try{return await ct(()=>r&&!i()?!1:it(n,{reason:e,allowLaggedGeneration:!r}))}catch(e){if(!(e instanceof Rt))throw e;if(!i())return!1;if(r)throw e;r=!0}},o=await a(`committed-worker-isosurface`);for(;!o?.presentationFrameAdmitted&&n.invalidationEpoch!==P&&N===e.generation&&Oe===P&&P>n.invalidationEpoch&&!M;){let t=P;e.invalidationEpoch=t,n.invalidationEpoch=t,o=await a(`committed-worker-isosurface-after-resize`)}if(!o?.presentationFrameAdmitted){if(n.invalidationEpoch!==P||M||N!==e.generation){Z(n,`worker-isosurface-invalidated-during-presentation`),n=null,Fe(e,vt,{reason:`the worker-owned isosurface presentation was invalidated during submit`});continue}throw Error(`worker-owned isosurface frame was not current at submit`)}Nt(n,e.sourceTimingBootstrap,`same-device retained state rendered as true isosurface`,o),n=null}catch(t){t instanceof Rt&&n&&!M&&n.generation===N&&n.generation===U&&n.invalidationEpoch===P&&(He(`worker-isosurface-recovery-replaced`),z=Object.freeze({frame:n,sourceTimingBootstrap:e.sourceTimingBootstrap,parkedAfterRedrawSequence:ve}),n=null),n&&Z(n,`worker-isosurface-build-failed`),Fe(e,_t,{reason:t instanceof Error?t.message:String(t),...Xt(t)})}finally{t&&!e.capturedReleased&&Ie(t,`worker-isosurface-capture-retired`),Le(e),ze(e),Be(e),I=null}}}finally{F=!1}}},Jt=()=>{if(_e||M)return;let e=Bt();_e=e,e.finally(()=>{_e===e&&(_e=null),L&&!M&&Jt()})},rn=(e,t)=>{e&&(Le(e),ze(e),Be(e),e.capturePromise.then(e=>{Ie(e,`worker-isosurface-queued-job-superseded`)}).catch(()=>{}),Fe(e,vt,{reason:t}))},an=()=>{J&&=(J.resolve(!1),null)},on=()=>{for(let e of ke)e();ke.clear()},sn=()=>{Y=Math.max(0,Y-1),Y===0&&on()},cn=()=>Y===0?Promise.resolve():new Promise(e=>ke.add(e)),ln=async()=>{for(;J&&!M;){let e=J.allowCandidateRecovery&&J.requestSequence>(z?.parkedAfterRedrawSequence??1/0)&&z?.frame.generation===N&&z.frame.generation===U&&z.frame.invalidationEpoch===P?z:null,t=e||R&&R.invalidationEpoch===P&&R.generation>=U;if(!t){if(_e){await _e.catch(()=>{});continue}if(Y>0){await cn();continue}}let n=J;J=null;let r=e?.frame||R;if(!t){n.resolve(!1);continue}try{let t=await ut(r,{...n.options,allowLaggedGeneration:!e,requiresVisibleFrame:!e,requiresRecoverableFrame:!!e});if(e&&t&&z===e&&r.generation===N&&r.invalidationEpoch===P&&!M){z=null,Nt(r,e.sourceTimingBootstrap,n.options.reason,t),n.resolve(!0);continue}let i=!!(!e&&t&&R===r&&r.invalidationEpoch===P&&r.generation>=U&&!M);if(i)Dt(r,n.options.reason,t);else if(!M&&!J&&(I||L||Y>0)){J=n;continue}n.resolve(i)}catch(t){e&&z?.frame.generation===e.frame.generation&&!(t instanceof Rt)&&He(`worker-isosurface-recovery-failed`),n.reject(t)}}},un=()=>{if(q||M||!J)return;let e=ln();q=e,e.finally(()=>{q===e&&(q=null),un()})},dn=(e,{allowCandidateRecovery:t=!1}={})=>{if(M)return Promise.resolve(!1);let n=++ve,r=$(e?.viewProjectionMatrix,16),i=$(e?.cameraPositionM,3);if(r&&(be=[...r]),i&&(xe=[...i]),e?.nativeSurfaceAppearance!=null&&(Se=structuredClone(e.nativeSurfaceAppearance)),M||!R&&!z&&Y===0&&!I&&!L)return Promise.resolve(!1);let a,o,s=new Promise((e,t)=>{a=e,o=t});return an(),J={options:e,allowCandidateRecovery:t,requestSequence:n,resolve:a,reject:o},un(),s};return Object.freeze({async enqueue({request:t,retained:n,sphStep:r=null,receiptFields:i={},sourceTimingBootstrap:a=null}={}){if(M)return Zt({status:_t,reason:`worker-owned isosurface presenter is disposed`,...i});let o=Qt({request:t,retained:n});if(!o.ok)return Zt({status:_t,reason:o.reason,admission:o,...i});t={...t,nativeSurfaceMaterial:o.nativeSurfaceMaterial},N+=1,He(`worker-isosurface-recovery-superseded`);let s=N,c=n.sphParticleUpload?.time,u=typeof c==`number`&&Number.isFinite(c)?c:null;a=j(a);let p=a?y.pausedAt(a.sourceObservedAtMs):null,m=P,h,g=null,_=null,v=null;try{let t=Ut(e,n.sphParticleUpload);v=t?.sidecar??null,_=t?.release??null,h=Vt({device:e,retained:n}),g=Ht(h.productEventSource)}catch(e){return _?.(),g?.(),Zt({status:_t,reason:e instanceof Error?e.message:String(e),requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!1,admission:o,...i,...Xt(e),updatedAtMs:Q()})}let b;Y+=1;try{b=await S({device:e,sphParticleState:n.sphParticleState,mlsMpmParticleState:n.mlsMpmParticleState,sphParticleUpload:n.sphParticleUpload,mlsMpmParticleUpload:n.mlsMpmParticleUpload,sourceStateBuffer:n.sourceStateBuffer,sourceThermoBuffer:n.sourceThermoBuffer,sourceIdentityBuffer:n.sourceIdentityBuffer,sourceMechanicsBuffer:n.sourceMechanicsBuffer,schroederSpatialSourceFamily:n.successorSourceFamily,retainRenderRowsBuffer:!0,readbackMode:wt})}catch(e){return sn(),g?.(),_?.(),Zt({status:_t,reason:e instanceof Error?e.message:String(e),requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!1,admission:o,...i,...Xt(e),updatedAtMs:Q()})}if(sn(),(b?.dispersedMediumOptics??null)!==v)return g?.(),_?.(),Ie(b,`worker-isosurface-dispersed-medium-capture-mismatch`),Zt({status:_t,reason:`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,admission:o,...i,updatedAtMs:Q()});let x=!!(M||m!==P),C=!!(!M&&x&&N===s&&Oe===P);if(x&&!C)return g?.(),_?.(),Ie(b,`worker-isosurface-capture-invalidated-before-enqueue`),Zt({status:vt,reason:`worker-owned isosurface source capture was invalidated before enqueue`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,admission:o,...i,updatedAtMs:Q()});let w={sourceTimeS:u,sourceTimingBootstrap:a,sourceTimingPausedWallMs:p,generation:s,request:t,retained:n,admission:o,sphStep:r,receiptFields:i,productEvents:h,dispersedMediumOptics:v,ledgerParcelsBorrow:d(n.sphParticleUpload),solidRigidFamily:f(n.sphParticleUpload)??(n.sphParticleState?.rigidBodies?l(n.sphParticleUpload,n.sphParticleState.rigidBodies,e):null),releaseProductEventSourceBorrow:g,productEventSourceBorrowReleased:!1,releaseDispersedMediumSourceBorrow:_,dispersedMediumSourceBorrowReleased:!1,capturePromise:Promise.resolve(b),invalidationEpoch:C?P:m,capturedReleased:!1};return L&&rn(L,`a newer committed isosurface request replaced this queued request`),L=w,Jt(),Zt({status:ht,reason:`exact committed retained source capture submitted before continuation`,requestGeneration:s,sourceCapturedBeforePhysicsContinuation:!0,surfaceCount:o.surfaceCount,totalFieldCells:o.totalFieldCells,particleCount:o.particleCount,readbackMode:wt,...i,updatedAtMs:Q()})},setPresentationPlaying(e){if(typeof e!=`boolean`)throw TypeError(`presentation playing must be a boolean`);if(M||e===B)return!1;let t=g();return y.setPlaying(e,t),B=e,V+=1,ye.abort(),ye=new AbortController,xt(),e?R?.motionPacing&&(R.motionPacing=le(R.motionPacing,t,R.lastDisplayedMotionAgeS||0),St(R)):R&&R.lastSubmittedMotionAgeS>(R.lastDisplayedMotionAgeS||0)&&dn({reason:`worker-isosurface-pause-frozen-redraw`,playbackRevision:V}).catch(()=>{}),!0},async redraw({viewProjectionMatrix:e=null,cameraPositionM:t=null,nativeSurfaceAppearance:n=null,reason:r=`worker-owned-isosurface-camera-redraw`}={}){return dn({viewProjectionMatrix:e,cameraPositionM:t,nativeSurfaceAppearance:n,reason:r},{allowCandidateRecovery:!0})},beginPendingSourceProgress({scheduleId:e,laneId:t,stateKey:n,presentationLaneEpoch:r,sourceTimeS:i,totalStepCount:a}={}){let o=++at,s=P,c=g(),l=y.pausedAt(c);if(M||typeof e!=`string`||!e.trim()||typeof t!=`string`||!t.trim()||typeof n!=`string`||!n.trim()||!Number.isSafeInteger(r)||r<=0||typeof i!=`number`||!Number.isFinite(i)||i<0||!Number.isSafeInteger(a)||a<=1||!Number.isFinite(c)||c<0)return null;let u=null,d=0,f=c,p=!1;return m=>{if(p||M||!B||o!==at||s!==P||u&&R!==u||m?.scheduleId!==e)return!1;let h=m.stepOrdinal,_=g();if(!Number.isSafeInteger(h)||h<=d||h>a||m.completedStepCount!==h||!Number.isFinite(_)||_<f)return!1;if(d=h,f=_,h===a)return p=!0,!1;if(!u){let e=R;if(!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==s||e.sourceTimeS!==i||e.receiptFields?.laneId!==t||e.receiptFields?.stateKey!==n||e.receiptFields?.presentationLaneEpoch!==r)return!1;u=e}let v=(_-c-(y.pausedAt(_)-l))/1e3*(a-h)/h,b=ue(u.motionPacing,_,v,u.lastDisplayedMotionAgeS||0);return b===u.motionPacing?!1:(u.motionPacing=b,!0)}},hasSubmissionBoundaryOpportunity(){let e=R;return M||!B||!e?.motionField?.buffer||!e.motionPacing||e.invalidationEpoch!==P?!1:A(e.motionPacing,g())>(e.lastDisplayedMotionAgeS||0)},hasRetainedSubmissionGapOpportunity:yt,presentRetainedSubmissionGap({signal:e=null,waitForPendingSlot:t=!1}={}){if(e?.aborted||!yt({waitForPendingSlot:t}))return Promise.resolve(!1);let n=R,r=P,i=Number(m());if(!Number.isSafeInteger(i)||i<=0)return Promise.resolve(!1);let a=g()+1e3/60,o=W,s=new AbortController,c=AbortSignal.any([s.signal,ye.signal,...e?[e]:[]]),l=V,u,d=!1,f=new Promise(e=>{u=e}),p,h=new Promise(e=>{p=e}),_,v={abort:()=>s.abort(),completed:new Promise(e=>{_=e})},y=null,b=e=>{d||(d=!0,globalThis.clearTimeout(y),u(e))},x=()=>{b(!1),p(!1)};c.addEventListener(`abort`,x,{once:!0});let S=e=>{b(!1),c.removeEventListener(`abort`,x),W===v&&(W=null),G===v&&(G=null),_(e===!0&&!c.aborted)},C=()=>!c.aborted&&!M&&B&&l===V&&P===r&&R===n&&n.invalidationEpoch===r&&Number(m())===i&&g()<=a;y=globalThis.setTimeout(()=>s.abort(),1e3/60);let w=()=>{try{if(!C()||W||!mt(n)){S(!1);return}G===v&&(G=null),W=v,ct(async()=>{if(!C()||!mt(n))return!1;let e=await it(n,{reason:`worker-owned-isosurface-retained-submission-gap`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,playbackRevision:l,motionOnly:!0,signal:c,motionAgeS:A(n.motionPacing,g()),submissionDeadlineMs:a,expectedFramebufferEpoch:i,onSubmissionQueued:()=>b(!0)});return e&&Dt(n,`presentation-only retained mesh between physics submissions`,e),e}).then(e=>S(!!e),()=>S(!1))}catch{S(!1)}};return o?(G=v,Promise.race([o.completed,h]).then(e=>{e===!0?w():S(!1)},()=>S(!1))):w(),f},presentSubmissionBoundary(e,{signal:t=null}={}){if(t?.aborted||M||!B||!e||![`submissionOrdinal`,`completedSubstepCount`,`totalSubstepCount`,`chunkStepCount`].every(t=>Number.isSafeInteger(e[t])&&e[t]>0)||e.completedSubstepCount>=e.totalSubstepCount||e.chunkStepCount>e.completedSubstepCount)return Promise.resolve(!1);let n=Object.freeze({...e}),r=V,i=t?AbortSignal.any([t,ye.signal]):ye.signal;return ct(async()=>{if(i.aborted||r!==V)return!1;let e=R;if(!e?.motionField?.buffer||!e.motionPacing)return!1;let t=A(e.motionPacing,g());if(!(t>(e.lastDisplayedMotionAgeS||0)))return!1;let a=await it(e,{reason:`worker-owned-isosurface-submission-boundary`,allowLaggedGeneration:!0,requiresVisibleFrame:!0,motionAgeS:t,submissionBoundary:n,signal:i,playbackRevision:r,motionOnly:!0});return a?(Dt(e,`presentation-only retained mesh at submission boundary`,a),a):!1})},async resize({viewProjectionMatrix:e=null,cameraPositionM:t=null,reason:n=`worker-owned-isosurface-presentation-resize`}={}){if(M)return!1;K(),xt();let r=P;if(P+=1,Oe=P,z){let e=z,t=e.frame;if(t.generation===N&&t.invalidationEpoch===r){let n={...t,invalidationEpoch:P};z=Object.freeze({...e,frame:n}),ct(()=>{H?.transferFrame(t,n),t.surfaces=[],t.participatingMedium=null,t.motionField=null}).catch(()=>{z?.frame.generation===n.generation&&He(`worker-isosurface-recovery-resize-transfer-failed`)})}else He(`worker-isosurface-recovery-resize-invalidated`)}if(R&&!(Y>0||I||L||z)){let e=R;R={...e,invalidationEpoch:P,surfaces:e.surfaces},H?.transferFrame(e,R),e.surfaces=[],e.participatingMedium=null,e.motionField=null}let i=await dn({viewProjectionMatrix:e,cameraPositionM:t,reason:n},{allowCandidateRecovery:!0});return i&&St(R),i},clear({reason:t=`worker-owned-isosurface-presentation-clear`}={}){if(M)return!1;K(),xt(),P+=1,Oe=null,N+=1,He(t),be=null,xe=null,Se=null,an(),rn(L,t),L=null;let n=R;return R=null,n&&_(e,()=>{Z(n,t)}),!0},getStatus(){let e=qt(R);return Object.freeze({schema:pt,status:M?`worker-owned-isosurface-presenter-disposed`:`worker-owned-isosurface-presenter-ready`,generation:N,presentationPlaying:B,presentationPlaybackRevision:V,running:F,activeGeneration:I?.generation??null,queuedGeneration:L?.generation??null,visibleGeneration:R?.generation??null,recoverableGeneration:z?.frame.generation??null,recoverableSphStep:z?.frame.sphStep??null,visibleSphStep:R?.sphStep??null,visibleSourceTimeS:R?.sourceTimeS??null,temporalMotionReady:!!(R?.motionField?.buffer&&R?.motionPacing),temporalMotionAgeS:R?.lastDisplayedMotionAgeS||0,temporalPresentationError:R?.temporalPresentationError||null,visibleSurfaceCount:R?.totalSurfaceCount??R?.surfaces?.length??0,visibleMarchingCubesSurfaceCount:R?.surfaces?.length??0,presentationComposition:e.presentationComposition,participatingMediumStatus:e.status,collectiveOpticalSurfaceCount:e.collectiveOpticalSurfaceCount,participatingMediumAggregateDrawCount:e.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:e.collectiveOpticalShellFallbackCount,fieldRowsBufferByteLength:Ae,adapterCacheEntryCount:Pe.size})},async dispose(){if(!M){K(),xt(),M=!0,P+=1,Oe=null,N+=1,He(`worker-isosurface-recovery-dispose`),an(),on(),rn(L,`worker-owned isosurface presenter disposed`),L=null,await Promise.all([cn(),_e?.catch?.(()=>{}),q?.catch?.(()=>{}),De?.catch?.(()=>{})]),Z(R,`worker-isosurface-presenter-dispose`),R=null,await Xe(),H?.dispose(),H=null,X?.destroy?.(),X=null,Ae=0,Ee?.destroy?.(),Ee=null;try{je?.destroy?.()}catch{}je=null}}})}export{St as RETAINED_GAP_STARVATION_MS,ht as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,_t as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,bt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,yt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,gt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,pt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,vt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,mt as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,Jt as buildWorkerOwnedIsosurfaceSurfaceUniformValues,rn as createWorkerOwnedIsosurfacePresenter,Qt as resolveWorkerOwnedIsosurfaceAdmission,Vt as resolveWorkerOwnedIsosurfaceProductEventSource,Wt as snapshotWorkerOwnedSurfaceMetadata,Yt as summarizeWorkerOwnedIsosurfaceOpticalPresentation,Ct as threeViewProjectionToWebGpuClipMatrix};