import { runSchroederLevelAssignmentWebGpu } from './schroederHierarchyGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer } from './schroederSpatialEpochGpu.js';
import { abortSchroederSpatialEpochTransaction, admitSchroederSpatialEpochTransactionReader,
  scheduleSchroederSpatialEpochTransactionRelease, SCHROEDER_SPATIAL_EPOCH_TRANSACTION_STATE as STATE,
  SCHROEDER_SPATIAL_EPOCH_READER as READER, SCHROEDER_SPATIAL_EPOCH_READER_PHASE as PHASE }
  from './schroederSpatialEpochTransaction.js';
import { runSchroederSpatialChainMechanicsWebGpu } from './schroederSpatialChainMechanicsGpu.js';
import { releasePooledSchroederSpatialCompositeMechanicsGpu } from './schroederSpatialCompositeMechanicsGpu.js';
import { runSchroederSpatialThermalProposalWebGpu } from './schroederSpatialThermalProposalsGpu.js';
import { runMlsMpmPostMechanicsClosureWebGpu,
  resolveMlsMpmChainClosureAdmission,
  retireMlsMpmPostMechanicsClosureOutputsAfter } from './sphMlsMpmPostMechanicsClosure.js';
import { createMlsMpmChainPrivateContinuation } from './sphMlsMpmGpuStep.js';
import { prepareSchroederSpatialChainGasPressure } from './schroederSpatialChainGasPressureGpu.js';
import { snapshotSchroederChainLocalLaws } from './schroederSpatialChainLocalLaws.js';
import { sphGpuParticleUploadExactEnergyRows, acquireSphParticleExactMassRead,
  releaseSphParticleExactMassRead } from './sphGpuBuffers.js';
