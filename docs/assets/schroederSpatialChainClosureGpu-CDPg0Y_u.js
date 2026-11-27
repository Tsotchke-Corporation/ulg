import{t as e}from"./sphExactMassWgsl-quqzAZyn.js";import{_ as t,c as n,n as r,o as i,s as a,v as o}from"./webgpuComputeLayout-DRom_Xd3.js";import{n as s,o as c,s as l,t as u}from"./sphReactionResidualHistoryGpu-D85Wl33x.js";import{i as d}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{_ as f,a as p,n as m,r as h}from"./sphExactThermalEnergyWgsl-CMfAhxBH.js";import{h as g}from"./sphExactMassInventoryGpu-baf32b_u.js";import{f as _,h as v,m as y,o as b}from"./sphResidentProductHistoryGpu-BwFKSpDS.js";import{r as x}from"./sphResidentClockGpu-2QAmznOI.js";import{n as S,r as C}from"./sphExactFiniteWallGpu-5KBa3qky.js";function w({device:t,history:r,allocate:o,controlBuffer:c}){let d=()=>l(r,t);d();let p=[],m=Math.max(r.capacity,r.beforeCapacity),h=null;do{let l=h===null,d=Math.ceil(m/64);if(d>t.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Residual inventory reduction exceeds dispatch capacity`);let g=o(`ulg-residual-inventory-reduction`,d*s.format.wordCount*16,128),_=o(`ulg-residual-inventory-identities`,48,72);t.queue.writeBuffer(_,0,new Uint32Array([m,r.beforeCapacity,r.capacity,+!!r.beforeBuffer,r.beforeGeneration,r.beforeSeal,r.generation,r.seal,0,0,0,0]));let v=n(t,{code:`
${e(s.format)}
${f(s.format)}
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
    return after[0]==0x50484731u && after[1]==${s.version}u && after[2]==1u && after[3]<=cfg.shape.z
      && after[4]==cfg.shape.z && after[5]==${s.rowWords/4}u && after[6]==cfg.identity.z && after[7]==cfg.identity.w
      && after[8]==(after[3]+63u)/64u && after[9]==1u && after[10]==1u && after[11]==0u;
  }
  return before[0]==0x50484731u && before[1]==${s.version}u && before[2]==1u && before[3]<=cfg.shape.y
    && before[4]==cfg.shape.y && before[5]==${s.rowWords/4}u && before[6]==cfg.identity.x && before[7]==cfg.identity.y
    && before[8]==(before[3]+63u)/64u && before[9]==1u && before[10]==1u && before[11]==0u;
}
@compute @workgroup_size(64) fn reduce(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>) {
  var m0=ExactMass();var m1=ExactMass();var e0=ExactMass();var e1=ExactMass();
  if(${l} && id.x==0u) {
    if(!header_valid(true) || (cfg.shape.w!=0u && !header_valid(false))) {
      atomicOr(&control[2],${u}u);
    }
  }
  if(id.x<cfg.shape.x) {
    if(${l}) {
      var s0=ExactMass();var s1=ExactMass();
      let base=${s.headerWords}u+id.x*${s.rowWords}u;
      for(var w=0u;w<EM_WORDS;w++) {
        if(cfg.shape.w!=0u && id.x<min(before[3],cfg.shape.y)) {
          m0.words[w]=before[base+${s.massOffset}u+w];
          e0.words[w]=before[base+${s.energyOffset}u+w];
          s0.words[w]=before[base+${s.sourceOffset}u+w];
        }
        if(id.x<min(after[3],cfg.shape.z)) {
          m1.words[w]=after[base+${s.massOffset}u+w];
          e1.words[w]=after[base+${s.energyOffset}u+w];
          s1.words[w]=after[base+${s.sourceOffset}u+w];
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
}`,entryPoint:`reduce`,cacheKey:`ulg-residual-inventory-v${s.version}-${l}`,label:`ulg-residual-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`].map((e,t)=>i(t,e))}),y=[l?r.beforeBuffer??r.buffer:h,l?r.buffer:h,g,c,_],b=a(t,{layout:v.bindGroupLayout,entries:y.map((e,t)=>({binding:t,resource:{buffer:e}}))});p.push({pipeline:v.pipeline,group:b,groups:d}),h=g,m=d}while(m>1);return{buffer:h,encode(e){d();for(let t of p){let n=e.beginComputePass({label:`ulg-residual-inventory`});n.setPipeline(t.pipeline),n.setBindGroup(0,t.group),n.dispatchWorkgroups(t.groups),n.end()}}}}function T({device:t,allocate:r,controlBuffer:o,originalMassRead:s,candidateMassRead:c,originalEnergy:l,candidateEnergy:u,reactionValidationBuffer:d=null,originalParcels:p=null,candidateParcels:h=null,residualHistory:g=null}){let _=c.rowCount,v=[],y=h?.count??0,b=g?w({device:t,history:g,allocate:r,controlBuffer:o}):null,x=_+(y?y+1:0),S=null;do{let g=S===null,C=Math.ceil(x/64);if(C>t.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain inventory reduction exceeds dispatch capacity`);let w=r(`ulg-chain-inventory-reduction`,C*m.wordCount*16,128),T=r(`ulg-chain-inventory-params`,32,72);t.queue.writeBuffer(T,0,new Uint32Array([x,_,s.byteOffset/4,c.byteOffset/4,y,0,0,0]));let E=n(t,{code:`
${e(m)}
${f(m)}
@group(0) @binding(0) var<storage,read> before_mass:array<u32>;
@group(0) @binding(1) var<storage,read> after_mass:array<u32>;
@group(0) @binding(2) var<storage,read> before_energy:array<u32>;
@group(0) @binding(3) var<storage,read> after_energy:array<u32>;
@group(0) @binding(4) var<storage,read_write> out:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
struct Params { counts:vec4<u32>, parcels:vec4<u32> };
@group(0) @binding(6) var<uniform> params:Params;
${y?`@group(0) @binding(8) var<storage,read> before_parcels:array<u32>;
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
    if(${g}) {
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
      } ${y?`else {
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
      if(${!!d}) {
      atomicStore(&control[17],reaction[2]);atomicStore(&control[18],reaction[3]);
      for(var w=4u;w<8u;w++) {atomicStore(&control[15u+w],reaction[w]);}
      if(reaction[0]!=0x524c4731u || reaction[1]!=1u || reaction[2]!=1u) {atomicOr(&control[2],4096u);}
      }
      if(${!b}) {
        if(em_compare(bm[0],am[0])!=0) {atomicOr(&control[2],1024u);}
        if(el_compare(be[0],ae[0])!=0) {atomicOr(&control[2],2048u);}
      }
    }
  }
}`,entryPoint:`reduce`,cacheKey:`ulg-chain-inventory-v4-history-${g}-${!!d}-${!!y}-${!!b}`,label:`ulg-chain-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`,`read-only-storage`,...y?[,,,,].fill(`read-only-storage`):[]].map((e,t)=>i(t,e))}),D=[g?s.buffer:S,g?c.buffer:S,g?l.energyBuffer:S,g?u.energyBuffer:S,w,o,T,d??c.buffer,...y?[p.ledgerBuffer,h.ledgerBuffer,p.sinkBuffer,h.sinkBuffer]:[]],O=a(t,{layout:E.bindGroupLayout,entries:D.map((e,t)=>({binding:t,resource:{buffer:e}}))});v.push({pipeline:E.pipeline,bindGroup:O,groups:C}),S=w,x=C}while(x>1);if(b){let r=n(t,{code:`
${e(m)}
${f(m)}
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
}`,entryPoint:`compare`,cacheKey:`ulg-chain-inventory-history-compare-v1`,label:`ulg-chain-complete-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`storage`].map((e,t)=>i(t,e))}),s=a(t,{layout:r.bindGroupLayout,entries:[S,b.buffer,o].map((e,t)=>({binding:t,resource:{buffer:e}}))});v.push({pipeline:r.pipeline,bindGroup:s,groups:1})}return e=>{b?.encode(e);for(let t of v){let n=e.beginComputePass({label:`ulg-chain-inventory`});n.setPipeline(t.pipeline),n.setBindGroup(0,t.bindGroup),n.dispatchWorkgroups(t.groups),n.end()}}}function E({device:e,sourceRead:t=null,candidate:r=null,controlBuffer:o,allocate:s}){if(!r){if(t)throw TypeError(`Chain cannot discard retained product history`);return null}let c=r.productEventBuffer,l=b(r,e),u=t?.descriptor??null,d=t?.buffer??null,f=()=>{if(t?.validate(),!l||!_(l,{handle:r,device:e})||r.productEventBuffer!==c||[u,l].filter(Boolean).some(e=>e.rowStrideFloats!==32)||l.rowCapacity*128>c.size||u&&(u.rowCapacity*128>d.size||u.rowCapacity>l.rowCapacity))throw TypeError(`Canonical reaction history requires genuine bounded legacy count owners`)};f();let p=d===c,m=u&&u.controlBuffer===l.controlBuffer&&u.controlOffsetBytes===l.controlOffsetBytes;if(m&&!p)throw TypeError(`History count cannot name different storage`);let h=Math.max(1,l.rowCapacity);if(Math.ceil(h/64)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Reaction history exceeds admission dispatch capacity`);let g=[],v=[],y=[],x=(e,t,n,r=`array<u32>`)=>{g.push(`@group(0) @binding(${v.length}) var<${t===`uniform`?`uniform`:`storage,${t===`storage`?`read_write`:`read`}`}> ${e}:${r};`),v.push(t),y.push(n)};x(`history`,`storage`,{buffer:c}),x(`after_count`,`storage`,{buffer:l.controlBuffer,offset:l.controlOffsetBytes,size:48}),x(`control`,`storage`,{buffer:o},`array<atomic<u32>>`);let S=u&&!m?s(`ulg-chain-history-source-count`,48,140):null;u&&!m&&x(`before_count`,`read-only-storage`,{buffer:S}),d&&!p&&x(`source`,`read-only-storage`,{buffer:d});let C=s(`ulg-chain-history-identities`,64,72),w=e=>e?[e.expectedMagic,e.expectedVersion,e.expectedReadyStatus,0,e.rowCapacity,e.expectedRowStrideVec4,e.expectedGeneration,e.expectedSeal]:Array(8).fill(0);e.queue.writeBuffer(C,0,new Uint32Array([...w(u),...w(l)])),x(`cfg`,`uniform`,{buffer:C},`Expected`);let T=m?`after_count`:`before_count`,E=p?`history`:`source`,D=(e,t)=>`${e}[0]==cfg.${t}[0].x && ${e}[1]==cfg.${t}[0].y
    && ${e}[2]==cfg.${t}[0].z && ${e}[3]<=cfg.${t}[1].x
    && ${e}[4]==cfg.${t}[1].x && ${e}[5]==cfg.${t}[1].y
    && ${e}[6]==cfg.${t}[1].z && ${e}[7]==cfg.${t}[1].w
    && ${e}[8]==(${e}[3]+63u)/64u && ${e}[9]==1u && ${e}[10]==1u && ${e}[11]==0u`,O=`struct Expected { before:array<vec4<u32>,2>, after:array<vec4<u32>,2> };
${g.join(`
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
  ${m?`return;`:`if(row<source_count()) {
    ${p?`// The genuine tail-append producer retains the predecessor prefix.`:d?`for(var w=0u;w<32u;w++) {history[row*32u+w]=source[row*32u+w];}`:``}
  } else {for(var w=0u;w<32u;w++) {history[row*32u+w]=0u;}}`}
}
@compute @workgroup_size(1) fn restore_count() {
  if(atomicLoad(&control[2])==0u) {return;}
  ${m?`return;`:`let count=source_count();
  after_count[0]=cfg.after[0].x;after_count[1]=cfg.after[0].y;
  after_count[2]=cfg.after[0].z;after_count[3]=count;
  after_count[4]=cfg.after[1].x;after_count[5]=cfg.after[1].y;
  after_count[6]=cfg.after[1].z;after_count[7]=cfg.after[1].w;
  after_count[8]=(count+63u)/64u;after_count[9]=1u;after_count[10]=1u;after_count[11]=0u;`}
}`,k=Object.fromEntries([`check`,`restore_rows`,`restore_count`].map(t=>{let r=n(e,{code:O,entryPoint:t,label:`ulg-chain-history-${t}`,cacheKey:`ulg-chain-history-v2-${t}-${!!u}-${!!m}-${p}`,bindings:v.map((e,t)=>i(t,e))}),o=a(e,{layout:r.bindGroupLayout,entries:y.map((e,t)=>({binding:t,resource:e}))});return[t,(e,t)=>{let n=e.beginComputePass();n.setPipeline(r.pipeline),n.setBindGroup(0,o),n.dispatchWorkgroups(t),n.end()}]}));return Object.freeze({check(e){f(),S&&e.copyBufferToBuffer(u.controlBuffer,u.controlOffsetBytes,S,0,48),k.check(e,Math.ceil(h/64))},restore(e){f(),k.restore_rows(e,Math.ceil(h/64)),k.restore_count(e,1)}})}function D({device:s,capture:l,original:u,candidate:f,refreshValidationBuffer:_,thermalValidationBuffer:b=_,originalQuantities:w=null,candidateQuantities:D=null,originalEnergy:O=null,candidateEnergy:k=null,originalMassRead:A=null,candidateMassRead:j=null,phaseValidationBuffer:M=null,phaseLineageCount:N=0,phasePredecessorMassRead:P=A,phaseCandidateMassRead:F=j,refinementValidationBuffer:I=null,reactionValidationBuffer:L=null,sourceHistoryRead:ee=null,candidateHistory:te=null,parcelRecord:R=null,wallRecord:z=null,lineageRecord:B=null,sourceResidualHistory:ne=null,emittedResidualLedger:re=null,residualSourceControlBuffer:V=null,clockOrigin:H,sourceClock:ie=null}){l.validate();let U=typeof globalThis.GPUDevice==`function`&&s instanceof globalThis.GPUDevice,W=[],G=(e,n,i)=>{let a=d(U?t(r(s,{bucketKey:e,label:e,size:n,usage:i}),s,{bucketKey:e,size:n,usage:i}):s.createBuffer({label:e,size:n,usage:i}),s);return W.push(a),a},K=null,q=null,J=()=>{q?.destroy(),K?.destroy();for(let e of W.splice(0))o(e)};try{let t=G(`ulg-chain-closure-control`,128,140),r=E({device:s,sourceRead:ee,candidate:te,controlBuffer:t,allocate:G});if(q=c({device:s,source:ne,emitted:re,controlBuffer:t}),!H)throw TypeError(`Chain closure requires its original source clock`);K=x({device:s,source:ie,...H,dt:l.dt,controlBuffer:t});let o=G(`ulg-chain-closure-params`,48,72),d=[`stateBuffer`,`thermoBuffer`,`mechanicsBuffer`].map(e=>[u[e],f[e]]);if(B&&(v(B,s),d.push([B.beforeBuffer,B.buffer])),z){if(C(z,s),!k||z.particleCount!==l.particleCount)throw TypeError(`Finite wall closure requires its matching canonical carrier energy`);d.push([z.originalBuffer,z.buffer])}if(w||D){if(!w||!D)throw TypeError(`Chain closure lost exact quantities`);d.push([w.quantityBuffer,D.quantityBuffer])}if(R){if(!R.validationBuffer||!k||!j||R.carrierMassRead!==j||R.exactEnergy!==k||R.originalParcels.count!==R.parcels.count||R.parcels.count<1||R.parcels.device!==s)throw TypeError(`Chain parcel closure requires its complete captured successor`);for(let e of[`paramsBuffer`,`ledgerBuffer`,`sinkBuffer`]){if(R.originalParcels[e]===R.parcels[e])throw TypeError(`Chain parcel candidate aliases its accepted source`);d.push([R.originalParcels[e],R.parcels[e]])}}let U=0;if(O||k){if(w||D||!O||!k)throw TypeError(`Chain closure requires one complete exact energy representation`);for(let e of[O,k])if(e.rowCount!==l.particleCount||e.format?.wordCount!==h||e.format?.quantumExponent!==m.quantumExponent||e.energyBuffer?.size!==4*p(l.particleCount))throw TypeError(`Chain closure requires aligned canonical energy records`);U=2*l.particleCount*h,b=k.energyBuffer,d.push([O.energyBuffer,k.energyBuffer])}let W=!!(j&&j===A&&!M&&!L&&!I&&!R&&N===0),Y=()=>{if(!j&&!A&&!M&&!L&&!I&&N===0)return;let e=M&&M.size>=64&&Number.isSafeInteger(N)&&N>0&&N*4===l.particleCount;if(!k||!e&&!L&&!W||L&&L.size<32||I&&(!e||I.size<32)||(M||N!==0)&&!e||!W&&j?.buffer===A?.buffer||![A,j,...e?[P,F]:[]].every(e=>g(e,{device:s,family:e?.family,expectedGeneration:e?.generation,rowCount:l.particleCount,format:k.format})))throw TypeError(`Chain reaction/phase closure requires genuine aligned successor mass and validation`)};Y(),s.queue.writeBuffer(o,0,new Uint32Array([l.particleCount,l.levelCount,U,+!!k,j?.byteOffset/4||0,P?.byteOffset/4||0,N,+!!j,F?.byteOffset/4||0,0,0,0]));for(let[e,t]of d)if(!e||!t||e.size!==t.size||Math.ceil(t.size/256)>s.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain closure requires aligned bounded output families`);let X=`
${e(m)}
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
}`,Z=[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`uniform`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`],Q=[l.controlBuffer,_,b,f.stateBuffer,f.thermoBuffer,f.mechanicsBuffer,t,o,u.stateBuffer,O?.energyBuffer??_,j?.buffer??_,P?.buffer??_,M??_],$=(e,t,r,o,c)=>{let l=n(s,{code:e,entryPoint:t,cacheKey:`ulg-chain-closure-v6-refinement-${c}`,label:`ulg-chain-closure-${t}`,bindings:r.map((e,t)=>i(t,e))}),u=a(s,{layout:l.bindGroupLayout,entries:o.map((e,t)=>({binding:t,resource:{buffer:e}}))});return(e,t)=>{let n=e.beginComputePass();n.setPipeline(l.pipeline),n.setBindGroup(0,u),n.dispatchWorkgroups(t),n.end()}},ae=$(X,`check`,Z,Q,`check`),oe=$(X,`finalize`,Z,Q,`finalize`),se=N?$(`
${e(m)}
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
}`,`check`,[`read-only-storage`,`read-only-storage`,`storage`,`uniform`],[P.buffer,F.buffer,t,o],`phase-mass`):null,ce=I?$(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  for(var w=0u;w<8u;w++) {atomicStore(&control[23u+w],evidence[w]);}
  if(evidence[0]!=0u || evidence[5]!=0u) {atomicOr(&control[2],8192u);}
}`,`check`,[`read-only-storage`,`storage`],[I,t],`refinement`):null,le=R?$(`
@group(0) @binding(0) var<storage,read> evidence:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check() {
  atomicStore(&control[31],evidence[2]);
  if(evidence[0]!=0x50435231u || evidence[1]!=1u || evidence[2]!=0u
    || evidence[3]!=${R.parcels.count}u || evidence[7]!=1u) {atomicOr(&control[2],16384u);}
}`,`check`,[`read-only-storage`,`storage`],[R.validationBuffer,t],`parcels-${R.parcels.count}`):null,ue=z?$(S(),`check`,[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`],[z.originalBuffer,z.buffer,z.deltaBuffer,z.validationBuffer,t],`finite-walls-v1`):null,de=B?$(y(),`check`,[`read-only-storage`,`read-only-storage`,`storage`],[B.beforeBuffer,B.buffer,t],`reaction-lineage-v1`):null,fe=O&&k&&A&&j?T({device:s,allocate:G,controlBuffer:t,originalMassRead:A,candidateMassRead:j,originalEnergy:O,candidateEnergy:k,reactionValidationBuffer:L,residualHistory:q?.record??null,originalParcels:R?.originalParcels,candidateParcels:R?.parcels}):null,pe=`
@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<storage, read> control: array<u32>;
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x<arrayLength(&output) && control[2]!=0u) { output[id.x]=source[id.x]; }
}`,me=d.filter(([e,t])=>e!==t).map(([e,n])=>({words:n.size/4,run:$(pe,`restore`,[`read-only-storage`,`storage`,`read-only-storage`],[e,n,t],`restore`)}));if(j&&!W){let e=G(`ulg-chain-closure-mass-restore`,16,72);if(s.queue.writeBuffer(e,0,new Uint32Array([A.byteOffset/4,j.byteOffset/4,j.byteLength/4,0])),Math.ceil(j.byteLength/256)>s.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain phase mass restoration exceeds dispatch capacity`);let n=pe.replace(`@compute @workgroup_size(64)`,`@group(0) @binding(3) var<uniform> offsets:vec4<u32>;
@compute @workgroup_size(64)`).replace(`id.x<arrayLength(&output)`,`id.x<offsets.z`).replace(`output[id.x]=source[id.x]`,`output[offsets.y+id.x]=source[offsets.x+id.x]`);me.push({words:j.byteLength/4,run:$(n,`restore`,[`read-only-storage`,`storage`,`read-only-storage`,`uniform`],[A.buffer,j.buffer,t,e],`restore-mass`)})}let he=V?$(`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(){
 if(source[0]!=0x524d5331u || source[1]!=1u || source[2]!=0u){atomicOr(&control[2],4194304u);}
}`,`check`,[`read-only-storage`,`storage`],[V,t],`residual-source`):null;return{controlBuffer:t,clock:K.clock,transferClock:K.transfer,destroy:J,residualHistory:q?.record??null,transferResidualHistory:q?.transfer??null,encode(e){l.validate(),Y(),e.clearBuffer(t),q?.encode(e),ae(e,Math.ceil(l.particleCount/64)),he?.(e,1),se?.(e,Math.ceil(N/64)),ce?.(e,1),le?.(e,1),ue?.(e,6),B&&(v(B,s),de(e,Math.ceil(B.capacity/64))),fe?.(e),r?.check(e),q?.check(e),q?.requireEmptyForMechanics(e),K.check(e);for(let t of me)t.run(e,Math.ceil(t.words/64));r?.restore(e),q?.restore(e),oe(e,1),K.advance(e)}}}catch(e){throw J(),e}}export{D as prepareSchroederSpatialChainClosure,T as t};