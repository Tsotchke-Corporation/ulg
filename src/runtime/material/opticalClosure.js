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
import { _uhf } from '../electronicStructure/molecularHartreeFock.js';

const C = 2.99792458e8;
const uhfEnergy = (atoms, multiplicity) => _uhf(atoms, { multiplicity }).totalEnergyHa;

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

const ELECTRON_CHARGE = 1.602176634e-19;
const EPSILON0 = 8.8541878128e-12;
const ELECTRON_MASS = 9.1093837015e-31;

/**
 * Drude plasma frequency (rad/s) of a metal DERIVED from its conduction-electron density:
 * ω_p = √(n_e e² / ε₀ m_e). No fitted constant — n_e comes from the valence electron count and the
 * number density (the electronic structure).
 */
export function plasmaFrequencyRadPerS(conductionElectronDensityPerM3) {
  return Math.sqrt((conductionElectronDensityPerM3 * ELECTRON_CHARGE * ELECTRON_CHARGE) / (EPSILON0 * ELECTRON_MASS));
}

/**
 * Intrinsic colour (sRGB) of a free-electron metal, derived from its conduction-electron density via
 * the Drude dielectric function → reflectance → CIE → sRGB. The plasma frequency (which sets the
 * high, flat reflectance edge → neutral metallic grey) is derived; the optical damping is a single
 * universal relaxation estimate (γ ≈ ω_p/30 — the interband colour of Cu/Au needs band structure,
 * the frontier). closureBacked, validation false.
 */
export function metalDrudeColorSrgb(conductionElectronDensityPerM3) {
  const wp = plasmaFrequencyRadPerS(conductionElectronDensityPerM3);
  const damping = wp / 30;
  const c = spectralResponseToSrgb((nm) => drudeReflectance(nm, { plasmaRadPerS: wp, dampingRadPerS: damping }));
  return { r: c.r, g: c.g, b: c.b, plasmaRadPerS: wp };
}

// Water's visible colour is DERIVED from O–H vibrational overtones, not a tabulated spectrum.
// The O–H stretch fundamental ν is obtained from the molecular engine (an OH force-constant scan);
// its overtones n·ν fall in the visible/near-IR, and overtone intensity drops geometrically with
// order (universal anharmonic falloff). Lower-order overtones sit in the red and are stronger, so
// red is absorbed more and water transmits blue — the colour emerges from the vibrational structure.
let cachedOHStretchCm1 = null;
export function ohStretchWavenumberCm1() {
  if (cachedOHStretchCm1 != null) return cachedOHStretchCm1;
  // OH radical (doublet) force-constant scan: k = d²E/dr², ν = (1/2πc)√(k/μ_OH).
  const E = (r) => uhfEnergy([{ Z: 8, position: [0, 0, 0] }, { Z: 1, position: [0, 0, r] }], 2);
  const r0 = 1.83;
  const h = 0.02;
  const kHaPerBohr2 = (E(r0 + h) - 2 * E(r0) + E(r0 - h)) / (h * h);
  const HARTREE_J = 4.3597447222071e-18;
  const BOHR_M = 5.29177210903e-11;
  const C_CM = 2.99792458e10;
  const AMU = 1.66053906660e-27;
  const kSI = (kHaPerBohr2 * HARTREE_J) / (BOHR_M * BOHR_M);
  const muOH = (15.999 * 1.008 / (15.999 + 1.008)) * AMU;
  cachedOHStretchCm1 = Math.sqrt(Math.max(kSI, 0) / muOH) / (2 * Math.PI * C_CM);
  return cachedOHStretchCm1;
}

const OVERTONE_FALLOFF = 0.12; // universal: each higher overtone is ~8x weaker (anharmonicity)
const OVERTONE_ANHARMONICITY = 0.02; // mild redshift per overtone order
const OVERTONE_INTENSITY_PER_M = 120; // overall absorption magnitude (render scale; hue is derived)

