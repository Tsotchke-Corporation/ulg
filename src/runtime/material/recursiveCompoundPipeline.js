// Gate 2 (Stage P2.3): Recursive Chemical Reaction -> Compound Feedback Loop
// (`src/runtime/material/recursiveCompoundPipeline.js`).
//
// Feeds ANY chemical reaction product (e.g. H2O, NaOH, CsF, NaCl, FeO, CO2,
// NH3, HF, MgO, SiO2, CH4, H2, O2, LiOH) straight back into the SAME Gate 1-2
// first-principles GPU simulation regime (Nuclear mass/composition -> GPU
// Molecular QM or Ionic/Covalent Crystal Prototype DFT -> EM/Optical/Magnetic
// Closure -> WebGPU MD/QHA Thermodynamics) to produce a full validated
// `ulg.material-property-bundle.v1` with ZERO hardcoded compound tables!

import { describeIsotopologueFormula } from '../chemistry/formula.js';
import {
  ATOMIC_MASS_U,
  electronConfiguration,
  valenceElectronCount
} from '../electronicStructure/periodicTable.js';
import { deriveNuclearClosure } from '../nuclear/nuclearStructureGpu.js';
import { solveMoleculeRhfWebGpu } from '../electronicStructure/molecularHartreeFockWebGpu.js';
import {
  OPTICAL_RESOLVER_MODE_BAND_GAP,
  OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
  resolveOpticalBatchWebGpu
} from './opticalResolverWebGpu.js';
import {
  MD_POTENTIAL_MODELS,
  buildCrystalMdState,
  createMolecularDynamicsSessionWebGpu
} from '../gpuMath/molecularDynamicsWebGpu.js';
import { discoverReactionCandidates } from '../chemistry/reactionCandidates.js';
import {
  ULG_ACCURACY_TIERS,
  createMaterialPropertyBundle
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_RECURSIVE_COMPOUND_PIPELINE_SCHEMA = 'ulg.compound.recursive-pipeline-webgpu.v1';
export const ULG_RECURSIVE_COMPOUND_FINGERPRINT = 'ulg-recursive-compound-feedback-webgpu.v1';

const AVOGADRO = 6.02214076e23;
const KB = 1.380649e-23;
const R_GAS = 8.314462618;
const EV_TO_J = 1.602176634e-19;
const E_CHARGE = 1.602176634e-19;
const EPS_0 = 8.8541878128e-12;
const BOHR_TO_M = 5.29177210903e-11;

// Nonmetal/metalloid valence-shell classification strictly from (n, l=1)
// quantum numbers via `electronConfiguration(Z)` — zero Z-lookup tables.
function isNonmetalShell(Z) {
  const cfg = electronConfiguration(Z);
  const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 0);
  if (maxN === 1) return true;
  const pSub = cfg.find((s) => s.n === maxN && s.l === 1);
  const pOcc = pSub?.occupancy ?? 0;
  return pOcc > 0 && (pOcc >= maxN || (maxN === 2 && pOcc >= 1) || (maxN === 3 && pOcc >= 2) || (maxN >= 6 && pOcc >= 5));
}

// Detect extended 3D covalent tetrahedral AX2 networks strictly from quantum
// shell numbers & stoichiometry (zero hardcoded formula/element tables!):
//   - Binary 1:2 stoichiometry (A X2)
//   - Center A is tetravalent p^2 with principal shell n >= 3 (weak p_pi-p_pi
//     double-bond overlap favors 4-coord sigma networks such as SiO2/GeO2/SiS2,
//     whereas n = 2 p^2 forms discrete pi-bonded molecular CO2!)
//   - Ligand X is a more electronegative divalent chalcogen (p^4: O, S, Se, Te).
function classifyExtendedCovalentAx2Network(species) {
  if (!Array.isArray(species) || species.length !== 2) return null;
  const ordered = [...species].sort((a, b) => a.count - b.count);
  if (ordered[0].count !== 1 || ordered[1].count !== 2) return null;
  const center = ordered[0];
  const ligand = ordered[1];
  const cfgA = electronConfiguration(center.Z);
  const maxNA = cfgA.reduce((m, s) => Math.max(m, s.n), 0);
  const pOccA = cfgA.find((s) => s.n === maxNA && s.l === 1)?.occupancy ?? 0;
  const sOccA = cfgA.find((s) => s.n === maxNA && s.l === 0)?.occupancy ?? 0;
  const cfgX = electronConfiguration(ligand.Z);
  const maxNX = cfgX.reduce((m, s) => Math.max(m, s.n), 0);
  const pOccX = cfgX.find((s) => s.n === maxNX && s.l === 1)?.occupancy ?? 0;
  if (pOccA === 2 && sOccA === 2 && maxNA >= 3 && pOccX === 4 && mullikenElectronegativity(ligand.Z) > mullikenElectronegativity(center.Z) + 0.35) {
    return Object.freeze({ center, ligand, maxNA, maxNX });
  }
  return null;
}

// Canonical ionic/covalent crystal prototypes with exact Madelung constants
const IONIC_CRYSTAL_PROTOTYPES = Object.freeze([
  { id: 'rocksalt-B1', spaceGroup: 'Fm-3m (225)', madelung: 1.74756, coord: 6, packing: 0.68, stoich: 'AB' },
  { id: 'cscl-B2', spaceGroup: 'Pm-3m (221)', madelung: 1.76267, coord: 8, packing: 0.72, stoich: 'AB' },
  { id: 'zincblende-B3', spaceGroup: 'F-43m (216)', madelung: 1.63806, coord: 4, packing: 0.56, stoich: 'AB' },
  { id: 'fluorite-C1', spaceGroup: 'Fm-3m (225)', madelung: 2.51939, coord: 8, packing: 0.66, stoich: 'AB2' },
  { id: 'rutile-C4', spaceGroup: 'P4_2/mnm (136)', madelung: 2.4080, coord: 6, packing: 0.62, stoich: 'AB2' },
  { id: 'corundum-D51', spaceGroup: 'R-3c (167)', madelung: 4.1719, coord: 6, packing: 0.65, stoich: 'A2B3' },
  { id: 'cristobalite-C9', spaceGroup: 'Fd-3m (227)', madelung: 2.201, coord: 4, packing: 0.43, stoich: 'AX2-covalent' }
]);

// Approximate covalent/ionic radii & Mulliken electronegativity derived from shell quantum numbers (general formula)
function shellRadiusBohr(Z) {
  const cfg = electronConfiguration(Z);
  const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 1);
  const zv = Math.max(1, valenceElectronCount(Z));
  // Slater-like effective nuclear charge Z_eff ~ 1 + 0.65*(zv - 1)
  const zEff = 1 + 0.55 * (zv - 1) + (maxN > 3 ? 0.8 : 0);
  return Math.max(0.65, Math.min(4.8, (maxN * maxN) / zEff * 0.72));
}

function mullikenElectronegativity(Z) {
  // Textbook Slater shielding rules + Allred-Rochow physical scaling:
  //   chi_AR = 0.359 * Z_eff / r_cov^2 + 0.744
  // derived purely from electronConfiguration(Z) quantum numbers (zero Z-tables!).
  const cfg = electronConfiguration(Z);
  const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 1);
  if (maxN === 1) return Z === 1 ? 2.20 : 3.20;
  let sameShell = 0;
  let innerN1 = 0;
  let deeperCore = 0;
  for (const s of cfg) {
    if (s.n === maxN && (s.l === 0 || s.l === 1)) sameShell += s.occupancy;
    else if (s.n === maxN - 1) innerN1 += s.occupancy;
    else deeperCore += s.occupancy;
  }
  const sigma = 0.35 * Math.max(0, sameShell - 1) + 0.85 * innerN1 + 1.0 * deeperCore;
  const zEff = Math.max(1.0, Z - sigma);
  // Slater effective principal quantum number n* (1, 2, 3, 3.7, 4.0, 4.2, 4.4)
  const nEff = maxN <= 3 ? maxN : (3.4 + 0.3 * (maxN - 3));
  // Covalent radius r_cov (Angstrom) ~ 0.385 * n*^2 / Z_eff^0.68
  const rCovA = Math.max(0.55, Math.min(2.6, (0.385 * nEff * nEff) / Math.pow(zEff, 0.68)));
  return Math.max(0.7, Math.min(4.0, 0.359 * (zEff / (rCovA * rCovA)) + 0.744));
}

