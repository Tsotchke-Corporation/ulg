// A4 GPU-Native Multidimensional Chebyshev Response Function Fitter
// (plan/todo/a3-a4-regional-and-multidimensional-closures.md).
//
// Moves A4 1-D and 2-D Chebyshev polynomial fitting + held-out residual
// certification from CPU JS onto WebGPU compute shaders (@workgroup_size(64)):
//   1. `project_chebyshev_1d` / `project_chebyshev_2d`: orthogonal discrete
//      cosine projection over Gauss-Chebyshev nodes (numerically well-conditioned
//      with zero host matrix inversion).
//   2. `verify_heldout_1d` / `verify_heldout_2d`: Clenshaw evaluation against
//      held-out test points on GPU with atomic fixed-point max-relative-error
//      reduction.
//   3. Outputs packed `RESPONSE_FUNCTION_GPU_SCHEMA` table rows ready directly
//      for `rf_eval` on-device without CPU fitting!

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  RESPONSE_FUNCTION_GPU_HEADER_FLOATS,
  RESPONSE_FUNCTION_GPU_RECORD_FLOATS,
  RESPONSE_FUNCTION_GPU_SCHEMA
} from './responseFunctionGpu.js';

export const ULG_RESPONSE_FUNCTION_FIT_GPU_SCHEMA =
  'peercompute.ulg.a4-response-function-fit-gpu.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

