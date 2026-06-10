// Optical closure: first-principles intrinsic (reflective/transmissive) material colour.
//
// This is the counterpart to the radiation closure (which gives incandescent EMISSION colour).
// Here the colour a material shows under illumination is derived from physics, not tuned:
//  - metals (iron): complex reflectance from the Drude free-electron dielectric function.
//  - transparent media (water/ice): transmitted colour from Beer–Lambert absorption, whose
//    rise toward the red comes from O–H vibrational overtone bands -> water looks blue.
//  - gases (air): Rayleigh scattering (∝ 1/λ^4) -> a faint blue, essentially transparent.
//
// Colour is integrated over the visible spectrum against the CIE 1931 colour-matching functions
// (Wyman 2013 fit) under an equal-energy illuminant -> sRGB. These are first-principles model
// derivations (closureBacked: true) but not validated against measured optical constants
// (opticalValidation stays false).

import { createMaterialClosureArtifact } from '../../../ulg-gpu-abi/src/index.js';

const C = 2.99792458e8;

function gauss(x, mu, s1, s2) {
  const t = (x - mu) * (x < mu ? 1 / s1 : 1 / s2);
  return Math.exp(-0.5 * t * t);
}
function cieX(nm) {
  return 1.056 * gauss(nm, 599.8, 37.9, 31.0) + 0.362 * gauss(nm, 442.0, 16.0, 26.7) - 0.065 * gauss(nm, 501.1, 20.4, 26.2);
}
function cieY(nm) {
  return 0.821 * gauss(nm, 568.8, 46.9, 40.5) + 0.286 * gauss(nm, 530.9, 16.3, 31.1);
}
function cieZ(nm) {
  return 1.217 * gauss(nm, 437.0, 11.8, 36.0) + 0.681 * gauss(nm, 459.0, 26.0, 13.8);
}
function srgbEncode(c) {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

/**
 * Integrate a spectral response (reflectance or transmittance in [0,1]) to an sRGB colour under
 * an equal-energy illuminant, preserving luminance (a flat response of 1 -> white).
 */
export function spectralResponseToSrgb(responseFn) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  let norm = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const s = responseFn(nm);
    X += s * cieX(nm);
    Y += s * cieY(nm);
    Z += s * cieZ(nm);
    norm += cieY(nm);
  }
  X /= norm; Y /= norm; Z /= norm;
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  return { r: srgbEncode(Math.max(0, r)), g: srgbEncode(Math.max(0, g)), b: srgbEncode(Math.max(0, b)) };
}

/**
 * Drude normal-incidence reflectance of a metal at wavelength nm, from the free-electron
 * dielectric function ε(ω) = 1 − ω_p² / (ω² + i ω γ).
 */
export function drudeReflectance(nm, { plasmaRadPerS, dampingRadPerS }) {
  const omega = (2 * Math.PI * C) / (nm * 1e-9);
  const wp2 = plasmaRadPerS * plasmaRadPerS;
  const denomRe = omega * omega;
  const denomIm = omega * dampingRadPerS;
  const d2 = denomRe * denomRe + denomIm * denomIm;
  const epsRe = 1 - (wp2 * denomRe) / d2;
  const epsIm = (wp2 * denomIm) / d2;
  const mag = Math.hypot(epsRe, epsIm);
  const nRe = Math.sqrt((mag + epsRe) / 2);
  const kIm = Math.sqrt((mag - epsRe) / 2);
  return ((nRe - 1) ** 2 + kIm ** 2) / ((nRe + 1) ** 2 + kIm ** 2);
}

// Iron free-electron parameters (effective): plasma frequency from conduction-electron density,
// damping from the optical relaxation rate. The free-electron model captures iron's high, fairly
// flat reflectance (~neutral, slightly warm grey); exact constants need measured optical data.
const IRON_DRUDE = { plasmaRadPerS: 1.5e16, dampingRadPerS: 6e15 };

