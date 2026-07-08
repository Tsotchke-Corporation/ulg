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

import { unpairedElectronCount, ATOMIC_MASS_U } from './periodicTable.js';

const AMU_TO_ELECTRON_MASS = 1822.888486;
const HARTREE_TO_CM1 = 219474.6313705; // ħω [Hartree] -> wavenumber [cm^-1]

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
  // The alternating series below loses precision catastrophically for
  // x >~ 16 (0.5% at x=25, 60% at x=29 - verified against quadrature): the
  // terms grow ~e^x before decaying, exhausting double precision. The
  // asymptotic branch is accurate to <2e-8 from x=16 up (erf(4) ~ 1-2e-8),
  // so cross over there. This was the root cause of the jagged CO2 PES:
  // its O-O ERI arguments land in [16, 30] where H2O's never do.
  if (x > 16) {
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
// Universal STO-3G contraction coefficients (shared across all elements): the n=1/2/3 s and 2/3 p
// fits. Exponents are element-specific (sourced from the Basis Set Exchange, STO-3G, verbatim).
const S_1S = [0.15432897, 0.53532814, 0.44463454];
const SP_2S = [-0.09996723, 0.39951283, 0.70011547];
const SP_2P = [0.15591627, 0.60768372, 0.39195739];
const SP_3S = [-0.2196203690, 0.2255954336, 0.9003984260];
const SP_3P = [0.0105876043, 0.5951670053, 0.4620010120];
// Each element: list of shells {l: 's'|'sp', exps, sCoef, (pCoef)}. Coverage: H, He (period 1),
// Li–Ne (period 2), Na–Ar (period 3). An 'sp' shell shares one exponent set for its s and p.
const STO3G = {
  1: [{ l: 's', exps: [3.42525091, 0.62391373, 0.16885540], sCoef: S_1S }],
  2: [{ l: 's', exps: [6.36242139, 1.15892300, 0.31364979], sCoef: S_1S }],
  3: [
    { l: 's', exps: [16.11957475, 2.936200663, 0.7946504870], sCoef: S_1S },
    { l: 'sp', exps: [0.6362897469, 0.1478600533, 0.04808867840], sCoef: SP_2S, pCoef: SP_2P }
  ],
  4: [
    { l: 's', exps: [30.16787069, 5.495115306, 1.487192653], sCoef: S_1S },
    { l: 'sp', exps: [1.314833110, 0.3055389383, 0.09937074560], sCoef: SP_2S, pCoef: SP_2P }
  ],
  5: [
    { l: 's', exps: [48.79111318, 8.887362172, 2.405267040], sCoef: S_1S },
    { l: 'sp', exps: [2.236956142, 0.5198204999, 0.1690617600], sCoef: SP_2S, pCoef: SP_2P }
  ],
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
  ],
  9: [
    { l: 's', exps: [166.6791340, 30.36081233, 8.216820672], sCoef: S_1S },
    { l: 'sp', exps: [6.464803249, 1.502281245, 0.4885884864], sCoef: SP_2S, pCoef: SP_2P }
  ],
  10: [
    { l: 's', exps: [207.0156070, 37.70815124, 10.20529731], sCoef: S_1S },
    { l: 'sp', exps: [8.246315120, 1.916266291, 0.6232292721], sCoef: SP_2S, pCoef: SP_2P }
  ],
  11: [
    { l: 's', exps: [250.7724300, 45.67851117, 12.36238776], sCoef: S_1S },
    { l: 'sp', exps: [12.04019274, 2.797881859, 0.9099580170], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [1.478740622, 0.4125648801, 0.1614750979], sCoef: SP_3S, pCoef: SP_3P }
  ],
  12: [
    { l: 's', exps: [299.2374137, 54.50646845, 14.75157752], sCoef: S_1S },
    { l: 'sp', exps: [15.12182352, 3.513986579, 1.142857498], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [1.395448293, 0.3893265318, 0.1523797659], sCoef: SP_3S, pCoef: SP_3P }
  ],
  13: [
    { l: 's', exps: [351.4214767, 64.01186067, 17.32410761], sCoef: S_1S },
    { l: 'sp', exps: [18.89939621, 4.391813233, 1.428353970], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [1.395448293, 0.3893265318, 0.1523797659], sCoef: SP_3S, pCoef: SP_3P }
  ],
  14: [
    { l: 's', exps: [407.7975514, 74.28083305, 20.10329229], sCoef: S_1S },
    { l: 'sp', exps: [23.19365606, 5.389706871, 1.752899952], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [1.478740622, 0.4125648801, 0.1614750979], sCoef: SP_3S, pCoef: SP_3P }
  ],
  15: [
    { l: 's', exps: [468.3656378, 85.31338559, 23.08913156], sCoef: S_1S },
    { l: 'sp', exps: [28.03263958, 6.514182577, 2.118614352], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [1.743103231, 0.4863213771, 0.1903428909], sCoef: SP_3S, pCoef: SP_3P }
  ],
  16: [
    { l: 's', exps: [533.1257359, 97.10951830, 26.28162542], sCoef: S_1S },
    { l: 'sp', exps: [33.32975173, 7.745117521, 2.518952599], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [2.029194274, 0.5661400518, 0.2215833792], sCoef: SP_3S, pCoef: SP_3P }
  ],
  17: [
    { l: 's', exps: [601.3456136, 109.5358542, 29.64467686], sCoef: S_1S },
    { l: 'sp', exps: [38.96041889, 9.053563477, 2.944499834], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [2.129386495, 0.5940934274, 0.2325241410], sCoef: SP_3S, pCoef: SP_3P }
  ],
  18: [
    { l: 's', exps: [674.4465184, 122.8512753, 33.24834945], sCoef: S_1S },
    { l: 'sp', exps: [45.16424392, 10.49519900, 3.413364448], sCoef: SP_2S, pCoef: SP_2P },
    { l: 'sp', exps: [2.621366518, 0.7313546050, 0.2862472356], sCoef: SP_3S, pCoef: SP_3P }
  ]
};

