#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
} from '../src/services/workerResidentScheduleTaskYielder.js';

export const SPH_PRESET_THROUGHPUT_MATRIX_SCHEMA =
  'peercompute.ulg.sph-preset-throughput-matrix.v1';
export const SPH_PRESET_THROUGHPUT_SCENARIO_SCHEMA =
  'peercompute.ulg.sph-preset-throughput-scenario.v1';

const DEFAULT_BASE_URL = 'https://127.0.0.1:5173';
const DEFAULT_OUTPUT = '/tmp/ulg-sph-preset-throughput-matrix.json';
const DEFAULT_INIT_TIMEOUT_MS = 300_000;
const DEFAULT_SAMPLE_TIMEOUT_MS = 600_000;
const DEFAULT_NO_PROGRESS_TIMEOUT_MS = 180_000;
const DEFAULT_POLL_MS = 250;
const DEFAULT_WARMUP_COMMIT_COUNT = 1;
const DEFAULT_SAMPLE_INTERVAL_COUNT = 2;
const DEFAULT_MIN_REALTIME_FACTOR = 1;

const TIER0_PRESET_IDS = new Set(['bulk-water', 'water-realtime']);

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeNonNegativeInteger(value) {
  const number = finiteNumber(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function scheduleOrdinal(scheduleId) {
  const match = /:schedule:(\d+)$/.exec(String(scheduleId || ''));
  if (!match) return null;
  const ordinal = Number(match[1]);
  return Number.isSafeInteger(ordinal) && ordinal > 0 ? ordinal : null;
}

function committedSampleKey(sample) {
  const pageTimeOriginMs = finiteNumber(sample?.pageTimeOriginMs);
  const laneId = nonEmptyString(sample?.laneId);
  const stateKey = nonEmptyString(sample?.stateKey);
  const scheduleId = nonEmptyString(sample?.scheduleId);
  if (pageTimeOriginMs == null || !laneId || !stateKey || !scheduleId) {
    return null;
  }
  return JSON.stringify([pageTimeOriginMs, laneId, stateKey, scheduleId]);
}

function committedSampleEvidence(sample) {
  return JSON.stringify({
    authorityCommitCompletedAtMs: finiteNumber(
      sample?.workerLanePageTiming?.authorityCommitCompletedAtMs
    ),
    workerLanePageTiming: sample?.workerLanePageTiming ?? null,
    laneCompletedStepTotal:
      safeNonNegativeInteger(sample?.laneCompletedStepTotal),
    laneSimTimeS: finiteNumber(sample?.laneSimTimeS),
    executionRoute: sample?.executionRoute ?? null,
    fullParticleReadbackFree: sample?.fullParticleReadbackFree === true,
    workerLaneContinuationReady:
      sample?.workerLaneContinuationReady === true,
    committedPresentationReady: sample?.committedPresentationReady === true,
    runtimeError: sample?.runtimeError ?? null,
    controlPlaneYieldReceipt: sample?.controlPlaneYieldReceipt ?? null
  });
}

function normalizeCommittedSamples(samples) {
  const normalized = [];
  const observedByKey = new Map();
  let duplicateSampleCount = 0;
  let conflictingCommitSampleDetected = false;
  for (const sample of samples) {
    const key = committedSampleKey(sample);
    if (key == null || !observedByKey.has(key)) {
      normalized.push(sample);
      if (key != null) {
        observedByKey.set(key, committedSampleEvidence(sample));
      }
      continue;
    }
    if (observedByKey.get(key) === committedSampleEvidence(sample)) {
      duplicateSampleCount += 1;
    } else {
      conflictingCommitSampleDetected = true;
    }
  }
  return {
    normalized,
    duplicateSampleCount,
    conflictingCommitSampleDetected
  };
}

function pageAuthorityPhaseOrderReady(sample) {
  const timing = sample?.workerLanePageTiming;
  const ordered = [
    finiteNumber(timing?.scheduleFunctionEnteredAtMs),
    finiteNumber(timing?.scheduleDispatchPostedAtMs),
    finiteNumber(timing?.scheduleTerminalReceivedAtMs),
    finiteNumber(timing?.authorityCommitCompletedAtMs),
    finiteNumber(timing?.laneExecutionReturnedAtMs)
  ];
  return ordered.every((value) => value != null && value >= 0)
    && ordered.every((value, index) => (
      index === 0 || value >= ordered[index - 1]
    ));
}

function throughputInterval(previous, current) {
  const previousScheduleOrdinal = scheduleOrdinal(previous.scheduleId);
  const currentScheduleOrdinal = scheduleOrdinal(current.scheduleId);
  const schedulesAdjacent = previousScheduleOrdinal != null
    && currentScheduleOrdinal === previousScheduleOrdinal + 1;
  const currentFirstStepStartedAtMs = finiteNumber(
    current.scheduleFirstStepStartedAtMs
  );
  const previousResultAssembledAtMs = finiteNumber(
    previous.resultAssembledAtMs
  );
  const workerTurnaroundMs = schedulesAdjacent
    && currentFirstStepStartedAtMs != null
    && previousResultAssembledAtMs != null
    ? currentFirstStepStartedAtMs - previousResultAssembledAtMs
    : null;
  const previousAuthorityCommitAtMs = finiteNumber(
    previous?.workerLanePageTiming?.authorityCommitCompletedAtMs
  );
  const authorityCommitAtMs = finiteNumber(
    current?.workerLanePageTiming?.authorityCommitCompletedAtMs
  );
  const previousCapturedAtMs = finiteNumber(previous.capturedAtMs);
  const capturedAtMs = finiteNumber(current.capturedAtMs);
  const previousSimTimeS = finiteNumber(previous.laneSimTimeS);
  const simTimeS = finiteNumber(current.laneSimTimeS);
  const previousStepTotal = safeNonNegativeInteger(
    previous.laneCompletedStepTotal
  );
  const stepTotal = safeNonNegativeInteger(current.laneCompletedStepTotal);
  const authorityCommitDeltaMs = previousAuthorityCommitAtMs != null
    && authorityCommitAtMs != null
    ? authorityCommitAtMs - previousAuthorityCommitAtMs
    : null;
  const capturedWallDeltaMs = previousCapturedAtMs != null
    && capturedAtMs != null
    ? capturedAtMs - previousCapturedAtMs
    : null;
  const simTimeDeltaS = previousSimTimeS != null && simTimeS != null
    ? simTimeS - previousSimTimeS
    : null;
  const stepDelta = previousStepTotal != null && stepTotal != null
    ? stepTotal - previousStepTotal
    : null;
  return {
    previousScheduleId: previous.scheduleId ?? null,
    scheduleId: current.scheduleId ?? null,
    previousScheduleOrdinal,
    scheduleOrdinal: currentScheduleOrdinal,
    schedulesAdjacent,
    wallDeltaMs: authorityCommitDeltaMs,
    authorityCommitDeltaMs,
    capturedWallDeltaMs,
    simTimeDeltaS,
    stepDelta,
    workerTurnaroundMs,
    previousPostComputeMs: finiteNumber(previous.lastResidentPostComputeMs)
  };
}

function throughputIntervals(samples) {
  const intervals = [];
  for (let index = 1; index < samples.length; index += 1) {
    intervals.push(throughputInterval(samples[index - 1], samples[index]));
  }
  return intervals;
}

export function expectedSphPresetExecutionRoute(presetId) {
  return TIER0_PRESET_IDS.has(String(presetId))
    ? 'tier0-fused-resident-sequence'
    : 'canonical-schroeder';
}

function routeEvidenceIsReadbackFree(sample) {
  const route = sample?.executionRoute;
  if (!route || sample?.fullParticleReadbackFree !== true) return false;
  if (route.route === 'tier0-fused-resident-sequence') {
    return route.fullParticleReadbackPerformed === false
      && route.fullParticleReadbackFree === true
      && route.mapAsyncCount === 0
      && route.readbackBytes === 0;
  }
  // Canonical receipts intentionally seal route-local byte counters as null;
  // the public execution envelope is the authoritative no-full-readback fact.
  return route.fullParticleReadbackPerformed === false;
}

function controlPlaneYieldReceiptReady(receipt, expectedRoute) {
  const scheduledYieldOpportunityCount = safeNonNegativeInteger(
    receipt?.scheduledYieldOpportunityCount
  );
  const yieldRequestCount = safeNonNegativeInteger(
    receipt?.yieldRequestCount
  );
  const completedYieldCount = safeNonNegativeInteger(
    receipt?.completedYieldCount
  );
  const messageChannelYieldCount = safeNonNegativeInteger(
    receipt?.messageChannelYieldCount
  );
  const timerFallbackYieldCount = safeNonNegativeInteger(
    receipt?.timerFallbackYieldCount
  );
  const ownedPortCount = safeNonNegativeInteger(receipt?.ownedPortCount);
  const closedPortCount = safeNonNegativeInteger(receipt?.closedPortCount);
  const totalWaitMs = finiteNumber(receipt?.totalWaitMs);
  const commonReady = Boolean(
    receipt?.schema
      === ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA
    && typeof receipt?.status === 'string'
    && typeof receipt?.mode === 'string'
    && typeof receipt?.mechanism === 'string'
    && typeof receipt?.messageChannelCreated === 'boolean'
    && receipt?.portsClosed === true
    && scheduledYieldOpportunityCount != null
    && yieldRequestCount != null
    && completedYieldCount != null
    && yieldRequestCount === completedYieldCount
    && completedYieldCount === scheduledYieldOpportunityCount
    && messageChannelYieldCount != null
    && timerFallbackYieldCount != null
    && messageChannelYieldCount + timerFallbackYieldCount
      === completedYieldCount
    && ownedPortCount != null
    && closedPortCount === ownedPortCount
    && totalWaitMs != null
    && totalWaitMs >= 0
  );
  if (!commonReady) return false;
  if (expectedRoute === 'tier0-fused-resident-sequence') {
    return receipt.status
        === 'worker-resident-schedule-control-plane-yield-not-required'
      && receipt.mode === 'none'
      && receipt.mechanism === 'none-atomic-tier0'
      && scheduledYieldOpportunityCount === 0
      && receipt.messageChannelCreated === false
      && ownedPortCount === 0
      && totalWaitMs === 0;
  }
  if (scheduledYieldOpportunityCount === 0) {
    return receipt.status
        === 'worker-resident-schedule-control-plane-yield-not-required'
      && receipt.mode === 'none'
      && receipt.mechanism === 'none-single-step-canonical'
      && receipt.messageChannelCreated === false
      && ownedPortCount === 0
      && totalWaitMs === 0;
  }
  if (
    receipt.status !== 'worker-resident-schedule-control-plane-yielder-closed'
  ) {
    return false;
  }
  if (receipt.mode === 'message-channel') {
    return receipt.mechanism === 'message-channel-task'
      && receipt.messageChannelCreated === true
      && messageChannelYieldCount === completedYieldCount
      && timerFallbackYieldCount === 0;
  }
  if (receipt.mode === 'message-channel-with-timer-fallback') {
    return receipt.mechanism
        === 'message-channel-task-with-timer-fallback'
      && receipt.messageChannelCreated === true
      && messageChannelYieldCount > 0
      && timerFallbackYieldCount > 0;
  }
  if (receipt.mode === 'timer-fallback') {
    return receipt.mechanism === 'timer-task-fallback'
      && messageChannelYieldCount === 0
      && timerFallbackYieldCount === completedYieldCount;
  }
  return false;
}

export function evaluateSphPresetThroughputSamples({
  presetId,
  samples = [],
  warmupCommitCount = DEFAULT_WARMUP_COMMIT_COUNT,
  sampleIntervalCount = DEFAULT_SAMPLE_INTERVAL_COUNT,
  minRealtimeFactor = DEFAULT_MIN_REALTIME_FACTOR
} = {}) {
  const expectedRoute = expectedSphPresetExecutionRoute(presetId);
  const warmup = nonNegativeInteger(
    warmupCommitCount,
    DEFAULT_WARMUP_COMMIT_COUNT
  );
  const observedSamples = Array.isArray(samples) ? samples : [];
  const {
    normalized,
    duplicateSampleCount,
    conflictingCommitSampleDetected
  } = normalizeCommittedSamples(observedSamples);
  const measured = normalized.slice(Math.min(warmup, normalized.length));
  const requestedIntervalCount = positiveInteger(
    sampleIntervalCount,
    DEFAULT_SAMPLE_INTERVAL_COUNT
  );
  const integrityIntervals = throughputIntervals(normalized);
  const intervals = throughputIntervals(measured);
  const cohortIdentities = normalized.map((sample) => ({
    pageTimeOriginMs: finiteNumber(sample?.pageTimeOriginMs),
    laneId: nonEmptyString(sample?.laneId),
    stateKey: nonEmptyString(sample?.stateKey)
  }));
  const cohort = cohortIdentities[0] ?? null;
  const cohortStable = normalized.length >= 1
    && cohort?.pageTimeOriginMs != null
    && cohort.pageTimeOriginMs > 0
    && cohort?.laneId != null
    && cohort?.stateKey != null
    && cohort.stateKey === `${cohort.laneId}:state`
    && cohortIdentities.every((identity) => (
      identity.pageTimeOriginMs === cohort.pageTimeOriginMs
      && identity.laneId === cohort.laneId
      && identity.stateKey === cohort.stateKey
    ));
  const normalizedScheduleIds = normalized.map(
    (sample) => nonEmptyString(sample?.scheduleId)
  );
  const normalizedScheduleOrdinals = normalizedScheduleIds.map(
    scheduleOrdinal
  );
  const scheduleIdentityReady = normalized.length >= 1
    && normalizedScheduleIds.every(Boolean)
    && new Set(normalizedScheduleIds).size === normalizedScheduleIds.length
    && normalized.every((sample, index) => (
      normalizedScheduleIds[index]?.startsWith(`${sample?.laneId}:schedule:`)
      && normalizedScheduleOrdinals[index] != null
      && (
        index === 0
        || normalizedScheduleOrdinals[index]
          > normalizedScheduleOrdinals[index - 1]
      )
    ));
  const pageAuthorityPhaseOrderValid = normalized.length >= 1
    && normalized.every(pageAuthorityPhaseOrderReady);
  const requestedIntervalCountReady = intervals.length >= requestedIntervalCount;
  const authorityHistoryReady = normalized.length >= 2
    && integrityIntervals.every((interval) => (
      interval.authorityCommitDeltaMs != null
      && interval.authorityCommitDeltaMs > 0
    ));
  const authorityCadenceReady = requestedIntervalCountReady
    && intervals.every((interval) => (
      interval.authorityCommitDeltaMs != null
      && interval.authorityCommitDeltaMs > 0
    ));
  const capturedCadenceReady = requestedIntervalCountReady
    && intervals.every((interval) => (
      interval.capturedWallDeltaMs != null
      && interval.capturedWallDeltaMs > 0
    ));
  const counterResetDetected = integrityIntervals.some((interval) => (
    (interval.stepDelta != null && interval.stepDelta < 0)
    || (interval.simTimeDeltaS != null && interval.simTimeDeltaS < 0)
  ));
  const progressSnapshotsReady = normalized.length >= 2
    && normalized.every((sample) => (
      safeNonNegativeInteger(sample?.laneCompletedStepTotal) != null
      && finiteNumber(sample?.laneSimTimeS) != null
      && sample.laneSimTimeS >= 0
    ));
  const progressCountersReady = requestedIntervalCountReady
    && progressSnapshotsReady
    && integrityIntervals.every((interval) => (
      Number.isSafeInteger(interval.stepDelta)
      && interval.stepDelta > 0
      && Number.isFinite(interval.simTimeDeltaS)
      && interval.simTimeDeltaS > 0
    ));
  const timingFailureReasons = [];
  if (!requestedIntervalCountReady) {
    timingFailureReasons.push('insufficient-measured-authority-intervals');
  }
  if (!cohortStable) {
    timingFailureReasons.push('page-lane-authority-cohort-invalid');
  }
  if (!scheduleIdentityReady) {
    timingFailureReasons.push('schedule-identity-invalid');
  }
  if (conflictingCommitSampleDetected) {
    timingFailureReasons.push('conflicting-commit-sample');
  }
  if (!pageAuthorityPhaseOrderValid) {
    timingFailureReasons.push('page-authority-phase-order-invalid');
  }
  if (!authorityHistoryReady) {
    timingFailureReasons.push('authority-commit-history-invalid');
  }
  if (!authorityCadenceReady) {
    timingFailureReasons.push('authority-commit-cadence-invalid');
  }
  if (!progressCountersReady) {
    timingFailureReasons.push('lane-progress-counters-invalid');
  }
  if (counterResetDetected) {
    timingFailureReasons.push('lane-progress-counter-reset');
  }
  const timingReady = timingFailureReasons.length === 0;
  const authorityWallDeltaMs = authorityCadenceReady
    ? finiteNumber(
        measured.at(-1)?.workerLanePageTiming?.authorityCommitCompletedAtMs
      ) - finiteNumber(
        measured[0]?.workerLanePageTiming?.authorityCommitCompletedAtMs
      )
    : null;
  const wallDeltaS = authorityWallDeltaMs != null
    ? authorityWallDeltaMs / 1000
    : null;
  const capturedWallDeltaMs = capturedCadenceReady
    ? finiteNumber(measured.at(-1)?.capturedAtMs)
      - finiteNumber(measured[0]?.capturedAtMs)
    : null;
  const capturedWallDeltaS = capturedWallDeltaMs != null
    ? capturedWallDeltaMs / 1000
    : null;
  const simTimeDeltaS = progressCountersReady
    ? finiteNumber(measured.at(-1)?.laneSimTimeS)
      - finiteNumber(measured[0]?.laneSimTimeS)
    : null;
  const stepDelta = progressCountersReady
    ? safeNonNegativeInteger(measured.at(-1)?.laneCompletedStepTotal)
      - safeNonNegativeInteger(measured[0]?.laneCompletedStepTotal)
    : null;
  const realTimeFactor = wallDeltaS > 0 && simTimeDeltaS != null
    ? simTimeDeltaS / wallDeltaS
    : null;
  const physicsStepsPerSecond = wallDeltaS > 0 && stepDelta != null
    ? stepDelta / wallDeltaS
    : null;
  const capturedRealTimeFactor = capturedWallDeltaS > 0
    && simTimeDeltaS != null
    ? simTimeDeltaS / capturedWallDeltaS
    : null;
  const capturedPhysicsStepsPerSecond = capturedWallDeltaS > 0
    && stepDelta != null
    ? stepDelta / capturedWallDeltaS
    : null;
  const routes = normalized.map((sample) => sample?.executionRoute?.route ?? null);
  const routeMatched = normalized.length >= 2
    && routes.every((route) => route === expectedRoute);
  const terminalAuthorityReady = normalized.length >= 2
    && normalized.every((sample) => (
      sample?.workerLaneContinuationReady === true
      && sample?.executionRoute?.terminalFenceSatisfied === true
      && (
        sample?.executionRoute?.route !== 'tier0-fused-resident-sequence'
        || sample?.executionRoute?.residentContinuationReady === true
      )
      && sample?.committedPresentationReady === true
    ));
  const readbackFree = normalized.length >= 2
    && normalized.every(routeEvidenceIsReadbackFree);
  const noRuntimeErrors = normalized.length >= 2
    && normalized.every((sample) => sample?.runtimeError == null);
  const controlPlaneYieldEvidenceReceipts = normalized.map(
    (sample) => sample?.controlPlaneYieldReceipt ?? null
  );
  const controlPlaneYieldReceipts = measured.map(
    (sample) => sample?.controlPlaneYieldReceipt ?? null
  );
  const controlPlaneYieldEvidenceReady = normalized.length >= 2
    && controlPlaneYieldEvidenceReceipts.every(
      (receipt) => controlPlaneYieldReceiptReady(receipt, expectedRoute)
    );
  const controlPlaneYieldMechanisms = Object.freeze([
    ...new Set(
      controlPlaneYieldReceipts
        .map((receipt) => receipt?.mechanism ?? null)
        .filter(Boolean)
    )
  ]);
  const meanControlPlaneYieldWaitMs = mean(
    controlPlaneYieldReceipts.map(
      (receipt) => finiteNumber(receipt?.totalWaitMs)
    )
  );
  const meanControlPlaneYieldWaitPerBoundaryMs = mean(
    controlPlaneYieldReceipts.map((receipt) => {
      const waitMs = finiteNumber(receipt?.totalWaitMs);
      const completedYieldCount = safeNonNegativeInteger(
        receipt?.completedYieldCount
      );
      if (waitMs == null || completedYieldCount == null) {
        return null;
      }
      return completedYieldCount > 0 ? waitMs / completedYieldCount : 0;
    })
  );
  const threshold = positiveNumber(
    minRealtimeFactor,
    DEFAULT_MIN_REALTIME_FACTOR
  );
  const realTimePassed = Number.isFinite(realTimeFactor)
    && realTimeFactor >= threshold;
  const passed = Boolean(
    timingReady
    && routeMatched
    && terminalAuthorityReady
    && readbackFree
    && noRuntimeErrors
    && controlPlaneYieldEvidenceReady
    && realTimePassed
  );
  return Object.freeze({
    status: passed ? 'pass' : 'fail',
    passed,
    presetId: String(presetId || ''),
    expectedRoute,
    warmupCommitCount: warmup,
    requestedIntervalCount,
    observedSampleCount: observedSamples.length,
    observedCommitEndpointCount: normalized.length,
    duplicateSampleCount,
    conflictingCommitSampleDetected,
    measuredCommitEndpointCount: measured.length,
    measuredIntervalCount: intervals.length,
    requestedIntervalCountReady,
    timingBasis: 'page-authority-commit',
    authorityEvidenceScope:
      'observed-commit-endpoints-with-cumulative-lane-progress',
    timingReady,
    timingFailureReasons: Object.freeze(timingFailureReasons),
    cohortStable,
    scheduleIdentityReady,
    pageAuthorityPhaseOrderValid,
    authorityHistoryReady,
    authorityCadenceReady,
    capturedCadenceReady,
    progressCountersReady,
    counterResetDetected,
    pageTimeOriginMs: cohortStable ? cohort.pageTimeOriginMs : null,
    laneId: cohortStable ? cohort.laneId : null,
    stateKey: cohortStable ? cohort.stateKey : null,
    firstMeasuredAuthorityCommitCompletedAtMs: authorityCadenceReady
      ? finiteNumber(
          measured[0]?.workerLanePageTiming?.authorityCommitCompletedAtMs
        )
      : null,
    lastMeasuredAuthorityCommitCompletedAtMs: authorityCadenceReady
      ? finiteNumber(
          measured.at(-1)?.workerLanePageTiming?.authorityCommitCompletedAtMs
        )
      : null,
    wallDeltaS,
    capturedWallDeltaS,
    simTimeDeltaS,
    stepDelta,
    realTimeFactor,
    physicsStepsPerSecond,
    capturedRealTimeFactor,
    capturedPhysicsStepsPerSecond,
    minimumRealtimeFactor: threshold,
    realTimePassed,
    routeMatched,
    terminalAuthorityReady,
    readbackFree,
    noRuntimeErrors,
    controlPlaneYieldEvidenceReady,
    controlPlaneYieldMechanisms,
    meanControlPlaneYieldWaitMs,
    meanControlPlaneYieldWaitPerBoundaryMs,
    meanWorkerTurnaroundMs: mean(
      intervals.map((interval) => interval.workerTurnaroundMs)
    ),
    meanPostComputeMs: mean(
      intervals.map((interval) => interval.previousPostComputeMs)
    ),
    intervals: Object.freeze(intervals.map((interval) => Object.freeze(interval)))
  });
}

function parseScenarioSelection(value) {
  const available = new Map(
    SPH_PHASE_SCENARIO_PRESETS.map((entry) => [entry.id, entry])
  );
  const selectedIds = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (selectedIds.length === 0) return [...available.values()];
  const missing = selectedIds.filter((id) => !available.has(id));
  if (missing.length > 0) {
    throw new Error(`unknown SPH preset(s): ${missing.join(', ')}`);
  }
  return selectedIds.map((id) => available.get(id));
}

async function compactPageSnapshot(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('#sph-phase-overlay');
    const execution = overlay?.__mlsMpmResidentSteps ?? null;
    const lane = execution?.workerOwnedResidentLane ?? null;
    const route = lane?.executionRoute ?? null;
    const presentation = lane?.committedPresentation ?? null;
    const lastStepSummary = lane?.perStepSummaries?.lastStep ?? null;
    const lastStepRing = Array.isArray(lane?.perStepSummaries?.ring)
      ? lane.perStepSummaries.ring.at(-1) ?? null
      : null;
    const perf = overlay?.__sphResidentPerf ?? null;
    const pendingPreview = overlay?.__sphPendingBodyEnvelopePreview
      ?? null;
    const workerPresentation = overlay?.__sphScene
      ?.getWorkerOffscreenPresentation?.()
      ?? null;
    return {
      capturedAtMs: performance.now(),
      pageTimeOriginMs: performance.timeOrigin,
      documentUrl: location.href,
      playText:
        document.querySelector('#sph-play')?.textContent?.trim() ?? null,
      playDisabled:
        document.querySelector('#sph-play')?.disabled === true,
      laneCompletedStepTotal: lane?.laneCompletedStepTotal ?? 0,
      laneSimTimeS: lane?.laneSimTimeS ?? 0,
      laneId: lane?.laneId ?? null,
      stateKey: lane?.stateKey ?? null,
      laneSeededThisSchedule: lane?.laneSeededThisSchedule === true,
      scheduleId: lane?.scheduleId ?? null,
      scheduleFunctionEnteredAtMs:
        lane?.scheduleFunctionEnteredAtMs ?? null,
      scheduleFirstStepStartedAtMs:
        lane?.scheduleFirstStepStartedAtMs ?? null,
      scheduleLastStepEndedAtMs:
        lane?.scheduleLastStepEndedAtMs ?? null,
      tailTerminalFenceDoneAtMs:
        lane?.tailTerminalFenceDoneAtMs ?? null,
      resultAssembledAtMs: lane?.resultAssembledAtMs ?? null,
      workerLanePageTiming: lane?.workerLanePageTiming == null
        ? null
        : { ...lane.workerLanePageTiming },
      controlPlaneYieldReceipt: lane?.controlPlaneYieldReceipt == null
        ? null
        : { ...lane.controlPlaneYieldReceipt },
      executionRoute: route == null ? null : { ...route },
      fullParticleReadbackPerformed:
        execution?.fullParticleReadbackPerformed === true,
      fullParticleReadbackFree:
        execution?.fullParticleReadbackFree === true,
      requestedReadbackMode: execution?.readbackMode ?? null,
      workerLaneContinuationReady:
        overlay?.__sphWorkerLaneContinuationReady === true,
      committedPresentationReady: Boolean(
        presentation?.stateManagerCommittedPresentation === true
        && presentation?.terminalFenceAuthorityAdmissionReady === true
        && presentation?.status
          === 'worker-offscreen-resident-particle-state-producer-rendered'
      ),
      committedPresentationStatus: presentation?.status ?? null,
      committedPresentationMode:
        presentation?.residentSchedulePresentationMode ?? null,
      committedPresentationPromotedWithoutRedraw:
        presentation?.committedPresentationPromotedWithoutRedraw === true,
      presentationAdmissionPostedAtMs:
        presentation?.presentationAdmissionPostedAtMs ?? null,
      workerPresentationUpdatedAtMs:
        presentation?.workerPresentationUpdatedAtMs ?? null,
      bridgePresentationReceivedAtMs:
        presentation?.bridgePresentationReceivedAtMs ?? null,
      workerPresentationStatus: workerPresentation?.status ?? null,
      workerPresentationSphStep: workerPresentation?.sphStep ?? null,
      particleCount:
        lane?.perStepSummaries?.lastStep?.particleCount ?? null,
      lastStepTiming: lastStepSummary == null
        ? null
        : {
            stepElapsedMs: lastStepSummary.stepElapsedMs ?? null,
            epochStageElapsedMs:
              lastStepSummary.epochStageElapsedMs ?? null,
            mechanicsStageElapsedMs:
              lastStepSummary.mechanicsStageElapsedMs ?? null,
            residentStageTiming:
              lastStepSummary.hierarchyStageSummary?.residentStageTiming
                ?? null,
            ringStepElapsedMs: lastStepRing?.stepElapsedMs ?? null,
            ringEpochStageElapsedMs:
              lastStepRing?.epochStageElapsedMs ?? null,
            ringMechanicsStageElapsedMs:
              lastStepRing?.mechanicsStageElapsedMs ?? null
          },
      submitCensus: lane?.submitCensus ?? null,
      submitBurstObservation: lane?.submitBurstObservation ?? null,
      lastResidentMs: perf?.lastResidentMs ?? null,
      lastResidentCycleMs: perf?.lastResidentCycleMs ?? null,
      lastResidentPostComputeMs: perf?.lastResidentPostComputeMs ?? null,
      renderReadbacks: perf?.renderReadbacks ?? null,
      pendingPreviewActive: pendingPreview?.active === true,
      pendingPreviewStatus: pendingPreview?.status ?? null,
      residentScheduleTrace: Array.isArray(
        overlay?.__sphResidentScheduleTrace
      )
        ? overlay.__sphResidentScheduleTrace.slice(-24).map((entry) => ({
            scheduleToken: entry?.scheduleToken ?? null,
            stage: entry?.stage ?? null,
            atMs: entry?.atMs ?? null
          }))
        : [],
      runtimeError: overlay?.__mlsMpmResidentStepsError == null
        ? null
        : String(
            overlay.__mlsMpmResidentStepsError?.message
              ?? overlay.__mlsMpmResidentStepsError
          ),
      pendingStatus: overlay?.__mlsMpmResidentStepsPending?.status ?? null,
      slowStatus: overlay?.__mlsMpmResidentStepsSlow?.status ?? null,
      statusText:
        document.querySelector('#sph-status')?.textContent?.slice(0, 1_000)
        ?? null,
      warningText:
        document.querySelector('#sph-warning-bar')?.textContent?.slice(0, 1_000)
        ?? null
    };
  });
}

