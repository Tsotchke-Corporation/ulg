import { createSphExactReactionOutputWgsl, sphExactReactionOutputLayout,
  encodeSphExactReactionOutputMetadata, createSphExactReactionOutputParams }
  from './sphExactReactionOutputWgsl.js';
import { createSphReactionProductEventCompactWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline }
  from '../webgpuComputeLayout.js';

const SCHEMA = 'peercompute.ulg.exact-reaction-physical-output-candidate.v1';

// Copy raw words. In particular a representable subnormal view is not passed
// through a floating-point arithmetic instruction merely to pack its lanes.
function physicalCopyWgsl(unpack) {
  return /* wgsl */ `
struct CopyParams { count: u32, unused0: u32, unused1: u32, unused2: u32 }
@group(0) @binding(0) var<storage, read> a: array<u32>;
@group(0) @binding(1) var<storage, ${unpack ? 'read_write' : 'read'}> b: array<u32>;
@group(0) @binding(2) var<storage, ${unpack ? 'read_write' : 'read'}> c: array<u32>;
@group(0) @binding(3) var<storage, read_write> d: array<u32>;
@group(0) @binding(4) var<uniform> params: CopyParams;
@compute @workgroup_size(64)
fn ${unpack ? 'unpack' : 'pack'}_exact_reaction_physical_rows(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.count) { return; }
  let row = id.x;
  ${unpack ? `
  for (var i = 0u; i < 8u; i++) { b[row * 8u + i] = a[row * 52u + i]; }
  for (var i = 0u; i < 12u; i++) { c[row * 12u + i] = a[row * 52u + 8u + i]; }
  for (var i = 0u; i < 32u; i++) { d[row * 32u + i] = a[row * 52u + 20u + i]; }
  ` : `
  for (var i = 0u; i < 8u; i++) { d[row * 52u + i] = a[row * 8u + i]; }
  for (var i = 0u; i < 12u; i++) { d[row * 52u + 8u + i] = b[row * 12u + i]; }
  for (var i = 0u; i < 32u; i++) { d[row * 52u + 20u + i] = c[row * 32u + i]; }
  `}
}
`;
}

/** Encode the real reaction branch's speculative physical rows and stable
 * event companions. Allocation and lifetime belong to its retained routing
 * owner. These buffers are not a stage seal, placement receipt or spendable
 * continuation: terminal placement must later select the entire tuple.
 */
