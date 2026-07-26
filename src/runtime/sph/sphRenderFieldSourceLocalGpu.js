import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  addResidentBufferLease,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  summarizeResidentBufferLeaseLedger
} from '../residentBufferLease.js';
import {
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  buildSphRenderFieldWebGpu
} from './sphRenderGpuKernel.js';

/**
 * A deliberately non-production source-local render-field builder.
 *
 * The renderer continues to call buildSphRenderFieldWebGpu.  This module is a
 * full-readback parity probe for a future source-local strategy: it inverts
 * the dense (field cell × particle) walk into bounded (particle × nearby
 * field cells) splats, then exposes its field as the normal v1 render-field
 * shape.  Unsupported inputs route to the exact dense GPU builder *before*
 * any target buffer is written.
 *
 * Keeping this shadow-only is intentional.  Integer atomic accumulation is
 * not a license to silently change visible PBR or phase geometry; real-GPU
 * parity and an in-order no-readback fallback are required before a caller is
 * allowed to select this strategy for presentation.
 */

export const SPH_RENDER_FIELD_SOURCE_LOCAL_SCHEMA =
  'peercompute.ulg.sph-render-field-source-local.v0';
export const SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_SHADOW = 'shadow';
export const SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DIAGNOSTIC_NO_READBACK =
  'diagnostic-no-readback';
export const SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DISABLED = 'disabled';

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const SOURCE_LOCAL_KERNEL_SCOPE = 'sph-render-field-source-local-shadow-splat';
// Accumulator lanes per field cell. 0 density, 1-3 palette RGB, 4-5
// temperature-weighted and weight, 6-11 velocity moments split into positive
// and negative halves per axis (the accumulator is unsigned), 12 weighted
// speed-squared. Must match ACCUM_LANES in both shader strings.
export const SOURCE_LOCAL_ACCUM_LANES = 13;

// Splat phases. See the splat_phase comment in SourceLocalParams.
export const SPLAT_PHASE_SINGLE = 0;
export const SPLAT_PHASE_MOMENTS_ONLY = 1;
export const SPLAT_PHASE_SMEARED_PRIMARY = 2;

// splat_phase is the last u32 of the 48-byte params block. Rewriting only that
// word between passes avoids rebuilding the whole uniform for a phase change.
const SPLAT_PHASE_BYTE_OFFSET = 44;

