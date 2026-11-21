import {
  ULG_SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_SCHEMA,
  createSchroederSpatialCompositeMechanicsLayout
} from '../../../ulg-gpu-abi/src/schroederSpatialCompositeMechanics.js';
import { schroederSpatialCompositeMechanicsWgsl } from '../../../ulg-gpu-abi/src/schroederSpatialCompositeMechanicsWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_MECHANICS_CORRECTION_SCHEMA,
  createSchroederSpatialMechanicsCorrectionLayout,
  normalizeSchroederSpatialChainForceInputs
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsCorrection.js';
import {
  schroederSpatialChainForceWgsl, schroederSpatialChainProlongWgsl,
  schroederSpatialChainCorrectionAccumulateAdmissionWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsCorrectionWgsl.js';
import { SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS } from '../../../ulg-gpu-abi/src/schroederSpatialScaleAtlas.js';
import { resolveSchroederSpatialMechanicsChainAuthority, validateSchroederSpatialEpochTransactionSourceFamily } from './schroederSpatialEpochTransaction.js';
import { resolveSubmittedMlsMpmNativeMechanicsP2g,
  exactGasPressureMechanicsP2gProductSourceIsolationCertified } from './sphGridGpuKernel.js';
import { tagWebGpuBufferDevice, webGpuBufferMatchesDevice } from './sphGpuDeviceIdentity.js';
import { snapshotSchroederChainLocalLaws, schroederChainLocalLawsMatch } from './schroederSpatialChainLocalLaws.js';
import { resolveSchroederChainLocalTransport } from './schroederSpatialChainLocalTransportGpu.js';
import { resolveSchroederChainCrossTransport } from './schroederSpatialChainCrossTransportGpu.js';
import { beginSphSpatialGasPressureMechanicsFamily, finishSphSpatialGasPressureMechanicsFamily,
  abortSphSpatialGasPressureMechanicsFamily } from './sphSpatialGasLedgerEosGpu.js';
import {
  unwrapWebGpuCacheDevice,
  createCachedExplicitBindGroup
} from '../webgpuComputeLayout.js';

const IDENTITY = Object.freeze(['generationId', 'deviceOrdinal', 'laneOrdinal',
  'leaseToken', 'sourceFamilyId', 'storageGeneration', 'physicsTick',
  'physicsSubstep', 'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']);
const USAGE = { COPY_SRC: 4, COPY_DST: 8, STORAGE: 128, INDIRECT: 256, UNIFORM: 64 };
const nativePublicationStages = new WeakMap();
const nativePublications = new WeakMap();
const compositePipelinesByDevice = new WeakMap();
const compositeRuntimePoolByDevice = new WeakMap();
const compositePooledMeta = new WeakMap();
const COMPOSITE_POOL_MAX_CONFIGS_PER_DEVICE = 8;

function sharedCompositeMechanicsPipelines(device, { needCorrection = false, label = 'ulg-schroeder-composite-mechanics' } = {}) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  let byLabel = compositePipelinesByDevice.get(keyDevice);
  if (!byLabel) {
    byLabel = new Map();
    compositePipelinesByDevice.set(keyDevice, byLabel);
  }
  let entry = byLabel.get(label);
  if (!entry) {
    const module = device.createShaderModule({ label, code: schroederSpatialCompositeMechanicsWgsl });
    const bindGroupLayout = device.createBindGroupLayout({ entries: Array.from({ length: 6 }, (_, binding) => ({
      binding, visibility: globalThis.GPUShaderStage?.COMPUTE ?? 4,
      buffer: { type: binding === 5 ? 'uniform' : binding === 4 ? 'storage' : 'read-only-storage' }
    })) });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    const pipelines = ['initialize', 'restrict_and_combine', 'seal'].map(entryPoint =>
      device.createComputePipeline({ label: `${label}-${entryPoint}`, layout: pipelineLayout,
        compute: { module, entryPoint } }));
    entry = { bindGroupLayout, pipelines, forceBundle: null, prolongBundle: null, admissionBundle: null };
    byLabel.set(label, entry);
  }
  if (needCorrection && !entry.forceBundle) {
    const stageBundle = (code, types, names) => {
      const stageModule = device.createShaderModule({ code, label: `${label}-correction` });
      const groupLayout = device.createBindGroupLayout({ entries: types.map((type, binding) => ({
        binding, visibility: globalThis.GPUShaderStage?.COMPUTE ?? 4, buffer: { type }
      })) });
      const stageLayout = device.createPipelineLayout({ bindGroupLayouts: [groupLayout] });
      return {
        groupLayout,
        pipelines: names.map(entryPoint => device.createComputePipeline({
          layout: stageLayout, compute: { module: stageModule, entryPoint }, label: `${label}-${entryPoint}`
        }))
      };
    };
    const forceBundle = stageBundle(schroederSpatialChainForceWgsl,
      ['read-only-storage', 'read-only-storage', 'storage', 'uniform'],
      ['initialize_force', 'force_rows', 'contact_rows', 'validate_force_rows', 'seal_force']);
    const prolongBundle = stageBundle(schroederSpatialChainProlongWgsl,
      ['read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage', 'storage', 'read-only-storage', 'storage', 'uniform'],
      ['initialize_prolong', 'prolong_fine', 'prolong_native', 'seal_prolong']);
    const admissionBundle = stageBundle(schroederSpatialChainCorrectionAccumulateAdmissionWgsl,
      ['read-only-storage', 'read-only-storage', 'storage', 'uniform'],
      ['init_chain_admission', 'accumulate_chain_admission', 'seal_chain_admission']);
    entry.forceBundle = forceBundle;
    entry.prolongBundle = prolongBundle;
    entry.admissionBundle = admissionBundle;
  }
  return entry;
}

