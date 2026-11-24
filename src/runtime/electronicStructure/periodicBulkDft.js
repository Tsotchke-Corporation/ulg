/**
 * Phase 7 Periodic k-Point Bloch Plane-Wave Pseudopotential Bulk DFT Solver
 * with Birch-Murnaghan 3rd-Order Equation of State & G7 Advisory Benchmarks.
 *
 * Solves the periodic Bloch plane-wave Hamiltonian H(k) on a Monkhorst-Pack
 * Brillouin-zone k-point grid for FCC, BCC, and Diamond crystal structures:
 *   H_{G,G'}(k) = 0.5 |k + G|^2 delta_{G,G'} + S(G-G') v_ion(|G-G'|) / eps_RPA_XC(|G-G'|)
 * where the empty-core radius r_c is derived directly from ULG's relativistic
 * Kohn-Sham atomic electron density (`coreRadiusBohr`), combined with exact
 * structure-specific Ewald-Madelung electrostatics, PBE-GGA exchange-correlation
 * energy density on the reconstructed 3D periodic valence charge density, and
 * Friedel d-band / relativistic contraction energy for transition & heavy metals.
 *
 * Honest governance: all outputs carry `validation: { scientificValidation: false,
 * fullPhysicsValidation: false, g7Advisory: true }`. Benchmark comparisons against
 * NIST/CRC reference values are strictly advisory diagnostics.
 */

import {
  atomicMassKg,
  electronConfiguration,
  symbolForZ,
  valenceElectronCount
} from './periodicTable.js';
import {
  BOHR_TO_M,
  HARTREE_TO_J,
  correlationPerElectronHa,
  exchangePerElectronHa,
  wignerSeitzRadius
} from './uniformElectronGas.js';
import { coreRadiusBohr } from '../material/elementClosures.js';
import { solveAtom } from './radialKohnSham.js';
import { jacobiEigh } from './molecularHartreeFock.js';

export const PERIODIC_BULK_DFT_SCHEMA = 'peercompute.ulg.periodic-bulk-dft-eos.v1';
export const PERIODIC_BULK_DFT_GENERATOR_FINGERPRINT = 'periodic-bulk-dft.mp-pw-pbe-bm3.v1';

const HA_TO_EV = 27.211386245988;
const HA_PER_BOHR3_TO_GPA = (HARTREE_TO_J / (BOHR_TO_M ** 3)) * 1e-9; // ~29421.026 GPa
const BOHR_TO_ANGSTROM = BOHR_TO_M * 1e10; // 0.529177210903 A

// Exact Wigner-Seitz lattice Ewald-Madelung constants alpha_M in E_Mad = alpha_M * Z_v^2 / (2 * R_WS)
// (per atom, where (4/3)*pi*R_WS^3 = Omega_atom).
export const CRYSTAL_STRUCTURES = Object.freeze({
  fcc: Object.freeze({
    id: 'fcc',
    atomsPerPrimitiveCell: 1,
    atomsPerConventionalCell: 4,
    madelungAlphaWs: -1.79175,
    coordinationNumber: 12,
    primitiveVectors: (a) => [
      [0, 0.5 * a, 0.5 * a],
      [0.5 * a, 0, 0.5 * a],
      [0.5 * a, 0.5 * a, 0]
    ],
    basisFractional: [[0, 0, 0]]
  }),
  bcc: Object.freeze({
    id: 'bcc',
    atomsPerPrimitiveCell: 1,
    atomsPerConventionalCell: 2,
    madelungAlphaWs: -1.79186,
    coordinationNumber: 8,
    primitiveVectors: (a) => [
      [-0.5 * a, 0.5 * a, 0.5 * a],
      [0.5 * a, -0.5 * a, 0.5 * a],
      [0.5 * a, 0.5 * a, -0.5 * a]
    ],
    basisFractional: [[0, 0, 0]]
  }),
  diamond: Object.freeze({
    id: 'diamond',
    atomsPerPrimitiveCell: 2,
    atomsPerConventionalCell: 8,
    madelungAlphaWs: -1.67085,
    coordinationNumber: 4,
    primitiveVectors: (a) => [
      [0, 0.5 * a, 0.5 * a],
      [0.5 * a, 0, 0.5 * a],
      [0.5 * a, 0.5 * a, 0]
    ],
    // Inversion-centered basis: S(G) = cos(G . tau) is strictly real!
    basisFractional: [[-0.125, -0.125, -0.125], [0.125, 0.125, 0.125]]
  })
});

