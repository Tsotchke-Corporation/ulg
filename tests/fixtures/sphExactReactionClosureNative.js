import { inspectExactHistoryContinuationNative } from './sphExactHistoryContinuationNative.js';
import { destroyMlsMpmResidentStepBuffers, retainedContinuationBuffersFromUploads, acquireResidentProductExactHistoryRead } from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { runSphThermalStepWebGpu, resolveSphThermalSourceCapture } from '../../src/runtime/sph/sphThermalGpuKernel.js';
import { runMlsMpmPostMechanicsClosureWebGpu, claimMlsMpmPostMechanicsContinuation,
  resolveMlsMpmPostMechanicsExactMassContinuation, retireMlsMpmPostMechanicsClosureOutputsAfter }
  from '../../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import { runSchroederSpatialReactionDiscoveryProposalWebGpu }
  from '../../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import { runSchroederLevelAssignmentWebGpu, runSchroederSameLevelMechanicsWebGpu } from '../../src/runtime/sph/schroederHierarchyGpu.js';
import { acquireMlsMpmMechanicsExactMassCapture } from '../../src/runtime/sph/sphG2pGpuKernel.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { sealSchroederSpatialEpochTransactionReaders, sealSchroederSpatialEpochTransactionProposals,
  commitSchroederSpatialEpochTransaction } from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import { inspectExactPlacementConservation, inspectExactMechanicsRefresh, inspectExactG2pQuantities, inspectExactThermalQuantities, inspectExactPublishedQuantities, inspectExactCarriedReaction } from './sphExactPlacementQuantityInspection.js';
import { inspectCapturedExactReactionNative } from './sphCapturedExactReactionNative.js';
import { runSphExactReactionSourceSelectionWebGpu, resolveSphExactReactionSourceSelection } from '../../src/runtime/sph/sphExactReactionSourceGpu.js';
import { runSphExactReactionRoutingCandidateWebGpu } from '../../src/runtime/sph/sphExactReactionRoutingGpu.js';
import { sphReactionEnergyEntry } from '../../src/runtime/sph/sphReactionEnergyAuthority.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as receiptIndex }
  from '../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { inspectExactHistoryP2gNative } from './sphExactHistoryP2gNative.js';
import { inspectExactHistoryGasNative } from './sphExactHistoryGasNative.js';

// Inspect only after the actual hierarchy/resident step has returned. All
// publication, adoption and commit operations are owned by that original step.
export async function inspectExactReactionStage({ result, device, read }) {
  const artifact = result.reactionSummary.reactionProductPlacementSubmissionArtifact;
  const family = artifact.placementSourceFamily;
  const observed = { originalReaction: result.reactionAllocationMode === 'exact-integer-pair-allocation' };
  if (read) {
    const receiptWords = await read(artifact.completionReceiptBuffer);
    observed.receipt = Object.fromEntries(Object.entries(receiptIndex).map(([key, index]) => [key, receiptWords[index]]));
    observed.placed = await read(family.placedDestinationQuantityBuffer);
    const residualCount = await read(family.placedDestinationResidualCountBuffer);
    observed.residualRowCount = residualCount[0];
    observed.residualPhysical = await read(family.placedDestinationResidualPhysicalBuffer);
    const beforeWords = await read(family.frozenSourceQuantityBuffer), beforeLayout = family.frozenSourceQuantityLayout;
    observed.quantityHeaders = { before: Array.from({ length: beforeLayout.rowCount }, (_, row) =>
      Array.from(beforeWords.slice(row * beforeLayout.recordWords, row * beforeLayout.recordWords + 16))),
      after: Array.from({ length: family.placedDestinationQuantityLayout.rowCount }, (_, row) =>
        Array.from(observed.placed.slice(row * family.placedDestinationQuantityLayout.recordWords,
          row * family.placedDestinationQuantityLayout.recordWords + 16))) };
    observed.conservation = inspectExactPlacementConservation({
      beforeWords, beforeLayout,
      afterWords: observed.placed, afterLayout: family.placedDestinationQuantityLayout,
      residualCount,
      residualCompanions: await read(family.placedDestinationResidualCompanionBuffer),
      companionStrideWords: family.placedDestinationResidualLayout.companionStrideWords,
      terminalStatus: observed.receipt.transactionalTerminalStatus });
  }
  return observed;
}