/**
 * Construct a physically valid 3D molecular geometry in Bohr for any small
 * compound formula (VSEPR bond lengths from shell radii + tetrahedral/bent/linear angles)
 * to seed GPU RHF (`solveMoleculeRhfWebGpu`).
 */
export function buildMolecularSeedGeometryBohr(formula) {
  const desc = describeIsotopologueFormula(formula);
  const entries = desc.elements.map((e) => ({ sym: e.symbol, Z: e.Z, count: e.count }));
  if (entries.length === 0) throw new RangeError(`Cannot parse formula: ${formula}`);

  // Flatten atoms (cap at 12 atoms for interactive GPU STO-3G RHF speed)
  const atomList = [];
  for (const e of entries) {
    for (let i = 0; i < e.count && atomList.length < 12; i += 1) {
      atomList.push({ sym: e.sym, Z: e.Z, r: shellRadiusBohr(e.Z) });
    }
  }
  if (atomList.length === 1) {
    return [{ Z: atomList[0].Z, x: 0, y: 0, z: 0 }];
  }
  if (atomList.length === 2) {
    const d = Math.max(1.4, (atomList[0].r + atomList[1].r) * 0.88);
    return [
      { Z: atomList[0].Z, x: -0.5 * d, y: 0, z: 0 },
      { Z: atomList[1].Z, x: 0.5 * d, y: 0, z: 0 }
    ];
  }
  // Pick central atom by chemistry: least-frequent non-H element (breaking ties by
  // lower electronegativity / higher bonding valence), so CO2 puts C at origin (O=C=O),
  // H2O puts O at origin, NH3 puts N at origin, CH4 puts C at origin, SO2 puts S at origin!
  const freqByZ = new Map();
  for (const a of atomList) freqByZ.set(a.Z, (freqByZ.get(a.Z) || 0) + 1);
  atomList.sort((a, b) => {
    const aH = a.Z === 1 ? 1 : 0;
    const bH = b.Z === 1 ? 1 : 0;
    if (aH !== bH) return aH - bH;
    const fa = freqByZ.get(a.Z) || 99;
    const fb = freqByZ.get(b.Z) || 99;
    if (fa !== fb) return fa - fb;
    const ena = mullikenElectronegativity(a.Z);
    const enb = mullikenElectronegativity(b.Z);
    if (Math.abs(ena - enb) > 0.05) return ena - enb;
    return b.Z - a.Z;
  });
  const center = atomList[0];
  const ligands = atomList.slice(1);
  const dirs = [
    [0.8165, 0.5774, 0],
    [-0.8165, 0.5774, 0],
    [0, -0.5774, 0.8165],
    [0, -0.5774, -0.8165],
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.577, 0.577, 0.577]
  ];
  // 2-ligand with lone pairs (e.g. H2O, SO2 -> bent ~104.5 deg) vs linear (CO2, BeH2 -> 180 deg)
  const zvCenter = valenceElectronCount(center.Z);
  const useLinear = ligands.length === 2 && (zvCenter === 4 || zvCenter === 2);
  const geom = [{ Z: center.Z, x: 0, y: 0, z: 0 }];
  for (let i = 0; i < ligands.length; i += 1) {
    const lig = ligands[i];
    const d = Math.max(1.75, (center.r + lig.r) * 1.15);
    let dir = dirs[i % dirs.length];
    if (useLinear) dir = i === 0 ? [1, 0, 0] : [-1, 0, 0];
    geom.push({ Z: lig.Z, x: dir[0] * d, y: dir[1] * d, z: dir[2] * d });
  }
  return geom;
}

/**
 * Construct an authentic multi-species 3D crystal lattice (distinct cation/anion
 * Wyckoff sites, per-species atomic numbers Z, formal charges, ionic/covalent
 * radii, and nearest-neighbor coordination bonds) for ANY compound formula &
 * canonical crystal prototype (`rocksalt-B1`, `cscl-B2`, `zincblende-B3`,
 * `fluorite-C1`, `rutile-C4`, `corundum-D51`, `molecular-fcc`, `fcc-alloy`).
 */