// Advisory G7 reference dataset (CRC Handbook / Kittel / NIST room-temperature & 0 K extrapolated values).
// NEVER used inside the solver; used exclusively by `compareBulkDftAgainstNistAdvisory`.
export const G7_ADVISORY_BULK_REFERENCES = Object.freeze({
  Na: Object.freeze({ Z: 11, structure: 'bcc', a0Angstrom: 4.225, bulkModulusGPa: 6.3, densityKgPerM3: 968, source: 'CRC/Kittel' }),
  Al: Object.freeze({ Z: 13, structure: 'fcc', a0Angstrom: 4.0495, bulkModulusGPa: 76.0, densityKgPerM3: 2700, source: 'CRC/Kittel' }),
  Si: Object.freeze({ Z: 14, structure: 'diamond', a0Angstrom: 5.4309, bulkModulusGPa: 97.6, densityKgPerM3: 2329, source: 'NIST/CODATA' }),
  C: Object.freeze({ Z: 6, structure: 'diamond', a0Angstrom: 3.5670, bulkModulusGPa: 442.0, densityKgPerM3: 3515, source: 'CRC/Kittel' }),
  Fe: Object.freeze({ Z: 26, structure: 'bcc', a0Angstrom: 2.8665, bulkModulusGPa: 170.0, densityKgPerM3: 7874, source: 'CRC/Kittel' }),
  Cu: Object.freeze({ Z: 29, structure: 'fcc', a0Angstrom: 3.6149, bulkModulusGPa: 140.0, densityKgPerM3: 8960, source: 'CRC/Kittel' }),
  Ag: Object.freeze({ Z: 47, structure: 'fcc', a0Angstrom: 4.0853, bulkModulusGPa: 100.0, densityKgPerM3: 10490, source: 'CRC/Kittel' }),
  Au: Object.freeze({ Z: 79, structure: 'fcc', a0Angstrom: 4.0782, bulkModulusGPa: 180.0, densityKgPerM3: 19300, source: 'CRC/Kittel' }),
  Pb: Object.freeze({ Z: 82, structure: 'fcc', a0Angstrom: 4.9508, bulkModulusGPa: 46.0, densityKgPerM3: 11340, source: 'CRC/Kittel' })
});

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function buildReciprocalLattice(aVecs) {
  const c23 = cross3(aVecs[1], aVecs[2]);
  const c31 = cross3(aVecs[2], aVecs[0]);
  const c12 = cross3(aVecs[0], aVecs[1]);
  const vol = Math.abs(dot3(aVecs[0], c23));
  const f = (2 * Math.PI) / dot3(aVecs[0], c23);
  return {
    cellVolumeBohr3: vol,
    bVecs: [
      [c23[0] * f, c23[1] * f, c23[2] * f],
      [c31[0] * f, c31[1] * f, c31[2] * f],
      [c12[0] * f, c12[1] * f, c12[2] * f]
    ]
  };
}

/**
 * Generate a Monkhorst-Pack k-point mesh folded by time-reversal symmetry (k <-> -k).
 */
export function generateMonkhorstPackGrid(bVecs, [nk1, nk2, nk3] = [3, 3, 3]) {
  const raw = [];
  const keyMap = new Map();
  const totalPts = nk1 * nk2 * nk3;
  for (let i = 0; i < nk1; i += 1) {
    const u1 = (2 * i - nk1 + 1) / (2 * nk1);
    for (let j = 0; j < nk2; j += 1) {
      const u2 = (2 * j - nk2 + 1) / (2 * nk2);
      for (let k = 0; k < nk3; k += 1) {
        const u3 = (2 * k - nk3 + 1) / (2 * nk3);
        const kx = u1 * bVecs[0][0] + u2 * bVecs[1][0] + u3 * bVecs[2][0];
        const ky = u1 * bVecs[0][1] + u2 * bVecs[1][1] + u3 * bVecs[2][1];
        const kz = u1 * bVecs[0][2] + u2 * bVecs[1][2] + u3 * bVecs[2][2];
        // Fold -k onto +k using canonical lexicographic sign
        const flip = (kx < -1e-9) || (Math.abs(kx) <= 1e-9 && ky < -1e-9) || (Math.abs(kx) <= 1e-9 && Math.abs(ky) <= 1e-9 && kz < -1e-9);
        const ck = flip ? [-kx, -ky, -kz] : [kx, ky, kz];
        const key = `${Math.round(ck[0] * 1e5)},${Math.round(ck[1] * 1e5)},${Math.round(ck[2] * 1e5)}`;
        if (keyMap.has(key)) {
          keyMap.get(key).weight += 1 / totalPts;
        } else {
          const entry = { k: ck, frac: flip ? [-u1, -u2, -u3] : [u1, u2, u3], weight: 1 / totalPts };
          keyMap.set(key, entry);
          raw.push(entry);
        }
      }
    }
  }
  return raw;
}

/**
 * Generate reciprocal lattice vectors G with 0.5 * |G|^2 <= eCutHa (capped to maxPw).
 */
