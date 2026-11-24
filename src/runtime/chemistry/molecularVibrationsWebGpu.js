// Reusable Canonical ULG Chemistry Engine: WebGPU Geometry Optimization &
// Harmonic Vibrational Normal-Mode / IR-Raman Spectroscopy Solver
// (`src/runtime/chemistry/molecularVibrationsWebGpu.js`).
//
// Computes Born-Oppenheimer nuclear gradients F = -∇E_RHF on WebGPU, relaxes
// molecular geometry downhill to equilibrium, constructs the isotope-mass-
// weighted Hessian H_mw with exact Eckart translation/rotation projection,
// diagonalizes H_mw strictly on WebGPU via Gate 0B's batched symmetric
// eigensolver (`solveSymmetricEigenBatchedWebGpu`), and computes exact harmonic
// frequencies (cm^-1), ZPE, isotope shifts (e.g. H2O vs D2O), dipole-derivative
// IR intensities |∂μ/∂Q_k|^2, Raman activities, and 3D normal-mode displacements!

import { ATOMIC_MASS_U } from '../electronicStructure/periodicTable.js';
import { solveSymmetricEigenBatchedWebGpu } from '../gpuMath/batchedSymmetricEigensolverGpu.js';
import { solveMoleculeRhfWebGpu } from '../electronicStructure/molecularHartreeFockWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_MOLECULAR_VIBRATIONS_SCHEMA = 'ulg.chemistry.molecular-vibrations-webgpu.v1';

const AMU_TO_ELECTRON_MASS = 1822.888486;
const HARTREE_TO_CM1 = 219474.6313705;
const HA_TO_EV = 27.211386245988;
const CM1_TO_EV = 1.239841984e-4;
const BOHR_TO_A = 0.529177210903;

function normalizeAtoms(atoms) {
  return atoms.map((a) => {
    const pos = Array.isArray(a.position) ? a.position : [Number(a.x) || 0, Number(a.y) || 0, Number(a.z) || 0];
    return { Z: Math.max(1, Math.min(118, Math.trunc(a.Z))), position: [pos[0], pos[1], pos[2]] };
  });
}

function gramSchmidtOrthonormalize(vectors, tol = 1e-7) {
  const basis = [];
  for (const raw of vectors) {
    const v = raw.slice();
    for (const b of basis) {
      let dot = 0;
      for (let i = 0; i < v.length; i += 1) dot += v[i] * b[i];
      for (let i = 0; i < v.length; i += 1) v[i] -= dot * b[i];
    }
    const norm = Math.hypot(...v);
    if (norm > tol) {
      basis.push(v.map((x) => x / norm));
    }
  }
  return basis;
}

/**
 * Build the exact Eckart mass-weighted translation & rotation basis vectors
 * so rigid-body motions project cleanly to zero eigenvalue without corrupting
 * low-frequency internal vibrations!
 */
export function buildEckartProjectionBasis(coords, massesAu) {
  const n = coords.length;
  const dim = 3 * n;
  let totM = 0;
  const com = [0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    totM += massesAu[i];
    com[0] += massesAu[i] * coords[i][0];
    com[1] += massesAu[i] * coords[i][1];
    com[2] += massesAu[i] * coords[i][2];
  }
  com[0] /= totM; com[1] /= totM; com[2] /= totM;

  const raw = [];
  // 3 mass-weighted translations
  for (let axis = 0; axis < 3; axis += 1) {
    const t = new Array(dim).fill(0);
    for (let i = 0; i < n; i += 1) {
      t[i * 3 + axis] = Math.sqrt(massesAu[i]);
    }
    raw.push(t);
  }
  // 3 mass-weighted infinitesimal rotations around X, Y, Z
  const rotAxes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const w of rotAxes) {
    const r = new Array(dim).fill(0);
    for (let i = 0; i < n; i += 1) {
      const rx = coords[i][0] - com[0];
      const ry = coords[i][1] - com[1];
      const rz = coords[i][2] - com[2];
      const sm = Math.sqrt(massesAu[i]);
      // w x r
      r[i * 3 + 0] = sm * (w[1] * rz - w[2] * ry);
      r[i * 3 + 1] = sm * (w[2] * rx - w[0] * rz);
      r[i * 3 + 2] = sm * (w[0] * ry - w[1] * rx);
    }
    raw.push(r);
  }
  return gramSchmidtOrthonormalize(raw, 1e-6);
}