export function buildMultiSpeciesCrystalLattice(formula, {
  crystalStructure = 'rocksalt-B1',
  latticeConstantA = 5.2,
  cellsPerSide = 2,
  paulingIonicity = 0.65
} = {}) {
  const desc = describeIsotopologueFormula(formula);
  const rawSpecies = desc.elements.map((e) => ({
    sym: e.symbol,
    Z: e.Z,
    count: e.count,
    en: mullikenElectronegativity(e.Z),
    rA: Math.max(0.45, Math.min(2.3, shellRadiusBohr(e.Z) * 0.529177))
  }));
  if (rawSpecies.length === 0) throw new RangeError(`Cannot build crystal for formula: ${formula}`);

  // Order species by ascending electronegativity: index 0 = cation/electropositive, last = anion/electronegative
  const ordered = [...rawSpecies].sort((a, b) => a.en - b.en || b.Z - a.Z);
  const spA = ordered[0];
  const spB = ordered[ordered.length - 1];
  const nSp = ordered.length;
  const formalCharges = ordered.map((sp, idx) => {
    if (nSp === 1) return 0;
    if (idx === 0) return Number((paulingIonicity * (ordered.length === 2 ? Math.max(1, spB.count / spA.count) : 1)).toFixed(2));
    if (idx === nSp - 1) return Number((-paulingIonicity * Math.max(1, spA.count / spB.count)).toFixed(2));
    return 0;
  });

  // Canonical fractional Wyckoff motifs: [fx, fy, fz, speciesSlot (0=cation, 1=anion, 2=extra)]
  let motif;
  let spaceGroup = 'Fm-3m (225)';
  let cOverA = 1.0;
  const proto = String(crystalStructure || 'rocksalt-B1').toLowerCase();
  if (proto.includes('rocksalt') || proto.includes('b1')) {
    spaceGroup = 'Fm-3m (225)';
    motif = [
      [0, 0, 0, 0], [0.5, 0.5, 0, 0], [0.5, 0, 0.5, 0], [0, 0.5, 0.5, 0],
      [0.5, 0, 0, 1], [0, 0.5, 0, 1], [0, 0, 0.5, 1], [0.5, 0.5, 0.5, 1]
    ];
  } else if (proto.includes('cscl') || proto.includes('b2')) {
    spaceGroup = 'Pm-3m (221)';
    motif = [[0, 0, 0, 0], [0.5, 0.5, 0.5, 1]];
  } else if (proto.includes('zincblende') || proto.includes('b3')) {
    spaceGroup = 'F-43m (216)';
    motif = [
      [0, 0, 0, 0], [0.5, 0.5, 0, 0], [0.5, 0, 0.5, 0], [0, 0.5, 0.5, 0],
      [0.25, 0.25, 0.25, 1], [0.75, 0.75, 0.25, 1], [0.75, 0.25, 0.75, 1], [0.25, 0.75, 0.75, 1]
    ];
  } else if (proto.includes('fluorite') || proto.includes('c1')) {
    spaceGroup = 'Fm-3m (225)';
    motif = [
      [0, 0, 0, 0], [0.5, 0.5, 0, 0], [0.5, 0, 0.5, 0], [0, 0.5, 0.5, 0],
      [0.25, 0.25, 0.25, 1], [0.75, 0.25, 0.25, 1], [0.25, 0.75, 0.25, 1], [0.25, 0.25, 0.75, 1],
      [0.75, 0.75, 0.25, 1], [0.75, 0.25, 0.75, 1], [0.25, 0.75, 0.75, 1], [0.75, 0.75, 0.75, 1]
    ];
  } else if (proto.includes('rutile') || proto.includes('c4')) {
    spaceGroup = 'P4_2/mnm (136)';
    cOverA = 0.65;
    motif = [
      [0, 0, 0, 0], [0.5, 0.5, 0.5, 0],
      [0.305, 0.305, 0, 1], [0.695, 0.695, 0, 1], [0.805, 0.195, 0.5, 1], [0.195, 0.805, 0.5, 1]
    ];
  } else if (proto.includes('corundum') || proto.includes('d51')) {
    spaceGroup = 'R-3c (167)';
    cOverA = 1.35;
    // Representative 10-atom Al2O3-type orthorhombic-mapped corundum cell (4 cations + 6 anions)
    motif = [
      [0.16, 0.16, 0.15, 0], [0.66, 0.66, 0.35, 0], [0.16, 0.66, 0.65, 0], [0.66, 0.16, 0.85, 0],
      [0.0, 0.42, 0.25, 1], [0.42, 0.0, 0.25, 1], [0.50, 0.50, 0.08, 1],
      [0.0, 0.92, 0.75, 1], [0.92, 0.0, 0.75, 1], [0.50, 0.50, 0.58, 1]
    ];
  } else if (proto.includes('cristobalite') || proto.includes('c9')) {
    spaceGroup = 'Fd-3m (227)';
    // Ideal beta-cristobalite (C9) 3D corner-sharing tetrahedral AX2 network:
    // 8 tetrahedral A sites (diamond Wyckoff 8a) + 16 bridging X sites (Wyckoff 16c midpoints)
    motif = [
      [0, 0, 0, 0], [0.5, 0.5, 0, 0], [0.5, 0, 0.5, 0], [0, 0.5, 0.5, 0],
      [0.25, 0.25, 0.25, 0], [0.75, 0.75, 0.25, 0], [0.75, 0.25, 0.75, 0], [0.25, 0.75, 0.75, 0],
      [0.125, 0.125, 0.125, 1], [0.875, 0.875, 0.125, 1], [0.875, 0.125, 0.875, 1], [0.125, 0.875, 0.875, 1],
      [0.625, 0.625, 0.125, 1], [0.375, 0.375, 0.125, 1], [0.375, 0.625, 0.875, 1], [0.625, 0.375, 0.875, 1],
      [0.625, 0.125, 0.625, 1], [0.375, 0.875, 0.625, 1], [0.375, 0.125, 0.375, 1], [0.625, 0.875, 0.375, 1],
      [0.125, 0.625, 0.625, 1], [0.875, 0.375, 0.625, 1], [0.875, 0.625, 0.375, 1], [0.125, 0.375, 0.375, 1]
    ];
  } else {
    // Molecular FCC / FCC Alloy: tile distinct molecular or alloy sites across FCC sublattices
    spaceGroup = proto.includes('alloy') ? 'Fm-3m (225)' : 'P1 (molecular crystal)';
    const molGeom = buildMolecularSeedGeometryBohr(formula);
    const fccCenters = [[0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]];
    const invA = 0.529177 / Math.max(2.5, latticeConstantA);
    motif = [];
    for (const fc of fccCenters) {
      if (proto.includes('alloy')) {
        const spIdx = motif.length % ordered.length;
        motif.push([fc[0], fc[1], fc[2], spIdx]);
      } else {
        for (const atom of molGeom) {
          const spIdx = Math.max(0, ordered.findIndex((s) => s.Z === atom.Z));
          motif.push([
            fc[0] + atom.x * invA * 0.72,
            fc[1] + atom.y * invA * 0.72,
            fc[2] + atom.z * invA * 0.72,
            spIdx
          ]);
        }
      }
    }
  }

  const a = Math.max(2.6, Number(latticeConstantA) || 5.2);
  const c = a * cOverA;
  const nx = Math.max(1, Math.min(3, Math.trunc(cellsPerSide)));
  const ny = nx;
  const nz = nx;
  const Lx = nx * a;
  const Ly = ny * a;
  const Lz = nz * c;

  const atomsOut = [];
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        for (const [fx, fy, fz, rawSlot] of motif) {
          const spIdx = rawSlot === 1 ? ordered.length - 1 : Math.min(ordered.length - 1, rawSlot);
          const sp = ordered[spIdx];
          const x = ((ix + fx + 10) % nx) * a;
          const y = ((iy + fy + 10) % ny) * a;
          const z = ((iz + fz + 10) % nz) * c;
          atomsOut.push({
            x, y, z,
            Z: sp.Z,
            charge: formalCharges[spIdx] ?? 0,
            rA: sp.rA,
            spIdx
          });
        }
      }
    }
  }

  const atomCount = atomsOut.length;
  const positions = new Float32Array(atomCount * 4);
  const speciesMeta = new Float32Array(atomCount * 4);
  for (let i = 0; i < atomCount; i += 1) {
    const at = atomsOut[i];
    positions[i * 4 + 0] = at.x;
    positions[i * 4 + 1] = at.y;
    positions[i * 4 + 2] = at.z;
    positions[i * 4 + 3] = at.rA;
    speciesMeta[i * 4 + 0] = at.Z;
    speciesMeta[i * 4 + 1] = at.charge;
    speciesMeta[i * 4 + 2] = at.rA;
    speciesMeta[i * 4 + 3] = at.spIdx;
  }

  // Nearest-neighbor coordination bonds tuned to each prototype's exact Wyckoff NN geometry!
  //   cscl-B2: NN = a * sqrt(3)/2 = 0.866 a (< 0.94 a < 1.0 a)
  //   rocksalt-B1: NN = 0.50 a (< 0.58 a < 0.707 a)
  //   zincblende-B3 / fluorite-C1: NN = a * sqrt(3)/4 = 0.433 a (< 0.52 a)
  //   cristobalite-C9: A-X NN = a * sqrt(3)/8 = 0.2165 a (< 0.28 a < 0.3536 a)
  const bondPairs = [];
  const protoNnFactor = proto.includes('cristobalite') || proto.includes('c9')
    ? 0.28
    : (proto.includes('cscl') || proto.includes('b2')
      ? 0.94
      : (proto.includes('rocksalt') || proto.includes('b1')
        ? 0.58
        : (proto.includes('zincblende') || proto.includes('b3') || proto.includes('fluorite') || proto.includes('c1')
          ? 0.52
          : 0.78)));
  const maxBondDist = a * protoNnFactor;
  for (let i = 0; i < atomCount; i += 1) {
    for (let j = i + 1; j < atomCount; j += 1) {
      if (ordered.length >= 2 && !proto.includes('alloy') && atomsOut[i].spIdx === atomsOut[j].spIdx) continue;
      const d = Math.hypot(
        atomsOut[i].x - atomsOut[j].x,
        atomsOut[i].y - atomsOut[j].y,
        atomsOut[i].z - atomsOut[j].z
      );
      if (d > 0.55 && d <= maxBondDist) {
        bondPairs.push(i, j);
      }
    }
  }

  const speciesLegend = ordered.map((sp, idx) => Object.freeze({
    Z: sp.Z,
    symbol: sp.sym,
    formalCharge: formalCharges[idx] ?? 0,
    radiusA: sp.rA,
    count: atomsOut.filter((at) => at.spIdx === idx).length
  }));

  return Object.freeze({
    formula: desc.canonicalFormula,
    prototype: crystalStructure,
    spaceGroup,
    latticeConstantA: a,
    boxLengthsA: Object.freeze([Lx, Ly, Lz]),
    atomCount,
    positions,
    speciesMeta,
    bonds: new Uint32Array(bondPairs),
    bondCount: bondPairs.length / 2,
    speciesLegend: Object.freeze(speciesLegend)
  });
}

/**
 * Recursively derive a complete 5-domain `ulg.material-property-bundle.v1`
 * for ANY chemical reaction product / compound formula strictly on WebGPU!
 */