const P_DIRECTIONS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Build the contracted basis functions for a molecule (atoms: [{ Z, position:[x,y,z] }], Bohr). */
export function buildBasis(atoms) {
  const basis = [];
  atoms.forEach((atom, atomIndex) => {
    const shells = STO3G[atom.Z];
    if (!shells) throw new Error(`No STO-3G basis for Z=${atom.Z} (have Z=1-18: H–Ar)`);
    for (const shell of shells) {
      const s = makeBasisFunction(atom.position, [0, 0, 0], shell.exps, shell.sCoef);
      s.atomIndex = atomIndex;
      basis.push(s);
      if (shell.l === 'sp') {
        for (const dir of P_DIRECTIONS) {
          const p = makeBasisFunction(atom.position, dir, shell.exps, shell.pCoef);
          p.atomIndex = atomIndex;
          basis.push(p);
        }
      }
    }
  });
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

// Build the basis, one-electron matrices (S, Hcore), the two-electron integrals, S^{-1/2}, and the
// nuclear repulsion for a molecule — shared by the RHF and UHF drivers.
function buildIntegrals(atoms, charge) {
  const basis = buildBasis(atoms);
  const n = basis.length;
  const nElectrons = atoms.reduce((s, a) => s + a.Z, 0) - charge;
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
  return { basis, n, nElectrons, S, Hcore, eri, idx, X: matrixInverseSqrt(S, n), nuclearRepulsion: nuclearRepulsionEnergy(atoms) };
}

// Diagonalize a Fock matrix in the orthonormal basis and return the orbital coefficients (columns
// ordered by ascending orbital energy).
function solveFock(Fock, X, n) {
  const Fp = matMul(matMul(transpose(X, n), Fock, n), X, n);
  const { values, vectors } = jacobiEigh(Fp, n);
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const C = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < n; a += 1) {
      let s = 0;
      for (let k = 0; k < n; k += 1) s += X[i][k] * vectors[k][order[a]];
      C[i][a] = s;
    }
  }
  return { C, epsilon: order.map((o) => values[o]) };
}

/**
 * Restricted Hartree–Fock for a closed-shell molecule. `atoms` = [{ Z, position (Bohr) }].
 * Returns the total Born–Oppenheimer energy (electronic + nuclear repulsion) and diagnostics.
 */
// ---- DIIS (Pulay) SCF acceleration --------------------------------------
// Error vector e = FPS - SPF vanishes at SCF convergence; extrapolating the
// Fock matrix from the history that minimizes |e| stabilizes the iteration
// path (the plain damped fixed point can hop between electronic roots as
// geometry changes - seen on the linear-CO2 scan).
function solveLinearSystem(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-14) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c += 1) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

