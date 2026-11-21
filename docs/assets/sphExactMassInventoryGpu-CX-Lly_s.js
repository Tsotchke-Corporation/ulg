import{t as e}from"./rolldown-runtime-DK3Fl9T5.js";import{i as t,s as n}from"./sphExactMassInventory-FFefHwOc.js";import{_ as r,f as i,o as a,s as o,u as s}from"./webgpuComputeLayout-NKCaIXwi.js";import{i as c,o as l}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{t as u}from"./sphExactMassWgsl-ChqpSzqB.js";const d=Object.freeze({LAYOUT:64,ENDPOINT:128,ALIAS:256,COMPLETION:512,STORED_STATE:1024,NONZERO_DROP:2048});function f(e,{partition:t=!1,allocation:n=!1}={}){if(n&&!t)throw TypeError(`Exact allocation requires the remapped source domain`);let r=d;return u(e)+`
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
`}var p=e({acquireSphExactMassRead:()=>N,createSphExactMassInventoryFromPhaseTransferWebGpu:()=>M,createSphExactMassInventoryFromReactionPlacementWebGpu:()=>O,createSphExactMassInventoryFromResidualMechanicsWebGpu:()=>k,createSphExactMassInventoryFromVaporExchangeWebGpu:()=>A,createSphExactMassInventoryWebGpu:()=>D,createSphExactMassLedgerSuccessorWebGpu:()=>j,forkSphExactMassRead:()=>L,releaseSphExactMassInventory:()=>B,releaseSphExactMassRead:()=>z,runSphExactMassAllocationCandidateWebGpu:()=>U,runSphExactMassPartitionCandidateWebGpu:()=>H,runSphExactMassTransferCandidateWebGpu:()=>V,sliceSphExactMassRead:()=>R,validateSphExactMassRead:()=>I});const m=new WeakMap,h=new WeakMap,g=new WeakMap;let _=1;function v(e,t,n=!1){if(!Number.isSafeInteger(e)||Object.is(e,-0)||e<+!!n||e>4294967295)throw RangeError(`${t} must be an exact ${n?`positive `:``}u32`);return e}function y(e){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.writeBuffer||!e?.queue?.submit||!e?.queue?.onSubmittedWorkDone||!e?.lost?.then)throw TypeError(`Exact inventory requires a WebGPU device with queue retirement`);let t=g.get(e);if(t||(t={lost:!1,records:new Set,lossListeners:new Set},e.lost.then(()=>{t.lost=!0;for(let e of[...t.records])e.closed=!0,S(e);for(let e of[...t.lossListeners])e();t.lossListeners.clear()},()=>{}),g.set(e,t)),t.lost)throw Error(`Exact inventory device is lost`);return t}function b(e,t){let n=e.deviceState;return n.lost?Promise.resolve(!1):new Promise((e,r)=>{let i=!1,a=(t,a=!1)=>{i||(i=!0,n.lossListeners.delete(o),a?r(t):e(t))},o=()=>a(!1);n.lossListeners.add(o),t&&Promise.resolve(t).then(e=>a(e),e=>a(e,!0))})}function x(e,t,n,r,i=140){let a=Math.min(e.limits?.maxBufferSize??268435456,i&128?e.limits?.maxStorageBufferBindingSize??134217728:1/0);if(!Number.isSafeInteger(r)||r<=0||r%4||r>a)throw RangeError(`${n} exceeds exact-mass buffer limits`);let o=e.createBuffer({label:n,size:r,usage:i});return t.add(o),c(o,e),o}function S(e){if(!e.destroyed){e.destroyed=!0;for(let t of e.resources){try{t.mapState===`mapped`&&t.unmap()}catch{}try{t.destroy()}catch{}}e.resources.clear(),e.deviceState.records.delete(e)}}async function C(e){if(e.deviceState.lost)return!1;try{let t=e.device.queue.onSubmittedWorkDone();if(!t||typeof t.then!=`function`)throw Error(`Missing queue fence`);return await b(e,Promise.resolve(t).then(()=>!0,()=>(e.quarantined=!0,b(e))))}catch{return e.quarantined=!0,b(e)}}function w(e,t,n,r){let i=y(e),a={device:e,deviceState:i,format:t,rowCount:n,generation:r,buffer:null,resources:new Set,borrows:0,closed:!1,destroyed:!1,quarantined:!1,releasePromise:null};return i.records.add(a),a}function T(e,t){if(!Number.isSafeInteger(_))throw RangeError(`Exact-mass family identity exhausted`);let n=Object.freeze({schema:`peercompute.ulg.exact-mass-family.v1`,familyId:_++,format:e.format,rowCount:e.rowCount,generation:e.generation,provenance:t,scope:`mass-inventory-only`,physicalPublicationAdmitted:!1});return e.family=n,m.set(n,e),n}async function E(e){return!e.closed||e.borrows||e.releasePromise||(e.releasePromise=C(e).then(()=>(S(e),!0))),e.releasePromise}function D({device:e,format:r,massesKg:i,massWords:a,provenance:o}={}){n(r);let s=o&&Object.getOwnPropertyDescriptor(o,`kind`),c=o&&Object.getOwnPropertyDescriptor(o,`reference`),l=a instanceof Uint32Array&&a.buffer instanceof ArrayBuffer&&a.length>0&&a.length%r.wordCount===0;if((a===void 0?!Array.isArray(i)||!i.length:!l||i!==void 0)||s?.value!==`initial-conditions`||typeof c?.value!=`string`||!c.value.trim())throw TypeError(`Explicit mass rows and initial-condition provenance required`);let u=v(l?a.length/r.wordCount:i.length,`inventory row count`,!0),d=l?a.slice():new Uint32Array(u*r.wordCount);for(let e=0;!l&&e<u;e++){let n=Object.getOwnPropertyDescriptor(i,String(e));if(!n||!Object.hasOwn(n,`value`))throw TypeError(`Each initial mass row must be explicit own data`);d.set(t(n.value,r),e*r.wordCount)}let f=Object.freeze({kind:`initial-conditions`,reference:c.value.trim()}),p=w(e,r,u,0);try{return p.buffer=x(e,p.resources,`ulg-exact-mass-initial`,d.byteLength),e.queue.writeBuffer(p.buffer,0,d),T(p,f)}catch(e){throw p.closed=!0,E(p),e}}async function O({device:e,placementRead:t}={}){let{resolveSchroederSpatialReactionPlacementDestinationRead:i,releaseSchroederSpatialReactionPlacementDestinationRead:a}=await import(`./sphGpuBuffers-BnQhxGcp.js`).then(e=>e.Fi),o=i(t,{device:e}),{format:s,quantityLayout:c,massBuffer:u,massByteLength:d,sourceInventoryGeneration:f}=o;n(s);let p=v(c?.rowCount,`placement inventory row count`,!0),m=v(v(f,`source inventory generation`)+1,`successor inventory generation`,!0);if(c.currentRowOffset!==0||c.eventRowOffset!==o.particleCount||p!==o.particleCount+o.residualLayout?.eventCapacity||d!==p*s.wordCount*4||l(u)!==e||u.size<d||(u.usage&4)!=4)throw TypeError(`Reaction inventory requires the complete original terminal mass plane`);let h=w(e,s,p,m);try{h.buffer=x(e,h.resources,`ulg-exact-mass-reaction-successor`,d);let n=e.createCommandEncoder({label:`ulg-exact-mass-reaction-successor`});n.copyBufferToBuffer(u,0,h.buffer,0,d);let s=n.finish();i(t,{device:e});let c=T(h,Object.freeze({kind:`reaction-placement`,sourceGeneration:f,carrierRowCount:o.particleCount,residualRowOffset:o.particleCount,residualRowCount:o.residualLayout.eventCapacity}));return a(t,{queueOrderedFinalConsumer:r(e,[s],{finalConsumerOwner:c,producerClaims:[t.queueOrderedCleanupClaim]})}),c}catch(e){throw h.closed=!0,E(h),e}}async function k({device:e,sourceRead:t}={}){let{resolveSchroederResidualMechanicsSourceRead:n}=await import(`./schroederResidualMechanicsSourceGpu-Ck2Zo_ne.js`),{SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:r}=await import(`./sphReactionResidualHistoryGpu-qhxC3XX3.js`).then(e=>e.a),{source:i,carrier:s}=n(t,{device:e}),c=s.read,l=F(c,e),u=v(i.particleCount,`mechanics inventory count`,!0),d=w(e,l.format,u,v(Math.max(c.generation,i.history.generation)+1,`mechanics inventory generation`,!0));try{d.buffer=x(e,d.resources,`ulg-exact-mass-residual-mechanics`,u*r.format.wordCount*4);let s=o(e,{code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> control:array<u32>;
@group(0) @binding(2) var<storage,read_write> mass:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${i.historyCapacity}u || row>=control[4] || control[2]!=0u){return;}
  for(var w=0u;w<${r.format.wordCount}u;w++){
    mass[(${i.phaseLayout?.carrierLineageCount??i.carrierCount}u+row)*${r.format.wordCount}u+w]=
      history[${r.headerWords}u+row*${r.rowWords}u+${r.massOffset}u+w];
  }
}`,entryPoint:`gather`,cacheKey:`ulg-residual-mechanics-mass-v2-${i.carrierCount}-${i.historyCapacity}-${i.phaseLayout?.lineageCount??0}`,bindings:[a(0,`read-only-storage`),a(1,`read-only-storage`),a(2,`storage`)]}),l=e.createBindGroup({layout:s.bindGroupLayout,entries:[i.history.buffer,i.controlBuffer,d.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),f=e.createCommandEncoder();if(i.phaseLayout){let{carrierLineageCount:e,carrierLaneCount:t,lineageCount:n}=i.phaseLayout,a=r.format.wordCount*4;for(let r=0;r<t;r++)f.copyBufferToBuffer(c.buffer,c.byteOffset+r*e*a,d.buffer,r*n*a,e*a)}else f.copyBufferToBuffer(c.buffer,c.byteOffset,d.buffer,0,c.byteLength);let p=f.beginComputePass();return p.setPipeline(s.pipeline),p.setBindGroup(0,l),p.dispatchWorkgroups(Math.ceil(i.historyCapacity/64)),p.end(),n(t,{device:e}),e.queue.submit([f.finish()]),T(d,Object.freeze({kind:`residual-mechanics-projection`,carrierRowCount:i.carrierCount,historyCapacity:i.historyCapacity,sourceGeneration:c.generation,historyGeneration:i.history.generation}))}catch(e){throw d.closed=!0,E(d),e}}async function A({device:e,producerRead:t}={}){let{resolveSphSpatialVaporAerosolProducerRead:r,forkSphSpatialVaporAerosolProducerRead:o,releaseSphSpatialVaporAerosolProducerRead:c}=await import(`./sphGpuBuffers-BnQhxGcp.js`).then(e=>e.gr),u=o(t,{device:e}),d=null,f=!1;try{let t=r(u,{device:e}),{format:o,sourceInventoryGeneration:s,endpoints:c}=t;n(o);let p=v(t.particleCount,`exchange inventory row count`,!0),m=v(v(s,`source inventory generation`)+1,`successor inventory generation`,!0),h=c.particleLayout,g=c.particleBuffer,_=p*o.wordCount,y=Math.ceil(_/64);if(h.rowCount!==p||h.recordWords<16+o.wordCount||h.wordLength!==p*h.recordWords||l(g)!==e||g.size!==h.wordLength*4||(g.usage&128)!=128||y>e.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Exchange inventory requires its complete original particle quantity plane`);d=w(e,o,p,m),d.buffer=x(e,d.resources,`ulg-exact-mass-vapor-successor`,_*4);let b=await i(e,{code:`
@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64)
fn gather_vapor_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= arrayLength(&masses)) { return; }
  let row = i / ${o.wordCount}u; let limb = i % ${o.wordCount}u;
  masses[i] = quantities[row * ${h.recordWords}u + 16u + limb];
}`,entryPoint:`gather_vapor_particle_mass`,label:`ulg-exact-mass-vapor-successor`,cacheKey:`ulg-exact-mass-vapor-successor-v1:${o.wordCount}:${h.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>a(t,e))});if(!b.pipeline)throw b.error??Error(`Exact exchange mass gather unavailable`);r(u,{device:e});let S=e.createBindGroup({layout:b.bindGroupLayout,entries:[g,d.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),C=e.createCommandEncoder({label:`ulg-exact-mass-vapor-successor`}),E=C.beginComputePass();E.setPipeline(b.pipeline),E.setBindGroup(0,S),E.dispatchWorkgroups(y),E.end();let D=T(d,Object.freeze({kind:`vapor-aerosol-exchange`,sourceGeneration:s,carrierRowCount:p}));return f=!0,e.queue.submit([C.finish()]),D}catch(e){throw d&&(d.closed=!0,E(d)),e}finally{f?s(e,()=>c(u)).catch(()=>{}):c(u)}}function j({device:e,sourceRead:t}={}){let n=h.get(t),r=n?.record;if(!n||n.released||r.device!==e||r.destroyed||r.quarantined||r.deviceState.lost||t.buffer!==r.buffer)throw TypeError(`Ledger mass successor requires an original live source read`);let i=v(t.rowCount,`ledger successor row count`,!0),a=v(v(t.generation,`ledger source generation`)+1,`ledger successor generation`,!0),o=w(e,r.format,i,a);try{o.buffer=x(e,o.resources,`ulg-exact-mass-ledger-phase-successor`,i*r.format.wordCount*4);let n=T(o,Object.freeze({kind:`ledger-phase-carrier-transfer`,sourceGeneration:t.generation,carrierRowCount:i})),a=!1;return Object.freeze({family:n,buffer:o.buffer,abandon(){return a?!1:(a=!0,o.closed=!0,E(o),!0)},commit(){if(a)throw TypeError(`Ledger mass successor was already settled`);return a=!0,n}})}catch(e){throw o.closed=!0,E(o),e}}async function M({device:e,result:t,token:r}={}){let{resolveSphPhaseCarrierTransferSourceCapture:o}=await import(`./sphGpuBuffers-BnQhxGcp.js`).then(e=>e.ba),c=o(t,r),u=c.retain(),d=null,f=!1;try{let s=c.exactPhase;if(!s||c.inputs.device!==e)throw TypeError(`Phase inventory requires its original exact producer`);let{format:p,quantityBuffer:m,quantityLayout:h,sourceInventoryGeneration:g}=s;n(p);let _=v(s.particleCount,`phase inventory row count`,!0),y=v(v(g,`phase source generation`)+1,`phase successor generation`,!0),b=_*p.wordCount;if(h.rowCount!==_||h.massOffsetWords!==16||h.wordLength!==_*h.recordWords||l(m)!==e||m.size!==h.wordLength*4||(m.usage&128)!=128||Math.ceil(b/64)>e.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Phase inventory requires its complete original committed quantity plane`);d=w(e,p,_,y),d.buffer=x(e,d.resources,`ulg-exact-mass-phase-successor`,b*4);let S=await i(e,{code:`@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64) fn gather_phase_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&masses)){masses[i]=quantities[(i/${p.wordCount}u)*${h.recordWords}u+16u+i%${p.wordCount}u];}}`,entryPoint:`gather_phase_particle_mass`,cacheKey:`ulg-exact-mass-phase-successor-v1:${p.wordCount}:${h.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>a(t,e))});if(!S.pipeline)throw S.error??Error(`Exact phase mass gather unavailable`);o(t,r),u.validate();let C=e.createBindGroup({layout:S.bindGroupLayout,entries:[m,d.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),E=e.createCommandEncoder(),D=E.beginComputePass();D.setPipeline(S.pipeline),D.setBindGroup(0,C),D.dispatchWorkgroups(Math.ceil(b/64)),D.end();let O=T(d,Object.freeze({kind:`phase-carrier-transfer`,sourceGeneration:g,carrierRowCount:_}));return f=!0,e.queue.submit([E.finish()]),O}catch(e){throw d&&(d.closed=!0,E(d)),e}finally{f?s(e,()=>u.release()).catch(()=>{}):u.release()}}function N({family:e,device:t,format:n=e?.format,expectedGeneration:r=e?.generation}={}){let i=m.get(e);if(!i||i.device!==t||i.format!==n||i.generation!==r||i.closed||i.destroyed||i.quarantined||i.deviceState.lost)throw TypeError(`Exact mass requires the live original family, format, device and generation`);return P(i)}function P(e,t=0,n=e.rowCount){let r=t*e.format.wordCount*4,i=n*e.format.wordCount*4,a=Object.freeze({family:e.family,device:e.device,format:e.format,buffer:e.buffer,rowOffset:t,rowCount:n,byteOffset:r,byteLength:i,generation:e.generation});return h.set(a,{record:e,rowOffset:t,rowCount:n,released:!1}),e.borrows++,a}function F(e,t){let n=h.get(e),r=n?.record;if(!n||n.released||r.device!==t||r.destroyed||r.quarantined||r.deviceState.lost||e.buffer!==r.buffer||e.format!==r.format||e.rowOffset!==n.rowOffset||e.rowCount!==n.rowCount)throw TypeError(`Exact mass requires an original live retained read`);return r}function I(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}={}){try{let s=F(e,t);return s.family===n&&s.format===r&&s.generation===i&&(a===void 0||Object.is(e.rowOffset,a))&&(o===void 0||Object.is(e.rowCount,o))}catch{return!1}}function L(e,{device:t,family:n=e?.family,format:r=e?.format,expectedGeneration:i=e?.generation,rowOffset:a=e?.rowOffset,rowCount:o=e?.rowCount}={}){if(!I(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}))throw TypeError(`Exact mass read fork requires its original live retained read`);return P(F(e,t),e.rowOffset,e.rowCount)}function R(e,{device:t,rowOffset:n,rowCount:r}={}){let i=F(e,t);if(v(n,`relative inventory row offset`),v(r,`inventory window row count`,!0),n+r>e.rowCount)throw RangeError(`Exact mass window cannot extend outside its retained source range`);return P(i,e.rowOffset+n,r)}function z(e){let t=h.get(e);if(!t)throw TypeError(`Exact mass retirement requires the original read`);return t.released?t.releasePromise:(t.released=!0,t.releasePromise=C(t.record).then(()=>(t.record.borrows--,E(t.record),!0)),t.releasePromise)}function B(e){let t=m.get(e);if(!t)throw TypeError(`Exact mass retirement requires the original family`);t.closed=!0,E(t)}function V({device:e,sourceRead:t,edgeBuffer:n,edgeCount:r,edgeFormat:i}={}){return G({device:e,sourceReads:[t],edgeBuffer:n,edgeCount:r,edgeFormat:i})}function H({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return G({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0})}function U({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return G({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0,allocation:!0})}async function W(e,t){let n=[],r=[],i=new Map;try{let a=Object.getOwnPropertyDescriptor(t??{},`length`)?.value;if(!Array.isArray(t)||!Number.isSafeInteger(a)||a<1)throw TypeError(`Exact inventory sources require a nonempty array of original reads`);for(let o=0;o<a;o++){let a=Object.getOwnPropertyDescriptor(t,String(o));if(!a||!Object.hasOwn(a,`value`))throw TypeError(`Exact inventory sources require explicit own data reads`);let s=a.value,c=F(s,e),l=i.get(c)??[];if(l.some(e=>s.rowOffset<e.rowOffset+e.rowCount&&e.rowOffset<s.rowOffset+s.rowCount))throw TypeError(`Exact inventory sources cannot repeat or overlap rows from a numeric owner`);l.push(s),i.set(c,l),r.push(c),n.push(P(c,s.rowOffset,s.rowCount))}return{held:n,records:r}}catch(e){throw await Promise.all(n.map(e=>z(e))),e}}async function G({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:s,edgeFormat:c,partition:u=!1,allocation:d=!1}){let{held:p,records:m}=await W(e,t),h=m[0],g=h.format,_=null,y=null,E=null;try{if(c!==g||m.some(e=>e.format!==g))throw TypeError(`Proposal and sources require the same original exact-mass format`);let t=v(p.reduce((e,t)=>e+t.rowCount,0),`joined source row count`,!0),D=u?v(n,`output row count`,!0):t,O=m.reduce((e,t)=>Math.max(e,t.generation),0),k=v(O+1,`candidate generation`,!0);v(s,`edge count`,!u);let A=s*(g.wordCount*(d?3:1)+2)*4;if(s>0&&(!i||l(i)!==e||i.destroyed||i.size!==A||!(i.usage&4)))throw TypeError(`Exact mass graph requires the complete same-device COPY_SRC proposal buffer`);if(s===0&&i!=null)throw TypeError(`Empty exact graph must omit its proposal buffer`);if(u&&(!r||l(r)!==e||r.destroyed||r.size!==t*4||!(r.usage&4)))throw TypeError(`Exact row mapping requires the complete same-device COPY_SRC destination buffer`);let j=Math.ceil(D/64);if(j>(e.limits?.maxComputeWorkgroupsPerDimension??65535))throw RangeError(`Exact mass gather exceeds device dispatch limit`);_=w(e,g,D,k),y=w(e,g,0,0),_.buffer=x(e,_.resources,`ulg-exact-mass-candidate`,D*g.wordCount*4);let M=x(e,y.resources,`ulg-exact-mass-params`,u?32:16,72),N=x(e,y.resources,`ulg-exact-mass-edges`,Math.max(4,A)),P=u||p[0].rowOffset!==0||p[0].rowCount!==h.rowCount,I=P?x(e,y.resources,`ulg-exact-mass-joined-source`,t*g.wordCount*4):h.buffer,L=u?x(e,y.resources,`ulg-exact-mass-destinations`,t*4):null,R=x(e,y.resources,`ulg-exact-mass-control`,64),z=x(e,y.resources,`ulg-exact-mass-verdict`,64,9),B=d?3:u?2:1,V=f(g,{partition:u,allocation:d}),H=[`uniform`,`read-only-storage`,`read-only-storage`,`storage`,`storage`];u&&H.push(`read-only-storage`);let U=[`exact_mass_gather`,`exact_mass_validate`,`exact_mass_finalize`].map(t=>{let n=o(e,{cacheKey:`ulg-${t}.v${B}.${g.wordCount}.${g.quantumExponent}`,label:t,entryPoint:t,code:V,bindings:H.map((e,t)=>a(t,e))}),r=[M,I,N,_.buffer,R];return u&&r.push(L),{info:n,group:e.createBindGroup({layout:n.bindGroupLayout,entries:r.map((e,t)=>({binding:t,resource:{buffer:e}}))})}});for(let t of p)F(t,e);let W=[D,s,O,k];u&&W.push(t,m.length,+!!d,0),e.queue.writeBuffer(M,0,new Uint32Array(W));let G=e.createCommandEncoder();if(P){let e=0;for(let t of p)G.copyBufferToBuffer(t.buffer,t.byteOffset,I,e,t.byteLength),e+=t.byteLength}u&&G.copyBufferToBuffer(r,0,L,0,t*4),s?G.copyBufferToBuffer(i,0,N,0,A):G.clearBuffer(N),G.clearBuffer(R);for(let[e,{info:t,group:n}]of U.entries()){let r=G.beginComputePass();r.setPipeline(t.pipeline),r.setBindGroup(0,n),r.dispatchWorkgroups(e===2?1:j),r.end()}G.copyBufferToBuffer(R,0,z,0,64),e.queue.submit([G.finish()]);let K=C(y);if(!await b(y,Promise.resolve(z.mapAsync(1)).then(()=>!0)))throw Error(`Exact mass device lost during verdict observation`);E=z;let q=new Uint32Array(z.getMappedRange()).slice();if(z.unmap(),E=null,!await K)throw Error(`Exact mass device lost before confirmed retirement`);for(let t of p)F(t,e);if(q[0]!==1162695729||q[1]!==B||![1,2].includes(q[2])||q[4]!==D||q[5]!==s||q[6]!==D||q[7]!==k||q[8]!==O||u&&(q[9]!==t||q[10]!==m.length)||q.slice(u?11:9).some(Boolean)||q[2]===1!=(q[3]===0))throw Error(`Malformed exact-mass transfer verdict`);let J=Object.freeze({ready:q[2]===1,errorBits:q[3],rowCount:D,edgeCount:s,sourceGeneration:O,generation:k,...u?{sourceRowCount:t,sourceCount:m.length}:{},observedBytes:64,scope:`mass-only`,physicalPublicationAdmitted:!1,...d?{packetSelection:`cumulative-integer-ratio`}:{}}),Y=Object.freeze(u?{kind:d?`mass-allocation-candidate`:`mass-partition-transfer-candidate`,sources:Object.freeze(p.map(e=>Object.freeze({familyId:e.family.familyId,generation:e.generation,rowOffset:e.rowOffset,rowCount:e.rowCount})))}:{kind:`mass-transfer-candidate`,sourceFamilyId:h.family.familyId,sourceGeneration:O,sourceRowOffset:p[0].rowOffset,sourceRowCount:p[0].rowCount}),X=J.ready?T(_,Y):null;return X||S(_),Object.freeze({...J,family:X})}catch(e){if(E)try{E.unmap()}catch{}throw y&&await C(y),_&&S(_),e}finally{if(y&&(await C(y),S(y)),await Promise.all(p.map(e=>z(e))),_?.family&&(_.destroyed||_.deviceState.lost||_.quarantined))throw Error(`Exact mass device lost before candidate delivery`)}}export{B as a,p as c,L as i,I as l,D as n,z as o,j as r,R as s,N as t};