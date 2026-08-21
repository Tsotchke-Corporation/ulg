import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  ULG_SCHROEDER_HIERARCHY_HOST_TIMING_SCHEMA,
  createSchroederHierarchyHostTimingAccumulator
} from '../src/runtime/sph/schroederHierarchyHostTiming.js';

test('hierarchy host timing stays bounded and adds no GPU synchronization evidence', () => {
  let clockMs = 100;
  const timing = createSchroederHierarchyHostTimingAccumulator({
    maxStageCount: 2,
    now: () => clockMs
  });
  const call = timing.beginHierarchyCall(7);
  assert.equal(timing.recordStageEvent({
    hierarchyStage: true,
    status: 'schroeder-hierarchy-stage-started',
    stage: 'spatial-epoch-generation',
    sequenceIndex: 7
  }), true);
  clockMs = 104;
  assert.equal(timing.recordStageEvent({
    hierarchyStage: true,
    status: 'schroeder-hierarchy-stage-complete',
    stage: 'spatial-epoch-generation',
    sequenceIndex: 7,
    elapsedMs: 4
  }), true);
  assert.equal(timing.recordStageEvent({
    hierarchyStage: true,
    status: 'schroeder-hierarchy-stage-failed',
    stage: 'law-queue',
    sequenceIndex: 7,
    elapsedMs: 2
  }), true);
  assert.equal(timing.recordStageEvent({
    hierarchyStage: true,
    status: 'schroeder-hierarchy-stage-complete',
    stage: 'third-stage-is-bounded-out',
    sequenceIndex: 7,
    elapsedMs: 1
  }), false);
  assert.equal(timing.recordStageEvent({
    hierarchyStage: false,
    status: 'schroeder-hierarchy-stage-complete',
    stage: 'foreign-inner-stage',
    elapsedMs: 999
  }), false);
  assert.equal(timing.recordStageEvent({
    hierarchyStage: true,
    status: 'schroeder-hierarchy-stage-complete',
    stage: 'law-queue',
    elapsedMs: Number.NaN
  }), false);
  clockMs = 110;
  assert.equal(timing.endHierarchyCall(call), true);
  assert.equal(timing.endHierarchyCall(call), false);

  const snapshot = timing.snapshot();
  assert.equal(snapshot.schema, ULG_SCHROEDER_HIERARCHY_HOST_TIMING_SCHEMA);
  assert.equal(snapshot.status, 'schroeder-hierarchy-host-timing-collected');
  assert.equal(snapshot.hierarchyCallCount, 1);
  assert.equal(snapshot.hierarchyCallCompletedCount, 1);
  assert.equal(snapshot.hierarchyCallTotalMs, 10);
  assert.equal(snapshot.namedStageTotalMs, 6);
  assert.equal(snapshot.unattributedOuterMs, 4);
  assert.equal(snapshot.namedStageOverlapMs, 0);
  assert.equal(snapshot.stageOverflowCount, 1);
  assert.equal(snapshot.stages['spatial-epoch-generation'].count, 1);
  assert.equal(snapshot.stages['spatial-epoch-generation'].totalMs, 4);
  assert.equal(snapshot.stages['law-queue'].failedCount, 1);
  assert.equal(snapshot.queryCount, 0);
  assert.equal(snapshot.markerSubmissionCount, 0);
  assert.equal(snapshot.mapAsyncCount, 0);
  assert.equal(snapshot.queueFenceCount, 0);
  assert.equal(snapshot.readbackBytes, 0);
  assert.equal(snapshot.sourceMutation, false);
  assert.equal(Object.hasOwn(snapshot, 'spans'), false);
  assert.equal(Object.hasOwn(snapshot, 'samples'), false);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.stages), true);
  assert.equal(Object.isFrozen(snapshot.queueStages), true);
});

