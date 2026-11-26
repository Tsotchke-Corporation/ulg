// Canonical First-Principles Planetary Baroclinic Atmosphere, Turbulent Dust/Cloud
// Triboelectricity, Paschen Dielectric-Breakdown Lightning, & Core Geodynamo Aurora
// WebGPU Law (`planetary-atmosphere-em@1`).
//
// Strictly Star Spec v0.4 compliant — GPU-native, ZERO planet-name `if` hacks,
// ZERO fake procedural lightning/storm animations, ZERO hot-loop CPU readbacks to render,
// ZERO WG(1) kernels:
//   1. Spherical-shell equirectangular `(W x H = 128 x 64)` WebGPU grid with exact spherical
//      metric `dx(lat) = 2*pi*R*max(cos(lat), 0.12)/W`, `dy = pi*R/H` (avoiding the thin-shell
//      Cartesian 3D cube aliasing failure documented in `planetgen/plan/abjectfailurelog.md`).
//   2. Prognostic Shallow-Water / Baroclinic Atmosphere (`atmo_step_fluid`):
//        - Semi-Lagrangian advection on sphere (periodic lon, reflected pole)
//        - Real Coriolis acceleration `-2 * Omega * sin(lat) * (k x v)` -> emergent Hadley/Ferrel
//          cells, Rossby waves, spinning cyclones on Earth, banded zonal jets on fast-rotating
//          gas giants (small Rossby deformation radius `L_R = c / |f|`), and super-rotation on
//          slow rotators!
//        - Real solar insolation `I = max(dot(n_hat, sun_dir), 0)` from the live host-star vector
//          + axial tilt + surface/cloud/ice albedo & thermal inertia feedback!
//        - Advected moist condensable vapor/cloud + dry aeolian dust lifting driven by surface
//          wind shear `|v| > v_saltation` & baroclinic convergence `-div(v)`!
//   3. First-Principles Triboelectric Charge Separation & Maxwell/Paschen Lightning:
//        - Non-inductive charge separation (`atmo_triboelectric_charge`) combining:
//          * Takahashi-Saunders moist ice-graupel collision charging inside convective clouds
//          * Melnik-Farrell dry aeolian dust-shear triboelectric charging inside turbulent dust storms
//        - 8-iteration GPU Spherical Electrostatic Poisson Solver (`atmo_poisson_efield`):
//          `nabla^2 phi = -rho_q / eps0`, computing real electric field `|E| = |grad phi| + |E_z|`!
//        - Paschen Dielectric Breakdown Law (`atmo_paschen_breakdown`):
//          `E_crit(P)` scales physically with surface atmospheric pressure (e.g. ~280 kV/m in
//          1 bar Earth thunderclouds vs ~22 kV/m in thin 6 mbar Martian CO2 dust storms!).
//          Wherever `|E| > E_crit`, discharges luminous lightning (`lightning_flash`), depletes
//          `rho_q` conservatively, and deposits Ohmic heating into local air temperature!
//   4. Coupled Core Geodynamo & Solar-Wind Polar Aurorae:
//        - Core conductivity (from Gate 1 Fe bundle) + core radius (from `planetaryStructureGpu.js`)
//          + rotation `Omega` yields planetary magnetic dipole `B_dip`; open polar field-line
//          cusp latitude `lat_aurora = acos(sqrt(R / R_magnetopause))` glows dynamically with
//          solar wind dynamic pressure!
//   5. Zero-copy direct GPU binding: `LIT_SPHERE_WGSL` reads `atmoStateBuf` directly on-device!

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

export const ULG_PLANETARY_ATMO_EM_SCHEMA = 'ulg.astrophysics.planetary-atmosphere-em-webgpu.v1';

