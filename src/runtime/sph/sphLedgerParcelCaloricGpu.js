import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer,
  unwrapWebGpuCacheDevice
} from '../webgpuComputeLayout.js';
import { schroederPhaseSlotCaloricWgsl } from './schroederPhaseSlotCaloricWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_ERROR } from './sphExactThermalEnergyWgsl.js';

const ledgerParcelCaloricSegmentsCache = new WeakMap();

// Parcel exchange changes carrier U/m. Refresh explicit U(T) projections before
// pressure/mechanics consume them; the exact ledger and phase remain authority.
// Legacy reference-energy ladders require their own pressure-carrier closure.
export function createSphLedgerParcelCaloricStage({device,particleCount,stateBuffer,thermoBuffer,
  energy,thermalMaterialTable}) {
  if(!thermalMaterialTable?.segments || !Number.isInteger(thermalMaterialTable.segmentCount)) {
    throw new TypeError('Ledger parcel caloric refresh requires the current thermal table');
  }
  const code=`
    struct Params { particle_count:u32, segment_count:u32, error_offset:u32, pad:u32 };
    @group(0) @binding(0) var<uniform> params:Params;
    @group(0) @binding(1) var<storage,read> state:array<vec4<f32>>;
    @group(0) @binding(2) var<storage,read_write> thermo:array<vec4<f32>>;
    @group(0) @binding(3) var<storage,read> segments:array<vec4<f32>>;
    @group(0) @binding(4) var<storage,read_write> ledger:array<atomic<u32>>;
    fn finite(v:f32)->bool{return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
    fn finite4(v:vec4<f32>)->bool{return finite(v.x)&&finite(v.y)&&finite(v.z)&&finite(v.w);}
    fn integer(v:f32)->bool{return finite(v)&&v>=0.0&&v==floor(v);}
    ${schroederPhaseSlotCaloricWgsl}
    @compute @workgroup_size(64) fn refresh(@builtin(global_invocation_id) id:vec3<u32>){
      let i=id.x;if(i>=params.particle_count || state[2u*i].w<=0.0){return;}
      let t=thermo[3u*i];var has_caloric=false;
      for(var r=0u;r<params.segment_count;r++){
        let a=segments[3u*r];if(a.x==t.x && (a.y==3.0||a.y==4.0||a.y==5.0)){has_caloric=true;}
      }
      if(!has_caloric){return;}
      let temperature=phase_temperature(t.x,state[2u*i+1u].w,t.y);
      if(!(temperature>0.0)){atomicOr(&ledger[params.error_offset],${SPH_EXACT_THERMAL_ENERGY_ERROR.OUTSIDE_DOMAIN}u);return;}
      thermo[3u*i]=vec4<f32>(t.xy,temperature,t.w);
    }`;
  const pipeline=createCachedExplicitComputePipeline(device,{cacheKey:'ulg-ledger-parcel-caloric.v1',
    label:'ulg-ledger-parcel-caloric',code,entryPoint:'refresh',bindings:
      ['uniform','read-only-storage','storage','read-only-storage','storage']
        .map((type,binding)=>computeBufferBinding(binding,type))});
  const useQueueOrderedPool = Boolean(
    typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const owned=[];
  const make=(label,data,usage,poolable=false)=>{
    const size=Math.max(16,data.byteLength);
    const fullUsage=usage|GPUBufferUsage.COPY_DST;
    const b=useQueueOrderedPool && poolable
      ? registerQueueOrderedPooledBufferReturn(
          acquireQueueOrderedPooledBuffer(device,{bucketKey:label,label,size,usage:fullUsage}),
          device,{bucketKey:label,size,usage:fullUsage}
        )
      : device.createBuffer({label,size,usage:fullUsage});
    owned.push(b);device.queue.writeBuffer(b,0,data);return b;
  };
  let encoded=false;
  try{
    const params=make('ulg-ledger-parcel-caloric-params',new Uint32Array([particleCount,thermalMaterialTable.segmentCount,
      2*particleCount*energy.format.wordCount,0]),GPUBufferUsage.UNIFORM,true);
    let segments;
    if (useQueueOrderedPool && thermalMaterialTable.segments?.byteLength > 0) {
      const cacheKeyDevice = unwrapWebGpuCacheDevice(device);
      let segCache = ledgerParcelCaloricSegmentsCache.get(cacheKeyDevice);
      if (!segCache) { segCache = new WeakMap(); ledgerParcelCaloricSegmentsCache.set(cacheKeyDevice, segCache); }
      segments = segCache.get(thermalMaterialTable.segments);
      if (!segments) {
        segments = device.createBuffer({
          label: 'ulg-ledger-parcel-caloric-segments',
          size: Math.max(16, thermalMaterialTable.segments.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(segments, 0, thermalMaterialTable.segments);
        segCache.set(thermalMaterialTable.segments, segments);
      }
    } else {
      segments=make('ulg-ledger-parcel-caloric-segments',thermalMaterialTable.segments,GPUBufferUsage.STORAGE);
    }
    const group=createCachedExplicitBindGroup(device,{layout:pipeline.bindGroupLayout,entries:
      [params,stateBuffer,thermoBuffer,segments,energy.energyBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
    return {encode(encoder){encoded=true;const pass=encoder.beginComputePass({label:'ulg-ledger-parcel-caloric'});
      pass.setPipeline(pipeline.pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(particleCount/64));pass.end();},
      destroy(){for(const b of owned)releaseOrDestroyQueueOrderedPooledBuffer(b,{allowPool:encoded});}};
  }catch(error){for(const b of owned)releaseOrDestroyQueueOrderedPooledBuffer(b,{allowPool:false});throw error;}
}