function diisErrorMatrix(Fock, P, S, n) {
  const FP = matMul(Fock, P, n);
  const FPS = matMul(FP, S, n);
  const SP = matMul(S, P, n);
  const SPF = matMul(SP, Fock, n);
  const error = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) error[i][j] = FPS[i][j] - SPF[i][j];
  return error;
}

function diisExtrapolateFock(fockHistory, errorHistory, n) {
  const m = fockHistory.length;
  if (m < 2) return null;
  const B = Array.from({ length: m + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let dot = 0;
      const ei = errorHistory[i];
      const ej = errorHistory[j];
      for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) dot += ei[a][b] * ej[a][b];
      B[i][j] = dot;
      B[j][i] = dot;
    }
    B[i][m] = -1;
    B[m][i] = -1;
  }
  const rhs = new Array(m + 1).fill(0);
  rhs[m] = -1;
  const solution = solveLinearSystem(B, rhs);
  if (!solution) return null;
  const F = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let k = 0; k < m; k += 1) {
    const c = solution[k];
    const Fk = fockHistory[k];
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) F[i][j] += c * Fk[i][j];
  }
  return F;
}

// Maximum-overlap occupied-orbital selection (MOM): occupy the nOcc new
// orbitals with the largest projection onto a REFERENCE occupied subspace
// instead of the lowest-eigenvalue (aufbau) set. Along a geometry scan,
// aufbau switches electronic states whenever orbital ordering swaps -
// the converged-yet-discontinuous CO2 PES - while MOM follows one state.
function momOccupiedIndices(C, S, referenceOccupiedC, n, nOcc) {
  const overlaps = new Array(n).fill(0);
  for (let a = 0; a < n; a += 1) {
    let total = 0;
    for (let r = 0; r < referenceOccupiedC[0].length; r += 1) {
      let dot = 0;
      for (let i = 0; i < n; i += 1) {
        let sc = 0;
        for (let j = 0; j < n; j += 1) sc += S[i][j] * C[j][a];
        dot += referenceOccupiedC[i][r] * sc;
      }
      total += dot * dot;
    }
    overlaps[a] = total;
  }
  return overlaps
    .map((value, index) => [value, index])
    .sort((x, y) => y[0] - x[0])
    .slice(0, nOcc)
    .map(([, index]) => index)
    .sort((x, y) => x - y);
}

