export const ULG_SCHROEDER_HIERARCHY_HOST_TIMING_SCHEMA =
  'peercompute.ulg.schroeder-hierarchy-host-stage-accumulator.v0';

const DEFAULT_MAX_STAGE_COUNT = 64;
const MAX_STAGE_NAME_LENGTH = 128;

function finiteNonnegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function finiteSequenceIndex(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function normalizedStageName(value) {
  if (typeof value !== 'string') return null;
  const stage = value.trim();
  if (!stage || stage.length > MAX_STAGE_NAME_LENGTH) return null;
  return stage;
}

function frozenStageSnapshot(stage) {
  return Object.freeze({
    count: stage.count,
    failedCount: stage.failedCount,
    totalMs: stage.totalMs,
    minMs: stage.minMs,
    maxMs: stage.maxMs,
    lastMs: stage.lastMs,
    firstSequenceIndex: stage.firstSequenceIndex,
    lastSequenceIndex: stage.lastSequenceIndex,
    maxSequenceIndex: stage.maxSequenceIndex
  });
}

/**
 * Bounded host-only timing for the existing Schroeder hierarchy progress
 * stream. The accumulator never submits GPU work, creates queries, maps a
 * buffer, waits on a queue, or mutates a physics source.
 */
export function createSchroederHierarchyHostTimingAccumulator({
  requested = true,
  maxStageCount = DEFAULT_MAX_STAGE_COUNT,
  now = () => globalThis.performance?.now?.() ?? Date.now()
} = {}) {
  const resolvedMaxStageCount = Number.isSafeInteger(maxStageCount)
    && maxStageCount > 0
    ? maxStageCount
    : DEFAULT_MAX_STAGE_COUNT;
  const stages = new Map();
  const queueStages = new Map();
  const activeCalls = new WeakSet();
  const completedCalls = new WeakSet();
  let active = null;
  let hierarchyCallCount = 0;
  let hierarchyCallCompletedCount = 0;
  let hierarchyCallFailedCount = 0;
  let hierarchyCallTotalMs = 0;
  let hierarchyCallMinMs = null;
  let hierarchyCallMaxMs = 0;
  let hierarchyCallLastMs = 0;
  let hierarchyCallMaxSequenceIndex = null;
  let stageOverflowCount = 0;

  const safeNow = () => {
    try {
      return finiteNonnegative(now()) ?? 0;
    } catch {
      return 0;
    }
  };

  const updateStageMap = ({
    target,
    stage,
    elapsedMs,
    failed,
    sequenceIndex
  }) => {
    const name = normalizedStageName(stage);
    const elapsed = finiteNonnegative(elapsedMs);
    if (!name || elapsed == null) return false;
    let summary = target.get(name);
    if (!summary) {
      if (target.size >= resolvedMaxStageCount) {
        stageOverflowCount += 1;
        return false;
      }
      summary = {
        count: 0,
        failedCount: 0,
        totalMs: 0,
        minMs: null,
        maxMs: 0,
        lastMs: 0,
        firstSequenceIndex: null,
        lastSequenceIndex: null,
        maxSequenceIndex: null
      };
      target.set(name, summary);
    }
    const index = finiteSequenceIndex(sequenceIndex);
    summary.count += 1;
    summary.failedCount += failed === true ? 1 : 0;
    summary.totalMs += elapsed;
    summary.minMs = summary.minMs == null
      ? elapsed
      : Math.min(summary.minMs, elapsed);
    summary.maxMs = Math.max(summary.maxMs, elapsed);
    summary.lastMs = elapsed;
    if (index != null) {
      summary.firstSequenceIndex ??= index;
      summary.lastSequenceIndex = index;
      summary.maxSequenceIndex = summary.maxSequenceIndex == null
        ? index
        : Math.max(summary.maxSequenceIndex, index);
    }
    return true;
  };

  const updateStage = (entry) => updateStageMap({
    target: stages,
    ...entry
  });

  const measureQueueStage = async (descriptor = {}, runner) => {
    if (typeof runner !== 'function') {
      throw new TypeError('measureQueueStage requires a runner');
    }
    const stage = normalizedStageName(descriptor?.stage);
    const startedAtMs = safeNow();
    let failed = false;
    try {
      return await runner();
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (stage) {
        updateStageMap({
          target: queueStages,
          stage,
          elapsedMs: Math.max(0, safeNow() - startedAtMs),
          failed,
          sequenceIndex: descriptor?.sequenceIndex
        });
      }
    }
  };

  const markHostPoint = () => {};

  const recordStageEvent = (event = {}) => {
    if (event?.hierarchyStage !== true) return false;
    const stage = normalizedStageName(event.stage);
    if (!stage) {
      stageOverflowCount += 1;
      return false;
    }
    const status = String(event.status || '');
    const sequenceIndex = finiteSequenceIndex(event.sequenceIndex);
    if (status === 'schroeder-hierarchy-stage-started') {
      active = Object.freeze({
        stage,
        sequenceIndex,
        startedAtMs: safeNow()
      });
      return true;
    }
    const failed = status === 'schroeder-hierarchy-stage-failed';
    if (!failed && status !== 'schroeder-hierarchy-stage-complete') {
      return false;
    }
    const recorded = updateStage({
      stage,
      elapsedMs: event.elapsedMs,
      failed,
      sequenceIndex
    });
    if (active?.stage === stage) active = null;
    return recorded;
  };

  const beginHierarchyCall = (sequenceIndex = null) => {
    const token = {
      startedAtMs: safeNow(),
      sequenceIndex: finiteSequenceIndex(sequenceIndex)
    };
    activeCalls.add(token);
    hierarchyCallCount += 1;
    return token;
  };

  const endHierarchyCall = (token, { failed = false } = {}) => {
    if (
      !token
      || !activeCalls.has(token)
      || completedCalls.has(token)
    ) return false;
    completedCalls.add(token);
    const elapsed = Math.max(0, safeNow() - token.startedAtMs);
    hierarchyCallCompletedCount += 1;
    hierarchyCallFailedCount += failed === true ? 1 : 0;
    hierarchyCallTotalMs += elapsed;
    hierarchyCallMinMs = hierarchyCallMinMs == null
      ? elapsed
      : Math.min(hierarchyCallMinMs, elapsed);
    hierarchyCallMaxMs = Math.max(hierarchyCallMaxMs, elapsed);
    hierarchyCallLastMs = elapsed;
    if (token.sequenceIndex != null) {
      hierarchyCallMaxSequenceIndex = hierarchyCallMaxSequenceIndex == null
        ? token.sequenceIndex
        : Math.max(hierarchyCallMaxSequenceIndex, token.sequenceIndex);
    }
    active = null;
    return true;
  };

  const snapshot = () => {
    const stageEntries = [...stages.entries()].sort(([left], [right]) => (
      left.localeCompare(right)
    ));
    const queueStageEntries = [...queueStages.entries()].sort(
      ([left], [right]) => left.localeCompare(right)
    );
    const namedStageTotalMs = stageEntries.reduce(
      (sum, [, stage]) => sum + stage.totalMs,
      0
    );
    return Object.freeze({
      schema: ULG_SCHROEDER_HIERARCHY_HOST_TIMING_SCHEMA,
      status: hierarchyCallFailedCount > 0
        ? 'schroeder-hierarchy-host-timing-collected-with-failures'
        : (
            hierarchyCallCompletedCount < hierarchyCallCount
              ? 'schroeder-hierarchy-host-timing-collecting'
              : 'schroeder-hierarchy-host-timing-collected'
          ),
      requested: requested === true,
      diagnosticOnly: true,
      measurementKind: 'inclusive-host-await-wall-accumulator',
      intervalSemantics:
        'natural-host-await-only-no-added-submit-query-map-fence',
      hierarchyCallCount,
      hierarchyCallCompletedCount,
      hierarchyCallFailedCount,
      hierarchyCallTotalMs,
      hierarchyCallMinMs,
      hierarchyCallMaxMs,
      hierarchyCallLastMs,
      hierarchyCallMaxSequenceIndex,
      namedStageTotalMs,
      unattributedOuterMs: Math.max(
        0,
        hierarchyCallTotalMs - namedStageTotalMs
      ),
      namedStageOverlapMs: Math.max(
        0,
        namedStageTotalMs - hierarchyCallTotalMs
      ),
      active: active ? Object.freeze({ ...active }) : null,
      stages: Object.freeze(Object.fromEntries(
        stageEntries.map(([stage, summary]) => [
          stage,
          frozenStageSnapshot(summary)
        ])
      )),
      queueStages: Object.freeze(Object.fromEntries(
        queueStageEntries.map(([stage, summary]) => [
          stage,
          frozenStageSnapshot(summary)
        ])
      )),
      stageOverflowCount,
      maxStageCount: resolvedMaxStageCount,
      queryCount: 0,
      markerSubmissionCount: 0,
      mapAsyncCount: 0,
      queueFenceCount: 0,
      readbackBytes: 0,
      sourceMutation: false,
      scientificValidation: false
    });
  };

  return Object.freeze({
    active: requested === true,
    measureQueueStage,
    markHostPoint,
    recordStageEvent,
    beginHierarchyCall,
    endHierarchyCall,
    snapshot
  });
}
