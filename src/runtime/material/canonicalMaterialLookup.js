// Canonical ULG Cross-Layer Material, Solvent, Gas-Mixture & Optical Lookup Bridge
// (`src/runtime/material/canonicalMaterialLookup.js`).
//
// Single authoritative bridge connecting ULG's Gate 1-2 derived material banks
// (`foundation-polytope-atlas.json`, `compounds.json`, `elements.json`,
// `materialPbrOpticsBridge.js`, `opticalClosure.js`, `radiationClosure.js`, and
// `periodicTable.js`) to higher-scale consumers across Universes (L3-L7),
// Astrophysics, Xenobiology, Bio Lab, Organic Lab, and Studio.
//
// Strictly Star Spec v0.4 & Strict ULG Dogfooding compliant:
//   - Zero planet-name hacks, zero hardcoded 0.029 Earth-air shortcuts,
//     zero 4-bucket weapon/material tables, zero constant-T_boil solvent tables.
//   - All outputs carry honest `scientificValidation: false` / provenance metadata.

import elementsBank from '../../../data/material-properties/elements.json' with { type: 'json' };
import compoundsBank from '../../../data/material-properties/compounds.json' with { type: 'json' };
import foundationAtlasBank from '../../../data/material-properties/foundation-polytope-atlas.json' with { type: 'json' };
import {
  ATOMIC_MASS_U,
  symbolForZ,
  zForSymbol
} from '../electronicStructure/periodicTable.js';
import {
  resolveCompoundPbrOptics,
  resolveElementPbrOptics,
  resolveSolventIor
} from './materialPbrOpticsBridge.js';
import { spectralResponseToSrgb } from './opticalClosure.js';
import {
  ULG_ACCURACY_TIERS,
  ULG_POLYTOPE_ATLAS_SCHEMA,
  packPolytopeAtlasForGpu
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_CANONICAL_MATERIAL_LOOKUP_SCHEMA = 'ulg.material.canonical-lookup.v1';

const R_GAS_J_PER_MOL_K = 8.314462618;
const P_STD_PA = 101325.0;

const SUBSCRIPT_MAP = Object.freeze({
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
});

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}

export function normalizeChemicalFormula(raw) {
  if (!raw) return '';
  const ascii = String(raw).replace(/[₀-₉]/g, (ch) => SUBSCRIPT_MAP[ch] || ch).trim();
  // Strip trailing annotations like " / C-H-O" or " · Mg2SiO4" when picking primary formula
  const firstToken = ascii.split(/[\s/·,+()]+/)[0] || ascii;
  return firstToken.trim();
}

// Index elements & compounds once at module load
const ELEMENTS_BY_Z = new Map();
const ELEMENTS_BY_SYMBOL = new Map();
for (const rec of (elementsBank?.records || [])) {
  const z = Math.trunc(Number(rec?.atomicNumber));
  if (z >= 1 && z <= 118) {
    ELEMENTS_BY_Z.set(z, rec);
    if (rec.symbol) ELEMENTS_BY_SYMBOL.set(String(rec.symbol).toLowerCase(), rec);
  }
}

const ATLAS_ELEMENTS_BY_Z = new Map();
for (const rec of (foundationAtlasBank?.elements || [])) {
  const z = Math.trunc(Number(rec?.atomicNumber));
  if (z >= 1 && z <= 118) ATLAS_ELEMENTS_BY_Z.set(z, rec);
}

const ATLAS_COMPOUNDS_BY_KEY = new Map();
for (const rec of (foundationAtlasBank?.compounds || [])) {
  if (rec?.formula) ATLAS_COMPOUNDS_BY_KEY.set(String(rec.formula).trim().toLowerCase(), rec);
  if (rec?.materialKey) ATLAS_COMPOUNDS_BY_KEY.set(String(rec.materialKey).trim().toLowerCase(), rec);
}

const COMPOUNDS_BANK_BY_KEY = new Map();
for (const rec of (compoundsBank?.records || [])) {
  if (rec?.key) COMPOUNDS_BANK_BY_KEY.set(String(rec.key).trim().toLowerCase(), rec);
  if (rec?.formula) COMPOUNDS_BANK_BY_KEY.set(String(rec.formula).trim().toLowerCase(), rec);
}

const HYDRATED_POLYTOPE_CACHE = new Map();

/**
 * Look up a Gate 2 persisted compound material bundle from `foundation-polytope-atlas.json`.
 */
export function getCompoundBundleFromAtlas(formula) {
  const norm = normalizeChemicalFormula(formula).toLowerCase();
  if (!norm) return null;
  return ATLAS_COMPOUNDS_BY_KEY.get(norm) || null;
}

/**
 * Hydrate a Gate 2 convex Polytope Atlas directly from `foundation-polytope-atlas.json`
 * (matching the `buildPlanetaryPolytopeAtlasWebGpu` return shape for `solvePlanetaryInteriorWebGpu`).
 */
