import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_STATUS,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND,
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION
} from './schroederParticleStorageResidencyGpu.js';

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

export const ULG_SCHROEDER_PARTICLE_STORAGE_CONTINUATION_SELECTION_SCHEMA =
  'peercompute.ulg.schroeder-particle-storage-continuation-selection.v0';
export const SCHROEDER_PARTICLE_STORAGE_CONTINUATION_WORKGROUP_SIZE = 64;

export const schroederParticleStorageContinuationSelectionWgsl = /* wgsl */ `
struct SelectionParams {
  fallback_particle_count: u32,
  output_particle_capacity: u32,
  generation_id: u32,
  workgroup_size: u32,
  state_vec4_stride: u32,
  thermo_vec4_stride: u32,
  mechanics_vec4_stride: u32,
  flags: u32,
};

@group(0) @binding(0) var<storage, read> fallback_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> fallback_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> fallback_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> candidate_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> candidate_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> candidate_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> selected_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> selected_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> selected_mechanics: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read> candidate_metadata: array<u32>;
@group(0) @binding(10) var<storage, read_write> selected_metadata: array<u32>;
@group(0) @binding(11) var<storage, read_write> selected_dispatch: array<u32>;
@group(0) @binding(12) var<uniform> params: SelectionParams;
@group(0) @binding(13) var<storage, read> candidate_dispatch: array<u32>;

const RESIDENCY_MAGIC: u32 = 0x53535052u;
const RESIDENCY_VERSION: u32 = 1u;
const RESIDENCY_STATUS_READY: u32 = 1u;
const SUMMARY_KIND_COMPACTION: u32 = 2u;

fn candidate_ready() -> bool {
  return candidate_metadata[0] == RESIDENCY_MAGIC
    && candidate_metadata[1] == RESIDENCY_VERSION
    && candidate_metadata[2] == RESIDENCY_STATUS_READY
    && candidate_metadata[3] == SUMMARY_KIND_COMPACTION
    && candidate_metadata[9] == 0u
    && candidate_metadata[10] == params.generation_id
    && candidate_metadata[4] <= params.output_particle_capacity;
}

fn copy_particle(
  particle_index: u32,
  source_state: ptr<storage, array<vec4<f32>>, read>,
  source_thermo: ptr<storage, array<vec4<f32>>, read>,
  source_mechanics: ptr<storage, array<vec4<f32>>, read>
) {
  for (var part = 0u; part < params.state_vec4_stride; part = part + 1u) {
    selected_state[particle_index * params.state_vec4_stride + part] =
      (*source_state)[particle_index * params.state_vec4_stride + part];
  }
  for (var part = 0u; part < params.thermo_vec4_stride; part = part + 1u) {
    selected_thermo[particle_index * params.thermo_vec4_stride + part] =
      (*source_thermo)[particle_index * params.thermo_vec4_stride + part];
  }
  for (var part = 0u; part < params.mechanics_vec4_stride; part = part + 1u) {
    selected_mechanics[particle_index * params.mechanics_vec4_stride + part] =
      (*source_mechanics)[particle_index * params.mechanics_vec4_stride + part];
  }
}

@compute @workgroup_size(64)
fn copy_fallback(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.fallback_particle_count || gid.x >= params.output_particle_capacity) {
    return;
  }
  copy_particle(gid.x, &fallback_state, &fallback_thermo, &fallback_mechanics);
}

@compute @workgroup_size(64)
fn copy_candidate(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!candidate_ready() || gid.x >= candidate_metadata[4]) {
    return;
  }
  copy_particle(gid.x, &candidate_state, &candidate_thermo, &candidate_mechanics);
}

@compute @workgroup_size(1)
fn init_fallback_metadata() {
  selected_metadata[0] = RESIDENCY_MAGIC;
  selected_metadata[1] = RESIDENCY_VERSION;
  selected_metadata[2] = RESIDENCY_STATUS_READY;
  selected_metadata[3] = SUMMARY_KIND_COMPACTION;
  selected_metadata[4] = params.fallback_particle_count;
  selected_metadata[5] = params.fallback_particle_count;
  selected_metadata[6] = params.output_particle_capacity;
  selected_metadata[7] = 0u;
  selected_metadata[8] = 0u;
  selected_metadata[9] = 0u;
  selected_metadata[10] = params.generation_id;
  selected_metadata[11] = params.flags;
  selected_metadata[12] = params.fallback_particle_count;
  selected_metadata[13] = params.fallback_particle_count;
  selected_metadata[14] = 0u;
  selected_metadata[15] = 0u;
  selected_dispatch[0] = (params.fallback_particle_count + params.workgroup_size - 1u)
    / params.workgroup_size;
  selected_dispatch[1] = 1u;
  selected_dispatch[2] = 1u;
  selected_dispatch[3] = 1u;
  selected_dispatch[4] = 1u;
  selected_dispatch[5] = 1u;
}

@compute @workgroup_size(1)
fn select_candidate_metadata() {
  if (!candidate_ready()) {
    return;
  }
  for (var word = 0u; word < 16u; word = word + 1u) {
    selected_metadata[word] = candidate_metadata[word];
  }
  for (var word = 0u; word < 6u; word = word + 1u) {
    selected_dispatch[word] = candidate_dispatch[word];
  }
}
`;

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function createSelectionParamsArray({ fallbackParticleCount, outputParticleCapacity, generationId }) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, nonNegativeInteger(fallbackParticleCount), true);
  view.setUint32(4, nonNegativeInteger(outputParticleCapacity), true);
  view.setUint32(8, nonNegativeInteger(generationId), true);
  view.setUint32(12, SCHROEDER_PARTICLE_STORAGE_CONTINUATION_WORKGROUP_SIZE, true);
  view.setUint32(16, SPH_GPU_PARTICLE_STATE_FLOATS / 4, true);
  view.setUint32(20, SPH_GPU_PARTICLE_THERMO_FLOATS / 4, true);
  view.setUint32(24, MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS / 4, true);
  view.setUint32(28, 1, true);
  return buffer;
}

