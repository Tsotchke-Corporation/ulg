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

/**
 * Derive physical Cook-Torrance GGX + Complex (n, k) Fresnel PBR optics directly
 * from a live Gate 1/2 derived material bundle (`bundle.electromagnetic` / `bundle.bulk`).
 */
export function derivePbrOpticsFromMaterialBundle(bundle, {
  phase = 'solid',
  surfaceFinish = null,
  fallbackZ = null
} = {}) {
  const em = bundle?.electromagnetic || null;
  const atomicZ = Math.trunc(Number(bundle?.atomic?.Z ?? bundle?.Z ?? fallbackZ ?? 0));
  const elemRec = atomicZ >= 1 ? ELEMENTS_BY_Z.get(atomicZ) : null;
  const symbol = bundle?.symbol || elemRec?.symbol || null;

  // 1. Extract RGB complex refractive index (n_rgb, k_rgb) from live Gate 1/2 spectral closure,
  //    or conductor optical constants bank, or scalar 550 nm refractive/extinction values.
  let nRgb = null;
  let kRgb = null;
  let source = 'elements-bank-optical-pbr';

  if (em && Array.isArray(em.spectralWavelengthsNm) && Array.isArray(em.spectralNRe) && Array.isArray(em.spectralKIm)) {
    const nArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(em.spectralWavelengthsNm, em.spectralNRe, nm));
    const kArr = RGB_WAVELENGTHS_NM.map((nm) => interpolateSpectrumAtNm(em.spectralWavelengthsNm, em.spectralKIm, nm));
    if (nArr.every(Number.isFinite) && kArr.every(Number.isFinite)) {
      nRgb = nArr.map((v) => clamp(v, 0.05, 8.0));
      kRgb = kArr.map((v) => clamp(v, 0.0, 12.0));
      source = 'gate1-electromagnetic-spectral-nk';
    }
  }

  if (!nRgb && symbol) {
    const nkSamples = RGB_ENERGIES_EV.map((ev) => interpolateConductorOpticalConstants(symbol, ev));
    if (nkSamples.every((s) => s && Number.isFinite(s.n) && Number.isFinite(s.k))) {
      nRgb = nkSamples.map((s) => clamp(s.n, 0.05, 8.0));
      kRgb = nkSamples.map((s) => clamp(s.k, 0.0, 12.0));
      source = 'conductor-optical-constants-nk';
    }
  }

  const n550 = Number(em?.refractiveIndex550Nm ?? elemRec?.opticalPbr?.ior ?? 1.48);
  const k550 = Number(em?.extinctionCoeff550Nm ?? 0.0);
  if (!nRgb) {
    nRgb = [clamp(n550, 1.0, 6.0), clamp(n550, 1.0, 6.0), clamp(n550, 1.0, 6.0)];
    kRgb = [clamp(k550, 0.0, 10.0), clamp(k550, 0.0, 10.0), clamp(k550, 0.0, 10.0)];
    if (em) source = 'gate1-electromagnetic-550nm';
  }

  // 2. Continuous physical metallicity from optical extinction k(550 nm), band gap E_g, and DC conductivity!
  const kMid = kRgb[1];
  const bandGapEv = Number(em?.bandGapEv ?? bundle?.bulk?.bandGapEv);
  const sigmaDc = Number(em?.dcConductivitySPerM ?? em?.electricalConductivitySPerM);
  let metallic;
  if (kMid > 0.08 || Number.isFinite(bandGapEv) || Number.isFinite(sigmaDc)) {
    const kMetal = clamp01((kMid - 0.12) / 1.15);
    const gapMetal = Number.isFinite(bandGapEv) ? clamp01(1.0 - bandGapEv / 0.85) : 0;
    const sigMetal = Number.isFinite(sigmaDc) && sigmaDc > 1e2
      ? clamp01((Math.log10(sigmaDc) - 3.0) / 3.0)
      : 0;
    metallic = clamp01(Math.max(kMetal, Math.min(gapMetal, Math.max(kMetal, sigMetal * 0.95))));
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
  const complexF0 = [0, 1, 2].map((i) => {
    const r = normalIncidenceReflectanceFromComplexIndex({ n: nRgb[i], k: kRgb[i] });
    return Number.isFinite(r) ? clamp(r, 0.02, 0.99) : dielectricF0FromIor(n550);
  });

  // For true metals where only scalar 550nm n/k is available, tint conductor F0 with linear opticalSrgb
  // scaled by reflectance550Nm so Au/Cu/Cs/Ag keep their exact relativistic dispersion tint!
  let f0Rgb;
  if (metallic > 0.35 && source !== 'gate1-electromagnetic-spectral-nk' && source !== 'conductor-optical-constants-nk') {
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
    f0Rgb = [0, 1, 2].map((i) => clamp(f0Diel * (1 - metallic) + complexF0[i] * metallic, 0.02, 0.99));
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
 * Continuous planetary/asteroid surface PBR optics derived strictly from ULG's elemental
 * optical bank (Fe Z=26, Si Z=14, C Z=6, H2O/O Z=8, S Z=16) weighted by coalesced composition!
 */
export function resolvePlanetarySurfacePbrOptics({
  surfZ = 14,
  feFrac = 0.22,
  silicateFrac = 0.52,
  carbonFrac = 0.08,
  volatileFrac = 0.04,
  isMetallicAsteroid = false,
  isOceanic = false,
  isIcy = false
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

  const ior = isOceanic ? 1.333 : (isIcy ? 1.31 : clamp(surfOpt.ior, 1.35, 2.45));
  const f0Diel = dielectricF0FromIor(ior);
  const f0Rgb = [0, 1, 2].map((i) => clamp(
    f0Diel * (1 - metallic) + ((wFe * feOpt.f0Rgb[i] + wC * cOpt.f0Rgb[i] + wSil * siOpt.f0Rgb[i]) / Math.max(1e-4, wFe + wC + wSil)) * metallic,
    0.02,
    0.96
  ));

  return Object.freeze({
    schema: ULG_MATERIAL_PBR_OPTICS_SCHEMA,
    source: 'ulg-planetary-material-blend',
    f0Rgb: Object.freeze(f0Rgb),
    metallic: Number(metallic.toFixed(4)),
    roughness: Number(clamp(roughness, 0.06, 0.94).toFixed(4)),
    ior: Number(ior.toFixed(4))
  });
}
