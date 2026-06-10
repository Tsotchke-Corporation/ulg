// Minimal Kohn–Sham density-functional theory: a radial (spherically symmetric) atomic solver
// with LDA exchange-correlation. This is the real KS machinery — self-consistent orbitals in an
// effective potential (nuclear + Hartree + exchange-correlation) — not a model. Atomic DFT is
// also how pseudopotentials for periodic-solid DFT are generated, so this is the genuine
// foundation of the path to iron (transition-metal / periodic systems the jellium model cannot
// reach).
//
// Reuses the uniform-electron-gas LDA energy density (uniformElectronGas.js). Atomic units.

import { numberDensityFromRs, uegEnergyPerElectronHa, wignerSeitzRadius, xcEnergyPerElectronSpinHa } from './uniformElectronGas.js';
import { electronConfiguration, spinElectronConfiguration, symbolForZ } from './periodicTable.js';

// Fine-structure constant (atomic units: c = 1/α). Used by the scalar-relativistic correction.
const ALPHA_FINE = 7.2973525693e-3;

// LDA exchange-correlation energy per unit volume (Ha/Bohr^3) from the UEG (energy per electron
// minus the kinetic term = exchange + correlation), and the corresponding potential.
function xcEnergyPerVolume(rho) {
  if (rho <= 1e-12) return 0;
  const rs = wignerSeitzRadius(rho);
  // UEG energy per electron minus the kinetic term = exchange + correlation per electron.
  const epsXC = uegEnergyPerElectronHa(rs) - kineticPerElectron(rs);
  return rho * epsXC;
}
function kineticPerElectron(rs) {
  const kF = (9 * Math.PI / 4) ** (1 / 3) / rs;
  return 0.3 * kF * kF;
}

/** LDA xc potential v_xc = d(ρ ε_xc)/dρ, evaluated numerically. */
function xcPotential(rho) {
  if (rho <= 1e-12) return 0;
  const d = rho * 1e-4 + 1e-15;
  return (xcEnergyPerVolume(rho + d) - xcEnergyPerVolume(rho - d)) / (2 * d);
}

// Thomas algorithm for a symmetric tridiagonal system (diag a, off-diagonal b) M x = rhs.
function solveTridiagonal(a, b, rhs) {
  const n = a.length;
  const cp = new Float64Array(n);
  const dp = new Float64Array(n);
  cp[0] = b[0] / a[0];
  dp[0] = rhs[0] / a[0];
  for (let i = 1; i < n; i += 1) {
    const m = a[i] - b[i - 1] * cp[i - 1];
    cp[i] = (i < n - 1 ? b[i] : 0) / m;
    dp[i] = (rhs[i] - b[i - 1] * dp[i - 1]) / m;
  }
  const x = new Float64Array(n);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i -= 1) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

/**
 * Lowest radial Kohn–Sham eigenstate for angular momentum l in an effective potential, by inverse
 * iteration on the tridiagonal radial Hamiltonian. Returns { energyHa, u } with u = r·R(r),
 * normalized so ∫ u^2 dr = 1.
 */
function lowestRadialState(vEff, r, h, l, shiftHa) {
  const n = r.length;
  const diag = new Float64Array(n);
  const off = new Float64Array(n);
  const invH2 = 1 / (h * h);
  for (let i = 0; i < n; i += 1) {
    diag[i] = invH2 + vEff[i] + (l * (l + 1)) / (2 * r[i] * r[i]) - shiftHa;
    off[i] = -0.5 * invH2;
  }
  let u = new Float64Array(n).fill(1e-3);
  let energy = shiftHa;
  for (let iter = 0; iter < 200; iter += 1) {
    const y = solveTridiagonal(diag, off, u);
    let norm = 0;
    for (let i = 0; i < n; i += 1) norm += y[i] * y[i] * h;
    norm = Math.sqrt(norm);
    for (let i = 0; i < n; i += 1) y[i] /= norm;
    // Rayleigh quotient with the full (unshifted) operator.
    let num = 0;
    for (let i = 0; i < n; i += 1) {
      const kinetic = invH2 * y[i] - 0.5 * invH2 * ((i > 0 ? y[i - 1] : 0) + (i < n - 1 ? y[i + 1] : 0));
      const hy = kinetic + (vEff[i] + (l * (l + 1)) / (2 * r[i] * r[i])) * y[i];
      num += y[i] * hy * h;
    }
    const newEnergy = num;
    const converged = Math.abs(newEnergy - energy) < 1e-10;
    energy = newEnergy;
    u = y;
    if (converged && iter > 3) break;
  }
  // Fix the sign so u > 0 near the origin.
  if (u[1] < 0) for (let i = 0; i < n; i += 1) u[i] = -u[i];
  return { energyHa: energy, u };
}

// Number of eigenvalues of the symmetric tridiagonal (diag, off) strictly below mu (Sturm
// sequence via the signs of the LDL^T pivots).
function sturmCount(diag, off, mu) {
  const n = diag.length;
  let count = 0;
  let p = diag[0] - mu;
  if (p < 0) count += 1;
  for (let i = 1; i < n; i += 1) {
    if (Math.abs(p) < 1e-300) p = -1e-300;
    p = (diag[i] - mu) - (off[i - 1] * off[i - 1]) / p;
    if (p < 0) count += 1;
  }
  return count;
}

// Gershgorin bracket [lo, hi] containing all eigenvalues of the symmetric tridiagonal (diag, off).
function gershgorinBounds(diag, off) {
  const n = diag.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const radius = Math.abs(i > 0 ? off[i - 1] : 0) + Math.abs(i < n - 1 ? off[i] : 0);
    lo = Math.min(lo, diag[i] - radius);
    hi = Math.max(hi, diag[i] + radius);
  }
  return { lo, hi };
}

// Bisections needed to pin an eigenvalue to ~1e-13 absolute, given the bracket width. The folded
// log-grid operators have a very wide Gershgorin span (~1e16, from the 1/r^2 diagonal at tiny r),
// so this adapts instead of using a fixed (and either too-coarse or wasteful) count.
function bisectionIters(span) {
  return Math.min(160, Math.max(48, Math.ceil(Math.log2(Math.max(span, 1e-300) / 1e-13))));
}

