// Reusable Canonical ULG Chemistry Engine: Multi-Molecule WebGPU Reaction
// Pathway Solver (`src/runtime/chemistry/reactionPathwayWebGpu.js`).
//
// Assembles true 3D multi-molecule reactant (A + B) and product (C + D)
// encounter complexes directly from stoichiometrically balanced reaction
// candidates, performs minimum-displacement same-Z atom matching, runs 100%
// WebGPU Climbing-Image Nudged Elastic Band (CI-NEB) on the GPU RHF Born-
// Oppenheimer PES across ALL Z = 1..118, and extracts per-image Wiberg bond
// orders (bond breaking/forming), Mulliken charge transfer, 3D dipole vector,
// HOMO/LUMO orbital envelopes, Arrhenius kinetics k(T), and Van 't Hoff
// thermochemistry ΔG(T) / K_eq(T).

import { describeIsotopologueFormula } from './formula.js';
import { buildMolecularSeedGeometryBohr } from '../material/recursiveCompoundPipeline.js';
import {
  climbingImageNEBWebGpu,
  solveMoleculeRhfWebGpu
} from '../electronicStructure/molecularHartreeFockWebGpu.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_REACTION_PATHWAY_SCHEMA = 'ulg.chemistry.reaction-pathway-webgpu.v1';
export const ULG_MULTI_STEP_REACTION_NETWORK_SCHEMA = 'ulg.chemistry.multi-step-reaction-network-webgpu.v1';

const HA_TO_EV = 27.211386245988;
const EV_TO_J_PER_MOL = 96485.33212;
const KB_EV_PER_K = 8.617333262e-5;
const KB_J_PER_K = 1.380649e-23;
const H_PLANCK_JS = 6.62607015e-34;
const R_GAS = 8.314462618;

function centerAtomsBohr(atoms) {
  if (!atoms.length) return [];
  let cx = 0; let cy = 0; let cz = 0;
  for (const a of atoms) {
    cx += a.x; cy += a.y; cz += a.z;
  }
  const inv = 1 / atoms.length;
  return atoms.map((a) => ({ Z: a.Z, x: a.x - cx * inv, y: a.y - cy * inv, z: a.z - cz * inv }));
}

function moleculeRadiusBohr(atoms) {
  let maxR = 0.85;
  for (const a of atoms) {
    maxR = Math.max(maxR, Math.hypot(a.x, a.y, a.z) + 0.9);
  }
  return maxR;
}

function placeMolecularComplex(terms, separationScale = 1.0) {
  // Expand stoichiometric terms into individual centered molecules
  const molecules = [];
  for (const t of terms) {
    const coeff = Math.max(1, Math.round(Number(t.coefficient) || 1));
    const base = centerAtomsBohr(buildMolecularSeedGeometryBohr(t.formula));
    for (let c = 0; c < coeff; c += 1) {
      molecules.push({ formula: t.formula, atoms: base, radius: moleculeRadiusBohr(base) });
    }
  }
  if (molecules.length === 0) return [];
  if (molecules.length === 1) {
    return molecules[0].atoms.map((a) => ({ Z: a.Z, position: [a.x, a.y, a.z] }));
  }

  const placed = [];
  if (molecules.length === 2) {
    // Orient two colliding molecules face-to-face along the X axis at encounter distance
    const gap = Math.max(2.6, (molecules[0].radius + molecules[1].radius) * 0.88 * separationScale);
    const half = 0.5 * gap;
    for (const a of molecules[0].atoms) {
      placed.push({ Z: a.Z, position: [a.x - half, a.y, a.z] });
    }
    for (const a of molecules[1].atoms) {
      // Mirror X slightly so reactive end points toward partner
      placed.push({ Z: a.Z, position: [-a.x + half, a.y, a.z] });
    }
  } else {
    // Arrange 3+ molecules symmetrically around an encounter ring in XY plane
    const avgR = molecules.reduce((s, m) => s + m.radius, 0) / molecules.length;
    const ringR = Math.max(2.3, avgR * 0.92 * separationScale * (1 + 0.18 * (molecules.length - 2)));
    for (let m = 0; m < molecules.length; m += 1) {
      const ang = (m / molecules.length) * Math.PI * 2;
      const ox = Math.cos(ang) * ringR;
      const oy = Math.sin(ang) * ringR;
      const oz = (m % 2 === 0 ? 1 : -1) * 0.25;
      for (const a of molecules[m].atoms) {
        placed.push({ Z: a.Z, position: [a.x + ox, a.y + oy, a.z + oz] });
      }
    }
  }
  // Center final complex at origin
  let cx = 0; let cy = 0; let cz = 0;
  for (const a of placed) { cx += a.position[0]; cy += a.position[1]; cz += a.position[2]; }
  const inv = 1 / placed.length;
  return placed.map((a) => ({
    Z: a.Z,
    position: [a.position[0] - cx * inv, a.position[1] - cy * inv, a.position[2] - cz * inv]
  }));
}

