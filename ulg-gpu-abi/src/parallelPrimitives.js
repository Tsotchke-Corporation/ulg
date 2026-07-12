export const ULG_WEBGPU_U32_SCAN_SCHEMA =
  'peercompute.ulg.webgpu-u32-exclusive-scan.v0';
export const ULG_WEBGPU_RADIX_UNIQUE_SCHEMA =
  'peercompute.ulg.webgpu-radix-unique.v0';

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
  csrTerminator: 'offsets[unique_count]=input_count',
  submissionOwnership: 'caller',
  readbackPolicy: 'fixed-evidence-diagnostic-only'
});