async function runPreset({
  browser,
  entry,
  baseUrl,
  initTimeoutMs,
  sampleTimeoutMs,
  noProgressTimeoutMs,
  pollMs,
  warmupCommitCount,
  sampleIntervalCount,
  minRealtimeFactor
}) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 900 }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text().slice(0, 4_000));
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.stack || error?.message || error).slice(0, 8_000));
  });
  const relativeUrl = sphPhaseScenarioPresetUrl(entry.id, {
    residentAuto: '0',
    probeEpoch: String(Date.now())
  });
  const targetUrl = new URL(relativeUrl, baseUrl).toString();
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const samples = [];
  let lastSnapshot = null;
  let failure = null;
  try {
    await page.goto(targetUrl, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForSelector('#sph-phase-overlay', {
      timeout: initTimeoutMs
    });
    await page.waitForFunction(() => {
      const play = document.querySelector('#sph-play');
      return Boolean(play && play.disabled === false);
    }, null, { timeout: initTimeoutMs });
    await page.evaluate(() => {
      const play = document.querySelector('#sph-play');
      if (String(play?.textContent || '').trim() === 'Play') play.click();
    });
    const requiredCommitCount = warmupCommitCount + sampleIntervalCount + 1;
    let lastProgressAtMs = Date.now();
    let previousCompletedStepTotal = -1;
    while (Date.now() - startedAtMs < sampleTimeoutMs) {
      lastSnapshot = await compactPageSnapshot(page);
      const completedStepTotal = Number(lastSnapshot.laneCompletedStepTotal);
      if (
        Number.isFinite(completedStepTotal)
        && completedStepTotal > 0
        && completedStepTotal !== previousCompletedStepTotal
      ) {
        samples.push(lastSnapshot);
        previousCompletedStepTotal = completedStepTotal;
        lastProgressAtMs = Date.now();
        if (samples.length >= requiredCommitCount) break;
      }
      if (lastSnapshot.runtimeError != null) {
        failure = {
          type: 'runtime-error',
          message: lastSnapshot.runtimeError
        };
        break;
      }
      if (Date.now() - lastProgressAtMs > noProgressTimeoutMs) {
        failure = {
          type: 'no-progress-timeout',
          message: `no committed schedule advanced for ${noProgressTimeoutMs} ms`
        };
        break;
      }
      await page.waitForTimeout(pollMs);
    }
    if (!failure && samples.length < requiredCommitCount) {
      failure = {
        type: 'sample-timeout',
        message:
          `captured ${samples.length}/${requiredCommitCount} committed schedules`
      };
    }
  } catch (error) {
    failure = {
      type: 'probe-exception',
      message: String(error?.stack || error?.message || error)
    };
  }
  const evaluation = evaluateSphPresetThroughputSamples({
    presetId: entry.id,
    samples,
    warmupCommitCount,
    sampleIntervalCount,
    minRealtimeFactor
  });
  await context.close();
  return {
    schema: SPH_PRESET_THROUGHPUT_SCENARIO_SCHEMA,
    status: failure == null && evaluation.passed ? 'pass' : 'fail',
    presetId: entry.id,
    label: entry.label,
    targetUrl,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    failure,
    evaluation,
    samples,
    lastSnapshot,
    consoleErrors,
    pageErrors
  };
}

