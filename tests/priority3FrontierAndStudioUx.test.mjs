import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  COMPOUND_POLYTOPE_SCHEMA,
  CRYSTAL_STRUCTURE_POLYTOPE_SCHEMA,
  ELEMENT_POLYTOPE_SCHEMA,
  MATERIAL_POLYTOPE_REGISTRY_SCHEMA,
  createMaterialPolytopeRegistry,
  evaluatePolytopeMembership
} from '../src/runtime/material/materialPolytopeRegistry.js';
import { deriveMaterialScaledBodySizeM } from '../src/runtime/sphInitialBodies.js';
import {
  autoResolveStagedConfigLayout,
  buildBlankCustomConfig,
  validateStagedSimulationConfig
} from '../src/visualization/ulgSimStudioModel.js';
import {
  RADIAL_KS_EIGENSOLVER_WGSL,
  solveAtomFullWebGpu
} from '../src/runtime/electronicStructure/radialKohnShamWebGpu.js';

test('P3: MaterialPolytopeRegistry discovers convex phase polytopes, rejects extrapolation, and invalidates on closureHash change', () => {
  const reg = createMaterialPolytopeRegistry();
  assert.equal(reg.schema, MATERIAL_POLYTOPE_REGISTRY_SCHEMA);

  const fePolys = reg.discoverMaterialPolytopes({
    materialKey: 'Fe',
    family: 'element',
    meltingPointK: 1811,
    boilingPointK: 3134,
    closureHash: 'fe-closure-v1',
    crystalStructure: { lattice: 'bcc', spaceGroup: 'Im-3m', aM: 2.866e-10 }
  });
  assert.equal(fePolys.length, 3);
  assert.equal(fePolys[0].schema, CRYSTAL_STRUCTURE_POLYTOPE_SCHEMA);

  const solidHit = reg.resolveState('Fe', { temperatureK: 900, pressurePa: 101325 });
  assert.equal(solidHit.found, true);
  assert.equal(solidHit.polytope.phase, 'solid');
  assert.equal(solidHit.status, 'accepted');

  // Register a fitted response against solid Fe polytope
  reg.registerResponseFit(solidHit.polytope.polytopeId, {
    responseId: 'fe-solid-eos-cheb',
    maxRelativeError: 2e-5
  });
  const withFit = reg.resolveState('Fe', { temperatureK: 900, pressurePa: 101325 });
  assert.equal(withFit.fit?.responseId, 'fe-solid-eos-cheb');

  // Outside temperature/pressure domain fails closed (never extrapolates)
  const outside = evaluatePolytopeMembership(solidHit.polytope, { temperatureK: 2500, pressurePa: 101325 });
  assert.equal(outside.inside, false);
  assert.equal(outside.status, 'outside-domain');
  assert.equal(outside.extrapolate, false);
  assert.ok(outside.violatedInequalities.length >= 1);

  // Rediscovery with new closureHash invalidates stale response fit
  reg.discoverMaterialPolytopes({
    materialKey: 'Fe',
    family: 'element',
    meltingPointK: 1811,
    boilingPointK: 3134,
    closureHash: 'fe-closure-v2'
  });
  const afterRediscover = reg.resolveState('Fe', { temperatureK: 900, pressurePa: 101325 });
  assert.equal(afterRediscover.found, true);
  assert.equal(afterRediscover.fit, null, 'stale fit must be invalidated on closureHash change');
  assert.equal(afterRediscover.polytope.schema, ELEMENT_POLYTOPE_SCHEMA);

  const h2oPolys = reg.discoverMaterialPolytopes({
    materialKey: 'H2O',
    family: 'compound',
    meltingPointK: 273.15,
    boilingPointK: 373.15,
    closureHash: 'h2o-v1'
  });
  assert.equal(h2oPolys[0].schema, COMPOUND_POLYTOPE_SCHEMA);
});

test('P3: Studio UX helpers derive material-scaled body edges and auto-resolve overlaps/OOB with box expansion', () => {
  // Water vs Iron with equal target particle mass: denser Fe has smaller physical cell pitch!
  const waterSize = deriveMaterialScaledBodySizeM({
    particlesPerEdge: [4, 4, 4],
    densityKgPerM3: 1000,
    targetParticleMassKg: 1.0
  });
  const ironSize = deriveMaterialScaledBodySizeM({
    particlesPerEdge: [4, 4, 4],
    densityKgPerM3: 7874,
    targetParticleMassKg: 1.0
  });
  assert.ok(Math.abs(waterSize[0] - 0.4) < 1e-6);
  assert.ok(ironSize[0] < waterSize[0] * 0.55);

  // Overlapping + out-of-bounds staged config resolves automatically by expanding container & separating bodies
  const cfg = buildBlankCustomConfig();
  cfg.boxDimensionsM = [1.0, 1.0, 1.0];
  cfg.bodies = [
    {
      id: 'body-1',
      domainId: 1,
      material: 'h2o',
      sizeM: [0.8, 0.8, 0.8],
      centerM: [0, 0.4, 0],
      temperatureK: 293.15,
      particlesPerEdge: [4, 4, 4],
      velocityMPerS: [0, 0, 0]
    },
    {
      id: 'body-2',
      domainId: 2,
      material: 'fe',
      sizeM: [0.8, 0.8, 0.8],
      centerM: [0, 0.5, 0], // heavily overlaps body-1 and cannot fit vertically inside 1.0 m box!
      temperatureK: 1850,
      particlesPerEdge: [4, 4, 4],
      velocityMPerS: [0, 0, 0]
    }
  ];
  assert.equal(validateStagedSimulationConfig(cfg).valid, false);
  const resolved = autoResolveStagedConfigLayout(cfg);
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.expandedBox, true);
  const check = validateStagedSimulationConfig(resolved.config);
  assert.equal(check.valid, true, `expected auto-resolved layout to validate cleanly: ${check.errors.join('; ')}`);

  // Studio app pauses running sessions on control edit
  const studioAppSrc = readFileSync(new URL('../src/visualization/ulgSimStudioApp.js', import.meta.url), 'utf8');
  assert.match(studioAppSrc, /if \(snap\?\.running === true\)\s*\{\s*activeSession\?\.togglePlay\?\.\(\);/);
});

test('P3: solveAtomFullWebGpu fails closed without GPUDevice and exports GPU Sturm-Thomas eigensolver WGSL', async () => {
  assert.match(RADIAL_KS_EIGENSOLVER_WGSL, /fn sturm_count_below/);
  assert.match(RADIAL_KS_EIGENSOLVER_WGSL, /fn ks_solve_radial_orbitals/);
  await assert.rejects(() => solveAtomFullWebGpu(null, 2), TypeError);
});
