const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./schroederSpatialReactionProductPlacementGpu-D-MSmM2b.js","./sphMlsMpmGpuStep-q2CB8-i6.js","./schroederSpatialEpochGpu-C3L5MmN5.js","./schroederSpatialSuccessorSourceFamily-Kydyhxbp.js","./schroederSpatialSuccessorSourceFamily-CkEMJiyH.js"])))=>i.map(i=>d[i]);
import{B as e,H as t,Kt as n,Nl as r,S as i,U as a,V as o,b as s,cl as c,d as l,m as u,ml as d,o as f,ol as p,p as m,qt as h,s as g,ul as _,v,x as y,yl as b,z as x}from"./schroederSpatialEpochGpu-C3L5MmN5.js";var ee=`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`,te=`reaction-discovery`,S=`v4-s9d-hot-counter-aggregation`,C=Object.freeze([`partnerParticleIndex:f32`,`reactionIndex:f32`,`reactantRole:f32`,`distanceSquaredM2:f32`]),ne=Object.freeze(`sourceDispatchCount:u32.directoryAdmissionCount:u32.directoryRejectionCount:u32.candidateVisitCount:u32.compatiblePairCount:u32.malformedTraversalCount:u32.proposalCount:u32.sealedRowCount:u32.sourceIdentityRejectionCount:u32.supportProfileId:u32.generationId:u32.supportEpoch:u32.particleCount:u32.reactionCount:u32.privateLookupBuildCount:u32.overflowCount:u32.ruleIndexPairLookupCount:u32.ruleIndexPairMissCount:u32.ruleIndexRuleVisitCount:u32.fullRuleScanRuleVisitCount:u32.maximumDisplacementBits:u32.displacementCertificateStatusBits:u32.authorityActiveCount:u32.currentActiveCount:u32.exactCellTreeNodeVisitCount:u32.exactCellTreeLeafVisitCount:u32.exactCellTreeMemberVisitCount:u32`.split(`.`)),w=64,T=3,E=T*4,re=16777215,D=64,ie=1065353216,O=20,ae=21,oe=22,se=23,ce=24,le=25,ue=26,k=`peercompute.ulg.schroeder-spatial-reaction-rule-index.v1`,de=0,A=1,j=4,M=4,N=new WeakMap,fe=new WeakMap,P=new WeakMap,F={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},pe={READ:globalThis.GPUMapMode?.READ??1};function I(e,t,n=4294967295){if(typeof e!=`number`||!Number.isInteger(e)||e<1||e>n)throw RangeError(`${t} must be an integer in [1, ${n}]`);return e}function L(e,t){if(typeof e!=`number`||!Number.isFinite(e)||e<=0)throw RangeError(`${t} must be a positive finite number`);return e}function me(e,t,n){return e?.active===!0&&typeof e.beginEncoderSpan==`function`&&typeof e.endEncoderSpan==`function`?e.beginEncoderSpan(t,n):null}function he(e,t,n){n&&e.endEncoderSpan(t,n)}function R(e,n,r){if(!n||o(n)!==e||!t(n,e))throw TypeError(`${r} must be a live buffer on the canonical generation device`);return n}function ge(e,t,n){if(Number.isFinite(Number(e?.size))&&Number(e.size)<t)throw RangeError(`${n} has ${e.size} bytes; ${t} required`);return e}function _e(e,t,n){if(!Number.isSafeInteger(t)||t<4)throw RangeError(`${n} byte length is not safely addressable`);let r=[Number(e?.limits?.maxBufferSize),Number(e?.limits?.maxStorageBufferBindingSize)].filter(e=>Number.isFinite(e)&&e>0),i=r.length>0?Math.min(...r):2**53-1;if(t>i)throw RangeError(`${n} requires ${t} bytes; device limit is ${i}`);return t}function z(e,t,n,r){return x(e.createBuffer({label:t,size:Math.max(4,n),usage:r}),e)}function ve(e){let t=4;for(;t<e;)t*=2;return t}function ye(e){let t=N.get(e);return t||(t=new Map,N.set(e,t)),t}function be({device:e,generation:t,proposalBytes:n,localReactionRecordBytes:r,observeGpuEvidence:i=!1}){let a=t?.execution?.arenaIndex;if(!Number.isInteger(a)||a<0)throw TypeError(`reaction discovery requires a canonical generation arena index`);let o=ye(e),s=o.get(a)||null;if(s?.inUse===!0)if(s.generation?.execution?.released===!0)s.inUse=!1,s.generation=null;else throw Error(`reaction discovery arena ${a} is already leased by generation ${s.generationId}`);if(s?.inUse===!1&&s.generation&&s.generation.execution?.released!==!0)throw Error(`reaction discovery arena ${a} remains quarantined by live generation ${s.generationId}`);let c=0;(!s||s.destroyed===!0)&&(s={arenaIndex:a,proposalBuffer:null,proposalCapacityBytes:0,evidenceBuffer:null,evidenceReadbackBuffer:null,expectationBuffer:null,paramsBuffer:null,reactionRecordBuffer:null,reactionRecordCapacityBytes:0,generation:null,generationId:null,inUse:!1,destroyed:!1,totalBufferCreationCount:0,acquisitionCount:0},o.set(a,s)),s.proposalCapacityBytes<n&&(s.proposalBuffer?.destroy?.(),s.proposalCapacityBytes=ve(n),_e(e,s.proposalCapacityBytes,`reaction discovery cached proposal buffer`),s.proposalBuffer=z(e,`ulg-schroeder-spatial-reaction-discovery-proposals-arena-${a}`,s.proposalCapacityBytes,F.STORAGE|F.COPY_SRC),c+=1),s.evidenceBuffer||(s.evidenceBuffer=z(e,`ulg-schroeder-spatial-reaction-discovery-evidence-arena-${a}`,27*Uint32Array.BYTES_PER_ELEMENT,F.STORAGE|F.COPY_SRC|F.COPY_DST),c+=1),i===!0&&!s.evidenceReadbackBuffer&&(s.evidenceReadbackBuffer=z(e,`ulg-schroeder-spatial-reaction-discovery-evidence-readback-arena-${a}`,27*Uint32Array.BYTES_PER_ELEMENT,F.MAP_READ|F.COPY_DST),c+=1),s.expectationBuffer||(s.expectationBuffer=z(e,`ulg-schroeder-spatial-reaction-discovery-expectation-arena-${a}`,_,F.UNIFORM|F.COPY_DST),c+=1),s.paramsBuffer||(s.paramsBuffer=z(e,`ulg-schroeder-spatial-reaction-discovery-params-arena-${a}`,D,F.UNIFORM|F.COPY_DST),c+=1),r>0&&s.reactionRecordCapacityBytes<r&&(s.reactionRecordBuffer?.destroy?.(),s.reactionRecordCapacityBytes=ve(r),_e(e,s.reactionRecordCapacityBytes,`reaction discovery cached reaction record buffer`),s.reactionRecordBuffer=z(e,`ulg-schroeder-spatial-reaction-discovery-records-arena-${a}`,s.reactionRecordCapacityBytes,F.STORAGE|F.COPY_DST),c+=1);let l=Object.freeze({arenaIndex:a,generationId:t.execution.generationId,acquisitionOrdinal:s.acquisitionCount+1});return s.acquisitionCount+=1,s.totalBufferCreationCount+=c,s.inUse=!0,s.generation=t,s.generationId=t.execution.generationId,s.lease=l,{entry:s,lease:l,bufferCreationCount:c}}function xe(e,t){return!e||e.lease!==t||e.inUse!==!0?!1:(e.inUse=!1,e.lease=null,!0)}function Se(n,{device:r,generation:i,particleCount:a=i?.source?.sourceCount,reactionCount:o=n?.reactionCount,reactionTable:s=null,sourceStateBuffer:c=null,sourceThermoBuffer:l=null}={}){let u=(e,t)=>Object.freeze({schema:ee,status:e,reason:t,ready:!1,admitted:!1}),d=fe.get(n),f=null;try{f=s?e(Ce(s).combined):null}catch{return u(`schroeder-spatial-reaction-discovery-proposal-rejected-authenticity`,`reaction discovery proposal was not issued for this exact generation and buffer family`)}if(!d||d.proposal!==n||d.generation!==i||d.directoryBuffer!==i?.execution?.directoryBuffer||d.exactNearCellTree!==i?.exactNearCellTree||d.exactNearCellTree!==n?.exactNearCellTree||d.exactNearCellTreeBuffer!==n?.exactNearCellTreeBuffer||d.positionAuthorityStateBuffer!==(i?.source?.sourceStateBuffer??i?.source?.exactNearQueryProfile?.sourceStateBuffer)||d.sourceCurrentStateBuffer!==n?.sourceCurrentStateBuffer||d.sourceThermoBuffer!==n?.sourceThermoBuffer||!s||d.reactionTable!==s||d.reactionTableFingerprint!==f||d.reactionRecordBuffer!==n?.reactionRecordBuffer||d.reactionDiscoveryPayloadFingerprint!==n?.reactionDiscoveryPayloadFingerprint||d.reactionRuleIndex!==n?.reactionRuleIndex||d.displacementCertificateBuffer!==n?.displacementCertificateBuffer||!c||!l||d.sourceCurrentStateBuffer!==c||d.sourceThermoBuffer!==l||d.expectationBuffer!==n?.expectationBuffer||d.receipt!==n?.receipt)return u(`schroeder-spatial-reaction-discovery-proposal-rejected-authenticity`,`reaction discovery proposal was not issued for this exact generation and buffer family`);if(n?.schema!==`peercompute.ulg.schroeder-spatial-reaction-discovery-proposal.v1`||n.ready!==!0||n.released===!0)return u(`schroeder-spatial-reaction-discovery-proposal-rejected-contract`,`reaction discovery proposal is not a live submitted v1 artifact`);if(n.consumerId!==`reaction-discovery`||n.supportProfileId!==65538||n.proposalRowStrideFloats!==4||n.traversalCount!==1||n.privateLookupBuildCount!==0||n.fixedCandidateBuildCount!==0||n.exhaustiveTraversalCount!==0||n.candidateBudget!==null||n.fullReadbackPerformed!==!1)return u(`schroeder-spatial-reaction-discovery-proposal-rejected-invariants`,`reaction discovery proposal violates the exact-near residency contract`);if(n.generation!==i||n.generationId!==i?.execution?.generationId||i?.execution?.released===!0||i?.releaseScheduled===!0)return u(`schroeder-spatial-reaction-discovery-proposal-rejected-generation`,`reaction discovery proposal is not bound to the live consumer generation`);if(n.particleCount!==a||n.reactionCount!==o)return u(`schroeder-spatial-reaction-discovery-proposal-rejected-count`,`reaction discovery proposal count does not match the chemistry consumer`);if(!g(n.receipt))return u(`schroeder-spatial-reaction-discovery-proposal-rejected-receipt`,`reaction discovery proposal lacks an authentic finalized consumer receipt`);if(n.receipt.consumerId!==n.consumerId||n.receipt.supportProfileId!==n.supportProfileId||n.receipt.generationId!==n.generationId)return u(`schroeder-spatial-reaction-discovery-proposal-rejected-receipt-identity`,`reaction discovery receipt identity does not match the artifact`);if(!n.proposalBuffer||!n.evidenceBuffer||!n.reactionRecordBuffer||!n.directoryBuffer||!n.exactNearCellTree||!n.exactNearCellTreeBuffer||!n.expectationBuffer||!n.positionAuthorityStateBuffer||!n.sourceCurrentStateBuffer||!n.sourceThermoBuffer||!n.displacementCertificateBuffer||n.displacementCertificateBuffer!==n.evidenceBuffer||!t(n.proposalBuffer,r)||!t(n.evidenceBuffer,r)||!t(n.reactionRecordBuffer,r)||!t(n.directoryBuffer,r)||n.exactNearCellTree!==i?.exactNearCellTree||n.exactNearCellTree?.released===!0||n.exactNearCellTreeBuffer!==n.exactNearCellTree?.treeBuffer||!t(n.exactNearCellTreeBuffer,r)||!t(n.expectationBuffer,r)||!t(n.positionAuthorityStateBuffer,r)||!t(n.sourceCurrentStateBuffer,r)||!t(n.sourceThermoBuffer,r)||!t(n.displacementCertificateBuffer,r))return u(`schroeder-spatial-reaction-discovery-proposal-rejected-device`,`reaction discovery buffers do not belong to the consumer device`);let p=a*4*Float32Array.BYTES_PER_ELEMENT;return n.proposalBufferByteLength!==p||Number.isFinite(Number(n.proposalBuffer.size))&&Number(n.proposalBuffer.size)<p?u(`schroeder-spatial-reaction-discovery-proposal-rejected-capacity`,`reaction discovery proposal buffer is smaller than its authenticated row set`):Object.freeze({schema:ee,status:`schroeder-spatial-reaction-discovery-proposal-admitted`,reason:null,ready:!0,admitted:!0,generation:i,proposalBuffer:n.proposalBuffer,evidenceBuffer:n.evidenceBuffer,reactionRecordBuffer:n.reactionRecordBuffer,directoryBuffer:n.directoryBuffer,exactNearCellTree:n.exactNearCellTree,exactNearCellTreeBuffer:n.exactNearCellTreeBuffer,expectationBuffer:n.expectationBuffer,positionAuthorityStateBuffer:n.positionAuthorityStateBuffer,sourceCurrentStateBuffer:n.sourceCurrentStateBuffer,sourceThermoBuffer:n.sourceThermoBuffer,displacementCertificateBuffer:n.displacementCertificateBuffer,particleCount:a,reactionCount:o,generationId:n.generationId,epochIdentity:n.epochIdentity,receipt:n.receipt})}function Ce(e){if(e?.schema!==`peercompute.ulg.sph-gpu-reaction-table.v1`)throw TypeError(`canonical reaction discovery requires a packed SPH reaction table`);let t=I(e.reactionCount,`reactionTable.reactionCount`,re);if(!(e.records instanceof Float32Array))throw TypeError(`reactionTable.records must be a Float32Array`);let n=t*E;if(e.records.length<n)throw RangeError(`reactionTable.records has ${e.records.length} floats; ${n} required`);let r=e.combinedRecords instanceof Float32Array?e.combinedRecords:e.records;if(r.length<n)throw RangeError(`reaction table combined records do not contain every reaction header`);return{reactionCount:t,combined:r}}function B({combined:e,reason:t}){let n=e.length%4==0?e.length/4:0;return Object.freeze({schema:k,mode:`full-rule-scan`,modeCode:de,reason:t,upload:e,pairOffsetVec4s:0,pairCount:0,ruleOffsetVec4s:0,ruleCount:0,recordVec4Count:n})}function we({combined:e,reactionCount:t,allowIndex:n,fallbackReason:r=`material-pair-index-unavailable`}){if(n!==!0)return B({combined:e,reason:r});if(e.length%4!=0)return B({combined:e,reason:`reaction-record-prefix-not-vec4-aligned`});let i=new Map;for(let n=0;n<t;n+=1){let t=n*E,r=Math.fround(e[t]),a=Math.fround(e[t+1]),o=Math.fround(e[t+3]),s=Math.fround(e[t+5]),c=Math.fround(e[t+6]),l=Math.fround(e[t+7]);if(Math.fround(e[t+8])!==1||!Number.isFinite(r)||!Number.isFinite(a)||r===a||!Number.isFinite(o)||!Number.isFinite(s)||s<=0||!Number.isFinite(c)||!Number.isFinite(l))continue;let u=Math.min(r,a),d=Math.max(r,a),f=`${u}:${d}`,p=i.get(f);p||(p={materialLo:u,materialHi:d,ruleIndexes:[]},i.set(f,p)),p.ruleIndexes.push(n)}let a=[...i.values()].sort((e,t)=>e.materialLo-t.materialLo||e.materialHi-t.materialHi),o=a.flatMap(e=>e.ruleIndexes),s=e.length/4,c=s+a.length,l=Math.ceil(o.length/M)*M,u=new Float32Array(e.length+a.length*j+l);u.set(e);let d=e.length,f=0;for(let e of a)u[d]=e.materialLo,u[d+1]=e.materialHi,u[d+2]=f,u[d+3]=e.ruleIndexes.length,d+=j,f+=e.ruleIndexes.length;return u.set(o,e.length+a.length*j),Object.freeze({schema:k,mode:`material-pair-indexed`,modeCode:A,reason:null,upload:u,pairOffsetVec4s:s,pairCount:a.length,ruleOffsetVec4s:c,ruleCount:o.length,recordVec4Count:u.length/4})}function Te({reactionTable:e,combined:t,reactionCount:n,allowIndex:r,fallbackReason:i,reactionTableFingerprint:a}){if(r!==!0)return B({combined:t,reason:i});let o=P.get(e);if(o&&o.reactionTableFingerprint===a&&o.reactionCount===n&&o.combined===t)return o.reactionRuleIndex;let s=we({combined:t,reactionCount:n,allowIndex:r,fallbackReason:i});return P.set(e,{reactionTableFingerprint:a,reactionCount:n,combined:t,reactionRuleIndex:s}),s}function Ee(e){let{reactionCount:t,combined:n}=Ce(e),r=0;for(let e=0;e<t;e+=1){let t=e*E,i=n[t+8],a=n[t+5];Math.round(i)!==1||!Number.isFinite(a)||a<=0||(r=Math.max(r,Math.fround(a)))}return r}function De({particleCount:e,reactionCount:t,maximumContactRadiusM:n,reactionRuleIndex:r,collectDiagnosticEvidence:i=!1}){let a=new ArrayBuffer(D),o=new DataView(a);return o.setUint32(0,I(e,`particleCount`,re),!0),o.setUint32(4,I(t,`reactionCount`,re),!0),o.setUint32(8,T,!0),o.setUint32(12,d,!0),o.setFloat32(16,n>0?L(n,`maximumContactRadiusM`):0,!0),o.setUint32(20,16,!0),o.setUint32(24,3,!0),o.setUint32(28,2,!0),o.setUint32(32,r.modeCode,!0),o.setUint32(36,r.pairOffsetVec4s,!0),o.setUint32(40,r.pairCount,!0),o.setUint32(44,r.ruleOffsetVec4s,!0),o.setUint32(48,r.ruleCount,!0),o.setUint32(52,r.recordVec4Count,!0),o.setUint32(56,+(i===!0),!0),o.setUint32(60,0,!0),a}var Oe=`
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

${c({directoryBindingName:`spatial_directory`})}
${p({treeBindingName:`exact_near_cell_tree`,directoryBindingName:`spatial_directory`})}

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
@compute @workgroup_size(${w})
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

@compute @workgroup_size(${w})
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
@compute @workgroup_size(${w})
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
`;function ke({authentication:e,proposalBuffer:t,evidenceBuffer:n,observedEvidence:r=null,byteLength:i,capacityByteLength:a=i}){let o=r!=null;return Object.freeze({schema:b,status:`schroeder-spatial-exact-near-gpu-authenticated`,gpuAuthenticated:!0,consumerId:e.consumerId,supportProfileId:e.supportProfileId,generationId:e.generationId,epochIdentity:e.epochIdentity,traversalCount:1,candidateVisitCount:r?.candidateVisitCount??0,exactCellTreeNodeVisitCount:r?.exactCellTreeNodeVisitCount??0,exactCellTreeLeafVisitCount:r?.exactCellTreeLeafVisitCount??0,exactCellTreeMemberVisitCount:r?.exactCellTreeMemberVisitCount??0,consumerMaskHitCount:r?.compatiblePairCount??0,migratedProposalCount:r?.proposalCount??0,ruleIndexPairLookupCount:r?.ruleIndexPairLookupCount??0,ruleIndexPairMissCount:r?.ruleIndexPairMissCount??0,ruleIndexRuleVisitCount:r?.ruleIndexRuleVisitCount??0,fullRuleScanRuleVisitCount:r?.fullRuleScanRuleVisitCount??0,candidateBytesRequired:i,candidateBytesAdmitted:i,candidateBytesCapacity:a,candidateOverflowBytes:0,privateLookupBuildCount:0,fixedCandidateBuildCount:0,exhaustiveTraversalCount:0,overflowed:!1,partialPublication:!1,fallbackObserved:!1,fullReadbackPerformed:!1,residentCounterBuffer:n,residentProposalBuffer:t,residentCountersObserved:o,compactReadbackByteLength:o?27*Uint32Array.BYTES_PER_ELEMENT:0,observationMode:o?`explicit-compact-diagnostic-observation`:`gpu-resident-seal-unobserved`,failClosedSealDispatchCount:1})}async function Ae({device:t,generation:r,sphParticleState:i=null,sphParticleUpload:a=null,positionAuthorityStateBuffer:o=null,sourceStateBuffer:s=null,sourceThermoBuffer:c=null,reactionTable:p,reactionRecordBuffer:m=null,gpuTimestampRecorder:g=null,observeGpuEvidence:v=!1}={}){if(!t?.createBuffer||!t.queue?.writeBuffer||!t.queue?.submit)throw TypeError(`canonical reaction discovery requires a WebGPU-like device`);let y=I(r?.source?.sourceCount,`generation.source.sourceCount`,re);if(i?.particleCount!=null&&i.particleCount!==y)throw RangeError(`reaction discovery particle count does not match the canonical epoch`);let{reactionCount:b,combined:x}=Ce(p),T=e(x),E=Te({reactionTable:p,combined:x,reactionCount:b,allowIndex:m==null&&b>1,fallbackReason:m?`borrowed-caller-reaction-record-buffer`:`single-reaction-full-scan-is-cheaper`,reactionTableFingerprint:T}),D=E.upload,k=e(D),de=Ee(p),A=R(t,s||a?.stateBuffer,`reaction discovery sourceStateBuffer`),j=r?.source?.sourceStateBuffer??r?.source?.exactNearQueryProfile?.sourceStateBuffer??null,M=R(t,o||j,`reaction discovery positionAuthorityStateBuffer`);if(!j||M!==j)throw TypeError(`reaction discovery position authority must be the exact source-state buffer retained by the canonical generation`);let N=R(t,c||a?.thermoBuffer,`reaction discovery sourceThermoBuffer`),P=R(t,r?.source?.sourceBuffer??r?.source?.activeNodeBuffer,`reaction discovery canonical sourceBuffer`);ge(A,y*2*4*Float32Array.BYTES_PER_ELEMENT,`reaction discovery sourceStateBuffer`),ge(M,y*2*4*Float32Array.BYTES_PER_ELEMENT,`reaction discovery positionAuthorityStateBuffer`),ge(N,y*3*4*Float32Array.BYTES_PER_ELEMENT,`reaction discovery sourceThermoBuffer`);let F=l(r,{device:t,runtime:r.runtime,consumerId:te,supportProfileId:d,sourceBuffer:P,expected:{generationId:r.execution?.generationId,sourceCount:y,storageGeneration:r.execution?.storageGeneration,physicsTick:r.execution?.physicsTick,physicsSubstep:r.execution?.physicsSubstep,positionEpoch:r.execution?.positionEpoch,topologyEpoch:r.execution?.topologyEpoch,supportEpoch:r.execution?.supportEpoch}});if(F?.ready!==!0||F.authenticated!==!0)throw TypeError(F?.reason||`reaction discovery could not authenticate the canonical generation`);let L=R(t,F.directoryBuffer,`reaction discovery canonical directoryBuffer`),z=u(r?.exactNearCellTree,{device:t,spatialExecution:r?.execution,supportProfileId:d});if(z.ready!==!0)throw TypeError(`reaction discovery requires the submitted same-epoch exact-near cell tree`);let ve=R(t,z.treeBuffer,`reaction discovery exactNearCellTreeBuffer`);_e(t,D.byteLength,`reaction discovery reaction record buffer`);let ye=y*4*Float32Array.BYTES_PER_ELEMENT;_e(t,ye,`reaction discovery proposal buffer`);let Se=be({device:t,generation:r,proposalBytes:ye,localReactionRecordBytes:m?0:D.byteLength,observeGpuEvidence:v===!0}),{entry:B,lease:we}=Se,Ae=m?R(t,m,`reaction discovery reactionRecordBuffer`):B.reactionRecordBuffer;ge(Ae,D.byteLength,`reaction discovery reactionRecordBuffer`),t.queue.writeBuffer(Ae,0,D);let je=B.proposalBuffer,V=new Uint32Array(27);V[9]=d,V[10]=F.generationId,V[11]=F.epochIdentity.supportEpoch,V[12]=y,V[13]=b,V[ae]=ie;let H=B.evidenceBuffer,U=v===!0?B.evidenceReadbackBuffer:null,Me=H,Ne=B.expectationBuffer,Pe=B.paramsBuffer;t.queue.writeBuffer(Ne,0,F.expectationData),t.queue.writeBuffer(Pe,0,De({particleCount:y,reactionCount:b,maximumContactRadiusM:de,reactionRuleIndex:E,collectDiagnosticEvidence:v===!0})),t.queue.writeBuffer(H,0,V);let Fe=h(t,{cacheKey:`ulg-schroeder-spatial-reaction-discovery-displacement.${S}`,label:`ulg-schroeder-spatial-reaction-discovery-displacement`,code:Oe,entryPoint:`prepare_displacement_certificate`,bindings:[n(0,`read-only-storage`),n(2,`read-only-storage`),n(7,`storage`),n(9,`uniform`)]}),W=h(t,{cacheKey:`ulg-schroeder-spatial-reaction-discovery-proposal.${S}`,label:`ulg-schroeder-spatial-reaction-discovery-proposal`,code:Oe,entryPoint:`propose`,bindings:[n(0,`read-only-storage`),n(1,`read-only-storage`),n(2,`read-only-storage`),n(3,`read-only-storage`),n(4,`read-only-storage`),n(5,`read-only-storage`),n(6,`storage`),n(7,`storage`),n(8,`uniform`),n(9,`uniform`)]}),Ie=h(t,{cacheKey:`ulg-schroeder-spatial-reaction-discovery-proposal.${S}`,label:`ulg-schroeder-spatial-reaction-discovery-seal`,code:Oe,entryPoint:`seal`,bindings:[n(6,`storage`),n(7,`storage`),n(9,`uniform`)]}),Le=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-proposal-bindings`,layout:W.bindGroupLayout,entries:[{binding:0,resource:{buffer:M}},{binding:1,resource:{buffer:N}},{binding:2,resource:{buffer:A}},{binding:3,resource:{buffer:Ae}},{binding:4,resource:{buffer:L}},{binding:5,resource:{buffer:ve}},{binding:6,resource:{buffer:je}},{binding:7,resource:{buffer:H}},{binding:8,resource:{buffer:Ne}},{binding:9,resource:{buffer:Pe}}]}),Re=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-displacement-bindings`,layout:Fe.bindGroupLayout,entries:[{binding:0,resource:{buffer:M}},{binding:2,resource:{buffer:A}},{binding:7,resource:{buffer:H}},{binding:9,resource:{buffer:Pe}}]}),G=t.createBindGroup({label:`ulg-schroeder-spatial-reaction-discovery-seal-bindings`,layout:Ie.bindGroupLayout,entries:[{binding:6,resource:{buffer:je}},{binding:7,resource:{buffer:H}},{binding:9,resource:{buffer:Pe}}]}),K=Math.max(1,Math.ceil(y/w)),ze=Number(t?.limits?.maxComputeWorkgroupsPerDimension);if(Number.isFinite(ze)&&ze>0&&K>ze)throw xe(B,we),RangeError(`reaction discovery requires ${K} workgroups; device limit is ${ze}`);let q=t.createCommandEncoder({label:`ulg-schroeder-spatial-reaction-discovery`}),Be=e=>({producerId:`schroeder-spatial-reaction-discovery:${e}`,stage:e,spanClass:`same-production-command-encoder-profiled-pass`,generationId:F.generationId,particleCount:y,reactionCount:b,productionPassGroupingPreserved:!0}),Ve=me(g,q,Be(`spatial-displacement-certificate`)),He=q.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-displacement-certificate`});He.setPipeline(Fe.pipeline),He.setBindGroup(0,Re),He.dispatchWorkgroups(K),He.end(),he(g,q,Ve);let J=me(g,q,Be(`candidate-traversal`)),Y=q.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-proposal`});Y.setPipeline(W.pipeline),Y.setBindGroup(0,Le),Y.dispatchWorkgroups(K),Y.end(),he(g,q,J);let Ue=me(g,q,Be(`proposal-seal`)),We=q.beginComputePass({label:`ulg-schroeder-spatial-reaction-discovery-seal`});We.setPipeline(Ie.pipeline),We.setBindGroup(0,G),We.dispatchWorkgroups(K),We.end(),he(g,q,Ue),v===!0&&q.copyBufferToBuffer(H,0,U,0,27*Uint32Array.BYTES_PER_ELEMENT),t.queue.submit([q.finish()]);let X=null;if(v===!0){let e,t=!1;try{await U.mapAsync(pe.READ),t=!0,e=new Uint32Array(U.getMappedRange(),0,27).slice()}catch(e){throw xe(B,we),e}finally{t&&U.unmap()}if(X=Object.freeze({sourceDispatchCount:e[0],directoryAdmissionCount:e[1],directoryRejectionCount:e[2],candidateVisitCount:e[3],compatiblePairCount:e[4],malformedTraversalCount:e[5],proposalCount:e[6],sealedRowCount:e[7],sourceIdentityRejectionCount:e[8],supportProfileId:e[9],generationId:e[10],supportEpoch:e[11],particleCount:e[12],reactionCount:e[13],privateLookupBuildCount:e[14],overflowCount:e[15],ruleIndexPairLookupCount:e[16],ruleIndexPairMissCount:e[17],ruleIndexRuleVisitCount:e[18],fullRuleScanRuleVisitCount:e[19],maximumDisplacementBits:e[O],displacementCertificateStatusBits:e[ae],authorityActiveCount:e[oe],currentActiveCount:e[se],exactCellTreeNodeVisitCount:e[ce],exactCellTreeLeafVisitCount:e[le],exactCellTreeMemberVisitCount:e[ue]}),X.sourceDispatchCount!==y||X.directoryAdmissionCount!==y||X.directoryRejectionCount!==0||X.malformedTraversalCount!==0||X.proposalCount>y||X.sealedRowCount!==y||X.sourceIdentityRejectionCount!==0||X.supportProfileId!==65538||X.generationId!==F.generationId||X.supportEpoch!==F.epochIdentity.supportEpoch||X.particleCount!==y||X.reactionCount!==b||X.privateLookupBuildCount!==0||X.overflowCount!==0||X.displacementCertificateStatusBits!==ie)throw xe(B,we),Error(`Canonical reaction discovery GPU completion evidence was missing or rejected: ${JSON.stringify(X)}`)}let Ge=ke({authentication:F,proposalBuffer:je,evidenceBuffer:H,observedEvidence:X,byteLength:ye,capacityByteLength:B.proposalCapacityBytes}),Ke=f(F,Ge),qe=!1,Z={schema:ee,status:`schroeder-spatial-reaction-discovery-proposal-submitted`,ready:!0,backend:`webgpu`,consumerId:te,supportProfileId:d,particleCount:y,reactionCount:b,maximumContactRadiusM:de,generation:r,generationId:F.generationId,epochIdentity:F.epochIdentity,sourcePositionAuthority:`exact-canonical-generation-source-state-buffer`,sourceCurrentStateAuthority:A===M?`same-buffer-as-canonical-position-authority`:`same-device-current-state-with-canonical-position-authority`,sourceThermalAuthority:`same-device-current-thermo-buffer`,positionAuthorityIdentityExact:!0,activationValidation:`post-thermal-proposal-filtered-and-revalidated-before-mutation`,proposalSelection:`post-thermal-nearest-phase-temperature-material-contact-then-partner-then-reaction`,displacementCertification:`gpu-parallel-e-star-to-current-state-maximum-displacement-and-active-mask-equality`,displacementCertificateBuffer:Me,displacementCertificateStorage:`traversal-evidence-words-20-through-23`,sourceCurrentStateBuffer:A,sourceThermoBuffer:N,proposalBuffer:je,proposalBufferByteLength:ye,proposalBufferCapacityByteLength:B.proposalCapacityBytes,proposalRowLayout:C,proposalRowStrideFloats:4,reactionRecordBuffer:Ae,reactionTable:p,reactionTableFingerprint:T,reactionDiscoveryPayloadFingerprint:k,reactionRuleIndex:E,reactionRecordPrefixByteLength:x.byteLength,reactionRecordUploadByteLength:D.byteLength,reactionRecordBufferOwned:!1,reactionRecordBufferOwnership:m?`borrowed-caller-buffer`:`per-device-canonical-generation-arena-cache`,reactionRecordBufferCapacityByteLength:m?Number(m.size)||x.byteLength:B.reactionRecordCapacityBytes,evidenceBuffer:H,evidenceBufferByteLength:V.byteLength,directoryBuffer:L,exactNearCellTree:z.tree,exactNearCellTreeBuffer:ve,exactNearCellTreeTraversal:`canonical-complete-binary-cell-aabb-leaf-streaming-v1`,expectationBuffer:Ne,positionAuthorityStateBuffer:M,expectationBufferByteLength:_,evidenceLayout:ne,observedEvidence:X,evidenceObservationRequested:v===!0,evidenceObservationMode:v===!0?`explicit-compact-diagnostic-observation`:`gpu-resident-seal-unobserved`,evidenceObservationReadbackByteLength:v===!0?27*Uint32Array.BYTES_PER_ELEMENT:0,authentication:F,gpuEvidence:Ge,receipt:Ke,bufferOwnership:`per-device-canonical-generation-arena-cache`,spatialArenaIndex:B.arenaIndex,arenaAcquisitionOrdinal:we.acquisitionOrdinal,bufferCreationCount:Se.bufferCreationCount,arenaTotalBufferCreationCount:B.totalBufferCreationCount,arenaWarmReuse:Se.bufferCreationCount===0,traversalCount:1,displacementCertificateDispatchCount:1,displacementCertificateWorkgroupCount:K,displacementCertificateReductionStrategy:`particle-parallel-atomic-u32-max-and-topology-reduction`,sealDispatchCount:1,directoryBuildCount:0,privateLookupBuildCount:0,fixedCandidateBuildCount:0,exhaustiveTraversalCount:0,candidateBudget:null,candidateMaterialization:`one-deterministic-best-row-per-source`,fallbackObserved:!1,fullReadbackPerformed:!1,readbackMode:`no-full-readback`,cleanupTemporaryBuffersAfterSubmittedWork:()=>!1,destroy:()=>qe?!1:(qe=!0,xe(B,we)),get released(){return qe}};return fe.set(Z,{proposal:Z,generation:r,directoryBuffer:L,exactNearCellTree:z.tree,exactNearCellTreeBuffer:ve,expectationBuffer:Ne,positionAuthorityStateBuffer:M,sourceCurrentStateBuffer:A,sourceThermoBuffer:N,displacementCertificateBuffer:Me,reactionTable:p,reactionTableFingerprint:T,reactionDiscoveryPayloadFingerprint:k,reactionRuleIndex:E,reactionRecordBuffer:Ae,receipt:Ke}),Object.freeze(Z)}var je=`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`,V=`peercompute.ulg.sph-reaction-resolve-position-invariant-certificate.v1`,H=`post-reaction-pre-placement`,U=`schroeder-shared-canonical-displaced-post-reaction-pre-placement-x-r`,Me=`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`,Ne=`peercompute.ulg.schroeder-spatial-reaction-placement-liveness.v1`,Pe=`peercompute.ulg.sph-reaction-warm-arena.v1`,Fe=`peercompute.ulg.sph-reaction-warm-arena-lease.v1`,W={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Ie=new WeakSet,Le=new WeakMap,Re=new WeakSet,G=new WeakMap,K=new WeakSet,ze=new WeakMap,q=new WeakMap,Be=new WeakMap,Ve=new WeakMap,He=3;function J(e,t=`CONTRACT`){let n=Error(e);return n.code=`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_${t}`,n}function Y(e,t,{positive:n=!1}={}){if(typeof e!=`number`||!Number.isInteger(e)||e<+!!n||e>4294967295)throw J(`${t} must be an exact ${n?`positive `:``}u32`,`IDENTITY`);return e}function Ue(e,t){let n=Y(e,t);if(n===4294967295)throw J(`${t} exhausted the u32 identity space; wrapping would alias a live epoch`,`IDENTITY_EXHAUSTED`);return n+1}function We(e,t){return Number.isInteger(e)&&e>=0&&e<4294967295&&Number.isInteger(t)&&t===e+1}function X(e,n,r,i=0){if(!n||o(n)!==e||!t(n,e))throw J(`${r} must be a tagged live buffer on the placement device`,`DEVICE_MISMATCH`);if(i>0&&Number.isFinite(Number(n.size))&&Number(n.size)<i)throw J(`${r} has ${n.size} bytes; ${i} required`,`CAPACITY`);return n}function Ge(e,t,n){if(t?.selected!==!0||t?.ready!==!0||t?.execution?.released===!0||t?.releaseScheduled===!0)throw J(`placement epoch requires one live selected ancestor public generation`,`ANCESTOR_GENERATION`);if(t.source?.sourceCount!==n||t.execution?.sourceCount!==n)throw J(`placement particle count does not match the ancestor public generation`,`ANCESTOR_GENERATION`);Y(t.execution?.generationId,`ancestor generationId`,{positive:!0}),Y(t.execution?.storageGeneration,`ancestor storageGeneration`,{positive:!0});for(let e of[`physicsTick`,`physicsSubstep`,`positionEpoch`,`topologyEpoch`,`chartEpoch`,`levelEpoch`,`supportEpoch`])Y(t.execution?.[e],`ancestor ${e}`);X(e,t.execution?.directoryBuffer,`ancestor public directory`),m(t,e);let r=t.execution?.exactNearQueryProfile;if(r?.ready!==!0||t.source?.exactNearQueryProfile?.ready!==!0||t.execution?.queryChartId!==r.chartId||t.execution?.queryMinLevel!==r.minLevel||t.execution?.queryMaxLevel!==r.maxLevel||!Object.is(t.execution?.queryBaseGridSpacingM,r.baseGridSpacingM))throw J(`ancestor generation lacks exact authenticated query geometry`,`ANCESTOR_QUERY_GEOMETRY`);return t}function Ke(e){return Object.freeze({storageGeneration:Y(e?.storageGeneration,`placement storageGeneration`,{positive:!0}),physicsTick:Y(e?.physicsTick,`placement physicsTick`),physicsSubstep:Y(e?.physicsSubstep,`placement physicsSubstep`),positionEpoch:Y(e?.positionEpoch,`placement positionEpoch`),topologyEpoch:Y(e?.topologyEpoch,`placement topologyEpoch`),chartEpoch:Y(e?.chartEpoch,`placement chartEpoch`),levelEpoch:Y(e?.levelEpoch,`placement levelEpoch`),supportEpoch:Y(e?.supportEpoch,`placement supportEpoch`)})}function qe(e,t,n){return x(e.createBuffer({label:t,size:Math.max(4,n),usage:W.STORAGE|W.COPY_SRC|W.COPY_DST}),e)}function Z(e,t,n){let r=e*t*Float32Array.BYTES_PER_ELEMENT;if(!Number.isSafeInteger(r)||r<4)throw J(`${n} capacity is not safely addressable`,`WARM_ARENA_CAPACITY`);return r}function Je(e,t,n){let r=[Number(e?.limits?.maxBufferSize),Number(e?.limits?.maxStorageBufferBindingSize)].filter(e=>Number.isFinite(e)&&e>0),i=r.length>0?Math.min(...r):2**53-1;if(t>i)throw J(`${n} requires ${t} bytes; device limit is ${i}`,`WARM_ARENA_CAPACITY`);return t}function Ye(e){let t=q.get(e);return t||(t=new Map,q.set(e,t)),t}function Xe({particleCapacity:e,productEventCapacity:t,productTermCapacity:n,packedParticleStrideFloats:r,productEventStrideFloats:i,productPlacementSummaryStrideFloats:a}){return[e,t,n,r,i,a].join(`:`)}function Q(e,t,n,r,i){let a=x(e.createBuffer({label:n,size:Math.max(4,r),usage:i}),e);return t.push(a),a}function Ze(e,{force:t=!1}={}){if(!e||e.destroyed)return!1;if(e.inFlight&&!e.deviceLost&&!t)throw J(`cannot destroy an in-flight reaction warm arena`,`WARM_ARENA_LEASE`);e.destroyed=!0,e.terminal=!0,e.inFlight=!1,e.phase=`destroyed`;for(let t of e.ownedBuffers)try{t?.destroy?.()}catch{}return e.ownedBuffers.clear(),!0}function Qe(e){let t=e.device?.lost;if(!t||typeof t.then!=`function`){e.deviceLossStatus=`device-loss-promise-unavailable`;return}e.deviceLossStatus=`device-loss-quarantine-armed`,Promise.resolve(t).then(t=>{e.deviceLost=!0,e.terminal=!0,e.deviceLossStatus=`device-loss-quarantined`,e.deviceLossReason=t?.message??String(t||`device lost`),Ze(e,{force:!0})},t=>{e.deviceLost=!0,e.terminal=!0,e.deviceLossStatus=`device-loss-quarantined-after-rejection`,e.deviceLossReason=t instanceof Error?t.message:String(t),Ze(e,{force:!0})})}function $e(e,t,n){let{particleCapacity:r,productEventCapacity:a,productTermCapacity:o,packedParticleStrideFloats:s,productEventStrideFloats:c,productPlacementSummaryStrideFloats:l,capacityKey:u}=t,d=Je(e,Z(r,s,`packed reaction particle rows`),`packed reaction particle rows`),f=Je(e,Z(r,y,`reaction state rows`),`reaction state rows`),p=Je(e,Z(r,i,`reaction thermo rows`),`reaction thermo rows`),m=Je(e,Z(r,v,`reaction mechanics rows`),`reaction mechanics rows`),h=Je(e,Z(a,c,`reaction product-event rows`),`reaction product-event rows`),g=Je(e,Z(o,l,`reaction product-placement summary rows`),`reaction product-placement summary rows`),_=[],b=`ulg-sph-reaction-warm-${u}-slot-${n}`,x=W.STORAGE|W.COPY_SRC|W.COPY_DST;try{let t=Object.freeze({packedSource:Q(e,_,`${b}-packed-source`,d,x),packedOutput:Q(e,_,`${b}-packed-output`,d,x),fallbackState:Q(e,_,`${b}-fallback-state`,f,x),fallbackThermo:Q(e,_,`${b}-fallback-thermo`,p,x),fallbackMechanics:Q(e,_,`${b}-fallback-mechanics`,m,x),resolvedState:Q(e,_,`${b}-resolved-state`,f,x),resolvedThermo:Q(e,_,`${b}-resolved-thermo`,p,x),resolvedMechanics:Q(e,_,`${b}-resolved-mechanics`,m,x),placedState:Q(e,_,`${b}-placed-state`,f,x),placedThermo:Q(e,_,`${b}-placed-thermo`,p,x),placedMechanics:Q(e,_,`${b}-placed-mechanics`,m,x),productEvent:Q(e,_,`${b}-product-event`,h,x),productPlacementSummary:Q(e,_,`${b}-product-placement-summary`,g,x),reactionParams:Q(e,_,`${b}-reaction-params`,48,W.UNIFORM|W.COPY_DST),summaryParams:Q(e,_,`${b}-summary-params`,48,W.UNIFORM|W.COPY_DST)}),i=Object.freeze({schema:Pe,status:`sph-reaction-warm-arena-ready`,capacityKey:u,slotIndex:n,particleCapacity:r,productEventCapacity:a,productTermCapacity:o,packedParticleStrideFloats:s,productEventStrideFloats:c,productPlacementSummaryStrideFloats:l,buffers:t}),v={device:e,arena:i,buffers:t,ownedBuffers:new Set(_),bufferCreationCount:_.length,acquisitionCount:0,warmReuseCount:0,leaseOrdinal:0,inFlight:!1,phase:`idle`,terminal:!1,deviceLost:!1,destroyed:!1,deviceLossStatus:`device-loss-quarantine-not-armed`,deviceLossReason:null,releaseFence:null,boundSourceFamily:null,destinationOwnershipTransferred:!1};return Be.set(i,v),Qe(v),i}catch(e){for(let e of _.reverse())try{e?.destroy?.()}catch{}throw e}}function et({device:e,particleCapacity:t,productEventCapacity:n,productTermCapacity:r,packedParticleStrideFloats:i=52,productEventStrideFloats:a=32,productPlacementSummaryStrideFloats:o=32}={}){if(!e?.createBuffer||!e?.queue?.writeBuffer)throw TypeError(`reaction warm arena acquisition requires a WebGPU-like device`);let s={particleCapacity:Y(t,`reaction warm particleCapacity`,{positive:!0}),productEventCapacity:Y(n,`reaction warm productEventCapacity`,{positive:!0}),productTermCapacity:Y(r,`reaction warm productTermCapacity`,{positive:!0}),packedParticleStrideFloats:Y(i,`reaction warm packedParticleStrideFloats`,{positive:!0}),productEventStrideFloats:Y(a,`reaction warm productEventStrideFloats`,{positive:!0}),productPlacementSummaryStrideFloats:Y(o,`reaction warm productPlacementSummaryStrideFloats`,{positive:!0})};s.capacityKey=Xe(s);let c=Ye(e),l=c.get(s.capacityKey);l||(l={records:[]},c.set(s.capacityKey,l)),l.records=l.records.filter(e=>!e.destroyed);let u=l.records.find(e=>!e.inFlight&&!e.terminal&&!e.deviceLost&&!e.destroyed)??null,d=0;if(u)u.warmReuseCount+=1;else{if(l.records.length>=He){let e=J(`reaction warm arena ${s.capacityKey} is under bounded backpressure`,`WARM_ARENA_BACKPRESSURE`),t=l.records.map(e=>e.releaseFence).filter(e=>e?.then);throw e.retryAfterFence=t.length>0?Promise.any(t.map(e=>Promise.resolve(e).then(e=>{if(e===!0)return!0;throw J(`reaction warm arena release did not confirm reusable ownership`,`WARM_ARENA_BACKPRESSURE_RELEASE`)}))).then(()=>!0,()=>!1):null,e}let t=new Set(l.records.map(e=>e.arena.slotIndex)),n=0;for(;t.has(n);)n+=1;let r=$e(e,s,n);u=Be.get(r),l.records.push(u),d=u.bufferCreationCount}u.inFlight=!0,u.phase=`leased`,u.acquisitionCount+=1,u.leaseOrdinal+=1,u.releaseFence=null,u.boundSourceFamily=null,u.destinationOwnershipTransferred=!1;let f=Object.freeze({schema:Fe,status:`sph-reaction-warm-arena-leased`,arena:u.arena,leaseOrdinal:u.leaseOrdinal,bufferCreationCount:d,warmReuse:d===0});return Ve.set(f,{record:u,leaseOrdinal:u.leaseOrdinal,releaseScheduled:!1,released:!1}),f}async function tt(e={}){for(;;)try{return et(e)}catch(e){if(e?.code!==`ERR_SCHROEDER_SPATIAL_REACTION_PLACEMENT_EPOCH_WARM_ARENA_BACKPRESSURE`)throw e;if(!e.retryAfterFence?.then){let t=J(`reaction warm arena is exhausted without a scheduled exact-owner release`,`WARM_ARENA_BACKPRESSURE_UNRELEASABLE`);throw t.cause=e,t}let t=!1;try{t=await e.retryAfterFence}catch{t=!1}if(t!==!0){let t=J(`reaction warm arena queue fences completed without a reusable slot`,`WARM_ARENA_BACKPRESSURE_RELEASE_FAILED`);throw t.cause=e,t}}}function nt(e,{device:t=null}={}){let n=Ve.get(e),r=n?.record;if(!n||!r||r.destroyed||r.terminal||!r.inFlight||r.phase!==`leased`||n.releaseScheduled||n.released||n.leaseOrdinal!==r.leaseOrdinal||e?.arena!==r.arena||t&&r.device!==t)throw J(`reaction warm arena lease is stale, terminal, or foreign`,`WARM_ARENA_LEASE`);return{leaseRecord:n,record:r}}function rt(e,{device:t,particleCapacity:n=null,productEventCapacity:r=null,productTermCapacity:i=null}={}){let{record:a}=nt(e,{device:t}),o=a.arena;for(let[e,t,a]of[[`particleCapacity`,n,o.particleCapacity],[`productEventCapacity`,r,o.productEventCapacity],[`productTermCapacity`,i,o.productTermCapacity]])if(t!=null&&t!==a)throw J(`reaction warm arena ${e} does not match this execution`,`WARM_ARENA_IDENTITY`);return o}function it(e,t,n){let{record:r}=nt(e,{device:n});if(r.boundSourceFamily&&r.boundSourceFamily!==t)throw J(`reaction warm arena is already bound to another placement source family`,`WARM_ARENA_IDENTITY`);return r.boundSourceFamily=t,!0}function at(e,t,n){let{record:r}=nt(e,{device:n});if(r.boundSourceFamily!==t)throw J(`reaction warm destination transfer requires its exact source family`,`WARM_ARENA_OWNERSHIP`);return r.destinationOwnershipTransferred?!1:(r.destinationOwnershipTransferred=!0,!0)}function ot(e,{completionFence:t=null}={}){if(!ht(e))throw J(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=G.get(e);if(!n||!n.destinationOwnershipTransferred||n.lifecycle.releaseScheduled!==!0||!n.finalizedPlacementArtifact||!n.positionEpochFloorReceipt)throw J(`transferred placement destinations require their exact finalized owner handoff`,`OWNERSHIP_TRANSFER`);if(n.destinationReturnScheduled)return!1;let r=t??(typeof n.device.queue?.onSubmittedWorkDone==`function`?n.device.queue.onSubmittedWorkDone():null);if(!r?.then)throw J(`transferred placement destination release requires a queue fence`,`OWNERSHIP_TRANSFER_FENCE`);let i=n.lifecycle.releasePromise?.then?n.lifecycle.releasePromise:Promise.resolve(!0),a=Promise.all([i,r]).then(([e])=>{if(e!==!0)throw J(`placement source retirement was not confirmed before destination return`,`OWNERSHIP_TRANSFER_FENCE`);return!0});return n.destinationReturnScheduled=!0,n.reactionWarmArenaLease?(n.destinationReturnPromise=st(n.reactionWarmArenaLease,{device:n.device,completionFence:a,destinationOwner:e}),n.destinationReturnPromise):(n.destinationReturnPromise=a.then(()=>($(n,`placed-state`,n.family.placedDestinationStateBuffer),$(n,`placed-thermo`,n.family.placedDestinationThermoBuffer),$(n,`placed-mechanics`,n.family.placedDestinationMechanicsBuffer),!0)),n.destinationReturnPromise)}function st(e,{device:t,completionFence:n=null,destinationOwner:r=null,abandon:i=!1,destroy:a=!1}={}){let{leaseRecord:o,record:s}=nt(e,{device:t});if(s.destinationOwnershipTransferred&&i!==!0&&r!==s.boundSourceFamily)throw J(`reaction warm arena release requires the exact transferred destination owner`,`WARM_ARENA_OWNERSHIP`);let c=n??(typeof t?.queue?.onSubmittedWorkDone==`function`?t.queue.onSubmittedWorkDone():null);if(!c||typeof c.then!=`function`)throw J(`reaction warm arena release requires a genuine queue completion fence`,`WARM_ARENA_FENCE`);return o.releaseScheduled=!0,s.phase=`retiring`,s.releaseFence=Promise.resolve(c).then(()=>(o.released=!0,s.inFlight=!1,s.boundSourceFamily=null,s.destinationOwnershipTransferred=!1,a||s.terminal||s.deviceLost?(Ze(s,{force:!0}),!1):(s.phase=`idle`,!0)),e=>(o.released=!0,s.inFlight=!1,s.terminal=!0,s.deviceLossStatus=`queue-fence-rejected-arena-quarantined`,s.deviceLossReason=e instanceof Error?e.message:String(e),Ze(s,{force:!0}),!1)),s.releaseFence}function ct({frozenSourceStateBuffer:e,frozenSourceThermoBuffer:t,frozenSourceMechanicsBuffer:n,placedDestinationStateBuffer:r,placedDestinationThermoBuffer:i,placedDestinationMechanicsBuffer:a}){let o=[e,t,n],s=[r,i,a];if(new Set(o).size!==o.length)throw J(`frozen placement state, thermo, and mechanics sources must be distinct buffers`,`SOURCE_ALIAS`);for(let e of s)if(o.includes(e))throw J(`frozen placement sources and mutable placed destinations must never alias`,`SOURCE_DESTINATION_ALIAS`);if(new Set(s).size!==s.length)throw J(`placed state, thermo, and mechanics destinations must be distinct buffers`,`DESTINATION_ALIAS`)}function lt(e,t){let n=e.createCommandEncoder({label:`ulg-schroeder-reaction-placement-destination-initialize`});if(typeof n?.copyBufferToBuffer!=`function`)throw J(`placement destination initialization requires copyBufferToBuffer`,`COPY_UNAVAILABLE`);n.copyBufferToBuffer(t.frozenSourceStateBuffer,0,t.placedDestinationStateBuffer,0,t.stateBufferByteLength),n.copyBufferToBuffer(t.frozenSourceThermoBuffer,0,t.placedDestinationThermoBuffer,0,t.thermoBufferByteLength),n.copyBufferToBuffer(t.frozenSourceMechanicsBuffer,0,t.placedDestinationMechanicsBuffer,0,t.mechanicsBufferByteLength),e.queue.submit([n.finish()]);let r=e.queue?.onSubmittedWorkDone?.();if(!r?.then)throw J(`placement destination initialization requires an exact queue fence`,`QUEUE_FENCE`);return r}function $(e,t,n){e.destroyed.has(t)||(e.destroyed.add(t),n?.destroy?.())}function ut(e){e.auxiliaryDestroyed||(e.auxiliaryDestroyed=!0,typeof e.levelAssignment?.destroyAssignmentBuffer==`function`?e.levelAssignment.destroyAssignmentBuffer():$(e,`level-assignment`,e.levelAssignment?.assignmentBuffer),e.reactionWarmArenaLease||($(e,`frozen-state`,e.family.frozenSourceStateBuffer),$(e,`frozen-thermo`,e.family.frozenSourceThermoBuffer),$(e,`frozen-mechanics`,e.family.frozenSourceMechanicsBuffer)))}function dt(e){e.destinationOwnershipTransferred||e.reactionWarmArenaLease||(e.callerOwnedDestinations.state||$(e,`placed-state`,e.family.placedDestinationStateBuffer),e.callerOwnedDestinations.thermo||$(e,`placed-thermo`,e.family.placedDestinationThermoBuffer),e.callerOwnedDestinations.mechanics||$(e,`placed-mechanics`,e.family.placedDestinationMechanicsBuffer))}function ft(e){let t=e.device?.lost;if(!t||typeof t.then!=`function`){e.lifecycle.deviceLossStatus=`device-loss-promise-unavailable`;return}e.lifecycle.deviceLossStatus=`device-loss-quarantine-armed`,Promise.resolve(t).then(t=>{if(e.lifecycle.releaseStatus!==`released-after-final-consumer`){e.lifecycle.deviceLossStatus=`device-loss-cleanup-running`,e.deviceLost=!0,e.lifecycle.deviceLossReason=t?.message??String(t||`device lost`);try{ut(e),dt(e),e.lifecycle.deviceLossStatus=`device-loss-cleanup-completed`}catch(t){e.lifecycle.deviceLossStatus=`device-loss-cleanup-error`,e.lifecycle.deviceLossReason=t instanceof Error?t.message:String(t)}}}).catch(t=>{e.lifecycle.deviceLossStatus=`device-loss-observer-error`,e.lifecycle.deviceLossReason=t instanceof Error?t.message:String(t)})}function pt({device:e,ancestorGeneration:t,reactionInputStateBuffer:n,reactionInputThermoBuffer:r=null,frozenResolvedStateBuffer:i,particleCount:o,reactionDiscoveryProposal:s=null,reactionTable:c=null}={}){let l=Y(o,`particleCount`,{positive:!0}),u=Ge(e,t,l),d=X(e,n,`reaction input state`),f=X(e,i,`frozen resolved state`),p=`exact-ancestor-position-authority-state`,m=Y(u.execution.positionEpoch,`ancestor position epoch`),h=!1,g=m,_=null,v=null;if(s==null&&(r!=null||c!=null))throw J(`reaction discovery thermo/table authority cannot be supplied without the exact branded proposal`,`RESOLVE_DISCOVERY_AUTHORITY`);if(s!=null){if(_=X(e,r,`reaction input thermo`),v=Se(s,{device:e,generation:u,particleCount:l,reactionCount:c?.reactionCount,reactionTable:c,sourceStateBuffer:d,sourceThermoBuffer:_}),v?.ready!==!0||v.authenticated===!1||v.admitted!==!0||v.generation!==u||v.positionAuthorityStateBuffer!==u.source?.sourceStateBuffer||v.sourceCurrentStateBuffer!==d||v.sourceThermoBuffer!==_)throw J(v?.reason||`resolve-position certificate requires the exact authenticated reaction discovery source family`,`RESOLVE_DISCOVERY_AUTHORITY`);h=d!==u.source?.sourceStateBuffer,g=h?Ue(m,`post-G2P reaction discovery position epoch`):m,p=h?`authenticated-displacement-certified-post-g2p-reaction-discovery-current-state`:`authenticated-reaction-discovery-over-exact-ancestor-position-state`}else if(d!==u.source?.sourceStateBuffer)throw J(`resolve-position certificate requires the exact ancestor source state`,`RESOLVE_SOURCE_IDENTITY`);if(n===i)throw J(`reaction input and frozen resolved state must be distinct buffers`,`RESOLVE_ALIAS`);let y=Object.freeze({schema:V,status:`reaction-resolve-position-invariance-certified`,certified:!0,stageIdentity:`reaction-resolve`,mutationPolicy:`xyz-copied-exactly-mass-velocity-energy-material-phase-mechanics-may-change`,sourceAuthority:p,prePlacementPositionChanged:h,ancestorPositionEpoch:m,resolvedPositionEpoch:g,ancestorGenerationId:u.execution.generationId,ancestorPositionEpoch:u.execution.positionEpoch,particleCount:l,deviceId:a(e)});return Ie.add(y),Le.set(y,{device:e,ancestorGeneration:u,reactionInputStateBuffer:d,reactionInputThermoBuffer:_,reactionDiscoveryProposal:s,reactionTable:c,sourceAuthority:p,prePlacementPositionChanged:h,ancestorPositionEpoch:m,resolvedPositionEpoch:g,frozenResolvedStateBuffer:f,particleCount:l}),y}function mt(e,{device:t,ancestorGeneration:n,particleCount:r}){if(e.sourceAuthority===`exact-ancestor-position-authority-state`)return e.reactionDiscoveryProposal==null&&e.reactionTable==null&&e.reactionInputThermoBuffer==null&&e.reactionInputStateBuffer===n.source?.sourceStateBuffer&&e.prePlacementPositionChanged===!1&&e.ancestorPositionEpoch===n.execution.positionEpoch&&e.resolvedPositionEpoch===n.execution.positionEpoch;if(![`authenticated-displacement-certified-post-g2p-reaction-discovery-current-state`,`authenticated-reaction-discovery-over-exact-ancestor-position-state`].includes(e.sourceAuthority)||e.reactionDiscoveryProposal==null||e.reactionTable==null||e.reactionInputThermoBuffer==null)return!1;try{let i=Se(e.reactionDiscoveryProposal,{device:t,generation:n,particleCount:r,reactionCount:e.reactionTable.reactionCount,reactionTable:e.reactionTable,sourceStateBuffer:e.reactionInputStateBuffer,sourceThermoBuffer:e.reactionInputThermoBuffer}),a=e.reactionInputStateBuffer!==n.source?.sourceStateBuffer,o=a?Ue(n.execution.positionEpoch,`post-G2P reaction discovery position epoch`):n.execution.positionEpoch;return i?.ready===!0&&i.admitted===!0&&i.generation===n&&i.positionAuthorityStateBuffer===n.source?.sourceStateBuffer&&i.sourceCurrentStateBuffer===e.reactionInputStateBuffer&&i.sourceThermoBuffer===e.reactionInputThermoBuffer&&e.prePlacementPositionChanged===a&&e.ancestorPositionEpoch===n.execution.positionEpoch&&e.resolvedPositionEpoch===o}catch{return!1}}function ht(e){return!!(e&&Re.has(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-source-family.v2`&&e.ready===!0&&e.authenticated===!0)}function gt(e,{device:t=null}={}){if(!ht(e))throw J(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=G.get(e);if(!n||t&&n.device!==t)throw J(`placement source family belongs to another device`,`DEVICE_MISMATCH`);if(n.deviceLost)throw J(`placement source family is quarantined after device loss: ${n.lifecycle.deviceLossReason}`,`DEVICE_LOST`);if(n.lifecycle.releaseScheduled===!0||n.lifecycle.releaseStatus===`released-after-final-consumer`)throw J(`placement source family is terminal or retiring`,`RETIRED`);if(ct(e),e.generation!==n.generation||e.ancestorPublicGeneration!==n.generation||e.sharedSpatialAuthorityBorrowed!==!0||e.private!==!1||n.ownsGeneration!==!1||e.directoryBuffer!==n.generation.execution.directoryBuffer||e.directorySourceBuffer!==n.generation.source.sourceBuffer||e.directoryPositionAuthorityStateBuffer!==n.generation.source.sourceStateBuffer)throw J(`placement source family no longer identifies its exact borrowed canonical generation`,`SOURCE_FAMILY_IDENTITY`);return e}function _t(e,{device:t=null}={}){if(!ht(e))throw J(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let n=G.get(e);if(!n||t&&n.device!==t)throw J(`placement source family belongs to another device`,`DEVICE_MISMATCH`);return Object.freeze({schema:Ne,status:n.deviceLost?`schroeder-reaction-placement-source-family-device-lost-quarantined`:n.lifecycle.releaseScheduled?`schroeder-reaction-placement-source-family-retiring`:`schroeder-reaction-placement-source-family-active`,active:!n.deviceLost&&n.lifecycle.releaseScheduled!==!0,releaseScheduled:n.lifecycle.releaseScheduled===!0,releaseStatus:n.lifecycle.releaseStatus,deviceLost:n.deviceLost===!0,deviceLossStatus:n.lifecycle.deviceLossStatus,destinationOwnershipTransferred:n.destinationOwnershipTransferred,destinationStorageGeneration:e.placedDestinationStorageGeneration,deviceId:e.deviceId,generationId:e.generationId})}async function vt(e,{placementArtifact:t}={}){let n=gt(e),i=G.get(n);if(i.positionEpochFloorReceipt){if(i.finalizedPlacementArtifact!==t)throw J(`placement source family was already finalized by another artifact`,`DUPLICATE_FINALIZATION`);return i.positionEpochFloorReceipt}let a=await r(()=>import(`./schroederSpatialReactionProductPlacementGpu-D-MSmM2b.js`),__vite__mapDeps([0,1,2]),import.meta.url),o=gt(e,{device:i.device});if(o!==n||G.get(o)!==i||i.generation?.execution?.released===!0||i.generation?.releaseScheduled===!0)throw J(`placement source family retired while finalizing its position epoch floor`,`RETIRED`);if(i.positionEpochFloorReceipt){if(i.finalizedPlacementArtifact!==t)throw J(`placement source family was already finalized by another artifact`,`DUPLICATE_FINALIZATION`);return i.positionEpochFloorReceipt}if(!a.isSubmittedSchroederSpatialReactionProductPlacementArtifact?.(t)||t.submitPerformed!==!0||t.gpuResident!==!0||t.authenticated!==!1||t.gpuAuthenticated!==!1||t.submissionAuthenticated!==!0||t.destinationSafetyAuthenticated!==!0||t.placementOutcomeObserved!==!1||t.transactionalPublicationGateEncoded!==!0||t.transactionalTerminalSealEncoded!==!0||t.transactionalFailClosedRecoveryEncoded!==!0||t.transactionalAuxiliaryMaterializationEncoded!==!0||t.destinationPublicationMode!==`gpu-terminal-safe-placed-or-exact-frozen-fallback`||t.positionMayChange!==!0||t.topologyMayChange!==!0||t.placementSourceFamily!==e||t.generation!==i.generation||t.placedDestinationStateBuffer!==e.placedDestinationStateBuffer||t.placedDestinationThermoBuffer!==e.placedDestinationThermoBuffer||t.placedDestinationMechanicsBuffer!==e.placedDestinationMechanicsBuffer||t.frozenSourceStateBuffer!==e.frozenSourceStateBuffer||t.frozenSourceThermoBuffer!==e.frozenSourceThermoBuffer||t.frozenSourceMechanicsBuffer!==e.frozenSourceMechanicsBuffer)throw J(`position epoch floor requires the exact one-shot resident placement-submission artifact`,`FINALIZATION`);let s=e.epochIdentity.positionEpoch,c=Ue(s,`placement position epoch floor`),l=Object.freeze({schema:Me,status:`schroeder-reaction-placement-position-epoch-floor-authenticated-after-resident-submission`,finalized:!0,authenticated:!0,positionEpochFloorAuthenticated:!0,destinationSafetyAuthenticated:!0,placementOutcomeAuthenticated:!1,submitPerformed:!0,gpuCompletionObserved:!1,placementOutcomeObserved:!1,transactionalPublicationGateEncoded:!0,transactionalTerminalSealEncoded:!0,transactionalFailClosedRecoveryEncoded:!0,transactionalAuxiliaryMaterializationEncoded:!0,destinationPublicationMode:`gpu-terminal-safe-placed-or-exact-frozen-fallback`,completionMode:`gpu-resident-terminal-safe-placed-or-frozen-fallback`,positionMutationObserved:!1,positionMayHaveChanged:!0,positionEpochAdvanceRequired:!0,topologyMayChange:!0,conservativeTopologyAdvanceRequired:!0,sparePlacementEventCount:null,observedPositionMutationEventCount:null,sourcePositionEpoch:s,positionEpochFloor:c,destinationStorageGeneration:e.placedDestinationStorageGeneration,ancestorPublicGenerationId:e.ancestorPublicGenerationId,placementGenerationId:e.generationId,deviceId:e.deviceId});return K.add(l),ze.set(l,{device:i.device,sourceFamily:e,ancestorPublicGeneration:e.ancestorPublicGeneration,placementArtifact:t,stateBuffer:e.placedDestinationStateBuffer,thermoBuffer:e.placedDestinationThermoBuffer,mechanicsBuffer:e.placedDestinationMechanicsBuffer,sourcePositionEpoch:s,positionEpochFloor:c,destinationStorageGeneration:e.placedDestinationStorageGeneration}),i.finalizedPlacementArtifact=t,i.positionEpochFloorReceipt=l,l}function yt(e,{device:t,ancestorPublicGeneration:n}={}){let r=ze.get(e);return!!(r&&K.has(e)&&Object.isFrozen(e)&&e.schema===`peercompute.ulg.schroeder-spatial-reaction-placement-position-epoch-floor-receipt.v1`&&e.finalized===!0&&e.authenticated===!0&&e.positionEpochFloorAuthenticated===!0&&e.destinationSafetyAuthenticated===!0&&e.placementOutcomeAuthenticated===!1&&e.placementOutcomeObserved===!1&&e.transactionalPublicationGateEncoded===!0&&e.transactionalTerminalSealEncoded===!0&&e.transactionalFailClosedRecoveryEncoded===!0&&e.transactionalAuxiliaryMaterializationEncoded===!0&&e.destinationPublicationMode===`gpu-terminal-safe-placed-or-exact-frozen-fallback`&&e.positionMutationObserved===!1&&e.positionMayHaveChanged===!0&&e.positionEpochAdvanceRequired===!0&&r.device===t&&e.deviceId===a(t)&&r.ancestorPublicGeneration===n&&r.sourceFamily.ancestorPublicGeneration===n&&r.sourcePositionEpoch===r.sourceFamily.epochIdentity.positionEpoch&&e.sourcePositionEpoch===r.sourcePositionEpoch&&e.positionEpochFloor===r.positionEpochFloor&&We(e.sourcePositionEpoch,e.positionEpochFloor)&&e.sourcePositionEpoch>=n?.execution?.positionEpoch&&e.positionEpochFloor>n?.execution?.positionEpoch)}function bt(e){if(!ht(e))throw J(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let t=G.get(e);if(!t||t.deviceLost||t.lifecycle.releaseStatus===`released-after-final-consumer`||t.lifecycle.releaseScheduled!==!0||!t.finalizedPlacementArtifact||!t.positionEpochFloorReceipt)throw J(`placement destination ownership can only transfer during the exact retirement handoff`,`OWNERSHIP_TRANSFER`);return t.destinationOwnershipTransferred?!1:(t.reactionWarmArenaLease&&at(t.reactionWarmArenaLease,e,t.device),t.destinationOwnershipTransferred=!0,t.lifecycle.destinationOwnership=`transferred-to-reaction-continuation`,!0)}function xt(e,{placementArtifact:t=null,abandon:n=!1}={}){if(!ht(e))throw J(`placement source family was not minted by the shared-directory epoch builder`,`SOURCE_FAMILY_BRAND`);let r=G.get(e);if(!r)throw J(`placement source family has no exact runtime owner record`,`SOURCE_FAMILY_IDENTITY`);if(r.lifecycle.releaseScheduled===!0)return!1;if(gt(e),n!==!0&&(!t||r.finalizedPlacementArtifact!==t||!r.positionEpochFloorReceipt))throw J(`normal placement retirement requires the exact finalized placement artifact and position-epoch-floor receipt`,`FINALIZATION`);r.completion.status=t?`placement-consumer-submitted`:`placement-consumer-submission-observed-without-artifact`,r.completion.placementArtifact=t;let i=t?.queueFence??r.initializationFence??null;return!i?.then||t&&(t.queueFenceStatus!==`exact-queue-submission-fence`||t.arenaReuseAllowed!==!0)?(r.lifecycle.releaseStatus=`retained-without-exact-queue-fence`,r.lifecycle.releaseReason=`placement-family cleanup requires the exact submission queue fence`,!1):(r.lifecycle.releaseScheduled=!0,r.lifecycle.releaseStatus=`borrowed-directory-family-cleanup-scheduled-after-placement-consumer`,r.lifecycle.releasePromise=Promise.resolve(i).then(()=>(ut(r),dt(r),r.reactionWarmArenaLease&&!r.destinationOwnershipTransferred&&(r.warmArenaReleasePromise=st(r.reactionWarmArenaLease,{device:r.device,completionFence:Promise.resolve(!0),abandon:!0})),r.lifecycle.releaseStatus=`released-after-final-consumer`,r.lifecycle.releaseReason=null,r.completion.status=`placement-consumer-completed`,!0)).catch(e=>{if(r.lifecycle.releaseScheduled=!1,r.lifecycle.releaseStatus=`retained-cleanup-fence-error`,r.lifecycle.releaseReason=e instanceof Error?e.message:String(e),r.reactionWarmArenaLease)try{let t=Promise.reject(e);r.warmArenaReleasePromise=st(r.reactionWarmArenaLease,{device:r.device,completionFence:t,abandon:!0})}catch{}return!1}),!0)}async function St({device:e,ancestorPublicGeneration:t,sphParticleState:n,mlsMpmParticleState:o,sphParticleUpload:c=null,frozenSourceStateBuffer:l,frozenSourceThermoBuffer:u,frozenSourceMechanicsBuffer:d,stableIdentityBuffer:f=c?.identityBuffer??null,positionInvariantCertificate:p,placedDestinationStateBuffer:m=null,placedDestinationThermoBuffer:h=null,placedDestinationMechanicsBuffer:g=null,reactionWarmArenaLease:_=null}={}){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.submit)throw TypeError(`reaction placement epoch requires a WebGPU-like device and queue`);let b=Y(n?.particleCount,`sphParticleState.particleCount`,{positive:!0});if(o?.particleCount!==b)throw J(`SPH and MLS-MPM particle counts must match`,`PARTICLE_COUNT`);let x=Ge(e,t,b),ee=b*y*Float32Array.BYTES_PER_ELEMENT,te=b*i*Float32Array.BYTES_PER_ELEMENT,S=b*v*Float32Array.BYTES_PER_ELEMENT,C=(_?rt(_,{device:e,particleCapacity:b}):null)?.buffers??null,ne=X(e,l,`frozen resolved state`,ee),w=X(e,u,`frozen resolved thermo`,te),T=X(e,d,`frozen resolved mechanics`,S);if(C&&(ne!==C.resolvedState||w!==C.resolvedThermo||T!==C.resolvedMechanics))throw J(`reaction warm arena must carry the exact frozen resolve output family`,`WARM_ARENA_IDENTITY`);let E=Le.get(p);if(!Ie.has(p)||!E||E.device!==e||E.ancestorGeneration!==x||!mt(E,{device:e,ancestorGeneration:x,particleCount:b})||p.sourceAuthority!==E.sourceAuthority||p.prePlacementPositionChanged!==E.prePlacementPositionChanged||p.ancestorPositionEpoch!==E.ancestorPositionEpoch||p.resolvedPositionEpoch!==E.resolvedPositionEpoch||E.frozenResolvedStateBuffer!==ne||E.particleCount!==b)throw J(`numeric position-epoch inheritance requires the exact resolve certificate`,`POSITION_INVARIANCE`);let re=c?.identityRequired===!0,D=b*s*Uint32Array.BYTES_PER_ELEMENT;(re||f)&&X(e,f,`stable particle identity`,D);let{allocateSchroederSpatialSuccessorBufferFamilyIdentity:ie}=await r(async()=>{let{allocateSchroederSpatialSuccessorBufferFamilyIdentity:e}=await import(`./schroederSpatialSuccessorSourceFamily-Kydyhxbp.js`);return{allocateSchroederSpatialSuccessorBufferFamilyIdentity:e}},__vite__mapDeps([3,4,2,1]),import.meta.url),O=Ke(x.execution),ae=ie({device:e,afterStorageGeneration:O.storageGeneration,purpose:`reaction-placement-frozen-resolved-source-family`}),oe=ie({device:e,afterStorageGeneration:ae.storageGeneration,purpose:`reaction-placement-final-destination-family`}),se=[ne,w,T],ce=f?[...se,f]:se;if(new Set(ce).size!==ce.length)throw J(`frozen placement state, thermo, mechanics, and identity sources must be pairwise distinct`,`SOURCE_ALIAS`);let le=m??C?.placedState??null,ue=h??C?.placedThermo??null,k=g??C?.placedMechanics??null;if(C&&(le!==C.placedState||ue!==C.placedThermo||k!==C.placedMechanics))throw J(`reaction warm arena placement destinations cannot be replaced or aliased`,`WARM_ARENA_IDENTITY`);let de=[le,ue,k].filter(Boolean);if(de.some(e=>se.includes(e))||new Set(de).size!==de.length)throw J(`provided placement destinations must be distinct from every frozen source and each other`,`SOURCE_DESTINATION_ALIAS`);let A=le?X(e,le,`placed destination state`,ee):null,j=ue?X(e,ue,`placed destination thermo`,te):null,M=k?X(e,k,`placed destination mechanics`,S):null,N=A,fe=j,P=M;try{N||=qe(e,`ulg-schroeder-reaction-placement-state-destination`,ee),fe||=qe(e,`ulg-schroeder-reaction-placement-thermo-destination`,te),P||=qe(e,`ulg-schroeder-reaction-placement-mechanics-destination`,S)}catch(e){throw A||N?.destroy?.(),j||fe?.destroy?.(),M||P?.destroy?.(),e}let F=Object.freeze({state:!!m,thermo:!!h,mechanics:!!g}),pe=Object.freeze({state:!!C,thermo:!!C,mechanics:!!C}),I={frozenSourceStateBuffer:ne,frozenSourceThermoBuffer:w,frozenSourceMechanicsBuffer:T,placedDestinationStateBuffer:N,placedDestinationThermoBuffer:fe,placedDestinationMechanicsBuffer:P,stateBufferByteLength:ee,thermoBufferByteLength:te,mechanicsBufferByteLength:S};ct(I);let L=Object.freeze({storageGeneration:ae.storageGeneration,physicsTick:O.physicsTick,physicsSubstep:Ue(O.physicsSubstep,`placement physics substep`),positionEpoch:E.resolvedPositionEpoch,topologyEpoch:O.topologyEpoch,chartEpoch:O.chartEpoch,levelEpoch:O.levelEpoch,supportEpoch:O.supportEpoch}),me=null;try{me=lt(e,I);let t=Object.freeze({stageIdentity:H,sourceFamilyId:U,generationId:x.execution.generationId,...L}),n={status:`placement-consumer-not-yet-submitted`,placementArtifact:null},r={status:`shared-directory-placement-family-retained`,destinationOwnership:`placement-family-owned-destination`,releaseScheduled:!1,releaseStatus:`retained-for-placement-consumer`,releaseReason:null,releasePromise:null,deviceLossStatus:`device-loss-quarantine-not-armed`,deviceLossReason:null},i=Object.freeze({schema:je,status:`schroeder-spatial-reaction-placement-source-family-ready`,ready:!0,authenticated:!0,private:!1,sharedSpatialAuthorityBorrowed:!0,stageIdentity:H,sourceFamilyId:U,deviceId:a(e),particleCount:b,generation:x,generationId:x.execution.generationId,epochIdentity:L,stageEpochTuple:t,ancestorPublicGeneration:x,ancestorPublicGenerationId:x.execution.generationId,ancestorPublicEpochIdentity:O,directoryEpochIdentity:O,queryStateEpochIdentity:L,ancestorLineageStatus:`exact-public-generation-ancestor-bound`,positionInvariantCertificate:p,positionEpochInheritance:`certified-reaction-resolve-does-not-integrate-positions`,levelAssignment:null,directoryBuffer:x.execution.directoryBuffer,directorySourceBuffer:x.source.sourceBuffer,directoryPositionAuthorityStateBuffer:x.source.sourceStateBuffer,sourceBuffer:x.source.sourceBuffer,identityBuffer:f,identityMode:f?`stable-explicit-particle-identity-buffer`:`stable-implicit-source-row-index`,...I,placedDestinationPublicationStatus:`transactional-mutable-destination-initialized-awaiting-placement`,placedDestinationStorageGeneration:oe.storageGeneration,exactNearQueryGeometry:Object.freeze({authenticated:!0,chartId:x.execution.queryChartId,minLevel:x.execution.queryMinLevel,maxLevel:x.execution.queryMaxLevel,levelCount:x.execution.queryLevelCount,baseGridSpacingM:x.execution.queryBaseGridSpacingM,mode:x.execution.queryGeometryMode}),displacementAuthority:`gpu-envelope-max-displacement-from-canonical-directory-position-state`,directoryBuildCount:0,privateLookupBuildCount:0,privateLawSpatialBuildCount:0,levelAssignmentBuildCount:0,fullParticleReadbackPerformed:!1}),o={device:e,family:i,generation:x,ownsGeneration:!1,levelAssignment:null,completion:n,lifecycle:r,deviceLost:!1,callerOwnedDestinations:F,arenaOwnedDestinations:pe,reactionWarmArenaLease:_,destinationOwnershipTransferred:!1,destinationReturnScheduled:!1,destinationReturnPromise:null,warmArenaReleasePromise:null,auxiliaryDestroyed:!1,destroyed:new Set,initializationFence:me,stageStorageAllocation:ae,destinationStorageAllocation:oe,finalizedPlacementArtifact:null,positionEpochFloorReceipt:null};return _&&it(_,i,e),Re.add(i),G.set(i,o),ft(o),i}catch(t){let n=()=>{!F.state&&!pe.state&&N.destroy?.(),!F.thermo&&!pe.thermo&&fe.destroy?.(),!F.mechanics&&!pe.mechanics&&P.destroy?.()},r=me??e.queue?.onSubmittedWorkDone?.();if(r?.then&&(Promise.resolve(r).then(n,()=>{}),_))try{st(_,{device:e,completionFence:r,abandon:!0})}catch{}throw t}}export{Se as C,yt as S,gt as _,je as a,_t as b,Pe as c,pt as d,vt as f,st as g,ot as h,Me as i,et as l,xt as m,H as n,V as o,ht as p,Ne as r,Fe as s,U as t,tt as u,rt as v,Ae as w,bt as x,St as y};