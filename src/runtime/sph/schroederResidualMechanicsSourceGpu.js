import { acquireSphParticleExactMassRead, validateSphParticleExactMassRead,
  releaseSphParticleExactMassRead, markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
import { borrowSphReactionResidualHistory, SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H }
  from './sphReactionResidualHistoryGpu.js';
import { borrowSphReactionResidualTransport } from './sphReactionResidualTransportGpu.js';
import { allocateSchroederSpatialSuccessorBufferFamilyIdentity } from './schroederSpatialSuccessorSourceFamily.js';
import { runSchroederLevelAssignmentWebGpu } from './schroederHierarchyGpu.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA }
  from '../../../ulg-gpu-abi/src/index.js';

const owners=new WeakMap(), reads=new WeakMap();
const phaseLayoutAuthority=Object.freeze({});
export const SCHROEDER_RESIDUAL_MECHANICS_SOURCE_ERROR=4194304;
const epochKeys=['physicsTick','physicsSubstep','positionEpoch','topologyEpoch',
  'chartEpoch','levelEpoch','supportEpoch','identityRevision'];

function captureFields(object,keys) {
  const values={};
  for(const key of keys) {
    const descriptor=Object.getOwnPropertyDescriptor(object??{},key);
    if(descriptor && !Object.hasOwn(descriptor,'value'))throw new TypeError('Residual mechanics source fields must be original data');
    values[key]=descriptor?.value;
  }
  return Object.freeze(values);
}
function fieldsMatch(object,values) {
  return Object.entries(values).every(([key,value])=>{
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    return !descriptor?value===undefined:Object.hasOwn(descriptor,'value') && descriptor.value===value;
  });
}

function original(source,device) {
  const owner=owners.get(source);
  if(!owner || owner.device!==device || owner.closed || owner.retired) {
    throw new TypeError('Residual mechanics source requires its original live owner');
  }
  owner.validate();return owner;
}

/** A GPU-only physical projection of two genuine retained sources. It grants
 * spatial coverage, not a new mass owner or publication. Carrier and history
 * quantities remain in their original records for whole-interval validation.
 * This view must retire after its final batch consumer, never between submits. */
export function createSchroederResidualMechanicsSource({device,sphParticleUpload,mlsMpmParticleUpload,
  history=null,smoothingLengthM,transported=null,phaseLayout=null}={},authority=null) {
  if(phaseLayout && authority!==phaseLayoutAuthority)throw new TypeError('Residual phase layout requires its original materializer');
  if(!device?.queue?.onSubmittedWorkDone || !device?.createBuffer) {
    throw new TypeError('Residual mechanics source requires its GPU device');
  }
  const sphInput=captureFields(sphParticleUpload,[...epochKeys,'stateBuffer','thermoBuffer','identityBuffer',
    'particleCount','storageGeneration','stateStrideBytes','thermoStrideBytes','identityStrideBytes','phaseCarrierPlan']);
  const mlsInput=captureFields(mlsMpmParticleUpload,['mechanicsBuffer','storageGeneration','mechanicsStrideBytes']);
  let carrier=null,residual=null,transportRead=null,retirement=null;
  const resources=new Set(),destroyed=new Set();
  const owner={device,closed:false,retired:false,retiring:false,readers:0,
    validate(){
      if(this.retired || !fieldsMatch(sphParticleUpload,sphInput) || !fieldsMatch(mlsMpmParticleUpload,mlsInput)
        || !validateSphParticleExactMassRead(carrier,{device,sourceSphUpload:sphParticleUpload})) {
        throw new TypeError('Residual mechanics carrier source changed or retired');
      }
      residual.validate();transportRead?.validate();
    }};
  const retire=after=>{
    if(!after || typeof after.then!=='function')throw new TypeError('Residual mechanics retirement requires its batch fence');
    owner.closed=true;
    retirement??=(async()=>{
      if(await after!==true)throw new TypeError('Residual mechanics retirement requires confirmed batch completion');
      if(owner.readers)throw new TypeError('Residual mechanics source still has retained consumers');
      owner.retiring=true;const errors=[];
      for(const b of resources)if(!destroyed.has(b)) {
        try{b.destroy();destroyed.add(b);}catch(error){errors.push(error);}
      }
      owner.retiring=false;
      if(errors.length)throw new AggregateError(errors,'Residual mechanics source retirement failed');
      residual?.release();transportRead?.release();if(carrier)await releaseSphParticleExactMassRead(carrier);owner.retired=true;return true;
    })().catch(error=>{retirement=null;throw error;});
    return retirement;
  };
  const allocate=(label,size,usage=128|4|8)=>{
    if(!Number.isSafeInteger(size) || size<4 || size>device.limits.maxBufferSize
      || (usage&128)!==0 && size>device.limits.maxStorageBufferBindingSize) {
      throw new RangeError('Residual mechanics source exceeds GPU storage capacity');
    }
    const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);resources.add(b);
    const raw=b.destroy.bind(b);b.destroy=()=>{
      if(destroyed.has(b))return;
      if(!owner.retiring)throw new TypeError('Residual mechanics source storage is retained');
      raw();destroyed.add(b);
    };return b;
  };
  try {
    if(transported){
      transportRead=borrowSphReactionResidualTransport(transported,{device,source:transported.sourceHistory});
      if(transported.carrierSourceSphUpload!==sphParticleUpload || transported.carrierSourceMlsUpload!==mlsMpmParticleUpload){
        throw new TypeError('Residual successor changed its original carrier owner');
      }
      carrier=transportRead.forkCarrierRead();
    }else carrier=acquireSphParticleExactMassRead(sphParticleUpload,device,{mlsMpmParticleUpload});
    if(!transported && carrier.residualHistory && history && carrier.residualHistory!==history) {
      throw new TypeError('Residual mechanics cannot replace the carrier-owned history');
    }
    history??=carrier.residualHistory;
    residual=borrowSphReactionResidualHistory(history,{device});
    if(transported && residual.transportRecord!==transported){
      throw new TypeError('Residual mechanics requires the history from this exact transport');
    }
    const carrierCount=carrier.particleCount;
    if(phaseLayout){
      if(phaseLayout.sourcePlan!==sphInput.phaseCarrierPlan
        || phaseLayout.carrierLineageCount*phaseLayout.carrierLaneCount!==carrierCount){
        throw new TypeError('Residual phase materialization changed its original carrier grouping');
      }
      const lineageCount=phaseLayout.carrierLineageCount+history.capacity;
      phaseLayout=Object.freeze({...phaseLayout,lineageCount,particleCount:4*lineageCount,
        plan:Object.freeze({...phaseLayout.sourcePlan,lineageCapacity:lineageCount,primaryCapacity:lineageCount,
          phaseLaneCount:4,phaseLaneStride:lineageCount,companionStart:lineageCount,
          companionCapacity:3*lineageCount,particleCapacity:4*lineageCount,phaseCompanionLanesRequired:true})});
    }
    const count=phaseLayout?.particleCount??carrierCount+history.capacity;
    if(!Number.isSafeInteger(count) || count>0xfffffffe || Math.ceil(count/64)>device.limits.maxComputeWorkgroupsPerDimension
      || carrier.read.format.wordCount!==H.format.wordCount || carrier.read.format.quantumExponent!==H.format.quantumExponent
      || sphInput.storageGeneration!==mlsInput.storageGeneration
      || sphInput.stateStrideBytes!==32 || sphInput.thermoStrideBytes!==48
      || sphInput.identityStrideBytes!==4 || mlsInput.mechanicsStrideBytes!==128) {
      throw new RangeError('Residual mechanics requires the original bounded particle ABI');
    }
    const allocation=allocateSchroederSpatialSuccessorBufferFamilyIdentity({device,
      afterStorageGeneration:sphInput.storageGeneration,purpose:'canonical-residual-mechanics-view'});
    const stateBuffer=allocate('ulg-residual-mechanics-state',count*32);
    const thermoBuffer=allocate('ulg-residual-mechanics-thermo',count*48);
    const mechanicsBuffer=allocate('ulg-residual-mechanics-constitutive',count*128);
    const identityBuffer=allocate('ulg-residual-mechanics-identity',count*4);
    const controlBuffer=allocate('ulg-residual-mechanics-control',128);
    const params=allocate('ulg-residual-mechanics-shape',32,64|8);
    device.queue.writeBuffer(params,0,new Uint32Array([carrierCount,history.capacity,history.generation,history.seal,
      count,allocation.storageGeneration,transported?1:0,0]));
    const code=/* wgsl */ `
${createSphExactMassWgsl(H.format)}
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read_write> state:array<u32>;
@group(0) @binding(2) var<storage,read_write> thermo:array<u32>;
@group(0) @binding(3) var<storage,read_write> mechanics:array<u32>;
@group(0) @binding(4) var<storage,read_write> identity:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(6) var<uniform> cfg:array<vec4<u32>,2>;
@group(0) @binding(7) var<storage,read> transport_control:array<u32>;
@group(0) @binding(8) var<storage,read> history_control:array<u32>;
var<workgroup> maximum:array<u32,64>;
fn carrier_row(row:u32)->u32{return ${phaseLayout?`(row/${phaseLayout.carrierLineageCount}u)*${phaseLayout.lineageCount}u+row%${phaseLayout.carrierLineageCount}u`:'row'};}
fn fail(){atomicOr(&control[2],${SCHROEDER_RESIDUAL_MECHANICS_SOURCE_ERROR}u);}
@compute @workgroup_size(64) fn inspect(@builtin(global_invocation_id) id:vec3<u32>,@builtin(local_invocation_index) lane:u32) {
  var value=0u;if(id.x<cfg[0].x){value=identity[carrier_row(id.x)];}
  maximum[lane]=value;workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u){
    if(lane<stride){maximum[lane]=max(maximum[lane],maximum[lane+stride]);}workgroupBarrier();
  }
  if(lane==0u){atomicMax(&control[7],maximum[0]);}
  if(id.x==0u) {
    atomicStore(&control[0],0x524d5331u);atomicStore(&control[1],1u);
    atomicStore(&control[3],cfg[0].x);atomicStore(&control[4],min(history[3],cfg[0].y));
    atomicStore(&control[5],cfg[0].y);atomicStore(&control[6],cfg[1].x);
    atomicStore(&control[8],cfg[0].z);atomicStore(&control[9],cfg[0].w);
    if(history[0]!=0x50484731u || history[1]!=${H.version}u || history[2]!=1u || history[3]>cfg[0].y
      || history[4]!=cfg[0].y || history[5]!=${H.rowWords/4}u || history[6]!=cfg[0].z || history[7]!=cfg[0].w
      || history[8]!=(history[3]+63u)/64u || history[9]!=1u || history[10]!=1u || history[11]!=0u){fail();}
    if(cfg[1].z!=0u){
      // Both halves must describe the same accepted update or the same fully
      // restored rejection. A later history-only failure cannot advance carriers.
      let rejected=transport_control[2]!=0u;
      if(transport_control[0]!=0x52545031u || transport_control[1]!=1u
        || transport_control[3]!=select(3u,5u,rejected)
        || transport_control[9]!=0u || transport_control[10]!=0u
        || (history_control[2]!=0u)!=rejected
        || transport_control[4]!=cfg[0].x || transport_control[5]!=cfg[0].y
        || transport_control[6]!=history[3] || transport_control[7]+1u!=cfg[0].z){fail();}
    }
  }
}
@compute @workgroup_size(64) fn project(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=min(history[3],cfg[0].y)){return;}
  let base=${H.headerWords}u+row*${H.rowWords}u;let p=base+${H.physicalOffset}u;
  var mass=ExactMass();for(var w=0u;w<EM_WORDS;w++){mass.words[w]=history[base+${H.massOffset}u+w];}
  let projected=em_project_f32_bits(mass);
  if(em_zero(mass) || projected.error!=0u || projected.bits!=history[p+3u]){fail();return;}
  for(var w=0u;w<52u;w++){if((history[p+w]&0x7f800000u)==0x7f800000u){fail();return;}}
  let max_id=atomicLoad(&control[7]);
  // View-local domains keep new solids disjoint from every original carrier
  // domain. The physical owner's identity and history order remain unchanged.
  if(row>=0xffffffffu-max_id){fail();return;}
  let dest=${phaseLayout?`${phaseLayout.carrierLineageCount}u`:'cfg[0].x'}+row;
  for(var w=0u;w<8u;w++){state[dest*8u+w]=history[p+w];}
  for(var w=0u;w<12u;w++){thermo[dest*12u+w]=history[p+8u+w];}
  for(var w=0u;w<32u;w++){mechanics[dest*32u+w]=history[p+20u+w];}
  identity[dest]=max_id+row+1u;
}
@compute @workgroup_size(64) fn reserve(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=cfg[1].x || atomicLoad(&control[2])!=0u){return;}
  ${phaseLayout?`
  let lineage=row%${phaseLayout.lineageCount}u;let lane=row/${phaseLayout.lineageCount}u;
  let carrier_spare=lineage<${phaseLayout.carrierLineageCount}u && lane>=${phaseLayout.carrierLaneCount}u;
  let history_spare=lineage>=${phaseLayout.carrierLineageCount}u
    && lineage<${phaseLayout.carrierLineageCount}u+atomicLoad(&control[4]) && lane>0u;
  if(!carrier_spare && !history_spare){return;}
  // Match the existing one-to-four materializer's reserved physical ABI.
  // Every companion keeps its primary's lineage identity and caloric view.
  for(var w=0u;w<8u;w++){state[row*8u+w]=state[lineage*8u+w];}
  for(var w=0u;w<12u;w++){thermo[row*12u+w]=thermo[lineage*12u+w];}
  for(var w=0u;w<32u;w++){mechanics[row*32u+w]=mechanics[lineage*32u+w];}
  state[row*8u+3u]=0u;state[row*8u+4u]=0u;state[row*8u+5u]=0u;state[row*8u+6u]=0u;
  thermo[row*12u+9u]=0u;thermo[row*12u+10u]=0u;thermo[row*12u+11u]=0u;
  mechanics[row*32u+19u]=0u;mechanics[row*32u+21u]=0u;
  mechanics[row*32u+27u]=0u;mechanics[row*32u+31u]=0u;
  identity[row]=identity[lineage];`:'return;'}
}`;
    const resourcesForPass=[history.buffer,stateBuffer,thermoBuffer,mechanicsBuffer,identityBuffer,controlBuffer,params,
      transported?.controlBuffer??history.buffer,residual.controlBuffer??history.buffer];
    const passes=(phaseLayout?['inspect','project','reserve']:['inspect','project']).map(entryPoint=>{
      const pipeline=createCachedExplicitComputePipeline(device,{code,entryPoint,
        cacheKey:`ulg-residual-mechanics-source-v4-${phaseLayout?.carrierLineageCount??0}-${phaseLayout?.carrierLaneCount??0}-${phaseLayout?.lineageCount??0}-${entryPoint}`,
        bindings:['read-only-storage','storage','storage','storage','storage','storage','uniform','read-only-storage','read-only-storage']
          .map((type,binding)=>computeBufferBinding(binding,type))});
      return{pipeline:pipeline.pipeline,group:device.createBindGroup({layout:pipeline.bindGroupLayout,
        entries:resourcesForPass.map((buffer,binding)=>({binding,resource:{buffer}}))}),
        groups:Math.ceil((entryPoint==='inspect'?carrierCount:entryPoint==='reserve'?count:history.capacity)/64)};
    });
    const epoch=Object.fromEntries(epochKeys.map(k=>[k,sphInput[k]]));
    const phaseFields=phaseLayout?{phaseCarrierPlan:phaseLayout.plan}:{};
    const common={...epoch,...phaseFields,status:'webgpu-uploaded',particleCount:count,storageGeneration:allocation.storageGeneration};
    const sph=Object.freeze({...common,schema:ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,stateBuffer,thermoBuffer,identityBuffer,
      stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,identityRequired:true,
      stateBufferByteLength:count*32,thermoBufferByteLength:count*48,identityBufferByteLength:count*4});
    const mls=Object.freeze({...common,schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
      mechanicsBuffer,mechanicsStrideBytes:128,mechanicsBufferByteLength:count*128});
    // Empty host arrays satisfy the existing packed descriptor ABI. Every
    // actual source is the borrowed GPU view; no cold upload fallback exists.
    const sphState=Object.freeze({...epoch,...phaseFields,schema:ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,particleCount:count,
      stateStrideBytes:32,thermoStrideBytes:48,identityStrideBytes:4,
      state:new Float32Array(0),thermo:new Float32Array(0),smoothingLengthM});
    const mlsState=Object.freeze({...epoch,...phaseFields,schema:ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,particleCount:count,
      mechanicsStrideBytes:128,
      mechanics:new Float32Array(0)});
    markSphExactMassDerivedBuffers(carrier,[stateBuffer,thermoBuffer,identityBuffer],{mechanicsBuffers:[mechanicsBuffer]});
    const encoder=device.createCommandEncoder();
    for(const [before,after,stride]of [[transported?.carrierStateBuffer??sphInput.stateBuffer,stateBuffer,32],
      [transported?.carrierThermoBuffer??sphInput.thermoBuffer,thermoBuffer,48],
      [transported?.carrierMechanicsBuffer??mlsInput.mechanicsBuffer,mechanicsBuffer,128],
      [sphInput.identityBuffer,identityBuffer,4]]){
      if(phaseLayout)for(let lane=0;lane<phaseLayout.carrierLaneCount;lane++){
        encoder.copyBufferToBuffer(before,lane*phaseLayout.carrierLineageCount*stride,after,
          lane*phaseLayout.lineageCount*stride,phaseLayout.carrierLineageCount*stride);
      }else encoder.copyBufferToBuffer(before,0,after,0,carrierCount*stride);
    }
    for(const p of passes){const pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);pass.setBindGroup(0,p.group);pass.dispatchWorkgroups(p.groups);pass.end();}
    owner.validate();device.queue.submit([encoder.finish()]);
    const source=Object.freeze({schema:'peercompute.ulg.residual-mechanics-source.v1',device,carrierCount,
      historyCapacity:history.capacity,history,controlBuffer,allocation,particleCount:count,phaseLayout,
      sphParticleState:sphState,mlsMpmParticleState:mlsState,sphParticleUpload:sph,mlsMpmParticleUpload:mls,
      physicalPublicationAdmitted:false,retire});
    owner.carrier=carrier;owner.carrierMlsUpload=mlsMpmParticleUpload;owner.carrierEnergy=transported?.carrierEnergy??carrier.energy;
    owner.historyRead=residual;owners.set(source,owner);return source;
  }catch(error){
    // This is failure retirement only; the normal path uses its caller's
    // existing batch fence, without a per-interval observation or host choice.
    error.residualSourceCleanup=retire(device.queue.onSubmittedWorkDone().then(()=>true));
    void error.residualSourceCleanup.catch(()=>{});throw error;
  }
}

