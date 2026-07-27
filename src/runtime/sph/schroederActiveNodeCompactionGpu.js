// Priority 3, first increment: measure the active-node compaction on the GPU,
// for the scenario actually running, without changing an allocation or a
// consumer.
//
// The active-node list writes one row per particle. Measured off-line at the
// shipped geometry defaults, deduplicating those rows on their own AABB tuple
// collapses 4,096-32,768 particles to 8-27 distinct rows -- 500-1,300x -- with
// no over-approximation of the *geometry*: rows sharing a tuple are identical in
// every tile and support field.
//
// They are NOT identical in `sourceParticleIndex` (field 10) or position, and
// that matters: the law neighbour scan reads field 10 off a matched row to
// recover the neighbour particle. A compacted row carries one particle index, so
// that consumer must read the node -> members CSR published below instead of
// field 10. Compaction shrinks the overlap search -- the O(N^2) term -- it does
// not shrink the particle set, and treating it as though it did would silently
// drop every non-representative neighbour. (The other candidate, one row per occupied tile
// with a unioned support box, compacts further but inflates every consumer's
// scan range by 1.66x -> 5.94x as the domain grows, which is the O(N^2)
// behaviour the hierarchy exists to avoid. See
// `scripts/schroeder-active-node-compaction-probe.mjs`.)
//
// That measurement used a uniform single-material lattice, so its ratio is an
// upper bound. This runs the same key over the real rows so the ratio can be
// read per scenario before anything is resized around it.
//
// Deliberately evidence-only. Sizing the allocation by the unique count and
// adding the per-particle indirection is the next increment, and it needs this
// number first -- an allocation sized by a ratio nobody has measured on the real
// workload is how the candidate arena ended up reserving 4 KiB per particle.

