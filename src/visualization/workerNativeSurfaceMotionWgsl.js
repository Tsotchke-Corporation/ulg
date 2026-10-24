import { SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL } from './nativeSurfaceMaterialWgsl.js';
import { ISOSURFACE_MOTION_WGSL } from './isosurfaceMotionWgsl.js';

export const WORKER_NATIVE_SURFACE_MOTION_UNIFORM_BYTES = 32;

const motionBindings = /* wgsl */ `
struct WorkerSurfaceMotionUniform {
  grid: vec4<u32>,
  motion: vec4<f32>,
};
@group(0) @binding(6) var<storage, read> isosurface_motion_rows: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> surface_motion: WorkerSurfaceMotionUniform;
${ISOSURFACE_MOTION_WGSL}
`;

// Only the vertex entry changes. Native optical lookup, refraction transport,
// blackbody emission, PBR lighting, tone mapping, and display encoding remain
// byte-for-byte the shared production shader, as does its 320-byte camera ABI.
const motionVertex = /* wgsl */ `@vertex
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
`;

const vertexPattern = /@vertex\nfn vs_main\(@builtin\(vertex_index\) vertex_index: u32\) -> VertexOut \{[\s\S]*?\n\}\n/;
if (!vertexPattern.test(SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL)) {
  throw new Error('shared native compact vertex entry unavailable for retained motion');
}
export const WORKER_NATIVE_SURFACE_MOTION_WGSL = motionBindings
  + SPH_RESIDENT_SURFACE_DRAW_COMPACT_POSITION_WGSL.replace(vertexPattern, motionVertex);