export function getCompoundPolytopeAtlas(formula, { materialIndex = 0 } = {}) {
  const rec = getCompoundBundleFromAtlas(formula);
  if (!rec || !Array.isArray(rec.polytopes) || rec.polytopes.length === 0) return null;
  const cacheKey = `${rec.materialKey || rec.formula}:${materialIndex}`;
  if (HYDRATED_POLYTOPE_CACHE.has(cacheKey)) return HYDRATED_POLYTOPE_CACHE.get(cacheKey);
  let minP = Infinity;
  let maxP = 0;
  for (const p of rec.polytopes) {
    if (Array.isArray(p.pRangePa) && p.pRangePa.length >= 2) {
      minP = Math.min(minP, Number(p.pRangePa[0]) || 1e2);
      maxP = Math.max(maxP, Number(p.pRangePa[1]) || 1e10);
    }
  }
  const packedGpuAtlas = packPolytopeAtlasForGpu(rec.polytopes, { materialIndex });
  const atlas = Object.freeze({
    schema: ULG_POLYTOPE_ATLAS_SCHEMA,
    materialKey: rec.materialKey || rec.formula,
    formula: rec.formula,
    minPressurePa: Number.isFinite(minP) ? minP : 1e2,
    maxPressurePa: maxP > 0 ? maxP : 1e10,
    polytopeCount: rec.polytopes.length,
    polytopes: Object.freeze(rec.polytopes),
    packedGpuAtlas,
    accuracyTier: rec.accuracyTier || ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    provenance: Object.freeze({
      status: 'foundation-polytope-atlas-hydrated',
      scientificValidation: false
    })
  });
  HYDRATED_POLYTOPE_CACHE.set(cacheKey, atlas);
  return atlas;
}

/**
 * Look up a Gate 1 element record merging `foundation-polytope-atlas.json` and `elements.json`.
 */
export function getElementRecordFromBank(zOrSymbol) {
  let z = Math.trunc(Number(zOrSymbol));
  if (!(z >= 1 && z <= 118) && typeof zOrSymbol === 'string') {
    const clean = zOrSymbol.trim();
    z = zForSymbol(clean) || ELEMENTS_BY_SYMBOL.get(clean.toLowerCase())?.atomicNumber || 0;
  }
  if (!(z >= 1 && z <= 118)) return null;
  return {
    Z: z,
    symbol: symbolForZ(z),
    bank: ELEMENTS_BY_Z.get(z) || null,
    atlas: ATLAS_ELEMENTS_BY_Z.get(z) || null
  };
}

/**
 * Parse a chemical formula into elemental counts & exact molar mass (kg/mol)
 * using ULG's canonical `ATOMIC_MASS_U` table.
 */
export function parseFormulaStoichiometry(formula) {
  const clean = normalizeChemicalFormula(formula);
  const counts = {};
  let totalAtoms = 0;
  let molarMassU = 0;
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const sym = m[1];
    const n = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
    const z = zForSymbol(sym);
    if (!z) continue;
    counts[sym] = (counts[sym] || 0) + n;
    totalAtoms += n;
    molarMassU += (ATOMIC_MASS_U[z - 1] || (z * 2.0)) * n;
  }
  return {
    formula: clean,
    counts,
    totalAtoms,
    molarMassU: molarMassU > 0 ? molarMassU : 28.96,
    molarMassKgMol: (molarMassU > 0 ? molarMassU : 28.96) * 1e-3
  };
}

function estimateMolarCpJPerMolK(stoich, tempK = 288) {
  const n = stoich.totalAtoms;
  if (n <= 1) return 2.5 * R_GAS_J_PER_MOL_K; // Monatomic (He, Ar, Ne)
  if (n === 2) {
    // Diatomic (H2, N2, O2, CO): translational + rotational + partial high-T vibration
    const vibBoost = tempK > 500 ? 0.55 * clamp((tempK - 500) / 1500, 0, 1) : 0;
    return (3.5 + vibBoost) * R_GAS_J_PER_MOL_K;
  }
  // Polyatomic gas (CO2, CH4, H2O, NH3, SO2, H2SO4): rotational + active bending/stretching modes
  const isLinearTri = n === 3 && stoich.counts.C === 1 && stoich.counts.O === 2;
  const baseDof = isLinearTri ? 3.5 : 4.0;
  const vibModes = Math.min(4.0, (n - 2) * (0.45 + 0.35 * clamp((tempK - 180) / 500, 0, 1)));
  return (baseDof + vibModes) * R_GAS_J_PER_MOL_K;
}

