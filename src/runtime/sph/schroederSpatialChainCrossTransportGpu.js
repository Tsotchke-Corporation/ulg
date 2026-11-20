import { schroederSpatialChainCrossTransportWgsl, schroederSpatialChainCrossImpulseProlongWgsl,
  schroederSpatialChainCrossAngularReductionWgsl } from '../../../ulg-gpu-abi/src/schroederSpatialChainCrossTransportWgsl.js';
import { createSchroederSpatialChainVolumeGpu } from './schroederSpatialChainVolumeGpu.js';
import { resolveSchroederSpatialMechanicsChainAuthority } from './schroederSpatialEpochTransaction.js';
import { acquireSchroederSpatialEpochGenerationConsumerLease,
  releaseSchroederSpatialEpochGenerationConsumerLeaseAfter,
  releaseSchroederSpatialEpochGenerationConsumerLeaseQueueOrderedAfterFinalConsumer } from './schroederSpatialEpochGpu.js';
import { uploadedMechanicsMaterialPhaseRecordsMatch } from './sphMechanicsRefreshGpuKernel.js';
import { snapshotSchroederChainLocalLaws, schroederChainLocalLawsMatch } from './schroederSpatialChainLocalLaws.js';

const owners = new WeakMap();
const IDENTITY = ['generationId','deviceOrdinal','laneOrdinal','leaseToken','sourceFamilyId',
  'storageGeneration','physicsTick','physicsSubstep','positionEpoch','topologyEpoch','chartEpoch','levelEpoch','supportEpoch'];

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
export function prepareSchroederChainCrossTransport({device,transaction,localLawInputs}) {
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
  const retirementOwner=Object.freeze({});
  const volume=createSchroederSpatialChainVolumeGpu(device,{phaseMoments:true,arenaCount:1,retirementOwner,
    parentFieldCapacities:parents.map(p=>p.parentFieldCapacity),
    nativeFieldCapacities:levels.map(v=>v.mechanicsFieldView.fieldCapacity)});
  const allocated=[];
  let lease,phase,closed=false,submitted=false;
  try {
    const module=device.createShaderModule({code:schroederSpatialChainCrossTransportWgsl,label:'ulg-chain-cross-transport'});
    const layout=device.createBindGroupLayout({entries:Array.from({length:11},(_,binding)=>({binding,visibility:4,
      buffer:{type:binding===8?'uniform':[6,7,9].includes(binding)?'storage':'read-only-storage',
        ...(binding===8?{hasDynamicOffset:true,minBindingSize:256}:{})}}))});
    const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
    const pipelines=['initialize_cross','exchange_color','validate_cross','seal_cross','admit_cross_angular'].map(entryPoint=>
      device.createComputePipeline({layout:pipelineLayout,compute:{module,entryPoint}}));
    const accounting=(code,entryPoint,types)=>{
      const m=device.createShaderModule({code});
      const l=device.createBindGroupLayout({entries:types.map((type,binding)=>({binding,visibility:4,buffer:{type}}))});
      return {layout:l,pipeline:device.createComputePipeline({layout:device.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:m,entryPoint}})};
    };
    const prolong=accounting(schroederSpatialChainCrossImpulseProlongWgsl,'prolong_impulse',
      ['read-only-storage','read-only-storage','read-only-storage','read-only-storage','storage','uniform']);
    const reduce=accounting(schroederSpatialChainCrossAngularReductionWgsl,'reduce_angular',['read-only-storage','storage','uniform']);
    let ledgerWords=64;
    const region=n=>{const offset=ledgerWords;ledgerWords+=n*3;return offset;};
    const parentOffsets=parents.map(p=>region(p.parentFieldCapacity));
    const nativeOffsets=levels.map(v=>region(v.mechanicsFieldView.fieldCapacity));
    if(ledgerWords*4>Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize)) {
      throw new RangeError('Cross transport impulse accounting exceeds device storage limits');
    }
    const ledger=device.createBuffer({size:ledgerWords*4,usage:140,label:'ulg-chain-cross-impulse-ledger'});allocated.push(ledger);
    const stride=Math.max(256,device.limits?.minUniformBufferOffsetAlignment??256);
    const uniforms=parents.map(()=>{const b=device.createBuffer({size:stride*216,usage:72,label:'ulg-chain-cross-colors'});allocated.push(b);return b;});
    const reductionUniforms=levels.map((_,i)=>{
      const b=device.createBuffer({size:256,usage:72,label:'ulg-chain-cross-angular-params'});allocated.push(b);
      const words=new Uint32Array(64);words[33]=nativeOffsets[i];device.queue.writeBuffer(b,0,words);return b;
    });
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
        const parent=parents[index],data=new Uint32Array(stride/4*216);
        for(let color=0;color<216;color++){
          const words=data.subarray(color*stride/4,(color+1)*stride/4),floats=new Float32Array(words.buffer,words.byteOffset,words.length);
          words.set([index?1:0,color,0,parent.completionOrdinal,phase.completionOrdinal,completionOrdinal,phaseUpload.phaseRecordCount]);
          floats[8]=forces.dt;floats[9]=forces.cflFactor;floats[10]=laws[index].phaseVolumeDragScale;floats[11]=laws[index].phaseVolumeMaxImpulseFraction;
          words.set(IDENTITY.map(k=>parent[k]),16);
          words[29]=parentOffsets[index];words[30]=index?parentOffsets[index-1]:nativeOffsets[0];words[31]=nativeOffsets[index+1];
        }
        device.queue.writeBuffer(uniforms[index],0,data);
        const buffers=[parent.parentFieldViewBuffer,index?parents[index-1].parentFieldViewBuffer:levels[0].phaseVolumeMoment.momentBuffer,
          index?phase.phaseMomentBuffers[index-1]:levels[0].phaseVolumeMoment.momentBuffer,
          levels[index+1].phaseVolumeMoment.momentBuffer,phase.phaseMomentBuffers[index],records,fineBuffer,coarseBuffer,uniforms[index],ledger,fineGeometryBuffer];
        const group=device.createBindGroup({label:'ulg-chain-cross-transport-bind-group',layout,
          entries:buffers.map((buffer,binding)=>({binding,resource:{buffer,...(binding===8?{size:256}:{})}}))});
        groups[index]=group;
        const count=Math.max(index?parents[index-1].parentFieldCapacity:levels[0].mechanicsFieldView.fieldCapacity,levels[index+1].mechanicsFieldView.fieldCapacity);
        const dispatchGroups=Math.ceil(count/64),max=device.limits?.maxComputeWorkgroupsPerDimension??65535;
        const accountingPass=encoder.beginComputePass({label:'ulg-chain-cross-impulse-prolong'});
        accountingPass.setPipeline(prolong.pipeline);
        accountingPass.setBindGroup(0,device.createBindGroup({layout:prolong.layout,entries:
          [parent.parentFieldViewBuffer,originalBuffer,fineBuffer,coarseBuffer,ledger,uniforms[index]].map((buffer,binding)=>({binding,resource:{buffer,...(binding===5?{size:256}:{})}}))}));
        accountingPass.dispatchWorkgroups(Math.min(dispatchGroups,max),Math.ceil(dispatchGroups/max));accountingPass.end();
        const pass=encoder.beginComputePass({label:`ulg-chain-cross-transport-${index}`});
        pass.setBindGroup(0,group,[0]);pass.setPipeline(pipelines[0]);pass.dispatchWorkgroups(1);
        pass.setPipeline(pipelines[1]);
        for(let color=0;color<216;color++){pass.setBindGroup(0,group,[color*stride]);pass.dispatchWorkgroupsIndirect(parent.parentFieldViewBuffer,64*4);}
        pass.setBindGroup(0,group,[0]);pass.setPipeline(pipelines[2]);
        pass.dispatchWorkgroups(Math.min(dispatchGroups,max),Math.ceil(dispatchGroups/max));
        pass.setPipeline(pipelines[3]);pass.dispatchWorkgroups(1);pass.end();
      },
      encodeAdmission(encoder){
        for(const [i,level]of levels.entries()){
          const field=level.mechanicsFieldView.fieldViewBuffer;
          const pass=encoder.beginComputePass({label:'ulg-chain-cross-native-angular'});pass.setPipeline(reduce.pipeline);
          pass.setBindGroup(0,device.createBindGroup({layout:reduce.layout,entries:[field,ledger,reductionUniforms[i]].map((buffer,binding)=>({binding,resource:{buffer}}))}));
          pass.dispatchWorkgroupsIndirect(field,60*4);pass.end();
        }
        const pass=encoder.beginComputePass({label:'ulg-chain-cross-angular-admission'});pass.setBindGroup(0,groups[0],[0]);
        pass.setPipeline(pipelines[4]);pass.dispatchWorkgroups(1);pass.end();
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
        if(phase)volume.retireWithOwner(phase,retirementOwner);
        volume.destroy();for(const b of allocated)b.destroy();closed=true;
      }};
    const handle=Object.freeze({retire:owner.retire});owners.set(handle,owner);return handle;
  }catch(error){
    // Construction has encoded no work. Any lease here is still unused.
    if(lease)error.crossTransportCleanup=releaseSchroederSpatialEpochGenerationConsumerLeaseAfter(lease,Promise.resolve());
    volume.destroy();for(const b of allocated)b.destroy();throw error;
  }
}
