import '../../src/services/ulgOffscreenRender.worker.js';
import { resolveUlgMechanicsResidentStageWorkerRetainedParticleState } from '../../src/services/ulgMechanicsResidentStage.worker.js';
import { acquireSphParticleExactMassRead, releaseSphParticleExactMassRead } from '../../src/runtime/sph/sphGpuBuffers.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { webGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { readMigrationDecisions } from './schroederMigrationDecisionCapture.js';
const productionHandler=self.onmessage;
const errors=[];
const originalRequestDevice=GPUAdapter.prototype.requestDevice;
GPUAdapter.prototype.requestDevice=async function(...args){
  const device=await originalRequestDevice.apply(this,args);
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));return device;
};
self.onmessage=event=>{
  if(event.data?.type!=='preset-refinement-receipt')return productionHandler(event);
  const {port,laneId,stateKey,nitrogenId,capacity,reserve}=event.data;
  (async()=>{
    const retained=resolveUlgMechanicsResidentStageWorkerRetainedParticleState({laneId,stateKey,sourceStageId:'schroederSameLevelMechanics'});
    if(!retained.sameWorkerPrivateReferences)throw new Error(`Missing preset retained state: ${retained.status}`);
    const sph=retained.sphParticleUpload,device=webGpuBufferDevice(sph.stateBuffer);
    const held=acquireSphParticleExactMassRead(sph,device);
    const result=device.createBuffer({size:64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    const read=device.createBuffer({size:64,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    try{
      if(!held.energy)throw new Error('Preset has no current integer energy ledger');
      if(!sph.dispersedMediumOptics?.buffer)throw new Error('Preset has no authenticated optics sidecar');
      const count=retained.particleCount;
      const code=`${createSphExactMassWgsl(held.energy.format)}
        @group(0) @binding(0) var<storage,read> s:array<vec4<f32>>;
        @group(0) @binding(1) var<storage,read> t:array<vec4<f32>>;
        @group(0) @binding(2) var<storage,read> m:array<u32>;
        @group(0) @binding(3) var<storage,read> e:array<u32>;
        @group(0) @binding(4) var<storage,read_write> r:array<u32>;
        @group(0) @binding(5) var<storage,read> optics:array<vec4<f32>>;
        fn finite(v:f32)->bool{return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
        @compute @workgroup_size(1) fn main(){
          for(var i=0u;i<${count}u;i++){
            var mass:ExactMass;for(var w=0u;w<EM_WORDS;w++){mass.words[w]=m[${held.read.byteOffset/4}u+i*EM_WORDS+w];}
            let projected=em_project_f32_bits(mass);
            if(projected.error!=0u || bitcast<u32>(s[2u*i].w)!=projected.bits){r[0]++;}
            if(!(s[2u*i].w>=0.0) || !finite(s[2u*i+1u].w)){r[0]++;}
            let op=optics[2u*i];let om=optics[2u*i+1u];
            if(op.w==1.0){r[8]++;}
            else if(op.w!=255.0 || any(op.xyz!=vec3<f32>(0.0)) || any(om!=vec4<f32>(0.0))){r[10]++;}
            if(!finite(om.x) || !finite(om.y) || !finite(om.z) || !finite(om.w)
              || om.x<0.0 || om.x>s[2u*i].w || om.y<0.0 || om.z<0.0 || abs(om.w)>om.y){r[10]++;}
            if(om.x>0.0){r[9]++;if(op.x!=t[3u*i].x || op.y!=t[3u*i].y || op.w!=1.0){r[10]++;}}
            if(s[2u*i].w<=0.0){continue;}
            if(!(t[3u*i].z>0.0) || !finite(t[3u*i].z) || t[3u*i+2u].z!=1.0){r[0]++;}
            if(t[3u*i].y==3.0){r[1]++;if(t[3u*i].x==${nitrogenId}.0){r[2]++;}}
            else{r[3]++;}
            let lineage=i%${capacity}u;
            if(lineage>=${reserve.firstLineageIndex}u && lineage<${reserve.firstLineageIndex+reserve.count}u){r[4]++;}
          }
          r[5]=e[${count*2}u*EM_WORDS];if(r[5]!=0u){r[0]++;}r[6]=${count}u;r[7]=1u;r[15]=1u;r[0]+=r[10];
        }`;
      const pipeline=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code})}});
      const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
        [sph.stateBuffer,sph.thermoBuffer,held.read.buffer,held.energy.energyBuffer,result,sph.dispersedMediumOptics.buffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
      const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
      pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
      encoder.copyBufferToBuffer(result,0,read,0,64);device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);const words=[...new Uint32Array(read.getMappedRange())];read.unmap();
      const migrationDecisions=await readMigrationDecisions(device);
      port.postMessage({words:words.slice(0,8),opticsWords:words.slice(8),migrationDecisions,errors,sourceStage:sph.sourceStage,topologyEpoch:sph.topologyEpoch,step:retained.sphParticleState.step});
    }finally{await device.queue.onSubmittedWorkDone();await releaseSphParticleExactMassRead(held);result.destroy();read.destroy();}
  })().catch(e=>port.postMessage({fatal:e.stack??String(e)})).finally(()=>port.close());
};
