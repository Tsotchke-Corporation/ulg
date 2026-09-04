import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK,
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT,
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_SCHEMA,
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION,
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE,
  createCondensedDispersedMediumOpticalClosure,
  resolveCondensedDispersedOpticalReference
} from '../src/runtime/material/condensedDispersedOpticalReferences.js';

const NAOH_ATOM_COUNTS = Object.freeze({ 11: 1, 1: 1, 8: 1 });

test('molten NaOH reference resolves by agreeing material, formula, atoms, and phase', () => {
  const resolved = resolveCondensedDispersedOpticalReference({
    material: ' NaOH ',
    formula: 'NaOH',
    atomCounts: NAOH_ATOM_COUNTS,
    condensedPhase: 'LIQUID'
  });

  assert.equal(resolved.status, 'ready');
  assert.equal(resolved.reason, null);
  assert.equal(
    resolved.bankFingerprint,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT
  );
  assert.equal(
    resolved.methodRevision,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION
  );
  assert.equal(resolved.reference.condensedPhase, 'liquid');
  assert.equal(resolved.reference.referenceTemperatureK, 693.15);
  assert.equal(resolved.reference.referenceWavelengthM, 589.4e-9);
  assert.equal(resolved.reference.condensedDensityKgPerM3, 1736.39704);
  assert.ok(Math.abs(
    (2.068 - 0.4784e-3 * 693.15) * 1000
      - resolved.reference.condensedDensityKgPerM3
  ) < 1e-9);
  assert.equal(resolved.reference.absoluteRefractiveIndexN, 1.421);
  assert.equal(resolved.reference.carrierRefractiveIndexN, 1.000293);
  assert.equal(
    resolved.reference.relativeRefractiveIndexN,
    1.420583768955696
  );
  assert.ok(Math.abs(
    resolved.reference.absoluteRefractiveIndexN
      / resolved.reference.carrierRefractiveIndexN
      - resolved.reference.relativeRefractiveIndexN
  ) < 1e-15);
  assert.equal(resolved.reference.relativeExtinctionCoefficientK, 0);
  assert.equal(resolved.reference.extinctionModel, 'lossless-model-assumption');
  assert.equal(
    resolved.reference.largeSizeRayAsymmetryFactorG,
    0.7016530763788665
  );
  assert.equal(resolved.reference.scientificValidation, false);
  assert.ok(Object.isFrozen(resolved.reference));
  assert.ok(Object.isFrozen(CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK));
});

test('NaOH reference factory publishes physical sphere inputs without claiming validation', () => {
  const closure = createCondensedDispersedMediumOpticalClosure({
    material: 'naoh',
    formula: 'NaOH',
    atomCounts: NAOH_ATOM_COUNTS,
    condensedPhase: 'liquid'
  });

  assert.ok(closure);
  assert.equal(closure.morphologyModel, 'single-compact-sphere-complex-index');
  assert.equal(closure.condensedDensityKgPerM3, 1736.39704);
  assert.equal(closure.relativeRefractiveIndexN, 1.420583768955696);
  assert.equal(closure.relativeExtinctionCoefficientK, 0);
  assert.equal(closure.largeSizeRayAsymmetryFactorG, 0.7016530763788665);
  assert.equal(closure.referenceWavelengthM, 589.4e-9);
  assert.equal(closure.provenance.status, 'reference-fallback');
  assert.equal(closure.provenance.source, CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE);
  assert.equal(
    closure.provenance.referenceBankFingerprint,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT
  );
  assert.equal(
    closure.provenance.referenceMethodRevision,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION
  );
  assert.equal(closure.provenance.extinctionModel, 'lossless-model-assumption');
  assert.deepEqual(closure.provenance.referenceTemperatureRangeK, [623, 723]);
  assert.equal(closure.provenance.runtimeApplicabilityEnforced, false);
  assert.ok(closure.provenance.blockers.includes(
    'runtime-condensed-phase-and-temperature-applicability-not-enforced'
  ));
  assert.ok(closure.provenance.blockers.includes(
    'reaction-product-phase-boundaries-and-high-temperature-composition-not-resolved'
  ));
  assert.match(closure.provenance.method, /conserved condensed mass/i);
  assert.match(closure.provenance.method, /k=0.*lossless model assumption/i);
  assert.ok(closure.provenance.sources.some((source) => (
    source.url === 'https://nvlpubs.nist.gov/nistpubs/Legacy/NSRDS/nbsnsrds15.pdf'
  )));
  assert.ok(closure.provenance.sources.some((source) => (
    source.doi === '10.1515/zpch-1922-10022'
  )));
  assert.equal(closure.scientificValidation, false);
  assert.ok(Object.isFrozen(closure));
  assert.ok(Object.isFrozen(closure.provenance.sources));
});

test('reference lookup fails closed on identity or condensed-phase mismatch', () => {
  for (const options of [
    { material: 'lioh', condensedPhase: 'liquid' },
    { material: 'naoh', formula: 'LiOH', condensedPhase: 'liquid' },
    { material: 'naoh', atomCounts: { 1: 1, 3: 1, 8: 1 }, condensedPhase: 'liquid' },
    { material: 'naoh', condensedPhase: 'solid' },
    { material: 'naoh', formula: ' ', condensedPhase: 'liquid' },
    { material: 'naoh', atomCounts: { 1: 1, 8: 1, 11: 0 }, condensedPhase: 'liquid' },
    { material: 'naoh' },
    { condensedPhase: 'liquid' }
  ]) {
    const resolved = resolveCondensedDispersedOpticalReference(options);
    assert.equal(resolved.status, 'blocked');
    assert.equal(resolved.reference, null);
    assert.equal(createCondensedDispersedMediumOpticalClosure(options), null);
  }
});

test('malformed reference data cannot produce an optical closure', () => {
  const malformedBank = JSON.parse(JSON.stringify(
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK
  ));
  malformedBank.records[0].relativeRefractiveIndexN = 9;

  const options = {
    material: 'naoh',
    condensedPhase: 'liquid',
    bank: malformedBank
  };
  const resolved = resolveCondensedDispersedOpticalReference(options);
  assert.equal(resolved.status, 'blocked');
  assert.equal(
    resolved.reason,
    'condensed-dispersed-optical-reference-bank-malformed'
  );
  assert.equal(createCondensedDispersedMediumOpticalClosure(options), null);
});

test('reference bank identity and method revision are explicit cache inputs', () => {
  assert.equal(
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK.schema,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_SCHEMA
  );
  assert.equal(
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK.methodRevision,
    CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION
  );
  assert.match(CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT, /^ulg:/);
});
