// Gate 0B: Shared WebGPU 3D Radix-2 FFT / IFFT & 3D Spectral Poisson Solver
// (`src/runtime/gpuMath/fft3dWebGpu.js`).
//
// Reusable across 40 orders of magnitude:
//   - Gate 1 (10^-9 m): Periodic Bulk DFT Hartree / Poisson potential & XC grids
//   - Gate 5D (10^+25 m): Supergalactic FLRW Cosmological TreePM long-range gravity
//     and Zel'dovich P(k) initial-condition generation
// Zero CPU FFT fallback; runs fully parallel @workgroup_size(64) on WebGPU.

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_GPU_FFT3D_SCHEMA = 'ulg.gpumath.fft3d-webgpu.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

export const fft3dWebGpuWgsl = /* wgsl */ `
struct FftParams {
  n: u32,
  log_n: u32,
  axis: u32,      // 0 = X, 1 = Y, 2 = Z
  stage: u32,     // 0 .. log_n - 1
  direction: f32, // -1.0 for forward FFT, +1.0 for inverse IFFT
  scale: f32,     // normalization or box length L
  smooth_r2: f32, // optional Gaussian smoothing r_s^2 (for TreePM split)
  grad_axis: u32, // 0 = phi, 1 = dphi/dx, 2 = dphi/dy, 3 = dphi/dz
};

@group(0) @binding(0) var<uniform> params: FftParams;
@group(0) @binding(1) var<storage, read> src_grid: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> dst_grid: array<vec2<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn bit_reverse(val: u32, bits: u32) -> u32 {
  var x = val;
  var r = 0u;
  for (var i = 0u; i < bits; i = i + 1u) {
    r = (r << 1u) | (x & 1u);
    x = x >> 1u;
  }
  return r;
}

fn c_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

fn grid_idx(x: u32, y: u32, z: u32, n: u32) -> u32 {
  return (z * n + y) * n + x;
}

@compute @workgroup_size(64)
fn bitrev_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  let x = idx % n;
  let y = (idx / n) % n;
  let z = idx / (n * n);
  var sx = x;
  var sy = y;
  var sz = z;
  if (params.axis == 0u) {
    sx = bit_reverse(x, params.log_n);
  } else if (params.axis == 1u) {
    sy = bit_reverse(y, params.log_n);
  } else {
    sz = bit_reverse(z, params.log_n);
  }
  dst_grid[idx] = src_grid[grid_idx(sx, sy, sz, n)];
}

@compute @workgroup_size(64)
fn butterfly_axis(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let half_total = (n * n * n) >> 1u;
  let b_idx = id.x;
  if (b_idx >= half_total) { return; }

  let half_n = n >> 1u;
  let pair_in_line = b_idx % half_n;
  let line_id = b_idx / half_n;
  let line_a = line_id % n;
  let line_b = line_id / n;

  let m = 1u << (params.stage + 1u);
  let half_m = m >> 1u;
  let group = pair_in_line / half_m;
  let j = pair_in_line % half_m;
  let i0 = group * m + j;
  let i1 = i0 + half_m;

  var p0: u32;
  var p1: u32;
  if (params.axis == 0u) {
    p0 = grid_idx(i0, line_a, line_b, n);
    p1 = grid_idx(i1, line_a, line_b, n);
  } else if (params.axis == 1u) {
    p0 = grid_idx(line_a, i0, line_b, n);
    p1 = grid_idx(line_a, i1, line_b, n);
  } else {
    p0 = grid_idx(line_a, line_b, i0, n);
    p1 = grid_idx(line_a, line_b, i1, n);
  }

  let angle = params.direction * TWO_PI * f32(j) / f32(m);
  let twiddle = vec2<f32>(cos(angle), sin(angle));
  let u = src_grid[p0];
  let t = c_mul(twiddle, src_grid[p1]);
  dst_grid[p0] = u + t;
  dst_grid[p1] = u - t;
}

@compute @workgroup_size(64)
fn scale_grid(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  dst_grid[idx] = src_grid[idx] * params.scale;
}

// Spectral 3D Poisson kernel in k-space for periodic box length L = params.scale:
//   nabla^2 phi = rhs  ==>  phi_hat(k) = -rhs_hat(k) / |k|^2 * exp(-|k|^2 * smooth_r2)
//   grad_axis == 1,2,3 computes d(phi)/d(x_axis) = i * k_axis * phi_hat(k)
@compute @workgroup_size(64)
fn poisson_kspace(@builtin(global_invocation_id) id: vec3<u32>) {
  let n = params.n;
  let total = n * n * n;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % n;
  let iy = (idx / n) % n;
  let iz = idx / (n * n);
  if (ix == 0u && iy == 0u && iz == 0u) {
    dst_grid[idx] = vec2<f32>(0.0, 0.0);
    return;
  }
  let half_n = n >> 1u;
  let nx = select(f32(ix), f32(ix) - f32(n), ix >= half_n);
  let ny = select(f32(iy), f32(iy) - f32(n), iy >= half_n);
  let nz = select(f32(iz), f32(iz) - f32(n), iz >= half_n);
  let dk = TWO_PI / max(params.scale, 1.0e-30);
  let kx = nx * dk;
  let ky = ny * dk;
  let kz = nz * dk;
  let k2 = kx * kx + ky * ky + kz * kz;
  let gauss_win = select(1.0, exp(-k2 * params.smooth_r2), params.smooth_r2 > 0.0);
  let green = -(gauss_win / k2);
  let rhs_k = src_grid[idx];
  let phi_k = rhs_k * green;
  if (params.grad_axis == 0u) {
    dst_grid[idx] = phi_k;
  } else {
    let k_comp = select(select(kz, ky, params.grad_axis == 2u), kx, params.grad_axis == 1u);
    // Multiply by i * k_comp: i*(a + ib) = (-b + ia)
    dst_grid[idx] = vec2<f32>(-phi_k.y * k_comp, phi_k.x * k_comp);
  }
}
`;

