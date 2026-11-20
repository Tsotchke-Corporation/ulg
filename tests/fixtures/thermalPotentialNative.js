import * as potential from '../../src/runtime/material/thermalPotentialGpu.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import {createExtendedPhaseCaloricFixture} from './sphExtendedPhaseCaloric.js';
import * as thermo from '../../src/runtime/material/condensableThermodynamics.js';
import {StateManager} from '../../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
import * as bridge from '../../src/runtime/peercomputeResidentCommitBridge.js';
import * as abi from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as consumer from '../../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';
import {runThermalPotentialSpatialProof} from './thermalPotentialSpatialNative.js';

export async function runThermalPotentialNativeProof() {

      const check=(condition,message)=>{if(!condition)throw new Error(message);};
      let adapter;
      for(let i=0;i<5&&!adapter;i++){adapter=await navigator.gpu.requestAdapter();if(!adapter)await new Promise(r=>setTimeout(r,300));}
      check(adapter,'WebGPU adapter unavailable');
      const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:16}});
      const errors=[];device.addEventListener('uncapturederror',e=>{if(errors.length<20)errors.push(e.error.message);});
      device.pushErrorScope('validation');
      const manager=new StateManager(null,{enablePersistence:false,disableBroadcast:true,disableNetworkProvider:true});
      await manager.initialize();
      const ledger=manager.createReservationLedger({name:'g6-native',maxKeys:3});
      // Original cold material-table construction; all fit and numerical
      // comparisons below execute on the GPU, with 128 bytes of evidence.
      const props=createExtendedPhaseCaloricFixture(thermo).materialProperties;
      const material=thermal.buildSphThermalMaterialTable(props);
      const graphs=thermal.buildSphThermalClosureGraphBuffers(material);
      const graph=graphs.graphBank.graphRecords.findIndex(r=>r.phaseFromId===2&&r.phaseToId===2);
      check(graph>=0,'Liquid graph missing');
      const upload=thermal.uploadSphThermalResponseGraphBuffers(device,{thermalMaterialTable:material,thermalClosureGraphSet:graphs});
      const compilation=[];
      for(const code of [potential.thermalPotentialFitWgsl,consumer.createSchroederSpatialThermalPotentialPrepassWgsl()]){
        const m=device.createShaderModule({code});const info=await m.getCompilationInfo();
        compilation.push(...info.messages.filter(m=>m.type==='error').map(m=>m.message));
      }
      check(!compilation.length,JSON.stringify(compilation));
      const cache=potential.createThermalPotentialGpu(device,{thermalResponseGraphUpload:upload,reservationLedger:ledger});
      const old=potential.retainThermalPotentialGpu(cache,device,upload);
      const proof=device.createBuffer({size:64,usage:0x80|0x04|0x08});
      const code=`
@group(0) @binding(0) var<storage,read> g6_table: array<f32>;
@group(0) @binding(1) var<storage,read> g6_metadata: array<vec4<f32>>;
@group(0) @binding(2) var<storage,read_write> g6_requests: array<atomic<u32>>;
@group(0) @binding(3) var<storage,read> nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage,read> samples: array<vec4<f32>>;
@group(0) @binding(5) var<storage,read_write> proof: array<atomic<u32>>;
${potential.thermalPotentialLookupWgsl()}
@compute @workgroup_size(64)
fn probe(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=65u){return;}
 let graph=${graph}u;let n=nodes[graph*4u+1u];let left=samples[u32(n.x)].xy;let right=samples[u32(n.x)+1u].xy;
 let q=0.4+0.2*f32(id.x)/64.0;let u=left.x+q*(right.x-left.x);
 let expected=left.y+q*(right.y-left.y);let slope=(right.y-left.y)/(right.x-left.x);
 let fitted=g6_temperature(graph,u,2.0);
 if(fitted.w==1.0){
   atomicAdd(&proof[1u],1u);
   let err=abs(fitted.x-expected)/expected;let derr=abs(fitted.y-slope)/slope;
   atomicMax(&proof[3u],bitcast<u32>(err));atomicMax(&proof[4u],bitcast<u32>(derr));
   if(!(err<=1e-4)||!(derr<=1e-3)){atomicAdd(&proof[0u],1u);}
 }else{atomicAdd(&proof[2u],1u);}
 // Wrong phase and outside the source graph must never use a fit.
 if(g6_temperature(graph,u,1.0).w!=0.0||g6_temperature(graph,right.x+1.0,2.0).w!=0.0){atomicAdd(&proof[0u],1u);}
}
`;
      const module=device.createShaderModule({code});
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'probe'}});
      const probe=async lease=>{
        lease.assertLive();const encoder=device.createCommandEncoder();encoder.clearBuffer(proof);
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline);
        pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
          [lease.table,lease.metadata,lease.requests,upload.graphNodeBuffer,upload.graphSampleBuffer,proof]
            .map((buffer,binding)=>({binding,resource:{buffer}}))}));pass.dispatchWorkgroups(2);pass.end();
        const read=device.createBuffer({size:128,usage:1|8});
        encoder.copyBufferToBuffer(proof,0,read,0,64);encoder.copyBufferToBuffer(lease.requests,0,read,64,64);
        device.queue.submit([encoder.finish()]);await read.mapAsync(1);
        const words=Array.from(new Uint32Array(read.getMappedRange()));read.unmap();read.destroy();return words;
      };
      const initial=await probe(old);check(initial[1]===0&&initial[2]===65,'Initial generation unexpectedly fitted');
      // Reject the poisoned envelope, then use fresh misses produced by the
      // actual canonical spatial consumer. No manual request-buffer reseeding.
      const rejected=potential.encodeThermalPotentialCandidateGpu(cache,device.createCommandEncoder());
      potential.submitThermalPotentialCandidateGpu(rejected);
      let rejectedFit=false;
      try{await potential.completeThermalPotentialCandidateGpu(rejected);}catch(error){
        rejectedFit=String(error).includes('GPU candidate validation refused');
      }
      check(rejectedFit,'Out-of-source fit was not rejected');
      const spatialMiss=await runThermalPotentialSpatialProof({device,cache,upload,graphs,graph,properties:props});
      const candidate=potential.encodeThermalPotentialCandidateGpu(cache,device.createCommandEncoder());
      potential.submitThermalPotentialCandidateGpu(candidate);
      await potential.completeThermalPotentialCandidateGpu(candidate);
      check(potential.thermalPotentialGpuBindings(cache,device,upload).ordinal===0,'Fit adopted before commit');
      const delta={schema:abi.ULG_MLS_MPM_RESIDENT_STEPS_COMMIT_DELTA_SCHEMA,taskId:'g6-native',scope:'ulg-sph-resident-pass-dag',version:1,
        payload:{schema:abi.ULG_MLS_MPM_RESIDENT_STEPS_STATE_DELTA_SCHEMA,stateKey:'g6-native',completedStepCount:1,
          gpuFence:{fenceSatisfied:true,status:'queue-work-completed',method:'queue.onSubmittedWorkDone'}}};
      potential.attachThermalPotentialCandidateToDelta(candidate,delta);
      const commit=bridge.createResidentStateManagerCommitHandler(manager);commit({...delta});
      check(potential.thermalPotentialGpuBindings(cache,device,upload).ordinal===0,'Cloned delta adopted fit');
      commit(delta);
      check(potential.thermalPotentialGpuBindings(cache,device,upload).ordinal===1,'StateManager acceptance did not adopt');
      const current=potential.retainThermalPotentialGpu(cache,device,upload);
      const accepted=await probe(current);const retained=await probe(old);
      const spatialBaseline=await runThermalPotentialSpatialProof({device,cache,upload,graphs,graph,properties:props,enabled:false});
      const spatial=await runThermalPotentialSpatialProof({device,cache,upload,graphs,graph,properties:props});
      const validation=await device.popErrorScope();
      current.release();old.release();potential.destroyThermalPotentialGpu(cache);thermal.destroySphThermalResponseGraphBuffers(upload);
      await manager.destroy();device.destroy();
      return {initial,accepted,retained,rejectedFit,spatialMiss,spatialBaseline,spatial,compilation,errors,validation:validation?.message??null};
}
