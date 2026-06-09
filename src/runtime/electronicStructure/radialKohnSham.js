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
