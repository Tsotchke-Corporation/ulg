import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

export const ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_SCHEMA =
  'peercompute.ulg.schroeder-particle-storage-residency-metadata.v0';
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC = 0x53535052;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION = 1;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_STATUS = Object.freeze({
  failClosed: 0,
  ready: 1,
  noTopologyChange: 2
});
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SUMMARY_KIND = Object.freeze({
  count: 1,
  compaction: 2
});
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA = Object.freeze({
  magic: 0,
  version: 1,
  status: 2,
  summaryKind: 3,
  authoritativeActiveCount: 4,
  sourceParticleCount: 5,
  outputParticleCapacity: 6,
  admittedParticleCountDeltaBits: 7,
  freedHoleCount: 8,
  invalidReasonMask: 9,
  generationId: 10,
  flags: 11,
  scannedCount: 12,
  writtenTargetCount: 13,
  appendedTargetCount: 14,
  reserved: 15
});
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_WORDS = 16;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES =
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET = 0;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET =
  3 * Uint32Array.BYTES_PER_ELEMENT;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_WORDS = 6;
export const SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES =
  SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_WORDS * Uint32Array.BYTES_PER_ELEMENT;

export const schroederParticleStorageResidencyFinalizeWgsl = /* wgsl */ `
struct ResidencyFinalizeParams {
  output_particle_capacity: u32,
  consumer_workgroup_size: u32,
  summary_kind: u32,
  generation_id: u32,
  flags: u32,
  expected_source_particle_count: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> summary_row: array<f32>;
@group(0) @binding(1) var<storage, read_write> residency_metadata: array<u32>;
@group(0) @binding(2) var<storage, read_write> residency_dispatch: array<u32>;
@group(0) @binding(3) var<uniform> params: ResidencyFinalizeParams;

const RESIDENCY_MAGIC: u32 = 0x53535052u;
const RESIDENCY_VERSION: u32 = 1u;
const RESIDENCY_STATUS_FAIL_CLOSED: u32 = 0u;
const RESIDENCY_STATUS_READY: u32 = 1u;
const RESIDENCY_STATUS_NO_TOPOLOGY_CHANGE: u32 = 2u;
const SUMMARY_KIND_COUNT: u32 = 1u;
const SUMMARY_KIND_COMPACTION: u32 = 2u;

fn finite_non_negative_integer(value: f32, maximum: u32) -> bool {
  return value >= 0.0 && value <= f32(maximum) && floor(value) == value;
}

@compute @workgroup_size(1)
fn main() {
  residency_metadata[0] = RESIDENCY_MAGIC;
  residency_metadata[1] = RESIDENCY_VERSION;
  residency_metadata[2] = RESIDENCY_STATUS_FAIL_CLOSED;
  residency_metadata[3] = params.summary_kind;
  residency_metadata[4] = 0u;
  residency_metadata[5] = 0u;
  residency_metadata[6] = params.output_particle_capacity;
  residency_metadata[7] = 0u;
  residency_metadata[8] = 0u;
  residency_metadata[9] = 0u;
  residency_metadata[10] = params.generation_id;
  residency_metadata[11] = params.flags;
  residency_metadata[12] = 0u;
  residency_metadata[13] = 0u;
  residency_metadata[14] = 0u;
  residency_metadata[15] = 0u;
  residency_dispatch[0] = 0u;
  residency_dispatch[1] = 1u;
  residency_dispatch[2] = 1u;
  residency_dispatch[3] = 0u;
  residency_dispatch[4] = 1u;
  residency_dispatch[5] = 1u;

  var source_value = 0.0;
  var active_value = 0.0;
  var delta_value = 0.0;
  var holes_value = 0.0;
  var scanned_value = 0.0;
  var written_value = 0.0;
  var appended_value = 0.0;
  if (params.summary_kind == SUMMARY_KIND_COUNT) {
    scanned_value = summary_row[0];
    written_value = summary_row[2];
    appended_value = summary_row[3];
    holes_value = summary_row[4];
    delta_value = summary_row[5];
    source_value = summary_row[10];
    active_value = summary_row[11];
  } else if (params.summary_kind == SUMMARY_KIND_COMPACTION) {
    scanned_value = summary_row[0];
    active_value = summary_row[1];
    holes_value = summary_row[2];
    source_value = summary_row[4];
    delta_value = summary_row[5];
  } else {
    residency_metadata[9] = 1u << 0u;
    return;
  }

  var invalid_reason_mask = 0u;
  if (summary_row[14] != 1.0) {
    invalid_reason_mask = invalid_reason_mask | (1u << 1u);
  }
  if (!finite_non_negative_integer(source_value, params.output_particle_capacity)) {
    invalid_reason_mask = invalid_reason_mask | (1u << 2u);
  }
  if (source_value != f32(params.expected_source_particle_count)) {
    invalid_reason_mask = invalid_reason_mask | (1u << 11u);
  }
  if (!finite_non_negative_integer(active_value, params.output_particle_capacity)) {
    invalid_reason_mask = invalid_reason_mask | (1u << 3u);
  }
  if (!finite_non_negative_integer(holes_value, params.output_particle_capacity)) {
    invalid_reason_mask = invalid_reason_mask | (1u << 4u);
  }
  if (!(delta_value >= -f32(params.output_particle_capacity)
      && delta_value <= f32(params.output_particle_capacity)
      && floor(delta_value) == delta_value)) {
    invalid_reason_mask = invalid_reason_mask | (1u << 5u);
  }
  if (active_value != source_value + delta_value) {
    invalid_reason_mask = invalid_reason_mask | (1u << 6u);
  }
  if (params.summary_kind == SUMMARY_KIND_COUNT
      && holes_value > 0.0
      && written_value <= 0.0) {
    invalid_reason_mask = invalid_reason_mask | (1u << 7u);
  }
  if (params.summary_kind == SUMMARY_KIND_COMPACTION
      && !finite_non_negative_integer(scanned_value, params.output_particle_capacity)) {
    invalid_reason_mask = invalid_reason_mask | (1u << 8u);
  }
  if (params.summary_kind == SUMMARY_KIND_COUNT
      && (!finite_non_negative_integer(written_value, params.output_particle_capacity)
        || !finite_non_negative_integer(appended_value, params.output_particle_capacity))) {
    invalid_reason_mask = invalid_reason_mask | (1u << 9u);
  }
  if (params.summary_kind == SUMMARY_KIND_COUNT && delta_value != appended_value) {
    invalid_reason_mask = invalid_reason_mask | (1u << 10u);
  }

  residency_metadata[9] = invalid_reason_mask;
  if (invalid_reason_mask != 0u) {
    return;
  }

  let source_count = u32(source_value);
  let active_count = u32(active_value);
  let holes = u32(holes_value);
  let topology_changed = params.summary_kind == SUMMARY_KIND_COMPACTION
    || written_value > 0.0
    || appended_value > 0.0
    || holes > 0u;
  let status = select(
    RESIDENCY_STATUS_NO_TOPOLOGY_CHANGE,
    RESIDENCY_STATUS_READY,
    topology_changed
  );
  residency_metadata[2] = status;
  residency_metadata[4] = active_count;
  residency_metadata[5] = source_count;
  residency_metadata[7] = bitcast<u32>(i32(delta_value));
  residency_metadata[8] = holes;
  residency_metadata[12] = u32(max(scanned_value, 0.0));
  residency_metadata[13] = u32(max(written_value, 0.0));
  residency_metadata[14] = u32(max(appended_value, 0.0));
  if (status == RESIDENCY_STATUS_READY) {
    let workgroup_size = max(params.consumer_workgroup_size, 1u);
    residency_dispatch[0] = (active_count + workgroup_size - 1u) / workgroup_size;
    residency_dispatch[3] = 1u;
  }
}
`;

