// Canonical ULG Material-Physics -> PBR Optical Bridge
// (`src/runtime/material/materialPbrOpticsBridge.js`).
//
// Translates ULG's derived first-principles material physics layer:
//   - Gate 1/2 `bundle.electromagnetic` (complex n(lambda), k(lambda), reflectance R(lambda),
//     opticalSrgb, bandGapEv, dcConductivitySPerM)
//   - `conductor-optical-constants.json` (complex (n, k) at RGB 650/550/450 nm)
//   - `elements.json` (`opticalPbr`: baseColorSrgb, metalness, roughness, ior)
// into energy-conserving Cook-Torrance GGX + Complex Fresnel PBR uniforms consumed
// identically by MLS-MPM Studio, Elements Lab, Universes, Organic Lab, and Bio Lab!

import elementsBank from '../../../data/material-properties/elements.json' with { type: 'json' };
import foundationAtlasBank from '../../../data/material-properties/foundation-polytope-atlas.json' with { type: 'json' };
import {
  interpolateConductorOpticalConstants,
  normalIncidenceReflectanceFromComplexIndex
} from './conductorOpticalConstants.js';

export const ULG_MATERIAL_PBR_OPTICS_SCHEMA = 'ulg.material-pbr-optics.v1';

// Visible RGB center photon energies: R = 650 nm (1.907 eV), G = 550 nm (2.254 eV), B = 450 nm (2.755 eV)
const RGB_WAVELENGTHS_NM = Object.freeze([650, 550, 450]);
const RGB_ENERGIES_EV = Object.freeze([1239.84193 / 650, 1239.84193 / 550, 1239.84193 / 450]);

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
  if (z >= 1 && z <= 118) {
    ATLAS_ELEMENTS_BY_Z.set(z, rec);
  }
}

const ATLAS_COMPOUNDS_BY_KEY = new Map();
for (const rec of (foundationAtlasBank?.compounds || [])) {
  if (rec?.formula) ATLAS_COMPOUNDS_BY_KEY.set(String(rec.formula).trim().toLowerCase(), rec);
  if (rec?.materialKey) ATLAS_COMPOUNDS_BY_KEY.set(String(rec.materialKey).trim().toLowerCase(), rec);
}

// Physical liquid/condensed-solvent refractive indices (589/550 nm) for planetary hydrospheres & xenobiology media
const SOLVENT_IOR_TABLE = Object.freeze({
  h2o: 1.333,
  water: 1.333,
  ch4: 1.29,
  methane: 1.29,
  'ch4-c2h6': 1.305,
  nh3: 1.325,
  ammonia: 1.325,
  'nh3-h2o': 1.33,
  h2so4: 1.43,
  sulfuric: 1.43,
  'h2so4-acid': 1.43,
  co2: 1.19,
  'supercritical-co2': 1.19,
  n2: 1.205,
  nitrogen: 1.205,
  hf: 1.16,
  formamide: 1.447,
  hcn: 1.267,
  silicate: 1.62,
  magma: 1.62
});

export function resolveSolventIor(solvent = 'H2O') {
  const key = String(solvent || 'H2O').trim().toLowerCase();
  if (Number.isFinite(SOLVENT_IOR_TABLE[key])) return SOLVENT_IOR_TABLE[key];
  const comp = ATLAS_COMPOUNDS_BY_KEY.get(key);
  const atlasN = Number(comp?.electromagnetic?.refractiveIndex550Nm);
  if (Number.isFinite(atlasN) && atlasN >= 1.05 && atlasN <= 3.5) return atlasN;
  if (key.includes('methane') || key.includes('ch4')) return 1.29;
  if (key.includes('ammonia') || key.includes('nh3')) return 1.325;
  if (key.includes('sulfuric') || key.includes('h2so4')) return 1.43;
  if (key.includes('co2')) return 1.19;
  return 1.333;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}