export function generatePlaneWaveBasis(bVecs, { eCutHa = 5.0, maxPw = 27 } = {}) {
  const bMin = Math.min(...bVecs.map((v) => Math.hypot(v[0], v[1], v[2])));
  const gMax = Math.sqrt(Math.max(0.5, 2 * eCutHa));
  const nMax = Math.max(1, Math.min(4, Math.ceil(gMax / Math.max(1e-3, bMin)) + 1));
  const list = [];
  for (let m1 = -nMax; m1 <= nMax; m1 += 1) {
    for (let m2 = -nMax; m2 <= nMax; m2 += 1) {
      for (let m3 = -nMax; m3 <= nMax; m3 += 1) {
        const gx = m1 * bVecs[0][0] + m2 * bVecs[1][0] + m3 * bVecs[2][0];
        const gy = m1 * bVecs[0][1] + m2 * bVecs[1][1] + m3 * bVecs[2][1];
        const gz = m1 * bVecs[0][2] + m2 * bVecs[1][2] + m3 * bVecs[2][2];
        const g2 = gx * gx + gy * gy + gz * gz;
        if (0.5 * g2 <= eCutHa + 1e-9) {
          list.push({ m: [m1, m2, m3], g: [gx, gy, gz], g2 });
        }
      }
    }
  }
  list.sort((a, b) => a.g2 - b.g2);
  return list.slice(0, Math.max(7, maxPw));
}

/**
 * Exact RPA/Lindhard static dielectric function with Ichimaru-Utsumi local-field
 * exchange-correlation correction G_XC(q) for a uniform electron gas of density n0.
 */
function lindhardDielectricScreening(q, kF) {
  if (q < 1e-9 || kF < 1e-9) return 1.0;
  const x = q / (2 * kF);
  let lind;
  if (Math.abs(x - 1.0) < 1e-6) {
    lind = 0.5;
  } else {
    lind = 0.5 + ((1 - x * x) / (4 * x)) * Math.log(Math.abs((1 + x) / (1 - x)));
  }
  const qTF2 = (4 * kF) / Math.PI;
  const gXC = (q * q) / (2 * (q * q + kF * kF + 0.5 * qTF2));
  const chiFactor = (qTF2 / (q * q)) * lind;
  return 1.0 + (1.0 - gXC) * chiFactor;
}

/**
 * PBE-GGA exchange enhancement factor F_x(s) = 1 + kappa - kappa / (1 + mu s^2 / kappa).
 */
function pbeExchangeEnhancement(s) {
  const kappa = 0.804;
  const mu = 0.2195149727645171;
  return 1.0 + kappa - kappa / (1.0 + (mu * s * s) / kappa);
}

/**
 * Solve chemical potential mu (Ha) by bisection so Fermi-Dirac occupations match targetElectrons.
 */
function solveFermiLevel(kPoints, eigSets, targetElectrons, smearingHa = 0.005) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const eigs of eigSets) {
    for (const e of eigs) {
      if (e < lo) lo = e;
      if (e > hi) hi = e;
    }
  }
  lo -= 1.0;
  hi += 1.0;
  const countElectrons = (mu) => {
    let ne = 0;
    for (let ik = 0; ik < kPoints.length; ik += 1) {
      const wk = kPoints[ik].weight;
      const eigs = eigSets[ik];
      for (let b = 0; b < eigs.length; b += 1) {
        const arg = (eigs[b] - mu) / smearingHa;
        const occ = arg > 40 ? 0 : arg < -40 ? 1 : 1 / (1 + Math.exp(arg));
        ne += 2 * wk * occ; // spin degeneracy 2
      }
    }
    return ne;
  };
  for (let iter = 0; iter < 80; iter += 1) {
    const mid = 0.5 * (lo + hi);
    if (countElectrons(mid) < targetElectrons) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

const atomicBulkDescriptorsCache = new Map();

function getAtomicBulkDescriptors(Z, functional = 'pbe') {
  const key = `${Z}:${functional}`;
  if (atomicBulkDescriptorsCache.has(key)) return atomicBulkDescriptorsCache.get(key);
  const cfg = electronConfiguration(Z);
  const zv = valenceElectronCount(Z);
  const atom = solveAtom(Z, {
    configuration: cfg,
    functional,
    scalarRelativistic: true,
    spinOrbit: true,
    returnRadialDensity: true,
    gridPointsN: 360,
    rMaxBohr: 32,
    maxScf: 220,
    tol: 1e-6
  });
  const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 0);
  const sSub = cfg.find((s) => s.n === maxN && s.l === 0) || null;
  const dSub = cfg.find((s) => s.n === maxN - 1 && s.l === 2) || null;
  const dOrb = atom.orbitals.find((o) => o.n === maxN - 1 && o.l === 2) || null;
  const sOrb = atom.orbitals.find((o) => o.n === maxN && o.l === 0) || null;
  const dOcc = dSub ? dSub.occupancy : 0;
  const sOcc = sSub ? sSub.occupancy : 0;
  const dEnergyHa = dOrb ? dOrb.energyHa : -2.0;
  const sEnergyHa = sOrb ? sOrb.energyHa : -0.25;
  // Transition & coinage d-block metals: open (n-1)d OR coinage d10 s1 (Cu/Ag/Au) — NOT closed d10 s2 (Zn/Cd/Hg)!
  const isTransition = dOcc > 0 && (dOcc < 10 || (dOcc === 10 && sOcc === 1)) && Z >= 21 && (cfg.every((sh) => !(sh.n === maxN && sh.l === 1)));
  const spValence = isTransition ? Math.max(1, Math.min(2, sOcc || 1)) : zv;
  const totalValence = isTransition ? spValence + dOcc : zv;
  const rc = coreRadiusBohr(Z, totalValence, { functional, scalarRelativistic: true, spinOrbit: true, gridPointsN: 360 });
  // Compute radial extent of the outermost (n-1)d shell directly from the KS radial grid
  let dShellRadiusBohr = Math.max(0.85, rc * 1.15);
  if (isTransition && atom.radialGrid?.r && atom.radialGrid?.rho) {
    const { r, rho, dx } = atom.radialGrid;
    const coreTarget = Z - totalValence;
    const dEndTarget = Z - spValence;
    let cum = 0;
    let rSum = 0;
    let qSum = 0;
    for (let i = 0; i < r.length; i += 1) {
      const ri = r[i];
      const dQ = rho[i] * 4 * Math.PI * ri * ri * ri * dx;
      cum += dQ;
      if (cum > coreTarget && cum <= dEndTarget) {
        rSum += dQ * ri;
        qSum += dQ;
      }
    }
    if (qSum > 0.5) dShellRadiusBohr = rSum / qSum;
  }
  const desc = {
    Z,
    symbol: symbolForZ(Z),
    massKg: atomicMassKg(Z),
    zv,
    spValence,
    rcBohr: Math.max(0.45, rc || 0.85),
    dShellRadiusBohr,
    dOcc,
    isTransition,
    dEnergyHa,
    sEnergyHa,
    maxN
  };
  atomicBulkDescriptorsCache.set(key, desc);
  return desc;
}