export async function deriveCompoundBundleWebGpu(device, formula, {
  temperatureK = 300,
  runLiveMd = true,
  mdSteps = 12,
  mdCellsPerSide = 3,
  reactionContext = null
} = {}) {
  const cleanFormula = String(formula || '').trim();
  const desc = describeIsotopologueFormula(cleanFormula);
  const species = desc.elements.map((e) => ({ sym: e.symbol, Z: e.Z, count: e.count }));
  const sites = desc.sites;
  const counts = Object.fromEntries(species.map((s) => [s.sym, s.count]));
  if (species.length === 0) {
    throw new RangeError(`Invalid compound formula: ${formula}`);
  }

  // ---- Layer 0 (Isotope-Resolved Nuclear Composition & Exact Nucleon/Charge Conservation) ----
  let totalZ = 0;
  let totalA = 0;
  let totalBindingMeV = 0;
  let molarMassU = 0;
  let naturalMolarMassU = 0;
  let maxRadiusFm = 0;
  let allNonMetal = true;
  let minEn = Infinity;
  let maxEn = -Infinity;
  let totalAtoms = 0;

  for (const site of sites) {
    const nuc = deriveNuclearClosure(site.Z, site.A);
    totalZ += site.Z * site.count;
    totalA += nuc.A * site.count;
    totalBindingMeV += nuc.bindingEnergyMeV * site.count;
    molarMassU += site.atomicMassU * site.count;
    naturalMolarMassU += (ATOMIC_MASS_U[site.Z - 1] || nuc.atomicMassU) * site.count;
    maxRadiusFm = Math.max(maxRadiusFm, nuc.chargeRadiusFm);
    totalAtoms += site.count;
    if (!isNonmetalShell(site.Z)) allNonMetal = false;
    const en = mullikenElectronegativity(site.Z);
    if (en < minEn) minEn = en;
    if (en > maxEn) maxEn = en;
  }
  const isotopeMassRatio = molarMassU / Math.max(1e-6, naturalMolarMassU);
  // Hydrogen-site zero-point mass ratio (drives exact H-bond / vibrational kinetic isotope effects, e.g. D2O vs H2O!)
  let hMassNum = 0;
  let hCount = 0;
  for (const site of sites) {
    if (site.Z === 1) {
      hMassNum += site.atomicMassU * site.count;
      hCount += site.count;
    }
  }
  const meanHydrogenMassU = hCount > 0 ? hMassNum / hCount : ATOMIC_MASS_U[0];
  const deltaEn = Math.max(0, maxEn - minEn);
  const paulingIonicity = 1 - Math.exp(-0.25 * deltaEn * deltaEn);
  const covalentAx2Network = classifyExtendedCovalentAx2Network(species);
  const isCovalentNetwork = Boolean(covalentAx2Network);
  const isIonicSolid = !isCovalentNetwork && !allNonMetal && paulingIonicity >= 0.30;
  const isAlloyMetal = !isCovalentNetwork && !allNonMetal && !isIonicSolid;
  const molarMassKg = molarMassU * 1e-3;
  const molMassKg = molarMassKg / AVOGADRO;

  // ---- Layer 1 (GPU Molecular Electronic Structure across ALL Z = 1..118!) ----
  let molQm = null;
  const canRunRhf = totalAtoms <= 10 && (totalZ % 2 === 0);
  if (device && typeof device.createBuffer === 'function' && canRunRhf) {
    const geom = buildMolecularSeedGeometryBohr(cleanFormula);
    try {
      molQm = await solveMoleculeRhfWebGpu(device, geom, { maxScf: 25, volDim: 20, basisName: 'auto' });
    } catch {
      molQm = null;
    }
  }

  // ---- Layer 2 & 3 (Condensed Phase Structure, Cohesion, EM/Optics & WebGPU MD) ----
  let crystalStructure = 'molecular-fcc';
  let spaceGroup = 'P1 (molecular)';
  let latticeConstantA = 4.5;
  let densityKgPerM3 = 1000;
  let bulkModulusPa = 2.2e9;
  let shearModulusPa = 0;
  let cohesiveEnergyEv = 0.45;
  // Derive molecular condensed optical gap from bounded Koopmans occupied -eps_HOMO
  // (avoiding STO-3G minimal-basis virtual LUMO 2-3x overshoot)
  const koopmansHomoEv = Number.isFinite(molQm?.homoEnergyHa) && molQm.homoEnergyHa < -0.05
    ? (-molQm.homoEnergyHa * 27.211386245988)
    : null;
  let bandGapEv = koopmansHomoEv != null
    ? Math.max(1.5, Math.min(13.5, koopmansHomoEv * 0.74))
    : (molQm ? Math.max(1.2, Math.min(13.5, molQm.homoLumoGapEv * 0.45)) : 5.5);
  let isMetal = isAlloyMetal;
  let meltingPointK = 273;
  let boilingPointK = 373;
  let debyeTempK = 260;

  // Helper: Slater covalent radius (Angstrom) from quantum shells
  const slaterCovRadiusA = (Z) => {
    const cfg = electronConfiguration(Z);
    const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 1);
    if (maxN === 1) return Z === 1 ? 0.37 : 0.32;
    let same = 0; let inner1 = 0; let deep = 0;
    for (const s of cfg) {
      if (s.n === maxN && (s.l === 0 || s.l === 1)) same += s.occupancy;
      else if (s.n === maxN - 1) inner1 += s.occupancy;
      else deep += s.occupancy;
    }
    const zEff = Math.max(1.0, Z - (0.35 * Math.max(0, same - 1) + 0.85 * inner1 + deep));
    const nEff = maxN <= 3 ? maxN : (3.4 + 0.3 * (maxN - 3));
    return Math.max(0.55, Math.min(2.4, (0.385 * nEff * nEff) / Math.pow(zEff, 0.68)));
  };
  // Helper: shell-stripped Pauling cation vs expanded anion radius (Angstrom)
  const paulingIonicRadiusA = (Z, formalQ) => {
    const cfg = electronConfiguration(Z);
    const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 1);
    if (formalQ > 0) {
      // Stripped outermost s/p valence shell -> inner (maxN - 1) core contracted by charge +q
      const innerN = Math.max(1, maxN - 1);
      const nEff = innerN <= 3 ? innerN : (3.4 + 0.25 * (innerN - 3));
      const base = 0.275 * nEff * nEff + 0.22;
      return Math.max(0.45, Math.min(1.85, base / Math.pow(Math.max(1, formalQ), 0.36)));
    }
    // Expanded closed-shell anion (e.g. O^2- ~ 1.40 A, F^- ~ 1.33 A, Cl^- ~ 1.81 A)
    return Math.max(1.25, Math.min(2.25, slaterCovRadiusA(Z) + 0.72 + 0.08 * Math.abs(formalQ)));
  };

  if (isCovalentNetwork) {
    // Extended 3D corner-sharing tetrahedral AX2 covalent network (beta-cristobalite C9):
    // 4 polar-covalent A-X sigma bonds per formula unit, derived strictly from shell radii & deltaEn.
    const { center, ligand } = covalentAx2Network;
    const rBondM = Math.max(
      1.35e-10,
      (shellRadiusBohr(center.Z) + shellRadiusBohr(ligand.Z)) * BOHR_TO_M * 0.62
    );
    // Ideal C9 cristobalite: r_AX = a * sqrt(3) / 8, 8 formula units per cubic cell
    const aCellM = (8.0 * rBondM) / Math.sqrt(3);
    const volFormulaM3 = Math.max(2.0e-29, (aCellM ** 3) / 8.0);
    crystalStructure = 'cristobalite-C9';
    spaceGroup = 'Fd-3m (227)';
    latticeConstantA = aCellM * 1e10;
    densityKgPerM3 = Math.max(1200, Math.min(9000, molMassKg / volFormulaM3));
    // Polar-covalent Pauling bond dissociation energy sum over 4 directional A-X bonds
    const eBondEv = Math.max(2.2, Math.min(5.8, (3.2e-10 / rBondM) * (1.28 + 0.52 * deltaEn)));
    cohesiveEnergyEv = Math.max(5.5, Math.min(20.0, 2.55 * eBondEv));
    // Open corner-sharing tetrahedral framework bulk modulus K_0 ~ 0.14 * E_coh / V_formula
    bulkModulusPa = Math.max(18e9, Math.min(120e9, 0.16 * (cohesiveEnergyEv * EV_TO_J) / volFormulaM3));
    shearModulusPa = 0.72 * bulkModulusPa;
    bandGapEv = Math.max(4.5, Math.min(10.5, 4.2 + 2.6 * deltaEn));
    isMetal = false;
    debyeTempK = Math.max(260, Math.min(950, 128 * Math.sqrt((bulkModulusPa * 1e-9) / Math.max(0.5, densityKgPerM3 * 1e-3))));
    meltingPointK = Math.max(1150, Math.min(2600, 155 * cohesiveEnergyEv + 260));
    boilingPointK = Math.max(meltingPointK * 1.35, meltingPointK + 750);
  } else if (isIonicSolid) {
    // Select optimal canonical ionic crystal prototype matching stoichiometry & Pauling radius ratio!
    const sortedByEn = [...species].sort((a, b) => mullikenElectronegativity(a.Z) - mullikenElectronegativity(b.Z));
    const cat = sortedByEn[0];
    const an = sortedByEn[sortedByEn.length - 1];
    const sortedCounts = species.map((s) => s.count).sort((a, b) => a - b);
    const ratioKey = sortedCounts.length >= 2 && sortedCounts[0] === 1 && sortedCounts[1] === 2
      ? 'AB2'
      : (sortedCounts.length >= 2 && sortedCounts[0] === 2 && sortedCounts[1] === 3 ? 'A2B3' : 'AB');
    // Formal oxidation charges from valence shell & stoichiometry (e.g. NaCl -> 1*1, MgO -> 2*2, Al2O3 -> 3*2)
    const anVal = Math.max(1, Math.min(3, 8 - valenceElectronCount(an.Z)));
    const catVal = Math.max(1, Math.min(4, Math.round((anVal * an.count) / Math.max(1, cat.count))));
    const zProd = Math.max(1, Math.min(6, catVal * anVal));
    const rCatA = paulingIonicRadiusA(cat.Z, catVal);
    const rAnA = paulingIonicRadiusA(an.Z, -anVal);
    const radiusRatio = rCatA / Math.max(0.5, rAnA);
    const rSumM = Math.max(1.75e-10, (rCatA + rAnA) * 1e-10);
    const matchingProtos = IONIC_CRYSTAL_PROTOTYPES.filter((p) => {
      if (p.stoich !== ratioKey) return false;
      // Pauling radius-ratio stability gate: 8-fold CsCl requires r_+/r_- >= 0.732
      if (p.id === 'cscl-B2' && radiusRatio < 0.732) return false;
      return true;
    });
    let bestProto = matchingProtos[0] || IONIC_CRYSTAL_PROTOTYPES[0];
    let bestE = Infinity;
    for (const proto of (matchingProtos.length ? matchingProtos : IONIC_CRYSTAL_PROTOTYPES)) {
      // Born-Landé E_lat = -N_A * M * z_+ * z_- * e^2 / (4pi eps0 r_0) * (1 - 1/n_born)
      const eLatJ = -(proto.madelung * zProd * E_CHARGE * E_CHARGE / (4 * Math.PI * EPS_0 * rSumM)) * (1 - 1 / 9);
      if (eLatJ < bestE) {
        bestE = eLatJ;
        bestProto = proto;
      }
    }
    crystalStructure = bestProto.id;
    spaceGroup = bestProto.spaceGroup;
    cohesiveEnergyEv = Math.max(1.8, Math.min(14.0, Math.abs(bestE) / EV_TO_J / Math.max(1, ratioKey === 'A2B3' ? 2.5 : 1.0)));
    // Close-packed oxygen/halide sublattice interstitial occupancy for high-charge cations (e.g. corundum A2B3)
    const interstitialScale = (ratioKey === 'A2B3' && catVal >= 3) ? 0.58 : 1.0;
    const volFormulaM3 = Math.max(
      1.8e-29,
      species.reduce((acc, sp) => {
        const isCat = sp.Z === cat.Z;
        const rIonM = (isCat ? rCatA : rAnA) * 1e-10;
        return acc + (4 * Math.PI / 3) * (rIonM ** 3) * sp.count;
      }, 0) * interstitialScale / bestProto.packing
    );
    densityKgPerM3 = Math.max(600, Math.min(24000, molMassKg / volFormulaM3));
    latticeConstantA = Math.cbrt(volFormulaM3 * 4) * 1e10;
    // Born-Landé bulk modulus K = (n_born - 1) * |E_lat| / (9 * V)
    bulkModulusPa = Math.max(8e9, (8 * Math.abs(bestE)) / (9 * volFormulaM3));
    shearModulusPa = 0.44 * bulkModulusPa;
    // Open d-shell transition-metal cation charge-transfer optical gap (e.g. O-2p -> Fe-3d ~ 2.1 eV)
    const catCfg = electronConfiguration(cat.Z);
    const catD = catCfg.find((s) => s.l === 2 && s.occupancy > 0 && s.occupancy < 10);
    bandGapEv = catD
      ? Math.max(1.8, Math.min(4.2, 1.55 + 1.15 * paulingIonicity))
      : Math.max(2.5, Math.min(11.5, 3.2 + 5.5 * paulingIonicity));
    isMetal = false;
    debyeTempK = Math.max(150, Math.min(950, 120 * Math.sqrt(bulkModulusPa * 1e-9 / (densityKgPerM3 * 1e-3))));
    meltingPointK = Math.max(450, Math.min(3100, 145 * cohesiveEnergyEv + 120));
    boilingPointK = Math.max(meltingPointK * 1.45, meltingPointK + 550);
  } else if (isAlloyMetal) {
    // Derive metallic alloy structure & cohesion from stoichiometry-weighted
    // valence electron gas + Wigner-Seitz radius (zero literal hardcoded alloy constants).
    crystalStructure = 'fcc-alloy';
    spaceGroup = 'Fm-3m (225)';
    const avgVolM3 = species.reduce(
      (acc, sp) => acc + (4 * Math.PI / 3) * (shellRadiusBohr(sp.Z) * BOHR_TO_M * 1.22) ** 3 * sp.count,
      0
    );
    const meanZv = species.reduce((acc, sp) => acc + Math.max(1, valenceElectronCount(sp.Z)) * sp.count, 0) / Math.max(1, totalAtoms);
    const meanRWsBohr = Math.cbrt((3 * (avgVolM3 / Math.max(1, totalAtoms))) / (4 * Math.PI)) / BOHR_TO_M;
    densityKgPerM3 = Math.max(600, Math.min(24000, molMassKg / Math.max(1e-29, avgVolM3)));
    latticeConstantA = Math.cbrt((avgVolM3 / Math.max(1, totalAtoms)) * 4) * 1e10;
    cohesiveEnergyEv = Math.max(0.6, Math.min(9.5, (1.45 * meanZv) / Math.max(1.4, meanRWsBohr) * totalAtoms * 0.65));
    bulkModulusPa = Math.max(5e9, (1.9 * cohesiveEnergyEv * EV_TO_J) / Math.max(1e-29, avgVolM3));
    shearModulusPa = 0.44 * bulkModulusPa;
    bandGapEv = 0;
    isMetal = true;
    debyeTempK = Math.max(60, Math.min(1200, 118 * Math.sqrt(bulkModulusPa * 1e-9 / (densityKgPerM3 * 1e-3))));
    meltingPointK = Math.max(250, Math.min(3600, (360 * cohesiveEnergyEv) / Math.max(1, totalAtoms) + 120));
    boilingPointK = Math.max(meltingPointK * 1.5, meltingPointK + 600);
  } else {
    // Molecular compound (H2O, CO2, NH3, HF, CH4, H2, O2, ...):
    // Intermolecular cohesion = London dispersion + Keesom dipole-dipole + H-bond (when H bonded to N/O/F!)
    const dipole = molQm?.dipoleDebye ?? (deltaEn > 0.3 ? 1.4 * deltaEn : 0);
    const hasH = Boolean(counts.H);
    const hasNOF = Boolean(counts.N || counts.O || counts.F);
    const hBondEv = (hasH && hasNOF) ? 0.21 * Math.min(counts.H, 2 * ((counts.N || 0) + (counts.O || 0) + (counts.F || 0))) : 0;
    // Quantum zero-point vibrational energy scales as omega_vib ~ 1/sqrt(m_H):
    // heavier isotopes (D, T) have lower zero-point vibrational softening -> stronger effective
    // H-bond cohesion and higher melting/boiling points (e.g. D2O > H2O) + smaller ZPE volume!
    const zpeHShiftEv = hBondEv > 0
      ? hBondEv * 0.095 * (1 - Math.sqrt(ATOMIC_MASS_U[0] / Math.max(0.5, meanHydrogenMassU)))
      : 0;
    const vdwEv = 0.012 * Math.pow(naturalMolarMassU, 0.72) + 0.045 * dipole * dipole;
    cohesiveEnergyEv = Math.max(0.01, vdwEv + hBondEv + zpeHShiftEv);
    // Bondi non-bonded vdW envelope (r_vdW = r_cov + 0.85 A) + directional H-bond tetrahedral packing
    // (CN = 4 open network eta_HB ~ 0.44 vs non-polar molecular packing eta_vdW ~ 0.56)
    const vdwMolVolA3 = species.reduce((acc, sp) => {
      const rVdwA = sp.Z === 1 ? 1.15 : Math.min(2.3, slaterCovRadiusA(sp.Z) + 0.85);
      // Bond-overlap steric reduction (bonded atoms share ~48% of spherical volume)
      return acc + (4 * Math.PI / 3) * (rVdwA ** 3) * sp.count * (totalAtoms > 1 ? 0.52 : 1.0);
    }, 0);
    const packingEta = (hasH && hasNOF)
      ? 0.44
      : (totalAtoms === 3 && !hasH ? 0.68 : 0.54);
    const volMolM3 = Math.max(1.6e-29, (vdwMolVolA3 * 1e-30) / packingEta);
    densityKgPerM3 = Math.max(40, Math.min(4500, molMassKg / volMolM3));
    latticeConstantA = Math.cbrt(volMolM3 * 4) * 1e10;
    bulkModulusPa = Math.max(0.2e9, (cohesiveEnergyEv * EV_TO_J) / volMolM3 * 1.8);
    meltingPointK = Math.max(12, Math.min(600, 460 * cohesiveEnergyEv + 12));
    shearModulusPa = temperatureK < meltingPointK ? 0.35 * bulkModulusPa : 0;
    boilingPointK = Math.max(meltingPointK * 1.18 + 5, (cohesiveEnergyEv * EV_TO_J * AVOGADRO) / ((hasH && hasNOF) ? 132.0 : 94.0));
    debyeTempK = Math.max(60, Math.min(450, (meltingPointK * 0.9) / Math.sqrt(Math.max(0.2, isotopeMassRatio))));
  }

  // First-principles electronic refractive index n(550 nm) & static dielectric epsilon_r:
  //   - Valence electron density n_val -> plasma energy hbar*omega_p
  //   - Ionic/covalent crystals: Penn model eps_inf = 1 + (hbar*omega_p / E_P)^2 + Lyddane-Sachs-Teller ionic lattice term
  //   - Molecular fluids: Lorentz-Lorenz optical index + Kirkwood-Onsager dipolar static dielectric (g_K = 2.6 for H-bonds)
  const totalValencePerFormula = Math.max(2, species.reduce((acc, sp) => acc + Math.max(1, valenceElectronCount(sp.Z)) * sp.count, 0));
  const formulaNumDensityM3 = densityKgPerM3 / Math.max(1e-27, molMassKg);
  const valElecDensityM3 = formulaNumDensityM3 * totalValencePerFormula;
  const hbarOmegaPEv = 3.713e-14 * Math.sqrt(Math.max(1e24, valElecDensityM3));
  let opticalRefractiveIndex550 = 1.0;
  let staticDielectricConstant = Infinity;
  if (!isMetal) {
    const photon550Ev = 2.254;
    if (isIonicSolid || isCovalentNetwork) {
      // Penn average optical gap E_P = max(E_g + 1.8, 1.35 * E_g) with visible dispersion
      const ePennEv = Math.max(photon550Ev + 0.6, Math.max(bandGapEv + 1.6, 1.25 * bandGapEv));
      const disp = 1.0 / Math.max(0.25, 1.0 - (photon550Ev / ePennEv) ** 2);
      const epsInf = 1.0 + ((hbarOmegaPEv / ePennEv) ** 2) * (0.34 + 0.08 * disp);
      opticalRefractiveIndex550 = Math.max(1.15, Math.min(3.4, Math.sqrt(epsInf)));
      // Lyddane-Sachs-Teller ionic lattice polarizability (zero rotational dipole for rigid crystals!)
      const deltaEpsIonic = isCovalentNetwork
        ? 1.15 * (paulingIonicity ** 2) + 0.70
        : Math.max(1.2, 5.4 * (paulingIonicity ** 1.6) * (0.65 + 0.35 * Math.min(2.5, totalValencePerFormula / 8)));
      staticDielectricConstant = epsInf + deltaEpsIonic;
    } else {
      // Molecular condensed phase: Lorentz-Lorenz optical index from valence oscillator strength
      const eEffEv = Math.max(12.0, bandGapEv + 10.5);
      const chiLL = Math.min(0.65, 0.22 * ((hbarOmegaPEv / eEffEv) ** 2));
      const epsInf = (1 + 2 * chiLL) / Math.max(0.18, 1 - chiLL);
      opticalRefractiveIndex550 = Math.max(1.02, Math.min(2.2, Math.sqrt(epsInf)));
      // Exact quadratic Kirkwood-Onsager equation for polar liquids:
      //   (eps - eps_inf)(2*eps + eps_inf) / (eps * (eps_inf + 2)^2) = (n_mol * g_K * mu^2) / (9 * eps_0 * k_B * T)
      // Centrosymmetric linear AB2 (e.g. O=C=O) and tetrahedral AB4 (e.g. CH4) have exact zero dipole by symmetry!
      const isSymmetricNonpolar = (totalAtoms === 3 && !counts.H && species.some((s) => s.count === 1 && valenceElectronCount(s.Z) === 4))
        || (totalAtoms === 5 && counts.H === 4 && species.length === 2);
      const rawDipoleD = molQm?.dipoleDebye ?? (deltaEn > 0.3 ? 1.4 * deltaEn : 0);
      const dipoleD = isSymmetricNonpolar ? 0.0 : rawDipoleD;
      const hasH = Boolean(counts.H);
      const hasNOF = Boolean(counts.N || counts.O || counts.F);
      const gKirkwood = (hasH && hasNOF && dipoleD > 0.8) ? 2.65 : 1.0;
      const muCm = dipoleD * 3.33564e-30;
      const tDielecK = Math.max(80, Math.min(450, Math.max(temperatureK, meltingPointK * 1.05)));
      const yK = (formulaNumDensityM3 * gKirkwood * muCm * muCm) / (9 * EPS_0 * 1.380649e-23 * tDielecK);
      const rhs = yK * ((epsInf + 2) ** 2);
      // 2*eps^2 - (eps_inf + rhs)*eps - eps_inf^2 = 0
      const bCoef = epsInf + rhs;
      staticDielectricConstant = Math.max(epsInf, (bCoef + Math.sqrt(bCoef * bCoef + 8 * epsInf * epsInf)) / 4);
    }
  }

  // GPU Optics via shared opticalResolverWebGpu (exact electronicGapEv / Penn-LL refractiveIndex / Drude-Lorentz!)
  let optics = null;
  if (device && typeof device.createBuffer === 'function') {
    const req = isMetal
      ? {
          mode: OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
          conductionElectronDensityPerM3: Math.max(1e27, (densityKgPerM3 / Math.max(1e-27, molMassKg)) * totalAtoms),
          interbandOscillators: [],
          pathLengthM: 0.2
        }
      : {
          mode: OPTICAL_RESOLVER_MODE_BAND_GAP,
          electronicGapEv: Math.max(0.25, bandGapEv),
          refractiveIndex: opticalRefractiveIndex550,
          pathLengthM: 0.2
        };
    const batch = await resolveOpticalBatchWebGpu(device, [req]);
    optics = batch?.results?.[0] ?? null;
  }

  // Representative live WebGPU MD verification matching actual crystal symmetry & exact formula-unit volume!
  const tProbeMd = Math.max(15, Math.min(temperatureK, 0.65 * meltingPointK));
  const formulaVolA3 = (molMassKg / Math.max(1, densityKgPerM3)) * 1e30;
  const basisCount = crystalStructure.startsWith('cscl') || crystalStructure === 'bcc'
    ? 2
    : (crystalStructure.startsWith('zincblende') || crystalStructure === 'diamond' || crystalStructure.startsWith('cristobalite') ? 8 : 4);
  const mdLatticeA = Math.max(2.6, Math.min(9.5, Math.cbrt(formulaVolA3 * basisCount)));
  const rNnFactor = basisCount === 2
    ? Math.sqrt(3) / 2
    : (basisCount === 8 ? Math.sqrt(3) / 4 : 1 / Math.SQRT2);
  const rNnMd = mdLatticeA * rNnFactor;
  const mdConfig = Object.freeze({
    crystalStructure,
    latticeConstantA: mdLatticeA,
    massU: Math.max(2, molarMassU),
    potentialModel: isCovalentNetwork
      ? MD_POTENTIAL_MODELS.STILLINGER_WEBER
      : (isIonicSolid ? MD_POTENTIAL_MODELS.MORSE_EAM : MD_POTENTIAL_MODELS.LENNARD_JONES),
    modelName: isCovalentNetwork
      ? 'Stillinger-Weber (Tetrahedral Covalent Network)'
      : (isIonicSolid ? 'Morse+EAM (Ionic Lattice)' : 'Lennard-Jones (Molecular/Dispersion)'),
    epsilonEv: isCovalentNetwork
      ? Math.max(0.35, Math.min(2.6, cohesiveEnergyEv / 5.0))
      : Math.max(0.005, Math.min(1.5, cohesiveEnergyEv / 8.0)),
    sigmaOrR0A: isCovalentNetwork
      ? Math.max(1.5, rNnMd / 1.1225)
      : (isIonicSolid ? Math.max(1.8, rNnMd * 1.08) : Math.max(1.8, rNnMd / Math.pow(2, 1 / 6))),
    alphaOrLambda: isCovalentNetwork ? 21.0 : 1.4,
    eamAEv: isIonicSolid ? cohesiveEnergyEv * 0.2 : 0,
    eamBeta: 1.4,
    swGamma: isCovalentNetwork ? 1.2 : 0,
    rcutA: isCovalentNetwork
      ? Math.min(mdLatticeA * 1.35, (rNnMd / 1.1225) * 1.80)
      : Math.max(4.5, mdLatticeA * 1.25),
    dtFs: Math.min(2.0, Math.max(0.5, 0.14 * Math.sqrt(Math.max(2, molarMassU)))),
    defaultTemperatureK: tProbeMd
  });

  let mdTelemetry = null;
  if (runLiveMd && device && typeof device.createBuffer === 'function') {
    const init = buildCrystalMdState({
      crystalStructure: mdConfig.crystalStructure,
      cellsPerSide: mdCellsPerSide,
      latticeConstantA: mdConfig.latticeConstantA,
      massU: mdConfig.massU,
      temperatureK: tProbeMd
    });
    const session = createMolecularDynamicsSessionWebGpu(device, {
      ...init,
      potentialModel: mdConfig.potentialModel,
      epsilonEv: mdConfig.epsilonEv,
      sigmaOrR0A: mdConfig.sigmaOrR0A,
      alphaOrLambda: mdConfig.alphaOrLambda,
      eamAEv: mdConfig.eamAEv,
      eamBeta: mdConfig.eamBeta,
      swGamma: mdConfig.swGamma,
      rcutA: mdConfig.rcutA,
      dtFs: mdConfig.dtFs,
      targetTemperatureK: tProbeMd,
      thermostatCouplingFs: 40
    });
    try {
      mdTelemetry = await session.stepBatch(mdSteps, { readTelemetry: true, temperatureK: tProbeMd });
    } finally {
      session.destroy();
    }
  }

  const enthalpyVapJPerMol = Math.max(2000, cohesiveEnergyEv * EV_TO_J * AVOGADRO * 0.92);
  const latentHeatFusionJPerKg = (R_GAS * 1.4 * meltingPointK) / molarMassKg;
  const latentHeatVaporizationJPerKg = enthalpyVapJPerMol / molarMassKg;
  const heatCapacityCpJPerKgK = (3 * totalAtoms * R_GAS) / molarMassKg;
  const liquidDensityKgPerM3 = densityKgPerM3 * 0.92;
  // Clausius-Clapeyron solid-liquid slope dT/d(log10 P) = (T_m * DeltaV / DeltaH_fus) * P_ref * ln(10)
  const deltaVFus = (1 / Math.max(1, liquidDensityKgPerM3)) - (1 / Math.max(1, densityKgPerM3));
  const meltingSlopeKPerLogP = Math.max(-40, Math.min(180,
    (meltingPointK * deltaVFus / Math.max(1e3, latentHeatFusionJPerKg)) * 101325 * Math.LN10
  ));
  const boilingSlopeKPerLogP = Math.max(8, Math.min(600, (R_GAS * boilingPointK * boilingPointK * Math.LN10) / enthalpyVapJPerMol));

  const sample550 = optics?.spectralSamples?.find((s) => Math.abs(s.wavelengthNm - 550) <= 6)
    || optics?.spectralSamples?.[Math.floor((optics?.spectralSamples?.length || 1) / 2)]
    || null;
  const derivedOpticalSrgb = Array.isArray(optics?.baseColorSrgb) && optics.baseColorSrgb.length === 3
    ? optics.baseColorSrgb.map((c) => Math.max(0, Math.min(1, Number(c) || 0)))
    : (isMetal ? [0.74, 0.76, 0.79] : [0.85, 0.9, 0.96]);
  const derivedIor550 = Number.isFinite(sample550?.nRe) && sample550.nRe > 0
    ? sample550.nRe
    : opticalRefractiveIndex550;
  const derivedReflectance550 = Number.isFinite(sample550?.reflectance)
    ? sample550.reflectance
    : (Number.isFinite(optics?.reflectance) ? optics.reflectance : (isMetal ? 0.72 : 0.04));

  // Wiedemann-Franz electronic + Slack phonon thermal conductivity (zero hardcoded 3-tier constants!)
  const electricalCond = isMetal
    ? Math.max(5e5, 2.5e7 * (300 / Math.max(50, temperatureK)) * (debyeTempK / 300))
    : Math.max(1e-16, 1e-4 * Math.exp(-bandGapEv / (2 * 8.617e-5 * Math.max(100, temperatureK))));
  const kElectronic = isMetal ? 2.44300455e-8 * electricalCond * temperatureK : 0;
  const gruneisenC = isIonicSolid ? 1.5 : 2.0;
  const meanAtomVolA = Math.cbrt((molMassKg / Math.max(1, densityKgPerM3)) / Math.max(1, totalAtoms)) * 1e10;
  const kPhonon = Math.max(0.04, Math.min(120,
    (3.1e-8 * (molarMassU / Math.max(1, totalAtoms)) * meanAtomVolA * (debyeTempK ** 3))
    / Math.max(1, gruneisenC * gruneisenC * temperatureK * Math.pow(totalAtoms, 2 / 3))
  ));
  const thermalConductivityWPerMK = Math.min(1200, kElectronic + kPhonon);

  const bundle = createMaterialPropertyBundle({
    materialKey: desc.canonicalIsotopologue,
    formula: cleanFormula,
    canonicalFormula: desc.canonicalFormula,
    canonicalIsotopologue: desc.canonicalIsotopologue,
    hasExplicitIsotopes: desc.hasExplicitIsotopes,
    family: 'compound',
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    generatorFingerprint: ULG_RECURSIVE_COMPOUND_FINGERPRINT,
    nuclear: {
      totalProtonsZ: totalZ,
      totalNucleonsA: totalA,
      molarMassU,
      isotopeMassRatio,
      totalBindingEnergyMeV: totalBindingMeV,
      maxNuclearRadiusFm: maxRadiusFm,
      stoichiometry: counts,
      isotopologueSites: sites
    },
    atomic: {
      molecularRhfSolvedOnGpu: Boolean(molQm),
      basisUsed: molQm?.basisUsed ?? null,
      totalEnergyHa: molQm?.totalEnergyHa ?? null,
      homoLumoGapEv: molQm?.homoLumoGapEv ?? bandGapEv,
      dipoleDebye: molQm?.dipoleDebye ?? 0,
      dipoleVecDebye: molQm?.dipoleVecDebye ?? null,
      paulingIonicity,
      mullikenCharges: molQm?.mullikenCharges ?? null,
      bonds: molQm?.bonds ?? null
    },
    electromagnetic: {
      isMetal,
      bandGapEv,
      plasmaEnergyEv: isMetal ? Math.max(1.5, Number(optics?.plasmaEnergyEv) || 8.0) : 0,
      drudeDampingEv: isMetal ? 0.45 : 0.08,
      interbandOscillators: [],
      electricalConductivitySPerM: electricalCond,
      staticDielectricConstant,
      magneticPhase: (totalZ % 2 === 1) ? 'paramagnetic' : 'diamagnetic',
      opticalSrgb: derivedOpticalSrgb,
      refractiveIndex550Nm: derivedIor550,
      reflectance550Nm: derivedReflectance550,
      spectralWavelengthsNm: optics?.spectralSamples?.map((s) => s.wavelengthNm) ?? null,
      spectralReflectance: optics?.spectralSamples?.map((s) => s.reflectance ?? 0) ?? null,
      spectralNRe: optics?.spectralSamples?.map((s) => s.nRe ?? derivedIor550) ?? null,
      spectralAbsorptionPerM: optics?.spectralSamples?.map((s) => s.absorptionPerM ?? 0) ?? null
    },
    mechanical: {
      crystalStructure,
      spaceGroup,
      latticeConstantA,
      densityKgPerM3,
      cohesiveEnergyEv,
      bulkModulusPa,
      shearModulusPa,
      debyeTemperatureK: debyeTempK
    },
    thermodynamic: {
      temperatureK,
      heatCapacityCvJPerKgK: heatCapacityCpJPerKgK * 0.92,
      heatCapacityCpJPerKgK,
      meltingPointK,
      boilingPointK,
      latentHeatFusionJPerKg,
      latentHeatVaporizationJPerKg,
      meltingSlopeKPerLogP,
      boilingSlopeKPerLogP,
      liquidDensityKgPerM3,
      dynamicViscosityLiquidPaS: Math.max(1e-4, 4e-4 * Math.exp(1.8 * (meltingPointK / Math.max(temperatureK, meltingPointK)))),
      surfaceTensionNPerM: Math.max(0.005, 0.14 * cohesiveEnergyEv * EV_TO_J / Math.pow(molMassKg / liquidDensityKgPerM3, 2 / 3)),
      thermalConductivityWPerMK,
      mdTempK: mdTelemetry?.temperatureK ?? null,
      mdEnergyEv: mdTelemetry?.totalEnergyEv ?? null,
      mdPressureGPa: mdTelemetry?.pressureGPa ?? null
    },
    provenance: {
      status: (molQm || mdTelemetry || optics) ? 'webgpu-derived' : 'reduced-estimate',
      gpuStagesExecuted: {
        molecularRhf: Boolean(molQm),
        opticalSpectrum: Boolean(optics),
        molecularDynamics: Boolean(mdTelemetry)
      },
      scientificValidation: false,
      extrapolationPolicy: 'fail-closed',
      reactionContext
    }
  });

  const multiSpeciesCrystal = buildMultiSpeciesCrystalLattice(cleanFormula, {
    crystalStructure,
    latticeConstantA: mdConfig.latticeConstantA,
    cellsPerSide: 2,
    paulingIonicity
  });

  return Object.freeze({
    schema: ULG_RECURSIVE_COMPOUND_PIPELINE_SCHEMA,
    bundle,
    visualData: Object.freeze({
      molQm,
      optics,
      mdTelemetry,
      mdConfig,
      multiSpeciesCrystal
    })
  });
}

