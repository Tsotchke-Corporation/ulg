import { schroederSpatialChainCrossTransportWgsl, schroederSpatialChainCrossImpulseProlongWgsl,
  schroederSpatialChainCrossAngularReductionWgsl } from '../../../ulg-gpu-abi/src/schroederSpatialChainCrossTransportWgsl.js';
import { createSchroederSpatialChainVolumeGpu } from './schroederSpatialChainVolumeGpu.js';
import { resolveSchroederSpatialMechanicsChainAuthority } from './schroederSpatialEpochTransaction.js';
import { acquireSchroederSpatialEpochGenerationConsumerLease,
  releaseSchroederSpatialEpochGenerationConsumerLeaseAfter,
  releaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer } from './schroederSpatialEpochGpu.js';
import { uploadedMechanicsMaterialPhaseRecordsMatch } from './sphMechanicsRefreshGpuKernel.js';
import { snapshotSchroederChainLocalLaws, schroederChainLocalLawsMatch } from './schroederSpatialChainLocalLaws.js';
import {
  unwrapWebGpuCacheDevice,
  createCachedExplicitBindGroup
} from '../webgpuComputeLayout.js';

const owners = new WeakMap();
const crossTransportPipelinesByDevice = new WeakMap();
const crossTransportPoolByDevice = new WeakMap();
const CROSS_TRANSPORT_POOL_MAX_CONFIGS = 8;

function sharedCrossTransportPipelines(device) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let cached = crossTransportPipelinesByDevice.get(keyDevice);
  if (cached) return cached;
  const module = device.createShaderModule({ code: schroederSpatialChainCrossTransportWgsl, label: 'ulg-chain-cross-transport' });
  const layout = device.createBindGroupLayout({
    entries: Array.from({ length: 11 }, (_, binding) => ({
      binding, visibility: 4,
      buffer: { type: binding === 8 ? 'uniform' : [6, 7, 9].includes(binding) ? 'storage' : 'read-only-storage' }
    }))
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const pipelines = ['initialize_cross', 'count_coarse_overlap', 'exchange_simultaneous', 'apply_coarse_delta', 'validate_cross', 'seal_cross', 'admit_cross_angular']
    .map(entryPoint => device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint } }));
  const accounting = (code, entryPoint, types) => {
    const m = device.createShaderModule({ code });
    const l = device.createBindGroupLayout({ entries: types.map((type, binding) => ({ binding, visibility: 4, buffer: { type } })) });
    return {
      layout: l,
      pipeline: device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [l] }), compute: { module: m, entryPoint } })
    };
  };
  const prolong = accounting(schroederSpatialChainCrossImpulseProlongWgsl, 'prolong_impulse',
    ['read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'uniform']);
  const reduce = accounting(schroederSpatialChainCrossAngularReductionWgsl, 'reduce_angular',
    ['read-only-storage', 'storage', 'uniform']);
  cached = Object.freeze({ layout, pipelines, prolong, reduce });
  crossTransportPipelinesByDevice.set(keyDevice, cached);
  return cached;
}

function acquireCrossTransportStorage(device, parentCapacities, nativeCapacities, { usePool = false } = {}) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const key = `p:${parentCapacities.join(',')}|n:${nativeCapacities.join(',')}`;
  if (usePool) {
    const byKey = crossTransportPoolByDevice.get(keyDevice);
    if (byKey) {
      const bucket = byKey.get(key);
      if (bucket && bucket.length > 0) {
        const storage = bucket.pop();
        byKey.delete(key);
        byKey.set(key, bucket);
        return storage;
      }
    }
  }
  const retirementOwner = Object.freeze({});
  const volume = createSchroederSpatialChainVolumeGpu(device, {
    phaseMoments: true, arenaCount: 1, retirementOwner,
    parentFieldCapacities: parentCapacities,
    nativeFieldCapacities: nativeCapacities
  });
  const allocated = [];
  try {
    let ledgerWords = 64;
    const region = n => { const offset = ledgerWords; ledgerWords += n * 3; return offset; };
    const parentOffsets = parentCapacities.map(c => region(c));
    const nativeOffsets = nativeCapacities.map(c => region(c));
    const maxCoarseCapacity = Math.max(1, ...nativeCapacities.slice(1));
    const coarseScratchOffset = ledgerWords;
    ledgerWords += maxCoarseCapacity * 5;
    if (ledgerWords * 4 > Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize)) {
      throw new RangeError('Cross transport impulse accounting exceeds device storage limits');
    }
    const ledger = device.createBuffer({ size: ledgerWords * 4, usage: 140, label: 'ulg-chain-cross-impulse-ledger' });
    allocated.push(ledger);
    const uniforms = parentCapacities.map(() => {
      const b = device.createBuffer({ size: 256, usage: 72, label: 'ulg-chain-cross-params' });
      allocated.push(b); return b;
    });
    const reductionUniforms = nativeCapacities.map((_, i) => {
      const b = device.createBuffer({ size: 256, usage: 72, label: 'ulg-chain-cross-angular-params' });
      allocated.push(b);
      const words = new Uint32Array(64);
      words[33] = nativeOffsets[i];
      device.queue.writeBuffer(b, 0, words);
      return b;
    });
    return {
      keyDevice, key, retirementOwner, volume, allocated,
      ledger, uniforms, reductionUniforms, parentOffsets, nativeOffsets, coarseScratchOffset
    };
  } catch (error) {
    volume.destroy();
    for (const b of allocated) b.destroy();
    throw error;
  }
}

