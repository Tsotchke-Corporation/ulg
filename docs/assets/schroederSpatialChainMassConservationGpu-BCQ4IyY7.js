import{g as e,h as t,m as n}from"./webgpuComputeLayout-CHUyeeFd.js";import{n as r,s as i,t as a}from"./sphReactionResidualHistoryGpu-BXqG2iUd.js";import{t as o}from"./sphExactMassWgsl-DwXztSAS.js";import{_ as s,n as c}from"./sphExactThermalEnergyWgsl-DAccym1I.js";function l({device:c,history:l,allocate:u,controlBuffer:d}){let f=()=>i(l,c);f();let p=[],m=Math.max(l.capacity,l.beforeCapacity),h=null;do{let i=h===null,f=Math.ceil(m/64);if(f>c.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Residual inventory reduction exceeds dispatch capacity`);let g=u(`ulg-residual-inventory-reduction`,f*r.format.wordCount*16,128),_=u(`ulg-residual-inventory-identities`,48,72);c.queue.writeBuffer(_,0,new Uint32Array([m,l.beforeCapacity,l.capacity,+!!l.beforeBuffer,l.beforeGeneration,l.beforeSeal,l.generation,l.seal,0,0,0,0]));let v=e(c,{code:`
${o(r.format)}
${s(r.format)}
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
}`,entryPoint:`reduce`,cacheKey:`ulg-residual-inventory-v${r.version}-${i}`,label:`ulg-residual-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`].map((e,t)=>n(t,e))}),y=[i?l.beforeBuffer??l.buffer:h,i?l.buffer:h,g,d,_],b=t(c,{layout:v.bindGroupLayout,entries:y.map((e,t)=>({binding:t,resource:{buffer:e}}))});p.push({pipeline:v.pipeline,group:b,groups:f}),h=g,m=f}while(m>1);return{buffer:h,encode(e){f();for(let t of p){let n=e.beginComputePass({label:`ulg-residual-inventory`});n.setPipeline(t.pipeline),n.setBindGroup(0,t.group),n.dispatchWorkgroups(t.groups),n.end()}}}}function u({device:r,allocate:i,controlBuffer:a,originalMassRead:u,candidateMassRead:d,originalEnergy:f,candidateEnergy:p,reactionValidationBuffer:m=null,originalParcels:h=null,candidateParcels:g=null,residualHistory:_=null}){let v=d.rowCount,y=[],b=g?.count??0,x=_?l({device:r,history:_,allocate:i,controlBuffer:a}):null,S=v+(b?b+1:0),C=null;do{let l=C===null,_=Math.ceil(S/64);if(_>r.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Chain inventory reduction exceeds dispatch capacity`);let w=i(`ulg-chain-inventory-reduction`,_*c.wordCount*16,128),T=i(`ulg-chain-inventory-params`,32,72);r.queue.writeBuffer(T,0,new Uint32Array([S,v,u.byteOffset/4,d.byteOffset/4,b,0,0,0]));let E=e(r,{code:`
${o(c)}
${s(c)}
@group(0) @binding(0) var<storage,read> before_mass:array<u32>;
@group(0) @binding(1) var<storage,read> after_mass:array<u32>;
@group(0) @binding(2) var<storage,read> before_energy:array<u32>;
@group(0) @binding(3) var<storage,read> after_energy:array<u32>;
@group(0) @binding(4) var<storage,read_write> out:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
struct Params { counts:vec4<u32>, parcels:vec4<u32> };
@group(0) @binding(6) var<uniform> params:Params;
${b?`@group(0) @binding(8) var<storage,read> before_parcels:array<u32>;
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
    if(${l}) {
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
      } ${b?`else {
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
      if(${!!m}) {
      atomicStore(&control[17],reaction[2]);atomicStore(&control[18],reaction[3]);
      for(var w=4u;w<8u;w++) {atomicStore(&control[15u+w],reaction[w]);}
      if(reaction[0]!=0x524c4731u || reaction[1]!=1u || reaction[2]!=1u) {atomicOr(&control[2],4096u);}
      }
      if(${!x}) {
        if(em_compare(bm[0],am[0])!=0) {atomicOr(&control[2],1024u);}
        if(el_compare(be[0],ae[0])!=0) {atomicOr(&control[2],2048u);}
      }
    }
  }
}`,entryPoint:`reduce`,cacheKey:`ulg-chain-inventory-v4-history-${l}-${!!m}-${!!b}-${!!x}`,label:`ulg-chain-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`,`read-only-storage`,...b?[,,,,].fill(`read-only-storage`):[]].map((e,t)=>n(t,e))}),D=[l?u.buffer:C,l?d.buffer:C,l?f.energyBuffer:C,l?p.energyBuffer:C,w,a,T,m??d.buffer,...b?[h.ledgerBuffer,g.ledgerBuffer,h.sinkBuffer,g.sinkBuffer]:[]],O=t(r,{layout:E.bindGroupLayout,entries:D.map((e,t)=>({binding:t,resource:{buffer:e}}))});y.push({pipeline:E.pipeline,bindGroup:O,groups:_}),C=w,S=_}while(S>1);if(x){let i=e(r,{code:`
${o(c)}
${s(c)}
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
}`,entryPoint:`compare`,cacheKey:`ulg-chain-inventory-history-compare-v1`,label:`ulg-chain-complete-inventory`,bindings:[`read-only-storage`,`read-only-storage`,`storage`].map((e,t)=>n(t,e))}),l=t(r,{layout:i.bindGroupLayout,entries:[C,x.buffer,a].map((e,t)=>({binding:t,resource:{buffer:e}}))});y.push({pipeline:i.pipeline,bindGroup:l,groups:1})}return e=>{x?.encode(e);for(let t of y){let n=e.beginComputePass({label:`ulg-chain-inventory`});n.setPipeline(t.pipeline),n.setBindGroup(0,t.bindGroup),n.dispatchWorkgroups(t.groups),n.end()}}}export{u as t};