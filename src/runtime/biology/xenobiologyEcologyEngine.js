// First-Principles Astrobiology, Procedural Xenobiology & Ecosystem Clade Engine
// (`planetary-xenobiology-ecology@1`, `src/runtime/biology/xenobiologyEcologyEngine.js`).
//
// Grounded in 2024-2025 peer-reviewed astrobiology & evolutionary biomechanics:
//   - Bains, Petkowski & Seager (2024): 4-criterion alternative solvent classifier
//     (H2O, liquid/supercritical CO2, NH3-H2O, CH4/C2H6 with 2024 cryomineral/cocrystal
//     compartmentalization caution, concentrated H2SO4 cloud aerosols, subsurface
//     hydrothermal H2O brine, and gas-giant H2/He baroclinic cloud-deck aerial niches).
//   - Kiang / Lehmer / Schwieterman / Takizawa spectral photobiology: stellar Planck
//     photon flux x atmospheric H2O/CO2/CH4/Rayleigh windows -> 2/3/4-photon Z-scheme,
//     Vegetation Red/NIR Edge lambda_edge(T_eff), canopy pigments & UV radiotrophy.
//   - Thermodynamic redox bioenergetics (Delta G kJ/mol e-) + NutMEG maintenance-vs-growth
//     biomass scaling + agnostic atmospheric chemical disequilibrium biosignatures.
//   - Expanded 4-12 letter XNA genetic polymers + Eigen error threshold mu_crit = ln(s)/L
//     coupled to stellar UV/cosmic-ray flux + biomineral skeletal selection.
//   - Evolutionary biomechanics & allometry: Kleiber M^0.75 * Q10^((T-Tref)/10),
//     Euler buckling H ~ (E / (rho g))^(1/3), Bergmann/Allen thermal scaling,
//     Reynolds Re & Strouhal St in [0.2, 0.4], Lindeman ~10% trophic food-web pyramid.
//
// Strictly Star Spec v0.4 compliant: ZERO hardcoded planet-name or species-name hacks!