export async function runSphExactReactionOutputCandidateWebGpu({
  parent, routingBuffer, routingLayout, allocate, validate, markSubmitted
}) {
  validate();
  const { result: selected, source, compiled, reactionTable, thermalMaterialTable } = parent.view;
  const { device, particleCount, inventory } = source;
  const format = selected.format;
  const layout = sphExactReactionOutputLayout(format, {
    particleCount, productCapacity: selected.caloricProductCapacity
  });
  const metadata = encodeSphExactReactionOutputMetadata(compiled, { reactionTable, thermalMaterialTable });
  const params = createSphExactReactionOutputParams({ selected, routingLayout, layout,
    inventoryRowOffset: inventory.rowOffset, metadata });
  const groupCount = Math.ceil(layout.denseEventCount / 64);
  if (!Number.isSafeInteger(layout.denseEventCount) || layout.denseEventCount < 1
      || layout.denseEventCount > 0x7fffffff
      || groupCount > device.limits.maxComputeWorkgroupsPerDimension
      || device.limits.maxStorageBuffersPerShaderStage < 9) {
    throw new RangeError('Exact reaction output and companion compaction exceed device capacity');
  }
  const prefix = 'ulg-exact-reaction-output-';
  const storage = (name, words) => allocate(prefix + name, words * 4, 128 | 8 | 4);
  const uniform = (name, bytes) => allocate(prefix + name, bytes, 64 | 8);
  const sourcePackedBuffer = storage('source-packed', particleCount * 52);
  const packedBuffer = storage('packed', particleCount * 52);
  const stateBuffer = storage('state', particleCount * 8);
  const thermoBuffer = storage('thermo', particleCount * 12);
  const mechanicsBuffer = storage('mechanics', particleCount * 32);
  const eventBuffer = storage('events', layout.denseEventCount * 32);
  const auxiliaryBuffer = storage('auxiliary', layout.auxWords);
  const metadataBuffer = storage('metadata', metadata.words.length);
  const paramsBuffer = uniform('params', params.byteLength);
  const copyParamsBuffer = uniform('copy-params', 16);
  const compactParamsBuffer = uniform('compact-params', 16);
  const compactEventBuffer = storage('compact-events', layout.denseEventCount * 32);
  const compactCompanionBuffer = storage('compact-companions', layout.denseEventCount * layout.eventCompanionStrideWords);
  const compactCountBuffer = storage('compact-count', 2);
  const compactReceiptBuffer = storage('compact-receipt', SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES / 4);
  const compactPrefixBuffer = storage('compact-prefix', layout.denseEventCount);
  const compactGroupCountBuffer = storage('compact-group-count', groupCount);
  const compactGroupOffsetBuffer = storage('compact-group-offset', groupCount);
  // Deny-only taint follows the actual GPU buffers, including aliases that
  // omit exact-inventory fields. It is not a physical continuation owner.
  parent.markDerivedBuffers([stateBuffer, thermoBuffer, sourcePackedBuffer, packedBuffer, eventBuffer, compactEventBuffer],
    { mechanicsBuffers: [mechanicsBuffer] });
  const companionOffset = layout.eventCompanionOffsetWords * 4;
  if (companionOffset % (device.limits.minStorageBufferOffsetAlignment ?? 256) !== 0) {
    throw new RangeError('Exact event companion subrange is not aligned for this device');
  }
  const sourceCompanions = { buffer: auxiliaryBuffer, offset: companionOffset,
    size: layout.denseEventCount * layout.eventCompanionStrideWords * 4 };
  const descriptor = (entryPoint, code, types) => ({ label: prefix + entryPoint,
    cacheKey: `${SCHEMA}-${format.wordCount}-${format.quantumExponent}-${entryPoint}`,
    code, entryPoint, bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
  const copyTypes = unpack => ['read-only-storage', unpack ? 'storage' : 'read-only-storage',
    unpack ? 'storage' : 'read-only-storage', 'storage', 'uniform'];
  const outputTypes = [...Array(5).fill('read-only-storage'), ...Array(3).fill('storage'), 'uniform'];
  const compactTypes = ['read-only-storage', 'storage', 'storage', 'uniform',
    'storage', 'storage', 'storage', 'storage', 'read-only-storage', 'storage'];
  const outputCode = createSphExactReactionOutputWgsl(format);
  const compactCode = createSphReactionProductEventCompactWgsl({ exactCompanion: { massWordCount: format.wordCount } });
  const specifications = [
    descriptor('pack_exact_reaction_physical_rows', physicalCopyWgsl(false), copyTypes(false)),
    descriptor('initialize_exact_reaction_outputs', outputCode, outputTypes),
    descriptor('stage_exact_reaction_outputs', outputCode, outputTypes),
    descriptor('unpack_exact_reaction_physical_rows', physicalCopyWgsl(true), copyTypes(true)),
    ...['count_placement_rows', 'scan_placement_row_groups', 'scatter_placement_rows']
      .map(entry => descriptor(entry, compactCode, compactTypes))
  ];
  const pipelines = await Promise.all(specifications.map(spec => prewarmCachedExplicitComputePipeline(device, spec)));
  for (const pipeline of pipelines) {
    if (!pipeline.pipeline) throw pipeline.error ?? new Error('Exact reaction output pipeline unavailable');
  }
  validate();
  device.queue.writeBuffer(metadataBuffer, 0, metadata.words);
  device.queue.writeBuffer(paramsBuffer, 0, params);
  device.queue.writeBuffer(copyParamsBuffer, 0, new Uint32Array([particleCount, 0, 0, 0]));
  device.queue.writeBuffer(compactParamsBuffer, 0, new Uint32Array([layout.denseEventCount, 8, groupCount, 0]));
  const outputResources = [sourcePackedBuffer, selected.outputBuffer, routingBuffer, metadataBuffer,
    inventory.buffer, packedBuffer, eventBuffer, auxiliaryBuffer, paramsBuffer];
  const compactResources = [eventBuffer, compactEventBuffer, compactCountBuffer, compactParamsBuffer,
    compactReceiptBuffer, compactPrefixBuffer, compactGroupCountBuffer, compactGroupOffsetBuffer,
    sourceCompanions, compactCompanionBuffer];
  const resourceLists = [
    [source.stateBuffer, source.thermoBuffer, source.mechanicsBuffer, sourcePackedBuffer, copyParamsBuffer],
    outputResources, outputResources,
    [packedBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, copyParamsBuffer],
    compactResources, compactResources, compactResources
  ];
  const groups = pipelines.map((pipeline, i) => device.createBindGroup({ layout: pipeline.bindGroupLayout,
    entries: resourceLists[i].map((resource, binding) => ({ binding,
      resource: resource === sourceCompanions ? sourceCompanions : { buffer: resource } })) }));
  const encoder = device.createCommandEncoder();
  for (const buffer of [packedBuffer, eventBuffer, auxiliaryBuffer, compactEventBuffer, compactCompanionBuffer,
    compactCountBuffer, compactReceiptBuffer, compactPrefixBuffer, compactGroupCountBuffer, compactGroupOffsetBuffer]) {
    encoder.clearBuffer(buffer);
  }
  const dispatches = [Math.ceil(particleCount / 64), particleCount, particleCount,
    Math.ceil(particleCount / 64), groupCount, 1, groupCount];
  for (let i = 0; i < pipelines.length; i++) {
    const pass = encoder.beginComputePass(); pass.setPipeline(pipelines[i].pipeline); pass.setBindGroup(0, groups[i]);
    pass.dispatchWorkgroups(dispatches[i]); pass.end();
  }
  const command = encoder.finish(); validate(); markSubmitted(); device.queue.submit([command]);
  return Object.freeze({ schema: SCHEMA, physicalPublicationAdmitted: false, layout,
    sourcePackedBuffer, packedBuffer, stateBuffer, thermoBuffer, mechanicsBuffer,
    eventBuffer, auxiliaryBuffer, compactEventBuffer, compactCompanionBuffer, compactCountBuffer,
    compactReceiptBuffer, denseEventCount: layout.denseEventCount,
    eventCompanionByteOffset: companionOffset, eventCompanionStrideWords: layout.eventCompanionStrideWords });
}