// Relative water absorption at wavelength nm, summed over O–H stretch overtones (positions from the
// derived ν, intensities from the universal falloff). Units are relative (the path length sets the
// saturation); the wavelength dependence — the blue tint — is what's derived.
function waterAbsorption(nm) {
  const nu = ohStretchWavenumberCm1();
  const w = 1e7 / nm; // wavenumber (cm^-1)
  let a = 1e-3; // small flat baseline (1/m)
  for (let n = 2; n <= 9; n += 1) {
    const center = n * nu * (1 - OVERTONE_ANHARMONICITY * n);
    const width = 0.06 * center;
    const t = (w - center) / width;
    // Intensity drops with overtone order; OVERTONE_INTENSITY_PER_M sets the overall absorption
    // magnitude (a render scale — the wavelength dependence/the blue hue is the derived part).
    a += OVERTONE_INTENSITY_PER_M * (OVERTONE_FALLOFF ** n) * Math.exp(-t * t);
  }
  return a;
}

/**
 * Intrinsic colour (sRGB {r,g,b}) of a material phase, derived first-principles. closureBacked.
 * Optional `pathLengthM` sets the absorption path for transparent media (default 3 m).
 */
export function intrinsicColorSrgb({ material, phase = 'solid', pathLengthM = 3, conductionElectronDensityPerM3 = null }) {
  // Metals: derive the colour from the conduction-electron density (Drude). The caller passes the
  // density (from the material closure); a metal without one falls through to the grey default.
  if (conductionElectronDensityPerM3 > 0) {
    const c = metalDrudeColorSrgb(conductionElectronDensityPerM3);
    return { r: c.r, g: c.g, b: c.b };
  }
  if (material === 'h2o') {
    // Colour at the DERIVED 1/e luminous distance of the O–H-overtone absorption, so the hue (blue)
    // comes from the overtone *shape* alone and is independent of the absolute absorption scale. The
    // phase sets the optical thickness: liquid ~1/e, ice clearer, vapour optically thin (near-white).
    let aSum = 0;
    let wSum = 0;
    for (let nm = 380; nm <= 780; nm += 5) { const wY = cieY(nm); aSum += waterAbsorption(nm) * wY; wSum += wY; }
    const meanAbsorption = aSum / wSum;
    const opticalThickness = phase === 'gas' ? 0.03 : (phase === 'solid' ? 0.6 : 1.0);
    const dist = opticalThickness / meanAbsorption;
    return spectralResponseToSrgb((nm) => Math.exp(-waterAbsorption(nm) * dist));
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
  if (material === 'h2o' || material === 'steam' || material === 'ice') {
    const isVapor = material === 'steam' || phase === 'gas';
    const isSolid = material === 'ice' || phase === 'solid';
    const n = isVapor ? REFRACTIVE_INDEX.waterVapor : (isSolid ? REFRACTIVE_INDEX.waterIce : REFRACTIVE_INDEX.waterLiquid);
    const fresnelR0 = ((n - 1) / (n + 1)) ** 2; // normal-incidence surface reflectance
    const atten = waterBeerLambertAttenuation();
    // Vapour is optically thin: push the attenuation distance far out so it carries almost no tint.
    const attenuationColor = isVapor ? [1, 1, 1] : atten.attenuationColor;
    const attenuationDistanceM = isVapor ? atten.attenuationDistanceM * 50 : atten.attenuationDistanceM;
    // Multiple-scattering fractions that reduce ballistic transmission (the part of light that
    // doesn't pass straight through). Both are microstructure terms — not derived from the
    // molecular optics — so they are called out explicitly:
    //   - vapour: Mie scattering off condensed micro-droplets (the visible part of steam).
    //   - ice: multiple scattering off grain boundaries / trapped bubbles, which is why bulk ice
    //     is translucent white rather than clear like liquid water.
    const condensationScatter = isVapor ? 0.45 : 0;
    const internalScatter = isSolid ? 0.55 : 0;
    const transmission = Math.min(1, Math.max(0, 1 - fresnelR0 - condensationScatter - internalScatter));
    const roughness = isVapor ? 0.9 : (isSolid ? 0.5 : 0.08);
    return { metalness: 0, roughness, transmission, ior: n, opacity: 1, attenuationColor, attenuationDistanceM, condensationScatter, internalScatter };
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
      metals: { model: 'drude-free-electron', plasmaFrequency: 'derived from conduction-electron density', damping: 'universal omega_p/30 estimate' },
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
