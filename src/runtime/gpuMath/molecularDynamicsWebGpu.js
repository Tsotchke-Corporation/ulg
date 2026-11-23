// Gate 0B: Shared WebGPU Atomic Molecular Dynamics Engine
// (`src/runtime/gpuMath/molecularDynamicsWebGpu.js`).
//
// GPU-resident Velocity-Verlet MD engine supporting three universal potential
// families derived from Gate 1-2 DFT closures (zero hardcoded per-element hacks):
//   0: Shifted-force Lennard-Jones + London dispersion (noble gases, vdW)
//   1: Morse + Finnis-Sinclair Embedded Atom Model (EAM metals)
//   2: Stillinger-Weber 2-body + 3-body tetrahedral angular (covalent sp3)
// Exposes resident `positionsBuffer` directly for zero-copy live 3D rendering
// and fixed-size GPU atomic reductions for E_kin, E_pot, virial P, T, MSD,
// Green-Kubo shear stress, and 64-bin radial distribution g(r).

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_GPU_MD_SCHEMA = 'ulg.gpumath.molecular-dynamics-webgpu.v1';
export const MD_POTENTIAL_MODELS = Object.freeze({
  LENNARD_JONES: 0,
  MORSE_EAM: 1,
  STILLINGER_WEBER: 2
});

const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

// Internal reduced/atomic units in shader:
//   length: Angstrom (1e-10 m)
//   energy: eV
//   mass:   amu (u)
//   time:   internal unit t0 = 10.1805057 fs so F(eV/A) / m(u) = a(A/t0^2),
//           and 0.5 * m * v^2 is directly in eV!
export const MD_TIME_UNIT_FS = 10.1805057;
export const KB_EV_PER_K = 8.617333262e-5;
const TELEMETRY_WORDS = 80; // 16 scalar accumulators + 64 RDF bins