export function rhf(atoms, { charge = 0, maxIter = 200, tol = 1e-8, damping = 0.5, initialP = null, referenceOccupiedC = null } = {}) {
  const { basis, n, nElectrons, S, Hcore, eri, idx, X, nuclearRepulsion } = buildIntegrals(atoms, charge);
  if (nElectrons % 2 !== 0) throw new Error('RHF requires an even electron count (closed shell)');
  const nOcc = nElectrons / 2;
  // Warm start: seeding SCF with a converged density from a NEIGHBORING
  // geometry keeps the iteration on the same electronic root. From the cold
  // core guess, nearby geometries can converge to different SCF solutions
  // (0.4 Ha discontinuities seen on the linear-CO2 scan), which poisons any
  // finite-difference derivative taken across them.
  const warmStart = Array.isArray(initialP) && initialP.length === n;
  let P = warmStart
    ? initialP.map((row) => [...row])
    : Array.from({ length: n }, () => new Array(n).fill(0));
  let energy = 0;
  let scfConverged = false;
  let lastEnergy = Infinity;
  let finalC = null;
  let finalEps = null;
  let finalOccupied = null;
  let finalP = P;
  const fockHistory = [];
  const errorHistory = [];
  const DIIS_MAX_HISTORY = 8;
  for (let iter = 0; iter < maxIter; iter += 1) {
    const Fock = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        let g = 0;
        for (let k = 0; k < n; k += 1) for (let l = 0; l < n; l += 1) g += P[k][l] * (eri[idx(i, j, l, k)] - 0.5 * eri[idx(i, k, l, j)]);
        Fock[i][j] = Hcore[i][j] + g;
      }
    }
    fockHistory.push(Fock.map((row) => [...row]));
    errorHistory.push(diisErrorMatrix(Fock, P, S, n));
    if (fockHistory.length > DIIS_MAX_HISTORY) {
      fockHistory.shift();
      errorHistory.shift();
    }
    const extrapolated = iter >= 2 ? diisExtrapolateFock(fockHistory, errorHistory, n) : null;
    const { C, epsilon } = solveFock(extrapolated || Fock, X, n);
    finalC = C;
    finalEps = epsilon;
    const occupied = Array.isArray(referenceOccupiedC) && referenceOccupiedC.length === n
      ? momOccupiedIndices(C, S, referenceOccupiedC, n, nOcc)
      : null;
    finalOccupied = occupied;
    const Pnew = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < nOcc; k += 1) {
        const a = occupied ? occupied[k] : k;
        s += C[i][a] * C[j][a];
      }
      Pnew[i][j] = 2 * s;
    }
    let eElec = 0;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) eElec += 0.5 * Pnew[i][j] * (Hcore[i][j] + Fock[i][j]);
    finalP = Pnew;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) P[i][j] = damping * Pnew[i][j] + (1 - damping) * P[i][j];
    energy = eElec;
    if (Math.abs(energy - lastEnergy) < tol && iter > 2) { scfConverged = true; break; }
    lastEnergy = energy;
  }
  const occupiedC = finalC
    ? Array.from({ length: n }, (_, i) => Array.from({ length: nOcc }, (_, k) => finalC[i][finalOccupied ? finalOccupied[k] : k]))
    : null;
  return { totalEnergyHa: energy + nuclearRepulsion, electronicEnergyHa: energy, nuclearRepulsionHa: nuclearRepulsion, nBasis: n, nElectrons, nOcc, C: finalC, orbitalEnergies: finalEps, eri, idx, P: finalP, S, basis, scfConverged, occupiedC };
}

/**
 * Unrestricted Hartree–Fock: separate spatial orbitals for α and β spin, so open-shell systems
 * (atoms with unpaired electrons, radicals, stretched bonds) are handled. `nAlpha − nBeta` is set by
 * the spin (default: 2S = number of unpaired electrons inferred from the total-electron parity, or
 * an explicit `multiplicity` = 2S+1). UHF can break spin symmetry, so it dissociates bonds
 * qualitatively correctly where RHF cannot.
 */
export function uhf(atoms, { charge = 0, multiplicity = null, maxIter = 300, tol = 1e-9, damping = 0.6 } = {}) {
  const { n, nElectrons, Hcore, eri, idx, X, nuclearRepulsion } = buildIntegrals(atoms, charge);
  const twoS = multiplicity != null ? multiplicity - 1 : (nElectrons % 2);
  const nAlpha = (nElectrons + twoS) / 2;
  const nBeta = (nElectrons - twoS) / 2;
  if (!Number.isInteger(nAlpha) || nBeta < 0) throw new Error('inconsistent electron count / multiplicity');

  // Spin-broken initial guess: diagonalize Hcore, then occupy. (Pure-Hcore guesses give the same
  // α/β density and never break symmetry, so seed β by skipping its lowest virtual — enough for the
  // SCF to find the broken-symmetry / high-spin solution.)
  const buildDensity = (C, nOcc) => {
    const P = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let a = 0; a < nOcc; a += 1) s += C[i][a] * C[j][a];
      P[i][j] = s;
    }
    return P;
  };
  const { C: Cinit } = solveFock(Hcore, X, n);
  let Pa = buildDensity(Cinit, nAlpha);
  let Pb = buildDensity(Cinit, nBeta);

  let energy = 0;
  let scfConverged = false;
  let lastEnergy = Infinity;
  for (let iter = 0; iter < maxIter; iter += 1) {
    const Ptot = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Pa[i][j] + Pb[i][j]));
    const Fa = Array.from({ length: n }, () => new Array(n).fill(0));
    const Fb = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        let coul = 0;
        let exa = 0;
        let exb = 0;
        for (let k = 0; k < n; k += 1) for (let l = 0; l < n; l += 1) {
          coul += Ptot[k][l] * eri[idx(i, j, l, k)];
          exa += Pa[k][l] * eri[idx(i, k, l, j)];
          exb += Pb[k][l] * eri[idx(i, k, l, j)];
        }
        Fa[i][j] = Hcore[i][j] + coul - exa;
        Fb[i][j] = Hcore[i][j] + coul - exb;
      }
    }
    const { C: Ca } = solveFock(Fa, X, n);
    const { C: Cb } = solveFock(Fb, X, n);
    const PaNew = buildDensity(Ca, nAlpha);
    const PbNew = buildDensity(Cb, nBeta);
    let eElec = 0;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      eElec += 0.5 * ((PaNew[i][j] + PbNew[i][j]) * Hcore[i][j] + PaNew[i][j] * Fa[i][j] + PbNew[i][j] * Fb[i][j]);
    }
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      Pa[i][j] = damping * PaNew[i][j] + (1 - damping) * Pa[i][j];
      Pb[i][j] = damping * PbNew[i][j] + (1 - damping) * Pb[i][j];
    }
    energy = eElec;
    if (Math.abs(energy - lastEnergy) < tol && iter > 2) { scfConverged = true; break; }
    lastEnergy = energy;
  }
  return { totalEnergyHa: energy + nuclearRepulsion, electronicEnergyHa: energy, nuclearRepulsionHa: nuclearRepulsion, nBasis: n, nElectrons, nAlpha, nBeta, scfConverged };
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

