import { createSchroederSpatialPhaseVolumeInterfaceProposalGpu } from './schroederSpatialPhaseVolumeInterfaceProposalGpu.js';
import { resolveSchroederSpatialMechanicsChainAuthority,
  resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority } from './schroederSpatialEpochTransaction.js';

const owners = new WeakMap();
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
export async function prepareSchroederChainLocalTransport(device, transaction, enabled) {
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
      if (record.proposal && !record.proposal.released) {
        if (submitted) await record.runtime.releaseExecutionAfter(record.proposal, fence);
        else record.runtime.releaseExecution(record.proposal, { discardedEncoder: true });
      }
      if (!record.runtime.destroy()) throw new Error('Native topology still has live consumers');
    }
    return true;
  };
  try {
    for (const [index, view] of chain.mechanicsLevelViews.entries()) {
      if (!enabled[index]) continue;
      const base = resolveSchroederSpatialPhaseVolumeSurfaceStressAuthority(transaction, {
        selectedLevel: view.selectedLevel, mechanicsFieldView: view.mechanicsFieldView
      });
      const runtime = createSchroederSpatialPhaseVolumeInterfaceProposalGpu(device, {
        fineFieldCapacity: base.fieldCapacity, arenaCount: 1
      });
      const record = { index, runtime, base, proposal: null };
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
