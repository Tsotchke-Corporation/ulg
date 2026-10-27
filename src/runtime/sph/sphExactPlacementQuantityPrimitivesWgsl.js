import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactRationalQuantityWgsl } from './sphExactRationalQuantityWgsl.js';
import { sphExactPlacementQuantityStagedPipelineDescriptors, createSphExactPlacementQuantityStagedWgsl } from './sphExactPlacementQuantityStagedWgsl.js';
const MAGIC=0x58515031,VERSION=1;
const momentum=['begin','normalize','normalize','scale','divide','from_f32','multiply','normalize','multiply','multiply','finish'];
const energy=['begin','normalize','normalize','scale','divide','from_f32',
 'from_f32','multiply','scale','add','from_f32','multiply','scale','add','from_f32','multiply','scale','add',
 'multiply','normalize','normalize','add','multiply','add','multiply','finish'];
const volume0=['begin','normalize','normalize','scale','divide','from_f32','divide','multiply','finish'];
const volume=['begin','normalize','normalize','scale','divide','from_f32','from_f32','multiply','divide','multiply','finish'];
const referenceMass=['begin','normalize','normalize','scale','divide','from_f32','multiply','finish'];
const fields=Object.freeze([momentum,momentum,momentum,energy,volume0,volume,referenceMass].map(a=>Object.freeze([...a])));
export const SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES=Object.freeze(fields.flatMap((ops,field)=>
 ops.map((operation,step)=>Object.freeze({operation,step,field,stageCount:ops.length}))));
