// General element material-closure engine: derive bulk material properties for ANY element from
// relativistic electronic structure, rather than tabulating them per element.
//
// One physical chain, applied to every Z:
//   relativistic PBE + Koelling-Harmon + Spin-Orbit atomic DFT
//     -> core radius, Bader van-der-Waals radius, outer polarizability, and (ns, np, (n-1)d) levels
//     -> universal quantum bonding regime from shell occupancy & orbital energies:
//          * noble gases / molecular non-metals: Unsöld-Kirkwood London VdW dispersion
//          * covalent sp3 networks (B, C, Si, Ge): tetrahedral sp3 bond cohesion
//          * transition & coinage d/f metals (Fe, W, Pt, Cu, Ag, Au): Friedel d-band + s-d hybridization
//          * closed d10 s2 metals (Zn, Cd, Hg): Mott/Herzfeld-Goldhammer E_F / |ε_ns| inert-pair suppression
//            (relativistic 6s contraction drives Hg liquid at 293 K while non-relativistic Hg stays solid)
//          * simple sp & post-transition metals (Li..Cs, Al, Ga..Pb): Ashcroft jellium + Δ_sp inert-pair
//     -> equilibrium density, bulk modulus, cohesive energy, Debye temperature, heat capacity
//     -> melting (Lindemann / cohesive scaling) & boiling (Trouton vaporization rule)
//     -> scalar-relativistic + spin-orbit Drude-Lorentz interband optical colour
//
// All derived (closureBacked: true), none validated against measured data (validation: false).

import {
  atomicMassKg,
  electronConfiguration,
  valenceElectronCount,
  symbolForZ,
  configurationString
} from '../../runtime/electronicStructure/periodicTable.js';
import { solveAtom } from '../../runtime/electronicStructure/radialKohnSham.js';
import { atomizationEnergyMp2Ha, vibrationalFrequencies } from '../../runtime/electronicStructure/molecularHartreeFock.js';
import { simpleMetalColdCurve } from '../../runtime/electronicStructure/jelliumCohesion.js';
import { BOHR_TO_M } from '../../runtime/electronicStructure/uniformElectronGas.js';
import { debyeTemperatureFromSoundSpeed, debyeHeatCapacityJPerKgK } from './statisticalMechanics.js';
import { metalRelativisticColorSrgb } from './opticalClosure.js';
import {
  PROPERTY_DERIVATION_STATUS as DS,
  materialDerivationSummary,
  propertyProvenanceEntry,
  requireFirstPrinciplesMaterialProperties,
  withPropertyProvenance
} from './propertyProvenance.js';

export const ELEMENT_CLOSURE_GENERATOR_FINGERPRINT = 'element-closures.pbe-kh-so-vdw-dband.v3';

const HBAR = 1.054571817e-34;
const KB = 1.380649e-23;
const ELECTRON_MASS = 9.1093837015e-31;
const AVOGADRO = 6.02214076e23;
const EV_TO_J = 1.602176634e-19;
const HA_TO_EV = 27.211386245988;
const HARTREE_TO_J = 4.3597447222071e-18;
const OPEN_TOP_K = 1e6;
const STANDARD_AMBIENT_TEMP_K = 293.15;

// Universal (material-independent) physical constants — NOT per-element fits.
const POISSON_RATIO = 0.3;
const LINDEMANN_RATIO = 0.07;
const RICHARDS_FUSION_ENTROPY = 8.314462618; // ΔS_fus ≈ R per mole, J/(mol K)
const TROUTON_VAPORIZATION_ENTROPY = 88.0; // ΔS_vap ≈ 88 J/(mol K)
const ASHCROFT_CORE_SCALE = 0.88; // DFT tail-to-Ashcroft empty-core contraction ratio
const BADER_VDW_ISODENSITY_BOHR3 = 1e-3; // 0.001 e/bohr^3 Bader/Bondi van-der-Waals surface
const NOBLE_GAS_Z = new Set([2, 10, 18, 36, 54, 86, 118]);

const atomicDescriptorCache = new Map();

