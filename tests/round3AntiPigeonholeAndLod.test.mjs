import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildOrganicMolecularGraph } from '../src/runtime/organic/organicMolecularGraphGpu.js';
import { evaluateChemiosmoticBioenergetics } from '../src/runtime/biology/membraneBioenergeticsGpu.js';
import {
  classifySolventBains2024,
  solvePhotobiologySpectrum
} from '../src/runtime/biology/xenobiologyEcologyEngine.js';
import { synthesizeOrganismBiochemistry } from '../src/runtime/biology/organismBiochemistryGenerator.js';
import { deriveSurfaceEnvironmentState } from '../src/runtime/astrophysics/planetarySurfaceVehiclesGpu.js';
import { deriveAtmosphericColumnProfile } from '../src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import { buildOrbitalCdfTables } from '../src/runtime/electronicStructure/orbitalPointCloudWebGpu.js';
import { computeAlphaWkbTunneling } from '../src/runtime/nuclear/nuclearStructureGpu.js';
import {
  buildLiveSurfaceCelestialSky,
  computeOrbitalSeasonalState
} from '../src/runtime/astrophysics/surfaceCelestialSkyAndSeasons.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('R3-A4: L-Alanine is exact CIP (S) and D-Alanine is exact CIP (R)', () => {
  const lAla = buildOrganicMolecularGraph('l-alanine');
  const dAla = buildOrganicMolecularGraph('d-alanine');
  assert.equal(lAla.chiralCenters.length, 1);
  assert.equal(dAla.chiralCenters.length, 1);
  assert.equal(lAla.chiralCenters[0].configuration, 'S', 'L-Alanine must be CIP (S)');
  assert.equal(dAla.chiralCenters[0].configuration, 'R', 'D-Alanine must be CIP (R)');
});

test('R3-A4: Signed Mitchell chemiosmotic PMF cancels opposing electrical and pH gradients', () => {
  const opposed = evaluateChemiosmoticBioenergetics({ deltaPsiMv: 150, deltaPh: -3.0, uncouplerLeak: 0.0 });
  assert.ok(opposed.protonMotiveForceMv < 0, `Opposing ΔΨ=+150mV and ΔpH=-3 must yield negative PMF (got ${opposed.protonMotiveForceMv})`);
  assert.equal(opposed.thermodynamicallyFeasible, false);
  assert.equal(opposed.atpSynthesisFlux, 0);
});

test('R3-A3: Bains 2024 checks liquid H2O before H2SO4 and forbids boiling Venusian H2SO4 surface oceans', () => {
  // High-pressure temperate water world (30 bar, 320 K) must be liquid H2O, NOT H2SO4!
  const superEarthWater = classifySolventBains2024({
    tempK: 320,
    pressurePa: 30 * 101325,
    volatileFrac: 0.25,
    hasSolidCrust: true
  });
  assert.equal(superEarthWater.solvent, 'H2O', `30-bar 320 K water world must classify as H2O (got ${superEarthWater.solvent})`);
  assert.equal(superEarthWater.isCloudDeckHabitat, false);

  // Venus (737 K, 92 bar) has an elevated cloud-deck habitat, NEVER a liquid surface ocean!
  const venusSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'venus');
  assert.ok(venusSpec, 'Venus catalog entry must exist');
  const venusSolvent = classifySolventBains2024({
    tempK: venusSpec.tempK,
    pressurePa: (venusSpec.surfacePressureBar || 92) * 101325,
    volatileFrac: 0.05,
    hasSolidCrust: true
  });
  assert.equal(venusSolvent.solvent, 'H2SO4');
  assert.equal(venusSolvent.isCloudDeckHabitat, true);
  assert.ok(venusSolvent.habitatAltitudeKm >= 40, 'Venusian H2SO4 habitat must sit at cloud-deck altitude');

  const venusSurface = deriveSurfaceEnvironmentState(venusSpec);
  assert.equal(venusSurface.hasLiquidOcean, false, 'Venus at 737 K must NEVER spawn a liquid surface ocean');

  // Earth crust must be Silicon (Z=14), not Copper (Z=29)!
  const earthSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth');
  assert.equal(earthSpec.surfZ, 14, 'Earth surface composition must be Silicon (Z=14)');
});