/**
 * Live WebGPU Born-Oppenheimer molecular geometry optimization (`F = -∇E_RHF`)
 * with translational-invariance gradient reduction and trust-radius backtracking!
 */
export async function optimizeMolecularGeometryWebGpu(device, atoms, {
  maxSteps = 8,
  stepSize = 0.28,
  maxDispBohr = 0.14,
  gradH = 4.0e-3,
  gradTol = 8.0e-3,
  maxScf = 22,
  tol = 1e-4,
  basisName = 'auto'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('optimizeMolecularGeometryWebGpu requires a live WebGPU GPUDevice');
  }
  const init = normalizeAtoms(atoms);
  const nAtoms = init.length;
  const Zs = init.map((a) => a.Z);
  let coords = init.map((a) => [...a.position]);
  const toList = (cs) => cs.map((p, idx) => ({ Z: Zs[idx], position: p }));

  let cachedP = null;
  let gpuRhfCalls = 0;

  async function evalPoint(cs, scfCap = maxScf) {
    const res = await solveMoleculeRhfWebGpu(device, toList(cs), {
      maxScf: scfCap,
      tol,
      basisName,
      sampleVolume: false,
      initialP: cachedP
    });
    gpuRhfCalls += 1;
    cachedP = res.densityMatrix;
    return res;
  }

  let cur = await evalPoint(coords, maxScf + 4);
  const eStartHa = cur.totalEnergyHa;
  const trajectory = [{
    step: 0,
    energyHa: cur.totalEnergyHa,
    energyEvRel: 0,
    maxForceHaPerBohr: 0,
    atoms: cur.atoms,
    bonds: cur.bonds
  }];

  let converged = false;
  let maxForce = Infinity;

  for (let step = 1; step <= maxSteps; step += 1) {
    // Central-difference gradient exploiting translational invariance Σ_a g_a = 0
    const grad = Array.from({ length: nAtoms }, () => [0, 0, 0]);
    const work = coords.map((p) => [...p]);
    const startAtom = nAtoms >= 2 ? 1 : 0;
    for (let a = startAtom; a < nAtoms; a += 1) {
      for (let d = 0; d < 3; d += 1) {
        const orig = work[a][d];
        work[a][d] = orig + gradH;
        const ep = (await evalPoint(work, 14)).totalEnergyHa;
        work[a][d] = orig - gradH;
        const em = (await evalPoint(work, 14)).totalEnergyHa;
        work[a][d] = orig;
        const g = (ep - em) / (2 * gradH);
        grad[a][d] = g;
        if (startAtom === 1) grad[0][d] -= g;
      }
    }
    maxForce = 0;
    for (let a = 0; a < nAtoms; a += 1) {
      for (let d = 0; d < 3; d += 1) maxForce = Math.max(maxForce, Math.abs(grad[a][d]));
    }
    trajectory[trajectory.length - 1].maxForceHaPerBohr = maxForce;
    if (maxForce < gradTol) {
      converged = true;
      break;
    }

    let alpha = Math.min(stepSize, maxDispBohr / Math.max(1e-8, maxForce));
    let accepted = false;
    for (let bt = 0; bt < 6; bt += 1) {
      const trial = coords.map((p, a) => [
        p[0] - alpha * grad[a][0],
        p[1] - alpha * grad[a][1],
        p[2] - alpha * grad[a][2]
      ]);
      const res = await evalPoint(trial, maxScf);
      if (res.totalEnergyHa <= cur.totalEnergyHa + 1e-6) {
        coords = trial;
        cur = res;
        accepted = true;
        break;
      }
      alpha *= 0.45;
    }
    trajectory.push({
      step,
      energyHa: cur.totalEnergyHa,
      energyEvRel: (cur.totalEnergyHa - eStartHa) * HA_TO_EV,
      maxForceHaPerBohr: maxForce,
      atoms: cur.atoms,
      bonds: cur.bonds
    });
    if (!accepted) break;
  }

  // Final high-accuracy GPU RHF with volume/orbitals on optimized geometry
  const finalRhf = await solveMoleculeRhfWebGpu(device, toList(coords), {
    maxScf: maxScf + 8,
    tol: 1e-5,
    volDim: 16,
    basisName,
    sampleVolume: true,
    initialP: cachedP
  });
  gpuRhfCalls += 1;

  return Object.freeze({
    schema: 'ulg.chemistry.geometry-optimization-webgpu.v1',
    backend: 'webgpu',
    basisUsed: finalRhf.basisUsed,
    converged,
    steps: trajectory.length - 1,
    gpuRhfCalls,
    initialEnergyHa: eStartHa,
    finalEnergyHa: finalRhf.totalEnergyHa,
    relaxationEv: (finalRhf.totalEnergyHa - eStartHa) * HA_TO_EV,
    maxForceHaPerBohr: maxForce,
    atoms: finalRhf.atoms,
    bonds: finalRhf.bonds,
    rhfResult: finalRhf,
    trajectory: Object.freeze(trajectory)
  });
}