// Four-index AO->MO transformation of the two-electron integrals, by successive quarter-transforms
// (O(N^5)). Returns the MO-basis ERI tensor in chemist notation (pq|rs).
function transformERItoMO(eri, idx, C, n) {
  const N4 = n * n * n * n;
  const moIdx = (p, q, r, s) => ((p * n + q) * n + r) * n + s;
  const a = new Float64Array(N4);
  for (let p = 0; p < n; p += 1) for (let nu = 0; nu < n; nu += 1) for (let la = 0; la < n; la += 1) for (let si = 0; si < n; si += 1) {
    let s = 0; for (let mu = 0; mu < n; mu += 1) s += C[mu][p] * eri[idx(mu, nu, la, si)];
    a[moIdx(p, nu, la, si)] = s;
  }
  const b = new Float64Array(N4);
  for (let p = 0; p < n; p += 1) for (let q = 0; q < n; q += 1) for (let la = 0; la < n; la += 1) for (let si = 0; si < n; si += 1) {
    let s = 0; for (let nu = 0; nu < n; nu += 1) s += C[nu][q] * a[moIdx(p, nu, la, si)];
    b[moIdx(p, q, la, si)] = s;
  }
  const c = new Float64Array(N4);
  for (let p = 0; p < n; p += 1) for (let q = 0; q < n; q += 1) for (let r = 0; r < n; r += 1) for (let si = 0; si < n; si += 1) {
    let s = 0; for (let la = 0; la < n; la += 1) s += C[la][r] * b[moIdx(p, q, la, si)];
    c[moIdx(p, q, r, si)] = s;
  }
  const d = new Float64Array(N4);
  for (let p = 0; p < n; p += 1) for (let q = 0; q < n; q += 1) for (let r = 0; r < n; r += 1) for (let ss = 0; ss < n; ss += 1) {
    let s = 0; for (let si = 0; si < n; si += 1) s += C[si][ss] * c[moIdx(p, q, r, si)];
    d[moIdx(p, q, r, ss)] = s;
  }
  return { mo: d, moIdx };
}

/**
 * Second-order Møller–Plesset (MP2) correlation on top of closed-shell RHF — the leading electron
 * correlation HF leaves out. E_corr = Σ_{ijab} (ia|jb)[2(ia|jb) − (ib|ja)] / (ε_i+ε_j−ε_a−ε_b)
 * (i,j occupied; a,b virtual, in the MO basis). Returns the HF energy, the (negative) correlation
 * energy, and their sum. Closed-shell molecules only (open-shell/atoms need UMP2).
 */