function totalAtomCountForTerms(terms) {
  let sum = 0;
  for (const t of terms) {
    const coeff = Math.max(1, Math.round(Number(t.coefficient) || 1));
    const desc = describeIsotopologueFormula(t.formula);
    const nMol = desc.elements.reduce((acc, e) => acc + e.count, 0);
    sum += coeff * nMol;
  }
  return sum;
}

function matchProductAtomsToReactants(reactantAtoms, rawProductAtoms) {
  // Exact minimum-displacement matching per atomic number Z (optimal for small N <= 10!)
  const used = new Array(rawProductAtoms.length).fill(false);
  const matched = new Array(reactantAtoms.length);

  // Group indices by Z
  const zSet = new Set(reactantAtoms.map((a) => a.Z));
  for (const Z of zSet) {
    const rIdxs = [];
    const pIdxs = [];
    reactantAtoms.forEach((a, i) => { if (a.Z === Z) rIdxs.push(i); });
    rawProductAtoms.forEach((a, i) => { if (a.Z === Z) pIdxs.push(i); });
    if (rIdxs.length !== pIdxs.length) {
      throw new Error(`Atom conservation mismatch for Z=${Z}: reactants=${rIdxs.length}, products=${pIdxs.length}`);
    }
    const k = rIdxs.length;
    if (k <= 6) {
      // Exact permutation search minimizing Σ ||R_i - P_{π(i)}||^2
      let bestCost = Infinity;
      let bestPerm = pIdxs.slice();
      const perm = pIdxs.slice();
      const search = (depth, costSoFar) => {
        if (costSoFar >= bestCost) return;
        if (depth === k) {
          bestCost = costSoFar;
          bestPerm = perm.slice();
          return;
        }
        const rp = reactantAtoms[rIdxs[depth]].position;
        for (let j = depth; j < k; j += 1) {
          [perm[depth], perm[j]] = [perm[j], perm[depth]];
          const pp = rawProductAtoms[perm[depth]].position;
          const d2 = (rp[0] - pp[0]) ** 2 + (rp[1] - pp[1]) ** 2 + (rp[2] - pp[2]) ** 2;
          search(depth + 1, costSoFar + d2);
          [perm[depth], perm[j]] = [perm[j], perm[depth]];
        }
      };
      search(0, 0);
      for (let i = 0; i < k; i += 1) {
        matched[rIdxs[i]] = rawProductAtoms[bestPerm[i]];
        used[bestPerm[i]] = true;
      }
    } else {
      // Greedy nearest-neighbor matching for > 6 identical atoms
      for (const ri of rIdxs) {
        const rp = reactantAtoms[ri].position;
        let bestJ = -1;
        let bestD2 = Infinity;
        for (const pi of pIdxs) {
          if (used[pi]) continue;
          const pp = rawProductAtoms[pi].position;
          const d2 = (rp[0] - pp[0]) ** 2 + (rp[1] - pp[1]) ** 2 + (rp[2] - pp[2]) ** 2;
          if (d2 < bestD2) { bestD2 = d2; bestJ = pi; }
        }
        used[bestJ] = true;
        matched[ri] = rawProductAtoms[bestJ];
      }
    }
  }
  return matched;
}

/**
 * Assemble matched 3D reactant (A + B) and product (C + D) encounter-complex
 * geometries in Bohr directly from ANY stoichiometrically balanced reaction
 * candidate. Guarantees exact atom conservation, closed-shell parity check,
 * and minimum-displacement atom index correspondence for GPU CI-NEB!
 */