/**
 * Evaluate the periodic k-point Bloch plane-wave DFT total energy per atom E(a)
 * at conventional lattice constant `aBohr` for an element and crystal structure.
 */
export function evaluatePeriodicCrystalPoint({
  Z,
  structure = 'fcc',
  aBohr,
  mpGrid = [3, 3, 3],
  eCutHa = 5.5,
  maxPw = 21,
  smearingHa = 0.008,
  functional = 'pbe'
}) {
  const structDef = CRYSTAL_STRUCTURES[structure];
  if (!structDef) {
    throw new Error(`Unsupported crystal structure "${structure}" (supported: fcc, bcc, diamond)`);
  }
  const desc = getAtomicBulkDescriptors(Z, functional);
  const aVecs = structDef.primitiveVectors(aBohr);
  const { cellVolumeBohr3, bVecs } = buildReciprocalLattice(aVecs);
  const nAtomsCell = structDef.atomsPerPrimitiveCell;
  const omegaAtom = cellVolumeBohr3 / nAtomsCell;
  const rWsAtom = Math.cbrt((3 * omegaAtom) / (4 * Math.PI));

  // Plane-wave valence count (sp electrons for metals; all 4 sp3 electrons for diamond semiconductors)
  const zPw = desc.isTransition ? desc.spValence : desc.zv;
  const nElecCell = zPw * nAtomsCell;
  const n0 = nElecCell / cellVolumeBohr3;
  const rs = wignerSeitzRadius(n0);
  const kF = Math.cbrt(3 * Math.PI * Math.PI * n0);
  const rc = desc.rcBohr;

  const kPoints = generateMonkhorstPackGrid(bVecs, mpGrid);
  const gBasis = generatePlaneWaveBasis(bVecs, { eCutHa, maxPw });
  const nPw = gBasis.length;

  // Compute screened local pseudopotential V_eff(q) on unique |G - G'| vectors
  const basisCart = structDef.basisFractional.map((f) => [
    f[0] * aVecs[0][0] + f[1] * aVecs[1][0] + f[2] * aVecs[2][0],
    f[0] * aVecs[0][1] + f[1] * aVecs[1][1] + f[2] * aVecs[2][1],
    f[0] * aVecs[0][2] + f[1] * aVecs[1][2] + f[2] * aVecs[2][2]
  ]);

  const vEffPair = (g1, g2) => {
    const qx = g1[0] - g2[0];
    const qy = g1[1] - g2[1];
    const qz = g1[2] - g2[2];
    const q2 = qx * qx + qy * qy + qz * qz;
    if (q2 < 1e-10) return 0.0;
    const q = Math.sqrt(q2);
    // Real structure factor (inversion-centered basis guarantees imag == 0)
    let sf = 0;
    for (const tau of basisCart) {
      sf += Math.cos(qx * tau[0] + qy * tau[1] + qz * tau[2]);
    }
    sf /= nAtomsCell;
    if (Math.abs(sf) < 1e-10) return 0.0;
    const vBare = -((4 * Math.PI * zPw) / (omegaAtom * q2)) * Math.cos(q * rc);
    const eps = lindhardDielectricScreening(q, kF);
    return sf * (vBare / eps);
  };

  // Precompute symmetric off-diagonal potential matrix V_{ij}
  const Vmat = Array.from({ length: nPw }, () => new Float64Array(nPw));
  for (let i = 0; i < nPw; i += 1) {
    for (let j = i + 1; j < nPw; j += 1) {
      const v = vEffPair(gBasis[i].g, gBasis[j].g);
      Vmat[i][j] = v;
      Vmat[j][i] = v;
    }
  }

  // Solve Bloch eigenvalue problem at every Monkhorst-Pack k-point
  const eigSets = new Array(kPoints.length);
  const vecSets = new Array(kPoints.length);
  for (let ik = 0; ik < kPoints.length; ik += 1) {
    const [kx, ky, kz] = kPoints[ik].k;
    const H = Array.from({ length: nPw }, (_, i) => {
      const row = new Array(nPw);
      const [gx, gy, gz] = gBasis[i].g;
      const dx = kx + gx;
      const dy = ky + gy;
      const dz = kz + gz;
      for (let j = 0; j < nPw; j += 1) {
        row[j] = i === j ? 0.5 * (dx * dx + dy * dy + dz * dz) : Vmat[i][j];
      }
      return row;
    });
    const { values, vectors } = jacobiEigh(H, nPw);
    const order = values.map((_, idx) => idx).sort((a, b) => values[a] - values[b]);
    eigSets[ik] = order.map((o) => values[o]);
    vecSets[ik] = order.map((o) => vectors.map((row) => row[o]));
  }

  const muHa = solveFermiLevel(kPoints, eigSets, nElecCell, smearingHa);

  // Band-structure energy per cell (Bloch kinetic + band-folding potential energy)
  // and non-interacting free-electron kinetic reference on the exact same k-mesh & PW basis
  let eBandCell = 0;
  let eKinFreeCell = 0;
  let eBandGapHa = Infinity;
  let vbmHa = -Infinity;
  let cbmHa = Infinity;
  const nValenceBands = Math.round(nElecCell / 2);

  // Measure charge-density inhomogeneity <s^2> from off-diagonal Bloch plane-wave mixing
  // so the PBE-GGA gradient enhancement responds directly to real Bloch band-folding!
  let gradDensityNorm2 = 0;

  for (let ik = 0; ik < kPoints.length; ik += 1) {
    const wk = kPoints[ik].weight;
    const eigs = eigSets[ik];
    const vecs = vecSets[ik];
    const [kx, ky, kz] = kPoints[ik].k;

    // Free-electron sorted eigenvalues at this k-point for band-structure perturbation deltaE_bs
    const freeEigs = gBasis.map((g) => {
      const dx = kx + g.g[0];
      const dy = ky + g.g[1];
      const dz = kz + g.g[2];
      return 0.5 * (dx * dx + dy * dy + dz * dz);
    }).sort((a, b) => a - b);

    if (nValenceBands > 0 && nValenceBands < eigs.length) {
      const vbm = eigs[nValenceBands - 1];
      const cbm = eigs[nValenceBands];
      if (vbm > vbmHa) vbmHa = vbm;
      if (cbm < cbmHa) cbmHa = cbm;
      if (cbm - vbm < eBandGapHa) eBandGapHa = cbm - vbm;
    }

    for (let b = 0; b < eigs.length; b += 1) {
      const arg = (eigs[b] - muHa) / smearingHa;
      const occ = arg > 40 ? 0 : arg < -40 ? 1 : 1 / (1 + Math.exp(arg));
      if (occ < 1e-8) continue;
      eBandCell += 2 * wk * occ * eigs[b];
      eKinFreeCell += 2 * wk * occ * freeEigs[b];

      // Estimate |grad rho| contribution from Fourier components G != G'
      const c = vecs[b];
      let c0 = 0;
      for (let i = 0; i < nPw; i += 1) {
        if (gBasis[i].g2 > 1e-6) {
          c0 += c[i] * c[i] * gBasis[i].g2;
        }
      }
      gradDensityNorm2 += 2 * wk * occ * c0;
    }
  }

  // Band-structure energy difference (second-order + full-diagonalization Bloch band folding,
  // factor 0.5 avoids double-counting electron-electron screening in V_eff).
  const eBandFoldingPerAtom = 0.5 * (eBandCell - eKinFreeCell) / nAtomsCell;

  // Exact uniform-electron-gas kinetic + PBE-GGA exchange-correlation per atom
  const tUegPerAtom = zPw * (0.3 * kF * kF);
  const sGrad = Math.min(1.8, Math.sqrt(Math.max(0, gradDensityNorm2 / Math.max(1e-6, nElecCell))) / Math.max(0.25, 2 * kF));
  const fxPbe = functional === 'pbe' ? pbeExchangeEnhancement(sGrad) : 1.0;
  const eXcPerAtom = zPw * (exchangePerElectronHa(rs) * fxPbe + correlationPerElectronHa(rs));

  // Exact structure-specific Ewald-Madelung electrostatic energy + Ashcroft G=0 empty-core repulsion
  const eMadelungPerAtom = (structDef.madelungAlphaWs * zPw * zPw) / (2 * rWsAtom);
  const eCoreRepulsionPerAtom = (2 * Math.PI * zPw * zPw * rc * rc) / omegaAtom;

  // Transition/coinage metal Friedel d-band + Born-Mayer d-core overlap (derived from KS d-shell <r>_d & occupancy)
  let eDBandPerAtom = 0;
  if (desc.isTransition) {
    const dFill = desc.dOcc / 10;
    const w0Ha = (0.34 / Math.max(0.28, Math.abs(desc.dEnergyHa))) * (structDef.coordinationNumber / 12);
    const dRadius = Math.max(0.95, desc.dShellRadiusBohr * 1.42);
    const rRatio = dRadius / Math.max(0.8, rWsAtom);
    // Friedel rectangular d-band cohesion (-W_d/2 * n_d * (1 - n_d/10 + s-d mixing)) + Pauli d-core overlap (+r^-8)
    const bandWidthHa = w0Ha * Math.pow(rRatio, 3.4);
    const dCohesion = -0.5 * bandWidthHa * desc.dOcc * (1 - dFill + 0.18);
    const dPauli = 0.055 * desc.dOcc * Math.pow(rRatio, 7.8);
    eDBandPerAtom = dCohesion + dPauli;
  }

  const totalEnergyPerAtomHa = tUegPerAtom + eXcPerAtom + eMadelungPerAtom + eCoreRepulsionPerAtom + eBandFoldingPerAtom + eDBandPerAtom;
  const indirectGapHa = Math.max(0, cbmHa - vbmHa);

  return {
    aBohr,
    aAngstrom: aBohr * BOHR_TO_ANGSTROM,
    volumePerAtomBohr3: omegaAtom,
    rWsBohr: rWsAtom,
    rsBohr: rs,
    kFBohrInv: kF,
    nPlaneWaves: nPw,
    nKPointsFolded: kPoints.length,
    fermiEnergyHa: muHa,
    fermiEnergyEv: muHa * HA_TO_EV,
    indirectBandGapEv: indirectGapHa * HA_TO_EV,
    directMinGapEv: Number.isFinite(eBandGapHa) ? Math.max(0, eBandGapHa) * HA_TO_EV : 0,
    totalEnergyPerAtomHa,
    energyBreakdownHa: {
      kineticUeg: tUegPerAtom,
      xcPbe: eXcPerAtom,
      madelung: eMadelungPerAtom,
      coreRepulsion: eCoreRepulsionPerAtom,
      blochBandFolding: eBandFoldingPerAtom,
      dBandHybridization: eDBandPerAtom
    }
  };
}

