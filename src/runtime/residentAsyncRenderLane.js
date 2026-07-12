export const RESIDENT_ASYNC_RENDER_LANE_SCHEMA =
  'peercompute.ulg.resident-async-render-lane.v0';
export const RESIDENT_EXECUTION_CONSUMER_LEASE_SCHEMA =
  'peercompute.ulg.resident-execution-consumer-lease.v0';

const residentExecutionConsumerRecords = new WeakMap();

export function createResidentRenderSourceSubmissionGate() {
  let settled = false;
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return Object.freeze({
    promise,
    publish(evidence) {
      if (settled) return false;
      settled = true;
      resolve(evidence);
      return true;
    },
    get settled() {
      return settled;
    }
  });
}

function objectKey(value) {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function acquireResidentExecutionConsumerLease(execution, {
  consumer = 'async-consumer'
} = {}) {
  if (!objectKey(execution)) {
    return {
      schema: RESIDENT_EXECUTION_CONSUMER_LEASE_SCHEMA,
      status: 'resident-execution-consumer-lease-source-unavailable',
      active: false,
      consumer,
      release() {
        return {
          status: 'resident-execution-consumer-lease-release-skipped',
          activeLeaseCount: 0,
          deferredCleanupCount: 0,
          cleanupErrors: []
        };
      }
    };
  }

  let record = residentExecutionConsumerRecords.get(execution);
  if (!record) {
    record = {
      nextLeaseId: 1,
      activeLeaseCount: 0,
      deferredCleanups: []
    };
    residentExecutionConsumerRecords.set(execution, record);
  }
  const leaseId = record.nextLeaseId;
  record.nextLeaseId += 1;
  record.activeLeaseCount += 1;
  let released = false;

  return {
    schema: RESIDENT_EXECUTION_CONSUMER_LEASE_SCHEMA,
    status: 'resident-execution-consumer-lease-acquired',
    active: true,
    leaseId,
    consumer,
    release(reason = 'async-consumer-settled') {
      if (released) {
        return {
          status: 'resident-execution-consumer-lease-already-released',
          leaseId,
          activeLeaseCount: record.activeLeaseCount,
          deferredCleanupCount: record.deferredCleanups.length,
          cleanupErrors: []
        };
      }
      released = true;
      record.activeLeaseCount = Math.max(0, record.activeLeaseCount - 1);
      const cleanupErrors = [];
      let releasedCleanupCount = 0;
      if (record.activeLeaseCount === 0) {
        const cleanups = record.deferredCleanups.splice(0);
        releasedCleanupCount = cleanups.length;
        for (const cleanup of cleanups) {
          try {
            cleanup();
          } catch (error) {
            cleanupErrors.push(errorMessage(error));
          }
        }
        if (record.deferredCleanups.length === 0) {
          residentExecutionConsumerRecords.delete(execution);
        }
      }
      return {
        status: cleanupErrors.length
          ? 'resident-execution-consumer-lease-released-with-cleanup-errors'
          : 'resident-execution-consumer-lease-released',
        leaseId,
        reason,
        activeLeaseCount: record.activeLeaseCount,
        releasedCleanupCount,
        deferredCleanupCount: record.deferredCleanups.length,
        cleanupErrors
      };
    }
  };
}

export function deferResidentExecutionCleanupUntilConsumersRelease(execution, cleanup) {
  if (typeof cleanup !== 'function') {
    throw new TypeError('resident execution cleanup must be a function');
  }
  const record = objectKey(execution)
    ? residentExecutionConsumerRecords.get(execution)
    : null;
  if (!record || record.activeLeaseCount === 0) {
    cleanup();
    return {
      schema: RESIDENT_EXECUTION_CONSUMER_LEASE_SCHEMA,
      status: 'resident-execution-cleanup-executed-without-active-consumers',
      deferred: false,
      activeLeaseCount: 0,
      deferredCleanupCount: 0
    };
  }
  record.deferredCleanups.push(cleanup);
  return {
    schema: RESIDENT_EXECUTION_CONSUMER_LEASE_SCHEMA,
    status: 'resident-execution-cleanup-deferred-for-active-consumers',
    deferred: true,
    activeLeaseCount: record.activeLeaseCount,
    deferredCleanupCount: record.deferredCleanups.length
  };
}

export function residentExecutionConsumerLeaseState(execution) {
  const record = objectKey(execution)
    ? residentExecutionConsumerRecords.get(execution)
    : null;
  return {
    schema: RESIDENT_EXECUTION_CONSUMER_LEASE_SCHEMA,
    status: record
      ? 'resident-execution-consumer-lease-state-ready'
      : 'resident-execution-consumer-lease-state-empty',
    activeLeaseCount: record?.activeLeaseCount ?? 0,
    deferredCleanupCount: record?.deferredCleanups.length ?? 0
  };
}

export function createLatestWinsAsyncLane({
  execute,
  shouldStart = null,
  shouldPublish = null,
  onSuccess = null,
  onError = null,
  onDiscardedResult = null,
  onEvent = null
} = {}) {
  if (typeof execute !== 'function') {
    throw new TypeError('latest-wins async lane requires an execute function');
  }

  let activeEntry = null;
  let pendingEntry = null;
  let closed = false;
  let sequence = 0;
  let completedCount = 0;
  let supersededCount = 0;
  const idleWaiters = [];

  const state = (status, entry = null, extra = {}) => ({
    schema: RESIDENT_ASYNC_RENDER_LANE_SCHEMA,
    status,
    sequence: entry?.sequence ?? sequence,
    entrySuperseded: entry?.superseded === true,
    supersededBySequence: entry?.supersededBySequence ?? null,
    active: Boolean(activeEntry),
    activeSequence: activeEntry?.sequence ?? null,
    activeSuperseded: activeEntry?.superseded === true,
    pending: Boolean(pendingEntry),
    pendingSequence: pendingEntry?.sequence ?? null,
    completedCount,
    supersededCount,
    closed,
    ...extra
  });

  const emit = (status, entry = null, extra = {}) => {
    const snapshot = state(status, entry, extra);
    try {
      onEvent?.(snapshot, entry?.request ?? null);
    } catch {
      // Telemetry observers cannot own or interrupt the lane.
    }
    return snapshot;
  };

  const releaseEntry = (entry, reason) => {
    if (!entry || entry.released) return null;
    entry.released = true;
    try {
      return entry.request?.release?.(reason) ?? null;
    } catch (error) {
      return {
        status: 'resident-async-render-lane-release-error',
        error: errorMessage(error)
      };
    }
  };

  const settleDiscarded = (entry, status, reason) => {
    releaseEntry(entry, reason);
    const result = state(status, entry, { reason, published: false });
    entry.resolve(result);
    emit(status, entry, { reason, published: false });
    return result;
  };

  const resolveIdleWaiters = () => {
    if (activeEntry || pendingEntry) return;
    const waiters = idleWaiters.splice(0);
    const snapshot = state(closed
      ? 'resident-async-render-lane-closed-idle'
      : 'resident-async-render-lane-idle');
    for (const resolve of waiters) resolve(snapshot);
  };

  const startNext = () => {
    if (activeEntry) return;
    if (closed || !pendingEntry) {
      resolveIdleWaiters();
      return;
    }
    const next = pendingEntry;
    pendingEntry = null;
    void runEntry(next);
  };

  const invoke = async (callback, ...args) => {
    if (typeof callback !== 'function') return null;
    return callback(...args);
  };

  async function runEntry(entry) {
    activeEntry = entry;
    let allowedToStart = !closed;
    if (allowedToStart && typeof shouldStart === 'function') {
      try {
        allowedToStart = (await shouldStart(entry.request, state('start-check', entry))) !== false;
      } catch (error) {
        allowedToStart = false;
        emit('resident-async-render-start-check-error', entry, { error: errorMessage(error) });
      }
    }
    if (!allowedToStart) {
      activeEntry = null;
      settleDiscarded(entry, 'resident-async-render-skipped-stale-source', 'start-check-rejected');
      startNext();
      return;
    }

    emit('resident-async-render-started', entry, {
      requiredVisible: entry.request?.requiredVisible === true
    });
    const startedAtMs = globalThis.performance?.now?.() ?? Date.now();
    let value = null;
    let executionError = null;
    try {
      value = await execute(entry.request, state('executing', entry));
    } catch (error) {
      executionError = error;
    }

    if (executionError && entry.superseded === true) {
      try {
        await invoke(onDiscardedResult, null, entry.request, state('discarding-superseded-active', entry, {
          reason: 'newer-request-superseded-active-request'
        }));
      } catch {
        // Superseded work cannot regain publication authority through telemetry.
      }
      releaseEntry(entry, 'render-active-request-superseded');
      completedCount += 1;
      const result = state('resident-async-render-active-superseded', entry, {
        reason: 'newer-request-superseded-active-request',
        elapsedMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAtMs),
        published: false
      });
      entry.resolve(result);
      emit(result.status, entry, result);
      activeEntry = null;
      startNext();
      return;
    }

    if (executionError) {
      try {
        await invoke(onError, executionError, entry.request, state('execution-error', entry));
      } catch (telemetryError) {
        emit('resident-async-render-error-telemetry-failed', entry, {
          error: errorMessage(telemetryError)
        });
      }
      releaseEntry(entry, 'render-execution-error');
      completedCount += 1;
      const result = state('resident-async-render-error', entry, {
        error: errorMessage(executionError),
        elapsedMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAtMs),
        published: false
      });
      entry.resolve(result);
      emit(result.status, entry, result);
      activeEntry = null;
      startNext();
      return;
    }

    let publish = !closed && entry.superseded !== true;
    if (publish && typeof shouldPublish === 'function') {
      try {
        publish = (await shouldPublish(entry.request, value, state('publish-check', entry, {
          newerRequestPending: Boolean(pendingEntry)
        }))) !== false;
      } catch (error) {
        publish = false;
        emit('resident-async-render-publish-check-error', entry, { error: errorMessage(error) });
      }
    }

    let publicationError = null;
    try {
      if (publish) {
        await invoke(onSuccess, value, entry.request, state('publishing', entry));
      } else {
        await invoke(onDiscardedResult, value, entry.request, state('discarding-result', entry));
      }
    } catch (error) {
      publicationError = error;
      try {
        await invoke(onError, error, entry.request, state('publication-error', entry));
      } catch {
        // Publication and telemetry errors remain presentation-local.
      }
    }

    releaseEntry(entry, publicationError ? 'render-publication-error' : 'render-request-settled');
    completedCount += 1;
    const result = state(
      publicationError
        ? 'resident-async-render-publication-error'
        : entry.superseded === true
        ? 'resident-async-render-active-superseded'
        : publish
        ? 'resident-async-render-published'
        : 'resident-async-render-result-superseded',
      entry,
      {
        value,
        error: publicationError ? errorMessage(publicationError) : null,
        reason: entry.superseded === true
          ? 'newer-request-superseded-active-request'
          : null,
        elapsedMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAtMs),
        published: publish
      }
    );
    entry.resolve(result);
    emit(result.status, entry, {
      error: result.error,
      elapsedMs: result.elapsedMs,
      published: result.published
    });
    activeEntry = null;
    startNext();
  }

  function enqueue(request = {}) {
    sequence += 1;
    let resolve;
    const completion = new Promise((settle) => {
      resolve = settle;
    });
    const entry = {
      sequence,
      request,
      completion,
      resolve,
      released: false,
      superseded: false,
      supersededBySequence: null
    };

    if (closed) {
      settleDiscarded(entry, 'resident-async-render-lane-closed', 'lane-closed');
      return completion;
    }
    if (!activeEntry) {
      void runEntry(entry);
      return completion;
    }

    const activeRequiredVisible = activeEntry.request?.requiredVisible === true;
    if (activeRequiredVisible && entry.request?.requiredVisible !== true) {
      entry.request = {
        ...entry.request,
        requiredVisible: true,
        requiredReason: activeEntry.request?.requiredReason
          || activeEntry.request?.reason
          || null,
        inheritedRequiredVisible: true
      };
    }
    activeEntry.superseded = true;
    activeEntry.supersededBySequence = entry.sequence;
    activeEntry.request.laneSuperseded = true;
    activeEntry.request.laneSupersededBySequence = entry.sequence;
    emit('resident-async-render-active-superseded', activeEntry, {
      reason: 'newer-request-superseded-active-request',
      requiredVisible: activeRequiredVisible,
      visibilityObligationTransferred: activeRequiredVisible,
      supersededBySequence: entry.sequence,
      published: false
    });

    if (pendingEntry) {
      const inheritedRequiredVisible = pendingEntry.request?.requiredVisible === true;
      const inheritedRequiredReason = pendingEntry.request?.requiredReason
        || pendingEntry.request?.reason
        || null;
      const superseded = pendingEntry;
      pendingEntry = null;
      supersededCount += 1;
      settleDiscarded(
        superseded,
        'resident-async-render-pending-superseded',
        'newer-request-replaced-pending-request'
      );
      if (inheritedRequiredVisible && entry.request?.requiredVisible !== true) {
        entry.request = {
          ...entry.request,
          requiredVisible: true,
          requiredReason: inheritedRequiredReason,
          inheritedRequiredVisible: true
        };
      }
    }
    pendingEntry = entry;
    emit('resident-async-render-pending-latest', entry, {
      requiredVisible: entry.request?.requiredVisible === true
    });
    return completion;
  }

  function close(reason = 'lane-closed') {
    if (closed) return state('resident-async-render-lane-already-closed');
    closed = true;
    if (pendingEntry) {
      const discarded = pendingEntry;
      pendingEntry = null;
      settleDiscarded(discarded, 'resident-async-render-pending-discarded-on-close', reason);
    }
    resolveIdleWaiters();
    return emit('resident-async-render-lane-closed', activeEntry, { reason });
  }

  return {
    schema: RESIDENT_ASYNC_RENDER_LANE_SCHEMA,
    enqueue,
    close,
    whenIdle() {
      if (!activeEntry && !pendingEntry) {
        return Promise.resolve(state(closed
          ? 'resident-async-render-lane-closed-idle'
          : 'resident-async-render-lane-idle'));
      }
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
    getState() {
      return state(closed ? 'resident-async-render-lane-closed' : 'resident-async-render-lane-ready');
    }
  };
}