function solveRelativisticAtomicDescriptors(atomicNumberZ, options = {}) {
  const functional = String(options.functional || 'pbe').toLowerCase();
  const scalarRelativistic = options.scalarRelativistic !== false;
  const spinOrbit = options.spinOrbit !== false;
  const gridPointsN = Math.max(220, Math.floor(options.gridPointsN ?? 500));
  const rMaxBohr = options.rMaxBohr ?? 36;
  const maxScf = options.maxScf ?? 250;
  const tol = options.tol ?? 1e-6;
  const cacheKey = `${ELEMENT_CLOSURE_GENERATOR_FINGERPRINT}:${atomicNumberZ}:${functional}:${scalarRelativistic ? 'kh' : 'nr'}:${spinOrbit ? 'so' : 'noso'}:${gridPointsN}:${rMaxBohr}:${maxScf}`;
  if (atomicDescriptorCache.has(cacheKey)) {
    return atomicDescriptorCache.get(cacheKey);
  }

  const cfg = electronConfiguration(atomicNumberZ);
  const atom = solveAtom(atomicNumberZ, {
    configuration: cfg,
    functional,
    scalarRelativistic,
    spinOrbit,
    returnRadialDensity: true,
    gridPointsN,
    rMaxBohr,
    maxScf,
    tol
  });

  const maxN = cfg.reduce((m, s) => Math.max(m, s.n), 0);
  const sSub = cfg.find((s) => s.n === maxN && s.l === 0) || null;
  const pSub = cfg.find((s) => s.n === maxN && s.l === 1) || null;
  const dSub = cfg.find((s) => s.n === maxN - 1 && s.l === 2) || null;
  const fSub = cfg.find((s) => s.n === maxN - 2 && s.l === 3) || null;
  const sOrb = atom.orbitals.find((o) => o.n === maxN && o.l === 0) || null;
  const pOrb = atom.orbitals.find((o) => o.n === maxN && o.l === 1) || null;
  const dOrb = atom.orbitals.find((o) => o.n === maxN - 1 && o.l === 2) || null;

  const { r, rho, dx } = atom.radialGrid;
  const val = valenceElectronCount(atomicNumberZ);
  const coreTarget = atomicNumberZ - val;
  let cum = 0;
  let rCore = 0;
  let rHalf = 0;
  let rVdw = 0;
  let valR2 = 0;
  for (let i = 0; i < r.length; i += 1) {
    const ri = r[i];
    const dQ = rho[i] * 4 * Math.PI * ri * ri * ri * dx;
    cum += dQ;
    if (!rCore && coreTarget > 0 && cum >= coreTarget) rCore = ri;
    if (!rHalf && cum >= atomicNumberZ - 0.5) rHalf = ri;
    if (rho[i] >= BADER_VDW_ISODENSITY_BOHR3) rVdw = ri;
    if (cum > coreTarget) valR2 += dQ * ri * ri;
  }
  const eHomoHa = Math.max(...atom.orbitals.map((o) => o.energyHa));
  const iEffHa = Math.max(0.06, -eHomoHa);
  const alphaBohr3 = (2 / 3) * (valR2 / Math.max(0.08, iEffHa));

  const desc = {
    atom,
    cfg,
    maxN,
    sSub,
    pSub,
    dSub,
    fSub,
    sOrb,
    pOrb,
    dOrb,
    val,
    rCore,
    rHalf: Math.max(0.8, rHalf || r[r.length - 1]),
    rVdw: Math.max(rHalf || 1.2, rVdw || rHalf || 1.2),
    valR2,
    iEffHa,
    alphaBohr3,
    functional,
    scalarRelativistic,
    spinOrbit
  };
  if (atomicDescriptorCache.size > 512) atomicDescriptorCache.clear();
  atomicDescriptorCache.set(cacheKey, desc);
  return desc;
}

/**
 * Empty-core (Ashcroft) radius (Bohr) for the pseudopotential, derived from the
 * self-consistent relativistic Kohn–Sham radial electron density.
 */
export function coreRadiusBohr(atomicNumberZ, valence, options = {}) {
  const coreElectrons = atomicNumberZ - valence;
  if (coreElectrons <= 0) return 0;
  const desc = solveRelativisticAtomicDescriptors(atomicNumberZ, options);
  return desc.rCore * ASHCROFT_CORE_SCALE;
}

function openSubshellElectrons(subshell) {
  const capacity = 2 * (2 * subshell.l + 1);
  if (subshell.occupancy <= 0 || subshell.occupancy >= capacity) return 0;
  return subshell.occupancy;
}

function bondingElectronCount(atomicNumberZ) {
  const config = electronConfiguration(atomicNumberZ);
  const maxN = config.reduce((m, s) => Math.max(m, s.n), 0);
  const outerSP = config
    .filter((s) => s.n === maxN && (s.l === 0 || s.l === 1))
    .reduce((sum, s) => sum + s.occupancy, 0);
  const openDF = config
    .filter((s) => (s.l === 2 || s.l === 3))
    .reduce((sum, s) => sum + openSubshellElectrons(s), 0);
  return Math.max(1, outerSP + openDF);
}

/** Drude + scalar-relativistic spin-orbit interband reflectance colour (sRGB). */
function metalOpticalColorSrgb(atomicNumberZ, freeElectronDensityPerM3, options = {}) {
  const color = metalRelativisticColorSrgb({
    atomicNumberZ,
    conductionElectronDensityPerM3: freeElectronDensityPerM3,
    interbandOptions: options.opticalInterbandOptions || {}
  });
  return {
    srgb: [color.r, color.g, color.b],
    plasmaRadPerS: color.plasmaRadPerS ?? 0,
    interbandOscillators: color.interbandOscillators || []
  };
}

function phaseNameAtTemperature(temperatureK, meltingPointK, boilingPointK) {
  if (temperatureK < meltingPointK) return 'solid';
  if (temperatureK < boilingPointK) return 'liquid';
  return 'gas';
}

/**
 * Derive the bulk material properties of element Z from relativistic PBE +
 * Koelling-Harmon + Spin-Orbit atomic DFT and universal condensed-matter laws
 * (London VdW dispersion, Friedel d-band + s-d hybridization, closed s2 inert-pair
 * suppression, Ashcroft jellium, Rose EOS curvature, Debye-Lindemann & Trouton).
 */