function classifyModeLabel(disps, atoms, freqCm1) {
  if (freqCm1 < 0) return 'Imaginary (TS mode)';
  if (atoms.length === 2) return 'Bond Stretch';
  // Measure net bond-length change vs angle change to label stretch vs bend!
  let sumDeltaR = 0;
  let sumAbsDeltaR = 0;
  let bondCount = 0;
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const dx = atoms[j].position[0] - atoms[i].position[0];
      const dy = atoms[j].position[1] - atoms[i].position[1];
      const dz = atoms[j].position[2] - atoms[i].position[2];
      const r = Math.hypot(dx, dy, dz);
      if (r > 0.4 && r < 4.5) {
        const dr = ((disps[j][0] - disps[i][0]) * dx + (disps[j][1] - disps[i][1]) * dy + (disps[j][2] - disps[i][2]) * dz) / r;
        sumDeltaR += dr;
        sumAbsDeltaR += Math.abs(dr);
        bondCount += 1;
      }
    }
  }
  if (bondCount === 0) return 'Internal Mode';
  const stretchRatio = sumAbsDeltaR / bondCount;
  if (stretchRatio < 0.28) return 'Angle Bend / Deformation';
  if (Math.abs(sumDeltaR) > 0.65 * sumAbsDeltaR) return 'Symmetric Stretch';
  return 'Asymmetric Stretch';
}

/**
 * Compute isotope-resolved harmonic vibrational normal modes, ZPE, IR intensities
 * (|∂μ/∂Q_k|^2), Raman activities, and 3D animated Cartesian displacements on
 * WebGPU (GPU RHF Hessian + Eckart projection + GPU symmetric eigensolver)!
 */