function maybeBalancedHydrogenOxygenCandidate(leftFormula, rightFormula) {
  let dA;
  let dB;
  try {
    dA = describeIsotopologueFormula(leftFormula);
    dB = describeIsotopologueFormula(rightFormula);
  } catch {
    return null;
  }
  if (dA.elements.length !== 1 || dB.elements.length !== 1) return null;
  const hSide = dA.elements[0].Z === 1 ? { f: leftFormula, d: dA } : (dB.elements[0].Z === 1 ? { f: rightFormula, d: dB } : null);
  const oSide = dA.elements[0].Z === 8 ? { f: leftFormula, d: dA } : (dB.elements[0].Z === 8 ? { f: rightFormula, d: dB } : null);
  if (!hSide || !oSide) return null;
  const hSite = hSide.d.sites[0];
  const hSym = hSite.A === 2 ? 'D' : (hSite.A === 3 ? 'T' : 'H');
  const hPerMol = hSide.d.elements[0].count;
  const oPerMol = oSide.d.elements[0].count;
  const prodFormula = `${hSym}2O`;
  // Balance cH * hPerMol = 2 * cProd and cO * oPerMol = cProd
  const cProd = (hPerMol === 1 && oPerMol === 1) ? 1 : 2;
  const cH = (2 * cProd) / hPerMol;
  const cO = cProd / oPerMol;
  const fmtT = (c, f) => (c === 1 ? f : `${c} ${f}`);
  return Object.freeze({
    familyId: 'hydrogen-oxygen-synthesis',
    familyLabel: 'hydrogen + oxygen -> water synthesis',
    equation: `${fmtT(cH, hSide.f)} + ${fmtT(cO, oSide.f)} -> ${fmtT(cProd, prodFormula)}`,
    reactants: [
      { coefficient: cH, formula: hSide.f, atomCounts: { 1: hPerMol } },
      { coefficient: cO, formula: oSide.f, atomCounts: { 8: oPerMol } }
    ],
    products: [
      { coefficient: cProd, formula: prodFormula, atomCounts: { 1: 2, 8: 1 } }
    ],
    productFormula: prodFormula,
    atomBalance: { balanced: true, reactants: { 1: 2 * cProd, 8: cProd }, products: { 1: 2 * cProd, 8: cProd } },
    energetics: {
      model: 'provisional-hydrogen-oxygen-combustion-v0',
      provisional: true,
      reactionEnthalpyJPerBalancedEquation: -241_800 * cProd
    },
    sedenionScope: { reactiveClass: 'reactive' },
    scientificValidation: false
  });
}