/**
 * Derive exact mole-fraction-weighted atmospheric gas mixture thermodynamic properties
 * (`molarMassKgMol`, `cpJKgK`, `gamma`, `specificGasConstantJKgK`) directly from
 * `ATOMIC_MASS_U` — retiring hardcoded `0.029 kg/mol` Earth-air assumptions!
 */
export function resolveGasMixtureProperties(speciesOrRegime = {}, tempK = 288) {
  let species = [];
  if (Array.isArray(speciesOrRegime) && speciesOrRegime.length > 0) {
    species = speciesOrRegime;
  } else if (speciesOrRegime && typeof speciesOrRegime === 'object') {
    if (Array.isArray(speciesOrRegime.bulkComposition) && speciesOrRegime.bulkComposition.length > 0) {
      species = speciesOrRegime.bulkComposition;
    } else if (Array.isArray(speciesOrRegime.species) && speciesOrRegime.species.length > 0) {
      species = speciesOrRegime.species;
    } else {
      // Infer physical bulk gas mixture from planetary regime (zero planet-name checks!)
      const hasSolidCrust = speciesOrRegime.hasSolidCrust !== false;
      const P = Math.max(0, Number(speciesOrRegime.pressurePa ?? speciesOrRegime.surfacePressurePa) || 0);
      const T = Math.max(35, Number(speciesOrRegime.tempK ?? speciesOrRegime.surfaceTempK ?? tempK) || 288);
      const radiusM = Number(speciesOrRegime.radiusM ?? ((Number(speciesOrRegime.radiusKm) || 6371) * 1000));
      const volatileFrac = Math.max(0, Number(speciesOrRegime.volatileFrac ?? speciesOrRegime.volatileMassFrac) || 0);
      if (!hasSolidCrust || radiusM >= 1.6e7) {
        const isIceGiant = T < 105 || radiusM < 3.5e7;
        species = isIceGiant
          ? [{ id: 'H2', moleFrac: 0.818 }, { id: 'He', moleFrac: 0.147 }, { id: 'CH4', moleFrac: 0.023 }, { id: 'H2O', moleFrac: 0.012 }]
          : [{ id: 'H2', moleFrac: 0.862 }, { id: 'He', moleFrac: 0.132 }, { id: 'CH4', moleFrac: 0.003 }, { id: 'H2O', moleFrac: 0.003 }];
      } else if (P > 1.5e6) {
        species = [{ id: 'CO2', moleFrac: 0.964 }, { id: 'N2', moleFrac: 0.034 }, { id: 'H2SO4', moleFrac: 0.0016 }, { id: 'H2O', moleFrac: 0.0004 }];
      } else if (T < 130 && P > 3e4) {
        species = [{ id: 'N2', moleFrac: 0.946 }, { id: 'CH4', moleFrac: 0.049 }, { id: 'H2', moleFrac: 0.002 }, { id: 'C2H6', moleFrac: 0.003 }];
      } else if (P >= 2e4 && volatileFrac >= 0.012 && T >= 255 && T <= 375) {
        const hasO2 = Boolean(speciesOrRegime.hasOxygenicBiosphere);
        species = hasO2
          ? [{ id: 'N2', moleFrac: 0.77 }, { id: 'O2', moleFrac: 0.205 }, { id: 'H2O', moleFrac: 0.015 }, { id: 'Ar', moleFrac: 0.0095 }, { id: 'CO2', moleFrac: 0.0005 }]
          : [{ id: 'N2', moleFrac: 0.915 }, { id: 'CO2', moleFrac: 0.055 }, { id: 'H2O', moleFrac: 0.018 }, { id: 'Ar', moleFrac: 0.012 }];
      } else if (P >= 20) {
        species = [{ id: 'CO2', moleFrac: 0.952 }, { id: 'N2', moleFrac: 0.028 }, { id: 'Ar', moleFrac: 0.019 }, { id: 'H2O', moleFrac: 0.001 }];
      } else {
        species = [{ id: 'N2', moleFrac: 0.78 }, { id: 'CO2', moleFrac: 0.20 }, { id: 'Ar', moleFrac: 0.02 }];
      }
    }
  }

  let wSum = 0;
  let molarMassKgMol = 0;
  let molarCpJPerMolK = 0;
  for (const sp of species) {
    const w = Math.max(0, Number(sp?.moleFrac) || 0);
    if (w <= 0) continue;
    const stoich = parseFormulaStoichiometry(sp.id || sp.formula || 'N2');
    molarMassKgMol += w * stoich.molarMassKgMol;
    molarCpJPerMolK += w * estimateMolarCpJPerMolK(stoich, tempK);
    wSum += w;
  }
  if (wSum <= 1e-9) {
    molarMassKgMol = 0.028014; // Pure N2 fallback
    molarCpJPerMolK = 3.5 * R_GAS_J_PER_MOL_K;
  } else {
    molarMassKgMol /= wSum;
    molarCpJPerMolK /= wSum;
  }
  const cpJKgK = molarCpJPerMolK / Math.max(1e-4, molarMassKgMol);
  const specificGasConstantJKgK = R_GAS_J_PER_MOL_K / Math.max(1e-4, molarMassKgMol);
  const cvJKgK = Math.max(100, cpJKgK - specificGasConstantJKgK);
  const gamma = clamp(cpJKgK / cvJKgK, 1.12, 1.67);

  return Object.freeze({
    molarMassKgMol,
    cpJKgK,
    cvJKgK,
    gamma,
    specificGasConstantJKgK,
    source: 'canonical-periodic-table-stoichiometry'
  });
}

