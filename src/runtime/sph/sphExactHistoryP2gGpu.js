import { computeBufferBinding, createCachedExplicitBindGroup, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { createSphExactResidentProductHistoryValidationWgsl } from './sphExactResidentProductHistoryWgsl.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { specializeExactHistoryP2gWgsl } from './sphExactHistoryP2gWgsl.js';

// P2G owns allocation, encoding, submission and retirement. These are views
// for its existing grid arithmetic; the exact history is never reconstructed
// from them and no legacy event/count authority is minted for this buffer.
export async function prepareSphExactHistoryP2g({ device, source, allocate }) {
  return prepareExactHistoryViews({ device, source, allocate, mechanicsViews: false });
}

// Same retained owner and arithmetic, projected into its ordinary packed
// state/thermo/mechanics view for the original G2P solver. The quantity plane
// is a verbatim numeric copy, never a newly registered inventory owner.
export async function prepareSphExactHistoryMechanicsViews({ device, source, allocate }) {
  return prepareExactHistoryViews({ device, source, allocate, mechanicsViews: true });
}

// Residual-only event view for the gas consumer. Moles derive from exact M
// and its original molar identity; historical placed mass is not gas inventory.
export async function prepareSphExactHistoryGasViews({ device, source, allocate }) {
  return prepareExactHistoryViews({ device, source, allocate, gasViews: true });
}

async function prepareExactHistoryViews({ device, source, allocate, mechanicsViews = false, gasViews = false }) {
  source.validate();
  const { layout: l, descriptor: count } = source, capacity = count.rowCapacity;
  const scalar = l.scalarWords, n = l.massWordCount, q = l.quantityOffsetWords;
  const operations = []; let registers = gasViews ? 10 : 9;
  const op = (kind, a, b) => { const out = registers++; operations.push([kind, a, b, out]); return out; };
  const add = (a, b) => op(0, a, b), sub = (a, b) => op(1, a, b), mul = (a, b) => op(2, a, b), div = (a, b) => op(3, a, b);
  const kinetic = div(div(add(add(mul(1, 1), mul(2, 2)), mul(3, 3)), 0), 8);
  const internal = div(sub(4, kinetic), 0), density = div(0, 5);
  // Registers M/Px/Py/Pz/E/V0/V/M31, then the exact integer constant two.
  const physicalProjections = [[0, 3], [div(1, 0), 4], [div(2, 0), 5], [div(3, 0), 6],
    [internal, 7], [density, 11], [div(6, 5), 38], [5, 39], [7, 51]];
  const projections = gasViews
    ? [[0, 3], [0, 13], [div(0, 9), 9], [density, 17], [internal, 19], [6, 23],
      ...physicalProjections.slice(1, 4).map(([slot, field]) => [slot, field + 16])]
    : mechanicsViews ? physicalProjections
    : [[0, 13], [1, 20], [2, 21], [3, 22], [6, 23], [density, 17], [internal, 19],
      ...physicalProjections.map(([slot, field]) => [slot, field + 32])];
  const outputWords = gasViews ? 32 : mechanicsViews ? l.physicalWords : 32 + l.physicalWords;
  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const bytes = capacity * registers * scalar * 4;
  if (!Number.isSafeInteger(bytes) || bytes > device.limits.maxStorageBufferBindingSize
      || bytes > device.limits.maxBufferSize || device.limits.maxStorageBuffersPerShaderStage < 9
      || capacity * outputWords * 4 > Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize)
      || Math.ceil(capacity * (mechanicsViews ? 6 : 1) / 32) > device.limits.maxComputeWorkgroupsPerDimension
      || (mechanicsViews && capacity * l.quantityWords * 4 > Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize))
      || (operations.length + projections.length) * alignment > device.limits.maxUniformBufferBindingSize) {
    throw new RangeError('Exact history P2G arithmetic exceeds the original device capacity');
  }
  const make = (label, size, usage) => tagWebGpuBufferDevice(allocate({ label: `ulg-exact-history-p2g-${label}`, size, usage }), device);
  const outputBuffer = make('views', capacity * outputWords * 4, 128 | 8 | 4);
  const quantityBuffer = mechanicsViews ? make('quantity-views', capacity * l.quantityWords * 4, 128 | 8 | 4) : null;
  const validationBuffer = make('validation', 16, 128 | 8 | 4);
  const dispatchBuffer = make('live-dispatch', mechanicsViews ? 36 : 12, 128 | 256 | 8);
  const scratch = make('scratch', bytes, 128 | 8);
  const instructions = make('instructions', (operations.length + projections.length) * alignment, 64 | 8);
  const params = make('params', 16, 64 | 8);
  await source.markDerivedBuffers([outputBuffer, quantityBuffer].filter(Boolean));
  source.validate();
  const words = new Uint32Array(instructions.size / 4);
  operations.forEach((value, i) => words.set(value, i * alignment / 4));
  projections.forEach(([slot, field], i) => words.set([4, slot, field, 0], (operations.length + i) * alignment / 4));
  device.queue.writeBuffer(instructions, 0, words);
  device.queue.writeBuffer(params, 0, new Uint32Array([capacity, count.generation, count.seal, l.rowWords / 4]));
  const code = createSphExactRationalQuantityWgsl({ wordCount: l.rationalWordCount }) + /* wgsl */ `
@group(0) @binding(0) var<storage,read> hp_source:array<u32>;
@group(0) @binding(1) var<storage,read> hp_count:array<u32>;
@group(0) @binding(2) var<storage,read_write> hp_output:array<u32>;
@group(0) @binding(3) var<storage,read_write> hp_scratch:array<u32>;
@group(0) @binding(4) var<storage,read_write> hp_validation:array<atomic<u32>>;
@group(0) @binding(5) var<uniform> hp_params:vec4<u32>;
@group(0) @binding(6) var<uniform> hp_op:vec4<u32>;
@group(0) @binding(7) var<storage,read_write> hp_dispatch:array<u32>;
${mechanicsViews ? '@group(0) @binding(8) var<storage,read_write> hp_quantities:array<u32>;' : ''}
${createSphExactResidentProductHistoryValidationWgsl(l, 'hp_source')}
fn hp_count_valid()->bool {
  return hp_count[0u]==0x50484731u && hp_count[1u]==1u && hp_count[2u]==1u
    && hp_count[3u]<=hp_params.x && hp_count[4u]==hp_params.x && hp_count[5u]==hp_params.w
    && hp_count[6u]==hp_params.y && hp_count[7u]==hp_params.z && hp_count[11u]==0u;
}
fn hp_live(row:u32)->bool {return hp_count_valid() && row<hp_count[3u];}
fn hp_at(row:u32,slot:u32)->u32 {return (row*${registers}u+slot)*${scalar}u;}
fn hp_load(row:u32,slot:u32)->ExactRational {
  let at=hp_at(row,slot);var v:ExactRational;
  v.negative=hp_scratch[at];v.error=hp_scratch[at+1u];v.exponent=bitcast<i32>(hp_scratch[at+2u]);v.reserved=hp_scratch[at+3u];
  for(var i=0u;i<XR_WORDS;i++){v.numerator[i]=hp_scratch[at+4u+i];v.denominator[i]=hp_scratch[at+4u+XR_WORDS+i];}
  return v;
}
@compute @workgroup_size(32)
fn prepare_exact_history_p2g(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=hp_params.x){return;}
  if(row==0u){
    atomicStore(&hp_validation[1u],0x48503247u);
    hp_dispatch[0u]=select(0u,(hp_count[3u]+31u)/32u,hp_count_valid());
    hp_dispatch[1u]=1u;hp_dispatch[2u]=1u;
    ${mechanicsViews ? `hp_dispatch[3u]=select(0u,(hp_count[3u]*6u+31u)/32u,hp_count_valid());
    hp_dispatch[4u]=1u;hp_dispatch[5u]=1u;
    hp_dispatch[6u]=select(0u,(hp_count[3u]+63u)/64u,hp_count_valid());
    hp_dispatch[7u]=1u;hp_dispatch[8u]=1u;` : ''}
  }
  if(!hp_count_valid()){atomicOr(&hp_validation[0u],1u);return;}
  if(!hp_live(row)){return;}
  if(!exact_history_live(0u,row)||!exact_history_valid(0u,row)){atomicOr(&hp_validation[0u],2u);return;}
  for(var i=0u;i<${outputWords}u;i++){
    let source_word=${gasViews ? 'i' : mechanicsViews ? `${l.physicalOffsetWords}u+i`
      : `select(${l.physicalOffsetWords}u+i-32u,i,i<32u)`};
    hp_output[row*${outputWords}u+i]=hp_source[row*${l.rowWords}u+source_word];
  }
  ${mechanicsViews ? `for(var i=0u;i<${l.quantityWords}u;i++){
    hp_quantities[row*${l.quantityWords}u+i]=hp_source[row*${l.rowWords}u+${q}u+i];}` : ''}
  for(var slot=0u;slot<${registers}u;slot++){hp_scratch[hp_at(row,slot)+4u+XR_WORDS]=1u;}
  hp_scratch[hp_at(row,0u)+2u]=bitcast<u32>(${l.format.quantumExponent}i);
  for(var i=0u;i<${n}u;i++){hp_scratch[hp_at(row,0u)+4u+i]=hp_source[row*${l.rowWords}u+${q+16}u+i];}
  for(var field=0u;field<7u;field++){
    for(var i=0u;i<${scalar}u;i++){hp_scratch[hp_at(row,field+1u)+i]=hp_source[row*${l.rowWords}u+${q+16+n}u+field*${scalar}u+i];}
  }
  hp_scratch[hp_at(row,8u)+2u]=1u;hp_scratch[hp_at(row,8u)+4u]=1u;
  ${gasViews ? `
  hp_output[row*32u+12u]=0u;
  let molar_bits=hp_source[row*${l.rowWords}u+${q+4}u];
  if(molar_bits!=hp_source[row*${l.rowWords}u+15u]
     ||!(bitcast<f32>(molar_bits)>0.0)||(molar_bits&0x7f800000u)==0x7f800000u){
    atomicOr(&hp_validation[0u],16u);return;
  }
  var molar:ExactRational;xrp_from_f32_bits(&molar,molar_bits);
  let at=hp_at(row,9u);hp_scratch[at]=molar.negative;hp_scratch[at+1u]=molar.error;
  hp_scratch[at+2u]=bitcast<u32>(molar.exponent);hp_scratch[at+3u]=molar.reserved;
  for(var i=0u;i<XR_WORDS;i++){hp_scratch[at+4u+i]=molar.numerator[i];hp_scratch[at+4u+XR_WORDS+i]=molar.denominator[i];}
  ` : ''}
}
@compute @workgroup_size(32)
fn calculate_exact_history_p2g(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=hp_params.x||!hp_live(row)||atomicLoad(&hp_validation[0u])!=0u){return;}
  var a=hp_load(row,hp_op.y);var b=hp_load(row,hp_op.z);var v:ExactRational;
  switch hp_op.x {
    case 0u:{xrp_rational_add(&v,&a,&b);}case 1u:{xrp_rational_subtract(&v,&a,&b);}
    case 2u:{xrp_rational_multiply(&v,&a,&b);}case 3u:{xrp_rational_divide(&v,&a,&b);}
    default:{v.error=1u;}
  }
  let at=hp_at(row,hp_op.w);hp_scratch[at]=v.negative;hp_scratch[at+1u]=v.error;
  hp_scratch[at+2u]=bitcast<u32>(v.exponent);hp_scratch[at+3u]=v.reserved;
  for(var i=0u;i<XR_WORDS;i++){hp_scratch[at+4u+i]=v.numerator[i];hp_scratch[at+4u+XR_WORDS+i]=v.denominator[i];}
  if(v.error!=0u){atomicOr(&hp_validation[0u],v.error);}
}
@compute @workgroup_size(32)
fn project_exact_history_p2g(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=hp_params.x||!hp_live(row)||atomicLoad(&hp_validation[0u])!=0u){return;}
  var value=hp_load(row,hp_op.y);let projected=xrp_project_f32_bits(&value);
  if(projected.error!=0u||(projected.bits&0x7fffffffu)>=0x7f800000u){atomicOr(&hp_validation[0u],4u|projected.error);return;}
  if((${(gasViews ? [3, 9, 13, 17, 23] : mechanicsViews ? [3, 11, 38, 39] : [13, 17, 23, 35, 43, 70, 71]).map(v => `hp_op.z==${v}u`).join('||')})&&!(bitcast<f32>(projected.bits)>0.0)){atomicOr(&hp_validation[0u],8u);return;}
  hp_output[row*${outputWords}u+hp_op.z]=projected.bits;
}
`;
  const stages = ['prepare_exact_history_p2g', 'calculate_exact_history_p2g', 'project_exact_history_p2g'];
  const key = `${gasViews ? 'gas' : mechanicsViews ? 'mechanics' : 'p2g'}:${l.massWordCount}:${l.format.quantumExponent}:${l.rationalWordCount}:${l.rowWords}`;
  const pipelines = [];
  for (const entryPoint of stages) {
    source.validate();
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { label: entryPoint,
      cacheKey: `ulg-exact-history-views-v5:${key}`, code, entryPoint,
      bindings: ['read-only-storage','read-only-storage','storage','storage','storage','uniform','uniform',
        ...(entryPoint === stages[0] ? ['storage', ...(mechanicsViews ? ['storage'] : [])] : [])]
        .map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact history pipeline unavailable: ${entryPoint}`);
    source.validate(); pipelines.push(pipeline);
  }
  const group = (pipeline, instruction) => createCachedExplicitBindGroup(device, { layout: pipeline.bindGroupLayout, entries: [
    { binding: 0, resource: { buffer: source.buffer } },
    { binding: 1, resource: { buffer: count.controlBuffer, offset: count.controlOffsetBytes, size: 64 } },
    { binding: 2, resource: { buffer: outputBuffer } }, { binding: 3, resource: { buffer: scratch } },
    { binding: 4, resource: { buffer: validationBuffer } }, { binding: 5, resource: { buffer: params } },
    { binding: 6, resource: { buffer: instructions, offset: instruction * alignment, size: 16 } },
    ...(pipeline === pipelines[0] ? [{ binding: 7, resource: { buffer: dispatchBuffer } },
      ...(mechanicsViews ? [{ binding: 8, resource: { buffer: quantityBuffer } }] : [])] : [])
  ] });
  const prepareGroup = group(pipelines[0], 0);
  const groups = [...operations, ...projections].map((_, i) => group(pipelines[i < operations.length ? 1 : 2], i));
  return Object.freeze({ outputBuffer, quantityBuffer, dispatchBuffer, validationBuffer, key,
    encodedDispatchCount: 1 + operations.length + projections.length, validate: source.validate,
    encode(encoder) {
      source.validate(); encoder.clearBuffer(outputBuffer); encoder.clearBuffer(validationBuffer); encoder.clearBuffer(scratch);
      encoder.clearBuffer(dispatchBuffer);
      if (quantityBuffer) encoder.clearBuffer(quantityBuffer);
      const dispatch = (pipeline, group, label, prepare = false) => {
        const pass = encoder.beginComputePass({ label });
        pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
        if (prepare) pass.dispatchWorkgroups(Math.ceil(capacity / 32));
        else pass.dispatchWorkgroupsIndirect(dispatchBuffer, 0);
        pass.end();
      };
      dispatch(pipelines[0], prepareGroup, 'exact-history-p2g-prepare', true);
      for (let i = 0; i < groups.length; i++) {
        dispatch(pipelines[i < operations.length ? 1 : 2], groups[i], `exact-history-p2g-operation-${i}`);
      }
      source.validate();
    },
    specializeP2g(code) {
      if (mechanicsViews || gasViews) throw new TypeError('Physical or gas views cannot substitute P2G extensive momentum views');
      return specializeExactHistoryP2gWgsl(code, l);
    }
  });
}
