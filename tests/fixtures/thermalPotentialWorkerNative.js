import * as worker from '../../src/services/ulgMechanicsResidentStage.worker.js';
import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import * as mechanics from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import * as thermo from '../../src/runtime/material/condensableThermodynamics.js';
import { createSchroederWorkerHierarchyConfig } from '../../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { exportSphExactParticleMassColdInput } from '../../src/runtime/sph/sphExactMassParticleSeed.js';
import { createExtendedPhaseCaloricFixture } from './sphExtendedPhaseCaloric.js';
import { thermalPotentialIntervalReceipt } from './thermalPotentialIntervalReceipt.js';

// A real module worker owns the device, physical runners and private fit cache.
// Messages contain only cold controls, production terminal receipts and fixed
// GPU proofs. The page owns real ComputeManager/StateManager admission.
let device, errors=[], inputs, dummy, format;
const lanes=new Map(), snapshots=[];
function check(value,message){if(!value)throw new Error(message);}
function copySnapshot(source,before,after){
  const encoder=device.createCommandEncoder(),out={};
  for(const [key,buffer] of Object.entries({stateBuffer:source.stateBuffer,thermoBuffer:source.thermoBuffer,
    beforeEnergy:before.energy.energyBuffer,afterEnergy:after.energy.energyBuffer})){
    out[key]=device.createBuffer({size:buffer.size,usage:128|4|8});
    encoder.copyBufferToBuffer(buffer,0,out[key],0,buffer.size);
  }
  device.queue.submit([encoder.finish()]);return out;
}
async function initialize(){
  const adapter=await navigator.gpu.requestAdapter();check(adapter,'No worker WebGPU adapter');
  device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:16}});
  device.addEventListener('uncapturederror',event=>{if(errors.length<20)errors.push(event.error.message);});
  device.pushErrorScope('validation');
  const properties=createExtendedPhaseCaloricFixture(thermo).materialProperties;
  for(const phase of properties['three-phase'].phases)phase.thermalConductivityWPerMK=8000;
  const table=thermal.buildSphThermalMaterialTable(properties);
  for(let i=4;i<table.records.length;i+=8)table.records[i]=0;
  const graphs=thermal.buildSphThermalClosureGraphBuffers(table);
  const graph=graphs.graphBank.graphRecords.findIndex(row=>row.phaseFromId===2&&row.phaseToId===2);
  check(graph>=0,'Liquid graph missing');format=createSphExactMassFormat();
  const nodes=graphs.graphBank.nodeRows;
  const initial={smoothingLengthM:.02,dimension:3,step:0,time:0,storageGeneration:1,
    particles:[.45,.55].map((q,i)=>({id:`thermal-${i}`,material:'three-phase',massKg:.001*(1+2**-30),
      x:[.1+i*.01,.1,.1],v:[0,0,0],specificInternalEnergyJPerKg:nodes[graph*16+6]+q*(nodes[graph*16+7]-nodes[graph*16+6])}))};
  inputs={properties,table,initial,mechanicsTable:mechanics.buildMlsMpmMechanicsMaterialTable(properties)};
  dummy=device.createBuffer({size:16,usage:128|4|8});return {ready:true};
}
async function makeLane(enabled){
  const lane={laneId:enabled?'fitted-worker':'direct-worker',stateKey:enabled?'fitted-state':'direct-state'};
  const packed=buffers.buildSphGpuParticleBuffers(inputs.initial,{materialProperties:inputs.properties,
    exactMass:{format,reference:'G6 actual Worker IPC manufactured thermal pair'}});
  const packedMls=buffers.buildMlsMpmGpuParticleBuffers(inputs.initial,{materialProperties:inputs.properties,particleSeparationRelaxation:0});
  const lineage={storageGeneration:1,physicsTick:0,physicsSubstep:0,positionEpoch:0,topologyEpoch:0,chartEpoch:0,levelEpoch:0,supportEpoch:0};
  await worker.runUlgMechanicsResidentStageWorkerPayload({stage:{id:'schroederLaneSeed'},
    lease:{...lane,queueFencePolicy:'queue.onSubmittedWorkDone-before-admission'},
    context:{ulgMechanicsResidentStageWorker:{schema:'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
      preferWebGpu:true,readbackMode:'no-full-readback',common:{deviceResult:{device},
        sphParticleState:{...packed,coldExactMassInput:exportSphExactParticleMassColdInput(packed)},mlsMpmParticleState:packedMls},
      stageOptions:{schroederLaneSeed:{useSchroederAdoptedParticleStorageWorkerRematerialization:true,
        schroederAdoptedParticleStorageWorkerRematerializationSeed:{
          schema:'peercompute.ulg.schroeder-adopted-particle-storage-portable-materialization-seed.v0',
          status:'schroeder-adopted-particle-storage-portable-materialization-seed-ready',ready:true,
          hotBufferKey:`${lane.laneId}:seed`,authoritativeParticleCount:2,
          materializationMode:'peer-local-gpu-rematerialization-from-descriptor-seed'},
        schroederLaneSeed:{lineage,minLevel:0,maxLevel:0,baseGridSpacingM:.05}}}}}});
  const seeded=worker.resolveUlgMechanicsResidentStageWorkerRetainedParticleState({...lane,sourceStageId:'schroederSameLevelMechanics'});
  const sph=seeded.sphParticleUpload,mls=seeded.mlsMpmParticleUpload;check(sph&&mls,'Actual lane seed omitted uploads');
  const config=createSchroederWorkerHierarchyConfig({selectedLevel:0,minLevel:0,maxLevel:0,baseGridSpacingM:.05});
  const payload={lease:{...lane,queueFencePolicy:'queue.onSubmittedWorkDone-before-admission'},
    schedule:{stepCount:1},context:{ulgMechanicsResidentStageWorker:{
      schema:'peercompute.ulg.mechanics-resident-stage-worker-context.v0',taskIdPrefix:lane.laneId,
      preferWebGpu:true,readbackMode:'no-full-readback',common:{deviceResult:{device},
        boxDimsM:[.3,.3,.3],dt:1e-6,gravityMPerS2:[0,0,0],gridSpacingM:.05,readbackMode:'no-full-readback'},
      stageOptions:{schroederSpatialEpoch:{selectedLevel:0,minLevel:0,maxLevel:0,baseGridSpacingM:.05},
        schroederSameLevelMechanics:{...config,hierarchyConfig:config,enablePressureInterfaceOwnerScope:false,
          residentStepOptions:{thermalMaterialTable:inputs.table,mechanicsMaterialTable:inputs.mechanicsTable,
            contactSolverEnabled:true,gasPressureMechanicsBoundaryEnabled:false,summaryRunner:null,
            fuseNoFullResidentMechanics:false,thermalStepOptions:{conductionRate:1,wallRate:0,
              wallModel:'adiabatic',thermalPotentialEnabled:enabled}}}}}}};
  const value={...lane,payload,sph,mls,cycle:0};lanes.set(enabled,value);return value;
}
async function run({enabled,scheduleId,acknowledgement,computeLease,residentSequenceLaneContract}){
  const lane=lanes.get(enabled)??await makeLane(enabled);
  const beforeUpload=lane.sph,before=buffers.acquireSphParticleExactMassRead(beforeUpload,device);
  // The production worker retires predecessor physical buffers at completion.
  // Preserve proof inputs on GPU before dispatch; exact inventory leases alone
  // do not retain the separate state/thermo allocations.
  const beforeSnapshot=copySnapshot(beforeUpload,before,before);
  let after;
  try{
    lane.payload.schedule={stepCount:1,scheduleId,thermalPotentialAcknowledgement:acknowledgement,
      authority:'NodeKernel/ComputeManager/StateManager',residentSequenceLaneContract};
    lane.payload.lease.computeManagerLease=computeLease;
    const result=await worker.runUlgMechanicsResidentStageWorkerSchedulePayload(lane.payload);
    const retained=worker.resolveUlgMechanicsResidentStageWorkerRetainedParticleState({...lane,sourceStageId:'schroederSameLevelMechanics'});
    check(retained.sphParticleUpload,'Worker did not publish physical successor');
    lane.sph=retained.sphParticleUpload;after=buffers.acquireSphParticleExactMassRead(lane.sph,device);lane.cycle++;
    const proof=await thermalPotentialIntervalReceipt({device,format,count:2,before,after,oldUpload:beforeSnapshot,
      newUpload:lane.sph,baseline:enabled?snapshots[lane.cycle-1]:null,requests:dummy,counters:dummy,cycle:lane.cycle});
    if(!enabled)snapshots.push(copySnapshot(lane.sph,before,after));
    check(proof[0]===0&&proof[1]===2&&proof[4]===1&&proof[5]===2&&proof[16]===2,
      `Worker interval proof failed: ${JSON.stringify(proof)}`);
    return {result,proof};
  }finally{if(after)await buffers.releaseSphParticleExactMassRead(after);await buffers.releaseSphParticleExactMassRead(before);
    for(const buffer of Object.values(beforeSnapshot))buffer.destroy();}
}
async function close(){
  for(const lane of lanes.values()){
    const released=worker.releaseUlgMechanicsResidentStageWorkerLane(lane);
    check(released.released,`Worker lane teardown failed: ${JSON.stringify(released)}`);
  }
  for(const snapshot of snapshots)for(const buffer of Object.values(snapshot))buffer.destroy();
  dummy.destroy();await device.queue.onSubmittedWorkDone();
  const validation=(await device.popErrorScope())?.message??null;
  device.destroy();return {errors,validation};
}
async function changedSource(){
  const lane=lanes.get(true),old=lane.sph;
  inputs.table.records[3]+=1;
  let refusal;
  try{await run({enabled:true,scheduleId:'changed-source',acknowledgement:null});}
  catch(error){refusal=error.message;}
  check(refusal?.includes('thermal source changed'),'Changed thermal source must reject before mechanics');
  const retained=worker.resolveUlgMechanicsResidentStageWorkerRetainedParticleState({...lane,sourceStageId:'schroederSameLevelMechanics'});
  check(retained.sphParticleUpload===old,'Rejected thermal source changed the physical upload');
  return {rejected:true,physicsTick:old.physicsTick,refusal};
}
self.onmessage=async({data})=>{
  try {const result=data.action==='init'?await initialize():data.action==='close'?await close()
      :data.action==='changed-source'?await changedSource():await run(data);
    self.postMessage({id:data.id,result});}
  catch(error){self.postMessage({id:data.id,error:error.stack??String(error)});}
};
