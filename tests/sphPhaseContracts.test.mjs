import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_PHASE_CLOSURE_SCHEMAS,
  SPH_PHASE_VALIDATION_FLAGS,
  assertNoOverclaim,
  assertResolutionMassInvariant,
  createConservationReport,
  createMaterialClosureArtifact,
  createParticleResolutionConfig,
  createPhaseEquilibriumArtifact,
  createWallTemperatureBoundary
} from '../ulg-gpu-abi/src/index.js';

const validDomain = { temperatureK: [200, 2000], pressurePa: [1, 1e7] };

test('material closure builder picks the family schema and defaults validation flags false', () => {
  const closure = createMaterialClosureArtifact({
    closureFamily: 'eos',
    closureId: 'fe-eos',
    material: 'fe',
    validityDomain: validDomain
  });
  assert.equal(closure.schema, SPH_PHASE_CLOSURE_SCHEMAS.eos);
  assert.equal(closure.closureBacked, true);
  for (const flag of SPH_PHASE_VALIDATION_FLAGS) {
    assert.equal(closure.validation[flag], false, `${flag} should default false`);
  }
});

test('material closure builder rejects unknown family, missing id, and bad validity domain', () => {
  assert.throws(() => createMaterialClosureArtifact({ closureFamily: 'nope', closureId: 'x', validityDomain: validDomain }), /Unknown closure family/);
  assert.throws(() => createMaterialClosureArtifact({ closureFamily: 'material', validityDomain: validDomain }), /closureId is required/);
  assert.throws(() => createMaterialClosureArtifact({ closureFamily: 'material', closureId: 'x', validityDomain: {} }), /validityDomain\.temperatureK/);
});

test('overclaim guard rejects validation flags without evidence and allows them with evidence', () => {
  assert.throws(
    () => createMaterialClosureArtifact({ closureFamily: 'material', closureId: 'x', validityDomain: validDomain, validation: { materialValidation: true } }),
    /Overclaim rejected: materialValidation/
  );
  // assertNoOverclaim directly
  assert.throws(() => assertNoOverclaim({ scientificValidation: true }), /Overclaim rejected/);
  const ok = assertNoOverclaim({ materialValidation: true }, { evidenceRefs: ['artifact://sha256:evidence'] });
  assert.equal(ok.materialValidation, true);
  // With evidence the builder allows the claim.
  const closure = createMaterialClosureArtifact({
    closureFamily: 'material',
    closureId: 'fe-validated',
    validityDomain: validDomain,
    validation: { materialValidation: true, evidenceRefs: ['artifact://sha256:moonlab-fe'] }
  });
  assert.equal(closure.validation.materialValidation, true);
  assert.equal(closure.validation.scientificValidation, false);
});

test('wall-temperature boundary requires all six faces', () => {
  assert.throws(
    () => createWallTemperatureBoundary({ faces: { xMin: 233.15, xMax: 233.15, yMin: 233.15, yMax: 233.15, zMin: 233.15 } }),
    /missing a finite temperature for face zMax/
  );
  const boundary = createWallTemperatureBoundary({
    faces: { xMin: 233.15, xMax: 233.15, yMin: 233.15, yMax: 233.15, zMin: 233.15, zMax: 233.15 }
  });
  assert.equal(boundary.faceIds.length, 6);
  assert.equal(boundary.faces.zMax, 233.15);
});

test('particle-resolution mass invariant rejects mass changes across resolutions', () => {
  const coarse = createParticleResolutionConfig({ counts: { fe: 1024 }, totalMassKg: { fe: 875, h2o: 917 } });
  const fine = createParticleResolutionConfig({ counts: { fe: 8192 }, totalMassKg: { fe: 875, h2o: 917 } });
  assert.equal(assertResolutionMassInvariant(coarse, fine), true);
  const wrong = createParticleResolutionConfig({ counts: { fe: 8192 }, totalMassKg: { fe: 870, h2o: 917 } });
  assert.throws(() => assertResolutionMassInvariant(coarse, wrong), /altered fe total mass/);
});

test('phase-equilibrium and conservation report builders stay non-overclaiming', () => {
  const eq = createPhaseEquilibriumArtifact({ material: 'h2o', temperatureK: 250, stablePhase: 'solid', phaseFractions: { solid: 1 } });
  for (const flag of SPH_PHASE_VALIDATION_FLAGS) assert.equal(eq[flag], false);
  const report = createConservationReport({ energyResidualJ: 0.5, toleranceProfile: { energyJ: 1 } });
  assert.equal(report.status, 'pass');
  const bad = createConservationReport({ energyResidualJ: 5, toleranceProfile: { energyJ: 1 } });
  assert.equal(bad.status, 'fail');
});
