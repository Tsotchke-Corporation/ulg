import { runSchroederLevelAssignmentWebGpu } from './schroederHierarchyGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer } from './schroederSpatialEpochGpu.js';
import { abortSchroederSpatialEpochTransaction, admitSchroederSpatialEpochTransactionReader,
  scheduleSchroederSpatialEpochTransactionRelease, SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE as STATE,
  SCHROEDER_SPATIAL_EPOCH_READER as READER, SCHROEDER_SPATIAL_EPOCH_READER_PHASE as PHASE }
  from './schroederSpatialEpochTransaction.js';
import { runSchroederSpatialChainMechanicsWebGpu } from './schroederSpatialChainMechanicsGpu.js';
import { runSchroederSpatialThermalProposalWebGpu } from './schroederSpatialThermalProposalsGpu.js';
import { runMlsMpmPostMechanicsClosureWebGpu,
  resolveMlsMpmChainClosureAdmission,
  retireMlsMpmPostMechanicsClosureOutputsAfter } from './sphMlsMpmPostMechanicsClosure.js';
import { createMlsMpmChainPrivateContinuation } from './sphMlsMpmGpuStep.js';
import { prepareSchroederSpatialChainGasPressure } from './schroederSpatialChainGasPressureGpu.js';
import { snapshotSchroederChainLocalLaws } from './schroederSpatialChainLocalLaws.js';
import { sphGpuParticleUploadExactEnergyRows, acquireSphParticleExactMassRead,
  releaseSphParticleExactMassRead } from './sphGpuBuffers.js';

const chainSteps = new WeakMap();

/** Only an original runner result can enter the existing spatial publisher. */
export function resolveSchroederSpatialChainStep(step, { device } = {}) {
  const record = chainSteps.get(step);
  if (!record || record.device !== device || record.retired) {
    throw new TypeError('Chain publication requires its original live same-device step');
  }
  resolveMlsMpmChainClosureAdmission(record.capture.closure);
  return record.capture;
}

/** One private resident interval, using the existing spatial transaction and
 * numerical producers. Classification consumes the current GPU buffers on
 * every interval. This function neither schedules a batch nor publishes it;
 * its owner must retain the result until the existing batch fence completes. */
