export const ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA =
  'peercompute.ulg.worker-resident-schedule-control-plane-yield-receipt.v0';

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

export function workerResidentScheduleControlPlaneYieldNotRequiredReceipt({
  tier0RouteSelected = false,
  stepCount = 0
} = {}) {
  return Object.freeze({
    schema:
      ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
    status: 'worker-resident-schedule-control-plane-yield-not-required',
    mode: 'none',
    mechanism: tier0RouteSelected
      ? 'none-atomic-tier0'
      : 'none-single-step-canonical',
    reason: tier0RouteSelected
      ? 'tier0-atomic-schedule'
      : 'canonical-schedule-has-no-between-step-boundary',
    scheduledYieldOpportunityCount: tier0RouteSelected
      ? 0
      : Math.max(0, Number(stepCount) - 1),
    yieldRequestCount: 0,
    completedYieldCount: 0,
    messageChannelCreated: false,
    messageChannelYieldCount: 0,
    timerFallbackYieldCount: 0,
    fallbackReason: null,
    ownedPortCount: 0,
    closedPortCount: 0,
    portsClosed: true,
    totalWaitMs: 0,
    firstBeforeStepOrdinal: null,
    lastBeforeStepOrdinal: null,
    cancellationObservedAfterYield: false,
    cancellationObservedBeforeStepOrdinal: null,
    taskBoundaryGuarantee: tier0RouteSelected
      ? 'atomic-schedule-terminal-only'
      : 'no-between-step-boundary-required'
  });
}