/**
 * The m-th lowest eigenpair (1-indexed) of a symmetric tridiagonal matrix: eigenvalue by Sturm-
 * sequence bisection, eigenvector by inverse iteration at that shift. `lowerVecs` (optional) are
 * already-found lower eigenvectors to orthogonalize against (needed only for near-degenerate
 * spectra; atomic radial states of one l are well separated, so the KH solver omits them). `bounds`
 * can be passed to reuse a precomputed Gershgorin bracket.
 */
function nthEigenpair(diag, off, m, h, { lowerVecs = null, bounds = null, bracketHint = null } = {}) {
  const n = diag.length;
  let a;
  let b;
  // A narrow bracket hint (e.g. the previous SCF/ε-iteration's eigenvalue ± a window) collapses the
  // bisection from ~95 steps over the huge Gershgorin span to ~40 — but only if it truly brackets
  // the m-th eigenvalue (sturm(a) < m ≤ sturm(b)); otherwise fall back to the full bracket.
  if (bracketHint && sturmCount(diag, off, bracketHint[0]) < m && sturmCount(diag, off, bracketHint[1]) >= m) {
    [a, b] = bracketHint;
  } else {
    const { lo, hi } = bounds ?? gershgorinBounds(diag, off);
    a = lo; b = hi;
  }
  const iters = bisectionIters(b - a);
  for (let iter = 0; iter < iters; iter += 1) {
    const mid = 0.5 * (a + b);
    if (sturmCount(diag, off, mid) >= m) b = mid; else a = mid;
  }
  const value = 0.5 * (a + b);
  const shift = value - 1e-7 * (Math.abs(value) + 1);
  const shifted = new Float64Array(n);
  for (let i = 0; i < n; i += 1) shifted[i] = diag[i] - shift;
  let v = new Float64Array(n);
  for (let i = 0; i < n; i += 1) v[i] = Math.sin((m * Math.PI * (i + 1)) / (n + 1));
  for (let iter = 0; iter < 12; iter += 1) {
    const y = solveTridiagonal(shifted, off, v);
    if (lowerVecs) {
      for (const prev of lowerVecs) {
        let dot = 0;
        for (let i = 0; i < n; i += 1) dot += y[i] * prev[i] * h;
        for (let i = 0; i < n; i += 1) y[i] -= dot * prev[i];
      }
    }
    let norm = 0;
    for (let i = 0; i < n; i += 1) norm += y[i] * y[i] * h;
    norm = Math.sqrt(norm);
    for (let i = 0; i < n; i += 1) v[i] = y[i] / norm;
  }
  if (v[1] < 0) for (let i = 0; i < n; i += 1) v[i] = -v[i];
  return { energyHa: value, u: v };
}

/**
 * The k lowest eigenpairs of a symmetric tridiagonal matrix (diag d, sub/super-diagonal off):
 * eigenvalues by Sturm-sequence bisection, eigenvectors by inverse iteration with Gram-Schmidt
 * deflation against the lower states.
 */
function lowestEigenpairs(diag, off, k, h) {
  const bounds = gershgorinBounds(diag, off);
  const pairs = [];
  const lowerVecs = [];
  for (let m = 1; m <= k; m += 1) {
    const pair = nthEigenpair(diag, off, m, h, { lowerVecs, bounds });
    pairs.push(pair);
    lowerVecs.push(pair.u);
  }
  return pairs;
}

/** Spherical Hartree potential V_H(r) from a radial density ρ(r). */
function hartreePotential(rho, r, h) {
  const n = r.length;
  // q(r) = ∫_0^r ρ r'^2 dr' (enclosed charge / 4π), p(r) = ∫_r^∞ ρ r' dr'.
  const q = new Float64Array(n);
  const p = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i += 1) { acc += rho[i] * r[i] * r[i] * h; q[i] = acc; }
  acc = 0;
  for (let i = n - 1; i >= 0; i -= 1) { acc += rho[i] * r[i] * h; p[i] = acc; }
  const vH = new Float64Array(n);
  for (let i = 0; i < n; i += 1) vH[i] = 4 * Math.PI * (q[i] / r[i] + p[i]);
  return vH;
}

/**
 * Solve a closed-shell, single-l-shell atom by self-consistent Kohn–Sham LDA. `occupancy` is the
 * number of electrons in the lowest l-state (e.g. He: l=0, 2 electrons). Returns total energy and
 * the converged orbital energy/density. (Multi-shell atoms — Be, Ne, Fe — extend this with state
 * deflation + Aufbau filling.)
 */
