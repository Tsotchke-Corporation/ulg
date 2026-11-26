// Cross-Scale Offline Scientific Validation & Calibration Framework (`ulg.science.validation.v1`)
// (`src/tools/scientificValidationFramework.js`)
//
// Strictly Star Spec v0.4 & G7 compliant:
//   - Offline & operator-side ONLY (zero network access, zero runtime authority,
//     never blocks workflows, never feeds empirical lookup tables back into solvers!).
//   - Audits ACTUAL ULG simulation outputs across all 7 physical domains (10^-15 m -> 10^+25 m)
//     against verified G7 cached snapshots (`pubchem-periodic-table`, `nist-atomic-weights`)
//     AND documented public literature reference measurements (AME2020, CRC/Materials Project,
//     NIST WebBook/IAPWS-95, Mitchell/Hodgkin-Huxley, NASA Planetary Fact Sheets, Planck 2018).
//   - Computes per-domain quantitative error statistics (MAPE, median signed bias, pass rate,
//     worst outliers) and automatically synthesizes Physics-Root-Cause Calibration Triage
//     identifying which fundamental physical closures need deeper terms (never per-element hacks!).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadScienceSnapshotCache } from './scienceReleaseAudit.js';
import {
  deriveNuclearClosure,
  nuclearBindingEnergyMeV,
  nuclearChargeRadiusFm
} from '../runtime/nuclear/nuclearStructureGpu.js';
import {
  ORGANIC_MOLECULE_INITIAL_CONDITIONS,
  buildOrganicMolecularGraph,
  solvePiMolecularOrbitalsAnalytic
} from '../runtime/organic/organicMolecularGraphGpu.js';
import { evaluateAcidBaseEquilibrium } from '../runtime/organic/acidBaseCatalysisGpu.js';
import { evaluateChemiosmoticBioenergetics } from '../runtime/biology/membraneBioenergeticsGpu.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../runtime/astrophysics/solarSystemNBodyGpu.js';
import { deriveSurfaceEnvironmentState } from '../runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import {
  deriveAtmosphericColumnProfile,
  evaluateAtmosphericChemistryAtAltitude
} from '../runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js';
import {
  computeCosmicAgeGyr,
  evaluateCosmicEpochState,
  evaluateEisensteinHuBaoTransfer,
  evaluateStellarEvolutionaryState
} from '../runtime/astrophysics/cosmicEpochState.js';

export const ULG_SCIENTIFIC_VALIDATION_SCHEMA = 'ulg.science.validation.v1';

// =========================================================================
// Immutable Cited Public Empirical Reference Benchmarks (Advisory Only!)
// =========================================================================

// 1. AME2020 (Wang et al., Chinese Physics C 45, 030003, 2021) + Angeli & Marinova (2013) charge radii
export const AME2020_BENCHMARKS = Object.freeze([
  { isotope: 'He-4',  Z: 2,  A: 4,   bPerAMeV: 7.073915, rChFm: 1.6755 },
  { isotope: 'C-12',  Z: 6,  A: 12,  bPerAMeV: 7.680144, rChFm: 2.4702 },
  { isotope: 'O-16',  Z: 8,  A: 16,  bPerAMeV: 7.976206, rChFm: 2.6991 },
  { isotope: 'Si-28', Z: 14, A: 28,  bPerAMeV: 8.447744, rChFm: 3.1224 },
  { isotope: 'Ca-40', Z: 20, A: 40,  bPerAMeV: 8.551301, rChFm: 3.4776 },
  { isotope: 'Fe-56', Z: 26, A: 56,  bPerAMeV: 8.790354, rChFm: 3.7377 },
  { isotope: 'Ni-62', Z: 28, A: 62,  bPerAMeV: 8.794553, rChFm: 3.8399 },
  { isotope: 'Ag-107',Z: 47, A: 107, bPerAMeV: 8.553889, rChFm: 4.5454 },
  { isotope: 'Au-197',Z: 79, A: 197, bPerAMeV: 7.915650, rChFm: 5.4371 },
  { isotope: 'Pb-208',Z: 82, A: 208, bPerAMeV: 7.867452, rChFm: 5.5012 },
  { isotope: 'U-238', Z: 92, A: 238, bPerAMeV: 7.570126, rChFm: 5.8571 }
]);

// 2. CRC Handbook / Kittel / Materials Project Elemental Crystal & Bulk Benchmarks
export const CRC_ELEMENT_SOLID_BENCHMARKS = Object.freeze([
  { symbol: 'Li', crystal: 'bcc',     a0A: 3.510, bulkGPa: 11.0,  debyeK: 344, mag: 'paramagnetic' },
  { symbol: 'C',  crystal: 'diamond', a0A: 3.567, bulkGPa: 442.0, debyeK: 2230, mag: 'diamagnetic' },
  { symbol: 'Na', crystal: 'bcc',     a0A: 4.291, bulkGPa: 6.3,   debyeK: 158, mag: 'paramagnetic' },
  { symbol: 'Al', crystal: 'fcc',     a0A: 4.050, bulkGPa: 76.0,  debyeK: 428, mag: 'paramagnetic' },
  { symbol: 'Si', crystal: 'diamond', a0A: 5.431, bulkGPa: 98.0,  debyeK: 645, mag: 'diamagnetic' },
  { symbol: 'Fe', crystal: 'bcc',     a0A: 2.866, bulkGPa: 170.0, debyeK: 470, mag: 'ferromagnetic' },
  { symbol: 'Cu', crystal: 'fcc',     a0A: 3.615, bulkGPa: 140.0, debyeK: 343, mag: 'diamagnetic' },
  { symbol: 'Ag', crystal: 'fcc',     a0A: 4.085, bulkGPa: 100.0, debyeK: 225, mag: 'diamagnetic' },
  { symbol: 'W',  crystal: 'bcc',     a0A: 3.165, bulkGPa: 310.0, debyeK: 400, mag: 'paramagnetic' },
  { symbol: 'Au', crystal: 'fcc',     a0A: 4.078, bulkGPa: 180.0, debyeK: 165, mag: 'diamagnetic' }
]);

