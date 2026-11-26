// First-Principles UFO Weapons, Full-Spectrum EM Laser-Matter Interaction,
// Antimatter Annihilation, Iconic 60-Foot Emerald-Dome Saucer & Yellow Tractor Beam
// (`src/runtime/astrophysics/ufoWeaponsAndPhysicsGpu.js`)
//
// Zero planet-name hacks, zero scripted animations:
//   - Iconic smooth 32-segment brushed-titanium saucer (`18.3 m` / `60 ft` diameter = `9.15 m` radius)
//     with a translucent glowing emerald-green glass cockpit bubble and 16 rim weapon/plasma emitters.
//   - Translucent glowing yellow conical tractor beam beneath the UFO during Rover/Drone deploy,
//     surface/atmosphere sampling, and rigid-body boulder levitation/harvesting.
//   - Full-spectrum EM laser (`10^-13 m` Gamma -> `10^+1 m` Radio, `1 kW -> 100 TW`) with first-principles
//     compound absorptance (polar Microwave/Far-IR rotational loss, Mid-IR vibrational modes, optical band-gap
//     & Drude reflectance, UV photodissociation, X-ray/Gamma core photoionization & Compton ablation).
//   - Antimatter annihilation beam (`E = 2 m c^2`, 511 keV gamma flash + hadronic cascade plasma).
//   - 360-degree dynamic rim emission from the exact saucer perimeter point facing the aim target!

const C_LIGHT = 2.99792458e8;      // m/s
const H_PLANCK_EV_S = 4.135667696e-15; // eV·s
const SIGMA_SB = 5.670374419e-8;   // W / (m^2 K^4)

export const UFO_RADIUS_M = 9.15;  // 18.3 m = exact 60-foot diameter flying saucer!
export const UFO_DIAMETER_FT = 60.0;

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// =========================================================================
// 1. Full Electromagnetic Spectrum Physics (Gamma 10^-13 m -> Radio 10^+1 m)
// =========================================================================
export function visibleWavelengthNmToRgb(nm) {
  let r = 0; let g = 0; let b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 750) { r = 1; }
  const edge = nm < 420
    ? 0.35 + 0.65 * ((nm - 380) / 40)
    : (nm > 700 ? 0.35 + 0.65 * ((750 - nm) / 50) : 1.0);
  return [clamp(r * edge, 0, 1), clamp(g * edge, 0, 1), clamp(b * edge, 0, 1)];
}

export function evaluateEmWavelengthInfo(log10Meters) {
  const logLam = clamp(Number.isFinite(log10Meters) ? log10Meters : -6.27, -13.0, 1.0);
  const wavelengthM = Math.pow(10, logLam);
  const freqHz = C_LIGHT / wavelengthM;
  const photonEv = H_PLANCK_EV_S * freqHz;
  const nm = wavelengthM * 1e9;

  let band = 'Visible';
  let shortBand = 'VIS';
  let isVisible = false;
  let rgb = [0.22, 1.0, 0.42];
  let displayLabel = '';

  if (wavelengthM < 1e-11) {
    band = 'Gamma Ray'; shortBand = 'γ-RAY';
    rgb = [0.78, 0.36, 1.0]; // Ionized air Cherenkov / gamma fluorescence violet-white
    displayLabel = `${(photonEv * 1e-6).toFixed(2)} MeV (${(wavelengthM * 1e12).toFixed(2)} pm)`;
  } else if (wavelengthM < 1e-8) {
    band = wavelengthM < 1e-10 ? 'Hard X-Ray' : 'Soft X-Ray'; shortBand = 'X-RAY';
    rgb = [0.46, 0.72, 1.0];
    displayLabel = photonEv >= 1e3
      ? `${(photonEv * 1e-3).toFixed(2)} keV (${(wavelengthM * 1e10).toFixed(2)} Å)`
      : `${photonEv.toFixed(0)} eV (${nm.toFixed(2)} nm)`;
  } else if (wavelengthM < 3.8e-7) {
    band = wavelengthM < 1.2e-7 ? 'Extreme UV' : 'Ultraviolet'; shortBand = 'UV';
    rgb = [0.58, 0.28, 1.0];
    displayLabel = `${nm.toFixed(0)} nm (${photonEv.toFixed(1)} eV)`;
  } else if (wavelengthM <= 7.5e-7) {
    band = 'Visible Light'; shortBand = 'VIS';
    isVisible = true;
    rgb = visibleWavelengthNmToRgb(nm);
    displayLabel = `${nm.toFixed(0)} nm (${photonEv.toFixed(2)} eV)`;
  } else if (wavelengthM < 1e-3) {
    const um = wavelengthM * 1e6;
    band = um < 2.5 ? 'Near-IR' : (um < 25 ? 'Mid-IR (Thermal)' : 'Far-IR / THz');
    shortBand = um < 25 ? 'IR' : 'THz';
    rgb = um < 25 ? [1.0, 0.24, 0.14] : [1.0, 0.48, 0.16];
    displayLabel = um < 100 ? `${um.toFixed(2)} μm` : `${(freqHz * 1e-12).toFixed(2)} THz`;
  } else if (wavelengthM < 0.3) {
    band = 'Microwave'; shortBand = 'μW';
    rgb = [1.0, 0.62, 0.18];
    displayLabel = `${(wavelengthM * 1e2).toFixed(2)} cm (${(freqHz * 1e-9).toFixed(2)} GHz)`;
  } else {
    band = 'Radio / RF'; shortBand = 'RF';
    rgb = [0.96, 0.78, 0.26];
    displayLabel = `${wavelengthM.toFixed(2)} m (${(freqHz * 1e-6).toFixed(1)} MHz)`;
  }

  return {
    log10Meters: logLam,
    wavelengthM,
    wavelengthNm: nm,
    freqHz,
    photonEv,
    band,
    shortBand,
    isVisible,
    rgb,
    displayLabel
  };
}