export function solveKohnShamAtom({ atomicNumberZ, occupancy, l = 0, gridPointsN = 4000, rMaxBohr = 18, mixing = 0.3, maxScf = 200 }) {
  const h = rMaxBohr / gridPointsN;
  const r = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) r[i] = (i + 1) * h;

  let rho = new Float64Array(gridPointsN);
  // Initialize with a hydrogenic-ish density.
  for (let i = 0; i < gridPointsN; i += 1) rho[i] = occupancy * (atomicNumberZ ** 3 / Math.PI) * Math.exp(-2 * atomicNumberZ * r[i]);

  let energyHa = 0;
  let orbitalEnergyHa = 0;
  let vH = new Float64Array(gridPointsN);
  let vXC = new Float64Array(gridPointsN);
  for (let scf = 0; scf < maxScf; scf += 1) {
    vH = hartreePotential(rho, r, h);
    for (let i = 0; i < gridPointsN; i += 1) vXC[i] = xcPotential(rho[i]);
    const vEff = new Float64Array(gridPointsN);
    for (let i = 0; i < gridPointsN; i += 1) vEff[i] = -atomicNumberZ / r[i] + vH[i] + vXC[i];

    const { energyHa: eps, u } = lowestRadialState(vEff, r, h, l, orbitalEnergyHa - 2 || -atomicNumberZ);
    orbitalEnergyHa = eps;

    // New density ρ = occupancy · u^2 / (4π r^2); mix with the previous density.
    const rhoNew = new Float64Array(gridPointsN);
    for (let i = 0; i < gridPointsN; i += 1) rhoNew[i] = (occupancy * u[i] * u[i]) / (4 * Math.PI * r[i] * r[i]);
    let delta = 0;
    for (let i = 0; i < gridPointsN; i += 1) {
      delta += Math.abs(rhoNew[i] - rho[i]) * r[i] * r[i] * h;
      rho[i] = (1 - mixing) * rho[i] + mixing * rhoNew[i];
    }
    if (delta < 1e-7 && scf > 5) break;
  }

  // Kohn–Sham total energy: E = Σ_occ ε − (1/2)∫ρV_H dV + ∫(ε_xc − v_xc)ρ dV.
  let eHartreeDouble = 0;
  let eXcCorrection = 0;
  for (let i = 0; i < gridPointsN; i += 1) {
    const dV = 4 * Math.PI * r[i] * r[i] * h;
    eHartreeDouble += 0.5 * rho[i] * vH[i] * dV;
    const epsXcPerVol = xcEnergyPerVolume(rho[i]);
    eXcCorrection += (epsXcPerVol - vXC[i] * rho[i]) * dV;
  }
  energyHa = occupancy * orbitalEnergyHa - eHartreeDouble + eXcCorrection;

  return { totalEnergyHa: energyHa, orbitalEnergyHa, atomicNumberZ, occupancy };
}

// Ground-state electron configurations (subshells filled in energy order). Occupancies are the
// standard neutral-atom configurations.
export const ELEMENT_CONFIGURATIONS = Object.freeze({
  H: { Z: 1, config: [{ n: 1, l: 0, occupancy: 1 }] },
  He: { Z: 2, config: [{ n: 1, l: 0, occupancy: 2 }] },
  Be: { Z: 4, config: [{ n: 1, l: 0, occupancy: 2 }, { n: 2, l: 0, occupancy: 2 }] },
  Ne: { Z: 10, config: [{ n: 1, l: 0, occupancy: 2 }, { n: 2, l: 0, occupancy: 2 }, { n: 2, l: 1, occupancy: 6 }] },
  Ar: { Z: 18, config: [
    { n: 1, l: 0, occupancy: 2 }, { n: 2, l: 0, occupancy: 2 }, { n: 2, l: 1, occupancy: 6 },
    { n: 3, l: 0, occupancy: 2 }, { n: 3, l: 1, occupancy: 6 }
  ] },
  Fe: { Z: 26, config: [
    { n: 1, l: 0, occupancy: 2 }, { n: 2, l: 0, occupancy: 2 }, { n: 2, l: 1, occupancy: 6 },
    { n: 3, l: 0, occupancy: 2 }, { n: 3, l: 1, occupancy: 6 }, { n: 4, l: 0, occupancy: 2 },
    { n: 3, l: 2, occupancy: 6 }
  ] }
});

// ---------------------------------------------------------------------------------------------
// Logarithmic-grid all-electron solver. A uniform grid wastes points in the valence tail and
// under-resolves the tight core of heavy atoms; a log grid r_i = e^{x_i} (x uniform) concentrates
// points near the nucleus, so it stays accurate across the whole periodic table with far fewer
// points. The radial equation for u = rR, under r = e^x and w = u/sqrt(r), becomes the symmetric
// Sturm-Liouville form  -w'' + [(l+1/2)^2 + 2 r^2 V_eff] w = E (2 r^2) w, a generalized tridiagonal
// eigenproblem with positive diagonal weight B = 2 r^2; we fold the weight in (B^{-1/2} A B^{-1/2})
// to reuse the standard symmetric-tridiagonal eigensolver.
// ---------------------------------------------------------------------------------------------

function hartreePotentialLog(rho, r, dx) {
  const n = r.length;
  // dV factors on the log grid: dr = r dx.  q(r)=∫ρ r'^2 dr' = Σ ρ r'^3 dx ; p(r)=∫_r ρ r' dr' = Σ ρ r'^2 dx.
  const q = new Float64Array(n);
  const p = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i += 1) { acc += rho[i] * r[i] * r[i] * r[i] * dx; q[i] = acc; }
  acc = 0;
  for (let i = n - 1; i >= 0; i -= 1) { acc += rho[i] * r[i] * r[i] * dx; p[i] = acc; }
  const vH = new Float64Array(n);
  for (let i = 0; i < n; i += 1) vH[i] = 4 * Math.PI * (q[i] / r[i] + p[i]);
  return vH;
}

// Lowest `count` radial states for angular momentum l in effective potential vEff, on the log
// grid. Builds the folded symmetric-tridiagonal operator Â = B^{-1/2} A B^{-1/2} (B = 2 r^2),
// solves it, and recovers the physical u(r) = ŵ/sqrt(2r) normalized to ∫u^2 dr = 1. Shared by the
// spin-restricted (LDA) and spin-polarized (LSDA) solvers.
function radialStatesLog(vEff, r, dx, l, count) {
  const n = r.length;
  const invDx2 = 1 / (dx * dx);
  const diag = new Float64Array(n);
  const off = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    diag[i] = (invDx2 + 0.5 * (l + 0.5) * (l + 0.5)) / (r[i] * r[i]) + vEff[i];
    if (i < n - 1) off[i] = -invDx2 / (2 * r[i] * r[i + 1]);
  }
  const pairs = lowestEigenpairs(diag, off, count, dx);
  for (const pair of pairs) {
    const u = new Float64Array(n);
    for (let i = 0; i < n; i += 1) u[i] = pair.u[i] / Math.sqrt(2 * r[i]);
    let norm = 0;
    for (let i = 0; i < n; i += 1) norm += u[i] * u[i] * r[i] * dx;
    norm = Math.sqrt(norm);
    for (let i = 0; i < n; i += 1) u[i] /= norm;
    pair.u = u;
  }
  return pairs;
}

