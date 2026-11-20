import { prepareSphLedgerReactionHistory } from '../../src/runtime/sph/sphLedgerReactionHistoryGpu.js';
import { createResidentProductEventCountControlWords, registerResidentProductEventCountAuthority,
  productEventLiveCountCopyDescriptor } from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { createResidentProductMassHandle } from '../../src/runtime/sph/sphReactionGpuSummary.js';
import { acquireResidentProductHistoryRead } from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

export async function runLedgerReactionHistoryNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(),errors=[],results=[];
  device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
  device.pushErrorScope('validation');
  try {
    for(const kind of ['cold-accept','cold-reject','separate-reject','shared-reject','carry',
      'mass-reject','count-reject','seal-reject']) {
      const owned=[],reads=[];
      const allocate=(label,size,usage)=>{
        const b=tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device);owned.push(b);return b;
      };
      try {
        const capacity=17,bytes=capacity*128,hasSource=!kind.startsWith('cold');
        const shared=kind==='shared-reject'||kind==='carry';
        const source=hasSource?allocate('cold source history',bytes,128|4|8):null;
        const output=shared?source:allocate('cold output history',bytes,128|4|8);
        const counts=allocate('distinct logical count records',512,128|4|8);
        const control=allocate('chain decision',128,128|4|8);
        const receipt=allocate('history receipt',128,128|4|8);
        const readback=allocate('fixed history readback',128,1|8);
        const makeHandle=(buffer,offset,count,generation)=>{
          const handle=createResidentProductMassHandle({productEventBuffer:buffer,
            productEventBufferRetained:true,productEventDevice:device,productEventRowCount:capacity,
            destroyProductEventBuffer:()=>true});
          const words=createResidentProductEventCountControlWords({liveRowCount:count,rowCapacity:capacity,
            rowStrideVec4:8,generation,seal:100+generation});
          device.queue.writeBuffer(counts,offset,words);
          registerResidentProductEventCountAuthority(handle,{device,controlBuffer:counts,controlOffsetBytes:offset,
            rowCapacity:capacity,rowStrideFloats:32,generation,seal:100+generation});
          return handle;
        };
        const before=hasSource?makeHandle(source,0,2,1):null;
        const after=kind==='carry'?before:makeHandle(output,256,hasSource?3:1,2);
        const coldRows=new Uint32Array(bytes/4);
        // Mass-free records can still carry metadata. Rollback must preserve it.
        coldRows[0]=123;if(hasSource) coldRows[32]=456;
        if(source) device.queue.writeBuffer(source,0,coldRows);
        if(!shared) {const out=coldRows.slice();if(hasSource) out[64]=789;device.queue.writeBuffer(output,0,out);}
        else if(kind!=='carry') device.queue.writeBuffer(output,256,new Uint32Array([789]));
        if(kind==='mass-reject') device.queue.writeBuffer(output,(64+3)*4,new Float32Array([1]));
        if(kind==='count-reject') device.queue.writeBuffer(counts,256+12,new Uint32Array([capacity+1]));
        if(kind==='seal-reject') device.queue.writeBuffer(counts,256+28,new Uint32Array([0]));
        const rejected=kind.endsWith('reject');
        if(['cold-reject','separate-reject','shared-reject'].includes(kind)) device.queue.writeBuffer(control,8,new Uint32Array([1]));
        const sourceRead=before?acquireResidentProductHistoryRead(before,{device}):null;
        if(sourceRead) reads.push(sourceRead);
        const history=prepareSphLedgerReactionHistory({device,sourceRead,candidate:after,controlBuffer:control,allocate});
        let refused=false;
        try {prepareSphLedgerReactionHistory({device,sourceRead,candidate:{...after},controlBuffer:control,allocate});}
        catch {refused=true;}
        if(!refused) throw new Error('Copied history owner was accepted');
        const encoder=device.createCommandEncoder();history.check(encoder);history.restore(encoder);
        const descriptor=productEventLiveCountCopyDescriptor(after,device);
        const expectedCount=rejected?(hasSource?2:0):kind==='carry'?2:1;
        const shader=device.createShaderModule({code:`
          @group(0) @binding(0) var<storage,read> rows:array<u32>;
          @group(0) @binding(1) var<storage,read> counts:array<u32>;
          @group(0) @binding(2) var<storage,read> control:array<u32>;
          @group(0) @binding(3) var<storage,read_write> receipt:array<u32>;
          @compute @workgroup_size(1) fn check(){
            let at=${descriptor.controlOffsetBytes/4}u;
            receipt[1]=control[2];receipt[2]=counts[at+3u];
            if((control[2]!=0u)!=${rejected} || counts[at+3u]!=${expectedCount}u){receipt[0]|=1u;}
            if(counts[at]!=0x50484731u || counts[at+2u]!=1u || counts[at+6u]!=${descriptor.generation}u
              || counts[at+7u]!=${descriptor.seal}u || counts[at+8u]!=${Math.ceil(expectedCount/64)}u
              || counts[at+9u]!=1u || counts[at+10u]!=1u || counts[at+11u]!=0u){receipt[0]|=2u;}
            if(${hasSource} && (counts[3]!=2u || counts[6]!=1u || counts[7]!=101u)){receipt[0]|=4u;}
            if(${rejected || kind==='carry'}) {
              for(var w=0u;w<arrayLength(&rows);w++) {
                var expected=0u;
                if(${hasSource} && w==0u){expected=123u;}
                if(${hasSource} && w==32u){expected=456u;}
                if(rows[w]!=expected){receipt[0]|=8u;}
              }
            }
          }`});
        const pipeline=device.createComputePipeline({layout:'auto',compute:{module:shader,entryPoint:'check'}});
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[output,counts,control,receipt]
          .map((buffer,binding)=>({binding,resource:{buffer}}))});
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
        encoder.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([encoder.finish()]);
        await readback.mapAsync(1);const words=Array.from(new Uint32Array(readback.getMappedRange()));readback.unmap();
        results.push({kind,words});
      } finally {await device.queue.onSubmittedWorkDone();for(const r of reads) r.release();for(const b of owned) b.destroy();}
    }
    const validation=await device.popErrorScope();if(validation) errors.push(validation.message);
    return {results,errors};
  } finally {device.destroy();}
}
