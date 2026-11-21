import {
  ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA,
  SCHROEDER_SCALE_CHART_NO_PARENT,
  packSchroederScaleAtlasChartTable,
  schroederScaleAtlasChartRebaseWgsl
} from '../../../ulg-gpu-abi/src/index.js';

export const ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_GPU_SCHEMA =
  'peercompute.ulg.schroeder-spatial-scale-atlas-gpu.v1';
export const SCHROEDER_SCALE_ATLAS_VERIFY_MAGIC = 0x5353_4131; // 'SSA1'
export const SCHROEDER_SCALE_ATLAS_VERIFY_RECEIPT_WORDS = 16;
export const SCHROEDER_SCALE_ATLAS_VERIFY_RECEIPT_BYTES =
  SCHROEDER_SCALE_ATLAS_VERIFY_RECEIPT_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_WORDS = 16;
export const SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_BYTES =
  SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_WORDS * Uint32Array.BYTES_PER_ELEMENT;

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

const SCALE_ATLAS_VERIFY_WGSL = /* wgsl */ `
${schroederScaleAtlasChartRebaseWgsl}

struct AtlasSampleInput {
  chart_id: u32,
  flags: u32,
  mass_kg: f32,
  energy_j: f32,
  pos_local: vec3<f32>,
  pad0: f32,
  lin_mom: vec3<f32>,
  pad1: f32,
  ang_mom: vec3<f32>,
  pad2: f32,
};

struct AtlasLiftedOutput {
  root_chart_id: u32,
  hop_count: u32,
  mass_kg: f32,
  energy_j: f32,
  root_pos_hi: vec3<f32>,
  pad0: f32,
  root_pos_lo: vec3<f32>,
  pad1: f32,
  root_ang_mom: vec3<f32>,
  pad2: f32,
};

struct AtlasVerifyParams {
  sample_count: u32,
  chart_count: u32,
  dyadic_span_levels: u32,
  active_level_count: u32,
};

@group(0) @binding(0) var<storage, read> charts: array<SchroederScaleChartRecord>;
@group(0) @binding(1) var<storage, read> samples: array<AtlasSampleInput>;
@group(0) @binding(2) var<storage, read_write> lifted_root: array<AtlasLiftedOutput>;
@group(0) @binding(3) var<storage, read_write> receipt: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: AtlasVerifyParams;

const NO_PARENT: u32 = ${SCHROEDER_SCALE_CHART_NO_PARENT}u;
const VERIFY_MAGIC: u32 = ${SCHROEDER_SCALE_ATLAS_VERIFY_MAGIC}u;
const MAX_HOPS: u32 = 32u;

fn is_finite_f32(v: f32) -> bool {
  return (bitcast<u32>(v) & 0x7f800000u) != 0x7f800000u;
}

fn is_finite_vec3(v: vec3<f32>) -> bool {
  return is_finite_f32(v.x) && is_finite_f32(v.y) && is_finite_f32(v.z);
}

fn find_chart_index(chart_id: u32) -> u32 {
  if (chart_id < params.chart_count && charts[chart_id].chart_id == chart_id) {
    return chart_id;
  }
  for (var i = 0u; i < params.chart_count; i = i + 1u) {
    if (charts[i].chart_id == chart_id) {
      return i;
    }
  }
  return NO_PARENT;
}

@compute @workgroup_size(1)
fn init_scale_atlas_receipt() {
  for (var i = 0u; i < 16u; i = i + 1u) {
    atomicStore(&receipt[i], 0u);
  }
  atomicStore(&receipt[0], VERIFY_MAGIC);
  atomicStore(&receipt[1], 1u);
  atomicStore(&receipt[5], params.dyadic_span_levels);
  atomicStore(&receipt[8], params.chart_count);
  atomicStore(&receipt[9], params.active_level_count);
}

@compute @workgroup_size(64)
fn verify_scale_atlas_roundtrip(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.sample_count) { return; }
  let s = samples[idx];
  var cur_idx = find_chart_index(s.chart_id);
  if (cur_idx == NO_PARENT) {
    atomicOr(&receipt[2], 64u);
    return;
  }
  var cur_pos_hi = s.pos_local;
  var cur_pos_lo = vec3<f32>(0.0);
  var cur_ang_mom = s.ang_mom;
  let lin_mom = s.lin_mom;
  let mass_kg = s.mass_kg;
  let energy_j = s.energy_j;
  var hops = 0u;

  for (var step = 0u; step < MAX_HOPS; step = step + 1u) {
    let c = charts[cur_idx];
    if (c.parent_chart_id == NO_PARENT || (c.flags & 1u) == 0u) {
      break;
    }
    let parent_idx = find_chart_index(c.parent_chart_id);
    if (parent_idx == NO_PARENT) {
      atomicOr(&receipt[2], 64u);
      break;
    }
    let p = charts[parent_idx];
    let hop_exp_abs = u32(abs(c.parent_relative_level_offset));
    atomicMax(&receipt[10], hop_exp_abs);

    // 1. Exact double-float child -> parent -> child roundtrip across the dyadic jump.
    let p_pos = ss_atlas_rebase_child_to_parent(cur_pos_hi, c);
    let roundtrip = ss_atlas_rebase_parent_to_child(p_pos[0], p_pos[1], c);
    if (!is_finite_vec3(p_pos[0]) || !is_finite_vec3(p_pos[1]) || !is_finite_vec3(roundtrip)) {
      atomicOr(&receipt[2], 1u);
    } else {
      let denom = max(1.0, length(cur_pos_hi));
      let rel_pos_err = length(roundtrip - cur_pos_hi) / denom;
      atomicMax(&receipt[6], bitcast<u32>(rel_pos_err));
      if (rel_pos_err > 1e-4) {
        atomicOr(&receipt[2], 2u);
      }
    }

    // 2. Exact parallel-axis angular momentum shift in physical meter units.
    // Every global level in [-64, +96] has a strictly normal f32 dyadic scale.
    let origin_m = ss_atlas_dyadic_scale_vec3(c.origin_hi, p.global_base_level);
    let shift_torque = cross(origin_m, lin_mom);
    let next_ang_mom = cur_ang_mom + shift_torque;
    let inv_ang_mom = next_ang_mom - shift_torque;
    if (!is_finite_vec3(origin_m) || !is_finite_vec3(next_ang_mom) || !is_finite_vec3(inv_ang_mom)) {
      atomicOr(&receipt[2], 1u);
    } else {
      let scale_l = max(1.0, max(length(cur_ang_mom), length(shift_torque)));
      let rel_l_err = length(inv_ang_mom - cur_ang_mom) / scale_l;
      atomicMax(&receipt[7], bitcast<u32>(rel_l_err));
      if (rel_l_err > 1e-4) {
        atomicOr(&receipt[2], 16u);
      }
    }

    cur_pos_hi = p_pos[0];
    cur_pos_lo = p_pos[1];
    cur_ang_mom = next_ang_mom;
    cur_idx = parent_idx;
    hops = hops + 1u;
  }

  // Verify scalar invariants (mass, energy) and root finiteness.
  if (!is_finite_f32(mass_kg) || !is_finite_f32(energy_j) || !is_finite_vec3(cur_pos_hi)) {
    atomicOr(&receipt[2], 1u);
  }
  if (mass_kg != s.mass_kg) {
    atomicOr(&receipt[2], 4u);
  }
  if (energy_j != s.energy_j) {
    atomicOr(&receipt[2], 32u);
  }

  lifted_root[idx] = AtlasLiftedOutput(
    charts[cur_idx].chart_id,
    hops,
    mass_kg,
    energy_j,
    cur_pos_hi,
    0.0,
    cur_pos_lo,
    0.0,
    cur_ang_mom,
    0.0
  );
  atomicAdd(&receipt[3], 1u);
  atomicAdd(&receipt[4], hops);
}

@compute @workgroup_size(1)
fn seal_scale_atlas_receipt() {
  let err = atomicLoad(&receipt[2]);
  let verified = atomicLoad(&receipt[3]);
  let ok = (err == 0u) && (verified == params.sample_count);
  atomicStore(&receipt[1], select(5u, 3u, ok));
}
`;

