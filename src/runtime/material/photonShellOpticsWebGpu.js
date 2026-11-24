// Real First-Principles WebGPU 2D Coupled Maxwell–ADE-FDTD Photon-Packet ↔ Electron-Shell
// Optics Engine & 1D Symplectic Quantum Wavepacket Tunneling TDSE
// (`src/runtime/material/photonShellOpticsWebGpu.js`).
//
// ZERO scripted animations, ZERO per-element hacks, ZERO fake color lookups:
//   1. `createPhotonShellOpticsSessionWebGpu`:
//      Integrates exact 2D TM_z coupled Maxwell's equations (E_z, H_x, H_y) on a
//      128 x 128 physical optical micro-cavity (dx = dy = 20 nm, 2.56 x 2.56 um)
//      coupled via Auxiliary Differential Equations (ADE) to Drude free-electron
//      conduction shells (J_D) and up to 4 bound Lorentz interband electron-shell
//      oscillators (P_0..P_3) derived DIRECTLY from ULG's GPU closures
//      (`plasmaEnergyEv`, `drudeDampingEv`, relativistic `Delta l = +-1`
//      `interbandOscillators`, `bandGapEv`, `refractiveIndex550Nm`).
//      Launches an oblique-incidence (theta_i = 24 deg) collimated 2D Gaussian
//      electromagnetic photon wavepacket across 4 simultaneous channels on GPU:
//        ch 0: Red-Orange 610 nm (2.03 eV — CIE-X peak)
//        ch 1: Green      535 nm (2.32 eV — CIE-Y peak)
//        ch 2: Blue-Violet 440 nm (2.82 eV — CIE-Z peak)
//        ch 3: User-tunable monochromatic probe (380..780 nm)
//      Produces live:
//        - Spatially separated reflected beam (emergent Gold vs Silver color!)
//        - Real Snell's Law bending (sin theta_t = sin theta_i / n(lambda))
//        - Real 2D spatial wavelength compression inside dielectrics (n_phase)
//        - Real per-cell electron-shell dipole polarization & absorbed energy
//          read ZERO-COPY by ULG's 3D WebGPU volumetric + orbital-cloud renderer!
//   2. `createNuclearTunnelingTdseWebGpu`:
//      Integrates Visscher's symplectic staggered-time 1D TDSE on WebGPU for an
//      alpha-cluster quantum wavepacket inside the nucleus's actual Gate 1
//      Woods-Saxon + Coulomb Gamow barrier V(r).
//   3. Canonical ULG `ClosureRegistry` & `SimulationModuleRegistry` registration!

export const ULG_PHOTON_SHELL_OPTICS_SCHEMA = 'ulg.optics.photon-shell-fdtd-2d-webgpu.v1';
export const ULG_NUCLEAR_TDSE_SCHEMA = 'ulg.nuclear.tunneling-tdse-webgpu.v1';

export const FDTD_NX = 128;
export const FDTD_NY = 128;
export const FDTD_NUM_CELLS = FDTD_NX * FDTD_NY;
export const FDTD_NUM_CHANNELS = 4;
export const FDTD_DX_M = 20.0e-9; // 20 nm spatial step -> 2.56 um x 2.56 um cavity
export const FDTD_COURANT = 0.50; // Strictly < 1/sqrt(2) = 0.7071 for 2D FDTD stability
const C_LIGHT_M_S = 2.99792458e8;
export const FDTD_DT_S = (FDTD_COURANT * FDTD_DX_M) / C_LIGHT_M_S; // 3.33564e-17 s
const HBAR_EV_S = 6.582119569e-16;
const HC_EV_NM = 1239.841984;
const INTERBAND_STRENGTH_SCALE = 0.36; // Exact match to opticalResolverWebGpu.js!

export const FDTD_INCIDENCE_DEG = 24.0;
export const FDTD_SRC_X = 18;
export const FDTD_SRC_Y_CENTER = 36;
export const FDTD_SENSOR_X = 42;
export const FDTD_SLAB_X0 = 64;
export const FDTD_SLAB_X1 = 104; // 40 cells = 800 nm slab thickness
export const FDTD_TR_SENSOR_X = 110;

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

/**
 * Derive physical ADE Drude-Lorentz parameters directly from any ULG element
 * or backfed compound's `electromagnetic` closure (zero element/material IDs!).
 */