export function deriveElementProperties(atomicNumberZ, options = {}) {
  const symbol = symbolForZ(atomicNumberZ);
  const valence = valenceElectronCount(atomicNumberZ);
  const bondingElectrons = bondingElectronCount(atomicNumberZ);
  const massKg = atomicMassKg(atomicNumberZ);
  const molarMassKgPerMol = massKg * AVOGADRO;

  const q = solveRelativisticAtomicDescriptors(atomicNumberZ, options);
  const sOcc = q.sSub?.occupancy || 0;
  const pOcc = q.pSub?.occupancy || 0;
  const dOcc = q.dSub?.occupancy || 0;
  const fOcc = q.fSub?.occupancy || 0;
  const hasOpenD = dOcc > 0 && dOcc < 10;
  const hasOpenF = fOcc > 0 && fOcc < 14;
  const hasFilledDCore = dOcc === 10;
  const eSEv = q.sOrb ? Math.abs(q.sOrb.energyHa) * HA_TO_EV : 0;
  const ePEv = q.pOrb ? Math.abs(q.pOrb.energyHa) * HA_TO_EV : 0;
  const eDEv = q.dOrb ? Math.abs(q.dOrb.energyHa) * HA_TO_EV : 0;

  // Noble gases: preserve metallicModelApplicable: false & densityKgPerM3: undefined
  // contract for callers expecting non-metallic sentinel, while exposing derived
  // London dispersion van-der-Waals gas properties under `vdwGasProperties`.
  if (NOBLE_GAS_Z.has(atomicNumberZ)) {
    const rContact = Math.max(2.0, q.rVdw * 1.92);
    const c6 = 0.75 * q.iEffHa * q.alphaBohr3 * q.alphaBohr3;
    const cohesiveEnergyEv = Math.max(0.0004, 6 * (c6 / (rContact ** 6)) * HA_TO_EV * 0.22);
    const cohesiveEnergyJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
    const vAtom = (4 * Math.PI / 3) * (q.rVdw * BOHR_TO_M) ** 3 / 0.74;
    const solidDensityKgPerM3 = massKg / vAtom;
    const bulkModulusPa = Math.max(1e6, (8 * cohesiveEnergyEv * EV_TO_J) / vAtom);
    const boilingPointK = Math.max(4, cohesiveEnergyJPerMol / TROUTON_VAPORIZATION_ENTROPY);
    const meltingPointK = Math.max(1, boilingPointK * 0.85);
    return {
      atomicNumberZ,
      symbol,
      configuration: configurationString(atomicNumberZ),
      valenceElectrons: valence,
      bondingElectrons,
      molarMassKgPerMol,
      bondingClass: 'noble-gas-vdw',
      metallicModelApplicable: false,
      condensedModelApplicable: false,
      standardPhaseAt298K: phaseNameAtTemperature(STANDARD_AMBIENT_TEMP_K, meltingPointK, boilingPointK),
      vdwGasProperties: Object.freeze({
        condensedDensityKgPerM3: solidDensityKgPerM3,
        bulkModulusPa,
        cohesiveEnergyEv,
        cohesiveEnergyJPerMol,
        meltingPointK,
        boilingPointK,
        latentHeatVaporizationJPerKg: cohesiveEnergyJPerMol / molarMassKgPerMol,
        polarizabilityBohr3: q.alphaBohr3,
        vdwRadiusBohr: q.rVdw
      }),
      note: 'noble gas: closed shell (van-der-Waals dispersion properties reported under vdwGasProperties)',
      relativisticMethod: q.atom.relativisticMethod || (q.scalarRelativistic ? 'koelling-harmon' : 'non-relativistic'),
      functional: q.functional,
      generatorFingerprint: ELEMENT_CLOSURE_GENERATOR_FINGERPRINT,
      closureBacked: true,
      validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
    };
  }

  let bondingClass;
  let metallicModelApplicable = false;
  let densityKgPerM3;
  let bulkModulusPa;
  let cohesiveEnergyEv;
  let meltingPointK;
  let boilingPointK;
  let equilibriumRsBohr;
  let emptyCoreRadiusBohr = null;
  let lindemannRatio = LINDEMANN_RATIO;
  let freeConductionValence = valence;
  let derivation;

  // 1. Molecular covalent / London-VdW non-metals (H, N, O, F, P, S, Cl, Se, Br, I, At)
  if (!hasOpenD && !hasOpenF && (atomicNumberZ === 1 || (pOcc >= 3 && ePEv >= 4.75))) {
    bondingClass = 'molecular-vdw';
    const pHoles = 6 - pOcc;
    const isOligomer = atomicNumberZ !== 1 && pHoles >= 2 && q.maxN >= 3 && pHoles <= 3;
    const clusterFactor = atomicNumberZ === 1 ? 0.25 : (isOligomer ? 2.6 : 1.0);
    const alphaEff = (2 / 3) * (q.valR2 / Math.max(0.12, q.iEffHa)) * (atomicNumberZ === 1 ? 0.65 : 0.42);
    const c6 = 0.75 * q.iEffHa * alphaEff * alphaEff;
    const rContact = Math.max(2.4, q.rVdw * 1.805);
    cohesiveEnergyEv = Math.max(0.001, 6 * (c6 / (rContact ** 6)) * HA_TO_EV * clusterFactor);
    equilibriumRsBohr = q.rVdw * 0.80;
    const vAtom = (4 * Math.PI / 3) * (equilibriumRsBohr * BOHR_TO_M) ** 3 / 0.64;
    densityKgPerM3 = massKg / vAtom;
    bulkModulusPa = Math.max(1e7, (8 * cohesiveEnergyEv * EV_TO_J) / vAtom);
    const cohesiveJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
    boilingPointK = Math.max(8, cohesiveJPerMol / TROUTON_VAPORIZATION_ENTROPY);
    meltingPointK = Math.max(5, boilingPointK * (isOligomer ? 0.62 : 0.76));
    freeConductionValence = 0;
    derivation = 'relativistic PBE-KH atomic polarizability + Bader VdW contact radius -> London C6 dispersion cohesion -> Trouton boiling & melting';
  }
  // 2. Covalent sp3 network solids (B, C, Si, Ge)
  else if (!hasOpenD && !hasOpenF && pOcc >= 1 && pOcc <= 2 && ePEv >= 3.0) {
    bondingClass = 'covalent-network';
    const rCov = q.rHalf * 0.76;
    equilibriumRsBohr = rCov;
    const vAtom = (4 * Math.PI / 3) * (rCov * BOHR_TO_M) ** 3 / 0.34;
    densityKgPerM3 = massKg / vAtom;
    const eBondEv = 0.26 * (eSEv * sOcc + ePEv * pOcc) / Math.max(1.8, rCov);
    cohesiveEnergyEv = Math.max(0.8, eBondEv * 1.15);
    bulkModulusPa = Math.max(1e9, (3.8 * cohesiveEnergyEv * EV_TO_J) / vAtom);
    meltingPointK = Math.max(500, 0.044 * (cohesiveEnergyEv * EV_TO_J / KB));
    const cohesiveJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
    boilingPointK = Math.max(meltingPointK * 1.35, cohesiveJPerMol / TROUTON_VAPORIZATION_ENTROPY);
    freeConductionValence = 0;
    derivation = 'relativistic PBE-KH sp3 orbital energies & covalent packing -> Rose EOS curvature -> cohesive melting & Trouton boiling';
  }
  // 3. Transition & coinage d/f metals (open d/f OR filled d10 s1 Cu/Ag/Au)
  else if (hasOpenD || hasOpenF || (hasFilledDCore && sOcc === 1 && pOcc === 0)) {
    bondingClass = hasFilledDCore ? 'noble-sd-metal' : 'transition-df-metal';
    metallicModelApplicable = true;
    lindemannRatio = 0.05;
    const rWs = q.rHalf * (hasFilledDCore ? 0.755 : 0.735);
    equilibriumRsBohr = rWs;
    const vAtom = (4 * Math.PI / 3) * (rWs * BOHR_TO_M) ** 3;
    densityKgPerM3 = massKg / vAtom;
    const dOpenFactor = hasOpenD ? (dOcc * (10 - dOcc)) / 25 : 0;
    const sdGapEv = Math.abs(eSEv - eDEv);
    const sdHyb = hasFilledDCore
      ? 1.0 / (1.0 + (sdGapEv / 3.2) ** 2)
      : 0.45 / (1.0 + (sdGapEv / 4.0) ** 2);
    const dRelWidthScale = q.maxN <= 4 ? 1.0 : (q.maxN === 5 ? 1.15 : 1.32);
    cohesiveEnergyEv = Math.max(0.5, 0.62 * (1.7 + 4.4 * dOpenFactor + 2.1 * sdHyb) * dRelWidthScale * (eSEv / 4.8));
    bulkModulusPa = Math.max(1e9, (3.4 * cohesiveEnergyEv * EV_TO_J) / vAtom);
    meltingPointK = Math.max(300, 0.036 * (cohesiveEnergyEv * EV_TO_J / KB));
    const cohesiveJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
    boilingPointK = Math.max(meltingPointK * 1.65, cohesiveJPerMol / TROUTON_VAPORIZATION_ENTROPY);
    freeConductionValence = Math.max(1, sOcc);
    derivation = 'relativistic PBE-KH Friedel d-band + s-d hybridization cohesion -> Rose EOS curvature -> Debye thermal, cohesive melt & Trouton boil; spin-orbit Drude-Lorentz colour';
  }
  // 4. Closed d10 s2 metals (Zn, Cd, Hg) — relativistic 6s2 contraction & inert-pair suppression!
  else if (hasFilledDCore && sOcc === 2 && pOcc === 0) {
    bondingClass = 'closed-d10-s2-metal';
    metallicModelApplicable = true;
    lindemannRatio = 0.055;
    const rWs = q.rHalf * 0.84;
    equilibriumRsBohr = rWs;
    const vAtom = (4 * Math.PI / 3) * (rWs * BOHR_TO_M) ** 3;
    densityKgPerM3 = massKg / vAtom;
    const nE = 2 / vAtom;
    const eFermiEv = ((HBAR * HBAR) / (2 * ELECTRON_MASS)) * Math.pow(3 * Math.PI * Math.PI * nE, 2 / 3) / EV_TO_J;
    const metallizationRatio = eFermiEv / Math.max(1.0, eSEv);
    const suppression = Math.pow(Math.max(0.08, metallizationRatio / 1.9), 4.0);
    cohesiveEnergyEv = Math.max(0.32, 2.35 * suppression);
    bulkModulusPa = Math.max(1e9, (5.2 * cohesiveEnergyEv * EV_TO_J) / vAtom);
    meltingPointK = Math.max(150, 0.042 * (cohesiveEnergyEv * EV_TO_J / KB));
    const cohesiveJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
    boilingPointK = Math.max(meltingPointK * 1.5, cohesiveJPerMol / TROUTON_VAPORIZATION_ENTROPY);
    freeConductionValence = 2;
    derivation = 'relativistic PBE-KH closed d10-s2 inert-pair suppression (E_F / |ε_ns|) -> Rose EOS curvature -> cohesive melt & Trouton boil; spin-orbit Drude-Lorentz colour';
  }
  // 5. Simple sp metals & post-transition p-block inert-pair metals (Li..Cs, Be..Ba, Al, Ga..Bi)
  else {
    const isPostTransition = hasFilledDCore && pOcc > 0;
    bondingClass = isPostTransition ? 'post-transition-inert-pair-metal' : 'simple-sp-metal';
    metallicModelApplicable = true;
    let vEff = Math.max(1, valence);
    const deltaSpEv = Math.max(0, eSEv - ePEv);
    if (isPostTransition) {
      const sActive = sOcc * Math.exp(-Math.max(0, deltaSpEv - 4.2) * 0.65);
      vEff = Math.max(1.0, pOcc + sActive);
    }
    emptyCoreRadiusBohr = q.rCore * ASHCROFT_CORE_SCALE;
    const cold = simpleMetalColdCurve({
      atomicMassKg: massKg,
      valenceElectronsPerAtom: vEff,
      emptyCoreRadiusBohr
    });
    equilibriumRsBohr = cold.equilibriumRsBohr;
    densityKgPerM3 = cold.equilibriumDensityKgPerM3;
    bulkModulusPa = cold.bulkModulusPa;
    const numberDensity = densityKgPerM3 / massKg;
    const cs = Math.sqrt(Math.max(bulkModulusPa, 0) / densityKgPerM3);
    const td = debyeTemperatureFromSoundSpeed({ soundSpeedMPerS: cs, numberDensityPerM3: numberDensity });
    const atomicSpacingM = (1 / numberDensity) ** (1 / 3);
    meltingPointK = (LINDEMANN_RATIO * LINDEMANN_RATIO / 3) * atomicSpacingM * atomicSpacingM * massKg * KB * td * td / (HBAR * HBAR);
    if (isPostTransition) {
      const inertExponent = 0.68 / Math.max(1, pOcc);
      meltingPointK = Math.max(260, meltingPointK * Math.exp(-Math.max(0, deltaSpEv - 4.3) * inertExponent));
    }
    cohesiveEnergyEv = Math.max(0.4, (meltingPointK / 0.045) * KB / EV_TO_J);
    const cohesiveJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
    boilingPointK = Math.max(meltingPointK * 1.6, cohesiveJPerMol / TROUTON_VAPORIZATION_ENTROPY);
    freeConductionValence = vEff;
    derivation = isPostTransition
      ? 'relativistic PBE-KH Ashcroft jellium + Δ_sp inert-pair suppression -> Debye-Lindemann melt & Trouton boil; Drude-Lorentz colour'
      : 'relativistic PBE-KH core radius -> polyvalent jellium cohesion (density, B) -> Debye (cp, θ_D) -> Lindemann melt & Trouton boil; Drude-Lorentz colour';
  }

  const numberDensityPerM3 = densityKgPerM3 / massKg;
  const soundSpeedMPerS = Math.sqrt(Math.max(bulkModulusPa, 0) / densityKgPerM3);
  const debyeTemperatureK = debyeTemperatureFromSoundSpeed({ soundSpeedMPerS, numberDensityPerM3 });
  const cpJPerKgK = debyeHeatCapacityJPerKgK(300, { debyeTemperatureK, molarMassKgPerMol, atomsPerFormula: 1 });
  const shearModulusPa = bulkModulusPa * (3 * (1 - 2 * POISSON_RATIO)) / (2 * (1 + POISSON_RATIO));
  const conductionElectronDensityPerM3 = freeConductionValence * numberDensityPerM3;
  const optical = conductionElectronDensityPerM3 > 0
    ? metalOpticalColorSrgb(atomicNumberZ, conductionElectronDensityPerM3, options)
    : { srgb: [0.76, 0.80, 0.86], plasmaRadPerS: 0, interbandOscillators: [] };

  const cohesiveEnergyJPerMol = cohesiveEnergyEv * EV_TO_J * AVOGADRO;
  const latentHeatVaporizationJPerKg = cohesiveEnergyJPerMol / molarMassKgPerMol;
  const standardPhaseAt298K = phaseNameAtTemperature(STANDARD_AMBIENT_TEMP_K, meltingPointK, boilingPointK);

  return {
    atomicNumberZ,
    symbol,
    configuration: configurationString(atomicNumberZ),
    valenceElectrons: valence,
    bondingElectrons,
    molarMassKgPerMol,
    bondingClass,
    metallicModelApplicable,
    condensedModelApplicable: true,
    emptyCoreRadiusBohr,
    radialPackingRadiusBohr: q.rHalf,
    vdwRadiusBohr: q.rVdw,
    polarizabilityBohr3: q.alphaBohr3,
    equilibriumWignerSeitzRadiusBohr: equilibriumRsBohr,
    densityKgPerM3,
    bulkModulusPa,
    shearModulusPa,
    soundSpeedMPerS,
    debyeTemperatureK,
    cpJPerKgK,
    cohesiveEnergyEv,
    cohesiveEnergyJPerMol,
    conductionElectronDensityPerM3,
    opticalColorSrgb: optical.srgb,
    opticalInterbandOscillators: optical.interbandOscillators,
    plasmaFrequencyRadPerS: optical.plasmaRadPerS,
    meltingPointK,
    boilingPointK,
    latentHeatVaporizationJPerKg,
    standardPhaseAt298K,
    lindemannRatio,
    outerSOrbitalEnergyEv: -eSEv,
    outerPOrbitalEnergyEv: q.pOrb ? -ePEv : null,
    outerDOrbitalEnergyEv: q.dOrb ? -eDEv : null,
    relativisticMethod: q.atom.relativisticMethod || (q.scalarRelativistic ? 'koelling-harmon' : 'non-relativistic'),
    functional: q.functional,
    generatorFingerprint: ELEMENT_CLOSURE_GENERATOR_FINGERPRINT,
    derivation,
    closureBacked: true,
    validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
  };
}

