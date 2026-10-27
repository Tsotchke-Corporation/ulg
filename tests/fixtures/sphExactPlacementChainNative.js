import {
  createSchroederSpatialReactionProductPlacementAuthorityWebGpu as createAuthority,
  acquireSphReactionProductPlacementSegmentedArenaWebGpu as acquireArena,
  encodeSphReactionProductPlacementExactCompactionWebGpu as compact,
  encodeSphReactionProductPlacementSegmentedWebGpu as encode,
  sealSchroederSpatialReactionProductPlacementEncoding as seal,
  submitSchroederSpatialReactionProductPlacementWebGpu as submit,
  releaseSphReactionProductPlacementSegmentedArenaAfterQueue as releaseArena,
  prewarmSphReactionProductPlacementExactWebGpu as prewarm,
  discardSphReactionProductPlacementSegmentedArenaLease as discard,
  destroySphReactionProductPlacementSegmentedArenaWebGpu as destroyArena
} from '../../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import { sphReactionCanonicalSummaryPipelineDescriptors, runSphReactionSummaryWebGpu }
  from '../../src/runtime/sph/sphReactionGpuSummary.js';
import { createCachedExplicitComputePipeline, workerQueueSubmitBurstStats } from '../../src/runtime/webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as receiptIndex,
  SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS as transactionStatus }
  from '../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { createSphNativePassTrace, readSphNativeStorageWords, readSphNativeUniformWords } from './sphNativePassTrace.js';
import { inspectExactPlacementHandoff } from './sphExactPlacementHandoffNative.js';