function writeSplatPhase(device, paramsBuffer, phase) {
  const word = new Uint32Array([phase >>> 0]);
  device.queue.writeBuffer(paramsBuffer, SPLAT_PHASE_BYTE_OFFSET, word);
}
const SOURCE_LOCAL_VELOCITY_SCALE = 4_096;
const SOURCE_LOCAL_DENSITY_SCALE = 16_384;
const SOURCE_LOCAL_PALETTE_SCALE = 16_384;
// Temperature is a ratio of two atomically accumulated quantities.  A coarse
// scale creates a visible emission drift even when density/palette agree, so
// retain sub-kelvin resolution and let the overflow flag fail the shadow
// closed on pathological high-energy accumulation.
const SOURCE_LOCAL_TEMPERATURE_SCALE = 1_024;
const DEFAULT_MAX_SPLAT_CELLS_PER_SOURCE = 4_913;

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const sphRenderFieldSourceLocalSplatWgsl = `
struct SourceLocalParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  max_splat_cells_per_source: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  palette_scale: f32,
  temperature_scale: f32,
  // Splash-shard smear interval. Zero disables the velocity-moment lanes
  // entirely, so a scene without smear pays no extra atomics.
  render_smear_dt_s: f32,
  velocity_scale: f32,
  // 0 = single pass, everything (smear disabled).
  // 1 = velocity moments only, uncorrected distances.
  // 2 = density/palette/temperature only, corrected by each cell's smear.
  splat_phase: u32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> accum: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> overflow_state: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: SourceLocalParams;
// Phase 2 reads the smear offset the resolve pass published per cell. Bound in
// every phase so one bind-group layout serves all of them.
@group(0) @binding(5) var<storage, read> published_field: array<vec4<f32>>;

const RENDER_ROW_VEC4_STRIDE: u32 = 5u;
const MAX_U32_SAFE: u32 = 4294967040u;
const ACCUM_LANES: u32 = 13u;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 1u];
}

fn render_row2(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 2u];
}

fn render_row3(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 3u];
}

fn render_row4(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * RENDER_ROW_VEC4_STRIDE + 4u];
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn surface_row2(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 2u];
}

fn surface_row3(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 3u];
}

fn render_phase_weight(surface_phase_id: f32, row_phase_id: f32, gas_fraction: f32, solid_fraction: f32) -> f32 {
  let gas = clamp(gas_fraction, 0.0, 1.0);
  let solid = clamp(solid_fraction, 0.0, 1.0);
  let liquid = clamp(1.0 - gas - solid, 0.0, 1.0);
  if (surface_phase_id == 1.0) { return solid; }
  if (surface_phase_id == 2.0) { return liquid; }
  if (surface_phase_id == 3.0) { return gas; }
  return select(0.0, 1.0, row_phase_id == surface_phase_id);
}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn phase_partitioned_metaball_strength(
  full_strength: f32,
  phase_weight: f32,
  isolation: f32,
  subtract: f32
) -> f32 {
  let fraction = clamp(phase_weight, 0.0, 1.0);
  let volume_scale_squared = pow(fraction * fraction, 0.3333333333333333);
  let zero_radius_strength = max(isolation + subtract, 0.0) * 0.000001;
  return full_strength * volume_scale_squared
    + zero_radius_strength * (1.0 - volume_scale_squared);
}

fn metaball_support_norm(strength: f32, subtract: f32) -> f32 {
  return sqrt(max(strength / max(subtract, 1.0e-12) - 0.000001, 0.0));
}

fn field_index_3d(x: u32, y: u32, z: u32, resolution: u32) -> u32 {
  return z * resolution * resolution + y * resolution + x;
}

fn accum_index(field_cell_index: u32, lane: u32) -> u32 {
  return field_cell_index * ACCUM_LANES + lane;
}

fn quantize(value: f32, scale: f32) -> u32 {
  return u32(clamp(value * scale, 0.0, f32(MAX_U32_SAFE)));
}

fn saturating_add(
  destination: ptr<storage, atomic<u32>, read_write>,
  overflow: ptr<storage, atomic<u32>, read_write>,
  value: u32
) {
  var observed = atomicLoad(destination);
  loop {
    if (observed > MAX_U32_SAFE - value) {
      atomicStore(overflow, 1u);
      return;
    }
    let replacement = observed + value;
    let exchange = atomicCompareExchangeWeak(destination, observed, replacement);
    if (exchange.exchanged) {
      return;
    }
    observed = exchange.old_value;
  }
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  let surface_index = global_id.y;
  if (particle_index >= params.particle_count || surface_index >= params.surface_count) {
    return;
  }

  let row0 = render_row0(particle_index);
  let row1 = render_row1(particle_index);
  let row2 = render_row2(particle_index);
  let row3 = render_row3(particle_index);
  let row4 = render_row4(particle_index);
  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let s3 = surface_row3(surface_index);
  let material_id = s0.x;
  let phase_id = s0.y;
  let render_domain_id = max(s3.x, 0.0);
  if (row1.x != material_id || (render_domain_id > 0.0 && row2.w != render_domain_id)) {
    return;
  }

  let phase_weight = render_phase_weight(phase_id, row1.y, row2.y, row4.x);
  if (phase_weight <= 0.0) {
    return;
  }

  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  let resolution = max(u32(s1.x), 1u);
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let particle_radius_scale = select(0.0, -s2.x, s2.x < 0.0);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let inv_resolution = 1.0 / f32(resolution);
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  let particle_radius_norm = select(
    0.0,
    max(row3.y * particle_radius_norm_scale, particle_radius_floor_norm),
    particle_radius_scale > 0.0 && row3.y > 0.0
  );
  let full_particle_strength = select(
    strength,
    (s1.y + subtract) * particle_radius_norm * particle_radius_norm,
    particle_radius_norm > 0.0
  );
  let particle_strength = phase_partitioned_metaball_strength(
    full_particle_strength,
    phase_weight,
    s1.y,
    subtract
  );
  let particle_support_norm = metaball_support_norm(particle_strength, subtract);
  let radius_cells = min(
    i32(resolution) - 1,
    i32(ceil(particle_support_norm * f32(resolution))) + 1
  );
  let span_cells = radius_cells * 2 + 1;
  if (span_cells * span_cells * span_cells > i32(params.max_splat_cells_per_source)) {
    atomicStore(&overflow_state[0u], 1u);
    return;
  }

  let particle = vec3<f32>(
    clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
    clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
  );
  let center = vec3<i32>(
    i32(clamp(floor(particle.x * f32(resolution)), 0.0, f32(resolution - 1u))),
    i32(clamp(floor(particle.y * f32(resolution)), 0.0, f32(resolution - 1u))),
    i32(clamp(floor(particle.z * f32(resolution)), 0.0, f32(resolution - 1u)))
  );
  let color = vec3<f32>(s2.y, s2.z, s2.w);

  for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
    let z_i = center.z + dz;
    if (z_i < 0 || z_i >= i32(resolution)) { continue; }
    for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
      let y_i = center.y + dy;
      if (y_i < 0 || y_i >= i32(resolution)) { continue; }
      for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
        let x_i = center.x + dx;
        if (x_i < 0 || x_i >= i32(resolution)) { continue; }
        let cell = vec3<f32>(
          f32(x_i) * inv_resolution,
          f32(y_i) * inv_resolution,
          f32(z_i) * inv_resolution
        );
        let delta = cell - particle;
        let local_cell = field_index_3d(u32(x_i), u32(y_i), u32(z_i), resolution);
        if (local_cell >= field_cell_count) { continue; }
        let out_index = field_offset + local_cell;
        if (out_index >= params.total_field_cells) { continue; }
        // Phase 2 re-samples at the smeared distance the resolve pass derived
        // for this cell. Phases 0 and 1 use the raw distance, which is what the
        // gather's uncorrected pass does when it collects its moments.
        let smear_sq = select(
          0.0,
          published_field[out_index * 2u + 1u].y,
          params.splat_phase == 2u
        );
        let dist2 = dot(delta, delta) + smear_sq;
        let value = particle_strength / (0.000001 + dist2) - subtract;
        if (value <= 0.0) { continue; }
        let palette_weight = smooth_palette_weight(
          sqrt(dist2) / max(particle_support_norm, 1.0e-6)
        );
        if (params.splat_phase != 1u) {
        saturating_add(&accum[accum_index(out_index, 0u)], &overflow_state[0u], quantize(value, params.density_scale));
        saturating_add(&accum[accum_index(out_index, 1u)], &overflow_state[0u], quantize(color.x * palette_weight, params.palette_scale));
        saturating_add(&accum[accum_index(out_index, 2u)], &overflow_state[0u], quantize(color.y * palette_weight, params.palette_scale));
        saturating_add(&accum[accum_index(out_index, 3u)], &overflow_state[0u], quantize(color.z * palette_weight, params.palette_scale));
        saturating_add(&accum[accum_index(out_index, 4u)], &overflow_state[0u], quantize(row1.z * value, params.temperature_scale));
        saturating_add(&accum[accum_index(out_index, 5u)], &overflow_state[0u], quantize(value, params.temperature_scale));
        }
        // Velocity moments for the splash-shard smear, weighted by the same
        // positive metaball value the gather uses. The accumulator is
        // unsigned, so each signed component is split into its positive and
        // negative halves and recombined at resolve; a bias constant would
        // need a max-speed assumption this has no way to justify.
        if (params.render_smear_dt_s > 0.0 && params.splat_phase != 2u) {
          let vel = vec3<f32>(row4.y, row4.z, row4.w);
          let vw = vel * value;
          saturating_add(&accum[accum_index(out_index, 6u)], &overflow_state[0u], quantize(max(vw.x, 0.0), params.velocity_scale));
          saturating_add(&accum[accum_index(out_index, 7u)], &overflow_state[0u], quantize(max(-vw.x, 0.0), params.velocity_scale));
          saturating_add(&accum[accum_index(out_index, 8u)], &overflow_state[0u], quantize(max(vw.y, 0.0), params.velocity_scale));
          saturating_add(&accum[accum_index(out_index, 9u)], &overflow_state[0u], quantize(max(-vw.y, 0.0), params.velocity_scale));
          saturating_add(&accum[accum_index(out_index, 10u)], &overflow_state[0u], quantize(max(vw.z, 0.0), params.velocity_scale));
          saturating_add(&accum[accum_index(out_index, 11u)], &overflow_state[0u], quantize(max(-vw.z, 0.0), params.velocity_scale));
          saturating_add(&accum[accum_index(out_index, 12u)], &overflow_state[0u], quantize(dot(vel, vel) * value, params.velocity_scale));
        }
      }
    }
  }
}
`;

