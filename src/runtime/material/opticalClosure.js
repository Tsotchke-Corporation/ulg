// Optical closure: first-principles intrinsic (reflective/transmissive) material colour.
//
// This is the counterpart to the radiation closure (which gives incandescent EMISSION colour).
// Here the colour a material shows under illumination is derived from physics, not tuned:
//  - metals: complex reflectance from a Drude free-electron dielectric function plus
//    scalar-relativistic Kohn-Sham interband oscillators for occupied localized d/f shells.
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
import { solveAtom } from '../electronicStructure/radialKohnSham.js';
import { electronConfiguration, zForSymbol } from '../electronicStructure/periodicTable.js';

const C = 2.99792458e8;
const BOHR_M = 5.29177210903e-11;
const HARTREE_EV = 27.211386245988;
const HBAR_EV_S = 6.582119569e-16;
const INTERBAND_STRENGTH_SCALE = 0.025;
const INTERBAND_MIN_DAMPING_EV = 0.22;
const INTERBAND_DAMPING_FRACTION = 0.35;
const INTERBAND_ELECTRON_GAS_BROADENING_SCALE = 0.06;
const INTERBAND_MAX_RAW_EV = 12;
const INTERBAND_MAX_OSCILLATORS = 6;
const OPTICAL_RENDER_SAMPLE_WAVELENGTHS_NM = Object.freeze([380, 430, 480, 530, 580, 630, 680, 730, 780]);
const opticalRenderParamCache = new Map();
const uhfEnergy = (atoms, multiplicity) => _uhf(atoms, { multiplicity }).totalEnergyHa;
const interbandTransitionCache = new Map();
const WATER_VAPOR_GAS_CONSTANT_J_PER_KG_K = 461.522;
const WATER_TRIPLE_POINT_K = 273.16;
const WATER_TRIPLE_POINT_PRESSURE_PA = 611.657;
const WATER_VAPORIZATION_LATENT_HEAT_J_PER_KG = 2.5e6;
const LIQUID_WATER_DENSITY_KG_PER_M3 = 997;
const STANDARD_AIR_DENSITY_KG_PER_M3 = 1.225;
const STANDARD_AIR_RAYLEIGH_SCATTERING_550NM_PER_M = 1.1e-5;
const AIR_REFRACTIVE_INDEX_VISIBLE = 1.000293;
export const WATER_DROPLET_OPTICAL_MICROPHYSICS_MODEL = 'clausius-clapeyron-droplet-scattering-v0';

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

function visibleLuminousMean(responseFn) {
  let sum = 0;
  let norm = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const w = cieY(nm);
    sum += responseFn(nm) * w;
    norm += w;
  }
  return norm > 0 ? sum / norm : 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function srgbTuple(color) {
  if (Array.isArray(color)) return [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])];
  return [clamp01(color?.r), clamp01(color?.g), clamp01(color?.b)];
}

function stableNumber(value) {
  return Number.isFinite(value) ? Number(value).toPrecision(10) : String(value ?? 'null');
}

