import { schroederSpatialMechanicsSpeedBoundWgsl } from '../../ulg-gpu-abi/src/schroederSpatialMechanicsCorrectionWgsl.js';

export async function runChainSpeedBoundNative() {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const device=await adapter.requestDevice(),errors=[];
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  device.pushErrorScope('validation');
  try {
    const cases=[];
    for(const mass of [1,3.107803833714675e-20,1e-30]) {
      for(const [velocity,expected] of [[[0,0,0],1],[[23,0,0],1],[[199,0,0],1],
        [[201,0,0],0],[[120,120,120],0],[[100,100,100],1],[[1e10,0,0],0]]) {
        cases.push({mass,velocity,expected});
      }
    }
    const rows=new Float32Array(cases.length*4);
    cases.forEach(({mass,velocity},i)=>rows.set([...velocity.map(v=>v*mass),mass],i*4));
    const input=device.createBuffer({size:rows.byteLength,usage:128|8});device.queue.writeBuffer(input,0,rows);
    const receipt=device.createBuffer({size:128,usage:128|4});
    const readback=device.createBuffer({size:128,usage:1|8});
    const module=device.createShaderModule({code:`${schroederSpatialMechanicsSpeedBoundWgsl}
      @group(0) @binding(0) var<storage,read> rows:array<vec4<f32>>;
      @group(0) @binding(1) var<storage,read_write> receipt:array<u32>;
      @compute @workgroup_size(32) fn check(@builtin(global_invocation_id) id:vec3<u32>){
        if(id.x>=arrayLength(&rows)){return;}let row=rows[id.x];
        receipt[id.x]=select(0u,1u,mechanics_within_speed(row.xyz,row.w,200.0));
      }`});
    const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'check'}});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,receipt].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const e=device.createCommandEncoder(),pass=e.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
    e.copyBufferToBuffer(receipt,0,readback,0,128);device.queue.submit([e.finish()]);
    await readback.mapAsync(1);const words=Array.from(new Uint32Array(readback.getMappedRange()));readback.unmap();
    const validation=await device.popErrorScope();if(validation) errors.push(validation.message);
    return {words,expected:cases.map(c=>c.expected),errors};
  } finally {device.destroy();}
}
