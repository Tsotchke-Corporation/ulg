import { productEventLiveCountCopyDescriptor,
  validateProductEventLiveCountCopyDescriptor } from './sphResidentProductHistoryGpu.js';
import { createCachedExplicitComputePipeline, computeBufferBinding } from '../webgpuComputeLayout.js';

// The canonical ledger currently admits only history with no residual mass.
// Mass-bearing residuals need their own canonical M/U/S representation. Keeping
// this GPU gate explicit prevents retained legacy history from evading that gap.
export function prepareSphLedgerReactionHistory({ device, sourceRead = null,
  candidate = null, controlBuffer, allocate }) {
  if (!candidate) {
    if (sourceRead) throw new TypeError('Chain cannot discard retained product history');
    return null;
  }
  const output = candidate.productEventBuffer;
  const after = productEventLiveCountCopyDescriptor(candidate, device);
  const before = sourceRead?.descriptor ?? null;
  const source = sourceRead?.buffer ?? null;
  const validate = () => {
    sourceRead?.validate();
    if (!after || !validateProductEventLiveCountCopyDescriptor(after, { handle: candidate, device })
      || candidate.productEventBuffer !== output
      || [before, after].filter(Boolean).some(d => d.rowStrideFloats !== 32)
      || after.rowCapacity * 128 > output.size
      || (before && (before.rowCapacity * 128 > source.size || before.rowCapacity > after.rowCapacity))) {
      throw new TypeError('Canonical reaction history requires genuine bounded legacy count owners');
    }
  };
  validate();
  const sameData = source === output;
  const sameCount = before && before.controlBuffer === after.controlBuffer
    && before.controlOffsetBytes === after.controlOffsetBytes;
  if (sameCount && !sameData) throw new TypeError('History count cannot name different storage');
  const rows = Math.max(1, after.rowCapacity);
  if (Math.ceil(rows / 64) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Reaction history exceeds admission dispatch capacity');
  }
  const declarations = [], types = [], resources = [];
  const bind = (name, type, resource, wgslType = 'array<u32>') => {
    declarations.push(`@group(0) @binding(${types.length}) var<${type === 'uniform' ? 'uniform' : `storage,${type === 'storage' ? 'read_write' : 'read'}`}> ${name}:${wgslType};`);
    types.push(type); resources.push(resource);
  };
  bind('history', 'storage', { buffer: output });
  bind('after_count', 'storage', { buffer: after.controlBuffer, offset: after.controlOffsetBytes, size: 48 });
  bind('control', 'storage', { buffer: controlBuffer }, 'array<atomic<u32>>');
  // WebGPU treats read-only + writable storage usages as a whole-buffer
  // conflict even when the logical count records occupy disjoint ranges.
  // Snapshot the 48-byte source header on the GPU before this decision.
  const countSnapshot=before && !sameCount?allocate('ulg-chain-history-source-count',48,128|4|8):null;
  if (before && !sameCount) bind('before_count', 'read-only-storage',
    { buffer: countSnapshot });
  if (source && !sameData) bind('source', 'read-only-storage', { buffer: source });
  const params=allocate('ulg-chain-history-identities',64,64|8);
  const identity=d=>d?[d.expectedMagic,d.expectedVersion,d.expectedReadyStatus,0,
    d.rowCapacity,d.expectedRowStrideVec4,d.expectedGeneration,d.expectedSeal]:Array(8).fill(0);
  device.queue.writeBuffer(params,0,new Uint32Array([...identity(before),...identity(after)]));
  bind('cfg','uniform',{buffer:params},'Expected');
  const beforeCount = sameCount ? 'after_count' : 'before_count';
  const sourceData = sameData ? 'history' : 'source';
  const validCount = (name, field) => `${name}[0]==cfg.${field}[0].x && ${name}[1]==cfg.${field}[0].y
    && ${name}[2]==cfg.${field}[0].z && ${name}[3]<=cfg.${field}[1].x
    && ${name}[4]==cfg.${field}[1].x && ${name}[5]==cfg.${field}[1].y
    && ${name}[6]==cfg.${field}[1].z && ${name}[7]==cfg.${field}[1].w
    && ${name}[8]==(${name}[3]+63u)/64u && ${name}[9]==1u && ${name}[10]==1u && ${name}[11]==0u`;
  const code = `struct Expected { before:array<vec4<u32>,2>, after:array<vec4<u32>,2> };
${declarations.join('\n')}
fn source_count()->u32 {return ${before ? `min(${beforeCount}[3],cfg.before[1].x)` : '0u'};}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row==0u && (!(${validCount('after_count', 'after')}) ${before ? `|| !(${validCount(beforeCount, 'before')})` : ''})) {
    atomicOr(&control[2],524288u);
  }
  if(row<min(after_count[3],cfg.after[1].x) && (history[row*32u+3u]&0x7fffffffu)!=0u) {
    atomicOr(&control[2],524288u);
  }
  ${before ? `if(row<source_count() && (${sourceData}[row*32u+3u]&0x7fffffffu)!=0u) {
    atomicOr(&control[2],524288u);
  }` : ''}
}
@compute @workgroup_size(64) fn restore_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(atomicLoad(&control[2])==0u || row>=cfg.after[1].x) {return;}
  ${sameCount ? 'return;' : `if(row<source_count()) {
    ${sameData ? '// The genuine tail-append producer retains the predecessor prefix.' : source ? `for(var w=0u;w<32u;w++) {history[row*32u+w]=source[row*32u+w];}` : ''}
  } else {for(var w=0u;w<32u;w++) {history[row*32u+w]=0u;}}`}
}
@compute @workgroup_size(1) fn restore_count() {
  if(atomicLoad(&control[2])==0u) {return;}
  ${sameCount ? 'return;' : `let count=source_count();
  after_count[0]=cfg.after[0].x;after_count[1]=cfg.after[0].y;
  after_count[2]=cfg.after[0].z;after_count[3]=count;
  after_count[4]=cfg.after[1].x;after_count[5]=cfg.after[1].y;
  after_count[6]=cfg.after[1].z;after_count[7]=cfg.after[1].w;
  after_count[8]=(count+63u)/64u;after_count[9]=1u;after_count[10]=1u;after_count[11]=0u;`}
}`;
  const passes = Object.fromEntries(['check', 'restore_rows', 'restore_count'].map(entryPoint => {
    const pipeline = createCachedExplicitComputePipeline(device, { code, entryPoint,
      label: `ulg-chain-history-${entryPoint}`, cacheKey: `ulg-chain-history-v2-${entryPoint}-${Boolean(before)}-${Boolean(sameCount)}-${sameData}`,
      bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
    const group = device.createBindGroup({ layout: pipeline.bindGroupLayout,
      entries: resources.map((resource, binding) => ({ binding, resource })) });
    return [entryPoint, (encoder, count) => {
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline);
      pass.setBindGroup(0, group); pass.dispatchWorkgroups(count); pass.end();
    }];
  }));
  return Object.freeze({
    check(encoder) {
      validate();
      if(countSnapshot) encoder.copyBufferToBuffer(before.controlBuffer,before.controlOffsetBytes,countSnapshot,0,48);
      passes.check(encoder, Math.ceil(rows / 64));
    },
    restore(encoder) {
      validate(); passes.restore_rows(encoder, Math.ceil(rows / 64));
      // A separate dispatch keeps all row reads ahead of the count write.
      passes.restore_count(encoder, 1);
    }
  });
}