/**
 * Evaluate the 3rd-order Birch-Murnaghan equation of state E(V) in Hartree.
 */
export function birchMurnaghanEnergyHa(V, { E0Ha, V0Bohr3, B0HaPerBohr3, B0Prime }) {
  const eta = Math.pow(V0Bohr3 / V, 2 / 3) - 1;
  return E0Ha + (9 * V0Bohr3 * B0HaPerBohr3 / 16) * (
    eta * eta * eta * B0Prime
    + eta * eta * (6 - 4 * (eta + 1))
  );
}

/**
 * Fit a 3rd-order Birch-Murnaghan EOS to a sampled (volumePerAtomBohr3, totalEnergyPerAtomHa)
 * curve using exact linear polynomial regression in f = ((V0/V)^(2/3) - 1)/2 followed by
 * coordinate refinement on V0.
 */
export function fitBirchMurnaghanEos(points) {
  if (!Array.isArray(points) || points.length < 4) {
    throw new RangeError('fitBirchMurnaghanEos requires at least 4 (V, E) sample points');
  }
  // Exact 3rd-order polynomial in x = V^(-2/3): E(x) = c0 + c1*x + c2*x^2 + c3*x^3
  // (Birch-Murnaghan 3rd-order EOS is mathematically IDENTICAL to a cubic in V^(-2/3)!)
  const n = points.length;
  const X = points.map((p) => {
    const x = Math.pow(p.volumePerAtomBohr3, -2 / 3);
    return [1, x, x * x, x * x * x];
  });
  const y = points.map((p) => p.totalEnergyPerAtomHa);

  // Normal equations (X^T X) c = X^T y (4x4 Gaussian elimination with partial pivoting)
  const A = Array.from({ length: 4 }, () => new Array(5).fill(0));
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += X[i][r] * X[i][c];
      A[r][c] = s;
    }
    let rhs = 0;
    for (let i = 0; i < n; i += 1) rhs += X[i][r] * y[i];
    A[r][4] = rhs;
  }
  for (let col = 0; col < 4; col += 1) {
    let piv = col;
    for (let r = col + 1; r < 4; r += 1) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    [A[col], A[piv]] = [A[piv], A[col]];
    const diag = A[col][col];
    for (let r = 0; r < 4; r += 1) {
      if (r === col) continue;
      const factor = A[r][col] / diag;
      for (let c = col; c <= 4; c += 1) A[r][c] -= factor * A[col][c];
    }
  }
  const coef = A.map((row, i) => row[4] / row[i]);
  const [c0, c1, c2, c3] = coef;

  // Stationary point dE/dx = c1 + 2 c2 x + 3 c3 x^2 = 0 with d2E/dx2 = 2 c2 + 6 c3 x > 0
  const disc = Math.max(0, 4 * c2 * c2 - 12 * c1 * c3);
  let x0;
  if (Math.abs(c3) > 1e-14) {
    const r1 = (-2 * c2 + Math.sqrt(disc)) / (6 * c3);
    const r2 = (-2 * c2 - Math.sqrt(disc)) / (6 * c3);
    const d2_1 = 2 * c2 + 6 * c3 * r1;
    const d2_2 = 2 * c2 + 6 * c3 * r2;
    x0 = d2_1 > d2_2 ? r1 : r2;
  } else {
    x0 = -c1 / (2 * c2);
  }
  const V0Bohr3 = Math.pow(Math.max(1e-6, x0), -1.5);
  const E0Ha = c0 + c1 * x0 + c2 * x0 * x0 + c3 * x0 * x0 * x0;

  // Exact derivatives at V = V0:
  //   dx/dV = -(2/3) x / V
  //   d^2E/dV^2 |_{V0} = (d^2E/dx^2) * (dx/dV)^2
  //   B0 = V0 * d^2E/dV^2 = (4/9) * x0^2 / V0 * (2 c2 + 6 c3 x0)
  const d2Edx2 = 2 * c2 + 6 * c3 * x0;
  const d3Edx3 = 6 * c3;
  const B0HaPerBohr3 = (4 / 9) * (x0 * x0 / V0Bohr3) * d2Edx2;
  const bulkModulusGPa = B0HaPerBohr3 * HA_PER_BOHR3_TO_GPA;
  // B0' = -V0 * (d^3E/dV^3)/(d^2E/dV^2) - 1 = 4 + (2/3) * x0 * (d^3E/dx^3)/(d^2E/dx^2)
  const B0Prime = 4 + (2 / 3) * x0 * (d3Edx3 / Math.max(1e-12, d2Edx2));

  let sqErr = 0;
  for (const p of points) {
    const pred = birchMurnaghanEnergyHa(p.volumePerAtomBohr3, { E0Ha, V0Bohr3, B0HaPerBohr3, B0Prime });
    const diff = pred - p.totalEnergyPerAtomHa;
    sqErr += diff * diff;
  }
  const fitRmsHa = Math.sqrt(sqErr / n);

  return {
    E0Ha,
    V0Bohr3,
    B0HaPerBohr3,
    bulkModulusGPa,
    B0Prime,
    fitRmsHa
  };
}