export async function inspectCompletedExactReactionStep({ execution, args, stageEvidence, read, options = {} }) {
  const { device } = args, step = execution.residentStep, next = step.nextParticleUploads;
  const closure = step.exactMassPostMechanicsClosure;
  const held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, device,
    { mlsMpmParticleUpload: next.mlsMpmParticleUpload });
  const exact = held.quantities;
  const checks = { completedOuterStep: !!step, published: !!next.schroederSpatialSuccessorSourceFamily,
    adoptedMass: held.read.family === next.schroederSpatialSuccessorSourceFamily.exactMassInventory,
    adoptedQuantities: !!exact && exact.quantityLayout.rowCount === args.sphParticleState.particleCount,
    historyRetained: next.residentProductMass === closure.continuation.residentProductMass,
    originalReaction: stageEvidence.originalReaction
      && closure.reactionStep?.reactionAllocationMode === 'exact-integer-pair-allocation' };
  const { receipt, conservation } = stageEvidence;
  let mechanicsRefresh, quantities, history, historyP2g, historyGas, historyContinuation, vaporPublication;
  try {
    if (read) {
      quantities = await read(exact.quantityBuffer);
      mechanicsRefresh = inspectExactMechanicsRefresh({ before: args.vaporCommitNative?.particleInput() ?? stageEvidence.placed, after: quantities,
        thermo: await read(next.sphParticleUpload.thermoBuffer), mechanics: await read(next.mlsMpmParticleUpload.mechanicsBuffer),
        layout: exact.quantityLayout, format: exact.format });
      history = await read(next.residentProductMass.productEventBuffer);
      const layout = next.residentProductMass.exactProductHistoryLayout;
      const expectedHistory = args.vaporCommitNative?.expectedHistory();
      checks.residualPhysicalRetained = layout.physicalWords === 52
        && Array.from({ length: stageEvidence.residualRowCount }, (_, row) => row).every(row =>
          history.slice(row * layout.rowWords + layout.physicalOffsetWords,
            row * layout.rowWords + layout.physicalOffsetWords + 52).every((word, i) =>
            word === (expectedHistory ? expectedHistory[row * layout.rowWords + layout.physicalOffsetWords + i]
              : stageEvidence.residualPhysical[row * 52 + i])))
        && stageEvidence.residualPhysical.slice(stageEvidence.residualRowCount * 52).every(word => word === 0);
      checks.conservation = conservation.matches; checks.mechanicsRefresh = mechanicsRefresh.matches;
    }
    if (args.vaporCommitNative) {
      vaporPublication = await args.vaporCommitNative.inspectPublished(next, closure);
      checks.vaporPublication = vaporPublication.pass;
    }
    await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: device.queue.onSubmittedWorkDone().then(() => true) });
    destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: retainedContinuationBuffersFromUploads(next),
      preserveResidentProductMass: next.residentProductMass });
    const historyRead = acquireResidentProductExactHistoryRead(next.residentProductMass, { device,
      identityBuffer: next.sphParticleUpload.identityBuffer });
    checks.historyAuthoritySurvivesStepRetirement = historyRead.validate(); historyRead.release();
    checks.ownerSurvivesStepRetirement = buffers.validateSphParticleExactMassRead(held,
      { device, sourceSphUpload: next.sphParticleUpload });
    if (read) {
      const same = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
      checks.quantitiesSurviveStepRetirement = same(quantities, await read(held.quantities.quantityBuffer));
      checks.historySurvivesStepRetirement = same(history, await read(next.residentProductMass.productEventBuffer));
    }
    if (args.vaporCommitNative) checks.vaporSurvivesStepRetirement = (await args.vaporCommitNative.inspectPublished(next, closure)).pass;
    if (options.inspectHistoryP2g) {
      historyP2g = await inspectExactHistoryP2gNative({ args, next, read, tracePasses: options.traceHistoryP2g, inspectG2p: options.inspectHistoryG2p, rejectG2p: options.rejectHistoryG2p });
      checks.historyP2g = historyP2g.pass;
    }
    if (options.inspectHistoryGas) {
      historyGas = await inspectExactHistoryGasNative({ args, next, read,
        expectedCondensedRows: options.name === 'subthreshold-mixed-gas-history' ? 1 : 0 });
      checks.historyGas = historyGas.pass;
    }
    if (options.historyContinuation) {
      historyContinuation = await inspectExactHistoryContinuationNative({ args, next, read,
        mode: options.historyContinuation, inspectReactionStage: inspectExactReactionStage });
      checks.historyContinuation = historyContinuation.pass;
    }
    if (args.currentGasEvidence) checks.currentGas = args.currentGasEvidence.pass;
    return { name: options.name, options, enclosingMechanicsStepCompleted: true, completeOuterReaction: true, historyP2g, historyGas, historyContinuation,
      currentGas: args.currentGasEvidence ?? null, vaporPublication,
      receipt, conservation, mechanicsRefresh, residualRowCount: stageEvidence.residualRowCount,
      checks, pass: Object.values(checks).every(Boolean) };
  } finally {
    await buffers.releaseSphParticleExactMassRead(held);
    await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(next.schroederSpatialSuccessorSourceFamily, { device });
    destroyMlsMpmResidentStepBuffers(step);
    buffers.destroySphGpuParticleBuffers(next.sphParticleUpload);
    buffers.destroyMlsMpmGpuParticleBuffers(next.mlsMpmParticleUpload);
  }
}

