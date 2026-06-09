import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createH2MicrophysicsReference,
  createH2OMicrophysicsReference,
  deriveH2Equilibrium
} from '../src/runtime/material/microphysicsReferences.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { MOONLAB_MICROPHYSICS_REFERENCE_SCHEMA, SPH_PHASE_VALIDATION_FLAGS } from '../ulg-gpu-abi/src/index.js';

test('H2 microphysics: derived equilibrium recovers the experimental bond length and bond energy', () => {
  const d = deriveH2Equilibrium();
  // Experimental H2 bond length is 0.741 A; MoonLab's curve minimum reproduces it.
  assert.ok(Math.abs(d.equilibriumBondAngstrom - 0.741) < 0.02, `eq bond ${d.equilibriumBondAngstrom}`);
  // Energy within ~5 mHa of the FCI reference.
  assert.ok(Math.abs(d.fciDeltaMilliHa) < 10, `fci delta mHa ${d.fciDeltaMilliHa}`);
  // Bond energy ~3.9 eV (minimal basis underbinds vs experiment 4.48 eV) -> right order of magnitude.
  assert.ok(d.bondEnergyEv > 3.4 && d.bondEnergyEv < 4.3, `bond energy eV ${d.bondEnergyEv}`);
  assert.ok(d.bondEnergyKjPerMol > 330 && d.bondEnergyKjPerMol < 410);
});

test('H2 microphysics reference is produced, quantitative, and non-overclaiming', () => {
  const ref = createH2MicrophysicsReference();
  assert.equal(ref.schema, MOONLAB_MICROPHYSICS_REFERENCE_SCHEMA);
  assert.equal(ref.species, 'h2');
  assert.equal(ref.quantitative, true);
  assert.equal(ref.status, 'produced-quantitative');
  assert.equal(ref.comparison.reference, 'FCI');
  for (const flag of SPH_PHASE_VALIDATION_FLAGS) assert.equal(ref[flag], false);
});

test('H2O microphysics reference is produced but model-only (not quantitative)', () => {
  const ref = createH2OMicrophysicsReference();
  assert.equal(ref.species, 'h2o');
  assert.equal(ref.quantitative, false);
  assert.equal(ref.status, 'produced-model-not-quantitative');
  assert.ok(ref.data.groundState.totalEnergyHa < -60);
  for (const flag of SPH_PHASE_VALIDATION_FLAGS) assert.equal(ref[flag], false);
});

test('H2O material closure now cites the produced microphysics reference, fe/air still pending', () => {
  const { h2o, fe, air } = createReferenceMaterialClosures();
  assert.equal(h2o.inputRefs[0].schema, MOONLAB_MICROPHYSICS_REFERENCE_SCHEMA);
  assert.equal(h2o.inputRefs[0].status, 'produced-model-not-quantitative');
  assert.ok(h2o.inputRefs[0].artifactHash);
  // Producing a model-quality reference does NOT flip material validation.
  assert.equal(h2o.validation.materialValidation, false);
  assert.equal(h2o.validation.scientificValidation, false);
  // Fe and air have no produced microphysics yet.
  assert.equal(fe.inputRefs[0].status, 'pending-not-yet-produced');
  assert.equal(air.inputRefs[0].status, 'pending-not-yet-produced');
});
