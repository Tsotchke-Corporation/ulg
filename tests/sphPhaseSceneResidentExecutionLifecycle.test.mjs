import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const sceneSourcePath = new URL(
  '../src/visualization/sphPhaseScene.js',
  import.meta.url
);

test('scene replacement preserves only canonical resident product-history continuation handles', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  const helperStart = source.indexOf(
    'function residentProductMassHandlesFromExecution'
  );
  const helperEnd = source.indexOf(
    'function destroyCapturedMlsMpmResidentExecutionArtifacts',
    helperStart
  );
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = source.slice(helperStart, helperEnd);

  assert.match(helper, /execution\?\.nextResidentProductMass/);
  assert.match(helper, /execution\?\.nextParticleUploads\?\.residentProductMass/);
  assert.match(helper, /finalStep\?\.residentProductMass/);
  assert.doesNotMatch(helper, /emittedResidentProductMass/);
  assert.doesNotMatch(helper, /inputResidentProductMass/);
  assert.doesNotMatch(helper, /retainedSteps/);
});

test('scene captured and deferred cleanup forwards exact product-history handles', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  assert.match(
    source,
    /preserveResidentProductMassHandles:\s*Object\.freeze\(\[\]\)/
  );
  assert.match(
    source,
    /cleanupState\.preserveResidentProductMassHandles/
  );
  const continuationHandleCalls = source.match(
    /preserveResidentProductMassHandles:\s*\n\s*residentProductMassHandlesFromExecution\(/g
  ) || [];
  assert.equal(continuationHandleCalls.length, 4);
});

test('production worker SS provisioning applies the reaction tri-state only at the serialized worker boundary', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  const refreshStart = source.indexOf(
    'async function refreshMlsMpmResidentSteps('
  );
  const refreshEnd = source.indexOf(
    'function ensureSurface(',
    refreshStart
  );
  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
  const refresh = source.slice(refreshStart, refreshEnd);

  assert.match(
    refresh,
    /schroederSimulation === true[\s\S]*currentReactionActivationPolicy[\s\S]*SCHROEDER_REACTION_ACTIVATION_POLICY_AUTHORITATIVE[\s\S]*currentRequestedPhysicalLawGroups\?\.reactions === true[\s\S]*const effectiveReactionTable = authoritativeDynamicReactionRouting[\s\S]*\? null[\s\S]*: lawGroups\.reactions[\s\S]*\? sphReactionTable[\s\S]*: null;/,
    'authoritative SS starts dormant while shadow/disabled/non-SS modes retain static checkbox execution semantics'
  );
  assert.match(
    refresh,
    /let effectiveReactionActivationWatchTable = null;[\s\S]*!Number\.isSafeInteger\(dormantReactionCount\)[\s\S]*Object\.is\(dormantReactionCount, -0\)[\s\S]*SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT[\s\S]*dormantReactionCount === 0[\s\S]*isExactQuiescentSphReactionTable\(sphReactionTable\)[\s\S]*effectiveReactionActivationWatchTable = sphReactionTable;/,
    'only an exact positive packed table may become dormant worker observation input'
  );

  const sharedOptionsStart = refresh.indexOf('const residentStepsOptions = {');
  const workerOptionsStart = refresh.indexOf(
    'const workerLaneScheduleArgs = {',
    sharedOptionsStart
  );
  const workerOptionsEnd = refresh.indexOf(
    'if (workerLaneAdmission.eligible)',
    workerOptionsStart
  );
  assert.ok(
    sharedOptionsStart >= 0
      && workerOptionsStart > sharedOptionsStart
      && workerOptionsEnd > workerOptionsStart
  );
  assert.doesNotMatch(
    refresh.slice(sharedOptionsStart, workerOptionsStart),
    /reactionActivationWatchTable/,
    'direct/shared resident execution must not receive a watch without its worker-authored envelope'
  );
  assert.match(
    refresh.slice(workerOptionsStart, workerOptionsEnd),
    /createSchroederWorkerResidentStepOptions\(\{\s*\.\.\.residentStepsOptions,\s*reactionActivationWatchTable:\s*effectiveReactionActivationWatchTable\s*\}\)/,
    'the separate dormant descriptor must cross only through the clone-safe worker authority boundary'
  );
  assert.match(
    refresh.slice(workerOptionsStart, workerOptionsEnd),
    /dynamicReactionRoutingAllowed:\s*authoritativeDynamicReactionRouting/,
    'the worker lane receives the exact authoritative-policy admission bit'
  );
});

