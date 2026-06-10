// General molecular electronic-structure engine: restricted Hartree–Fock (RHF) with a Gaussian
// basis, McMurchie–Davidson integrals. This is the bonding/reactions engine — for any set of nuclei
// it solves the Born–Oppenheimer electronic energy E(R), from which bonding emerges (minima of E(R)
// at finite separation) and reactions emerge (motion on the surface; bonds break/form as nuclei
// rearrange). It also gives the atomization energy (E[molecule] − Σ E[atoms]), the reference the
// material closures need for cohesion / melting / latent heats.
//
// Not a model of bonding — the actual electronic Schrödinger equation in the HF (mean-field)
// approximation. STO-3G minimal basis; everything (integrals, SCF) is first-principles. Atomic
// units throughout. Evidence-only: HF/STO-3G is a known approximation, so callers keep validation
// false until checked against measured/correlated references.

// ---- small dense symmetric eigensolver (Jacobi) ----------------------------------------------
function jacobiEigh(Ain, n) {
  const A = Ain.map((row) => row.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < n; i += 1) {
          const aip = A[i][p];
          const aiq = A[i][q];
          A[i][p] = c * aip - s * aiq;
          A[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < n; i += 1) {
          const api = A[p][i];
          const aqi = A[q][i];
          A[p][i] = c * api - s * aqi;
          A[q][i] = s * api + c * aqi;
        }
        for (let i = 0; i < n; i += 1) {
          const vip = V[i][p];
          const viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const vals = A.map((row, i) => row[i]);
  return { values: vals, vectors: V }; // vectors[i][k] = i-th component of eigenvector k
}

// ---- Boys function F_0..F_nmax ---------------------------------------------------------------
function boys(nmax, x) {
  const F = new Array(nmax + 1);
  if (x < 1e-12) {
    for (let m = 0; m <= nmax; m += 1) F[m] = 1 / (2 * m + 1);
    return F;
  }
  if (x > 30) {
    F[0] = 0.5 * Math.sqrt(Math.PI / x);
    const ex = Math.exp(-x);
    for (let m = 1; m <= nmax; m += 1) F[m] = ((2 * m - 1) * F[m - 1] - ex) / (2 * x);
    return F;
  }
  // F_nmax by series, then stable downward recursion.
  let term = 1 / (2 * nmax + 1);
  let sum = term;
  for (let k = 1; k < 300; k += 1) {
    term *= (-x / k) * (2 * nmax + 2 * k - 1) / (2 * nmax + 2 * k + 1);
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  F[nmax] = sum;
  const ex = Math.exp(-x);
  for (let m = nmax - 1; m >= 0; m -= 1) F[m] = (2 * x * F[m + 1] + ex) / (2 * m + 1);
  return F;
}

// ---- McMurchie–Davidson Hermite expansion coefficients E^{ij}_t (one axis) --------------------
function hermiteE(i, j, t, Qx, a, b) {
  const p = a + b;
  const q = (a * b) / p;
  if (t < 0 || t > i + j) return 0;
  if (i === 0 && j === 0 && t === 0) return Math.exp(-q * Qx * Qx);
  if (j === 0) {
    // decrement i
    return (1 / (2 * p)) * hermiteE(i - 1, j, t - 1, Qx, a, b)
      - (q * Qx / a) * hermiteE(i - 1, j, t, Qx, a, b)
      + (t + 1) * hermiteE(i - 1, j, t + 1, Qx, a, b);
  }
  // decrement j
  return (1 / (2 * p)) * hermiteE(i, j - 1, t - 1, Qx, a, b)
    + (q * Qx / b) * hermiteE(i, j - 1, t, Qx, a, b)
    + (t + 1) * hermiteE(i, j - 1, t + 1, Qx, a, b);
}

// ---- Hermite Coulomb integral R^n_{tuv} ------------------------------------------------------
function hermiteR(t, u, v, n, p, PCx, PCy, PCz, F) {
  if (t === 0 && u === 0 && v === 0) return ((-2 * p) ** n) * F[n];
  if (t > 0) {
    return (t - 1 > 0 ? (t - 1) * hermiteR(t - 2, u, v, n + 1, p, PCx, PCy, PCz, F) : 0)
      + PCx * hermiteR(t - 1, u, v, n + 1, p, PCx, PCy, PCz, F);
  }
  if (u > 0) {
    return (u - 1 > 0 ? (u - 1) * hermiteR(t, u - 2, v, n + 1, p, PCx, PCy, PCz, F) : 0)
      + PCy * hermiteR(t, u - 1, v, n + 1, p, PCx, PCy, PCz, F);
  }
  return (v - 1 > 0 ? (v - 1) * hermiteR(t, u, v - 2, n + 1, p, PCx, PCy, PCz, F) : 0)
    + PCz * hermiteR(t, u, v - 1, n + 1, p, PCx, PCy, PCz, F);
}

const gaussianProduct = (a, A, b, B) => [(a * A[0] + b * B[0]) / (a + b), (a * A[1] + b * B[1]) / (a + b), (a * A[2] + b * B[2]) / (a + b)];

// ---- primitive integrals (raw, no normalization; normalization folded into contraction coefs) --
function primitiveOverlap(a, la, A, b, lb, B) {
  const p = a + b;
  const Sx = hermiteE(la[0], lb[0], 0, A[0] - B[0], a, b);
  const Sy = hermiteE(la[1], lb[1], 0, A[1] - B[1], a, b);
  const Sz = hermiteE(la[2], lb[2], 0, A[2] - B[2], a, b);
  return Sx * Sy * Sz * (Math.PI / p) ** 1.5;
}

function primitiveKinetic(a, la, A, b, lb, B) {
  const [l, m, n] = lb;
  const term0 = b * (2 * (l + m + n) + 3) * primitiveOverlap(a, la, A, b, lb, B);
  const term1 = -2 * b * b * (
    primitiveOverlap(a, la, A, b, [l + 2, m, n], B)
    + primitiveOverlap(a, la, A, b, [l, m + 2, n], B)
    + primitiveOverlap(a, la, A, b, [l, m, n + 2], B));
  const term2 = -0.5 * (
    l * (l - 1) * primitiveOverlap(a, la, A, b, [l - 2, m, n], B)
    + m * (m - 1) * primitiveOverlap(a, la, A, b, [l, m - 2, n], B)
    + n * (n - 1) * primitiveOverlap(a, la, A, b, [l, m, n - 2], B));
  return term0 + term1 + term2;
}

function primitiveNuclear(a, la, A, b, lb, B, C) {
  const p = a + b;
  const P = gaussianProduct(a, A, b, B);
  const PCx = P[0] - C[0];
  const PCy = P[1] - C[1];
  const PCz = P[2] - C[2];
  const RPC2 = PCx * PCx + PCy * PCy + PCz * PCz;
  const F = boys(la[0] + la[1] + la[2] + lb[0] + lb[1] + lb[2], p * RPC2);
  let val = 0;
  for (let t = 0; t <= la[0] + lb[0]; t += 1) {
    const Ex = hermiteE(la[0], lb[0], t, A[0] - B[0], a, b);
    for (let u = 0; u <= la[1] + lb[1]; u += 1) {
      const Ey = hermiteE(la[1], lb[1], u, A[1] - B[1], a, b);
      for (let v = 0; v <= la[2] + lb[2]; v += 1) {
        const Ez = hermiteE(la[2], lb[2], v, A[2] - B[2], a, b);
        val += Ex * Ey * Ez * hermiteR(t, u, v, 0, p, PCx, PCy, PCz, F);
      }
    }
  }
  return (2 * Math.PI / p) * val;
}

function primitiveERI(a, la, A, b, lb, B, c, lc, C, d, ld, D) {
  const p = a + b;
  const q = c + d;
  const P = gaussianProduct(a, A, b, B);
  const Q = gaussianProduct(c, C, d, D);
  const alpha = (p * q) / (p + q);
  const PQx = P[0] - Q[0];
  const PQy = P[1] - Q[1];
  const PQz = P[2] - Q[2];
  const RPQ2 = PQx * PQx + PQy * PQy + PQz * PQz;
  const ltot = la[0] + la[1] + la[2] + lb[0] + lb[1] + lb[2] + lc[0] + lc[1] + lc[2] + ld[0] + ld[1] + ld[2];
  const F = boys(ltot, alpha * RPQ2);
  let val = 0;
  for (let t = 0; t <= la[0] + lb[0]; t += 1) {
    const E1x = hermiteE(la[0], lb[0], t, A[0] - B[0], a, b);
    for (let u = 0; u <= la[1] + lb[1]; u += 1) {
      const E1y = hermiteE(la[1], lb[1], u, A[1] - B[1], a, b);
      for (let v = 0; v <= la[2] + lb[2]; v += 1) {
        const E1z = hermiteE(la[2], lb[2], v, A[2] - B[2], a, b);
        const e1 = E1x * E1y * E1z;
        if (e1 === 0) continue;
        for (let tau = 0; tau <= lc[0] + ld[0]; tau += 1) {
          const E2x = hermiteE(lc[0], ld[0], tau, C[0] - D[0], c, d);
          for (let nu = 0; nu <= lc[1] + ld[1]; nu += 1) {
            const E2y = hermiteE(lc[1], ld[1], nu, C[1] - D[1], c, d);
            for (let phi = 0; phi <= lc[2] + ld[2]; phi += 1) {
              const E2z = hermiteE(lc[2], ld[2], phi, C[2] - D[2], c, d);
              const sign = ((tau + nu + phi) % 2 === 0) ? 1 : -1;
              val += e1 * E2x * E2y * E2z * sign * hermiteR(t + tau, u + nu, v + phi, 0, alpha, PQx, PQy, PQz, F);
            }
          }
        }
      }
    }
  }
  return val * 2 * (Math.PI ** 2.5) / (p * q * Math.sqrt(p + q));
}

// ---- contracted basis functions over raw primitives -------------------------------------------
function doubleFactorial(n) {
  if (n <= 0) return 1;
  let r = 1;
  for (let k = n; k > 0; k -= 2) r *= k;
  return r;
}
function primitiveNorm(alpha, lmn) {
  const [l, m, n] = lmn;
  return Math.sqrt(((2 * alpha / Math.PI) ** 1.5) * ((4 * alpha) ** (l + m + n)) / (doubleFactorial(2 * l - 1) * doubleFactorial(2 * m - 1) * doubleFactorial(2 * n - 1)));
}

// A contracted basis function: center, Cartesian powers lmn, primitive exponents, and coefficients
// that already include the primitive normalization and the overall contraction normalization.
function makeBasisFunction(center, lmn, exps, contractionCoeffs) {
  const coeffs = exps.map((al, k) => contractionCoeffs[k] * primitiveNorm(al, lmn));
  // Contraction normalization so <φ|φ> = 1.
  let norm = 0;
  for (let i = 0; i < exps.length; i += 1) {
    for (let j = 0; j < exps.length; j += 1) {
      norm += coeffs[i] * coeffs[j] * primitiveOverlap(exps[i], lmn, center, exps[j], lmn, center);
    }
  }
  const scale = 1 / Math.sqrt(norm);
  return { center, lmn, exps, coeffs: coeffs.map((c) => c * scale) };
}

// contract a primitive integral function over two basis functions
function contract2(fnA, fnB, prim) {
  let s = 0;
  for (let i = 0; i < fnA.exps.length; i += 1) {
    for (let j = 0; j < fnB.exps.length; j += 1) {
      s += fnA.coeffs[i] * fnB.coeffs[j] * prim(fnA.exps[i], fnA.lmn, fnA.center, fnB.exps[j], fnB.lmn, fnB.center);
    }
  }
  return s;
}

// ---- STO-3G minimal basis (standard exponents/contraction coefficients) -----------------------
const SP_2S = [-0.09996723, 0.39951283, 0.70011547];
const SP_2P = [0.15591627, 0.60768372, 0.39195739];
const S_1S = [0.15432897, 0.53532814, 0.44463454];
// Each element: list of shells {l: 's'|'sp', exps, sCoef, (pCoef)}.
const STO3G = {
  1: [{ l: 's', exps: [3.42525091, 0.62391373, 0.16885540], sCoef: S_1S }],
  2: [{ l: 's', exps: [6.36242139, 1.15892300, 0.31364979], sCoef: S_1S }],
  6: [
    { l: 's', exps: [71.6168370, 13.0450960, 3.5305122], sCoef: S_1S },
    { l: 'sp', exps: [2.9412494, 0.6834831, 0.2222899], sCoef: SP_2S, pCoef: SP_2P }
  ],
  7: [
    { l: 's', exps: [99.1061690, 18.0523120, 4.8856602], sCoef: S_1S },
    { l: 'sp', exps: [3.7804559, 0.8784966, 0.2857144], sCoef: SP_2S, pCoef: SP_2P }
  ],
  8: [
    { l: 's', exps: [130.7093200, 23.8088610, 6.4436083], sCoef: S_1S },
    { l: 'sp', exps: [5.0331513, 1.1695961, 0.3803890], sCoef: SP_2S, pCoef: SP_2P }
  ]
};

const P_DIRECTIONS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Build the contracted basis functions for a molecule (atoms: [{ Z, position:[x,y,z] }], Bohr). */
export function buildBasis(atoms) {
  const basis = [];
  for (const atom of atoms) {
    const shells = STO3G[atom.Z];
    if (!shells) throw new Error(`No STO-3G basis for Z=${atom.Z} (have H,He,C,N,O)`);
    for (const shell of shells) {
      basis.push(makeBasisFunction(atom.position, [0, 0, 0], shell.exps, shell.sCoef));
      if (shell.l === 'sp') {
        for (const dir of P_DIRECTIONS) basis.push(makeBasisFunction(atom.position, dir, shell.exps, shell.pCoef));
      }
    }
  }
  return basis;
}

function matrixInverseSqrt(S, n) {
  const { values, vectors } = jacobiEigh(S, n);
  const X = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < n; k += 1) s += vectors[i][k] * vectors[j][k] / Math.sqrt(values[k]);
      X[i][j] = s;
    }
  }
  return X;
}

