import { createSphExactHistoryGasVolumeWgsl } from '../../src/runtime/sph/sphExactHistoryGasVolumeWgsl.js';
import { createSphSpatialGasFreeVolumeLayout } from '../../ulg-gpu-abi/src/sphSpatialGasFreeVolume.js';
import { schroederQuadraticControlVolumeProjectionWgsl } from '../../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjectionWgsl.js';
import { webGpuDeviceDescriptorForResidentSph } from '../../src/runtime/webgpuDeviceLimits.js';
import { tagWebGpuBufferDevice, tagResidentProductMassDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { runSchroederSpatialEpochGenerationWebGpu, releaseSchroederSpatialEpochGenerationAfterQueue }
  from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createSchroederSpatialEpochTransaction, abortSchroederSpatialEpochTransaction }
  from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { createSphAerosolParcelFamilyWebGpu, releaseSphAerosolParcelFamily }
  from '../../src/runtime/sph/sphAerosolParcelGpu.js';
import { registerResidentProductEventCountAuthority, createResidentProductEventCountControlWords,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES } from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { runSphSpatialGasLedgerEosRetainedWebGpu, releaseSphSpatialGasLedgerEosAfterQueue, SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS }
  from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';

// Original generation -> original EOS/free-volume owner. Only the fixed GPU
// invariant record is mapped, never the gas/particle/aerosol payload.
export async function runChainGasVolumeNative({levelCount=3,populated=false,coarseOnly=false,aerosols=false,fault=null}={}) {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
  const errors=[],owned=[],groups=[],cycles=[];
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.pushErrorScope('validation');
  const createGroup=device.createBindGroup.bind(device);
  device.createBindGroup=d=>{groups.push(d);return createGroup(d);};
  const allocate=(size,usage=140)=>{const b=tagWebGpuBufferDevice(device.createBuffer({size,usage}),device);owned.push(b);return b;};
  const upload=data=>{const b=allocate(data.byteLength);device.queue.writeBuffer(b,0,data);return b;};
  const epochs={storageGeneration:1,physicsTick:0,physicsSubstep:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0};
  const selected=coarseOnly ? [levelCount-1] : populated ? Array.from({length:levelCount},(_,i)=>i) : [0];
  const count=selected.length,spacing=1/2**(levelCount-1);
  const rows=new Float32Array(count*16),state=new Float32Array(count*8),thermo=new Float32Array(count*12),mechanics=new Float32Array(count*32);
  for(const [i,level] of selected.entries()) {
    rows.set([level,spacing*2**level,1,0.001,0.001,0.001,1,1000,1,26,1,0.15,1.84375,1.84375,1.84375,0],i*16);
    state.set([1.84375,1.84375,1.84375,1,0,0,0,0],i*8);
    thermo.set([26,1,300,1000,1,0,0,0,spacing,1,1,0.1],i*12);
    for(const w of [0,4,8,18,20,21,27,31])mechanics[i*32+w]=1;mechanics[i*32+19]=0.001;
  }
  const assignmentBuffer=upload(rows),sourceStateBuffer=upload(state),sourceThermoBuffer=upload(thermo),
    sourceMechanicsBuffer=upload(mechanics),identityBuffer=upload(Uint32Array.from(selected,(_,i)=>101+i));
  const family=aerosols ? createSphAerosolParcelFamilyWebGpu({device,capacity:7,parcels:[{
    slot:3,parcelId:1n,nucleusPopulationId:7n,physicalMultiplicity:8n,sourceLineageIndex:0xffffffff,
    sourceTopologyEpoch:0,materialId:9,phaseId:2,positionM:[1.84375,1.84375,1.84375],massKg:1,
    velocityMPerS:[0,0,0],specificInternalEnergyJPerKg:0,temperatureK:300,condensedDensityKgM3:1000
  }],provenance:{kind:'initial-conditions',reference:'native-chain-gas-volume'}}) : null;
  const sphParticleUpload={schema:'peercompute.ulg.sph-gpu-particle-buffer-set.v0',status:'webgpu-uploaded',
    particleCount:count,stateBuffer:sourceStateBuffer,stateBufferByteLength:state.byteLength,stateStrideBytes:32,
    thermoBuffer:sourceThermoBuffer,thermoBufferByteLength:thermo.byteLength,thermoStrideBytes:48,
    identityBuffer,identityBufferByteLength:count*4,identityStrideBytes:4,identityRevision:'native-chain-gas-volume',
    ...epochs,...(family?{aerosolFamily:family}:{})};
  const mlsMpmParticleUpload={schema:'peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0',status:'webgpu-uploaded',
    particleCount:count,mechanicsBuffer:sourceMechanicsBuffer,mechanicsBufferByteLength:mechanics.byteLength,mechanicsStrideBytes:128,...epochs};
  const levelAssignment={schema:'peercompute.ulg.schroeder-level-assignment-execution.v0',status:'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:'schroeder-particle-buffer-family-generation-ready',particleCount:count,assignmentStrideFloats:16,
    assignmentBuffer,assignmentBufferByteLength:rows.byteLength,sourceStateBuffer,sourceStateBufferBorrowed:true,
    sourceStateBufferByteLength:state.byteLength,sourceThermoBuffer,sourceThermoBufferBorrowed:true,
    sourceThermoBufferByteLength:thermo.byteLength,sourceMechanicsBuffer,sourceMechanicsBufferBorrowed:true,
    sourceMechanicsBufferByteLength:mechanics.byteLength,sourceIdentityBuffer:identityBuffer,sourceIdentityBufferBorrowed:true,
    sourceIdentityBufferByteLength:count*4,...epochs,minLevel:0,maxLevel:levelCount-1,chartId:0,baseGridSpacingM:spacing};
  const mechanicsLevels=Array.from({length:levelCount},(_,selectedLevel)=>{
    const gridSpacingM=spacing*2**selectedLevel,n=4/gridSpacingM+5;
    return {selectedLevel,mechanicsGrid:{gridDims:[n,n,n],gridNodeCount:n**3,gridShift:2,gridSpacingM,boxDimsM:[4,4,4]}};
  });
  const products=new Float32Array(64*32);
  for(let i=0;i<64;i++){
    const at=i*32;products.set([Math.floor(i/16)+0.5,Math.floor(i/4)%4+0.5,i%4+0.5],at);
    products[at+3]=0.00004;products[at+4]=9;products[at+9]=0.001;products[at+10]=1;
    products[at+13]=0.00004;products[at+16]=300;products[at+17]=0.00004;products[at+18]=1;products[at+23]=1;
  }
  const productEventBuffer=upload(products),productCount=allocate(SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES);
  const residentProductMass={schema:'peercompute.ulg.sph-resident-product-mass.v0',status:'resident-product-mass-buffer-retained',
    productEventBuffer,productEventBufferRetained:true,productEventBufferByteLength:products.byteLength,
    productEventRowCount:64,productEventStrideFloats:32,productEventDevice:device,__ulgActiveBorrowCount:0};
  tagResidentProductMassDevice(residentProductMass,device);
  device.queue.writeBuffer(productCount,0,createResidentProductEventCountControlWords({liveRowCount:64,rowCapacity:64,
    rowStrideVec4:8,generation:37,seal:0x5a17c0de}));
  registerResidentProductEventCountAuthority(residentProductMass,{device,controlBuffer:productCount,controlOffsetBytes:0,
    rowCapacity:64,rowStrideFloats:32,generation:37,seal:0x5a17c0de});
  const receipt=allocate(128),readback=allocate(128,9);
  let generation,transaction,gas;
  try {
    const historyModule=device.createShaderModule({code:createSphExactHistoryGasVolumeWgsl(createSphSpatialGasFreeVolumeLayout({cellCapacity:64}))});
    const historyErrors=(await historyModule.getCompilationInfo()).messages.filter(m=>m.type==='error');
    if(historyErrors.length)throw new Error(historyErrors.map(m=>m.message).join('\n'));
    for(let cycle=0;cycle<2;cycle++) {
      generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment,particleCount:count,
        particleIdentityBuffer:identityBuffer,particleIdentityStrideWords:1,mechanicsLevels,exactNearCellTreeEnabled:false});
      if(!generation.ready)throw new Error(generation.reason);
      transaction=createSchroederSpatialEpochTransaction({device,generation,sphParticleUpload,mlsMpmParticleUpload,
        mechanicsChainAuthoritative:levelCount>2,twoLevelAuthoritative:levelCount===2});
      if(fault==='moment') {
        const m=generation.mechanicsLevelViews[1].phaseVolumeMoment;
        device.queue.writeBuffer(m.controlBuffer,23*4,new Uint32Array([m.completionOrdinal+1]));
      }
      if(fault==='edge') {
        const p=generation.mechanicsAdjacentLevelPairs[1].parentFieldView;
        device.queue.writeBuffer(p.parentFieldViewBuffer,p.layout.fineEdgeWeightOffsetWords*4,new Uint32Array([0]));
      }
      const start=groups.length;
      gas=await runSphSpatialGasLedgerEosRetainedWebGpu({device,sphParticleUpload,mlsMpmParticleUpload,
        schroederLevelAssignment:levelAssignment,residentProductMass,productEventBuffer,productEventRowCount:64,
        productEventStrideFloats:32,epochIdentity:epochs,schroederSpatialEpochGeneration:generation,
        spatialGasGrid:{...mechanicsLevels.at(-1).mechanicsGrid,selectedLevel:levelCount-1,levelCount},
        boxMinM:[0,0,0],boxMaxM:[4,4,4],spatialGasCellSizeM:1,spatialGasSupportVolumeFallbackM3:0,
        fallbackTemperatureK:300,chartId:0,level:levelCount-1,diagnosticsMode:'none'});
      if(!gas.ready)throw new Error(`EOS: ${gas.status}: ${gas.reason}`);
      const eos=groups.slice(start).find(g=>g.label?.endsWith('-eos-aggregate-bind-group'));
      if(!eos)throw new Error('Missing original EOS bindings');
      const bound=n=>eos.entries.find(e=>e.binding===n).resource.buffer;
      const compareAuxiliary=levelCount>2 && aerosols && !populated && !coarseOnly && !fault;
      const chainGroup=compareAuxiliary ? groups.slice(start).find(g=>g.label?.endsWith('-scatter-chain-bindings')) : null;
      if(compareAuxiliary && !chainGroup)throw new Error('Missing actual chain restriction bindings');
      const module=device.createShaderModule({code:`
        ${compareAuxiliary ? schroederQuadraticControlVolumeProjectionWgsl + `
        @group(0) @binding(5) var<storage,read> restricted:array<u32>;
        @group(0) @binding(6) var<storage,read> topology:array<u32>;
        fn expected_occupancy(cell:vec3<i32>)->f32 {
          var result=0.0;
          for(var j=0u;j<restricted[5];j++){
            let dense=topology[topology[48]+j*4u];
            let node=vec3<i32>(i32(dense/81u),i32((dense/9u)%9u),i32(dense%9u))-vec3<i32>(2);
            var weight=1.0;
            for(var axis=0u;axis<3u;axis++){
              let q=qcv_axis_projection(node[axis],0,0.0,4,0.0);
              weight*=select(0.0,q.weight0,q.cell0==cell[axis])+select(0.0,q.weight1,q.cell1==cell[axis]);
            }
            result+=2.0*weight*bitcast<f32>(restricted[64u+j]);
          }
          return result;
        }` : ''}
        @group(0) @binding(0) var<storage,read> header:array<u32>;
        @group(0) @binding(1) var<storage,read> volume:array<u32>;
        @group(0) @binding(2) var<storage,read> pressure:array<f32>;
        @group(0) @binding(3) var<storage,read> eos:array<u32>;
        @group(0) @binding(4) var<storage,read_write> out:array<u32>;
        @compute @workgroup_size(1) fn main(){
          out[1]=header[2];out[2]=header[3];out[3]=eos[3];out[4]=header[10];out[5]=header[22];out[8]=volume[0];out[9]=bitcast<u32>(pressure[0]);
          ${fault ? 'if(header[3]==0u || (header[2]&4u)==0u || eos[3]==0u){out[0]|=1u;}' : `
          if(header[2]!=3u || header[3]!=0u || eos[3]!=0u || header[10]!=${levelCount}u || header[22]!=64u){out[0]|=1u;}
          var occupied=0.0;var deficit=0.0;
          for(var i=0u;i<header[22];i++){
            let v=i*4u;let p=i*${SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS}u;
            let geometry=bitcast<f32>(volume[v]);let c=bitcast<f32>(volume[v+1u]);let f=bitcast<f32>(volume[v+2u]);
            occupied+=c;
            // Reduce deviations from the manufactured unit-cell capacity.
            // This avoids repeatedly adding tiny deficits to a total near 64.
            deficit+=1.0-f;
            ${compareAuxiliary ? `let cell=vec3<i32>(i32(pressure[p]),i32(pressure[p+1u]),i32(pressure[p+2u]));
            if(abs(c-expected_occupancy(cell))>1e-8){out[0]|=64u;}` : ''}
            if(abs(geometry-1.0)>1e-6 || abs(f-(1.0-c))>1e-6 || abs(pressure[p+11u]-f)>1e-6){out[0]|=2u;}
            let expected=0.001*8.314462618*300.0/f;
            if(abs(pressure[p+7u]-expected)>expected*1e-5){out[0]|=4u;}
          }
          let free=64.0-deficit;out[6]=bitcast<u32>(occupied);out[7]=bitcast<u32>(free);
          if(abs(occupied-${(0.001*(count+Number(aerosols))).toFixed(6)})>1e-7){out[0]|=8u;}
          if(abs(free-(64.0-occupied))>2e-5){out[0]|=16u;}
          ${aerosols ? 'if(header[39]!=7u || header[40]!=1u || header[41]!=0u || header[43]!=header[4]){out[0]|=32u;}' : ''}
          `}
        }`});
      const compile=(await module.getCompilationInfo()).messages.filter(m=>m.type==='error');
      if(compile.length)throw new Error(compile.map(m=>m.message).join('\n'));
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
      const encoder=device.createCommandEncoder();encoder.clearBuffer(receipt);
      const pass=encoder.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[bound(6),bound(5),bound(2),bound(4),receipt,
        ...(compareAuxiliary ? [9,10].map(n=>chainGroup.entries.find(e=>e.binding===n).resource.buffer) : [])]
        .map((buffer,binding)=>({binding,resource:{buffer}}))}));pass.dispatchWorkgroups(1);pass.end();
      encoder.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([encoder.finish()]);
      await readback.mapAsync(1);const words=[...new Uint32Array(readback.getMappedRange())];readback.unmap();
      releaseSphSpatialGasLedgerEosAfterQueue(gas);gas=null;
      abortSchroederSpatialEpochTransaction(transaction,'native gas-volume proof complete');transaction=null;
      releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);await generation.releasePromise;generation=null;
      cycles.push({words});
    }
    const error=await device.popErrorScope();if(error)errors.push(error.message);
    return {cycles,errors,mappedBytesPerCycle:128};
  } finally {
    await device.queue.onSubmittedWorkDone();
    if(gas)releaseSphSpatialGasLedgerEosAfterQueue(gas);
    if(transaction)abortSchroederSpatialEpochTransaction(transaction,'native gas-volume cleanup');
    if(generation){releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);await generation.releasePromise;}
    if(family)releaseSphAerosolParcelFamily(family);
    await device.queue.onSubmittedWorkDone();for(const b of owned)b.destroy();device.destroy();
  }
}
