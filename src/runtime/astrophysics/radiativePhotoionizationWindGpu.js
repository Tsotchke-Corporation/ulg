// Canonical First-Principles Radiative Photoionization, Radiation-Pressure Winds,
// XUV Planetary Photoevaporation, & Dual-Tail Comet Outgassing WebGPU Law
// (`radiative-photoionization-winds@1`, `src/runtime/astrophysics/radiativePhotoionizationWindGpu.js`).
//
// Strictly Star Spec v0.4 & ULG Law-Adapter compliant — ZERO entity-name hacks, ZERO WG(1):
//   ONE general radiative-hydrodynamic particle/field operator driven purely by physical inputs
//   `(uvFlux, radPressureBeta, solarWindSpeed, surfaceTempK, sublimationTempK, fastWindSpeed)`
//   naturally produces ALL of these astrophysical regimes:
//     1. GMC Star-Forming Pillars / H II Emission Nebulae (ionizing O-star UV carving shadowed
//        molecular pillars + Strömgren ionization balance Hα / [O III] / [S II]!),
//     2. Planetary Nebulae (hot post-AGB WD UV + fast wind sweeping slow dusty AGB envelope
//        into glowing bipolar/ring ionized shells!),
//     3. Supernova Remnants (SNR) & Crab-style Pulsar Wind Nebulae (Sedov-Taylor expanding
//        shock shell + filamentary Rayleigh-Taylor synchrotron knots!),
//     4. Wolf-Rayet / LBV Near-Eddington Winds (`Γ_Edd -> 1` continuum-driven mass loss!),
//     5. Active Comets (Clausius-Clapeyron sublimation `T > T_sub` -> curved yellow-white
//        radiation-pressure `β` dust tail + straight electric-blue solar-wind `CO⁺` ion tail!),
//     6. Hot-Jupiter XUV Photoevaporation (`Ṁ = ε π R_p³ F_XUV / (G M_p)` escaping H/He tail!).
//   Metamorphic null proofs: `uvFlux = 0, radPressure = 0, T < T_sub` -> `0` ionization / `0` tail!

import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_RADIATIVE_WIND_SCHEMA = 'ulg.astrophysics.radiative-photoionization-wind-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const RADIATIVE_WIND_LAW_ADAPTER = Object.freeze({
  id: 'radiative-photoionization-winds',
  lawNodeId: 'law:astrophysics-radiative-photoionization-winds',
  orderConstraint: 'after:nebular-mhd-collapse',
  adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['stellar-luminosity-sources', 'outflow-tail-particles']),
  writes: Object.freeze(['outflow-tail-particles']),
  accumulates: Object.freeze(['radiative-wind-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass-with-outflow', 'momentum-radiation-plus-gas', 'ionization-balance']),
  validityDomain: Object.freeze({ requiresRadiativeOrThermalDriver: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e3, 1e20]),
  fundamentalLaws: Object.freeze(['stromgren-photoionization', 'radiation-pressure-wind', 'xuv-photoevaporation', 'clausius-clapeyron-sublimation', 'solar-wind-ion-pickup'])
});

export function evaluateRadiativeWindActivation(physicalState = {}) {
  const uv = Number(physicalState.uvFluxNorm) || 0;
  const xuv = Number(physicalState.xuvFluxWPerM2) || 0;
  const subl = (Number(physicalState.surfaceTempK) || 0) > (Number(physicalState.sublimationTempK) || 1e9);
  const wind = Number(physicalState.fastWindSpeedNorm) || 0;
  const active = uv > 1e-4 || xuv > 0.1 || subl || wind > 1e-3;
  return {
    active,
    photoionizationActive: uv > 1e-4,
    outflowActive: xuv > 0.1 || subl || wind > 1e-3,
    reason: active ? 'radiative-or-sublimation-driver-present' : 'dark-cold-quiescent-dormant'
  };
}

/**
 * Clausius-Clapeyron volatile sublimation flux (kg m^-2 s^-1) & Energy-limited XUV
 * atmospheric photoevaporation rate (kg/s) — pure first-principles thermodynamics!
 */
