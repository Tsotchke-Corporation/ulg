import { sphExactPlacementQuantityLayout, encodeSphExactPlacementMolarMetadata,
  createSphExactPlacementQuantityWgsl } from './sphExactPlacementQuantityWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

/** Materialize the original, routed-current and compact residual quantities
 * inside the existing routing owner's lifetime. This is not a public source
 * registration. Only the original placement family may later authenticate and
 * consume the result; physical publication still requires its terminal tuple.
 */
export async function runSphExactPlacementQuantityCandidateWebGpu({ parent, physicalOutput,
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
  const descriptor = { label: 'ulg-exact-placement-quantity-materialization',
    cacheKey: `ulg-exact-placement-quantity-v1-${selected.format.wordCount}-${selected.format.quantumExponent}-${layout.scalar.wordCount}`,
    code: createSphExactPlacementQuantityWgsl(selected.format, layout),
    entryPoint: 'materialize_exact_placement_quantities',
    bindings: [...Array(7).fill('read-only-storage'), 'storage', 'uniform']
      .map((type, binding) => computeBufferBinding(binding, type)) };
  const pipeline = await prewarmCachedExplicitComputePipeline(device, descriptor);
  if (!pipeline.pipeline) throw pipeline.error ?? new Error('Exact current quantity materialization unavailable');
  validate();
  device.queue.writeBuffer(metadataBuffer, 0, molars); device.queue.writeBuffer(paramsBuffer, 0, params);
  const resources = [physicalOutput.sourcePackedBuffer, selected.outputBuffer, inventory.buffer,
    physicalOutput.auxiliaryBuffer, physicalOutput.compactCompanionBuffer, physicalOutput.compactCountBuffer,
    metadataBuffer, outputBuffer, paramsBuffer];
  const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
    entries: resources.map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const encoder = device.createCommandEncoder(); encoder.clearBuffer(outputBuffer);
  const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
  pass.dispatchWorkgroups(layout.rowCount); pass.end();
  const command = encoder.finish(); validate(); markSubmitted(); device.queue.submit([command]);
  return Object.freeze({ schema: 'peercompute.ulg.exact-placement-quantity-candidate.v1',
    outputBuffer, layout, physicalPublicationAdmitted: false });
}
