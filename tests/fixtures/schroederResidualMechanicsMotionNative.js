import { bindSphExactMassResidualMechanicsSource, acquireSphParticleExactMassRead,
  releaseSphParticleExactMassRead } from '../../src/runtime/sph/sphGpuBuffers.js';
import { runSchroederSpatialChainMechanicsWebGpu } from '../../src/runtime/sph/schroederSpatialChainMechanicsGpu.js';
import { abortSchroederSpatialEpochTransaction } from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { borrowSchroederResidualMechanicsSource } from '../../src/runtime/sph/schroederResidualMechanicsSourceGpu.js';
import { prepareSphReactionResidualTransport } from '../../src/runtime/sph/sphReactionResidualTransportGpu.js';
import { prepareSphReactionResidualHistory } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { runResidualThermalFixture } from './schroederResidualThermalNative.js';
import { checkResidualThermalReceipt } from './schroederResidualThermalReceiptNative.js';

export async function checkResidualMechanicsMotion({device,source,generation,levels,kind,receipt,check,rejected,transport=false,make,retain=false,thermalData=null}) {
  let binding,mechanics,read,original,transported,history,holder,historyControl,thermal;
  let handedOff=false;
  const cleanup=async()=>{
    if(transported){
      await transported.releaseMechanicsAfter(Promise.resolve(true));
      holder?.destroy();history?.destroy();transported.destroy();
    }
    thermal?.destroy();
    mechanics?.g2p.destroyOutputParticleBuffers();
    if(mechanics){
      for(const p of mechanics.proposals)if(!p.released)await p.releaseAfterSubmittedWork();
      await mechanics.composite.releaseExecutionAfter(mechanics.execution);mechanics.composite.destroy();
      abortSchroederSpatialEpochTransaction(mechanics.transaction);
    }
    if(read)await releaseSphParticleExactMassRead(read);
    binding?.destroy();original?.release();
  };
  try {
    original=borrowSchroederResidualMechanicsSource(source,{device});
    binding=await bindSphExactMassResidualMechanicsSource({device,source,includeEnergy:Boolean(thermalData)});
    read=acquireSphParticleExactMassRead(binding.sphParticleUpload,device,binding);
    const pressure=kind==='pressure',forceInputs={dt:0.001,
      gravityMPerS2:pressure?[0,0,0]:[0.25,-9.81,0.125],boxDimsM:[32,32,32],
      wallsEnabled:false,contactEnabled:false,cflFactor:0.4,
      wallBarrierElasticStiffnessNPerM:0,wallBarrierContactScale:1,wallBarrierMinGapM:0.0001};
    mechanics=await runSchroederSpatialChainMechanicsWebGpu({device,source:binding,generation,
      mechanicsLevels:levels,forceInputs,internalPressureScale:pressure?1:0,
      mechanicsOptions:{relaxation:0,normalVelocityDamping:0,cleanupPassBudget:1024}});
    const {g2p}=mechanics,encoder=device.createCommandEncoder();
    check(encoder,`
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read> old_m:array<u32>;
@group(0) @binding(3) var<storage,read> new_m:array<u32>;
@group(0) @binding(4) var<storage,read> control:array<u32>;
@group(0) @binding(5) var<storage,read> mass:array<u32>;
@group(0) @binding(6) var<storage,read> history:array<u32>;
@group(0) @binding(7) var<storage,read_write> receipt:array<atomic<u32>>;
@group(0) @binding(8) var<storage,read> original_mass:array<u32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${source.particleCount}u){return;}
  if(row==0u){
    atomicStore(&receipt[10],control[1]);atomicStore(&receipt[11],control[2]);
    if(control[0]!=0x53475031u || control[16]!=3u || control[1]!=${rejected?5:3}u){atomicOr(&receipt[0],1024u);}
    if(!${rejected} && control[2]!=0u){atomicOr(&receipt[0],1024u);}
  }
  if(${rejected}){
    for(var w=0u;w<8u;w++){if(before[row*8u+w]!=after[row*8u+w]){atomicOr(&receipt[0],2048u);}}
    for(var w=0u;w<32u;w++){if(old_m[row*32u+w]!=new_m[row*32u+w]){atomicOr(&receipt[0],2048u);}}
    return;
  }
  if(row>=${source.carrierCount}u && row<${source.carrierCount}u+history[3]){
    for(var w=0u;w<${H.format.wordCount}u;w++){
      if(mass[row*${H.format.wordCount}u+w]!=history[${H.headerWords}u+(row-${source.carrierCount}u)*${H.rowWords}u+${H.massOffset}u+w]){
        atomicOr(&receipt[0],4096u);
      }
    }
  }
  if(row<${source.carrierCount}u){
    for(var w=0u;w<${H.format.wordCount}u;w++){
      if(mass[row*${H.format.wordCount}u+w]!=original_mass[(${original.carrier.read.rowOffset}u+row)*${H.format.wordCount}u+w]){
        atomicOr(&receipt[0],4096u);
      }
    }
  }
  if(before[row*8u+3u]==0u){return;}
  if(before[row*8u+3u]!=after[row*8u+3u]){atomicOr(&receipt[0],8192u);}
  var moved=false;var accelerated=false;
  let g=vec3<f32>(0.25,-9.81,0.125);
  for(var axis=0u;axis<3u;axis++){
    let x=bitcast<f32>(after[row*8u+axis]);let v=bitcast<f32>(after[row*8u+4u+axis]);
    if(!(abs(x)<3.402823e38) || !(abs(v)<3.402823e38)){atomicOr(&receipt[0],16384u);}
    moved=moved || after[row*8u+axis]!=before[row*8u+axis];
    accelerated=accelerated || abs(v-bitcast<f32>(before[row*8u+4u+axis]))>1e-8;
    if(!${pressure}){
      let expected=bitcast<f32>(before[row*8u+4u+axis])+g[axis]*0.001;
      atomicMax(&receipt[16],bitcast<u32>(abs(v-expected)));
      atomicMax(&receipt[17],bitcast<u32>(abs(x-bitcast<f32>(before[row*8u+axis])-expected*0.001)));
      if(abs(v-expected)>0.00002 || abs(x-bitcast<f32>(before[row*8u+axis])-expected*0.001)>0.000004){atomicOr(&receipt[0],32768u);}
    }
  }
  if(!${pressure} && !moved){atomicOr(&receipt[0],65536u);}
  if(accelerated && row>=${source.carrierCount}u){atomicAdd(&receipt[12],1u);}
  if(row>=${source.carrierCount}u){atomicAdd(&receipt[13],1u);}
  if(${pressure} && row>=${source.carrierCount}u){
    // A deformed solid retains its existing constitutive state. Restoring F
    // to identity after the force update would incorrectly pass a motion-only check.
    if(abs(bitcast<f32>(new_m[row*32u+1u])-0.2)>0.01){atomicOr(&receipt[0],262144u);}
    var affine=false;
    for(var w=9u;w<18u;w++){
      affine=affine || abs(bitcast<f32>(new_m[row*32u+w]))>1e-9;
    }
    if(affine){atomicAdd(&receipt[14],1u);}
  }
  for(var w=0u;w<32u;w++){if((new_m[row*32u+w]&0x7f800000u)==0x7f800000u){atomicOr(&receipt[0],131072u);}}
}`,[binding.sphParticleUpload.stateBuffer,g2p.stateBuffer,binding.mlsMpmParticleUpload.mechanicsBuffer,
      g2p.mechanicsBuffer,g2p.controlBuffer,read.read.buffer,source.history.buffer,receipt,
      original.carrier.read.buffer],source.particleCount);
    device.queue.submit([encoder.finish()]);
    if(transport){
      if(thermalData){
        thermal=await runResidualThermalFixture({device,binding,mechanics,generation,data:thermalData,kind});
        if(kind==='thermal-ledger-fault'){
          const fault=device.createCommandEncoder();check(fault,`
@group(0) @binding(0) var<storage,read_write> energy:array<u32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){if(id.x==0u){energy[0]^=1u;}}
`,[thermal.result.exactEnergy.energyBuffer],1);device.queue.submit([fault.finish()]);
        }
      }
      if(['positive-heat','negative-heat','heat-overflow'].includes(kind)){
        const heated=device.createCommandEncoder();
        // Manufactured GPU source increment at the retained G2P boundary.
        // This tests source accounting, not spontaneous physical heat yield.
        check(heated,`
@group(0) @binding(0) var<storage,read_write> state:array<f32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 let row=id.x;if(row<arrayLength(&state)/8u && state[row*8u+3u]>0.0){
   state[row*8u+7u]=${kind==='heat-overflow'?'3.402823e38':`state[row*8u+7u]+${kind==='negative-heat'?'-2.0':'2.0'}`};
 }}
`,[g2p.stateBuffer],source.particleCount);device.queue.submit([heated.finish()]);
      }
      const thermalArgs=thermal?{thermalResult:thermal.result,thermalToken:thermal.token,
        thermalMaterialTable:thermalData.table,sphParticleState:binding.sphParticleState}:{};
      transported=await prepareSphReactionResidualTransport({device,g2p,sphParticleUpload:binding.sphParticleUpload,...thermalArgs});
      let forged=false;try{await prepareSphReactionResidualTransport({device,g2p:{...g2p},sphParticleUpload:binding.sphParticleUpload});}catch{forged=true;}
      if(!forged)throw new Error('Copied G2P admitted residual transport');
      if(thermal){
        for(const bad of [{...thermalArgs,thermalResult:{...thermal.result}}, {...thermalArgs,thermalToken:{}}]){
          let refused=false;try{await prepareSphReactionResidualTransport({device,g2p,sphParticleUpload:binding.sphParticleUpload,...bad});}catch{refused=true;}
          if(!refused)throw new Error('Forged thermal producer admitted residual transport');
        }
      }
      const enc=device.createCommandEncoder();transported.encode(enc);
      if(kind==='thermal-thermo-fault')check(enc,`
@group(0) @binding(0) var<storage,read_write> thermo:array<u32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){if(id.x==0u){thermo[2]=0x7fc00000u;}}
`,[transported.record.carrierThermoBuffer],1);
      if(kind==='transport-quantum')check(enc,`
@group(0) @binding(0) var<storage,read_write> history:array<u32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x==0u){history[${H.headerWords+H.energyOffset}u]^=1u;}}
`,[transported.record.buffer],1);
      transported.check(enc);transported.restore(enc);device.queue.submit([enc.finish()]);
      historyControl=make('transported history admission',128);
      forged=false;try{prepareSphReactionResidualHistory({device,source:source.history,transported:{...transported.record},controlBuffer:historyControl});}catch{forged=true;}
      if(!forged)throw new Error('Copied transport admitted history');
      history=prepareSphReactionResidualHistory({device,source:source.history,transported:transported.record,controlBuffer:historyControl});
      if(history.record.beforeBuffer!==source.history.buffer)throw new Error('Transport replaced its rollback source');
      const next=device.createCommandEncoder();history.encode(next);history.check(next);history.restore(next);
      holder=history.transfer();
      check(next,`
${createSphExactMassWgsl(H.format)}
${createSphExactLedgerWgsl(H.format)}
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read> transport:array<u32>;
@group(0) @binding(3) var<storage,read> transport_control:array<u32>;
@group(0) @binding(4) var<storage,read> history_control:array<u32>;
@group(0) @binding(5) var<storage,read_write> receipt:array<atomic<u32>>;
fn fail(){atomicOr(&receipt[0],524288u);}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;let rejected=${rejected || ['transport-quantum','heat-overflow','thermal-ledger-fault','thermal-thermo-fault'].includes(kind)};
 if(row==0u){
   atomicStore(&receipt[20],history_control[2]);atomicStore(&receipt[21],after[3]);
   if((history_control[2]!=0u)!=rejected || transport_control[3]!=select(3u,5u,rejected)
     || after[3]!=before[3] || after[6]!=before[6]+1u){fail();}
 }
 if(row>=${source.historyCapacity}u){return;}
 let base=${H.headerWords}u+row*${H.rowWords}u;
 if(rejected || row>=before[3]){
   for(var w=0u;w<${H.rowWords}u;w++){if(after[base+w]!=before[base+w]){fail();}}
   return;
 }
 for(var w=0u;w<${H.rowWords}u;w++){if(after[base+w]!=transport[base+w]){fail();}}
 var u0=ExactMass();var s0=ExactMass();var u1=ExactMass();var s1=ExactMass();
 for(var w=0u;w<EM_WORDS;w++){
   if(after[base+${H.massOffset}u+w]!=before[base+${H.massOffset}u+w]){fail();}
   u0.words[w]=before[base+${H.energyOffset}u+w];s0.words[w]=before[base+${H.sourceOffset}u+w];
   u1.words[w]=after[base+${H.energyOffset}u+w];s1.words[w]=after[base+${H.sourceOffset}u+w];
 }
 let a=el_subtract(u0,s0);let b=el_subtract(u1,s1);
  if((a.error|b.error)!=0u || (!${Boolean(thermal)} && el_compare(a.value,b.value)!=0)){fail();}
 if(${kind==='positive-heat'||kind==='negative-heat'}){
   let packet=el_from_f32_bits(bitcast<u32>(${kind==='negative-heat'?'-4.0':'4.0'}));
   let expected_u=el_add(u0,packet.value);let expected_s=el_add(s0,packet.value);
   if((packet.error|expected_u.error|expected_s.error)!=0u || el_compare(u1,expected_u.value)!=0 || el_compare(s1,expected_s.value)!=0){fail();}
 }
 if(el_compare(u0,u1)!=0){atomicAdd(&receipt[19],1u);}
  if(${Boolean(thermal)}){
    if(${kind!=='thermal-off'} && el_compare(b.value,a.value)>0){atomicAdd(&receipt[27],1u);}
  }
 var moved=false;for(var axis=0u;axis<3u;axis++){
   moved=moved || after[base+${H.stateOffset}u+axis]!=before[base+${H.stateOffset}u+axis];
 }
 if(moved){atomicAdd(&receipt[18],1u);}
}
`,[source.history.buffer,holder.history.buffer,transported.record.buffer,transported.record.controlBuffer,
        historyControl,receipt],source.historyCapacity);
      if(thermal)checkResidualThermalReceipt({encoder:next,check,source,original,transported:transported.record,
        history:holder.history,thermal,receipt,rejected:rejected||['thermal-ledger-fault','thermal-thermo-fault'].includes(kind)});
      device.queue.submit([next.finish()]);
    }
    if(retain){
      if(!transported || !holder)throw new Error('Retained mechanics requires a complete transport');
      handedOff=true;
      return Object.freeze({transported:transported.record,history:holder.history,historyControl,
        async releaseAfter(after){if(await after!==true)throw new Error('Residual test retirement requires its batch fence');await cleanup();}});
    }
  }finally{
    if(!handedOff){await device.queue.onSubmittedWorkDone();await cleanup();}
  }
}
