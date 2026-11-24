// Gate 2 (Stage P2.1): WebGPU-Accelerated Molecular Electronic Structure
// (`src/runtime/electronicStructure/molecularHartreeFockWebGpu.js`).
//
// Executes molecular STO-3G RHF generalized Fock diagonalization `F C = S C ε`
// strictly on WebGPU via Gate 0B's `solveGeneralizedSymmetricEigenBatchedWebGpu`
// (Löwdin S^{-1/2} on GPU, zero CPU eigensolver!), plus a GPU compute pass
// sampling live 3D molecular electron density & HOMO/LUMO signed orbital lobes
// for real-time volumetric visualization in `elements-lab.html`.

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { solveGeneralizedSymmetricEigenBatchedWebGpu } from '../gpuMath/batchedSymmetricEigensolverGpu.js';
import { buildIntegrals } from './molecularHartreeFock.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_MOLECULAR_HF_WEBGPU_SCHEMA = 'ulg.electronic.molecular-hf-webgpu.v1';

const HA_TO_EV = 27.211386245988;
const GPU_BUFFER_USAGE = Object.freeze({
  MAP_READ: 0x01,
  COPY_SRC: 0x04,
  COPY_DST: 0x08,
  UNIFORM: 0x40,
  STORAGE: 0x80
});

const molecularVolumeWgsl = /* wgsl */ `
struct MolVolParams {
  dim: u32,
  atom_count: u32,
  mode: u32, // 0 = total electron density, 1 = HOMO signed orbital, 2 = LUMO signed orbital
  pad0: u32,
  box_half_bohr: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
};

// Per-atom compact orbital envelope: vec4(x, y, z, zeta), vec4(occ_weight, homo_coeff, lumo_coeff, Z)
@group(0) @binding(0) var<uniform> params: MolVolParams;
@group(0) @binding(1) var<storage, read> atoms_pos_zeta: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_weights: array<vec4<f32>>;
// Output dim^3 vec4(pos_amp, neg_amp, core_norm, density)
@group(0) @binding(3) var<storage, read_write> volume_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn sample_molecular_volume(@builtin(global_invocation_id) id: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = id.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let fx = ((f32(ix) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fy = ((f32(iy) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let fz = ((f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;
  let p = vec3<f32>(fx, fy, fz) * params.box_half_bohr;

  var rho_tot = 0.0;
  var psi_orb = 0.0;
  var min_r = 1e9;
  for (var a = 0u; a < params.atom_count; a = a + 1u) {
    let az = atoms_pos_zeta[a];
    let aw = atoms_weights[a];
    let r = length(p - az.xyz);
    min_r = min(min_r, r);
    let phi = exp(-az.w * r);
    rho_tot = rho_tot + aw.x * phi * phi;
    let c = select(aw.z, aw.y, params.mode == 1u);
    psi_orb = psi_orb + c * phi;
  }
  if (params.mode == 0u) {
    let d = clamp(pow(max(0.0, rho_tot * 0.65), 0.72), 0.0, 1.0);
    let bond_glow = clamp(abs(psi_orb) * 0.85, 0.0, 1.0);
    volume_out[idx] = vec4<f32>(
      clamp(d * 0.82 + bond_glow * 0.25, 0.0, 1.0),
      clamp(d * 0.48 + bond_glow * 0.55, 0.0, 1.0),
      clamp(d * 1.05 + bond_glow * 0.35, 0.0, 1.0),
      d
    );
  } else {
    let pos_a = clamp(max(0.0, psi_orb), 0.0, 1.0);
    let neg_a = clamp(max(0.0, -psi_orb), 0.0, 1.0);
    let d = clamp(abs(psi_orb), 0.0, 1.0);
    volume_out[idx] = vec4<f32>(pos_a, neg_a, clamp(min_r / max(params.box_half_bohr, 1.0), 0.0, 1.0), d);
  }
}
`;

