import { runSchroederSameLevelMechanicsWebGpu } from '../../src/runtime/sph/schroederHierarchyGpu.js';
import { acquireMlsMpmMechanicsExactMassCapture } from '../../src/runtime/sph/sphG2pGpuKernel.js';
import { acquireResidentProductExactHistoryRead, destroyMlsMpmResidentStepBuffers,
  retainedContinuationBuffersFromUploads, resolveResidentProductG2pHistoryPublication }
  from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { retireMlsMpmPostMechanicsClosureOutputsAfter } from '../../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { inspectExactG2pQuantities } from './sphExactPlacementQuantityInspection.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS as terminal }
  from '../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';

// Consecutive original outer steps, including publication/adoption/retirement.
// Hooks observe genuine outputs and return them unchanged; no replacement
// stage runner or synthetic history/count authority is used.
export async function inspectExactHistoryContinuationNative({ args, next, read, mode, inspectReactionStage }) {
  const { device } = args, results = [];
  const physical = mode === 'physical' || mode === 'pressure';
  const internalPressureScale = mode === 'pressure' || mode === 'guarded-reaction' ? 1 : 0;
  let current = next, ownedCurrent = null;
  const same = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
  const retire = async owned => {
    if (!owned) return;
    const { uploads, step } = owned;
    await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(uploads.schroederSpatialSuccessorSourceFamily, { device });
    await retireMlsMpmPostMechanicsClosureOutputsAfter(step.exactMassPostMechanicsClosure,
      { after: device.queue.onSubmittedWorkDone().then(() => true) });
    destroyMlsMpmResidentStepBuffers(step);
    uploads.residentProductMass?.destroyResidentProductMassBuffers();
    buffers.destroySphGpuParticleBuffers(uploads.sphParticleUpload);
    buffers.destroyMlsMpmGpuParticleBuffers(uploads.mlsMpmParticleUpload);
  };
  try {
    for (let index = 0; index < 2; index++) {
      const input = current, family = input.schroederSpatialSuccessorSourceFamily;
      const lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
      let execution, g2pResult, motionWords, originalWords, liveCount, numerical, reaction, mechanicsAccepted, mechanicsValidation;
      const dt = mode === 'reaction' || mode === 'guarded-reaction' ? args.dtSeconds : .000001;
      try {
        execution = await runSchroederSameLevelMechanicsWebGpu({ device,
          sphParticleState: { ...args.sphParticleState, cpuStateStale: true },
          mlsMpmParticleState: { ...args.mlsMpmParticleState, cpuStateStale: true },
          sphParticleUpload: input.sphParticleUpload, mlsMpmParticleUpload: input.mlsMpmParticleUpload,
          levelAssignment: input.schroederSpatialSuccessorLevelAssignment,
          levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
          selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
          dt, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
          enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
          enableLawQueue: false, enableLawNeighborCandidates: false,
          enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
          residentStepOptions: { thermalMaterialTable: args.thermalMaterialTable,
            mechanicsMaterialTable: args.mechanicsMaterialTable, internalPressureScale,
            residentProductMass: input.residentProductMass,
            ...(!physical ? { reactionTable: args.reactionTable } : {}),
            thermalStepOptions: { conductionRate: 0 }, fuseNoFullResidentMechanics: false,
            gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null },
          gpuTimestampRecorder: { active: true, async measureQueueStage(meta, work) {
            const result = await work();
            if (meta.stage === 'reactionStep') reaction = await inspectReactionStage({ result, device, read });
            if (meta.stage !== 'g2pReconstruction') return result;
            g2pResult = result.gpuResult;
            const capture = await acquireMlsMpmMechanicsExactMassCapture(g2pResult,
              { device, sphParticleUpload: input.sphParticleUpload });
            try {
              const h = capture.history;
              if (!h || h.sourceHandle !== input.residentProductMass) throw new Error('Outer G2P did not consume its actual input history');
              mechanicsValidation = read ? Array.from(await read(h.validationBuffer)) : null;
              mechanicsAccepted = read ? mechanicsValidation[0] === 0 : capture.validate();
              if (read) {
                originalWords = await read(h.source.buffer); motionWords = await read(h.buffer);
                liveCount = (await read(h.descriptor.controlBuffer))[h.descriptor.controlOffsetBytes / 4 + 3];
                numerical = inspectExactG2pQuantities({ before: await read(h.quantities.original),
                  after: await read(h.quantities.quantityBuffer), sourceState: await read(h.stateBuffer),
                  sourceMechanics: await read(h.mechanicsBuffer), state: await read(h.outStateBuffer),
                  mechanics: await read(h.outMechanicsBuffer), increments: await read(h.quantities.projectionBuffer),
                  validation: await read(h.quantities.validationBuffer), layout: h.quantityLayout, format: h.layout.format });
              } else numerical = { matches: capture.validate() };
            } finally { capture.release(); }
            return result;
          } }
        });
      } finally { spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device }); }
      const step = execution.residentStep, successor = step.nextParticleUploads;
      const nextOwned = { step, uploads: successor }, closure = step.exactMassPostMechanicsClosure;
      let outputRead;
      try {
        const motionHandle = closure.continuation.inputResidentProductMass;
        let motionPublicationLifetime = false;
        if (physical) {
          motionPublicationLifetime = Boolean(resolveResidentProductG2pHistoryPublication(motionHandle,
            { device, g2pResult, inputResidentProductMass: input.residentProductMass }));
        } else {
          // Adoption validates the genuine publication before releasing its
          // intermediate view. The merged successor owns the live count now.
          try {
            resolveResidentProductG2pHistoryPublication(motionHandle,
              { device, g2pResult, inputResidentProductMass: input.residentProductMass });
          } catch (error) {
            if (!(error instanceof TypeError) || !/original live view and count authority/.test(error.message)) throw error;
            motionPublicationLifetime = motionHandle !== successor.residentProductMass;
          }
        }
        outputRead = acquireResidentProductExactHistoryRead(successor.residentProductMass,
          { device, identityBuffer: successor.sphParticleUpload.identityBuffer });
        const checks = { completedOuterStep: Boolean(step), motionPublicationLifetime, mechanicsAccepted,
          originalPressureScale: g2pResult.internalPressureScale === internalPressureScale,
          adoptedHistory: successor.residentProductMass === closure.continuation.residentProductMass,
          independentOwner: successor.residentProductMass !== input.residentProductMass,
          numerical: numerical.matches };
        let words, count, expectedCount;
        if (read) {
          words = await read(outputRead.buffer);
          const control = (await read(outputRead.descriptor.controlBuffer)).slice(outputRead.descriptor.controlOffsetBytes / 4);
          count = control[3]; expectedCount = liveCount + (reaction?.residualRowCount ?? 0);
          checks.readyCount = control[0] === 0x50484731 && control[2] === 1 && control[11] === 0;
          checks.exactCount = count === expectedCount;
          checks.motionPrefix = same(words.slice(0, liveCount * outputRead.layout.rowWords),
            motionWords.slice(0, liveCount * outputRead.layout.rowWords));
          checks.inputUnchanged = same(await read(input.residentProductMass.productEventBuffer), originalWords);
          checks.zeroTail = words.slice(count * outputRead.layout.rowWords).every(word => word === 0);
          if (physical) checks.noReactionAppend = successor.residentProductMass.exactProductHistoryProvenance
            === input.residentProductMass.exactProductHistoryProvenance;
          else {
            checks.reactionConservation = reaction.conservation.matches;
            checks.reactionTerminal = reaction.receipt.transactionalTerminalStatus
              === (mode === 'rollback' ? terminal.SAFE_FROZEN_FALLBACK : terminal.SAFE_PLACED);
            checks.reactionRows = mode === 'rollback' || mode === 'guarded-reaction'
              ? reaction.residualRowCount === 0 : reaction.residualRowCount > 0;
          }
        }
        await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: device.queue.onSubmittedWorkDone().then(() => true) });
        destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: retainedContinuationBuffersFromUploads(successor),
          preserveResidentProductMass: successor.residentProductMass });
        checks.countAuthoritySurvivesRetirement = outputRead.validate();
        if (read) checks.bytesSurviveRetirement = same(words, await read(outputRead.buffer));
        const result = { index, mode, checks, numerical, mechanicsValidation,
          reactionConservation: reaction?.conservation, reactionQuantityHeaders: reaction?.quantityHeaders,
          inputLiveRows: liveCount, outputLiveRows: count,
          expectedCount, emittedRows: reaction?.residualRowCount, receipt: reaction?.receipt,
          pass: Object.values(checks).every(Boolean) };
        results.push(result);
        if (read) await globalThis.recordExactPlacementProgress({ phase: 'complete-history-step', result });
      } catch (error) {
        outputRead?.release(); outputRead = null;
        try { await retire(nextOwned); }
        catch (cleanupError) {
          throw new AggregateError([error, cleanupError], `${error.message}; cleanup: ${cleanupError.message}`);
        }
        throw error;
      }
      finally { outputRead?.release(); }
      await retire(ownedCurrent);
      current = successor; ownedCurrent = nextOwned;
    }
    const changedVolumeRows = results.reduce((sum, r) => sum + (r.numerical.changedVolumeRows ?? 0), 0);
    return { mode, internalPressureScale, completedFollowingSteps: results.length, results, changedVolumeRows,
      pass: results.every(result => result.pass) && (!read || mode !== 'pressure' || changedVolumeRows > 0) };
  } finally { await retire(ownedCurrent); }
}
