import { forkSphReactionResidualHistoryRead, SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from './sphReactionResidualHistoryGpu.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { sphExactMechanicsHeatPacketWgsl } from './sphExactThermalEnergyWgsl.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createCachedExplicitComputePipeline, computeBufferBinding } from '../webgpuComputeLayout.js';

const records=new WeakMap();
export const SPH_RESIDUAL_TRANSPORT_ERROR=8388608;

export function borrowSphReactionResidualTransport(record,{device,source}={}) {
  const owner=records.get(record);
  if(!owner || owner.device!==device || owner.closed || owner.retired || !owner.finalized || record.sourceHistory!==source) {
    throw new TypeError('Residual history requires its original finalized transport producer');
  }
  owner.validate();owner.readers++;let live=true;
  return Object.freeze({record,
    validate(){if(!live || owner.retired)throw new TypeError('Residual transport read is retired');owner.validate();return true;},
    forkSourceRead(){this.validate();return forkSphReactionResidualHistoryRead(owner.historyRead,{device});},
    forkCarrierRead(){this.validate();return owner.forkCarrierRead();},
    release(){if(live){live=false;owner.readers--;}return owner.retire();}});
}

/** Split one genuine combined G2P result, preserving its original source as
 * rollback authority. Mechanics work follows the existing canonical thermal
 * packet rule. This is a private stage; thermal/phase/reaction closure and
 * accepted state/clock publication remain the interval owner's responsibility. */