// Scalar-relativistic (spin-orbit-averaged) first-order correction to one orbital's energy:
// mass-velocity ΔE_MV = −(α²/2)∫(ε−V)² u² dr  plus the Darwin contact term (s-states only, from
// the nuclear ∇²(−Z/r) = 4πZδ) ΔE_D = (α²/8) Z R(0)². For a bare hydrogenic 1s this reproduces
// the exact leading correction −α²Z⁴/8 (validated). In many-electron atoms it is a first-order
// estimate: the large near-nucleus MV and Darwin terms nearly cancel, so the net amplifies small
// screening differences and overestimates for heavy Z (and first-order PT breaks down as αZ→1);
// the non-perturbative Koelling–Harmon SCF is the rigorous upgrade. The smooth electronic Darwin
// part is small and omitted.
export function relativisticOrbitalCorrectionHa({ u, energyHa, vFull, r, dx, l, atomicNumberZ }) {
  const a2 = ALPHA_FINE * ALPHA_FINE;
  let mv = 0;
  for (let i = 0; i < r.length; i += 1) {
    const ev = energyHa - vFull[i];
    mv += ev * ev * u[i] * u[i] * r[i] * dx; // ∫(ε−V)² u² dr, dr = r dx
  }
  let darwin = 0;
  if (l === 0) {
    const R0 = u[0] / r[0]; // R(0) = lim u/r for an s-state
    darwin = (a2 / 8) * atomicNumberZ * R0 * R0;
  }
  return -0.5 * a2 * mv + darwin;
}

// Radial derivatives of a smooth function f sampled on the log grid (r = e^x, uniform x):
//   df/dr = (1/r) df/dx ,   d^2f/dr^2 = (1/r^2)(d^2f/dx^2 - df/dx)   (central differences).
function radialDerivativesLog(f, r, dx) {
  const n = f.length;
  const fp = new Float64Array(n);
  const fpp = new Float64Array(n);
  for (let i = 1; i < n - 1; i += 1) {
    const fx = (f[i + 1] - f[i - 1]) / (2 * dx);
    const fxx = (f[i + 1] - 2 * f[i] + f[i - 1]) / (dx * dx);
    fp[i] = fx / r[i];
    fpp[i] = (fxx - fx) / (r[i] * r[i]);
  }
  fp[0] = fp[1]; fp[n - 1] = fp[n - 2];
  fpp[0] = fpp[1]; fpp[n - 1] = fpp[n - 2];
  return { fp, fpp };
}

/**
 * Koelling–Harmon scalar-relativistic radial states for angular momentum l, in the effective
 * potential V = −Z/r + vElec. Non-perturbative: the energy-dependent relativistic mass
 * M(r) = 1 + (α²/2)(ε − V) enters the kinetic operator, and the scalar-relativistic mass-velocity
 * + Darwin physics appears through the M, M', M'' terms (spin-orbit dropped — the KH
 * approximation). Solved as the symmetric generalized eigenproblem
 *   −w'' + [(l+1/2)² + r²·U_rel] w = ε·(2 M r²)·w ,   w = (P/√M)/√r ,  u = P = ŵ/√(2r),
 * folded (B^{-1/2} A B^{-1/2}) to reuse the tridiagonal eigensolver; M depends on ε, so each
 * orbital's energy is iterated to self-consistency. Returns the lowest `count` states (energy + u).
 */
export function radialStatesKH(vElec, r, dx, l, count, atomicNumberZ, initialEnergies) {
  const n = r.length;
  const invDx2 = 1 / (dx * dx);
  const a2h = 0.5 * ALPHA_FINE * ALPHA_FINE;
  const V = new Float64Array(n);
  for (let i = 0; i < n; i += 1) V[i] = -atomicNumberZ / r[i] + vElec[i];
  // V' = Z/r^2 + vElec' ;  V'' = -2Z/r^3 + vElec''  (nuclear part analytic, electronic part numeric).
  const { fp: vElecP, fpp: vElecPP } = radialDerivativesLog(vElec, r, dx);
  const Vp = new Float64Array(n);
  const Vpp = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    Vp[i] = atomicNumberZ / (r[i] * r[i]) + vElecP[i];
    Vpp[i] = -2 * atomicNumberZ / (r[i] * r[i] * r[i]) + vElecPP[i];
  }

  const states = [];
  for (let k = 0; k < count; k += 1) {
    let energy = initialEnergies?.[k] ?? -atomicNumberZ * atomicNumberZ / (2 * (k + l + 1) * (k + l + 1));
    let u = null;
    for (let iter = 0; iter < 40; iter += 1) {
      const M = new Float64Array(n);
      for (let i = 0; i < n; i += 1) M[i] = 1 + a2h * (energy - V[i]);
      const diag = new Float64Array(n);
      const off = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const mRatio = (-a2h * Vp[i]) / M[i]; // M'/M
        const Urel = 2 * M[i] * V[i] - mRatio / r[i] + 0.75 * mRatio * mRatio - 0.5 * (-a2h * Vpp[i]) / M[i];
        const aDiag = 2 * invDx2 + (l + 0.5) * (l + 0.5) + r[i] * r[i] * Urel;
        const bDiag = 2 * M[i] * r[i] * r[i];
        diag[i] = aDiag / bDiag;
        if (i < n - 1) off[i] = -invDx2 / (2 * r[i] * r[i + 1] * Math.sqrt(M[i] * M[i + 1]));
      }
      // Only the (k+1)-th eigenpair is needed (atomic radial states of one l are well separated,
      // so no deflation against the lower ones is required) — far cheaper than all k+1. Warm-start
      // the bracket from the running energy estimate (consecutive iterations barely move it).
      const window = Math.max(2, 0.05 * Math.abs(energy));
      const pair = nthEigenpair(diag, off, k + 1, dx, { bracketHint: [energy - window, energy + window] });
      const newEnergy = pair.energyHa;
      u = pair.u;
      if (Math.abs(newEnergy - energy) < 1e-9 && iter > 1) { energy = newEnergy; break; }
      energy = newEnergy;
    }
    // Recover u = P = ŵ/√(2r) (the √M cancels in the unfolding), normalize ∫u^2 dr = 1.
    const uPhys = new Float64Array(n);
    for (let i = 0; i < n; i += 1) uPhys[i] = u[i] / Math.sqrt(2 * r[i]);
    let norm = 0;
    for (let i = 0; i < n; i += 1) norm += uPhys[i] * uPhys[i] * r[i] * dx;
    norm = Math.sqrt(norm);
    for (let i = 0; i < n; i += 1) uPhys[i] /= norm;
    states.push({ energyHa: energy, u: uPhys });
  }
  return states;
}

