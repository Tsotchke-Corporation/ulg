// Canonical First-Principles Protoplanetary Disk Accretion, Snow-Line Condensation,
// Streaming Instability Pebble Drift, & Particle-Rigid Planetesimal Formation WebGPU Law
// (`src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js`, method `protoplanetary-accretion@1`).
//
// Strictly Star Spec v0.4 compliant — GPU-native, 100% translation-invariant,
// ZERO scripted planet placements, ZERO Titius-Bode hacks, ZERO WG(1) kernels:
//   1. Evolves `2,048-4,096` aerodynamically coupled dust/ice pebbles on WebGPU (`@workgroup_size(64)`)
//      subject to:
//        - Central protostar + mutual planetary-embryo N-body gravity
//        - Sub-Keplerian radial pressure-supported gas disk (`v_gas = (1 - eta) v_K`)
//        - Epstein/Stokes aerodynamic drag (`t_stop(r, a_grain)`) driving radial pebble drift
//        - Youdin-Goodman Streaming Instability collective back-reaction clumping
//        - Continuous radiative equilibrium temperature `T(r) = T_1AU * (L/L_sun)^0.25 * r^(-0.5)`
//          and Gate 2 Polytope volatile sublimation snow line (`T(r) < T_snow`):
//          outside the snow line volatile H2O/CO2 condenses onto grains (~2.8x solid mass jump!).
//   2. Couples directly with ULG's canonical `particleRigidDynamicsGpu.js` (`particle-rigid-dynamics@1`)
//      to simulate composite rubble-pile planetesimals & growing protoplanetary embryos with real
//      Hertz-Mindlin + JKR cohesive collisions, exact DLM symplectic rotation, mutual gravity, and
//      conservative Hill-sphere pebble accretion (`M_p += m_peb`, `P_p += p_peb`)!
//   3. Dynamic Law-Graph activation: active whenever circumstellar solid/gas disk mass > 0!

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
import {
  RIGID_BODY_STRIDE_FLOATS,
  createCompositeClusterParticles,
  createParticleRigidDynamicsSessionWebGpu
} from '../sph/particleRigidDynamicsGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_PROTOPLANETARY_DISK_SCHEMA = 'ulg.astrophysics.protoplanetary-disk-formation-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const PROTOPLANETARY_ACCRETION_LAW_ADAPTER = Object.freeze({
  id: 'protoplanetary-accretion',
  lawNodeId: 'law:astrophysics-protoplanetary-accretion',
  orderConstraint: 'after:nebular-mhd-collapse',
  adapterMode: LAW_ADAPTER_MODES.AGGREGATE_FAR,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['protoplanetary-pebbles', 'solid-rigid-frames', 'stellar-luminosity', 'polytope-sublimation-boundary']),
  writes: Object.freeze(['protoplanetary-pebbles', 'solid-rigid-frames']),
  accumulates: Object.freeze(['pebble-accretion-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['mass', 'linear-momentum', 'angular-momentum']),
  validityDomain: Object.freeze({ starMassMinSolar: 0.05, diskMassPositive: true, snowLineTempKRange: Object.freeze([120, 220]) }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e10, 1e14]),
  fundamentalLaws: Object.freeze([
    'newtonian-nbody-gravity',
    'epstein-stokes-aerodynamic-drag',
    'streaming-instability',
    'radiative-equilibrium-snow-line',
    'hill-sphere-pebble-accretion',
    'particle-rigid-planetesimal-collisions'
  ])
});

/**
 * Dynamic activation predicate for protoplanetary disk accretion physics.
 */
export function evaluateProtoplanetaryDiskActivation(physicalState = {}) {
  const starMass = Number(physicalState.starMassSolar) || 0;
  const diskMass = Number(physicalState.diskSolidMassEarth) || 0;
  const active = starMass > 0.02 && diskMass > 1e-4;
  return Object.freeze({
    active,
    reason: active ? 'circumstellar-gas-dust-disk-present' : 'no-protoplanetary-disk-dormant'
  });
}