export function mp2(atoms, options = {}) {
  const hf = rhf(atoms, options);
  const { nBasis: n, nOcc, C, orbitalEnergies: eps, eri, idx } = hf;
  const { mo, moIdx } = transformERItoMO(eri, idx, C, n);
  let eCorr = 0;
  for (let i = 0; i < nOcc; i += 1) {
    for (let j = 0; j < nOcc; j += 1) {
      for (let a = nOcc; a < n; a += 1) {
        for (let b = nOcc; b < n; b += 1) {
          const iajb = mo[moIdx(i, a, j, b)];
          const ibja = mo[moIdx(i, b, j, a)];
          eCorr += (iajb * (2 * iajb - ibja)) / (eps[i] + eps[j] - eps[a] - eps[b]);
        }
      }
    }
  }
  return { hfEnergyHa: hf.totalEnergyHa, mp2CorrelationHa: eCorr, totalEnergyHa: hf.totalEnergyHa + eCorr, nBasis: n };
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

/**
 * Ground-state energy (Ha) of a free atom via UHF, with the Hund's-rule spin multiplicity from its
 * electron configuration. This is the atomic reference that bond / atomization / cohesion energies
 * are measured against.
 */
export function atomEnergyHa(Z, options = {}) {
  return uhf([{ Z, position: [0, 0, 0] }], { multiplicity: unpairedElectronCount(Z) + 1, ...options }).totalEnergyHa;
}

/**
 * Atomization energy (Ha, positive = bound): the energy to pull a molecule apart into its free
 * atoms, Σ E(atoms) − E(molecule). This is the bonding reference the material closures need for
 * cohesion / latent heats — derived, not tabulated. `moleculeOptions` (e.g. multiplicity) are
 * passed to the molecular UHF.
 */
export function atomizationEnergyHa(atoms, { moleculeOptions = {}, atomCache = new Map() } = {}) {
  const eMolecule = uhf(atoms, moleculeOptions).totalEnergyHa;
  let eAtoms = 0;
  for (const a of atoms) {
    if (!atomCache.has(a.Z)) atomCache.set(a.Z, atomEnergyHa(a.Z));
    eAtoms += atomCache.get(a.Z);
  }
  return { atomizationEnergyHa: eAtoms - eMolecule, moleculeEnergyHa: eMolecule, atomsEnergyHa: eAtoms };
}

/**
 * Population analysis from a converged RHF wavefunction: Mulliken partial charges and Mayer bond
 * orders — how the electrons are shared, read straight off the density. Pass an `rhf` result and the
 * atom list. Mulliken charge Q_A = Z_A − Σ_{μ∈A}(PS)_μμ; Mayer bond order
 * B_AB = Σ_{μ∈A}Σ_{ν∈B}(PS)_μν(PS)_νμ (≈ the number of shared electron pairs — a triple bond → ~3).
 */
export function populationAnalysis(rhfResult, atoms) {
  const { P, S, basis, nBasis: n } = rhfResult;
  const PS = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
    let s = 0;
    for (let k = 0; k < n; k += 1) s += P[i][k] * S[k][j];
    PS[i][j] = s;
  }
  const charges = atoms.map((a) => a.Z);
  for (let i = 0; i < n; i += 1) charges[basis[i].atomIndex] -= PS[i][i];
  const bondOrders = atoms.map(() => atoms.map(() => 0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const A = basis[i].atomIndex;
      const B = basis[j].atomIndex;
      if (A !== B) bondOrders[A][B] += PS[i][j] * PS[j][i];
    }
  }
  return { charges, bondOrders };
}

// Numerical nuclear gradient dE/dR (central differences). `energyFn` maps a coordinate array
// (array of [x,y,z]) to the total energy.
function nuclearGradient(coords, energyFn, h) {
  const grad = coords.map(() => [0, 0, 0]);
  for (let a = 0; a < coords.length; a += 1) {
    for (let d = 0; d < 3; d += 1) {
      const orig = coords[a][d];
      coords[a][d] = orig + h;
      const ep = energyFn(coords);
      coords[a][d] = orig - h;
      const em = energyFn(coords);
      coords[a][d] = orig;
      grad[a][d] = (ep - em) / (2 * h);
    }
  }
  return grad;
}

/**
 * Optimize a molecular geometry on the Born–Oppenheimer surface: move the nuclei downhill on E(R)
 * (numerical gradient + backtracking line search) to the equilibrium structure. Bond lengths and
 * angles come out of the electronic energy — molecular structure is predicted, not assumed.
 * `method` is the energy model (default closed-shell RHF total energy).
 */
