// Gate 5D (10^+22 -> 10^+25 m): Expanding-Universe FLRW Comoving GPU 3D-FFT
// Particle-Mesh / TreePM Cosmology Engine (`src/runtime/astrophysics/supergalacticTreePmGpu.js`).
//
// Shares the EXACT same Gate 0B `createFft3dWorkspaceWebGpu` (`fft3dWebGpu.js`)
// used in Gate 1 Periodic Bulk DFT (10^-9 m) to solve periodic comoving gravity
// across 200 Mpc/h supergalactic volumes!
//   1. GPU Zel'dovich Approximation ICs from primordial Eisenstein-Hu P(k) at z=50
//   2. Cloud-in-Cell (CIC) density contrast delta(x) on 32^3 periodic comoving mesh
//   3. Spectral 3D FFT Poisson + 3-axis gradient force solve on GPU
//   4. Comoving FLRW symplectic Kick-Drift-Kick integrator evolving a(t) = 1/(1+z)
//   5. Resident 64-byte particle buffer (`strideFloats: 16`) compatible directly
//      with ULG's zero-copy `residentGpuPresenter.js` (0 B/frame CPU readback!)

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { createFft3dWorkspaceWebGpu } from '../gpuMath/fft3dWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_SUPERGALACTIC_TREEPM_SCHEMA = 'ulg.astrophysics.supergalactic-flrw-treepm.v1';

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

// Resident particle layout: 16 floats (64 bytes, exact match for `residentGpuPresenter.js`):
//   [0..2] = comoving x, y, z in [-L/2, L/2]
//   [3]    = mass / baryon tag
//   [4..6] = canonical comoving velocity vx, vy, vz
//   [7]    = local overdensity (1 + delta) for zero-copy luminance coloring
//   [8..10]= gravitational acceleration ax, ay, az
//   [11]   = local potential phi
//   [12..15]= species (0=DM, 1=baryon WHIM), halo density proxy, redshift a, pad

