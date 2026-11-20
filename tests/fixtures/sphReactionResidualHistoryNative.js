import { createSphReactionResidualLedger, SPH_REACTION_LEDGER_PACKET_WORDS as PACKET,
  SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as E } from '../../src/runtime/sph/sphReactionResidualLedgerGpu.js';
import { prepareSphReactionResidualHistory, borrowSphReactionResidualHistory,
  SPH_REACTION_RESIDUAL_HISTORY_LAYOUT as H } from '../../src/runtime/sph/sphReactionResidualHistoryGpu.js';
import { encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { encodeSphExactSigned } from '../../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

export async function runReactionResidualHistoryNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(),errors=[],results=[];
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.pushErrorScope('validation');
  try {
    for(const kind of ['append','empty-first','empty-emission','no-emission','rejected-emission','overflow',
      'bad-emission-count','bad-source-seal','late-quantity','late-count','late-count-shrink','late-count-grow',
      'downstream-rejection','mechanics-gate','large','solid','gas','plasma','material-zero','deformed-carry',
      'late-position','late-velocity','late-deformation','late-apic','late-thermo','late-volume',
      'bad-physical-position','bad-physical-velocity','bad-physical-temperature','bad-physical-phase',
      'bad-physical-ready','bad-physical-mechanics','bad-physical-entities','bad-physical-volume','old-version',
      'deformed-rejection','bad-source-deformation','late-appended-deformation']) {
      const owned=[],emissions=[],producers=[],holders=[],reads=[];
      const allocate=(label,size,usage=128|4|8)=>{
        const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);owned.push(b);return b;
      };
      const upload=(label,data)=>{const b=allocate(label,data.byteLength);device.queue.writeBuffer(b,0,data);return b;};
      try {
        const W=E.format.wordCount,firstCount=kind==='empty-first'?0:kind==='large'?4097:3;
        const sourceOnly=['no-emission','late-count-shrink','late-count-grow','deformed-carry'].includes(kind);
        const addedCount=sourceOnly || ['empty-emission','rejected-emission'].includes(kind)?0:2;
        const capacity=kind==='overflow'?4:kind==='large'?4112:16;
        const phase={solid:1,gas:3,plasma:4}[kind]??2,material=kind==='material-zero'?0:201;
        const physical=(row,generation)=>{
          // Manufactured cold initial state, independent of the history shader.
          const p=new Float32Array(52);
          p.set([generation*10000+row,0,0,2,1,2,3,row%2?-40:40,material,phase,300,1000]);
          p[11+phase]=1;p[16]=p[19]=Math.cbrt(0.002*3/(4*Math.PI));p[17]=2*6.02214076e23;p[18]=1;
          p[20]=p[24]=p[28]=p[38]=1;p[39]=0.002;p[40]=phase===1?1:0;
          p[41]=p[42]=p[45]=p[47]=1;p[46]=phase>=3?2:1;p[51]=2;
          if(kind==='deformed-carry' || kind==='deformed-rejection') {
            p[0]+=0.5;p[4]=-3;p[20]=1.25;p[21]=0.125;p[24]=1.5;p[28]=0.8;
            p[29]=0.25;p[34]=-0.125;p[37]=0.5;p[38]=1.5;
          }
          return p;
        };
        const expectedPhysical=new Float32Array((firstCount+addedCount)*52);
        for(let row=0;row<firstCount+addedCount;row++)expectedPhysical.set(
          physical(row<firstCount?row:row-firstCount,row<firstCount?10:20),row*52);
        const physicalReference=upload('cold expected physical states',expectedPhysical);
        const makeEmission=(count,generation,rejected=false)=>{
          const slots=count*2+3,scratch=new Uint32Array(8+2+slots*PACKET),events=new Float32Array(slots*32),plans=new Float32Array(slots*8);
          scratch[1]=rejected?2:1;scratch[2]=slots;
          for(let row=0;row<count;row++) {
            const e=row*2+1,at=8+2+e*PACKET,
              m=encodeSphExactMass(kind==='bad-physical-volume' && generation===20?1e-20:2,E.format);m[0]=row+1;
            scratch[at]=1;scratch.set(m,at+1);scratch.set(encodeSphExactSigned(30+row,E.format),at+1+W);
            events.set([generation*10000+row,0,0,2,material,0,0,0,1,2,0,phase,0,2,1,1,300,1000,1,
              row%2?-40:40,1,2,3,0,1,0,0,1,phase>=3?2:1,phase===1?1:0,1,6],e*32);plans[e*8+4]=6;
            if(generation===20) {
              const bad={
                'bad-physical-position':[0,NaN],'bad-physical-velocity':[20,Infinity],
                'bad-physical-temperature':[16,0],'bad-physical-phase':[11,0],
                'bad-physical-ready':[18,0],'bad-physical-mechanics':[30,0],
                'bad-physical-entities':[15,1e-30],'bad-physical-volume':[17,3e38]
              }[kind];
              if(bad)events[e*32+bad[0]]=bad[1];
            }
          }
          const producer=createSphReactionResidualLedger({device,capacity:slots,generation});emissions.push(producer);
          const encoder=device.createCommandEncoder();producer.encode(encoder,{particleCount:2,
            scratch:upload('cold pair packets',scratch),events:upload('cold sparse events',events),
            eventPlan:upload('cold event plan',plans),energyOutput:allocate('cold carrier energy',(4*W+4)*4)});
          device.queue.submit([encoder.finish()]);return producer.commit();
        };
        const firstEmission=makeEmission(firstCount,10);
        const firstControl=allocate('first history decision',128);
        const first=prepareSphReactionResidualHistory({device,emitted:firstEmission,capacity,controlBuffer:firstControl});producers.push(first);
        let encoder=device.createCommandEncoder();first.encode(encoder);first.check(encoder);first.restore(encoder);
        if(kind==='deformed-carry' || kind==='deformed-rejection')for(let row=0;row<firstCount;row++) {
          encoder.copyBufferToBuffer(physicalReference,row*52*4,first.record.buffer,
            (H.headerWords+row*H.rowWords+H.physicalOffset)*4,52*4);
        }
        device.queue.submit([encoder.finish()]);
        const before=first.transfer();holders.push(before);const priorRead=borrowSphReactionResidualHistory(before.history,{device});reads.push(priorRead);
        const emitted=sourceOnly?null:makeEmission(addedCount,20,kind==='rejected-emission');
        const control=allocate('second history decision',128);
        const next=prepareSphReactionResidualHistory({device,source:before.history,emitted,capacity,controlBuffer:control});producers.push(next);
        // The independent child's retained reads must survive closing both
        // original producers and the predecessor's private admission handle.
        first.destroy();before.destroy();for(const emission of emissions)emission.destroy();priorRead.validate();
        let cloneRefused=false;try {prepareSphReactionResidualHistory({device,source:{...before.history},capacity,controlBuffer:control});}catch{cloneRefused=true;}
        if(!cloneRefused)throw new Error('Copied history owner admitted');
        const oldSnapshot=allocate('GPU predecessor snapshot',priorRead.buffer.size);
        const fault=upload('cold fixed fault word',new Uint32Array([kind==='late-count'?capacity+1:
          kind==='late-count-grow'?firstCount+1:kind==='bad-emission-count'?addedCount+1:1]));
        encoder=device.createCommandEncoder();
        if(kind==='bad-source-seal')encoder.copyBufferToBuffer(fault,0,priorRead.buffer,7*4,4);
        if(kind==='old-version')encoder.copyBufferToBuffer(fault,0,priorRead.buffer,4,4);
        if(kind==='bad-source-deformation')encoder.copyBufferToBuffer(upload('cold invalid source F',new Uint32Array([0x7fc00000])),
          0,priorRead.buffer,(H.headerWords+H.mechanicsOffset)*4,4);
        if(kind==='bad-emission-count')encoder.copyBufferToBuffer(fault,0,emitted.buffer,4*4,4);
        encoder.copyBufferToBuffer(priorRead.buffer,0,oldSnapshot,0,priorRead.buffer.size);
        next.encode(encoder);
        if(kind==='late-quantity')encoder.copyBufferToBuffer(fault,0,next.record.buffer,(H.headerWords+H.energyOffset)*4,4);
        const physicalFault={'late-position':0,'late-velocity':4,'late-deformation':20,
          'late-apic':31,'late-thermo':10,'late-volume':39}[kind];
        if(physicalFault!==undefined)encoder.copyBufferToBuffer(fault,0,next.record.buffer,
          (H.headerWords+H.physicalOffset+physicalFault)*4,4);
        if(kind==='late-appended-deformation')encoder.copyBufferToBuffer(fault,0,next.record.buffer,
          (H.headerWords+firstCount*H.rowWords+H.mechanicsOffset)*4,4);
        if(kind.startsWith('late-count'))encoder.copyBufferToBuffer(fault,0,next.record.buffer,3*4,4);
        next.check(encoder);
        if(kind==='downstream-rejection' || kind==='deformed-rejection')encoder.copyBufferToBuffer(fault,0,control,8,4);
        if(kind==='mechanics-gate')next.requireEmptyForMechanics(encoder);
        next.restore(encoder);device.queue.submit([encoder.finish()]);
        const successor=next.transfer();holders.push(successor);const read=borrowSphReactionResidualHistory(successor.history,{device});reads.push(read);
        next.destroy();successor.destroy();read.validate();
        const rejected=['overflow','bad-emission-count','bad-source-seal','late-quantity','late-count',
          'late-count-shrink','late-count-grow','downstream-rejection','mechanics-gate','old-version',
          'deformed-rejection','bad-source-deformation','late-appended-deformation'].includes(kind)
          || physicalFault!==undefined || kind.startsWith('bad-physical-');
        const expected=firstCount+(rejected?0:addedCount);
        const receipt=allocate('fixed history receipt',128),readback=allocate('fixed history readback',128,1|8);
        const shader=device.createShaderModule({code:`
@group(0) @binding(0) var<storage,read> before:array<u32>;
@group(0) @binding(1) var<storage,read> snapshot:array<u32>;
@group(0) @binding(2) var<storage,read> after:array<u32>;
@group(0) @binding(3) var<storage,read> emitted:array<u32>;
@group(0) @binding(4) var<storage,read> control:array<u32>;
@group(0) @binding(5) var<storage,read> first_control:array<u32>;
@group(0) @binding(6) var<storage,read_write> receipt:array<atomic<u32>>;
@group(0) @binding(7) var<storage,read> expected_physical:array<u32>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row==0u) {
    atomicStore(&receipt[1],control[2]);atomicStore(&receipt[2],after[3]);atomicStore(&receipt[3],before[3]);
    if(first_control[2]!=0u || (control[2]!=0u)!=${rejected}){atomicOr(&receipt[0],1u);}
    if(after[0]!=0x50484731u || after[1]!=${H.version}u || after[2]!=1u || after[3]!=${expected}u || after[4]!=${capacity}u
      || after[5]!=${H.rowWords/4}u || after[6]!=${successor.history.generation}u || after[7]!=${successor.history.seal}u
      || after[8]!=${Math.ceil(expected/64)}u || after[9]!=1u || after[10]!=1u || after[11]!=0u){atomicOr(&receipt[0],2u);}
    for(var w=0u;w<${H.headerWords}u;w++){if(before[w]!=snapshot[w]){atomicOr(&receipt[0],4u);}}
  }
  if(row>=${capacity}u){return;}
  let at=${H.headerWords}u+row*${H.rowWords}u;
  for(var w=0u;w<${H.rowWords}u;w++) {
    if(before[at+w]!=snapshot[at+w]){atomicOr(&receipt[0],8u);}
    var wanted=0u;
    if(row<${firstCount}u){wanted=snapshot[at+w];}
    else if(row<${expected}u && w<${E.rowWords}u){wanted=emitted[${E.headerWords}u+((row-${firstCount}u)*2u+1u)*${E.rowWords}u+w];}
    if(w<${H.physicalOffset}u || row>=${expected}u) {
      if(after[at+w]!=wanted){atomicOr(&receipt[0],16u);}
    } else {
      if(row<${firstCount}u && after[at+w]!=snapshot[at+w]){atomicOr(&receipt[0],32u);}
      let index=w-${H.physicalOffset}u;
      let reference=expected_physical[row*52u+index];
      if(index==16u || index==19u) {
        let radius=bitcast<f32>(after[at+w]);let expected_radius=bitcast<f32>(reference);
        if(!(abs(radius-expected_radius)<=expected_radius*1.0e-5)){atomicOr(&receipt[0],64u);}
      } else if(after[at+w]!=reference && !(${kind==='bad-source-deformation'} && row==0u && index==20u)){
        atomicOr(&receipt[0],128u);
      }
    }
  }
}`});
        const pipeline=device.createComputePipeline({layout:'auto',compute:{module:shader,entryPoint:'check'}});
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[priorRead.buffer,oldSnapshot,read.buffer,
          emitted?.buffer??firstEmission.buffer,control,firstControl,receipt,physicalReference].map((buffer,binding)=>({binding,resource:{buffer}}))});
        const check=device.createCommandEncoder(),pass=check.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(capacity/64));pass.end();
        check.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([check.finish()]);
        await readback.mapAsync(1);const words=Array.from(new Uint32Array(readback.getMappedRange()));readback.unmap();results.push({kind,words});
      }finally{
        await device.queue.onSubmittedWorkDone();
        for(const read of reads.reverse())read.release();for(const holder of holders.reverse())holder.destroy();
        for(const producer of producers.reverse())producer.destroy();for(const emission of emissions)emission.destroy();
        for(const b of owned)b.destroy();
      }
    }
    const error=await device.popErrorScope();if(error)errors.push(error.message);return{results,errors};
  }finally{device.destroy();}
}
