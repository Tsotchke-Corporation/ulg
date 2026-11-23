import { ReservationLedger } from '../peercomputeCore.js';
import * as gpu from './thermalPotentialGpu.js';
import { thermalPotentialLineageKey } from './thermalPotentialWorkerProtocol.js';

const owners = new WeakMap();
export function createThermalPotentialWorkerLane(device, upload) {
  const ledger=new ReservationLedger({name:'ulg-worker-thermal-potential',maxKeys:3});
  try {
    const cache=gpu.createThermalPotentialGpu(device,{thermalResponseGraphUpload:upload,reservationLedger:ledger});
    const owner=Object.freeze({schema:'ulg.thermal-potential-worker-lane.v1'});
    owners.set(owner,{device,upload,ledger,cache,pending:null,closed:false});return owner;
  }catch(error){ledger.destroy();throw error;}
}
function live(owner){const r=owners.get(owner);if(!r||r.closed)throw new Error('G6 worker cache retired');return r;}
export function thermalPotentialWorkerCache(owner){return live(owner).cache;}
export function thermalPotentialWorkerOrdinal(owner){
  const r=live(owner);return gpu.thermalPotentialGpuBindings(r.cache,r.device,r.upload).ordinal;
}
export function beginThermalPotentialWorkerSchedule(owner,{scheduleId,laneId,stateKey,upload,acknowledgement}){
  const r=live(owner),p=r.pending;r.pending=null;
  let adopted=false;
  if(p){
    try {
      if(p.receipt.laneId===laneId&&p.receipt.stateKey===stateKey
        &&p.receipt.lineageKey===thermalPotentialLineageKey(upload)){
        adopted=gpu.acceptThermalPotentialWorkerCandidate(p.candidate,acknowledgement,scheduleId);
      }
    }finally{if(!adopted)gpu.cancelThermalPotentialCandidateGpu(p.candidate);}
  }
  return Object.freeze({adopted,ordinal:gpu.thermalPotentialGpuBindings(r.cache,r.device,r.upload).ordinal});
}
export async function finishThermalPotentialWorkerSchedule(owner,{scheduleId,laneId,stateKey,upload}){
  const r=live(owner);
  if(r.pending)throw new Error('G6 worker still has an unacknowledged candidate');
  const lineageKey=thermalPotentialLineageKey(upload);
  let candidate;
  try{
    candidate=gpu.encodeThermalPotentialCandidateGpu(r.cache,r.device.createCommandEncoder());
    gpu.submitThermalPotentialCandidateGpu(candidate);
    const evidence=await gpu.completeThermalPotentialCandidateGpu(candidate);
    if(r.closed||lineageKey!==thermalPotentialLineageKey(upload))throw new Error('G6 worker source changed during fit');
    const receipt=gpu.bindThermalPotentialCandidateToWorkerSchedule(candidate,{scheduleId,laneId,stateKey,lineageKey});
    r.pending={candidate,receipt};return Object.freeze({candidate:receipt,readbackBytes:32,mapAsyncCount:1,
      status:'pending-state-manager',cumulativeConsumerHits:evidence.cumulativeConsumerHits});
  }catch(error){
    gpu.cancelThermalPotentialCandidateGpu(candidate);
    if(error.code==='ERR_G6_NO_VALID_FIT')return Object.freeze({candidate:null,readbackBytes:32,mapAsyncCount:1,
      status:'no-valid-fit',cumulativeConsumerHits:error.cumulativeConsumerHits});
    if(!candidate&&error.code==='ERR_G6_FIT_CAPACITY')return Object.freeze({candidate:null,readbackBytes:0,mapAsyncCount:0,
      status:'deferred-capacity',cumulativeConsumerHits:null});
    throw error;
  }
}
export function cancelThermalPotentialWorkerPending(owner){
  const r=owners.get(owner);if(!r?.pending)return;
  gpu.cancelThermalPotentialCandidateGpu(r.pending.candidate);r.pending=null;
}
export function destroyThermalPotentialWorkerLane(owner){
  const r=owners.get(owner);if(!r||r.closed)return;r.closed=true;
  if(r.pending)gpu.cancelThermalPotentialCandidateGpu(r.pending.candidate);r.pending=null;
  gpu.destroyThermalPotentialGpu(r.cache);r.ledger.destroy();
}
