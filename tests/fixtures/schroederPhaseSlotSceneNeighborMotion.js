import { webGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

// Manufactured external displacement between schedules. Only the condensed
// neighbor's position changes; no gas state, ledger, identity or proposal does.
// Two subsequent production steps rebuild and then consume the current spatial
// dictionary. This exercises adaptation, not unforced liquid motion.
export function displacePhaseSlotSceneNeighbor(sph, liquidId, away) {
  const device=webGpuBufferDevice(sph.stateBuffer);
  const position=away ? '9.0,9.0,9.0' : '6.5,5.5,5.5';
  const pipeline=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',
    module:device.createShaderModule({code:`
      @group(0) @binding(0) var<storage,read_write> s:array<vec4<f32>>;
      @group(0) @binding(1) var<storage,read> t:array<vec4<f32>>;
      @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){
        let i=id.x;if(i>=arrayLength(&s)/2u){return;}
        if(t[3u*i].x==${liquidId}.0 && s[2u*i].w>0.0){s[2u*i]=vec4<f32>(${position},s[2u*i].w);}
      }`})}});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
    [sph.stateBuffer,sph.thermoBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(sph.particleCount/64));pass.end();
  device.queue.submit([encoder.finish()]);
}