import {
  SCHROEDER_ACTIVE_NODE_ROW_LAYOUT,
  WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import { createWebGpuStableRadixScanUnique } from '../webgpuRadixScanUnique.js';

export const SCHROEDER_ACTIVE_NODE_COMPACTION_SCHEMA =
  'peercompute.ulg.schroeder-active-node-compaction-evidence.v0';

const ACTIVE_NODE_FLOATS = SCHROEDER_ACTIVE_NODE_ROW_LAYOUT.length;

// level, chart, min_tile.xyz, max_tile.xyz. Exactly the fields that make two
// rows interchangeable to a consumer, and exactly 8 words -- the radix
// primitive's maximum key width, which is why this design fits it without
// widening anything.
export const SCHROEDER_ACTIVE_NODE_COMPACTION_KEY_WORDS = 8;

const WORKGROUP_SIZE = 64;
const UNIQUE_COUNT_WORD_INDEX = WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.indexOf('unique_count:u32');

const GPU_BUFFER_USAGE = {
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 0x80,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 0x04,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 0x08,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 0x40,
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 0x01
};
const GPU_MAP_MODE_READ = globalThis.GPUMapMode?.READ ?? 1;

export const schroederActiveNodeCompactionKeyWgsl = `
struct CompactionParams {
  row_count: u32,
  key_word_count: u32,
  active_node_stride: u32,
  reserved: u32
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read_write> sort_keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> row_evidence: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: CompactionParams;

// Radix sorts unsigned. Flipping the sign bit of a two's-complement integer is
// order preserving, so negative tile coordinates -- which occur as soon as a
// particle sits near the origin and its support box crosses it -- sort below
// positive ones instead of above them.
fn order_key(value: f32) -> u32 {
  return bitcast<u32>(i32(round(value))) ^ 0x80000000u;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= params.row_count) {
    return;
  }
  let at = row * params.active_node_stride;
  let key_at = row * params.key_word_count;
  let status = active_nodes[at + 11u];
  if (!(status > 0.0)) {
    // A rejected row is not a node. It gets a maximal sentinel so it sorts to
    // the end and forms exactly one group, which the host subtracts back out --
    // folding it into a real node's group would silently overcount compaction.
    for (var word = 0u; word < params.key_word_count; word = word + 1u) {
      sort_keys[key_at + word] = 0xffffffffu;
    }
    atomicAdd(&row_evidence[1], 1u);
    return;
  }
  atomicAdd(&row_evidence[0], 1u);
  sort_keys[key_at + 0u] = order_key(active_nodes[at + 0u]);
  sort_keys[key_at + 1u] = order_key(active_nodes[at + 15u]);
  sort_keys[key_at + 2u] = order_key(active_nodes[at + 1u]);
  sort_keys[key_at + 3u] = order_key(active_nodes[at + 2u]);
  sort_keys[key_at + 4u] = order_key(active_nodes[at + 3u]);
  sort_keys[key_at + 5u] = order_key(active_nodes[at + 4u]);
  sort_keys[key_at + 6u] = order_key(active_nodes[at + 5u]);
  sort_keys[key_at + 7u] = order_key(active_nodes[at + 6u]);
}
`;

// Emits the compacted list and the per-particle indirection, following the
// exact conventions the spatial epoch's directory assembly already uses -- this
// is not a fresh design, and two of its details are easy to get wrong:
//
//   * `sorted_group_indices` holds an INCLUSIVE HEAD COUNT, not a group index.
//     The group is `sorted_group_indices[p + 1] - 1`, or `unique_count - 1` at
//     the last position. Reading it as a group index directly would offset
//     every particle onto its neighbour's node.
//   * `unique_offsets[group]` is the sorted position that HEADS the group, so
//     `p == unique_offsets[group]` is the test for "this element is the
//     representative", which is what gets copied.
export const schroederActiveNodeCompactionEmitWgsl = `
struct EmitParams {
  row_count: u32,
  active_node_stride: u32,
  node_capacity: u32,
  reserved: u32
};

@group(0) @binding(0) var<storage, read> active_nodes: array<f32>;
@group(0) @binding(1) var<storage, read> sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read> sorted_group_indices: array<u32>;
@group(0) @binding(3) var<storage, read> unique_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> unique_evidence: array<u32>;
@group(0) @binding(5) var<storage, read_write> compacted_nodes: array<f32>;
@group(0) @binding(6) var<storage, read_write> node_index_by_particle: array<u32>;
@group(0) @binding(7) var<uniform> params: EmitParams;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let sorted_position = global_id.x;
  if (sorted_position >= params.row_count) {
    return;
  }
  let unique_count = unique_evidence[2];
  var inclusive_head_count = unique_count;
  if (sorted_position + 1u < params.row_count) {
    inclusive_head_count = sorted_group_indices[sorted_position + 1u];
  }
  if (inclusive_head_count == 0u) {
    return;
  }
  let group_index = inclusive_head_count - 1u;
  let source_index = sorted_indices[sorted_position];
  if (
    source_index >= params.row_count
    || group_index >= unique_count
    || group_index >= params.node_capacity
  ) {
    return;
  }
  node_index_by_particle[source_index] = group_index;
  if (sorted_position != unique_offsets[group_index]) {
    return;
  }
  let source_at = source_index * params.active_node_stride;
  let target_at = group_index * params.active_node_stride;
  let status = active_nodes[source_at + 11u];
  if (!(status > 0.0)) {
    // Every rejected row shares one sentinel group. Copying an arbitrary member
    // would publish one rejected particle's position as the whole group's, so
    // the slot is written canonically zero instead. Consumers gate on status
    // and skip it; nothing can read a misleading field out of it.
    for (var word = 0u; word < params.active_node_stride; word = word + 1u) {
      compacted_nodes[target_at + word] = 0.0;
    }
    return;
  }
  for (var word = 0u; word < params.active_node_stride; word = word + 1u) {
    compacted_nodes[target_at + word] = active_nodes[source_at + word];
  }
}
`;

function createEmitParamsArray({ rowCount, activeNodeStride, nodeCapacity }) {
  const params = new Uint32Array(4);
  params[0] = rowCount >>> 0;
  params[1] = activeNodeStride >>> 0;
  params[2] = nodeCapacity >>> 0;
  return params;
}

function createCompactionParamsArray({ rowCount, keyWordCount, activeNodeStride }) {
  const params = new Uint32Array(4);
  params[0] = rowCount >>> 0;
  params[1] = keyWordCount >>> 0;
  params[2] = activeNodeStride >>> 0;
  return params;
}

/**
 * Measures how far the active-node list would compact under the AABB-tuple key.
 * Reads back 40 bytes of fixed-size evidence and nothing else.
 */
export async function runSchroederActiveNodeCompactionEvidenceWebGpu({
  device,
  activeNodeList,
  activeNodeBuffer = null,
  rowCount = null,
  // Off by default: measuring costs one key pass and 40 bytes, emitting costs a
  // second pass and two more buffers. A caller that only wants the ratio should
  // not pay for the compacted list.
  emitCompactedNodes = false,
  retainCompactedBuffers = false,
  label = 'ulg-schroeder-active-node-compaction'
} = {}) {
  if (!device?.createBuffer || !device?.queue?.writeBuffer) {
    throw new TypeError(
      'runSchroederActiveNodeCompactionEvidenceWebGpu requires a WebGPU-like device'
    );
  }
  const sourceBuffer = activeNodeBuffer || activeNodeList?.activeNodeBuffer || null;
  if (!sourceBuffer) {
    throw new TypeError(
      'runSchroederActiveNodeCompactionEvidenceWebGpu requires a retained active-node buffer'
    );
  }
  const resolvedRowCount = Math.max(0, Math.round(Number(
    rowCount ?? activeNodeList?.activeCandidateCount ?? activeNodeList?.particleCount ?? 0
  )));
  if (!(resolvedRowCount > 0)) {
    return {
      schema: SCHROEDER_ACTIVE_NODE_COMPACTION_SCHEMA,
      status: 'schroeder-active-node-compaction-skipped-empty',
      rowCount: 0,
      admittedRowCount: 0,
      rejectedRowCount: 0,
      uniqueNodeCount: 0,
      compactionRatio: null
    };
  }

  const keyWordCount = SCHROEDER_ACTIVE_NODE_COMPACTION_KEY_WORDS;
  const sortKeyBuffer = device.createBuffer({
    label: `${label}-sort-keys`,
    size: Math.max(4, resolvedRowCount * keyWordCount * Uint32Array.BYTES_PER_ELEMENT),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  const rowEvidenceBuffer = device.createBuffer({
    label: `${label}-row-evidence`,
    size: 8,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: `${label}-params`,
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createCompactionParamsArray({
    rowCount: resolvedRowCount,
    keyWordCount,
    activeNodeStride: ACTIVE_NODE_FLOATS
  }));

  const pipelineInfo = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-active-node-compaction-key-v1',
    label: `${label}-key`,
    code: schroederActiveNodeCompactionKeyWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: pipelineInfo.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceBuffer } },
      { binding: 1, resource: { buffer: sortKeyBuffer } },
      { binding: 2, resource: { buffer: rowEvidenceBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });

  const radix = createWebGpuStableRadixScanUnique(device, {
    maxElementCount: resolvedRowCount,
    maxKeyWordCount: keyWordCount,
    label: `${label}-radix`
  });

  const uniqueEvidenceReadback = device.createBuffer({
    label: `${label}-unique-evidence-readback`,
    size: WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const rowEvidenceReadback = device.createBuffer({
    label: `${label}-row-evidence-readback`,
    size: 8,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });

  let radixExecution = null;
  let compactedNodeBuffer = null;
  let nodeIndexByParticleBuffer = null;
  const emitTransientBuffers = [];
  const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
  encoder.clearBuffer?.(rowEvidenceBuffer, 0, 8);
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipelineInfo.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(resolvedRowCount / WORKGROUP_SIZE)));
  pass.end();
  radixExecution = radix.encodeSortUnique(encoder, {
    keyBuffer: sortKeyBuffer,
    elementCount: resolvedRowCount,
    keyWordCount,
    keyStrideWords: keyWordCount,
    generationId: 1,
    consumerWorkgroupSize: WORKGROUP_SIZE
  });
  if (emitCompactedNodes) {
    // Capacity stays at the particle count. A compacted list sized by the
    // GPU-authored unique count would need that count on the host, and every
    // way of getting it there is worse than spending the address space: a
    // readback breaks GPU residency, and a bounded capacity drops nodes --
    // which drops particles. The win here is that consumers dispatch over
    // uniqueDispatchIndirectBuffer instead of over every particle.
    compactedNodeBuffer = device.createBuffer({
      label: `${label}-compacted-nodes`,
      size: Math.max(4, resolvedRowCount * ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
    });
    nodeIndexByParticleBuffer = device.createBuffer({
      label: `${label}-node-index-by-particle`,
      size: Math.max(4, resolvedRowCount * Uint32Array.BYTES_PER_ELEMENT),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.COPY_SRC
    });
    const emitParamsBuffer = device.createBuffer({
      label: `${label}-emit-params`,
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    device.queue.writeBuffer(emitParamsBuffer, 0, createEmitParamsArray({
      rowCount: resolvedRowCount,
      activeNodeStride: ACTIVE_NODE_FLOATS,
      nodeCapacity: resolvedRowCount
    }));
    emitTransientBuffers.push(emitParamsBuffer);
    const emitPipelineInfo = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-schroeder-active-node-compaction-emit-v1',
      label: `${label}-emit`,
      code: schroederActiveNodeCompactionEmitWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'uniform')
      ]
    });
    const emitBindGroup = device.createBindGroup({
      layout: emitPipelineInfo.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: sourceBuffer } },
        { binding: 1, resource: { buffer: radixExecution.sortedIndicesBuffer } },
        { binding: 2, resource: { buffer: radixExecution.uniqueGroupIndexBySortedPositionBuffer } },
        { binding: 3, resource: { buffer: radixExecution.uniqueOffsetsBuffer } },
        { binding: 4, resource: { buffer: radixExecution.uniqueEvidenceBuffer } },
        { binding: 5, resource: { buffer: compactedNodeBuffer } },
        { binding: 6, resource: { buffer: nodeIndexByParticleBuffer } },
        { binding: 7, resource: { buffer: emitParamsBuffer } }
      ]
    });
    const emitPass = encoder.beginComputePass();
    emitPass.setPipeline(emitPipelineInfo.pipeline);
    emitPass.setBindGroup(0, emitBindGroup);
    emitPass.dispatchWorkgroups(Math.max(1, Math.ceil(resolvedRowCount / WORKGROUP_SIZE)));
    emitPass.end();
  }
  encoder.copyBufferToBuffer(
    radixExecution.uniqueEvidenceBuffer,
    0,
    uniqueEvidenceReadback,
    0,
    WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT.length * Uint32Array.BYTES_PER_ELEMENT
  );
  encoder.copyBufferToBuffer(rowEvidenceBuffer, 0, rowEvidenceReadback, 0, 8);
  device.queue.submit([encoder.finish()]);

  await uniqueEvidenceReadback.mapAsync(GPU_MAP_MODE_READ);
  const uniqueEvidence = new Uint32Array(uniqueEvidenceReadback.getMappedRange()).slice();
  uniqueEvidenceReadback.unmap();
  await rowEvidenceReadback.mapAsync(GPU_MAP_MODE_READ);
  const rowEvidence = new Uint32Array(rowEvidenceReadback.getMappedRange()).slice();
  rowEvidenceReadback.unmap();

  const admittedRowCount = rowEvidence[0] ?? 0;
  const rejectedRowCount = rowEvidence[1] ?? 0;
  const rawUniqueCount = uniqueEvidence[UNIQUE_COUNT_WORD_INDEX] ?? 0;
  // The sentinel group is not a node.
  const uniqueNodeCount = Math.max(0, rawUniqueCount - (rejectedRowCount > 0 ? 1 : 0));

  // The radix primitive refuses releaseExecution once the encoder has been
  // submitted -- that entry point is for a discarded encoder. After submission
  // it wants releaseExecutionAfter with a fence, so releasing from inside a
  // deferred cleanup (which by definition runs post-submission) throws there
  // and, because a cleanup callback has no caller, surfaces only as an
  // unhandled rejection. Hence the fence, and hence this note.
  const releaseRetained = async () => {
    compactedNodeBuffer?.destroy?.();
    nodeIndexByParticleBuffer?.destroy?.();
    if (radixExecution) {
      await radix.releaseExecutionAfter?.(
        radixExecution,
        device.queue.onSubmittedWorkDone()
      );
    }
    radix.destroy?.();
  };
  deferSubmittedWorkCleanup(device, () => {
    for (const buffer of emitTransientBuffers) buffer.destroy?.();
    sortKeyBuffer.destroy?.();
    rowEvidenceBuffer.destroy?.();
    paramsBuffer.destroy?.();
    uniqueEvidenceReadback.destroy?.();
    rowEvidenceReadback.destroy?.();
    // uniqueDispatchIndirectBuffer belongs to the radix execution, so retaining
    // the compacted list has to retain the radix too -- releasing it here would
    // hand the caller an indirect dispatch buffer that is already destroyed.
    if (!retainCompactedBuffers) {
      releaseRetained().catch((error) => {
        globalThis.console?.error?.(
          '[ulg-schroeder] active-node compaction release failed',
          error
        );
      });
    }
  });

  return {
    schema: SCHROEDER_ACTIVE_NODE_COMPACTION_SCHEMA,
    status: 'schroeder-active-node-compaction-measured',
    rowCount: resolvedRowCount,
    admittedRowCount,
    rejectedRowCount,
    uniqueNodeCount,
    rawUniqueGroupCount: rawUniqueCount,
    keyWordCount,
    // Rows a consumer could share. Null rather than Infinity when nothing was
    // admitted, so an absent ratio is never read as an achieved one.
    compactionRatio: uniqueNodeCount > 0 ? admittedRowCount / uniqueNodeCount : null,
    // What the compacted allocation would cost against what it costs today.
    activeNodeByteLengthToday:
      resolvedRowCount * ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    activeNodeByteLengthCompacted:
      uniqueNodeCount * ACTIVE_NODE_FLOATS * Float32Array.BYTES_PER_ELEMENT
      + resolvedRowCount * Uint32Array.BYTES_PER_ELEMENT,
    compactedNodesEmitted: Boolean(emitCompactedNodes),
    // Retained only when asked; otherwise released with the rest, so a caller
    // that just wanted the ratio does not silently hold two more buffers.
    compactedNodeBuffer: retainCompactedBuffers ? compactedNodeBuffer : null,
    nodeIndexByParticleBuffer: retainCompactedBuffers ? nodeIndexByParticleBuffer : null,
    // The GPU-authored dispatch a consumer uses to run over nodes instead of
    // particles, which is the whole point of compacting.
    uniqueDispatchIndirectBuffer: retainCompactedBuffers
      ? (radixExecution?.uniqueDispatchIndirectBuffer ?? null)
      : null,
    // The node -> member particles CSR, and it is NOT optional garnish: an
    // active-node row carries `sourceParticleIndex` (field 10), and the law
    // neighbour scan recovers the neighbour *particle* from it. Compacting 1,331
    // rows into one keeps one particle index, so a consumer that reads field 10
    // off a compacted row silently loses the other 1,330 neighbours.
    //
    // The radix already produced the fix. Group `g`'s member particles are
    // `sortedIndices[uniqueOffsets[g] .. uniqueOffsets[g + 1])`, exactly the
    // structure the spatial epoch builds for its cells. So the compacted list
    // answers "which nodes overlap" -- the O(N^2) term -- and the CSR answers
    // "which particles are in this node", which is what field 10 used to answer
    // one particle at a time.
    nodeMemberIndicesBuffer: retainCompactedBuffers
      ? (radixExecution?.sortedIndicesBuffer ?? null)
      : null,
    nodeMemberOffsetsBuffer: retainCompactedBuffers
      ? (radixExecution?.uniqueOffsetsBuffer ?? null)
      : null,
    // Owned by the caller exactly when it asked to retain; a no-op otherwise,
    // so calling it unconditionally is safe.
    releaseCompactedBuffers: retainCompactedBuffers ? releaseRetained : () => {},
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}