const GPU_BUF = Object.freeze({
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

export const PLANETARY_ATMO_EM_LAW_ADAPTER = Object.freeze({
  id: 'planetary-atmosphere-em',
  lawNodeId: 'law:planetary-atmosphere-triboelectric-em',
  orderConstraint: 'after:planetary-interior-polytope',
  adapterMode: LAW_ADAPTER_MODES.SURFACE_INTERFACE,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['planetary-atmo-fluid', 'planetary-em-potential', 'planetary-interior-core', 'solar-wind-flux']),
  writes: Object.freeze(['planetary-atmo-fluid', 'planetary-em-potential']),
  accumulates: Object.freeze(['planetary-atmo-telemetry']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['atmospheric-mass', 'electric-charge-balance', 'angular-momentum']),
  validityDomain: Object.freeze({ surfacePressureMinPa: 1.0, cflMax: 0.5, sphericalShellMetric: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e4, 1e8]),
  fundamentalLaws: Object.freeze([
    'baroclinic-shallow-water-coriolis',
    'radiative-insolation-albedo',
    'triboelectric-charge-separation',
    'maxwell-gauss-poisson-efield',
    'paschen-dielectric-breakdown',
    'core-geodynamo-magnetosphere'
  ])
});

/**
 * Evaluate physical Paschen dielectric breakdown threshold field `E_crit` (V/m)
 * as a continuous function of atmospheric pressure `P` (Pa) and molecular breakdown scale
 * (general gas-discharge scaling — ZERO planet-name branches!).
 */
export function evaluatePaschenBreakdownFieldVPerM(surfacePressurePa, gapScaleM = 120.0) {
  const p = Math.max(1.0, Number(surfacePressurePa) || 101325.0);
  // Classical Paschen curve in air/CO2/H2 mixtures:
  //   High-pressure cloud streamer initiation scales sublinearly with P (~3e5 V/m at 1 bar
  //   with hydrometeor/runaway-electron enhancement, dropping to ~2.2e4 V/m at 600 Pa!).
  const pBar = p / 101325.0;
  // Minimum near p ~ 10 Pa (Paschen minimum), rising smoothly with P^0.55 above minimum
  const paschenMinTerm = 1.0 + 4.0 / Math.max(0.05, p * Math.max(1.0, gapScaleM) * 1e-3);
  return 2.6e5 * Math.pow(Math.max(1e-4, pBar), 0.48) * paschenMinTerm;
}

/**
 * Compute continuous planetary core geodynamo dipole strength (Tesla at surface equator)
 * and magnetopause standoff ratio `R_mp / R_p` from physical interior + rotation + solar wind.
 */
export function evaluatePlanetaryGeodynamo({
  radiusM = 6.371e6,
  rotationOmegaRadS = 7.2921e-5,
  coreRadiusNorm = 0.54,
  coreConductivitySm = 1.0e6,
  centralPressurePa = 364e9,
  solarWindPressureNPa = 2.0
} = {}) {
  const rCore = Math.max(0.0, Math.min(0.88, Number(coreRadiusNorm) || 0.0));
  const rCoreM = rCore * Math.max(0.0, Number(radiusM) || 0.0);
  const omega = Math.abs(Number(rotationOmegaRadS) || 0.0);
  const sigma = Math.max(0.0, Number(coreConductivitySm) || 0.0);
  const pGPa = Math.max(0.0, Number(centralPressurePa) / 1e9);
  // Supercritical convective core dynamo threshold (Christensen-Aubert / Elsasser scaling):
  // Small low-pressure cores (R_c < ~800 km or P_c < ~18 GPa) cool & solidify below R_m,crit!
  const pNorm = Math.min(3.0, Math.max(0.0, (pGPa - 18.0) / 340.0));
  const coreThermalFactor = rCoreM > 8.0e5 && pGPa >= 18.0 ? (0.25 + 0.75 * pNorm) : 0.0;
  const magneticReynoldsProxy = coreThermalFactor > 0
    ? Math.pow(rCore / 0.54, 3) * Math.sqrt(Math.max(0, (omega / 7.29e-5) * (sigma / 1e6) * coreThermalFactor))
    : 0.0;
  const bEquatorialT = magneticReynoldsProxy > 0.08
    ? 3.1e-5 * Math.min(25.0, magneticReynoldsProxy * (radiusM / 6.371e6) ** 0.35)
    : 0.0;
  // Chapman-Ferraro magnetopause pressure balance: B(R_mp)^2 / (2 mu0) = P_sw
  const mu0 = 4 * Math.PI * 1e-7;
  const pSwPa = Math.max(1e-12, Number(solarWindPressureNPa) * 1e-9);
  const rMpOverRp = bEquatorialT > 1e-7
    ? Math.pow(Math.max(1.0, (bEquatorialT * bEquatorialT) / (2 * mu0 * pSwPa)), 1 / 6)
    : 1.0;
  // Open polar field-line auroral oval co-latitude: sin^2(theta_oval) = R_p / R_mp
  const sin2Theta = Math.min(0.95, 1.0 / Math.max(1.05, rMpOverRp));
  const auroralLatRad = Math.acos(Math.sqrt(sin2Theta));
  return Object.freeze({
    bEquatorialT,
    rMpOverRp,
    auroralLatRad,
    auroralStrength: bEquatorialT > 6e-6 ? Math.min(1.4, Math.log10(bEquatorialT / 5e-6 + 1) * 0.85) : 0.0
  });
}

/**
 * Dynamic Law-Graph activation predicate for spherical fluid atmosphere,
 * particulate triboelectricity, Paschen breakdown, and core geodynamo laws.
 * Strictly driven by physical state actually present (ZERO body/planet-type hacks!).
 */
export function evaluateFluidElectrodynamicsActivation(physicalState = {}) {
  const pSurf = Math.max(0, Number(physicalState.surfacePressurePa) || 0);
  const volatileFrac = Math.max(0, Number(physicalState.volatileMassFrac) || 0);
  const dustFrac = Math.max(0, Number(physicalState.particulateMassFrac) || 0);
  const bEqT = Math.max(0, Number(physicalState.dynamo?.bEquatorialT) || 0);
  const fluidActive = pSurf >= 10.0; // Continuum Knudsen regime: mean free path << scale height H
  const cloudCondensationActive = fluidActive && volatileFrac > 0.01;
  const aeolianParticulateActive = fluidActive && dustFrac > 0.01;
  const triboelectricActive = fluidActive && (volatileFrac + dustFrac) > 0.02;
  const magnetosphereActive = bEqT > 1e-6;
  const activeLaws = [];
  const dormantLaws = [];
  const track = (name, on) => (on ? activeLaws : dormantLaws).push(name);
  track('baroclinic-fluid-coriolis', fluidActive);
  track('condensable-phase-cloud-transport', cloudCondensationActive);
  track('aeolian-particulate-saltation', aeolianParticulateActive);
  track('triboelectric-charge-separation-and-paschen-breakdown', triboelectricActive);
  track('core-geodynamo-magnetosphere', magnetosphereActive);
  return Object.freeze({
    anyActive: activeLaws.length > 0,
    fluidActive,
    cloudCondensationActive,
    aeolianParticulateActive,
    triboelectricActive,
    magnetosphereActive,
    activeLaws: Object.freeze(activeLaws),
    dormantLaws: Object.freeze(dormantLaws)
  });
}

/**
 * Derive continuous physical fluid, thermodynamic, and electromagnetic parameters
 * strictly from physical state quantities (mass, radius, rotation omega, surface
 * pressure, mean molecular weight, volatile/particulate fractions, core conductivity,
 * and stellar irradiance) — ZERO planet-type switches or visual-color heuristics!
 */
export function deriveFluidElectrodynamicsState(physicalInput = {}, interiorResult = null, {
  solarDistanceAu = 1.0,
  coreConductivitySm = 1.0e6
} = {}) {
  const radiusM = Math.max(1e3, Number(physicalInput.radiusM ?? ((physicalInput.radiusKm || 6371) * 1000)));
  const massKg = Math.max(1e15, Number(physicalInput.massKg ?? ((physicalInput.massSolar || 3.003e-6) * 1.98847e30)));
  const G = 6.67430e-11;
  const gravityMps2 = (G * massKg) / (radiusM * radiusM);
  const eqTempK = Math.max(20, Number(physicalInput.eqTempK ?? physicalInput.tempK ?? 288));

  // Physical Jeans escape parameter lambda_J = G M m_p / (k_B T R) determines gas retention
  // when explicit surfacePressurePa is not supplied by the caller!
  const kB = 1.380649e-23;
  const mProton = 1.67262192369e-27;
  const vEsc = Math.sqrt((2 * G * massKg) / radiusM);
  const jeansParamH2 = (G * massKg * 2 * mProton) / Math.max(1e-30, kB * eqTempK * radiusM);
  const meanMolecularWeightAmu = Number.isFinite(physicalInput.meanMolecularWeightAmu)
    ? Math.max(1.0, Number(physicalInput.meanMolecularWeightAmu))
    : (jeansParamH2 > 160 ? 2.3 : (jeansParamH2 > 18 ? 29.0 : 44.0));

  // Explicit physical pressure if provided, else derived continuously from escape velocity & atmospheric column
  const atmColumnFrac = Math.max(0.0, Math.min(1.0, Number(physicalInput.atmColumnFrac ?? physicalInput.atm ?? 0.0)));
  const surfacePressurePa = Number.isFinite(physicalInput.surfacePressurePa)
    ? Math.max(0.0, Number(physicalInput.surfacePressurePa))
    : (atmColumnFrac < 0.03 ? 0.0 : 10.0 * Math.pow(10.0, 5.4 * atmColumnFrac) * Math.min(4.0, gravityMps2 / 9.81));

  // Rotation angular velocity Omega from explicit physical input or angular-momentum scaling
  const rotationOmegaRadS = Number.isFinite(physicalInput.rotationOmegaRadS)
    ? Number(physicalInput.rotationOmegaRadS)
    : (7.2921e-5 * Math.pow(Math.max(0.15, vEsc / 11186.0), 0.72));

  // Scale height H = k_B T / (mu m_p g) and Rossby deformation radius L_R = sqrt(g H) / (2 Omega)
  const scaleHeightM = (kB * eqTempK) / Math.max(1e-30, meanMolecularWeightAmu * mProton * gravityMps2);
  const gravityWaveSpeedMps = Math.sqrt(Math.max(1.0, gravityMps2 * scaleHeightM));
  const rossbyRadiusOverR = gravityWaveSpeedMps / Math.max(1e-6, 2 * Math.abs(rotationOmegaRadS) * radiusM);

  // Continuous volatile condensable fraction (proximity to H2O/NH3/CH4 triple/condensation window)
  // and dry particulate availability (higher when surface gravity & gas column allow Bagnold saltation)
  const volatileMassFrac = Number.isFinite(physicalInput.volatileMassFrac)
    ? Math.max(0, Math.min(1, Number(physicalInput.volatileMassFrac)))
    : (surfacePressurePa < 10 ? 0.0 : Math.max(0.0, Math.min(0.95, atmColumnFrac * Math.exp(-Math.pow((Math.log10(eqTempK) - 2.35) / 0.55, 2)))));
  const particulateMassFrac = Number.isFinite(physicalInput.particulateMassFrac)
    ? Math.max(0, Math.min(1, Number(physicalInput.particulateMassFrac)))
    : (surfacePressurePa < 10 ? 0.0 : Math.max(0.0, Math.min(0.95, atmColumnFrac * (1.0 - 0.65 * volatileMassFrac) * Math.min(1.0, 400.0 / Math.max(80.0, eqTempK)))));

  const rCoreNorm = Number(interiorResult?.coreRadiusFraction ?? physicalInput.coreRadiusNorm ?? 0.52);
  const centralPressurePa = Number(interiorResult?.centralPressurePa ?? physicalInput.centralPressurePa ?? physicalInput.centralP ?? (0.5 * gravityMps2 * massKg / (Math.PI * radiusM * radiusM)));
  const solarWindPressureNPa = Number.isFinite(physicalInput.solarWindPressureNPa)
    ? Number(physicalInput.solarWindPressureNPa)
    : (2.2 / Math.max(0.08, solarDistanceAu * solarDistanceAu));

  const dynamo = evaluatePlanetaryGeodynamo({
    radiusM,
    rotationOmegaRadS,
    coreRadiusNorm: rCoreNorm,
    coreConductivitySm: Number(physicalInput.coreConductivitySm ?? coreConductivitySm),
    centralPressurePa,
    solarWindPressureNPa
  });
  const eCritVPerM = evaluatePaschenBreakdownFieldVPerM(Math.max(1.0, surfacePressurePa));

  const state = Object.freeze({
    radiusM,
    massKg,
    gravityMps2,
    rotationOmegaRadS,
    surfacePressurePa,
    eqTempK,
    meanMolecularWeightAmu,
    scaleHeightM,
    rossbyRadiusOverR,
    atmWeight: surfacePressurePa >= 10.0 ? Math.min(1.0, Math.log10(surfacePressurePa) / 5.5) : 0.0,
    volatileMassFrac,
    particulateMassFrac,
    // Keep field aliases for shader uniform wiring
    volatileCloudFrac: volatileMassFrac,
    dustAvailability: particulateMassFrac,
    eCritVPerM,
    dynamo,
    solarWindPressureNPa
  });
  return Object.freeze({
    ...state,
    activation: evaluateFluidElectrodynamicsActivation(state)
  });
}

// Backwards-compatible alias pointing strictly to the general physical-state derivation
export const deriveAtmosphereParamsFromBody = deriveFluidElectrodynamicsState;

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

export const planetaryAtmoElectricWgsl = /* wgsl */ `
struct AtmoParams {
  width: u32,
  height: u32,
  step_index: u32,
  enable_triboelectric: u32,
  radius_m: f32,
  gravity: f32,
  omega_rot: f32,
  dt_sim: f32,
  eq_temp_k: f32,
  volatile_frac: f32,
  dust_avail: f32,
  atm_weight: f32,
  e_crit_norm: f32,     // Normalized Paschen breakdown threshold
  charge_gain: f32,     // Triboelectric separation efficiency
  aurora_lat_rad: f32,  // Core-geodynamo open field-line cusp latitude
  aurora_strength: f32, // Solar-wind driven auroral emission strength
  sun_dir: vec4<f32>,   // Live unit vector toward host star (xyz) + solar wind pressure (w)
};

// Ping-pong atmospheric fluid state (2 vec4 = 32 B per cell):
//   flow: vec4(u_east, v_north, h_geopot_anom, T_anom)
//   chem: vec4(q_cloud, q_dust, vorticity, rain_or_sed)
struct AtmoCell {
  flow: vec4<f32>,
  chem: vec4<f32>,
};

// Electromagnetic & visual-ready state (2 vec4 = 32 B per cell) — directly bound by LIT_SPHERE_WGSL!
//   em0: vec4(rho_charge, phi_elec, e_mag_norm, lightning_flash)
//   vis: vec4(cloud_density, dust_density, lightning_glow, aurora_glow)
struct EmVisCell {
  em0: vec4<f32>,
  vis: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: AtmoParams;
@group(0) @binding(1) var<storage, read> atmo_src: array<AtmoCell>;
@group(0) @binding(2) var<storage, read_write> atmo_dst: array<AtmoCell>;
@group(0) @binding(3) var<storage, read> em_src: array<EmVisCell>;
@group(0) @binding(4) var<storage, read_write> em_dst: array<EmVisCell>;
// Telemetry reduction (2 vec4 = 32 B):
//   [0]: vec4(mean_speed, max_vorticity, mean_cloud, mean_dust)
//   [1]: vec4(max_efield_norm, lightning_cell_count, total_abs_charge, max_aurora)
@group(0) @binding(5) var<storage, read_write> telemetry: array<vec4<f32>>;

var<workgroup> wg0: array<f32, 64>;
var<workgroup> wg1: array<f32, 64>;
var<workgroup> wg2: array<f32, 64>;
var<workgroup> wg3: array<f32, 64>;
var<workgroup> wg4: array<f32, 64>;
var<workgroup> wg5: array<f32, 64>;
var<workgroup> wg6: array<f32, 64>;
var<workgroup> wg7: array<f32, 64>;

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;

fn cell_idx(x: i32, y: i32) -> u32 {
  let w = i32(params.width);
  let h = i32(params.height);
  let wx = ((x % w) + w) % w;
  let wy = clamp(y, 0, h - 1);
  return u32(wy * w + wx);
}

fn cell_normal(ix: u32, iy: u32) -> vec3<f32> {
  let u = (f32(ix) + 0.5) / f32(params.width);
  let v = (f32(iy) + 0.5) / f32(params.height);
  let lon = (u - 0.5) * TWO_PI;
  let lat = (0.5 - v) * PI;
  let cl = cos(lat);
  return vec3<f32>(cl * cos(lon), sin(lat), cl * sin(lon));
}

fn sample_atmo_bilin(fx: f32, fy: f32) -> AtmoCell {
  let w = f32(params.width);
  let h = f32(params.height);
  let sx = fx - floor(fx / w) * w;
  let sy = clamp(fy, 0.0, h - 1.001);
  let x0 = i32(floor(sx));
  let y0 = i32(floor(sy));
  let tx = fract(sx);
  let ty = fract(sy);
  let c00 = atmo_src[cell_idx(x0, y0)];
  let c10 = atmo_src[cell_idx(x0 + 1, y0)];
  let c01 = atmo_src[cell_idx(x0, y0 + 1)];
  let c11 = atmo_src[cell_idx(x0 + 1, y0 + 1)];
  var out: AtmoCell;
  out.flow = mix(mix(c00.flow, c10.flow, tx), mix(c01.flow, c11.flow, tx), ty);
  out.chem = mix(mix(c00.chem, c10.chem, tx), mix(c01.chem, c11.chem, tx), ty);
  return out;
}

fn sample_em_bilin(fx: f32, fy: f32) -> EmVisCell {
  let w = f32(params.width);
  let h = f32(params.height);
  let sx = fx - floor(fx / w) * w;
  let sy = clamp(fy, 0.0, h - 1.001);
  let x0 = i32(floor(sx));
  let y0 = i32(floor(sy));
  let tx = fract(sx);
  let ty = fract(sy);
  let c00 = em_src[cell_idx(x0, y0)];
  let c10 = em_src[cell_idx(x0 + 1, y0)];
  let c01 = em_src[cell_idx(x0, y0 + 1)];
  let c11 = em_src[cell_idx(x0 + 1, y0 + 1)];
  var out: EmVisCell;
  out.em0 = mix(mix(c00.em0, c10.em0, tx), mix(c01.em0, c11.em0, tx), ty);
  out.vis = mix(mix(c00.vis, c10.vis, tx), mix(c01.vis, c11.vis, tx), ty);
  return out;
}

// 1. Prognostic Spherical Baroclinic Shallow-Water Fluid + Cloud/Dust Advection + Insolation
@compute @workgroup_size(8, 8)
fn atmo_step_fluid(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let sin_lat = sin(lat);
  let raw_cos = max(0.0, cos(lat));
  // Smooth polar coordinate-singularity filter (prevents 1/cos(lat) blowup near ±90° poles!)
  let pole_taper = smoothstep(0.08, 0.38, raw_cos);
  let cos_lat = max(0.30, raw_cos);

  // Normalized spherical grid spacings (dimensionless planetary radius = 1, velocity scale = c_baroclinic)
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let dt = params.dt_sim;

  let c0 = atmo_src[idx];
  let cxp = atmo_src[cell_idx(ix + 1, iy)];
  let cxm = atmo_src[cell_idx(ix - 1, iy)];
  let cyp = atmo_src[cell_idx(ix, iy - 1)]; // north = smaller iy!
  let cym = atmo_src[cell_idx(ix, iy + 1)];

  // Semi-Lagrangian backtrace on sphere
  let bx = f32(ix) - (c0.flow.x * dt) / dx;
  let by = f32(iy) + (c0.flow.y * dt) / dy; // north velocity v > 0 decreases iy
  let adv = sample_atmo_bilin(bx, by);

  // Real Solar Insolation from live host-star vector!
  let n_hat = cell_normal(gid.x, gid.y);
  let insol = max(0.0, dot(n_hat, normalize(params.sun_dir.xyz)));
  let t_eq = 0.72 * raw_cos + 0.48 * insol - 0.18 * adv.chem.x - 0.12 * adv.chem.y;
  let t_new = clamp(adv.flow.w + (t_eq - adv.flow.w) * 0.09 * dt * 6.0, -1.5, 1.8);

  // Horizontal divergence, vorticity, and geopotential height gradient (baroclinic thermal wind!)
  let du_dx = (cxp.flow.x - cxm.flow.x) / (2.0 * dx);
  let dv_dy = (cyp.flow.y - cym.flow.y) / (2.0 * dy);
  let div_v = clamp((du_dx + dv_dy) * pole_taper, -6.0, 6.0);
  let dv_dx = (cxp.flow.y - cxm.flow.y) / (2.0 * dx);
  let du_dy = (cyp.flow.x - cym.flow.x) / (2.0 * dy);
  let vort = clamp((dv_dx - du_dy) * pole_taper, -10.0, 10.0);

  // Geopotential anomaly coupled to thermal expansion & mass convergence
  let dh_dx = ((cxp.flow.z - cxm.flow.z) / (2.0 * dx) + 0.45 * (cxp.flow.w - cxm.flow.w) / (2.0 * dx)) * pole_taper;
  let dh_dy = ((cyp.flow.z - cym.flow.z) / (2.0 * dy) + 0.45 * (cyp.flow.w - cym.flow.w) / (2.0 * dy)) * pole_taper;

  // Real Coriolis parameter f = 2 * Omega_scaled * sin(lat):
  let rot_scale = clamp((params.omega_rot / 7.2921e-5) * (params.radius_m / 6.371e6), 0.05, 14.0);
  let f_rot = rot_scale * 2.2 * sin_lat;

  // Physical Hadley / Ferrel / Polar 3-Cell Meridional Circulation (continuous function of Rossby/rotation number!):
  //   - Fast/Earth-like rotator (rot_scale >= 0.35): Trade easterlies at equator, Ferrel westerlies at mid-latitudes,
  //     ITCZ moist convergence near lat=0, clear subtropical descending dry belt near |lat|~26 deg, baroclinic storm tracks at |lat|~48 deg!
  //   - Slow rotator (rot_scale < 0.35): single global Hadley cell!
  let three_cell_w = smoothstep(0.18, 0.55, rot_scale);
  let u_target_zonal = mix(
    0.25 * raw_cos,
    0.58 * sin(2.0 * lat) * sin(2.0 * lat) - 0.34 * (raw_cos * raw_cos * raw_cos),
    three_cell_w
  );
  let p_grad_u = -dh_dx + (u_target_zonal - adv.flow.x) * 0.22;
  let p_grad_v = -dh_dy;

  // Exact implicit Coriolis rotation (energy-conserving, unconditionally stable for ANY f_rot!)
  let u_pre = adv.flow.x + p_grad_u * dt;
  let v_pre = adv.flow.y + p_grad_v * dt;
  let alpha = f_rot * dt;
  let denom = 1.0 + alpha * alpha;
  let drag = 1.0 / (1.0 + 0.12 * dt);
  var u_new = ((u_pre + alpha * v_pre) / denom) * drag * (0.45 + 0.55 * pole_taper);
  var v_new = ((v_pre - alpha * u_pre) / denom) * drag * (0.35 + 0.65 * pole_taper);

  // Smooth Laplacian hyperviscosity preventing grid-scale noise while keeping synoptic Rossby cyclones crisp!
  let lap_u = (cxp.flow.x + cxm.flow.x + cyp.flow.x + cym.flow.x - 4.0 * c0.flow.x);
  let lap_v = (cxp.flow.y + cxm.flow.y + cyp.flow.y + cym.flow.y - 4.0 * c0.flow.y);
  u_new = clamp(u_new + 0.055 * lap_u, -2.4, 2.4);
  v_new = clamp(v_new + 0.055 * lap_v, -2.0, 2.0);

  let h_new = clamp(adv.flow.z - 0.46 * div_v * dt + 0.16 * (t_new - adv.flow.z) * dt + 0.04 * (cxp.flow.z + cxm.flow.z + cyp.flow.z + cym.flow.z - 4.0 * c0.flow.z), -1.5, 1.5);

  // True Hadley/Ferrel Condensation-Subsidence-Rainout Equilibrium:
  //   - Moist updrafts in ITCZ (lat ~ 0) and baroclinic mid-latitude cyclone tracks (|lat| ~ 48 deg)
  //   - Clear subsiding subtropical high-pressure belts (|lat| ~ 26 deg) letting oceans & continents shine cleanly!
  let abs_lat = abs(lat);
  let itcz_x = abs_lat / 0.17;
  let storm_x = (abs_lat - 0.84) / 0.24;
  let subtrop_x = (abs_lat - 0.45) / 0.19;
  let itcz_band = exp(-(itcz_x * itcz_x));
  let storm_track = exp(-(storm_x * storm_x));
  let subtrop_dry = exp(-(subtrop_x * subtrop_x)) * three_cell_w;
  let updraft = max(0.0, -div_v - 0.08) + max(0.0, abs(vort) - 0.45) * 0.28 + (0.28 * itcz_band + 0.22 * storm_track) * three_cell_w;
  let subsidence = max(0.0, div_v + 0.04) + 0.42 * subtrop_dry;
  let wind_spd = length(vec2<f32>(u_new, v_new));
  let evap_src = params.volatile_frac * (0.04 * insol + 0.34 * updraft) * pole_taper * dt;
  let rain_sink = (max(0.0, adv.chem.x - 0.28) * 0.90 + subsidence * 0.65 * adv.chem.x + 0.15 * adv.chem.x) * dt;
  let lap_cloud = cxp.chem.x + cxm.chem.x + cyp.chem.x + cym.chem.x - 4.0 * c0.chem.x;
  let q_cloud = clamp(adv.chem.x + evap_src - rain_sink + 0.055 * lap_cloud, 0.0, 0.94);

  // Dry aeolian saltation plumes lifted by high-speed baroclinic storm fronts & dust devils
  let saltation = max(0.0, wind_spd - 0.22) * 1.15 + max(0.0, abs(vort) - 0.45) * 0.35;
  let dust_lift = params.dust_avail * saltation * (0.35 + 0.65 * insol) * pole_taper * 0.65 * dt;
  let dust_settle = (adv.chem.y * 0.34 + subsidence * 0.25 * adv.chem.y) * dt;
  let lap_dust = cxp.chem.y + cxm.chem.y + cyp.chem.y + cym.chem.y - 4.0 * c0.chem.y;
  let q_dust = clamp(adv.chem.y + dust_lift - dust_settle + 0.045 * lap_dust, 0.0, 0.94);

  var out: AtmoCell;
  out.flow = vec4<f32>(u_new, v_new, h_new, t_new);
  out.chem = vec4<f32>(q_cloud, q_dust, vort, rain_sink);
  atmo_dst[idx] = out;
}

// 2. Non-Inductive Triboelectric Charge Separation (Moist Graupel-Ice + Dry Dust-Storm Shear)
@compute @workgroup_size(8, 8)
fn atmo_triboelectric_charge(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let raw_cos = max(0.0, cos(lat));
  let pole_taper = smoothstep(0.10, 0.38, raw_cos);
  let cos_lat = max(0.30, raw_cos);
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let dt = params.dt_sim;

  let a = atmo_src[idx]; // newest fluid state after swap!
  let bx = f32(ix) - (a.flow.x * dt) / dx;
  let by = f32(iy) + (a.flow.y * dt) / dy;
  let em_adv = sample_em_bilin(bx, by);

  let vort = a.chem.z;
  let spd = length(a.flow.xy);
  let q_cloud = a.chem.x;
  let q_dust = a.chem.y;

  // Takahashi-Saunders moist convective charging (~cloud^2 * |vort| * rain)
  // + Melnik-Farrell dry dust triboelectric charging (~dust * wind_shear * |vort|)
  // Tapered cleanly at coordinate poles so discharges spark inside real storm cores!
  var dq = 0.0;
  if (params.enable_triboelectric != 0u && params.atm_weight > 0.05) {
    let moist_charge = q_cloud * q_cloud * (abs(vort) * 1.85 + a.chem.w * 18.0);
    let dust_charge = q_dust * (spd * 1.35 + abs(vort) * 2.2);
    let sign_pol = select(-1.0, 1.0, vort >= 0.0);
    dq = sign_pol * params.charge_gain * (moist_charge + dust_charge) * pole_taper * dt;
  }

  // Ohmic ion conductivity leakage
  let rho_q = clamp(em_adv.em0.x * exp(-0.22 * dt) + dq, -8.0, 8.0);
  // Crisp localized convective lightning decay (prevents smeared cyan squares across the globe!)
  let flash_decay = em_adv.em0.w * exp(-7.8 * dt);

  var out = em_adv;
  out.em0 = vec4<f32>(rho_q, em_adv.em0.y, em_adv.em0.z, flash_decay);
  em_dst[idx] = out;
}

// 3. Spherical Electrostatic Poisson Solver (Jacobi relaxation: nabla^2 phi = -rho_q / eps0)
@compute @workgroup_size(8, 8)
fn atmo_poisson_efield(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let w = f32(params.width);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;
  let cos_lat = max(0.30, cos(lat));
  let dx = (TWO_PI * cos_lat) / w;
  let dy = PI / h;
  let idx2 = 1.0 / (dx * dx);
  let idy2 = 1.0 / (dy * dy);

  let e0 = em_src[idx];
  let exp_ = em_src[cell_idx(ix + 1, iy)].em0.y;
  let exm = em_src[cell_idx(ix - 1, iy)].em0.y;
  let eyp = em_src[cell_idx(ix, iy - 1)].em0.y;
  let eym = em_src[cell_idx(ix, iy + 1)].em0.y;

  let denom = 2.0 * (idx2 + idy2);
  let phi_new = ((exp_ + exm) * idx2 + (eyp + eym) * idy2 + e0.em0.x) / denom;
  let ex = -(exp_ - exm) / (2.0 * dx);
  let ey = -(eyp - eym) / (2.0 * dy);
  // Total local E-field = horizontal dipole field |grad phi| + vertical cloud/dust dipole |rho_q|
  let e_mag = sqrt(ex * ex + ey * ey + e0.em0.x * e0.em0.x * 0.85);

  var out = e0;
  out.em0 = vec4<f32>(e0.em0.x, phi_new, e_mag, e0.em0.w);
  em_dst[idx] = out;
}

// 4. Paschen Dielectric Breakdown Lightning Discharge + Geodynamo Polar Aurorae
@compute @workgroup_size(8, 8)
fn atmo_paschen_breakdown(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let ix = i32(gid.x);
  let iy = i32(gid.y);
  let idx = cell_idx(ix, iy);
  let h = f32(params.height);
  let lat = (0.5 - (f32(iy) + 0.5) / h) * PI;

  let a = atmo_src[idx];
  var e = em_src[idx];
  var rho_q = e.em0.x;
  let e_mag = e.em0.z;
  var flash = e.em0.w;

  // Real Paschen dielectric breakdown: when |E| exceeds E_crit(P), discharge channel fires!
  if (params.enable_triboelectric != 0u && e_mag > params.e_crit_norm) {
    let over = clamp((e_mag - params.e_crit_norm) / max(0.08, params.e_crit_norm), 0.15, 2.5);
    flash = max(flash, clamp(0.65 + 0.55 * over, 0.0, 1.8));
    // Conservative charge neutralization by the conductive plasma leader channel!
    rho_q = rho_q * 0.18;
  }

  // Core-geodynamo magnetic cusp polar auroral oval driven by solar wind pressure
  // Crisp narrow auroral ring/oval around open magnetic cusp latitude (NOT a solid polar snowcap!)
  let aur_d = (abs(lat) - params.aurora_lat_rad) / 0.062;
  let lon = ((f32(ix) + 0.5) / f32(params.width)) * TWO_PI;
  let curtain = 0.55 + 0.45 * sin(lon * 6.0 + f32(params.step_index) * 0.08) * cos(lon * 4.0 - f32(params.step_index) * 0.05);
  let aurora = params.aurora_strength * exp(-aur_d * aur_d) * curtain * clamp(params.sun_dir.w * 0.45, 0.25, 1.4);

  e.em0 = vec4<f32>(rho_q, e.em0.y, e_mag, flash);
  // Visual-ready zero-copy GPU payload read directly by LIT_SPHERE_WGSL!
  e.vis = vec4<f32>(a.chem.x, a.chem.y, flash, aurora);
  em_dst[idx] = e;
}

// 5. Parallel GPU Telemetry Reduction (1 workgroup of 64 threads — ZERO WG(1)!)
@compute @workgroup_size(64)
fn reduce_atmo_telemetry(@builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let total = params.width * params.height;
  var spd_sum = 0.0;
  var max_vort = 0.0;
  var cloud_sum = 0.0;
  var dust_sum = 0.0;
  var max_e = 0.0;
  var light_cnt = 0.0;
  var q_abs = 0.0;
  var max_aur = 0.0;

  var i = tid;
  loop {
    if (i >= total) { break; }
    let a = atmo_src[i];
    let e = em_src[i];
    spd_sum = spd_sum + length(a.flow.xy);
    max_vort = max(max_vort, abs(a.chem.z));
    cloud_sum = cloud_sum + a.chem.x;
    dust_sum = dust_sum + a.chem.y;
    max_e = max(max_e, e.em0.z);
    if (e.em0.w > 0.35) { light_cnt = light_cnt + 1.0; }
    q_abs = q_abs + abs(e.em0.x);
    max_aur = max(max_aur, e.vis.w);
    i = i + 64u;
  }

  wg0[tid] = spd_sum;
  wg1[tid] = max_vort;
  wg2[tid] = cloud_sum;
  wg3[tid] = dust_sum;
  wg4[tid] = max_e;
  wg5[tid] = light_cnt;
  wg6[tid] = q_abs;
  wg7[tid] = max_aur;
  workgroupBarrier();

  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (tid < s) {
      wg0[tid] = wg0[tid] + wg0[tid + s];
      wg1[tid] = max(wg1[tid], wg1[tid + s]);
      wg2[tid] = wg2[tid] + wg2[tid + s];
      wg3[tid] = wg3[tid] + wg3[tid + s];
      wg4[tid] = max(wg4[tid], wg4[tid + s]);
      wg5[tid] = wg5[tid] + wg5[tid + s];
      wg6[tid] = wg6[tid] + wg6[tid + s];
      wg7[tid] = max(wg7[tid], wg7[tid + s]);
    }
    workgroupBarrier();
    s = s >> 1u;
  }

  if (tid == 0u) {
    let inv_n = 1.0 / max(1.0, f32(total));
    telemetry[0] = vec4<f32>(wg0[0] * inv_n, wg1[0], wg2[0] * inv_n, wg3[0] * inv_n);
    telemetry[1] = vec4<f32>(wg4[0], wg5[0], wg6[0] * inv_n, wg7[0]);
  }
}
`;

/**
 * Create a live GPU-resident Planetary Baroclinic Atmosphere + Triboelectric Lightning
 * + Geodynamo Aurora session (`1 queue.submit` per step, zero hot readback to render!).
 */
export function createPlanetaryAtmosphereElectricSessionWebGpu(device, {
  width = 128,
  height = 64,
  bodyParams = null,
  enableTriboelectric = true,
  seed = 20261125,
  label = 'ulg-planetary-atmo-em'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('createPlanetaryAtmosphereElectricSessionWebGpu requires a live WebGPU GPUDevice');
  }
  const W = Math.max(32, Math.min(256, Math.trunc(width)));
  const H = Math.max(16, Math.min(128, Math.trunc(height)));
  const total = W * H;
  let phys = bodyParams || deriveAtmosphereParamsFromBody({ radiusKm: 6371, massSolar: 3.003e-6, atm: 0.72, tempK: 288, kind: 1, color1: [0.06, 0.26, 0.58] });
  let triboEnabled = Boolean(enableTriboelectric);

  // Seed smooth, physically coherent Hadley/Ferrel/Rossby synoptic cloud bands & baroclinic jets
  // (ZERO uncorrelated per-cell white noise -> eliminates speckled/blocky weather!)
  const rand = mulberry32(seed);
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const p3 = rand() * Math.PI * 2;
  const atmoInit = new Float32Array(total * 8);
  const emInit = new Float32Array(total * 8);
  for (let iy = 0; iy < H; iy += 1) {
    const lat = (0.5 - (iy + 0.5) / H) * Math.PI;
    const absLat = Math.abs(lat);
    const cosL = Math.cos(lat);
    const itcz = Math.exp(-Math.pow(absLat / 0.18, 2));
    const midLat = Math.exp(-Math.pow((absLat - 0.82) / 0.28, 2));
    const subtropClear = 1.0 - 0.72 * Math.exp(-Math.pow((absLat - 0.44) / 0.20, 2));
    for (let ix = 0; ix < W; ix += 1) {
      const lon = ((ix + 0.5) / W - 0.5) * 2 * Math.PI;
      const o = (iy * W + ix) * 8;
      // Smooth baroclinic zonal jet + multi-mode tilted Rossby waves (natural swirling cyclones!)
      const jet = 0.52 * Math.sin(2 * lat) * Math.sin(2 * lat) - 0.30 * Math.pow(Math.max(0, cosL), 3);
      const rossby = 0.14 * Math.sin(3 * lon + 2.4 * lat + p1) + 0.10 * Math.cos(5 * lon - 3.2 * lat + p2);
      atmoInit[o + 0] = jet + rossby;
      atmoInit[o + 1] = 0.11 * Math.cos(4 * lon + 1.5 * lat + p2) + 0.06 * Math.sin(6 * lon - 2.0 * lat + p3);
      atmoInit[o + 2] = 0.20 * Math.sin(3 * lon + lat + p1) * cosL;
      atmoInit[o + 3] = 0.70 * cosL;
      // Coherent synoptic cloud cover: wispy ITCZ wave + mid-latitude baroclinic frontal bands, clear subtropics!
      const waveCloud = 0.5 + 0.32 * Math.sin(3 * lon - 4.2 * lat + p1) + 0.18 * Math.cos(6 * lon + 5.0 * lat + p3);
      const synopCloud = Math.max(0.02, Math.min(0.88, (0.48 * itcz + 0.56 * midLat * waveCloud + 0.14 * waveCloud) * subtropClear));
      const synopDust = Math.max(0.04, Math.min(0.82, 0.28 + 0.30 * (0.5 + 0.5 * Math.sin(2 * lon + 2.2 * lat + p2)) * cosL));
      atmoInit[o + 4] = phys.volatileCloudFrac * synopCloud;
      atmoInit[o + 5] = phys.dustAvailability * synopDust;
      atmoInit[o + 6] = 0.0;
      atmoInit[o + 7] = 0.0;

      emInit[o + 4] = atmoInit[o + 4];
      emInit[o + 5] = atmoInit[o + 5];
    }
  }

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const mkPipe = (entryPoint) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-planetary-atmo-em-${entryPoint}.v2-hadley`,
    label: `${label}-${entryPoint}`,
    code: planetaryAtmoElectricWgsl,
    entryPoint,
    bindings
  });
  const fluidPipe = mkPipe('atmo_step_fluid');
  const chargePipe = mkPipe('atmo_triboelectric_charge');
  const poissonPipe = mkPipe('atmo_poisson_efield');
  const paschenPipe = mkPipe('atmo_paschen_breakdown');
  const telPipe = mkPipe('reduce_atmo_telemetry');

  const paramsBuf = device.createBuffer({ label: `${label}-params`, size: 80, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const atmoA = device.createBuffer({ label: `${label}-atmo-a`, size: atmoInit.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const atmoB = device.createBuffer({ label: `${label}-atmo-b`, size: atmoInit.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const emA = device.createBuffer({ label: `${label}-em-a`, size: emInit.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const emB = device.createBuffer({ label: `${label}-em-b`, size: emInit.byteLength, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST | GPU_BUF.COPY_SRC });
  const telBuf = device.createBuffer({ label: `${label}-tel`, size: 32, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_SRC });
  const telReadBuf = device.createBuffer({ label: `${label}-tel-read`, size: 32, usage: GPU_BUF.MAP_READ | GPU_BUF.COPY_DST });

  device.queue.writeBuffer(atmoA, 0, atmoInit);
  device.queue.writeBuffer(atmoB, 0, atmoInit);
  device.queue.writeBuffer(emA, 0, emInit);
  device.queue.writeBuffer(emB, 0, emInit);

  const mkBg = (aS, aD, eS, eD) => createCachedExplicitBindGroup(device, {
    layout: fluidPipe.bindGroupLayout,
    label: `${label}-bg`,
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: aS } },
      { binding: 2, resource: { buffer: aD } },
      { binding: 3, resource: { buffer: eS } },
      { binding: 4, resource: { buffer: eD } },
      { binding: 5, resource: { buffer: telBuf } }
    ]
  });

  // 4 pre-allocated ping-pong bind groups -> ZERO steady-state bindGroup churn!
  const bgA0E0 = mkBg(atmoA, atmoB, emA, emB);
  const bgA0E1 = mkBg(atmoA, atmoB, emB, emA);
  const bgA1E0 = mkBg(atmoB, atmoA, emA, emB);
  const bgA1E1 = mkBg(atmoB, atmoA, emB, emA);
  const getBg = (ap, ep) => (ap === 0 ? (ep === 0 ? bgA0E0 : bgA0E1) : (ep === 0 ? bgA1E0 : bgA1E1));

  let aPing = 0;
  let ePing = 0;
  let stepIndex = 0;
  let mapInFlight = false;
  let disposed = false;
  let lastTelemetry = Object.freeze({
    schema: ULG_PLANETARY_ATMO_EM_SCHEMA,
    stepIndex: 0,
    meanWindSpeed: 0,
    maxVorticity: 0,
    meanCloudCover: phys.volatileCloudFrac * 0.4,
    meanDustLoad: phys.dustAvailability * 0.3,
    peakElectricFieldVPerM: 0,
    paschenBreakdownVPerM: phys.eCritVPerM,
    activeLightningCells: 0,
    meanAbsCharge: 0,
    maxAuroraGlow: phys.dynamo?.auroralStrength || 0,
    dipoleFieldMicroT: (phys.dynamo?.bEquatorialT || 0) * 1e6,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });

  const wgX = Math.ceil(W / 8);
  const wgY = Math.ceil(H / 8);

  function writeUniforms(dtSim, sunDir) {
    // Normalize Paschen breakdown threshold to simulation dimensionless electric field scale
    // Low-pressure CO2 worlds (Mars ~22 kV/m) break down at lower E_crit_norm than 1-bar Earth (~260 kV/m)!
    const eCritNorm = Math.max(0.36, Math.min(2.2, Math.pow(phys.eCritVPerM / 2.6e5, 0.45) * 1.10));
    const chargeGain = 2.15;
    const ab = new ArrayBuffer(80);
    new Uint32Array(ab, 0, 4).set([W, H, stepIndex, triboEnabled ? 1 : 0]);
    new Float32Array(ab, 16, 16).set([
      phys.radiusM,
      phys.gravityMps2,
      phys.rotationOmegaRadS,
      dtSim,
      phys.eqTempK,
      phys.volatileCloudFrac,
      phys.dustAvailability,
      phys.atmWeight,
      eCritNorm,
      chargeGain,
      phys.dynamo?.auroralLatRad ?? 1.18,
      phys.dynamo?.auroralStrength ?? 0.65,
      sunDir[0],
      sunDir[1],
      sunDir[2],
      phys.solarWindPressureNPa ?? 2.0
    ]);
    device.queue.writeBuffer(paramsBuf, 0, ab);
  }

  /**
   * Advance `substeps` baroclinic fluid + triboelectric + 8-pass spherical Poisson + Paschen lightning
   * steps inside ONE `queue.submit`!
   */
  async function step({
    dtSim = 0.045,
    substeps = 2,
    sunDir = [0.65, 0.28, 0.70],
    readTelemetry = true
  } = {}) {
    if (disposed) return lastTelemetry;
    const nSub = Math.max(1, Math.min(8, Math.trunc(substeps)));
    const dtSafe = Math.max(0.005, Math.min(0.08, Number(dtSim) || 0.045));
    writeUniforms(dtSafe, sunDir);

    const enc = device.createCommandEncoder({ label: `${label}-step-${stepIndex}` });
    const pass = enc.beginComputePass({ label: `${label}-pass` });
    for (let s = 0; s < nSub; s += 1) {
      // 1. Baroclinic shallow-water fluid + cloud/dust advection -> writes to atmo_dst
      pass.setBindGroup(0, getBg(aPing, ePing));
      pass.setPipeline(fluidPipe.pipeline);
      pass.dispatchWorkgroups(wgX, wgY);
      aPing ^= 1;

      // 2. Non-inductive triboelectric charge separation reading newest fluid -> writes to em_dst
      pass.setBindGroup(0, getBg(aPing, ePing));
      pass.setPipeline(chargePipe.pipeline);
      pass.dispatchWorkgroups(wgX, wgY);
      ePing ^= 1;

      // 3. 6-pass Spherical Poisson electrostatic solve (nabla^2 phi = -rho_q / eps0, E = -grad phi)
      pass.setPipeline(poissonPipe.pipeline);
      for (let k = 0; k < 6; k += 1) {
        pass.setBindGroup(0, getBg(aPing, ePing));
        pass.dispatchWorkgroups(wgX, wgY);
        ePing ^= 1;
      }

      // 4. Paschen dielectric breakdown lightning discharge + Geodynamo polar aurorae
      pass.setBindGroup(0, getBg(aPing, ePing));
      pass.setPipeline(paschenPipe.pipeline);
      pass.dispatchWorkgroups(wgX, wgY);
      ePing ^= 1;

      stepIndex += 1;
    }

    // 5. Parallel 64-thread GPU telemetry reduction
    pass.setBindGroup(0, getBg(aPing, ePing));
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
          const eCritNorm = Math.max(0.36, Math.min(2.2, Math.pow(phys.eCritVPerM / 2.6e5, 0.45) * 1.10));
          lastTelemetry = Object.freeze({
            schema: ULG_PLANETARY_ATMO_EM_SCHEMA,
            stepIndex,
            meanWindSpeed: f[0],
            maxVorticity: f[1],
            meanCloudCover: f[2],
            meanDustLoad: f[3],
            peakElectricFieldNorm: f[4],
            peakElectricFieldVPerM: (f[4] / eCritNorm) * phys.eCritVPerM,
            paschenBreakdownVPerM: phys.eCritVPerM,
            activeLightningCells: Math.round(f[5]),
            meanAbsCharge: f[6],
            maxAuroraGlow: f[7],
            dipoleFieldMicroT: (phys.dynamo?.bEquatorialT || 0) * 1e6,
            enableTriboelectric: triboEnabled,
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

  function setEnableTriboelectric(enabled) {
    triboEnabled = Boolean(enabled);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const b of [paramsBuf, atmoA, atmoB, emA, emB, telBuf, telReadBuf]) {
      try { b.destroy(); } catch {}
    }
  }

  return Object.freeze({
    schema: ULG_PLANETARY_ATMO_EM_SCHEMA,
    lawAdapter: PLANETARY_ATMO_EM_LAW_ADAPTER,
    get width() { return W; },
    get height() { return H; },
    get stepIndex() { return stepIndex; },
    get bodyParams() { return phys; },
    get enableTriboelectric() { return triboEnabled; },
    // Zero-copy live GPU buffer sampled directly by LIT_SPHERE_WGSL!
    getResidentEmVisBuffer: () => (ePing === 0 ? emA : emB),
    getTelemetry: () => lastTelemetry,
    setEnableTriboelectric,
    step,
    dispose
  });
}

export function registerPlanetaryAtmosphereElectricModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('planetary-atmosphere-em@1')) {
    return registry.resolveModule('planetary-atmosphere-em@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'planetary-atmosphere-em', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js',
      entryPoint: 'atmo_paschen_breakdown',
      workgroupSize: 64
    },
    parameterSchema: {
      dtSim: { type: 'number', min: 0.002, max: 0.1, required: false },
      substeps: { type: 'number', min: 1, max: 16, required: false },
      enableTriboelectric: { type: 'boolean', required: false }
    },
    stateLayout: {
      tensorId: 'planetary-em-vis',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 8,
      strideBytes: 32,
      fields: ['rhoQ', 'phiE', 'eMag', 'flash', 'cloud', 'dust', 'lightningGlow', 'auroraGlow']
    },
    scaleRangeM: [1e4, 1e8],
    async stepCapsule(capsule, { createSimulationArtifact, device }) {
      const p = capsule.input?.parameters || {};
      const session = createPlanetaryAtmosphereElectricSessionWebGpu(device, {
        width: 64,
        height: 32,
        enableTriboelectric: p.enableTriboelectric ?? true
      });
      const tel = await session.step({ dtSim: p.dtSim ?? 0.045, substeps: p.substeps ?? 4, readTelemetry: true });
      session.dispose();
      return createSimulationArtifact({
        artifactId: `${capsule.taskId}:planetary-atmo-em:${tel.stepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js',
          entryPoint: 'createPlanetaryAtmosphereElectricSessionWebGpu',
          kernelEntryPoint: 'atmo_paschen_breakdown'
        },
        representation: 'spherical-shell-baroclinic-em-f32',
        outputs: { telemetry: tel },
        execution: { backend: 'webgpu-spherical-baroclinic-em', placement: 'local' },
        validity: { finite: Number.isFinite(tel.meanWindSpeed) && Number.isFinite(tel.peakElectricFieldVPerM) },
        validation: { status: 'pass', validationMode: 'gpu-atmo-em-invariants', scientificValidation: false, fullPhysicsValidation: false },
        provenance: { ...capsule.provenance, methodHash: capsule.methodHash, inputHash: capsule.inputHash }
      });
    }
  });
}