test('R3-A4: Synthesized biomolecules across all solvent regimes respect atomic valence bounds (C<=4, O<=2)', () => {
  const regimes = [
    { solvent: 'H2O', tempK: 295, pressurePa: 101325, dielectricEr: 78.4 },
    { solvent: 'H2SO4', tempK: 320, pressurePa: 1.2 * 101325, dielectricEr: 101.0 },
    { solvent: 'NH3', tempK: 225, pressurePa: 2.5 * 101325, dielectricEr: 22.0 },
    { solvent: 'CH4', tempK: 94, pressurePa: 1.5 * 101325, dielectricEr: 1.7 },
    { solvent: 'CO2-liq', tempK: 320, pressurePa: 85 * 101325, dielectricEr: 1.65 }
  ];
  for (const r of regimes) {
    const bio = synthesizeOrganismBiochemistry({
      solvent: r.solvent,
      tempK: r.tempK,
      pressurePa: r.pressurePa,
      dielectricEr: r.dielectricEr,
      stellarTeffK: 5778,
      redEdgeNm: 705,
      zSchemePhotons: 2
    });
    const graphs = Object.values(bio.molecules || {}).map((m) => m?.graph).filter((g) => g && Array.isArray(g.atoms));
    assert.ok(graphs.length === 4, `Expected 4 biomolecule graphs for ${r.solvent} (got ${graphs.length})`);
    for (const g of graphs) {
      const bondOrderSum = new Float64Array(g.atoms.length);
      for (const b of g.bonds) {
        const order = Number(b.order) || 1;
        bondOrderSum[b.a] += order;
        bondOrderSum[b.b] += order;
      }
      for (let i = 0; i < g.atoms.length; i += 1) {
        const z = g.atoms[i].z;
        const val = bondOrderSum[i];
        if (z === 6) {
          assert.ok(val <= 4.01, `${r.solvent} ${g.name}: Carbon #${i} has illegal valence ${val}`);
        }
        if (z === 8) {
          assert.ok(val <= 2.01, `${r.solvent} ${g.name}: Oxygen #${i} has illegal valence ${val}`);
        }
      }
    }
  }
});

test('R3-B1: Abiotic rocky atmospheres have near-zero biogenic O2 and photobiology uses peakLamNm continuously', () => {
  const sterileEarthLike = deriveAtmosphericColumnProfile(
    { id: 'abiotic-rock', name: 'Abiotic Rock', kind: 1, tempK: 290, surfacePressureBar: 1.2, gravityMs2: 9.8, hasOcean: true },
    { tempK: 290, pressurePa: 1.2 * 101325, gravityMS2: 9.8, hasLiquidOcean: true, volatileFrac: 0.08, xenobiology: { biosphereViability: 0, solvent: 'H2O', zSchemePhotons: 0 } }
  );
  const livingEarthLike = deriveAtmosphericColumnProfile(
    { id: 'living-rock', name: 'Living Rock', kind: 1, tempK: 290, surfacePressureBar: 1.0, gravityMs2: 9.8, hasOcean: true },
    { tempK: 290, pressurePa: 101325, gravityMS2: 9.8, hasLiquidOcean: true, volatileFrac: 0.08, xenobiology: { biosphereViability: 0.9, solvent: 'H2O', zSchemePhotons: 2 } }
  );
  const o2Sterile = sterileEarthLike.bulkComposition.find((s) => s.id === 'O2')?.moleFrac ?? 0;
  const o2Living = livingEarthLike.bulkComposition.find((s) => s.id === 'O2')?.moleFrac ?? 0;
  assert.ok(o2Sterile < 0.01, `Abiotic rocky world must not fake 20.9% O2 (got ${o2Sterile})`);
  assert.ok(o2Living > 0.10, `Oxygenic living world should retain biogenic O2 (got ${o2Living})`);

  const mDwarfPhoto = solvePhotobiologySpectrum({ stellarTeffK: 3100, solvent: 'H2O', pressurePa: 101325 });
  const aStarPhoto = solvePhotobiologySpectrum({ stellarTeffK: 8500, solvent: 'H2O', pressurePa: 101325 });
  assert.ok(mDwarfPhoto.surfacePeakLamNm > aStarPhoto.surfacePeakLamNm, 'M-dwarf photobiology peak wavelength must sit redward of A-star');
  assert.ok(mDwarfPhoto.redEdgeNm > aStarPhoto.redEdgeNm, 'Red edge must respond continuously to computed 23-band peakLamNm');
});