// 3. NIST Chemistry WebBook / IAPWS-95 Compound Physical Benchmarks
export const NIST_COMPOUND_BENCHMARKS = Object.freeze([
  { key: 'H2O',   name: 'Water',            densityKgM3: 997.0,  tMeltK: 273.15, tBoilK: 373.15, cpJPerKgK: 4184, epsR: 78.4,  n550: 1.333 },
  { key: 'NaCl',  name: 'Sodium Chloride',  densityKgM3: 2165.0, tMeltK: 1074.0, tBoilK: 1738.0, cpJPerKgK: 864,  epsR: 5.9,   n550: 1.544 },
  { key: 'O2Si',  name: 'Silicon Dioxide',  densityKgM3: 2648.0, tMeltK: 1986.0, tBoilK: 3223.0, cpJPerKgK: 740,  epsR: 3.9,   n550: 1.544 },
  { key: 'CO2',   name: 'Carbon Dioxide',   densityKgM3: 1562.0, tMeltK: 216.58, tBoilK: 194.65, cpJPerKgK: 846,  epsR: 1.6,   n550: null  },
  { key: 'H3N',   name: 'Ammonia',          densityKgM3: 682.0,  tMeltK: 195.42, tBoilK: 239.81, cpJPerKgK: 4700, epsR: 22.4,  n550: 1.325 },
  { key: 'H4C',   name: 'Methane',          densityKgM3: 423.0,  tMeltK: 90.69,  tBoilK: 111.66, cpJPerKgK: 3480, epsR: 1.68,  n550: 1.29  },
  { key: 'O3Al2', name: 'Alumina Corundum', densityKgM3: 3987.0, tMeltK: 2345.0, tBoilK: 3250.0, cpJPerKgK: 775,  epsR: 9.8,   n550: 1.768 },
  { key: 'O3Fe2', name: 'Hematite',         densityKgM3: 5260.0, tMeltK: 1838.0, tBoilK: null,   cpJPerKgK: 650,  epsR: null,  n550: 2.94  }
]);

// 4. NASA Planetary Fact Sheets (Williams 2024, GSFC)
export const NASA_PLANETARY_BENCHMARKS = Object.freeze([
  { id: 'earth',   name: 'Earth',   gMS2: 9.807, pBar: 1.01325, tempK: 288.0, rhoKgM3: 1.217, scaleHeightKm: 8.5  },
  { id: 'mars',    name: 'Mars',    gMS2: 3.721, pBar: 0.0061,  tempK: 210.0, rhoKgM3: 0.020, scaleHeightKm: 11.1 },
  { id: 'venus',   name: 'Venus',   gMS2: 8.870, pBar: 92.0,    tempK: 737.0, rhoKgM3: 65.0,  scaleHeightKm: 15.9 },
  { id: 'moon',    name: 'Moon',    gMS2: 1.622, pBar: 0.0,     tempK: 250.0, rhoKgM3: 0.0,   scaleHeightKm: null },
  { id: 'titan',   name: 'Titan',   gMS2: 1.352, pBar: 1.467,   tempK: 93.7,  rhoKgM3: 5.30,  scaleHeightKm: 21.0 },
  { id: 'jupiter', name: 'Jupiter', gMS2: 24.79, pBar: 1.0,     tempK: 165.0, rhoKgM3: 0.16,  scaleHeightKm: 27.0 }
]);

// 5. Planck 2018 (A&A 641, A6) + Solar/Stellar Reference Constants (IAU 2015)
export const ASTRO_COSMO_BENCHMARKS = Object.freeze({
  cosmicAgeTodayGyr: 13.797,
  baoSoundHorizonMpc: 147.09,
  cmbTempZ1100K: 2998.05,
  solarTeffK: 5772.0,
  solarRadiusRSun: 1.0,
  solarLumLSun: 1.0,
  vegaMassMSun: 2.135,
  vegaLumLSun: 40.12,
  proximaMassMSun: 0.122,
  proximaTeffK: 3042.0
});

// =========================================================================
// Quantitative Metric Helpers
// =========================================================================

function makeComparison({
  domain,
  subject,
  observable,
  unit,
  simulated,
  reference,
  relTol = 0.15,
  absTol = null,
  source,
  physicsTag = 'general'
}) {
  const simNum = Number(simulated);
  const refNum = Number(reference);
  if (!Number.isFinite(simNum) || !Number.isFinite(refNum)) {
    return {
      domain, subject, observable, unit,
      simulated: Number.isFinite(simNum) ? simNum : null,
      reference: Number.isFinite(refNum) ? refNum : null,
      absErr: null, relErr: null, status: 'missing', source, physicsTag
    };
  }
  const absErr = simNum - refNum;
  const denom = Math.abs(refNum);
  const relErr = denom > 1e-12 ? absErr / denom : (Math.abs(absErr) < 1e-12 ? 0 : null);
  let status = 'deviates';
  if (absTol != null && Math.abs(absErr) <= absTol) {
    status = 'agrees';
  } else if (relErr != null && Math.abs(relErr) <= relTol) {
    status = 'agrees';
  } else if (absTol == null && denom <= 1e-12 && Math.abs(absErr) <= 1e-9) {
    status = 'agrees';
  }
  return {
    domain, subject, observable, unit,
    simulated: simNum, reference: refNum,
    absErr, relErr, status, source, physicsTag
  };
}

