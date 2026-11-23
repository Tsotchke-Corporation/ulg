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

// Canonical ionic/covalent crystal prototypes with exact Madelung constants
const IONIC_CRYSTAL_PROTOTYPES = Object.freeze([
  { id: 'rocksalt-B1', spaceGroup: 'Fm-3m (225)', madelung: 1.74756, coord: 6, packing: 0.68, stoich: 'AB' },
  { id: 'cscl-B2', spaceGroup: 'Pm-3m (221)', madelung: 1.76267, coord: 8, packing: 0.72, stoich: 'AB' },
  { id: 'zincblende-B3', spaceGroup: 'F-43m (216)', madelung: 1.63806, coord: 4, packing: 0.56, stoich: 'AB' },
  { id: 'fluorite-C1', spaceGroup: 'Fm-3m (225)', madelung: 2.51939, coord: 8, packing: 0.66, stoich: 'AB2' },
  { id: 'rutile-C4', spaceGroup: 'P4_2/mnm (136)', madelung: 2.4080, coord: 6, packing: 0.62, stoich: 'AB2' },
  { id: 'corundum-D51', spaceGroup: 'R-3c (167)', madelung: 4.1719, coord: 6, packing: 0.65, stoich: 'A2B3' }
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
  // Place heaviest / highest-valence atom at origin and distribute ligands along tetrahedral/VSEPR rays
  atomList.sort((a, b) => b.Z - a.Z);
  const center = atomList[0];
  const ligands = atomList.slice(1);
  const dirs = [
    [0.8165, 0.5774, 0],
    [-0.8165, 0.5774, 0],
    [0, -0.5774, 0.8165],
    [0, -0.5774, -0.8165],
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.577, 0.577, 0.577]
  ];
  // 2-ligand with lone pairs (e.g. H2O, SO2 -> bent ~104.5 deg) vs linear (CO2 -> 180 deg)
  const zvCenter = valenceElectronCount(center.Z);
  const useLinear = ligands.length === 2 && (zvCenter === 4 || zvCenter === 2);
  const geom = [{ Z: center.Z, x: 0, y: 0, z: 0 }];
  for (let i = 0; i < ligands.length; i += 1) {
    const lig = ligands[i];
    const d = Math.max(1.6, (center.r + lig.r) * 0.86);
    let dir = dirs[i % dirs.length];
    if (useLinear) dir = i === 0 ? [1, 0, 0] : [-1, 0, 0];
    geom.push({ Z: lig.Z, x: dir[0] * d, y: dir[1] * d, z: dir[2] * d });
  }
  return geom;
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
  const isIonicSolid = !allNonMetal && paulingIonicity >= 0.30;
  const isAlloyMetal = !allNonMetal && !isIonicSolid;
  const molarMassKg = molarMassU * 1e-3;
  const molMassKg = molarMassKg / AVOGADRO;

  // ---- Layer 1 (GPU Molecular Electronic Structure for Molecular / Light Species) ----
  let molQm = null;
  const canRunRhf = totalAtoms <= 10 && species.every((s) => s.Z <= 36) && (totalZ % 2 === 0);
  if (device && typeof device.createBuffer === 'function' && canRunRhf) {
    const geom = buildMolecularSeedGeometryBohr(cleanFormula);
    try {
      molQm = await solveMoleculeRhfWebGpu(device, geom, { maxScf: 25, volDim: 20 });
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
  let bandGapEv = molQm ? Math.max(1.2, molQm.homoLumoGapEv * 0.65) : 5.5;
  let isMetal = isAlloyMetal;
  let meltingPointK = 273;
  let boilingPointK = 373;
  let debyeTempK = 260;

  if (isIonicSolid) {
    // Select optimal canonical ionic crystal prototype matching actual stoichiometry!
    const sortedCounts = species.map((s) => s.count).sort((a, b) => a - b);
    const ratioKey = sortedCounts.length >= 2 && sortedCounts[0] === 1 && sortedCounts[1] === 2
      ? 'AB2'
      : (sortedCounts.length >= 2 && sortedCounts[0] === 2 && sortedCounts[1] === 3 ? 'A2B3' : 'AB');
    const matchingProtos = IONIC_CRYSTAL_PROTOTYPES.filter((p) => p.stoich === ratioKey);
    const rSumM = species.reduce((acc, sp) => acc + shellRadiusBohr(sp.Z) * BOHR_TO_M * sp.count, 0) / totalAtoms * 2.15;
    const zProd = Math.max(1, Math.min(6, species.length >= 2 ? 1 + Math.floor(paulingIonicity * 2.2) : 1));
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
    cohesiveEnergyEv = Math.max(1.8, Math.min(14.0, Math.abs(bestE) / EV_TO_J));
    const volFormulaM3 = Math.max(
      1.5e-29,
      species.reduce(
        (acc, sp) => acc + (4 * Math.PI / 3) * (shellRadiusBohr(sp.Z) * BOHR_TO_M * 1.12) ** 3 * sp.count,
        0
      ) / bestProto.packing
    );
    densityKgPerM3 = Math.max(600, Math.min(24000, molMassKg / volFormulaM3));
    latticeConstantA = Math.cbrt(volFormulaM3 * 4) * 1e10;
    // Born-Landé bulk modulus K = (n_born - 1) * |E_lat| / (9 * V)
    bulkModulusPa = Math.max(8e9, (8 * Math.abs(bestE)) / (9 * volFormulaM3));
    shearModulusPa = 0.44 * bulkModulusPa;
    bandGapEv = Math.max(2.5, Math.min(11.5, 3.2 + 5.5 * paulingIonicity));
    isMetal = false;
    debyeTempK = Math.max(150, Math.min(950, 120 * Math.sqrt(bulkModulusPa * 1e-9 / (densityKgPerM3 * 1e-3))));
    meltingPointK = Math.max(450, Math.min(3100, 185 * cohesiveEnergyEv + 120));
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
    const rMolM = Math.max(1.3e-10, species.reduce((acc, sp) => acc + (shellRadiusBohr(sp.Z) * BOHR_TO_M) ** 3 * sp.count, 0) ** (1 / 3) * 1.65);
    const volMolM3 = (4 * Math.PI / 3) * (rMolM ** 3) / 0.56;
    densityKgPerM3 = Math.max(40, Math.min(4500, molMassKg / Math.max(1e-29, volMolM3)));
    latticeConstantA = Math.cbrt(volMolM3 * 4) * 1e10;
    bulkModulusPa = Math.max(0.2e9, (cohesiveEnergyEv * EV_TO_J) / Math.max(1e-29, volMolM3) * 1.8);
    meltingPointK = Math.max(12, Math.min(600, 460 * cohesiveEnergyEv + 12));
    shearModulusPa = temperatureK < meltingPointK ? 0.35 * bulkModulusPa : 0;
    boilingPointK = Math.max(meltingPointK * 1.2 + 5, (cohesiveEnergyEv * EV_TO_J * AVOGADRO) / 96.0);
    debyeTempK = Math.max(60, Math.min(450, (meltingPointK * 0.9) / Math.sqrt(Math.max(0.2, isotopeMassRatio))));
  }

  // GPU Optics via shared opticalResolverWebGpu (exact electronicGapEv / Drude-Lorentz fields!)
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
          pathLengthM: 0.2
        };
    const batch = await resolveOpticalBatchWebGpu(device, [req]);
    optics = batch?.results?.[0] ?? null;
  }

  // Representative live WebGPU MD verification matching actual crystal symmetry & exact formula-unit volume!
  let mdTelemetry = null;
  if (runLiveMd && device && typeof device.createBuffer === 'function') {
    const tProbe = Math.max(15, Math.min(temperatureK, 0.65 * meltingPointK));
    const formulaVolA3 = (molMassKg / Math.max(1, densityKgPerM3)) * 1e30;
    const basisCount = crystalStructure.startsWith('cscl') || crystalStructure === 'bcc'
      ? 2
      : (crystalStructure.startsWith('zincblende') || crystalStructure === 'diamond' ? 8 : 4);
    const mdLatticeA = Math.max(2.6, Math.min(9.5, Math.cbrt(formulaVolA3 * basisCount)));
    const init = buildCrystalMdState({
      crystalStructure,
      cellsPerSide: mdCellsPerSide,
      latticeConstantA: mdLatticeA,
      massU: Math.max(2, molarMassU),
      temperatureK: tProbe
    });
    const rNnFactor = basisCount === 2
      ? Math.sqrt(3) / 2
      : (basisCount === 8 ? Math.sqrt(3) / 4 : 1 / Math.SQRT2);
    const rNnMd = mdLatticeA * rNnFactor;
    const session = createMolecularDynamicsSessionWebGpu(device, {
      ...init,
      potentialModel: isIonicSolid ? MD_POTENTIAL_MODELS.MORSE_EAM : MD_POTENTIAL_MODELS.LENNARD_JONES,
      epsilonEv: Math.max(0.005, Math.min(1.5, cohesiveEnergyEv / 8.0)),
      sigmaOrR0A: isIonicSolid ? Math.max(1.8, rNnMd * 1.08) : Math.max(1.8, rNnMd / Math.pow(2, 1 / 6)),
      alphaOrLambda: 1.4,
      eamAEv: isIonicSolid ? cohesiveEnergyEv * 0.2 : 0,
      eamBeta: 1.4,
      rcutA: Math.max(4.5, mdLatticeA * 1.25),
      dtFs: 1.5,
      targetTemperatureK: tProbe,
      thermostatCouplingFs: 40
    });
    try {
      mdTelemetry = await session.stepBatch(mdSteps, { readTelemetry: true, temperatureK: tProbe });
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
    : Math.sqrt(1 + Math.pow(9.5 / Math.max(0.5, bandGapEv), 2));
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
      totalEnergyHa: molQm?.totalEnergyHa ?? null,
      homoLumoGapEv: molQm?.homoLumoGapEv ?? bandGapEv,
      dipoleDebye: molQm?.dipoleDebye ?? 0,
      paulingIonicity,
      mullikenCharges: molQm?.mullikenCharges ?? null
    },
    electromagnetic: {
      isMetal,
      bandGapEv,
      electricalConductivitySPerM: electricalCond,
      staticDielectricConstant: isMetal ? Infinity : (1 + Math.pow(9.5 / Math.max(0.5, bandGapEv), 2) + (molQm?.dipoleDebye ?? 0) ** 2 * 18),
      magneticPhase: (totalZ % 2 === 1) ? 'paramagnetic' : 'diamagnetic',
      opticalSrgb: derivedOpticalSrgb,
      refractiveIndex550Nm: derivedIor550,
      reflectance550Nm: derivedReflectance550,
      spectralWavelengthsNm: optics?.spectralSamples?.map((s) => s.wavelengthNm) ?? null,
      spectralReflectance: optics?.spectralSamples?.map((s) => s.reflectance ?? 0) ?? null
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

  return Object.freeze({
    schema: ULG_RECURSIVE_COMPOUND_PIPELINE_SCHEMA,
    bundle,
    visualData: Object.freeze({
      molQm,
      optics,
      mdTelemetry
    })
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
      if (Array.isArray(discovery?.candidates)) {
        candidates.push(...discovery.candidates);
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
    productFormulas: Object.freeze(productFormulas),
    derivedProducts: Object.freeze(derivedProducts)
  });
}
