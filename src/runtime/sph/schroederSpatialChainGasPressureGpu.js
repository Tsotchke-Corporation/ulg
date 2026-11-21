import { deriveAuthoritativeSpatialGasGrid } from './sphMlsMpmGpuStep.js';
import { runSphSpatialGasLedgerEosRetainedWebGpu,
  releaseSphSpatialGasLedgerEosAfterQueue } from './sphSpatialGasLedgerEosGpu.js';
import { validateSphParticleExactMassRead } from './sphGpuBuffers.js';

// Compose the original EOS owner with the interval's actual particle/history
// source and fresh spatial generation. No externally supplied pressure rows or
// substitute gas inventory can enter this path. The existing native consumer
// family retires the EOS after its last useful submission.
export async function prepareSchroederSpatialChainGasPressure({device,source,generation,
  assignment,sourceRead,boxDimsM,ambientPressurePa,gasPressureMechanicsScale,
  sourceFamilyConsumerLease = null}) {
  if(!validateSphParticleExactMassRead(sourceRead,{device,sourceSphUpload:source.sphParticleUpload})) {
    throw new TypeError('Chain gas pressure requires the original interval inventory read');
  }
  const chartId=assignment.chartId??0;
  const grid=deriveAuthoritativeSpatialGasGrid(generation);
  if(!grid || grid.levelCount<2) throw new TypeError('Chain gas pressure requires its original adjacent occupancy chain');
  const moment=generation.mechanicsLevelViews[0].phaseVolumeMoment;
  const epochIdentity=Object.fromEntries(['storageGeneration','physicsTick','physicsSubstep',
    'positionEpoch','topologyEpoch','chartEpoch','levelEpoch','supportEpoch'].map(key=>[key,moment[key]]));
  const execution=await runSphSpatialGasLedgerEosRetainedWebGpu({device,
    sphParticleUpload:source.sphParticleUpload,mlsMpmParticleUpload:source.mlsMpmParticleUpload,
    residentProductMass:sourceRead.residentProductMass??null,
    ...(sourceFamilyConsumerLease != null
      ? { authenticateParticleProductSource: true, sourceFamilyConsumerLease }
      : {}),
    schroederLevelAssignment:assignment,schroederSpatialEpochGeneration:generation,
    epochIdentity,spatialGasGrid:grid,boxMinM:[0,0,0],boxMaxM:boxDimsM,
    spatialGasCellSizeM:grid.gridSpacingM,spatialGasSupportVolumeFallbackM3:0,
    chartId,level:grid.selectedLevel,diagnosticsMode:'none'});
  const retire=async()=>{
    if(execution.released) return true;
    if(execution.cleanupPromise) {
      if(await execution.cleanupPromise!==true) throw new Error('Chain EOS failure cleanup was not confirmed');
      return true;
    }
    if(!execution.ready) return true;
    if(!execution.releaseScheduled && !releaseSphSpatialGasLedgerEosAfterQueue(execution)) {
      throw new Error(execution.releaseStatus??'Chain EOS retirement was refused');
    }
    if(execution.releasePromise && await execution.releasePromise!==true) {
      throw new Error('Chain EOS retirement was not confirmed');
    }
    return true;
  };
  if(!execution.ready) {
    const error=new Error(`Chain original-source EOS refused: ${execution.status}: ${execution.reason}`);
    try {await retire();}catch(cleanupError){error.chainGasCleanupError=cleanupError;}
    throw error;
  }
  const localLawInputs=generation.mechanicsLevelViews.map((_,index)=>Object.freeze({
    ambientPressurePa,gasPressureMechanicsScale,gasPressureMechanicsChartId:chartId,
    // Two-level mechanics retains its original fine <- parent consumer. The
    // N-level family uses the adjoint on every native population.
    ...(grid.levelCount>2 || index===0 ? {
      gasPressureMechanicsAuthoritySource:execution.retainedGasCellFieldSource
    }:{})}));
  return Object.freeze({localLawInputs:Object.freeze(localLawInputs),retire,
    receipt:()=>Object.freeze({levelCount:grid.levelCount,
      nativeConsumerCount:grid.levelCount>2?grid.levelCount:1,
      submitted:execution.gasPressureAuthorityConsumerSubmitted===true,
      retired:execution.released===true,
      fullParticleReadbackPerformed:execution.fullParticleReadbackPerformed===true,
      mapAsyncCount:execution.mapAsyncCount??0,
      hostQueueFenceCount:execution.hostQueueFenceCount??0})});
}
