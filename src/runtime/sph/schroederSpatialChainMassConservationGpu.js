import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format } from './sphExactThermalEnergyWgsl.js';
import { createCachedExplicitComputePipeline, computeBufferBinding } from '../webgpuComputeLayout.js';
import { prepareSphReactionResidualInventory } from './sphReactionResidualInventoryGpu.js';

// Reactions and refinement redistribute carrier mass between lineages. Compare the complete
// original/candidate inventories and sum(U-S), independently of that routing.
// Each pass reduces 64 rows; no particle-sized readback or host synchronization.
// All allocations belong to the calling closure and follow its retirement.
export function prepareSchroederChainInventoryCheck({ device, allocate, controlBuffer,
  originalMassRead, candidateMassRead, originalEnergy, candidateEnergy, reactionValidationBuffer = null,
  originalParcels = null, candidateParcels = null, residualHistory = null }) {
  const rowCount = candidateMassRead.rowCount;
  const passes = [];
  const parcelCount = candidateParcels?.count ?? 0;
  const history=residualHistory?prepareSphReactionResidualInventory({device,history:residualHistory,allocate,controlBuffer}):null;
  let count = rowCount + (parcelCount ? parcelCount + 1 : 0), previous = null;
  do {
    const first = previous === null;
    const groups = Math.ceil(count / 64);
    if (groups > device.limits.maxComputeWorkgroupsPerDimension) {
      throw new RangeError('Chain inventory reduction exceeds dispatch capacity');
    }
    const output = allocate('ulg-chain-inventory-reduction', groups * format.wordCount * 16, 128);
    const params = allocate('ulg-chain-inventory-params', 32, 64 | 8);
    device.queue.writeBuffer(params, 0, new Uint32Array([count, rowCount,
      originalMassRead.byteOffset / 4, candidateMassRead.byteOffset / 4, parcelCount, 0, 0, 0]));
    const code = /* wgsl */ `
${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> before_mass:array<u32>;
@group(0) @binding(1) var<storage,read> after_mass:array<u32>;
@group(0) @binding(2) var<storage,read> before_energy:array<u32>;
@group(0) @binding(3) var<storage,read> after_energy:array<u32>;
@group(0) @binding(4) var<storage,read_write> out:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
struct Params { counts:vec4<u32>, parcels:vec4<u32> };
@group(0) @binding(6) var<uniform> params:Params;
${parcelCount ? `@group(0) @binding(8) var<storage,read> before_parcels:array<u32>;
@group(0) @binding(9) var<storage,read> after_parcels:array<u32>;
@group(0) @binding(10) var<storage,read> before_sinks:array<u32>;
@group(0) @binding(11) var<storage,read> after_sinks:array<u32>;
` : ''}
@group(0) @binding(7) var<storage,read> reaction:array<u32>;
var<workgroup> bm:array<ExactMass,64>;
var<workgroup> am:array<ExactMass,64>;
var<workgroup> be:array<ExactMass,64>;
var<workgroup> ae:array<ExactMass,64>;
@compute @workgroup_size(64) fn reduce(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32, @builtin(workgroup_id) group:vec3<u32>) {
  let cfg=params.counts;
  var m0=ExactMass(); var m1=ExactMass(); var e0=ExactMass(); var e1=ExactMass();
  if(id.x<cfg.x) {
    if(${first}) {
      if(id.x<cfg.y) {
      var s0=ExactMass(); var s1=ExactMass();
      for(var w=0u;w<EM_WORDS;w++) {
        m0.words[w]=before_mass[cfg.z+id.x*EM_WORDS+w];
        m1.words[w]=after_mass[cfg.w+id.x*EM_WORDS+w];
        e0.words[w]=before_energy[id.x*EM_WORDS+w];
        e1.words[w]=after_energy[id.x*EM_WORDS+w];
        s0.words[w]=before_energy[(id.x+cfg.y)*EM_WORDS+w];
        s1.words[w]=after_energy[(id.x+cfg.y)*EM_WORDS+w];
      }
      let a=el_subtract(e0,s0);let b=el_subtract(e1,s1);
      e0=a.value;e1=b.value;
      if((a.error|b.error)!=0u) {atomicOr(&control[2],2048u);}
      } ${parcelCount ? `else {
        let p=id.x-cfg.y;var d0=ExactMass();var d1=ExactMass();
        for(var w=0u;w<EM_WORDS;w++) {
          if(p<params.parcels.x) {
            m0.words[w]=before_parcels[p*3u*EM_WORDS+w];
            m1.words[w]=after_parcels[p*3u*EM_WORDS+w];
            d0.words[w]=before_parcels[(p*3u+1u)*EM_WORDS+w];
            d1.words[w]=after_parcels[(p*3u+1u)*EM_WORDS+w];
            e0.words[w]=before_parcels[(p*3u+2u)*EM_WORDS+w];
            e1.words[w]=after_parcels[(p*3u+2u)*EM_WORDS+w];
          } else {
            m0.words[w]=before_sinks[w];m1.words[w]=after_sinks[w];
            d0.words[w]=before_sinks[2u*EM_WORDS+w];d1.words[w]=after_sinks[2u*EM_WORDS+w];
            e0.words[w]=before_sinks[EM_WORDS+w];e1.words[w]=after_sinks[EM_WORDS+w];
          }
        }
        let a=em_add(m0,d0);let b=em_add(m1,d1);m0=a.value;m1=b.value;
        if((a.error|b.error)!=0u) {atomicOr(&control[2],1024u);}
      }
` : ''}
    } else {
      for(var w=0u;w<EM_WORDS;w++) {
        m0.words[w]=before_mass[id.x*4u*EM_WORDS+w];
        m1.words[w]=before_mass[(id.x*4u+1u)*EM_WORDS+w];
        e0.words[w]=before_mass[(id.x*4u+2u)*EM_WORDS+w];
        e1.words[w]=before_mass[(id.x*4u+3u)*EM_WORDS+w];
      }
    }
  }
  bm[lane]=m0;am[lane]=m1;be[lane]=e0;ae[lane]=e1;
  workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u) {
    if(lane<stride) {
      let a=em_add(bm[lane],bm[lane+stride]);let b=em_add(am[lane],am[lane+stride]);
      let c=el_add(be[lane],be[lane+stride]);let d=el_add(ae[lane],ae[lane+stride]);
      bm[lane]=a.value;am[lane]=b.value;be[lane]=c.value;ae[lane]=d.value;
      if((a.error|b.error)!=0u) {atomicOr(&control[2],1024u);}
      if((c.error|d.error)!=0u) {atomicOr(&control[2],2048u);}
    }
    workgroupBarrier();
  }
  if(lane==0u) {
    for(var w=0u;w<EM_WORDS;w++) {
      out[group.x*4u*EM_WORDS+w]=bm[0].words[w];
      out[(group.x*4u+1u)*EM_WORDS+w]=am[0].words[w];
      out[(group.x*4u+2u)*EM_WORDS+w]=be[0].words[w];
      out[(group.x*4u+3u)*EM_WORDS+w]=ae[0].words[w];
    }
    if(cfg.x<=64u) {
      if(${Boolean(reactionValidationBuffer)}) {
      atomicStore(&control[17],reaction[2]);atomicStore(&control[18],reaction[3]);
      for(var w=4u;w<8u;w++) {atomicStore(&control[15u+w],reaction[w]);}
      if(reaction[0]!=0x524c4731u || reaction[1]!=1u || reaction[2]!=1u) {atomicOr(&control[2],4096u);}
      }
      if(${!history}) {
        if(em_compare(bm[0],am[0])!=0) {atomicOr(&control[2],1024u);}
        if(el_compare(be[0],ae[0])!=0) {atomicOr(&control[2],2048u);}
      }
    }
  }
}`;
    const pipeline = createCachedExplicitComputePipeline(device, { code, entryPoint:'reduce',
      cacheKey:`ulg-chain-inventory-v4-history-${first}-${Boolean(reactionValidationBuffer)}-${Boolean(parcelCount)}-${Boolean(history)}`, label:'ulg-chain-inventory',
      bindings:['read-only-storage','read-only-storage','read-only-storage','read-only-storage',
        'storage','storage','uniform','read-only-storage',
        ...(parcelCount ? Array(4).fill('read-only-storage') : [])].map((type,binding)=>computeBufferBinding(binding,type)) });
    const buffers = [first ? originalMassRead.buffer : previous, first ? candidateMassRead.buffer : previous,
      first ? originalEnergy.energyBuffer : previous, first ? candidateEnergy.energyBuffer : previous,
      output,controlBuffer,params,reactionValidationBuffer ?? candidateMassRead.buffer,
      ...(parcelCount ? [originalParcels.ledgerBuffer,candidateParcels.ledgerBuffer,
        originalParcels.sinkBuffer,candidateParcels.sinkBuffer] : [])];
    const bindGroup = device.createBindGroup({layout:pipeline.bindGroupLayout,
      entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
    passes.push({ pipeline:pipeline.pipeline, bindGroup, groups });
    previous=output;count=groups;
  } while(count>1);
  if(history) {
    const code=/* wgsl */ `
${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> particles:array<u32>;
@group(0) @binding(1) var<storage,read> history:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn compare() {
  var totals:array<ExactMass,4>;
  for(var row=0u;row<4u;row++) {
    var a=ExactMass();var b=ExactMass();
    for(var w=0u;w<EM_WORDS;w++){a.words[w]=particles[row*EM_WORDS+w];b.words[w]=history[row*EM_WORDS+w];}
    if(row<2u) {let sum=em_add(a,b);totals[row]=sum.value;if(sum.error!=0u){atomicOr(&control[2],1024u);}}
    else {let sum=el_add(a,b);totals[row]=sum.value;if(sum.error!=0u){atomicOr(&control[2],2048u);}}
  }
  if(em_compare(totals[0],totals[1])!=0){atomicOr(&control[2],1024u);}
  if(el_compare(totals[2],totals[3])!=0){atomicOr(&control[2],2048u);}
}`;
    const pipeline=createCachedExplicitComputePipeline(device,{code,entryPoint:'compare',
      cacheKey:'ulg-chain-inventory-history-compare-v1',label:'ulg-chain-complete-inventory',
      bindings:['read-only-storage','read-only-storage','storage'].map((type,binding)=>computeBufferBinding(binding,type))});
    const bindGroup=device.createBindGroup({layout:pipeline.bindGroupLayout,
      entries:[previous,history.buffer,controlBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
    passes.push({pipeline:pipeline.pipeline,bindGroup,groups:1});
  }
  return encoder => {
    history?.encode(encoder);
    for(const stage of passes) {
      const pass=encoder.beginComputePass({label:'ulg-chain-inventory'});
      pass.setPipeline(stage.pipeline);pass.setBindGroup(0,stage.bindGroup);
      pass.dispatchWorkgroups(stage.groups);pass.end();
    }
  };
}