export function srgbChannelToLinear(c) {
  const x = clamp01(c);
  return x <= 0.04045 ? (x / 12.92) : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function linearChannelToSrgb(c) {
  const x = clamp01(c);
  return x <= 0.0031308 ? (x * 12.92) : (1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function interpolateSpectrumAtNm(wavelengthsNm, values, targetNm) {
  if (!Array.isArray(wavelengthsNm) || !Array.isArray(values) || wavelengthsNm.length === 0 || wavelengthsNm.length !== values.length) {
    return null;
  }
  if (targetNm <= wavelengthsNm[0]) return Number(values[0]);
  const last = wavelengthsNm.length - 1;
  if (targetNm >= wavelengthsNm[last]) return Number(values[last]);
  for (let i = 1; i <= last; i += 1) {
    const w0 = Number(wavelengthsNm[i - 1]);
    const w1 = Number(wavelengthsNm[i]);
    if (targetNm > w1 && i < last) continue;
    const t = Math.abs(w1 - w0) > 1e-6 ? (targetNm - w0) / (w1 - w0) : 0;
    return Number(values[i - 1]) + (Number(values[i]) - Number(values[i - 1])) * t;
  }
  return Number(values[last]);
}

function dielectricF0FromIor(ior) {
  const n = Math.max(1.0, Number(ior) || 1.45);
  const r = (n - 1) / (n + 1);
  return clamp(r * r, 0.015, 0.35);
}

function defaultRoughnessFor({ phase = 'solid', metallic = 0, surfaceFinish = null } = {}) {
  if (surfaceFinish === 'liquid' || phase === 'liquid') return metallic > 0.5 ? 0.08 : 0.06;
  if (surfaceFinish === 'crystal') return metallic > 0.5 ? 0.16 : 0.22;
  if (surfaceFinish === 'machined') return 0.24;
  if (surfaceFinish === 'ice') return 0.28;
  if (surfaceFinish === 'organic') return 0.42;
  if (surfaceFinish === 'regolith') return 0.84;
  if (surfaceFinish === 'rock') return 0.72;
  return metallic > 0.65 ? 0.20 : (metallic > 0.2 ? 0.32 : 0.40);
}

function inferKFromNormalReflectance(n, refl) {
  const r = clamp(Number(refl), 0.0, 0.994);
  const nv = clamp(Number(n), 0.05, 8.0);
  const num = r * (nv + 1) * (nv + 1) - (nv - 1) * (nv - 1);
  if (num <= 0) return 0;
  return clamp(Math.sqrt(num / Math.max(1e-4, 1 - r)), 0, 12.0);
}

/**
 * Derive physical Cook-Torrance GGX + Complex (n, k) Fresnel PBR optics directly
 * from a live Gate 1/2 derived material bundle (`bundle.electromagnetic` / `bundle.bulk`)
 * or ULG's persisted `foundation-polytope-atlas.json` Gate 1-2 electromagnetic closure.
 */
export function derivePbrOpticsFromMaterialBundle(bundle, {
  phase = 'solid',
  surfaceFinish = null,
  fallbackZ = null,
  formula = null
} = {}) {
  const formulaKey = formula ? String(formula).trim().toLowerCase()
    : (bundle?.formula ? String(bundle.formula).trim().toLowerCase() : null);
  const atomicZ = Math.trunc(Number(bundle?.atomic?.Z ?? bundle?.atomicNumber ?? bundle?.Z ?? fallbackZ ?? 0));
  const elemRec = atomicZ >= 1 ? ELEMENTS_BY_Z.get(atomicZ) : null;
  const atlasRec = (formulaKey && ATLAS_COMPOUNDS_BY_KEY.get(formulaKey))
    || (atomicZ >= 1 ? ATLAS_ELEMENTS_BY_Z.get(atomicZ) : null)
    || null;
  const liveEm = bundle?.electromagnetic || null;
  const em = liveEm || atlasRec?.electromagnetic || null;
  const symbol = bundle?.symbol || elemRec?.symbol || (atlasRec?.family === 'element' ? atlasRec.formula : null) || null;

  // 1. Extract RGB complex refractive index (n_rgb, k_rgb) and spectral normal reflectance F0_rgb:
  //    - Prefer live Gate 1/2 spectral closure arrays (`spectralNRe`, `spectralKIm`, `spectralAbsorptionPerM`, `spectralReflectance`)
  //    - For canonical noble/reference metals without a live bundle override, use `conductor-optical-constants.json`
  //    - For all 118 elements & 20 compounds offline, consume `foundation-polytope-atlas.json` `electromagnetic` closure!
  let nRgb = null;
  let kRgb = null;
  let spectralF0Rgb = null;
  let source = 'elements-bank-optical-pbr';

  const tryExtractSpectralEm = (srcEm, srcTag) => {
    if (!srcEm || !Array.isArray(srcEm.spectralWavelengthsNm) || !Array.isArray(srcEm.spectralNRe)) return false;
    const nArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(srcEm.spectralWavelengthsNm, srcEm.spectralNRe, nm));
    if (!nArr.every(Number.isFinite)) return false;
    const clampedN = nArr.map((v) => clamp(v, 0.05, 8.0));

    if (Array.isArray(srcEm.spectralKIm)) {
      const kArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(srcEm.spectralWavelengthsNm, srcEm.spectralKIm, nm));
      if (kArr.every(Number.isFinite)) {
        nRgb = clampedN;
        kRgb = kArr.map((v) => clamp(v, 0.0, 12.0));
        source = srcTag;
        return true;
      }
    }
    if (Array.isArray(srcEm.spectralReflectance)) {
      const rArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(srcEm.spectralWavelengthsNm, srcEm.spectralReflectance, nm));
      if (rArr.every(Number.isFinite)) {
        nRgb = clampedN;
        if (Array.isArray(srcEm.spectralAbsorptionPerM)) {
          const aArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(srcEm.spectralWavelengthsNm, srcEm.spectralAbsorptionPerM, nm));
          kRgb = aArr.map((alpha, idx) => {
            const kAbs = Number.isFinite(alpha) && alpha > 0
              ? (alpha * (RGB_WAVELENGTHS_NM[idx] * 1e-9)) / (4 * Math.PI)
              : 0;
            const kRefl = srcEm.isMetal ? inferKFromNormalReflectance(clampedN[idx], rArr[idx]) : 0;
            return clamp(Math.max(kAbs, kRefl), 0.0, 12.0);
          });
        } else {
          kRgb = rArr.map((rv, idx) => inferKFromNormalReflectance(clampedN[idx], rv));
        }
        spectralF0Rgb = rArr.map((rv) => clamp(rv, 0.015, 0.99));
        source = srcTag;
        return true;
      }
    }
    if (Array.isArray(srcEm.spectralAbsorptionPerM)) {
      const aArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(srcEm.spectralWavelengthsNm, srcEm.spectralAbsorptionPerM, nm));
      if (aArr.every(Number.isFinite)) {
        nRgb = clampedN;
        kRgb = aArr.map((alpha, idx) => clamp(Math.max(0, alpha) * (RGB_WAVELENGTHS_NM[idx] * 1e-9) / (4 * Math.PI), 0.0, 12.0));
        source = srcTag;
        return true;
      }
    }
    return false;
  };

  if (liveEm) {
    tryExtractSpectralEm(liveEm, 'gate1-electromagnetic-spectral-nk');
  }

  if (!nRgb && symbol && !formulaKey) {
    const nkSamples = RGB_ENERGIES_EV.map((ev) => interpolateConductorOpticalConstants(symbol, ev));
    if (nkSamples.every((s) => s && Number.isFinite(s.n) && Number.isFinite(s.k))) {
      nRgb = nkSamples.map((s) => clamp(s.n, 0.05, 8.0));
      kRgb = nkSamples.map((s) => clamp(s.k, 0.0, 12.0));
      source = 'conductor-optical-constants-nk';
    }
  }

  if (!nRgb && atlasRec?.electromagnetic) {
    tryExtractSpectralEm(atlasRec.electromagnetic, 'foundation-polytope-atlas-spectral-nk');
  }

  const n550 = Number(em?.refractiveIndex550Nm ?? elemRec?.opticalPbr?.ior ?? 1.48);
  let k550 = Number(em?.extinctionCoeff550Nm);
  if (!Number.isFinite(k550)) {
    if (em?.isMetal && Number.isFinite(Number(em?.reflectance550Nm))) {
      k550 = inferKFromNormalReflectance(n550, em.reflectance550Nm);
    } else {
      k550 = 0.0;
    }
  }
  if (!nRgb) {
    nRgb = [clamp(n550, 1.0, 6.0), clamp(n550, 1.0, 6.0), clamp(n550, 1.0, 6.0)];
    kRgb = [clamp(k550, 0.0, 10.0), clamp(k550, 0.0, 10.0), clamp(k550, 0.0, 10.0)];
    if (em) source = liveEm ? 'gate1-electromagnetic-550nm' : 'foundation-polytope-atlas-550nm';
  }

  // 2. Continuous physical metallicity from optical extinction k(550 nm), band gap E_g, DC conductivity, & Gate 1 isMetal!
  const kMid = kRgb[1];
  const bandGapEv = Number(em?.bandGapEv ?? bundle?.bulk?.bandGapEv);
  const sigmaDc = Number(em?.dcConductivitySPerM ?? em?.electricalConductivitySPerM);
  let metallic;
  if (kMid > 0.08 || Number.isFinite(bandGapEv) || Number.isFinite(sigmaDc) || typeof em?.isMetal === 'boolean') {
    const kMetal = clamp01((kMid - 0.12) / 1.15);
    const gapMetal = Number.isFinite(bandGapEv) ? clamp01(1.0 - bandGapEv / 0.85) : 0;
    const sigMetal = Number.isFinite(sigmaDc) && sigmaDc > 1e2
      ? clamp01((Math.log10(sigmaDc) - 3.0) / 3.0)
      : 0;
    metallic = clamp01(Math.max(kMetal, Math.min(gapMetal, Math.max(kMetal, sigMetal * 0.95))));
    if (em?.isMetal === true && (!Number.isFinite(bandGapEv) || bandGapEv < 0.25)) {
      metallic = Math.max(metallic, 0.92);
    }
    if (source === 'conductor-optical-constants-nk') {
      metallic = Math.max(metallic, 0.92);
    }
  } else {
    metallic = clamp01(Number(elemRec?.opticalPbr?.metalness ?? 0.0));
  }

  // 3. Physical base albedo sRGB & exact complex normal-incidence Fresnel F0_rgb!
  const rawSrgb = (Array.isArray(em?.opticalSrgb) && em.opticalSrgb.length === 3)
    ? em.opticalSrgb
    : (Array.isArray(elemRec?.opticalPbr?.baseColorSrgb) && elemRec.opticalPbr.baseColorSrgb.length === 3
      ? elemRec.opticalPbr.baseColorSrgb
      : [0.68, 0.74, 0.82]);
  const albedoSrgb = [clamp01(rawSrgb[0]), clamp01(rawSrgb[1]), clamp01(rawSrgb[2])];
  const albedoLinear = [
    srgbChannelToLinear(albedoSrgb[0]),
    srgbChannelToLinear(albedoSrgb[1]),
    srgbChannelToLinear(albedoSrgb[2])
  ];

  // Exact complex Fresnel R_0(lambda) = ((n - 1)^2 + k^2) / ((n + 1)^2 + k^2)
  const complexF0 = spectralF0Rgb || [0, 1, 2].map((i) => {
    const r = normalIncidenceReflectanceFromComplexIndex({ n: nRgb[i], k: kRgb[i] });
    return Number.isFinite(r) ? clamp(r, 0.015, 0.99) : dielectricF0FromIor(n550);
  });

  // Use exact spectral complex Fresnel directly when spectral n/k/R is present; otherwise tint metal F0 with opticalSrgb * R550!
  let f0Rgb;
  const hasSpectralComplex = Boolean(spectralF0Rgb)
    || source === 'gate1-electromagnetic-spectral-nk'
    || source === 'conductor-optical-constants-nk'
    || source === 'foundation-polytope-atlas-spectral-nk';
  if (metallic > 0.35 && !hasSpectralComplex) {
    const refl = clamp(Number(em?.reflectance550Nm ?? complexF0[1] ?? 0.72), 0.35, 0.98);
    const maxC = Math.max(0.15, albedoLinear[0], albedoLinear[1], albedoLinear[2]);
    const scale = refl / maxC;
    f0Rgb = [
      clamp(albedoLinear[0] * scale, 0.04, 0.99),
      clamp(albedoLinear[1] * scale, 0.04, 0.99),
      clamp(albedoLinear[2] * scale, 0.04, 0.99)
    ];
  } else {
    const f0Diel = dielectricF0FromIor(nRgb[1]);
    f0Rgb = [0, 1, 2].map((i) => clamp(f0Diel * (1 - metallic) + complexF0[i] * metallic, 0.015, 0.99));
  }

  const baseRough = Number(elemRec?.opticalPbr?.roughness);
  const roughness = clamp(
    surfaceFinish
      ? defaultRoughnessFor({ phase, metallic, surfaceFinish })
      : (Number.isFinite(baseRough) ? baseRough : defaultRoughnessFor({ phase, metallic })),
    0.04,
    0.96
  );

  return Object.freeze({
    schema: ULG_MATERIAL_PBR_OPTICS_SCHEMA,
    source,
    albedoSrgb: Object.freeze(albedoSrgb),
    albedoLinear: Object.freeze(albedoLinear),
    nRgb: Object.freeze(nRgb),
    kRgb: Object.freeze(kRgb),
    f0Rgb: Object.freeze(f0Rgb),
    metallic: Number(metallic.toFixed(4)),
    roughness: Number(roughness.toFixed(4)),
    ior: Number(clamp(nRgb[1], 1.0, 4.0).toFixed(4))
  });
}