export function packSchroederScaleAtlasSamples(samples = []) {
  if (!Array.isArray(samples) || samples.length < 1) {
    throw new TypeError('packSchroederScaleAtlasSamples requires at least one sample');
  }
  const words = new Uint32Array(samples.length * SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_WORDS);
  const view = new DataView(words.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const base = i * SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_BYTES;
    const pos = s.posLocal ?? [0, 0, 0];
    const mom = s.linearMomentumKgMPerS ?? [0, 0, 0];
    const ang = s.angularMomentumKgM2PerS ?? [0, 0, 0];
    view.setUint32(base + 0, (s.chartId >>> 0), true);
    view.setUint32(base + 4, (s.flags >>> 0), true);
    view.setFloat32(base + 8, Number(s.massKg ?? 1), true);
    view.setFloat32(base + 12, Number(s.energyJ ?? 0), true);
    view.setFloat32(base + 16, Number(pos[0] ?? 0), true);
    view.setFloat32(base + 20, Number(pos[1] ?? 0), true);
    view.setFloat32(base + 24, Number(pos[2] ?? 0), true);
    view.setFloat32(base + 28, 0, true);
    view.setFloat32(base + 32, Number(mom[0] ?? 0), true);
    view.setFloat32(base + 36, Number(mom[1] ?? 0), true);
    view.setFloat32(base + 40, Number(mom[2] ?? 0), true);
    view.setFloat32(base + 44, 0, true);
    view.setFloat32(base + 48, Number(ang[0] ?? 0), true);
    view.setFloat32(base + 52, Number(ang[1] ?? 0), true);
    view.setFloat32(base + 56, Number(ang[2] ?? 0), true);
    view.setFloat32(base + 60, 0, true);
  }
  return words;
}

