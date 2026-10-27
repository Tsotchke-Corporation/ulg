import {createSphExactMassWgsl} from './sphExactMassWgsl.js';
import {sphReactionProductPlacementEventApplyWgsl as originalEventApply} from '../../../ulg-gpu-abi/src/sphReactionProductPlacementSegmentedWgsl.js';
import {SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as RI,SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS as RW,
 SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS as FLAGS} from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
const checked=(v,label)=>{if(!Number.isSafeInteger(v)||v<1||v>0x3fffffff)throw new RangeError(`Exact event ${label} exceeds checked addressing`);return v;};
export function sphExactPlacementEventDispositionLayout(format,quantityLayout,{physicalLayout,captureLayout,outputLayout}={}){
 const p=checked(quantityLayout.particleCount,'particles'),e=checked(quantityLayout.eventCapacity,'events'),n=format.wordCount;
 if(quantityLayout.currentRowOffset!==0||quantityLayout.eventRowOffset!==p||quantityLayout.rowCount!==p+e
   ||quantityLayout.massWordCount!==n||outputLayout.particleCount!==p||outputLayout.denseEventCount!==e
   ||outputLayout.eventParticleStrideWords!==64||outputLayout.pairHeaderWords!==16
   ||physicalLayout.particleCount!==p||captureLayout.particleCount!==p||captureLayout.eventCapacity!==e)
  throw new TypeError('Original persistent quantity, product-template and physical-capture layouts required');
 const slotOffset=16,inverseOffset=slotOffset+2*p,eventOffset=inverseOffset+2*e,eventStride=16;
 const levels=Math.ceil(Math.log2(e)),scanCountOffset=eventOffset+e*eventStride;
 const scratchWords=checked(scanCountOffset+levels+3,'control'),companionWords=8+3*n;
 const historyStride=checked(1+quantityLayout.recordWords+32+companionWords,'history record');
 return Object.freeze({particleCount:p,eventCapacity:e,massWordCount:n,quantity:quantityLayout,physical:physicalLayout,capture:captureLayout,output:outputLayout,
  slotOffset,inverseOffset,eventOffset,eventStride,scratchWords,scanCountOffset,companionWords,historyStride,
  historyWords:checked(e*historyStride,'history scratch'),prefixWords:checked(e*4,'prefix'),levels,
  requiredStorageBindings:9});
}
const storage=(i,name,write=false,atomic=false)=>`@group(0) @binding(${i}) var<storage,${write?'read_write':'read'}> ${name}: array<${atomic?'atomic<u32>':'u32'}>;\n`;
const uniform=(i)=>`struct ExactEventParams {stride:u32,level:u32,reserved0:u32,reserved1:u32}\n@group(0) @binding(${i}) var<uniform> ed_params:ExactEventParams;\n`;
function common(l){return /* wgsl */ `
const ED_P:u32=${l.particleCount}u;const ED_E:u32=${l.eventCapacity}u;const ED_N:u32=${l.massWordCount}u;
const ED_Q:u32=${l.quantity.recordWords}u;const ED_C:u32=${l.companionWords}u;const ED_BAD:u32=8192u;const ED_INVALID:u32=0xffffffffu;
fn ed_flat(id:vec3<u32>,groups:vec3<u32>)->u32{return id.x+id.y*groups.x;}
fn ed_row(e:u32)->u32{return ${l.eventOffset}u+e*16u;}
fn ed_slot(p:u32)->u32{return ${l.slotOffset}u+p*2u;}
fn ed_inverse(e:u32)->u32{return ${l.inverseOffset}u+e*2u;}
fn ed_fail(error:u32){atomicOr(&ed_scratch[7u],error|ED_BAD);atomicOr(&ed_receipt[${RI.overflowFlags}u],${FLAGS.CONSERVATION_MOMENT}u);}
fn ed_pass(at:u32){if(atomicAdd(&ed_scratch[at],1u)!=0u){ed_fail(ED_BAD);}}
fn ed_positive(bits:u32)->bool{return bits>0u&&bits<0x7f800000u;}
fn ed_index(bits:u32)->u32{
 if((bits&0x80000000u)!=0u||bits>=0x4f800000u){return ED_INVALID;}
 let value=u32(bitcast<f32>(bits));if(bitcast<u32>(f32(value))!=bits){return ED_INVALID;}return value;
}
`}
function quantity(l){return /* wgsl */ `
fn ed_mass_live(at:u32)->bool{var v=0u;for(var i=0u;i<ED_N;i++){v|=ed_quantities[at+16u+i];}return v!=0u;}
fn ed_quantity_error(at:u32,has_mass:bool)->u32{
 var error=ed_quantities[at+1u];
 if(ed_quantities[at]!=1u||ed_quantities[at+9u]!=ED_N||ed_quantities[at+10u]!=${l.quantity.scalar.wordCount}u
   ||ed_quantities[at+11u]!=select(0u,1u,has_mass)||ed_mass_live(at)!=has_mass){error|=ED_BAD;}
 for(var i=12u;i<16u;i++){error|=ed_quantities[at+i];}
 for(var f=0u;f<7u;f++){
  let s=at+${l.quantity.scalarOffsetWords}u+f*${l.quantity.scalar.recordWords}u;
  var numerator=0u;var denominator=0u;
  for(var i=0u;i<${l.quantity.scalar.wordCount}u;i++){numerator|=ed_quantities[s+4u+i];denominator|=ed_quantities[s+4u+${l.quantity.scalar.wordCount}u+i];}
  if(ed_quantities[s]>1u||ed_quantities[s+1u]!=0u||ed_quantities[s+3u]!=0u||denominator==0u){error|=ED_BAD;}
  if(numerator==0u){
   if(ed_quantities[s]!=0u||ed_quantities[s+2u]!=0u||ed_quantities[s+4u+${l.quantity.scalar.wordCount}u]!=1u){error|=ED_BAD;}
   for(var i=1u;i<${l.quantity.scalar.wordCount}u;i++){error|=ed_quantities[s+4u+${l.quantity.scalar.wordCount}u+i];}
  }else if((ed_quantities[s+4u]&1u)==0u||(ed_quantities[s+4u+${l.quantity.scalar.wordCount}u]&1u)==0u){error|=ED_BAD;}
  if(!has_mass&&numerator!=0u){error|=ED_BAD;}
 }
 return error;
}
`}
const entry=(name,body)=>`@compute @workgroup_size(1)\nfn ${name}(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>){\n${body}\n}\n`;
export function createSphExactPlacementEventDispositionWgsl(format,l){
 const results={};
 const core=(bindings,extra='')=>bindings+common(l)+extra;
 results.initialize=core(storage(0,'ed_count')+storage(1,'ed_scratch',true,true)+storage(2,'ed_receipt',true,true))+entry('initialize_exact_event_disposition',`
 let i=ed_flat(id,groups);if(i>=max(ED_P,ED_E)){return;}
 if(i==0u){ed_pass(2u);atomicStore(&ed_scratch[0u],0x58454431u);atomicStore(&ed_scratch[1u],1u);
  atomicStore(&ed_scratch[8u],ED_E);atomicStore(&ed_scratch[9u],ED_P);atomicStore(&ed_scratch[10u],ed_count[0u]);atomicStore(&ed_scratch[11u],ed_count[1u]);
  if(ed_count[0u]>ED_E||ed_count[1u]!=0u){ed_fail(ED_BAD);}}
 if(i<ED_P){let at=ed_slot(i);atomicStore(&ed_scratch[at],0u);atomicStore(&ed_scratch[at+1u],ED_INVALID);}
 if(i<ED_E){let at=ed_row(i);if(atomicLoad(&ed_scratch[at])!=0u){ed_fail(ED_BAD);return;}
  atomicStore(&ed_scratch[at],1u);let inv=ed_inverse(i);atomicStore(&ed_scratch[inv],0u);atomicStore(&ed_scratch[inv+1u],ED_INVALID);}
 `);
 results.index=core(storage(0,'ed_sorted')+storage(1,'ed_scratch',true,true)+storage(2,'ed_receipt',true,true))+entry('index_original_exact_event_sort',`
 let position=ed_flat(id,groups);if(position>=ED_E){return;}if(position==0u){ed_pass(12u);}
 let event=ed_sorted[position];if(event>=ED_E){ed_fail(ED_BAD);return;}
 let at=ed_inverse(event);if(atomicAdd(&ed_scratch[at],1u)!=0u){ed_fail(ED_BAD);}atomicMin(&ed_scratch[at+1u],position);
 `);
 const prepareBindings=storage(0,'ed_events')+storage(1,'ed_plan')+storage(2,'ed_quantities')+storage(3,'ed_companions')+storage(4,'ed_aux')+
  storage(5,'ed_count')+storage(6,'ed_scratch',true,true)+storage(7,'ed_receipt',true,true);
 results.prepare=createSphExactMassWgsl(format)+core(prepareBindings,quantity(l))+entry('prepare_exact_event_dispositions',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}if(event==0u){ed_pass(3u);}
 let at=ed_row(event);if(atomicLoad(&ed_scratch[at])!=1u){ed_fail(ED_BAD);return;}
 if(event>=ed_count[0u]){atomicStore(&ed_scratch[at+2u],event);atomicStore(&ed_scratch[at],4u);return;}
 var error=0u;let q=(ED_P+event)*ED_Q;let c=event*ED_C;let plan=event*8u;
 let pair=ed_companions[c];let ordinal=ed_companions[c+2u];let term=ed_companions[c+1u];
 var selected=0u;var direct=0u;var residual=0u;var carry=0u;
 for(var i=0u;i<ED_N;i++){
  let a=ed_companions[c+8u+ED_N+i];let b=ed_companions[c+8u+2u*ED_N+i];let first=a+b;let sum=first+carry;
  carry=select(0u,1u,first<a||sum<first);if(sum!=ed_companions[c+8u+i]){error|=ED_BAD;}
  selected|=ed_companions[c+8u+i];direct|=a;residual|=b;if(b!=ed_quantities[q+16u+i]){error|=ED_BAD;}}
 error|=carry;let live=residual!=0u;error|=ed_quantity_error(q,live);
 if(ed_companions[c+4u]!=1u||ed_companions[c+5u]!=1u||ed_companions[c+6u]!=0u||ed_companions[c+7u]!=0u||selected==0u
  ||pair>=ED_P||ordinal<2u||ordinal>=${l.output.productCapacity+2}u||ed_quantities[q+5u]!=2u||ed_quantities[q+6u]!=event
  ||ed_quantities[q+7u]!=pair||ed_quantities[q+8u]!=ordinal||ed_quantities[q+2u]!=ed_companions[c+3u]
  ||ed_index(ed_events[event*32u+5u])!=term||ed_index(ed_events[event*32u+4u])!=ed_quantities[q+2u]
  ||ed_index(ed_events[event*32u+11u])!=ed_quantities[q+3u]||ed_events[event*32u+15u]!=ed_quantities[q+4u]
  ||ed_aux[pair*16u]!=1u||ed_aux[pair*16u+1u]!=0u){error|=ED_BAD;}
 let disposition=ed_index(ed_plan[plan+4u]);var slot=ED_INVALID;
 if(disposition!=2u&&disposition!=3u&&disposition!=4u&&disposition!=6u&&disposition!=7u&&disposition!=8u){error|=ED_BAD;}
 if((disposition==2u&&live)||((disposition==3u||disposition==4u||disposition==6u||disposition==7u)&&!live)){error|=ED_BAD;}
 if(disposition==3u){
  slot=ed_index(ed_plan[plan+6u]);if(slot>=ED_P){error|=ED_BAD;}else{
   error|=ed_quantity_error(slot*ED_Q,false);if(ed_quantities[slot*ED_Q+6u]!=slot){error|=ED_BAD;}}
 }
 // Every live product retains the original physical template, including a
 // residual too small for placement. Validate its identity before the shared
 // terminal decision, so a malformed template rolls back the whole tuple.
 if(live){
  let t=${l.output.eventParticleOffsetWords}u+(pair*${l.output.productCapacity}u+ordinal-2u)*64u;
  if(ed_aux[t]!=1u||ed_aux[t+1u]!=0u||ed_aux[t+2u]!=pair||ed_aux[t+3u]!=ordinal||ed_aux[t+4u]!=term
   ||ed_aux[t+5u]!=ed_quantities[q+2u]||ed_aux[t+6u]!=ed_quantities[q+3u]||ed_aux[t+7u]!=ed_quantities[q+4u]
   ||ed_aux[t+8u]!=ED_N||ed_aux[t+9u]!=1u||ed_aux[t+10u]!=0u||ed_aux[t+11u]!=0u){error|=ED_BAD;}
  var mass=ExactMass();for(var i=0u;i<ED_N;i++){mass.words[i]=ed_quantities[q+16u+i];}
  let projected=em_project_f32_bits(mass);error|=projected.error;
  if(projected.bits!=ed_aux[t+15u]||!ed_positive(projected.bits)||!ed_positive(ed_aux[t+29u])
    ||!ed_positive(ed_aux[t+51u])||ed_aux[t+63u]!=projected.bits){error|=ED_BAD;}
  if(disposition==3u&&!ed_positive(ed_plan[plan+7u])){error|=ED_BAD;}
  for(var i=0u;i<52u;i++){if((ed_aux[t+12u+i]&0x7f800000u)==0x7f800000u){error|=ED_BAD;}}
 }
 if(disposition==4u){slot=ed_index(ed_plan[plan+5u]);if(slot>=ED_P){error|=ED_BAD;}}
 atomicStore(&ed_scratch[at+2u],event);atomicStore(&ed_scratch[at+3u],disposition);atomicStore(&ed_scratch[at+4u],slot);
 atomicStore(&ed_scratch[at+5u],pair);atomicStore(&ed_scratch[at+6u],ordinal);atomicStore(&ed_scratch[at+7u],term);
 atomicStore(&ed_scratch[at+8u],ed_quantities[q+2u]);atomicStore(&ed_scratch[at+9u],ed_quantities[q+3u]);atomicStore(&ed_scratch[at+10u],ed_quantities[q+4u]);
 atomicStore(&ed_scratch[at+11u],select(0u,1u,live));
 if(error!=0u){atomicStore(&ed_scratch[at+1u],error);atomicStore(&ed_scratch[at],3u);ed_fail(error);return;}
 if(disposition==3u){let claim=ed_slot(slot);atomicAdd(&ed_scratch[claim],1u);atomicMin(&ed_scratch[claim+1u],event);}
 atomicStore(&ed_scratch[at],4u);
 `);
 const spareBindings=storage(0,'ed_plan')+storage(1,'ed_quantities',true)+storage(2,'ed_aux')+storage(3,'ed_scratch',true,true)+storage(4,'ed_state',true)+
  storage(5,'ed_thermo',true)+storage(6,'ed_mechanics',true)+storage(7,'ed_receipt',true,true)+storage(8,'ed_count');
 results.spare=core(spareBindings,quantity(l))+entry('commit_exact_event_spare_particles',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}if(event==0u){ed_pass(4u);}if(event>=ed_count[0u]){return;}
 let at=ed_row(event);if(atomicLoad(&ed_scratch[at+3u])!=3u){return;}
 let slot=atomicLoad(&ed_scratch[at+4u]);
 if(atomicLoad(&ed_scratch[at])!=4u||atomicLoad(&ed_scratch[at+1u])!=0u||slot>=ED_P){ed_fail(ED_BAD);return;}
 let claim=ed_slot(slot);if(atomicLoad(&ed_scratch[claim])!=1u||atomicLoad(&ed_scratch[claim+1u])!=event){ed_fail(ED_BAD);return;}
 let source=(ED_P+event)*ED_Q;var error=ed_quantity_error(source,true)|ed_quantity_error(slot*ED_Q,false);
 if(error!=0u){ed_fail(error);return;}
 let pair=atomicLoad(&ed_scratch[at+5u]);let ordinal=atomicLoad(&ed_scratch[at+6u]);
 let t=${l.output.eventParticleOffsetWords}u+(pair*${l.output.productCapacity}u+ordinal-2u)*64u+12u;
 for(var i=0u;i<8u;i++){ed_state[slot*8u+i]=ed_aux[t+i];}
 for(var i=0u;i<12u;i++){ed_thermo[slot*12u+i]=ed_aux[t+8u+i];}
 for(var i=0u;i<32u;i++){ed_mechanics[slot*32u+i]=ed_aux[t+20u+i];}
 for(var axis=0u;axis<3u;axis++){ed_state[slot*8u+axis]=ed_plan[event*8u+axis];}
 ed_thermo[slot*12u+8u]=ed_plan[event*8u+7u];ed_thermo[slot*12u+11u]=ed_plan[event*8u+7u];
 for(var i=0u;i<ED_Q;i++){ed_quantities[slot*ED_Q+i]=ed_quantities[source+i];}
 ed_quantities[slot*ED_Q+6u]=slot;
 for(var i=0u;i<ED_Q;i++){ed_quantities[source+i]=0u;}
 atomicStore(&ed_scratch[at],5u);
 `);
 const captureBindings=storage(0,'ed_quantities',true)+storage(1,'ed_scratch',true,true)+storage(2,'ed_keys')+storage(3,'ed_sorted')+storage(4,'ed_map')+
  storage(5,'ed_reduced')+storage(6,'ed_physical')+storage(7,'ed_receipt',true,true)+storage(8,'ed_count');
 results.capture=core(captureBindings,quantity(l))+entry('retire_exact_captured_event_residuals',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}if(event==0u){ed_pass(5u);}if(event>=ed_count[0u]){return;}
 let at=ed_row(event);if(atomicLoad(&ed_scratch[at+3u])!=4u){return;}
 let receiver=atomicLoad(&ed_scratch[at+4u]);
 if(atomicLoad(&ed_scratch[at])!=4u||atomicLoad(&ed_scratch[at+1u])!=0u||receiver>=ED_P||ed_keys[event]!=receiver){ed_fail(ED_BAD);return;}
 let physical=receiver*${l.physical.evidenceRecordWords}u;let tail=ed_physical[physical+5u];let inv=ed_inverse(event);let position=atomicLoad(&ed_scratch[inv+1u]);
 if(ed_physical[physical]!=0x58504131u||ed_physical[physical+1u]!=1u||ed_physical[physical+2u]!=2u||ed_physical[physical+3u]!=0u
  ||ed_physical[physical+4u]!=receiver||ed_physical[physical+6u]!=4u||ed_physical[physical+7u]!=0u
  ||tail>=ED_E||position>=ED_E||atomicLoad(&ed_scratch[inv])!=1u){ed_fail(ED_BAD);return;}
 let reduced=tail*${l.capture.recordWords}u;let start=ed_reduced[reduced+8u];let end=ed_reduced[reduced+9u];
 if(ed_sorted[tail]>=ED_E||start>tail||(start>0u&&ed_sorted[start-1u]>=ED_E)||(tail+1u<ED_E&&ed_sorted[tail+1u]>=ED_E)){ed_fail(ED_BAD);return;}
 if(ed_map[tail]!=receiver||ed_sorted[position]!=event||position<start||position>end||end!=tail
  ||ed_reduced[reduced]!=1u||ed_reduced[reduced+1u]!=0u||ed_reduced[reduced+2u]!=receiver
  ||start>end||ed_reduced[reduced+3u]!=end-start+1u||ed_keys[ed_sorted[tail]]!=receiver
  ||(start>0u&&ed_keys[ed_sorted[start-1u]]==receiver)||(tail+1u<ED_E&&ed_keys[ed_sorted[tail+1u]]==receiver)){ed_fail(ED_BAD);return;}
 let source=(ED_P+event)*ED_Q;var error=ed_quantity_error(source,true)|ed_quantity_error(receiver*ED_Q,true);
 if(ed_quantities[receiver*ED_Q+5u]!=4u||ed_quantities[receiver*ED_Q+6u]!=receiver){error|=ED_BAD;}
 for(var i=2u;i<5u;i++){if(ed_quantities[source+i]!=ed_quantities[receiver*ED_Q+i]){error|=ED_BAD;}}
 if(error!=0u){ed_fail(error);return;}
 for(var i=0u;i<ED_Q;i++){ed_quantities[source+i]=0u;}atomicStore(&ed_scratch[at+12u],tail);atomicStore(&ed_scratch[at],6u);
 `);
 results.finish=core(storage(0,'ed_scratch',true,true)+storage(1,'ed_receipt',true,true)+storage(2,'ed_count'))+entry('finish_exact_event_dispositions',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}if(event==0u){ed_pass(6u);}
 let at=ed_row(event);let disposition=atomicLoad(&ed_scratch[at+3u]);let stage=atomicLoad(&ed_scratch[at]);
 let required=select(select(4u,5u,disposition==3u),6u,disposition==4u);
 if(stage!=required||atomicLoad(&ed_scratch[at+1u])!=0u){ed_fail(ED_BAD);return;}
 atomicStore(&ed_scratch[at],2u);
 `);
 return Object.freeze(results);
}

