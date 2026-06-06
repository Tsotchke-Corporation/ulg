import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatHandoffAckStatus } from '../src/runtime/handoffStatus.js';

test('handoff ack status preserves compatibility prefix and surfaces readiness', () => {
  assert.equal(
    formatHandoffAckStatus({
      status: 'handoff-ready',
      scenarioId: 'magnetar',
      blockerCount: 0,
      simulationStatus: 'scientific-ready',
      artifactCount: 2
    }),
    'handoff ready / blockers 0 / scenario magnetar / scientific ready / 2 artifacts'
  );
});

test('handoff ack status tolerates sparse acks', () => {
  assert.equal(formatHandoffAckStatus({}), 'handoff sent / blockers ?');
});