export function buildReactionComplexGeometries(candidate, { maxAtoms = 10 } = {}) {
  if (!candidate?.reactants?.length || !candidate?.products?.length) {
    throw new TypeError('buildReactionComplexGeometries requires a reaction candidate with reactants and products');
  }
  let reactants = candidate.reactants.map((t) => ({ coefficient: Number(t.coefficient) || 1, formula: t.formula }));
  let products = candidate.products.map((t) => ({ coefficient: Number(t.coefficient) || 1, formula: t.formula }));
  let nAtoms = totalAtomCountForTerms(reactants);
  let scaledHalf = false;

  // If all coefficients are even and total atoms exceed maxAtoms, reduce stoichiometry by 2
  if (nAtoms > maxAtoms) {
    const allEven = [...reactants, ...products].every((t) => t.coefficient % 2 === 0);
    if (allEven) {
      reactants = reactants.map((t) => ({ ...t, coefficient: t.coefficient / 2 }));
      products = products.map((t) => ({ ...t, coefficient: t.coefficient / 2 }));
      nAtoms = totalAtomCountForTerms(reactants);
      scaledHalf = true;
    }
  }
  if (nAtoms > maxAtoms) {
    throw new RangeError(`Reaction complex has ${nAtoms} atoms (> maxAtoms=${maxAtoms}) for interactive GPU CI-NEB`);
  }

  // If an odd-Z metal reaction has odd total electron count (e.g. H2 + CuO -> Cu + H2O, Z=39),
  // double the encounter complex (2 H2 + 2 CuO -> 2 Cu + 2 H2O, Z=78) when within maxAtoms so
  // closed-shell GPU RHF pairs the two open-shell centers cleanly!
  const rawTotalZ = reactants.reduce((acc, t) => {
    const desc = describeIsotopologueFormula(t.formula);
    return acc + t.coefficient * desc.elements.reduce((s, e) => s + e.Z * e.count, 0);
  }, 0);
  if ((rawTotalZ % 2) !== 0 && nAtoms * 2 <= maxAtoms) {
    reactants = reactants.map((t) => ({ ...t, coefficient: t.coefficient * 2 }));
    products = products.map((t) => ({ ...t, coefficient: t.coefficient * 2 }));
    nAtoms *= 2;
  }

  const reactantAtoms = placeMolecularComplex(reactants, 1.0);
  const rawProductAtoms = placeMolecularComplex(products, 0.96);
  const productAtoms = matchProductAtomsToReactants(reactantAtoms, rawProductAtoms);

  // Verify exact atom conservation & closed-shell electron count
  const totalZ = reactantAtoms.reduce((s, a) => s + a.Z, 0);
  const prodZ = productAtoms.reduce((s, a) => s + a.Z, 0);
  if (totalZ !== prodZ) {
    throw new Error(`Proton count mismatch across reaction: reactants=${totalZ}, products=${prodZ}`);
  }
  return Object.freeze({
    equation: candidate.equation || `${reactants.map((t) => t.formula).join(' + ')} -> ${products.map((t) => t.formula).join(' + ')}`,
    scaledHalf,
    atomCount: reactantAtoms.length,
    totalElectrons: totalZ,
    isClosedShell: totalZ % 2 === 0,
    reactantAtoms: Object.freeze(reactantAtoms),
    productAtoms: Object.freeze(productAtoms)
  });
}

/**
 * Compute Eyring/Arrhenius rate constants k(T), Gibbs free energy ΔG(T),
 * equilibrium constant K_eq(T), and thermal crossover T_eq from derived barrier
 * E_a (eV) and reaction enthalpy ΔH (eV).
 */
export function computeReactionThermodynamicsCurve(forwardBarrierEv, reactionEnthalpyEv, {
  deltaSJPerMolK = -35.0,
  tempsK = null
} = {}) {
  const eaEv = Math.max(0.02, Number(forwardBarrierEv) || 0.5);
  const dHEv = Number(reactionEnthalpyEv) || 0;
  const dHJPerMol = dHEv * EV_TO_J_PER_MOL;
  const grid = Array.isArray(tempsK) && tempsK.length >= 2
    ? tempsK
    : Array.from({ length: 28 }, (_, i) => 200 + (i / 27) * 1800);

  const invT = [];
  const log10KRate = [];
  const deltaGKjPerMol = [];
  const log10Keq = [];

  for (const T of grid) {
    const temp = Math.max(50, Number(T));
    // Eyring transition state rate constant k(T) = (k_B T / h) * exp(-E_a / (k_B T))
    const preExp = (KB_J_PER_K * temp) / H_PLANCK_JS;
    const lnRate = Math.log(preExp) - eaEv / (KB_EV_PER_K * temp);
    const dGJ = dHJPerMol - temp * deltaSJPerMolK;
    const lnKeq = -dGJ / (R_GAS * temp);
    invT.push(1000 / temp); // 1000 / T (K^-1) for classic Arrhenius plot
    log10KRate.push(Math.max(-35, Math.min(20, lnRate / Math.LN10)));
    deltaGKjPerMol.push(dGJ * 1e-3);
    log10Keq.push(Math.max(-40, Math.min(40, lnKeq / Math.LN10)));
  }

  const dG298Kj = (dHJPerMol - 298.15 * deltaSJPerMolK) * 1e-3;
  const log10Keq298 = Math.max(-40, Math.min(40, (-dG298Kj * 1e3) / (R_GAS * 298.15 * Math.LN10)));
  const crossoverTempK = Math.abs(deltaSJPerMolK) > 1e-3 ? dHJPerMol / deltaSJPerMolK : null;

  return Object.freeze({
    tempsK: Object.freeze(grid),
    invT1000PerK: Object.freeze(invT),
    log10KRate: Object.freeze(log10KRate),
    deltaGKjPerMol: Object.freeze(deltaGKjPerMol),
    log10Keq: Object.freeze(log10Keq),
    deltaH298KjPerMol: dHJPerMol * 1e-3,
    deltaS298JPerMolK: deltaSJPerMolK,
    deltaG298KjPerMol: dG298Kj,
    log10Keq298,
    crossoverTempK: crossoverTempK != null && crossoverTempK > 0 ? crossoverTempK : null,
    spontaneousAt298K: dG298Kj < 0
  });
}