const sphRenderFieldSourceLocalResolveWgsl = `
struct SourceLocalParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  max_splat_cells_per_source: u32,
  field_padding: f32,
  ref_edge_m: f32,
  density_scale: f32,
  palette_scale: f32,
  temperature_scale: f32,
  // Must mirror the splat struct exactly: both bind the same uniform buffer.
  render_smear_dt_s: f32,
  velocity_scale: f32,
  // 0 = single pass, everything (smear disabled).
  // 1 = velocity moments only, uncorrected distances.
  // 2 = density/palette/temperature only, corrected by each cell's smear.
  splat_phase: u32,
};

@group(0) @binding(0) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> accum: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: SourceLocalParams;

const ACCUM_LANES: u32 = 13u;

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn accum_index(field_cell_index: u32, lane: u32) -> u32 {
  return field_cell_index * ACCUM_LANES + lane;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) { return; }
  let s0 = surface_row0(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  if (cell_index >= field_cell_count) { return; }
  let out_index = field_offset + cell_index;
  if (out_index >= params.total_field_cells) { return; }

  let density = f32(atomicLoad(&accum[accum_index(out_index, 0u)])) / max(params.density_scale, 1.0);
  let palette = vec3<f32>(
    f32(atomicLoad(&accum[accum_index(out_index, 1u)])) / max(params.palette_scale, 1.0),
    f32(atomicLoad(&accum[accum_index(out_index, 2u)])) / max(params.palette_scale, 1.0),
    f32(atomicLoad(&accum[accum_index(out_index, 3u)])) / max(params.palette_scale, 1.0)
  );
  let temperature_weight = f32(atomicLoad(&accum[accum_index(out_index, 5u)])) / max(params.temperature_scale, 1.0);
  let temperature_weighted = f32(atomicLoad(&accum[accum_index(out_index, 4u)])) / max(params.temperature_scale, 1.0);
  let mean_temperature_k = select(
    0.0,
    temperature_weighted / max(temperature_weight, 1.0e-6),
    temperature_weight > 0.0
  );
  // Splash-shard smear: per-cell velocity dispersion from the moment lanes.
  //
  // sigma_v^2 = <|v|^2> - |<v>|^2, with both means weighted by the same
  // positive metaball value the density uses, so lane 0 is the weight. The
  // signed components arrive split into positive and negative halves because
  // the accumulator is unsigned; recombining is a subtraction.
  //
  // The gather applies the correction as dist^2 + (sigma_v * dt)^2 in
  // normalized field units, so the dispersion is converted with the same
  // span/ref_edge scale the splat uses for positions. Dispersion is zero for a
  // coherent or single-particle cell, so only cells bridging diverging
  // droplets are corrected -- matching the gather's behaviour exactly.
  var smear_sq = 0.0;
  if (params.render_smear_dt_s > 0.0 && density > 0.0) {
    let inv_velocity_scale = 1.0 / max(params.velocity_scale, 1.0);
    let mean_v = vec3<f32>(
      (f32(atomicLoad(&accum[accum_index(out_index, 6u)]))
        - f32(atomicLoad(&accum[accum_index(out_index, 7u)]))) * inv_velocity_scale,
      (f32(atomicLoad(&accum[accum_index(out_index, 8u)]))
        - f32(atomicLoad(&accum[accum_index(out_index, 9u)]))) * inv_velocity_scale,
      (f32(atomicLoad(&accum[accum_index(out_index, 10u)]))
        - f32(atomicLoad(&accum[accum_index(out_index, 11u)]))) * inv_velocity_scale
    ) / density;
    let mean_v2 = (f32(atomicLoad(&accum[accum_index(out_index, 12u)])) * inv_velocity_scale)
      / density;
    let variance = max(mean_v2 - dot(mean_v, mean_v), 0.0);
    let span = 1.0 - 2.0 * params.field_padding;
    let normalized_sigma = sqrt(variance) * span / max(params.ref_edge_m, 1.0e-12);
    let smear = normalized_sigma * params.render_smear_dt_s;
    smear_sq = smear * smear;
  }
  render_field_cells[out_index * 2u] = vec4<f32>(density, palette);
  render_field_cells[out_index * 2u + 1u] = vec4<f32>(mean_temperature_k, smear_sq, 0.0, 0.0);
}
`;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function assertRenderFieldSurfaceTable(surfaceTable) {
  if (
    surfaceTable?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA
    || !(surfaceTable.records instanceof Float32Array)
  ) {
    throw new TypeError('source-local render field requires a render-field surface table');
  }
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createSourceLocalParamsArray({
  particleCount,
  surfaceCount,
  totalFieldCells,
  maxSplatCellsPerSource,
  fieldPadding,
  refEdgeM,
  renderSmearDtS = 0
}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, surfaceCount, true);
  view.setUint32(8, totalFieldCells, true);
  view.setUint32(12, maxSplatCellsPerSource, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, SOURCE_LOCAL_DENSITY_SCALE, true);
  view.setFloat32(28, SOURCE_LOCAL_PALETTE_SCALE, true);
  view.setFloat32(32, SOURCE_LOCAL_TEMPERATURE_SCALE, true);
  // Zero here switches the velocity-moment lanes off in the splat, so a scene
  // without smear pays none of their atomics.
  view.setFloat32(36, Math.max(0, finiteNumber(renderSmearDtS, 0)), true);
  view.setFloat32(40, SOURCE_LOCAL_VELOCITY_SCALE, true);
  view.setUint32(44, SPLAT_PHASE_SINGLE, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label) {
  const readBuffer = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readBuffer, 0, Math.max(4, byteLength));
  device.queue.submit([encoder.finish()]);
  await readBuffer.mapAsync(GPU_MAP_MODE.READ);
  const bytes = readBuffer.getMappedRange().slice(0, byteLength);
  readBuffer.unmap();
  readBuffer.destroy?.();
  return bytes;
}

