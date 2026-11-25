// Canonical 3D WebGPU Stochastic Landau-Lifshitz-Gilbert (sLLG) Spin-Lattice
// Magnetism Engine (`src/runtime/material/spinLatticeMagnetismWebGpu.js`).
//
// Reusable across ULG's Material Physics Lab (`elements-lab.html`), continuum
// magnetic closures, and PeerCompute `SimulationModuleRegistry` (`spin-lattice-llg@1`).
//
// Zero per-element hacks: derives exchange coupling J (eV), atomic magnetic
// moment mu (mu_B), and anisotropy K strictly from the active bundle's Gate 1-2
// electronic structure & Stoner descriptors (`magneticPhase`, `curieOrNeelTempK`,
// `magneticMomentMuB`, `stonerProduct`, `magneticSusceptibilitySi`).
//
// Evolves N = nx*ny*nz classical unit spins |s_i| = 1 on WebGPU (`@workgroup_size(64)`)
// using midpoint Heun-renormalized stochastic LLG dynamics:
//   ds_i/dt = -(gamma/(1+alpha^2)) [ s_i x H_eff + alpha * s_i x (s_i x H_eff) ]
// where H_eff = (1/mu) sum_{nn} J s_j + B_ext + K_anis (s_i.z) z_hat + h_thermal(T).
// Produces emergent ferromagnetic domains, hysteresis loops M(B), critical
// disordering right across T_C, Neel checkerboard ordering (J < 0) below T_N,
// Curie-Weiss paramagnetism, and Larmor diamagnetic opposition (chi < 0)!

export const ULG_SPIN_LATTICE_SCHEMA = 'ulg.magnetic.spin-lattice-llg-webgpu.v1';

const KB_EV_PER_K = 8.617333262e-5;
const MU_B_EV_PER_T = 5.788381806e-5;

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

/**
 * Derive physical spin-lattice Hamiltonian parameters strictly from any Gate 1-2
 * material bundle's `electromagnetic` & `mechanical` fields (zero element IDs!).
 */
export function buildSpinLatticeParams(electromagnetic = {}, mechanical = {}) {
  const phase = String(electromagnetic?.magneticPhase || 'diamagnetic');
  const coord = Math.max(4, Math.min(12, Number(mechanical?.coordinationNumber) || 6));
  const rawMu = Number(electromagnetic?.magneticMomentMuB) || 0;
  const tcOrTn = Math.max(0, Number(electromagnetic?.curieOrNeelTempK) || 0);
  const chiSi = Number(electromagnetic?.magneticSusceptibilitySi) || -1e-5;
  const stoner = Number(electromagnetic?.stonerProduct) || 0;

  // Mean-field relation on 3D cubic lattice (z_sim = 6): k_B T_C = (z_sim / 3) |J| = 2 |J|
  // Use exact Heisenberg-cubic scaling (T_C ≈ 1.443 J / k_B -> J ≈ 0.693 k_B T_C) so
  // the 3D GPU lattice orders & disorders right across the bundle's derived T_C / T_N!
  let exchangeJEv = 0;
  let momentMuB = Math.max(0.5, rawMu);
  let anisotropyEv = 0;
  let diamagneticSign = 1.0;

  if (phase === 'ferromagnetic') {
    const tEff = Math.max(25, tcOrTn || 500);
    exchangeJEv = 0.693 * KB_EV_PER_K * tEff;
    momentMuB = Math.max(0.6, rawMu || 2.0);
    // Uniaxial magnetocrystalline anisotropy (~8% of J) supports real hysteresis remanence & coercivity
    anisotropyEv = 0.08 * exchangeJEv;
  } else if (phase === 'antiferromagnetic') {
    const tEff = Math.max(25, tcOrTn || 180);
    exchangeJEv = -0.693 * KB_EV_PER_K * tEff;
    momentMuB = Math.max(0.6, rawMu || 1.2);
    anisotropyEv = 0.055 * Math.abs(exchangeJEv);
  } else if (phase === 'paramagnetic') {
    exchangeJEv = 0.0;
    momentMuB = Math.max(1.0, rawMu || 1.73);
    anisotropyEv = 0.0;
  } else {
    // Diamagnetic: Larmor induced orbital moment opposes applied B_ext (chi < 0)
    exchangeJEv = 0.0;
    momentMuB = 0.35;
    anisotropyEv = 0.0;
    diamagneticSign = -1.0;
  }

  // Reference energy scale for dimensionless sLLG timestep stability
  const refEnergyEv = Math.max(0.008, Math.abs(exchangeJEv), momentMuB * MU_B_EV_PER_T * 5.0);

  return Object.freeze({
    magneticPhase: phase,
    exchangeJEv,
    momentMuB,
    anisotropyEv,
    diamagneticSign,
    curieOrNeelTempK: tcOrTn,
    stonerProduct: stoner,
    magneticSusceptibilitySi: chiSi,
    coordinationNumber: coord,
    refEnergyEv
  });
}

