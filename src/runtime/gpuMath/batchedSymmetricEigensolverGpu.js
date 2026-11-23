// Gate 0B: Shared WebGPU Batched Dense Symmetric / Generalized Eigensolver
// (`src/runtime/gpuMath/batchedSymmetricEigensolverGpu.js`).
//
// Powers GPU Hartree-Fock / CAS(2,2) (Gate 2), Periodic Plane-Wave Bloch DFT
// (Gate 1), and radial basis eigensolves with ZERO CPU eigensolve fallback.
// Uses @workgroup_size(64) cooperative Cyclic-Jacobi Givens rotations keeping
// workgroup shared memory to 20 bytes (safe under 16 KB WebGPU limits for all N).

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_GPU_EIGENSOLVER_SCHEMA = 'ulg.gpumath.batched-symmetric-eigensolver.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

export const batchedSymmetricEigensolverWgsl = /* wgsl */ `
struct EigenParams {
  n: u32,
  batch_count: u32,
  max_sweeps: u32,
  stride: u32, // n * n
  tol: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> params: EigenParams;
// In-place symmetric matrices A (length = batch_count * n * n); diagonal holds sorted eigenvalues on exit.
@group(0) @binding(1) var<storage, read_write> a_mat: array<f32>;
// Output eigenvectors V (column-major columns: column j is eigenvector j -> v_mat[base + row * n + col]).
@group(0) @binding(2) var<storage, read_write> v_mat: array<f32>;
// Output sorted eigenvalues (length = batch_count * n).
@group(0) @binding(3) var<storage, read_write> eigvals: array<f32>;

var<workgroup> sh_c: f32;
var<workgroup> sh_s: f32;
var<workgroup> sh_skip: u32;
var<workgroup> sh_sweep_max: f32;
var<workgroup> sh_done: u32;

@compute @workgroup_size(64)
fn jacobi_symmetric_batched(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let b = wg_id.x;
  if (b >= params.batch_count) { return; }
  let lid = local_id.x;
  let n = params.n;
  let stride = params.stride;
  let base = b * stride;

  // Initialize V = I cooperatively
  for (var idx = lid; idx < stride; idx = idx + 64u) {
    let r = idx / n;
    let c = idx % n;
    v_mat[base + idx] = select(0.0, 1.0, r == c);
  }
  if (lid == 0u) {
    sh_done = 0u;
  }
  workgroupBarrier();

  for (var sweep = 0u; sweep < params.max_sweeps; sweep = sweep + 1u) {
    if (lid == 0u) {
      sh_sweep_max = 0.0;
    }
    workgroupBarrier();

    for (var p = 0u; p + 1u < n; p = p + 1u) {
      for (var q = p + 1u; q < n; q = q + 1u) {
        if (lid == 0u) {
          let apq = a_mat[base + p * n + q];
          let abs_apq = abs(apq);
          if (abs_apq > sh_sweep_max) {
            sh_sweep_max = abs_apq;
          }
          if (sh_done != 0u || abs_apq <= params.tol) {
            sh_skip = 1u;
          } else {
            sh_skip = 0u;
            let app = a_mat[base + p * n + p];
            let aqq = a_mat[base + q * n + q];
            let tau = (aqq - app) / (2.0 * apq);
            let t = select(-1.0 / (-tau + sqrt(1.0 + tau * tau)), 1.0 / (tau + sqrt(1.0 + tau * tau)), tau >= 0.0);
            let c = 1.0 / sqrt(1.0 + t * t);
            let s = t * c;
            sh_c = c;
            sh_s = s;
          }
        }
        workgroupBarrier();

        if (sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          // Update off-diagonal rows/cols k != p, q in parallel
          for (var k = lid; k < n; k = k + 64u) {
            if (k != p && k != q) {
              let akp = a_mat[base + k * n + p];
              let akq = a_mat[base + k * n + q];
              let new_kp = c * akp - s * akq;
              let new_kq = s * akp + c * akq;
              a_mat[base + k * n + p] = new_kp;
              a_mat[base + p * n + k] = new_kp;
              a_mat[base + k * n + q] = new_kq;
              a_mat[base + q * n + k] = new_kq;
            }
            // Accumulate eigenvectors V = V * J
            let vkp = v_mat[base + k * n + p];
            let vkq = v_mat[base + k * n + q];
            v_mat[base + k * n + p] = c * vkp - s * vkq;
            v_mat[base + k * n + q] = s * vkp + c * vkq;
          }
        }
        workgroupBarrier();

        if (lid == 0u && sh_skip == 0u) {
          let c = sh_c;
          let s = sh_s;
          let app = a_mat[base + p * n + p];
          let aqq = a_mat[base + q * n + q];
          let apq = a_mat[base + p * n + q];
          let c2 = c * c;
          let s2 = s * s;
          let cs2 = 2.0 * c * s * apq;
          a_mat[base + p * n + p] = c2 * app - cs2 + s2 * aqq;
          a_mat[base + q * n + q] = s2 * app + cs2 + c2 * aqq;
          a_mat[base + p * n + q] = 0.0;
          a_mat[base + q * n + p] = 0.0;
        }
        workgroupBarrier();
      }
    }

    if (lid == 0u && sh_sweep_max <= params.tol) {
      sh_done = 1u;
    }
    workgroupBarrier();
  }

  // Extract eigenvalues and sort ascending along with eigenvector columns
  for (var i = lid; i < n; i = i + 64u) {
    eigvals[b * n + i] = a_mat[base + i * n + i];
  }
  workgroupBarrier();

  // Parallel column-swap selection sort (small N <= 256, deterministic)
  for (var i = 0u; i + 1u < n; i = i + 1u) {
    if (lid == 0u) {
      var min_j = i;
      var min_v = eigvals[b * n + i];
      for (var j = i + 1u; j < n; j = j + 1u) {
        let v = eigvals[b * n + j];
        if (v < min_v) {
          min_v = v;
          min_j = j;
        }
      }
      sh_skip = min_j;
      if (min_j != i) {
        eigvals[b * n + min_j] = eigvals[b * n + i];
        eigvals[b * n + i] = min_v;
      }
    }
    workgroupBarrier();
    let swap_j = sh_skip;
    if (swap_j != i) {
      for (var r = lid; r < n; r = r + 64u) {
        let tmp = v_mat[base + r * n + i];
        v_mat[base + r * n + i] = v_mat[base + r * n + swap_j];
        v_mat[base + r * n + swap_j] = tmp;
      }
    }
    workgroupBarrier();
  }
}
`;