import { acquireSchroederSpatialSuccessorExactMassRead } from './schroederSpatialSuccessorSourceFamily.js';
import { flushWorkerQueueSubmitBurst } from '../webgpuComputeLayout.js';
import {
  ensureSchroederDeformableSolidSurfaceFamilyForUpload,
  ensureSchroederSolidRigidFamilyForUpload,
  runSchroederDeformableSolidSurfaceLaneStep,
  runSchroederSolidRigidLaneStep
} from './schroederSolidRigidLane.js';

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
  phaseVolumeDragScale = 1, phaseVolumeMaxImpulseFraction = 0.5,
  sourceFamilyConsumerLease = null,
  prebuiltSpatialEpoch = null,
  spatialEpochLaneId = null,
  spatialEpochDirectArenaCount = null,
  allowClockSegmentReset = false
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
  let sourceRead=null, pressure=null, borrowedSpatialEpoch=false;
  const proposals=[];
  let retirement=null, executionSubmitted=false;
  const retire=after=>{
    if(!after || typeof after.then!=='function') throw new TypeError('Chain retirement requires its batch fence');
    retirement ??= (async()=>{
      if(await after!==true) throw new TypeError('Chain retirement requires confirmed batch completion');
      const confirmedFence = Promise.resolve(true);
      if(continuation) await continuation.retire(confirmedFence);
      else if(closure) await retireMlsMpmPostMechanicsClosureOutputsAfter(closure,{after:confirmedFence,abandon:true});
      g2p?.destroyOutputParticleBuffers();
      thermalProposal?.abandonPreparedWork();
      for(const proposal of proposals.filter(p=>!p.released)) {
        if(proposal.canReleaseQueueOrdered?.()) proposal.releaseQueueOrdered();
        else await proposal.releaseAfterSubmittedWork();
      }
      if(execution) {
        if(executionSubmitted) await composite.releaseExecutionAfter(execution, confirmedFence);
        else composite.discardExecution(execution,{discardedEncoder:true});
      }
      if(composite) {
        releasePooledSchroederSpatialCompositeMechanicsGpu(composite, { destroy: !executionSubmitted });
      }
      await pressure?.retire(confirmedFence);
      if(!borrowedSpatialEpoch && generation && generation.execution?.released !== true) {
        const releasedQueueOrdered = releaseSchroederSpatialEpochGenerationQueueOrderedAfterFinalConsumer(generation,device);
        if(!releasedQueueOrdered && generation.execution?.released !== true) {
          if(!releaseSchroederSpatialEpochGenerationAfterQueue(generation,device) && !generation.releasePromise) {
            throw new Error(generation.releaseReason || 'Chain spatial retirement was not admitted');
          }
          if(await generation.releasePromise!==true) throw new Error('Chain spatial owner did not retire');
        }
      }
      if(transaction) {
        if(transaction.state===STATE.COMMITTED || transaction.state===STATE.RELEASE_BLOCKED) {
          if(await scheduleSchroederSpatialEpochTransactionRelease(transaction,{after:confirmedFence})!==true) {
            throw new Error('Published chain transaction did not retire');
          }
        } else abortSchroederSpatialEpochTransaction(transaction);
      }
      if(!borrowedSpatialEpoch) assignment?.destroyAssignmentBuffer();
      if(sourceRead) {await releaseSphParticleExactMassRead(sourceRead, { confirmed: true });sourceRead=null;}
      return true;
    })().catch(error=>{retirement=null;throw error;});
    return retirement;
  };
  try {
    sourceRead = acquireSchroederSpatialSuccessorExactMassRead({
      device, sphParticleUpload, mlsMpmParticleUpload, consumerLease: sourceFamilyConsumerLease
    }) ?? acquireSphParticleExactMassRead(sphParticleUpload, device, { mlsMpmParticleUpload });
    const prebuiltGeneration = prebuiltSpatialEpoch?.generation ?? null;
    const prebuiltAssignment = prebuiltSpatialEpoch?.assignment ?? null;
    const prebuiltExecution = prebuiltGeneration?.execution ?? null;
    const canBorrowPrebuilt = Boolean(
      prebuiltGeneration?.ready === true
      && prebuiltGeneration.selected === true
      && prebuiltGeneration.execution?.released !== true
      && prebuiltAssignment
      && Array.isArray(prebuiltGeneration.mechanicsLevelViews)
      && prebuiltGeneration.mechanicsLevelViews.length === mechanicsLevels.length
      && prebuiltGeneration.mechanicsLevelViews.every((view, index) => (
        view?.selectedLevel === mechanicsLevels[index].selectedLevel
        && Number(view?.mechanicsFieldView?.fieldCapacity) > 0
      ))
      && Number(prebuiltAssignment.particleCount ?? prebuiltExecution?.particleCount ?? prebuiltExecution?.sourceCount) === particleCount
      && Number(prebuiltExecution?.storageGeneration ?? prebuiltAssignment.storageGeneration) === sphParticleUpload.storageGeneration
      && Number(prebuiltExecution?.physicsTick ?? prebuiltAssignment.physicsTick) === sphParticleUpload.physicsTick
      && Number(prebuiltExecution?.positionEpoch ?? prebuiltAssignment.positionEpoch) === sphParticleUpload.positionEpoch
    );
    if (canBorrowPrebuilt) {
      borrowedSpatialEpoch = true;
      assignment = prebuiltAssignment;
      generation = prebuiltGeneration;
    } else {
      assignment=await runSchroederLevelAssignmentWebGpu({...classificationPolicy,device,...source,
        minLevel:mechanicsLevels[0].selectedLevel,maxLevel:mechanicsLevels.at(-1).selectedLevel,
        retainAssignmentBuffer:true,readbackMode:'no-full-readback',queueOrderedCleanup:true});
      generation=runSchroederSpatialEpochGenerationWebGpu({device,levelAssignment:assignment,
        laneId:spatialEpochLaneId ?? prebuiltGeneration?.source?.laneId ?? 'ulg-mechanics-resident-stage-worker',
        particleCount,
        ...(particleCount > 0 ? { activeSourceCapacity: particleCount } : {}),
        ...(Number.isInteger(spatialEpochDirectArenaCount)
          ? { directArenaCount: spatialEpochDirectArenaCount }
          : {}),
        particleIdentityBuffer:sphParticleUpload.identityBuffer,
        particleIdentityStrideWords:sphParticleUpload.identityStrideBytes/4,
        exactCellAtlas:{cellMin:[0,0,0],cellCount:[...mechanicsLevels[0].mechanicsGrid.gridDims]},
        mechanicsLevels});
    }
    if(!generation.ready) throw new Error(`Chain spatial generation refused: ${generation.reason}`);
    if(gasPressureMechanicsBoundaryEnabled) pressure=await prepareSchroederSpatialChainGasPressure({
      device,source,generation,assignment,sourceRead,boxDimsM:forceInputs.boxDimsM,
      ambientPressurePa,gasPressureMechanicsScale,sourceFamilyConsumerLease});
    const mechanics=await runSchroederSpatialChainMechanicsWebGpu({device,source,generation,
      mechanicsLevels,forceInputs,internalPressureScale,mechanicsOptions,mechanicsMaterialTable,
      sourceFamilyConsumerLease,
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
    // G3/A5 SOL-0..6 coherent rigid & deformable solid coupling onto L0 of the
    // N-level chain (zero GPU work when the scene has no coherent solid bodies).
    if (sphParticleState?.rigidBodies) {
      const solidFamily = ensureSchroederSolidRigidFamilyForUpload(
        sphParticleUpload,
        sphParticleState.rigidBodies,
        device
      );
      if (solidFamily) {
        const l0Fluid = {
          stateBuffer: g2p.stateBuffer,
          thermoBuffer: sphParticleUpload.thermoBuffer,
          mechanicsBuffer: g2p.mechanicsBuffer,
          particleCount,
          exactEnergyBuffer: sphParticleUpload.exactEnergyBuffer ?? null,
          exactEnergyRowCount: sphParticleUpload.exactEnergyBuffer ? particleCount : 0
        };
        runSchroederSolidRigidLaneStep(solidFamily, {
          device,
          dtSeconds: forceInputs.dt,
          gravity: forceInputs.gravityMPerS2,
          boxM: forceInputs.boxDimsM,
          fluid: l0Fluid
        });
        if (globalThis.__ulgA5SolidStatus && typeof globalThis.__ulgA5SolidStatus === 'object') {
          globalThis.__ulgA5SolidStatus = { ...globalThis.__ulgA5SolidStatus, chainLevel0Coupled: true };
        }
      }
    }
    if (sphParticleState?.deformableSolidSurfaces) {
      const defFamily = ensureSchroederDeformableSolidSurfaceFamilyForUpload(
        sphParticleUpload,
        sphParticleState.deformableSolidSurfaces,
        device
      );
      if (defFamily) {
        runSchroederDeformableSolidSurfaceLaneStep(defFamily, {
          device,
          stateBuffer: g2p.stateBuffer,
          particleCount
        });
      }
    }
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
      allowChainClockSegmentReset:allowClockSegmentReset === true,
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
    flushWorkerQueueSubmitBurst(device, 'chain-step-error-cleanup');
    try {await error.chainClosureCleanupCompletion;} catch(cleanupError) {error.chainClosureCleanupError=cleanupError;}
    error.chainStepCleanupCompletion=retire(device.queue.onSubmittedWorkDone().then(()=>true));
    // Keep the original numerical error while exposing any incomplete cleanup.
    try {await error.chainStepCleanupCompletion;} catch(cleanupError) {error.chainStepCleanupError=cleanupError;}
    throw error;
  }
}