function stableValueKey(value) {
  if (value == null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableValueKey).join(',')}]`;
  if (typeof value === 'object') return `{${stableObjectKey(value)}}`;
  if (typeof value === 'number') return stableNumber(value);
  return String(value);
}

function stableObjectKey(value) {
  if (!value || typeof value !== 'object') return 'none';
  return Object.keys(value).sort()
    .map((key) => `${key}:${stableValueKey(value[key])}`)
    .join('|');
}

function phaseDensityKgPerM3(properties, phase = null) {
  if (!properties || typeof properties !== 'object') return null;
  const phaseName = String(phase || '').toLowerCase();
  const phaseRecord = Array.isArray(properties.phases)
    ? properties.phases.find((candidate) => String(candidate?.name || '').toLowerCase() === phaseName)
      || properties.phases[0]
    : null;
  const density = Number(phaseRecord?.densityKgPerM3 ?? properties.densityKgPerM3);
  return Number.isFinite(density) && density > 0 ? density : null;
}

function oscillatorCacheKey(oscillators) {
  if (!Array.isArray(oscillators) || oscillators.length === 0) return 'none';
  return oscillators
    .map((osc) => [
      osc.from ?? '?',
      osc.to ?? '?',
      stableNumber(osc.energyEv),
      stableNumber(osc.dampingEv),
      stableNumber(osc.strengthWeight)
    ].join(':'))
    .join('|');
}

function opticalRenderCacheKey({ material, phase = 'liquid', pathLengthM = 0.3, properties, conductionElectronDensityPerM3, opticalState = null } = {}) {
  return [
    material ?? 'unknown',
    phase ?? 'unknown',
    stableNumber(pathLengthM),
    stableObjectKey(opticalState),
    stableNumber(conductionElectronDensityPerM3 ?? properties?.conductionElectronDensityPerM3),
    stableNumber(phaseDensityKgPerM3(properties, phase)),
    stableNumber(properties?.electronicGapEv),
    stableNumber(properties?.gasElectronicExcitationEv),
    stableNumber(properties?.gasElectronicBandFwhmEv),
    stableNumber(properties?.gasElectronicOscillatorStrength),
    oscillatorCacheKey(properties?.opticalInterbandOscillators),
    Array.isArray(properties?.intrinsicColorSrgb) ? properties.intrinsicColorSrgb.map(stableNumber).join(',') : 'no-intrinsic'
  ].join('::');
}

function cloneOpticalRenderParams(params) {
  return {
    ...params,
    baseColorSrgb: params.baseColorSrgb ? [...params.baseColorSrgb] : params.baseColorSrgb,
    attenuationColor: params.attenuationColor ? [...params.attenuationColor] : params.attenuationColor,
    interbandOscillators: Array.isArray(params.interbandOscillators)
      ? params.interbandOscillators.map((osc) => ({ ...osc }))
      : params.interbandOscillators,
    spectralSamples: Array.isArray(params.spectralSamples)
      ? params.spectralSamples.map((sample) => ({ ...sample }))
      : params.spectralSamples,
    dropletMicrophysics: params.dropletMicrophysics ? { ...params.dropletMicrophysics } : params.dropletMicrophysics,
    pbr: params.pbr
      ? {
          ...params.pbr,
          baseColorSrgb: params.pbr.baseColorSrgb ? [...params.pbr.baseColorSrgb] : params.pbr.baseColorSrgb
        }
      : params.pbr,
    provenance: params.provenance
      ? { ...params.provenance, inputs: params.provenance.inputs ? { ...params.provenance.inputs } : params.provenance.inputs }
      : params.provenance
  };
}

function withPbrMetadata(params, { baseColorSrgb, renderModel, vertexColorPolicy = 'material-pbr', spectralSamples = [] }) {
  const color = srgbTuple(baseColorSrgb);
  return {
    ...params,
    baseColorSrgb: color,
    renderModel,
    vertexColorPolicy,
    spectralSamples,
    pbr: {
      baseColorSrgb: color,
      metalness: params.metalness,
      roughness: params.roughness,
      opacity: params.opacity,
      transmission: params.transmission,
      ior: params.ior ?? null,
      renderModel,
      vertexColorPolicy
    }
  };
}

export function clearOpticalRenderParamsCache() {
  opticalRenderParamCache.clear();
}

function opticalDepthToOpacity(opticalDepth) {
  if (!(opticalDepth > 0)) return 0;
  return 1 - Math.exp(-Math.min(80, opticalDepth));
}

export function waterSaturationPressurePa(temperatureK) {
  const t = Number(temperatureK);
  if (!(t > 0)) return null;
  return WATER_TRIPLE_POINT_PRESSURE_PA * Math.exp(
    (WATER_VAPORIZATION_LATENT_HEAT_J_PER_KG / WATER_VAPOR_GAS_CONSTANT_J_PER_KG_K)
    * (1 / WATER_TRIPLE_POINT_K - 1 / t)
  );
}

function waterDropletScatteringCoefficientAtNm(nm, {
  scatteringCoefficientPerM,
  dropletRadiusM
}) {
  if (!(scatteringCoefficientPerM > 0)) return 0;
  const radius = Number(dropletRadiusM);
  if (!(radius > 0)) return scatteringCoefficientPerM;
  const wavelengthM = nm * 1e-9;
  const sizeParameter = (2 * Math.PI * radius) / wavelengthM;
  if (sizeParameter >= 0.3) return scatteringCoefficientPerM;
  const refNm = 550;
  return scatteringCoefficientPerM * (refNm / nm) ** 4;
}

export function waterDropletOpticalMicrophysics({
  temperatureK = null,
  h2oPartialPressurePa = null,
  pressurePa = null,
  dropletRadiusM = 1e-6,
  pathLengthM = 0.3
} = {}) {
  const temperature = Number(temperatureK);
  const vaporPressure = Number(h2oPartialPressurePa ?? pressurePa);
  const radius = Number(dropletRadiusM);
  const saturationPressurePa = waterSaturationPressurePa(temperature);
  if (!(temperature > 0) || !(vaporPressure > 0) || !(saturationPressurePa > 0) || !(radius > 0)) {
    return {
      model: WATER_DROPLET_OPTICAL_MICROPHYSICS_MODEL,
      status: 'pure-vapor-or-state-missing',
      temperatureK: Number.isFinite(temperature) ? temperature : null,
      h2oPartialPressurePa: Number.isFinite(vaporPressure) ? vaporPressure : null,
      pressurePa: Number.isFinite(Number(pressurePa)) ? Number(pressurePa) : null,
      saturationPressurePa,
      supersaturationRatio: null,
      condensedMassFraction: 0,
      vaporDensityKgPerM3: 0,
      condensedMassDensityKgPerM3: 0,
      dropletRadiusM: Number.isFinite(radius) && radius > 0 ? radius : null,
      dropletNumberDensityPerM3: 0,
      dropletCrossSectionM2: 0,
      mieExtinctionEfficiency: 0,
      scatteringCoefficientPerM: 0,
      opticalDepth: 0,
      pathLengthM
    };
  }
  const supersaturationRatio = vaporPressure / saturationPressurePa;
  const condensedMassFraction = supersaturationRatio > 1 ? clamp01(1 - 1 / supersaturationRatio) : 0;
  const vaporDensityKgPerM3 = vaporPressure / (WATER_VAPOR_GAS_CONSTANT_J_PER_KG_K * temperature);
  const condensedMassDensityKgPerM3 = vaporDensityKgPerM3 * condensedMassFraction;
  const dropletVolumeM3 = (4 / 3) * Math.PI * radius ** 3;
  const dropletMassKg = dropletVolumeM3 * LIQUID_WATER_DENSITY_KG_PER_M3;
  const dropletNumberDensityPerM3 = dropletMassKg > 0 ? condensedMassDensityKgPerM3 / dropletMassKg : 0;
  const geometricCrossSectionM2 = Math.PI * radius ** 2;
  const mieExtinctionEfficiency = 2;
  const scatteringCoefficientPerM = dropletNumberDensityPerM3 * geometricCrossSectionM2 * mieExtinctionEfficiency;
  const opticalDepth = scatteringCoefficientPerM * Math.max(0, Number(pathLengthM) || 0);
  return {
    model: WATER_DROPLET_OPTICAL_MICROPHYSICS_MODEL,
    status: condensedMassFraction > 0 ? 'supersaturated-condensed-droplets' : 'subsaturated-pure-vapor',
    temperatureK: temperature,
    h2oPartialPressurePa: vaporPressure,
    pressurePa: Number.isFinite(Number(pressurePa)) ? Number(pressurePa) : null,
    saturationPressurePa,
    supersaturationRatio,
    condensedMassFraction,
    vaporDensityKgPerM3,
    condensedMassDensityKgPerM3,
    dropletRadiusM: radius,
    dropletNumberDensityPerM3,
    dropletCrossSectionM2: geometricCrossSectionM2,
    mieExtinctionEfficiency,
    scatteringCoefficientPerM,
    opticalDepth,
    pathLengthM
  };
}

function complexAdd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function complexSub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function complexDiv(a, b) {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
}
function complexSqrt(z) {
  const [x, y] = z;
  const r = Math.hypot(x, y);
  return [Math.sqrt(Math.max(0, (r + x) / 2)), Math.sign(y || 1) * Math.sqrt(Math.max(0, (r - x) / 2))];
}

function reflectanceFromDielectric(epsilon) {
  const [nRe, kIm] = complexSqrt(epsilon);
  return ((nRe - 1) ** 2 + kIm ** 2) / ((nRe + 1) ** 2 + kIm ** 2);
}

function absorptionCoefficientFromDielectricPerM(nm, epsilon) {
  const [, kIm] = complexSqrt(epsilon);
  return (4 * Math.PI * Math.max(0, kIm)) / (nm * 1e-9);
}

function dielectricSpectralSample(nm, epsilon, pathLengthM) {
  const [nRe, kIm] = complexSqrt(epsilon);
  const absorptionCoefficientPerM = absorptionCoefficientFromDielectricPerM(nm, epsilon);
  return {
    wavelengthNm: nm,
    reflectance: clamp01(reflectanceFromDielectric(epsilon)),
    transmittance: Math.exp(-Math.min(80, absorptionCoefficientPerM * Math.max(0, pathLengthM))),
    absorptionCoefficientPerM,
    scatteringCoefficientPerM: 0,
    n: nRe,
    k: kIm
  };
}

function absorptionSpectralSample(nm, { absorptionCoefficientPerM, pathLengthM, reflectance = 0, scatteringCoefficientPerM = 0, n = null, k = null }) {
  const absorption = Math.max(0, absorptionCoefficientPerM ?? 0);
  return {
    wavelengthNm: nm,
    reflectance: clamp01(reflectance),
    transmittance: Math.exp(-Math.min(80, absorption * Math.max(0, pathLengthM))),
    absorptionCoefficientPerM: absorption,
    scatteringCoefficientPerM: Math.max(0, scatteringCoefficientPerM),
    n,
    k
  };
}

function airRayleighScatteringCoefficientPerM(nm, densityScale = 1) {
  const wavelengthScale = (550 / Math.max(1, Number(nm) || 550)) ** 4;
  return STANDARD_AIR_RAYLEIGH_SCATTERING_550NM_PER_M
    * Math.max(0, Number.isFinite(densityScale) ? densityScale : 1)
    * wavelengthScale;
}

function airRayleighOpticalRenderParams({ phase = 'gas', pathLengthM = 0.3, properties = null } = {}) {
  const density = phaseDensityKgPerM3(properties, phase) ?? STANDARD_AIR_DENSITY_KG_PER_M3;
  const densityScale = density / STANDARD_AIR_DENSITY_KG_PER_M3;
  const scatteringCoefficientPerM = visibleLuminousMean((nm) => (
    airRayleighScatteringCoefficientPerM(nm, densityScale)
  ));
  const opticalDepth = scatteringCoefficientPerM * Math.max(0, pathLengthM);
  const transmission = Math.exp(-Math.min(80, opticalDepth));
  const opacity = opticalDepthToOpacity(opticalDepth);
  const baseColor = spectralResponseToSrgb((nm) => 0.85 + 0.15 * (450 / nm) ** 4);
  const spectralSamples = OPTICAL_RENDER_SAMPLE_WAVELENGTHS_NM.map((nm) => absorptionSpectralSample(nm, {
    absorptionCoefficientPerM: 0,
    pathLengthM,
    reflectance: 0,
    scatteringCoefficientPerM: airRayleighScatteringCoefficientPerM(nm, densityScale),
    n: AIR_REFRACTIVE_INDEX_VISIBLE,
    k: 0
  }));
  return withPbrMetadata({
    metalness: 0,
    roughness: 0.92,
    transmission,
    ior: AIR_REFRACTIVE_INDEX_VISIBLE,
    opacity,
    attenuationColor: [1, 1, 1],
    attenuationDistanceM: Infinity,
    condensationScatter: 0,
    internalScatter: scatteringCoefficientPerM,
    scatteringCoefficientPerM,
    opticalDepth,
    absorptionCoefficientPerM: 0,
    provenance: {
      status: 'derived',
      source: 'dry-air-rayleigh-scattering-reference-composition',
      method: 'standard dry-air density + Rayleigh 1/lambda^4 molecular scattering -> optically thin transparent PBR row',
      inputs: { phase, pathLengthM, densityKgPerM3: density, densityScale },
      validation: false
    }
  }, {
    baseColorSrgb: [baseColor.r, baseColor.g, baseColor.b],
    renderModel: 'gas-rayleigh-transparent-pbr',
    spectralSamples
  });
}

function canonicalElementZ(material) {
  if (typeof material !== 'string' || material.length === 0) return null;
  const symbol = material[0].toUpperCase() + material.slice(1).toLowerCase();
  return zForSymbol(symbol) ?? null;
}

function subshellCapacity(l) {
  return 2 * (2 * l + 1);
}

function orbitalLabel(orbital) {
  return `${orbital.n}${'spdfg'[orbital.l] ?? `l${orbital.l}`}`;
}

export function hasRelativisticInterbandCandidate(atomicNumberZ) {
  return electronConfiguration(atomicNumberZ).some((sub) => sub.l >= 2 && sub.occupancy > 0);
}

function augmentedInterbandConfiguration(atomicNumberZ) {
  const cfg = electronConfiguration(atomicNumberZ).map((sub) => ({ ...sub }));
  const add = (n, l) => {
    let targetN = Math.max(n, l + 1);
    while (cfg.some((sub) => sub.n === targetN && sub.l === l)) targetN += 1;
    cfg.push({ n: targetN, l, occupancy: 0 });
  };
  for (const sub of [...cfg]) {
    if (sub.occupancy <= 0 || sub.l < 2) continue;
    for (const lt of [sub.l - 1, sub.l + 1]) {
      if (lt < 0 || lt > 4) continue;
      add(sub.n + 1, lt);
    }
  }
  return cfg.sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n || a.l - b.l);
}

function rawRelativisticInterbandTransitions(atomicNumberZ, options = {}) {
  if (!hasRelativisticInterbandCandidate(atomicNumberZ)) return [];
  const gridPointsN = options.gridPointsN ?? 900;
  const rMaxBohr = options.rMaxBohr ?? 42;
  const maxScf = options.maxScf ?? 160;
  const key = `${atomicNumberZ}:${gridPointsN}:${rMaxBohr}:${maxScf}`;
  if (interbandTransitionCache.has(key)) return interbandTransitionCache.get(key);
  const atom = solveAtom(atomicNumberZ, {
    scalarRelativistic: true,
    configuration: augmentedInterbandConfiguration(atomicNumberZ),
    gridPointsN,
    rMaxBohr,
    maxScf
  });
  const occupied = atom.orbitals.filter((orbital) => orbital.occupancy > 0);
  const targets = atom.orbitals.filter((orbital) => orbital.occupancy < subshellCapacity(orbital.l));
  const transitions = [];
  for (const from of occupied) {
    if (from.l < 2) continue;
    for (const to of targets) {
      if (to.n === from.n && to.l === from.l) continue;
      if (Math.abs(to.l - from.l) !== 1 || to.energyHa <= from.energyHa) continue;
      const rawEnergyEv = (to.energyHa - from.energyHa) * HARTREE_EV;
      if (!(rawEnergyEv > 0) || rawEnergyEv > INTERBAND_MAX_RAW_EV) continue;
      const angular = to.l > from.l
        ? (from.l + 1) / (2 * from.l + 1)
        : from.l / (2 * from.l + 1);
      const filled = Math.min(1, Math.max(0, from.occupancy / subshellCapacity(from.l)));
      const vacancy = Math.min(1, Math.max(0, 1 - to.occupancy / subshellCapacity(to.l)));
      const localizedWeight = from.l >= 2 ? 1 : 0.35;
      const strengthWeight = filled * vacancy * angular * localizedWeight;
      if (!(strengthWeight > 0)) continue;
      transitions.push({
        from: orbitalLabel(from),
        to: orbitalLabel(to),
        fromL: from.l,
        toL: to.l,
        occupancy: from.occupancy,
        targetOccupancy: to.occupancy,
        rawEnergyEv,
        strengthWeight
      });
    }
  }
  const compact = transitions
    .sort((a, b) => a.rawEnergyEv - b.rawEnergyEv || b.strengthWeight - a.strengthWeight)
    .slice(0, INTERBAND_MAX_OSCILLATORS);
  interbandTransitionCache.set(key, compact);
  return compact;
}

function thomasFermiWavevectorBohr(conductionElectronDensityPerM3) {
  const nBohr = Math.max(0, conductionElectronDensityPerM3) * BOHR_M ** 3;
  if (!(nBohr > 0)) return 0;
  const kF = (3 * Math.PI * Math.PI * nBohr) ** (1 / 3);
  return Math.sqrt((4 * kF) / Math.PI);
}

export function relativisticInterbandOscillators({ atomicNumberZ, conductionElectronDensityPerM3, options = {} } = {}) {
  if (!(atomicNumberZ > 0) || !(conductionElectronDensityPerM3 > 0)) return [];
  const kTf = thomasFermiWavevectorBohr(conductionElectronDensityPerM3);
  const electronGasEnergyEv = 0.5 * HARTREE_EV * kTf * kTf;
  return rawRelativisticInterbandTransitions(atomicNumberZ, options)
    .map((transition) => {
      const rawHa = transition.rawEnergyEv / HARTREE_EV;
      const transitionWavevectorBohr = Math.sqrt(Math.max(rawHa, 1e-6));
      const thomasFermiScreeningRatio = Math.sqrt(1 + (kTf / transitionWavevectorBohr) ** 2);
      const bandBroadeningEv = INTERBAND_ELECTRON_GAS_BROADENING_SCALE
        * electronGasEnergyEv
        * Math.sqrt(Math.max(transition.strengthWeight, 0));
      const energyEv = transition.rawEnergyEv;
      return {
        ...transition,
        energyEv,
        thomasFermiScreeningRatio,
        electronGasEnergyEv,
        bandBroadeningEv,
        thomasFermiWavevectorBohr: kTf,
        dampingEv: Math.max(INTERBAND_MIN_DAMPING_EV, INTERBAND_DAMPING_FRACTION * energyEv + bandBroadeningEv)
      };
    })
    .filter((osc) => osc.energyEv > 0.15 && osc.energyEv < 8)
    .sort((a, b) => a.energyEv - b.energyEv || b.strengthWeight - a.strengthWeight)
    .slice(0, INTERBAND_MAX_OSCILLATORS);
}

/**
 * Drude normal-incidence reflectance of a metal at wavelength nm, from the free-electron
 * dielectric function ε(ω) = 1 − ω_p² / (ω² + i ω γ).
 */
export function drudeReflectance(nm, { plasmaRadPerS, dampingRadPerS }) {
  const { nRe, kIm } = drudeOpticalConstants(nm, { plasmaRadPerS, dampingRadPerS });
  return ((nRe - 1) ** 2 + kIm ** 2) / ((nRe + 1) ** 2 + kIm ** 2);
}

export function drudeOpticalConstants(nm, { plasmaRadPerS, dampingRadPerS }) {
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
  return { nRe, kIm, epsRe, epsIm };
}

export function drudeAbsorptionCoefficientPerM(nm, { plasmaRadPerS, dampingRadPerS }) {
  const { kIm } = drudeOpticalConstants(nm, { plasmaRadPerS, dampingRadPerS });
  return (4 * Math.PI * kIm) / (nm * 1e-9);
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

function dielectricDrudeLorentzEv(photonEv, { plasmaEnergyEv, dampingEv, oscillators }) {
  let epsilon = [1, 0];
  epsilon = complexSub(epsilon, complexDiv(
    [plasmaEnergyEv * plasmaEnergyEv, 0],
    [photonEv * photonEv, photonEv * dampingEv]
  ));
  for (const oscillator of oscillators || []) {
    const strengthEv2 = INTERBAND_STRENGTH_SCALE
      * plasmaEnergyEv * plasmaEnergyEv
      * oscillator.strengthWeight;
    epsilon = complexAdd(epsilon, complexDiv(
      [strengthEv2, 0],
      [
        oscillator.energyEv * oscillator.energyEv - photonEv * photonEv,
        -oscillator.dampingEv * photonEv
      ]
    ));
  }
  return epsilon;
}

export function metalRelativisticReflectance(nm, { atomicNumberZ = null, conductionElectronDensityPerM3, interbandOptions = {}, interbandOscillators = null } = {}) {
  const wp = plasmaFrequencyRadPerS(conductionElectronDensityPerM3);
  const plasmaEnergyEv = HBAR_EV_S * wp;
  const dampingEv = plasmaEnergyEv / 30;
  const oscillators = Array.isArray(interbandOscillators)
    ? interbandOscillators
    : atomicNumberZ
    ? relativisticInterbandOscillators({ atomicNumberZ, conductionElectronDensityPerM3, options: interbandOptions })
    : [];
  const photonEv = 1239.841984 / nm;
  return reflectanceFromDielectric(dielectricDrudeLorentzEv(photonEv, { plasmaEnergyEv, dampingEv, oscillators }));
}

export function metalRelativisticColorSrgb({ atomicNumberZ = null, conductionElectronDensityPerM3, interbandOptions = {}, interbandOscillators = null } = {}) {
  if (!(conductionElectronDensityPerM3 > 0)) return { r: 0.7, g: 0.7, b: 0.7, interbandOscillators: [] };
  const oscillators = Array.isArray(interbandOscillators)
    ? interbandOscillators
    : atomicNumberZ
      ? relativisticInterbandOscillators({ atomicNumberZ, conductionElectronDensityPerM3, options: interbandOptions })
      : [];
  const c = spectralResponseToSrgb((nm) => metalRelativisticReflectance(nm, {
    atomicNumberZ,
    conductionElectronDensityPerM3,
    interbandOptions,
    interbandOscillators: oscillators
  }));
  return {
    r: c.r,
    g: c.g,
    b: c.b,
    plasmaRadPerS: plasmaFrequencyRadPerS(conductionElectronDensityPerM3),
    interbandOscillators: oscillators
  };
}

function metalOpticalRenderParams(conductionElectronDensityPerM3, { pathLengthM = 0.3, atomicNumberZ = null, interbandOptions = {}, interbandOscillators = null } = {}) {
  const wp = plasmaFrequencyRadPerS(conductionElectronDensityPerM3);
  const plasmaEnergyEv = HBAR_EV_S * wp;
  const dampingEv = plasmaEnergyEv / 30;
  const oscillators = Array.isArray(interbandOscillators)
    ? interbandOscillators
    : atomicNumberZ
    ? relativisticInterbandOscillators({ atomicNumberZ, conductionElectronDensityPerM3, options: interbandOptions })
    : [];
  const epsilonAt = (nm) => dielectricDrudeLorentzEv(1239.841984 / nm, { plasmaEnergyEv, dampingEv, oscillators });
  const reflectanceAt = (nm) => reflectanceFromDielectric(epsilonAt(nm));
  const absorptionCoefficientPerM = visibleLuminousMean((nm) => absorptionCoefficientFromDielectricPerM(nm, epsilonAt(nm)));
  const reflectance = visibleLuminousMean(reflectanceAt);
  const opticalDepth = absorptionCoefficientPerM * Math.max(0, pathLengthM);
  const opacity = opticalDepthToOpacity(opticalDepth);
  const transmission = Math.exp(-Math.min(80, opticalDepth));
  const baseColor = spectralResponseToSrgb(reflectanceAt);
  const spectralSamples = OPTICAL_RENDER_SAMPLE_WAVELENGTHS_NM
    .map((nm) => dielectricSpectralSample(nm, epsilonAt(nm), pathLengthM));
  return withPbrMetadata({
    metalness: opacity > 0.5 ? 1 : opacity,
    roughness: 0.32,
    transmission,
    ior: null,
    opacity,
    attenuationColor: null,
    attenuationDistanceM: absorptionCoefficientPerM > 0 ? 1 / absorptionCoefficientPerM : Infinity,
    condensationScatter: 0,
    internalScatter: 0,
    opticalDepth,
    absorptionCoefficientPerM,
    reflectance,
    interbandOscillators: oscillators,
    provenance: {
      status: 'derived',
      source: oscillators.length
        ? 'scalar-relativistic-kohn-sham-drude-lorentz-skin-depth'
        : 'drude-free-electron-skin-depth',
      method: oscillators.length
        ? 'conduction electron density + scalar-relativistic Kohn-Sham dipole-allowed interband transitions -> Drude-Lorentz complex index -> luminous skin-depth opacity'
        : 'conduction electron density -> plasma frequency -> complex index -> luminous absorption coefficient -> Beer-Lambert opacity',
      inputs: { atomicNumberZ, conductionElectronDensityPerM3, pathLengthM, damping: 'omega_p/30', oscillatorCount: oscillators.length },
      validation: false
    }
  }, {
    baseColorSrgb: [baseColor.r, baseColor.g, baseColor.b],
    renderModel: oscillators.length ? 'conductor-drude-lorentz-relativistic-interband' : 'conductor-drude-free-electron',
    spectralSamples
  });
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
export function intrinsicColorSrgb({ material, phase = 'solid', pathLengthM = 3, conductionElectronDensityPerM3 = null, properties = null }) {
  // Molecular gases with a derived/banked electronic band: the particle colour
  // is the band-tail transmitted response (same law as the gas surface optics),
  // so F2/Cl2 sphere-lane particles carry their yellow/green instead of the
  // grey default. Deep-UV bands come out white, as they should.
  if (phase === 'gas' && properties?.gasElectronicExcitationEv > 0) {
    const gasParams = molecularGasBandRenderParams({ properties, pathLengthM: Math.min(pathLengthM, 0.3) });
    if (gasParams?.baseColorSrgb) {
      const [r, g, b] = gasParams.baseColorSrgb;
      return { r, g, b };
    }
  }
  // Metals: derive the colour from the conduction-electron density (Drude). The caller passes the
  // density (from the material closure); a metal without one falls through to the grey default.
  if (conductionElectronDensityPerM3 > 0) {
    const c = metalRelativisticColorSrgb({
      atomicNumberZ: canonicalElementZ(material),
      conductionElectronDensityPerM3
    });
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

function bandGapAbsorptionCoefficientPerM(nm, { properties, phase = 'solid' }) {
  const gapEv = properties?.electronicGapEv;
  if (!(gapEv >= 0)) return null;
  const photonEv = 1239.841984 / nm;
  if (photonEv <= gapEv) return 0;
  const density = phaseDensityKgPerM3(properties, phase);
  const molarMass = properties?.molarMassKgPerMol;
  if (!(density > 0) || !(molarMass > 0)) return null;
  const numberDensity = (density / molarMass) * 6.02214076e23;
  const volumePerFormulaM3 = 1 / numberDensity;
  const geometricCrossSectionM2 = volumePerFormulaM3 ** (2 / 3);
  const oscillatorFraction = Math.min(1, Math.max(0, (photonEv - gapEv) / Math.max(1, photonEv)));
  return numberDensity * geometricCrossSectionM2 * oscillatorFraction;
}

function compoundGapRenderParams({ properties, phase = 'solid', pathLengthM = 0.3 }) {
  const sample = bandGapAbsorptionCoefficientPerM(500, { properties, phase });
  if (sample == null) return null;
  const absorptionAt = (nm) => bandGapAbsorptionCoefficientPerM(nm, { properties, phase }) ?? 0;
  const absorptionCoefficientPerM = visibleLuminousMean(absorptionAt);
  const opticalDepth = absorptionCoefficientPerM * Math.max(0, pathLengthM);
  const opacity = opticalDepthToOpacity(opticalDepth);
  const responseColor = spectralResponseToSrgb((nm) => Math.exp(-absorptionAt(nm) * Math.max(0, pathLengthM)));
  const baseColor = properties?.intrinsicColorSrgb ?? [responseColor.r, responseColor.g, responseColor.b];
  const spectralSamples = OPTICAL_RENDER_SAMPLE_WAVELENGTHS_NM.map((nm) => absorptionSpectralSample(nm, {
    absorptionCoefficientPerM: absorptionAt(nm),
    pathLengthM,
    reflectance: 0.04,
    n: 1.4,
    k: 0
  }));
  return withPbrMetadata({
    metalness: 0,
    roughness: 0.4,
    transmission: Math.exp(-Math.min(80, opticalDepth)),
    ior: 1.4,
    opacity,
    attenuationColor: properties?.intrinsicColorSrgb ?? null,
    attenuationDistanceM: absorptionCoefficientPerM > 0 ? 1 / absorptionCoefficientPerM : Infinity,
    condensationScatter: 0,
    internalScatter: 0,
    opticalDepth,
    absorptionCoefficientPerM,
    provenance: {
      status: 'derived',
      source: 'molecular-gap-geometric-absorption',
      method: 'electronic gap + formula density -> geometric oscillator absorption -> Beer-Lambert opacity',
      inputs: { electronicGapEv: properties?.electronicGapEv, pathLengthM, phase },
      validation: false
    }
  }, {
    baseColorSrgb: baseColor,
    renderModel: 'molecular-gap-pbr',
    spectralSamples
  });
}

// Visible colour of a molecular gas from its lowest electronic absorption band.
// Band centre E0: the ΔSCF vertical triplet excitation derived in materialDerivation
// (gasElectronicExcitationEv). Band shape: the low-lying excited states of halogen-like
// molecules are repulsive, so absorption is a broad Franck–Condon continuum — modelled
// as a Gaussian of width E0/6 (universal broad-continuum estimate, same class as the
// Drude ω_p/30 damping). Strength: Thomas–Reiche–Kuhn integrated cross-section
// e²/(4ε₀·m_e·c) scaled by a universal weak-continuum oscillator strength f = 1e-3 —
// these transitions are spin/symmetry-hindered and measured halogen continua sit at
// f ~ 1e-3 (frontier: derive f from transition dipoles instead of this constant).
// κ(λ) = n_gas·σ(λ) with n_gas from the ideal-gas number density, so a molecule whose
// band sits in the deep UV (N2, H2, O2) stays correctly invisible while F2/Cl2 pick up
// their yellow-green tints from the band tail — no per-material tuning anywhere.
const GAS_CONTINUUM_OSCILLATOR_STRENGTH = 1e-3;
const TRK_INTEGRATED_CROSS_SECTION_M2_HZ = 2.6540e-6; // e²/(4 ε₀ m_e c)
const EV_TO_HZ = 2.417989242e14;

function gasElectronicBandAbsorptionPerM(nm, { excitationEv, numberDensityPerM3, bandSigmaEv, oscillatorStrength }) {
  if (!(excitationEv > 0) || !(numberDensityPerM3 > 0)) return 0;
  const photonEv = 1239.841984 / nm;
  const sigmaEv = bandSigmaEv > 0 ? bandSigmaEv : excitationEv / 6;
  const f = oscillatorStrength > 0 ? oscillatorStrength : GAS_CONTINUUM_OSCILLATOR_STRENGTH;
  const bandSigmaHz = sigmaEv * EV_TO_HZ;
  const peakSigmaM2 = (TRK_INTEGRATED_CROSS_SECTION_M2_HZ * f)
    / (Math.sqrt(2 * Math.PI) * bandSigmaHz);
  const detuningEv = photonEv - excitationEv;
  return numberDensityPerM3 * peakSigmaM2
    * Math.exp(-(detuningEv * detuningEv) / (2 * sigmaEv * sigmaEv));
}

const GAUSSIAN_FWHM_TO_SIGMA = 1 / (2 * Math.sqrt(2 * Math.LN2));

function molecularGasBandRenderParams({ properties, pathLengthM = 0.3 }) {
  const excitationEv = properties?.gasElectronicExcitationEv;
  if (!(excitationEv > 0)) return null;
  const density = phaseDensityKgPerM3(properties, 'gas');
  const molarMass = properties?.molarMassKgPerMol;
  if (!(density > 0) || !(molarMass > 0)) return null;
  const numberDensityPerM3 = (density / molarMass) * 6.02214076e23;
  const bandSigmaEv = properties?.gasElectronicBandFwhmEv > 0
    ? properties.gasElectronicBandFwhmEv * GAUSSIAN_FWHM_TO_SIGMA
    : null;
  const oscillatorStrength = properties?.gasElectronicOscillatorStrength ?? null;
  const absorptionAt = (nm) => gasElectronicBandAbsorptionPerM(nm, {
    excitationEv,
    numberDensityPerM3,
    bandSigmaEv,
    oscillatorStrength
  });
  const absorptionCoefficientPerM = visibleLuminousMean(absorptionAt);
  const opticalDepth = absorptionCoefficientPerM * Math.max(0, pathLengthM);
  const opacity = opticalDepthToOpacity(opticalDepth);
  const transmission = Math.exp(-Math.min(80, opticalDepth));
  const n = 1.0005; // gas refractive index ≈ air; surface Fresnel is negligible
  const responseColor = spectralResponseToSrgb(
    (nm) => Math.exp(-absorptionAt(nm) * Math.max(0.01, pathLengthM))
  );
  const spectralSamples = OPTICAL_RENDER_SAMPLE_WAVELENGTHS_NM.map((nm) => absorptionSpectralSample(nm, {
    absorptionCoefficientPerM: absorptionAt(nm),
    pathLengthM,
    reflectance: ((n - 1) / (n + 1)) ** 2,
    n,
    k: 0
  }));
  return withPbrMetadata({
    metalness: 0,
    roughness: 1,
    transmission,
    ior: n,
    opacity,
    attenuationColor: [responseColor.r, responseColor.g, responseColor.b],
    attenuationDistanceM: absorptionCoefficientPerM > 0 ? 1 / absorptionCoefficientPerM : Infinity,
    condensationScatter: 0,
    internalScatter: 0,
    opticalDepth,
    absorptionCoefficientPerM,
    provenance: {
      status: 'derived',
      source: 'delta-scf-electronic-band-gas-absorption',
      method: 'electronic band centre (banked spectroscopic or ΔSCF) -> Gaussian Franck-Condon continuum (banked FWHM or E0/6) -> Thomas-Reiche-Kuhn cross-section (banked f or 1e-3 weak-continuum estimate) -> Beer-Lambert',
      inputs: { gasElectronicExcitationEv: excitationEv, bandSigmaEv, oscillatorStrength, pathLengthM, numberDensityPerM3 },
      validation: false
    }
  }, {
    baseColorSrgb: [responseColor.r, responseColor.g, responseColor.b],
    renderModel: 'molecular-gas-electronic-band-absorption-pbr',
    spectralSamples
  });
}

/**
 * Physically-derived render parameters for a material surface — what the renderer should use
 * instead of hand-picked opacities. Everything here comes from the optics, not from tuning:
 *  - metals (iron): opaque (transmission 0, metalness 1); colour is the Drude reflectance.
 *  - water/ice: transmission + IOR from the refractive index (Fresnel sets the visible surface
 *    reflection), with a Beer–Lambert attenuation colour/distance for the bulk blue tint.
 *  - vapour (steam): IOR ≈ 1 and a long O-H attenuation length, so pure vapour is nearly invisible.
 *    Visible white steam requires a separate condensation/nucleation droplet closure; it is not
 *    faked here.
 * closureBacked: true; opticalValidation stays false.
 */
function deriveOpticalRenderParams({ material, phase = 'liquid', pathLengthM = 0.3, properties = null, conductionElectronDensityPerM3 = null, opticalState = null } = {}) {
  const conductionDensity = conductionElectronDensityPerM3 ?? properties?.conductionElectronDensityPerM3 ?? null;
  if (conductionDensity > 0) {
    return metalOpticalRenderParams(conductionDensity, {
      pathLengthM,
      atomicNumberZ: canonicalElementZ(material),
      interbandOscillators: properties?.opticalInterbandOscillators
    });
  }
  if (material === 'air') {
    return airRayleighOpticalRenderParams({ phase, pathLengthM, properties });
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
    const absorptionCoefficientPerM = 1 / attenuationDistanceM;
    const absorptionOpticalDepth = absorptionCoefficientPerM * Math.max(0, pathLengthM);
    const dropletMicrophysics = isVapor
      ? waterDropletOpticalMicrophysics({ ...(opticalState || {}), pathLengthM })
      : null;
    const scatteringCoefficientPerM = dropletMicrophysics?.scatteringCoefficientPerM || 0;
    const scatteringOpticalDepth = dropletMicrophysics?.opticalDepth || 0;
    const opticalDepth = absorptionOpticalDepth + scatteringOpticalDepth;
    const ballisticTransmission = Math.exp(-Math.min(80, opticalDepth));
    const transmission = Math.min(1, Math.max(0, (1 - fresnelR0) * ballisticTransmission));
    const opacity = opticalDepthToOpacity(opticalDepth);
    const roughness = isVapor ? (scatteringCoefficientPerM > 0 ? 1 : 0.9) : (isSolid ? 0.5 : 0.08);
    const waterPhase = isVapor ? 'gas' : (isSolid ? 'solid' : 'liquid');
    const scatteringColor = scatteringCoefficientPerM > 0
      ? spectralResponseToSrgb((nm) => {
          const s = waterDropletScatteringCoefficientAtNm(nm, {
            scatteringCoefficientPerM,
            dropletRadiusM: dropletMicrophysics?.dropletRadiusM
          });
          return s / Math.max(scatteringCoefficientPerM, 1e-30);
        })
      : null;
    const baseColor = isVapor
      ? (scatteringColor ? [scatteringColor.r, scatteringColor.g, scatteringColor.b] : [1, 1, 1])
      : attenuationColor;
    const spectralSamples = OPTICAL_RENDER_SAMPLE_WAVELENGTHS_NM.map((nm) => absorptionSpectralSample(nm, {
      absorptionCoefficientPerM: isVapor ? waterAbsorption(nm) / 50 : waterAbsorption(nm),
      pathLengthM,
      reflectance: fresnelR0,
      scatteringCoefficientPerM: isVapor
        ? waterDropletScatteringCoefficientAtNm(nm, {
          scatteringCoefficientPerM,
          dropletRadiusM: dropletMicrophysics?.dropletRadiusM
        })
        : 0,
      n,
      k: 0
    }));
    return withPbrMetadata({
      metalness: 0,
      roughness,
      transmission,
      ior: n,
      opacity,
      attenuationColor,
      attenuationDistanceM,
      condensationScatter: scatteringCoefficientPerM,
      internalScatter: scatteringCoefficientPerM,
      scatteringCoefficientPerM,
      dropletMicrophysics,
      opticalDepth,
      absorptionCoefficientPerM,
      provenance: {
        status: 'derived',
        source: scatteringCoefficientPerM > 0
          ? 'clausius-clapeyron-condensed-droplet-mie-rayleigh-scattering'
          : 'beer-lambert-oh-overtone-optical-depth',
        method: scatteringCoefficientPerM > 0
          ? 'saturation vapor pressure -> excess vapor condensed fraction -> droplet number density -> Mie/Rayleigh extinction + O-H absorption'
          : 'O-H overtone absorption -> luminous attenuation distance -> Beer-Lambert opacity/transmission',
        inputs: { pathLengthM, phase: waterPhase, opticalState: opticalState || null },
        validation: false
      }
    }, {
      baseColorSrgb: baseColor,
      renderModel: isVapor
        ? (scatteringCoefficientPerM > 0 ? 'molecular-condensed-droplet-scattering-pbr' : 'molecular-vapor-transparent-spectrum')
        : 'molecular-transparent-beer-lambert-pbr',
      spectralSamples
    });
  }
  if (phase === 'gas') {
    const gasBand = molecularGasBandRenderParams({ properties, pathLengthM });
    if (gasBand) return gasBand;
  }
  const compound = compoundGapRenderParams({ properties, phase, pathLengthM });
  if (compound) return compound;
  return withPbrMetadata({
    metalness: 0,
    roughness: 0.4,
    transmission: 0,
    ior: 1.4,
    opacity: 0,
    attenuationColor: null,
    attenuationDistanceM: Infinity,
    condensationScatter: 0,
    internalScatter: 0,
    opticalDepth: null,
    absorptionCoefficientPerM: null,
    blocked: true,
    provenance: {
      status: 'blocked',
      source: 'missing-optical-closure',
      method: 'no conduction density, water absorption model, or electronic-gap opacity available',
      inputs: { material, phase },
      validation: false
    }
  }, {
    baseColorSrgb: [0, 0, 0],
    renderModel: 'blocked-missing-optical-closure',
    vertexColorPolicy: 'blocked',
    spectralSamples: []
  });
}

export function opticalRenderParams(options = {}) {
  const key = opticalRenderCacheKey(options);
  const cached = opticalRenderParamCache.get(key);
  if (cached) return cloneOpticalRenderParams(cached);
  const derived = deriveOpticalRenderParams(options);
  opticalRenderParamCache.set(key, cloneOpticalRenderParams(derived));
  return cloneOpticalRenderParams(derived);
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
      interbandMetals: { model: 'scalar-relativistic-kohn-sham-drude-lorentz', transitions: 'KH orbital gaps with electron-gas band broadening', oscillatorStrengths: 'dipole selection rules and subshell occupancy' },
      water: { model: 'beer-lambert-OH-overtone-absorption' },
      opacity: { model: 'optical-depth-to-opacity', conductorOpacity: 'Drude skin depth', transparentMediaOpacity: 'Beer-Lambert attenuation' },
      air: { model: 'rayleigh-1-over-lambda4' },
      pbr: { model: 'spectral-response-to-pbr', cache: 'material-phase-path-hash', vertexColorPolicy: 'closure-owned' },
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