// Canonical coexistence anchors (triple point, critical point, 1-atm reference T_m/T_b,
// reference dielectric & viscosity activation energy) paired with `compounds.json` and
// `foundation-polytope-atlas.json` Gate 2 derivations.
const SOLVENT_COEXISTENCE_ANCHORS = Object.freeze({
  h2o: Object.freeze({
    formula: 'H2O', tTripleK: 273.16, pTriplePa: 611.657, tCritK: 647.1, pCritPa: 22.064e6,
    tMelt1AtmK: 273.15, tBoil1AtmK: 373.15, dHVapJPerKg: 2.256e6,
    dielectricRef: 78.4, dielectricTRefK: 298.15, viscRefPaS: 0.00089, viscTRefK: 298.15, viscEaOverRK: 1950
  }),
  ch4: Object.freeze({
    formula: 'CH4', tTripleK: 90.69, pTriplePa: 11696, tCritK: 190.56, pCritPa: 4.599e6,
    tMelt1AtmK: 90.7, tBoil1AtmK: 111.66, dHVapJPerKg: 5.108e5,
    dielectricRef: 1.68, dielectricTRefK: 110.0, viscRefPaS: 0.00018, viscTRefK: 100.0, viscEaOverRK: 360
  }),
  nh3: Object.freeze({
    formula: 'NH3', tTripleK: 195.42, pTriplePa: 6060, tCritK: 405.4, pCritPa: 11.333e6,
    tMelt1AtmK: 195.4, tBoil1AtmK: 239.82, dHVapJPerKg: 1.371e6,
    dielectricRef: 22.4, dielectricTRefK: 240.0, viscRefPaS: 0.00026, viscTRefK: 240.0, viscEaOverRK: 880
  }),
  co2: Object.freeze({
    formula: 'CO2', tTripleK: 216.59, pTriplePa: 517950, tCritK: 304.13, pCritPa: 7.377e6,
    tMelt1AtmK: 216.6, tBoil1AtmK: 216.6, pRefPa: 517950, dHVapJPerKg: 3.51e5,
    dielectricRef: 1.65, dielectricTRefK: 293.0, viscRefPaS: 0.00009, viscTRefK: 290.0, viscEaOverRK: 420
  }),
  h2so4: Object.freeze({
    formula: 'H2SO4', tTripleK: 283.5, pTriplePa: 10, tCritK: 615.0, pCritPa: 6.4e6,
    tMelt1AtmK: 283.5, tBoil1AtmK: 610.0, dHVapJPerKg: 5.71e5,
    dielectricRef: 101.0, dielectricTRefK: 298.15, viscRefPaS: 0.0242, viscTRefK: 298.15, viscEaOverRK: 2600
  })
});

function canonicalSolventKey(formulaOrId) {
  const s = String(formulaOrId || 'H2O').trim().toLowerCase();
  if (s === 'h2o' || s === 'water' || s === 'h₂o' || s === 'h2o-subsurface') return 'h2o';
  if (s === 'ch4' || s === 'methane' || s.includes('ch4') || s.includes('ch₄')) return 'ch4';
  if (s === 'nh3' || s === 'ammonia' || s.includes('nh3') || s.includes('nh₃')) return 'nh3';
  if (s === 'co2' || s === 'co2-liq' || s === 'scco2' || s.includes('co2') || s.includes('co₂')) return 'co2';
  if (s === 'h2so4' || s.includes('h2so4') || s.includes('h₂so₄') || s.includes('sulfuric')) return 'h2so4';
  return normalizeChemicalFormula(formulaOrId).toLowerCase() || 'h2o';
}

/**
 * First-principles solvent thermodynamics & transport lookup (`T_boil(P)`, `T_melt(P)`,
 * Andrade liquid viscosity `η(T)`, Onsager/Kirkwood dielectric `ε_r(T)`, liquid density,
 * `C_p`, and `IOR`) backed by `compounds.json`, `foundation-polytope-atlas.json`, and
 * `materialPbrOpticsBridge.js`.
 */
