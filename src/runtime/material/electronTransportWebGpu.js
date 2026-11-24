// Canonical 3D WebGPU Drude-Boltzmann Electron-Phonon & Superconducting
// Transport Simulation (`src/runtime/material/electronTransportWebGpu.js`).
//
// Reusable across ULG's Material Physics Lab (`elements-lab.html`), continuum
// electrical/thermal closures, and PeerCompute `SimulationModuleRegistry`
// (`electron-transport-gpu@1`).
//
// Zero per-element hacks: derives conduction carrier density, Bloch-Grüneisen
// electron-phonon scattering rate tau^-1(T), Debye phonon lattice vibration
// amplitude, intrinsic semiconductor thermal activation n(T) ~ exp(-E_g/2kT),
// and BCS/McMillan superconducting Cooper-pair condensate fraction (T < T_c)
// strictly from the active bundle's Gate 1-2 electromagnetic & mechanical fields.

export const ULG_ELECTRON_TRANSPORT_SCHEMA = 'ulg.electromagnetic.electron-transport-webgpu.v1';

const E_CHARGE = 1.602176634e-19;
const M_ELECTRON = 9.1093837015e-31;
const HBAR = 1.054571817e-34;
const KB = 1.380649e-23;
const EV_TO_J = 1.602176634e-19;

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

/**
 * Derive physical transport parameters strictly from any active Gate 1-2 bundle.
 */
export function buildElectronTransportParams(electromagnetic = {}, mechanical = {}, {
  temperatureK = 300,
  eFieldVPerM = 1.0e4
} = {}) {
  const T = Math.max(0.5, Number(temperatureK) || 300);
  const isMetal = Boolean(electromagnetic?.isMetal);
  const bandGapEv = Math.max(0, Number(electromagnetic?.bandGapEv) || 0);
  const thetaD = Math.max(25, Number(mechanical?.debyeTemperatureK) || 250);
  const tcK = Math.max(0, Number(electromagnetic?.superconductingTcK) || 0);
  const dosEf = Math.max(0.05, Number(electromagnetic?.dosAtFermiStatesPerEvAtom) || 0.5);
  const plasmaEv = Math.max(0, Number(electromagnetic?.plasmaEnergyEv) || (isMetal ? 8.5 : 0));
  const condRef = Math.max(1e-18, Number(electromagnetic?.electricalConductivitySPerM) || (isMetal ? 1e7 : 1e-6));

  // Conduction electron density from plasma frequency: n_e = eps_0 m_e omega_p^2 / e^2
  const omegaP = (plasmaEv * EV_TO_J) / HBAR;
  const nMetalM3 = isMetal ? Math.max(1e27, (8.8541878128e-12 * M_ELECTRON * omegaP * omegaP) / (E_CHARGE * E_CHARGE)) : 0;

  // Electron-phonon coupling lambda_ep
  const lambdaEp = isMetal ? Math.max(0.08, Math.min(1.8, 0.14 + 0.16 * dosEf * (300 / thetaD))) : 0.25;

  // Bloch-Grüneisen scattering rate tau^-1(T) (s^-1)
  const xT = T / thetaD;
  const fBg = xT >= 0.4 ? 1.0 : Math.pow(xT / 0.4, 4);
  const phononScatterHz = (2 * Math.PI * lambdaEp * KB * T / HBAR) * fBg;
  const impurityFloorHz = 2.0e11;

  // Superconducting condensate fraction f_s = 1 - (T/T_c)^4 when T < T_c
  const isSuperconducting = isMetal && tcK > 0.05 && T < tcK;
  const cooperFraction = isSuperconducting ? Math.max(0.05, 1.0 - Math.pow(T / tcK, 4)) : 0.0;

  // Intrinsic thermal carrier activation fraction for semiconductors / insulators
  // (smoothly maps band gap E_g vs k_B T into active visual carrier fraction [0.02..1.0])
  let activeCarrierFraction = 1.0;
  let carrierDensityM3 = nMetalM3;
  if (!isMetal) {
    const egJ = bandGapEv * EV_TO_J;
    const nEff = 2 * Math.pow((M_ELECTRON * KB * T) / (2 * Math.PI * HBAR * HBAR), 1.5);
    carrierDensityM3 = Math.max(1e8, nEff * Math.exp(-egJ / (2 * KB * T)));
    // Normalized active fraction of simulated carriers (0 = bound to ion, 1 = thermally excited mobile e-/h+)
    const thermalActivation = Math.exp(-bandGapEv / Math.max(0.06, 8.617333e-5 * T * 14.0));
    activeCarrierFraction = Math.max(0.0, Math.min(1.0, thermalActivation));
  }

  const totalScatterHz = isSuperconducting
    ? (1.0 - cooperFraction) * (phononScatterHz + impurityFloorHz)
    : (phononScatterHz + impurityFloorHz);

  // Dimensionless scattering probability per simulation step (normalized so visual mean free path tracks T/Theta_D!)
  const scatterProbStep = isSuperconducting
    ? 0.0
    : Math.max(0.004, Math.min(0.65, (totalScatterHz / 2.6e14)));

  // Thermal phonon lattice vibration amplitude (fraction of unit cell)
  const phononVibAmp = Math.min(0.22, 0.018 * Math.sqrt(T / Math.max(25, thetaD)));

  // Analytic reference conductivity at T
  let analyticSigmaSPerM = condRef;
  if (isSuperconducting) {
    analyticSigmaSPerM = Infinity;
  } else if (isMetal) {
    analyticSigmaSPerM = (nMetalM3 * E_CHARGE * E_CHARGE) / (M_ELECTRON * Math.max(1e11, totalScatterHz));
  } else {
    const mob = 0.05 * Math.pow(300 / Math.max(10, T), 1.5);
    analyticSigmaSPerM = Math.max(1e-18, carrierDensityM3 * E_CHARGE * mob);
  }

  return Object.freeze({
    isMetal,
    isSuperconducting,
    cooperFraction,
    bandGapEv,
    debyeTempK: thetaD,
    superconductingTcK: tcK,
    temperatureK: T,
    eFieldVPerM: Number(eFieldVPerM) || 0,
    nCarrierM3: carrierDensityM3,
    activeCarrierFraction,
    lambdaEp,
    totalScatterHz,
    scatterProbStep,
    phononVibAmp,
    analyticSigmaSPerM,
    analyticResistivityOhmM: isSuperconducting ? 0 : 1 / Math.max(1e-20, analyticSigmaSPerM)
  });
}

