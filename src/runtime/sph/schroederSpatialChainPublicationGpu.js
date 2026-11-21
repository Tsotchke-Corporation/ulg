import { SPH_RESIDENT_CLOCK_MAGIC, SPH_RESIDENT_CLOCK_ERROR } from './sphResidentClockGpu.js';

const publications = new WeakMap();
const attemptedSteps = new WeakSet();

export function resolveSchroederSpatialChainPublication(claim,{closure,nextParticleUploads}={}) {
  const record = publications.get(claim);
  if (!record || record.closed || record.closure!==closure || record.uploads!==nextParticleUploads
    || [nextParticleUploads?.sphParticleUpload,nextParticleUploads?.mlsMpmParticleUpload].some(upload=>
      !upload || upload.step!==claim.step || upload.time!==claim.time
      || upload.physicsTick!==claim.step || upload.physicsSubstep!==0)
    || !record.validatePrivateClaim(closure,record.step.claim,
      {nextParticleUploads:record.step.nextParticleUploads})
    || !record.validateRead(record.read,{device:record.device,
      sourceSphUpload:record.step.nextParticleUploads.sphParticleUpload})) {
    throw new TypeError('Chain publication requires its original observed candidate and retained owner');
  }
  record.resolveStep(record.step,{device:record.device});
  return record.capture;
}

export function validateSchroederSpatialChainPublicationTick(claim,{device,lookupLevelAssignment,nextParticleUploads}={}) {
  const record=publications.get(claim);
  if(!record || record.device!==device) return false;
  try {
    resolveSchroederSpatialChainPublication(claim,{closure:record.closure,nextParticleUploads});
    const original=record.resolveStep(record.step,{device});
    return original.assignment===lookupLevelAssignment && claim.step>=lookupLevelAssignment.physicsTick;
  } catch { return false; }
}

export function validateSchroederSpatialChainPublication(closure,claim,options={}) {
  try { resolveSchroederSpatialChainPublication(claim,{closure,...options}); return true; }
  catch { return false; }
}

function borrowedUpload(upload) {
  const result={...upload};
  delete result.exactMassInventory; delete result.exactMassInventoryRange;
  for (const key of Object.keys(result)) if (key.startsWith('owns')) result[key]=false;
  return result;
}

function publicState(previous,upload) {
  return {...previous,...Object.fromEntries([
    'storageGeneration','physicsTick','physicsSubstep','positionEpoch','topologyEpoch','chartEpoch','levelEpoch','supportEpoch',
    'step','time'].map(key=>[key,upload[key]]))};
}

/** Final numerical handover through the existing SS transaction/publisher.
 * The caller's resident owner still performs ComputeManager/StateManager
 * admission. One fixed 128-byte observation occurs at its batch boundary;
 * no particle payload is read and no intermediate interval is observed. */
