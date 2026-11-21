import{o as e,s as t}from"./webgpuComputeLayout-NKCaIXwi.js";import{i as n,n as r,o as i,t as a}from"./sphReactionResidualHistoryGpu-qhxC3XX3.js";import{i as o}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{t as s}from"./sphExactMassWgsl-ChqpSzqB.js";import{_ as c,a as l,n as u,r as d}from"./sphExactThermalEnergyWgsl-RP4uiT8-.js";import{l as f}from"./sphExactMassInventoryGpu-DPpaJ_7X.js";import{_ as p,h as m,l as h,n as g,r as _,v}from"./sphReactionLineageGpu-BMm70YNI.js";import{r as y}from"./sphResidentClockGpu-CWFRYU_o.js";function b({device:n,history:o,allocate:l,controlBuffer:u}){let d=()=>i(o,n);d();let f=[],p=Math.max(o.capacity,o.beforeCapacity),m=null;do{let i=m===null,d=Math.ceil(p/64);if(d>n.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Residual inventory reduction exceeds dispatch capacity`);let h=l(`ulg-residual-inventory-reduction`,d*r.format.wordCount*16,128),g=l(`ulg-residual-inventory-identities`,48,72);n.queue.writeBuffer(g,0,new Uint32Array([p,o.beforeCapacity,o.capacity,+!!o.beforeBuffer,o.beforeGeneration,o.beforeSeal,o.generation,o.seal,0,0,0,0]));let _=t(n,{code:`
${s(r.format)}
${c(r.format)}
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
@group(0) @binding(3) var<storage,read_write> control:array<atomic<u32>>;
struct Params { shape:vec4<u32>, identity:vec4<u32>, reserved:vec4<u32> };
@group(0) @binding(4) var<uniform> cfg:Params;
var<workgroup> bm:array<ExactMass,64>;
var<workgroup> am:array<ExactMass,64>;
var<workgroup> be:array<ExactMass,64>;
var<workgroup> ae:array<ExactMass,64>;
fn header_valid(after_side:bool)->bool {
  if(after_side) {
    return after[0]==0x50484731u && after[1]==${r.version}u && after[2]==1u && after[3]<=cfg.shape.z
      && after[4]==cfg.shape.z && after[5]==${r.rowWords/4}u && after[6]==cfg.identity.z && after[7]==cfg.identity.w
      && after[8]==(after[3]+63u)/64u && after[9]==1u && after[10]==1u && after[11]==0u;
  }
  return before[0]==0x50484731u && before[1]==${r.version}u && before[2]==1u && before[3]<=cfg.shape.y
    && before[4]==cfg.shape.y && before[5]==${r.rowWords/4}u && before[6]==cfg.identity.x && before[7]==cfg.identity.y
    && before[8]==(before[3]+63u)/64u && before[9]==1u && before[10]==1u && before[11]==0u;
}
@compute @workgroup_size(64) fn reduce(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>) {
  var m0=ExactMass();var m1=ExactMass();var e0=ExactMass();var e1=ExactMass();
  if(${i} && id.x==0u) {
    if(!header_valid(true) || (cfg.shape.w!=0u && !header_valid(false))) {
      atomicOr(&control[2],${a}u);
    }
  }
  if(id.x<cfg.shape.x) {
    if(${i}) {
      var s0=ExactMass();var s1=ExactMass();
      let base=${r.headerWords}u+id.x*${r.rowWords}u;
      for(var w=0u;w<EM_WORDS;w++) {
        if(cfg.shape.w!=0u && id.x<min(before[3],cfg.shape.y)) {
          m0.words[w]=before[base+${r.massOffset}u+w];
          e0.words[w]=before[base+${r.energyOffset}u+w];
          s0.words[w]=before[base+${r.sourceOffset}u+w];
        }
        if(id.x<min(after[3],cfg.shape.z)) {
          m1.words[w]=after[base+${r.massOffset}u+w];
          e1.words[w]=after[base+${r.energyOffset}u+w];
          s1.words[w]=after[base+${r.sourceOffset}u+w];
        }
      }
      let a=el_subtract(e0,s0);let b=el_subtract(e1,s1);e0=a.value;e1=b.value;
      if((a.error|b.error)!=0u){atomicOr(&control[2],2048u);}
    } else {
      for(var w=0u;w<EM_WORDS;w++) {
        m0.words[w]=before[id.x*4u*EM_WORDS+w];m1.words[w]=before[(id.x*4u+1u)*EM_WORDS+w];
        e0.words[w]=before[(id.x*4u+2u)*EM_WORDS+w];e1.words[w]=before[(id.x*4u+3u)*EM_WORDS+w];
      }
    }
  }
  bm[lane]=m0;am[lane]=m1;be[lane]=e0;ae[lane]=e1;workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u) {
    if(lane<stride) {
      let a=em_add(bm[lane],bm[lane+stride]);let b=em_add(am[lane],am[lane+stride]);
      let c=el_add(be[lane],be[lane+stride]);let d=el_add(ae[lane],ae[lane+stride]);
      bm[lane]=a.value;am[lane]=b.value;be[lane]=c.value;ae[lane]=d.value;
      if((a.error|b.error)!=0u){atomicOr(&control[2],1024u);}
      if((c.error|d.error)!=0u){atomicOr(&control[2],2048u);}
    }
    workgroupBarrier();
  }
  if(lane==0u) {
    for(var w=0u;w<EM_WORDS;w++) {
      output[group.x*4u*EM_WORDS+w]=bm[0].words[w];output[(group.x*4u+1u)*EM_WORDS+w]=am[0].words[w];
      output[(group.x*4u+2u)*EM_WORDS+w]=be[0].words[w];output[(group.x*4u+3u)*EM_WORDS+w]=ae[0].words[w];
    }
  }
}`,entryPoint:`reduce`,cacheKey:`ulg-residual-inventory-v${r.version}-${i}`,label:`ulg-residual-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`].map((t,n)=>e(n,t))}),v=[i?o.beforeBuffer??o.buffer:m,i?o.buffer:m,h,u,g],y=n.createBindGroup({layout:_.bindGroupLayout,entries:v.map((e,t)=>({binding:t,resource:{buffer:e}}))});f.push({pipeline:_.pipeline,group:y,groups:d}),m=h,p=d}while(p>1);return{buffer:m,encode(e){d();for(let t of f){let n=e.beginComputePass({label:`ulg-residual-inventory`});n.setPipeline(t.pipeline),n.setBindGroup(0,t.group),n.dispatchWorkgroups(t.groups),n.end()}}}}function x({device:n,allocate:r,controlBuffer:i,originalMassRead:a,candidateMassRead:o,originalEnergy:l,candidateEnergy:d,reactionValidationBuffer:f=null,originalParcels:p=null,candidateParcels:m=null,residualHistory:h=null}){let g=o.rowCount,_=[],v=m?.count??0,y=h?b({device:n,history:h,allocate:r,controlBuffer:i}):null,x=g+(v?v+1:0),S=null;do{let h=S===null,b=Math.ceil(x/64);if(b>n.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain inventory reduction exceeds dispatch capacity`);let C=r(`ulg-chain-inventory-reduction`,b*u.wordCount*16,128),w=r(`ulg-chain-inventory-params`,32,72);n.queue.writeBuffer(w,0,new Uint32Array([x,g,a.byteOffset/4,o.byteOffset/4,v,0,0,0]));let T=t(n,{code:`
${s(u)}
${c(u)}
@group(0) @binding(0) var<storage,read> before_mass:array<u32>;
@group(0) @binding(1) var<storage,read> after_mass:array<u32>;
@group(0) @binding(2) var<storage,read> before_energy:array<u32>;
@group(0) @binding(3) var<storage,read> after_energy:array<u32>;
@group(0) @binding(4) var<storage,read_write> out:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
struct Params { counts:vec4<u32>, parcels:vec4<u32> };
@group(0) @binding(6) var<uniform> params:Params;
${v?`@group(0) @binding(8) var<storage,read> before_parcels:array<u32>;
@group(0) @binding(9) var<storage,read> after_parcels:array<u32>;
@group(0) @binding(10) var<storage,read> before_sinks:array<u32>;
@group(0) @binding(11) var<storage,read> after_sinks:array<u32>;
`:``}
@group(0) @binding(7) var<storage,read> reaction:array<u32>;
var<workgroup> bm:array<ExactMass,64>;
var<workgroup> am:array<ExactMass,64>;
var<workgroup> be:array<ExactMass,64>;
var<workgroup> ae:array<ExactMass,64>;
@compute @workgroup_size(64) fn reduce(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32, @builtin(workgroup_id) group:vec3<u32>) {
  let cfg=params.counts;
  var m0=ExactMass(); var m1=ExactMass(); var e0=ExactMass(); var e1=ExactMass();
  if(id.x<cfg.x) {
    if(${h}) {
      if(id.x<cfg.y) {
      var s0=ExactMass(); var s1=ExactMass();
      for(var w=0u;w<EM_WORDS;w++) {
        m0.words[w]=before_mass[cfg.z+id.x*EM_WORDS+w];
        m1.words[w]=after_mass[cfg.w+id.x*EM_WORDS+w];
        e0.words[w]=before_energy[id.x*EM_WORDS+w];
        e1.words[w]=after_energy[id.x*EM_WORDS+w];
        s0.words[w]=before_energy[(id.x+cfg.y)*EM_WORDS+w];
        s1.words[w]=after_energy[(id.x+cfg.y)*EM_WORDS+w];
      }
      let a=el_subtract(e0,s0);let b=el_subtract(e1,s1);
      e0=a.value;e1=b.value;
      if((a.error|b.error)!=0u) {atomicOr(&control[2],2048u);}
      } ${v?`else {
        let p=id.x-cfg.y;var d0=ExactMass();var d1=ExactMass();
        for(var w=0u;w<EM_WORDS;w++) {
          if(p<params.parcels.x) {
            m0.words[w]=before_parcels[p*3u*EM_WORDS+w];
            m1.words[w]=after_parcels[p*3u*EM_WORDS+w];
            d0.words[w]=before_parcels[(p*3u+1u)*EM_WORDS+w];
            d1.words[w]=after_parcels[(p*3u+1u)*EM_WORDS+w];
            e0.words[w]=before_parcels[(p*3u+2u)*EM_WORDS+w];
            e1.words[w]=after_parcels[(p*3u+2u)*EM_WORDS+w];
          } else {
            m0.words[w]=before_sinks[w];m1.words[w]=after_sinks[w];
            d0.words[w]=before_sinks[2u*EM_WORDS+w];d1.words[w]=after_sinks[2u*EM_WORDS+w];
            e0.words[w]=before_sinks[EM_WORDS+w];e1.words[w]=after_sinks[EM_WORDS+w];
          }
        }
        let a=em_add(m0,d0);let b=em_add(m1,d1);m0=a.value;m1=b.value;
        if((a.error|b.error)!=0u) {atomicOr(&control[2],1024u);}
      }
`:``}
    } else {
      for(var w=0u;w<EM_WORDS;w++) {
        m0.words[w]=before_mass[id.x*4u*EM_WORDS+w];
        m1.words[w]=before_mass[(id.x*4u+1u)*EM_WORDS+w];
        e0.words[w]=before_mass[(id.x*4u+2u)*EM_WORDS+w];
        e1.words[w]=before_mass[(id.x*4u+3u)*EM_WORDS+w];
      }
    }
  }
  bm[lane]=m0;am[lane]=m1;be[lane]=e0;ae[lane]=e1;
  workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u) {
    if(lane<stride) {
      let a=em_add(bm[lane],bm[lane+stride]);let b=em_add(am[lane],am[lane+stride]);
      let c=el_add(be[lane],be[lane+stride]);let d=el_add(ae[lane],ae[lane+stride]);
      bm[lane]=a.value;am[lane]=b.value;be[lane]=c.value;ae[lane]=d.value;
      if((a.error|b.error)!=0u) {atomicOr(&control[2],1024u);}
      if((c.error|d.error)!=0u) {atomicOr(&control[2],2048u);}
    }
    workgroupBarrier();
  }
  if(lane==0u) {
    for(var w=0u;w<EM_WORDS;w++) {
      out[group.x*4u*EM_WORDS+w]=bm[0].words[w];
      out[(group.x*4u+1u)*EM_WORDS+w]=am[0].words[w];
      out[(group.x*4u+2u)*EM_WORDS+w]=be[0].words[w];
      out[(group.x*4u+3u)*EM_WORDS+w]=ae[0].words[w];
    }
    if(cfg.x<=64u) {
      if(${!!f}) {
      atomicStore(&control[17],reaction[2]);atomicStore(&control[18],reaction[3]);
      for(var w=4u;w<8u;w++) {atomicStore(&control[15u+w],reaction[w]);}
      if(reaction[0]!=0x524c4731u || reaction[1]!=1u || reaction[2]!=1u) {atomicOr(&control[2],4096u);}
      }
      if(${!y}) {
        if(em_compare(bm[0],am[0])!=0) {atomicOr(&control[2],1024u);}
        if(el_compare(be[0],ae[0])!=0) {atomicOr(&control[2],2048u);}
      }
    }
  }
}`,entryPoint:`reduce`,cacheKey:`ulg-chain-inventory-v4-history-${h}-${!!f}-${!!v}-${!!y}`,label:`ulg-chain-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`,`read-only-storage`,...v?[,,,,].fill(`read-only-storage`):[]].map((t,n)=>e(n,t))}),E=[h?a.buffer:S,h?o.buffer:S,h?l.energyBuffer:S,h?d.energyBuffer:S,C,i,w,f??o.buffer,...v?[p.ledgerBuffer,m.ledgerBuffer,p.sinkBuffer,m.sinkBuffer]:[]],D=n.createBindGroup({layout:T.bindGroupLayout,entries:E.map((e,t)=>({binding:t,resource:{buffer:e}}))});_.push({pipeline:T.pipeline,bindGroup:D,groups:b}),S=C,x=b}while(x>1);if(y){let r=t(n,{code:`
${s(u)}
${c(u)}
@group(0) @binding(0) var<storage,read> particles:array<u32>;
@group(0) @binding(1) var<storage,read> history:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn compare() {
  var totals:array<ExactMass,4>;
  for(var row=0u;row<4u;row++) {
    var a=ExactMass();var b=ExactMass();
    for(var w=0u;w<EM_WORDS;w++){a.words[w]=particles[row*EM_WORDS+w];b.words[w]=history[row*EM_WORDS+w];}
    if(row<2u) {let sum=em_add(a,b);totals[row]=sum.value;if(sum.error!=0u){atomicOr(&control[2],1024u);}}
    else {let sum=el_add(a,b);totals[row]=sum.value;if(sum.error!=0u){atomicOr(&control[2],2048u);}}
  }
  if(em_compare(totals[0],totals[1])!=0){atomicOr(&control[2],1024u);}
  if(el_compare(totals[2],totals[3])!=0){atomicOr(&control[2],2048u);}
}`,entryPoint:`compare`,cacheKey:`ulg-chain-inventory-history-compare-v1`,label:`ulg-chain-complete-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`storage`].map((t,n)=>e(n,t))}),a=n.createBindGroup({layout:r.bindGroupLayout,entries:[S,y.buffer,i].map((e,t)=>({binding:t,resource:{buffer:e}}))});_.push({pipeline:r.pipeline,bindGroup:a,groups:1})}return e=>{y?.encode(e);for(let t of _){let n=e.beginComputePass({label:`ulg-chain-inventory`});n.setPipeline(t.pipeline),n.setBindGroup(0,t.bindGroup),n.dispatchWorkgroups(t.groups),n.end()}}}function S({device:n,sourceRead:r=null,candidate:i=null,controlBuffer:a,allocate:o}){if(!i){if(r)throw TypeError(`Chain cannot discard retained product history`);return null}let s=i.productEventBuffer,c=h(i,n),l=r?.descriptor??null,u=r?.buffer??null,d=()=>{if(r?.validate(),!c||!m(c,{handle:i,device:n})||i.productEventBuffer!==s||[l,c].filter(Boolean).some(e=>e.rowStrideFloats!==32)||c.rowCapacity*128>s.size||l&&(l.rowCapacity*128>u.size||l.rowCapacity>c.rowCapacity))throw TypeError(`Canonical reaction history requires genuine bounded legacy count owners`)};d();let f=u===s,p=l&&l.controlBuffer===c.controlBuffer&&l.controlOffsetBytes===c.controlOffsetBytes;if(p&&!f)throw TypeError(`History count cannot name different storage`);let g=Math.max(1,c.rowCapacity);if(Math.ceil(g/64)>n.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Reaction history exceeds admission dispatch capacity`);let _=[],v=[],y=[],b=(e,t,n,r=`array<u32>`)=>{_.push(`@group(0) @binding(${v.length}) var<${t===`uniform`?`uniform`:`storage,${t===`storage`?`read_write`:`read`}`}> ${e}:${r};`),v.push(t),y.push(n)};b(`history`,`storage`,{buffer:s}),b(`after_count`,`storage`,{buffer:c.controlBuffer,offset:c.controlOffsetBytes,size:48}),b(`control`,`storage`,{buffer:a},`array<atomic<u32>>`);let x=l&&!p?o(`ulg-chain-history-source-count`,48,140):null;l&&!p&&b(`before_count`,`read-only-storage`,{buffer:x}),u&&!f&&b(`source`,`read-only-storage`,{buffer:u});let S=o(`ulg-chain-history-identities`,64,72),C=e=>e?[e.expectedMagic,e.expectedVersion,e.expectedReadyStatus,0,e.rowCapacity,e.expectedRowStrideVec4,e.expectedGeneration,e.expectedSeal]:Array(8).fill(0);n.queue.writeBuffer(S,0,new Uint32Array([...C(l),...C(c)])),b(`cfg`,`uniform`,{buffer:S},`Expected`);let w=p?`after_count`:`before_count`,T=f?`history`:`source`,E=(e,t)=>`${e}[0]==cfg.${t}[0].x && ${e}[1]==cfg.${t}[0].y
    && ${e}[2]==cfg.${t}[0].z && ${e}[3]<=cfg.${t}[1].x
    && ${e}[4]==cfg.${t}[1].x && ${e}[5]==cfg.${t}[1].y
    && ${e}[6]==cfg.${t}[1].z && ${e}[7]==cfg.${t}[1].w
    && ${e}[8]==(${e}[3]+63u)/64u && ${e}[9]==1u && ${e}[10]==1u && ${e}[11]==0u`,D=`struct Expected { before:array<vec4<u32>,2>, after:array<vec4<u32>,2> };
${_.join(`
`)}
fn source_count()->u32 {return ${l?`min(${w}[3],cfg.before[1].x)`:`0u`};}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row==0u && (!(${E(`after_count`,`after`)}) ${l?`|| !(${E(w,`before`)})`:``})) {
    atomicOr(&control[2],524288u);
  }
  if(row<min(after_count[3],cfg.after[1].x) && (history[row*32u+3u]&0x7fffffffu)!=0u) {
    atomicOr(&control[2],524288u);
  }
  ${l?`if(row<source_count() && (${T}[row*32u+3u]&0x7fffffffu)!=0u) {
    atomicOr(&control[2],524288u);
  }`:``}
}
@compute @workgroup_size(64) fn restore_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(atomicLoad(&control[2])==0u || row>=cfg.after[1].x) {return;}
  ${p?`return;`:`if(row<source_count()) {
    ${f?`// The genuine tail-append producer retains the predecessor prefix.`:u?`for(var w=0u;w<32u;w++) {history[row*32u+w]=source[row*32u+w];}`:``}
  } else {for(var w=0u;w<32u;w++) {history[row*32u+w]=0u;}}`}
}
@compute @workgroup_size(1) fn restore_count() {
  if(atomicLoad(&control[2])==0u) {return;}
  ${p?`return;`:`let count=source_count();
  after_count[0]=cfg.after[0].x;after_count[1]=cfg.after[0].y;
  after_count[2]=cfg.after[0].z;after_count[3]=count;
  after_count[4]=cfg.after[1].x;after_count[5]=cfg.after[1].y;
  after_count[6]=cfg.after[1].z;after_count[7]=cfg.after[1].w;
  after_count[8]=(count+63u)/64u;after_count[9]=1u;after_count[10]=1u;after_count[11]=0u;`}
}`,O=Object.fromEntries([`check`,`restore_rows`,`restore_count`].map(r=>{let i=t(n,{code:D,entryPoint:r,label:`ulg-chain-history-${r}`,cacheKey:`ulg-chain-history-v2-${r}-${!!l}-${!!p}-${f}`,bindings:v.map((t,n)=>e(n,t))}),a=n.createBindGroup({layout:i.bindGroupLayout,entries:y.map((e,t)=>({binding:t,resource:e}))});return[r,(e,t)=>{let n=e.beginComputePass();n.setPipeline(i.pipeline),n.setBindGroup(0,a),n.dispatchWorkgroups(t),n.end()}]}));return Object.freeze({check(e){d(),x&&e.copyBufferToBuffer(l.controlBuffer,l.controlOffsetBytes,x,0,48),O.check(e,Math.ceil(g/64))},restore(e){d(),O.restore_rows(e,Math.ceil(g/64)),O.restore_count(e,1)}})}function C({device:r,capture:i,original:a,candidate:c,refreshValidationBuffer:m,thermalValidationBuffer:h=m,originalQuantities:b=null,candidateQuantities:C=null,originalEnergy:w=null,candidateEnergy:T=null,originalMassRead:E=null,candidateMassRead:D=null,phaseValidationBuffer:O=null,phaseLineageCount:k=0,phasePredecessorMassRead:A=E,phaseCandidateMassRead:j=D,refinementValidationBuffer:M=null,reactionValidationBuffer:N=null,sourceHistoryRead:ee=null,candidateHistory:te=null,parcelRecord:P=null,wallRecord:F=null,lineageRecord:I=null,sourceResidualHistory:ne=null,emittedResidualLedger:re=null,residualSourceControlBuffer:L=null,clockOrigin:R,sourceClock:ie=null}){i.validate();let z=[],B=(e,t,n)=>{let i=o(r.createBuffer({label:e,size:t,usage:n}),r);return z.push(i),i},V=null,H=null,U=()=>{H?.destroy(),V?.destroy();for(let e of z.splice(0))e.destroy()};try{let o=B(`ulg-chain-closure-control`,128,140),z=S({device:r,sourceRead:ee,candidate:te,controlBuffer:o,allocate:B});if(H=n({device:r,source:ne,emitted:re,controlBuffer:o}),!R)throw TypeError(`Chain closure requires its original source clock`);V=y({device:r,source:ie,...R,dt:i.dt,controlBuffer:o});let W=B(`ulg-chain-closure-params`,48,72),G=[`stateBuffer`,`thermoBuffer`,`mechanicsBuffer`].map(e=>[a[e],c[e]]);if(I&&(_(I,r),G.push([I.beforeBuffer,I.buffer])),F){if(v(F,r),!T||F.particleCount!==i.particleCount)throw TypeError(`Finite wall closure requires its matching canonical carrier energy`);G.push([F.originalBuffer,F.buffer])}if(b||C){if(!b||!C)throw TypeError(`Chain closure lost exact quantities`);G.push([b.quantityBuffer,C.quantityBuffer])}if(P){if(!P.validationBuffer||!T||!D||P.carrierMassRead!==D||P.exactEnergy!==T||P.originalParcels.count!==P.parcels.count||P.parcels.count<1||P.parcels.device!==r)throw TypeError(`Chain parcel closure requires its complete captured successor`);for(let e of[`paramsBuffer`,`ledgerBuffer`,`sinkBuffer`]){if(P.originalParcels[e]===P.parcels[e])throw TypeError(`Chain parcel candidate aliases its accepted source`);G.push([P.originalParcels[e],P.parcels[e]])}}let K=0;if(w||T){if(b||C||!w||!T)throw TypeError(`Chain closure requires one complete exact energy representation`);for(let e of[w,T])if(e.rowCount!==i.particleCount||e.format?.wordCount!==d||e.format?.quantumExponent!==u.quantumExponent||e.energyBuffer?.size!==4*l(i.particleCount))throw TypeError(`Chain closure requires aligned canonical energy records`);K=2*i.particleCount*d,h=T.energyBuffer,G.push([w.energyBuffer,T.energyBuffer])}let q=!!(D&&D===E&&!O&&!N&&!M&&!P&&k===0),J=()=>{if(!D&&!E&&!O&&!N&&!M&&k===0)return;let e=O&&O.size>=64&&Number.isSafeInteger(k)&&k>0&&k*4===i.particleCount;if(!T||!e&&!N&&!q||N&&N.size<32||M&&(!e||M.size<32)||(O||k!==0)&&!e||!q&&D?.buffer===E?.buffer||![E,D,...e?[A,j]:[]].every(e=>f(e,{device:r,family:e?.family,expectedGeneration:e?.generation,rowCount:i.particleCount,format:T.format})))throw TypeError(`Chain reaction/phase closure requires genuine aligned successor mass and validation`)};J(),r.queue.writeBuffer(W,0,new Uint32Array([i.particleCount,i.levelCount,K,+!!T,D?.byteOffset/4||0,A?.byteOffset/4||0,k,+!!D,j?.byteOffset/4||0,0,0,0]));for(let[e,t]of G)if(!e||!t||e.size!==t.size||Math.ceil(t.size/256)>r.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain closure requires aligned bounded output families`);let Y=`
${s(u)}
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
}`,X=[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`uniform`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`],Z=[i.controlBuffer,m,h,c.stateBuffer,c.thermoBuffer,c.mechanicsBuffer,o,W,a.stateBuffer,w?.energyBuffer??m,D?.buffer??m,A?.buffer??m,O??m],Q=(n,i,a,o,s)=>{let c=t(r,{code:n,entryPoint:i,cacheKey:`ulg-chain-closure-v6-refinement-${s}`,label:`ulg-chain-closure-${i}`,bindings:a.map((t,n)=>e(n,t))}),l=r.createBindGroup({layout:c.bindGroupLayout,entries:o.map((e,t)=>({binding:t,resource:{buffer:e}}))});return(e,t)=>{let n=e.beginComputePass();n.setPipeline(c.pipeline),n.setBindGroup(0,l),n.dispatchWorkgroups(t),n.end()}},ae=Q(Y,`check`,X,Z,`check`),oe=Q(Y,`finalize`,X,Z,`finalize`),se=k?Q(`
${s(u)}
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
}`,`check`,[`read-only-storage`,`read-only-storage`,`storage`,`uniform`],[A.buffer,j.buffer,o,W],`phase-mass`):null,ce=M?Q(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  for(var w=0u;w<8u;w++) {atomicStore(&control[23u+w],evidence[w]);}
  if(evidence[0]!=0u || evidence[5]!=0u) {atomicOr(&control[2],8192u);}
}`,`check`,[`read-only-storage`,`storage`],[M,o],`refinement`):null,le=P?Q(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  atomicStore(&control[31],evidence[2]);
  if(evidence[0]!=0x50435231u || evidence[1]!=1u || evidence[2]!=0u
    || evidence[3]!=${P.parcels.count}u || evidence[7]!=1u) {atomicOr(&control[2],16384u);}
}`,`check`,[`read-only-storage`,`storage`],[P.validationBuffer,o],`parcels-${P.parcels.count}`):null,ue=F?Q(p(),`check`,[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`],[F.originalBuffer,F.buffer,F.deltaBuffer,F.validationBuffer,o],`finite-walls-v1`):null,de=I?Q(g(),`check`,[`read-only-storage`,`read-only-storage`,`storage`],[I.beforeBuffer,I.buffer,o],`reaction-lineage-v1`):null,fe=w&&T&&E&&D?x({device:r,allocate:B,controlBuffer:o,originalMassRead:E,candidateMassRead:D,originalEnergy:w,candidateEnergy:T,reactionValidationBuffer:N,residualHistory:H?.record??null,originalParcels:P?.originalParcels,candidateParcels:P?.parcels}):null,$=`
@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<storage, read> control: array<u32>;
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x<arrayLength(&output) && control[2]!=0u) { output[id.x]=source[id.x]; }
}`,pe=G.filter(([e,t])=>e!==t).map(([e,t])=>({words:t.size/4,run:Q($,`restore`,[`read-only-storage`,`storage`,`read-only-storage`],[e,t,o],`restore`)}));if(D&&!q){let e=B(`ulg-chain-closure-mass-restore`,16,72);if(r.queue.writeBuffer(e,0,new Uint32Array([E.byteOffset/4,D.byteOffset/4,D.byteLength/4,0])),Math.ceil(D.byteLength/256)>r.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain phase mass restoration exceeds dispatch capacity`);let t=$.replace(`@compute @workgroup_size(64)`,`@group(0) @binding(3) var<uniform> offsets:vec4<u32>;
@compute @workgroup_size(64)`).replace(`id.x<arrayLength(&output)`,`id.x<offsets.z`).replace(`output[id.x]=source[id.x]`,`output[offsets.y+id.x]=source[offsets.x+id.x]`);pe.push({words:D.byteLength/4,run:Q(t,`restore`,[`read-only-storage`,`storage`,`read-only-storage`,`uniform`],[E.buffer,D.buffer,o,e],`restore-mass`)})}let me=L?Q(`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){
 if(source[0]!=0x524d5331u || source[1]!=1u || source[2]!=0u){atomicOr(&control[2],4194304u);}
}`,`check`,[`read-only-storage`,`storage`],[L,o],`residual-source`):null;return{controlBuffer:o,clock:V.clock,transferClock:V.transfer,destroy:U,residualHistory:H?.record??null,transferResidualHistory:H?.transfer??null,encode(e){i.validate(),J(),e.clearBuffer(o),H?.encode(e),ae(e,Math.ceil(i.particleCount/64)),me?.(e,1),se?.(e,Math.ceil(k/64)),ce?.(e,1),le?.(e,1),ue?.(e,6),I&&(_(I,r),de(e,Math.ceil(I.capacity/64))),fe?.(e),z?.check(e),H?.check(e),H?.requireEmptyForMechanics(e),V.check(e);for(let t of pe)t.run(e,Math.ceil(t.words/64));z?.restore(e),H?.restore(e),oe(e,1),V.advance(e)}}}catch(e){throw U(),e}}export{C as prepareSchroederSpatialChainClosure,x as t};