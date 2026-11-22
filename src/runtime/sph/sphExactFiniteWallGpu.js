import { borrowSphFiniteWallState, SPH_FINITE_WALL_CANONICAL_WORDS,
  SPH_FINITE_WALL_CANONICAL_MAGIC } from './sphFiniteWallStateGpu.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT as format } from './sphExactThermalEnergyWgsl.js';
import {
  createCachedExplicitComputePipeline,
  createCachedExplicitBindGroup,
  computeBufferBinding,
  acquireQueueOrderedPooledBuffer,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

const records = new WeakMap();
const privateStates = new WeakMap();
const W = format.wordCount;
const math = `${createSphExactMassWgsl(format)}\n${createSphExactLedgerWgsl(format)}`;
export const SPH_EXACT_FINITE_WALL_RECEIPT_MAGIC = 0x46575231;

export function validateSphExactFiniteWallRecord(record, device) {
  const owner = records.get(record);
  if (!owner || owner.device !== device || owner.destroyed) {
    throw new TypeError('Finite wall closure requires its genuine retained thermal successor');
  }
  owner.read.validate();
  return true;
}

// A transferred wall is still private to the resident batch. Keep its source
// pin until both the producer and every successor have finished, so the public
// cache cannot be changed while an unadmitted branch depends on it.
export function borrowSphPrivateFiniteWallState(device, state) {
  const owner = privateStates.get(state);
  if (!owner || owner.device !== device || !owner.privateLive || owner.wallRetired || owner.borrows) {
    throw new TypeError('Private finite wall requires its available original owner');
  }
  owner.read.validate();
  owner.borrows++;
  let live = true;
  return Object.freeze({ buffer: state.buffer, instanceId: state.instanceId,
    validate() {
      if (!live || owner.wallRetired) throw new TypeError('Private finite wall read was retired');
      return owner.read.validate();
    },
    release() {
      if (!live) return false;
      live = false; owner.borrows--; owner.retireWall(); return true;
    }
  });
}

// Carrier threads emit one signed packet per face. A parallel tree sums each
// face independently; no contended float CAS, microjoule quantization or CPU
// readback. S still records wall heat, as required by the carrier budget.
// The retained opposite packets independently close the finite wall budget.
export function prepareSphExactFiniteWallCandidate({ device, state, particleCount }) {
  if (!Number.isSafeInteger(particleCount) || particleCount < 1
    || device.limits.maxStorageBuffersPerShaderStage < 13) {
    throw new TypeError('Canonical finite walls require positive rows and 13 storage bindings');
  }
  const read = privateStates.has(state) ? borrowSphPrivateFiniteWallState(device, state)
    : borrowSphFiniteWallState(device, state);
  const transient = [], retained = [];
  const owner = { device, read, destroyed: false, transferred: false, privateLive: false,
    borrows: 0, wallBuffer: null, wallRetired: false,
    retireWall() {
      if (!this.destroyed || this.wallRetired || this.privateLive || this.borrows) return;
      this.wallRetired = true; this.wallBuffer?.destroy(); read.release();
    } };
  const isRealGpuDevice = typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice;
  const allocate = (label, size, usage, keep = false) => {
    if (size > device.limits.maxBufferSize || ((usage & 128) && size > device.limits.maxStorageBufferBindingSize)) {
      throw new RangeError('Canonical finite wall workspace exceeds device buffer limits');
    }
    const rawBuffer = isRealGpuDevice
      ? registerQueueOrderedPooledBufferReturn(
          acquireQueueOrderedPooledBuffer(device, { bucketKey: label, label, size, usage }),
          device,
          { bucketKey: label, size, usage }
        )
      : device.createBuffer({ label, size, usage });
    const buffer = tagWebGpuBufferDevice(rawBuffer, device);
    if (keep) {
      const hasOwnDestroy = Object.prototype.hasOwnProperty.call(buffer, 'destroy');
      const originalDestroy = hasOwnDestroy ? buffer.destroy : null;
      const destroyBuffer = buffer.destroy.bind(buffer);
      buffer.destroy = () => {
        if (!owner.destroyed || (buffer === owner.wallBuffer && !owner.wallRetired)) {
          throw new TypeError('Finite wall successor is retained by its thermal producer or private owner');
        }
        if (hasOwnDestroy) buffer.destroy = originalDestroy;
        else delete buffer.destroy;
        if (isRealGpuDevice) releaseOrDestroyQueueOrderedPooledBuffer(buffer);
        else destroyBuffer();
      };
    }
    (keep ? retained : transient).push(buffer); return buffer;
  };
  const cleanupTransient = () => {
    for (const buffer of transient.splice(0)) releaseOrDestroyQueueOrderedPooledBuffer(buffer);
  };
  const destroy = () => {
    if (owner.destroyed) return false;
    owner.destroyed = true; cleanupTransient();
    for (const buffer of retained.splice(0)) if (buffer !== owner.wallBuffer) buffer.destroy();
    owner.retireWall(); return true;
  };
  const prepare = (label, code, buffers, types, x, y = 1) => {
    const p = createCachedExplicitComputePipeline(device, { cacheKey: label, label, code, entryPoint: 'main',
      bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
    const group = createCachedExplicitBindGroup(device, {
      label: `${label}-bind-group`,
      layout: p.bindGroupLayout,
      entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } }))
    });
    return encoder => {
      const pass = encoder.beginComputePass({ label }); pass.setPipeline(p.pipeline);
      pass.setBindGroup(0, group); pass.dispatchWorkgroups(x, y); pass.end();
    };
  };
  try {
    const buffer = allocate('ulg-exact-finite-wall-candidate', SPH_FINITE_WALL_CANONICAL_WORDS * 4, 128 | 4 | 8, true);
    owner.wallBuffer = buffer;
    const packets = allocate('ulg-exact-finite-wall-packets', particleCount * 6 * W * 4, 128 | 8);
    const validationBuffer = allocate('ulg-exact-finite-wall-receipt', 32, 128 | 4 | 8, true);
    device.queue.writeBuffer(validationBuffer, 0, new Uint32Array([
      SPH_EXACT_FINITE_WALL_RECEIPT_MAGIC, 1, 0, particleCount, 0, 0, 0, 0
    ]));
    let input = packets, count = particleCount;
    const reductions = [];
    do {
      const groups = Math.ceil(count / 64);
      if (groups > device.limits.maxComputeWorkgroupsPerDimension) throw new RangeError('Finite wall reduction exceeds dispatch capacity');
      const output = allocate('ulg-exact-finite-wall-reduction', groups * 6 * W * 4, 128 | 4, groups === 1);
      const params = allocate('ulg-exact-finite-wall-reduction-params', 16, 64 | 8);
      device.queue.writeBuffer(params, 0, new Uint32Array([count, 0, 0, 0]));
      reductions.push(prepare('ulg-exact-finite-wall-reduce-v1', /* wgsl */ `${math}
@group(0) @binding(0) var<storage,read> input:array<u32>;
@group(0) @binding(1) var<storage,read_write> output:array<u32>;
@group(0) @binding(2) var<storage,read_write> receipt:array<atomic<u32>>;
@group(0) @binding(3) var<uniform> counts:vec4<u32>;
var<workgroup> sums:array<ExactMass,64>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>,
  @builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>) {
  var value=ExactMass();
  if(id.x<counts.x) {for(var w=0u;w<EM_WORDS;w++) {value.words[w]=input[(id.x*6u+id.y)*EM_WORDS+w];}}
  sums[lane]=value;workgroupBarrier();
  for(var stride=32u;stride>0u;stride>>=1u) {
    if(lane<stride) {let s=el_add(sums[lane],sums[lane+stride]);sums[lane]=s.value;
      if(s.error!=0u) {atomicOr(&receipt[2],2u);}}
    workgroupBarrier();
  }
  if(lane==0u) {for(var w=0u;w<EM_WORDS;w++) {output[(group.x*6u+group.y)*EM_WORDS+w]=sums[0].words[w];}}
}`, [input, output, validationBuffer, params], ['read-only-storage', 'storage', 'storage', 'uniform'], groups, 6));
      input = output; count = groups;
    } while (count > 1);
    const deltaBuffer = input;
    const update = prepare('ulg-exact-finite-wall-update-v1', /* wgsl */ `${math}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> delta:array<u32>;
@group(0) @binding(2) var<storage,read_write> wall:array<u32>;
@group(0) @binding(3) var<storage,read_write> receipt:array<atomic<u32>>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>) {
  let face=id.x;var errors=0u;
  if(source[24]!=0x46574c31u || (source[25]!=3u && source[25]!=4u)
    || source[118]!=${SPH_FINITE_WALL_CANONICAL_MAGIC}u || source[119]!=1u) {errors|=1u;}
  if(source[126]!=0u || source[12u+face]!=0u) {errors|=8u;}
  var energy=ExactMass();var packet=ExactMass();
  for(var w=0u;w<EM_WORDS;w++) {energy.words[w]=source[64u+face*EM_WORDS+w];packet.words[w]=delta[face*EM_WORDS+w];}
  let next=el_add(energy,packet);let view=el_project_f32_bits(next.value);
  if((next.error|view.error)!=0u) {errors|=2u;}
  let capacity=bitcast<f32>(source[6u+face]);let initial=bitcast<f32>(source[32u+face]);
  let total=bitcast<f32>(view.bits);let temperature=initial+total/capacity;
  if(!(capacity>0.0) || capacity>3.402823e38 || !(initial>=0.0) || initial>3.402823e38
    || !(temperature>=0.0) || temperature>3.402823e38 || source[26]==0xffffffffu) {errors|=4u;}
  atomicOr(&receipt[2],errors);
  if(errors==0u) {
    for(var w=0u;w<EM_WORDS;w++) {wall[64u+face*EM_WORDS+w]=next.value.words[w];}
    wall[face]=bitcast<u32>(temperature);wall[18u+face]=view.bits;
  }
  if(face==0u) {wall[25]=4u;wall[26]=source[26]+1u;atomicStore(&receipt[4],1u);}
}`, [read.buffer, deltaBuffer, buffer, validationBuffer],
    ['read-only-storage', 'read-only-storage', 'storage', 'storage'], 6);
    const record = Object.freeze({ device, instanceId: read.instanceId,
      originalBuffer: read.buffer, buffer, deltaBuffer, validationBuffer, particleCount });
    records.set(record, owner);
    return Object.freeze({ record, packets, encodedDispatchCount: reductions.length + 1,
      transfer() {
        validateSphExactFiniteWallRecord(record, device);
        if (owner.transferred) throw new TypeError('Finite wall successor was already adopted');
        owner.transferred = true; owner.privateLive = true;
        const nextState = Object.freeze({ instanceId: read.instanceId, buffer,
          encodeTemperatureCopy(encoder, paramsBuffer, byteOffset, faceCount = 6, firstFace = 0) {
            if (!owner.privateLive || owner.wallRetired) throw new TypeError('Private finite wall owner was retired');
            read.validate();
            encoder.copyBufferToBuffer(buffer, firstFace * 4, paramsBuffer, byteOffset, faceCount * 4);
          }
        });
        privateStates.set(nextState, owner);
        return Object.freeze({ state: nextState, destroy() {
          if (!owner.privateLive) return false;
          owner.privateLive = false; owner.retireWall(); return true;
        } });
      },
      encodeBefore(encoder) {
        validateSphExactFiniteWallRecord(record, device);
        encoder.copyBufferToBuffer(read.buffer, 0, buffer, 0, buffer.size);
        encoder.clearBuffer(packets);
      },
      encodeAfter(encoder) { for (const reduce of reductions) reduce(encoder); update(encoder); },
      cleanupTransient, destroy
    });
  } catch (error) { destroy(); throw error; }
}