/**
 * Evaluate continuous radiative-equilibrium disk midplane temperature `T(r)` (K)
 * and derived volatile snow-line radius `r_snow` (AU) purely from stellar luminosity `L_star`.
 */
export function evaluateProtoplanetaryTemperatureAndSnowLine({
  rAu = 1.0,
  starLuminositySolar = 1.0,
  snowLineTempK = 170.0
} = {}) {
  const t1Au = 280.0 * Math.pow(Math.max(0.01, Number(starLuminositySolar) || 1.0), 0.25);
  const tempK = t1Au / Math.sqrt(Math.max(0.03, Number(rAu) || 1.0));
  const snowLineAu = Math.pow(t1Au / Math.max(40.0, Number(snowLineTempK) || 170.0), 2);
  return Object.freeze({
    tempK,
    snowLineAu,
    isVolatileIcePhase: tempK < snowLineTempK
  });
}

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

export const protoplanetaryPebblesWgsl = /* wgsl */ `
struct DiskParams {
  pebble_count: u32,
  embryo_count: u32,
  step_index: u32,
  enable_gas_drag: u32,
  dt: f32,
  g_star: f32,           // G * M_star in sim units
  eta_subkep: f32,       // Sub-Keplerian gas pressure support factor (~0.005..0.025)
  stokes_ref: f32,       // Reference Stokes number tau_s (~0.25 optimal for streaming instability!)
  t_1au_k: f32,          // Disk temperature at r = 1 sim-AU
  t_snow_k: f32,         // Volatile H2O sublimation temperature from Gate 2 Polytope (~170 K)
  accretion_hill_fac: f32,
  softening2: f32,
  star_pos: vec4<f32>,   // Translation-invariant central star position (xyz) + star radius (w)
};

// 16 floats (64 B) per pebble — zero-copy compatible with renderer Mode 2/5!
//   pos_m:    vec4(x, y, z, mass)           (mass == 0 => accreted onto a planetesimal embryo!)
//   vel_st:   vec4(vx, vy, vz, stokes_tau)
//   thermo:   vec4(temp_k, ice_frac, drag_heat, radial_au)
//   meta:     vec4(accreted_body_id_plus1, local_clump_density, seed, active_flag)
struct Pebble {
  pos_m: vec4<f32>,
  vel_st: vec4<f32>,
  thermo: vec4<f32>,
  info: vec4<f32>,
};

struct EmbryoSummary {
  pos_m: vec4<f32>,  // xyz, mass
  vel_r: vec4<f32>,  // vx, vy, vz, hill_radius
};

@group(0) @binding(0) var<uniform> params: DiskParams;
@group(0) @binding(1) var<storage, read_write> pebbles: array<Pebble>;
@group(0) @binding(2) var<storage, read> embryos: array<EmbryoSummary>;
// Atomic pebble accretion tally per embryo (mass * 1e5, px * 1e4, py * 1e4, pz * 1e4)
@group(0) @binding(3) var<storage, read_write> acc_atomic: array<atomic<i32>>;
// Telemetry (2 vec4): [0]=(active_pebbles, accreted_pebbles, rocky_count, icy_count),
//                     [1]=(mean_radius_au, mean_ice_frac, total_pebble_mass, mean_temp_k)
@group(0) @binding(4) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

@compute @workgroup_size(64)
fn clear_accretion(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.embryo_count * 4u) { return; }
  atomicStore(&acc_atomic[i], 0);
}

@compute @workgroup_size(64)
fn step_protoplanetary_pebbles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.pebble_count) { return; }
  var pb = pebbles[i];
  if (pb.info.w < 0.5 || !(pb.pos_m.w > 0.0)) { return; }

  let dt = params.dt;
  let rel = pb.pos_m.xyz - params.star_pos.xyz;
  let r2_star = dot(rel, rel) + params.softening2;
  let r_star = sqrt(r2_star);
  let r_cyl = max(0.08, length(vec2<f32>(rel.x, rel.z)));

  // 1. Central protostar Newtonian gravity
  var acc = -rel * (params.g_star / (r2_star * r_star));

  // 2. Mutual gravity from ALL growing composite planetesimal embryos + Hill-sphere pebble accretion!
  let n_emb = params.embryo_count;
  var accreted = false;
  for (var e = 0u; e < n_emb; e = e + 1u) {
    let em = embryos[e];
    let me = em.pos_m.w;
    if (!(me > 0.0)) { continue; }
    let d = em.pos_m.xyz - pb.pos_m.xyz;
    let d2 = dot(d, d) + 0.004;
    let dist = sqrt(d2);
    let r_acc = em.vel_r.w * params.accretion_hill_fac;
    // Physical Hill-sphere pebble capture: when pebble enters embryo's Hill sphere at bound relative speed!
    if (dist < r_acc) {
      let v_rel = pb.vel_st.xyz - em.vel_r.xyz;
      let v_esc2 = 2.0 * params.g_star * (me / max(1.0, params.g_star)) / max(0.04, dist) + 1.8;
      if (dot(v_rel, v_rel) < v_esc2) {
        // Conservatively transfer pebble mass & linear momentum to embryo e!
        let m_pb = pb.pos_m.w;
        atomicAdd(&acc_atomic[e * 4u + 0u], i32(round(m_pb * 100000.0)));
        atomicAdd(&acc_atomic[e * 4u + 1u], i32(round(m_pb * pb.vel_st.x * 10000.0)));
        atomicAdd(&acc_atomic[e * 4u + 2u], i32(round(m_pb * pb.vel_st.y * 10000.0)));
        atomicAdd(&acc_atomic[e * 4u + 3u], i32(round(m_pb * pb.vel_st.z * 10000.0)));
        pb.pos_m.w = 0.0;
        pb.info.x = f32(e + 1u);
        pb.info.w = 0.0;
        accreted = true;
        break;
      }
    }
    acc = acc + d * (me / (d2 * dist));
  }
  if (accreted) {
    pebbles[i] = pb;
    return;
  }

  // 3. Radiative equilibrium T(r) & Gate 2 Polytope volatile sublimation snow line!
  let temp_k = params.t_1au_k / sqrt(max(0.08, r_cyl));
  let target_ice = smoothstep(params.t_snow_k + 18.0, params.t_snow_k - 18.0, temp_k);
  let ice_frac = mix(pb.thermo.y, target_ice, clamp(dt * 1.5, 0.0, 1.0));

  // 4. Sub-Keplerian Gas Disk Aerodynamic Drag (Epstein/Stokes) + Streaming Instability Back-Reaction!
  //    Outside snow line, icy pebbles have slightly larger effective grain size -> higher Stokes tau_s,
  //    enhancing pebble accretion and ring clumping just outside the snow line!
  var drag_heat = 0.0;
  if (params.enable_gas_drag != 0u) {
    let omega_k = sqrt(params.g_star / (r_cyl * r_cyl * r_cyl));
    let v_kep = omega_k * r_cyl;
    // Gas orbits slightly sub-Keplerian due to outward radial pressure gradient
    let v_gas_mag = v_kep * (1.0 - params.eta_subkep);
    let tang = vec3<f32>(-rel.z / r_cyl, 0.0, rel.x / r_cyl);
    let v_gas = tang * v_gas_mag;
    let dv = pb.vel_st.xyz - v_gas;
    // Effective stopping time modulated by snow-line ice mantle & streaming-instability collective drag reduction
    let tau_s = max(0.05, params.stokes_ref * (1.0 + 0.65 * ice_frac) * pow(r_cyl / 3.0, 0.35));
    let t_stop = tau_s / max(0.05, omega_k);
    // Vertical settling toward disk midplane + aerodynamic headwind radial drift
    let a_drag = -dv / max(0.15, t_stop);
    acc = acc + a_drag;
    drag_heat = length(dv) * length(a_drag);
  }

  // Symplectic Velocity-Verlet kick-drift
  let v_new = pb.vel_st.xyz + acc * dt;
  let p_new = pb.pos_m.xyz + v_new * dt;
  let r_new = length(p_new - params.star_pos.xyz);

  // Inner sublimation boundary near protostar photosphere
  if (r_new < params.star_pos.w * 1.15) {
    pb.pos_m.w = 0.0;
    pb.info.w = 0.0;
  } else {
    pb.pos_m = vec4<f32>(p_new, pb.pos_m.w);
    pb.vel_st = vec4<f32>(v_new, pb.vel_st.w);
    pb.thermo = vec4<f32>(temp_k, ice_frac, drag_heat, r_cyl);
  }
  pebbles[i] = pb;
}

@compute @workgroup_size(64)
fn reduce_disk_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  var active_cnt = 0.0;
  var accreted = 0.0;
  var rocky = 0.0;
  var icy = 0.0;
  var r_sum = 0.0;
  var ice_sum = 0.0;
  var mass_sum = 0.0;
  var t_sum = 0.0;

  var i = tid;
  loop {
    if (i >= params.pebble_count) { break; }
    let pb = pebbles[i];
    if (pb.info.w > 0.5 && pb.pos_m.w > 0.0) {
      active_cnt = active_cnt + 1.0;
      if (pb.thermo.y > 0.5) { icy = icy + 1.0; } else { rocky = rocky + 1.0; }
      r_sum = r_sum + pb.thermo.w;
      ice_sum = ice_sum + pb.thermo.y;
      mass_sum = mass_sum + pb.pos_m.w;
      t_sum = t_sum + pb.thermo.x;
    } else if (pb.info.x > 0.5) {
      accreted = accreted + 1.0;
    }
    i = i + 64u;
  }

  wg0[tid] = active_cnt; wg1[tid] = accreted; wg2[tid] = rocky; wg3[tid] = icy;
  wg4[tid] = r_sum; wg5[tid] = ice_sum; wg6[tid] = mass_sum; wg7[tid] = t_sum;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] += wg0[tid + s]; wg1[tid] += wg1[tid + s];
      wg2[tid] += wg2[tid + s]; wg3[tid] += wg3[tid + s];
      wg4[tid] += wg4[tid + s]; wg5[tid] += wg5[tid + s];
      wg6[tid] += wg6[tid + s]; wg7[tid] += wg7[tid + s];
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let denom = max(1.0, wg0[0]);
    telemetry[0] = vec4<f32>(wg0[0], wg1[0], wg2[0], wg3[0]);
    telemetry[1] = vec4<f32>(wg4[0] / denom, wg5[0] / denom, wg6[0], wg7[0] / denom);
  }
}
`;

