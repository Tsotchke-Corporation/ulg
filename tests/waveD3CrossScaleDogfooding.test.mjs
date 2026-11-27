import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveRayleighMieSkyRgb,
  getCompoundBundleFromAtlas,
  getCompoundPolytopeAtlas,
  resolveCanonicalMaterialThermalOptics,
  resolveGasMixtureProperties,
  resolveSolventThermodynamics
} from '../src/runtime/material/canonicalMaterialLookup.js';
import {
  characteristicCherenkovAttenuationRangeM,
  createSphNuclearCherenkovController,
  normalizeIsotopeKey,
  resolveBodyIsotopeChannel
} from '../src/runtime/sph/sphNuclearCherenkovBridge.js';
import { classifySolventBains2024 } from '../src/runtime/biology/xenobiologyEcologyEngine.js';
import { extractPlanetaryHabitatTensor } from '../src/runtime/biology/planetaryNicheAtlas.js';
import { deriveAtmosphericColumnProfile } from '../src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js';
import { starTemperatureToLightRgb } from '../src/runtime/astrophysics/starlightAndExoticOptics.js';
import { evaluateLaserMaterialInteraction } from '../src/runtime/astrophysics/ufoWeaponsAndPhysicsGpu.js';
import { deriveSurfaceEnvironmentState } from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import { buildStellarMlsMpmInitialParcels } from '../src/runtime/astrophysics/stellarMlsMpmFusionGpu.js';

test('Wave D3: canonicalMaterialLookup hydrates Gate 2 compound bundles, polytopes, Clausius-Clapeyron T_boil(P), and periodic-table gas mixtures', () => {
  const sio2Bundle = getCompoundBundleFromAtlas('SiO₂');
  const h2oAtlas = getCompoundPolytopeAtlas('H2O');
  assert.ok(sio2Bundle && sio2Bundle.mechanical && sio2Bundle.thermodynamic, 'SiO2 Gate 2 bundle must hydrate');
  assert.ok(h2oAtlas && h2oAtlas.polytopeCount >= 4 && h2oAtlas.packedGpuAtlas, 'H2O polytope atlas must hydrate');

  // Pressure-dependent Clausius-Clapeyron boiling curve for H2O, CH4, NH3
  const h2o1Atm = resolveSolventThermodynamics('H2O', 300, 101325);
  const h2o10Atm = resolveSolventThermodynamics('H2O', 300, 1013250);
  const ch4LowP = resolveSolventThermodynamics('CH4', 95, 101325);
  const ch4HighP = resolveSolventThermodynamics('CH4', 95, 506625);
  assert.ok(h2o10Atm.tBoilK > h2o1Atm.tBoilK + 40, `H2O T_boil(10 atm)=${h2o10Atm.tBoilK} must exceed T_boil(1 atm)=${h2o1Atm.tBoilK}`);
  assert.ok(ch4HighP.tBoilK > ch4LowP.tBoilK + 12, `CH4 T_boil(5 atm)=${ch4HighP.tBoilK} must exceed T_boil(1 atm)=${ch4LowP.tBoilK}`);

  // Temperature-dependent Andrade viscosity decreases as T rises
  const h2oCold = resolveSolventThermodynamics('H2O', 275, 101325);
  const h2oHot = resolveSolventThermodynamics('H2O', 350, 101325);
  assert.ok(h2oCold.viscosityPaS > h2oHot.viscosityPaS * 1.8, 'Liquid water viscosity must decrease strongly with T');

  // Gas mixture molar mass derives strictly from ATOMIC_MASS_U (not hardcoded 0.029)
  const h2He = resolveGasMixtureProperties([{ id: 'H2', moleFrac: 0.86 }, { id: 'He', moleFrac: 0.14 }], 165);
  const co2Atm = resolveGasMixtureProperties([{ id: 'CO2', moleFrac: 0.96 }, { id: 'N2', moleFrac: 0.04 }], 735);
  assert.ok(h2He.molarMassKgMol > 0.0021 && h2He.molarMassKgMol < 0.0025, `H2/He M=${h2He.molarMassKgMol}`);
  assert.ok(co2Atm.molarMassKgMol > 0.042 && co2Atm.molarMassKgMol < 0.045, `CO2 M=${co2Atm.molarMassKgMol}`);
  assert.ok(h2He.cpJKgK > 10000 && co2Atm.cpJKgK < 1100, 'Specific heat cp must reflect molecular mass & DOF');
});

