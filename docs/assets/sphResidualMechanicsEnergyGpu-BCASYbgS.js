import{Os as e}from"./sphGpuBuffers-DN1yWzlv.js";import{computeBufferBinding as t,createCachedExplicitBindGroup as n,createCachedExplicitComputePipeline as r}from"../runtime/webgpuComputeLayout.js";import{i}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{resolveSchroederResidualMechanicsSourceRead as a}from"./schroederResidualMechanicsSourceGpu-Bsz-cJbg.js";function o({device:o,sourceRead:s}){let c=a(s,{device:o}),{source:l,carrierEnergy:u}=c,d=l.carrierCount,f=l.particleCount,p=e.format.wordCount;if(!u||u.rowCount!==d||u.format.wordCount!==p||u.format.quantumExponent!==e.format.quantumExponent)throw TypeError(`Residual thermal source requires aligned canonical carrier energy`);let m=(2*f*p+4)*4;if(m>o.limits.maxBufferSize||m>o.limits.maxStorageBufferBindingSize)throw RangeError(`Residual thermal energy exceeds GPU storage capacity`);let h=i(o.createBuffer({label:`ulg-residual-mechanics-energy`,size:m,usage:140}),o);try{let i=r(o,{entryPoint:`gather`,cacheKey:`ulg-residual-mechanics-energy-v2-${d}-${l.historyCapacity}-${l.phaseLayout?.lineageCount??0}`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`].map((e,n)=>t(n,e)),code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> carrier:array<u32>;
@group(0) @binding(2) var<storage,read> control:array<u32>;
@group(0) @binding(3) var<storage,read_write> energy:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${d+l.historyCapacity}u){return;}
 let dest=${l.phaseLayout?`select(${l.phaseLayout.carrierLineageCount}u+row-${d}u,
   (row/${l.phaseLayout.carrierLineageCount}u)*${l.phaseLayout.lineageCount}u+row%${l.phaseLayout.carrierLineageCount}u,row<${d}u)`:`row`};
 if(row==0u){
   for(var w=0u;w<4u;w++){energy[${2*f*p}u+w]=carrier[${2*d*p}u+w];}
   if(control[2]!=0u){energy[${2*f*p}u]|=16u;}
 }
 for(var w=0u;w<${p}u;w++){
   if(row<${d}u){energy[dest*${p}u+w]=carrier[row*${p}u+w];energy[(dest+${f}u)*${p}u+w]=carrier[(row+${d}u)*${p}u+w];}
   else if(row-${d}u<control[4] && control[2]==0u){
     let h=${e.headerWords}u+(row-${d}u)*${e.rowWords}u;
     energy[dest*${p}u+w]=history[h+${e.energyOffset}u+w];
     energy[(dest+${f}u)*${p}u+w]=history[h+${e.sourceOffset}u+w];
   }
 }
}`}),a=n(o,{layout:i.bindGroupLayout,entries:[l.history.buffer,u.energyBuffer,l.controlBuffer,h].map((e,t)=>({binding:t,resource:{buffer:e}}))}),s=o.createCommandEncoder(),m=s.beginComputePass();return m.setPipeline(i.pipeline),m.setBindGroup(0,a),m.dispatchWorkgroups(Math.ceil(f/64)),m.end(),c.validate(),o.queue.submit([s.finish()]),h}catch(e){throw h.destroy(),e}}export{o as createSphResidualMechanicsEnergyBuffer};