/**
 * All-electron Kohn–Sham LDA on a logarithmic radial grid. Accurate across the periodic table.
 * `configuration` is the { n, l, occupancy } subshell list. Returns total energy, per-subshell
 * orbital energies, and the integrated electron count. With `relativistic: true`, also returns the
 * scalar-relativistic (mass-velocity + Darwin) correction and the corrected total energy.
 */
export function solveKohnShamAtomLog({
  atomicNumberZ,
  configuration,
  gridPointsN = 1400,
  rMinBohr = 1e-5,
  rMaxBohr = 40,
  mixing = 0.2,
  maxScf = 500,
  tol = 1e-7,
  relativistic = false,
  returnRadialDensity = false
}) {
  const xMin = Math.log(rMinBohr);
  const xMax = Math.log(rMaxBohr);
  const dx = (xMax - xMin) / (gridPointsN - 1);
  const r = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) r[i] = Math.exp(xMin + i * dx);

  const statesPerL = new Map();
  for (const sub of configuration) statesPerL.set(sub.l, Math.max(statesPerL.get(sub.l) || 0, sub.n - sub.l));

  // Hydrogenic-ish starting density.
  let rho = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) rho[i] = atomicNumberZ * (atomicNumberZ ** 3 / Math.PI) * Math.exp(-2 * atomicNumberZ * r[i]);

  let statesByL = new Map();
  let vH = new Float64Array(gridPointsN);
  let vXC = new Float64Array(gridPointsN);
  let vEff = new Float64Array(gridPointsN);

  for (let scf = 0; scf < maxScf; scf += 1) {
    vH = hartreePotentialLog(rho, r, dx);
    for (let i = 0; i < gridPointsN; i += 1) {
      vXC[i] = xcPotential(rho[i]);
      vEff[i] = -atomicNumberZ / r[i] + vH[i] + vXC[i];
    }
    statesByL = new Map();
    for (const [l, count] of statesPerL) statesByL.set(l, radialStatesLog(vEff, r, dx, l, count));
    // New density ρ = Σ occ u^2 / (4π r^2).
    const rhoNew = new Float64Array(gridPointsN);
    for (const sub of configuration) {
      const state = statesByL.get(sub.l)[sub.n - sub.l - 1];
      for (let i = 0; i < gridPointsN; i += 1) rhoNew[i] += (sub.occupancy * state.u[i] * state.u[i]) / (4 * Math.PI * r[i] * r[i]);
    }
    let delta = 0;
    for (let i = 0; i < gridPointsN; i += 1) {
      delta += Math.abs(rhoNew[i] - rho[i]) * 4 * Math.PI * r[i] * r[i] * r[i] * dx;
      rho[i] = (1 - mixing) * rho[i] + mixing * rhoNew[i];
    }
    if (delta < tol && scf > 8) break;
  }

  let sumOcc = 0;
  let electronCount = 0;
  let relativisticCorrectionHa = 0;
  const orbitals = [];
  for (const sub of configuration) {
    const state = statesByL.get(sub.l)[sub.n - sub.l - 1];
    sumOcc += sub.occupancy * state.energyHa;
    electronCount += sub.occupancy;
    const orbital = { n: sub.n, l: sub.l, occupancy: sub.occupancy, energyHa: state.energyHa };
    if (relativistic) {
      orbital.relativisticShiftHa = relativisticOrbitalCorrectionHa({
        u: state.u, energyHa: state.energyHa, vFull: vEff, r, dx, l: sub.l, atomicNumberZ
      });
      relativisticCorrectionHa += sub.occupancy * orbital.relativisticShiftHa;
    }
    orbitals.push(orbital);
  }
  let integratedElectrons = 0;
  let eHartreeDouble = 0;
  let eXcCorrection = 0;
  for (let i = 0; i < gridPointsN; i += 1) {
    const dV = 4 * Math.PI * r[i] * r[i] * r[i] * dx; // 4π r^2 dr, dr = r dx
    integratedElectrons += rho[i] * dV;
    eHartreeDouble += 0.5 * rho[i] * vH[i] * dV;
    eXcCorrection += (xcEnergyPerVolume(rho[i]) - vXC[i] * rho[i]) * dV;
  }
  const totalEnergyHa = sumOcc - eHartreeDouble + eXcCorrection;
  return {
    totalEnergyHa,
    orbitals,
    electronCount,
    integratedElectrons,
    atomicNumberZ,
    ...(returnRadialDensity ? { radialGrid: { r: Array.from(r), rho: Array.from(rho), dx } } : {}),
    ...(relativistic ? { relativisticCorrectionHa, totalEnergyRelHa: totalEnergyHa + relativisticCorrectionHa } : {})
  };
}

