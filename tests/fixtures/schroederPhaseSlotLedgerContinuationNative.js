import { condensableCaloricSegments } from '../../src/runtime/sph/sphCondensableCaloricTable.js';
import { createIdealGasCaloricThermodynamics, IDEAL_GAS_CALORIC_SCHEMA, IDEAL_GAS_CALORIC_ENERGY_BASIS } from '../../src/runtime/material/condensableThermodynamics.js';
import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import * as steps from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as h from '../../src/runtime/sph/schroederHierarchyGpu.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { buildSphThermalMaterialTable } from '../../src/runtime/sph/sphThermalGpuKernel.js';
import { buildMlsMpmMechanicsMaterialTable } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';

// Genuine cold ownership -> spatial mechanics -> thermal ledger -> phase
// ledger -> refinement ledger -> refresh -> published successor -> next step.
// Admission descriptors are test inputs; scene StateManager proof is separate.
export async function runPhaseSlotLedgerContinuationNative(device) {
  const format=createSphExactMassFormat(),capacity=9,count=36,owned=[],receipts=[];
  const phase=(name,rho)=>({name,cpJPerKgK:name==='gas'?20:10,densityKgPerM3:rho,
    temperatureRange:[0,10000],bulkModulusPa:100,shearModulusPa:0,
    thermalConductivityWPerMK:0,thermalConductivityProvenance:{source:'manufactured isolated ledger'},
    dynamicViscosityPaS:0,surfaceTensionNPerM:0});
  const materialProperties={gas:{molarMassKgPerMol:8.314462618/10,phases:[phase('gas',1)],transitions:[]},
    liquid:{molarMassKgPerMol:.018,phases:[phase('liquid',8)],transitions:[]}};
  const condensableThermodynamicsByMaterial={gas:createIdealGasCaloricThermodynamics({
    schema:IDEAL_GAS_CALORIC_SCHEMA,energyBasis:IDEAL_GAS_CALORIC_ENERGY_BASIS,
    provenance:'manufactured constant-Cv gas',molarMassKgPerMol:8.314462618/10,
    referenceTemperatureK:200,referencePressurePa:2000,referenceSpecificInternalEnergyJPerKg:2000,
    cvJPerKgK:10,minTemperatureK:10,maxTemperatureK:10000,maxPressurePa:1e7})};
  materialProperties.gas.phases[0].densityKgPerM3=condensableCaloricSegments(condensableThermodynamicsByMaterial.gas)[0].restDensityKgPerM3;
  const primaries=Array.from({length:capacity},(_,i)=>({id:`ledger-air-${i}`,material:i===1?'liquid':'gas',
    massKg:i===0?4096:i===1?1:0,
    ...(i===1?{}:{phaseCaloric:{phaseId:3,phaseFractions:[0,0,1,0]}}),x:[i===1?6:5,5,5],v:[0,0,0],specificInternalEnergyJPerKg:2000,
    phaseCarrierLineageIndex:i,phaseCarrierLane:0,phaseCarrierPrimaryIndex:i}));
  const companions=[1,2,3].flatMap(lane=>primaries.map((p,i)=>({...p,id:`ledger-air-${i}-${lane}`,massKg:0,
    phaseCompanionSlot:true,phaseCarrierLane:lane,phaseCarrierTargetPhaseId:lane+1,
    phaseVolumeReferenceMassKg:0,mpmVolume0:0,visualRestParticleRadiusM:0})));
  const initial={particles:[...primaries,...companions],smoothingLengthM:1,dimension:3,step:0,time:0,
    storageGeneration:1,topologyEpoch:7,phaseCarrierPlan:{schema:'peercompute.ulg.sph-phase-carrier-plan.v2',
      status:'phase-lane-capacity-ready',stableLaneAddress:'phaseLane*phaseLaneStride+lineageIndex',
      phaseCompanionLanesRequired:true,lineageCapacity:capacity,primaryCapacity:capacity,phaseLaneCount:4,
      phaseLaneStride:capacity,companionStart:capacity,companionCapacity:3*capacity,particleCapacity:count,
      splitSpareReserve:{schema:'peercompute.ulg.schroeder-split-spare-reserve.v1',firstLineageIndex:2,count:7,firstContinuityDomainId:102}}};
  let packed=buffers.buildSphGpuParticleBuffers(initial,{materialProperties,condensableThermodynamicsByMaterial,exactMass:{format,energyLedger:true,reference:'integer air continuation gate'}});
  let mls=buffers.buildMlsMpmGpuParticleBuffers(initial,{materialProperties,condensableThermodynamicsByMaterial,particleSeparationRelaxation:0,soundSpeedScale:.01});
  let upload=buffers.uploadSphGpuParticleBuffers(device,packed),mlsUpload=buffers.uploadMlsMpmGpuParticleBuffers(device,mls);
  const table=buildSphThermalMaterialTable(materialProperties,{condensableThermodynamicsByMaterial}),mechanicsTable=buildMlsMpmMechanicsMaterialTable(materialProperties);
  const fields=[...h.SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES];
  const admissions={
    phaseVolumeSplitMergeAdmission:{committed:true,phaseVolumeSplitMergeApproved:true,
      outputFamilies:['schroeder-phase-volume-split-merge-apply'],schroederPhaseVolumeSplitMergeProposalRowCount:count},
    particleStorageAllocatorAdmission:{committed:true,particleStorageAllocationApproved:true,particleCapacityApproved:true,
      outputFamilies:['schroeder-particle-storage-allocation'],targetStateFamilies:fields,
      schroederParticleStorageAllocationRowCount:count,currentParticleCapacity:count,requiredParticleCapacity:count},
    particleStorageSlotAssignmentAdmission:{committed:true,particleStorageSlotAssignmentApproved:true,freeListDescriptorApproved:true,
      outputFamilies:['schroeder-particle-storage-slot-assignment'],targetStateFamilies:fields,schroederParticleStorageSlotAssignmentRowCount:count},
    particleStorageMaterializationAdmission:{committed:true,particleStorageMaterializationApproved:true,particleIdentityMutationApproved:true,
      slotAssignmentDescriptorApproved:true,outputFamilies:['schroeder-particle-storage-materialization'],targetStateFamilies:fields,
      schroederParticleStorageMaterializationRowCount:count}
  };
  const make=(size,usage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC)=>{
    const b=device.createBuffer({size,usage});owned.push(b);return b;};
  const cold=buffers.acquireSphParticleExactMassRead(upload,device);
  const beforeMass=make(cold.read.byteLength),beforeEnergy=make(cold.energy.energyBuffer.size);
  const coldCopy=device.createCommandEncoder();
  coldCopy.copyBufferToBuffer(cold.read.buffer,cold.read.byteOffset,beforeMass,0,beforeMass.size);
  coldCopy.copyBufferToBuffer(cold.energy.energyBuffer,0,beforeEnergy,0,beforeEnergy.size);
  device.queue.submit([coldCopy.finish()]);await buffers.releaseSphParticleExactMassRead(cold);
  let family=null,lease=null,assignment=null,step=null;
  try{
    for(let n=0;n<3;n++){
      if(family)lease=spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family,{device});
      const execution=await h.runSchroederSameLevelMechanicsWebGpu({device,sphParticleState:packed,
        mlsMpmParticleState:mls,sphParticleUpload:upload,mlsMpmParticleUpload:mlsUpload,
        levelAssignment:assignment,levelAssignmentSourceFamily:family,levelAssignmentSourceFamilyLease:lease,
        selectedLevel:0,minLevel:0,maxLevel:0,baseGridSpacingM:1,boxDimsM:[10,10,10],dt:.001,gravityMPerS2:[0,0,0],
        readbackMode:'no-full-readback',enableTwoLevelMechanics:false,enableCrossLevelCoupling:false,
        enableLawQueue:false,enableLawNeighborCandidates:false,enableParticleStorageCountSummary:false,
        enableParticleStorageCompaction:false,enablePhaseVolumeMigration:true,enablePhaseVolumeSplitMergeApply:true,
        enableParticleStorageAllocation:true,enableParticleStorageSlotAssignment:true,enableParticleStorageMaterialization:true,
        enablePhaseSlotRefinement:true,enablePressureInterfaceOwnerScope:false,...admissions,
        residentStepOptions:{thermalMaterialTable:table,mechanicsMaterialTable:mechanicsTable,contactSolverEnabled:true,
          thermalStepOptions:{conductionRate:0,wallRate:0,ambientTemperatureK:200,wallModel:'adiabatic',smoothingLengthM:.2},
          internalPressureScale:0,fuseNoFullResidentMechanics:false,gasPressureMechanicsBoundaryEnabled:false,
          particleGasLedgerActionable:false,summaryRunner:null}});
      step=execution.residentStep;
      const next=step.nextParticleUploads;
      if(next.sphParticleUpload.identityBuffer!==upload.identityBuffer
          || next.sphParticleUpload.identityRevision!==upload.identityRevision) {
        throw new Error('Refinement changed the immutable identity association');
      }
      const held=buffers.acquireSphParticleExactMassRead(next.sphParticleUpload,device);
      try{
        if(!held.energy)throw new Error('Refinement publication lost the energy ledger');
        const receipt=make(32);
        const p=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code:`
          ${createSphExactMassWgsl(format)}${createSphExactLedgerWgsl(format)}
          @group(0) @binding(0) var<storage,read> bm:array<u32>;
          @group(0) @binding(1) var<storage,read> be:array<u32>;
          @group(0) @binding(2) var<storage,read> am:array<u32>;
          @group(0) @binding(3) var<storage,read> ae:array<u32>;
          @group(0) @binding(4) var<storage,read> state:array<vec4<f32>>;
          @group(0) @binding(5) var<storage,read> thermo:array<vec4<f32>>;
          @group(0) @binding(6) var<storage,read_write> receipt:array<u32>;
          @compute @workgroup_size(1) fn main(){
            var mi:ExactMass;var mo:ExactMass;var ui:ExactMass;var uo:ExactMass;var si:ExactMass;var so:ExactMass;
            for(var i=0u;i<${count}u;i++){
              var a:ExactMass;var b:ExactMass;var c:ExactMass;var d:ExactMass;var e:ExactMass;var f:ExactMass;
              for(var w=0u;w<EM_WORDS;w++){
                a.words[w]=bm[i*EM_WORDS+w];b.words[w]=am[${held.read.byteOffset/4}u+i*EM_WORDS+w];
                c.words[w]=be[i*EM_WORDS+w];d.words[w]=ae[i*EM_WORDS+w];
                e.words[w]=be[(${count}u+i)*EM_WORDS+w];f.words[w]=ae[(${count}u+i)*EM_WORDS+w];
              }
              mi=em_add(mi,a).value;mo=em_add(mo,b).value;ui=el_add(ui,c).value;uo=el_add(uo,d).value;
              si=el_add(si,e).value;so=el_add(so,f).value;
              if(state[2u*i].w>0.0){receipt[1]++;if(thermo[3u*i].y==3.0){receipt[2]++;}}
              if(bitcast<u32>(state[2u*i].w)!=em_project_f32_bits(b).bits){receipt[0]++;}
            }
            let before=el_subtract(ui,si).value;let after=el_subtract(uo,so).value;
            for(var w=0u;w<EM_WORDS;w++){
              if(mi.words[w]!=mo.words[w]){receipt[0]++;receipt[3]++;}
              if(before.words[w]!=after.words[w]){receipt[0]++;receipt[4]++;}
            }
            receipt[5]=ae[${2*count*format.wordCount}u];receipt[7]=1u;
          }`})}});
        const group=device.createBindGroup({layout:p.getBindGroupLayout(0),entries:[beforeMass,beforeEnergy,
          held.read.buffer,held.energy.energyBuffer,next.sphParticleUpload.stateBuffer,next.sphParticleUpload.thermoBuffer,receipt]
          .map((buffer,binding)=>({binding,resource:{buffer}}))});
        const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
        pass.setPipeline(p);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
        const read=make(32,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);
        encoder.copyBufferToBuffer(receipt,0,read,0,32);device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);
        receipts.push({words:[...new Uint32Array(read.getMappedRange())],sourceStage:next.sphParticleUpload.sourceStage,
          topologyEpoch:next.sphParticleUpload.topologyEpoch,generation:held.read.generation});read.unmap();
      }finally{await buffers.releaseSphParticleExactMassRead(held);}
      const nextPacked=steps.cloneSphParticleStateForNext(packed,step),nextMls=steps.cloneMlsMpmParticleStateForNext(mls,step);
      if(family){spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family,lease,{device});lease=null;
        await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family,{device});}
      steps.destroyMlsMpmResidentStepBuffers(step,{preserveBuffers:steps.retainedContinuationBuffersFromUploads(next)});step=null;
      buffers.destroySphGpuParticleBuffers(upload);buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
      upload=next.sphParticleUpload;mlsUpload=next.mlsMpmParticleUpload;packed=nextPacked;mls=nextMls;
      family=next.schroederSpatialSuccessorSourceFamily;assignment=next.schroederSpatialSuccessorLevelAssignment;
    }
    return receipts;
  }finally{
    if(family){if(lease)spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family,lease,{device});
      await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family,{device});}
    if(step)steps.destroyMlsMpmResidentStepBuffers(step);
    buffers.destroySphGpuParticleBuffers(upload);buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
    await device.queue.onSubmittedWorkDone();for(const b of owned)b.destroy();
  }
}
