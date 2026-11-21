import { createSchroederSpatialEpochTransaction, admitSchroederSpatialEpochTransactionReader,
  abortSchroederSpatialEpochTransaction, SCHROEDER_SPATIAL_EPOCH_READER,
  SCHROEDER_SPATIAL_EPOCH_READER_PHASE } from './schroederSpatialEpochTransaction.js';
import { createSchroederSpatialCompositeMechanicsGpu } from './schroederSpatialCompositeMechanicsGpu.js';
import { runMlsMpmP2gGridProjectionWebGpu } from './sphGridGpuKernel.js';
import { runMlsMpmLevelChainG2pWebGpu } from './sphG2pGpuKernel.js';
import { runSchroederSpatialMechanicalProposalWebGpu } from './schroederSpatialMechanicalProposalsGpu.js';
import { SCHROEDER_SPATIAL_THERMAL_CONSUMERS } from './schroederSpatialThermalProposalsGpu.js';
import { snapshotSchroederChainLocalLaws } from './schroederSpatialChainLocalLaws.js';
import { prepareSchroederChainLocalTransport } from './schroederSpatialChainLocalTransportGpu.js';
import { prepareSchroederChainCrossTransport } from './schroederSpatialChainCrossTransportGpu.js';

/** The chain's existing native mechanics sequence, shared by ordinary carrier
 * steps and the authenticated carrier/history projection. Neither this stage
 * nor its G2P result grants publication or thermal/energy admission. */
export async function runSchroederSpatialChainMechanicsWebGpu({device,source,generation,
  mechanicsLevels,forceInputs,internalPressureScale=1,mechanicsOptions={},mechanicsMaterialTable,
  localLawInputs=null,crossLevelTransportRequired=false,sourceFamilyConsumerLease=null}={}) {
  source={...source};mechanicsOptions={...mechanicsOptions};
  if(localLawInputs!=null) {
    if(!Array.isArray(localLawInputs) || localLawInputs.length!==mechanicsLevels.length) {
      throw new TypeError('Chain mechanics requires local law inputs for every native level');
    }
    localLawInputs=Object.freeze(localLawInputs.map(snapshotSchroederChainLocalLaws));
  }
  mechanicsLevels=mechanicsLevels.map(spec=>({...spec,mechanicsGrid:{...spec.mechanicsGrid,
    gridDims:[...spec.mechanicsGrid.gridDims],boxDimsM:[...spec.mechanicsGrid.boxDimsM]}}));
  forceInputs={...forceInputs,gravityMPerS2:[...forceInputs.gravityMPerS2],boxDimsM:[...forceInputs.boxDimsM]};
  if(typeof crossLevelTransportRequired!=='boolean')throw new TypeError('Cross transport requires an explicit boolean');
  let transaction,composite,execution,g2p,localTransport,crossTransport,submitted=false;
  const proposals=[];
  try {
    transaction=createSchroederSpatialEpochTransaction({device,generation,...source,
      mechanicsChainAuthoritative:true,
      ...(sourceFamilyConsumerLease != null
        ? { aerosolSourceFamilyConsumerLease: sourceFamilyConsumerLease }
        : {}),
      enabledConsumerReaderIds:SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(c=>c.consumerId),
      consumerSupportProfileIds:Object.fromEntries(SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(c=>[c.consumerId,c.supportProfileId]))});
    admitSchroederSpatialEpochTransactionReader(transaction,{generation,...source,
      readerId:SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,phase:SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION});
    if (localLawInputs?.some(law => law.phaseVolumeInterfaceTransportRequired)) {
      localTransport = await prepareSchroederChainLocalTransport(device, transaction,
        localLawInputs.map(law => law.phaseVolumeInterfaceTransportRequired));
    }
    if(crossLevelTransportRequired)crossTransport=prepareSchroederChainCrossTransport({device,transaction,localLawInputs});
    const projections=[];
    for(const spec of mechanicsLevels)projections.push(await runMlsMpmP2gGridProjectionWebGpu({
      ...mechanicsOptions,device,...source,mechanicsMaterialTable,
      schroederSpatialEpochGeneration:generation,canonicalSpatialRequired:true,
      schroederSelectedLevel:spec.selectedLevel,mechanicsFieldMode:'required',
      gridSpacingM:spec.mechanicsGrid.gridSpacingM,boxDimsM:spec.mechanicsGrid.boxDimsM,
      dt:forceInputs.dt,internalPressureScale,readbackMode:'no-full-readback'}));
    composite=createSchroederSpatialCompositeMechanicsGpu(device,{
      firstMoments:crossLevelTransportRequired,
      parentFieldCapacities:generation.mechanicsAdjacentLevelPairs.map(p=>p.parentFieldView.parentFieldCapacity),
      nativeFieldCapacities:generation.mechanicsLevelViews.map(v=>v.mechanicsFieldView.fieldCapacity),arenaCount:1});
    const encoder=device.createCommandEncoder();
    execution=composite.encode(encoder,{transaction,forceInputs,p2gProjections:projections,crossTransport,localLawInputs});
    device.queue.submit([encoder.finish()]);composite.markExecutionSubmitted(execution);submitted=true;
    const publication=await composite.publishNativeState(execution,{localLawInputs,localTransport});
    for(const spec of mechanicsLevels)proposals.push(runSchroederSpatialMechanicalProposalWebGpu({
      ...mechanicsOptions,device,generation,...source,boxDimsM:spec.mechanicsGrid.boxDimsM,
      gridSpacingM:spec.mechanicsGrid.gridSpacingM,selectedLevel:spec.selectedLevel}));
    g2p=await runMlsMpmLevelChainG2pWebGpu({...mechanicsOptions,device,...source,
      nativePublication:publication,mechanicalProposals:proposals,mechanicsMaterialTable,
      schroederSpatialEpochTransaction:transaction,schroederSpatialEpochGeneration:generation,
      dt:forceInputs.dt,internalPressureScale,retainOutputParticleBuffers:true,readbackMode:'no-full-readback'});
    return {transaction,composite,execution,publication,g2p,proposals};
  }catch(error){
    error.chainMechanicsCleanupCompletion=(async()=>{
      await device.queue.onSubmittedWorkDone();
      await localTransport?.retire(Promise.resolve());
      await crossTransport?.retire(Promise.resolve());
      g2p?.destroyOutputParticleBuffers();
      for(const p of proposals)if(!p.released)await p.releaseAfterSubmittedWork();
      if(execution){
        if(submitted)await composite.releaseExecutionAfter(execution);
        else composite.discardExecution(execution,{discardedEncoder:true});
      }
      composite?.destroy();if(transaction)abortSchroederSpatialEpochTransaction(transaction);
    })();
    try{await error.chainMechanicsCleanupCompletion;}catch(cleanupError){error.chainMechanicsCleanupError=cleanupError;}
    throw error;
  }
}
