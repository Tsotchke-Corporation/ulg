import { prepareSphExactFiniteWallCandidate, validateSphExactFiniteWallRecord } from '../../src/runtime/sph/sphExactFiniteWallGpu.js';
import { sphFiniteWallStateFor } from '../../src/runtime/sph/sphFiniteWallStateGpu.js';
import { SPH_THERMAL_WALL_FACE_IDS, SPH_THERMAL_WALL_MODEL_FINITE,
  resolveSphWallReservoirAuthority } from '../../src/runtime/thermalEnvironmentAuthority.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';

const math=`${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}\n${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}`;
function authority() {
  return resolveSphWallReservoirAuthority({wallModel:SPH_THERMAL_WALL_MODEL_FINITE,
    wallTemperaturesK:Object.fromEntries(SPH_THERMAL_WALL_FACE_IDS.map(f=>[f,300])),
    wallFaceHeatCapacitiesJPerK:Object.fromEntries(SPH_THERMAL_WALL_FACE_IDS.map(f=>[f,100]))});
}
export async function runExactFiniteWallReductionNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:13}});
  const errors=[],results=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  const emit=(encoder,code,buffers,x=1)=>{
    const pipeline=device.createComputePipeline({layout:'auto',compute:{module:device.createShaderModule({code}),entryPoint:'main'}});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
    const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(x);pass.end();
  };
  try {
    for(const kind of ['signed','sub-microjoule','overflow']) {
      const state=sphFiniteWallStateFor(device,authority());
      const stage=prepareSphExactFiniteWallCandidate({device,state,particleCount:4097});
      const receipt=device.createBuffer({size:128,usage:128|4|8});
      const readback=device.createBuffer({size:128,usage:1|8});
      try {
        const encoder=device.createCommandEncoder();stage.encodeBefore(encoder);
        emit(encoder,`${math}
@group(0) @binding(0) var<storage,read_write> packets:array<u32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x>=4097u) {return;}
  for(var face=0u;face<6u;face++) {
    let magnitude=f32(face+1u)*${kind==='sub-microjoule'?'0.0000000009313225746154785':'0.125'};
    var packet=el_from_f32_bits(bitcast<u32>(select(magnitude,-magnitude,(id.x&1u)==1u))).value;
    if(${kind==='overflow'}) {
      packet=ExactMass();
      if(id.x<2u) {for(var w=0u;w<EM_WORDS;w++){packet.words[w]=select(0xffffffffu,0x7fffffffu,w==EM_WORDS-1u);}}
    }
    for(var w=0u;w<EM_WORDS;w++) {packets[(id.x*6u+face)*EM_WORDS+w]=packet.words[w];}
  }
}`, [stage.packets], Math.ceil(4097/64));
        stage.encodeAfter(encoder);
        emit(encoder,`${math}
@group(0) @binding(0) var<storage,read> wall:array<u32>;
@group(0) @binding(1) var<storage,read> delta:array<u32>;
@group(0) @binding(2) var<storage,read> validation:array<u32>;
@group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
@compute @workgroup_size(1) fn main() {
  receipt[1]=validation[2];
  if(${kind==='overflow'}) {if((validation[2]&2u)==0u){receipt[0]|=1u;}return;}
  if(validation[2]!=0u || validation[4]!=1u) {receipt[0]|=2u;}
  for(var face=0u;face<6u;face++) {
    let magnitude=f32(face+1u)*${kind==='sub-microjoule'?'0.0000000009313225746154785':'0.125'};
    let expected=el_from_f32_bits(bitcast<u32>(magnitude));
    for(var w=0u;w<EM_WORDS;w++) {
      if(wall[64u+face*EM_WORDS+w]!=expected.value.words[w] || delta[face*EM_WORDS+w]!=expected.value.words[w]) {receipt[0]|=4u;}
    }
    if(wall[face]!=bitcast<u32>(300.0+magnitude/100.0)) {receipt[0]|=8u;}
  }
}`, [stage.record.buffer,stage.record.deltaBuffer,stage.record.validationBuffer,receipt]);
        encoder.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);const words=Array.from(new Uint32Array(readback.getMappedRange()));readback.unmap();
        results.push({kind,words,dispatches:stage.encodedDispatchCount});
      } finally {await device.queue.onSubmittedWorkDone();stage.destroy();receipt.destroy();readback.destroy();}
      let retired=false;try{validateSphExactFiniteWallRecord(stage.record,device);}catch{retired=true;}
      if(!retired) throw new Error('Retired wall read still validates');
    }
    const held=[],authorities=[];
    try {
      for(let i=0;i<4;i++) {
        const a=authority();authorities.push(a);
        const state=sphFiniteWallStateFor(device,a);held.push(prepareSphExactFiniteWallCandidate({device,state,particleCount:1}));
      }
      let refused=false;try{sphFiniteWallStateFor(device,authority());}catch{refused=true;}
      if(!refused) throw new Error('Cache evicted a live wall owner');
      if(sphFiniteWallStateFor(device,authorities[0]).buffer!==held[0].record.originalBuffer) throw new Error('Cache duplicated a retained wall owner');
    } finally {await device.queue.onSubmittedWorkDone();for(const s of held)s.destroy();}
    await device.queue.onSubmittedWorkDone();
    return {results,errors};
  } finally {device.destroy();}
}
