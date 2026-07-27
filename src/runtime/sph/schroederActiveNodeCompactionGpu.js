// Priority 3, first increment: measure the active-node compaction on the GPU,
// for the scenario actually running, without changing an allocation or a
// consumer.
//
// The active-node list writes one row per particle. Measured off-line at the
// shipped geometry defaults, deduplicating those rows on their own AABB tuple
// collapses 4,096-32,768 particles to 8-27 distinct rows -- 500-1,300x -- with
// **no** over-approximation, because rows sharing a tuple are byte-identical in
// every field a consumer reads. (The other candidate, one row per occupied tile
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

  deferSubmittedWorkCleanup(device, () => {
    sortKeyBuffer.destroy?.();
    rowEvidenceBuffer.destroy?.();
    paramsBuffer.destroy?.();
    uniqueEvidenceReadback.destroy?.();
    rowEvidenceReadback.destroy?.();
    if (radixExecution) radix.releaseExecution?.(radixExecution);
    radix.destroy?.();
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
    scientificValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}