// Recheck the retained successor at final admission. This catches late damage
// after thermal completion, including a one-quantum wall-energy discrepancy.
export function sphExactFiniteWallAdmissionWgsl() {
  return /* wgsl */ `${math}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> wall:array<u32>;
@group(0) @binding(2) var<storage,read> delta:array<u32>;
@group(0) @binding(3) var<storage,read> receipt:array<u32>;
@group(0) @binding(4) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(1) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let face=id.x;var errors=receipt[2];
  if(receipt[0]!=${SPH_EXACT_FINITE_WALL_RECEIPT_MAGIC}u || receipt[1]!=1u || receipt[4]!=1u
    || wall[24]!=source[24] || wall[25]!=4u || wall[26]!=source[26]+1u
    || wall[118]!=${SPH_FINITE_WALL_CANONICAL_MAGIC}u || wall[119]!=1u || wall[126]!=0u
    || wall[6u+face]!=source[6u+face] || wall[32u+face]!=source[32u+face] || wall[12u+face]!=0u) {errors|=16u;}
  var before=ExactMass();var after=ExactMass();var packet=ExactMass();
  for(var w=0u;w<EM_WORDS;w++) {before.words[w]=source[64u+face*EM_WORDS+w];
    after.words[w]=wall[64u+face*EM_WORDS+w];packet.words[w]=delta[face*EM_WORDS+w];}
  let expected=el_add(before,packet);let view=el_project_f32_bits(after);
  let temperature=bitcast<f32>(source[32u+face])+bitcast<f32>(view.bits)/bitcast<f32>(source[6u+face]);
  if((expected.error|view.error)!=0u || el_compare(expected.value,after)!=0
    || wall[face]!=bitcast<u32>(temperature) || wall[18u+face]!=view.bits) {errors|=32u;}
  if(errors!=0u) {atomicOr(&control[2],32768u);}
}`;
}