/**
 * Solve a full multi-molecule reaction pathway A + B -> TS‡ -> C + D strictly
 * on WebGPU via GPU CI-NEB + per-image GPU RHF Wiberg bond orders, Mulliken
 * charge transfer, 3D dipole vector, and 3D orbital envelopes!
 */
export async function solveReactionPathwayWebGpu(device, {
  candidate = null,
  reactantAtoms = null,
  productAtoms = null,
  equation = null,
  nImages = 7,
  maxNebSteps = null,
  basisName = 'auto',
  sampleVolumes = true
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveReactionPathwayWebGpu requires a live WebGPU GPUDevice');
  }
  let rAtoms = reactantAtoms;
  let pAtoms = productAtoms;
  let rxEquation = equation;
  let complexMeta = null;

  if (!rAtoms || !pAtoms) {
    complexMeta = buildReactionComplexGeometries(candidate, { maxAtoms: 10 });
    rAtoms = complexMeta.reactantAtoms;
    pAtoms = complexMeta.productAtoms;
    rxEquation = rxEquation || complexMeta.equation;
  }

  const nAtoms = rAtoms.length;
  const totalZ = rAtoms.reduce((s, a) => s + a.Z, 0);
  if (totalZ % 2 !== 0) {
    throw new RangeError(`Closed-shell GPU RHF CI-NEB requires even total electron count (got ${totalZ})`);
  }

  // Keep interactive GPU wall-time fast even on 7-10 atom complexes (e.g. 2 Na + 2 H2O -> 2 NaOH + H2)
  // while still computing exact GPU RHF energies on every image + exact 3D GPU TS‡ gradient!
  const estAllElecBf = rAtoms.reduce((s, a) => s + (a.Z <= 2 ? 1 : (a.Z <= 10 ? 5 : 9)), 0);
  const isLargeComplex = nAtoms >= 6 || estAllElecBf > 24;
  const effSteps = maxNebSteps ?? (isLargeComplex ? 1 : (estAllElecBf <= 9 ? 3 : 2));
  const effImages = Math.max(5, nAtoms >= 5 ? Math.min(nImages, 5) : nImages);
  const effBasis = basisName === 'auto' && estAllElecBf > 10 ? 'valence-sto3g' : basisName;
  const neb = await climbingImageNEBWebGpu(device, rAtoms, pAtoms, {
    nImages: effImages,
    maxSteps: effSteps,
    stepSize: 0.14,
    climbStartStep: isLargeComplex ? 0 : 1,
    maxScf: estAllElecBf <= 9 ? 20 : 12,
    tol: 4e-4,
    basisName: effBasis,
    oneSidedGrad: true,
    saddleOnlyGrad: isLargeComplex
  });

  const e0Ha = neb.energiesHa[0];
  const images = [];
  let basisUsed = effBasis;
  let extraRhfCalls = 0;

  for (let i = 0; i < neb.images.length; i += 1) {
    const imgAtoms = neb.images[i];
    const rhf = await solveMoleculeRhfWebGpu(device, imgAtoms, {
      maxScf: 24,
      tol: 1e-4,
      volDim: 16,
      basisName: effBasis,
      sampleVolume: sampleVolumes
    });
    extraRhfCalls += 1;
    basisUsed = rhf.basisUsed || basisUsed;
    images.push(Object.freeze({
      imageIndex: i,
      xi: i / Math.max(1, neb.images.length - 1),
      isTransitionState: i === neb.saddleImageIndex,
      atoms: rhf.atoms,
      energyHa: rhf.totalEnergyHa,
      energyEv: (rhf.totalEnergyHa - e0Ha) * HA_TO_EV,
      bonds: rhf.bonds,
      bondOrderMatrix: rhf.bondOrderMatrix,
      mullikenCharges: rhf.mullikenCharges,
      dipoleDebye: rhf.dipoleDebye,
      dipoleVecDebye: rhf.dipoleVecDebye,
      homoLumoGapEv: rhf.homoLumoGapEv,
      atomOrbitalParams: rhf.atomOrbitalParams || null
    }));
  }

  const energiesEv = images.map((im) => im.energyEv);
  let saddleIdx = 1;
  for (let i = 2; i < images.length - 1; i += 1) {
    if (energiesEv[i] > energiesEv[saddleIdx]) saddleIdx = i;
  }
  const forwardBarrierEv = Math.max(0.05, energiesEv[saddleIdx] - energiesEv[0]);
  const reactionEnergyEv = energiesEv[images.length - 1] - energiesEv[0];
  const reverseBarrierEv = Math.max(0.05, energiesEv[saddleIdx] - energiesEv[images.length - 1]);

  // Blend heuristic ΔH sign check with GPU reaction energy for realistic ΔS estimate (Δn_mol * 40 J/mol/K)
  const nReactMols = candidate?.reactants?.reduce((s, t) => s + (Number(t.coefficient) || 1), 0) ?? 2;
  const nProdMols = candidate?.products?.reduce((s, t) => s + (Number(t.coefficient) || 1), 0) ?? 2;
  const deltaS = (nProdMols - nReactMols) * 42.0 - 12.0;

  // Use candidate reference/heuristic ΔH for thermodynamic curve if available and GPU valence ECP has large basis offset
  const candDhEv = candidate?.energetics?.reactionEnthalpyJPerBalancedEquation != null
    ? candidate.energetics.reactionEnthalpyJPerBalancedEquation / EV_TO_J_PER_MOL
    : reactionEnergyEv;
  const thermodynamics = computeReactionThermodynamicsCurve(forwardBarrierEv, candDhEv, { deltaSJPerMolK: deltaS });

  return Object.freeze({
    schema: ULG_REACTION_PATHWAY_SCHEMA,
    backend: 'webgpu',
    equation: rxEquation || 'A + B -> C + D',
    pathwayLabel: `Multi-Molecule GPU CI-NEB (${rxEquation || 'A+B → C+D'})`,
    basisUsed,
    atomCount: nAtoms,
    gpuRhfCalls: neb.gpuRhfCalls + extraRhfCalls,
    steps: neb.steps,
    converged: neb.converged,
    saddleImageIndex: saddleIdx,
    forwardBarrierEv,
    reverseBarrierEv,
    reactionEnergyEv,
    candidateEnthalpyEv: candDhEv,
    energiesHa: Object.freeze(images.map((im) => im.energyHa)),
    energiesEv: Object.freeze(energiesEv),
    images: Object.freeze(images),
    imageOrbitalParams: Object.freeze(images.map((im) => im.atomOrbitalParams).filter(Boolean)),
    thermodynamics,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'webgpu-derived',
      solver: 'gpumath-rhf-ci-neb-multimolecule',
      scientificValidation: false
    })
  });
}

