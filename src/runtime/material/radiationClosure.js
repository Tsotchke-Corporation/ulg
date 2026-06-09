// Radiation / incandescence closure (demo plan: eshkol.ulg.radiation-closure.v0).
//
// First-principles particle GLOW color: Planck blackbody spectral radiance at a temperature,
// integrated against the CIE 1931 color-matching functions, converted to sRGB through a
// documented display transform. This is physically derived (not demo-tuned), so the incandescent
// contribution to a particle's render color is closure-backed.
//
// Scope honesty: EMISSION (hot glow) only. INTRINSIC material color (cold ice/water, solid iron
// reflectance) needs an optical closure fed by MoonLab optical-response microphysics, which has
// NOT been produced -- so intrinsic color stays a labeled placeholder. Validation flags stay
// false: this is a physical derivation, not a closure validated against a measured reference.

import { createMaterialClosureArtifact } from '../../../ulg-gpu-abi/src/index.js';

const PLANCK_C2_M_K = 1.438777e-2; // hc/k (m*K); the 2hc^2 prefactor cancels under normalization.

// CIE 1931 color-matching functions, Wyman/Sloan/Shirley (2013) multi-lobe analytic fit.
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

function planckRelative(nm, temperatureK) {
  const lambdaM = nm * 1e-9;
  const expo = PLANCK_C2_M_K / (lambdaM * temperatureK);
  return 1 / (lambdaM ** 5 * Math.expm1(expo)); // relative spectral radiance (prefactor cancels)
}

function srgbEncode(c) {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

// Temperature (K) below which there is no visible incandescence.
export const INCANDESCENCE_THRESHOLD_K = 800;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Visible-incandescence ramp: 0 below ~800 K, full glow by ~1300 K.
export function incandescenceFactor(temperatureK) {
  return smoothstep(INCANDESCENCE_THRESHOLD_K, 1300, temperatureK);
}

/**
 * Blackbody chromaticity at temperatureK as sRGB {r,g,b} in [0,1] (hue preserved, normalized to
 * full brightness). Graybody emissivity does not change chromaticity, only brightness.
 */
export function blackbodyColorSrgb(temperatureK) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const b = planckRelative(nm, temperatureK);
    X += b * cieX(nm);
    Y += b * cieY(nm);
    Z += b * cieZ(nm);
  }
  const sum = X + Y + Z;
  if (!(sum > 0)) return { r: 0, g: 0, b: 0 };
  X /= sum; Y /= sum; Z /= sum;
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
  const peak = Math.max(r, g, b, 1e-9);
  return { r: srgbEncode(r / peak), g: srgbEncode(g / peak), b: srgbEncode(b / peak) };
}

/**
 * Incandescent glow color for a particle at temperatureK. Closure-backed (first-principles
 * Planck -> CIE -> sRGB). `visible` is false below the incandescence threshold, where there is
 * no glow and the caller must fall back to intrinsic (optical-closure) color. Graybody
 * `emissivity` is accepted for API completeness; it scales radiance, not chromaticity.
 */
export function incandescentColor(temperatureK, { emissivity = 1 } = {}) {
  const visible = Number(temperatureK) >= INCANDESCENCE_THRESHOLD_K;
  if (!visible) {
    return { visible: false, srgb: [0, 0, 0], temperatureK, emissivity, closureBacked: true };
  }
  const c = blackbodyColorSrgb(temperatureK);
  return { visible: true, srgb: [c.r, c.g, c.b], temperatureK, emissivity, closureBacked: true };
}

// Intrinsic reflectance colors are PLACEHOLDERS pending the optical closure + MoonLab optical
// microphysics. Flagged not-closure-backed wherever used.
const INTRINSIC_PLACEHOLDER = {
  h2o: { solid: { r: 0.62, g: 0.82, b: 0.95 }, liquid: { r: 0.30, g: 0.55, b: 0.85 }, gas: { r: 0.80, g: 0.85, b: 0.90 } },
  fe: { solid: { r: 0.42, g: 0.42, b: 0.47 }, liquid: { r: 0.42, g: 0.42, b: 0.47 } },
  air: { gas: { r: 0.50, g: 0.55, b: 0.60 } }
};

/**
 * Composite particle display color: closure-backed Planck glow when incandescent, else a flagged
 * intrinsic reflectance placeholder (optical closure pending). Provided alongside
 * `incandescentColor` so the demo can use either contract during integration.
 */
export function particleDisplayColor({ material, temperatureK, phase }) {
  const inc = incandescentColor(temperatureK);
  if (inc.visible) {
    return { r: inc.srgb[0], g: inc.srgb[1], b: inc.srgb[2], closureBackedGlow: true, intrinsicPlaceholder: false };
  }
  const intrinsic = INTRINSIC_PLACEHOLDER[material]?.[phase]
    || INTRINSIC_PLACEHOLDER[material]?.solid
    || { r: 0.42, g: 0.47, b: 0.52 };
  return { r: intrinsic.r, g: intrinsic.g, b: intrinsic.b, closureBackedGlow: false, intrinsicPlaceholder: true };
}

/**
 * The radiation closure artifact wrapping the Planck->CIE->sRGB glow derivation.
 */
export function createRadiationClosure() {
  return createMaterialClosureArtifact({
    closureFamily: 'radiation',
    closureId: 'sph-phase-incandescence-radiation-closure',
    material: 'blackbody',
    producer: { service: 'ulg-runtime', toolchain: 'planck-cie1931-srgb', commit: null },
    validityDomain: { temperatureK: [INCANDESCENCE_THRESHOLD_K, 6000] },
    units: { temperature: 'K', color: 'sRGB-0-1' },
    properties: {
      method: 'planck-spectral-radiance -> CIE-1931 (Wyman 2013 fit) -> linear-sRGB(D65) -> sRGB-gamma',
      spectrumNm: [380, 780],
      stepNm: 5,
      incandescenceThresholdK: INCANDESCENCE_THRESHOLD_K,
      note: 'Emission/glow only; intrinsic reflectance color requires the optical closure (pending).'
    },
    derivatives: false,
    provenance: {
      source: 'first-principles-planck-radiation',
      notes: [
        'Physically derived blackbody glow color; not demo-tuned.',
        'Intrinsic material color still pending optical-response microphysics.'
      ]
    }
  });
}
