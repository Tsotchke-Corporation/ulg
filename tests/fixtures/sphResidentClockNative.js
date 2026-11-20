import { prepareSphResidentClockAdvance, validateSphResidentClock } from '../../src/runtime/sph/sphResidentClockGpu.js';

export async function runResidentClockNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter) throw new Error('Native clock requires a GPU adapter');
  const device=await adapter.requestDevice();
  const errors=[];device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
  const reports=[];
  try {
    for(const scenario of [
      {name:'accept-reject-accept',errors:[0,8,0],step:0x100000001,time:1.25},
      {name:'repeated-rejection',errors:[4,256,32768],step:12,time:0.1},
      {name:'accepted-sequence',errors:Array(17).fill(0),step:55,time:123.456789012345},
      {name:'step-exhausted',errors:[0],step:Number.MAX_SAFE_INTEGER,time:0},
      {name:'damaged-origin',errors:[0,0],step:0,time:0,damage:true}
    ]) {
      const advances=[],controls=[];let staging=null;
      try {
        const encoder=device.createCommandEncoder();
        for(const error of scenario.errors) {
          const control=device.createBuffer({size:16,usage:128|8|4});controls.push(control);
          device.queue.writeBuffer(control,8,new Uint32Array([error]));
          const source=advances.at(-1)?.clock??null;
          const advance=prepareSphResidentClockAdvance({device,source,controlBuffer:control,
            baseStep:scenario.step,baseTime:scenario.time,dt:0.001});
          advances.push(advance);
          if(source) {
            let refused=false;try{advances.at(-2).destroy();}catch{refused=true;}
            if(!refused) throw new Error('Clock source retired while retained');
          }
          let refused=false;try{validateSphResidentClock({...advance.clock},device);}catch{refused=true;}
          if(!refused) throw new Error('Clock accepted a copied descriptor');
          refused=false;try{advance.clock.buffer.destroy();}catch{refused=true;}
          if(!refused) throw new Error('Clock buffer lost its owner');
          refused=false;
          try{prepareSphResidentClockAdvance({device,source:advance.clock,dt:0.002,controlBuffer:control});}catch{refused=true;}
          if(!refused) throw new Error('Clock silently changed dt');
          advance.check(encoder);advance.advance(encoder);
          if(scenario.damage && advances.length===1) encoder.clearBuffer(advance.clock.buffer,0,4);
        }
        staging=device.createBuffer({size:80,usage:1|8});
        encoder.copyBufferToBuffer(advances.at(-1).clock.buffer,0,staging,0,64);
        encoder.copyBufferToBuffer(controls.at(-1),0,staging,64,16);
        device.queue.submit([encoder.finish()]);
        await staging.mapAsync(1);const words=Array.from(new Uint32Array(staging.getMappedRange()));staging.unmap();
        reports.push({name:scenario.name,words,sourceStep:scenario.step,sourceTime:scenario.time,
          expectedAccepted:scenario.errors.filter(value=>value===0).length,
          expectedRejected:scenario.errors.filter(value=>value!==0).length});
      } finally {
        for(const advance of advances.reverse()) advance.destroy();
        for(const control of controls) control.destroy();staging?.destroy();
      }
    }
    return {reports,errors};
  } finally {device.destroy();}
}
