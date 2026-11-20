import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA,
  createWarmClosureMissBridge
} from '../src/runtime/material/warmClosureMissBridge.js';
import { ESHKOL_EOS_MODEL } from '../src/runtime/material/eshkolEosStiffness.js';

function fakeTaitSampler({ failFirst = false } = {}) {
  let calls = 0;
  let failedOnce = false;
  return {
    get calls() { return calls; },
    async runner({ service, points, qubits }) {
      calls += 1;
      if (failFirst && !failedOnce) {
        failedOnce = true;
        throw new Error('simulated A6 worker crash');
      }
      if (service === 'eshkol') {
        const samples = points.map(([rho]) => rho * (1480 ** 2) * ((rho / 1000) ** 6));
        return {
          value: { samples },
          commitDelta: {
            taskId: 'ulg-a6-client:eshkol',
            scope: 'test',
            version: calls,
            payload: { residency: { service: 'eshkol', spawns: failedOnce ? 2 : 1, calls } }
          }
        };
      }
      return {
        value: { circuit: `ghz-${qubits}`, dim: 2 ** qubits, probabilitySum: 1 },
        commitDelta: {
          taskId: 'ulg-a6-client:moonlab',
          scope: 'test',
          version: calls,
          payload: { residency: { service: 'moonlab', spawns: 1, calls } }
        }
      };
    }
  };
}

test('warmClosureMissBridge enforces G5 reservation capacity, deduplicates misses, and adopts at schedule boundary', async () => {
  const sampler = fakeTaitSampler();
  const commits = [];
  const bridge = createWarmClosureMissBridge({
    maxInFlight: 1,
    taskRunner: sampler.runner,
    onStateCommit: (delta) => commits.push(delta)
  });

  const first = bridge.requestEosStiffnessClosureMiss({
    missKey: 'h2o-tait-1',
    eosModel: ESHKOL_EOS_MODEL.TAIT,
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 1480,
    scheduleId: 'sched-1'
  });
  assert.equal(first.status, 'dispatched');

  // Same key deduplicates as in-flight; distinct key respects G5 maxInFlight=1 capacity.
  const dup = bridge.requestEosStiffnessClosureMiss({
    missKey: 'h2o-tait-1',
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 1480
  });
  assert.equal(dup.status, 'in-flight');

  const overflow = bridge.requestQuantumClosureProbeMiss({ missKey: 'q-1', qubits: 8 });
  assert.equal(overflow.status, 'capacity-deferred');
  assert.equal(bridge.getStatus().stats.capacityDeferred, 1);

  const entry = await first.promise;
  assert.equal(entry.kind, 'eos-stiffness');
  assert.ok(entry.derived.crossCheckMaxRelativeError < 1e-12);
  assert.equal(bridge.getStatus().ledgerActiveCount, 0, 'G5 reservation released after completion');

  // Schedule-boundary adoption publishes deterministic commit delta.
  const adopted = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-2' });
  assert.equal(adopted.adoptedCount, 1);
  assert.deepEqual(adopted.adoptedKeys, ['h2o-tait-1']);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].scheduleId, 'sched-2');
  assert.equal(commits[0].missKey, 'h2o-tait-1');

  // Subsequent identical miss is an instant cache hit with zero worker call.
  const hit = bridge.requestEosStiffnessClosureMiss({
    missKey: 'h2o-tait-1',
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 1480
  });
  assert.equal(hit.status, 'cache-hit');
  assert.equal(sampler.calls, 1);

  // Now capacity is free for MoonLab quantum probe.
  const q = bridge.requestQuantumClosureProbeMiss({ missKey: 'q-1', qubits: 8, scheduleId: 'sched-2' });
  assert.equal(q.status, 'dispatched');
  await q.promise;
  const adoptedQ = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-3' });
  assert.equal(adoptedQ.adoptedCount, 1);
  assert.equal(commits.length, 2);
  assert.equal(bridge.schema, ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA);
  bridge.destroy();
});

test('warmClosureMissBridge releases G5 reservations on worker failure and recovers cleanly on retry', async () => {
  const sampler = fakeTaitSampler({ failFirst: true });
  const commits = [];
  const bridge = createWarmClosureMissBridge({
    maxInFlight: 2,
    taskRunner: sampler.runner,
    onStateCommit: (delta) => commits.push(delta)
  });

  const failed = bridge.requestEosStiffnessClosureMiss({
    missKey: 'h2o-recover',
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 1480
  });
  const outcome = await failed.promise;
  assert.equal(outcome.failed, true);
  assert.match(outcome.error, /simulated A6 worker crash/);
  assert.equal(bridge.getStatus().ledgerActiveCount, 0, 'G5 reservation released on crash');
  assert.equal(bridge.getStatus().stats.failures, 1);
  assert.equal(bridge.adoptPendingAtScheduleBoundary({ scheduleId: 's1' }).adoptedCount, 0);

  // Retry succeeds cleanly and adopts.
  const recovered = bridge.requestEosStiffnessClosureMiss({
    missKey: 'h2o-recover',
    restDensityKgPerM3: 1000,
    soundSpeedMPerS: 1480
  });
  assert.equal(recovered.status, 'dispatched');
  const entry = await recovered.promise;
  assert.equal(entry.kind, 'eos-stiffness');
  const adopted = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 's2' });
  assert.equal(adopted.adoptedCount, 1);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].payload.residency.spawns, 2);
  bridge.destroy();
});
