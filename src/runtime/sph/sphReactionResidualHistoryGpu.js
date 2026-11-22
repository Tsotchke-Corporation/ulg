import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline,
  releaseQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { borrowSphReactionResidualLedger, SPH_REACTION_RESIDUAL_LEDGER_LAYOUT as emissionLayout }
  from './sphReactionResidualLedgerGpu.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { borrowSphReactionResidualTransport } from './sphReactionResidualTransportGpu.js';

const candidates=new WeakMap(), histories=new WeakMap(), historyReads=new WeakMap();
const residualHistoryScanPoolByDevice=new WeakMap();
const RESIDUAL_HISTORY_SCAN_POOL_LIMIT=8;
function acquirePooledResidualHistoryScan(device, scanCount) {
  let byCount = residualHistoryScanPoolByDevice.get(device);
  if (byCount) {
    const bucket = byCount.get(scanCount);
    if (bucket && bucket.length > 0) return bucket.pop();
  }
  return createWebGpuU32ExclusiveScan(device, {
    maxElementCount: scanCount,
    retainParamsBuffer: true,
    fixedElementCount: scanCount,
    label: 'ulg-reaction-residual-history-scan'
  });
}
function releasePooledResidualHistoryScan(device, scanCount, scan) {
  if (!scan) return;
  let byCount = residualHistoryScanPoolByDevice.get(device);
  if (!byCount) {
    byCount = new Map();
    residualHistoryScanPoolByDevice.set(device, byCount);
  }
  let bucket = byCount.get(scanCount);
  if (!bucket) {
    bucket = [];
    byCount.set(scanCount, bucket);
  }
  if (bucket.length < RESIDUAL_HISTORY_SCAN_POOL_LIMIT) {
    bucket.push(scan);
  } else {
    scan.destroy();
  }
}
let nextSeal=1;
const physicalOffset=Math.ceil(emissionLayout.rowWords/4)*4;
const historyRowWords=physicalOffset+52;
export const SPH_REACTION_RESIDUAL_HISTORY_LAYOUT=Object.freeze({
  ...emissionLayout,schema:'peercompute.ulg.reaction-residual-history.v2',version:2,headerWords:64,
  physicalOffset,stateOffset:physicalOffset,thermoOffset:physicalOffset+8,mechanicsOffset:physicalOffset+20,
  rowWords:historyRowWords,rowBytes:historyRowWords*4
});
const L=SPH_REACTION_RESIDUAL_HISTORY_LAYOUT;
export const SPH_REACTION_RESIDUAL_HISTORY_ERROR=1048576;
export const SPH_REACTION_RESIDUAL_HISTORY_TRANSPORT_REQUIRED=2097152;

export function borrowSphReactionResidualHistory(history,{device}={}) {
  const owner=histories.get(history);
  if(!owner || owner.device!==device || !owner.privateLive || owner.retired) {
    throw new TypeError('Residual history requires its original live private owner');
  }
  return retainHistoryRead(history,owner);
}

export function forkSphReactionResidualHistoryRead(read,{device}={}) {
  const owner=historyReads.get(read);
  if(!owner || owner.device!==device)throw new TypeError('Residual history fork requires its original retained read');
  read.validate();return retainHistoryRead(read.history,owner);
}

function retainHistoryRead(history,owner) {
  owner.readers++;let live=true;
  const read=Object.freeze({history,buffer:history.buffer,
    transportRecord:owner.emittedRead?null:owner.transportRead?.record??null,
    controlBuffer:owner.controlBuffer,
    validate(){if(!live || owner.retired)throw new TypeError('Residual history read is retired');return true;},
    release(){
      // The last reader may trigger retirement of an already closed producer.
      // Preserve idempotent reference accounting while retrying failed cleanup.
      if(!live){owner.retire();return false;}
      live=false;owner.readers--;owner.retire();return true;
    }
  });
  historyReads.set(read,owner);return read;
}

export function validateSphReactionResidualHistoryCandidate(record,device) {
  const owner=candidates.get(record);
  if(!owner || owner.device!==device || owner.closed || owner.retired) {
    throw new TypeError('Residual history requires its genuine retained producer');
  }
  owner.sourceRead?.validate();owner.emittedRead?.validate();owner.transportRead?.validate();return true;
}