const matMulTransformWgsl = /* wgsl */ `
struct MulParams {
  n: u32,
  batch_count: u32,
  mode: u32, // 0: X = U * diag(1/sqrt(d)) * U^T, 1: out = A * B, 2: out = X * A * X (uses temp)
  stride: u32,
};

@group(0) @binding(0) var<uniform> params: MulParams;
@group(0) @binding(1) var<storage, read> lhs: array<f32>;
@group(0) @binding(2) var<storage, read> rhs: array<f32>;
@group(0) @binding(3) var<storage, read_write> out_mat: array<f32>;

@compute @workgroup_size(64)
fn mat_op(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.batch_count * params.stride;
  if (idx >= total) { return; }
  let b = idx / params.stride;
  let local = idx % params.stride;
  let n = params.n;
  let r = local / n;
  let c = local % n;
  let base = b * params.stride;
  var acc = 0.0;
  if (params.mode == 0u) {
    // lhs = eigenvectors U, rhs = eigenvalues d (length batch*n)
    for (var k = 0u; k < n; k = k + 1u) {
      let dk = max(rhs[b * n + k], 1.0e-12);
      acc = acc + lhs[base + r * n + k] * (1.0 / sqrt(dk)) * lhs[base + c * n + k];
    }
  } else {
    // out = lhs * rhs
    for (var k = 0u; k < n; k = k + 1u) {
      acc = acc + lhs[base + r * n + k] * rhs[base + k * n + c];
    }
  }
  out_mat[idx] = acc;
}
`;

/**
 * Solve a batch of symmetric dense N x N eigenvalue problems `A v = λ v`
 * strictly on WebGPU. Fails closed without a real GPUDevice.
 */