/** Original EventApply diagnostic/event law, with its f32 spare state writes
 * removed. Exact physical/quantity commit is a separate checked stage. This
 * executes BEFORE capture raw apply so its two diagnostic maxima survive. */
export function createSphExactPlacementEventSummaryWgsl(l){
 let code=originalEventApply;
 const replace=(from,to)=>{if(code.split(from).length!==2)throw new Error('Original EventApply extraction changed: '+from.slice(0,60));code=code.replace(from,to);};
 replace('@group(0) @binding(1) var<storage, read_write> next_state: array<vec4<f32>>;',
  '@group(0) @binding(1) var<storage, read_write> ed_outcomes: array<atomic<u32>>;');
 replace('@group(0) @binding(2) var<storage, read_write> next_thermo: array<vec4<f32>>;',
  '@group(0) @binding(2) var<storage, read> ed_companions: array<u32>;');
 replace('@group(0) @binding(3) var<storage, read_write> next_mechanics: array<vec4<f32>>;','');
 const begin=code.indexOf('  let state_base = slot * params.state_stride_vec4;');
 const end=code.indexOf('  summary_values[summary_row(event, 2u)].y = 1.0;',begin);
 if(begin<0||end<begin)throw new Error('Original spare write block missing');
 code=code.slice(0,begin)+'  // Actual exact spare copy follows successful preparation; no f32 mass/volume seed.\n'+code.slice(end);
 const marker='@compute @workgroup_size(64)\nfn apply_unique_events_and_emit_summaries';
 replace(marker,`fn ed_event_live(event:u32,field:u32)->bool{var word=0u;for(var i=0u;i<${l.massWordCount}u;i++){word|=ed_companions[event*${l.companionWords}u+8u+field*${l.massWordCount}u+i];}return word!=0u;}\n`+marker);
 const increment=`  atomicAdd(&receipt[${RI.applyVisitedCount}], 1u);`;
 replace(increment,increment+`\n  let exact_at=${l.eventOffset}u+event*16u;\n  if(atomicLoad(&ed_outcomes[exact_at])!=4u||atomicLoad(&ed_outcomes[exact_at+1u])!=0u){\n    atomicOr(&receipt[${RI.overflowFlags}],${FLAGS.CONSERVATION_MOMENT}u);\n    atomicAdd(&receipt[${RI.rejectedEventCount}],1u);return;}`);
 replace('  let disposition = u32(max(round(plan1.x), 0.0));','  let disposition = atomicLoad(&ed_outcomes[exact_at+3u]);');
 for(const name of['intentEmitPassCount','applyPassCount']){
  replace(`    atomicStore(&receipt[${RI[name]}], 1u);`,
   `    if(atomicAdd(&receipt[${RI[name]}],1u)!=0u){atomicOr(&receipt[${RI.overflowFlags}],${FLAGS.CONSERVATION_MOMENT}u);}`);
 }
 replace('  if (event == 0u) {',`  if (event == 0u) {\n    if(atomicAdd(&ed_outcomes[13u],1u)!=0u){atomicOr(&receipt[${RI.overflowFlags}],${FLAGS.CONSERVATION_MOMENT}u);}`);
 code=code.replaceAll('row0.w > 0.0','ed_event_live(event,0u)').replaceAll('row3.x > 0.0','ed_event_live(event,1u)').replaceAll('row3.y > 0.0','ed_event_live(event,2u)');
 return code;
}
export function createSphExactPlacementResidualHistoryWgsl(l){
 const d=l.historyStride,q=l.quantity.recordWords,c=l.companionWords,e=l.eventCapacity;
 const results={};const core=(bindings,extra='')=>bindings+common(l)+extra;
 results.initialize=core(storage(0,'ed_quantities')+storage(1,'ed_scratch',true,true)+storage(2,'ed_count')+storage(3,'ed_prefix_out',true)+
  storage(4,'ed_receipt',true,true)+storage(5,'ed_history',true),quantity(l))+entry('initialize_exact_residual_history_prefix',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}if(event==0u){ed_pass(14u);}
 let at=ed_row(event);if(atomicLoad(&ed_scratch[at])!=2u){ed_fail(ED_BAD);}
 let source=(ED_P+event)*ED_Q;let keep=event<ed_count[0u]&&ed_mass_live(source);
 if(keep&&ed_quantity_error(source,true)!=0u){ed_fail(ED_BAD);}
 ed_prefix_out[event*4u]=select(0u,1u,keep);ed_prefix_out[event*4u+1u]=event;ed_prefix_out[event*4u+2u]=event;ed_prefix_out[event*4u+3u]=0u;
 for(var i=0u;i<${d}u;i++){ed_history[event*${d}u+i]=0u;}
 `);
 results.reduce=core(storage(0,'ed_prefix_in')+storage(1,'ed_prefix_out',true)+storage(2,'ed_scratch',true,true)+storage(3,'ed_receipt',true,true)+uniform(4))+
 entry('scan_exact_residual_history_prefix',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}
 if(ed_params.level==0u||ed_params.level>${l.levels}u||ed_params.stride!=(1u<<(ed_params.level-1u))||ed_params.reserved0!=0u||ed_params.reserved1!=0u){ed_fail(ED_BAD);return;}
 if(event==0u){ed_pass(${l.scanCountOffset}u+ed_params.level-1u);}
 let at=event*4u;let stride=ed_params.stride;let expected_start=select(0u,event-stride+1u,event+1u>=stride);
 if(ed_prefix_in[at+1u]!=expected_start||ed_prefix_in[at+2u]!=event||ed_prefix_in[at+3u]!=ed_params.level-1u||ed_prefix_in[at]>event-expected_start+1u){ed_fail(ED_BAD);return;}
 var sum=ed_prefix_in[at];var start=expected_start;
 if(event>=stride){let prior=(event-stride)*4u;let prior_start=select(0u,event-2u*stride+1u,event+1u>=2u*stride);
  if(ed_prefix_in[prior+1u]!=prior_start||ed_prefix_in[prior+2u]+1u!=start||ed_prefix_in[prior+3u]!=ed_params.level-1u){ed_fail(ED_BAD);return;}
  sum+=ed_prefix_in[prior];start=prior_start;if(sum>event-start+1u){ed_fail(ED_BAD);return;}}
 ed_prefix_out[at]=sum;ed_prefix_out[at+1u]=start;ed_prefix_out[at+2u]=event;ed_prefix_out[at+3u]=ed_params.level;
 `);
 results.scatter=core(storage(0,'ed_quantities')+storage(1,'ed_events')+storage(2,'ed_companions')+storage(3,'ed_prefix_in')+storage(4,'ed_history',true)+
  storage(5,'ed_scratch',true,true)+storage(6,'ed_receipt',true,true)+storage(7,'ed_count'),quantity(l))+entry('scatter_exact_residual_history',`
 let event=ed_flat(id,groups);if(event>=ED_E){return;}if(event==0u){ed_pass(${l.scanCountOffset+l.levels}u);}
 let prefix=event*4u;if(ed_prefix_in[prefix+1u]!=0u||ed_prefix_in[prefix+2u]!=event||ed_prefix_in[prefix+3u]!=${l.levels}u){ed_fail(ED_BAD);return;}
 let source=(ED_P+event)*ED_Q;let keep=event<ed_count[0u]&&ed_mass_live(source);
 let previous=select(0u,ed_prefix_in[(max(event,1u)-1u)*4u],event>0u);
 if(ed_prefix_in[prefix]!=previous+select(0u,1u,keep)||ed_prefix_in[prefix]>ed_count[0u]){ed_fail(ED_BAD);return;}
 if(!keep){return;}let dense=ed_prefix_in[prefix]-1u;let dest=dense*${d}u;let companion=event*ED_C;
 if(atomicLoad(&ed_scratch[ed_row(event)])!=2u||ed_quantity_error(source,true)!=0u||!ed_positive(ed_events[event*32u+13u])){ed_fail(ED_BAD);return;}
 for(var i=0u;i<ED_N;i++){if(ed_quantities[source+16u+i]!=ed_companions[companion+8u+2u*ED_N+i]){ed_fail(ED_BAD);return;}}
 ed_history[dest]=event;
 for(var i=0u;i<ED_Q;i++){ed_history[dest+1u+i]=ed_quantities[source+i];}ed_history[dest+7u]=dense;
 for(var i=0u;i<32u;i++){ed_history[dest+1u+ED_Q+i]=ed_events[event*32u+i];}
 for(var i=0u;i<ED_C;i++){ed_history[dest+1u+ED_Q+32u+i]=ed_companions[companion+i];}
 `);
 results.publish=core(storage(0,'ed_history')+storage(1,'ed_prefix_in')+storage(2,'ed_quantities',true)+storage(3,'ed_events',true)+storage(4,'ed_companions_out',true)+
  storage(5,'ed_destination_count',true)+storage(6,'ed_scratch',true,true)+storage(7,'ed_receipt',true,true)+storage(8,'ed_count'))+
 entry('publish_exact_pending_residual_history',`
 let dense=ed_flat(id,groups);if(dense>=ED_E){return;}if(dense==0u){ed_pass(15u);}
 let last=(ED_E-1u)*4u;let count=ed_prefix_in[last];
 if(ed_prefix_in[last+1u]!=0u||ed_prefix_in[last+2u]!=ED_E-1u||ed_prefix_in[last+3u]!=${l.levels}u||count>ed_count[0u]){ed_fail(ED_BAD);return;}
 let dest=(ED_P+dense)*ED_Q;let source=dense*${d}u;
 for(var i=0u;i<ED_Q;i++){ed_quantities[dest+i]=select(0u,ed_history[source+1u+i],dense<count);}
 for(var i=0u;i<32u;i++){ed_events[dense*32u+i]=select(0u,ed_history[source+1u+ED_Q+i],dense<count);}
 for(var i=0u;i<ED_C;i++){ed_companions_out[dense*ED_C+i]=select(0u,ed_history[source+1u+ED_Q+32u+i],dense<count);}
 atomicAdd(&ed_scratch[${l.scanCountOffset+l.levels+2}u],1u);
 if(dense==0u){ed_destination_count[0u]=count;ed_destination_count[1u]=atomicLoad(&ed_scratch[7u]);}
 `);
 results.consume=core(storage(0,'ed_scratch',true,true)+storage(1,'ed_receipt',true,true)+storage(2,'ed_count')+storage(3,'ed_destination_count',true))+
 entry('consume_exact_event_disposition_evidence',`
 if(ed_flat(id,groups)!=0u){return;}ed_pass(${l.scanCountOffset+l.levels+1}u);var error=atomicLoad(&ed_scratch[7u]);
 if(atomicLoad(&ed_scratch[0u])!=0x58454431u||atomicLoad(&ed_scratch[1u])!=1u||atomicLoad(&ed_scratch[8u])!=ED_E
  ||atomicLoad(&ed_scratch[9u])!=ED_P||atomicLoad(&ed_scratch[10u])!=ed_count[0u]||atomicLoad(&ed_scratch[11u])!=ed_count[1u]
  ||ed_count[0u]>ED_E||ed_count[1u]!=0u||ed_destination_count[0u]>ed_count[0u]||atomicLoad(&ed_scratch[${l.scanCountOffset+l.levels+2}u])!=ED_E){error|=ED_BAD;}
 for(var i=2u;i<7u;i++){if(atomicLoad(&ed_scratch[i])!=1u){error|=ED_BAD;}}
 for(var i=12u;i<16u;i++){if(atomicLoad(&ed_scratch[i])!=1u){error|=ED_BAD;}}
 for(var i=0u;i<${l.levels+2}u;i++){if(atomicLoad(&ed_scratch[${l.scanCountOffset}u+i])!=1u){error|=ED_BAD;}}
 // Per-row completion is checked by parallel prefix initialization. Header
 // stage counts and copied-row coverage detect omitted/replayed dispatches.
 if(error!=0u){ed_fail(error);}ed_destination_count[1u]|=error;
 `);
 return Object.freeze(results);
}
export function createSphExactPlacementPrivateCompanionRecoveryWgsl(l){return /* wgsl */ `
@group(0) @binding(0) var<storage,read_write> pending_companions:array<u32>;
@group(0) @binding(1) var<storage,read> original_receipt:array<u32>;
@compute @workgroup_size(64)
fn recover_exact_private_residual_companions(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=${l.eventCapacity}u||original_receipt[${RI.transactionalTerminalStatus}u]==1u){return;}
 for(var word=0u;word<${l.companionWords}u;word++){pending_companions[id.x*${l.companionWords}u+word]=0u;}
}
`;}
export function sphExactPlacementEventPipelineDescriptors(format,l){
 const codes={...createSphExactPlacementEventDispositionWgsl(format,l),summary:createSphExactPlacementEventSummaryWgsl(l)};
 for(const[k,v]of Object.entries(createSphExactPlacementResidualHistoryWgsl(l)))codes['history_'+k]=v;
 const signature=JSON.stringify([format.wordCount,format.quantumExponent,l]);
 return Object.freeze(Object.fromEntries(Object.entries(codes).map(([key,code])=>{
  const declarations=[...code.matchAll(/@binding\((\d+)\)\s+var<\s*(storage|uniform)\s*(?:,\s*(read|read_write)\s*)?>\s*(\w+)\s*:/g)]
   .map(m=>({binding:Number(m[1]),role:m[4],type:m[2]==='uniform'?'uniform':m[3]==='read_write'?'storage':'read-only-storage'})).sort((a,b)=>a.binding-b.binding);
  const entryPoint=[...code.matchAll(/@compute\s+@workgroup_size\((\d+)\)\s+fn\s+(\w+)/g)];
  if(entryPoint.length!==1||declarations.filter(d=>d.type!=='uniform').length>l.requiredStorageBindings)throw new Error('Unexpected exact event shader ABI');
  return[key,Object.freeze({code,entryPoint:entryPoint[0][2],workgroupSize:Number(entryPoint[0][1]),
   label:'ulg-exact-event-'+key,cacheKey:'ulg-exact-event-v2:'+key+':'+signature,
   roles:Object.freeze(declarations.map(v=>Object.freeze(v))),
   bindings:Object.freeze(declarations.map(v=>Object.freeze({binding:v.binding,visibility:4,buffer:Object.freeze({type:v.type})})))} )];
 })));
}
