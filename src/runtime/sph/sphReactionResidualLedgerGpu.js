import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  releaseQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format } from './sphExactThermalEnergyWgsl.js';

const owners = new WeakMap();
const W = format.wordCount;
export const SPH_REACTION_LEDGER_PACKET_WORDS = 1 + 2 * W;
export const SPH_REACTION_LEDGER_SCRATCH_HEADER_WORDS = 8;
export const SPH_REACTION_RESIDUAL_LEDGER_LAYOUT = Object.freeze({
  schema: 'peercompute.ulg.reaction-residual-ledger.v1', format,
  headerWords: 16, eventWords: 32, massOffset: 32, energyOffset: 32 + W,
  sourceOffset: 32 + 2 * W, rowWords: 32 + 3 * W
});
const L = SPH_REACTION_RESIDUAL_LEDGER_LAYOUT;

function original(record, device) {
  const owner = owners.get(record);
  if (!owner || owner.device !== device || !owner.committed || owner.closed || owner.retired) {
    throw new TypeError('Residual ledger requires its original live reaction producer');
  }
  return owner;
}

/** A borrow retains the actual GPU-produced rows, never quantities reconstructed
 * from an observed f32 history. The consumer releases after its last GPU use. */
export function borrowSphReactionResidualLedger(record, { device } = {}) {
  const owner = original(record, device);
  owner.readers++;
  let live = true;
  return Object.freeze({ record, buffer: record.buffer, layout: L,
    validate() {
      if (!live || owner.retired) throw new TypeError('Residual ledger read is retired');
      return true;
    },
    release() {
      if (!live) return false;
      live = false; owner.readers--; owner.retire(); return true;
    }
  });
}

const code = /* wgsl */ `
${createSphExactMassWgsl(format)}
${createSphExactLedgerWgsl(format)}
@group(0) @binding(0) var<storage,read> scratch:array<u32>;
@group(0) @binding(1) var<storage,read> events:array<u32>;
@group(0) @binding(2) var<storage,read> plans:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read_write> carrier_energy:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> history:array<atomic<u32>>;
struct Params { particles:u32, capacity:u32, generation:u32, pad:u32 };
@group(0) @binding(5) var<uniform> cfg:Params;
const HEADER:u32=${L.headerWords}u;
const STRIDE:u32=${L.rowWords}u;
fn fail(bits:u32) {
  atomicOr(&history[5],bits);
  atomicOr(&carrier_energy[2u*cfg.particles*EM_WORDS],1024u);
}
fn finite(v:f32)->bool {return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
@compute @workgroup_size(1) fn initialize() {
  atomicStore(&history[0],0x52484c31u);
  atomicStore(&history[1],1u);
  atomicStore(&history[2],cfg.capacity);
  atomicStore(&history[3],select(0u,min(scratch[2],cfg.capacity),scratch[1]==1u));
  atomicStore(&history[6],scratch[1]);
  atomicStore(&history[7],cfg.generation);
  if(scratch[2]>cfg.capacity) {fail(1u);}
}
@compute @workgroup_size(64) fn retain_residual(@builtin(global_invocation_id) id:vec3<u32>) {
  let event=id.x;
  if(scratch[1]!=1u || event>=min(scratch[2],cfg.capacity)) {return;}
  if(plans[event*2u+1u].x!=6.0) {return;}
  let packet=${SPH_REACTION_LEDGER_SCRATCH_HEADER_WORDS}u+cfg.particles+event*${SPH_REACTION_LEDGER_PACKET_WORDS}u;
  if(scratch[packet]!=1u) {fail(2u);return;}
  var mass=ExactMass();var arrived=ExactMass();
  for(var w=0u;w<EM_WORDS;w++) {
    mass.words[w]=scratch[packet+1u+w];
    arrived.words[w]=scratch[packet+1u+EM_WORDS+w];
  }
  let projection=em_project_f32_bits(mass);
  let m=bitcast<f32>(projection.bits);
  let event_at=event*32u;
  let u=bitcast<f32>(events[event_at+19u]);
  let density=bitcast<f32>(events[event_at+17u]);
  let molar_mass=bitcast<f32>(events[event_at+15u]);
  if(projection.error!=0u || !(m>0.0) || !finite(m) || !finite(u)
    || !(density>0.0) || !finite(density) || !(molar_mass>0.0) || !finite(molar_mass)) {
    fail(4u);return;
  }
  // The same declared heat-proxy law as the carrier reconcile: U follows the
  // f32 product u, and S records exactly the difference from incoming energy.
  let energy=el_from_f32_bits(bitcast<u32>(m*u));
  let source=el_subtract(energy.value,arrived);
  let moles=m/molar_mass;let volume=m/density;
  if((energy.error|source.error)!=0u || !finite(moles) || !finite(volume)) {fail(4u);return;}
  let at=HEADER+event*STRIDE;
  for(var w=0u;w<32u;w++) {atomicStore(&history[at+w],events[event_at+w]);}
  atomicStore(&history[at+3u],projection.bits);
  atomicStore(&history[at+9u],bitcast<u32>(moles));
  atomicStore(&history[at+12u],0u);
  atomicStore(&history[at+13u],projection.bits);
  atomicStore(&history[at+23u],bitcast<u32>(volume));
  atomicStore(&history[at+31u],bitcast<u32>(6.0));
  for(var w=0u;w<EM_WORDS;w++) {
    atomicStore(&history[at+${L.massOffset}u+w],mass.words[w]);
    atomicStore(&history[at+${L.energyOffset}u+w],energy.value.words[w]);
    atomicStore(&history[at+${L.sourceOffset}u+w],source.value.words[w]);
  }
  atomicAdd(&history[4],1u);
}`;