// =========================================================================
// 2. First-Principles Compound Light-Matter Interaction & Thermochemistry
// =========================================================================
function resolveMaterialOpticalThermalProfile(sample) {
  const formula = String(sample?.formula || 'SiO2');
  const id = String(sample?.id || '');
  // Infer physical material family purely from chemical constituents (zero planet names!)
  const isWaterIce = formula.includes('H₂O') || formula.includes('H2O') || id.includes('water') || id.includes('ice');
  const isHydrocarbon = formula.includes('CH₄') || formula.includes('CH4') || id.includes('tholin') || id.includes('organic');
  const isIronRich = formula.includes('Fe') || id.includes('ferric') || id.includes('magma');
  const isMetallic = sample?.primaryZ === 26 || sample?.primaryZ === 28 || sample?.primaryZ === 29 || sample?.primaryZ === 79;

  if (isWaterIce) {
    return {
      formula: 'H₂O',
      polarDipole: 0.94,      // Strong microwave / far-IR rotational absorption!
      irVibBandUm: 3.05,      // O-H stretch & H-O-H bend
      bandGapEv: 7.4,         // Transparent to visible; absorbs deep UV!
      visAbsorb: 0.09,
      metallicity: 0.0,
      tMeltK: 273.15,
      tBoilK: 373.15,
      tPlasmaK: 5200,
      cpJPerKgK: 4180,
      densityKgM3: 980,
      meltDesc: 'Liquid H₂O melt pool',
      boilDesc: 'Superheated H₂O steam geyser',
      uvDesc: 'Photolysis: H₂O + hν → H• + •OH + H₂/O₂',
      xrayDesc: 'Radiolytic H₂O K-shell plasma flash'
    };
  }
  if (isHydrocarbon) {
    return {
      formula: 'CH₄ / C-H-O',
      polarDipole: 0.14,
      irVibBandUm: 3.35,      // C-H stretching fundamental
      bandGapEv: 4.2,
      visAbsorb: 0.56,
      metallicity: 0.0,
      tMeltK: 340,
      tBoilK: 680,
      tPlasmaK: 4600,
      cpJPerKgK: 2200,
      densityKgM3: 1150,
      meltDesc: 'Pyrolytic hydrocarbon tar & vapor',
      boilDesc: 'Thermal cracking: CH₄ → C(soot) + 2 H₂',
      uvDesc: 'UV radical photopolymerization & ablation',
      xrayDesc: 'Carbon K-edge Coulomb fragmentation'
    };
  }
  if (isMetallic) {
    return {
      formula: 'Fe / Ni Alloy',
      polarDipole: 0.05,
      irVibBandUm: 8.0,
      bandGapEv: 0.0,         // Free-electron Drude conductor!
      visAbsorb: 0.36,
      metallicity: 0.92,
      tMeltK: 1811,
      tBoilK: 3134,
      tPlasmaK: 6400,
      cpJPerKgK: 450,
      densityKgM3: 7870,
      meltDesc: 'Molten incandescent iron-alloy slag',
      boilDesc: 'Vaporized metallic Fe plasma plume',
      uvDesc: 'Photoelectric electron ejection & ablation',
      xrayDesc: 'Fe K-alpha fluorescence & ionized plasma'
    };
  }
  // Silicate / Basalt / Hematite / Anorthosite crust
  return {
    formula: isIronRich ? 'Fe₂O₃ · SiO₂' : 'SiO₂ · Mg₂SiO₄',
    polarDipole: 0.16,
    irVibBandUm: 9.6,         // Si-O antisymmetric stretch Reststrahlen band!
    bandGapEv: isIronRich ? 2.15 : 8.6,
    visAbsorb: isIronRich ? 0.72 : 0.42,
    metallicity: isIronRich ? 0.18 : 0.02,
    tMeltK: 1470,
    tBoilK: 2950,
    tPlasmaK: 6200,
    cpJPerKgK: 840,
    densityKgM3: 2900,
    meltDesc: 'Molten silicate magma & vitrified glass',
    boilDesc: 'Vaporizing SiO + O₂ rock plasma',
    uvDesc: 'UV photo-desorption & silicate spallation',
    xrayDesc: 'Si/O K-shell photoionization & shock crater'
  };
}