const code=/* wgsl */ `
${createSphExactMassWgsl(L.format)}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> emitted:array<u32>;
@group(0) @binding(2) var<storage,read_write> flags:array<u32>;
@group(0) @binding(3) var<storage,read> prefix:array<u32>;
@group(0) @binding(4) var<storage,read_write> output:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
struct Params { shape:vec4<u32>, identity:vec4<u32>, emission:vec4<u32> };
@group(0) @binding(6) var<uniform> cfg:Params;
@group(0) @binding(7) var<storage,read> transported:array<u32>;
@group(0) @binding(8) var<storage,read> transport_control:array<u32>;
const HEAD:u32=${L.headerWords}u;
const ROW:u32=${L.rowWords}u;
const EMIT_HEAD:u32=${emissionLayout.headerWords}u;
const EMIT_ROW:u32=${emissionLayout.rowWords}u;
const MAGIC:u32=0x50484731u;
fn fail(){atomicOr(&control[2],${SPH_REACTION_RESIDUAL_HISTORY_ERROR}u);}
fn source_count()->u32 {
  if(cfg.shape.w==0u){return 0u;}
  return min(source[3],cfg.shape.y);
}
fn emitted_slots()->u32 {
  if(cfg.emission.y==0u){return 0u;}
  return min(emitted[3],cfg.shape.z);
}
fn count_valid(count:u32,capacity:u32,stride:u32,generation:u32,seal:u32,kind:u32)->bool {
  if(kind==0u) {
    return source[0]==MAGIC && source[1]==${L.version}u && source[2]==1u && count<=capacity
      && source[4]==capacity && source[5]==stride && source[6]==generation && source[7]==seal
      && source[8]==(count+63u)/64u && source[9]==1u && source[10]==1u && source[11]==0u;
  }
  return output[0]==MAGIC && output[1]==${L.version}u && output[2]==1u && count<=capacity
    && output[4]==capacity && output[5]==stride && output[6]==generation && output[7]==seal
    && output[8]==(count+63u)/64u && output[9]==1u && output[10]==1u && output[11]==0u;
}
fn write_count(count:u32) {
  output[0]=MAGIC;output[1]=${L.version}u;output[2]=1u;output[3]=count;
  output[4]=cfg.shape.x;output[5]=ROW/4u;output[6]=cfg.identity.z;output[7]=cfg.identity.w;
  output[8]=(count+63u)/64u;output[9]=1u;output[10]=1u;output[11]=0u;
}
fn row_word(kind:u32,row:u32,word:u32)->u32 {
  if(kind==0u){return source[HEAD+row*ROW+word];}
  if(word>=EMIT_ROW){return 0u;}
  return emitted[EMIT_HEAD+row*EMIT_ROW+word];
}
fn prior_word(row:u32,word:u32)->u32 {
  if(cfg.emission.w!=0u){return transported[HEAD+row*ROW+word];}
  return source[HEAD+row*ROW+word];
}
fn row_mass(kind:u32,row:u32)->ExactMass {
  var m=ExactMass();for(var w=0u;w<EM_WORDS;w++){m.words[w]=row_word(kind,row,${L.massOffset}u+w);}return m;
}
// The original product-event producer already resolved the material/phase
// constitutive law. Initialize the ordinary 8/12/32-word particle ABI once;
// subsequent histories copy its evolving F/APIC state without resetting it.
// These are physical f32 views of the declared heat-proxy route. M/U/S remain
// the independent integer authority and are never reconstructed from this view.
fn initial_physical(row:u32)->array<u32,52> {
  var p:array<u32,52>;
  for(var axis=0u;axis<3u;axis++) {
    p[axis]=row_word(1u,row,axis);p[4u+axis]=row_word(1u,row,20u+axis);
  }
  p[3]=row_word(1u,row,3u);p[7]=row_word(1u,row,19u);
  p[8]=row_word(1u,row,4u);p[9]=row_word(1u,row,11u);
  p[10]=row_word(1u,row,16u);p[11]=row_word(1u,row,17u);
  let phase=bitcast<f32>(p[9]);
  for(var i=0u;i<4u;i++){p[12u+i]=select(0u,0x3f800000u,phase==f32(i+1u));}
  let volume=bitcast<f32>(row_word(1u,row,23u));
  let radius=pow(volume*0.238732414637843,1.0/3.0);
  p[16]=bitcast<u32>(radius);p[19]=p[16];
  // WebGPU need not produce IEEE infinity on overflow. Bound this physical
  // projection before multiplication, instead of relying on a post-hoc NaN
  // or infinity test to catch an unrepresentable entity count.
  let moles=bitcast<f32>(row_word(1u,row,9u));
  if(moles>0.0 && moles<=3.402823e38/6.02214076e23){p[17]=bitcast<u32>(moles*6.02214076e23);}
  p[18]=row_word(1u,row,18u);
  p[20]=0x3f800000u;p[24]=0x3f800000u;p[28]=0x3f800000u;p[38]=0x3f800000u;
  p[39]=row_word(1u,row,23u);p[40]=row_word(1u,row,29u);p[41]=row_word(1u,row,30u);
  for(var i=0u;i<5u;i++){p[42u+i]=row_word(1u,row,24u+i);}
  p[47]=p[41];p[51]=p[3];return p;
}
fn physical_valid(p:array<u32,52>,mass_bits:u32)->bool {
  for(var i=0u;i<52u;i++){if((p[i]&0x7f800000u)==0x7f800000u){return false;}}
  let phase=bitcast<f32>(p[9]);
  return p[3]==mass_bits && bitcast<f32>(p[8])>=0.0 && floor(bitcast<f32>(p[8]))==bitcast<f32>(p[8])
    && phase>=1.0 && phase<=4.0 && floor(phase)==phase
    && bitcast<f32>(p[10])>0.0 && bitcast<f32>(p[11])>0.0
    && bitcast<f32>(p[16])>0.0 && bitcast<f32>(p[17])>0.0 && p[18]==0x3f800000u
    && bitcast<f32>(p[19])>0.0 && bitcast<f32>(p[38])>0.0 && bitcast<f32>(p[39])>0.0
    && (p[40]==0u || p[40]==0x3f800000u) && p[41]==0x3f800000u && p[47]==0x3f800000u
    && bitcast<f32>(p[42])>=0.0 && bitcast<f32>(p[43])>=0.0 && bitcast<f32>(p[45])>=0.0
    && bitcast<f32>(p[51])>0.0;
}
fn populated_valid(kind:u32,row:u32,m:ExactMass)->bool {
  let projected=em_project_f32_bits(m);
  var physical:array<u32,52>;
  if(kind==0u){for(var i=0u;i<52u;i++){physical[i]=row_word(0u,row,${L.physicalOffset}u+i);}}
  else{physical=initial_physical(row);}
  return physical_valid(physical,projected.bits) && !em_zero(m) && projected.error==0u && projected.bits!=0u
    && row_word(kind,row,3u)==projected.bits && row_word(kind,row,13u)==projected.bits
    && row_word(kind,row,12u)==0u && bitcast<f32>(row_word(kind,row,31u))==6.0;
}
@compute @workgroup_size(1) fn initialize() {
  write_count(0u);
  if(cfg.shape.w!=0u && !count_valid(source[3],cfg.shape.y,ROW/4u,cfg.identity.x,cfg.identity.y,0u)){fail();}
  if(cfg.emission.w!=0u){
    atomicOr(&control[2],transport_control[2]);
    if(transport_control[0]!=0x52545031u || transport_control[1]!=1u || transport_control[3]!=3u
      || transport_control[5]!=cfg.shape.y || transport_control[6]!=source[3]
      || transport_control[7]!=cfg.identity.x || transport_control[8]!=cfg.identity.y){fail();}
    for(var w=0u;w<HEAD;w++){if(transported[w]!=source[w]){fail();}}
  }
  if(cfg.emission.y!=0u && (emitted[0]!=0x52484c31u || emitted[1]!=1u || emitted[2]!=cfg.shape.z
    || emitted[3]>cfg.shape.z || emitted[4]>emitted[3] || emitted[5]!=0u || emitted[7]!=cfg.emission.x
    || (emitted[6]!=1u && emitted[6]!=2u) || (emitted[6]!=1u && (emitted[3]!=0u || emitted[4]!=0u)))){fail();}
}
@compute @workgroup_size(64) fn mark_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row<cfg.emission.z) {
    flags[row]=0u;
    if(row<cfg.shape.z && cfg.emission.y!=0u) {
      let m=row_mass(1u,row);
      if(!em_zero(m)) {
        if(row>=emitted_slots() || !populated_valid(1u,row,m)){fail();}
        else {flags[row]=1u;}
      } else {
        for(var w=0u;w<ROW;w++){if(row_word(1u,row,w)!=0u){fail();}}
      }
    }
  }
  if(row<source_count() && !populated_valid(0u,row,row_mass(0u,row))){fail();}
}
@compute @workgroup_size(1) fn decide() {
  let last=cfg.emission.z-1u;
  let appended=prefix[last]+flags[last];
  if(cfg.emission.y!=0u && appended!=emitted[4]){fail();}
  let total=source_count()+appended;
  if(total>cfg.shape.x){fail();}
  if(atomicLoad(&control[2])==0u){write_count(total);}else{write_count(source_count());}
}
@compute @workgroup_size(64) fn scatter(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;let prior=source_count();
  if(row<prior){for(var w=0u;w<ROW;w++){output[HEAD+row*ROW+w]=prior_word(row,w);}}
  if(atomicLoad(&control[2])==0u && row<cfg.emission.z && flags[row]!=0u) {
    let dest=prior+prefix[row];
    for(var w=0u;w<${L.physicalOffset}u;w++){output[HEAD+dest*ROW+w]=row_word(1u,row,w);}
    let physical=initial_physical(row);
    for(var w=0u;w<52u;w++){output[HEAD+dest*ROW+${L.physicalOffset}u+w]=physical[w];}
  }
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row==0u && !count_valid(output[3],cfg.shape.x,ROW/4u,cfg.identity.z,cfg.identity.w,1u)){fail();}
  if(atomicLoad(&control[2])!=0u){return;}
  let prior=source_count();
  // Header shape alone cannot detect a lost or invented row within the same
  // dispatch group. Bind the live count to the original prefix and scan sum.
  if(row==0u && output[3]!=prior+prefix[cfg.emission.z-1u]+flags[cfg.emission.z-1u]){fail();}
  if(row<prior){for(var w=0u;w<ROW;w++){if(output[HEAD+row*ROW+w]!=prior_word(row,w)){fail();}}}
  if(row<cfg.emission.z && flags[row]!=0u) {
    let dest=prior+prefix[row];
    if(dest>=min(output[3],cfg.shape.x)){fail();return;}
    for(var w=0u;w<${L.physicalOffset}u;w++){if(output[HEAD+dest*ROW+w]!=row_word(1u,row,w)){fail();}}
    let physical=initial_physical(row);
    for(var w=0u;w<52u;w++){if(output[HEAD+dest*ROW+${L.physicalOffset}u+w]!=physical[w]){fail();}}
  }
}
// This gate stays in the actual chain until native P2G/G2P consumes history.
@compute @workgroup_size(1) fn require_empty() {
  if(source_count()!=0u || output[3]!=0u){atomicOr(&control[2],${SPH_REACTION_RESIDUAL_HISTORY_TRANSPORT_REQUIRED}u);}
}
@compute @workgroup_size(64) fn restore_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(atomicLoad(&control[2])==0u || row>=cfg.shape.x){return;}
  for(var w=0u;w<ROW;w++) {
    var value=0u;if(row<source_count()){value=source[HEAD+row*ROW+w];}
    output[HEAD+row*ROW+w]=value;
  }
}
@compute @workgroup_size(1) fn restore_count() {
  if(atomicLoad(&control[2])!=0u){write_count(source_count());}
}`;

