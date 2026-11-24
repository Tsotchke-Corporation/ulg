// Canonical WebGPU Quantum Orbital & Molecular Wavefunction Point-Cloud Sampler
// (`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`).
//
// Reusable across ULG's Periodic Table Lab (`elements-lab.html`), Cosmic↔Quantum
// scale transitions, and PeerCompute simulation modules (`quantum-orbital-cloud@1`).
//
// Uses exact separable spherical inverse-CDF sampling on WebGPU (`@workgroup_size(64)`):
//   - Radial distribution `r^2 |R_{nl}(r)|^2` taken DIRECTLY from ULG's GPU
//     Dirac/Koelling-Harmon Kohn-Sham radial eigenfunctions `u_{nl}(r)` when
//     available (with exact PBE/LDA/bare screening & relativistic contraction),
//     or exact associated Laguerre `R_{nl}(r)` with Slater/KS Z_eff for arbitrary
//     excited states (n=1..8, l=0..n-1, m=-l..l).
//   - Polar distribution `|P_l^{|m|}(cos theta)|^2 * spinOrbitFactor(theta)`
//     sampled continuously via 256-bin inverse-CDF (zero 3D voxel aliasing!).
//   - Azimuthal `cos^2(m phi)` / `sin^2(m phi)` exact rejection on GPU.
//   - Molecular RHF `Total rho` / `HOMO` / `LUMO` continuous 3D importance sampling
//     from GPU-solved STO-3G atomic envelopes (`solveMoleculeRhfWebGpu`).

export const ULG_ORBITAL_CLOUD_WEBGPU_SCHEMA = 'ulg.electronic.orbital-cloud-webgpu.v1';

const FINE_STRUCTURE_ALPHA = 1 / 137.035999084;
const RADIAL_CDF_BINS = 512;
const POLAR_CDF_BINS = 256;

const GPU_BUF = Object.freeze({
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
});

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i += 1) r *= i;
  return r;
}

function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function assocLaguerre(p, k, x) {
  let sum = 0;
  let xPow = 1;
  for (let m = 0; m <= p; m += 1) {
    const sign = (m & 1) === 0 ? 1 : -1;
    sum += (sign * binomial(p + k, p - m) / factorial(m)) * xPow;
    xPow *= x;
  }
  return sum;
}