export function evaluateLaserMaterialInteraction({
  log10WavelengthM = -6.27,
  powerW = 1e8,
  maxPowerW = 1e26,
  spotRadiusM = 1.6,
  sample = null,
  currentTempK = 260,
  dt = 0.02
} = {}) {
  const em = evaluateEmWavelengthInfo(log10WavelengthM);
  const mat = resolveMaterialOpticalThermalProfile(sample);
  const pCap = Math.max(1e12, Math.min(1e26, Number(maxPowerW) || 1e26));
  const pW = clamp(Number(powerW) || 1e7, 1e3, pCap);
  const rSpot = Math.max(0.4, Number(spotRadiusM) || 1.6);
  const area = Math.PI * rSpot * rSpot;

  // Spectral absorptance alpha(lambda) from physical mechanisms:
  //   1. Microwave / Far-IR rotational dipole loss
  //   2. Mid-IR resonant vibrational stretch band
  //   3. Electronic interband transition (photonEv >= bandGapEv) + Drude reflectance
  //   4. High-energy X-ray / Gamma photoionization + Compton scattering
  const um = em.wavelengthM * 1e6;
  // Broad Debye polar rotational dielectric loss band (1 GHz .. 300 GHz, peaking near ~20 GHz / 1.5 cm)
  const mwBand = Math.exp(-Math.pow((Math.log10(em.wavelengthM) + 1.45) / 1.65, 2));
  const irVib = Math.exp(-Math.pow(Math.log(Math.max(1e-3, um) / mat.irVibBandUm) / 0.95, 2));
  const interband = em.photonEv >= mat.bandGapEv && mat.bandGapEv > 0
    ? clamp(0.55 + 0.40 * Math.tanh((em.photonEv - mat.bandGapEv) * 0.4), 0, 0.96)
    : 0.0;
  const drudeMetal = mat.metallicity * clamp(0.18 + 0.48 * Math.exp(-Math.max(0, Math.log10(em.wavelengthM) + 6.5) * 0.6), 0.06, 0.68);
  const highEnergy = em.photonEv > 40 ? clamp(0.62 + 0.34 * Math.tanh(Math.log10(em.photonEv / 40) * 0.6), 0, 0.97) : 0;

  let absorptance = clamp(
    mat.visAbsorb * (em.isVisible ? 1.0 : 0.25)
    + mat.polarDipole * mwBand * 0.88
    + (1.0 - mat.metallicity) * irVib * 0.84
    + interband * 0.78
    + drudeMetal
    + highEnergy,
    0.04,
    0.98
  );
  // Radio waves mostly reflect/penetrate dielectric crust unless plasma-coupled
  if (em.wavelengthM > 0.3) absorptance = clamp(0.05 + mat.polarDipole * 0.22 + mat.metallicity * 0.14, 0.04, 0.38);

  const absorbedFluxWPerM2 = (pW * absorptance) / area;
  // Effective optical/thermal skin mass (m = rho * area * skinDepth; microwave penetrates deeper than optical/IR)
  const skinDepthM = em.wavelengthM > 1e-3 ? 0.18 : (em.photonEv > 500 ? 0.14 : 0.045);
  const heatCapJPerK = Math.max(2500, mat.densityKgM3 * area * skinDepthM * mat.cpJPerKgK);
  const radLossW = area * 0.85 * SIGMA_SB * Math.pow(Math.max(20, currentTempK), 4);
  const netPowerW = pW * absorptance - radLossW;
  const dT = clamp((netPowerW * dt) / heatCapJPerK, -120, 4800);
  const nextTempK = clamp(currentTempK + dT, 20, 28000);

  // Determine exact physical phase/chemical reaction state!
  let phaseState = 'Heating';
  let reactionOutcome = `${mat.formula} absorbing ${(absorptance * 100).toFixed(0)}% ${em.shortBand}`;
  let ablationRateMPerS = 0;
  let meltDelta = 0;

  if (em.photonEv > 200 && pW >= 1e7) {
    phaseState = 'Coulomb Plasma';
    reactionOutcome = mat.xrayDesc;
    ablationRateMPerS = clamp(Math.log10(pW / 1e6) * 0.55 * absorptance, 0.08, 4.5);
    meltDelta = 0.22;
  } else if (nextTempK >= mat.tPlasmaK) {
    phaseState = 'Ionized Plasma';
    reactionOutcome = `${mat.formula} thermal ionization plasma (${Math.round(nextTempK)} K)`;
    ablationRateMPerS = clamp(Math.log10(pW / 1e6) * 0.48 * absorptance, 0.12, 4.2);
    meltDelta = 0.25;
  } else if (nextTempK >= mat.tBoilK) {
    phaseState = 'Vaporizing';
    reactionOutcome = `${mat.boilDesc} (${Math.round(nextTempK)} K)`;
    ablationRateMPerS = clamp(Math.log10(pW / 1e5) * 0.26 * absorptance, 0.04, 2.8);
    meltDelta = 0.18;
  } else if (nextTempK >= mat.tMeltK) {
    phaseState = 'Melting';
    reactionOutcome = `${mat.meltDesc} (${Math.round(nextTempK)} K)`;
    ablationRateMPerS = clamp(Math.log10(pW / 1e5) * 0.07 * absorptance, 0.01, 0.8);
    meltDelta = 0.14;
  } else if (em.photonEv >= 4.0 && em.photonEv <= 200 && pW >= 1e6) {
    phaseState = 'Photodissociation';
    reactionOutcome = mat.uvDesc;
    ablationRateMPerS = clamp(Math.log10(pW / 1e5) * 0.08 * absorptance, 0.01, 0.9);
    meltDelta = 0.06;
  } else if (em.isVisible && mat.visAbsorb < 0.15) {
    phaseState = 'Transmitting';
    reactionOutcome = `Visible ${Math.round(em.wavelengthNm)} nm transmitting through transparent ${mat.formula}`;
  }

  return {
    em,
    materialFormula: mat.formula,
    absorptance,
    absorbedFluxWPerM2,
    nextTempK,
    phaseState,
    reactionOutcome,
    ablationRateMPerS,
    meltDelta,
    tMeltK: mat.tMeltK,
    tBoilK: mat.tBoilK
  };
}