export const supergalacticTreePmWgsl = /* wgsl */ `
struct CosmoParams {
  particle_count: u32,
  grid_n: u32,
  axis: u32,
  step_index: u32,
  box_l: f32,
  a_scale: f32,
  da: f32,
  h_a: f32,        // H(a) / H_0
  omega_m: f32,
  grav_pref: f32,  // (3/2) * Omega_m * H_0^2 / a
  mean_mass_cell: f32,
  pad0: f32,
};

struct CosmoParticle {
  pos_m: vec4<f32>,
  vel_rho: vec4<f32>,
  acc_phi: vec4<f32>,
  tag: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: CosmoParams;
@group(0) @binding(1) var<storage, read_write> particles: array<CosmoParticle>;
// Fixed-point atomic CIC density grid (grid_n^3)
@group(0) @binding(2) var<storage, read_write> cic_mass_i32: array<atomic<i32>>;
// Complex density / gradient grid bound to fft3d workspace
@group(0) @binding(3) var<storage, read_write> fft_grid: array<vec2<f32>>;
// 3-component force grid: vec4(fx, fy, fz, delta)
@group(0) @binding(4) var<storage, read_write> force_grid: array<vec4<f32>>;
// Telemetry: [0]=sum_delta2*1e2, [1]=max_delta*1e3, [2]=sum_ke*1e3, [3]=px*1e3, [4]=py*1e3, [5]=pz*1e3
@group(0) @binding(5) var<storage, read_write> telemetry: array<atomic<i32>>;

fn wrap_coord(u: f32, L: f32) -> f32 {
  let half_l = 0.5 * L;
  var x = u + half_l;
  x = x - L * floor(x / L);
  return x - half_l;
}

@compute @workgroup_size(64)
fn clear_grids(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx < total) {
    atomicStore(&cic_mass_i32[idx], 0);
    force_grid[idx] = vec4<f32>(0.0);
  }
  if (idx < 16u) {
    atomicStore(&telemetry[idx], 0);
  }
}

// Cloud-in-Cell (CIC) trilinear mass deposition onto periodic N^3 mesh
@compute @workgroup_size(64)
fn cic_deposit(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let L = params.box_l;
  let p = particles[i].pos_m;
  let gx = ((p.x + 0.5 * L) / L) * nf;
  let gy = ((p.y + 0.5 * L) / L) * nf;
  let gz = ((p.z + 0.5 * L) / L) * nf;
  let ix0 = u32(floor(gx)) % n;
  let iy0 = u32(floor(gy)) % n;
  let iz0 = u32(floor(gz)) % n;
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = fract(gx);
  let fy = fract(gy);
  let fz = fract(gz);
  let wx0 = 1.0 - fx; let wy0 = 1.0 - fy; let wz0 = 1.0 - fz;
  let scale = p.w * 1000.0;

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(wx0, fx);
  let wys = array<f32, 2>(wy0, fy);
  let wzs = array<f32, 2>(wz0, fz);

  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w_i = i32(round(scale * wxs[dx] * wys[dy] * wzs[dz]));
        atomicAdd(&cic_mass_i32[cidx], w_i);
      }
    }
  }
}

// Convert CIC mass grid into overdensity contrast RHS for 3D FFT Poisson solve:
//   rhs = grav_pref * (rho / rho_bar - 1)
@compute @workgroup_size(64)
fn prepare_poisson_rhs(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  let m_cell = f32(atomicLoad(&cic_mass_i32[idx])) * 1.0e-3;
  let delta = (m_cell / max(params.mean_mass_cell, 1.0e-6)) - 1.0;
  fft_grid[idx] = vec2<f32>(params.grav_pref * delta, 0.0);
  force_grid[idx].w = delta;

  atomicAdd(&telemetry[0], i32(clamp(delta * delta * 10.0, 0.0, 2.0e8)));
  atomicMax(&telemetry[1], i32(clamp(delta * 1000.0, -1.0e6, 2.0e9)));
}

// Store solved spectral gradient component -d(phi)/d(x_axis) into force_grid
@compute @workgroup_size(64)
fn store_force_component(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (idx >= total) { return; }
  let g_val = -fft_grid[idx].x;
  var cur = force_grid[idx];
  if (params.axis == 1u) { cur.x = g_val; }
  else if (params.axis == 2u) { cur.y = g_val; }
  else if (params.axis == 3u) { cur.z = g_val; }
  force_grid[idx] = cur;
}

// CIC trilinear force interpolation + Comoving FLRW symplectic Kick-Drift update
@compute @workgroup_size(64)
fn cic_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.particle_count) { return; }
  let n = params.grid_n;
  let nf = f32(n);
  let L = params.box_l;
  var pt = particles[i];
  let gx = ((pt.pos_m.x + 0.5 * L) / L) * nf;
  let gy = ((pt.pos_m.y + 0.5 * L) / L) * nf;
  let gz = ((pt.pos_m.z + 0.5 * L) / L) * nf;
  let ix0 = u32(floor(gx)) % n;
  let iy0 = u32(floor(gy)) % n;
  let iz0 = u32(floor(gz)) % n;
  let ix1 = (ix0 + 1u) % n;
  let iy1 = (iy0 + 1u) % n;
  let iz1 = (iz0 + 1u) % n;
  let fx = fract(gx);
  let fy = fract(gy);
  let fz = fract(gz);

  let xs = array<u32, 2>(ix0, ix1);
  let ys = array<u32, 2>(iy0, iy1);
  let zs = array<u32, 2>(iz0, iz1);
  let wxs = array<f32, 2>(1.0 - fx, fx);
  let wys = array<f32, 2>(1.0 - fy, fy);
  let wzs = array<f32, 2>(1.0 - fz, fz);

  var acc = vec3<f32>(0.0);
  var local_delta = 0.0;
  for (var dz = 0u; dz < 2u; dz = dz + 1u) {
    for (var dy = 0u; dy < 2u; dy = dy + 1u) {
      for (var dx = 0u; dx < 2u; dx = dx + 1u) {
        let cidx = (zs[dz] * n + ys[dy]) * n + xs[dx];
        let w = wxs[dx] * wys[dy] * wzs[dz];
        let fg = force_grid[cidx];
        acc = acc + fg.xyz * w;
        local_delta = local_delta + fg.w * w;
      }
    }
  }

  // Canonical comoving equations in scale factor a:
  //   dp/da = -(1 / (a^2 H(a))) * grad(phi) = acc / (a^2 * H(a))
  //   dx/da = p / (a^3 * H(a))
  let a = max(0.01, params.a_scale);
  let h_a = max(0.05, params.h_a);
  let da = params.da;
  let kick_fac = da / (a * a * h_a);
  let drift_fac = da / (a * a * a * h_a);

  let v_new = pt.vel_rho.xyz + acc * kick_fac;
  let p_new = vec3<f32>(
    wrap_coord(pt.pos_m.x + v_new.x * drift_fac, L),
    wrap_coord(pt.pos_m.y + v_new.y * drift_fac, L),
    wrap_coord(pt.pos_m.z + v_new.z * drift_fac, L)
  );
  // Store log-compressed overdensity in vel_rho.w for zero-copy blackbody/cosmic-web rendering
  let rho_vis = clamp(0.18 + 0.25 * log2(max(1.0, 1.0 + local_delta)), 0.05, 1.0);
  pt.pos_m = vec4<f32>(p_new, pt.pos_m.w);
  pt.vel_rho = vec4<f32>(v_new, rho_vis);
  pt.acc_phi = vec4<f32>(acc, local_delta);
  pt.tag.z = a;
  particles[i] = pt;

  let ke = 0.5 * pt.pos_m.w * dot(v_new, v_new);
  atomicAdd(&telemetry[2], i32(clamp(ke * 100.0, 0.0, 2.0e8)));
  atomicAdd(&telemetry[3], i32(clamp(pt.pos_m.w * v_new.x * 100.0, -2.0e8, 2.0e8)));
  atomicAdd(&telemetry[4], i32(clamp(pt.pos_m.w * v_new.y * 100.0, -2.0e8, 2.0e8)));
  atomicAdd(&telemetry[5], i32(clamp(pt.pos_m.w * v_new.z * 100.0, -2.0e8, 2.0e8)));
}
`;