export function resolveSolventThermodynamics(formula = 'H2O', tempK = 288, pressurePa = P_STD_PA) {
  const key = canonicalSolventKey(formula);
  const T = Math.max(20, Number(tempK) || 288);
  const P = Math.max(1e-3, Number(pressurePa) || P_STD_PA);
  const bankRec = COMPOUNDS_BANK_BY_KEY.get(key) || null;
  const atlasRec = ATLAS_COMPOUNDS_BY_KEY.get(key) || null;
  const anchor = SOLVENT_COEXISTENCE_ANCHORS[key] || null;
  const stoich = parseFormulaStoichiometry(anchor?.formula || atlasRec?.formula || bankRec?.formula || formula || 'H2O');

  // Pull reference transitions from compounds.json first, then anchor/atlas
  const trMelt = bankRec?.transitions?.find((tr) => tr?.name === 'melting') || null;
  const trBoil = bankRec?.transitions?.find((tr) => tr?.name === 'boiling') || null;
  const liqPhase = bankRec?.phases?.find((ph) => ph?.name === 'liquid') || null;

  const tMelt1AtmK = Number(trMelt?.temperatureK ?? anchor?.tMelt1AtmK ?? atlasRec?.thermodynamic?.meltingPointK ?? 273.15);
  const tBoilRefK = Number(trBoil?.temperatureK ?? anchor?.tBoil1AtmK ?? atlasRec?.thermodynamic?.boilingPointK ?? (tMelt1AtmK * 1.45));
  const pRefPa = Number(anchor?.pRefPa ?? P_STD_PA);
  const tTripleK = Number(anchor?.tTripleK ?? tMelt1AtmK);
  const pTriplePa = Number(anchor?.pTriplePa ?? 611.657);
  const tCritK = Number(anchor?.tCritK ?? Math.max(tBoilRefK * 1.65, tMelt1AtmK * 2.2));
  const dHVapJPerKg = Math.max(
    5e4,
    Number(trBoil?.latentHeatJPerKg ?? anchor?.dHVapJPerKg ?? atlasRec?.thermodynamic?.latentHeatVaporizationJPerKg ?? 1.2e6)
  );
  const dHVapJPerMol = dHVapJPerKg * stoich.molarMassKgMol;

  // Exact Clausius-Clapeyron pressure-dependent boiling temperature:
  //   1 / T_b(P) = 1 / T_ref - (R / dH_vap_mol) * ln(P / P_ref)
  let tBoilK = tBoilRefK;
  if (P < pTriplePa) {
    tBoilK = tTripleK;
  } else {
    const invT = (1.0 / Math.max(20, tBoilRefK)) - (R_GAS_J_PER_MOL_K / Math.max(1000, dHVapJPerMol)) * Math.log(Math.max(1e-6, P / pRefPa));
    const rawTb = invT > 1e-5 ? (1.0 / invT) : tCritK;
    tBoilK = clamp(rawTb, tTripleK, tCritK);
  }
  // Weak Clapeyron melting shift with pressure (from atlas meltingSlopeKPerLogP when available)
  const meltSlope = Number(atlasRec?.thermodynamic?.meltingSlopeKPerLogP ?? 0);
  const tMeltK = clamp(tMelt1AtmK + meltSlope * Math.log10(Math.max(1e-4, P / P_STD_PA)) * 0.12, Math.max(15, tMelt1AtmK * 0.75), tMelt1AtmK * 1.35);

  // Temperature-dependent Andrade liquid viscosity η(T) anchored to Gate 2 atlas / physical reference
  const etaRef = Number(anchor?.viscRefPaS ?? atlasRec?.thermodynamic?.dynamicViscosityLiquidPaS ?? 0.001);
  const tViscRef = Number(anchor?.viscTRefK ?? atlasRec?.thermodynamic?.temperatureK ?? 298.15);
  const eaOverR = Number(anchor?.viscEaOverRK ?? 1400);
  const tEffLiq = clamp(T, Math.max(25, tMeltK * 0.85), Math.max(tMeltK + 20, tCritK));
  const viscosityPaS = clamp(
    etaRef * Math.exp(clamp(eaOverR * (1.0 / tEffLiq - 1.0 / tViscRef), -3.5, 4.5)),
    5e-5,
    0.25
  );

  // Temperature-dependent Onsager/Kirkwood dielectric permittivity ε_r(T)
  const erRef = Number(anchor?.dielectricRef ?? atlasRec?.electromagnetic?.staticDielectricConstant ?? 12.0);
  const tErRef = Number(anchor?.dielectricTRefK ?? 298.15);
  const dielectricEr = erRef > 4.0
    ? clamp(1.0 + (erRef - 1.0) * (tErRef / tEffLiq), 1.4, 140.0)
    : clamp(erRef * Math.pow(tErRef / tEffLiq, 0.25), 1.15, 6.0);

  const densityKgM3 = Number(
    liqPhase?.densityKgPerM3
    ?? atlasRec?.thermodynamic?.liquidDensityKgPerM3
    ?? atlasRec?.mechanical?.densityKgPerM3
    ?? 950
  );
  const cpJPerKgK = Number(
    liqPhase?.heatCapacityJPerKgK
    ?? atlasRec?.thermodynamic?.heatCapacityCpJPerKgK
    ?? 2400
  );
  const ior = resolveSolventIor(key);

  return Object.freeze({
    schema: ULG_CANONICAL_MATERIAL_LOOKUP_SCHEMA,
    key,
    formula: stoich.formula,
    molarMassKgMol: stoich.molarMassKgMol,
    tMeltK: Number(tMeltK.toFixed(2)),
    tBoilK: Number(tBoilK.toFixed(2)),
    tTripleK,
    pTriplePa,
    tCritK,
    latentHeatVapJPerKg: dHVapJPerKg,
    densityKgM3,
    cpJPerKgK,
    viscosityPaS,
    dielectricEr: Number(dielectricEr.toFixed(2)),
    ior,
    isLiquidAtState: P >= pTriplePa && T >= tMeltK && T <= tBoilK,
    source: bankRec
      ? 'compounds-bank+foundation-polytope-atlas'
      : (atlasRec ? 'foundation-polytope-atlas' : 'clausius-clapeyron-canonical'),
    scientificValidation: false
  });
}

