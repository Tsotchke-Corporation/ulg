import{O as e,c as t,g as n,h as r,k as i,m as a}from"./webgpuComputeLayout-CHUyeeFd.js";import{o}from"./sphReactionResidualHistoryGpu-BXqG2iUd.js";import{i as s}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{t as c}from"./sphExactMassWgsl-DwXztSAS.js";import{a as l,n as u,r as d}from"./sphExactThermalEnergyWgsl-DAccym1I.js";import{h as f}from"./sphExactMassInventoryGpu-DeQPnDkd.js";import{f as p,h as m,m as h,o as g}from"./sphResidentProductHistoryGpu-BxTO7Ur5.js";import{r as _}from"./sphResidentClockGpu-D80NBRWw.js";import{n as v,r as y}from"./sphExactFiniteWallGpu-CsimoW10.js";import{t as b}from"./schroederSpatialChainMassConservationGpu-BCQ4IyY7.js";function x({device:e,sourceRead:t=null,candidate:i=null,controlBuffer:o,allocate:s}){if(!i){if(t)throw TypeError(`Chain cannot discard retained product history`);return null}let c=i.productEventBuffer,l=g(i,e),u=t?.descriptor??null,d=t?.buffer??null,f=()=>{if(t?.validate(),!l||!p(l,{handle:i,device:e})||i.productEventBuffer!==c||[u,l].filter(Boolean).some(e=>e.rowStrideFloats!==32)||l.rowCapacity*128>c.size||u&&(u.rowCapacity*128>d.size||u.rowCapacity>l.rowCapacity))throw TypeError(`Canonical reaction history requires genuine bounded legacy count owners`)};f();let m=d===c,h=u&&u.controlBuffer===l.controlBuffer&&u.controlOffsetBytes===l.controlOffsetBytes;if(h&&!m)throw TypeError(`History count cannot name different storage`);let _=Math.max(1,l.rowCapacity);if(Math.ceil(_/64)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Reaction history exceeds admission dispatch capacity`);let v=[],y=[],b=[],x=(e,t,n,r=`array<u32>`)=>{v.push(`@group(0) @binding(${y.length}) var<${t===`uniform`?`uniform`:`storage,${t===`storage`?`read_write`:`read`}`}> ${e}:${r};`),y.push(t),b.push(n)};x(`history`,`storage`,{buffer:c}),x(`after_count`,`storage`,{buffer:l.controlBuffer,offset:l.controlOffsetBytes,size:48}),x(`control`,`storage`,{buffer:o},`array<atomic<u32>>`);let S=u&&!h?s(`ulg-chain-history-source-count`,48,140):null;u&&!h&&x(`before_count`,`read-only-storage`,{buffer:S}),d&&!m&&x(`source`,`read-only-storage`,{buffer:d});let C=s(`ulg-chain-history-identities`,64,72),w=e=>e?[e.expectedMagic,e.expectedVersion,e.expectedReadyStatus,0,e.rowCapacity,e.expectedRowStrideVec4,e.expectedGeneration,e.expectedSeal]:Array(8).fill(0);e.queue.writeBuffer(C,0,new Uint32Array([...w(u),...w(l)])),x(`cfg`,`uniform`,{buffer:C},`Expected`);let T=h?`after_count`:`before_count`,E=m?`history`:`source`,D=(e,t)=>`${e}[0]==cfg.${t}[0].x && ${e}[1]==cfg.${t}[0].y
    && ${e}[2]==cfg.${t}[0].z && ${e}[3]<=cfg.${t}[1].x
    && ${e}[4]==cfg.${t}[1].x && ${e}[5]==cfg.${t}[1].y
    && ${e}[6]==cfg.${t}[1].z && ${e}[7]==cfg.${t}[1].w
    && ${e}[8]==(${e}[3]+63u)/64u && ${e}[9]==1u && ${e}[10]==1u && ${e}[11]==0u`,O=`struct Expected { before:array<vec4<u32>,2>, after:array<vec4<u32>,2> };
${v.join(`
`)}
fn source_count()->u32 {return ${u?`min(${T}[3],cfg.before[1].x)`:`0u`};}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row==0u && (!(${D(`after_count`,`after`)}) ${u?`|| !(${D(T,`before`)})`:``})) {
    atomicOr(&control[2],524288u);
  }
  if(row<min(after_count[3],cfg.after[1].x) && (history[row*32u+3u]&0x7fffffffu)!=0u) {
    atomicOr(&control[2],524288u);
  }
  ${u?`if(row<source_count() && (${E}[row*32u+3u]&0x7fffffffu)!=0u) {
    atomicOr(&control[2],524288u);
  }`:``}
}
@compute @workgroup_size(64) fn restore_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(atomicLoad(&control[2])==0u || row>=cfg.after[1].x) {return;}
  ${h?`return;`:`if(row<source_count()) {
    ${m?`// The genuine tail-append producer retains the predecessor prefix.`:d?`for(var w=0u;w<32u;w++) {history[row*32u+w]=source[row*32u+w];}`:``}
  } else {for(var w=0u;w<32u;w++) {history[row*32u+w]=0u;}}`}
}
@compute @workgroup_size(1) fn restore_count() {
  if(atomicLoad(&control[2])==0u) {return;}
  ${h?`return;`:`let count=source_count();
  after_count[0]=cfg.after[0].x;after_count[1]=cfg.after[0].y;
  after_count[2]=cfg.after[0].z;after_count[3]=count;
  after_count[4]=cfg.after[1].x;after_count[5]=cfg.after[1].y;
  after_count[6]=cfg.after[1].z;after_count[7]=cfg.after[1].w;
  after_count[8]=(count+63u)/64u;after_count[9]=1u;after_count[10]=1u;after_count[11]=0u;`}
}`,k=Object.fromEntries([`check`,`restore_rows`,`restore_count`].map(t=>{let i=n(e,{code:O,entryPoint:t,label:`ulg-chain-history-${t}`,cacheKey:`ulg-chain-history-v2-${t}-${!!u}-${!!h}-${m}`,bindings:y.map((e,t)=>a(t,e))}),o=r(e,{layout:i.bindGroupLayout,entries:b.map((e,t)=>({binding:t,resource:e}))});return[t,(e,t)=>{let n=e.beginComputePass();n.setPipeline(i.pipeline),n.setBindGroup(0,o),n.dispatchWorkgroups(t),n.end()}]}));return Object.freeze({check(e){f(),S&&e.copyBufferToBuffer(u.controlBuffer,u.controlOffsetBytes,S,0,48),k.check(e,Math.ceil(_/64))},restore(e){f(),k.restore_rows(e,Math.ceil(_/64)),k.restore_count(e,1)}})}function S({device:p,capture:g,original:S,candidate:C,refreshValidationBuffer:w,thermalValidationBuffer:T=w,originalQuantities:E=null,candidateQuantities:D=null,originalEnergy:O=null,candidateEnergy:k=null,originalMassRead:A=null,candidateMassRead:j=null,phaseValidationBuffer:M=null,phaseLineageCount:N=0,phasePredecessorMassRead:P=A,phaseCandidateMassRead:F=j,refinementValidationBuffer:I=null,reactionValidationBuffer:L=null,sourceHistoryRead:ee=null,candidateHistory:te=null,parcelRecord:R=null,wallRecord:z=null,lineageRecord:B=null,sourceResidualHistory:ne=null,emittedResidualLedger:re=null,residualSourceControlBuffer:V=null,clockOrigin:H,sourceClock:ie=null}){g.validate();let U=typeof globalThis.GPUDevice==`function`&&p instanceof globalThis.GPUDevice,W=[],G=(n,r,i)=>{let a=s(U?e(t(p,{bucketKey:n,label:n,size:r,usage:i}),p,{bucketKey:n,size:r,usage:i}):p.createBuffer({label:n,size:r,usage:i}),p);return W.push(a),a},K=null,q=null,J=()=>{q?.destroy(),K?.destroy();for(let e of W.splice(0))i(e)};try{let e=G(`ulg-chain-closure-control`,128,140),t=x({device:p,sourceRead:ee,candidate:te,controlBuffer:e,allocate:G});if(q=o({device:p,source:ne,emitted:re,controlBuffer:e}),!H)throw TypeError(`Chain closure requires its original source clock`);K=_({device:p,source:ie,...H,dt:g.dt,controlBuffer:e});let i=G(`ulg-chain-closure-params`,48,72),s=[`stateBuffer`,`thermoBuffer`,`mechanicsBuffer`].map(e=>[S[e],C[e]]);if(B&&(m(B,p),s.push([B.beforeBuffer,B.buffer])),z){if(y(z,p),!k||z.particleCount!==g.particleCount)throw TypeError(`Finite wall closure requires its matching canonical carrier energy`);s.push([z.originalBuffer,z.buffer])}if(E||D){if(!E||!D)throw TypeError(`Chain closure lost exact quantities`);s.push([E.quantityBuffer,D.quantityBuffer])}if(R){if(!R.validationBuffer||!k||!j||R.carrierMassRead!==j||R.exactEnergy!==k||R.originalParcels.count!==R.parcels.count||R.parcels.count<1||R.parcels.device!==p)throw TypeError(`Chain parcel closure requires its complete captured successor`);for(let e of[`paramsBuffer`,`ledgerBuffer`,`sinkBuffer`]){if(R.originalParcels[e]===R.parcels[e])throw TypeError(`Chain parcel candidate aliases its accepted source`);s.push([R.originalParcels[e],R.parcels[e]])}}let U=0;if(O||k){if(E||D||!O||!k)throw TypeError(`Chain closure requires one complete exact energy representation`);for(let e of[O,k])if(e.rowCount!==g.particleCount||e.format?.wordCount!==d||e.format?.quantumExponent!==u.quantumExponent||e.energyBuffer?.size!==4*l(g.particleCount))throw TypeError(`Chain closure requires aligned canonical energy records`);U=2*g.particleCount*d,T=k.energyBuffer,s.push([O.energyBuffer,k.energyBuffer])}let W=!!(j&&j===A&&!M&&!L&&!I&&!R&&N===0),Y=()=>{if(!j&&!A&&!M&&!L&&!I&&N===0)return;let e=M&&M.size>=64&&Number.isSafeInteger(N)&&N>0&&N*4===g.particleCount;if(!k||!e&&!L&&!W||L&&L.size<32||I&&(!e||I.size<32)||(M||N!==0)&&!e||!W&&j?.buffer===A?.buffer||![A,j,...e?[P,F]:[]].every(e=>f(e,{device:p,family:e?.family,expectedGeneration:e?.generation,rowCount:g.particleCount,format:k.format})))throw TypeError(`Chain reaction/phase closure requires genuine aligned successor mass and validation`)};Y(),p.queue.writeBuffer(i,0,new Uint32Array([g.particleCount,g.levelCount,U,+!!k,j?.byteOffset/4||0,P?.byteOffset/4||0,N,+!!j,F?.byteOffset/4||0,0,0,0]));for(let[e,t]of s)if(!e||!t||e.size!==t.size||Math.ceil(t.size/256)>p.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain closure requires aligned bounded output families`);let X=`
${c(u)}
struct Params { step:vec4<u32>, mass:vec4<u32>, phase_mass:vec4<u32> };
@group(0) @binding(0) var<storage, read> upstream: array<u32>;
@group(0) @binding(1) var<storage, read> refresh: array<u32>;
@group(0) @binding(2) var<storage, read> thermal: array<u32>;
@group(0) @binding(3) var<storage, read> s: array<f32>;
@group(0) @binding(4) var<storage, read> t: array<f32>;
@group(0) @binding(5) var<storage, read> m: array<f32>;
@group(0) @binding(6) var<storage, read_write> control: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> cfg: Params;
@group(0) @binding(8) var<storage, read> original_s: array<u32>;
@group(0) @binding(9) var<storage, read> original_energy: array<u32>;
@group(0) @binding(10) var<storage, read> mass:array<u32>;
@group(0) @binding(12) var<storage, read> phase:array<u32>;
fn mass_row(row:u32)->ExactMass {
  var value:ExactMass;
  for(var i=0u;i<EM_WORDS;i++) {
    value.words[i]=mass[cfg.mass.x+row*EM_WORDS+i];
  }
  return value;
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; let params = cfg.step;
  if (row == 0u) {
    atomicStore(&control[0], 0x53434331u);
    for (var i=3u; i<16u; i++) { atomicStore(&control[i], upstream[i]); }
    atomicStore(&control[16], params.y);
    if (upstream[0]!=0x53475031u || upstream[1]!=3u || upstream[2]!=0u || upstream[16]!=params.y) {
      atomicOr(&control[2], 1u);
    }
    if (refresh[0]!=0u) { atomicOr(&control[2], 2u); }
    if (thermal[params.z]!=0u) { atomicOr(&control[2], 4u); }
    // A rejected canonical header records skipped particle-steps instead of
    // an arithmetic error. Do not admit an interval that omitted pair laws.
    if (params.w!=0u && thermal[params.z+2u]!=original_energy[params.z+2u]) {
      atomicOr(&control[2], 4u);
    }
  }
    if (cfg.mass.z>0u && row==0u) {
      if (phase[0]!=0x50544631u || phase[1]!=1u || phase[2]!=0u
        || phase[3]!=cfg.mass.z || phase[6]!=0u) {atomicOr(&control[2],256u);}
    }
  if (row >= params.x) { return; }
  if (cfg.mass.w!=0u) {
    let projected=em_project_f32_bits(mass_row(row));
    if(projected.error!=0u || projected.bits!=bitcast<u32>(s[row*8u+3u])) {atomicOr(&control[2],512u);}
  } else if (bitcast<u32>(s[row*8u+3u])!=original_s[row*8u+3u]) { atomicOr(&control[2],128u); }
  for (var i=0u; i<8u; i++) { if (!(abs(s[row*8u+i])<=3.402823e38)) { atomicOr(&control[2],8u); } }
  for (var i=0u; i<12u; i++) { if (!(abs(t[row*12u+i])<=3.402823e38)) { atomicOr(&control[2],16u); } }
  for (var i=0u; i<32u; i++) { if (!(abs(m[row*32u+i])<=3.402823e38)) { atomicOr(&control[2],32u); } }
  if (s[row*8u+3u]>0.0 && (t[row*12u+10u]!=1.0 || t[row*12u+2u]<0.0)) { atomicOr(&control[2],64u); }
}
@compute @workgroup_size(1) fn finalize() {
  atomicStore(&control[1], select(5u,3u,atomicLoad(&control[2])==0u));
}`,Z=[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`uniform`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`],Q=[g.controlBuffer,w,T,C.stateBuffer,C.thermoBuffer,C.mechanicsBuffer,e,i,S.stateBuffer,O?.energyBuffer??w,j?.buffer??w,P?.buffer??w,M??w],$=(e,t,i,o,s)=>{let c=n(p,{code:e,entryPoint:t,cacheKey:`ulg-chain-closure-v6-refinement-${s}`,label:`ulg-chain-closure-${t}`,bindings:i.map((e,t)=>a(t,e))}),l=r(p,{layout:c.bindGroupLayout,entries:o.map((e,t)=>({binding:t,resource:{buffer:e}}))});return(e,t)=>{let n=e.beginComputePass();n.setPipeline(c.pipeline),n.setBindGroup(0,l),n.dispatchWorkgroups(t),n.end()}},ae=$(X,`check`,Z,Q,`check`),oe=$(X,`finalize`,Z,Q,`finalize`),se=N?$(`
${c(u)}
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
struct Params { step:vec4<u32>, mass:vec4<u32>, phase_mass:vec4<u32> };
@group(0) @binding(3) var<uniform> cfg:Params;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x>=cfg.mass.z) {return;}
  var a:ExactMass;var b:ExactMass;
  for(var lane=0u;lane<4u;lane++) {
    let row=id.x+lane*cfg.mass.z;var x:ExactMass;var y:ExactMass;
    for(var w=0u;w<EM_WORDS;w++) {
      x.words[w]=before[cfg.mass.y+row*EM_WORDS+w];
      y.words[w]=after[cfg.phase_mass.x+row*EM_WORDS+w];
    }
    let aa=em_add(a,x);let bb=em_add(b,y);a=aa.value;b=bb.value;
    if((aa.error|bb.error)!=0u) {atomicOr(&control[2],512u);}
  }
  if(em_compare(a,b)!=0) {atomicOr(&control[2],512u);}
}`,`check`,[`read-only-storage`,`read-only-storage`,`storage`,`uniform`],[P.buffer,F.buffer,e,i],`phase-mass`):null,ce=I?$(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  for(var w=0u;w<8u;w++) {atomicStore(&control[23u+w],evidence[w]);}
  if(evidence[0]!=0u || evidence[5]!=0u) {atomicOr(&control[2],8192u);}
}`,`check`,[`read-only-storage`,`storage`],[I,e],`refinement`):null,le=R?$(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  atomicStore(&control[31],evidence[2]);
  if(evidence[0]!=0x50435231u || evidence[1]!=1u || evidence[2]!=0u
    || evidence[3]!=${R.parcels.count}u || evidence[7]!=1u) {atomicOr(&control[2],16384u);}
}`,`check`,[`read-only-storage`,`storage`],[R.validationBuffer,e],`parcels-${R.parcels.count}`):null,ue=z?$(v(),`check`,[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`],[z.originalBuffer,z.buffer,z.deltaBuffer,z.validationBuffer,e],`finite-walls-v1`):null,de=B?$(h(),`check`,[`read-only-storage`,`read-only-storage`,`storage`],[B.beforeBuffer,B.buffer,e],`reaction-lineage-v1`):null,fe=O&&k&&A&&j?b({device:p,allocate:G,controlBuffer:e,originalMassRead:A,candidateMassRead:j,originalEnergy:O,candidateEnergy:k,reactionValidationBuffer:L,residualHistory:q?.record??null,originalParcels:R?.originalParcels,candidateParcels:R?.parcels}):null,pe=`
@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<storage, read> control: array<u32>;
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x<arrayLength(&output) && control[2]!=0u) { output[id.x]=source[id.x]; }
}`,me=s.filter(([e,t])=>e!==t).map(([t,n])=>({words:n.size/4,run:$(pe,`restore`,[`read-only-storage`,`storage`,`read-only-storage`],[t,n,e],`restore`)}));if(j&&!W){let t=G(`ulg-chain-closure-mass-restore`,16,72);if(p.queue.writeBuffer(t,0,new Uint32Array([A.byteOffset/4,j.byteOffset/4,j.byteLength/4,0])),Math.ceil(j.byteLength/256)>p.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain phase mass restoration exceeds dispatch capacity`);let n=pe.replace(`@compute @workgroup_size(64)`,`@group(0) @binding(3) var<uniform> offsets:vec4<u32>;
@compute @workgroup_size(64)`).replace(`id.x<arrayLength(&output)`,`id.x<offsets.z`).replace(`output[id.x]=source[id.x]`,`output[offsets.y+id.x]=source[offsets.x+id.x]`);me.push({words:j.byteLength/4,run:$(n,`restore`,[`read-only-storage`,`storage`,`read-only-storage`,`uniform`],[A.buffer,j.buffer,e,t],`restore-mass`)})}let he=V?$(`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){
 if(source[0]!=0x524d5331u || source[1]!=1u || source[2]!=0u){atomicOr(&control[2],4194304u);}
}`,`check`,[`read-only-storage`,`storage`],[V,e],`residual-source`):null;return{controlBuffer:e,clock:K.clock,transferClock:K.transfer,destroy:J,residualHistory:q?.record??null,transferResidualHistory:q?.transfer??null,encode(n){g.validate(),Y(),n.clearBuffer(e),q?.encode(n),ae(n,Math.ceil(g.particleCount/64)),he?.(n,1),se?.(n,Math.ceil(N/64)),ce?.(n,1),le?.(n,1),ue?.(n,6),B&&(m(B,p),de(n,Math.ceil(B.capacity/64))),fe?.(n),t?.check(n),q?.check(n),q?.requireEmptyForMechanics(n),K.check(n);for(let e of me)e.run(n,Math.ceil(e.words/64));t?.restore(n),q?.restore(n),oe(n,1),K.advance(n)}}}catch(e){throw J(),e}}export{S as prepareSchroederSpatialChainClosure};