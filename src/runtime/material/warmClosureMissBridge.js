import { ReservationLedger } from '../../../../peercompute/peercompute/src/peercompute/stateManager/ReservationLedger.js';
import { deriveEosStiffnessResponse, ESHKOL_EOS_MODEL } from './eshkolEosStiffness.js';
import { adoptExternalRegionalResponseTable } from './regionalClosureWorkerLane.js';
import { updateSphImplicitPressureStiffnessTable } from '../sph/sphImplicitPressureGpu.js';
import {
  getWarmDerivationResidency,
  run as runWarmDerivationTask,
  terminateWarmWorker
} from '../../services/clientWarmDerivationTask.js';

export const ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA = 'peercompute.ulg.a6-warm-closure-miss-bridge.v2';

function summarizePeerProvenance(rawProvenance, fallbackMode = 'peer-quorum') {
  if (!rawProvenance || typeof rawProvenance !== 'object') {
    return Object.freeze({
      mode: fallbackMode,
      role: fallbackMode === 'local-warm-worker' ? 'local-warm-worker' : null,
      peerId: globalThis.__ulgA6PeerId ?? null,
      primaryFailure: null,
      quorum: null,
      matching: null
    });
  }
  return Object.freeze({
    mode: fallbackMode,
    role: rawProvenance.role ?? null,
    peerId: rawProvenance.peerId ?? null,
    primaryFailure: rawProvenance.primaryFailure?.code ?? rawProvenance.primaryFailure ?? null,
    quorum: rawProvenance.validation?.reason ?? rawProvenance.quorum ?? null,
    matching: rawProvenance.validation?.matchingResultCount ?? rawProvenance.matching ?? null
  });
}

function isPeerOwnerLossError(error) {
  const code = String(error?.code ?? '');
  const msg = String(error?.message ?? error ?? '');
  return (
    code === 'ERR_CLIENT_PEER_ABSENT'
    || /not present|quorum|replica|peer|timed out|absent/i.test(msg)
  );
}

/**
 * A6 Warm Remote & Local Closure Miss Bridge:
 *
 * Connects live ULG closure misses (EOS stiffness AD derivations via Eshkol and
 * quantum reference probes via MoonLab) to PeerCompute remote warm WASM/WebGPU
 * responders (`peerRequester` from `clientDerivationPeers.js`, with 2-of-2
 * quorum validation & primary->replica failover) or local warm WASM/WebGPU
 * workers under G5 `ReservationLedger` CAS capacity control.
 *
 * Authority & failure invariants:
 *   - Artifacts are provenance-bound (`sourceIdentity`, `epoch`, `provenance`)
 *     and adopted strictly at schedule boundaries (`adoptPendingAtScheduleBoundary`).
 *   - No second scheduler is created; all remote placement flows through
 *     PeerCompute `NodeKernel` + `ComputeManager`.
 *   - `cancelMiss(missKey)` and `sourceChanged(nextSourceIdentity)` fence
 *     in-flight derivations by epoch/token, immediately releasing G5 slot
 *     reservations and rejecting late/stale results (`stats.staleRejected`).
 *   - Owner/quorum loss records explicit visible `remoteDebt` without any
 *     silent CPU hot-state fallback; retry clears debt once quorum recovers.
 */