// Spin-polarized (LSDA) exchange-correlation energy per unit volume and the per-spin potentials
// v_xc^σ = ∂(ρ ε_xc)/∂ρ_σ (by finite difference in each spin density).
function xcEnergyPerVolumeSpin(rhoUp, rhoDown) {
  const rho = rhoUp + rhoDown;
  if (rho <= 1e-12) return 0;
  const rs = wignerSeitzRadius(rho);
  const zeta = Math.max(-1, Math.min(1, (rhoUp - rhoDown) / rho));
  return rho * xcEnergyPerElectronSpinHa(rs, zeta);
}
function xcPotentialsSpin(rhoUp, rhoDown) {
  const dU = rhoUp * 1e-4 + 1e-15;
  const dD = rhoDown * 1e-4 + 1e-15;
  const vUp = (xcEnergyPerVolumeSpin(rhoUp + dU, rhoDown) - xcEnergyPerVolumeSpin(rhoUp - dU, rhoDown)) / (2 * dU);
  const vDown = (xcEnergyPerVolumeSpin(rhoUp, rhoDown + dD) - xcEnergyPerVolumeSpin(rhoUp, rhoDown - dD)) / (2 * dD);
  return { vUp, vDown };
}

function densityFromSpinSubshells(spinConfiguration, statesUp, statesDown, r, n) {
  const rhoUp = new Float64Array(n);
  const rhoDown = new Float64Array(n);
  for (const sub of spinConfiguration) {
    const idx = sub.n - sub.l - 1;
    if (sub.occUp > 0) {
      const u = statesUp.get(sub.l)[idx].u;
      for (let i = 0; i < n; i += 1) rhoUp[i] += (sub.occUp * u[i] * u[i]) / (4 * Math.PI * r[i] * r[i]);
    }
    if (sub.occDown > 0) {
      const u = statesDown.get(sub.l)[idx].u;
      for (let i = 0; i < n; i += 1) rhoDown[i] += (sub.occDown * u[i] * u[i]) / (4 * Math.PI * r[i] * r[i]);
    }
  }
  return { rhoUp, rhoDown };
}

/**
 * All-electron Kohn–Sham LSDA (spin-polarized) on a logarithmic grid. The spin-up and spin-down
 * channels have separate effective potentials (sharing the Hartree term from the total density),
 * so open-shell atoms acquire a magnetic moment from Hund's-rule spin filling — e.g. Fe (3d↑5 3d↓1)
 * gets ~4 μ_B. `spinConfiguration` is the { n, l, occUp, occDown } list. Returns total energy, the
 * net spin moment (n↑ − n↓), per-spin orbital energies, and (optionally) the relativistic correction.
 */
export function solveKohnShamAtomLSDA({
  atomicNumberZ,
  spinConfiguration,
  gridPointsN = 1400,
  rMinBohr = 1e-5,
  rMaxBohr = 40,
  mixing = 0.2,
  maxScf = 600,
  tol = 1e-7,
  relativistic = false
}) {
  const xMin = Math.log(rMinBohr);
  const xMax = Math.log(rMaxBohr);
  const dx = (xMax - xMin) / (gridPointsN - 1);
  const r = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) r[i] = Math.exp(xMin + i * dx);

  const statesPerLUp = new Map();
  const statesPerLDown = new Map();
  let nUp = 0;
  let nDown = 0;
  for (const sub of spinConfiguration) {
    if (sub.occUp > 0) statesPerLUp.set(sub.l, Math.max(statesPerLUp.get(sub.l) || 0, sub.n - sub.l));
    if (sub.occDown > 0) statesPerLDown.set(sub.l, Math.max(statesPerLDown.get(sub.l) || 0, sub.n - sub.l));
    nUp += sub.occUp;
    nDown += sub.occDown;
  }
  const nTot = nUp + nDown;

  // Initial densities: split a hydrogenic guess by the overall spin ratio.
  let rhoUp = new Float64Array(gridPointsN);
  let rhoDown = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) {
    const g = atomicNumberZ * (atomicNumberZ ** 3 / Math.PI) * Math.exp(-2 * atomicNumberZ * r[i]);
    rhoUp[i] = g * (nUp / nTot);
    rhoDown[i] = g * (nDown / nTot);
  }

  let statesUp = new Map();
  let statesDown = new Map();
  let vH = new Float64Array(gridPointsN);
  const vXCUp = new Float64Array(gridPointsN);
  const vXCDown = new Float64Array(gridPointsN);
  const vEffUp = new Float64Array(gridPointsN);
  const vEffDown = new Float64Array(gridPointsN);

  for (let scf = 0; scf < maxScf; scf += 1) {
    const rhoTot = new Float64Array(gridPointsN);
    for (let i = 0; i < gridPointsN; i += 1) rhoTot[i] = rhoUp[i] + rhoDown[i];
    vH = hartreePotentialLog(rhoTot, r, dx);
    for (let i = 0; i < gridPointsN; i += 1) {
      const { vUp, vDown } = xcPotentialsSpin(rhoUp[i], rhoDown[i]);
      vXCUp[i] = vUp; vXCDown[i] = vDown;
      vEffUp[i] = -atomicNumberZ / r[i] + vH[i] + vUp;
      vEffDown[i] = -atomicNumberZ / r[i] + vH[i] + vDown;
    }
    statesUp = new Map();
    statesDown = new Map();
    for (const [l, count] of statesPerLUp) statesUp.set(l, radialStatesLog(vEffUp, r, dx, l, count));
    for (const [l, count] of statesPerLDown) statesDown.set(l, radialStatesLog(vEffDown, r, dx, l, count));
    const { rhoUp: upNew, rhoDown: downNew } = densityFromSpinSubshells(spinConfiguration, statesUp, statesDown, r, gridPointsN);
    let delta = 0;
    for (let i = 0; i < gridPointsN; i += 1) {
      delta += (Math.abs(upNew[i] - rhoUp[i]) + Math.abs(downNew[i] - rhoDown[i])) * 4 * Math.PI * r[i] * r[i] * r[i] * dx;
      rhoUp[i] = (1 - mixing) * rhoUp[i] + mixing * upNew[i];
      rhoDown[i] = (1 - mixing) * rhoDown[i] + mixing * downNew[i];
    }
    if (delta < tol && scf > 8) break;
  }

  let sumOcc = 0;
  let relativisticCorrectionHa = 0;
  const orbitals = [];
  for (const sub of spinConfiguration) {
    const idx = sub.n - sub.l - 1;
    const orbital = { n: sub.n, l: sub.l, occUp: sub.occUp, occDown: sub.occDown };
    if (sub.occUp > 0) {
      const st = statesUp.get(sub.l)[idx];
      orbital.energyUpHa = st.energyHa;
      sumOcc += sub.occUp * st.energyHa;
      if (relativistic) relativisticCorrectionHa += sub.occUp * relativisticOrbitalCorrectionHa({ u: st.u, energyHa: st.energyHa, vFull: vEffUp, r, dx, l: sub.l, atomicNumberZ });
    }
    if (sub.occDown > 0) {
      const st = statesDown.get(sub.l)[idx];
      orbital.energyDownHa = st.energyHa;
      sumOcc += sub.occDown * st.energyHa;
      if (relativistic) relativisticCorrectionHa += sub.occDown * relativisticOrbitalCorrectionHa({ u: st.u, energyHa: st.energyHa, vFull: vEffDown, r, dx, l: sub.l, atomicNumberZ });
    }
    orbitals.push(orbital);
  }
  let integratedElectrons = 0;
  let spinMoment = 0;
  let eHartreeDouble = 0;
  let eXcCorrection = 0;
  for (let i = 0; i < gridPointsN; i += 1) {
    const dV = 4 * Math.PI * r[i] * r[i] * r[i] * dx;
    const rhoTot = rhoUp[i] + rhoDown[i];
    integratedElectrons += rhoTot * dV;
    spinMoment += (rhoUp[i] - rhoDown[i]) * dV;
    eHartreeDouble += 0.5 * rhoTot * vH[i] * dV;
    eXcCorrection += (xcEnergyPerVolumeSpin(rhoUp[i], rhoDown[i]) - vXCUp[i] * rhoUp[i] - vXCDown[i] * rhoDown[i]) * dV;
  }
  const totalEnergyHa = sumOcc - eHartreeDouble + eXcCorrection;
  return {
    totalEnergyHa,
    spinMoment,
    orbitals,
    electronCount: nTot,
    integratedElectrons,
    atomicNumberZ,
    ...(relativistic ? { relativisticCorrectionHa, totalEnergyRelHa: totalEnergyHa + relativisticCorrectionHa } : {})
  };
}

