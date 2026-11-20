import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';

// Independent GPU reduction over real before/after owners. Only 128 bytes
// leave the GPU; neither the exact ledgers nor physical state are mapped.
export async function thermalPotentialIntervalReceipt({ device, format, count, before, after,
  oldUpload, newUpload, baseline, requests, counters, cycle }) {
  if (count !== 2) throw new Error('Interval proof requires the manufactured hot/cold pair');
  const code = `
${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> old_e:array<u32>;
@group(0) @binding(1) var<storage,read> new_e:array<u32>;
@group(0) @binding(2) var<storage,read> old_m:array<u32>;
@group(0) @binding(3) var<storage,read> new_m:array<u32>;
@group(0) @binding(4) var<storage,read> old_s:array<f32>;
@group(0) @binding(5) var<storage,read> new_s:array<f32>;
@group(0) @binding(6) var<storage,read> new_t:array<f32>;
@group(0) @binding(7) var<storage,read> base_s:array<f32>;
@group(0) @binding(8) var<storage,read> base_t:array<f32>;
@group(0) @binding(9) var<storage,read> requests:array<u32>;
@group(0) @binding(10) var<storage,read> counters:array<u32>;
@group(0) @binding(11) var<storage,read_write> proof:array<atomic<u32>>;
@group(0) @binding(12) var<storage,read> old_t:array<f32>;
@group(0) @binding(13) var<storage,read> base_e0:array<u32>;
@group(0) @binding(14) var<storage,read> base_e1:array<u32>;
var<workgroup> deltas:array<ExactMass,64>;
@compute @workgroup_size(64) fn verify(@builtin(local_invocation_index) row:u32){
 var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
 if(row<${count}u){
  var massOK=true;
  for(var w=0u;w<EM_WORDS;w++){
   u0.words[w]=old_e[row*EM_WORDS+w];u1.words[w]=new_e[row*EM_WORDS+w];
   s0.words[w]=old_e[(row+${count}u)*EM_WORDS+w];s1.words[w]=new_e[(row+${count}u)*EM_WORDS+w];
   massOK=massOK&&(old_m[${before.read.byteOffset / 4}u+row*EM_WORDS+w]==new_m[${after.read.byteOffset / 4}u+row*EM_WORDS+w]);
  }
  if(massOK){atomicAdd(&proof[5],1u);}else{atomicOr(&proof[0],1u);}
  let a=el_subtract(u0,s0);let b=el_subtract(u1,s1);
  let transfer=el_subtract(b.value,a.value);
  let cold=old_t[row*12u+2u]<old_t[(1u-row)*12u+2u];
  let direction=el_compare(transfer.value,ExactMass());
  if((cold&&direction>0)||(!cold&&direction<0)){atomicAdd(&proof[16],1u);}else{atomicOr(&proof[0],64u);}
  var bu0=ExactMass();var bu1=ExactMass();var bs0=ExactMass();var bs1=ExactMass();
  for(var w=0u;w<EM_WORDS;w++){
   bu0.words[w]=base_e0[row*EM_WORDS+w];bu1.words[w]=base_e1[row*EM_WORDS+w];
   bs0.words[w]=base_e0[(row+${count}u)*EM_WORDS+w];bs1.words[w]=base_e1[(row+${count}u)*EM_WORDS+w];
  }
  let ba=el_subtract(bu0,bs0);let bb=el_subtract(bu1,bs1);let bt=el_subtract(bb.value,ba.value);
  let difference=el_subtract(transfer.value,bt.value);
  let projected=el_project_f32_bits(difference.value);let referenceTransfer=el_project_f32_bits(bt.value);
  if((transfer.error|ba.error|bb.error|bt.error|difference.error|projected.error|referenceTransfer.error)!=0u){atomicOr(&proof[0],128u);}
  let q=abs(bitcast<f32>(referenceTransfer.bits));let dq=abs(bitcast<f32>(projected.bits));
  // Compare exact exchanged U-S, not two large rounded specific energies.
  // Declared 0.1% transfer budget plus eight relative f32 epsilons.
  if(!(q>0.0)||!(dq<=q*(1e-3+8.0*1.1920929e-7))){atomicOr(&proof[0],128u);}
  atomicMax(&proof[17],bitcast<u32>(dq/q));
  if(el_compare(b.value,a.value)<0){atomicAdd(&proof[2],1u);}
  if(el_compare(b.value,a.value)>0){atomicAdd(&proof[3],1u);}
  if(el_compare(s0,s1)!=0){atomicAdd(&proof[8],1u);}
  let oldU=old_s[row*8u+7u];let newU=new_s[row*8u+7u];let reference=base_s[row*8u+7u];
  if(oldU!=newU){atomicAdd(&proof[6],1u);}
  let err=abs(newU-reference)/max(1.0,abs(reference));atomicMax(&proof[7],bitcast<u32>(err));
  let t=new_t[row*12u+2u];let tref=base_t[row*12u+2u];
  if(!(err<=1e-5)||!(abs(t-tref)<=1e-4*abs(tref))){atomicOr(&proof[0],16u);}
  if(t>0.0&&t<=3.402823e38){atomicAdd(&proof[14],1u);}else{atomicOr(&proof[0],32u);}
  if(new_t[row*12u+1u]==2.0&&new_t[row*12u+5u]==1.0){atomicAdd(&proof[15],1u);}else{atomicOr(&proof[0],8u);}
  atomicAdd(&proof[1],1u);
 }
 let a=el_subtract(u0,s0);let b=el_subtract(u1,s1);let delta=el_subtract(b.value,a.value);
 if((a.error|b.error|delta.error)!=0u){atomicOr(&proof[0],2u);}deltas[row]=delta.value;
 workgroupBarrier();
 for(var stride=32u;stride>0u;stride/=2u){
  if(row<stride){let sum=el_add(deltas[row],deltas[row+stride]);if(sum.error!=0u){atomicOr(&proof[0],2u);}deltas[row]=sum.value;}
  workgroupBarrier();
 }
 if(row==0u){
  if(em_zero(deltas[0])){atomicStore(&proof[4],1u);}else{atomicOr(&proof[0],2u);}
  let control=${count * 2}u*EM_WORDS;
  atomicStore(&proof[9],new_e[control+3u]);
  if(new_e[control]!=0u||(new_e[control+1u]&~2u)!=0u||new_e[control+2u]!=0u||new_e[control+3u]!=${count * cycle}u){atomicOr(&proof[0],4u);}
  for(var i=0u;i<3u;i++){atomicStore(&proof[10u+i],requests[i]-counters[i]);}
 }
}`;
  const module = device.createShaderModule({ code });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length) throw new Error(JSON.stringify(errors.map(message => message.message)));
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'verify' } });
  const proof = device.createBuffer({ size: 128, usage: 128 | 4 | 8 });
  const read = device.createBuffer({ size: 128, usage: 1 | 8 });
  try {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();pass.setPipeline(pipeline);
    pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
      [before.energy.energyBuffer, after.energy.energyBuffer, before.read.buffer, after.read.buffer,
        oldUpload.stateBuffer, newUpload.stateBuffer, newUpload.thermoBuffer,
        baseline?.stateBuffer ?? newUpload.stateBuffer, baseline?.thermoBuffer ?? newUpload.thermoBuffer,
        requests, counters, proof, oldUpload.thermoBuffer,
        baseline?.beforeEnergy ?? before.energy.energyBuffer,
        baseline?.afterEnergy ?? after.energy.energyBuffer]
        .map((buffer, binding) => ({ binding, resource: { buffer } })) }));
    pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(proof, 0, read, 0, 128);
    device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
    return Array.from(new Uint32Array(read.getMappedRange()));
  } finally { read.destroy();proof.destroy(); }
}