export function encodeSchroederParticleStorageContinuationSelectionWebGpu({
  device,
  commandEncoder,
  particleStorageResidencyAdoptionCandidate,
  fallbackStateBuffer,
  fallbackThermoBuffer,
  fallbackMechanicsBuffer,
  fallbackParticleCount,
  label = 'ulg-schroeder-particle-storage-continuation-selection'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('Schroeder continuation selection requires a WebGPU-like device');
  }
  if (!commandEncoder?.beginComputePass) {
    throw new TypeError('Schroeder continuation selection requires a caller-owned command encoder');
  }
  const candidate = particleStorageResidencyAdoptionCandidate;
  if (
    candidate?.ready !== true
    || !candidate.stateBuffer
    || !candidate.thermoBuffer
    || !candidate.mechanicsBuffer
    || !candidate.residencyMetadataBuffer
    || !candidate.residencyDispatchIndirectBuffer
  ) {
    throw new TypeError('Schroeder continuation selection requires a ready same-device candidate');
  }
  if (!fallbackStateBuffer || !fallbackThermoBuffer || !fallbackMechanicsBuffer) {
    throw new TypeError('Schroeder continuation selection requires complete fallback mechanics buffers');
  }
  const capacity = nonNegativeInteger(candidate.outputParticleCapacity);
  const fallbackCount = nonNegativeInteger(fallbackParticleCount);
  const generationId = nonNegativeInteger(candidate.generationId);
  if (capacity <= 0 || fallbackCount > capacity || generationId <= 0) {
    throw new RangeError('Schroeder continuation selection count, capacity, or generation is invalid');
  }
  if (fallbackCount !== nonNegativeInteger(candidate.sourceParticleCount)) {
    throw new RangeError('Schroeder continuation fallback count must match the candidate source epoch');
  }
  const stateByteLength = capacity * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const thermoByteLength = capacity * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const mechanicsByteLength = capacity
    * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const createOutput = (role, size) => device.createBuffer({
    label: `${label}-${role}`,
    size: Math.max(4, size),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const stateBuffer = createOutput('state-out', stateByteLength);
  const thermoBuffer = createOutput('thermo-out', thermoByteLength);
  const mechanicsBuffer = createOutput('mechanics-out', mechanicsByteLength);
  const metadataBuffer = device.createBuffer({
    label: `${label}-metadata-out`,
    size: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const dispatchIndirectBuffer = device.createBuffer({
    label: `${label}-dispatch-indirect-out`,
    size: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
      | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: `${label}-params`,
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createSelectionParamsArray({
    fallbackParticleCount: fallbackCount,
    outputParticleCapacity: capacity,
    generationId
  }));
  const binding = (index, type) => computeBufferBinding(index, type);
  const pipelineFor = (entryPoint, bindings) => createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-schroeder-particle-storage-continuation-selection.${entryPoint}.v0`,
    label: `${label}-${entryPoint}`,
    code: schroederParticleStorageContinuationSelectionWgsl,
    entryPoint,
    bindings
  });
  const pipelines = {
    copyFallback: pipelineFor('copy_fallback', [
      binding(0, 'read-only-storage'),
      binding(1, 'read-only-storage'),
      binding(2, 'read-only-storage'),
      binding(6, 'storage'),
      binding(7, 'storage'),
      binding(8, 'storage'),
      binding(12, 'uniform')
    ]),
    copyCandidate: pipelineFor('copy_candidate', [
      binding(3, 'read-only-storage'),
      binding(4, 'read-only-storage'),
      binding(5, 'read-only-storage'),
      binding(6, 'storage'),
      binding(7, 'storage'),
      binding(8, 'storage'),
      binding(9, 'read-only-storage'),
      binding(12, 'uniform')
    ]),
    initFallbackMetadata: pipelineFor('init_fallback_metadata', [
      binding(10, 'storage'),
      binding(11, 'storage'),
      binding(12, 'uniform')
    ]),
    selectCandidateMetadata: pipelineFor('select_candidate_metadata', [
      binding(9, 'read-only-storage'),
      binding(10, 'storage'),
      binding(11, 'storage'),
      binding(12, 'uniform'),
      binding(13, 'read-only-storage')
    ])
  };
  const buffersByBinding = [
    fallbackStateBuffer,
    fallbackThermoBuffer,
    fallbackMechanicsBuffer,
    candidate.stateBuffer,
    candidate.thermoBuffer,
    candidate.mechanicsBuffer,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    candidate.residencyMetadataBuffer,
    metadataBuffer,
    dispatchIndirectBuffer,
    paramsBuffer,
    candidate.residencyDispatchIndirectBuffer
  ];
  const bindGroupFor = (pipeline, bindingIndices) => device.createBindGroup({
    layout: pipeline.bindGroupLayout,
    entries: bindingIndices.map((bindingIndex) => ({
      binding: bindingIndex,
      resource: { buffer: buffersByBinding[bindingIndex] }
    }))
  });
  const fallbackPass = commandEncoder.beginComputePass({ label: `${label}-copy-fallback-pass` });
  fallbackPass.setPipeline(pipelines.copyFallback.pipeline);
  fallbackPass.setBindGroup(0, bindGroupFor(pipelines.copyFallback, [0, 1, 2, 6, 7, 8, 12]));
  fallbackPass.dispatchWorkgroups(Math.max(
    1,
    Math.ceil(fallbackCount / SCHROEDER_PARTICLE_STORAGE_CONTINUATION_WORKGROUP_SIZE)
  ));
  fallbackPass.end();

  const candidatePass = commandEncoder.beginComputePass({ label: `${label}-copy-candidate-pass` });
  candidatePass.setPipeline(pipelines.copyCandidate.pipeline);
  candidatePass.setBindGroup(0, bindGroupFor(pipelines.copyCandidate, [3, 4, 5, 6, 7, 8, 9, 12]));
  candidatePass.dispatchWorkgroupsIndirect(
    candidate.residencyDispatchIndirectBuffer,
    candidate.activeDispatchIndirectByteOffset
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET
  );
  candidatePass.end();

  const initPass = commandEncoder.beginComputePass({ label: `${label}-init-metadata-pass` });
  initPass.setPipeline(pipelines.initFallbackMetadata.pipeline);
  initPass.setBindGroup(0, bindGroupFor(pipelines.initFallbackMetadata, [10, 11, 12]));
  initPass.dispatchWorkgroups(1);
  initPass.end();

  const selectPass = commandEncoder.beginComputePass({ label: `${label}-select-metadata-pass` });
  selectPass.setPipeline(pipelines.selectCandidateMetadata.pipeline);
  selectPass.setBindGroup(0, bindGroupFor(
    pipelines.selectCandidateMetadata,
    [9, 10, 11, 12, 13]
  ));
  selectPass.dispatchWorkgroupsIndirect(
    candidate.residencyDispatchIndirectBuffer,
    candidate.selectionDispatchIndirectByteOffset
      ?? SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET
  );
  selectPass.end();

  let transientReleased = false;
  let destroyed = false;
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_CONTINUATION_SELECTION_SCHEMA,
    status: 'schroeder-particle-storage-continuation-selection-encoded-awaiting-submit',
    ready: true,
    adopted: false,
    conditionalGpuAdoption: true,
    device: candidate.device ?? device,
    generationId,
    sourceParticleCount: fallbackCount,
    outputParticleCapacity: capacity,
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: 'gpu-authored-residency-metadata',
    authoritativeParticleCountMetadataWord:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    stateBufferByteLength: stateByteLength,
    thermoBufferByteLength: thermoByteLength,
    mechanicsBufferByteLength: mechanicsByteLength,
    stateStrideBytes: SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    mechanicsStrideBytes:
      MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    residencyMetadataBuffer: metadataBuffer,
    residencyDispatchIndirectBuffer: dispatchIndirectBuffer,
    activeDispatchIndirectByteOffset:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
    selectionDispatchIndirectByteOffset:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
    admissionToken: candidate.admissionToken,
    targetStateFamilies: [...(candidate.targetStateFamilies || [])],
    retainedBufferRefs: [...(candidate.retainedBufferRefs || [])],
    fallbackSelectionPolicy:
      'normal-mechanics-unless-valid-topology-candidate-selected-on-gpu',
    candidateSelectionAuthority:
      'metadata-magic-version-ready-generation-zero-invalid-mask-and-indirect-selection',
    fallbackDispatchMode: 'host-known-source-epoch-count-no-readback',
    candidateDispatchMode: 'gpu-authored-active-count-indirect',
    metadataSelectionDispatchMode: 'gpu-authored-selection-indirect',
    normalHotLoopReadbackFree: true,
    compactSummaryReadbackPerformed: false,
    mapAsyncCalled: false,
    fullParticleReadbackPerformed: false,
    releaseTransientBuffers() {
      if (transientReleased) return;
      transientReleased = true;
      paramsBuffer.destroy?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stateBuffer.destroy?.();
      thermoBuffer.destroy?.();
      mechanicsBuffer.destroy?.();
      metadataBuffer.destroy?.();
      dispatchIndirectBuffer.destroy?.();
      candidate.destroy?.();
    }
  };
}

export const SCHROEDER_PARTICLE_STORAGE_CONTINUATION_SELECTION_EXPECTED_METADATA =
  Object.freeze({
    magic: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
    version: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION,
    readyStatus: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_STATUS.ready,
    summaryKind: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND.compaction
  });