test('hierarchy host timing measures nested queue stages without adding queue synchronization', async () => {
  let clockMs = 10;
  const timing = createSchroederHierarchyHostTimingAccumulator({
    now: () => clockMs
  });
  const result = await timing.measureQueueStage(
    { stage: 'fine-0-p2g', sequenceIndex: 4 },
    async () => {
      clockMs = 13.5;
      return 'projected';
    }
  );
  assert.equal(result, 'projected');
  await assert.rejects(
    timing.measureQueueStage({ stage: 'fine-0-g2p' }, async () => {
      clockMs = 15;
      throw new Error('g2p failed');
    }),
    /g2p failed/
  );

  const snapshot = timing.snapshot();
  assert.equal(timing.active, true);
  assert.equal(snapshot.queueStages['fine-0-p2g'].totalMs, 3.5);
  assert.equal(snapshot.queueStages['fine-0-p2g'].maxSequenceIndex, 4);
  assert.equal(snapshot.queueStages['fine-0-g2p'].failedCount, 1);
  assert.equal(snapshot.namedStageTotalMs, 0);
  assert.equal(snapshot.queryCount, 0);
  assert.equal(snapshot.markerSubmissionCount, 0);
  assert.equal(snapshot.mapAsyncCount, 0);
  assert.equal(snapshot.queueFenceCount, 0);
  assert.equal(snapshot.readbackBytes, 0);
});

test('hierarchy host timing reports active and failed calls without throwing on a bad clock', () => {
  let calls = 0;
  const timing = createSchroederHierarchyHostTimingAccumulator({
    now() {
      calls += 1;
      if (calls === 2) throw new Error('diagnostic clock failure');
      return 25;
    }
  });
  const call = timing.beginHierarchyCall(3);
  timing.recordStageEvent({
    hierarchyStage: true,
    status: 'schroeder-hierarchy-stage-started',
    stage: 'resident-step-dispatch',
    sequenceIndex: 3
  });
  assert.equal(timing.snapshot().active.stage, 'resident-step-dispatch');
  assert.equal(timing.endHierarchyCall(call, { failed: true }), true);
  const snapshot = timing.snapshot();
  assert.equal(
    snapshot.status,
    'schroeder-hierarchy-host-timing-collected-with-failures'
  );
  assert.equal(snapshot.hierarchyCallFailedCount, 1);
  assert.equal(snapshot.active, null);
});

test('scene and probe wire host timing independently of GPU timestamp and fence controls', async () => {
  const [sceneSource, probeSource] = await Promise.all([
    readFile(
      new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
      'utf8'
    )
  ]);
  assert.match(
    sceneSource,
    /collectSchroederHierarchyHostTiming = false/
  );
  assert.match(
    sceneSource,
    /onResidentStageProgress\(progress = \{\}\) \{[\s\S]*?recordStageEvent\(progress\)/
  );
  assert.match(
    sceneSource,
    /beginHierarchyCall\(index\)[\s\S]*?runSchroederSameLevelMechanicsWebGpu\([\s\S]*?endHierarchyCall/
  );
  assert.match(
    probeSource,
    /ULG_PROBE_COLLECT_SCHROEDER_HIERARCHY_HOST_TIMING/
  );
  assert.match(
    probeSource,
    /collectSchroederHierarchyHostTiming: Boolean\([\s\S]*?requestedCollectSchroederHierarchyHostTiming/
  );
  assert.match(
    probeSource,
    /residentSchroederHierarchyHostTiming:[\s\S]*?\.snapshot\?\.\(\)/
  );
  assert.match(
    probeSource,
    /queueStages:\s*Object\.fromEntries\([\s\S]*?timing\.queueStages/
  );
  assert.doesNotMatch(
    sceneSource,
    /gpuTimestampRecorder:\s*collectSchroederHierarchyHostTiming/
  );
  assert.doesNotMatch(
    probeSource,
    /schroederGpuTimestampRecorder:\s*requestedCollectSchroederHierarchyHostTiming/
  );
  assert.match(
    sceneSource,
    /gpuTimestampRecorder:\s*schroederGpuTimestampRecorder[\s\S]*?\?\? schroederHierarchyHostTiming/
  );
});