/**
 * Restricted Hartree–Fock for a closed-shell molecule. `atoms` = [{ Z, position (Bohr) }].
 * Returns the total Born–Oppenheimer energy (electronic + nuclear repulsion) and diagnostics.
 */
export function rhf(atoms, { charge = 0, maxIter = 200, tol = 1e-8, damping = 0.5 } = {}) {
  const basis = buildBasis(atoms);
  const n = basis.length;
  const nElectrons = atoms.reduce((s, a) => s + a.Z, 0) - charge;
  if (nElectrons % 2 !== 0) throw new Error('RHF requires an even electron count (closed shell)');
  const nOcc = nElectrons / 2;

  // One-electron matrices.
  const S = Array.from({ length: n }, () => new Array(n).fill(0));
  const Hcore = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      S[i][j] = contract2(basis[i], basis[j], primitiveOverlap);
      let v = contract2(basis[i], basis[j], primitiveKinetic);
      for (const atom of atoms) {
        v += -atom.Z * contract2(basis[i], basis[j], (a, la, A, b, lb, B) => primitiveNuclear(a, la, A, b, lb, B, atom.position));
      }
      Hcore[i][j] = v;
    }
  }

  // Two-electron integrals (chemist notation (ij|kl)), 8-fold symmetry.
  const eri = new Float64Array(n * n * n * n);
  const idx = (i, j, k, l) => ((i * n + j) * n + k) * n + l;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      for (let k = 0; k < n; k += 1) {
        for (let l = 0; l <= k; l += 1) {
          if (i * (i + 1) / 2 + j < k * (k + 1) / 2 + l) continue;
          const val = contract2Eri(basis[i], basis[j], basis[k], basis[l]);
          for (const [a, b, c, d] of [[i, j, k, l], [j, i, k, l], [i, j, l, k], [j, i, l, k], [k, l, i, j], [l, k, i, j], [k, l, j, i], [l, k, j, i]]) {
            eri[idx(a, b, c, d)] = val;
          }
        }
      }
    }
  }

  const X = matrixInverseSqrt(S, n);
  let P = Array.from({ length: n }, () => new Array(n).fill(0)); // density (core guess: zero)
  let energy = 0;
  let lastEnergy = Infinity;
  for (let iter = 0; iter < maxIter; iter += 1) {
    // Fock matrix.
    const Fock = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        let g = 0;
        for (let k = 0; k < n; k += 1) for (let l = 0; l < n; l += 1) g += P[k][l] * (eri[idx(i, j, l, k)] - 0.5 * eri[idx(i, k, l, j)]);
        Fock[i][j] = Hcore[i][j] + g;
      }
    }
    // F' = X^T F X ; diagonalize.
    const Fp = matMul(matMul(transpose(X, n), Fock, n), X, n);
    const { values, vectors } = jacobiEigh(Fp, n);
    const order = values.map((e, i) => i).sort((p2, q2) => values[p2] - values[q2]);
    // C = X C' (occupied orbitals = lowest nOcc).
    const C = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let a = 0; a < n; a += 1) {
        let s = 0;
        for (let k = 0; k < n; k += 1) s += X[i][k] * vectors[k][order[a]];
        C[i][a] = s;
      }
    }
    // New density.
    const Pnew = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let a = 0; a < nOcc; a += 1) s += C[i][a] * C[j][a];
      Pnew[i][j] = 2 * s;
    }
    // Electronic energy (from the new density and the Fock built from the old density).
    let eElec = 0;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) eElec += 0.5 * Pnew[i][j] * (Hcore[i][j] + Fock[i][j]);
    // Linear density damping stabilizes hard SCF cases (multiple/near-degenerate bonds) without
    // changing the converged solution.
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) P[i][j] = damping * Pnew[i][j] + (1 - damping) * P[i][j];
    energy = eElec;
    if (Math.abs(energy - lastEnergy) < tol && iter > 2) break;
    lastEnergy = energy;
  }

  const nuclearRepulsion = nuclearRepulsionEnergy(atoms);
  return { totalEnergyHa: energy + nuclearRepulsion, electronicEnergyHa: energy, nuclearRepulsionHa: nuclearRepulsion, nBasis: n, nElectrons };
}