export async function computeVibrationalModesWebGpu(device, atoms, {
  massesU = null,
  gradH = 1.2e-2,
  maxScf = 18,
  tol = 2e-4,
  basisName = 'auto'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('computeVibrationalModesWebGpu requires a live WebGPU GPUDevice');
  }
  const init = normalizeAtoms(atoms);
  const nAtoms = init.length;
  if (nAtoms < 2) {
    throw new RangeError('Vibrational normal-mode analysis requires at least 2 atoms');
  }
  const dim = 3 * nAtoms;
  const Zs = init.map((a) => a.Z);
  const coords = init.map((a) => [...a.position]);
  const massUArr = init.map((a, i) => {
    const explicit = Array.isArray(massesU) && Number.isFinite(Number(massesU[i])) ? Number(massesU[i]) : null;
    return Math.max(0.5, explicit ?? (ATOMIC_MASS_U[a.Z - 1] || a.Z * 2));
  });
  const massesAu = massUArr.map((m) => m * AMU_TO_ELECTRON_MASS);
  const toList = (cs) => cs.map((p, idx) => ({ Z: Zs[idx], position: p }));

  let gpuRhfCalls = 0;
  const baseRes = await solveMoleculeRhfWebGpu(device, toList(coords), {
    maxScf: maxScf + 8,
    tol: 1e-5,
    basisName,
    sampleVolume: false
  });
  gpuRhfCalls += 1;
  const baseP = baseRes.densityMatrix;
  const e0 = baseRes.totalEnergyHa;
  const effBasis = baseRes.basisUsed || basisName;

  async function evalAt(cs) {
    const r = await solveMoleculeRhfWebGpu(device, toList(cs), {
      maxScf,
      tol,
      basisName: effBasis,
      sampleVolume: false,
      initialP: baseP
    });
    gpuRhfCalls += 1;
    return r;
  }

  // Compute exact 2nd-order finite-difference Hessian H_ij = ∂²E / (∂x_i ∂x_j)
  // AND 1st-order dipole-moment derivatives dmu/dx_i simultaneously in ONE sweep!
  const H = Array.from({ length: dim }, () => new Float64Array(dim));
  const ePlus = new Float64Array(dim);
  const eMinus = new Float64Array(dim);
  const dMuDx = Array.from({ length: dim }, () => [0, 0, 0]);
  const work = coords.map((p) => [...p]);

  for (let i = 0; i < dim; i += 1) {
    const ai = Math.floor(i / 3);
    const di = i % 3;
    const orig = work[ai][di];
    work[ai][di] = orig + gradH;
    const rp = await evalAt(work);
    ePlus[i] = rp.totalEnergyHa;
    work[ai][di] = orig - gradH;
    const rm = await evalAt(work);
    eMinus[i] = rm.totalEnergyHa;
    work[ai][di] = orig;

    H[i][i] = (ePlus[i] - 2 * e0 + eMinus[i]) / (gradH * gradH);
    for (let ax = 0; ax < 3; ax += 1) {
      dMuDx[i][ax] = ((rp.dipoleVecDebye?.[ax] ?? 0) - (rm.dipoleVecDebye?.[ax] ?? 0)) / (2 * gradH);
    }
  }

  // Off-diagonal Hessian elements via symmetric +/+ and -/- displacements:
  // ∂²E/(∂x_i ∂x_j) ≈ (E(++ ) + E(--) - E(+0) - E(-0) - E(0+) - E(0-) + 2 E0) / (2 h^2)
  for (let i = 0; i < dim; i += 1) {
    const ai = Math.floor(i / 3);
    const di = i % 3;
    const origI = work[ai][di];
    for (let j = i + 1; j < dim; j += 1) {
      const aj = Math.floor(j / 3);
      const dj = j % 3;
      const origJ = work[aj][dj];

      work[ai][di] = origI + gradH;
      work[aj][dj] = origJ + gradH;
      const ePP = (await evalAt(work)).totalEnergyHa;

      work[ai][di] = origI - gradH;
      work[aj][dj] = origJ - gradH;
      const eMM = (await evalAt(work)).totalEnergyHa;

      work[ai][di] = origI;
      work[aj][dj] = origJ;

      const hij = (ePP + eMM - ePlus[i] - eMinus[i] - ePlus[j] - eMinus[j] + 2 * e0) / (2 * gradH * gradH);
      H[i][j] = hij;
      H[j][i] = hij;
    }
  }

  // Mass-weight H_mw[i][j] = H[i][j] / sqrt(m_i m_j)
  const Hmw = Array.from({ length: dim }, () => new Float64Array(dim));
  for (let i = 0; i < dim; i += 1) {
    const smi = Math.sqrt(massesAu[Math.floor(i / 3)]);
    for (let j = 0; j < dim; j += 1) {
      const smj = Math.sqrt(massesAu[Math.floor(j / 3)]);
      Hmw[i][j] = H[i][j] / (smi * smj);
    }
  }

  // Apply exact Eckart projection P = I - D D^T -> H_proj = P H_mw P
  const trBasis = buildEckartProjectionBasis(coords, massesAu);
  const P = Array.from({ length: dim }, (_, r) => {
    const row = new Float64Array(dim);
    row[r] = 1;
    for (const v of trBasis) {
      for (let c = 0; c < dim; c += 1) row[c] -= v[r] * v[c];
    }
    return row;
  });
  const PH = Array.from({ length: dim }, () => new Float64Array(dim));
  for (let i = 0; i < dim; i += 1) {
    for (let j = 0; j < dim; j += 1) {
      let s = 0;
      for (let k = 0; k < dim; k += 1) s += P[i][k] * Hmw[k][j];
      PH[i][j] = s;
    }
  }
  const hProjFlat = new Float32Array(dim * dim);
  for (let i = 0; i < dim; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = 0;
      for (let k = 0; k < dim; k += 1) s += PH[i][k] * P[k][j];
      hProjFlat[i * dim + j] = s;
      hProjFlat[j * dim + i] = s;
    }
  }

  // Diagonalize projected mass-weighted Hessian STRICTLY ON WEBGPU!
  const eig = await solveSymmetricEigenBatchedWebGpu(device, {
    matrices: hProjFlat,
    n: dim,
    batchCount: 1,
    maxSweeps: 32,
    tolerance: 1e-7
  });

  // Identify vibrational eigenvectors (orthogonal to trBasis; drop the trBasis.length projected null modes!)
  const allEntries = [];
  for (let k = 0; k < dim; k += 1) {
    const lam = eig.eigenvalues[k];
    const vec = new Float64Array(dim);
    for (let i = 0; i < dim; i += 1) vec[i] = eig.eigenvectors[i * dim + k];
    // Overlap with rigid translation/rotation subspace
    let trProj = 0;
    for (const b of trBasis) {
      let dot = 0;
      for (let i = 0; i < dim; i += 1) dot += b[i] * vec[i];
      trProj += dot * dot;
    }
    allEntries.push({ k, lam, vec, trProj });
  }
  // Drop the `trBasis.length` modes with largest translation/rotation projection (5 for linear, 6 for nonlinear)
  const sortedByTr = [...allEntries].sort((a, b) => b.trProj - a.trProj);
  const droppedSet = new Set(sortedByTr.slice(0, trBasis.length).map((e) => e.k));
  const vibEntries = allEntries.filter((e) => !droppedSet.has(e.k)).sort((a, b) => a.lam - b.lam);

  const modes = [];
  let totalZpeEv = 0;
  for (let idx = 0; idx < vibEntries.length; idx += 1) {
    const entry = vibEntries[idx];
    const sign = entry.lam >= 0 ? 1 : -1;
    const freqCm1 = sign * Math.sqrt(Math.abs(entry.lam)) * HARTREE_TO_CM1;
    const zpeEv = freqCm1 > 0 ? 0.5 * freqCm1 * CM1_TO_EV : 0;
    totalZpeEv += zpeEv;

    // Mass-unweighted Cartesian displacements q_i = L_i / sqrt(m_i)
    const rawDisp = [];
    let maxDisp = 1e-8;
    const dMuQ = [0, 0, 0];
    for (let a = 0; a < nAtoms; a += 1) {
      const invSm = 1 / Math.sqrt(massesAu[a]);
      const dx = entry.vec[a * 3 + 0] * invSm;
      const dy = entry.vec[a * 3 + 1] * invSm;
      const dz = entry.vec[a * 3 + 2] * invSm;
      rawDisp.push([dx, dy, dz]);
      maxDisp = Math.max(maxDisp, Math.hypot(dx, dy, dz));
      for (let ax = 0; ax < 3; ax += 1) {
        dMuQ[ax] += dMuDx[a * 3 + 0][ax] * dx + dMuDx[a * 3 + 1][ax] * dy + dMuDx[a * 3 + 2][ax] * dz;
      }
    }
    // Scale IR intensity in (Debye / Å)^2 * (1/amu) -> km/mol conversion factor ≈ 42.256
    const irRaw = (dMuQ[0] ** 2 + dMuQ[1] ** 2 + dMuQ[2] ** 2) * AMU_TO_ELECTRON_MASS / (BOHR_TO_A ** 2);
    const irIntensityKmPerMol = irRaw * 42.256;
    const normDisp = rawDisp.map((v) => [v[0] / maxDisp, v[1] / maxDisp, v[2] / maxDisp]);

    // Raman polarizability-modulation activity proxy: symmetric bond-breathing amplitude^2
    let symBreath = 0;
    for (let i = 0; i < nAtoms; i += 1) {
      for (let j = i + 1; j < nAtoms; j += 1) {
        const rx = coords[j][0] - coords[i][0];
        const ry = coords[j][1] - coords[i][1];
        const rz = coords[j][2] - coords[i][2];
        const r = Math.hypot(rx, ry, rz);
        if (r > 0.4 && r < 4.8) {
          const dr = ((normDisp[j][0] - normDisp[i][0]) * rx + (normDisp[j][1] - normDisp[i][1]) * ry + (normDisp[j][2] - normDisp[i][2]) * rz) / r;
          symBreath += dr;
        }
      }
    }
    const ramanActivity = Math.max(0.05, symBreath * symBreath * 18.0 + 0.35);

    modes.push(Object.freeze({
      modeIndex: idx,
      freqCm1,
      isImaginary: freqCm1 < 0,
      zpeEv,
      irIntensityKmPerMol,
      ramanActivity,
      label: classifyModeLabel(normDisp, init, freqCm1),
      displacements: Object.freeze(normDisp.map((v) => Object.freeze(v)))
    }));
  }

  // Synthesize smooth Lorentzian-broadened IR & Raman vibrational spectra (0 .. maxFreq+600 cm^-1)
  const maxPosFreq = Math.max(2500, ...modes.map((m) => Math.max(0, m.freqCm1))) + 500;
  const nSpec = 120;
  const wavenumbersCm1 = new Float32Array(nSpec);
  const irSpectrum = new Float32Array(nSpec);
  const ramanSpectrum = new Float32Array(nSpec);
  const gamma = Math.max(45, maxPosFreq * 0.018);
  for (let s = 0; s < nSpec; s += 1) {
    const nu = (s / (nSpec - 1)) * maxPosFreq;
    wavenumbersCm1[s] = nu;
    let irSum = 0;
    let ramSum = 0;
    for (const m of modes) {
      if (m.freqCm1 <= 10) continue;
      const d = nu - m.freqCm1;
      const lor = (gamma * gamma) / (d * d + gamma * gamma);
      irSum += m.irIntensityKmPerMol * lor;
      ramSum += m.ramanActivity * lor;
    }
    irSpectrum[s] = irSum;
    ramanSpectrum[s] = ramSum;
  }

  return Object.freeze({
    schema: ULG_MOLECULAR_VIBRATIONS_SCHEMA,
    backend: 'webgpu',
    basisUsed: effBasis,
    gpuRhfCalls,
    massesU: Object.freeze(massUArr),
    atoms: baseRes.atoms,
    bonds: baseRes.bonds,
    projectedNullModes: trBasis.length,
    modes: Object.freeze(modes),
    totalZpeEv,
    totalZpeKjPerMol: totalZpeEv * 96.48533212,
    spectrum: Object.freeze({ wavenumbersCm1, irSpectrum, ramanSpectrum }),
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'webgpu-derived',
      solver: 'gpumath-rhf-hessian-eckart-eigen',
      scientificValidation: false
    })
  });
}

