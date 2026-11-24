import { sphExactPlacementQuantityLayout, encodeSphExactPlacementMolarMetadata }
  from './sphExactPlacementQuantityWgsl.js';
import { sphExactPlacementQuantityPrimitivesPipelineDescriptors, sphExactPlacementQuantityPrimitivesScratchLayout,
  sphExactPlacementQuantityPrimitivesStageParams } from './sphExactPlacementQuantityPrimitivesWgsl.js';
import { computeBufferBinding, createCachedExplicitBindGroup, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

/** Alternative numeric schedule inside the SAME existing routing owner.
 * Allocation, derived-buffer tracking, source holds, admission/revalidation,
 * queue submission and retirement belong to that original owner. This helper
 * does not register sources or grant physical publication; the original
 * monolithic producer remains available unchanged for comparison. */
export async function runSphExactPlacementQuantityPrimitivesCandidateWebGpu({ parent, physicalOutput,
  allocate, validate, markSubmitted }) {
  validate();
  const { result: selected, source, compiled, reactionTable, thermalMaterialTable } = parent.view;
  const { device, inventory, particleCount } = source;
  const carriedSourceLayout = source.quantities?.quantityLayout ?? null;
  if ((selected.extensiveEncoding === 'rational') !== !!carriedSourceLayout) {
    throw new TypeError('Carried packet and genuine source quantities must agree');
  }
  const layout = sphExactPlacementQuantityLayout(selected.format,
    { particleCount, eventCapacity: physicalOutput.denseEventCount,
      ...(carriedSourceLayout ? { rationalWordCount: carriedSourceLayout.scalar.wordCount } : {}) });
  if (layout.rowCount > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Exact current quantity arena exceeds dispatch capacity');
  }
  const scratchLayout = sphExactPlacementQuantityPrimitivesScratchLayout(selected.format, layout);
  const stageParams = sphExactPlacementQuantityPrimitivesStageParams(scratchLayout, device.limits.minUniformBufferOffsetAlignment);
  if (!['maxStorageBuffersPerShaderStage', 'maxUniformBuffersPerShaderStage', 'maxBindingsPerBindGroup',
    'maxUniformBufferBindingSize', 'maxStorageBufferBindingSize', 'maxBufferSize', 'maxComputeWorkgroupsPerDimension']
      .every(key => Number.isSafeInteger(device.limits[key]) && device.limits[key] > 0)
      || device.limits.maxStorageBuffersPerShaderStage < (carriedSourceLayout ? 10 : 9) || device.limits.maxUniformBuffersPerShaderStage < 2
      || device.limits.maxBindingsPerBindGroup < (carriedSourceLayout ? 12 : 11) || device.limits.maxUniformBufferBindingSize < 64
      || stageParams.byteLength > device.limits.maxUniformBufferBindingSize
      || !Number.isSafeInteger(device.limits.maxStorageBufferBindingSize) || !Number.isSafeInteger(device.limits.maxBufferSize)
      || Math.max(layout.wordLength, scratchLayout.wordLength) * 4 > device.limits.maxStorageBufferBindingSize
      || Math.max(layout.wordLength * 4, scratchLayout.wordLength * 4, stageParams.byteLength) > device.limits.maxBufferSize) {
    throw new RangeError('Exact primitive scratch exceeds original device capacity');
  }
  const molars = encodeSphExactPlacementMolarMetadata(compiled, { reactionTable, thermalMaterialTable });
  if (molars.byteLength > device.limits.maxStorageBufferBindingSize || molars.byteLength > device.limits.maxBufferSize) {
    throw new RangeError('Original molar metadata exceeds device capacity');
  }
  const outputBuffer = allocate('ulg-exact-placement-quantities', layout.wordLength * 4, 128 | 8 | 4);
  parent.markDerivedBuffers([outputBuffer]);
  const scratchBuffer = allocate('ulg-exact-placement-primitives-scratch', scratchLayout.wordLength * 4, 128 | 8 | 4);
  parent.markDerivedBuffers([scratchBuffer]);
  const stageParamsBuffer = allocate('ulg-exact-placement-primitives-steps', stageParams.byteLength, 64 | 8);
  const metadataBuffer = allocate('ulg-exact-placement-molar-identities', molars.byteLength, 128 | 8);
  const params = new Uint32Array([particleCount, layout.eventCapacity, selected.recordWords,
    inventory.rowOffset * selected.format.wordCount,
    physicalOutput.layout.carrierOffsetWords, physicalOutput.layout.carrierStrideWords,
    physicalOutput.eventCompanionStrideWords, molars.length / 2,
    selected.extensiveOffsetWords, selected.caloricOffsetWords, selected.caloricProductOffsetWords,
    selected.caloricProductCapacity, selected.productEnergyOffsetWords, selected.speciesOffsetWords,
    selected.speciesLayout.termOffsetWords, selected.speciesLayout.termStrideWords]);
  const paramsBuffer = allocate('ulg-exact-placement-quantity-params', params.byteLength, 64 | 8);
  const stages = sphExactPlacementQuantityPrimitivesPipelineDescriptors(selected.format, layout, { carriedSourceLayout });
  const pipelines = [];
  // Deliberately serial. Each await keeps the original owner hold and is
  // followed by original source/table validation before progressing.
  for (const stage of stages) {
    validate();
    const descriptor = { label: stage.label, cacheKey: stage.cacheKey, code: stage.code,
      entryPoint: stage.entryPoint,
      bindings: [...stage.bindings.map((type, binding) => computeBufferBinding(binding, type)),
        ...(stage.carriedBinding ? [computeBufferBinding(11, 'read-only-storage')] : [])] };
    const pipeline = await prewarmCachedExplicitComputePipeline(device, descriptor);
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact current quantity ${stage.stage} unavailable`);
    validate(); pipelines.push(pipeline);
  }
  validate();
  device.queue.writeBuffer(metadataBuffer, 0, molars); device.queue.writeBuffer(paramsBuffer, 0, params);
  device.queue.writeBuffer(stageParamsBuffer, 0, stageParams.words);
  const resources = [physicalOutput.sourcePackedBuffer, selected.outputBuffer, inventory.buffer,
    physicalOutput.auxiliaryBuffer, physicalOutput.compactCompanionBuffer, physicalOutput.compactCountBuffer,
    metadataBuffer, outputBuffer, paramsBuffer];
  const groups = pipelines.map((pipeline, index) => {
    const entries = resources.map((buffer, binding) => ({ binding, resource: { buffer } }));
    if (stages[index].stage === 'primitive') entries.push(
      { binding: 9, resource: { buffer: scratchBuffer } },
      { binding: 10, resource: { buffer: stageParamsBuffer, offset: stages[index].index * stageParams.strideBytes, size: 16 } });
    if (carriedSourceLayout && (stages[index].stage === 'primitive' || stages[index].carriedBinding)) {
      entries.push({ binding: 11, resource: { buffer: source.quantities.quantityBuffer } });
    }
    return (typeof globalThis.GPUDevice === 'function' && device instanceof globalThis.GPUDevice)
      ? createCachedExplicitBindGroup(device, { layout: pipeline.bindGroupLayout, entries })
      : device.createBindGroup({ layout: pipeline.bindGroupLayout, entries });
  });
  const encoder = device.createCommandEncoder(); encoder.clearBuffer(outputBuffer); encoder.clearBuffer(scratchBuffer);
  const pass = encoder.beginComputePass();
  for (let i = 0; i < pipelines.length; i++) {
    pass.setPipeline(pipelines[i].pipeline); pass.setBindGroup(0, groups[i]);
    pass.dispatchWorkgroups(Math.ceil(layout.rowCount / (stages[i].workgroupSize ?? 1)));
  }
  pass.end();
  const command = encoder.finish(); validate(); markSubmitted(); device.queue.submit([command]);
  return Object.freeze({ schema: 'peercompute.ulg.exact-placement-quantity-candidate.v1',
    outputBuffer, layout, physicalPublicationAdmitted: false });
}
