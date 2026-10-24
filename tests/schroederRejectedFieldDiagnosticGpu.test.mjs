import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeSchroederRejectedFieldDiagnostic, schroederRejectedFieldDiagnosticWgsl }
  from '../src/runtime/sph/schroederRejectedFieldDiagnosticGpu.js';

test('rejected-field diagnostic decoder requires a fixed versioned packet', () => {
  for (const words of [null, [], new Uint32Array(63), new Uint32Array(64)]) {
    assert.equal(decodeSchroederRejectedFieldDiagnostic(words).status, 'rejected-field-diagnostic-invalid-packet');
  }
  const words = new Uint32Array(64); words.set([0x53444631, 1, 0]);
  const result = decodeSchroederRejectedFieldDiagnostic(words);
  assert.equal(result.status, 'no-cfl-rejection');
  assert.equal(result.pressure, null); assert.equal(result.key, null);
  assert.equal(result.readbackBytes, 256);
});

test('authority trace uses opt-in GPU selection, not a full mechanics-field arena download', () => {
  const source = readFileSync(new URL('../src/runtime/sph/schroederCrossLevelCouplingGpu.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /summarizeMechanicsFieldTraceWords|Math\.floor\(Number\(selectedFieldBuffer\?\.size\)/);
  assert.match(source, /wordCount: SCHROEDER_REJECTED_FIELD_DIAGNOSTIC_WORDS/);
  assert.match(source, /canonicalSpatialAuthorityTrace === true && fineGasBoundary/);
  assert.match(source, /trackCleanup\(buffer, \(\) => buffer\.destroy\(\)\)/);
  const correction = source.indexOf('lastFineGridUpdate = correctedFineGridUpdate;');
  const capture = source.indexOf('stage: `fine-${substep}-post-correction`', correction);
  const g2p = source.indexOf('canonicalEpochController.admitG2p(priorCanonicalEpoch);', correction);
  assert.ok(capture > correction && capture < g2p, 'capture before G2P clears rejected field counts');
  assert.match(schroederRejectedFieldDiagnosticWgsl, /reflux\[8u\] != params\.identity\.w/);
  for (const name of ['field_view', 'reflux', 'moment', 'moment_control', 'scratch']) {
    assert.match(schroederRejectedFieldDiagnosticWgsl, new RegExp(`var<storage, read> ${name}:`));
  }
});

test('rejected particle diagnostic borrows exact pre-G2P inputs only in the opt-in trace', () => {
  const source = readFileSync(new URL('../src/runtime/sph/schroederCrossLevelCouplingGpu.js', import.meta.url), 'utf8');
  const correction = source.indexOf('lastFineGridUpdate = correctedFineGridUpdate;');
  const g2p = source.indexOf('canonicalEpochController.admitG2p(priorCanonicalEpoch);', correction);
  const capture = source.slice(correction, g2p);
  assert.match(capture, /particleCapture: fineScratchCapture \?\s*\{[\s\S]*sphParticleUpload: currentSphUpload/);
  assert.match(capture, /mlsMpmParticleUpload: currentMlsUpload/);
  assert.match(capture, /gridSpacingM: correctedFineGridUpdate\.gridSpacingM/);
  assert.match(capture, /internalPressureScale/);
  assert.match(source, /if \(scratchCapture && particleCapture\)/);
  assert.match(source, /await import\('\.\/schroederRejectedParticleDiagnosticGpu\.js'\)/);
  assert.match(source, /fieldDiagnosticBuffer: diagnostic\.buffer/);
  assert.match(source, /wordCount: SCHROEDER_REJECTED_PARTICLE_DIAGNOSTIC_WORDS/);
  assert.match(source, /particleDiagnostic\?\.destroy\(\)/);
  assert.match(source, /particles: trace\.sources\?\./);
});
