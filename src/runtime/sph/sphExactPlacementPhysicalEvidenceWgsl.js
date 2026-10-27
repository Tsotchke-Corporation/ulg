import { SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC } from './sphExactPlacementPhysicalApplyWgsl.js';
import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as R,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS as RECEIPT_WORDS,
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS as FLAGS }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';

// Numeric shape only. The original private placement record owns all ranges.
export function sphExactPlacementPhysicalEvidenceLayout(physical, caloric) {
  const p=physical?.particleCount,e=physical?.eventCapacity,c=caloric?.receiverRecordWords;
  for(const value of[p,e,c,physical?.evidenceRecordWords,physical?.evidenceWordLength,
    physical?.mapWordLength,caloric?.receiverWordLength]) {
    if(!Number.isSafeInteger(value)||value<1||value>0x3fffffff)throw new RangeError('Exact physical evidence requires checked word addressing');
  }
  if(physical.evidenceRecordWords!==8+c||physical.evidenceWordLength!==p*(8+c)
      ||physical.mapWordLength!==e+4*p||caloric.receiverCapacity!==e
      ||caloric.receiverWordLength!==e*c||c<32)throw new TypeError('Exact physical evidence requires matching original layouts');
  return Object.freeze({particleCount:p,eventCapacity:e,caloricRecordWords:c,evidenceRecordWords:8+c,
    evidenceBytes:physical.evidenceWordLength*4,mapBytes:physical.mapWordLength*4,
    caloricBytes:caloric.receiverWordLength*4,receiptBytes:RECEIPT_WORDS*4,workgroupSize:64});
}
export function planSphExactPlacementPhysicalEvidenceDispatch(layout,limit) {
  if(!Number.isSafeInteger(limit)||limit<1)throw new RangeError('Original physical evidence workgroup limit required');
  const groups=Math.ceil(Math.max(layout.particleCount,layout.eventCapacity)/64);
  const x=Math.min(groups,limit),y=Math.ceil(groups/x);
  if(y>limit)throw new RangeError('Exact physical evidence exceeds two-dimensional dispatch capacity');
  return Object.freeze([x,y,1]);
}
export function createSphExactPlacementPhysicalEvidenceWgsl(physical,caloric) {
  const l=sphExactPlacementPhysicalEvidenceLayout(physical,caloric);
  return /* wgsl */ `
const PE_P:u32=${l.particleCount}u;
const PE_E:u32=${l.eventCapacity}u;
const PE_S:u32=${l.evidenceRecordWords}u;
const PE_C:u32=${l.caloricRecordWords}u;
const PE_INVALID:u32=0xffffffffu;
@group(0) @binding(0) var<storage,read> pe_evidence:array<u32>;
@group(0) @binding(1) var<storage,read> pe_map:array<u32>;
@group(0) @binding(2) var<storage,read> pe_caloric:array<u32>;
@group(0) @binding(3) var<storage,read_write> pe_receipt:array<atomic<u32>>;
fn pe_flag(flag:u32) { atomicOr(&pe_receipt[${R.overflowFlags}u],flag); }
fn pe_check_receiver(row:u32) {
  let at=row*PE_S;
  if(pe_evidence[at]!=${SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC}u||pe_evidence[at+1u]!=1u
      ||pe_evidence[at+3u]!=0u||pe_evidence[at+4u]!=row||pe_evidence[at+7u]!=0u) {
    pe_flag(${FLAGS.CONSERVATION_MOMENT}u);return;
  }
  if(pe_map[PE_E+row*4u+3u]!=0u){pe_flag(${FLAGS.VOLUME_AUTHORITY}u);}
  let stage=pe_evidence[at+2u];let tail=pe_evidence[at+5u];
  if(stage==1u) {
    if(tail!=PE_INVALID||pe_evidence[at+6u]!=0u){pe_flag(${FLAGS.CONSERVATION_MOMENT}u);}
    // Initialized/unaffected rows have no retained caloric result yet.
    for(var i=8u;i<PE_S;i++){if(pe_evidence[at+i]!=0u){pe_flag(${FLAGS.CONSERVATION_MOMENT}u);}}
    return;
  }
  if(stage!=2u||tail>=PE_E||pe_evidence[at+6u]!=4u){pe_flag(${FLAGS.CONSERVATION_MOMENT}u);return;}
  if(pe_map[tail]!=row||pe_evidence[at+8u]!=1u||pe_evidence[at+9u]!=0u||pe_evidence[at+10u]!=row){
    pe_flag(${FLAGS.CONSERVATION_MOMENT}u);return;
  }
  // This copied caloric row is unchanged by later direct/spare physical work.
  // Checking it does not assert that a capture candidate equals the final S/T/M.
  for(var i=0u;i<PE_C;i++){
    if(pe_evidence[at+8u+i]!=pe_caloric[tail*PE_C+i]){pe_flag(${FLAGS.CONSERVATION_MOMENT}u);}
  }
}
fn pe_check_tail(position:u32) {
  let row=pe_map[position];if(row==PE_INVALID){return;}
  if(row>=PE_P){pe_flag(${FLAGS.CONSERVATION_MOMENT}u);return;}
  let at=row*PE_S;
  if(pe_evidence[at]!=${SPH_EXACT_PHYSICAL_APPLY_EVIDENCE_MAGIC}u||pe_evidence[at+1u]!=1u
      ||pe_evidence[at+2u]!=2u||pe_evidence[at+3u]!=0u||pe_evidence[at+4u]!=row
      ||pe_evidence[at+5u]!=position||pe_evidence[at+6u]!=4u||pe_evidence[at+7u]!=0u) {
    pe_flag(${FLAGS.CONSERVATION_MOMENT}u);
  }
}
@compute @workgroup_size(64)
fn consume_exact_receiver_physical_evidence(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let index=id.x+id.y*groups.x*64u;
  if(index>=max(PE_P,PE_E)){return;}
  if(arrayLength(&pe_receipt)<${RECEIPT_WORDS}u){return;}
  if(arrayLength(&pe_evidence)<${physical.evidenceWordLength}u||arrayLength(&pe_map)<${physical.mapWordLength}u
      ||arrayLength(&pe_caloric)<${caloric.receiverWordLength}u){pe_flag(${FLAGS.CONSERVATION_MOMENT}u);return;}
  if(index<PE_P){pe_check_receiver(index);}
  // O(P+E) coverage: a mapped receiver cannot masquerade as unaffected stage1.
  if(index<PE_E){pe_check_tail(index);}
}
`;
}
