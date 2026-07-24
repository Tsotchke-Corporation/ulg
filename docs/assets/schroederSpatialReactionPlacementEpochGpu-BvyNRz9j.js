import{$ as e,A as t,Ei as n,Li as r,M as i,Mi as a,N as o,Oi as s,P as c,Q as l,S as u,b as d,d as f,j as p,m,o as h,p as g,s as _,v,wi as y,x as b}from"./schroederSpatialEpochGpu-Cqn5xuEn.js";var x=Object.defineProperty,S=(e,t)=>{let n={};for(var r in e)x(n,r,{get:e[r],enumerable:!0});return t||x(n,Symbol.toStringTag,{value:`Module`}),n};const ee=`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`,C=`reaction-discovery`,w=`v4-s9d-hot-counter-aggregation`,te=Object.freeze([`partnerParticleIndex:f32`,`reactionIndex:f32`,`reactantRole:f32`,`distanceSquaredM2:f32`]),ne=Object.freeze(`sourceDispatchCount:u32.directoryAdmissionCount:u32.directoryRejectionCount:u32.candidateVisitCount:u32.compatiblePairCount:u32.malformedTraversalCount:u32.proposalCount:u32.sealedRowCount:u32.sourceIdentityRejectionCount:u32.supportProfileId:u32.generationId:u32.supportEpoch:u32.particleCount:u32.reactionCount:u32.privateLookupBuildCount:u32.overflowCount:u32.ruleIndexPairLookupCount:u32.ruleIndexPairMissCount:u32.ruleIndexRuleVisitCount:u32.fullRuleScanRuleVisitCount:u32.maximumDisplacementBits:u32.displacementCertificateStatusBits:u32.authorityActiveCount:u32.currentActiveCount:u32.exactCellTreeNodeVisitCount:u32.exactCellTreeLeafVisitCount:u32.exactCellTreeMemberVisitCount:u32`.split(`.`)),T=16777215,re=1065353216,E=`peercompute.ulg.schroeder-spatial-reaction-rule-index.v1`,D=new WeakMap,O=new WeakMap,ie=new WeakMap,k={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},ae={READ:globalThis.GPUMapMode?.READ??1};function oe(e,t,n=4294967295){if(typeof e!=`number`||!Number.isInteger(e)||e<1||e>n)throw RangeError(`${t} must be an integer in [1, ${n}]`);return e}function A(e,t){if(typeof e!=`number`||!Number.isFinite(e)||e<=0)throw RangeError(`${t} must be a positive finite number`);return e}function se(e,t,n){return e?.active===!0&&typeof e.beginEncoderSpan==`function`&&typeof e.endEncoderSpan==`function`?e.beginEncoderSpan(t,n):null}function ce(e,t,n){n&&e.endEncoderSpan(t,n)}function j(e,t,n){if(!t||i(t)!==e||!o(t,e))throw TypeError(`${n} must be a live buffer on the canonical generation device`);return t}function le(e,t,n){if(Number.isFinite(Number(e?.size))&&Number(e.size)<t)throw RangeError(`${n} has ${e.size} bytes; ${t} required`);return e}function ue(e,t,n){if(!Number.isSafeInteger(t)||t<4)throw RangeError(`${n} byte length is not safely addressable`);let r=[Number(e?.limits?.maxBufferSize),Number(e?.limits?.maxStorageBufferBindingSize)].filter(e=>Number.isFinite(e)&&e>0),i=r.length>0?Math.min(...r):2**53-1;if(t>i)throw RangeError(`${n} requires ${t} bytes; device limit is ${i}`);return t}function M(e,n,r,i){return t(e.createBuffer({label:n,size:Math.max(4,r),usage:i}),e)}function N(e){let t=4;for(;t<e;)t*=2;return t}function P(e){let t=D.get(e);return t||(t=new Map,D.set(e,t)),t}function de({device:e,generation:t,proposalBytes:n,localReactionRecordBytes:r,observeGpuEvidence:i=!1}){let a=t?.execution?.arenaIndex;if(!Number.isInteger(a)||a<0)throw TypeError(`reaction discovery requires a canonical generation arena index`);let o=P(e),c=o.get(a)||null;if(c?.inUse===!0)if(c.generation?.execution?.released===!0)c.inUse=!1,c.generation=null;else throw Error(`reaction discovery arena ${a} is already leased by generation ${c.generationId}`);if(c?.inUse===!1&&c.generation&&c.generation.execution?.released!==!0)throw Error(`reaction discovery arena ${a} remains quarantined by live generation ${c.generationId}`);let l=0;(!c||c.destroyed===!0)&&(c={arenaIndex:a,proposalBuffer:null,proposalCapacityBytes:0,evidenceBuffer:null,evidenceReadbackBuffer:null,expectationBuffer:null,paramsBuffer:null,reactionRecordBuffer:null,reactionRecordCapacityBytes:0,generation:null,generationId:null,inUse:!1,destroyed:!1,totalBufferCreationCount:0,acquisitionCount:0},o.set(a,c)),c.proposalCapacityBytes<n&&(c.proposalBuffer?.destroy?.(),c.proposalCapacityBytes=N(n),ue(e,c.proposalCapacityBytes,`reaction discovery cached proposal buffer`),c.proposalBuffer=M(e,`ulg-schroeder-spatial-reaction-discovery-proposals-arena-${a}`,c.proposalCapacityBytes,k.STORAGE|k.COPY_SRC),l+=1),c.evidenceBuffer||(c.evidenceBuffer=M(e,`ulg-schroeder-spatial-reaction-discovery-evidence-arena-${a}`,27*Uint32Array.BYTES_PER_ELEMENT,k.STORAGE|k.COPY_SRC|k.COPY_DST),l+=1),i===!0&&!c.evidenceReadbackBuffer&&(c.evidenceReadbackBuffer=M(e,`ulg-schroeder-spatial-reaction-discovery-evidence-readback-arena-${a}`,27*Uint32Array.BYTES_PER_ELEMENT,k.MAP_READ|k.COPY_DST),l+=1),c.expectationBuffer||(c.expectationBuffer=M(e,`ulg-schroeder-spatial-reaction-discovery-expectation-arena-${a}`,s,k.UNIFORM|k.COPY_DST),l+=1),c.paramsBuffer||(c.paramsBuffer=M(e,`ulg-schroeder-spatial-reaction-discovery-params-arena-${a}`,64,k.UNIFORM|k.COPY_DST),l+=1),r>0&&c.reactionRecordCapacityBytes<r&&(c.reactionRecordBuffer?.destroy?.(),c.reactionRecordCapacityBytes=N(r),ue(e,c.reactionRecordCapacityBytes,`reaction discovery cached reaction record buffer`),c.reactionRecordBuffer=M(e,`ulg-schroeder-spatial-reaction-discovery-records-arena-${a}`,c.reactionRecordCapacityBytes,k.STORAGE|k.COPY_DST),l+=1);let u=Object.freeze({arenaIndex:a,generationId:t.execution.generationId,acquisitionOrdinal:c.acquisitionCount+1});return c.acquisitionCount+=1,c.totalBufferCreationCount+=l,c.inUse=!0,c.generation=t,c.generationId=t.execution.generationId,c.lease=u,{entry:c,lease:u,bufferCreationCount:l}}function F(e,t){return!e||e.lease!==t||e.inUse!==!0?!1:(e.inUse=!1,e.lease=null,!0)}function I(e,{device:t,generation:n,particleCount:r=n?.source?.sourceCount,reactionCount:i=e?.reactionCount,reactionTable:a=null,sourceStateBuffer:s=null,sourceThermoBuffer:c=null}={}){let l=(e,t)=>Object.freeze({schema:ee,status:e,reason:t,ready:!1,admitted:!1}),u=O.get(e),d=null;try{d=a?p(fe(a).combined):null}catch{return l(`schroeder-spatial-reaction-discovery-proposal-rejected-authenticity`,`reaction discovery proposal was not issued for this exact generation and buffer family`)}if(!u||u.proposal!==e||u.generation!==n||u.directoryBuffer!==n?.execution?.directoryBuffer||u.exactNearCellTree!==n?.exactNearCellTree||u.exactNearCellTree!==e?.exactNearCellTree||u.exactNearCellTreeBuffer!==e?.exactNearCellTreeBuffer||u.positionAuthorityStateBuffer!==(n?.source?.sourceStateBuffer??n?.source?.exactNearQueryProfile?.sourceStateBuffer)||u.sourceCurrentStateBuffer!==e?.sourceCurrentStateBuffer||u.sourceThermoBuffer!==e?.sourceThermoBuffer||!a||u.reactionTable!==a||u.reactionTableFingerprint!==d||u.reactionRecordBuffer!==e?.reactionRecordBuffer||u.reactionDiscoveryPayloadFingerprint!==e?.reactionDiscoveryPayloadFingerprint||u.reactionRuleIndex!==e?.reactionRuleIndex||u.displacementCertificateBuffer!==e?.displacementCertificateBuffer||!s||!c||u.sourceCurrentStateBuffer!==s||u.sourceThermoBuffer!==c||u.expectationBuffer!==e?.expectationBuffer||u.receipt!==e?.receipt)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-authenticity`,`reaction discovery proposal was not issued for this exact generation and buffer family`);if(e?.schema!==`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`||e.ready!==!0||e.released===!0)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-contract`,`reaction discovery proposal is not a live submitted v1 artifact`);if(e.consumerId!==`reaction-discovery`||e.supportProfileId!==65538||e.proposalRowStrideFloats!==4||e.traversalCount!==1||e.privateLookupBuildCount!==0||e.fixedCandidateBuildCount!==0||e.exhaustiveTraversalCount!==0||e.candidateBudget!==null||e.fullReadbackPerformed!==!1)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-invariants`,`reaction discovery proposal violates the exact-near residency contract`);if(e.generation!==n||e.generationId!==n?.execution?.generationId||n?.execution?.released===!0||n?.releaseScheduled===!0)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-generation`,`reaction discovery proposal is not bound to the live consumer generation`);if(e.particleCount!==r||e.reactionCount!==i)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-count`,`reaction discovery proposal count does not match the chemistry consumer`);if(!_(e.receipt))return l(`schroeder-spatial-reaction-discovery-proposal-rejected-receipt`,`reaction discovery proposal lacks an authentic finalized consumer receipt`);if(e.receipt.consumerId!==e.consumerId||e.receipt.supportProfileId!==e.supportProfileId||e.receipt.generationId!==e.generationId)return l(`schroeder-spatial-reaction-discovery-proposal-rejected-receipt-identity`,`reaction discovery receipt identity does not match the artifact`);if(!e.proposalBuffer||!e.evidenceBuffer||!e.reactionRecordBuffer||!e.directoryBuffer||!e.exactNearCellTree||!e.exactNearCellTreeBuffer||!e.expectationBuffer||!e.positionAuthorityStateBuffer||!e.sourceCurrentStateBuffer||!e.sourceThermoBuffer||!e.displacementCertificateBuffer||e.displacementCertificateBuffer!==e.evidenceBuffer||!o(e.proposalBuffer,t)||!o(e.evidenceBuffer,t)||!o(e.reactionRecordBuffer,t)||!o(e.directoryBuffer,t)||e.exactNearCellTree!==n?.exactNearCellTree||e.exactNearCellTree?.released===!0||e.exactNearCellTreeBuffer!==e.exactNearCellTree?.treeBuffer||!o(e.exactNearCellTreeBuffer,t)||!o(e.expectationBuffer,t)||!o(e.positionAuthorityStateBuffer,t)||!o(e.sourceCurrentStateBuffer,t)||!o(e.sourceThermoBuffer,t)||!o(e.displacementCertificateBuffer,t))return l(`schroeder-spatial-reaction-discovery-proposal-rejected-device`,`reaction discovery buffers do not belong to the consumer device`);let f=r*4*Float32Array.BYTES_PER_ELEMENT;return e.proposalBufferByteLength!==f||Number.isFinite(Number(e.proposalBuffer.size))&&Number(e.proposalBuffer.size)<f?l(`schroeder-spatial-reaction-discovery-proposal-rejected-capacity`,`reaction discovery proposal buffer is smaller than its authenticated row set`):Object.freeze({schema:ee,status:`schroeder-spatial-reaction-discovery-proposal-admitted`,reason:null,ready:!0,admitted:!0,generation:n,proposalBuffer:e.proposalBuffer,evidenceBuffer:e.evidenceBuffer,reactionRecordBuffer:e.reactionRecordBuffer,directoryBuffer:e.directoryBuffer,exactNearCellTree:e.exactNearCellTree,exactNearCellTreeBuffer:e.exactNearCellTreeBuffer,expectationBuffer:e.expectationBuffer,positionAuthorityStateBuffer:e.positionAuthorityStateBuffer,sourceCurrentStateBuffer:e.sourceCurrentStateBuffer,sourceThermoBuffer:e.sourceThermoBuffer,displacementCertificateBuffer:e.displacementCertificateBuffer,particleCount:r,reactionCount:i,generationId:e.generationId,epochIdentity:e.epochIdentity,receipt:e.receipt})}function fe(e){if(e?.schema!==`peercompute.ulg.sph-gpu-reaction-table.v1`)throw TypeError(`canonical reaction discovery requires a packed SPH reaction table`);let t=oe(e.reactionCount,`reactionTable.reactionCount`,T);if(!(e.records instanceof Float32Array))throw TypeError(`reactionTable.records must be a Float32Array`);let n=t*12;if(e.records.length<n)throw RangeError(`reactionTable.records has ${e.records.length} floats; ${n} required`);let r=e.combinedRecords instanceof Float32Array?e.combinedRecords:e.records;if(r.length<n)throw RangeError(`reaction table combined records do not contain every reaction header`);return{reactionCount:t,combined:r}}function L({combined:e,reason:t}){let n=e.length%4==0?e.length/4:0;return Object.freeze({schema:E,mode:`full-rule-scan`,modeCode:0,reason:t,upload:e,pairOffsetVec4s:0,pairCount:0,ruleOffsetVec4s:0,ruleCount:0,recordVec4Count:n})}function R({combined:e,reactionCount:t,allowIndex:n,fallbackReason:r=`material-pair-index-unavailable`}){if(n!==!0)return L({combined:e,reason:r});if(e.length%4!=0)return L({combined:e,reason:`reaction-record-prefix-not-vec4-aligned`});let i=new Map;for(let n=0;n<t;n+=1){let t=n*12,r=Math.fround(e[t]),a=Math.fround(e[t+1]),o=Math.fround(e[t+3]),s=Math.fround(e[t+5]),c=Math.fround(e[t+6]),l=Math.fround(e[t+7]);if(Math.fround(e[t+8])!==1||!Number.isFinite(r)||!Number.isFinite(a)||r===a||!Number.isFinite(o)||!Number.isFinite(s)||s<=0||!Number.isFinite(c)||!Number.isFinite(l))continue;let u=Math.min(r,a),d=Math.max(r,a),f=`${u}:${d}`,p=i.get(f);p||(p={materialLo:u,materialHi:d,ruleIndexes:[]},i.set(f,p)),p.ruleIndexes.push(n)}let a=[...i.values()].sort((e,t)=>e.materialLo-t.materialLo||e.materialHi-t.materialHi),o=a.flatMap(e=>e.ruleIndexes),s=e.length/4,c=s+a.length,l=Math.ceil(o.length/4)*4,u=new Float32Array(e.length+a.length*4+l);u.set(e);let d=e.length,f=0;for(let e of a)u[d]=e.materialLo,u[d+1]=e.materialHi,u[d+2]=f,u[d+3]=e.ruleIndexes.length,d+=4,f+=e.ruleIndexes.length;return u.set(o,e.length+a.length*4),Object.freeze({schema:E,mode:`material-pair-indexed`,modeCode:1,reason:null,upload:u,pairOffsetVec4s:s,pairCount:a.length,ruleOffsetVec4s:c,ruleCount:o.length,recordVec4Count:u.length/4})}function pe({reactionTable:e,combined:t,reactionCount:n,allowIndex:r,fallbackReason:i,reactionTableFingerprint:a}){if(r!==!0)return L({combined:t,reason:i});let o=ie.get(e);if(o&&o.reactionTableFingerprint===a&&o.reactionCount===n&&o.combined===t)return o.reactionRuleIndex;let s=R({combined:t,reactionCount:n,allowIndex:r,fallbackReason:i});return ie.set(e,{reactionTableFingerprint:a,reactionCount:n,combined:t,reactionRuleIndex:s}),s}function me(e){let{reactionCount:t,combined:n}=fe(e),r=0;for(let e=0;e<t;e+=1){let t=e*12,i=n[t+8],a=n[t+5];Math.round(i)!==1||!Number.isFinite(a)||a<=0||(r=Math.max(r,Math.fround(a)))}return r}function he({particleCount:e,reactionCount:t,maximumContactRadiusM:n,reactionRuleIndex:r,collectDiagnosticEvidence:i=!1}){let o=new ArrayBuffer(64),s=new DataView(o);return s.setUint32(0,oe(e,`particleCount`,T),!0),s.setUint32(4,oe(t,`reactionCount`,T),!0),s.setUint32(8,3,!0),s.setUint32(12,a,!0),s.setFloat32(16,n>0?A(n,`maximumContactRadiusM`):0,!0),s.setUint32(20,16,!0),s.setUint32(24,3,!0),s.setUint32(28,2,!0),s.setUint32(32,r.modeCode,!0),s.setUint32(36,r.pairOffsetVec4s,!0),s.setUint32(40,r.pairCount,!0),s.setUint32(44,r.ruleOffsetVec4s,!0),s.setUint32(48,r.ruleCount,!0),s.setUint32(52,r.recordVec4Count,!0),s.setUint32(56,+(i===!0),!0),s.setUint32(60,0,!0),o}const ge=`
struct ReactionDiscoveryParams {
  particle_count: u32,
  reaction_count: u32,
  reaction_record_stride_vec4s: u32,
  support_profile_id: u32,
  maximum_contact_radius_m: f32,
  active_node_stride_floats: u32,
  thermo_stride_vec4s: u32,
  state_stride_vec4s: u32,
  reaction_rule_index_mode: u32,
  reaction_rule_index_pair_offset_vec4s: u32,
  reaction_rule_index_pair_count: u32,
  reaction_rule_index_rule_offset_vec4s: u32,
  reaction_rule_index_rule_count: u32,
  reaction_rule_index_record_vec4_count: u32,
  collect_diagnostic_evidence: u32,
  reserved: u32,
};