const ELEMENT_PBR_CACHE = new Map();
const COMPOUND_PBR_CACHE = new Map();

/**
 * Fast cached lookup of derived ULG Material-Physics PBR optical parameters for any Z = 1..118.
 */
export function resolveElementPbrOptics(atomicNumber, {
  phase = 'solid',
  surfaceFinish = null,
  bundle = null
} = {}) {
  if (bundle?.electromagnetic) {
    return derivePbrOpticsFromMaterialBundle(bundle, { phase, surfaceFinish, fallbackZ: atomicNumber });
  }
  const z = Math.max(1, Math.min(118, Math.trunc(Number(atomicNumber) || 14)));
  const key = `${z}|${phase}|${surfaceFinish || ''}`;
  const hit = ELEMENT_PBR_CACHE.get(key);
  if (hit) return hit;
  const out = derivePbrOpticsFromMaterialBundle(null, { phase, surfaceFinish, fallbackZ: z });
  ELEMENT_PBR_CACHE.set(key, out);
  return out;
}

/**
 * Fast cached lookup of derived ULG Gate-2 Material-Physics PBR optics for any compound formula
 * (`H2O`, `SiO2`, `CH4`, `NH3`, `Fe2O3`, `NaCl`, `Al2O3`, etc.).
 */
export function resolveCompoundPbrOptics(formula, {
  phase = 'solid',
  surfaceFinish = null,
  bundle = null,
  fallbackZ = 14
} = {}) {
  if (bundle?.electromagnetic) {
    return derivePbrOpticsFromMaterialBundle(bundle, { phase, surfaceFinish, fallbackZ, formula });
  }
  const normKey = String(formula || 'H2O').trim().toLowerCase();
  const key = `${normKey}|${phase}|${surfaceFinish || ''}`;
  const hit = COMPOUND_PBR_CACHE.get(key);
  if (hit) return hit;
  const out = derivePbrOpticsFromMaterialBundle(null, { phase, surfaceFinish, fallbackZ, formula: normKey });
  COMPOUND_PBR_CACHE.set(key, out);
  return out;
}