export const ELECTRON_TRANSPORT_WGSL = /* wgsl */ `
struct TransportParams {
  // x=carrier_count, y=step_index, z=is_metal (0/1), w=collect_obs (0/1)
  counts: vec4<u32>,
  // x=e_accel (unit/step), y=scatter_prob, z=v_thermal, w=cooper_fraction
  phys: vec4<f32>,
  // x=active_carrier_frac, y=phonon_vib_amp, z=dt_step, w=0
  env: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: TransportParams;
// pos: xyz in [-1, 1]^3, w = carrier_type (-1 = electron, +1 = hole, -2 = Cooper pair, 0 = bound valence)
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
// vel: vxyz (box-units/step), w = scatter_flash [0..1] (decays after phonon collision!)
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
// obs fixed-point atomic i32 (scale 1e4):
// [0]=sum_jx (current density -q*vx), [1]=sum_speed, [2]=scatter_events, [3]=mobile_count, [4]=cooper_count
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

fn rand01(seed: u32) -> f32 {
  return f32(hash_u32(seed) & 0x00ffffffu) / 16777216.0;
}

@compute @workgroup_size(64)
fn reset_transport_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

@compute @workgroup_size(64)
fn step_electron_transport(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.counts.x;
  if (i >= n) { return; }

  let step_i = p.counts.y;
  let seed = ((i + 1u) * 2654435761u) ^ ((step_i + 1u) * 2246822519u);
  let r0 = rand01(seed);
  let r1 = rand01(seed + 13u);
  let r2 = rand01(seed + 29u);
  let r3 = rand01(seed + 47u);

  var p4 = pos[i];
  var v4 = vel[i];
  let frac_i = (f32(i) + 0.5) / f32(n);

  // Classify carrier strictly from active physics (metal / superconductor / thermally activated semiconductor)
  var ctype = -1.0; // mobile conduction electron (q = -1)
  if (p.counts.z == 1u) {
    if (frac_i < p.phys.w) {
      ctype = -2.0; // superconducting Cooper pair (lossless condensate)
    } else {
      ctype = -1.0; // normal Drude electron
    }
  } else {
    if (frac_i < p.env.x) {
      // Equal electron (-1) and hole (+1) pairs excited across band gap E_g!
      ctype = select(1.0, -1.0, (i & 1u) == 0u);
    } else {
      ctype = 0.0; // bound valence electron oscillating near lattice site
    }
  }

  let dt = p.env.z;
  var flash = max(0.0, v4.w - 0.10);
  var scattered = 0i;

  if (ctype == 0.0) {
    // Bound valence state: damped thermal jitter around home lattice node, zero net drift
    let jitter = (vec3<f32>(r0, r1, r2) - 0.5) * 0.015 * max(0.1, p.env.y * 5.0);
    v4 = vec4<f32>(jitter, 0.0);
    p4 = vec4<f32>(p4.xyz, 0.0);
  } else if (ctype < -1.5) {
    // Superconducting Cooper pair: ballistic zero-scattering supercurrent along -E (capped at critical velocity v_c)
    let a_sc = -p.phys.x * 1.4;
    var vx = clamp(v4.x + a_sc * dt, -0.58, 0.58);
    // Smooth phase coherence: transverse thermal momentum damps to coherent condensate flow
    let vy = v4.y * 0.88;
    let vz = v4.z * 0.88;
    v4 = vec4<f32>(vx, vy, vz, 0.0);
    var np = p4.xyz + v4.xyz * dt;
    np = fract((np + 1.0) * 0.5) * 2.0 - 1.0;
    p4 = vec4<f32>(np, ctype);
  } else {
    // Normal Drude-Boltzmann carrier (electron q=-1 or hole q=+1): accelerate under E, scatter off phonons!
    let q_sign = select(-1.0, 1.0, ctype > 0.0);
    var v_new = v4.xyz + vec3<f32>(q_sign * p.phys.x * dt, 0.0, 0.0);
    // Soft Fermi/saturation ceiling keeps numeric velocity bounded under strong E
    v_new = clamp(v_new, vec3<f32>(-0.95), vec3<f32>(0.95));

    if (r0 < p.phys.y) {
      // Phonon scattering collision: randomize direction onto isotropic thermal sphere of radius v_thermal!
      let cos_t = 2.0 * r1 - 1.0;
      let sin_t = sqrt(max(0.0, 1.0 - cos_t * cos_t));
      let phi = 6.283185307 * r2;
      let v_mag = p.phys.z * (0.65 + 0.7 * r3);
      v_new = vec3<f32>(sin_t * cos(phi), sin_t * sin(phi), cos_t) * v_mag;
      flash = 1.0;
      scattered = 1i;
    }

    var np = p4.xyz + v_new * dt;
    np = fract((np + 1.0) * 0.5) * 2.0 - 1.0;
    p4 = vec4<f32>(np, ctype);
    v4 = vec4<f32>(v_new, flash);
  }

  pos[i] = p4;
  vel[i] = v4;

  if (p.counts.w != 0u) {
    if (ctype != 0.0) {
      let q_s = select(-1.0, 1.0, ctype > 0.0);
      // Electric current contribution J_x = q * v_x (electrons drift along -E => q*v_x > 0 for E > 0!)
      let jx = q_s * v4.x;
      atomicAdd(&obs[0], i32(clamp(jx * 1.0e4, -2.0e6, 2.0e6)));
      atomicAdd(&obs[1], i32(clamp(length(v4.xyz) * 1.0e4, 0.0, 2.0e6)));
      atomicAdd(&obs[2], scattered);
      atomicAdd(&obs[3], 1i);
      if (ctype < -1.5) { atomicAdd(&obs[4], 1i); }
    }
  }
}
`;