export const molecularDynamicsWebGpuWgsl = /* wgsl */ `
struct MdParams {
  // x=atomCount, y=potentialModel (0=LJ, 1=Morse+EAM, 2=SW), z=rdfBins(64), w=thermostatActive
  counts: vec4<u32>,
  // x=boxLx, y=boxLy, z=boxLz, w=dt_internal
  box_dt: vec4<f32>,
  // x=epsilon_ev, y=sigma_or_r0_A, z=alpha_or_lambda, w=rcut_A
  pot0: vec4<f32>,
  // x=eam_A_ev, y=eam_beta, z=sw_gamma_or_p, w=target_temp_k
  pot1: vec4<f32>,
  // x=thermostat_alpha (dt / tau), y=scale_factor, z=0, w=0
  ctrl: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MdParams;
// pos: xyz in [0, box), w = species / phase marker
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
// vel: vxyz (A/t0), w = mass (u)
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
// force: fxyz (eV/A), w = per-atom potential energy (eV)
@group(0) @binding(3) var<storage, read_write> force: array<vec4<f32>>;
// unwrapped: xyz unwrapped coords for exact MSD, w = EAM embedding derivative F'(rho)
@group(0) @binding(4) var<storage, read_write> unwrapped: array<vec4<f32>>;
// pos_init: initial unwrapped xyz for MSD reference
@group(0) @binding(5) var<storage, read> pos_init: array<vec4<f32>>;
// telemetry: fixed-point scaled atomic accumulators
//   [0]=E_kin*1e5, [1]=E_pot*1e5, [2]=virial*1e5, [3]=msd*1e4,
//   [4]=px*1e5, [5]=py*1e5, [6]=pz*1e5, [7]=sxy*1e5, [8]=sxz*1e5, [9]=syz*1e5,
//   [16..79]=RDF histogram bins
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<i32>>;

fn min_image(d: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return d - box_l * round(d / box_l);
}

fn wrap_box(p: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return p - box_l * floor(p / box_l);
}

@compute @workgroup_size(64)
fn reset_telemetry(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 80u) {
    atomicStore(&telemetry[id.x], 0);
  }
}

@compute @workgroup_size(64)
fn vv_half_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let box_l = params.box_dt.xyz;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  let f3 = force[i].xyz;
  let v_half = v4.xyz + (0.5 * dt / m) * f3;
  let dr = v_half * dt;
  let p_new = wrap_box(pos[i].xyz + dr, box_l);
  pos[i] = vec4<f32>(p_new, pos[i].w);
  unwrapped[i] = vec4<f32>(unwrapped[i].xyz + dr, unwrapped[i].w);
  vel[i] = vec4<f32>(v_half, m);
}

// Pre-pass for Finnis-Sinclair EAM metallic electron density rho_i = sum_j phi(r_ij)
@compute @workgroup_size(64)
fn compute_eam_density(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.x;
  if (i >= n || params.counts.y != 1u) { return; }
  let box_l = params.box_dt.xyz;
  let r0 = params.pot0.y;
  let rcut = params.pot0.w;
  let rcut2 = rcut * rcut;
  let beta = max(params.pot1.y, 0.25);
  let pi = pos[i].xyz;
  var rho = 0.0;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let d = min_image(pi - pos[j].xyz, box_l);
    let r2 = dot(d, d);
    if (r2 < rcut2 && r2 > 1.0e-8) {
      let r = sqrt(r2);
      let s = 1.0 - r / rcut;
      rho = rho + exp(-beta * (r - r0)) * s * s;
    }
  }
  // Store F'(rho) = -0.5 * A / sqrt(rho + eps) in unwrapped[i].w and embed energy later
  let a_eam = params.pot1.x;
  let dF = -0.5 * a_eam / sqrt(max(rho, 1.0e-6));
  unwrapped[i].w = dF;
  // Temporarily stash sqrt(rho) in force[i].w
  force[i].w = -a_eam * sqrt(max(rho, 0.0));
}

@compute @workgroup_size(64)
fn compute_forces(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.x;
  if (i >= n) { return; }
  let model = params.counts.y;
  let box_l = params.box_dt.xyz;
  let eps = params.pot0.x;
  let sig = params.pot0.y;
  let alpha = params.pot0.z;
  let rcut = params.pot0.w;
  let rcut2 = rcut * rcut;
  let pi = pos[i].xyz;

  var fi = vec3<f32>(0.0);
  var epot_i = select(0.0, force[i].w, model == 1u);
  var vir_i = 0.0;
  var sxy = 0.0;
  var sxz = 0.0;
  var syz = 0.0;

  let inv_rc = sig / rcut;
  let sr2_c = inv_rc * inv_rc;
  let sr6_c = sr2_c * sr2_c * sr2_c;
  let lj_ecut = 4.0 * eps * (sr6_c * sr6_c - sr6_c);
  let lj_fcut = 24.0 * eps * (2.0 * sr6_c * sr6_c - sr6_c) / rcut;

  let dFi = unwrapped[i].w;
  let beta = max(params.pot1.y, 0.25);

  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let d = min_image(pi - pos[j].xyz, box_l);
    let r2 = dot(d, d);
    if (r2 >= rcut2 || r2 <= 1.0e-8) { continue; }
    let r = sqrt(r2);

    // RDF bin accumulation (only when telemetry is active on final step)
    if (params.ctrl.z > 0.5) {
      let bin = u32(clamp((r / rcut) * 64.0, 0.0, 63.0));
      atomicAdd(&telemetry[16u + bin], 1);
    }

    var f_scalar = 0.0; // force magnitude / r along d = pi - pj
    var u_pair = 0.0;

    if (model == 0u) {
      // Shifted-force Lennard-Jones
      let sr = sig / r;
      let sr2 = sr * sr;
      let sr6 = sr2 * sr2 * sr2;
      let sr12 = sr6 * sr6;
      u_pair = 4.0 * eps * (sr12 - sr6) - lj_ecut + (r - rcut) * lj_fcut;
      let f_mag = 24.0 * eps * (2.0 * sr12 - sr6) / r - lj_fcut;
      f_scalar = f_mag / r;
    } else if (model == 1u) {
      // Smoothly truncated Morse pair + Finnis-Sinclair EAM many-body force
      let ex = exp(-alpha * (r - sig));
      let s = 1.0 - r / rcut;
      let s2 = s * s;
      let u_morse = eps * (ex * ex - 2.0 * ex);
      let du_morse = 2.0 * eps * alpha * (ex - ex * ex);
      u_pair = u_morse * s2;
      let du_dr = du_morse * s2 - u_morse * (2.0 * s / rcut);
      // EAM density derivative d(rho)/dr
      let ex_rho = exp(-beta * (r - sig));
      let drho_dr = ex_rho * (-beta * s2 - 2.0 * s / rcut);
      let dFj = unwrapped[j].w;
      let f_mag = -du_dr - (dFi + dFj) * drho_dr;
      f_scalar = f_mag / r;
    } else {
      // Stillinger-Weber 2-body term (A=7.049556, B=0.602224, p=4, a=rcut/sig)
      let rs = r / sig;
      let a_sw = rcut / sig;
      let denom = rs - a_sw;
      if (denom < -1.0e-4) {
        let ex_sw = exp(1.0 / denom);
        let inv_r4 = 1.0 / (rs * rs * rs * rs);
        let term = 0.6022245584 * inv_r4 - 1.0;
        u_pair = 7.049556277 * eps * term * ex_sw;
        let dterm = -4.0 * 0.6022245584 * inv_r4 / rs;
        let du_drs = 7.049556277 * eps * ex_sw * (dterm - term / (denom * denom));
        f_scalar = -(du_drs / sig) / r;
      }
    }

    let fij = d * f_scalar;
    fi = fi + fij;
    epot_i = epot_i + 0.5 * u_pair;
    vir_i = vir_i + 0.5 * dot(d, fij);
    sxy = sxy + 0.5 * d.x * fij.y;
    sxz = sxz + 0.5 * d.x * fij.z;
    syz = syz + 0.5 * d.y * fij.z;
  }

  // Stillinger-Weber 3-body tetrahedral term when model == 2 (covalent sp3 bonding)
  if (model == 2u && params.pot0.z > 0.0) {
    let lambda_sw = params.pot0.z;
    let gamma_sw = max(params.pot1.z, 1.2);
    let a_sw = rcut / sig;
    // Collect up to 12 nearest neighbors of i inside rcut
    var nb_idx: array<u32, 12>;
    var nb_vec: array<vec3<f32>, 12>;
    var nb_r: array<f32, 12>;
    var nb_count = 0u;
    for (var j = 0u; j < n; j = j + 1u) {
      if (j == i || nb_count >= 12u) { continue; }
      let d = min_image(pos[j].xyz - pi, box_l);
      let r2 = dot(d, d);
      if (r2 < rcut2 && r2 > 1.0e-8) {
        nb_idx[nb_count] = j;
        nb_vec[nb_count] = d;
        nb_r[nb_count] = sqrt(r2);
        nb_count = nb_count + 1u;
      }
    }
    // Central-atom angular restoring force (cos theta_jik + 1/3)^2
    for (var a = 0u; a + 1u < nb_count; a = a + 1u) {
      let ra = nb_r[a] / sig;
      let da = ra - a_sw;
      if (da >= -1.0e-3) { continue; }
      let ea = exp(gamma_sw / da);
      let ua = nb_vec[a] / nb_r[a];
      for (var b = a + 1u; b < nb_count; b = b + 1u) {
        let rb = nb_r[b] / sig;
        let db = rb - a_sw;
        if (db >= -1.0e-3) { continue; }
        let eb = exp(gamma_sw / db);
        let ub = nb_vec[b] / nb_r[b];
        let cos_t = clamp(dot(ua, ub), -1.0, 1.0);
        let diff = cos_t + 0.33333333;
        let pre = lambda_sw * eps * ea * eb;
        let u3 = pre * diff * diff;
        epot_i = epot_i + u3;
        // Gradient w.r.t. central atom i: -(grad_j + grad_k)
        let d_cos_dj = (ub - ua * cos_t) / nb_r[a];
        let d_cos_dk = (ua - ub * cos_t) / nb_r[b];
        let d_ea_dr = -(gamma_sw / (da * da * sig));
        let d_eb_dr = -(gamma_sw / (db * db * sig));
        let grad_j = pre * (2.0 * diff * d_cos_dj + diff * diff * d_ea_dr * ua);
        let grad_k = pre * (2.0 * diff * d_cos_dk + diff * diff * d_eb_dr * ub);
        fi = fi + grad_j + grad_k;
      }
    }
  }

  force[i] = vec4<f32>(fi, epot_i);

  if (params.ctrl.z > 0.5) {
    atomicAdd(&telemetry[1], i32(clamp(epot_i * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[2], i32(clamp(vir_i * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[7], i32(clamp(sxy * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[8], i32(clamp(sxz * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[9], i32(clamp(syz * 1.0e4, -2.0e9, 2.0e9)));
  }
}

@compute @workgroup_size(64)
fn vv_second_kick_reduce(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  var v_new = v4.xyz + (0.5 * dt / m) * force[i].xyz;
  if (params.counts.w != 0u) {
    v_new = v_new * params.ctrl.y;
  }
  vel[i] = vec4<f32>(v_new, m);

  if (params.ctrl.z > 0.5) {
    let ekin = 0.5 * m * dot(v_new, v_new);
    let disp = unwrapped[i].xyz - pos_init[i].xyz;
    let msd_i = dot(disp, disp);
    atomicAdd(&telemetry[0], i32(clamp(ekin * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[3], i32(clamp(msd_i * 1.0e3, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[4], i32(clamp(m * v_new.x * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[5], i32(clamp(m * v_new.y * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[6], i32(clamp(m * v_new.z * 1.0e4, -2.0e9, 2.0e9)));
  }
}
`;

