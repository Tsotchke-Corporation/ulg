import { resolveSphPhaseCarrierTransferSourceCapture } from './sphPhaseCarrierTransferGpu.js';
import { resolveSchroederPhaseSlotRefinementSourceCapture } from './schroederPhaseSlotRefinementGpu.js';
import { beginSphGpuParticleUploadLedgerParcelsBorrow, markSphExactMassDerivedBuffers,
  validateSphParticleExactMassRead } from './sphGpuBuffers.js';
import { createSphExactMassLedgerSuccessorWebGpu, acquireSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory } from './sphExactMassInventoryGpu.js';
import { createPostMechanicsStageOutputSeal } from './sphMechanicsRefreshGpuKernel.js';
import { prepareSphLedgerParcelStagesWebGpu } from './sphLedgerParcelStagesGpu.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createCachedExplicitComputePipeline, computeBufferBinding,
  createQueueOrderedCleanupClaimIssuer, submitQueueOrderedProducerWorkAndCleanup } from '../webgpuComputeLayout.js';

const captures = new WeakMap(), results = new WeakSet();
const scratchIssuer = createQueueOrderedCleanupClaimIssuer({ producerFamily: 'ledger-parcel-candidate-scratch' });

export function retainedSphLedgerParcelCandidateBuffers(result) {
  if (result == null) return {};
  if (!results.has(result)) throw new TypeError('Unknown ledger parcel candidate');
  return result;
}
export function resolveSphLedgerParcelCandidateSourceCapture(result, token) {
  const seal = captures.get(token);
  if (!seal || seal.result !== result) throw new TypeError('Unknown ledger parcel source capture');
  seal.validate(); return seal;
}

