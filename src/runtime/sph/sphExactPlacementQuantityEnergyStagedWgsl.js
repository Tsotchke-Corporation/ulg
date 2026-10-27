import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { sphExactPlacementQuantityStagedPipelineDescriptors } from './sphExactPlacementQuantityStagedWgsl.js';
const MAGIC=0x58454531,VERSION=1;
const operations=['begin','normalize','normalize','scale','divide','from_f32',
  'from_f32','multiply','scale','add','from_f32','multiply','scale','add','from_f32','multiply','scale','add',
  'multiply','normalize','normalize','add','multiply','add','multiply','finish'];
export const SPH_EXACT_PLACEMENT_ENERGY_STAGES=Object.freeze(operations.map((operation,step)=>Object.freeze({operation,step})));
const checked=(v,name)=>{if(!Number.isSafeInteger(v)||v<1||v>0x3fffffff)throw RangeError(`Exact energy ${name} exceeds addressing`);return v;};
export function sphExactPlacementQuantityEnergyScratchLayout(format,layout){
 validateSphExactMassFormat(format);
 if(layout.massWordCount!==format.wordCount||layout.scalar.recordWords!==4+2*layout.scalar.wordCount
   ||layout.scalarOffsetWords!==16+format.wordCount||layout.recordWords!==layout.scalarOffsetWords+7*layout.scalar.recordWords)throw TypeError('Matching original quantity layout required');
 const recordWords=checked(16+6*layout.scalar.recordWords,'record');
 return Object.freeze({recordWords,wordLength:checked(layout.rowCount*recordWords,'arena'),slotCount:6,headerWords:16,
  scalar:layout.scalar,stageCount:26,uniquePipelineCount:8,storageBindingCount:9,uniformBindingCount:2});
}
export function sphExactPlacementQuantityEnergyStageParams(scratch,alignment){
 if(!Number.isSafeInteger(alignment)||alignment<16||(alignment&(alignment-1))!==0)throw RangeError('Original uniform offset alignment required');
 const strideBytes=Math.ceil(16/alignment)*alignment,byteLength=checked(scratch.stageCount*strideBytes/4,'stage params')*4;
 const words=new Uint32Array(byteLength/4);
 for(let step=0;step<scratch.stageCount;step++)words[step*strideBytes/4]=step;
 return Object.freeze({words,strideBytes,byteLength,recordBytes:16});
}
function header(format,layout,scratch){return /* wgsl */ `
const XE_N:u32=${format.wordCount}u;
const XE_R:u32=${layout.scalar.wordCount}u;
const XE_Q:u32=${layout.recordWords}u;
const XE_SCALAR:u32=${layout.scalar.recordWords}u;
const XE_OFFSET:u32=${layout.scalarOffsetWords}u;
const XE_SCRATCH:u32=${scratch.recordWords}u;
const XE_MAGIC:u32=${MAGIC}u;
struct ExactQuantityParams {
 count:u32,capacity:u32,packet_words:u32,inventory_offset:u32,
 carrier_offset:u32,carrier_stride:u32,companion_stride:u32,molar_count:u32,
 extensive_offset:u32,caloric_offset:u32,product_offset:u32,product_capacity:u32,
 energy_offset:u32,species_offset:u32,species_term_offset:u32,species_term_stride:u32
}
struct ExactEnergyStep { expected:u32,reserved0:u32,reserved1:u32,reserved2:u32 }
@group(0) @binding(0) var<storage,read> xq_original:array<u32>;
@group(0) @binding(1) var<storage,read> xq_packet:array<u32>;
@group(0) @binding(2) var<storage,read> xq_inventory:array<u32>;
@group(0) @binding(3) var<storage,read> xq_aux:array<u32>;
@group(0) @binding(4) var<storage,read> xq_companions:array<u32>;
@group(0) @binding(5) var<storage,read> xq_count:array<u32>;
@group(0) @binding(6) var<storage,read> xq_molars:array<u32>;
@group(0) @binding(7) var<storage,read_write> xq_values:array<u32>;
@group(0) @binding(8) var<uniform> xq_params:ExactQuantityParams;
@group(0) @binding(9) var<storage,read_write> xe_scratch:array<u32>;
@group(0) @binding(10) var<uniform> xe_step:ExactEnergyStep;
fn xe_poison(output:u32){
 let dest=output*XE_Q;let at=output*XE_SCRATCH;
 xq_values[dest]=0u;xq_values[dest+1u]|=8192u;xq_values[dest+15u]=0u;
 xe_scratch[at+4u]|=8192u;
}
fn xe_main_ready(output:u32)->bool{
 let dest=output*XE_Q;
 return xq_values[dest]==0u&&xq_values[dest+12u]==0x58515331u
  &&xq_values[dest+13u]==3u&&xq_values[dest+14u]==7u&&xq_values[dest+15u]==1u
  &&xq_values[dest+9u]==XE_N&&xq_values[dest+10u]==XE_R
  &&xe_step.reserved0==0u&&xe_step.reserved1==0u&&xe_step.reserved2==0u;
}
fn xe_guard(output:u32)->bool{
 let dest=output*XE_Q;let at=output*XE_SCRATCH;let expected=xe_step.expected;
 if(!xe_main_ready(output)||expected==0u||expected>=26u
  ||xe_scratch[at]!=XE_MAGIC||xe_scratch[at+1u]!=${VERSION}u||xe_scratch[at+2u]!=expected
  ||xe_scratch[at+3u]!=(1u<<expected)-1u||xe_scratch[at+4u]!=0u
  ||xe_scratch[at+5u]!=select(0u,1u,xq_values[dest+11u]!=0u&&xq_values[dest+1u]==0u)
  ||xe_scratch[at+6u]!=xq_values[dest+5u]||xe_scratch[at+7u]!=xq_values[dest+6u]
  ||xe_scratch[at+8u]!=xq_values[dest+7u]||xe_scratch[at+9u]!=xq_values[dest+8u]
  ||xe_scratch[at+10u]!=output||xe_scratch[at+11u]!=XE_N||xe_scratch[at+12u]!=XE_R
  ||xe_scratch[at+13u]!=XE_QUANTUM_BITS
  ||xe_scratch[at+14u]!=xq_values[dest+1u]||xe_scratch[at+15u]!=0u){xe_poison(output);return false;}
 return true;
}
fn xe_advance(output:u32){
 let at=output*XE_SCRATCH;let next=xe_step.expected+1u;
 xe_scratch[at+2u]=next;xe_scratch[at+3u]=(1u<<next)-1u;
}
`;}
const scratchAccess=/* wgsl */ `
fn xe_load(output:u32,slot:u32)->ExactRational{
 let at=output*XE_SCRATCH+16u+slot*XE_SCALAR;
 var value=xr_zero();value.negative=xe_scratch[at];value.error=xe_scratch[at+1u];
 value.exponent=bitcast<i32>(xe_scratch[at+2u]);value.reserved=xe_scratch[at+3u];
 for(var i=0u;i<XE_R;i++){value.numerator[i]=xe_scratch[at+4u+i];value.denominator[i]=xe_scratch[at+4u+XE_R+i];}
 // Only this fixed producer writes these normalized slots. Re-normalizing here
 // would recreate nested wide call graphs and change checked operation order.
 return value;
}
fn xe_store(output:u32,slot:u32,value:ExactRational){
 let at=output*XE_SCRATCH+16u+slot*XE_SCALAR;
 xe_scratch[at]=value.negative;xe_scratch[at+1u]=value.error;
 xe_scratch[at+2u]=bitcast<u32>(value.exponent);xe_scratch[at+3u]=value.reserved;
 for(var i=0u;i<XE_R;i++){xe_scratch[at+4u+i]=value.numerator[i];xe_scratch[at+4u+XE_R+i]=value.denominator[i];}
}
`;
function begin(){return /* wgsl */ `
@compute @workgroup_size(1)
fn materialize_exact_placement_energy_begin(@builtin(global_invocation_id) id:vec3<u32>){
 let output=id.x;if(output>=2u*xq_params.count+xq_params.capacity){return;}
 let dest=output*XE_Q;let at=output*XE_SCRATCH;
 var dirty=false;for(var i=0u;i<XE_SCRATCH;i++){dirty=dirty||xe_scratch[at+i]!=0u;}
 if(xe_step.expected!=0u||!xe_main_ready(output)||dirty){xe_poison(output);return;}
 for(var slot=0u;slot<6u;slot++){xe_scratch[at+16u+slot*XE_SCALAR+4u+XE_R]=1u;}
 xe_scratch[at]=XE_MAGIC;xe_scratch[at+1u]=${VERSION}u;xe_scratch[at+2u]=1u;xe_scratch[at+3u]=1u;
 xe_scratch[at+5u]=select(0u,1u,xq_values[dest+11u]!=0u&&xq_values[dest+1u]==0u);
 xe_scratch[at+6u]=xq_values[dest+5u];xe_scratch[at+7u]=xq_values[dest+6u];
 xe_scratch[at+8u]=xq_values[dest+7u];xe_scratch[at+9u]=xq_values[dest+8u];
 xe_scratch[at+10u]=output;xe_scratch[at+11u]=XE_N;xe_scratch[at+12u]=XE_R;
 xe_scratch[at+13u]=XE_QUANTUM_BITS;xe_scratch[at+14u]=xq_values[dest+1u];
}
`;}
function finish(){return /* wgsl */ `
@compute @workgroup_size(1)
fn materialize_exact_placement_energy_finish(@builtin(global_invocation_id) id:vec3<u32>){
 let output=id.x;if(output>=2u*xq_params.count+xq_params.capacity){return;}
 if(xe_step.expected!=25u||!xe_guard(output)){xe_poison(output);return;}
 let dest=output*XE_Q;let source=output*XE_SCRATCH+16u+3u*XE_SCALAR;
 let field=dest+XE_OFFSET+3u*XE_SCALAR;
 for(var i=0u;i<XE_SCALAR;i++){xq_values[field+i]=xe_scratch[source+i];}
 xq_values[dest+1u]|=xe_scratch[source+1u];
 xq_values[dest+13u]=4u;xq_values[dest+14u]=15u;
 xe_advance(output);
}
`;}
function operationBody(format,operation){
 const ee=format.wordCount+18,ec=3*format.wordCount+26;
 if(operation==='normalize')return /* wgsl */ `
 var value=xr_zero();var target_slot=1u;
 if(step==1u){for(var i=0u;i<XE_N;i++){value.numerator[i]=xq_values[dest+16u+i];}}
 if(step==2u){target_slot=3u;
  for(var i=0u;i<XE_N;i++){
   if(kind==2u){value.numerator[i]=xq_packet[packet+12u+i];}
   else{value.numerator[i]=xq_inventory[xq_params.inventory_offset+row*XE_N+i];}
  }
 }
 if(step==19u){target_slot=5u;if(kind==2u){
  let at=packet+xq_params.extensive_offset+4u+10u*${ee+2}u;
  value.negative=xq_packet[at];value.error=xq_packet[at+1u];value.exponent=${format.quantumExponent-299};
  for(var i=0u;i<${ee}u;i++){value.numerator[i]=xq_packet[at+2u+i];}
 }}
 if(step==20u&&kind==2u){
  let energy=packet+xq_params.energy_offset;let at=energy+${8+ec+2}u;
  let denominator=packet+xq_params.caloric_offset+${16+ec+2}u;
  value.negative=xq_packet[at];value.error=xq_packet[at+1u]|xq_packet[denominator+1u];
  if(xq_packet[denominator]!=0u){value.error|=8192u;}
  value.exponent=bitcast<i32>(xq_packet[energy+3u]);
  for(var i=0u;i<${ec}u;i++){value.numerator[i]=xq_packet[at+2u+i];value.denominator[i]=xq_packet[denominator+2u+i];}
 }
 if(step<=2u||kind==2u){let normalized=xr_normalize(value);xe_store(output,target_slot,normalized);}
`;
 if(operation==='from_f32')return /* wgsl */ `
 var bits=0u;var target_slot=0u;
 if(step==5u){
  if(kind==2u){let state=packet+xq_params.caloric_offset+xq_params.product_offset
    +(2u*xq_params.product_capacity+ordinal-2u)*8u;bits=xq_packet[state+4u];}
  else{bits=xq_original[row*52u+7u];}
 }else{target_slot=1u;if(kind!=2u){bits=xq_original[row*52u+4u+(step-6u)/4u];}}
 if(step==5u||kind!=2u){let value=xr_from_f32_bits(bits);xe_store(output,target_slot,value);}
`;
 if(operation==='scale')return /* wgsl */ `
 var source_slot=5u;var target_slot=5u;var exponent=-1;
 if(step==3u){source_slot=select(3u,1u,kind==2u);target_slot=2u;exponent=${format.quantumExponent};}
 if(step==3u||kind!=2u){let source=xe_load(output,source_slot);let value=xr_scale_pow2(source,exponent);xe_store(output,target_slot,value);}
`;
 if(operation==='divide')return /* wgsl */ `
 if(kind==1u||kind==2u){let units=xe_load(output,1u);let denominator=xe_load(output,3u);
  let value=xr_divide(units,denominator);xe_store(output,4u,value);}
`;
 if(operation==='multiply')return /* wgsl */ `
 var left_slot=1u;var right_slot=1u;var target_slot=5u;var execute=kind!=2u;
 if(step==18u){left_slot=2u;right_slot=0u;target_slot=3u;execute=true;}
 if(step==22u){left_slot=4u;right_slot=5u;target_slot=1u;execute=kind==2u;}
 if(step==24u){left_slot=3u;right_slot=4u;target_slot=3u;execute=kind==1u;}
 if(execute){let left=xe_load(output,left_slot);let right=xe_load(output,right_slot);
  let value=xr_multiply(left,right);xe_store(output,target_slot,value);}
`;
 if(operation==='add')return /* wgsl */ `
 var left_slot=0u;var right_slot=5u;var target_slot=0u;var execute=kind!=2u;
 if(step==21u){left_slot=5u;right_slot=1u;target_slot=5u;execute=kind==2u;}
 if(step==23u){left_slot=3u;right_slot=1u;target_slot=3u;execute=kind==2u;}
 if(execute){let left=xe_load(output,left_slot);let right=xe_load(output,right_slot);
  let value=xr_add(left,right);xe_store(output,target_slot,value);}
`;
 throw RangeError('Unknown exact energy operation');
}
export function createSphExactPlacementQuantityEnergyStagedWgsl(format,layout,operation){
 const scratch=sphExactPlacementQuantityEnergyScratchLayout(format,layout);
 if(!operations.includes(operation))throw RangeError('Unknown exact energy operation');
 const declaration=header(format,layout,scratch)+`\nconst XE_QUANTUM_BITS:u32=${format.quantumExponent>>>0}u;\n`;
 if(operation==='begin')return declaration+begin();
 if(operation==='finish')return declaration+finish();
 const allowed=operations.map((op,i)=>op===operation?i:null).filter(i=>i!==null);
 return createSphExactRationalQuantityWgsl({wordCount:layout.scalar.wordCount})+declaration+scratchAccess+/* wgsl */ `
@compute @workgroup_size(1)
fn materialize_exact_placement_energy_${operation}(@builtin(global_invocation_id) id:vec3<u32>){
 let output=id.x;if(output>=2u*xq_params.count+xq_params.capacity){return;}
 let step=xe_step.expected;
 if(!(${allowed.map(i=>`step==${i}u`).join('||')})||!xe_guard(output)){xe_poison(output);return;}
 let scratch=output*XE_SCRATCH;let dest=output*XE_Q;
 if(xe_scratch[scratch+5u]!=0u){
  let kind=xe_scratch[scratch+6u];let row=xe_scratch[scratch+7u];
  let packet=xe_scratch[scratch+8u]*xq_params.packet_words;let ordinal=xe_scratch[scratch+9u];
${operationBody(format,operation)}
 }
 xe_advance(output);
}
`;
}
export function sphExactPlacementQuantityEnergyStagedPipelineDescriptors(format,layout){
 const energy=SPH_EXACT_PLACEMENT_ENERGY_STAGES.map(({operation,step})=>Object.freeze({stage:'energy',operation,step,
  label:`ulg-exact-placement-energy-${operation}`,entryPoint:`materialize_exact_placement_energy_${operation}`,
  cacheKey:`ulg-exact-placement-energy-v1-${format.wordCount}-${format.quantumExponent}-${layout.scalar.wordCount}-${operation}`,
  code:createSphExactPlacementQuantityEnergyStagedWgsl(format,layout,operation),
  bindings:Object.freeze([...Array(7).fill('read-only-storage'),'storage','uniform','storage','uniform'])}));
 return Object.freeze(sphExactPlacementQuantityStagedPipelineDescriptors(format,layout)
  .flatMap(d=>d.stage==='field'&&d.field===3?energy:[d]));
}