test('Wave D3: Studio nuclear Cherenkov resolves arbitrary Gate 1 (Z, A) isotopes, density-scaled attenuation, and spectral dispersion', () => {
  assert.equal(normalizeIsotopeKey('Sr-90'), 'Sr-90');
  assert.equal(normalizeIsotopeKey('Pu-238'), 'Pu-238');
  assert.equal(normalizeIsotopeKey('K-40'), 'K-40');
  assert.equal(normalizeIsotopeKey('Fe-56'), null, 'Stable Fe-56 must stay null');

  const sr90 = resolveBodyIsotopeChannel({ material: 'Sr', isotope: 'Sr-90' });
  assert.ok(sr90 && sr90.Z === 38 && sr90.A === 90 && sr90.qValueMeV > 0, 'Sr-90 must derive from Gate 1 nuclear closure');

  // Attenuation range scales inversely with dielectric mass density
  const co60 = resolveBodyIsotopeChannel({ material: 'Co', isotope: 'Co-60' });
  const rWater = characteristicCherenkovAttenuationRangeM(co60, 1000);
  const rDenseGlass = characteristicCherenkovAttenuationRangeM(co60, 3500);
  assert.ok(rWater > rDenseGlass * 2.5, `Water range ${rWater}m must exceed dense glass ${rDenseGlass}m`);

  const ctrl = createSphNuclearCherenkovController({
    bodies: [
      { id: 'src', material: 'Sr', isotope: 'Sr-90', centerM: [0, 0.2, 0], sizeM: [0.1, 0.1, 0.1] },
      { id: 'pool', material: 'h2o', phase: 'liquid', temperatureK: 295, centerM: [0, 0.2, 0], sizeM: [1, 1, 1] }
    ]
  });
  assert.equal(ctrl.enabled, true);
  const desc = ctrl.buildGpuSourcesDescriptor();
  assert.ok(Array.isArray(desc.refractiveIndexRgb) && desc.refractiveIndexRgb.length === 3);
  assert.ok(desc.refractiveIndexRgb[2] >= desc.refractiveIndexRgb[0], 'Normal dispersion n(450nm) >= n(650nm)');
});