// A private successor of the real phase/refinement output. The source parcel
// holder remains untouched; carrier, parcel and sink writes share batch admission.
export async function runSphLedgerParcelCandidateWebGpu(args) {
  const { device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
    sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, thermalMaterialTable,
    dtSeconds, exactLedger, readbackMode, postMechanicsSourceCapture: token } = args;
  if (!token || captures.has(token) || readbackMode !== 'no-full-readback'
    || !validateSphParticleExactMassRead(exactLedger?.sourceRead, { device, sourceSphUpload: sphParticleUpload })) {
    throw new TypeError('Parcel candidate requires a fresh captured original resident source');
  }
  const predecessor = exactLedger.refinementResult
    ? resolveSchroederPhaseSlotRefinementSourceCapture(exactLedger.refinementResult, exactLedger.refinementCapture)
    : resolveSphPhaseCarrierTransferSourceCapture(exactLedger.phaseResult, exactLedger.phaseCapture);
  const record = predecessor.exactLedgerRefinement ?? predecessor.exactLedgerPhase;
  if (!record || predecessor.inputs.device !== device
    || predecessor.inputs.sphParticleState !== sphParticleState
    || predecessor.inputs.mlsMpmParticleState !== mlsMpmParticleState
    || (predecessor.sourcePhaseSeal ?? predecessor).sourceParticleRead !== exactLedger.sourceRead
    || predecessor.output.stateBuffer !== sourceStateBuffer
    || predecessor.output.thermoBuffer !== sourceThermoBuffer
    || predecessor.output.mechanicsBuffer !== sourceMechanicsBuffer) {
    throw new TypeError('Parcel candidate requires its genuine current phase/refinement successor');
  }
  const borrow = beginSphGpuParticleUploadLedgerParcelsBorrow(sphParticleUpload);
  if (!borrow) throw new TypeError('Parcel candidate has no original parcel owner');
  const originalParcels = borrow.parcels, count = sphParticleState.particleCount;
  const physical = {}, parcelBuffers = [], owned = [];
  const make = (label, size) => {
    const b = tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 | 4 | 8 }), device);
    owned.push(b); return b;
  };
  let successor, massRead, stages, adoptedEnergy = false, adoptedParcels = false, parcelsRetired = false;
  const retireParcels=()=>{
    if(parcelsRetired) return false;
    parcelsRetired=true;for(const buffer of parcelBuffers) buffer.destroy();return true;
  };
  captures.set(token, null);
  try {
    successor = createSphExactMassLedgerSuccessorWebGpu({ device, sourceRead: record.carrierMassRead });
    const energyBuffer = make('ulg-parcel-candidate-energy', record.exactEnergy.energyBuffer.size);
    const energy = Object.freeze({ ...record.exactEnergy, energyBuffer });
    const encoder = device.createCommandEncoder({ label: 'ulg-parcel-candidate' });
    for (const [key, input] of Object.entries({ stateBuffer: sourceStateBuffer,
      thermoBuffer: sourceThermoBuffer, mechanicsBuffer: sourceMechanicsBuffer })) {
      physical[key] = make(`ulg-parcel-candidate-${key}`, input.size);
      encoder.copyBufferToBuffer(input, 0, physical[key], 0, input.size);
    }
    const fields = {};
    for (const key of ['paramsBuffer', 'ledgerBuffer', 'sinkBuffer']) {
      fields[key] = make(`ulg-parcel-candidate-${key}`, originalParcels[key].size);
      parcelBuffers.push(fields[key]);
      encoder.copyBufferToBuffer(originalParcels[key], 0, fields[key], 0, fields[key].size);
    }
    // No public destroy/ownership transfer: the captured stage owns this family.
    const { destroy: _destroySource, ...metadata } = originalParcels;
    const parcels = Object.freeze({ ...metadata, ...fields });
    encoder.copyBufferToBuffer(record.carrierMassRead.buffer, record.carrierMassRead.byteOffset,
      successor.buffer, 0, successor.buffer.size);
    encoder.copyBufferToBuffer(record.exactEnergy.energyBuffer, 0, energyBuffer, 0, energyBuffer.size);
    const validationBuffer = make('ulg-parcel-candidate-validation', 32);
    stages = prepareSphLedgerParcelStagesWebGpu({ device, parcels, particleCount: count, dtSeconds,
      ...physical, massRead: { ...record.carrierMassRead, buffer: successor.buffer, byteOffset: 0 },
      energy, thermalMaterialTable });
    stages.encode(encoder);
    const code = `
@group(0) @binding(0) var<storage,read> params:array<f32>;
@group(0) @binding(1) var<storage,read> ledger:array<u32>;
@group(0) @binding(2) var<storage,read> targets:array<u32>;
@group(0) @binding(3) var<storage,read> energy:array<u32>;
@group(0) @binding(4) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let p=id.x;
  if(p==0u) {
    atomicStore(&receipt[0],0x50435231u);atomicStore(&receipt[1],1u);
    atomicOr(&receipt[2],energy[${count * 2 * energy.format.wordCount}u]);
    atomicStore(&receipt[3],${parcels.count}u);atomicStore(&receipt[7],1u);
  }
  if(p>=${parcels.count}u) {return;}
  let base=p*8u;var inventory=0u;
  for(var w=0u;w<${3 * energy.format.wordCount}u;w++) {inventory|=ledger[p*${3 * energy.format.wordCount}u+w];}
  for(var w=0u;w<8u;w++) {
    if(!(abs(params[base+w])<=3.402823e38)) {atomicOr(&receipt[2],1u);}
  }
  if(params[base+3u]<1.0 || params[base+4u]<=0.0 || params[base+5u]<0.0
    || params[base+6u]<0.0 || params[base+7u]<0.0) {atomicOr(&receipt[2],2u);}
  let destination=targets[p];
  if(destination==0xffffffffu) {if(inventory!=0u) {atomicAdd(&receipt[4],1u);}}
  else {
    if(destination==0xfffffffeu) {atomicAdd(&receipt[6],1u);}
    else if(destination<${count}u) {atomicAdd(&receipt[5],1u);}
    else {atomicOr(&receipt[2],4u);}
    if(inventory!=0u || params[base+7u]!=0.0) {atomicOr(&receipt[2],8u);}
  }
}`;
    const pipeline = createCachedExplicitComputePipeline(device, { code, entryPoint: 'check',
      cacheKey: `ulg-parcel-candidate-validation-v1-${count}-${parcels.count}`, label: 'ulg-parcel-candidate-validation',
      bindings: ['read-only-storage','read-only-storage','read-only-storage','read-only-storage','storage']
        .map((type,binding) => computeBufferBinding(binding,type)) });
    const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
      entries: [parcels.paramsBuffer,parcels.ledgerBuffer,stages.targetBuffer,energyBuffer,validationBuffer]
        .map((buffer,binding) => ({ binding,resource:{buffer} })) });
    const pass = encoder.beginComputePass();pass.setPipeline(pipeline.pipeline);pass.setBindGroup(0,group);
    pass.dispatchWorkgroups(Math.ceil(parcels.count/64));pass.end();
    predecessor.validate();
    submitQueueOrderedProducerWorkAndCleanup(scratchIssuer, device, [encoder.finish()], {
      producerOutput: stages, cleanup: stages.destroy
    });
    const family = successor.commit();massRead = acquireSphExactMassRead({ family, device });
    releaseSphExactMassInventory(family);
    markSphExactMassDerivedBuffers(exactLedger.sourceRead, [physical.stateBuffer,physical.thermoBuffer],
      { mechanicsBuffers: [physical.mechanicsBuffer] });
    const remaining = new Set(['state','thermo','mechanics']);
    const destroyComponents = (selected = {}) => {
      for(const key of [...remaining]) if(selected[key]) {physical[`${key}Buffer`].destroy();remaining.delete(key);}
      if(!remaining.size) validationBuffer.destroy();
      return true;
    };
    const result = { schema:'peercompute.ulg.sph-ledger-parcel-candidate.v1',
      status:'ledger-parcel-awaiting-constitutive-refresh',backend:'webgpu',particleCount:count,
      ...physical,validationBuffer,parcels,exactEnergy:energy,carrierMassRead:massRead,ownsStateBuffer:true,ownsThermoBuffer:true,ownsMechanicsBuffer:true,
      stateBufferByteLength:physical.stateBuffer.size,thermoBufferByteLength:physical.thermoBuffer.size,
      mechanicsBufferByteLength:physical.mechanicsBuffer.size,fullParticleReadbackFree:true,
      fullParticleReadbackPerformed:false,mapAsyncCount:0,readbackBytes:0,hostQueueFenceCount:0,
      destroyOutputParticleBufferComponents:destroyComponents,
      destroyOutputParticleBuffers() {return destroyComponents({state:true,thermo:true,mechanics:true});} };
    const parcelRecord = Object.freeze({ carrierMassRead:massRead,exactEnergy:energy,
      originalParcels,parcels,validationBuffer,
      transferParcels() {
        if(adoptedParcels || parcelsRetired) throw new Error('Parcel successor already adopted or retired');
        adoptedParcels=true;return Object.freeze({parcels,destroy:retireParcels});
      },
      transferExactEnergy() {if(adoptedEnergy) throw new Error('Parcel energy already adopted');adoptedEnergy=true;} });
    const seal = createPostMechanicsStageOutputSeal(result, { device,sphParticleState,mlsMpmParticleState,
      sphParticleUpload,mlsMpmParticleUpload,sourceStateBuffer,sourceThermoBuffer,sourceMechanicsBuffer,
      thermalMaterialTable,dtSeconds,exactLedger }, { onLastRelease() {
        void releaseSphExactMassRead(massRead, { deferInBurst: true }).then(() => {
          if(!adoptedEnergy) energyBuffer.destroy();
          if(!adoptedParcels) retireParcels();validationBuffer.destroy();borrow.release();
        }).catch(() => {});
      } });
    captures.set(token,Object.freeze({ ...seal,sourcePredecessorSeal:predecessor,exactLedgerParcels:parcelRecord,
      validate() {seal.validate();if(result.validationBuffer!==validationBuffer || result.parcels!==parcels
          || result.exactEnergy!==energy || result.carrierMassRead!==massRead) throw new TypeError('Parcel output identity replaced');return true;} }));
    results.add(result);return result;
  } catch(error) {
    stages?.destroy();
    if(massRead) await releaseSphExactMassRead(massRead);else successor?.abandon();
    for(const b of owned) b.destroy();borrow.release();throw error;
  }
}