function estimateSourceLocalFieldVisits(surfaceTable, particleCount) {
  const sources = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  let estimatedCellVisits = 0;
  for (const surface of surfaceTable.metadata || []) {
    const resolution = Math.max(1, Math.round(finiteNumber(surface.resolution, 1)));
    const fieldCellCount = Math.max(0, Math.round(finiteNumber(surface.fieldCellCount, resolution ** 3)));
    const subtract = Math.max(1e-12, finiteNumber(surface.subtract, 1e-12));
    const supportNorm = Math.sqrt(Math.max(0, Math.abs(finiteNumber(surface.strength, 0)) / subtract));
    const radiusCells = Math.min(resolution - 1, Math.ceil(supportNorm * resolution) + 1);
    estimatedCellVisits += Math.min(fieldCellCount, (radiusCells * 2 + 1) ** 3) * sources;
  }
  const denseCellParticlePairs = Math.max(0, Math.round(finiteNumber(surfaceTable.totalFieldCells, 0))) * sources;
  return {
    sourceCount: sources,
    estimatedCellVisits,
    denseCellParticlePairs,
    estimatedVisitRatio: denseCellParticlePairs > 0
      ? estimatedCellVisits / denseCellParticlePairs
      : 0
  };
}

function fallbackReason({
  sourceLocalMode,
  readbackMode,
  renderSmearDtS,
  productEventRows,
  productEventBuffer,
  productEventCount,
  schroederSpatialSourceFamily,
  targetFieldRowsBuffer,
  retainFieldRowsBuffer,
  retainSurfaceBuffer,
  hasQueueFence,
  renderRowsBuffer,
  waitForQueueCompletion,
  deferCleanup,
  useQueueFenceForCleanup
}) {
  if (sourceLocalMode === SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DISABLED) return 'source-local-disabled';
  const shadowMode = sourceLocalMode === SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_SHADOW;
  const diagnosticNoReadbackMode = sourceLocalMode
    === SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DIAGNOSTIC_NO_READBACK;
  if (!shadowMode && !diagnosticNoReadbackMode) return 'source-local-mode-not-supported';
  if (shadowMode && readbackMode !== FULL_READBACK_MODE) {
    return 'shadow-parity-requires-full-readback';
  }
  if (diagnosticNoReadbackMode && readbackMode !== NO_FULL_READBACK_MODE) {
    return 'diagnostic-no-readback-requires-no-full-readback';
  }
  // Velocity smear is implemented as of the phased splat: moments are collected
  // at uncorrected distances, reduced to a per-cell dispersion, and the density
  // re-splatted through it. Admitting it here is what lets shadow mode compare
  // the result against the gather -- the refusal previously made that
  // comparison impossible, so parity could never be established either way.
  if (productEventRows || productEventBuffer || finiteNumber(productEventCount, 0) > 0) {
    return 'product-event-parity-not-yet-implemented';
  }
  if (schroederSpatialSourceFamily) return 'successor-lineage-parity-not-yet-implemented';
  if (targetFieldRowsBuffer) return 'shadow-mode-does-not-publish-pooled-output';
  if (diagnosticNoReadbackMode && !retainFieldRowsBuffer) {
    return 'diagnostic-no-readback-requires-retained-field-buffer';
  }
  if (diagnosticNoReadbackMode && !retainSurfaceBuffer) {
    return 'diagnostic-no-readback-requires-retained-surface-buffer';
  }
  if (diagnosticNoReadbackMode && !hasQueueFence) {
    return 'diagnostic-no-readback-requires-queue-fence';
  }
  if (diagnosticNoReadbackMode && renderRowsBuffer) {
    return 'diagnostic-no-readback-requires-owned-render-rows';
  }
  if (
    diagnosticNoReadbackMode
    && !waitForQueueCompletion
    && (!deferCleanup || !useQueueFenceForCleanup)
  ) {
    return 'diagnostic-no-readback-requires-queue-fenced-cleanup';
  }
  return null;
}