/** Materialize retained products into additional real phase lineages. Existing
 * carrier quartets keep their grouping; a declared single-lane cold source
 * gains the same companions as the standard one-to-four materializer. */
export async function createSchroederResidualPhaseMechanicsSource(args={}){
  const {validateSphPhaseCarrierPlan}=await import('./sphPhaseCarrierTransferGpu.js');
  const plan=Object.getOwnPropertyDescriptor(args.sphParticleUpload??{},'phaseCarrierPlan')?.value;
  const admitted=validateSphPhaseCarrierPlan(plan,args.sphParticleUpload?.particleCount,{allowLawsQuiescentSingleLane:true});
  if(!admitted.accepted || !Object.isFrozen(plan))throw new TypeError('Residual phase source requires its original fixed carrier plan');
  return createSchroederResidualMechanicsSource({...args,phaseLayout:Object.freeze({sourcePlan:plan,
    carrierLineageCount:admitted.lineageCapacity,carrierLaneCount:admitted.phaseLaneCount})},phaseLayoutAuthority);
}

/** Retain the original projection and its canonical inputs for a mechanics
 * consumer. A copied descriptor cannot supply a new row association. */
export function borrowSchroederResidualMechanicsSource(source,{device}={}) {
  const owner=original(source,device);owner.readers++;
  let released=false;
  const read=Object.freeze({source,carrier:owner.carrier,carrierEnergy:owner.carrierEnergy,historyRead:owner.historyRead,
    carrierMlsUpload:owner.carrierMlsUpload,
    validate(){
      if(released || owner.retired)throw new TypeError('Residual mechanics read is retired');
      owner.validate();return true;
    },
    release(){if(released)return false;released=true;owner.readers--;return true;}});
  reads.set(read,{owner,device});return read;
}