function releaseCrossTransportStorage(storage, { destroy = false } = {}) {
  if (!storage) return;
  if (destroy) {
    try { storage.volume.destroy(); } catch {}
    for (const b of storage.allocated) { try { b.destroy(); } catch {} }
    return;
  }
  let byKey = crossTransportPoolByDevice.get(storage.keyDevice);
  if (!byKey) {
    byKey = new Map();
    crossTransportPoolByDevice.set(storage.keyDevice, byKey);
  }
  let bucket = byKey.get(storage.key);
  if (!bucket) {
    bucket = [];
    byKey.set(storage.key, bucket);
  } else {
    byKey.delete(storage.key);
    byKey.set(storage.key, bucket);
  }
  if (bucket.length < 2) {
    bucket.push(storage);
  } else {
    try { storage.volume.destroy(); } catch {}
    for (const b of storage.allocated) { try { b.destroy(); } catch {} }
  }
  while (byKey.size > CROSS_TRANSPORT_POOL_MAX_CONFIGS) {
    const oldestKey = byKey.keys().next().value;
    const evicted = byKey.get(oldestKey);
    byKey.delete(oldestKey);
    if (evicted) {
      for (const s of evicted) {
        try { s.volume.destroy(); } catch {}
        for (const b of s.allocated) { try { b.destroy(); } catch {} }
      }
    }
  }
}
const IDENTITY = ['generationId','deviceOrdinal','laneOrdinal','leaseToken','sourceFamilyId',
  'storageGeneration','physicsTick','physicsSubstep','positionEpoch','topologyEpoch','chartEpoch','levelEpoch','supportEpoch'];
export const SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_INDIRECT_DISPATCHES_PER_PAIR = 0;
export const SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_DIRECT_DISPATCHES_PER_PAIR = 6;

export function resolveSchroederChainCrossTransport(handle, device, transaction, laws = null) {
  const owner = owners.get(handle);
  if (!owner || owner.device !== device || owner.transaction !== transaction || owner.closed
    || (laws && (laws.length !== owner.laws.length || laws.some((law,i) => !schroederChainLocalLawsMatch(owner.laws[i],law))))) {
    throw new TypeError('Cross-level transport requires its original phase/source owner');
  }
  owner.validate(); return owner;
}