export async function registerMolecularVibrationsClosureArtifact({
  closureRegistry,
  formula = 'unknown',
  vibrations = null
} = {}) {
  const artifact = {
    closureId: `ulg-molecular-vibrations:${String(formula).replace(/[^a-zA-Z0-9_-]/g, '_')}.v1`,
    closureKind: 'molecular-vibrational-hessian-ir-raman',
    inputHash: `${formula}:zpe=${(vibrations?.totalZpeEv ?? 0).toFixed(4)}:modes=${vibrations?.modes?.length ?? 0}`,
    methodHash: 'gpumath-rhf-hessian-eckart-webgpu.v1',
    execution: {
      mode: 'webgpu-hessian-eigen',
      formula,
      totalZpeEv: vibrations?.totalZpeEv ?? null,
      frequenciesCm1: vibrations?.modes?.map((m) => m.freqCm1) ?? []
    },
    validity: { harmonicApproximation: true },
    provenance: {
      schema: ULG_MOLECULAR_VIBRATIONS_SCHEMA,
      sourceModule: 'src/runtime/chemistry/molecularVibrationsWebGpu.js',
      scientificValidation: false
    }
  };
  const ref = closureRegistry ? await closureRegistry.store(artifact) : null;
  return { ref, artifact };
}

export function registerMolecularVibrationsSimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  return registry.registerModule({
    method: { model: 'molecular-vibrations-gpu', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/chemistry/molecularVibrationsWebGpu.js',
      entryPoint: 'computeVibrationalModesWebGpu',
      workgroupSize: 64
    },
    parameterSchema: {
      atoms: { type: 'array' },
      massesU: { type: 'array' }
    },
    stateLayout: { tensorId: 'molecular_vibrational_normal_modes', dtype: 'f32', components: 3 },
    stepCapsule: async (capsule, context) => {
      const device = context?.device;
      if (!device) throw new Error('molecular-vibrations-gpu@1 requires a WebGPU device');
      const p = capsule?.parameters || {};
      const result = await computeVibrationalModesWebGpu(device, p.atoms || [], p);
      return { status: 'ok', result };
    }
  });
}