export const responseFunctionFitGpuWgsl = /* wgsl */ `
struct FitParams {
  // dim (1 or 2), n0 (nodes axis 0), n1 (nodes axis 1, 1 for 1D), heldout_count
  dims: vec4<u32>,
  // deg0, deg1, coeff_count, flags
  degrees: vec4<u32>,
  // lo0, hi0, lo1, hi1
  box_bounds: vec4<f32>,
  // rel_tol, abs_floor, safety_factor, unused
  tol: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: FitParams;
// Chebyshev-node samples: length = n0 * n1 (row-major i0 * n1 + i1)
@group(0) @binding(1) var<storage, read> node_samples: array<f32>;
// Held-out probe rows: vec4<f32>(x0, x1, expected_y, 0.0)
@group(0) @binding(2) var<storage, read> heldout_samples: array<vec4<f32>>;
// Output Chebyshev coefficients: length = (deg0 + 1) * (deg1 + 1)
@group(0) @binding(3) var<storage, read_write> coeffs: array<f32>;
// Receipt: [0]=valid(1/0), [1]=nonfinite_count, [2]=max_rel_err_nano (1e9 scaled), [3]=max_abs_err_micro (1e6 scaled)
@group(0) @binding(4) var<storage, read_write> receipt: array<atomic<u32>>;

const PI: f32 = 3.14159265358979323846;

fn finite_f32(v: f32) -> bool {
  return v == v && abs(v) <= 3.402823e38;
}

@compute @workgroup_size(64)
fn reset_fit_receipt(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 4u) {
    atomicStore(&receipt[id.x], select(0u, 1u, id.x == 0u));
  }
}

// Gauss-Chebyshev first-kind discrete cosine projection (exact for polynomials <= degree):
//   c_{k0,k1} = scale0 * scale1 * sum_{j0=0..n0-1} sum_{j1=0..n1-1} f(x_{j0}, x_{j1})
//               * cos(k0 * (j0 + 0.5) * pi / n0) * cos(k1 * (j1 + 0.5) * pi / n1)
@compute @workgroup_size(64)
fn project_chebyshev_coeffs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let c0 = params.degrees.x + 1u;
  let c1 = params.degrees.y + 1u;
  let total_coeffs = c0 * c1;
  if (idx >= total_coeffs) { return; }
  let k0 = idx / c1;
  let k1 = idx % c1;
  let n0 = params.dims.y;
  let n1 = max(1u, params.dims.z);
  let inv_n0 = 1.0 / f32(n0);
  let inv_n1 = 1.0 / f32(n1);
  let scale0 = select(2.0 * inv_n0, inv_n0, k0 == 0u);
  let scale1 = select(select(2.0 * inv_n1, inv_n1, k1 == 0u), 1.0, params.dims.x == 1u);

  var sum = 0.0;
  for (var j0 = 0u; j0 < n0; j0 = j0 + 1u) {
    let t0 = cos(f32(k0) * (f32(j0) + 0.5) * PI * inv_n0);
    for (var j1 = 0u; j1 < n1; j1 = j1 + 1u) {
      let val = node_samples[j0 * n1 + j1];
      if (!finite_f32(val)) {
        atomicAdd(&receipt[1], 1u);
        atomicStore(&receipt[0], 0u);
        coeffs[idx] = 0.0;
        return;
      }
      let t1 = select(cos(f32(k1) * (f32(j1) + 0.5) * PI * inv_n1), 1.0, params.dims.x == 1u);
      sum = sum + val * t0 * t1;
    }
  }
  coeffs[idx] = scale0 * scale1 * sum;
}

fn clenshaw_1d(u: f32, base: u32, count: u32) -> f32 {
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u = 2.0 * u;
  for (var step = 0u; step < count; step = step + 1u) {
    let k = count - 1u - step;
    if (k == 0u) {
      return coeffs[base] + u * b1 - b2;
    }
    let b0 = coeffs[base + k] + two_u * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return 0.0;
}

fn eval_fitted(x0: f32, x1: f32) -> f32 {
  let u0 = clamp(
    2.0 * (x0 - params.box_bounds.x) / max(params.box_bounds.y - params.box_bounds.x, 1.0e-30) - 1.0,
    -1.0, 1.0
  );
  let c0 = params.degrees.x + 1u;
  let c1 = params.degrees.y + 1u;
  if (params.dims.x == 1u) {
    return clenshaw_1d(u0, 0u, c0);
  }
  let u1 = clamp(
    2.0 * (x1 - params.box_bounds.z) / max(params.box_bounds.w - params.box_bounds.z, 1.0e-30) - 1.0,
    -1.0, 1.0
  );
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u0 = 2.0 * u0;
  for (var step = 0u; step < c0; step = step + 1u) {
    let k0 = c0 - 1u - step;
    let row_val = clenshaw_1d(u1, k0 * c1, c1);
    if (k0 == 0u) {
      return row_val + u0 * b1 - b2;
    }
    let b0 = row_val + two_u0 * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return 0.0;
}

@compute @workgroup_size(64)
fn verify_heldout(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.dims.w) { return; }
  let sample = heldout_samples[p];
  let expected = sample.z;
  let predicted = eval_fitted(sample.x, sample.y);
  if (!finite_f32(expected) || !finite_f32(predicted)) {
    atomicAdd(&receipt[1], 1u);
    atomicStore(&receipt[0], 0u);
    return;
  }
  let abs_err = abs(predicted - expected);
  let denom = max(params.tol.y, abs(expected));
  let rel_err = abs_err / denom;
  let rel_nano = u32(clamp(rel_err * 1.0e9, 0.0, 4294967000.0));
  let abs_micro = u32(clamp(abs_err * 1.0e6, 0.0, 4294967000.0));
  atomicMax(&receipt[2], rel_nano);
  atomicMax(&receipt[3], abs_micro);
  if (rel_err > params.tol.x) {
    atomicStore(&receipt[0], 0u);
  }
}
`;

/**
 * Compute Gauss-Chebyshev first-kind sample coordinates in [lo, hi].
 */
export function chebyshevSampleNodes(lo, hi, count) {
  const nodes = new Float64Array(count);
  const mid = 0.5 * (lo + hi);
  const half = 0.5 * (hi - lo);
  for (let j = 0; j < count; j += 1) {
    nodes[j] = mid + half * Math.cos(((j + 0.5) * Math.PI) / count);
  }
  return nodes;
}

/**
 * Fit a 1-D or 2-D Chebyshev response function directly on WebGPU from
 * Gauss-Chebyshev node samples and held-out verification samples.
 * Fails closed without a real GPUDevice.
 */
