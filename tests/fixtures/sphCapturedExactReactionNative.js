import { runSphExactReactionSourceSelectionWebGpu, resolveSphExactReactionSourceSelection } from '../../src/runtime/sph/sphExactReactionSourceGpu.js';
import { runSphReactionStepWebGpu, resolveSphReactionSourceCapture } from '../../src/runtime/sph/sphReactionGpuKernel.js';
import { mergeResidentProductMassBuffersWebGpu, resolveResidentProductMassMergeSourceCapture }
  from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { resolveResidentProductEventCountAuthority } from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as receiptIndex }
  from '../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { inspectExactPlacementConservation, inspectExactMechanicsRefresh, inspectExactPlacementQuantities, inspectExactResidualPhysical } from './sphExactPlacementQuantityInspection.js';
import { runMlsMpmMechanicsRefreshWebGpu, resolveMlsMpmMechanicsRefreshSourceCapture }
  from '../../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import { createSphNativePassTrace } from './sphNativePassTrace.js';

async function tracedRefresh(args) {
  const { device } = args, trace = createSphNativePassTrace();
  const original = { createCommandEncoder: device.createCommandEncoder, submit: device.queue.submit,
    onSubmittedWorkDone: device.queue.onSubmittedWorkDone };
  const native = { createCommandEncoder: original.createCommandEncoder.bind(device),
    pushErrorScope: device.pushErrorScope.bind(device), popErrorScope: device.popErrorScope.bind(device),
    queue: { submit: original.submit.bind(device.queue), onSubmittedWorkDone: original.onSubmittedWorkDone.bind(device.queue) } };
  let completion;
  device.createCommandEncoder = () => ({ ...trace.encoder, finish() { return trace; } });
  device.queue.submit = commands => {
    if (commands.length !== 1 || commands[0] !== trace || completion) throw new Error('Unexpected diagnostic refresh submission');
    device.createCommandEncoder = original.createCommandEncoder;
    device.queue.submit = original.submit;
    completion = trace.submit(native, detail => console.log('exact-routing-progress', JSON.stringify(detail)), () => {});
    void completion.catch(() => {});
  };
  device.queue.onSubmittedWorkDone = () => completion ?? Promise.reject(new Error('Refresh trace has not submitted'));
  try {
    const result = await runMlsMpmMechanicsRefreshWebGpu({ ...args, queueOrderedProducerClaims: [] });
    await completion;
    return result;
  } finally {
    device.createCommandEncoder = original.createCommandEncoder;
    device.queue.submit = original.submit;
    device.queue.onSubmittedWorkDone = original.onSubmittedWorkDone;
  }
}

