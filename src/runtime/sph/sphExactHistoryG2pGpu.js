import { mlsMpmG2pReconstructWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { prepareSphExactHistoryMechanicsViews } from './sphExactHistoryP2gGpu.js';
import { prepareSphExactG2pNumericQuantities } from './sphExactG2pQuantityGpu.js';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout } from './sphExactRationalQuantityWgsl.js';
import { SPH_EXACT_PLACEMENT_QUANTITY_FIELDS } from './sphExactPlacementQuantityWgsl.js';
import { createSphExactResidentProductHistoryValidationWgsl } from './sphExactResidentProductHistoryWgsl.js';

// Numeric work owned by the original G2P producer. Only that producer may
// capture this result. This helper never registers a history/count/inventory.
export async function prepareSphExactHistoryG2p({ device, source, allocate, gridBuffer, paramsData }) {
  source.validate();
  const l = source.layout, count = source.descriptor, capacity = count.rowCapacity;
  const views = await prepareSphExactHistoryMechanicsViews({ device, source, allocate });
  const make = (name, size, usage = 128 | 4 | 8) => allocate({ label: `ulg-exact-history-g2p-${name}`, size, usage });
  const stateBuffer = make('old-state', capacity * 32), thermoBuffer = make('thermo', capacity * 48);
  const mechanicsBuffer = make('old-mechanics', capacity * 128);
  const outStateBuffer = make('new-state', capacity * 32), outMechanicsBuffer = make('new-mechanics', capacity * 128);
  const candidateBuffer = make('candidate', capacity * l.rowBytes), outputBuffer = make('selected', capacity * l.rowBytes);
  const paramsBuffer = make('params', paramsData.byteLength, 64 | 8);
  device.queue.writeBuffer(paramsBuffer, 0, paramsData);
  const quantityLayout = Object.freeze({ headerWords: 16, massWordCount: l.massWordCount,
    massOffsetWords: 16, scalarOffsetWords: 16 + l.massWordCount,
    scalar: sphExactRationalQuantityLayout({ wordCount: l.rationalWordCount }),
    rowCount: capacity, recordWords: l.quantityWords, wordLength: capacity * l.quantityWords,
    fields: SPH_EXACT_PLACEMENT_QUANTITY_FIELDS });
  const quantities = await prepareSphExactG2pNumericQuantities({ device,
    quantityBuffer: views.quantityBuffer, quantityLayout, format: l.format, particleCount: capacity,
    allocate, validate: source.validate, markDerivedBuffers: source.markDerivedBuffers,
    indirectDispatch: { buffer: views.dispatchBuffer, rowOffset: 0, projectionOffset: 12 } });
  await source.markDerivedBuffers([stateBuffer, thermoBuffer, mechanicsBuffer, outStateBuffer,
    outMechanicsBuffer, candidateBuffer, outputBuffer]);
  source.validate();
  const compile = async (code, entryPoint, types) => {
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint,
      cacheKey: `exact-history-g2p-v1:${l.massWordCount}:${l.format.quantumExponent}:${l.rationalWordCount}:${l.rowWords}:${capacity}`,
      label: `ulg-${entryPoint}`, bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact history G2P pipeline unavailable: ${entryPoint}`);
    source.validate(); return pipeline;
  };
  const ro = 'read-only-storage', rw = 'storage', uniform = 'uniform';
  const split = await compile(/* wgsl */ `
@group(0) @binding(0) var<storage,read> packed:array<u32>;
@group(0) @binding(1) var<storage,read_write> state:array<u32>;
@group(0) @binding(2) var<storage,read_write> thermo:array<u32>;
@group(0) @binding(3) var<storage,read_write> mechanics:array<u32>;
@group(0) @binding(4) var<storage,read> live:array<u32>;
@group(0) @binding(5) var<storage,read> validation:array<u32>;
@compute @workgroup_size(32)
fn split_history_mechanics(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${capacity}u||row>=live[3u]||validation[0u]!=0u){return;}
  for(var i=0u;i<8u;i++){state[row*8u+i]=packed[row*52u+i];}
  for(var i=0u;i<12u;i++){thermo[row*12u+i]=packed[row*52u+8u+i];}
  for(var i=0u;i<32u;i++){mechanics[row*32u+i]=packed[row*52u+20u+i];}
}`, 'split_history_mechanics', [ro, rw, rw, rw, ro, ro]);
  // Use the exact original physical solver; only its live-row guard changes.
  const originalGuard = 'if (particle_index >= params.particle_count) {';
  if (mlsMpmG2pReconstructWgsl.split(originalGuard).length !== 2) throw new Error('Original G2P row guard changed');
  const reconstruct = await compile(mlsMpmG2pReconstructWgsl.replace(originalGuard,
    'if (particle_index >= params.particle_count || particle_index >= history_count[3u] || history_validation[0u] != 0u) {') + /* wgsl */ `
@group(0) @binding(8) var<storage,read> history_count:array<u32>;
@group(0) @binding(9) var<storage,read> history_validation:array<u32>;
`, 'main', [ro, ro, ro, ro, rw, rw, uniform, ro, ro, ro]);
  const pack = await compile(createSphExactRationalQuantityWgsl({ wordCount: l.rationalWordCount }) + /* wgsl */ `
@group(0) @binding(0) var<storage,read> original:array<u32>;
@group(0) @binding(1) var<storage,read> packed:array<u32>;
@group(0) @binding(2) var<storage,read> state:array<u32>;
@group(0) @binding(3) var<storage,read> mechanics:array<u32>;
@group(0) @binding(4) var<storage,read> quantities:array<u32>;
@group(0) @binding(5) var<storage,read_write> candidate:array<u32>;
@group(0) @binding(6) var<storage,read_write> validation:array<atomic<u32>>;
@group(0) @binding(7) var<storage,read> quantity_validation:array<u32>;
@group(0) @binding(8) var<storage,read> live:array<u32>;
${createSphExactResidentProductHistoryValidationWgsl(l, 'candidate')}
fn history_quantity(row:u32,field:u32)->ExactRational {
  let at=row*${l.quantityWords}u+${16+l.massWordCount}u+field*${l.scalarWords}u;var v:ExactRational;
  v.negative=quantities[at];v.error=quantities[at+1u];v.exponent=bitcast<i32>(quantities[at+2u]);v.reserved=quantities[at+3u];
  for(var i=0u;i<XR_WORDS;i++){v.numerator[i]=quantities[at+4u+i];v.denominator[i]=quantities[at+4u+XR_WORDS+i];}return v;
}
@compute @workgroup_size(32)
fn pack_history_g2p_candidate(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${capacity}u){return;}
  if(quantity_validation[0u]!=0u){atomicOr(&validation[0u],16u);return;}
  if(row>=live[3u]||atomicLoad(&validation[0u])!=0u){return;}
  let base=row*${l.rowWords}u;
  for(var i=0u;i<${l.rowWords}u;i++){candidate[base+i]=original[base+i];}
  for(var i=0u;i<${l.quantityWords}u;i++){candidate[base+${l.quantityOffsetWords}u+i]=quantities[row*${l.quantityWords}u+i];}
  for(var i=0u;i<52u;i++){candidate[base+${l.physicalOffsetWords}u+i]=packed[row*52u+i];}
  for(var i=0u;i<8u;i++){candidate[base+${l.stateOffsetWords}u+i]=state[row*8u+i];}
  for(var i=0u;i<32u;i++){candidate[base+${l.mechanicsOffsetWords}u+i]=mechanics[row*32u+i];}
  for(var i=0u;i<3u;i++){candidate[base+i]=state[row*8u+i];candidate[base+20u+i]=state[row*8u+4u+i];}
  candidate[base+19u]=state[row*8u+7u];
  var volume=history_quantity(row,5u);let volume_bits=xrp_project_f32_bits(&volume);
  var mass=xr_zero();mass.exponent=${l.format.quantumExponent}i;
  for(var i=0u;i<${l.massWordCount}u;i++){mass.numerator[i]=quantities[row*${l.quantityWords}u+16u+i];}
  var rest=history_quantity(row,4u);var density:ExactRational;xrp_rational_divide(&density,&mass,&rest);
  let density_bits=xrp_project_f32_bits(&density);
  if(volume_bits.error!=0u||density_bits.error!=0u||!(bitcast<f32>(volume_bits.bits)>0.0)
      ||!(bitcast<f32>(density_bits.bits)>0.0)) {atomicOr(&validation[0u],32u);return;}
  candidate[base+23u]=volume_bits.bits;candidate[base+17u]=density_bits.bits;
  candidate[base+${l.thermoOffsetWords+3}u]=density_bits.bits;
  if(!exact_history_valid(0u,row)){atomicOr(&validation[0u],64u);}
}`, 'pack_history_g2p_candidate', [ro, ro, ro, ro, ro, rw, rw, ro, ro]);
  // No arithmetic or new admission follows the original finalizer. Select
  // whole original/candidate rows using its shared terminal rejection flag.
  const select = await compile(/* wgsl */ `