function sourceLocalFallbackResult(denseResult, reason) {
  return {
    ...denseResult,
    sourceLocalSchema: SPH_RENDER_FIELD_SOURCE_LOCAL_SCHEMA,
    sourceLocalStrategy: 'dense-fallback',
    sourceLocalShadowOnly: true,
    sourceLocalFallbackReason: reason,
    sourceLocalEligible: false,
    sourceLocalUsableForPresentation: false
  };
}

function attachSourceLocalDiagnosticRetainedBufferLeases({
  result,
  fieldRowsBuffer,
  fieldRowByteLength,
  surfaceBuffer,
  surfaceTable,
  queueFencePromise = null
}) {
  const ledger = createResidentBufferLeaseLedger({
    ledgerId: `sph-render-field-source-local-diagnostic:${surfaceTable.surfaceCount}:${surfaceTable.totalFieldCells}:buffer-leases`,
    stateKey: 'sph-render-field-source-local-diagnostic',
    scope: 'sph-render-field-source-local-diagnostic-buffer-leases'
  });
  const inspectionLeaseIds = [];
  const queueFenceLeaseIds = [];
  const registerRetainedBuffer = ({
    resourceKey,
    resourceKind,
    buffer,
    byteLength,
    rowCount,
    expectedConsumers,
    queueFenceProtected = false
  }) => {
    registerResidentBufferResource(ledger, {
      resourceKey,
      resourceKind,
      stateFamily: 'render-field-source-local-diagnostic',
      ownerStage: 'source-local-render-field-diagnostic',
      producerStage: 'source-local-render-field-diagnostic',
      source: 'buildSphRenderFieldSourceLocalWebGpu',
      status: 'resident-source-local-render-field-buffer-retained',
      retained: true,
      byteLength,
      rowCount,
      bufferLabel: buffer?.label,
      expectedConsumers
    });
    for (const consumerStage of expectedConsumers) {
      const lease = addResidentBufferLease(ledger, {
        resourceKey,
        consumerStage,
        reason: 'retained-source-local-diagnostic-buffer'
      });
      inspectionLeaseIds.push(lease.leaseId);
    }
    if (queueFenceProtected) {
      const queueFenceLease = addResidentBufferLease(ledger, {
        resourceKey,
        consumerStage: 'source-local-diagnostic-gpu-queue-fence',
        reason: 'submitted-source-local-diagnostic-work'
      });
      queueFenceLeaseIds.push(queueFenceLease.leaseId);
    }
  };
  const fieldRowsResourceKey = `source-local-render-field:field-rows:${surfaceTable.totalFieldCells}:${fieldRowByteLength}`;
  const surfaceTableResourceKey = `source-local-render-field:surface-table:${surfaceTable.surfaceCount}:${surfaceTable.records.byteLength}`;
  registerRetainedBuffer({
    resourceKey: fieldRowsResourceKey,
    resourceKind: 'render-field-rows-buffer',
    buffer: fieldRowsBuffer,
    byteLength: fieldRowByteLength,
    rowCount: surfaceTable.totalFieldCells,
    expectedConsumers: ['source-local-diagnostic-inspection'],
    queueFenceProtected: Boolean(queueFencePromise)
  });
  registerRetainedBuffer({
    resourceKey: surfaceTableResourceKey,
    resourceKind: 'render-field-surface-table-buffer',
    buffer: surfaceBuffer,
    byteLength: surfaceTable.records.byteLength,
    rowCount: surfaceTable.surfaceCount,
    expectedConsumers: ['source-local-diagnostic-inspection'],
    queueFenceProtected: Boolean(queueFencePromise)
  });

  const refreshLeaseSummary = () => {
    result.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(ledger);
    result.residentBufferLeaseLedgerStatus = result.residentBufferLeaseSummary.status;
    result.residentBufferLeaseResourceCount = result.residentBufferLeaseSummary.resourceCount;
    result.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseSummary.activeLeaseCount;
    return result.residentBufferLeaseSummary;
  };
  const destroyedResourceKeys = new Set();
  const destroyBufferOnce = (resourceKey, buffer) => {
    if (destroyedResourceKeys.has(resourceKey)) return;
    destroyedResourceKeys.add(resourceKey);
    buffer?.destroy?.();
  };

  result.residentBufferLeaseLedger = ledger;
  refreshLeaseSummary();
  result.releaseRenderFieldBufferLeases = ({ status = 'released' } = {}) => {
    for (const leaseId of inspectionLeaseIds) {
      releaseResidentBufferLease(ledger, leaseId, { status });
    }
    return refreshLeaseSummary();
  };
  result.destroyRenderFieldBuffers = ({
    force = false,
    releaseLeases = false,
    reason = 'source-local-render-field-diagnostic-buffer-cleanup'
  } = {}) => {
    if (releaseLeases) result.releaseRenderFieldBufferLeases();
    destroyResidentBufferWithLease(ledger, fieldRowsResourceKey, () => {
      destroyBufferOnce(fieldRowsResourceKey, fieldRowsBuffer);
    }, { force, reason });
    destroyResidentBufferWithLease(ledger, surfaceTableResourceKey, () => {
      destroyBufferOnce(surfaceTableResourceKey, surfaceBuffer);
    }, { force, reason });
    return refreshLeaseSummary();
  };
  if (queueFencePromise) {
    result.sourceLocalQueueFenceStatus = 'queue-fence-pending';
    Promise.resolve(queueFencePromise)
      .then(
        () => 'queue-fence-completed',
        () => 'queue-fence-rejected'
      )
      .then((status) => {
        for (const leaseId of queueFenceLeaseIds) {
          releaseResidentBufferLease(ledger, leaseId, { status });
        }
        result.sourceLocalQueueFenceStatus = status;
        refreshLeaseSummary();
      });
  } else {
    result.sourceLocalQueueFenceStatus = 'queue-work-completed';
  }
  return result;
}