// Native integration glue uses the original classifier/spare pipelines and
// genuine family. No CPU placement decisions or replacement shader programs.
export function prepareExactPlacementChain({ device, family, productTermCount, eventCapacity, diagnosticTrace = null, rebindChemistry = false, rebuildChemistryPipeline = false, cloneChemistryBindings = false, mapChemistryCompletion = false, chemistryDispatchCount = null }) {
  const authority = createAuthority({ device, placementSourceFamily: family,
    particleCount: family.particleCount, productEventCapacity: eventCapacity,
    sourceStateBuffer: family.transactionRollbackStateBuffer,
    sourceThermoBuffer: family.transactionRollbackThermoBuffer,
    sourceMechanicsBuffer: family.transactionRollbackMechanicsBuffer });
  const arenaLease = acquireArena({ device, authority, productTermCapacity: productTermCount });
  const make = (label, size) => tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 | 8 | 4 }), device);
  const productEventBuffer = make('native-exact-placement-events', eventCapacity * 128);
  const placementSummaryBuffer = make('native-exact-placement-summary', productTermCount * 128);
  const encoder = diagnosticTrace?.encoder ?? device.createCommandEncoder();
  const args = { device, authority, arenaLease, encoder, productEventBuffer, placementSummaryBuffer,
    nextStateBuffer: authority.placedDestinationStateBuffer,
    nextThermoBuffer: authority.placedDestinationThermoBuffer,
    nextMechanicsBuffer: authority.placedDestinationMechanicsBuffer };
  const b = arenaLease.arena.buffers, a = authority;
  let submitted = false;
  let submissionArtifact = null;
  let encoding;
  const cleanup = async () => {
    // A raw diagnostic submission never invents a production submission
    // capability or calls discard on a submitted encoder. Its dedicated
    // device is destroyed by the harness, invoking arena device-loss cleanup.
    if (!submitted) { discard(arenaLease, { device, authority }); destroyArena(arenaLease.arena); }
    else if (submissionArtifact) {
      await releaseArena(arenaLease, { device, authority, submissionArtifact });
      destroyArena(arenaLease.arena);
    }
    productEventBuffer.destroy(); placementSummaryBuffer.destroy();
  };
  try {
    compact(args);
    const descriptors = sphReactionCanonicalSummaryPipelineDescriptors({ directoryAbiVersion: a.directoryAbiVersion });
    const particleGroups = Math.max(1, Math.ceil(a.particleCount / 64));
    const eventGroups = Math.max(1, Math.ceil(eventCapacity / 64));
    const dispatch = (key, resources, count, indices = resources.map((_, i) => i)) => {
      const info = createCachedExplicitComputePipeline(device, descriptors[key]);
      const bindGroup = device.createBindGroup({ layout: info.bindGroupLayout,
        entries: resources.map((buffer, i) => ({ binding: indices[i], resource: { buffer } })) });
      const pass = encoder.beginComputePass(); pass.setPipeline(info.pipeline); pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(count); pass.end();
    };
    const envelope = [args.nextStateBuffer, args.nextThermoBuffer, a.directoryPositionAuthorityStateBuffer,
      b.placementParams, b.control, a.completionReceiptBuffer, b.envelopePartials];
    dispatch('placementEnvelopeReduce', envelope, particleGroups);
    dispatch('placementEnvelopeFinalize', envelope, 1);
    dispatch('placementClassification', [productEventBuffer, args.nextThermoBuffer, b.placementParams,
      b.compactCount, a.directoryBuffer, a.expectationBuffer, a.frozenSourceStateBuffer,
      b.decisions, b.control, a.completionReceiptBuffer], eventGroups, [0, 2, 3, 6, 7, 8, 9, 10, 11, 12]);
    dispatch('spareParticleMark', [args.nextStateBuffer, args.nextThermoBuffer, b.spareParticlePrefix,
      b.spareParticleGroupCount, b.placementParams, a.completionReceiptBuffer], particleGroups);
    dispatch('spareParticleScan', [b.spareParticleGroupCount, b.spareParticleGroupOffset,
      b.spareControl, b.spareParticleScanParams, a.completionReceiptBuffer], 1);
    dispatch('spareScatter', [b.spareParticlePrefix, b.spareParticleGroupOffset, b.spareSlots,
      b.placementParams, a.completionReceiptBuffer], particleGroups);
    dispatch('spareEventMark', [productEventBuffer, b.compactCount, b.decisions, b.spareEventPrefix,
      b.spareEventGroupCount, b.placementParams, a.completionReceiptBuffer], eventGroups);
    dispatch('spareEventScan', [b.spareEventGroupCount, b.spareEventGroupOffset,
      b.spareControl, b.spareEventScanParams, a.completionReceiptBuffer], 1);
    dispatch('spareAssign', [b.spareEventPrefix, b.spareEventGroupOffset, b.spareSlots,
      b.spareControl, b.decisions, b.placementParams, a.completionReceiptBuffer], eventGroups);
    return { args, cleanup, encode: () => (encoding = encode(args)), prewarm: () => prewarm({ device, authority }),
      seal: () => seal(authority, { segmentedEncoding: encoding }),
      submitOwned: () => {
        const sealed = seal(authority, { segmentedEncoding: encoding });
        submissionArtifact = submit({ authority, encoding: sealed });
        submitted = true;
        return submissionArtifact;
      },
      async submitDiagnostic(beforeSubmit) {
        const command = encoder.finish();
        await beforeSubmit?.();
        device.queue.submit([command]); submitted = true;
      },
      async submitPassTrace(onProgress, read) {
        if (!diagnosticTrace) throw new Error('Diagnostic pass tracing was not requested');
        let normalizationTraceIndex = 0;
        await diagnosticTrace.submit(device, onProgress, () => { submitted = true; }, async stage => {
          if (stage.label === 'normalize_exact_chemistry_residuals') {
            const preparation = encoding.exactChemistryPreparation;
            const original = preparation.steps.filter(step => step.descriptor.entryPoint === stage.label)[normalizationTraceIndex++];
            onProgress({ phase: 'diagnostic-chemistry-pending-rows', ...stage, layout: preparation.layout,
              params: Array.from(await readSphNativeUniformWords(device, original.entries[8].resource)),
              queueBurst: workerQueueSubmitBurstStats(device),
              queueOwnSubmit: Object.hasOwn(device.queue, 'submit'), queueOwnFence: Object.hasOwn(device.queue, 'onSubmittedWorkDone'),
              words: Array.from(await readSphNativeStorageWords(device, b.exactChemistryA)) });
            if (chemistryDispatchCount !== null) return {
              dispatch: [chemistryDispatchCount, 1, 1],
              afterPass: async () => {
                onProgress({ phase: 'diagnostic-limited-normalization-result', chemistryDispatchCount,
                  words: Array.from(await readSphNativeStorageWords(device, b.exactChemistryB)) });
                throw new Error('Limited-dispatch diagnostic completed; original transaction remains unverified');
              }
            };
            if (mapChemistryCompletion) return { completion: async () => {
              onProgress({ phase: 'diagnostic-normalization-readback-start' });
              onProgress({ phase: 'diagnostic-normalization-readback',
                words: Array.from(await readSphNativeStorageWords(device, b.exactChemistryB)) });
            } };
            if (rebindChemistry) {
              let layout = original.pipeline.bindGroupLayout, pipeline = null;
              if (rebuildChemistryPipeline) {
                layout = device.createBindGroupLayout({ entries: original.descriptor.bindings });
                pipeline = await device.createComputePipelineAsync({ label: 'diagnostic-recreated-normalization',
                  layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: {
                    module: device.createShaderModule({ code: original.descriptor.code }), entryPoint: original.descriptor.entryPoint } });
              }
              let entries = original.entries, afterPass;
              if (cloneChemistryBindings) {
                const clones = []; entries = [];
                for (const entry of original.entries) {
                  const resource = entry.resource, uniform = entry.binding === 8;
                  const words = uniform ? await readSphNativeUniformWords(device, resource)
                    : await readSphNativeStorageWords(device, resource.buffer);
                  const buffer = device.createBuffer({ label: `diagnostic-clone-${entry.binding}`,
                    size: resource.buffer.size, usage: resource.buffer.usage, mappedAtCreation: true });
                  new Uint32Array(buffer.getMappedRange()).set(words, uniform ? resource.offset / 4 : 0); buffer.unmap();
                  clones.push(buffer); entries.push({ binding: entry.binding, resource: { ...resource, buffer } });
                }
                onProgress({ phase: 'diagnostic-chemistry-bindings-cloned', count: clones.length });
                afterPass = async () => {
                  try {
                    onProgress({ phase: 'diagnostic-cloned-normalization-result',
                      words: Array.from(await readSphNativeStorageWords(device, clones[6])) });
                    throw new Error('Cloned-buffer diagnostic completed; original transaction remains unverified');
                  } finally { for (const buffer of clones) buffer.destroy(); }
                };
              }
              return { pipeline, afterPass, bindGroup: device.createBindGroup({ label: 'diagnostic-recreated-normalization',
                layout, entries }) };
            }
          }
          if (stage.label !== 'initialize_exact_chemistry_residuals') return;
          const preparation = encoding.exactChemistryPreparation;
          onProgress({ phase: 'diagnostic-chemistry-input', ...stage,
            layout: preparation.layout,
            stages: preparation.steps.slice(0, 3).map(value => ({
              entryPoint: value.descriptor.entryPoint, dispatch: value.dispatch,
              controlMatches: value.entries[4].resource.buffer === b.exactChemistryControl,
              bindings: value.entries.map(({ binding, resource }) => ({ binding,
                label: resource.buffer.label, offset: resource.offset, size: resource.size,
                bufferSize: resource.buffer.size, usage: resource.buffer.usage })) })),
            control: Array.from(await readSphNativeStorageWords(device, b.exactChemistryControl)),
            receipt: Array.from(await read(a.completionReceiptBuffer)) });
        });
      } };
  } catch (error) { cleanup(); throw error; }
}

