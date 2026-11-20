import { webGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { acquireSphParticleExactMassRead, releaseSphParticleExactMassRead } from '../../src/runtime/sph/sphGpuBuffers.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { phaseSlotSceneParcelReceipt } from './schroederPhaseSlotSceneParcelReceipt.js';

// Read-only diagnostic: only this fixed 32-byte reduction leaves the device.
export async function phaseSlotSceneReceipt(sph, gasId, integer = false, parcels = false) {
  if(parcels)return phaseSlotSceneParcelReceipt(sph,gasId);
  const device = webGpuBufferDevice(sph.stateBuffer);
  if (!device) throw new Error('Scene receipt has no retained source device');
  const receipt = device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const read = device.createBuffer({size:32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  let held;
  try {
    held = integer ? acquireSphParticleExactMassRead(sph,device) : null;
    if(integer && !held.energy)throw new Error('Scene lost its integer energy owner');
    const pipeline = device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',
      module:device.createShaderModule({code:`
        ${integer ? createSphExactMassWgsl(held.energy.format)+createSphExactLedgerWgsl(held.energy.format) : ''}
        @group(0) @binding(0) var<storage,read> s:array<vec4<f32>>;
        @group(0) @binding(1) var<storage,read> t:array<vec4<f32>>;
        @group(0) @binding(2) var<storage,read> ids:array<u32>;
        @group(0) @binding(3) var<storage,read_write> r:array<u32>;
        ${integer ? `@group(0) @binding(4) var<storage,read> mwords:array<u32>;
        @group(0) @binding(5) var<storage,read> ewords:array<u32>;` : ''}
        @compute @workgroup_size(1) fn main(){
          var mass=0.0; var energy=0.0;
          ${integer ? 'var totalM:ExactMass;var totalU:ExactMass;var totalS:ExactMass;' : ''}
          for(var i=0u;i<arrayLength(&s)/2u;i++){
            let m=s[2u*i].w; let v=s[2u*i+1u].xyz; let u=s[2u*i+1u].w;
            if(!(m>=0.0) || !(abs(u)<1e20)){r[0]++;}
            if(ids[i]!=100u+i%9u){r[3]++;}
            if(m>0.0){r[2]++;if(t[3u*i].y==3.0){r[6]++;}if(t[3u*i].x==${gasId}.0 && t[3u*i].y==3.0){r[1]++;}}
            mass+=m; energy+=m*(u+0.5*dot(v,v));
            ${integer ? `var mi:ExactMass;var ui:ExactMass;var si:ExactMass;
            for(var w=0u;w<EM_WORDS;w++){
              mi.words[w]=mwords[${held.read.byteOffset/4}u+i*EM_WORDS+w];
              ui.words[w]=ewords[i*EM_WORDS+w];si.words[w]=ewords[(36u+i)*EM_WORDS+w];
            }
            totalM=em_add(totalM,mi).value;totalU=el_add(totalU,ui).value;totalS=el_add(totalS,si).value;
            if(bitcast<u32>(m)!=em_project_f32_bits(mi).bits){r[0]++;r[6]++;}` : ''}
          }
          if(!(abs(mass-${integer ? '2049.0' : '65.0'})<0.001)){r[0]++;}
          if(!(abs(energy-${integer ? '4098000.0' : '130000.0'})<1.0)){r[0]++;}
          ${integer ? `let expectedM=em_from_f32_bits(bitcast<u32>(2049.0)).value;
          let expectedU=el_from_f32_bits(bitcast<u32>(4098000.0)).value;
          let accounted=el_subtract(totalU,totalS).value;
          for(var w=0u;w<EM_WORDS;w++){
            if(totalM.words[w]!=expectedM.words[w]){r[0]++;r[4]++;}
            if(accounted.words[w]!=expectedU.words[w]){r[0]++;r[5]++;}
          }
          if(ewords[72u*EM_WORDS]!=0u){r[0]++;r[5]++;}`
          : 'r[4]=bitcast<u32>(mass);r[5]=bitcast<u32>(energy);'}
          r[7]=1u;
        }`})}});
    const group = device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
      [sph.stateBuffer,sph.thermoBuffer,sph.identityBuffer,receipt,
        ...(integer ? [held.read.buffer,held.energy.energyBuffer] : [])]
        .map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
    encoder.copyBufferToBuffer(receipt,0,read,0,32);device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);const words=[...new Uint32Array(read.getMappedRange())];read.unmap();
    return {words,sourceStage:sph.sourceStage,topologyEpoch:sph.topologyEpoch,
      ...(integer ? {integer:true,generation:held.read.generation,identityRevision:sph.identityRevision} : {})};
  } finally {
    await device.queue.onSubmittedWorkDone();
    if(held)await releaseSphParticleExactMassRead(held);
    receipt.destroy();read.destroy();
  }
}