/**
 * First-principles gravitational + tensile cohesive binding energy U_bind (Joules) of ANY body:
 *   U_bind = (3/5) * G * M^2 / R  +  (4/3) * pi * R^3 * sigma_coh
 * Zero planet/body-name hacks! Determines exact shatter threshold for asteroids, comets & moons.
 */
export function computeBodyBindingEnergyJ(bodySpec = {}) {
  const G = 6.67430e-11;
  const SOLAR_KG = 1.98847e30;
  const rM = Math.max(50.0, (Number(bodySpec.radiusKm) || 10.0) * 1000.0);
  const defaultRho = bodySpec.isComet ? 620.0 : (bodySpec.isMetallicAsteroid ? 5400.0 : 2650.0);
  const mKg = Number(bodySpec.massSolar) > 0
    ? Number(bodySpec.massSolar) * SOLAR_KG
    : (4.0 / 3.0) * Math.PI * rM * rM * rM * defaultRho;
  const uGrav = (0.6 * G * mKg * mKg) / rM;
  const sigmaCohPa = bodySpec.isComet ? 1.5e4 : (bodySpec.isMetallicAsteroid ? 2.5e7 : 3.5e5);
  const uCoh = (4.0 / 3.0) * Math.PI * rM * rM * rM * sigmaCohPa;
  return Math.max(1e9, uGrav + uCoh);
}

/**
 * Exact relativistic antimatter annihilation mass-conversion rate (kg/s) for beam power P (W),
 * with 50% prompt electromagnetic/pion coupling (`P = 2 * m_dot * c^2 * 0.5 => m_dot = P / (2 c^2)`).
 */
export function computeAntimatterMassRateKgS(powerW = 1e12) {
  const p = Math.max(1e3, Number(powerW) || 1e12);
  return p / (2.0 * C_LIGHT * C_LIGHT);
}

export function evaluateAntimatterAnnihilation({ massRateKgS = null, powerW = null, dt = 0.02 } = {}) {
  const mRate = Number.isFinite(Number(massRateKgS)) && Number(massRateKgS) > 0
    ? Number(massRateKgS)
    : computeAntimatterMassRateKgS(powerW ?? 3.6e10);
  const mKg = Math.max(1e-18, mRate * dt);
  // E = 2 * m * c^2 (antimatter particle + matched normal-matter partner; 50% prompt EM/pion coupling!)
  const energyJ = 2.0 * mKg * C_LIGHT * C_LIGHT;
  const coupledEnergyJ = energyJ * 0.5;
  const effPowerW = 2.0 * mRate * C_LIGHT * C_LIGHT;
  const tntTons = coupledEnergyJ / 4.184e9;
  const craterRadiusM = clamp(8.0 + 4.6 * Math.pow(Math.max(0.01, tntTons), 0.30), 9.0, 58.0);
  const craterDepthM = clamp(craterRadiusM * 0.36, 3.0, 22.0);
  const pLbl = effPowerW >= 1e24 ? `${(effPowerW * 1e-24).toFixed(1)} YW`
    : (effPowerW >= 1e18 ? `${(effPowerW * 1e-18).toFixed(1)} EW`
      : (effPowerW >= 1e12 ? `${(effPowerW * 1e-12).toFixed(1)} TW` : `${(effPowerW * 1e-9).toFixed(1)} GW`));
  return {
    energyJ,
    coupledEnergyJ,
    massRateKgS: mRate,
    powerW: effPowerW,
    tntTons,
    craterRadiusM,
    craterDepthM,
    gammaPeakKev: 511.0,
    plasmaTempK: 24000,
    reactionOutcome: `p̄+p / e⁺+e⁻ Annihilation: E=2mc² (${pLbl} · 511 keV γ + π± fireball)`
  };
}

// =========================================================================
// 3. 360-Degree Equatorial Saucer Rim Emission Point Solver
// =========================================================================
export function computeUfoRimEmitPoint(ufoPos, ufoRight, ufoFwd, rimRadius, targetPos) {
  const dx = targetPos[0] - ufoPos[0];
  const dy = targetPos[1] - ufoPos[1];
  const dz = targetPos[2] - ufoPos[2];
  // Project aim vector onto saucer's equatorial plane (uRight, uFwd)
  const rx = dx * ufoRight[0] + dy * ufoRight[1] + dz * ufoRight[2];
  const rz = dx * ufoFwd[0] + dy * ufoFwd[1] + dz * ufoFwd[2];
  const len = Math.hypot(rx, rz);
  const ux = len > 1e-4 ? rx / len : 0;
  const uz = len > 1e-4 ? rz / len : 1;
  return [
    ufoPos[0] + (ufoRight[0] * ux + ufoFwd[0] * uz) * rimRadius,
    ufoPos[1] + (ufoRight[1] * ux + ufoFwd[1] * uz) * rimRadius,
    ufoPos[2] + (ufoRight[2] * ux + ufoFwd[2] * uz) * rimRadius
  ];
}

