import{t as e}from"./rolldown-runtime-DK3Fl9T5.js";import{i as t,s as n}from"./sphExactMassInventory-FFefHwOc.js";import{_ as r,c as i,d as a,g as o,m as s,n as c,o as l,x as u}from"./webgpuComputeLayout-DmbtaDDe.js";import{i as d,o as f}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{t as p}from"./sphExactMassWgsl-ChqpSzqB.js";const m=Object.freeze({LAYOUT:64,ENDPOINT:128,ALIAS:256,COMPLETION:512,STORED_STATE:1024,NONZERO_DROP:2048});function h(e,{partition:t=!1,allocation:n=!1}={}){if(n&&!t)throw TypeError(`Exact allocation requires the remapped source domain`);let r=m;return p(e)+`
const EM_EDGE_WORDS: u32 = ${n?`3u * EM_WORDS + 2u`:`EM_WORDS + 2u`};
${t?`struct PartitionParams {
  x: u32, y: u32, z: u32, w: u32,
  sourceRows: u32, sourceCount: u32, reserved: vec2<u32>
}
@group(0) @binding(0) var<uniform> params: PartitionParams;`:`@group(0) @binding(0) var<uniform> params: vec4<u32>;`}
@group(0) @binding(1) var<storage, read> source: array<u32>;
@group(0) @binding(2) var<storage, read> edges: array<u32>;
@group(0) @binding(3) var<storage, read_write> candidate: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>;
${t?`@group(0) @binding(5) var<storage, read> destinations: array<u32>;`:``}

fn em_layout() -> bool {
  ${t?`return arrayLength(&control) == 16u && params.x > 0u
    && params.sourceRows > 0u && params.sourceCount > 0u
    && params.sourceRows <= arrayLength(&source) / EM_WORDS
    && arrayLength(&source) == params.sourceRows * EM_WORDS
    && arrayLength(&destinations) == params.sourceRows
    && params.x <= arrayLength(&candidate) / EM_WORDS
    && arrayLength(&candidate) == params.x * EM_WORDS
    && params.y <= arrayLength(&edges) / EM_EDGE_WORDS
    && arrayLength(&edges) == select(params.y * EM_EDGE_WORDS, 1u, params.y == 0u)
    && all(params.reserved == vec2<u32>(${+!!n}u, 0u));`:`
  return arrayLength(&control) == 16u && params.x > 0u && params.y > 0u
    && params.x <= arrayLength(&source) / EM_WORDS
    && arrayLength(&source) == params.x * EM_WORDS
    && arrayLength(&candidate) == arrayLength(&source)
    && params.y <= arrayLength(&edges) / EM_EDGE_WORDS
    && arrayLength(&edges) == params.y * EM_EDGE_WORDS;`}
}
fn em_source_row(row: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = source[row * EM_WORDS + i]; }
  return value;
}
fn em_initial_row(row: u32) -> ExactMassResult {
  ${t?`var value: ExactMass;
  var errors = 0u;
  for (var sourceRow = 0u; sourceRow < params.sourceRows; sourceRow++) {
    let destination = destinations[sourceRow];
    let sourceValue = em_source_row(sourceRow);
    if (destination == 0xffffffffu) {
      var nonzero = 0u;
      for (var i = 0u; i < EM_WORDS; i++) { nonzero |= sourceValue.words[i]; }
      if (nonzero != 0u) { errors |= ${r.NONZERO_DROP}u; }
    } else if (destination >= params.x) {
      errors |= ${r.ENDPOINT}u;
    } else if (destination == row) {
      let sum = em_add(value, sourceValue); value = sum.value; errors |= sum.error;
    }
  }
  return ExactMassResult(value, errors);`:`return ExactMassResult(em_source_row(row), 0u);`}
}
fn em_expected_row(row: u32) -> ExactMassResult {
  let initial = em_initial_row(row);
  let original = initial.value;
  var outgoing: ExactMass; var incoming: ExactMass;
  var errors = initial.error;
  for (var edge = 0u; edge < params.y; edge++) {
    let base = edge * EM_EDGE_WORDS;
    let donor = edges[base]; let receiver = edges[base + 1u];
    if (donor >= params.x || receiver >= params.x) { errors |= ${r.ENDPOINT}u; continue; }
    if (donor == receiver) { errors |= ${r.ALIAS}u; continue; }
    if (donor != row && receiver != row) { continue; }
    var packet: ExactMass;
    ${n?`var lower: ExactMass; var upper: ExactMass; var denominator: ExactMass;
    for (var i = 0u; i < EM_WORDS; i++) {
      lower.words[i] = edges[base + 2u + i];
      upper.words[i] = edges[base + 2u + EM_WORDS + i];
      denominator.words[i] = edges[base + 2u + 2u * EM_WORDS + i];
    }
    let available = em_initial_row(donor);
    let selected = em_partition_share(available.value, lower, upper, denominator);
    errors |= available.error | selected.error;
    packet = selected.value;`:`
    for (var i = 0u; i < EM_WORDS; i++) { packet.words[i] = edges[base + 2u + i]; }
    `}
    if (donor == row) {
      let sum = em_add(outgoing, packet); outgoing = sum.value; errors |= sum.error;
    } else {
      let sum = em_add(incoming, packet); incoming = sum.value; errors |= sum.error;
    }
  }
  let debit = em_subtract(original, outgoing);
  let credit = em_add(debit.value, incoming);
  errors |= debit.error | credit.error;
  if (errors != 0u) { return ExactMassResult(original, errors); }
  return ExactMassResult(credit.value, 0u);
}
@compute @workgroup_size(64)
fn exact_mass_gather(@builtin(global_invocation_id) id: vec3<u32>) {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${r.LAYOUT}u); return; }
  if (id.x >= params.x) { return; }
  let expected = em_expected_row(id.x);
  atomicOr(&control[3], expected.error);
  for (var i = 0u; i < EM_WORDS; i++) { candidate[id.x * EM_WORDS + i] = expected.value.words[i]; }
}
@compute @workgroup_size(64)
fn exact_mass_validate(@builtin(global_invocation_id) id: vec3<u32>) {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${r.LAYOUT}u); return; }
  if (id.x >= params.x) { return; }
  let expected = em_expected_row(id.x);
  var errors = expected.error;
  for (var i = 0u; i < EM_WORDS; i++) {
    if (candidate[id.x * EM_WORDS + i] != expected.value.words[i]) { errors |= ${r.STORED_STATE}u; }
  }
  atomicOr(&control[3], errors);
  atomicAdd(&control[6], 1u);
}
@compute @workgroup_size(1)
fn exact_mass_finalize() {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${r.LAYOUT}u); }
  if (atomicLoad(&control[6]) != params.x) { atomicOr(&control[3], ${r.COMPLETION}u); }
  atomicStore(&control[0], 1162695729u);
  atomicStore(&control[1], ${n?3:t?2:1}u);
  atomicStore(&control[2], select(2u, 1u, atomicLoad(&control[3]) == 0u));
  atomicStore(&control[4], params.x); atomicStore(&control[5], params.y);
  atomicStore(&control[7], params.w); atomicStore(&control[8], params.z);
  ${t?`atomicStore(&control[9], params.sourceRows); atomicStore(&control[10], params.sourceCount);`:``}
}
`}var g=e({acquireSphExactMassRead:()=>I,createSphExactMassInventoryFromPhaseTransferWebGpu:()=>F,createSphExactMassInventoryFromReactionPlacementWebGpu:()=>j,createSphExactMassInventoryFromResidualMechanicsWebGpu:()=>M,createSphExactMassInventoryFromVaporExchangeWebGpu:()=>N,createSphExactMassInventoryWebGpu:()=>A,createSphExactMassLedgerSuccessorWebGpu:()=>P,forkSphExactMassRead:()=>B,releaseSphExactMassInventory:()=>U,releaseSphExactMassRead:()=>H,runSphExactMassAllocationCandidateWebGpu:()=>K,runSphExactMassPartitionCandidateWebGpu:()=>G,runSphExactMassTransferCandidateWebGpu:()=>W,sliceSphExactMassRead:()=>V,validateSphExactMassRead:()=>z});const _=new WeakMap,v=new WeakMap,y=new WeakMap;let b=1;function x(e,t,n=!1){if(!Number.isSafeInteger(e)||Object.is(e,-0)||e<+!!n||e>4294967295)throw RangeError(`${t} must be an exact ${n?`positive `:``}u32`);return e}function S(e){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.writeBuffer||!e?.queue?.submit||!e?.queue?.onSubmittedWorkDone||!e?.lost?.then)throw TypeError(`Exact inventory requires a WebGPU device with queue retirement`);let t=y.get(e);if(t||(t={lost:!1,records:new Set,lossListeners:new Set},e.lost.then(()=>{t.lost=!0;for(let e of[...t.records])e.closed=!0,T(e);for(let e of[...t.lossListeners])e();t.lossListeners.clear()},()=>{}),y.set(e,t)),t.lost)throw Error(`Exact inventory device is lost`);return t}function C(e,t){let n=e.deviceState;return n.lost?Promise.resolve(!1):new Promise((e,r)=>{let i=!1,a=(t,a=!1)=>{i||(i=!0,n.lossListeners.delete(o),a?r(t):e(t))},o=()=>a(!1);n.lossListeners.add(o),t&&Promise.resolve(t).then(e=>a(e),e=>a(e,!0))})}function w(e,t,n,r,i=140,a=!1){let s=Math.min(e.limits?.maxBufferSize??268435456,i&128?e.limits?.maxStorageBufferBindingSize??134217728:1/0);if(!Number.isSafeInteger(r)||r<=0||r%4||r>s)throw RangeError(`${n} exceeds exact-mass buffer limits`);let l=a&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice?o(c(e,{bucketKey:n,label:n,size:r,usage:i}),e,{bucketKey:n,size:r,usage:i}):e.createBuffer({label:n,size:r,usage:i});return t.add(l),d(l,e),l}function T(e){if(e.destroyed)return;e.destroyed=!0;let t=!e.deviceState.lost&&!e.quarantined;for(let n of e.resources){try{n.mapState===`mapped`&&n.unmap()}catch{}try{r(n,{allowPool:t})}catch{}}e.resources.clear(),e.deviceState.records.delete(e)}async function E(e){if(e.deviceState.lost)return!1;try{let t=e.device.queue.onSubmittedWorkDone();if(!t||typeof t.then!=`function`)throw Error(`Missing queue fence`);return await C(e,Promise.resolve(t).then(()=>!0,()=>(e.quarantined=!0,C(e))))}catch{return e.quarantined=!0,C(e)}}function D(e,t,n,r){let i=S(e),a={device:e,deviceState:i,format:t,rowCount:n,generation:r,buffer:null,resources:new Set,borrows:0,closed:!1,destroyed:!1,quarantined:!1,releasePromise:null};return i.records.add(a),a}function O(e,t){if(!Number.isSafeInteger(b))throw RangeError(`Exact-mass family identity exhausted`);let n=Object.freeze({schema:`peercompute.ulg.exact-mass-family.v1`,familyId:b++,format:e.format,rowCount:e.rowCount,generation:e.generation,provenance:t,scope:`mass-inventory-only`,physicalPublicationAdmitted:!1});return e.family=n,_.set(n,e),n}async function k(e){return!e.closed||e.borrows||e.releasePromise||(e.releasePromise=a(e.device,()=>{T(e)},{onQueueFenceRejected(){e.quarantined=!0}}).then(()=>!0,()=>(e.quarantined=!0,C(e).then(()=>(T(e),!0))))),e.releasePromise}function A({device:e,format:r,massesKg:i,massWords:a,provenance:o}={}){n(r);let s=o&&Object.getOwnPropertyDescriptor(o,`kind`),c=o&&Object.getOwnPropertyDescriptor(o,`reference`),l=a instanceof Uint32Array&&a.buffer instanceof ArrayBuffer&&a.length>0&&a.length%r.wordCount===0;if((a===void 0?!Array.isArray(i)||!i.length:!l||i!==void 0)||s?.value!==`initial-conditions`||typeof c?.value!=`string`||!c.value.trim())throw TypeError(`Explicit mass rows and initial-condition provenance required`);let u=x(l?a.length/r.wordCount:i.length,`inventory row count`,!0),d=l?a.slice():new Uint32Array(u*r.wordCount);for(let e=0;!l&&e<u;e++){let n=Object.getOwnPropertyDescriptor(i,String(e));if(!n||!Object.hasOwn(n,`value`))throw TypeError(`Each initial mass row must be explicit own data`);d.set(t(n.value,r),e*r.wordCount)}let f=Object.freeze({kind:`initial-conditions`,reference:c.value.trim()}),p=D(e,r,u,0);try{return p.buffer=w(e,p.resources,`ulg-exact-mass-initial`,d.byteLength),e.queue.writeBuffer(p.buffer,0,d),O(p,f)}catch(e){throw p.closed=!0,k(p),e}}async function j({device:e,placementRead:t}={}){let{resolveSchroederSpatialReactionPlacementDestinationRead:r,releaseSchroederSpatialReactionPlacementDestinationRead:i}=await import(`./sphGpuBuffers-CxUIgg26.js`).then(e=>e.zi),a=r(t,{device:e}),{format:o,quantityLayout:s,massBuffer:c,massByteLength:l,sourceInventoryGeneration:d}=a;n(o);let p=x(s?.rowCount,`placement inventory row count`,!0),m=x(x(d,`source inventory generation`)+1,`successor inventory generation`,!0);if(s.currentRowOffset!==0||s.eventRowOffset!==a.particleCount||p!==a.particleCount+a.residualLayout?.eventCapacity||l!==p*o.wordCount*4||f(c)!==e||c.size<l||(c.usage&4)!=4)throw TypeError(`Reaction inventory requires the complete original terminal mass plane`);let h=D(e,o,p,m);try{h.buffer=w(e,h.resources,`ulg-exact-mass-reaction-successor`,l);let n=e.createCommandEncoder({label:`ulg-exact-mass-reaction-successor`});n.copyBufferToBuffer(c,0,h.buffer,0,l);let o=n.finish();r(t,{device:e});let s=O(h,Object.freeze({kind:`reaction-placement`,sourceGeneration:d,carrierRowCount:a.particleCount,residualRowOffset:a.particleCount,residualRowCount:a.residualLayout.eventCapacity}));return i(t,{queueOrderedFinalConsumer:u(e,[o],{finalConsumerOwner:s,producerClaims:[t.queueOrderedCleanupClaim]})}),s}catch(e){throw h.closed=!0,k(h),e}}async function M({device:e,sourceRead:t}={}){let{resolveSchroederResidualMechanicsSourceRead:n}=await import(`./schroederResidualMechanicsSourceGpu-5Oj9QSYV.js`),{SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:r}=await import(`./sphReactionResidualHistoryGpu-BmE8gnaj.js`).then(e=>e.a),{source:a,carrier:o}=n(t,{device:e}),s=o.read,c=R(s,e),u=x(a.particleCount,`mechanics inventory count`,!0),d=D(e,c.format,u,x(Math.max(s.generation,a.history.generation)+1,`mechanics inventory generation`,!0));try{d.buffer=w(e,d.resources,`ulg-exact-mass-residual-mechanics`,u*r.format.wordCount*4);let o=i(e,{code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> control:array<u32>;
@group(0) @binding(2) var<storage,read_write> mass:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${a.historyCapacity}u || row>=control[4] || control[2]!=0u){return;}
  for(var w=0u;w<${r.format.wordCount}u;w++){
    mass[(${a.phaseLayout?.carrierLineageCount??a.carrierCount}u+row)*${r.format.wordCount}u+w]=
      history[${r.headerWords}u+row*${r.rowWords}u+${r.massOffset}u+w];
  }
}`,entryPoint:`gather`,cacheKey:`ulg-residual-mechanics-mass-v2-${a.carrierCount}-${a.historyCapacity}-${a.phaseLayout?.lineageCount??0}`,bindings:[l(0,`read-only-storage`),l(1,`read-only-storage`),l(2,`storage`)]}),c=e.createBindGroup({layout:o.bindGroupLayout,entries:[a.history.buffer,a.controlBuffer,d.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),f=e.createCommandEncoder();if(a.phaseLayout){let{carrierLineageCount:e,carrierLaneCount:t,lineageCount:n}=a.phaseLayout,i=r.format.wordCount*4;for(let r=0;r<t;r++)f.copyBufferToBuffer(s.buffer,s.byteOffset+r*e*i,d.buffer,r*n*i,e*i)}else f.copyBufferToBuffer(s.buffer,s.byteOffset,d.buffer,0,s.byteLength);let p=f.beginComputePass();return p.setPipeline(o.pipeline),p.setBindGroup(0,c),p.dispatchWorkgroups(Math.ceil(a.historyCapacity/64)),p.end(),n(t,{device:e}),e.queue.submit([f.finish()]),O(d,Object.freeze({kind:`residual-mechanics-projection`,carrierRowCount:a.carrierCount,historyCapacity:a.historyCapacity,sourceGeneration:s.generation,historyGeneration:a.history.generation}))}catch(e){throw d.closed=!0,k(d),e}}async function N({device:e,producerRead:t}={}){let{resolveSphSpatialVaporAerosolProducerRead:r,forkSphSpatialVaporAerosolProducerRead:i,releaseSphSpatialVaporAerosolProducerRead:o}=await import(`./sphGpuBuffers-CxUIgg26.js`).then(e=>e.yr),c=i(t,{device:e}),u=null,d=!1;try{let t=r(c,{device:e}),{format:i,sourceInventoryGeneration:a,endpoints:o}=t;n(i);let p=x(t.particleCount,`exchange inventory row count`,!0),m=x(x(a,`source inventory generation`)+1,`successor inventory generation`,!0),h=o.particleLayout,g=o.particleBuffer,_=p*i.wordCount,v=Math.ceil(_/64);if(h.rowCount!==p||h.recordWords<16+i.wordCount||h.wordLength!==p*h.recordWords||f(g)!==e||g.size!==h.wordLength*4||(g.usage&128)!=128||v>e.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Exchange inventory requires its complete original particle quantity plane`);u=D(e,i,p,m),u.buffer=w(e,u.resources,`ulg-exact-mass-vapor-successor`,_*4);let y=await s(e,{code:`
@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64)
fn gather_vapor_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= arrayLength(&masses)) { return; }
  let row = i / ${i.wordCount}u; let limb = i % ${i.wordCount}u;
  masses[i] = quantities[row * ${h.recordWords}u + 16u + limb];
}`,entryPoint:`gather_vapor_particle_mass`,label:`ulg-exact-mass-vapor-successor`,cacheKey:`ulg-exact-mass-vapor-successor-v1:${i.wordCount}:${h.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>l(t,e))});if(!y.pipeline)throw y.error??Error(`Exact exchange mass gather unavailable`);r(c,{device:e});let b=e.createBindGroup({layout:y.bindGroupLayout,entries:[g,u.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),S=e.createCommandEncoder({label:`ulg-exact-mass-vapor-successor`}),C=S.beginComputePass();C.setPipeline(y.pipeline),C.setBindGroup(0,b),C.dispatchWorkgroups(v),C.end();let T=O(u,Object.freeze({kind:`vapor-aerosol-exchange`,sourceGeneration:a,carrierRowCount:p}));return d=!0,e.queue.submit([S.finish()]),T}catch(e){throw u&&(u.closed=!0,k(u)),e}finally{d?a(e,()=>o(c)).catch(()=>{}):o(c)}}function P({device:e,sourceRead:t}={}){let n=v.get(t),r=n?.record;if(!n||n.released||r.device!==e||r.destroyed||r.quarantined||r.deviceState.lost||t.buffer!==r.buffer)throw TypeError(`Ledger mass successor requires an original live source read`);let i=x(t.rowCount,`ledger successor row count`,!0),a=x(x(t.generation,`ledger source generation`)+1,`ledger successor generation`,!0),o=D(e,r.format,i,a);try{o.buffer=w(e,o.resources,`ulg-exact-mass-ledger-phase-successor`,i*r.format.wordCount*4,140,!0);let n=O(o,Object.freeze({kind:`ledger-phase-carrier-transfer`,sourceGeneration:t.generation,carrierRowCount:i})),a=!1;return Object.freeze({family:n,buffer:o.buffer,abandon(){return a?!1:(a=!0,o.closed=!0,k(o),!0)},commit(){if(a)throw TypeError(`Ledger mass successor was already settled`);return a=!0,n}})}catch(e){throw o.closed=!0,k(o),e}}async function F({device:e,result:t,token:r}={}){let{resolveSphPhaseCarrierTransferSourceCapture:i}=await import(`./sphGpuBuffers-CxUIgg26.js`).then(e=>e.Ea),o=i(t,r),c=o.retain(),u=null,d=!1;try{let a=o.exactPhase;if(!a||o.inputs.device!==e)throw TypeError(`Phase inventory requires its original exact producer`);let{format:p,quantityBuffer:m,quantityLayout:h,sourceInventoryGeneration:g}=a;n(p);let _=x(a.particleCount,`phase inventory row count`,!0),v=x(x(g,`phase source generation`)+1,`phase successor generation`,!0),y=_*p.wordCount;if(h.rowCount!==_||h.massOffsetWords!==16||h.wordLength!==_*h.recordWords||f(m)!==e||m.size!==h.wordLength*4||(m.usage&128)!=128||Math.ceil(y/64)>e.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Phase inventory requires its complete original committed quantity plane`);u=D(e,p,_,v),u.buffer=w(e,u.resources,`ulg-exact-mass-phase-successor`,y*4);let b=await s(e,{code:`@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64) fn gather_phase_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&masses)){masses[i]=quantities[(i/${p.wordCount}u)*${h.recordWords}u+16u+i%${p.wordCount}u];}}`,entryPoint:`gather_phase_particle_mass`,cacheKey:`ulg-exact-mass-phase-successor-v1:${p.wordCount}:${h.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>l(t,e))});if(!b.pipeline)throw b.error??Error(`Exact phase mass gather unavailable`);i(t,r),c.validate();let S=e.createBindGroup({layout:b.bindGroupLayout,entries:[m,u.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),C=e.createCommandEncoder(),T=C.beginComputePass();T.setPipeline(b.pipeline),T.setBindGroup(0,S),T.dispatchWorkgroups(Math.ceil(y/64)),T.end();let E=O(u,Object.freeze({kind:`phase-carrier-transfer`,sourceGeneration:g,carrierRowCount:_}));return d=!0,e.queue.submit([C.finish()]),E}catch(e){throw u&&(u.closed=!0,k(u)),e}finally{d?a(e,()=>c.release()).catch(()=>{}):c.release()}}function I({family:e,device:t,format:n=e?.format,expectedGeneration:r=e?.generation}={}){let i=_.get(e);if(!i||i.device!==t||i.format!==n||i.generation!==r||i.closed||i.destroyed||i.quarantined||i.deviceState.lost)throw TypeError(`Exact mass requires the live original family, format, device and generation`);return L(i)}function L(e,t=0,n=e.rowCount){let r=t*e.format.wordCount*4,i=n*e.format.wordCount*4,a=Object.freeze({family:e.family,device:e.device,format:e.format,buffer:e.buffer,rowOffset:t,rowCount:n,byteOffset:r,byteLength:i,generation:e.generation});return v.set(a,{record:e,rowOffset:t,rowCount:n,released:!1}),e.borrows++,a}function R(e,t){let n=v.get(e),r=n?.record;if(!n||n.released||r.device!==t||r.destroyed||r.quarantined||r.deviceState.lost||e.buffer!==r.buffer||e.format!==r.format||e.rowOffset!==n.rowOffset||e.rowCount!==n.rowCount)throw TypeError(`Exact mass requires an original live retained read`);return r}function z(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}={}){try{let s=R(e,t);return s.family===n&&s.format===r&&s.generation===i&&(a===void 0||Object.is(e.rowOffset,a))&&(o===void 0||Object.is(e.rowCount,o))}catch{return!1}}function B(e,{device:t,family:n=e?.family,format:r=e?.format,expectedGeneration:i=e?.generation,rowOffset:a=e?.rowOffset,rowCount:o=e?.rowCount}={}){if(!z(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}))throw TypeError(`Exact mass read fork requires its original live retained read`);return L(R(e,t),e.rowOffset,e.rowCount)}function V(e,{device:t,rowOffset:n,rowCount:r}={}){let i=R(e,t);if(x(n,`relative inventory row offset`),x(r,`inventory window row count`,!0),n+r>e.rowCount)throw RangeError(`Exact mass window cannot extend outside its retained source range`);return L(i,e.rowOffset+n,r)}function H(e,{deferInBurst:t=!1,confirmed:n=!1}={}){let r=v.get(e);if(!r)throw TypeError(`Exact mass retirement requires the original read`);if(r.released)return r.releasePromise;r.released=!0;let i=()=>(r.record.borrows--,r.record.closed&&!r.record.borrows&&!r.record.releasePromise&&(r.record.releasePromise=Promise.resolve(!0),T(r.record)),!0);return n===!0?(r.releasePromise=Promise.resolve(i()),r.releasePromise):t===!0?(r.releasePromise=a(r.record.device,()=>{i()},{onQueueFenceRejected(){r.record.quarantined=!0}}).then(()=>!0,()=>(r.record.quarantined=!0,C(r.record).then(i))),r.releasePromise):(r.releasePromise=E(r.record).then(i),r.releasePromise)}function U(e){let t=_.get(e);if(!t)throw TypeError(`Exact mass retirement requires the original family`);t.closed=!0,k(t)}function W({device:e,sourceRead:t,edgeBuffer:n,edgeCount:r,edgeFormat:i}={}){return J({device:e,sourceReads:[t],edgeBuffer:n,edgeCount:r,edgeFormat:i})}function G({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return J({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0})}function K({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return J({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0,allocation:!0})}async function q(e,t){let n=[],r=[],i=new Map;try{let a=Object.getOwnPropertyDescriptor(t??{},`length`)?.value;if(!Array.isArray(t)||!Number.isSafeInteger(a)||a<1)throw TypeError(`Exact inventory sources require a nonempty array of original reads`);for(let o=0;o<a;o++){let a=Object.getOwnPropertyDescriptor(t,String(o));if(!a||!Object.hasOwn(a,`value`))throw TypeError(`Exact inventory sources require explicit own data reads`);let s=a.value,c=R(s,e),l=i.get(c)??[];if(l.some(e=>s.rowOffset<e.rowOffset+e.rowCount&&e.rowOffset<s.rowOffset+s.rowCount))throw TypeError(`Exact inventory sources cannot repeat or overlap rows from a numeric owner`);l.push(s),i.set(c,l),r.push(c),n.push(L(c,s.rowOffset,s.rowCount))}return{held:n,records:r}}catch(e){throw await Promise.all(n.map(e=>H(e))),e}}async function J({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:a,edgeCount:o,edgeFormat:s,partition:c=!1,allocation:u=!1}){let{held:d,records:p}=await q(e,t),m=p[0],g=m.format,_=null,v=null,y=null,b=!1;try{if(s!==g||p.some(e=>e.format!==g))throw TypeError(`Proposal and sources require the same original exact-mass format`);let t=x(d.reduce((e,t)=>e+t.rowCount,0),`joined source row count`,!0),S=c?x(n,`output row count`,!0):t,k=p.reduce((e,t)=>Math.max(e,t.generation),0),A=x(k+1,`candidate generation`,!0);x(o,`edge count`,!c);let j=o*(g.wordCount*(u?3:1)+2)*4;if(o>0&&(!a||f(a)!==e||a.destroyed||a.size!==j||!(a.usage&4)))throw TypeError(`Exact mass graph requires the complete same-device COPY_SRC proposal buffer`);if(o===0&&a!=null)throw TypeError(`Empty exact graph must omit its proposal buffer`);if(c&&(!r||f(r)!==e||r.destroyed||r.size!==t*4||!(r.usage&4)))throw TypeError(`Exact row mapping requires the complete same-device COPY_SRC destination buffer`);let M=Math.ceil(S/64);if(M>(e.limits?.maxComputeWorkgroupsPerDimension??65535))throw RangeError(`Exact mass gather exceeds device dispatch limit`);_=D(e,g,S,A),v=D(e,g,0,0),_.buffer=w(e,_.resources,`ulg-exact-mass-candidate`,S*g.wordCount*4);let N=w(e,v.resources,`ulg-exact-mass-params`,c?32:16,72),P=w(e,v.resources,`ulg-exact-mass-edges`,Math.max(4,j)),F=c||d[0].rowOffset!==0||d[0].rowCount!==m.rowCount,I=F?w(e,v.resources,`ulg-exact-mass-joined-source`,t*g.wordCount*4):m.buffer,L=c?w(e,v.resources,`ulg-exact-mass-destinations`,t*4):null,z=w(e,v.resources,`ulg-exact-mass-control`,64),B=w(e,v.resources,`ulg-exact-mass-verdict`,64,9),V=u?3:c?2:1,H=h(g,{partition:c,allocation:u}),U=[`uniform`,`read-only-storage`,`read-only-storage`,`storage`,`storage`];c&&U.push(`read-only-storage`);let W=[`exact_mass_gather`,`exact_mass_validate`,`exact_mass_finalize`].map(t=>{let n=i(e,{cacheKey:`ulg-${t}.v${V}.${g.wordCount}.${g.quantumExponent}`,label:t,entryPoint:t,code:H,bindings:U.map((e,t)=>l(t,e))}),r=[N,I,P,_.buffer,z];return c&&r.push(L),{info:n,group:e.createBindGroup({layout:n.bindGroupLayout,entries:r.map((e,t)=>({binding:t,resource:{buffer:e}}))})}});for(let t of d)R(t,e);let G=[S,o,k,A];c&&G.push(t,p.length,+!!u,0),e.queue.writeBuffer(N,0,new Uint32Array(G));let K=e.createCommandEncoder();if(F){let e=0;for(let t of d)K.copyBufferToBuffer(t.buffer,t.byteOffset,I,e,t.byteLength),e+=t.byteLength}c&&K.copyBufferToBuffer(r,0,L,0,t*4),o?K.copyBufferToBuffer(a,0,P,0,j):K.clearBuffer(P),K.clearBuffer(z);for(let[e,{info:t,group:n}]of W.entries()){let r=K.beginComputePass();r.setPipeline(t.pipeline),r.setBindGroup(0,n),r.dispatchWorkgroups(e===2?1:M),r.end()}K.copyBufferToBuffer(z,0,B,0,64),e.queue.submit([K.finish()]);let q=E(v);if(!await C(v,Promise.resolve(B.mapAsync(1)).then(()=>!0)))throw Error(`Exact mass device lost during verdict observation`);y=B;let J=new Uint32Array(B.getMappedRange()).slice();if(B.unmap(),y=null,!await q)throw Error(`Exact mass device lost before confirmed retirement`);b=!0;for(let t of d)R(t,e);if(J[0]!==1162695729||J[1]!==V||![1,2].includes(J[2])||J[4]!==S||J[5]!==o||J[6]!==S||J[7]!==A||J[8]!==k||c&&(J[9]!==t||J[10]!==p.length)||J.slice(c?11:9).some(Boolean)||J[2]===1!=(J[3]===0))throw Error(`Malformed exact-mass transfer verdict`);let Y=Object.freeze({ready:J[2]===1,errorBits:J[3],rowCount:S,edgeCount:o,sourceGeneration:k,generation:A,...c?{sourceRowCount:t,sourceCount:p.length}:{},observedBytes:64,scope:`mass-only`,physicalPublicationAdmitted:!1,...u?{packetSelection:`cumulative-integer-ratio`}:{}}),X=Object.freeze(c?{kind:u?`mass-allocation-candidate`:`mass-partition-transfer-candidate`,sources:Object.freeze(d.map(e=>Object.freeze({familyId:e.family.familyId,generation:e.generation,rowOffset:e.rowOffset,rowCount:e.rowCount})))}:{kind:`mass-transfer-candidate`,sourceFamilyId:m.family.familyId,sourceGeneration:k,sourceRowOffset:d[0].rowOffset,sourceRowCount:d[0].rowCount}),Z=Y.ready?O(_,X):null;return Z||T(_),Object.freeze({...Y,family:Z})}catch(e){if(y)try{y.unmap()}catch{}throw v&&await E(v),_&&T(_),e}finally{let t=b&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice;if(v&&(t||await E(v),T(v)),await Promise.all(d.map(e=>H(e,{confirmed:t}))),_?.family&&(_.destroyed||_.deviceState.lost||_.quarantined))throw Error(`Exact mass device lost before candidate delivery`)}}export{U as a,g as c,B as i,z as l,A as n,H as o,P as r,V as s,I as t};