function contract2Eri(fa, fb, fc, fd) {
  let s = 0;
  for (let i = 0; i < fa.exps.length; i += 1) for (let j = 0; j < fb.exps.length; j += 1) {
    for (let k = 0; k < fc.exps.length; k += 1) for (let l = 0; l < fd.exps.length; l += 1) {
      s += fa.coeffs[i] * fb.coeffs[j] * fc.coeffs[k] * fd.coeffs[l]
        * primitiveERI(fa.exps[i], fa.lmn, fa.center, fb.exps[j], fb.lmn, fb.center, fc.exps[k], fc.lmn, fc.center, fd.exps[l], fd.lmn, fd.center);
    }
  }
  return s;
}

function nuclearRepulsionEnergy(atoms) {
  let e = 0;
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const dx = atoms[i].position[0] - atoms[j].position[0];
      const dy = atoms[i].position[1] - atoms[j].position[1];
      const dz = atoms[i].position[2] - atoms[j].position[2];
      e += (atoms[i].Z * atoms[j].Z) / Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return e;
}

const transpose = (M, n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => M[j][i]));
function matMul(A, B, n) {
  const C = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) for (let k = 0; k < n; k += 1) {
    const aik = A[i][k];
    if (aik === 0) continue;
    for (let j = 0; j < n; j += 1) C[i][j] += aik * B[k][j];
  }
  return C;
}