// =========================================================================
// 4. Smooth 32-Segment Silver UFO + Translucent Glowing Green Glass Bubble
//    + Glowing Yellow Conical Tractor Beam + Volumetric 3D Beams Mesh Builder
// =========================================================================
function pushVert(out, p, n, tag, rgb, emissOrAlpha) {
  out.push(p[0], p[1], p[2], p[1], n[0], n[1], n[2], tag, rgb[0], rgb[1], rgb[2], emissOrAlpha);
}

export function pushFrustumMesh(out, center, axisDir, radA, radB, radiusBot, radiusTop, halfLen, sides, rgb, emissOrAlpha = 0.0, tag = 4.0, phaseRad = 0.0, capEnds = true) {
  const ptAt = (axOff, r, ang) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    return [
      center[0] + axisDir[0] * axOff + (radA[0] * ca + radB[0] * sa) * r,
      center[1] + axisDir[1] * axOff + (radA[1] * ca + radB[1] * sa) * r,
      center[2] + axisDir[2] * axOff + (radA[2] * ca + radB[2] * sa) * r
    ];
  };
  const cBot = [center[0] - axisDir[0] * halfLen, center[1] - axisDir[1] * halfLen, center[2] - axisDir[2] * halfLen];
  const cTop = [center[0] + axisDir[0] * halfLen, center[1] + axisDir[1] * halfLen, center[2] + axisDir[2] * halfLen];
  const nBot = [-axisDir[0], -axisDir[1], -axisDir[2]];
  const slope = (radiusBot - radiusTop) / Math.max(1e-4, 2.0 * halfLen);
  for (let s = 0; s < sides; s += 1) {
    const a0 = phaseRad + (s / sides) * Math.PI * 2;
    const a1 = phaseRad + ((s + 1) / sides) * Math.PI * 2;
    const c0 = Math.cos(a0); const s0 = Math.sin(a0);
    const c1 = Math.cos(a1); const s1 = Math.sin(a1);
    const n0 = normalize3([radA[0] * c0 + radB[0] * s0 + axisDir[0] * slope, radA[1] * c0 + radB[1] * s0 + axisDir[1] * slope, radA[2] * c0 + radB[2] * s0 + axisDir[2] * slope]);
    const n1 = normalize3([radA[0] * c1 + radB[0] * s1 + axisDir[0] * slope, radA[1] * c1 + radB[1] * s1 + axisDir[1] * slope, radA[2] * c1 + radB[2] * s1 + axisDir[2] * slope]);
    const b0 = ptAt(-halfLen, radiusBot, a0);
    const b1 = ptAt(-halfLen, radiusBot, a1);
    const t0 = ptAt(halfLen, radiusTop, a0);
    const t1 = ptAt(halfLen, radiusTop, a1);
    // Smooth Gouraud-interpolated normals across the 32-segment circular hull!
    pushVert(out, b0, n0, tag, rgb, emissOrAlpha);
    pushVert(out, b1, n1, tag, rgb, emissOrAlpha);
    pushVert(out, t1, n1, tag, rgb, emissOrAlpha);
    pushVert(out, b0, n0, tag, rgb, emissOrAlpha);
    pushVert(out, t1, n1, tag, rgb, emissOrAlpha);
    pushVert(out, t0, n0, tag, rgb, emissOrAlpha);
    if (capEnds) {
      if (radiusTop > 1e-4) {
        pushVert(out, cTop, axisDir, tag, rgb, emissOrAlpha);
        pushVert(out, t0, axisDir, tag, rgb, emissOrAlpha);
        pushVert(out, t1, axisDir, tag, rgb, emissOrAlpha);
      }
      if (radiusBot > 1e-4) {
        pushVert(out, cBot, nBot, tag, rgb, emissOrAlpha);
        pushVert(out, b1, nBot, tag, rgb, emissOrAlpha);
        pushVert(out, b0, nBot, tag, rgb, emissOrAlpha);
      }
    }
  }
}

