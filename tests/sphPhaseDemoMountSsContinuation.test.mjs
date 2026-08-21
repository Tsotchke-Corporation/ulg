import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  resolveSphResidentInterfaceRefreshContinuationPolicy,
  shouldSkipSphResidentPressureInterfaceForRenderRefresh,
  sphResidentChainedContinuationAllowed,
  sphResidentInterfaceRefreshPublicationIsCurrent,
  sphResidentInterfaceSchedulePublicationIsCurrent,
  sphResidentRenderSchedulePublicationIsCurrent,
  sphResidentSchedulePublicationIsCurrent,
  sphResidentPlaybackRestartAllowed
} from '../src/visualization/sphPhaseDemoMount.js';

test('canonical direct SS continuation excludes legacy post-step interface readback from the hot loop', () => {
  for (const interfaceRefreshMode of ['blocking', 'pipelined', 'disabled']) {
    const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'direct',
      pressureEnabled: true,
      reactionsEnabled: true,
      reactionCount: 3,
      interfaceRefreshMode
    });

    assert.deepEqual(policy, {
      canonicalSchroederDirectHotLoop: true,
      startLegacyPostStepInterfaceRefresh: false,
      requireInterfaceBeforeNextResidentContinuation: false,
      awaitLegacyPostStepInterfaceRefresh: false
    });
    assert.equal(Object.isFrozen(policy), true);
  }
});

test('canonical direct SS exclusion does not depend on a current reaction count', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: true,
    residentComputeManagerMode: 'direct',
    pressureEnabled: false,
    reactionsEnabled: false,
    reactionCount: 0,
    interfaceRefreshMode: 'blocking'
  });

  assert.equal(policy.canonicalSchroederDirectHotLoop, true);
  assert.equal(policy.startLegacyPostStepInterfaceRefresh, false);
  assert.equal(policy.requireInterfaceBeforeNextResidentContinuation, false);
  assert.equal(policy.awaitLegacyPostStepInterfaceRefresh, false);
});

test('legacy direct reaction playback preserves approved pressure-row continuation gating', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: false,
    residentComputeManagerMode: 'direct',
    pressureEnabled: true,
    reactionsEnabled: true,
    reactionCount: 2,
    interfaceRefreshMode: 'pipelined'
  });

  assert.deepEqual(policy, {
    canonicalSchroederDirectHotLoop: false,
    startLegacyPostStepInterfaceRefresh: true,
    requireInterfaceBeforeNextResidentContinuation: true,
    awaitLegacyPostStepInterfaceRefresh: true
  });
});

test('legacy interface refresh wires the derived continuation gate explicitly', () => {
  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const policyStart = source.indexOf(
    'const residentInterfaceRefreshContinuationPolicy ='
  );
  const continuationStart = source.indexOf(
    'let requiredInterfaceRefreshReady =',
    policyStart
  );
  assert.notEqual(policyStart, -1);
  assert.notEqual(continuationStart, -1);
  const schedulerRefreshBlock = source.slice(policyStart, continuationStart);

  assert.match(
    schedulerRefreshBlock,
    /startResidentInterfaceRefresh\(\{[\s\S]*requireBeforeNextResidentContinuation:\s*requireInterfaceBeforeNextResidentContinuation,/
  );
  assert.doesNotMatch(
    schedulerRefreshBlock,
    /\n\s*requireBeforeNextResidentContinuation,\s*\n/
  );
});

test('non-SS refresh retains configured blocking and pipelined behavior without a pressure-row gate', () => {
  const blocking = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: false,
    residentComputeManagerMode: 'direct',
    reactionCount: 0,
    interfaceRefreshMode: 'blocking'
  });
  assert.equal(blocking.startLegacyPostStepInterfaceRefresh, true);
  assert.equal(blocking.requireInterfaceBeforeNextResidentContinuation, false);
  assert.equal(blocking.awaitLegacyPostStepInterfaceRefresh, true);

  const pipelined = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: false,
    residentComputeManagerMode: 'direct',
    reactionCount: 0,
    interfaceRefreshMode: 'pipelined'
  });
  assert.equal(pipelined.startLegacyPostStepInterfaceRefresh, true);
  assert.equal(pipelined.requireInterfaceBeforeNextResidentContinuation, false);
  assert.equal(pipelined.awaitLegacyPostStepInterfaceRefresh, false);
});

test('worker execution never impersonates the canonical same-device SS direct hot loop', () => {
  const policy = resolveSphResidentInterfaceRefreshContinuationPolicy({
    schroederSimulationEnabled: true,
    residentComputeManagerMode: 'compute-manager',
    pressureEnabled: true,
    reactionsEnabled: true,
    reactionCount: 4,
    interfaceRefreshMode: 'blocking'
  });

  assert.deepEqual(policy, {
    canonicalSchroederDirectHotLoop: false,
    startLegacyPostStepInterfaceRefresh: true,
    requireInterfaceBeforeNextResidentContinuation: false,
    awaitLegacyPostStepInterfaceRefresh: true
  });
});

test('stale interface refresh tokens, generations, and detached overlays cannot republish after reset', () => {
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      overlayConnected: true
    }),
    false
  );
  const current = {
    interfaceRefreshToken: 8,
    currentInterfaceRefreshToken: 8,
    generation: 4,
    currentGeneration: 4,
    overlayConnected: true
  };
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent(current),
    true
  );
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      ...current,
      currentInterfaceRefreshToken: 9
    }),
    false
  );
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      ...current,
      currentGeneration: 5
    }),
    false
  );
  assert.equal(
    sphResidentInterfaceRefreshPublicationIsCurrent({
      ...current,
      overlayConnected: false
    }),
    false
  );
});

