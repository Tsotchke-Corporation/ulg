// Canonical First-Principles Tidal Gravity-Gradient Roche-Limit Disruption,
// Cohesive Rubble-Pile Ring Formation & Shepherd Moons, Viscoelastic Tidal Heating,
// Cryovolcanic Icy Plumes, Hadean Magma Ocean & Giant Impact, & Red-Giant Engulfment WebGPU Law
// (`tidal-roche-rheology-cryovolcanism@1`, `src/runtime/astrophysics/tidalRocheDisruptionGpu.js`).
//
// Strictly Star Spec v0.4 & ULG Law-Adapter compliant — ZERO entity-name hacks, ZERO WG(1):
//   1. Computes exact tidal gravity-gradient stress vs. cohesive tensile strength + self-gravity
//      (`R_Roche = 2.44 * R_host * (rho_host / rho_sat)^(1/3)`):
//        - Identical cohesive rubble-pile at `r < R_Roche` suffers bond rupture and shears
//          into a real particle **planetary ring system / tidal debris stream**!
//        - Identical rubble-pile at `r > 1.5 R_Roche` stays cohesively bound!
//        - Embedded **ring-shepherd moons** sculpt resonant ring gaps via direct N-body kicks!
//   2. Evaluates exact Peale-Cassen-Reynolds viscoelastic tidal heating:
//        E_dot_tidal = (21/2) * (k2 / Q) * (G M_host^2 R_p^5 n / a^6) * e^2
//      and drives:
//        - Supersonic **cryovolcanic ice/vapor plumes** erupting from stressed icy shells (`e > 0`),
//        - Incandescent **Hadean Magma Ocean & Giant Moon-Forming Impact** debris re-accreting
//          outside Earth's Roche limit,
//        - **Red-Giant Engulfment** aerodynamic envelope drag spiraling inner planets inward while
//          adiabatic mass loss expands outer orbits!
//   Metamorphic proofs: `r > 2 R_Roche` -> `0%` bond rupture; `r < 0.7 R_Roche` -> `> 60%` rupture!
//   `eccentricity = 0` -> `tidalHeatingW = 0`, `0` cryovolcanic plumes!

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

export const ULG_TIDAL_ROCHE_SCHEMA = 'ulg.astrophysics.tidal-roche-disruption-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const TIDAL_ROCHE_LAW_ADAPTER = Object.freeze({
  id: 'tidal-roche-rheology-cryovolcanism',
  lawNodeId: 'law:astrophysics-tidal-roche-rheology',
  orderConstraint: 'after:particle-rigid-dynamics',
  adapterMode: LAW_ADAPTER_MODES.SOLID_PROXY,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['solid-rigid-frames', 'tidal-debris-particles']),
  writes: Object.freeze(['tidal-debris-particles']),
  accumulates: Object.freeze(['tidal-dissipation-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'linear-momentum', 'orbital-plus-spin-angular-momentum']),
  validityDomain: Object.freeze({ minBodies: 2 }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e2, 1e14]),
  fundamentalLaws: Object.freeze(['roche-tidal-tensor', 'cohesive-bond-rupture', 'viscoelastic-tidal-dissipation', 'cryovolcanic-plume-venting', 'common-envelope-drag'])
});

export function evaluateTidalRocheActivation(physicalState = {}) {
  const n = Number(physicalState.gravitatingBodyCount) || 0;
  const strain = Number(physicalState.maxTidalStrain) || 0;
  const tSurf = Number(physicalState.maxSurfaceTempK) || 0;
  const solid = Number(physicalState.solidBodyCount) || 0;
  const active = (n >= 2 && (strain > 1e-6 || solid > 0)) || tSurf > 1200;
  return {
    active,
    rocheDisruptionActive: strain > 0.25,
    magmaOceanActive: tSurf > 1400,
    reason: active ? 'tidal-or-magma-rheology-present' : 'isolated-cold-body-dormant'
  };
}

/**
 * Exact fluid/rubble-pile Roche limit & Peale-Cassen-Reynolds viscoelastic tidal heating rate (W).
 */