let CACHED_ELEMENT_PBR_LUT = null;

/**
 * Packed 120-entry GPU storage buffer LUT (2 vec4s = 8 f32 per element Z = 0..119):
 *   entry[z*2 + 0] = vec4(f0_r, f0_g, f0_b, metallic)
 *   entry[z*2 + 1] = vec4(albedo_lin_r, albedo_lin_g, albedo_lin_b, roughness)
 * Eliminates hardcoded CPK tables & Z-range metallicity hacks across Elements Lab, Organic Lab, and Bio Lab!
 */
export function buildElementPbrLutFloats() {
  if (CACHED_ELEMENT_PBR_LUT) return CACHED_ELEMENT_PBR_LUT;
  const lut = new Float32Array(120 * 8);
  for (let z = 0; z < 120; z += 1) {
    const opt = resolveElementPbrOptics(Math.max(1, Math.min(118, z || 6)), { surfaceFinish: 'crystal' });
    const o = z * 8;
    lut[o + 0] = opt.f0Rgb[0];
    lut[o + 1] = opt.f0Rgb[1];
    lut[o + 2] = opt.f0Rgb[2];
    lut[o + 3] = opt.metallic;
    lut[o + 4] = opt.albedoLinear[0];
    lut[o + 5] = opt.albedoLinear[1];
    lut[o + 6] = opt.albedoLinear[2];
    lut[o + 7] = opt.roughness;
  }
  CACHED_ELEMENT_PBR_LUT = lut;
  return lut;
}