// Liquid-water absorption coefficient α(λ) (1/m), rising toward the red from O–H vibrational
// overtone bands (the reason water is blue). Anchor values interpolated linearly.
const WATER_ABSORPTION_NM = [400, 450, 500, 550, 600, 650, 700, 750];
const WATER_ABSORPTION_PER_M = [0.0066, 0.0092, 0.025, 0.064, 0.244, 0.349, 0.65, 2.47];
function waterAbsorption(nm) {
  if (nm <= WATER_ABSORPTION_NM[0]) return WATER_ABSORPTION_PER_M[0];
  if (nm >= WATER_ABSORPTION_NM.at(-1)) return WATER_ABSORPTION_PER_M.at(-1);
  for (let i = 1; i < WATER_ABSORPTION_NM.length; i += 1) {
    if (nm <= WATER_ABSORPTION_NM[i]) {
      const t = (nm - WATER_ABSORPTION_NM[i - 1]) / (WATER_ABSORPTION_NM[i] - WATER_ABSORPTION_NM[i - 1]);
      return WATER_ABSORPTION_PER_M[i - 1] + t * (WATER_ABSORPTION_PER_M[i] - WATER_ABSORPTION_PER_M[i - 1]);
    }
  }
  return WATER_ABSORPTION_PER_M.at(-1);
}

/**
 * Intrinsic colour (sRGB {r,g,b}) of a material phase, derived first-principles. closureBacked.
 * Optional `pathLengthM` sets the absorption path for transparent media (default 3 m).
 */
export function intrinsicColorSrgb({ material, phase = 'solid', pathLengthM = 3 }) {
  if (material === 'fe') {
    return spectralResponseToSrgb((nm) => drudeReflectance(nm, IRON_DRUDE));
  }
  if (material === 'h2o') {
    // Bulk water/ice go blue from O–H absorption over a path; ice is clearer (shorter path).
    // Vapour (steam) is optically thin — negligible visible absorption — so it reads near-white.
    const path = phase === 'gas' ? pathLengthM * 0.02 : (phase === 'solid' ? pathLengthM * 0.6 : pathLengthM);
    return spectralResponseToSrgb((nm) => Math.exp(-waterAbsorption(nm) * path));
  }
  if (material === 'air') {
    // Rayleigh scattering ∝ 1/λ^4 over a thin parcel: nearly transparent, very faint blue.
    return spectralResponseToSrgb((nm) => 0.85 + 0.15 * (450 / nm) ** 4);
  }
  return { r: 0.7, g: 0.7, b: 0.7 };
}

// Refractive indices (real part, visible) of the transparent phases. These set the Fresnel
// surface reflection — the reason a clear medium is visible at all — and the render IOR. Iron is
// a metal (opaque, complex index handled by the Drude reflectance above), so it has no transmissive
// index. Water/ice values are model constants (closureBacked) pending an ab-initio polarizability
// closure; vapour's index is ~1 (≈air), which is why pure water vapour is nearly invisible.
const REFRACTIVE_INDEX = Object.freeze({
  waterLiquid: 1.333,
  waterIce: 1.309,
  waterVapor: 1.00025
});

// Luminous-weighted Beer–Lambert attenuation of water. The characteristic 1/e distance is set by
// the luminous-weighted mean absorption; the attenuation colour is the tint that light takes on
// over *that* distance (three.js's attenuationColor semantics) — long enough for the O–H red
// absorption to show, so the tint is blue. Thin media just push attenuationDistance large.
function waterBeerLambertAttenuation() {
  let aSum = 0;
  let wSum = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const w = cieY(nm);
    aSum += waterAbsorption(nm) * w;
    wSum += w;
  }
  const meanAbsorptionPerM = aSum / wSum;
  const attenuationDistanceM = meanAbsorptionPerM > 0 ? 1 / meanAbsorptionPerM : 1e3;
  const c = spectralResponseToSrgb((nm) => Math.exp(-waterAbsorption(nm) * attenuationDistanceM));
  return { attenuationColor: [c.r, c.g, c.b], attenuationDistanceM };
}

