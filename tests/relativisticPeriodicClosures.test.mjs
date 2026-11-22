import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ELEMENT_CLOSURE_GENERATOR_FINGERPRINT,
  clearElementClosureCaches,
  deriveElementProperties,
  elementMaterialClosure
} from '../src/runtime/material/elementClosures.js';
import { materialDerivationSummary } from '../src/runtime/material/propertyProvenance.js';
import { createMaterialResolverPipeline } from '../src/runtime/material/materialResolverPipeline.js';

const FAST = { gridPointsN: 420, rMaxBohr: 36, maxScf: 200 };

test('relativistic 6s contraction melts Mercury (Hg Z=80) at room temperature while non-relativistic Hg stays solid', () => {
  clearElementClosureCaches();
  const hgRel = deriveElementProperties(80, { ...FAST, scalarRelativistic: true });
  const hgNonRel = deriveElementProperties(80, { ...FAST, scalarRelativistic: false });

  assert.equal(hgRel.symbol, 'Hg');
  assert.equal(hgRel.bondingClass, 'closed-d10-s2-metal');
  assert.equal(hgRel.standardPhaseAt298K, 'liquid', `relativistic Hg should be liquid at 293K (Tm=${hgRel.meltingPointK.toFixed(1)}K, Tb=${hgRel.boilingPointK.toFixed(1)}K)`);
  assert.ok(hgRel.meltingPointK < 293.15 && hgRel.boilingPointK > 293.15);
  assert.ok(hgRel.densityKgPerM3 > 10000 && hgRel.densityKgPerM3 < 20000);

  // Without scalar relativity, 6s does not contract strongly enough to melt Hg at ambient temperature!
  assert.equal(hgNonRel.standardPhaseAt298K, 'solid', `non-relativistic Hg should stay solid (Tm=${hgNonRel.meltingPointK.toFixed(1)}K)`);
  assert.ok(hgNonRel.meltingPointK > hgRel.meltingPointK + 80, 'relativity must depress Hg melting point by > 80 K');

  // Group 12 monotonic trend: Zn > Cd > Hg (Zn and Cd solid, Hg liquid)
  const zn = deriveElementProperties(30, FAST);
  const cd = deriveElementProperties(48, FAST);
  assert.equal(zn.standardPhaseAt298K, 'solid');
  assert.equal(cd.standardPhaseAt298K, 'solid');
  assert.ok(zn.meltingPointK > cd.meltingPointK && cd.meltingPointK > hgRel.meltingPointK);
});

test('universal London VdW dispersion gets halogen & diatomic states right: H/N/O/F/Cl gas, Br liquid, I solid', () => {
  for (const Z of [1, 7, 8, 9, 17]) {
    const p = deriveElementProperties(Z, FAST);
    assert.equal(p.bondingClass, 'molecular-vdw');
    assert.equal(p.standardPhaseAt298K, 'gas', `Z=${Z} (${p.symbol}) expected gas, got Tm=${p.meltingPointK.toFixed(0)}K Tb=${p.boilingPointK.toFixed(0)}K`);
  }
  const br = deriveElementProperties(35, FAST);
  assert.equal(br.bondingClass, 'molecular-vdw');
  assert.equal(br.standardPhaseAt298K, 'liquid', `Br expected liquid at 293K (Tm=${br.meltingPointK.toFixed(0)}K Tb=${br.boilingPointK.toFixed(0)}K)`);

  const iodine = deriveElementProperties(53, FAST);
  assert.equal(iodine.bondingClass, 'molecular-vdw');
  assert.equal(iodine.standardPhaseAt298K, 'solid', `I expected solid at 293K (Tm=${iodine.meltingPointK.toFixed(0)}K)`);
  assert.ok(iodine.meltingPointK > br.meltingPointK && br.meltingPointK > deriveElementProperties(17, FAST).meltingPointK);
});

test('transition, coinage, and post-transition metals get physical stiffness, melting points, and distinct Cu/Ag/Au optics', () => {
  const fe = deriveElementProperties(26, FAST);
  const cu = deriveElementProperties(29, { ...FAST, opticalInterbandOptions: FAST });
  const ag = deriveElementProperties(47, { ...FAST, opticalInterbandOptions: FAST });
  const au = deriveElementProperties(79, { ...FAST, opticalInterbandOptions: FAST });
  const ga = deriveElementProperties(31, FAST);
  const pb = deriveElementProperties(82, FAST);

  assert.ok(fe.meltingPointK > 1200 && fe.meltingPointK < 2500);
  assert.ok(fe.bulkModulusPa > 80e9);
  assert.ok(au.meltingPointK > 900 && au.densityKgPerM3 > 14000 && au.bulkModulusPa > 70e9);
  assert.ok(cu.meltingPointK > 600 && cu.densityKgPerM3 > 6000 && cu.bulkModulusPa > 60e9);
  assert.ok(ga.meltingPointK > 250 && ga.meltingPointK < 450, `Ga should be a low-melting solid, got ${ga.meltingPointK}K`);
  assert.equal(pb.standardPhaseAt298K, 'solid', `Pb should be solid at 293K, got Tm=${pb.meltingPointK}K`);

  // First-principles spin-orbit Drude-Lorentz optics separate Au (yellow) & Cu (copper) from Ag (silver)!
  const [cuR, cuG, cuB] = cu.opticalColorSrgb;
  const [agR, agG, agB] = ag.opticalColorSrgb;
  const [auR, auG, auB] = au.opticalColorSrgb;
  assert.ok(auR > auG && auG > auB && (auR - auB) > 0.15, `Au should be golden yellow: ${au.opticalColorSrgb}`);
  assert.ok(cuR > cuG && cuG > cuB, `Cu should be warm copper: ${cu.opticalColorSrgb}`);
  assert.ok((agR - agB) < (auR - auB), `Ag (${ag.opticalColorSrgb}) should be more neutral silver than Au (${au.opticalColorSrgb})`);
});

test('elementMaterialClosure supports 3-phase vaporization (solid->liquid->gas) with complete provenance and content-addressed MaterialResolverPipeline caching', async () => {
  const hgClosure = elementMaterialClosure(80, { ...FAST, includeGasPhase: true });
  assert.equal(hgClosure.symbol, 'Hg');
  assert.equal(hgClosure.properties.phases.length, 3);
  assert.equal(hgClosure.properties.transitions.length, 2);
  assert.equal(hgClosure.properties.standardPhaseAt298K, 'liquid');
  const sum = materialDerivationSummary(hgClosure.properties);
  assert.equal(sum.fullyLowerLevelDerived, true);
  assert.equal(sum.hasReducedEstimates, false);
  assert.deepEqual(sum.unprovenanced, []);

  const pipeline = createMaterialResolverPipeline();
  const first = await pipeline.resolveElement(80, { ...FAST, includeGasPhase: true });
  assert.equal(first.resolverStatus, 'cpu-derived');
  assert.equal(first.properties.standardPhaseAt298K, 'liquid');

  const second = await pipeline.resolveElement(80, { ...FAST, includeGasPhase: true });
  assert.equal(second.resolverStatus, 'cache-hit');
  assert.equal(pipeline.stats().hits, 1);

  // Changing physics fingerprint evicts stale cached entries automatically
  const evicted = pipeline.invalidateForFingerprint(`${ELEMENT_CLOSURE_GENERATOR_FINGERPRINT}::v-next`);
  assert.equal(evicted, 1);
  const third = await pipeline.resolveElement(80, { ...FAST, includeGasPhase: true });
  assert.equal(third.resolverStatus, 'cpu-derived');
  assert.equal(pipeline.stats().staleEvictions, 1);
});
