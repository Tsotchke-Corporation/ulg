// Register early enough to receive the next browser frame, but admit only a
// callback delivered after the exact submitted-work promise has fulfilled.
export function waitForWorkerPresentationOpportunity({
  afterGpuCompletion = null,
  timeoutMs = 75,
  isCurrent = () => true,
  signal = null
} = {}, platform = globalThis) {
  const boundedTimeoutMs = Math.max(8, Math.round(Number(timeoutMs) || 75));
  const now = () => {
    try {
      const value = typeof platform.now === 'function'
        ? platform.now()
        : globalThis.performance?.now?.() ?? Date.now();
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  };
  return new Promise(resolve => {
    let settled = false;
    let gpuCompleted = false;
    let deadlineMs = null;
    let frameHandle = null;
    let timeoutHandle = null;
    const finish = (method, available = false, observedAtMs = now()) => {
      if (settled) return;
      settled = true;
      try { if (frameHandle != null) platform.cancelAnimationFrame?.(frameHandle); } catch {}
      try { if (timeoutHandle != null) platform.clearTimeout?.(timeoutHandle); } catch {}
      try { signal?.removeEventListener?.('abort', onAbort); } catch {}
      frameHandle = null;
      timeoutHandle = null;
      resolve(Object.freeze({ available, method, observedAtMs }));
    };
    const onAbort = () => finish('worker-request-animation-frame-aborted');
    const current = () => {
      if (settled) return false;
      if (signal?.aborted) {
        onAbort();
        return false;
      }
      try {
        if (isCurrent()) return true;
      } catch {
        // A failed lifecycle query cannot admit a presentation.
      }
      finish('worker-request-animation-frame-stale');
      return false;
    };
    const arm = () => {
      if (!current() || frameHandle != null) return;
      if (typeof platform.requestAnimationFrame !== 'function') {
        finish('worker-request-animation-frame-unavailable');
        return;
      }
      try {
        frameHandle = platform.requestAnimationFrame(() => {
          frameHandle = null;
          if (!current() || !gpuCompleted) return;
          const observedAtMs = now();
          if (observedAtMs == null) {
            finish('worker-request-animation-frame-unavailable', false, null);
            return;
          }
          // Task delivery may be late: a queued callback winning over its
          // overdue timer is not permission to extend the post-GPU budget.
          if (observedAtMs >= deadlineMs) {
            finish('worker-request-animation-frame-timeout', false, observedAtMs);
          } else {
            finish('worker-request-animation-frame-after-gpu-completion', true, observedAtMs);
          }
        });
      } catch {
        finish('worker-request-animation-frame-unavailable');
      }
    };
    try {
      if (!afterGpuCompletion || typeof afterGpuCompletion.then !== 'function') {
        finish('worker-gpu-completion-unavailable');
        return;
      }
      // Observe rejection immediately, even if the caller separately awaits
      // this same fence before it consumes our non-authoritative outcome.
      Promise.resolve(afterGpuCompletion).then(() => {
        if (!current()) return;
        gpuCompleted = true;
        const completedAtMs = now();
        if (completedAtMs == null) {
          finish('worker-request-animation-frame-unavailable', false, null);
          return;
        }
        deadlineMs = completedAtMs + boundedTimeoutMs;
        timeoutHandle = platform.setTimeout(() => {
          if (current()) finish('worker-request-animation-frame-timeout');
        }, boundedTimeoutMs);
        // An early callback is consumed once, never spun while GPU work is
        // pending. Only fulfillment arms another callback when needed.
        arm();
      }, () => finish('worker-gpu-completion-failed')).catch(() => {
        finish('worker-request-animation-frame-unavailable');
      });
      signal?.addEventListener?.('abort', onAbort, { once: true });
      arm();
    } catch {
      finish('worker-gpu-completion-unavailable');
    }
  });
}