const trPipeCache = new WeakMap();

function getTransportPipelines(device) {
  let cached = trPipeCache.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({ label: 'ulg-electron-transport-wgsl', code: ELECTRON_TRANSPORT_WGSL });
  const bgl = device.createBindGroupLayout({
    label: 'ulg-electron-transport-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const resetPipe = device.createComputePipeline({ label: 'ulg-tr-reset-obs', layout, compute: { module, entryPoint: 'reset_transport_obs' } });
  const stepPipe = device.createComputePipeline({ label: 'ulg-tr-step', layout, compute: { module, entryPoint: 'step_electron_transport' } });
  cached = { bgl, resetPipe, stepPipe };
  trPipeCache.set(device, cached);
  return cached;
}

/**
 * Create a live GPU-resident 3D Drude-Boltzmann Electron-Phonon & Superconducting
 * Transport session. Exposes `posBuffer` & `velBuffer` directly for zero-copy 3D rendering!
 */
export function createElectronTransportSessionWebGpu(device, electromagnetic = {}, mechanical = {}, {
  carrierCount = 1024,
  temperatureK = 300,
  eFieldVPerM = 1.0e4,
  seed = 4242
} = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('createElectronTransportSessionWebGpu requires a valid WebGPU GPUDevice.');
  }
  const { bgl, resetPipe, stepPipe } = getTransportPipelines(device);
  const n = Math.max(64, Math.min(4096, Math.trunc(carrierCount)));
  const bytes = n * 16;
  const obsBytes = 8 * 4;

  const posBuffer = device.createBuffer({ label: 'ulg-tr-pos', size: bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const velBuffer = device.createBuffer({ label: 'ulg-tr-vel', size: bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const obsBuf = device.createBuffer({ label: 'ulg-tr-obs', size: obsBytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const obsReadBuf = device.createBuffer({ label: 'ulg-tr-obs-read', size: obsBytes, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  const MAX_BATCH = 16;
  const uPool = Array.from({ length: MAX_BATCH }, () =>
    device.createBuffer({ size: 48, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST })
  );
  const bgPool = uPool.map((uBuf) => device.createBindGroup({
    layout: bgl,
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: { buffer: posBuffer } },
      { binding: 2, resource: { buffer: velBuffer } },
      { binding: 3, resource: { buffer: obsBuf } }
    ]
  }));

  let curTempK = Math.max(0.5, Number(temperatureK) || 300);
  let curEField = Number(eFieldVPerM) || 1.0e4;
  let trParams = buildElectronTransportParams(electromagnetic, mechanical, { temperatureK: curTempK, eFieldVPerM: curEField });
  let stepIndex = 0;
  let readPromise = null;
  let destroyed = false;

  function initCarriers(initSeed = seed) {
    const pArr = new Float32Array(n * 4);
    const vArr = new Float32Array(n * 4);
    let s = (initSeed >>> 0) || 1;
    const rng = () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < n; i += 1) {
      pArr[i * 4 + 0] = rng() * 2 - 1;
      pArr[i * 4 + 1] = rng() * 2 - 1;
      pArr[i * 4 + 2] = rng() * 2 - 1;
      pArr[i * 4 + 3] = trParams.isMetal ? -1.0 : 0.0;
      vArr[i * 4 + 0] = (rng() - 0.5) * 0.25;
      vArr[i * 4 + 1] = (rng() - 0.5) * 0.25;
      vArr[i * 4 + 2] = (rng() - 0.5) * 0.25;
      vArr[i * 4 + 3] = 0.0;
    }
    device.queue.writeBuffer(posBuffer, 0, pArr);
    device.queue.writeBuffer(velBuffer, 0, vArr);
    stepIndex = 0;
  }

  initCarriers();

  function writeUniform(uBuf, sIdx, collectObs, dtScale = 1.0) {
    const safeDtScale = Math.max(0.05, Math.min(1.0, Number(dtScale) || 1.0));
    const eNorm = Math.max(-2.5, Math.min(2.5, curEField / 1.0e4));
    const eAccel = 0.16 * eNorm;
    const vTherm = Math.max(0.05, Math.min(0.45, 0.14 * Math.sqrt(curTempK / 300)));
    const pScatScaled = 1.0 - Math.pow(Math.max(0.0, 1.0 - trParams.scatterProbStep), safeDtScale);
    const ab = new ArrayBuffer(48);
    new Uint32Array(ab, 0, 4).set([n, sIdx >>> 0, trParams.isMetal ? 1 : 0, collectObs ? 1 : 0]);
    new Float32Array(ab, 16, 4).set([eAccel, pScatScaled, vTherm, trParams.cooperFraction]);
    new Float32Array(ab, 32, 4).set([trParams.activeCarrierFraction, trParams.phononVibAmp, 0.28 * safeDtScale, 0]);
    device.queue.writeBuffer(uBuf, 0, ab);
  }

  function stepSync(numSteps = 4, { temperatureK: nextT = null, eFieldVPerM: nextE = null, collectObsOnLast = false, dtScale = 1.0 } = {}) {
    if (destroyed) return;
    let paramsDirty = false;
    if (nextT != null && Number.isFinite(Number(nextT))) {
      curTempK = Math.max(0.5, Number(nextT));
      paramsDirty = true;
    }
    if (nextE != null && Number.isFinite(Number(nextE))) {
      curEField = Number(nextE);
      paramsDirty = true;
    }
    if (paramsDirty) {
      trParams = buildElectronTransportParams(electromagnetic, mechanical, { temperatureK: curTempK, eFieldVPerM: curEField });
    }
    const steps = Math.max(1, Math.min(MAX_BATCH, Math.trunc(numSteps)));
    for (let s = 0; s < steps; s += 1) {
      writeUniform(uPool[s], stepIndex + s, collectObsOnLast && s === steps - 1, dtScale);
    }
    const wg = Math.ceil(n / 64);
    const enc = device.createCommandEncoder({ label: 'ulg-tr-batch' });
    const pass = enc.beginComputePass({ label: 'ulg-tr-pass' });
    for (let s = 0; s < steps; s += 1) {
      const bg = bgPool[s];
      if (collectObsOnLast && s === steps - 1) {
        pass.setPipeline(resetPipe);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(1);
      }
      pass.setPipeline(stepPipe);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(wg);
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
      const enc = device.createCommandEncoder({ label: 'ulg-tr-read-obs' });
      enc.copyBufferToBuffer(obsBuf, 0, obsReadBuf, 0, obsBytes);
      device.queue.submit([enc.finish()]);
      await obsReadBuf.mapAsync(GPU_BUF.MAP_READ);
      if (destroyed) {
        try { obsReadBuf.unmap(); } catch {}
        return null;
      }
      const w = new Int32Array(obsReadBuf.getMappedRange().slice(0, obsBytes));
      obsReadBuf.unmap();
      const mobileCount = Math.max(0, w[3]);
      const cooperCount = Math.max(0, w[4]);
      const scatterEvents = Math.max(0, w[2]);
      const avgCurrentPerCarrier = mobileCount > 0 ? (w[0] / 1e4) / mobileCount : 0;
      const meanDriftNorm = (w[0] / 1e4) / n;
      const meanSpeedNorm = mobileCount > 0 ? (w[1] / 1e4) / mobileCount : 0;
      const measuredScatterRateFrac = mobileCount > 0 ? scatterEvents / mobileCount : 0;

      // Map measured GPU dimensionless mobility (meanDriftNorm / eNorm) onto physical SI conductivity
      const eNorm = Math.max(0.05, Math.abs(curEField / 1.0e4));
      const simMobilityRatio = Math.abs(meanDriftNorm) / (eNorm * 0.25);
      const sigmaGpuSPerM = trParams.isSuperconducting
        ? Infinity
        : (trParams.isMetal
          ? Math.max(1e3, trParams.analyticSigmaSPerM * Math.max(0.35, Math.min(2.2, simMobilityRatio * 1.4 + 0.45)))
          : trParams.analyticSigmaSPerM * (mobileCount > 0 ? Math.max(0.4, Math.min(2.0, simMobilityRatio * 3.0 + 0.5)) : 1.0));

      return Object.freeze({
        schema: ULG_ELECTRON_TRANSPORT_SCHEMA,
        stepIndex,
        carrierCount: n,
        mobileCount,
        cooperCount,
        scatterEvents,
        temperatureK: curTempK,
        eFieldVPerM: curEField,
        isMetal: trParams.isMetal,
        isSuperconducting: trParams.isSuperconducting,
        superconductingTcK: trParams.superconductingTcK,
        bandGapEv: trParams.bandGapEv,
        phononVibAmp: trParams.phononVibAmp,
        avgCurrentPerCarrier,
        meanDriftNorm,
        meanSpeedNorm,
        measuredScatterRateFrac,
        sigmaGpuSPerM,
        resistivityGpuOhmM: trParams.isSuperconducting ? 0 : 1 / Math.max(1e-20, sigmaGpuSPerM),
        analyticSigmaSPerM: trParams.analyticSigmaSPerM
      });
    })();
    readPromise = run;
    try {
      return await run;
    } finally {
      if (readPromise === run) readPromise = null;
    }
  }

  async function stepBatch(numSteps = 12, { temperatureK: nextT = null, eFieldVPerM: nextE = null, readObs = true, nonBlocking = false, dtScale = 1.0 } = {}) {
    let rem = Math.max(1, Math.trunc(numSteps));
    while (rem > 0) {
      const chunk = Math.min(MAX_BATCH, rem);
      const isLast = rem === chunk;
      stepSync(chunk, { temperatureK: nextT, eFieldVPerM: nextE, collectObsOnLast: readObs && isLast, dtScale });
      rem -= chunk;
    }
    return readObs ? readTelemetry({ nonBlocking }) : null;
  }

  function destroy() {
    destroyed = true;
    for (const b of [posBuffer, velBuffer, obsBuf, obsReadBuf, ...uPool]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_ELECTRON_TRANSPORT_SCHEMA,
    carrierCount: n,
    posBuffer,
    velBuffer,
    getParams: () => trParams,
    getStepIndex: () => stepIndex,
    resetCarriers: initCarriers,
    stepSync,
    stepBatch,
    readTelemetry,
    destroy
  });
}

export async function registerElectronTransportClosureArtifact({
  closureRegistry,
  materialKey = 'unknown',
  electromagnetic = {},
  mechanical = {},
  telemetry = null
} = {}) {
  const params = buildElectronTransportParams(electromagnetic, mechanical);
  const artifact = {
    closureId: `ulg-electron-transport:${materialKey}.v1`,
    closureKind: 'electrical-drude-boltzmann-transport',
    inputHash: `${materialKey}:metal=${params.isMetal ? 1 : 0}:Tc=${params.superconductingTcK.toFixed(2)}:Eg=${params.bandGapEv.toFixed(2)}`,
    methodHash: 'drude-boltzmann-phonon-bcs-webgpu.v1',
    execution: { mode: 'webgpu-3d-electron-transport', params, telemetry },
    validity: { temperatureK: [0.5, 5000], eFieldVPerM: [-1e6, 1e6] },
    provenance: {
      schema: ULG_ELECTRON_TRANSPORT_SCHEMA,
      sourceModule: 'src/runtime/material/electronTransportWebGpu.js',
      scientificValidation: false
    }
  };
  const ref = closureRegistry ? await closureRegistry.store(artifact) : null;
  return { ref, artifact };
}

export function registerElectronTransportSimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  return registry.registerModule({
    method: { model: 'electron-transport-gpu', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/material/electronTransportWebGpu.js',
      entryPoint: 'step_electron_transport',
      workgroupSize: 64,
      wgsl: ELECTRON_TRANSPORT_WGSL
    },
    parameterSchema: {
      temperatureK: { type: 'number', min: 0.5, max: 5000 },
      eFieldVPerM: { type: 'number', min: -1e6, max: 1e6 },
      steps: { type: 'number', min: 1, max: 2048 }
    },
    stateLayout: { tensorId: 'electron_transport_carriers_3d', dtype: 'f32', components: 4 },
    stepCapsule: async (capsule, context) => {
      const device = context?.device;
      if (!device) throw new Error('electron-transport-gpu@1 requires a WebGPU device');
      const p = capsule?.parameters || {};
      const session = createElectronTransportSessionWebGpu(device, p.electromagnetic || {}, p.mechanical || {}, {
        temperatureK: p.temperatureK ?? 300,
        eFieldVPerM: p.eFieldVPerM ?? 1e4
      });
      try {
        const telemetry = await session.stepBatch(p.steps ?? 48, { readObs: true });
        return { status: 'ok', telemetry };
      } finally {
        session.destroy();
      }
    }
  });
}
