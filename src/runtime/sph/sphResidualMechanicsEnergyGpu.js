import { resolveSchroederResidualMechanicsSourceRead } from './schroederResidualMechanicsSourceGpu.js';
import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from './sphReactionResidualHistoryGpu.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { computeBufferBinding, createCachedExplicitBindGroup, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

/** Exact energy companion of the authenticated disjoint mechanics rows.
 * The physical binder owns this allocation; this grants no publication. */
export function createSphResidualMechanicsEnergyBuffer({device,sourceRead}) {
  const held=resolveSchroederResidualMechanicsSourceRead(sourceRead,{device});
  const {source,carrierEnergy}=held,n=source.carrierCount,count=source.particleCount,W=H.format.wordCount;
  if(!carrierEnergy || carrierEnergy.rowCount!==n || carrierEnergy.format.wordCount!==W
    || carrierEnergy.format.quantumExponent!==H.format.quantumExponent){
    throw new TypeError('Residual thermal source requires aligned canonical carrier energy');
  }
  const size=(2*count*W+4)*4;
  if(size>device.limits.maxBufferSize || size>device.limits.maxStorageBufferBindingSize){
    throw new RangeError('Residual thermal energy exceeds GPU storage capacity');
  }
  const energy=tagWebGpuBufferDevice(device.createBuffer({label:'ulg-residual-mechanics-energy',size,usage:128|4|8}),device);
  try{
    const p=createCachedExplicitComputePipeline(device,{entryPoint:'gather',
      cacheKey:`ulg-residual-mechanics-energy-v2-${n}-${source.historyCapacity}-${source.phaseLayout?.lineageCount??0}`,
      bindings:['read-only-storage','read-only-storage','read-only-storage','storage'].map((t,i)=>computeBufferBinding(i,t)),
      code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> carrier:array<u32>;
@group(0) @binding(2) var<storage,read> control:array<u32>;
@group(0) @binding(3) var<storage,read_write> energy:array<u32>;
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${n+source.historyCapacity}u){return;}
 let dest=${source.phaseLayout?`select(${source.phaseLayout.carrierLineageCount}u+row-${n}u,
   (row/${source.phaseLayout.carrierLineageCount}u)*${source.phaseLayout.lineageCount}u+row%${source.phaseLayout.carrierLineageCount}u,row<${n}u)`:'row'};
 if(row==0u){
   for(var w=0u;w<4u;w++){energy[${2*count*W}u+w]=carrier[${2*n*W}u+w];}
   if(control[2]!=0u){energy[${2*count*W}u]|=16u;}
 }
 for(var w=0u;w<${W}u;w++){
   if(row<${n}u){energy[dest*${W}u+w]=carrier[row*${W}u+w];energy[(dest+${count}u)*${W}u+w]=carrier[(row+${n}u)*${W}u+w];}
   else if(row-${n}u<control[4] && control[2]==0u){
     let h=${H.headerWords}u+(row-${n}u)*${H.rowWords}u;
     energy[dest*${W}u+w]=history[h+${H.energyOffset}u+w];
     energy[(dest+${count}u)*${W}u+w]=history[h+${H.sourceOffset}u+w];
   }
 }
}`});
    const group=createCachedExplicitBindGroup(device,{layout:p.bindGroupLayout,entries:[source.history.buffer,
      carrierEnergy.energyBuffer,source.controlBuffer,energy].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);
    pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();held.validate();
    device.queue.submit([encoder.finish()]);return energy;
  }catch(error){energy.destroy();throw error;}
}