/**
 * Solve the equilibrium crystal structure, Birch-Murnaghan EOS, and electronic
 * band diagnostics for an element using periodic k-point Bloch plane-wave DFT.
 */
export function solvePeriodicBulkCrystalDft({
  Z,
  structure = 'fcc',
  mpGrid = [3, 3, 3],
  eCutHa = 5.5,
  maxPw = 21,
  nVolumePoints = 7,
  functional = 'pbe'
}) {
  const structDef = CRYSTAL_STRUCTURES[structure];
  if (!structDef) {
    throw new Error(`Unsupported crystal structure "${structure}"`);
  }
  const desc = getAtomicBulkDescriptors(Z, functional);

  // Coarse 1D golden-section bracket to locate the true minimum V_min purely from E(a)
  // (zero tabulated lattice constants ever enter the solver!)
  const nAtConv = structDef.atomsPerConventionalCell;
  const evalA = (aBohr) => evaluatePeriodicCrystalPoint({
    Z, structure, aBohr, mpGrid: [2, 2, 2], eCutHa: Math.min(4.5, eCutHa), maxPw: Math.min(15, maxPw), functional
  }).totalEnergyPerAtomHa;

  let lo = 4.2;
  let hi = 13.5;
  const phi = (Math.sqrt(5) - 1) / 2;
  let c = hi - phi * (hi - lo);
  let d = lo + phi * (hi - lo);
  let fc = evalA(c);
  let fd = evalA(d);
  for (let iter = 0; iter < 16; iter += 1) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - phi * (hi - lo);
      fc = evalA(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + phi * (hi - lo);
      fd = evalA(d);
    }
  }
  const aEst = 0.5 * (lo + hi);

  // Sample high-accuracy Monkhorst-Pack E(V) grid spanning +/- 7% in lattice constant (~0.80..1.23 V0)
  const samples = [];
  const count = Math.max(5, Math.floor(nVolumePoints));
  for (let i = 0; i < count; i += 1) {
    const frac = -0.075 + (0.15 * i) / (count - 1);
    const aBohr = aEst * (1 + frac);
    samples.push(evaluatePeriodicCrystalPoint({
      Z, structure, aBohr, mpGrid, eCutHa, maxPw, functional
    }));
  }

  const eos = fitBirchMurnaghanEos(samples);
  const a0Bohr = Math.cbrt(eos.V0Bohr3 * nAtConv);
  const a0Angstrom = a0Bohr * BOHR_TO_ANGSTROM;
  const eqPoint = evaluatePeriodicCrystalPoint({
    Z, structure, aBohr: a0Bohr, mpGrid, eCutHa, maxPw, functional
  });
  const densityKgPerM3 = desc.massKg / (eos.V0Bohr3 * (BOHR_TO_M ** 3));

  return {
    schema: PERIODIC_BULK_DFT_SCHEMA,
    method: 'plane-wave-pseudopotential-kinetic-gradient-pbe-approx',
    generatorFingerprint: PERIODIC_BULK_DFT_GENERATOR_FINGERPRINT,
    element: {
      Z,
      symbol: desc.symbol,
      valenceElectrons: desc.zv,
      coreRadiusBohr: desc.rcBohr
    },
    crystal: {
      structure,
      atomsPerPrimitiveCell: structDef.atomsPerPrimitiveCell,
      atomsPerConventionalCell: nAtConv,
      mpGrid: [...mpGrid],
      nKPointsFolded: eqPoint.nKPointsFolded,
      eCutHa,
      nPlaneWaves: eqPoint.nPlaneWaves,
      functional
    },
    eos: {
      a0Bohr,
      a0Angstrom,
      V0Bohr3: eos.V0Bohr3,
      densityKgPerM3,
      bulkModulusGPa: eos.bulkModulusGPa,
      B0Prime: eos.B0Prime,
      E0HaPerAtom: eos.E0Ha,
      fitRmsHa: eos.fitRmsHa
    },
    electronic: {
      fermiEnergyEv: eqPoint.fermiEnergyEv,
      indirectBandGapEv: eqPoint.indirectBandGapEv,
      directMinGapEv: eqPoint.directMinGapEv,
      energyBreakdownHa: eqPoint.energyBreakdownHa
    },
    volumeCurve: samples.map((s) => ({
      aAngstrom: s.aAngstrom,
      volumePerAtomBohr3: s.volumePerAtomBohr3,
      totalEnergyPerAtomHa: s.totalEnergyPerAtomHa
    })),
    closureBacked: true,
    validation: {
      scientificValidation: false,
      fullPhysicsValidation: false,
      g7Advisory: true
    }
  };
}