/** Stable parallel compaction into a bounded private history. The predecessor
 * stays immutable, and every physical/count/quantity row rolls back together.
 * This numeric owner does not authorize native transport or public admission. */
export function prepareSphReactionResidualHistory({device,source=null,emitted=null,transported=null,capacity=null,controlBuffer}) {
  if(transported && !source)throw new TypeError('Residual transport requires its original history');
  if(!source && !emitted)return null;
  let sourceRead=null,emittedRead=null,transportRead=null,scan=null,buffer=null,scanCountForPool=0;
  const useQueueOrderedPool = Boolean(
    typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const resources=new Set(),retainedResources=new Set(),destroyed=new Set(),poolMeta=new Map();
  const retireScan=()=>{
    if(!scan)return;
    const heldScan=scan;scan=null;
    if(useQueueOrderedPool && scanCountForPool>0) releasePooledResidualHistoryScan(device,scanCountForPool,heldScan);
    else heldScan.destroy();
  };
  const owner={device,closed:false,privateLive:false,retired:false,retiring:false,producerStageRetired:false,readers:0,
    sourceRead:null,emittedRead:null,transportRead:null,controlBuffer:null,
    releaseProducerStage() {
      if(!this.closed || this.producerStageRetired || this.retired || this.retiring)return;
      this.retiring=true;const errors=[];
      for(const resource of resources) {
        if(retainedResources.has(resource) || destroyed.has(resource))continue;
        try{resource.destroy();destroyed.add(resource);}catch(error){errors.push(error);}
      }
      this.retiring=false;
      if(errors.length)throw new AggregateError(errors,'Residual history retirement failed');
      this.producerStageRetired=true;
      retireScan();
      sourceRead?.release();emittedRead?.release();
    },
    retire() {
      if(!this.closed || this.retired || this.retiring)return;
      if(this.privateLive || this.readers) {
        this.releaseProducerStage();
        return;
      }
      this.retiring=true;const errors=[];
      for(const resource of resources) {
        if(destroyed.has(resource))continue;
        try{resource.destroy();destroyed.add(resource);}catch(error){errors.push(error);}
      }
      this.retiring=false;
      if(errors.length)throw new AggregateError(errors,'Residual history retirement failed');
      this.producerStageRetired=true;
      retireScan();
      sourceRead?.release();emittedRead?.release();transportRead?.release();this.retired=true;
    }};
  const destroy=()=>{const first=!owner.closed;owner.closed=true;owner.retire();return first;};
  const own=(resource, meta = null)=>{
    resources.add(resource);
    if(meta) poolMeta.set(resource, meta);
    const raw=resource.destroy.bind(resource);
    resource.destroy=()=>{
      if(destroyed.has(resource))return;
      if(!owner.retiring)throw new TypeError('Residual history storage is retained');
      const spec = poolMeta.get(resource);
      if (spec) {
        resource.destroy = raw;
        releaseQueueOrderedPooledBuffer(device, resource, spec);
      } else {
        raw();
      }
      destroyed.add(resource);
    };return resource;
  };
  const allocate=(label,size,usage)=>{
    if (useQueueOrderedPool) {
      const spec = { bucketKey: label, size, usage };
      const buf = tagWebGpuBufferDevice(
        acquireQueueOrderedPooledBuffer(device, { bucketKey: label, label, size, usage }),
        device
      );
      return own(buf, spec);
    }
    return own(tagWebGpuBufferDevice(device.createBuffer({label,size,usage}),device));
  };
  try {
    transportRead=transported?borrowSphReactionResidualTransport(transported,{device,source}):null;
    sourceRead=transportRead?transportRead.forkSourceRead():source?borrowSphReactionResidualHistory(source,{device}):null;
    emittedRead=emitted?borrowSphReactionResidualLedger(emitted,{device}):null;
    owner.sourceRead=sourceRead;owner.emittedRead=emittedRead;owner.transportRead=transportRead;
    const maxRows=Math.floor((Math.min(device.limits.maxBufferSize,device.limits.maxStorageBufferBindingSize)-L.headerWords*4)/L.rowBytes);
    const rows=capacity??source?.capacity??Math.min(maxRows,Math.max(64,(emitted?.capacity??0)*8));
    const emittedCapacity=emitted?.capacity??0,scanCount=Math.max(1,emittedCapacity);
    const generation=(source?.generation??0)+1,seal=nextSeal++;
    if(!Number.isSafeInteger(rows) || rows<1 || rows>maxRows || rows<(source?.capacity??0)
      || generation>0xffffffff || !Number.isSafeInteger(seal) || seal>0xffffffff
      || Math.ceil(Math.max(rows,source?.capacity??0,scanCount)/64)>device.limits.maxComputeWorkgroupsPerDimension
      || webGpuBufferDevice(controlBuffer)!==device || controlBuffer.size<12 || (controlBuffer.usage&128)===0) {
      throw new RangeError('Residual history requires bounded same-device storage and count identities');
    }
    buffer=allocate('ulg-reaction-residual-history',(L.headerWords+rows*L.rowWords)*4,128|4|8);
    retainedResources.add(buffer);
    // A transported successor outlives the interval's caller-owned control.
    // Retain the finalized verdict with the history's own storage lifetime.
    if(transportRead){
      owner.controlBuffer=allocate('ulg-reaction-residual-history-verdict',12,128|4|8);
      retainedResources.add(owner.controlBuffer);
    }
    const flags=allocate('ulg-reaction-residual-live-flags',scanCount*4,128|4|8);
    const prefix=allocate('ulg-reaction-residual-live-prefix',scanCount*4,128|4|8);
    const params=allocate('ulg-reaction-residual-history-identities',48,64|8);
    device.queue.writeBuffer(params,0,new Uint32Array([rows,source?.capacity??0,emittedCapacity,source?1:0,
      source?.generation??0,source?.seal??0,generation,seal,emitted?.generation??0,emitted?1:0,scanCount,transportRead?1:0]));
    scanCountForPool=scanCount;
    if(useQueueOrderedPool) {
      scan=acquirePooledResidualHistoryScan(device,scanCount);
    } else {
      scan=createWebGpuU32ExclusiveScan(device,{maxElementCount:scanCount,retainParamsBuffer:true,fixedElementCount:scanCount,
        label:'ulg-reaction-residual-history-scan'});
      for(const {buffer:b}of scan.allocationEntries())own(b);
    }
    const record=Object.freeze({device,buffer,layout:L,capacity:rows,generation,seal,
      beforeBuffer:sourceRead?.buffer??null,beforeCapacity:source?.capacity??0,
      beforeGeneration:source?.generation??0,beforeSeal:source?.seal??0,
      physicalPublicationAdmitted:false});
    candidates.set(record,owner);
    const types=['read-only-storage','read-only-storage','storage','read-only-storage','storage','storage','uniform',
      'read-only-storage','read-only-storage'];
    const fallback=sourceRead?.buffer??emittedRead.buffer;
    const bindings=[fallback,emittedRead?.buffer??sourceRead.buffer,flags,prefix,buffer,controlBuffer,params,
      transported?.buffer??fallback,transported?.controlBuffer??fallback];
    const passes=Object.fromEntries(['initialize','mark_rows','decide','scatter','check','require_empty','restore_rows','restore_count'].map(entryPoint=>{
      const p=createCachedExplicitComputePipeline(device,{code,entryPoint,label:`ulg-residual-history-${entryPoint}`,
        cacheKey:`ulg-residual-history-v${L.version}-${entryPoint}`,bindings:types.map((type,binding)=>computeBufferBinding(binding,type))});
      const group=createCachedExplicitBindGroup(device,{layout:p.bindGroupLayout,entries:bindings.map((b,binding)=>({binding,resource:{buffer:b}}))});
      return[entryPoint,(encoder,count)=>{const pass=encoder.beginComputePass();pass.setPipeline(p.pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(count);pass.end();}];
    }));
    const groups=Math.ceil(Math.max(source?.capacity??0,scanCount)/64);
    let encoded=false,finalized=false,transferred=false;
    const validate=()=>validateSphReactionResidualHistoryCandidate(record,device);
    const requireEncoded=()=>{validate();if(!encoded)throw new TypeError('Residual history was not encoded');};
    return Object.freeze({record,destroy,
      encode(encoder){
        validate();if(encoded)throw new TypeError('Residual history must be encoded once');
        if(useQueueOrderedPool) {
          encoder.clearBuffer(buffer);
          encoder.clearBuffer(flags);
          encoder.clearBuffer(prefix);
          if(owner.controlBuffer) encoder.clearBuffer(owner.controlBuffer);
        }
        passes.initialize(encoder,1);passes.mark_rows(encoder,groups);
        const prepared=scan.encode(encoder,{inputBuffer:flags,outputBuffer:prefix,elementCount:scanCount});
        scan.releasePreparedQueueOrdered(prepared);
        passes.decide(encoder,1);passes.scatter(encoder,groups);encoded=true;
      },
      check(encoder){requireEncoded();passes.check(encoder,groups);},
      requireEmptyForMechanics(encoder){requireEncoded();passes.require_empty(encoder,1);},
      restore(encoder){requireEncoded();if(finalized)throw new TypeError('Residual history was already finalized');
        passes.restore_rows(encoder,Math.ceil(rows/64));passes.restore_count(encoder,1);
        if(owner.controlBuffer)encoder.copyBufferToBuffer(controlBuffer,0,owner.controlBuffer,0,12);
        finalized=true;},
      transfer(){
        requireEncoded();if(!finalized || transferred)throw new TypeError('Residual history requires one finalized handover');
        transferred=true;owner.privateLive=true;
        const history=Object.freeze({device,buffer,layout:L,capacity:rows,generation,seal});histories.set(history,owner);
        return Object.freeze({history,destroy(){const first=owner.privateLive;owner.privateLive=false;owner.retire();return first;}});
      }
    });
  }catch(error){destroy();throw error;}
}