@group(0) @binding(0) var<storage, read> source_state_authority: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read> exact_near_cell_tree: array<u32>;
@group(0) @binding(6) var<storage, read_write> reaction_proposals: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(9) var<uniform> params: ReactionDiscoveryParams;

${n({directoryBindingName:`spatial_directory`})}
${y({treeBindingName:`exact_near_cell_tree`,directoryBindingName:`spatial_directory`})}

const REACTION_DISCOVERY_INVALID_INDEX: f32 = -1.0;
const REACTION_DISCOVERY_MAX_F32: f32 = 3.402823e38;
const REACTION_DISCOVERY_CERTIFICATE_READY_BITS: u32 = 0x3f800000u;
const REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS: u32 = 0x40000000u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_FULL_SCAN: u32 = 0u;
const REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR: u32 = 1u;
const REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4: u32 = 4u;
const REACTION_DISCOVERY_EVIDENCE_OVERFLOW: u32 = 15u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: u32 = 16u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: u32 = 17u;
const REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: u32 = 18u;
const REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: u32 = 19u;
const REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS: u32 = 20u;
const REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS: u32 = 21u;
const REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT: u32 = 22u;
const REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT: u32 = 23u;
const REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: u32 = 24u;
const REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: u32 = 25u;
const REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: u32 = 26u;

fn reaction_discovery_invalid_proposal() -> vec4<f32> {
  return vec4<f32>(
    REACTION_DISCOVERY_INVALID_INDEX,
    REACTION_DISCOVERY_INVALID_INDEX,
    0.0,
    REACTION_DISCOVERY_MAX_F32
  );
}

// This is the immediate path for completion and fail-closed counters. The
// candidate/tree diagnostics below are deliberately the only batched fields.
fn reaction_discovery_increment_control_counter(counter_index: u32) {
  let previous = atomicAdd(&traversal_evidence[counter_index], 1u);
  if (previous == 0xffffffffu) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
  }
}

// S9D_HOT_COUNTER_AGGREGATION_BEGIN
// These are invocation-private accumulators. They are observable only when
// requested, and never participate in traversal, rule selection, or sealing
// except to fail closed on an arithmetic overflow.
var<private> reaction_discovery_hot_candidate_visits: u32;
var<private> reaction_discovery_hot_compatible_pairs: u32;
var<private> reaction_discovery_hot_rule_index_pair_lookups: u32;
var<private> reaction_discovery_hot_rule_index_pair_misses: u32;
var<private> reaction_discovery_hot_rule_index_rule_visits: u32;
var<private> reaction_discovery_hot_full_rule_scan_visits: u32;
var<private> reaction_discovery_hot_tree_node_visits: u32;
var<private> reaction_discovery_hot_tree_leaf_visits: u32;
var<private> reaction_discovery_hot_tree_member_visits: u32;
var<private> reaction_discovery_hot_counter_overflow: u32;

fn reaction_discovery_reset_hot_counters() {
  reaction_discovery_hot_candidate_visits = 0u;
  reaction_discovery_hot_compatible_pairs = 0u;
  reaction_discovery_hot_rule_index_pair_lookups = 0u;
  reaction_discovery_hot_rule_index_pair_misses = 0u;
  reaction_discovery_hot_rule_index_rule_visits = 0u;
  reaction_discovery_hot_full_rule_scan_visits = 0u;
  reaction_discovery_hot_tree_node_visits = 0u;
  reaction_discovery_hot_tree_leaf_visits = 0u;
  reaction_discovery_hot_tree_member_visits = 0u;
  reaction_discovery_hot_counter_overflow = 0u;
}

fn reaction_discovery_increment_hot_counter(counter_index: u32) {
  if (
    params.collect_diagnostic_evidence == 0u
    || reaction_discovery_hot_counter_overflow != 0u
  ) {
    return;
  }
  switch (counter_index) {
    case 3u: {
      if (reaction_discovery_hot_candidate_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_candidate_visits =
          reaction_discovery_hot_candidate_visits + 1u;
      }
    }
    case 4u: {
      if (reaction_discovery_hot_compatible_pairs == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_compatible_pairs =
          reaction_discovery_hot_compatible_pairs + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS: {
      if (reaction_discovery_hot_rule_index_pair_lookups == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_lookups =
          reaction_discovery_hot_rule_index_pair_lookups + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES: {
      if (reaction_discovery_hot_rule_index_pair_misses == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_pair_misses =
          reaction_discovery_hot_rule_index_pair_misses + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS: {
      if (reaction_discovery_hot_rule_index_rule_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_rule_index_rule_visits =
          reaction_discovery_hot_rule_index_rule_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS: {
      if (reaction_discovery_hot_full_rule_scan_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_full_rule_scan_visits =
          reaction_discovery_hot_full_rule_scan_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS: {
      if (reaction_discovery_hot_tree_node_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_node_visits =
          reaction_discovery_hot_tree_node_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS: {
      if (reaction_discovery_hot_tree_leaf_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_leaf_visits =
          reaction_discovery_hot_tree_leaf_visits + 1u;
      }
    }
    case REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: {
      if (reaction_discovery_hot_tree_member_visits == 0xffffffffu) {
        reaction_discovery_hot_counter_overflow = 1u;
      } else {
        reaction_discovery_hot_tree_member_visits =
          reaction_discovery_hot_tree_member_visits + 1u;
      }
    }
    default: {}
  }
}

fn reaction_discovery_flush_hot_counter(counter_index: u32, count: u32) -> bool {
  if (count == 0u) {
    return true;
  }
  let previous = atomicAdd(&traversal_evidence[counter_index], count);
  return previous <= 0xffffffffu - count;
}

fn reaction_discovery_flush_hot_counters() -> bool {
  if (params.collect_diagnostic_evidence == 0u) {
    return true;
  }
  let candidate_visits_admitted = reaction_discovery_flush_hot_counter(
    3u,
    reaction_discovery_hot_candidate_visits
  );
  let compatible_pairs_admitted = reaction_discovery_flush_hot_counter(
    4u,
    reaction_discovery_hot_compatible_pairs
  );
  let pair_lookups_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS,
    reaction_discovery_hot_rule_index_pair_lookups
  );
  let pair_misses_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES,
    reaction_discovery_hot_rule_index_pair_misses
  );
  let rule_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS,
    reaction_discovery_hot_rule_index_rule_visits
  );
  let full_scan_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS,
    reaction_discovery_hot_full_rule_scan_visits
  );
  let tree_node_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS,
    reaction_discovery_hot_tree_node_visits
  );
  let tree_leaf_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS,
    reaction_discovery_hot_tree_leaf_visits
  );
  let tree_member_visits_admitted = reaction_discovery_flush_hot_counter(
    REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS,
    reaction_discovery_hot_tree_member_visits
  );
  if (
    reaction_discovery_hot_counter_overflow != 0u
    || !candidate_visits_admitted
    || !compatible_pairs_admitted
    || !pair_lookups_admitted
    || !pair_misses_admitted
    || !rule_visits_admitted
    || !full_scan_visits_admitted
    || !tree_node_visits_admitted
    || !tree_leaf_visits_admitted
    || !tree_member_visits_admitted
  ) {
    atomicStore(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW], 1u);
    return false;
  }
  return true;
}

fn reaction_discovery_increment_counter(counter_index: u32) {
  if (
    counter_index == 3u
    || counter_index == 4u
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
    || counter_index == REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
    || counter_index == REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
  ) {
    reaction_discovery_increment_hot_counter(counter_index);
    return;
  }
  reaction_discovery_increment_control_counter(counter_index);
}
// S9D_HOT_COUNTER_AGGREGATION_END

fn reaction_discovery_source_row_admitted(source_index: u32) -> bool {
  let offset = source_index * params.state_stride_vec4s;
  if (
    offset >= arrayLength(&source_state_authority)
    || offset >= arrayLength(&source_state)
  ) {
    return false;
  }
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  return all(vec3<bool>(
      ss_exact_near_finite(authority_position_mass.x),
      ss_exact_near_finite(authority_position_mass.y),
      ss_exact_near_finite(authority_position_mass.z)
    ))
    && all(vec3<bool>(
      ss_exact_near_finite(current_position_mass.x),
      ss_exact_near_finite(current_position_mass.y),
      ss_exact_near_finite(current_position_mass.z)
    ))
    && ss_exact_near_finite(authority_position_mass.w)
    && ss_exact_near_finite(current_position_mass.w);
}

fn reaction_discovery_position(source_index: u32) -> vec3<f32> {
  return source_state[source_index * params.state_stride_vec4s].xyz;
}

fn reaction_discovery_thermo0(source_index: u32) -> vec4<f32> {
  return source_thermo[source_index * params.thermo_stride_vec4s];
}

fn reaction_discovery_mass(source_index: u32) -> f32 {
  return source_state[source_index * params.state_stride_vec4s].w;
}

fn reaction_discovery_phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  if (
    !ss_exact_near_finite(mask_f)
    || !ss_exact_near_finite(phase_id_f)
    || mask_f < 0.0
    || phase_id_f < 0.0
  ) {
    return false;
  }
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  return phase_id < 31u && (mask & (1u << phase_id)) != 0u;
}

// One invocation authenticates one source row. Non-negative finite f32 bit
// patterns preserve numeric order as u32, so atomicMax is an exact parallel
// reduction for the maximum displacement. Dispatch ordering makes the sealed
// certificate visible to the traversal without a host fence or readback.
@compute @workgroup_size(64)
fn prepare_displacement_certificate(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let source_index = global_id.x;
  if (
    source_index >= params.particle_count
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
  ) {
    return;
  }
  if (!reaction_discovery_source_row_admitted(source_index)) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  let offset = source_index * params.state_stride_vec4s;
  let authority_position_mass = source_state_authority[offset];
  let current_position_mass = source_state[offset];
  let source_active = authority_position_mass.w > 0.0;
  let current_active = current_position_mass.w > 0.0;
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_AUTHORITY_ACTIVE_COUNT],
    select(0u, 1u, source_active)
  );
  atomicAdd(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CURRENT_ACTIVE_COUNT],
    select(0u, 1u, current_active)
  );
  if (source_active != current_active) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  if (!source_active) {
    return;
  }
  let displacement_m = length(
    current_position_mass.xyz - authority_position_mass.xyz
  );
  if (!ss_exact_near_finite(displacement_m) || displacement_m < 0.0) {
    atomicStore(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS],
      REACTION_DISCOVERY_CERTIFICATE_REJECTED_BITS
    );
    return;
  }
  atomicMax(
    &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS],
    bitcast<u32>(displacement_m)
  );
}

