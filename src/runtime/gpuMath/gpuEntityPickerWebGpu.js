// Canonical Reusable Universal WebGPU Entity Ray-Picker & Live Mote Tracker
// (`src/runtime/gpuMath/gpuEntityPickerWebGpu.js`).
//
// Strictly Star Spec v0.4 & GPU-Native compliant:
//   - ZERO full-buffer CPU readbacks, ZERO serial @workgroup_size(1) compute passes!
//   - Scans ANY resident WebGPU particle/star/atom/mote/lipid/agent buffer directly on
//     the GPU (`@workgroup_size(64)` parallel reduction) against the user's click ray/NDC,
//     returning ONLY a single 80-byte hit record containing `{ index, distPx, depth, rawVec0..3 }`!
//   - Also provides a zero-compute 64-byte DMA single-mote tracker (`readSingleEntityWebGpu`)
//     so clicking ANY mote lets the camera & inspector smoothly track THAT exact moving GPU entity!

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

// Layout modes for resident GPU entity buffers:
//   0 = standard (pos = vec0.xyz, stride = 1/2/3/4 vec4s)
//   1 = L1 Galaxy (8 floats = 2 vec4s; skips invisible dark-matter halo where vec1.w < 0 unless flags&1)
//   2 = L2 Solar System f32x2 double-float (pos = (vec0.xyz - offHi) + (vec1.xyz - offLo))
//   3 = Flagged live parcels (16 floats = 4 vec4s; active when vec3.w >= 0.5)
//   4 = L5 MD Crystal (pos = vec0.xyz wrapped inside halfBox = offset_lo.xyz!)
export const GPU_PICK_LAYOUT = Object.freeze({
  STANDARD: 0,
  GALAXY_VISIBLE: 1,
  SOLAR_DOUBLE_FLOAT: 2,
  FLAGGED_LIVE_16F: 3,
  MD_PERIODIC_4F: 4
});