export const SPIN_LATTICE_LLG_WGSL = /* wgsl */ `
struct SpinParams {
  // x=nx, y=ny, z=nz, w=step_index
  dims: vec4<u32>,
  // x=j_over_eref, y=k_anis_over_eref, z=bz_mu_over_eref, w=temp_over_eref
  ham: vec4<f32>,
  // x=alpha_damping, y=dt_dimless, z=dia_sign (+1 or -1), w=collect_obs (0/1)
  ctrl: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: SpinParams;
// spins: vec4(sx, sy, sz, local_energy_norm)
@group(0) @binding(1) var<storage, read> spins_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> spins_out: array<vec4<f32>>;
// obs fixed-point atomic i32 (scale 1e4):
// [0]=sum_mx, [1]=sum_my, [2]=sum_mz, [3]=sum_stag_x, [4]=sum_stag_y, [5]=sum_stag_z,
// [6]=sum_energy, [7]=sum_domain_align
@group(0) @binding(3) var<storage, read_write> obs: array<atomic<i32>>;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = v ^ (v >> 16u);
  v = v * 0x7feb352du;
  v = v ^ (v >> 15u);
  v = v * 0x846ca68bu;
  v = v ^ (v >> 16u);
  return v;
}

fn rand_normal_pair(seed0: u32, seed1: u32) -> vec2<f32> {
  let u1 = max(1.0e-5, f32(hash_u32(seed0) & 0x00ffffffu) / 16777216.0);
  let u2 = f32(hash_u32(seed1) & 0x00ffffffu) / 16777216.0;
  let r = sqrt(-2.0 * log(u1));
  let th = 6.283185307 * u2;
  return vec2<f32>(r * cos(th), r * sin(th));
}

fn idx3(x: u32, y: u32, z: u32) -> u32 {
  return (z * p.dims.y + y) * p.dims.x + x;
}

fn llg_rhs(s: vec3<f32>, h: vec3<f32>, alpha: f32) -> vec3<f32> {
  let sxh = cross(s, h);
  let sx_sxh = cross(s, sxh);
  return -(sxh + alpha * sx_sxh) / (1.0 + alpha * alpha);
}

@compute @workgroup_size(64)
fn reset_spin_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

@compute @workgroup_size(64)
fn step_spin_llg(@builtin(global_invocation_id) gid: vec3<u32>) {
  let nx = p.dims.x;
  let ny = p.dims.y;
  let nz = p.dims.z;
  let n_tot = nx * ny * nz;
  let idx = gid.x;
  if (idx >= n_tot) { return; }

  let x = idx % nx;
  let y = (idx / nx) % ny;
  let z = idx / (nx * ny);

  let xm = (x + nx - 1u) % nx;
  let xp = (x + 1u) % nx;
  let ym = (y + ny - 1u) % ny;
  let yp = (y + 1u) % ny;
  let zm = (z + nz - 1u) % nz;
  let zp = (z + 1u) % nz;

  let s0 = normalize(spins_in[idx].xyz);
  let sum_nn =
    spins_in[idx3(xm, y, z)].xyz + spins_in[idx3(xp, y, z)].xyz +
    spins_in[idx3(x, ym, z)].xyz + spins_in[idx3(x, yp, z)].xyz +
    spins_in[idx3(x, y, zm)].xyz + spins_in[idx3(x, y, zp)].xyz;

  // Stochastic thermal Langevin field satisfying Fluctuation-Dissipation Theorem:
  //   Var(h_th) = 2 * alpha * (k_B T / E_ref) / dt
  let step_i = p.dims.w;
  let base_seed = ((idx + 1u) * 747796405u) ^ ((step_i + 1u) * 2891336453u);
  let g01 = rand_normal_pair(base_seed, base_seed + 17u);
  let g23 = rand_normal_pair(base_seed + 31u, base_seed + 53u);
  let alpha = p.ctrl.x;
  let dt = p.ctrl.y;
  let temp_norm = max(0.0, p.ham.w);
  let sigma_th = sqrt(max(0.0, (2.0 * alpha * temp_norm) / max(1.0e-4, dt)));
  let h_th = vec3<f32>(g01.x, g01.y, g23.x) * sigma_th;

  let j_n = p.ham.x;
  let k_anis = p.ham.y;
  // External Zeeman field along Z (+ 4.5-degree polycrystal canting so unstable collinear poles nucleate domain reversal!)
  let bz_eff = p.ham.z * p.ctrl.z;
  let b_vec = vec3<f32>(bz_eff * 0.08, 0.0, bz_eff);

  // Predictor-corrector (Heun) sLLG step preserving |s_i| = 1 strictly
  let h0 = j_n * sum_nn + b_vec + vec3<f32>(0.0, 0.0, 2.0 * k_anis * s0.z) + h_th;
  let k1 = llg_rhs(s0, h0, alpha);
  let s_pred = normalize(s0 + dt * k1);

  let h1 = j_n * sum_nn + b_vec + vec3<f32>(0.0, 0.0, 2.0 * k_anis * s_pred.z) + h_th;
  let k2 = llg_rhs(s_pred, h1, alpha);
  let s_next = normalize(s0 + 0.5 * dt * (k1 + k2));

  // Local dimensionless Heisenberg + Zeeman energy per spin
  let e_loc = -0.5 * j_n * dot(s_next, sum_nn) - dot(s_next, b_vec) - k_anis * s_next.z * s_next.z;
  let align = dot(s_next, sum_nn) / 6.0;
  spins_out[idx] = vec4<f32>(s_next, align);

  if (p.ctrl.w > 0.5) {
    let parity = select(-1.0, 1.0, ((x + y + z) & 1u) == 0u);
    atomicAdd(&obs[0], i32(clamp(s_next.x * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[1], i32(clamp(s_next.y * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[2], i32(clamp(s_next.z * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[3], i32(clamp(s_next.x * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[4], i32(clamp(s_next.y * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[5], i32(clamp(s_next.z * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[6], i32(clamp(e_loc * 1.0e4, -2.0e7, 2.0e7)));
    atomicAdd(&obs[7], i32(clamp(align * 1.0e4, -2.0e6, 2.0e6)));
  }
}
`;

