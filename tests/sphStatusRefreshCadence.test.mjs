import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_STATUS_REFRESH_MIN_INTERVAL_MS,
  resolveSphStatusRefreshDecision
} from '../src/visualization/sphPhaseDemoMount.js';

test('hidden status panel skips the traversal entirely', () => {
  const decision = resolveSphStatusRefreshDecision({
    panelHidden: true,
    lastRenderMs: 0,
    nowMs: 10_000
  });
  assert.equal(decision.action, 'skip-hidden');
});

test('a cold status render runs immediately on the leading edge', () => {
  const decision = resolveSphStatusRefreshDecision({
    panelHidden: false,
    lastRenderMs: 0,
    nowMs: 10_000
  });
  assert.equal(decision.action, 'render-now');
});

test('calls inside the cadence window defer by the exact remainder', () => {
  const decision = resolveSphStatusRefreshDecision({
    panelHidden: false,
    lastRenderMs: 10_000,
    nowMs: 10_000 + 100
  });
  assert.equal(decision.action, 'defer');
  assert.equal(decision.delayMs, SPH_STATUS_REFRESH_MIN_INTERVAL_MS - 100);
});

test('the cadence boundary itself renders immediately', () => {
  const decision = resolveSphStatusRefreshDecision({
    panelHidden: false,
    lastRenderMs: 10_000,
    nowMs: 10_000 + SPH_STATUS_REFRESH_MIN_INTERVAL_MS
  });
  assert.equal(decision.action, 'render-now');
});

test('non-finite clocks fail open to an immediate render, never a stall', () => {
  const decision = resolveSphStatusRefreshDecision({
    panelHidden: false,
    lastRenderMs: Number.NaN,
    nowMs: Number.NaN
  });
  assert.equal(decision.action, 'render-now');
});

test('the exported cadence is the documented bound', () => {
  assert.equal(SPH_STATUS_REFRESH_MIN_INTERVAL_MS, 250);
});
