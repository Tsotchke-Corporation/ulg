import{t as e}from"./preload-helper-CwQZjUKM.js";import{N as t,O as n,T as r,b as i,c as a,g as o,h as s,k as c,m as l}from"./webgpuComputeLayout-CHUyeeFd.js";import{i as u,o as d}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{a as f,c as p,t as m}from"./sphExactMassWgsl-DwXztSAS.js";var h=1162695729,g=Object.freeze({LAYOUT:64,ENDPOINT:128,ALIAS:256,COMPLETION:512,STORED_STATE:1024,NONZERO_DROP:2048});function _(e,{partition:t=!1,allocation:n=!1}={}){if(n&&!t)throw TypeError(`Exact allocation requires the remapped source domain`);let r=g;return m(e)+`
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
  atomicStore(&control[0], ${h}u);
  atomicStore(&control[1], ${n?3:t?2:1}u);
  atomicStore(&control[2], select(2u, 1u, atomicLoad(&control[3]) == 0u));
  atomicStore(&control[4], params.x); atomicStore(&control[5], params.y);
  atomicStore(&control[7], params.w); atomicStore(&control[8], params.z);
  ${t?`atomicStore(&control[9], params.sourceRows); atomicStore(&control[10], params.sourceCount);`:``}
}
`}var v=new WeakMap,y=new WeakMap,b=new WeakMap,x=128,S=4,C=1,w=140,T=1;function E(e,t,n=!1){if(!Number.isSafeInteger(e)||Object.is(e,-0)||e<+!!n||e>4294967295)throw RangeError(`${t} must be an exact ${n?`positive `:``}u32`);return e}function D(e){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.writeBuffer||!e?.queue?.submit||!e?.queue?.onSubmittedWorkDone||!e?.lost?.then)throw TypeError(`Exact inventory requires a WebGPU device with queue retirement`);let t=b.get(e);if(t||(t={lost:!1,records:new Set,lossListeners:new Set},e.lost.then(()=>{t.lost=!0;for(let e of[...t.records])e.closed=!0,A(e);for(let e of[...t.lossListeners])e();t.lossListeners.clear()},()=>{}),b.set(e,t)),t.lost)throw Error(`Exact inventory device is lost`);return t}function O(e,t){let n=e.deviceState;return n.lost?Promise.resolve(!1):new Promise((e,r)=>{let i=!1,a=(t,a=!1)=>{i||(i=!0,n.lossListeners.delete(o),a?r(t):e(t))},o=()=>a(!1);n.lossListeners.add(o),t&&Promise.resolve(t).then(e=>a(e),e=>a(e,!0))})}function k(e,t,r,i,o=w,s=!1){let c=Math.min(e.limits?.maxBufferSize??268435456,o&x?e.limits?.maxStorageBufferBindingSize??134217728:1/0);if(!Number.isSafeInteger(i)||i<=0||i%4||i>c)throw RangeError(`${r} exceeds exact-mass buffer limits`);let l=s&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice?n(a(e,{bucketKey:r,label:r,size:i,usage:o}),e,{bucketKey:r,size:i,usage:o}):e.createBuffer({label:r,size:i,usage:o});return t.add(l),u(l,e),l}function A(e){if(e.destroyed)return;e.destroyed=!0;let t=!e.deviceState.lost&&!e.quarantined;for(let n of e.resources){try{n.mapState===`mapped`&&n.unmap()}catch{}try{c(n,{allowPool:t})}catch{}}e.resources.clear(),e.deviceState.records.delete(e)}async function j(e){if(e.deviceState.lost)return!1;try{let t=e.device.queue.onSubmittedWorkDone();if(!t||typeof t.then!=`function`)throw Error(`Missing queue fence`);return await O(e,Promise.resolve(t).then(()=>!0,()=>(e.quarantined=!0,O(e))))}catch{return e.quarantined=!0,O(e)}}function M(e,t,n,r){let i=D(e),a={device:e,deviceState:i,format:t,rowCount:n,generation:r,buffer:null,resources:new Set,borrows:0,closed:!1,destroyed:!1,quarantined:!1,releasePromise:null};return i.records.add(a),a}function N(e,t){if(!Number.isSafeInteger(T))throw RangeError(`Exact-mass family identity exhausted`);let n=Object.freeze({schema:`peercompute.ulg.exact-mass-family.v1`,familyId:T++,format:e.format,rowCount:e.rowCount,generation:e.generation,provenance:t,scope:`mass-inventory-only`,physicalPublicationAdmitted:!1});return e.family=n,v.set(n,e),n}async function P(e){return!e.closed||e.borrows||e.releasePromise||(e.releasePromise=i(e.device,()=>{A(e)},{onQueueFenceRejected(){e.quarantined=!0}}).then(()=>!0,()=>(e.quarantined=!0,O(e).then(()=>(A(e),!0))))),e.releasePromise}function F({device:e,format:t,massesKg:n,massWords:r,provenance:i}={}){p(t);let a=i&&Object.getOwnPropertyDescriptor(i,`kind`),o=i&&Object.getOwnPropertyDescriptor(i,`reference`),s=r instanceof Uint32Array&&r.buffer instanceof ArrayBuffer&&r.length>0&&r.length%t.wordCount===0;if((r===void 0?!Array.isArray(n)||!n.length:!s||n!==void 0)||a?.value!==`initial-conditions`||typeof o?.value!=`string`||!o.value.trim())throw TypeError(`Explicit mass rows and initial-condition provenance required`);let c=E(s?r.length/t.wordCount:n.length,`inventory row count`,!0),l=s?r.slice():new Uint32Array(c*t.wordCount);for(let e=0;!s&&e<c;e++){let r=Object.getOwnPropertyDescriptor(n,String(e));if(!r||!Object.hasOwn(r,`value`))throw TypeError(`Each initial mass row must be explicit own data`);l.set(f(r.value,t),e*t.wordCount)}let u=Object.freeze({kind:`initial-conditions`,reference:o.value.trim()}),d=M(e,t,c,0);try{return d.buffer=k(e,d.resources,`ulg-exact-mass-initial`,l.byteLength),e.queue.writeBuffer(d.buffer,0,l),N(d,u)}catch(e){throw d.closed=!0,P(d),e}}async function I({device:n,placementRead:r}={}){let{resolveSchroederSpatialReactionPlacementDestinationRead:i,releaseSchroederSpatialReactionPlacementDestinationRead:a}=await e(async()=>{let{resolveSchroederSpatialReactionPlacementDestinationRead:e,releaseSchroederSpatialReactionPlacementDestinationRead:t}=await import(`./schroederSpatialReactionPlacementEpochGpu-xiqj49IO.js`);return{resolveSchroederSpatialReactionPlacementDestinationRead:e,releaseSchroederSpatialReactionPlacementDestinationRead:t}},[],import.meta.url),o=i(r,{device:n}),{format:s,quantityLayout:c,massBuffer:l,massByteLength:u,sourceInventoryGeneration:f}=o;p(s);let m=E(c?.rowCount,`placement inventory row count`,!0),h=E(E(f,`source inventory generation`)+1,`successor inventory generation`,!0);if(c.currentRowOffset!==0||c.eventRowOffset!==o.particleCount||m!==o.particleCount+o.residualLayout?.eventCapacity||u!==m*s.wordCount*4||d(l)!==n||l.size<u||(l.usage&S)!==S)throw TypeError(`Reaction inventory requires the complete original terminal mass plane`);let g=M(n,s,m,h);try{g.buffer=k(n,g.resources,`ulg-exact-mass-reaction-successor`,u);let e=n.createCommandEncoder({label:`ulg-exact-mass-reaction-successor`});e.copyBufferToBuffer(l,0,g.buffer,0,u);let s=e.finish();i(r,{device:n});let c=N(g,Object.freeze({kind:`reaction-placement`,sourceGeneration:f,carrierRowCount:o.particleCount,residualRowOffset:o.particleCount,residualRowCount:o.residualLayout.eventCapacity}));return a(r,{queueOrderedFinalConsumer:t(n,[s],{finalConsumerOwner:c,producerClaims:[r.queueOrderedCleanupClaim]})}),c}catch(e){throw g.closed=!0,P(g),e}}async function L({device:t,sourceRead:n}={}){let{resolveSchroederResidualMechanicsSourceRead:r}=await e(async()=>{let{resolveSchroederResidualMechanicsSourceRead:e}=await import(`./schroederResidualMechanicsSourceGpu-4he0JIrz.js`);return{resolveSchroederResidualMechanicsSourceRead:e}},[],import.meta.url),{SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:i}=await e(async()=>{let{SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:e}=await import(`./sphReactionResidualHistoryGpu-Bg4p_UPg.js`);return{SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:e}},[],import.meta.url),{source:a,carrier:c}=r(n,{device:t}),u=c.read,d=U(u,t),f=E(a.particleCount,`mechanics inventory count`,!0),p=M(t,d.format,f,E(Math.max(u.generation,a.history.generation)+1,`mechanics inventory generation`,!0));try{p.buffer=k(t,p.resources,`ulg-exact-mass-residual-mechanics`,f*i.format.wordCount*4);let e=o(t,{code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> control:array<u32>;
@group(0) @binding(2) var<storage,read_write> mass:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${a.historyCapacity}u || row>=control[4] || control[2]!=0u){return;}
  for(var w=0u;w<${i.format.wordCount}u;w++){
    mass[(${a.phaseLayout?.carrierLineageCount??a.carrierCount}u+row)*${i.format.wordCount}u+w]=
      history[${i.headerWords}u+row*${i.rowWords}u+${i.massOffset}u+w];
  }
}`,entryPoint:`gather`,cacheKey:`ulg-residual-mechanics-mass-v2-${a.carrierCount}-${a.historyCapacity}-${a.phaseLayout?.lineageCount??0}`,bindings:[l(0,`read-only-storage`),l(1,`read-only-storage`),l(2,`storage`)]}),c=s(t,{layout:e.bindGroupLayout,entries:[a.history.buffer,a.controlBuffer,p.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=t.createCommandEncoder();if(a.phaseLayout){let{carrierLineageCount:e,carrierLaneCount:t,lineageCount:n}=a.phaseLayout,r=i.format.wordCount*4;for(let i=0;i<t;i++)d.copyBufferToBuffer(u.buffer,u.byteOffset+i*e*r,p.buffer,i*n*r,e*r)}else d.copyBufferToBuffer(u.buffer,u.byteOffset,p.buffer,0,u.byteLength);let m=d.beginComputePass();return m.setPipeline(e.pipeline),m.setBindGroup(0,c),m.dispatchWorkgroups(Math.ceil(a.historyCapacity/64)),m.end(),r(n,{device:t}),t.queue.submit([d.finish()]),N(p,Object.freeze({kind:`residual-mechanics-projection`,carrierRowCount:a.carrierCount,historyCapacity:a.historyCapacity,sourceGeneration:u.generation,historyGeneration:a.history.generation}))}catch(e){throw p.closed=!0,P(p),e}}async function R({device:t,producerRead:n}={}){let{resolveSphSpatialVaporAerosolProducerRead:a,forkSphSpatialVaporAerosolProducerRead:o,releaseSphSpatialVaporAerosolProducerRead:c}=await e(async()=>{let{resolveSphSpatialVaporAerosolProducerRead:e,forkSphSpatialVaporAerosolProducerRead:t,releaseSphSpatialVaporAerosolProducerRead:n}=await import(`./sphSpatialGasLedgerEosGpu-Cl7tuR6o.js`);return{resolveSphSpatialVaporAerosolProducerRead:e,forkSphSpatialVaporAerosolProducerRead:t,releaseSphSpatialVaporAerosolProducerRead:n}},[],import.meta.url),u=o(n,{device:t}),f=null,m=!1;try{let e=a(u,{device:t}),{format:n,sourceInventoryGeneration:i,endpoints:o}=e;p(n);let c=E(e.particleCount,`exchange inventory row count`,!0),h=E(E(i,`source inventory generation`)+1,`successor inventory generation`,!0),g=o.particleLayout,_=o.particleBuffer,v=c*n.wordCount,y=Math.ceil(v/64);if(g.rowCount!==c||g.recordWords<16+n.wordCount||g.wordLength!==c*g.recordWords||d(_)!==t||_.size!==g.wordLength*4||(_.usage&x)!==x||y>t.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Exchange inventory requires its complete original particle quantity plane`);f=M(t,n,c,h),f.buffer=k(t,f.resources,`ulg-exact-mass-vapor-successor`,v*4);let b=await r(t,{code:`
@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64)
fn gather_vapor_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= arrayLength(&masses)) { return; }
  let row = i / ${n.wordCount}u; let limb = i % ${n.wordCount}u;
  masses[i] = quantities[row * ${g.recordWords}u + 16u + limb];
}`,entryPoint:`gather_vapor_particle_mass`,label:`ulg-exact-mass-vapor-successor`,cacheKey:`ulg-exact-mass-vapor-successor-v1:${n.wordCount}:${g.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>l(t,e))});if(!b.pipeline)throw b.error??Error(`Exact exchange mass gather unavailable`);a(u,{device:t});let S=s(t,{layout:b.bindGroupLayout,entries:[_,f.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),C=t.createCommandEncoder({label:`ulg-exact-mass-vapor-successor`}),w=C.beginComputePass();w.setPipeline(b.pipeline),w.setBindGroup(0,S),w.dispatchWorkgroups(y),w.end();let T=N(f,Object.freeze({kind:`vapor-aerosol-exchange`,sourceGeneration:i,carrierRowCount:c}));return m=!0,t.queue.submit([C.finish()]),T}catch(e){throw f&&(f.closed=!0,P(f)),e}finally{m?i(t,()=>c(u)).catch(()=>{}):c(u)}}function z({device:e,sourceRead:t}={}){let n=y.get(t),r=n?.record;if(!n||n.released||r.device!==e||r.destroyed||r.quarantined||r.deviceState.lost||t.buffer!==r.buffer)throw TypeError(`Ledger mass successor requires an original live source read`);let i=E(t.rowCount,`ledger successor row count`,!0),a=E(E(t.generation,`ledger source generation`)+1,`ledger successor generation`,!0),o=M(e,r.format,i,a);try{o.buffer=k(e,o.resources,`ulg-exact-mass-ledger-phase-successor`,i*r.format.wordCount*4,w,!0);let n=N(o,Object.freeze({kind:`ledger-phase-carrier-transfer`,sourceGeneration:t.generation,carrierRowCount:i})),a=!1;return Object.freeze({family:n,buffer:o.buffer,abandon(){return a?!1:(a=!0,o.closed=!0,P(o),!0)},commit(){if(a)throw TypeError(`Ledger mass successor was already settled`);return a=!0,n}})}catch(e){throw o.closed=!0,P(o),e}}async function B({device:t,result:n,token:a}={}){let{resolveSphPhaseCarrierTransferSourceCapture:o}=await e(async()=>{let{resolveSphPhaseCarrierTransferSourceCapture:e}=await import(`./sphPhaseCarrierTransferGpu-YJLytpux.js`);return{resolveSphPhaseCarrierTransferSourceCapture:e}},[],import.meta.url),c=o(n,a),u=c.retain(),f=null,m=!1;try{let e=c.exactPhase;if(!e||c.inputs.device!==t)throw TypeError(`Phase inventory requires its original exact producer`);let{format:i,quantityBuffer:h,quantityLayout:g,sourceInventoryGeneration:_}=e;p(i);let v=E(e.particleCount,`phase inventory row count`,!0),y=E(E(_,`phase source generation`)+1,`phase successor generation`,!0),b=v*i.wordCount;if(g.rowCount!==v||g.massOffsetWords!==16||g.wordLength!==v*g.recordWords||d(h)!==t||h.size!==g.wordLength*4||(h.usage&x)!==x||Math.ceil(b/64)>t.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Phase inventory requires its complete original committed quantity plane`);f=M(t,i,v,y),f.buffer=k(t,f.resources,`ulg-exact-mass-phase-successor`,b*4);let S=await r(t,{code:`@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64) fn gather_phase_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&masses)){masses[i]=quantities[(i/${i.wordCount}u)*${g.recordWords}u+16u+i%${i.wordCount}u];}}`,entryPoint:`gather_phase_particle_mass`,cacheKey:`ulg-exact-mass-phase-successor-v1:${i.wordCount}:${g.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>l(t,e))});if(!S.pipeline)throw S.error??Error(`Exact phase mass gather unavailable`);o(n,a),u.validate();let C=s(t,{layout:S.bindGroupLayout,entries:[h,f.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),w=t.createCommandEncoder(),T=w.beginComputePass();T.setPipeline(S.pipeline),T.setBindGroup(0,C),T.dispatchWorkgroups(Math.ceil(b/64)),T.end();let D=N(f,Object.freeze({kind:`phase-carrier-transfer`,sourceGeneration:_,carrierRowCount:v}));return m=!0,t.queue.submit([w.finish()]),D}catch(e){throw f&&(f.closed=!0,P(f)),e}finally{m?i(t,()=>u.release()).catch(()=>{}):u.release()}}function V({family:e,device:t,format:n=e?.format,expectedGeneration:r=e?.generation}={}){let i=v.get(e);if(!i||i.device!==t||i.format!==n||i.generation!==r||i.closed||i.destroyed||i.quarantined||i.deviceState.lost)throw TypeError(`Exact mass requires the live original family, format, device and generation`);return H(i)}function H(e,t=0,n=e.rowCount){let r=t*e.format.wordCount*4,i=n*e.format.wordCount*4,a=Object.freeze({family:e.family,device:e.device,format:e.format,buffer:e.buffer,rowOffset:t,rowCount:n,byteOffset:r,byteLength:i,generation:e.generation});return y.set(a,{record:e,rowOffset:t,rowCount:n,released:!1}),e.borrows++,a}function U(e,t){let n=y.get(e),r=n?.record;if(!n||n.released||r.device!==t||r.destroyed||r.quarantined||r.deviceState.lost||e.buffer!==r.buffer||e.format!==r.format||e.rowOffset!==n.rowOffset||e.rowCount!==n.rowCount)throw TypeError(`Exact mass requires an original live retained read`);return r}function W(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}={}){try{let s=U(e,t);return s.family===n&&s.format===r&&s.generation===i&&(a===void 0||Object.is(e.rowOffset,a))&&(o===void 0||Object.is(e.rowCount,o))}catch{return!1}}function G(e,{device:t,family:n=e?.family,format:r=e?.format,expectedGeneration:i=e?.generation,rowOffset:a=e?.rowOffset,rowCount:o=e?.rowCount}={}){if(!W(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}))throw TypeError(`Exact mass read fork requires its original live retained read`);return H(U(e,t),e.rowOffset,e.rowCount)}function K(e,{device:t,rowOffset:n,rowCount:r}={}){let i=U(e,t);if(E(n,`relative inventory row offset`),E(r,`inventory window row count`,!0),n+r>e.rowCount)throw RangeError(`Exact mass window cannot extend outside its retained source range`);return H(i,e.rowOffset+n,r)}function q(e,{deferInBurst:t=!1,confirmed:n=!1}={}){let r=y.get(e);if(!r)throw TypeError(`Exact mass retirement requires the original read`);if(r.released)return r.releasePromise;r.released=!0;let a=()=>(r.record.borrows--,r.record.closed&&!r.record.borrows&&!r.record.releasePromise&&(r.record.releasePromise=Promise.resolve(!0),A(r.record)),!0);return n===!0?(r.releasePromise=Promise.resolve(a()),r.releasePromise):t===!0?(r.releasePromise=i(r.record.device,()=>{a()},{onQueueFenceRejected(){r.record.quarantined=!0}}).then(()=>!0,()=>(r.record.quarantined=!0,O(r.record).then(a))),r.releasePromise):(r.releasePromise=j(r.record).then(a),r.releasePromise)}function J(e){let t=v.get(e);if(!t)throw TypeError(`Exact mass retirement requires the original family`);t.closed=!0,P(t)}function Y({device:e,sourceRead:t,edgeBuffer:n,edgeCount:r,edgeFormat:i}={}){return $({device:e,sourceReads:[t],edgeBuffer:n,edgeCount:r,edgeFormat:i})}function X({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return $({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0})}function Z({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return $({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0,allocation:!0})}async function Q(e,t){let n=[],r=[],i=new Map;try{let a=Object.getOwnPropertyDescriptor(t??{},`length`)?.value;if(!Array.isArray(t)||!Number.isSafeInteger(a)||a<1)throw TypeError(`Exact inventory sources require a nonempty array of original reads`);for(let o=0;o<a;o++){let a=Object.getOwnPropertyDescriptor(t,String(o));if(!a||!Object.hasOwn(a,`value`))throw TypeError(`Exact inventory sources require explicit own data reads`);let s=a.value,c=U(s,e),l=i.get(c)??[];if(l.some(e=>s.rowOffset<e.rowOffset+e.rowCount&&e.rowOffset<s.rowOffset+s.rowCount))throw TypeError(`Exact inventory sources cannot repeat or overlap rows from a numeric owner`);l.push(s),i.set(c,l),r.push(c),n.push(H(c,s.rowOffset,s.rowCount))}return{held:n,records:r}}catch(e){throw await Promise.all(n.map(e=>q(e))),e}}async function $({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:c,partition:u=!1,allocation:f=!1}){let{held:p,records:m}=await Q(e,t),h=m[0],g=h.format,v=null,y=null,b=null,x=!1;try{if(c!==g||m.some(e=>e.format!==g))throw TypeError(`Proposal and sources require the same original exact-mass format`);let t=E(p.reduce((e,t)=>e+t.rowCount,0),`joined source row count`,!0),w=u?E(n,`output row count`,!0):t,T=m.reduce((e,t)=>Math.max(e,t.generation),0),D=E(T+1,`candidate generation`,!0);E(a,`edge count`,!u);let P=a*(g.wordCount*(f?3:1)+2)*4;if(a>0&&(!i||d(i)!==e||i.destroyed||i.size!==P||!(i.usage&S)))throw TypeError(`Exact mass graph requires the complete same-device COPY_SRC proposal buffer`);if(a===0&&i!=null)throw TypeError(`Empty exact graph must omit its proposal buffer`);if(u&&(!r||d(r)!==e||r.destroyed||r.size!==t*4||!(r.usage&S)))throw TypeError(`Exact row mapping requires the complete same-device COPY_SRC destination buffer`);let F=Math.ceil(w/64);if(F>(e.limits?.maxComputeWorkgroupsPerDimension??65535))throw RangeError(`Exact mass gather exceeds device dispatch limit`);v=M(e,g,w,D),y=M(e,g,0,0),v.buffer=k(e,v.resources,`ulg-exact-mass-candidate`,w*g.wordCount*4);let I=k(e,y.resources,`ulg-exact-mass-params`,u?32:16,72),L=k(e,y.resources,`ulg-exact-mass-edges`,Math.max(4,P)),R=u||p[0].rowOffset!==0||p[0].rowCount!==h.rowCount,z=R?k(e,y.resources,`ulg-exact-mass-joined-source`,t*g.wordCount*4):h.buffer,B=u?k(e,y.resources,`ulg-exact-mass-destinations`,t*4):null,V=k(e,y.resources,`ulg-exact-mass-control`,64),H=k(e,y.resources,`ulg-exact-mass-verdict`,64,9),W=f?3:u?2:1,G=_(g,{partition:u,allocation:f}),K=[`uniform`,`read-only-storage`,`read-only-storage`,`storage`,`storage`];u&&K.push(`read-only-storage`);let q=[`exact_mass_gather`,`exact_mass_validate`,`exact_mass_finalize`].map(t=>{let n=o(e,{cacheKey:`ulg-${t}.v${W}.${g.wordCount}.${g.quantumExponent}`,label:t,entryPoint:t,code:G,bindings:K.map((e,t)=>l(t,e))}),r=[I,z,L,v.buffer,V];return u&&r.push(B),{info:n,group:s(e,{layout:n.bindGroupLayout,entries:r.map((e,t)=>({binding:t,resource:{buffer:e}}))})}});for(let t of p)U(t,e);let J=[w,a,T,D];u&&J.push(t,m.length,+!!f,0),e.queue.writeBuffer(I,0,new Uint32Array(J));let Y=e.createCommandEncoder();if(R){let e=0;for(let t of p)Y.copyBufferToBuffer(t.buffer,t.byteOffset,z,e,t.byteLength),e+=t.byteLength}u&&Y.copyBufferToBuffer(r,0,B,0,t*4),a?Y.copyBufferToBuffer(i,0,L,0,P):Y.clearBuffer(L),Y.clearBuffer(V);for(let[e,{info:t,group:n}]of q.entries()){let r=Y.beginComputePass();r.setPipeline(t.pipeline),r.setBindGroup(0,n),r.dispatchWorkgroups(e===2?1:F),r.end()}Y.copyBufferToBuffer(V,0,H,0,64),e.queue.submit([Y.finish()]);let X=j(y);if(!await O(y,Promise.resolve(H.mapAsync(C)).then(()=>!0)))throw Error(`Exact mass device lost during verdict observation`);b=H;let Z=new Uint32Array(H.getMappedRange()).slice();if(H.unmap(),b=null,!await X)throw Error(`Exact mass device lost before confirmed retirement`);x=!0;for(let t of p)U(t,e);if(Z[0]!==1162695729||Z[1]!==W||![1,2].includes(Z[2])||Z[4]!==w||Z[5]!==a||Z[6]!==w||Z[7]!==D||Z[8]!==T||u&&(Z[9]!==t||Z[10]!==m.length)||Z.slice(u?11:9).some(Boolean)||Z[2]===1!=(Z[3]===0))throw Error(`Malformed exact-mass transfer verdict`);let Q=Object.freeze({ready:Z[2]===1,errorBits:Z[3],rowCount:w,edgeCount:a,sourceGeneration:T,generation:D,...u?{sourceRowCount:t,sourceCount:m.length}:{},observedBytes:64,scope:`mass-only`,physicalPublicationAdmitted:!1,...f?{packetSelection:`cumulative-integer-ratio`}:{}}),$=Object.freeze(u?{kind:f?`mass-allocation-candidate`:`mass-partition-transfer-candidate`,sources:Object.freeze(p.map(e=>Object.freeze({familyId:e.family.familyId,generation:e.generation,rowOffset:e.rowOffset,rowCount:e.rowCount})))}:{kind:`mass-transfer-candidate`,sourceFamilyId:h.family.familyId,sourceGeneration:T,sourceRowOffset:p[0].rowOffset,sourceRowCount:p[0].rowCount}),ee=Q.ready?N(v,$):null;return ee||A(v),Object.freeze({...Q,family:ee})}catch(e){if(b)try{b.unmap()}catch{}throw y&&await j(y),v&&A(v),e}finally{let t=x&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice;if(y&&(t||await j(y),A(y)),await Promise.all(p.map(e=>q(e,{confirmed:t}))),v?.family&&(v.destroyed||v.deviceState.lost||v.quarantined))throw Error(`Exact mass device lost before candidate delivery`)}}export{R as a,G as c,Z as d,X as f,W as h,L as i,J as l,K as m,B as n,F as o,Y as p,I as r,z as s,V as t,q as u};