function makeQualitativeComparison({ domain, subject, observable, simulated, reference, source, physicsTag = 'general' }) {
  const match = String(simulated ?? '').toLowerCase() === String(reference ?? '').toLowerCase();
  return {
    domain, subject, observable, unit: 'class',
    simulated: String(simulated ?? ''),
    reference: String(reference ?? ''),
    absErr: match ? 0 : 1,
    relErr: match ? 0 : 1,
    status: match ? 'agrees' : 'deviates',
    source,
    physicsTag
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? 0.5 * (sorted[mid - 1] + sorted[mid]) : sorted[mid];
}

function summarizeDomain(domainId, title, comparisons) {
  const evaluated = comparisons.filter((c) => c.status !== 'missing');
  const agrees = evaluated.filter((c) => c.status === 'agrees').length;
  const deviates = evaluated.filter((c) => c.status === 'deviates').length;
  const missing = comparisons.length - evaluated.length;
  const numericRels = evaluated
    .filter((c) => c.unit !== 'class' && typeof c.relErr === 'number' && Number.isFinite(c.relErr))
    .map((c) => c.relErr);
  const absRels = numericRels.map((r) => Math.abs(r));
  const mapePct = absRels.length ? (absRels.reduce((a, b) => a + b, 0) / absRels.length) * 100 : null;
  const medianAbsPct = absRels.length ? median(absRels) * 100 : null;
  const medianBiasPct = numericRels.length ? median(numericRels) * 100 : null;
  const worstOutliers = evaluated
    .filter((c) => c.status === 'deviates')
    .sort((a, b) => Math.abs(b.relErr ?? 0) - Math.abs(a.relErr ?? 0))
    .slice(0, 5);
  return {
    domainId,
    title,
    total: comparisons.length,
    evaluated: evaluated.length,
    agrees,
    deviates,
    missing,
    agreementRatePct: evaluated.length ? (agrees / evaluated.length) * 100 : null,
    mapePct,
    medianAbsPct,
    medianBiasPct,
    worstOutliers
  };
}

// =========================================================================
// Physics-Root-Cause Calibration Triage Synthesizer
// =========================================================================

const TRIAGE_CATALOG = Object.freeze({
  'nuclear-binding': {
    title: 'Nuclear Binding & Shell Closure (`nuclearStructureGpu.js`)',
    recommendation: 'Refine surface-symmetry & Strutinsky pairing terms for light (A<=16) and doubly-magic nuclides.'
  },
  'nuclear-radius': {
    title: 'Finite Nuclear Charge Radius (`nuclearChargeRadiusFm`)',
    recommendation: 'Refine 2-parameter Fermi skin thickness a_0 / r_0 scaling (r_0 ~ 1.18 fm vs 1.25 fm for heavy Z).'
  },
  'element-density-eos': {
    title: 'Elemental Bulk DFT Density (`periodicTableEngineWebGpu.js` -> `foundation-polytope-atlas.json`)',
    recommendation: 'Add London dispersion (vdW-D3) for noble gases/molecular halogens and spin-polarized d/f exchange for transition/actinide metals.'
  },
  'element-phase-tm-tb': {
    title: 'Elemental Melting & Boiling Points (`T_melt` / `T_boil` from cohesive energy & MD)',
    recommendation: 'Calibrate bulk cohesive energy E_coh (currently overestimated in 3d/4d/5d metals) and add anharmonic Lindemann/coexistence entropy terms.'
  },
  'element-bulk-modulus': {
    title: 'Solid Bulk Modulus & Debye Temperature',
    recommendation: 'Tighten Murnaghan/Birch-Murnaghan curvature from spin-polarized DFT cohesion so B_0 & theta_D match Metals/Covalent solids.'
  },
  'compound-hbond-packing': {
    title: 'Hydrogen-Bonded & Molecular Crystal Packing (`H2O`, `NH3`, `CH4`)',
    recommendation: 'Replace close-packed molecular-fcc (CN=12) fallback with directional H-bond tetrahedral coordination (CN=4 for ice Ih) and Kirkwood g_K dipolar correlation for polar liquid dielectric epsilon_r.'
  },
  'compound-optics-gap': {
    title: 'Molecular Optical Gap & Refractive Index (RHF minimal basis)',
    recommendation: 'Include diffuse polarization basis functions / GW-scissors self-energy correction to remove ~2x STO-3G RHF HOMO-LUMO gap overshoot and improve n(550 nm).'
  },
  'organic-acid-base': {
    title: 'First-Principles Organic pKa & pi-Resonance (`acidBaseCatalysisGpu.js`)',
    recommendation: 'Calibrate carboxylate / enolate pi-delocalization coupling and Born solvation cavity radius against NIST WebBook pKa benchmarks.'
  },
  'bio-chemiosmotic': {
    title: 'Mitchell Chemiosmotic Bioenergetics (`membraneBioenergeticsGpu.js`)',
    recommendation: 'Verify proton stoichiometry n_H and standard phosphorylation potential DeltaG_0 against mitochondrial bioenergetics.'
  },
  'planetary-atmosphere': {
    title: 'Planetary Surface Gravity, Scale Height & Stratified Atmospheres',
    recommendation: 'Refine non-ideal compressibility Z(P,T) for supercritical atmospheres (Venus CO2) and adiabatic lapse rate coupling for outer giants.'
  },
  'astro-cosmo': {
    title: 'Lambda-CDM Cosmology & Stellar Evolutionary Scaling (`cosmicEpochState.js`)',
    recommendation: 'Extend mass-luminosity / main-sequence radius scaling across low-mass M-dwarf convective interiors and high-mass radiative stars.'
  }
});

function buildCalibrationTriage(allComparisons) {
  const groups = new Map();
  for (const c of allComparisons) {
    if (c.status !== 'deviates') continue;
    const tag = c.physicsTag || 'general';
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(c);
  }
  const items = [];
  for (const [tag, list] of groups.entries()) {
    const numRels = list
      .filter((c) => c.unit !== 'class' && typeof c.relErr === 'number' && Number.isFinite(c.relErr))
      .map((c) => c.relErr);
    const absRels = numRels.map((r) => Math.abs(r));
    const medAbsPct = absRels.length ? median(absRels) * 100 : null;
    const medSignedPct = numRels.length ? median(numRels) * 100 : null;
    const meta = TRIAGE_CATALOG[tag] || {
      title: tag,
      recommendation: 'Inspect underlying first-principles closure approximation.'
    };
    const topExamples = [...list]
      .sort((a, b) => Math.abs(b.relErr ?? 0) - Math.abs(a.relErr ?? 0))
      .slice(0, 3)
      .map((c) => ({
        subject: c.subject,
        observable: c.observable,
        simulated: c.simulated,
        reference: c.reference,
        unit: c.unit,
        relErrPct: typeof c.relErr === 'number' ? Number((c.relErr * 100).toFixed(1)) : null
      }));
    const priorityScore = list.length * (1 + Math.min(5, (medAbsPct ?? 50) / 40));
    items.push({
      physicsTag: tag,
      title: meta.title,
      deviationCount: list.length,
      medianAbsErrPct: medAbsPct != null ? Number(medAbsPct.toFixed(1)) : null,
      medianSignedBiasPct: medSignedPct != null ? Number(medSignedPct.toFixed(1)) : null,
      recommendation: meta.recommendation,
      priorityScore: Number(priorityScore.toFixed(2)),
      topExamples
    });
  }
  return items.sort((a, b) => b.priorityScore - a.priorityScore);
}

// =========================================================================
// Main Cross-Scale Offline Scientific Validation Runner
// =========================================================================

export async function runCrossScaleScientificValidation({
  repoRoot = process.cwd(),
  snapshotCacheDir = null,
  atlasPath = null
} = {}) {
  const resolvedAtlasPath = atlasPath || join(repoRoot, 'data/material-properties/foundation-polytope-atlas.json');
  const atlas = JSON.parse(await readFile(resolvedAtlasPath, 'utf8'));
  const elBySym = new Map((atlas.elements || []).map((e) => [e.materialKey, e]));
  const cmpByKey = new Map((atlas.compounds || []).map((c) => [c.materialKey, c]));

  let snapshotAudit = { snapshots: [], faults: [] };
  if (snapshotCacheDir) {
    snapshotAudit = await loadScienceSnapshotCache(snapshotCacheDir);
  }
  const snapList = Array.isArray(snapshotAudit.snapshots)
    ? snapshotAudit.snapshots
    : Object.values(snapshotAudit.snapshots || {});
  const loadedDatasetNames = snapList.map((s) => s?.manifest?.dataset).filter(Boolean);
  const pubchemSnap = snapList.find((s) => s?.manifest?.dataset === 'pubchem-periodic-table');
  const nistWeightSnap = snapList.find((s) => s?.manifest?.dataset === 'nist-atomic-weights');
  const pubchemRecords = pubchemSnap?.records || [];
  const nistWeightRecords = nistWeightSnap?.records || [];

  const allComparisons = [];
  const domainBuckets = {
    nuclear: [],
    atomicMassAndPeriodic: [],
    bulkSolidsAndPhase: [],
    compoundChemistry: [],
    organicAndBio: [],
    planetaryAtmospheres: [],
    stellarAndCosmology: []
  };

  // --- DOMAIN 1: NUCLEAR STRUCTURE (Live `nuclearStructureGpu.js` vs AME2020) ---
  for (const ref of AME2020_BENCHMARKS) {
    const cl = deriveNuclearClosure(ref.Z, ref.A);
    const bPerA = nuclearBindingEnergyMeV(ref.Z, ref.A) / ref.A;
    const rCh = nuclearChargeRadiusFm(ref.A);
    domainBuckets.nuclear.push(
      makeComparison({
        domain: 'nuclear', subject: ref.isotope, observable: 'B/A', unit: 'MeV',
        simulated: bPerA, reference: ref.bPerAMeV, relTol: 0.05,
        source: 'AME2020', physicsTag: 'nuclear-binding'
      }),
      makeComparison({
        domain: 'nuclear', subject: ref.isotope, observable: 'R_ch', unit: 'fm',
        simulated: rCh, reference: ref.rChFm, relTol: 0.10,
        source: 'Angeli-Marinova-2013', physicsTag: 'nuclear-radius'
      })
    );
    if (cl?.dominantMode && ref.isotope === 'Fe-56') {
      domainBuckets.nuclear.push(makeQualitativeComparison({
        domain: 'nuclear', subject: 'Fe-56', observable: 'stability',
        simulated: cl.dominantMode, reference: 'stable',
        source: 'AME2020', physicsTag: 'nuclear-binding'
      }));
    }
  }

  // --- DOMAIN 2: ALL-118 PERIODIC TABLE SNAPSHOT AUDIT (Live Gate 1 GPU Atlas vs Cached NIST & PubChem) ---
  for (const nw of nistWeightRecords) {
    const el = elBySym.get(nw.symbol);
    if (!el || nw.standardAtomicWeightU == null) continue;
    domainBuckets.atomicMassAndPeriodic.push(makeComparison({
      domain: 'atomicMassAndPeriodic', subject: nw.symbol, observable: 'atomicMass', unit: 'u',
      simulated: el.nuclear?.atomicMassU, reference: nw.standardAtomicWeightU, relTol: 0.03,
      source: 'NIST-SRD-144-2026-11-14', physicsTag: 'nuclear-binding'
    }));
  }
  for (const pc of pubchemRecords) {
    const el = elBySym.get(pc.symbol);
    if (!el) continue;
    // Compare solid/liquid standard-state density directly (skip low-pressure gas at STP vs cryogenic solid cell!)
    if (pc.densityKgPerM3 != null && pc.standardState !== 'Gas') {
      domainBuckets.bulkSolidsAndPhase.push(makeComparison({
        domain: 'bulkSolidsAndPhase', subject: pc.symbol, observable: 'density', unit: 'kg/m^3',
        simulated: el.mechanical?.densityKgPerM3, reference: pc.densityKgPerM3, relTol: 0.25,
        source: 'PubChem-2026-11-14', physicsTag: 'element-density-eos'
      }));
    }
    if (pc.meltingPointK != null) {
      domainBuckets.bulkSolidsAndPhase.push(makeComparison({
        domain: 'bulkSolidsAndPhase', subject: pc.symbol, observable: 'T_melt', unit: 'K',
        simulated: el.thermodynamic?.meltingPointK, reference: pc.meltingPointK, relTol: 0.30,
        source: 'PubChem-2026-11-14', physicsTag: 'element-phase-tm-tb'
      }));
    }
    if (pc.boilingPointK != null) {
      domainBuckets.bulkSolidsAndPhase.push(makeComparison({
        domain: 'bulkSolidsAndPhase', subject: pc.symbol, observable: 'T_boil', unit: 'K',
        simulated: el.thermodynamic?.boilingPointK, reference: pc.boilingPointK, relTol: 0.35,
        source: 'PubChem-2026-11-14', physicsTag: 'element-phase-tm-tb'
      }));
    }
  }

  // --- DOMAIN 3: ELEMENTAL CRYSTAL STRUCTURE, LATTICE a0, BULK MODULUS & MAGNETISM (CRC / Materials Project) ---
  for (const ref of CRC_ELEMENT_SOLID_BENCHMARKS) {
    const el = elBySym.get(ref.symbol);
    if (!el) continue;
    domainBuckets.bulkSolidsAndPhase.push(
      makeQualitativeComparison({
        domain: 'bulkSolidsAndPhase', subject: ref.symbol, observable: 'crystalClass',
        simulated: el.mechanical?.crystalStructure, reference: ref.crystal,
        source: 'CRC/MaterialsProject', physicsTag: 'element-density-eos'
      }),
      makeComparison({
        domain: 'bulkSolidsAndPhase', subject: ref.symbol, observable: 'a0', unit: 'A',
        simulated: el.mechanical?.latticeConstantA, reference: ref.a0A, relTol: 0.12,
        source: 'CRC/MaterialsProject', physicsTag: 'element-density-eos'
      }),
      makeComparison({
        domain: 'bulkSolidsAndPhase', subject: ref.symbol, observable: 'B0', unit: 'GPa',
        simulated: (el.mechanical?.bulkModulusPa ?? NaN) / 1e9, reference: ref.bulkGPa, relTol: 0.35,
        source: 'CRC/MaterialsProject', physicsTag: 'element-bulk-modulus'
      }),
      makeQualitativeComparison({
        domain: 'bulkSolidsAndPhase', subject: ref.symbol, observable: 'magneticPhase',
        simulated: el.electromagnetic?.magneticPhase, reference: ref.mag,
        source: 'CRC/Kittel', physicsTag: 'element-density-eos'
      })
    );
  }

  // --- DOMAIN 4: COMPOUND THERMODYNAMICS, DIELECTRIC & OPTICS (Gate 2 GPU Atlas vs NIST WebBook / IAPWS-95) ---
  for (const ref of NIST_COMPOUND_BENCHMARKS) {
    const cmp = cmpByKey.get(ref.key);
    if (!cmp) continue;
    domainBuckets.compoundChemistry.push(
      makeComparison({
        domain: 'compoundChemistry', subject: ref.key, observable: 'density', unit: 'kg/m^3',
        simulated: cmp.mechanical?.densityKgPerM3, reference: ref.densityKgM3, relTol: 0.25,
        source: 'NIST-WebBook', physicsTag: 'compound-hbond-packing'
      }),
      makeComparison({
        domain: 'compoundChemistry', subject: ref.key, observable: 'T_melt', unit: 'K',
        simulated: cmp.thermodynamic?.meltingPointK, reference: ref.tMeltK, relTol: 0.25,
        source: 'NIST-WebBook', physicsTag: 'compound-hbond-packing'
      }),
      makeComparison({
        domain: 'compoundChemistry', subject: ref.key, observable: 'C_p', unit: 'J/(kg*K)',
        simulated: cmp.thermodynamic?.heatCapacityCpJPerKgK, reference: ref.cpJPerKgK, relTol: 0.25,
        source: 'NIST-WebBook/IAPWS95', physicsTag: 'compound-hbond-packing'
      })
    );
    if (ref.tBoilK != null) {
      domainBuckets.compoundChemistry.push(makeComparison({
        domain: 'compoundChemistry', subject: ref.key, observable: 'T_boil', unit: 'K',
        simulated: cmp.thermodynamic?.boilingPointK, reference: ref.tBoilK, relTol: 0.30,
        source: 'NIST-WebBook', physicsTag: 'compound-hbond-packing'
      }));
    }
    if (ref.epsR != null) {
      domainBuckets.compoundChemistry.push(makeComparison({
        domain: 'compoundChemistry', subject: ref.key, observable: 'epsilon_r', unit: '1',
        simulated: cmp.electromagnetic?.staticDielectricConstant, reference: ref.epsR, relTol: 0.35,
        source: 'CRC/NIST', physicsTag: 'compound-hbond-packing'
      }));
    }
    if (ref.n550 != null) {
      domainBuckets.compoundChemistry.push(makeComparison({
        domain: 'compoundChemistry', subject: ref.key, observable: 'n(550nm)', unit: '1',
        simulated: cmp.electromagnetic?.refractiveIndex550Nm, reference: ref.n550, relTol: 0.12,
        source: 'CRC/RefractiveIndex', physicsTag: 'compound-optics-gap'
      }));
    }
  }

  // --- DOMAIN 5: ORGANIC CHEMISTRY & BIOPHYSICS (Live Solvers vs NIST WebBook / Mitchell Bioenergetics) ---
  const benzeneGraph = buildOrganicMolecularGraph(ORGANIC_MOLECULE_INITIAL_CONDITIONS['benzene'].build());
  const benzPi = solvePiMolecularOrbitalsAnalytic(benzeneGraph);
  domainBuckets.organicAndBio.push(
    makeQualitativeComparison({
      domain: 'organicAndBio', subject: 'Benzene', observable: 'aromatic4n+2',
      simulated: String(Boolean(benzPi.isAromatic4nPlus2)), reference: 'true',
      source: 'Huckel-4n+2', physicsTag: 'organic-acid-base'
    }),
    makeComparison({
      domain: 'organicAndBio', subject: 'Benzene', observable: 'HOMO-LUMO_gap', unit: 'eV',
      simulated: benzPi.homoLumoGapEv, reference: 5.5, relTol: 0.20,
      source: 'NIST-UV-Vis', physicsTag: 'organic-acid-base'
    })
  );
  const aceticGraph = buildOrganicMolecularGraph(ORGANIC_MOLECULE_INITIAL_CONDITIONS['acetic-acid'].build());
  const aceticEq = evaluateAcidBaseEquilibrium(aceticGraph, { pH: 7.0, dielectricEr: 78.4 });
  const primaryAcidSite = (aceticEq.sites || []).find((s) => s.kind === 'acid' || s.pKa < 10) || aceticEq.sites?.[0];
  domainBuckets.organicAndBio.push(makeComparison({
    domain: 'organicAndBio', subject: 'AceticAcid', observable: 'pKa', unit: 'pKa',
    simulated: primaryAcidSite?.pKa, reference: 4.756, absTol: 0.8,
    source: 'NIST-WebBook', physicsTag: 'organic-acid-base'
  }));

  const ethanolGraph = buildOrganicMolecularGraph(ORGANIC_MOLECULE_INITIAL_CONDITIONS['ethanol'].build());
  const ethEq = evaluateAcidBaseEquilibrium(ethanolGraph, { pH: 7.0, dielectricEr: 78.4 });
  const ethSite = (ethEq.sites || [])[0];
  domainBuckets.organicAndBio.push(makeComparison({
    domain: 'organicAndBio', subject: 'Ethanol', observable: 'pKa', unit: 'pKa',
    simulated: ethSite?.pKa, reference: 15.9, absTol: 2.0,
    source: 'NIST-WebBook', physicsTag: 'organic-acid-base'
  }));

  // Live Mitchell chemiosmotic proton-motive force at physiological mitochondrial state (Delta_psi=150mV, Delta_pH=1.0, T=310K)
  // Exact physical value: 150 + 61.51 = 211.5 mV
  const mitoBio = evaluateChemiosmoticBioenergetics({ deltaPsiMv: 150.0, deltaPh: 1.0, temperatureK: 310.0, uncouplerLeak: 0.0 });
  domainBuckets.organicAndBio.push(makeComparison({
    domain: 'organicAndBio', subject: 'Mitochondria', observable: 'PMF_Delta_p', unit: 'mV',
    simulated: mitoBio.protonMotiveForceMv, reference: 211.51, relTol: 0.02,
    source: 'Mitchell-1961', physicsTag: 'bio-chemiosmotic'
  }));

  // --- DOMAIN 6: PLANETARY SURFACES & STRATIFIED ATMOSPHERES (Live Solvers vs NASA Fact Sheets) ---
  for (const ref of NASA_PLANETARY_BENCHMARKS) {
    const spec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === ref.id);
    if (!spec) continue;
    const env = deriveSurfaceEnvironmentState(spec, { seed: 42 });
    domainBuckets.planetaryAtmospheres.push(makeComparison({
      domain: 'planetaryAtmospheres', subject: ref.name, observable: 'g_surf', unit: 'm/s^2',
      simulated: env.gravityMS2, reference: ref.gMS2, relTol: 0.08,
      source: 'NASA-FactSheet', physicsTag: 'planetary-atmosphere'
    }));
    if (ref.pBar > 0) {
      const prof = deriveAtmosphericColumnProfile(spec, env);
      const chem = evaluateAtmosphericChemistryAtAltitude(prof, 0.0);
      domainBuckets.planetaryAtmospheres.push(
        makeComparison({
          domain: 'planetaryAtmospheres', subject: ref.name, observable: 'P_surf', unit: 'bar',
          simulated: chem.pressureBar, reference: ref.pBar, relTol: 0.25,
          source: 'NASA-FactSheet', physicsTag: 'planetary-atmosphere'
        }),
        makeComparison({
          domain: 'planetaryAtmospheres', subject: ref.name, observable: 'T_surf', unit: 'K',
          simulated: chem.tempK, reference: ref.tempK, relTol: 0.15,
          source: 'NASA-FactSheet', physicsTag: 'planetary-atmosphere'
        }),
        makeComparison({
          domain: 'planetaryAtmospheres', subject: ref.name, observable: 'rho_atm', unit: 'kg/m^3',
          simulated: chem.rhoKgM3, reference: ref.rhoKgM3, relTol: 0.30,
          source: 'NASA-FactSheet', physicsTag: 'planetary-atmosphere'
        }),
        makeComparison({
          domain: 'planetaryAtmospheres', subject: ref.name, observable: 'scaleHeight', unit: 'km',
          simulated: chem.scaleHeightKm, reference: ref.scaleHeightKm, relTol: 0.25,
          source: 'NASA-FactSheet', physicsTag: 'planetary-atmosphere'
        })
      );
    } else {
      domainBuckets.planetaryAtmospheres.push(makeComparison({
        domain: 'planetaryAtmospheres', subject: ref.name, observable: 'rho_atm', unit: 'kg/m^3',
        simulated: env.rhoAtmKgM3, reference: 0.0, absTol: 1e-6,
        source: 'NASA-FactSheet', physicsTag: 'planetary-atmosphere'
      }));
    }
  }

  // --- DOMAIN 7: STELLAR STRUCTURE & LAMBDA-CDM COSMOLOGY (Live `cosmicEpochState.js` vs Planck 2018 / IAU) ---
  const ageTodayGyr = computeCosmicAgeGyr(1.0);
  const bao = evaluateEisensteinHuBaoTransfer(0.05);
  const cmbZ1100 = evaluateCosmicEpochState({ redshiftZ: 1100.0 });
  const sunNow = evaluateStellarEvolutionaryState({ massSolar: 1.0, ageGyr: 4.6 });
  const vegaNow = evaluateStellarEvolutionaryState({ massSolar: ASTRO_COSMO_BENCHMARKS.vegaMassMSun, ageGyr: 0.45 });
  const proxNow = evaluateStellarEvolutionaryState({ massSolar: ASTRO_COSMO_BENCHMARKS.proximaMassMSun, ageGyr: 4.8 });
  domainBuckets.stellarAndCosmology.push(
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'LambdaCDM(a=1)', observable: 't_0', unit: 'Gyr',
      simulated: ageTodayGyr, reference: ASTRO_COSMO_BENCHMARKS.cosmicAgeTodayGyr, relTol: 0.02,
      source: 'Planck-2018', physicsTag: 'astro-cosmo'
    }),
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'LambdaCDM-BAO', observable: 'r_s', unit: 'Mpc',
      simulated: bao.soundHorizonMpc, reference: ASTRO_COSMO_BENCHMARKS.baoSoundHorizonMpc, relTol: 0.05,
      source: 'Planck-2018', physicsTag: 'astro-cosmo'
    }),
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'CMB(z=1100)', observable: 'T_CMB', unit: 'K',
      simulated: cmbZ1100.cmbTempK, reference: ASTRO_COSMO_BENCHMARKS.cmbTempZ1100K, relTol: 0.01,
      source: 'Planck-2018', physicsTag: 'astro-cosmo'
    }),
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'Sun(1Msun)', observable: 'T_eff', unit: 'K',
      simulated: sunNow.effectiveTempK, reference: ASTRO_COSMO_BENCHMARKS.solarTeffK, relTol: 0.05,
      source: 'IAU-2015', physicsTag: 'astro-cosmo'
    }),
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'Sun(1Msun)', observable: 'L_star', unit: 'L_sun',
      simulated: sunNow.luminositySolar, reference: ASTRO_COSMO_BENCHMARKS.solarLumLSun, relTol: 0.15,
      source: 'IAU-2015', physicsTag: 'astro-cosmo'
    }),
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'Vega(2.14Msun)', observable: 'L_star', unit: 'L_sun',
      simulated: vegaNow.luminositySolar, reference: ASTRO_COSMO_BENCHMARKS.vegaLumLSun, relTol: 0.35,
      source: 'Gaia/Boyajian', physicsTag: 'astro-cosmo'
    }),
    makeComparison({
      domain: 'stellarAndCosmology', subject: 'Proxima(0.12Msun)', observable: 'T_eff', unit: 'K',
      simulated: proxNow.effectiveTempK, reference: ASTRO_COSMO_BENCHMARKS.proximaTeffK, relTol: 0.15,
      source: 'Gaia/Boyajian', physicsTag: 'astro-cosmo'
    })
  );

  const domainSummaries = [
    summarizeDomain('nuclear', '1. Nuclear Structure (10^-15 m)', domainBuckets.nuclear),
    summarizeDomain('atomicMassAndPeriodic', '2. Atomic Weights (NIST SRD 144, Z=1..118)', domainBuckets.atomicMassAndPeriodic),
    summarizeDomain('bulkSolidsAndPhase', '3. Elemental Solids, Crystals & Phase Transitions (PubChem/CRC)', domainBuckets.bulkSolidsAndPhase),
    summarizeDomain('compoundChemistry', '4. Compound Thermodynamics, Dielectric & Optics (NIST WebBook)', domainBuckets.compoundChemistry),
    summarizeDomain('organicAndBio', '5. Organic Chemistry & Biophysics (Huckel/pKa/Mitchell)', domainBuckets.organicAndBio),
    summarizeDomain('planetaryAtmospheres', '6. Planetary Gravity & Stratified Atmospheres (NASA Fact Sheets)', domainBuckets.planetaryAtmospheres),
    summarizeDomain('stellarAndCosmology', '7. Stellar Evolution & Lambda-CDM Cosmology (IAU/Planck 2018)', domainBuckets.stellarAndCosmology)
  ];

  for (const list of Object.values(domainBuckets)) {
    allComparisons.push(...list);
  }

  const totalEvaluated = allComparisons.filter((c) => c.status !== 'missing').length;
  const totalAgrees = allComparisons.filter((c) => c.status === 'agrees').length;
  const totalDeviates = allComparisons.filter((c) => c.status === 'deviates').length;
  const calibrationTriage = buildCalibrationTriage(allComparisons);

  return {
    schema: ULG_SCIENTIFIC_VALIDATION_SCHEMA,
    generatedAt: new Date().toISOString(),
    advisory: true,
    runtimeAuthority: false,
    blocksWorkflow: false,
    scientificValidation: false,
    atlasBackend: atlas.derivationBackend || 'unknown',
    snapshotIntegrity: {
      ok: (snapshotAudit.faults || []).length === 0,
      loadedDatasets: loadedDatasetNames,
      faults: snapshotAudit.faults || []
    },
    totals: {
      comparisons: allComparisons.length,
      evaluated: totalEvaluated,
      agrees: totalAgrees,
      deviates: totalDeviates,
      missing: allComparisons.length - totalEvaluated,
      agreementRatePct: totalEvaluated ? Number(((totalAgrees / totalEvaluated) * 100).toFixed(1)) : 0
    },
    domains: domainSummaries,
    calibrationTriage,
    comparisons: allComparisons
  };
}