export async function runExactPlacementChainNative({ device, family, productTermCount, eventCapacity, read,
  productionSummaryInputs = null,
  tracePasses = false, rebindChemistry = false, rebuildChemistryPipeline = false, cloneChemistryBindings = false, mapChemistryCompletion = false, chemistryDispatchCount = null, onProgress = () => {} }) {
  let chain, validationScopeOpen = false;
  const beginValidation = () => { device.pushErrorScope('validation'); validationScopeOpen = true; };
  const checkValidation = async stage => {
    validationScopeOpen = false;
    const error = await device.popErrorScope();
    if (error) throw new Error(`Exact placement ${stage} validation: ${error.message}`);
    onProgress({ phase: `placement-${stage}-validated` });
  };
  beginValidation();
  try {
    if (productionSummaryInputs) {
      const authority = createAuthority({ device, placementSourceFamily: family,
        particleCount: family.particleCount, productEventCapacity: eventCapacity,
        sourceStateBuffer: family.transactionRollbackStateBuffer,
        sourceThermoBuffer: family.transactionRollbackThermoBuffer,
        sourceMechanicsBuffer: family.transactionRollbackMechanicsBuffer });
      const summary = await runSphReactionSummaryWebGpu({ ...productionSummaryInputs, device,
        sourceStateBuffer: family.transactionRollbackStateBuffer,
        sourceThermoBuffer: family.transactionRollbackThermoBuffer,
        sourceMechanicsBuffer: family.transactionRollbackMechanicsBuffer,
        nextStateBuffer: family.placedDestinationStateBuffer,
        nextThermoBuffer: family.placedDestinationThermoBuffer,
        nextMechanicsBuffer: family.placedDestinationMechanicsBuffer,
        canonicalReactionProductPlacementAuthority: authority,
        retainProductEventBuffer: false, readProductEvents: false,
        readCompactSummary: false, readGasSpeciesSummary: false,
        readProductInventory: false, readAtomResidual: false, readProductPlacementSummary: false });
      await checkValidation('production-summary');
      const placementArtifact = summary.reactionProductPlacementSubmissionArtifact;
      const receiptWords = await read(authority.completionReceiptBuffer);
      const receipt = Object.fromEntries(Object.entries(receiptIndex).map(([key, index]) => [key, receiptWords[index]]));
      const result = { receipt, productionSummaryExecuted: true,
        placementSubmissionAuthenticated: placementArtifact.submissionAuthenticated, physicalPublicationAdmitted: false,
        transactionCommitted: receipt.transactionalTerminalStatus === transactionStatus.SAFE_PLACED,
        state: Array.from(await read(family.placedDestinationStateBuffer)),
        thermo: Array.from(await read(family.placedDestinationThermoBuffer)),
        mechanics: Array.from(await read(family.placedDestinationMechanicsBuffer)),
        quantities: Array.from(await read(family.placedDestinationQuantityBuffer)),
        massInventory: Array.from(await read(family.placedDestinationMassBuffer)),
        residualCount: Array.from(await read(family.placedDestinationResidualCountBuffer)),
        residualEvents: Array.from(await read(family.placedDestinationResidualEventBuffer)),
        residualCompanions: Array.from(await read(family.placedDestinationResidualCompanionBuffer)) };
      beginValidation();
      result.handoff = await inspectExactPlacementHandoff({ device, family, placementArtifact, read, selected: result });
      await checkValidation('handoff');
      return result;
    }
    chain = prepareExactPlacementChain({ device, family, productTermCount, eventCapacity,
      diagnosticTrace: tracePasses ? createSphNativePassTrace() : null, rebindChemistry, rebuildChemistryPipeline, cloneChemistryBindings, mapChemistryCompletion, chemistryDispatchCount });
    const prewarm = await chain.prewarm();
    onProgress({ phase: 'placement-prewarmed', ...prewarm });
    chain.encode();
    onProgress({ phase: 'placement-encoded' });
    if (tracePasses) {
      await checkValidation('trace-resources');
      await chain.submitPassTrace(onProgress, read);
      throw new Error('Diagnostic pass trace completed; original single-submission acceptance remains unverified');
    }
    await checkValidation('encoding'); beginValidation();
    const placementArtifact = chain.submitOwned();
    onProgress({ phase: 'placement-submitted' });
    await checkValidation('submission');
    const receiptWords = await read(chain.args.authority.completionReceiptBuffer);
    const receipt = Object.fromEntries(Object.entries(receiptIndex).map(([key, index]) => [key, receiptWords[index]]));
    onProgress({ phase: 'placement-receipt', receipt });
    const result = { receipt, prewarm, placementSubmissionAuthenticated: placementArtifact.submissionAuthenticated,
      physicalPublicationAdmitted: false,
      transactionCommitted: receipt.transactionalTerminalStatus === transactionStatus.SAFE_PLACED,
      state: Array.from(await read(family.placedDestinationStateBuffer)),
      thermo: Array.from(await read(family.placedDestinationThermoBuffer)),
      mechanics: Array.from(await read(family.placedDestinationMechanicsBuffer)),
      quantities: Array.from(await read(family.placedDestinationQuantityBuffer)),
      massInventory: Array.from(await read(family.placedDestinationMassBuffer)),
      residualCount: Array.from(await read(family.placedDestinationResidualCountBuffer)),
      residualEvents: Array.from(await read(family.placedDestinationResidualEventBuffer)),
      residualCompanions: Array.from(await read(family.placedDestinationResidualCompanionBuffer)) };
    beginValidation();
    result.handoff = await inspectExactPlacementHandoff({ device, family, placementArtifact, read, selected: result });
    await checkValidation('handoff');
    return result;
  } finally {
    if (validationScopeOpen) await device.popErrorScope().catch(() => {});
    await chain?.cleanup();
  }
}
