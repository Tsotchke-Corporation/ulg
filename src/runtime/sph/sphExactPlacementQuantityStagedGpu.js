import { sphExactPlacementQuantityLayout, encodeSphExactPlacementMolarMetadata }
  from './sphExactPlacementQuantityWgsl.js';
import { sphExactPlacementQuantityStagedPipelineDescriptors }
  from './sphExactPlacementQuantityStagedWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

/** Alternative numeric schedule inside the SAME existing routing owner.
 * Allocation, derived-buffer tracking, source holds, admission/revalidation,
 * queue submission and retirement belong to that original owner. This helper
 * does not register sources or grant physical publication; the original
 * monolithic producer remains available unchanged for comparison. */
export async function runSphExactPlacementQuantityStagedCandidateWebGpu({ parent, physicalOutput,
  allocate, validate, markSubmitted }) {
  validate();
  const { result: selected, source, compiled, reactionTable, thermalMaterialTable } = parent.view;
  if (source.quantities) throw new TypeError('Carried quantities require the production primitive schedule');
  const { device, inventory, particleCount } = source;
  const layout = sphExactPlacementQuantityLayout(selected.format,
    { particleCount, eventCapacity: physicalOutput.denseEventCount });
  if (layout.rowCount > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Exact current quantity arena exceeds dispatch capacity');
  }
  const molars = encodeSphExactPlacementMolarMetadata(compiled, { reactionTable, thermalMaterialTable });
  const outputBuffer = allocate('ulg-exact-placement-quantities', layout.wordLength * 4, 128 | 8 | 4);
  parent.markDerivedBuffers([outputBuffer]);
  const metadataBuffer = allocate('ulg-exact-placement-molar-identities', molars.byteLength, 128 | 8);
  const params = new Uint32Array([particleCount, layout.eventCapacity, selected.recordWords,
    inventory.rowOffset * selected.format.wordCount,
    physicalOutput.layout.carrierOffsetWords, physicalOutput.layout.carrierStrideWords,
    physicalOutput.eventCompanionStrideWords, molars.length / 2,
    selected.extensiveOffsetWords, selected.caloricOffsetWords, selected.caloricProductOffsetWords,
    selected.caloricProductCapacity, selected.productEnergyOffsetWords, selected.speciesOffsetWords,
    selected.speciesLayout.termOffsetWords, selected.speciesLayout.termStrideWords]);
  const paramsBuffer = allocate('ulg-exact-placement-quantity-params', params.byteLength, 64 | 8);
  const stages = sphExactPlacementQuantityStagedPipelineDescriptors(selected.format, layout);
  const pipelines = [];
  // Deliberately serial. Each await keeps the original owner hold and is
  // followed by original source/table validation before progressing.
  for (const stage of stages) {
    validate();
    const descriptor = { label: stage.label, cacheKey: stage.cacheKey, code: stage.code,
      entryPoint: stage.entryPoint,
      bindings: stage.bindings.map((type, binding) => computeBufferBinding(binding, type)) };
    const pipeline = await prewarmCachedExplicitComputePipeline(device, descriptor);
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact current quantity ${stage.stage} unavailable`);
    validate(); pipelines.push(pipeline);
  }
  validate();
  device.queue.writeBuffer(metadataBuffer, 0, molars); device.queue.writeBuffer(paramsBuffer, 0, params);
  const resources = [physicalOutput.sourcePackedBuffer, selected.outputBuffer, inventory.buffer,
    physicalOutput.auxiliaryBuffer, physicalOutput.compactCompanionBuffer, physicalOutput.compactCountBuffer,
    metadataBuffer, outputBuffer, paramsBuffer];
  const groups = pipelines.map(pipeline => device.createBindGroup({ layout: pipeline.bindGroupLayout,
    entries: resources.map((buffer, binding) => ({ binding, resource: { buffer } })) }));
  const encoder = device.createCommandEncoder(); encoder.clearBuffer(outputBuffer);
  const pass = encoder.beginComputePass();
  for (let i = 0; i < pipelines.length; i++) {
    pass.setPipeline(pipelines[i].pipeline); pass.setBindGroup(0, groups[i]);
    pass.dispatchWorkgroups(layout.rowCount);
  }
  pass.end();
  const command = encoder.finish(); validate(); markSubmitted(); device.queue.submit([command]);
  return Object.freeze({ schema: 'peercompute.ulg.exact-placement-quantity-candidate.v1',
    outputBuffer, layout, physicalPublicationAdmitted: false });
}