function compositePoolKey({ firstMoments = false, parentFieldCapacities, nativeFieldCapacities = null, label = 'ulg-schroeder-composite-mechanics' }) {
  return `${label}|m:${firstMoments ? 1 : 0}|p:${parentFieldCapacities.join(',')}|n:${nativeFieldCapacities ? nativeFieldCapacities.join(',') : ''}`;
}

export function acquirePooledSchroederSpatialCompositeMechanicsGpu(device, options = {}) {
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const key = compositePoolKey(options);
  let byKey = compositeRuntimePoolByDevice.get(keyDevice);
  if (byKey) {
    const bucket = byKey.get(key);
    if (bucket && bucket.length > 0) {
      const runtime = bucket.pop();
      // Refresh LRU order for this dynamic level configuration.
      byKey.delete(key);
      byKey.set(key, bucket);
      return runtime;
    }
  }
  const runtime = createSchroederSpatialCompositeMechanicsGpu(device, options);
  compositePooledMeta.set(runtime, { keyDevice, key });
  return runtime;
}

export function releasePooledSchroederSpatialCompositeMechanicsGpu(runtime, { destroy = false } = {}) {
  if (!runtime) return false;
  const meta = compositePooledMeta.get(runtime);
  if (!meta || destroy) {
    compositePooledMeta.delete(runtime);
    try { runtime.destroy(); } catch {}
    return false;
  }
  let byKey = compositeRuntimePoolByDevice.get(meta.keyDevice);
  if (!byKey) {
    byKey = new Map();
    compositeRuntimePoolByDevice.set(meta.keyDevice, byKey);
  }
  let bucket = byKey.get(meta.key);
  if (!bucket) {
    bucket = [];
    byKey.set(meta.key, bucket);
  } else {
    byKey.delete(meta.key);
    byKey.set(meta.key, bucket);
  }
  if (bucket.length < 2) {
    bucket.push(runtime);
  } else {
    compositePooledMeta.delete(runtime);
    try { runtime.destroy(); } catch {}
  }
  // Evict oldest unused dynamic level-capacity configurations beyond cap.
  while (byKey.size > COMPOSITE_POOL_MAX_CONFIGS_PER_DEVICE) {
    const oldestKey = byKey.keys().next().value;
    const evicted = byKey.get(oldestKey);
    byKey.delete(oldestKey);
    if (evicted) {
      for (const r of evicted) {
        compositePooledMeta.delete(r);
        try { r.destroy(); } catch {}
      }
    }
  }
  return true;
}

// A chain has one particle consumer. Retain its control arena until that
// consumer has submitted the whole batch, including the final rollback.
export function acquireSchroederNativePublication(publication, {
  device, transaction, sphParticleUpload, mlsMpmParticleUpload
} = {}) {
  const record = nativePublications.get(publication);
  const validate = () => {
    if (!record || record.device !== device || record.transaction !== transaction
      || !record.validate()
      || !validateSchroederSpatialEpochTransactionSourceFamily(transaction, {
        generation: transaction.generation, sphParticleUpload, mlsMpmParticleUpload
      })) throw new TypeError('Chain G2P requires the genuine live native publication and source');
  };
  validate();
  if (record.consumer != null) throw new TypeError('Native publication already has a particle consumer');
  record.consumer = 'active';
  let closed = false;
  return Object.freeze({ publication,
    validate() {
      if (closed || record.consumer !== 'active') throw new TypeError('Native publication consumer is closed');
      validate(); return true;
    },
    finish({ submitted = false } = {}) {
      if (closed) return false;
      closed = true; record.consumer = submitted ? 'submitted' : 'failed'; return true;
    }
  });
}

// Only publishNativeState can issue these stage capabilities. Grid update
// validates each borrowed mutation against the original producer and owner.
export function resolveSchroederNativePublicationStage(stage, { device, projection, field, dt } = {}) {
  const record = nativePublicationStages.get(stage);
  if (!record || record.device !== device || record.projection !== projection
    || record.field !== field || record.owner.publication?.status !== 'active'
    || record.owner.publication.next !== record.index || record.execution.released
    || !record.validate()) throw new TypeError('Native chain publication stage is stale or foreign');
  resolveSubmittedMlsMpmNativeMechanicsP2g(device, projection, {
    generation: record.execution.transaction.generation,
    sourceBuffers: record.execution.transaction.sourceBuffers,
    fieldExecution: field, dt, mutationReservation: record.mutation
  });
  record.binding.transportAuthority?.validate();
  return record.binding;
}