/**
 * Create a GPU-resident Atomic Molecular Dynamics session.
 * Fails closed without a live GPUDevice.
 */
export function createMolecularDynamicsSessionWebGpu(device, {
  positions,
  velocities,
  boxLengthsA,
  potentialModel = MD_POTENTIAL_MODELS.LENNARD_JONES,
  epsilonEv = 0.0103,
  sigmaOrR0A = 3.405,
  alphaOrLambda = 1.5,
  rcutA = 8.5,
  eamAEv = 0,
  eamBeta = 1.2,
  swGamma = 1.2,
  dtFs = 2.0,
  targetTemperatureK = 0,
  thermostatCouplingFs = 0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createMolecularDynamicsSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const posArr = positions instanceof Float32Array ? positions : Float32Array.from(positions);
  const velArr = velocities instanceof Float32Array ? velocities : Float32Array.from(velocities);
  const atomCount = Math.floor(posArr.length / 4);
  if (!(atomCount >= 2 && velArr.length === atomCount * 4)) {
    throw new RangeError(`Invalid MD buffers: atomCount=${atomCount}, velFloats=${velArr.length}`);
  }
  const box = Array.isArray(boxLengthsA)
    ? [Number(boxLengthsA[0]), Number(boxLengthsA[1]), Number(boxLengthsA[2])]
    : [Number(boxLengthsA), Number(boxLengthsA), Number(boxLengthsA)];

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage')
  ];
  const mkPipe = (entry) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-gpumath-md-${entry}.v1`,
    label: `ulg-gpumath-md-${entry}`,
    code: molecularDynamicsWebGpuWgsl,
    entryPoint: entry,
    bindings
  });
  const resetPipe = mkPipe('reset_telemetry');
  const driftPipe = mkPipe('vv_half_kick_drift');
  const eamPipe = mkPipe('compute_eam_density');
  const forcePipe = mkPipe('compute_forces');
  const kickPipe = mkPipe('vv_second_kick_reduce');

  const byteLen = atomCount * 16;
  const mkBuf = (label, data, usage) => {
    const b = device.createBuffer({ label, size: Math.max(16, data ? data.byteLength : byteLen), usage });
    if (data) device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const paramsBuf = device.createBuffer({
    label: 'ulg-md-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const posBuf = mkBuf('ulg-md-pos', posArr, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC);
  const velBuf = mkBuf('ulg-md-vel', velArr, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC);
  const forceBuf = mkBuf('ulg-md-force', new Float32Array(atomCount * 4), GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC);
  const unwrappedBuf = mkBuf('ulg-md-unwrapped', posArr, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC);
  const posInitBuf = mkBuf('ulg-md-pos-init', posArr, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST);
  const telemetryBuf = device.createBuffer({
    label: 'ulg-md-telemetry',
    size: TELEMETRY_WORDS * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const readTelemetryBuf = device.createBuffer({
    label: 'ulg-md-telemetry-read',
    size: TELEMETRY_WORDS * 4,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  const bg = device.createBindGroup({
    layout: forcePipe.bindGroupLayout,
    entries: [paramsBuf, posBuf, velBuf, forceBuf, unwrappedBuf, posInitBuf, telemetryBuf].map((buffer, binding) => ({
      binding,
      resource: { buffer }
    }))
  });

  const dtInternal = Number(dtFs) / MD_TIME_UNIT_FS;
  let lastTempK = Math.max(1, Number(targetTemperatureK) || 300);
  let totalSteps = 0;
  let forcesInitialized = false;

  const writeParams = ({ collectTelemetry = false, scaleVel = 1.0, useThermostat = false } = {}) => {
    const ab = new ArrayBuffer(80);
    new Uint32Array(ab, 0, 4).set([atomCount, potentialModel, 64, useThermostat ? 1 : 0]);
    new Float32Array(ab, 16, 4).set([box[0], box[1], box[2], dtInternal]);
    new Float32Array(ab, 32, 4).set([epsilonEv, sigmaOrR0A, alphaOrLambda, rcutA]);
    new Float32Array(ab, 48, 4).set([eamAEv, eamBeta, swGamma, targetTemperatureK]);
    new Float32Array(ab, 64, 4).set([
      thermostatCouplingFs > 0 ? dtFs / thermostatCouplingFs : 0,
      scaleVel,
      collectTelemetry ? 1.0 : 0.0,
      0
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);
  };

  const wg = Math.ceil(atomCount / 64);

  async function stepBatch(numSteps = 10, { readTelemetry = true, temperatureK = targetTemperatureK } = {}) {
    const steps = Math.max(1, Math.trunc(Number(numSteps)));
    const useTherm = Number(temperatureK) > 0 && Number(thermostatCouplingFs) > 0;
    let velScale = 1.0;
    if (useTherm && lastTempK > 0) {
      const alphaT = Math.min(0.5, dtFs / thermostatCouplingFs);
      velScale = Math.sqrt(Math.max(0.25, Math.min(4.0, 1 + alphaT * (Number(temperatureK) / lastTempK - 1))));
    }

    // Batch steps into a single CommandEncoder + single queue.submit (zero host waits!)
    const encoder = device.createCommandEncoder({ label: `ulg-md-batch-${steps}` });
    if (!forcesInitialized) {
      writeParams({ collectTelemetry: false, scaleVel: 1.0, useThermostat: false });
      const pInit = encoder.beginComputePass({ label: 'ulg-md-init-forces' });
      pInit.setBindGroup(0, bg);
      if (potentialModel === MD_POTENTIAL_MODELS.MORSE_EAM) {
        pInit.setPipeline(eamPipe.pipeline);
        pInit.dispatchWorkgroups(wg);
      }
      pInit.setPipeline(forcePipe.pipeline);
      pInit.dispatchWorkgroups(wg);
      pInit.end();
      forcesInitialized = true;
    }

    if (steps > 1) {
      writeParams({ collectTelemetry: false, scaleVel: velScale, useThermostat: useTherm });
      const pLoop = encoder.beginComputePass({ label: 'ulg-md-steps-loop' });
      pLoop.setBindGroup(0, bg);
      for (let s = 0; s < steps - 1; s += 1) {
        pLoop.setPipeline(driftPipe.pipeline); pLoop.dispatchWorkgroups(wg);
        if (potentialModel === MD_POTENTIAL_MODELS.MORSE_EAM) {
          pLoop.setPipeline(eamPipe.pipeline); pLoop.dispatchWorkgroups(wg);
        }
        pLoop.setPipeline(forcePipe.pipeline); pLoop.dispatchWorkgroups(wg);
        pLoop.setPipeline(kickPipe.pipeline); pLoop.dispatchWorkgroups(wg);
      }
      pLoop.end();
    }

    // Final step collects telemetry cleanly in the same submit if requested
    device.queue.submit([encoder.finish()]);

    const encFinal = device.createCommandEncoder({ label: 'ulg-md-final-step' });
    writeParams({ collectTelemetry: readTelemetry, scaleVel: velScale, useThermostat: useTherm });
    const pFinal = encFinal.beginComputePass({ label: 'ulg-md-final-pass' });
    pFinal.setBindGroup(0, bg);
    if (readTelemetry) {
      pFinal.setPipeline(resetPipe.pipeline);
      pFinal.dispatchWorkgroups(2);
    }
    pFinal.setPipeline(driftPipe.pipeline); pFinal.dispatchWorkgroups(wg);
    if (potentialModel === MD_POTENTIAL_MODELS.MORSE_EAM) {
      pFinal.setPipeline(eamPipe.pipeline); pFinal.dispatchWorkgroups(wg);
    }
    pFinal.setPipeline(forcePipe.pipeline); pFinal.dispatchWorkgroups(wg);
    pFinal.setPipeline(kickPipe.pipeline); pFinal.dispatchWorkgroups(wg);
    pFinal.end();
    if (readTelemetry) {
      encFinal.copyBufferToBuffer(telemetryBuf, 0, readTelemetryBuf, 0, TELEMETRY_WORDS * 4);
    }
    device.queue.submit([encFinal.finish()]);
    totalSteps += steps;

    if (!readTelemetry) return null;

    await readTelemetryBuf.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const words = new Int32Array(readTelemetryBuf.getMappedRange().slice(0, TELEMETRY_WORDS * 4));
    readTelemetryBuf.unmap();

    const kineticEnergyEv = words[0] / 1e4;
    const potentialEnergyEv = words[1] / 1e4;
    const totalEnergyEv = kineticEnergyEv + potentialEnergyEv;
    const virialEv = words[2] / 1e4;
    const msdA2 = words[3] / (1e3 * atomCount);
    const momentum = [words[4] / 1e4, words[5] / 1e4, words[6] / 1e4];
    const volumeA3 = box[0] * box[1] * box[2];
    const dof = Math.max(1, 3 * atomCount - 3);
    const instantTempK = (2 * kineticEnergyEv) / (dof * KB_EV_PER_K);
    lastTempK = Number.isFinite(instantTempK) && instantTempK > 0 ? instantTempK : lastTempK;
    // Pressure in GPa: (2/3 E_kin + W/3) / V [eV/A^3] * 160.2176634 GPa/(eV/A^3)
    const pressureGPa = ((2 * kineticEnergyEv + virialEv) / (3 * volumeA3)) * 160.2176634;
    const stressOffDiagGPa = [
      (words[7] / 1e4 / volumeA3) * 160.2176634,
      (words[8] / 1e4 / volumeA3) * 160.2176634,
      (words[9] / 1e4 / volumeA3) * 160.2176634
    ];

    const rdfCounts = new Float32Array(64);
    const dr = rcutA / 64;
    const rhoNum = atomCount / volumeA3;
    for (let b = 0; b < 64; b += 1) {
      const rMid = (b + 0.5) * dr;
      const shellVol = 4 * Math.PI * rMid * rMid * dr;
      const ideal = Math.max(1e-9, atomCount * rhoNum * shellVol);
      rdfCounts[b] = words[16 + b] / ideal;
    }

    return Object.freeze({
      schema: ULG_GPU_MD_SCHEMA,
      backend: 'webgpu',
      totalSteps,
      timeFs: totalSteps * dtFs,
      atomCount,
      kineticEnergyEv,
      potentialEnergyEv,
      totalEnergyEv,
      temperatureK: instantTempK,
      pressureGPa,
      msdA2,
      momentum,
      stressOffDiagGPa,
      rdf: rdfCounts
    });
  }

  async function readPositionsAndVelocities() {
    const byteLen = atomCount * 16;
    const stagingPos = device.createBuffer({ size: byteLen, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
    const stagingVel = device.createBuffer({ size: byteLen, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });
    const enc = device.createCommandEncoder({ label: 'ulg-md-read-pos-vel' });
    enc.copyBufferToBuffer(posBuf, 0, stagingPos, 0, byteLen);
    enc.copyBufferToBuffer(velBuf, 0, stagingVel, 0, byteLen);
    device.queue.submit([enc.finish()]);
    try {
      await Promise.all([
        stagingPos.mapAsync(GPU_BUFFER_USAGE.MAP_READ),
        stagingVel.mapAsync(GPU_BUFFER_USAGE.MAP_READ)
      ]);
      const positions = new Float32Array(stagingPos.getMappedRange().slice(0, byteLen));
      const velocities = new Float32Array(stagingVel.getMappedRange().slice(0, byteLen));
      stagingPos.unmap();
      stagingVel.unmap();
      return { positions, velocities };
    } finally {
      stagingPos.destroy();
      stagingVel.destroy();
    }
  }

  return Object.freeze({
    schema: ULG_GPU_MD_SCHEMA,
    atomCount,
    boxLengthsA: Object.freeze([...box]),
    positionsBuffer: posBuf,
    velocitiesBuffer: velBuf,
    forcesBuffer: forceBuf,
    stepBatch,
    readPositionsAndVelocities,
    destroy() {
      for (const b of [paramsBuf, posBuf, velBuf, forceBuf, unwrappedBuf, posInitBuf, telemetryBuf, readTelemetryBuf]) {
        b.destroy();
      }
    }
  });
}

/**
 * Build a zero-net-momentum crystalline MD initial state matching the actual
 * solved Bravais/covalent crystal symmetry (`fcc`, `vdw-fcc`, `bcc`, `hcp`,
 * `diamond`) at its exact equilibrium atomic density (zero 2x BCC-in-FCC over-compression!).
 */
export function buildCrystalMdState({
  crystalStructure = 'fcc',
  cellsPerSide = 3,
  latticeConstantA = 4.05,
  massU = 26.982,
  temperatureK = 300,
  seed = 1337
} = {}) {
  const nCell = Math.max(2, Math.trunc(cellsPerSide));
  const a = Number(latticeConstantA);
  const struct = String(crystalStructure || 'fcc').toLowerCase();
  let basis;
  let cellScale = [1, 1, 1];
  if (struct === 'bcc' || struct.startsWith('cscl')) {
    basis = [
      [0, 0, 0],
      [0.5, 0.5, 0.5]
    ];
  } else if (struct === 'diamond' || struct.startsWith('zincblende')) {
    basis = [
      [0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5],
      [0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]
    ];
  } else if (struct === 'hcp') {
    // Orthorhombic 4-atom HCP supercell (a_hex, sqrt(3)*a_hex, c_hex=1.633*a_hex)
    // preserving exact 12-coordinated close-packed atomic volume a_conv^3 / 4 = a_hex^3 / sqrt(2)
    const aHex = a / Math.SQRT2;
    const scaleX = aHex / a;
    const scaleY = (Math.sqrt(3) * aHex) / a;
    const scaleZ = (1.632993 * aHex) / a;
    cellScale = [scaleX, scaleY, scaleZ];
    basis = [
      [0, 0, 0],
      [0.5, 0.5, 0],
      [0, 1 / 3, 0.5],
      [0.5, 5 / 6, 0.5]
    ];
  } else {
    // fcc, vdw-fcc, molecular-fcc, rocksalt-B1, etc.
    basis = [
      [0, 0, 0],
      [0.5, 0.5, 0],
      [0.5, 0, 0.5],
      [0, 0.5, 0.5]
    ];
  }

  const atomCount = basis.length * nCell * nCell * nCell;
  const positions = new Float32Array(atomCount * 4);
  const velocities = new Float32Array(atomCount * 4);
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());

  const sigmaV = Math.sqrt(Math.max(1e-9, KB_EV_PER_K * temperatureK / Math.max(massU, 1e-6)));
  const ax = a * cellScale[0];
  const ay = a * cellScale[1];
  const az = a * cellScale[2];
  let idx = 0;
  let vxSum = 0; let vySum = 0; let vzSum = 0;
  for (let ix = 0; ix < nCell; ix += 1) {
    for (let iy = 0; iy < nCell; iy += 1) {
      for (let iz = 0; iz < nCell; iz += 1) {
        for (const [bx, by, bz] of basis) {
          positions[idx * 4 + 0] = (ix + bx) * ax;
          positions[idx * 4 + 1] = (iy + by) * ay;
          positions[idx * 4 + 2] = (iz + bz) * az;
          positions[idx * 4 + 3] = 0;
          const vx = gauss() * sigmaV;
          const vy = gauss() * sigmaV;
          const vz = gauss() * sigmaV;
          velocities[idx * 4 + 0] = vx;
          velocities[idx * 4 + 1] = vy;
          velocities[idx * 4 + 2] = vz;
          velocities[idx * 4 + 3] = massU;
          vxSum += vx; vySum += vy; vzSum += vz;
          idx += 1;
        }
      }
    }
  }
  vxSum /= atomCount; vySum /= atomCount; vzSum /= atomCount;
  let ke = 0;
  for (let i = 0; i < atomCount; i += 1) {
    velocities[i * 4 + 0] -= vxSum;
    velocities[i * 4 + 1] -= vySum;
    velocities[i * 4 + 2] -= vzSum;
    const vx = velocities[i * 4 + 0];
    const vy = velocities[i * 4 + 1];
    const vz = velocities[i * 4 + 2];
    ke += 0.5 * massU * (vx * vx + vy * vy + vz * vz);
  }
  const targetKe = 0.5 * (3 * atomCount - 3) * KB_EV_PER_K * temperatureK;
  const scale = ke > 0 ? Math.sqrt(targetKe / ke) : 0;
  for (let i = 0; i < atomCount; i += 1) {
    velocities[i * 4 + 0] *= scale;
    velocities[i * 4 + 1] *= scale;
    velocities[i * 4 + 2] *= scale;
  }
  return {
    crystalStructure: struct,
    atomCount,
    positions,
    velocities,
    boxLengthsA: [nCell * ax, nCell * ay, nCell * az]
  };
}

/**
 * Helper to generate a zero-net-momentum FCC crystal initial condition for any
 * element/compound lattice constant `aA`, atomic mass `massU`, and temperature `tempK`.
 */
export function buildFccCrystalMdState(options = {}) {
  return buildCrystalMdState({ ...options, crystalStructure: 'fcc', cellsPerSide: options.cellsPerSide ?? 4 });
}
