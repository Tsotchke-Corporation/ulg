import{S as e,c as t,l as n,n as r,u as i,x as a}from"./webgpuComputeLayout-tWh43k53.js";import{t as o}from"./sphExactMassWgsl-quqzAZyn.js";import{h as s,n as c,o as l,s as u}from"./sphExactThermalEnergyWgsl-K1BIaB5N.js";import{i as d}from"./sphGpuDeviceIdentity-CsdIpAMj.js";const f=new WeakMap,p=new WeakMap,m=c.wordCount,h=`${o(c)}\n${s(c)}`,g=1180127793;function _(e,t){let n=f.get(e);if(!n||n.device!==t||n.destroyed)throw TypeError(`Finite wall closure requires its genuine retained thermal successor`);return n.read.validate(),!0}function v(e,t){let n=p.get(t);if(!n||n.device!==e||!n.privateLive||n.wallRetired||n.borrows)throw TypeError(`Private finite wall requires its available original owner`);n.read.validate(),n.borrows++;let r=!0;return Object.freeze({buffer:t.buffer,instanceId:t.instanceId,validate(){if(!r||n.wallRetired)throw TypeError(`Private finite wall read was retired`);return n.read.validate()},release(){return r?(r=!1,n.borrows--,n.retireWall(),!0):!1}})}function y({device:o,state:s,particleCount:c}){if(!Number.isSafeInteger(c)||c<1||o.limits.maxStorageBuffersPerShaderStage<13)throw TypeError(`Canonical finite walls require positive rows and 13 storage bindings`);let y=p.has(s)?v(o,s):u(o,s),b=[],x=[],S={device:o,read:y,destroyed:!1,transferred:!1,privateLive:!1,borrows:0,wallBuffer:null,wallRetired:!1,retireWall(){!this.destroyed||this.wallRetired||this.privateLive||this.borrows||(this.wallRetired=!0,this.wallBuffer?.destroy(),y.release())}},C=typeof globalThis.GPUDevice==`function`&&o instanceof globalThis.GPUDevice,w=(t,n,i,s=!1)=>{if(n>o.limits.maxBufferSize||i&128&&n>o.limits.maxStorageBufferBindingSize)throw RangeError(`Canonical finite wall workspace exceeds device buffer limits`);let c=d(C?a(r(o,{bucketKey:t,label:t,size:n,usage:i}),o,{bucketKey:t,size:n,usage:i}):o.createBuffer({label:t,size:n,usage:i}),o);if(s){let t=Object.prototype.hasOwnProperty.call(c,`destroy`),n=t?c.destroy:null,r=c.destroy.bind(c);c.destroy=()=>{if(!S.destroyed||c===S.wallBuffer&&!S.wallRetired)throw TypeError(`Finite wall successor is retained by its thermal producer or private owner`);t?c.destroy=n:delete c.destroy,C?e(c):r()}}return(s?x:b).push(c),c},T=()=>{for(let t of b.splice(0))e(t)},E=()=>{if(S.destroyed)return!1;S.destroyed=!0,T();for(let e of x.splice(0))e!==S.wallBuffer&&e.destroy();return S.retireWall(),!0},D=(e,r,a,s,c,l=1)=>{let u=i(o,{cacheKey:e,label:e,code:r,entryPoint:`main`,bindings:s.map((e,n)=>t(n,e))}),d=n(o,{label:`${e}-bind-group`,layout:u.bindGroupLayout,entries:a.map((e,t)=>({binding:t,resource:{buffer:e}}))});return t=>{let n=t.beginComputePass({label:e});n.setPipeline(u.pipeline),n.setBindGroup(0,d),n.dispatchWorkgroups(c,l),n.end()}};try{let e=w(`ulg-exact-finite-wall-candidate`,512,140,!0);S.wallBuffer=e;let t=w(`ulg-exact-finite-wall-packets`,c*6*m*4,136),n=w(`ulg-exact-finite-wall-receipt`,32,140,!0);o.queue.writeBuffer(n,0,new Uint32Array([g,1,0,c,0,0,0,0]));let r=t,i=c,a=[];do{let e=Math.ceil(i/64);if(e>o.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Finite wall reduction exceeds dispatch capacity`);let t=w(`ulg-exact-finite-wall-reduction`,e*6*m*4,132,e===1),s=w(`ulg-exact-finite-wall-reduction-params`,16,72);o.queue.writeBuffer(s,0,new Uint32Array([i,0,0,0])),a.push(D(`ulg-exact-finite-wall-reduce-v1`,`${h}
@group(0) @binding(0) var<storage,read> input:array<u32>;
@group(0) @binding(1) var<storage,read_write> output:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<atomic<u32>>;
@group(0) @binding(3) var<uniform> counts:vec4<u32>;
var<workgroup> sums:array<ExactMass,64>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>) {
  var value=ExactMass();
  if(id.x<counts.x) {for(var w=0u;w<EM_WORDS;w++) {value.words[w]=input[(id.x*6u+id.y)*EM_WORDS+w];}}
  sums[lane]=value;workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u) {
    if(lane<stride) {let s=el_add(sums[lane],sums[lane+stride]);sums[lane]=s.value;
      if(s.error!=0u) {atomicOr(&receipt[2],2u);}}
    workgroupBarrier();
  }
  if(lane==0u) {for(var w=0u;w<EM_WORDS;w++) {output[(group.x*6u+group.y)*EM_WORDS+w]=sums[0].words[w];}}
}`,[r,t,n,s],[`read-only-storage`,`storage`,`storage`,`uniform`],e,6)),r=t,i=e}while(i>1);let s=r,u=D(`ulg-exact-finite-wall-update-v1`,`${h}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> delta:array<u32>;
@group(0) @binding(2) var<storage,read_write> wall:array<u32>;
@group(0) @binding(3) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>) {
  let face=id.x;var errors=0u;
  if(source[24]!=0x46574c31u || (source[25]!=3u && source[25]!=4u)
    || source[118]!=${l}u || source[119]!=1u) {errors|=1u;}
  if(source[126]!=0u || source[12u+face]!=0u) {errors|=8u;}
  var energy=ExactMass();var packet=ExactMass();
  for(var w=0u;w<EM_WORDS;w++) {energy.words[w]=source[64u+face*EM_WORDS+w];packet.words[w]=delta[face*EM_WORDS+w];}
  let next=el_add(energy,packet);let view=el_project_f32_bits(next.value);
  if((next.error|view.error)!=0u) {errors|=2u;}
  let capacity=bitcast<f32>(source[6u+face]);let initial=bitcast<f32>(source[32u+face]);
  let total=bitcast<f32>(view.bits);let temperature=initial+total/capacity;
  if(!(capacity>0.0) || capacity>3.402823e38 || !(initial>=0.0) || initial>3.402823e38
    || !(temperature>=0.0) || temperature>3.402823e38 || source[26]==0xffffffffu) {errors|=4u;}
  atomicOr(&receipt[2],errors);
  if(errors==0u) {
    for(var w=0u;w<EM_WORDS;w++) {wall[64u+face*EM_WORDS+w]=next.value.words[w];}
    wall[face]=bitcast<u32>(temperature);wall[18u+face]=view.bits;
  }
  if(face==0u) {wall[25]=4u;wall[26]=source[26]+1u;atomicStore(&receipt[4],1u);}
}`,[y.buffer,s,e,n],[`read-only-storage`,`read-only-storage`,`storage`,`storage`],6),d=Object.freeze({device:o,instanceId:y.instanceId,originalBuffer:y.buffer,buffer:e,deltaBuffer:s,validationBuffer:n,particleCount:c});return f.set(d,S),Object.freeze({record:d,packets:t,encodedDispatchCount:a.length+1,transfer(){if(_(d,o),S.transferred)throw TypeError(`Finite wall successor was already adopted`);S.transferred=!0,S.privateLive=!0;let t=Object.freeze({instanceId:y.instanceId,buffer:e,encodeTemperatureCopy(t,n,r,i=6,a=0){if(!S.privateLive||S.wallRetired)throw TypeError(`Private finite wall owner was retired`);y.validate(),t.copyBufferToBuffer(e,a*4,n,r,i*4)}});return p.set(t,S),Object.freeze({state:t,destroy(){return S.privateLive?(S.privateLive=!1,S.retireWall(),!0):!1}})},encodeBefore(n){_(d,o),n.copyBufferToBuffer(y.buffer,0,e,0,e.size),n.clearBuffer(t)},encodeAfter(e){for(let t of a)t(e);u(e)},cleanupTransient:T,destroy:E})}catch(e){throw E(),e}}function b(){return`${h}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> wall:array<u32>;
@group(0) @binding(2) var<storage,read> delta:array<u32>;
@group(0) @binding(3) var<storage,read> receipt:array<u32>;
@group(0) @binding(4) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let face=id.x;var errors=receipt[2];
  if(receipt[0]!=${g}u || receipt[1]!=1u || receipt[4]!=1u
    || wall[24]!=source[24] || wall[25]!=4u || wall[26]!=source[26]+1u
    || wall[118]!=${l}u || wall[119]!=1u || wall[126]!=0u
    || wall[6u+face]!=source[6u+face] || wall[32u+face]!=source[32u+face] || wall[12u+face]!=0u) {errors|=16u;}
  var before=ExactMass();var after=ExactMass();var packet=ExactMass();
  for(var w=0u;w<EM_WORDS;w++) {before.words[w]=source[64u+face*EM_WORDS+w];
    after.words[w]=wall[64u+face*EM_WORDS+w];packet.words[w]=delta[face*EM_WORDS+w];}
  let expected=el_add(before,packet);let view=el_project_f32_bits(after);
  let temperature=bitcast<f32>(source[32u+face])+bitcast<f32>(view.bits)/bitcast<f32>(source[6u+face]);
  if((expected.error|view.error)!=0u || el_compare(expected.value,after)!=0
    || wall[face]!=bitcast<u32>(temperature) || wall[18u+face]!=view.bits) {errors|=32u;}
  if(errors!=0u) {atomicOr(&control[2],32768u);}
}`}export{b as n,_ as r,y as t};