export const gpuEntityPickerWgsl = /* wgsl */ `
struct PickParams {
  view_proj: mat4x4<f32>,
  click_ndc_asp: vec4<f32>,  // x = clickNdcX, y = clickNdcY, z = aspect, w = maxPickNdc
  offset_scale: vec4<f32>,   // xyz = focusOffsetHi, w = worldScale
  offset_lo: vec4<f32>,      // xyz = focusOffsetLo (or halfBox for MD), w = flags
  counts: vec4<u32>,         // x = count, y = strideVec4 (1..4), z = layoutMode, w = skipFirst
};

@group(0) @binding(0) var<uniform> params: PickParams;
@group(0) @binding(1) var<storage, read> entities: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pick_out: array<vec4<f32>>;

var<workgroup> wg_score: array<f32, 64>;
var<workgroup> wg_depth: array<f32, 64>;
var<workgroup> wg_idx: array<u32, 64>;

@compute @workgroup_size(64)
fn pick_nearest_entity(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let n = params.counts.x;
  let stride = max(1u, params.counts.y);
  let mode = params.counts.z;
  let skip_first = params.counts.w;
  let max_r = max(0.015, params.click_ndc_asp.w);
  let asp = max(0.25, params.click_ndc_asp.z);
  let click_xy = params.click_ndc_asp.xy;
  let w_scale = params.offset_scale.w;

  var best_score = 1e9;
  var best_depth = 1e9;
  var best_idx = 0xffffffffu;

  var i = skip_first + tid;
  loop {
    if (i >= n) { break; }
    let base = i * stride;
    let v0 = entities[base];
    var valid = true;
    var wpos = vec3<f32>(0.0);

    if (mode == 1u) {
      let v1 = entities[base + 1u];
      if (v1.w < 0.0 && params.offset_lo.w < 0.5) { valid = false; }
      wpos = (v0.xyz - params.offset_scale.xyz) * w_scale;
    } else if (mode == 2u) {
      let v1 = entities[base + 1u];
      let dxyz = (v0.xyz - params.offset_scale.xyz) + (v1.xyz - params.offset_lo.xyz);
      wpos = dxyz * w_scale;
    } else if (mode == 3u) {
      let v3 = entities[base + 3u];
      if (v3.w < 0.5) { valid = false; }
      wpos = (v0.xyz - params.offset_scale.xyz) * w_scale;
    } else if (mode == 4u) {
      let hb = params.offset_lo.xyz;
      wpos = (v0.xyz - hb) * w_scale;
    } else {
      wpos = (v0.xyz - params.offset_scale.xyz) * w_scale;
    }

    if (valid) {
      let clip = params.view_proj * vec4<f32>(wpos, 1.0);
      if (clip.w > 0.02) {
        let ndc = clip.xyz / clip.w;
        if (ndc.z >= 0.0 && ndc.z <= 1.0) {
          let dx = (ndc.x - click_xy.x) * asp;
          let dy = (ndc.y - click_xy.y);
          let dist = sqrt(dx * dx + dy * dy);
          if (dist <= max_r) {
            // Favor closest to cursor first, breaking near-ties by front-most depth!
            let score = dist + ndc.z * 0.012;
            if (score < best_score) {
              best_score = score;
              best_depth = ndc.z;
              best_idx = i;
            }
          }
        }
      }
    }
    i = i + 64u;
  }

  wg_score[tid] = best_score;
  wg_depth[tid] = best_depth;
  wg_idx[tid] = best_idx;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      if (wg_score[tid + s] < wg_score[tid]) {
        wg_score[tid] = wg_score[tid + s];
        wg_depth[tid] = wg_depth[tid + s];
        wg_idx[tid] = wg_idx[tid + s];
      }
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let win = wg_idx[0u];
    if (win == 0xffffffffu) {
      pick_out[0u] = vec4<f32>(-1.0, 999.0, 1.0, 0.0);
      pick_out[1u] = vec4<f32>(0.0);
      pick_out[2u] = vec4<f32>(0.0);
      pick_out[3u] = vec4<f32>(0.0);
      pick_out[4u] = vec4<f32>(0.0);
    } else {
      let base = win * stride;
      pick_out[0u] = vec4<f32>(f32(win), wg_score[0u], wg_depth[0u], 1.0);
      pick_out[1u] = entities[base];
      pick_out[2u] = select(vec4<f32>(0.0), entities[base + 1u], stride >= 2u);
      pick_out[3u] = select(vec4<f32>(0.0), entities[base + 2u], stride >= 3u);
      pick_out[4u] = select(vec4<f32>(0.0), entities[base + 3u], stride >= 4u);
    }
  }
}
`;

