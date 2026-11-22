import { createSchroederSpatialPhaseVolumeInterfaceProposalGpu } from './schroederSpatialPhaseVolumeInterfaceProposalGpu.js';
import { resolveSchroederSpatialMechanicsChainAuthority,
  resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority } from './schroederSpatialEpochTransaction.js';
import { unwrapWebGpuCacheDevice } from '../webgpuComputeLayout.js';

const owners = new WeakMap();
const localTransportRuntimePoolByDevice = new WeakMap();
const LOCAL_TRANSPORT_POOL_MAX_CAPACITIES = 16;

function acquirePooledLocalTransportRuntime(device, fineFieldCapacity) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const byCap = localTransportRuntimePoolByDevice.get(keyDevice);
  if (byCap) {
    const bucket = byCap.get(fineFieldCapacity);
    if (bucket && bucket.length > 0) {
      const runtime = bucket.pop();
      byCap.delete(fineFieldCapacity);
      byCap.set(fineFieldCapacity, bucket);
      return runtime;
    }
  }
  return createSchroederSpatialPhaseVolumeInterfaceProposalGpu(device, {
    fineFieldCapacity, arenaCount: 1
  });
}

function releasePooledLocalTransportRuntime(device, fineFieldCapacity, runtime, { destroy = false } = {}) {
  if (!runtime) return true;
  if (destroy) {
    return runtime.destroy();
  }
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let byCap = localTransportRuntimePoolByDevice.get(keyDevice);
  if (!byCap) {
    byCap = new Map();
    localTransportRuntimePoolByDevice.set(keyDevice, byCap);
  }
  let bucket = byCap.get(fineFieldCapacity);
  if (!bucket) {
    bucket = [];
    byCap.set(fineFieldCapacity, bucket);
  } else {
    byCap.delete(fineFieldCapacity);
    byCap.set(fineFieldCapacity, bucket);
  }
  const bucketLimit = (typeof globalThis.GPUDevice === 'function' && keyDevice instanceof globalThis.GPUDevice) ? 8 : 4;
  if (bucket.length < bucketLimit) {
    bucket.push(runtime);
  } else {
    runtime.destroy();
  }
  while (byCap.size > LOCAL_TRANSPORT_POOL_MAX_CAPACITIES) {
    const oldestCap = byCap.keys().next().value;
    const evicted = byCap.get(oldestCap);
    byCap.delete(oldestCap);
    if (evicted) {
      for (const r of evicted) {
        try { r.destroy(); } catch {}
      }
    }
  }
  return true;
}
export function resolveSchroederChainLocalTransport(handle, device, transaction, enabled) {
  const owner = owners.get(handle);
  if (!owner || owner.device !== device || owner.transaction !== transaction || owner.retired
    || enabled.length !== owner.enabled.length || enabled.some((value, i) => value !== owner.enabled[i])) {
    throw new TypeError('Native transport requires its original pre-P2G topology family');
  }
  for (const authority of handle.authorities) authority?.validate();
  return handle;
}