async function inspectFollowingMechanics({ args, next, publication, read, advanceThermal, advanceReaction, traceReaction, advanceFullStep, remainingPhysicalSteps = 2 }) {
  const { device } = args, stop = new Error('Following genuine G2P inspected before thermal');
  const family = publication.sourceFamily;
  const lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
  let observed, execution, successor, g2pQuantities;
  try {
    execution = await runSchroederSameLevelMechanicsWebGpu({ device,
      sphParticleState: { ...args.sphParticleState, cpuStateStale: true },
      mlsMpmParticleState: { ...args.mlsMpmParticleState, cpuStateStale: true },
      sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
      levelAssignment: next.schroederSpatialSuccessorLevelAssignment,
      levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
      selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
      // The manufactured reaction graph covers only 200..500 K. Its original
      // microsecond interval keeps the repeated-reaction heat update inside
      // that domain; the separate physical/thermal stress cases retain 1 ms.
      dt: advanceReaction ? .000001 : .001, gravityMPerS2: [0, -9.8, 0], readbackMode: 'no-full-readback',
      enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
      enableLawQueue: false, enableLawNeighborCandidates: false,
      enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
      residentStepOptions: { thermalMaterialTable: args.thermalMaterialTable,
        mechanicsMaterialTable: args.mechanicsMaterialTable, internalPressureScale: 0,
        thermalStepOptions: { wallLayerM: 2, wallTemperaturesK: { xMin: 1000 } },
        fuseNoFullResidentMechanics: false, gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null },
      gpuTimestampRecorder: { active: true, async measureQueueStage(meta, work) {
          const result = await work();
          if (meta.stage !== 'g2pReconstruction') return result;
          const capture = await acquireMlsMpmMechanicsExactMassCapture(result.gpuResult, { device, sphParticleUpload: next.sphParticleUpload });
          try {
            if (!capture.quantities) throw new Error('Following G2P discarded the carried quantity owner');
            if (read) {
              observed = inspectExactG2pQuantities({
                before: await read(capture.sourceRead.quantities.quantityBuffer), after: await read(capture.quantities.quantityBuffer),
                sourceState: await read(next.sphParticleUpload.stateBuffer), sourceMechanics: await read(next.mlsMpmParticleUpload.mechanicsBuffer),
                state: await read(capture.stateBuffer), mechanics: await read(capture.mechanicsBuffer),
                increments: await read(capture.quantities.projectionBuffer), validation: await read(capture.quantities.validationBuffer),
                layout: capture.quantities.quantityLayout, format: capture.quantities.format });
            } else observed = { matches: capture.quantities.quantityBuffer !== capture.sourceRead.quantities.quantityBuffer };
            if (advanceFullStep && read) g2pQuantities = await read(capture.quantities.quantityBuffer);
            if (advanceThermal && !advanceFullStep) {
              const token = Object.freeze({}); let thermal, seal;
              try {
                thermal = await runSphThermalStepWebGpu({ device, sphParticleState: capture.sourceSphState ?? args.sphParticleState,
                  sphParticleUpload: next.sphParticleUpload, thermalMaterialTable: args.thermalMaterialTable,
                  exactMassG2pResult: result.gpuResult, exactMassSpatialEpochTransaction: capture.transaction,
                  exactMassSpatialEpochGeneration: capture.generation, postMechanicsSourceCapture: token,
                  sourceStateBuffer: capture.stateBuffer, sourceThermoBuffer: capture.thermoBuffer,
                  dtS: capture.dt, boxDimsM: [2, 2, 2], wallLayerM: 2, wallTemperaturesK: { xMin: 1000 },
                  retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' });
                seal = resolveSphThermalSourceCapture(thermal, token);
                if (!seal.exactThermal) throw new Error('Following thermal discarded the carried quantity owner');
                observed.thermal = read ? inspectExactThermalQuantities({ before: await read(capture.quantities.quantityBuffer),
                  after: await read(seal.exactThermal.quantityBuffer), updates: await read(seal.exactThermal.updates),
                  validation: await read(seal.exactThermal.validationBuffer), state: await read(thermal.stateBuffer), thermo: await read(thermal.thermoBuffer),
                  layout: seal.exactThermal.quantityLayout, format: seal.exactThermal.format })
                  : { matches: seal.exactThermal.quantityBuffer !== capture.quantities.quantityBuffer };
                observed.matches &&= observed.thermal.matches;
                if (advanceReaction) {
                  let proposal;
                  try {
                    const reactionArgs = { ...args, sphParticleState: capture.sourceSphState ?? args.sphParticleState,
                      sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
                      g2pResult: result.gpuResult, thermalResult: thermal, thermalSourceCapture: token,
                      transaction: capture.transaction, generation: capture.generation, dtSeconds: capture.dt };
                    proposal = await runSchroederSpatialReactionDiscoveryProposalWebGpu({ ...reactionArgs,
                      sourceStateBuffer: thermal.stateBuffer, sourceThermoBuffer: thermal.thermoBuffer,
                      sourceMechanicsBuffer: capture.mechanicsBuffer });
                    reactionArgs.reactionDiscoveryProposal = proposal;
                    if (!read) {
                      let selected, routed;
                      try {
                        selected = await runSphExactReactionSourceSelectionWebGpu(reactionArgs);
                        routed = await runSphExactReactionRoutingCandidateWebGpu({ selection: selected, expected: { device } });
                        observed.reaction = { pass: selected.extensiveEncoding === 'rational'
                          && routed.physicalOutput.quantities.layout.scalar.wordCount === seal.exactThermal.quantityLayout.scalar.wordCount };
                      } finally { await routed?.release(); await selected?.release(); }
                    } else observed.reaction = await inspectCapturedExactReactionNative({ args: reactionArgs, read,
                      options: { name: 'following-carried-reaction', traceReaction }, inspectSelection: async selected => {
                        const view = resolveSphExactReactionSourceSelection(selected, { device });
                        return inspectExactCarriedReaction({ source: await read(seal.exactThermal.quantityBuffer), sourceState: await read(thermal.stateBuffer),
                          layout: seal.exactThermal.quantityLayout, packet: await read(selected.outputBuffer), selected,
                          compiled: view.compiled, energyEntries: view.compiled.map((_, rx) => sphReactionEnergyEntry(args.reactionTable, rx)) });
                      } });
                    observed.matches &&= observed.reaction.pass;
                  } finally { proposal?.destroy(); }
                }
              } catch (error) {
                await Promise.all([error.exactThermalSourceCleanupCompletion, error.exactReactionSourceCleanupCompletion]);
                throw error;
              } finally { seal?.release(); thermal?.destroyOutputParticleBuffers(); }
            }

          } finally { await capture.release(); if (!advanceFullStep) result.gpuResult.destroyOutputParticleBuffers(); }
          if (advanceFullStep) return result;
          throw stop;
        } }
      });
    if (!advanceFullStep) throw new Error('Following mechanics did not reach the genuine G2P producer');
    const step = execution.residentStep;
    successor = step.nextParticleUploads;
    const nextClosure = step.exactMassPostMechanicsClosure;
    const readOwner = buffers.acquireSphParticleExactMassRead(successor.sphParticleUpload, device,
      { mlsMpmParticleUpload: successor.mlsMpmParticleUpload });
    try {
      const exact = readOwner.quantities;
      if (!exact || !successor.schroederSpatialSuccessorSourceFamily) {
        throw new Error('Following full step did not publish the evolved quantity owner');
      }
      let expected;
      if (read) {
        expected = await read(exact.quantityBuffer);
        observed.published = inspectExactPublishedQuantities({ before: g2pQuantities, after: expected,
          state: await read(successor.sphParticleUpload.stateBuffer), thermo: await read(successor.sphParticleUpload.thermoBuffer),
          mechanics: await read(successor.mlsMpmParticleUpload.mechanicsBuffer), layout: exact.quantityLayout, format: exact.format });
        observed.matches &&= observed.published.matches;
      }
      await retireMlsMpmPostMechanicsClosureOutputsAfter(nextClosure, { after: device.queue.onSubmittedWorkDone().then(() => true) });
      destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: retainedContinuationBuffersFromUploads(successor),
        preserveResidentProductMass: successor.residentProductMass });
      if (read) {
        const actual = await read(readOwner.quantities.quantityBuffer);
        observed.ownerSurvivesStepRetirement = actual.length === expected.length && actual.every((word, i) => word === expected[i]);
        observed.matches &&= observed.ownerSurvivesStepRetirement;
      }
      observed.followingPhysicalStepCompleted = true;
    } finally { await buffers.releaseSphParticleExactMassRead(readOwner); }
    observed.followingPhysicalStepCount = 1;
    if (remainingPhysicalSteps > 1) {
      observed.nextPhysicalStep = await inspectFollowingMechanics({ args, next: successor,
        publication: { sourceFamily: successor.schroederSpatialSuccessorSourceFamily }, read,
        advanceThermal, advanceReaction, traceReaction, advanceFullStep, remainingPhysicalSteps: remainingPhysicalSteps - 1 });
      observed.matches &&= observed.nextPhysicalStep.matches;
      observed.followingPhysicalStepCount += observed.nextPhysicalStep.followingPhysicalStepCount;
    }
    return observed;
  } catch (error) {
    if (error !== stop) throw error;
    return observed;
  } finally {
    spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });
    if (successor) {
      await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(successor.schroederSpatialSuccessorSourceFamily, { device });
      destroyMlsMpmResidentStepBuffers(execution.residentStep);
      buffers.destroySphGpuParticleBuffers(successor.sphParticleUpload);
      buffers.destroyMlsMpmGpuParticleBuffers(successor.mlsMpmParticleUpload);
    }
  }
}