export function createWarmClosureMissBridge({
  device = null,
  lane = null,
  maxInFlight = 4,
  peerRequester = null,
  requireRemotePeer = false,
  taskRunner = runWarmDerivationTask,
  sourceIdentity = 'ulg-a6-client-assets.v1',
  onPeerExhaustion = 'debt',
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
  const inFlightByKey = new Map(); // key -> { promise, slotKey, token, cancelled, epoch, source, kind, requestArgs }
  const remoteDebtByKey = new Map();
  const pendingAdoptions = [];
  let currentPeerRequester = peerRequester;
  let currentSourceIdentity = String(sourceIdentity ?? '');
  let bridgeEpoch = 1;
  let taskSeq = 0;
  let closed = false;
  let activeOrdinal = 0;

  const stats = {
    dispatched: 0,
    remoteCalls: 0,
    cacheHits: 0,
    capacityDeferred: 0,
    completed: 0,
    adopted: 0,
    cancelled: 0,
    staleRejected: 0,
    invalidations: 0,
    replicaPromotions: 0,
    ownerLosses: 0,
    debtCleared: 0,
    failures: 0,
    lastError: null,
    lastProvenance: null,
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

  function releaseReservationCancel(record) {
    if (!record || record.slotReleased || closed) return;
    record.slotReleased = true;
    try {
      ledger.cancel(record.token);
    } catch {
      /* Already retired or cancelled. */
    }
  }

  function releaseReservationCommit(record, admissionId) {
    if (!record || record.slotReleased || closed) return;
    record.slotReleased = true;
    ledger.commit(record.token, { admissionId });
    ledger.retire(record.slotKey);
  }

  async function executeDerivationPayload(taskKind, payload) {
    const activeRequester = currentPeerRequester ?? globalThis.__ulgA6PeerRequester ?? null;
    if (activeRequester) {
      stats.remoteCalls += 1;
      const taskId = `ulg-a6-${taskKind}-${++taskSeq}`;
      try {
        let value;
        let commitDelta = null;
        let rawProv = null;
        if (typeof activeRequester.submitWithProvenance === 'function') {
          const out = await activeRequester.submitWithProvenance(taskId, payload);
          value = out.value;
          commitDelta = out.commitDelta ?? null;
          rawProv = out.provenance ?? null;
        } else {
          const deltaBefore = Array.isArray(activeRequester.deltas) ? activeRequester.deltas.length : 0;
          value = await activeRequester.submit(taskId, payload);
          if (Array.isArray(activeRequester.deltas) && activeRequester.deltas.length > deltaBefore) {
            commitDelta = activeRequester.deltas.at(-1);
          }
          rawProv = typeof activeRequester.lastProvenance === 'function' ? activeRequester.lastProvenance() : null;
        }
        const provenance = summarizePeerProvenance(rawProv, 'peer-quorum');
        if (provenance.role === 'promoted-replica') {
          stats.replicaPromotions += 1;
        }
        stats.lastProvenance = provenance;
        return { value, commitDelta, provenance };
      } catch (peerError) {
        if (onPeerExhaustion === 'local-warm-worker') {
          const localReply = await taskRunner(payload);
          const provenance = summarizePeerProvenance(
            { role: 'local-warm-fallback', primaryFailure: peerError?.code ?? String(peerError?.message ?? peerError) },
            'local-warm-worker'
          );
          stats.lastProvenance = provenance;
          return {
            value: localReply?.value ?? null,
            commitDelta: localReply?.commitDelta ?? null,
            provenance
          };
        }
        throw peerError;
      }
    }
    if (!activeRequester && requireRemotePeer && onPeerExhaustion === 'debt') {
      const error = new Error('no remote derivation peer quorum is currently present');
      error.code = 'ERR_CLIENT_PEER_ABSENT';
      throw error;
    }
    const reply = await taskRunner(payload);
    const provenance = summarizePeerProvenance(null, 'local-warm-worker');
    stats.lastProvenance = provenance;
    return {
      value: reply?.value ?? null,
      commitDelta: reply?.commitDelta ?? null,
      provenance
    };
  }

  function recordDebtOnFailure(key, kind, scheduleId, requestArgs, error) {
    const ownerLoss = (Boolean(currentPeerRequester ?? globalThis.__ulgA6PeerRequester) || requireRemotePeer) && isPeerOwnerLossError(error);
    if (ownerLoss) {
      stats.ownerLosses += 1;
    }
    const existing = remoteDebtByKey.get(key);
    remoteDebtByKey.set(
      key,
      Object.freeze({
        missKey: key,
        kind,
        scheduleId: scheduleId ?? null,
        ownerLoss,
        errorCode: error?.code ?? (ownerLoss ? 'ERR_REMOTE_QUORUM_UNAVAILABLE' : 'ERR_DERIVATION_FAILED'),
        reason: String(error?.message ?? error),
        retryCount: (existing?.retryCount ?? 0) + 1,
        sourceIdentity: currentSourceIdentity,
        requestArgs
      })
    );
  }

  function clearDebtIfPresent(key) {
    if (remoteDebtByKey.delete(key)) {
      stats.debtCleared += 1;
    }
  }

  function statusSnapshot() {
    const ledgerSnapshot = closed ? null : ledger.snapshot();
    const activeSlots = closed
      ? 0
      : slotKeys.filter((slotKey) => ledger.fence(slotKey).state !== 'free').length;
    return Object.freeze({
      schema: ULG_WARM_CLOSURE_MISS_BRIDGE_SCHEMA,
      closed,
      epoch: bridgeEpoch,
      sourceIdentity: currentSourceIdentity,
      remoteEnabled: Boolean(currentPeerRequester ?? globalThis.__ulgA6PeerRequester ?? requireRemotePeer),
      activeOrdinal,
      inFlightCount: inFlightByKey.size,
      pendingAdoptionCount: pendingAdoptions.length,
      cachedCount: completedByKey.size,
      remoteDebtCount: remoteDebtByKey.size,
      remoteDebt: Object.freeze(Array.from(remoteDebtByKey.values())),
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
    const key = String(
      missKey
      || `eos:${eosModel}:${Number(restDensityKgPerM3).toPrecision(8)}:${Number(soundSpeedMPerS).toPrecision(8)}:${densityRange.join(',')}`
    );
    const cached = completedByKey.get(key);
    if (cached && cached.sourceIdentity === currentSourceIdentity) {
      stats.cacheHits += 1;
      return Object.freeze({ status: 'cache-hit', missKey: key, cached, promise: null });
    }
    if (inFlightByKey.has(key)) {
      return Object.freeze({ status: 'in-flight', missKey: key, promise: inFlightByKey.get(key).promise });
    }
    const acquired = acquireSlotReservation(`eshkol:${key}`);
    if (!acquired) {
      stats.capacityDeferred += 1;
      return Object.freeze({ status: 'capacity-deferred', missKey: key, promise: null });
    }

    stats.dispatched += 1;
    const reqEpoch = bridgeEpoch;
    const reqSource = currentSourceIdentity;
    const requestArgs = {
      missKey: key,
      eosModel,
      restDensityKgPerM3,
      soundSpeedMPerS,
      densityRange,
      degree,
      relativeTolerance,
      scheduleId,
      timeoutMs
    };
    const record = {
      slotKey: acquired.slotKey,
      token: acquired.token,
      slotReleased: false,
      cancelled: false,
      epoch: reqEpoch,
      source: reqSource,
      kind: 'eos-stiffness',
      requestArgs,
      promise: null
    };

    let lastCommitDelta = null;
    let lastProvenance = null;
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
            const out = await executeDerivationPayload('eshkol-eos', {
              service: 'eshkol',
              operation: 'sample',
              scope,
              timeoutMs,
              definition,
              call,
              points
            });
            lastCommitDelta = out.commitDelta ?? null;
            lastProvenance = out.provenance ?? null;
            if (lastCommitDelta?.payload?.residency) {
              stats.lastEshkolResidency = lastCommitDelta.payload.residency;
            }
            return out.value?.samples;
          }
        });
        if (closed || record.cancelled || reqEpoch !== bridgeEpoch || reqSource !== currentSourceIdentity) {
          releaseReservationCancel(record);
          stats.staleRejected += 1;
          return Object.freeze({
            missKey: key,
            staleRejected: true,
            cancelled: record.cancelled
          });
        }
        releaseReservationCommit(record, `eshkol:${key}`);
        clearDebtIfPresent(key);
        const entry = Object.freeze({
          kind: 'eos-stiffness',
          missKey: key,
          scheduleId,
          epoch: reqEpoch,
          sourceIdentity: reqSource,
          sourceFingerprint: derived.program.sourceFingerprint,
          provenance: lastProvenance,
          derived,
          responseFunction: derived.responseFunction,
          commitDelta: lastCommitDelta
        });
        completedByKey.set(key, entry);
        pendingAdoptions.push(entry);
        stats.completed += 1;
        return entry;
      } catch (error) {
        releaseReservationCancel(record);
        if (record.cancelled || reqEpoch !== bridgeEpoch) {
          stats.staleRejected += 1;
          return Object.freeze({ missKey: key, staleRejected: true, cancelled: record.cancelled });
        }
        stats.failures += 1;
        stats.lastError = String(error?.message ?? error);
        recordDebtOnFailure(key, 'eos-stiffness', scheduleId, requestArgs, error);
        return Object.freeze({
          error: stats.lastError,
          errorCode: error?.code ?? null,
          missKey: key,
          failed: true
        });
      } finally {
        if (inFlightByKey.get(key) === record) {
          inFlightByKey.delete(key);
        }
      }
    })();
    record.promise = promise;
    inFlightByKey.set(key, record);
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
    const cached = completedByKey.get(key);
    if (cached && cached.sourceIdentity === currentSourceIdentity) {
      stats.cacheHits += 1;
      return Object.freeze({ status: 'cache-hit', missKey: key, cached, promise: null });
    }
    if (inFlightByKey.has(key)) {
      return Object.freeze({ status: 'in-flight', missKey: key, promise: inFlightByKey.get(key).promise });
    }
    const acquired = acquireSlotReservation(`moonlab:${key}`);
    if (!acquired) {
      stats.capacityDeferred += 1;
      return Object.freeze({ status: 'capacity-deferred', missKey: key, promise: null });
    }

    stats.dispatched += 1;
    const reqEpoch = bridgeEpoch;
    const reqSource = currentSourceIdentity;
    const requestArgs = { missKey: key, qubits, scheduleId, timeoutMs };
    const record = {
      slotKey: acquired.slotKey,
      token: acquired.token,
      slotReleased: false,
      cancelled: false,
      epoch: reqEpoch,
      source: reqSource,
      kind: 'quantum-probe',
      requestArgs,
      promise: null
    };

    const promise = (async () => {
      try {
        const out = await executeDerivationPayload('moonlab-ghz', {
          service: 'moonlab',
          scope,
          qubits,
          timeoutMs
        });
        const commitDelta = out.commitDelta ?? null;
        if (commitDelta?.payload?.residency) {
          stats.lastMoonlabResidency = commitDelta.payload.residency;
        }
        if (closed || record.cancelled || reqEpoch !== bridgeEpoch || reqSource !== currentSourceIdentity) {
          releaseReservationCancel(record);
          stats.staleRejected += 1;
          return Object.freeze({
            missKey: key,
            staleRejected: true,
            cancelled: record.cancelled
          });
        }
        releaseReservationCommit(record, `moonlab:${key}`);
        clearDebtIfPresent(key);
        const entry = Object.freeze({
          kind: 'quantum-probe',
          missKey: key,
          scheduleId,
          epoch: reqEpoch,
          sourceIdentity: reqSource,
          provenance: out.provenance ?? null,
          value: out.value ?? null,
          commitDelta
        });
        completedByKey.set(key, entry);
        pendingAdoptions.push(entry);
        stats.completed += 1;
        return entry;
      } catch (error) {
        releaseReservationCancel(record);
        if (record.cancelled || reqEpoch !== bridgeEpoch) {
          stats.staleRejected += 1;
          return Object.freeze({ missKey: key, staleRejected: true, cancelled: record.cancelled });
        }
        stats.failures += 1;
        stats.lastError = String(error?.message ?? error);
        recordDebtOnFailure(key, 'quantum-probe', scheduleId, requestArgs, error);
        return Object.freeze({
          error: stats.lastError,
          errorCode: error?.code ?? null,
          missKey: key,
          failed: true
        });
      } finally {
        if (inFlightByKey.get(key) === record) {
          inFlightByKey.delete(key);
        }
      }
    })();
    record.promise = promise;
    inFlightByKey.set(key, record);
    return Object.freeze({ status: 'dispatched', missKey: key, promise });
  }

  /**
   * Cancel an in-flight or staged-pending closure miss immediately, releasing
   * its G5 reservation slot and fencing any late completion from adoption.
   */
  function cancelMiss(missKey) {
    const key = String(missKey ?? '');
    let cancelled = false;
    const inflight = inFlightByKey.get(key);
    if (inflight && !inflight.cancelled) {
      inflight.cancelled = true;
      releaseReservationCancel(inflight);
      inFlightByKey.delete(key);
      cancelled = true;
    }
    for (let i = pendingAdoptions.length - 1; i >= 0; i -= 1) {
      if (pendingAdoptions[i].missKey === key) {
        pendingAdoptions.splice(i, 1);
        completedByKey.delete(key);
        cancelled = true;
      }
    }
    if (cancelled) {
      stats.cancelled += 1;
    }
    return cancelled;
  }

  /**
   * Update service/package source identity, invalidating cached & pending
   * artifacts derived under prior sources and fencing all in-flight work.
   */
  function sourceChanged(nextSourceIdentity) {
    const next = String(nextSourceIdentity ?? '');
    if (next === currentSourceIdentity) return 0;
    currentSourceIdentity = next;
    bridgeEpoch += 1;
    let dropped = 0;
    for (const [key, entry] of completedByKey) {
      if (entry.sourceIdentity !== currentSourceIdentity) {
        completedByKey.delete(key);
        dropped += 1;
      }
    }
    for (let i = pendingAdoptions.length - 1; i >= 0; i -= 1) {
      if (pendingAdoptions[i].sourceIdentity !== currentSourceIdentity) {
        pendingAdoptions.splice(i, 1);
      }
    }
    for (const [, record] of inFlightByKey) {
      releaseReservationCancel(record);
    }
    inFlightByKey.clear();
    stats.invalidations += dropped;
    return dropped;
  }

  /**
   * Retry all currently recorded remote-debt misses (e.g. after responder peers
   * rejoin or recover), without any CPU hot-state fallback.
   */
  function retryRemoteDebt({ scheduleId = null } = {}) {
    const retried = [];
    for (const debt of Array.from(remoteDebtByKey.values())) {
      if (debt.kind === 'eos-stiffness') {
        retried.push(
          requestEosStiffnessClosureMiss({
            ...debt.requestArgs,
            scheduleId: scheduleId ?? debt.scheduleId
          })
        );
      } else if (debt.kind === 'quantum-probe') {
        retried.push(
          requestQuantumClosureProbeMiss({
            ...debt.requestArgs,
            scheduleId: scheduleId ?? debt.scheduleId
          })
        );
      }
    }
    return Object.freeze(retried);
  }

  function setPeerRequester(nextRequester) {
    currentPeerRequester = nextRequester ?? null;
  }

  /**
   * Schedule-boundary adoption: promote every finished A6 closure table from
   * the current source/epoch into the G5-reserved regional closure lane and
   * GPU implicit-pressure solver, and publish deterministic commit deltas.
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
      if (entry.sourceIdentity !== currentSourceIdentity || entry.epoch !== bridgeEpoch) {
        stats.staleRejected += 1;
        continue;
      }
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
        onStateCommit(
          Object.freeze({
            ...(entry.commitDelta || { taskId: `ulg-a6-client:${entry.kind}`, scope }),
            scheduleId,
            ordinal: activeOrdinal,
            missKey: entry.missKey,
            kind: entry.kind,
            sourceIdentity: entry.sourceIdentity,
            sourceFingerprint: entry.sourceFingerprint ?? null,
            provenance: entry.provenance ?? null,
            implicitPressureUpdated,
            laneOrdinal: laneAdoption?.ordinal ?? null
          })
        );
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
    remoteDebtByKey.clear();
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
    cancelMiss,
    sourceChanged,
    retryRemoteDebt,
    setPeerRequester,
    adoptPendingAtScheduleBoundary,
    invalidateCacheKey,
    getStatus: statusSnapshot,
    destroy
  });
}