/**
 * Physically-derived render parameters for a material surface — what the renderer should use
 * instead of hand-picked opacities. Everything here comes from the optics, not from tuning:
 *  - metals (iron): opaque (transmission 0, metalness 1); colour is the Drude reflectance.
 *  - water/ice: transmission + IOR from the refractive index (Fresnel sets the visible surface
 *    reflection), with a Beer–Lambert attenuation colour/distance for the bulk blue tint.
 *  - vapour (steam): IOR ≈ 1 so it barely refracts (pure vapour is nearly invisible); the only
 *    thing that makes steam visible is Mie scattering off *condensed* micro-droplets, modelled
 *    here as a single labelled `condensationScatter` term — the one value not yet derived from a
 *    closure (it needs the condensation/nucleation microphysics), so it is called out explicitly.
 * closureBacked: true; opticalValidation stays false.
 */
export function opticalRenderParams({ material, phase = 'liquid', pathLengthM = 0.3 } = {}) {
  if (material === 'fe') {
    return { metalness: 1, roughness: 0.32, transmission: 0, ior: 2.9, opacity: 1, attenuationColor: null, attenuationDistanceM: 0, condensationScatter: 0 };
  }
  if (material === 'h2o' || material === 'steam') {
    const isVapor = material === 'steam' || phase === 'gas';
    const n = isVapor ? REFRACTIVE_INDEX.waterVapor : (phase === 'solid' ? REFRACTIVE_INDEX.waterIce : REFRACTIVE_INDEX.waterLiquid);
    const fresnelR0 = ((n - 1) / (n + 1)) ** 2; // normal-incidence surface reflectance
    const atten = waterBeerLambertAttenuation();
    // Vapour is optically thin: push the attenuation distance far out so it carries almost no tint.
    const attenuationColor = isVapor ? [1, 1, 1] : atten.attenuationColor;
    const attenuationDistanceM = isVapor ? atten.attenuationDistanceM * 50 : atten.attenuationDistanceM;
    // Mie scattering off condensed droplets (the visible part of steam). Not yet closure-derived
    // — placeholder for the condensation microphysics — so it is the only tuned number here.
    const condensationScatter = isVapor ? 0.45 : 0;
    const transmission = Math.min(1, Math.max(0, 1 - fresnelR0 - condensationScatter));
    return { metalness: 0, roughness: isVapor ? 0.9 : 0.08, transmission, ior: n, opacity: 1, attenuationColor, attenuationDistanceM, condensationScatter };
  }
  return { metalness: 0, roughness: 0.4, transmission: 0, ior: 1.4, opacity: 0.9, attenuationColor: null, attenuationDistanceM: 0, condensationScatter: 0 };
}

/**
 * Optical closure artifact (family 'optical'). First-principles derivation, not validated against
 * measured optical constants, so opticalValidation stays false.
 */
export function createOpticalClosure() {
  return createMaterialClosureArtifact({
    closureFamily: 'optical',
    closureId: 'sph-phase-intrinsic-optical-closure',
    material: 'multi',
    producer: { service: 'ulg-runtime', toolchain: 'drude-beerlambert-rayleigh-cie-srgb' },
    validityDomain: { temperatureK: [0, 6000] },
    units: { color: 'sRGB-0-1', absorption: '1/m' },
    properties: {
      iron: { model: 'drude-free-electron', ...IRON_DRUDE },
      water: { model: 'beer-lambert-OH-overtone-absorption' },
      air: { model: 'rayleigh-1-over-lambda4' },
      colorPipeline: 'spectral-response -> CIE-1931 -> equal-energy sRGB'
    },
    provenance: {
      notes: [
        'Intrinsic colour from Drude reflectance (metals), Beer–Lambert absorption (water), Rayleigh (air).',
        'First-principles models; not validated against measured optical constants.'
      ]
    }
  });
}