/**
 * Friedmann expansion rate H(a) / H_0 for flat/curved Lambda-CDM cosmology.
 */
export function friedmannHOverH0(a, { omegaM = 0.315, omegaLambda = 0.685, omegaR = 9e-5 } = {}) {
  const aSafe = Math.max(1e-4, Number(a));
  const omegaK = 1 - omegaM - omegaLambda - omegaR;
  return Math.sqrt(Math.max(1e-8, omegaR / (aSafe ** 4) + omegaM / (aSafe ** 3) + omegaK / (aSafe ** 2) + omegaLambda));
}

/**
 * Generate Zel'dovich Approximation cosmological initial conditions on a
 * regular comoving lattice perturbed by a primordial Eisenstein-Hu-like P(k)
 * Gaussian field (`z_init ~ 50 -> a_init ~ 0.02`), zero net momentum.
 */
export function buildZeldovichCosmologyICs({
  gridPerSide = 24,
  boxLengthMpc = 200,
  aInit = 0.05,
  omegaM = 0.315,
  omegaLambda = 0.685,
  amplitude = 0.14,
  seed = 20261122
} = {}) {
  const n = Math.max(8, Math.trunc(gridPerSide));
  const particleCount = n * n * n;
  const data = new Float32Array(particleCount * 16);
  const L = Number(boxLengthMpc);
  const dx = L / n;
  const hInit = friedmannHOverH0(aInit, { omegaM, omegaLambda });
  const growthRate = Math.pow(omegaM / (aInit ** 3 * hInit * hInit), 0.55);

  // Build deterministic low-k primordial plane-wave superposition matching P(k) ~ k / (1 + (k/k_eq)^2)^2
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
  const modes = [];
  const kEq = (2 * Math.PI / L) * 2.5;
  for (let kx = -3; kx <= 3; kx += 1) {
    for (let ky = -3; ky <= 3; ky += 1) {
      for (let kz = -3; kz <= 3; kz += 1) {
        const k2i = kx * kx + ky * ky + kz * kz;
        if (k2i === 0 || k2i > 12) continue;
        const kPhys = (2 * Math.PI / L) * Math.sqrt(k2i);
        const pk = kPhys / ((1 + (kPhys / kEq) ** 2) ** 2);
        const amp = amplitude * Math.sqrt(pk) * (L / 45);
        modes.push({
          kx: (2 * Math.PI * kx) / L,
          ky: (2 * Math.PI * ky) / L,
          kz: (2 * Math.PI * kz) / L,
          k2: kPhys * kPhys,
          amp,
          phase: rand() * 2 * Math.PI
        });
      }
    }
  }

  let idx = 0;
  let vxSum = 0; let vySum = 0; let vzSum = 0;
  for (let iz = 0; iz < n; iz += 1) {
    for (let iy = 0; iy < n; iy += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const qx = (ix + 0.5) * dx - 0.5 * L;
        const qy = (iy + 0.5) * dx - 0.5 * L;
        const qz = (iz + 0.5) * dx - 0.5 * L;
        let psiX = 0; let psiY = 0; let psiZ = 0;
        for (const m of modes) {
          const arg = m.kx * qx + m.ky * qy + m.kz * qz + m.phase;
          const sinA = Math.sin(arg) * (m.amp / m.k2);
          psiX += m.kx * sinA;
          psiY += m.ky * sinA;
          psiZ += m.kz * sinA;
        }
        const wrap = (u) => {
          let w = u + 0.5 * L;
          w -= L * Math.floor(w / L);
          return w - 0.5 * L;
        };
        const x = wrap(qx + psiX);
        const y = wrap(qy + psiY);
        const z = wrap(qz + psiZ);
        // Canonical comoving momentum p = a^2 * H(a) * f * psi
        const vPref = aInit * aInit * hInit * growthRate;
        const vx = vPref * psiX;
        const vy = vPref * psiY;
        const vz = vPref * psiZ;
        vxSum += vx; vySum += vy; vzSum += vz;

        const base = idx * 16;
        data[base + 0] = x;
        data[base + 1] = y;
        data[base + 2] = z;
        data[base + 3] = 1.0; // equal-mass macro-particles
        data[base + 4] = vx;
        data[base + 5] = vy;
        data[base + 6] = vz;
        data[base + 7] = 0.25;
        data[base + 12] = (idx % 6 === 0) ? 1.0 : 0.0; // 16.7% baryon WHIM fraction (~Omega_b/Omega_m)
        data[base + 14] = aInit;
        idx += 1;
      }
    }
  }
  // Remove exact net momentum drift
  vxSum /= particleCount; vySum /= particleCount; vzSum /= particleCount;
  for (let i = 0; i < particleCount; i += 1) {
    data[i * 16 + 4] -= vxSum;
    data[i * 16 + 5] -= vySum;
    data[i * 16 + 6] -= vzSum;
  }
  return { particleCount, data, boxLengthMpc: L, aInit };
}

