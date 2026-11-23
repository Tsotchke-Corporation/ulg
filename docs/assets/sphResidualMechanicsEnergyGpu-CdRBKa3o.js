import{Dc as e}from"./sphGpuBuffers-C0RtBOv4.js";import{computeBufferBinding as t,createCachedExplicitComputePipeline as n}from"../runtime/webgpuComputeLayout.js";import{i as r}from"./sphGpuDeviceIdentity-CxQWvfZe.js";import{resolveSchroederResidualMechanicsSourceRead as i}from"./schroederResidualMechanicsSourceGpu-BErUEB-i.js";function a({device:a,sourceRead:o}){let s=i(o,{device:a}),{source:c,carrierEnergy:l}=s,u=c.carrierCount,d=c.particleCount,f=e.format.wordCount;if(!l||l.rowCount!==u||l.format.wordCount!==f||l.format.quantumExponent!==e.format.quantumExponent)throw TypeError(`Residual thermal source requires aligned canonical carrier energy`);let p=(2*d*f+4)*4;if(p>a.limits.maxBufferSize||p>a.limits.maxStorageBufferBindingSize)throw RangeError(`Residual thermal energy exceeds GPU storage capacity`);let m=r(a.createBuffer({label:`ulg-residual-mechanics-energy`,size:p,usage:140}),a);try{let r=n(a,{entryPoint:`gather`,cacheKey:`ulg-residual-mechanics-energy-v2-${u}-${c.historyCapacity}-${c.phaseLayout?.lineageCount??0}`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`].map((e,n)=>t(n,e)),code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> carrier:array<u32>;
@group(0) @binding(2) var<storage,read> control:array<u32>;
@group(0) @binding(3) var<storage,read_write> energy:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${u+c.historyCapacity}u){return;}
 let dest=${c.phaseLayout?`select(${c.phaseLayout.carrierLineageCount}u+row-${u}u,
   (row/${c.phaseLayout.carrierLineageCount}u)*${c.phaseLayout.lineageCount}u+row%${c.phaseLayout.carrierLineageCount}u,row<${u}u)`:`row`};
 if(row==0u){
   for(var w=0u;w<4u;w++){energy[${2*d*f}u+w]=carrier[${2*u*f}u+w];}
   if(control[2]!=0u){energy[${2*d*f}u]|=16u;}
 }
 for(var w=0u;w<${f}u;w++){
   if(row<${u}u){energy[dest*${f}u+w]=carrier[row*${f}u+w];energy[(dest+${d}u)*${f}u+w]=carrier[(row+${u}u)*${f}u+w];}
   else if(row-${u}u<control[4] && control[2]==0u){
     let h=${e.headerWords}u+(row-${u}u)*${e.rowWords}u;
     energy[dest*${f}u+w]=history[h+${e.energyOffset}u+w];
     energy[(dest+${d}u)*${f}u+w]=history[h+${e.sourceOffset}u+w];
   }
 }
}`}),i=a.createBindGroup({layout:r.bindGroupLayout,entries:[c.history.buffer,l.energyBuffer,c.controlBuffer,m].map((e,t)=>({binding:t,resource:{buffer:e}}))}),o=a.createCommandEncoder(),p=o.beginComputePass();return p.setPipeline(r.pipeline),p.setBindGroup(0,i),p.dispatchWorkgroups(Math.ceil(d/64)),p.end(),s.validate(),a.queue.submit([o.finish()]),m}catch(e){throw m.destroy(),e}}export{a as createSphResidualMechanicsEnergyBuffer};