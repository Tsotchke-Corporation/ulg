import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLatestSceneRefreshRequestGate,
  mlsMpmAmbientPressureEvidenceSignature,
  resolveMlsMpmAmbientPressureEvidence
} from '../src/visualization/sphPhaseScene.js';

test('MLS-MPM ambient pressure resolves from external pressure rather than total gas pressure', () => {
  const evidence = resolveMlsMpmAmbientPressureEvidence({
    gasPressureSummary: {
      pressureFeedback: {
        schema: 'peercompute.ulg.sph-pressure-feedback.v0',
        status: 'ready',
        externalPressurePa: 101325,
        totalPressurePa: 450000
      }
    }
  });

  assert.equal(evidence.status, 'ambient-pressure-ready');
  assert.equal(evidence.source, 'pressure-feedback-external-pressure-pa');
  assert.equal(evidence.ambientPressurePa, 101325);
});

test('MLS-MPM ambient pressure preserves an explicit vacuum override', () => {
  const evidence = resolveMlsMpmAmbientPressureEvidence({
    ambientPressurePa: 0,
    pressureFeedback: { externalPressurePa: 101325 }
  });

  assert.equal(evidence.source, 'explicit-ambient-pressure-option');
  assert.equal(evidence.ambientPressurePa, 0);
});

test('MLS-MPM ambient pressure ignores incomplete explicit feedback when summary evidence is valid', () => {
  const evidence = resolveMlsMpmAmbientPressureEvidence({
    pressureFeedback: { status: 'incomplete' },
    gasPressureSummary: {
      pressureFeedback: { externalPressurePa: 101325 }
    }
  });

  assert.equal(evidence.source, 'pressure-feedback-external-pressure-pa');
  assert.equal(evidence.ambientPressurePa, 101325);
});

test('MLS-MPM ambient pressure defaults to vacuum without atmospheric evidence', () => {
  const evidence = resolveMlsMpmAmbientPressureEvidence();

  assert.equal(evidence.status, 'vacuum-default-ready');
  assert.equal(evidence.source, 'vacuum-default-no-atmospheric-evidence');
  assert.equal(evidence.ambientPressurePa, 0);
});

test('latest scene refresh gate rejects an older delayed completion', async () => {
  const gate = createLatestSceneRefreshRequestGate();
  let releaseOlder;
  let published = null;
  const olderWait = new Promise((resolve) => {
    releaseOlder = resolve;
  });
  const run = async (id, wait = null) => {
    const requestToken = gate.begin();
    if (wait) await wait;
    const stale = !gate.isLatest(requestToken);
    if (!stale) published = id;
    return { id, requestToken, stale };
  };

  const older = run('vacuum', olderWait);
  const newer = await run('atmosphere');
  releaseOlder();
  const delayed = await older;

  assert.equal(newer.stale, false);
  assert.equal(delayed.stale, true);
  assert.equal(published, 'atmosphere');
});

test('ambient pressure cache evidence distinguishes equal numeric pressure from different sources', () => {
  const explicit = resolveMlsMpmAmbientPressureEvidence({ ambientPressurePa: 101325 });
  const feedback = resolveMlsMpmAmbientPressureEvidence({
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-pressure-feedback.v0',
      status: 'ready',
      externalPressurePa: 101325
    }
  });

  assert.notEqual(
    mlsMpmAmbientPressureEvidenceSignature(explicit),
    mlsMpmAmbientPressureEvidenceSignature(feedback)
  );
});
