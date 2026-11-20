import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createCachedExplicitComputePipeline, computeBufferBinding } from '../webgpuComputeLayout.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC as FIELD_MAGIC,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION as FIELD_VERSION,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS as FIELD_HEADER
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';

// Numerical gather only. The genuine G2P producer owns admission, the source
// pin, submissions and output lifetime. Each level has already run the normal
// particle solver; its physical descriptor selects disjoint output rows.
export function prepareSchroederSpatialChainG2pGather({ device, publication,
  particleCount, sourceStateBuffer, sourceMechanicsBuffer, sourceQuantities = null }) {
  const buffers = [];
  const allocate = (label, size, usage = 128 | 4 | 8) => {
    if (!Number.isSafeInteger(size) || size < 4 || size > device.limits.maxStorageBufferBindingSize) {
      throw new RangeError('Chain G2P gather exceeds device storage capacity');
    }
    const b = tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
    buffers.push(b); return b;
  };
  const count = particleCount, levels = publication.updates.length;
  if (!Number.isSafeInteger(count) || count < 1
    || Math.ceil(count / 64) > device.limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError('Chain G2P requires a bounded physical particle capacity');
  }
  try {
    const stateBuffer = allocate('ulg-chain-g2p-state', count * 32);
    const mechanicsBuffer = allocate('ulg-chain-g2p-mechanics', count * 128);
    const selected = allocate('ulg-chain-g2p-selected-counts', count * 4);
    const controlBuffer = allocate('ulg-chain-g2p-control', 128);
    const validationBuffer = allocate('ulg-chain-g2p-exact-validation', 16);
    const quantityBuffer = sourceQuantities ? allocate('ulg-chain-g2p-quantities', sourceQuantities.quantityBuffer.size) : null;
    const projectionBuffer = sourceQuantities ? allocate('ulg-chain-g2p-projections', count * 48) : null;
    const params = publication.updates.map((update, index) => {
      const b = allocate('ulg-chain-g2p-params', 32, 64 | 8);
      device.queue.writeBuffer(b, 0, new Uint32Array([count, index, levels, update.mechanicsFieldMutationOutputOrdinal,
        publication.execution.completionOrdinal, 0, 0, 0]));
      return b;
    });
    const dispatch = (encoder, code, entryPoint, resources, groups = 1) => {
      const types = resources.map(r => r.type ?? 'storage');
      const p = createCachedExplicitComputePipeline(device, { code, entryPoint,
        cacheKey: `chain-g2p-v1-${entryPoint}-${sourceQuantities?.quantityLayout.recordWords ?? 0}`,
        bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
      const group = device.createBindGroup({ layout: p.bindGroupLayout,
        entries: resources.map((r, binding) => ({ binding, resource: { buffer: r.buffer ?? r } })) });
      const pass = encoder.beginComputePass(); pass.setPipeline(p.pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(groups); pass.end();
    };
    const ro = buffer => ({ buffer, type: 'read-only-storage' });
    const shader = /* wgsl */ `
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read> input_s:array<u32>;
@group(0) @binding(2) var<storage,read> input_m:array<u32>;
@group(0) @binding(3) var<storage,read_write> output_s:array<u32>;
@group(0) @binding(4) var<storage,read_write> output_m:array<u32>;
@group(0) @binding(5) var<storage,read_write> selected:array<atomic<u32>>;
@group(0) @binding(6) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params:vec4<u32>;
fn fail(bit:u32) { atomicOr(&control[2],bit); }
@compute @workgroup_size(1) fn admit_level() {
  let r=field[30]-36u;
  if(field[0]!=${FIELD_MAGIC}u || field[1]!=${FIELD_VERSION}u || field[2]!=3u || field[16]!=params.x
    || field[24]!=${FIELD_HEADER}u || field[25]!=32u || field[59]!=2u || field[63]!=params.w
    || field[r]!=0x53465233u || field[r+1]!=3u || field[r+2]!=3u || field[r+3]!=6u
    || field[r+5]!=params.w || field[r+32]!=field[r+33] || field[r+32]!=field[r+34]) { fail(2u); }
  for(var w=3u;w<=15u;w++) { if(field[w]!=atomicLoad(&control[w])) { fail(4u); } }
  if(atomicLoad(&control[16])!=params.y) { fail(8u); }
  atomicAdd(&control[16],1u);
}
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=params.x || atomicLoad(&control[2])!=0u) {return;}
  if(field[field[24]+row*32u+3u]!=1u) {return;}
  if(atomicAdd(&selected[row],1u)!=0u) {fail(16u);return;}
  for(var w=0u;w<8u;w++) {output_s[row*8u+w]=input_s[row*8u+w];}
  for(var w=0u;w<32u;w++) {output_m[row*32u+w]=input_m[row*32u+w];}
}
@compute @workgroup_size(64) fn check_coverage(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=params.x) {return;}
  let expected=select(0u,1u,bitcast<f32>(input_s[row*8u+3u])>0.0);
  if(atomicLoad(&selected[row])!=expected) {fail(32u);}
}
@compute @workgroup_size(64) fn finalize(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=params.x) {return;}
  if(atomicLoad(&control[2])!=0u || atomicLoad(&selected[row])==0u) {
    for(var w=0u;w<8u;w++) {output_s[row*8u+w]=input_s[row*8u+w];}
    for(var w=0u;w<32u;w++) {output_m[row*32u+w]=input_m[row*32u+w];}
  }
  if(row==0u) {atomicStore(&control[0],0x53475031u);atomicStore(&control[1],select(3u,5u,atomicLoad(&control[2])!=0u));}
}`;
    const tuple = (field, s, m, i) => [ro(field), ro(s), ro(m), stateBuffer, mechanicsBuffer,
      selected, controlBuffer, { buffer: params[i], type: 'uniform' }];
    return { stateBuffer, mechanicsBuffer, controlBuffer, validationBuffer, quantityBuffer, projectionBuffer,
      destroy() { for (const b of buffers) b.destroy(); },
      encode(encoder, candidates) {
        encoder.clearBuffer(selected); encoder.clearBuffer(controlBuffer); encoder.clearBuffer(validationBuffer);
        encoder.copyBufferToBuffer(publication.controlBuffer, 12, controlBuffer, 12, 13 * 4);
        const sourceGate = /* wgsl */ `
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<u32>;
@group(0) @binding(2) var<uniform> expected:array<vec4<u32>,2>;
@compute @workgroup_size(1) fn source_gate() {
  if(source[0]!=0x53435331u || source[1]!=1u || source[2]!=3u || source[16]!=expected[0].z
    || source[17]!=expected[1].x || source[18]!=0u
    || source[19]!=expected[0].z || source[20]!=3u) {control[2]|=1u;}
}`;
        dispatch(encoder,sourceGate,'source_gate',[ro(publication.controlBuffer),controlBuffer,
          {buffer:params[0],type:'uniform'}]);
        for (const [i, candidate] of candidates.entries()) {
          const field=publication.updates[i].mechanicsFieldViewBuffer;
          const resources=tuple(field,candidate.stateBuffer,candidate.mechanicsBuffer,i);
          dispatch(encoder,shader,'admit_level',resources);
          dispatch(encoder,shader,'gather',resources,Math.ceil(count/64));
          if (sourceQuantities) {
            const stride=sourceQuantities.quantityLayout.recordWords;
            const qshader=/* wgsl */ `
@group(0) @binding(0) var<storage,read> field:array<u32>;
@group(0) @binding(1) var<storage,read> q:array<u32>;
@group(0) @binding(2) var<storage,read> p:array<u32>;
@group(0) @binding(3) var<storage,read> validation:array<u32>;
@group(0) @binding(4) var<storage,read_write> out_q:array<u32>;
@group(0) @binding(5) var<storage,read_write> out_p:array<u32>;
@group(0) @binding(6) var<storage,read_write> control:array<atomic<u32>>;
@compute @workgroup_size(64) fn quantities(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=field[16]) {return;}
  if(validation[0]!=0u) {atomicOr(&control[2],64u);}
  if(field[field[24]+row*32u+3u]!=1u) {return;}
  for(var w=0u;w<${stride}u;w++) {out_q[row*${stride}u+w]=q[row*${stride}u+w];}
  for(var w=0u;w<12u;w++) {out_p[row*12u+w]=p[row*12u+w];}
}`;
            const q=candidate.quantities;
            dispatch(encoder,qshader,'quantities',[ro(field),ro(q.quantityBuffer),ro(q.projectionBuffer),
              ro(q.validationBuffer),quantityBuffer,projectionBuffer,controlBuffer],Math.ceil(count/64));
          }
        }
        const finalResources=tuple(publication.updates[0].mechanicsFieldViewBuffer,sourceStateBuffer,sourceMechanicsBuffer,0);
        dispatch(encoder,shader,'check_coverage',finalResources,Math.ceil(count/64));
        dispatch(encoder,shader,'finalize',finalResources,Math.ceil(count/64));
        if(sourceQuantities) {
          const stride=sourceQuantities.quantityLayout.recordWords;
          const code=/* wgsl */ `
@group(0) @binding(0) var<storage,read> control:array<u32>;
@group(0) @binding(1) var<storage,read> original:array<u32>;
@group(0) @binding(2) var<storage,read> selected:array<u32>;
@group(0) @binding(3) var<storage,read_write> q:array<u32>;
@group(0) @binding(4) var<storage,read_write> p:array<u32>;
@group(0) @binding(5) var<storage,read_write> validation:array<u32>;
@compute @workgroup_size(64) fn finalize_quantities(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;if(row>=arrayLength(&selected)) {return;}
  if(control[2]!=0u || selected[row]==0u) {
    for(var w=0u;w<${stride}u;w++) {q[row*${stride}u+w]=original[row*${stride}u+w];}
    for(var w=0u;w<12u;w++) {p[row*12u+w]=0u;}
  }
  if(row==0u) {validation[0]=control[2];}
}`;
          dispatch(encoder,code,'finalize_quantities',[ro(controlBuffer),ro(sourceQuantities.quantityBuffer),ro(selected),
            quantityBuffer,projectionBuffer,validationBuffer],Math.ceil(count/64));
        }
      }
    };
  } catch(error) {for(const b of buffers)b.destroy();throw error;}
}
