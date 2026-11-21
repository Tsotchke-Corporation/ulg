import{t as e}from"./rolldown-runtime-DK3Fl9T5.js";import{_ as t,i as n,n as r,o as i,s as a,v as o,y as s}from"./parallelPrimitives-DxfC9lV2.js";import{o as c,s as l}from"./webgpuComputeLayout-NKCaIXwi.js";import{i as u,o as d}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{t as f}from"./sphExactMassWgsl-ChqpSzqB.js";import{_ as p,n as m}from"./sphExactThermalEnergyWgsl-RP4uiT8-.js";const h=1024,g=256*16*Uint32Array.BYTES_PER_ELEMENT,_=s.length+a.length+1,v=Uint32Array.BYTES_PER_ELEMENT,y=new WeakMap,b={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64};function x(e,t,{max:n=2**53-1}={}){let r=Number(e);if(!Number.isInteger(r)||r<1||r>n)throw RangeError(`${t} must be an integer in [1, ${n}]`);return r}function S(e,t,{max:n=2**53-1}={}){let r=Number(e);if(!Number.isInteger(r)||r<0||r>n)throw RangeError(`${t} must be an integer in [0, ${n}]`);return r}function C(e,t){let n;try{n=e?.then}catch(e){throw e}if(typeof n!=`function`)throw TypeError(t);return new Promise((t,r)=>{try{Reflect.apply(n,e,[t,r])}catch(e){r(e)}})}function w(e,t=4){return Math.max(4,Math.ceil(e/t)*t)}function T(e){let t=x(e?.limits?.minUniformBufferOffsetAlignment??256,`device.limits.minUniformBufferOffsetAlignment`,{max:4294967295});return Math.max(256,t)}function E(e,t){return e?.length===t?.length&&e.every((e,n)=>Object.is(e,t[n]))}function D(e,t){return[e,...t.flatMap(e=>[e.binding,e.resource?.buffer,e.resource?.offset??0,e.resource?.size??null])]}function O(e){return Math.ceil(e/512)}function k(e){return Math.ceil(e/256)}function A(e){let t=x(e,`scan maximum element count`,{max:4294967295}),n=0;for(;t>0;){n+=1;let e=O(t);if(e<=1)break;t=e}return n}function j(e,t=65535){let n=x(t,`maxComputeWorkgroupsPerDimension`,{max:4294967295}),r=Math.min(e,n),i=Math.ceil(e/r);if(i>n)throw RangeError(`workgroup count ${e} exceeds 2D dispatch capacity ${n}x${n}`);return[r,i,1]}const M=Object.freeze({MAGIC:0,ABI_VERSION:1,STATUS_FLAGS:2,EXPECTED_GENERATION_SEAL:3,OBSERVED_GENERATION_SEAL:4,LIVE_ELEMENT_COUNT:5,MAXIMUM_ELEMENT_COUNT:6,OVERFLOW_COUNT:7,KEY_WORD_COUNT:8,KEY_STRIDE_WORDS:9,RADIX_WORKGROUP_COUNT:10,HISTOGRAM_ELEMENT_COUNT:11,CONSUMER_WORKGROUP_SIZE:12,GENERATION_ID:13,HISTOGRAM_SCAN_LEVEL_COUNT:14,HEAD_SCAN_LEVEL_COUNT:15,AUTHORITY_COUNT_OFFSET_WORDS:16,AUTHORITY_SEAL_OFFSET_WORDS:17,INDIRECT_ROW_COUNT:18,COMPLETION_GENERATION_SEAL:19,RADIX_DISPATCH_OFFSET_WORDS:20,HISTOGRAM_SCAN_COUNT_OFFSET_WORDS:21,HEAD_SCAN_COUNT_OFFSET_WORDS:22,HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS:23,HEAD_SCAN_DISPATCH_OFFSET_WORDS:24,CONTROL_WORD_COUNT:25,DISPATCH_X_LIMIT:26});function N({maxElementCount:e,maxComputeWorkgroupsPerDimension:n=65535}={}){let r=x(e,`maxElementCount`,{max:4294967295}),i=k(r),o=i*16;if(!Number.isSafeInteger(o)||o>4294967295)throw RangeError(`maximum radix histogram exceeds the u32-addressable range`);let s=A(o),c=A(r),l=t,u=l+s,d=u+c,f=d+a.length,p=f+s*2*a.length,m=p+c*2*a.length,h=1+s*2+c*2,g=o;j(i,n);for(let e=0;e<s;e+=1){let e=O(g);j(e,n),g=e}g=r;for(let e=0;e<c;e+=1){let e=O(g);j(e,n),g=e}return Object.freeze({headerWordCount:t,histogramScanLevelCount:s,headScanLevelCount:c,histogramScanCountOffsetWords:l,headScanCountOffsetWords:u,radixDispatchOffsetWords:d,radixDispatchOffsetBytes:d*v,histogramScanDispatchOffsetWords:f,headScanDispatchOffsetWords:p,indirectRowCount:h,controlWordCount:m,controlByteLength:m*v,dispatchRowWordCount:a.length})}function P(e){if(!e?.createBuffer||!e?.createShaderModule||!e?.createComputePipeline||!e?.createBindGroup||!e?.queue?.writeBuffer)throw TypeError(`GPU radix/scan/unique requires a WebGPU-like device`)}function F(e,t,n,r=0){let i=w(x(n,`${t} wordCount`,{max:4294967295})*v),a=Number(e.limits?.maxBufferSize??1/0),o=Number(e.limits?.maxStorageBufferBindingSize??1/0);if(i>a)throw RangeError(`${t} byte length ${i} exceeds maxBufferSize ${a}`);if(i>o)throw RangeError(`${t} byte length ${i} exceeds maxStorageBufferBindingSize ${o}`);return e.createBuffer({label:t,size:i,usage:b.STORAGE|b.COPY_SRC|b.COPY_DST|r})}function I(e){let t=new Set;for(let n=e.length-1;n>=0;--n){let r=e[n];if(!(!r||t.has(r))){t.add(r);try{r.destroy?.()}catch{}}}}function L(){let e=[],t=[],n=!0;return{ownBuffer(t){return e.push(t),t},ownRuntime(e){return t.push(e),e},commit(){n=!1,e.length=0,t.length=0},rollback(){if(!n)return!1;n=!1;for(let e=t.length-1;e>=0;--e)try{t[e]?.destroy?.()}catch{}return I(e),e.length=0,t.length=0,!0}}}function R(e,t,n={}){return e?.beginComputePassDescriptor?e.beginComputePassDescriptor(t,n):{label:t}}function ee(e){return!!(e?.beginComputePassDescriptor&&e.active!==!1)}function z(e){if(!Array.isArray(e)&&!ArrayBuffer.isView(e))throw TypeError(`dispatch must be an array-like [x, y, z] value`);if(e.length<1||e.length>3)throw RangeError(`dispatch must contain between one and three dimensions`);let t=[0,1,2].map(t=>x(e[t]??1,`dispatch[${t}]`,{max:4294967295}));return`webgpu-dispatch:${t[0]}:${t[1]}:${t[2]}`}function B(e,t){if(!e)return null;if(!e.buffer)throw TypeError(`dispatchIndirectProvider.buffer is required`);if(typeof e.byteOffsetFor!=`function`)throw TypeError(`dispatchIndirectProvider.byteOffsetFor must be a function`);let n=z(t),r=Number(e.byteOffsetFor(t,n));if(!Number.isInteger(r)||r<0||r%4!=0)throw RangeError(`indirect dispatch offset for ${n} must be an aligned byte offset`);return{buffer:e.buffer,byteOffset:r,shapeId:n}}function V(e,t,n,r,i=null){e.setPipeline(t),e.setBindGroup(0,n);let a=B(i,r);if(a){if(typeof e.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`indirect dispatch provider requires dispatchWorkgroupsIndirect support`);e.dispatchWorkgroupsIndirect(a.buffer,a.byteOffset)}else e.dispatchWorkgroups(...r)}function H(e,t,n,r,i,a,o,s=null){let c=e.beginComputePass(R(t,n,r));V(c,i,a,o,s),c.end()}const U=`
struct ScanParams {
  element_count: u32,
  dispatch_x: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read_write> scan_values_a: array<u32>;
@group(0) @binding(1) var<storage, read_write> scan_values_b: array<u32>;
@group(0) @binding(2) var<storage, read_write> scan_values_aux: array<u32>;
@group(0) @binding(3) var<uniform> scan_params: ScanParams;
@group(0) @binding(4) var<storage, read_write> scan_fused_lower_values: array<u32>;
@group(0) @binding(5) var<uniform> scan_fused_lower_params: ScanParams;

var<workgroup> scan_values: array<u32, 512>;

@compute @workgroup_size(256)
fn scan_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * scan_params.dispatch_x;
  let scan_group_count = (scan_params.element_count + 511u) / 512u;
  let group_valid = linear_group < scan_group_count;
  let block_base = linear_group * 512u;
  let first = block_base + local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (group_valid && first < scan_params.element_count) {
    first_value = scan_values_a[first];
  }
  if (group_valid && second < scan_params.element_count) {
    second_value = scan_values_a[second];
  }
  scan_values[local_id.x * 2u] = first_value;
  scan_values[local_id.x * 2u + 1u] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      scan_values[right] = scan_values[right] + scan_values[left];
    }
    offset = offset << 1u;
  }

  if (group_valid && local_id.x == 0u) {
    scan_values_aux[linear_group] = scan_values[511u];
    scan_values[511u] = 0u;
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = scan_values[left];
      scan_values[left] = scan_values[right];
      scan_values[right] = scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (group_valid && first < scan_params.element_count) {
    scan_values_b[first] = scan_values[local_id.x * 2u];
  }
  if (group_valid && second < scan_params.element_count) {
    scan_values_b[second] = scan_values[local_id.x * 2u + 1u];
  }
}

@compute @workgroup_size(256)
fn add_scanned_block_offsets(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * scan_params.dispatch_x;
  let local_index = global_id.x - workgroup_id.x * 256u;
  let first = linear_group * 512u + local_index * 2u;
  let second = first + 1u;
  if (first >= scan_params.element_count) {
    return;
  }
  let offset = scan_values_b[linear_group];
  if (first < scan_params.element_count) {
    scan_values_a[first] = scan_values_a[first] + offset;
  }
  if (second < scan_params.element_count) {
    scan_values_a[second] = scan_values_a[second] + offset;
  }
}

// The final hierarchy level always has exactly one workgroup. For bounded
// lower levels that workgroup can apply its freshly scanned block offsets
// before it exits, preserving the parallel lower scan while removing one
// otherwise separate dispatch boundary.
@compute @workgroup_size(256)
fn scan_top_and_add_lower(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let first = local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (first < scan_params.element_count) {
    first_value = scan_values_a[first];
  }
  if (second < scan_params.element_count) {
    second_value = scan_values_a[second];
  }
  scan_values[first] = first_value;
  scan_values[second] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      scan_values[right] = scan_values[right] + scan_values[left];
    }
    offset = offset << 1u;
  }

  if (local_id.x == 0u) {
    scan_values_aux[0] = scan_values[511u];
    scan_values[511u] = 0u;
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = scan_values[left];
      scan_values[left] = scan_values[right];
      scan_values[right] = scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (first < scan_params.element_count) {
    scan_values_b[first] = scan_values[first];
  }
  if (second < scan_params.element_count) {
    scan_values_b[second] = scan_values[second];
  }

  for (var lower_index = local_id.x;
    lower_index < scan_fused_lower_params.element_count;
    lower_index = lower_index + 256u) {
    let block_index = lower_index / 512u;
    scan_fused_lower_values[lower_index] = scan_fused_lower_values[lower_index]
      + scan_values[block_index];
  }
}
`,te=`
struct RadixParams {
  element_count: u32,
  workgroup_count: u32,
  key_stride_words: u32,
  key_word_index: u32,
  bit_offset: u32,
  key_word_count: u32,
  generation_id: u32,
  dispatch_x: u32,
};

@group(0) @binding(0) var<storage, read> radix_keys: array<u32>;
@group(0) @binding(1) var<storage, read> radix_indices_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> radix_indices_out: array<u32>;
@group(0) @binding(3) var<storage, read_write> radix_histograms: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> radix_histogram_offsets: array<u32>;
@group(0) @binding(5) var<uniform> radix_params: RadixParams;

var<workgroup> local_histogram: array<atomic<u32>, 16>;
// Scatter uses four vec4 rows per invocation for a 16-lane one-hot prefix.
// Its per-entrypoint allocation is exactly 16 KiB; histogram's disjoint
// entrypoint uses local_histogram instead, so the two allocations are not summed.
var<workgroup> digit_prefix: array<vec4<u32>, 1024>;

fn record_digit(record_index: u32) -> u32 {
  let key_index = record_index * radix_params.key_stride_words + radix_params.key_word_index;
  return (radix_keys[key_index] >> radix_params.bit_offset) & 15u;
}

@compute @workgroup_size(256)
fn initialize_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  if (linear_group < radix_params.workgroup_count && index < radix_params.element_count) {
    radix_indices_out[index] = index;
  }
}

@compute @workgroup_size(256)
fn histogram(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (local_id.x < 16u) {
    atomicStore(&local_histogram[local_id.x], 0u);
  }
  workgroupBarrier();
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  let group_valid = linear_group < radix_params.workgroup_count;
  if (group_valid && index < radix_params.element_count) {
    let record_index = radix_indices_in[index];
    atomicAdd(&local_histogram[record_digit(record_index)], 1u);
  }
  workgroupBarrier();
  if (group_valid && local_id.x < 16u) {
    let destination = local_id.x * radix_params.workgroup_count + linear_group;
    atomicStore(&radix_histograms[destination], atomicLoad(&local_histogram[local_id.x]));
  }
}

fn one_hot_quad(digit: u32, quad: u32) -> vec4<u32> {
  var row = vec4<u32>(0u);
  if (digit / 4u == quad) {
    row[digit & 3u] = 1u;
  }
  return row;
}

@compute @workgroup_size(256)
fn scatter(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  let valid = linear_group < radix_params.workgroup_count
    && index < radix_params.element_count;
  var record_index = 0u;
  var digit = 0u;
  if (valid) {
    record_index = radix_indices_in[index];
    digit = record_digit(record_index);
  }
  let prefix_base = local_id.x * 4u;
  for (var quad = 0u; quad < 4u; quad = quad + 1u) {
    digit_prefix[prefix_base + quad] = select(vec4<u32>(0u), one_hot_quad(digit, quad), valid);
  }
  workgroupBarrier();

  for (var offset = 1u; offset < 256u; offset = offset << 1u) {
    var add0 = vec4<u32>(0u);
    var add1 = vec4<u32>(0u);
    var add2 = vec4<u32>(0u);
    var add3 = vec4<u32>(0u);
    if (local_id.x >= offset) {
      let prior_base = (local_id.x - offset) * 4u;
      add0 = digit_prefix[prior_base];
      add1 = digit_prefix[prior_base + 1u];
      add2 = digit_prefix[prior_base + 2u];
      add3 = digit_prefix[prior_base + 3u];
    }
    workgroupBarrier();
    digit_prefix[prefix_base] = digit_prefix[prefix_base] + add0;
    digit_prefix[prefix_base + 1u] = digit_prefix[prefix_base + 1u] + add1;
    digit_prefix[prefix_base + 2u] = digit_prefix[prefix_base + 2u] + add2;
    digit_prefix[prefix_base + 3u] = digit_prefix[prefix_base + 3u] + add3;
    workgroupBarrier();
  }

  if (valid) {
    let inclusive_rank = digit_prefix[prefix_base + digit / 4u][digit & 3u];
    let group_base = radix_histogram_offsets[
      digit * radix_params.workgroup_count + linear_group
    ];
    radix_indices_out[group_base + inclusive_rank - 1u] = record_index;
  }
}
`,W=`
struct UniqueParams {
  element_count: u32,
  key_stride_words: u32,
  key_word_count: u32,
  generation_id: u32,
  consumer_workgroup_size: u32,
  dispatch_x: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> unique_source_keys: array<u32>;
@group(0) @binding(1) var<storage, read> unique_sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> unique_head_flags: array<u32>;
@group(0) @binding(3) var<storage, read> unique_head_offsets: array<u32>;
@group(0) @binding(4) var<storage, read_write> unique_output_keys: array<u32>;
@group(0) @binding(5) var<storage, read_write> unique_output_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> unique_evidence: array<u32>;
@group(0) @binding(7) var<storage, read_write> unique_dispatch: array<u32>;
@group(0) @binding(8) var<uniform> unique_params: UniqueParams;

fn keys_equal(left_record: u32, right_record: u32) -> bool {
  let left_base = left_record * unique_params.key_stride_words;
  let right_base = right_record * unique_params.key_stride_words;
  for (var word = 0u; word < unique_params.key_word_count; word = word + 1u) {
    if (unique_source_keys[left_base + word] != unique_source_keys[right_base + word]) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(256)
fn mark_heads(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * unique_params.dispatch_x;
  let index = linear_group * 256u + local_id.x;
  if (index >= unique_params.element_count) {
    return;
  }
  if (index == 0u) {
    unique_head_flags[index] = 1u;
    return;
  }
  let current = unique_sorted_indices[index];
  let previous = unique_sorted_indices[index - 1u];
  unique_head_flags[index] = select(1u, 0u, keys_equal(current, previous));
}

@compute @workgroup_size(256)
fn scatter_unique(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let linear_group = workgroup_id.x + workgroup_id.y * unique_params.dispatch_x;
  let sorted_position = linear_group * 256u + local_id.x;
  if (sorted_position >= unique_params.element_count
    || unique_head_flags[sorted_position] == 0u) {
    return;
  }
  let unique_index = unique_head_offsets[sorted_position];
  let source_record = unique_sorted_indices[sorted_position];
  let source_base = source_record * unique_params.key_stride_words;
  let output_base = unique_index * unique_params.key_word_count;
  for (var word = 0u; word < unique_params.key_word_count; word = word + 1u) {
    unique_output_keys[output_base + word] = unique_source_keys[source_base + word];
  }
  unique_output_offsets[unique_index] = sorted_position;
}

@compute @workgroup_size(1)
fn finalize_unique() {
  var unique_count = 0u;
  if (unique_params.element_count > 0u) {
    let last = unique_params.element_count - 1u;
    unique_count = unique_head_offsets[last] + unique_head_flags[last];
  }
  unique_output_offsets[unique_count] = unique_params.element_count;
  unique_evidence[0] = unique_params.generation_id;
  unique_evidence[1] = unique_params.element_count;
  unique_evidence[2] = unique_count;
  unique_evidence[3] = 1u;
  unique_evidence[4] = 0u;
  unique_evidence[5] = unique_params.key_word_count;
  unique_evidence[6] = unique_params.key_stride_words;
  unique_evidence[7] = 1u;
  unique_dispatch[0] = (unique_count + unique_params.consumer_workgroup_size - 1u)
    / unique_params.consumer_workgroup_size;
  unique_dispatch[1] = 1u;
  unique_dispatch[2] = 1u;
}
`,G=`
struct GpuCountConfig {
  authority_count_word: u32,
  authority_seal_word: u32,
  expected_generation_seal: u32,
  maximum_element_count: u32,
  key_word_count: u32,
  key_stride_words: u32,
  consumer_workgroup_size: u32,
  generation_id: u32,
  dispatch_x_limit: u32,
  histogram_scan_count_word: u32,
  head_scan_count_word: u32,
  radix_dispatch_word: u32,
  histogram_scan_dispatch_word: u32,
  head_scan_dispatch_word: u32,
  histogram_scan_level_count: u32,
  head_scan_level_count: u32,
  indirect_row_count: u32,
  control_word_count: u32,
  runtime_maximum_element_count: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read> gpu_count_authority: array<u32>;
@group(0) @binding(1) var<storage, read_write> gpu_count_control: array<u32>;
@group(0) @binding(2) var<uniform> gpu_count_config: GpuCountConfig;

const CONTROL_MAGIC: u32 = ${M.MAGIC}u;
const CONTROL_ABI_VERSION: u32 = ${M.ABI_VERSION}u;
const CONTROL_STATUS: u32 = ${M.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${M.EXPECTED_GENERATION_SEAL}u;
const CONTROL_OBSERVED_SEAL: u32 =
  ${M.OBSERVED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${M.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${M.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_OVERFLOW_COUNT: u32 =
  ${M.OVERFLOW_COUNT}u;
const CONTROL_KEY_WORD_COUNT: u32 =
  ${M.KEY_WORD_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${M.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${M.RADIX_WORKGROUP_COUNT}u;
const CONTROL_HISTOGRAM_COUNT: u32 =
  ${M.HISTOGRAM_ELEMENT_COUNT}u;
const CONTROL_CONSUMER_WORKGROUP_SIZE: u32 =
  ${M.CONSUMER_WORKGROUP_SIZE}u;
const CONTROL_GENERATION_ID: u32 =
  ${M.GENERATION_ID}u;
const CONTROL_HISTOGRAM_LEVEL_COUNT: u32 =
  ${M.HISTOGRAM_SCAN_LEVEL_COUNT}u;
const CONTROL_HEAD_LEVEL_COUNT: u32 =
  ${M.HEAD_SCAN_LEVEL_COUNT}u;
const CONTROL_AUTHORITY_COUNT_WORD: u32 =
  ${M.AUTHORITY_COUNT_OFFSET_WORDS}u;
const CONTROL_AUTHORITY_SEAL_WORD: u32 =
  ${M.AUTHORITY_SEAL_OFFSET_WORDS}u;
const CONTROL_INDIRECT_ROW_COUNT: u32 =
  ${M.INDIRECT_ROW_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${M.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${M.RADIX_DISPATCH_OFFSET_WORDS}u;
const CONTROL_HISTOGRAM_COUNT_WORD: u32 =
  ${M.HISTOGRAM_SCAN_COUNT_OFFSET_WORDS}u;
const CONTROL_HEAD_COUNT_WORD: u32 =
  ${M.HEAD_SCAN_COUNT_OFFSET_WORDS}u;
const CONTROL_HISTOGRAM_DISPATCH_WORD: u32 =
  ${M.HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS}u;
const CONTROL_HEAD_DISPATCH_WORD: u32 =
  ${M.HEAD_SCAN_DISPATCH_OFFSET_WORDS}u;
const CONTROL_WORD_COUNT: u32 =
  ${M.CONTROL_WORD_COUNT}u;
const CONTROL_DISPATCH_X_LIMIT: u32 =
  ${M.DISPATCH_X_LIMIT}u;

const GPU_COUNT_MAGIC: u32 = ${o}u;
const GPU_COUNT_ABI_VERSION: u32 = 1u;
const STATUS_READY: u32 = 1u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SEAL: u32 = 8u;
const STATUS_COUNT_OVERFLOW: u32 =
  16u;
const STATUS_INVALID_TOPOLOGY: u32 =
  32u;

fn ceil_groups(value: u32, width: u32) -> u32 {
  return value / width + select(0u, 1u, value % width != 0u);
}

fn write_dispatch(offset: u32, group_count: u32, enabled: bool) {
  if (!enabled || group_count == 0u) {
    gpu_count_control[offset] = 0u;
    gpu_count_control[offset + 1u] = 0u;
    gpu_count_control[offset + 2u] = 0u;
    return;
  }
  let dispatch_x = min(group_count, gpu_count_config.dispatch_x_limit);
  let dispatch_y = ceil_groups(group_count, dispatch_x);
  let shape_admitted = dispatch_y <= gpu_count_config.dispatch_x_limit;
  gpu_count_control[offset] = select(0u, dispatch_x, shape_admitted);
  gpu_count_control[offset + 1u] = select(0u, dispatch_y, shape_admitted);
  gpu_count_control[offset + 2u] = select(0u, 1u, shape_admitted);
}

fn prepare_scan(
  count_word: u32,
  dispatch_word: u32,
  level_count: u32,
  initial_count: u32,
  admitted: bool
) {
  var count = initial_count;
  for (var level = 0u; level < level_count; level = level + 1u) {
    let level_admitted = admitted && count > 0u;
    let group_count = select(0u, ceil_groups(count, 512u), level_admitted);
    gpu_count_control[count_word + level] = select(0u, count, level_admitted);
    let block_dispatch_word = dispatch_word + level * 6u;
    write_dispatch(block_dispatch_word, group_count, level_admitted);
    let parent_admitted =
      level_admitted && group_count > 1u && level + 1u < level_count;
    write_dispatch(block_dispatch_word + 3u, group_count, parent_admitted);
    count = select(0u, group_count, parent_admitted);
  }
}

@compute @workgroup_size(1)
fn prepare_gpu_count() {
  let observed_count =
    gpu_count_authority[gpu_count_config.authority_count_word];
  let observed_seal =
    gpu_count_authority[gpu_count_config.authority_seal_word];
  let topology_valid =
    gpu_count_config.maximum_element_count > 0u
    && gpu_count_config.maximum_element_count
      <= gpu_count_config.runtime_maximum_element_count
    && gpu_count_config.key_word_count > 0u
    && gpu_count_config.key_stride_words >= gpu_count_config.key_word_count
    && gpu_count_config.consumer_workgroup_size > 0u
    && gpu_count_config.dispatch_x_limit > 0u
    && gpu_count_config.histogram_scan_level_count > 0u
    && gpu_count_config.head_scan_level_count > 0u;
  let seal_valid =
    gpu_count_config.expected_generation_seal != 0u
    && observed_seal == gpu_count_config.expected_generation_seal;
  let overflowed =
    topology_valid && seal_valid
    && observed_count > gpu_count_config.maximum_element_count;
  let admitted = topology_valid && seal_valid && !overflowed;

  var status = STATUS_READY;
  if (!topology_valid) {
    status = status | STATUS_FAIL_CLOSED | STATUS_INVALID_TOPOLOGY;
  } else if (!seal_valid) {
    status = status | STATUS_FAIL_CLOSED | STATUS_INVALID_SEAL;
  } else if (overflowed) {
    status = status | STATUS_FAIL_CLOSED | STATUS_COUNT_OVERFLOW;
  } else {
    status = status | STATUS_ADMITTED;
  }

  let live_count = select(0u, observed_count, admitted);
  let radix_group_count = select(
    0u,
    ceil_groups(live_count, 256u),
    admitted && live_count > 0u
  );
  let histogram_count = radix_group_count * 16u;

  gpu_count_control[CONTROL_MAGIC] = GPU_COUNT_MAGIC;
  gpu_count_control[CONTROL_ABI_VERSION] = GPU_COUNT_ABI_VERSION;
  gpu_count_control[CONTROL_STATUS] = status;
  gpu_count_control[CONTROL_EXPECTED_SEAL] =
    gpu_count_config.expected_generation_seal;
  gpu_count_control[CONTROL_OBSERVED_SEAL] = observed_seal;
  gpu_count_control[CONTROL_LIVE_COUNT] = live_count;
  gpu_count_control[CONTROL_MAX_COUNT] =
    gpu_count_config.maximum_element_count;
  gpu_count_control[CONTROL_OVERFLOW_COUNT] = select(
    0u,
    observed_count - gpu_count_config.maximum_element_count,
    overflowed
  );
  gpu_count_control[CONTROL_KEY_WORD_COUNT] =
    gpu_count_config.key_word_count;
  gpu_count_control[CONTROL_KEY_STRIDE] =
    gpu_count_config.key_stride_words;
  gpu_count_control[CONTROL_RADIX_GROUP_COUNT] = radix_group_count;
  gpu_count_control[CONTROL_HISTOGRAM_COUNT] = histogram_count;
  gpu_count_control[CONTROL_CONSUMER_WORKGROUP_SIZE] =
    gpu_count_config.consumer_workgroup_size;
  gpu_count_control[CONTROL_GENERATION_ID] =
    gpu_count_config.generation_id;
  gpu_count_control[CONTROL_HISTOGRAM_LEVEL_COUNT] =
    gpu_count_config.histogram_scan_level_count;
  gpu_count_control[CONTROL_HEAD_LEVEL_COUNT] =
    gpu_count_config.head_scan_level_count;
  gpu_count_control[CONTROL_AUTHORITY_COUNT_WORD] =
    gpu_count_config.authority_count_word;
  gpu_count_control[CONTROL_AUTHORITY_SEAL_WORD] =
    gpu_count_config.authority_seal_word;
  gpu_count_control[CONTROL_INDIRECT_ROW_COUNT] =
    gpu_count_config.indirect_row_count;
  gpu_count_control[CONTROL_COMPLETION_SEAL] = select(
    0u,
    gpu_count_config.expected_generation_seal,
    admitted
  );
  gpu_count_control[CONTROL_RADIX_DISPATCH_WORD] =
    gpu_count_config.radix_dispatch_word;
  gpu_count_control[CONTROL_HISTOGRAM_COUNT_WORD] =
    gpu_count_config.histogram_scan_count_word;
  gpu_count_control[CONTROL_HEAD_COUNT_WORD] =
    gpu_count_config.head_scan_count_word;
  gpu_count_control[CONTROL_HISTOGRAM_DISPATCH_WORD] =
    gpu_count_config.histogram_scan_dispatch_word;
  gpu_count_control[CONTROL_HEAD_DISPATCH_WORD] =
    gpu_count_config.head_scan_dispatch_word;
  gpu_count_control[CONTROL_WORD_COUNT] =
    gpu_count_config.control_word_count;
  gpu_count_control[CONTROL_DISPATCH_X_LIMIT] =
    gpu_count_config.dispatch_x_limit;

  write_dispatch(
    gpu_count_config.radix_dispatch_word,
    radix_group_count,
    admitted && live_count > 0u
  );
  prepare_scan(
    gpu_count_config.histogram_scan_count_word,
    gpu_count_config.histogram_scan_dispatch_word,
    gpu_count_config.histogram_scan_level_count,
    histogram_count,
    admitted
  );
  prepare_scan(
    gpu_count_config.head_scan_count_word,
    gpu_count_config.head_scan_dispatch_word,
    gpu_count_config.head_scan_level_count,
    live_count,
    admitted
  );
}
`,ne=`
struct GpuCountScanStatic {
  count_word: u32,
  block_dispatch_word: u32,
  add_dispatch_word: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read> scan_input: array<u32>;
@group(0) @binding(1) var<storage, read_write> scan_output: array<u32>;
@group(0) @binding(2) var<storage, read_write> scan_block_sums: array<u32>;
@group(0) @binding(3) var<storage, read> scan_parent_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(5) var<uniform> scan_static: GpuCountScanStatic;
@group(0) @binding(6) var<storage, read_write> scan_fused_lower_values: array<u32>;
@group(0) @binding(7) var<uniform> scan_fused_lower_static: GpuCountScanStatic;

const CONTROL_STATUS: u32 = ${M.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${M.EXPECTED_GENERATION_SEAL}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${M.COMPLETION_GENERATION_SEAL}u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;

var<workgroup> scan_values: array<u32, 512>;

fn sealed_count() -> u32 {
  let status = gpu_count_control[CONTROL_STATUS];
  let sealed =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  return select(0u, gpu_count_control[scan_static.count_word], sealed);
}

@compute @workgroup_size(256)
fn scan_gpu_count_blocks(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let dispatch_x = gpu_count_control[scan_static.block_dispatch_word];
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  let scan_group_count =
    count / 512u + select(0u, 1u, count % 512u != 0u);
  let group_valid = linear_group < scan_group_count;
  let block_base = linear_group * 512u;
  let first = block_base + local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (group_valid && first < count) {
    first_value = scan_input[first];
  }
  if (group_valid && second < count) {
    second_value = scan_input[second];
  }
  scan_values[local_id.x * 2u] = first_value;
  scan_values[local_id.x * 2u + 1u] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      scan_values[right] = scan_values[right] + scan_values[left];
    }
    offset = offset << 1u;
  }

  if (group_valid && local_id.x == 0u) {
    scan_block_sums[linear_group] = scan_values[511u];
    scan_values[511u] = 0u;
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = scan_values[left];
      scan_values[left] = scan_values[right];
      scan_values[right] = scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (group_valid && first < count) {
    scan_output[first] = scan_values[local_id.x * 2u];
  }
  if (group_valid && second < count) {
    scan_output[second] = scan_values[local_id.x * 2u + 1u];
  }
}

@compute @workgroup_size(256)
fn add_gpu_count_block_offsets(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let dispatch_x = gpu_count_control[scan_static.add_dispatch_word];
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  let first = linear_group * 512u + local_id.x * 2u;
  let second = first + 1u;
  if (first >= count) {
    return;
  }
  let block_offset = scan_parent_offsets[linear_group];
  scan_output[first] = scan_output[first] + block_offset;
  if (second < count) {
    scan_output[second] = scan_output[second] + block_offset;
  }
}

// The fixed GPU-count hierarchy retains every possible scan level so a
// GPU-authored live count can select its depth without a readback.  Whenever
// the top live level is one workgroup, that workgroup can scan the top block
// sums and apply the resulting offsets to the already-scanned lower level
// before it exits.  This is the GPU-count counterpart of the direct-count
// scan_top_and_add_lower path: the top dispatch remains indirect, so A=0,
// invalid seals, overflow, and shallower live hierarchies all stay fail-closed.
@compute @workgroup_size(256)
fn scan_gpu_count_top_and_add_lower(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let count = sealed_count();
  let first = local_id.x * 2u;
  let second = first + 1u;
  var first_value = 0u;
  var second_value = 0u;
  if (first < count) {
    first_value = scan_input[first];
  }
  if (second < count) {
    second_value = scan_input[second];
  }
  scan_values[first] = first_value;
  scan_values[second] = second_value;

  var offset = 1u;
  for (var width = 256u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      scan_values[right] = scan_values[right] + scan_values[left];
    }
    offset = offset << 1u;
  }

  if (local_id.x == 0u) {
    scan_block_sums[0] = scan_values[511u];
    scan_values[511u] = 0u;
  }

  for (var width = 1u; width < 512u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (local_id.x < width) {
      let left = offset * (2u * local_id.x + 1u) - 1u;
      let right = offset * (2u * local_id.x + 2u) - 1u;
      let prior = scan_values[left];
      scan_values[left] = scan_values[right];
      scan_values[right] = scan_values[right] + prior;
    }
  }

  workgroupBarrier();
  if (first < count) {
    scan_output[first] = scan_values[first];
  }
  if (second < count) {
    scan_output[second] = scan_values[second];
  }

  let lower_status = gpu_count_control[CONTROL_STATUS];
  let lower_sealed =
    (lower_status & STATUS_ADMITTED) != 0u
    && (lower_status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  let lower_count = select(
    0u,
    gpu_count_control[scan_fused_lower_static.count_word],
    lower_sealed
  );
  for (var lower_index = local_id.x;
    lower_index < lower_count;
    lower_index = lower_index + 256u) {
    let block_index = lower_index / 512u;
    scan_fused_lower_values[lower_index] =
      scan_fused_lower_values[lower_index] + scan_values[block_index];
  }
}
`,re=`
struct DigitStatic {
  key_word_index: u32,
  bit_offset: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> radix_keys: array<u32>;
@group(0) @binding(1) var<storage, read> radix_indices_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> radix_indices_out: array<u32>;
@group(0) @binding(3) var<storage, read_write> radix_histograms: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> radix_histogram_offsets: array<u32>;
@group(0) @binding(5) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(6) var<uniform> digit_static: DigitStatic;

const CONTROL_STATUS: u32 = ${M.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${M.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${M.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${M.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${M.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${M.RADIX_WORKGROUP_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${M.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${M.RADIX_DISPATCH_OFFSET_WORDS}u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;

var<workgroup> local_histogram: array<atomic<u32>, 16>;
var<workgroup> digit_prefix: array<vec4<u32>, 1024>;

fn sealed_count() -> u32 {
  let status = gpu_count_control[CONTROL_STATUS];
  let sealed =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  return select(
    0u,
    min(
      gpu_count_control[CONTROL_LIVE_COUNT],
      gpu_count_control[CONTROL_MAX_COUNT]
    ),
    sealed
  );
}

fn radix_dispatch_x() -> u32 {
  return gpu_count_control[
    gpu_count_control[CONTROL_RADIX_DISPATCH_WORD]
  ];
}

fn record_digit(record_index: u32) -> u32 {
  let key_index =
    record_index * gpu_count_control[CONTROL_KEY_STRIDE]
    + digit_static.key_word_index;
  return (radix_keys[key_index] >> digit_static.bit_offset) & 15u;
}

@compute @workgroup_size(256)
fn initialize_gpu_count_indices(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  if (linear_group < gpu_count_control[CONTROL_RADIX_GROUP_COUNT]
    && index < count) {
    radix_indices_out[index] = index;
  }
}

@compute @workgroup_size(256)
fn histogram_gpu_count(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (local_id.x < 16u) {
    atomicStore(&local_histogram[local_id.x], 0u);
  }
  workgroupBarrier();
  let count = sealed_count();
  let workgroup_count =
    gpu_count_control[CONTROL_RADIX_GROUP_COUNT];
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  let group_valid = linear_group < workgroup_count;
  if (group_valid && index < count) {
    let record_index = radix_indices_in[index];
    atomicAdd(&local_histogram[record_digit(record_index)], 1u);
  }
  workgroupBarrier();
  if (group_valid && local_id.x < 16u) {
    let destination =
      local_id.x * workgroup_count + linear_group;
    atomicStore(
      &radix_histograms[destination],
      atomicLoad(&local_histogram[local_id.x])
    );
  }
}

fn one_hot_quad(digit: u32, quad: u32) -> vec4<u32> {
  var row = vec4<u32>(0u);
  if (digit / 4u == quad) {
    row[digit & 3u] = 1u;
  }
  return row;
}

@compute @workgroup_size(256)
fn scatter_gpu_count(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let workgroup_count =
    gpu_count_control[CONTROL_RADIX_GROUP_COUNT];
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  let valid = linear_group < workgroup_count && index < count;
  var record_index = 0u;
  var digit = 0u;
  if (valid) {
    record_index = radix_indices_in[index];
    digit = record_digit(record_index);
  }
  let prefix_base = local_id.x * 4u;
  for (var quad = 0u; quad < 4u; quad = quad + 1u) {
    digit_prefix[prefix_base + quad] =
      select(vec4<u32>(0u), one_hot_quad(digit, quad), valid);
  }
  workgroupBarrier();

  for (var offset = 1u; offset < 256u; offset = offset << 1u) {
    var add0 = vec4<u32>(0u);
    var add1 = vec4<u32>(0u);
    var add2 = vec4<u32>(0u);
    var add3 = vec4<u32>(0u);
    if (local_id.x >= offset) {
      let prior_base = (local_id.x - offset) * 4u;
      add0 = digit_prefix[prior_base];
      add1 = digit_prefix[prior_base + 1u];
      add2 = digit_prefix[prior_base + 2u];
      add3 = digit_prefix[prior_base + 3u];
    }
    workgroupBarrier();
    digit_prefix[prefix_base] = digit_prefix[prefix_base] + add0;
    digit_prefix[prefix_base + 1u] =
      digit_prefix[prefix_base + 1u] + add1;
    digit_prefix[prefix_base + 2u] =
      digit_prefix[prefix_base + 2u] + add2;
    digit_prefix[prefix_base + 3u] =
      digit_prefix[prefix_base + 3u] + add3;
    workgroupBarrier();
  }

  if (valid) {
    let inclusive_rank =
      digit_prefix[prefix_base + digit / 4u][digit & 3u];
    let group_base = radix_histogram_offsets[
      digit * workgroup_count + linear_group
    ];
    radix_indices_out[group_base + inclusive_rank - 1u] =
      record_index;
  }
}
`,K=`
@group(0) @binding(0) var<storage, read> unique_source_keys: array<u32>;
@group(0) @binding(1) var<storage, read> unique_sorted_indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> unique_head_flags: array<u32>;
@group(0) @binding(3) var<storage, read> unique_head_offsets: array<u32>;
@group(0) @binding(4) var<storage, read_write> unique_output_keys: array<u32>;
@group(0) @binding(5) var<storage, read_write> unique_output_offsets: array<u32>;
@group(0) @binding(6) var<storage, read_write> unique_evidence: array<u32>;
@group(0) @binding(7) var<storage, read_write> unique_dispatch: array<u32>;
@group(0) @binding(8) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(9) var<storage, read> gpu_count_authority: array<u32>;

const CONTROL_STATUS: u32 = ${M.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${M.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${M.LIVE_ELEMENT_COUNT}u;
const CONTROL_KEY_WORD_COUNT: u32 =
  ${M.KEY_WORD_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${M.KEY_STRIDE_WORDS}u;
const CONTROL_CONSUMER_WORKGROUP_SIZE: u32 =
  ${M.CONSUMER_WORKGROUP_SIZE}u;
const CONTROL_GENERATION_ID: u32 =
  ${M.GENERATION_ID}u;
const CONTROL_AUTHORITY_COUNT_WORD: u32 =
  ${M.AUTHORITY_COUNT_OFFSET_WORDS}u;
const CONTROL_AUTHORITY_SEAL_WORD: u32 =
  ${M.AUTHORITY_SEAL_OFFSET_WORDS}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${M.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${M.RADIX_DISPATCH_OFFSET_WORDS}u;
const CONTROL_DISPATCH_X_LIMIT: u32 =
  ${M.DISPATCH_X_LIMIT}u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;
const STATUS_INVALID_SEAL: u32 = 8u;
const STATUS_COUNT_OVERFLOW: u32 =
  16u;

fn sealed_count() -> u32 {
  let status = gpu_count_control[CONTROL_STATUS];
  let sealed =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u
    && gpu_count_control[CONTROL_COMPLETION_SEAL]
      == gpu_count_control[CONTROL_EXPECTED_SEAL];
  return select(0u, gpu_count_control[CONTROL_LIVE_COUNT], sealed);
}

fn radix_dispatch_x() -> u32 {
  return gpu_count_control[
    gpu_count_control[CONTROL_RADIX_DISPATCH_WORD]
  ];
}

fn keys_equal(left_record: u32, right_record: u32) -> bool {
  let stride = gpu_count_control[CONTROL_KEY_STRIDE];
  let left_base = left_record * stride;
  let right_base = right_record * stride;
  for (
    var word = 0u;
    word < gpu_count_control[CONTROL_KEY_WORD_COUNT];
    word = word + 1u
  ) {
    if (unique_source_keys[left_base + word]
      != unique_source_keys[right_base + word]) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(256)
fn mark_gpu_count_heads(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let index = linear_group * 256u + local_id.x;
  if (index >= count) {
    return;
  }
  if (index == 0u) {
    unique_head_flags[index] = 1u;
    return;
  }
  let current = unique_sorted_indices[index];
  let previous = unique_sorted_indices[index - 1u];
  unique_head_flags[index] =
    select(1u, 0u, keys_equal(current, previous));
}

@compute @workgroup_size(256)
fn scatter_gpu_count_unique(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let count = sealed_count();
  let linear_group =
    workgroup_id.x + workgroup_id.y * radix_dispatch_x();
  let sorted_position = linear_group * 256u + local_id.x;
  if (sorted_position >= count
    || unique_head_flags[sorted_position] == 0u) {
    return;
  }
  let unique_index = unique_head_offsets[sorted_position];
  let source_record = unique_sorted_indices[sorted_position];
  let key_word_count =
    gpu_count_control[CONTROL_KEY_WORD_COUNT];
  let source_base =
    source_record * gpu_count_control[CONTROL_KEY_STRIDE];
  let output_base = unique_index * key_word_count;
  for (var word = 0u; word < key_word_count; word = word + 1u) {
    unique_output_keys[output_base + word] =
      unique_source_keys[source_base + word];
  }
  unique_output_offsets[unique_index] = sorted_position;
}

fn write_consumer_dispatch(unique_count: u32, admitted: bool) {
  if (!admitted || unique_count == 0u) {
    unique_dispatch[0u] = 0u;
    unique_dispatch[1u] = 0u;
    unique_dispatch[2u] = 0u;
    return;
  }
  let consumer_width =
    gpu_count_control[CONTROL_CONSUMER_WORKGROUP_SIZE];
  let group_count =
    unique_count / consumer_width
    + select(0u, 1u, unique_count % consumer_width != 0u);
  let dispatch_limit =
    gpu_count_control[CONTROL_DISPATCH_X_LIMIT];
  let dispatch_x = min(group_count, dispatch_limit);
  let dispatch_y =
    group_count / dispatch_x
    + select(0u, 1u, group_count % dispatch_x != 0u);
  let shape_admitted = dispatch_y <= dispatch_limit;
  unique_dispatch[0u] = select(0u, dispatch_x, shape_admitted);
  unique_dispatch[1u] = select(0u, dispatch_y, shape_admitted);
  unique_dispatch[2u] = select(0u, 1u, shape_admitted);
}

@compute @workgroup_size(1)
fn finalize_gpu_count_unique() {
  let expected_seal =
    gpu_count_control[CONTROL_EXPECTED_SEAL];
  let authority_count = gpu_count_authority[
    gpu_count_control[CONTROL_AUTHORITY_COUNT_WORD]
  ];
  let authority_seal = gpu_count_authority[
    gpu_count_control[CONTROL_AUTHORITY_SEAL_WORD]
  ];
  var status = gpu_count_control[CONTROL_STATUS];
  let preflight_admitted =
    (status & STATUS_ADMITTED) != 0u
    && (status & STATUS_FAIL_CLOSED) == 0u;
  let authority_stable =
    authority_seal == expected_seal
    && authority_count == gpu_count_control[CONTROL_LIVE_COUNT]
    && gpu_count_control[CONTROL_COMPLETION_SEAL] == expected_seal;
  let admitted = preflight_admitted && authority_stable;
  if (preflight_admitted && !authority_stable) {
    status =
      (status & (~STATUS_ADMITTED))
      | STATUS_FAIL_CLOSED
      | STATUS_INVALID_SEAL;
  }

  let count = select(
    0u,
    gpu_count_control[CONTROL_LIVE_COUNT],
    admitted
  );
  var unique_count = 0u;
  if (count > 0u) {
    let last = count - 1u;
    unique_count =
      unique_head_offsets[last] + unique_head_flags[last];
  }
  unique_output_offsets[unique_count] = count;
  unique_evidence[0u] =
    gpu_count_control[CONTROL_GENERATION_ID];
  unique_evidence[1u] = select(authority_count, count, admitted);
  unique_evidence[2u] = unique_count;
  unique_evidence[3u] = select(0u, 1u, admitted);
  unique_evidence[4u] = select(
    0u,
    1u,
    (status & STATUS_COUNT_OVERFLOW) != 0u
  );
  unique_evidence[5u] =
    gpu_count_control[CONTROL_KEY_WORD_COUNT];
  unique_evidence[6u] =
    gpu_count_control[CONTROL_KEY_STRIDE];
  unique_evidence[7u] = status;
  write_consumer_dispatch(unique_count, admitted);
}
`;function q({elementCount:e,maxComputeWorkgroupsPerDimension:t=65535}={}){let n=x(e,`elementCount`,{max:4294967295}),r=[],a=n;for(;;){let e=O(a);if(r.push({level:r.length,elementCount:a,groupCount:e,dispatch:j(e,t),blockSumsByteLength:w(e*v),blockOffsetsByteLength:e>1?w(e*v):0}),e<=1)break;a=e}return{schema:i,status:`webgpu-u32-exclusive-scan-plan-ready`,elementCount:n,workgroupSize:256,elementsPerWorkgroup:512,maxComputeWorkgroupsPerDimension:t,levelCount:r.length,levels:r,scratchByteLength:r.reduce((e,t)=>e+t.blockSumsByteLength+t.blockOffsetsByteLength,0),readbackRequired:!1}}function ie(e){return!e?.levels||e.levels.length<2?null:e.levels[e.levels.length-2].elementCount<=32768?e.levels.length-1:null}function ae(e){if(!e?.levels||e.levels.length<1)throw TypeError(`scan plan with at least one level is required`);return e.levels.length*2-1-(ie(e)===null?0:1)}function oe(){let e=({cacheKey:e,label:t,code:n,entryPoint:r})=>Object.freeze({cacheKey:e,label:t,code:n,entryPoint:r,bindings:Object.freeze([])});return Object.freeze({schema:`peercompute.ulg.webgpu-stable-radix-pipeline-descriptors.v0`,scanBlocks:e({cacheKey:`ulg-webgpu-u32-exclusive-scan.v1`,label:`ulg-webgpu-u32-exclusive-scan-blocks`,code:U,entryPoint:`scan_blocks`}),scanAdd:e({cacheKey:`ulg-webgpu-u32-exclusive-scan.v1`,label:`ulg-webgpu-u32-exclusive-scan-add-block-offsets`,code:U,entryPoint:`add_scanned_block_offsets`}),scanFusedTopAdd:e({cacheKey:`ulg-webgpu-u32-exclusive-scan.v1`,label:`ulg-webgpu-u32-exclusive-scan-fused-top-add`,code:U,entryPoint:`scan_top_and_add_lower`}),initialize:e({cacheKey:`ulg-webgpu-stable-radix.v1`,label:`ulg-webgpu-stable-radix-initialize`,code:te,entryPoint:`initialize_indices`}),histogram:e({cacheKey:`ulg-webgpu-stable-radix.v1`,label:`ulg-webgpu-stable-radix-histogram`,code:te,entryPoint:`histogram`}),scatter:e({cacheKey:`ulg-webgpu-stable-radix.v1`,label:`ulg-webgpu-stable-radix-scatter`,code:te,entryPoint:`scatter`}),markHeads:e({cacheKey:`ulg-webgpu-sorted-unique.v1`,label:`ulg-webgpu-sorted-unique-mark-heads`,code:W,entryPoint:`mark_heads`}),scatterUnique:e({cacheKey:`ulg-webgpu-sorted-unique.v1`,label:`ulg-webgpu-sorted-unique-scatter`,code:W,entryPoint:`scatter_unique`}),finalizeUnique:e({cacheKey:`ulg-webgpu-sorted-unique.v1`,label:`ulg-webgpu-sorted-unique-finalize`,code:W,entryPoint:`finalize_unique`}),serialHistogramScan:e({cacheKey:`ulg-webgpu-serial-radix-histogram-scan.v1`,label:`ulg-webgpu-serial-radix-histogram-scan`,code:`
struct RadixParams {
  element_count: u32,
  workgroup_count: u32,
  key_stride_words: u32,
  key_word_index: u32,
  bit_offset: u32,
  key_word_count: u32,
  generation_id: u32,
  dispatch_x: u32,
};

@group(0) @binding(0) var<storage, read> radix_histograms: array<u32>;
@group(0) @binding(1) var<storage, read_write> radix_histogram_offsets: array<u32>;
@group(0) @binding(2) var<uniform> radix_params: RadixParams;

@compute @workgroup_size(1)
fn scan_histogram_serial() {
  let histogram_element_count = radix_params.workgroup_count * 16u;
  var running = 0u;
  for (var index = 0u; index < histogram_element_count; index = index + 1u) {
    radix_histogram_offsets[index] = running;
    running = running + radix_histograms[index];
  }
}
`,entryPoint:`scan_histogram_serial`})})}function J(e,t){let n=oe();return{scan:l(e,n.scanBlocks).pipeline,add:l(e,n.scanAdd).pipeline,fusedTopAdd:l(e,n.scanFusedTopAdd).pipeline}}function se(e,{maxElementCount:t,label:n=`ulg-webgpu-u32-scan`,maxComputeWorkgroupsPerDimension:r=null,retainParamsBuffer:a=!1,fixedElementCount:o=null,retainedParamsSlotCount:s=1}={}){P(e);let c=x(t,`maxElementCount`,{max:4294967295}),l=x(e.limits?.maxComputeWorkgroupsPerDimension??65535,`device.limits.maxComputeWorkgroupsPerDimension`,{max:4294967295}),u=r==null?l:Math.min(l,x(r,`maxComputeWorkgroupsPerDimension`,{max:4294967295})),d=q({elementCount:c,maxComputeWorkgroupsPerDimension:u}),f=a&&o!=null?x(o,`fixedElementCount`,{max:c}):null,p=f===null?d:q({elementCount:f,maxComputeWorkgroupsPerDimension:u}),m=a?x(s,`retainedParamsSlotCount`,{max:h}):0,g=p.levelCount*256,_=L();try{let t=J(e,n),r=a?_.ownBuffer(e.createBuffer({label:`${n}-params-retained`,size:g*m,usage:b.UNIFORM|b.COPY_DST})):null,o=d.levels.map(t=>_.ownBuffer(F(e,`${n}-level-${t.level}-block-sums`,t.groupCount))),s=d.levels.map(t=>t.groupCount>1?_.ownBuffer(F(e,`${n}-level-${t.level}-block-offsets`,t.groupCount)):null),l=new Set,h=r?new WeakMap:null,w=Array.from({length:m},()=>null),T={},E=new WeakMap,D=new WeakSet,O=new WeakSet,k=new WeakMap,A=r&&f===null?Array.from({length:m},(e,t)=>({slotIndex:t,inUse:!1})):null,j=!1;function M(e){let t=Error(`${n} retained variable params slot ${e} is in use`);return t.code=`ERR_WEBGPU_SCAN_PARAMS_SLOT_IN_USE`,t.slotIndex=e,t.slotCapacity=m,t}function N(e){if(A?.[e]?.inUse)throw M(e)}function P(e){if(!A)return null;N(e);let t=A[e];t.inUse=!0;let n=!1;return{owner:T,slotIndex:e,release(){return n?!1:(n=!0,t.inUse=!1,!0)}}}function L(e){if(j||!e||typeof e!=`object`||!D.has(e)||O.has(e))return!1;let t=e&&typeof e==`object`?E.get(e)??null:null;return A===null||t?.owner===T}function R(e){if(!L(e))return!1;let t=E.get(e)??null;return t&&t.release()!==!0?!1:(t&&E.delete(e),O.add(e),!0)}function z(e){let t=[];for(let n of e||[])l.has(n)&&(l.delete(n),t.push(n));I(t)}function B(e,{destroyTransientBuffers:t=!0,ownedTransientBuffers:n=null}={}){if(!L(e))return!1;let r=n??k.get(e)??Object.freeze([]);return R(e)?(k.delete(e),t&&z(r),!0):!1}function U(e,{discardedEncoder:t=!1}={}){if(!L(e))return!1;if(t!==!0)throw TypeError(`${n} releasePrepared requires { discardedEncoder: true }; use releasePreparedAfter with a submission-fence thenable after submission`);return B(e)}function te(e,t){let n=L(e)?k.get(e)??Object.freeze([]):null;return C(t,`submissionFence must be a thenable that resolves after GPU completion`).then(()=>n===null?!1:B(e,{ownedTransientBuffers:n}))}function W(e){return r!==null&&L(e)}function G(e){return W(e)?B(e,{destroyTransientBuffers:!1}):!1}function ne(e,t={}){if(!L(e))return!1;if((E.get(e)??null)?.owner===T&&t.discardedEncoder!==!0)throw TypeError(`${n} retained variable params require { discardedEncoder: true }; use releasePreparedAfter with a submission-fence thenable after submission`);return B(e)}function re({inputBuffer:i,outputBuffer:a,elementCount:d,retainedParamsSlotIndex:_=0}){if(j)throw Error(`${n} is destroyed`);if(!i||!a)throw TypeError(`exclusive scan requires inputBuffer and outputBuffer`);let y=x(d,`elementCount`,{max:c});if(f!==null&&y!==f)throw RangeError(`${n} retained scan params require fixed elementCount ${f}`);let C=r?S(_,`retainedParamsSlotIndex`,{max:m-1}):0;N(C);let T=f===null?q({elementCount:y,maxComputeWorkgroupsPerDimension:u}):p,O=r?C*g:0,A=ie(T),M=`${T.levelCount}:${A??`none`}`,F=h?.get(i)?.get(a)?.[C]??null,L=F?.topologyKey===M,R=null,ee=null;try{let c=r||e.createBuffer({label:`${n}-params-${y}`,size:T.levelCount*256,usage:b.UNIFORM|b.COPY_DST}),u=new Uint32Array(T.levelCount*256/v);for(let e of T.levels)u[e.level*256/v]=e.elementCount,u[e.level*256/v+1]=e.dispatch[0];let d=!r||w[C]!==y;r||(l.add(c),R=c);let f=[],p=i,g=a;for(let r of T.levels){let i=r.level===A?null:L?F.levels[r.level].scanBindGroup:e.createBindGroup({label:`${n}-scan-level-${r.level}`,layout:t.scan.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:g}},{binding:2,resource:{buffer:o[r.level]}},{binding:3,resource:{buffer:c,offset:O+r.level*256,size:16}}]});f.push({...r,inputBuffer:p,outputBuffer:g,scanBindGroup:i}),r.groupCount>1&&(p=o[r.level],g=s[r.level])}for(let r=f.length-2;r>=0;--r){let i=f[r];r!==A-1&&(i.addBindGroup=L?F.levels[i.level].addBindGroup:e.createBindGroup({label:`${n}-add-level-${i.level}`,layout:t.add.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i.outputBuffer}},{binding:1,resource:{buffer:s[i.level]}},{binding:3,resource:{buffer:c,offset:O+i.level*256,size:16}}]}))}if(A!==null){let r=f[A],i=f[A-1];r.fusedTopAddBindGroup=L?F.levels[r.level].fusedTopAddBindGroup:e.createBindGroup({label:`${n}-fused-top-${r.level}-add-${i.level}`,layout:t.fusedTopAdd.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:r.inputBuffer}},{binding:1,resource:{buffer:r.outputBuffer}},{binding:2,resource:{buffer:o[r.level]}},{binding:3,resource:{buffer:c,offset:O+r.level*256,size:16}},{binding:4,resource:{buffer:i.outputBuffer}},{binding:5,resource:{buffer:c,offset:O+i.level*256,size:16}}]})}let _=ae(T);ee=P(C),d&&(e.queue.writeBuffer(c,O,u),r&&(w[C]=y));let x=Object.freeze(r?[]:[c]),S={plan:T,paramsBuffer:c,paramsData:u,paramsBaseOffset:O,retainedParamsSlotIndex:r?C:null,levels:f,fusedTopLevelIndex:A,fusedTopAddEnabled:A!==null,encodedDispatchCount:_,bindGroupCreationCount:L?0:_,paramsWritePerformed:d,paramsWriteCount:+!!d,preparedScanCacheHit:L,transientBuffers:[...x],paramsBufferResidency:r?`retained-reused`:`transient-per-encode`};if(ee&&E.set(S,ee),h&&!L){let e=h.get(i);e||(e=new WeakMap,h.set(i,e));let t=e.get(a);t||(t=Array.from({length:m},()=>null),e.set(a,t)),t[C]={topologyKey:M,levels:f.map(({scanBindGroup:e,addBindGroup:t,fusedTopAddBindGroup:n})=>({scanBindGroup:e,addBindGroup:t,fusedTopAddBindGroup:n}))}}return k.set(S,x),D.add(S),S}catch(e){throw ee?.release(),R&&l.delete(R)&&I([R]),e}}function K(e,r,{timestampProfiler:i=null,timestampMetadata:a={},labelPrefix:o=n,computePass:s=null,dispatchIndirectProvider:c=null}={}){if(!e?.beginComputePass)throw TypeError(`exclusive scan encoding requires a GPUCommandEncoder-like object`);let l=ee(i);if(s&&l)throw Error(`exclusive scan cannot share a compute pass while timestamp profiling is active`);if(s&&(!s.setPipeline||!s.dispatchWorkgroups))throw TypeError(`computePass must be a GPUComputePassEncoder-like object`);if(l){for(let n of r.levels){if(n.level===r.fusedTopLevelIndex){H(e,i,`${o}ScanTopAddL${n.level}`,{...a,scanLevel:n.level,elementCount:n.elementCount,fusedLowerLevel:n.level-1},t.fusedTopAdd,n.fusedTopAddBindGroup,[1,1,1],c);continue}H(e,i,`${o}ScanBlocksL${n.level}`,{...a,scanLevel:n.level,elementCount:n.elementCount},t.scan,n.scanBindGroup,n.dispatch,c)}for(let n=r.levels.length-2;n>=0;--n){if(n===r.fusedTopLevelIndex-1)continue;let s=r.levels[n];H(e,i,`${o}ScanAddL${s.level}`,{...a,scanLevel:s.level,elementCount:s.elementCount},t.add,s.addBindGroup,s.dispatch,c)}return r}let u=s||e.beginComputePass({label:`${o}GroupedScan`});for(let e of r.levels){if(e.level===r.fusedTopLevelIndex){V(u,t.fusedTopAdd,e.fusedTopAddBindGroup,[1,1,1],c);continue}V(u,t.scan,e.scanBindGroup,e.dispatch,c)}for(let e=r.levels.length-2;e>=0;--e){if(e===r.fusedTopLevelIndex-1)continue;let n=r.levels[e];V(u,t.add,n.addBindGroup,n.dispatch,c)}return s||u.end(),r}let oe={schema:i,status:`webgpu-u32-exclusive-scan-ready`,pipelineCount:Object.keys(t).length,maxElementCount:c,fixedElementCount:f,retainedParamsSlotCount:m,retainedParamsSlotStrideBytes:r?g:0,maxPlan:d,blockSums:o,blockOffsets:s,prepare:re,encodePrepared:K,encode(e,t,n={}){let r=re(t);try{return K(e,r,n),r}catch(e){throw B(r),e}},releasePrepared:U,releasePreparedAfter:te,canReleasePreparedQueueOrdered:W,releasePreparedQueueOrdered:G,releaseTransientBuffers:ne,allocationEntries(){return[...r?[{role:`scan-params-retained`,buffer:r}]:[],...o.map((e,t)=>({role:`scan-level-${t}-block-sums`,buffer:e})),...s.map((e,t)=>e?{role:`scan-level-${t}-block-offsets`,buffer:e}:null).filter(Boolean),...[...l].map(e=>({role:`scan-params-transient`,buffer:e}))]},destroy(){if(!j){j=!0,I([r,...o,...s,...l]),l.clear(),w.fill(null);for(let e of A||[])e.inUse=!1}}};return y.set(oe,{hasPreparedLease(e){return E.has(e)},releasePreparedLease:R,finalizePreparedFromParent(e){return B(e)}}),_.commit(),oe}catch(e){throw _.rollback(),e}}function ce(e,t,{serialHistogramScanEnabled:n=!1}={}){let r=oe(),i=t=>l(e,t).pipeline;return{initialize:i(r.initialize),histogram:i(r.histogram),scatter:i(r.scatter),...n?{serialHistogramScan:i(r.serialHistogramScan)}:{},markHeads:i(r.markHeads),scatterUnique:i(r.scatterUnique),finalizeUnique:i(r.finalizeUnique)}}const le=new WeakMap,Y=Symbol.for(`ulg.webgpu.rawDevice`);function ue(e,t){let n=e?.[Y]??e,r=typeof globalThis.GPUDevice==`function`&&n instanceof globalThis.GPUDevice;if(r){let e=le.get(n);if(e)return e}let i=e.createShaderModule({label:`${t}-gpu-count-prepare-shader`,code:G}),a=e.createShaderModule({label:`${t}-gpu-count-scan-shader`,code:ne}),o=e.createShaderModule({label:`${t}-gpu-count-radix-shader`,code:re}),s=e.createShaderModule({label:`${t}-gpu-count-unique-shader`,code:K}),c=(n,r,i)=>e.createComputePipeline({label:`${t}-gpu-count-${n}`,layout:`auto`,compute:{module:r,entryPoint:i}}),l={prepare:c(`prepare`,i,`prepare_gpu_count`),scanBlocks:c(`scan-blocks`,a,`scan_gpu_count_blocks`),scanAdd:c(`scan-add`,a,`add_gpu_count_block_offsets`),scanFusedTopAdd:c(`scan-fused-top-add`,a,`scan_gpu_count_top_and_add_lower`),initialize:c(`initialize`,o,`initialize_gpu_count_indices`),histogram:c(`histogram`,o,`histogram_gpu_count`),scatter:c(`scatter`,o,`scatter_gpu_count`),markHeads:c(`mark-heads`,s,`mark_gpu_count_heads`),scatterUnique:c(`scatter-unique`,s,`scatter_gpu_count_unique`),finalizeUnique:c(`finalize-unique`,s,`finalize_gpu_count_unique`)};return r&&le.set(n,l),l}function de(e,{maxElementCount:t,maxKeyWordCount:i=8,label:a=`ulg-webgpu-radix-unique`,maxComputeWorkgroupsPerDimension:o=null,retainConstantScanParamsBuffers:s=!1,retainVariableScanParamsBuffers:c=!1,serialHistogramScanMaxElementCount:l=0,retainedParamsSlotCount:u=128}={}){P(e);let d=x(t,`maxElementCount`,{max:4294967295}),f=x(i,`maxKeyWordCount`,{max:8}),p=S(l,`serialHistogramScanMaxElementCount`,{max:4294967295}),m=x(e.limits?.maxComputeWorkgroupsPerDimension??65535,`device.limits.maxComputeWorkgroupsPerDimension`,{max:4294967295}),w=o==null?m:Math.min(m,x(o,`maxComputeWorkgroupsPerDimension`,{max:4294967295})),A=x(e.limits?.maxComputeWorkgroupStorageSize??g,`device.limits.maxComputeWorkgroupStorageSize`,{max:4294967295});if(A<g)throw RangeError(`${a} scatter entry point requires ${g} bytes of workgroup storage but device.limits.maxComputeWorkgroupStorageSize is ${A}`);let M=s===!0,R=M?x(u,`retainedParamsSlotCount`,{max:h}):0,z=T(e),B=f*8,U=B*z,te=z,W=Number(e.limits?.maxBufferSize??2**53-1),G=Number(e.limits?.maxUniformBufferBindingSize??2**53-1),ne=(e,t)=>{let n=R*e;if(!Number.isSafeInteger(n)||n>W)throw RangeError(`${a} ${t} params arena requires ${n} bytes beyond device capacity`);if(32>G)throw RangeError(`${a} ${t} params binding exceeds maxUniformBufferBindingSize`);return n},re=k(d)*16,K=N({maxElementCount:d,maxComputeWorkgroupsPerDimension:w}),q=L();try{let t=ce(e,a,{serialHistogramScanEnabled:p>0}),i=q.ownBuffer(F(e,`${a}-sorted-indices-a`,d)),o=q.ownBuffer(F(e,`${a}-sorted-indices-b`,d)),l=q.ownBuffer(F(e,`${a}-histograms`,re)),u=q.ownBuffer(F(e,`${a}-histogram-offsets`,re)),m=q.ownBuffer(F(e,`${a}-head-flags`,d)),h=q.ownBuffer(F(e,`${a}-head-offsets`,d)),g=q.ownBuffer(F(e,`${a}-unique-keys`,d*f)),T=q.ownBuffer(F(e,`${a}-unique-offsets`,d+1)),A=q.ownBuffer(F(e,`${a}-evidence`,8)),N=q.ownBuffer(F(e,`${a}-dispatch-indirect`,3,b.INDIRECT)),P=M?q.ownBuffer(e.createBuffer({label:`${a}-radix-params-retained-arena`,size:ne(U,`radix`),usage:b.UNIFORM|b.COPY_DST})):null,G=M?q.ownBuffer(e.createBuffer({label:`${a}-unique-params-retained-arena`,size:ne(te,`unique`),usage:b.UNIFORM|b.COPY_DST})):null,ie=q.ownRuntime(se(e,{maxElementCount:re,label:`${a}-histogram-scan`,maxComputeWorkgroupsPerDimension:w,retainParamsBuffer:s,fixedElementCount:c?null:re,retainedParamsSlotCount:c&&R||1})),ae=q.ownRuntime(se(e,{maxElementCount:d,label:`${a}-head-scan`,maxComputeWorkgroupsPerDimension:w,retainParamsBuffer:s,fixedElementCount:c?null:d,retainedParamsSlotCount:c&&R||1})),oe=(e,t,n)=>{let r=y.get(t);return!e||!r?.hasPreparedLease(n)?!1:e.addChildLease({release:()=>r.releasePreparedLease(n)})},J=new Set,le=Array.from({length:R},(e,t)=>({slotIndex:t,inUse:!1,radixByteOffset:t*U,uniqueByteOffset:t*te,bindGroups:new Map})),Y=new WeakMap,de=new WeakSet,fe=new WeakMap,X=new WeakMap,Z=null,pe=!1;function me(){if(Z)return Z;if(pe)throw Error(`${a} is destroyed`);let t=L();try{let n=ue(e,a),r=t.ownBuffer(F(e,`${a}-gpu-count-control`,K.controlWordCount,b.INDIRECT)),i=1*z;if(!Number.isSafeInteger(i)||i>W)throw RangeError(`${a} GPU-count config arena requires ${i} bytes beyond device capacity`);let o=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-config-retained-arena`,size:i,usage:b.UNIFORM|b.COPY_DST})),s=Array.from({length:1},(e,t)=>({slotIndex:t,byteOffset:t*z,inUse:!1,bindGroups:new Map})),c=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-digit-static`,size:B*z,usage:b.UNIFORM|b.COPY_DST})),p=new Uint32Array(B*z/v),g=0;for(let e=f-1;e>=0;--e)for(let t=0;t<32;t+=4){let n=g*z/v;p[n]=e,p[n+1]=t,g+=1}e.queue.writeBuffer(c,0,p);let _=K.histogramScanLevelCount+K.headScanLevelCount,y=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-scan-static`,size:_*z,usage:b.UNIFORM|b.COPY_DST})),x=new Uint32Array(_*z/v),C=0,w=(e,t,n)=>{let r=C;for(let r=0;r<n;r+=1){let n=C*z/v;x[n]=e+r,x[n+1]=t+r*6,x[n+2]=t+r*6+3,C+=1}return r},T=w(K.histogramScanCountOffsetWords,K.histogramScanDispatchOffsetWords,K.histogramScanLevelCount),E=w(K.headScanCountOffsetWords,K.headScanDispatchOffsetWords,K.headScanLevelCount);e.queue.writeBuffer(y,0,x);let D=[{role:`radix-gpu-count-control`,buffer:r},{role:`radix-gpu-count-config-retained-arena`,buffer:o},{role:`radix-gpu-count-digit-static`,buffer:c},{role:`radix-gpu-count-scan-static`,buffer:y}],k=({prefix:i,maximumElementCount:o,levelCount:s,countOffsetWords:c,dispatchOffsetWords:l,firstStaticRow:u,sourceInputBuffer:d,sourceOutputBuffer:f})=>{let p=[],m=[],h=[],g=o;for(let n=0;n<s;n+=1){h.push(g);let r=O(g),o=t.ownBuffer(F(e,`${a}-gpu-count-${i}-level-${n}-sums`,r)),s=t.ownBuffer(F(e,`${a}-gpu-count-${i}-level-${n}-offsets`,r));p.push(o),m.push(s),D.push({role:`radix-gpu-count-${i}-scan-sums`,buffer:o},{role:`radix-gpu-count-${i}-scan-offsets`,buffer:s}),g=r}let _=s>=2&&h[s-2]<=32768?s-1:null,b=[];for(let t=0;t<s;t+=1){let o=t===0?d:p[t-1],s=t===0?f:m[t-1],g=(u+t)*z,x=e.createBindGroup({label:`${a}-gpu-count-${i}-scan-block-${t}`,layout:n.scanBlocks.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:p[t]}},{binding:4,resource:{buffer:r}},{binding:5,resource:{buffer:y,offset:g,size:16}}]}),S=e.createBindGroup({label:`${a}-gpu-count-${i}-scan-add-${t}`,layout:n.scanAdd.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:s}},{binding:3,resource:{buffer:m[t]}},{binding:4,resource:{buffer:r}},{binding:5,resource:{buffer:y,offset:g,size:16}}]}),C=t===_?e.createBindGroup({label:`${a}-gpu-count-${i}-scan-fused-top-${t}`,layout:n.scanFusedTopAdd.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:p[t]}},{binding:4,resource:{buffer:r}},{binding:5,resource:{buffer:y,offset:g,size:16}},{binding:6,resource:{buffer:t===1?f:m[t-2]}},{binding:7,resource:{buffer:y,offset:(u+t-1)*z,size:16}}]}):null;b.push(Object.freeze({level:t,maximumElementCount:h[t],countOffsetWords:c+t,blockDispatchOffsetWords:l+t*6,blockDispatchOffsetBytes:(l+t*6)*v,addDispatchOffsetWords:l+t*6+3,addDispatchOffsetBytes:(l+t*6+3)*v,blockBindGroup:x,addBindGroup:S,fusedTopAddBindGroup:C}))}return Object.freeze({levels:b,fusedTopLevelIndex:_,fusedTopAddEnabled:_!==null,encodedDispatchCount:b.length*2-1-(_===null?0:1)})},A={pipelines:n,controlBuffer:r,configArena:o,configSlotCount:1,digitStaticBuffer:c,scanStaticBuffer:y,histogramScanPopulation:k({prefix:`histogram`,maximumElementCount:re,levelCount:K.histogramScanLevelCount,countOffsetWords:K.histogramScanCountOffsetWords,dispatchOffsetWords:K.histogramScanDispatchOffsetWords,firstStaticRow:T,sourceInputBuffer:l,sourceOutputBuffer:u}),headScanPopulation:k({prefix:`head`,maximumElementCount:d,levelCount:K.headScanLevelCount,countOffsetWords:K.headScanCountOffsetWords,dispatchOffsetWords:K.headScanDispatchOffsetWords,firstStaticRow:E,sourceInputBuffer:m,sourceOutputBuffer:h}),allocationEntries:D,acquireConfigSlot(e=null){let t=null;if(t=e==null?s.find(e=>!e.inUse)??null:s[S(e,`retainedParamsSlotIndex`,{max:0})],!t||t.inUse){let t=Error(`${a} already has a GPU-count execution in flight`);throw t.code=`ERR_WEBGPU_RADIX_GPU_COUNT_EXECUTION_IN_FLIGHT`,t.slotCapacity=1,t.requestedSlotIndex=e??null,t}t.inUse=!0;let n=!1;return{slot:t,release(){return n?!1:(n=!0,t.inUse=!1,!0)}}},destroy(){I(D.map(({buffer:e})=>e));for(let e of s)e.inUse=!1,e.bindGroups.clear()}};return t.commit(),Z=A,A}catch(e){throw t.rollback(),e}}function he(e,t,{ownedTransientBuffers:n=[],childPreparedScans:r=[]}={}){let i=Object.freeze([...n]),o=Object.freeze(r.map(({scanRuntime:e,internals:t,prepared:n})=>{let r=t??y.get(e);if(!r?.finalizePreparedFromParent)throw Error(`${a} child scan cleanup capability is unavailable`);return Object.freeze({internals:r,prepared:n})}));return fe.set(e,i),X.set(e,o),de.add(e),t&&Y.set(e,t),e}function ge(e=null){if(!M)return null;let t=null;if(e!=null)t=le[S(e,`retainedParamsSlotIndex`,{max:R-1})];else for(let e=0;e<R;e+=1)if(!le[e].inUse){t=le[e];break}if(!t||t.inUse){let t=Error(`${a} retained params slot arena is exhausted`);throw t.code=`ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED`,t.slotCapacity=R,t.requestedSlotIndex=e??null,t}t.inUse=!0;let n=!1,r=new Set;return{slot:t,addChildLease(e){return e?.release?n?(e.release(),!1):(r.add(e),!0):!1},release(){if(n)return!1;n=!0;for(let e of r)e.release();return r.clear(),t.inUse=!1,!0}}}function Q(t,n,r,i,a,o){let s=D(r,a),c=t?.bindGroups.get(n)??null;if(c&&E(c.signature,s))return o.reused+=1,c.bindGroup;let l=e.createBindGroup({label:i,layout:r.getBindGroupLayout(0),entries:a});return t&&t.bindGroups.set(n,{signature:s,bindGroup:l}),o.created+=1,l}function _e({elementCount:e,keyWordCount:t,keyStrideWords:n}){if(pe)throw Error(`${a} is destroyed`);let r=S(e,`elementCount`,{max:d}),i=x(t,`keyWordCount`,{max:f}),o=x(n,`keyStrideWords`,{max:65535});if(o<i)throw RangeError(`keyStrideWords must cover keyWordCount`);return{count:r,words:i,stride:o}}function ve({count:t,words:n,stride:r,generationId:i},o=null){let s=n*8,c=o?.slot??null,l=c?.inUse===!0?P:e.createBuffer({label:`${a}-radix-params-${i}`,size:Math.max(z,s*z),usage:b.UNIFORM|b.COPY_DST}),u=c?null:l;try{let a=c?.radixByteOffset??0,o=new Uint32Array(Math.max(z,s*z)/v),d=k(t),f=j(d,w),p=0;for(let e=n-1;e>=0;--e)for(let a=0;a<32;a+=4){let s=p*z/v;o[s]=t,o[s+1]=d,o[s+2]=r,o[s+3]=e,o[s+4]=a,o[s+5]=n,o[s+6]=i,o[s+7]=f[0],p+=1}return e.queue.writeBuffer(l,a,o),u&&J.add(u),{buffer:l,byteOffset:a,transientBuffer:u,paramsSlotIndex:c?.slotIndex??null,paramsBufferResidency:c?`retained-slot-arena`:`transient-per-encode`}}catch(e){throw u&&(J.delete(u),I([u])),e}}function ye(e,{keyBuffer:r,elementCount:s,keyWordCount:d,keyStrideWords:f=d,generationId:m=0,timestampProfiler:h=null,timestampMetadata:g={},dispatchIndirectProvider:_=null}={},v=null){if(!e?.beginComputePass)throw TypeError(`stable radix encoding requires a GPUCommandEncoder-like object`);if(!r)throw TypeError(`stable radix encoding requires keyBuffer`);let{count:b,words:x,stride:C}=_e({elementCount:s,keyWordCount:d,keyStrideWords:f});if(b===0)return he({schema:n,status:`webgpu-stable-radix-empty`,elementCount:0,sortedIndicesBuffer:i,transientBuffers:[]},v,{ownedTransientBuffers:[]});let T=S(m,`generationId`,{max:4294967295});if(M&&!v?.slot?.inUse)throw Error(`${a} retained radix encoding requires an active params slot lease`);let E=null,D=null;try{E=ve({count:b,words:x,stride:C,generationId:T},v);let s=E.buffer,d=E.byteOffset,f=k(b),m=j(f,w),y=f*16,S=p>0&&y>512&&y<=p;D=S?null:ie.prepare({inputBuffer:l,outputBuffer:u,elementCount:y,retainedParamsSlotIndex:c?v?.slot?.slotIndex??0:0}),D&&oe(v,ie,D);let O=[...E.transientBuffer?[E.transientBuffer]:[],...D?.transientBuffers??[]],A={created:0,reused:0},M=[{binding:2,resource:{buffer:i}},{binding:5,resource:{buffer:s,offset:d,size:32}}],N=Q(v?.slot,`radix-initialize`,t.initialize,`${a}-initialize-bind-group`,M,A),P=S?Q(v?.slot,`radix-serial-histogram-scan`,t.serialHistogramScan,`${a}-serial-histogram-scan-bind-group`,[{binding:0,resource:{buffer:l}},{binding:1,resource:{buffer:u}},{binding:2,resource:{buffer:s,offset:d,size:32}}],A):null,F=i,I=o,L=0,R=[];for(let e=x-1;e>=0;--e)for(let n=0;n<32;n+=4){let i=d+L*z,o=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:F}},{binding:3,resource:{buffer:l}},{binding:5,resource:{buffer:s,offset:i,size:32}}],c=Q(v?.slot,`radix-histogram-${L}`,t.histogram,`${a}-histogram-${e}-${n}`,o,A),f=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:I}},{binding:4,resource:{buffer:u}},{binding:5,resource:{buffer:s,offset:i,size:32}}],p=Q(v?.slot,`radix-scatter-${L}`,t.scatter,`${a}-scatter-${e}-${n}`,f,A);R.push({word:e,shift:n,histogramBindGroup:c,scatterBindGroup:p}),[F,I]=[I,F],L+=1}let B=ee(h),U=B?null:e.beginComputePass({label:`${a}GroupedRadixSort`});B?H(e,h,`${a}Initialize`,{...g,generationId:T,elementCount:b},t.initialize,N,m,_):V(U,t.initialize,N,m,_);for(let n of R){let r={...g,generationId:T,keyWord:n.word,bitOffset:n.shift};B?H(e,h,`${a}Histogram`,r,t.histogram,n.histogramBindGroup,m,_):V(U,t.histogram,n.histogramBindGroup,m,_),S?B?H(e,h,`${a}RadixHistogramSerialScan`,r,t.serialHistogramScan,P,[1,1,1],_):V(U,t.serialHistogramScan,P,[1,1,1],_):ie.encodePrepared(e,D,{timestampProfiler:h,timestampMetadata:r,labelPrefix:`${a}RadixHistogram`,computePass:U,dispatchIndirectProvider:_}),B?H(e,h,`${a}Scatter`,r,t.scatter,n.scatterBindGroup,m,_):V(U,t.scatter,n.scatterBindGroup,m,_)}return U?.end(),he({schema:n,status:`webgpu-stable-multiword-radix-encoded`,generationId:T,elementCount:b,keyWordCount:x,keyStrideWords:C,passCount:L,sortedIndicesBuffer:F,histogramElementCount:y,histogramScanMode:S?`serial-small`:`parallel-scan`,encodedDispatchCount:1+L*(S?3:2+D.encodedDispatchCount),encodedComputePassCount:B?1+L*(S?3:2+D.encodedDispatchCount):1,bindGroupCreationCount:A.created+(D?.bindGroupCreationCount??0),bindGroupReuseCount:A.reused+(S?Math.max(0,L-1):Math.max(0,L-+!D.preparedScanCacheHit)*D.encodedDispatchCount),paramsBufferCreationCount:+!!E.transientBuffer,paramsWriteCount:1+(D?.paramsWriteCount??0),paramsSlotIndex:E.paramsSlotIndex,paramsBufferResidency:E.paramsBufferResidency,readbackPerformed:!1,transientBuffers:O},v,{ownedTransientBuffers:O,childPreparedScans:D?[{scanRuntime:ie,prepared:D}]:[]})}catch(e){throw D&&y.get(ie)?.finalizePreparedFromParent(D),E?.transientBuffer&&J.delete(E.transientBuffer)&&I([E.transientBuffer]),e}}function be({count:t,words:n,stride:r,generationId:i,consumerWorkgroupSize:o,dispatchX:s},c=null){let l=c?.slot??null,u=l?.inUse===!0?G:e.createBuffer({label:`${a}-unique-params-${i}`,size:z,usage:b.UNIFORM|b.COPY_DST}),d=l?null:u;try{let a=l?.uniqueByteOffset??0;return e.queue.writeBuffer(u,a,new Uint32Array([t,r,n,i,o,s,0,0])),d&&J.add(d),{buffer:u,byteOffset:a,transientBuffer:d,paramsSlotIndex:l?.slotIndex??null,paramsBufferResidency:l?`retained-slot-arena`:`transient-per-encode`}}catch(e){throw d&&(J.delete(d),I([d])),e}}function xe(e,{keyBuffer:r,sortedIndicesBuffer:i,elementCount:o,keyWordCount:s,keyStrideWords:l=s,generationId:u=0,consumerWorkgroupSize:f=64,timestampProfiler:p=null,timestampMetadata:b={},dispatchIndirectProvider:C=null}={},E=null){if(!e?.beginComputePass||!e?.clearBuffer)throw TypeError(`unique encoding requires a GPUCommandEncoder-like object`);if(!r||!i)throw TypeError(`unique encoding requires keyBuffer and sortedIndicesBuffer`);let{count:D,words:O,stride:P}=_e({elementCount:o,keyWordCount:s,keyStrideWords:l}),F=S(u,`generationId`,{max:4294967295}),L=x(f,`consumerWorkgroupSize`,{max:1024}),R=j(D>0?k(D):1,w);if(M&&!E?.slot?.inUse)throw Error(`${a} retained unique encoding requires an active params slot lease`);let z=null,B=null;try{z=be({count:D,words:O,stride:P,generationId:F,consumerWorkgroupSize:L,dispatchX:R[0]},E);let o=z.buffer,s=z.byteOffset,l=z.transientBuffer?[z.transientBuffer]:[],u={created:0,reused:0};e.clearBuffer(A),e.clearBuffer(N),e.clearBuffer(T,0,v);let f=null,y=null;if(D>0){let e=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:m}},{binding:8,resource:{buffer:o,offset:s,size:32}}];f=Q(E?.slot,`unique-mark-heads`,t.markHeads,`${a}-mark-heads-bind-group`,e,u),B=ae.prepare({inputBuffer:m,outputBuffer:h,elementCount:D,retainedParamsSlotIndex:c?E?.slot?.slotIndex??0:0}),oe(E,ae,B),l.push(...B.transientBuffers);let n=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:h}},{binding:4,resource:{buffer:g}},{binding:5,resource:{buffer:T}},{binding:8,resource:{buffer:o,offset:s,size:32}}];y=Q(E?.slot,`unique-scatter`,t.scatterUnique,`${a}-scatter-unique-bind-group`,n,u)}let x=[{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:h}},{binding:5,resource:{buffer:T}},{binding:6,resource:{buffer:A}},{binding:7,resource:{buffer:N}},{binding:8,resource:{buffer:o,offset:s,size:32}}],S=Q(E?.slot,`unique-finalize`,t.finalizeUnique,`${a}-finalize-unique-bind-group`,x,u),w=ee(p),k={...b,generationId:F,elementCount:D},j=w?null:e.beginComputePass({label:`${a}GroupedUnique`});return D>0&&(w?H(e,p,`${a}MarkUniqueHeads`,k,t.markHeads,f,R,C):V(j,t.markHeads,f,R,C),ae.encodePrepared(e,B,{timestampProfiler:p,timestampMetadata:{...b,generationId:F},labelPrefix:`${a}UniqueHead`,computePass:j,dispatchIndirectProvider:C}),w?H(e,p,`${a}ScatterUnique`,k,t.scatterUnique,y,R,C):V(j,t.scatterUnique,y,R,C)),w?H(e,p,`${a}FinalizeUnique`,k,t.finalizeUnique,S,[1,1,1],C):(V(j,t.finalizeUnique,S,[1,1,1],C),j.end()),he({schema:n,status:`webgpu-sorted-unique-csr-encoded`,generationId:F,elementCount:D,keyWordCount:O,keyStrideWords:P,sortedIndicesBuffer:i,uniqueHeadFlagsBuffer:m,uniqueGroupIndexBySortedPositionBuffer:h,uniqueKeysBuffer:g,uniqueOffsetsBuffer:T,uniqueEvidenceBuffer:A,uniqueDispatchIndirectBuffer:N,uniqueKeyCapacity:d,uniqueOffsetCapacity:d+1,consumerWorkgroupSize:L,encodedDispatchCount:(D>0?2+B.encodedDispatchCount:0)+1,encodedComputePassCount:w?(D>0?2+B.encodedDispatchCount:0)+1:1,bindGroupCreationCount:u.created+(B?.bindGroupCreationCount??0),bindGroupReuseCount:u.reused+(B?.preparedScanCacheHit?B.encodedDispatchCount:0),paramsBufferCreationCount:+!!z.transientBuffer,paramsWriteCount:1+(B?.paramsWriteCount??0),clearedWordCount:_,paramsSlotIndex:z.paramsSlotIndex,paramsBufferResidency:z.paramsBufferResidency,readbackPerformed:!1,transientBuffers:l},E,{ownedTransientBuffers:l,childPreparedScans:B?[{scanRuntime:ae,prepared:B}]:[]})}catch(e){throw B&&y.get(ae)?.finalizePreparedFromParent(B),z?.transientBuffer&&J.delete(z.transientBuffer)&&I([z.transientBuffer]),e}}function Se(t,s={}){if(!t?.beginComputePass||!t?.clearBuffer)throw TypeError(`GPU-authored count radix encoding requires a GPUCommandEncoder-like object`);let c=s.keyBuffer,p=s.authorityBuffer??s.countAuthorityBuffer;if(!c||!p)throw TypeError(`GPU-authored count radix encoding requires keyBuffer and authorityBuffer`);let y=x(s.maxElementCount,`maxElementCount`,{max:d}),b=x(s.keyWordCount,`keyWordCount`,{max:f}),C=x(s.keyStrideWords??b,`keyStrideWords`,{max:65535});if(C<b)throw RangeError(`keyStrideWords must cover keyWordCount`);let E=x(s.consumerWorkgroupSize??64,`consumerWorkgroupSize`,{max:1024}),D=S(s.authorityCountByteOffset??s.countByteOffset??0,`authorityCountByteOffset`,{max:4294967292});if(D%v!==0)throw RangeError(`authorityCountByteOffset must be u32 aligned`);let O=s.generationSeal&&typeof s.generationSeal==`object`?s.generationSeal:null,k=x(O?.expected??O?.value??s.generationSeal,`generationSeal`,{max:4294967295}),j=S(O?.byteOffset??s.authoritySealByteOffset??D+v,`authoritySealByteOffset`,{max:4294967292});if(j%v!==0)throw RangeError(`authoritySealByteOffset must be u32 aligned`);if(j===D)throw RangeError(`authority count and generation seal require distinct u32 words`);if(Number.isFinite(Number(p.size))){let e=Number(p.size);if(D+v>e||j+v>e)throw RangeError(`authority count and generation seal offsets must be inside authorityBuffer`)}if(Number.isFinite(Number(c.size))){let e=y*C*v;if(!Number.isSafeInteger(e)||e>Number(c.size))throw RangeError(`keyBuffer must cover maxElementCount * keyStrideWords (${e} bytes)`)}let M=S(s.generationId??k,`generationId`,{max:4294967295});if(!Z){let e=Error(`${a} GPU-count resources are not prepared; call prepareGpuCountResources() outside the encode hot loop`);throw e.code=`ERR_WEBGPU_RADIX_GPU_COUNT_NOT_PREPARED`,e}let P=Z,{pipelines:F,controlBuffer:I,configArena:L,digitStaticBuffer:R,histogramScanPopulation:ee,headScanPopulation:V}=P,H=P.acquireConfigSlot(s.retainedParamsSlotIndex),U={created:0,reused:0},te=H.slot.byteOffset,W=new Uint32Array(z/v);W[0]=D/v,W[1]=j/v,W[2]=k,W[3]=y,W[4]=b,W[5]=C,W[6]=E,W[7]=M,W[8]=w,W[9]=K.histogramScanCountOffsetWords,W[10]=K.headScanCountOffsetWords,W[11]=K.radixDispatchOffsetWords,W[12]=K.histogramScanDispatchOffsetWords,W[13]=K.headScanDispatchOffsetWords,W[14]=K.histogramScanLevelCount,W[15]=K.headScanLevelCount,W[16]=K.indirectRowCount,W[17]=K.controlWordCount,W[18]=d,e.queue.writeBuffer(L,te,W);try{let e=Q(H.slot,`gpu-count-prepare`,F.prepare,`${a}-gpu-count-prepare-bind-group`,[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:I}},{binding:2,resource:{buffer:L,offset:te,size:80}}],U),x=Q(H.slot,`gpu-count-initialize`,F.initialize,`${a}-gpu-count-initialize-bind-group`,[{binding:2,resource:{buffer:i}},{binding:5,resource:{buffer:I}}],U),E=(f-b)*8,O=Array.from({length:b*8},(e,t)=>E+t),P=s.significantDigitRows,W=P==null?O:Array.from(P,(e,t)=>{let n=S(e,`significantDigitRows[${t}]`,{max:B-1});if(n<E)throw RangeError(`significantDigitRows must address only active key words`);return n});if(W.length===0)throw RangeError(`significantDigitRows must retain at least one digit`);for(let e=1;e<W.length;e+=1)if(W[e]<=W[e-1])throw RangeError(`significantDigitRows must be strictly increasing in LSD radix order`);let G=i,ne=o,re=[];for(let e=0;e<W.length;e+=1){let t=W[e],n={buffer:R,offset:t*z,size:16},r=Q(H.slot,`gpu-count-histogram-${t}`,F.histogram,`${a}-gpu-count-histogram-${e}`,[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:G}},{binding:3,resource:{buffer:l}},{binding:5,resource:{buffer:I}},{binding:6,resource:n}],U),i=Q(H.slot,`gpu-count-scatter-${t}`,F.scatter,`${a}-gpu-count-scatter-${e}`,[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:G}},{binding:2,resource:{buffer:ne}},{binding:4,resource:{buffer:u}},{binding:5,resource:{buffer:I}},{binding:6,resource:n}],U);re.push({histogramBindGroup:r,scatterBindGroup:i}),[G,ne]=[ne,G]}let q=G,ie=Q(H.slot,`gpu-count-mark-heads`,F.markHeads,`${a}-gpu-count-mark-heads-bind-group`,[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:q}},{binding:2,resource:{buffer:m}},{binding:8,resource:{buffer:I}}],U),ae=Q(H.slot,`gpu-count-scatter-unique`,F.scatterUnique,`${a}-gpu-count-scatter-unique-bind-group`,[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:q}},{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:h}},{binding:4,resource:{buffer:g}},{binding:5,resource:{buffer:T}},{binding:8,resource:{buffer:I}}],U),oe=Q(H.slot,`gpu-count-finalize-unique`,F.finalizeUnique,`${a}-gpu-count-finalize-unique-bind-group`,[{binding:2,resource:{buffer:m}},{binding:3,resource:{buffer:h}},{binding:5,resource:{buffer:T}},{binding:6,resource:{buffer:A}},{binding:7,resource:{buffer:N}},{binding:8,resource:{buffer:I}},{binding:9,resource:{buffer:p}}],U),J=s.gpuTimestampRecorder??null,se=typeof s.timestampProducerId==`string`&&s.timestampProducerId.trim()?s.timestampProducerId.trim():`webgpu-gpu-count-radix-sort-unique`,ce=J?.active===!0&&typeof J.beginEncoderSpan==`function`?J.beginEncoderSpan(t,{producerId:se,stage:`gpu-count-radix-sort-unique`,spanClass:`same-grouped-production-compute-pass`,...s.timestampMetadata||{},elementCount:null,elementCountSource:`authenticated-gpu-authority`,maxElementCount:y,keyWordCount:b}):null;t.clearBuffer(I),t.clearBuffer(A),t.clearBuffer(N),t.clearBuffer(T,0,v);let le=t.beginComputePass({label:`${a}GpuCountPrepare`});le.setPipeline(F.prepare),le.setBindGroup(0,e),le.dispatchWorkgroups(1,1,1),le.end();let Y=t.beginComputePass({label:`${a}GroupedGpuCountRadixUnique`}),ue=e=>Number.isSafeInteger(e)&&e>0&&e<=w?e:null,de=ue(Math.ceil(y/256)),fe=0,X=0,Z=(e,t,n,r=null)=>{if(Y.setPipeline(e),Y.setBindGroup(0,t),r!=null){Y.dispatchWorkgroups(r,1,1),fe+=1;return}if(X+=1,typeof Y.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`GPU-authored count radix encoding requires dispatchWorkgroupsIndirect`);Y.dispatchWorkgroupsIndirect(I,n)},pe=e=>{for(let t of e.levels){let n=ue(Math.ceil(t.maximumElementCount/512));if(t.level===e.fusedTopLevelIndex){Z(F.scanFusedTopAdd,t.fusedTopAddBindGroup,t.blockDispatchOffsetBytes,n);continue}Z(F.scanBlocks,t.blockBindGroup,t.blockDispatchOffsetBytes,n)}for(let t=e.levels.length-2;t>=0;--t){if(t===e.fusedTopLevelIndex-1)continue;let n=e.levels[t];Z(F.scanAdd,n.addBindGroup,n.addDispatchOffsetBytes)}};Z(F.initialize,x,K.radixDispatchOffsetBytes,de);for(let e of re)Z(F.histogram,e.histogramBindGroup,K.radixDispatchOffsetBytes,de),pe(ee),Z(F.scatter,e.scatterBindGroup,K.radixDispatchOffsetBytes,de);Z(F.markHeads,ie,K.radixDispatchOffsetBytes,de),pe(V),Z(F.scatterUnique,ae,K.radixDispatchOffsetBytes,de),Y.setPipeline(F.finalizeUnique),Y.setBindGroup(0,oe),Y.dispatchWorkgroups(1,1,1),Y.end(),ce&&J.endEncoderSpan(t,ce);let me=re.length,ge=fe+X;return he({schema:n,countAuthoritySchema:r,status:`webgpu-stable-radix-sort-unique-gpu-count-encoded`,elementCount:null,elementCountSource:`authenticated-gpu-authority`,maxElementCount:y,runtimeMaxElementCount:d,generationId:M,generationSeal:k,authorityBuffer:p,authorityCountByteOffset:D,authoritySealByteOffset:j,keyWordCount:b,keyStrideWords:C,radixPassCount:me,significantDigitRows:Object.freeze([...W]),sortedIndicesBuffer:q,uniqueHeadFlagsBuffer:m,uniqueGroupIndexBySortedPositionBuffer:h,uniqueKeysBuffer:g,uniqueOffsetsBuffer:T,uniqueEvidenceBuffer:A,uniqueDispatchIndirectBuffer:N,uniqueKeyCapacity:d,uniqueOffsetCapacity:d+1,gpuCountControlBuffer:I,gpuCountControlLayout:K,histogramScanMode:ee.fusedTopAddEnabled?`gpu-count-fixed-hierarchical-fused-top`:`gpu-count-fixed-hierarchical`,histogramScanFusedTopAddEnabled:ee.fusedTopAddEnabled,headScanFusedTopAddEnabled:V.fusedTopAddEnabled,histogramScanEncodedDispatchCount:ee.encodedDispatchCount,headScanEncodedDispatchCount:V.encodedDispatchCount,encodedDispatchCount:ge+2,encodedIndirectDispatchCount:X,encodedDirectDispatchCount:fe+2,encodedComputePassCount:2,fixedMaximumTopology:!0,timestampProducerId:se,executionConcurrency:`single-flight-per-runtime`,inactiveDispatchPolicy:`gpu-count-element-guarded-ceiling-with-indirect-parent-adds`,paramsBufferCreationCount:0,gpuBufferCreationCountDuringEncode:0,bindGroupCreationCount:U.created,bindGroupReuseCount:U.reused,paramsWriteCount:1,paramsSlotIndex:H.slot.slotIndex,paramsBufferResidency:`retained-gpu-count-config-arena`,clearedWordCount:_,gpuCountControlClearedWordCount:K.controlWordCount,readbackPerformed:!1,transientBuffers:[]},H,{ownedTransientBuffers:[]})}catch(e){throw H.release(),e}}let Ce=new WeakSet;function we(e){return Object.freeze({ownedTransientBuffers:fe.get(e)??Object.freeze([]),childPreparedScans:X.get(e)??Object.freeze([])})}function Te(e,t=null){if(!e||!de.has(e))return!1;let n=t??we(e);for(let{internals:e,prepared:t}of n.childPreparedScans)e.finalizePreparedFromParent(t);let r=[];for(let e of n.ownedTransientBuffers)J.delete(e)&&r.push(e);return I(r),fe.delete(e),X.delete(e),!0}function Ee(e){if(!e||typeof e!=`object`||e.schema!==`peercompute.ulg.webgpu-radix-unique.v0`)throw TypeError(`releaseExecution requires a radix/scan/unique execution result`);if(!de.has(e)){let e=Error(`${a} cannot release an execution owned by another runtime`);throw e.code=`ERR_WEBGPU_RADIX_FOREIGN_EXECUTION`,e}}function De(e,t=null){return Ee(e),Ce.has(e)?!1:(Te(e,t),Y.get(e)?.release?.(),Y.delete(e),Ce.add(e),!0)}function $(e,{discardedEncoder:t=!1}={}){if(t!==!0)throw TypeError(`${a} releaseExecution is only for a discarded encoder; use releaseExecutionAfter with a submission-fence thenable after submission`);return De(e)}function Oe(e){return De(e)}function ke(e){return!!(e&&typeof e==`object`&&e.schema===`peercompute.ulg.webgpu-radix-unique.v0`&&de.has(e)&&!Ce.has(e))}async function Ae(e,t){if(Ee(e),Ce.has(e))return!1;let n=we(e);return await C(t,`releaseExecutionAfter requires a submission-fence thenable`),De(e,n)}let je={schema:n,status:`webgpu-stable-radix-scan-unique-ready`,get pipelineCount(){return Object.keys(t).length+ie.pipelineCount+ae.pipelineCount},get gpuCountPipelineCount(){return Z?Object.keys(Z.pipelines).length:0},get totalPipelineCount(){return Object.keys(t).length+ie.pipelineCount+ae.pipelineCount+(Z?Object.keys(Z.pipelines).length:0)},maxElementCount:d,maxKeyWordCount:f,gpuCountControlLayout:K,serialHistogramScanMaxElementCount:p,retainedParamsSlotCount:R,variableRetainedScanCounts:M&&c===!0,paramsOffsetAlignment:z,radixParamsSlotStrideBytes:M?U:0,uniqueParamsSlotStrideBytes:M?te:0,prepareGpuCountResources(){let e=me();return Object.freeze({status:`webgpu-radix-gpu-count-resources-prepared`,pipelineCount:Object.keys(e.pipelines).length,configSlotCount:e.configSlotCount,executionConcurrency:`single-flight-per-runtime`,gpuBufferCreationCountDuringEncode:0,controlBuffer:e.controlBuffer,controlLayout:K})},encodeSort(e,t={}){if(!M||Number(t.elementCount)===0)return ye(e,t);let n=ge(t.retainedParamsSlotIndex);try{return ye(e,t,n)}catch(e){throw n.release(),e}},encodeUnique(e,t={}){if(!M)return xe(e,t);let n=ge(t.retainedParamsSlotIndex);try{return xe(e,t,n)}catch(e){throw n.release(),e}},encodeSortUnique(e,t={}){let n=M?ge(t.retainedParamsSlotIndex):null,r=null,i=null;try{let a=t.gpuTimestampRecorder??null,o=typeof t.sortTimestampProducerId==`string`&&t.sortTimestampProducerId.trim()?t.sortTimestampProducerId.trim():`webgpu-stable-radix-sort`,s=typeof t.uniqueTimestampProducerId==`string`&&t.uniqueTimestampProducerId.trim()?t.uniqueTimestampProducerId.trim():`webgpu-sorted-unique`,c=a?.active===!0&&typeof a.beginEncoderSpan==`function`?a.beginEncoderSpan(e,{producerId:o,stage:`sort`,spanClass:`same-grouped-production-compute-pass`,...t.timestampMetadata||{},elementCount:Number(t.elementCount)||0,keyWordCount:Number(t.keyWordCount)||0}):null;r=ye(e,t,n),c&&a.endEncoderSpan(e,c);let l=a?.active===!0&&typeof a.beginEncoderSpan==`function`?a.beginEncoderSpan(e,{producerId:s,stage:`unique`,spanClass:`same-grouped-production-compute-pass`,...t.timestampMetadata||{},elementCount:Number(t.elementCount)||0,keyWordCount:Number(t.keyWordCount)||0}):null;i=xe(e,{...t,sortedIndicesBuffer:r.sortedIndicesBuffer},n),l&&a.endEncoderSpan(e,l);let u=[...fe.get(r)??[],...fe.get(i)??[]],d=[...X.get(r)??[],...X.get(i)??[]];return he({...i,status:`webgpu-stable-radix-sort-unique-csr-encoded`,radixPassCount:r.passCount??0,histogramElementCount:r.histogramElementCount??0,histogramScanMode:r.histogramScanMode??`none`,encodedDispatchCount:(r.encodedDispatchCount??0)+(i.encodedDispatchCount??0),encodedComputePassCount:(r.encodedComputePassCount??0)+(i.encodedComputePassCount??0),bindGroupCreationCount:(r.bindGroupCreationCount??0)+(i.bindGroupCreationCount??0),bindGroupReuseCount:(r.bindGroupReuseCount??0)+(i.bindGroupReuseCount??0),paramsBufferCreationCount:(r.paramsBufferCreationCount??0)+(i.paramsBufferCreationCount??0),paramsWriteCount:(r.paramsWriteCount??0)+(i.paramsWriteCount??0),clearedWordCount:i.clearedWordCount??0,transientBuffers:[...u]},n,{ownedTransientBuffers:u,childPreparedScans:d})}catch(e){throw Te(r),Te(i),n?.release(),e}},encodeSortUniqueGpuCount:Se,releaseExecution:$,canReleaseExecutionQueueOrdered:ke,releaseExecutionQueueOrdered:Oe,releaseExecutionAfter:Ae,allocationEntries(){return[{role:`radix-sorted-indices-a`,buffer:i},{role:`radix-sorted-indices-b`,buffer:o},{role:`radix-histograms`,buffer:l},{role:`radix-histogram-offsets`,buffer:u},{role:`unique-head-flags`,buffer:m},{role:`unique-head-offsets`,buffer:h},{role:`unique-keys`,buffer:g},{role:`unique-offsets`,buffer:T},{role:`unique-evidence`,buffer:A},{role:`unique-dispatch-indirect`,buffer:N},...P?[{role:`radix-params-retained-arena`,buffer:P}]:[],...G?[{role:`unique-params-retained-arena`,buffer:G}]:[],...Z?.allocationEntries??[],...ie.allocationEntries(),...ae.allocationEntries(),...[...J].map(e=>({role:`radix-unique-params-transient`,buffer:e}))]},destroy(){if(!pe){pe=!0,I([i,o,l,u,m,h,g,T,A,N,P,G]),ie.destroy(),ae.destroy(),Z?.destroy(),Z=null,I([...J]),J.clear();for(let e of le)e.inUse=!1,e.bindGroups.clear()}}};return q.commit(),je}catch(e){throw q.rollback(),e}}const fe=new WeakMap,X=m.wordCount,Z=1+2*X,pe=Object.freeze({schema:`peercompute.ulg.reaction-residual-ledger.v1`,format:m,headerWords:16,eventWords:32,massOffset:32,energyOffset:32+X,sourceOffset:32+2*X,rowWords:32+3*X}),me=pe;function he(e,t){let n=fe.get(e);if(!n||n.device!==t||!n.committed||n.closed||n.retired)throw TypeError(`Residual ledger requires its original live reaction producer`);return n}function ge(e,{device:t}={}){let n=he(e,t);n.readers++;let r=!0;return Object.freeze({record:e,buffer:e.buffer,layout:me,validate(){if(!r||n.retired)throw TypeError(`Residual ledger read is retired`);return!0},release(){return r?(r=!1,n.readers--,n.retire(),!0):!1}})}const Q=`
${f(m)}
${p(m)}
@group(0) @binding(0) var<storage,read> scratch:array<u32>;
@group(0) @binding(1) var<storage,read> events:array<u32>;
@group(0) @binding(2) var<storage,read> plans:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read_write> carrier_energy:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> history:array<atomic<u32>>;
struct Params { particles:u32, capacity:u32, generation:u32, pad:u32 };
@group(0) @binding(5) var<uniform> cfg:Params;
const HEADER:u32=${me.headerWords}u;
const STRIDE:u32=${me.rowWords}u;
fn fail(bits:u32) {
  atomicOr(&history[5],bits);
  atomicOr(&carrier_energy[2u*cfg.particles*EM_WORDS],1024u);
}
fn finite(v:f32)->bool {return (bitcast<u32>(v)&0x7f800000u)!=0x7f800000u;}
@compute @workgroup_size(1) fn initialize() {
  atomicStore(&history[0],0x52484c31u);
  atomicStore(&history[1],1u);
  atomicStore(&history[2],cfg.capacity);
  atomicStore(&history[3],select(0u,min(scratch[2],cfg.capacity),scratch[1]==1u));
  atomicStore(&history[6],scratch[1]);
  atomicStore(&history[7],cfg.generation);
  if(scratch[2]>cfg.capacity) {fail(1u);}
}
@compute @workgroup_size(64) fn retain_residual(@builtin(global_invocation_id) id:vec3<u32>) {
  let event=id.x;
  if(scratch[1]!=1u || event>=min(scratch[2],cfg.capacity)) {return;}
  if(plans[event*2u+1u].x!=6.0) {return;}
  let packet=8u+cfg.particles+event*${Z}u;
  if(scratch[packet]!=1u) {fail(2u);return;}
  var mass=ExactMass();var arrived=ExactMass();
  for(var w=0u;w<EM_WORDS;w++) {
    mass.words[w]=scratch[packet+1u+w];
    arrived.words[w]=scratch[packet+1u+EM_WORDS+w];
  }
  let projection=em_project_f32_bits(mass);
  let m=bitcast<f32>(projection.bits);
  let event_at=event*32u;
  let u=bitcast<f32>(events[event_at+19u]);
  let density=bitcast<f32>(events[event_at+17u]);
  let molar_mass=bitcast<f32>(events[event_at+15u]);
  if(projection.error!=0u || !(m>0.0) || !finite(m) || !finite(u)
    || !(density>0.0) || !finite(density) || !(molar_mass>0.0) || !finite(molar_mass)) {
    fail(4u);return;
  }
  // The same declared heat-proxy law as the carrier reconcile: U follows the
  // f32 product u, and S records exactly the difference from incoming energy.
  let energy=el_from_f32_bits(bitcast<u32>(m*u));
  let source=el_subtract(energy.value,arrived);
  let moles=m/molar_mass;let volume=m/density;
  if((energy.error|source.error)!=0u || !finite(moles) || !finite(volume)) {fail(4u);return;}
  let at=HEADER+event*STRIDE;
  for(var w=0u;w<32u;w++) {atomicStore(&history[at+w],events[event_at+w]);}
  atomicStore(&history[at+3u],projection.bits);
  atomicStore(&history[at+9u],bitcast<u32>(moles));
  atomicStore(&history[at+12u],0u);
  atomicStore(&history[at+13u],projection.bits);
  atomicStore(&history[at+23u],bitcast<u32>(volume));
  atomicStore(&history[at+31u],bitcast<u32>(6.0));
  for(var w=0u;w<EM_WORDS;w++) {
    atomicStore(&history[at+${me.massOffset}u+w],mass.words[w]);
    atomicStore(&history[at+${me.energyOffset}u+w],energy.value.words[w]);
    atomicStore(&history[at+${me.sourceOffset}u+w],source.value.words[w]);
  }
  atomicAdd(&history[4],1u);
}`;function _e({device:e,capacity:t,generation:n}){let r=(me.headerWords+Math.max(1,t)*me.rowWords)*4;if(!Number.isSafeInteger(t)||Object.is(t,-0)||t<0||t>4294967295||!Number.isSafeInteger(n)||Object.is(n,-0)||n<0||n>4294967295||r>e.limits.maxBufferSize||r>e.limits.maxStorageBufferBindingSize||Math.ceil(t/64)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Residual ledger exceeds its declared GPU capacity`);let i=null,a=null,o=new Set,s={device:e,committed:!1,closed:!1,retired:!1,retiring:!1,readers:0,retire(){if(!this.closed||this.readers||this.retired||this.retiring)return;this.retiring=!0;let e=[];for(let t of[i,a])if(!(!t||o.has(t)))try{t.destroy(),o.add(t)}catch(t){e.push(t)}if(this.retiring=!1,this.retired=e.length===0,e.length)throw AggregateError(e,`Residual ledger retirement failed`)}},f=()=>{let e=!s.closed;return s.closed=!0,s.retire(),e};try{i=u(e.createBuffer({label:`ulg-reaction-residual-ledger`,size:r,usage:140}),e);let o=i.destroy.bind(i);i.destroy=()=>{if(!s.retiring)throw TypeError(`Residual ledger is retained by its producer or readers`);o()},a=e.createBuffer({label:`ulg-reaction-residual-params`,size:16,usage:72});let p=Object.freeze({device:e,buffer:i,layout:me,capacity:t,generation:n,physicalPublicationAdmitted:!1});fe.set(p,s);let m=!1;return Object.freeze({destroy:f,encode(r,{scratch:o,events:u,eventPlan:f,energyOutput:p,particleCount:h}){if(m||s.closed)throw TypeError(`Residual ledger must be encoded once`);if(!Number.isSafeInteger(h)||h<1||h>4294967295||[o,u,f,p].some(t=>d(t)!==e)||u.size<t*128||f.size<t*32||o.size<(8+h+Math.max(1,t)*Z)*4||p.size<(2*h*X+4)*4)throw TypeError(`Residual ledger requires the complete original reaction buffers`);e.queue.writeBuffer(a,0,new Uint32Array([h,t,n,0]));for(let n of[`initialize`,`retain_residual`]){let s=l(e,{code:Q,entryPoint:n,label:`ulg-reaction-residual-${n}`,cacheKey:`ulg-reaction-residual-v1-${n}`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`].map((e,t)=>c(t,e))}),d=e.createBindGroup({layout:s.bindGroupLayout,entries:[o,u,f,p,i,a].map((e,t)=>({binding:t,resource:{buffer:e}}))}),m=r.beginComputePass();m.setPipeline(s.pipeline),m.setBindGroup(0,d),m.dispatchWorkgroups(n===`initialize`?1:Math.max(1,Math.ceil(t/64))),m.end()}m=!0},commit(){if(!m||s.closed||s.committed)throw TypeError(`Residual ledger requires one encoded producer`);return s.committed=!0,p}})}catch(e){throw f(),e}}const ve=new WeakMap;function ye(e,{device:t,source:n}={}){let r=ve.get(e);if(!r||r.device!==t||r.closed||r.retired||!r.finalized||e.sourceHistory!==n)throw TypeError(`Residual history requires its original finalized transport producer`);r.validate(),r.readers++;let i=!0;return Object.freeze({record:e,validate(){if(!i||r.retired)throw TypeError(`Residual transport read is retired`);return r.validate(),!0},forkSourceRead(){return this.validate(),je(r.historyRead,{device:t})},forkCarrierRead(){return this.validate(),r.forkCarrierRead()},release(){return i&&(i=!1,r.readers--),r.retire()}})}var be=e({SPH_REACTION_RESIDUAL_HISTORY_ERROR:()=>Oe,SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:()=>De,SPH_REACTION_RESIDUAL_HISTORY_TRANSPORT_REQUIRED:()=>ke,borrowSphReactionResidualHistory:()=>Ae,forkSphReactionResidualHistoryRead:()=>je,prepareSphReactionResidualHistory:()=>Fe,validateSphReactionResidualHistoryCandidate:()=>Ne});const xe=new WeakMap,Se=new WeakMap,Ce=new WeakMap;let we=1;const Te=Math.ceil(pe.rowWords/4)*4,Ee=Te+52,De=Object.freeze({...pe,schema:`peercompute.ulg.reaction-residual-history.v2`,version:2,headerWords:64,physicalOffset:Te,stateOffset:Te,thermoOffset:Te+8,mechanicsOffset:Te+20,rowWords:Ee,rowBytes:Ee*4}),$=De,Oe=1048576,ke=2097152;function Ae(e,{device:t}={}){let n=Se.get(e);if(!n||n.device!==t||!n.privateLive||n.retired)throw TypeError(`Residual history requires its original live private owner`);return Me(e,n)}function je(e,{device:t}={}){let n=Ce.get(e);if(!n||n.device!==t)throw TypeError(`Residual history fork requires its original retained read`);return e.validate(),Me(e.history,n)}function Me(e,t){t.readers++;let n=!0,r=Object.freeze({history:e,buffer:e.buffer,transportRecord:t.emittedRead?null:t.transportRead?.record??null,controlBuffer:t.controlBuffer,validate(){if(!n||t.retired)throw TypeError(`Residual history read is retired`);return!0},release(){return n?(n=!1,t.readers--,t.retire(),!0):(t.retire(),!1)}});return Ce.set(r,t),r}function Ne(e,t){let n=xe.get(e);if(!n||n.device!==t||n.closed||n.retired)throw TypeError(`Residual history requires its genuine retained producer`);return n.sourceRead?.validate(),n.emittedRead?.validate(),n.transportRead?.validate(),!0}const Pe=`
${f($.format)}
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> emitted:array<u32>;
@group(0) @binding(2) var<storage,read_write> flags:array<u32>;
@group(0) @binding(3) var<storage,read> prefix:array<u32>;
@group(0) @binding(4) var<storage,read_write> output:array<u32>;
@group(0) @binding(5) var<storage,read_write> control:array<atomic<u32>>;
struct Params { shape:vec4<u32>, identity:vec4<u32>, emission:vec4<u32> };
@group(0) @binding(6) var<uniform> cfg:Params;
@group(0) @binding(7) var<storage,read> transported:array<u32>;
@group(0) @binding(8) var<storage,read> transport_control:array<u32>;
const HEAD:u32=${$.headerWords}u;
const ROW:u32=${$.rowWords}u;
const EMIT_HEAD:u32=${pe.headerWords}u;
const EMIT_ROW:u32=${pe.rowWords}u;
const MAGIC:u32=0x50484731u;
fn fail(){atomicOr(&control[2],${Oe}u);}
fn source_count()->u32 {
  if(cfg.shape.w==0u){return 0u;}
  return min(source[3],cfg.shape.y);
}
fn emitted_slots()->u32 {
  if(cfg.emission.y==0u){return 0u;}
  return min(emitted[3],cfg.shape.z);
}
fn count_valid(count:u32,capacity:u32,stride:u32,generation:u32,seal:u32,kind:u32)->bool {
  if(kind==0u) {
    return source[0]==MAGIC && source[1]==${$.version}u && source[2]==1u && count<=capacity
      && source[4]==capacity && source[5]==stride && source[6]==generation && source[7]==seal
      && source[8]==(count+63u)/64u && source[9]==1u && source[10]==1u && source[11]==0u;
  }
  return output[0]==MAGIC && output[1]==${$.version}u && output[2]==1u && count<=capacity
    && output[4]==capacity && output[5]==stride && output[6]==generation && output[7]==seal
    && output[8]==(count+63u)/64u && output[9]==1u && output[10]==1u && output[11]==0u;
}
fn write_count(count:u32) {
  output[0]=MAGIC;output[1]=${$.version}u;output[2]=1u;output[3]=count;
  output[4]=cfg.shape.x;output[5]=ROW/4u;output[6]=cfg.identity.z;output[7]=cfg.identity.w;
  output[8]=(count+63u)/64u;output[9]=1u;output[10]=1u;output[11]=0u;
}
fn row_word(kind:u32,row:u32,word:u32)->u32 {
  if(kind==0u){return source[HEAD+row*ROW+word];}
  if(word>=EMIT_ROW){return 0u;}
  return emitted[EMIT_HEAD+row*EMIT_ROW+word];
}
fn prior_word(row:u32,word:u32)->u32 {
  if(cfg.emission.w!=0u){return transported[HEAD+row*ROW+word];}
  return source[HEAD+row*ROW+word];
}
fn row_mass(kind:u32,row:u32)->ExactMass {
  var m=ExactMass();for(var w=0u;w<EM_WORDS;w++){m.words[w]=row_word(kind,row,${$.massOffset}u+w);}return m;
}
// The original product-event producer already resolved the material/phase
// constitutive law. Initialize the ordinary 8/12/32-word particle ABI once;
// subsequent histories copy its evolving F/APIC state without resetting it.
// These are physical f32 views of the declared heat-proxy route. M/U/S remain
// the independent integer authority and are never reconstructed from this view.
fn initial_physical(row:u32)->array<u32,52> {
  var p:array<u32,52>;
  for(var axis=0u;axis<3u;axis++) {
    p[axis]=row_word(1u,row,axis);p[4u+axis]=row_word(1u,row,20u+axis);
  }
  p[3]=row_word(1u,row,3u);p[7]=row_word(1u,row,19u);
  p[8]=row_word(1u,row,4u);p[9]=row_word(1u,row,11u);
  p[10]=row_word(1u,row,16u);p[11]=row_word(1u,row,17u);
  let phase=bitcast<f32>(p[9]);
  for(var i=0u;i<4u;i++){p[12u+i]=select(0u,0x3f800000u,phase==f32(i+1u));}
  let volume=bitcast<f32>(row_word(1u,row,23u));
  let radius=pow(volume*0.238732414637843,1.0/3.0);
  p[16]=bitcast<u32>(radius);p[19]=p[16];
  // WebGPU need not produce IEEE infinity on overflow. Bound this physical
  // projection before multiplication, instead of relying on a post-hoc NaN
  // or infinity test to catch an unrepresentable entity count.
  let moles=bitcast<f32>(row_word(1u,row,9u));
  if(moles>0.0 && moles<=3.402823e38/6.02214076e23){p[17]=bitcast<u32>(moles*6.02214076e23);}
  p[18]=row_word(1u,row,18u);
  p[20]=0x3f800000u;p[24]=0x3f800000u;p[28]=0x3f800000u;p[38]=0x3f800000u;
  p[39]=row_word(1u,row,23u);p[40]=row_word(1u,row,29u);p[41]=row_word(1u,row,30u);
  for(var i=0u;i<5u;i++){p[42u+i]=row_word(1u,row,24u+i);}
  p[47]=p[41];p[51]=p[3];return p;
}
fn physical_valid(p:array<u32,52>,mass_bits:u32)->bool {
  for(var i=0u;i<52u;i++){if((p[i]&0x7f800000u)==0x7f800000u){return false;}}
  let phase=bitcast<f32>(p[9]);
  return p[3]==mass_bits && bitcast<f32>(p[8])>=0.0 && floor(bitcast<f32>(p[8]))==bitcast<f32>(p[8])
    && phase>=1.0 && phase<=4.0 && floor(phase)==phase
    && bitcast<f32>(p[10])>0.0 && bitcast<f32>(p[11])>0.0
    && bitcast<f32>(p[16])>0.0 && bitcast<f32>(p[17])>0.0 && p[18]==0x3f800000u
    && bitcast<f32>(p[19])>0.0 && bitcast<f32>(p[38])>0.0 && bitcast<f32>(p[39])>0.0
    && (p[40]==0u || p[40]==0x3f800000u) && p[41]==0x3f800000u && p[47]==0x3f800000u
    && bitcast<f32>(p[42])>=0.0 && bitcast<f32>(p[43])>=0.0 && bitcast<f32>(p[45])>=0.0
    && bitcast<f32>(p[51])>0.0;
}
fn populated_valid(kind:u32,row:u32,m:ExactMass)->bool {
  let projected=em_project_f32_bits(m);
  var physical:array<u32,52>;
  if(kind==0u){for(var i=0u;i<52u;i++){physical[i]=row_word(0u,row,${$.physicalOffset}u+i);}}
  else{physical=initial_physical(row);}
  return physical_valid(physical,projected.bits) && !em_zero(m) && projected.error==0u && projected.bits!=0u
    && row_word(kind,row,3u)==projected.bits && row_word(kind,row,13u)==projected.bits
    && row_word(kind,row,12u)==0u && bitcast<f32>(row_word(kind,row,31u))==6.0;
}
@compute @workgroup_size(1) fn initialize() {
  write_count(0u);
  if(cfg.shape.w!=0u && !count_valid(source[3],cfg.shape.y,ROW/4u,cfg.identity.x,cfg.identity.y,0u)){fail();}
  if(cfg.emission.w!=0u){
    atomicOr(&control[2],transport_control[2]);
    if(transport_control[0]!=0x52545031u || transport_control[1]!=1u || transport_control[3]!=3u
      || transport_control[5]!=cfg.shape.y || transport_control[6]!=source[3]
      || transport_control[7]!=cfg.identity.x || transport_control[8]!=cfg.identity.y){fail();}
    for(var w=0u;w<HEAD;w++){if(transported[w]!=source[w]){fail();}}
  }
  if(cfg.emission.y!=0u && (emitted[0]!=0x52484c31u || emitted[1]!=1u || emitted[2]!=cfg.shape.z
    || emitted[3]>cfg.shape.z || emitted[4]>emitted[3] || emitted[5]!=0u || emitted[7]!=cfg.emission.x
    || (emitted[6]!=1u && emitted[6]!=2u) || (emitted[6]!=1u && (emitted[3]!=0u || emitted[4]!=0u)))){fail();}
}
@compute @workgroup_size(64) fn mark_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row<cfg.emission.z) {
    flags[row]=0u;
    if(row<cfg.shape.z && cfg.emission.y!=0u) {
      let m=row_mass(1u,row);
      if(!em_zero(m)) {
        if(row>=emitted_slots() || !populated_valid(1u,row,m)){fail();}
        else {flags[row]=1u;}
      } else {
        for(var w=0u;w<ROW;w++){if(row_word(1u,row,w)!=0u){fail();}}
      }
    }
  }
  if(row<source_count() && !populated_valid(0u,row,row_mass(0u,row))){fail();}
}
@compute @workgroup_size(1) fn decide() {
  let last=cfg.emission.z-1u;
  let appended=prefix[last]+flags[last];
  if(cfg.emission.y!=0u && appended!=emitted[4]){fail();}
  let total=source_count()+appended;
  if(total>cfg.shape.x){fail();}
  if(atomicLoad(&control[2])==0u){write_count(total);}else{write_count(source_count());}
}
@compute @workgroup_size(64) fn scatter(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;let prior=source_count();
  if(row<prior){for(var w=0u;w<ROW;w++){output[HEAD+row*ROW+w]=prior_word(row,w);}}
  if(atomicLoad(&control[2])==0u && row<cfg.emission.z && flags[row]!=0u) {
    let dest=prior+prefix[row];
    for(var w=0u;w<${$.physicalOffset}u;w++){output[HEAD+dest*ROW+w]=row_word(1u,row,w);}
    let physical=initial_physical(row);
    for(var w=0u;w<52u;w++){output[HEAD+dest*ROW+${$.physicalOffset}u+w]=physical[w];}
  }
}
@compute @workgroup_size(64) fn check(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(row==0u && !count_valid(output[3],cfg.shape.x,ROW/4u,cfg.identity.z,cfg.identity.w,1u)){fail();}
  if(atomicLoad(&control[2])!=0u){return;}
  let prior=source_count();
  // Header shape alone cannot detect a lost or invented row within the same
  // dispatch group. Bind the live count to the original prefix and scan sum.
  if(row==0u && output[3]!=prior+prefix[cfg.emission.z-1u]+flags[cfg.emission.z-1u]){fail();}
  if(row<prior){for(var w=0u;w<ROW;w++){if(output[HEAD+row*ROW+w]!=prior_word(row,w)){fail();}}}
  if(row<cfg.emission.z && flags[row]!=0u) {
    let dest=prior+prefix[row];
    if(dest>=min(output[3],cfg.shape.x)){fail();return;}
    for(var w=0u;w<${$.physicalOffset}u;w++){if(output[HEAD+dest*ROW+w]!=row_word(1u,row,w)){fail();}}
    let physical=initial_physical(row);
    for(var w=0u;w<52u;w++){if(output[HEAD+dest*ROW+${$.physicalOffset}u+w]!=physical[w]){fail();}}
  }
}
// This gate stays in the actual chain until native P2G/G2P consumes history.
@compute @workgroup_size(1) fn require_empty() {
  if(source_count()!=0u || output[3]!=0u){atomicOr(&control[2],${ke}u);}
}
@compute @workgroup_size(64) fn restore_rows(@builtin(global_invocation_id) id:vec3<u32>) {
  let row=id.x;
  if(atomicLoad(&control[2])==0u || row>=cfg.shape.x){return;}
  for(var w=0u;w<ROW;w++) {
    var value=0u;if(row<source_count()){value=source[HEAD+row*ROW+w];}
    output[HEAD+row*ROW+w]=value;
  }
}
@compute @workgroup_size(1) fn restore_count() {
  if(atomicLoad(&control[2])!=0u){write_count(source_count());}
}`;function Fe({device:e,source:t=null,emitted:n=null,transported:r=null,capacity:i=null,controlBuffer:a}){if(r&&!t)throw TypeError(`Residual transport requires its original history`);if(!t&&!n)return null;let o=null,s=null,f=null,p=null,m=null,h=new Set,g=new Set,_={device:e,closed:!1,privateLive:!1,retired:!1,retiring:!1,readers:0,sourceRead:null,emittedRead:null,transportRead:null,controlBuffer:null,retire(){if(!this.closed||this.privateLive||this.readers||this.retired||this.retiring)return;this.retiring=!0;let e=[];for(let t of h)if(!g.has(t))try{t.destroy(),g.add(t)}catch(t){e.push(t)}if(this.retiring=!1,e.length)throw AggregateError(e,`Residual history retirement failed`);p?.destroy(),o?.release(),s?.release(),f?.release(),this.retired=!0}},v=()=>{let e=!_.closed;return _.closed=!0,_.retire(),e},y=e=>{h.add(e);let t=e.destroy.bind(e);return e.destroy=()=>{if(!g.has(e)){if(!_.retiring)throw TypeError(`Residual history storage is retained`);t(),g.add(e)}},e},b=(t,n,r)=>y(u(e.createBuffer({label:t,size:n,usage:r}),e));try{f=r?ye(r,{device:e,source:t}):null,o=f?f.forkSourceRead():t?Ae(t,{device:e}):null,s=n?ge(n,{device:e}):null,_.sourceRead=o,_.emittedRead=s,_.transportRead=f;let u=Math.floor((Math.min(e.limits.maxBufferSize,e.limits.maxStorageBufferBindingSize)-$.headerWords*4)/$.rowBytes),h=i??t?.capacity??Math.min(u,Math.max(64,(n?.capacity??0)*8)),g=n?.capacity??0,x=Math.max(1,g),S=(t?.generation??0)+1,C=we++;if(!Number.isSafeInteger(h)||h<1||h>u||h<(t?.capacity??0)||S>4294967295||!Number.isSafeInteger(C)||C>4294967295||Math.ceil(Math.max(h,t?.capacity??0,x)/64)>e.limits.maxComputeWorkgroupsPerDimension||d(a)!==e||a.size<12||!(a.usage&128))throw RangeError(`Residual history requires bounded same-device storage and count identities`);m=b(`ulg-reaction-residual-history`,($.headerWords+h*$.rowWords)*4,140),f&&(_.controlBuffer=b(`ulg-reaction-residual-history-verdict`,12,140));let w=b(`ulg-reaction-residual-live-flags`,x*4,140),T=b(`ulg-reaction-residual-live-prefix`,x*4,140),E=b(`ulg-reaction-residual-history-identities`,48,72);e.queue.writeBuffer(E,0,new Uint32Array([h,t?.capacity??0,g,+!!t,t?.generation??0,t?.seal??0,S,C,n?.generation??0,+!!n,x,+!!f])),p=se(e,{maxElementCount:x,retainParamsBuffer:!0,fixedElementCount:x,label:`ulg-reaction-residual-history-scan`});for(let{buffer:e}of p.allocationEntries())y(e);let D=Object.freeze({device:e,buffer:m,layout:$,capacity:h,generation:S,seal:C,beforeBuffer:o?.buffer??null,beforeCapacity:t?.capacity??0,beforeGeneration:t?.generation??0,beforeSeal:t?.seal??0,physicalPublicationAdmitted:!1});xe.set(D,_);let O=[`read-only-storage`,`read-only-storage`,`storage`,`read-only-storage`,`storage`,`storage`,`uniform`,`read-only-storage`,`read-only-storage`],k=o?.buffer??s.buffer,A=[k,s?.buffer??o.buffer,w,T,m,a,E,r?.buffer??k,r?.controlBuffer??k],j=Object.fromEntries([`initialize`,`mark_rows`,`decide`,`scatter`,`check`,`require_empty`,`restore_rows`,`restore_count`].map(t=>{let n=l(e,{code:Pe,entryPoint:t,label:`ulg-residual-history-${t}`,cacheKey:`ulg-residual-history-v${$.version}-${t}`,bindings:O.map((e,t)=>c(t,e))}),r=e.createBindGroup({layout:n.bindGroupLayout,entries:A.map((e,t)=>({binding:t,resource:{buffer:e}}))});return[t,(e,t)=>{let i=e.beginComputePass();i.setPipeline(n.pipeline),i.setBindGroup(0,r),i.dispatchWorkgroups(t),i.end()}]})),M=Math.ceil(Math.max(t?.capacity??0,x)/64),N=!1,P=!1,F=!1,I=()=>Ne(D,e),L=()=>{if(I(),!N)throw TypeError(`Residual history was not encoded`)};return Object.freeze({record:D,destroy:v,encode(e){if(I(),N)throw TypeError(`Residual history must be encoded once`);j.initialize(e,1),j.mark_rows(e,M);let t=p.encode(e,{inputBuffer:w,outputBuffer:T,elementCount:x});p.releasePreparedQueueOrdered(t),j.decide(e,1),j.scatter(e,M),N=!0},check(e){L(),j.check(e,M)},requireEmptyForMechanics(e){L(),j.require_empty(e,1)},restore(e){if(L(),P)throw TypeError(`Residual history was already finalized`);j.restore_rows(e,Math.ceil(h/64)),j.restore_count(e,1),_.controlBuffer&&e.copyBufferToBuffer(a,0,_.controlBuffer,0,12),P=!0},transfer(){if(L(),!P||F)throw TypeError(`Residual history requires one finalized handover`);F=!0,_.privateLive=!0;let t=Object.freeze({device:e,buffer:m,layout:$,capacity:h,generation:S,seal:C});return Se.set(t,_),Object.freeze({history:t,destroy(){let e=_.privateLive;return _.privateLive=!1,_.retire(),e}})}})}catch(e){throw v(),e}}export{be as a,_e as c,Fe as i,de as l,De as n,Ne as o,Ae as r,Z as s,Oe as t,se as u};