struct ReactionRuleIndexInteger {
  admitted: u32,
  value: u32,
};

struct ReactionRuleIndexLookup {
  indexed: u32,
  found: u32,
  rule_begin: u32,
  rule_count: u32,
};

fn reaction_discovery_rule_index_integer(value: f32) -> ReactionRuleIndexInteger {
  if (
    !ss_exact_near_finite(value)
    || value < 0.0
    || value > 16777215.0
    || floor(value) != value
  ) {
    return ReactionRuleIndexInteger(0u, 0u);
  }
  return ReactionRuleIndexInteger(1u, u32(value));
}

fn reaction_discovery_rule_index_available() -> bool {
  if (
    params.reaction_rule_index_mode
      != REACTION_DISCOVERY_RULE_INDEX_MODE_MATERIAL_PAIR
    || params.reaction_rule_index_record_vec4_count
      > arrayLength(&reaction_records)
  ) {
    return false;
  }
  let reaction_prefix_vec4s =
    params.reaction_count * params.reaction_record_stride_vec4s;
  if (
    params.reaction_rule_index_pair_offset_vec4s < reaction_prefix_vec4s
    || params.reaction_rule_index_pair_offset_vec4s
      > params.reaction_rule_index_rule_offset_vec4s
    || params.reaction_rule_index_pair_count
      > params.reaction_rule_index_rule_offset_vec4s
        - params.reaction_rule_index_pair_offset_vec4s
    || params.reaction_rule_index_rule_count > 0xfffffffcu
  ) {
    return false;
  }
  let rule_vec4_count = (
    params.reaction_rule_index_rule_count
      + (REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4 - 1u)
  ) / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  return params.reaction_rule_index_rule_offset_vec4s
      <= params.reaction_rule_index_record_vec4_count
    && rule_vec4_count
      <= params.reaction_rule_index_record_vec4_count
        - params.reaction_rule_index_rule_offset_vec4s;
}

fn reaction_discovery_pair_less(
  left_lo: f32,
  left_hi: f32,
  right_lo: f32,
  right_hi: f32
) -> bool {
  return left_lo < right_lo || (left_lo == right_lo && left_hi < right_hi);
}

fn reaction_discovery_rule_index_lookup(
  self_material: f32,
  other_material: f32
) -> ReactionRuleIndexLookup {
  if (
    !reaction_discovery_rule_index_available()
    || !ss_exact_near_finite(self_material)
    || !ss_exact_near_finite(other_material)
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  let material_lo = min(self_material, other_material);
  let material_hi = max(self_material, other_material);
  var lower = 0u;
  var upper = params.reaction_rule_index_pair_count;
  var iteration = 0u;
  loop {
    if (lower >= upper || iteration >= params.reaction_rule_index_pair_count) {
      break;
    }
    let middle = lower + (upper - lower) / 2u;
    let entry = reaction_records[
      params.reaction_rule_index_pair_offset_vec4s + middle
    ];
    if (
      !ss_exact_near_finite(entry.x)
      || !ss_exact_near_finite(entry.y)
      || entry.x >= entry.y
    ) {
      return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
    }
    if (reaction_discovery_pair_less(entry.x, entry.y, material_lo, material_hi)) {
      lower = middle + 1u;
    } else {
      upper = middle;
    }
    iteration = iteration + 1u;
  }
  if (lower >= params.reaction_rule_index_pair_count) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let entry = reaction_records[
    params.reaction_rule_index_pair_offset_vec4s + lower
  ];
  if (
    !ss_exact_near_finite(entry.x)
    || !ss_exact_near_finite(entry.y)
    || entry.x >= entry.y
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  if (entry.x != material_lo || entry.y != material_hi) {
    return ReactionRuleIndexLookup(1u, 0u, 0u, 0u);
  }
  let rule_begin = reaction_discovery_rule_index_integer(entry.z);
  let rule_count = reaction_discovery_rule_index_integer(entry.w);
  if (
    rule_begin.admitted == 0u
    || rule_count.admitted == 0u
    || rule_count.value == 0u
    || rule_begin.value > params.reaction_rule_index_rule_count
    || rule_count.value
      > params.reaction_rule_index_rule_count - rule_begin.value
  ) {
    return ReactionRuleIndexLookup(0u, 0u, 0u, 0u);
  }
  return ReactionRuleIndexLookup(
    1u,
    1u,
    rule_begin.value,
    rule_count.value
  );
}

fn reaction_discovery_rule_index_rule_at(
  rule_offset: u32
) -> ReactionRuleIndexInteger {
  let row = reaction_records[
    params.reaction_rule_index_rule_offset_vec4s
      + rule_offset / REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4
  ];
  let lane = rule_offset % REACTION_DISCOVERY_RULE_INDEX_RULES_PER_VEC4;
  var value = row.x;
  if (lane == 1u) {
    value = row.y;
  } else if (lane == 2u) {
    value = row.z;
  } else if (lane == 3u) {
    value = row.w;
  }
  return reaction_discovery_rule_index_integer(value);
}

fn reaction_discovery_consider_reaction(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  reaction_index: u32,
  best: ptr<function, vec4<f32>>
) {
  if (reaction_index >= params.reaction_count) {
    return;
  }
  let reaction_base = reaction_index * params.reaction_record_stride_vec4s;
  let row0 = reaction_records[reaction_base];
  let row1 = reaction_records[reaction_base + 1u];
  let row2 = reaction_records[reaction_base + 2u];
  if (row2.x != 1.0 || !ss_exact_near_finite(row1.y) || row1.y <= 0.0) {
    return;
  }
  if (
    !all(vec4<bool>(
      ss_exact_near_finite(self_thermo0.x),
      ss_exact_near_finite(self_thermo0.y),
      ss_exact_near_finite(self_thermo0.z),
      ss_exact_near_finite(other_thermo0.x)
    ))
    || !ss_exact_near_finite(other_thermo0.y)
    || !ss_exact_near_finite(other_thermo0.z)
    || !ss_exact_near_finite(row0.w)
    || !ss_exact_near_finite(row1.z)
    || !ss_exact_near_finite(row1.w)
    || row0.x == row0.y
  ) {
    return;
  }
  var role = 0.0;
  var self_phase_mask = 0.0;
  var other_phase_mask = 0.0;
  if (self_material == row0.x && other_material == row0.y) {
    role = 1.0;
    self_phase_mask = row1.z;
    other_phase_mask = row1.w;
  } else if (self_material == row0.y && other_material == row0.x) {
    role = 2.0;
    self_phase_mask = row1.w;
    other_phase_mask = row1.z;
  } else {
    return;
  }
  if (
    !reaction_discovery_phase_mask_satisfied(self_phase_mask, self_thermo0.y)
    || !reaction_discovery_phase_mask_satisfied(other_phase_mask, other_thermo0.y)
    || max(self_thermo0.z, other_thermo0.z) < row0.w
  ) {
    return;
  }
  if (distance_squared > row1.y * row1.y) {
    return;
  }
  reaction_discovery_increment_counter(4u);
  let current_partner = select(0xffffffffu, u32((*best).x + 0.5), (*best).x >= 0.0);
  let current_reaction = select(0xffffffffu, u32((*best).y + 0.5), (*best).y >= 0.0);
  if (
    distance_squared < (*best).w
    || (
      distance_squared == (*best).w
      && (
        other_index < current_partner
        || (other_index == current_partner && reaction_index < current_reaction)
      )
    )
  ) {
    *best = vec4<f32>(
      f32(other_index),
      f32(reaction_index),
      role,
      distance_squared
    );
  }
}

fn reaction_discovery_consider_all_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  best: ptr<function, vec4<f32>>
) {
  for (
    var reaction_index = 0u;
    reaction_index < params.reaction_count;
    reaction_index = reaction_index + 1u
  ) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_FULL_RULE_SCAN_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_indexed_reactions(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  other_material: f32,
  self_thermo0: vec4<f32>,
  other_thermo0: vec4<f32>,
  distance_squared: f32,
  lookup: ReactionRuleIndexLookup,
  best: ptr<function, vec4<f32>>
) {
  var previous_reaction_index = 0u;
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let decoded = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    );
    if (
      decoded.admitted == 0u
      || decoded.value >= params.reaction_count
      || (rule_ordinal > 0u && decoded.value <= previous_reaction_index)
    ) {
      reaction_discovery_consider_all_reactions(
        self_index,
        other_index,
        self_material,
        other_material,
        self_thermo0,
        other_thermo0,
        distance_squared,
        best
      );
      return;
    }
    previous_reaction_index = decoded.value;
  }
  for (
    var rule_ordinal = 0u;
    rule_ordinal < lookup.rule_count;
    rule_ordinal = rule_ordinal + 1u
  ) {
    let reaction_index = reaction_discovery_rule_index_rule_at(
      lookup.rule_begin + rule_ordinal
    ).value;
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_RULE_VISITS
    );
    reaction_discovery_consider_reaction(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      reaction_index,
      best
    );
  }
}

