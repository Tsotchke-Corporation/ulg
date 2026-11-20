import { ReservationLedger } from '../../../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js';
import { deriveEosStiffnessResponse, ESHKOL_EOS_MODEL } from './eshkolEosStiffness.js';
import { adoptExternalRegionalResponseTable } from './regionalClosureWorkerLane.js';
import { updateSphImplicitPressureStiffnessTable } from '../sph/sphImplicitPressureGpu.js';
import {
  getWarmDerivationResidency,
  run as runWarmDerivationTask,
  terminateWarmWorker
} from '../../services/clientWarmDerivationTask.js';

export const ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA = 'peercompute.ulg.a6-warm-closure-miss-bridge.v1';

/**
 * A6 Warm Closure Miss Bridge (plan/CURRENT-PLAN.md Slice 2.4):
 *
 * Connects live Slice 1.5 closure misses (EOS stiffness AD derivations via
 * Eshkol and quantum reference probes via MoonLab) to the warm browser
 * WASM/WebGPU workers under PeerCompute + G5 `ReservationLedger` CAS capacity
 * control (`slot:0..slot:(maxInFlight-1)`).
 *
 * All worker calls run asynchronously off the hot physics path; finished A4
 * response tables are committed on G5 `ReservationLedger` and promoted
 * strictly at schedule boundaries (`adoptPendingAtScheduleBoundary`), keeping
 * physics non-blocking on fallback even if a warm worker crashes or times out
 * (uncommitted reservations cancel cleanly and the worker respawns on retry).
 */