export function decodeSchroederScaleAtlasVerifyReceipt(words) {
  const arr = words instanceof Uint32Array ? words : new Uint32Array(words);
  const f32View = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  const magic = arr[0] >>> 0;
  const status = arr[1] >>> 0;
  const errorMask = arr[2] >>> 0;
  return Object.freeze({
    magic,
    magicValid: magic === SCHROEDER_SCALE_ATLAS_VERIFY_MAGIC,
    status,
    verified: magic === SCHROEDER_SCALE_ATLAS_VERIFY_MAGIC && status === 3 && errorMask === 0,
    errorMask,
    verifiedSampleCount: arr[3] >>> 0,
    totalChartHops: arr[4] >>> 0,
    dyadicSpanLevels: arr[5] >>> 0,
    maxRelPosError: f32View.getFloat32(24, true),
    maxRelAngularError: f32View.getFloat32(28, true),
    chartCount: arr[8] >>> 0,
    activeLevelCount: arr[9] >>> 0,
    maxHopScaleExpAbs: arr[10] >>> 0,
    rawWords: Object.freeze(Array.from(arr))
  });
}

/**
 * GPU-native runtime for the 40-OOM Dyadic Scale-Chart Atlas.
 *
 * Uploads the packed 64-byte-per-chart scale-chart table once and verifies
 * multi-chart double-float coordinate rebasing and parallel-axis angular
 * momentum conservation across > 40 orders of magnitude on the GPU with a
 * fixed 64-byte receipt (zero full sample readback).
 */
