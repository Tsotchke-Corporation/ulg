import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { MaterialRegistry } from '../src/runtime/material/MaterialRegistry.js';
import { createMaterialPolytopeRegistry } from '../src/runtime/material/materialPolytopeRegistry.js';
import {
  compilePolytopeEshkolHigherOrderLaws,
  synthesizePolytopeMoonlabTriadClosures
} from '../src/runtime/material/polytopeAtlasBuilder.js';
import { deriveCompoundBundleWebGpu } from '../src/runtime/material/recursiveCompoundPipeline.js';
import { normalizeMaterialPropertyBank } from '../src/runtime/material/materialPropertyBank.js';

test('Gate 1-2 Complete Periodic Table Bank (118/118) & Foundation Polytope Atlas integrity', async () => {
  const elementsRaw = JSON.parse(await readFile(new URL('../data/material-properties/elements.json', import.meta.url), 'utf8'));
  const normalized = normalizeMaterialPropertyBank(elementsRaw);
  assert.equal(normalized.recordCount, 118, 'elements.json must cover all Z=1..118 including noble gases');
  for (const noble of ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og']) {
    assert.ok(normalized.bySymbol.has(noble), `Noble gas ${noble} must be present in elements.json`);
  }

  const atlas = JSON.parse(await readFile(new URL('../data/material-properties/foundation-polytope-atlas.json', import.meta.url), 'utf8'));
  assert.equal(atlas.schema, 'ulg.foundation-polytope-atlas-bank.v1');
  assert.equal(atlas.elementCount, 118);
  assert.equal(atlas.compoundCount, 15);
  assert.equal(atlas.elements.length, 118);
  assert.equal(atlas.compounds.length, 15);
  assert.equal(atlas.scientificValidation, false);
  assert.equal(atlas.g7AdvisoryOnly, true);

  // Check Iron (Z=26), Silicon (Z=14), Gold (Z=79), Oganesson (Z=118)
  const fe = atlas.elements.find((e) => e.atomicNumber === 26);
  const og = atlas.elements.find((e) => e.atomicNumber === 118);
  assert.equal(fe.electromagnetic.magneticPhase, 'ferromagnetic');
  assert.ok(fe.polytopes.length >= 4);
  assert.ok(fe.eshkolSolidLaw.surrogateRelativeBound <= 0.02);
  assert.equal(og.accuracyTier, 'tier-3-theoretical-envelope');
});

test('Gate 2-3 Triad Bridge: Eshkol Higher-Order Laws + MoonLab 5-slot A4 Synthesis + Fail-Closed MaterialRegistry Polytope Lookup', async () => {
  const h2o = await deriveCompoundBundleWebGpu(null, 'H2O', { runLiveMd: false });
  const nacl = await deriveCompoundBundleWebGpu(null, 'NaCl', { runLiveMd: false });

  // 1. Eshkol Higher-Order Law compilation (EOS + AD tangents + WGSL envelope watch)
  const eshkol = compilePolytopeEshkolHigherOrderLaws(nacl.bundle, { phase: 'solid' });
  assert.equal(eshkol.schema, 'ulg.eshkol.polytope-higher-order-laws.v1');
  assert.ok(eshkol.surrogateRelativeBound <= 0.02);
  assert.ok(eshkol.compiledWgsl.wgsl.includes('rf_eval_differential'));
  const dRhoDT = eshkol.thermalExpTangent.evaluate({ temperatureK: 400, log10PressurePa: 5.0 });
  const dRhoDLogP = eshkol.compressibilityTangent.evaluate({ temperatureK: 400, log10PressurePa: 5.0 });
  assert.ok(dRhoDT < 0, `Thermal expansion must satisfy dRho/dT < 0 (got ${dRhoDT})`);
  assert.ok(dRhoDLogP > 0, `Mechanical stability must satisfy dRho/dLogP > 0 (got ${dRhoDLogP})`);

  // 2. MoonLab + Eshkol 5-slot Triad GPU A4 synthesis + Debye G6 caloric curve
  const triad = await synthesizePolytopeMoonlabTriadClosures(h2o.bundle);
  assert.ok(triad.gpuBundle.packed.data instanceof Float32Array && triad.gpuBundle.packed.data.length > 32);
  assert.ok(Array.isArray(triad.g6DebyeSamples) && triad.g6DebyeSamples.length >= 17);
  for (let i = 1; i < triad.g6DebyeSamples.length; i += 1) {
    assert.ok(triad.g6DebyeSamples[i].u > triad.g6DebyeSamples[i - 1].u, 'Debye caloric u(T) strictly monotone');
  }

  // 3. Fail-closed MaterialRegistry Polytope Atlas integration (Gate 2 -> Gate 3)
  const polyReg = createMaterialPolytopeRegistry();
  const polys = polyReg.discoverMaterialPolytopes({
    materialKey: 'NaCl',
    family: 'compound',
    meltingPointK: nacl.bundle.thermodynamic.meltingPointK,
    boilingPointK: nacl.bundle.thermodynamic.boilingPointK,
    meltingSlopeKPerLogP: 18,
    boilingSlopeKPerLogP: 180,
    minPressurePa: 1e2,
    maxPressurePa: 1e9,
    closureHash: nacl.bundle.closureHash
  });
  polyReg.registerMaterialPolytopes('NaCl', polys);

  const matReg = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() })
  });
  matReg.attachPolytopeAtlas({ materialKey: 'NaCl', registry: polyReg, packedGpuAtlas: null });

  const inside = matReg.samplePolytopeAtlas({ material: 'NaCl', temperatureK: 300, pressurePa: 101325 });
  assert.equal(inside.status, 'sampled');
  assert.equal(inside.phase, 'solid');

  const outside = matReg.samplePolytopeAtlas({ material: 'NaCl', temperatureK: 300, pressurePa: 1e15 });
  assert.equal(outside.status, 'out-of-domain');
  assert.equal(outside.extrapolate, false);
  assert.ok(outside.refreshRequest, 'Out-of-domain polytope miss must emit refreshRequest for Tier-2/3 synthesis');
});