function assertPowerOfTwoGrid(n) {
  const dim = Math.trunc(Number(n));
  if (!(dim >= 4 && dim <= 128 && (dim & (dim - 1)) === 0)) {
    throw new RangeError(`fft3dWebGpu requires power-of-2 N in [4..128], got ${n}`);
  }
  return { dim, logN: Math.round(Math.log2(dim)) };
}

function createFft3dPipelines(device) {
  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage')
  ];
  return {
    bitrev: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-gpumath-fft3d-bitrev.v1',
      label: 'ulg-gpumath-fft3d-bitrev',
      code: fft3dWebGpuWgsl,
      entryPoint: 'bitrev_axis',
      bindings
    }),
    butterfly: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-gpumath-fft3d-butterfly.v1',
      label: 'ulg-gpumath-fft3d-butterfly',
      code: fft3dWebGpuWgsl,
      entryPoint: 'butterfly_axis',
      bindings
    }),
    scale: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-gpumath-fft3d-scale.v1',
      label: 'ulg-gpumath-fft3d-scale',
      code: fft3dWebGpuWgsl,
      entryPoint: 'scale_grid',
      bindings
    }),
    poisson: createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-gpumath-fft3d-poisson.v1',
      label: 'ulg-gpumath-fft3d-poisson',
      code: fft3dWebGpuWgsl,
      entryPoint: 'poisson_kspace',
      bindings
    })
  };
}

/**
 * Reusable GPU-resident 3D FFT / IFFT / Poisson workspace.
 * Pre-allocates all uniform and ping-pong buffers ONCE so repeated DFT SCF
 * iterations or cosmological TreePM steps execute with ZERO per-step allocations!
 */