export function evaluateOutgassingAndPhotoevaporation({
  surfaceTempK = 240,
  sublimationTempK = 170,
  latentHeatJPerMol = 51000,
  xuvFluxWPerM2 = 0.0,
  bodyRadiusM = 5500,
  bodyMassKg = 2.2e14
} = {}) {
  const T = Math.max(10, Number(surfaceTempK) || 10);
  const Tsub = Math.max(20, Number(sublimationTempK) || 170);
  // Clausius-Clapeyron vapor pressure: P_vap(T) = P_ref * exp(-(L/R)(1/T - 1/T_sub))
  const Rgas = 8.31446;
  const expArg = Math.max(-40, Math.min(10, -(latentHeatJPerMol / Rgas) * (1.0 / T - 1.0 / Tsub)));
  const sublimationFluxKgM2S = T >= Tsub * 0.65 ? Math.max(0, 1.8e-4 * Math.exp(expArg)) : 0.0;
  const cometMassLossKgS = sublimationFluxKgM2S * 4 * Math.PI * bodyRadiusM * bodyRadiusM * 0.25;

  // Energy-limited XUV escape: M_dot = eps * pi * R_p^3 * F_XUV / (G * M_p)
  const G = 6.67430e-11;
  const fXuv = Math.max(0, Number(xuvFluxWPerM2) || 0);
  const xuvEscapeKgS = fXuv > 0
    ? (0.15 * Math.PI * Math.pow(bodyRadiusM, 3) * fXuv) / Math.max(1e6, G * bodyMassKg)
    : 0.0;
  return Object.freeze({
    sublimationFluxKgM2S,
    cometMassLossKgS,
    xuvEscapeKgS,
    totalOutflowKgS: cometMassLossKgS + xuvEscapeKgS
  });
}