test('R3-A2: L6 Dirac-KS TypedArray ingestion preserves eigenstate mode and exact angular parity P(mu)=P(-mu)', () => {
  const n = 96;
  const rGrid = new Float32Array(n);
  const orbitalU = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const r = 0.02 + (i / (n - 1)) * 12.0;
    rGrid[i] = r;
    orbitalU[i] = r * r * Math.exp(-r * 0.85);
  }
  const tables = buildOrbitalCdfTables({
    Z: 79,
    n: 5,
    l: 2,
    m: 2,
    rGrid,
    orbitalU,
    relativistic: true
  });
  assert.equal(tables.sourceKind, 'webgpu-kohn-sham-eigenstate', 'Float32Array Dirac-KS inputs must NOT silently fall back to Slater');
  // Parity invariance: pdf(mu_i) === pdf(mu_{N-1-i}) across polarPacked CDF increments!
  const bins = tables.polarPacked.length / 2;
  let maxParityErr = 0;
  for (let i = 0; i < bins; i += 1) {
    const pLo = tables.polarPacked[i * 2] - (i > 0 ? tables.polarPacked[(i - 1) * 2] : 0);
    const j = bins - 1 - i;
    const pHi = tables.polarPacked[j * 2] - (j > 0 ? tables.polarPacked[(j - 1) * 2] : 0);
    const err = Math.abs(pLo - pHi);
    if (err > maxParityErr) maxParityErr = err;
  }
  assert.ok(maxParityErr < 1e-5, `Relativistic spin-orbit angular density violated parity symmetry (maxErr=${maxParityErr})`);
});

test('R3-A2: L7 nuclear WKB exposes exact reduced mass and touching radius', () => {
  const wkb = computeAlphaWkbTunneling(92, 238, 4.27);
  assert.ok(wkb.rTouchFm > 5.0 && wkb.rTouchFm < 14.0, `Expected physical touching radius in fm (got ${wkb.rTouchFm})`);
  assert.ok(wkb.muMeV > 3600 && wkb.muMeV < 3740, `Expected reduced alpha mass ~3665 MeV (got ${wkb.muMeV})`);
  assert.ok(wkb.rFm instanceof Float32Array && wkb.vMeV instanceof Float32Array);
});