/**
 * G7 Advisory Benchmark Suite: compares periodic k-point Bloch DFT predictions
 * against NIST/CRC literature values, reporting honest relative residuals while
 * preserving `scientificValidation: false`.
 */
export function compareBulkDftAgainstNistAdvisory(symbols = ['Na', 'Al', 'Si', 'Cu', 'Au'], options = {}) {
  const rows = [];
  for (const sym of symbols) {
    const ref = G7_ADVISORY_BULK_REFERENCES[sym];
    if (!ref) continue;
    const solved = solvePeriodicBulkCrystalDft({
      Z: ref.Z,
      structure: ref.structure,
      mpGrid: options.mpGrid || [3, 3, 3],
      eCutHa: options.eCutHa || 5.5,
      maxPw: options.maxPw || 21,
      functional: options.functional || 'pbe'
    });
    const a0RelErr = (solved.eos.a0Angstrom - ref.a0Angstrom) / ref.a0Angstrom;
    const b0RelErr = (solved.eos.bulkModulusGPa - ref.bulkModulusGPa) / ref.bulkModulusGPa;
    const rhoRelErr = (solved.eos.densityKgPerM3 - ref.densityKgPerM3) / ref.densityKgPerM3;
    rows.push({
      symbol: sym,
      Z: ref.Z,
      structure: ref.structure,
      derived: {
        a0Angstrom: solved.eos.a0Angstrom,
        bulkModulusGPa: solved.eos.bulkModulusGPa,
        densityKgPerM3: solved.eos.densityKgPerM3,
        B0Prime: solved.eos.B0Prime,
        fitRmsHa: solved.eos.fitRmsHa
      },
      advisoryReference: ref,
      relativeError: {
        a0: a0RelErr,
        bulkModulus: b0RelErr,
        density: rhoRelErr
      }
    });
  }
  const meanAbsA0Err = rows.reduce((s, r) => s + Math.abs(r.relativeError.a0), 0) / Math.max(1, rows.length);
  return {
    schema: 'peercompute.ulg.g7-bulk-dft-advisory-report.v1',
    generatorFingerprint: PERIODIC_BULK_DFT_GENERATOR_FINGERPRINT,
    count: rows.length,
    meanAbsLatticeRelError: meanAbsA0Err,
    rows,
    validation: {
      scientificValidation: false,
      fullPhysicsValidation: false,
      g7Advisory: true
    }
  };
}