/**
 * Continuous planetary/asteroid surface PBR optics derived strictly from ULG's elemental & compound
 * optical banks (Fe Z=26, Si Z=14, C Z=6, H2O/O Z=8, S Z=16, and ocean solvent IOR) weighted by composition!
 */
export function resolvePlanetarySurfacePbrOptics({
  surfZ = 14,
  feFrac = 0.22,
  silicateFrac = 0.52,
  carbonFrac = 0.08,
  volatileFrac = 0.04,
  isMetallicAsteroid = false,
  isOceanic = false,
  isIcy = false,
  solvent = null
} = {}) {
  const feOpt = resolveElementPbrOptics(26, { surfaceFinish: isMetallicAsteroid ? 'machined' : 'rock' });
  const siOpt = resolveElementPbrOptics(14, { surfaceFinish: 'rock' });
  const cOpt = resolveElementPbrOptics(6, { surfaceFinish: 'rock' });
  const surfOpt = resolveElementPbrOptics(surfZ, { surfaceFinish: isIcy ? 'ice' : 'rock' });

  const wFe = clamp01(feFrac) * (isMetallicAsteroid ? 1.8 : 0.75);
  const wSil = clamp01(silicateFrac);
  const wC = clamp01(carbonFrac);
  const wIce = clamp01(volatileFrac) * (isIcy ? 1.6 : 0.55);
  const wSum = Math.max(1e-4, wFe + wSil + wC + wIce);

  // Metallicity reflects exposed Fe-Ni metal fraction (high on iron cores & metallic asteroids, low on oxidized basalt/ice)
  const rawMetal = (wFe * feOpt.metallic + wC * 0.22 + wSil * 0.04) / wSum;
  const metallic = clamp(isMetallicAsteroid ? Math.max(0.68, rawMetal) : (surfZ === 26 ? Math.max(0.42, rawMetal) : rawMetal * 0.45), 0.0, 0.94);

  // Roughness: glossy ocean/ice vs matte dusty regolith vs metallic Fe-Ni core
  let roughness = (wFe * 0.34 + wSil * 0.78 + wC * 0.62 + wIce * 0.28) / wSum;
  if (isOceanic) roughness = Math.min(roughness, 0.14);
  if (isMetallicAsteroid) roughness = clamp(roughness * 0.58, 0.22, 0.48);

  const oceanIor = resolveSolventIor(solvent || 'H2O');
  const crustIor = isIcy ? 1.31 : clamp(surfOpt.ior, 1.35, 2.45);
  const ior = isOceanic ? oceanIor : crustIor;
  const f0Diel = dielectricF0FromIor(ior);
  const f0Rgb = [0, 1, 2].map((i) => clamp(
    f0Diel * (1 - metallic) + ((wFe * feOpt.f0Rgb[i] + wC * cOpt.f0Rgb[i] + wSil * siOpt.f0Rgb[i]) / Math.max(1e-4, wFe + wC + wSil)) * metallic,
    0.015,
    0.96
  ));

  return Object.freeze({
    schema: ULG_MATERIAL_PBR_OPTICS_SCHEMA,
    source: 'ulg-planetary-material-blend',
    f0Rgb: Object.freeze(f0Rgb),
    metallic: Number(metallic.toFixed(4)),
    roughness: Number(clamp(roughness, 0.06, 0.94).toFixed(4)),
    ior: Number(ior.toFixed(4)),
    oceanIor: Number(oceanIor.toFixed(4)),
    crustIor: Number(crustIor.toFixed(4))
  });
}