test('Wave D3: Xenobiology, CFD, Starlight, Sky, UFO Weapons & Stellar ICs consume canonical ULG closures with zero id===earth hacks', () => {
  // Pressure-dependent CH4 boiling in Bains solvent classifier
  const ch4Low = classifySolventBains2024({ tempK: 100, pressurePa: 101325, volatileFrac: 0.1 });
  const ch4High = classifySolventBains2024({ tempK: 100, pressurePa: 800000, volatileFrac: 0.1 });
  assert.equal(ch4Low.solvent, 'CH4');
  assert.ok(ch4High.tBoilK > ch4Low.tBoilK + 15, 'CH4 tBoilK must scale with pressurePa');

  // Planetary niche atlas derives real CO2 vs N2 atmospheric density (not 0.029 hardcode)
  const marsTensor = extractPlanetaryHabitatTensor({ tempK: 215, pressurePa: 650, gravityMS2: 3.72, volatileFrac: 0.002 });
  assert.ok(marsTensor.rhoAtmKgM3 > 0.014 && marsTensor.rhoAtmKgM3 < 0.018, `CO2 Mars rho=${marsTensor.rhoAtmKgM3} kg/m^3`);

  // CFD atmospheric profile has ZERO bodySpec.id === 'earth' hack: abiotic id:'earth' without biosphere/civTechK has NO biogenic O2!
  const abioticEarthId = deriveAtmosphericColumnProfile({ id: 'earth', radiusKm: 6371, massSolar: 3e-6, surfacePressurePa: 101325, tempK: 288, volatileMassFrac: 0.05 });
  const livingWorld = deriveAtmosphericColumnProfile({ id: 'kepler-442b', radiusKm: 6371, massSolar: 3e-6, surfacePressurePa: 101325, tempK: 288, volatileMassFrac: 0.05, biosphereViability: 0.85 });
  assert.equal(abioticEarthId.bulkComposition.some((s) => s.id === 'O2'), false, 'id=earth without biosphere must NOT get fake O2');
  assert.equal(livingWorld.bulkComposition.some((s) => s.id === 'O2'), true, 'Any world with biosphereViability>=0.30 gets biogenic O2');

  // Planck blackbody starlight via radiationClosure.blackbodyColorSrgb
  const mDwarf = starTemperatureToLightRgb(3000);
  const solar = starTemperatureToLightRgb(5778);
  const oStar = starTemperatureToLightRgb(26000);
  assert.ok(mDwarf[0] > mDwarf[2] * 3.0, '3000 K M-dwarf must be strongly red-weighted');
  assert.ok(solar[0] > 0.9 && solar[1] > 0.85 && solar[2] > 0.7, '5778 K solar must be near-white');
  assert.ok(oStar[2] > oStar[0] * 1.4, '26000 K O-star must be blue-white');

  // Rayleigh-Mie sky via spectralResponseToSrgb (sRGB gamma-encoded CIE-1931: B > G > R clear, R > G > B dusty!)
  const earthSky = deriveRayleighMieSkyRgb({ skyOpticalDepth: 0.95, dustTint: 0.02, hostStarTeffK: 5778 });
  const dustSky = deriveRayleighMieSkyRgb({ skyOpticalDepth: 0.45, dustTint: 0.85, hostStarTeffK: 5778 });
  assert.ok(earthSky.skyZenithRgb[2] > earthSky.skyZenithRgb[1] && earthSky.skyZenithRgb[1] > earthSky.skyZenithRgb[0] && earthSky.skyZenithRgb[2] > earthSky.skyZenithRgb[0] * 1.5, 'Clear Rayleigh sky must be blue');
  assert.ok(dustSky.skyHorizonRgb[0] > dustSky.skyHorizonRgb[1] && dustSky.skyHorizonRgb[1] > dustSky.skyHorizonRgb[2] && dustSky.skyHorizonRgb[0] > dustSky.skyHorizonRgb[2] * 1.15, 'Dusty Mie sky must be warm amber');

  // UFO weapon material lookup resolves arbitrary elements/compounds from canonical banks (e.g. Au, NaCl, SiO2)
  const auMat = resolveCanonicalMaterialThermalOptics({ formula: 'Au', primaryZ: 79 });
  const naclMat = resolveCanonicalMaterialThermalOptics({ formula: 'NaCl', primaryZ: 11 });
  assert.ok(auMat.metallicity > 0.7 && auMat.tMeltK > 1000 && auMat.densityKgM3 > 15000);
  assert.ok(naclMat.metallicity < 0.2 && naclMat.bandGapEv > 4.0);
  const laserRes = evaluateLaserMaterialInteraction({ sample: { formula: 'NaCl', primaryZ: 11 }, powerW: 1e9 });
  assert.ok(Number.isFinite(laserRes.nextTempK) && laserRes.nextTempK > 260);

  // Surface env derives real molar mass & CIE sky
  const env = deriveSurfaceEnvironmentState({ radiusKm: 6371, massSolar: 3e-6, tempK: 288, surfacePressurePa: 101325, volatileMassFrac: 0.08 });
  assert.ok(env.skyZenithRgb[2] > env.skyZenithRgb[0]);

  // Stellar MLS-MPM ICs use Lane-Emden concentration (convective n=1.5 vs radiative n=3.0)
  const convParcels = buildStellarMlsMpmInitialParcels({ count: 256, stellarClass: 'red-supergiant', seed: 42 });
  const radParcels = buildStellarMlsMpmInitialParcels({ count: 256, stellarClass: 'main-sequence-star', seed: 42 });
  assert.equal(convParcels.length, 256 * 16);
  assert.equal(radParcels.length, 256 * 16);
});