export function resolveSchroederResidualMechanicsSourceRead(read,{device}={}) {
  if(reads.get(read)?.device!==device)throw new TypeError('Residual mechanics requires its original retained read');
  read.validate();return read;
}

export async function runSchroederResidualMechanicsLevelAssignment({device,source,...policy}={}) {
  const owner=original(source,device);
  const assignment=await runSchroederLevelAssignmentWebGpu({...policy,device,
    sphParticleState:source.sphParticleState,mlsMpmParticleState:source.mlsMpmParticleState,
    sphParticleUpload:source.sphParticleUpload,mlsMpmParticleUpload:source.mlsMpmParticleUpload,
    retainAssignmentBuffer:true,readbackMode:'no-full-readback',queueOrderedCleanup:true});
  try {
    original(source,device);owner.validate();
    const code=`
@group(0) @binding(0) var<storage,read> control:array<u32>;
@group(0) @binding(1) var<storage,read_write> rows:array<u32>;
@compute @workgroup_size(64) fn gate(@builtin(global_invocation_id) id:vec3<u32>){
  if(control[2]!=0u && id.x<arrayLength(&rows)/16u){rows[id.x*16u+10u]=0u;}
}`;
    const p=createCachedExplicitComputePipeline(device,{code,entryPoint:'gate',cacheKey:'ulg-residual-source-assignment-gate-v1',
      bindings:[computeBufferBinding(0,'read-only-storage'),computeBufferBinding(1,'storage')]});
    const group=device.createBindGroup({layout:p.bindGroupLayout,entries:[source.controlBuffer,assignment.assignmentBuffer]
      .map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);
    pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(source.particleCount/64));pass.end();
    device.queue.submit([encoder.finish()]);return assignment;
  }catch(error){assignment.destroyAssignmentBuffer();throw error;}
}
