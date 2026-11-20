import * as abi from '../../ulg-gpu-abi/src/index.js';
import { webGpuDeviceDescriptorForResidentSph } from '../../src/runtime/webgpuDeviceLimits.js';
import { uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers, destroyMlsMpmGpuParticleBuffers } from '../../src/runtime/sph/sphGpuBuffers.js';
import { runSchroederLevelAssignmentWebGpu } from '../../src/runtime/sph/schroederHierarchyGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu,
  releaseSchroederSpatialEpochGenerationAfterQueue, acquireSchroederSpatialEpochGenerationConsumerLease,
  releaseSchroederSpatialEpochGenerationConsumerLeaseAfter } from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createSchroederSpatialChainVolumeGpu } from '../../src/runtime/sph/schroederSpatialChainVolumeGpu.js';
import { abortSchroederSpatialEpochTransaction } from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { createMlsMpmGridSpec } from '../../src/runtime/sph/sphGridGpuKernel.js';
import { runSchroederSpatialChainMechanicsWebGpu } from '../../src/runtime/sph/schroederSpatialChainMechanicsGpu.js';
import { tagWebGpuBufferDevice, tagResidentProductMassDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { registerResidentProductEventCountAuthority, createResidentProductEventCountControlWords,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES } from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { runSphSpatialGasLedgerEosRetainedWebGpu,
  releaseSphSpatialGasLedgerEosAfterQueue } from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';


// Real same-device S9 -> gas ledger/EOS -> chain publication -> G2P. Only the
// 128-byte invariant receipt is mapped; gas cells and particle state stay GPU-owned.
export async function runChainPressureNative({levelCount=3,gradient=10000,scale=1,populated=false,coarseOnly=false,fault=null}={}) {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
  const errors=[];device.addEventListener('uncapturederror',e=>{if(errors.length<20)errors.push(e.error.message);});
  device.pushErrorScope('validation');
  const owned=[];const allocate=(size,usage=140)=>{
    const b=tagWebGpuBufferDevice(device.createBuffer({size,usage}),device);owned.push(b);return b;
  };
  const groups=[],createBindGroup=device.createBindGroup.bind(device);
  device.createBindGroup=descriptor=>{groups.push(descriptor);return createBindGroup(descriptor);};
  let sphParticleUpload,mlsMpmParticleUpload,assignment,generation,transaction,composite,execution,gas,g2p;
  const proposals=[];
  let submitted=false, seedRuntime=null, seedExecution=null, seedLease=null;
  const spacing=levelCount===2 ? 0.25 : 1/2**(levelCount-1);
  try {
    const selected=coarseOnly ? [levelCount-1] : populated ? Array.from({length:levelCount},(_,i)=>i) : [0];
    const count=selected.length;
    const state=new Float32Array(count*8),thermo=new Float32Array(count*12),mechanics=new Float32Array(count*32);
    for(const [i,level] of selected.entries()){
      state.set([1.875,1.875,1.875,1,0,0,0,0],i*8);
      thermo.set([7,1,300,1000,1,0,0,0,spacing*2**level,1,1,0.1],i*12);
      for(const j of [0,4,8,18,20,21,27,31])mechanics[i*32+j]=1;
      mechanics[i*32+19]=0.001;
    }
    const sphParticleState={schema:abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,status:'cpu-derived-gpu-buffer-ready',
      particleCount:count,dimension:3,step:0,time:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0,
      storageGeneration:1,smoothingLengthM:spacing,stateStrideFloats:8,thermoStrideFloats:12,identityStrideUints:1,
      stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,identityRequired:true,
      identityRevision:'chain-pressure-native',renderDomainKeys:{1:'body'},state,thermo,identity:Uint32Array.from(selected,(_,i)=>i+1),metadata:[]};
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
    // Manufacture initial native placement on the GPU. The original producer
    // retains source identities and the complete admitted level range.
    if(levelCount>2){
      const module=device.createShaderModule({code:`
        @group(0) @binding(0) var<storage,read_write> rows:array<f32>;
        @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
          let level=${coarseOnly ? `${levelCount-1}u` : populated ? 'id.x' : '0u'};
          rows[id.x*16u]=f32(level);rows[id.x*16u+1u]=${spacing}*exp2(f32(level));
        }`});
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
      const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
        {binding:0,resource:{buffer:assignment.assignmentBuffer}}]}));pass.dispatchWorkgroups(count);pass.end();
      device.queue.submit([encoder.finish()]);
    }
    const gridSpec=createMlsMpmGridSpec({boxDimsM:[4,4,4],gridSpacingM:spacing});
    const mechanicsLevels=Array.from({length:levelCount},(_,selectedLevel)=>{
      const g=createMlsMpmGridSpec({boxDimsM:[4,4,4],gridSpacingM:spacing*2**selectedLevel});
      return {selectedLevel,mechanicsGrid:{gridDims:g.gridDims,gridNodeCount:g.gridNodeCount,
        gridShift:g.shift,gridSpacingM:g.gridSpacingM,boxDimsM:[4,4,4]}};
    });
    generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:assignment,particleCount:count,
      particleIdentityBuffer:sphParticleUpload.identityBuffer,particleIdentityStrideWords:1,
      selectedLevel:0,mechanicsLevels,exactNearCellTreeEnabled:false});
    if(!generation.ready) throw new Error(`generation: ${generation.reason}`);
    const productEventBuffer=allocate(64*32*4);
    const residentProductMass={schema:'peercompute.ulg.sph-resident-product-mass.v0',status:'resident-product-mass-buffer-retained',
      productEventBuffer,productEventBufferRetained:true,productEventBufferByteLength:64*32*4,
      productEventRowCount:64,productEventStrideFloats:32,productEventDevice:device,__ulgActiveBorrowCount:0};
    tagResidentProductMassDevice(residentProductMass,device);
    const productCount=allocate(SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES);
    device.queue.writeBuffer(productCount,0,createResidentProductEventCountControlWords({liveRowCount:64,rowCapacity:64,
      rowStrideVec4:8,generation:37,seal:0x5a17c0de}));
    registerResidentProductEventCountAuthority(residentProductMass,{device,controlBuffer:productCount,controlOffsetBytes:0,
      rowCapacity:64,rowStrideFloats:32,generation:37,seal:0x5a17c0de});
    const gasGrid=mechanicsLevels.at(-1).mechanicsGrid;
    const gasMoment=generation.mechanicsLevelViews[0].phaseVolumeMoment;
    // Manufacture gas inventory from the actual restricted condensed volume
    // and original grid geometry, without reading either back to the host.
    let seedBuffers;
    if(levelCount>2){
      seedLease=acquireSchroederSpatialEpochGenerationConsumerLease(generation,{consumerId:'native-pressure-manufactured-input'});
      seedRuntime=createSchroederSpatialChainVolumeGpu(device,{
        nativeFieldCapacities:generation.mechanicsLevelViews.map(v=>v.mechanicsFieldView.fieldCapacity),
        parentFieldCapacities:generation.mechanicsAdjacentLevelPairs.map(p=>p.parentFieldView.parentFieldCapacity),arenaCount:1});
      const encoder=device.createCommandEncoder();
      seedExecution=seedRuntime.encode(encoder,{generationReadFamily:seedLease});
      device.queue.submit([encoder.finish()]);seedRuntime.markSubmitted(seedExecution);
      seedBuffers=[seedExecution.coarseVolumeBuffer,generation.mechanicsAdjacentLevelPairs.at(-1).parentFieldView.parentFieldViewBuffer,productEventBuffer];
    }else seedBuffers=[gasMoment.momentBuffer,gasMoment.controlBuffer,generation.parentFieldView.parentFieldViewBuffer,productEventBuffer];
    const seed=device.createShaderModule({code:levelCount>2 ? `
      ${abi.schroederQuadraticControlVolumeProjectionWgsl}
      @group(0) @binding(0) var<storage,read> volume:array<u32>;
      @group(0) @binding(1) var<storage,read> parent:array<u32>;
      @group(0) @binding(2) var<storage,read_write> products:array<f32>;
      @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
        let row=id.x*32u;let cell=vec3<i32>(i32(id.x/16u),i32((id.x/4u)%4u),i32(id.x%4u));
        var condensed=0.0;
        for(var i=0u;i<volume[5];i++){
          let dense=parent[parent[48]+i*4u];
          let node=vec3<i32>(i32(dense/${gasGrid.gridDims[1]*gasGrid.gridDims[2]}u),
            i32((dense/${gasGrid.gridDims[2]}u)%${gasGrid.gridDims[1]}u),i32(dense%${gasGrid.gridDims[2]}u))
            -vec3<i32>(${gasGrid.gridShift});
          var weight=1.0;
          for(var axis=0u;axis<3u;axis++){
            let q=qcv_axis_projection(node[axis],0,0.0,4,0.0);
            weight*=select(0.0,q.weight0,q.cell0==cell[axis])+select(0.0,q.weight1,q.cell1==cell[axis]);
          }
          condensed+=weight*bitcast<f32>(volume[64u+i]);
        }
        let position=vec3<f32>(cell)+vec3<f32>(0.5);
        let free=1.0-condensed;let pressure=101325.0+${Number(gradient).toFixed(1)}*position.x;
        let moles=pressure*free/(8.314462618*300.0);let mass=moles*0.04;
        products[row]=position.x;products[row+1u]=position.y;products[row+2u]=position.z;
        products[row+3u]=mass;products[row+4u]=9.0;products[row+9u]=moles;products[row+10u]=1.0;
        products[row+13u]=mass;products[row+16u]=300.0;products[row+17u]=mass/free;
        products[row+18u]=1.0;products[row+23u]=free;
      }` : `
      @group(0) @binding(0) var<storage,read> moment:array<u32>;
      @group(0) @binding(1) var<storage,read> control:array<u32>;
      @group(0) @binding(2) var<storage,read> parent:array<u32>;
      @group(0) @binding(3) var<storage,read_write> products:array<f32>;
      @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
        let row=id.x*32u;let cell=vec3<i32>(2+i32(id.x/16u),2+i32((id.x/4u)%4u),2+i32(id.x%4u));
        var condensed=0.0;
        for(var i=0u;i<control[18];i++){
          let m=control[28]+i*control[29];let volume=bitcast<f32>(moment[m+4]);
          for(var edge=parent[parent[51]+i];edge<parent[parent[51]+i+1u];edge++){
            let destination=parent[parent[52]+edge];let dense=parent[parent[48]+destination*4u];
            let node=vec3<i32>(i32(dense/${gasGrid.gridDims[1]*gasGrid.gridDims[2]}u),
              i32((dense/${gasGrid.gridDims[2]}u)%${gasGrid.gridDims[1]}u),i32(dense%${gasGrid.gridDims[2]}u))
              -vec3<i32>(${gasGrid.gridShift});
            if(all(node>=cell)&&all(node<=cell+vec3<i32>(1))){condensed+=0.125*volume*bitcast<f32>(parent[parent[53]+edge]);}
          }
        }
        let position=(vec3<f32>(cell)+vec3<f32>(0.5))*0.5;
        let free=0.125-condensed;let pressure=101325.0+${Number(gradient).toFixed(1)}*position.x;
        let moles=pressure*free/(8.314462618*300.0);let mass=moles*0.04;
        products[row]=position.x;products[row+1u]=position.y;products[row+2u]=position.z;
        products[row+3u]=mass;products[row+4u]=9.0;products[row+9u]=moles;products[row+10u]=1.0;
        products[row+13u]=mass;products[row+16u]=300.0;products[row+17u]=mass/free;
        products[row+18u]=1.0;products[row+23u]=free;
      }`});
    const seedErrors=(await seed.getCompilationInfo()).messages.filter(m=>m.type==='error');
    if(seedErrors.length)throw new Error(JSON.stringify(seedErrors.map(m=>m.message)));
    const seedPipeline=device.createComputePipeline({layout:'auto',compute:{module:seed,entryPoint:'main'}});
    const seedEncoder=device.createCommandEncoder(),seedPass=seedEncoder.beginComputePass();seedPass.setPipeline(seedPipeline);
    seedPass.setBindGroup(0,device.createBindGroup({layout:seedPipeline.getBindGroupLayout(0),entries:seedBuffers
      .map((buffer,binding)=>({binding,resource:{buffer}}))}));seedPass.dispatchWorkgroups(64);seedPass.end();
    device.queue.submit([seedEncoder.finish()]);
    const moment=generation.mechanicsLevelViews[0].phaseVolumeMoment;
    const epochIdentity=Object.fromEntries(['storageGeneration','physicsTick','physicsSubstep','positionEpoch',
      'topologyEpoch','chartEpoch','levelEpoch','supportEpoch'].map(key=>[key,moment[key]]));
    gas=await runSphSpatialGasLedgerEosRetainedWebGpu({device,residentProductMass,productEventBuffer,
      productEventRowCount:64,productEventStrideFloats:32,epochIdentity,schroederSpatialEpochGeneration:generation,
      spatialGasGrid:{...gasGrid,selectedLevel:levelCount-1,levelCount},
      boxMinM:[0,0,0],boxMaxM:[4,4,4],spatialGasCellSizeM:gasGrid.gridSpacingM,
      spatialGasSupportVolumeFallbackM3:0,fallbackTemperatureK:300,chartId:0,level:levelCount-1,diagnosticsMode:'none'});
    if(!gas.ready) throw new Error(`EOS: ${gas.status}: ${gas.reason}`);
    if(fault==='edge'){
      const parent=generation.mechanicsAdjacentLevelPairs[1].parentFieldView;
      device.queue.writeBuffer(parent.parentFieldViewBuffer,parent.layout.fineEdgeWeightOffsetWords*4,new Uint32Array([0]));
    }
    if(fault==='pressure'){
      const group=groups.find(g=>g.label?.endsWith('-eos-aggregate-bind-group'));
      const pressure=group.entries.find(e=>e.binding===2).resource.buffer;
      const module=device.createShaderModule({code:`
        @group(0) @binding(0) var<storage,read_write> pressure:array<u32>;
        @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
          pressure[id.x*12u+7u]=0x7fc00000u|id.x;
        }`});
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
      const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:pressure}}]}));
      pass.dispatchWorkgroups(64);pass.end();device.queue.submit([encoder.finish()]);
    }
    const result=await runSchroederSpatialChainMechanicsWebGpu({device,source,generation,mechanicsLevels,
      forceInputs:{dt:0.001,gravityMPerS2:[0,0,0],boxDimsM:[4,4,4],wallsEnabled:false,contactEnabled:false,cflFactor:0.4,
        wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:0,wallBarrierMinGapM:1e-6},
      internalPressureScale:1,mechanicsOptions:{ambientPressurePa:101325,relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024},
      localLawInputs:mechanicsLevels.map((_,i)=>({ambientPressurePa:101325,...((i===0 || levelCount>2) ? {
        gasPressureMechanicsAuthoritySource:gas.retainedGasCellFieldSource,gasPressureMechanicsScale:scale}: {})}))});
    ({transaction,composite,execution,g2p}=result);submitted=true;proposals.push(...result.proposals);
    const {publication}=result;
    const receipt=allocate(128),readback=allocate(128,9);
    const check=device.createCommandEncoder();
    for(const [level,native] of generation.mechanicsLevelViews.entries()){
    const module=device.createShaderModule({code:`
      @group(0) @binding(0) var<storage,read> field:array<u32>;
      @group(0) @binding(1) var<storage,read> state:array<u32>;
      @group(0) @binding(2) var<storage,read> old:array<u32>;
      @group(0) @binding(3) var<storage,read> control:array<u32>;
      @group(0) @binding(4) var<storage,read_write> out:array<u32>;
      @group(0) @binding(5) var<storage,read> mechanics:array<u32>;
      @group(0) @binding(6) var<storage,read> old_mechanics:array<u32>;
      @compute @workgroup_size(1) fn main() {
        out[1]=control[2];out[2]=control[18];out[3]=field[2];
        if(control[2]==5u) {
          for(var i=0u;i<arrayLength(&state);i++){if(state[i]!=old[i]){out[0]|=1u;}}
          for(var i=0u;i<arrayLength(&mechanics);i++){if(mechanics[i]!=old_mechanics[i]){out[0]|=16u;}}
          return;
        }
        if(control[2]!=3u || control[20]!=3u || field[2]!=3u){out[0]|=2u;}
        var momentum=vec3<f32>(0);var impulse=vec3<f32>(0);var energy=0.0;var work=0.0;var mass=0.0;
        for(var i=0u;i<field[34];i++){
          let s=field[30]+i*8u;let a=field[28]+i*8u;let m=bitcast<f32>(field[s]);
          let v=vec3<f32>(bitcast<f32>(field[s+1]),bitcast<f32>(field[s+2]),bitcast<f32>(field[s+3]));
          mass+=m;momentum+=m*v;energy+=0.5*m*dot(v,v)+bitcast<f32>(field[a]);
          impulse+=vec3<f32>(bitcast<f32>(field[a+4]),bitcast<f32>(field[a+5]),bitcast<f32>(field[a+6]));
          work+=bitcast<f32>(field[a+7]);
        }
        if(abs(mass-${selected.includes(level) ? "1.0" : "0.0"})>1e-5 || any(abs(momentum-impulse)>vec3<f32>(1e-5))
          || abs(energy-work)>max(1e-8,abs(work)*5e-5)){out[0]|=4u;}
        for(var i=0u;i<${count}u;i++){if(state[i*8u+3u]!=old[i*8u+3u]){out[0]|=8u;}}
        ${level===0 ? `for(var i=0u;i<${count}u;i++){
          let vx=bitcast<f32>(state[i*8u+4u]);
          ${!gradient || scale===0 ? 'if(abs(vx)>1e-7){out[0]|=32u;}' : `if(!(vx*${Number(gradient).toFixed(1)}<0.0) || abs(vx)<1e-4){out[0]|=32u;}`}
        }` : ''}
        out[4]=state[4];out[5]=state[5];out[6]=state[6];
        out[7]=bitcast<u32>(bitcast<f32>(out[7])+work);out[8]=bitcast<u32>(bitcast<f32>(out[8])+energy);
        out[9]=bitcast<u32>(bitcast<f32>(out[9])+momentum.x);out[10]=bitcast<u32>(bitcast<f32>(out[10])+mass);
      }`});
    const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
    const pass=check.beginComputePass();pass.setPipeline(pipeline);
    pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
      native.mechanicsFieldView.fieldViewBuffer,g2p.stateBuffer,sphParticleUpload.stateBuffer,
      publication.controlBuffer,receipt,g2p.mechanicsBuffer,mlsMpmParticleUpload.mechanicsBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))}));
    pass.dispatchWorkgroups(1);pass.end();
    }
    check.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([check.finish()]);
    await readback.mapAsync(1);const words=[...new Uint32Array(readback.getMappedRange())];readback.unmap();
    await device.queue.onSubmittedWorkDone();
    const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
    return {words,errors,mappedBytes:128,boundarySubmitted:publication.updates[0].gasPressureBoundarySubmitted,
      nativeBoundariesSubmitted:publication.updates.filter(u=>u.gasPressureBoundarySubmitted).length,
      eosRetired:gas.released,
      eosReadbackBytes:gas.observedReadbackBytes,eosHostQueueFenceCount:gas.observedHostQueueFenceCount};
  } finally {
    await device.queue.onSubmittedWorkDone();g2p?.destroyOutputParticleBuffers();
    for(const p of proposals) if(!p.released) await p.releaseAfterSubmittedWork();
    if(execution){if(submitted)await composite.releaseExecutionAfter(execution);else composite.discardExecution(execution,{discardedEncoder:true});}
    composite?.destroy();
    if(gas){releaseSphSpatialGasLedgerEosAfterQueue(gas);if(gas.cleanupPromise)await gas.cleanupPromise;}
    if(transaction)abortSchroederSpatialEpochTransaction(transaction);
    if(seedExecution)await seedRuntime.releaseAfter(seedExecution);
    if(seedLease)await releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(seedLease,device.queue.onSubmittedWorkDone());
    seedRuntime?.destroy();
    if(generation&&!generation.released){releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);await generation.releasePromise;}
    assignment?.destroyAssignmentBuffer?.();
    if(sphParticleUpload)destroySphGpuParticleBuffers(sphParticleUpload);
    if(mlsMpmParticleUpload)destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
    for(const b of owned)b.destroy();device.destroy();
  }
}