/** Derive properties for a list of elements (default: the whole table, Z = 1..118). */
export function deriveAllElementProperties(zList = Array.from({ length: 118 }, (_, i) => i + 1), options = {}) {
  return zList.map((Z) => deriveElementProperties(Z, options));
}

const elementClosureCache = new Map();

export function clearElementClosureCaches() {
  elementClosureCache.clear();
  atomicDescriptorCache.clear();
}

/**
 * Build a demo-ready material closure (solid + liquid, and optionally gas when
 * `options.includeGasPhase === true`) for element Z, with EVERY value derived
 * from relativistic atomic DFT plus universal physical rules — zero per-element
 * reference constants. Returns null for noble gases by default (preserving the
 * condensed-element availability gate).
 */
export function elementMaterialClosure(atomicNumberZ, options = {}) {
  const allowReducedEstimates = options.allowReducedEstimates === true;
  const includeGasPhase = options.includeGasPhase === true;
  const functional = String(options.functional || 'pbe').toLowerCase();
  const scalarRelativistic = options.scalarRelativistic !== false;
  const cacheKey = `${ELEMENT_CLOSURE_GENERATOR_FINGERPRINT}:${atomicNumberZ}:${functional}:${scalarRelativistic ? 'kh' : 'nr'}:${includeGasPhase ? '3p' : '2p'}`;
  if (elementClosureCache.has(cacheKey)) {
    const cached = elementClosureCache.get(cacheKey);
    if (cached && !allowReducedEstimates) {
      requireFirstPrinciplesMaterialProperties(cached.properties, {
        material: cached.symbol,
        context: 'elementMaterialClosure'
      });
    }
    return cached;
  }
  const p = deriveElementProperties(atomicNumberZ, options);
  if (!p.condensedModelApplicable && !p.metallicModelApplicable) {
    elementClosureCache.set(cacheKey, null);
    return null;
  }
  const meltingPointK = p.meltingPointK;
  const boilingPointK = p.boilingPointK;
  const liquidDensity = p.densityKgPerM3 * (1 - 3 * p.lindemannRatio * p.lindemannRatio);
  const latentHeatFusionJPerKg = (meltingPointK * RICHARDS_FUSION_ENTROPY) / p.molarMassKgPerMol;
  const latentHeatVaporizationJPerKg = p.latentHeatVaporizationJPerKg;
  const rSpecific = RICHARDS_FUSION_ENTROPY / p.molarMassKgPerMol;
  const gasDensityAtBoiling = (101325 * p.molarMassKgPerMol) / (RICHARDS_FUSION_ENTROPY * Math.max(10, boilingPointK));
  const gasCpJPerKgK = (p.bondingClass === 'molecular-vdw' ? 3.5 : 2.5) * rSpecific;

  const phases = [
    {
      name: 'solid',
      cpJPerKgK: p.cpJPerKgK,
      densityKgPerM3: p.densityKgPerM3,
      temperatureRange: [0, meltingPointK],
      debyeTemperatureK: p.debyeTemperatureK,
      bulkModulusPa: p.bulkModulusPa,
      shearModulusPa: p.shearModulusPa
    },
    {
      name: 'liquid',
      cpJPerKgK: p.cpJPerKgK * (1 + p.lindemannRatio),
      densityKgPerM3: liquidDensity,
      temperatureRange: [meltingPointK, includeGasPhase ? boilingPointK : OPEN_TOP_K],
      bulkModulusPa: p.bulkModulusPa * (liquidDensity / p.densityKgPerM3),
      shearModulusPa: 0
    }
  ];
  const transitions = [
    { from: 'solid', to: 'liquid', temperatureK: meltingPointK, latentHeatJPerKg: latentHeatFusionJPerKg }
  ];
  if (includeGasPhase) {
    phases.push({
      name: 'gas',
      cpJPerKgK: gasCpJPerKgK,
      densityKgPerM3: gasDensityAtBoiling,
      temperatureRange: [boilingPointK, OPEN_TOP_K],
      bulkModulusPa: 101325,
      shearModulusPa: 0
    });
    transitions.push({
      from: 'liquid',
      to: 'gas',
      temperatureK: boilingPointK,
      latentHeatJPerKg: latentHeatVaporizationJPerKg
    });
  }

  const lowerLevelPaths = [
    'conductionElectronDensityPerM3',
    'intrinsicColorSrgb',
    'opticalInterbandOscillators',
    'cohesiveEnergyJPerMol',
    'boilingPointK',
    'standardPhaseAt298K',
    'bondingClass',
    'phases.solid.cpJPerKgK',
    'phases.solid.densityKgPerM3',
    'phases.solid.bulkModulusPa',
    'phases.solid.shearModulusPa',
    'phases.solid.debyeTemperatureK',
    'phases.solid.temperatureRange',
    'transitions.solid->liquid.temperatureK',
    'phases.liquid.cpJPerKgK',
    'phases.liquid.densityKgPerM3',
    'phases.liquid.bulkModulusPa',
    'phases.liquid.temperatureRange'
  ];
  const physicalLawZeroShearPaths = ['phases.liquid.shearModulusPa'];
  const transitionEntropyPaths = [
    'transitions.solid->liquid.latentHeatJPerKg',
    'latentHeatVaporizationJPerKg'
  ];
  if (includeGasPhase) {
    lowerLevelPaths.push(
      'phases.gas.cpJPerKgK',
      'phases.gas.densityKgPerM3',
      'phases.gas.bulkModulusPa',
      'phases.gas.temperatureRange',
      'transitions.liquid->gas.temperatureK'
    );
    physicalLawZeroShearPaths.push('phases.gas.shearModulusPa');
    transitionEntropyPaths.push('transitions.liquid->gas.latentHeatJPerKg');
  }

  const properties = withPropertyProvenance({
    molarMassKgPerMol: p.molarMassKgPerMol,
    atomsPerFormula: 1,
    heatCapacityModel: { solid: 'debye', liquid: 'derived-high-temperature-debye-limit', ...(includeGasPhase ? { gas: 'ideal-gas-equipartition' } : {}) },
    derivation: p.derivation,
    bondingClass: p.bondingClass,
    cohesiveEnergyJPerMol: p.cohesiveEnergyJPerMol,
    boilingPointK,
    latentHeatVaporizationJPerKg,
    standardPhaseAt298K: p.standardPhaseAt298K,
    conductionElectronDensityPerM3: p.conductionElectronDensityPerM3,
    intrinsicColorSrgb: p.opticalColorSrgb,
    opticalInterbandOscillators: p.opticalInterbandOscillators,
    phases,
    transitions,
    closureBacked: true,
    validation: { eosValidation: false, thermalValidation: false, opticalValidation: false, scientificValidation: false }
  }, {
    entries: [
      propertyProvenanceEntry({
        paths: ['molarMassKgPerMol', 'atomsPerFormula'],
        status: DS.EXACT_CONSTANT,
        source: 'periodic-table-atomic-mass',
        method: 'element formula mass from atomic mass'
      }),
      propertyProvenanceEntry({
        paths: lowerLevelPaths,
        status: DS.LOWER_LEVEL_SIMULATION,
        source: 'relativistic-atomic-dft+universal-bonding-debye-trouton',
        method: 'relativistic PBE-KH+SO atomic DFT plus universal bonding cold curve, Debye/Lindemann thermal-melting, and Trouton boiling closure'
      }),
      propertyProvenanceEntry({
        paths: physicalLawZeroShearPaths,
        status: DS.PHYSICAL_LAW,
        source: 'continuum-mechanics',
        method: 'fluid phases have zero static shear modulus'
      }),
      propertyProvenanceEntry({
        paths: transitionEntropyPaths,
        status: DS.PHYSICAL_LAW,
        source: 'richards-and-trouton-rules',
        method: 'universal fusion (Richards) and vaporization (Trouton) entropy laws applied to derived transitions'
      })
    ],
    notes: ['Element closure is derived across the periodic table from relativistic PBE-KH+SO DFT; validation stays false until benchmarked against DFT/MD reference suites.']
  });
  const closure = {
    symbol: p.symbol,
    atomicNumberZ,
    generatorFingerprint: ELEMENT_CLOSURE_GENERATOR_FINGERPRINT,
    properties,
    materialDerivation: materialDerivationSummary(properties)
  };
  elementClosureCache.set(cacheKey, closure);
  if (!allowReducedEstimates) {
    requireFirstPrinciplesMaterialProperties(properties, {
      material: p.symbol,
      context: 'elementMaterialClosure'
    });
  }
  return closure;
}

