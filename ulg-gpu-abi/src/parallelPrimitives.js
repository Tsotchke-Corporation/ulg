export const ULG_WEBGPU_U32_SCAN_SCHEMA =
  'peercompute.ulg.webgpu-u32-exclusive-scan.v0';
export const ULG_WEBGPU_RADIX_UNIQUE_SCHEMA =
  'peercompute.ulg.webgpu-radix-unique.v0';
export const ULG_WEBGPU_RADIX_GPU_COUNT_SCHEMA =
  'peercompute.ulg.webgpu-radix-gpu-count.v1';

export const WEBGPU_U32_SCAN_EVIDENCE_ROW_LAYOUT = Object.freeze([
  'generation_id:u32',
  'input_count:u32',
  'exclusive_total:u32',
  'admitted:u32',
  'overflow_flags:u32',
  'level_count:u32',
  'workgroup_size:u32',
  'status:u32'
]);

export const WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT = Object.freeze([
  'generation_id:u32',
  'input_count:u32',
  'unique_count:u32',
  'admitted:u32',
  'overflow_flags:u32',
  'key_word_count:u32',
  'key_stride_words:u32',
  'status:u32'
]);

export const WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT = Object.freeze([
  'workgroup_count_x:u32',
  'workgroup_count_y:u32',
  'workgroup_count_z:u32'
]);

export const WEBGPU_PARALLEL_PRIMITIVE_STATUS_READY = 1 << 0;
export const WEBGPU_PARALLEL_PRIMITIVE_STATUS_ADMITTED = 1 << 1;
export const WEBGPU_PARALLEL_PRIMITIVE_STATUS_FAIL_CLOSED = 1 << 2;
export const WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_SEAL = 1 << 3;
export const WEBGPU_PARALLEL_PRIMITIVE_STATUS_COUNT_OVERFLOW = 1 << 4;
export const WEBGPU_PARALLEL_PRIMITIVE_STATUS_INVALID_TOPOLOGY = 1 << 5;

// A scalar generationSeal shorthand places these two words next to one another.
// Producers with an existing non-contiguous evidence row may instead provide an
// explicit seal byte offset to encodeSortUniqueGpuCount.
export const WEBGPU_RADIX_GPU_COUNT_AUTHORITY_ROW_LAYOUT = Object.freeze([
  'element_count:u32',
  'generation_seal:u32'
]);

export const WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'abi_version:u32',
  'status_flags:u32',
  'expected_generation_seal:u32',
  'observed_generation_seal:u32',
  'live_element_count:u32',
  'maximum_element_count:u32',
  'overflow_count:u32',
  'key_word_count:u32',
  'key_stride_words:u32',
  'radix_workgroup_count:u32',
  'histogram_element_count:u32',
  'consumer_workgroup_size:u32',
  'generation_id:u32',
  'histogram_scan_level_count:u32',
  'head_scan_level_count:u32',
  'authority_count_offset_words:u32',
  'authority_seal_offset_words:u32',
  'indirect_row_count:u32',
  'completion_generation_seal:u32',
  'radix_dispatch_offset_words:u32',
  'histogram_scan_count_offset_words:u32',
  'head_scan_count_offset_words:u32',
  'histogram_scan_dispatch_offset_words:u32',
  'head_scan_dispatch_offset_words:u32',
  'control_word_count:u32',
  'dispatch_x_limit:u32',
  'reserved1:u32',
  'reserved2:u32',
  'reserved3:u32',
  'reserved4:u32',
  'reserved5:u32'
]);

export const WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_WORDS =
  WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_LAYOUT.length;
export const WEBGPU_RADIX_GPU_COUNT_MAGIC = 0x5247_4331;
export const WEBGPU_RADIX_GPU_COUNT_ABI_VERSION = 1;

export const ULG_WEBGPU_U32_SCAN_ABI = Object.freeze({
  schema: ULG_WEBGPU_U32_SCAN_SCHEMA,
  scalarEncoding: 'u32',
  evidenceRowLayout: WEBGPU_U32_SCAN_EVIDENCE_ROW_LAYOUT,
  workgroupOwnership: 'caller-owned-compute-manager-gpu-lane',
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-evidence-diagnostic-only'
});

export const ULG_WEBGPU_RADIX_UNIQUE_ABI = Object.freeze({
  schema: ULG_WEBGPU_RADIX_UNIQUE_SCHEMA,
  scalarEncoding: 'u32',
  evidenceRowLayout: WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT,
  dispatchRowLayout: WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT,
  keyOrdering: 'lexicographic-most-significant-word-first',
  sortPayload: 'stable-u32-permutation-indices',
  sortedGroupIndexPayload: 'exclusive-unique-head-prefix-per-sorted-row',
  csrTerminator: 'offsets[unique_count]=input_count',
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-evidence-diagnostic-only'
});

export const ULG_WEBGPU_RADIX_GPU_COUNT_ABI = Object.freeze({
  schema: ULG_WEBGPU_RADIX_GPU_COUNT_SCHEMA,
  scalarEncoding: 'u32',
  authorityRowLayout: WEBGPU_RADIX_GPU_COUNT_AUTHORITY_ROW_LAYOUT,
  authorityPublication:
    'producer-writes-count-before-generation-seal-and-never-mutates-that-generation',
  controlHeaderLayout: WEBGPU_RADIX_GPU_COUNT_CONTROL_HEADER_LAYOUT,
  evidenceRowLayout: WEBGPU_RADIX_UNIQUE_EVIDENCE_ROW_LAYOUT,
  dispatchRowLayout: WEBGPU_INDIRECT_DISPATCH_ROW_LAYOUT,
  countOwnership: 'authenticated-gpu-authority-buffer',
  topologyOwnership: 'gpu-preflight-fixed-maximum-scan-topology',
  resourcePreparation: 'explicit-prewarm-outside-encode',
  executionConcurrency:
    'single-flight-per-runtime-until-discard-or-submission-fence',
  inactiveDispatchPolicy: 'zero-workgroup-indirect-row',
  overflowPolicy: 'fail-closed-zero-dispatch',
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-evidence-diagnostic-only'
});