function nuclearRepulsionHa(atoms) {
  let e = 0;
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const dx = atoms[i].x - atoms[j].x;
      const dy = atoms[i].y - atoms[j].y;
      const dz = atoms[i].z - atoms[j].z;
      const r = Math.hypot(dx, dy, dz);
      if (r > 1e-8) e += (atoms[i].Z * atoms[j].Z) / r;
    }
  }
  return e;
}

/**
 * Solve closed-shell molecular RHF on WebGPU using `gpuMath` generalized
 * symmetric eigensolver (`F C = S C ε`) + GPU 3D orbital/density volume sampling.
 */
export async function solveMoleculeRhfWebGpu(device, atoms, {
  maxScf = 35,
  tol = 1e-5,
  damping = 0.35,
  volDim = 24,
  volumeMode = 0,
  basisName = 'sto-3g',
  sampleVolume = true,
  initialP = null
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveMoleculeRhfWebGpu requires a live WebGPU GPUDevice');
  }
  if (!Array.isArray(atoms) || atoms.length === 0) {
    throw new TypeError('solveMoleculeRhfWebGpu requires non-empty atoms array');
  }
  const normAtoms = atoms.map((a) => {
    const pos = Array.isArray(a.position) ? a.position : [Number(a.x) || 0, Number(a.y) || 0, Number(a.z) || 0];
    return { Z: Math.trunc(a.Z), x: pos[0], y: pos[1], z: pos[2], position: pos };
  });
  const { basis, n, nElectrons, S, Hcore, eri, idx, nuclearRepulsion: eNuc } = buildIntegrals(normAtoms, 0, basisName);
  const totalElectrons = nElectrons;
  const nOcc = Math.max(1, Math.floor(totalElectrons / 2));

  const sFloat = new Float32Array(n * n);
  const hFlat = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      sFloat[i * n + j] = S[i][j];
      hFlat[i * n + j] = Hcore[i][j];
    }
  }

  let P = (initialP && initialP.length === n * n)
    ? new Float64Array(initialP)
    : new Float64Array(n * n);
  let lastE = 0;
  let eigvals = new Float32Array(n);
  let C = new Float32Array(n * n);
  let scfIter = 0;

  for (let iter = 0; iter < maxScf; iter += 1) {
    scfIter = iter + 1;
    const fFlat = new Float64Array(n * n);
    for (let u = 0; u < n; u += 1) {
      for (let v = 0; v < n; v += 1) {
        let g = 0;
        for (let l = 0; l < n; l += 1) {
          for (let s = 0; s < n; s += 1) {
            const pLs = P[l * n + s];
            if (pLs === 0) continue;
            g += pLs * (eri[idx(u, v, l, s)] - 0.5 * eri[idx(u, s, l, v)]);
          }
        }
        fFlat[u * n + v] = hFlat[u * n + v] + g;
      }
    }
    const fFloat = Float32Array.from(fFlat);
    // Generalized Fock eigensolve strictly on WebGPU!
    const eig = await solveGeneralizedSymmetricEigenBatchedWebGpu(device, {
      fockMatrices: fFloat,
      overlapMatrices: sFloat,
      n,
      batchCount: 1,
      maxSweeps: 28,
      tolerance: 1e-6
    });
    eigvals = eig.eigenvalues;
    C = eig.eigenvectors;

    const Pnew = new Float64Array(n * n);
    for (let u = 0; u < n; u += 1) {
      for (let v = 0; v < n; v += 1) {
        let s = 0;
        for (let k = 0; k < Math.min(nOcc, n); k += 1) {
          s += 2 * C[u * n + k] * C[v * n + k];
        }
        Pnew[u * n + v] = (1 - damping) * s + damping * P[u * n + v];
      }
    }
    let eElec = 0;
    for (let i = 0; i < n * n; i += 1) eElec += 0.5 * Pnew[i] * (hFlat[i] + fFlat[i]);
    const eTot = eElec + eNuc;
    P = Pnew;
    if (iter > 1 && Math.abs(eTot - lastE) < tol) {
      lastE = eTot;
      break;
    }
    lastE = eTot;
  }

  const homoIdx = Math.max(0, Math.min(n - 1, nOcc - 1));
  const lumoIdx = Math.min(n - 1, nOcc);
  const homoHa = eigvals[homoIdx];
  const lumoHa = nOcc < n ? eigvals[lumoIdx] : homoHa + 0.4;
  const homoLumoGapEv = Math.max(0.1, (lumoHa - homoHa) * HA_TO_EV);

  if (!sampleVolume) {
    return Object.freeze({
      schema: ULG_MOLECULAR_HF_WEBGPU_SCHEMA,
      backend: 'webgpu',
      basisCount: n,
      electronCount: totalElectrons,
      atoms: Object.freeze(normAtoms.map((a) => Object.freeze({ Z: a.Z, x: a.x, y: a.y, z: a.z }))),
      scfIterations: scfIter,
      totalEnergyHa: lastE,
      nuclearRepulsionHa: eNuc,
      homoEnergyHa: homoHa,
      lumoEnergyHa: lumoHa,
      homoLumoGapEv,
      densityMatrix: P,
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      provenance: Object.freeze({
        status: 'webgpu-derived',
        scientificValidation: false,
        solver: 'gpumath-rhf-lowdin-sto3g'
      })
    });
  }

  // Mulliken atomic charges & electric dipole moment (Debye)
  const mullikenCharges = new Float64Array(normAtoms.length);
  for (let a = 0; a < normAtoms.length; a += 1) mullikenCharges[a] = normAtoms[a].Z;
  for (let u = 0; u < n; u += 1) {
    let ps = 0;
    for (let v = 0; v < n; v += 1) ps += P[u * n + v] * S[v][u];
    const atomIdx = basis[u].atomIndex ?? 0;
    if (atomIdx < mullikenCharges.length) mullikenCharges[atomIdx] -= ps;
  }
  let dxDip = 0; let dyDip = 0; let dzDip = 0;
  for (let a = 0; a < normAtoms.length; a += 1) {
    dxDip += mullikenCharges[a] * normAtoms[a].x;
    dyDip += mullikenCharges[a] * normAtoms[a].y;
    dzDip += mullikenCharges[a] * normAtoms[a].z;
  }
  const dipoleDebye = Math.hypot(dxDip, dyDip, dzDip) * 2.541746;

  // Sample live 3D molecular electron density / HOMO-LUMO volume on WebGPU
  const volBindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'storage')
  ];
  const volPipe = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-mol-hf-volume.v1',
    label: 'ulg-mol-hf-volume',
    code: molecularVolumeWgsl,
    entryPoint: 'sample_molecular_volume',
    bindings: volBindings
  });

  const posZeta = new Float32Array(normAtoms.length * 4);
  const weights = new Float32Array(normAtoms.length * 4);
  let maxCoord = 1.5;
  for (let a = 0; a < normAtoms.length; a += 1) {
    const at = normAtoms[a];
    maxCoord = Math.max(maxCoord, Math.hypot(at.x, at.y, at.z) + 2.5);
    posZeta[a * 4 + 0] = at.x;
    posZeta[a * 4 + 1] = at.y;
    posZeta[a * 4 + 2] = at.z;
    posZeta[a * 4 + 3] = Math.max(0.85, Math.min(2.6, 0.9 + 0.14 * Math.sqrt(at.Z)));
    // Sum MO coefficients on this atom
    let cHomo = 0; let cLumo = 0; let pop = 0;
    for (let u = 0; u < n; u += 1) {
      if ((basis[u].atomIndex ?? 0) === a) {
        cHomo += C[u * n + homoIdx];
        cLumo += C[u * n + lumoIdx];
        pop += P[u * n + u];
      }
    }
    weights[a * 4 + 0] = Math.max(0.5, pop);
    weights[a * 4 + 1] = cHomo;
    weights[a * 4 + 2] = cLumo;
    weights[a * 4 + 3] = at.Z;
  }

  const volCount = volDim ** 3;
  const pData = new ArrayBuffer(32);
  new Uint32Array(pData, 0, 4).set([volDim, normAtoms.length, volumeMode, 0]);
  new Float32Array(pData, 16, 4).set([maxCoord, 0, 0, 0]);

  const pBuf = device.createBuffer({ size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(pBuf, 0, pData);
  const azBuf = device.createBuffer({ size: Math.max(16, posZeta.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(azBuf, 0, posZeta);
  const wBuf = device.createBuffer({ size: Math.max(16, weights.byteLength), usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(wBuf, 0, weights);
  const volBuf = device.createBuffer({ size: volCount * 16, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const readVol = device.createBuffer({ size: volCount * 16, usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST });

  const bg = device.createBindGroup({
    layout: volPipe.bindGroupLayout,
    entries: [pBuf, azBuf, wBuf, volBuf].map((buffer, binding) => ({ binding, resource: { buffer } }))
  });
  const enc = device.createCommandEncoder({ label: 'ulg-mol-hf-volume' });
  const pass = enc.beginComputePass({ label: 'ulg-mol-hf-volume-pass' });
  pass.setPipeline(volPipe.pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(volCount / 64));
  pass.end();
  enc.copyBufferToBuffer(volBuf, 0, readVol, 0, volCount * 16);
  device.queue.submit([enc.finish()]);

  try {
    await readVol.mapAsync(GPU_BUFFER_USAGE.MAP_READ);
    const volumeData = new Float32Array(readVol.getMappedRange().slice(0, volCount * 16));
    readVol.unmap();
    return Object.freeze({
      schema: ULG_MOLECULAR_HF_WEBGPU_SCHEMA,
      backend: 'webgpu',
      basisCount: n,
      electronCount: totalElectrons,
      atoms: Object.freeze(normAtoms.map((a) => Object.freeze({ Z: a.Z, x: a.x, y: a.y, z: a.z }))),
      scfIterations: scfIter,
      totalEnergyHa: lastE,
      nuclearRepulsionHa: eNuc,
      homoEnergyHa: homoHa,
      lumoEnergyHa: lumoHa,
      homoLumoGapEv,
      dipoleDebye,
      mullikenCharges: Array.from(mullikenCharges),
      orbitalEnergiesHa: Array.from(eigvals),
      volDim,
      boxHalfBohr: maxCoord,
      volumeData,
      atomOrbitalParams: Object.freeze({
        posZeta: new Float32Array(posZeta),
        weights: new Float32Array(weights),
        boxHalfBohr: maxCoord,
        homoIdx,
        lumoIdx
      }),
      accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
      provenance: Object.freeze({
        status: 'webgpu-derived',
        scientificValidation: false,
        solver: 'gpumath-rhf-lowdin-sto3g'
      })
    });
  } finally {
    for (const b of [pBuf, azBuf, wBuf, volBuf, readVol]) b.destroy();
  }
}

export const ULG_CI_NEB_WEBGPU_SCHEMA = 'ulg.electronic.ci-neb-webgpu.v1';

/**
 * 100% WebGPU Climbing-Image Nudged Elastic Band (CI-NEB) Transition-State
 * Barrier Finder (`climbingImageNEBWebGpu`):
 *
 * Evaluates every reaction image's electronic energy and central-difference
 * nuclear force via GPU generalized Fock diagonalization (`solveMoleculeRhfWebGpu`
 * with warm-started density matrices — ZERO CPU eigensolver!), applying the
 * Henkelman-Jónsson improved upwind tangent and climbing-image saddle inversion.
 */
export async function climbingImageNEBWebGpu(device, reactantAtoms, productAtoms, {
  nImages = 5,
  maxSteps = 5,
  springK = 0.08,
  stepSize = 0.14,
  climbStartStep = 1,
  forceTol = 0.015,
  gradH = 2.5e-3,
  maxScf = 22,
  tol = 1e-4,
  basisName = 'sto-3g'
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('climbingImageNEBWebGpu requires a live WebGPU GPUDevice');
  }
  const toPos = (a) => (Array.isArray(a.position)
    ? [Number(a.position[0]) || 0, Number(a.position[1]) || 0, Number(a.position[2]) || 0]
    : [Number(a.x) || 0, Number(a.y) || 0, Number(a.z) || 0]);
  const Zs = reactantAtoms.map((a) => Math.trunc(a.Z));
  const nAtoms = Zs.length;
  const rPos = reactantAtoms.map(toPos);
  const pPos = productAtoms.map(toPos);

  const images = [];
  for (let img = 0; img < nImages; img += 1) {
    const f = img / Math.max(1, nImages - 1);
    images.push(rPos.map((rp, i) => [
      rp[0] + f * (pPos[i][0] - rp[0]),
      rp[1] + f * (pPos[i][1] - rp[1]),
      rp[2] + f * (pPos[i][2] - rp[2])
    ]));
  }
  const flatSub = (A, B) => {
    const out = [];
    for (let i = 0; i < nAtoms; i += 1) {
      out.push(A[i][0] - B[i][0], A[i][1] - B[i][1], A[i][2] - B[i][2]);
    }
    return out;
  };
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  const toAtomList = (coords) => coords.map((p, idx) => ({ Z: Zs[idx], position: p }));

  const cachedP = new Array(nImages).fill(null);
  let gpuRhfCalls = 0;

  async function evalEnergyAndGrad(imgIdx, coords, computeGrad) {
    const base = await solveMoleculeRhfWebGpu(device, toAtomList(coords), {
      maxScf,
      tol,
      basisName,
      sampleVolume: false,
      initialP: cachedP[imgIdx]
    });
    gpuRhfCalls += 1;
    cachedP[imgIdx] = base.densityMatrix;
    if (!computeGrad) {
      return { energyHa: base.totalEnergyHa, grad: new Array(3 * nAtoms).fill(0) };
    }
    const grad = new Array(3 * nAtoms).fill(0);
    // Use translational invariance sum_a F_a = 0 to compute atom 0 gradient from -sum_{a>0} grad_a,
    // cutting finite-difference GPU RHF calls by 1/nAtoms while remaining exact!
    const work = coords.map((p) => [...p]);
    const startAtom = nAtoms >= 2 ? 1 : 0;
    for (let a = startAtom; a < nAtoms; a += 1) {
      for (let d = 0; d < 3; d += 1) {
        const orig = work[a][d];
        work[a][d] = orig + gradH;
        const ep = (await solveMoleculeRhfWebGpu(device, toAtomList(work), {
          maxScf: 14, tol, basisName, sampleVolume: false, initialP: cachedP[imgIdx]
        })).totalEnergyHa;
        gpuRhfCalls += 1;
        work[a][d] = orig - gradH;
        const em = (await solveMoleculeRhfWebGpu(device, toAtomList(work), {
          maxScf: 14, tol, basisName, sampleVolume: false, initialP: cachedP[imgIdx]
        })).totalEnergyHa;
        gpuRhfCalls += 1;
        work[a][d] = orig;
        const gVal = (ep - em) / (2 * gradH);
        grad[a * 3 + d] = gVal;
        if (startAtom === 1) grad[d] -= gVal;
      }
    }
    return { energyHa: base.totalEnergyHa, grad };
  }

  let energies = new Array(nImages).fill(0);
  let maxForce = Infinity;
  let converged = false;
  let stepsRun = 0;

  // Evaluate fixed endpoints once on WebGPU
  const end0 = await evalEnergyAndGrad(0, images[0], false);
  const endN = await evalEnergyAndGrad(nImages - 1, images[nImages - 1], false);

  for (let step = 0; step < maxSteps; step += 1) {
    stepsRun = step + 1;
    const grads = new Array(nImages);
    energies = new Array(nImages);
    energies[0] = end0.energyHa;
    grads[0] = end0.grad;
    energies[nImages - 1] = endN.energyHa;
    grads[nImages - 1] = endN.grad;

    for (let i = 1; i < nImages - 1; i += 1) {
      const res = await evalEnergyAndGrad(i, images[i], true);
      energies[i] = res.energyHa;
      grads[i] = res.grad;
    }

    let iMax = 1;
    for (let i = 2; i < nImages - 1; i += 1) {
      if (energies[i] > energies[iMax]) iMax = i;
    }

    const nebForces = new Array(nImages);
    maxForce = 0;
    for (let i = 1; i < nImages - 1; i += 1) {
      const dPlus = flatSub(images[i + 1], images[i]);
      const dMinus = flatSub(images[i], images[i - 1]);
      let tau;
      if (energies[i + 1] > energies[i] && energies[i] > energies[i - 1]) {
        tau = dPlus;
      } else if (energies[i + 1] < energies[i] && energies[i] < energies[i - 1]) {
        tau = dMinus;
      } else {
        const dEmax = Math.max(Math.abs(energies[i + 1] - energies[i]), Math.abs(energies[i - 1] - energies[i]));
        const dEmin = Math.min(Math.abs(energies[i + 1] - energies[i]), Math.abs(energies[i - 1] - energies[i]));
        tau = energies[i + 1] > energies[i - 1]
          ? dPlus.map((v, k) => v * dEmax + dMinus[k] * dEmin)
          : dPlus.map((v, k) => v * dEmin + dMinus[k] * dEmax);
      }
      const tauNorm = Math.max(1e-12, norm(tau));
      const tauHat = tau.map((v) => v / tauNorm);
      const trueForce = grads[i].map((g) => -g);
      const fPar = dot(trueForce, tauHat);

      let totalForce;
      if (step >= climbStartStep && i === iMax) {
        totalForce = trueForce.map((f, k) => f - 2 * fPar * tauHat[k]);
      } else {
        const fPerp = trueForce.map((f, k) => f - fPar * tauHat[k]);
        const fSpring = springK * (norm(dPlus) - norm(dMinus));
        totalForce = fPerp.map((f, k) => f + fSpring * tauHat[k]);
      }
      nebForces[i] = totalForce;
      maxForce = Math.max(maxForce, ...totalForce.map(Math.abs));
    }

    if (maxForce < forceTol && step >= climbStartStep) {
      converged = true;
      break;
    }

    const maxDisp = 0.08;
    for (let i = 1; i < nImages - 1; i += 1) {
      const f = nebForces[i];
      const fMag = Math.max(1e-12, norm(f));
      const scale = Math.min(stepSize, maxDisp / fMag);
      for (let a = 0; a < nAtoms; a += 1) {
        images[i][a][0] += scale * f[a * 3];
        images[i][a][1] += scale * f[a * 3 + 1];
        images[i][a][2] += scale * f[a * 3 + 2];
      }
    }
  }

  let saddleImageIndex = 1;
  for (let i = 2; i < nImages - 1; i += 1) {
    if (energies[i] > energies[saddleImageIndex]) saddleImageIndex = i;
  }
  return Object.freeze({
    schema: ULG_CI_NEB_WEBGPU_SCHEMA,
    backend: 'webgpu',
    gpuRhfCalls,
    images: Object.freeze(images.map((coords) => Object.freeze(coords.map((p, idx) => Object.freeze({ Z: Zs[idx], position: [...p] }))))),
    energiesHa: Object.freeze([...energies]),
    saddleImageIndex,
    transitionStateAtoms: Object.freeze(images[saddleImageIndex].map((p, idx) => Object.freeze({ Z: Zs[idx], position: [...p] }))),
    forwardBarrierHa: Math.max(0, energies[saddleImageIndex] - energies[0]),
    reverseBarrierHa: Math.max(0, energies[saddleImageIndex] - energies[nImages - 1]),
    reactionEnergyHa: energies[nImages - 1] - energies[0],
    maxForceHaPerBohr: maxForce,
    steps: stepsRun,
    converged,
    provenance: Object.freeze({
      status: 'webgpu-derived',
      solver: 'gpumath-rhf-ci-neb',
      scientificValidation: false
    })
  });
}