export function createWarmClosureMissBridge({
  device = null,
  lane = null,
  maxInFlight = 4,
  taskRunner = runWarmDerivationTask,
  onStateCommit = null,
  updateImplicitPressure = true,
  scope = 'ulg-a6-live-closure'
} = {}) {
  if (!(Number.isSafeInteger(maxInFlight) && maxInFlight >= 1)) {
    throw new RangeError('Warm closure miss bridge requires maxInFlight >= 1');
  }
  const ledger = new ReservationLedger({ name: 'ulg-a6-warm-closure-bridge', maxKeys: maxInFlight });
  const slotKeys = Array.from({ length: maxInFlight }, (_, idx) => `a6-slot:${idx}`);
  const completedByKey = new Map();
  const inFlightByKey = new Map();
  const pendingAdoptions = [];
  let closed = false;
  let activeOrdinal = 0;

  const stats = {
    dispatched: 0,
    cacheHits: 0,
    capacityDeferred: 0,
    completed: 0,
    adopted: 0,
    failures: 0,
    lastError: null,
    lastEshkolResidency: null,
    lastMoonlabResidency: null
  };

  function acquireSlotReservation(consumerId) {
    for (const slotKey of slotKeys) {
      const attempt = ledger.reserve({ key: slotKey, consumerId });
      if (attempt.ok) return { slotKey, token: attempt.token };
    }
    return null;
  }

  function statusSnapshot() {
    const ledgerSnapshot = closed ? null : ledger.snapshot();
    const activeSlots = closed
      ? 0
      : slotKeys.filter((slotKey) => ledger.fence(slotKey).state !== 'free').length;
    return Object.freeze({
      schema: ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA,
      closed,
      activeOrdinal,
      inFlightCount: inFlightByKey.size,
      pendingAdoptionCount: pendingAdoptions.length,
      cachedCount: completedByKey.size,
      ledgerActiveCount: activeSlots,
      ledgerCapacity: maxInFlight,
      ledgerCounters: ledgerSnapshot?.counters ?? null,
      stats: Object.freeze({ ...stats }),
      residency: getWarmDerivationResidency()
    });
  }

  /**
   * Dispatch a non-blocking Eshkol-AD EOS stiffness derivation for an
   * out-of-envelope regime miss. Returns immediately so physics never stalls.
   */
  function requestEosStiffnessClosureMiss({
    missKey,
    eosModel = ESHKOL_EOS_MODEL.TAIT,
    restDensityKgPerM3,
    soundSpeedMPerS,
    densityRange = [0.9, 1.1],
    degree = 10,
    relativeTolerance = 1e-6,
    scheduleId = null,
    timeoutMs = 30_000
  } = {}) {
    if (closed) return Object.freeze({ status: 'closed', missKey: missKey ?? null, promise: null });
    const key = String(missKey || `eos:${eosModel}:${Number(restDensityKgPerM3).toPrecision(8)}:${Number(soundSpeedMPerS).toPrecision(8)}:${densityRange.join(',')}`);
    if (completedByKey.has(key)) {
      stats.cacheHits += 1;
      return Object.freeze({ status: 'cache-hit', missKey: key, cached: completedByKey.get(key), promise: null });
    }
    if (inFlightByKey.has(key)) {
      return Object.freeze({ status: 'in-flight', missKey: key, promise: inFlightByKey.get(key) });
    }
    const acquired = acquireSlotReservation(`eshkol:${key}`);
    if (!acquired) {
      stats.capacityDeferred += 1;
      return Object.freeze({ status: 'capacity-deferred', missKey: key, promise: null });
    }

    stats.dispatched += 1;
    let lastCommitDelta = null;
    const promise = (async () => {
      try {
        const derived = await deriveEosStiffnessResponse({
          eosModel,
          restDensityKgPerM3,
          soundSpeedMPerS,
          densityRange,
          degree,
          relativeTolerance,
          sample: async (definition, call, points) => {
            const reply = await taskRunner({
              service: 'eshkol',
              operation: 'sample',
              scope,
              timeoutMs,
              definition,
              call,
              points
            });
            lastCommitDelta = reply?.commitDelta ?? null;
            if (lastCommitDelta?.payload?.residency) {
              stats.lastEshkolResidency = lastCommitDelta.payload.residency;
            }
            return reply?.value?.samples;
          }
        });
        if (!closed) {
          // Commit and immediately retire the slot fence so completed work
          // releases bounded concurrency capacity while staging adoption.
          ledger.commit(acquired.token, { admissionId: `eshkol:${key}` });
          ledger.retire(acquired.slotKey);
          const entry = Object.freeze({
            kind: 'eos-stiffness',
            missKey: key,
            scheduleId,
            sourceFingerprint: derived.program.sourceFingerprint,
            derived,
            responseFunction: derived.responseFunction,
            commitDelta: lastCommitDelta
          });
          completedByKey.set(key, entry);
          pendingAdoptions.push(entry);
          stats.completed += 1;
          return entry;
        }
        return null;
      } catch (error) {
        if (!closed) ledger.cancel(acquired.token);
        stats.failures += 1;
        stats.lastError = String(error?.message ?? error);
        return { error: stats.lastError, missKey: key, failed: true };
      } finally {
        inFlightByKey.delete(key);
      }
    })();
    inFlightByKey.set(key, promise);
    return Object.freeze({ status: 'dispatched', missKey: key, promise });
  }

  /**
   * Dispatch a non-blocking MoonLab WebGPU quantum closure probe over G5
   * CAS reservations and stage its deterministic commit delta for the next
   * schedule boundary.
   */
  function requestQuantumClosureProbeMiss({
    missKey,
    qubits = 8,
    scheduleId = null,
    timeoutMs = 30_000
  } = {}) {
    if (closed) return Object.freeze({ status: 'closed', missKey: missKey ?? null, promise: null });
    const key = String(missKey || `moonlab:ghz:${qubits}`);
    if (completedByKey.has(key)) {
      stats.cacheHits += 1;
      return Object.freeze({ status: 'cache-hit', missKey: key, cached: completedByKey.get(key), promise: null });
    }
    if (inFlightByKey.has(key)) {
      return Object.freeze({ status: 'in-flight', missKey: key, promise: inFlightByKey.get(key) });
    }
    const acquired = acquireSlotReservation(`moonlab:${key}`);
    if (!acquired) {
      stats.capacityDeferred += 1;
      return Object.freeze({ status: 'capacity-deferred', missKey: key, promise: null });
    }

    stats.dispatched += 1;
    const promise = (async () => {
      try {
        const reply = await taskRunner({
          service: 'moonlab',
          scope,
          qubits,
          timeoutMs
        });
        const commitDelta = reply?.commitDelta ?? null;
        if (commitDelta?.payload?.residency) {
          stats.lastMoonlabResidency = commitDelta.payload.residency;
        }
        if (!closed) {
          ledger.commit(acquired.token, { admissionId: `moonlab:${key}` });
          ledger.retire(acquired.slotKey);
          const entry = Object.freeze({
            kind: 'quantum-probe',
            missKey: key,
            scheduleId,
            value: reply?.value ?? null,
            commitDelta
          });
          completedByKey.set(key, entry);
          pendingAdoptions.push(entry);
          stats.completed += 1;
          return entry;
        }
        return null;
      } catch (error) {
        if (!closed) ledger.cancel(acquired.token);
        stats.failures += 1;
        stats.lastError = String(error?.message ?? error);
        return { error: stats.lastError, missKey: key, failed: true };
      } finally {
        inFlightByKey.delete(key);
      }
    })();
    inFlightByKey.set(key, promise);
    return Object.freeze({ status: 'dispatched', missKey: key, promise });
  }

  /**
   * Schedule-boundary adoption: promote every finished A6 closure table into
   * the G5-reserved regional closure lane and GPU implicit-pressure solver,
   * and publish deterministic commit deltas to PeerCompute StateManager.
   */
  function adoptPendingAtScheduleBoundary({ scheduleId = null } = {}) {
    if (closed || pendingAdoptions.length === 0) {
      return Object.freeze({
        adoptedCount: 0,
        adoptedKeys: Object.freeze([]),
        activeOrdinal,
        status: statusSnapshot()
      });
    }
    const batch = pendingAdoptions.splice(0, pendingAdoptions.length);
    const adoptedKeys = [];
    for (const entry of batch) {
      let laneAdoption = null;
      let implicitPressureUpdated = false;
      if (entry.kind === 'eos-stiffness' && entry.responseFunction) {
        if (lane) {
          laneAdoption = adoptExternalRegionalResponseTable(lane, entry.responseFunction, {
            scheduleId,
            sourceFingerprint: entry.sourceFingerprint
          });
          activeOrdinal = laneAdoption.ordinal;
        } else {
          activeOrdinal += 1;
        }
        if (device && updateImplicitPressure) {
          updateSphImplicitPressureStiffnessTable(device, entry.responseFunction);
          implicitPressureUpdated = true;
        }
      } else {
        activeOrdinal += 1;
      }
      stats.adopted += 1;
      adoptedKeys.push(entry.missKey);
      if (typeof onStateCommit === 'function') {
        onStateCommit(Object.freeze({
          ...(entry.commitDelta || { taskId: `ulg-a6-client:${entry.kind}`, scope }),
          scheduleId,
          ordinal: activeOrdinal,
          missKey: entry.missKey,
          kind: entry.kind,
          sourceFingerprint: entry.sourceFingerprint ?? null,
          implicitPressureUpdated,
          laneOrdinal: laneAdoption?.ordinal ?? null
        }));
      }
    }
    const status = statusSnapshot();
    globalThis.__ulgA6ClosureBridgeStatus = status;
    return Object.freeze({
      adoptedCount: adoptedKeys.length,
      adoptedKeys: Object.freeze(adoptedKeys),
      activeOrdinal,
      status
    });
  }

  function invalidateCacheKey(missKey) {
    return completedByKey.delete(missKey);
  }

  function destroy({ terminateWorkers = false } = {}) {
    if (closed) return;
    closed = true;
    pendingAdoptions.length = 0;
    inFlightByKey.clear();
    completedByKey.clear();
    ledger.destroy();
    if (terminateWorkers) {
      terminateWarmWorker('eshkol', { countRecovery: false });
      terminateWarmWorker('moonlab', { countRecovery: false });
    }
  }

  return Object.freeze({
    schema: ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA,
    requestEosStiffnessClosureMiss,
    requestQuantumClosureProbeMiss,
    adoptPendingAtScheduleBoundary,
    invalidateCacheKey,
    getStatus: statusSnapshot,
    destroy
  });
}