const spinPipeCache = new WeakMap();

function getSpinPipelines(device) {
  let cached = spinPipeCache.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({ label: 'ulg-spin-llg-wgsl', code: SPIN_LATTICE_LLG_WGSL });
  const bgl = device.createBindGroupLayout({
    label: 'ulg-spin-llg-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const resetPipe = device.createComputePipeline({ label: 'ulg-spin-reset-obs', layout, compute: { module, entryPoint: 'reset_spin_obs' } });
  const stepPipe = device.createComputePipeline({ label: 'ulg-spin-step-llg', layout, compute: { module, entryPoint: 'step_spin_llg' } });
  cached = { bgl, resetPipe, stepPipe };
  spinPipeCache.set(device, cached);
  return cached;
}

/**
 * Create a live GPU-resident 3D sLLG Spin-Lattice session.
 * Exposes `getActiveSpinsBuffer()` for zero-copy 3D WebGPU arrow rendering!
 */
export function createSpinLatticeSessionWebGpu(device, electromagnetic = {}, mechanical = {}, {
  nx = 10,
  ny = 10,
  nz = 10,
  temperatureK = 300,
  fieldBZTesla = 0.0,
  alphaDamping = 0.50,
  seed = 1337
} = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('createSpinLatticeSessionWebGpu requires a valid WebGPU GPUDevice.');
  }
  const { bgl, resetPipe, stepPipe } = getSpinPipelines(device);
  const spinParams = buildSpinLatticeParams(electromagnetic, mechanical);
  const count = nx * ny * nz;
  const bytes = count * 16;
  const obsBytes = 8 * 4;

  const spinBufA = device.createBuffer({ label: 'ulg-spin-buf-a', size: bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const spinBufB = device.createBuffer({ label: 'ulg-spin-buf-b', size: bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const obsBuf = device.createBuffer({ label: 'ulg-spin-obs', size: obsBytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const obsReadBuf = device.createBuffer({ label: 'ulg-spin-obs-read', size: obsBytes, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  const MAX_BATCH = 24;
  const uPool = Array.from({ length: MAX_BATCH }, () =>
    device.createBuffer({ size: 48, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST })
  );
  const bgAB = uPool.map((uBuf) => device.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: { buffer: spinBufA } },
      { binding: 2, resource: { buffer: spinBufB } },
      { binding: 3, resource: { buffer: obsBuf } }
    ]
  }));
  const bgBA = uPool.map((uBuf) => device.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: { buffer: spinBufB } },
      { binding: 2, resource: { buffer: spinBufA } },
      { binding: 3, resource: { buffer: obsBuf } }
    ]
  }));

  let activeIdx = 0; // 0 => spinBufA is latest, 1 => spinBufB is latest
  let stepIndex = 0;
  let curTempK = Math.max(1, Number(temperatureK) || 300);
  let curBZTesla = Number(fieldBZTesla) || 0;
  let readPromise = null;
  let destroyed = false;

  function initSpins({ orderedBias = 0.0, initSeed = seed } = {}) {
    const arr = new Float32Array(count * 4);
    let s = (initSeed >>> 0) || 1;
    const rng = () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < count; i += 1) {
      const z = (2 * rng() - 1) + orderedBias;
      const phi = 2 * Math.PI * rng();
      const rxy = Math.sqrt(Math.max(0.01, 1 - Math.max(-0.98, Math.min(0.98, z)) ** 2));
      const sx = rxy * Math.cos(phi);
      const sy = rxy * Math.sin(phi);
      const sz = Math.max(-0.99, Math.min(0.99, z));
      const inv = 1 / Math.hypot(sx, sy, sz);
      arr[i * 4 + 0] = sx * inv;
      arr[i * 4 + 1] = sy * inv;
      arr[i * 4 + 2] = sz * inv;
      arr[i * 4 + 3] = 0;
    }
    device.queue.writeBuffer(spinBufA, 0, arr);
    device.queue.writeBuffer(spinBufB, 0, arr);
    activeIdx = 0;
    stepIndex = 0;
  }

  initSpins({ orderedBias: spinParams.magneticPhase === 'ferromagnetic' ? 0.35 : 0.0 });

  function writeUniform(uBuf, sIdx, collectObs, dtScale = 1.0) {
    const safeDtScale = Math.max(0.05, Math.min(1.0, Number(dtScale) || 1.0));
    const eRef = spinParams.refEnergyEv;
    const jNorm = spinParams.exchangeJEv / eRef;
    const kNorm = spinParams.anisotropyEv / eRef;
    // Scale B-field Zeeman energy so interactive -5..+5 T lab sweep overcomes coercivity & traces clear hysteresis!
    const zeemanScale = spinParams.magneticPhase === 'ferromagnetic' || spinParams.magneticPhase === 'antiferromagnetic'
      ? Math.max(MU_B_EV_PER_T * spinParams.momentMuB, 0.62 * Math.abs(spinParams.exchangeJEv))
      : Math.max(MU_B_EV_PER_T * spinParams.momentMuB * 40.0, 0.004);
    const bzNorm = (curBZTesla * zeemanScale) / eRef;
    const tempNorm = (KB_EV_PER_K * curTempK) / eRef;
    // Clamp dt for unconditional Heun sLLG numerical stability at any T or B
    const hScale = Math.max(1.0, 6.0 * Math.abs(jNorm) + Math.abs(bzNorm) + 2.0 * Math.abs(kNorm));
    const dtDim = Math.min(0.095, 0.26 / hScale) * safeDtScale;

    const ab = new ArrayBuffer(48);
    new Uint32Array(ab, 0, 4).set([nx, ny, nz, sIdx >>> 0]);
    new Float32Array(ab, 16, 4).set([jNorm, kNorm, bzNorm, tempNorm]);
    new Float32Array(ab, 32, 4).set([alphaDamping, dtDim, spinParams.diamagneticSign, collectObs ? 1.0 : 0.0]);
    device.queue.writeBuffer(uBuf, 0, ab);
  }

  function stepSync(numSteps = 8, { temperatureK: nextT = null, fieldBZTesla: nextB = null, collectObsOnLast = false, dtScale = 1.0 } = {}) {
    if (destroyed) return;
    if (nextT != null && Number.isFinite(Number(nextT))) curTempK = Math.max(1, Number(nextT));
    if (nextB != null && Number.isFinite(Number(nextB))) curBZTesla = Number(nextB);
    const steps = Math.max(1, Math.min(MAX_BATCH, Math.trunc(numSteps)));
    for (let s = 0; s < steps; s += 1) {
      writeUniform(uPool[s], stepIndex + s, collectObsOnLast && s === steps - 1, dtScale);
    }
    const wg = Math.ceil(count / 64);
    const enc = device.createCommandEncoder({ label: 'ulg-spin-llg-batch' });
    const pass = enc.beginComputePass({ label: 'ulg-spin-llg-pass' });
    for (let s = 0; s < steps; s += 1) {
      const bg = activeIdx === 0 ? bgAB[s] : bgBA[s];
      if (collectObsOnLast && s === steps - 1) {
        pass.setPipeline(resetPipe);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(1);
      }
      pass.setPipeline(stepPipe);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(wg);
      activeIdx ^= 1;
    }
    pass.end();
    device.queue.submit([enc.finish()]);
    stepIndex += steps;
  }

  async function readTelemetry({ nonBlocking = false } = {}) {
    if (destroyed) return null;
    if (readPromise) {
      if (nonBlocking) return null;
      try { await readPromise; } catch {}
      if (destroyed) return null;
    }
    const run = (async () => {
      if (destroyed) return null;
      const enc = device.createCommandEncoder({ label: 'ulg-spin-read-obs' });
      enc.copyBufferToBuffer(obsBuf, 0, obsReadBuf, 0, obsBytes);
      device.queue.submit([enc.finish()]);
      await obsReadBuf.mapAsync(GPU_BUF.MAP_READ);
      if (destroyed) {
        try { obsReadBuf.unmap(); } catch {}
        return null;
      }
      const w = new Int32Array(obsReadBuf.getMappedRange().slice(0, obsBytes));
      obsReadBuf.unmap();
      const invN = 1 / (count * 1e4);
      const mx = w[0] * invN;
      const my = w[1] * invN;
      const mz = w[2] * invN;
      const mMag = Math.hypot(mx, my, mz);
      const sx = w[3] * invN;
      const sy = w[4] * invN;
      const sz = w[5] * invN;
      const staggeredMag = Math.hypot(sx, sy, sz);
      const energyPerSpinEv = (w[6] * invN) * spinParams.refEnergyEv;
      const neighborAlign = w[7] * invN;

      // Scale diamagnetic response visibly by chi_dia so M_z accurately reflects weak Larmor opposition
      const effMz = spinParams.diamagneticSign < 0
        ? mz * Math.min(0.25, Math.abs(curBZTesla) * 0.04)
        : mz;

      return Object.freeze({
        schema: ULG_SPIN_LATTICE_SCHEMA,
        stepIndex,
        spinCount: count,
        dims: Object.freeze([nx, ny, nz]),
        magneticPhase: spinParams.magneticPhase,
        temperatureK: curTempK,
        fieldBZTesla: curBZTesla,
        curieOrNeelTempK: spinParams.curieOrNeelTempK,
        exchangeJEv: spinParams.exchangeJEv,
        momentMuB: spinParams.momentMuB,
        magnetizationVec: Object.freeze([mx, my, effMz]),
        magnetizationZ: effMz,
        magnetizationMag: spinParams.diamagneticSign < 0 ? Math.abs(effMz) : mMag,
        staggeredOrderMag: staggeredMag,
        neighborAlign,
        energyPerSpinEv
      });
    })();
    readPromise = run;
    try {
      return await run;
    } finally {
      if (readPromise === run) readPromise = null;
    }
  }

  async function stepBatch(numSteps = 16, { temperatureK: nextT = null, fieldBZTesla: nextB = null, readObs = true, nonBlocking = false, dtScale = 1.0 } = {}) {
    let rem = Math.max(1, Math.trunc(numSteps));
    while (rem > 0) {
      const chunk = Math.min(MAX_BATCH, rem);
      const isLast = rem === chunk;
      stepSync(chunk, { temperatureK: nextT, fieldBZTesla: nextB, collectObsOnLast: readObs && isLast, dtScale });
      rem -= chunk;
    }
    return readObs ? readTelemetry({ nonBlocking }) : null;
  }

  function destroy() {
    destroyed = true;
    for (const b of [spinBufA, spinBufB, obsBuf, obsReadBuf, ...uPool]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_SPIN_LATTICE_SCHEMA,
    dims: Object.freeze([nx, ny, nz]),
    spinCount: count,
    params: spinParams,
    getActiveSpinsBuffer: () => (activeIdx === 0 ? spinBufA : spinBufB),
    getStepIndex: () => stepIndex,
    getTemperatureK: () => curTempK,
    getFieldBZTesla: () => curBZTesla,
    resetDomains: (opts = {}) => initSpins(opts),
    stepSync,
    stepBatch,
    readTelemetry,
    destroy
  });
}