// Owns only derived state. Native field mutations remain with the epoch's
// field runtimes; the immutable topology remains with its parent-view owners.
// All pairs are encoded in order on the caller's command encoder. No host
// field counts, GPU readbacks, submissions or awaited step fences are added.
export function createSchroederSpatialCompositeMechanicsGpu(device, {
  parentFieldCapacities, nativeFieldCapacities = null, arenaCount = 2, firstMoments = false,
  label = 'ulg-schroeder-composite-mechanics'
} = {}) {
  if (!device?.createBuffer || !device?.createComputePipeline || !device.queue?.writeBuffer) {
    throw new TypeError('Composite mechanics requires a WebGPU device');
  }
  const maxPairCount = SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS - 1;
  if (!Array.isArray(parentFieldCapacities) || parentFieldCapacities.length < 1
    || parentFieldCapacities.length > maxPairCount || !Number.isInteger(arenaCount)
    || arenaCount < 1 || arenaCount > 8) {
    throw new RangeError(`Composite mechanics requires one to ${maxPairCount} bounded pair capacities`);
  }
  const layouts = parentFieldCapacities.map(capacity=>createSchroederSpatialCompositeMechanicsLayout(capacity,{firstMoments}));
  if (nativeFieldCapacities != null && (!Array.isArray(nativeFieldCapacities)
    || nativeFieldCapacities.length !== layouts.length+1)) {
    throw new TypeError('Chain correction requires every native level capacity');
  }
  const nativeLayouts = nativeFieldCapacities?.map(createSchroederSpatialMechanicsCorrectionLayout);
  const correctedLayouts = nativeLayouts ? parentFieldCapacities.map(createSchroederSpatialMechanicsCorrectionLayout) : null;
  // Constant O(1) storage bindings (max 7 in prolongBundle, 3 in admissionBundle)
  // so arbitrary N-level chains run cleanly even at WebGPU's 8-binding floor.
  if (nativeLayouts && (device.limits?.maxStorageBuffersPerShaderStage ?? 8) < 7) {
    throw new RangeError('Chain correction exceeds WebGPU storage binding limits');
  }
  const bufferLimit = Math.min(device.limits?.maxBufferSize ?? 268435456,
    device.limits?.maxStorageBufferBindingSize ?? 134217728);
  if ([...layouts,...(nativeLayouts ?? []),...(correctedLayouts ?? [])].some(x => x.byteLength > bufferLimit)) {
    throw new RangeError('Composite mechanics exceeds WebGPU storage limits');
  }
  const {
    bindGroupLayout,
    pipelines,
    forceBundle: cachedForceBundle,
    prolongBundle: cachedProlongBundle,
    admissionBundle: cachedAdmissionBundle
  } = sharedCompositeMechanicsPipelines(device, { needCorrection: Boolean(nativeLayouts), label });
  const forceBundle = nativeLayouts ? cachedForceBundle : null;
  const prolongBundle = nativeLayouts ? cachedProlongBundle : null;
  const admissionBundle = nativeLayouts ? cachedAdmissionBundle : null;
  const buffers = [];
  const allocate = (size, usage, suffix) => {
    const b = tagWebGpuBufferDevice(device.createBuffer({ size, usage, label: `${label}-${suffix}` }), device);
    buffers.push(b); return b;
  };
  let arenas;
  try {
    arenas = Array.from({ length: arenaCount }, () => ({ execution: null,
      pairs: layouts.map((layout, i) => ({
        stateBuffer: allocate(layout.byteLength, USAGE.STORAGE | USAGE.COPY_SRC | USAGE.COPY_DST | USAGE.INDIRECT, `state-${i}`),
        paramsBuffer: allocate(128, USAGE.UNIFORM | USAGE.COPY_DST, `params-${i}`)
      })),
      correction: nativeLayouts ? {
        nativeBuffers:nativeLayouts.map((layout,i)=>allocate(layout.byteLength,USAGE.STORAGE|USAGE.COPY_SRC|USAGE.COPY_DST|USAGE.INDIRECT,`native-corrected-${i}`)),
        updatedBuffers:correctedLayouts.map((layout,i)=>allocate(layout.byteLength,USAGE.STORAGE|USAGE.COPY_SRC|USAGE.COPY_DST|USAGE.INDIRECT,`parent-corrected-${i}`)),
        paramsBuffers:layouts.map((_,i)=>allocate(192,USAGE.UNIFORM|USAGE.COPY_DST,`prolong-params-${i}`)),
        publicationParams:nativeLayouts.map((_,i)=>allocate(16,USAGE.UNIFORM|USAGE.COPY_DST,`publication-params-${i}`)),
        admissionParams:nativeLayouts.map((_,i)=>allocate(16,USAGE.UNIFORM|USAGE.COPY_DST,`admission-params-${i}`)),
        forceParamsBuffer:allocate(192,USAGE.UNIFORM|USAGE.COPY_DST,'force-params'),
        controlBuffer:allocate(256,USAGE.STORAGE|USAGE.COPY_SRC|USAGE.COPY_DST,'chain-admission')
      } : null
    }));
  } catch (error) { for (const b of buffers) b.destroy(); throw error; }
  const owners = new WeakMap(), released = new WeakSet();
  let serial = 0, destroyed = false;

  function currentNativeStates(authority) {
    return authority.mechanicsFieldViews.map(field => {
      const state = field.ownerRuntime.stateMutationState(field);
      if (state.encoding !== 1 || !Number.isSafeInteger(state.ordinal) || state.ordinal < 1
        || !field.ownerRuntime.isCurrentStateArtifact(field, { mutationOrdinal: state.ordinal, stateEncoding: 1 })
        || !webGpuBufferMatchesDevice(field.fieldViewBuffer, device)) {
        throw new TypeError('Composite mechanics requires current submitted P2G momentum on every native level');
      }
      return Object.freeze({ field, buffer: field.fieldViewBuffer, ordinal: state.ordinal });
    });
  }
  function live(execution) {
    const owner = owners.get(execution);
    if (!owner || destroyed || owner.arena.execution !== execution) return false;
    try {
      const authority = resolveSchroederSpatialMechanicsChainAuthority(owner.transaction, { device });
      if (authority !== owner.authority) return false;
      if (execution.correction) {
        owner.p2gProjections.forEach((projection, i) => {
          if (resolveSubmittedMlsMpmNativeMechanicsP2g(device, projection, {
            generation: owner.transaction.generation, fieldExecution: owner.nativeStates[i].field,
            sourceBuffers: owner.transaction.sourceBuffers, dt: execution.correction.forceInputs.dt
          }) !== owner.p2gOrigins[i]) throw new TypeError('Stale chain P2G producer');
        });
      }
      return owner.nativeStates.every(({ field, buffer, ordinal }) =>
        field.fieldViewBuffer === buffer && !buffer.destroyed
        && field.ownerRuntime.isCurrentStateArtifact(field, { mutationOrdinal: ordinal, stateEncoding: 1 }))
        && owner.arena.pairs.every(p => !p.stateBuffer.destroyed && !p.paramsBuffer.destroyed)
        && (!execution.correction || [owner.arena.correction.controlBuffer,
          owner.arena.correction.forceParamsBuffer,...owner.arena.correction.paramsBuffers,
          ...owner.arena.correction.publicationParams,
          ...owner.arena.correction.admissionParams,
          ...owner.arena.correction.nativeBuffers,...owner.arena.correction.updatedBuffers]
          .every(buffer=>!buffer.destroyed && webGpuBufferMatchesDevice(buffer,device)));
    } catch { return false; }
  }
  function encode(encoder, { transaction, forceInputs = null, p2gProjections = null, crossTransport = null, localLawInputs = null } = {}) {
    if (destroyed || !encoder?.beginComputePass || !encoder?.clearBuffer) {
      throw new TypeError('Composite mechanics requires a live runtime and caller encoder');
    }
    const authority = resolveSchroederSpatialMechanicsChainAuthority(transaction, { device });
    if (authority.pairAuthorities.length !== layouts.length
      || authority.pairAuthorities.some((p,i) => p.parentFieldView.parentFieldCapacity !== layouts[i].parentFieldCapacity)) {
      throw new TypeError('Composite mechanics capacities must match the exact admitted chain');
    }
    const nativeStates = currentNativeStates(authority);
    const forces=forceInputs==null ? null : normalizeSchroederSpatialChainForceInputs(forceInputs);
    const cross=crossTransport==null?null:resolveSchroederChainCrossTransport(crossTransport,device,transaction,localLawInputs);
    if(cross&&!forces)throw new TypeError('Cross transport requires the actual chain force interval');
    if(cross&&!firstMoments)throw new TypeError('Cross transport requires inherited mass first moments');
    if (forces && (!nativeLayouts || nativeStates.some(({field},i)=>field.fieldCapacity!==nativeLayouts[i].capacity))) {
      throw new TypeError('Chain force/correction requires exact preallocated native field capacities');
    }
    if (forces && (!Array.isArray(p2gProjections) || p2gProjections.length !== nativeStates.length)) {
      throw new TypeError('Chain mechanics requires exact submitted native P2G producers for every level');
    }
    const projections = forces ? Object.freeze([...p2gProjections]) : null;
    const p2gOrigins = projections ? Object.freeze(projections.map((projection, i) =>
      resolveSubmittedMlsMpmNativeMechanicsP2g(device, projection, {
        generation: transaction.generation, fieldExecution: nativeStates[i].field,
        sourceBuffers: transaction.sourceBuffers, dt: forces.dt
      }))) : null;
    const arena = arenas.find(a => a.execution == null);
    if (!arena) throw new Error('Composite mechanics arena backpressure');
    if (serial >= 0xffff_ffff) throw new RangeError('Composite mechanics generation exhausted');
    const completionOrdinal = ++serial;
    const pairs = Object.freeze(authority.pairAuthorities.map((pair, i) => Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_SCHEMA,
      parentFieldView: pair.parentFieldView,
      selectedLevel: pair.coarseLevel,
      stateBuffer: arena.pairs[i].stateBuffer,
      layout: layouts[i], completionOrdinal,
      sourceStateBuffer: i ? arena.pairs[i-1].stateBuffer : nativeStates[0].buffer,
      nativeStateBuffer: nativeStates[i+1].buffer
    })));
    const correction=forces ? Object.freeze({
      schema:ULG_SCHROEDER_SPATIAL_MECHANICS_CORRECTION_SCHEMA,
      p2gProjections: projections,
      forceInputs:forces,controlBuffer:arena.correction.controlBuffer,
      updatedPairs:Object.freeze(pairs.map((pair,i)=>Object.freeze({
        selectedLevel:pair.selectedLevel, parentFieldView:pair.parentFieldView,
        stateBuffer:arena.correction.updatedBuffers[i],layout:correctedLayouts[i]
      }))),
      nativeStates:Object.freeze(nativeStates.map(({field},i)=>Object.freeze({
        selectedLevel:field.selectedLevel,fieldView:field,
        stateBuffer:arena.correction.nativeBuffers[i],layout:nativeLayouts[i]
      })))
    }) : null;
    const execution = Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_SCHEMA,
      ownerRuntime: runtime, transaction, pairs, completionOrdinal, correction,
      encodedDispatchCount: pairs.length*3+(forces ? 5+nativeStates.length+1+pairs.length*4 : 0)+(cross?pairs.length*223+nativeStates.length+1:0),
      gpuBufferCreationCountDuringEncode: 0,
      fullParticleReadbackPerformed: false,
      normalHotLoopReadbackFree: true,
      get released() { return released.has(execution); }
    });
    const owner = { arena, authority, transaction, nativeStates, p2gProjections: projections,
      p2gOrigins, cross, submitted: false, releasePromise: null };
    arena.execution = execution;
    owners.set(execution, owner);
    try {
      cross?.encodeMoments(encoder);
      for (const [i, pair] of authority.pairAuthorities.entries()) {
        const parent = pair.parentFieldView, output = arena.pairs[i];
        const previous = i ? authority.pairAuthorities[i-1].parentFieldView : null;
        const params = new Uint32Array(32);
        params.set([i ? 1 : 0, layouts[i].parentFieldCapacity,
          nativeStates[i].ordinal, nativeStates[i+1].ordinal, completionOrdinal,
          parent.completionOrdinal, (previous ?? pair.fineFieldView).completionOrdinal,
          pair.coarseFieldView.completionOrdinal]);
        params.set(IDENTITY.map(key => parent[key]), 8);
        params.set([i ? completionOrdinal : 0, previous?.parentFieldCapacity ?? 0,
          pair.fineLevel, pair.coarseLevel, pair.fineFieldView.fieldCapacity,
          pair.coarseFieldView.fieldCapacity], 21);
        params[27]=Number(firstMoments);
        device.queue.writeBuffer(output.paramsBuffer, 0, params);
        encoder.clearBuffer(output.stateBuffer);
        const bound = [parent.parentFieldViewBuffer,
          previous?.parentFieldViewBuffer ?? nativeStates[0].buffer,
          pairs[i].sourceStateBuffer, nativeStates[i+1].buffer, output.stateBuffer, output.paramsBuffer];
        const group = createCachedExplicitBindGroup(device, { label: `${label}-pair-${i}-bg`, layout: bindGroupLayout,
          entries: bound.map((buffer,binding) => ({ binding, resource: { buffer } })) });
        const pass = encoder.beginComputePass({ label: `${label}-pair-${i}` });
        pass.setBindGroup(0, group);
        pass.setPipeline(pipelines[0]); pass.dispatchWorkgroups(1);
        pass.setPipeline(pipelines[1]);
        pass.dispatchWorkgroupsIndirect(parent.parentFieldViewBuffer, 60*4);
        pass.setPipeline(pipelines[2]); pass.dispatchWorkgroups(1);
        pass.end();
      }
      if (forces) encodeCorrection(encoder,execution,owner,forces);
      return execution;
    } catch (error) {
      // The caller must discard its encoder on encode failure. Keep the arena
      // quarantined rather than reusing storage referenced by that encoder.
      owner.failed = true;
      error.compositeMechanicsExecution = execution;
      throw error;
    }
  }
  function encodeCorrection(encoder,execution,owner,forces) {
    const {arena,authority,nativeStates}=owner, c=arena.correction;
    for (const buffer of [...c.updatedBuffers,...c.nativeBuffers,c.controlBuffer]) encoder.clearBuffer(buffer);
    const group=(bundle,bound)=>createCachedExplicitBindGroup(device,{label:`${label}-corr-bg`,layout:bundle.groupLayout,
      entries:bound.map((buffer,binding)=>({binding,resource:{buffer}}))});
    const baseParams=parent=>{
      const words=new Uint32Array(48); words[0]=execution.completionOrdinal;words[1]=execution.completionOrdinal;
      words[2]=parent.parentFieldCapacity;words[3]=parent.completionOrdinal;
      words.set(IDENTITY.map(key=>parent[key]),20);return words;
    };
    const last=execution.pairs.length-1, top=execution.pairs[last], topology=top.parentFieldView;
    const fp=baseParams(topology), floats=new Float32Array(fp.buffer);
    floats[4]=forces.dt;floats.set(forces.gravityMPerS2,5);floats.set(forces.boxDimsM,8);
    fp[11]=forces.wallsEnabled ? 1 : 0;fp[12]=forces.contactEnabled ? 1 : 0;
    floats[13]=forces.cflFactor;floats[14]=forces.wallBarrierElasticStiffnessNPerM;
    floats[15]=forces.wallBarrierContactScale;floats[16]=forces.wallBarrierMinGapM;
    device.queue.writeBuffer(c.forceParamsBuffer,0,fp);
    const forcePass=encoder.beginComputePass({label:`${label}-coarsest-force`});
    forcePass.setBindGroup(0,group(forceBundle,[topology.parentFieldViewBuffer,top.stateBuffer,c.updatedBuffers[last],c.forceParamsBuffer]));
    for (let stage=0;stage<forceBundle.pipelines.length;stage++) {
      forcePass.setPipeline(forceBundle.pipelines[stage]);
      if (stage===0 || stage===4) forcePass.dispatchWorkgroups(1);
      else forcePass.dispatchWorkgroupsIndirect(topology.parentFieldViewBuffer,60*4);
    }
    forcePass.end();
    for (let i=last;i>=0;i--) {
      const pair=authority.pairAuthorities[i], parent=pair.parentFieldView;
      const previous=i ? execution.pairs[i-1] : null;
      const params=baseParams(parent), f32=new Float32Array(params.buffer);
      params[4]=i ? 1 : 0;params[5]=i ? previous.layout.parentFieldCapacity : nativeLayouts[0].capacity;
      params[6]=nativeLayouts[i+1].capacity;params[7]=nativeStates[i].ordinal;params[8]=nativeStates[i+1].ordinal;
      params[9]=(previous?.parentFieldView ?? pair.fineFieldView).completionOrdinal;
      params[10]=pair.coarseFieldView.completionOrdinal;params[11]=pair.fineLevel;params[12]=pair.coarseLevel;
      f32[14]=forces.dt;f32[15]=forces.cflFactor;
      device.queue.writeBuffer(c.paramsBuffers[i],0,params);
      const bound=[parent.parentFieldViewBuffer,execution.pairs[i].stateBuffer,c.updatedBuffers[i],
        execution.pairs[i].sourceStateBuffer,i ? c.updatedBuffers[i-1] : c.nativeBuffers[0],
        nativeStates[i+1].buffer,c.nativeBuffers[i+1],c.paramsBuffers[i]];
      const pass=encoder.beginComputePass({label:`${label}-prolong-${i}`});pass.setBindGroup(0,group(prolongBundle,bound));
      for (let stage=0;stage<prolongBundle.pipelines.length;stage++) {
        pass.setPipeline(prolongBundle.pipelines[stage]);
        if (stage===0 || stage===3) pass.dispatchWorkgroups(1);
        else pass.dispatchWorkgroupsIndirect(parent.parentFieldViewBuffer,(stage===1 ? 64 : 68)*4);
      }
      pass.end();
      owner.cross?.encodePair(encoder,i,i?c.updatedBuffers[i-1]:c.nativeBuffers[0],c.nativeBuffers[i+1],execution.pairs[i].stateBuffer,execution.pairs[i].sourceStateBuffer,execution.completionOrdinal,forces);
    }
    owner.cross?.encodeAdmission(encoder);
    const levelCount = c.nativeBuffers.length;
    for (let levelIndex = 0; levelIndex < levelCount; levelIndex += 1) {
      device.queue.writeBuffer(
        c.admissionParams[levelIndex],
        0,
        new Uint32Array([levelIndex, levelCount, 0, 0])
      );
    }
    const admission=encoder.beginComputePass({label:`${label}-chain-admission`});
    const initGroup = group(admissionBundle, [c.nativeBuffers[0], c.nativeBuffers[0], c.controlBuffer, c.admissionParams[0]]);
    admission.setPipeline(admissionBundle.pipelines[0]);
    admission.setBindGroup(0, initGroup);
    admission.dispatchWorkgroups(1);
    admission.setPipeline(admissionBundle.pipelines[1]);
    for (let levelIndex = 1; levelIndex < levelCount; levelIndex += 1) {
      admission.setBindGroup(0, group(admissionBundle, [
        c.nativeBuffers[0], c.nativeBuffers[levelIndex], c.controlBuffer, c.admissionParams[levelIndex]
      ]));
      admission.dispatchWorkgroups(1);
    }
    admission.setPipeline(admissionBundle.pipelines[2]);
    admission.setBindGroup(0, initGroup);
    admission.dispatchWorkgroups(1);
    admission.end();
  }
  function markExecutionSubmitted(execution) {
    const owner = owners.get(execution);
    if (!live(execution) || owner.submitted || owner.failed) throw new TypeError('Composite submission is stale');
    owner.submitted = true;
    owner.cross?.submitted();
    return true;
  }
  async function publishNativeState(execution, { localLawInputs = null, localTransport = null } = {}) {
    // Import/compile module resolution before reserving native fields. Awaiting
    // this host import is not a GPU queue fence or a hot-state readback.
    const { runMlsMpmGridUpdateWebGpu } = await import('./sphGridUpdateGpuKernel.js');
    const owner = owners.get(execution);
    if (!live(execution) || !owner.submitted || !execution.correction
      || owner.releasePromise || owner.publication) throw new TypeError('Native publication requires an unconsumed submitted chain');
    if (localLawInputs != null && (!Array.isArray(localLawInputs)
      || localLawInputs.length !== owner.nativeStates.length)) {
      throw new TypeError('Chain publication requires one local law declaration per native level');
    }
    const laws = owner.nativeStates.map((_, index) =>
      snapshotSchroederChainLocalLaws(localLawInputs?.[index] ?? {}));
    if(owner.cross&&laws.some((law,i)=>!schroederChainLocalLawsMatch(owner.cross.laws[i],law))) {
      throw new TypeError('Cross transport and native publication law inputs differ');
    }
    const pressureLaw=laws.length>2 ? laws.find(law=>law.gasPressureMechanicsAuthoritySource!=null) : null;
    if(pressureLaw && laws.some(law=>law.gasPressureMechanicsAuthoritySource!==pressureLaw.gasPressureMechanicsAuthoritySource
      || Math.fround(law.ambientPressurePa)!==Math.fround(pressureLaw.ambientPressurePa))) {
      throw new TypeError('Multilevel pressure requires one source and ambient pressure on every native level');
    }
    for (const [index, law] of laws.entries()) {
      if (law.gasPressureMechanicsAuthoritySource == null) continue;
      const inputs=owner.p2gOrigins[index].inputs;
      if (!exactGasPressureMechanicsP2gProductSourceIsolationCertified(owner.p2gProjections[index], {
        productRowsAdvertised:inputs.residentProductMass != null,
        productEventRowCapacity:inputs.residentProductMassInputProductEventRowCapacity
      })) {
        throw new TypeError('Chain gas pressure requires the original P2G product-source isolation');
      }
    }
    const records=[];
    try {
      if (laws.some(law => law.phaseVolumeInterfaceTransportRequired)) {
        owner.localTransport = resolveSchroederChainLocalTransport(localTransport, device, owner.transaction,
          laws.map(law => law.phaseVolumeInterfaceTransportRequired));
      }
      for (const [index,native] of owner.nativeStates.entries()) {
        const field=native.field;
        const mutation=field.ownerRuntime.reserveStateMutation(field, {
          expectedOrdinal:native.ordinal,expectedEncoding:1,outputEncoding:2,
          operation:'chain-grid-update-mass-velocity-gradient-submitted'
        });
        const proposalBuffer=execution.correction.nativeStates[index].stateBuffer;
        const controlBuffer=execution.correction.controlBuffer;
        const paramsBuffer=owner.arena.correction.publicationParams[index];
        records.push({index,field,mutation,device,owner,execution,
          binding:Object.freeze({mutation,proposalBuffer,controlBuffer,paramsBuffer,
            transportAuthority:owner.localTransport?.authorities[index] ?? null,
            localLaws:laws[index],transaction:owner.transaction}),
          projection:owner.p2gProjections[index],
          proposalBuffer,controlBuffer,paramsBuffer,
          validate:()=> !destroyed && owner.arena.execution===execution
            && resolveSchroederSpatialMechanicsChainAuthority(owner.transaction,{device})===owner.authority
            && [execution.correction.controlBuffer,...owner.arena.correction.nativeBuffers,
              ...owner.arena.correction.publicationParams].every(b=>!b.destroyed && webGpuBufferMatchesDevice(b,device))
        });
      }
    } catch (error) {
      for (const r of records) r.field.ownerRuntime.discardStateMutation(r.mutation,{discardedEncoder:true});
      throw error;
    }
    owner.publication={status:'active',next:0};
    const updates=[];
    let pressureFamily=null;
    try {
      if(pressureLaw)pressureFamily=beginSphSpatialGasPressureMechanicsFamily(pressureLaw.gasPressureMechanicsAuthoritySource,
        {device,generation:owner.transaction.generation,ambientPressurePa:pressureLaw.ambientPressurePa});
      for (const r of records) {
        const stage=Object.freeze({schema:'peercompute.ulg.schroeder-native-publication-stage.v1'});
        nativePublicationStages.set(stage,r);
        device.queue.writeBuffer(r.paramsBuffer,0,new Uint32Array([execution.completionOrdinal,r.index,records.length,0x534e5031]));
        const update=await runMlsMpmGridUpdateWebGpu({...laws[r.index],device,p2gGridProjection:r.projection,
          schroederSpatialEpochTransaction:owner.transaction,
          mechanicsFieldMode:'required',readbackMode:'no-full-readback',
          dt:r.projection.dt,gravityMPerS2:[0,0,0],
          boxDimsM:execution.correction.forceInputs.boxDimsM,
          cflFactor:execution.correction.forceInputs.cflFactor,
          wallBarrierContactScale:0,nativeChainPublication:stage});
        updates.push(update); owner.publication.next++;
      }
      owner.localTransport?.finish();
      if(pressureFamily)finishSphSpatialGasPressureMechanicsFamily(pressureFamily);
      owner.publication.status='submitted';
      const publication = Object.freeze({schema:'peercompute.ulg.schroeder-native-publication.v1',
        execution,updates:Object.freeze(updates),controlBuffer:execution.correction.controlBuffer,
        forceInputs:execution.correction.forceInputs});
      const updateSnapshots = updates.map(update => ['sourceProjection', 'mechanicsFieldViewExecution',
        'mechanicsFieldViewBuffer', 'mechanicsFieldMutationInputOrdinal', 'mechanicsFieldMutationOutputOrdinal',
        'mechanicsFieldMutationOutputStateEncoding', 'dt'].map(key => [key, update[key]]));
      const publicationRecord = { device, transaction: owner.transaction, consumer: null,
        validate: () => !destroyed && !owner.releasePromise && !execution.released
          && owner.arena.execution === execution && owner.publication.status === 'submitted'
          && updates.every((update, i) => updateSnapshots[i].every(([key, value]) => {
            const descriptor = Object.getOwnPropertyDescriptor(update, key);
            return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value === value;
          }))
          && records.every(r => r.validate()
            && r.field.ownerRuntime.isCurrentStateArtifact(r.field, {
              mutationOrdinal: r.mutation.outputOrdinal, stateEncoding: 2
            }))
      };
      nativePublications.set(publication, publicationRecord);
      owner.publication.record = publicationRecord;
      return publication;
    } catch (error) {
      owner.publication.status='failed';
      if(pressureFamily){
        try{abortSphSpatialGasPressureMechanicsFamily(pressureFamily);}
        catch(cleanupError){error.pressureFamilyCleanupError=cleanupError;}
      }
      for (const r of records) {
        if(r.field.ownerRuntime.isStateMutationReservationActive(r.field,r.mutation)) {
          r.field.ownerRuntime.discardStateMutation(r.mutation,{discardedEncoder:true});
        }
      }
      // Submitted fields are never retried or relabeled as the original P2G.
      // The caller must abort this mechanics transaction before G2P.
      throw error;
    }
  }
  function discardExecution(execution, { discardedEncoder = false } = {}) {
    const owner = owners.get(execution);
    if (!owner || owner.submitted || discardedEncoder !== true) throw new TypeError('Composite discard needs an unsubmitted discarded encoder');
    owner.arena.execution = null; owners.delete(execution); released.add(execution);
    return true;
  }
  function releaseExecutionAfter(execution, externalFence = null) {
    const owner = owners.get(execution);
    if (released.has(execution)) return Promise.resolve(true);
    if (!owner?.submitted) return Promise.reject(new TypeError('Composite release requires submitted work'));
    if (owner.publication?.status==='active') return Promise.reject(new TypeError('Native publication still owns correction storage'));
    if (owner.publication?.record?.consumer === 'active') return Promise.reject(new TypeError('Chain G2P still owns native publication storage'));
    if (owner.releasePromise) return owner.releasePromise;
    const fence = externalFence && typeof externalFence.then === 'function'
      ? externalFence
      : device.queue.onSubmittedWorkDone();
    if (!fence || typeof fence.then !== 'function') {
      return Promise.reject(new TypeError('Composite retirement requires queue completion evidence'));
    }
    owner.releasePromise = Promise.resolve(fence).then(async () => {
      await owner.localTransport?.retire(fence);
      await owner.cross?.retire(fence);
      owner.arena.execution = null; owners.delete(execution); released.add(execution);
      return true;
    }).catch(error => { owner.releasePromise = null; throw error; });
    return owner.releasePromise;
  }
  const runtime = Object.freeze({ encode, markExecutionSubmitted, publishNativeState, discardExecution, releaseExecutionAfter,
    ownsExecution: live,
    isExecutionSubmitted: execution => live(execution) && owners.get(execution).submitted,
    destroy() {
      if (arenas.some(a => a.execution != null)) throw new Error('Composite mechanics has live executions');
      if (!destroyed) { for (const b of buffers) b.destroy(); destroyed = true; }
    }
  });
  return runtime;
}