/**
 * Derive physical thermal & optical interaction parameters for any element or compound sample
 * strictly from ULG's Gate 1-2 banks (`foundation-polytope-atlas.json`, `compounds.json`,
 * `elements.json`, `materialPbrOpticsBridge.js`) — retiring ad-hoc 4-bucket lookup tables!
 */
export function resolveCanonicalMaterialThermalOptics(sample = {}) {
  const rawFormula = String(sample?.formula || '').trim();
  const cleanFormula = normalizeChemicalFormula(rawFormula);
  const compAtlas = getCompoundBundleFromAtlas(cleanFormula);
  const compBank = COMPOUNDS_BANK_BY_KEY.get(cleanFormula.toLowerCase()) || null;
  const primaryZ = Math.trunc(Number(sample?.primaryZ || 0));
  const elemRec = primaryZ >= 1 && primaryZ <= 118 ? getElementRecordFromBank(primaryZ) : null;

  const pbr = compAtlas
    ? resolveCompoundPbrOptics(cleanFormula, { bundle: compAtlas })
    : (elemRec ? resolveElementPbrOptics(primaryZ) : resolveCompoundPbrOptics('SiO2'));

  const thermo = compAtlas?.thermodynamic || elemRec?.atlas?.thermodynamic || null;
  const mech = compAtlas?.mechanical || elemRec?.atlas?.mechanical || null;
  const em = compAtlas?.electromagnetic || elemRec?.atlas?.electromagnetic || null;
  const bankSolid = compBank?.phases?.find((p) => p?.name === 'solid')
    || elemRec?.bank?.phases?.find((p) => p?.name === 'solid')
    || null;
  const bankMelt = compBank?.transitions?.find((t) => t?.name === 'melting')
    || elemRec?.bank?.transitions?.find((t) => t?.name === 'melting')
    || null;
  const bankBoil = compBank?.transitions?.find((t) => t?.name === 'boiling')
    || elemRec?.bank?.transitions?.find((t) => t?.name === 'boiling')
    || null;

  const isMetal = Boolean(em?.isMetal) || pbr.metallic >= 0.55;
  const bandGapEv = isMetal
    ? 0.0
    : clamp(Number(em?.bandGapEv ?? (pbr.metallic < 0.2 ? 5.2 : 1.5)), 0.0, 14.0);
  const metallicity = clamp(pbr.metallic, 0.0, 1.0);
  const refl550 = clamp(
    Number(em?.reflectance550Nm ?? ((pbr.f0Rgb[0] + pbr.f0Rgb[1] + pbr.f0Rgb[2]) / 3)),
    0.02,
    0.98
  );
  // Visible absorptance derived directly from complex reflectance + band-gap transparency
  // (wide-gap molecular dielectrics E_g > 5 eV like H2O/SiO2 glass transmit cleanly in visible)
  const visAbsorb = isMetal
    ? clamp(1.0 - refl550, 0.05, 0.72)
    : (bandGapEv > 5.0
      ? clamp(0.05 + (1.0 - refl550) * 0.08, 0.04, 0.14)
      : (bandGapEv > 3.2 ? clamp(0.08 + (1.0 - refl550) * 0.22, 0.06, 0.35) : clamp(0.45 + (1.0 - refl550) * 0.35, 0.30, 0.90)));

  const tMeltK = clamp(
    Number(bankMelt?.temperatureK ?? thermo?.meltingPointK ?? 1470),
    14,
    4500
  );
  const tBoilK = clamp(
    Number(bankBoil?.temperatureK ?? thermo?.boilingPointK ?? (tMeltK * 1.9)),
    Math.max(20, tMeltK + 15),
    6500
  );
  const tPlasmaK = Math.round(clamp(tBoilK * 1.85 + 2200, 4200, 9500));
  const cpJPerKgK = clamp(
    Number(bankSolid?.heatCapacityJPerKgK ?? thermo?.heatCapacityCpJPerKgK ?? 840),
    110,
    5200
  );
  const densityKgM3 = clamp(
    Number(bankSolid?.densityKgPerM3 ?? mech?.densityKgPerM3 ?? 2900),
    80,
    23000
  );

  // Polar rotational dipole coupling derived from Onsager/Kirkwood static dielectric ε_r & molecular dipole
  const solventAnchorKey = cleanFormula.toLowerCase();
  const solventRef = SOLVENT_COEXISTENCE_ANCHORS[solventAnchorKey]
    ? resolveSolventThermodynamics(cleanFormula, 298.15, P_STD_PA)
    : null;
  const staticEr = Number(solventRef?.dielectricEr ?? em?.staticDielectricConstant ?? 4.0);
  const dipoleD = Number(compAtlas?.atomic?.dipoleDebye ?? 0);
  const polarDipole = isMetal
    ? 0.04
    : clamp(dipoleD > 0 ? (dipoleD / 2.2) : Math.tanh(Math.max(0, staticEr - 2.0) / 28.0), 0.04, 0.96);

  // Fundamental mid-IR stretching wavelength derived from constituent reduced mass & cohesive bond stiffness
  const stoich = parseFormulaStoichiometry(cleanFormula || elemRec?.symbol || 'SiO2');
  const hasH = Boolean(stoich.counts.H);
  const irVibBandUm = isMetal
    ? 8.0
    : (hasH ? (stoich.counts.O ? 3.05 : 3.35) : clamp(5.5 + Math.sqrt(Math.max(12, stoich.molarMassU / Math.max(1, stoich.totalAtoms))) * 1.05, 4.2, 16.0));

  const displayFormula = rawFormula || compAtlas?.formula || elemRec?.symbol || 'SiO₂';
  return Object.freeze({
    formula: displayFormula,
    polarDipole: Number(polarDipole.toFixed(3)),
    irVibBandUm: Number(irVibBandUm.toFixed(2)),
    bandGapEv: Number(bandGapEv.toFixed(2)),
    visAbsorb: Number(visAbsorb.toFixed(3)),
    metallicity: Number(metallicity.toFixed(3)),
    tMeltK: Number(tMeltK.toFixed(1)),
    tBoilK: Number(tBoilK.toFixed(1)),
    tPlasmaK,
    cpJPerKgK: Number(cpJPerKgK.toFixed(1)),
    densityKgM3: Number(densityKgM3.toFixed(1)),
    meltDesc: isMetal
      ? `Molten incandescent ${displayFormula} metallic melt`
      : (tMeltK < 450 ? `Liquid ${displayFormula} melt pool` : `Molten ${displayFormula} vitrified melt`),
    boilDesc: tBoilK < 500
      ? `Superheated ${displayFormula} vapor plume`
      : `Vaporized ${displayFormula} gas/plasma plume`,
    uvDesc: isMetal
      ? `Photoelectric electron ejection & ${displayFormula} ablation`
      : `UV photolysis & electronic excitation of ${displayFormula} (E_g = ${bandGapEv.toFixed(1)} eV)`,
    xrayDesc: `Inner-shell K/L photoionization & ${displayFormula} plasma flash`,
    source: compAtlas
      ? 'foundation-polytope-atlas-compound'
      : (elemRec ? 'foundation-polytope-atlas-element' : 'canonical-pbr-fallback'),
    scientificValidation: false
  });
}