function fmtNum(x, digits = 3) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return String(x ?? '—');
  const a = Math.abs(x);
  if (a > 0 && (a >= 1e5 || a < 1e-2)) return x.toExponential(2);
  return Number(x.toPrecision(Math.max(3, digits))).toString();
}

export function renderCrossScaleValidationMarkdown(report) {
  const lines = [
    '# ULG Cross-Scale Scientific Validation & Calibration Scorecard',
    '',
    `- **Schema:** \`${report.schema}\` (Generated: \`${report.generatedAt}\`)`,
    `- **Policy:** \`advisory: true\`, \`runtimeAuthority: false\`, \`blocksWorkflow: false\`, \`scientificValidation: false\` (offline empirical diagnostic only — never a runtime gate or lookup table)`,
    `- **Atlas Backend:** \`${report.atlasBackend}\``,
    `- **Cached G7 Snapshots Verified:** ${report.snapshotIntegrity.loadedDatasets.length ? report.snapshotIntegrity.loadedDatasets.map((d) => `\`${d}\``).join(', ') : 'none'} (integrity ok: \`${report.snapshotIntegrity.ok}\`, faults: \`${report.snapshotIntegrity.faults.length}\`)`,
    `- **Overall Empirical Audit:** **${report.totals.agrees}/${report.totals.evaluated} agrees (${report.totals.agreementRatePct}%)** · ${report.totals.deviates} deviations · ${report.totals.missing} missing`,
    '',
    '## 1. Per-Domain Quantitative Summary (`10⁻¹⁵ m → 10⁺²⁵ m`)',
    '',
    '| Domain | Evaluated | Agree | Deviate | Agreement % | Median |Err| % | Median Bias % | Top Outlier |',
    '|---|---:|---:|---:|---:|---:|---:|---|'
  ];

  for (const d of report.domains) {
    const out = d.worstOutliers[0];
    const outStr = out
      ? `${out.subject} ${out.observable}: sim ${fmtNum(out.simulated)} vs ref ${fmtNum(out.reference)} ${out.unit}`
      : '—';
    lines.push(
      `| ${d.title} | ${d.evaluated} | ${d.agrees} | ${d.deviates} | ${d.agreementRatePct != null ? `${d.agreementRatePct.toFixed(1)}%` : '—'} | ${d.medianAbsPct != null ? `${d.medianAbsPct.toFixed(1)}%` : '—'} | ${d.medianBiasPct != null ? `${d.medianBiasPct >= 0 ? '+' : ''}${d.medianBiasPct.toFixed(1)}%` : '—'} | ${outStr} |`
    );
  }

  lines.push(
    '',
    '## 2. Physics-Root-Cause Calibration Triage (Ranked by Impact)',
    '',
    'These groups identify **underlying physical closure approximations** to refine — never per-element or per-material lookup overrides:',
    ''
  );

  for (let i = 0; i < report.calibrationTriage.length; i += 1) {
    const t = report.calibrationTriage[i];
    const exStr = t.topExamples
      .map((e) => `${e.subject} \`${e.observable}\` (${fmtNum(e.simulated)} vs ${fmtNum(e.reference)} ${e.unit}${e.relErrPct != null ? `, ${e.relErrPct >= 0 ? '+' : ''}${e.relErrPct}%` : ''})`)
      .join('; ');
    lines.push(
      `### ${i + 1}. ${t.title}`,
      `- **Deviations:** ${t.deviationCount} · **Median |Err|:** ${t.medianAbsErrPct != null ? `${t.medianAbsErrPct}%` : 'qualitative'} · **Median Bias:** ${t.medianSignedBiasPct != null ? `${t.medianSignedBiasPct >= 0 ? '+' : ''}${t.medianSignedBiasPct}%` : '—'}`,
      `- **Top Examples:** ${exStr}`,
      `- **First-Principles Tuning Action:** ${t.recommendation}`,
      ''
    );
  }

  return `${lines.join('\n')}\n`;
}