/**
 * Bonding curve of a diatomic: total energy vs internuclear distance. The bond emerges as the
 * minimum (equilibrium bond length + well), with repulsion at short R and dissociation at long R —
 * not scripted, it falls out of the electronic energy.
 */
export function diatomicCurve(Z1, Z2, distancesBohr, options = {}) {
  const curve = distancesBohr.map((R) => ({ R, energyHa: rhf([{ Z: Z1, position: [0, 0, 0] }, { Z: Z2, position: [0, 0, R] }], options).totalEnergyHa }));
  const min = curve.reduce((m, p) => (p.energyHa < m.energyHa ? p : m), curve[0]);
  return { curve, equilibriumRBohr: min.R, minEnergyHa: min.energyHa };
}

/**
 * Reaction energy ΔE = Σ E(products) − Σ E(reactants) for closed-shell species at given geometries.
 * This is a chemical reaction's energetics from first principles — bonds break and form between the
 * reactant and product structures and the energy difference comes straight out of the solver.
 * (`reactants`/`products` are arrays of molecules; each molecule is an atoms list [{Z, position}].)
 */
export function reactionEnergyHa(reactants, products, options = {}) {
  const sum = (mols) => mols.reduce((s, mol) => s + rhf(mol, options).totalEnergyHa, 0);
  // Atom-conservation guard: a reaction must not create or destroy nuclei.
  const tally = (mols) => mols.flat().reduce((m, a) => ((m[a.Z] = (m[a.Z] || 0) + 1), m), {});
  const tr = tally(reactants);
  const tp = tally(products);
  for (const z of new Set([...Object.keys(tr), ...Object.keys(tp)])) {
    if ((tr[z] || 0) !== (tp[z] || 0)) throw new Error(`reaction not balanced for Z=${z}`);
  }
  return sum(products) - sum(reactants);
}

export { jacobiEigh, boys, hermiteE, hermiteR, primitiveOverlap, primitiveKinetic, primitiveNuclear, primitiveERI, makeBasisFunction, contract2 };