test('R3-A/C Structural & Race-Free GPU Kernel Contracts', () => {
  const mlsWgsl = fs.readFileSync(path.join(ROOT, 'ulg-gpu-abi/src/mlsMpmWgsl.js'), 'utf8');
  assert.match(mlsWgsl, /let rho0 = pos_mass\.w \/ max\(row4\.w, 1\.0e-12\);/, 'Liquid density reconciliation must read row4.w (V0), not row4.y (c22)');

  const galGpu = fs.readFileSync(path.join(ROOT, 'src/runtime/astrophysics/galacticParticleMeshGpu.js'), 'utf8');
  assert.match(galGpu, /fn pm_snapshot_cores/, 'Galactic PM must snapshot cores before kick to prevent GPU storage read/write race');
  assert.match(galGpu, /core_snap\[0u\]/, 'compute_total_gal_acc must read core_snap instead of concurrently written bodies[0]');

  const mhdGpu = fs.readFileSync(path.join(ROOT, 'src/runtime/astrophysics/nebularMhdCollapseGpu.js'), 'utf8');
  assert.match(mhdGpu, /grav_fft\[cidx\(/, 'step_mhd_grid must read solved FFT gravity potential from read-only grav_fft');

  const renderer = fs.readFileSync(path.join(ROOT, 'src/demos/ulgUniversesRenderer.js'), 'utf8');
  assert.match(renderer, /const MAX_CLOUD_SLOTS = 8;/, 'Renderer must provision >= 8 particle cloud slots');
  assert.match(renderer, /struct AstroVolOut[\s\S]*@builtin\(frag_depth\) depth: f32/, 'ASTRO_VOL_WGSL must output analytical Reverse-Z depth');
  assert.match(renderer, /depthCompare: 'greater-equal'/, 'astroVolPipe must honor Reverse-Z depth occlusion');
  assert.match(renderer, /let lat_winter = -n_hit\.y \* sin_decl;/, 'LIT_SPHERE_WGSL must drive asymmetric winter/summer seasons from live orbital sin_decl');
  assert.match(renderer, /let snow_top = clamp\(in\.flora_info\.z \* smoothstep\(0\.10, 0\.72, n\.y\)/, 'SURFACE_FLORA_INSTANCED_WGSL must shade snow-capped canopy tops');
});

test('U16: First-principles orbital & landed planetary seasons emerge from obliquity and orbital phase', () => {
  const earthSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth');
  const uranusSpec = REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'uranus');

  // Earth spin pole points along +Z (spinAxisLonDeg=90, obliquity=23.44 deg):
  // toStar=[0,0,+1] -> Northern Summer Solstice (delta = +23.44 deg), toStar=[0,0,-1] -> Northern Winter Solstice (-23.44 deg)!
  const nSum = computeOrbitalSeasonalState({ bodySpec: earthSpec, toStarUnit: [0, 0, 1] });
  const nWin = computeOrbitalSeasonalState({ bodySpec: earthSpec, toStarUnit: [0, 0, -1] });
  const eqx = computeOrbitalSeasonalState({ bodySpec: earthSpec, toStarUnit: [1, 0, 0] });
  assert.ok(Math.abs(nSum.declDeg - 23.44) < 0.25, `Expected +23.44 deg solstice (got ${nSum.declDeg})`);
  assert.ok(Math.abs(nWin.declDeg + 23.44) < 0.25, `Expected -23.44 deg solstice (got ${nWin.declDeg})`);
  assert.ok(Math.abs(eqx.declDeg) < 0.05, `Expected 0 deg equinox (got ${eqx.declDeg})`);
  assert.equal(nSum.seasonLabel, 'N. Summer / S. Winter');
  assert.equal(nWin.seasonLabel, 'N. Winter / S. Summer');
  assert.ok(nSum.tiltedLightDir[1] > 0.35 && nWin.tiltedLightDir[1] < -0.35, 'Orbital sunlight must physically tilt with obliquity');

  // Extreme obliquity (Uranus ~97.8 deg) produces near-polar solstice illumination along its spin-axis longitude; zero obliquity & tidally locked are strictly aseasonal!
  const uLonRad = ((Number(uranusSpec.spinAxisLonDeg) || 90) * Math.PI) / 180;
  const uSol = computeOrbitalSeasonalState({ bodySpec: uranusSpec, toStarUnit: [Math.cos(uLonRad), 0, Math.sin(uLonRad)] });
  assert.ok(Math.abs(uSol.declDeg) > 75, `Uranus extreme obliquity must drive >75 deg solstice (got ${uSol.declDeg})`);
  const locked = computeOrbitalSeasonalState({ bodySpec: { ...earthSpec, tidallyLocked: true }, toStarUnit: [0, 0, 1] });
  const upright = computeOrbitalSeasonalState({ bodySpec: { ...earthSpec, axialObliquityDeg: 0 }, toStarUnit: [0, 0, 1] });
  assert.equal(locked.sinDecl, 0);
  assert.equal(upright.sinDecl, 0);
  assert.equal(upright.seasonLabel, 'Aseasonal');

  // Landed mid-latitude Earth (42 deg N) must physically transition from warm snow-free Summer to freezing snowy Winter with sea ice!
  const earthIdx = REAL_SOLAR_SYSTEM_CATALOG.findIndex((b) => b.id === 'earth');
  const envEarth = deriveSurfaceEnvironmentState(earthSpec);
  const mkEng = (earthPos) => ({
    catalog: REAL_SOLAR_SYSTEM_CATALOG,
    massiveCount: REAL_SOLAR_SYSTEM_CATALOG.length,
    getMassiveBodyState64: (i) => ({ posAu: i === 0 ? [0, 0, 0] : (i === earthIdx ? earthPos : [5, 0, 0]), velAuPerYr: [0, 0, 0], massSolar: 0 })
  });
  const sumSurf = buildLiveSurfaceCelestialSky({
    solarEngine: mkEng([0, 0, -1]), catalog: REAL_SOLAR_SYSTEM_CATALOG, focusIdx: earthIdx, env: envEarth, surfaceSimSec: 0, observerLatDeg: 42
  });
  const winSurf = buildLiveSurfaceCelestialSky({
    solarEngine: mkEng([0, 0, 1]), catalog: REAL_SOLAR_SYSTEM_CATALOG, focusIdx: earthIdx, env: envEarth, surfaceSimSec: 0, observerLatDeg: 42
  });
  assert.ok(sumSurf.climate.surfaceTempK > 295 && sumSurf.climate.iceCoverFrac === 0,
    `42N Summer must be warm & ice-free (T=${sumSurf.climate.surfaceTempK}K, ice=${sumSurf.climate.iceCoverFrac})`);
  assert.ok(winSurf.climate.surfaceTempK < 273.15 && winSurf.climate.snowlineM < 6.0 && winSurf.climate.iceCoverFrac > 0.35,
    `42N Winter must cross freezing with low snowline & sea ice (T=${winSurf.climate.surfaceTempK}K, snow=${winSurf.climate.snowlineM}m, ice=${winSurf.climate.iceCoverFrac})`);
});