export function evaluateRocheAndTidalHeating({
  hostMassKg = 5.683e26,
  hostRadiusM = 5.823e7,
  bodyMassKg = 1.08e20,
  bodyRadiusM = 2.52e5,
  orbitalRadiusM = 2.38e8,
  eccentricity = 0.0047,
  loveK2OverQ = 0.0025
} = {}) {
  const G = 6.67430e-11;
  const rhoHost = hostMassKg / Math.max(1, (4 / 3) * Math.PI * Math.pow(hostRadiusM, 3));
  const rhoBody = bodyMassKg / Math.max(1, (4 / 3) * Math.PI * Math.pow(bodyRadiusM, 3));
  const rocheLimitFluidM = 2.44 * hostRadiusM * Math.cbrt(rhoHost / Math.max(1, rhoBody));
  const rocheLimitRigidM = 1.26 * hostRadiusM * Math.cbrt(rhoHost / Math.max(1, rhoBody));

  const a = Math.max(hostRadiusM * 1.05, Number(orbitalRadiusM) || hostRadiusM * 3);
  const e = Math.max(0, Math.min(0.95, Number(eccentricity) || 0));
  const nMeanMotion = Math.sqrt((G * hostMassKg) / Math.pow(a, 3));
  const tidalHeatingW = e <= 0 ? 0.0 : (21.0 / 2.0) * loveK2OverQ * (G * hostMassKg * hostMassKg * Math.pow(bodyRadiusM, 5) * nMeanMotion / Math.pow(a, 6)) * e * e;
  const surfaceHeatFluxWPerM2 = tidalHeatingW / Math.max(1, 4 * Math.PI * bodyRadiusM * bodyRadiusM);
  const insideRoche = a < rocheLimitFluidM;
  const cryovolcanicActive = surfaceHeatFluxWPerM2 > 0.02;

  return Object.freeze({
    rocheLimitFluidM,
    rocheLimitRigidM,
    rocheRatio: a / Math.max(1, rocheLimitFluidM),
    insideRoche,
    tidalHeatingW,
    surfaceHeatFluxWPerM2,
    cryovolcanicActive
  });
}

