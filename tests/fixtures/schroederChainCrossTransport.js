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
export async function runChainCrossTransport({levelCount=3,enabled=true,emptyMiddle=false,fault=false,drag=true,reverse=false,asymmetric=false,torqueRefusal=false,geometryFault=false,surface=null}={}) {
  const surfaceMode=surface!==null, surfaceEnabled=surfaceMode&&surface!=='off', surfaceFault=surface==='fault';
  let adapter;const deadline=performance.now()+10000;do{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)await new Promise(r=>setTimeout(r,200));}while(!adapter&&performance.now()<deadline);if(!adapter)throw new Error('GPU adapter unavailable');
  const device=await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
  const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.pushErrorScope('validation');
  const owned=[];const allocate=(size,usage=140)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};
  let sphParticleUpload,mlsMpmParticleUpload,assignment,generation,result,phaseUpload;
  let corrupted=false,torqueCorrupted=false,geometryCorrupted=false,surfaceCorrupted=false;const crossGroups=[];
  const originalBind=device.createBindGroup.bind(device);
  device.createBindGroup=descriptor=>{
    if(descriptor.label==='ulg-chain-cross-transport-bind-group')crossGroups.push(descriptor);
    return originalBind(descriptor);
  };
  const originalShader=device.createShaderModule.bind(device);
  device.createShaderModule=descriptor=>{
    if(surfaceFault&&!surfaceCorrupted&&descriptor.code.includes('fn stage_surface_stress_pair(')){
      descriptor={...descriptor,code:descriptor.code.replace('fn field_admitted() -> bool {',
        'fn field_admitted() -> bool { if (field_load(0u) != 0u) { return false; }')};surfaceCorrupted=true;
    }
    if(geometryFault&&descriptor.code.includes('var first_moment=vec3<f32>(0.0);')){
      descriptor={...descriptor,code:descriptor.code.replace('first_moment+=weight*source_moment;',
        'first_moment=vec3<f32>(bitcast<f32>(0x7fc00000u | (source & 1u)));')};geometryCorrupted=true;
    }
    if(torqueRefusal&&descriptor.code.includes('fn fine_position(')){
      descriptor={...descriptor,code:descriptor.code.replace('return center;','return node;')};torqueCorrupted=true;
    }
    // Corrupt the original phase producer on the GPU before consumption.
    // No overwritten host mirror or forged phase receipt enters the runtime.
    if(fault&&!corrupted&&descriptor.code.includes('fn seal_volume()')&&descriptor.code.includes('0x53435031')){
      descriptor={...descriptor,code:descriptor.code.replace('fn seal_volume(){','fn seal_volume(){ fail(128u);')};corrupted=true;
    }
    return originalShader(descriptor);
  };
  try {
    const properties=Object.fromEntries(['n2','o2'].map((key,i)=>[key,{molarMassKgPerMol:i?0.032:0.028,
      phases:[{name:surfaceMode||drag&&i===0?'liquid':'gas',densityKgPerM3:1,bulkModulusPa:surfaceMode||drag&&i===0?1:null,shearModulusPa:0,cpJPerKgK:1000,
        surfaceTensionNPerM:surfaceMode?0.072:0,dynamicViscosityPaS:0.00001,temperatureRange:[100,1000]}]}]));
    const table=buildMlsMpmMechanicsMaterialTable(properties,{viscosityEnabled:true,surfaceTensionEnabled:surfaceEnabled});
    phaseUpload=uploadMlsMpmMechanicsMaterialPhaseRecords(device,table);
    const selected=Array.from({length:levelCount},(_,i)=>i).filter(i=>!emptyMiddle||i===0||i===levelCount-1);
    const placement=selected,count=placement.length,spacing=1/2**(levelCount-1);
    const state=new Float32Array(count*8),thermo=new Float32Array(count*12),mechanics=new Float32Array(count*32);
    for(const [i,level] of placement.entries()){
      const material=table.metadata[(level===0)!==reverse?0:1].materialId;
      state.set([1.875,1.875,1.875,asymmetric?1+i*0.3:1,surfaceMode?0:level===0?1:-1,surfaceMode?0:asymmetric?0.2*i:0,0,1000],i*8);
      // A drag interface needs distinct support gradients. Exactly coincident
      // distributions correctly have zero antisymmetric interface area.
      if (level>0) state[i*8+1] += (asymmetric?0.33:0.25)*spacing*2**level;
      const condensed=surfaceMode||drag&&((level===0)!==reverse);
      thermo.set([material,condensed?2:3,300,1,0,condensed?1:0,condensed?0:1,0,spacing*2**level,1,1,0.1],i*12);
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
    result=await runSchroederSpatialChainMechanicsWebGpu({device,source,generation,mechanicsLevels,crossLevelTransportRequired:enabled,
      forceInputs:{dt:surfaceMode?0.001:0.000001,gravityMPerS2:[0,0,0],boxDimsM:[4,4,4],cflFactor:0.4,
        wallsEnabled:false,contactEnabled:false,wallBarrierElasticStiffnessNPerM:0,
        wallBarrierContactScale:0,wallBarrierMinGapM:0.000001},
      internalPressureScale:0,mechanicsMaterialTable:table,
      mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024},
      localLawInputs:mechanicsLevels.map(()=>({mechanicsMaterialTable:table,mechanicsMaterialPhaseUpload:phaseUpload,
        phaseVolumeInterfaceTransportRequired:enabled,phaseVolumePressureScale:0,phaseVolumeDragScale:drag?1000000000000:0}))});
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
        @group(0) @binding(7) var<storage,read> corrected:array<u32>;
        fn add(i:u32,v:f32){out[i]=bitcast<u32>(bitcast<f32>(out[i])+v);}
        fn v3(s:ptr<storage,array<u32>,read>,at:u32)->vec3<f32>{return vec3<f32>(bitcast<f32>((*s)[at]),bitcast<f32>((*s)[at+1u]),bitcast<f32>((*s)[at+2u]));}
        @compute @workgroup_size(1) fn main(){
          out[1]=control[2];out[2]=control[18];out[3]+=1u;out[26+${level}u]=corrected[27];
          if(${fault||torqueRefusal||geometryFault||surfaceFault}){
            if(control[2]!=5u){out[0]|=1u;}
            for(var i=0u;i<arrayLength(&state);i++){if(state[i]!=old[i]){out[0]|=2u;}}
            for(var i=0u;i<arrayLength(&mechanics);i++){if(mechanics[i]!=old_mechanics[i]){out[0]|=4u;}}
            return;
          }
          if(control[2]!=3u||field[2]!=3u){out[0]|=8u;return;}
          var mass=0.0;var momentum=vec3<f32>(0.0);var energy=0.0;var heat=0.0;var angular=vec3<f32>(0.0);
          for(var i=0u;i<field[34];i++){
            let s=field[30]+i*8u;let a=field[28]+i*8u;let m=bitcast<f32>(field[s]);let v=v3(&field,s+1u);
            let dense=field[field[26]+i*4u];let coord=vec3<f32>(f32(dense/(field[20]*field[21])),f32((dense/field[21])%field[20]),f32(dense%field[21]));
            let pos=(coord-vec3<f32>(f32(field[22])))*bitcast<f32>(field[23]);
            mass+=m;momentum+=m*v;heat+=bitcast<f32>(field[a]);energy+=0.5*m*dot(v,v)+bitcast<f32>(field[a]);angular+=cross(pos,m*v);
            add(20u,0.5*m*dot(v,v));add(21u,length(m*v));add(22u,length(pos)*length(m*v));
            ${surfaceMode?'energy+=bitcast<f32>(field[a+3u]);add(23u,bitcast<f32>(field[a+3u]));':''}
          }
          add(4u,mass);add(5u,momentum.x);add(6u,momentum.y);add(7u,momentum.z);add(8u,energy);add(9u,heat);
          add(10u,angular.x);add(11u,angular.y);add(12u,angular.z);
          if(${level===levelCount-1}){
            var expected_mass=0.0;var expected_p=vec3<f32>(0.0);var expected_e=0.0;var expected_l=vec3<f32>(0.0);var particle_p=vec3<f32>(0.0);var particle_l=vec3<f32>(0.0);var changed=0u;
            let spacings=array<f32,${count}>(${placement.map(level=>String(spacing*2**level)).join(',')});
            for(var i=0u;i<${count}u;i++){
              let m=bitcast<f32>(old[i*8u+3u]);let v=v3(&old,i*8u+4u);let next=v3(&state,i*8u+4u);
              expected_mass+=m;expected_p+=m*v;expected_e+=0.5*m*dot(v,v);expected_l+=cross(v3(&old,i*8u),m*v);particle_p+=m*next;
              let c=i*32u;let spin=0.25*m*spacings[i]*spacings[i]*vec3<f32>(
                bitcast<f32>(mechanics[c+16u])-bitcast<f32>(mechanics[c+14u]),
                bitcast<f32>(mechanics[c+11u])-bitcast<f32>(mechanics[c+15u]),
                bitcast<f32>(mechanics[c+12u])-bitcast<f32>(mechanics[c+10u]));
              particle_l+=cross(v3(&state,i*8u),m*next)+spin;
              if(state[i*8u+3u]!=old[i*8u+3u]){out[0]|=16u;}
              ${surfaceMode ? `var affine=0.0;for(var j=9u;j<18u;j++){affine+=abs(bitcast<f32>(mechanics[c+j])-bitcast<f32>(old_mechanics[c+j]));}
                if(affine>1e-9||length(next-v)>1e-9){changed++;}` : 'if(length(next-v)>1e-6){changed++;}'}
            }
            if(abs(bitcast<f32>(out[4])-expected_mass)>2e-5*expected_mass){out[0]|=32u;}
            let p_tolerance=${surfaceMode?'max(1e-12,3e-5*bitcast<f32>(out[21]))':'2e-5*expected_mass'};
            if(length(v3(&out,5u)-expected_p)>p_tolerance||length(particle_p-expected_p)>p_tolerance){out[0]|=64u;}
            let energy_tolerance=${surfaceMode?'max(1e-12,2e-5*(bitcast<f32>(out[20])+abs(bitcast<f32>(out[9]))+abs(bitcast<f32>(out[23]))))':'2e-5*expected_e'};
            if(abs(bitcast<f32>(out[8])-expected_e)>energy_tolerance){out[0]|=128u;}
            let angular_error=length(v3(&out,10u)-expected_l);out[13]=bitcast<u32>(angular_error);
            let l_tolerance=${surfaceMode?'max(1e-12,3e-5*bitcast<f32>(out[22]))':'2e-5*expected_mass'};
            if(angular_error>l_tolerance){out[0]|=256u;}
            out[19]=bitcast<u32>(length(particle_l-expected_l));
            if(length(particle_l-expected_l)>l_tolerance){out[0]|=2048u;}
            ${surfaceMode ? `if(${surfaceEnabled}&&(changed==0u||!(bitcast<f32>(out[20])>0.0)||!(bitcast<f32>(out[23])<0.0))){out[0]|=512u;}
              if(${!surfaceEnabled}&&(changed!=0u||bitcast<f32>(out[20])!=0.0||bitcast<f32>(out[9])!=0.0||bitcast<f32>(out[23])!=0.0)){out[0]|=1024u;}`
              : `if(${enabled}&&(changed==0u||!(bitcast<f32>(out[9])>1e-8))){out[0]|=512u;}
                 if(${!enabled}&&(changed!=0u||abs(bitcast<f32>(out[9]))>1e-6)){out[0]|=1024u;}`}
            out[14]=changed;out[15]=bitcast<u32>(expected_e);out[16]=bitcast<u32>(expected_l.x);out[17]=bitcast<u32>(expected_l.y);out[18]=bitcast<u32>(expected_l.z);
          }
        }`.replace('v3(&out,5u)','vec3<f32>(bitcast<f32>(out[5]),bitcast<f32>(out[6]),bitcast<f32>(out[7]))').replace('v3(&out,10u)','vec3<f32>(bitcast<f32>(out[10]),bitcast<f32>(out[11]),bitcast<f32>(out[12]))')});
      const compileErrors=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');
      if(compileErrors.length)throw new Error(JSON.stringify(compileErrors));
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
      const pass=check.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
        native.mechanicsFieldView.fieldViewBuffer,result.g2p.stateBuffer,sphParticleUpload.stateBuffer,
        result.publication.controlBuffer,receipt,result.g2p.mechanicsBuffer,mlsMpmParticleUpload.mechanicsBuffer,
        result.execution.correction.nativeStates[level].stateBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))}));
      pass.dispatchWorkgroups(1);pass.end();
    }
    check.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([check.finish()]);
    await readback.mapAsync(1);const words=[...new Uint32Array(readback.getMappedRange())];readback.unmap();
    const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
    return {words,floats:[...new Float32Array(new Uint32Array(words).buffer)],errors,corrupted,torqueCorrupted,geometryCorrupted,surfaceCorrupted,mappedBytes:128};
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
