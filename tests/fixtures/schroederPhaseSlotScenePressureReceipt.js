import { webGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

// Fixed GPU receipt for the actual admitted mechanics family. The gas-law
// parameters are cold packed material data; no hot state leaves the device.
export async function phaseSlotScenePressureReceipt(sph, mls, gasId, law) {
  const device=webGpuBufferDevice(sph.stateBuffer);
  if(!mls?.mechanicsBuffer || webGpuBufferDevice(mls.mechanicsBuffer)!==device){
    throw new Error('Pressure receipt requires the same-device current mechanics owner');
  }
  const result=device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const read=device.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  try {
    const code=`
      @group(0) @binding(0) var<storage,read> s:array<vec4<f32>>;
      @group(0) @binding(1) var<storage,read> t:array<vec4<f32>>;
      @group(0) @binding(2) var<storage,read> m:array<vec4<f32>>;
      @group(0) @binding(3) var<storage,read_write> r:array<u32>;
      fn finite(v:f32)->bool{return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
      @compute @workgroup_size(1) fn main(){
        let law=vec4<f32>(${law.map(x=>Number(x).toExponential(12)).join(',')});
        var max_speed=0.0;
        for(var i=0u;i<arrayLength(&s)/2u;i++){
          if(s[2u*i].w<=0.0 || t[3u*i].x!=${gasId}.0 || t[3u*i].y!=3.0){continue;}
          r[1]++;
          let row0=m[8u*i];let row1=m[8u*i+1u];let row2=m[8u*i+2u];
          let row4=m[8u*i+4u];let row5=m[8u*i+5u];let row6=m[8u*i+6u];
          let determinant=row0.x*(row1.x*row2.x-row1.y*row1.w)
            -row0.y*(row0.w*row2.x-row1.y*row1.z)+row0.z*(row0.w*row1.w-row1.x*row1.z);
          if(!(row4.z>0.0) || !(row4.w>0.0) || !finite(row4.z*row4.w)
             || !(abs(determinant-row4.z)<=0.0002*max(1.0,row4.z))){r[0]++;r[2]++;}
          let real_c=sqrt(law.x*t[3u*i].z);
          let c=max(select(real_c*law.y,min(real_c,law.z),law.z>0.0),law.w);
          if(!(abs(row6.y-c)<=0.00002*c) || row6.z!=2.0 || row6.w!=1.0 || row5.y!=1.0){r[0]++;r[3]++;}
          let speed=length(s[2u*i+1u].xyz);
          if(!finite(speed)){r[0]++;r[6]++;}
          if(speed>1e-8){r[4]++;}max_speed=max(max_speed,speed);
        }
        r[5]=bitcast<u32>(max_speed);r[7]=1u;
      }`;
    const pipeline=device.createComputePipeline({layout:'auto',compute:{entryPoint:'main',module:device.createShaderModule({code})}});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:
      [sph.stateBuffer,sph.thermoBuffer,mls.mechanicsBuffer,result].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder();const pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
    encoder.copyBufferToBuffer(result,0,read,0,32);device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);const words=[...new Uint32Array(read.getMappedRange())];read.unmap();return words;
  } finally {
    await device.queue.onSubmittedWorkDone();result.destroy();read.destroy();
  }
}