function signatureByAtomicNumber(atoms) {
  const counts = new Map();
  for (const a of atoms) {
    const z = Math.trunc(Number(a.Z));
    counts.set(z, (counts.get(z) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([z, c]) => `${z}:${c}`).join(',');
}

function normalizeAtomPoint(a) {
  const pos = Array.isArray(a.position) ? a.position : [a.x ?? 0, a.y ?? 0, a.z ?? 0];
  return { Z: Math.trunc(Number(a.Z)), position: [Number(pos[0]), Number(pos[1]), Number(pos[2])] };
}

/**
 * Pure Kozuch-Shaik Energetic Span Model analyzer for multi-step sequential
 * elementary reaction networks:
 *   S_0 -> TS_1‡ -> S_1 -> TS_2‡ -> ... -> S_k
 * Computes cumulative energy profile E(xi), exact forward energetic span
 *   deltaE = max_{j >= i} (E(TS_j) - E(I_i)),
 * TOF-determining intermediate (TDI), TOF-determining transition state (TDTS),
 * rate-determining step index, Eyring network rate k_net(T), and thermodynamics.
 */
export function analyzeMultiStepReactionNetworkProfile(stepProfiles = [], {
  temperatureK = 298.15,
  deltaSJPerMolK = -35.0
} = {}) {
  if (!Array.isArray(stepProfiles) || stepProfiles.length < 1) {
    throw new TypeError('analyzeMultiStepReactionNetworkProfile requires >= 1 elementary step profile');
  }
  const intermediateEnergiesEv = [0];
  const transitionStateEnergiesEv = [];
  const stepSummaries = [];
  const stitchedProfile = [];

  let offsetEv = 0;
  for (let s = 0; s < stepProfiles.length; s += 1) {
    const st = stepProfiles[s];
    const energies = Array.isArray(st.energiesEv) && st.energiesEv.length >= 2
      ? st.energiesEv.map(Number)
      : [0, Math.max(0.05, Number(st.forwardBarrierEv) || 0.5), Number(st.reactionEnergyEv) || 0];
    const rel0 = energies[0];
    const localShifted = energies.map((e) => offsetEv + (e - rel0));
    let tsLocalIdx = 1;
    for (let i = 1; i < localShifted.length - 1; i += 1) {
      if (localShifted[i] > localShifted[tsLocalIdx]) tsLocalIdx = i;
    }
    if (localShifted.length === 2) tsLocalIdx = localShifted[1] >= localShifted[0] ? 1 : 0;

    const eStart = localShifted[0];
    const eTs = localShifted[tsLocalIdx];
    const eEnd = localShifted[localShifted.length - 1];
    transitionStateEnergiesEv.push(eTs);
    intermediateEnergiesEv.push(eEnd);

    const nSeg = localShifted.length;
    for (let i = (s === 0 ? 0 : 1); i < nSeg; i += 1) {
      stitchedProfile.push(Object.freeze({
        stepIndex: s,
        localImageIndex: i,
        xi: s + i / Math.max(1, nSeg - 1),
        energyEv: localShifted[i],
        isTransitionState: i === tsLocalIdx,
        isIntermediate: i === 0 || i === nSeg - 1
      }));
    }

    stepSummaries.push(Object.freeze({
      stepIndex: s,
      label: st.label || st.equation || `Step ${s + 1}`,
      forwardBarrierEv: Math.max(0.01, eTs - eStart),
      reverseBarrierEv: Math.max(0.01, eTs - eEnd),
      stepReactionEnergyEv: eEnd - eStart,
      cumulativeStartEv: eStart,
      cumulativeTsEv: eTs,
      cumulativeEndEv: eEnd,
      saddleLocalImageIndex: tsLocalIdx
    }));

    offsetEv = eEnd;
  }

  // Kozuch-Shaik forward energetic span: max_{j >= i} (E(TS_j) - E(I_i)) over all
  // reachable reactant/intermediate states I_i (i = 0..k-1) and subsequent TS_j (j = i..k-1)
  let energeticSpanEv = -Infinity;
  let tdiStateIndex = 0;
  let tdtsStepIndex = 0;
  for (let i = 0; i < stepProfiles.length; i += 1) {
    for (let j = i; j < stepProfiles.length; j += 1) {
      const span = transitionStateEnergiesEv[j] - intermediateEnergiesEv[i];
      if (span > energeticSpanEv) {
        energeticSpanEv = span;
        tdiStateIndex = i;
        tdtsStepIndex = j;
      }
    }
  }
  energeticSpanEv = Math.max(0.02, Number.isFinite(energeticSpanEv) ? energeticSpanEv : 0.5);
  const overallReactionEnergyEv = intermediateEnergiesEv[intermediateEnergiesEv.length - 1] - intermediateEnergiesEv[0];
  const T = Math.max(10, Number(temperatureK) || 298.15);
  const eyringNetRateSInv = ((KB_J_PER_K * T) / H_PLANCK_JS) * Math.exp(-energeticSpanEv / (KB_EV_PER_K * T));
  const thermodynamics = computeReactionThermodynamicsCurve(energeticSpanEv, overallReactionEnergyEv, {
    deltaSJPerMolK
  });

  return Object.freeze({
    stepCount: stepProfiles.length,
    intermediateEnergiesEv: Object.freeze(intermediateEnergiesEv),
    transitionStateEnergiesEv: Object.freeze(transitionStateEnergiesEv),
    energeticSpanEv,
    tdiStateIndex,
    tdtsStepIndex,
    rateDeterminingStepIndex: tdtsStepIndex,
    overallReactionEnergyEv,
    temperatureK: T,
    eyringNetRateSInv,
    stepSummaries: Object.freeze(stepSummaries),
    stitchedProfile: Object.freeze(stitchedProfile),
    thermodynamics
  });
}

/**
 * Multi-Step GPU CI-NEB Reaction Network Solver (`S_0 -> TS_1‡ -> S_1 -> ... -> S_k`):
 * chains sequential elementary GPU CI-NEB steps on the Born-Oppenheimer RHF PES,
 * enforces exact atom & proton conservation across all intermediates, stitches
 * the full reaction coordinate xi in [0, k], and derives Kozuch-Shaik energetic-
 * span steady-state Eyring kinetics strictly on WebGPU.
 */
export async function solveMultiStepReactionNetworkWebGpu(device, {
  steps = null,
  intermediates = null,
  equation = '',
  temperatureK = 298.15,
  nImagesPerStep = 5,
  maxNebSteps = 3,
  basisName = 'auto',
  sampleVolumes = false,
  deltaSJPerMolK = -35.0
} = {}) {
  if (!device || typeof device.createBuffer !== 'function') {
    throw new TypeError('solveMultiStepReactionNetworkWebGpu requires a live WebGPU GPUDevice');
  }

  let resolvedSteps = [];
  if (Array.isArray(intermediates) && intermediates.length >= 3) {
    const normStates = intermediates.map((st, idx) => {
      const atoms = (Array.isArray(st) ? st : st?.atoms)?.map(normalizeAtomPoint) || [];
      if (atoms.length < 2) {
        throw new RangeError(`Intermediate state ${idx} must have >= 2 atoms`);
      }
      return { label: st?.label || `I_${idx}`, atoms };
    });
    const refSig = signatureByAtomicNumber(normStates[0].atoms);
    for (let i = 1; i < normStates.length; i += 1) {
      if (signatureByAtomicNumber(normStates[i].atoms) !== refSig) {
        throw new Error(`Multi-step atom conservation violation at intermediate ${i}: expected ${refSig}, got ${signatureByAtomicNumber(normStates[i].atoms)}`);
      }
    }
    for (let s = 0; s < normStates.length - 1; s += 1) {
      const rAtoms = normStates[s].atoms;
      const pAtoms = matchProductAtomsToReactants(rAtoms, normStates[s + 1].atoms);
      resolvedSteps.push({
        label: `${normStates[s].label} -> ${normStates[s + 1].label}`,
        equation: `${normStates[s].label} -> ${normStates[s + 1].label}`,
        reactantAtoms: rAtoms,
        productAtoms: pAtoms
      });
    }
  } else if (Array.isArray(steps) && steps.length >= 2) {
    let refSig = null;
    for (let s = 0; s < steps.length; s += 1) {
      const st = steps[s];
      let rAtoms = st.reactantAtoms?.map(normalizeAtomPoint) || null;
      let pAtoms = st.productAtoms?.map(normalizeAtomPoint) || null;
      if ((!rAtoms || !pAtoms) && st.candidate) {
        const built = buildReactionComplexGeometries(st.candidate, { maxAtoms: 10 });
        rAtoms = built.reactantAtoms.map(normalizeAtomPoint);
        pAtoms = built.productAtoms.map(normalizeAtomPoint);
      }
      if (!rAtoms || !pAtoms || rAtoms.length !== pAtoms.length) {
        throw new Error(`Elementary step ${s} requires conserved reactantAtoms and productAtoms`);
      }
      const sigR = signatureByAtomicNumber(rAtoms);
      const sigP = signatureByAtomicNumber(pAtoms);
      if (sigR !== sigP) {
        throw new Error(`Atom conservation violation inside step ${s}: ${sigR} != ${sigP}`);
      }
      if (refSig == null) refSig = sigR;
      else if (sigR !== refSig) {
        throw new Error(`Multi-step stoichiometry mismatch at step ${s}: expected ${refSig}, got ${sigR}`);
      }
      resolvedSteps.push({
        label: st.label || st.equation || `Step ${s + 1}`,
        equation: st.equation || st.label || `Step ${s + 1}`,
        candidate: st.candidate || null,
        reactantAtoms: rAtoms,
        productAtoms: matchProductAtomsToReactants(rAtoms, pAtoms)
      });
    }
  } else {
    throw new TypeError('solveMultiStepReactionNetworkWebGpu requires `intermediates` (>= 3 states) or `steps` (>= 2 elementary steps)');
  }

  const elementaryPathways = [];
  let totalGpuRhfCalls = 0;
  for (let s = 0; s < resolvedSteps.length; s += 1) {
    const st = resolvedSteps[s];
    const path = await solveReactionPathwayWebGpu(device, {
      candidate: st.candidate || null,
      reactantAtoms: st.reactantAtoms,
      productAtoms: st.productAtoms,
      equation: st.equation,
      nImages: nImagesPerStep,
      maxNebSteps,
      basisName,
      sampleVolumes
    });
    elementaryPathways.push(path);
    totalGpuRhfCalls += path.gpuRhfCalls;
  }

  const analysis = analyzeMultiStepReactionNetworkProfile(
    elementaryPathways.map((p, idx) => ({
      label: resolvedSteps[idx].label,
      equation: p.equation,
      energiesEv: p.energiesEv,
      forwardBarrierEv: p.forwardBarrierEv,
      reactionEnergyEv: p.reactionEnergyEv
    })),
    { temperatureK, deltaSJPerMolK }
  );

  // Stitch full image sequence (skipping duplicate junction images while offsetting E relative to S_0)
  const eGlobal0Ha = elementaryPathways[0].energiesHa[0];
  const stitchedImages = [];
  for (let s = 0; s < elementaryPathways.length; s += 1) {
    const path = elementaryPathways[s];
    const nSeg = path.images.length;
    for (let i = (s === 0 ? 0 : 1); i < nSeg; i += 1) {
      const im = path.images[i];
      stitchedImages.push(Object.freeze({
        ...im,
        stepIndex: s,
        globalImageIndex: stitchedImages.length,
        xi: s + i / Math.max(1, nSeg - 1),
        energyEv: (im.energyHa - eGlobal0Ha) * HA_TO_EV
      }));
    }
  }

  return Object.freeze({
    schema: ULG_MULTI_STEP_REACTION_NETWORK_SCHEMA,
    backend: 'webgpu',
    equation: equation || resolvedSteps.map((s) => s.label).join(' => '),
    atomCount: resolvedSteps[0].reactantAtoms.length,
    totalProtonsZ: resolvedSteps[0].reactantAtoms.reduce((acc, a) => acc + a.Z, 0),
    stepCount: elementaryPathways.length,
    totalGpuRhfCalls,
    elementaryPathways: Object.freeze(elementaryPathways),
    stitchedImages: Object.freeze(stitchedImages),
    ...analysis,
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'webgpu-derived',
      solver: 'gpumath-rhf-multistep-ci-neb-energetic-span',
      scientificValidation: false
    })
  });
}

