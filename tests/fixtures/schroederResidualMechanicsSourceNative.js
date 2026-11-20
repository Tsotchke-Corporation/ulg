import { createSchroederResidualMechanicsSource, runSchroederResidualMechanicsLevelAssignment }
  from '../../src/runtime/sph/schroederResidualMechanicsSourceGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu, releaseSchroederSpatialEpochGenerationAfterQueue }
  from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createSphReactionResidualLedger, SPH_REACTION_LEDGER_PACKET_WORDS as PACKET,
  SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as E } from '../../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { prepareSphReactionResidualHistory, SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H }
  from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { prepareSphExactParticleMassSeed, bindSphExactParticleMassSeed } from '../../src/runtime/sph/sphExactMassParticleSeed.js';
import { uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers, destroySphGpuParticleBuffers,
  destroyMlsMpmGpuParticleBuffers, acquireSphParticleExactMassRead,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA }
  from '../../src/runtime/sph/sphGpuBuffers.js';
import { encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { encodeSphExactSigned } from '../../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { checkResidualMechanicsMotion } from './schroederResidualMechanicsMotionNative.js';
import { checkResidualTransportRepeat } from './schroederResidualTransportRepeatNative.js';
import { createResidualThermalFixture } from './schroederResidualThermalNative.js';
import { checkResidualPhaseMaterialization } from './schroederResidualPhaseNative.js';

export async function runResidualMechanicsSourceNative({motion=false,transport=false,thermal=false,phase=false,radiation=false,kinds=null,levelCount=3}={}) {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:12}});
  const errors=[],results=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  device.pushErrorScope('validation');
  try {
    for(const kind of kinds??['mixed','solid','gas','plasma','empty','large','moved','closed-producers',
      'bad-count','bad-seal','bad-mass','bad-deformation','identity-overflow']) {
      const owned=[];let sph,mls,emission,history,holder,source,assignment,generation;
      const thermalData=thermal||phase?createResidualThermalFixture(device,{radiation,
        conduction:!phase && !['thermal-off','thermal-radiation'].includes(kind)}):null;
      const make=(label,size,usage=128|4|8)=>{const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);owned.push(b);return b;};
      const upload=(label,data)=>{const b=make(label,Math.max(4,data.byteLength));if(data.byteLength)device.queue.writeBuffer(b,0,data);return b;};
      const check=(encoder,code,buffers,count)=>{
        const p=device.createComputePipeline({layout:'auto',compute:{module:device.createShaderModule({code}),entryPoint:'check'}});
        const g=device.createBindGroup({layout:p.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
        const pass=encoder.beginComputePass();pass.setPipeline(p);pass.setBindGroup(0,g);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();
      };
      try {
        const count=['empty','thermal-empty','phase-empty'].includes(kind)?0:kind==='large'?129:4,capacity=kind==='large'?144:8;
        const carrierCount=kind==='large'?129:kind==='phase-four-lane'?8:2;
        const phaseLanes=kind==='phase-four-lane'?4:1,carrierLineages=carrierCount/phaseLanes;
        const phaseCarrierPlan=phase?{schema:'peercompute.ulg.sph-phase-carrier-plan.v2',status:'phase-lane-capacity-ready',
          lineageCapacity:carrierLineages,primaryCapacity:carrierLineages,phaseLaneCount:phaseLanes,
          phaseLaneStride:carrierLineages,companionStart:carrierLineages,companionCapacity:carrierCount-carrierLineages,
          particleCapacity:carrierCount,phaseCompanionLanesRequired:phaseLanes===4,
          stableLaneAddress:'phaseLane*phaseLaneStride+lineageIndex'}:null;
        const plateau=phase?thermalData.table.segmentMetadata.find(s=>s.type==='plateau'
          && s.from===(kind.includes('fusion')?'solid':'liquid')):null;
        const phaseU=phase && (['phase-fusion','phase-vapor'].includes(kind)||kind.startsWith('repeat-phase'))
          ?Math.fround((plateau.eStart+plateau.eEnd)*0.5):null;
        const epoch={storageGeneration:7,physicsTick:0,physicsSubstep:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0};
        const s=new Float32Array(carrierCount*8),t=new Float32Array(carrierCount*12),m=new Float32Array(carrierCount*32),identities=new Uint32Array(carrierCount);
        for(let i=0;i<carrierCount;i++) {
          s.set([i%2?12.25:8.25,8.25,8.25,1,0,0,0,40],i*8);
          identities[i]=i===carrierCount-1?(kind==='identity-overflow'?0xffffffff:202):101;
          if(phase)identities[i]=i%carrierLineages===0?101:202;
          t.set([26,1,300,1000,1,0,0,0,0.1,1,1,0.1],i*12);
          for(const w of [0,4,8,18,20,21,22,25,26,27,31])m[i*32+w]=1;
          m[i*32+19]=0.001;
          if(thermalData){s[i*8]=8.25+i/32;s[i*8+7]=thermalData.energy(330);
            t[i*12]=thermalData.materialId;t[i*12+1]=2;t[i*12+2]=330;
            t[i*12+4]=0;t[i*12+5]=1;m[i*32+20]=0;
            if(kind.includes('-eos-'))t[i*12+9]=s[i*8+3]/thermalData.properties.molarMassKgPerMol*6.02214076e23;}
        }
        const packed={...epoch,schema:ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,particleCount:carrierCount,state:s,thermo:t,identity:identities,phaseCarrierPlan,
          identityRevision:'cold-residual-mechanics',stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,
          metadata:Array.from(identities,id=>({id:`cold-${id}`,material:thermalData?'h2o':'fe',
            materialId:thermalData?.materialId??26,phaseId:thermalData?2:1,renderDomainId:id}))};
        bindSphExactParticleMassSeed(packed,prepareSphExactParticleMassSeed({particles:Array.from({length:carrierCount},()=>({massKg:1}))},
          {format:E.format,reference:'cold residual spatial invariant',initialQuantities:false,energyLedger:true}));
        sph=uploadSphGpuParticleBuffers(device,packed);
        mls=uploadMlsMpmGpuParticleBuffers(device,{...epoch,schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount:carrierCount,mechanics:m,mechanicsStrideBytes:128,phaseCarrierPlan});
        const slots=Math.max(1,count),scratch=new Uint32Array(10+slots*PACKET),events=new Float32Array(slots*32),plans=new Float32Array(slots*8);
        scratch[1]=1;scratch[2]=count;
        for(let i=0;i<count;i++) {
          const phase=thermalData?2:({solid:1,liquid:2,gas:3,plasma:4,pressure:1}[kind]??i%4+1);
          const volume=4*Math.PI/3*(0.5*2**(i%3))**3;
          const mass=encodeSphExactMass(2,E.format);mass[0]=i+1;
          scratch[10+i*PACKET]=1;scratch.set(mass,11+i*PACKET);
          const energy=encodeSphExactSigned(thermalData?Math.fround(2*(phaseU??thermalData.energy(300))):transport?80:30,E.format);if(transport||phase)energy[0]=11+i;
          scratch.set(energy,11+i*PACKET+E.format.wordCount);
          // Isolated solid gravity/elasticity checks must not also request
          // mandatory unilateral separation of overlapping solid domains.
          const x=(kind==='solid'||kind==='pressure')?18.25+4*i:18.25+i%7/16;
          events.set([x,8.25,8.25,2,201,0,0,0,1,2,0,phase,0,2,1,1,300,2/volume,1,40,
            1,2,3,volume,1,0,0,1,phase>=3?2:1,phase===1?1:0,1,6],i*32);plans[i*8+4]=6;
          // Stay in contact after the first caloric refresh gives water its
          // material density/radius, rather than relying on the cold radius.
          if(thermalData){events[i*32]=8.29+i/512;events[i*32+4]=thermalData.materialId;
            events[i*32+19]=phaseU??thermalData.energy(300);events.set([0,0,0],i*32+20);
            if(phaseU!==null)events[i*32+16]=plateau.temperatureK;
            if(kind.includes('-eos-'))events[i*32+15]=thermalData.properties.molarMassKgPerMol;}
          if(kind==='pressure'){
            events.set([0,0,0],i*32+20);
            // Manufactured elastic constants: mu=2 Pa, lambda=3 Pa, with
            // consistent bulk modulus and longitudinal wave speed.
            events.set([13/3,2,3,Math.sqrt(7*volume/2),1],i*32+24);
          }
        }
        emission=createSphReactionResidualLedger({device,capacity:slots,generation:1});
        let encoder=device.createCommandEncoder();emission.encode(encoder,{particleCount:2,scratch:upload('cold packets',scratch),
          events:upload('cold events',events),eventPlan:upload('cold plans',plans),energyOutput:make('cold energy',(4*E.format.wordCount+4)*4)});
        device.queue.submit([encoder.finish()]);
        const firstControl=make('history control',128);
        history=prepareSphReactionResidualHistory({device,emitted:emission.commit(),capacity,controlBuffer:firstControl});
        encoder=device.createCommandEncoder();history.encode(encoder);history.check(encoder);history.restore(encoder);
        if(kind==='moved')encoder.copyBufferToBuffer(upload('cold moved position',new Float32Array([22.25])),0,history.record.buffer,
          (H.headerWords+H.physicalOffset)*4,4);
        if(kind==='cfl')encoder.copyBufferToBuffer(upload('cold fast residual',new Float32Array([100000])),0,history.record.buffer,
          (H.headerWords+H.stateOffset+4)*4,4);
        if(kind==='pressure')for(let row=0;row<count;row++){
          // Pure shear has det(F)=1, inside the existing condensed-volume
          // constitutive bounds, and must survive with a nonzero stress response.
          encoder.copyBufferToBuffer(upload('cold solid shear',new Float32Array([0.2])),0,
            history.record.buffer,(H.headerWords+row*H.rowWords+H.mechanicsOffset+1)*4,4);
        }
        const fault={
          'bad-count':[3,capacity+1],'bad-seal':[7,0],'bad-mass':[H.headerWords+H.physicalOffset+3,0],
          'bad-deformation':[H.headerWords+H.mechanicsOffset,0x7fc00000]
        }[kind];
        if(fault)encoder.copyBufferToBuffer(upload('cold source fault',new Uint32Array([fault[1]])),0,history.record.buffer,fault[0]*4,4);
        device.queue.submit([encoder.finish()]);holder=history.transfer();
        const snapshots=[sph.stateBuffer,sph.thermoBuffer,sph.identityBuffer,mls.mechanicsBuffer,holder.history.buffer]
          .map(buffer=>({buffer,copy:make('GPU original-state snapshot',buffer.size)}));
        encoder=device.createCommandEncoder();for(const {buffer,copy}of snapshots)encoder.copyBufferToBuffer(buffer,0,copy,0,buffer.size);
        device.queue.submit([encoder.finish()]);
        source=createSchroederResidualMechanicsSource({device,sphParticleUpload:sph,mlsMpmParticleUpload:mls,history:holder.history,smoothingLengthM:0.5});
        // Derived physical storage must not masquerade as either a fresh
        // legacy upload or an already admitted exact carrier family.
        let unadmitted=false;try{acquireSphParticleExactMassRead(source.sphParticleUpload,device);}catch{unadmitted=true;}
        if(!unadmitted)throw new Error('Mechanics projection gained carrier publication authority');
        let cloneRefused=false;try{await runSchroederResidualMechanicsLevelAssignment({device,source:{...source}});}catch{cloneRefused=true;}
        if(!cloneRefused)throw new Error('Copied mechanics source was admitted');
        let destructionRefused=false;try{source.sphParticleUpload.stateBuffer.destroy();}catch{destructionRefused=true;}
        if(!destructionRefused)throw new Error('Caller destroyed retained mechanics storage');
        if(kind==='closed-producers') {history.destroy();holder.destroy();emission.destroy();destroySphGpuParticleBuffers(sph);destroyMlsMpmGpuParticleBuffers(mls);}
        assignment=await runSchroederResidualMechanicsLevelAssignment({device,source,baseGridSpacingM:0.5,
          minLevel:0,maxLevel:levelCount-1,targetSupportCells:1,supportRadiusScale:1});
        const levels=Array.from({length:levelCount},(_,selectedLevel)=>{
          const spacing=0.5*2**selectedLevel,n=32/spacing+5;
          return{selectedLevel,mechanicsGrid:{gridSpacingM:spacing,gridDims:[n,n,n],gridNodeCount:n**3,gridShift:1,boxDimsM:[32,32,32]}};
        });
        generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:assignment,particleCount:source.particleCount,
          particleIdentityBuffer:source.sphParticleUpload.identityBuffer,particleIdentityStrideWords:1,mechanicsLevels:levels});
        if(!generation.ready)throw new Error(generation.reason);
        const receipt=make('fixed source verdict',128),readback=make('fixed readback',128,1|8);
        const rejected=!!fault || kind==='identity-overflow';
        encoder=device.createCommandEncoder();
        check(encoder,`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> history:array<u32>;
@group(0) @binding(2) var<storage,read> state:array<u32>;
@group(0) @binding(3) var<storage,read> thermo:array<u32>;
@group(0) @binding(4) var<storage,read> mechanics:array<u32>;
@group(0) @binding(5) var<storage,read> identity:array<u32>;
@group(0) @binding(6) var<storage,read> old_s:array<u32>;
@group(0) @binding(7) var<storage,read> old_t:array<u32>;
@group(0) @binding(8) var<storage,read> old_m:array<u32>;
@group(0) @binding(9) var<storage,read> old_i:array<u32>;
@group(0) @binding(10) var<storage,read> rows:array<u32>;
@group(0) @binding(11) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${source.particleCount}u){return;}
  if(row==0u){atomicStore(&receipt[7],source[2]);if((source[2]!=0u)!=${rejected}){atomicOr(&receipt[0],1u);}}
  if(${rejected}){if(rows[row*16u+10u]!=0u){atomicOr(&receipt[0],2u);}return;}
  if(row<${carrierCount}u){
    for(var w=0u;w<8u;w++){if(state[row*8u+w]!=old_s[row*8u+w]){atomicOr(&receipt[0],4u);}}
    for(var w=0u;w<12u;w++){if(thermo[row*12u+w]!=old_t[row*12u+w]){atomicOr(&receipt[0],4u);}}
    for(var w=0u;w<32u;w++){if(mechanics[row*32u+w]!=old_m[row*32u+w]){atomicOr(&receipt[0],4u);}}
    if(identity[row]!=old_i[row]){atomicOr(&receipt[0],4u);}
  }else if(row<${count+carrierCount}u){
    let h=${H.headerWords}u+(row-${carrierCount}u)*${H.rowWords}u+${H.physicalOffset}u;
    for(var w=0u;w<8u;w++){if(state[row*8u+w]!=history[h+w]){atomicOr(&receipt[0],8u);}}
    for(var w=0u;w<12u;w++){if(thermo[row*12u+w]!=history[h+8u+w]){atomicOr(&receipt[0],8u);}}
    for(var w=0u;w<32u;w++){if(mechanics[row*32u+w]!=history[h+20u+w]){atomicOr(&receipt[0],8u);}}
    if(identity[row]!=203u+row-${carrierCount}u || rows[row*16u+12u]!=history[h]){atomicOr(&receipt[0],8u);}
  }else{
    for(var w=0u;w<8u;w++){if(state[row*8u+w]!=0u){atomicOr(&receipt[0],16u);}}
  }
}`, [source.controlBuffer,holder.history.buffer,source.sphParticleUpload.stateBuffer,source.sphParticleUpload.thermoBuffer,
          source.mlsMpmParticleUpload.mechanicsBuffer,source.sphParticleUpload.identityBuffer,sph.stateBuffer,sph.thermoBuffer,
          mls.mechanicsBuffer,sph.identityBuffer,assignment.assignmentBuffer,receipt],source.particleCount);
        for(const {selectedLevel,mechanicsFieldView:field}of generation.mechanicsLevelViews)check(encoder,`
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read> thermo:array<f32>;
@group(0) @binding(2) var<storage,read> identities:array<u32>;
@group(0) @binding(3) var<storage,read_write> receipt:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read> positions:array<f32>;
fn weight(x:f32,k:u32)->f32 {
  if(k==0u){return 0.5*(1.5-x)*(1.5-x);}
  if(k==1u){return 0.75-(x-1.0)*(x-1.0);}
  return 0.5*(x-0.5)*(x-0.5);
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${source.particleCount}u){return;}
  if(${rejected}){if(row==0u && (field[2]&4u)==0u){atomicOr(&receipt[0],32u);}return;}
  if(row==0u && field[2]!=3u){atomicOr(&receipt[0],32u);}
  let d=field[24]+row*32u;let selected=field[d+3u];
  let expected_level=select(0u,(row-${carrierCount}u)%3u,row>=${carrierCount}u);
  let expected=select(0u,1u,row<${count+carrierCount}u && expected_level==${selectedLevel}u);
  if(selected!=expected){atomicOr(&receipt[0],64u);}
  if(selected==0u){return;}
  atomicAdd(&receipt[1],1u);
  if(row>=${carrierCount}u){atomicAdd(&receipt[2],1u);atomicAdd(&receipt[3u+${selectedLevel}u],1u);}
  let phase=u32(thermo[row*12u+1u]);
  if(field[d]!=phase || field[d+1u]!=u32(thermo[row*12u])
    || field[d+2u]!=select(0u,identities[row],phase==1u)){atomicOr(&receipt[0],128u);}
  let position=vec3<f32>(positions[row*8u],positions[row*8u+1u],positions[row*8u+2u]);
  let grid=position/${0.5*2**selectedLevel};let base=floor(grid-vec3<f32>(0.5));let fraction=grid-base;
  for(var stencil=0u;stencil<27u;stencil++) {
    let offset=vec3<u32>(stencil/9u,(stencil/3u)%3u,stencil%3u);
    let support=weight(fraction.x,offset.x)*weight(fraction.y,offset.y)*weight(fraction.z,offset.z);
    let node=field[d+4u+stencil];
    if(support<bitcast<f32>(0x21800000u)){
      if(node!=0xffffffffu){atomicOr(&receipt[0],256u);}continue;
    }
    if(node>=field[34]){atomicOr(&receipt[0],256u);continue;}
    let key=field[26]+node*4u;
    let cell=vec3<u32>(base+vec3<f32>(offset)+vec3<f32>(f32(field[22])));
    let dense=cell.x*field[20]*field[21]+cell.y*field[21]+cell.z;
    if(field[key]!=dense || field[key+1u]!=field[d] || field[key+2u]!=field[d+1u] || field[key+3u]!=field[d+2u]){
      atomicOr(&receipt[0],256u);
    }
  }
}`, [field.fieldViewBuffer,source.sphParticleUpload.thermoBuffer,source.sphParticleUpload.identityBuffer,receipt,
          source.sphParticleUpload.stateBuffer],source.particleCount);
        if(phase){
          device.queue.submit([encoder.finish()]);
          await checkResidualPhaseMaterialization({device,sph,mls,history:holder.history,levels,
            kind,receipt,check,make,data:thermalData});
          encoder=device.createCommandEncoder();
        }else if(motion){
          device.queue.submit([encoder.finish()]);
          if(kind.startsWith('repeat'))await checkResidualTransportRepeat({device,source,generation,levels,kind,receipt,check,make,sph,mls,thermalData});
          else await checkResidualMechanicsMotion({device,source,generation,levels,kind,receipt,check,transport,make,thermalData,
            rejected:rejected || kind==='cfl'});
          encoder=device.createCommandEncoder();
        }
        for(const {buffer,copy}of snapshots)check(encoder,`
@group(0) @binding(0) var<storage,read> original:array<u32>;
@group(0) @binding(1) var<storage,read> snapshot:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  if(id.x<arrayLength(&original) && original[id.x]!=snapshot[id.x]){atomicOr(&receipt[0],512u);}
}`, [buffer,copy,receipt],buffer.size/4);
        encoder.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([encoder.finish()]);
        await readback.mapAsync(1);results.push({kind,count,carrierCount,rejected,words:Array.from(new Uint32Array(readback.getMappedRange()))});readback.unmap();
      }finally{
        await device.queue.onSubmittedWorkDone();
        if(generation && releaseSchroederSpatialEpochGenerationAfterQueue(generation,device))await generation.releasePromise;
        assignment?.destroyAssignmentBuffer();if(source)await source.retire(Promise.resolve(true));
        holder?.destroy();history?.destroy();emission?.destroy();
        if(sph)destroySphGpuParticleBuffers(sph);if(mls)destroyMlsMpmGpuParticleBuffers(mls);
        thermalData?.destroy();
        for(const b of owned)b.destroy();
      }
    }
    const error=await device.popErrorScope();if(error)errors.push(error.message);return{results,errors};
  }finally{device.destroy();}
}