export function optimizeGeometry(atoms, { method = (a) => rhf(a).totalEnergyHa, maxSteps = 80, gradTol = 1.5e-3, h = 1e-3, maxStepBohr = null } = {}) {
  const Zs = atoms.map((a) => a.Z);
  let coords = atoms.map((a) => [...a.position]);
  const E = (cs) => method(cs.map((p, i) => ({ Z: Zs[i], position: p })));
  let energy = E(coords);
  let gradNorm = Infinity;
  let step = 0;
  for (; step < maxSteps; step += 1) {
    const grad = nuclearGradient(coords, E, h);
    gradNorm = Math.max(...grad.flat().map(Math.abs));
    if (gradNorm < gradTol) break;
    // Backtracking line search along the steepest-descent direction. An
    // optional trust radius caps the largest single-step displacement:
    // compressed starting geometries carry huge repulsive gradients, and an
    // uncapped step can eject atoms past the dissociation ridge (seen:
    // CO2 -> O2 + distant C in the vibrations generator). The cap is opt-in
    // because it multiplies step counts - runtime cohesion derivations
    // (cold-start budgets) keep the historical fast behavior.
    let alpha = Number.isFinite(maxStepBohr) && maxStepBohr > 0
      ? Math.min(0.6, maxStepBohr / gradNorm)
      : 0.6;
    let accepted = false;
    for (let bt = 0; bt < 25; bt += 1) {
      const trial = coords.map((p, i) => [p[0] - alpha * grad[i][0], p[1] - alpha * grad[i][1], p[2] - alpha * grad[i][2]]);
      const eTrial = E(trial);
      if (eTrial < energy) { coords = trial; energy = eTrial; accepted = true; break; }
      alpha *= 0.5;
    }
    if (!accepted) break; // converged to numerical-gradient noise floor
  }
  return {
    atoms: coords.map((p, i) => ({ Z: Zs[i], position: p })),
    energyHa: energy,
    gradNorm,
    steps: step,
    converged: gradNorm < gradTol
  };
}

/**
 * Harmonic vibrational frequencies (cm^-1) from the mass-weighted Hessian of E(R). Build the
 * Hessian by central differences of the nuclear gradient, mass-weight (H_ij / sqrt(m_i m_j)),
 * diagonalize, and convert eigenvalues to wavenumbers. At a minimum, 3N−6 (3N−5 for a linear
 * molecule) modes are real vibrations; the rest are near-zero translations/rotations and are
 * dropped. A negative eigenvalue → imaginary frequency (the geometry is a saddle, not a minimum).
 * Should be called on an optimized geometry. This is the molecular link to thermodynamics
 * (zero-point energy, vibrational heat capacity).
 */
export function vibrationalFrequencies(atoms, { method = (a) => rhf(a).totalEnergyHa, h = 5e-3, dropModes = null } = {}) {
  const Zs = atoms.map((a) => a.Z);
  const masses = atoms.map((a) => ATOMIC_MASS_U[a.Z - 1] * AMU_TO_ELECTRON_MASS);
  const m = atoms.length;
  const dim = 3 * m;
  let coords = atoms.map((a) => [...a.position]);
  const E = (cs) => method(cs.map((p, i) => ({ Z: Zs[i], position: p })));
  // Hessian columns from gradient differences.
  const H = Array.from({ length: dim }, () => new Array(dim).fill(0));
  for (let j = 0; j < dim; j += 1) {
    const aj = Math.floor(j / 3);
    const dj = j % 3;
    const orig = coords[aj][dj];
    coords[aj][dj] = orig + h;
    const gp = nuclearGradient(coords, E, h).flat();
    coords[aj][dj] = orig - h;
    const gm = nuclearGradient(coords, E, h).flat();
    coords[aj][dj] = orig;
    for (let i = 0; i < dim; i += 1) H[i][j] = (gp[i] - gm[i]) / (2 * h);
  }
  // Symmetrize and mass-weight.
  const Hmw = Array.from({ length: dim }, () => new Array(dim).fill(0));
  for (let i = 0; i < dim; i += 1) {
    for (let j = 0; j < dim; j += 1) {
      const mi = masses[Math.floor(i / 3)];
      const mj = masses[Math.floor(j / 3)];
      Hmw[i][j] = 0.5 * (H[i][j] + H[j][i]) / Math.sqrt(mi * mj);
    }
  }
  const { values } = jacobiEigh(Hmw, dim);
  const toCm1 = (lambda) => (lambda >= 0 ? 1 : -1) * Math.sqrt(Math.abs(lambda)) * HARTREE_TO_CM1;
  const all = values.map(toCm1).sort((a, b) => a - b);
  // Drop the 5 (linear) or 6 (nonlinear) lowest-magnitude near-zero translation/rotation modes.
  const nDrop = dropModes ?? (m === 2 ? 5 : 6);
  const byMagnitude = [...all].sort((a, b) => Math.abs(a) - Math.abs(b));
  const dropped = new Set(byMagnitude.slice(0, nDrop));
  const vibrations = all.filter((f) => !dropped.has(f));
  return { vibrationsCm1: vibrations, allModesCm1: all };
}