/** Sparse rows preserve the original compact event index. No compaction/count
 * alias is guessed here. History merge and native mechanics must explicitly
 * consume these quantities before a mass-bearing continuation can be admitted. */
export function createSphReactionResidualLedger({ device, capacity, generation }) {
  const size=(L.headerWords+Math.max(1,capacity)*L.rowWords)*4;
  if(!Number.isSafeInteger(capacity) || Object.is(capacity,-0) || capacity<0 || capacity>0xffffffff
    || !Number.isSafeInteger(generation) || Object.is(generation,-0) || generation<0 || generation>0xffffffff
    || size>device.limits.maxBufferSize || size>device.limits.maxStorageBufferBindingSize
    || Math.ceil(capacity/64)>device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Residual ledger exceeds its declared GPU capacity');
  }
  let buffer=null,params=null;
  const useQueueOrderedPool = Boolean(
    typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const destroyed=new Set();
  const owner={device,committed:false,closed:false,retired:false,retiring:false,readers:0,
    retire() {
      if(!this.closed || this.readers || this.retired || this.retiring) return;
      this.retiring=true;const errors=[];
      for(const resource of [buffer,params]) {
        if(!resource || destroyed.has(resource))continue;
        try {resource.destroy();destroyed.add(resource);}catch(error){errors.push(error);}
      }
      this.retiring=false;this.retired=errors.length===0;
      if(errors.length)throw new AggregateError(errors,'Residual ledger retirement failed');
    }};
  const destroy=()=>{const first=!owner.closed;owner.closed=true;owner.retire();return first;};
  try {
    buffer=tagWebGpuBufferDevice(
      useQueueOrderedPool
        ? acquireQueueOrderedPooledBuffer(device,{bucketKey:'ulg-reaction-residual-ledger',label:'ulg-reaction-residual-ledger',size,usage:128|4|8})
        : device.createBuffer({label:'ulg-reaction-residual-ledger',size,usage:128|4|8}),
      device
    );
    const rawDestroy=buffer.destroy.bind(buffer);
    buffer.destroy=()=>{
      if(!owner.retiring) throw new TypeError('Residual ledger is retained by its producer or readers');
      if(useQueueOrderedPool) {
        buffer.destroy=rawDestroy;
        releaseQueueOrderedPooledBuffer(device,buffer,{bucketKey:'ulg-reaction-residual-ledger',size,usage:128|4|8});
      } else {
        rawDestroy();
      }
    };
    params=useQueueOrderedPool
      ? acquireQueueOrderedPooledBuffer(device,{bucketKey:'ulg-reaction-residual-params',label:'ulg-reaction-residual-params',size:16,usage:64|8})
      : device.createBuffer({label:'ulg-reaction-residual-params',size:16,usage:64|8});
    if(useQueueOrderedPool) {
      const rawParamsDestroy=params.destroy.bind(params);
      params.destroy=()=>{
        params.destroy=rawParamsDestroy;
        releaseQueueOrderedPooledBuffer(device,params,{bucketKey:'ulg-reaction-residual-params',size:16,usage:64|8});
      };
    }
    const record=Object.freeze({device,buffer,layout:L,capacity,generation,
      physicalPublicationAdmitted:false});
    owners.set(record,owner);
    let encoded=false;
    return Object.freeze({destroy,
      encode(encoder,{scratch,events,eventPlan,energyOutput,particleCount}) {
        if(encoded || owner.closed) throw new TypeError('Residual ledger must be encoded once');
        if(!Number.isSafeInteger(particleCount) || particleCount<1 || particleCount>0xffffffff
          || [scratch,events,eventPlan,energyOutput].some(b=>webGpuBufferDevice(b)!==device)
          || events.size<capacity*128 || eventPlan.size<capacity*32
          || scratch.size<(SPH_REACTION_LEDGER_SCRATCH_HEADER_WORDS+particleCount+Math.max(1,capacity)*SPH_REACTION_LEDGER_PACKET_WORDS)*4
          || energyOutput.size<(2*particleCount*W+4)*4) {
          throw new TypeError('Residual ledger requires the complete original reaction buffers');
        }
        if(useQueueOrderedPool) encoder.clearBuffer(buffer,0,size);
        device.queue.writeBuffer(params,0,new Uint32Array([particleCount,capacity,generation,0]));
        for(const entryPoint of ['initialize','retain_residual']) {
          const pipeline=createCachedExplicitComputePipeline(device,{code,entryPoint,
            label:`ulg-reaction-residual-${entryPoint}`,cacheKey:`ulg-reaction-residual-v1-${entryPoint}`,
            bindings:['read-only-storage','read-only-storage','read-only-storage','storage','storage','uniform']
              .map((type,binding)=>computeBufferBinding(binding,type))});
          const group=device.createBindGroup({layout:pipeline.bindGroupLayout,
            entries:[scratch,events,eventPlan,energyOutput,buffer,params].map((b,binding)=>({binding,resource:{buffer:b}}))});
          const pass=encoder.beginComputePass();pass.setPipeline(pipeline.pipeline);pass.setBindGroup(0,group);
          pass.dispatchWorkgroups(entryPoint==='initialize'?1:Math.max(1,Math.ceil(capacity/64)));pass.end();
        }
        encoded=true;
      },
      commit() {
        if(!encoded || owner.closed || owner.committed) throw new TypeError('Residual ledger requires one encoded producer');
        owner.committed=true;return record;
      }
    });
  } catch(error) {destroy();throw error;}
}