fn reaction_discovery_consider_pair(
  self_index: u32,
  other_index: u32,
  self_material: f32,
  self_position: vec3<f32>,
  best: ptr<function, vec4<f32>>
) {
  if (other_index == self_index || other_index >= params.particle_count) {
    return;
  }
  reaction_discovery_increment_counter(3u);
  if (!reaction_discovery_source_row_admitted(other_index)) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(other_index) <= 0.0) {
    return;
  }
  let self_thermo0 = reaction_discovery_thermo0(self_index);
  let other_thermo0 = reaction_discovery_thermo0(other_index);
  let other_material = other_thermo0.x;
  let other_position = reaction_discovery_position(other_index);
  let displacement = self_position - other_position;
  let distance_squared = dot(displacement, displacement);
  if (!ss_exact_near_finite(distance_squared)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  let lookup = reaction_discovery_rule_index_lookup(
    self_material,
    other_material
  );
  if (lookup.indexed != 0u) {
    reaction_discovery_increment_counter(
      REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_LOOKUPS
    );
    if (lookup.found == 0u) {
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_RULE_INDEX_PAIR_MISSES
      );
      return;
    }
    reaction_discovery_consider_indexed_reactions(
      self_index,
      other_index,
      self_material,
      other_material,
      self_thermo0,
      other_thermo0,
      distance_squared,
      lookup,
      best
    );
    return;
  }
  reaction_discovery_consider_all_reactions(
    self_index,
    other_index,
    self_material,
    other_material,
    self_thermo0,
    other_thermo0,
    distance_squared,
    best
  );
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  reaction_discovery_reset_hot_counters();
  atomicAdd(&traversal_evidence[0u], 1u);
  if (
    spatial_expectation.support_profile_id != params.support_profile_id
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || !ss_exact_cell_tree_admitted(spatial_expectation)
    || arrayLength(&traversal_evidence)
      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u
    || atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_CERTIFICATE_STATUS_BITS]
    )
      != REACTION_DISCOVERY_CERTIFICATE_READY_BITS
  ) {
    atomicAdd(&traversal_evidence[2u], 1u);
    return;
  }
  atomicAdd(&traversal_evidence[1u], 1u);
  if (
    arrayLength(&source_thermo) < params.particle_count * params.thermo_stride_vec4s
    || arrayLength(&source_state) < params.particle_count * params.state_stride_vec4s
    || arrayLength(&reaction_records)
      < params.reaction_count * params.reaction_record_stride_vec4s
    || !reaction_discovery_source_row_admitted(particle_index)
  ) {
    reaction_discovery_increment_control_counter(8u);
    return;
  }
  if (reaction_discovery_mass(particle_index) <= 0.0) {
    return;
  }
  if (
    !ss_exact_near_finite(params.maximum_contact_radius_m)
    || params.maximum_contact_radius_m < 0.0
  ) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (params.maximum_contact_radius_m == 0.0) {
    return;
  }

  let self_position = reaction_discovery_position(particle_index);
  let self_material = reaction_discovery_thermo0(particle_index).x;
  let certified_search_radius_m = params.maximum_contact_radius_m
    + max(bitcast<f32>(atomicLoad(
      &traversal_evidence[REACTION_DISCOVERY_EVIDENCE_MAXIMUM_DISPLACEMENT_BITS]
    )), 0.0);
  if (!ss_exact_near_finite(certified_search_radius_m)) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  var best = reaction_discovery_invalid_proposal();
  var malformed = false;

  let query_extent = vec3<f32>(certified_search_radius_m);
  let query_minimum = self_position - query_extent;
  let query_maximum = self_position + query_extent;
  let tree_cell_count = exact_near_cell_tree[18u];
  let tree_leaf_capacity = exact_near_cell_tree[20u];
  let tree_leaf_offset = tree_leaf_capacity - 1u;
  let tree_node_capacity = exact_near_cell_tree[21u];
  let tree_depth = exact_near_cell_tree[23u];
  // This is a complete-tree-depth proof, not a per-source candidate budget.
  // The builder rejects depths above 30, so all pending siblings fit here.
  var node_stack: array<u32, 32>;
  var stack_count = 0u;
  if (
    tree_node_capacity == 0u
    || tree_depth >= 32u
    || !ss_exact_near_finite(query_minimum.x)
    || !ss_exact_near_finite(query_minimum.y)
    || !ss_exact_near_finite(query_minimum.z)
    || !ss_exact_near_finite(query_maximum.x)
    || !ss_exact_near_finite(query_maximum.y)
    || !ss_exact_near_finite(query_maximum.z)
    || !all(query_minimum <= query_maximum)
  ) {
    malformed = true;
  } else {
    node_stack[0u] = 0u;
    stack_count = 1u;
    for (
      var node_iteration = 0u;
      node_iteration < tree_node_capacity && stack_count > 0u;
      node_iteration = node_iteration + 1u
    ) {
      stack_count = stack_count - 1u;
      let node_index = node_stack[stack_count];
      if (node_index >= tree_node_capacity) {
        malformed = true;
        break;
      }
      reaction_discovery_increment_counter(
        REACTION_DISCOVERY_EVIDENCE_TREE_NODE_VISITS
      );
      if (!ss_exact_cell_tree_node_intersects(
        node_index,
        query_minimum,
        query_maximum
      )) {
        continue;
      }
      if (ss_exact_cell_tree_node_is_leaf(node_index)) {
        reaction_discovery_increment_counter(
          REACTION_DISCOVERY_EVIDENCE_TREE_LEAF_VISITS
        );
        let cell_index = ss_exact_cell_tree_leaf_cell_index(node_index);
        if (
          node_index < tree_leaf_offset
          || cell_index >= tree_cell_count
          || cell_index >= spatial_expectation.expected_cell_capacity
        ) {
          malformed = true;
          break;
        }
        let member_range = ss_exact_near_cell_member_range(
          spatial_expectation,
          cell_index
        );
        if (member_range.admitted == 0u) {
          malformed = true;
          break;
        }
        for (
          var member_offset = member_range.begin;
          member_offset < member_range.end;
          member_offset = member_offset + 1u
        ) {
          reaction_discovery_increment_counter(
            REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS
          );
          let lookup = ss_exact_near_source_at_member(
            spatial_expectation,
            member_offset
          );
          if (lookup.admitted == 0u) {
            malformed = true;
            break;
          }
          reaction_discovery_consider_pair(
            particle_index,
            lookup.source_index,
            self_material,
            self_position,
            &best
          );
        }
        if (malformed) {
          break;
        }
        continue;
      }
      if (
        node_index >= tree_leaf_offset
        || !ss_exact_cell_tree_node_is_internal(node_index)
      ) {
        malformed = true;
        break;
      }
      let left_child = node_index * 2u + 1u;
      let right_child = left_child + 1u;
      if (
        right_child >= tree_node_capacity
        || stack_count + 2u > 32u
      ) {
        malformed = true;
        break;
      }
      // Right then left preserves complete-tree canonical leaf order.
      node_stack[stack_count] = right_child;
      node_stack[stack_count + 1u] = left_child;
      stack_count = stack_count + 2u;
    }
    if (stack_count != 0u) {
      malformed = true;
    }
  }

  if (!reaction_discovery_flush_hot_counters()) {
    malformed = true;
  }
  if (malformed) {
    reaction_discovery_increment_control_counter(5u);
    return;
  }
  if (best.x >= 0.0 && best.y >= 0.0) {
    reaction_proposals[particle_index] = best;
    reaction_discovery_increment_counter(6u);
  }
}