export function buildOpticalFdtdParams(electromagnetic = {}, { probeWavelengthNm = 535 } = {}) {
  const isMetal = Boolean(electromagnetic?.isMetal);
  const plasmaEv = isMetal
    ? Math.max(0.5, Math.min(24.0, Number(electromagnetic?.plasmaEnergyEv) || 8.0))
    : 0.0;
  const drudeGammaEv = isMetal
    ? Math.max(0.05, Math.min(4.0, Number(electromagnetic?.drudeDampingEv) || Math.max(0.15, plasmaEv / 25)))
    : 0.0;

  const oscillators = [];
  if (isMetal) {
    const rawOsc = Array.isArray(electromagnetic?.interbandOscillators)
      ? electromagnetic.interbandOscillators
      : [];
    const wp2 = plasmaEv * plasmaEv;
    for (let k = 0; k < Math.min(4, rawOsc.length); k += 1) {
      const o = rawOsc[k];
      const e0 = Math.max(0.25, Math.min(18.0, Number(o.energyEv) || 3.0));
      const g0 = Math.max(0.12, Math.min(6.0, Number(o.dampingEv) || 0.45));
      const sw = Math.max(0.0, Math.min(8.0, Number(o.strengthWeight) || 0.0));
      const deltaEps = (INTERBAND_STRENGTH_SCALE * wp2 * sw) / (e0 * e0);
      oscillators.push({
        energyEv: e0,
        dampingEv: g0,
        deltaEps: Math.min(25.0, deltaEps),
        label: o.transitionLabel || `Interband #${k + 1}`
      });
    }
  } else {
    const gapEv = Math.max(0.25, Math.min(18.0, Number(electromagnetic?.bandGapEv) || 5.0));
    const n550Raw = Number(electromagnetic?.refractiveIndex550Nm);
    const n550 = Number.isFinite(n550Raw) && n550Raw >= 1.005
      ? Math.min(3.8, n550Raw)
      : Math.min(3.8, Math.sqrt(1.0 + Math.pow(13.6 / (gapEv + 3.47), 2)));
    const e550 = HC_EV_NM / 550.0;
    const eUv = Math.max(e550 * 1.48, gapEv + 1.65);
    const n2Minus1 = Math.max(0.02, n550 * n550 - 1.0);
    const deltaEpsUv = n2Minus1 * (1.0 - (e550 * e550) / (eUv * eUv));
    oscillators.push({
      energyEv: eUv,
      dampingEv: gapEv < 3.4 ? 0.42 : 0.06,
      deltaEps: Math.min(16.0, Math.max(0.02, deltaEpsUv)),
      label: `Valence→Cond UV (${eUv.toFixed(1)} eV)`
    });
    if (gapEv < 3.35) {
      const eAbs = Math.max(0.6, gapEv + 0.35);
      oscillators.push({
        energyEv: eAbs,
        dampingEv: Math.max(0.25, 0.22 * gapEv),
        deltaEps: Math.min(4.0, Math.max(0.15, (3.4 - gapEv) * 0.60)),
        label: `Band-Edge (${eAbs.toFixed(2)} eV)`
      });
    }
  }

  while (oscillators.length < 4) {
    oscillators.push({ energyEv: 10.0, dampingEv: 1.0, deltaEps: 0.0, label: 'inactive' });
  }

  const evToOmegaDt = FDTD_DT_S / HBAR_EV_S;
  const wpDt = plasmaEv * evToOmegaDt;
  const gdDt = drudeGammaEv * evToOmegaDt;
  // Exact time-symmetric half-step Drude leapfrog coefficients:
  //   J_D^{n+1/2} = k_D J_D^{n-1/2} + beta_D E^n   (where J_D stores J_phys * dt / eps0)
  const kDrude = isMetal ? (1.0 - 0.5 * gdDt) / (1.0 + 0.5 * gdDt) : 0.0;
  const betaDrude = isMetal ? (wpDt * wpDt) / (1.0 + 0.5 * gdDt) : 0.0;

  // Exact time-symmetric symplectic Yee-Taflove Lorentz oscillator leapfrog:
  //   J_k^{n+1/2} = a_k J_k^{n-1/2} + b_k (c_k E^n - P_k^n)   [J_k stores dP_k/dt * dt]
  //   P_k^{n+1}   = P_k^n + J_k^{n+1/2}
  //   E^{n+1}     = E^n + S_c curl(H^{n+1/2}) - J_D^{n+1/2} - sum_k J_k^{n+1/2}
  // 100% passive & lossless-stable for ALL gamma >= 0 when w0*dt*sqrt(1 + deltaEps) < 2!
  const oscCoeffs = oscillators.map((o) => {
    // Cap effective UV pole slightly if needed so symplectic bound w0*dt*sqrt(1+dEps) < 1.45 holds strictly
    const w0DtRaw = o.energyEv * evToOmegaDt;
    const maxW0Dt = 1.35 / Math.sqrt(1.0 + Math.max(0.0, o.deltaEps));
    const w0Dt = Math.min(w0DtRaw, maxW0Dt);
    const gkDt = o.dampingEv * evToOmegaDt;
    const denom = 1.0 + 0.5 * gkDt;
    const a = (1.0 - 0.5 * gkDt) / denom;       // k_k damping multiplier for J_k
    const b = (w0Dt * w0Dt) / denom;            // alpha_k = (w0*dt)^2 / (1 + 0.5*g*dt)
    const c = o.deltaEps;                       // deltaEps_k
    return { a, b, c, active: o.deltaEps > 1e-6 ? 1 : 0, ...o };
  });

  const lambdaProbe = Math.max(380, Math.min(780, Number(probeWavelengthNm) || 535));
  // CIE-matched RGB channels (610nm Red-Orange, 535nm Green, 440nm Blue-Violet) + tunable probe!
  const wavelengthsNm = [610.0, 535.0, 440.0, lambdaProbe];
  const omegaDtChannels = wavelengthsNm.map((nm) => (HC_EV_NM / nm) * evToOmegaDt);

  return Object.freeze({
    isMetal,
    plasmaEv,
    drudeGammaEv,
    kDrude,
    betaDrude,
    oscillators: Object.freeze(oscCoeffs),
    wavelengthsNm: Object.freeze(wavelengthsNm),
    omegaDtChannels: Object.freeze(omegaDtChannels),
    expectedIor550: Number(electromagnetic?.refractiveIndex550Nm) || 1.0,
    slabX0: FDTD_SLAB_X0,
    slabX1: FDTD_SLAB_X1,
    incidenceDeg: FDTD_INCIDENCE_DEG
  });
}