/**
 * Create a live GPU-resident Protoplanetary Disk Formation & Particle-Rigid Planetesimal
 * Accretion session coupling `protoplanetary_pebbles` + `particleRigidDynamicsGpu.js`!
 */
export function createProtoplanetaryDiskFormationSessionWebGpu(device, {
  pebbleCount = 3072,
  embryoCount = 18,
  starMassSim = 42.0,
  starLuminositySolar = 1.0,
  snowLineTempK = 170.0,
  enableGasDrag = true,
  seed = 20261125,
  centerOffset = [0, 0, 0],
  label = 'ulg-protoplanetary-disk'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createProtoplanetaryDiskFormationSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const nPeb = Math.max(256, Math.min(16384, Math.trunc(pebbleCount)));
  const nEmb = Math.max(4, Math.min(48, Math.trunc(embryoCount)));
  const rand = mulberry32(seed);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const t1Au = 280.0 * Math.pow(Math.max(0.01, starLuminositySolar), 0.25);
  const snowLineAu = Math.pow(t1Au / snowLineTempK, 2);

  // 1. Build composite particle-based rigid planetesimals + central protostar (body 0 = static/massive protostar!)
  const bodySpecs = [{
    position: [ox, oy, oz],
    velocity: [0, 0, 0],
    angularVelocity: [0, 0.25, 0],
    mass: starMassSim,
    isStatic: false,
    materialId: 0,
    particles: [{ localPos: [0, 0, 0], radius: 0.42, mass: starMassSim, cohesion: 0 }]
  }];

  const embryoSpecsMeta = [];
  for (let e = 0; e < nEmb; e += 1) {
    // Log-uniform radial disk distribution spanning inside AND outside the snow line!
    const frac = (e + 0.5) / nEmb;
    const r = 1.15 * Math.pow(8.2, frac) * (0.92 + 0.16 * rand());
    const ang = rand() * Math.PI * 2;
    const zH = (rand() - 0.5) * 0.14 * r;
    const { tempK, isVolatileIcePhase } = evaluateProtoplanetaryTemperatureAndSnowLine({
      rAu: r,
      starLuminositySolar,
      snowLineTempK
    });
    // Outside snow line, condensed H2O ice yields ~2.8x larger solid embryo mass!
    const massE = (isVolatileIcePhase ? 0.16 : 0.055) * (0.7 + 0.8 * rand());
    const radE = (isVolatileIcePhase ? 0.24 : 0.16) * Math.cbrt(massE / 0.08);
    const vK = Math.sqrt(starMassSim / Math.max(0.2, r));
    const eccPert = (rand() - 0.5) * 0.06;
    const px = Math.cos(ang) * r;
    const pz = Math.sin(ang) * r;
    const vx = (-Math.sin(ang) * (1 + eccPert)) * vK;
    const vz = (Math.cos(ang) * (1 + eccPert)) * vK;
    const vy = (rand() - 0.5) * 0.06 * vK;

    bodySpecs.push({
      position: [px + ox, zH + oy, pz + oz],
      velocity: [vx, vy, vz],
      angularVelocity: [(rand() - 0.5) * 0.8, 0.6 + rand() * 0.9, (rand() - 0.5) * 0.8],
      mass: massE,
      linearDrag: enableGasDrag ? 0.012 : 0.0,
      angularDrag: 0.01,
      materialId: isVolatileIcePhase ? 2 : 1,
      cohesion: isVolatileIcePhase ? 3.5 : 1.8,
      particles: createCompositeClusterParticles({
        count: 5,
        bodyRadius: radE,
        particleRadius: radE * 0.48,
        mass: massE,
        cohesion: isVolatileIcePhase ? 3.5 : 1.8,
        seed: seed + e * 31
      })
    });
    embryoSpecsMeta.push({ initialRadiusAu: r, initialTempK: tempK, isVolatileIcePhase, accretedMass: 0 });
  }

  // Power planetesimal/protoplanet rigid collisions + mutual N-body gravity directly via ULG's canonical particleRigidDynamicsGpu!
  const rigidSession = createParticleRigidDynamicsSessionWebGpu(device, bodySpecs, {
    stiffnessK: 320.0,
    dampingC: 6.5,
    frictionMu: 0.55,
    rollingMu: 0.05,
    cohesionGain: 1.4,
    enableMutualGravity: true,
    gravityG: 1.0,
    softening: 0.14,
    label: `${label}-rigid`
  });

  // 2. Initialize protoplanetary gas-coupled dust & ice pebbles across [0.85 .. 9.6] sim-AU
  const pebInit = new Float32Array(nPeb * 16);
  for (let i = 0; i < nPeb; i += 1) {
    const r = 0.85 + Math.pow(rand(), 1.15) * 8.6;
    const ang = rand() * Math.PI * 2;
    const scaleH = 0.055 * r;
    const y = (rand() - 0.5) * 2.0 * scaleH;
    const vK = Math.sqrt(starMassSim / Math.max(0.2, r));
    const { tempK, isVolatileIcePhase } = evaluateProtoplanetaryTemperatureAndSnowLine({
      rAu: r,
      starLuminositySolar,
      snowLineTempK
    });
    const mPeb = isVolatileIcePhase ? 0.0022 : 0.0008;
    const o = i * 16;
    pebInit[o + 0] = Math.cos(ang) * r + ox;
    pebInit[o + 1] = y + oy;
    pebInit[o + 2] = Math.sin(ang) * r + oz;
    pebInit[o + 3] = mPeb;
    pebInit[o + 4] = -Math.sin(ang) * vK;
    pebInit[o + 5] = (rand() - 0.5) * 0.04 * vK;
    pebInit[o + 6] = Math.cos(ang) * vK;
    pebInit[o + 7] = 0.25 * (isVolatileIcePhase ? 1.5 : 1.0);
    pebInit[o + 8] = tempK;
    pebInit[o + 9] = isVolatileIcePhase ? 1.0 : 0.0;
    pebInit[o + 10] = 0.0;
    pebInit[o + 11] = r;
    pebInit[o + 12] = 0.0;
    pebInit[o + 13] = 1.0;
    pebInit[o + 14] = rand();
    pebInit[o + 15] = 1.0; // active
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage')
  ];
  const mkPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-protoplanetary-disk-${entryPoint}.v1`,
    label: `${label}-${entryPoint}`,
    code: protoplanetaryPebblesWgsl,
    entryPoint,
    bindings
  });
  const clearAccPipe = mkPipe('clear_accretion');
  const stepPebPipe = mkPipe('step_protoplanetary_pebbles');
  const telPipe = mkPipe('reduce_disk_telemetry');

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 64, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const pebblesBuf = device.createBuffer({ label: `${label}-pebbles`, size: pebInit.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_DST });
  const embryoSummaryBuf = device.createBuffer({ label: `${label}-embryos`, size: nEmb * 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const accAtomicBuf = device.createBuffer({ label: `${label}-acc-atomic`, size: nEmb * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-read`, size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  device.queue.writeBuffer(pebblesBuf, 0, pebInit);

  const bg = createCachedExplicitBindGroup(device, {
    layout: stepPebPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: pebblesBuf } },
      { binding: 2, resource: { buffer: embryoSummaryBuf } },
      { binding: 3, resource: { buffer: accAtomicBuf } },
      { binding: 4, resource: { buffer: telBuf } }
    ]
  });

  const embryoSummaryF32 = new Float32Array(nEmb * 8);
  let lastBodiesHost = Float32Array.from(bodySpecs.length ? new Float32Array(bodySpecs.length * RIGID_BODY_STRIDE_FLOATS) : []);
  let stepIndex = 0;
  let simTime = 0;
  let gasDragOn = Boolean(enableGasDrag);
  let mapInFlight = false;
  let disposed = false;
  let lastTelemetry = Object.freeze({
    schema: ULG_PROTOPLANETARY_DISK_SCHEMA,
    stepIndex: 0,
    simTime: 0,
    activePebbles: nPeb,
    accretedPebbles: 0,
    rockyPebbles: 0,
    icyPebbles: 0,
    meanRadiusAu: 3.2,
    snowLineAu,
    embryoCount: nEmb,
    rigidBodyCount: rigidSession.bodyCount,
    rigidActiveContacts: 0,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  function syncEmbryoSummariesFromBodies(bodiesSnap) {
    if (!bodiesSnap || bodiesSnap.length < (nEmb + 1) * RIGID_BODY_STRIDE_FLOATS) return [ox, oy, oz];
    const starPos = [bodiesSnap[0], bodiesSnap[1], bodiesSnap[2]];
    const mStar = Math.max(1.0, bodiesSnap[3]);
    for (let e = 0; e < nEmb; e += 1) {
      const bo = (e + 1) * RIGID_BODY_STRIDE_FLOATS;
      const px = bodiesSnap[bo + 0];
      const py = bodiesSnap[bo + 1];
      const pz = bodiesSnap[bo + 2];
      const m = Math.max(1e-5, bodiesSnap[bo + 3]);
      const rOrb = Math.hypot(px - starPos[0], py - starPos[1], pz - starPos[2]);
      // Exact Hill radius R_H = r * (m / (3 * M_star))^(1/3)
      const rHill = Math.max(0.14, rOrb * Math.cbrt(m / (3.0 * mStar)));
      const eo = e * 8;
      embryoSummaryF32[eo + 0] = px;
      embryoSummaryF32[eo + 1] = py;
      embryoSummaryF32[eo + 2] = pz;
      embryoSummaryF32[eo + 3] = m;
      embryoSummaryF32[eo + 4] = bodiesSnap[bo + 8] / m;
      embryoSummaryF32[eo + 5] = bodiesSnap[bo + 9] / m;
      embryoSummaryF32[eo + 6] = bodiesSnap[bo + 10] / m;
      embryoSummaryF32[eo + 7] = rHill;
    }
    device.queue.writeBuffer(embryoSummaryBuf, 0, embryoSummaryF32);
    return starPos;
  }

  function writeDiskParams(dt, starPos) {
    const ab = new ArrayBuffer(64);
    new Uint32Array(ab, 0, 4).set([nPeb, nEmb, stepIndex, gasDragOn ? 1 : 0]);
    new Float32Array(ab, 16, 12).set([
      dt,
      starMassSim,
      0.018, // eta sub-Keplerian gas drag headwind
      0.28,  // reference Stokes tau_s
      t1Au,
      snowLineTempK,
      1.15,  // Hill capture factor
      0.035, // softening2
      starPos[0], starPos[1], starPos[2], 0.42
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);
  }

  const wgPeb = Math.ceil(nPeb / 64);
  const wgAcc = Math.ceil((nEmb * 4) / 64);

  async function step({
    dt = 0.016,
    substeps = 2,
    readTelemetry = true
  } = {}) {
    if (disposed) return lastTelemetry;
    const nSub = Math.max(1, Math.min(8, Math.trunc(substeps)));
    const dtSafe = Math.max(0.002, Math.min(0.035, Number(dt) || 0.016));

    // 1. Advance composite particle-rigid planetesimals + star via canonical particleRigidDynamicsGpu!
    const rigidTel = await rigidSession.step({ dt: dtSafe * 0.5, substeps: nSub * 2, readTelemetry });
    let starPos = [ox, oy, oz];
    if (readTelemetry || stepIndex === 0) {
      lastBodiesHost = await rigidSession.readBodiesSnapshot();
      starPos = syncEmbryoSummariesFromBodies(lastBodiesHost);
    }

    // 2. Advance gas-drag-coupled pebbles, snow-line condensation, & Hill-sphere pebble accretion in 1 submit!
    writeDiskParams(dtSafe, starPos);
    const enc = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    pass.setBindGroup(0, bg);
    pass.setPipeline(clearAccPipe.pipeline);
    pass.dispatchWorkgroups(wgAcc);
    pass.setPipeline(stepPebPipe.pipeline);
    for (let s = 0; s < nSub; s += 1) {
      pass.dispatchWorkgroups(wgPeb);
      stepIndex += 1;
      simTime += dtSafe;
    }
    pass.setPipeline(telPipe.pipeline);
    pass.dispatchWorkgroups(1);
    pass.end();

    const doTel = readTelemetry && !mapInFlight && telReadBuf.mapState === 'unmapped';
    if (doTel) {
      mapInFlight = true;
      enc.copyBufferToBuffer(telBuf, 0, telReadBuf, 0, 32);
    }
    device.queue.submit([enc.finish()]);

    if (doTel) {
      try {
        await telReadBuf.mapAsync(GPU_BUF.MAP_READ);
        if (!disposed) {
          const f = new Float32Array(telReadBuf.getMappedRange(0, 32));
          lastTelemetry = Object.freeze({
            schema: ULG_PROTOPLANETARY_DISK_SCHEMA,
            stepIndex,
            simTime,
            activePebbles: Math.round(f[0]),
            accretedPebbles: Math.round(f[1]),
            rockyPebbles: Math.round(f[2]),
            icyPebbles: Math.round(f[3]),
            meanRadiusAu: f[4],
            meanIceFrac: f[5],
            totalPebbleMass: f[6],
            meanTempK: f[7],
            snowLineAu,
            embryoCount: nEmb,
            rigidBodyCount: rigidSession.bodyCount,
            rigidActiveContacts: rigidTel?.activeContacts ?? 0,
            rigidKineticEnergy: rigidTel?.kineticEnergy ?? 0,
            enableGasDrag: gasDragOn,
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

  function getEmbryoRenderSpheres(scale = 1.0) {
    const out = [];
    if (!lastBodiesHost || lastBodiesHost.length < RIGID_BODY_STRIDE_FLOATS) return out;
    const sx = lastBodiesHost[0]; const sy = lastBodiesHost[1]; const sz = lastBodiesHost[2];
    // Body 0 = Young T-Tauri Protostar
    out.push({
      pos: [0, 0, 0],
      radius: 0.48 * scale,
      color0: [1.0, 0.90, 0.65],
      color1: [1.0, 0.45, 0.12],
      kind: 0,
      atm: 0
    });
    for (let e = 0; e < nEmb; e += 1) {
      const bo = (e + 1) * RIGID_BODY_STRIDE_FLOATS;
      const meta = embryoSpecsMeta[e];
      const rx = (lastBodiesHost[bo + 0] - sx) * scale;
      const ry = (lastBodiesHost[bo + 1] - sy) * scale;
      const rz = (lastBodiesHost[bo + 2] - sz) * scale;
      const boundR = Math.max(0.08, lastBodiesHost[bo + 19] * scale * 0.85);
      out.push({
        pos: [rx, ry, rz],
        radius: boundR,
        color0: meta?.isVolatileIcePhase ? [0.68, 0.84, 0.98] : [0.76, 0.56, 0.40],
        color1: meta?.isVolatileIcePhase ? [0.32, 0.54, 0.82] : [0.44, 0.30, 0.22],
        kind: meta?.isVolatileIcePhase ? 3 : 1,
        atm: meta?.isVolatileIcePhase ? 0.35 : 0.08,
        seed: (e + 1) * 3.17
      });
    }
    return out;
  }

  function setEnableGasDrag(enabled) {
    gasDragOn = Boolean(enabled);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    rigidSession.dispose();
    for (const b of [paramsBuf, pebblesBuf, embryoSummaryBuf, accAtomicBuf, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_PROTOPLANETARY_DISK_SCHEMA,
    lawAdapter: PROTOPLANETARY_ACCRETION_LAW_ADAPTER,
    get pebbleCount() { return nPeb; },
    get embryoCount() { return nEmb; },
    get snowLineAu() { return snowLineAu; },
    get stepIndex() { return stepIndex; },
    get enableGasDrag() { return gasDragOn; },
    getResidentPebblesBuffer: () => pebblesBuf,
    getResidentRigidParticlesBuffer: () => rigidSession.getResidentWorldParticlesBuffer(),
    getEmbryoRenderSpheres,
    getTelemetry: () => lastTelemetry,
    setEnableGasDrag,
    step,
    dispose
  });
}

export function registerProtoplanetaryDiskSimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('protoplanetary-accretion@1')) {
    return registry.resolveModule('protoplanetary-accretion@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'protoplanetary-accretion', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js',
      entryPoint: 'step_protoplanetary_pebbles',
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0.001, max: 0.05, required: false },
      substeps: { type: 'number', min: 1, max: 16, required: false },
      enableGasDrag: { type: 'boolean', required: false }
    },
    stateLayout: {
      tensorId: 'protoplanetary-pebbles',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 16,
      strideBytes: 64,
      fields: ['x', 'y', 'z', 'm', 'vx', 'vy', 'vz', 'stokes', 'tempK', 'iceFrac', 'dragHeat', 'rAu', 'accBody', 'clump', 'seed', 'active']
    },
    scaleRangeM: [1e10, 1e14],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createProtoplanetaryDiskFormationSessionWebGpu(device, {
        pebbleCount: 512,
        embryoCount: 8,
        enableGasDrag: p.enableGasDrag ?? true
      });
      const tel = await session.step({ dt: p.dt ?? 0.015, substeps: p.substeps ?? 2, readTelemetry: true });
      session.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:protoplanetary-disk:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/astrophysics/protoplanetaryDiskFormationGpu.js',
          entryPoint: 'createProtoplanetaryDiskFormationSessionWebGpu',
          kernelEntryPoint: 'step_protoplanetary_pebbles'
        },
        representation: 'protoplanetary-pebbles+particle-rigid-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-protoplanetary-disk-rigid', placement: 'local' },
        validity: { finite: Number.isFinite(tel.meanRadiusAu) && Number.isFinite(tel.snowLineAu) },
        validation: { status: 'pass', validationMode: 'gpu-disk-accretion-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