// The retained count metadata limits this pass to the materialized high-water
// range. Capacity tail is never inspected, even if a reused arena contains
// stale positive masses beyond the GPU-authored active count.
export const schroederParticleStorageResidentCompactionWgsl = /* wgsl */ `
struct SchroederParticleStorageCompactionParams {
  scan_slot_count: u32,
  state_vec4_stride: u32,
  thermo_vec4_stride: u32,
  mechanics_vec4_stride: u32,
  source_particle_count: u32,
  flags: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> in_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> in_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> summary_row: array<f32>;
@group(0) @binding(7) var<uniform> params: SchroederParticleStorageCompactionParams;
@group(0) @binding(8) var<storage, read> count_residency_metadata: array<u32>;

const WORKGROUP_SIZE: u32 = 64u;
const RESIDENCY_MAGIC: u32 = 0x53535052u;
const RESIDENCY_VERSION: u32 = 1u;
const RESIDENCY_STATUS_READY: u32 = 1u;
const SUMMARY_KIND_COUNT: u32 = 1u;

var<workgroup> live_counts: array<u32, 64>;
var<workgroup> chunk_bases: array<u32, 64>;
var<workgroup> live_mass: array<f32, 64>;
var<workgroup> hole_count: array<f32, 64>;

fn trusted_scan_slot_count() -> u32 {
  let ready = count_residency_metadata[0] == RESIDENCY_MAGIC
    && count_residency_metadata[1] == RESIDENCY_VERSION
    && count_residency_metadata[2] == RESIDENCY_STATUS_READY
    && count_residency_metadata[3] == SUMMARY_KIND_COUNT
    && count_residency_metadata[9] == 0u;
  return select(0u, min(params.scan_slot_count, count_residency_metadata[4]), ready);
}

fn slot_live(slot: u32) -> bool {
  let state_stride = max(params.state_vec4_stride, 2u);
  return in_sph_state[slot * state_stride].w > 0.0;
}

fn copy_slot(source_slot: u32, target_slot: u32) {
  let state_stride = max(params.state_vec4_stride, 2u);
  let thermo_stride = max(params.thermo_vec4_stride, 3u);
  let mechanics_stride = max(params.mechanics_vec4_stride, 8u);
  for (var part = 0u; part < state_stride; part = part + 1u) {
    out_sph_state[target_slot * state_stride + part] = in_sph_state[source_slot * state_stride + part];
  }
  for (var part = 0u; part < thermo_stride; part = part + 1u) {
    out_sph_thermo[target_slot * thermo_stride + part] = in_sph_thermo[source_slot * thermo_stride + part];
  }
  for (var part = 0u; part < mechanics_stride; part = part + 1u) {
    out_mls_mechanics[target_slot * mechanics_stride + part] =
      in_mls_mechanics[source_slot * mechanics_stride + part];
  }
}

@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let local_index = local_id.x;
  let scan_slot_count = trusted_scan_slot_count();
  let chunk = (scan_slot_count + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
  let chunk_start = local_index * chunk;
  let chunk_end = min(chunk_start + chunk, scan_slot_count);

  var local_live_count = 0u;
  var local_live_mass = 0.0;
  var local_hole_count = 0.0;
  for (var slot = chunk_start; slot < chunk_end; slot = slot + 1u) {
    if (slot_live(slot)) {
      local_live_count = local_live_count + 1u;
      local_live_mass = local_live_mass
        + in_sph_state[slot * max(params.state_vec4_stride, 2u)].w;
    } else {
      local_hole_count = local_hole_count + 1.0;
    }
  }
  live_counts[local_index] = local_live_count;
  live_mass[local_index] = local_live_mass;
  hole_count[local_index] = local_hole_count;
  workgroupBarrier();

  if (local_index == 0u) {
    var base = 0u;
    for (var index = 0u; index < WORKGROUP_SIZE; index = index + 1u) {
      chunk_bases[index] = base;
      base = base + live_counts[index];
    }
  }
  workgroupBarrier();

  var target_slot = chunk_bases[local_index];
  for (var slot = chunk_start; slot < chunk_end; slot = slot + 1u) {
    if (slot_live(slot)) {
      copy_slot(slot, target_slot);
      target_slot = target_slot + 1u;
    }
  }
  workgroupBarrier();

  if (local_index == 0u) {
    var total_live = 0.0;
    var total_mass = 0.0;
    var total_holes = 0.0;
    for (var index = 0u; index < WORKGROUP_SIZE; index = index + 1u) {
      total_live = total_live + f32(live_counts[index]);
      total_mass = total_mass + live_mass[index];
      total_holes = total_holes + hole_count[index];
    }
    summary_row[0] = f32(scan_slot_count);
    summary_row[1] = total_live;
    summary_row[2] = total_holes;
    summary_row[3] = total_mass;
    summary_row[4] = f32(params.source_particle_count);
    summary_row[5] = total_live - f32(params.source_particle_count);
    summary_row[6] = 0.0;
    summary_row[7] = 0.0;
    summary_row[8] = 0.0;
    summary_row[9] = 0.0;
    summary_row[10] = 0.0;
    summary_row[11] = total_live;
    summary_row[12] = 0.0;
    summary_row[13] = 0.0;
    summary_row[14] = select(0.0, 1.0, scan_slot_count > 0u);
    summary_row[15] = f32(params.flags);
  }
}
`;

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

