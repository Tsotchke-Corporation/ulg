import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packPolytopeAtlasForGpu } from '../ulg-gpu-abi/src/materialFoundationAbi.js';
import { getCompoundPolytopeAtlas } from '../src/runtime/material/canonicalMaterialLookup.js';
import { createDynamicSchroederScaleAtlasRuntime } from '../src/runtime/sph/schroederSpatialScaleAtlasRuntime.js';
import { evaluateAtmosphericEscapeState } from '../src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js';
import {
  DEFORM_CHUNK_SIZE_M,
  DEFORM_CHUNK_SLOTS,
  createSparseDeformChunkLruManager,
  worldXZToDeformChunkCoord
} from '../src/runtime/astrophysics/surfaceDeformationMpmGpu.js';
import {
  evaluatePlanetaryDisruptionBudget,
  evaluateRocheAndTidalHeating
} from '../src/runtime/astrophysics/tidalRocheDisruptionGpu.js';
import {
  evaluateDysonRadiativeBalance,
  createKardashevProgressionState
} from '../src/runtime/astrophysics/ufoMultiplayerMesh.js';
import {
  appendStarVisuals,
  computeHostStarIllumination
} from '../src/runtime/astrophysics/starlightAndExoticOptics.js';
import {
  autoLandLog10SpanForBody,
  idealBodyFramingLog10Span,
  resolvePrimaryLevelFromSpan
} from '../src/demos/ulgUniversesDemo.js';
import {
  buildDevelopmentalGenome,
  decodeDevelopmentalGenomeCompact,
  encodeDevelopmentalGenomeCompact
} from '../src/runtime/biology/developmentalGenome.js';
import {
  buildLifeLabXenobiologyUrl,
  deriveXenobiologyProfile,
  parseXenobiologyFromSearch,
  synthesizeAbductedSpecimenRecord
} from '../src/runtime/biology/xenobiologySynthesizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Track 2A: packPolytopeAtlasForGpu hydrates real tRangeK/pRangePa and planetaryGenesisSphGpu is translation-invariant with inline Gate 2 EOS', async () => {
  const h2o = getCompoundPolytopeAtlas('H2O');
  assert.ok(h2o, 'H2O polytope atlas must hydrate from foundation-polytope-atlas.json');
  const firstPoly = h2o.polytopes[0];
  assert.ok(Array.isArray(firstPoly.tRangeK) && Array.isArray(firstPoly.pRangePa));

  const packed = packPolytopeAtlasForGpu(h2o.polytopes);
  const r0 = 4; // header floats
  const tMinPacked = packed.data[r0 + 2];
  const tMaxPacked = packed.data[r0 + 3];
  const lpMinPacked = packed.data[r0 + 4];
  const lpMaxPacked = packed.data[r0 + 5];

  assert.ok(
    Math.abs(tMinPacked - firstPoly.tRangeK[0]) < 1e-2 && Math.abs(tMaxPacked - firstPoly.tRangeK[1]) < 1e-2,
    `packed T range [${tMinPacked}, ${tMaxPacked}] must match tRangeK [${firstPoly.tRangeK[0]}, ${firstPoly.tRangeK[1]}]`
  );
  const expLpMin = Math.log10(Math.max(1e-12, firstPoly.pRangePa[0]));
  const expLpMax = Math.log10(Math.max(1e-12, firstPoly.pRangePa[1]));
  assert.ok(
    Math.abs(lpMinPacked - expLpMin) < 1e-3 && Math.abs(lpMaxPacked - expLpMax) < 1e-3,
    `packed log10(P) range [${lpMinPacked}, ${lpMaxPacked}] must match pRangePa [${expLpMin}, ${expLpMax}]`
  );

  const sphSrc = await fs.readFile(path.join(ROOT, 'src/runtime/astrophysics/planetaryGenesisSphGpu.js'), 'utf8');
  assert.match(sphSrc, /@binding\(5\)\s+var<storage, read>\s+polytope_atlas_bank/);
  assert.match(sphSrc, /eval_polytope_atlas_bank_2d\(&polytope_atlas_bank/);
  assert.doesNotMatch(sphSrc, /-\s*ss_com\s*\*\s*0\.35/, 'origin-anchored - ss_com * 0.35 restoring spring must be removed');
  assert.doesNotMatch(sphSrc, /smoothstep\(\s*0\.56\s*,\s*0\.24/, 'inverted Apple Metal smoothstep must be fixed');
  assert.match(sphSrc, /let pos = pr\.pos_mass\.xyz - com;/, 'spherical geology projection must rebase to ss_com');
});

test('Track 2B: SchroederScaleAtlas cross-scale boundary flux propagation and Jeans/XUV atmospheric escape physics', () => {
  const atlas = createDynamicSchroederScaleAtlasRuntime({
    referenceSpacingM: 1.0,
    rootGlobalBaseLevel: 40,
    rootLabel: 'L2-system'
  });
  const starChart = atlas.ensureChartForScaleLevel({ targetGlobalLevel: 32, parentChartId: 0, label: 'L3-star' });
  const planetChart = atlas.ensureChartForScaleLevel({ targetGlobalLevel: 22, parentChartId: starChart.chartId, label: 'L4-planet' });

  atlas.publishChartBoundaryFlux(0, { dysonCoveringFrac: 0.40, dysonTransmittedFluxFrac: 0.60, dysonWasteTempK: 340 });
  atlas.publishChartBoundaryFlux(starChart.chartId, { stellarWindPressureNPa: 14.5, cmeShockBoost: 2.2, flareXuvFluxMul: 8.0 });
  atlas.publishChartBoundaryFlux(planetChart.chartId, { tidalHeatingW: 1.2e12, tidalHeatFluxWPerM2: 0.45 });

  const inherited = atlas.resolveInheritedBoundaryFlux(planetChart.chartId);
  assert.equal(inherited.stellarWindPressureNPa, 14.5);
  assert.equal(inherited.cmeShockBoost, 2.2);
  assert.equal(inherited.flareXuvFluxMul, 8.0);
  assert.ok(Math.abs(inherited.dysonTransmittedFluxFrac - 0.60) < 1e-6);
  assert.equal(inherited.tidalHeatFluxWPerM2, 0.45);
  assert.equal(inherited.contributingCharts.length, 3);

  // Atmospheric escape: magnetized Earth retains atmosphere; airless Moon stays strictly vacuum/0 loss; hot small planet blows off!
  const earthEsc = evaluateAtmosphericEscapeState({
    radiusM: 6.371e6, massKg: 5.972e24, exobaseTempK: 1000, meanMolarMassKgPerMol: 0.029, xuvFluxEarth: 1.0, bEquatorialT: 3.1e-5, surfacePressurePa: 101325
  });
  const unmagEarthEsc = evaluateAtmosphericEscapeState({
    radiusM: 6.371e6, massKg: 5.972e24, exobaseTempK: 1000, meanMolarMassKgPerMol: 0.029, xuvFluxEarth: 1.0, bEquatorialT: 0.0, surfacePressurePa: 101325
  });
  const moonEsc = evaluateAtmosphericEscapeState({
    radiusM: 1.737e6, massKg: 7.342e22, exobaseTempK: 400, meanMolarMassKgPerMol: 0.029, xuvFluxEarth: 1.0, bEquatorialT: 0.0, surfacePressurePa: 0.0
  });
  assert.equal(earthEsc.escapeRegime, 'retained');
  assert.ok(earthEsc.xuvMassLossKgPerS < unmagEarthEsc.xuvMassLossKgPerS, 'magnetosphere must shield against XUV ion stripping');
  assert.equal(moonEsc.escapeRegime, 'vacuum');
  assert.equal(moonEsc.xuvMassLossKgPerS, 0);
});

test('Track 2C: Sparse chunked deformable terrain LRU, planetary disruption U_bind budget, and Kardashev II-III Dyson radiative balance', () => {
  // 1. Sparse chunked 3x3 terrain streaming
  assert.equal(DEFORM_CHUNK_SIZE_M, 768);
  assert.equal(DEFORM_CHUNK_SLOTS, 9);
  assert.deepEqual(worldXZToDeformChunkCoord(0, 0), { cx: 0, cz: 0 });
  assert.deepEqual(worldXZToDeformChunkCoord(800, -800), { cx: 1, cz: -1 });
  const evicted = [];
  const lru = createSparseDeformChunkLruManager({
    maxSlots: 9,
    onEvictChunk: (key, stamps) => evicted.push({ key, count: stamps.length })
  });
  lru.updateCenterWorldXZ(0, 0);
  assert.equal(lru.getActiveChunkCount(), 9);
  lru.recordStamp({ x: 10, z: -15, radiusM: 12, depthM: 3, kind: 1 });
  // Travel 3 km away -> old dirty chunk (0,0) must evict cleanly and persist its stamp!
  lru.updateCenterWorldXZ(3100, 0);
  assert.equal(lru.getActiveChunkCount(), 9);
  assert.ok(evicted.some((e) => e.key === '0,0' && e.count === 1), 'evicted dirty chunk must persist stamps');

  // 2. Planetary gravitational binding disruption budget U_bind = 3GM^2/(5R)
  const subCrack = evaluatePlanetaryDisruptionBudget({ bodyMassKg: 5.972e24, bodyRadiusM: 6.371e6, energyInputJ: 1.2e32 });
  assert.equal(subCrack.disrupted, false);
  assert.ok(subCrack.fractureGlow > 0 && subCrack.fractureGlow < 1);
  const fullShatter = evaluatePlanetaryDisruptionBudget({ bodyMassKg: 5.972e24, bodyRadiusM: 6.371e6, energyInputJ: 2.5e32 });
  assert.equal(fullShatter.disrupted, true);
  assert.equal(fullShatter.fractureGlow, 1);
  const fracSum = fullShatter.stratifiedShellFracs.core + fullShatter.stratifiedShellFracs.mantle + fullShatter.stratifiedShellFracs.crust;
  assert.ok(Math.abs(fracSum - 1.0) < 1e-9);

  // 3. Roche limit check
  const rocheIn = evaluateRocheAndTidalHeating({ orbitalRadiusM: 1.0e8, eccentricity: 0.05 });
  assert.equal(rocheIn.insideRoche, true);
  assert.ok(rocheIn.tidalHeatingW > 0);

  // 4. Kardashev II-III Dyson radiative balance + outer-world flux attenuation + 3D collector rings
  const rad0 = evaluateDysonRadiativeBalance({ fCoverOverride: 0.0 });
  const rad50 = evaluateDysonRadiativeBalance({ fCoverOverride: 0.50, swarmRadiusM: 1.496e11 });
  assert.equal(rad0.transmittedFluxFrac, 1.0);
  assert.equal(rad0.wasteTempK, 0.0);
  assert.ok(Math.abs(rad50.transmittedFluxFrac - 0.50) < 1e-6);
  const expectedTWaste = Math.pow((3.828e26 / (4 * Math.PI * 1.496e11 * 1.496e11)) / (0.9 * 5.670374419e-8), 0.25);
  assert.ok(
    Math.abs(rad50.wasteTempK - expectedTWaste) / expectedTWaste < 1e-3,
    `expected exact 1:1 Dyson shell Stefan-Boltzmann T_waste ~${expectedTWaste.toFixed(2)} K at 1 AU, got ${rad50.wasteTempK}`
  );
  assert.ok(Math.abs(rad50.outerTempScale - Math.pow(0.5, 0.25)) < 1e-6);

  const illumClear = computeHostStarIllumination({ distanceAu: 1.0, dysonCoveringFrac: 0.0 });
  const illumDyson = computeHostStarIllumination({ distanceAu: 1.0, dysonCoveringFrac: 0.75 });
  assert.ok(Math.abs(illumDyson.irradianceWm2 - illumClear.irradianceWm2 * 0.25) < 1e-3);

  const spheres = [];
  const disks = [];
  appendStarVisuals({
    spec: { tempK: 5778 },
    pos: [0, 0, 0],
    radius: 1.0,
    dysonCoverage: 0.65,
    dysonWasteTempK: 310,
    spheres,
    disks
  });
  assert.ok(disks.length >= 2, 'Dyson swarm with fCover=0.65 must emit 3D collector rings');
  assert.ok(disks.every((d) => d.kind === 2 && d.shadowInfo[2] === 310));

  const kState = createKardashevProgressionState();
  assert.equal(kState.state.dysonTransmittedFluxFrac, 1.0);
});

test('Track 2D: Body-radius-relative approach framing & auto-landing thresholds scale cleanly from 250 m Bennu to 30 R_sun giants', () => {
  const bennu = { id: 'bennu', radiusKm: 0.25, isStar: false };
  const halley = { id: 'halley', radiusKm: 5.5, isStar: false };
  const psyche = { id: 'psyche', radiusKm: 111, isStar: false };
  const moon = { id: 'moon', radiusKm: 1737, isStar: false };
  const earth = { id: 'earth', radiusKm: 6371, isStar: false };
  const saturn = { id: 'saturn', radiusKm: 58232, ringed: true, ringOuterKm: 140000, isStar: false };
  const jupiter = { id: 'jupiter', radiusKm: 71492, isStar: false };
  const sun = { id: 'sun', radiusKm: 696340, isStar: true };
  const redGiant = { id: 'red-giant', radiusKm: 696340 * 30, isStar: true };

  // Strictly monotonic comfortable framing spans across 8+ OOM in body radius!
  const spans = [bennu, halley, psyche, moon, earth, jupiter, sun, redGiant].map((b) => idealBodyFramingLog10Span(b));
  for (let i = 1; i < spans.length; i += 1) {
    assert.ok(spans[i] > spans[i - 1], `framing span must scale strictly with radius (${spans[i - 1]} -> ${spans[i]})`);
  }

  // Every bare body frames at identical ~37% viewport height (2*R / span = 2 / 5.4 ≈ 0.370)
  for (const body of [bennu, halley, psyche, moon, earth, jupiter]) {
    const fSpan = idealBodyFramingLog10Span(body);
    const spanM = Math.pow(10, fSpan);
    const diamFrac = (2 * body.radiusKm * 1000) / spanM;
    assert.ok(
      diamFrac > 0.33 && diamFrac < 0.42,
      `${body.id} comfortable framing diameter frac must be ~0.37 (got ${diamFrac.toFixed(3)})`
    );
    // Auto-landing threshold must give ~6x close-up inspection headroom before landing!
    const landSpan = autoLandLog10SpanForBody(body);
    const headroomLog = fSpan - landSpan;
    assert.ok(
      headroomLog >= 0.72 && headroomLog <= 0.90,
      `${body.id} must have ~0.80 log10 close-up zoom headroom before auto-landing (fSpan=${fSpan.toFixed(2)}, landSpan=${landSpan.toFixed(2)})`
    );
  }

  // Ringed Saturn must frame wider than bare Earth and cover the entire ring span without clipping!
  const satSpan = idealBodyFramingLog10Span(saturn);
  assert.ok(Math.pow(10, satSpan) > saturn.ringOuterKm * 1000 * 2.5, 'Saturn framing must comfortably fit full ring system');

  // Stars never auto-land and resolve cleanly to L3 at their comfortable framing span (including 30 R_sun giants!)
  assert.equal(autoLandLog10SpanForBody(sun), -Infinity);
  assert.equal(resolvePrimaryLevelFromSpan(idealBodyFramingLog10Span(sun), { focusedBodyIsStar: true, focusedBodyRadiusKm: sun.radiusKm }), 3);
  assert.equal(resolvePrimaryLevelFromSpan(idealBodyFramingLog10Span(redGiant), { focusedBodyIsStar: true, focusedBodyRadiusKm: redGiant.radiusKm }), 3);
});

test('Track 2E: Abducted fauna, fungi, aquatic & flora organisms round-trip 1:1 identically into Bio Lab Vivarium', () => {
  const world = deriveXenobiologyProfile({
    worldName: 'Kepler-442b',
    tempK: 289,
    pressurePa: 115000,
    gravityMS2: 10.4,
    rhoAtmKgM3: 1.35,
    volatileFrac: 0.08,
    hasSolidCrust: true,
    stellarTeffK: 4402,
    seed: 90210
  });
  // Verify compact genome codec preserves ALL 3 kingdoms (flora/fungi/fauna) and ALL 4 media (terrestrial/aerial/buoyant/aquatic)!
  const testCases = [
    { kingdom: 'fauna', medium: 'terrestrial', trophicGuild: 'predator' },
    { kingdom: 'fauna', medium: 'aquatic', trophicGuild: 'swimmer' },
    { kingdom: 'fauna', medium: 'aerial', trophicGuild: 'glider' },
    { kingdom: 'fauna', medium: 'buoyant', trophicGuild: 'filter' },
    { kingdom: 'fungi', medium: 'terrestrial', trophicGuild: 'decomposer' },
    { kingdom: 'flora', medium: 'terrestrial', trophicGuild: 'producer' }
  ];
  for (let i = 0; i < testCases.length; i += 1) {
    const tc = testCases[i];
    const g = buildDevelopmentalGenome({
      tensor: world.habitat || { gravityMS2: 10.4, rhoAtmKgM3: 1.35, tempK: 289, hasSolidCrust: true },
      kingdom: tc.kingdom,
      trophicGuild: tc.trophicGuild,
      niche: { medium: tc.medium },
      seed: 12345 + i * 97
    });
    const encoded = encodeDevelopmentalGenomeCompact(g);
    const decoded = decodeDevelopmentalGenomeCompact(encoded);
    assert.ok(decoded, `compact genome decode failed for ${tc.kingdom}/${tc.medium}`);
    assert.equal(decoded.kingdom, tc.kingdom, `kingdom must round-trip 1:1 (got ${decoded.kingdom} for ${tc.kingdom})`);
    assert.equal(decoded.medium, tc.medium, `medium must round-trip 1:1 (got ${decoded.medium} for ${tc.medium})`);
    assert.equal(decoded.symmetryOrder, g.symmetryOrder);
    assert.equal(decoded.segmentCount, g.segmentCount);
    assert.equal(decoded.appendageGroups, g.appendageGroups);
    assert.ok(Math.abs(decoded.turing.F - g.turing.F) < 0.002);
    assert.ok(Math.abs(decoded.colors.primaryRgb[0] - g.colors.primaryRgb[0]) < 0.01);
  }

  // Full URL handoff round-trip for an abducted motile Fauna specimen from Universes -> Bio Lab!
  const faunaSpecies = world.species.find((s) => s.kingdom === 'fauna');
  assert.ok(faunaSpecies && faunaSpecies.developmentalGenome, 'world must contain fauna with developmentalGenome');
  const abducted = synthesizeAbductedSpecimenRecord({
    kind: 'fauna',
    speciesRecord: faunaSpecies,
    worldName: world.worldName,
    env: { tempK: 289, pressurePa: 115000, gravityMS2: 10.4, rhoAtmKgM3: 1.35 },
    xeno: world,
    seed: faunaSpecies.seed
  });
  const url = buildLifeLabXenobiologyUrl(world, 'organism-overview', abducted);
  const query = url.slice(url.indexOf('?'));
  const parsed = parseXenobiologyFromSearch(query);
  assert.ok(parsed?.abductedSpecimen, 'Bio Lab URL must hydrate abductedSpecimen');
  assert.equal(parsed.abductedSpecimen.kingdom, 'fauna', 'Abducted fauna MUST remain fauna in Bio Lab (never turn into flora!)');
  assert.equal(parsed.abductedSpecimen.developmentalGenome?.kingdom, 'fauna', 'Hydrated developmentalGenome kingdom MUST remain fauna!');
  assert.equal(parsed.abductedSpecimen.developmentalGenome?.medium, faunaSpecies.developmentalGenome.medium);
  assert.equal(parsed.abductedSpecimen.developmentalGenome?.symmetryOrder, faunaSpecies.developmentalGenome.symmetryOrder);
  assert.equal(parsed.abductedSpecimen.developmentalGenome?.segmentCount, faunaSpecies.developmentalGenome.segmentCount);
  assert.equal(parsed.abductedSpecimen.speciesName, faunaSpecies.speciesName);
});