export function createGpuEntityPickerWebGpu(device) {
  const paramsBuf = device.createBuffer({
    label: 'ulg-gpu-entity-picker-params',
    size: 128,
    usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST
  });
  const outBuf = device.createBuffer({
    label: 'ulg-gpu-entity-picker-out',
    size: 80,
    usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC
  });
  const readBuf = device.createBuffer({
    label: 'ulg-gpu-entity-picker-read',
    size: 80,
    usage: GPU_BUF.COPY_DST | GPU_BUF.MAP_READ
  });
  const trackReadBuf = device.createBuffer({
    label: 'ulg-gpu-entity-tracker-read',
    size: 64,
    usage: GPU_BUF.COPY_DST | GPU_BUF.MAP_READ
  });

  const pipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gpu-entity-picker.v1',
    label: 'ulg-gpu-entity-picker',
    code: gpuEntityPickerWgsl,
    entryPoint: 'pick_nearest_entity',
    bindings: [
      computeBufferBinding(0, 'uniform'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage')
    ]
  });

  let pickInFlight = false;
  let trackInFlight = false;
  let disposed = false;

  async function pickEntity({
    buffer,
    count,
    strideFloats = 16,
    layoutMode = GPU_PICK_LAYOUT.STANDARD,
    skipFirst = 0,
    viewProj,
    clickNdcX,
    clickNdcY,
    aspect = 1.6,
    maxPickNdc = 0.085,
    offsetHi = [0, 0, 0],
    offsetLo = [0, 0, 0],
    worldScale = 1.0,
    includeDarkMatter = false
  }) {
    if (disposed || pickInFlight || !buffer || !(count > 0) || readBuf.mapState !== 'unmapped') return null;
    pickInFlight = true;
    try {
      const ab = new ArrayBuffer(128);
      const f32 = new Float32Array(ab);
      const u32 = new Uint32Array(ab);
      f32.set(viewProj, 0);
      f32[16] = clickNdcX;
      f32[17] = clickNdcY;
      f32[18] = aspect;
      f32[19] = maxPickNdc;
      f32[20] = offsetHi[0] || 0;
      f32[21] = offsetHi[1] || 0;
      f32[22] = offsetHi[2] || 0;
      f32[23] = worldScale;
      f32[24] = offsetLo[0] || 0;
      f32[25] = offsetLo[1] || 0;
      f32[26] = offsetLo[2] || 0;
      f32[27] = includeDarkMatter ? 1.0 : 0.0;
      u32[28] = Math.trunc(count);
      u32[29] = Math.max(1, Math.min(4, Math.trunc(strideFloats / 4)));
      u32[30] = layoutMode;
      u32[31] = Math.max(0, Math.trunc(skipFirst));
      device.queue.writeBuffer(paramsBuf, 0, ab);

      const bg = createCachedExplicitBindGroup(device, {
        layout: pipe.bindGroupLayout,
        label: 'ulg-gpu-entity-picker-bg',
        entries: [
          { binding: 0, resource: { buffer: paramsBuf } },
          { binding: 1, resource: { buffer } },
          { binding: 2, resource: { buffer: outBuf } }
        ]
      });

      const enc = device.createCommandEncoder({ label: 'ulg-gpu-entity-pick' });
      const pass = enc.beginComputePass({ label: 'ulg-gpu-entity-pick-pass' });
      pass.setPipeline(pipe.pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(1);
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, 80);
      device.queue.submit([enc.finish()]);

      await readBuf.mapAsync(GPU_BUF.MAP_READ);
      let result = null;
      if (!disposed) {
        const out = new Float32Array(readBuf.getMappedRange(0, 80));
        if (out[3] > 0.5 && out[0] >= 0) {
          result = {
            index: Math.round(out[0]),
            scoreNdc: out[1],
            depth: out[2],
            vec0: [out[4], out[5], out[6], out[7]],
            vec1: [out[8], out[9], out[10], out[11]],
            vec2: [out[12], out[13], out[14], out[15]],
            vec3: [out[16], out[17], out[18], out[19]]
          };
        }
      }
      try { readBuf.unmap(); } catch {}
      return result;
    } catch (err) {
      if (!disposed && err?.name !== 'AbortError') throw err;
      return null;
    } finally {
      pickInFlight = false;
    }
  }

  /**
   * Zero-compute 16-to-64-byte DMA read of ONE tracked entity directly from its resident
   * WebGPU buffer (so the selection reticle & live physics readouts follow ANY moving mote!).
   */
  async function readSingleEntity(buffer, index, strideFloats = 16) {
    if (disposed || trackInFlight || !buffer || index < 0 || trackReadBuf.mapState !== 'unmapped') return null;
    const strideBytes = Math.min(64, Math.max(16, Math.trunc(strideFloats) * 4));
    const byteOff = Math.trunc(index) * strideBytes;
    if (byteOff + strideBytes > buffer.size) return null;
    trackInFlight = true;
    try {
      const enc = device.createCommandEncoder({ label: 'ulg-gpu-track-single' });
      enc.copyBufferToBuffer(buffer, byteOff, trackReadBuf, 0, strideBytes);
      device.queue.submit([enc.finish()]);
      await trackReadBuf.mapAsync(GPU_BUF.MAP_READ);
      let raw = null;
      if (!disposed) {
        raw = new Float32Array(trackReadBuf.getMappedRange(0, strideBytes).slice(0));
      }
      try { trackReadBuf.unmap(); } catch {}
      return raw;
    } catch (err) {
      if (!disposed && err?.name !== 'AbortError') throw err;
      return null;
    } finally {
      trackInFlight = false;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [paramsBuf, outBuf, readBuf, trackReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    pickEntity,
    readSingleEntity,
    dispose
  });
}