/**
 * Born–Oppenheimer molecular dynamics: propagate the nuclei on the electronic energy surface with
 * velocity Verlet, forces = −∇E (numerical gradient). Reactions and vibrations play out in time on
 * the first-principles PES, with the total energy (electronic + nuclear kinetic) conserved. Returns
 * the trajectory and the energy drift (a conservation check). Atomic units (time in ħ/Hartree).
 */
export function bornOppenheimerMD(atoms, { method = (a) => rhf(a).totalEnergyHa, dtAu = 10, steps = 50, velocities = null, gradH = 1e-3 } = {}) {
  const Zs = atoms.map((a) => a.Z);
  const masses = atoms.map((a) => ATOMIC_MASS_U[a.Z - 1] * AMU_TO_ELECTRON_MASS);
  let x = atoms.map((a) => [...a.position]);
  let v = velocities ? velocities.map((vv) => [...vv]) : atoms.map(() => [0, 0, 0]);
  const E = (cs) => method(cs.map((p, i) => ({ Z: Zs[i], position: p })));
  const accel = (coords) => {
    const g = nuclearGradient(coords, E, gradH);
    return g.map((gi, i) => gi.map((gid) => -gid / masses[i]));
  };
  const kinetic = () => 0.5 * v.reduce((s, vi, i) => s + masses[i] * (vi[0] ** 2 + vi[1] ** 2 + vi[2] ** 2), 0);

  let a = accel(x);
  const trajectory = [];
  let minTot = Infinity;
  let maxTot = -Infinity;
  for (let step = 0; step <= steps; step += 1) {
    const potential = E(x);
    const kin = kinetic();
    const total = potential + kin;
    minTot = Math.min(minTot, total);
    maxTot = Math.max(maxTot, total);
    trajectory.push({ timeAu: step * dtAu, positions: x.map((p) => [...p]), potentialHa: potential, kineticHa: kin, totalHa: total });
    if (step === steps) break;
    // velocity Verlet
    const xNew = x.map((p, i) => [p[0] + v[i][0] * dtAu + 0.5 * a[i][0] * dtAu * dtAu, p[1] + v[i][1] * dtAu + 0.5 * a[i][1] * dtAu * dtAu, p[2] + v[i][2] * dtAu + 0.5 * a[i][2] * dtAu * dtAu]);
    const aNew = accel(xNew);
    v = v.map((vi, i) => [vi[0] + 0.5 * (a[i][0] + aNew[i][0]) * dtAu, vi[1] + 0.5 * (a[i][1] + aNew[i][1]) * dtAu, vi[2] + 0.5 * (a[i][2] + aNew[i][2]) * dtAu]);
    x = xNew;
    a = aNew;
  }
  return { trajectory, energyDriftHa: maxTot - minTot };
}

/** Distance (Bohr) between two atoms in a geometry. */
export function bondLength(atoms, i, j) {
  const a = atoms[i].position;
  const b = atoms[j].position;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Angle (degrees) i–center–j. */
export function bondAngle(atoms, i, center, j) {
  const c = atoms[center].position;
  const v1 = atoms[i].position.map((x, d) => x - c[d]);
  const v2 = atoms[j].position.map((x, d) => x - c[d]);
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const n1 = Math.hypot(...v1);
  const n2 = Math.hypot(...v2);
  return (Math.acos(dot / (n1 * n2)) * 180) / Math.PI;
}

export { uhf as _uhf, jacobiEigh, boys, hermiteE, hermiteR, primitiveOverlap, primitiveKinetic, primitiveNuclear, primitiveERI, makeBasisFunction, contract2 };