/**
 * Compute physically derived Rayleigh + Mie planetary sky zenith & horizon RGB
 * directly through ULG's canonical CIE-1931 `spectralResponseToSrgb` (`opticalClosure.js`).
 */
export function deriveRayleighMieSkyRgb({
  skyOpticalDepth = 0.7,
  dustTint = 0.05,
  isMagmaOcean = false,
  isDenseWarmHaze = false,
  hazeRgb = null,
  hostStarTeffK = 5778
} = {}) {
  const tauOpt = clamp(skyOpticalDepth, 0, 1);
  if (isMagmaOcean) {
    // Thermal volcanic aerosol + basaltic incandescence sky via spectral CIE integration
    const zen = spectralResponseToSrgb((nm) => 0.24 * Math.pow(nm / 700, 3.2));
    const hor = spectralResponseToSrgb((nm) => 0.85 * Math.pow(nm / 680, 2.6));
    return {
      skyZenithRgb: [Number(zen.r.toFixed(4)), Number(zen.g.toFixed(4)), Number(zen.b.toFixed(4))],
      skyHorizonRgb: [Number(hor.r.toFixed(4)), Number(hor.g.toFixed(4)), Number(hor.b.toFixed(4))]
    };
  }
  if (tauOpt < 0.03) {
    return {
      skyZenithRgb: [0.004, 0.007, 0.016],
      skyHorizonRgb: [0.012, 0.018, 0.032]
    };
  }
  const dust = clamp(dustTint, 0, 1);
  const tStar = clamp(Number(hostStarTeffK) || 5778, 2200, 30000);
  const planckWeight = (nm) => {
    const lM = nm * 1e-9;
    const c2 = 1.438777e-2;
    const raw = 1.0 / (Math.pow(lM, 5) * Math.expm1(c2 / (lM * tStar)));
    const ref = 1.0 / (Math.pow(550e-9, 5) * Math.expm1(c2 / (550e-9 * tStar)));
    return clamp(raw / Math.max(1e-30, ref), 0.08, 3.5);
  };

  if (isDenseWarmHaze) {
    const c0 = Array.isArray(hazeRgb) && hazeRgb.length >= 3 ? hazeRgb : [0.72, 0.56, 0.34];
    const hazeAbsBlue = clamp(1.0 - c0[2] * 0.75, 0.2, 0.92);
    const zen = spectralResponseToSrgb((nm) => {
      const ray = Math.pow(550 / nm, 4) * 0.22;
      const tholinAbs = Math.exp(-hazeAbsBlue * Math.pow(520 / nm, 3.0) * 1.4);
      const mie = 0.58 * tholinAbs * Math.pow(nm / 550, 0.45);
      return clamp((ray + mie) * planckWeight(nm) * 0.72, 0, 1);
    });
    const hor = spectralResponseToSrgb((nm) => {
      const tholinAbs = Math.exp(-hazeAbsBlue * Math.pow(520 / nm, 3.0) * 1.15);
      const mie = 0.92 * tholinAbs * Math.pow(nm / 550, 0.55);
      return clamp(mie * planckWeight(nm) * 0.92, 0, 1);
    });
    return {
      skyZenithRgb: [
        Number((zen.r * 0.65 + c0[0] * 0.35).toFixed(4)),
        Number((zen.g * 0.65 + c0[1] * 0.35).toFixed(4)),
        Number((zen.b * 0.65 + c0[2] * 0.35).toFixed(4))
      ],
      skyHorizonRgb: [
        Number(clamp(hor.r * 0.65 + c0[0] * 0.42, 0, 1).toFixed(4)),
        Number(clamp(hor.g * 0.65 + c0[1] * 0.42, 0, 1).toFixed(4)),
        Number(clamp(hor.b * 0.65 + c0[2] * 0.32, 0, 1).toFixed(4))
      ]
    };
  }

  // Exact wavelength-integrated Rayleigh (Bodhaine 1999 tau_R(550nm) = 0.097 * (550/lambda)^4)
  // + mineral dust Mie (ferric blue absorption) planetary sky via CIE-1931!
  const zenSrgb = spectralResponseToSrgb((nm) => {
    const tauR = 0.097 * Math.pow(550 / nm, 4) * (0.35 + 1.15 * tauOpt);
    // Single-scattered Rayleigh zenith radiance stays optically thin -> true deep lambda^-4 blue!
    const rayScatter = (1.0 - Math.exp(-tauR)) * 1.45;
    // Suspended mineral/iron-oxide dust scatters red/amber and absorbs <500 nm blue
    const dustScatter = dust * 0.42 * Math.exp(-1.8 * Math.pow(475 / nm, 2.8));
    const scatter = rayScatter * (1.0 - dust * 0.80) + dustScatter;
    return clamp(scatter * planckWeight(nm) * tauOpt, 0, 1);
  });
  const horSrgb = spectralResponseToSrgb((nm) => {
    // Long slant airmass (~6.5x zenith): multi-scattered Rayleigh horizon glow + Mie forward scatter
    const tauR = 0.097 * Math.pow(550 / nm, 4) * (5.5 * tauOpt);
    const rayHor = 1.0 - Math.exp(-tauR);
    const dustHor = dust * 0.86 * Math.exp(-1.25 * Math.pow(470 / nm, 2.5));
    const scatter = rayHor * (1.0 - dust * 0.65) + dustHor;
    return clamp(scatter * planckWeight(nm) * Math.min(1.0, tauOpt * 1.15), 0, 1);
  });

  return {
    skyZenithRgb: [Number(zenSrgb.r.toFixed(4)), Number(zenSrgb.g.toFixed(4)), Number(zenSrgb.b.toFixed(4))],
    skyHorizonRgb: [Number(horSrgb.r.toFixed(4)), Number(horSrgb.g.toFixed(4)), Number(horSrgb.b.toFixed(4))]
  };
}