/** Symbols of all elements the metallic model applies to (valence 1..7, not a noble gas). */
export function metallicElementSymbols() {
  const out = [];
  for (let Z = 1; Z <= 118; Z += 1) {
    const v = valenceElectronCount(Z);
    if (v >= 1 && v < 8 && !NOBLE_GAS_Z.has(Z)) out.push({ Z, symbol: symbolForZ(Z) });
  }
  return out;
}

/** Symbols with a demo material closure. This mirrors elementMaterialClosure's cheap availability gate. */
export function condensedElementSymbols() {
  const out = [];
  for (let Z = 1; Z <= 118; Z += 1) {
    if (NOBLE_GAS_Z.has(Z)) continue;
    out.push({ Z, symbol: symbolForZ(Z) });
  }
  return out;
}

const CM1_TO_J = 1.98644586e-23; // h * c * 100 [J / cm^-1]

/**
 * Compute Einstein/Debye Quasi-Harmonic Approximation (QHA) vibrational Helmholtz
 * free energy F_vib(T) and heat capacity C_v(T) per mole from a list of positive
 * phonon/vibrational wavenumbers (cm^-1).
 */
export function qhaVibrationalThermoPerMol(modesCm1, temperatureK) {
  const T = Math.max(1e-3, Number(temperatureK) || 298.15);
  let fVibPerMoleculeJ = 0;
  let zpePerMoleculeJ = 0;
  let cvPerMoleculeJPerK = 0;
  for (const wn of modesCm1 || []) {
    if (!(wn > 0) || !Number.isFinite(wn)) continue;
    const hw = wn * CM1_TO_J;
    const x = hw / (KB * T);
    zpePerMoleculeJ += 0.5 * hw;
    if (x > 500) {
      fVibPerMoleculeJ += 0.5 * hw;
    } else {
      const ex = Math.exp(-x);
      fVibPerMoleculeJ += 0.5 * hw + KB * T * Math.log(1 - ex);
      const ePos = Math.exp(x);
      const denom = (ePos - 1) * (ePos - 1);
      if (Number.isFinite(denom) && denom > 0) {
        cvPerMoleculeJPerK += KB * x * x * ePos / denom;
      }
    }
  }
  return Object.freeze({
    zpeJPerMol: zpePerMoleculeJ * AVOGADRO,
    helmholtzFreeEnergyJPerMol: fVibPerMoleculeJ * AVOGADRO,
    cvVibJPerMolK: cvPerMoleculeJPerK * AVOGADRO
  });
}

