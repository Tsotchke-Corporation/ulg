import { webGpuDeviceDescriptorForResidentSph } from '../../src/runtime/webgpuDeviceLimits.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { runSchroederSpatialEpochGenerationWebGpu, releaseSchroederSpatialEpochGenerationAfterQueue,
  acquireSchroederSpatialEpochGenerationConsumerLease, releaseSchroederSpatialEpochGenerationConsumerLeaseAfter
} from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createSchroederSpatialChainVolumeGpu } from '../../src/runtime/sph/schroederSpatialChainVolumeGpu.js';
import { createSchroederSpatialChainVolumeWgsl, createSchroederSpatialChainVolumeAdjointWgsl } from '../../ulg-gpu-abi/src/schroederSpatialChainVolumeWgsl.js';

export async function runChainVolumeNative({levelCount=3,populated=false,constant=false,nonlinear=false,coarseOnly=false,gas=false,fault=null,phaseMoments=false,cohortTagged=false}={}) {
  const width=phaseMoments ? 4 : 1;
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(webGpuDeviceDescriptorForResidentSph(adapter));
  const errors=[],owned=[],cycles=[];
  device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
  device.pushErrorScope('validation');
  const allocate=(size,usage=140)=>{
    const b=tagWebGpuBufferDevice(device.createBuffer({size,usage}),device);owned.push(b);return b;
  };
  let generation,lease,runtime,execution;
  try {
    for(const code of [createSchroederSpatialChainVolumeWgsl({phaseMoments}),createSchroederSpatialChainVolumeAdjointWgsl({phaseMoments})]){
      const info=await device.createShaderModule({code}).getCompilationInfo();
      const failures=info.messages.filter(m=>m.type==='error');
      if(failures.length)throw new Error(failures.map(m=>m.message).join('\n'));
    }
    const selected=coarseOnly ? [levelCount-1] : populated ? Array.from({length:levelCount},(_,i)=>i) : [0,Math.min(2,levelCount-1)];
    const particleCount=selected.length,rows=new Float32Array(particleCount*16),state=new Float32Array(particleCount*8);
    const mechanics=new Float32Array(particleCount*32);
    for(const [i,level] of selected.entries()){
      const phase=gas && i===selected.length-1 ? 3 : i%2 ? 2 : 1;
      rows.set([level,0.5*2**level,1,0.001,0.001,0.001,1,1000,phase,cohortTagged?26+i:26,1,0.15,8.25,8.25,8.25,0],i*16);
      state.set([8.25,8.25,8.25,1,0,0,0,0],i*8);
      mechanics.set([1,0,0,0,1,0,0,0,1],i*32);
      mechanics[i*32+19]=0.001;for(const w of [18,20,21,27,31])mechanics[i*32+w]=1;
    }
    const assignmentBuffer=allocate(rows.byteLength),sourceStateBuffer=allocate(state.byteLength),
      sourceMechanicsBuffer=allocate(mechanics.byteLength),particleIdentityBuffer=allocate(particleCount*4);
    device.queue.writeBuffer(assignmentBuffer,0,rows);device.queue.writeBuffer(sourceStateBuffer,0,state);
    device.queue.writeBuffer(sourceMechanicsBuffer,0,mechanics);
    device.queue.writeBuffer(particleIdentityBuffer,0,new Uint32Array(selected.map((_,i)=>101+i)));
    const levelAssignment={schema:'peercompute.ulg.schroeder-level-assignment-execution.v0',status:'schroeder-level-assignment-submitted',
      bufferFamilyGenerationStatus:'schroeder-particle-buffer-family-generation-ready',particleCount,assignmentStrideFloats:16,
      assignments:rows,assignmentBuffer,assignmentBufferByteLength:rows.byteLength,sourceStateBuffer,sourceStateBufferBorrowed:true,
      sourceMechanicsBuffer,sourceMechanicsBufferBorrowed:true,sourceMechanicsBufferByteLength:mechanics.byteLength,
      storageGeneration:1,physicsTick:0,physicsSubstep:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0,
      minLevel:0,maxLevel:levelCount-1,chartId:0,baseGridSpacingM:0.5};
    const mechanicsLevels=Array.from({length:levelCount},(_,selectedLevel)=>{
      const gridSpacingM=0.5*2**selectedLevel,n=32/gridSpacingM+5;
      return {selectedLevel,mechanicsGrid:{gridNodeCount:n**3,gridDims:[n,n,n],gridShift:1,gridSpacingM,boxDimsM:[32,32,32]}};
    });
    const receipt=allocate(128),readback=allocate(128,9);
    const encode=(encoder,code,buffers,count=1)=>{
      const module=device.createShaderModule({code});
      const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
      const pass=encoder.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0,device.createBindGroup({layout:pipeline.getBindGroupLayout(0),
        entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))}));
      pass.dispatchWorkgroups(count);pass.end();
    };
    for(let cycle=0;cycle<2;cycle++){
      generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment,particleCount,particleIdentityBuffer,
        particleIdentityStrideWords:1,mechanicsLevels});
      if(!generation.ready)throw new Error(generation.reason);
      lease=acquireSchroederSpatialEpochGenerationConsumerLease(generation,{consumerId:'native-chain-volume-proof'});
      const parents=generation.mechanicsAdjacentLevelPairs.map(p=>p.parentFieldView);
      if(!runtime)runtime=createSchroederSpatialChainVolumeGpu(device,{
        parentFieldCapacities:parents.map(p=>p.parentFieldCapacity),
        nativeFieldCapacities:generation.mechanicsLevelViews.map(v=>v.mechanicsFieldView.fieldCapacity),arenaCount:1,phaseMoments});
      let cloneRejected=false;
      try{runtime.encode(device.createCommandEncoder(),{generationReadFamily:{...lease}});}catch{cloneRejected=true;}
      const top=parents.at(-1),coarse=allocate(top.parentFieldCapacity*width*4);
      const encoder=device.createCommandEncoder();encoder.clearBuffer(receipt);
      encode(encoder,`
        @group(0) @binding(0) var<storage,read> t:array<u32>;
        @group(0) @binding(1) var<storage,read_write> values:array<f32>;
        @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
          if(id.x>=t[37]){return;}let node=t[t[48]+id.x*4u];
          let x=(f32(node/(t[24]*t[25]))-f32(t[27]))*bitcast<f32>(t[29]);
          let y=(f32((node/t[25])%t[24])-f32(t[27]))*bitcast<f32>(t[29]);
          let z=(f32(node%t[25])-f32(t[27]))*bitcast<f32>(t[29]);
          for(var component=0u;component<${width}u;component++){
            values[id.x*${width}u+component]=${cohortTagged ? '(1.0+0.125*f32(t[t[48]+id.x*4u+1u])+0.015625*f32(t[t[48]+id.x*4u+2u])+0.001953125*f32(t[t[48]+id.x*4u+3u]))*' : ''}f32(component+1u)*(${constant ? '7.0' : nonlinear ? 'sin(0.7*x)+cos(0.4*y)-0.02*z*z' : '3.0+0.25*x-0.125*y+0.375*z'});
          }
          ${fault==='coefficient' ? 'if(id.x==0u){values[id.x]=bitcast<f32>(0x7fc00000u|id.x);}' : ''}
        }`,[top.parentFieldViewBuffer,coarse],top.parentFieldCapacity);
      if(fault==='moment'){
        const m=generation.mechanicsLevelViews[Math.min(1,levelCount-1)].phaseVolumeMoment;
        device.queue.writeBuffer(m.controlBuffer,23*4,new Uint32Array([m.completionOrdinal+1]));
      }
      if(fault==='edge'){
        const parent=parents[Math.min(1,parents.length-1)];
        device.queue.writeBuffer(parent.parentFieldViewBuffer,parent.layout.fineEdgeWeightOffsetWords*4,new Uint32Array([0]));
      }
      if(fault==='gradient'){
        const m=generation.mechanicsLevelViews[selected[0]].phaseVolumeMoment;
        device.queue.writeBuffer(m.momentBuffer,5*4,new Uint32Array([0x7fc00000]));
      }
      if(fault==='zero-volume-gradient'){
        const m=generation.mechanicsLevelViews[selected[0]].phaseVolumeMoment;
        device.queue.writeBuffer(m.momentBuffer,4*4,new Float32Array([0,1,0,0]));
      }
      execution=runtime.encode(encoder,{generationReadFamily:lease});
      if(execution.rowStrideWords!==width || execution.phaseMoments!==phaseMoments
        || (phaseMoments && (execution.coarseVolumeBuffer!==null || execution.volumeBuffers!==null))) {
        throw new Error('Phase moments must not masquerade as scalar EOS occupancy');
      }
      const cloneExecutionRejected=!runtime.ownsExecution({...execution});
      const middle=generation.mechanicsLevelViews[Math.floor(levelCount/2)].phaseVolumeMoment;
      const originalOrdinal=middle.completionOrdinal;middle.completionOrdinal=originalOrdinal+1;
      const changedOrdinalRejected=!runtime.ownsExecution(execution);middle.completionOrdinal=originalOrdinal;
      if(!runtime.ownsExecution(execution))throw new Error('Original source did not recover after metadata restoration');
      let backpressureRejected=false;
      try{runtime.encode(device.createCommandEncoder(),{generationReadFamily:lease});}catch{backpressureRejected=true;}
      runtime.encodePullback(encoder,execution,{coarseValuesBuffer:coarse});
      const rejected=Boolean(fault);
      encode(encoder,`
        @group(0) @binding(0) var<storage,read> volume:array<u32>;
        @group(0) @binding(1) var<storage,read> values:array<f32>;
        @group(0) @binding(2) var<storage,read> control:array<u32>;
        @group(0) @binding(3) var<storage,read_write> out:array<u32>;
        ${phaseMoments && !rejected ? '@group(0) @binding(4) var<storage,read> topology:array<u32>;' : ''}
        @compute @workgroup_size(1) fn main(){
          out[1]=control[2];out[2]=control[3];out[3]=volume[2];
          ${rejected ? 'out[7]=bitcast<u32>(values[0]);if(control[2]!=5u || control[3]==0u){out[0]|=1u;}' : `
          if(control[2]!=3u || control[3]!=0u || volume[2]!=3u){out[0]|=1u;}
          var sum=0.0;var work=0.0;
          for(var i=0u;i<volume[5];i++){
            sum+=bitcast<f32>(volume[64u+i*${width}u]);
            for(var component=0u;component<${width}u;component++){
              work+=bitcast<f32>(volume[64u+i*${width}u+component])*values[i*${width}u+component];
            }
          }
          out[4]=bitcast<u32>(sum);out[5]=bitcast<u32>(work);
          if(abs(sum-${(0.001*(particleCount-Number(gas&&!phaseMoments))).toFixed(6)})>2e-8){out[0]|=2u;}
          ${phaseMoments ? `
          if(volume[0]!=0x53435031u || volume[23]!=4u){out[0]|=32u;}
          var gradient=vec3<f32>(0.0);var dipole=vec3<f32>(0.0);var tensor:array<vec3<f32>,3>;
          for(var i=0u;i<volume[5];i++){
            let node=topology[topology[48]+i*4u];
            let x=(vec3<f32>(f32(node/(topology[24]*topology[25])),f32((node/topology[25])%topology[24]),f32(node%topology[25]))-vec3<f32>(f32(topology[27])))*bitcast<f32>(topology[29]);
            let v=bitcast<f32>(volume[64u+i*4u]);
            let g=vec3<f32>(bitcast<f32>(volume[65u+i*4u]),bitcast<f32>(volume[66u+i*4u]),bitcast<f32>(volume[67u+i*4u]));
            gradient+=g;dipole+=v*x;for(var axis=0u;axis<3u;axis++){tensor[axis]+=x[axis]*g;}
          }
          if(any(abs(gradient)>vec3<f32>(2e-8)) || any(abs(dipole-vec3<f32>(8.25*sum))>vec3<f32>(2e-7))){out[0]|=64u;}
          for(var axis=0u;axis<3u;axis++){
            var expected=vec3<f32>(0.0);expected[axis]=sum;
            if(any(abs(tensor[axis]-expected)>vec3<f32>(2e-7))){out[0]|=128u;}
          }
          ` : ''}
          `}
        }`,[execution.coarsePhaseMomentBuffer??execution.coarseVolumeBuffer,coarse,execution.controlBuffer,receipt,
          ...(phaseMoments&&!rejected ? [top.parentFieldViewBuffer] : [])]);
      if(!rejected) for(const [i,level] of generation.mechanicsLevelViews.entries()){
        const grid=level.mechanicsGrid;
        encode(encoder,`
          @group(0) @binding(0) var<storage,read> c:array<u32>;
          @group(0) @binding(1) var<storage,read> m:array<u32>;
          @group(0) @binding(2) var<storage,read> adjoint:array<u32>;
          @group(0) @binding(3) var<storage,read_write> out:array<u32>;
          @compute @workgroup_size(1) fn main(){
            if(c[2]!=3u || adjoint[2]!=3u || adjoint[5]!=c[18]){out[0]|=4u;}
            var sum=0.0;var work=0.0;
            for(var i=0u;i<c[18];i++){
              let node=m[i*12u];
              let x=(f32(node/${grid.gridDims[1]*grid.gridDims[2]}u)-${grid.gridShift}.0)*${grid.gridSpacingM.toFixed(4)};
              let y=(f32((node/${grid.gridDims[2]}u)%${grid.gridDims[1]}u)-${grid.gridShift}.0)*${grid.gridSpacingM.toFixed(4)};
              let z=(f32(node%${grid.gridDims[2]}u)-${grid.gridShift}.0)*${grid.gridSpacingM.toFixed(4)};
              let expected=${cohortTagged ? '(1.0+0.125*f32(m[i*12u+1u])+0.015625*f32(m[i*12u+2u])+0.001953125*f32(m[i*12u+3u]))*(' : ''}${constant ? '7.0' : '3.0+0.25*x-0.125*y+0.375*z'}${cohortTagged ? ')' : ''};
              for(var component=0u;component<${width}u;component++){
                let a=bitcast<f32>(adjoint[64u+i*${width}u+component]);
                if(${!nonlinear} && !(abs(a-f32(component+1u)*expected)<1e-4)){out[0]|=8u;}
                if(${phaseMoments} || m[i*12u+1u]==1u || m[i*12u+1u]==2u){
                  let v=bitcast<f32>(m[i*12u+4u+component]);work+=v*a;if(component==0u){sum+=v;}
                }
              }
            }
            out[6]=bitcast<u32>(bitcast<f32>(out[6])+sum);out[7]=bitcast<u32>(bitcast<f32>(out[7])+work);
            ${i===levelCount-1 ? `if(abs(bitcast<f32>(out[6])-bitcast<f32>(out[4]))>2e-8
              || abs(bitcast<f32>(out[7])-bitcast<f32>(out[5]))>2e-7){out[0]|=16u;}` : ''}
          }`,[level.phaseVolumeMoment.controlBuffer,level.phaseVolumeMoment.momentBuffer,execution.nativeAdjointBuffers[i],receipt]);
      }
      for(const [i,parent] of parents.entries()) encode(encoder,`
        @group(0) @binding(0) var<storage,read> v:array<u32>;
        @group(0) @binding(1) var<storage,read> t:array<u32>;
        @group(0) @binding(2) var<storage,read> m:array<u32>;
        @group(0) @binding(3) var<storage,read_write> out:array<u32>;
        @compute @workgroup_size(1) fn main(){out[${8+i*4}]=v[2];out[${9+i*4}]=v[3];
          out[${10+i*4}]=t[2];out[${11+i*4}]=m[2];
          ${i===parents.length-1 ? 'out[28]=t[39];out[29]=t[40];out[30]=t[78];out[31]=t[79];' : ''}}
        `,[(execution.phaseMomentBuffers??execution.volumeBuffers)[i],parent.parentFieldViewBuffer,
          generation.mechanicsLevelViews[i+1].phaseVolumeMoment.controlBuffer,receipt]);
      encoder.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([encoder.finish()]);runtime.markSubmitted(execution);
      await readback.mapAsync(1);const words=[...new Uint32Array(readback.getMappedRange())];readback.unmap();
      await runtime.releaseAfter(execution);const retiredRejected=!runtime.ownsExecution(execution);execution=null;
      await releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(lease,device.queue.onSubmittedWorkDone());lease=null;
      releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);await generation.releasePromise;generation=null;
      cycles.push({words,cloneRejected,cloneExecutionRejected,changedOrdinalRejected,backpressureRejected,retiredRejected});
    }
    const error=await device.popErrorScope();if(error)errors.push(error.message);
    return {cycles,errors,mappedBytesPerCycle:128};
  }finally{
    await device.queue.onSubmittedWorkDone();
    if(execution){try{runtime.discard(execution,{discardedEncoder:true});}catch{await runtime.releaseAfter(execution);}}
    runtime?.destroy();
    if(lease)await releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(lease,device.queue.onSubmittedWorkDone());
    if(generation){releaseSchroederSpatialEpochGenerationAfterQueue(generation,device);await generation.releasePromise;}
    owned.forEach(b=>b.destroy());device.destroy();
  }
}