export async function solveSymmetricEigenBatchedWebGpu(device, {
  matrices,
  n,
  batchCount = 1,
  maxSweeps = 32,
  tolerance = 1e-6,
  keepResident = false
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice');
  }
  const dim = Math.trunc(Number(n));
  const batches = Math.max(1, Math.trunc(Number(batchCount)));
  if (!(dim >= 1 && dim <= 256)) {
    throw new RangeError(`Unsupported matrix dimension n=${dim} (expected 1..256)`);
  }
  const stride = dim * dim;
  const totalFloats = batches * stride;
  const src = matrices instanceof Float32Array ? matrices : Float32Array.from(matrices);
  if (src.length !== totalFloats) {
    throw new RangeError(`Expected ${totalFloats} matrix floats for batch=${batches}, n=${dim}; got ${src.length}`);
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage')
  ];
  const pipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gpumath-jacobi-sym-batched.v1',
    label: 'ulg-gpumath-jacobi-sym-batched',
    code: batchedSymmetricEigensolverWgsl,
    entryPoint: 'jacobi_symmetric_batched',
    bindings
  });

  const paramsBufData = new ArrayBuffer(32);
  new Uint32Array(paramsBufData, 0, 4).set([dim, batches, Math.max(1, Math.trunc(maxSweeps)), stride]);
  new Float32Array(paramsBufData, 16, 4).set([Number(tolerance), 0, 0, 0]);

  const paramsBuf = device.createBuffer({
    label: 'ulg-gpumath-eig-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuf, 0, paramsBufData);

  const aBuf = device.createBuffer({
    label: 'ulg-gpumath-eig-a',
    size: Math.max(16, totalFloats * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  device.queue.writeBuffer(aBuf, 0, src);

  const vBuf = device.createBuffer({
    label: 'ulg-gpumath-eig-v',
    size: Math.max(16, totalFloats * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });

  const valsBuf = device.createBuffer({
    label: 'ulg-gpumath-eig-vals',
    size: Math.max(16, batches * dim * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });

  const bg = device.createBindGroup({
    layout: pipe.bindGroupLayout,
    entries: [paramsBuf, aBuf, vBuf, valsBuf].map((buffer, binding) => ({
      binding,
      resource: { buffer }
    }))
  });

  const encoder = device.createCommandEncoder({ label: 'ulg-gpumath-jacobi-eig' });
  const pass = encoder.beginComputePass({ label: 'ulg-gpumath-jacobi-eig-pass' });
  pass.setPipeline(pipe.pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(batches);
  pass.end();

  if (keepResident) {
    device.queue.submit([encoder.finish()]);
    paramsBuf.destroy();
    aBuf.destroy();
    return Object.freeze({
      schema: ULG_GPU_EIGENSOLVER_SCHEMA,
      backend: 'webgpu',
      n: dim,
      batchCount: batches,
      eigenvaluesBuffer: valsBuf,
      eigenvectorsBuffer: vBuf,
      destroy() {
        valsBuf.destroy();
        vBuf.destroy();
      }
    });
  }

  const readVals = device.createBuffer({
    label: 'ulg-gpumath-eig-read-vals',
    size: Math.max(16, batches * dim * 4),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const readVecs = device.createBuffer({
    label: 'ulg-gpumath-eig-read-vecs',
    size: Math.max(16, totalFloats * 4),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  encoder.copyBufferToBuffer(valsBuf, 0, readVals, 0, batches * dim * 4);
  encoder.copyBufferToBuffer(vBuf, 0, readVecs, 0, totalFloats * 4);
  device.queue.submit([encoder.finish()]);

  try {
    await Promise.all([
      readVals.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readVecs.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const eigenvalues = new Float32Array(readVals.getMappedRange().slice(0, batches * dim * 4));
    const eigenvectors = new Float32Array(readVecs.getMappedRange().slice(0, totalFloats * 4));
    readVals.unmap();
    readVecs.unmap();
    return Object.freeze({
      schema: ULG_GPU_EIGENSOLVER_SCHEMA,
      backend: 'webgpu',
      n: dim,
      batchCount: batches,
      eigenvalues,
      eigenvectors
    });
  } finally {
    for (const b of [paramsBuf, aBuf, vBuf, valsBuf, readVals, readVecs]) b.destroy();
  }
}

/**
 * Solve generalized symmetric-definite eigenvalue problem `F C = S C ε`
 * strictly on WebGPU via Löwdin symmetric orthogonalization (`X = S^{-1/2}`).
 */
export async function solveGeneralizedSymmetricEigenBatchedWebGpu(device, {
  fockMatrices,
  overlapMatrices,
  n,
  batchCount = 1,
  maxSweeps = 32,
  tolerance = 1e-6
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveGeneralizedSymmetricEigenBatchedWebGpu requires a live WebGPU GPUDevice');
  }
  const dim = Math.trunc(Number(n));
  const batches = Math.max(1, Math.trunc(Number(batchCount)));
  const stride = dim * dim;
  const totalFloats = batches * stride;
  const fSrc = fockMatrices instanceof Float32Array ? fockMatrices : Float32Array.from(fockMatrices);
  const sSrc = overlapMatrices instanceof Float32Array ? overlapMatrices : Float32Array.from(overlapMatrices);

  // 1. Diagonalize S on GPU (keep resident!)
  const sEig = await solveSymmetricEigenBatchedWebGpu(device, {
    matrices: sSrc,
    n: dim,
    batchCount: batches,
    maxSweeps,
    tolerance,
    keepResident: true
  });

  const mulBindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage')
  ];
  const mulPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gpumath-mat-op.v1',
    label: 'ulg-gpumath-mat-op',
    code: matMulTransformWgsl,
    entryPoint: 'mat_op',
    bindings: mulBindings
  });
  const jacobiBindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage')
  ];
  const jacobiPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-gpumath-jacobi-sym-batched.v1',
    label: 'ulg-gpumath-jacobi-sym-batched',
    code: batchedSymmetricEigensolverWgsl,
    entryPoint: 'jacobi_symmetric_batched',
    bindings: jacobiBindings
  });

  const mkU = (vals) => {
    const b = device.createBuffer({ size: 16, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    device.queue.writeBuffer(b, 0, new Uint32Array(vals));
    return b;
  };
  const uLowdin = mkU([dim, batches, 0, stride]);
  const uMul = mkU([dim, batches, 1, stride]);
  const eigParamsData = new ArrayBuffer(32);
  new Uint32Array(eigParamsData, 0, 4).set([dim, batches, maxSweeps, stride]);
  new Float32Array(eigParamsData, 16, 4).set([tolerance, 0, 0, 0]);
  const uEig = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(uEig, 0, eigParamsData);

  const bytes = Math.max(16, totalFloats * 4);
  const fBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(fBuf, 0, fSrc);
  const xBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE });
  const tmpBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE });
  const fPrimeBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE });
  const wBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE });
  const cBuf = device.createBuffer({ size: bytes, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const valsBuf = device.createBuffer({
    size: Math.max(16, batches * dim * 4),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const readVals = device.createBuffer({
    size: Math.max(16, batches * dim * 4),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const readC = device.createBuffer({
    size: bytes,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  const mkBg = (layout, bufs) => device.createBindGroup({
    layout,
    entries: bufs.map((buffer, binding) => ({ binding, resource: { buffer } }))
  });
  const bgX = mkBg(mulPipe.bindGroupLayout, [uLowdin, sEig.eigenvectorsBuffer, sEig.eigenvaluesBuffer, xBuf]);
  const bgXF = mkBg(mulPipe.bindGroupLayout, [uMul, xBuf, fBuf, tmpBuf]);
  const bgXFX = mkBg(mulPipe.bindGroupLayout, [uMul, tmpBuf, xBuf, fPrimeBuf]);
  const bgJac = mkBg(jacobiPipe.bindGroupLayout, [uEig, fPrimeBuf, wBuf, valsBuf]);
  const bgC = mkBg(mulPipe.bindGroupLayout, [uMul, xBuf, wBuf, cBuf]);

  const wgMul = Math.ceil(totalFloats / 64);
  const encoder = device.createCommandEncoder({ label: 'ulg-gpumath-gen-eig' });
  const pass = encoder.beginComputePass({ label: 'ulg-gpumath-gen-eig-pass' });
  pass.setPipeline(mulPipe.pipeline);
  pass.setBindGroup(0, bgX); pass.dispatchWorkgroups(wgMul);
  pass.setBindGroup(0, bgXF); pass.dispatchWorkgroups(wgMul);
  pass.setBindGroup(0, bgXFX); pass.dispatchWorkgroups(wgMul);
  pass.setPipeline(jacobiPipe.pipeline);
  pass.setBindGroup(0, bgJac); pass.dispatchWorkgroups(batches);
  pass.setPipeline(mulPipe.pipeline);
  pass.setBindGroup(0, bgC); pass.dispatchWorkgroups(wgMul);
  pass.end();
  encoder.copyBufferToBuffer(valsBuf, 0, readVals, 0, batches * dim * 4);
  encoder.copyBufferToBuffer(cBuf, 0, readC, 0, totalFloats * 4);
  device.queue.submit([encoder.finish()]);

  try {
    await Promise.all([
      readVals.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
      readC.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
    ]);
    const eigenvalues = new Float32Array(readVals.getMappedRange().slice(0, batches * dim * 4));
    const eigenvectors = new Float32Array(readC.getMappedRange().slice(0, totalFloats * 4));
    readVals.unmap();
    readC.unmap();
    return Object.freeze({
      schema: ULG_GPU_EIGENSOLVER_SCHEMA,
      backend: 'webgpu',
      generalized: true,
      n: dim,
      batchCount: batches,
      eigenvalues,
      eigenvectors
    });
  } finally {
    sEig.destroy();
    for (const b of [uLowdin, uMul, uEig, fBuf, xBuf, tmpBuf, fPrimeBuf, wBuf, cBuf, valsBuf, readVals, readC]) {
      b.destroy();
    }
  }
}