async function main() {
  const entries = parseScenarioSelection(
    process.env.ULG_PRESET_THROUGHPUT_SCENARIOS
  );
  const baseUrl = process.env.ULG_PRESET_THROUGHPUT_BASE_URL
    || DEFAULT_BASE_URL;
  const outputPath = path.resolve(
    process.env.ULG_PRESET_THROUGHPUT_OUTPUT || DEFAULT_OUTPUT
  );
  const headless = process.env.ULG_PRESET_THROUGHPUT_HEADLESS !== '0';
  const initTimeoutMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_INIT_TIMEOUT_MS,
    DEFAULT_INIT_TIMEOUT_MS
  );
  const sampleTimeoutMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_SAMPLE_TIMEOUT_MS,
    DEFAULT_SAMPLE_TIMEOUT_MS
  );
  const noProgressTimeoutMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_NO_PROGRESS_TIMEOUT_MS,
    DEFAULT_NO_PROGRESS_TIMEOUT_MS
  );
  const pollMs = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_POLL_MS,
    DEFAULT_POLL_MS
  );
  const warmupCommitCount = nonNegativeInteger(
    process.env.ULG_PRESET_THROUGHPUT_WARMUP_COMMITS,
    DEFAULT_WARMUP_COMMIT_COUNT
  );
  const sampleIntervalCount = positiveInteger(
    process.env.ULG_PRESET_THROUGHPUT_SAMPLE_INTERVALS,
    DEFAULT_SAMPLE_INTERVAL_COUNT
  );
  const minRealtimeFactor = positiveNumber(
    process.env.ULG_PRESET_THROUGHPUT_MIN_REALTIME_FACTOR,
    DEFAULT_MIN_REALTIME_FACTOR
  );
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--enable-unsafe-webgpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer'
    ]
  });
  const receipt = {
    schema: SPH_PRESET_THROUGHPUT_MATRIX_SCHEMA,
    status: 'running',
    startedAt: new Date().toISOString(),
    baseUrl,
    headless,
    policy: {
      timingBasis: 'page-authority-commit',
      warmupCommitCount,
      sampleIntervalCount,
      minimumRealtimeFactor: minRealtimeFactor,
      initTimeoutMs,
      sampleTimeoutMs,
      noProgressTimeoutMs,
      pollMs
    },
    scenarios: []
  };
  try {
    for (const entry of entries) {
      const scenario = await runPreset({
        browser,
        entry,
        baseUrl,
        initTimeoutMs,
        sampleTimeoutMs,
        noProgressTimeoutMs,
        pollMs,
        warmupCommitCount,
        sampleIntervalCount,
        minRealtimeFactor
      });
      receipt.scenarios.push(scenario);
      process.stdout.write(`${JSON.stringify({
        presetId: scenario.presetId,
        status: scenario.status,
        route: scenario.evaluation.expectedRoute,
        timingBasis: scenario.evaluation.timingBasis,
        timingReady: scenario.evaluation.timingReady,
        realTimeFactor: scenario.evaluation.realTimeFactor,
        physicsStepsPerSecond: scenario.evaluation.physicsStepsPerSecond,
        capturedRealTimeFactor:
          scenario.evaluation.capturedRealTimeFactor,
        meanWorkerTurnaroundMs:
          scenario.evaluation.meanWorkerTurnaroundMs,
        meanPostComputeMs: scenario.evaluation.meanPostComputeMs,
        failure: scenario.failure
      })}\n`);
    }
  } finally {
    await browser.close();
  }
  receipt.completedAt = new Date().toISOString();
  receipt.status = receipt.scenarios.length === entries.length
    && receipt.scenarios.every((scenario) => scenario.status === 'pass')
    ? 'pass'
    : 'fail';
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    schema: receipt.schema,
    status: receipt.status,
    outputPath,
    passedScenarioCount: receipt.scenarios.filter(
      (scenario) => scenario.status === 'pass'
    ).length,
    scenarioCount: receipt.scenarios.length
  })}\n`);
  if (receipt.status !== 'pass') process.exitCode = 2;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  await main();
}