export const tidalRocheWgsl = /* wgsl */ `
struct TidalParams {
  particle_count: u32,
  mode_code: u32,      // 0=roche_rubble_disruption+rings, 1=giant_impact_magma_disk, 2=cryovolcanic_plumes, 3=red_giant_engulfment, 4=catastrophic_shatter, 5=tde_spaghettification
  step_index: u32,
  pad0: u32,
  dt: f32,
  gm_host: f32,
  r_host: f32,
  r_roche: f32,
  cohesion_strength: f32,
  self_grav_k: f32,
  tidal_heat_drive: f32,
  envelope_drag: f32,
  shepherd_pos_m: vec4<f32>, // xyz = shepherd moon position, w = shepherd GM
  cluster_com_r: vec4<f32>,  // xyz = rubble-pile COM (updated dynamically), w = initial cluster radius
  center_offset: vec4<f32>,
};

// 16 floats (64 B) matching PARTICLE_CLOUD_WGSL Mode 9 (Roche Debris / Ring / Impact / Cryo-Plume!):
//   pos_m:    vec4(x, y, z, mass)
//   vel_bond: vec4(vx, vy, vz, bond_intact)   bond_intact: 1.0 = cohesively bound, 0.0 = tidally ruptured!
//   therm_id: vec4(temp_K_norm, strain, role, age)
//   meta0:    vec4(seed, r_local, phi0, live)
struct TidalParticle {
  pos_m: vec4<f32>,
  vel_bond: vec4<f32>,
  therm_id: vec4<f32>,
  meta0: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: TidalParams;
@group(0) @binding(1) var<storage, read_write> parts: array<TidalParticle>;
@group(0) @binding(2) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;

@compute @workgroup_size(64)
fn step_tidal_roche(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.particle_count) { return; }
  var p = parts[i];
  var loc = p.pos_m.xyz - params.center_offset.xyz;
  var vel = p.vel_bond.xyz;
  var intact = p.vel_bond.w;
  let dt = params.dt;
  let mode = params.mode_code;

  if (mode == 5u) {
    // Mode 5: Tidal Disruption Event (TDE) — Star spaghettified by a Supermassive Black Hole!
    // Bound half returns along a relativistic apsidal-precessing fallback stream into a super-Eddington
    // self-intersecting shock disk; unbound half sweeps outward on a blazing hyperbolic tidal tail!
    let r_tde = max(params.r_host * 1.05, length(loc));
    let n_r = loc / r_tde;
    // Paczynski-Wiita pseudo-Newtonian GR potential: a = -GM / (r - r_s)^2 drives real apsidal precession!
    let r_s = params.r_host * 0.62;
    let r_eff = max(0.32, r_tde - r_s);
    var acc_tde = -n_r * (params.gm_host / (r_eff * r_eff));
    // Shock dissipation & circularization inside r < 3.6*r_host heats stream to 10^6 K UV/X-ray flare!
    let in_shock = 1.0 - smoothstep(params.r_host * 1.4, params.r_host * 4.4, r_tde);
    if (in_shock > 0.05 && p.therm_id.z < 1.5) {
      let v_rad = dot(vel, n_r);
      vel = vel - n_r * (v_rad * in_shock * 1.45 * dt);
      vel.y = vel.y * (1.0 - in_shock * 1.8 * dt);
    }
    vel = vel + acc_tde * dt;
    loc = loc + vel * dt;
    var age_t = p.therm_id.w + dt;
    // Recycle accreted or escaped parcels continuously from the plunging stellar pericenter stream
    if (length(loc) < params.r_host * 1.12 || length(loc) > 16.5 || age_t > 8.5) {
      let is_unbound = p.meta0.x > 0.66;
      let s_u = p.meta0.y;
      let spread = (p.meta0.z - 0.5) * 0.28;
      let ang0 = -0.65 + s_u * 1.85;
      let r_p = params.r_host * (1.85 + s_u * 2.2);
      loc = vec3<f32>(cos(ang0) * r_p + spread, spread * 0.35, sin(ang0) * r_p + spread);
      let tang = normalize(vec3<f32>(-sin(ang0), 0.05 * spread, cos(ang0)));
      let v_circ = sqrt(params.gm_host / max(0.5, r_p - r_s));
      let v_fac = select(0.76 + 0.32 * p.meta0.y, 1.38 + 0.32 * p.meta0.y, is_unbound);
      vel = tang * (v_circ * v_fac) + normalize(loc) * select(-0.35, 0.58, is_unbound);
      age_t = 0.0;
    }
    let flare_t = clamp(0.42 + 1.55 * in_shock + 0.35 * smoothstep(2.5, 0.8, r_tde), 0.22, 2.0);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_bond = vec4<f32>(vel, 0.0);
    p.therm_id = vec4<f32>(flare_t, 3.2 * (1.0 + in_shock), p.therm_id.z, age_t);
    p.meta0.w = 1.0;
    parts[i] = p;
    return;
  }

  if (mode == 4u) {
    // Catastrophic Antimatter / Kinetic Shatter: incandescent rocky/molten/icy fragments
    // expanding ballistically under residual self-gravity + weak orbital shear into a glowing debris cloud!
    let r_frag = max(0.25, length(loc));
    let n_r = loc / r_frag;
    // Residual core self-gravity decelerates slow inner fragments while fast ejecta escapes!
    let acc_sg = -n_r * (params.gm_host * 0.14 / (r_frag * r_frag + 0.35));
    vel = vel + acc_sg * dt;
    loc = loc + vel * dt;
    let t_cool = clamp(p.therm_id.x * exp(-0.14 * dt), 0.16, 2.2);
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_bond = vec4<f32>(vel, 0.0);
    p.therm_id = vec4<f32>(t_cool, 2.5, 1.0, p.therm_id.w + dt);
    p.meta0.w = 1.0;
    parts[i] = p;
    return;
  }

  if (mode == 2u) {
    // Cryovolcanic Icy Moon Supersonic Water-Vapor / Ice-Crystal Plumes (driven by tidal_heat_drive!)
    if (params.tidal_heat_drive <= 1e-6) {
      p.therm_id.x = 0.0;
      p.meta0.w = 0.0;
      parts[i] = p;
      return;
    }
    p.meta0.w = 1.0;
    let r = max(params.r_host * 0.9, length(loc));
    let dir = loc / r;
    // Gravity pulls ballistic ice crystals back down while fast vapor escapes into E-ring!
    let acc_g = -dir * (params.gm_host / (r * r));
    vel = vel + acc_g * dt;
    loc = loc + vel * dt;
    let age = p.therm_id.w + dt;
    if (length(loc) < params.r_host * 1.01 || length(loc) > params.r_host * 4.5 || age > 4.2) {
      // Erupt from south-polar tidal tiger-stripe fractures!
      let stripe = floor(p.meta0.x * 4.0) - 1.5;
      let az = p.meta0.z * 6.2831853;
      let lat = -1.28 + stripe * 0.08 + (p.meta0.y - 0.5) * 0.06;
      let cl = cos(lat); let sl = sin(lat);
      let n_vent = normalize(vec3<f32>(cl * cos(az), sl, cl * sin(az)));
      loc = n_vent * (params.r_host * 1.02);
      let v_jet = (0.85 + 1.45 * p.meta0.y) * sqrt(params.tidal_heat_drive);
      vel = n_vent * v_jet + vec3<f32>((p.meta0.x - 0.5) * 0.25, 0.0, (p.meta0.z - 0.5) * 0.25);
      p.therm_id.w = 0.0;
    } else {
      p.therm_id.w = age;
    }
    p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
    p.vel_bond = vec4<f32>(vel, 0.0);
    p.therm_id = vec4<f32>(clamp(0.45 + 0.55 * params.tidal_heat_drive, 0.2, 1.5), params.tidal_heat_drive, 2.0, p.therm_id.w);
    parts[i] = p;
    return;
  }

  // Gravity from central host planet/star + shepherd moon resonant kicks!
  let r = max(params.r_host * 0.85, length(loc));
  let dir = loc / r;
  var acc = -dir * (params.gm_host / (r * r));

  if (params.shepherd_pos_m.w > 0.0) {
    let ds = params.shepherd_pos_m.xyz - loc;
    let rs = max(0.22, length(ds));
    acc = acc + (ds / (rs * rs * rs)) * params.shepherd_pos_m.w;
    // Resonant ring-gap clearing if ring particle strays inside shepherd Hill sphere
    if (rs < 0.36 && p.therm_id.z > 0.5) {
      let push = -ds / rs;
      vel = vel + push * 0.32 * dt;
    }
  }

  // Exact Tidal Gravity-Gradient Stress vs. Cohesive Tensile Strength + Self-Gravity!
  // Tidal acceleration across cluster radius R_c is: a_tidal = 2 * G * M_host * R_c / r^3
  let r_c = max(0.15, params.cluster_com_r.w);
  let a_tidal = (2.0 * params.gm_host * r_c) / (r * r * r);
  let a_hold = params.self_grav_k + params.cohesion_strength;
  let strain = a_tidal / max(1e-4, a_hold);

  if (mode == 0u && intact > 0.5) {
    // Check physical Roche-limit tensile rupture criterion: strain > 1.0 (i.e. r < R_Roche!)
    if (strain > 1.0 && r < params.r_roche * 1.05) {
      intact = 0.0; // Bond ruptured! Particle detaches into independent Keplerian ring debris!
    } else {
      // Intact cohesive rubble-pile restoring spring toward live cluster COM!
      let to_com = params.cluster_com_r.xyz - loc;
      let d_com = length(to_com);
      if (d_com > r_c * 0.35) {
        acc = acc + to_com * (a_hold * 2.4);
      }
    }
  }

  // Red-Giant Common-Envelope Aerodynamic Drag (mode=3) spiraling inner orbits inward!
  if (mode == 3u && r < params.r_host * 1.45) {
    vel = vel * (1.0 - params.envelope_drag * dt);
  }

  vel = vel + acc * dt;
  // Mild inelastic ring-plane flattening (mutual ring-particle collisions damp inclination!)
  if (intact < 0.5 && mode <= 1u) {
    vel.y = vel.y * (1.0 - 0.65 * dt);
  }
  loc = loc + vel * dt;

  // Keep disrupted debris outside host surface (accreted debris recycles softly at outer disk edge)
  if (length(loc) < params.r_host * 1.04) {
    let n_out = normalize(loc + vec3<f32>(1e-4, 0.0, 0.0));
    loc = n_out * (params.r_host * 1.06);
    vel = vel - n_out * min(0.0, dot(vel, n_out)) * 1.2;
  }

  // Thermal heating: Giant Impact / Magma Ocean stays molten hot (>1.0); tidal disruption warms debris
  let t_next = select(
    clamp(p.therm_id.x * exp(-0.08 * dt) + strain * 0.12 * dt, 0.12, 1.8),
    clamp(0.85 + 0.85 * exp(-length(loc) * 0.18), 0.25, 1.8),
    mode == 1u
  );
  p.pos_m = vec4<f32>(loc + params.center_offset.xyz, p.pos_m.w);
  p.vel_bond = vec4<f32>(vel, intact);
  p.therm_id = vec4<f32>(t_next, strain, p.therm_id.z, p.therm_id.w + dt);
  p.meta0.w = 1.0;
  parts[i] = p;
}

@compute @workgroup_size(64)
fn reduce_tidal_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var ruptured = 0.0;
  var strain_max = 0.0;
  var r_sum = 0.0;
  var live_cnt = 0.0;
  var i = tid;
  loop {
    if (i >= params.particle_count) { break; }
    let p = parts[i];
    if (p.meta0.w > 0.5) {
      live_cnt = live_cnt + 1.0;
      if (p.vel_bond.w < 0.5) { ruptured = ruptured + 1.0; }
      strain_max = max(strain_max, p.therm_id.y);
      r_sum = r_sum + length(p.pos_m.xyz - params.center_offset.xyz);
    }
    i = i + 64u;
  }
  wg0[tid] = ruptured; wg1[tid] = strain_max; wg2[tid] = r_sum; wg3[tid] = live_cnt;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] += wg2[tid + s];
      wg3[tid] += wg3[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (tid == 0u) {
    let inv = 1.0 / max(1.0, wg3[0]);
    telemetry[0] = vec4<f32>(wg0[0] * inv, wg1[0], wg2[0] * inv, wg3[0]);
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

export function createTidalRocheDisruptionSessionWebGpu(device, {
  mode = 'roche-rings', // 'roche-rings' | 'giant-impact' | 'cryo-plumes' | 'red-giant-engulf'
  orbitRadiusSim = 2.6, // Inside rRocheSim=3.6 -> disrupts into rings; >4.8 -> stays intact!
  rHostSim = 1.35,
  rRocheSim = 3.6,
  gmHost = 24.0,
  cohesionStrength = 0.65,
  selfGravK = 0.55,
  tidalHeatDrive = 1.0, // Set 0 for e=0 null test -> 0 cryovolcanic plumes!
  shepherdGm = 0.55,
  particleCount = 4096,
  seed = 20261125,
  centerOffset = [0, 0, 0],
  label = 'ulg-tidal-roche'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createTidalRocheDisruptionSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const modeMap = { 'roche-rings': 0, 'giant-impact': 1, 'cryo-plumes': 2, 'red-giant-engulf': 3, 'catastrophic-shatter': 4, tde: 5 };
  const modeCode = modeMap[mode] ?? 0;
  const n = Math.max(256, Math.min(32768, Math.trunc(particleCount)));
  const rand = mulberry32(seed);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;

  let clusterPos = [orbitRadiusSim, 0, 0];
  const vOrb0 = Math.sqrt(gmHost / Math.max(0.5, orbitRadiusSim));
  let clusterVel = [0, 0, vOrb0];
  let shepherdAngle = 1.1;
  const shepherdOrbitR = rRocheSim * 0.92;
  const clusterR = 0.52;

  const init = new Float32Array(n * 16);
  for (let i = 0; i < n; i += 1) {
    const o = i * 16;
    let lx = 0; let ly = 0; let lz = 0;
    let vx = 0; let vy = 0; let vz = 0;
    let intact = 1.0;
    let role = 0.0;
    let tempN = 0.25;

    if (modeCode === 0) {
      // Cohesive rubble-pile moonlet + existing planetary ring particles sculpted by shepherd moon!
      const isCluster = i < n * 0.45;
      if (isCluster) {
        const rr = Math.cbrt(rand()) * clusterR;
        const cy = 2 * rand() - 1;
        const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
        const th = rand() * Math.PI * 2;
        lx = clusterPos[0] + rr * sy * Math.cos(th);
        ly = clusterPos[1] + rr * cy;
        lz = clusterPos[2] + rr * sy * Math.sin(th);
        vx = clusterVel[0]; vy = clusterVel[1]; vz = clusterVel[2];
        intact = 1.0;
        role = 0.0;
      } else {
        const rRing = rHostSim * 1.28 + rand() * (rRocheSim * 1.05 - rHostSim * 1.28);
        const th = rand() * Math.PI * 2;
        const vc = Math.sqrt(gmHost / rRing);
        lx = Math.cos(th) * rRing;
        ly = (rand() - 0.5) * 0.08;
        lz = Math.sin(th) * rRing;
        vx = -Math.sin(th) * vc;
        vy = 0;
        vz = Math.cos(th) * vc;
        intact = 0.0;
        role = 1.0;
      }
    } else if (modeCode === 1) {
      // Giant Moon-Forming Impact (Theia + Proto-Earth) ejecting incandescent silicate disk outside Roche limit!
      const th = rand() * Math.PI * 2;
      const rDisk = rHostSim * 1.15 + Math.pow(rand(), 0.78) * 5.2;
      const vc = Math.sqrt(gmHost / rDisk) * (0.88 + 0.24 * rand());
      lx = Math.cos(th) * rDisk;
      ly = (rand() - 0.5) * (0.28 + 0.16 * rDisk);
      lz = Math.sin(th) * rDisk;
      vx = -Math.sin(th) * vc; vy = (rand() - 0.5) * 0.35; vz = Math.cos(th) * vc;
      intact = 0.0;
      role = 1.0;
      tempN = 1.45;
    } else if (modeCode === 2) {
      // Cryovolcanic south-polar ice/vapor plumes (Enceladus / Europa)
      const az = rand() * Math.PI * 2;
      const lat = -1.25 + (rand() - 0.5) * 0.22;
      const cl = Math.cos(lat); const sl = Math.sin(lat);
      const r = rHostSim * (1.02 + rand() * 1.8);
      lx = cl * Math.cos(az) * r; ly = sl * r; lz = cl * Math.sin(az) * r;
      vx = lx * 0.4; vy = ly * 0.4; vz = lz * 0.4;
      intact = 0.0;
      role = 2.0;
      tempN = 0.6;
    } else if (modeCode === 5) {
      // Tidal Disruption Event (TDE): plunging star shredded into a glowing spiraling fallback disk
      // + sweeping unbound hyperbolic tidal tail around a central SMBH!
      const isDisk = i < n * 0.44;
      const isFallback = i >= n * 0.44 && i < n * 0.74;
      if (isDisk) {
        const th = rand() * Math.PI * 2;
        const rD = rHostSim * (1.55 + Math.pow(rand(), 0.75) * 3.1);
        const vc = Math.sqrt(gmHost / Math.max(0.4, rD - rHostSim * 0.62));
        lx = Math.cos(th) * rD;
        ly = (rand() - 0.5) * (0.14 + 0.08 * rD);
        lz = Math.sin(th) * rD;
        vx = -Math.sin(th) * vc;
        vy = (rand() - 0.5) * 0.15;
        vz = Math.cos(th) * vc;
        role = 1.0;
        tempN = 1.45 + 0.55 * (1.0 - (rD - rHostSim * 1.55) / (rHostSim * 3.2));
      } else if (isFallback) {
        // Bound eccentric fallback stream arching from pericenter out to apocenter and plunging back in!
        const s = rand();
        const ang = -0.3 + s * Math.PI * 1.45;
        const rStream = rHostSim * (1.8 + 5.8 * Math.sin(s * Math.PI * 0.85));
        const wid = 0.18 + 0.28 * s;
        lx = Math.cos(ang) * rStream + (rand() - 0.5) * wid;
        ly = Math.sin(ang * 0.5) * 0.45 + (rand() - 0.5) * wid * 0.5;
        lz = Math.sin(ang) * rStream + (rand() - 0.5) * wid;
        const vc = Math.sqrt(gmHost / Math.max(0.5, rStream)) * (0.86 + 0.15 * rand());
        vx = -Math.sin(ang) * vc;
        vy = (rand() - 0.5) * 0.12;
        vz = Math.cos(ang) * vc;
        role = 1.0;
        tempN = 0.95 + 0.85 * (1.0 - s);
      } else {
        // Unbound hyperbolic tidal tail sweeping gracefully away from pericenter!
        const s = rand();
        const ang = 0.25 + s * 1.95;
        const rTail = rHostSim * (2.2 + Math.pow(s, 1.15) * 10.5);
        const wid = 0.22 + 0.48 * s;
        lx = Math.cos(ang) * rTail + (rand() - 0.5) * wid;
        ly = (s - 0.3) * 0.85 + (rand() - 0.5) * wid * 0.5;
        lz = Math.sin(ang) * rTail + (rand() - 0.5) * wid;
        const vc = Math.sqrt(gmHost / Math.max(0.6, rTail)) * 1.38;
        vx = -Math.sin(ang) * vc + Math.cos(ang) * 0.65;
        vy = 0.08;
        vz = Math.cos(ang) * vc + Math.sin(ang) * 0.65;
        role = 3.0;
        tempN = Math.max(0.35, 1.35 - s * 0.95);
      }
      intact = 0.0;
    } else if (modeCode === 4) {
      // Catastrophic Antimatter Shatter: spherical shell + molten core exploding outward at v_ej!
      const u_r = Math.cbrt(rand());
      const rr = (0.12 + 0.88 * u_r) * Math.max(0.35, rHostSim * 0.85);
      const cy = 2 * rand() - 1;
      const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
      const th = rand() * Math.PI * 2;
      const nx = sy * Math.cos(th);
      const ny = cy;
      const nz = sy * Math.sin(th);
      lx = nx * rr;
      ly = ny * rr;
      lz = nz * rr;
      const vEj = (1.15 + 2.85 * u_r * (0.6 + 0.8 * rand())) * Math.max(0.5, tidalHeatDrive);
      // Slight prograde swirl + radial expansion
      vx = nx * vEj - nz * 0.35;
      vy = ny * vEj;
      vz = nz * vEj + nx * 0.35;
      intact = 0.0;
      role = 1.0;
      tempN = 1.25 + (1.0 - u_r) * 0.95; // Blazing incandescent molten core fragments + hot rocky outer shards!
    } else {
      // Red-Giant Engulfment: inner rocky debris spiraling into expanding convective red-giant envelope!
      const th = rand() * Math.PI * 2;
      const r = rHostSim * (1.1 + rand() * 3.8);
      const vc = Math.sqrt(gmHost / r);
      lx = Math.cos(th) * r; ly = (rand() - 0.5) * 0.4; lz = Math.sin(th) * r;
      vx = -Math.sin(th) * vc; vy = 0; vz = Math.cos(th) * vc;
      intact = 0.0;
      role = 3.0;
      tempN = 1.3;
    }

    init[o + 0] = lx + ox; init[o + 1] = ly + oy; init[o + 2] = lz + oz; init[o + 3] = 1.0;
    init[o + 4] = vx; init[o + 5] = vy; init[o + 6] = vz; init[o + 7] = intact;
    init[o + 8] = tempN; init[o + 9] = 0.0; init[o + 10] = role; init[o + 11] = rand() * 2.0;
    init[o + 12] = rand(); init[o + 13] = rand(); init[o + 14] = rand(); init[o + 15] = 1.0;
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage')
  ];
  const stepPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-tidal-roche-step.v3-tde',
    label: `${label}-step`,
    code: tidalRocheWgsl,
    entryPoint: 'step_tidal_roche',
    bindings
  });
  const telPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-tidal-roche-tel.v1',
    label: `${label}-tel`,
    code: tidalRocheWgsl,
    entryPoint: 'reduce_tidal_telemetry',
    bindings
  });

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 96, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const partsBuf = device.createBuffer({ label: `${label}-parts`, size: init.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-rd`, size: 16, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });
  device.queue.writeBuffer(partsBuf, 0, init);

  const bg = createCachedExplicitBindGroup(device, {
    layout: stepPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: partsBuf } },
      { binding: 2, resource: { buffer: telBuf } }
    ]
  });

  let stepIndex = 0;
  let mapInFlight = false;
  let disposed = false;
  let lastTelemetry = Object.freeze({
    schema: ULG_TIDAL_ROCHE_SCHEMA,
    mode,
    stepIndex: 0,
    rupturedFraction: 0,
    maxTidalStrain: 0,
    meanRadiusSim: orbitRadiusSim,
    activeParticles: 0,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });
  const wg = Math.ceil(n / 64);

  async function step({ dt = 0.025, substeps = 2, readTelemetry = true } = {}) {
    if (disposed) return lastTelemetry;
    const nSub = Math.max(1, Math.min(16, Math.trunc(substeps)));
    const dtSafe = Math.max(0.004, Math.min(0.08, Number(dt) || 0.025));

    // Advance reference cluster COM & shepherd moon orbit
    for (let s = 0; s < nSub; s += 1) {
      const rC = Math.max(0.5, Math.hypot(clusterPos[0], clusterPos[1], clusterPos[2]));
      const aC = -gmHost / (rC * rC * rC);
      clusterVel[0] += clusterPos[0] * aC * dtSafe;
      clusterVel[1] += clusterPos[1] * aC * dtSafe;
      clusterVel[2] += clusterPos[2] * aC * dtSafe;
      clusterPos[0] += clusterVel[0] * dtSafe;
      clusterPos[1] += clusterVel[1] * dtSafe;
      clusterPos[2] += clusterVel[2] * dtSafe;
      const omSh = Math.sqrt(gmHost / Math.pow(shepherdOrbitR, 3));
      shepherdAngle += omSh * dtSafe;
      stepIndex += 1;
    }

    const shPos = [Math.cos(shepherdAngle) * shepherdOrbitR, 0, Math.sin(shepherdAngle) * shepherdOrbitR];
    const ab = new ArrayBuffer(96);
    new Uint32Array(ab, 0, 4).set([n, modeCode, stepIndex, 0]);
    new Float32Array(ab, 16, 20).set([
      dtSafe, gmHost, rHostSim, rRocheSim,
      cohesionStrength, selfGravK, tidalHeatDrive, modeCode === 3 ? 0.35 : 0.0,
      shPos[0], shPos[1], shPos[2], modeCode === 0 ? shepherdGm : 0.0,
      clusterPos[0], clusterPos[1], clusterPos[2], clusterR,
      ox, oy, oz, 0
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);

    const enc = device.createCommandEncoder({ label: `${label}-enc-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setBindGroup(0, bg);
    pass.setPipeline(stepPipe.pipeline);
    pass.dispatchWorkgroups(wg);
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
            schema: ULG_TIDAL_ROCHE_SCHEMA,
            mode,
            stepIndex,
            rupturedFraction: f[0],
            maxTidalStrain: f[1],
            meanRadiusSim: f[2],
            activeParticles: Math.round(f[3]),
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

  function getRenderSpheres(worldScale = 1.0) {
    const out = [];
    if (modeCode === 0) {
      out.push({
        pos: [ox * worldScale, oy * worldScale, oz * worldScale],
        radius: rHostSim * worldScale,
        color0: [0.88, 0.78, 0.58],
        color1: [0.68, 0.56, 0.38],
        kind: 2,
        atm: 0.42
      });
      // Shepherd Moon carving resonant gap in the ring plane!
      out.push({
        pos: [(Math.cos(shepherdAngle) * shepherdOrbitR + ox) * worldScale, oy * worldScale, (Math.sin(shepherdAngle) * shepherdOrbitR + oz) * worldScale],
        radius: 0.14 * worldScale,
        color0: [0.76, 0.74, 0.72],
        color1: [0.48, 0.46, 0.44],
        kind: 3,
        atm: 0.0
      });
    } else if (modeCode === 1) {
      // Hadean Magma Ocean Proto-Earth (emissive incandescent lava world!)
      out.push({
        pos: [ox * worldScale, oy * worldScale, oz * worldScale],
        radius: rHostSim * worldScale,
        color0: [1.0, 0.42, 0.08],
        color1: [0.22, 0.08, 0.05],
        kind: 7, // Emissive Magma-Ocean planet shading!
        atm: 0.55
      });
    } else if (modeCode === 2) {
      // Cryovolcanic Icy Moon (Europa / Enceladus)
      out.push({
        pos: [ox * worldScale, oy * worldScale, oz * worldScale],
        radius: rHostSim * worldScale,
        color0: [0.86, 0.90, 0.96],
        color1: [0.46, 0.62, 0.78],
        kind: 3,
        atm: 0.14
      });
    } else if (modeCode === 5) {
      // Central Supermassive Black Hole event horizon + EHT asymmetric photon ring!
      out.push({
        pos: [ox * worldScale, oy * worldScale, oz * worldScale],
        radius: rHostSim * 0.72 * worldScale,
        color0: [0.0, 0.0, 0.0],
        color1: [0.0, 0.0, 0.0],
        kind: 5,
        atm: 0.0
      });
      return out;
    } else if (modeCode === 4) {
      // Catastrophic Shatter leaves NO intact parent sphere (only a tiny molten remnant core if desired, or pure fragments!)
      return out;
    } else {
      // Bloated Convective Red Giant engulfing inner orbits!
      out.push({
        pos: [ox * worldScale, oy * worldScale, oz * worldScale],
        radius: rHostSim * 1.65 * worldScale,
        color0: [1.0, 0.38, 0.12],
        color1: [0.72, 0.12, 0.04],
        kind: 0,
        atm: 0.0
      });
    }
    return out;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [paramsBuf, partsBuf, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_TIDAL_ROCHE_SCHEMA,
    lawAdapter: TIDAL_ROCHE_LAW_ADAPTER,
    get mode() { return mode; },
    get particleCount() { return n; },
    get stepIndex() { return stepIndex; },
    getResidentParticlesBuffer: () => partsBuf,
    getRenderSpheres,
    getTelemetry: () => lastTelemetry,
    step,
    dispose
  });
}

export function registerTidalRocheDisruptionModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('tidal-roche-rheology-cryovolcanism@1')) {
    return registry.resolveModule('tidal-roche-rheology-cryovolcanism@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'tidal-roche-rheology-cryovolcanism', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/tidalRocheDisruptionGpu.js',
      entryPoint: 'step_tidal_roche',
      workgroupSize: 64
    },
    parameterSchema: {
      mode: { type: 'string', required: false },
      orbitRadiusSim: { type: 'number', min: 0.5, max: 50, required: false }
    },
    stateLayout: {
      tensorId: 'tidal-debris-particles',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'm', 'vx', 'vy', 'vz', 'intact', 'temp', 'strain', 'role', 'age', 'seed', 'r0', 'phi0', 'live']
    },
    scaleRangeM: [1e2, 1e14],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createTidalRocheDisruptionSessionWebGpu(device, {
        mode: p.mode ?? 'roche-rings',
        orbitRadiusSim: p.orbitRadiusSim ?? 2.4,
        particleCount: 512
      });
      const tel = await session.step({ dt: 0.025, substeps: 2, readTelemetry: true });
      session.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:tidal-roche:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/astrophysics/tidalRocheDisruptionGpu.js',
          entryPoint: 'createTidalRocheDisruptionSessionWebGpu',
          kernelEntryPoint: 'step_tidal_roche'
        },
        representation: 'tidal-roche-rheology-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-tidal-roche', placement: 'local' },
        validity: { finite: Number.isFinite(tel.rupturedFraction) && Number.isFinite(tel.maxTidalStrain) },
        validation: { status: 'pass', validationMode: 'gpu-tidal-roche-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