test('only the exact mounted scene schedule may publish after an async boundary', () => {
  const current = {
    overlayConnected: true,
    resetRebuildPending: false,
    sceneCurrent: true,
    generation: 12,
    currentGeneration: 12,
    scheduleToken: 31,
    currentScheduleToken: 31
  };
  assert.equal(sphResidentSchedulePublicationIsCurrent(current), true);
  for (const stale of [
    { overlayConnected: false },
    { resetRebuildPending: true },
    { sceneCurrent: false },
    { currentGeneration: 13 },
    { currentScheduleToken: 32 }
  ]) {
    assert.equal(
      sphResidentSchedulePublicationIsCurrent({ ...current, ...stale }),
      false
    );
  }
});

test('resident render publication additionally requires exact compute and surface modes', () => {
  const current = {
    overlayConnected: true,
    resetRebuildPending: false,
    sceneCurrent: true,
    generation: 12,
    currentGeneration: 12,
    scheduleToken: 31,
    currentScheduleToken: 31,
    residentComputeManagerMode: 'direct',
    currentResidentComputeManagerMode: 'direct',
    surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
    currentSurfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer'
  };
  assert.equal(sphResidentRenderSchedulePublicationIsCurrent(current), true);
  assert.equal(
    sphResidentRenderSchedulePublicationIsCurrent({
      ...current,
      currentResidentComputeManagerMode: 'compute-manager'
    }),
    false
  );
  assert.equal(
    sphResidentRenderSchedulePublicationIsCurrent({
      ...current,
      currentSurfaceDrawDiagnosticMode: 'three-render-row-points'
    }),
    false
  );
  assert.equal(
    sphResidentRenderSchedulePublicationIsCurrent({
      ...current,
      currentScheduleToken: 32
    }),
    false
  );
});

test('an interface refresh cannot publish after a same-generation schedule supersession', () => {
  const current = {
    interfaceRefreshToken: 7,
    currentInterfaceRefreshToken: 7,
    overlayConnected: true,
    resetRebuildPending: false,
    sceneCurrent: true,
    generation: 3,
    currentGeneration: 3,
    scheduleToken: 18,
    currentScheduleToken: 18
  };
  assert.equal(sphResidentInterfaceSchedulePublicationIsCurrent(current), true);
  assert.equal(
    sphResidentInterfaceSchedulePublicationIsCurrent({
      ...current,
      currentScheduleToken: 19
    }),
    false
  );
  assert.equal(
    sphResidentInterfaceSchedulePublicationIsCurrent({
      ...current,
      resetRebuildPending: true
    }),
    false
  );
});

test('legacy playback restart cannot bypass a required pressure-row refresh', () => {
  const ready = {
    scheduleContinuation: false,
    playing: true,
    continuationReady: true,
    generationCurrent: true,
    requiredInterfaceRefreshReady: true
  };
  assert.equal(sphResidentPlaybackRestartAllowed(ready), true);
  assert.equal(sphResidentPlaybackRestartAllowed({
    ...ready,
    requiredInterfaceRefreshReady: false
  }), false);
});

test('a paused page cancels a resident continuation captured before the pause', () => {
  const capturedContinuation = {
    scheduleContinuation: true,
    playing: true,
    scheduleCurrent: true
  };
  assert.equal(
    sphResidentChainedContinuationAllowed(capturedContinuation),
    true
  );
  assert.equal(
    sphResidentChainedContinuationAllowed({
      ...capturedContinuation,
      playing: false
    }),
    false
  );
  assert.equal(
    sphResidentChainedContinuationAllowed({
      ...capturedContinuation,
      scheduleCurrent: false
    }),
    false
  );

  const source = readFileSync(
    new URL('../src/visualization/sphPhaseDemoMount.js', import.meta.url),
    'utf8'
  );
  const branchStart = source.indexOf(
    '} else if (scheduleContinuation && residentScheduleIsCurrent()) {'
  );
  const branchEnd = source.indexOf(
    '} else if (restartPlaybackContinuation && residentScheduleIsCurrent()) {',
    branchStart
  );
  assert.notEqual(branchStart, -1);
  assert.notEqual(branchEnd, -1);
  const branch = source.slice(branchStart, branchEnd);
  assert.match(
    branch,
    /requestAnimationFrame\(\(\) => \{[\s\S]*sphResidentChainedContinuationAllowed\(\{[\s\S]*scheduleContinuation,[\s\S]*playing,[\s\S]*scheduleCurrent:\s*residentScheduleIsCurrent\(\)[\s\S]*\}\)[\s\S]*scheduleMlsMpmResidentSteps/
  );
});

test('canonical SS render-mode refresh skips the legacy pressure-interface producer', () => {
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'direct'
    }),
    true
  );
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: false,
      residentComputeManagerMode: 'direct'
    }),
    false
  );
  assert.equal(
    shouldSkipSphResidentPressureInterfaceForRenderRefresh({
      schroederSimulationEnabled: true,
      residentComputeManagerMode: 'compute-manager'
    }),
    false
  );
});