// Native S9-C heads describe co-located native fields only. They do not claim
// inherited/composite interface or reflux authority. The composite owner keeps
// these original topology producers alive through all native consumers.
export async function prepareSchroederChainLocalTransport(device, transaction, enabled, { poolRuntimes = false } = {}) {
  const chain = resolveSchroederSpatialMechanicsChainAuthority(transaction, { device });
  if (!Array.isArray(enabled) || enabled.length !== chain.mechanicsLevelViews.length) {
    throw new TypeError('Native transport requires one explicit declaration per mechanics level');
  }
  const records = [];
  const owner = { device, transaction, enabled: [...enabled], retired: false };
  let submitted = false;
  const encoder = device.createCommandEncoder();
  const retire = async fence => {
    if (!fence?.then) throw new TypeError('Native topology retirement requires its consumer fence');
    await fence;
    owner.retired = true;
    for (const record of records) {
      let healthy = true;
      try {
        if (record.proposal && !record.proposal.released) {
          if (submitted) await record.runtime.releaseExecutionAfter(record.proposal, fence);
          else record.runtime.releaseExecution(record.proposal, { discardedEncoder: true });
        }
      } catch (err) {
        healthy = false;
        try { record.runtime.destroy(); } catch {}
        throw err;
      }
      releasePooledLocalTransportRuntime(device, record.fineFieldCapacity, record.runtime, { destroy: !healthy || !submitted || poolRuntimes !== true });
    }
    return true;
  };
  try {
    for (const [index, view] of chain.mechanicsLevelViews.entries()) {
      if (!enabled[index]) continue;
      const base = resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(transaction, {
        selectedLevel: view.selectedLevel, mechanicsFieldView: view.mechanicsFieldView
      });
      const runtime = poolRuntimes === true
        ? acquirePooledLocalTransportRuntime(device, base.fieldCapacity)
        : createSchroederSpatialPhaseVolumeInterfaceProposalGpu(device, {
            fineFieldCapacity: base.fieldCapacity, arenaCount: 1
          });
      const record = { index, runtime, base, fineFieldCapacity: base.fieldCapacity, proposal: null };
      records.push(record);
      try { record.proposal = runtime.encode(encoder, {
        fineReceipt: base.phaseVolumeReceipt, submittedNativeReceipt: base.phaseVolumeReceipt
      }); }
      catch (error) { record.proposal = error.phaseVolumeInterfaceProposalExecution ?? null; throw error; }
    }
    const command = encoder.finish();
    // On a submit exception ownership is uncertain; fence it before cleanup.
    submitted = true;
    try { device.queue.submit([command]); }
    finally {
      for (const record of records) {
        if (record.runtime.markExecutionSubmitted(record.proposal) !== true) {
          throw new Error('Native topology producer did not acknowledge submission');
        }
      }
    }
    const authorities = enabled.map(() => null);
    for (const { index, runtime, base, proposal } of records) {
      const buffers = [proposal.controlBuffer, proposal.localHeadBuffer, proposal.refluxRouteBuffer, proposal.paramsBuffer];
      const snapshot = Object.entries(proposal);
      const layoutSnapshot = Object.entries(proposal.layout);
      authorities[index] = Object.freeze({ ...base,
        levelIndex: 0, levelRole: 'native-local', twoLevel: false,
        fineLevel: base.selectedLevel, coarseLevel: -0x80000000,
        phaseVolumeInterfaceProposal: proposal,
        phaseVolumeInterfaceProposalControlBuffer: buffers[0],
        phaseVolumeInterfaceLocalHeadBuffer: buffers[1],
        phaseVolumeInterfaceLocalHeadOffsetWords: proposal.layout.fineLocalHeadOffsetWords,
        validate() {
          resolveSchroederSpatialMechanicsChainAuthority(transaction, { device });
          const current = resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(transaction, {
            selectedLevel: base.selectedLevel, mechanicsFieldView: base.mechanicsFieldView
          });
          if (current.phaseVolumeReceipt !== base.phaseVolumeReceipt
            || snapshot.some(([key, value]) => proposal[key] !== value)
            || layoutSnapshot.some(([key, value]) => proposal.layout[key] !== value)
            || !runtime.ownsExecution(proposal) || !runtime.isExecutionSubmitted(proposal)
            || proposal.ownerRuntime !== runtime || proposal.released || proposal.releaseScheduled
            || proposal.fineReceipt !== base.phaseVolumeReceipt || proposal.coarseReceipt != null
            || proposal.parentFieldView != null || proposal.twoLevel !== false
            || [proposal.controlBuffer, proposal.localHeadBuffer, proposal.refluxRouteBuffer, proposal.paramsBuffer]
              .some((buffer, i) => buffer !== buffers[i] || buffer.destroyed)) {
            throw new TypeError('Native transport topology lost original source or lifetime authority');
          }
          return true;
        }
      });
    }
    const result = Object.freeze({ authorities: Object.freeze(authorities), retire,
      finish() {
        if (owner.retired) throw new TypeError('Native topology family already finished');
        for (const record of records) {
          if (!record.runtime.canReleaseExecutionQueueOrdered(record.proposal)) {
            throw new Error('Native topology producer is still held by another owner');
          }
        }
        for (const record of records) record.runtime.releaseExecutionQueueOrdered(record.proposal);
        // All reads have submitted. Release borrowed parent identities now;
        // owned allocations remain until the composite's existing fence.
        owner.retired = true;
      }
    });
    owners.set(result, owner);
    return result;
  } catch (error) {
    try { await retire(device.queue.onSubmittedWorkDone()); }
    catch (cleanupError) { error.nativeTransportCleanupError = cleanupError; }
    throw error;
  }
}