// Fitting/adoption may replace derived closure buffers, never physical rows.
export async function thermalPotentialAdoptionReceipt(device, snapshot, upload, energy) {
  const pairs = [[snapshot.stateBuffer, upload.stateBuffer], [snapshot.thermoBuffer, upload.thermoBuffer],
    [snapshot.afterEnergy, energy.energyBuffer]];
  const proof = device.createBuffer({ size: 16, usage: 128 | 4 | 8 });
  const read = device.createBuffer({ size: 16, usage: 1 | 8 });
  try {
    const encoder = device.createCommandEncoder();
    for (const [index, [before, after]] of pairs.entries()) {
      if (before.size !== after.size) throw new Error('Adoption changed physical buffer size');
      const module = device.createShaderModule({ code: `
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read_write> proof:array<atomic<u32>>;
@compute @workgroup_size(64) fn verify(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x<${before.size / 4}u){
  if(before[id.x]!=after[id.x]){atomicOr(&proof[0],${1 << index}u);}atomicAdd(&proof[1],1u);
 }
}` });
      const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'verify' } });
      const pass = encoder.beginComputePass();pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
        [before, after, proof].map((buffer, binding) => ({ binding, resource: { buffer } })) }));
      pass.dispatchWorkgroups(Math.ceil(before.size / 256));pass.end();
    }
    encoder.copyBufferToBuffer(proof, 0, read, 0, 16);device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);return Array.from(new Uint32Array(read.getMappedRange()));
  } finally { read.destroy();proof.destroy(); }
}