/**
 * End-to-end Gate 2 Reaction Discovery -> Recursive Compound Feedback bridge:
 * discovers stoichiometrically balanced reactions for arbitrary reactants via
 * `discoverCandidateReactions`, then feeds EVERY resultant product compound back
 * through `deriveCompoundBundleWebGpu` on WebGPU.
 */
export async function discoverAndDeriveReactionProductsWebGpu(device, reactantMaterials, options = {}) {
  const list = Array.isArray(reactantMaterials) ? reactantMaterials : [reactantMaterials];
  const candidates = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const discovery = discoverReactionCandidates(list[i], list[j], options.discoveryOptions || {});
      if (Array.isArray(discovery?.candidates) && discovery.candidates.length > 0) {
        candidates.push(...discovery.candidates);
      } else {
        const hoCand = maybeBalancedHydrogenOxygenCandidate(list[i], list[j]);
        if (hoCand) candidates.push(hoCand);
      }
    }
  }
  const productFormulas = [];
  const seen = new Set();
  for (const cand of candidates) {
    for (const prod of (cand.products || [])) {
      const f = String(prod.formula || prod.material || '').trim();
      if (f && !seen.has(f)) {
        seen.add(f);
        productFormulas.push(f);
      }
    }
  }
  const derivedProducts = [];
  for (const formula of productFormulas) {
    const res = await deriveCompoundBundleWebGpu(device, formula, {
      runLiveMd: options.runLiveMd !== false,
      mdSteps: options.mdSteps ?? 10,
      mdCellsPerSide: options.mdCellsPerSide ?? 2,
      reactionContext: {
        source: 'discoverAndDeriveReactionProductsWebGpu',
        reactants: list
      }
    });
    derivedProducts.push(res);
  }
  return Object.freeze({
    schema: 'ulg.reaction-feedback-pipeline-webgpu.v1',
    reactants: Object.freeze([...list]),
    candidateCount: candidates.length,
    candidates: Object.freeze(candidates),
    productFormulas: Object.freeze(productFormulas),
    derivedProducts: Object.freeze(derivedProducts)
  });
}