export function createSchroederParticleStorageResidencyFinalizeParamsArray({
  outputParticleCapacity,
  consumerWorkgroupSize = 64,
  summaryKind,
  generationId = 0,
  sourceParticleCount = 0,
  flags = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, nonNegativeInteger(outputParticleCapacity), true);
  view.setUint32(4, Math.max(1, nonNegativeInteger(consumerWorkgroupSize, 64)), true);
  view.setUint32(8, nonNegativeInteger(summaryKind), true);
  view.setUint32(12, nonNegativeInteger(generationId), true);
  view.setUint32(16, nonNegativeInteger(flags), true);
  view.setUint32(20, nonNegativeInteger(sourceParticleCount), true);
  return buffer;
}

export function createSchroederParticleStorageResidencyBuffers(device, {
  label = 'ulg-schroeder-particle-storage-residency'
} = {}) {
  if (!device?.createBuffer) {
    throw new TypeError('Schroeder particle-storage residency buffers require a WebGPU-like device');
  }
  return {
    metadataBuffer: device.createBuffer({
      label: `${label}-metadata`,
      size: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    }),
    dispatchIndirectBuffer: device.createBuffer({
      label: `${label}-dispatch-indirect`,
      size: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT
        | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    })
  };
}

export function encodeSchroederParticleStorageResidencyFinalizeWebGpu({
  device,
  commandEncoder,
  summaryBuffer,
  outputParticleCapacity,
  summaryKind,
  generationId = 0,
  sourceParticleCount = 0,
  consumerWorkgroupSize = 64,
  flags = 0,
  metadataBuffer = null,
  dispatchIndirectBuffer = null,
  label = 'ulg-schroeder-particle-storage-residency'
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('Schroeder particle-storage residency finalize requires a WebGPU-like device');
  }
  if (!commandEncoder?.beginComputePass || !commandEncoder?.clearBuffer) {
    throw new TypeError('Schroeder particle-storage residency finalize requires a caller-owned command encoder');
  }
  if (!summaryBuffer) {
    throw new TypeError('Schroeder particle-storage residency finalize requires a retained summary buffer');
  }
  const resolvedCapacity = nonNegativeInteger(outputParticleCapacity, 0);
  const resolvedGenerationId = nonNegativeInteger(generationId, 0);
  const resolvedSourceParticleCount = nonNegativeInteger(sourceParticleCount, 0);
  if (resolvedCapacity <= 0) {
    throw new RangeError('Schroeder particle-storage residency finalize requires positive output capacity');
  }
  if (resolvedGenerationId <= 0) {
    throw new RangeError('Schroeder particle-storage residency finalize requires a positive generation');
  }
  if (resolvedSourceParticleCount > resolvedCapacity) {
    throw new RangeError('Schroeder particle-storage residency source count exceeds output capacity');
  }
  const ownedBuffers = !metadataBuffer || !dispatchIndirectBuffer;
  if ((metadataBuffer && !dispatchIndirectBuffer) || (!metadataBuffer && dispatchIndirectBuffer)) {
    throw new TypeError('Schroeder particle-storage residency metadata and indirect buffers must be supplied together');
  }
  const buffers = ownedBuffers
    ? createSchroederParticleStorageResidencyBuffers(device, { label })
    : { metadataBuffer, dispatchIndirectBuffer };
  const paramsBuffer = device.createBuffer({
    label: `${label}-finalize-params`,
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createSchroederParticleStorageResidencyFinalizeParamsArray({
    outputParticleCapacity,
    consumerWorkgroupSize,
    summaryKind,
    generationId: resolvedGenerationId,
    sourceParticleCount: resolvedSourceParticleCount,
    flags
  }));
  commandEncoder.clearBuffer(buffers.metadataBuffer);
  commandEncoder.clearBuffer(buffers.dispatchIndirectBuffer);
  const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-particle-storage-residency-finalize.v0',
    label: `${label}-finalize`,
    code: schroederParticleStorageResidencyFinalizeWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    label: `${label}-finalize-bind-group`,
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: summaryBuffer } },
      { binding: 1, resource: { buffer: buffers.metadataBuffer } },
      { binding: 2, resource: { buffer: buffers.dispatchIndirectBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const pass = commandEncoder.beginComputePass({ label: `${label}-finalize-pass` });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();

  let transientReleased = false;
  let retainedReleased = false;
  return {
    schema: ULG_SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_SCHEMA,
    status: 'schroeder-particle-storage-residency-metadata-encoded-awaiting-submit',
    device,
    generationId: resolvedGenerationId,
    summaryKind: nonNegativeInteger(summaryKind),
    sourceParticleCount: resolvedSourceParticleCount,
    outputParticleCapacity: resolvedCapacity,
    authoritativeParticleCount: null,
    authoritativeParticleCountAuthority: 'gpu-authored-residency-metadata',
    authoritativeParticleCountMetadataWord:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA.authoritativeActiveCount,
    metadataBuffer: buffers.metadataBuffer,
    metadataBufferByteLength: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA_BYTES,
    metadataLayout: { ...SCHROEDER_PARTICLE_STORAGE_RESIDENCY_METADATA },
    expectedMagic: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_MAGIC,
    expectedVersion: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_VERSION,
    dispatchIndirectBuffer: buffers.dispatchIndirectBuffer,
    dispatchIndirectBufferByteLength: SCHROEDER_PARTICLE_STORAGE_RESIDENCY_DISPATCH_BYTES,
    activeDispatchIndirectByteOffset:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_ACTIVE_DISPATCH_INDIRECT_BYTE_OFFSET,
    selectionDispatchIndirectByteOffset:
      SCHROEDER_PARTICLE_STORAGE_RESIDENCY_SELECTION_INDIRECT_BYTE_OFFSET,
    consumerGuardProtocol:
      'metadata-magic-version-ready-generation-zero-overflow-and-gid-before-active-count',
    failCloseProtocol: 'invalid-or-no-topology-metadata-authors-zero-indirect-x',
    pipelineCacheStatus: cacheStatus,
    fullReadbackPerformed: false,
    compactSummaryReadbackPerformed: false,
    mapAsyncCalled: false,
    normalHotLoopReadbackFree: true,
    queueSubmitPerformed: false,
    callerOwnsCommandEncoder: true,
    transientReleaseRequiresCompletedSubmitFence: true,
    releaseTransientBuffers() {
      if (transientReleased) return;
      transientReleased = true;
      paramsBuffer.destroy?.();
    },
    destroyRetainedBuffers() {
      if (!ownedBuffers || retainedReleased) return;
      retainedReleased = true;
      buffers.metadataBuffer.destroy?.();
      buffers.dispatchIndirectBuffer.destroy?.();
    }
  };
}