export async function publishSchroederSpatialChainBatchWebGpu({device,finalStep}={}) {
  const [{resolveSchroederSpatialChainStep},closureModule,buffers,{runSchroederLevelAssignmentWebGpu},spatial,transaction]=await Promise.all([
    import('./schroederSpatialChainStepGpu.js'),import('./sphMlsMpmPostMechanicsClosure.js'),
    import('./sphGpuBuffers.js'),import('./schroederHierarchyGpu.js'),
    import('./schroederSpatialSuccessorSourceFamily.js'),import('./schroederSpatialEpochTransaction.js')]);
  const {resolveMlsMpmChainPrivateExactMassContinuation,validateMlsMpmChainPrivateContinuationClaim}=closureModule;
  const {acquireSphParticleExactMassRead,releaseSphParticleExactMassRead,validateSphParticleExactMassRead,
    destroySphGpuParticleBuffers,destroyMlsMpmGpuParticleBuffers}=buffers;
  const {prepareSchroederSpatialSuccessorSourceFamilyPublication,publishPreparedSchroederSpatialSuccessorSourceFamily,
    abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication,retireSchroederSpatialSuccessorSourceFamilyAfterLeases}=spatial;
  const {sealSchroederSpatialEpochTransactionReaders,sealSchroederSpatialEpochTransactionProposals,
    commitSchroederSpatialEpochTransaction}=transaction;
  const original=resolveSchroederSpatialChainStep(finalStep,{device});
  if (!original.retainForPublication || attemptedSteps.has(finalStep)) {
    throw new TypeError('Chain batch requires a once-only retained terminal spatial generation');
  }
  attemptedSteps.add(finalStep);
  const read=acquireSphParticleExactMassRead(finalStep.nextParticleUploads.sphParticleUpload,device,finalStep.nextParticleUploads);
  let staging,plan,record,published=false;
  try {
    const clock=read.residentClock;
    if (!clock || clock!==finalStep.clock) throw new TypeError('Chain batch lost its accepted clock');
    staging=device.createBuffer({label:'ulg-chain-batch-terminal-receipt',size:128,usage:1|8});
    const encoder=device.createCommandEncoder();
    encoder.copyBufferToBuffer(clock.buffer,0,staging,0,64);
    encoder.copyBufferToBuffer(finalStep.admissionControlBuffer,0,staging,64,64);
    device.queue.submit([encoder.finish()]);
    await staging.mapAsync(1);
    const bytes=staging.getMappedRange().slice(0), words=new Uint32Array(bytes), floats=new DataView(bytes);
    staging.unmap();
    const accepted=words[2],rejected=words[3],attempted=words[12],error=words[18];
    if (words[0]!==SPH_RESIDENT_CLOCK_MAGIC || words[1]!==1 || words[16]!==0x53434331
      || words[17]!== (error===0?3:5) || (error&SPH_RESIDENT_CLOCK_ERROR)!==0
      || words[10]!== (error===0?1:0) || words[11]!==error || attempted===0
      || accepted+rejected!==attempted
      || words[4]+words[5]*0x100000000!==clock.baseStep
      || floats.getFloat64(24,true)!==clock.baseTime || floats.getFloat64(32,true)!==clock.dt) {
      throw new Error('Chain batch terminal state/clock receipt is inconsistent');
    }
    const step=clock.baseStep+accepted,time=clock.baseTime+accepted*clock.dt;
    const acceptedStepCount=step-finalStep.sphParticleState.step;
    if (!Number.isSafeInteger(step) || step>0xffffffff || !Number.isFinite(time)
      || !Number.isSafeInteger(acceptedStepCount) || acceptedStepCount<0
      || time<finalStep.sphParticleState.time) {
      throw new RangeError('Chain batch accepted clock exceeds public lineage capacity');
    }
    const capture=resolveMlsMpmChainPrivateExactMassContinuation(original.closure,finalStep.claim,finalStep.nextParticleUploads);
    const uploads={...finalStep.nextParticleUploads,
      sphParticleUpload:borrowedUpload(finalStep.nextParticleUploads.sphParticleUpload),
      mlsMpmParticleUpload:borrowedUpload(finalStep.nextParticleUploads.mlsMpmParticleUpload),
      schroederSpatialSuccessorSourceFamily:null,schroederSpatialSuccessorLevelAssignment:null,productHistoryCommitGate:null};
    for (const upload of [uploads.sphParticleUpload,uploads.mlsMpmParticleUpload]) {
      Object.assign(upload,{step,time,physicsTick:step,physicsSubstep:0});
    }
    const claim=Object.freeze({schema:'peercompute.ulg.chain-batch-publication.v1',step,time,
      acceptedStepCount,
      acceptedIntervalCount:accepted,rejectedIntervalCount:rejected,attemptedIntervalCount:attempted,
      admissionErrorMask:error,
      mapAsyncCount:1,readbackBytes:128});
    record={device,step:finalStep,closure:original.closure,uploads,read,taken:false,closed:false,
      resolveStep:resolveSchroederSpatialChainStep,validateRead:validateSphParticleExactMassRead,
      validatePrivateClaim:validateMlsMpmChainPrivateContinuationClaim};
    record.capture=Object.freeze({...capture,carrierMassRead:read.read,publicationRead:read,
      takePublicationRead() {
        if(record.taken || record.closed) throw new TypeError('Chain batch owner handover was already consumed');
        record.taken=true;return read;
      }});
    publications.set(claim,record);
    sealSchroederSpatialEpochTransactionReaders(original.transaction);
    sealSchroederSpatialEpochTransactionProposals(original.transaction);
    plan=await prepareSchroederSpatialSuccessorSourceFamilyPublication({
      transaction:original.transaction,generation:original.generation,
      lookupLevelAssignment:original.assignment,nextParticleUploads:uploads,
      postMechanicsClosure:original.closure,chainBatchPublication:claim,
      conservativeTopologyAdvance:true,forcePositionAdvance:true,
      successorLevelAssignmentRunner:()=>runSchroederLevelAssignmentWebGpu({
        ...original.classificationPolicy,device,
        sphParticleState:publicState(finalStep.sphParticleState,uploads.sphParticleUpload),
        mlsMpmParticleState:publicState(finalStep.mlsMpmParticleState,uploads.mlsMpmParticleUpload),
        ...uploads,retainAssignmentBuffer:true,readbackMode:'no-full-readback',queueOrderedCleanup:true})});
    const commitReceipt=commitSchroederSpatialEpochTransaction(original.transaction,{nextParticleUploads:uploads});
    const publication=publishPreparedSchroederSpatialSuccessorSourceFamily(plan,{commitReceipt});
    if (!publication.published) throw new Error(`Chain batch spatial publication refused: ${publication.reason}`);
    published=true;
    let retirement=null;
    return Object.freeze({schema:'peercompute.ulg.chain-batch-spatial-continuation.v1',
      status:'spatial-continuation-awaiting-resident-owner-admission',residentContinuationReady:true,
      stateManagerCommitted:false,nextParticleUploads:uploads,publication,clockReceipt:claim,
      sphParticleState:publicState(finalStep.sphParticleState,uploads.sphParticleUpload),
      mlsMpmParticleState:publicState(finalStep.mlsMpmParticleState,uploads.mlsMpmParticleUpload),
      retire(after) {
        if(!after || typeof after.then!=='function')throw new TypeError('Published chain retirement requires its owner fence');
        retirement??=(async()=>{
          if(await after!==true)throw new TypeError('Published chain retirement requires confirmed completion');
          const receipt=await retireSchroederSpatialSuccessorSourceFamilyAfterLeases(publication.sourceFamily,
            {device,after:Promise.resolve(true),reason:'resident chain successor superseded'});
          if(!receipt.settled || receipt.remainingLeaseCount!==0)throw new Error('Published chain source family did not retire');
          destroyMlsMpmGpuParticleBuffers(uploads.mlsMpmParticleUpload);
          destroySphGpuParticleBuffers(uploads.sphParticleUpload);record.closed=true;return true;
        })().catch(error=>{retirement=null;throw error;});return retirement;
      }});
  } finally {
    staging?.destroy();
    if (!published) {
      if(plan)abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(plan,{reason:'chain batch publication did not complete'});
      if(record)record.closed=true;
      if(!record?.taken)await releaseSphParticleExactMassRead(read);
    }
  }
}