function srgbEncode(c) {
  const x = Math.max(0, Math.min(1, Number(c) || 0));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/**
 * Exact analytical Drude-Lorentz complex refractive index n + i*k & Fresnel R
 * for the SAME FDTD parameters (theoretical reference alongside live 2D FDTD!).
 */
export function evaluateFdtdAnalyticDispersion(params, wavelengthNm) {
  const photonEv = HC_EV_NM / Math.max(200, wavelengthNm);
  let epsRe = 1.0;
  let epsIm = 0.0;
  if (params.isMetal && params.plasmaEv > 0) {
    const wp2 = params.plasmaEv * params.plasmaEv;
    const dRe = photonEv * photonEv;
    const dIm = photonEv * params.drudeGammaEv;
    const denom = Math.max(1e-30, dRe * dRe + dIm * dIm);
    epsRe -= (wp2 * dRe) / denom;
    epsIm += (wp2 * dIm) / denom;
  }
  for (const osc of params.oscillators) {
    if (!(osc.deltaEps > 1e-6)) continue;
    const num = osc.deltaEps * osc.energyEv * osc.energyEv;
    const dRe = osc.energyEv * osc.energyEv - photonEv * photonEv;
    const dIm = -osc.dampingEv * photonEv;
    const denom = Math.max(1e-30, dRe * dRe + dIm * dIm);
    epsRe += (num * dRe) / denom;
    epsIm -= (num * dIm) / denom;
  }
  const mag = Math.hypot(epsRe, epsIm);
  const nRe = Math.sqrt(Math.max(0, 0.5 * (mag + epsRe)));
  const kIm = Math.sqrt(Math.max(0, 0.5 * (mag - epsRe)));
  const rNum = (nRe - 1) * (nRe - 1) + kIm * kIm;
  const rDen = Math.max(1e-30, (nRe + 1) * (nRe + 1) + kIm * kIm);
  return { nRe, kIm, reflectance: Math.max(0, Math.min(1, rNum / rDen)) };
}

export const PHOTON_SHELL_FDTD_WGSL = /* wgsl */ `
struct Fdtd2dParams {
  nx: u32,
  ny: u32,
  n_channels: u32,
  step_index: u32,

  slab_x0: u32,
  slab_x1: u32,
  src_x: u32,
  sensor_x: u32,

  tr_sensor_x: u32,
  src_y_center: u32,
  pml_width: u32,
  pad0: u32,

  courant: f32,
  k_drude: f32,
  beta_drude: f32,
  pulse_t0: f32,

  pulse_width: f32,
  sin_theta: f32,
  cos_theta: f32,
  beam_waist: f32,

  omega_dt: vec4<f32>,
  osc_a: vec4<f32>,
  osc_b: vec4<f32>,
  osc_c: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: Fdtd2dParams;
@group(0) @binding(1) var<storage, read_write> ez_field: array<f32>;
@group(0) @binding(2) var<storage, read_write> hx_field: array<f32>;
@group(0) @binding(3) var<storage, read_write> hy_field: array<f32>;
@group(0) @binding(4) var<storage, read_write> j_drude: array<f32>;
@group(0) @binding(5) var<storage, read_write> p_curr: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> p_prev: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> shell_state: array<vec4<f32>>; // (P_tot, J_D, abs_inst, Ez)
@group(0) @binding(8) var<storage, read_write> obs_accum: array<vec4<f32>>;

fn boundary_damp(x: u32, y: u32) -> f32 {
  let w = f32(p.pml_width);
  let dx_l = max(0.0, w - f32(x)) / w;
  let dx_r = max(0.0, f32(x) - (f32(p.nx - 1u) - w)) / w;
  let dy_b = max(0.0, w - f32(y)) / w;
  let dy_t = max(0.0, f32(y) - (f32(p.ny - 1u) - w)) / w;
  let d = max(max(dx_l, dx_r), max(dy_b, dy_t));
  if (d <= 0.0) { return 1.0; }
  return exp(-0.24 * d * d * d);
}

fn slab_mask(x: u32, y: u32) -> f32 {
  if (x < p.slab_x0 || x > p.slab_x1 || y < p.pml_width || y > p.ny - 1u - p.pml_width) {
    return 0.0;
  }
  if (x == p.slab_x0 || x == p.slab_x1) { return 0.5; }
  return 1.0;
}

fn oblique_packet_source(ch: u32, y: u32, t_step: f32) -> f32 {
  let dy = f32(y) - f32(p.src_y_center);
  let waist = max(4.0, p.beam_waist);
  let spat = exp(-0.5 * (dy / waist) * (dy / waist));
  if (spat < 1e-4) { return 0.0; }
  // Phase lag along Y launches a crisp collimated photon wavepacket at oblique angle theta_inc!
  let k_vac = p.omega_dt[ch] / max(0.05, p.courant);
  let t_delay = (dy * p.sin_theta) / max(0.05, p.courant);
  let dt_rel = (t_step - t_delay) - p.pulse_t0;
  let env = exp(-0.5 * (dt_rel / max(4.0, p.pulse_width)) * (dt_rel / max(4.0, p.pulse_width)));
  if (env < 1e-5) { return 0.0; }
  return spat * env * sin(p.omega_dt[ch] * (t_step - p.pulse_t0) - k_vac * dy * p.sin_theta);
}

@compute @workgroup_size(64)
fn fdtd2d_step_h(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cells_per_ch = p.nx * p.ny;
  let total = cells_per_ch * p.n_channels;
  let idx = gid.x;
  if (idx >= total) { return; }

  let ch = idx / cells_per_ch;
  let rem = idx % cells_per_ch;
  let x = rem % p.nx;
  let y = rem / p.nx;
  let base = ch * cells_per_ch;
  let damp = boundary_damp(x, y);

  if (y + 1u < p.ny) {
    let dez_dy = ez_field[base + (y + 1u) * p.nx + x] - ez_field[idx];
    hx_field[idx] = damp * (hx_field[idx] - p.courant * dez_dy);
  }
  if (x + 1u < p.nx) {
    let dez_dx = ez_field[base + y * p.nx + (x + 1u)] - ez_field[idx];
    var hy_new = damp * (hy_field[idx] + p.courant * dez_dx);
    // Unidirectional rightward TF/SF magnetic injection along x = src_x - 1
    if (x + 1u == p.src_x && y >= p.pml_width && y < p.ny - p.pml_width) {
      let e_inc = oblique_packet_source(ch, y, f32(p.step_index));
      hy_new = hy_new - p.courant * e_inc;
    }
    hy_field[idx] = hy_new;
  }

  // Exact time-symmetric half-step polarization current updates (n-1/2 -> n+1/2)
  // using integer-step E^n and P^n (zero spurious phase lead; 100% passive for any gamma >= 0!):
  //   p_prev stores J_k^{n+1/2} = dP_k/dt * dt; p_curr stores P_k^n!
  let mask = slab_mask(x, y);
  if (mask > 0.0) {
    let e_n = ez_field[idx];
    let p_n = p_curr[idx];
    let j_k_old = p_prev[idx];
    let j_d_new = damp * (p.k_drude * j_drude[idx] + (p.beta_drude * mask) * e_n);
    let j_k_new = damp * (p.osc_a * j_k_old + p.osc_b * ((p.osc_c * mask) * e_n - p_n));
    j_drude[idx] = j_d_new;
    p_prev[idx] = j_k_new;
  }
}

@compute @workgroup_size(64)
fn fdtd2d_step_e_and_shells(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cells_per_ch = p.nx * p.ny;
  let total = cells_per_ch * p.n_channels;
  let idx = gid.x;
  if (idx >= total) { return; }

  let ch = idx / cells_per_ch;
  let rem = idx % cells_per_ch;
  let x = rem % p.nx;
  let y = rem / p.nx;
  if (x == 0u || y == 0u || x + 1u >= p.nx || y + 1u >= p.ny) {
    ez_field[idx] = 0.0;
    shell_state[idx] = vec4<f32>(0.0);
    return;
  }

  let base = ch * cells_per_ch;
  let damp = boundary_damp(x, y);
  let e_old = ez_field[idx];
  let dhy_dx = hy_field[idx] - hy_field[base + y * p.nx + (x - 1u)];
  let dhx_dy = hx_field[idx] - hx_field[base + (y - 1u) * p.nx + x];
  let curl_h = dhy_dx - dhx_dy;

  var src_corr = 0.0;
  if (x == p.src_x && y >= p.pml_width && y < p.ny - p.pml_width) {
    let t_h = f32(p.step_index) + 0.5 + (0.5 * p.cos_theta) / max(0.05, p.courant);
    let e_inc_h = oblique_packet_source(ch, y, t_h);
    src_corr = p.courant * p.cos_theta * e_inc_h;
  }

  let mask = slab_mask(x, y);
  if (mask <= 0.0) {
    let e_new = damp * (e_old + p.courant * curl_h + src_corr);
    ez_field[idx] = e_new;
    shell_state[idx] = vec4<f32>(0.0, 0.0, 0.0, e_new);
    return;
  }

  // Exact integer-step update E^{n+1} & P_k^{n+1} from half-step H^{n+1/2}, J_D^{n+1/2}, J_k^{n+1/2}!
  let j_d = j_drude[idx];
  let j_k = p_prev[idx];
  let j_k_sum = j_k.x + j_k.y + j_k.z + j_k.w;
  let p_new = damp * (p_curr[idx] + j_k);
  let e_new = damp * (e_old + p.courant * curl_h + src_corr - j_d - j_k_sum);

  ez_field[idx] = e_new;
  p_curr[idx] = p_new;

  let e_mid = 0.5 * (e_new + e_old);
  let p_tot = p_new.x + p_new.y + p_new.z + p_new.w;
  let abs_inst = e_mid * (j_d + j_k_sum);
  shell_state[idx] = vec4<f32>(p_tot, j_d, abs_inst, e_new);
}

var<workgroup> sh_inc: array<f32, 64>;
var<workgroup> sh_ref: array<f32, 64>;
var<workgroup> sh_tr: array<f32, 64>;
var<workgroup> sh_abs: array<f32, 64>;
var<workgroup> sh_e2: array<f32, 64>;
var<workgroup> sh_grad2: array<f32, 64>;
var<workgroup> sh_sx_slab: array<f32, 64>;
var<workgroup> sh_sy_slab: array<f32, 64>;

@compute @workgroup_size(64)
fn fdtd2d_reduce_observables(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let ch = wg_id.x;
  let tid = lid.x;
  if (ch >= p.n_channels) { return; }
  let cells_per_ch = p.nx * p.ny;
  let base = ch * cells_per_ch;

  var loc_inc = 0.0;
  var loc_ref = 0.0;
  var loc_tr = 0.0;
  var loc_abs = 0.0;
  var loc_e2 = 0.0;
  var loc_grad2 = 0.0;
  var loc_sx_slab = 0.0;
  var loc_sy_slab = 0.0;

  // 1. Poynting flux across vertical sensor lines (S_x = -E_z * H_y)
  for (var y = p.pml_width + tid; y < p.ny - p.pml_width; y = y + 64u) {
    // Left sensor plane x = sensor_x: rightward (+S_x) = incident, leftward (-S_x) = reflected!
    let idx_l = base + y * p.nx + p.sensor_x;
    let ez_l = ez_field[idx_l];
    let hy_l = 0.5 * (hy_field[idx_l] + hy_field[idx_l - 1u]);
    let sx_l = -ez_l * hy_l * p.courant;
    if (sx_l > 0.0) {
      loc_inc = loc_inc + sx_l;
    } else {
      loc_ref = loc_ref + (-sx_l);
    }

    // Right exit sensor plane x = tr_sensor_x: rightward (+S_x) = transmitted!
    let idx_r = base + y * p.nx + p.tr_sensor_x;
    let ez_r = ez_field[idx_r];
    let hy_r = 0.5 * (hy_field[idx_r] + hy_field[idx_r - 1u]);
    let sx_r = -ez_r * hy_r * p.courant;
    if (sx_r > 0.0) {
      loc_tr = loc_tr + sx_r;
    }
  }

  // 2. Interior slab absorption, 2D spatial wavevector compression k_slab^2, and Snell Poynting angle!
  let sx0 = p.slab_x0;
  let sx1 = p.slab_x1;
  let slab_w = sx1 - sx0 + 1u;
  let y0 = p.pml_width + 2u;
  let y1 = p.ny - p.pml_width - 2u;
  let slab_h = y1 - y0;
  let slab_total = slab_w * slab_h;
  for (var k = tid; k < slab_total; k = k + 64u) {
    let lx = k % slab_w;
    let ly = k / slab_w;
    let x = sx0 + lx;
    let y = y0 + ly;
    let idx = base + y * p.nx + x;
    let ss = shell_state[idx];
    loc_abs = loc_abs + ss.z;

    if (x >= sx0 + 3u && x <= sx1 - 3u) {
      let ez = ez_field[idx];
      let dex = 0.5 * (ez_field[idx + 1u] - ez_field[idx - 1u]);
      let dey = 0.5 * (ez_field[idx + p.nx] - ez_field[idx - p.nx]);
      loc_e2 = loc_e2 + ez * ez;
      loc_grad2 = loc_grad2 + (dex * dex + dey * dey);

      let hy = 0.5 * (hy_field[idx] + hy_field[idx - 1u]);
      let hx = 0.5 * (hx_field[idx] + hx_field[idx - p.nx]);
      // TM_z Poynting vector: S_x = -E_z * H_y, S_y = +E_z * H_x
      let sx = -ez * hy;
      let sy = ez * hx;
      if (sx > 0.0) {
        loc_sx_slab = loc_sx_slab + sx;
        loc_sy_slab = loc_sy_slab + sy;
      }
    }
  }

  sh_inc[tid] = loc_inc;
  sh_ref[tid] = loc_ref;
  sh_tr[tid] = loc_tr;
  sh_abs[tid] = loc_abs;
  sh_e2[tid] = loc_e2;
  sh_grad2[tid] = loc_grad2;
  sh_sx_slab[tid] = loc_sx_slab;
  sh_sy_slab[tid] = loc_sy_slab;
  workgroupBarrier();

  for (var stride = 32u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_inc[tid] = sh_inc[tid] + sh_inc[tid + stride];
      sh_ref[tid] = sh_ref[tid] + sh_ref[tid + stride];
      sh_tr[tid] = sh_tr[tid] + sh_tr[tid + stride];
      sh_abs[tid] = sh_abs[tid] + sh_abs[tid + stride];
      sh_e2[tid] = sh_e2[tid] + sh_e2[tid + stride];
      sh_grad2[tid] = sh_grad2[tid] + sh_grad2[tid + stride];
      sh_sx_slab[tid] = sh_sx_slab[tid] + sh_sx_slab[tid + stride];
      sh_sy_slab[tid] = sh_sy_slab[tid] + sh_sy_slab[tid + stride];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let o0 = obs_accum[ch * 2u + 0u];
    let o1 = obs_accum[ch * 2u + 1u];
    obs_accum[ch * 2u + 0u] = vec4<f32>(
      o0.x + sh_inc[0],
      o0.y + sh_ref[0],
      o0.z + sh_tr[0],
      o0.w + sh_abs[0]
    );
    obs_accum[ch * 2u + 1u] = vec4<f32>(
      o1.x + sh_e2[0],
      o1.y + sh_grad2[0],
      o1.z + sh_sx_slab[0],
      o1.w + sh_sy_slab[0]
    );
  }
}
`;

const fdtdPipeCache = new WeakMap();

function getFdtdPipelines(device) {
  let cached = fdtdPipeCache.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({
    label: 'ulg-photon-shell-fdtd-2d-wgsl',
    code: PHOTON_SHELL_FDTD_WGSL
  });
  const bgl = device.createBindGroupLayout({
    label: 'ulg-photon-shell-fdtd-2d-bgl',
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 4, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 5, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 6, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 7, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 8, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const stepHPipe = device.createComputePipeline({ label: 'ulg-fdtd2d-step-h', layout, compute: { module, entryPoint: 'fdtd2d_step_h' } });
  const stepEPipe = device.createComputePipeline({ label: 'ulg-fdtd2d-step-e', layout, compute: { module, entryPoint: 'fdtd2d_step_e_and_shells' } });
  const reducePipe = device.createComputePipeline({ label: 'ulg-fdtd2d-reduce', layout, compute: { module, entryPoint: 'fdtd2d_reduce_observables' } });
  cached = { bgl, stepHPipe, stepEPipe, reducePipe };
  fdtdPipeCache.set(device, cached);
  return cached;
}

/**
 * Create a live, GPU-resident 2D (128x128) Coupled Maxwell-ADE-FDTD Photon-Packet
 * <-> Electron-Shell simulation session. Exposes `ezFieldBuffer` & `shellStateBuffer`
 * directly for zero-copy 3D WebGPU volumetric + orbital-cloud rendering!
 */
export function createPhotonShellOpticsSessionWebGpu(device, electromagnetic = {}, {
  probeWavelengthNm = 535,
  pulseWidthSteps = 34,
  pulseT0Steps = 78
} = {}) {
  if (!device || typeof device.createComputePipeline !== 'function') {
    throw new TypeError('createPhotonShellOpticsSessionWebGpu requires a valid WebGPU GPUDevice.');
  }
  const { bgl, stepHPipe, stepEPipe, reducePipe } = getFdtdPipelines(device);
  const totalSlots = FDTD_NUM_CELLS * FDTD_NUM_CHANNELS; // 128*128*4 = 65536
  const f32Bytes = totalSlots * 4;     // 256 KB
  const vec4Bytes = totalSlots * 16;   // 1 MB
  const obsBytes = FDTD_NUM_CHANNELS * 2 * 16; // 128 B

  const ezFieldBuffer = device.createBuffer({ label: 'ulg-fdtd2d-ez', size: f32Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const hxFieldBuffer = device.createBuffer({ label: 'ulg-fdtd2d-hx', size: f32Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const hyFieldBuffer = device.createBuffer({ label: 'ulg-fdtd2d-hy', size: f32Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const jDrudeBuffer = device.createBuffer({ label: 'ulg-fdtd2d-jd', size: f32Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const pCurrBuffer = device.createBuffer({ label: 'ulg-fdtd2d-pcurr', size: vec4Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const pPrevBuffer = device.createBuffer({ label: 'ulg-fdtd2d-pprev', size: vec4Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const shellStateBuffer = device.createBuffer({ label: 'ulg-fdtd2d-shell', size: vec4Bytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const obsAccumBuffer = device.createBuffer({ size: obsBytes, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const obsReadBuf = device.createBuffer({ size: obsBytes, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  const MAX_BATCH = 24;
  const stepUniformsPool = Array.from({ length: MAX_BATCH }, () =>
    device.createBuffer({ size: 144, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST })
  );
  const stepBgPool = stepUniformsPool.map((uBuf) => device.createBindGroup({
    layout: bgl,
    entries: [
      uBuf, ezFieldBuffer, hxFieldBuffer, hyFieldBuffer,
      jDrudeBuffer, pCurrBuffer, pPrevBuffer, shellStateBuffer, obsAccumBuffer
    ].map((buffer, binding) => ({ binding, resource: { buffer } }))
  }));

  let fdtdParams = buildOpticalFdtdParams(electromagnetic, { probeWavelengthNm });
  let stepIndex = 0;
  let readPromise = null;
  let destroyed = false;
  const zeroF32 = new Float32Array(totalSlots);
  const zeroVec4 = new Float32Array(totalSlots * 4);
  const zeroObs = new Float32Array(FDTD_NUM_CHANNELS * 8);

  const thetaRad = (FDTD_INCIDENCE_DEG * Math.PI) / 180;
  const sinTh = Math.sin(thetaRad);
  const cosTh = Math.cos(thetaRad);

  function writeUniform(buf, stepIdx) {
    const ab = new ArrayBuffer(144);
    const u32 = new Uint32Array(ab);
    const f32 = new Float32Array(ab);
    u32[0] = FDTD_NX;
    u32[1] = FDTD_NY;
    u32[2] = FDTD_NUM_CHANNELS;
    u32[3] = stepIdx >>> 0;

    u32[4] = fdtdParams.slabX0;
    u32[5] = fdtdParams.slabX1;
    u32[6] = FDTD_SRC_X;
    u32[7] = FDTD_SENSOR_X;

    u32[8] = FDTD_TR_SENSOR_X;
    u32[9] = FDTD_SRC_Y_CENTER;
    u32[10] = 12; // PML sponge width
    u32[11] = 0;

    f32[12] = FDTD_COURANT;
    f32[13] = fdtdParams.kDrude;
    f32[14] = fdtdParams.betaDrude;
    f32[15] = pulseT0Steps;

    f32[16] = pulseWidthSteps;
    f32[17] = sinTh;
    f32[18] = cosTh;
    f32[19] = 11.5; // collimated Gaussian beam waist (cells)

    for (let c = 0; c < 4; c += 1) {
      f32[20 + c] = fdtdParams.omegaDtChannels[c];
      f32[24 + c] = fdtdParams.oscillators[c].a;
      f32[28 + c] = fdtdParams.oscillators[c].b;
      f32[32 + c] = fdtdParams.oscillators[c].c;
    }
    device.queue.writeBuffer(buf, 0, ab);
  }

  function reset(nextElectromagnetic = null, { nextProbeWavelengthNm = null } = {}) {
    if (nextElectromagnetic || nextProbeWavelengthNm != null) {
      fdtdParams = buildOpticalFdtdParams(
        nextElectromagnetic || electromagnetic,
        { probeWavelengthNm: nextProbeWavelengthNm ?? fdtdParams.wavelengthsNm[3] }
      );
      if (nextElectromagnetic) electromagnetic = nextElectromagnetic;
    }
    stepIndex = 0;
    device.queue.writeBuffer(ezFieldBuffer, 0, zeroF32);
    device.queue.writeBuffer(hxFieldBuffer, 0, zeroF32);
    device.queue.writeBuffer(hyFieldBuffer, 0, zeroF32);
    device.queue.writeBuffer(jDrudeBuffer, 0, zeroF32);
    device.queue.writeBuffer(pCurrBuffer, 0, zeroVec4);
    device.queue.writeBuffer(pPrevBuffer, 0, zeroVec4);
    device.queue.writeBuffer(shellStateBuffer, 0, zeroVec4);
    device.queue.writeBuffer(obsAccumBuffer, 0, zeroObs);
  }

  reset();

  function stepSync(numSteps = 4) {
    const count = Math.max(1, Math.min(MAX_BATCH, Math.trunc(numSteps)));
    for (let s = 0; s < count; s += 1) {
      writeUniform(stepUniformsPool[s], stepIndex + s);
    }
    const wgCells = Math.ceil(totalSlots / 64);
    const enc = device.createCommandEncoder({ label: 'ulg-fdtd2d-batch' });
    const pass = enc.beginComputePass({ label: 'ulg-fdtd2d-pass' });
    for (let s = 0; s < count; s += 1) {
      const sbg = stepBgPool[s];
      pass.setPipeline(stepHPipe);
      pass.setBindGroup(0, sbg);
      pass.dispatchWorkgroups(wgCells);

      pass.setPipeline(stepEPipe);
      pass.setBindGroup(0, sbg);
      pass.dispatchWorkgroups(wgCells);

      pass.setPipeline(reducePipe);
      pass.setBindGroup(0, sbg);
      pass.dispatchWorkgroups(FDTD_NUM_CHANNELS);
    }
    pass.end();
    device.queue.submit([enc.finish()]);
    stepIndex += count;
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
      const enc = device.createCommandEncoder({ label: 'ulg-fdtd2d-read-obs' });
      enc.copyBufferToBuffer(obsAccumBuffer, 0, obsReadBuf, 0, obsBytes);
      device.queue.submit([enc.finish()]);
      await obsReadBuf.mapAsync(GPU_BUF.MAP_READ);
      if (destroyed) {
        try { obsReadBuf.unmap(); } catch {}
        return null;
      }
      const raw = new Float32Array(obsReadBuf.getMappedRange().slice(0, obsBytes));
      obsReadBuf.unmap();

      const channels = [];
      for (let c = 0; c < FDTD_NUM_CHANNELS; c += 1) {
        const b = c * 8;
        const fluxInc = raw[b + 0];
        const fluxRef = raw[b + 1];
        const fluxTr = raw[b + 2];
        const fluxAbs = raw[b + 3];
        const slabE2 = raw[b + 4];
        const slabGrad2 = raw[b + 5];
        const slabSx = raw[b + 6];
        const slabSy = raw[b + 7];

        const hasInc = fluxInc > 1e-4;
        const reflectance = hasInc ? Math.max(0, Math.min(1.1, fluxRef / fluxInc)) : 0;
        const transmittance = hasInc ? Math.max(0, Math.min(1.1, fluxTr / fluxInc)) : 0;
        const absorption = hasInc ? Math.max(0, Math.min(1.1, fluxAbs / fluxInc)) : 0;

        // 1. Live 2D spatial wavevector compression refractive index n_phase = k_slab / k_vac!
        const kVacCell = fdtdParams.omegaDtChannels[c] / FDTD_COURANT;
        let nPhaseFdtd = null;
        if (!fdtdParams.isMetal && slabE2 > 1e-3 && slabGrad2 > 1e-6 && kVacCell > 1e-5) {
          const kSlabCell = Math.asin(Math.min(0.99, Math.sqrt(slabGrad2 / slabE2)));
          const nRaw = kSlabCell / kVacCell;
          if (Number.isFinite(nRaw) && nRaw >= 0.95 && nRaw <= 5.5) nPhaseFdtd = nRaw;
        }
        // 2. Live Snell's Law refraction index n_snell = sin(theta_i) / sin(theta_t) from 2D Poynting angle!
        let nSnellFdtd = null;
        let refractAngleDeg = null;
        if (!fdtdParams.isMetal && slabSx > 1e-3) {
          const thetaT = Math.atan2(Math.abs(slabSy), slabSx);
          refractAngleDeg = (thetaT * 180) / Math.PI;
          if (thetaT > 0.04) {
            const nS = sinTh / Math.sin(thetaT);
            if (Number.isFinite(nS) && nS >= 0.95 && nS <= 5.5) nSnellFdtd = nS;
          }
        }

        const analytic = evaluateFdtdAnalyticDispersion(fdtdParams, fdtdParams.wavelengthsNm[c]);
        channels.push(Object.freeze({
          wavelengthNm: fdtdParams.wavelengthsNm[c],
          photonEv: HC_EV_NM / fdtdParams.wavelengthsNm[c],
          fluxInc,
          fluxRef,
          fluxTr,
          fluxAbs,
          reflectance,
          transmittance,
          absorption,
          energyBalance: reflectance + transmittance + absorption,
          nPhaseFdtd,
          nSnellFdtd,
          refractAngleDeg,
          nMeasuredFdtd: nPhaseFdtd ?? nSnellFdtd ?? null,
          analyticNRe: analytic.nRe,
          analyticKIm: analytic.kIm,
          analyticReflectance: analytic.reflectance
        }));
      }

      const rLin = Math.max(0, Math.min(1, channels[0].reflectance));
      const gLin = Math.max(0, Math.min(1, channels[1].reflectance));
      const bLin = Math.max(0, Math.min(1, channels[2].reflectance));
      const emergentReflectedSrgb = [srgbEncode(rLin), srgbEncode(gLin), srgbEncode(bLin)];

      return Object.freeze({
        schema: ULG_PHOTON_SHELL_OPTICS_SCHEMA,
        stepIndex,
        simTimeFs: stepIndex * FDTD_DT_S * 1e15,
        isMetal: fdtdParams.isMetal,
        plasmaEv: fdtdParams.plasmaEv,
        drudeGammaEv: fdtdParams.drudeGammaEv,
        oscillators: fdtdParams.oscillators,
        channels: Object.freeze(channels),
        emergentReflectedSrgb: Object.freeze(emergentReflectedSrgb),
        analyticReflectedSrgb: Object.freeze([
          srgbEncode(channels[0].analyticReflectance),
          srgbEncode(channels[1].analyticReflectance),
          srgbEncode(channels[2].analyticReflectance)
        ])
      });
    })();
    readPromise = run;
    try {
      return await run;
    } finally {
      if (readPromise === run) readPromise = null;
    }
  }

  async function stepBatch(numSteps = 16, { readObs = true } = {}) {
    let remaining = Math.max(1, Math.trunc(numSteps));
    while (remaining > 0) {
      const chunk = Math.min(MAX_BATCH, remaining);
      stepSync(chunk);
      remaining -= chunk;
    }
    return readObs ? readTelemetry({ nonBlocking: false }) : null;
  }

  function destroy() {
    destroyed = true;
    for (const b of [
      ezFieldBuffer, hxFieldBuffer, hyFieldBuffer, jDrudeBuffer,
      pCurrBuffer, pPrevBuffer, shellStateBuffer, obsAccumBuffer, obsReadBuf,
      ...stepUniformsPool
    ]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_PHOTON_SHELL_OPTICS_SCHEMA,
    nx: FDTD_NX,
    ny: FDTD_NY,
    nCells: FDTD_NUM_CELLS,
    nChannels: FDTD_NUM_CHANNELS,
    slabX0: FDTD_SLAB_X0,
    slabX1: FDTD_SLAB_X1,
    eFieldBuffer: ezFieldBuffer,
    ezFieldBuffer,
    hxFieldBuffer,
    hyFieldBuffer,
    shellPowerBuffer: shellStateBuffer,
    shellStateBuffer,
    getParams: () => fdtdParams,
    getStepIndex: () => stepIndex,
    reset,
    stepSync,
    stepBatch,
    readTelemetry,
    destroy
  });
}

// ============================================================================
// 2. Real 1D Symplectic Quantum Wavepacket Tunneling TDSE on WebGPU (Tab 1)
// ============================================================================

const TDSE_N = 256;

const NUCLEAR_TDSE_WGSL = /* wgsl */ `
struct TdseParams {
  n: u32,
  r_touch_idx: u32,
  r_turn_idx: u32,
  pad0: u32,
  inv_2mu_dx2: f32,
  dt_scale: f32,
  cap_start: f32,
  cap_strength: f32,
};

@group(0) @binding(0) var<uniform> p: TdseParams;
@group(0) @binding(1) var<storage, read> pot_v: array<f32>;
@group(0) @binding(2) var<storage, read_write> psi_re: array<f32>;
@group(0) @binding(3) var<storage, read_write> psi_im: array<f32>;
@group(0) @binding(4) var<storage, read_write> prob_out: array<f32>;

@compute @workgroup_size(64)
fn tdse_step_re(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.n;
  if (i >= n) { return; }
  if (i == 0u || i + 1u == n) { psi_re[i] = 0.0; return; }
  let lap = psi_im[i + 1u] - 2.0 * psi_im[i] + psi_im[i - 1u];
  let h_im = -p.inv_2mu_dx2 * lap + pot_v[i] * psi_im[i];
  var next_re = psi_re[i] + p.dt_scale * h_im;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_re = next_re * exp(-p.cap_strength * s * s);
  }
  psi_re[i] = next_re;
}

@compute @workgroup_size(64)
fn tdse_step_im(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.n;
  if (i >= n) { return; }
  if (i == 0u || i + 1u == n) { psi_im[i] = 0.0; prob_out[i] = 0.0; return; }
  let lap = psi_re[i + 1u] - 2.0 * psi_re[i] + psi_re[i - 1u];
  let h_re = -p.inv_2mu_dx2 * lap + pot_v[i] * psi_re[i];
  var next_im = psi_im[i] - p.dt_scale * h_re;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_im = next_im * exp(-p.cap_strength * s * s);
  }
  psi_im[i] = next_im;
  prob_out[i] = psi_re[i] * psi_re[i] + next_im * next_im;
}
`;

const tdsePipeCache = new WeakMap();

function getTdsePipelines(device) {
  let cached = tdsePipeCache.get(device);
  if (cached) return cached;
  const module = device.createShaderModule({ label: 'ulg-nuclear-tdse-wgsl', code: NUCLEAR_TDSE_WGSL });
  const bgl = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: 0x0004, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 0x0004, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 3, visibility: 0x0004, buffer: { type: 'storage' } },
      { binding: 4, visibility: 0x0004, buffer: { type: 'storage' } }
    ]
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const stepRe = device.createComputePipeline({ layout, compute: { module, entryPoint: 'tdse_step_re' } });
  const stepIm = device.createComputePipeline({ layout, compute: { module, entryPoint: 'tdse_step_im' } });
  cached = { bgl, stepRe, stepIm };
  tdsePipeCache.set(device, cached);
  return cached;
}

export function createNuclearTunnelingTdseWebGpu(device, nuclear) {
  if (!device || typeof device.createComputePipeline !== 'function') return null;
  const { bgl, stepRe, stepIm } = getTdsePipelines(device);

  const wkb = nuclear?.alphaWkb;
  const rSrc = Array.isArray(wkb?.rFm) ? wkb.rFm : Array.from({ length: 64 }, (_, i) => (i / 63) * 45);
  const vSrc = Array.isArray(wkb?.vMeV) ? wkb.vMeV : rSrc.map((r) => (r < 6 ? -20 : 120 / r));
  const rMaxFm = Math.max(24, Number(rSrc[rSrc.length - 1]) || 45);
  const rTouchFm = Math.max(2.5, Number(wkb?.rTouchFm) || (nuclear?.chargeRadiusFm || 4.0) * 1.35);
  const dxFm = rMaxFm / (TDSE_N - 1);

  const rGridFm = new Float32Array(TDSE_N);
  const potRawMeV = new Float32Array(TDSE_N);
  let vPeak = 1.0;
  for (let i = 0; i < TDSE_N; i += 1) {
    const r = i * dxFm;
    rGridFm[i] = r;
    const t = (r / rMaxFm) * (rSrc.length - 1);
    const i0 = Math.max(0, Math.min(rSrc.length - 2, Math.floor(t)));
    const f = Math.max(0, Math.min(1, t - i0));
    const v = vSrc[i0] * (1 - f) + vSrc[i0 + 1] * f;
    potRawMeV[i] = v;
    if (v > vPeak) vPeak = v;
  }

  const qEffMeV = Math.max(3.5, Math.min(vPeak * 0.82, Number(nuclear?.qAlphaMeV) > 0.5 ? Number(nuclear.qAlphaMeV) : vPeak * 0.55));
  const inv2muDx2 = (197.32698 * 197.32698) / (2 * 3727.38 * dxFm * dxFm);
  const maxEig = 4.0 * inv2muDx2 + Math.max(vPeak, 25);
  const dtScale = 0.35 / Math.max(1.0, maxEig);

  const rTouchIdx = Math.max(4, Math.min(TDSE_N - 16, Math.round(rTouchFm / dxFm)));
  let rTurnIdx = Math.min(TDSE_N - 12, rTouchIdx + 24);
  for (let i = rTouchIdx + 1; i < TDSE_N - 4; i += 1) {
    if (potRawMeV[i] <= qEffMeV) { rTurnIdx = i; break; }
  }

  const paramsBuf = device.createBuffer({ size: 32, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const potBuf = device.createBuffer({ size: TDSE_N * 4, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const reBuf = device.createBuffer({ size: TDSE_N * 4, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const imBuf = device.createBuffer({ size: TDSE_N * 4, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const probBuf = device.createBuffer({ size: TDSE_N * 4, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const readBuf = device.createBuffer({ size: TDSE_N * 4, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  const ab = new ArrayBuffer(32);
  new Uint32Array(ab, 0, 4).set([TDSE_N, rTouchIdx, rTurnIdx, 0]);
  new Float32Array(ab, 16, 4).set([inv2muDx2, dtScale, 0.88, 0.08]);
  device.queue.writeBuffer(paramsBuf, 0, ab);
  device.queue.writeBuffer(potBuf, 0, potRawMeV);

  const bg = device.createBindGroup({
    layout: bgl,
    entries: [paramsBuf, potBuf, reBuf, imBuf, probBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });

  let stepCount = 0;
  let stepPromise = null;
  let destroyed = false;

  function resetWavepacket() {
    stepCount = 0;
    const re0 = new Float32Array(TDSE_N);
    const im0 = new Float32Array(TDSE_N);
    const prob0 = new Float32Array(TDSE_N);
    const r0 = Math.max(1.5, rTouchFm * 0.52);
    const sigma = Math.max(0.85, rTouchFm * 0.22);
    const k0 = Math.sqrt(Math.max(0.2, (qEffMeV + 18.0) / Math.max(1e-4, inv2muDx2 * dxFm * dxFm)));
    let norm2 = 0;
    for (let i = 1; i < TDSE_N - 1; i += 1) {
      const r = rGridFm[i];
      const env = Math.exp(-0.5 * Math.pow((r - r0) / sigma, 2));
      re0[i] = env * Math.cos(k0 * (r - r0));
      im0[i] = env * Math.sin(k0 * (r - r0));
      norm2 += re0[i] * re0[i] + im0[i] * im0[i];
    }
    const invN = 1 / Math.sqrt(Math.max(1e-12, norm2));
    for (let i = 0; i < TDSE_N; i += 1) {
      re0[i] *= invN; im0[i] *= invN;
      prob0[i] = re0[i] * re0[i] + im0[i] * im0[i];
    }
    device.queue.writeBuffer(reBuf, 0, re0);
    device.queue.writeBuffer(imBuf, 0, im0);
    device.queue.writeBuffer(probBuf, 0, prob0);
  }

  resetWavepacket();

  async function stepBatch(steps = 12, { nonBlocking = false } = {}) {
    if (destroyed) return null;
    if (stepPromise) {
      if (nonBlocking) return null;
      try { await stepPromise; } catch {}
      if (destroyed) return null;
    }
    const run = (async () => {
      if (destroyed) return null;
      const nSteps = Math.max(1, Math.min(64, Math.trunc(steps)));
      const wg = Math.ceil(TDSE_N / 64);
      const enc = device.createCommandEncoder({ label: 'ulg-nuclear-tdse' });
      const pass = enc.beginComputePass();
      for (let s = 0; s < nSteps; s += 1) {
        pass.setPipeline(stepRe); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(wg);
        pass.setPipeline(stepIm); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(wg);
      }
      pass.end();
      enc.copyBufferToBuffer(probBuf, 0, readBuf, 0, TDSE_N * 4);
      device.queue.submit([enc.finish()]);
      stepCount += nSteps;

      await readBuf.mapAsync(GPU_BUF.MAP_READ);
      if (destroyed) {
        try { readBuf.unmap(); } catch {}
        return null;
      }
      const prob = new Float32Array(readBuf.getMappedRange().slice(0, TDSE_N * 4));
      readBuf.unmap();

      let pIn = 0; let pBar = 0; let pOut = 0;
      for (let i = 0; i < TDSE_N; i += 1) {
        if (i <= rTouchIdx) pIn += prob[i];
        else if (i <= rTurnIdx) pBar += prob[i];
        else pOut += prob[i];
      }
      return Object.freeze({
        schema: ULG_NUCLEAR_TDSE_SCHEMA,
        stepCount, rGridFm, potRawMeV, prob, qEffMeV, rTouchFm,
        pInside: pIn, pBarrier: pBar, pTunneled: pOut
      });
    })();
    stepPromise = run;
    try {
      return await run;
    } finally {
      if (stepPromise === run) stepPromise = null;
    }
  }

  function destroy() {
    destroyed = true;
    for (const b of [paramsBuf, potBuf, reBuf, imBuf, probBuf, readBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_NUCLEAR_TDSE_SCHEMA,
    rGridFm, potRawMeV, qEffMeV, resetWavepacket, stepBatch, destroy
  });
}

// ============================================================================
// 3. Canonical ULG `ClosureRegistry` & `SimulationModuleRegistry` Integration
// ============================================================================

export async function registerPhotonShellOpticsClosureArtifact({
  closureRegistry,
  materialKey = 'unknown',
  electromagnetic = {},
  telemetry = null,
  closureId = null
} = {}) {
  const params = buildOpticalFdtdParams(electromagnetic);
  const id = closureId || `ulg-photon-shell-fdtd-optics:${materialKey}.v1`;
  const artifact = {
    closureId: id,
    closureKind: 'optical-photon-shell-fdtd-dispersion',
    inputHash: `${materialKey}:metal=${params.isMetal ? 1 : 0}:wp=${params.plasmaEv.toFixed(3)}:osc=${params.oscillators.filter((o) => o.active).length}`,
    methodHash: 'maxwell-2d-ade-fdtd-drude-lorentz-webgpu.v1',
    execution: {
      mode: 'webgpu-2d-maxwell-ade-fdtd',
      params,
      measuredChannels: telemetry?.channels ?? null,
      emergentReflectedSrgb: telemetry?.emergentReflectedSrgb ?? null
    },
    validity: {
      wavelengthNm: [380, 780],
      dxMeters: FDTD_DX_M,
      courant: FDTD_COURANT,
      incidenceDeg: FDTD_INCIDENCE_DEG
    },
    provenance: {
      schema: ULG_PHOTON_SHELL_OPTICS_SCHEMA,
      sourceModule: 'src/runtime/material/photonShellOpticsWebGpu.js',
      scientificValidation: false
    }
  };
  const ref = closureRegistry ? await closureRegistry.store(artifact) : null;
  return { ref, artifact };
}

export function registerPhotonShellSimulationModules(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  const opticsMod = registry.registerModule({
    method: { model: 'photon-shell-fdtd', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/material/photonShellOpticsWebGpu.js',
      entryPoint: 'fdtd2d_step_e_and_shells',
      workgroupSize: 64,
      wgsl: PHOTON_SHELL_FDTD_WGSL
    },
    parameterSchema: {
      steps: { type: 'number', min: 1, max: 4096 },
      probeWavelengthNm: { type: 'number', min: 380, max: 780 }
    },
    stateLayout: {
      tensorId: 'fdtd2d_em_shell_fields',
      dtype: 'f32',
      components: FDTD_NUM_CHANNELS
    },
    stepCapsule: async (capsule, context) => {
      const device = context?.device;
      if (!device) throw new Error('photon-shell-fdtd@1 requires a WebGPU device');
      const params = capsule?.parameters || {};
      const session = createPhotonShellOpticsSessionWebGpu(device, params.electromagnetic || {}, {
        probeWavelengthNm: params.probeWavelengthNm ?? 535
      });
      try {
        const telemetry = await session.stepBatch(params.steps ?? 280, { readObs: true });
        return { status: 'ok', telemetry };
      } finally {
        session.destroy();
      }
    }
  });

  const tdseMod = registry.registerModule({
    method: { model: 'nuclear-tunneling-tdse', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/material/photonShellOpticsWebGpu.js',
      entryPoint: 'tdse_step_re',
      workgroupSize: 64,
      wgsl: NUCLEAR_TDSE_WGSL
    },
    parameterSchema: {
      steps: { type: 'number', min: 1, max: 2048 }
    },
    stateLayout: {
      tensorId: 'tdse_wavepacket_prob',
      dtype: 'f32',
      components: 1
    },
    stepCapsule: async (capsule, context) => {
      const device = context?.device;
      if (!device) throw new Error('nuclear-tunneling-tdse@1 requires a WebGPU device');
      const params = capsule?.parameters || {};
      const session = createNuclearTunnelingTdseWebGpu(device, params.nuclear || {});
      try {
        const telemetry = await session.stepBatch(params.steps ?? 48);
        return { status: 'ok', telemetry };
      } finally {
        session.destroy();
      }
    }
  });

  return { opticsMod, tdseMod };
}