/**
 * All-electron Kohn–Sham LDA with the Koelling–Harmon scalar-relativistic treatment on a
 * logarithmic grid. Unlike the perturbative correction, the relativistic mass enters the kinetic
 * operator self-consistently (each orbital's energy iterated through M(ε,r)), so it stays accurate
 * for heavy atoms where first-order perturbation theory breaks down. Returns total energy,
 * per-subshell orbital energies, and the integrated electron count.
 */
export function solveKohnShamAtomKH({
  atomicNumberZ,
  configuration,
  gridPointsN = 1400,
  rMinBohr = 1e-6,
  rMaxBohr = 40,
  mixing = 0.2,
  maxScf = 500,
  tol = 1e-7
}) {
  const xMin = Math.log(rMinBohr);
  const dx = (Math.log(rMaxBohr) - xMin) / (gridPointsN - 1);
  const r = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) r[i] = Math.exp(xMin + i * dx);

  const statesPerL = new Map();
  for (const sub of configuration) statesPerL.set(sub.l, Math.max(statesPerL.get(sub.l) || 0, sub.n - sub.l));

  let rho = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) rho[i] = atomicNumberZ * (atomicNumberZ ** 3 / Math.PI) * Math.exp(-2 * atomicNumberZ * r[i]);

  let statesByL = new Map();
  const prevEnergies = new Map(); // per-l seed energies (warm-start the per-orbital ε iteration)
  let vH = new Float64Array(gridPointsN);
  let vXC = new Float64Array(gridPointsN);
  const vElec = new Float64Array(gridPointsN);

  for (let scf = 0; scf < maxScf; scf += 1) {
    vH = hartreePotentialLog(rho, r, dx);
    for (let i = 0; i < gridPointsN; i += 1) {
      vXC[i] = xcPotential(rho[i]);
      vElec[i] = vH[i] + vXC[i];
    }
    statesByL = new Map();
    for (const [l, count] of statesPerL) {
      const states = radialStatesKH(vElec, r, dx, l, count, atomicNumberZ, prevEnergies.get(l));
      prevEnergies.set(l, states.map((s) => s.energyHa));
      statesByL.set(l, states);
    }
    const rhoNew = new Float64Array(gridPointsN);
    for (const sub of configuration) {
      const state = statesByL.get(sub.l)[sub.n - sub.l - 1];
      for (let i = 0; i < gridPointsN; i += 1) rhoNew[i] += (sub.occupancy * state.u[i] * state.u[i]) / (4 * Math.PI * r[i] * r[i]);
    }
    let delta = 0;
    for (let i = 0; i < gridPointsN; i += 1) {
      delta += Math.abs(rhoNew[i] - rho[i]) * 4 * Math.PI * r[i] * r[i] * r[i] * dx;
      rho[i] = (1 - mixing) * rho[i] + mixing * rhoNew[i];
    }
    if (delta < tol && scf > 8) break;
  }

  let sumOcc = 0;
  let electronCount = 0;
  const orbitals = [];
  for (const sub of configuration) {
    const state = statesByL.get(sub.l)[sub.n - sub.l - 1];
    sumOcc += sub.occupancy * state.energyHa;
    electronCount += sub.occupancy;
    orbitals.push({ n: sub.n, l: sub.l, occupancy: sub.occupancy, energyHa: state.energyHa });
  }
  let integratedElectrons = 0;
  let eHartreeDouble = 0;
  let eXcCorrection = 0;
  for (let i = 0; i < gridPointsN; i += 1) {
    const dV = 4 * Math.PI * r[i] * r[i] * r[i] * dx;
    integratedElectrons += rho[i] * dV;
    eHartreeDouble += 0.5 * rho[i] * vH[i] * dV;
    eXcCorrection += (xcEnergyPerVolume(rho[i]) - vXC[i] * rho[i]) * dV;
  }
  return {
    totalEnergyHa: sumOcc - eHartreeDouble + eXcCorrection,
    orbitals,
    electronCount,
    integratedElectrons,
    atomicNumberZ,
    relativisticMethod: 'koelling-harmon'
  };
}