export function pushBeamCylinder(out, pStart, pEnd, radius, rgb, alpha, sides = 10, tag = 6.0) {
  const dx = pEnd[0] - pStart[0];
  const dy = pEnd[1] - pStart[1];
  const dz = pEnd[2] - pStart[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  const ax = [dx / len, dy / len, dz / len];
  const upHint = Math.abs(ax[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
  const rA = normalize3(cross3(ax, upHint));
  const rB = normalize3(cross3(ax, rA));
  const mid = [(pStart[0] + pEnd[0]) * 0.5, (pStart[1] + pEnd[1]) * 0.5, (pStart[2] + pEnd[2]) * 0.5];
  pushFrustumMesh(out, mid, ax, rA, rB, radius, radius * 0.92, len * 0.5, sides, rgb, alpha, tag, 0, false);
}

/**
 * Build the iconic smooth 60-foot (`18.3 m` diameter) flying saucer with:
 *   - Smooth 32-segment revolved brushed silver-titanium double-convex disk hull
 *   - Glowing emerald-green translucent glass bubble dome (5-ring hemispherical revolution!)
 *   - Optional glowing yellow conical tractor beam beneath the craft
 *   - Optional rim-emitted EM Laser / Antimatter beam cylinder
 */
export function appendIconicUfoGeometry(opaqueOut, fxOut, {
  pos = [0, 0, 0],
  yaw = 0,
  pitch = 0,
  roll = 0,
  basisRight = null,
  basisUp = null,
  basisFwd = null,
  radius = UFO_RADIUS_M,
  rimAngle = 0,
  vertThrust = 0,
  tractorActive = false,
  tractorHeight = 24.0,
  tractorGroundPos = null,
  beam = null, // { targetPos, rgb, radius, isAntimatter }
  isCockpit = false,
  isRemote = false,
  shieldFlash = 0,
  curvFn = (p) => p
} = {}) {
  let uRight;
  let uUp;
  let uFwd;
  if (Array.isArray(basisRight) && Array.isArray(basisUp) && Array.isArray(basisFwd)) {
    uRight = normalize3(basisRight);
    uUp = normalize3(basisUp);
    uFwd = normalize3(basisFwd);
  } else {
    const cy = Math.cos(yaw); const sy = Math.sin(yaw);
    const cp = Math.cos(pitch); const sp = Math.sin(pitch);
    const cr = Math.cos(roll); const sr = Math.sin(roll);
    uFwd = normalize3([sy * cp, -sp, cy * cp]);
    const uRight0 = normalize3([cy, 0, -sy]);
    const uUp0 = normalize3(cross3(uFwd, uRight0));
    uRight = normalize3([uRight0[0] * cr + uUp0[0] * sr, uRight0[1] * cr + uUp0[1] * sr, uRight0[2] * cr + uUp0[2] * sr]);
    uUp = normalize3(cross3(uFwd, uRight));
  }

  const base = curvFn(pos);
  const s = radius / 9.15; // Normalize geometry proportions to true 60-foot (R=9.15 m) saucer!
  const pt = (rx, ry, rz) => [
    base[0] + uRight[0] * (rx * s) + uUp[0] * (ry * s) + uFwd[0] * (rz * s),
    base[1] + uRight[1] * (rx * s) + uUp[1] * (ry * s) + uFwd[1] * (rz * s),
    base[2] + uRight[2] * (rx * s) + uUp[2] * (ry * s) + uFwd[2] * (rz * s)
  ];

  const segs = 32;
  const hullBright = isRemote ? [0.80, 0.86, 0.96] : [0.88, 0.92, 0.96];
  const hullMid = isRemote ? [0.54, 0.62, 0.78] : [0.64, 0.70, 0.78];
  const hullDark = [0.18, 0.22, 0.28];
  const rimCol = isRemote
    ? [0.98, 0.56, 0.24]
    : (vertThrust > 0.15
      ? [0.24, 1.0, 0.64]
      : (vertThrust < -0.15 ? [1.0, 0.64, 0.22] : [0.28, 0.96, 0.58]));
  const rimEmiss = 1.25 + Math.abs(vertThrust) * 0.85;

  if (!isCockpit) {
    // 1. Iconic Smooth Double-Convex Flying Saucer Hull (7 smooth revolved profiles, 32 segments!)
    // Ventral glowing gravity/tractor aperture core
    pushFrustumMesh(opaqueOut, pt(0, -1.55, 0), uUp, uRight, uFwd, 2.2 * s, 3.1 * s, 0.22 * s, 24, tractorActive ? [1.0, 0.90, 0.25] : rimCol, tractorActive ? 2.2 : 1.4, 4.0, 0, true);
    // Lower smooth saucer belly (2 curved conic frustums)
    pushFrustumMesh(opaqueOut, pt(0, -1.10, 0), uUp, uRight, uFwd, 3.1 * s, 6.4 * s, 0.34 * s, segs, hullMid, 0.04, 4.0, 0, false);
    pushFrustumMesh(opaqueOut, pt(0, -0.48, 0), uUp, uRight, uFwd, 6.4 * s, 8.95 * s, 0.30 * s, segs, hullBright, 0.05, 4.0, 0, false);
    // Equatorial razor-smooth weapon & plasma emitter flange (R = 9.15 m => 60 ft diameter!)
    pushFrustumMesh(opaqueOut, pt(0, 0.0, 0), uUp, uRight, uFwd, 9.15 * s, 9.15 * s, 0.20 * s, segs, hullDark, 0.08, 4.0, 0, false);
    // Glowing continuous plasma accent strip embedded along the equatorial rim
    pushFrustumMesh(opaqueOut, pt(0, 0.0, 0), uUp, uRight, uFwd, 9.22 * s, 9.22 * s, 0.065 * s, segs, rimCol, rimEmiss, 4.0, rimAngle * 0.25, false);
    // Upper smooth aerodynamic metallic saucer deck (3 smooth revolved tiers)
    pushFrustumMesh(opaqueOut, pt(0, 0.48, 0), uUp, uRight, uFwd, 8.98 * s, 6.55 * s, 0.30 * s, segs, hullBright, 0.06, 4.0, 0, false);
    pushFrustumMesh(opaqueOut, pt(0, 1.05, 0), uUp, uRight, uFwd, 6.55 * s, 4.40 * s, 0.28 * s, segs, hullMid, 0.05, 4.0, 0, false);
    // Chrome cockpit collar ring
    pushFrustumMesh(opaqueOut, pt(0, 1.40, 0), uUp, uRight, uFwd, 4.45 * s, 4.18 * s, 0.14 * s, segs, hullDark, 0.08, 4.0, 0, true);
    // Subtle dark cockpit interior floor & pilot console visible THROUGH the glowing green glass bubble!
    pushFrustumMesh(opaqueOut, pt(0, 1.56, 0), uUp, uRight, uFwd, 3.6 * s, 3.2 * s, 0.08 * s, 20, [0.06, 0.14, 0.10], 0.15, 4.0, 0, true);
    pushFrustumMesh(opaqueOut, pt(0, 1.92, 1.4), uUp, uRight, uFwd, 1.2 * s, 0.9 * s, 0.24 * s, 12, [0.16, 0.95, 0.56], 0.85, 4.0, 0, true);

    // 2. Iconic Glowing Emerald-Green Translucent Glass Bubble Dome (5 smooth spherical latitude rings!)
    const domeR = 4.15 * s;
    const domeBaseY = 1.44;
    const domeRings = 5;
    const domeRgb = isRemote ? [0.22, 1.0, 0.62] : [0.14, 0.98, 0.44];
    for (let r = 0; r < domeRings; r += 1) {
      const phi0 = (r / domeRings) * (Math.PI * 0.485);
      const phi1 = ((r + 1) / domeRings) * (Math.PI * 0.485);
      const r0 = Math.cos(phi0) * domeR;
      const r1 = Math.cos(phi1) * domeR;
      const y0 = domeBaseY + (Math.sin(phi0) * domeR) / s * 0.78;
      const y1 = domeBaseY + (Math.sin(phi1) * domeR) / s * 0.78;
      const yc = 0.5 * (y0 + y1);
      const hLen = Math.max(0.02 * s, 0.5 * (y1 - y0) * s);
      pushFrustumMesh(fxOut, pt(0, yc, 0), uUp, uRight, uFwd, r0, r1, hLen, segs, domeRgb, 0.54, 5.0, 0, r === domeRings - 1);
    }
  } else {
    // True 3D Cockpit Interior View (inside the glowing emerald-green glass bubble looking out over the saucer nose!)
    // Solid continuous lower brushed-silver saucer nose deck (zero gap!) + glowing equatorial plasma edge
    pushFrustumMesh(opaqueOut, pt(0, 0.25, 0), uUp, uRight, uFwd, 9.10 * s, 4.10 * s, 0.35 * s, segs, hullMid, 0.04, 4.0, 0, true);
    pushFrustumMesh(opaqueOut, pt(0, -0.05, 0), uUp, uRight, uFwd, 9.25 * s, 9.25 * s, 0.09 * s, segs, rimCol, rimEmiss, 4.0, 0, false);
    // Sleek compact low-profile pilot instrument bezel + glowing holographic emerald dash arc at bottom edge
    pushFrustumMesh(opaqueOut, pt(0, 1.38, 3.65), uUp, uRight, uFwd, 1.15 * s, 0.90 * s, 0.14 * s, 20, [0.05, 0.14, 0.10], 0.25, 4.0, 0, true);
    pushFrustumMesh(fxOut, pt(0, 1.60, 3.85), uUp, uRight, uFwd, 1.24 * s, 1.16 * s, 0.035 * s, 20, [0.18, 1.0, 0.56], 0.58, 6.0, 0, false);
    // Curved glowing translucent emerald glass dome arch framing the upper periphery of the pilot's view
    pushFrustumMesh(fxOut, pt(0, 4.45, 0), uUp, uRight, uFwd, 4.15 * s, 1.65 * s, 0.45 * s, 28, [0.14, 0.98, 0.46], 0.30, 5.0, 0, true);
  }

  // 3. Glowing Yellow Conical Tractor Beam directly beneath the UFO!
  if (tractorActive && tractorHeight > 0.5) {
    const hBeam = Math.max(2.0, tractorHeight);
    const rTop = 2.15 * s;
    const rBot = Math.max(rTop * 1.45, Math.min(28.0 * s, rTop + hBeam * 0.28));
    const beamTop = pt(0, -1.60, 0);
    const beamBot = tractorGroundPos
      ? curvFn(tractorGroundPos)
      : [beamTop[0] - uUp[0] * hBeam, beamTop[1] - uUp[1] * hBeam, beamTop[2] - uUp[2] * hBeam];
    const axisV = [beamTop[0] - beamBot[0], beamTop[1] - beamBot[1], beamTop[2] - beamBot[2]];
    const axisLen = Math.hypot(axisV[0], axisV[1], axisV[2]) || hBeam;
    const axN = [axisV[0] / axisLen, axisV[1] / axisLen, axisV[2] / axisLen];
    const rA = normalize3(cross3(axN, Math.abs(axN[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]));
    const rB = normalize3(cross3(axN, rA));
    const mid = [(beamTop[0] + beamBot[0]) * 0.5, (beamTop[1] + beamBot[1]) * 0.5, (beamTop[2] + beamBot[2]) * 0.5];
    // Outer soft golden cone + brighter inner core cone + animated tractor pulse rings!
    pushFrustumMesh(fxOut, mid, axN, rA, rB, rBot, rTop, axisLen * 0.5, 24, [1.0, 0.88, 0.20], 0.34, 6.0, 0, false);
    pushFrustumMesh(fxOut, mid, axN, rA, rB, rBot * 0.52, rTop * 0.60, axisLen * 0.5, 18, [1.0, 0.96, 0.55], 0.42, 6.0, 0, false);
    for (let k = 0; k < 3; k += 1) {
      const f = ((rimAngle * 0.32 + k / 3) % 1 + 1) % 1;
      const rp = [beamBot[0] + axisV[0] * f, beamBot[1] + axisV[1] * f, beamBot[2] + axisV[2] * f];
      const rr = rBot * (1 - f) + rTop * f;
      pushFrustumMesh(fxOut, rp, axN, rA, rB, rr * 1.03, rr * 0.97, 0.25 * s, 20, [1.0, 0.94, 0.38], 0.56, 6.0, 0, false);
    }
  }

  // 4. 360-Degree Rim-Emitted EM Laser OR Antimatter Annihilation Beam!
  if (beam && Array.isArray(beam.targetPos)) {
    const emitPt = computeUfoRimEmitPoint(base, uRight, uFwd, 9.20 * s, curvFn(beam.targetPos));
    const tgtPt = curvFn(beam.targetPos);
    const col = beam.rgb || [0.22, 1.0, 0.45];
    const coreRad = (beam.isAntimatter ? 0.96 : 0.48) * s * (beam.thicknessMul || 1.0);
    // White-hot inner beam core + colored outer plasma sheath + glowing surface impact flare!
    pushBeamCylinder(fxOut, emitPt, tgtPt, coreRad * 0.50, [1.0, 0.98, 0.95], 0.96, 8, 6.0);
    pushBeamCylinder(fxOut, emitPt, tgtPt, coreRad * 1.65, col, beam.isAntimatter ? 0.72 : 0.58, 10, 6.0);
    const flareR = (beam.isAntimatter ? 6.8 : 3.6) * s;
    pushFrustumMesh(fxOut, [tgtPt[0], tgtPt[1] + 0.55 * s, tgtPt[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1], flareR, flareR * 0.15, 0.95 * s, 16, col, 0.62, 6.0, 0, true);
    pushFrustumMesh(fxOut, [tgtPt[0], tgtPt[1] + 0.35 * s, tgtPt[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1], flareR * 0.48, flareR * 0.08, 0.65 * s, 12, [1.0, 0.98, 0.90], 0.85, 6.0, 0, true);
    if (beam.isAntimatter) {
      // Secondary violet-magenta annihilation containment helix sheath!
      pushBeamCylinder(fxOut, emitPt, tgtPt, coreRad * 2.55, [0.85, 0.24, 1.0], 0.34, 10, 6.0);
    }
  }

  // 5. Optional Energy Shield Impact Ripple (when hit by a remote player's laser or missile!)
  if (shieldFlash > 0.02) {
    pushFrustumMesh(fxOut, pt(0, 0.5, 0), uUp, uRight, uFwd, 9.9 * s, 6.5 * s, 2.6 * s, 20, [0.30, 0.88, 1.0], clamp(shieldFlash * 0.55, 0, 0.55), 5.0, 0, true);
  }
}

export function appendMissileGeometry(opaqueOut, fxOut, missile, curvFn = (p) => p) {
  const s = Math.max(0.05, Number(missile.scale) || 1.0);
  const p = curvFn(missile.pos);
  const vel = missile.vel || [0, 0, 1];
  const dir = normalize3(vel);
  const rA = normalize3(cross3(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const rB = normalize3(cross3(dir, rA));
  // Sleek white-titanium missile body + crimson warhead nosecone + blazing rocket exhaust cone
  pushFrustumMesh(opaqueOut, p, dir, rA, rB, 0.28 * s, 0.28 * s, 1.15 * s, 8, [0.88, 0.92, 0.96], 0.08, 4.0, 0, true);
  const nose = [p[0] + dir[0] * 1.55 * s, p[1] + dir[1] * 1.55 * s, p[2] + dir[2] * 1.55 * s];
  pushFrustumMesh(opaqueOut, nose, dir, rA, rB, 0.28 * s, 0.04 * s, 0.45 * s, 8, [1.0, 0.28, 0.16], 0.45, 4.0, 0, true);
  const tail = [p[0] - dir[0] * 2.4 * s, p[1] - dir[1] * 2.4 * s, p[2] - dir[2] * 2.4 * s];
  pushBeamCylinder(fxOut, p, tail, 0.42 * s, [1.0, 0.68, 0.18], 0.78, 6, 6.0);
}

export function appendVonNeumannProbeGeometry(opaqueOut, fxOut, pos, phase, scale = 1.0) {
  const up = [0, 1, 0];
  const rA = [Math.cos(phase), 0, Math.sin(phase)];
  const rB = [-Math.sin(phase), 0, Math.cos(phase)];
  pushFrustumMesh(opaqueOut, pos, up, rA, rB, 0.35 * scale, 0.18 * scale, 0.14 * scale, 8, [0.96, 0.78, 0.24], 0.35, 4.0, phase, true);
  pushFrustumMesh(fxOut, [pos[0], pos[1] + 0.18 * scale, pos[2]], up, rA, rB, 0.22 * scale, 0.04 * scale, 0.12 * scale, 8, [0.22, 1.0, 0.56], 0.62, 5.0, phase, true);
}
