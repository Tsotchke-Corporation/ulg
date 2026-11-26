import{tf as e}from"./molecularDynamicsWebGpu-nQ3fG2CZ.js";import{acquireQueueOrderedPooledBuffer as t,computeBufferBinding as n,createCachedExplicitBindGroup as r,createCachedExplicitComputePipeline as i,registerQueueOrderedPooledBufferReturn as a,releaseOrDestroyQueueOrderedPooledBuffer as o}from"../runtime/webgpuComputeLayout.js";import{i as s}from"./sphGpuDeviceIdentity-CxQWvfZe.js";function c({device:c,publication:l,particleCount:u,sourceStateBuffer:d,sourceMechanicsBuffer:f,sourceQuantities:p=null}){let m=typeof globalThis.GPUDevice==`function`&&c instanceof globalThis.GPUDevice,h=[],g=(e,n,r=140,i=!1)=>{if(!Number.isSafeInteger(n)||n<4||n>c.limits.maxStorageBufferBindingSize)throw RangeError(`Chain G2P gather exceeds device storage capacity`);let o=s(m&&i?a(t(c,{bucketKey:e,label:e,size:n,usage:r}),c,{bucketKey:e,size:n,usage:r}):c.createBuffer({label:e,size:n,usage:r}),c);return h.push(o),o},_=u,v=l.updates.length;if(!Number.isSafeInteger(_)||_<1||Math.ceil(_/64)>c.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain G2P requires a bounded physical particle capacity`);try{let t=g(`ulg-chain-g2p-state`,_*32,140,!0),a=g(`ulg-chain-g2p-mechanics`,_*128,140,!0),s=g(`ulg-chain-g2p-selected-counts`,_*4,140,!0),u=g(`ulg-chain-g2p-control`,128,140,!0),m=g(`ulg-chain-g2p-exact-validation`,16,140,!0),y=p?g(`ulg-chain-g2p-quantities`,p.quantityBuffer.size):null,b=p?g(`ulg-chain-g2p-projections`,_*48,140,!0):null,x=l.updates.map((e,t)=>{let n=g(`ulg-chain-g2p-params`,32,72,!0);return c.queue.writeBuffer(n,0,new Uint32Array([_,t,v,e.mechanicsFieldMutationOutputOrdinal,l.execution.completionOrdinal,0,0,0])),n}),S=(e,t,a,o,s=1)=>{let l=o.map(e=>e.type??`storage`),u=i(c,{code:t,entryPoint:a,cacheKey:`chain-g2p-v1-${a}-${p?.quantityLayout.recordWords??0}`,bindings:l.map((e,t)=>n(t,e))}),d=r(c,{layout:u.bindGroupLayout,entries:o.map((e,t)=>({binding:t,resource:{buffer:e.buffer??e}}))}),f=e.beginComputePass();f.setPipeline(u.pipeline),f.setBindGroup(0,d),f.dispatchWorkgroups(s),f.end()},C=e=>({buffer:e,type:`read-only-storage`}),w=`
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read> input_s:array<u32>;
@group(0) @binding(2) var<storage,read> input_m:array<u32>;
@group(0) @binding(3) var<storage,read_write> output_s:array<u32>;
@group(0) @binding(4) var<storage,read_write> output_m:array<u32>;
@group(0) @binding(5) var<storage,read_write> selected:array<atomic<u32>>;
@group(0) @binding(6) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params:vec4<u32>;
fn fail(bit:u32) { atomicOr(&control[2],bit); }
@compute @workgroup_size(1) fn admit_level() {
  let r=field[30]-36u;
  if(field[0]!=${e}u || field[1]!=5u || field[2]!=3u || field[16]!=params.x
    || field[24]!=64u || field[25]!=32u || field[59]!=2u || field[63]!=params.w
    || field[r]!=0x53465233u || field[r+1]!=3u || field[r+2]!=3u || field[r+3]!=6u
    || field[r+5]!=params.w || field[r+32]!=field[r+33] || field[r+32]!=field[r+34]) { fail(2u); }
  for(var w=3u;w<=15u;w++) { if(field[w]!=atomicLoad(&control[w])) { fail(4u); } }
  if(atomicLoad(&control[16])!=params.y) { fail(8u); }
  atomicAdd(&control[16],1u);
}
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=params.x || atomicLoad(&control[2])!=0u) {return;}
  if(field[field[24]+row*32u+3u]!=1u) {return;}
  if(atomicAdd(&selected[row],1u)!=0u) {fail(16u);return;}
  for(var w=0u;w<8u;w++) {output_s[row*8u+w]=input_s[row*8u+w];}
  for(var w=0u;w<32u;w++) {output_m[row*32u+w]=input_m[row*32u+w];}
}
@compute @workgroup_size(64) fn check_coverage(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=params.x) {return;}
  let expected=select(0u,1u,bitcast<f32>(input_s[row*8u+3u])>0.0);
  if(atomicLoad(&selected[row])!=expected) {fail(32u);}
}
@compute @workgroup_size(64) fn finalize(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=params.x) {return;}
  if(atomicLoad(&control[2])!=0u || atomicLoad(&selected[row])==0u) {
    for(var w=0u;w<8u;w++) {output_s[row*8u+w]=input_s[row*8u+w];}
    for(var w=0u;w<32u;w++) {output_m[row*32u+w]=input_m[row*32u+w];}
  }
  if(row==0u) {atomicStore(&control[0],0x53475031u);atomicStore(&control[1],select(3u,5u,atomicLoad(&control[2])!=0u));}
}`,T=(e,n,r,i)=>[C(e),C(n),C(r),t,a,s,u,{buffer:x[i],type:`uniform`}];return{stateBuffer:t,mechanicsBuffer:a,controlBuffer:u,validationBuffer:m,quantityBuffer:y,projectionBuffer:b,destroy(){for(let e of h)o(e)},encode(e,t){e.clearBuffer(s),e.clearBuffer(u),e.clearBuffer(m),e.copyBufferToBuffer(l.controlBuffer,12,u,12,52),S(e,`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<u32>;
@group(0) @binding(2) var<uniform> expected:array<vec4<u32>,2>;
@compute @workgroup_size(1) fn source_gate() {
  if(source[0]!=0x53435331u || source[1]!=1u || source[2]!=3u || source[16]!=expected[0].z
    || source[17]!=expected[1].x || source[18]!=0u
    || source[19]!=expected[0].z || source[20]!=3u) {control[2]|=1u;}
}`,`source_gate`,[C(l.controlBuffer),u,{buffer:x[0],type:`uniform`}]);for(let[n,r]of t.entries()){let t=l.updates[n].mechanicsFieldViewBuffer,i=T(t,r.stateBuffer,r.mechanicsBuffer,n);if(S(e,w,`admit_level`,i),S(e,w,`gather`,i,Math.ceil(_/64)),p){let n=p.quantityLayout.recordWords,i=`
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read> q:array<u32>;
@group(0) @binding(2) var<storage,read> p:array<u32>;
@group(0) @binding(3) var<storage,read> validation:array<u32>;
@group(0) @binding(4) var<storage,read_write> out_q:array<u32>;
@group(0) @binding(5) var<storage,read_write> out_p:array<u32>;
@group(0) @binding(6) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(64) fn quantities(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=field[16]) {return;}
  if(validation[0]!=0u) {atomicOr(&control[2],64u);}
  if(field[field[24]+row*32u+3u]!=1u) {return;}
  for(var w=0u;w<${n}u;w++) {out_q[row*${n}u+w]=q[row*${n}u+w];}
  for(var w=0u;w<12u;w++) {out_p[row*12u+w]=p[row*12u+w];}
}`,a=r.quantities;S(e,i,`quantities`,[C(t),C(a.quantityBuffer),C(a.projectionBuffer),C(a.validationBuffer),y,b,u],Math.ceil(_/64))}}let n=T(l.updates[0].mechanicsFieldViewBuffer,d,f,0);if(S(e,w,`check_coverage`,n,Math.ceil(_/64)),S(e,w,`finalize`,n,Math.ceil(_/64)),p){let t=p.quantityLayout.recordWords;S(e,`
@group(0) @binding(0) var<storage,read> control:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read> selected:array<u32>;
@group(0) @binding(3) var<storage,read_write> q:array<u32>;
@group(0) @binding(4) var<storage,read_write> p:array<u32>;
@group(0) @binding(5) var<storage,read_write> validation:array<u32>;
@compute @workgroup_size(64) fn finalize_quantities(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=arrayLength(&selected)) {return;}
  if(control[2]!=0u || selected[row]==0u) {
    for(var w=0u;w<${t}u;w++) {q[row*${t}u+w]=original[row*${t}u+w];}
    for(var w=0u;w<12u;w++) {p[row*12u+w]=0u;}
  }
  if(row==0u) {validation[0]=control[2];}
}`,`finalize_quantities`,[C(u),C(p.quantityBuffer),C(s),y,b,m],Math.ceil(_/64))}}}}catch(e){for(let e of h)o(e);throw e}}export{c as prepareSchroederSpatialChainG2pGather};