function densityFromSubshells(configuration, statesByL, r, gridPointsN) {
  const rho = new Float64Array(gridPointsN);
  for (const sub of configuration) {
    const state = statesByL.get(sub.l)[sub.n - sub.l - 1];
    for (let i = 0; i < gridPointsN; i += 1) {
      rho[i] += (sub.occupancy * state.u[i] * state.u[i]) / (4 * Math.PI * r[i] * r[i]);
    }
  }
  return rho;
}

/**
 * Self-consistent all-electron Kohn–Sham LDA for an atom of any (closed/standard-shell)
 * configuration, using Aufbau filling: for each angular momentum l, the lowest needed radial
 * states are found by the tridiagonal eigensolver, then occupied per the configuration. Returns
 * the total energy, the per-subshell orbital energies, and the integrated electron count.
 */
export function solveKohnShamAtomConfig({ atomicNumberZ, configuration, gridPointsN = 6000, rMaxBohr = 16, mixing = 0.2, maxScf = 400 }) {
  const h = rMaxBohr / gridPointsN;
  const r = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) r[i] = (i + 1) * h;

  // States needed per l = max (n - l) over the configuration.
  const statesPerL = new Map();
  for (const sub of configuration) statesPerL.set(sub.l, Math.max(statesPerL.get(sub.l) || 0, sub.n - sub.l));

  let rho = new Float64Array(gridPointsN);
  for (let i = 0; i < gridPointsN; i += 1) rho[i] = atomicNumberZ * (atomicNumberZ ** 3 / Math.PI) * Math.exp(-2 * atomicNumberZ * r[i]);

  let statesByL = new Map();
  let vH = new Float64Array(gridPointsN);
  let vXC = new Float64Array(gridPointsN);
  const invH2 = 1 / (h * h);
  const off = new Float64Array(gridPointsN).fill(-0.5 * invH2);

  for (let scf = 0; scf < maxScf; scf += 1) {
    vH = hartreePotential(rho, r, h);
    for (let i = 0; i < gridPointsN; i += 1) vXC[i] = xcPotential(rho[i]);
    statesByL = new Map();
    for (const [l, count] of statesPerL) {
      const diag = new Float64Array(gridPointsN);
      for (let i = 0; i < gridPointsN; i += 1) {
        diag[i] = invH2 - atomicNumberZ / r[i] + vH[i] + vXC[i] + (l * (l + 1)) / (2 * r[i] * r[i]);
      }
      statesByL.set(l, lowestEigenpairs(diag, off, count, h));
    }
    const rhoNew = densityFromSubshells(configuration, statesByL, r, gridPointsN);
    let delta = 0;
    for (let i = 0; i < gridPointsN; i += 1) {
      delta += Math.abs(rhoNew[i] - rho[i]) * 4 * Math.PI * r[i] * r[i] * h;
      rho[i] = (1 - mixing) * rho[i] + mixing * rhoNew[i];
    }
    if (delta < 1e-6 && scf > 8) break;
  }

  // Total energy + diagnostics.
  let sumOcc = 0;
  let electronCount = 0;
  const orbitals = [];
  for (const sub of configuration) {
    const state = statesByL.get(sub.l)[sub.n - sub.l - 1];
    sumOcc += sub.occupancy * state.energyHa;
    electronCount += sub.occupancy;
    orbitals.push({ n: sub.n, l: sub.l, occupancy: sub.occupancy, energyHa: state.energyHa });
  }
  let integratedElectrons = 0;
  let eHartreeDouble = 0;
  let eXcCorrection = 0;
  for (let i = 0; i < gridPointsN; i += 1) {
    const dV = 4 * Math.PI * r[i] * r[i] * h;
    integratedElectrons += rho[i] * dV;
    eHartreeDouble += 0.5 * rho[i] * vH[i] * dV;
    eXcCorrection += (xcEnergyPerVolume(rho[i]) - vXC[i] * rho[i]) * dV;
  }
  return {
    totalEnergyHa: sumOcc - eHartreeDouble + eXcCorrection,
    orbitals,
    electronCount,
    integratedElectrons,
    atomicNumberZ
  };
}

/**
 * Solve any element by atomic number using its ground-state configuration and the logarithmic-grid
 * Kohn–Sham solver. Grid resolution scales mildly with Z so heavy atoms keep their tight cores
 * resolved. Options:
 *   - spinPolarized: use LSDA (spin-up/down channels via Hund filling) → returns a spin moment.
 *   - relativistic: add the scalar-relativistic (mass-velocity + Darwin) correction.
 * Returns the solver result plus the element symbol and configuration.
 */
export function solveAtom(atomicNumberZ, options = {}) {
  const gridPointsN = options.gridPointsN ?? Math.round(1200 + 12 * atomicNumberZ);
  const rMaxBohr = options.rMaxBohr ?? Math.max(20, 60 / Math.sqrt(atomicNumberZ));
  if (options.spinPolarized) {
    const spinConfiguration = options.spinConfiguration ?? spinElectronConfiguration(atomicNumberZ);
    const result = solveKohnShamAtomLSDA({ atomicNumberZ, spinConfiguration, gridPointsN, rMaxBohr, ...options });
    return { symbol: symbolForZ(atomicNumberZ), spinConfiguration, ...result };
  }
  const configuration = options.configuration ?? electronConfiguration(atomicNumberZ);
  if (options.scalarRelativistic) {
    const result = solveKohnShamAtomKH({ atomicNumberZ, configuration, gridPointsN, rMaxBohr, ...options });
    return { symbol: symbolForZ(atomicNumberZ), configuration, ...result };
  }
  const result = solveKohnShamAtomLog({ atomicNumberZ, configuration, gridPointsN, rMaxBohr, ...options });
  return { symbol: symbolForZ(atomicNumberZ), configuration, ...result };
}
