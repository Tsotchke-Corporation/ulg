import{G as e,Kn as t,U as n,Y as r,ha as i,ma as a,pn as o,tn as s}from"./radiationClosure-DRvAgzCA.js";import{A as c,a as l,d as u,f as d,i as f,k as p,n as m,r as h,s as g,v as _,w as v}from"./sphMarchingCubesSurfaceAdapter-OUnbyMXZ.js";import{deferSubmittedWorkCleanup as y}from"../runtime/webgpuComputeLayout.js";import{ULG_WORKER_PRESENTATION_FRAME_QUEUE_COMPLETION_SCOPE as b,ULG_WORKER_PRESENTATION_PHYSICS_PREFIX_NOT_ATTRIBUTED as x}from"../runtime/sph/sphWorkerPresentationQos.js";var S=`peercompute.ulg.sph-participating-medium-descriptor.v0`,C=`peercompute.ulg.sph-participating-medium-gpu.v0`,w=`peercompute.ulg.sph-participating-medium-packed-frame.v0`,T=Object.freeze({ready:`participating-medium-ready`,empty:`participating-medium-empty`,blocked:`participating-medium-blocked`}),E=`participating-medium-packed-gpu-resident`,ee=`rgba16float`,D=65504,O=Object.freeze({COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256}),te=Object.freeze({TEXTURE_BINDING:globalThis.GPUTextureUsage?.TEXTURE_BINDING??4,STORAGE_BINDING:globalThis.GPUTextureUsage?.STORAGE_BINDING??8}),k=8*Uint32Array.BYTES_PER_ELEMENT,A=8*Uint32Array.BYTES_PER_ELEMENT,j=40,ne=j*Float32Array.BYTES_PER_ELEMENT,M=80,N=1e-6,P=40,F=8,re=128,ie=new WeakMap,I=new WeakMap,L=new WeakMap,R=`
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
`,ae=`
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
    let phase = relative_henyey_greenstein(
      asymmetry,
      // light_direction points from the sample toward the light; photons
      // arrive along its negative, which is the propagation direction used
      // by the physical asymmetry convention.
      dot(-light_direction, view_direction)
    );
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
`;function z(e){return typeof e==`object`&&!!e||typeof e==`function`}function B(e,t=null){let n=Number(e);return Number.isFinite(n)?n:t}function V(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function H(e,t,n){let r=V(e,n),i=V(t,n);return!!(r&&i&&r.every((e,t)=>e===i[t]))}function oe(e){return Array.isArray(e)&&e.length===i.length&&e.every((e,t)=>e===i[t])}function U(e){let t=Number(e?.descriptor?.surfaceIndex);if(Number.isSafeInteger(t)&&t>=0)return t;let n=Number(e?.metadata?.index);return Number.isSafeInteger(n)&&n>=0?n:null}function se(e){return Object.freeze(Array.isArray(e)?e.map(U).filter(e=>e!=null):[])}function ce(e){let t=e?.metadata;return!!(z(t)&&Number.isSafeInteger(Number(t.opticalStateId))&&Number(t.opticalStateId)===0)}function W(e,t=[],n={}){return Object.freeze({schema:S,ok:!1,status:T.blocked,reason:e,routeCount:0,collectiveSurfaceCount:t.length,consumedSurfaceIndices:se(t),readback:!1,fullReadback:!1,...n})}function G(){return Object.freeze({schema:S,ok:!0,status:T.empty,reason:null,routeCount:0,collectiveSurfaceCount:0,consumedSurfaceIndices:Object.freeze([]),readback:!1,fullReadback:!1})}function K(e,t){return!!(z(e)&&z(t)&&[`index`,`resolution`,`fieldOffset`,`fieldCellCount`,`opticalStateId`,`collectiveOpticalRoute`,`collectiveOpticalRouteSchema`,`collectiveOpticalRouteKey`,`collectiveOpticalRouteId`,`opticalResponseAuthorityFlag`,`opticalResponseReady`,`opticalVisibilityFlag`,`opticalBlockedFlag`].every(n=>e[n]===t[n])&&H(e.colorLinear,t.colorLinear,3)&&(e.opticalScatteringSourceLinear==null?t.opticalScatteringSourceLinear==null:H(e.opticalScatteringSourceLinear,t.opticalScatteringSourceLinear,3)))}function q(e){let t=V(e?.opticalScatteringSourceLinear,3),n=V(e?.colorLinear,3),r=t||n;return!r||r.some(e=>e<0)?null:r.map(e=>Math.min(e,1))}function le(e,n){if(!z(e))return`participating medium requires a GPUDevice`;if(!z(n)||n.schema!==`peercompute.ulg.sph-gpu-render-field.v1`)return`participating medium requires the exact ULG render-field schema`;if(n.backend!==`webgpu`)return`participating medium requires a WebGPU render field`;if(n.fieldRowsBufferRetained!==!0||!z(n.fieldRowsBuffer))return`participating medium requires a retained render-field GPU buffer`;if(!t(n.fieldRowsBuffer,e))return`participating medium rejects a cross-device render-field buffer`;if(n.rowStrideFloats!==i.length)return`participating medium requires the exact render-field cell stride`;if(!oe(n.rowLayout))return`participating medium requires the exact render-field row layout`;let r=Number(n.fieldRowsBufferByteLength),a=Number(n.fieldRowsBuffer.size),o=Number(n.totalFieldCells)*i.length*Float32Array.BYTES_PER_ELEMENT;return!Number.isSafeInteger(Number(n.totalFieldCells))||Number(n.totalFieldCells)<=0||!Number.isSafeInteger(r)||r!==o||!Number.isSafeInteger(a)||a<r?`participating medium rejects inconsistent render-field buffer bounds`:n.surfaceTable?.schema!==`peercompute.ulg.sph-gpu-render-field.v1`||!Array.isArray(n.surfaceTable.metadata)||n.surfaceTable.metadata.length!==n.surfaceTable.surfaceCount?`participating medium requires the exact render-field surface table`:null}function ue({device:e,renderField:t,volumeDescriptor:n,metadata:r,sourceMetadata:a}){if(!z(n)||n.schema!==`peercompute.ulg.sph-webgpu-marching-cubes-buffer-volume-descriptor.v0`||n.ok!==!0||n.status!==`ulg-render-field-buffer-volume-descriptor-ready`||n.device!==e||n.scalarBuffer!==t.fieldRowsBuffer||n.storageBuffer!==t.fieldRowsBuffer||n.buffer!==t.fieldRowsBuffer||n.sameDeviceStatus===`cross-device-resource`)return`participating medium rejected an unauthenticated field-volume descriptor`;let o=Number(n.surfaceIndex),s=Number(a?.resolution),c=Number(a?.fieldOffset),l=Number(a?.fieldCellCount);return!Number.isSafeInteger(o)||o<0||a!==t.surfaceTable.metadata[o]||!K(r,a)||!Number.isSafeInteger(s)||s<2||!Number.isSafeInteger(c)||c<0||l!==s**3||n.fieldOffset!==c||n.fieldCellCount!==l||n.scalarOffset!==c*i.length||n.scalarOffsetBytes!==n.scalarOffset*Float32Array.BYTES_PER_ELEMENT||n.cellRowStrideFloats!==i.length||!H(n.dims,[s,s,s],3)?`participating medium rejected inconsistent field-volume bounds`:n.positionTransform?.enabled!==!0||n.positionTransformStatus!==`ulg-render-field-grid-to-world-transform-ready`||!H(n.positionTransformOriginM,n.positionTransform.originM,3)||!(Number(n.positionTransformScaleM)>0)||n.positionTransformScaleM!==n.positionTransform.scaleM?`participating medium requires an authenticated grid-to-world transform`:t.schroederSpatialSourceFamily&&!g(n,{device:e,sourceFamily:t.schroederSpatialSourceFamily})?`participating medium rejected stale successor field lineage`:null}function J(e){let t=Number(e?.opticalStateId);return!!(Object.isFrozen(e)&&e.collectiveOpticalRoute===!0&&e.collectiveOpticalRouteSchema===`peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0`&&typeof e.collectiveOpticalRouteKey==`string`&&e.collectiveOpticalRouteKey.length>0&&Number.isSafeInteger(t)&&t>0&&Number(e.collectiveOpticalRouteId)===t&&e.opticalResponseAuthorityFlag===1&&e.opticalResponseReady===!0&&e.opticalVisibilityFlag===1&&e.opticalBlockedFlag===0&&q(e))}function de(e){return Object.freeze({surfaceIndex:e.surfaceIndex,scalarBuffer:e.scalarBuffer,fieldOffset:e.fieldOffset,fieldCellCount:e.fieldCellCount,scalarOffset:e.scalarOffset,scalarOffsetBytes:e.scalarOffsetBytes,cellRowStrideFloats:e.cellRowStrideFloats,positionTransform:e.positionTransform,positionTransformStatus:e.positionTransformStatus,positionTransformScaleM:e.positionTransformScaleM,positionTransformGridBias:e.positionTransformGridBias,positionTransformOriginM:Object.freeze([...e.positionTransformOriginM]),dims:Object.freeze([...e.dims])})}function fe(e,t){return!!(e.surfaceIndex===t.surfaceIndex&&e.scalarBuffer===t.scalarBuffer&&e.fieldOffset===t.fieldOffset&&e.fieldCellCount===t.fieldCellCount&&e.scalarOffset===t.scalarOffset&&e.scalarOffsetBytes===t.scalarOffsetBytes&&e.cellRowStrideFloats===t.cellRowStrideFloats&&e.positionTransform===t.positionTransform&&e.positionTransformStatus===t.positionTransformStatus&&e.positionTransformScaleM===t.positionTransformScaleM&&e.positionTransformGridBias===t.positionTransformGridBias&&H(e.positionTransformOriginM,t.positionTransformOriginM,3)&&H(e.dims,t.dims,3))}function pe({device:e=null,renderField:t=null,surfaceDescriptors:n=[]}={}){if(!Array.isArray(n))return W(`participating medium surfaceDescriptors must be an array`);if(n.length===0)return G();let r=n.filter(e=>!ce(e));if(r.length===0)return G();let o=le(e,t);if(o)return W(o,r);let s=[...r].sort((e,t)=>U(e)-U(t)),c=new Set,l=new Set,u=new ArrayBuffer(s.length*k),d=new Uint32Array(u),f=new Float32Array(u),p=[],m=null,h=null,g=null,_=null;for(let n=0;n<s.length;n+=1){let i=s[n],a=i?.descriptor??null,o=i?.metadata??null,u=U(i),v=Number.isSafeInteger(u)?t.surfaceTable.metadata[u]:null;if(!J(o))return W(`participating medium rejected a blocked or noncanonical collective route`,r,{blockedSurfaceIndex:u});let y=ue({device:e,renderField:t,volumeDescriptor:a,metadata:o,sourceMetadata:v});if(y)return W(y,r,{blockedSurfaceIndex:u});let b=Number(o.opticalStateId);if(c.has(b)||l.has(u))return W(`participating medium rejects duplicate route or surface identity`,r,{blockedSurfaceIndex:u});c.add(b),l.add(u);let x=Number(v.resolution),S=Number(a.positionTransformScaleM),C=Number(a.positionTransformGridBias),w=V(a.positionTransformOriginM,3);if(n===0)m=x,h=S,g=C,_=w;else if(x!==m||S!==h||C!==g||!H(w,_,3))return W(`participating medium requires one exact shared grid transform`,r,{blockedSurfaceIndex:u});let T=q(o),E=n*8;d[E]=Number(v.fieldOffset),d[E+1]=x,d[E+2]=b,d[E+3]=u,f[E+4]=T[0],f[E+5]=T[1],f[E+6]=T[2],f[E+7]=1,p.push(Object.freeze({surfaceIndex:u,opticalStateId:b,fieldOffset:Number(v.fieldOffset),resolution:x,scatteringColorLinear:Object.freeze([...T]),volumeDescriptor:a,volumeDescriptorSnapshot:de(a),metadata:o,sourceMetadata:v}))}let v=Number(e.limits?.maxTextureDimension3D);if(Number.isFinite(v)&&m>v)return W(`participating medium grid exceeds maxTextureDimension3D`,r);let y=_.map(e=>e-.5*h),b=_.map(e=>e+(m-.5)*h),x={schema:S,ok:!0,status:T.ready,reason:null,sourceRenderFieldSchema:t.schema,sourceRenderFieldBackend:t.backend,routeCount:p.length,collectiveSurfaceCount:p.length,consumedSurfaceIndices:Object.freeze(p.map(e=>e.surfaceIndex)),opticalStateIds:Object.freeze(p.map(e=>e.opticalStateId)),resolution:m,dims:Object.freeze([m,m,m]),cellEdgeM:h,fieldMinM:Object.freeze(y),fieldMaxM:Object.freeze(b),fieldRowsBuffer:t.fieldRowsBuffer,fieldRowsBufferByteLength:t.fieldRowsBufferByteLength,fieldCellRowStrideFloats:i.length,temperatureLaneIndex:a.temperatureK,scatteringOpticalDepthLaneIndex:a.scatteringOpticalDepth,absorptionOpticalDepthLaneIndex:a.absorptionOpticalDepth,scatteringAsymmetryOpticalDepthLaneIndex:a.scatteringAsymmetryOpticalDepth,aggregateTextureCount:2,textureFormat:ee,storageComponentMax:D,readback:!1,fullReadback:!1,activityMode:`gpu-indirect-not-read-back`,sourceReleaseBoundary:`after-containing-command-buffer-submit`};return ie.set(x,{active:!0,device:e,renderField:t,surfaceTable:t.surfaceTable,surfaceMetadataArray:t.surfaceTable.metadata,fieldRowsBuffer:t.fieldRowsBuffer,routeRowsBytes:new Uint8Array(u),routes:p,resolution:m,cellEdgeM:h,fieldMinM:y,fieldMaxM:b}),Object.freeze(x)}function me(e,t){if(typeof e?.[t]!=`function`)throw TypeError(`participating medium requires device.${t}()`)}function he(e,t,n,r){return typeof e[t]==`function`?Promise.resolve(e[t](r)):(me(e,n),Promise.resolve(e[n](r)))}function ge(e,{colorFormat:t=`rgba8unorm`,depthFormat:n=`depth24plus`,maxOpticalDepth:r=M,activityEpsilon:i=N}={}){for(let t of[`createBuffer`,`createTexture`,`createShaderModule`,`createBindGroup`,`createSampler`])me(e,t);if(me(e?.queue,`writeBuffer`),typeof t!=`string`||t.length===0)throw TypeError(`participating medium requires a color format`);if(typeof n!=`string`||n.length===0)throw TypeError(`participating medium requires a depth format`);let a=B(r),o=B(i);if(!(a>0)||!(o>=0))throw RangeError(`participating medium optical limits must be finite and nonnegative`);let s=Math.min(a,D),c=e.createShaderModule({label:`ulg-sph-participating-medium-pack-wgsl`,code:R}),l=e.createShaderModule({label:`ulg-sph-participating-medium-render-wgsl`,code:ae}),u=he(e,`createComputePipelineAsync`,`createComputePipeline`,{label:`ulg-sph-participating-medium-pack`,layout:`auto`,compute:{module:c,entryPoint:`pack_main`}}),d=he(e,`createRenderPipelineAsync`,`createRenderPipeline`,{label:`ulg-sph-participating-medium-render`,layout:`auto`,vertex:{module:l,entryPoint:`vertex_main`},fragment:{module:l,entryPoint:`fragment_main`,targets:[{format:t,blend:{color:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`},alpha:{operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`}},writeMask:15}]},primitive:{topology:`triangle-list`,cullMode:`none`}}),f={active:!0,device:e,colorFormat:t,depthFormat:n,maxOpticalDepth:s,activityEpsilon:o,packPipelinePromise:u,renderPipelinePromise:d,sampler:e.createSampler({label:`ulg-sph-participating-medium-linear-sampler`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`,magFilter:`linear`,minFilter:`linear`,mipmapFilter:`nearest`}),frames:new Set},p={schema:C,status:`participating-medium-gpu-ready-pending-pipelines`,colorFormat:t,depthFormat:n,textureFormat:ee,maxOpticalDepth:s,storageComponentMax:D,readback:!1,get destroyed(){return!f.active},ready:Promise.all([u,d]).then(()=>!0),destroy(){if(!f.active)return!1;f.active=!1;for(let e of[...f.frames])we(e);return f.frames.clear(),!0}};return I.set(p,f),Object.freeze(p)}function _e(e){let t=I.get(e);if(!t||!t.active)throw TypeError(`participating medium GPU runtime is missing or destroyed`);return t}function ve(e,n){let r=ie.get(e);if(!r||!r.active||e.status!==T.ready)throw TypeError(`participating medium descriptor is missing, consumed, or blocked`);if(r.device!==n.device||e.fieldRowsBuffer!==r.fieldRowsBuffer)throw TypeError(`participating medium descriptor belongs to a different GPU runtime`);let i=le(n.device,r.renderField);if(i)throw TypeError(`participating medium render-field source failed revalidation: ${i}`);if(r.renderField.fieldRowsBuffer!==r.fieldRowsBuffer||r.renderField.fieldRowsBufferRetained!==!0||r.renderField.surfaceTable!==r.surfaceTable||r.surfaceTable.metadata!==r.surfaceMetadataArray||!t(r.fieldRowsBuffer,n.device))throw TypeError(`participating medium render-field/table identity is stale or cross-device`);for(let e of r.routes){if(r.surfaceMetadataArray[e.surfaceIndex]!==e.sourceMetadata||!K(e.metadata,e.sourceMetadata)||!J(e.metadata)||!fe(e.volumeDescriptor,e.volumeDescriptorSnapshot))throw TypeError(`participating medium route authority changed after descriptor creation`);if(r.renderField.schroederSpatialSourceFamily&&!g(e.volumeDescriptor,{device:n.device,sourceFamily:r.renderField.schroederSpatialSourceFamily}))throw TypeError(`participating medium successor lineage expired before packing`)}return r}function ye(e){try{e?.destroy?.()}catch{}}function be(e,t,n,r,i){let a={active:!0,runtime:e,runtimeRecord:t,descriptor:n,descriptorRecord:r,...i},o={schema:w,ok:!0,status:E,resolution:n.resolution,dims:n.dims,routeCount:n.routeCount,collectiveSurfaceCount:n.collectiveSurfaceCount,consumedSurfaceIndices:n.consumedSurfaceIndices,opticalStateIds:n.opticalStateIds,opticalTexture:i.opticalTexture,scatteringTexture:i.scatteringTexture,drawIndirectBuffer:i.drawIndirectBuffer,drawIndirectOffsetBytes:0,drawCountMode:`gpu-indirect-not-read-back`,sourceBufferConsumptionEncoded:!0,sourceReleaseBoundary:n.sourceReleaseBoundary,readback:!1,fullReadback:!1,get destroyed(){return!a.active},destroy(){return we(o)}};return a.frame=o,L.set(o,a),t.frames.add(o),Object.freeze(o)}async function xe(e,t,n){let r=_e(e);if(!z(t)||typeof t.clearBuffer!=`function`||typeof t.beginComputePass!=`function`)throw TypeError(`participating medium pack requires a GPUCommandEncoder`);let a=ve(n,r),o=await r.packPipelinePromise;_e(e),ve(n,r);let s=a.resolution,c={size:{width:s,height:s,depthOrArrayLayers:s},dimension:`3d`,format:ee,mipLevelCount:1,sampleCount:1,usage:te.STORAGE_BINDING|te.TEXTURE_BINDING},l=[];try{let u=r.device.createTexture({...c,label:`ulg-sph-participating-medium-optical-volume`});l.push(u);let d=r.device.createTexture({...c,label:`ulg-sph-participating-medium-scattering-volume`});l.push(d);let f=u.createView({dimension:`3d`}),p=d.createView({dimension:`3d`}),m=r.device.createBuffer({label:`ulg-sph-participating-medium-route-rows`,size:a.routeRowsBytes.byteLength,usage:O.STORAGE|O.COPY_DST});l.push(m);let h=r.device.createBuffer({label:`ulg-sph-participating-medium-pack-params`,size:A,usage:O.UNIFORM|O.COPY_DST});l.push(h);let g=r.device.createBuffer({label:`ulg-sph-participating-medium-draw-indirect`,size:4*Uint32Array.BYTES_PER_ELEMENT,usage:O.STORAGE|O.INDIRECT|O.COPY_DST});l.push(g);let _=r.device.createBuffer({label:`ulg-sph-participating-medium-render-uniforms`,size:ne,usage:O.UNIFORM|O.COPY_DST});l.push(_);let v=new ArrayBuffer(A),y=new Uint32Array(v),b=new Float32Array(v);y[0]=s,y[1]=n.routeCount,y[2]=i.length/4,b[4]=r.maxOpticalDepth,b[5]=r.activityEpsilon,r.device.queue.writeBuffer(m,0,a.routeRowsBytes),r.device.queue.writeBuffer(h,0,new Uint8Array(v));let x=r.device.createBindGroup({label:`ulg-sph-participating-medium-pack-bind-group`,layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a.fieldRowsBuffer}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:h}},{binding:3,resource:f},{binding:4,resource:p},{binding:5,resource:{buffer:g}}]});t.clearBuffer(g,0,4*Uint32Array.BYTES_PER_ELEMENT);let S=t.beginComputePass({label:`ulg-sph-participating-medium-pack-pass`});S.setPipeline(o),S.setBindGroup(0,x);let C=Math.ceil(s/4);return S.dispatchWorkgroups(C,C,C),S.end(),a.active=!1,be(e,r,n,a,{opticalTexture:u,scatteringTexture:d,opticalTextureView:f,scatteringTextureView:p,routeRowsBuffer:m,packParamsBuffer:h,drawIndirectBuffer:g,renderUniformBuffer:_,packDispatch:Object.freeze([C,C,C])})}catch(e){a.active=!1;for(let e of l)ye(e);throw e}}function Se(e,{inverseViewProjectionMatrix:t,cameraPositionM:n,viewportSize:r,lightDirection:i=[.38,.82,.42],lightIntensity:a=1,ambientIntensity:o=.18,stepCount:s=P,depthEpsilon:c=1e-6}){let l=V(t,16),u=V(n,3),d=V(r,2),f=V(i,3),p=B(a),m=B(o),h=B(c);if(!l||!u||!d||d.some(e=>!(e>0))||!f||Math.hypot(...f)<=1e-12||!(p>=0)||!(m>=0)||!(h>=0))throw TypeError(`participating medium render uniforms are incomplete or non-finite`);let g=Math.max(F,Math.min(re,Math.round(B(s,P)))),_=new Float32Array(j);_.set(l,0),_.set(u,16),_[19]=g,_.set(e.descriptorRecord.fieldMinM,20),_[23]=e.descriptorRecord.cellEdgeM,_.set(e.descriptorRecord.fieldMaxM,24),_[27]=m;let v=Math.hypot(...f);return _[28]=f[0]/v,_[29]=f[1]/v,_[30]=f[2]/v,_[31]=p,_[32]=d[0],_[33]=d[1],_[34]=h,e.runtimeRecord.device.queue.writeBuffer(e.renderUniformBuffer,0,_),Object.freeze({stepCount:g,viewportSize:Object.freeze([...d]),readback:!1})}async function Ce(e,t,{packedFrame:n=null,inverseViewProjectionMatrix:r=null,cameraPositionM:i=null,viewportSize:a=null,depthTextureView:o=null,lightDirection:s=[.38,.82,.42],lightIntensity:c=1,ambientIntensity:l=.18,stepCount:u=P,depthEpsilon:d=1e-6}={}){let f=_e(e),p=L.get(n);if(!p||!p.active||p.runtime!==e||!z(t)||typeof t.setPipeline!=`function`||typeof t.setBindGroup!=`function`||typeof t.drawIndirect!=`function`||!z(o))throw TypeError(`participating medium render requires a live packed frame, pass, and depth view`);let m=await f.renderPipelinePromise;if(_e(e),!p.active)throw TypeError(`participating medium packed frame was destroyed before rendering`);let h=Se(p,{inverseViewProjectionMatrix:r,cameraPositionM:i,viewportSize:a,lightDirection:s,lightIntensity:c,ambientIntensity:l,stepCount:u,depthEpsilon:d}),g=f.device.createBindGroup({label:`ulg-sph-participating-medium-render-bind-group`,layout:m.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p.renderUniformBuffer}},{binding:1,resource:p.opticalTextureView},{binding:2,resource:p.scatteringTextureView},{binding:3,resource:f.sampler},{binding:4,resource:o}]});return t.setPipeline(m),t.setBindGroup(0,g),t.drawIndirect(p.drawIndirectBuffer,0),Object.freeze({status:`participating-medium-render-encoded`,routeCount:n.routeCount,consumedSurfaceIndices:n.consumedSurfaceIndices,drawCountMode:n.drawCountMode,readback:!1,...h})}function we(e){let t=L.get(e);if(!t||!t.active)return!1;t.active=!1,t.runtimeRecord.frames.delete(e);for(let e of[t.opticalTexture,t.scatteringTexture,t.routeRowsBuffer,t.packParamsBuffer,t.drawIndirectBuffer,t.renderUniformBuffer])ye(e);return!0}var Te=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation.v0`,Ee=`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`,De=`worker-offscreen-resident-isosurface-presentation-enqueued`,Oe=`worker-offscreen-resident-isosurface-presentation-rendered`,Y=`worker-offscreen-resident-isosurface-presentation-failed`,X=`worker-offscreen-resident-isosurface-presentation-superseded`,ke=`worker-owned-true-isosurface`,Ae=`peercompute.ulg.worker-offscreen-resident-isosurface-presentation-frame.v0`,je=`peercompute.ulg.sph-gpu-render-field.v1`,Me=`no-full-readback`,Ne=`gpu-conservative-no-readback`,Pe=`depth24plus`,Fe=`peercompute.ulg.worker-participating-medium-presentation.v0`,Ie=`not-requested`,Le=T.ready,Re=T.empty,ze=T.blocked,Be=Object.freeze([`ordered-isosurface-and-overlay`]),Ve=Object.freeze([`opaque-isosurface`,`depth-clipped-participating-medium`,`transparent-isosurface-and-overlay`]),He=4,Ue=8,We=64,Ge=128,Ke=`
struct SurfaceUniforms {
  view_projection: mat4x4<f32>,
  origin_scale: vec4<f32>,
  grid_bias_alpha: vec4<f32>,
  color_roughness: vec4<f32>,
  camera_emissive: vec4<f32>,
  optical: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: SurfaceUniforms;

struct VertexInput {
  @location(0) grid_position: vec4<f32>,
  @location(1) packed_normal: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) world_normal: vec3<f32>,
};

fn decode_snorm16(bits: u32) -> f32 {
  let raw = i32(bits & 0xffffu);
  let signed = select(raw, raw - 65536, raw >= 32768);
  return clamp(f32(signed) / 32767.0, -1.0, 1.0);
}

fn decode_octahedral_normal(packed: u32) -> vec3<f32> {
  let e = vec2<f32>(
    decode_snorm16(packed),
    decode_snorm16(packed >> 16u)
  );
  var normal = vec3<f32>(e.x, e.y, 1.0 - abs(e.x) - abs(e.y));
  if (normal.z < 0.0) {
    let prior = normal.xy;
    normal.x = (1.0 - abs(prior.y)) * select(-1.0, 1.0, prior.x >= 0.0);
    normal.y = (1.0 - abs(prior.x)) * select(-1.0, 1.0, prior.y >= 0.0);
  }
  return normalize(normal);
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
  let world_position = uniforms.origin_scale.xyz
    + (input.grid_position.xyz + uniforms.grid_bias_alpha.xyz)
      * uniforms.origin_scale.w;
  var output: VertexOutput;
  var clip = uniforms.view_projection * vec4<f32>(world_position, 1.0);
  clip.z = clip.z * 0.5 + clip.w * 0.5;
  if (clip.w <= 0.0) {
    clip = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  }
  output.clip_position = clip;
  output.world_position = world_position;
  output.world_normal = decode_octahedral_normal(input.packed_normal);
  return output;
}

fn blackbody_tint(temperature_k: f32) -> vec3<f32> {
  let heat = clamp((temperature_k - 800.0) / 2200.0, 0.0, 1.0);
  return mix(vec3<f32>(1.0, 0.22, 0.025), vec3<f32>(1.0, 0.92, 0.68), heat);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let normal = normalize(input.world_normal);
  let light_direction = normalize(vec3<f32>(0.38, 0.82, 0.42));
  let view_direction = normalize(uniforms.camera_emissive.xyz - input.world_position);
  let half_direction = normalize(light_direction + view_direction);
  let diffuse = 0.18 + 0.82 * max(dot(normal, light_direction), 0.0);
  let roughness = clamp(uniforms.color_roughness.w, 0.05, 1.0);
  let specular_power = mix(96.0, 8.0, roughness);
  let specular = pow(max(dot(normal, half_direction), 0.0), specular_power);
  let fresnel = pow(1.0 - max(dot(normal, view_direction), 0.0), 3.0);
  let transparency_class = uniforms.optical.x;
  let phase_id = uniforms.optical.y;
  let closure_optics_authoritative = uniforms.optical.w > 0.5;
  let closure_vapor_surface = closure_optics_authoritative
    && ((transparency_class > 0.5 && transparency_class < 1.5)
      || (phase_id > 2.5 && phase_id < 3.5));
  let emissive_temperature_k = uniforms.camera_emissive.w;
  let emissive_strength = clamp((emissive_temperature_k - 800.0) / 1500.0, 0.0, 2.5);
  var color = uniforms.color_roughness.rgb * diffuse;
  color += vec3<f32>(1.0) * specular * mix(0.16, 0.72, 1.0 - roughness);
  color += uniforms.color_roughness.rgb * fresnel * select(0.12, 0.42, transparency_class > 0.5);
  color += blackbody_tint(emissive_temperature_k) * emissive_strength;
  var alpha = uniforms.grid_bias_alpha.w;
  if (transparency_class > 0.5 && transparency_class < 1.5) {
    if (!closure_optics_authoritative) {
      color = mix(color, vec3<f32>(0.88, 0.92, 0.96), 0.28 + fresnel * 0.34);
      alpha *= 0.20 + 0.42 * fresnel;
    }
  } else if (transparency_class >= 1.5) {
    alpha *= 0.64 + 0.28 * fresnel;
  } else if (phase_id > 2.5 && phase_id < 3.5) {
    if (!closure_optics_authoritative) {
      alpha *= 0.34;
    }
  }
  let minimum_alpha = select(0.015, 0.0, closure_vapor_surface);
  return vec4<f32>(max(color, vec3<f32>(0.0)), clamp(alpha, minimum_alpha, 1.0));
}
`;function Z(){return globalThis.performance?.now?.()??Date.now()}function qe(e,t){return globalThis.GPUBufferUsage?.[e]??t}function Je(e){return!!(e&&typeof e==`object`&&(e.constructor?.name===`GPUBuffer`||typeof e.mapAsync==`function`||typeof e.getMappedRange==`function`))}function Ye({device:t,retained:i}={}){let a=i?.residentProductMass??null;if(!a)return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let o=a.productEventBuffer??null,s=Number(a.productEventRowCount),c=Number(a.productEventRowCapacity??a.productEventRowCount);if(!(o||a.productEventLiveCountAuthority||e(a)||Number.isFinite(s)&&s>0||Number.isFinite(c)&&c>0))return Object.freeze({productEventBuffer:null,productEventSource:null,productEventCount:0,productEventLiveCountDescriptor:null});let l=o?n(a,t):null,d=l?.expectedRowCapacity??0,f=d*u*Float32Array.BYTES_PER_ELEMENT;if(a.productEventBufferRetained!==!0||!o||!l||!r(l,{handle:a,device:t})||l.hostObserved!==!1||!Number.isSafeInteger(d)||d<=0||l.rowCapacity!==d||l.expectedRowStrideVec4!==u/4||l.rowStrideFloats!==u||!Number.isSafeInteger(s)||s!==d||!Number.isSafeInteger(c)||c!==d||!(Number(o.size)>=f))throw TypeError(`worker-owned isosurface requires an exact retained product-event buffer and authenticated GPU live-count capacity`);return Object.freeze({productEventBuffer:o,productEventSource:a,productEventCount:d,productEventLiveCountDescriptor:l})}function Xe(e){if(!e)return null;if(!Object.hasOwn(e,`__ulgActiveBorrowCount`))throw TypeError(`worker-owned isosurface requires a borrowable retained product-event source`);let t=Math.max(0,Math.floor(Number(e.__ulgActiveBorrowCount)||0));if(e.__ulgActiveBorrowCount=t+1,Number(e.__ulgActiveBorrowCount)!==t+1)throw TypeError(`worker-owned isosurface could not pin its retained product-event source`);let n=!1;return()=>n?!1:(n=!0,e.__ulgActiveBorrowCount=Math.max(0,(Number(e.__ulgActiveBorrowCount)||0)-1),!0)}function Ze(e,t){if(!s(t))return null;let n=t?.dispersedMediumOptics??null,r=Number(t?.particleCount),i=Number(n?.rowCount),a=Number(n?.rowStrideFloats),c=Number(n?.bufferByteLength),l=i*a*Float32Array.BYTES_PER_ELEMENT;if(!n||n.ownsBuffer!==!0||n.destroyed===!0||t.ownsDispersedMediumOpticsBuffer!==!0||t.dispersedMediumOpticsAuthority!==n.authority||t.dispersedMediumOpticsBuffer!==n.buffer||t.dispersedMediumOpticsRowCount!==n.rowCount||t.dispersedMediumOpticsRowStrideFloats!==n.rowStrideFloats||t.dispersedMediumOpticsBufferByteLength!==n.bufferByteLength||!Number.isSafeInteger(r)||r<=0||n.particleCount!==r||!Number.isSafeInteger(i)||i!==r||!Number.isSafeInteger(a)||a<=0||!Number.isSafeInteger(c)||c<=0||c!==l||!Number.isSafeInteger(Number(n.buffer?.size))||Number(n.buffer?.size)!==c)throw TypeError(`worker-owned isosurface rejected torn dispersed-medium particle-upload aliases`);return Object.freeze({sidecar:n,release:o(e,n)})}function Qe(e){if(!e||typeof e!=`object`)throw TypeError(`worker-owned isosurface requires object surface metadata`);let t={...e};return(Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear))&&(t.colorLinear=Object.freeze(Array.from(e.colorLinear))),(Array.isArray(e.opticalScatteringSourceLinear)||ArrayBuffer.isView(e.opticalScatteringSourceLinear))&&(t.opticalScatteringSourceLinear=Object.freeze(Array.from(e.opticalScatteringSourceLinear))),e.opticalState&&typeof e.opticalState==`object`&&(t.opticalState=Object.freeze({...e.opticalState})),Object.freeze(t)}function Q(e,t){if(!(Array.isArray(e)||ArrayBuffer.isView(e))||e.length!==t)return null;let n=Array.from(e,Number);return n.every(Number.isFinite)?n:null}function $e(e){let t=Q(e,16);if(!t)return null;let n=Array.from({length:4},(e,n)=>Array.from({length:8},(e,r)=>r<4?t[r*4+n]:+(r-4===n)));for(let e=0;e<4;e+=1){let t=e;for(let r=e+1;r<4;r+=1)Math.abs(n[r][e])>Math.abs(n[t][e])&&(t=r);let r=n[t][e];if(!Number.isFinite(r)||Math.abs(r)<=1e-12)return null;t!==e&&([n[e],n[t]]=[n[t],n[e]]);for(let t=0;t<8;t+=1)n[e][t]/=r;for(let t=0;t<4;t+=1){if(t===e)continue;let r=n[t][e];if(r!==0)for(let i=0;i<8;i+=1)n[t][i]-=r*n[e][i]}}let r=new Float32Array(16);for(let e=0;e<4;e+=1)for(let t=0;t<4;t+=1){let i=n[e][t+4];if(!Number.isFinite(i))return null;r[t*4+e]=i}return r}function et(e){if(e?.collectiveOpticalRoute===!0||e?.collectiveOpticalRouteSchema!=null||e?.collectiveOpticalRouteKey!=null||e?.collectiveOpticalRouteId!=null)return!0;if(e?.opticalStateId==null)return!1;let t=Number(e?.opticalStateId);return!Number.isSafeInteger(t)||t!==0}function tt(e){let t=e?.participatingMedium??null,n=t?.status??Ie,r=n===Le&&!!t?.packedFrame,i=Math.max(0,Number(t?.collectiveSurfaceCount)||0);return Object.freeze({schema:Fe,status:n,presentationComposition:i>0?`marching-cubes-isosurfaces-plus-participating-medium`:`marching-cubes-isosurfaces`,marchingCubesSurfaceCount:e?.surfaces?.length??0,collectiveOpticalSurfaceCount:i,participatingMediumAggregateDrawCount:+!!r,collectiveOpticalShellFallbackCount:0,participatingMediumDepthClipped:r,participatingMediumPremultipliedAlpha:r,presentationPassOrder:r?Ve:Be})}function nt(e={},t={}){let n=t.metadata||{},r=t.translation?.positionTransform||t.descriptor?.positionTransform||{},i=new Float32Array(36),a=Q(e.viewProjectionMatrix,16)||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];i.set(a,0);let o=Q(r.originM,3)||[0,0,0];i.set(o,16),i[19]=Number(r.scaleM)||1;let s=Number.isFinite(Number(r.gridBias))?Number(r.gridBias):-.5;i[20]=s,i[21]=s,i[22]=s;let c=Math.max(0,Number(n.transparencyClassId)||0),l=Math.max(0,Number(n.phaseId)||0),u=Number(n.opticalResponseAuthorityFlag)>0,d=c>.5&&c<1.5||l>2.5&&l<3.5,f=Number(n.opticalEffectiveOpacity);i[23]=u&&d?Math.min(1,Math.max(0,Number.isFinite(f)?f:0)):1;let p=Q(n.colorLinear,3)||[.72,.82,.94];i.set(p,24);let m=Number(n.opticalRoughness);return i[27]=Number.isFinite(m)?Math.min(1,Math.max(.05,m)):c>0?.12:.42,i.set(Q(e.cameraPositionM,3)||[0,0,0],28),i[31]=Math.max(0,Number(n.emissiveTemperatureK)||0),i[32]=c,i[33]=l,i[34]=Number(n.depthWriteFlag)===0?0:1,i[35]=+!!u,i}function rt(e=[]){let t=(Array.isArray(e)?e:[]).map(e=>e?.metadata??e).filter(Boolean).filter(e=>{let t=Number(e.transparencyClassId)||0,n=Number(e.phaseId)||0;return t>.5&&t<1.5||n>2.5&&n<3.5}),n=t.filter(e=>Number(e.opticalResponseAuthorityFlag)>0),r=n.filter(e=>Number(e.opticalEffectiveOpacity)>0);return Object.freeze({schema:`peercompute.ulg.worker-isosurface-optical-presentation.v0`,status:t.length===0?`no-gas-surfaces`:n.length===t.length?`all-gas-surfaces-closure-governed`:`gas-surface-optical-authority-incomplete`,gasSurfaceCount:t.length,closureGovernedGasSurfaceCount:n.length,visibleClosureGasSurfaceCount:r.length,opticallyThinHiddenGasSurfaceCount:n.length-r.length,allGasSurfacesClosureGoverned:t.length>0&&n.length===t.length,heuristicGasOpacityUsed:t.length>n.length,opticalProvenanceSources:[...new Set(n.map(e=>e.opticalProvenanceSource).filter(Boolean))].sort()})}function it(e){return{errorName:e instanceof Error?e.name:null,errorMessage:e instanceof Error?e.message:String(e),errorStack:e instanceof Error?String(e.stack||``).slice(0,2e3):null}}function $(e={}){return Object.freeze({schema:Te,presentationGeometry:ke,sameDevicePresentation:!0,gpuToCpuReadbackBytes:0,fullParticleReadbackPerformed:!1,fullParticleReadbackFree:!0,authoritativeStateMutation:!1,scientificValidation:!1,sphValidation:!1,fullPhysicsValidation:!1,...e})}function at({request:e=null,retained:t=null}={}){let n=e?.surfaceTable,r=Q(e?.viewProjectionMatrix,16),i=Q(e?.cameraPositionM,3),a=[];return e?.schema!==`peercompute.ulg.worker-offscreen-resident-isosurface-request.v0`&&a.push(`request-schema`),e?.enabled!==!0&&a.push(`request-disabled`),(n?.schema!==je||!(n?.records instanceof Float32Array)||!Array.isArray(n?.metadata)||n.metadata.length!==Number(n.surfaceCount)||n.surfaceCount<=0||n.totalFieldCells<=0)&&a.push(`surface-table`),r||a.push(`view-projection`),i||a.push(`camera-position`),Number.isFinite(Number(e?.fieldPadding))||a.push(`field-padding`),Number(e?.refEdgeM)>0||a.push(`reference-edge`),(t?.status!==`worker-retained-particle-state-ready`||t?.sameWorkerPrivateReferences!==!0||t?.postMessageTransportAllowed!==!1)&&a.push(`same-worker-retained-authority`),(!t?.sphParticleState||!t?.mlsMpmParticleState||!t?.sphParticleUpload||!t?.mlsMpmParticleUpload||!t?.successorSourceFamily)&&a.push(`retained-private-references`),(!Je(t?.sourceStateBuffer)||!Je(t?.sourceThermoBuffer)||!Je(t?.sourceMechanicsBuffer)||!Je(t?.sourceIdentityBuffer))&&a.push(`retained-gpu-buffers`),Object.freeze({ok:a.length===0,status:a.length===0?`worker-owned-isosurface-admission-ready`:`worker-owned-isosurface-admission-blocked`,reason:a.length===0?null:a.join(`,`),blockers:Object.freeze(a),surfaceCount:Math.max(0,Math.floor(Number(n?.surfaceCount)||0)),totalFieldCells:Math.max(0,Math.floor(Number(n?.totalFieldCells)||0)),particleCount:Math.max(0,Math.floor(Number(t?.particleCount)||0)),viewProjectionMatrix:r,cameraPositionM:i})}function ot(e={}){return[e.surfaceIndex??0,e.surfaceKey??``,...e.dims||[],...e.scalarStrides||[],e.scalarOffset??0,e.scalarBufferByteLength??0,e.normalSign??-1,e.scalarType??`f32`].join(`|`)}function st(e){return p({device:e.device,scalarBuffer:e.scalarBuffer,dims:e.dims,scalarStrides:e.scalarStrides,scalarOffset:e.scalarOffset,bufferByteLength:e.scalarBufferByteLength,scalarType:e.scalarType||`f32`,normalSign:e.normalSign,label:e.label||`ulg-worker-isosurface-${e.surfaceKey||e.surfaceIndex||0}`,source:e.source||`ulg-render-field-density-storage-buffer`})}function ct(e){return e?.extensionExecution||null}function lt(e,t){try{e?.translation?.destroyExtensionSurfaceBuffers?.({force:!0,releaseLeases:!0,reason:t})}catch{}try{e?.rawExecution?.result?.release?.()}catch{}try{e?.uniformBuffer?.destroy?.()}catch{}}function ut({device:e,context:t,format:n,depthFormat:r=Pe,getDepthView:i,getViewportSize:a=null,drawOverlay:o=null,onTerminal:s=null,onFrameSubmitted:u=null,waitForPresentationOpportunity:p=null,getFramebufferEpoch:g=null,nextPresentationQueueCompletionSerial:S=null,captureRenderRows:C=v,buildRenderField:w=_,buildPresentationFrame:T=null,createParticipatingMediumDescriptor:E=pe,createParticipatingMediumGpu:ee=ge,encodeParticipatingMediumPack:D=xe,encodeParticipatingMediumRender:O=Ce,destroyParticipatingMediumPackedFrame:te=we}={}){if(!e?.createBuffer||!e?.queue?.submit)throw TypeError(`worker-owned isosurface presenter requires a WebGPU device`);if(!t?.getCurrentTexture||!n)throw TypeError(`worker-owned isosurface presenter requires a configured WebGPU canvas context`);if(typeof i!=`function`)throw TypeError(`worker-owned isosurface presenter requires a depth-view provider`);if(typeof g!=`function`)throw TypeError(`worker-owned isosurface presenter requires a framebuffer-epoch provider`);let k=!1,A=0,j=0,ne=!1,M=null,N=null,P=null,F=null,re=Promise.resolve(),ie=null,I=null,L=0,R=null,ae=new Set,z=null,B=0,V=null,H=null,oe=null,U=null,se=null,ce=!1,W=0,G=new Map,K=(e,t,n={})=>{try{s?.($({status:t,requestGeneration:e.generation,sourceCapturedBeforePhysicsContinuation:!0,...e.receiptFields,...n,updatedAtMs:Z()}))}catch{}},q=(t,n)=>{if(!t)return;let r=()=>{try{t.destroyRenderRowsBuffer?.({reason:n})}catch{try{t.destroyRenderRowsBuffer?.()}catch{}}};try{y(e,r)}catch{r()}},le=e=>!e||e.productEventSourceBorrowReleased?!1:(e.productEventSourceBorrowReleased=!0,e.releaseProductEventSourceBorrow?.()===!0),ue=e=>!e||e.dispersedMediumSourceBorrowReleased?!1:(e.dispersedMediumSourceBorrowReleased=!0,e.releaseDispersedMediumSourceBorrow?.()===!0),J=(e,t)=>{if(!e)return;for(let n of e.surfaces||[])lt(n,t);let n=e.participatingMedium;if(n?.packedFrame&&n.released!==!0){n.released=!0;try{te(n.packedFrame)}catch{}}},de=()=>(se||=ee(e,{colorFormat:n,depthFormat:r}),se),fe=async e=>{if(!(!e||e.released)){e.released=!0;try{await e.wrapper?.adapter?.release?.({destroyDevice:!1})}catch{}}},me=async()=>{let e=[...G.values()];G.clear(),await Promise.all(e.map(fe))},he=async t=>z&&B>=t?z:(await me(),z?.destroy?.(),B=Math.max(4,Math.ceil(t)),z=e.createBuffer({label:`ulg-worker-owned-isosurface-render-field`,size:B,usage:qe(`STORAGE`,Ge)|qe(`COPY_SRC`,He)|qe(`COPY_DST`,Ue)}),z),_e=async t=>{let n=ot(t),r=G.get(n);if(r&&!r.released&&r.scalarBuffer===t.scalarBuffer)return r;r&&await fe(r);let i=st(t),a=l({device:e,volume:i,adapterId:`webgpu-marching-cubes.buffer-volume.v0`,adapterFactory({device:e,volume:t}){return c({device:e,volume:t,adapterId:`webgpu-marching-cubes.buffer-volume.v0`})}}),o={signature:n,scalarBuffer:t.scalarBuffer,volume:i,wrapper:a,released:!1};return G.set(n,o),o},ve=async()=>{if(!(H&&oe)){if(U)return U;U=(async()=>{if(V||=e.createShaderModule({label:`ulg-worker-owned-isosurface-shader`,code:Ke}),typeof V.getCompilationInfo==`function`){let e=((await V.getCompilationInfo())?.messages||[]).filter(e=>e?.type===`error`);if(e.length>0)throw Error(e.map(e=>e.message).join(`; `))}let t={layout:`auto`,vertex:{module:V,entryPoint:`vertex_main`,buffers:[{arrayStride:16,stepMode:`vertex`,attributes:[{shaderLocation:0,offset:0,format:`float32x4`}]},{arrayStride:4,stepMode:`vertex`,attributes:[{shaderLocation:1,offset:0,format:`uint32`}]}]},primitive:{topology:`triangle-list`,cullMode:`none`},multisample:{count:1}},i=typeof e.createRenderPipelineAsync==`function`?t=>e.createRenderPipelineAsync(t):t=>Promise.resolve(e.createRenderPipeline(t));[H,oe]=await Promise.all([i({label:`ulg-worker-owned-isosurface-opaque`,...t,fragment:{module:V,entryPoint:`fragment_main`,targets:[{format:n}]},depthStencil:{format:r,depthWriteEnabled:!0,depthCompare:`less-equal`}}),i({label:`ulg-worker-owned-isosurface-transparent`,...t,fragment:{module:V,entryPoint:`fragment_main`,targets:[{format:n,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},depthStencil:{format:r,depthWriteEnabled:!1,depthCompare:`less-equal`}})])})();try{await U}finally{U=null}}},ye=nt,be=e=>[...e.surfaces||[]].sort((e,t)=>(Number(e.metadata?.transparencyClassId)>0)-+(Number(t.metadata?.transparencyClassId)>0)||Number(e.metadata?.renderOrder||0)-Number(t.metadata?.renderOrder||0)),Se=(t,n,r)=>{let i=r.translation?.surfaceVertices,a=r.translation?.surfaceDraw;if(!i?.compactPositionRowsBuffer||!i?.compactNormalRowsBuffer||!a?.drawIndirectRowsBuffer)return!1;let o=Number(r.metadata?.transparencyClassId)>0?oe:H;return e.queue.writeBuffer(r.uniformBuffer,0,ye(n,r)),r.bindGroups.has(o)||r.bindGroups.set(o,e.createBindGroup({label:`ulg-worker-owned-isosurface-bind-group-${r.descriptor.surfaceIndex}`,layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:r.uniformBuffer}}]})),t.setPipeline(o),t.setBindGroup(0,r.bindGroups.get(o)),t.setVertexBuffer(0,i.compactPositionRowsBuffer),t.setVertexBuffer(1,i.compactNormalRowsBuffer),t.drawIndirect(a.drawIndirectRowsBuffer,0),!0},Ee=async(n,{viewProjectionMatrix:r=n.viewProjectionMatrix,cameraPositionM:s=n.cameraPositionM,reason:c=`worker-owned-isosurface-frame`,allowLaggedGeneration:l=!1}={})=>{let d=()=>!k&&n?.invalidationEpoch===j&&(A===n.generation||l===!0);if(!d())return!1;let f=Q(r,16),m=Q(s,3);f&&(n.viewProjectionMatrix=f),m&&(n.cameraPositionM=m);let h=n.participatingMedium?.status===Le?n.participatingMedium.packedFrame:null,_=h?de():null;if(await Promise.all([ve(),_?.ready]),!d())return!1;let v=!ce&&typeof e.pushErrorScope==`function`&&typeof e.popErrorScope==`function`,y=!1,C=async()=>y?(y=!1,e.popErrorScope()):null,w,T;v&&(e.pushErrorScope(`validation`),y=!0);try{let r=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-presentation`}),s=t.getCurrentTexture(),c=s.createView(),l=i(),u=be(n);if(h){let e=$e(n.viewProjectionMatrix);if(!e)throw Error(`participating-medium presentation requires an invertible view-projection matrix`);let t=Q(typeof a==`function`?a():[s.width,s.height],2);if(!t||!(t[0]>0)||!(t[1]>0))throw Error(`participating-medium presentation requires a positive viewport size`);let i=r.beginRenderPass({label:`ulg-worker-owned-isosurface-opaque-pass`,colorAttachments:[{view:c,clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:l,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});try{for(let e of u)Number(e.metadata?.transparencyClassId)>0||Se(i,n,e)}finally{i.end()}let d=r.beginRenderPass({label:`ulg-worker-owned-participating-medium-pass`,colorAttachments:[{view:c,loadOp:`load`,storeOp:`store`}]});try{await O(_,d,{packedFrame:h,inverseViewProjectionMatrix:e,cameraPositionM:n.cameraPositionM,viewportSize:t,depthTextureView:l,lightDirection:[.38,.82,.42]})}finally{d.end()}let f=r.beginRenderPass({label:`ulg-worker-owned-isosurface-transparent-overlay-pass`,colorAttachments:[{view:c,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:l,depthLoadOp:`load`,depthStoreOp:`discard`}});try{for(let e of u)Number(e.metadata?.transparencyClassId)>0&&Se(f,n,e);o?.(f,n.viewProjectionMatrix,n.boxDimsM)}finally{f.end()}}else{let e=r.beginRenderPass({colorAttachments:[{view:c,clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:l,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});try{for(let t of u)Se(e,n,t);o?.(e,n.viewProjectionMatrix,n.boxDimsM)}finally{e.end()}}if(!d())return await C(),!1;if(w=Number(g()),!Number.isSafeInteger(w)||w<=0)throw Error(`worker-owned isosurface framebuffer epoch is unavailable`);T=Z(),e.queue.submit([r.finish()]);let f=await C();if(f)throw Error(f.message||String(f));v&&(ce=!0)}catch(e){try{await C()}catch{}throw e}if(!d()||Number(g())!==w)return!1;if(typeof e.queue?.onSubmittedWorkDone!=`function`)throw Error(`worker-owned isosurface presentation queue completion is unavailable`);let E=typeof S==`function`?Number(S()):W+1;if(!Number.isSafeInteger(E)||E<=W)throw Error(`worker-owned isosurface presentation queue completion serial did not advance`);if(W=E,await e.queue.onSubmittedWorkDone(),!d()||Number(g())!==w)return!1;let ee=Z();if(typeof p!=`function`)throw Error(`worker-owned isosurface presentation opportunity observer is unavailable`);let D=await p();if(D?.available!==!0)throw Error(`worker-owned isosurface lacked a post-GPU presentation opportunity`);if(!d()||Number(g())!==w)return!1;let te=Number.isFinite(Number(D.observedAtMs))?Number(D.observedAtMs):Z(),ne=rt(n.opticalMetadataSnapshots||n.surfaces),M=tt(n),N=Object.freeze({presentationFrameSchema:Ae,presentationFrameStatus:`worker-owned-isosurface-presentation-opportunity`,presentationFrameAdmitted:!0,presentationFrameGpuCompleted:!0,presentationFrameGpuCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationFramePresentationOpportunity:!0,presentationFramePresentationOpportunityMethod:D.method??null,presentationFrameSubmitToGpuCompleteMs:Math.max(0,ee-T),presentationFrameSubmitToPresentationOpportunityMs:Math.max(0,te-T),presentationQueueCompletionCount:W,presentationQueueCompletionSerial:E,presentationQueueCompletionMethod:`worker-device.queue.onSubmittedWorkDone`,presentationQueueCompletionScope:b,physicsQueuePrefixCoverage:x,physicsHostQueueFenceParticipation:null,workerFramebufferEpoch:w,workerOwnedOpticalPresentation:ne,workerOwnedParticipatingMediumPresentation:M,presentationComposition:M.presentationComposition,marchingCubesSurfaceCount:M.marchingCubesSurfaceCount,collectiveOpticalSurfaceCount:M.collectiveOpticalSurfaceCount,participatingMediumStatus:M.status,participatingMediumAggregateDrawCount:M.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:M.collectiveOpticalShellFallbackCount,participatingMediumDepthClipped:M.participatingMediumDepthClipped,participatingMediumPremultipliedAlpha:M.participatingMediumPremultipliedAlpha,presentationPassOrder:M.presentationPassOrder});try{u?.({reason:c,generation:n.generation,surfaceCount:n.totalSurfaceCount??n.surfaces.length,sphStep:n.sphStep,...N})}catch{}return N},ke=(e,t)=>{let n=re.then(()=>Ee(e,t));return re=n.catch(()=>{}),n},je=(e,t,n)=>{let i=tt(e),a=e.surfaces.length+i.participatingMediumAggregateDrawCount;K({generation:e.generation,receiptFields:e.receiptFields},Oe,{reason:t,surfaceCount:e.totalSurfaceCount??e.surfaces.length,submittedSurfaceCount:a,activeSurfaceCount:null,indirectDrawCount:a,depthAttachmentFormat:r,depthAttachmentReady:!0,boxWireframeDrawCount:+!!e.boxDimsM,boxDimsM:e.boxDimsM?[...e.boxDimsM]:null,nonemptySurfaceCountMode:`gpu-indirect-not-read-back`,triangleCountMode:`gpu-indirect-not-read-back`,readbackMode:Me,...n})},Fe=async(t,n)=>{if((n?.dispersedMediumOptics??null)!==t.dispersedMediumOptics)throw TypeError(`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`);let r=await he(t.request.surfaceTable.totalFieldCells*d*Float32Array.BYTES_PER_ELEMENT),i=t.productEvents,a=await w({device:e,renderRows:n.renderRows,renderRowsBuffer:n.renderRowsBuffer,renderRowsSource:n,dispersedMediumOptics:t.dispersedMediumOptics,schroederSpatialSourceFamily:n.schroederSpatialSourceFamily,surfaceTable:t.request.surfaceTable,particleCount:n.particleCount,productEventBuffer:i.productEventBuffer,productEventSource:i.productEventSource,productEventCount:i.productEventCount,productEventLiveCountDescriptor:i.productEventLiveCountDescriptor,fieldPadding:Number(t.request.fieldPadding),refEdgeM:Number(t.request.refEdgeM),renderSmearDtS:Math.max(0,Number(t.request.renderSmearDtS)||0),readbackMode:Me,retainFieldRowsBuffer:!0,retainSurfaceBuffer:!1,waitForQueueCompletion:!1,deferCleanup:!0,targetFieldRowsBuffer:r,targetFieldRowsBufferByteLength:B});le(t),ue(t),q(n,`worker-isosurface-render-field-submitted`),t.capturedReleased=!0;let o=a.surfaceTable.metadata.map(Qe),s=o.map((t,n)=>f({device:e,renderField:a,surface:a.surfaceTable.metadata[n],surfaceIndex:n})),c=s.find(e=>e?.ok!==!0);if(c)throw a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-descriptor-blocked`}),Error(c.reason||c.status);let l,u,p=null,g=new Set,_;try{if(l=Object.freeze(s.map((e,t)=>Object.freeze({descriptor:e,metadata:o[t]}))),u=o.map((e,t)=>et(e)?t:-1).filter(e=>e>=0),u.length>0){p=E({device:e,renderField:a,surfaceDescriptors:u.map(e=>l[e])});let t=p?.status;if(![Le,Re,ze].includes(t))throw TypeError(`participating-medium descriptor returned an unknown route status`);let n=p.consumedSurfaceIndices;if(!Array.isArray(n))throw TypeError(`participating-medium descriptor omitted consumed surface indices`);g=new Set(n);let r=new Set(u);if(!(g.size===r.size&&[...g].every(e=>Number.isSafeInteger(e)&&r.has(e))))throw TypeError(`participating-medium descriptor did not consume the exact collective optical route set`)}_=s.filter((e,t)=>!g.has(t))}catch(e){throw a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-participating-medium-descriptor-failed`}),e}let v=e.createCommandEncoder({label:`ulg-worker-owned-isosurface-marching-cubes`}),y=[],b=[],x=null;try{for(let n of _){let r=await _e(n);m({device:e,descriptor:n,volume:r.volume});let i=await r.wrapper.extractSurface({volume:r.volume,isovalue:n.isovalue,ownsBuffer:!0,readbackMode:Ne,vertexRowsBudget:Math.max(3,Math.floor(Number(t.request.vertexRowsBudget)||3)),commandEncoder:v}),a=ct(i);if(a?.ok===!1||!a?.result)throw Error(i?.reason||a?.status||`worker-owned marching-cubes extraction failed`);y.push({descriptor:n,wrapped:i,rawExecution:a})}if(p?.status===Le&&(x=await D(de(),v,p),x?.status!==`participating-medium-packed-gpu-resident`||x.readback!==!1))throw TypeError(`participating-medium pack did not return an exact GPU-resident no-readback frame`);e.queue.submit([v.finish()]);for(let e of y)e.rawExecution.result?.retireTemporaryResourcesAfterSubmit?.();let n=[];for(let t of y){let r=t.descriptor,i=o[r.surfaceIndex],s=await h({device:e,extensionExecution:t.rawExecution,schroederSpatialSourceFamily:a.schroederSpatialSourceFamily,surfaceIndex:r.surfaceIndex,materialId:i.materialId,phaseId:i.phaseId,opticalStateId:i.opticalStateId,material:i.material,phase:i.phase,renderKey:i.renderKey,surfaceKey:i.surfaceKey,isolation:r.isovalue,transparencyClassId:i.transparencyClassId,depthWriteFlag:i.depthWriteFlag,renderOrder:i.renderOrder,positionTransform:r.positionTransform,positionTransformResolution:i.resolution,sourceVoxelLinearIndex:r.fieldOffset,fieldPadding:a.fieldPadding,refEdgeM:a.refEdgeM,positionGridBias:r.positionTransformGridBias,fieldGradient:{buffer:r.scalarBuffer,scalarOffsetFloats:r.scalarOffset,rowStrideFloats:r.cellRowStrideFloats,resolution:i.resolution},readbackMode:Me,compactSummaryReadback:!1,translateVertexRows:!1,allowExtensionDrawIndirectBuffer:!0,retainVertexRowsBuffer:!0,retainDrawRowsBuffer:!0,retainDrawIndirectRowsBuffer:!0,waitForQueueCompletion:!1}),c=e.createBuffer({label:`ulg-worker-owned-isosurface-uniform-${r.surfaceIndex}`,size:36*Float32Array.BYTES_PER_ELEMENT,usage:qe(`UNIFORM`,We)|qe(`COPY_DST`,Ue)});n.push({descriptor:r,metadata:i,translation:s,rawExecution:t.rawExecution,uniformBuffer:c,bindGroups:new Map}),b.push(n[n.length-1])}return a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-submitted`}),{generation:t.generation,invalidationEpoch:t.invalidationEpoch,sphStep:t.sphStep,request:t.request,receiptFields:t.receiptFields,viewProjectionMatrix:[...t.admission.viewProjectionMatrix],cameraPositionM:[...t.admission.cameraPositionM],boxDimsM:Q(t.request.boxDimsM,3),totalSurfaceCount:o.length,opticalMetadataSnapshots:o,participatingMedium:p?{status:p.status,reason:p.reason??null,collectiveSurfaceCount:u.length,consumedSurfaceCount:g.size,packedFrame:x,released:!1}:null,surfaces:n}}catch(e){a.destroyRenderFieldBuffers?.({force:!0,releaseLeases:!0,reason:`worker-isosurface-extraction-failed`});for(let e of b)lt(e,`worker-isosurface-partial-translation-failed`);let t=new Set(b.map(e=>e.rawExecution));for(let e of y)if(!t.has(e.rawExecution))try{e.rawExecution?.result?.release?.()}catch{}if(x)try{te(x)}catch{}throw e}},Ie=async()=>{if(!(ne||k)){ne=!0;try{for(;P&&!k;){let t=P;P=null,N=t;let n=null,r=null;try{if(n=await t.capturePromise,t.invalidationEpoch!==j||k){K(t,X,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(r=await(T??Fe)(t,n),t.invalidationEpoch!==j||k)if(!k&&t.invalidationEpoch!==j&&A===t.generation&&R===j)t.invalidationEpoch=j,r.invalidationEpoch=j;else{J(r,`worker-isosurface-superseded-before-presentation`),r=null,K(t,X,{reason:`the worker-owned isosurface presentation was invalidated`});continue}if(F&&F.generation>=r.generation){J(r,`worker-isosurface-older-than-visible-frame`),r=null,K(t,X,{reason:`a newer isosurface generation is already visible`});continue}let i=await ke(r,{reason:`committed-worker-isosurface`,allowLaggedGeneration:!0});for(;!i?.presentationFrameAdmitted&&r.invalidationEpoch!==j&&A===t.generation&&R===j&&j>r.invalidationEpoch&&!k;){let e=j;t.invalidationEpoch=e,r.invalidationEpoch=e,i=await ke(r,{reason:`committed-worker-isosurface-after-resize`,allowLaggedGeneration:!0})}if(!i?.presentationFrameAdmitted){if(r.invalidationEpoch!==j||k){J(r,`worker-isosurface-invalidated-during-presentation`),r=null,K(t,X,{reason:`the worker-owned isosurface presentation was invalidated during submit`});continue}throw Error(`worker-owned isosurface frame was not current at submit`)}let a=F;F=r,r=null,a&&y(e,()=>{J(a,`worker-isosurface-replaced`)}),je(F,`same-device retained state rendered as true isosurface`,i)}catch(e){r&&J(r,`worker-isosurface-build-failed`),K(t,Y,{reason:e instanceof Error?e.message:String(e),...it(e)})}finally{n&&!t.capturedReleased&&q(n,`worker-isosurface-capture-retired`),le(t),ue(t),N=null}}}finally{ne=!1}}},Be=()=>{if(M||k)return;let e=Ie();M=e,e.finally(()=>{M===e&&(M=null),P&&!k&&Be()})},Ve=(e,t)=>{e&&(le(e),ue(e),e.capturePromise.then(e=>{q(e,`worker-isosurface-queued-job-superseded`)}).catch(()=>{}),K(e,X,{reason:t}))},Je=()=>{I&&=(I.resolve(!1),null)},ut=()=>{for(let e of ae)e();ae.clear()},dt=()=>{L=Math.max(0,L-1),L===0&&ut()},ft=()=>L===0?Promise.resolve():new Promise(e=>ae.add(e)),pt=async()=>{for(;I&&!k;){if(L>0){await ft();continue}if(N||P){let e=M;e?await e.catch(()=>{}):await Promise.resolve();continue}let e=I;I=null;let t=F;if(!t||t.generation!==A){e.resolve(!1);continue}try{let n=await ke(t,{...e.options,allowLaggedGeneration:!1}),r=!!(n&&F===t&&t.invalidationEpoch===j&&t.generation===A&&!k);r&&je(t,e.options.reason,n),e.resolve(r)}catch(t){e.reject(t)}}},mt=()=>{if(ie||k||!I)return;let e=pt();ie=e,e.finally(()=>{ie===e&&(ie=null),mt()})},ht=e=>{if(k||!F&&L===0&&!N&&!P)return Promise.resolve(!1);let t,n,r=new Promise((e,r)=>{t=e,n=r});return Je(),I={options:e,resolve:t,reject:n},mt(),r};return Object.freeze({async enqueue({request:t,retained:n,sphStep:r=null,receiptFields:i={}}={}){if(k)return $({status:Y,reason:`worker-owned isosurface presenter is disposed`,...i});let a=at({request:t,retained:n});if(!a.ok)return $({status:Y,reason:a.reason,admission:a,...i});A+=1;let o=A,s=j,c,l=null,u=null,d=null;try{let t=Ze(e,n.sphParticleUpload);d=t?.sidecar??null,u=t?.release??null,c=Ye({device:e,retained:n}),l=Xe(c.productEventSource)}catch(e){return u?.(),l?.(),$({status:Y,reason:e instanceof Error?e.message:String(e),requestGeneration:o,sourceCapturedBeforePhysicsContinuation:!1,admission:a,...i,...it(e),updatedAtMs:Z()})}let f;L+=1;try{f=await C({device:e,sphParticleState:n.sphParticleState,mlsMpmParticleState:n.mlsMpmParticleState,sphParticleUpload:n.sphParticleUpload,mlsMpmParticleUpload:n.mlsMpmParticleUpload,sourceStateBuffer:n.sourceStateBuffer,sourceThermoBuffer:n.sourceThermoBuffer,sourceIdentityBuffer:n.sourceIdentityBuffer,sourceMechanicsBuffer:n.sourceMechanicsBuffer,schroederSpatialSourceFamily:n.successorSourceFamily,retainRenderRowsBuffer:!0,readbackMode:Me})}catch(e){return dt(),l?.(),u?.(),$({status:Y,reason:e instanceof Error?e.message:String(e),requestGeneration:o,sourceCapturedBeforePhysicsContinuation:!1,admission:a,...i,...it(e),updatedAtMs:Z()})}if(dt(),(f?.dispersedMediumOptics??null)!==d)return l?.(),u?.(),q(f,`worker-isosurface-dispersed-medium-capture-mismatch`),$({status:Y,reason:`worker-owned isosurface capture did not retain its exact dispersed-medium sidecar`,requestGeneration:o,sourceCapturedBeforePhysicsContinuation:!0,admission:a,...i,updatedAtMs:Z()});let p=!!(k||s!==j),m=!!(!k&&p&&A===o&&R===j);if(p&&!m)return l?.(),u?.(),q(f,`worker-isosurface-capture-invalidated-before-enqueue`),$({status:X,reason:`worker-owned isosurface source capture was invalidated before enqueue`,requestGeneration:o,sourceCapturedBeforePhysicsContinuation:!0,admission:a,...i,updatedAtMs:Z()});let h={generation:o,request:t,retained:n,admission:a,sphStep:r,receiptFields:i,productEvents:c,dispersedMediumOptics:d,releaseProductEventSourceBorrow:l,productEventSourceBorrowReleased:!1,releaseDispersedMediumSourceBorrow:u,dispersedMediumSourceBorrowReleased:!1,capturePromise:Promise.resolve(f),invalidationEpoch:m?j:s,capturedReleased:!1};return P&&Ve(P,`a newer committed isosurface request replaced this queued request`),P=h,Be(),$({status:De,reason:`exact committed retained source capture submitted before continuation`,requestGeneration:o,sourceCapturedBeforePhysicsContinuation:!0,surfaceCount:a.surfaceCount,totalFieldCells:a.totalFieldCells,particleCount:a.particleCount,readbackMode:Me,...i,updatedAtMs:Z()})},async redraw({viewProjectionMatrix:e=null,cameraPositionM:t=null,reason:n=`worker-owned-isosurface-camera-redraw`}={}){return ht({viewProjectionMatrix:e,cameraPositionM:t,reason:n})},async resize({viewProjectionMatrix:e=null,cameraPositionM:t=null,reason:n=`worker-owned-isosurface-presentation-resize`}={}){if(k)return!1;if(j+=1,R=j,F&&!(L>0||N||P)){let e=F;F={...e,invalidationEpoch:j,surfaces:e.surfaces},e.surfaces=[],e.participatingMedium=null}return ht({viewProjectionMatrix:e,cameraPositionM:t,reason:n})},clear({reason:t=`worker-owned-isosurface-presentation-clear`}={}){if(k)return!1;j+=1,R=null,A+=1,Je(),Ve(P,t),P=null;let n=F;return F=null,n&&y(e,()=>{J(n,t)}),!0},getStatus(){let e=tt(F);return Object.freeze({schema:Te,status:k?`worker-owned-isosurface-presenter-disposed`:`worker-owned-isosurface-presenter-ready`,generation:A,running:ne,activeGeneration:N?.generation??null,queuedGeneration:P?.generation??null,visibleGeneration:F?.generation??null,visibleSphStep:F?.sphStep??null,visibleSurfaceCount:F?.totalSurfaceCount??F?.surfaces?.length??0,visibleMarchingCubesSurfaceCount:F?.surfaces?.length??0,presentationComposition:e.presentationComposition,participatingMediumStatus:e.status,collectiveOpticalSurfaceCount:e.collectiveOpticalSurfaceCount,participatingMediumAggregateDrawCount:e.participatingMediumAggregateDrawCount,collectiveOpticalShellFallbackCount:e.collectiveOpticalShellFallbackCount,fieldRowsBufferByteLength:B,adapterCacheEntryCount:G.size})},async dispose(){if(!k){k=!0,j+=1,R=null,A+=1,Je(),ut(),Ve(P,`worker-owned isosurface presenter disposed`),P=null,await Promise.all([ft(),M?.catch?.(()=>{}),ie?.catch?.(()=>{}),re?.catch?.(()=>{})]),J(F,`worker-isosurface-presenter-dispose`),F=null,await me(),z?.destroy?.(),z=null,B=0;try{se?.destroy?.()}catch{}se=null,H=null,oe=null,U=null,V=null}}})}export{De as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_ENQUEUED_STATUS,Y as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FAILED_STATUS,Ae as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_FRAME_SCHEMA,ke as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_GEOMETRY,Oe as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_RENDERED_STATUS,Te as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SCHEMA,X as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_PRESENTATION_SUPERSEDED_STATUS,Ee as ULG_WORKER_OFFSCREEN_RESIDENT_ISOSURFACE_REQUEST_SCHEMA,nt as buildWorkerOwnedIsosurfaceSurfaceUniformValues,ut as createWorkerOwnedIsosurfacePresenter,at as resolveWorkerOwnedIsosurfaceAdmission,Ye as resolveWorkerOwnedIsosurfaceProductEventSource,Qe as snapshotWorkerOwnedSurfaceMetadata,rt as summarizeWorkerOwnedIsosurfaceOpticalPresentation};