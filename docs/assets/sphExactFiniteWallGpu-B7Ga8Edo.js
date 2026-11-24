import{t as e}from"./sphExactMassWgsl-quqzAZyn.js";import{h as t,n,o as r,s as i}from"./sphExactThermalEnergyWgsl-7q9ex9fJ.js";import{S as a,c as o,l as s,n as c,u as l,x as u}from"./webgpuComputeLayout-tWh43k53.js";import{i as d}from"./sphGpuDeviceIdentity-CsdIpAMj.js";const f=new WeakMap,p=new WeakMap,m=n.wordCount,h=`${e(n)}\n${t(n)}`,g=1180127793;function _(e,t){let n=f.get(e);if(!n||n.device!==t||n.destroyed)throw TypeError(`Finite wall closure requires its genuine retained thermal successor`);return n.read.validate(),!0}function v(e,t){let n=p.get(t);if(!n||n.device!==e||!n.privateLive||n.wallRetired||n.borrows)throw TypeError(`Private finite wall requires its available original owner`);n.read.validate(),n.borrows++;let r=!0;return Object.freeze({buffer:t.buffer,instanceId:t.instanceId,validate(){if(!r||n.wallRetired)throw TypeError(`Private finite wall read was retired`);return n.read.validate()},release(){return r?(r=!1,n.borrows--,n.retireWall(),!0):!1}})}function y({device:e,state:t,particleCount:n}){if(!Number.isSafeInteger(n)||n<1||e.limits.maxStorageBuffersPerShaderStage<13)throw TypeError(`Canonical finite walls require positive rows and 13 storage bindings`);let y=p.has(t)?v(e,t):i(e,t),b=[],x=[],S={device:e,read:y,destroyed:!1,transferred:!1,privateLive:!1,borrows:0,wallBuffer:null,wallRetired:!1,retireWall(){!this.destroyed||this.wallRetired||this.privateLive||this.borrows||(this.wallRetired=!0,this.wallBuffer?.destroy(),y.release())}},C=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,w=(t,n,r,i=!1)=>{if(n>e.limits.maxBufferSize||r&128&&n>e.limits.maxStorageBufferBindingSize)throw RangeError(`Canonical finite wall workspace exceeds device buffer limits`);let o=d(C?u(c(e,{bucketKey:t,label:t,size:n,usage:r}),e,{bucketKey:t,size:n,usage:r}):e.createBuffer({label:t,size:n,usage:r}),e);if(i){let e=Object.prototype.hasOwnProperty.call(o,`destroy`),t=e?o.destroy:null,n=o.destroy.bind(o);o.destroy=()=>{if(!S.destroyed||o===S.wallBuffer&&!S.wallRetired)throw TypeError(`Finite wall successor is retained by its thermal producer or private owner`);e?o.destroy=t:delete o.destroy,C?a(o):n()}}return(i?x:b).push(o),o},T=()=>{for(let e of b.splice(0))a(e)},E=()=>{if(S.destroyed)return!1;S.destroyed=!0,T();for(let e of x.splice(0))e!==S.wallBuffer&&e.destroy();return S.retireWall(),!0},D=(t,n,r,i,a,c=1)=>{let u=l(e,{cacheKey:t,label:t,code:n,entryPoint:`main`,bindings:i.map((e,t)=>o(t,e))}),d=s(e,{label:`${t}-bind-group`,layout:u.bindGroupLayout,entries:r.map((e,t)=>({binding:t,resource:{buffer:e}}))});return e=>{let n=e.beginComputePass({label:t});n.setPipeline(u.pipeline),n.setBindGroup(0,d),n.dispatchWorkgroups(a,c),n.end()}};try{let t=w(`ulg-exact-finite-wall-candidate`,512,140,!0);S.wallBuffer=t;let i=w(`ulg-exact-finite-wall-packets`,n*6*m*4,136),a=w(`ulg-exact-finite-wall-receipt`,32,140,!0);e.queue.writeBuffer(a,0,new Uint32Array([g,1,0,n,0,0,0,0]));let o=i,s=n,c=[];do{let t=Math.ceil(s/64);if(t>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Finite wall reduction exceeds dispatch capacity`);let n=w(`ulg-exact-finite-wall-reduction`,t*6*m*4,132,t===1),r=w(`ulg-exact-finite-wall-reduction-params`,16,72);e.queue.writeBuffer(r,0,new Uint32Array([s,0,0,0])),c.push(D(`ulg-exact-finite-wall-reduce-v1`,`${h}
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
}`,[o,n,a,r],[`read-only-storage`,`storage`,`storage`,`uniform`],t,6)),o=n,s=t}while(s>1);let l=o,u=D(`ulg-exact-finite-wall-update-v1`,`${h}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> delta:array<u32>;
@group(0) @binding(2) var<storage,read_write> wall:array<u32>;
@group(0) @binding(3) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>) {
  let face=id.x;var errors=0u;
  if(source[24]!=0x46574c31u || (source[25]!=3u && source[25]!=4u)
    || source[118]!=${r}u || source[119]!=1u) {errors|=1u;}
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
}`,[y.buffer,l,t,a],[`read-only-storage`,`read-only-storage`,`storage`,`storage`],6),d=Object.freeze({device:e,instanceId:y.instanceId,originalBuffer:y.buffer,buffer:t,deltaBuffer:l,validationBuffer:a,particleCount:n});return f.set(d,S),Object.freeze({record:d,packets:i,encodedDispatchCount:c.length+1,transfer(){if(_(d,e),S.transferred)throw TypeError(`Finite wall successor was already adopted`);S.transferred=!0,S.privateLive=!0;let n=Object.freeze({instanceId:y.instanceId,buffer:t,encodeTemperatureCopy(e,n,r,i=6,a=0){if(!S.privateLive||S.wallRetired)throw TypeError(`Private finite wall owner was retired`);y.validate(),e.copyBufferToBuffer(t,a*4,n,r,i*4)}});return p.set(n,S),Object.freeze({state:n,destroy(){return S.privateLive?(S.privateLive=!1,S.retireWall(),!0):!1}})},encodeBefore(n){_(d,e),n.copyBufferToBuffer(y.buffer,0,t,0,t.size),n.clearBuffer(i)},encodeAfter(e){for(let t of c)t(e);u(e)},cleanupTransient:T,destroy:E})}catch(e){throw E(),e}}function b(){return`${h}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> wall:array<u32>;
@group(0) @binding(2) var<storage,read> delta:array<u32>;
@group(0) @binding(3) var<storage,read> receipt:array<u32>;
@group(0) @binding(4) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let face=id.x;var errors=receipt[2];
  if(receipt[0]!=${g}u || receipt[1]!=1u || receipt[4]!=1u
    || wall[24]!=source[24] || wall[25]!=4u || wall[26]!=source[26]+1u
    || wall[118]!=${r}u || wall[119]!=1u || wall[126]!=0u
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