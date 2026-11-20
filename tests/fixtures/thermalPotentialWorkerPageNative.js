import { StateManager } from '../../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
import { ComputeManager } from '../../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js';
import { createResidentStateManagerCommitHandler } from '../../src/runtime/peercomputeResidentCommitBridge.js';
import { runSchroederWorkerLaneScheduleWithAuthority } from '../../src/runtime/sph/schroederWorkerLaneControlPlane.js';

export async function runThermalPotentialWorkerNative({dropAcknowledgement=false}={}){
  const worker=new Worker(new URL('./thermalPotentialWorkerNative.js',import.meta.url),{type:'module'});
  const pending=new Map();let serial=0;
  worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(new Error(data.error)):p.resolve(data.result);};
  worker.onerror=event=>{for(const p of pending.values())p.reject(new Error(event.message));pending.clear();};
  const request=data=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,...data});});
  const stateManager=new StateManager(null,{enablePersistence:false,disableBroadcast:true,disableNetworkProvider:true});
  const computeManager=new ComputeManager({enableWorkers:false});
  try{
    await stateManager.initialize();await computeManager.initialize();
    computeManager.setCommitDeltaHandler(createResidentStateManagerCommitHandler(stateManager));
    await request({action:'init'});const runs=[];
    for(const enabled of [false,true]){
      let predecessor=null;
      for(let cycle=1;cycle<=3;cycle++){
        const scheduleId=`${enabled?'fitted':'direct'}:${cycle}`;
        let physical;
        const authority=await runSchroederWorkerLaneScheduleWithAuthority({computeManager,stateManager,
          laneId:enabled?'fitted-worker':'direct-worker',stateKey:enabled?'fitted-state':'direct-state',scheduleId,
          stepCount:1,thermalPotentialEnabled:enabled,predecessorThermalPotential:predecessor,
          executeSchedule:async({thermalPotentialAcknowledgement,lease,residentSequenceLaneContract})=>{
            physical=await request({action:'run',enabled,scheduleId,
              computeLease:{schema:lease.schema??null,leaseId:lease.leaseId,taskId:lease.taskId,authoritative:true},
              residentSequenceLaneContract,
              acknowledgement:dropAcknowledgement&&enabled&&cycle===2?null:thermalPotentialAcknowledgement});
            console.log('G6 worker terminal',JSON.stringify({scheduleId,lineage:physical.result.executionRouteReceipt?.lineage,
              thermalPotential:physical.result.thermalPotential}));
            return physical.result;
          }});
        predecessor=authority.scheduleResult.thermalPotential?.candidate??null;
        runs.push({enabled,cycle,proof:physical.proof,thermalPotential:authority.scheduleResult.thermalPotential,
          commitStatus:authority.status,fence:authority.gpuFence.fenceSatisfied,
          lineage:authority.scheduleResult.executionRouteReceipt.lineage.target});
      }
    }
    const sourceChange=await request({action:'changed-source'});
    return {runs,sourceChange,...await request({action:'close'})};
  }finally{worker.terminate();await computeManager.destroy();await stateManager.destroy();}
}