export async function prepareSphReactionResidualTransport({device,g2p,sphParticleUpload,
  thermalResult=null,thermalToken=null,thermalMaterialTable=null,sphParticleState=null}={}) {
  const {acquireMlsMpmG2pExactMassCapture,acquireMlsMpmLevelChainG2pCapture}=await import('./sphG2pGpuKernel.js');
  const {resolveSphResidualMechanicsSourceRead,forkSphParticleExactMassRead,releaseSphParticleExactMassRead}=
    await import('./sphGpuBuffers.js');
  let pin,chain,thermalPin,historyRead,carrierRead,record;
  const resources=new Set(),destroyed=new Set();
  const owner={device,closed:false,retired:false,retiring:false,readers:0,finalized:false,inputsReleased:false,
    validate(){
      if(this.retired)throw new TypeError('Residual transport is retired');
      historyRead?.validate();
      if(!this.inputsReleased){pin?.validate();chain?.validate();thermalPin?.validate();}
    },
    retire(){
      if(!this.closed || this.readers || this.retired)return false;
      this.retiring=true;const errors=[];
      for(const b of resources)if(!destroyed.has(b))try{b.destroy();destroyed.add(b);}catch(e){errors.push(e);}
      this.retiring=false;
      if(errors.length)throw new AggregateError(errors,'Residual transport cleanup failed');
      pin?.release();chain?.release();if(thermalPin)void thermalPin.release();historyRead?.release();
      if(carrierRead)void releaseSphParticleExactMassRead(carrierRead, { deferInBurst: true });
      this.retired=true;return true;
    }};
  const destroy=()=>{owner.closed=true;return owner.retire();};
  const allocate=(label,size,usage=128|4|8)=>{
    if(!Number.isSafeInteger(size) || size<4 || size>device.limits.maxBufferSize || size>device.limits.maxStorageBufferBindingSize) {
      throw new RangeError('Residual transport exceeds GPU storage capacity');
    }
    const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);resources.add(b);
    const raw=b.destroy.bind(b);b.destroy=()=>{
      if(destroyed.has(b))return;
      if(!owner.retiring)throw new TypeError('Residual transport storage is retained');raw();destroyed.add(b);
    };return b;
  };
  try {
    pin=acquireMlsMpmG2pExactMassCapture(g2p,{device,sphParticleUpload});
    const original=resolveSphResidualMechanicsSourceRead(pin.sourceRead,{device}),source=original.source;
    if(source.phaseLayout)throw new TypeError('Phase-expanded residuals require complete phase/reaction transport');
    chain=acquireMlsMpmLevelChainG2pCapture(g2p,{device,transaction:pin.transaction,generation:pin.generation,
      sphParticleUpload,mlsMpmParticleUpload:pin.sourceMlsUpload,dt:pin.dt,
      stateBuffer:pin.stateBuffer,mechanicsBuffer:pin.mechanicsBuffer});
    if(!chain || !original.carrierEnergy || pin.particleCount!==source.particleCount) {
      throw new TypeError('Residual transport requires a genuine chain and canonical carrier energy');
    }
    historyRead=forkSphReactionResidualHistoryRead(original.historyRead,{device});owner.historyRead=historyRead;
    carrierRead=forkSphParticleExactMassRead(original.carrier,{device,sourceSphUpload:original.carrier.sourceSphUpload});
    owner.forkCarrierRead=()=>forkSphParticleExactMassRead(carrierRead,{device,sourceSphUpload:carrierRead.sourceSphUpload});
    const carrierEnergy=original.carrierEnergy;
    const n=source.carrierCount,capacity=source.historyCapacity,W=H.format.wordCount;
    if(thermalResult){
      const {acquireSphThermalExactMassSourceCapture}=await import('./sphThermalGpuKernel.js');
      thermalPin=await acquireSphThermalExactMassSourceCapture(thermalResult,thermalToken,{
        device,sphParticleUpload,mlsMpmParticleUpload:pin.sourceMlsUpload,sphParticleState,
        thermalMaterialTable,transaction:pin.transaction,generation:pin.generation,dtSeconds:pin.dt,g2pResult:g2p});
      if(!pin.sourceRead.energy || !thermalPin.energy || thermalPin.energy.rowCount!==source.particleCount
        || thermalPin.energy.format.wordCount!==W || thermalPin.energy.format.quantumExponent!==H.format.quantumExponent){
        throw new TypeError('Residual thermal transport requires its complete canonical energy producer');
      }
    }else if(thermalToken || thermalMaterialTable || sphParticleState){
      throw new TypeError('Residual thermal transport requires the complete original producer');
    }
    const physical=thermalPin??pin;
    const buffer=allocate('ulg-residual-transport-history',source.history.buffer.size);
    const stateBuffer=allocate('ulg-residual-transport-carriers',n*32);
    const mechanicsBuffer=allocate('ulg-residual-transport-carrier-mechanics',n*128);
    const thermoBuffer=allocate('ulg-residual-transport-carrier-thermo',n*48);
    const energyBuffer=allocate('ulg-residual-transport-carrier-energy',carrierEnergy.energyBuffer.size);
    const controlBuffer=allocate('ulg-residual-transport-control',128);
    const params=allocate('ulg-residual-transport-identities',16,64|8);
    device.queue.writeBuffer(params,0,new Uint32Array([source.history.generation,source.history.seal,chain.levelCount,thermalPin?1:0]));
    const inventoryCheck=thermalPin?(await import('./schroederSpatialChainMassConservationGpu.js'))
      .prepareSchroederChainInventoryCheck({device,allocate,controlBuffer,
        originalMassRead:pin.sourceRead.read,candidateMassRead:pin.sourceRead.read,
        originalEnergy:pin.sourceRead.energy,candidateEnergy:thermalPin.energy}):null;
    const code=`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
${sphExactMechanicsHeatPacketWgsl()}
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> s:array<u32>;
@group(0) @binding(2) var<storage,read> m:array<u32>;
@group(0) @binding(3) var<storage,read> old_energy:array<u32>;
@group(0) @binding(4) var<storage,read> old_s:array<u32>;
@group(0) @binding(5) var<storage,read> source_control:array<u32>;
@group(0) @binding(6) var<storage,read> mechanics_control:array<u32>;
@group(0) @binding(7) var<storage,read_write> after:array<u32>;
@group(0) @binding(8) var<storage,read_write> carrier_s:array<u32>;
@group(0) @binding(9) var<storage,read_write> carrier_m:array<u32>;
@group(0) @binding(10) var<storage,read_write> energy:array<u32>;
@group(0) @binding(11) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(12) var<uniform> cfg:vec4<u32>;
const N:u32=${n}u;const CAP:u32=${capacity}u;const HEAD:u32=${H.headerWords}u;const ROW:u32=${H.rowWords}u;
fn fail(){atomicOr(&control[2],${SPH_RESIDUAL_TRANSPORT_ERROR}u);}
fn live(row:u32)->bool{return row<N || row<N+min(before[3],CAP);}
fn load_energy(row:u32,source:bool)->ExactMass {
  var value=ExactMass();
  for(var w=0u;w<EM_WORDS;w++){
    if(cfg.w!=0u){value.words[w]=old_energy[(row+select(0u,N+CAP,source))*EM_WORDS+w];}
    else if(row<N){value.words[w]=old_energy[row*EM_WORDS+select(0u,N*EM_WORDS,source)+w];}
    else{value.words[w]=before[HEAD+(row-N)*ROW+select(${H.energyOffset}u,${H.sourceOffset}u,source)+w];}
  }
  return value;
}
struct Expected { u:ExactMass, source:ExactMass, view:u32, error:u32 };
fn expected(row:u32)->Expected {
  let mass=bitcast<f32>(s[row*8u+3u]);let incoming=bitcast<f32>(s[row*8u+7u]);
  var out=Expected(load_energy(row,false),load_energy(row,true),s[row*8u+7u],0u);
  if(mass==0.0){return out;}
  if(cfg.w!=0u){
    let projected=el_project_f32_bits(out.u);let view=bitcast<f32>(projected.bits)/mass;
    out.error=projected.error;
    if(!(abs(view)<=3.402823e38) || abs(bitcast<i32>(view)-bitcast<i32>(incoming))>8
      || (view>=0.0)!=(incoming>=0.0)){out.error|=1u;}
    return out;
  }
  let heat=mechanics_heat_packet(out.u,mass,incoming);
  let u=el_add(out.u,heat.value);let sources=el_add(out.source,heat.value);
  let projected=el_project_f32_bits(u.value);
  out.u=u.value;out.source=sources.value;out.error=heat.error|u.error|sources.error|projected.error;
  let view=bitcast<f32>(projected.bits)/mass;
  if(!(abs(view)<=3.402823e38)){out.error|=1u;}
  let near=abs(bitcast<i32>(view)-bitcast<i32>(incoming))<=8 && (view>=0.0)==(incoming>=0.0);
  out.view=bitcast<u32>(select(view,incoming,near));return out;
}
@compute @workgroup_size(1) fn initialize(){
  atomicStore(&control[0],0x52545031u);atomicStore(&control[1],1u);
  atomicStore(&control[4],N);atomicStore(&control[5],CAP);atomicStore(&control[6],min(before[3],CAP));
  atomicStore(&control[7],cfg.x);atomicStore(&control[8],cfg.y);
  atomicStore(&control[9],source_control[2]);atomicStore(&control[10],old_energy[2u*N*EM_WORDS]);
  if(source_control[0]!=0x524d5331u || source_control[1]!=1u || source_control[2]!=0u
    || source_control[3]!=N || source_control[4]!=before[3] || source_control[5]!=CAP
    || source_control[8]!=cfg.x || source_control[9]!=cfg.y
    || before[3]>CAP || before[6]!=cfg.x || before[7]!=cfg.y
    || mechanics_control[0]!=0x53475031u || mechanics_control[1]!=3u || mechanics_control[2]!=0u
    || mechanics_control[16]!=cfg.z || old_energy[2u*N*EM_WORDS]!=0u){fail();}
}
@compute @workgroup_size(1) fn validate_energy(){
 if(cfg.w!=0u && old_energy[2u*(N+CAP)*EM_WORDS]!=0u){fail();}
}
@compute @workgroup_size(64) fn update(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=N+CAP || !live(row) || atomicLoad(&control[2])!=0u){return;}
  if(s[row*8u+3u]!=old_s[row*8u+3u]){fail();return;}
  for(var w=0u;w<8u;w++){if((s[row*8u+w]&0x7f800000u)==0x7f800000u){fail();}}
  for(var w=0u;w<32u;w++){if((m[row*32u+w]&0x7f800000u)==0x7f800000u){fail();}}
  let e=expected(row);if(e.error!=0u){fail();return;}
  if(row<N){
    carrier_s[row*8u+7u]=e.view;
    for(var w=0u;w<EM_WORDS;w++){energy[row*EM_WORDS+w]=e.u.words[w];energy[(N+row)*EM_WORDS+w]=e.source.words[w];}
  }else{
    let h=HEAD+(row-N)*ROW;
    for(var w=0u;w<8u;w++){after[h+${H.stateOffset}u+w]=s[row*8u+w];}
    after[h+${H.stateOffset+7}u]=e.view;
    for(var w=0u;w<32u;w++){after[h+${H.mechanicsOffset}u+w]=m[row*32u+w];}
    for(var w=0u;w<EM_WORDS;w++){after[h+${H.energyOffset}u+w]=e.u.words[w];after[h+${H.sourceOffset}u+w]=e.source.words[w];}
  }
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=N+CAP || atomicLoad(&control[2])!=0u){return;}
  if(row==0u){for(var w=0u;w<HEAD;w++){if(after[w]!=before[w]){fail();}}}
  if(!live(row)){for(var w=0u;w<ROW;w++){if(after[HEAD+(row-N)*ROW+w]!=before[HEAD+(row-N)*ROW+w]){fail();}}return;}
  let e=expected(row);if(e.error!=0u){fail();}
  if(row<N){
    for(var w=0u;w<8u;w++){if(carrier_s[row*8u+w]!=select(s[row*8u+w],e.view,w==7u)){fail();}}
    for(var w=0u;w<32u;w++){if(carrier_m[row*32u+w]!=m[row*32u+w]){fail();}}
    for(var w=0u;w<EM_WORDS;w++){if(energy[row*EM_WORDS+w]!=e.u.words[w] || energy[(N+row)*EM_WORDS+w]!=e.source.words[w]){fail();}}
  }else{
    let h=HEAD+(row-N)*ROW;
    for(var w=0u;w<ROW;w++){
      if(cfg.w!=0u && w>=${H.thermoOffset}u && w<${H.mechanicsOffset}u){continue;}
      var value=before[h+w];
      if(w>=${H.stateOffset}u && w<${H.stateOffset+8}u){value=s[row*8u+w-${H.stateOffset}u];}
      if(w==${H.stateOffset+7}u){value=e.view;}
      if(w>=${H.mechanicsOffset}u){value=m[row*32u+w-${H.mechanicsOffset}u];}
      if(w>=${H.energyOffset}u && w<${H.energyOffset+W}u){value=e.u.words[w-${H.energyOffset}u];}
      if(w>=${H.sourceOffset}u && w<${H.sourceOffset+W}u){value=e.source.words[w-${H.sourceOffset}u];}
      if(after[h+w]!=value){fail();}
    }
  }
}
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(atomicLoad(&control[2])==0u){return;}
  if(row==0u){
    for(var w=0u;w<HEAD;w++){after[w]=before[w];}
    for(var w=0u;w<4u;w++){energy[2u*N*EM_WORDS+w]=old_energy[2u*N*EM_WORDS+w];}
  }
  if(row<CAP){for(var w=0u;w<ROW;w++){after[HEAD+row*ROW+w]=before[HEAD+row*ROW+w];}}
  if(row<N){
    for(var w=0u;w<8u;w++){carrier_s[row*8u+w]=old_s[row*8u+w];}
    for(var w=0u;w<EM_WORDS;w++){
      energy[row*EM_WORDS+w]=old_energy[row*EM_WORDS+w];energy[(N+row)*EM_WORDS+w]=old_energy[(N+row)*EM_WORDS+w];
    }
  }
}
@compute @workgroup_size(1) fn finalize(){atomicStore(&control[3],select(3u,5u,atomicLoad(&control[2])!=0u));}
`;
    const buffers=[historyRead.buffer,physical.stateBuffer,pin.mechanicsBuffer,thermalPin?.energy.energyBuffer??carrierEnergy.energyBuffer,
      source.sphParticleUpload.stateBuffer,source.controlBuffer,chain.controlBuffer,buffer,stateBuffer,mechanicsBuffer,energyBuffer,controlBuffer,params];
    const types=buffers.map((_,i)=>i===12?'uniform':i<7?'read-only-storage':'storage');
    const passes=Object.fromEntries(['initialize','validate_energy','update','check','restore','finalize'].map(entryPoint=>{
      const p=createCachedExplicitComputePipeline(device,{code,entryPoint,
        cacheKey:`ulg-residual-transport-v3-${n}-${capacity}-${entryPoint}`,
        bindings:types.map((type,binding)=>computeBufferBinding(binding,type))});
      const group=device.createBindGroup({layout:p.bindGroupLayout,entries:buffers.map((buffer,binding)=>({binding,
        resource:{buffer:binding===3 && ['initialize','restore'].includes(entryPoint)?carrierEnergy.energyBuffer:buffer}}))});
      return[entryPoint,(encoder,groups)=>{const pss=encoder.beginComputePass();pss.setPipeline(p.pipeline);pss.setBindGroup(0,group);pss.dispatchWorkgroups(groups);pss.end();}];
    }));
    // M rollback has its own source binding; keep the principal pass at the
    // existing twelve-storage-buffer device limit.
    const restoreM=createCachedExplicitComputePipeline(device,{code:`
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read_write> after:array<u32>;
@group(0) @binding(2) var<storage,read> control:array<u32>;
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id:vec3<u32>){
 if(control[2]!=0u && id.x<arrayLength(&after)/32u){for(var w=0u;w<32u;w++){after[id.x*32u+w]=before[id.x*32u+w];}}}
`,entryPoint:'restore',cacheKey:'ulg-residual-transport-restore-m',bindings:
      ['read-only-storage','storage','read-only-storage'].map((t,i)=>computeBufferBinding(i,t))});
    const restoreMGroup=device.createBindGroup({layout:restoreM.bindGroupLayout,entries:
      [source.mlsMpmParticleUpload.mechanicsBuffer,mechanicsBuffer,controlBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const thermoPasses=thermalPin?Object.fromEntries(['update','check','restore'].map(entryPoint=>{
      const p=createCachedExplicitComputePipeline(device,{entryPoint,cacheKey:`ulg-residual-transport-thermo-v1-${n}-${capacity}-${entryPoint}`,
        bindings:['read-only-storage','read-only-storage','storage','storage','storage'].map((t,i)=>computeBufferBinding(i,t)),code:`
@group(0) @binding(0) var<storage,read> input:array<u32>;
@group(0) @binding(1) var<storage,read> before:array<u32>;
@group(0) @binding(2) var<storage,read_write> history:array<u32>;
@group(0) @binding(3) var<storage,read_write> carrier:array<u32>;
@group(0) @binding(4) var<storage,read_write> control:array<atomic<u32>>;
fn live(row:u32)->bool{return row<${n}u+before[3];}
@compute @workgroup_size(64) fn update(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(!live(row) || atomicLoad(&control[2])!=0u){return;}
 for(var w=0u;w<12u;w++){let value=input[row*12u+w];
  if((value&0x7f800000u)==0x7f800000u){atomicOr(&control[2],${SPH_RESIDUAL_TRANSPORT_ERROR}u);}
  if(row<${n}u){carrier[row*12u+w]=value;}else{history[${H.headerWords}u+(row-${n}u)*${H.rowWords}u+${H.thermoOffset}u+w]=value;}
 }
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(!live(row) || atomicLoad(&control[2])!=0u){return;}
 for(var w=0u;w<12u;w++){
  var value=0u;if(row<${n}u){value=carrier[row*12u+w];}else{value=history[${H.headerWords}u+(row-${n}u)*${H.rowWords}u+${H.thermoOffset}u+w];}
  if(value!=input[row*12u+w]){atomicOr(&control[2],${SPH_RESIDUAL_TRANSPORT_ERROR}u);}
 }
}
@compute @workgroup_size(64) fn restore(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row>=${n}u || atomicLoad(&control[2])==0u){return;}
 for(var w=0u;w<12u;w++){carrier[row*12u+w]=input[row*12u+w];}
}`});
      const group=device.createBindGroup({layout:p.bindGroupLayout,entries:[entryPoint==='restore'?source.sphParticleUpload.thermoBuffer:thermalPin.thermoBuffer,
        historyRead.buffer,buffer,thermoBuffer,controlBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
      return[entryPoint,encoder=>{const pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);pass.setBindGroup(0,group);
        pass.dispatchWorkgroups(Math.ceil(source.particleCount/64));pass.end();}];
    })):null;
    record=Object.freeze({device,buffer,controlBuffer,sourceHistory:source.history,
      carrierStateBuffer:stateBuffer,carrierMechanicsBuffer:mechanicsBuffer,carrierThermoBuffer:thermoBuffer,
      carrierEnergy:Object.freeze({energyBuffer,format:carrierEnergy.format,rowCount:n}),
      carrierSourceSphUpload:original.carrier.sourceSphUpload,
      carrierSourceMlsUpload:original.carrierMlsUpload,
      carrierCount:n,capacity,generation:source.history.generation,seal:source.history.seal,
      thermalApplied:Boolean(thermalPin),physicalPublicationAdmitted:false});
    records.set(record,owner);let encoded=false,checked=false;
    const liveOwner=()=>{if(owner.closed || owner.inputsReleased)throw new TypeError('Residual transport producer is closed');owner.validate();};
    return Object.freeze({record,destroy,
      encode(encoder){liveOwner();if(encoded)throw new TypeError('Residual transport encodes once');
        encoder.copyBufferToBuffer(historyRead.buffer,0,buffer,0,buffer.size);
        encoder.copyBufferToBuffer(physical.stateBuffer,0,stateBuffer,0,stateBuffer.size);
        encoder.copyBufferToBuffer(pin.mechanicsBuffer,0,mechanicsBuffer,0,mechanicsBuffer.size);
        encoder.copyBufferToBuffer(source.sphParticleUpload.thermoBuffer,0,thermoBuffer,0,thermoBuffer.size);
        encoder.copyBufferToBuffer(carrierEnergy.energyBuffer,0,energyBuffer,0,energyBuffer.size);
        if(thermalPin)encoder.copyBufferToBuffer(thermalPin.energy.energyBuffer,2*source.particleCount*W*4,energyBuffer,2*n*W*4,16);
        passes.initialize(encoder,1);passes.validate_energy(encoder,1);inventoryCheck?.(encoder);
        passes.update(encoder,Math.ceil(source.particleCount/64));thermoPasses?.update(encoder);encoded=true;},
      check(encoder){liveOwner();if(!encoded || owner.finalized)throw new TypeError('Residual transport check requires an unfinished encoding');
        passes.check(encoder,Math.ceil(source.particleCount/64));thermoPasses?.check(encoder);checked=true;},
      restore(encoder){liveOwner();if(!checked || owner.finalized)throw new TypeError('Residual transport requires a checked single finalization');
        passes.restore(encoder,Math.ceil(Math.max(n,capacity)/64));
        const p=encoder.beginComputePass();p.setPipeline(restoreM.pipeline);p.setBindGroup(0,restoreMGroup);p.dispatchWorkgroups(Math.ceil(n/64));p.end();
        thermoPasses?.restore(encoder);passes.finalize(encoder,1);owner.finalized=true;},
      async releaseMechanicsAfter(after){
        if(!owner.finalized || !after || typeof after.then!=='function' || await after!==true)throw new TypeError('Residual transport requires confirmed final batch completion');
        if(owner.inputsReleased)return false;await thermalPin?.release();pin.release();chain.release();owner.inputsReleased=true;return true;
      }
    });
  }catch(error){destroy();throw error;}
}
