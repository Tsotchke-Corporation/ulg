import{a as e,c as t,t as n}from"./sphExactMassWgsl-quqzAZyn.js";import{E as r,S as i,c as a,l as o,n as s,p as c,u as l,v as u,x as d}from"./webgpuComputeLayout-tWh43k53.js";import{i as f,o as p}from"./sphGpuDeviceIdentity-CsdIpAMj.js";const m=Object.freeze({LAYOUT:64,ENDPOINT:128,ALIAS:256,COMPLETION:512,STORED_STATE:1024,NONZERO_DROP:2048});function h(e,{partition:t=!1,allocation:r=!1}={}){if(r&&!t)throw TypeError(`Exact allocation requires the remapped source domain`);let i=m;return n(e)+`
const EM_EDGE_WORDS: u32 = ${r?`3u * EM_WORDS + 2u`:`EM_WORDS + 2u`};
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
    && all(params.reserved == vec2<u32>(${+!!r}u, 0u));`:`
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
      if (nonzero != 0u) { errors |= ${i.NONZERO_DROP}u; }
    } else if (destination >= params.x) {
      errors |= ${i.ENDPOINT}u;
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
    if (donor >= params.x || receiver >= params.x) { errors |= ${i.ENDPOINT}u; continue; }
    if (donor == receiver) { errors |= ${i.ALIAS}u; continue; }
    if (donor != row && receiver != row) { continue; }
    var packet: ExactMass;
    ${r?`var lower: ExactMass; var upper: ExactMass; var denominator: ExactMass;
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
  if (!em_layout()) { atomicOr(&control[3], ${i.LAYOUT}u); return; }
  if (id.x >= params.x) { return; }
  let expected = em_expected_row(id.x);
  atomicOr(&control[3], expected.error);
  for (var i = 0u; i < EM_WORDS; i++) { candidate[id.x * EM_WORDS + i] = expected.value.words[i]; }
}
@compute @workgroup_size(64)
fn exact_mass_validate(@builtin(global_invocation_id) id: vec3<u32>) {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${i.LAYOUT}u); return; }
  if (id.x >= params.x) { return; }
  let expected = em_expected_row(id.x);
  var errors = expected.error;
  for (var i = 0u; i < EM_WORDS; i++) {
    if (candidate[id.x * EM_WORDS + i] != expected.value.words[i]) { errors |= ${i.STORED_STATE}u; }
  }
  atomicOr(&control[3], errors);
  atomicAdd(&control[6], 1u);
}
@compute @workgroup_size(1)
fn exact_mass_finalize() {
  if (arrayLength(&control) != 16u) { return; }
  if (!em_layout()) { atomicOr(&control[3], ${i.LAYOUT}u); }
  if (atomicLoad(&control[6]) != params.x) { atomicOr(&control[3], ${i.COMPLETION}u); }
  atomicStore(&control[0], 1162695729u);
  atomicStore(&control[1], ${r?3:t?2:1}u);
  atomicStore(&control[2], select(2u, 1u, atomicLoad(&control[3]) == 0u));
  atomicStore(&control[4], params.x); atomicStore(&control[5], params.y);
  atomicStore(&control[7], params.w); atomicStore(&control[8], params.z);
  ${t?`atomicStore(&control[9], params.sourceRows); atomicStore(&control[10], params.sourceCount);`:``}
}
`}const g=new WeakMap,_=new WeakMap,v=new WeakMap;let y=1;function b(e,t,n=!1){if(!Number.isSafeInteger(e)||Object.is(e,-0)||e<+!!n||e>4294967295)throw RangeError(`${t} must be an exact ${n?`positive `:``}u32`);return e}function x(e){if(!e?.createBuffer||!e?.createCommandEncoder||!e?.queue?.writeBuffer||!e?.queue?.submit||!e?.queue?.onSubmittedWorkDone||!e?.lost?.then)throw TypeError(`Exact inventory requires a WebGPU device with queue retirement`);let t=v.get(e);if(t||(t={lost:!1,records:new Set,lossListeners:new Set},e.lost.then(()=>{t.lost=!0;for(let e of[...t.records])e.closed=!0,w(e);for(let e of[...t.lossListeners])e();t.lossListeners.clear()},()=>{}),v.set(e,t)),t.lost)throw Error(`Exact inventory device is lost`);return t}function S(e,t){let n=e.deviceState;return n.lost?Promise.resolve(!1):new Promise((e,r)=>{let i=!1,a=(t,a=!1)=>{i||(i=!0,n.lossListeners.delete(o),a?r(t):e(t))},o=()=>a(!1);n.lossListeners.add(o),t&&Promise.resolve(t).then(e=>a(e),e=>a(e,!0))})}function C(e,t,n,r,i=140,a=!1){let o=Math.min(e.limits?.maxBufferSize??268435456,i&128?e.limits?.maxStorageBufferBindingSize??134217728:1/0);if(!Number.isSafeInteger(r)||r<=0||r%4||r>o)throw RangeError(`${n} exceeds exact-mass buffer limits`);let c=a&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice?d(s(e,{bucketKey:n,label:n,size:r,usage:i}),e,{bucketKey:n,size:r,usage:i}):e.createBuffer({label:n,size:r,usage:i});return t.add(c),f(c,e),c}function w(e){if(e.destroyed)return;e.destroyed=!0;let t=!e.deviceState.lost&&!e.quarantined;for(let n of e.resources){try{n.mapState===`mapped`&&n.unmap()}catch{}try{i(n,{allowPool:t})}catch{}}e.resources.clear(),e.deviceState.records.delete(e)}async function T(e){if(e.deviceState.lost)return!1;try{let t=e.device.queue.onSubmittedWorkDone();if(!t||typeof t.then!=`function`)throw Error(`Missing queue fence`);return await S(e,Promise.resolve(t).then(()=>!0,()=>(e.quarantined=!0,S(e))))}catch{return e.quarantined=!0,S(e)}}function E(e,t,n,r){let i=x(e),a={device:e,deviceState:i,format:t,rowCount:n,generation:r,buffer:null,resources:new Set,borrows:0,closed:!1,destroyed:!1,quarantined:!1,releasePromise:null};return i.records.add(a),a}function D(e,t){if(!Number.isSafeInteger(y))throw RangeError(`Exact-mass family identity exhausted`);let n=Object.freeze({schema:`peercompute.ulg.exact-mass-family.v1`,familyId:y++,format:e.format,rowCount:e.rowCount,generation:e.generation,provenance:t,scope:`mass-inventory-only`,physicalPublicationAdmitted:!1});return e.family=n,g.set(n,e),n}async function O(e){return!e.closed||e.borrows||e.releasePromise||(e.releasePromise=c(e.device,()=>{w(e)},{onQueueFenceRejected(){e.quarantined=!0}}).then(()=>!0,()=>(e.quarantined=!0,S(e).then(()=>(w(e),!0))))),e.releasePromise}function k({device:n,format:r,massesKg:i,massWords:a,provenance:o}={}){t(r);let s=o&&Object.getOwnPropertyDescriptor(o,`kind`),c=o&&Object.getOwnPropertyDescriptor(o,`reference`),l=a instanceof Uint32Array&&a.buffer instanceof ArrayBuffer&&a.length>0&&a.length%r.wordCount===0;if((a===void 0?!Array.isArray(i)||!i.length:!l||i!==void 0)||s?.value!==`initial-conditions`||typeof c?.value!=`string`||!c.value.trim())throw TypeError(`Explicit mass rows and initial-condition provenance required`);let u=b(l?a.length/r.wordCount:i.length,`inventory row count`,!0),d=l?a.slice():new Uint32Array(u*r.wordCount);for(let t=0;!l&&t<u;t++){let n=Object.getOwnPropertyDescriptor(i,String(t));if(!n||!Object.hasOwn(n,`value`))throw TypeError(`Each initial mass row must be explicit own data`);d.set(e(n.value,r),t*r.wordCount)}let f=Object.freeze({kind:`initial-conditions`,reference:c.value.trim()}),p=E(n,r,u,0);try{return p.buffer=C(n,p.resources,`ulg-exact-mass-initial`,d.byteLength),n.queue.writeBuffer(p.buffer,0,d),D(p,f)}catch(e){throw p.closed=!0,O(p),e}}async function A({device:e,placementRead:n}={}){let{resolveSchroederSpatialReactionPlacementDestinationRead:i,releaseSchroederSpatialReactionPlacementDestinationRead:a}=await import(`./sphMechanicsRefreshGpuKernel-DHTaGVPa.js`).then(e=>e.Ni),o=i(n,{device:e}),{format:s,quantityLayout:c,massBuffer:l,massByteLength:u,sourceInventoryGeneration:d}=o;t(s);let f=b(c?.rowCount,`placement inventory row count`,!0),m=b(b(d,`source inventory generation`)+1,`successor inventory generation`,!0);if(c.currentRowOffset!==0||c.eventRowOffset!==o.particleCount||f!==o.particleCount+o.residualLayout?.eventCapacity||u!==f*s.wordCount*4||p(l)!==e||l.size<u||(l.usage&4)!=4)throw TypeError(`Reaction inventory requires the complete original terminal mass plane`);let h=E(e,s,f,m);try{h.buffer=C(e,h.resources,`ulg-exact-mass-reaction-successor`,u);let t=e.createCommandEncoder({label:`ulg-exact-mass-reaction-successor`});t.copyBufferToBuffer(l,0,h.buffer,0,u);let s=t.finish();i(n,{device:e});let c=D(h,Object.freeze({kind:`reaction-placement`,sourceGeneration:d,carrierRowCount:o.particleCount,residualRowOffset:o.particleCount,residualRowCount:o.residualLayout.eventCapacity}));return a(n,{queueOrderedFinalConsumer:r(e,[s],{finalConsumerOwner:c,producerClaims:[n.queueOrderedCleanupClaim]})}),c}catch(e){throw h.closed=!0,O(h),e}}async function j({device:e,sourceRead:t}={}){let{resolveSchroederResidualMechanicsSourceRead:n}=await import(`./schroederResidualMechanicsSourceGpu-MoCBmesF.js`),{SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:r}=await import(`./sphReactionResidualHistoryGpu-DDt7IFJx.js`),{source:i,carrier:s}=n(t,{device:e}),c=s.read,u=L(c,e),d=b(i.particleCount,`mechanics inventory count`,!0),f=E(e,u.format,d,b(Math.max(c.generation,i.history.generation)+1,`mechanics inventory generation`,!0));try{f.buffer=C(e,f.resources,`ulg-exact-mass-residual-mechanics`,d*r.format.wordCount*4);let s=l(e,{code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> control:array<u32>;
@group(0) @binding(2) var<storage,read_write> mass:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${i.historyCapacity}u || row>=control[4] || control[2]!=0u){return;}
  for(var w=0u;w<${r.format.wordCount}u;w++){
    mass[(${i.phaseLayout?.carrierLineageCount??i.carrierCount}u+row)*${r.format.wordCount}u+w]=
      history[${r.headerWords}u+row*${r.rowWords}u+${r.massOffset}u+w];
  }
}`,entryPoint:`gather`,cacheKey:`ulg-residual-mechanics-mass-v2-${i.carrierCount}-${i.historyCapacity}-${i.phaseLayout?.lineageCount??0}`,bindings:[a(0,`read-only-storage`),a(1,`read-only-storage`),a(2,`storage`)]}),u=o(e,{layout:s.bindGroupLayout,entries:[i.history.buffer,i.controlBuffer,f.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),p=e.createCommandEncoder();if(i.phaseLayout){let{carrierLineageCount:e,carrierLaneCount:t,lineageCount:n}=i.phaseLayout,a=r.format.wordCount*4;for(let r=0;r<t;r++)p.copyBufferToBuffer(c.buffer,c.byteOffset+r*e*a,f.buffer,r*n*a,e*a)}else p.copyBufferToBuffer(c.buffer,c.byteOffset,f.buffer,0,c.byteLength);let m=p.beginComputePass();return m.setPipeline(s.pipeline),m.setBindGroup(0,u),m.dispatchWorkgroups(Math.ceil(i.historyCapacity/64)),m.end(),n(t,{device:e}),e.queue.submit([p.finish()]),D(f,Object.freeze({kind:`residual-mechanics-projection`,carrierRowCount:i.carrierCount,historyCapacity:i.historyCapacity,sourceGeneration:c.generation,historyGeneration:i.history.generation}))}catch(e){throw f.closed=!0,O(f),e}}async function M({device:e,producerRead:n}={}){let{resolveSphSpatialVaporAerosolProducerRead:r,forkSphSpatialVaporAerosolProducerRead:i,releaseSphSpatialVaporAerosolProducerRead:s}=await import(`./sphMechanicsRefreshGpuKernel-DHTaGVPa.js`).then(e=>e.Qn),l=i(n,{device:e}),d=null,f=!1;try{let n=r(l,{device:e}),{format:i,sourceInventoryGeneration:s,endpoints:c}=n;t(i);let m=b(n.particleCount,`exchange inventory row count`,!0),h=b(b(s,`source inventory generation`)+1,`successor inventory generation`,!0),g=c.particleLayout,_=c.particleBuffer,v=m*i.wordCount,y=Math.ceil(v/64);if(g.rowCount!==m||g.recordWords<16+i.wordCount||g.wordLength!==m*g.recordWords||p(_)!==e||_.size!==g.wordLength*4||(_.usage&128)!=128||y>e.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Exchange inventory requires its complete original particle quantity plane`);d=E(e,i,m,h),d.buffer=C(e,d.resources,`ulg-exact-mass-vapor-successor`,v*4);let x=await u(e,{code:`
@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64)
fn gather_vapor_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= arrayLength(&masses)) { return; }
  let row = i / ${i.wordCount}u; let limb = i % ${i.wordCount}u;
  masses[i] = quantities[row * ${g.recordWords}u + 16u + limb];
}`,entryPoint:`gather_vapor_particle_mass`,label:`ulg-exact-mass-vapor-successor`,cacheKey:`ulg-exact-mass-vapor-successor-v1:${i.wordCount}:${g.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>a(t,e))});if(!x.pipeline)throw x.error??Error(`Exact exchange mass gather unavailable`);r(l,{device:e});let S=o(e,{layout:x.bindGroupLayout,entries:[_,d.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),w=e.createCommandEncoder({label:`ulg-exact-mass-vapor-successor`}),T=w.beginComputePass();T.setPipeline(x.pipeline),T.setBindGroup(0,S),T.dispatchWorkgroups(y),T.end();let O=D(d,Object.freeze({kind:`vapor-aerosol-exchange`,sourceGeneration:s,carrierRowCount:m}));return f=!0,e.queue.submit([w.finish()]),O}catch(e){throw d&&(d.closed=!0,O(d)),e}finally{f?c(e,()=>s(l)).catch(()=>{}):s(l)}}function N({device:e,sourceRead:t}={}){let n=_.get(t),r=n?.record;if(!n||n.released||r.device!==e||r.destroyed||r.quarantined||r.deviceState.lost||t.buffer!==r.buffer)throw TypeError(`Ledger mass successor requires an original live source read`);let i=b(t.rowCount,`ledger successor row count`,!0),a=b(b(t.generation,`ledger source generation`)+1,`ledger successor generation`,!0),o=E(e,r.format,i,a);try{o.buffer=C(e,o.resources,`ulg-exact-mass-ledger-phase-successor`,i*r.format.wordCount*4,140,!0);let n=D(o,Object.freeze({kind:`ledger-phase-carrier-transfer`,sourceGeneration:t.generation,carrierRowCount:i})),a=!1;return Object.freeze({family:n,buffer:o.buffer,abandon(){return a?!1:(a=!0,o.closed=!0,O(o),!0)},commit(){if(a)throw TypeError(`Ledger mass successor was already settled`);return a=!0,n}})}catch(e){throw o.closed=!0,O(o),e}}async function P({device:e,result:n,token:r}={}){let{resolveSphPhaseCarrierTransferSourceCapture:i}=await import(`./sphMechanicsRefreshGpuKernel-DHTaGVPa.js`).then(e=>e.qa),s=i(n,r),l=s.retain(),d=null,f=!1;try{let c=s.exactPhase;if(!c||s.inputs.device!==e)throw TypeError(`Phase inventory requires its original exact producer`);let{format:m,quantityBuffer:h,quantityLayout:g,sourceInventoryGeneration:_}=c;t(m);let v=b(c.particleCount,`phase inventory row count`,!0),y=b(b(_,`phase source generation`)+1,`phase successor generation`,!0),x=v*m.wordCount;if(g.rowCount!==v||g.massOffsetWords!==16||g.wordLength!==v*g.recordWords||p(h)!==e||h.size!==g.wordLength*4||(h.usage&128)!=128||Math.ceil(x/64)>e.limits.maxComputeWorkgroupsPerDimension)throw TypeError(`Phase inventory requires its complete original committed quantity plane`);d=E(e,m,v,y),d.buffer=C(e,d.resources,`ulg-exact-mass-phase-successor`,x*4);let S=await u(e,{code:`@group(0) @binding(0) var<storage, read> quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> masses: array<u32>;
@compute @workgroup_size(64) fn gather_phase_particle_mass(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&masses)){masses[i]=quantities[(i/${m.wordCount}u)*${g.recordWords}u+16u+i%${m.wordCount}u];}}`,entryPoint:`gather_phase_particle_mass`,cacheKey:`ulg-exact-mass-phase-successor-v1:${m.wordCount}:${g.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>a(t,e))});if(!S.pipeline)throw S.error??Error(`Exact phase mass gather unavailable`);i(n,r),l.validate();let w=o(e,{layout:S.bindGroupLayout,entries:[h,d.buffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),T=e.createCommandEncoder(),O=T.beginComputePass();O.setPipeline(S.pipeline),O.setBindGroup(0,w),O.dispatchWorkgroups(Math.ceil(x/64)),O.end();let k=D(d,Object.freeze({kind:`phase-carrier-transfer`,sourceGeneration:_,carrierRowCount:v}));return f=!0,e.queue.submit([T.finish()]),k}catch(e){throw d&&(d.closed=!0,O(d)),e}finally{f?c(e,()=>l.release()).catch(()=>{}):l.release()}}function F({family:e,device:t,format:n=e?.format,expectedGeneration:r=e?.generation}={}){let i=g.get(e);if(!i||i.device!==t||i.format!==n||i.generation!==r||i.closed||i.destroyed||i.quarantined||i.deviceState.lost)throw TypeError(`Exact mass requires the live original family, format, device and generation`);return I(i)}function I(e,t=0,n=e.rowCount){let r=t*e.format.wordCount*4,i=n*e.format.wordCount*4,a=Object.freeze({family:e.family,device:e.device,format:e.format,buffer:e.buffer,rowOffset:t,rowCount:n,byteOffset:r,byteLength:i,generation:e.generation});return _.set(a,{record:e,rowOffset:t,rowCount:n,released:!1}),e.borrows++,a}function L(e,t){let n=_.get(e),r=n?.record;if(!n||n.released||r.device!==t||r.destroyed||r.quarantined||r.deviceState.lost||e.buffer!==r.buffer||e.format!==r.format||e.rowOffset!==n.rowOffset||e.rowCount!==n.rowCount)throw TypeError(`Exact mass requires an original live retained read`);return r}function R(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}={}){try{let s=L(e,t);return s.family===n&&s.format===r&&s.generation===i&&(a===void 0||Object.is(e.rowOffset,a))&&(o===void 0||Object.is(e.rowCount,o))}catch{return!1}}function z(e,{device:t,family:n=e?.family,format:r=e?.format,expectedGeneration:i=e?.generation,rowOffset:a=e?.rowOffset,rowCount:o=e?.rowCount}={}){if(!R(e,{device:t,family:n,format:r,expectedGeneration:i,rowOffset:a,rowCount:o}))throw TypeError(`Exact mass read fork requires its original live retained read`);return I(L(e,t),e.rowOffset,e.rowCount)}function B(e,{device:t,rowOffset:n,rowCount:r}={}){let i=L(e,t);if(b(n,`relative inventory row offset`),b(r,`inventory window row count`,!0),n+r>e.rowCount)throw RangeError(`Exact mass window cannot extend outside its retained source range`);return I(i,e.rowOffset+n,r)}function V(e,{deferInBurst:t=!1,confirmed:n=!1}={}){let r=_.get(e);if(!r)throw TypeError(`Exact mass retirement requires the original read`);if(r.released)return r.releasePromise;r.released=!0;let i=()=>(r.record.borrows--,r.record.closed&&!r.record.borrows&&!r.record.releasePromise&&(r.record.releasePromise=Promise.resolve(!0),w(r.record)),!0);return n===!0?(r.releasePromise=Promise.resolve(i()),r.releasePromise):t===!0?(r.releasePromise=c(r.record.device,()=>{i()},{onQueueFenceRejected(){r.record.quarantined=!0}}).then(()=>!0,()=>(r.record.quarantined=!0,S(r.record).then(i))),r.releasePromise):(r.releasePromise=T(r.record).then(i),r.releasePromise)}function H(e){let t=g.get(e);if(!t)throw TypeError(`Exact mass retirement requires the original family`);t.closed=!0,O(t)}function U({device:e,sourceRead:t,edgeBuffer:n,edgeCount:r,edgeFormat:i}={}){return q({device:e,sourceReads:[t],edgeBuffer:n,edgeCount:r,edgeFormat:i})}function W({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return q({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0})}function G({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i=null,edgeCount:a=0,edgeFormat:o}={}){return q({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:a,edgeFormat:o,partition:!0,allocation:!0})}async function K(e,t){let n=[],r=[],i=new Map;try{let a=Object.getOwnPropertyDescriptor(t??{},`length`)?.value;if(!Array.isArray(t)||!Number.isSafeInteger(a)||a<1)throw TypeError(`Exact inventory sources require a nonempty array of original reads`);for(let o=0;o<a;o++){let a=Object.getOwnPropertyDescriptor(t,String(o));if(!a||!Object.hasOwn(a,`value`))throw TypeError(`Exact inventory sources require explicit own data reads`);let s=a.value,c=L(s,e),l=i.get(c)??[];if(l.some(e=>s.rowOffset<e.rowOffset+e.rowCount&&e.rowOffset<s.rowOffset+s.rowCount))throw TypeError(`Exact inventory sources cannot repeat or overlap rows from a numeric owner`);l.push(s),i.set(c,l),r.push(c),n.push(I(c,s.rowOffset,s.rowCount))}return{held:n,records:r}}catch(e){throw await Promise.all(n.map(e=>V(e))),e}}async function q({device:e,sourceReads:t,outputRowCount:n,destinationBuffer:r,edgeBuffer:i,edgeCount:s,edgeFormat:c,partition:u=!1,allocation:d=!1}){let{held:f,records:m}=await K(e,t),g=m[0],_=g.format,v=null,y=null,x=null,O=!1;try{if(c!==_||m.some(e=>e.format!==_))throw TypeError(`Proposal and sources require the same original exact-mass format`);let t=b(f.reduce((e,t)=>e+t.rowCount,0),`joined source row count`,!0),k=u?b(n,`output row count`,!0):t,A=m.reduce((e,t)=>Math.max(e,t.generation),0),j=b(A+1,`candidate generation`,!0);b(s,`edge count`,!u);let M=s*(_.wordCount*(d?3:1)+2)*4;if(s>0&&(!i||p(i)!==e||i.destroyed||i.size!==M||!(i.usage&4)))throw TypeError(`Exact mass graph requires the complete same-device COPY_SRC proposal buffer`);if(s===0&&i!=null)throw TypeError(`Empty exact graph must omit its proposal buffer`);if(u&&(!r||p(r)!==e||r.destroyed||r.size!==t*4||!(r.usage&4)))throw TypeError(`Exact row mapping requires the complete same-device COPY_SRC destination buffer`);let N=Math.ceil(k/64);if(N>(e.limits?.maxComputeWorkgroupsPerDimension??65535))throw RangeError(`Exact mass gather exceeds device dispatch limit`);v=E(e,_,k,j),y=E(e,_,0,0),v.buffer=C(e,v.resources,`ulg-exact-mass-candidate`,k*_.wordCount*4);let P=C(e,y.resources,`ulg-exact-mass-params`,u?32:16,72),F=C(e,y.resources,`ulg-exact-mass-edges`,Math.max(4,M)),I=u||f[0].rowOffset!==0||f[0].rowCount!==g.rowCount,R=I?C(e,y.resources,`ulg-exact-mass-joined-source`,t*_.wordCount*4):g.buffer,z=u?C(e,y.resources,`ulg-exact-mass-destinations`,t*4):null,B=C(e,y.resources,`ulg-exact-mass-control`,64),V=C(e,y.resources,`ulg-exact-mass-verdict`,64,9),H=d?3:u?2:1,U=h(_,{partition:u,allocation:d}),W=[`uniform`,`read-only-storage`,`read-only-storage`,`storage`,`storage`];u&&W.push(`read-only-storage`);let G=[`exact_mass_gather`,`exact_mass_validate`,`exact_mass_finalize`].map(t=>{let n=l(e,{cacheKey:`ulg-${t}.v${H}.${_.wordCount}.${_.quantumExponent}`,label:t,entryPoint:t,code:U,bindings:W.map((e,t)=>a(t,e))}),r=[P,R,F,v.buffer,B];return u&&r.push(z),{info:n,group:o(e,{layout:n.bindGroupLayout,entries:r.map((e,t)=>({binding:t,resource:{buffer:e}}))})}});for(let t of f)L(t,e);let K=[k,s,A,j];u&&K.push(t,m.length,+!!d,0),e.queue.writeBuffer(P,0,new Uint32Array(K));let q=e.createCommandEncoder();if(I){let e=0;for(let t of f)q.copyBufferToBuffer(t.buffer,t.byteOffset,R,e,t.byteLength),e+=t.byteLength}u&&q.copyBufferToBuffer(r,0,z,0,t*4),s?q.copyBufferToBuffer(i,0,F,0,M):q.clearBuffer(F),q.clearBuffer(B);for(let[e,{info:t,group:n}]of G.entries()){let r=q.beginComputePass();r.setPipeline(t.pipeline),r.setBindGroup(0,n),r.dispatchWorkgroups(e===2?1:N),r.end()}q.copyBufferToBuffer(B,0,V,0,64),e.queue.submit([q.finish()]);let J=T(y);if(!await S(y,Promise.resolve(V.mapAsync(1)).then(()=>!0)))throw Error(`Exact mass device lost during verdict observation`);x=V;let Y=new Uint32Array(V.getMappedRange()).slice();if(V.unmap(),x=null,!await J)throw Error(`Exact mass device lost before confirmed retirement`);O=!0;for(let t of f)L(t,e);if(Y[0]!==1162695729||Y[1]!==H||![1,2].includes(Y[2])||Y[4]!==k||Y[5]!==s||Y[6]!==k||Y[7]!==j||Y[8]!==A||u&&(Y[9]!==t||Y[10]!==m.length)||Y.slice(u?11:9).some(Boolean)||Y[2]===1!=(Y[3]===0))throw Error(`Malformed exact-mass transfer verdict`);let X=Object.freeze({ready:Y[2]===1,errorBits:Y[3],rowCount:k,edgeCount:s,sourceGeneration:A,generation:j,...u?{sourceRowCount:t,sourceCount:m.length}:{},observedBytes:64,scope:`mass-only`,physicalPublicationAdmitted:!1,...d?{packetSelection:`cumulative-integer-ratio`}:{}}),Z=Object.freeze(u?{kind:d?`mass-allocation-candidate`:`mass-partition-transfer-candidate`,sources:Object.freeze(f.map(e=>Object.freeze({familyId:e.family.familyId,generation:e.generation,rowOffset:e.rowOffset,rowCount:e.rowCount})))}:{kind:`mass-transfer-candidate`,sourceFamilyId:g.family.familyId,sourceGeneration:A,sourceRowOffset:f[0].rowOffset,sourceRowCount:f[0].rowCount}),Q=X.ready?D(v,Z):null;return Q||w(v),Object.freeze({...X,family:Q})}catch(e){if(x)try{x.unmap()}catch{}throw y&&await T(y),v&&w(v),e}finally{let t=O&&typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice;if(y&&(t||await T(y),w(y)),await Promise.all(f.map(e=>V(e,{confirmed:t}))),v?.family&&(v.destroyed||v.deviceState.lost||v.quarantined))throw Error(`Exact mass device lost before candidate delivery`)}}export{M as a,z as c,G as d,W as f,R as h,j as i,H as l,B as m,P as n,k as o,U as p,A as r,N as s,F as t,V as u};