import {
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../sph/lawAdapterContract.js';
import { ULG_ACCURACY_TIERS } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';
import { resolveSolventThermodynamics } from '../material/canonicalMaterialLookup.js';
import { buildDevelopmentalGenome } from './developmentalGenome.js';

export const ULG_XENOBIOLOGY_ECOLOGY_SCHEMA = 'ulg.biology.xenobiology-ecology.v2';

export const XENOBIOLOGY_ECOLOGY_LAW_ADAPTER = Object.freeze({
  id: 'planetary-xenobiology-ecology',
  lawNodeId: 'law:biology-planetary-xenobiology-ecology',
  orderConstraint: 'after:planetary-atmosphere-3d-cfd',
  adapterMode: LAW_ADAPTER_MODES.SURFACE_INTERFACE,
  spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
  reads: Object.freeze(['planetary-body-state', 'planetary-atmo-3d-cfd-grid', 'stellar-flux-spectrum']),
  writes: Object.freeze(['biosphere-clade-web', 'surface-flora-instances', 'vivarium-specimen-state']),
  accumulates: Object.freeze(['biosignature-disequilibrium', 'trophic-biomass-ledger']),
  pairedVolumeState: 'not-applicable',
  conservedQuantities: Object.freeze(['trophic-energy-flux', 'redox-electron-balance', 'biopolymer-monomer-stoichiometry']),
  validityDomain: Object.freeze({ tempMinK: 75, tempMaxK: 760, requiresSolventOrCloudDeck: true }),
  fallbackPolicy: LAW_FALLBACK_POLICIES.EXACT_SUBSTEP,
  scaleRangeM: Object.freeze([1e-9, 1e7]),
  fundamentalLaws: Object.freeze([
    'bains-petkowski-seager-solvent-thermodynamics',
    'kiang-lehmer-multiphoton-photobiology',
    'redox-gibbs-bioenergetics-nutmeg',
    'eigen-xna-error-threshold',
    'kleiber-euler-bergmann-allen-allometry',
    'lindeman-trophic-food-web'
  ])
});

export function evaluateXenobiologyEcologyActivation(physicalState = {}) {
  const T = Number(physicalState.surfaceTempK ?? physicalState.tempK) || 0;
  const P = Number(physicalState.surfacePressurePa ?? physicalState.pressurePa) || 0;
  const hasSolid = physicalState.hasSolidCrust !== false;
  const isCryo = Boolean(physicalState.isCryoMoon);
  const isMagma = Boolean(physicalState.isMagmaOcean) || T > 1100;
  const viable = !isMagma && (
    (!hasSolid && P >= 1e4 && T >= 70 && T <= 520)
    || isCryo
    || (P >= 500 && T >= 78 && T <= 760)
  );
  return {
    active: viable,
    reason: viable ? 'thermodynamic-solvent-or-cloud-niche-present' : 'sterile-vacuum-or-magma-dormant'
  };
}

export function registerXenobiologyEcologyModule(registry) {
  if (!registry || typeof registry.registerModule !== 'function') return null;
  if (registry.hasModule?.('planetary-xenobiology-ecology@1')) {
    return registry.resolveModule('planetary-xenobiology-ecology@1')?.descriptor || null;
  }
  return registry.registerModule({
    method: { model: 'planetary-xenobiology-ecology', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/biology/xenobiologyEcologyEngine.js',
      entryPoint: 'synthesizeWorldEcosystem',
      workgroupSize: 64
    },
    parameterSchema: {
      tempK: { type: 'number', min: 70, max: 760, required: false },
      pressurePa: { type: 'number', min: 0, max: 1e8, required: false }
    },
    stateLayout: {
      tensorId: 'xenobiology-ecosystem-clade-web',
      dtype: 'f32',
      layout: 'interleaved',
      strideElements: 4,
      strideBytes: 16,
      fields: ['viability', 'deltaGKjMol', 'bucklingHeight', 'biolumIntensity']
    },
    scaleRangeM: [1e-9, 1e7],
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    lawAdapter: XENOBIOLOGY_ECOLOGY_LAW_ADAPTER,
    async stepCapsule(capsule, { createSimulationArtifact }) {
      const p = capsule.input?.parameters || {};
      const eco = synthesizeWorldEcosystem({
        tempK: Number(p.tempK ?? 288),
        pressurePa: Number(p.pressurePa ?? 101325)
      });
      return createSimulationArtifact?.({ schema: ULG_XENOBIOLOGY_ECOLOGY_SCHEMA, ecosystem: eco }) ?? eco;
    }
  });
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function mixRgb(a, b, t) {
  const f = clamp(t, 0, 1);
  return [
    clamp(a[0] + (b[0] - a[0]) * f, 0, 1),
    clamp(a[1] + (b[1] - a[1]) * f, 0, 1),
    clamp(a[2] + (b[2] - a[2]) * f, 0, 1)
  ];
}

function hashU32(seed) {
  let x = (seed >>> 0) || 1;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function mulberry32(seed) {
  let a = hashU32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =========================================================================
// 1. Bains, Petkowski & Seager (2024) 7-Solvent Framework
// =========================================================================

export function classifySolventBains2024({
  tempK = 288,
  pressurePa = 101325,
  volatileFrac = 0.04,
  hasSolidCrust = true,
  isCryoMoon = false,
  isMagmaOcean = false,
  cToO = 0.55
} = {}) {
  const T = Number(tempK) || 288;
  const P = Math.max(0, Number(pressurePa) || 0);
  const v = Math.max(0, Number(volatileFrac) || 0);

  if (isMagmaOcean || T > 950) {
    return Object.freeze({
      solvent: 'none',
      formula: 'None',
      label: 'Anhydrous Silicate-Melt / Sterile',
      bainsScore: 0.0,
      dielectricEr: 12.0,
      tMeltK: 1400.0,
      tBoilK: 2800.0,
      tDenatureK: 1200.0,
      oceanRgb: [0.22, 0.08, 0.04],
      membraneType: 'None',
      compartmentModel: 'none',
      hydrophobicCoupling: 0.0,
      hBondStrength: 0.5,
      deltaPh: 0.0,
      strongPairFraction: 0.5,
      xnaBackbone: 'None',
      xnaAlphabetSize: 0,
      sequence: 'HPPHH+PHHPPHH-PP'
    });
  }

  // Gas / Ice Giant Baroclinic Cloud-Deck Aerial Biosphere (H2/He + H2O/NH3 condensate deck)
  if (!hasSolidCrust && P >= 1e4 && T >= 45 && T <= 520) {
    return Object.freeze({
      solvent: 'H2-He-cloud',
      formula: 'H₂/He + H₂O/NH₃ Aerosols',
      label: 'Baroclinic Cloud-Deck Aerosol Biosphere (2–6 bar)',
      isCloudDeckHabitat: true,
      habitatAltitudeKm: 45,
      bainsScore: 0.58,
      dielectricEr: 54.0,
      tMeltK: 210.0,
      tBoilK: 345.0,
      tDenatureK: 395.0,
      oceanRgb: [0.54, 0.42, 0.28],
      membraneType: 'Buoyant Amphoteric Lipid-Aerosol Vesicle',
      compartmentModel: 'aerosol-droplet-and-gas-sac',
      hydrophobicCoupling: 1.72,
      hBondStrength: 1.38,
      deltaPh: 1.15,
      strongPairFraction: 0.58,
      xnaBackbone: 'Phosphoramidate-RNA (Aerosol)',
      xnaAlphabetSize: 6,
      sequence: 'HPHH+PPHH-PHPHH+PPHH-PHPHH+PPH-H'
    });
  }

  // Liquid / Supercritical CO2 (Bains+ 2024 high-scoring non-protonating solvent on dry high-P worlds,
  // covering BOTH liquid CO2 >= 5.2 bar and supercritical scCO2 above 7.38 MPa / 304.1 K!)
  if (hasSolidCrust && P >= 5.2e5 && T >= 216 && T <= 360 && v < 0.012) {
    const co2Thermo = resolveSolventThermodynamics('CO2', T, P);
    return Object.freeze({
      solvent: 'CO2-liq',
      formula: 'scCO₂',
      label: 'Liquid / Supercritical CO₂ Solvent',
      bainsScore: 0.71,
      dielectricEr: co2Thermo.dielectricEr,
      tMeltK: co2Thermo.tMeltK,
      tBoilK: co2Thermo.tBoilK,
      viscosityPaS: co2Thermo.viscosityPaS,
      densityKgM3: co2Thermo.densityKgM3,
      tDenatureK: 410.0,
      oceanRgb: [0.34, 0.44, 0.42],
      membraneType: 'Siloxane-Fluorocarbon Amphiphile Envelope',
      compartmentModel: 'nonpolar-siloxane-bilayer',
      hydrophobicCoupling: 1.35,
      hBondStrength: 1.18,
      deltaPh: 0.65,
      strongPairFraction: 0.54,
      xnaBackbone: 'Peptide Nucleic Acid (PNA, Uncharged)',
      xnaAlphabetSize: 8,
      sequence: 'HH+P-HH+P-HPHH+P-HH+P-HPHH+P-HH'
    });
  }

  // Liquid Water (Aqueous — checked BEFORE H2SO4 cloud decks using canonical ULG Clausius-Clapeyron T_boil(P),
  // while desiccated super-greenhouse worlds with P >= 50 bar & scarce water v <= 0.035 fall through to H2SO4 cloud decks!)
  const h2oThermo = resolveSolventThermodynamics('H2O', T, P);
  const tBoilWaterK = h2oThermo.tBoilK;
  const isDesiccatedSuperGreenhouse = P >= 5.0e6 && v <= 0.035;
  if (hasSolidCrust && !isDesiccatedSuperGreenhouse && P >= 611 && T >= 255 && T <= tBoilWaterK && v >= 0.012) {
    return Object.freeze({
      solvent: 'H2O',
      formula: 'H₂O',
      label: 'Liquid Water (Aqueous)',
      isCloudDeckHabitat: false,
      habitatAltitudeKm: 0,
      bainsScore: 0.96,
      dielectricEr: h2oThermo.dielectricEr,
      tMeltK: h2oThermo.tMeltK,
      tBoilK: h2oThermo.tBoilK,
      viscosityPaS: h2oThermo.viscosityPaS,
      densityKgM3: h2oThermo.densityKgM3,
      tDenatureK: 355.0 + Math.max(0, (T - 295) * 0.65),
      oceanRgb: [0.04, 0.24, 0.48],
      membraneType: 'Phospholipid Bilayer',
      compartmentModel: 'fluid-phospholipid-bilayer',
      hydrophobicCoupling: 1.85,
      hBondStrength: 1.45,
      deltaPh: 1.0,
      strongPairFraction: 0.52,
      xnaBackbone: cToO > 0.75 ? 'Threose Nucleic Acid (TNA)' : 'Deoxyribo/Ribo-Nucleic Acid (DNA/RNA)',
      xnaAlphabetSize: cToO > 0.75 ? 6 : 4,
      sequence: 'HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH'
    });
  }

  // Concentrated H2SO4 Cloud Aerosols (Bains, Petkowski & Seager 2024: elevated 50 km cloud deck — NEVER a 737 K surface ocean!)
  if ((P >= 2.5e6 && T >= 295 && T <= 760) || (P >= 5e5 && T > tBoilWaterK && T <= 760)) {
    const h2so4Thermo = resolveSolventThermodynamics('H2SO4', Math.min(340, T), Math.min(2e5, P));
    return Object.freeze({
      solvent: 'H2SO4',
      formula: 'H₂SO₄',
      label: 'Sulfuric Acid Cloud Aerosols (50 km Deck)',
      isCloudDeckHabitat: true,
      habitatAltitudeKm: 50,
      bainsScore: 0.62,
      dielectricEr: h2so4Thermo.dielectricEr,
      tMeltK: h2so4Thermo.tMeltK,
      tBoilK: h2so4Thermo.tBoilK,
      viscosityPaS: h2so4Thermo.viscosityPaS,
      densityKgM3: h2so4Thermo.densityKgM3,
      tDenatureK: 475.0,
      oceanRgb: [0.64, 0.56, 0.24],
      membraneType: 'Sulfonated Aromatic Acidophile Vesicle',
      compartmentModel: 'acid-resistant-sulfonated-bilayer',
      hydrophobicCoupling: 2.20,
      hBondStrength: 1.65,
      deltaPh: 2.35,
      strongPairFraction: 0.82,
      xnaBackbone: 'Sulfonated Aromatic XNA (Acid-Stable)',
      xnaAlphabetSize: 6,
      sequence: 'HHH+PP-HHH+PP-HHHH+PP-HHH+PP-HHH'
    });
  }

  // Cryogenic Liquid Methane / Ethane (pressure-dependent T_boil(P) + 2024 acrylonitrile cocrystal/cryomineral findings!)
  const ch4Thermo = resolveSolventThermodynamics('CH4', T, P);
  if (hasSolidCrust && P >= 1.2e4 && T >= 82 && T <= Math.max(124, ch4Thermo.tBoilK)) {
    return Object.freeze({
      solvent: 'CH4',
      formula: 'CH₄/C₂H₆',
      label: 'Cryogenic Liquid Methane / Ethane',
      bainsScore: 0.44,
      dielectricEr: ch4Thermo.dielectricEr,
      tMeltK: ch4Thermo.tMeltK,
      tBoilK: ch4Thermo.tBoilK,
      viscosityPaS: ch4Thermo.viscosityPaS,
      densityKgM3: ch4Thermo.densityKgM3,
      tDenatureK: 148.0,
      oceanRgb: [0.18, 0.16, 0.10],
      membraneType: 'Cryomineral-Pore / Reverse-Amphiphile Shell (2024 Azoto-Cocrystal Caution)',
      compartmentModel: 'cryomineral-pore-and-reverse-amphiphile',
      hydrophobicCoupling: 1.18,
      hBondStrength: 1.10,
      deltaPh: 0.45,
      strongPairFraction: 0.36,
      xnaBackbone: 'Cryo-Nitrile Polyether Oligomer',
      xnaAlphabetSize: 6,
      sequence: '+P-P+P-PHHP+P-P+P-PHHP+P-P+P-P'
    });
  }

  // Liquid Ammonia-Water Eutectic (pressure-dependent Clausius-Clapeyron T_boil(P))
  const nh3Thermo = resolveSolventThermodynamics('NH3', T, P);
  if (hasSolidCrust && P >= 5e3 && T >= 190 && T <= Math.max(258, nh3Thermo.tBoilK) && v >= 0.008) {
    return Object.freeze({
      solvent: 'NH3',
      formula: 'NH₃',
      label: 'Liquid Ammonia–Water Eutectic',
      bainsScore: 0.68,
      dielectricEr: nh3Thermo.dielectricEr,
      tMeltK: nh3Thermo.tMeltK,
      tBoilK: nh3Thermo.tBoilK,
      viscosityPaS: nh3Thermo.viscosityPaS,
      densityKgM3: nh3Thermo.densityKgM3,
      tDenatureK: 295.0,
      oceanRgb: [0.14, 0.26, 0.34],
      membraneType: 'Ammonophilic Reverse-Ether Amphiphile',
      compartmentModel: 'ammonophilic-bilayer',
      hydrophobicCoupling: 1.38,
      hBondStrength: 1.25,
      deltaPh: 0.85,
      strongPairFraction: 0.48,
      xnaBackbone: 'Hexose Nucleic Acid (HNA)',
      xnaAlphabetSize: 8,
      sequence: 'HPH+PHH-PHPHH+PH-PHPHH+PH-PHPH'
    });
  }

  // Subsurface Hydrothermal Brine Ocean (Icy Moons)
  if (isCryoMoon || (hasSolidCrust && T >= 75 && T <= 180 && v >= 0.02)) {
    const subH2o = resolveSolventThermodynamics('H2O', 278, Math.max(5e6, P));
    return Object.freeze({
      solvent: 'H2O-subsurface',
      formula: 'H₂O (Subsurface)',
      label: 'Subsurface Hydrothermal Brine Ocean',
      bainsScore: 0.78,
      dielectricEr: subH2o.dielectricEr,
      tMeltK: subH2o.tMeltK,
      tBoilK: subH2o.tBoilK,
      viscosityPaS: subH2o.viscosityPaS,
      densityKgM3: subH2o.densityKgM3,
      tDenatureK: 395.0,
      oceanRgb: [0.06, 0.34, 0.56],
      membraneType: 'Tetraether-Lipid Barophile Monolayer',
      compartmentModel: 'barophilic-tetraether-monolayer',
      hydrophobicCoupling: 2.05,
      hBondStrength: 1.55,
      deltaPh: 1.65,
      strongPairFraction: 0.68,
      xnaBackbone: 'Piezophilic Archaeal RNA/DNA',
      xnaAlphabetSize: 6,
      sequence: 'HHP+HHP-HHHP+HHP-HHHP+HHP-HHP+'
    });
  }

  return Object.freeze({
    solvent: 'none',
    formula: 'None',
    label: 'Anhydrous / Sterile Regime',
    bainsScore: 0.0,
    dielectricEr: 78.4,
    tMeltK: 273.15,
    tBoilK: 373.15,
    tDenatureK: 350.0,
    oceanRgb: [0.08, 0.14, 0.22],
    membraneType: 'None',
    compartmentModel: 'none',
    hydrophobicCoupling: 0.0,
    hBondStrength: 0.6,
    deltaPh: 0.0,
    strongPairFraction: 0.5,
    xnaBackbone: 'None',
    xnaAlphabetSize: 0,
    sequence: 'HPPHH+PHHPPHH-PP'
  });
}

// =========================================================================
// 2. Kiang / Lehmer / Schwieterman / Takizawa Spectral Photobiology Solver
// =========================================================================

export function solvePhotobiologySpectrum({
  stellarTeffK = 5778,
  solvent = 'H2O',
  pressurePa = 101325,
  uvFluxNorm = 1.0
} = {}) {
  const T = clamp(Number(stellarTeffK) || 5778, 2400, 14000);
  const P = Math.max(0, Number(pressurePa) || 0);
  const uv = clamp(Number(uvFluxNorm) || 1.0, 0.02, 10.0);

  // Sample 23 wavelengths from 300 nm to 1400 nm (50 nm steps):
  // Planck photon flux N_gamma(lam, T) ~ lam^-4 / (exp(hc / (lam k_B T)) - 1)
  // attenuated by atmospheric Rayleigh scattering (~ lam^-4 * P) and H2O/CO2/CH4 NIR bands!
  const hcOverKbNmK = 1.4387768e7;
  const atmoBar = clamp(P / 101325, 0, 5.0);
  const samples = [];
  let maxFlux = 1e-12;
  let peakLamNm = 550;

  for (let lam = 300; lam <= 1400; lam += 50) {
    const x = clamp(hcOverKbNmK / (lam * T), 0.05, 60.0);
    const planckPhotons = Math.pow(550 / lam, 4) / Math.max(1e-6, Math.exp(x) - 1.0);
    const rayleighTau = 0.08 * Math.min(3.5, atmoBar) * Math.pow(550 / lam, 4);
    // Atmospheric H2O (940 nm, 1130 nm, 1380 nm) and CH4/CO2 (890 nm, 1150 nm) absorption bands
    const h2oBand = (solvent === 'H2O' || solvent === 'H2-He-cloud')
      ? (0.45 * Math.exp(-Math.pow((lam - 940) / 38, 2))
        + 0.72 * Math.exp(-Math.pow((lam - 1135) / 48, 2))
        + 0.88 * Math.exp(-Math.pow((lam - 1380) / 55, 2)))
      : 0.0;
    const ch4Band = (solvent === 'CH4' || solvent === 'H2-He-cloud')
      ? (0.68 * Math.exp(-Math.pow((lam - 890) / 45, 2))
        + 0.76 * Math.exp(-Math.pow((lam - 1150) / 60, 2)))
      : 0.0;
    const trans = Math.exp(-rayleighTau - (h2oBand + ch4Band) * clamp(0.3 + atmoBar * 0.45, 0.2, 1.4));
    const flux = planckPhotons * trans;
    if (flux > maxFlux) {
      maxFlux = flux;
      peakLamNm = lam;
    }
    samples.push({ lamNm: lam, flux, trans });
  }

  // Compute integrated 23-band photon-weighted spectral moments directly from the transmitted surface spectrum:
  //   - meanLamNm: continuous photon-flux centroid (immune to 50-nm bin quantization plateaus!)
  //   - meanPhotonEv: mean incident photon energy <hc / lambda>
  let sumFlux = 0;
  let sumLamFlux = 0;
  let sumEvFlux = 0;
  for (const s of samples) {
    sumFlux += s.flux;
    sumLamFlux += s.lamNm * s.flux;
    sumEvFlux += (1239.84 / s.lamNm) * s.flux;
  }
  const meanLamNm = sumFlux > 1e-12 ? (sumLamFlux / sumFlux) : peakLamNm;
  const meanPhotonEv = sumFlux > 1e-12 ? (sumEvFlux / sumFlux) : (1239.84 / Math.max(300, peakLamNm));

  // Optimal Z-scheme photon count & red edge driven continuously from the ACTUAL 23-band integrated
  // surface spectrum (Takizawa 2017 / Lehmer 2018 / Kiang 2007):
  //   After ~0.63 eV per-photosystem Stokes + charge-separation thermalization loss, n photons must clear
  //   the ~1.86 eV net electrochemical free-energy barrier of oxygenic water splitting!
  let zSchemePhotons = clamp(Math.ceil(1.86 / Math.max(0.32, meanPhotonEv - 0.63)), 2, 4);
  let redEdgeNm = Math.round(clamp(0.55 * peakLamNm + 0.45 * meanLamNm, 560, 1280));
  let pigmentClass = `${zSchemePhotons}-Photon Photopigment (λ_peak=${peakLamNm} nm)`;
  // Continuous complementary reflectance from integrated surface spectrum
  const lamNorm = clamp((meanLamNm - 680) / 420, 0, 1);
  let primaryRgb = [
    Number(clamp(0.16 + 0.44 * Math.sin(lamNorm * Math.PI) - 0.24 * Math.max(0, lamNorm - 0.65), 0.08, 0.85).toFixed(3)),
    Number(clamp(0.60 * Math.exp(-Math.pow((meanLamNm - 815) / 145, 2)) + 0.08, 0.07, 0.72).toFixed(3)),
    Number(clamp(0.56 * Math.exp(-Math.pow((meanLamNm - 690) / 120, 2)) + 0.12, 0.08, 0.78).toFixed(3))
  ];
  let secondaryRgb = [
    Number(clamp(primaryRgb[0] * 1.18 + 0.08, 0.08, 0.92).toFixed(3)),
    Number(clamp(primaryRgb[1] * 1.12 + 0.04, 0.08, 0.88).toFixed(3)),
    Number(clamp(primaryRgb[2] * 0.92 + 0.04, 0.08, 0.86).toFixed(3))
  ];

  if (solvent === 'CH4') {
    zSchemePhotons = Math.max(2, zSchemePhotons);
    redEdgeNm = Math.max(880, redEdgeNm);
    pigmentClass = `Tholin-Polyacetylene Photopigment (λ_peak=${peakLamNm} nm, Cryo-Catalytic)`;
    primaryRgb = [0.58, 0.36, 0.72];
    secondaryRgb = [0.76, 0.48, 0.34];
  } else if (solvent === 'NH3') {
    zSchemePhotons = Math.max(2, zSchemePhotons);
    redEdgeNm = Math.round(clamp(redEdgeNm * 1.06, 720, 1180));
    pigmentClass = `Ammono-Bacteriochlorophyll Teal Complex (λ_peak=${peakLamNm} nm)`;
    primaryRgb = [0.20, 0.62, 0.58];
    secondaryRgb = [0.14, 0.46, 0.68];
  } else if (solvent === 'H2SO4') {
    zSchemePhotons = 2;
    redEdgeNm = Math.round(clamp(redEdgeNm * 0.96, 620, 920));
    pigmentClass = `Sulfur-Carotenoid Acidophile Photopigment (λ_peak=${peakLamNm} nm)`;
    primaryRgb = [0.78, 0.64, 0.20];
    secondaryRgb = [0.88, 0.46, 0.16];
  } else if (solvent === 'CO2-liq') {
    zSchemePhotons = Math.max(2, zSchemePhotons);
    redEdgeNm = Math.round(clamp(redEdgeNm * 1.03, 680, 1140));
    pigmentClass = `Carboxy-Porphyrin Bronze-Teal Photopigment (λ_peak=${peakLamNm} nm)`;
    primaryRgb = [0.54, 0.48, 0.26];
    secondaryRgb = [0.28, 0.56, 0.44];
  } else if (solvent === 'H2O-subsurface') {
    zSchemePhotons = 0;
    redEdgeNm = 1180;
    pigmentClass = 'Hydrothermal IR-Thermotaxis & Chemosynthetic Cytochrome';
    primaryRgb = [0.22, 0.74, 0.86];
    secondaryRgb = [0.82, 0.42, 0.22];
  } else if (solvent === 'H2-He-cloud') {
    zSchemePhotons = Math.max(2, zSchemePhotons);
    redEdgeNm = Math.round(clamp(redEdgeNm * 1.02, 680, 1120));
    pigmentClass = `Baroclinic Cloud-Deck Phycobilin & Carotenoid (λ_peak=${peakLamNm} nm)`;
    primaryRgb = [0.84, 0.48, 0.26];
    secondaryRgb = [0.46, 0.68, 0.86];
  } else if (meanLamNm >= 960) {
    pigmentClass = `${zSchemePhotons}-Photon NIR Melanoid / Bacteriochlorophyll-f (λ_peak=${peakLamNm} nm)`;
    const f = clamp((1080 - meanLamNm) / 140, 0, 1);
    primaryRgb = [0.24 + 0.22 * f, 0.08 + 0.08 * f, 0.12 + 0.04 * f];
    secondaryRgb = [0.42 + 0.18 * f, 0.14 + 0.10 * f, 0.16];
  } else if (meanLamNm >= 865) {
    pigmentClass = `${zSchemePhotons}-Photon K-Dwarf Phycobilin / Vermilion-Olive (λ_peak=${peakLamNm} nm)`;
    const f = clamp((960 - meanLamNm) / 95, 0, 1);
    primaryRgb = [0.58 - 0.34 * f, 0.24 + 0.28 * f, 0.12 + 0.08 * f];
    secondaryRgb = [0.76 - 0.28 * f, 0.40 + 0.20 * f, 0.14];
  } else if (meanLamNm >= 765) {
    pigmentClass = `2-Photon Chlorophyll-a/b + Carotenoid (λ_peak=${peakLamNm} nm)`;
    const f = clamp((865 - meanLamNm) / 100, 0, 1);
    primaryRgb = [0.14 + 0.08 * (1 - f), 0.48 + 0.10 * f, 0.18 + 0.12 * f];
    secondaryRgb = [0.24, 0.62, 0.26];
  } else {
    pigmentClass = `UV-Shielded Violaxanthin / Radiotrophic Melanin-Cyan (λ_peak=${peakLamNm} nm)`;
    const f = clamp((765 - meanLamNm) / 120, 0, 1);
    primaryRgb = [0.20 + 0.28 * f, 0.44 - 0.12 * f, 0.58 + 0.28 * f];
    secondaryRgb = [0.48 + 0.24 * f, 0.28, 0.78];
  }

  const uvRadiotrophyActive = uv >= 2.2;
  const spectralCurve = samples.map((s) => {
    const fluxNorm = s.flux / maxFlux;
    // Pigment absorbs strongly shortward of redEdgeNm (minus reflectance notch)
    const absorb = zSchemePhotons === 0
      ? Math.exp(-Math.pow((s.lamNm - 1100) / 240, 2)) * 0.65
      : clamp(1.0 / (1.0 + Math.exp((s.lamNm - redEdgeNm) / 28.0)), 0.04, 0.96);
    return Object.freeze({
      lamNm: s.lamNm,
      fluxNorm: Number(fluxNorm.toFixed(3)),
      trans: Number(s.trans.toFixed(3)),
      absorb: Number(absorb.toFixed(3))
    });
  });

  return Object.freeze({
    stellarTeffK: Math.round(T),
    surfacePeakLamNm: peakLamNm,
    zSchemePhotons,
    redEdgeNm,
    pigmentClass,
    uvRadiotrophyActive,
    primaryRgb: Object.freeze(primaryRgb),
    secondaryRgb: Object.freeze(secondaryRgb),
    spectralCurve: Object.freeze(spectralCurve)
  });
}

// =========================================================================
// 3. Thermodynamic Redox Bioenergetics + NutMEG Scaling + Biosignatures
// =========================================================================

export function deriveRedoxAndBiosignatures({
  solvent = 'H2O',
  tempK = 288,
  pressurePa = 101325,
  uvFluxNorm = 1.0,
  stellarTeffK = 5778
} = {}) {
  const T = clamp(Number(tempK) || 288, 75, 760);
  let metabolicPathway = 'Oxygenic Photosynthesis (H₂O + CO₂ → CH₂O + O₂)';
  let deltaGKjMol = -478.0; // Free energy yield per mol O2/C respired (aerobic)
  let electronDonor = 'H₂O';
  let electronAcceptor = 'CO₂ / O₂';
  let biosignatures = ['O₂ + CH₄ Disequilibrium', 'N₂O Biogenic Flux', 'Vegetation Red Edge'];
  let disequilibriumScore = 0.92;

  if (solvent === 'CH4') {
    metabolicPathway = 'Cryo-Acetylene Hydrogenation (C₂H₂ + 3H₂ → 2CH₄)';
    deltaGKjMol = -311.0;
    electronDonor = 'H₂ (Atmospheric)';
    electronAcceptor = 'C₂H₂ / Photochemical Tholins';
    biosignatures = ['Surface C₂H₂ Catalytic Depletion', 'H₂ Boundary-Layer Sink', 'Tholin Isotopic Fractionation'];
    disequilibriumScore = 0.64;
  } else if (solvent === 'NH3') {
    metabolicPathway = 'Ammonophilic Methanotrophy & Hydrazine Redox';
    deltaGKjMol = -184.0;
    electronDonor = 'NH₃ / H₂';
    electronAcceptor = 'CO / NOₓ';
    biosignatures = ['NH₃ + CO Coexistence Disequilibrium', 'Organo-Amine Aerosol Excess'];
    disequilibriumScore = 0.68;
  } else if (solvent === 'H2SO4') {
    metabolicPathway = 'Acidophilic Sulfur-Iron Phototrophy (H₂S / S⁰ / Fe²⁺)';
    deltaGKjMol = -212.0;
    electronDonor = 'H₂S / SO₂ / Fe²⁺';
    electronAcceptor = 'H₂SO₄ / CO₂';
    biosignatures = ['PH₃ + SO₂ Cloud-Deck Anomaly', 'Mid-UV Absorber Band (360 nm)', 'H₂SO₄ Redox Gradient'];
    disequilibriumScore = 0.61;
  } else if (solvent === 'CO2-liq') {
    metabolicPathway = 'Supercritical CO₂ Carboxylation + Fe²⁺/H₂ Chemotrophy';
    deltaGKjMol = -165.0;
    electronDonor = 'H₂ / Fe²⁺';
    electronAcceptor = 'scCO₂ / SO₄²⁻';
    biosignatures = ['CO + CH₄ Disequilibrium in CO₂ Matrix', 'Enantiomeric Lipid Excess'];
    disequilibriumScore = 0.66;
  } else if (solvent === 'H2O-subsurface') {
    metabolicPathway = 'Hydrothermal Methanogenesis + Radiolytic H₂/H₂O₂';
    deltaGKjMol = -131.0;
    electronDonor = 'H₂ (Serpentinization)';
    electronAcceptor = 'CO₂ / Radiolytic O₂ & H₂O₂';
    biosignatures = ['Plume CH₄ + H₂ + Silica Nanoparticles', 'Heavy δ¹³C Fractionation'];
    disequilibriumScore = 0.74;
  } else if (solvent === 'H2-He-cloud') {
    metabolicPathway = 'Baroclinic Lightning-Fixed HCN/NH₃ + Thermal-Gradient Redox';
    deltaGKjMol = -245.0;
    electronDonor = 'H₂ / NH₃ / PH₃';
    electronAcceptor = 'Lightning HCN / Photochemical C₂H₂';
    biosignatures = ['Cloud-Deck Chromophore Band', 'Non-Equilibrium PH₃/HCN Gradient'];
    disequilibriumScore = 0.59;
  } else if (stellarTeffK < 3500 && uvFluxNorm > 2.2) {
    metabolicPathway = '3-Photon Anoxygenic/Oxygenic + Radiotrophic Melanin Coupling';
    deltaGKjMol = -392.0;
    electronDonor = 'H₂O / Fe²⁺';
    electronAcceptor = 'CO₂ / O₂';
    biosignatures = ['O₂ + CH₄ + CH₃Cl Disequilibrium', 'NIR Red Edge (1.05 μm)', 'DMS Marine Flux'];
    disequilibriumScore = 0.88;
  }

  // NutMEG maintenance-vs-growth thermodynamic scaling:
  // Maintenance power rises via Arrhenius law with temperature; available redox power scales with |deltaG| & flux!
  const maintPowerWPerKg = Number((0.08 * Math.exp(Math.max(-4, Math.min(4.5, (T - 288) / 48.0)))).toFixed(3));
  const netGrowthMargin = clamp((Math.abs(deltaGKjMol) / 380.0) / Math.max(0.25, Math.sqrt(maintPowerWPerKg)), 0.12, 2.6);
  const carryingCapacityKgPerKm2 = Math.round(clamp(12000 * netGrowthMargin * (pressurePa > 2e3 ? 1.0 : 0.25), 400, 120000));

  return Object.freeze({
    metabolicPathway,
    deltaGKjMol,
    electronDonor,
    electronAcceptor,
    maintPowerWPerKg,
    netGrowthMargin: Number(netGrowthMargin.toFixed(2)),
    carryingCapacityKgPerKm2,
    biosignatures: Object.freeze(biosignatures),
    disequilibriumScore
  });
}

// =========================================================================
// 4. Procedural Latinate Taxonomy, Biomechanics, Clade Tree & Food Web
// =========================================================================

const GENUS_PREFIX_BY_SOLVENT = Object.freeze({
  H2O: ['Chloro', 'Hydro', 'Thalasso', 'Sylva', 'Velo', 'Osteo', 'Aero', 'Pyro', 'Boreo', 'Pela'],
  CH4: ['Cryo', 'Azoto', 'Methano', 'Tholo', 'Glacio', 'Nitrilo', 'Krono', 'Titan', 'Etha', 'Frigo'],
  NH3: ['Ammono', 'Cyano', 'Azano', 'Krio', 'Halo', 'Boreo', 'Tealo', 'Lumo', 'Velo', 'Niveo'],
  H2SO4: ['Sulfo', 'Acido', 'Aureo', 'Veno', 'Thio', 'Fumo', 'Nebulo', 'Pyro', 'Vitri', 'Caeli'],
  'CO2-liq': ['Carbo', 'Baro', 'Siloxo', 'Litho', 'Aero', 'Peno', 'Scopo', 'Fero', 'Velo', 'Crysto'],
  'H2O-subsurface': ['Bathy', 'Piezzo', 'Chemo', 'Vento', 'Hadal', 'Abyss', 'Serpo', 'Lumo', 'Baro', 'Pelago'],
  'H2-He-cloud': ['Strato', 'Zeph', 'Baro', 'Jovi', 'Nimbus', 'Cyclo', 'Vento', 'Aethero', 'Pneumo', 'Fulmi']
});

const GENUS_SUFFIX_BY_PLAN = Object.freeze({
  'quadruped-cursorial': ['cervus', 'therium', 'dromaeus', 'ungula', 'saura'],
  'hexapod-armored': ['caris', 'scuta', 'hexapus', 'chitin', 'lorica'],
  'biped-strider': ['ornis', 'cursor', 'strider', 'pedes', 'raptor'],
  'radial-tentacular': ['medusa', 'asteria', 'hydra', 'tentacula', 'crinus'],
  'aero-gasbag': ['pneumon', 'velum', 'nautilus', 'leviathan', 'bulla'],
  'wing-glider': ['pteryx', 'volans', 'ala', 'draco', 'manta'],
  'litho-crawler': ['lithos', 'stegos', 'velifera', 'plax', 'testudo'],
  'aquatic-swimmer': ['ichthys', 'cetos', 'nectes', 'thunnus', 'branchia'],
  'conifer-spire': ['pinus', 'spira', 'turris', 'aciculis', 'conus'],
  'branching-arbor': ['dendron', 'arbor', 'ramus', 'sylva', 'quercus'],
  'frond-rosette': ['frons', 'palma', 'filix', 'rosetta', 'pluma'],
  'buoyant-kelp': ['phycus', 'bulla', 'macrocyst', 'pneumata', 'stipes'],
  'biolum-coral': ['corallium', 'lucens', 'crystalla', 'ramosa', 'photis'],
  'buttressed-monolith': ['baobab', 'colossus', 'radices', 'pachycaul', 'basa'],
  'mycelial-fruiting-tree': ['myces', 'agaric', 'hypha', 'sporon', 'lamella'],
  'sporing-hypha-dome': ['clathrus', 'reticulum', 'spora', 'phallus', 'myco'],
  'chemotrophic-vent-spire': ['riftia', 'thioploca', 'tubus', 'sidero', 'pyrita']
});

const SPECIES_EPITHETS = Object.freeze([
  'stellaris', 'barophilus', 'thermophila', 'cryogenica', 'luminosa', 'velox',
  'armata', 'pelagica', 'montana', 'noctiluca', 'aetheria', 'ferrea',
  'silicea', 'radiotropica', 'umbrosa', 'aurelia', 'viridis', 'rubra',
  'caerulea', 'violacea', 'gigas', 'gracilis', 'profunda', 'ventosa'
]);

const SENSORY_BY_ENV = (rho, tempK, uv, hasOcean, isDark) => {
  const out = [];
  if (isDark) out.push('Infrared Thermal Pits', 'Electroreception');
  else out.push(uv > 2.2 ? 'UV-Filtered Compound Ommatidia' : 'High-Acuity Camera Eyes');
  if (rho > 0.35) out.push('Barometric Tympana / Echolocation');
  else if (rho > 0.02) out.push('Seismic Foot-Pads');
  if (hasOcean) out.push('Hydrodynamic Lateral Line');
  if (tempK < 150) out.push('Cryo-Chemoreceptor Antennae');
  else out.push('Volatile Olfactory Plumes');
  return Object.freeze(out.slice(0, 3));
};

function selectBiomineralSkeleton(solvent, gravityMS2, bodyPlan, rand) {
  if (bodyPlan === 'aero-gasbag' || bodyPlan === 'radial-tentacular') {
    return 'Hydrostatic Pressurized Fluid Septa + Chitinous Ribs';
  }
  if (solvent === 'CH4') return 'Water-Ice / Clathrate Cryo-Endoskeleton';
  if (solvent === 'H2SO4') return 'Silica-Opal & Sulfonated Keratin Exoskeleton';
  if (solvent === 'H2O-subsurface') return 'Pyrite (FeS₂) / Calcium Carbonate Shell';
  if (gravityMS2 > 12.5) return 'High-Modulus Silica-Reinforced Titanium-Apatite Endoskeleton';
  if (bodyPlan === 'hexapod-armored' || bodyPlan === 'litho-crawler') return 'Cross-Linked Chitin-Mineral Exoskeleton';
  return rand() < 0.55 ? 'Hydroxyapatite Calcified Endoskeleton' : 'Fibrous Cartilage-Silica Endoskeleton';
}

export function mutateFasta(baseSeq, seed, isFauna, isFungi) {
  const chars = String(baseSeq || 'HPPHH+PHHPPHH-PPHHPPH+PPH-PHHPPH').split('');
  const alpha = isFungi ? ['H', 'P', '+', '-', 'H', '-'] : (isFauna ? ['H', 'P', '+', '-', 'H', 'P'] : ['H', 'H', 'P', 'P', '+', '-']);
  const rand = mulberry32(seed);
  const nMut = 5 + Math.floor(rand() * 5);
  for (let k = 0; k < nMut; k += 1) {
    const idx = Math.floor(rand() * chars.length);
    chars[idx] = alpha[Math.floor(rand() * alpha.length)];
  }
  return chars.join('');
}

function makeSpeciesName(solvent, bodyPlan, rand) {
  const preList = GENUS_PREFIX_BY_SOLVENT[solvent] || GENUS_PREFIX_BY_SOLVENT.H2O;
  const sufList = GENUS_SUFFIX_BY_PLAN[bodyPlan] || ['forma', 'vita'];
  const genus = preList[Math.floor(rand() * preList.length)] + sufList[Math.floor(rand() * sufList.length)];
  const epithet = SPECIES_EPITHETS[Math.floor(rand() * SPECIES_EPITHETS.length)];
  return `${genus} ${epithet}`;
}

export function buildAnatomicalParts(kingdom, bodyPlan, traits, skeleton, sensory, photo, redox) {
  if (kingdom === 'flora') {
    return Object.freeze([
      Object.freeze({
        id: 'canopy',
        label: bodyPlan === 'buoyant-kelp' ? 'Lifting Gas-Bladder Fronds' : (bodyPlan === 'biolum-coral' ? 'Crystalline Photophore Crown' : 'Photosynthetic Canopy'),
        role: 'Light Harvesting & Gas Exchange',
        tissue: `${photo.pigmentClass} (${photo.zSchemePhotons}-photon, λ_edge=${photo.redEdgeNm} nm)`,
        biopsyLayer: 'fold',
        reactionProbe: 'Seismonastic frond folding & elastic crown sway',
        reactionHeat: 'Stomatal closure & chlorophyll fluorescence stress',
        reactionStim: 'Phototropic bending toward light pulse'
      }),
      Object.freeze({
        id: 'torso',
        label: bodyPlan === 'buttressed-monolith' ? 'Buttressed Vascular Monolith Trunk' : 'Vascular Cambium Trunk',
        role: 'Euler-Buckling Structural Support & Sap Transport',
        tissue: `Lignin/Silica Structural Polymers (${skeleton})`,
        biopsyLayer: 'membrane',
        reactionProbe: 'Elastic stem vibration & resin pressure pulse',
        reactionHeat: 'Sap convective cooling & thermal bark expansion',
        reactionStim: 'Phloem electrical action-potential pulse'
      }),
      Object.freeze({
        id: 'limbs',
        label: 'Primary Branches / Rhizoids',
        role: 'Nutrient Absorption & Structural Anchoring',
        tissue: 'Symbiotic Mycorrhizal Root-Vascular Matrix',
        biopsyLayer: 'evo',
        reactionProbe: 'Turgor stiffening along lateral branches',
        reactionHeat: 'Evaporative transpiration surge',
        reactionStim: 'Auxin growth-hormone gradient shift'
      })
    ]);
  }
  if (kingdom === 'fungi') {
    return Object.freeze([
      Object.freeze({
        id: 'canopy',
        label: bodyPlan === 'sporing-hypha-dome' ? 'Perforated Spore-Lattice Gleba' : (bodyPlan === 'chemotrophic-vent-spire' ? 'Chemosynthetic Plume Crown' : 'Pleated Gill Pileus & Spore Veil'),
        role: 'Sporogenesis & Chemical Decomposition',
        tissue: `Chitinous Hyphal Matrix (${redox.metabolicPathway})`,
        biopsyLayer: 'morph',
        reactionProbe: 'Explosive spore-cloud puff & veil contraction!',
        reactionHeat: 'Accelerated thermophilic sporulation burst',
        reactionStim: 'Bioluminescent luciferin wave flash across gills'
      }),
      Object.freeze({
        id: 'torso',
        label: 'Braided Mycelial Stipe',
        role: 'Osmotic Turgor Column & Hyphal Conduit',
        tissue: 'Septate Chitin-Glucan Hyphae',
        biopsyLayer: 'membrane',
        reactionProbe: 'Damped viscoelastic sway & turgor recoil',
        reactionHeat: 'Heat-shock chaperone protein activation',
        reactionStim: 'Propagating fungal electrical spike train (0.5 Hz)'
      }),
      Object.freeze({
        id: 'tail',
        label: 'Radiating Mycelial Web / Rhizomorphs',
        role: 'Extracellular Enzyme Secretion & Nutrient Network',
        tissue: 'Hydrolytic Protease & Redox-Active Filaments',
        biopsyLayer: 'fold',
        reactionProbe: 'Rapid protoplasmic streaming reversal',
        reactionHeat: 'Enzyme denaturation risk above T_denature',
        reactionStim: 'Synchronized bioluminescent network pulse'
      })
    ]);
  }
  // Fauna
  const parts = [
    Object.freeze({
      id: 'head',
      label: bodyPlan === 'radial-tentacular' ? 'Central Nerve Ring & Ocelli' : 'Cephalized Sensory Head & Ganglia',
      role: `Neural Integration (${sensory.join(', ')})`,
      tissue: 'Excitable Myelinated/Axonal Neural Tissue',
      biopsyLayer: 'hh',
      reactionProbe: 'Startle head-snap, gaze lock & threat vocalization!',
      reactionHeat: 'Acute nociceptive retreat & panting/venting',
      reactionStim: 'Synchronized Hodgkin–Huxley neural wave burst'
    }),
    Object.freeze({
      id: 'torso',
      label: bodyPlan === 'aero-gasbag' ? 'Buoyant H₂/Thermal Lifting Envelope' : 'Visceral Thorax & Metabolic Core',
      role: `Kleiber Metabolic Core (${traits.kleiberWatts} W · ${redox.electronDonor}/${redox.electronAcceptor})`,
      tissue: `${skeleton} + Contractile Myofibrils`,
      biopsyLayer: 'fold',
      reactionProbe: 'Full-body defensive flinch & muscle bracing',
      reactionHeat: 'Q₁₀ metabolic surge & hyperthermic stress',
      reactionStim: 'Cardio-respiratory pulse acceleration'
    }),
    Object.freeze({
      id: 'limbs',
      label: bodyPlan === 'wing-glider' ? 'Articulated Swept Wings' : (bodyPlan === 'aquatic-swimmer' ? 'Pectoral & Caudal Hydrofoils' : (bodyPlan === 'radial-tentacular' ? 'Prehensile Radial Tentacles' : `${traits.limbCount}-Limbed Locomotor Appendages`)),
      role: 'Biomechanically Tuned Locomotion (Strouhal / Gait)',
      tissue: 'Cross-Striated Contractile Muscle & Tendon',
      biopsyLayer: 'membrane',
      reactionProbe: 'Rapid evasive dart / withdrawal reflex!',
      reactionHeat: 'Thermoregulatory limb extension',
      reactionStim: 'Rhythmic neuromuscular twitch wave'
    })
  ];
  if (traits.hasSail) {
    parts.push(Object.freeze({
      id: 'sail',
      label: 'Dorsal Vascular Thermal Radiator Sail (Allen’s Rule)',
      role: 'Radiative Heat Rejection & Intraspecific Display',
      tissue: 'Dense Capillary Bed & Chromatophore Skin',
      biopsyLayer: 'morph',
      reactionProbe: 'Aggressive threat flare & vivid warning flush!',
      reactionHeat: 'Full vasodilation & rapid infrared heat shedding!',
      reactionStim: 'Turing chromatophore ripple across sail'
    }));
  } else {
    parts.push(Object.freeze({
      id: 'tail',
      label: bodyPlan === 'aero-gasbag' ? 'Trailing Electro-Sensory Tentacles' : 'Counterbalance Tail / Bioluminescent Organ',
      role: 'Dynamic Stability & Bioluminescent Signaling',
      tissue: 'Photophore-Rich Elastic Dermis',
      biopsyLayer: 'evo',
      reactionProbe: 'Whip-lash defense & bright startle bioluminescence!',
      reactionHeat: 'Thermal-avoidance curl',
      reactionStim: 'Travelling bioluminescent wave along appendage'
    }));
  }
  return Object.freeze(parts);
}

/**
 * Synthesize a complete, scientifically grounded multi-species phylogenetic clade tree
 * and ecological food web for ANY world!
 */
export function synthesizeWorldEcosystem({
  worldName = 'Exoplanet',
  tempK = 288,
  pressurePa = 101325,
  gravityMS2 = 9.81,
  rhoAtmKgM3 = 1.22,
  volatileFrac = 0.04,
  hasSolidCrust = true,
  isCryoMoon = false,
  isMagmaOcean = false,
  stellarTeffK = 5778,
  uvFluxNorm = 1.0,
  cToO = 0.55,
  seed = 20261125
} = {}) {
  const rand = mulberry32((seed ^ 0x51f15e3) >>> 0);
  const g = Math.max(0.25, Number(gravityMS2) || 9.81);
  const rho = Math.max(0, Number(rhoAtmKgM3) || 0);
  const T = Math.max(40, Number(tempK) || 288);
  const P = Math.max(0, Number(pressurePa) || 0);
  const uv = clamp(Number(uvFluxNorm) || Math.pow(Math.max(2500, stellarTeffK) / 5778, 3.2), 0.05, 8.0);

  const solv = classifySolventBains2024({
    tempK: T, pressurePa: P, volatileFrac, hasSolidCrust, isCryoMoon, isMagmaOcean, cToO
  });
  const photo = solvePhotobiologySpectrum({
    stellarTeffK, solvent: solv.solvent, pressurePa: P, uvFluxNorm: uv
  });
  const redox = deriveRedoxAndBiosignatures({
    solvent: solv.solvent, tempK: T, pressurePa: P, uvFluxNorm: uv, stellarTeffK
  });

  const hasLiquidSurface = hasSolidCrust && !isMagmaOcean && (
    solv.solvent === 'H2O' || solv.solvent === 'CH4' || solv.solvent === 'NH3' || solv.solvent === 'CO2-liq'
  );
  const isGasCloud = solv.solvent === 'H2-He-cloud';
  const isDarkWorld = solv.solvent === 'H2O-subsurface' || solv.solvent === 'CH4' || stellarTeffK < 3400;

  // Euler buckling height scaling: H ~ (E / (rho g))^(1/3) + buoyant lift in dense air
  const bucklingHeightScale = Number(clamp(
    Math.pow(9.81 / g, 0.38) * (1.0 + 0.16 * Math.log1p(rho)),
    0.45,
    2.65
  ).toFixed(2));

  // Bergmann's rule: colder worlds favor larger, more compact heat-retaining body masses
  const bergmannMassMul = clamp(Math.pow(288 / Math.max(85, T), 0.55), 0.55, 2.2);
  // Allen's rule: hotter worlds favor elongated limbs & dorsal thermal radiator sails!
  const allenHotBias = clamp((T - 295) / 85, 0, 1);

  if (solv.solvent === 'none') {
    return Object.freeze({
      schema: ULG_XENOBIOLOGY_ECOLOGY_SCHEMA,
      worldName,
      solventInfo: solv,
      photobiology: photo,
      redox,
      bucklingHeightScale,
      floraArchWeights: Object.freeze([0, 0, 0, 0, 0, 0]),
      species: Object.freeze([]),
      trophicSummary: Object.freeze({ producers: 0, decomposers: 0, grazers: 0, predators: 0, aerialOrAquatic: 0 })
    });
  }

  // Choose world-specific primary & secondary flora architectures (`0..5`) driven strictly by physics!
  //   0=conifer-spire, 1=branching-arbor, 2=frond-rosette, 3=buoyant-kelp, 4=biolum-coral, 5=buttressed-monolith
  const floraPlans = [];
  const floraArchWeights = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
  if (isGasCloud) {
    floraPlans.push('buoyant-kelp'); // Floating aero-plankton kelp rafts
    floraArchWeights[3] = 0.85;
  } else if (solv.solvent === 'H2O-subsurface') {
    floraPlans.push('biolum-coral', 'buoyant-kelp');
    floraArchWeights[4] = 0.65; floraArchWeights[3] = 0.35;
  } else {
    if (g > 11.5) {
      floraPlans.push('buttressed-monolith');
      floraArchWeights[5] += 0.55;
    } else if (g < 4.5 || rho > 2.2) {
      floraPlans.push('buoyant-kelp');
      floraArchWeights[3] += 0.50;
    }
    if (solv.solvent === 'CH4' || solv.solvent === 'NH3' || stellarTeffK < 3600) {
      floraPlans.push('biolum-coral');
      floraArchWeights[4] += 0.45;
    }
    if (T >= 295 && solv.solvent === 'H2O') {
      floraPlans.push('frond-rosette');
      floraArchWeights[2] += 0.48;
    }
    if (T < 282 && solv.solvent === 'H2O') {
      floraPlans.push('conifer-spire');
      floraArchWeights[0] += 0.52;
    }
    if (floraPlans.length < 2) {
      floraPlans.push(rand() < 0.52 ? 'branching-arbor' : 'frond-rosette');
      floraArchWeights[1] += 0.44;
    }
    if (floraPlans.length < 3) {
      floraPlans.push(T < 292 ? 'conifer-spire' : 'branching-arbor');
      floraArchWeights[T < 292 ? 0 : 1] += 0.30;
    }
  }
  const uniqueFloraPlans = [...new Set(floraPlans)].slice(0, 3);

  // Decomposer / Chemotrophic Fungi & Hybrid Clade (`1-2` species per world!)
  const fungiPlans = [];
  if (solv.solvent === 'H2O-subsurface' || solv.solvent === 'H2SO4') {
    fungiPlans.push('chemotrophic-vent-spire');
  } else if (isGasCloud) {
    fungiPlans.push('sporing-hypha-dome');
  } else {
    fungiPlans.push(rand() < 0.55 ? 'mycelial-fruiting-tree' : 'sporing-hypha-dome');
    if (rand() < 0.55 || solv.solvent !== 'H2O') fungiPlans.push('chemotrophic-vent-spire');
  }

  // Fauna Guilds (`3-4` distinct articulated motile species per world!)
  const faunaEntries = [];
  if (isGasCloud) {
    // Gas Giant Cloud-Deck Aerial Ecosystem: floating Leviathans + Winged Soarers + Radial Drifters!
    faunaEntries.push(
      { bodyPlan: 'aero-gasbag', trophicGuild: 'filter-leviathan', scaleBase: 2.35 },
      { bodyPlan: 'wing-glider', trophicGuild: 'aerial-grazer', scaleBase: 1.25 },
      { bodyPlan: 'radial-tentacular', trophicGuild: 'aerial-predator', scaleBase: 1.45 }
    );
  } else if (solv.solvent === 'H2O-subsurface') {
    faunaEntries.push(
      { bodyPlan: 'aquatic-swimmer', trophicGuild: 'pelagic-grazer', scaleBase: 1.35 },
      { bodyPlan: 'radial-tentacular', trophicGuild: 'vent-predator', scaleBase: 1.20 }
    );
  } else {
    // Primary terrestrial grazer
    const grazerPlan = g > 12.0
      ? (rand() < 0.55 ? 'hexapod-armored' : 'litho-crawler')
      : (g < 4.5 ? (rand() < 0.5 ? 'biped-strider' : 'radial-tentacular') : (rand() < 0.52 ? 'quadruped-cursorial' : 'hexapod-armored'));
    faunaEntries.push({ bodyPlan: grazerPlan, trophicGuild: 'grazer', scaleBase: 1.05 });

    // Secondary consumer / agile predator
    const predCandidates = ['biped-strider', 'quadruped-cursorial', 'litho-crawler', 'hexapod-armored', 'radial-tentacular']
      .filter((p) => p !== grazerPlan);
    const predPlan = predCandidates[Math.floor(rand() * predCandidates.length)];
    faunaEntries.push({ bodyPlan: predPlan, trophicGuild: 'predator', scaleBase: 1.18 });

    // Aerial guild whenever atmospheric density supports aerodynamic flight or buoyancy!
    if (rho >= 0.45) {
      const airPlan = (rho > 2.0 || g < 4.8 || rand() < 0.45) ? 'aero-gasbag' : 'wing-glider';
      faunaEntries.push({ bodyPlan: airPlan, trophicGuild: 'aerial-soarer', scaleBase: airPlan === 'aero-gasbag' ? 1.55 : 1.12 });
    }
    // Aquatic guild whenever surface liquid seas exist!
    if (hasLiquidSurface) {
      faunaEntries.push({ bodyPlan: 'aquatic-swimmer', trophicGuild: 'aquatic-swimmer', scaleBase: 1.15 });
    }
  }

  const sensory = SENSORY_BY_ENV(rho, T, uv, hasLiquidSurface || solv.solvent === 'H2O-subsurface', isDarkWorld);
  const species = [];

  const createSpeciesRecord = ({ kingdom, bodyPlan, trophicGuild, scaleBase, cladeIdx }) => {
    const spSeed = hashU32((seed ^ Math.imul(cladeIdx + 19, 2654435761)) >>> 0);
    const spRand = mulberry32(spSeed);
    const speciesName = makeSpeciesName(solv.solvent, bodyPlan, spRand);
    const skeleton = selectBiomineralSkeleton(solv.solvent, g, bodyPlan, spRand);

    // Distinct clade color palette harmonizing with planetary photobiology & ecological camouflage/aposematism!
    let primaryRgb;
    let secondaryRgb;
    let accentRgb;
    let biolumRgb;
    const hueJitter = (spRand() - 0.5) * 0.22;
    if (kingdom === 'flora') {
      const baseP = cladeIdx % 2 === 0 ? photo.primaryRgb : photo.secondaryRgb;
      primaryRgb = [
        clamp(baseP[0] + hueJitter, 0.06, 0.96),
        clamp(baseP[1] - hueJitter * 0.5, 0.06, 0.96),
        clamp(baseP[2] + hueJitter * 0.6, 0.06, 0.96)
      ];
      secondaryRgb = mixRgb([0.34, 0.24, 0.16], primaryRgb, 0.25);
      accentRgb = mixRgb(primaryRgb, [0.95, 0.85, 0.36], 0.48);
      biolumRgb = solv.solvent === 'CH4' ? [0.68, 0.44, 1.0] : [0.22, 0.96, 0.72];
    } else if (kingdom === 'fungi') {
      primaryRgb = [
        clamp(0.45 + spRand() * 0.45, 0.12, 0.96),
        clamp(0.24 + spRand() * 0.52, 0.12, 0.96),
        clamp(0.32 + spRand() * 0.58, 0.12, 0.96)
      ];
      secondaryRgb = [0.78, 0.72, 0.62];
      accentRgb = [0.22, 0.95, 0.78];
      biolumRgb = [0.26, 1.0, 0.74];
    } else {
      // Fauna: grazers blend toward habitat pigments; predators/aerials carry bold Turing aposematic accents!
      const isPred = trophicGuild.includes('predator');
      const isAir = trophicGuild.includes('aerial') || trophicGuild.includes('leviathan');
      const isSwim = trophicGuild.includes('aquatic') || trophicGuild.includes('pelagic');
      if (isSwim) {
        primaryRgb = [0.18 + spRand() * 0.26, 0.52 + spRand() * 0.34, 0.68 + spRand() * 0.28];
        secondaryRgb = [0.82, 0.90, 0.95];
      } else if (isAir) {
        primaryRgb = mixRgb([0.78, 0.56, 0.34], [0.42, 0.72, 0.96], spRand());
        secondaryRgb = mixRgb(primaryRgb, [0.96, 0.84, 0.48], 0.45);
      } else if (isPred) {
        primaryRgb = [0.62 + spRand() * 0.32, 0.22 + spRand() * 0.36, 0.18 + spRand() * 0.42];
        secondaryRgb = [0.16, 0.18, 0.24];
      } else {
        primaryRgb = mixRgb(photo.primaryRgb, [0.76, 0.60, 0.40], 0.42 + spRand() * 0.36);
        secondaryRgb = mixRgb(primaryRgb, [0.88, 0.82, 0.72], 0.40);
      }
      accentRgb = [0.98, 0.86, 0.28];
      biolumRgb = isDarkWorld || isSwim || isAir
        ? [0.18 + spRand() * 0.45, 0.88, 0.96]
        : [0.35, 0.96, 0.68];
    }

    const biolumIntensity = Number(clamp(
      (isDarkWorld || kingdom === 'fungi' || bodyPlan === 'biolum-coral' || bodyPlan === 'aero-gasbag' || bodyPlan === 'aquatic-swimmer')
        ? (0.35 + spRand() * 0.55)
        : (spRand() < 0.35 ? 0.22 : 0.04),
      0.0, 1.0
    ).toFixed(2));

    // Biomechanical & allometric properties
    const bodyMassKg = Number(clamp(
      (kingdom === 'flora' ? 420 : (kingdom === 'fungi' ? 38 : 65 * scaleBase * scaleBase))
      * bergmannMassMul * Math.pow(9.81 / g, 0.35) * (0.6 + spRand() * 0.9),
      1.5, 12000
    ).toFixed(1));
    // Kleiber's Law: BMR = B0 * M^0.75 * Q10^((T - 288)/10) (clamped safely for cryo/thermophile bounds)
    const b0 = kingdom === 'fauna' ? 3.4 : (kingdom === 'fungi' ? 0.55 : 0.28);
    const q10 = Math.pow(2.0, clamp((T - 288) / 10.0, -3.2, 2.8));
    const kleiberWatts = Number((b0 * Math.pow(bodyMassKg, 0.75) * q10).toFixed(1));
    const strouhalHz = Number(clamp(
      (0.28 * (2.5 + spRand() * 2.5)) / Math.max(0.35, scaleBase * 0.85),
      0.35, 3.8
    ).toFixed(2));

    const symmetry = (bodyPlan === 'radial-tentacular' || bodyPlan === 'frond-rosette' || bodyPlan === 'sporing-hypha-dome')
      ? (spRand() < 0.5 ? 'pentaradial' : 'hexaradial')
      : (kingdom === 'flora' ? 'radial-branching' : 'bilateral');
    const limbCount = bodyPlan === 'hexapod-armored'
      ? 6
      : (bodyPlan === 'biped-strider' ? 2 : (bodyPlan === 'radial-tentacular' ? 6 : (bodyPlan === 'litho-crawler' ? 6 : (bodyPlan === 'quadruped-cursorial' ? 4 : 0))));
    const hasSail = kingdom === 'fauna' && (bodyPlan === 'litho-crawler' || allenHotBias > 0.35 || spRand() < 0.32);
    const hasHorns = kingdom === 'fauna' && (bodyPlan === 'quadruped-cursorial' || bodyPlan === 'hexapod-armored') && spRand() < 0.62;
    const hasTendrils = bodyPlan === 'radial-tentacular' || bodyPlan === 'aero-gasbag' || bodyPlan === 'chemotrophic-vent-spire' || spRand() < 0.25;
    const hasWings = bodyPlan === 'wing-glider';
    const hasFins = bodyPlan === 'aquatic-swimmer' || bodyPlan === 'aero-gasbag';
    const hasGasSac = bodyPlan === 'aero-gasbag' || bodyPlan === 'buoyant-kelp';
    const hasCap = bodyPlan === 'mycelial-fruiting-tree' || bodyPlan === 'sporing-hypha-dome';

    const traits = Object.freeze({
      limbCount,
      symmetry,
      scaleBase: Number(scaleBase.toFixed(2)),
      bodyMassKg,
      kleiberWatts,
      strouhalHz,
      hasSail,
      hasHorns,
      hasTendrils,
      hasWings,
      hasFins,
      hasGasSac,
      hasCap,
      neckRatio: Number((0.75 + spRand() * 0.85 + allenHotBias * 0.25).toFixed(2)),
      legRatio: Number((0.78 + spRand() * 0.65 * Math.pow(9.81 / g, 0.22)).toFixed(2)),
      tOptK: Math.round(T),
      tDenatureK: Math.round(solv.tDenatureK)
    });

    const fasta = mutateFasta(solv.sequence, spSeed, kingdom === 'fauna', kingdom === 'fungi');
    const anatomicalParts = buildAnatomicalParts(kingdom, bodyPlan, traits, skeleton, sensory, photo, redox);

    // First-principles continuous Developmental Genome (Stage 3 — ZERO fixed template switches!)
    const spMedium = bodyPlan === 'aero-gasbag' || isGasCloud
      ? 'buoyant'
      : (bodyPlan === 'wing-glider'
        ? 'aerial'
        : (bodyPlan === 'aquatic-swimmer' || solv.solvent === 'H2O-subsurface' ? 'aquatic' : 'terrestrial'));
    const developmentalGenome = buildDevelopmentalGenome({
      seed: spSeed,
      kingdom,
      trophicGuild,
      niche: {
        medium: spMedium,
        tempK: T,
        gravityMS2: g,
        lightFluxNorm: isDarkWorld ? 0.28 : 0.95,
        windMS: Math.max(2.0, 5.0 * Math.pow(T / 288, 0.5))
      },
      tensor: {
        gravityMS2: g,
        rhoAtmKgM3: rho,
        tempK: T,
        hasSolidCrust,
        bucklingHeightScale,
        aerialEase: rho > 0.02 ? (rho / 1.22) * Math.pow(9.81 / g, 0.85) : 0
      },
      colors: {
        primaryRgb,
        secondaryRgb,
        accentRgb,
        biolumRgb,
        biolumIntensity
      }
    });

    // Human-readable morph class label
    const morphLabels = {
      'quadruped-cursorial': 'Cursorial Quadruped',
      'hexapod-armored': 'Armored Exoskeletal Hexapod',
      'biped-strider': 'Bipedal Strider',
      'radial-tentacular': 'Radial Tentacular Organism',
      'aero-gasbag': 'Buoyant Cloud-Deck Leviathan',
      'wing-glider': 'Aerodynamic Wing-Glider',
      'litho-crawler': 'Radiator-Sail Litho-Crawler',
      'aquatic-swimmer': 'Thunniform Aquatic Swimmer',
      'conifer-spire': 'Alpine Spire Conifer',
      'branching-arbor': 'Forked-Crown Vascular Arbor',
      'frond-rosette': 'Swept-Frond Rosette Palm',
      'buoyant-kelp': 'Gas-Bladder Buoyant Kelp Spire',
      'biolum-coral': 'Bioluminescent Coral-Crystal Tower',
      'buttressed-monolith': 'High-g Buttressed Baobab Monolith',
      'mycelial-fruiting-tree': 'Macro-Mycelial Fruiting Organism',
      'sporing-hypha-dome': 'Clathrate Sporing Hypha Dome',
      'chemotrophic-vent-spire': 'Chemotrophic Plumed Vent Colony'
    };

    return Object.freeze({
      id: `clade-${kingdom}-${cladeIdx}-${(spSeed & 0xffff).toString(16)}`,
      seed: spSeed,
      kingdom,
      bodyPlan,
      trophicGuild,
      speciesName,
      morphClass: developmentalGenome.morphDescriptor || morphLabels[bodyPlan] || bodyPlan,
      developmentalGenome,
      skeleton,
      sensoryOrgans: kingdom === 'fauna' ? sensory : Object.freeze(['Photoreceptor / Mechanosensor']),
      primaryRgb: Object.freeze(primaryRgb),
      secondaryRgb: Object.freeze(secondaryRgb),
      accentRgb: Object.freeze(accentRgb),
      biolumRgb: Object.freeze(biolumRgb),
      biolumIntensity,
      traits,
      fasta,
      metabolicPathway: redox.metabolicPathway,
      deltaGKjMol: redox.deltaGKjMol,
      xnaBackbone: solv.xnaBackbone,
      xnaAlphabetSize: solv.xnaAlphabetSize,
      anatomicalParts
    });
  };

  let cladeIdx = 0;
  for (const fp of uniqueFloraPlans) {
    species.push(createSpeciesRecord({ kingdom: 'flora', bodyPlan: fp, trophicGuild: 'producer', scaleBase: 1.0 * bucklingHeightScale, cladeIdx: cladeIdx++ }));
  }
  for (const mfp of fungiPlans) {
    species.push(createSpeciesRecord({ kingdom: 'fungi', bodyPlan: mfp, trophicGuild: 'decomposer-chemotroph', scaleBase: 0.92 * Math.sqrt(bucklingHeightScale), cladeIdx: cladeIdx++ }));
  }
  for (const fe of faunaEntries) {
    species.push(createSpeciesRecord({ kingdom: 'fauna', bodyPlan: fe.bodyPlan, trophicGuild: fe.trophicGuild, scaleBase: fe.scaleBase, cladeIdx: cladeIdx++ }));
  }

  // Normalize flora architecture weights so GPU instanced forest shader blends this world's exact native flora!
  const wSum = floraArchWeights.reduce((a, b) => a + b, 0) || 1;
  const normWeights = floraArchWeights.map((w) => Number((w / wSum).toFixed(3)));

  return Object.freeze({
    schema: ULG_XENOBIOLOGY_ECOLOGY_SCHEMA,
    worldName,
    solventInfo: solv,
    photobiology: photo,
    redox,
    bucklingHeightScale,
    bergmannMassMul: Number(bergmannMassMul.toFixed(2)),
    allenHotBias: Number(allenHotBias.toFixed(2)),
    floraArchWeights: Object.freeze(normWeights),
    species: Object.freeze(species),
    trophicSummary: Object.freeze({
      producers: uniqueFloraPlans.length,
      decomposers: fungiPlans.length,
      grazers: faunaEntries.filter((f) => f.trophicGuild.includes('grazer') || f.trophicGuild.includes('leviathan')).length,
      predators: faunaEntries.filter((f) => f.trophicGuild.includes('predator')).length,
      aerialOrAquatic: faunaEntries.filter((f) => f.trophicGuild.includes('aerial') || f.trophicGuild.includes('aquatic') || f.trophicGuild.includes('leviathan') || f.trophicGuild.includes('pelagic')).length
    }),
    accuracyTier: ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    scientificValidation: false
  });
}