test('production scene preseals and latches exact dynamic-law successors after commit', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  const scheduleStart = source.indexOf(
    'async function runWorkerLaneSchroederResidentSchedule('
  );
  const scheduleEnd = source.indexOf(
    'function workerLaneResidentExecutionFromScheduleResult(',
    scheduleStart
  );
  assert.ok(scheduleStart >= 0 && scheduleEnd > scheduleStart);
  const schedule = source.slice(scheduleStart, scheduleEnd);

  const authorityStart = schedule.indexOf(
    'targetScheduleAuthority = createSchroederTargetScheduleAuthority({'
  );
  const authorityEnd = schedule.indexOf('\n      });', authorityStart);
  assert.ok(authorityStart >= 0 && authorityEnd > authorityStart);
  const authorityCall = schedule.slice(authorityStart, authorityEnd);

  assert.match(
    authorityCall,
    /prospectiveTargetConfiguration/,
    'the next exact writer configuration must be sealed before worker dispatch'
  );
  assert.match(
    authorityCall,
    /predecessorTargetScheduleAuthority/,
    'the consuming authority must carry the exact predecessor seal'
  );
  assert.match(
    schedule,
    /staticTargetConfiguration\.writerSet\.reaction === true[\s\S]*staticTargetConfiguration\.writerSet\.gasBoundaryActionable === false[\s\S]*retainedProductGasBoundaryActionable: true/,
    'a reaction-active, gas-inactive source may preseal the retained-product writer for the next schedule boundary regardless of batch length'
  );
  assert.doesNotMatch(
    schedule,
    /requestedStepCount === 1[\s\S]{0,500}retainedProductGasBoundaryActionable: true/,
    'multi-step production presets must not be excluded from next-boundary gas preseal'
  );
  assert.match(
    schedule,
    /schroederTargetScheduleSuccessorGasBoundaryActionable\(\{\s*predecessorTargetScheduleAuthority,\s*predecessorDynamicLawObservation\s*\}\)/,
    'physical product evidence must remain inert without an exact predecessor transition or already-active writer set'
  );
  assert.doesNotMatch(
    schedule,
    /predecessorDynamicLawObservation\?\.(?:triggered|uncertainty|observationSucceeded|failureReason|failurePolicy)/,
    'shadow observation outcomes must not mutate production executable options or choose a route'
  );
  assert.doesNotMatch(
    schedule,
    /observedLiveRowCount|productHistoryLiveBoundObservation/,
    'production route selection must not branch on advisory live-count telemetry'
  );
  assert.match(
    schedule,
    /schroederTargetScheduleSuccessorReactionExecutionRequired\(\{[\s\S]*predecessorTargetScheduleAuthority,[\s\S]*predecessorDynamicLawObservation[\s\S]*\}\)/,
    'reaction execution is selected only through the exact successor-authority helper'
  );
  assert.match(
    schedule,
    /dynamicReactionTransitionAdmitted[\s\S]*state-manager-committed-worker-schedule[\s\S]*presealed-transition[\s\S]*one-use-token-ordering[\s\S]*laneState\.dynamicReactionActivation = Object\.freeze/,
    'the active latch is published only after route, preseal, token, topology, and StateManager checks'
  );
  assert.match(
    schedule,
    /sourcePhaseLaneCount === 1[\s\S]*authenticated-dynamic-reaction-successor[\s\S]*sourcePhaseLaneCount !== 4[\s\S]*preexisting-four-carrier-topology/,
    'the scene proves both isolated Tier0 one-to-four and production preexisting-four-carrier successors'
  );
});

test('worker-lane public execution projects bounded route and turnaround evidence', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  const projectionStart = source.indexOf(
    'function workerLaneResidentExecutionFromScheduleResult('
  );
  const projectionEnd = source.indexOf(
    'function compactWorkerOffscreenResidentStageStatus',
    projectionStart
  );
  assert.ok(projectionStart >= 0 && projectionEnd > projectionStart);
  const projection = source.slice(projectionStart, projectionEnd);

  assert.match(
    projection,
    /authority\?\.executionRouteAdmission\?\.receipt[\s\S]*authority\?\.executionRouteReceipt/
  );
  for (const field of [
    'routeDecisionStatus',
    'transition',
    'blockers',
    'commandSubmissionCount',
    'internalPositionSubstepCount',
    'fullParticleReadbackFree',
    'mapAsyncCount',
    'readbackBytes',
    'terminalFenceSatisfied'
  ]) {
    assert.match(projection, new RegExp(`${field}:`), field);
  }
  assert.match(projection, /scheduleFirstStepStartedAtMs:/);
  assert.match(projection, /resultAssembledAtMs:/);
  assert.match(projection, /workerLanePageTiming:/);
});

test('worker-lane churn profiling stays bounded, identity-bound, and post-commit', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  const scheduleStart = source.indexOf(
    'async function runWorkerLaneSchroederResidentSchedule('
  );
  const projectionStart = source.indexOf(
    'function workerLaneResidentExecutionFromScheduleResult(',
    scheduleStart
  );
  const projectionEnd = source.indexOf(
    'function compactWorkerOffscreenResidentStageStatus',
    projectionStart
  );
  assert.ok(
    scheduleStart >= 0
      && projectionStart > scheduleStart
      && projectionEnd > projectionStart
  );
  const schedule = source.slice(scheduleStart, projectionStart);
  const projection = source.slice(projectionStart, projectionEnd);
  const authorityCommit = schedule.indexOf(
    'await runSchroederWorkerLaneScheduleWithAuthority({'
  );
  const churnCommit = schedule.indexOf(
    'commitWorkerLaneSpatialKeyChurnCumulativeTotals({'
  );
  const laneProgressCommit = schedule.indexOf(
    'laneState.completedStepTotal += completedStepCount;'
  );
  assert.ok(
    authorityCommit >= 0
      && churnCommit > authorityCommit
      && laneProgressCommit > churnCommit,
    'diagnostic history is committed only at the admitted lane-progress seam'
  );
  assert.match(
    schedule,
    /spatialKeyChurnProfileRequested === true\s*\? createWorkerLaneSpatialKeyChurnCumulativeTotals\(\)\s*:\s*null/,
    'unprofiled lanes allocate no cumulative diagnostic state'
  );
  for (const field of ['scheduleId', 'laneId', 'stateKey']) {
    assert.match(
      projection,
      new RegExp(`${field}: spatialKeyChurnObservation\\.${field}`)
    );
  }
  assert.match(
    projection,
    /const compactGpuFence = result\.gpuFence[\s\S]*spatialKeyChurnObservation: compactSpatialKeyChurnObservation/
  );
  assert.doesNotMatch(projection, /gpuFence:\s*result\.gpuFence/);
  assert.match(projection, /spatialKeyChurnCumulativeTotals:/);
});
