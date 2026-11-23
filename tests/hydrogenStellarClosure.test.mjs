import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STELLAR_CLOSURE_TABLE_SCHEMA,
  buildStellarClosureGpuTable,
  classifyEmergentStellarStage,
  deriveQuantumHydrogenAnchors,
  electronDegeneracyPressurePa,
  evaluateBlackbodyPhotosphereSrgb,
  evaluateHydrogenPlasmaClosure,
  evaluateStellarNuclearFusionClosure
} from '../src/runtime/astrophysics/hydrogenStellarClosure.js';

test('deriveQuantumHydrogenAnchors derives H 1s ionization and H2 CAS(2,2) dissociation live from quantum solvers', () => {
  const anchors = deriveQuantumHydrogenAnchors({ forceRecompute: true });
  assert.equal(anchors.validation.scientificValidation, false);
  assert.ok(anchors.hIonizationEv > 12.0 && anchors.hIonizationEv < 15.0,
    `KS-PBE H 1s ionization expected ~13.6 eV, got ${anchors.hIonizationEv}`);
  assert.ok(anchors.h2DissociationEv > 3.0 && anchors.h2DissociationEv < 6.0,
    `CAS(2,2) H2 dissociation expected ~4.5 eV, got ${anchors.h2DissociationEv}`);
  assert.ok(anchors.h2DiradicalStretched > 0.9, 'stretched H2 CAS(2,2) must be diradical');
  assert.ok(anchors.h2VibrationalTempK > 3000 && anchors.h2VibrationalTempK < 8500);
});

test('evaluateHydrogenPlasmaClosure exhibits H2 dissociation gamma<4/3 dip, Saha ionization, and electron degeneracy', () => {
  const anchors = deriveQuantumHydrogenAnchors();

  // 1. Cold molecular nebula (30 K): H2 molecular, mu ~ 2.3
  const cold = evaluateHydrogenPlasmaClosure({ rhoKgM3: 1e-16, temperatureK: 30, anchors });
  assert.ok(cold.fH2 > 0.99, `expected molecular H2 at 30 K, got fH2=${cold.fH2}`);
  assert.ok(cold.xIonized < 1e-6);
  assert.ok(cold.mu > 2.0 && cold.mu < 2.6, `cold H2/He nebula mu expected ~2.3, got ${cold.mu}`);

  // 2. H2 dissociation zone (~2,000 K at protostellar density): gamma_eff drops below 4/3!
  const diss = evaluateHydrogenPlasmaClosure({ rhoKgM3: 1e-5, temperatureK: 2100, anchors });
  assert.ok(diss.fH2 > 0.05 && diss.fH2 < 0.95, `expected partial H2 dissociation, got fH2=${diss.fH2}`);
  assert.ok(diss.gammaEff < 4 / 3, `H2 dissociation must drive gamma_eff < 4/3 collapse instability, got ${diss.gammaEff}`);

  // 3. Saha ionized plasma (25,000 K): fully atomic/ionized, mu ~ 0.6
  const ion = evaluateHydrogenPlasmaClosure({ rhoKgM3: 1e-3, temperatureK: 25000, anchors });
  assert.ok(ion.fH2 < 0.01);
  assert.ok(ion.xIonized > 0.95, `expected ionized plasma at 25,000 K, got xIonized=${ion.xIonized}`);
  assert.ok(ion.mu > 0.5 && ion.mu < 0.72, `ionized solar plasma mu expected ~0.6, got ${ion.mu}`);

  // 4. White-dwarf density electron degeneracy dominates over ideal gas
  const wdPdeg = electronDegeneracyPressurePa(1e9, 0.5);
  const wdEos = evaluateHydrogenPlasmaClosure({ rhoKgM3: 1e9, temperatureK: 1e7, xH: 0.0, xHe: 0.0, xMetals: 1.0, anchors });
  assert.ok(wdPdeg > 1e20, `expected white-dwarf degeneracy pressure >1e20 Pa, got ${wdPdeg}`);
  assert.ok(wdEos.pDegFraction > 0.95, `degeneracy must dominate white dwarf core: pDegFrac=${wdEos.pDegFraction}`);
});

test('evaluateStellarNuclearFusionClosure ignites pp-chain at solar core, stays off in cold nebula, conserves nucleons, and triggers high-mass core collapse', () => {
  // Cold cloud: zero fusion
  const cold = evaluateStellarNuclearFusionClosure({ rhoKgM3: 1e-16, temperatureK: 30, dtS: 1e12 });
  assert.equal(cold.fusionActive, false);
  assert.equal(cold.epsTotalWPerKg, 0);

  // Solar core (rho = 1.5e5 kg/m^3, T = 1.57e7 K): active pp-chain around ~1e-2 W/kg
  const sun = evaluateStellarNuclearFusionClosure({ rhoKgM3: 1.5e5, temperatureK: 1.57e7, xH: 0.50, xHe: 0.48, xMetals: 0.02, dtS: 1e15 });
  assert.equal(sun.fusionActive, true);
  assert.ok(sun.epsPpWPerKg > 1e-3 && sun.epsPpWPerKg < 1.0,
    `solar core pp-chain rate expected ~1e-2 W/kg, got ${sun.epsPpWPerKg}`);
  assert.ok(sun.gamowPeakKeV > 5 && sun.gamowPeakKeV < 10);
  assert.ok(sun.dXBurned > 0, 'hydrogen must convert to helium during pp-chain burn');
  assert.ok(sun.nextMassFractions.xHe > 0.48);
  assert.ok(sun.nucleonConservationRelError < 1e-14, `nucleon conservation drift ${sun.nucleonConservationRelError}`);
  assert.equal(sun.validation.scientificValidation, false);

  // High-mass evolved core (18 M_sun, T = 2.2e9 K, Fe-rich Z=0.7): core-collapse supernova + Black Hole / NS
  const cc = evaluateStellarNuclearFusionClosure({ rhoKgM3: 1e11, temperatureK: 2.2e9, xH: 0.0, xHe: 0.1, xMetals: 0.9, coreMassSolar: 18.0 });
  assert.equal(cc.coreCollapseTriggered, true);
  assert.equal(cc.remnantClass, 'black-hole');
  assert.ok(cc.schwarzschildRadiusM > 5000);
});

test('Planck blackbody chromaticity progresses red -> golden-white -> blue-white and GPU closure table packs finite rows', () => {
  const cool = evaluateBlackbodyPhotosphereSrgb(2600);
  const solar = evaluateBlackbodyPhotosphereSrgb(5800);
  const hot = evaluateBlackbodyPhotosphereSrgb(28000);
  assert.ok(cool[0] > cool[2], `2600 K protostar must be red-dominant: ${cool}`);
  assert.ok(solar[0] > 0.9 && solar[1] > 0.85, `5800 K star must be warm white: ${solar}`);
  assert.ok(hot[2] > hot[0], `28000 K O-star must be blue-dominant: ${hot}`);

  const table = buildStellarClosureGpuTable({ nRho: 16, nTemp: 24 });
  assert.equal(table.schema, STELLAR_CLOSURE_TABLE_SCHEMA);
  assert.equal(table.data.length, 16 * 24 * 8);
  for (const v of table.data) assert.ok(Number.isFinite(v));
  assert.equal(table.validation.scientificValidation, false);

  const stage = classifyEmergentStellarStage({ coreTempK: 1.5e7, epsNucWPerKg: 0.02, xH: 0.65 });
  assert.equal(stage.id, 'main-sequence');
});