/**
 * Build a generic source-local render field for parity inspection only.
 *
 * It intentionally routes presentation-facing calls to the exact dense native
 * builder.  A distinct diagnostic-no-readback mode can retain an owned field
 * and surface artifact for lifetime/queue-fence proof, but it is never a
 * presentation candidate in this slice.
 */
export async function buildSphRenderFieldSourceLocalWebGpu(options = {}) {
  const {
    device,
    renderRows,
    renderRowsBuffer = null,
    renderRowsSource = null,
    schroederSpatialSourceFamily = renderRowsSource?.schroederSpatialSourceFamily ?? null,
    productEventRows = null,
    productEventBuffer = null,
    surfaceTable,
    particleCount = null,
    productEventCount = null,
    fieldPadding = 0.22,
    refEdgeM = 10,
    renderSmearDtS = 0,
    readbackMode = FULL_READBACK_MODE,
    retainFieldRowsBuffer = false,
    retainSurfaceBuffer = false,
    waitForQueueCompletion = true,
    deferCleanup = true,
    useQueueFenceForCleanup = true,
    targetFieldRowsBuffer = null,
    sourceLocalMode = SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_SHADOW,
    maxSplatCellsPerSource = DEFAULT_MAX_SPLAT_CELLS_PER_SOURCE
  } = options;

  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphRenderFieldSourceLocalWebGpu requires a WebGPU-like device');
  }
  if (!renderRowsBuffer && !(renderRows instanceof Float32Array)) {
    throw new TypeError('source-local render field requires renderRows or renderRowsBuffer');
  }
  if (renderRows && renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  assertRenderFieldSurfaceTable(surfaceTable);

  const resolvedParticleCount = Math.max(0, Math.round(finiteNumber(
    particleCount ?? (renderRows?.length ? renderRows.length / SPH_GPU_RENDER_ROW_FLOATS : 0),
    0
  )));
  const resolvedProductEventCount = Math.max(0, Math.round(finiteNumber(
    productEventCount ?? 0,
    0
  )));
  const reason = fallbackReason({
    sourceLocalMode,
    readbackMode,
    renderSmearDtS,
    productEventRows,
    productEventBuffer,
    productEventCount: resolvedProductEventCount,
    schroederSpatialSourceFamily,
    targetFieldRowsBuffer,
    retainFieldRowsBuffer,
    retainSurfaceBuffer,
    hasQueueFence: Boolean(device.queue?.onSubmittedWorkDone),
    renderRowsBuffer,
    waitForQueueCompletion,
    deferCleanup,
    useQueueFenceForCleanup
  });
  if (reason) {
    const denseResult = await buildSphRenderFieldWebGpu(options);
    return sourceLocalFallbackResult(denseResult, reason);
  }
  if (resolvedParticleCount <= 0) {
    const denseResult = await buildSphRenderFieldWebGpu(options);
    return sourceLocalFallbackResult(denseResult, 'source-local-requires-explicit-particle-count');
  }

  const fieldRowByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const borrowedRenderRowsBuffer = renderRowsBuffer || null;
  const sourceRowsBuffer = borrowedRenderRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-local-render-rows',
    renderRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const surfaceBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-local-surfaces',
    surfaceTable.records,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const accumBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-local-accum',
    new Uint32Array(surfaceTable.totalFieldCells * SOURCE_LOCAL_ACCUM_LANES)
  );
  const overflowBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-local-overflow',
    new Uint32Array(1),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const fieldRowsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-local-cells',
    new Float32Array(surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-render-field-source-local-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const resolvedRenderSmearDtS = Math.max(0, finiteNumber(renderSmearDtS, 0));
  const resolvedMaxSplatCellsPerSource = Math.max(
    1,
    Math.min(16_777_216, Math.round(finiteNumber(
      maxSplatCellsPerSource,
      DEFAULT_MAX_SPLAT_CELLS_PER_SOURCE
    )))
  );
  device.queue.writeBuffer(paramsBuffer, 0, createSourceLocalParamsArray({
    particleCount: resolvedParticleCount,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxSplatCellsPerSource: resolvedMaxSplatCellsPerSource,
    fieldPadding,
    refEdgeM,
    renderSmearDtS: resolvedRenderSmearDtS
  }));

  const splatPipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-render-field-source-local-shadow-splat-v2',
    label: 'ulg-sph-render-field-source-local-shadow-splat',
    code: sphRenderFieldSourceLocalSplatWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'read-only-storage')
    ]
  });
  const splatBindGroup = device.createBindGroup({
    layout: splatPipelineState.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceRowsBuffer } },
      { binding: 1, resource: { buffer: surfaceBuffer } },
      { binding: 2, resource: { buffer: accumBuffer } },
      { binding: 3, resource: { buffer: overflowBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } },
      { binding: 5, resource: { buffer: fieldRowsBuffer } }
    ]
  });
  const resolvePipelineState = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-render-field-source-local-shadow-resolve-v1',
    label: 'ulg-sph-render-field-source-local-shadow-resolve',
    code: sphRenderFieldSourceLocalResolveWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const resolveBindGroup = device.createBindGroup({
    layout: resolvePipelineState.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: surfaceBuffer } },
      { binding: 1, resource: { buffer: accumBuffer } },
      { binding: 2, resource: { buffer: fieldRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });

  const encoder = device.createCommandEncoder();
  const splatWorkgroups = [
    Math.max(1, Math.ceil(resolvedParticleCount / 64)),
    Math.max(1, surfaceTable.surfaceCount)
  ];
  const resolveWorkgroups = [
    Math.max(1, Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64)),
    Math.max(1, surfaceTable.surfaceCount)
  ];
  const encodeSplat = () => {
    const pass = encoder.beginComputePass();
    pass.setPipeline(splatPipelineState.pipeline);
    pass.setBindGroup(0, splatBindGroup);
    pass.dispatchWorkgroups(splatWorkgroups[0], splatWorkgroups[1]);
    pass.end();
  };
  const encodeResolve = () => {
    const pass = encoder.beginComputePass();
    pass.setPipeline(resolvePipelineState.pipeline);
    pass.setBindGroup(0, resolveBindGroup);
    pass.dispatchWorkgroups(resolveWorkgroups[0], resolveWorkgroups[1]);
    pass.end();
  };
  // Without smear this is the original splat/resolve pair. With smear the
  // correction is per-cell and cannot be computed by a scattering particle, so
  // it takes four passes: collect moments at uncorrected distances, reduce them
  // to a per-cell offset, re-splat density through that offset, resolve again.
  //
  // No clearing is needed between them because phase 1 writes only the moment
  // lanes and phase 2 only the primary lanes, and the second resolve recomputes
  // the same dispersion from moment lanes phase 2 never touched.
  if (resolvedRenderSmearDtS > 0) {
    writeSplatPhase(device, paramsBuffer, SPLAT_PHASE_MOMENTS_ONLY);
    encodeSplat();
    encodeResolve();
    writeSplatPhase(device, paramsBuffer, SPLAT_PHASE_SMEARED_PRIMARY);
    encodeSplat();
    encodeResolve();
  } else {
    encodeSplat();
    encodeResolve();
  }

  const diagnosticNoReadback = sourceLocalMode
    === SPH_RENDER_FIELD_SOURCE_LOCAL_MODE_DIAGNOSTIC_NO_READBACK;
  const visitEstimate = estimateSourceLocalFieldVisits(surfaceTable, resolvedParticleCount);
  if (diagnosticNoReadback) {
    let transientCleanupDone = false;
    const cleanupTransientBuffers = () => {
      if (transientCleanupDone) return;
      transientCleanupDone = true;
      if (!borrowedRenderRowsBuffer) sourceRowsBuffer.destroy?.();
      accumBuffer.destroy?.();
      overflowBuffer.destroy?.();
      paramsBuffer.destroy?.();
    };
    const cleanupAllBuffers = () => {
      cleanupTransientBuffers();
      surfaceBuffer.destroy?.();
      fieldRowsBuffer.destroy?.();
    };
    let queueCompletionStatus = 'not-submitted';
    let queueCompletionMethod = null;
    let renderFieldDeferredCleanup = false;
    let retainedOutputQueueFence = null;
    try {
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = 'queue-submitted-gpu-handoff-no-cpu-fence';
      queueCompletionMethod = 'queue.submit(in-order-source-local-diagnostic-handoff)';
      if (waitForQueueCompletion) {
        await device.queue.onSubmittedWorkDone();
        cleanupTransientBuffers();
        queueCompletionStatus = 'queue-work-completed';
        queueCompletionMethod = 'queue.onSubmittedWorkDone';
      } else {
        retainedOutputQueueFence = Promise.resolve(device.queue.onSubmittedWorkDone());
        renderFieldDeferredCleanup = deferSubmittedWorkCleanup(device, cleanupTransientBuffers);
        if (!renderFieldDeferredCleanup) {
          throw new Error('source-local diagnostic requires queue-fenced transient cleanup');
        }
      }
    } catch (error) {
      cleanupAllBuffers();
      throw error;
    }

    const diagnosticResult = {
      schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
      backend: 'webgpu-source-local-diagnostic',
      status: 'render-field-source-local-diagnostic-submitted',
      kernelScope: SOURCE_LOCAL_KERNEL_SCOPE,
      sourceLocalSchema: SPH_RENDER_FIELD_SOURCE_LOCAL_SCHEMA,
      sourceLocalStrategy: 'diagnostic-no-readback',
      sourceLocalShadowOnly: true,
      sourceLocalDiagnosticNoReadback: true,
      sourceLocalEligible: false,
      sourceLocalUsableForPresentation: false,
      sourceLocalOverflow: null,
      sourceLocalOverflowStatus: 'not-readback-diagnostic-ineligible',
      sourceLocalMaxSplatCellsPerSource: resolvedMaxSplatCellsPerSource,
      sourceLocalDensityScale: SOURCE_LOCAL_DENSITY_SCALE,
      sourceLocalPaletteScale: SOURCE_LOCAL_PALETTE_SCALE,
      sourceLocalTemperatureScale: SOURCE_LOCAL_TEMPERATURE_SCALE,
      sourceLocalEstimatedCellVisits: visitEstimate.estimatedCellVisits,
      sourceLocalDenseCellParticlePairs: visitEstimate.denseCellParticlePairs,
      sourceLocalEstimatedVisitRatio: visitEstimate.estimatedVisitRatio,
      sourceLocalDispatchWorkgroups: {
        splatX: Math.max(1, Math.ceil(resolvedParticleCount / 64)),
        splatY: Math.max(1, surfaceTable.surfaceCount),
        resolveX: Math.max(1, Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64)),
        resolveY: Math.max(1, surfaceTable.surfaceCount)
      },
      schroederSpatialLineageMode: 'non-schroeder-source-local-diagnostic',
      schroederSpatialSourceFamily: null,
      particleCount: resolvedParticleCount,
      productEventCount: 0,
      productEventBufferBound: false,
      productEventBufferByteLength: 0,
      surfaceCount: surfaceTable.surfaceCount,
      totalFieldCells: surfaceTable.totalFieldCells,
      maxFieldCellCount: surfaceTable.maxFieldCellCount,
      surfaceTable,
      rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
      rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
      fieldRows: new Float32Array(),
      fieldRowsBuffer,
      fieldRowByteLength,
      fieldPadding,
      refEdgeM,
      surfaceBuffer,
      renderFieldInputSource: 'uploaded-render-rows-source-local-diagnostic',
      readbackMode: NO_FULL_READBACK_MODE,
      queueCompletionStatus,
      queueCompletionMethod,
      pipelineCacheStatus: splatPipelineState.cacheStatus === 'pipeline-cache-hit'
        && resolvePipelineState.cacheStatus === 'pipeline-cache-hit'
        ? 'pipeline-cache-hit'
        : 'pipeline-cache-miss',
      sourceLocalSplatPipelineCacheStatus: splatPipelineState.cacheStatus,
      sourceLocalResolvePipelineCacheStatus: resolvePipelineState.cacheStatus,
      renderFieldDeferredCleanup,
      renderFieldReadback: false,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      fieldRowsBufferRetained: true,
      fieldRowsBufferByteLength: fieldRowByteLength,
      fieldRowsBufferBorrowed: false,
      fieldRowsBufferReused: false,
      fieldRowsBufferOwnedByResult: true,
      surfaceBufferRetained: true,
      surfaceBufferByteLength: surfaceTable.records.byteLength,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
    return attachSourceLocalDiagnosticRetainedBufferLeases({
      result: diagnosticResult,
      fieldRowsBuffer,
      fieldRowByteLength,
      surfaceBuffer,
      surfaceTable,
      queueFencePromise: retainedOutputQueueFence
    });
  }

  device.queue.submit([encoder.finish()]);

  let fieldRows;
  let overflowState;
  try {
    const [fieldBytes, overflowBytes] = await Promise.all([
      readBuffer(device, fieldRowsBuffer, fieldRowByteLength, 'ulg-sph-render-field-source-local-shadow-readback'),
      readBuffer(device, overflowBuffer, Uint32Array.BYTES_PER_ELEMENT, 'ulg-sph-render-field-source-local-overflow-readback')
    ]);
    fieldRows = new Float32Array(fieldBytes);
    overflowState = new Uint32Array(overflowBytes)[0] || 0;
  } finally {
    if (!borrowedRenderRowsBuffer) sourceRowsBuffer.destroy?.();
    surfaceBuffer.destroy?.();
    accumBuffer.destroy?.();
    overflowBuffer.destroy?.();
    fieldRowsBuffer.destroy?.();
    paramsBuffer.destroy?.();
  }

  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu-source-local-shadow',
    status: overflowState ? 'render-field-shadow-overflow' : 'render-field-shadow-built',
    kernelScope: SOURCE_LOCAL_KERNEL_SCOPE,
    sourceLocalSchema: SPH_RENDER_FIELD_SOURCE_LOCAL_SCHEMA,
    sourceLocalStrategy: 'shadow',
    sourceLocalShadowOnly: true,
    sourceLocalEligible: !overflowState,
    sourceLocalUsableForPresentation: false,
    sourceLocalOverflow: Boolean(overflowState),
    sourceLocalMaxSplatCellsPerSource: resolvedMaxSplatCellsPerSource,
    sourceLocalDensityScale: SOURCE_LOCAL_DENSITY_SCALE,
    sourceLocalPaletteScale: SOURCE_LOCAL_PALETTE_SCALE,
    sourceLocalTemperatureScale: SOURCE_LOCAL_TEMPERATURE_SCALE,
    sourceLocalEstimatedCellVisits: visitEstimate.estimatedCellVisits,
    sourceLocalDenseCellParticlePairs: visitEstimate.denseCellParticlePairs,
    sourceLocalEstimatedVisitRatio: visitEstimate.estimatedVisitRatio,
    sourceLocalDispatchWorkgroups: {
      splatX: Math.max(1, Math.ceil(resolvedParticleCount / 64)),
      splatY: Math.max(1, surfaceTable.surfaceCount),
      resolveX: Math.max(1, Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64)),
      resolveY: Math.max(1, surfaceTable.surfaceCount)
    },
    particleCount: resolvedParticleCount,
    productEventCount: 0,
    productEventBufferBound: false,
    productEventBufferByteLength: 0,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxFieldCellCount: surfaceTable.maxFieldCellCount,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
    fieldRows,
    fieldRowByteLength,
    fieldPadding,
    refEdgeM,
    renderFieldInputSource: borrowedRenderRowsBuffer
      ? 'resident-render-rows-buffer-source-local-shadow'
      : 'uploaded-render-rows-source-local-shadow',
    readbackMode: FULL_READBACK_MODE,
    queueCompletionStatus: 'readback-map-completed',
    queueCompletionMethod: 'mapAsync(readback-buffer)',
    pipelineCacheStatus: splatPipelineState.cacheStatus === 'pipeline-cache-hit'
      && resolvePipelineState.cacheStatus === 'pipeline-cache-hit'
      ? 'pipeline-cache-hit'
      : 'pipeline-cache-miss',
    sourceLocalSplatPipelineCacheStatus: splatPipelineState.cacheStatus,
    sourceLocalResolvePipelineCacheStatus: resolvePipelineState.cacheStatus,
    renderFieldDeferredCleanup: false,
    renderFieldReadback: true,
    fullReadbackPerformed: true,
    normalHotLoopReadbackFree: false,
    fieldRowsBufferRetained: false,
    fieldRowsBufferByteLength: 0,
    fieldRowsBufferBorrowed: false,
    fieldRowsBufferReused: false,
    fieldRowsBufferOwnedByResult: false,
    surfaceBufferRetained: false,
    surfaceBufferByteLength: 0,
    schroederSpatialLineageMode: 'non-schroeder-shadow',
    schroederSpatialSourceFamily: null,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export const SPH_RENDER_FIELD_SOURCE_LOCAL_TESTING = Object.freeze({
  FULL_READBACK_MODE,
  NO_FULL_READBACK_MODE,
  sphRenderFieldSourceLocalSplatWgsl,
  sphRenderFieldSourceLocalResolveWgsl
});