export function createWorkerResidentScheduleControlPlaneTaskYielder({
  scheduledYieldOpportunityCount = 0,
  MessageChannelConstructor = globalThis.MessageChannel,
  scheduleTimer = globalThis.setTimeout,
  clock = nowMs
} = {}) {
  let messagePort1 = null;
  let messagePort2 = null;
  let pendingResolve = null;
  let yieldPending = false;
  let closed = false;
  let finalReceipt = null;
  let messageChannelCreated = false;
  let fallbackReason = typeof MessageChannelConstructor === 'function'
    ? null
    : 'message-channel-unavailable';
  let yieldRequestCount = 0;
  let completedYieldCount = 0;
  let messageChannelYieldCount = 0;
  let timerFallbackYieldCount = 0;
  let ownedPortCount = 0;
  let closedPortCount = 0;
  let totalWaitMs = 0;
  let firstBeforeStepOrdinal = null;
  let lastBeforeStepOrdinal = null;
  let cancellationObservedAfterYield = false;
  let cancellationObservedBeforeStepOrdinal = null;

  const runTimerFallback = (resolve) => {
    timerFallbackYieldCount += 1;
    scheduleTimer(() => {
      completedYieldCount += 1;
      resolve();
    }, 0);
  };

  const closeMessagePorts = () => {
    if (messagePort1) {
      try { messagePort1.onmessage = null; } catch {}
      try { messagePort1.onmessageerror = null; } catch {}
      try {
        messagePort1.close();
        closedPortCount += 1;
      } catch {}
      messagePort1 = null;
    }
    if (messagePort2) {
      try {
        messagePort2.close();
        closedPortCount += 1;
      } catch {}
      messagePort2 = null;
    }
  };

  if (typeof MessageChannelConstructor === 'function') {
    try {
      const channel = new MessageChannelConstructor();
      messageChannelCreated = true;
      messagePort1 = channel?.port1 ?? null;
      messagePort2 = channel?.port2 ?? null;
      ownedPortCount = Number(Boolean(messagePort1))
        + Number(Boolean(messagePort2));
      if (
        !messagePort1
        || !messagePort2
        || typeof messagePort1.close !== 'function'
        || typeof messagePort2.close !== 'function'
        || typeof messagePort2.postMessage !== 'function'
      ) {
        throw new Error('message-channel-ports-invalid');
      }
      messagePort1.onmessage = () => {
        const resolve = pendingResolve;
        pendingResolve = null;
        if (!resolve) return;
        messageChannelYieldCount += 1;
        completedYieldCount += 1;
        resolve();
      };
      messagePort1.onmessageerror = () => {
        const resolve = pendingResolve;
        pendingResolve = null;
        if (!resolve) return;
        fallbackReason = 'message-channel-message-error';
        closeMessagePorts();
        runTimerFallback(resolve);
      };
      messagePort1.start?.();
    } catch {
      fallbackReason = 'message-channel-construction-failed';
      closeMessagePorts();
    }
  }

  return Object.freeze({
    async yieldTask(beforeStepOrdinal = null) {
      if (closed) {
        throw new Error('resident schedule control-plane yielder is closed');
      }
      if (yieldPending) {
        throw new Error(
          'resident schedule control-plane yielder already has a pending yield'
        );
      }
      yieldPending = true;
      try {
        const normalizedBeforeStepOrdinal = Number.isInteger(beforeStepOrdinal)
          && beforeStepOrdinal > 0
          ? beforeStepOrdinal
          : null;
        const startedAtMs = clock();
        yieldRequestCount += 1;
        if (firstBeforeStepOrdinal == null) {
          firstBeforeStepOrdinal = normalizedBeforeStepOrdinal;
        }
        lastBeforeStepOrdinal = normalizedBeforeStepOrdinal;
        await new Promise((resolve) => {
          if (messagePort1 && messagePort2) {
            pendingResolve = resolve;
            try {
              messagePort2.postMessage(null);
              return;
            } catch {
              pendingResolve = null;
              fallbackReason = 'message-channel-post-failed';
              closeMessagePorts();
            }
          }
          runTimerFallback(resolve);
        });
        totalWaitMs += Math.max(0, clock() - startedAtMs);
      } finally {
        yieldPending = false;
      }
    },
    observeCancellation(beforeStepOrdinal = null) {
      if (completedYieldCount === 0) return;
      cancellationObservedAfterYield = true;
      cancellationObservedBeforeStepOrdinal = Number.isInteger(
        beforeStepOrdinal
      ) && beforeStepOrdinal > 0
        ? beforeStepOrdinal
        : null;
    },
    close() {
      if (finalReceipt) return finalReceipt;
      if (yieldPending) {
        throw new Error(
          'resident schedule control-plane yielder cannot close during a pending yield'
        );
      }
      closed = true;
      closeMessagePorts();
      const mode = messageChannelYieldCount > 0
        ? (timerFallbackYieldCount > 0
          ? 'message-channel-with-timer-fallback'
          : 'message-channel')
        : (timerFallbackYieldCount > 0
          ? 'timer-fallback'
          : (messageChannelCreated ? 'message-channel' : 'timer-fallback'));
      finalReceipt = Object.freeze({
        schema:
          ULG_WORKER_RESIDENT_SCHEDULE_CONTROL_PLANE_YIELD_RECEIPT_SCHEMA,
        status: 'worker-resident-schedule-control-plane-yielder-closed',
        mode,
        mechanism: mode === 'message-channel'
          ? 'message-channel-task'
          : (mode === 'message-channel-with-timer-fallback'
            ? 'message-channel-task-with-timer-fallback'
            : 'timer-task-fallback'),
        reason: 'canonical-between-step-cancellation-boundary',
        scheduledYieldOpportunityCount: Math.max(
          0,
          Number(scheduledYieldOpportunityCount) || 0
        ),
        yieldRequestCount,
        completedYieldCount,
        messageChannelCreated,
        messageChannelYieldCount,
        timerFallbackYieldCount,
        fallbackReason,
        ownedPortCount,
        closedPortCount,
        portsClosed: closedPortCount === ownedPortCount,
        totalWaitMs,
        firstBeforeStepOrdinal,
        lastBeforeStepOrdinal,
        cancellationObservedAfterYield,
        cancellationObservedBeforeStepOrdinal,
        taskBoundaryGuarantee: 'between-completed-canonical-steps'
      });
      return finalReceipt;
    }
  });
}
