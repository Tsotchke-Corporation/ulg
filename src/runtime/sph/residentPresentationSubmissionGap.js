// Private same-device submission opportunities, never particle/source authority.
// A schedule owns one registration; replacement cannot be undone by an old
// schedule's finally block. No callbacks or intermediate rows are exported.
const registrations = new WeakMap();

function current(device, registration) {
  if (!registration || registrations.get(device) !== registration) return false;
  try {
    return registration.isCurrent() === true
      && registrations.get(device) === registration;
  } catch {
    return false;
  }
}

function currentAndReady(device, registration, { waitForPendingSlot = false } = {}) {
  if (!current(device, registration)) return false;
  try {
    return registration.isReady({ waitForPendingSlot }) === true
      && current(device, registration);
  } catch {
    return false;
  }
}

function retire(registration) {
  registration?.controller.abort();
}

export function registerResidentPresentationSubmissionGap(device, {
  isCurrent, isReady, present
} = {}) {
  if (!device || !['object', 'function'].includes(typeof device)
    || typeof isCurrent !== 'function' || typeof isReady !== 'function'
    || typeof present !== 'function') {
    throw new TypeError('submission gap requires an exact device and private callbacks');
  }
  retire(registrations.get(device));
  const registration = {
    isCurrent, isReady, present, controller: new AbortController(), pending: null
  };
  registrations.set(device, registration);
  return () => {
    if (registrations.get(device) !== registration) return false;
    registrations.delete(device);
    retire(registration);
    return true;
  };
}

export function hasResidentPresentationSubmissionGap(device) {
  return currentAndReady(device, registrations.get(device));
}

export async function requestResidentPresentationSubmissionGap(
  device, { signal = null, waitForPendingSlot = false } = {}
) {
  if (typeof waitForPendingSlot !== 'boolean') return false;
  const registration = registrations.get(device);
  if (signal?.aborted || registration?.pending
    || !currentAndReady(device, registration, { waitForPendingSlot })) return false;
  const pending = {};
  const callbackSignal = signal
    ? AbortSignal.any([registration.controller.signal, signal])
    : registration.controller.signal;
  registration.pending = pending;
  try {
    if (signal?.aborted
      || !currentAndReady(device, registration, { waitForPendingSlot })) return false;
    const submitted = await registration.present({ signal: callbackSignal, waitForPendingSlot });
    return submitted === true && !callbackSignal.aborted
      && current(device, registration);
  } catch {
    // Presentation is optional. Its failure never changes mechanics admission.
    return false;
  } finally {
    // Successful submission still has a pending GPU/display proof. Keep its
    // signal alive until explicit caller cancellation or schedule retirement.
    if (registration.pending === pending) registration.pending = null;
  }
}