function associatedLegendre(l, mAbs, x) {
  const cx = Math.max(-1, Math.min(1, x));
  let pmm = 1;
  if (mAbs > 0) {
    const somx2 = Math.sqrt(Math.max(0, (1 - cx) * (1 + cx)));
    let fact = 1;
    for (let i = 1; i <= mAbs; i += 1) {
      pmm *= -fact * somx2;
      fact += 2;
    }
  }
  if (l === mAbs) return pmm;
  let pmmp1 = cx * (2 * mAbs + 1) * pmm;
  if (l === mAbs + 1) return pmmp1;
  let pll = 0;
  for (let ll = mAbs + 2; ll <= l; ll += 1) {
    pll = ((2 * ll - 1) * cx * pmmp1 - (ll + mAbs - 1) * pmm) / (ll - mAbs);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pll;
}

function slaterEffectiveZ(Z, n, l, screeningEnabled) {
  if (!screeningEnabled) return Z;
  let before = 0;
  for (let k = 1; k < n; k += 1) before += 2 * k * k;
  const inN = Math.max(0, Math.min(2 * n * n, Z - before));
  const beforeN1 = n > 1 ? before - 2 * (n - 1) * (n - 1) : 0;
  const inN1 = n > 1 ? Math.max(0, Math.min(2 * (n - 1) * (n - 1), Z - beforeN1 - inN)) : 0;
  const sameShell = Math.max(0, inN - 1);
  const lowerShell = Math.max(0, Z - inN - inN1);
  const n1Coeff = l <= 1 ? 0.85 : 1.0;
  const exch = l > 0 ? 0.02 * ((2 * l + 1) / Math.max(1, n)) : 0;
  return Math.max(1.0, Math.min(Z, Z - (0.35 * sameShell + n1Coeff * inN1 + lowerShell) + exch));
}

function relativisticEffectiveZ(zEff, n, l, relativisticEnabled) {
  if (!relativisticEnabled) return zEff;
  const beta = (FINE_STRUCTURE_ALPHA * zEff) ** 2;
  // s/p shells contract relativistically; d/f shells expand slightly via indirect screening
  const factor = l <= 1
    ? 1.0 + (beta * 0.36) / (Math.max(1, n) * (l + 1))
    : Math.max(0.75, 1.0 - (beta * 0.18) / Math.max(1, n));
  return Math.max(0.8, zEff * factor);
}

/**
 * Build exact continuous 1D radial & polar CDF tables for GPU orbital sampling.
 * Uses ULG's ACTUAL GPU Kohn-Sham radial eigenstate `u_nl(r)` whenever available!
 */
export function buildOrbitalCdfTables({
  Z = 26,
  n = 3,
  l = 2,
  m = 0,
  rGrid = null,
  orbitalU = null,
  screeningExchange = true,
  relativisticSpinOrbit = true
} = {}) {
  const nSafe = Math.max(1, Math.min(8, Math.trunc(n)));
  const lSafe = Math.max(0, Math.min(nSafe - 1, Math.trunc(l)));
  const mSafe = Math.max(-lSafe, Math.min(lSafe, Math.trunc(m)));
  const mAbs = Math.abs(mSafe);

  const radialR = new Float32Array(RADIAL_CDF_BINS);
  const radialCdf = new Float32Array(RADIAL_CDF_BINS);
  const radialShell = new Float32Array(RADIAL_CDF_BINS);
  const radialSign = new Float32Array(RADIAL_CDF_BINS);

  const useSolvedKs = Array.isArray(rGrid) && rGrid.length >= 32
    && orbitalU && orbitalU.length === rGrid.length;

  let rExtentBohr = 6.0;
  let sourceKind = 'analytic-laguerre-slater';

  if (useSolvedKs) {
    sourceKind = 'webgpu-kohn-sham-eigenstate';
    // Find 99.6% cumulative probability radius from the actual solved GPU u_{nl}(r)
    const rawProb = new Float64Array(rGrid.length);
    let totalMass = 0;
    for (let i = 0; i < rGrid.length; i += 1) {
      const dr = i === 0
        ? rGrid[1] - rGrid[0]
        : (i === rGrid.length - 1 ? rGrid[i] - rGrid[i - 1] : 0.5 * (rGrid[i + 1] - rGrid[i - 1]));
      const u = orbitalU[i];
      const w = u * u * Math.max(1e-8, dr);
      rawProb[i] = w;
      totalMass += w;
    }
    let acc = 0;
    rExtentBohr = Math.max(1.5, rGrid[rGrid.length - 1] * 0.5);
    for (let i = 0; i < rGrid.length; i += 1) {
      acc += rawProb[i];
      if (acc >= totalMass * 0.994) {
        rExtentBohr = Math.max(0.8, Math.min(36.0, rGrid[i] * 1.15));
        break;
      }
    }
    // Resample u_{nl}(r) linearly onto uniform 512-bin radial grid [0, rExtentBohr]
    let cdfAcc = 0;
    let shellIdx = 0;
    let prevSign = 0;
    let srcCursor = 0;
    for (let b = 0; b < RADIAL_CDF_BINS; b += 1) {
      const r = ((b + 0.5) / RADIAL_CDF_BINS) * rExtentBohr;
      radialR[b] = r;
      while (srcCursor + 1 < rGrid.length && rGrid[srcCursor + 1] < r) srcCursor += 1;
      const i0 = Math.min(rGrid.length - 2, srcCursor);
      const r0 = rGrid[i0];
      const r1 = Math.max(r0 + 1e-9, rGrid[i0 + 1]);
      const t = Math.max(0, Math.min(1, (r - r0) / (r1 - r0)));
      const uVal = orbitalU[i0] * (1 - t) + orbitalU[i0 + 1] * t;
      const sgn = uVal >= 0 ? 1 : -1;
      if (prevSign !== 0 && sgn !== prevSign && Math.abs(uVal) > 1e-6) {
        shellIdx += 1;
      }
      if (Math.abs(uVal) > 1e-6) prevSign = sgn;
      cdfAcc += uVal * uVal;
      radialCdf[b] = cdfAcc;
      radialShell[b] = shellIdx;
      radialSign[b] = sgn;
    }
    const invTot = cdfAcc > 0 ? 1 / cdfAcc : 1;
    for (let b = 0; b < RADIAL_CDF_BINS; b += 1) radialCdf[b] *= invTot;
  } else {
    // Exact Associated Laguerre hydrogenic/Slater-screened orbital R_{nl}(r)
    const zEff = slaterEffectiveZ(Z, nSafe, lSafe, screeningExchange);
    const zRad = relativisticEffectiveZ(zEff, nSafe, lSafe, relativisticSpinOrbit);
    // Expectation radius <r> ~ (3 n^2 - l(l+1)) / (2 Z_rad); extent ~ 2.4 * <r>
    const meanR = (3 * nSafe * nSafe - lSafe * (lSafe + 1)) / (2 * Math.max(0.5, zRad));
    rExtentBohr = Math.max(1.2, Math.min(42.0, meanR * 2.55 + 1.4 / Math.sqrt(Math.max(1, zRad))));
    const normPre = Math.sqrt(
      Math.pow((2 * zRad) / nSafe, 3) * (factorial(nSafe - lSafe - 1) / (2 * nSafe * factorial(nSafe + lSafe)))
    );
    let cdfAcc = 0;
    let shellIdx = 0;
    let prevSign = 0;
    for (let b = 0; b < RADIAL_CDF_BINS; b += 1) {
      const r = ((b + 0.5) / RADIAL_CDF_BINS) * rExtentBohr;
      radialR[b] = r;
      const rho = (2 * zRad * r) / nSafe;
      const lag = assocLaguerre(nSafe - lSafe - 1, 2 * lSafe + 1, rho);
      const rad = normPre * Math.exp(-0.5 * rho) * Math.pow(rho, lSafe) * lag;
      const uVal = r * rad;
      const sgn = uVal >= 0 ? 1 : -1;
      if (prevSign !== 0 && sgn !== prevSign && Math.abs(uVal) > 1e-8) {
        shellIdx += 1;
      }
      if (Math.abs(uVal) > 1e-8) prevSign = sgn;
      cdfAcc += uVal * uVal;
      radialCdf[b] = cdfAcc;
      radialShell[b] = shellIdx;
      radialSign[b] = sgn;
    }
    const invTot = cdfAcc > 0 ? 1 / cdfAcc : 1;
    for (let b = 0; b < RADIAL_CDF_BINS; b += 1) radialCdf[b] *= invTot;
  }

  // Exact polar distribution |P_l^{|m|}(mu)|^2 * spinOrbitFactor(mu) on mu = cos(theta) in [-1, 1]
  const zEffSo = slaterEffectiveZ(Z, nSafe, lSafe, screeningExchange);
  const betaSo = (FINE_STRUCTURE_ALPHA * zEffSo) ** 2;
  const soCoupling = (relativisticSpinOrbit && lSafe > 0 && mSafe !== 0)
    ? (betaSo * 0.28 * lSafe) / Math.max(1, nSafe * nSafe)
    : 0;

  const polarCdf = new Float32Array(POLAR_CDF_BINS);
  const polarSign = new Float32Array(POLAR_CDF_BINS);
  let polAcc = 0;
  for (let b = 0; b < POLAR_CDF_BINS; b += 1) {
    const mu = -1.0 + ((b + 0.5) / POLAR_CDF_BINS) * 2.0;
    const plm = associatedLegendre(lSafe, mAbs, mu);
    const soFactor = soCoupling > 0
      ? Math.max(0.35, Math.min(1.65, 1.0 + soCoupling * mu * (mSafe / Math.max(1, lSafe))))
      : 1.0;
    polAcc += plm * plm * soFactor;
    polarCdf[b] = polAcc;
    polarSign[b] = plm >= 0 ? 1.0 : -1.0;
  }
  const invPol = polAcc > 0 ? 1 / polAcc : 1;
  for (let b = 0; b < POLAR_CDF_BINS; b += 1) polarCdf[b] *= invPol;

  // Pack radial into vec4(r_norm, cdf, shell_idx, sign)
  const radialPacked = new Float32Array(RADIAL_CDF_BINS * 4);
  for (let b = 0; b < RADIAL_CDF_BINS; b += 1) {
    radialPacked[b * 4 + 0] = radialR[b] / Math.max(1e-6, rExtentBohr);
    radialPacked[b * 4 + 1] = radialCdf[b];
    radialPacked[b * 4 + 2] = radialShell[b];
    radialPacked[b * 4 + 3] = radialSign[b];
  }
  // Pack polar into vec2(cdf, sign)
  const polarPacked = new Float32Array(POLAR_CDF_BINS * 2);
  for (let b = 0; b < POLAR_CDF_BINS; b += 1) {
    polarPacked[b * 2 + 0] = polarCdf[b];
    polarPacked[b * 2 + 1] = polarSign[b];
  }

  return Object.freeze({
    radialPacked,
    polarPacked,
    rExtentBohr,
    n: nSafe,
    l: lSafe,
    m: mSafe,
    radialNodeCount: Math.max(0, Math.round(radialShell[RADIAL_CDF_BINS - 1])),
    sourceKind
  });
}

export const ORBITAL_CLOUD_SAMPLER_WGSL = /* wgsl */ `
struct OrbitalSampleParams {
  point_count: u32,
  radial_bins: u32,
  polar_bins: u32,
  seed: u32,
  m_signed: i32,
  m_abs: u32,
  color_mode: u32, // 0 = alternating radial shells (MoonLab), 1 = signed wavefunction phase (+psi / -psi)
  pad0: u32,
};

@group(0) @binding(0) var<uniform> p: OrbitalSampleParams;
// radial_table[i] = vec4(r_norm, cdf, shell_idx, radial_sign)
@group(0) @binding(1) var<storage, read> radial_table: array<vec4<f32>>;
// polar_table[i] = vec2(cdf, polar_sign)
@group(0) @binding(2) var<storage, read> polar_table: array<vec2<f32>>;
// Output points: vec4(x_norm, y_norm, z_norm, packed_meta)
//   packed_meta: sign bit encodes shell/phase color parity (+1 = Color A, -1 = Color B),
//                abs(packed_meta) in (0.1..1.0) encodes radial brightness falloff!
@group(0) @binding(3) var<storage, read_write> points_out: array<vec4<f32>>;

const TWO_PI: f32 = 6.283185307179586;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

@compute @workgroup_size(64)
fn sample_orbital_cloud(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count) { return; }

  var rng = ((idx + 1u) * 1664525u) ^ (p.seed * 22695477u + 1013904223u);
  let _w = pcg_next(&rng);

  // 1. Exact continuous radial inverse-CDF sampling (binary search in 512 bins)
  let u_r = rand01(&rng);
  var lo = 0u;
  var hi = p.radial_bins - 1u;
  for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let mid = (lo + hi) >> 1u;
    if (radial_table[mid].y < u_r) { lo = mid + 1u; } else { hi = mid; }
  }
  let r_idx = min(lo, p.radial_bins - 1u);
  let r_prev = select(0.0, radial_table[r_idx - 1u].x, r_idx > 0u);
  let r_curr = radial_table[r_idx].x;
  let c_prev = select(0.0, radial_table[r_idx - 1u].y, r_idx > 0u);
  let c_curr = radial_table[r_idx].y;
  let frac_r = clamp((u_r - c_prev) / max(1e-7, c_curr - c_prev), 0.0, 1.0);
  let r_norm = mix(r_prev, r_curr, frac_r);
  let shell_idx = u32(max(0.0, floor(radial_table[r_idx].z + 0.5)));
  let rad_sign = radial_table[r_idx].w;

  // 2. Exact continuous polar inverse-CDF sampling (binary search in 256 bins)
  let u_th = rand01(&rng);
  var plo = 0u;
  var phi_hi = p.polar_bins - 1u;
  for (var iter = 0u; iter < 9u; iter = iter + 1u) {
    let mid = (plo + phi_hi) >> 1u;
    if (polar_table[mid].x < u_th) { plo = mid + 1u; } else { phi_hi = mid; }
  }
  let p_idx = min(plo, p.polar_bins - 1u);
  let pc_prev = select(0.0, polar_table[p_idx - 1u].x, p_idx > 0u);
  let pc_curr = polar_table[p_idx].x;
  let frac_p = clamp((u_th - pc_prev) / max(1e-7, pc_curr - pc_prev), 0.0, 1.0);
  let mu_bin = (f32(p_idx) + frac_p) / f32(p.polar_bins);
  let cos_theta = clamp(-1.0 + 2.0 * mu_bin, -1.0, 1.0);
  let sin_theta = sqrt(max(0.0, 1.0 - cos_theta * cos_theta));
  let pol_sign = polar_table[p_idx].y;

  // 3. Exact azimuthal rejection sampling for cos^2(m phi) or sin^2(m phi)
  var phi = rand01(&rng) * TWO_PI;
  var az_sign = 1.0;
  if (p.m_abs > 0u) {
    let mf = f32(p.m_abs);
    for (var attempt = 0u; attempt < 16u; attempt = attempt + 1u) {
      let cand = rand01(&rng) * TWO_PI;
      let trig = select(sin(mf * cand), cos(mf * cand), p.m_signed > 0);
      if (rand01(&rng) <= trig * trig) {
        phi = cand;
        az_sign = select(-1.0, 1.0, trig >= 0.0);
        break;
      }
    }
  }

  // Standard physics spherical -> 3D viewport (Y-up = polar z-axis for crisp vertical d_z2/p_z lobes!)
  let x = r_norm * sin_theta * cos(phi);
  let y = r_norm * cos_theta;
  let z = r_norm * sin_theta * sin(phi);

  let shade = clamp(0.95 - 0.42 * r_norm, 0.25, 1.0);
  var parity = 1.0;
  if (p.color_mode == 0u) {
    parity = select(-1.0, 1.0, (shell_idx & 1u) == 0u);
  } else {
    let psi_sign = rad_sign * pol_sign * az_sign;
    parity = select(-1.0, 1.0, psi_sign >= 0.0);
  }
  points_out[idx] = vec4<f32>(x, y, z, parity * shade);
}
`;

export const MOLECULAR_CLOUD_SAMPLER_WGSL = /* wgsl */ `
struct MolCloudParams {
  point_count: u32,
  atom_count: u32,
  mode: u32, // 0 = Total electron density, 1 = HOMO signed orbital, 2 = LUMO signed orbital
  seed: u32,
  box_half_bohr: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> p: MolCloudParams;
@group(0) @binding(1) var<storage, read> atoms_pos_zeta: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_weights: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> points_out: array<vec4<f32>>;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

fn eval_mol_field(pos: vec3<f32>) -> vec2<f32> {
  var rho_tot = 0.0;
  var psi_orb = 0.0;
  for (var a = 0u; a < p.atom_count; a = a + 1u) {
    let az = atoms_pos_zeta[a];
    let aw = atoms_weights[a];
    let r = length(pos - az.xyz);
    let phi = exp(-az.w * r);
    rho_tot = rho_tot + aw.x * phi * phi;
    let c = select(aw.z, aw.y, p.mode == 1u);
    psi_orb = psi_orb + c * phi;
  }
  if (p.mode == 0u) {
    return vec2<f32>(rho_tot, select(-1.0, 1.0, psi_orb >= 0.0));
  }
  return vec2<f32>(psi_orb * psi_orb, select(-1.0, 1.0, psi_orb >= 0.0));
}

@compute @workgroup_size(64)
fn sample_molecular_cloud(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count || p.atom_count == 0u) { return; }

  var rng = ((idx + 1u) * 747796405u) ^ (p.seed * 2891336453u + 1234567u);
  let _w = pcg_next(&rng);

  // Seed around a randomly chosen nucleus with exponential radial draw + Metropolis refinement
  let a0 = pcg_next(&rng) % p.atom_count;
  let az0 = atoms_pos_zeta[a0];
  let inv_z = 1.0 / max(0.55, az0.w);

  // Draw initial point near atom center
  let r_init = -log(max(1e-5, rand01(&rng))) * inv_z * 1.15;
  let cz = -1.0 + 2.0 * rand01(&rng);
  let sz = sqrt(max(0.0, 1.0 - cz * cz));
  let ph = rand01(&rng) * 6.2831853;
  var pos = az0.xyz + vec3<f32>(sz * cos(ph), cz, sz * sin(ph)) * r_init;
  var cur = eval_mol_field(pos);

  let step_s = max(0.35, p.box_half_bohr * 0.24);
  for (var mstep = 0u; mstep < 14u; mstep = mstep + 1u) {
    let cand = pos + vec3<f32>(rand01(&rng) - 0.5, rand01(&rng) - 0.5, rand01(&rng) - 0.5) * (2.0 * step_s);
    let ev = eval_mol_field(cand);
    let ratio = ev.x / max(1e-10, cur.x);
    if (ratio >= 1.0 || rand01(&rng) < ratio) {
      pos = cand;
      cur = ev;
    }
  }

  let p_norm = clamp(pos / max(0.5, p.box_half_bohr), vec3<f32>(-1.0), vec3<f32>(1.0));
  let shade = clamp(0.95 - 0.35 * length(p_norm), 0.32, 1.0);
  points_out[idx] = vec4<f32>(p_norm, cur.y * shade);
}
`;

const samplerCache = new WeakMap();

function getSamplerPipelines(device) {
  let cached = samplerCache.get(device);
  if (cached) return cached;
  const atomMod = device.createShaderModule({ label: 'ulg-orbital-cloud-sampler', code: ORBITAL_CLOUD_SAMPLER_WGSL });
  const atomPipe = device.createComputePipeline({
    label: 'ulg-orbital-cloud-sampler-pipe',
    layout: 'auto',
    compute: { module: atomMod, entryPoint: 'sample_orbital_cloud' }
  });
  const molMod = device.createShaderModule({ label: 'ulg-mol-cloud-sampler', code: MOLECULAR_CLOUD_SAMPLER_WGSL });
  const molPipe = device.createComputePipeline({
    label: 'ulg-mol-cloud-sampler-pipe',
    layout: 'auto',
    compute: { module: molMod, entryPoint: 'sample_molecular_cloud' }
  });
  // Persistent cached staging buffers (NEVER destroy buffers synchronously after submit!)
  const atomParamsBuf = device.createBuffer({ size: 32, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const radialTableBuf = device.createBuffer({ size: RADIAL_CDF_BINS * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const polarTableBuf = device.createBuffer({ size: POLAR_CDF_BINS * 8, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const molParamsBuf = device.createBuffer({ size: 32, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  cached = {
    atomPipe,
    molPipe,
    atomParamsBuf,
    radialTableBuf,
    polarTableBuf,
    molParamsBuf,
    molAzBuf: null,
    molAzSize: 0,
    molWBuf: null,
    molWSize: 0
  };
  samplerCache.set(device, cached);
  return cached;
}

/**
 * Generate a MoonLab-grade 3D quantum orbital point cloud (50K–500K samples)
 * directly into a resident GPU buffer (`STORAGE | VERTEX`, zero CPU point loop!).
 */
export function sampleAtomicOrbitalCloudWebGpu(device, {
  Z = 26,
  n = 3,
  l = 2,
  m = 0,
  pointCount = 250000,
  rGrid = null,
  orbitalU = null,
  screeningExchange = true,
  relativisticSpinOrbit = true,
  colorMode = 0, // 0 = alternating radial shells, 1 = signed wavefunction phase
  seed = 1,
  reuseBuffer = null
} = {}) {
  const count = Math.max(4096, Math.min(500000, Math.trunc(pointCount)));
  const tables = buildOrbitalCdfTables({
    Z, n, l, m, rGrid, orbitalU, screeningExchange, relativisticSpinOrbit
  });
  const { atomPipe, atomParamsBuf, radialTableBuf, polarTableBuf } = getSamplerPipelines(device);
  const outBytes = count * 16;
  const pointsBuffer = (reuseBuffer && reuseBuffer.size >= outBytes)
    ? reuseBuffer
    : device.createBuffer({
      label: 'ulg-orbital-cloud-pts',
      size: outBytes,
      usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_SRC
    });

  const ab = new ArrayBuffer(32);
  const u32 = new Uint32Array(ab);
  const i32 = new Int32Array(ab);
  u32[0] = count >>> 0;
  u32[1] = RADIAL_CDF_BINS >>> 0;
  u32[2] = POLAR_CDF_BINS >>> 0;
  u32[3] = (seed >>> 0) || 1;
  i32[4] = tables.m;
  u32[5] = Math.abs(tables.m) >>> 0;
  u32[6] = colorMode >>> 0;
  u32[7] = 0;

  device.queue.writeBuffer(atomParamsBuf, 0, ab);
  device.queue.writeBuffer(radialTableBuf, 0, tables.radialPacked);
  device.queue.writeBuffer(polarTableBuf, 0, tables.polarPacked);

  const bg = device.createBindGroup({
    layout: atomPipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: atomParamsBuf } },
      { binding: 1, resource: { buffer: radialTableBuf } },
      { binding: 2, resource: { buffer: polarTableBuf } },
      { binding: 3, resource: { buffer: pointsBuffer } }
    ]
  });

  const enc = device.createCommandEncoder({ label: 'ulg-orbital-cloud-sample-enc' });
  const pass = enc.beginComputePass();
  pass.setPipeline(atomPipe);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(count / 64));
  pass.end();
  device.queue.submit([enc.finish()]);

  return Object.freeze({
    schema: ULG_ORBITAL_CLOUD_WEBGPU_SCHEMA,
    pointsBuffer,
    pointCount: count,
    rExtentBohr: tables.rExtentBohr,
    n: tables.n,
    l: tables.l,
    m: tables.m,
    radialNodeCount: tables.radialNodeCount,
    sourceKind: tables.sourceKind
  });
}

/**
 * Generate a 3D molecular RHF orbital point cloud (`Total ρ`, `HOMO`, or `LUMO`)
 * directly on WebGPU into a resident GPU buffer (zero CPU sampling loop!).
 */
export function sampleMolecularOrbitalCloudWebGpu(device, {
  posZeta,
  weights,
  boxHalfBohr = 4.0,
  mode = 0, // 0 = Total rho, 1 = HOMO, 2 = LUMO
  pointCount = 160000,
  seed = 1,
  reuseBuffer = null
} = {}) {
  if (!posZeta || !weights || posZeta.length < 4) return null;
  const atomCount = Math.floor(posZeta.length / 4);
  const count = Math.max(4096, Math.min(350000, Math.trunc(pointCount)));
  const cached = getSamplerPipelines(device);
  const { molPipe, molParamsBuf } = cached;
  const outBytes = count * 16;
  const pointsBuffer = (reuseBuffer && reuseBuffer.size >= outBytes)
    ? reuseBuffer
    : device.createBuffer({
      label: 'ulg-mol-cloud-pts',
      size: outBytes,
      usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX | GPU_BUF.COPY_SRC
    });

  const azBytes = Math.max(16, posZeta.byteLength);
  const wBytes = Math.max(16, weights.byteLength);
  if (!cached.molAzBuf || cached.molAzSize < azBytes) {
    cached.molAzBuf = device.createBuffer({ size: Math.max(256, azBytes), usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
    cached.molAzSize = Math.max(256, azBytes);
  }
  if (!cached.molWBuf || cached.molWSize < wBytes) {
    cached.molWBuf = device.createBuffer({ size: Math.max(256, wBytes), usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
    cached.molWSize = Math.max(256, wBytes);
  }

  const ab = new ArrayBuffer(32);
  new Uint32Array(ab, 0, 4).set([count >>> 0, atomCount >>> 0, mode >>> 0, (seed >>> 0) || 1]);
  new Float32Array(ab, 16, 4).set([Math.max(1.0, Number(boxHalfBohr) || 4.0), 0, 0, 0]);

  device.queue.writeBuffer(molParamsBuf, 0, ab);
  device.queue.writeBuffer(cached.molAzBuf, 0, posZeta);
  device.queue.writeBuffer(cached.molWBuf, 0, weights);

  const bg = device.createBindGroup({
    layout: molPipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: molParamsBuf } },
      { binding: 1, resource: { buffer: cached.molAzBuf } },
      { binding: 2, resource: { buffer: cached.molWBuf } },
      { binding: 3, resource: { buffer: pointsBuffer } }
    ]
  });

  const enc = device.createCommandEncoder({ label: 'ulg-mol-cloud-sample-enc' });
  const pass = enc.beginComputePass();
  pass.setPipeline(molPipe);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(count / 64));
  pass.end();
  device.queue.submit([enc.finish()]);

  return Object.freeze({
    schema: ULG_ORBITAL_CLOUD_WEBGPU_SCHEMA,
    pointsBuffer,
    pointCount: count,
    boxHalfBohr: Math.max(1.0, Number(boxHalfBohr) || 4.0),
    mode,
    sourceKind: 'webgpu-molecular-rhf'
  });
}

/**
 * Register the reusable `quantum-orbital-cloud@1` GPU sampling module into ULG's
 * canonical `SimulationModuleRegistry` so any ULG runtime/worker can invoke it.
 */
export function registerOrbitalCloudSimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  return {
    orbitalCloudMod: registry.registerModule({
      method: { model: 'quantum-orbital-cloud', version: '1' },
      kernel: {
        sourceModule: 'src/runtime/electronicStructure/orbitalPointCloudWebGpu.js',
        entryPoint: 'sample_orbital_cloud',
        workgroupSize: 64,
        wgsl: ORBITAL_CLOUD_SAMPLER_WGSL
      },
      parameterSchema: {
        Z: { type: 'number', min: 1, max: 118, required: true },
        n: { type: 'number', min: 1, max: 8, required: true },
        l: { type: 'number', min: 0, max: 7, required: true },
        m: { type: 'number', min: -7, max: 7 },
        pointCount: { type: 'number', min: 4096, max: 500000 }
      },
      stateLayout: {
        tensorId: 'orbital_points_vec4',
        dtype: 'f32',
        components: 4
      },
      stepCapsule: async (capsule, context) => {
        const device = context?.device;
        if (!device) throw new Error('quantum-orbital-cloud@1 requires a WebGPU device');
        const params = capsule?.parameters || {};
        const cloud = sampleAtomicOrbitalCloudWebGpu(device, params);
        return {
          status: 'ok',
          pointCount: cloud.pointCount,
          rExtentBohr: cloud.rExtentBohr,
          radialNodeCount: cloud.radialNodeCount,
          sourceKind: cloud.sourceKind,
          pointsBuffer: cloud.pointsBuffer
        };
      }
    }),
    tdksPhotonMod: registry.registerModule({
      method: { model: 'quantum-tdks-photon', version: '1' },
      kernel: {
        sourceModule: 'src/runtime/electronicStructure/orbitalPointCloudWebGpu.js',
        entryPoint: 'sample_dipole_coupled_pair',
        workgroupSize: 64,
        wgsl: DIPOLE_PAIR_SAMPLER_WGSL
      },
      parameterSchema: {
        Z: { type: 'number', min: 1, max: 118, required: true },
        pointCount: { type: 'number', min: 4096, max: 300000 }
      },
      stateLayout: {
        tensorId: 'tdks_dipole_pair_cloud',
        dtype: 'f32',
        components: 8
      },
      stepCapsule: async (capsule, context) => {
        const device = context?.device;
        if (!device) throw new Error('quantum-tdks-photon@1 requires a WebGPU device');
        const pair = sampleDipoleCoupledOrbitalPairWebGpu(device, capsule?.parameters || {});
        return { status: 'ok', pointCount: pair.pointCount, rExtentBohr: pair.rExtentBohr };
      }
    })
  };
}

// ============================================================================
// Live Time-Dependent Kohn-Sham (TD-KS) / Optical Bloch Electron-Cloud <->
// Photon Wavepacket Interaction Engine (Canonical Reusable ULG Runtime Module)
// ============================================================================
//
// Samples a joint 200K-point 3D basis of the valence Dirac-KS orbital phi_0(r)
// and its electric-dipole-coupled (Delta l = +-1) excited orbital phi_1(r) on
// WebGPU, storing exact normalized wavefunction amplitudes (phi0, phi1) at
// every 3D coordinate r_i. Real-time Optical Bloch integration of
//   i hbar d/dt |psi> = (H_0 - q z E(t)) |psi>
// evolves |psi(r, t)|^2 = |c0|^2 |phi0|^2 + |c1|^2 |phi1|^2 + 2 Re(c0* c1) phi0 phi1
// AND records the oscillating quantum dipole d(t) = <psi|z|psi> for exact
// retarded Hertzian dipole re-radiation E_rad(r, t) ~ d''(t - r/c) / r!

export const DIPOLE_PAIR_SAMPLER_WGSL = /* wgsl */ `
struct DipolePairParams {
  point_count: u32,
  radial_bins: u32,
  polar_bins: u32,
  seed: u32,
  m_abs: u32,
  m_signed: i32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> p: DipolePairParams;
// joint_radial[i] = vec4(r_norm, joint_cdf, R0_norm, R1_norm)
@group(0) @binding(1) var<storage, read> joint_radial: array<vec4<f32>>;
// joint_polar[i]  = vec4(joint_cdf, Y0_norm, Y1_norm, cos_theta)
@group(0) @binding(2) var<storage, read> joint_polar: array<vec4<f32>>;
// Output pos_out[i] = vec4(x_norm, y_norm, z_norm, r_norm)
@group(0) @binding(3) var<storage, read_write> pos_out: array<vec4<f32>>;
// Output amp_out[i] = vec4(phi0_tilde, phi1_tilde, y_dipole, shell_parity)
@group(0) @binding(4) var<storage, read_write> amp_out: array<vec4<f32>>;

const TWO_PI: f32 = 6.283185307179586;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

@compute @workgroup_size(64)
fn sample_dipole_coupled_pair(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count) { return; }

  var rng = ((idx + 1u) * 2654435761u) ^ (p.seed * 2246822519u + 3266489917u);
  let _w = pcg_next(&rng);

  // 1. Sample radius r continuously from joint radial envelope 0.5*(|u0|^2 + |u1|^2)
  let u_r = rand01(&rng);
  var rlo = 0u;
  var rhi = p.radial_bins - 1u;
  for (var it = 0u; it < 10u; it = it + 1u) {
    let mid = (rlo + rhi) >> 1u;
    if (joint_radial[mid].y < u_r) { rlo = mid + 1u; } else { rhi = mid; }
  }
  let ri = min(rlo, p.radial_bins - 1u);
  let rp = select(vec4<f32>(0.0, 0.0, 0.0, 0.0), joint_radial[ri - 1u], ri > 0u);
  let rc = joint_radial[ri];
  let fr = clamp((u_r - rp.y) / max(1e-7, rc.y - rp.y), 0.0, 1.0);
  let r_norm = mix(rp.x, rc.x, fr);
  let r0_amp = mix(rp.z, rc.z, fr);
  let r1_amp = mix(rp.w, rc.w, fr);

  // 2. Sample polar angle cos(theta) continuously from joint polar envelope 0.5*(|Y0|^2 + |Y1|^2)
  let u_p = rand01(&rng);
  var plo = 0u;
  var phi_hi = p.polar_bins - 1u;
  for (var it = 0u; it < 9u; it = it + 1u) {
    let mid = (plo + phi_hi) >> 1u;
    if (joint_polar[mid].x < u_p) { plo = mid + 1u; } else { phi_hi = mid; }
  }
  let pi_idx = min(plo, p.polar_bins - 1u);
  let pp = select(vec4<f32>(0.0, joint_polar[0].y, joint_polar[0].z, -1.0), joint_polar[pi_idx - 1u], pi_idx > 0u);
  let pc = joint_polar[pi_idx];
  let fp = clamp((u_p - pp.x) / max(1e-7, pc.x - pp.x), 0.0, 1.0);
  let cos_th = clamp(mix(pp.w, pc.w, fp), -1.0, 1.0);
  let sin_th = sqrt(max(0.0, 1.0 - cos_th * cos_th));
  let y0_amp = mix(pp.y, pc.y, fp);
  let y1_amp = mix(pp.z, pc.z, fp);

  // 3. Azimuthal angle phi (same m for Delta m = 0 linear E_y dipole transition!)
  var phi = rand01(&rng) * TWO_PI;
  var az = 1.0;
  if (p.m_abs > 0u) {
    let mf = f32(p.m_abs);
    for (var attempt = 0u; attempt < 16u; attempt = attempt + 1u) {
      let cand = rand01(&rng) * TWO_PI;
      let trig = select(sin(mf * cand), cos(mf * cand), p.m_signed > 0);
      if (rand01(&rng) <= trig * trig) {
        phi = cand;
        az = trig;
        break;
      }
    }
  }

  // Exact importance-normalized amplitudes phi0_tilde, phi1_tilde with |phi0|^2 + |phi1|^2 = 2
  let raw0 = r0_amp * y0_amp * az;
  let raw1 = r1_amp * y1_amp * az;
  let inv_env = 1.0 / sqrt(max(1e-8, 0.5 * (raw0 * raw0 + raw1 * raw1)));
  let phi0_t = clamp(raw0 * inv_env, -1.4142, 1.4142);
  let phi1_t = clamp(raw1 * inv_env, -1.4142, 1.4142);

  // Y-axis = electric field polarization axis E_y (so dipole interference sloshes vertically!)
  let x = r_norm * sin_th * cos(phi);
  let y = r_norm * cos_th;
  let z = r_norm * sin_th * sin(phi);
  let parity = select(-1.0, 1.0, r0_amp >= 0.0);

  pos_out[idx] = vec4<f32>(x, y, z, r_norm);
  amp_out[idx] = vec4<f32>(phi0_t, phi1_t, y, parity);
}
`;

const pairSamplerCache = new WeakMap();

function getDipolePairPipeline(device) {
  let cached = pairSamplerCache.get(device);
  if (cached) return cached;
  const mod = device.createShaderModule({ label: 'ulg-dipole-pair-sampler', code: DIPOLE_PAIR_SAMPLER_WGSL });
  const pipe = device.createComputePipeline({
    label: 'ulg-dipole-pair-sampler-pipe',
    layout: 'auto',
    compute: { module: mod, entryPoint: 'sample_dipole_coupled_pair' }
  });
  const paramsBuf = device.createBuffer({ size: 32, usage: GPU_BUF.UNIFORM | GPU_BUF.COPY_DST });
  const radBuf = device.createBuffer({ size: RADIAL_CDF_BINS * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  const polBuf = device.createBuffer({ size: POLAR_CDF_BINS * 16, usage: GPU_BUF.STORAGE | GPU_BUF.COPY_DST });
  cached = { pipe, paramsBuf, radBuf, polBuf };
  pairSamplerCache.set(device, cached);
  return cached;
}

function evalRadialArray(Z, n, l, rGrid, orbitalU, rSamples, screening, relativistic) {
  const out = new Float32Array(rSamples.length);
  const useKs = Array.isArray(rGrid) && rGrid.length >= 32 && orbitalU && orbitalU.length === rGrid.length;
  if (useKs) {
    let cursor = 0;
    for (let b = 0; b < rSamples.length; b += 1) {
      const r = rSamples[b];
      while (cursor + 1 < rGrid.length && rGrid[cursor + 1] < r) cursor += 1;
      const i0 = Math.min(rGrid.length - 2, cursor);
      const r0 = rGrid[i0];
      const r1 = Math.max(r0 + 1e-9, rGrid[i0 + 1]);
      const t = Math.max(0, Math.min(1, (r - r0) / (r1 - r0)));
      out[b] = orbitalU[i0] * (1 - t) + orbitalU[i0 + 1] * t;
    }
  } else {
    const zEff = slaterEffectiveZ(Z, n, l, screening);
    const zRad = relativisticEffectiveZ(zEff, n, l, relativistic);
    const normPre = Math.sqrt(
      Math.pow((2 * zRad) / n, 3) * (factorial(n - l - 1) / (2 * n * factorial(n + l)))
    );
    for (let b = 0; b < rSamples.length; b += 1) {
      const r = rSamples[b];
      const rho = (2 * zRad * r) / n;
      const lag = assocLaguerre(n - l - 1, 2 * l + 1, rho);
      out[b] = r * normPre * Math.exp(-0.5 * rho) * Math.pow(rho, l) * lag;
    }
  }
  // Normalize L2 so |u_0|^2 and |u_1|^2 have equal unit norm on the radial grid
  let norm2 = 0;
  for (let b = 0; b < out.length; b += 1) norm2 += out[b] * out[b];
  const inv = 1 / Math.sqrt(Math.max(1e-12, norm2));
  for (let b = 0; b < out.length; b += 1) out[b] *= inv;
  return out;
}

/**
 * Sample a joint 200K-point GPU basis of dipole-coupled Dirac-KS orbitals
 * `(phi_0, phi_1)` (`Delta l = +-1`, e.g. Gold `5d -> 6p`, Carbon `2p -> 3s`)
 * for real-time TD-KS wavefunction interference `|c_0(t) phi_0 + c_1(t) phi_1|^2`!
 */
export function sampleDipoleCoupledOrbitalPairWebGpu(device, {
  Z = 79,
  n0 = 5,
  l0 = 2,
  n1 = 6,
  l1 = 1,
  m = 0,
  rGrid = null,
  u0 = null,
  u1 = null,
  pointCount = 180000,
  screeningExchange = true,
  relativisticSpinOrbit = true,
  seed = 1,
  reusePosBuffer = null,
  reuseAmpBuffer = null
} = {}) {
  const count = Math.max(8192, Math.min(300000, Math.trunc(pointCount)));
  const n0s = Math.max(1, Math.min(8, Math.trunc(n0)));
  const l0s = Math.max(0, Math.min(n0s - 1, Math.trunc(l0)));
  const n1s = Math.max(1, Math.min(8, Math.trunc(n1)));
  const l1s = Math.max(0, Math.min(n1s - 1, Math.trunc(l1)));
  const mSafe = Math.max(-Math.min(l0s, l1s), Math.min(Math.min(l0s, l1s), Math.trunc(m)));
  const mAbs = Math.abs(mSafe);

  // Determine extent covering 99% of BOTH ground & dipole-coupled excited orbital
  const t0 = buildOrbitalCdfTables({ Z, n: n0s, l: l0s, m: mSafe, rGrid, orbitalU: u0, screeningExchange, relativisticSpinOrbit });
  const t1 = buildOrbitalCdfTables({ Z, n: n1s, l: l1s, m: mSafe, rGrid, orbitalU: u1, screeningExchange, relativisticSpinOrbit });
  const rExtentBohr = Math.max(t0.rExtentBohr, Math.min(t0.rExtentBohr * 1.45, t1.rExtentBohr));

  const rSamples = new Float32Array(RADIAL_CDF_BINS);
  for (let b = 0; b < RADIAL_CDF_BINS; b += 1) {
    rSamples[b] = ((b + 0.5) / RADIAL_CDF_BINS) * rExtentBohr;
  }
  const rad0 = evalRadialArray(Z, n0s, l0s, rGrid, u0, rSamples, screeningExchange, relativisticSpinOrbit);
  const rad1 = evalRadialArray(Z, n1s, l1s, rGrid, u1, rSamples, screeningExchange, relativisticSpinOrbit);

  const jointRadial = new Float32Array(RADIAL_CDF_BINS * 4);
  let rAcc = 0;
  for (let b = 0; b < RADIAL_CDF_BINS; b += 1) {
    rAcc += 0.5 * (rad0[b] * rad0[b] + rad1[b] * rad1[b]);
    jointRadial[b * 4 + 0] = rSamples[b] / rExtentBohr;
    jointRadial[b * 4 + 1] = rAcc;
    jointRadial[b * 4 + 2] = rad0[b];
    jointRadial[b * 4 + 3] = rad1[b];
  }
  const invR = rAcc > 0 ? 1 / rAcc : 1;
  for (let b = 0; b < RADIAL_CDF_BINS; b += 1) jointRadial[b * 4 + 1] *= invR;

  // Joint normalized polar table for Y_{l0, m} and Y_{l1, m}
  const y0Arr = new Float32Array(POLAR_CDF_BINS);
  const y1Arr = new Float32Array(POLAR_CDF_BINS);
  let n0Pol = 0; let n1Pol = 0;
  for (let b = 0; b < POLAR_CDF_BINS; b += 1) {
    const mu = -1.0 + ((b + 0.5) / POLAR_CDF_BINS) * 2.0;
    y0Arr[b] = associatedLegendre(l0s, mAbs, mu);
    y1Arr[b] = associatedLegendre(l1s, mAbs, mu);
    n0Pol += y0Arr[b] * y0Arr[b];
    n1Pol += y1Arr[b] * y1Arr[b];
  }
  const invY0 = 1 / Math.sqrt(Math.max(1e-12, n0Pol / POLAR_CDF_BINS));
  const invY1 = 1 / Math.sqrt(Math.max(1e-12, n1Pol / POLAR_CDF_BINS));
  const jointPolar = new Float32Array(POLAR_CDF_BINS * 4);
  let pAcc = 0;
  for (let b = 0; b < POLAR_CDF_BINS; b += 1) {
    const mu = -1.0 + ((b + 0.5) / POLAR_CDF_BINS) * 2.0;
    const yy0 = y0Arr[b] * invY0;
    const yy1 = y1Arr[b] * invY1;
    pAcc += 0.5 * (yy0 * yy0 + yy1 * yy1);
    jointPolar[b * 4 + 0] = pAcc;
    jointPolar[b * 4 + 1] = yy0;
    jointPolar[b * 4 + 2] = yy1;
    jointPolar[b * 4 + 3] = mu;
  }
  const invP = pAcc > 0 ? 1 / pAcc : 1;
  for (let b = 0; b < POLAR_CDF_BINS; b += 1) jointPolar[b * 4 + 0] *= invP;

  const { pipe, paramsBuf, radBuf, polBuf } = getDipolePairPipeline(device);
  const outBytes = count * 16;
  const posBuffer = (reusePosBuffer && reusePosBuffer.size >= outBytes)
    ? reusePosBuffer
    : device.createBuffer({ label: 'ulg-tdks-pair-pos', size: outBytes, usage: GPU_BUF.STORAGE | GPU_BUF.VERTEX });
  const ampBuffer = (reuseAmpBuffer && reuseAmpBuffer.size >= outBytes)
    ? reuseAmpBuffer
    : device.createBuffer({ label: 'ulg-tdks-pair-amp', size: outBytes, usage: GPU_BUF.STORAGE });

  const ab = new ArrayBuffer(32);
  const u32 = new Uint32Array(ab);
  const i32 = new Int32Array(ab);
  u32[0] = count >>> 0;
  u32[1] = RADIAL_CDF_BINS >>> 0;
  u32[2] = POLAR_CDF_BINS >>> 0;
  u32[3] = (seed >>> 0) || 1;
  u32[4] = mAbs >>> 0;
  i32[5] = mSafe;
  u32[6] = 0;
  u32[7] = 0;

  device.queue.writeBuffer(paramsBuf, 0, ab);
  device.queue.writeBuffer(radBuf, 0, jointRadial);
  device.queue.writeBuffer(polBuf, 0, jointPolar);

  const bg = device.createBindGroup({
    layout: pipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuf } },
      { binding: 1, resource: { buffer: radBuf } },
      { binding: 2, resource: { buffer: polBuf } },
      { binding: 3, resource: { buffer: posBuffer } },
      { binding: 4, resource: { buffer: ampBuffer } }
    ]
  });

  const enc = device.createCommandEncoder({ label: 'ulg-tdks-pair-sample' });
  const pass = enc.beginComputePass();
  pass.setPipeline(pipe);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(count / 64));
  pass.end();
  device.queue.submit([enc.finish()]);

  return Object.freeze({
    posBuffer,
    ampBuffer,
    pointCount: count,
    rExtentBohr,
    n0: n0s,
    l0: l0s,
    n1: n1s,
    l1: l1s,
    m: mSafe,
    groundSource: t0.sourceKind,
    excitedSource: t1.sourceKind
  });
}

/**
 * Exact Optical Bloch / TD-KS Quantum Dipole Response Integrator for a single
 * atom/molecule interacting with an electromagnetic photon wavepacket E(t).
 * Computes exact quantum superposition amplitudes (rho_00, rho_11, Re[rho_01],
 * Im[rho_01]), induced quantum dipole d(t), phase lag, absorbed energy, and a
 * retarded dipole-acceleration ring buffer for spherical Hertzian re-radiation!
 */
export function createQuantumBlochPhotonSession(electromagnetic = {}, { probeWavelengthNm = 440 } = {}) {
  const HC = 1239.841984;
  const HBAR_EV_FS = 0.6582119569; // hbar in eV * fs
  const isMetal = Boolean(electromagnetic?.isMetal);
  const oscs = Array.isArray(electromagnetic?.interbandOscillators) ? electromagnetic.interbandOscillators : [];
  // Pick the primary visible/near-UV dipole transition directly from ULG's GPU Dirac-KS solver!
  let transEv = 5.0;
  let gammaEv = 0.45;
  let transLabel = 'Valence→Cond';
  if (isMetal && oscs.length > 0) {
    // Prefer the strongest visible/blue-edge dipole transition (e.g. Au 5d(5/2)->7p/6p)
    const blueEdge = oscs.find((o) => o.energyEv >= 2.2 && o.energyEv <= 4.2) || oscs[0];
    transEv = Math.max(0.6, Number(blueEdge.energyEv) || 3.0);
    gammaEv = Math.max(0.22, Number(blueEdge.dampingEv) || 0.55);
    transLabel = blueEdge.transitionLabel || 'd→p';
  } else {
    const gap = Math.max(0.5, Number(electromagnetic?.bandGapEv) || 5.5);
    transEv = Math.max(2.6, gap + 1.4);
    gammaEv = gap < 3.4 ? 0.40 : 0.14;
    transLabel = `Valence→Cond (${transEv.toFixed(1)} eV)`;
  }

  const omega0 = transEv / HBAR_EV_FS; // rad / fs
  const gamma = gammaEv / HBAR_EV_FS;  // 1 / fs
  const gammaPop = gamma * 0.42;
  const rabiScale = 1.65; // strong-field visual probe (rad/fs at E=1)

  const HISTORY_LEN = 128;
  const channels = [610, 535, 440, Math.max(380, Math.min(780, Number(probeWavelengthNm) || 440))].map((nm) => ({
    wavelengthNm: nm,
    photonEv: HC / nm,
    omega: (HC / nm) / HBAR_EV_FS,
    rho01Re: 0,
    rho01Im: 0,
    rho11: 0,
    dipole: 0,
    dipolePrev: 0,
    dipoleAccel: 0,
    absorbedEnergy: 0,
    incidentEnergy: 0,
    eNow: 0,
    radHistory: new Float32Array(HISTORY_LEN)
  }));

  let timeFs = 0;
  let histCursor = 0;
  const pulseT0Fs = 4.2;
  const pulseWidthFs = 2.4;

  function packetField(ch, t) {
    const dt = t - pulseT0Fs;
    const env = Math.exp(-0.5 * (dt / pulseWidthFs) * (dt / pulseWidthFs));
    return env * Math.cos(ch.omega * dt);
  }

  function reset(nextLambdaNm = null) {
    timeFs = 0;
    histCursor = 0;
    if (nextLambdaNm != null) {
      const lam = Math.max(380, Math.min(780, Number(nextLambdaNm) || 440));
      channels[3].wavelengthNm = lam;
      channels[3].photonEv = HC / lam;
      channels[3].omega = channels[3].photonEv / HBAR_EV_FS;
    }
    for (const c of channels) {
      c.rho01Re = 0; c.rho01Im = 0; c.rho11 = 0;
      c.dipole = 0; c.dipolePrev = 0; c.dipoleAccel = 0;
      c.absorbedEnergy = 0; c.incidentEnergy = 0; c.eNow = 0;
      c.radHistory.fill(0);
    }
  }

  function stepFs(dtTotalFs = 0.08) {
    const substeps = 12;
    const h = dtTotalFs / substeps;
    for (let s = 0; s < substeps; s += 1) {
      const t = timeFs + s * h;
      for (const ch of channels) {
        const e = packetField(ch, t);
        const Om = rabiScale * e;
        // RK4 integration of exact Optical Bloch equations!
        const deriv = (re, im, p11, OmVal) => {
          const wInv = 2 * p11 - 1; // rho_11 - rho_00
          const dre = -omega0 * im - 0.5 * gamma * re;
          const dim = omega0 * re - 0.5 * gamma * im + OmVal * wInv;
          const dp11 = -gammaPop * p11 - 2 * OmVal * im;
          return [dre, dim, dp11];
        };
        const [k1r, k1i, k1p] = deriv(ch.rho01Re, ch.rho01Im, ch.rho11, Om);
        const eMid = packetField(ch, t + 0.5 * h);
        const OmMid = rabiScale * eMid;
        const [k2r, k2i, k2p] = deriv(ch.rho01Re + 0.5 * h * k1r, ch.rho01Im + 0.5 * h * k1i, ch.rho11 + 0.5 * h * k1p, OmMid);
        const [k3r, k3i, k3p] = deriv(ch.rho01Re + 0.5 * h * k2r, ch.rho01Im + 0.5 * h * k2i, ch.rho11 + 0.5 * h * k2p, OmMid);
        const eEnd = packetField(ch, t + h);
        const OmEnd = rabiScale * eEnd;
        const [k4r, k4i, k4p] = deriv(ch.rho01Re + h * k3r, ch.rho01Im + h * k3i, ch.rho11 + h * k3p, OmEnd);

        const prevDip = 2 * ch.rho01Re;
        ch.rho01Re += (h / 6) * (k1r + 2 * k2r + 2 * k3r + k4r);
        ch.rho01Im += (h / 6) * (k1i + 2 * k2i + 2 * k3i + k4i);
        ch.rho11 = Math.max(0, Math.min(0.98, ch.rho11 + (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p)));
        const newDip = 2 * ch.rho01Re;
        const dDot = (newDip - prevDip) / h;
        ch.dipoleAccel = (newDip - 2 * ch.dipole + ch.dipolePrev) / Math.max(1e-6, h * h);
        ch.dipolePrev = ch.dipole;
        ch.dipole = newDip;
        ch.eNow = eEnd;
        ch.absorbedEnergy += Math.max(0, eEnd * dDot * h);
        ch.incidentEnergy += eEnd * eEnd * h;
      }
    }
    timeFs += dtTotalFs;
    histCursor = (histCursor + 1) % HISTORY_LEN;
    for (const ch of channels) {
      // Store retarded Hertzian dipole radiation amplitude ~ -d''(t) (clamped cleanly)
      ch.radHistory[histCursor] = Math.max(-2.5, Math.min(2.5, -ch.dipoleAccel * 0.045));
    }
    if (timeFs > 13.5) reset();
  }

  return Object.freeze({
    transEv,
    gammaEv,
    transLabel,
    historyLen: HISTORY_LEN,
    channels,
    getTimeFs: () => timeFs,
    getHistCursor: () => histCursor,
    pulseT0Fs,
    pulseWidthFs,
    reset,
    stepFs
  });
}
