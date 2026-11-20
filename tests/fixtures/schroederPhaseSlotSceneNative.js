import { createSphPhaseScene } from '../../src/visualization/sphPhaseScene.js';
import { createPeerComputeResidentAuthorityHost,
  ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCOPE,
  ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCOPE,
  ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCOPE,
  ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCOPE
} from '../../src/runtime/peercomputeBrowserResidentHost.js';
import * as abi from '../../ulg-gpu-abi/src/index.js';
import { stableOpticalMaterialId } from '../../src/runtime/material/opticalGpuBuffers.js';
import { resolvePeerComputeRenderOwnershipPolicy } from '../../src/runtime/peercomputeRenderOwnershipPolicy.js';
import { phaseSlotSceneReceipt } from './schroederPhaseSlotSceneReceipt.js';
import { phaseSlotSceneLedgerSeed } from './schroederPhaseSlotSceneLedgerSeed.js';
import { phaseSlotScenePressureReceipt } from './schroederPhaseSlotScenePressureReceipt.js';
import { displacePhaseSlotSceneNeighbor } from './schroederPhaseSlotSceneNeighborMotion.js';

// Cold manufactured inputs. Admission, upload, spatial discovery, closure and
// continuation all enter through the public scene API and real PeerCompute.
export async function runPhaseSlotSceneNative(mode = 'direct') {
  const parcels = mode.startsWith('parcel-');
  const pressure = mode.includes('-pressure-');
  const eosEnabled = pressure && !mode.includes('-off-');
  const dt = pressure ? .0001 : .001;
  const integer = mode.startsWith('integer-') || parcels;
  const worker = mode.endsWith('worker');
  const errors = [], stages = [];
  const OriginalWorker = globalThis.Worker;
  let device, host, scene, receiptWorker;
  if (worker) globalThis.Worker = class extends OriginalWorker {
    constructor(url,options) {
      const presentation = options?.name === 'ulg-offscreen-render';
      super(presentation ? new URL('./schroederPhaseSlotSceneReceipt.worker.js',import.meta.url) : url,options);
      if(presentation) receiptWorker=this;
    }
  };
  const container = document.createElement('div');
  container.style.cssText = 'width:640px;height:480px'; document.body.append(container);
  try {
    let adapter;
    for(let n=0;n<5&&!adapter;n++){
      adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter)await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!adapter)throw new Error('Native WebGPU adapter unavailable');
    device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 12 } });
    device.addEventListener('uncapturederror', e => errors.push(e.error.message));
    host = await createPeerComputeResidentAuthorityHost({ enableWorkers: false,
      enablePersistence: false, disableNetworkProvider: true, disableBroadcast: true });
    const capacity = 9, count = capacity * 4;
    const plan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
      lineageCapacity: capacity, primaryCapacity: capacity, phaseLaneStride: capacity, phaseLaneCount: 4,
      companionStart: capacity, companionCapacity: capacity * 3, particleCapacity: count,
      stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true,
      splitSpareReserve: { schema: 'peercompute.ulg.schroeder-split-spare-reserve.v1',
        firstLineageIndex: 2, count: 7, firstContinuityDomainId: 102 } };
    const state = new Float32Array(count*8), thermo = new Float32Array(count*12), mechanics = new Float32Array(count*32);
    const gasId = stableOpticalMaterialId('scene-gas'), liquidId = stableOpticalMaterialId('scene-liquid');
    for (let i=0; i<count; i++) {
      const liquid = i === 1, mass = i === 0 ? 64 : liquid ? 1 : 0, rho = liquid ? 8 : 1;
      state.set([liquid ? 6 : 5,5,5,mass,0,0,0,2000],i*8);
      thermo.set([liquid ? liquidId : gasId,liquid ? 2 : 3,200,rho,0,liquid ? 1 : 0,liquid ? 0 : 1,0,.2,mass,mass ? 1 : 254,.1],i*12);
      mechanics[i*32]=1; mechanics[i*32+4]=1; mechanics[i*32+8]=1;
      mechanics.set([1,mass/rho,0,1,100,0,0,10,2,1,101325,0,0,mass],i*32+18);
    }
    const epoch = { topologyEpoch: 7, positionEpoch: 0,
      physicsTick: 0, physicsSubstep: 0, chartEpoch: 0, levelEpoch: 0, supportEpoch: 0 };
    const sph = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count, state, thermo,
      identity: Uint32Array.from({length:count},(_,i)=>100+i%capacity), identityRequired: true,
      identitySchema: abi.ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA, identityRevision: 'scene-native-identities',
      identityStrideBytes: 4, identityStrideUints: 1, identityBufferByteLength: count*4,
      stateStrideBytes: 32, thermoStrideBytes: 48, stateStrideFloats: 8, thermoStrideFloats: 12,
      phaseCarrierPlan: plan, smoothingLengthM: 1, step: 0, time: 0, ...epoch };
    const mls = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count, mechanics,
      mechanicsStrideBytes: 128, mechanicsStrideFloats: 32, phaseCarrierPlan: plan,
      mechanicsDtS: .001, gridCflFactor: .4, gravityMPerS2: [0,0,0], step:0,time:0, ...epoch };
    // Gas R_specific=10, Cp=20, Cv=10; both phases start at U=2000, T=200.
    const phase = (name,rho) => ({ name, cpJPerKgK: name === 'gas' ? 20 : 10, densityKgPerM3: rho,
      temperatureRange: [0,10000], bulkModulusPa: 100, shearModulusPa: 0,
      thermalConductivityWPerMK: 0, thermalConductivityProvenance: {source:'manufactured isolated scene'},
      dynamicViscosityPaS: 0, surfaceTensionNPerM: 0 });
    const ledgerSeed = integer ? phaseSlotSceneLedgerSeed(plan,phase,parcels,pressure) : null;
    const renderOwnershipPolicy = worker ? resolvePeerComputeRenderOwnershipPolicy({
      requestedMode:'worker-owned-resident-render-producer', workerOwnedResidentProducerReady:true,
      workerOffscreenPresentationRequested:true, allowTransitionalRenderRows:false }) : null;
    scene = createSphPhaseScene(container,{ rendererBackend:'native-webgpu',
      rendererWebGpuDeviceResult:{device}, residentAuthorityHost:host, boxDimsM:[10,10,10],
      renderOwnershipPolicy, workerOffscreenPresentation:worker,
      presentationPlaying:false, residentSurfaceDrawDiagnosticMode:'native-webgpu-surface-consumer' });
    scene.setParticles({positionsM:new Float32Array([5,5,5,6,5,5]),colorsRgb:new Float32Array([1,1,1,0,0,1]),materials:['scene-gas','scene-liquid'],
      sphGpuParticleState:ledgerSeed?.sph ?? sph,mlsMpmGpuParticleState:ledgerSeed?.mls ?? mls,
      materialProperties:ledgerSeed?.materialProperties ?? {'scene-gas':{molarMassKgPerMol:8.314462618/10,phases:[phase('gas',1)],transitions:[]},
        'scene-liquid':{molarMassKgPerMol:.018,phases:[phase('liquid',8)],transitions:[]}},
      physicalLawGroups:{mechanics:true,thermal:true,gravity:false,eos:eosEnabled,reactions:false,viscosity:false,surfaceTension:false},
      ambientTemperatureK:200 });
    if (worker) {
      const deadline = performance.now()+10000;
      while (scene.getWorkerOffscreenPresentation()?.workerReady !== true && performance.now()<deadline) {
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      if (scene.getWorkerOffscreenPresentation()?.workerReady !== true) {
        throw new Error(`Worker presentation initialization failed: ${JSON.stringify(scene.getWorkerOffscreenPresentation())}`);
      }
    }
    for (let n=0;n<(integer ? 4 : 2);n++) {
      const result = await scene.refreshMlsMpmResidentSteps({ device, force:true,
        residentAuthorityHost:host, residentStateManager:host.stateManager, computeManager:host.computeManager,
        residentComputeManagerMode:'compute-manager', requireStateManagerCommit:true,
        stepCount:2,continueFromResidentState:n>0,readbackMode:'no-full-readback',
        gridSpacingM:1,dt,ambientPressurePa:0,gravityMPerS2:[0,0,0], schroederSimulation:true,
        schroederMinLevel:0,schroederMaxLevel:0,schroederSelectedLevel:0,schroederBaseGridSpacingM:1,
        schroederEnablePhaseVolumeMigration:true,schroederEnablePhaseSlotRefinement:true,
        thermalStepOptions:{conductionRate:0,wallRate:0,ambientTemperatureK:200,wallModel:'adiabatic',smoothingLengthM:.2},
        emitResidentProgressConsole:false });
      await device.queue.onSubmittedWorkDone();
      const task=result.computeManagerTask;
      let gasLaw=null;
      if(pressure){
        const table=scene.getMlsMpmMechanicsMaterialTable();
        for(let r=0;r<table.phaseRecordCount;r++){
          if(table.records[r*12]===gasId && table.records[r*12+1]===3){
            gasLaw=Array.from(table.records.subarray(table.gasConstitutiveOffsetVec4*4+r*4,table.gasConstitutiveOffsetVec4*4+r*4+4));
          }
        }
        if(gasLaw?.length!==4)throw new Error('Pressure gate requires the actual packed gas law');
      }
      const receipt = worker ? await new Promise((resolve,reject)=>{
        const channel=new MessageChannel();
        const timer=setTimeout(()=>{channel.port1.close();reject(new Error('Scene GPU receipt timed out'));},10000);
        channel.port1.onmessage=({data})=>{clearTimeout(timer);channel.port1.close();resolve(data);};
        receiptWorker.postMessage({type:'phase-slot-scene-receipt',port:channel.port2,
          laneId:task.laneId,stateKey:task.stateKey,gasId,integer,parcels,liquidId,gasLaw,
          neighborDisplacement:integer && (n===0 || n===2) ? (n===0 ? 'away' : 'return') : null},[channel.port2]);
      }) : await phaseSlotSceneReceipt(result.nextParticleUploads.sphParticleUpload,gasId,integer,parcels);
      if(!worker && pressure){
        receipt.pressureWords=await phaseSlotScenePressureReceipt(result.nextParticleUploads.sphParticleUpload,
          result.nextParticleUploads.mlsMpmParticleUpload,gasId,gasLaw);
      }
      if(!worker && integer && (n===0 || n===2)){
        displacePhaseSlotSceneNeighbor(result.nextParticleUploads.sphParticleUpload,liquidId,n===0);
      }
      stages.push({stage:integer ? ['split','away-merge','bulk-hold','returned-resplit'][n] : 'continuation',
        status:result?.status,completedStepCount:result.completedStepCount,
        errors:errors.length,receipt,...(pressure ? {gasLaw,pressureEnabled:eosEnabled} : {}),
        publication:result.residentPublicationRevalidation?.status,staleReason:result.staleReason,
        committed:result.stateManagerCommit?.accepted === true,
        warmEntryFound:result.stateManagerCommit?.warmEntryFound === true,
        laneId:task?.laneId,taskId:task?.acceptedTaskId,mode:result.residentComputeManagerMode,
        nextStep:worker ? scene.getWorkerOffscreenResidentStageStatus()?.residentScheduleResult?.perStepSummaries?.lastStep?.nextParticleStateStep
          : result.nextSphParticleState?.step });
    }
    const admissions=[ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCOPE,
      ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCOPE,
      ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCOPE,
      ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCOPE].map(scope=>({scope,
        entries:Object.values(host.stateManager.getWarmDeltas(scope)).map(entry=>({
          version:entry.version,status:entry.payload.status,sourceHotBufferKey:entry.payload.sourceHotBufferKey}))}));
    return {errors,stages,admissions};
  } catch(error) { return {fatal:error.stack??String(error),errors,stages}; }
  finally {
    await device?.queue.onSubmittedWorkDone();
    scene?.dispose(); await host?.destroy(); device?.destroy(); container.remove();
    globalThis.Worker=OriginalWorker;
  }
}
