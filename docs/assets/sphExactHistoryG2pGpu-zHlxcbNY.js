import{Fh as e}from"./eshkolTriadClosures-2aA1ll1H.js";import{Us as t,Ws as n,hi as r,pt as i,ta as a}from"./sphGpuBuffers-C0RtBOv4.js";import{computeBufferBinding as o,prewarmCachedExplicitComputePipeline as s}from"../runtime/webgpuComputeLayout.js";import{prepareSphExactG2pNumericQuantities as c}from"./sphExactG2pQuantityGpu-CE_84tTQ.js";async function l({device:l,source:u,allocate:d,gridBuffer:f,paramsData:p}){u.validate();let m=u.layout,h=u.descriptor,g=h.rowCapacity,_=await r({device:l,source:u,allocate:d}),v=(e,t,n=140)=>d({label:`ulg-exact-history-g2p-${e}`,size:t,usage:n}),y=v(`old-state`,g*32),b=v(`thermo`,g*48),x=v(`old-mechanics`,g*128),S=v(`new-state`,g*32),C=v(`new-mechanics`,g*128),w=v(`candidate`,g*m.rowBytes),T=v(`selected`,g*m.rowBytes),E=v(`params`,p.byteLength,72);l.queue.writeBuffer(E,0,p);let D=Object.freeze({headerWords:16,massWordCount:m.massWordCount,massOffsetWords:16,scalarOffsetWords:16+m.massWordCount,scalar:n({wordCount:m.rationalWordCount}),rowCount:g,recordWords:m.quantityWords,wordLength:g*m.quantityWords,fields:i}),O=await c({device:l,quantityBuffer:_.quantityBuffer,quantityLayout:D,format:m.format,particleCount:g,allocate:d,validate:u.validate,markDerivedBuffers:u.markDerivedBuffers,indirectDispatch:{buffer:_.dispatchBuffer,rowOffset:0,projectionOffset:12}});await u.markDerivedBuffers([y,b,x,S,C,w,T]),u.validate();let k=async(e,t,n)=>{let r=await s(l,{code:e,entryPoint:t,cacheKey:`exact-history-g2p-v1:${m.massWordCount}:${m.format.quantumExponent}:${m.rationalWordCount}:${m.rowWords}:${g}`,label:`ulg-${t}`,bindings:n.map((e,t)=>o(t,e))});if(!r.pipeline)throw r.error??Error(`Exact history G2P pipeline unavailable: ${t}`);return u.validate(),r},A=`read-only-storage`,j=`storage`,M=await k(`
@group(0) @binding(0) var<storage,read> packed:array<u32>;
@group(0) @binding(1) var<storage,read_write> state:array<u32>;
@group(0) @binding(2) var<storage,read_write> thermo:array<u32>;
@group(0) @binding(3) var<storage,read_write> mechanics:array<u32>;
@group(0) @binding(4) var<storage,read> live:array<u32>;
@group(0) @binding(5) var<storage,read> validation:array<u32>;
@compute @workgroup_size(32)
fn split_history_mechanics(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${g}u||row>=live[3u]||validation[0u]!=0u){return;}
  for(var i=0u;i<8u;i++){state[row*8u+i]=packed[row*52u+i];}
  for(var i=0u;i<12u;i++){thermo[row*12u+i]=packed[row*52u+8u+i];}
  for(var i=0u;i<32u;i++){mechanics[row*32u+i]=packed[row*52u+20u+i];}
}`,`split_history_mechanics`,[A,j,j,j,A,A]),N=`if (particle_index >= params.particle_count) {`;if(e.split(N).length!==2)throw Error(`Original G2P row guard changed`);let P=await k(e.replace(N,`if (particle_index >= params.particle_count || particle_index >= history_count[3u] || history_validation[0u] != 0u) {`)+`
@group(0) @binding(8) var<storage,read> history_count:array<u32>;
@group(0) @binding(9) var<storage,read> history_validation:array<u32>;
`,`main`,[A,A,A,A,j,j,`uniform`,A,A,A]),F=await k(t({wordCount:m.rationalWordCount})+`
@group(0) @binding(0) var<storage,read> original:array<u32>;
@group(0) @binding(1) var<storage,read> packed:array<u32>;
@group(0) @binding(2) var<storage,read> state:array<u32>;
@group(0) @binding(3) var<storage,read> mechanics:array<u32>;
@group(0) @binding(4) var<storage,read> quantities:array<u32>;
@group(0) @binding(5) var<storage,read_write> candidate:array<u32>;
@group(0) @binding(6) var<storage,read_write> validation:array<atomic<u32>>;
@group(0) @binding(7) var<storage,read> quantity_validation:array<u32>;
@group(0) @binding(8) var<storage,read> live:array<u32>;
${a(m,`candidate`)}
fn history_quantity(row:u32,field:u32)->ExactRational {
  let at=row*${m.quantityWords}u+${16+m.massWordCount}u+field*${m.scalarWords}u;var v:ExactRational;
  v.negative=quantities[at];v.error=quantities[at+1u];v.exponent=bitcast<i32>(quantities[at+2u]);v.reserved=quantities[at+3u];
  for(var i=0u;i<XR_WORDS;i++){v.numerator[i]=quantities[at+4u+i];v.denominator[i]=quantities[at+4u+XR_WORDS+i];}return v;
}
@compute @workgroup_size(32)
fn pack_history_g2p_candidate(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${g}u){return;}
  if(quantity_validation[0u]!=0u){atomicOr(&validation[0u],16u);return;}
  if(row>=live[3u]||atomicLoad(&validation[0u])!=0u){return;}
  let base=row*${m.rowWords}u;
  for(var i=0u;i<${m.rowWords}u;i++){candidate[base+i]=original[base+i];}
  for(var i=0u;i<${m.quantityWords}u;i++){candidate[base+${m.quantityOffsetWords}u+i]=quantities[row*${m.quantityWords}u+i];}
  for(var i=0u;i<52u;i++){candidate[base+${m.physicalOffsetWords}u+i]=packed[row*52u+i];}
  for(var i=0u;i<8u;i++){candidate[base+${m.stateOffsetWords}u+i]=state[row*8u+i];}
  for(var i=0u;i<32u;i++){candidate[base+${m.mechanicsOffsetWords}u+i]=mechanics[row*32u+i];}
  for(var i=0u;i<3u;i++){candidate[base+i]=state[row*8u+i];candidate[base+20u+i]=state[row*8u+4u+i];}
  candidate[base+19u]=state[row*8u+7u];
  var volume=history_quantity(row,5u);let volume_bits=xrp_project_f32_bits(&volume);
  var mass=xr_zero();mass.exponent=${m.format.quantumExponent}i;
  for(var i=0u;i<${m.massWordCount}u;i++){mass.numerator[i]=quantities[row*${m.quantityWords}u+16u+i];}
  var rest=history_quantity(row,4u);var density:ExactRational;xrp_rational_divide(&density,&mass,&rest);
  let density_bits=xrp_project_f32_bits(&density);
  if(volume_bits.error!=0u||density_bits.error!=0u||!(bitcast<f32>(volume_bits.bits)>0.0)
      ||!(bitcast<f32>(density_bits.bits)>0.0)) {atomicOr(&validation[0u],32u);return;}
  candidate[base+23u]=volume_bits.bits;candidate[base+17u]=density_bits.bits;
  candidate[base+${m.thermoOffsetWords+3}u]=density_bits.bits;
  if(!exact_history_valid(0u,row)){atomicOr(&validation[0u],64u);}
}`,`pack_history_g2p_candidate`,[A,A,A,A,A,j,j,A,A]),I=await k(`
@group(0) @binding(0) var<storage,read> original:array<u32>;
@group(0) @binding(1) var<storage,read> candidate:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
@group(0) @binding(3) var<storage,read> validation:array<u32>;
@compute @workgroup_size(64)
fn select_history_g2p(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${g}u){return;}
  for(var i=0u;i<${m.rowWords}u;i++){
    let at=row*${m.rowWords}u+i;output[at]=select(candidate[at],original[at],validation[0u]!=0u);
  }
}`,`select_history_g2p`,[A,A,j,A]),L={buffer:h.controlBuffer,offset:h.controlOffsetBytes,size:64},R=(e,t)=>l.createBindGroup({layout:e.bindGroupLayout,entries:t.map((e,t)=>({binding:t,resource:e===L?e:{buffer:e}}))}),z=R(M,[_.outputBuffer,y,b,x,L,_.validationBuffer]),B=R(P,[y,b,x,f,S,C,E,h.controlBuffer,L,_.validationBuffer]),V=R(F,[u.buffer,_.outputBuffer,S,C,O.quantityBuffer,w,_.validationBuffer,O.validationBuffer,L]),H=R(I,[u.buffer,w,T,_.validationBuffer]),U=(e,t,n,r)=>{let i=e.beginComputePass();i.setPipeline(t.pipeline),i.setBindGroup(0,n),r===null?i.dispatchWorkgroups(Math.ceil(g/64)):i.dispatchWorkgroupsIndirect(_.dispatchBuffer,r),i.end()};return Object.freeze({source:u,outputBuffer:T,validationBuffer:_.validationBuffer,quantityLayout:D,quantities:O,stateBuffer:y,thermoBuffer:b,mechanicsBuffer:x,outStateBuffer:S,outMechanicsBuffer:C,retainedBuffers:Object.freeze([T,_.validationBuffer,_.quantityBuffer,O.quantityBuffer,O.validationBuffer,O.projectionBuffer,y,b,x,S,C]),encodeCandidate(e){u.validate(),_.encode(e);for(let t of[y,b,x,S,C,w])e.clearBuffer(t);U(e,M,z,0),U(e,P,B,24),O.encode(e,{stateBuffer:y,mechanicsBuffer:x,outStateBuffer:S,outMechanicsBuffer:C}),U(e,F,V,0),u.validate()},encodeSelection(e){u.validate(),U(e,I,H,null)}})}export{l as prepareSphExactHistoryG2p};