// Genuine closure, final spatial classification, commit and particle ownership.
// Optional continuation checks run real subsequent physical steps. They omit
// another reaction/history merge, which remains a separate unproven boundary.
export async function inspectExactReactionClosureNative({ args, read = null, options = {} }) {
  const { device } = args;
  let closure, next, plan, publication, held, retired = false;
  const checks = {};
  try {
    closure = await runMlsMpmPostMechanicsClosureWebGpu({ ...args,
      postMechanicsParticleBuffers: args.g2pResult, postMechanicsG2pResult: args.g2pResult,
      schroederSpatialEpochTransaction: args.transaction, schroederSpatialEpochGeneration: args.generation,
      spatialReactionDiscoveryProposalRunner: runSchroederSpatialReactionDiscoveryProposalWebGpu,
      thermalStepOptions: { conductionRate: 0 }, boxDimsM: [2, 2, 2], readbackMode: 'no-full-readback' });
    const { exactMassInventory, exactMassInventoryRange, ...source } = args.sphParticleUpload;
    next = { sphParticleUpload: { ...source, stateBuffer: closure.continuation.stateBuffer,
      thermoBuffer: closure.continuation.thermoBuffer, ownsStateBuffer: true, ownsThermoBuffer: true,
      ownsIdentityBuffer: false, ownsMaterialPropertyBankWarmInputBuffer: false, ownsMaterialPropertyBankParticleSizeBuffer: false },
      mlsMpmParticleUpload: { ...args.mlsMpmParticleUpload, mechanicsBuffer: closure.continuation.mechanicsBuffer,
        ownsMechanicsBuffer: true, ownsMaterialPropertyBankWarmInputBuffer: false, ownsMaterialPropertyBankParticleSizeBuffer: false },
      residentProductMass: closure.continuation.residentProductMass };
    const claim = claimMlsMpmPostMechanicsContinuation(closure, { nextParticleUploads: next });
    const captured = resolveMlsMpmPostMechanicsExactMassContinuation(closure, claim, next);
    const exact = captured.exactQuantities, reaction = exact.source;
    checks.changedMassFamily = captured.carrierMassRead.family !== exactMassInventory;
    checks.carrierRange = captured.carrierMassRead.rowCount === args.sphParticleState.particleCount
      && exact.quantityLayout.rowCount === args.sphParticleState.particleCount;
    checks.closureReady = closure.residentContinuationReady === true;
    let conservation, mechanicsRefresh, receipt, quantityWords, historyWords, residualRowCount;
    if (read) {
      const placement = reaction.destinationRead, physical = reaction.routingView().result.physicalOutput;
      const receiptWords = await read(reaction.placementArtifact.completionReceiptBuffer);
      receipt = Object.fromEntries(Object.entries(receiptIndex).map(([key, index]) => [key, receiptWords[index]]));
      const before = await read(physical.quantities.outputBuffer), placed = await read(placement.quantityBuffer);
      const residualCount = await read(placement.residualCountBuffer);
      residualRowCount = residualCount[0];
      conservation = inspectExactPlacementConservation({ beforeWords: before, beforeLayout: physical.quantities.layout,
        afterWords: placed, afterLayout: placement.quantityLayout, residualCount,
        residualCompanions: await read(placement.residualCompanionBuffer),
        companionStrideWords: placement.residualLayout.companionStrideWords,
        terminalStatus: receipt.transactionalTerminalStatus });
      quantityWords = await read(exact.quantityBuffer);
      mechanicsRefresh = inspectExactMechanicsRefresh({ before: placed, after: quantityWords,
        thermo: await read(next.sphParticleUpload.thermoBuffer), mechanics: await read(next.mlsMpmParticleUpload.mechanicsBuffer),
        layout: exact.quantityLayout, format: exact.format });
      historyWords = await read(next.residentProductMass.productEventBuffer);
      checks.conservation = conservation.matches;
      checks.mechanicsRefresh = mechanicsRefresh.matches;
    }
    plan = await spatial.prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction: args.transaction, generation: args.generation, lookupLevelAssignment: args.lookupLevelAssignment,
      nextParticleUploads: next, postMechanicsClosure: closure,
      conservativeTopologyAdvance: true, forcePositionAdvance: true,
      placementPositionEpochFloorReceipt: closure.reactionStep.reactionPlacementPositionEpochFloorReceipt,
      successorLevelAssignmentRunner: ({ sphParticleUpload, mlsMpmParticleUpload }) => runSchroederLevelAssignmentWebGpu({
        device, sphParticleUpload, mlsMpmParticleUpload,
        sphParticleState: args.sphParticleState, mlsMpmParticleState: args.mlsMpmParticleState,
        baseGridSpacingM: .5, minLevel: 0, maxLevel: 0, readbackMode: 'no-full-readback' }) });
    sealSchroederSpatialEpochTransactionReaders(args.transaction);
    sealSchroederSpatialEpochTransactionProposals(args.transaction);
    const commitReceipt = commitSchroederSpatialEpochTransaction(args.transaction, { nextParticleUploads: next });
    publication = spatial.publishPreparedSchroederSpatialSuccessorSourceFamily(plan, { commitReceipt });
    if (!publication.published) throw new Error(`Exact closure publication failed: ${publication.reason}`);
    checks.published = true;
    held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, device, { mlsMpmParticleUpload: next.mlsMpmParticleUpload });
    checks.adoptedMass = held.read.family === captured.carrierMassRead.family;
    checks.adoptedQuantities = held.quantities.quantityBuffer === exact.quantityBuffer;
    checks.publishedMass = publication.sourceFamily.exactMassInventory === held.read.family;
    await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: device.queue.onSubmittedWorkDone().then(() => true) });
    retired = true;
    checks.ownerSurvivesClosure = buffers.validateSphParticleExactMassRead(held, { device, sourceSphUpload: next.sphParticleUpload });
    if (read) {
      const after = await read(held.quantities.quantityBuffer);
      checks.quantitiesSurviveClosure = after.length === quantityWords.length && after.every((word, i) => word === quantityWords[i]);
      const history = await read(next.residentProductMass.productEventBuffer);
      checks.historySurvivesClosure = history.length === historyWords.length && history.every((word, i) => word === historyWords[i]);
      const mass = await read(held.read.buffer), n = held.read.format.wordCount, q = exact.quantityLayout.recordWords;
      checks.massMatchesQuantities = mass.slice(held.read.byteOffset / 4, (held.read.byteOffset + held.read.byteLength) / 4)
        .every((word, index) => word === after[Math.floor(index / n) * q + 16 + index % n]);
      await read(next.sphParticleUpload.stateBuffer); await read(next.sphParticleUpload.thermoBuffer);
      await read(next.mlsMpmParticleUpload.mechanicsBuffer);
      checks.physicalBuffersSurviveClosure = true;
    }
    const followingMechanics = options.advanceMechanics ? await inspectFollowingMechanics({ args, next, publication, read, advanceThermal: options.advanceThermal, advanceReaction: options.advanceReaction, traceReaction: options.traceReaction, advanceFullStep: options.advanceFullStep }) : null;
    if (followingMechanics) checks.followingMechanics = followingMechanics.matches;
    return { name: options.name, options, capturedClosure: true, pass: Object.values(checks).every(Boolean), checks,
      conservation, mechanicsRefresh, followingMechanics, receipt, residualRowCount, consecutiveStepsVerified: false };
  } catch (error) {
    console.error('exact-closure-failure', error.stack ?? String(error));
    throw error;
  } finally {
    if (held) await buffers.releaseSphParticleExactMassRead(held);
    if (publication?.published) await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(publication.sourceFamily, { device });
    else if (plan) spatial.abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(plan);
    if (closure && !retired) await retireMlsMpmPostMechanicsClosureOutputsAfter(closure,
      { after: device.queue.onSubmittedWorkDone().then(() => true), abandon: true });
    if (next) {
      buffers.destroySphGpuParticleBuffers(next.sphParticleUpload);
      buffers.destroyMlsMpmGpuParticleBuffers(next.mlsMpmParticleUpload);
    }
  }
}
