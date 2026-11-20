// The production presentation worker owns every seed, schedule and publication.
// This test wrapper adds a fixed-size post-commit GPU receipt and an explicit
// manufactured neighbor displacement. It never supplies admissions or gas state.
import '../../src/services/ulgOffscreenRender.worker.js';
import { resolveUlgMechanicsResidentStageWorkerRetainedParticleState } from '../../src/services/ulgMechanicsResidentStage.worker.js';
import { phaseSlotSceneReceipt } from './schroederPhaseSlotSceneReceipt.js';
import { phaseSlotScenePressureReceipt } from './schroederPhaseSlotScenePressureReceipt.js';
import { displacePhaseSlotSceneNeighbor } from './schroederPhaseSlotSceneNeighborMotion.js';
const productionHandler=self.onmessage;
const errors=[];
const originalRequestDevice=GPUAdapter.prototype.requestDevice;
GPUAdapter.prototype.requestDevice=async function(...args){
  const device=await originalRequestDevice.apply(this,args);
  device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
  return device;
};
self.onmessage=event=>{
  if(event.data?.type!=='phase-slot-scene-receipt') return productionHandler(event);
  const {port,laneId,stateKey,gasId,integer,parcels,liquidId,gasLaw,neighborDisplacement}=event.data;
  (async()=>{
    const retained=resolveUlgMechanicsResidentStageWorkerRetainedParticleState({laneId,stateKey,sourceStageId:'schroederSameLevelMechanics'});
    if(!retained.sameWorkerPrivateReferences) throw new Error(`Actual scene lane unavailable: ${retained.status}`);
    const receipt=await phaseSlotSceneReceipt(retained.sphParticleUpload,gasId,integer,parcels);
    if(gasLaw)receipt.pressureWords=await phaseSlotScenePressureReceipt(retained.sphParticleUpload,retained.mlsMpmParticleUpload,gasId,gasLaw);
    if(neighborDisplacement)displacePhaseSlotSceneNeighbor(retained.sphParticleUpload,liquidId,neighborDisplacement==='away');
    port.postMessage({...receipt,errors:[...errors]});
  })().catch(error=>port.postMessage({fatal:error.stack??String(error)})).finally(()=>port.close());
};
