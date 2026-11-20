// Device-loss notifications live as long as the device, including after a step
// returns or releases its outputs. Construct them outside the step's lexical
// scope so the notification chain retains only this small cell and the caller's
// actual notifier, not completed simulation proposals or source generations.
export function createSphDeviceLossRelay(lossState, onDeviceLost) {
  return function notifySphDeviceLost(info) {
    lossState.info = info;
    if (typeof onDeviceLost === 'function') onDeviceLost(info);
  };
}

// One device.lost reaction per device. A per-call `device.lost.then(...)`
// stays reachable from the never-settling (healthy) device.lost promise
// forever, together with everything its handler captures: with one or more
// runners registering per step, every step's loss state, notifier and the
// step objects they reach accumulated (measured 2026-11-15 on the live
// worker lane: ~6 reactions and ~0.2 MB retained per step).
//
// Here the device keeps only a WeakRef to each caller's loss-state object;
// the caller's notifier is stored on that object. A loss notification matters
// only while the caller still holds its loss state (during its step, which
// checks `lossState.info` after its awaits); afterwards both become
// collectable. A watcher registered after the device was lost is notified on
// the next microtask, so a late registration never misses the loss.
const sphDeviceLossRegistries = new WeakMap();
// Without WeakRef (older runtimes, some tests) fall back to strong references:
// loss is still delivered, at the old retention cost.
function sphLossRef(target) {
  return typeof WeakRef === 'function' ? new WeakRef(target) : { deref: () => target };
}
const SPH_DEVICE_LOSS_PRUNE_THRESHOLD = 256;

// Same observable sequence as the per-call `lost.then(notify).catch(notify)`
// chain it replaces: on a fulfilled loss, a notifier that throws is called
// once more with its own error, after every watcher saw the loss; on a
// rejected loss observation it is called once. A second throw is dropped.
function notifySphLossState(lossState, info, fulfilled) {
  if (!lossState || typeof lossState !== 'object') return;
  lossState.info = info;
  const notify = lossState.notify;
  if (typeof notify !== 'function') return;
  try {
    notify(info);
  } catch (error) {
    if (!fulfilled) return;
    queueMicrotask(() => {
      try {
        notify(error);
      } catch {
        // A failing observer must not prevent other observers from learning
        // about the loss.
      }
    });
  }
}

/**
 * Observe device loss into `lossState.info` (and `onDeviceLost`) for as long
 * as the caller holds `lossState`. Returns false when the device exposes no
 * loss promise.
 */
export function watchSphDeviceLoss(device, lossState, onDeviceLost = null) {
  if (!device?.lost?.then || !lossState || typeof lossState !== 'object') {
    return false;
  }
  if (typeof onDeviceLost === 'function') {
    Object.defineProperty(lossState, 'notify', {
      value: onDeviceLost,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  let registry = sphDeviceLossRegistries.get(device);
  if (!registry) {
    registry = {
      watchers: new Set(),
      lost: false,
      lostInfo: null,
      lostFulfilled: true,
      nextPruneSize: SPH_DEVICE_LOSS_PRUNE_THRESHOLD
    };
    sphDeviceLossRegistries.set(device, registry);
    const deliver = (fulfilled) => (info) => {
      registry.lost = true;
      registry.lostInfo = info;
      registry.lostFulfilled = fulfilled;
      const watchers = [...registry.watchers];
      registry.watchers.clear();
      for (const ref of watchers) notifySphLossState(ref.deref(), info, fulfilled);
    };
    Promise.resolve(device.lost).then(deliver(true), deliver(false));
  }
  if (registry.lost) {
    queueMicrotask(() => notifySphLossState(
      lossState, registry.lostInfo, registry.lostFulfilled
    ));
    return true;
  }
  registry.watchers.add(sphLossRef(lossState));
  // Amortized pruning: scan only when the set doubles past the last scan's
  // survivors (collection lags registration, so a fixed threshold rescanned
  // every registration once the live set exceeded it).
  if (registry.watchers.size > registry.nextPruneSize) {
    for (const ref of registry.watchers) {
      if (!ref.deref()) registry.watchers.delete(ref);
    }
    registry.nextPruneSize = Math.max(
      SPH_DEVICE_LOSS_PRUNE_THRESHOLD,
      registry.watchers.size * 2
    );
  }
  return true;
}

// Per-target watch states. The WeakMap ephemeron keeps each state exactly as
// long as its target (which may be frozen), and the device registry holds the
// state only weakly, so nothing here extends the target's life.
const sphDeviceLossTargetStates = new WeakMap();

/**
 * Run `handler(target, info)` on device loss if `target` is still alive.
 * The device holds only a WeakRef to `target`; `handler` must not capture it
 * (pass a module-level function). Use for per-resource cleanup records that
 * are created every step: a strong per-record `device.lost.then(...)` keeps
 * every record (and everything it reaches) alive for the device's lifetime.
 */
export function watchSphDeviceLossFor(device, target, handler) {
  if (!device?.lost?.then || !target || typeof target !== 'object'
    || typeof handler !== 'function') {
    return false;
  }
  const ref = sphLossRef(target);
  const state = { info: null };
  Object.defineProperty(state, 'notify', {
    value: (info) => {
      const live = ref.deref();
      if (live) handler(live, info);
    },
    writable: true,
    configurable: true,
    enumerable: false
  });
  let states = sphDeviceLossTargetStates.get(target);
  if (!states) {
    states = [];
    sphDeviceLossTargetStates.set(target, states);
  }
  states.push(state);
  return watchSphDeviceLoss(device, state);
}
