import { createSchroederSpatialChainVolumeWgsl, createSchroederSpatialChainVolumeAdjointWgsl } from '../../../ulg-gpu-abi/src/schroederSpatialChainVolumeWgsl.js';
import { SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS } from '../../../ulg-gpu-abi/src/schroederSpatialScaleAtlas.js';
import { validateSchroederSpatialParentFieldViewDescriptor } from '../../../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import { ownsSchroederSpatialEpochGenerationConsumerLease,
  resolveSchroederSpatialEpochGenerationConsumerExecution } from './schroederSpatialEpochGpu.js';
import { tagWebGpuBufferDevice, webGpuBufferMatchesDevice } from './sphGpuDeviceIdentity.js';
import {
  unwrapWebGpuCacheDevice,
  createCachedExplicitBindGroup
} from '../webgpuComputeLayout.js';

const IDENTITY = ['generationId','deviceOrdinal','laneOrdinal','leaseToken','sourceFamilyId',
  'storageGeneration','physicsTick','physicsSubstep','positionEpoch','topologyEpoch','chartEpoch','levelEpoch','supportEpoch'];
const ROW_OFFSET_WORDS = 64;
const chainVolumePipelinesByDevice = new WeakMap();

function sharedChainVolumePipelines(device, phaseMoments) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let entry = chainVolumePipelinesByDevice.get(keyDevice);
  const key = phaseMoments ? 'phaseMoments' : 'scalar';
  if (entry?.[key]) return entry[key];
  const bundle = (code, types, names) => {
    const module = device.createShaderModule({ code });
    const layout = device.createBindGroupLayout({
      entries: types.map((type, binding) => ({ binding, visibility: 4, buffer: { type } }))
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    return {
      layout,
      pipelines: names.map(entryPoint => device.createComputePipeline({
        layout: pipelineLayout, compute: { module, entryPoint }
      }))
    };
  };
  const compiled = Object.freeze({
    up: bundle(createSchroederSpatialChainVolumeWgsl({ phaseMoments }),
      [...Array(6).fill('read-only-storage'), 'storage', 'uniform'],
      ['initialize_volume', 'restrict_volume', 'seal_volume']),
    down: bundle(createSchroederSpatialChainVolumeAdjointWgsl({ phaseMoments }),
      [...Array(3).fill('read-only-storage'), ...Array(3).fill('storage'), 'uniform'],
      ['initialize_adjoint', 'pullback', 'seal_adjoint'])
  });
  if (!entry) {
    entry = Object.create(null);
    chainVolumePipelinesByDevice.set(keyDevice, entry);
  }
  entry[key] = compiled;
  return compiled;
}

// Derived linear operators only. This object does not grant EOS, pressure,
// native-state mutation or publication authority. The caller retains its
// generation lease through submission and the final consumer fence.
export function createSchroederSpatialChainVolumeGpu(device, {
  parentFieldCapacities, nativeFieldCapacities, arenaCount = 2, retirementOwner = null, phaseMoments = false
} = {}) {
  if (typeof phaseMoments !== 'boolean') throw new TypeError('Chain phase moments require an explicit boolean');
  const rowStrideWords = phaseMoments ? 4 : 1;
  if (!Array.isArray(nativeFieldCapacities) || nativeFieldCapacities.length < 2
    || nativeFieldCapacities.length > SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS || !Array.isArray(parentFieldCapacities)
    || parentFieldCapacities.length !== nativeFieldCapacities.length - 1
    || [...nativeFieldCapacities,...parentFieldCapacities].some(n => !Number.isSafeInteger(n) || n < 1)
    || !Number.isInteger(arenaCount) || arenaCount < 1 || arenaCount > 8) {
    throw new RangeError('Chain volume requires exact bounded native and parent capacities');
  }
  const parents = [...parentFieldCapacities], natives = [...nativeFieldCapacities];
  const limit = Math.min(device.limits?.maxStorageBufferBindingSize ?? 134217728,
    device.limits?.maxBufferSize ?? 268435456);
  if ((device.limits?.maxStorageBuffersPerShaderStage ?? 8) < 7
    || [...parents,...natives].some(n => (64+n*rowStrideWords)*4 > limit)) {
    throw new RangeError('Chain volume exceeds device storage limits');
  }
  const { up, down } = sharedChainVolumePipelines(device, phaseMoments);
  const allocated = [];
  const destroyedBuffers = new Set();
  const destroyBuffer = b => {if(!destroyedBuffers.has(b)){destroyedBuffers.add(b);b.destroy();}};
  const allocate = (size, usage = 140) => {
    const b = device.createBuffer({size,usage,label:'ulg-chain-volume'});
    allocated.push(b);return tagWebGpuBufferDevice(b,device);
  };
  let arenas;
  try {
    arenas = Array.from({length:arenaCount},()=>({owner:null,control:allocate(64),
      up:parents.map(n=>allocate((64+n*rowStrideWords)*4)),
      down:parents.map((_,i)=>allocate((64+(i ? parents[i-1] : natives[0])*rowStrideWords)*4)),
      native:natives.slice(1).map(n=>allocate((64+n*rowStrideWords)*4)),
      params:parents.map(()=>allocate(128,72)),adjointParams:parents.map(()=>allocate(128,72))}));
  } catch(error) { allocated.forEach(destroyBuffer);throw error; }
  let serial=0,destroyed=false;
  const owners=new WeakMap();
  function snapshot(lease) {
    const generation=lease?.generation;
    if(!ownsSchroederSpatialEpochGenerationConsumerLease(lease,generation)
      || generation.ready!==true || generation.selected!==true) throw new TypeError('Chain volume requires a live original generation lease');
    const originalExecution=resolveSchroederSpatialEpochGenerationConsumerExecution(lease,device);
    const levels=generation.mechanicsLevelViews, pairs=generation.mechanicsAdjacentLevelPairs;
    if(!Array.isArray(levels) || levels.length!==natives.length || !Array.isArray(pairs)
      || pairs.length!==parents.length) throw new TypeError('Chain volume requires every original adjacent pair');
    const moments=levels.map(x=>x.phaseVolumeMoment);
    for(const [i,m] of moments.entries()) {
      const field=levels[i].mechanicsFieldView;
      if(!m || m.ownerRuntime?.ownsExecution(m)!==true || m.released || m.releaseScheduled
        || m.submitPerformed!==true || m.mechanicsFieldView!==field || m.fieldCapacity!==natives[i]
        || m.spatialExecution!==originalExecution || field.spatialExecution!==originalExecution
        || m.selectedLevel!==levels[i].selectedLevel || field.ownerRuntime?.ownsExecution(field)!==true
        || !webGpuBufferMatchesDevice(m.controlBuffer,device) || !webGpuBufferMatchesDevice(m.momentBuffer,device)
        || IDENTITY.some(k=>m[k]!==moments[0][k])) throw new TypeError('Chain volume moment provenance changed');
    }
    const topology=pairs.map((pair,i)=>{
      const t=pair.parentFieldView;
      if(validateSchroederSpatialParentFieldViewDescriptor(t).admitted!==true
        || t.ownerRuntime?.ownsExecution(t)!==true || t.parentFieldCapacity!==parents[i]
        || t.fineFieldView!==levels[i].mechanicsFieldView || t.coarseFieldView!==levels[i+1].mechanicsFieldView
        || t.inheritedFineParentView!==(i ? pairs[i-1].parentFieldView : null)
        || t.fineLevel!==levels[i].selectedLevel || t.coarseLevel!==levels[i+1].selectedLevel
        || t.coarseLevel!==t.fineLevel+1
        || Math.fround(t.coarseGrid.gridSpacingM)!==Math.fround(t.fineGrid.gridSpacingM*2)
        || !webGpuBufferMatchesDevice(t.parentFieldViewBuffer,device)
        || IDENTITY.some(k=>t[k]!==moments[0][k])) throw new TypeError('Chain volume adjacent topology provenance changed');
      return t;
    });
    const identity=Object.freeze(IDENTITY.map(k=>moments[0][k]));
    const ordinals=Object.freeze([...moments,...topology].map(x=>x.completionOrdinal));
    return {generation,moments,topology,identity,ordinals};
  }
  function live(execution) {
    const owner=owners.get(execution);
    if(destroyed || !owner || owner.arena.owner!==owner || owner.released) return false;
    try {
      const current=snapshot(owner.lease);
      return current.generation===owner.source.generation
        && current.identity.every((v,i)=>Object.is(v,owner.source.identity[i]))
        && current.ordinals.every((v,i)=>Object.is(v,owner.source.ordinals[i]))
        && current.moments.every((m,i)=>m===owner.source.moments[i]
          && m.controlBuffer===owner.controls[i] && m.momentBuffer===owner.rows[i])
        && current.topology.every((t,i)=>t===owner.source.topology[i] && t.parentFieldViewBuffer===owner.topologyBuffers[i]);
    } catch{return false;}
  }
  function bind(encoder,b,resources,count,indirect=null) {
    const group=createCachedExplicitBindGroup(device,{label:'ulg-chain-volume-bg',layout:b.layout,entries:resources.map((buffer,binding)=>({binding,resource:{buffer}}))});
    const pass=encoder.beginComputePass();pass.setBindGroup(0,group);
    pass.setPipeline(b.pipelines[0]);pass.dispatchWorkgroups(1);
    pass.setPipeline(b.pipelines[1]);
    if(indirect)pass.dispatchWorkgroupsIndirect(indirect,240);
    else {
      const groups=Math.ceil(count/64),max=device.limits?.maxComputeWorkgroupsPerDimension ?? 65535;
      pass.dispatchWorkgroups(Math.min(groups,max),Math.ceil(groups/max));
    }
    pass.setPipeline(b.pipelines[2]);pass.dispatchWorkgroups(1);pass.end();
  }
  function encode(encoder,{generationReadFamily}={}) {
    if(destroyed || !encoder?.beginComputePass || !encoder.clearBuffer) throw new TypeError('Chain volume requires a live caller encoder');
    const source=snapshot(generationReadFamily),arena=arenas.find(a=>a.owner==null && !a.retired);
    if(!arena)throw new Error('Chain volume arena backpressure');
    if(serial===0xffffffff)throw new RangeError('Chain volume serial exhausted');
    const ordinal=++serial;
    const owner={arena,source,lease:generationReadFamily,ordinal,released:false,submitted:false,pullback:false,
      controls:source.moments.map(m=>m.controlBuffer),rows:source.moments.map(m=>m.momentBuffer),
      topologyBuffers:source.topology.map(t=>t.parentFieldViewBuffer)};
    const execution=Object.freeze({schema:phaseMoments
        ? 'peercompute.ulg.schroeder-spatial-chain-phase-moments.v1'
        : 'peercompute.ulg.schroeder-spatial-chain-volume.v1',
      generation:source.generation,completionOrdinal:ordinal,phaseMoments,rowStrideWords,
      coarseVolumeBuffer:phaseMoments ? null : arena.up.at(-1),
      coarsePhaseMomentBuffer:phaseMoments ? arena.up.at(-1) : null,
      volumeBuffers:phaseMoments ? null : Object.freeze([...arena.up]),
      phaseMomentBuffers:phaseMoments ? Object.freeze([...arena.up]) : null,
      nativeAdjointBuffers:Object.freeze([arena.down[0],...arena.native]),
      controlBuffer:arena.control,rowOffsetWords:ROW_OFFSET_WORDS,publicationAuthority:false,
      get released(){return owner.released;}});
    arena.owner=owner;owners.set(execution,owner);
    try {
      encoder.clearBuffer(arena.control);
      source.topology.forEach((t,i)=>{
        const data=new Uint32Array(32);
        data.set([i ? 1:0,parents[i],ordinal,t.completionOrdinal,
          i ? source.topology[i-1].completionOrdinal : source.moments[0].completionOrdinal,
          source.moments[i+1].completionOrdinal,i ? parents[i-1] : natives[0],natives[i+1]]);
        data.set(IDENTITY.map(k=>t[k]),8);data.set([t.coarseLevel,t.fineLevel],21);
        device.queue.writeBuffer(arena.params[i],0,data);encoder.clearBuffer(arena.up[i]);
        bind(encoder,up,[owner.topologyBuffers[i],i ? owner.topologyBuffers[i-1] : owner.rows[0],
          i ? arena.up[i-1] : owner.controls[0],i ? arena.up[i-1] : owner.rows[0],
          owner.controls[i+1],owner.rows[i+1],arena.up[i],arena.params[i]],parents[i],owner.topologyBuffers[i]);
      });
      return execution;
    }catch(error){error.chainVolumeExecution=execution;throw error;}
  }
  function encodePullback(encoder,execution,{coarseValuesBuffer,offsetWords=0,coarseRecord=false,ownerToken=null}={}) {
    if(!live(execution))throw new TypeError('Chain volume execution is foreign or stale');
    const owner=owners.get(execution),{arena,source}=owner;
    if(owner.pullback || (owner.submitted && (retirementOwner==null || ownerToken!==retirementOwner))
      || (coarseRecord && offsetWords!==64) || !Number.isSafeInteger(offsetWords) || offsetWords<0
      || !webGpuBufferMatchesDevice(coarseValuesBuffer,device)
      || coarseValuesBuffer.size<(offsetWords+parents.at(-1)*rowStrideWords)*4
      || allocated.includes(coarseValuesBuffer))throw new TypeError('Chain adjoint requires one separate bounded coarse scalar input');
    owner.pullback=true;
    for(let i=parents.length-1;i>=0;i--){
      const t=source.topology[i],data=new Uint32Array(32);
      data.set([i ? 1:0,parents[i],owner.ordinal,t.completionOrdinal]);
      data[24]=i===parents.length-1 ? offsetWords : 64;data[25]=Number(i===parents.length-1 && !coarseRecord);
      device.queue.writeBuffer(arena.adjointParams[i],0,data);
      encoder.clearBuffer(arena.down[i]);encoder.clearBuffer(arena.native[i]);
      bind(encoder,down,[owner.topologyBuffers[i],arena.up[i],
        i===parents.length-1 ? coarseValuesBuffer : arena.down[i+1],
        arena.down[i],arena.native[i],arena.control,arena.adjointParams[i]],
        Math.max(i ? parents[i-1] : natives[0],natives[i+1]));
    }
    return execution;
  }
  return Object.freeze({encode,encodePullback,ownsExecution:live,
    retainedGpuBufferBytes:allocated.reduce((sum,b)=>sum+b.size,0),
    retainedGpuBufferCount:allocated.length,
    // A composed producer retains this private capability and calls it only
    // from its existing discarded/fenced/queue-ordered/device-loss retirement.
    // It never creates a second submission or fence in the hot path.
    retireWithOwner(execution,ownerToken,{retireArena=false}={}){
      if(retirementOwner==null || ownerToken!==retirementOwner)throw new TypeError('Chain volume retirement requires its original composing owner');
      const owner=owners.get(execution);
      if(!owner || owner.released)return false;
      owner.released=true;owner.arena.owner=null;
      if(retireArena){
        owner.arena.retired=true;
        const a=owner.arena;
        for(const b of [a.control,...a.up,...a.down,...a.native,...a.params,...a.adjointParams])destroyBuffer(b);
      }
      return true;
    },
    markSubmitted(execution,ownerToken=null){
      const owner=owners.get(execution);
      if(retirementOwner!=null && ownerToken===retirementOwner){
        // The parent validated before submission. Its post-submit transition
        // must use only private state: no mutable producer hooks after submit.
        if(!owner || owner.released || owner.arena.owner!==owner)return false;
      }else if(!live(execution))throw new TypeError('Stale chain volume submit');
      owner.submitted=true;return true;
    },
    async releaseAfter(execution, externalFence = null){
      const owner=owners.get(execution);if(!owner || owner.released)return false;
      if(!owner.submitted)throw new TypeError('Chain volume release needs a submitted execution');
      if(!owner.releasePromise){
        const fence = externalFence && typeof externalFence.then === 'function'
          ? externalFence
          : device.queue.onSubmittedWorkDone();
        owner.releasePromise=Promise.resolve(fence).then(()=>{
          if(owner.released || owner.arena.owner!==owner)return false;
          owner.released=true;owner.arena.owner=null;return true;
        },error=>{owner.releasePromise=null;throw error;});
      }
      return owner.releasePromise;
    },
    discard(execution,{discardedEncoder=false}={}){
      const owner=owners.get(execution);
      if(!owner || owner.released || owner.submitted || !discardedEncoder)throw new TypeError('Chain volume discard requires its unsubmitted discarded encoder');
      owner.released=true;owner.arena.owner=null;
    },
    destroy(){if(arenas.some(a=>a.owner))throw new Error('Chain volume still has live consumers');destroyed=true;allocated.forEach(destroyBuffer);}
  });
}