@group(0) @binding(0) var<storage,read> original:array<u32>;
@group(0) @binding(1) var<storage,read> candidate:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
@group(0) @binding(3) var<storage,read> validation:array<u32>;
@compute @workgroup_size(64)
fn select_history_g2p(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${capacity}u){return;}
  for(var i=0u;i<${l.rowWords}u;i++){
    let at=row*${l.rowWords}u+i;output[at]=select(candidate[at],original[at],validation[0u]!=0u);
  }
}`, 'select_history_g2p', [ro, ro, rw, ro]);
  const countResource = { buffer: count.controlBuffer, offset: count.controlOffsetBytes, size: 64 };
  const group = (pipeline, resources) => device.createBindGroup({ layout: pipeline.bindGroupLayout,
    entries: resources.map((buffer, binding) => ({ binding, resource: buffer === countResource ? buffer : { buffer } })) });
  const splitGroup = group(split, [views.outputBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, countResource, views.validationBuffer]);
  const reconstructGroup = group(reconstruct, [stateBuffer, thermoBuffer, mechanicsBuffer, gridBuffer, outStateBuffer,
    outMechanicsBuffer, paramsBuffer, count.controlBuffer, countResource, views.validationBuffer]);
  const packGroup = group(pack, [source.buffer, views.outputBuffer, outStateBuffer, outMechanicsBuffer,
    quantities.quantityBuffer, candidateBuffer, views.validationBuffer, quantities.validationBuffer, countResource]);
  const selectGroup = group(select, [source.buffer, candidateBuffer, outputBuffer, views.validationBuffer]);
  const dispatch = (encoder, pipeline, group, indirectOffset) => {
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
    if (indirectOffset === null) pass.dispatchWorkgroups(Math.ceil(capacity / 64));
    else pass.dispatchWorkgroupsIndirect(views.dispatchBuffer, indirectOffset);
    pass.end();
  };
  return Object.freeze({ source, outputBuffer, validationBuffer: views.validationBuffer,
    // Retained diagnostics are also used by the authentic publisher's capture.
    quantityLayout, quantities, stateBuffer, thermoBuffer, mechanicsBuffer, outStateBuffer, outMechanicsBuffer,
    retainedBuffers: Object.freeze([outputBuffer, views.validationBuffer, views.quantityBuffer, quantities.quantityBuffer,
      quantities.validationBuffer, quantities.projectionBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, outStateBuffer, outMechanicsBuffer]),
    encodeCandidate(encoder) {
      source.validate(); views.encode(encoder);
      for (const buffer of [stateBuffer, thermoBuffer, mechanicsBuffer, outStateBuffer, outMechanicsBuffer, candidateBuffer]) encoder.clearBuffer(buffer);
      dispatch(encoder, split, splitGroup, 0); dispatch(encoder, reconstruct, reconstructGroup, 24);
      quantities.encode(encoder, { stateBuffer, mechanicsBuffer, outStateBuffer, outMechanicsBuffer });
      dispatch(encoder, pack, packGroup, 0); source.validate();
    },
    encodeSelection(encoder) { source.validate(); dispatch(encoder, select, selectGroup, null); }
  });
}