// Pressure remains with the original EOS/pressure-work receipt path. Until an
// inherited constitutive pressure receipt is composed, a nonzero phase pressure
// request rejects explicitly; it is never silently discarded or booked as heat.
export function prepareSchroederChainCrossTransport({device,transaction,localLawInputs,poolStorage=false}) {
  const authority=resolveSchroederSpatialMechanicsChainAuthority(transaction,{device});
  const laws=localLawInputs?.map(snapshotSchroederChainLocalLaws);
  if (!laws || laws.length!==authority.mechanicsLevelViews.length
    || laws.some(law=>!law.phaseVolumeInterfaceTransportRequired || law.phaseVolumePressureScale!==0
      || law.mechanicsMaterialTable!==laws[0].mechanicsMaterialTable
      || law.mechanicsMaterialPhaseUpload!==laws[0].mechanicsMaterialPhaseUpload
      || law.phaseVolumeDragScale!==laws[0].phaseVolumeDragScale
      || law.phaseVolumeMaxImpulseFraction!==laws[0].phaseVolumeMaxImpulseFraction)) {
    throw new TypeError('Cross-level transport requires common explicit phase laws with pressure supplied separately');
  }
  if ((device.limits?.maxStorageBuffersPerShaderStage??8)<10) throw new RangeError('Cross transport requires ten storage bindings');
  const phaseUpload=laws[0].mechanicsMaterialPhaseUpload, records=phaseUpload?.recordsBuffer;
  const validate=()=>{
    if(resolveSchroederSpatialMechanicsChainAuthority(transaction,{device})!==authority
      || phaseUpload?.recordsBuffer!==records || !uploadedMechanicsMaterialPhaseRecordsMatch(phaseUpload,laws[0].mechanicsMaterialTable,device)) {
      throw new TypeError('Cross-level material or source authority changed');
    }
  };
  validate();
  const parents=authority.pairAuthorities.map(p=>p.parentFieldView);
  const levels=authority.mechanicsLevelViews;
  const parentCapacities = parents.map(p=>p.parentFieldCapacity);
  const nativeCapacities = levels.map(v=>v.mechanicsFieldView.fieldCapacity);
  const { layout, pipelines, prolong, reduce } = sharedCrossTransportPipelines(device);
  const storage = acquireCrossTransportStorage(device, parentCapacities, nativeCapacities, { usePool: poolStorage === true });
  const {
    retirementOwner, volume, ledger, uniforms, reductionUniforms,
    parentOffsets, nativeOffsets, coarseScratchOffset
  } = storage;
  let lease,phase,closed=false,submitted=false;
  try {
    const groups=[];
    lease=acquireSchroederSpatialEpochGenerationConsumerLease(transaction.generation,{consumerId:'chain-cross-transport'});
    const owner={device,transaction,laws,validate,get closed(){return closed;},
      encodeMoments(encoder){
        validate();if(phase)throw new TypeError('Cross-level phase moments already encoded');
        encoder.clearBuffer(ledger);
        try{phase=volume.encode(encoder,{generationReadFamily:lease});}
        catch(error){phase=error.chainVolumeExecution??null;throw error;}
      },
      encodePair(encoder,index,fineBuffer,coarseBuffer,originalBuffer,fineGeometryBuffer,completionOrdinal,forces){
        validate();if(!phase || !volume.ownsExecution(phase)||submitted)throw new TypeError('Cross transport phase source is stale');
        const parent=parents[index],words=new Uint32Array(64),floats=new Float32Array(words.buffer);
        words.set([index?1:0,0,0,parent.completionOrdinal,phase.completionOrdinal,completionOrdinal,phaseUpload.phaseRecordCount]);
        floats[8]=forces.dt;floats[9]=forces.cflFactor;floats[10]=laws[index].phaseVolumeDragScale;floats[11]=laws[index].phaseVolumeMaxImpulseFraction;
        words.set(IDENTITY.map(k=>parent[k]),16);
        words[29]=parentOffsets[index];words[30]=index?parentOffsets[index-1]:nativeOffsets[0];words[31]=nativeOffsets[index+1];
        words[32]=coarseScratchOffset;
        device.queue.writeBuffer(uniforms[index],0,words);
        const buffers=[parent.parentFieldViewBuffer,index?parents[index-1].parentFieldViewBuffer:levels[0].phaseVolumeMoment.momentBuffer,
          index?phase.phaseMomentBuffers[index-1]:levels[0].phaseVolumeMoment.momentBuffer,
          levels[index+1].phaseVolumeMoment.momentBuffer,phase.phaseMomentBuffers[index],records,fineBuffer,coarseBuffer,uniforms[index],ledger,fineGeometryBuffer];
        const group=createCachedExplicitBindGroup(device,{label:'ulg-chain-cross-transport-bind-group',layout,
          entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
        groups[index]=group;
        const fineCapacity=Math.max(1,index?parents[index-1].parentFieldCapacity:levels[0].mechanicsFieldView.fieldCapacity);
        const coarseCapacity=Math.max(1,levels[index+1].mechanicsFieldView.fieldCapacity);
        const count=Math.max(fineCapacity,coarseCapacity);
        const max=device.limits?.maxComputeWorkgroupsPerDimension??65535;
        const dispatch2d=(passObj,elements)=>{const g=Math.max(1,Math.ceil(elements/64));passObj.dispatchWorkgroups(Math.min(g,max),Math.ceil(g/max));};
        const accountingPass=encoder.beginComputePass({label:'ulg-chain-cross-impulse-prolong'});
        accountingPass.setPipeline(prolong.pipeline);
        accountingPass.setBindGroup(0,createCachedExplicitBindGroup(device,{label:'ulg-chain-cross-prolong-bg',layout:prolong.layout,entries:
          [parent.parentFieldViewBuffer,originalBuffer,fineBuffer,coarseBuffer,ledger,uniforms[index]].map((buffer,binding)=>({binding,resource:{buffer}}))}));
        dispatch2d(accountingPass,count);accountingPass.end();
        const pass=encoder.beginComputePass({label:`ulg-chain-cross-transport-${index}`});
        pass.setBindGroup(0,group);
        pass.setPipeline(pipelines[0]);pass.dispatchWorkgroups(1);
        pass.setPipeline(pipelines[1]);dispatch2d(pass,fineCapacity);
        pass.setPipeline(pipelines[2]);dispatch2d(pass,fineCapacity);
        pass.setPipeline(pipelines[3]);dispatch2d(pass,coarseCapacity);
        pass.setPipeline(pipelines[4]);dispatch2d(pass,count);
        pass.setPipeline(pipelines[5]);pass.dispatchWorkgroups(1);
        pass.end();
      },
      encodeAdmission(encoder){
        for(const [i,level]of levels.entries()){
          const field=level.mechanicsFieldView.fieldViewBuffer;
          const pass=encoder.beginComputePass({label:'ulg-chain-cross-native-angular'});pass.setPipeline(reduce.pipeline);
          pass.setBindGroup(0,createCachedExplicitBindGroup(device,{label:'ulg-chain-cross-angular-bg',layout:reduce.layout,entries:[field,ledger,reductionUniforms[i]].map((buffer,binding)=>({binding,resource:{buffer}}))}));
          pass.dispatchWorkgroupsIndirect(field,60*4);pass.end();
        }
        const pass=encoder.beginComputePass({label:'ulg-chain-cross-angular-admission'});pass.setBindGroup(0,groups[0]);
        pass.setPipeline(pipelines[6]);pass.dispatchWorkgroups(1);pass.end();
      },
      submitted(){
        if(submitted||closed||!phase)throw new TypeError('Cross transport submission is stale');
        volume.markSubmitted(phase,retirementOwner);submitted=true;
        releaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer(lease,transaction.generation,device);
      },
      async retire(fence){
        if(!fence?.then)throw new TypeError('Cross transport requires its existing consumer fence');
        await fence;if(closed)return;
        if(!lease.released)await releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(lease,fence);
        let healthy = true;
        try {
          if(phase)volume.retireWithOwner(phase,retirementOwner);
        } catch {
          healthy = false;
        }
        releaseCrossTransportStorage(storage, { destroy: !healthy || poolStorage !== true });
        closed=true;
      }};
    const handle=Object.freeze({retire:owner.retire});owners.set(handle,owner);return handle;
  }catch(error){
    // Construction has encoded no work. Any lease here is still unused.
    if(lease)error.crossTransportCleanup=releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(lease,Promise.resolve());
    releaseCrossTransportStorage(storage, { destroy: true });throw error;
  }
}