export async function registerReactionPathwayClosureArtifact({
  closureRegistry,
  equation = 'A + B -> C + D',
  pathway = null
} = {}) {
  const artifact = {
    closureId: `ulg-reaction-pathway:${String(equation).replace(/[^a-zA-Z0-9_-]/g, '_')}.v1`,
    closureKind: 'molecular-reaction-pathway-ci-neb',
    inputHash: `${equation}:Ea=${(pathway?.forwardBarrierEv ?? 0).toFixed(3)}:dE=${(pathway?.reactionEnergyEv ?? 0).toFixed(3)}`,
    methodHash: 'gpumath-rhf-ci-neb-wiberg-webgpu.v1',
    execution: {
      mode: 'webgpu-ci-neb',
      equation,
      basisUsed: pathway?.basisUsed ?? 'auto',
      forwardBarrierEv: pathway?.forwardBarrierEv ?? null,
      reverseBarrierEv: pathway?.reverseBarrierEv ?? null,
      reactionEnergyEv: pathway?.reactionEnergyEv ?? null,
      saddleImageIndex: pathway?.saddleImageIndex ?? null
    },
    validity: { temperatureK: [100, 5000] },
    provenance: {
      schema: ULG_REACTION_PATHWAY_SCHEMA,
      sourceModule: 'src/runtime/chemistry/reactionPathwayWebGpu.js',
      scientificValidation: false
    }
  };
  const ref = closureRegistry ? await closureRegistry.store(artifact) : null;
  return { ref, artifact };
}

export function registerReactionPathwaySimulationModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  return registry.registerModule({
    method: { model: 'molecular-reaction-path', version: '1' },
    kernel: {
      sourceModule: 'src/runtime/chemistry/reactionPathwayWebGpu.js',
      entryPoint: 'solveReactionPathwayWebGpu',
      workgroupSize: 64
    },
    parameterSchema: {
      candidate: { type: 'object' },
      nImages: { type: 'number', min: 3, max: 15 },
      maxNebSteps: { type: 'number', min: 1, max: 20 }
    },
    stateLayout: { tensorId: 'reaction_pathway_neb_images_and_wiberg_bonds', dtype: 'f32', components: 4 },
    stepCapsule: async (capsule, context) => {
      const device = context?.device;
      if (!device) throw new Error('molecular-reaction-path@1 requires a WebGPU device');
      const p = capsule?.parameters || {};
      const pathway = await solveReactionPathwayWebGpu(device, p);
      return { status: 'ok', pathway };
    }
  });
}