export async function runSchroederSpatialChainStepWebGpu({ device,
  sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
  mechanicsLevels, classificationPolicy, forceInputs, internalPressureScale = 1,
  mechanicsMaterialTable, thermalMaterialTable, thermalResponseGraphUpload,
  mechanicsOptions = {}, closureOptions = {}, retainForPublication = false,
  gasPressureMechanicsBoundaryEnabled = false, ambientPressurePa = 0, gasPressureMechanicsScale = 1,
  phaseVolumeInterfaceTransportRequired = false, mechanicsMaterialPhaseUpload = null,
  phaseVolumePressureScale = gasPressureMechanicsBoundaryEnabled ? 0 : 1,
  phaseVolumeDragScale = 1, phaseVolumeMaxImpulseFraction = 0.5
} = {}) {
  if (!sphGpuParticleUploadExactEnergyRows(sphParticleUpload)
    || !thermalResponseGraphUpload || !thermalMaterialTable || !mechanicsMaterialTable
    || !Array.isArray(mechanicsLevels) || mechanicsLevels.length < 2
    || !Number.isFinite(forceInputs?.dt) || forceInputs.dt <= 0) {
    throw new TypeError('Resident chain requires exact energy, material laws, adjacent levels and an explicit interval');
  }
  const nativeLaws = snapshotSchroederChainLocalLaws({mechanicsMaterialTable, mechanicsMaterialPhaseUpload,
    ambientPressurePa, gasPressureMechanicsScale, phaseVolumeInterfaceTransportRequired,
    phaseVolumePressureScale, phaseVolumeDragScale, phaseVolumeMaxImpulseFraction});
  const nativePhaseLawsRequired = phaseVolumeInterfaceTransportRequired || mechanicsMaterialTable.surfaceTensionEnabled === true;
  if (nativePhaseLawsRequired && !mechanicsMaterialPhaseUpload) {
    throw new TypeError('Chain native transport requires the original material phase upload');
  }
  if (typeof gasPressureMechanicsBoundaryEnabled !== 'boolean'
    || ![ambientPressurePa,gasPressureMechanicsScale].every(v=>typeof v==='number' && Number.isFinite(v) && v>=0)
    || (mechanicsOptions.ambientPressurePa != null && mechanicsOptions.ambientPressurePa !== ambientPressurePa)) {
    throw new TypeError('Chain pressure requires an explicit enable flag and matching finite physical inputs');
  }
  const source={sphParticleState,mlsMpmParticleState,sphParticleUpload,mlsMpmParticleUpload};
  // Preserve the caller's declared interval/domain through the awaited stage
  // factories. The producers separately authenticate their buffer identities.
  forceInputs={...forceInputs,boxDimsM:[...forceInputs.boxDimsM],gravityMPerS2:[...forceInputs.gravityMPerS2]};
  mechanicsLevels=mechanicsLevels.map(spec=>({...spec,mechanicsGrid:{...spec.mechanicsGrid,
    gridDims:[...spec.mechanicsGrid.gridDims],
    boxDimsM:[...(spec.mechanicsGrid.boxDimsM??forceInputs.boxDimsM)]}}));
  // A padded mechanics lattice may extend beyond the physical wall domain.
  // Preserve its declared geometry instead of rebuilding it from wall bounds.
  for(const {mechanicsGrid} of mechanicsLevels) {
    if(mechanicsGrid.boxDimsM.length!==3 || mechanicsGrid.boxDimsM.some((v,i)=>
      !Number.isFinite(v) || v<=0 || v<forceInputs.boxDimsM[i])) {
      throw new TypeError('Resident mechanics grid must contain the physical wall domain');
    }
  }
  classificationPolicy={...classificationPolicy};
  mechanicsOptions={...mechanicsOptions};
  closureOptions={...closureOptions,thermalStepOptions:{...closureOptions.thermalStepOptions}};
  const particleCount=sphParticleUpload.particleCount;
  let assignment, generation, transaction, composite, execution, g2p, closure, continuation, thermalProposal;
  let sourceRead=null, pressure=null;
  const proposals=[];
  let retirement=null, executionSubmitted=false;
  const retire=after=>{
    if(!after || typeof after.then!=='function') throw new TypeError('Chain retirement requires its batch fence');
    retirement ??= (async()=>{
      if(await after!==true) throw new TypeError('Chain retirement requires confirmed batch completion');
      if(continuation) await continuation.retire(Promise.resolve(true));
      else if(closure) await retireMlsMpmPostMechanicsClosureOutputsAfter(closure,{after:Promise.resolve(true),abandon:true});
      g2p?.destroyOutputParticleBuffers();
      thermalProposal?.abandonPreparedWork();
      for(const proposal of proposals.filter(p=>!p.released)) {
        if(proposal.canReleaseQueueOrdered?.()) proposal.releaseQueueOrdered();
        else await proposal.releaseAfterSubmittedWork();
      }
      if(execution) {
        if(executionSubmitted) await composite.releaseExecutionAfter(execution);
        else composite.discardExecution(execution,{discardedEncoder:true});
      }
      composite?.destroy();
      await pressure?.retire();
      if(generation && !generation.released) {
        if(!releaseSchroederSpatialEpochGenerationAfterQueue(generation,device) && !generation.releasePromise) {
          throw new Error(generation.releaseReason || 'Chain spatial retirement was not admitted');
        }
        if(await generation.releasePromise!==true) throw new Error('Chain spatial owner did not retire');
      }
      if(transaction) {
        if(transaction.state===STATE.COMMITTED || transaction.state===STATE.RELEASE_BLOCKED) {
          if(await scheduleSchroederSpatialEpochTransactionRelease(transaction,{after:Promise.resolve(true)})!==true) {
            throw new Error('Published chain transaction did not retire');
          }
        } else abortSchroederSpatialEpochTransaction(transaction);
      }
      assignment?.destroyAssignmentBuffer();
      if(sourceRead) {await releaseSphParticleExactMassRead(sourceRead);sourceRead=null;}
      return true;
    })().catch(error=>{retirement=null;throw error;});
    return retirement;
  };
  try {
    sourceRead=acquireSphParticleExactMassRead(sphParticleUpload,device,{mlsMpmParticleUpload});
    assignment=await runSchroederLevelAssignmentWebGpu({...classificationPolicy,device,...source,
      minLevel:mechanicsLevels[0].selectedLevel,maxLevel:mechanicsLevels.at(-1).selectedLevel,
      retainAssignmentBuffer:true,readbackMode:'no-full-readback',queueOrderedCleanup:true});
    generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:assignment,
      particleCount,particleIdentityBuffer:sphParticleUpload.identityBuffer,
      particleIdentityStrideWords:sphParticleUpload.identityStrideBytes/4,mechanicsLevels});
    if(!generation.ready) throw new Error(`Chain spatial generation refused: ${generation.reason}`);
    if(gasPressureMechanicsBoundaryEnabled) pressure=await prepareSchroederSpatialChainGasPressure({
      device,source,generation,assignment,sourceRead,boxDimsM:forceInputs.boxDimsM,
      ambientPressurePa,gasPressureMechanicsScale});
    const mechanics=await runSchroederSpatialChainMechanicsWebGpu({device,source,generation,
      mechanicsLevels,forceInputs,internalPressureScale,mechanicsOptions,mechanicsMaterialTable,
      crossLevelTransportRequired:phaseVolumeInterfaceTransportRequired,
      localLawInputs:nativePhaseLawsRequired
        ? mechanicsLevels.map((_,index)=>({...pressure?.localLawInputs[index],...nativeLaws,
          gasPressureMechanicsAuthoritySource:pressure?.localLawInputs[index].gasPressureMechanicsAuthoritySource??null,
          gasPressureMechanicsChartId:pressure?.localLawInputs[index].gasPressureMechanicsChartId??0}))
        : pressure?.localLawInputs??null});
    ({transaction,composite,execution,g2p}=mechanics);
    proposals.push(...mechanics.proposals);executionSubmitted=true;
    admitSchroederSpatialEpochTransactionReader(transaction,{generation,...source,
      readerId:READER.MECHANICS_G2P,phase:PHASE.INTEGRATION_COMMIT});
    thermalProposal=runSchroederSpatialThermalProposalWebGpu({...closureOptions.thermalStepOptions,
      device,generation,schroederSpatialEpochTransaction:transaction,...source,
      thermalResponseGraphUpload,dtS:forceInputs.dt,
      smoothingLengthM:sphParticleState.smoothingLengthM,exactEnergyLedger:true});
    thermalProposal.authorizeQueueOrderedCanonicalApplyRetirement({generation,execution:generation.execution});
    for (const [readerId,phase] of [[READER.THERMAL_CONDUCTION,PHASE.THERMAL_CONDUCTION_PROPOSAL],
      [READER.THERMAL_RADIATION,PHASE.THERMAL_RADIATION_PROPOSAL]]) {
      admitSchroederSpatialEpochTransactionReader(transaction,{generation,...source,readerId,phase,
        consumerReceipt:thermalProposal.consumerReceipt(readerId)});
    }
    closure=await runMlsMpmPostMechanicsClosureWebGpu({...closureOptions,device,...source,
      inputResidentProductMass:sourceRead.residentProductMass,
      postMechanicsParticleBuffers:g2p,postMechanicsG2pResult:g2p,
      thermalMaterialTable,mechanicsMaterialTable,thermalResponseGraphUpload,
      schroederSpatialThermalProposal:thermalProposal,
      schroederSpatialEpochGeneration:generation,schroederSpatialEpochTransaction:transaction,
      boxDimsM:forceInputs.boxDimsM,dtSeconds:forceInputs.dt,readbackMode:'no-full-readback'});
    continuation=await createMlsMpmChainPrivateContinuation(closure);
    const admission=resolveMlsMpmChainClosureAdmission(closure);
    // G2P and every closure consumer have submitted before this transfer. The
    // retained numerical result owns its buffers independently of the spatial
    // lookup arenas; reuse those arenas in queue order for the next interval.
    for(const proposal of proposals) proposal.releaseQueueOrdered();
    if (!retainForPublication) releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(generation,device);
    const result = Object.freeze({...continuation,assignment,generation,
      gasPressure:pressure?.receipt()??null,
      admissionControlBuffer:admission.controlBuffer,
      wallRecord:admission.wallRecord,
      lineageRecord:admission.lineageRecord,
      postMechanicsStateBuffer:g2p.stateBuffer,
      mechanicsControlBuffer:g2p.controlBuffer,forceControlBuffer:execution.correction.controlBuffer,
      correction:execution.correction,restriction:execution.pairs,
      retire(after) {
        if (!after || typeof after.then!=='function') throw new TypeError('Chain retirement requires its batch fence');
        chainSteps.get(result).retired = true;
        return retire(after);
      }});
    chainSteps.set(result, { device, retired: false,
      capture: Object.freeze({ device, closure, transaction, generation, assignment,
        classificationPolicy: Object.freeze({...classificationPolicy,
          minLevel:mechanicsLevels[0].selectedLevel,maxLevel:mechanicsLevels.at(-1).selectedLevel}), retainForPublication }) });
    return result;
  } catch(error) {
    try {await error.chainClosureCleanupCompletion;} catch(cleanupError) {error.chainClosureCleanupError=cleanupError;}
    error.chainStepCleanupCompletion=retire(device.queue.onSubmittedWorkDone().then(()=>true));
    // Keep the original numerical error while exposing any incomplete cleanup.
    try {await error.chainStepCleanupCompletion;} catch(cleanupError) {error.chainStepCleanupError=cleanupError;}
    throw error;
  }
}
