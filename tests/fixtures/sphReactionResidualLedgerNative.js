import { compileSphExactReactionLedgerTable, createSphExactReactionLedgerReconcileStage }
  from '../../src/runtime/sph/sphExactReactionLedgerReconcileGpu.js';
import { borrowSphReactionResidualLedger, SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as L }
  from '../../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { createSphExactMassInventoryWebGpu, acquireSphExactMassRead, releaseSphExactMassRead,
  releaseSphExactMassInventory } from '../../src/runtime/sph/sphExactMassInventoryGpu.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format, sphExactThermalEnergyRecordWords }
  from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { encodeSphExactSigned } from '../../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { SPH_GPU_REACTION_HEADER_ROW_LAYOUT as H, SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT as R,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT as P } from '../../ulg-gpu-abi/src/index.js';

export async function runReactionResidualLedgerNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:12}});
  const errors=[],results=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  device.pushErrorScope('validation');
  try {
    for(const kind of ['residual','negative-energy','tiny-mass','fractional','many-pairs','rollback','invalid-energy','count-overflow']) {
      const owned=[];let family=null,source=null,stage=null,committed=null,held=null;
      const allocate=(label,size,usage=128|4|8)=>{
        const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);owned.push(b);return b;
      };
      try {
        const pairs=kind==='many-pairs'?65:1,n=2*pairs,terms=kind==='fractional'?3:1;
        const count=pairs*terms,capacity=count+7,W=format.wordCount;
        const scale=kind==='tiny-mass'?Math.fround(1e-30):1;
        const headers=new Float32Array(H.length),reactants=new Float32Array(2*R.length),products=new Float32Array(terms*P.length);
        headers.set([0,0,2,0,terms]);reactants.set([0,101,1,1]);reactants.set([0,102,1,1],R.length);
        for(let term=0;term<terms;term++) products.set([0,201+term,1,1,1/terms,0,2,1],term*P.length);
        const compiledTable=compileSphExactReactionLedgerTable({reactionHeaders:headers,reactantTermRecords:reactants,productTermRecords:products});
        const state=new Float32Array(n*8),thermo=new Float32Array(n*12),afterState=new Float32Array(n*8),afterThermo=new Float32Array(n*12);
        const coldEnergy=new Uint32Array(sphExactThermalEnergyRecordWords(n));
        for(let row=0;row<n;row++) {
          const u=row%2?20:10;
          state[row*8+3]=Math.fround(2*scale);state[row*8+7]=u;
          thermo[row*12]=101+row%2;thermo[row*12+3]=1000;
          coldEnergy.set(encodeSphExactSigned(Math.fround(state[row*8+3]*u),format),row*W);
          coldEnergy.set(encodeSphExactSigned(Math.fround(scale*(row%2?-2:3)),format),(n+row)*W);
        }
        afterState.set(state);afterThermo.set(thermo);
        for(let row=0;row<n;row++) {
          afterState[row*8+3]=kind==='fractional'?4/3:scale;
          if(kind==='fractional') {afterState[row*8+7]=40;afterThermo[row*12]=201+row%2;}
        }
        if(kind==='rollback') {afterState.set(state);afterThermo.set(thermo);}
        const events=new Float32Array(capacity*32),plans=new Float32Array(capacity*8);
        for(let pair=0;pair<pairs;pair++) for(let term=0;term<terms;term++) {
          const e=pair*terms+term,at=e*32,residual=terms===1||term===2;
          events.set([pair,0,0,terms===1?2*scale:4/3,201+term,term,0,pair*2,pair*2+1,0,0,2,
            residual?0:4/3,residual?(terms===1?2*scale:4/3):0,1,1,300,1000,1,
            kind==='negative-energy'?-40:kind==='invalid-energy'?NaN:40,1,2,3,0,1,0,0,1,1,0,1,residual?6:2],at);
          plans[e*8+4]=residual?6:2;
        }
        const upload=(label,data)=>{const b=allocate(label,data.byteLength);device.queue.writeBuffer(b,0,data);return b;};
        const beforeState=upload('cold donor state',state),beforeThermo=upload('cold donor thermo',thermo);
        const outputState=upload('cold resolved state',afterState),outputThermo=upload('cold resolved thermo',afterThermo);
        const outputMechanics=allocate('cold resolved mechanics',n*128);
        const eventBuffer=upload('cold placement events',events),planBuffer=upload('cold placement plan',plans);
        const counts=upload('cold compact count',new Uint32Array([kind==='count-overflow'?capacity+1:count,0]));
        const receiptWords=new Uint32Array(128);receiptWords[77]=kind==='rollback'?2:1;
        const placementReceipt=upload('cold terminal placement receipt',receiptWords);
        const energy=Object.freeze({energyBuffer:upload('cold extensive energy and sources',coldEnergy),format,rowCount:n});
        family=createSphExactMassInventoryWebGpu({device,format,massesKg:Array(n).fill(Math.fround(2*scale)),
          provenance:{kind:'initial-conditions',reference:'manufactured reaction residual allocation'}});
        source=acquireSphExactMassRead({family,device});
        stage=createSphExactReactionLedgerReconcileStage({device,particleCount:n,compiledTable,massRead:source,energy,
          generation:19,privateLineage:true});
        const encoder=device.createCommandEncoder();
        stage.encode(encoder,{events:eventBuffer,eventPlan:planBuffer,compactCount:counts,receipt:placementReceipt,eventCapacity:capacity,
          rollbackState:beforeState,rollbackThermo:beforeThermo,state:outputState,thermo:outputThermo,mechanics:outputMechanics});
        device.queue.submit([encoder.finish()]);committed=stage.commit();
        const history=committed.residualLedger;
        held=borrowSphReactionResidualLedger(history,{device});
        let cloneRefused=false;try {borrowSphReactionResidualLedger({...history},{device});}catch{cloneRefused=true;}
        if(!cloneRefused) throw new Error('Copied residual producer admitted');
        const receipt=allocate('fixed residual conservation receipt',128),readback=allocate('fixed residual readback',128,1|8);
        const bad=kind==='invalid-energy'||kind==='count-overflow',rolled=kind==='rollback';
        const shader=device.createShaderModule({code:`
${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> before_m:array<u32>;
@group(0) @binding(1) var<storage,read> after_m:array<u32>;
@group(0) @binding(2) var<storage,read> before_e:array<u32>;
@group(0) @binding(3) var<storage,read> after_e:array<u32>;
@group(0) @binding(4) var<storage,read> history:array<u32>;
@group(0) @binding(5) var<storage,read> state:array<u32>;
@group(0) @binding(6) var<storage,read> original_events:array<u32>;
@group(0) @binding(7) var<storage,read_write> receipt:array<u32>;
@compute @workgroup_size(1) fn check() {
  receipt[1]=history[4];receipt[2]=history[5];receipt[3]=after_e[${2*n}u*EM_WORDS];receipt[4]=history[3];
  if(history[0]!=0x52484c31u || history[1]!=1u || history[2]!=${capacity}u || history[7]!=19u){receipt[0]|=1u;}
  if(${bad}) {if(history[5]==0u || (receipt[3]&1024u)==0u){receipt[0]|=2u;}return;}
  if(history[5]!=0u || history[4]!=${rolled?0:pairs}u || history[3]!=${rolled?0:count}u){receipt[0]|=4u;}
  if(${rolled}) {
    for(var w=0u;w<arrayLength(&before_m);w++){if(before_m[w]!=after_m[w]){receipt[0]|=8u;}}
    for(var w=0u;w<arrayLength(&before_e);w++){if(before_e[w]!=after_e[w]){receipt[0]|=16u;}}
  } else if(receipt[3]!=512u) {receipt[0]|=32u;}
  var bm=ExactMass();var am=ExactMass();var be=ExactMass();var ae=ExactMass();
  for(var row=0u;row<${n}u;row++) {
    var m0=ExactMass();var m1=ExactMass();var u0=ExactMass();var u1=ExactMass();var s0=ExactMass();var s1=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {
      m0.words[w]=before_m[row*EM_WORDS+w];m1.words[w]=after_m[row*EM_WORDS+w];
      u0.words[w]=before_e[row*EM_WORDS+w];u1.words[w]=after_e[row*EM_WORDS+w];
      s0.words[w]=before_e[(row+${n}u)*EM_WORDS+w];s1.words[w]=after_e[(row+${n}u)*EM_WORDS+w];
    }
    bm=em_add(bm,m0).value;am=em_add(am,m1).value;
    be=el_add(be,el_subtract(u0,s0).value).value;ae=el_add(ae,el_subtract(u1,s1).value).value;
    if(em_project_f32_bits(m1).bits!=state[row*8u+3u]){receipt[0]|=64u;}
  }
  for(var row=0u;row<${capacity}u;row++) {
    let at=${L.headerWords}u+row*${L.rowWords}u;
    let populated=!${rolled} && row<${count}u && (row%${terms}u)==${terms-1}u;
    if(!populated) {
      for(var w=0u;w<${L.rowWords}u;w++){if(history[at+w]!=0u){receipt[0]|=128u;}}
      continue;
    }
    var m=ExactMass();var u=ExactMass();var s=ExactMass();
    for(var w=0u;w<EM_WORDS;w++) {
      m.words[w]=history[at+${L.massOffset}u+w];u.words[w]=history[at+${L.energyOffset}u+w];s.words[w]=history[at+${L.sourceOffset}u+w];
    }
    am=em_add(am,m).value;ae=el_add(ae,el_subtract(u,s).value).value;
    let projection=em_project_f32_bits(m);
    if(em_zero(m) || projection.error!=0u || projection.bits!=history[at+3u] || history[at+12u]!=0u
      || history[at+13u]!=projection.bits || bitcast<f32>(history[at+31u])!=6.0){receipt[0]|=256u;}
    for(var w=0u;w<32u;w++) {
      if(w!=3u && w!=9u && w!=12u && w!=13u && w!=23u && w!=31u && history[at+w]!=original_events[row*32u+w]){receipt[0]|=512u;}
    }
    if(${kind==='fractional'} && em_compare(m,em_from_f32_bits(projection.bits).value)==0){receipt[0]|=1024u;}
    if(${kind==='negative-energy'} && !el_negative(u)){receipt[0]|=2048u;}
  }
  if(em_compare(bm,am)!=0 || el_compare(be,ae)!=0){receipt[0]|=4096u;}
}`});
        const pipeline=device.createComputePipeline({layout:'auto',compute:{module:shader,entryPoint:'check'}});
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[source.buffer,committed.carrierMassRead.buffer,
          energy.energyBuffer,committed.exactEnergy.energyBuffer,held.buffer,outputState,eventBuffer,receipt]
          .map((buffer,binding)=>({binding,resource:{buffer}}))});
        const check=device.createCommandEncoder(),pass=check.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
        check.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([check.finish()]);
        await readback.mapAsync(1);const words=Array.from(new Uint32Array(readback.getMappedRange()));readback.unmap();
        results.push({kind,words});
        await stage.releaseUnadopted(committed);committed=null;
        held.validate();
        let retiredRefused=false;try{borrowSphReactionResidualLedger(history,{device});}catch{retiredRefused=true;}
        if(!retiredRefused)throw new Error('Retired residual producer admitted');
      } finally {
        await device.queue.onSubmittedWorkDone();held?.release();
        if(committed)await stage.releaseUnadopted(committed);else stage?.abandon();
        if(source)await releaseSphExactMassRead(source);if(family)await releaseSphExactMassInventory(family);
        for(const b of owned)b.destroy();
      }
    }
    const validation=await device.popErrorScope();if(validation)errors.push(validation.message);
    return {results,errors};
  }finally{device.destroy();}
}