const operations=Object.freeze([...new Set(SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES.map(s=>s.operation))]);
const checked=(v,name)=>{if(!Number.isSafeInteger(v)||v<1||v>0x3fffffff)throw RangeError(`Exact primitive ${name} exceeds addressing`);return v;};
export function sphExactPlacementQuantityPrimitivesScratchLayout(format,layout){
 validateSphExactMassFormat(format);
 if(layout.massWordCount!==format.wordCount||layout.scalar.recordWords!==4+2*layout.scalar.wordCount
   ||layout.scalarOffsetWords!==16+format.wordCount||layout.recordWords!==layout.scalarOffsetWords+7*layout.scalar.recordWords)throw TypeError('Matching original quantity layout required');
 const recordWords=checked(16+6*layout.scalar.recordWords,'record');
 return Object.freeze({recordWords,wordLength:checked(layout.rowCount*recordWords,'arena'),slotCount:6,headerWords:16,
  scalar:layout.scalar,stageCount:SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES.length,uniquePipelineCount:8,
  fieldStageCounts:Object.freeze(fields.map(a=>a.length)),storageBindingCount:9,uniformBindingCount:2});
}
export function sphExactPlacementQuantityPrimitivesStageParams(scratch,alignment){
 if(!Number.isSafeInteger(alignment)||alignment<16||(alignment&(alignment-1))!==0)throw RangeError('Original uniform offset alignment required');
 if(scratch.stageCount!==SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES.length)throw TypeError('Original primitive stage count required');
 const strideBytes=Math.ceil(16/alignment)*alignment,byteLength=checked(scratch.stageCount*strideBytes/4,'stage params')*4;
 const words=new Uint32Array(byteLength/4);
 SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES.forEach((s,index)=>words.set([s.step,s.field,s.stageCount,0],index*strideBytes/4));
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
struct ExactPrimitiveStep { expected:u32,field:u32,stage_count:u32,reserved:u32 }
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
@group(0) @binding(10) var<uniform> xe_step:ExactPrimitiveStep;
fn xe_poison(output:u32){
 let dest=output*XE_Q;let at=output*XE_SCRATCH;
 xq_values[dest]=0u;xq_values[dest+1u]|=8192u;xq_values[dest+15u]=0u;
 xe_scratch[at+4u]|=8192u;
}
fn xe_stage_count(field:u32)->u32{
 if(field<3u||field==5u){return 11u;}if(field==3u){return 26u;}if(field==4u){return 9u;}if(field==6u){return 8u;}return 0u;
}
fn xe_main_ready(output:u32)->bool{
 let dest=output*XE_Q;let field=xe_step.field;
 return field<7u&&xe_step.stage_count==xe_stage_count(field)&&xe_step.reserved==0u
  &&xq_values[dest]==0u&&xq_values[dest+12u]==0x58515331u
  &&xq_values[dest+13u]==field&&xq_values[dest+14u]==(1u<<field)-1u&&xq_values[dest+15u]==1u
  &&xq_values[dest+9u]==XE_N&&xq_values[dest+10u]==XE_R&&xq_values[dest+11u]<=1u;
}
fn xe_identity(output:u32)->bool{
 let dest=output*XE_Q;let at=output*XE_SCRATCH;
 return xe_scratch[at+5u]==xq_values[dest+11u]
  &&xe_scratch[at+6u]==xq_values[dest+5u]&&xe_scratch[at+7u]==xq_values[dest+6u]
  &&xe_scratch[at+8u]==xq_values[dest+7u]&&xe_scratch[at+9u]==xq_values[dest+8u]
  &&xe_scratch[at+10u]==output&&xe_scratch[at+11u]==XE_N&&xe_scratch[at+12u]==XE_R
  &&xe_scratch[at+13u]==XE_QUANTUM_BITS;
}
fn xe_guard(output:u32)->bool{
 let dest=output*XE_Q;let at=output*XE_SCRATCH;let expected=xe_step.expected;
 if(!xe_main_ready(output)||expected==0u||expected>=xe_step.stage_count
  ||xe_scratch[at]!=XE_MAGIC||xe_scratch[at+1u]!=${VERSION}u||xe_scratch[at+2u]!=expected
  ||xe_scratch[at+3u]!=(1u<<expected)-1u||xe_scratch[at+4u]!=0u||!xe_identity(output)
  ||xe_scratch[at+14u]!=xq_values[dest+1u]||xe_scratch[at+15u]!=xe_step.field){xe_poison(output);return false;}
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
// Steps 1/2 read unsigned N-limb mass units with exponent zero and
// denominator one. For original R >= 4*N+27 layouts, normalization has no
// error path: it only removes a bounded power of two. Store the exact full
// scalar directly; signed/error-bearing/nonunit-denominator packets below
// still use the original general rational normalization.
const massNormalization = /* wgsl */ `
fn xe_mass_unit_word(output:u32,row:u32,packet:u32,kind:u32,step:u32,index:u32)->u32{
 if(step==1u){return xq_values[output*XE_Q+16u+index];}
 if(kind==2u){return xq_packet[packet+12u+index];}
 return xq_inventory[xq_params.inventory_offset+row*XE_N+index];
}
fn xe_normalize_mass_to_slot(output:u32,row:u32,packet:u32,kind:u32,step:u32,slot:u32){
 var found=false;var trailing=0u;
 for(var i=0u;i<XE_N;i++){
  let word=xe_mass_unit_word(output,row,packet,kind,step,i);
  if(word!=0u){trailing=i*32u+countTrailingZeros(word);found=true;break;}
 }
 let at=output*XE_SCRATCH+16u+slot*XE_SCALAR;
 xe_scratch[at]=0u;xe_scratch[at+1u]=0u;xe_scratch[at+2u]=trailing;xe_scratch[at+3u]=0u;
 let whole=trailing/32u;let part=trailing%32u;
 for(var i=0u;i<XE_R;i++){
  var word=0u;
  if(found&&i<XE_N-whole){
   let index=i+whole;word=xe_mass_unit_word(output,row,packet,kind,step,index)>>part;
   if(part!=0u&&index+1u<XE_N){word|=xe_mass_unit_word(output,row,packet,kind,step,index+1u)<<(32u-part);}
  }
  xe_scratch[at+4u+i]=word;xe_scratch[at+4u+XE_R+i]=select(0u,1u,i==0u);
 }
}
`;
function begin(){return /* wgsl */ `
@compute @workgroup_size(1)
fn materialize_exact_placement_primitive_begin(@builtin(global_invocation_id) id:vec3<u32>){
 let output=id.x;if(output>=2u*xq_params.count+xq_params.capacity){return;}
 let dest=output*XE_Q;let at=output*XE_SCRATCH;let field=xe_step.field;
 if(xe_step.expected!=0u||!xe_main_ready(output)){xe_poison(output);return;}
 if(field==0u){
  var dirty=false;for(var i=0u;i<XE_SCRATCH;i++){dirty=dirty||xe_scratch[at+i]!=0u;}
  if(dirty){xe_poison(output);return;}
 }else{
  let previous=xe_stage_count(field-1u);let result=at+16u+3u*XE_SCALAR;
  if(xe_scratch[at]!=XE_MAGIC||xe_scratch[at+1u]!=${VERSION}u||xe_scratch[at+2u]!=previous
    ||xe_scratch[at+3u]!=(1u<<previous)-1u||xe_scratch[at+4u]!=0u||!xe_identity(output)
    ||xe_scratch[at+15u]!=field-1u
    ||xq_values[dest+1u]!=(xe_scratch[at+14u]|xe_scratch[result+1u])){xe_poison(output);return;}
 }
 // Reuse follows authenticated prior-field completion; main sticky error is
 // retained, so subsequent fields become canonical zero after any field error.
 for(var i=0u;i<XE_SCRATCH;i++){xe_scratch[at+i]=0u;}
 for(var slot=0u;slot<6u;slot++){xe_scratch[at+16u+slot*XE_SCALAR+4u+XE_R]=1u;}
 xe_scratch[at]=XE_MAGIC;xe_scratch[at+1u]=${VERSION}u;xe_scratch[at+2u]=1u;xe_scratch[at+3u]=1u;
 xe_scratch[at+5u]=xq_values[dest+11u];xe_scratch[at+6u]=xq_values[dest+5u];xe_scratch[at+7u]=xq_values[dest+6u];
 xe_scratch[at+8u]=xq_values[dest+7u];xe_scratch[at+9u]=xq_values[dest+8u];
 xe_scratch[at+10u]=output;xe_scratch[at+11u]=XE_N;xe_scratch[at+12u]=XE_R;
 xe_scratch[at+13u]=XE_QUANTUM_BITS;xe_scratch[at+14u]=xq_values[dest+1u];xe_scratch[at+15u]=field;
}
`;}
function finish(){return /* wgsl */ `
@compute @workgroup_size(1)
fn materialize_exact_placement_primitive_finish(@builtin(global_invocation_id) id:vec3<u32>){
 let output=id.x;if(output>=2u*xq_params.count+xq_params.capacity){return;}
 if(xe_step.expected+1u!=xe_step.stage_count||!xe_guard(output)){xe_poison(output);return;}
 let dest=output*XE_Q;let source=output*XE_SCRATCH+16u+3u*XE_SCALAR;
 let field=xe_step.field;let at=dest+XE_OFFSET+field*XE_SCALAR;
 for(var i=0u;i<XE_SCALAR;i++){xq_values[at+i]=xe_scratch[source+i];}
 xq_values[dest+1u]|=xe_scratch[source+1u];
 xq_values[dest+13u]=field+1u;xq_values[dest+14u]=(1u<<(field+1u))-1u;
 xe_advance(output);
}
`;}
// Select raw operands/slots first. Each arithmetic entry point below reaches
// exactly one public XR operation call site, shared across all seven fields.
function operationBody(format,operation,normalizeMassDirect=false,carried=false){
 const ee=format.wordCount+18,ec=3*format.wordCount+26;
 if(operation==='normalize')return /* wgsl */ `
${normalizeMassDirect ? /* wgsl */ ` if(step==1u||step==2u){
  let execute=step==1u||kind!=2u||field<=3u;
  if(execute){xe_normalize_mass_to_slot(output,row,packet,kind,step,select(1u,3u,step==2u));}
 }else{
 var value=xr_zero();var target_slot=1u;var execute=true;
` : /* wgsl */ ` var value=xr_zero();var target_slot=1u;var execute=true;
 if(step==1u){for(var i=0u;i<XE_N;i++){value.numerator[i]=xq_values[dest+16u+i];}}
 if(step==2u){target_slot=3u;execute=kind!=2u||field<=3u;
  if(execute){for(var i=0u;i<XE_N;i++){
   if(kind==2u){value.numerator[i]=xq_packet[packet+12u+i];}
   else{value.numerator[i]=xq_inventory[xq_params.inventory_offset+row*XE_N+i];}
  }}
 }
`} if(field<3u&&step==7u){target_slot=5u;execute=kind==2u;
  if(execute){${carried ? 'let at=packet+xq_params.extensive_offset+4u+field*XE_SCALAR; value=xe_packet_scalar(at);' : `let at=packet+xq_params.extensive_offset+4u+field*${ee+2}u;
   value.negative=xq_packet[at];value.error=xq_packet[at+1u];value.exponent=${format.quantumExponent-299};
   for(var i=0u;i<${ee}u;i++){value.numerator[i]=xq_packet[at+2u+i];}`}
  }
 }
 if(field==3u&&step==19u){target_slot=5u;execute=kind==2u;
  if(execute){${carried ? 'let at=packet+xq_params.extensive_offset+4u+10u*XE_SCALAR; value=xe_packet_scalar(at);' : `let at=packet+xq_params.extensive_offset+4u+10u*${ee+2}u;
   value.negative=xq_packet[at];value.error=xq_packet[at+1u];value.exponent=${format.quantumExponent-299};
   for(var i=0u;i<${ee}u;i++){value.numerator[i]=xq_packet[at+2u+i];}`}
  }
 }
 if(field==3u&&step==20u){execute=kind==2u;
  if(execute){${carried ? 'let at=packet+xq_params.energy_offset+8u+XE_SCALAR; value=xe_packet_scalar(at);' : `let energy=packet+xq_params.energy_offset;let at=energy+${8+ec+2}u;
   let denominator=packet+xq_params.caloric_offset+${16+ec+2}u;
   value.negative=xq_packet[at];value.error=xq_packet[at+1u]|xq_packet[denominator+1u];
   if(xq_packet[denominator]!=0u){value.error|=8192u;}
   value.exponent=bitcast<i32>(xq_packet[energy+3u]);
   for(var i=0u;i<${ec}u;i++){value.numerator[i]=xq_packet[at+2u+i];value.denominator[i]=xq_packet[denominator+2u+i];}`}
  }
 }
 if(execute){let normalized=xr_normalize(value);xe_store(output,target_slot,normalized);}
${normalizeMassDirect ? ' }\n' : ''}`;
 if(operation==='from_f32')return /* wgsl */ `
 var bits=0u;var target_slot=0u;var execute=true;
 if(field==3u){
  if(step==5u){
   if(kind==2u){let state=packet+xq_params.caloric_offset+xq_params.product_offset
     +(2u*xq_params.product_capacity+ordinal-2u)*8u;bits=xq_packet[state+4u];}
   else{bits=xq_original[row*52u+7u];}
  }else{target_slot=1u;execute=kind!=2u;if(execute){bits=xq_original[row*52u+4u+(step-6u)/4u];}}
 }else if(field<3u){execute=kind!=2u;if(execute){bits=xq_original[row*52u+4u+field];}}
 else if(field==6u){target_slot=3u;execute=kind!=2u;if(execute){bits=xq_original[row*52u+51u];}}
 else if(field==5u&&step==6u){target_slot=5u;execute=kind!=2u;if(execute){bits=xq_original[row*52u+38u];}}
 else{
  if(kind==2u){let state=packet+xq_params.caloric_offset+xq_params.product_offset
    +(2u*xq_params.product_capacity+ordinal-2u)*8u;bits=xq_packet[state+5u];}
  else{bits=xq_original[row*52u+39u];if(field==4u){target_slot=3u;}}
 }
 if(execute){let value=xr_from_f32_bits(bits);xe_store(output,target_slot,value);}
`;
 if(operation==='scale')return /* wgsl */ `
 var source_slot=5u;var target_slot=5u;var exponent=-1;var execute=kind!=2u;
 if(step==3u){source_slot=select(3u,1u,kind==2u);target_slot=2u;exponent=${format.quantumExponent};
  execute=field>=3u||kind!=2u;if(field==6u&&kind==2u){target_slot=3u;}
 }
 if(execute){let source=xe_load(output,source_slot);let value=xr_scale_pow2(source,exponent);xe_store(output,target_slot,value);}
`;
 if(operation==='divide')return /* wgsl */ `
 var left_slot=1u;var right_slot=3u;var target_slot=4u;
 var execute=kind==1u||(kind==2u&&field<=3u);
 if(step!=4u){left_slot=2u;right_slot=0u;target_slot=3u;execute=kind==2u;}
 if(execute){let left=xe_load(output,left_slot);let right=xe_load(output,right_slot);
  let value=xr_divide(left,right);xe_store(output,target_slot,value);}
`;
 if(operation==='multiply')return /* wgsl */ `
 var left_slot=1u;var right_slot=1u;var target_slot=5u;var execute=false;
 if(field==3u){execute=kind!=2u;
  if(step==18u){left_slot=2u;right_slot=0u;target_slot=3u;execute=true;}
  if(step==22u){left_slot=4u;right_slot=5u;target_slot=1u;execute=kind==2u;}
  if(step==24u){left_slot=3u;right_slot=4u;target_slot=3u;execute=kind==1u;}
 }else{
  target_slot=3u;left_slot=3u;right_slot=4u;execute=kind==1u;
  if(field<3u&&step==6u){left_slot=2u;right_slot=0u;execute=kind!=2u;}
  if(field<3u&&step==8u){left_slot=4u;right_slot=5u;execute=kind==2u;}
  if(field==5u&&step==7u){left_slot=0u;right_slot=5u;execute=kind!=2u;}
 }
 ${carried ? 'if(kind<2u){execute=kind==1u&&step+2u==xe_step.stage_count;left_slot=3u;right_slot=4u;target_slot=3u;}' : ''}
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
 throw RangeError('Unknown exact primitive operation');
}
export function createSphExactPlacementQuantityPrimitivesWgsl(format,layout,operation,{carriedSourceLayout=null}={}){
 const scratch=sphExactPlacementQuantityPrimitivesScratchLayout(format,layout);
 if(!operations.includes(operation))throw RangeError('Unknown exact primitive operation');
 const declaration=header(format,layout,scratch)+`\nconst XE_QUANTUM_BITS:u32=${format.quantumExponent>>>0}u;\n`;
 if(operation==='begin')return declaration+begin();
 if(operation==='finish')return declaration+finish();
 const allowed=SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES.filter(s=>s.operation===operation);
 const normalizeMassDirect=layout.scalar.wordCount>=format.wordCount;
 const carriedHeader=carriedSourceLayout?/* wgsl */ `
@group(0) @binding(11) var<storage,read> xe_carried:array<u32>;
fn xe_packet_scalar(at:u32)->ExactRational{
 var value=xr_zero();value.negative=xq_packet[at];value.error=xq_packet[at+1u];
 value.exponent=bitcast<i32>(xq_packet[at+2u]);value.reserved=xq_packet[at+3u];
 for(var i=0u;i<XE_R;i++){value.numerator[i]=xq_packet[at+4u+i];value.denominator[i]=xq_packet[at+4u+XE_R+i];}
 return value;
}
`:'';
 const carriedOperation=operation==='normalize'?`
 if(step==1u||step==2u){xe_normalize_mass_to_slot(output,row,packet,kind,step,select(1u,3u,step==2u));}
 `:operation==='from_f32'?`
 if(step==5u){
  let source=row*${carriedSourceLayout?.recordWords??0}u+${carriedSourceLayout?.scalarOffsetWords??0}u+field*XE_SCALAR;
  let destination=output*XE_SCRATCH+16u+3u*XE_SCALAR;
  for(var i=0u;i<XE_SCALAR;i++){xe_scratch[destination+i]=xe_carried[source+i];}
 }
 `:operation==='divide'?`
 if(kind==1u&&step==4u){let left=xe_load(output,1u);let right=xe_load(output,3u);
  let value=xr_divide(left,right);xe_store(output,4u,value);}
 `:operation==='multiply'?`
 if(kind==1u&&step+2u==xe_step.stage_count){let left=xe_load(output,3u);let right=xe_load(output,4u);
  let value=xr_multiply(left,right);xe_store(output,3u,value);}
 `:'';
 return createSphExactRationalQuantityWgsl({wordCount:layout.scalar.wordCount})+declaration+scratchAccess+carriedHeader
  +(operation==='normalize'&&normalizeMassDirect?massNormalization:'')+/* wgsl */ `
@compute @workgroup_size(1)
fn materialize_exact_placement_primitive_${operation}(@builtin(global_invocation_id) id:vec3<u32>){
 let output=id.x;if(output>=2u*xq_params.count+xq_params.capacity){return;}
 let step=xe_step.expected;let field=xe_step.field;
 if(!(${allowed.map(s=>`(field==${s.field}u&&step==${s.step}u)`).join('||')})||!xe_guard(output)){xe_poison(output);return;}
 let scratch=output*XE_SCRATCH;let dest=output*XE_Q;
 if(xe_scratch[scratch+5u]!=0u&&xe_scratch[scratch+14u]==0u){
  let kind=xe_scratch[scratch+6u];let row=xe_scratch[scratch+7u];
  let packet=xe_scratch[scratch+8u]*xq_params.packet_words;let ordinal=xe_scratch[scratch+9u];
${carriedSourceLayout && !['multiply','divide'].includes(operation)?`if(kind<2u){${carriedOperation}}else{${operationBody(format,operation,normalizeMassDirect,true)}}`:operationBody(format,operation,normalizeMassDirect,!!carriedSourceLayout)}
 }
 xe_advance(output);
}
`;
}
export function sphExactPlacementQuantityPrimitivesPipelineDescriptors(format,layout,options={}){
 const carried=!!options.carriedSourceLayout;
 const code=new Map(operations.map(op=>[op,createSphExactPlacementQuantityPrimitivesWgsl(format,layout,op,options)]));
 const stages=SPH_EXACT_PLACEMENT_PRIMITIVE_STAGES.map((s,index)=>Object.freeze({...s,index,stage:'primitive',
  label:`ulg-exact-placement-primitive-${s.operation}`,entryPoint:`materialize_exact_placement_primitive_${s.operation}`,
  cacheKey:`ulg-exact-placement-primitives-${carried?'carried-v1':s.operation==='normalize'&&layout.scalar.wordCount>=format.wordCount?'v2':'v1'}-${format.wordCount}-${format.quantumExponent}-${layout.scalar.wordCount}-${s.operation}`,
  code:code.get(s.operation),bindings:Object.freeze([...Array(7).fill('read-only-storage'),'storage','uniform','storage','uniform',...(carried?['read-only-storage']:[])])}));
 const original=sphExactPlacementQuantityStagedPipelineDescriptors(format,layout);
 const initialize=carried?{...original[0],cacheKey:original[0].cacheKey+'-carried-v2',
  code:createSphExactPlacementQuantityStagedWgsl(format,layout,original[0],options),carriedBinding:true}:original[0];
 // Pack independent rows into full warps for both cold and carried sources.
 // One invocation per workgroup also stalls the cold initializer when the
 // same native reaction pipeline is reused after a rejected outer step.
 // Row arithmetic and the out-of-range invocation guards are unchanged.
 return Object.freeze([initialize,...stages,original.at(-1)].map(stage=>Object.freeze({...stage,
  workgroupSize:32,cacheKey:stage.cacheKey+(carried?'-carried-wg32':'-wg32'),
  code:stage.code.replaceAll('@workgroup_size(1)','@workgroup_size(32)')})));
}