// This second dispatch performs no lookup. It turns any directory, source, or
// traversal rejection into a complete invalid proposal set before a later
// chemistry kernel can observe the artifact.
@compute @workgroup_size(64)
fn seal(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let fail_closed = atomicLoad(&traversal_evidence[2u]) != 0u
    || atomicLoad(&traversal_evidence[5u]) != 0u
    || atomicLoad(&traversal_evidence[8u]) != 0u
    || atomicLoad(&traversal_evidence[REACTION_DISCOVERY_EVIDENCE_OVERFLOW]) != 0u
    || atomicLoad(&traversal_evidence[0u]) != params.particle_count
    || atomicLoad(&traversal_evidence[1u]) != params.particle_count;
  if (fail_closed) {
    reaction_proposals[particle_index] = reaction_discovery_invalid_proposal();
  }
  reaction_discovery_increment_counter(7u);
}
`;function _e({authentication:e,proposalBuffer:t,evidenceBuffer:n,observedEvidence:i=null,byteLength:a,capacityByteLength:o=a}){let s=i!=null;return Object.freeze({schema:r,status:`schroeder-spatial-exact-near-gpu-authenticated`,gpuAuthenticated:!0,consumerId:e.consumerId,supportProfileId:e.supportProfileId,generationId:e.generationId,epochIdentity:e.epochIdentity,traversalCount:1,candidateVisitCount:i?.candidateVisitCount??0,exactCellTreeNodeVisitCount:i?.exactCellTreeNodeVisitCount??0,exactCellTreeLeafVisitCount:i?.exactCellTreeLeafVisitCount??0,exactCellTreeMemberVisitCount:i?.exactCellTreeMemberVisitCount??0,consumerMaskHitCount:i?.compatiblePairCount??0,migratedProposalCount:i?.proposalCount??0,ruleIndexPairLookupCount:i?.ruleIndexPairLookupCount??0,ruleIndexPairMissCount:i?.ruleIndexPairMissCount??0,ruleIndexRuleVisitCount:i?.ruleIndexRuleVisitCount??0,fullRuleScanRuleVisitCount:i?.fullRuleScanRuleVisitCount??0,candidateBytesRequired:a,candidateBytesAdmitted:a,candidateBytesCapacity:o,candidateOverflowBytes:0,privateLookupBuildCount:0,fixedCandidateBuildCount:0,exhaustiveTraversalCount:0,overflowed:!1,partialPublication:!1,fallbackObserved:!1,fullReadbackPerformed:!1,residentCounterBuffer:n,residentProposalBuffer:t,residentCountersObserved:s,compactReadbackByteLength:s?27*Uint32Array.BYTES_PER_ELEMENT:0,observationMode:s?`explicit-compact-diagnostic-observation`:`gpu-resident-seal-unobserved`,failClosedSealDispatchCount:1})}async function ve({device:t,generation:n,sphParticleState:r=null,sphParticleUpload:i=null,positionAuthorityStateBuffer:o=null,sourceStateBuffer:c=null,sourceThermoBuffer:u=null,reactionTable:d,reactionRecordBuffer:g=null,gpuTimestampRecorder:_=null,observeGpuEvidence:v=!1}={}){if(!t?.createBuffer||!t.queue?.writeBuffer||!t.queue?.submit)throw TypeError(`canonical reaction discovery requires a WebGPU-like device`);let y=oe(n?.source?.sourceCount,`generation.source.sourceCount`,T);if(r?.particleCount!=null&&r.particleCount!==y)throw RangeError(`reaction discovery particle count does not match the canonical epoch`);let{reactionCount:b,combined:x}=fe(d),S=p(x),E=pe({reactionTable:d,combined:x,reactionCount:b,allowIndex:g==null&&b>1,fallbackReason:g?`borrowed-caller-reaction-record-buffer`:`single-reaction-full-scan-is-cheaper`,reactionTableFingerprint:S}),D=E.upload,ie=p(D),k=me(d),A=j(t,c||i?.stateBuffer,`reaction discovery sourceStateBuffer`),M=n?.source?.sourceStateBuffer??n?.source?.exactNearQueryProfile?.sourceStateBuffer??null,N=j(t,o||M,`reaction discovery positionAuthorityStateBuffer`);if(!M||N!==M)throw TypeError(`reaction discovery position authority must be the exact source-state buffer retained by the canonical generation`);let P=j(t,u||i?.thermoBuffer,`reaction discovery sourceThermoBuffer`),I=j(t,n?.source?.sourceBuffer??n?.source?.activeNodeBuffer,`reaction discovery canonical sourceBuffer`);le(A,y*2*4*Float32Array.BYTES_PER_ELEMENT,`reaction discovery sourceStateBuffer`),le(N,y*2*4*Float32Array.BYTES_PER_ELEMENT,`reaction discovery positionAuthorityStateBuffer`),le(P,y*3*4*Float32Array.BYTES_PER_ELEMENT,`reaction discovery sourceThermoBuffer`);let L=f(n,{device:t,runtime:n.runtime,consumerId:C,supportProfileId:a,sourceBuffer:I,expected:{generationId:n.execution?.generationId,sourceCount:y,storageGeneration:n.execution?.storageGeneration,physicsTick:n.execution?.physicsTick,physicsSubstep:n.execution?.physicsSubstep,positionEpoch:n.execution?.positionEpoch,topologyEpoch:n.execution?.topologyEpoch,supportEpoch:n.execution?.supportEpoch}});if(L?.ready!==!0||L.authenticated!==!0)throw TypeError(L?.reason||`reaction discovery could not authenticate the canonical generation`);let R=j(t,L.directoryBuffer,`reaction discovery canonical directoryBuffer`),ve=m(n?.exactNearCellTree,{device:t,spatialExecution:n?.execution,supportProfileId:a});if(ve.ready!==!0)throw TypeError(`reaction discovery requires the submitted same-epoch exact-near cell tree`);let ye=j(t,ve.treeBuffer,`reaction discovery exactNearCellTreeBuffer`);ue(t,D.byteLength,`reaction discovery reaction record buffer`);let be=y*4*Float32Array.BYTES_PER_ELEMENT;ue(t,be,`reaction discovery proposal buffer`);let xe=de({device:t,generation:n,proposalBytes:be,localReactionRecordBytes:g?0:D.byteLength,observeGpuEvidence:v===!0}),{entry:z,lease:B}=xe,V=g?j(t,g,`reaction discovery reactionRecordBuffer`):z.reactionRecordBuffer;le(V,D.byteLength,`reaction discovery reactionRecordBuffer`),t.queue.writeBuffer(V,0,D);let Se=z.proposalBuffer,H=new Uint32Array(27);H[9]=a,H[10]=L.generationId,H[11]=L.epochIdentity.supportEpoch,H[12]=y,H[13]=b,H[21]=re;let U=z.evidenceBuffer,W=v===!0?z.evidenceReadbackBuffer:null,Ce=U,we=z.expectationBuffer,Te=z.paramsBuffer;t.queue.writeBuffer(we,0,L.expectationData),t.queue.writeBuffer(Te,0,he({particleCount:y,reactionCount:b,maximumContactRadiusM:k,reactionRuleIndex:E,collectDiagnosticEvidence:v===!0})),t.queue.writeBuffer(U,0,H);let G=e(t,{cacheKey:`ulg-schroeder-spatial-reaction-discovery-displacement.${w}`,label:`ulg-schroeder-spatial-reaction-discovery-displacement`,code:ge,entryPoint:`prepare_displacement_certificate`,bindings:[l(0,`read-only-storage`),l(2,`read-only-storage`),l(7,`storage`),l(9,`uniform`)]}),Ee=e(t,{cacheKey:`ulg-schroeder-spatial-reaction-discovery-proposal.${w}`,label:`ulg-schroeder-spatial-reaction-discovery-proposal`,code:ge,entryPoint:`propose`,bindings:[l(0,`read-only-storage`),l(1,`read-only-storage`),l(2,`read-only-storage`),l(3,`read-only-storage`),l(4,`read-only-storage`),l(5,`read-only-storage`),l(6,`storage`),l(7,`storage`),l(8,`uniform`),l(9,`uniform`)]}),De=e(t,{cacheKey:`ulg-schroeder-spatial-reaction-discovery-proposal.${w}`,label:`ulg-schroeder-spatial-reaction-discovery-seal`,code:ge,entryPoint:`seal`,bindings:[l(6,`storage`),l(7,`storage`),l(9,`uniform`)]}),Oe=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-proposal-bindings`,layout:Ee.bindGroupLayout,entries:[{binding:0,resource:{buffer:N}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:V}},{binding:4,resource:{buffer:R}},{binding:5,resource:{buffer:ye}},{binding:6,resource:{buffer:Se}},{binding:7,resource:{buffer:U}},{binding:8,resource:{buffer:we}},{binding:9,resource:{buffer:Te}}]}),ke=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-displacement-bindings`,layout:G.bindGroupLayout,entries:[{binding:0,resource:{buffer:N}},{binding:2,resource:{buffer:A}},{binding:7,resource:{buffer:U}},{binding:9,resource:{buffer:Te}}]}),Ae=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-seal-bindings`,layout:De.bindGroupLayout,entries:[{binding:6,resource:{buffer:Se}},{binding:7,resource:{buffer:U}},{binding:9,resource:{buffer:Te}}]}),K=Math.max(1,Math.ceil(y/64)),q=Number(t?.limits?.maxComputeWorkgroupsPerDimension);if(Number.isFinite(q)&&q>0&&K>q)throw F(z,B),RangeError(`reaction discovery requires ${K} workgroups; device limit is ${q}`);let J=t.createCommandEncoder({label:`ulg-schroeder-spatial-reaction-discovery`}),je=e=>({producerId:`schroeder-spatial-reaction-discovery:${e}`,stage:e,spanClass:`same-production-command-encoder-profiled-pass`,generationId:L.generationId,particleCount:y,reactionCount:b,productionPassGroupingPreserved:!0}),Y=se(_,J,je(`spatial-displacement-certificate`)),Me=J.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-displacement-certificate`});Me.setPipeline(G.pipeline),Me.setBindGroup(0,ke),Me.dispatchWorkgroups(K),Me.end(),ce(_,J,Y);let Ne=se(_,J,je(`candidate-traversal`)),Pe=J.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-proposal`});Pe.setPipeline(Ee.pipeline),Pe.setBindGroup(0,Oe),Pe.dispatchWorkgroups(K),Pe.end(),ce(_,J,Ne);let Fe=se(_,J,je(`proposal-seal`)),X=J.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-seal`});X.setPipeline(De.pipeline),X.setBindGroup(0,Ae),X.dispatchWorkgroups(K),X.end(),ce(_,J,Fe),v===!0&&J.copyBufferToBuffer(U,0,W,0,27*Uint32Array.BYTES_PER_ELEMENT),t.queue.submit([J.finish()]);let Z=null;if(v===!0){let e,t=!1;try{await W.mapAsync(ae.READ),t=!0,e=new Uint32Array(W.getMappedRange(),0,27).slice()}catch(e){throw F(z,B),e}finally{t&&W.unmap()}if(Z=Object.freeze({sourceDispatchCount:e[0],directoryAdmissionCount:e[1],directoryRejectionCount:e[2],candidateVisitCount:e[3],compatiblePairCount:e[4],malformedTraversalCount:e[5],proposalCount:e[6],sealedRowCount:e[7],sourceIdentityRejectionCount:e[8],supportProfileId:e[9],generationId:e[10],supportEpoch:e[11],particleCount:e[12],reactionCount:e[13],privateLookupBuildCount:e[14],overflowCount:e[15],ruleIndexPairLookupCount:e[16],ruleIndexPairMissCount:e[17],ruleIndexRuleVisitCount:e[18],fullRuleScanRuleVisitCount:e[19],maximumDisplacementBits:e[20],displacementCertificateStatusBits:e[21],authorityActiveCount:e[22],currentActiveCount:e[23],exactCellTreeNodeVisitCount:e[24],exactCellTreeLeafVisitCount:e[25],exactCellTreeMemberVisitCount:e[26]}),Z.sourceDispatchCount!==y||Z.directoryAdmissionCount!==y||Z.directoryRejectionCount!==0||Z.malformedTraversalCount!==0||Z.proposalCount>y||Z.sealedRowCount!==y||Z.sourceIdentityRejectionCount!==0||Z.supportProfileId!==65538||Z.generationId!==L.generationId||Z.supportEpoch!==L.epochIdentity.supportEpoch||Z.particleCount!==y||Z.reactionCount!==b||Z.privateLookupBuildCount!==0||Z.overflowCount!==0||Z.displacementCertificateStatusBits!==re)throw F(z,B),Error(`Canonical reaction discovery GPU completion evidence was missing or rejected: ${JSON.stringify(Z)}`)}let Ie=_e({authentication:L,proposalBuffer:Se,evidenceBuffer:U,observedEvidence:Z,byteLength:be,capacityByteLength:z.proposalCapacityBytes}),Q=h(L,Ie),Le=!1,Re={schema:ee,status:`schroeder-spatial-reaction-discovery-proposal-submitted`,ready:!0,backend:`webgpu`,consumerId:C,supportProfileId:a,particleCount:y,reactionCount:b,maximumContactRadiusM:k,generation:n,generationId:L.generationId,epochIdentity:L.epochIdentity,sourcePositionAuthority:`exact-canonical-generation-source-state-buffer`,sourceCurrentStateAuthority:A===N?`same-buffer-as-canonical-position-authority`:`same-device-current-state-with-canonical-position-authority`,sourceThermalAuthority:`same-device-current-thermo-buffer`,positionAuthorityIdentityExact:!0,activationValidation:`post-thermal-proposal-filtered-and-revalidated-before-mutation`,proposalSelection:`post-thermal-nearest-phase-temperature-material-contact-then-partner-then-reaction`,displacementCertification:`gpu-parallel-e-star-to-current-state-maximum-displacement-and-active-mask-equality`,displacementCertificateBuffer:Ce,displacementCertificateStorage:`traversal-evidence-words-20-through-23`,sourceCurrentStateBuffer:A,sourceThermoBuffer:P,proposalBuffer:Se,proposalBufferByteLength:be,proposalBufferCapacityByteLength:z.proposalCapacityBytes,proposalRowLayout:te,proposalRowStrideFloats:4,reactionRecordBuffer:V,reactionTable:d,reactionTableFingerprint:S,reactionDiscoveryPayloadFingerprint:ie,reactionRuleIndex:E,reactionRecordPrefixByteLength:x.byteLength,reactionRecordUploadByteLength:D.byteLength,reactionRecordBufferOwned:!1,reactionRecordBufferOwnership:g?`borrowed-caller-buffer`:`per-device-canonical-generation-arena-cache`,reactionRecordBufferCapacityByteLength:g?Number(g.size)||x.byteLength:z.reactionRecordCapacityBytes,evidenceBuffer:U,evidenceBufferByteLength:H.byteLength,directoryBuffer:R,exactNearCellTree:ve.tree,exactNearCellTreeBuffer:ye,exactNearCellTreeTraversal:`canonical-complete-binary-cell-aabb-leaf-streaming-v1`,expectationBuffer:we,positionAuthorityStateBuffer:N,expectationBufferByteLength:s,evidenceLayout:ne,observedEvidence:Z,evidenceObservationRequested:v===!0,evidenceObservationMode:v===!0?`explicit-compact-diagnostic-observation`:`gpu-resident-seal-unobserved`,evidenceObservationReadbackByteLength:v===!0?27*Uint32Array.BYTES_PER_ELEMENT:0,authentication:L,gpuEvidence:Ie,receipt:Q,bufferOwnership:`per-device-canonical-generation-arena-cache`,spatialArenaIndex:z.arenaIndex,arenaAcquisitionOrdinal:B.acquisitionOrdinal,bufferCreationCount:xe.bufferCreationCount,arenaTotalBufferCreationCount:z.totalBufferCreationCount,arenaWarmReuse:xe.bufferCreationCount===0,traversalCount:1,displacementCertificateDispatchCount:1,displacementCertificateWorkgroupCount:K,displacementCertificateReductionStrategy:`particle-parallel-atomic-u32-max-and-topology-reduction`,sealDispatchCount:1,directoryBuildCount:0,privateLookupBuildCount:0,fixedCandidateBuildCount:0,exhaustiveTraversalCount:0,candidateBudget:null,candidateMaterialization:`one-deterministic-best-row-per-source`,fallbackObserved:!1,fullReadbackPerformed:!1,readbackMode:`no-full-readback`,cleanupTemporaryBuffersAfterSubmittedWork:()=>!1,destroy:()=>Le?!1:(Le=!0,F(z,B)),get released(){return Le}};return O.set(Re,{proposal:Re,generation:n,directoryBuffer:R,exactNearCellTree:ve.tree,exactNearCellTreeBuffer:ye,expectationBuffer:we,positionAuthorityStateBuffer:N,sourceCurrentStateBuffer:A,sourceThermoBuffer:P,displacementCertificateBuffer:Ce,reactionTable:d,reactionTableFingerprint:S,reactionDiscoveryPayloadFingerprint:ie,reactionRuleIndex:E,reactionRecordBuffer:V,receipt:Q}),Object.freeze(Re)}var ye=S({SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_ID:()=>B,SCHROEDER_SPATIAL_REACTION_PLACEMENT_STAGE_ID:()=>z,ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_LIVENESS_SCHEMA:()=>Se,ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_POSITION_EPOCH_FLOOR_RECEIPT_SCHEMA:()=>V,ULG_SCHROEDER_SPATIAL_REACTION_PLACEMENT_SOURCE_FAMILY_SCHEMA:()=>be,ULG_SPH_REACTION_RESOLVE_POSITION_INVARIANT_CERTIFICATE_SCHEMA:()=>xe,ULG_SPH_REACTION_WARM_ARENA_LEASE_SCHEMA:()=>U,ULG_SPH_REACTION_WARM_ARENA_SCHEMA:()=>H,acquireSphReactionWarmArenaWebGpu:()=>Be,acquireSphReactionWarmArenaWithBackpressureWebGpu:()=>Ve,createSphReactionResolvePositionInvariantCertificate:()=>$e,finalizeSchroederSpatialReactionPlacementPositionEpochFloor:()=>it,isSchroederSpatialReactionPlacementSourceFamily:()=>tt,releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue:()=>st,releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue:()=>Ke,releaseSphReactionWarmArenaAfterQueue:()=>qe,resolveSchroederSpatialReactionPlacementSourceFamily:()=>nt,resolveSphReactionWarmArenaLease:()=>Ue,runSchroederSpatialReactionPlacementEpochWebGpu:()=>ct,schroederSpatialReactionPlacementSourceFamilyLiveness:()=>rt,transferSchroederSpatialReactionPlacementDestinationOwnership:()=>ot,validateSchroederSpatialReactionPlacementPositionEpochFloor:()=>at});const be=`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`,xe=`peercompute.ulg.sph-reaction-resolve-position-invariant-certificate.v1`,z=`post-reaction-pre-placement`,B=`schroeder-shared-canonical-displaced-post-reaction-pre-placement-x-r`,V=`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`,Se=`peercompute.ulg.schroeder-spatial-reaction-placement-liveness.v1`,H=`peercompute.ulg.sph-reaction-warm-arena.v1`,U=`peercompute.ulg.sph-reaction-warm-arena-lease.v1`,W={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Ce=new WeakSet,we=new WeakMap,Te=new WeakSet,G=new WeakMap,Ee=new WeakSet,De=new WeakMap,Oe=new WeakMap,ke=new WeakMap,Ae=new WeakMap;function K(e,t=`CONTRACT`){let n=Error(e);return n.code=`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_${t}`,n}function q(e,t,{positive:n=!1}={}){if(typeof e!=`number`||!Number.isInteger(e)||e<+!!n||e>4294967295)throw K(`${t} must be an exact ${n?`positive `:``}u32`,`IDENTITY`);return e}function J(e,t){let n=q(e,t);if(n===4294967295)throw K(`${t} exhausted the u32 identity space; wrapping would alias a live epoch`,`IDENTITY_EXHAUSTED`);return n+1}function je(e,t){return Number.isInteger(e)&&e>=0&&e<4294967295&&Number.isInteger(t)&&t===e+1}function Y(e,t,n,r=0){if(!t||i(t)!==e||!o(t,e))throw K(`${n} must be a tagged live buffer on the placement device`,`DEVICE_MISMATCH`);if(r>0&&Number.isFinite(Number(t.size))&&Number(t.size)<r)throw K(`${n} has ${t.size} bytes; ${r} required`,`CAPACITY`);return t}function Me(e,t,n){if(t?.selected!==!0||t?.ready!==!0||t?.execution?.released===!0||t?.releaseScheduled===!0)throw K(`placement epoch requires one live selected ancestor public generation`,`ANCESTOR_GENERATION`);if(t.source?.sourceCount!==n||t.execution?.sourceCount!==n)throw K(`placement particle count does not match the ancestor public generation`,`ANCESTOR_GENERATION`);q(t.execution?.generationId,`ancestor generationId`,{positive:!0}),q(t.execution?.storageGeneration,`ancestor storageGeneration`,{positive:!0});for(let e of[`physicsTick`,`physicsSubstep`,`positionEpoch`,`topologyEpoch`,`chartEpoch`,`levelEpoch`,`supportEpoch`])q(t.execution?.[e],`ancestor ${e}`);Y(e,t.execution?.directoryBuffer,`ancestor public directory`),g(t,e);let r=t.execution?.exactNearQueryProfile;if(r?.ready!==!0||t.source?.exactNearQueryProfile?.ready!==!0||t.execution?.queryChartId!==r.chartId||t.execution?.queryMinLevel!==r.minLevel||t.execution?.queryMaxLevel!==r.maxLevel||!Object.is(t.execution?.queryBaseGridSpacingM,r.baseGridSpacingM))throw K(`ancestor generation lacks exact authenticated query geometry`,`ANCESTOR_QUERY_GEOMETRY`);return t}function Ne(e){return Object.freeze({storageGeneration:q(e?.storageGeneration,`placement storageGeneration`,{positive:!0}),physicsTick:q(e?.physicsTick,`placement physicsTick`),physicsSubstep:q(e?.physicsSubstep,`placement physicsSubstep`),positionEpoch:q(e?.positionEpoch,`placement positionEpoch`),topologyEpoch:q(e?.topologyEpoch,`placement topologyEpoch`),chartEpoch:q(e?.chartEpoch,`placement chartEpoch`),levelEpoch:q(e?.levelEpoch,`placement levelEpoch`),supportEpoch:q(e?.supportEpoch,`placement supportEpoch`)})}function Pe(e,n,r){return t(e.createBuffer({label:n,size:Math.max(4,r),usage:W.STORAGE|W.COPY_SRC|W.COPY_DST}),e)}function Fe(e,t,n){let r=e*t*Float32Array.BYTES_PER_ELEMENT;if(!Number.isSafeInteger(r)||r<4)throw K(`${n} capacity is not safely addressable`,`WARM_ARENA_CAPACITY`);return r}function X(e,t,n){let r=[Number(e?.limits?.maxBufferSize),Number(e?.limits?.maxStorageBufferBindingSize)].filter(e=>Number.isFinite(e)&&e>0),i=r.length>0?Math.min(...r):2**53-1;if(t>i)throw K(`${n} requires ${t} bytes; device limit is ${i}`,`WARM_ARENA_CAPACITY`);return t}function Z(e){let t=Oe.get(e);return t||(t=new Map,Oe.set(e,t)),t}function Ie({particleCapacity:e,productEventCapacity:t,productTermCapacity:n,packedParticleStrideFloats:r,productEventStrideFloats:i,productPlacementSummaryStrideFloats:a}){return[e,t,n,r,i,a].join(`:`)}function Q(e,n,r,i,a){let o=t(e.createBuffer({label:r,size:Math.max(4,i),usage:a}),e);return n.push(o),o}function Le(e,{force:t=!1}={}){if(!e||e.destroyed)return!1;if(e.inFlight&&!e.deviceLost&&!t)throw K(`cannot destroy an in-flight reaction warm arena`,`WARM_ARENA_LEASE`);e.destroyed=!0,e.terminal=!0,e.inFlight=!1,e.phase=`destroyed`;for(let t of e.ownedBuffers)try{t?.destroy?.()}catch{}return e.ownedBuffers.clear(),!0}function Re(e){let t=e.device?.lost;if(!t||typeof t.then!=`function`){e.deviceLossStatus=`device-loss-promise-unavailable`;return}e.deviceLossStatus=`device-loss-quarantine-armed`,Promise.resolve(t).then(t=>{e.deviceLost=!0,e.terminal=!0,e.deviceLossStatus=`device-loss-quarantined`,e.deviceLossReason=t?.message??String(t||`device lost`),Le(e,{force:!0})},t=>{e.deviceLost=!0,e.terminal=!0,e.deviceLossStatus=`device-loss-quarantined-after-rejection`,e.deviceLossReason=t instanceof Error?t.message:String(t),Le(e,{force:!0})})}function ze(e,t,n){let{particleCapacity:r,productEventCapacity:i,productTermCapacity:a,packedParticleStrideFloats:o,productEventStrideFloats:s,productPlacementSummaryStrideFloats:c,capacityKey:l}=t,d=X(e,Fe(r,o,`packed reaction particle rows`),`packed reaction particle rows`),f=X(e,Fe(r,b,`reaction state rows`),`reaction state rows`),p=X(e,Fe(r,u,`reaction thermo rows`),`reaction thermo rows`),m=X(e,Fe(r,v,`reaction mechanics rows`),`reaction mechanics rows`),h=X(e,Fe(i,s,`reaction product-event rows`),`reaction product-event rows`),g=X(e,Fe(a,c,`reaction product-placement summary rows`),`reaction product-placement summary rows`),_=[],y=`ulg-sph-reaction-warm-${l}-slot-${n}`,x=W.STORAGE|W.COPY_SRC|W.COPY_DST;try{let t=Object.freeze({packedSource:Q(e,_,`${y}-packed-source`,d,x),packedOutput:Q(e,_,`${y}-packed-output`,d,x),fallbackState:Q(e,_,`${y}-fallback-state`,f,x),fallbackThermo:Q(e,_,`${y}-fallback-thermo`,p,x),fallbackMechanics:Q(e,_,`${y}-fallback-mechanics`,m,x),resolvedState:Q(e,_,`${y}-resolved-state`,f,x),resolvedThermo:Q(e,_,`${y}-resolved-thermo`,p,x),resolvedMechanics:Q(e,_,`${y}-resolved-mechanics`,m,x),placedState:Q(e,_,`${y}-placed-state`,f,x),placedThermo:Q(e,_,`${y}-placed-thermo`,p,x),placedMechanics:Q(e,_,`${y}-placed-mechanics`,m,x),productEvent:Q(e,_,`${y}-product-event`,h,x),productPlacementSummary:Q(e,_,`${y}-product-placement-summary`,g,x),reactionParams:Q(e,_,`${y}-reaction-params`,48,W.UNIFORM|W.COPY_DST),summaryParams:Q(e,_,`${y}-summary-params`,48,W.UNIFORM|W.COPY_DST)}),u=Object.freeze({schema:H,status:`sph-reaction-warm-arena-ready`,capacityKey:l,slotIndex:n,particleCapacity:r,productEventCapacity:i,productTermCapacity:a,packedParticleStrideFloats:o,productEventStrideFloats:s,productPlacementSummaryStrideFloats:c,buffers:t}),v={device:e,arena:u,buffers:t,ownedBuffers:new Set(_),bufferCreationCount:_.length,acquisitionCount:0,warmReuseCount:0,leaseOrdinal:0,inFlight:!1,phase:`idle`,terminal:!1,deviceLost:!1,destroyed:!1,deviceLossStatus:`device-loss-quarantine-not-armed`,deviceLossReason:null,releaseFence:null,boundSourceFamily:null,destinationOwnershipTransferred:!1};return ke.set(u,v),Re(v),u}catch(e){for(let e of _.reverse())try{e?.destroy?.()}catch{}throw e}}function Be({device:e,particleCapacity:t,productEventCapacity:n,productTermCapacity:r,packedParticleStrideFloats:i=52,productEventStrideFloats:a=32,productPlacementSummaryStrideFloats:o=32}={}){if(!e?.createBuffer||!e?.queue?.writeBuffer)throw TypeError(`reaction warm arena acquisition requires a WebGPU-like device`);let s={particleCapacity:q(t,`reaction warm particleCapacity`,{positive:!0}),productEventCapacity:q(n,`reaction warm productEventCapacity`,{positive:!0}),productTermCapacity:q(r,`reaction warm productTermCapacity`,{positive:!0}),packedParticleStrideFloats:q(i,`reaction warm packedParticleStrideFloats`,{positive:!0}),productEventStrideFloats:q(a,`reaction warm productEventStrideFloats`,{positive:!0}),productPlacementSummaryStrideFloats:q(o,`reaction warm productPlacementSummaryStrideFloats`,{positive:!0})};s.capacityKey=Ie(s);let c=Z(e),l=c.get(s.capacityKey);l||(l={records:[]},c.set(s.capacityKey,l)),l.records=l.records.filter(e=>!e.destroyed);let u=l.records.find(e=>!e.inFlight&&!e.terminal&&!e.deviceLost&&!e.destroyed)??null,d=0;if(u)u.warmReuseCount+=1;else{if(l.records.length>=3){let e=K(`reaction warm arena ${s.capacityKey} is under bounded backpressure`,`WARM_ARENA_BACKPRESSURE`),t=l.records.map(e=>e.releaseFence).filter(e=>e?.then);throw e.retryAfterFence=t.length>0?Promise.any(t.map(e=>Promise.resolve(e).then(e=>{if(e===!0)return!0;throw K(`reaction warm arena release did not confirm reusable ownership`,`WARM_ARENA_BACKPRESSURE_RELEASE`)}))).then(()=>!0,()=>!1):null,e}let t=new Set(l.records.map(e=>e.arena.slotIndex)),n=0;for(;t.has(n);)n+=1;let r=ze(e,s,n);u=ke.get(r),l.records.push(u),d=u.bufferCreationCount}u.inFlight=!0,u.phase=`leased`,u.acquisitionCount+=1,u.leaseOrdinal+=1,u.releaseFence=null,u.boundSourceFamily=null,u.destinationOwnershipTransferred=!1;let f=Object.freeze({schema:U,status:`sph-reaction-warm-arena-leased`,arena:u.arena,leaseOrdinal:u.leaseOrdinal,bufferCreationCount:d,warmReuse:d===0});return Ae.set(f,{record:u,leaseOrdinal:u.leaseOrdinal,releaseScheduled:!1,released:!1}),f}async function Ve(e={}){for(;;)try{return Be(e)}catch(e){if(e?.code!==`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_BACKPRESSURE`)throw e;if(!e.retryAfterFence?.then){let t=K(`reaction warm arena is exhausted without a scheduled exact-owner release`,`WARM_ARENA_BACKPRESSURE_UNRELEASABLE`);throw t.cause=e,t}let t=!1;try{t=await e.retryAfterFence}catch{t=!1}if(t!==!0){let t=K(`reaction warm arena queue fences completed without a reusable slot`,`WARM_ARENA_BACKPRESSURE_RELEASE_FAILED`);throw t.cause=e,t}}}function He(e,{device:t=null}={}){let n=Ae.get(e),r=n?.record;if(!n||!r||r.destroyed||r.terminal||!r.inFlight||r.phase!==`leased`||n.releaseScheduled||n.released||n.leaseOrdinal!==r.leaseOrdinal||e?.arena!==r.arena||t&&r.device!==t)throw K(`reaction warm arena lease is stale, terminal, or foreign`,`WARM_ARENA_LEASE`);return{leaseRecord:n,record:r}}function Ue(e,{device:t,particleCapacity:n=null,productEventCapacity:r=null,productTermCapacity:i=null}={}){let{record:a}=He(e,{device:t}),o=a.arena;for(let[e,t,a]of[[`particleCapacity`,n,o.particleCapacity],[`productEventCapacity`,r,o.productEventCapacity],[`productTermCapacity`,i,o.productTermCapacity]])if(t!=null&&t!==a)throw K(`reaction warm arena ${e} does not match this execution`,`WARM_ARENA_IDENTITY`);return o}function We(e,t,n){let{record:r}=He(e,{device:n});if(r.boundSourceFamily&&r.boundSourceFamily!==t)throw K(`reaction warm arena is already bound to another placement source family`,`WARM_ARENA_IDENTITY`);return r.boundSourceFamily=t,!0}function Ge(e,t,n){let{record:r}=He(e,{device:n});if(r.boundSourceFamily!==t)throw K(`reaction warm destination transfer requires its exact source family`,`WARM_ARENA_OWNERSHIP`);return r.destinationOwnershipTransferred?!1:(r.destinationOwnershipTransferred=!0,!0)}function Ke(e,{completionFence:t=null}={}){if(!tt(e))throw K(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=G.get(e);if(!n||!n.destinationOwnershipTransferred||n.lifecycle.releaseScheduled!==!0||!n.finalizedPlacementArtifact||!n.positionEpochFloorReceipt)throw K(`transferred placement destinations require their exact finalized owner handoff`,`OWNERSHIP_TRANSFER`);if(n.destinationReturnScheduled)return!1;let r=t??(typeof n.device.queue?.onSubmittedWorkDone==`function`?n.device.queue.onSubmittedWorkDone():null);if(!r?.then)throw K(`transferred placement destination release requires a queue fence`,`OWNERSHIP_TRANSFER_FENCE`);let i=n.lifecycle.releasePromise?.then?n.lifecycle.releasePromise:Promise.resolve(!0),a=Promise.all([i,r]).then(([e])=>{if(e!==!0)throw K(`placement source retirement was not confirmed before destination return`,`OWNERSHIP_TRANSFER_FENCE`);return!0});return n.destinationReturnScheduled=!0,n.reactionWarmArenaLease?(n.destinationReturnPromise=qe(n.reactionWarmArenaLease,{device:n.device,completionFence:a,destinationOwner:e}),n.destinationReturnPromise):(n.destinationReturnPromise=a.then(()=>($(n,`placed-state`,n.family.placedDestinationStateBuffer),$(n,`placed-thermo`,n.family.placedDestinationThermoBuffer),$(n,`placed-mechanics`,n.family.placedDestinationMechanicsBuffer),!0)),n.destinationReturnPromise)}function qe(e,{device:t,completionFence:n=null,destinationOwner:r=null,abandon:i=!1,destroy:a=!1}={}){let{leaseRecord:o,record:s}=He(e,{device:t});if(s.destinationOwnershipTransferred&&i!==!0&&r!==s.boundSourceFamily)throw K(`reaction warm arena release requires the exact transferred destination owner`,`WARM_ARENA_OWNERSHIP`);let c=n??(typeof t?.queue?.onSubmittedWorkDone==`function`?t.queue.onSubmittedWorkDone():null);if(!c||typeof c.then!=`function`)throw K(`reaction warm arena release requires a genuine queue completion fence`,`WARM_ARENA_FENCE`);return o.releaseScheduled=!0,s.phase=`retiring`,s.releaseFence=Promise.resolve(c).then(()=>(o.released=!0,s.inFlight=!1,s.boundSourceFamily=null,s.destinationOwnershipTransferred=!1,a||s.terminal||s.deviceLost?(Le(s,{force:!0}),!1):(s.phase=`idle`,!0)),e=>(o.released=!0,s.inFlight=!1,s.terminal=!0,s.deviceLossStatus=`queue-fence-rejected-arena-quarantined`,s.deviceLossReason=e instanceof Error?e.message:String(e),Le(s,{force:!0}),!1)),s.releaseFence}function Je({frozenSourceStateBuffer:e,frozenSourceThermoBuffer:t,frozenSourceMechanicsBuffer:n,placedDestinationStateBuffer:r,placedDestinationThermoBuffer:i,placedDestinationMechanicsBuffer:a}){let o=[e,t,n],s=[r,i,a];if(new Set(o).size!==o.length)throw K(`frozen placement state, thermo, and mechanics sources must be distinct buffers`,`SOURCE_ALIAS`);for(let e of s)if(o.includes(e))throw K(`frozen placement sources and mutable placed destinations must never alias`,`SOURCE_DESTINATION_ALIAS`);if(new Set(s).size!==s.length)throw K(`placed state, thermo, and mechanics destinations must be distinct buffers`,`DESTINATION_ALIAS`)}function Ye(e,t){let n=e.createCommandEncoder({label:`ulg-schroeder-reaction-placement-destination-initialize`});if(typeof n?.copyBufferToBuffer!=`function`)throw K(`placement destination initialization requires copyBufferToBuffer`,`COPY_UNAVAILABLE`);n.copyBufferToBuffer(t.frozenSourceStateBuffer,0,t.placedDestinationStateBuffer,0,t.stateBufferByteLength),n.copyBufferToBuffer(t.frozenSourceThermoBuffer,0,t.placedDestinationThermoBuffer,0,t.thermoBufferByteLength),n.copyBufferToBuffer(t.frozenSourceMechanicsBuffer,0,t.placedDestinationMechanicsBuffer,0,t.mechanicsBufferByteLength),e.queue.submit([n.finish()]);let r=e.queue?.onSubmittedWorkDone?.();if(!r?.then)throw K(`placement destination initialization requires an exact queue fence`,`QUEUE_FENCE`);return r}function $(e,t,n){e.destroyed.has(t)||(e.destroyed.add(t),n?.destroy?.())}function Xe(e){e.auxiliaryDestroyed||(e.auxiliaryDestroyed=!0,typeof e.levelAssignment?.destroyAssignmentBuffer==`function`?e.levelAssignment.destroyAssignmentBuffer():$(e,`level-assignment`,e.levelAssignment?.assignmentBuffer),e.reactionWarmArenaLease||($(e,`frozen-state`,e.family.frozenSourceStateBuffer),$(e,`frozen-thermo`,e.family.frozenSourceThermoBuffer),$(e,`frozen-mechanics`,e.family.frozenSourceMechanicsBuffer)))}function Ze(e){e.destinationOwnershipTransferred||e.reactionWarmArenaLease||(e.callerOwnedDestinations.state||$(e,`placed-state`,e.family.placedDestinationStateBuffer),e.callerOwnedDestinations.thermo||$(e,`placed-thermo`,e.family.placedDestinationThermoBuffer),e.callerOwnedDestinations.mechanics||$(e,`placed-mechanics`,e.family.placedDestinationMechanicsBuffer))}function Qe(e){let t=e.device?.lost;if(!t||typeof t.then!=`function`){e.lifecycle.deviceLossStatus=`device-loss-promise-unavailable`;return}e.lifecycle.deviceLossStatus=`device-loss-quarantine-armed`,Promise.resolve(t).then(t=>{if(e.lifecycle.releaseStatus!==`released-after-final-consumer`){e.lifecycle.deviceLossStatus=`device-loss-cleanup-running`,e.deviceLost=!0,e.lifecycle.deviceLossReason=t?.message??String(t||`device lost`);try{Xe(e),Ze(e),e.lifecycle.deviceLossStatus=`device-loss-cleanup-completed`}catch(t){e.lifecycle.deviceLossStatus=`device-loss-cleanup-error`,e.lifecycle.deviceLossReason=t instanceof Error?t.message:String(t)}}}).catch(t=>{e.lifecycle.deviceLossStatus=`device-loss-observer-error`,e.lifecycle.deviceLossReason=t instanceof Error?t.message:String(t)})}function $e({device:e,ancestorGeneration:t,reactionInputStateBuffer:n,reactionInputThermoBuffer:r=null,frozenResolvedStateBuffer:i,particleCount:a,reactionDiscoveryProposal:o=null,reactionTable:s=null}={}){let l=q(a,`particleCount`,{positive:!0}),u=Me(e,t,l),d=Y(e,n,`reaction input state`),f=Y(e,i,`frozen resolved state`),p=`exact-ancestor-position-authority-state`,m=q(u.execution.positionEpoch,`ancestor position epoch`),h=!1,g=m,_=null,v=null;if(o==null&&(r!=null||s!=null))throw K(`reaction discovery thermo/table authority cannot be supplied without the exact branded proposal`,`RESOLVE_DISCOVERY_AUTHORITY`);if(o!=null){if(_=Y(e,r,`reaction input thermo`),v=I(o,{device:e,generation:u,particleCount:l,reactionCount:s?.reactionCount,reactionTable:s,sourceStateBuffer:d,sourceThermoBuffer:_}),v?.ready!==!0||v.authenticated===!1||v.admitted!==!0||v.generation!==u||v.positionAuthorityStateBuffer!==u.source?.sourceStateBuffer||v.sourceCurrentStateBuffer!==d||v.sourceThermoBuffer!==_)throw K(v?.reason||`resolve-position certificate requires the exact authenticated reaction discovery source family`,`RESOLVE_DISCOVERY_AUTHORITY`);h=d!==u.source?.sourceStateBuffer,g=h?J(m,`post-G2P reaction discovery position epoch`):m,p=h?`authenticated-displacement-certified-post-g2p-reaction-discovery-current-state`:`authenticated-reaction-discovery-over-exact-ancestor-position-state`}else if(d!==u.source?.sourceStateBuffer)throw K(`resolve-position certificate requires the exact ancestor source state`,`RESOLVE_SOURCE_IDENTITY`);if(n===i)throw K(`reaction input and frozen resolved state must be distinct buffers`,`RESOLVE_ALIAS`);let y=Object.freeze({schema:xe,status:`reaction-resolve-position-invariance-certified`,certified:!0,stageIdentity:`reaction-resolve`,mutationPolicy:`xyz-copied-exactly-mass-velocity-energy-material-phase-mechanics-may-change`,sourceAuthority:p,prePlacementPositionChanged:h,ancestorPositionEpoch:m,resolvedPositionEpoch:g,ancestorGenerationId:u.execution.generationId,ancestorPositionEpoch:u.execution.positionEpoch,particleCount:l,deviceId:c(e)});return Ce.add(y),we.set(y,{device:e,ancestorGeneration:u,reactionInputStateBuffer:d,reactionInputThermoBuffer:_,reactionDiscoveryProposal:o,reactionTable:s,sourceAuthority:p,prePlacementPositionChanged:h,ancestorPositionEpoch:m,resolvedPositionEpoch:g,frozenResolvedStateBuffer:f,particleCount:l}),y}function et(e,{device:t,ancestorGeneration:n,particleCount:r}){if(e.sourceAuthority===`exact-ancestor-position-authority-state`)return e.reactionDiscoveryProposal==null&&e.reactionTable==null&&e.reactionInputThermoBuffer==null&&e.reactionInputStateBuffer===n.source?.sourceStateBuffer&&e.prePlacementPositionChanged===!1&&e.ancestorPositionEpoch===n.execution.positionEpoch&&e.resolvedPositionEpoch===n.execution.positionEpoch;if(![`authenticated-displacement-certified-post-g2p-reaction-discovery-current-state`,`authenticated-reaction-discovery-over-exact-ancestor-position-state`].includes(e.sourceAuthority)||e.reactionDiscoveryProposal==null||e.reactionTable==null||e.reactionInputThermoBuffer==null)return!1;try{let i=I(e.reactionDiscoveryProposal,{device:t,generation:n,particleCount:r,reactionCount:e.reactionTable.reactionCount,reactionTable:e.reactionTable,sourceStateBuffer:e.reactionInputStateBuffer,sourceThermoBuffer:e.reactionInputThermoBuffer}),a=e.reactionInputStateBuffer!==n.source?.sourceStateBuffer,o=a?J(n.execution.positionEpoch,`post-G2P reaction discovery position epoch`):n.execution.positionEpoch;return i?.ready===!0&&i.admitted===!0&&i.generation===n&&i.positionAuthorityStateBuffer===n.source?.sourceStateBuffer&&i.sourceCurrentStateBuffer===e.reactionInputStateBuffer&&i.sourceThermoBuffer===e.reactionInputThermoBuffer&&e.prePlacementPositionChanged===a&&e.ancestorPositionEpoch===n.execution.positionEpoch&&e.resolvedPositionEpoch===o}catch{return!1}}function tt(e){return!!(e&&Te.has(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`&&e.ready===!0&&e.authenticated===!0)}function nt(e,{device:t=null}={}){if(!tt(e))throw K(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=G.get(e);if(!n||t&&n.device!==t)throw K(`placement source family belongs to another device`,`DEVICE_MISMATCH`);if(n.deviceLost)throw K(`placement source family is quarantined after device loss: ${n.lifecycle.deviceLossReason}`,`DEVICE_LOST`);if(n.lifecycle.releaseScheduled===!0||n.lifecycle.releaseStatus===`released-after-final-consumer`)throw K(`placement source family is terminal or retiring`,`RETIRED`);if(Je(e),e.generation!==n.generation||e.ancestorPublicGeneration!==n.generation||e.sharedSpatialAuthorityBorrowed!==!0||e.private!==!1||n.ownsGeneration!==!1||e.directoryBuffer!==n.generation.execution.directoryBuffer||e.directorySourceBuffer!==n.generation.source.sourceBuffer||e.directoryPositionAuthorityStateBuffer!==n.generation.source.sourceStateBuffer)throw K(`placement source family no longer identifies its exact borrowed canonical generation`,`SOURCE_FAMILY_IDENTITY`);return e}function rt(e,{device:t=null}={}){if(!tt(e))throw K(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=G.get(e);if(!n||t&&n.device!==t)throw K(`placement source family belongs to another device`,`DEVICE_MISMATCH`);return Object.freeze({schema:Se,status:n.deviceLost?`schroeder-reaction-placement-source-family-device-lost-quarantined`:n.lifecycle.releaseScheduled?`schroeder-reaction-placement-source-family-retiring`:`schroeder-reaction-placement-source-family-active`,active:!n.deviceLost&&n.lifecycle.releaseScheduled!==!0,releaseScheduled:n.lifecycle.releaseScheduled===!0,releaseStatus:n.lifecycle.releaseStatus,deviceLost:n.deviceLost===!0,deviceLossStatus:n.lifecycle.deviceLossStatus,destinationOwnershipTransferred:n.destinationOwnershipTransferred,destinationStorageGeneration:e.placedDestinationStorageGeneration,deviceId:e.deviceId,generationId:e.generationId})}async function it(e,{placementArtifact:t}={}){let n=nt(e),r=G.get(n);if(r.positionEpochFloorReceipt){if(r.finalizedPlacementArtifact!==t)throw K(`placement source family was already finalized by another artifact`,`DUPLICATE_FINALIZATION`);return r.positionEpochFloorReceipt}let i=await import(`./ulgMechanicsResidentStage.worker-CmXA21pT.js`).then(e=>e.t),a=nt(e,{device:r.device});if(a!==n||G.get(a)!==r||r.generation?.execution?.released===!0||r.generation?.releaseScheduled===!0)throw K(`placement source family retired while finalizing its position epoch floor`,`RETIRED`);if(r.positionEpochFloorReceipt){if(r.finalizedPlacementArtifact!==t)throw K(`placement source family was already finalized by another artifact`,`DUPLICATE_FINALIZATION`);return r.positionEpochFloorReceipt}if(!i.isSubmittedSchroederSpatialReactionProductPlacementArtifact?.(t)||t.submitPerformed!==!0||t.gpuResident!==!0||t.authenticated!==!1||t.gpuAuthenticated!==!1||t.submissionAuthenticated!==!0||t.destinationSafetyAuthenticated!==!0||t.placementOutcomeObserved!==!1||t.transactionalPublicationGateEncoded!==!0||t.transactionalTerminalSealEncoded!==!0||t.transactionalFailClosedRecoveryEncoded!==!0||t.transactionalAuxiliaryMaterializationEncoded!==!0||t.destinationPublicationMode!==`gpu-terminal-safe-placed-or-exact-frozen-fallback`||t.positionMayChange!==!0||t.topologyMayChange!==!0||t.placementSourceFamily!==e||t.generation!==r.generation||t.placedDestinationStateBuffer!==e.placedDestinationStateBuffer||t.placedDestinationThermoBuffer!==e.placedDestinationThermoBuffer||t.placedDestinationMechanicsBuffer!==e.placedDestinationMechanicsBuffer||t.frozenSourceStateBuffer!==e.frozenSourceStateBuffer||t.frozenSourceThermoBuffer!==e.frozenSourceThermoBuffer||t.frozenSourceMechanicsBuffer!==e.frozenSourceMechanicsBuffer)throw K(`position epoch floor requires the exact one-shot resident placement-submission artifact`,`FINALIZATION`);let o=e.epochIdentity.positionEpoch,s=J(o,`placement position epoch floor`),c=Object.freeze({schema:V,status:`schroeder-reaction-placement-position-epoch-floor-authenticated-after-resident-submission`,finalized:!0,authenticated:!0,positionEpochFloorAuthenticated:!0,destinationSafetyAuthenticated:!0,placementOutcomeAuthenticated:!1,submitPerformed:!0,gpuCompletionObserved:!1,placementOutcomeObserved:!1,transactionalPublicationGateEncoded:!0,transactionalTerminalSealEncoded:!0,transactionalFailClosedRecoveryEncoded:!0,transactionalAuxiliaryMaterializationEncoded:!0,destinationPublicationMode:`gpu-terminal-safe-placed-or-exact-frozen-fallback`,completionMode:`gpu-resident-terminal-safe-placed-or-frozen-fallback`,positionMutationObserved:!1,positionMayHaveChanged:!0,positionEpochAdvanceRequired:!0,topologyMayChange:!0,conservativeTopologyAdvanceRequired:!0,sparePlacementEventCount:null,observedPositionMutationEventCount:null,sourcePositionEpoch:o,positionEpochFloor:s,destinationStorageGeneration:e.placedDestinationStorageGeneration,ancestorPublicGenerationId:e.ancestorPublicGenerationId,placementGenerationId:e.generationId,deviceId:e.deviceId});return Ee.add(c),De.set(c,{device:r.device,sourceFamily:e,ancestorPublicGeneration:e.ancestorPublicGeneration,placementArtifact:t,stateBuffer:e.placedDestinationStateBuffer,thermoBuffer:e.placedDestinationThermoBuffer,mechanicsBuffer:e.placedDestinationMechanicsBuffer,sourcePositionEpoch:o,positionEpochFloor:s,destinationStorageGeneration:e.placedDestinationStorageGeneration}),r.finalizedPlacementArtifact=t,r.positionEpochFloorReceipt=c,c}function at(e,{device:t,ancestorPublicGeneration:n}={}){let r=De.get(e);return!!(r&&Ee.has(e)&&Object.isFrozen(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`&&e.finalized===!0&&e.authenticated===!0&&e.positionEpochFloorAuthenticated===!0&&e.destinationSafetyAuthenticated===!0&&e.placementOutcomeAuthenticated===!1&&e.placementOutcomeObserved===!1&&e.transactionalPublicationGateEncoded===!0&&e.transactionalTerminalSealEncoded===!0&&e.transactionalFailClosedRecoveryEncoded===!0&&e.transactionalAuxiliaryMaterializationEncoded===!0&&e.destinationPublicationMode===`gpu-terminal-safe-placed-or-exact-frozen-fallback`&&e.positionMutationObserved===!1&&e.positionMayHaveChanged===!0&&e.positionEpochAdvanceRequired===!0&&r.device===t&&e.deviceId===c(t)&&r.ancestorPublicGeneration===n&&r.sourceFamily.ancestorPublicGeneration===n&&r.sourcePositionEpoch===r.sourceFamily.epochIdentity.positionEpoch&&e.sourcePositionEpoch===r.sourcePositionEpoch&&e.positionEpochFloor===r.positionEpochFloor&&je(e.sourcePositionEpoch,e.positionEpochFloor)&&e.sourcePositionEpoch>=n?.execution?.positionEpoch&&e.positionEpochFloor>n?.execution?.positionEpoch)}function ot(e){if(!tt(e))throw K(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let t=G.get(e);if(!t||t.deviceLost||t.lifecycle.releaseStatus===`released-after-final-consumer`||t.lifecycle.releaseScheduled!==!0||!t.finalizedPlacementArtifact||!t.positionEpochFloorReceipt)throw K(`placement destination ownership can only transfer during the exact retirement handoff`,`OWNERSHIP_TRANSFER`);return t.destinationOwnershipTransferred?!1:(t.reactionWarmArenaLease&&Ge(t.reactionWarmArenaLease,e,t.device),t.destinationOwnershipTransferred=!0,t.lifecycle.destinationOwnership=`transferred-to-reaction-continuation`,!0)}function st(e,{placementArtifact:t=null,abandon:n=!1}={}){if(!tt(e))throw K(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let r=G.get(e);if(!r)throw K(`placement source family has no exact runtime owner record`,`SOURCE_FAMILY_IDENTITY`);if(r.lifecycle.releaseScheduled===!0)return!1;if(nt(e),n!==!0&&(!t||r.finalizedPlacementArtifact!==t||!r.positionEpochFloorReceipt))throw K(`normal placement retirement requires the exact finalized placement artifact and position-epoch-floor receipt`,`FINALIZATION`);r.completion.status=t?`placement-consumer-submitted`:`placement-consumer-submission-observed-without-artifact`,r.completion.placementArtifact=t;let i=t?.queueFence??r.initializationFence??null;return!i?.then||t&&(t.queueFenceStatus!==`exact-queue-submission-fence`||t.arenaReuseAllowed!==!0)?(r.lifecycle.releaseStatus=`retained-without-exact-queue-fence`,r.lifecycle.releaseReason=`placement-family cleanup requires the exact submission queue fence`,!1):(r.lifecycle.releaseScheduled=!0,r.lifecycle.releaseStatus=`borrowed-directory-family-cleanup-scheduled-after-placement-consumer`,r.lifecycle.releasePromise=Promise.resolve(i).then(()=>(Xe(r),Ze(r),r.reactionWarmArenaLease&&!r.destinationOwnershipTransferred&&(r.warmArenaReleasePromise=qe(r.reactionWarmArenaLease,{device:r.device,completionFence:Promise.resolve(!0),abandon:!0})),r.lifecycle.releaseStatus=`released-after-final-consumer`,r.lifecycle.releaseReason=null,r.completion.status=`placement-consumer-completed`,!0)).catch(e=>{if(r.lifecycle.releaseScheduled=!1,r.lifecycle.releaseStatus=`retained-cleanup-fence-error`,r.lifecycle.releaseReason=e instanceof Error?e.message:String(e),r.reactionWarmArenaLease)try{let t=Promise.reject(e);r.warmArenaReleasePromise=qe(r.reactionWarmArenaLease,{device:r.device,completionFence:t,abandon:!0})}catch{}return!1}),!0)}async function ct({device:e,ancestorPublicGeneration:t,sphParticleState:n,mlsMpmParticleState:r,sphParticleUpload:i=null,frozenSourceStateBuffer:a,frozenSourceThermoBuffer:o,frozenSourceMechanicsBuffer:s,stableIdentityBuffer:l=i?.identityBuffer??null,positionInvariantCertificate:f,placedDestinationStateBuffer:p=null,placedDestinationThermoBuffer:m=null,placedDestinationMechanicsBuffer:h=null,reactionWarmArenaLease:g=null}={}){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.submit)throw TypeError(`reaction placement epoch requires a WebGPU-like device and queue`);let _=q(n?.particleCount,`sphParticleState.particleCount`,{positive:!0});if(r?.particleCount!==_)throw K(`SPH and MLS-MPM particle counts must match`,`PARTICLE_COUNT`);let y=Me(e,t,_),x=_*b*Float32Array.BYTES_PER_ELEMENT,S=_*u*Float32Array.BYTES_PER_ELEMENT,ee=_*v*Float32Array.BYTES_PER_ELEMENT,C=(g?Ue(g,{device:e,particleCapacity:_}):null)?.buffers??null,w=Y(e,a,`frozen resolved state`,x),te=Y(e,o,`frozen resolved thermo`,S),ne=Y(e,s,`frozen resolved mechanics`,ee);if(C&&(w!==C.resolvedState||te!==C.resolvedThermo||ne!==C.resolvedMechanics))throw K(`reaction warm arena must carry the exact frozen resolve output family`,`WARM_ARENA_IDENTITY`);let T=we.get(f);if(!Ce.has(f)||!T||T.device!==e||T.ancestorGeneration!==y||!et(T,{device:e,ancestorGeneration:y,particleCount:_})||f.sourceAuthority!==T.sourceAuthority||f.prePlacementPositionChanged!==T.prePlacementPositionChanged||f.ancestorPositionEpoch!==T.ancestorPositionEpoch||f.resolvedPositionEpoch!==T.resolvedPositionEpoch||T.frozenResolvedStateBuffer!==w||T.particleCount!==_)throw K(`numeric position-epoch inheritance requires the exact resolve certificate`,`POSITION_INVARIANCE`);let re=i?.identityRequired===!0,E=_*d*Uint32Array.BYTES_PER_ELEMENT;(re||l)&&Y(e,l,`stable particle identity`,E);let{allocateSchroederSpatialSuccessorBufferFamilyIdentity:D}=await import(`./schroederSpatialSuccessorSourceFamily-DdU0-RT7.js`),O=Ne(y.execution),ie=D({device:e,afterStorageGeneration:O.storageGeneration,purpose:`reaction-placement-frozen-resolved-source-family`}),k=D({device:e,afterStorageGeneration:ie.storageGeneration,purpose:`reaction-placement-final-destination-family`}),ae=[w,te,ne],oe=l?[...ae,l]:ae;if(new Set(oe).size!==oe.length)throw K(`frozen placement state, thermo, mechanics, and identity sources must be pairwise distinct`,`SOURCE_ALIAS`);let A=p??C?.placedState??null,se=m??C?.placedThermo??null,ce=h??C?.placedMechanics??null;if(C&&(A!==C.placedState||se!==C.placedThermo||ce!==C.placedMechanics))throw K(`reaction warm arena placement destinations cannot be replaced or aliased`,`WARM_ARENA_IDENTITY`);let j=[A,se,ce].filter(Boolean);if(j.some(e=>ae.includes(e))||new Set(j).size!==j.length)throw K(`provided placement destinations must be distinct from every frozen source and each other`,`SOURCE_DESTINATION_ALIAS`);let le=A?Y(e,A,`placed destination state`,x):null,ue=se?Y(e,se,`placed destination thermo`,S):null,M=ce?Y(e,ce,`placed destination mechanics`,ee):null,N=le,P=ue,de=M;try{N||=Pe(e,`ulg-schroeder-reaction-placement-state-destination`,x),P||=Pe(e,`ulg-schroeder-reaction-placement-thermo-destination`,S),de||=Pe(e,`ulg-schroeder-reaction-placement-mechanics-destination`,ee)}catch(e){throw le||N?.destroy?.(),ue||P?.destroy?.(),M||de?.destroy?.(),e}let F=Object.freeze({state:!!p,thermo:!!m,mechanics:!!h}),I=Object.freeze({state:!!C,thermo:!!C,mechanics:!!C}),fe={frozenSourceStateBuffer:w,frozenSourceThermoBuffer:te,frozenSourceMechanicsBuffer:ne,placedDestinationStateBuffer:N,placedDestinationThermoBuffer:P,placedDestinationMechanicsBuffer:de,stateBufferByteLength:x,thermoBufferByteLength:S,mechanicsBufferByteLength:ee};Je(fe);let L=Object.freeze({storageGeneration:ie.storageGeneration,physicsTick:O.physicsTick,physicsSubstep:J(O.physicsSubstep,`placement physics substep`),positionEpoch:T.resolvedPositionEpoch,topologyEpoch:O.topologyEpoch,chartEpoch:O.chartEpoch,levelEpoch:O.levelEpoch,supportEpoch:O.supportEpoch}),R=null;try{R=Ye(e,fe);let t=Object.freeze({stageIdentity:z,sourceFamilyId:B,generationId:y.execution.generationId,...L}),n={status:`placement-consumer-not-yet-submitted`,placementArtifact:null},r={status:`shared-directory-placement-family-retained`,destinationOwnership:`placement-family-owned-destination`,releaseScheduled:!1,releaseStatus:`retained-for-placement-consumer`,releaseReason:null,releasePromise:null,deviceLossStatus:`device-loss-quarantine-not-armed`,deviceLossReason:null},i=Object.freeze({schema:be,status:`schroeder-spatial-reaction-placement-source-family-ready`,ready:!0,authenticated:!0,private:!1,sharedSpatialAuthorityBorrowed:!0,stageIdentity:z,sourceFamilyId:B,deviceId:c(e),particleCount:_,generation:y,generationId:y.execution.generationId,epochIdentity:L,stageEpochTuple:t,ancestorPublicGeneration:y,ancestorPublicGenerationId:y.execution.generationId,ancestorPublicEpochIdentity:O,directoryEpochIdentity:O,queryStateEpochIdentity:L,ancestorLineageStatus:`exact-public-generation-ancestor-bound`,positionInvariantCertificate:f,positionEpochInheritance:`certified-reaction-resolve-does-not-integrate-positions`,levelAssignment:null,directoryBuffer:y.execution.directoryBuffer,directorySourceBuffer:y.source.sourceBuffer,directoryPositionAuthorityStateBuffer:y.source.sourceStateBuffer,sourceBuffer:y.source.sourceBuffer,identityBuffer:l,identityMode:l?`stable-explicit-particle-identity-buffer`:`stable-implicit-source-row-index`,...fe,placedDestinationPublicationStatus:`transactional-mutable-destination-initialized-awaiting-placement`,placedDestinationStorageGeneration:k.storageGeneration,exactNearQueryGeometry:Object.freeze({authenticated:!0,chartId:y.execution.queryChartId,minLevel:y.execution.queryMinLevel,maxLevel:y.execution.queryMaxLevel,levelCount:y.execution.queryLevelCount,baseGridSpacingM:y.execution.queryBaseGridSpacingM,mode:y.execution.queryGeometryMode}),displacementAuthority:`gpu-envelope-max-displacement-from-canonical-directory-position-state`,directoryBuildCount:0,privateLookupBuildCount:0,privateLawSpatialBuildCount:0,levelAssignmentBuildCount:0,fullParticleReadbackPerformed:!1}),a={device:e,family:i,generation:y,ownsGeneration:!1,levelAssignment:null,completion:n,lifecycle:r,deviceLost:!1,callerOwnedDestinations:F,arenaOwnedDestinations:I,reactionWarmArenaLease:g,destinationOwnershipTransferred:!1,destinationReturnScheduled:!1,destinationReturnPromise:null,warmArenaReleasePromise:null,auxiliaryDestroyed:!1,destroyed:new Set,initializationFence:R,stageStorageAllocation:ie,destinationStorageAllocation:k,finalizedPlacementArtifact:null,positionEpochFloorReceipt:null};return g&&We(g,i,e),Te.add(i),G.set(i,a),Qe(a),i}catch(t){let n=()=>{!F.state&&!I.state&&N.destroy?.(),!F.thermo&&!I.thermo&&P.destroy?.(),!F.mechanics&&!I.mechanics&&de.destroy?.()},r=R??e.queue?.onSubmittedWorkDone?.();if(r?.then&&(Promise.resolve(r).then(n,()=>{}),g))try{qe(g,{device:e,completionFence:r,abandon:!0})}catch{}throw t}}export{Ke as a,Ue as c,rt as d,ot as f,S as h,st as i,ct as l,ve as m,$e as n,qe as o,I as p,it as r,nt as s,Ve as t,ye as u};