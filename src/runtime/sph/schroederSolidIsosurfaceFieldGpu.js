import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';

// Splat live coherent rigid-body members directly into each matching
// (materialId, phase=solid) marching-cubes render-field slice so rigid solids
// (such as ice or cooled solid iron) render through the exact same GPU
// marching-cubes isosurface and optical PBR pipeline as fluid surfaces instead
// of a separate flat-shaded voxel box overlay.
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_DST: 0x08 });
const dummyThermoBuffers = new WeakMap();

function dummyThermoBufferFor(device) {
  let buffer = dummyThermoBuffers.get(device);
  if (!buffer) {
    buffer = device.createBuffer({
      label: 'ulg-solid-isosurface-dummy-thermo',
      size: 16,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    dummyThermoBuffers.set(device, buffer);
  }
  return buffer;
}

export const schroederSolidIsosurfaceFieldWgsl = /* wgsl */ `
struct SolidFieldParams {
  // member_count, resolution, field_offset, has_thermo
  counts: vec4<u32>,
  // field_padding, ref_edge_m, isovalue, subtract
  field0: vec4<f32>,
  // strength, particle_radius_scale, default_temperature_k, unused
  field1: vec4<f32>,
  // color.rgb, unused
  color: vec4<f32>,
  // body bitmask words (supports up to 128 rigid bodies per family; all 0 = all bodies)
  body_mask: vec4<u32>,
};

@group(0) @binding(0) var<uniform> params: SolidFieldParams;
@group(0) @binding(1) var<storage, read> frames: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> members: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> lattice: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> member_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> field_rows: array<f32>;

const PI: f32 = 3.141592653589793;
const CELL_FLOATS: u32 = 8u;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(1.0 - ratio, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn body_in_mask(body: u32, mask: vec4<u32>) -> bool {
  if ((mask.x | mask.y | mask.z | mask.w) == 0u) { return true; }
  let word = body >> 5u;
  let bit = 1u << (body & 31u);
  if (word == 0u) { return (mask.x & bit) != 0u; }
  if (word == 1u) { return (mask.y & bit) != 0u; }
  if (word == 2u) { return (mask.z & bit) != 0u; }
  if (word == 3u) { return (mask.w & bit) != 0u; }
  return false;
}

@compute @workgroup_size(64)
fn splat_rigid_solid_isosurface(@builtin(global_invocation_id) id: vec3<u32>) {
  let resolution = params.counts.y;
  let cell_index = id.x;
  let total_cells = resolution * resolution * resolution;
  if (cell_index >= total_cells) { return; }

  let xy = resolution * resolution;
  let z = cell_index / xy;
  let rem = cell_index - z * xy;
  let y = rem / resolution;
  let x = rem - y * resolution;
  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(f32(x), f32(y), f32(z)) * inv_resolution;

  let padding = params.field0.x;
  let span = 1.0 - 2.0 * padding;
  let ref_edge = max(params.field0.y, 1.0e-12);
  let isovalue = params.field0.z;
  let subtract = max(params.field0.w, 1.0e-12);
  let strength = params.field1.x;
  let particle_radius_scale = max(params.field1.y, 0.0);
  let default_temp = params.field1.z;
  let particle_radius_norm_scale = particle_radius_scale * span / ref_edge;
  let particle_radius_floor_norm = select(
    0.0,
    sqrt(0.75 * inv_resolution * inv_resolution + 0.000001),
    particle_radius_scale > 0.0
  );
  let color = params.color.xyz;

  var density = 0.0;
  var palette = vec3<f32>(0.0);
  var temp_weighted = 0.0;
  var temp_weight = 0.0;

  let member_count = params.counts.x;
  let has_thermo = params.counts.w != 0u;
  let mask = params.body_mask;

  for (var m = 0u; m < member_count; m = m + 1u) {
    let m0 = members[m * 2u];
    if (!(m0.w > 0.0)) { continue; }
    let body = bitcast<u32>(members[m * 2u + 1u].x);
    if (!body_in_mask(body, mask)) { continue; }
    let base = body * 8u;
    let f0 = frames[base];
    let q = frames[base + 1u];
    let world = f0.xyz + quat_rotate(q, m0.xyz);
    let particle = vec3<f32>(
      clamp(padding + (world.x / ref_edge) * span, 0.001, 0.999),
      clamp(padding + (world.y / ref_edge) * span, 0.001, 0.999),
      clamp(padding + (world.z / ref_edge) * span, 0.001, 0.999)
    );
    let delta = cell - particle;
    let dist2 = dot(delta, delta);
    let pitch = max(lattice[body * 4u + 3u].xyz, vec3<f32>(1.0e-9));
    let member_radius_m = pow((0.75 / PI) * pitch.x * pitch.y * pitch.z, 1.0 / 3.0);
    let particle_radius_norm = select(
      0.0,
      max(member_radius_m * particle_radius_norm_scale, particle_radius_floor_norm),
      particle_radius_scale > 0.0
    );
    let member_strength = select(
      strength,
      (isovalue + subtract) * particle_radius_norm * particle_radius_norm,
      particle_radius_norm > 0.0
    );
    let support_norm = sqrt(max(member_strength, 0.0) / subtract);
    let value = member_strength / (0.000001 + dist2) - subtract;
    if (value > 0.0) {
      density = density + value;
      let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
      palette = palette + color * smooth_palette_weight(ratio);
      let member_temp = select(default_temp, member_thermo[m].y, has_thermo);
      temp_weighted = temp_weighted + member_temp * value;
      temp_weight = temp_weight + value;
    }
  }

  if (!(density > 0.0)) { return; }
  let row = (params.counts.z + cell_index) * CELL_FLOATS;
  let prior_density = max(field_rows[row], 0.0);
  let prior_temp = field_rows[row + 4u];
  let total_density = prior_density + density;
  field_rows[row] = total_density;
  field_rows[row + 1u] = field_rows[row + 1u] + palette.x;
  field_rows[row + 2u] = field_rows[row + 2u] + palette.y;
  field_rows[row + 3u] = field_rows[row + 3u] + palette.z;
  if (temp_weight > 0.0) {
    let added_temp = temp_weighted / temp_weight;
    field_rows[row + 4u] = select(
      added_temp,
      (prior_temp * prior_density + added_temp * density) / max(total_density, 1.0e-6),
      prior_density > 0.0 && prior_temp > 0.0
    );
  }
}
`;

export function encodeSchroederSolidIsosurfaceFieldSplatWebGpu({
  device,
  encoder,
  family,
  renderField
} = {}) {
  if (
    !device
    || !encoder
    || !family
    || family.destroyed
    || family.device !== device
    || !(family.memberCount > 0)
    || !family.frameBuffer
    || !family.memberBuffer
    || !family.latticeBuffer
    || !renderField?.fieldRowsBuffer
    || !Array.isArray(renderField?.surfaceTable?.metadata)
  ) {
    return null;
  }

  const refEdgeM = Number(renderField.refEdgeM);
  const fieldPadding = Number(renderField.fieldPadding);
  if (!(refEdgeM > 0) || !Number.isFinite(fieldPadding)) return null;

  const materials = Array.isArray(family.materials) && family.materials.length > 0
    ? family.materials
    : [null];
  const groupsByMaterialId = new Map();
  for (let bodyIndex = 0; bodyIndex < materials.length; bodyIndex += 1) {
    const materialKey = materials[bodyIndex];
    const materialId = (bodyIndex === 0 && Number(family.thermal?.materialId) > 0)
      ? Number(family.thermal.materialId)
      : (materialKey ? stableOpticalMaterialId(materialKey) : 0);
    if (!(materialId > 0)) continue;
    let group = groupsByMaterialId.get(materialId);
    if (!group) {
      group = {
        materialId,
        materialKey,
        bodyIndices: [],
        usesFamilyThermal: bodyIndex === 0 && Boolean(family.thermalStage?.thermoBuffer)
      };
      groupsByMaterialId.set(materialId, group);
    }
    group.bodyIndices.push(bodyIndex);
    if (bodyIndex === 0 && family.thermalStage?.thermoBuffer) {
      group.usesFamilyThermal = true;
    }
  }
  if (groupsByMaterialId.size === 0) return null;

  const pipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-solid-isosurface-field-splat.v2',
    label: 'ulg-solid-isosurface-field-splat',
    code: schroederSolidIsosurfaceFieldWgsl,
    entryPoint: 'splat_rigid_solid_isosurface',
    bindings: [
      computeBufferBinding(0, 'uniform'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'storage')
    ]
  });

  const paramsBuffers = [];
  for (const group of groupsByMaterialId.values()) {
    const surface = renderField.surfaceTable.metadata.find(
      (entry) => Number(entry?.materialId) === group.materialId
        && Number(entry?.phaseId) === 1
        && Number(entry?.opticalStateId || 0) === 0
    );
    if (!surface) continue;
    const resolution = Math.floor(Number(surface.resolution) || 0);
    const fieldOffset = Math.floor(Number(surface.fieldOffset) || 0);
    if (!(resolution > 0)) continue;

    const isovalue = Number(surface.isolation) || 0.25;
    const subtract = Number(surface.subtract) || 12;
    const strength = Number(surface.strength) || 0.02;
    const particleRadiusScale = Number(surface.particleRadiusScale) > 0
      ? Number(surface.particleRadiusScale)
      : 0;
    const color = Array.isArray(surface.colorLinear) && surface.colorLinear.length >= 3
      ? surface.colorLinear
      : [0.78, 0.9, 0.98];
    const hasThermo = group.usesFamilyThermal && Boolean(family.thermalStage?.thermoBuffer);
    const thermoBuffer = hasThermo ? family.thermalStage.thermoBuffer : dummyThermoBufferFor(device);
    const firstBodyIdx = group.bodyIndices[0] ?? 0;
    const bodyTempK = Number(family.bodyTemperaturesK?.[firstBodyIdx]);
    const defaultTempK = Number.isFinite(bodyTempK) && bodyTempK > 0
      ? bodyTempK
      : (Number(family.thermal?.meltTemperatureK)
        ? Math.min(273.15, Number(family.thermal.meltTemperatureK) - 10)
        : 273.15);

    const maskWords = [0, 0, 0, 0];
    if (groupsByMaterialId.size > 1) {
      for (const b of group.bodyIndices) {
        const w = b >>> 5;
        if (w < 4) maskWords[w] = (maskWords[w] | (1 << (b & 31))) >>> 0;
      }
    }

    const params = device.createBuffer({
      label: `ulg-solid-isosurface-field-splat-params-${group.materialId}`,
      size: 80,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    const words = new ArrayBuffer(80);
    const u = new Uint32Array(words);
    const f = new Float32Array(words);
    u.set([family.memberCount, resolution, fieldOffset, hasThermo ? 1 : 0], 0);
    f.set([fieldPadding, refEdgeM, isovalue, subtract], 4);
    f.set([strength, particleRadiusScale, defaultTempK, 0], 8);
    f.set([Number(color[0]) || 0.78, Number(color[1]) || 0.9, Number(color[2]) || 0.98, 0], 12);
    u.set(maskWords, 16);
    device.queue.writeBuffer(params, 0, words);

    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: params } },
        { binding: 1, resource: { buffer: family.frameBuffer } },
        { binding: 2, resource: { buffer: family.memberBuffer } },
        { binding: 3, resource: { buffer: family.latticeBuffer } },
        { binding: 4, resource: { buffer: thermoBuffer } },
        { binding: 5, resource: { buffer: renderField.fieldRowsBuffer } }
      ]
    });
    const pass = encoder.beginComputePass({ label: `ulg-solid-isosurface-field-splat-${group.materialId}` });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil((resolution ** 3) / 64));
    pass.end();
    paramsBuffers.push(params);
  }

  if (paramsBuffers.length === 0) return null;
  if (paramsBuffers.length === 1) return paramsBuffers[0];
  return {
    surfaceCount: paramsBuffers.length,
    destroy() {
      for (const buffer of paramsBuffers) {
        try { buffer.destroy(); } catch { /* Best-effort uniform cleanup. */ }
      }
    }
  };
}
