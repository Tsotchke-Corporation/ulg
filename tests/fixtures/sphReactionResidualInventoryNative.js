import { prepareSchroederChainInventoryCheck } from '../../src/runtime/sph/schroederSpatialChainMassConservationGpu.js';
import { createSphReactionResidualLedger, SPH_REACTION_LEDGER_PACKET_WORDS as PACKET,
  SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as E } from '../../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { prepareSphReactionResidualHistory, SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H }
  from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { encodeSphExactMass, encodeSphExactMassUnits } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { encodeSphExactSigned } from '../../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { sphExactThermalEnergyRecordWords } from '../../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

// All physical/quantity inputs are cold declarations. Actual residual producers
// and histories run on the GPU; only the fixed 128-byte verdict is mapped.
export async function runReactionResidualInventoryNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:11}});
  const errors=[],results=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  device.pushErrorScope('validation');
  const cases=['new-history','append','carry','empty','negative-energy','parcels','large',
    'mass','energy','source','parcel-mass','sink-energy','count','seal','stride',
    'mass-overflow','energy-overflow','join-mass-overflow','join-energy-overflow'];
  try {
    for(const kind of cases) {
      const owned=[],emissions=[],producers=[],holders=[];
      const allocate=(label,size,usage)=>{const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);owned.push(b);return b;};
      const upload=(label,data)=>{const b=allocate(label,data.byteLength,128|4|8);device.queue.writeBuffer(b,0,data);return b;};
      const mass=x=>encodeSphExactMass(x,E.format),energy=x=>encodeSphExactSigned(x,E.format),W=E.format.wordCount;
      try {
        const joined=kind.startsWith('join-'),carry=kind==='carry'||joined;
        const firstCount=['new-history','empty'].includes(kind)?0:kind==='large'?4097:joined?1:3;
        const addedCount=carry||kind==='empty'?0:kind==='large'?4097:2;
        const capacity=kind==='large'?8208:16,carrierCount=kind==='large'?4097:1;
        const withParcels=['parcels','large','parcel-mass','sink-energy'].includes(kind),parcelCount=withParcels?carrierCount:0;
        const sign=kind==='negative-energy'?-1:1;
        const makeEmission=(count,generation)=>{
          const slots=count*2+3,scratch=new Uint32Array(8+2+slots*PACKET),events=new Float32Array(slots*32),plans=new Float32Array(slots*8);
          scratch[1]=1;scratch[2]=slots;
          for(let row=0;row<count;row++) {
            const e=2*row+1,at=8+2+e*PACKET,m=mass(2);m[0]=row+1;
            scratch[at]=1;scratch.set(m,at+1);scratch.set(energy(sign*(30+row)),at+1+W);
            events.set([generation*10000+row,0,0,2,201,0,0,0,1,2,0,2,0,2,1,1,300,1000,1,
              row%2?-40:40,1,2,3,0,1,0,0,1,1,0,1,6],e*32);plans[e*8+4]=6;
          }
          const producer=createSphReactionResidualLedger({device,capacity:slots,generation});emissions.push(producer);
          const encoder=device.createCommandEncoder();producer.encode(encoder,{particleCount:2,
            scratch:upload('cold residual packets',scratch),events:upload('cold events',events),
            eventPlan:upload('cold plans',plans),energyOutput:allocate('cold energy',(4*W+4)*4,128|4|8)});
          device.queue.submit([encoder.finish()]);return producer.commit();
        };
        let before=null;
        if(kind!=='new-history') {
          const first=prepareSphReactionResidualHistory({device,emitted:makeEmission(firstCount,1),capacity,
            controlBuffer:allocate('first history control',128,128|4|8)});producers.push(first);
          const encoder=device.createCommandEncoder();first.encode(encoder);first.check(encoder);first.restore(encoder);
          device.queue.submit([encoder.finish()]);before=first.transfer();holders.push(before);
        }
        const control=allocate('complete inventory verdict',128,128|4|8),readback=allocate('fixed inventory readback',128,1|8);
        const next=prepareSphReactionResidualHistory({device,source:before?.history??null,
          emitted:carry?null:makeEmission(addedCount,2),capacity,controlBuffer:control});producers.push(next);
        const bm=new Uint32Array((carrierCount+1)*W),am=new Uint32Array((carrierCount+3)*W);
        const be=new Uint32Array(sphExactThermalEnergyRecordWords(carrierCount)),ae=new Uint32Array(be.length);
        for(let row=0;row<carrierCount;row++) {
          const m=mass(4+(row===0?2*addedCount+(withParcels?7:0):0));
          if(row===0)m[0]=addedCount*(addedCount+1)/2;
          bm.set(m,(row+1)*W);am.set(mass(4),(row+3)*W);
          be.set(energy(100+(row===0?sign*(30*addedCount+addedCount*(addedCount-1)/2)+(withParcels?5:0):0)),row*W);
          ae.set(energy(100),row*W);
        }
        let originalParcels=null,candidateParcels=null;
        if(withParcels) {
          const bp=new Uint32Array(parcelCount*3*W),ap=new Uint32Array(bp.length),bs=new Uint32Array(3*W),as=new Uint32Array(3*W);
          for(let row=0;row<parcelCount;row++) {
            bp.set(mass(2),row*3*W);bp.set(mass(1),(row*3+1)*W);bp.set(energy(-3),(row*3+2)*W);
          }
          ap.set(bp);ap.set(mass(4),W);ap.set(energy(-1),2*W);as.set(mass(4),0);as.set(energy(3),W);
          if(kind==='parcel-mass')ap[0]++;
          if(kind==='sink-energy')as[W]++;
          originalParcels={count:parcelCount,ledgerBuffer:upload('old parcels',bp),sinkBuffer:upload('old sinks',bs)};
          candidateParcels={count:parcelCount,ledgerBuffer:upload('new parcels',ap),sinkBuffer:upload('new sinks',as)};
        }
        const check=prepareSchroederChainInventoryCheck({device,allocate,controlBuffer:control,residualHistory:next.record,
          originalMassRead:{rowCount:carrierCount,buffer:upload('old carrier mass',bm),byteOffset:W*4},
          candidateMassRead:{rowCount:carrierCount,buffer:upload('new carrier mass',am),byteOffset:W*12},
          originalEnergy:{energyBuffer:upload('old carrier energy',be)},candidateEnergy:{energyBuffer:upload('new carrier energy',ae)},
          originalParcels,candidateParcels});
        const encoder=device.createCommandEncoder();next.encode(encoder);
        const one=upload('cold one-quantum fault',new Uint32Array([1]));
        const at=(H.headerWords+(firstCount+addedCount-1)*H.rowWords)*4;
        if(['mass','energy','source'].includes(kind))encoder.copyBufferToBuffer(one,0,next.record.buffer,
          at+H[{mass:'massOffset',energy:'energyOffset',source:'sourceOffset'}[kind]]*4,4);
        if(kind==='count')encoder.copyBufferToBuffer(upload('bad count',new Uint32Array([capacity+1])),0,next.record.buffer,12,4);
        if(kind==='seal'||kind==='stride')encoder.copyBufferToBuffer(one,0,next.record.buffer,kind==='seal'?28:20,4);
        if(kind.endsWith('mass-overflow')) {
          const max=upload('cold maximum mass',encodeSphExactMassUnits((1n<<BigInt(W*32))-1n,E.format));
          encoder.copyBufferToBuffer(max,0,next.record.buffer,at+H.massOffset*4,W*4);
        }
        if(kind.endsWith('energy-overflow')) {
          const max=upload('cold maximum energy',encodeSphExactMassUnits((1n<<BigInt(W*32-1))-1n,E.format));
          encoder.copyBufferToBuffer(max,0,next.record.buffer,at+H.energyOffset*4,W*4);
          encoder.clearBuffer(next.record.buffer,at+H.sourceOffset*4,W*4);
        }
        check(encoder);
        // History and physical inventories share one final decision. Rejection
        // must restore populated history, not merely set a diagnostic flag.
        next.restore(encoder);
        const module=device.createShaderModule({code:`
@group(0) @binding(0) var<storage,read> history:array<u32>;
@group(0) @binding(1) var<storage,read> before:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>){
  let rejected=atomicLoad(&control[2])!=0u;
  if(id.x==0u) {
    atomicStore(&control[25],history[3]);
    if(history[3]!=select(${firstCount+addedCount}u,${firstCount}u,rejected)){atomicOr(&control[24],1u);}
  }
  if(rejected && id.x<${capacity}u) {
    for(var w=0u;w<${H.rowWords}u;w++) {
      let at=${H.headerWords}u+id.x*${H.rowWords}u+w;
      var wanted=0u;if(id.x<${firstCount}u){wanted=before[at];}
      if(history[at]!=wanted){atomicOr(&control[24],2u);}
    }
  }
}`});
        const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'check'}});
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[next.record.buffer,before?.history.buffer??next.record.buffer,control]
          .map((buffer,binding)=>({binding,resource:{buffer}}))});
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(capacity/64));pass.end();
        encoder.copyBufferToBuffer(control,0,readback,0,128);device.queue.submit([encoder.finish()]);await readback.mapAsync(1);
        results.push({kind,words:Array.from(new Uint32Array(readback.getMappedRange()))});readback.unmap();
      }finally {
        await device.queue.onSubmittedWorkDone();
        for(const p of producers.reverse())p.destroy();for(const h of holders.reverse())h.destroy();
        for(const e of emissions)e.destroy();for(const b of owned)b.destroy();
      }
    }
    const error=await device.popErrorScope();if(error)errors.push(error.message);return{results,errors};
  }finally{device.destroy();}
}