export function createSchroederSpatialScaleAtlasGpu(device, {
  atlasPlan,
  maxSamples = 64,
  label = 'ulg-ss-scale-atlas'
} = {}) {
  if (!device?.createBuffer || !device?.createShaderModule || !device?.createComputePipeline) {
    throw new TypeError('createSchroederSpatialScaleAtlasGpu requires a WebGPU device');
  }
  if (!atlasPlan || atlasPlan.schema !== ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA) {
    throw new TypeError('createSchroederSpatialScaleAtlasGpu requires a valid scale atlas plan');
  }
  const capacity = Math.max(1, Math.trunc(Number(maxSamples) || 64));
  const packedCharts = packSchroederScaleAtlasChartTable(atlasPlan);

  const chartTableBuffer = device.createBuffer({
    label: `${label}-chart-table`,
    size: packedCharts.byteLength,
    usage: USAGE_STORAGE | USAGE_COPY_DST
  });
  device.queue.writeBuffer(chartTableBuffer, 0, packedCharts);

  const sampleBuffer = device.createBuffer({
    label: `${label}-samples`,
    size: capacity * SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_BYTES,
    usage: USAGE_STORAGE | USAGE_COPY_DST
  });
  const liftedOutputBuffer = device.createBuffer({
    label: `${label}-lifted-output`,
    size: capacity * SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_BYTES,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const receiptBuffer = device.createBuffer({
    label: `${label}-verify-receipt`,
    size: SCHROEDER_SCALE_ATLAS_VERIFY_RECEIPT_BYTES,
    usage: USAGE_STORAGE | USAGE_COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: `${label}-verify-params`,
    size: 16,
    usage: USAGE_UNIFORM | USAGE_COPY_DST
  });

  const bindGroupLayout = device.createBindGroupLayout({
    label: `${label}-bgl`,
    entries: [
      { binding: 0, visibility: 4, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: 4, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 4, buffer: { type: 'storage' } },
      { binding: 3, visibility: 4, buffer: { type: 'storage' } },
      { binding: 4, visibility: 4, buffer: { type: 'uniform' } }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    label: `${label}-pl`,
    bindGroupLayouts: [bindGroupLayout]
  });
  const shaderModule = device.createShaderModule({
    label: `${label}-wgsl`,
    code: SCALE_ATLAS_VERIFY_WGSL
  });
  const initPipeline = device.createComputePipeline({
    label: `${label}-init-receipt`,
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: 'init_scale_atlas_receipt' }
  });
  const verifyPipeline = device.createComputePipeline({
    label: `${label}-verify-roundtrip`,
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: 'verify_scale_atlas_roundtrip' }
  });
  const sealPipeline = device.createComputePipeline({
    label: `${label}-seal-receipt`,
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: 'seal_scale_atlas_receipt' }
  });
  const bindGroup = device.createBindGroup({
    label: `${label}-bg`,
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: chartTableBuffer } },
      { binding: 1, resource: { buffer: sampleBuffer } },
      { binding: 2, resource: { buffer: liftedOutputBuffer } },
      { binding: 3, resource: { buffer: receiptBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } }
    ]
  });

  let destroyed = false;

  function encodeVerify(encoder, samples) {
    if (destroyed) throw new Error('Scale atlas GPU runtime was destroyed');
    const packedSamples = samples instanceof Uint32Array
      ? samples
      : packSchroederScaleAtlasSamples(samples);
    const sampleCount = packedSamples.length / SCHROEDER_SCALE_ATLAS_SAMPLE_STRIDE_WORDS;
    if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > capacity) {
      throw new RangeError(`sampleCount ${sampleCount} must be in [1, ${capacity}]`);
    }
    device.queue.writeBuffer(sampleBuffer, 0, packedSamples);
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      new Uint32Array([
        sampleCount >>> 0,
        atlasPlan.chartCount >>> 0,
        atlasPlan.dyadicSpanLevels >>> 0,
        atlasPlan.activeLevelCount >>> 0
      ])
    );
    const pass = encoder.beginComputePass({ label: `${label}-verify-pass` });
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(initPipeline);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(verifyPipeline);
    pass.dispatchWorkgroups(Math.ceil(sampleCount / 64));
    pass.setPipeline(sealPipeline);
    pass.dispatchWorkgroups(1);
    pass.end();
    return Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_GPU_SCHEMA,
      sampleCount,
      receiptBuffer,
      liftedOutputBuffer
    });
  }

  async function runVerificationReadback(samples) {
    const readbackBuffer = device.createBuffer({
      label: `${label}-receipt-readback`,
      size: SCHROEDER_SCALE_ATLAS_VERIFY_RECEIPT_BYTES,
      usage: USAGE_MAP_READ | USAGE_COPY_DST
    });
    try {
      const encoder = device.createCommandEncoder({ label: `${label}-verify-encoder` });
      encodeVerify(encoder, samples);
      encoder.copyBufferToBuffer(
        receiptBuffer,
        0,
        readbackBuffer,
        0,
        SCHROEDER_SCALE_ATLAS_VERIFY_RECEIPT_BYTES
      );
      device.queue.submit([encoder.finish()]);
      await readbackBuffer.mapAsync(USAGE_MAP_READ);
      const copy = new Uint32Array(readbackBuffer.getMappedRange().slice(0));
      readbackBuffer.unmap();
      return decodeSchroederScaleAtlasVerifyReceipt(copy);
    } finally {
      readbackBuffer.destroy();
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    chartTableBuffer.destroy();
    sampleBuffer.destroy();
    liftedOutputBuffer.destroy();
    receiptBuffer.destroy();
    paramsBuffer.destroy();
  }

  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_GPU_SCHEMA,
    atlasPlan,
    maxSamples: capacity,
    chartTableBuffer,
    receiptBuffer,
    liftedOutputBuffer,
    encodeVerify,
    runVerificationReadback,
    destroy
  });
}