export async function fitResponseFunctionWebGpu(device, {
  box,
  degrees,
  nodeSamples,
  heldOutSamples,
  relativeTolerance = 1e-4,
  absoluteFloor = 1e-12,
  safetyFactor = 2.0,
  id = 'a4-gpu-fit'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('fitResponseFunctionWebGpu requires a live WebGPU GPUDevice');
  }
  const dim = Array.isArray(box) ? box.length : 0;
  if (dim !== 1 && dim !== 2) {
    throw new RangeError(`fitResponseFunctionWebGpu supports 1D and 2D closures (got dim=${dim})`);
  }
  const deg0 = Math.max(0, Math.min(31, Math.trunc(Number(degrees?.[0]) || 0)));
  const deg1 = dim === 2 ? Math.max(0, Math.min(31, Math.trunc(Number(degrees?.[1]) || 0))) : 0;
  const n0 = deg0 + 1;
  const n1 = dim === 2 ? deg1 + 1 : 1;
  const coeffCount = n0 * n1;
  const sampleFloats = nodeSamples instanceof Float32Array
    ? nodeSamples
    : Float32Array.from(nodeSamples);
  if (sampleFloats.length !== coeffCount) {
    throw new RangeError(`nodeSamples length ${sampleFloats.length} must equal ${coeffCount}`);
  }
  const heldOutCount = Math.max(1, Math.floor((heldOutSamples?.length ?? 0) / 4));
  const heldOutFloats = heldOutSamples instanceof Float32Array
    ? heldOutSamples
    : Float32Array.from(heldOutSamples?.length ? heldOutSamples : [box[0][0], dim === 2 ? box[1][0] : 0, sampleFloats[0], 0]);

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage')
  ];
  const resetPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-a4-rf-fit-reset.v1',
    label: 'ulg-a4-rf-fit-reset',
    code: responseFunctionFitGpuWgsl,
    entryPoint: 'reset_fit_receipt',
    bindings
  });
  const projPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-a4-rf-fit-project.v1',
    label: 'ulg-a4-rf-fit-project',
    code: responseFunctionFitGpuWgsl,
    entryPoint: 'project_chebyshev_coeffs',
    bindings
  });
  const verifyPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-a4-rf-fit-verify.v1',
    label: 'ulg-a4-rf-fit-verify',
    code: responseFunctionFitGpuWgsl,
    entryPoint: 'verify_heldout',
    bindings
  });

  const paramsBytes = new ArrayBuffer(64);
  const pu = new Uint32Array(paramsBytes);
  const pf = new Float32Array(paramsBytes);
  pu.set([dim, n0, n1, heldOutCount], 0);
  pu.set([deg0, deg1, coeffCount, 0], 4);
  pf.set([
    Number(box[0][0]),
    Number(box[0][1]),
    dim === 2 ? Number(box[1][0]) : 0,
    dim === 2 ? Number(box[1][1]) : 1
  ], 8);
  pf.set([Number(relativeTolerance), Number(absoluteFloor), Number(safetyFactor), 0], 12);

  const mk = (label, dataOrSize, usage) => {
    const size = typeof dataOrSize === 'number' ? Math.max(16, dataOrSize) : Math.max(16, dataOrSize.byteLength);
    const buf = device.createBuffer({ label, size, usage: usage | GPU_BUFFER_USAGE.COPY_DST });
    if (typeof dataOrSize !== 'number') device.queue.writeBuffer(buf, 0, dataOrSize);
    return buf;
  };
  const paramsBuf = mk('ulg-a4-fit-params', paramsBytes, GPU_BUFFER_USAGE.UNIFORM);
  const samplesBuf = mk('ulg-a4-fit-samples', sampleFloats, GPU_BUFFER_USAGE.STORAGE);
  const heldOutBuf = mk('ulg-a4-fit-heldout', heldOutFloats, GPU_BUFFER_USAGE.STORAGE);
  const coeffsBuf = mk('ulg-a4-fit-coeffs', coeffCount * 4, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC);
  const receiptBuf = mk('ulg-a4-fit-receipt', 16, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC);
  const readCoeffs = device.createBuffer({
    label: 'ulg-a4-fit-read-coeffs',
    size: Math.max(16, coeffCount * 4),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const readReceipt = device.createBuffer({
    label: 'ulg-a4-fit-read-receipt',
    size: 16,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  try {
    const bg = device.createBindGroup({
      layout: projPipe.bindGroupLayout,
      entries: [paramsBuf, samplesBuf, heldOutBuf, coeffsBuf, receiptBuf].map((buffer, binding) => ({
        binding,
        resource: { buffer }
      }))
    });
    const encoder = device.createCommandEncoder({ label: 'ulg-a4-rf-fit' });
    const pass = encoder.beginComputePass({ label: 'ulg-a4-rf-fit-pass' });
    pass.setBindGroup(0, bg);
    pass.setPipeline(resetPipe.pipeline);
    pass.dispatchWorkgroups(1);
    pass.setPipeline(projPipe.pipeline);
    pass.dispatchWorkgroups(Math.ceil(coeffCount / 64));
    pass.setPipeline(verifyPipe.pipeline);
    pass.dispatchWorkgroups(Math.ceil(heldOutCount / 64));
    pass.end();
    encoder.copyBufferToBuffer(coeffsBuf, 0, readCoeffs, 0, coeffCount * 4);
    encoder.copyBufferToBuffer(receiptBuf, 0, readReceipt, 0, 16);
    device.queue.submit([encoder.finish()]);

    await Promise.all([
      readCoeffs.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readReceipt.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const coeffArray = new Float32Array(readCoeffs.getMappedRange().slice(0, coeffCount * 4));
    const receiptWords = new Uint32Array(readReceipt.getMappedRange().slice(0, 16));
    readCoeffs.unmap();
    readReceipt.unmap();

    const maxRelativeError = receiptWords[2] / 1e9;
    const maxAbsoluteError = receiptWords[3] / 1e6;
    const nonFiniteCount = receiptWords[1];
    const valid = receiptWords[0] === 1 && nonFiniteCount === 0;

    // Pack directly into ULG's canonical `RESPONSE_FUNCTION_GPU_SCHEMA` layout!
    const totalFloats = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + RESPONSE_FUNCTION_GPU_RECORD_FLOATS + coeffCount;
    const packedData = new Float32Array(totalFloats);
    packedData[0] = 1; // functionCount
    const rBase = RESPONSE_FUNCTION_GPU_HEADER_FLOATS;
    packedData[rBase + 0] = dim;
    packedData[rBase + 1] = deg0;
    packedData[rBase + 2] = deg1;
    packedData[rBase + 3] = 0;
    packedData[rBase + 4] = Number(box[0][0]);
    packedData[rBase + 5] = Number(box[0][1]);
    packedData[rBase + 6] = dim === 2 ? Number(box[1][0]) : 0;
    packedData[rBase + 7] = dim === 2 ? Number(box[1][1]) : 0;
    packedData[rBase + 8] = 0;
    packedData[rBase + 9] = 0;
    packedData[rBase + 10] = RESPONSE_FUNCTION_GPU_HEADER_FLOATS + RESPONSE_FUNCTION_GPU_RECORD_FLOATS;
    packedData[rBase + 11] = coeffCount;
    packedData[rBase + 12] = maxAbsoluteError * safetyFactor;
    packedData[rBase + 13] = maxRelativeError;
    packedData[rBase + 14] = valid ? 1 : 0;
    packedData[rBase + 15] = 0;
    packedData.set(coeffArray, RESPONSE_FUNCTION_GPU_HEADER_FLOATS + RESPONSE_FUNCTION_GPU_RECORD_FLOATS);

    return Object.freeze({
      schema: ULG_RESPONSE_FUNCTION_FIT_GPU_SCHEMA,
      id,
      backend: 'webgpu',
      dim,
      degrees: Object.freeze(dim === 1 ? [deg0] : [deg0, deg1]),
      box: Object.freeze(box.map(([lo, hi]) => Object.freeze([Number(lo), Number(hi)]))),
      coefficients: coeffArray,
      valid,
      nonFiniteCount,
      maxRelativeError,
      maxAbsoluteError,
      uncertaintyBound: maxAbsoluteError * safetyFactor,
      packedGpuTable: Object.freeze({
        schema: RESPONSE_FUNCTION_GPU_SCHEMA,
        functionCount: 1,
        data: packedData
      })
    });
  } finally {
    for (const b of [paramsBuf, samplesBuf, heldOutBuf, coeffsBuf, receiptBuf, readCoeffs, readReceipt]) {
      b.destroy();
    }
  }
}