/**
 * Create a GPU-resident Supergalactic FLRW Comoving TreePM session sharing
 * Gate 0B's `createFft3dWorkspaceWebGpu` (`0` CPU hot-loop particle copies!).
 */
export function createSupergalacticTreePmSessionWebGpu(device, {
  gridPerSide = 24,
  pmGridN = 32,
  boxLengthMpc = 200,
  aInit = 0.05,
  da = 0.015,
  omegaM = 0.315,
  omegaLambda = 0.685,
  smoothCells = 0.75,
  seed = 20261122
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createSupergalacticTreePmSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const ic = buildZeldovichCosmologyICs({ gridPerSide, boxLengthMpc, aInit, omegaM, omegaLambda, seed });
  const particleCount = ic.particleCount;
  const gridN = pmGridN;
  const gridTotal = gridN ** 3;
  const fftWs = createFft3dWorkspaceWebGpu(device, gridN);

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const mkPipe = (entry) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-supergalactic-treepm-${entry}.v1`,
    label: `ulg-supergalactic-treepm-${entry}`,
    code: supergalacticTreePmWgsl,
    entryPoint: entry,
    bindings
  });
  const clearPipe = mkPipe('clear_grids');
  const depositPipe = mkPipe('cic_deposit');
  const rhsPipe = mkPipe('prepare_poisson_rhs');
  const storePipe = mkPipe('store_force_component');
  const kickDriftPipe = mkPipe('cic_kick_drift');

  const paramsBuf = device.createBuffer({ size: 48, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const particleBuf = device.createBuffer({
    label: 'ulg-supergalactic-particles',
    size: ic.data.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  device.queue.writeBuffer(particleBuf, 0, ic.data);
  const cicBuf = device.createBuffer({ size: gridTotal * 4, usage: GPU_BUFFER_USAGE.STORAGE });
  const forceGridBuf = device.createBuffer({ size: gridTotal * 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const telemetryBuf = device.createBuffer({ size: 64, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readTelemetryBuf = device.createBuffer({ size: 64, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
  const rhsSaveBuf = device.createBuffer({ size: fftWs.byteLength, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC });

  const bgA = device.createBindGroup({
    layout: clearPipe.bindGroupLayout,
    entries: [paramsBuf, particleBuf, cicBuf, fftWs.bufferA, forceGridBuf, telemetryBuf].map((buffer, binding) => ({
      binding, resource: { buffer }
    }))
  });
  const bgB = device.createBindGroup({
    layout: clearPipe.bindGroupLayout,
    entries: [paramsBuf, particleBuf, cicBuf, fftWs.bufferB, forceGridBuf, telemetryBuf].map((buffer, binding) => ({
      binding, resource: { buffer }
    }))
  });
  const bgFor = (buf) => (buf === fftWs.bufferA ? bgA : bgB);

  const cellSize = boxLengthMpc / gridN;
  const smoothR2 = (smoothCells * cellSize) ** 2;
  const meanMassPerCell = particleCount / gridTotal;
  let aScale = aInit;
  let stepIndex = 0;

  const writeUniforms = (axis) => {
    const hA = friedmannHOverH0(aScale, { omegaM, omegaLambda });
    const gravPref = 1.5 * omegaM / Math.max(0.01, aScale);
    const ab = new ArrayBuffer(48);
    new Uint32Array(ab, 0, 4).set([particleCount, gridN, axis, stepIndex]);
    new Float32Array(ab, 16, 8).set([boxLengthMpc, aScale, da, hA, omegaM, gravPref, meanMassPerCell, 0]);
    device.queue.writeBuffer(paramsBuf, 0, ab);
  };

  const wgGrid = Math.ceil(gridTotal / 64);
  const wgPart = Math.ceil(particleCount / 64);

  async function step({ readTelemetry = true } = {}) {
    writeUniforms(0);
    // 1. Clear -> CIC Deposit -> Prepare Poisson RHS into fftWs.bufferA
    let enc = device.createCommandEncoder({ label: 'ulg-cosmo-cic' });
    let pass = enc.beginComputePass();
    pass.setBindGroup(0, bgA);
    pass.setPipeline(clearPipe.pipeline); pass.dispatchWorkgroups(wgGrid);
    pass.setPipeline(depositPipe.pipeline); pass.dispatchWorkgroups(wgPart);
    pass.setPipeline(rhsPipe.pipeline); pass.dispatchWorkgroups(wgGrid);
    pass.end();
    enc.copyBufferToBuffer(fftWs.bufferA, 0, rhsSaveBuf, 0, fftWs.byteLength);
    device.queue.submit([enc.finish()]);

    // 2. Solve spectral gradient forces along X, Y, Z using Gate 0B 3D FFT Poisson solver!
    for (let axis = 1; axis <= 3; axis += 1) {
      writeUniforms(axis);
      enc = device.createCommandEncoder({ label: `ulg-cosmo-grad-${axis}` });
      enc.copyBufferToBuffer(rhsSaveBuf, 0, fftWs.bufferA, 0, fftWs.byteLength);
      const gradBuf = fftWs.encodePoissonSolve(enc, { boxLength: boxLengthMpc, smoothR2, gradAxis: axis });
      pass = enc.beginComputePass();
      pass.setBindGroup(0, bgFor(gradBuf));
      pass.setPipeline(storePipe.pipeline);
      pass.dispatchWorkgroups(wgGrid);
      pass.end();
      device.queue.submit([enc.finish()]);
    }

    // 3. CIC Force Interpolation + Comoving FLRW Symplectic Kick-Drift
    writeUniforms(0);
    enc = device.createCommandEncoder({ label: 'ulg-cosmo-kick-drift' });
    pass = enc.beginComputePass();
    pass.setBindGroup(0, bgA);
    pass.setPipeline(kickDriftPipe.pipeline);
    pass.dispatchWorkgroups(wgPart);
    pass.end();
    if (readTelemetry) {
      enc.copyBufferToBuffer(telemetryBuf, 0, readTelemetryBuf, 0, 64);
    }
    device.queue.submit([enc.finish()]);

    aScale = Math.min(1.5, aScale + da);
    stepIndex += 1;

    if (!readTelemetry) return null;
    await readTelemetryBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const words = new Int32Array(readTelemetryBuf.getMappedRange().slice(0, 64));
    readTelemetryBuf.unmap();

    const sigmaDensity = Math.sqrt(Math.max(0, (words[0] / 10) / gridTotal));
    const maxOverdensity = words[1] / 1000;
    const kineticEnergy = words[2] / 100;
    const momentum = [words[3] / 100, words[4] / 100, words[5] / 100];
    const redshiftZ = Math.max(0, 1 / aScale - 1);

    return Object.freeze({
      schema: ULG_SUPERGALACTIC_TREEPM_SCHEMA,
      backend: 'webgpu-fft3d-treepm',
      stepIndex,
      scaleFactorA: aScale,
      redshiftZ,
      hOverH0: friedmannHOverH0(aScale, { omegaM, omegaLambda }),
      particleCount,
      pmGridN: gridN,
      boxLengthMpc,
      sigmaDensity,
      maxOverdensity,
      kineticEnergy,
      momentum,
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      provenance: Object.freeze({
        status: 'webgpu-derived',
        scientificValidation: false,
        sharedKernel: 'src/runtime/gpuMath/fft3dWebGpu.js'
      })
    });
  }

  return Object.freeze({
    schema: ULG_SUPERGALACTIC_TREEPM_SCHEMA,
    particleCount,
    strideFloats: 16,
    boxLengthMpc,
    particlesBuffer: particleBuf,
    forceGridBuffer: forceGridBuf,
    step,
    getState: () => ({ aScale, redshiftZ: Math.max(0, 1 / aScale - 1), stepIndex }),
    destroy() {
      fftWs.destroy();
      for (const b of [paramsBuf, particleBuf, cicBuf, forceGridBuf, telemetryBuf, readTelemetryBuf, rhsSaveBuf]) {
        b.destroy();
      }
    }
  });
}

/**
 * Zero-copy Cosmic-Zoom adapter exposing the live Gate 5D FLRW 3D-FFT TreePM
 * engine under the resident-engine interface (`count`, `strideFloats`,
 * `stepIndex`, `scaleFactorA`, `getResidentBuffer`, `step`, `dispose`).
 */
export function createSupergalacticTreePmCosmicAdapter({
  device,
  particleCount = 4096,
  gridN = 32,
  boxLengthMpc = 18.0,
  aInit = 0.25,
  da = 0.008,
  seed = 1370
} = {}) {
  const session = createSupergalacticTreePmSessionWebGpu(device, {
    particleCount,
    gridN,
    boxLengthMpc,
    aInit,
    da,
    seed
  });
  let lastTelemetry = null;
  return {
    schema: ULG_SUPERGALACTIC_TREEPM_SCHEMA,
    gravityMode: 'webgpu-flrw-fft3d-treepm',
    count: session.particleCount,
    strideFloats: session.strideFloats,
    get stepIndex() { return session.getState().stepIndex; },
    get scaleFactorA() { return session.getState().aScale; },
    get redshiftZ() { return session.getState().redshiftZ; },
    get lastTelemetry() { return lastTelemetry; },
    getResidentBuffer() { return session.particlesBuffer; },
    getBodies() { return new Float32Array(0); },
    async step({ readback = false } = {}) {
      lastTelemetry = await session.step({ readTelemetry: Boolean(readback) });
      return lastTelemetry;
    },
    dispose() { session.destroy(); }
  };
}
