// Minimal Kohn–Sham density-functional theory: a radial (spherically symmetric) atomic solver
// with LDA exchange-correlation. This is the real KS machinery — self-consistent orbitals in an
// effective potential (nuclear + Hartree + exchange-correlation) — not a model. Atomic DFT is
// also how pseudopotentials for periodic-solid DFT are generated, so this is the genuine
// foundation of the path to iron (transition-metal / periodic systems the jellium model cannot
// reach).
//
// Reuses the uniform-electron-gas LDA energy density (uniformElectronGas.js). Atomic units.

import { numberDensityFromRs, uegEnergyPerElectronHa, wignerSeitzRadius } from './uniformElectronGas.js';

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

/**
 * The k lowest eigenpairs of a symmetric tridiagonal matrix (diag d, sub/super-diagonal off,
 * length n-1): eigenvalues by Sturm-sequence bisection, eigenvectors by inverse iteration.
 */
function lowestEigenpairs(diag, off, k, h) {
  const n = diag.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i += 1) {
    const radius = Math.abs(i > 0 ? off[i - 1] : 0) + Math.abs(i < n - 1 ? off[i] : 0);
    lo = Math.min(lo, diag[i] - radius);
    hi = Math.max(hi, diag[i] + radius);
  }
  const pairs = [];
  for (let m = 1; m <= k; m += 1) {
    let a = lo;
    let b = hi;
    for (let iter = 0; iter < 120; iter += 1) {
      const mid = 0.5 * (a + b);
      if (sturmCount(diag, off, mid) >= m) b = mid; else a = mid;
    }
    const value = 0.5 * (a + b);
    // Eigenvector by inverse iteration at a shift just off the eigenvalue.
    const shift = value - 1e-7 * (Math.abs(value) + 1);
    const shifted = new Float64Array(n);
    for (let i = 0; i < n; i += 1) shifted[i] = diag[i] - shift;
    let v = new Float64Array(n);
    for (let i = 0; i < n; i += 1) v[i] = Math.sin(((m) * Math.PI * (i + 1)) / (n + 1));
    for (let iter = 0; iter < 12; iter += 1) {
      const y = solveTridiagonal(shifted, off, v);
      // Orthogonalize against already-found lower eigenvectors (∫ dr weight = h).
      for (const prev of pairs) {
        let dot = 0;
        for (let i = 0; i < n; i += 1) dot += y[i] * prev.u[i] * h;
        for (let i = 0; i < n; i += 1) y[i] -= dot * prev.u[i];
      }
      let norm = 0;
      for (let i = 0; i < n; i += 1) norm += y[i] * y[i] * h;
      norm = Math.sqrt(norm);
      for (let i = 0; i < n; i += 1) v[i] = y[i] / norm;
    }
    if (v[1] < 0) for (let i = 0; i < n; i += 1) v[i] = -v[i];
    pairs.push({ energyHa: value, u: v });
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