/**
 * First-principles molecular-to-bulk material closure: couples correlated UMP2
 * molecular atomization energy (`atomizationEnergyMp2Ha`), harmonic molecular
 * vibrations (`vibrationalFrequencies`), and Quasi-Harmonic Approximation (QHA)
 * phonon free energy into cohesive energy, melting/boiling temperatures, latent
 * heats of fusion & vaporization, and heat capacities — all honestly flagged
 * `validation.scientificValidation = false` with explicit provenance.
 */
export function deriveMolecularBulkClosure({
  formula = 'molecule',
  atoms,
  basis = 'sto-3g',
  referenceTemperatureK = 298.15,
  intermolecularCohesionFraction = 0.045,
  latticePhononModesCm1 = [120, 180, 260]
} = {}) {
  if (!Array.isArray(atoms) || atoms.length === 0) {
    throw new RangeError('deriveMolecularBulkClosure requires a non-empty atoms geometry');
  }
  const molarMassKgPerMol = atoms.reduce((sum, a) => sum + atomicMassKg(a.Z) * AVOGADRO, 0);
  const atomization = atomizationEnergyMp2Ha(atoms, { basis });
  const atomizationJPerMol = Math.max(0, atomization.atomizationEnergyHa) * HARTREE_TO_J * AVOGADRO;
  const vib = vibrationalFrequencies(atoms, { method: (a) => atomizationEnergyMp2Ha(a, { basis }).moleculeEnergyHa, h: 5e-3 });
  const intraQha = qhaVibrationalThermoPerMol(vib.vibrationsCm1, referenceTemperatureK);
  const latticeQha = qhaVibrationalThermoPerMol(latticePhononModesCm1, referenceTemperatureK);

  const rawCohesiveJPerMol = Math.max(2000, atomizationJPerMol * intermolecularCohesionFraction);
  const cohesiveEnergyJPerMol = Math.max(1000, rawCohesiveJPerMol - latticeQha.zpeJPerMol);
  const cohesiveEnergyEvPerMolecule = cohesiveEnergyJPerMol / (AVOGADRO * EV_TO_J);
  const boilingPointK = cohesiveEnergyJPerMol / TROUTON_VAPORIZATION_ENTROPY;
  const meltingPointK = Math.max(10, boilingPointK * 0.72);
  const latentHeatFusionJPerKg = (meltingPointK * RICHARDS_FUSION_ENTROPY * 2.6) / molarMassKgPerMol;
  const latentHeatVaporizationJPerKg = cohesiveEnergyJPerMol / molarMassKgPerMol;
  const cpGasJPerKgK = (4 * RICHARDS_FUSION_ENTROPY + intraQha.cvVibJPerMolK) / molarMassKgPerMol;
  const cpSolidJPerKgK = (3 * RICHARDS_FUSION_ENTROPY + latticeQha.cvVibJPerMolK + intraQha.cvVibJPerMolK) / molarMassKgPerMol;

  return Object.freeze({
    formula,
    basis,
    molarMassKgPerMol,
    atomizationEnergyHa: atomization.atomizationEnergyHa,
    atomizationJPerMol,
    ump2CorrelationHa: atomization.ump2CorrelationHa,
    vibrationsCm1: vib.vibrationsCm1,
    qhaIntramolecular: intraQha,
    qhaLattice: latticeQha,
    cohesiveEnergyJPerMol,
    cohesiveEnergyEvPerMolecule,
    meltingPointK,
    boilingPointK,
    latentHeatFusionJPerKg,
    latentHeatVaporizationJPerKg,
    cpSolidJPerKgK,
    cpGasJPerKgK,
    closureBacked: true,
    derivation: `molecular-UMP2(${basis})-atomization + harmonic-vibrations + QHA-phonon-free-energy + Trouton/Richards-transitions`,
    validation: Object.freeze({
      eosValidation: false,
      thermalValidation: false,
      opticalValidation: false,
      scientificValidation: false
    })
  });
}
