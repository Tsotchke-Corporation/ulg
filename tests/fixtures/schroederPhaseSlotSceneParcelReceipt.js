import { webGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { acquireSphParticleExactMassRead, releaseSphParticleExactMassRead,
  beginSphGpuParticleUploadLedgerParcelsBorrow } from '../../src/runtime/sph/sphGpuBuffers.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { encodeSphLedgerParcelOpticsWebGpu } from '../../src/runtime/sph/sphLedgerParcelOpticsGpu.js';
import { sceneParcelDryMass } from './schroederPhaseSlotSceneLedgerSeed.js';

// Two fixed 32-byte reductions. Carrier, parcel, sink and optical arrays stay
// on the same device. This runs the production optical writer on the actual
// retained parcel owner; it does not claim a rendered preset plume.
export async function phaseSlotSceneParcelReceipt(sph,gasId){
  const device=webGpuBufferDevice(sph.stateBuffer),owned=[];
  const held=acquireSphParticleExactMassRead(sph,device);
  const borrow=beginSphGpuParticleUploadLedgerParcelsBorrow(sph);
  const make=(size,usage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC)=>{
    const b=device.createBuffer({size,usage});owned.push(b);return b;};
  try{
    const parcels=borrow?.parcels;
    if(!parcels || parcels.count!==1 || !held.energy)throw new Error('Scene lost the carrier/parcel ledger owner');
    const words=make(32),parcelWords=make(32),field=make(512*32);
    const common=createSphExactMassWgsl(held.energy.format)+createSphExactLedgerWgsl(held.energy.format);
    const code=`${common}
      @group(0) @binding(0) var<storage,read> s:array<vec4<f32>>;
      @group(0) @binding(1) var<storage,read> t:array<vec4<f32>>;
      @group(0) @binding(2) var<storage,read> ids:array<u32>;
      @group(0) @binding(3) var<storage,read> m:array<u32>;
      @group(0) @binding(4) var<storage,read> e:array<u32>;
      @group(0) @binding(5) var<storage,read> p:array<u32>;
      @group(0) @binding(6) var<storage,read> sink:array<u32>;
      @group(0) @binding(7) var<storage,read_write> r:array<u32>;
      @compute @workgroup_size(1) fn main(){
        var totalM:ExactMass;var totalU:ExactMass;var totalS:ExactMass;
        for(var i=0u;i<36u;i++){
          var mi:ExactMass;var ui:ExactMass;var si:ExactMass;
          for(var w=0u;w<EM_WORDS;w++){
            mi.words[w]=m[${held.read.byteOffset/4}u+i*EM_WORDS+w];
            ui.words[w]=e[i*EM_WORDS+w];si.words[w]=e[(36u+i)*EM_WORDS+w];
          }
          totalM=em_add(totalM,mi).value;totalU=el_add(totalU,ui).value;totalS=el_add(totalS,si).value;
          if(ids[i]!=100u+i%9u){r[0]++;r[3]++;}
          if(bitcast<u32>(s[2u*i].w)!=em_project_f32_bits(mi).bits){r[0]++;}
          if(s[2u*i].w>0.0){r[2]++;
            if(t[3u*i].x==${gasId}.0 && t[3u*i].y==3.0){r[1]++;
              let temperature=300.0+(s[2u*i+1u].w-2500000.0)/1850.0;
              if(!(abs(t[3u*i].z-temperature)<0.001)){r[0]++;r[6]++;}
            }
          }
        }
        var dry:ExactMass;var water:ExactMass;var parcelU:ExactMass;
        var wallM:ExactMass;var wallU:ExactMass;var solute:ExactMass;
        for(var w=0u;w<EM_WORDS;w++){
          dry.words[w]=p[w];water.words[w]=p[EM_WORDS+w];parcelU.words[w]=p[2u*EM_WORDS+w];
          wallM.words[w]=sink[w];wallU.words[w]=sink[EM_WORDS+w];solute.words[w]=sink[2u*EM_WORDS+w];
        }
        totalM=em_add(totalM,em_add(em_add(dry,water).value,em_add(wallM,solute).value).value).value;
        totalU=el_add(totalU,el_add(parcelU,wallU).value).value;
        let expectedM=em_add(em_from_f32_bits(bitcast<u32>(33.0)).value,
          em_from_f32_bits(bitcast<u32>(${sceneParcelDryMass})).value).value;
        let expectedU=el_from_f32_bits(bitcast<u32>(80003000.0)).value;
        let accounted=el_subtract(totalU,totalS).value;
        for(var w=0u;w<EM_WORDS;w++){
          if(totalM.words[w]!=expectedM.words[w]){r[0]++;r[4]++;}
          if(accounted.words[w]!=expectedU.words[w]){r[0]++;r[5]++;}
        }
        if(e[72u*EM_WORDS]!=0u){r[0]++;r[5]++;}r[7]=1u;
      }`;
    const pipeline=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code})}});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
      [sph.stateBuffer,sph.thermoBuffer,sph.identityBuffer,held.read.buffer,held.energy.energyBuffer,
        parcels.ledgerBuffer,parcels.sinkBuffer,words].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder();let pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
    const opticalParams=encodeSphLedgerParcelOpticsWebGpu({device,encoder,parcels,fieldRowsBuffer:field,
      fieldOffset:0,resolution:8,fieldPadding:0,refEdgeM:10});
    if(opticalParams)owned.push(opticalParams);
    const optical=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code:`
      ${common}
      @group(0) @binding(0) var<storage,read> p:array<u32>;
      @group(0) @binding(1) var<storage,read> f:array<f32>;
      @group(0) @binding(2) var<storage,read_write> r:array<u32>;
      @compute @workgroup_size(1) fn main(){
        var water:ExactMass;for(var w=0u;w<EM_WORDS;w++){water.words[w]=p[EM_WORDS+w];}
        r[1]=select(1u,0u,em_zero(water));r[3]=em_project_f32_bits(water).bits;
        var tau=0.0;for(var i=0u;i<512u;i++){
          let scattering=f[i*8u+5u];if(!(scattering>=0.0)){r[0]++;}tau+=scattering;
        }
        r[2]=select(0u,1u,tau>0.0);r[4]=bitcast<u32>(tau);r[7]=1u;
      }`})}});
    const opticalGroup=device.createBindGroup({layout:optical.getBindGroupLayout(0),entries:
      [parcels.ledgerBuffer,field,parcelWords].map((buffer,binding)=>({binding,resource:{buffer}}))});
    pass=encoder.beginComputePass();pass.setPipeline(optical);pass.setBindGroup(0,opticalGroup);pass.dispatchWorkgroups(1);pass.end();
    const read=make(64,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
    encoder.copyBufferToBuffer(words,0,read,0,32);encoder.copyBufferToBuffer(parcelWords,0,read,32,32);
    device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
    const result=[...new Uint32Array(read.getMappedRange())];read.unmap();
    return {words:result.slice(0,8),parcelWords:result.slice(8),integer:true,generation:held.read.generation,
      sourceStage:sph.sourceStage,topologyEpoch:sph.topologyEpoch,identityRevision:sph.identityRevision};
  }finally{
    await device.queue.onSubmittedWorkDone();borrow?.release();await releaseSphParticleExactMassRead(held);
    for(const b of owned)b.destroy();
  }
}
