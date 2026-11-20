import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { validateSphReactionResidualHistoryCandidate, SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as L,
  SPH_REACTION_RESIDUAL_HISTORY_ERROR } from './sphReactionResidualHistoryGpu.js';
import { createCachedExplicitComputePipeline, computeBufferBinding } from '../webgpuComputeLayout.js';

// Reduce the original and candidate histories independently of their physical
// row order. The existing closure owns all storage and the history producer.
// A separate reduction keeps the parcel path's storage-binding limit unchanged.
export function prepareSphReactionResidualInventory({device,history,allocate,controlBuffer}) {
  const validate=()=>validateSphReactionResidualHistoryCandidate(history,device);
  validate();
  const passes=[];
  let count=Math.max(history.capacity,history.beforeCapacity),previous=null;
  do {
    const first=previous===null,groups=Math.ceil(count/64);
    if(groups>device.limits.maxComputeWorkgroupsPerDimension) {
      throw new RangeError('Residual inventory reduction exceeds dispatch capacity');
    }
    const output=allocate('ulg-residual-inventory-reduction',groups*L.format.wordCount*16,128);
    const params=allocate('ulg-residual-inventory-identities',48,64|8);
    device.queue.writeBuffer(params,0,new Uint32Array([count,history.beforeCapacity,history.capacity,history.beforeBuffer?1:0,
      history.beforeGeneration,history.beforeSeal,history.generation,history.seal,0,0,0,0]));
    const code=/* wgsl */ `
${createSphExactMassWgsl(L.format)}
${createSphExactLedgerWgsl(L.format)}
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> after:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
@group(0) @binding(3) var<storage,read_write> control:array<atomic<u32>>;
struct Params { shape:vec4<u32>, identity:vec4<u32>, reserved:vec4<u32> };
@group(0) @binding(4) var<uniform> cfg:Params;
var<workgroup> bm:array<ExactMass,64>;
var<workgroup> am:array<ExactMass,64>;
var<workgroup> be:array<ExactMass,64>;
var<workgroup> ae:array<ExactMass,64>;
fn header_valid(after_side:bool)->bool {
  if(after_side) {
    return after[0]==0x50484731u && after[1]==${L.version}u && after[2]==1u && after[3]<=cfg.shape.z
      && after[4]==cfg.shape.z && after[5]==${L.rowWords/4}u && after[6]==cfg.identity.z && after[7]==cfg.identity.w
      && after[8]==(after[3]+63u)/64u && after[9]==1u && after[10]==1u && after[11]==0u;
  }
  return before[0]==0x50484731u && before[1]==${L.version}u && before[2]==1u && before[3]<=cfg.shape.y
    && before[4]==cfg.shape.y && before[5]==${L.rowWords/4}u && before[6]==cfg.identity.x && before[7]==cfg.identity.y
    && before[8]==(before[3]+63u)/64u && before[9]==1u && before[10]==1u && before[11]==0u;
}
@compute @workgroup_size(64) fn reduce(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>) {
  var m0=ExactMass();var m1=ExactMass();var e0=ExactMass();var e1=ExactMass();
  if(${first} && id.x==0u) {
    if(!header_valid(true) || (cfg.shape.w!=0u && !header_valid(false))) {
      atomicOr(&control[2],${SPH_REACTION_RESIDUAL_HISTORY_ERROR}u);
    }
  }
  if(id.x<cfg.shape.x) {
    if(${first}) {
      var s0=ExactMass();var s1=ExactMass();
      let base=${L.headerWords}u+id.x*${L.rowWords}u;
      for(var w=0u;w<EM_WORDS;w++) {
        if(cfg.shape.w!=0u && id.x<min(before[3],cfg.shape.y)) {
          m0.words[w]=before[base+${L.massOffset}u+w];
          e0.words[w]=before[base+${L.energyOffset}u+w];
          s0.words[w]=before[base+${L.sourceOffset}u+w];
        }
        if(id.x<min(after[3],cfg.shape.z)) {
          m1.words[w]=after[base+${L.massOffset}u+w];
          e1.words[w]=after[base+${L.energyOffset}u+w];
          s1.words[w]=after[base+${L.sourceOffset}u+w];
        }
      }
      let a=el_subtract(e0,s0);let b=el_subtract(e1,s1);e0=a.value;e1=b.value;
      if((a.error|b.error)!=0u){atomicOr(&control[2],2048u);}
    } else {
      for(var w=0u;w<EM_WORDS;w++) {
        m0.words[w]=before[id.x*4u*EM_WORDS+w];m1.words[w]=before[(id.x*4u+1u)*EM_WORDS+w];
        e0.words[w]=before[(id.x*4u+2u)*EM_WORDS+w];e1.words[w]=before[(id.x*4u+3u)*EM_WORDS+w];
      }
    }
  }
  bm[lane]=m0;am[lane]=m1;be[lane]=e0;ae[lane]=e1;workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u) {
    if(lane<stride) {
      let a=em_add(bm[lane],bm[lane+stride]);let b=em_add(am[lane],am[lane+stride]);
      let c=el_add(be[lane],be[lane+stride]);let d=el_add(ae[lane],ae[lane+stride]);
      bm[lane]=a.value;am[lane]=b.value;be[lane]=c.value;ae[lane]=d.value;
      if((a.error|b.error)!=0u){atomicOr(&control[2],1024u);}
      if((c.error|d.error)!=0u){atomicOr(&control[2],2048u);}
    }
    workgroupBarrier();
  }
  if(lane==0u) {
    for(var w=0u;w<EM_WORDS;w++) {
      output[group.x*4u*EM_WORDS+w]=bm[0].words[w];output[(group.x*4u+1u)*EM_WORDS+w]=am[0].words[w];
      output[(group.x*4u+2u)*EM_WORDS+w]=be[0].words[w];output[(group.x*4u+3u)*EM_WORDS+w]=ae[0].words[w];
    }
  }
}`;
    const pipeline=createCachedExplicitComputePipeline(device,{code,entryPoint:'reduce',
      cacheKey:`ulg-residual-inventory-v${L.version}-${first}`,label:'ulg-residual-inventory',
      bindings:['read-only-storage','read-only-storage','storage','storage','uniform'].map((type,binding)=>computeBufferBinding(binding,type))});
    const buffers=[first?history.beforeBuffer??history.buffer:previous,first?history.buffer:previous,output,controlBuffer,params];
    const group=device.createBindGroup({layout:pipeline.bindGroupLayout,
      entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
    passes.push({pipeline:pipeline.pipeline,group,groups});previous=output;count=groups;
  }while(count>1);
  return {buffer:previous,encode(encoder){
    validate();
    for(const stage of passes) {
      const pass=encoder.beginComputePass({label:'ulg-residual-inventory'});
      pass.setPipeline(stage.pipeline);pass.setBindGroup(0,stage.group);pass.dispatchWorkgroups(stage.groups);pass.end();
    }
  }};
}
