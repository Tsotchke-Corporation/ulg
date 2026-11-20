import { SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL } from '../../ulg-gpu-abi/src/index.js';
import { buildSphDispersedMediumOpticalClosureTable } from '../../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import { buildSphDispersedMediumOpticsProducerSeedRows,
  createSphDispersedMediumOpticsProducerWebGpuEncoderStage } from '../../src/runtime/sph/sphDispersedMediumOpticsProducerGpu.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

// Manufactured cold input, actual GPU producer, fixed-size GPU assertions.
// The first two slots have changed species; the third is vacant condensed
// space with unrelated gas; the fourth already carries conserved condensate.
export async function runDispersedMediumRefinementNative() {
  let adapter;
  for(let n=0;n<5&&!adapter;n++){
    adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!adapter)throw new Error('Native WebGPU adapter unavailable');
  const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:8}});
  const errors=[],owned=[];let stage;
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const buffer=(rows,label)=>{
    const b=tagWebGpuBufferDevice(device.createBuffer({label,size:rows.byteLength,
      usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),device);
    device.queue.writeBuffer(b,0,rows);owned.push(b);return b;
  };
  try{
    const capacity=4,count=16;
    const plan={schema:'peercompute.ulg.sph-phase-carrier-plan.v2',status:'phase-lane-capacity-ready',
      lineageCapacity:capacity,primaryCapacity:capacity,phaseLaneCount:4,phaseLaneStride:capacity,
      companionStart:capacity,companionCapacity:capacity*3,particleCapacity:count,
      stableLaneAddress:'phaseLane*phaseLaneStride+lineageIndex',phaseCompanionLanesRequired:true};
    const opticalClosureTable=buildSphDispersedMediumOpticalClosureTable([11,22].map((id,i)=>({
      dispersedMaterialId:id,vaporPhaseId:3,condensedPhaseId:2,opticalStateId:101*(i+1),
      morphologyModelId:SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,condensedDensityKgPerM3:1000,scatteringEfficiencyQsca:2,
      absorptionEfficiencyQabs:.1,asymmetryFactorG:.5,effectiveRadiusM:1e-6})));
    const seed=buildSphDispersedMediumOpticsProducerSeedRows({phaseCarrierPlan:plan,
      lineageMaterialIds:Float32Array.of(22,11,11,11),opticalClosureTable});
    seed.rows[(capacity+3)*8+4]=.125;
    const preS=new Float32Array(count*8),preT=new Float32Array(count*12);
    const postS=new Float32Array(count*8),postT=new Float32Array(count*12);
    for(let i=0;i<4;i++){
      const gas=2*capacity+i,liquid=capacity+i,id=[11,22,22,11][i],fraction=[.25,.5,0,.25][i];
      preS[gas*8+3]=1;preT.set([id,3,300,1,0,fraction,1-fraction,0],gas*12);
      postS[gas*8+3]=1-fraction;postT.set([id,3,300,1,0,0,1,0],gas*12);
      preS[liquid*8+3]=i===3 ? .5 : 0;preT.set([id,2,300,1000,0,1,0,0],liquid*12);
      postS[liquid*8+3]=fraction+preS[liquid*8+3];postT.set([id,2,300,1000,0,1,0,0],liquid*12);
    }
    stage=createSphDispersedMediumOpticsProducerWebGpuEncoderStage({device,phaseCarrierPlan:plan,
      particleLineage:{particleCount:count,topologyEpoch:7,identityRevision:'cold-refinement-optics',
        identityBuffer:buffer(Uint32Array.from({length:count},(_,i)=>100+i%capacity),'identity')},
      outputTopologyEpoch:8,refreshRouteIdentity:true,
      preTransferStateBuffer:buffer(preS,'pre-state'),preTransferThermoBuffer:buffer(preT,'pre-thermo'),
      postTransferStateBuffer:buffer(postS,'post-state'),postTransferThermoBuffer:buffer(postT,'post-thermo'),
      seedOpticsRows:seed.rows,opticalClosureTable});
    const receipt=device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    const read=device.createBuffer({size:32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});owned.push(receipt,read);
    const code=`@group(0) @binding(0) var<storage,read> o:array<vec4<f32>>;
      @group(0) @binding(1) var<storage,read> e:array<u32>;
      @group(0) @binding(2) var<storage,read_write> r:array<u32>;
      @compute @workgroup_size(1) fn main(){
        let masses=array<f32,4>(0.25,0.5,0.0,0.375);
        let ids=array<f32,4>(11.0,22.0,0.0,11.0);
        let optical=array<f32,4>(101.0,202.0,0.0,101.0);
        for(var i=0u;i<16u;i++){
          let prefix=o[2u*i];let moments=o[2u*i+1u];
          if(i>=4u && i<8u && i!=6u){let j=i-4u;
            if(any(prefix!=vec4<f32>(ids[j],2.0,optical[j],1.0)) || moments.x!=masses[j]
              || !(moments.y>0.0) || !(moments.z>0.0) || abs(moments.w)>moments.y){r[0]++;}
            r[1]++;
          }else{
            if(any(prefix!=vec4<f32>(0.0,0.0,0.0,255.0)) || any(moments!=vec4<f32>(0.0))){r[0]++;}
            r[2]++;
          }
        }
        r[3]=e[2];r[4]=e[10];r[5]=e[9];r[6]=e[12];r[7]=1u;
        if(e[2]!=0u || e[9]!=0u){r[0]++;}
      }`;
    const pipeline=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code})}});
    const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
      [stage.outputBuffer,stage.evidenceBuffer,receipt].map((b,binding)=>({binding,resource:{buffer:b}}))});
    const encoder=device.createCommandEncoder();stage.encode(encoder);
    const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(1);pass.end();
    encoder.copyBufferToBuffer(receipt,0,read,0,32);device.queue.submit([encoder.finish()]);
    stage.markSubmittedWork({commandSubmissionCount:1,owningCommandSubmissionOrdinal:1,submittedStepCount:1});
    await read.mapAsync(GPUMapMode.READ);const words=[...new Uint32Array(read.getMappedRange())];read.unmap();
    return {words,errors,declarationMode:stage.result.declaration.declarationMode,
      reactionCaptureEnabled:stage.result.reactionCaptureEnabled,routeRefreshEnabled:stage.result.routeRefreshEnabled};
  }finally{
    await device.queue.onSubmittedWorkDone();stage?.cleanupSubmittedWork();stage?.cleanupRetainedOutput();
    for(const b of owned)b.destroy();device.destroy();
  }
}