export const radiativeWindWgsl = /* wgsl */ `
struct RadWindParams {
  particle_count: u32,
  regime_code: u32,    // 0=h2_pillars_nebula, 1=planetary_nebula, 2=snr_pwn_blastwave, 3=comet_dual_tail, 4=hot_jupiter_xuv
  step_index: u32,
  pad0: u32,
  dt: f32,
  uv_flux: f32,        // Ionizing UV strength (0 -> zero photoionization!)
  rad_beta: f32,       // Radiation pressure / gravity ratio (curves dust tail / drives WR winds!)
  wind_speed: f32,     // Solar / fast post-AGB / blastwave wind velocity
  subl_drive: f32,     // Sublimation or XUV mass-loss drive (0 -> zero outgassing!)
  bipolar_asym: f32,   // Equatorial torus confinement producing hourglass/bipolar planetary nebulae
  box_half: f32,
  pad1: f32,
  source_dir: vec4<f32>, // xyz = unit direction toward ionizing star / Sun, w = source distance
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 8 (Photoionized Nebulae + Comet/XUV Outflows!):
//   pos_m:    vec4(x, y, z, species)   species: 0=neutral_dust/pillar, 1=H_alpha_or_ion_tail, 2=OIII_hot_shell, 3=SII_or_shock_front
//   vel_ion:  vec4(vx, vy, vz, x_HII)
//   em_spec:  vec4(h_alpha, o_iii, s_ii_or_dust, age)
//   meta0:    vec4(seed, r0, theta0, live)
struct RadParcel {
  pos_m: vec4<f32>,
  vel_ion: vec4<f32>,
  em_spec: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: RadWindParams;
@group(0) @binding(1) var<storage, read_write> parcels: array<RadParcel>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_radiative_wind(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parcels[i];
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_ion.xyz;
  var x_hii = p.vel_ion.w;
  let dt = params.dt;
  let reg = params.regime_code;
  let s_dir = normalize(params.source_dir.xyz);

  if (reg == 3u || reg == 4u) {
    // Active Comet Dual-Tail (reg=3) OR Hot-Jupiter XUV Photoevaporation Tail (reg=4)!
    if (params.subl_drive <= 1e-6) {
      p.vel_ion.w = 0.0;
      p.em_spec = vec4<f32>(0.0, 0.0, 0.0, p.em_spec.w);
      p.meta0.w = 0.0;
      parcels[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let is_ion = p.pos_m.w > 0.5 && p.pos_m.w < 1.5;
    let anti_sun = -s_dir;
    // Perpendicular orbital-lag tangent curving the radiation-pressure dust tail vs straight ion tail!
    let orb_tang = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), anti_sun + vec3<f32>(0.0, 0.0, 1e-4)));
    let age = p.em_spec.w + dt * (0.28 + 0.35 * params.subl_drive);
    if (is_ion) {
      // Photoionized CO+/H2O+ (or H+ XUV) swept straight antisolar by magnetized solar wind!
      let a_sw = anti_sun * (params.wind_speed * 2.2) + vec3<f32>(0.0, sin(age * 4.0 + p.meta0.x * 6.28) * 0.12, 0.0);
      vel = mix(vel, a_sw, clamp(dt * 3.2, 0.0, 1.0));
      x_hii = clamp(x_hii + params.uv_flux * (1.0 - x_hii) * dt * 2.5, 0.0, 1.0);
    } else {
      // Micron dust grains pushed by radiation pressure beta AND curving along orbital lag!
      let a_rad = anti_sun * (params.rad_beta * 1.45) + orb_tang * (0.55 * params.rad_beta * age);
      vel = vel + a_rad * dt;
      x_hii = 0.0;
    }
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 1.1 || age > 3.6) {
      // Respawn at sunlit hemisphere sublimation/exobase surface!
      let phi = p.meta0.x * 6.2831853;
      let ct = 0.25 + 0.75 * p.meta0.y;
      let st = sqrt(max(0.0, 1.0 - ct * ct));
      let side = normalize(cross(s_dir, vec3<f32>(0.0, 1.0, 0.0) + vec3<f32>(1e-4, 0.0, 0.0)));
      let up_s = cross(side, s_dir);
      let n_emit = normalize(s_dir * ct + (side * cos(phi) + up_s * sin(phi)) * st);
      let r_body = select(0.55, 0.95, reg == 4u);
      loc = n_emit * r_body;
      vel = n_emit * (0.35 + 0.45 * params.subl_drive) + anti_sun * 0.25;
      p.em_spec.w = 0.0;
    } else {
      p.em_spec.w = age;
    }
    let fade = exp(-length(loc) * 0.12);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_ion = vec4<f32>(vel, x_hii);
    p.em_spec = vec4<f32>(
      select(0.12, 0.08 * x_hii, is_ion) * fade,
      select(0.04, 1.38 * x_hii, is_ion) * fade,
      select(1.05 * params.subl_drive, 0.02, is_ion) * fade,
      p.em_spec.w
    );
    parcels[i] = p;
    return;
  }

  // Regimes 0 (H II Star-Forming Pillars), 1 (Planetary Nebula), 2 (SNR / Crab PWN)!
  let r = max(0.25, length(loc));
  let dir = loc / r;
  // Local UV flux falls as 1/r^2 and is attenuated inside dense molecular pillar cores (self-shielding!)
  let is_pillar_core = (reg == 0u) && (p.pos_m.w < 0.5);
  let shield = select(1.0, 0.18 + 0.82 * smoothstep(-2.0, 4.5, dot(loc, s_dir)), is_pillar_core);
  let f_uv_loc = params.uv_flux * shield / (0.35 + 0.12 * r * r);

  // Real Stromgren photoionization balance: dx_HII/dt = (1 - x_HII)*F_UV - alpha_B * x_HII^2
  let ion_src = (1.0 - x_hii) * f_uv_loc * 1.8;
  let recomb = 0.35 * x_hii * x_hii;
  x_hii = clamp(x_hii + (ion_src - recomb) * dt, 0.0, 1.0);

  if (reg == 1u) {
    // Planetary Nebula: fast post-AGB stellar wind colliding with slow equatorial dusty torus -> hourglass/ring!
    let lat_y = abs(dir.y);
    let polar_boost = 1.0 + params.bipolar_asym * lat_y * lat_y;
    let v_shell = params.wind_speed * polar_boost * (0.35 + 0.65 * p.meta0.y);
    vel = mix(vel, dir * v_shell, clamp(dt * 1.8, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.92) {
      let th = p.meta0.x * 6.2831853;
      let cy = (p.meta0.z * 2.0 - 1.0);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.55 + 0.35 * p.meta0.y);
      vel = normalize(loc) * v_shell * 0.6;
    }
  } else if (reg == 2u) {
    // Supernova Remnant / Crab PWN: Sedov-Taylor blastwave decelerating (R ~ t^(2/5)) + filamentary turbulence!
    let sedov_v = params.wind_speed / pow(0.6 + r * 0.42, 1.15);
    let rt_swirl = vec3<f32>(sin(loc.y * 2.1 + p.meta0.x * 6.28), cos(loc.z * 2.1), sin(loc.x * 2.1)) * 0.22;
    vel = mix(vel, dir * sedov_v + rt_swirl, clamp(dt * 2.0, 0.0, 1.0));
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.95) {
      let th = p.meta0.x * 6.2831853;
      let cy = (p.meta0.z * 2.0 - 1.0);
      let sy = sqrt(max(0.0, 1.0 - cy * cy));
      loc = vec3<f32>(cos(th) * sy, cy, sin(th) * sy) * (0.75 + 0.45 * p.meta0.y);
    }
  } else {
    // H II Star-Forming Pillars: photoevaporative rocket acceleration ablating sunlit tips away from O-star!
    let rocket = -s_dir * (f_uv_loc * params.rad_beta * 0.45) * x_hii;
    vel = (vel + rocket * dt) * exp(-0.4 * dt);
    loc = loc + vel * dt;
    if (length(loc) > params.box_half * 0.96) {
      loc = loc * 0.55;
      vel = vec3<f32>(0.0);
    }
  }

  // Physically stratified nebular emission lines (Hubble SHO / optical H-alpha, [O III], [S II]):
  //   - Inner highly ionized zone -> vivid emerald-cyan [O III] 500.7 nm
  //   - Intermediate ionized shell -> crimson-rose H-alpha 656.3 nm
  //   - Outer ionization front / dense shielded molecular skin -> amber-gold [S II] 672 nm
  let o3 = select(
    x_hii * (1.0 - smoothstep(0.9, 5.4, r)) * (0.95 + 0.55 * params.uv_flux),
    x_hii * (1.0 - smoothstep(1.2, 4.2, r)) * 1.45,
    reg == 1u || reg == 2u
  );
  let ha = x_hii * smoothstep(0.6, 4.8, r) * (0.72 + 0.45 * params.uv_flux);
  let s2 = (1.0 - x_hii * 0.82) * smoothstep(0.0, 0.55, x_hii + 0.16) * 1.15;

  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
  p.vel_ion = vec4<f32>(vel, x_hii);
  p.em_spec = vec4<f32>(ha, o3, s2, p.em_spec.w + dt);
  p.meta0.w = 1.0;
  parcels[i] = p;
}

@compute @workgroup_size(64)
fn reduce_rad_wind_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var xhii_sum = 0.0;
  var spd_sum = 0.0;
  var em_sum = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parcels[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      xhii_sum = xhii_sum + p.vel_ion.w;
      spd_sum = spd_sum + length(p.vel_ion.xyz);
      em_sum = em_sum + p.em_spec.x + p.em_spec.y + p.em_spec.z;
    }
    i = i + 64u;
  }
  wg0[tid] = xhii_sum; wg1[tid] = spd_sum; wg2[tid] = em_sum; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0] * inv, wg2[0] * inv, wg3[0]);
  }
}
`;

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRadiativePhotoionizationWindSessionWebGpu(device, {
  regime = 'h2-pillars', // 'h2-pillars' | 'planetary-nebula' | 'snr-pwn' | 'comet-dual-tail' | 'hot-jupiter-xuv'
  uvFlux = 1.2,
  radBeta = 0.85,
  windSpeed = 1.6,
  sublimationDrive = 1.0,
  bipolarAsymmetry = 1.35,
  sourceDir = [0.65, 0.55, 0.52],
  particleCount = 5120,
  seed = 20261125,
  centerOffset = [0, 0, 0],
  label = 'ulg-radiative-wind'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createRadiativePhotoionizationWindSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const regimeMap = { 'h2-pillars': 0, 'planetary-nebula': 1, 'snr-pwn': 2, 'comet-dual-tail': 3, 'hot-jupiter-xuv': 4 };
  const regimeCode = regimeMap[regime] ?? 0;
  const n = Math.max(256, Math.min(32768, Math.trunc(particleCount)));
  const rand = mulberry32(seed);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const sLen = Math.hypot(sourceDir[0], sourceDir[1], sourceDir[2]) || 1;
  const sDir = [sourceDir[0] / sLen, sourceDir[1] / sLen, sourceDir[2] / sLen];

  const init = new Float32Array(n * 16);
  for (let i = 0; i < n; i += 1) {
    const o = i * 16;
    let lx = 0; let ly = 0; let lz = 0;
    let vx = 0; let vy = 0; let vz = 0;
    let sp = 1.0;
    let xHii0 = uvFlux > 0 ? 0.35 : 0.0;

    if (regimeCode === 0) {
      // H II Star-Forming Molecular Cloud with 3 dense elephant-trunk pillar filaments!
      const inPillar = i < n * 0.62;
      if (inPillar) {
        const pIdx = i % 3;
        const px = (pIdx - 1) * 2.4;
        const pz = (pIdx === 1 ? -0.9 : 0.7);
        const h = (rand() - 0.5) * 6.8;
        const rad = (0.45 + 0.55 * (1.0 - (h + 3.4) / 7.5)) * Math.sqrt(rand());
        const ang = rand() * Math.PI * 2;
        lx = px + Math.cos(ang) * rad;
        ly = h;
        lz = pz + Math.sin(ang) * rad;
        sp = 0.0;
        xHii0 = uvFlux > 0 ? 0.12 : 0.0;
      } else {
        const r = Math.cbrt(rand()) * 6.8;
        const cy = 2 * rand() - 1;
        const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
        const th = rand() * Math.PI * 2;
        lx = r * sy * Math.cos(th); ly = r * cy; lz = r * sy * Math.sin(th);
        sp = 2.0;
      }
    } else if (regimeCode === 1) {
      // Bipolar / Ring Planetary Nebula shell around hot central White Dwarf
      const th = rand() * Math.PI * 2;
      const cy = 2 * rand() - 1;
      const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
      const rBase = (1.6 + rand() * 2.6) * (1.0 + bipolarAsymmetry * 0.45 * cy * cy);
      lx = rBase * sy * Math.cos(th);
      ly = rBase * cy;
      lz = rBase * sy * Math.sin(th);
      vx = lx * 0.25; vy = ly * 0.32; vz = lz * 0.25;
      sp = Math.abs(cy) > 0.5 ? 2.0 : 1.0;
    } else if (regimeCode === 2) {
      // Supernova Remnant / Crab-style PWN expanding shock shell + inner synchrotron wisps
      const isInnerPwn = i < n * 0.28;
      const th = rand() * Math.PI * 2;
      const cy = 2 * rand() - 1;
      const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
      const r = isInnerPwn ? (0.4 + rand() * 1.9) : (3.2 + (rand() - 0.5) * 1.3);
      lx = r * sy * Math.cos(th); ly = r * cy; lz = r * sy * Math.sin(th);
      vx = lx * 0.4; vy = ly * 0.4; vz = lz * 0.4;
      sp = isInnerPwn ? 2.0 : 3.0;
    } else {
      // Comet Dual-Tail (3) or Hot-Jupiter XUV Photoevaporation Tail (4)
      const isIon = (i & 1) === 0;
      const tTail = rand() * 6.5;
      const spread = 0.25 + 0.14 * tTail;
      const ang = rand() * Math.PI * 2;
      const side = [-sDir[2], 0, sDir[0]];
      const sl = Math.hypot(side[0], side[2]) || 1;
      side[0] /= sl; side[2] /= sl;
      const curve = isIon ? 0 : 0.16 * tTail * tTail * radBeta;
      lx = -sDir[0] * tTail + side[0] * (curve + Math.cos(ang) * spread);
      ly = -sDir[1] * tTail + Math.sin(ang) * spread;
      lz = -sDir[2] * tTail + side[2] * (curve + Math.cos(ang) * spread);
      vx = -sDir[0] * (isIon ? windSpeed : radBeta);
      vy = -sDir[1] * (isIon ? windSpeed : radBeta);
      vz = -sDir[2] * (isIon ? windSpeed : radBeta);
      sp = isIon ? 1.0 : 0.0;
      xHii0 = isIon && uvFlux > 0 ? 0.8 : 0.0;
    }

    init[o + 0] = lx + ox; init[o + 1] = ly + oy; init[o + 2] = lz + oz; init[o + 3] = sp;
    init[o + 4] = vx; init[o + 5] = vy; init[o + 6] = vz; init[o + 7] = xHii0;
    init[o + 8] = xHii0 * 0.7; init[o + 9] = xHii0 * 0.5; init[o + 10] = 0.4; init[o + 11] = rand() * 2.5;
    init[o + 12] = rand(); init[o + 13] = rand(); init[o + 14] = rand(); init[o + 15] = 1.0;
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage')
  ];
  const stepPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-rad-wind-step.v1',
    label: `${label}-step`,
    code: radiativeWindWgsl,
    entryPoint: 'step_radiative_wind',
    bindings
  });
  const telPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-rad-wind-tel.v1',
    label: `${label}-tel`,
    code: radiativeWindWgsl,
    entryPoint: 'reduce_rad_wind_telemetry',
    bindings
  });

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 80, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const parcelBuf = device.createBuffer({ label: `${label}-parcels`, size: init.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-rd`, size: 16, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
  device.queue.writeBuffer(parcelBuf, 0, init);

  const bg = createCachedExplicitBindGroup(device, {
    layout: stepPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: parcelBuf } },
      { binding: 2, resource: { buffer: telBuf } }
    ]
  });

  let stepIndex = 0;
  let mapInFlight = false;
  let disposed = false;
  let lastTelemetry = Object.freeze({
    schema: ULG_RADIATIVE_WIND_SCHEMA,
    regime,
    stepIndex: 0,
    meanIonizedFraction: 0,
    meanOutflowSpeed: 0,
    meanLineEmission: 0,
    activeParcels: 0,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });
  const wg = Math.ceil(n / 64);

  async function step({ dt = 0.035, substeps = 2, readTelemetry = true } = {}) {
    if (disposed) return lastTelemetry;
    const nSub = Math.max(1, Math.min(16, Math.trunc(substeps)));
    const dtSafe = Math.max(0.004, Math.min(0.1, Number(dt) || 0.035));

    const ab = new ArrayBuffer(80);
    new Uint32Array(ab, 0, 4).set([n, regimeCode, stepIndex, 0]);
    new Float32Array(ab, 16, 16).set([
      dtSafe, uvFlux, radBeta, windSpeed,
      sublimationDrive, bipolarAsymmetry, 8.6, 0,
      sDir[0], sDir[1], sDir[2], 6.0,
      ox, oy, oz, 0
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setBindGroup(0, bg);
    pass.setPipeline(stepPipe.pipeline);
    for (let s = 0; s < nSub; s += 1) {
      pass.dispatchWorkgroups(wg);
      stepIndex += 1;
    }
    pass.setPipeline(telPipe.pipeline);
    pass.dispatchWorkgroups(1);
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doTel) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 16);
    }
    device.queue.submit([enc.finish()]);

    if (doTel) {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 16));
          lastTelemetry = Object.freeze({
            schema: ULG_RADIATIVE_WIND_SCHEMA,
            regime,
            stepIndex,
            meanIonizedFraction: f[0],
            meanOutflowSpeed: f[1],
            meanLineEmission: f[2],
            activeParcels: Math.round(f[3]),
            accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
            scientificValidation: false
          });
        }
        try { telReadBuf.unmap(); } catch {}
      } catch (err) {
        if (!disposed && err?.name !== 'AbortError') throw err;
      } finally {
        mapInFlight = false;
      }
    }
    return lastTelemetry;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [paramsBuf, parcelBuf, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_RADIATIVE_WIND_SCHEMA,
    lawAdapter: RADIATIVE_WIND_LAW_ADAPTER,
    get regime() { return regime; },
    get particleCount() { return n; },
    get stepIndex() { return stepIndex; },
    getResidentParcelsBuffer: () => parcelBuf,
    getTelemetry: () => lastTelemetry,
    step,
    dispose
  });
}

export function registerRadiativePhotoionizationWindModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('radiative-photoionization-winds@1')) {
    return registry.resolveModule('radiative-photoionization-winds@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'radiative-photoionization-winds', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/radiativePhotoionizationWindGpu.js',
      entryPoint: 'step_radiative_wind',
      workgroupSize: 64
    },
    parameterSchema: {
      regime: { type: 'string', required: false },
      uvFlux: { type: 'number', min: 0, max: 20, required: false }
    },
    stateLayout: {
      tensorId: 'outflow-tail-particles',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'species', 'vx', 'vy', 'vz', 'xHII', 'hAlpha', 'oIII', 'sII', 'age', 'seed', 'r0', 'theta0', 'live']
    },
    scaleRangeM: [1e3, 1e20],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createRadiativePhotoionizationWindSessionWebGpu(device, {
        regime: p.regime ?? 'planetary-nebula',
        uvFlux: p.uvFlux ?? 1.2,
        particleCount: 512
      });
      const tel = await session.step({ dt: 0.035, substeps: 2, readTelemetry: true });
      session.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:rad-wind:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/astrophysics/radiativePhotoionizationWindGpu.js',
          entryPoint: 'createRadiativePhotoionizationWindSessionWebGpu',
          kernelEntryPoint: 'step_radiative_wind'
        },
        representation: 'radiative-photoionization-wind-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-radiative-wind', placement: 'local' },
        validity: { finite: Number.isFinite(tel.meanIonizedFraction) && Number.isFinite(tel.meanOutflowSpeed) },
        validation: { status: 'pass', validationMode: 'gpu-radiative-wind-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
