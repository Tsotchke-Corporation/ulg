import { createSphState } from '../../src/runtime/sph/sphState.js';
import * as gpu from '../../src/runtime/sph/sphGpuBuffers.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import * as thermal from '../../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import { createSchroederSpatialEpochTransaction } from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { thermalPotentialGpuBindings } from '../../src/runtime/material/thermalPotentialGpu.js';

// Real canonical spatial producer, using cold manufactured liquid carriers.
// Only the compact proof is mapped. This checks the deployed prepass consumer;
// it does not claim a full physical interval or a mounted scene.
export async function runThermalPotentialSpatialProof({device,cache,upload,graphs,graph,properties,enabled=true}) {
  const createBuffer=(data,label)=>{
    const buffer=tagWebGpuBufferDevice(device.createBuffer({label,size:data.byteLength,usage:0x80|0x08|0x04}),device);
    device.queue.writeBuffer(buffer,0,data);return buffer;
  };
  const n=graphs.graphBank.nodeRows;
  const particles=[0.45,0.55].map((q,i)=>({material:'three-phase',massKg:0.001,x:[1+i*0.01,1,1],v:[0,0,0],
    specificInternalEnergyJPerKg:n[graph*16+6]+q*(n[graph*16+7]-n[graph*16+6])}));
  const packed=gpu.buildSphGpuParticleBuffers(createSphState({particles,smoothingLengthM:0.1}),{materialProperties:properties});
  const epoch={storageGeneration:1,physicsTick:1,physicsSubstep:0,positionEpoch:1,topologyEpoch:0,chartEpoch:0,levelEpoch:1,supportEpoch:1};
  Object.assign(packed,epoch);
  const particleUpload=gpu.uploadSphGpuParticleBuffers(device,packed);
  Object.assign(particleUpload,epoch,{bufferFamilyGenerationStatus:'schroeder-particle-buffer-family-generation-ready',slot:0,sourceSlot:0,nextSlot:1});
  const rows=new Float32Array(32);
  for(let i=0;i<2;i++){
    const mass=packed.state[i*8+3],rho=packed.thermo[i*12+3],volume=mass/rho;
    rows.set([0,0.2,0.2,volume,volume,volume,mass,rho,packed.thermo[i*12+1],packed.thermo[i*12],1,0,
      ...packed.state.slice(i*8,i*8+3),0],i*16);
  }
  const active=createBuffer(rows,'g6-native-level-assignment');
  const mechanics=createBuffer(new Float32Array(48),'g6-native-mechanics');
  let generation,proposal;
  try {
    const levelAssignment={schema:'peercompute.ulg.schroeder-level-assignment-execution.v0',status:'schroeder-level-assignment-submitted',
      bufferFamilyGenerationStatus:'schroeder-particle-buffer-family-generation-ready',particleCount:2,assignmentStrideFloats:16,
      assignmentBuffer:active,assignmentBufferByteLength:rows.byteLength,sourceStateBuffer:particleUpload.stateBuffer,
      sourceStateBufferBorrowed:true,minLevel:0,maxLevel:0,chartId:0,baseGridSpacingM:0.2,phaseVolumeAssignmentOverlayEnabled:false,...epoch};
    generation=spatial.runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment,particleCount:2,
      particleIdentityBuffer:particleUpload.identityBuffer,particleIdentityStrideWords:1,particleBufferSet:null,
      laneId:'g6-native-spatial',sourceFamily:'g6-native-spatial',mechanicsLevels:[]});
    if(!generation.ready)throw new Error(`G6 spatial generation: ${generation.status} ${generation.reason}`);
    const consumerSupportProfileIds=Object.fromEntries(thermal.SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(c=>[c.consumerId,c.supportProfileId]));
    const mlsMpmParticleUpload={mechanicsBuffer:mechanics};
    const transaction=createSchroederSpatialEpochTransaction({device,generation,sphParticleUpload:particleUpload,mlsMpmParticleUpload,
      requiredReaderIds:[],enabledConsumerReaderIds:Object.keys(consumerSupportProfileIds),consumerSupportProfileIds});
    proposal=thermal.runSchroederSpatialThermalProposalWebGpu({device,generation,schroederSpatialEpochTransaction:transaction,
      sphParticleState:packed,sphParticleUpload:particleUpload,mlsMpmParticleUpload,thermalResponseGraphUpload:upload,
      thermalPotential:enabled?cache:null,dtS:0.001,smoothingLengthM:0.1,conductionRate:1});
    const stage=thermal.createSchroederSpatialMatchedTimeThermalProposalEncoderStage({device,schroederSpatialThermalProposal:proposal,
      currentStateBuffer:particleUpload.stateBuffer,currentThermoBuffer:particleUpload.thermoBuffer,
      thermalResponseGraphUpload:upload,dtS:0.001,smoothingLengthM:0.1,conductionRate:1});
    const proof=device.createBuffer({size:64,usage:0x80|0x04|0x08});
    const binding=thermalPotentialGpuBindings(cache,device,upload);
    const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(binding.requests,4,proof,32,4);
    stage.encode(encoder);
    const module=device.createShaderModule({code:`
@group(0) @binding(0) var<storage,read> derived:array<u32>;
@group(0) @binding(1) var<storage,read> state:array<vec4<f32>>;
@group(0) @binding(2) var<storage,read> nodes:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read> samples:array<vec4<f32>>;
@group(0) @binding(4) var<storage,read> requests:array<u32>;
@group(0) @binding(5) var<storage,read_write> proof:array<u32>;
@compute @workgroup_size(1) fn verify(){
 proof[0]=derived[1];proof[2]=requests[1]-proof[8];
 for(var i=0u;i<5u;i++){proof[9u+i]=derived[i];}
 let n=nodes[${graph*4+1}u];let l=samples[u32(n.x)].xy;let r=samples[u32(n.x)+1u].xy;
 for(var i=0u;i<2u;i++){
  let u=state[i*2u+1u].w;let expected=l.y+(u-l.x)/(r.x-l.x)*(r.y-l.y);
  let row=${proposal.derivedHeaderWords}u+i*${proposal.derivedRowWords}u;
  let t=bitcast<f32>(derived[row]);let slope=bitcast<f32>(derived[row+1u]);
  proof[3u+i*2u]=bitcast<u32>(t);proof[4u+i*2u]=bitcast<u32>(slope);
  if(!(abs(t-expected)<=1e-4*expected)||!(abs(slope-(r.y-l.y)/(r.x-l.x))<=1e-3*(r.y-l.y)/(r.x-l.x))){proof[0]++;}
  proof[1]++;
 }
}`});
    const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'verify'}});
    const pass=encoder.beginComputePass();pass.setPipeline(pipeline);
    pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
      [proposal.thermalDerivedBudgetBuffer,particleUpload.stateBuffer,upload.graphNodeBuffer,upload.graphSampleBuffer,binding.requests,proof]
        .map((buffer,binding)=>({binding,resource:{buffer}}))}));pass.dispatchWorkgroups(1);pass.end();
    const read=device.createBuffer({size:64,usage:1|8});encoder.copyBufferToBuffer(proof,0,read,0,64);
    device.queue.submit([encoder.finish()]);stage.markSubmittedWork();await read.mapAsync(1);
    const words=Array.from(new Uint32Array(read.getMappedRange()));read.destroy();proof.destroy();return words;
  } finally {
    await device.queue.onSubmittedWorkDone();
    proposal?.releaseAfterCanonicalApplySubmittedWork?.();
    if(generation)spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);
    await generation?.releasePromise;
    gpu.destroySphGpuParticleBuffers(particleUpload);active.destroy();mechanics.destroy();
  }
}