export function createFft3dWorkspaceWebGpu(device, n) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createFft3dWorkspaceWebGpu requires a live WebGPU GPUDevice');
  }
  const { dim, logN } = assertPowerOfTwoGrid(n);
  const total = dim * dim * dim;
  const byteLength = total * 8; // vec2<f32>
  const pipes = createFft3dPipelines(device);
  const layout = pipes.butterfly.bindGroupLayout;

  const bufA = device.createBuffer({
    label: `ulg-fft3d-${dim}-a`,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  const bufB = device.createBuffer({
    label: `ulg-fft3d-${dim}-b`,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });

  const ownedUniforms = [];
  const makeUniform = (axis, stage, direction, scale = 1, smoothR2 = 0, gradAxis = 0) => {
    const ab = new ArrayBuffer(32);
    new Uint32Array(ab, 0, 4).set([dim, logN, axis, stage]);
    new Float32Array(ab, 16, 3).set([direction, scale, smoothR2]);
    new Uint32Array(ab, 28, 1).set([gradAxis]);
    const buf = device.createBuffer({
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(buf, 0, ab);
    ownedUniforms.push(buf);
    return buf;
  };
  const mkBg = (uBuf, src, dst) => device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: { buffer: src } },
      { binding: 2, resource: { buffer: dst } }
    ]
  });

  // Pre-build forward and inverse stage lists (zero per-step bind-group churn!)
  const buildPlan = (direction) => {
    const steps = [];
    let curIn = bufA;
    let curOut = bufB;
    const swap = () => { const t = curIn; curIn = curOut; curOut = t; };
    for (let axis = 0; axis < 3; axis += 1) {
      const uRev = makeUniform(axis, 0, direction);
      steps.push({ pipeline: pipes.bitrev.pipeline, bg: mkBg(uRev, curIn, curOut), wg: Math.ceil(total / 64) });
      swap();
      for (let s = 0; s < logN; s += 1) {
        const uBf = makeUniform(axis, s, direction);
        steps.push({ pipeline: pipes.butterfly.pipeline, bg: mkBg(uBf, curIn, curOut), wg: Math.ceil((total >> 1) / 64) });
        swap();
      }
    }
    if (direction > 0) {
      const uScale = makeUniform(0, 0, 1, 1 / total);
      steps.push({ pipeline: pipes.scale.pipeline, bg: mkBg(uScale, curIn, curOut), wg: Math.ceil(total / 64) });
      swap();
    }
    return { steps, outputBuffer: curIn, scratchBuffer: curOut };
  };

  const forwardPlan = buildPlan(-1);
  // Inverse plan starting from forwardPlan.outputBuffer
  const buildPlanFrom = (direction, startBuf, otherBuf) => {
    const steps = [];
    let curIn = startBuf;
    let curOut = otherBuf;
    const swap = () => { const t = curIn; curIn = curOut; curOut = t; };
    for (let axis = 0; axis < 3; axis += 1) {
      const uRev = makeUniform(axis, 0, direction);
      steps.push({ pipeline: pipes.bitrev.pipeline, bg: mkBg(uRev, curIn, curOut), wg: Math.ceil(total / 64) });
      swap();
      for (let s = 0; s < logN; s += 1) {
        const uBf = makeUniform(axis, s, direction);
        steps.push({ pipeline: pipes.butterfly.pipeline, bg: mkBg(uBf, curIn, curOut), wg: Math.ceil((total >> 1) / 64) });
        swap();
      }
    }
    if (direction > 0) {
      const uScale = makeUniform(0, 0, 1, 1 / total);
      steps.push({ pipeline: pipes.scale.pipeline, bg: mkBg(uScale, curIn, curOut), wg: Math.ceil(total / 64) });
      swap();
    }
    return { steps, outputBuffer: curIn, scratchBuffer: curOut };
  };
  const inverseFromA = buildPlanFrom(1, bufA, bufB);
  const inverseFromB = buildPlanFrom(1, bufB, bufA);

  const poissonUniform = device.createBuffer({
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  ownedUniforms.push(poissonUniform);
  const bgPoissonAB = mkBg(poissonUniform, bufA, bufB);
  const bgPoissonBA = mkBg(poissonUniform, bufB, bufA);

  // Pre-allocated per-axis Poisson uniform slots (0=phi, 1=dx, 2=dy, 3=dz) so callers
  // (e.g. Gate 5D TreePM) can run ONE forward FFT followed by all 3 spectral gradients +
  // inverse FFTs inside ONE single CommandEncoder & ONE queue.submit!
  const axisPoissonUniforms = [0, 1, 2, 3].map(() => {
    const buf = device.createBuffer({
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    ownedUniforms.push(buf);
    return buf;
  });
  const bgAxisPoissonFromA = axisPoissonUniforms.map((uBuf) => mkBg(uBuf, bufA, bufB));
  const bgAxisPoissonFromB = axisPoissonUniforms.map((uBuf) => mkBg(uBuf, bufB, bufA));
  const kSpaceBgCache = new WeakMap();

  function getAxisPoissonBgFromExternal(kSrcBuffer, axisIdx) {
    let list = kSpaceBgCache.get(kSrcBuffer);
    if (!list) {
      list = axisPoissonUniforms.map((uBuf) => mkBg(uBuf, kSrcBuffer, bufA));
      kSpaceBgCache.set(kSrcBuffer, list);
    }
    return list[axisIdx];
  }

  function encodePlan(encoder, plan, label) {
    const pass = encoder.beginComputePass({ label });
    for (const step of plan.steps) {
      pass.setPipeline(step.pipeline);
      pass.setBindGroup(0, step.bg);
      pass.dispatchWorkgroups(step.wg);
    }
    pass.end();
    return plan.outputBuffer;
  }

  function writeAxisPoissonUniform(axisIdx, { boxLength = 1, smoothR2 = 0 } = {}) {
    const ab = new ArrayBuffer(32);
    new Uint32Array(ab, 0, 4).set([dim, logN, 0, 0]);
    new Float32Array(ab, 16, 3).set([-1, Number(boxLength), Number(smoothR2)]);
    new Uint32Array(ab, 28, 1).set([axisIdx]);
    device.queue.writeBuffer(axisPoissonUniforms[axisIdx], 0, ab);
  }

  return Object.freeze({
    schema: ULG_GPU_FFT3D_SCHEMA,
    n: dim,
    total,
    byteLength,
    inputBuffer: bufA,
    bufferA: bufA,
    bufferB: bufB,
    forwardOutputBuffer: forwardPlan.outputBuffer,
    encodeForward(encoder) {
      return encodePlan(encoder, forwardPlan, `ulg-fft3d-fwd-${dim}`);
    },
    encodeInverseFrom(encoder, srcBuffer) {
      const plan = srcBuffer === bufA ? inverseFromA : inverseFromB;
      return encodePlan(encoder, plan, `ulg-fft3d-inv-${dim}`);
    },
    writeAxisPoissonParams({ boxLength = 1, smoothR2 = 0 } = {}) {
      for (let ax = 0; ax <= 3; ax += 1) {
        writeAxisPoissonUniform(ax, { boxLength, smoothR2 });
      }
    },
    /**
     * Apply spectral Green's function + gradient (`gradAxis` 0..3) directly from an
     * ALREADY-transformed k-space buffer (`kSrcBuffer`, e.g. saved copy of `forwardOutputBuffer`)
     * into `bufA` and immediately encode the inverse 3D FFT — ZERO redundant forward FFTs,
     * allowing all 3 axes to fuse into ONE CommandEncoder & ONE `queue.submit`!
     */
    encodePoissonInverseFromKSpace(encoder, kSrcBuffer, { gradAxis = 0 } = {}) {
      const ax = Math.max(0, Math.min(3, Math.trunc(gradAxis)));
      let bg;
      let phiKBuf;
      if (kSrcBuffer === bufA) {
        bg = bgAxisPoissonFromA[ax];
        phiKBuf = bufB;
      } else if (kSrcBuffer === bufB) {
        bg = bgAxisPoissonFromB[ax];
        phiKBuf = bufA;
      } else {
        bg = getAxisPoissonBgFromExternal(kSrcBuffer, ax);
        phiKBuf = bufA;
      }
      const pPass = encoder.beginComputePass({ label: `ulg-poisson-kspace-ax${ax}-${dim}` });
      pPass.setPipeline(pipes.poisson.pipeline);
      pPass.setBindGroup(0, bg);
      pPass.dispatchWorkgroups(Math.ceil(total / 64));
      pPass.end();
      return encodePlan(encoder, phiKBuf === bufA ? inverseFromA : inverseFromB, `ulg-poisson-inv-ax${ax}-${dim}`);
    },
    /**
     * Encode `phi = Poisson^{-1}(rhs)` in-workspace starting from `bufA` = complex rhs.
     * Returns the GPUBuffer holding the real-space solution (real part in `.x`).
     */
    encodePoissonSolve(encoder, { boxLength = 1, smoothR2 = 0, gradAxis = 0 } = {}) {
      const ab = new ArrayBuffer(32);
      new Uint32Array(ab, 0, 4).set([dim, logN, 0, 0]);
      new Float32Array(ab, 16, 3).set([-1, Number(boxLength), Number(smoothR2)]);
      new Uint32Array(ab, 28, 1).set([Math.trunc(gradAxis)]);
      device.queue.writeBuffer(poissonUniform, 0, ab);

      const kBuf = encodePlan(encoder, forwardPlan, `ulg-poisson-fwd-${dim}`);
      const pPass = encoder.beginComputePass({ label: `ulg-poisson-kspace-${dim}` });
      pPass.setPipeline(pipes.poisson.pipeline);
      pPass.setBindGroup(0, kBuf === bufA ? bgPoissonAB : bgPoissonBA);
      pPass.dispatchWorkgroups(Math.ceil(total / 64));
      pPass.end();
      const phiKBuf = kBuf === bufA ? bufB : bufA;
      return encodePlan(encoder, phiKBuf === bufA ? inverseFromA : inverseFromB, `ulg-poisson-inv-${dim}`);
    },
    destroy() {
      bufA.destroy();
      bufB.destroy();
      for (const u of ownedUniforms) u.destroy();
    }
  });
}

/**
 * Convenience single-shot 3D FFT or IFFT on WebGPU.
 */
export async function fft3dWebGpu(device, { data, n, inverse = false } = {}) {
  const ws = createFft3dWorkspaceWebGpu(device, n);
  const src = data instanceof Float32Array ? data : Float32Array.from(data);
  if (src.length !== ws.total * 2) {
    ws.destroy();
    throw new RangeError(`Expected ${ws.total * 2} complex floats for N=${n}, got ${src.length}`);
  }
  const readBuf = device.createBuffer({
    size: ws.byteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(ws.inputBuffer, 0, src);
    const enc = device.createCommandEncoder({ label: 'ulg-fft3d-oneshot' });
    const outBuf = inverse ? ws.encodeInverseFrom(enc, ws.inputBuffer) : ws.encodeForward(enc);
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, ws.byteLength);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const out = new Float32Array(readBuf.getMappedRange().slice(0, ws.byteLength));
    readBuf.unmap();
    return Object.freeze({
      schema: ULG_GPU_FFT3D_SCHEMA,
      backend: 'webgpu',
      n: ws.n,
      inverse: Boolean(inverse),
      data: out
    });
  } finally {
    readBuf.destroy();
    ws.destroy();
  }
}

/**
 * Solve 3D periodic Poisson equation `∇²φ = rhs` strictly on WebGPU via 3D FFT.
 */
export async function solvePoisson3dWebGpu(device, {
  rhsReal,
  n,
  boxLength = 1,
  smoothR2 = 0,
  gradAxis = 0
} = {}) {
  const ws = createFft3dWorkspaceWebGpu(device, n);
  const rhsComplex = new Float32Array(ws.total * 2);
  for (let i = 0; i < ws.total; i += 1) rhsComplex[i * 2] = Number(rhsReal[i]) || 0;
  const readBuf = device.createBuffer({
    size: ws.byteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(ws.inputBuffer, 0, rhsComplex);
    const enc = device.createCommandEncoder({ label: 'ulg-poisson3d-oneshot' });
    const outBuf = ws.encodePoissonSolve(enc, { boxLength, smoothR2, gradAxis });
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, ws.byteLength);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const raw = new Float32Array(readBuf.getMappedRange().slice(0, ws.byteLength));
    readBuf.unmap();
    const real = new Float32Array(ws.total);
    for (let i = 0; i < ws.total; i += 1) real[i] = raw[i * 2];
    return Object.freeze({
      schema: ULG_GPU_FFT3D_SCHEMA,
      backend: 'webgpu',
      n: ws.n,
      boxLength: Number(boxLength),
      gradAxis,
      solutionReal: real
    });
  } finally {
    readBuf.destroy();
    ws.destroy();
  }
}
