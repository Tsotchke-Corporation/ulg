import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

const owners = new WeakMap();
const candidates = new WeakMap();
export const SPH_REACTION_LINEAGE_CAPACITY = 65536;
export const SPH_REACTION_LINEAGE_ROW_WORDS = 8;

export function borrowSphReactionLineage(device, lineage) {
  const owner = owners.get(lineage);
  if (!owner || owner.device !== device || !owner.privateLive || owner.retired) {
    throw new TypeError('Reaction lineage requires its original live private owner');
  }
  owner.borrows++;
  let live = true;
  return Object.freeze({ buffer: lineage.buffer,
    validate() {
      if (!live || owner.retired) throw new TypeError('Reaction lineage read was retired');
      return true;
    },
    release() {
      if (!live) return false;
      live = false; owner.borrows--; owner.retire(); return true;
    }
  });
}

export function validateSphReactionLineageCandidate(record, device) {
  const owner = candidates.get(record);
  if (!owner || owner.device !== device || owner.producerClosed || owner.retired) {
    throw new TypeError('Reaction lineage requires its genuine retained producer');
  }
  owner.sourceRead?.validate();
  return true;
}

/** A private append candidate, never the process-wide diagnostic log. The
 * final chain decision restores this complete record on rejection. */
export function prepareSphReactionLineageCandidate({ device, source = null }) {
  const sourceRead = source ? borrowSphReactionLineage(device, source) : null;
  const size = (SPH_REACTION_LINEAGE_CAPACITY + 1) * SPH_REACTION_LINEAGE_ROW_WORDS * 4;
  let beforeBuffer = sourceRead?.buffer ?? null, buffer = null;
  const owner = { device, sourceRead, producerClosed: false, privateLive: false,
    transferred: false, borrows: 0, retired: false, inputsReleased: false,
    releaseInputs() {
      if (this.inputsReleased) return;
      this.inputsReleased = true;
      if (sourceRead) sourceRead.release(); else beforeBuffer?.destroy();
    },
    retire() {
      if (!this.producerClosed || this.retired) return;
      if (this.privateLive || this.borrows) {
        this.releaseInputs();
        return;
      }
      this.retired = true; buffer?.destroy();
      this.releaseInputs();
    } };
  const destroy = () => {
    if (owner.producerClosed) return false;
    owner.producerClosed = true; owner.retire(); return true;
  };
  try {
    if (size > device.limits.maxBufferSize || size > device.limits.maxStorageBufferBindingSize) {
      throw new RangeError('Reaction lineage exceeds device storage capacity');
    }
    if (!beforeBuffer) beforeBuffer = tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-private-reaction-lineage-empty', size, usage: 128 | 4 | 8 }), device);
    buffer = tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-private-reaction-lineage', size, usage: 128 | 4 | 8 }), device);
    const rawDestroy = buffer.destroy.bind(buffer);
    buffer.destroy = () => {
      if (!owner.retired) throw new TypeError('Reaction lineage is retained by its producer or readers');
      rawDestroy();
    };
    const record = Object.freeze({ device, beforeBuffer, buffer,
      capacity: SPH_REACTION_LINEAGE_CAPACITY, rowWords: SPH_REACTION_LINEAGE_ROW_WORDS });
    candidates.set(record, owner);
    return Object.freeze({ record, destroy,
      encodeBefore(encoder) {
        validateSphReactionLineageCandidate(record, device);
        encoder.copyBufferToBuffer(beforeBuffer, 0, buffer, 0, size);
      },
      transfer() {
        validateSphReactionLineageCandidate(record, device);
        if (owner.transferred) throw new TypeError('Reaction lineage was already adopted');
        owner.transferred = true; owner.privateLive = true;
        const lineage = Object.freeze({ device, buffer, capacity: record.capacity, rowWords: record.rowWords });
        owners.set(lineage, owner);
        return Object.freeze({ lineage, destroy() {
          if (!owner.privateLive) return false;
          owner.privateLive = false; owner.retire(); return true;
        } });
      }
    });
  } catch (error) { destroy(); throw error; }
}

export function sphReactionLineageAdmissionWgsl() {
  return /* wgsl */ `
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> candidate:array<u32>;
@group(0) @binding(2) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;let capacity=${SPH_REACTION_LINEAGE_CAPACITY}u;
  if(row==0u && (source[0]>capacity || candidate[0]<source[0] || candidate[0]>capacity
    || source[1]!=0u || candidate[1]!=0u)) {atomicOr(&control[2],262144u);}
  if(row<min(source[0],capacity)) {
    for(var w=0u;w<8u;w++) {let at=8u+row*8u+w;
      if(candidate[at]!=source[at]) {atomicOr(&control[2],262144u);}}
  } else if(row<min(candidate[0],capacity)) {
    let at=8u+row*8u;let kind=candidate[at+1u];
    if((kind!=1u && kind!=2u) || candidate[at+7u]!=0u) {atomicOr(&control[2],262144u);}
  }
}`;
}
