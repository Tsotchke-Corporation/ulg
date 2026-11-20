import * as abi from '../../ulg-gpu-abi/src/index.js';
import { webGpuDeviceDescriptorForResidentSph } from '../../src/runtime/webgpuDeviceLimits.js';
import { uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers, destroySphGpuParticleBuffers, destroyMlsMpmGpuParticleBuffers } from '../../src/runtime/sph/sphGpuBuffers.js';
import { runSchroederLevelAssignmentWebGpu } from '../../src/runtime/sph/schroederHierarchyGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu, releaseSchroederSpatialEpochGenerationAfterQueue } from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createMlsMpmGridSpec } from '../../src/runtime/sph/sphGridGpuKernel.js';
import { runSchroederSpatialChainMechanicsWebGpu } from '../../src/runtime/sph/schroederSpatialChainMechanicsGpu.js';
import { abortSchroederSpatialEpochTransaction } from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { buildMlsMpmMechanicsMaterialTable } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { uploadMlsMpmMechanicsMaterialPhaseRecords } from '../../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';

// Cold manufactured inventories; all motion, heat and rejection proofs run on
// production GPU output. Only the fixed 128-byte evidence record is mapped.
export async function runChainNativeTransport({levelCount=3,enabled=true,emptyMiddle=false,fault=false,drag=false}={}) {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
  const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.pushErrorScope('validation');
  const owned=[];const allocate=(size,usage=140)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};
  let sphParticleUpload,mlsMpmParticleUpload,assignment,generation,result,phaseUpload;
  let corrupted=false;const transportGroups=[];
  const originalBind=device.createBindGroup.bind(device);
  device.createBindGroup=descriptor=>{
    if(descriptor.label==='ulg-mls-mpm-grid-update-phase-volume-transport-stage-bind-group')transportGroups.push(descriptor);
    if(fault&&!corrupted&&transportGroups.length===Math.floor(levelCount/2)+1&&descriptor.label==='ulg-mls-mpm-grid-update-phase-volume-transport-stage-bind-group') {
      const control=descriptor.entries.find(e=>e.binding===1).resource.buffer;
      device.queue.writeBuffer(control,8,new Uint32Array([0]));corrupted=true;
    }
    return originalBind(descriptor);
  };
  try {
    const properties=Object.fromEntries(['n2','o2'].map((key,i)=>[key,{molarMassKgPerMol:i?0.032:0.028,
      phases:[{name:drag&&i===0?'liquid':'gas',densityKgPerM3:1,bulkModulusPa:drag&&i===0?1:null,shearModulusPa:0,cpJPerKgK:1000,
        dynamicViscosityPaS:0.00001,temperatureRange:[100,1000]}]}]));
    const table=buildMlsMpmMechanicsMaterialTable(properties,{viscosityEnabled:true});
    phaseUpload=uploadMlsMpmMechanicsMaterialPhaseRecords(device,table);
    const selected=Array.from({length:levelCount},(_,i)=>i).filter(i=>!emptyMiddle||i===0||i===levelCount-1);
    const placement=selected.flatMap(i=>[i,i]),count=placement.length,spacing=1/2**(levelCount-1);
    const state=new Float32Array(count*8),thermo=new Float32Array(count*12),mechanics=new Float32Array(count*32);
    for(const [i,level] of placement.entries()){
      const material=table.metadata[i%2].materialId;
      state.set([1.875,1.875,1.875,1,i%2?-1:1,0,0,1000],i*8);
      // A drag interface needs distinct support gradients. Exactly coincident
      // distributions correctly have zero antisymmetric interface area.
      if (drag && i%2) state[i*8] += 0.25*spacing*2**level;
      thermo.set([material,drag&&i%2===0?2:3,300,1,0,drag&&i%2===0?1:0,drag&&i%2===0?0:1,0,spacing*2**level,1,1,0.1],i*12);
      for(const j of [0,4,8,18,31])mechanics[i*32+j]=1;
      mechanics[i*32+19]=1;mechanics[i*32+20]=1;mechanics[i*32+21]=1;mechanics[i*32+27]=1;
    }
    const sphParticleState={schema:abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,status:'cpu-derived-gpu-buffer-ready',
      particleCount:count,dimension:3,step:0,time:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0,
      storageGeneration:1,smoothingLengthM:spacing,stateStrideFloats:8,thermoStrideFloats:12,identityStrideUints:1,
      stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,identityRequired:true,
      identityRevision:'chain-native-mixture',renderDomainKeys:{1:'body'},state,thermo,identity:Uint32Array.from(placement,(_,i)=>i+1),metadata:[]};
    const mlsMpmParticleState={schema:abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,status:'cpu-derived-gpu-buffer-ready',
      particleCount:count,step:0,time:0,storageGeneration:1,mechanicsStrideFloats:32,mechanicsStrideBytes:128,
      mechanicsDtS:0.001,mechanicalSubsteps:1,gridCflFactor:0.4,mechanics,metadata:[],
      particleSeparationRelaxation:0,particleSeparationVelocityDamping:0};
    sphParticleUpload=uploadSphGpuParticleBuffers(device,sphParticleState);
    mlsMpmParticleUpload=uploadMlsMpmGpuParticleBuffers(device,mlsMpmParticleState);
    sphParticleUpload.slot=0;mlsMpmParticleUpload.slot=0;
    const source={sphParticleState,mlsMpmParticleState,sphParticleUpload,mlsMpmParticleUpload};
    assignment=await runSchroederLevelAssignmentWebGpu({device,...source,baseGridSpacingM:spacing,minLevel:0,maxLevel:levelCount-1,
      targetSupportCells:1,supportRadiusScale:1,chartId:0,retainAssignmentBuffer:true});
    const seed=device.createShaderModule({code:`@group(0) @binding(0) var<storage,read_write> rows:array<f32>;
      @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
        let levels=array<u32,${count}>(${placement.map(i=>`${i}u`).join(',')});
        rows[id.x*16u]=f32(levels[id.x]);rows[id.x*16u+1u]=${spacing}*exp2(f32(levels[id.x]));
      }`});
    const seedPipeline=device.createComputePipeline({layout:'auto',compute:{module:seed,entryPoint:'main'}});
    const seedEncoder=device.createCommandEncoder(),seedPass=seedEncoder.beginComputePass();seedPass.setPipeline(seedPipeline);
    seedPass.setBindGroup(0,device.createBindGroup({layout:seedPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:assignment.assignmentBuffer}}]}));
    seedPass.dispatchWorkgroups(count);seedPass.end();device.queue.submit([seedEncoder.finish()]);
    const mechanicsLevels=Array.from({length:levelCount},(_,selectedLevel)=>{
      const grid=createMlsMpmGridSpec({boxDimsM:[4,4,4],gridSpacingM:spacing*2**selectedLevel});
      return {selectedLevel,mechanicsGrid:{gridDims:grid.gridDims,gridNodeCount:grid.gridNodeCount,
        gridShift:grid.shift,gridSpacingM:grid.gridSpacingM,boxDimsM:[4,4,4]}};
    });
    generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:assignment,particleCount:count,
      particleIdentityBuffer:sphParticleUpload.identityBuffer,particleIdentityStrideWords:1,mechanicsLevels});
    if(!generation.ready)throw new Error(generation.reason);
    result=await runSchroederSpatialChainMechanicsWebGpu({device,source,generation,mechanicsLevels,
      forceInputs:{dt:0.000001,gravityMPerS2:[0,0,0],boxDimsM:[4,4,4],cflFactor:0.4,
        wallsEnabled:false,contactEnabled:false,wallBarrierElasticStiffnessNPerM:0,
        wallBarrierContactScale:0,wallBarrierMinGapM:0.000001},
      internalPressureScale:0,mechanicsMaterialTable:table,
      mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024},
      localLawInputs:mechanicsLevels.map(()=>({mechanicsMaterialTable:table,mechanicsMaterialPhaseUpload:phaseUpload,
        phaseVolumeInterfaceTransportRequired:enabled,phaseVolumePressureScale:0,phaseVolumeDragScale:drag?1000000:0}))});
    const receipt=allocate(128),readback=allocate(128,9),check=device.createCommandEncoder();
    for(const [level,native] of generation.mechanicsLevelViews.entries()){
      const module=device.createShaderModule({code:`
        @group(0) @binding(0) var<storage,read> field:array<u32>;
        @group(0) @binding(1) var<storage,read> state:array<u32>;
        @group(0) @binding(2) var<storage,read> old:array<u32>;
        @group(0) @binding(3) var<storage,read> control:array<u32>;
        @group(0) @binding(4) var<storage,read_write> out:array<u32>;
        @group(0) @binding(5) var<storage,read> mechanics:array<u32>;
        @group(0) @binding(6) var<storage,read> old_mechanics:array<u32>;
        ${enabled ? `@group(0) @binding(7) var<storage,read> topology:array<u32>;
        @group(0) @binding(8) var<storage,read> scratch:array<u32>;
        @group(0) @binding(9) var<storage,read> phase_receipt:array<u32>;` : ''}
        @compute @workgroup_size(1) fn main(){
          ${enabled && level===0 ? `out[18]=topology[2];out[19]=phase_receipt[2];out[20]=scratch[2];
          out[21]=field[39];out[22]=field[40];out[23]=field[43];out[24]=field[34];out[25]=topology[16];
          out[26]=field[field[30]-48u+2u];out[27]=field[field[30]-48u+3u];
          out[28]=topology[39];out[29]=topology[40];out[30]=topology[41];out[31]=topology[42];` : ''}
          out[1]=control[2];out[2]=control[18];out[3+${level}u]=field[2];out[10]+=1u;
          if(${fault}){
            if(control[2]!=5u){out[0]|=1u;}
            for(var i=0u;i<arrayLength(&state);i++){if(state[i]!=old[i]){out[0]|=2u;}}
            for(var i=0u;i<arrayLength(&mechanics);i++){if(mechanics[i]!=old_mechanics[i]){out[0]|=4u;}}
            return;
          }
          if(control[2]!=3u||field[2]!=3u){out[0]|=8u;}
          ${enabled ? 'if(topology[2]!=3u||phase_receipt[2]!=3u||scratch[2]!=0u){out[0]|=256u;}' : ''}
          var mass=0.0;var momentum=vec3<f32>(0);var energy=0.0;var heat=0.0;
          for(var i=0u;i<field[34];i++){
            let s=field[30]+i*8u;let a=field[28]+i*8u;let m=bitcast<f32>(field[s]);
            let v=vec3<f32>(bitcast<f32>(field[s+1u]),bitcast<f32>(field[s+2u]),bitcast<f32>(field[s+3u]));
            mass+=m;momentum+=m*v;heat+=bitcast<f32>(field[a]);energy+=0.5*m*dot(v,v)+bitcast<f32>(field[a]);
          }
          if(abs(mass-${selected.includes(level)?'2.0':'0.0'})>1e-5||any(abs(momentum)>vec3<f32>(1e-5))
            ||abs(energy-${selected.includes(level)?'1.0':'0.0'})>1e-5){out[0]|=16u;}
          if(${enabled&&selected.includes(level)}&&!(heat>${drag?'1e-8':'0.99'})){out[0]|=32u;}
          if(${level===0}){for(var i=0u;i<${count}u;i++){
            let expected=select(1.0,-1.0,i%2u==1u)*${enabled?'0.0':'1.0'};
            ${drag&&enabled ? 'if(!(abs(bitcast<f32>(state[i*8u+4u]))<0.99999)){out[0]|=64u;}'
              : 'if(abs(bitcast<f32>(state[i*8u+4u])-expected)>1e-5){out[0]|=64u;}'}
            if(state[i*8u+3u]!=old[i*8u+3u]){out[0]|=128u;}
          }}
          out[12+${level}u]=bitcast<u32>(heat);
        }`});
      const errors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');
      if(errors.length)throw new Error(JSON.stringify(errors));
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
      const pass=check.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
        native.mechanicsFieldView.fieldViewBuffer,result.g2p.stateBuffer,sphParticleUpload.stateBuffer,
        result.publication.controlBuffer,receipt,result.g2p.mechanicsBuffer,mlsMpmParticleUpload.mechanicsBuffer,
        ...(enabled?[1,7,3].map(binding=>transportGroups[level].entries.find(e=>e.binding===binding).resource.buffer):[])]
        .map((buffer,binding)=>({binding,resource:{buffer}}))}));pass.dispatchWorkgroups(1);pass.end();
    }
    check.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([check.finish()]);
    await readback.mapAsync(1);const words=[...new Uint32Array(readback.getMappedRange())];readback.unmap();
    const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
    return {words,errors,corrupted,mappedBytes:128};
  }finally{
    await device.queue.onSubmittedWorkDone();result?.g2p.destroyOutputParticleBuffers();
    for(const p of result?.proposals??[])if(!p.released)await p.releaseAfterSubmittedWork();
    if(result){await result.composite.releaseExecutionAfter(result.execution);result.composite.destroy();abortSchroederSpatialEpochTransaction(result.transaction);}
    if(generation&&!generation.released){releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);await generation.releasePromise;}
    assignment?.destroyAssignmentBuffer?.();phaseUpload?.destroyMechanicsMaterialPhaseUpload();
    if(sphParticleUpload)destroySphGpuParticleBuffers(sphParticleUpload);
    if(mlsMpmParticleUpload)destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
    for(const b of owned)b.destroy();device.destroy();
  }
}