async function inspectRefreshRollback({ args, step, token, read, before, layout }) {
  const records = args.mechanicsMaterialTable.records.slice();
  for (let row = 0; row < args.mechanicsMaterialTable.phaseRecordCount; row++) {
    records[row * args.mechanicsMaterialTable.recordStrideFloats + 9] = 255;
  }
  const captureToken = {};
  let output, capture;
  try {
    output = await runMlsMpmMechanicsRefreshWebGpu({ ...args,
      mechanicsMaterialTable: { ...args.mechanicsMaterialTable, records },
      sourceStateBuffer: step.stateBuffer, sourceThermoBuffer: step.thermoBuffer, sourceMechanicsBuffer: step.mechanicsBuffer,
      exactReactionResult: step, exactReactionSourceCapture: token, postMechanicsSourceCapture: captureToken,
      retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' });
    capture = resolveMlsMpmMechanicsRefreshSourceCapture(output, captureToken);
    const quantities = await read(capture.exactMechanics.quantityBuffer);
    const mechanics = await read(output.mechanicsBuffer), original = await read(step.mechanicsBuffer);
    return quantities.length === args.sphParticleState.particleCount * layout.recordWords
      && quantities.every((word, i) => word === before[i])
      && mechanics.length === original.length && mechanics.every((word, i) => word === original[i]);
  } finally { capture?.release(); output?.destroyOutputParticleBuffers(); }
}

export async function inspectCapturedExactReactionNative({ args, read, options, inspectSelection = null }) {
  const { device } = args, token = {};
  const selected = await runSphExactReactionSourceSelectionWebGpu(args);
  const issued = resolveSphExactReactionSourceSelection(selected, { device });
  let sourceInspection;
  try {
    sourceInspection = await inspectSelection?.(selected);
    if (sourceInspection) {
      await globalThis.recordExactPlacementProgress?.({ phase: 'carried-reaction-selection', result: sourceInspection });
      if (!sourceInspection.matches) throw new Error(`Carried source arithmetic failed: ${JSON.stringify(sourceInspection)}`);
    }
  }
  catch (error) { await selected.release(); throw error; }
  const run = () => runSphReactionStepWebGpu({ ...args, postMechanicsSourceCapture: token,
    sourceStateBuffer: args.thermalResult.stateBuffer, sourceThermoBuffer: args.thermalResult.thermoBuffer,
    sourceMechanicsBuffer: args.g2pResult.mechanicsBuffer,
    schroederSpatialEpochGeneration: args.generation,
    schroederSpatialReactionDiscoveryProposal: args.reactionDiscoveryProposal,
    exactReactionSourceSelection: selected, retainOutputParticleBuffers: true,
    requestQueueOrderedCleanupClaim: true, readbackMode: 'no-full-readback' });
  const pending = options.traceReaction
    ? (await import('./sphNativePassTrace.js')).withSphNativeSubmissionTrace(device, run) : run();
  const sourceClosing = selected.release();
  let step, seal, mergeCapture, refresh, refreshSeal;
  try {
    step = await pending;
    seal = resolveSphReactionSourceCapture(step, token);
    const exact = seal.exactReaction, placement = exact.destinationRead;
    const routing = exact.routingView(), physical = routing.result.physicalOutput, source = routing.source.source;
    const before = await read(physical.quantities.outputBuffer), after = await read(placement.quantityBuffer);
    const candidateQuantities = inspectExactPlacementQuantities({ selected, layout: physical.quantities.layout,
      quantityWords: before, sourceWords: await read(selected.outputBuffer),
      sourcePackedWords: await read(physical.sourcePackedBuffer), originalInventoryWords: await read(source.inventory.buffer),
      inventoryRowOffset: source.inventory.rowOffset, auxiliaryWords: await read(physical.auxiliaryBuffer),
      outputLayout: physical.layout, compactCompanionWords: await read(physical.compactCompanionBuffer),
      compactCountWords: await read(physical.compactCountBuffer), compiled: issued.compiled,
      carriedSourceWords: source.quantities ? await read(source.quantities.quantityBuffer) : null,
      carriedSourceLayout: source.quantities?.quantityLayout ?? null });
    const residualCount = await read(placement.residualCountBuffer), companions = await read(placement.residualCompanionBuffer);
    const conservation = inspectExactPlacementConservation({ beforeWords: before, beforeLayout: physical.quantities.layout,
      afterWords: after, afterLayout: placement.quantityLayout, residualCount, residualCompanions: companions,
      companionStrideWords: placement.residualLayout.companionStrideWords,
      terminalStatus: (await read(exact.placementArtifact.completionReceiptBuffer))[receiptIndex.transactionalTerminalStatus] });
    const receiptWords = await read(exact.placementArtifact.completionReceiptBuffer);
    const receipt = Object.fromEntries(Object.entries(receiptIndex).map(([key, index]) => [key, receiptWords[index]]));
    if (sourceInspection) {
      const quantityLayout = physical.quantities.layout;
      const changed = Array.from({ length: args.sphParticleState.particleCount }, (_, row) => row).some(row => {
        const original = (quantityLayout.originalRowOffset + row) * quantityLayout.recordWords + quantityLayout.massOffsetWords;
        const current = (quantityLayout.currentRowOffset + row) * quantityLayout.recordWords + quantityLayout.massOffsetWords;
        return before.slice(original, original + selected.format.wordCount).some((word, i) => word !== before[current + i]);
      });
      sourceInspection.carrierMassChanged = changed;
      sourceInspection.activeProductEvents = receipt.activeEventCount;
      sourceInspection.matches &&= changed && receipt.activeEventCount > 0;
    }
    const carrier = exact.carrierMassRead, massWords = await read(carrier.buffer);
    const n = carrier.format.wordCount, q = placement.quantityLayout.recordWords;
    const carrierMassPreserved = massWords.slice(carrier.byteOffset / 4, (carrier.byteOffset + carrier.byteLength) / 4)
      .every((word, index) => word === after[Math.floor(index / n) * q + 16 + index % n]);
    const history = step.residentProductMass, packed = await read(history.productEventBuffer);
    const layout = history.exactProductHistoryLayout, count = residualCount[0];
    const expected = new Uint32Array(packed.length), events = await read(placement.residualEventBuffer);
    const physicalWords = await read(placement.residualPhysicalBuffer);
    const residualPhysical = inspectExactResidualPhysical({ physical: physicalWords,
      templates: await read(physical.auxiliaryBuffer), outputLayout: physical.layout,
      events, companions, companionStrideWords: placement.residualLayout.companionStrideWords,
      count: residualCount, terminalStatus: receipt.transactionalTerminalStatus });
    for (let row = 0; row < count; row++) {
      const at = row * layout.rowWords;
      expected.set(events.slice(row * 32, (row + 1) * 32), at);
      expected.set(companions.slice(row * layout.companionWords, (row + 1) * layout.companionWords), at + layout.companionOffsetWords);
      expected.set(after.slice((placement.particleCount + row) * q, (placement.particleCount + row + 1) * q), at + layout.quantityOffsetWords);
      expected.set(physicalWords.slice(row * 52, (row + 1) * 52), at + layout.physicalOffsetWords);
    }
    const mechanicsRefreshRollback = await inspectRefreshRollback({ args, step, token, read, before: after,
      layout: placement.quantityLayout });
    const refreshToken = {};
    refresh = await (options.traceMechanicsRefresh ? tracedRefresh : runMlsMpmMechanicsRefreshWebGpu)({ ...args,
      sourceStateBuffer: step.stateBuffer, sourceThermoBuffer: step.thermoBuffer, sourceMechanicsBuffer: step.mechanicsBuffer,
      exactReactionResult: step, exactReactionSourceCapture: token, postMechanicsSourceCapture: refreshToken,
      retainOutputParticleBuffers: true, readbackMode: 'no-full-readback',
      queueOrderedProducerClaims: step.queueOrderedCleanupClaims });
    refreshSeal = resolveMlsMpmMechanicsRefreshSourceCapture(refresh, refreshToken);
    console.log('exact-routing-progress', JSON.stringify({ phase: 'captured-mechanics-refresh-submitted' }));
    const refreshed = await read(refreshSeal.exactMechanics.quantityBuffer);
    console.log('exact-routing-progress', JSON.stringify({ phase: 'captured-mechanics-refresh-read-complete' }));
    const mechanicsRefresh = inspectExactMechanicsRefresh({ before: after, after: refreshed,
      thermo: await read(step.thermoBuffer), mechanics: await read(refresh.mechanicsBuffer),
      layout: refreshSeal.exactMechanics.quantityLayout, format: placement.format });
    refreshSeal.release();
    const mergeToken = {};
    const merging = mergeResidentProductMassBuffersWebGpu({ device,
      emittedResidentProductMass: history, postMechanicsSourceCapture: mergeToken });
    seal.release();
    const closingStep = step.destroyOutputParticleBuffers({ preserveResidentProductMass: true,
      queueOrderedFinalConsumer: refresh.queueOrderedFinalConsumerCapability ?? null });
    const closingHistory = history.destroyResidentProductMassBuffers();
    const merged = await merging;
    mergeCapture = resolveResidentProductMassMergeSourceCapture(merged, mergeToken);
    await Promise.all([closingStep, closingHistory, sourceClosing]);
    const authority = resolveResidentProductEventCountAuthority(merged, device);
    const control = (await read(authority.controlBuffer)).slice(authority.controlOffsetBytes / 4);
    const rows = await read(merged.productEventBuffer);
    const equal = (a,b) => a.length === b.length && a.every((word,i) => word === b[i]);
    const checks = { exactMechanicsRefresh: mechanicsRefresh.matches, mechanicsRefreshRollback,
      refreshedQuantitiesSurviveReactionRetirement: equal(refreshed, await read(refreshSeal.exactMechanics.quantityBuffer)),
      carrierRangeExcludesResiduals: carrier.rowOffset === 0 && carrier.rowCount === placement.particleCount,
      carrierMassPreserved, residualPhysical: residualPhysical.matches, completeResidualRecords: equal(packed, expected),
      mergedResidualRecords: equal(rows.slice(0, count * layout.rowWords), expected.slice(0, count * layout.rowWords)),
      mergedCountReady: control[2] === 1 && control[3] === count && control[11] === 0,
      mergedTailClear: rows.slice(count * layout.rowWords).every(word => word === 0),
      originalSubmission: exact.placementArtifact.submissionAuthenticated === true,
      originalCapturedStep: step.reactionAllocationMode === 'exact-integer-pair-allocation' };
    return { name: options.name, options, capturedProductionStep: true,
      physicalPublicationAdmitted: false, diagnosticReplay: !!options.traceReaction,
      conservation, candidateQuantities, residualPhysical, mechanicsRefresh, receipt, residualRowCount: count, checks, sourceInspection,
      pass: conservation.matches && candidateQuantities.matches && (sourceInspection?.matches ?? true) && Object.values(checks).every(Boolean) };
  } catch (error) {
    console.log('exact-routing-progress', JSON.stringify({ phase: 'captured-refresh-or-inspection-failure',
      failure: error?.stack ?? String(error) }));
    await error.exactMechanicsRefreshCleanupCompletion;
    throw error;
  } finally {
    refreshSeal?.release(); refresh?.destroyOutputParticleBuffers();
    seal?.release(); mergeCapture?.release(); await mergeCapture?.retireOwnedOutput();
    if (step) await step.destroyOutputParticleBuffers({
      queueOrderedFinalConsumer: refresh?.queueOrderedFinalConsumerCapability ?? null });
    await sourceClosing;
  }
}