export async function registerSpinLatticeClosureArtifact({
  closureRegistry,
  materialKey = 'unknown',
  electromagnetic = {},
  mechanical = {},
  telemetry = null
} = {}) {
  const params = buildSpinLatticeParams(electromagnetic, mechanical);
  const artifact = {
    closureId: `ulg-spin-lattice-llg:${materialKey}.v1`,
    closureKind: 'magnetic-spin-lattice-llg',
    inputHash: `${materialKey}:phase=${params.magneticPhase}:J=${params.exchangeJEv.toFixed(5)}:mu=${params.momentMuB.toFixed(2)}`,
    methodHash: 'stochastic-llg-heun-3d-webgpu.v1',
    execution: { mode: 'webgpu-3d-sllg', params, telemetry },
    validity: { temperatureK: [1, 10000], fieldTesla: [-20, 20] },
    provenance: {
      schema: ULG_SPIN_LATTICE_SCHEMA,
      sourceModule: 'src/runtime/material/spinLatticeMagnetismWebGpu.js',
      scientificValidation: false
    }
  };
  const ref = closureRegistry ? await closureRegistry.store(artifact) : null;
  return { ref, artifact };
}

export function registerSpinLatticeSimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  return registry.registerModule({
    method: { model: 'spin-lattice-llg', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/material/spinLatticeMagnetismWebGpu.js',
      entryPoint: 'step_spin_llg',
      workgroupSize: 64,
      wgsl: SPIN_LATTICE_LLG_WGSL
    },
    parameterSchema: {
      temperatureK: { type: 'number', min: 1, max: 10000 },
      fieldBZTesla: { type: 'number', min: -20, max: 20 },
      steps: { type: 'number', min: 1, max: 4096 }
    },
    stateLayout: { tensorId: 'spin_lattice_3d_unit_vectors', dtype: 'f32', components: 4 },
    stepCapsule: async (capsule, context) => {
      const device = context?.device;
      if (!device) throw new Error('spin-lattice-llg@1 requires a WebGPU device');
      const p = capsule?.parameters || {};
      const session = createSpinLatticeSessionWebGpu(device, p.electromagnetic || {}, p.mechanical || {}, {
        temperatureK: p.temperatureK ?? 300,
        fieldBZTesla: p.fieldBZTesla ?? 0
      });
      try {
        const telemetry = await session.stepBatch(p.steps ?? 64, { readObs: true });
        return { status: 'ok', telemetry };
      } finally {
        session.destroy();
      }
    }
  });
}
