import{t as e}from"./rolldown-runtime-DK3Fl9T5.js";import{_ as t,i as n,n as r,o as i,s as a,v as o,y as s}from"./parallelPrimitives-DxfC9lV2.js";import{c,n as l,o as u,s as d,v as f}from"./webgpuComputeLayout-DmbtaDDe.js";import{i as p,o as m}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{t as h}from"./sphExactMassWgsl-ChqpSzqB.js";import{_ as g,n as _}from"./sphExactThermalEnergyWgsl-B62SGKhp.js";const v=1024,y=256*16*Uint32Array.BYTES_PER_ELEMENT,b=s.length+a.length+1,x=Uint32Array.BYTES_PER_ELEMENT,S=new WeakMap,C={COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,INDIRECT:globalThis.GPUBufferUsage?.INDIRECT??256,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64};function w(e,t,{max:n=2**53-1}={}){let r=Number(e);if(!Number.isInteger(r)||r<1||r>n)throw RangeError(`${t} must be an integer in [1, ${n}]`);return r}function T(e,t,{max:n=2**53-1}={}){let r=Number(e);if(!Number.isInteger(r)||r<0||r>n)throw RangeError(`${t} must be an integer in [0, ${n}]`);return r}function E(e,t){let n;try{n=e?.then}catch(e){throw e}if(typeof n!=`function`)throw TypeError(t);return new Promise((t,r)=>{try{Reflect.apply(n,e,[t,r])}catch(e){r(e)}})}function D(e,t=4){return Math.max(4,Math.ceil(e/t)*t)}function O(e){let t=w(e?.limits?.minUniformBufferOffsetAlignment??256,`device.limits.minUniformBufferOffsetAlignment`,{max:4294967295});return Math.max(256,t)}function k(e,t){return e?.length===t?.length&&e.every((e,n)=>Object.is(e,t[n]))}function A(e,t){return[e,...t.flatMap(e=>[e.binding,e.resource?.buffer,e.resource?.offset??0,e.resource?.size??null])]}function j(e){return Math.ceil(e/512)}function M(e){return Math.ceil(e/256)}function N(e){let t=w(e,`scan maximum element count`,{max:4294967295}),n=0;for(;t>0;){n+=1;let e=j(t);if(e<=1)break;t=e}return n}function ee(e,t=65535){let n=w(t,`maxComputeWorkgroupsPerDimension`,{max:4294967295}),r=Math.min(e,n),i=Math.ceil(e/r);if(i>n)throw RangeError(`workgroup count ${e} exceeds 2D dispatch capacity ${n}x${n}`);return[r,i,1]}const P=Object.freeze({MAGIC:0,ABI_VERSION:1,STATUS_FLAGS:2,EXPECTED_GENERATION_SEAL:3,OBSERVED_GENERATION_SEAL:4,LIVE_ELEMENT_COUNT:5,MAXIMUM_ELEMENT_COUNT:6,OVERFLOW_COUNT:7,KEY_WORD_COUNT:8,KEY_STRIDE_WORDS:9,RADIX_WORKGROUP_COUNT:10,HISTOGRAM_ELEMENT_COUNT:11,CONSUMER_WORKGROUP_SIZE:12,GENERATION_ID:13,HISTOGRAM_SCAN_LEVEL_COUNT:14,HEAD_SCAN_LEVEL_COUNT:15,AUTHORITY_COUNT_OFFSET_WORDS:16,AUTHORITY_SEAL_OFFSET_WORDS:17,INDIRECT_ROW_COUNT:18,COMPLETION_GENERATION_SEAL:19,RADIX_DISPATCH_OFFSET_WORDS:20,HISTOGRAM_SCAN_COUNT_OFFSET_WORDS:21,HEAD_SCAN_COUNT_OFFSET_WORDS:22,HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS:23,HEAD_SCAN_DISPATCH_OFFSET_WORDS:24,CONTROL_WORD_COUNT:25,DISPATCH_X_LIMIT:26});function F({maxElementCount:e,maxComputeWorkgroupsPerDimension:n=65535}={}){let r=w(e,`maxElementCount`,{max:4294967295}),i=M(r),o=i*16;if(!Number.isSafeInteger(o)||o>4294967295)throw RangeError(`maximum radix histogram exceeds the u32-addressable range`);let s=N(o),c=N(r),l=t,u=l+s,d=u+c,f=d+a.length,p=f+s*2*a.length,m=p+c*2*a.length,h=1+s*2+c*2,g=o;ee(i,n);for(let e=0;e<s;e+=1){let e=j(g);ee(e,n),g=e}g=r;for(let e=0;e<c;e+=1){let e=j(g);ee(e,n),g=e}return Object.freeze({headerWordCount:t,histogramScanLevelCount:s,headScanLevelCount:c,histogramScanCountOffsetWords:l,headScanCountOffsetWords:u,radixDispatchOffsetWords:d,radixDispatchOffsetBytes:d*x,histogramScanDispatchOffsetWords:f,headScanDispatchOffsetWords:p,indirectRowCount:h,controlWordCount:m,controlByteLength:m*x,dispatchRowWordCount:a.length})}function I(e){if(!e?.createBuffer||!e?.createShaderModule||!e?.createComputePipeline||!e?.createBindGroup||!e?.queue?.writeBuffer)throw TypeError(`GPU radix/scan/unique requires a WebGPU-like device`)}function L(e,t,n,r=0){let i=D(w(n,`${t} wordCount`,{max:4294967295})*x),a=Number(e.limits?.maxBufferSize??1/0),o=Number(e.limits?.maxStorageBufferBindingSize??1/0);if(i>a)throw RangeError(`${t} byte length ${i} exceeds maxBufferSize ${a}`);if(i>o)throw RangeError(`${t} byte length ${i} exceeds maxStorageBufferBindingSize ${o}`);return e.createBuffer({label:t,size:i,usage:C.STORAGE|C.COPY_SRC|C.COPY_DST|r})}function R(e){let t=new Set;for(let n=e.length-1;n>=0;--n){let r=e[n];if(!(!r||t.has(r))){t.add(r);try{r.destroy?.()}catch{}}}}function z(){let e=[],t=[],n=!0;return{ownBuffer(t){return e.push(t),t},ownRuntime(e){return t.push(e),e},commit(){n=!1,e.length=0,t.length=0},rollback(){if(!n)return!1;n=!1;for(let e=t.length-1;e>=0;--e)try{t[e]?.destroy?.()}catch{}return R(e),e.length=0,t.length=0,!0}}}function B(e,t,n={}){return e?.beginComputePassDescriptor?e.beginComputePassDescriptor(t,n):{label:t}}function te(e){return!!(e?.beginComputePassDescriptor&&e.active!==!1)}function ne(e){if(!Array.isArray(e)&&!ArrayBuffer.isView(e))throw TypeError(`dispatch must be an array-like [x, y, z] value`);if(e.length<1||e.length>3)throw RangeError(`dispatch must contain between one and three dimensions`);let t=[0,1,2].map(t=>w(e[t]??1,`dispatch[${t}]`,{max:4294967295}));return`webgpu-dispatch:${t[0]}:${t[1]}:${t[2]}`}function re(e,t){if(!e)return null;if(!e.buffer)throw TypeError(`dispatchIndirectProvider.buffer is required`);if(typeof e.byteOffsetFor!=`function`)throw TypeError(`dispatchIndirectProvider.byteOffsetFor must be a function`);let n=ne(t),r=Number(e.byteOffsetFor(t,n));if(!Number.isInteger(r)||r<0||r%4!=0)throw RangeError(`indirect dispatch offset for ${n} must be an aligned byte offset`);return{buffer:e.buffer,byteOffset:r,shapeId:n}}function V(e,t,n,r,i=null){e.setPipeline(t),e.setBindGroup(0,n);let a=re(i,r);if(a){if(typeof e.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`indirect dispatch provider requires dispatchWorkgroupsIndirect support`);e.dispatchWorkgroupsIndirect(a.buffer,a.byteOffset)}else e.dispatchWorkgroups(...r)}function ie(e,t,n,r,i,a,o,s=null){let c=e.beginComputePass(B(t,n,r));V(c,i,a,o,s),c.end()}const H=`
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
`,U=`
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
`,ae=`
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
@group(0) @binding(3) var<storage, read_write> radix_histograms8: array<u32>;
@group(0) @binding(4) var<storage, read> radix_histograms8_read: array<u32>;
@group(0) @binding(5) var<uniform> radix_params: RadixParams;

var<workgroup> local_hist8: array<atomic<u32>, 256>;
var<workgroup> wg_bucket_totals8: array<u32, 256>;
var<workgroup> wg_keys8: array<u32, 256>;
var<workgroup> wg_vals8: array<u32, 256>;
var<workgroup> wg_scan4_8: array<vec4<u32>, 256>;
var<workgroup> wg_totals4_8: vec4<u32>;
var<workgroup> wg_first8: array<u32, 256>;
var<workgroup> wg_bucket_base8: array<u32, 256>;

fn record_byte8(record_index: u32) -> u32 {
  let key_index = record_index * radix_params.key_stride_words + radix_params.key_word_index;
  return (radix_keys[key_index] >> radix_params.bit_offset) & 255u;
}

@compute @workgroup_size(256)
fn histogram_8bit(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  atomicStore(&local_hist8[tid], 0u);
  workgroupBarrier();
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  let group_valid = linear_group < radix_params.workgroup_count;
  let index = linear_group * 256u + tid;
  if (group_valid && index < radix_params.element_count) {
    let record_index = radix_indices_in[index];
    atomicAdd(&local_hist8[record_byte8(record_index)], 1u);
  }
  workgroupBarrier();
  if (group_valid) {
    radix_histograms8[(linear_group + 1u) * 256u + tid] = atomicLoad(&local_hist8[tid]);
  }
}

@compute @workgroup_size(256)
fn scan_histogram_8bit(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let b = local_id.x;
  let group_count = radix_params.workgroup_count;
  var running = 0u;
  for (var g = 0u; g < group_count; g = g + 1u) {
    let slot = (g + 1u) * 256u + b;
    let c = radix_histograms8[slot];
    radix_histograms8[slot] = running;
    running = running + c;
  }
  wg_bucket_totals8[b] = running;

  var offset = 1u;
  for (var width = 128u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (b < width) {
      let left = offset * (2u * b + 1u) - 1u;
      let right = offset * (2u * b + 2u) - 1u;
      wg_bucket_totals8[right] = wg_bucket_totals8[right] + wg_bucket_totals8[left];
    }
    offset = offset << 1u;
  }
  workgroupBarrier();
  if (b == 0u) {
    wg_bucket_totals8[255u] = 0u;
  }
  for (var width = 1u; width < 256u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (b < width) {
      let left = offset * (2u * b + 1u) - 1u;
      let right = offset * (2u * b + 2u) - 1u;
      let prior = wg_bucket_totals8[left];
      wg_bucket_totals8[left] = wg_bucket_totals8[right];
      wg_bucket_totals8[right] = wg_bucket_totals8[right] + prior;
    }
  }
  workgroupBarrier();
  radix_histograms8[b] = wg_bucket_totals8[b];
}

@compute @workgroup_size(256)
fn scatter_8bit(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let linear_group = workgroup_id.x + workgroup_id.y * radix_params.dispatch_x;
  if (linear_group >= radix_params.workgroup_count) {
    return;
  }
  wg_bucket_base8[tid] = radix_histograms8_read[tid]
    + radix_histograms8_read[(linear_group + 1u) * 256u + tid];
  let index = linear_group * 256u + tid;
  let valid = index < radix_params.element_count;
  var init_key = 0x1ffu;
  var init_val = 0u;
  if (valid) {
    init_val = radix_indices_in[index];
    init_key = record_byte8(init_val);
  }
  wg_keys8[tid] = init_key;
  wg_vals8[tid] = init_val;
  workgroupBarrier();

  for (var shift = 0u; shift < 8u; shift = shift + 2u) {
    let cur_key = wg_keys8[tid];
    let cur_val = wg_vals8[tid];
    let q = (cur_key >> shift) & 3u;
    wg_scan4_8[tid] = vec4<u32>(
      select(0u, 1u, q == 0u),
      select(0u, 1u, q == 1u),
      select(0u, 1u, q == 2u),
      select(0u, 1u, q == 3u)
    );
    var offset = 1u;
    for (var width = 128u; width > 0u; width = width >> 1u) {
      workgroupBarrier();
      if (tid < width) {
        let left = offset * (2u * tid + 1u) - 1u;
        let right = offset * (2u * tid + 2u) - 1u;
        wg_scan4_8[right] = wg_scan4_8[right] + wg_scan4_8[left];
      }
      offset = offset << 1u;
    }
    workgroupBarrier();
    if (tid == 0u) {
      wg_totals4_8 = wg_scan4_8[255u];
      wg_scan4_8[255u] = vec4<u32>(0u);
    }
    for (var width = 1u; width < 256u; width = width << 1u) {
      offset = offset >> 1u;
      workgroupBarrier();
      if (tid < width) {
        let left = offset * (2u * tid + 1u) - 1u;
        let right = offset * (2u * tid + 2u) - 1u;
        let prior = wg_scan4_8[left];
        wg_scan4_8[left] = wg_scan4_8[right];
        wg_scan4_8[right] = wg_scan4_8[right] + prior;
      }
    }
    workgroupBarrier();
    let totals = wg_totals4_8;
    let exc = wg_scan4_8[tid];
    var dst = exc.x;
    if (q == 1u) {
      dst = totals.x + exc.y;
    } else if (q == 2u) {
      dst = totals.x + totals.y + exc.z;
    } else if (q == 3u) {
      dst = totals.x + totals.y + totals.z + exc.w;
    }
    wg_keys8[dst] = cur_key;
    wg_vals8[dst] = cur_val;
    workgroupBarrier();
  }

  let sorted_key = wg_keys8[tid];
  let sorted_val = wg_vals8[tid];
  let sorted_valid = (sorted_key & 0x100u) == 0u;
  let sorted_digit = sorted_key & 255u;
  var is_first = tid == 0u;
  if (tid > 0u) {
    is_first = wg_keys8[tid - 1u] != sorted_key;
  }
  if (sorted_valid && is_first) {
    wg_first8[sorted_digit] = tid;
  }
  workgroupBarrier();
  if (sorted_valid) {
    let local_rank = tid - wg_first8[sorted_digit];
    let global_dst = wg_bucket_base8[sorted_digit] + local_rank;
    radix_indices_out[global_dst] = sorted_val;
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

const CONTROL_MAGIC: u32 = ${P.MAGIC}u;
const CONTROL_ABI_VERSION: u32 = ${P.ABI_VERSION}u;
const CONTROL_STATUS: u32 = ${P.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${P.EXPECTED_GENERATION_SEAL}u;
const CONTROL_OBSERVED_SEAL: u32 =
  ${P.OBSERVED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${P.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${P.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_OVERFLOW_COUNT: u32 =
  ${P.OVERFLOW_COUNT}u;
const CONTROL_KEY_WORD_COUNT: u32 =
  ${P.KEY_WORD_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${P.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${P.RADIX_WORKGROUP_COUNT}u;
const CONTROL_HISTOGRAM_COUNT: u32 =
  ${P.HISTOGRAM_ELEMENT_COUNT}u;
const CONTROL_CONSUMER_WORKGROUP_SIZE: u32 =
  ${P.CONSUMER_WORKGROUP_SIZE}u;
const CONTROL_GENERATION_ID: u32 =
  ${P.GENERATION_ID}u;
const CONTROL_HISTOGRAM_LEVEL_COUNT: u32 =
  ${P.HISTOGRAM_SCAN_LEVEL_COUNT}u;
const CONTROL_HEAD_LEVEL_COUNT: u32 =
  ${P.HEAD_SCAN_LEVEL_COUNT}u;
const CONTROL_AUTHORITY_COUNT_WORD: u32 =
  ${P.AUTHORITY_COUNT_OFFSET_WORDS}u;
const CONTROL_AUTHORITY_SEAL_WORD: u32 =
  ${P.AUTHORITY_SEAL_OFFSET_WORDS}u;
const CONTROL_INDIRECT_ROW_COUNT: u32 =
  ${P.INDIRECT_ROW_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${P.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${P.RADIX_DISPATCH_OFFSET_WORDS}u;
const CONTROL_HISTOGRAM_COUNT_WORD: u32 =
  ${P.HISTOGRAM_SCAN_COUNT_OFFSET_WORDS}u;
const CONTROL_HEAD_COUNT_WORD: u32 =
  ${P.HEAD_SCAN_COUNT_OFFSET_WORDS}u;
const CONTROL_HISTOGRAM_DISPATCH_WORD: u32 =
  ${P.HISTOGRAM_SCAN_DISPATCH_OFFSET_WORDS}u;
const CONTROL_HEAD_DISPATCH_WORD: u32 =
  ${P.HEAD_SCAN_DISPATCH_OFFSET_WORDS}u;
const CONTROL_WORD_COUNT: u32 =
  ${P.CONTROL_WORD_COUNT}u;
const CONTROL_DISPATCH_X_LIMIT: u32 =
  ${P.DISPATCH_X_LIMIT}u;

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
`,K=`
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

const CONTROL_STATUS: u32 = ${P.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${P.EXPECTED_GENERATION_SEAL}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${P.COMPLETION_GENERATION_SEAL}u;
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
  let dispatch_y = gpu_count_control[scan_static.add_dispatch_word + 1u];
  if (
    dispatch_x == 0u
    || dispatch_y == 0u
    || workgroup_id.x >= dispatch_x
    || workgroup_id.y >= dispatch_y
  ) {
    return;
  }
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
`,q=`
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

const CONTROL_STATUS: u32 = ${P.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${P.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${P.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${P.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${P.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${P.RADIX_WORKGROUP_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${P.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${P.RADIX_DISPATCH_OFFSET_WORDS}u;
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
`,oe=`
struct DigitStatic {
  key_word_index: u32,
  bit_offset: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> radix_keys: array<u32>;
@group(0) @binding(1) var<storage, read> radix_indices_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> radix_indices_out: array<u32>;
@group(0) @binding(3) var<storage, read_write> radix_histograms8: array<u32>;
@group(0) @binding(4) var<storage, read> radix_histograms8_read: array<u32>;
@group(0) @binding(5) var<storage, read> gpu_count_control: array<u32>;
@group(0) @binding(6) var<uniform> digit_static: DigitStatic;

const CONTROL_STATUS: u32 = ${P.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${P.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${P.LIVE_ELEMENT_COUNT}u;
const CONTROL_MAX_COUNT: u32 =
  ${P.MAXIMUM_ELEMENT_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${P.KEY_STRIDE_WORDS}u;
const CONTROL_RADIX_GROUP_COUNT: u32 =
  ${P.RADIX_WORKGROUP_COUNT}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${P.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${P.RADIX_DISPATCH_OFFSET_WORDS}u;
const STATUS_ADMITTED: u32 = 2u;
const STATUS_FAIL_CLOSED: u32 = 4u;

var<workgroup> wg_ctrl8: vec3<u32>;
var<workgroup> local_hist8: array<atomic<u32>, 256>;
var<workgroup> wg_bucket_totals8: array<u32, 256>;
var<workgroup> wg_keys8: array<u32, 256>;
var<workgroup> wg_vals8: array<u32, 256>;
var<workgroup> wg_scan4_8: array<vec4<u32>, 256>;
var<workgroup> wg_totals4_8: vec4<u32>;
var<workgroup> wg_first8: array<u32, 256>;
var<workgroup> wg_bucket_base8: array<u32, 256>;

fn load_sealed_ctrl8(tid: u32) -> vec3<u32> {
  if (tid == 0u) {
    let status = gpu_count_control[CONTROL_STATUS];
    let sealed =
      (status & STATUS_ADMITTED) != 0u
      && (status & STATUS_FAIL_CLOSED) == 0u
      && gpu_count_control[CONTROL_COMPLETION_SEAL]
        == gpu_count_control[CONTROL_EXPECTED_SEAL];
    let live_count = select(
      0u,
      min(
        gpu_count_control[CONTROL_LIVE_COUNT],
        gpu_count_control[CONTROL_MAX_COUNT]
      ),
      sealed
    );
    let live_groups = select(
      0u,
      gpu_count_control[CONTROL_RADIX_GROUP_COUNT],
      sealed && live_count > 0u
    );
    let dispatch_x = gpu_count_control[
      gpu_count_control[CONTROL_RADIX_DISPATCH_WORD]
    ];
    wg_ctrl8 = vec3<u32>(live_count, live_groups, dispatch_x);
  }
  return workgroupUniformLoad(&wg_ctrl8);
}

fn record_byte8(record_index: u32) -> u32 {
  let key_index =
    record_index * gpu_count_control[CONTROL_KEY_STRIDE]
    + digit_static.key_word_index;
  return (radix_keys[key_index] >> digit_static.bit_offset) & 255u;
}

@compute @workgroup_size(256)
fn histogram_gpu_count_8bit(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let ctrl = load_sealed_ctrl8(tid);
  let live_count = ctrl.x;
  let live_groups = ctrl.y;
  let dispatch_x = ctrl.z;
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  if (linear_group >= live_groups) {
    return;
  }
  atomicStore(&local_hist8[tid], 0u);
  workgroupBarrier();
  let index = linear_group * 256u + tid;
  if (index < live_count) {
    let record_index = radix_indices_in[index];
    atomicAdd(&local_hist8[record_byte8(record_index)], 1u);
  }
  workgroupBarrier();
  radix_histograms8[(linear_group + 1u) * 256u + tid] = atomicLoad(&local_hist8[tid]);
}

@compute @workgroup_size(256)
fn scan_histogram_gpu_count_8bit(
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let b = local_id.x;
  let ctrl = load_sealed_ctrl8(b);
  let live_groups = ctrl.y;
  var running = 0u;
  for (var g = 0u; g < live_groups; g = g + 1u) {
    let slot = (g + 1u) * 256u + b;
    let c = radix_histograms8[slot];
    radix_histograms8[slot] = running;
    running = running + c;
  }
  wg_bucket_totals8[b] = running;

  var offset = 1u;
  for (var width = 128u; width > 0u; width = width >> 1u) {
    workgroupBarrier();
    if (b < width) {
      let left = offset * (2u * b + 1u) - 1u;
      let right = offset * (2u * b + 2u) - 1u;
      wg_bucket_totals8[right] = wg_bucket_totals8[right] + wg_bucket_totals8[left];
    }
    offset = offset << 1u;
  }
  workgroupBarrier();
  if (b == 0u) {
    wg_bucket_totals8[255u] = 0u;
  }
  for (var width = 1u; width < 256u; width = width << 1u) {
    offset = offset >> 1u;
    workgroupBarrier();
    if (b < width) {
      let left = offset * (2u * b + 1u) - 1u;
      let right = offset * (2u * b + 2u) - 1u;
      let prior = wg_bucket_totals8[left];
      wg_bucket_totals8[left] = wg_bucket_totals8[right];
      wg_bucket_totals8[right] = wg_bucket_totals8[right] + prior;
    }
  }
  workgroupBarrier();
  radix_histograms8[b] = wg_bucket_totals8[b];
}

@compute @workgroup_size(256)
fn scatter_gpu_count_8bit(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let tid = local_id.x;
  let ctrl = load_sealed_ctrl8(tid);
  let live_count = ctrl.x;
  let live_groups = ctrl.y;
  let dispatch_x = ctrl.z;
  let linear_group = workgroup_id.x + workgroup_id.y * dispatch_x;
  if (linear_group >= live_groups) {
    return;
  }
  wg_bucket_base8[tid] = radix_histograms8_read[tid]
    + radix_histograms8_read[(linear_group + 1u) * 256u + tid];
  let index = linear_group * 256u + tid;
  let valid = index < live_count;
  var init_key = 0x1ffu;
  var init_val = 0u;
  if (valid) {
    init_val = radix_indices_in[index];
    init_key = record_byte8(init_val);
  }
  wg_keys8[tid] = init_key;
  wg_vals8[tid] = init_val;
  workgroupBarrier();

  for (var shift = 0u; shift < 8u; shift = shift + 2u) {
    let cur_key = wg_keys8[tid];
    let cur_val = wg_vals8[tid];
    let q = (cur_key >> shift) & 3u;
    wg_scan4_8[tid] = vec4<u32>(
      select(0u, 1u, q == 0u),
      select(0u, 1u, q == 1u),
      select(0u, 1u, q == 2u),
      select(0u, 1u, q == 3u)
    );
    var offset = 1u;
    for (var width = 128u; width > 0u; width = width >> 1u) {
      workgroupBarrier();
      if (tid < width) {
        let left = offset * (2u * tid + 1u) - 1u;
        let right = offset * (2u * tid + 2u) - 1u;
        wg_scan4_8[right] = wg_scan4_8[right] + wg_scan4_8[left];
      }
      offset = offset << 1u;
    }
    workgroupBarrier();
    if (tid == 0u) {
      wg_totals4_8 = wg_scan4_8[255u];
      wg_scan4_8[255u] = vec4<u32>(0u);
    }
    for (var width = 1u; width < 256u; width = width << 1u) {
      offset = offset >> 1u;
      workgroupBarrier();
      if (tid < width) {
        let left = offset * (2u * tid + 1u) - 1u;
        let right = offset * (2u * tid + 2u) - 1u;
        let prior = wg_scan4_8[left];
        wg_scan4_8[left] = wg_scan4_8[right];
        wg_scan4_8[right] = wg_scan4_8[right] + prior;
      }
    }
    workgroupBarrier();
    let totals = wg_totals4_8;
    let exc = wg_scan4_8[tid];
    var dst = exc.x;
    if (q == 1u) {
      dst = totals.x + exc.y;
    } else if (q == 2u) {
      dst = totals.x + totals.y + exc.z;
    } else if (q == 3u) {
      dst = totals.x + totals.y + totals.z + exc.w;
    }
    wg_keys8[dst] = cur_key;
    wg_vals8[dst] = cur_val;
    workgroupBarrier();
  }

  let sorted_key = wg_keys8[tid];
  let sorted_val = wg_vals8[tid];
  let sorted_valid = (sorted_key & 0x100u) == 0u;
  let sorted_digit = sorted_key & 255u;
  var is_first = tid == 0u;
  if (tid > 0u) {
    is_first = wg_keys8[tid - 1u] != sorted_key;
  }
  if (sorted_valid && is_first) {
    wg_first8[sorted_digit] = tid;
  }
  workgroupBarrier();
  if (sorted_valid) {
    let local_rank = tid - wg_first8[sorted_digit];
    let global_dst = wg_bucket_base8[sorted_digit] + local_rank;
    radix_indices_out[global_dst] = sorted_val;
  }
}
`,se=`
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

const CONTROL_STATUS: u32 = ${P.STATUS_FLAGS}u;
const CONTROL_EXPECTED_SEAL: u32 =
  ${P.EXPECTED_GENERATION_SEAL}u;
const CONTROL_LIVE_COUNT: u32 =
  ${P.LIVE_ELEMENT_COUNT}u;
const CONTROL_KEY_WORD_COUNT: u32 =
  ${P.KEY_WORD_COUNT}u;
const CONTROL_KEY_STRIDE: u32 =
  ${P.KEY_STRIDE_WORDS}u;
const CONTROL_CONSUMER_WORKGROUP_SIZE: u32 =
  ${P.CONSUMER_WORKGROUP_SIZE}u;
const CONTROL_GENERATION_ID: u32 =
  ${P.GENERATION_ID}u;
const CONTROL_AUTHORITY_COUNT_WORD: u32 =
  ${P.AUTHORITY_COUNT_OFFSET_WORDS}u;
const CONTROL_AUTHORITY_SEAL_WORD: u32 =
  ${P.AUTHORITY_SEAL_OFFSET_WORDS}u;
const CONTROL_COMPLETION_SEAL: u32 =
  ${P.COMPLETION_GENERATION_SEAL}u;
const CONTROL_RADIX_DISPATCH_WORD: u32 =
  ${P.RADIX_DISPATCH_OFFSET_WORDS}u;
const CONTROL_DISPATCH_X_LIMIT: u32 =
  ${P.DISPATCH_X_LIMIT}u;
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
`;function J({elementCount:e,maxComputeWorkgroupsPerDimension:t=65535}={}){let n=w(e,`elementCount`,{max:4294967295}),r=[],a=n;for(;;){let e=j(a);if(r.push({level:r.length,elementCount:a,groupCount:e,dispatch:ee(e,t),blockSumsByteLength:D(e*x),blockOffsetsByteLength:e>1?D(e*x):0}),e<=1)break;a=e}return{schema:i,status:`webgpu-u32-exclusive-scan-plan-ready`,elementCount:n,workgroupSize:256,elementsPerWorkgroup:512,maxComputeWorkgroupsPerDimension:t,levelCount:r.length,levels:r,scratchByteLength:r.reduce((e,t)=>e+t.blockSumsByteLength+t.blockOffsetsByteLength,0),readbackRequired:!1}}function Y(e){return!e?.levels||e.levels.length<2?null:e.levels[e.levels.length-2].elementCount<=32768?e.levels.length-1:null}function X(e){if(!e?.levels||e.levels.length<1)throw TypeError(`scan plan with at least one level is required`);return e.levels.length*2-1-(Y(e)===null?0:1)}function ce(){let e=({cacheKey:e,label:t,code:n,entryPoint:r})=>Object.freeze({cacheKey:e,label:t,code:n,entryPoint:r,bindings:Object.freeze([])});return Object.freeze({schema:`peercompute.ulg.webgpu-stable-radix-pipeline-descriptors.v0`,scanBlocks:e({cacheKey:`ulg-webgpu-u32-exclusive-scan.v1`,label:`ulg-webgpu-u32-exclusive-scan-blocks`,code:H,entryPoint:`scan_blocks`}),scanAdd:e({cacheKey:`ulg-webgpu-u32-exclusive-scan.v1`,label:`ulg-webgpu-u32-exclusive-scan-add-block-offsets`,code:H,entryPoint:`add_scanned_block_offsets`}),scanFusedTopAdd:e({cacheKey:`ulg-webgpu-u32-exclusive-scan.v1`,label:`ulg-webgpu-u32-exclusive-scan-fused-top-add`,code:H,entryPoint:`scan_top_and_add_lower`}),initialize:e({cacheKey:`ulg-webgpu-stable-radix.v1`,label:`ulg-webgpu-stable-radix-initialize`,code:U,entryPoint:`initialize_indices`}),histogram:e({cacheKey:`ulg-webgpu-stable-radix.v1`,label:`ulg-webgpu-stable-radix-histogram`,code:U,entryPoint:`histogram`}),scatter:e({cacheKey:`ulg-webgpu-stable-radix.v1`,label:`ulg-webgpu-stable-radix-scatter`,code:U,entryPoint:`scatter`}),markHeads:e({cacheKey:`ulg-webgpu-sorted-unique.v1`,label:`ulg-webgpu-sorted-unique-mark-heads`,code:W,entryPoint:`mark_heads`}),scatterUnique:e({cacheKey:`ulg-webgpu-sorted-unique.v1`,label:`ulg-webgpu-sorted-unique-scatter`,code:W,entryPoint:`scatter_unique`}),finalizeUnique:e({cacheKey:`ulg-webgpu-sorted-unique.v1`,label:`ulg-webgpu-sorted-unique-finalize`,code:W,entryPoint:`finalize_unique`}),serialHistogramScan:e({cacheKey:`ulg-webgpu-serial-radix-histogram-scan.v1`,label:`ulg-webgpu-serial-radix-histogram-scan`,code:`
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
`,entryPoint:`scan_histogram_serial`})})}function le(e,t){let n=ce();return{scan:c(e,n.scanBlocks).pipeline,add:c(e,n.scanAdd).pipeline,fusedTopAdd:c(e,n.scanFusedTopAdd).pipeline}}function ue(e,{maxElementCount:t,label:n=`ulg-webgpu-u32-scan`,maxComputeWorkgroupsPerDimension:r=null,retainParamsBuffer:a=!1,fixedElementCount:o=null,retainedParamsSlotCount:s=1}={}){I(e);let c=w(t,`maxElementCount`,{max:4294967295}),l=w(e.limits?.maxComputeWorkgroupsPerDimension??65535,`device.limits.maxComputeWorkgroupsPerDimension`,{max:4294967295}),u=r==null?l:Math.min(l,w(r,`maxComputeWorkgroupsPerDimension`,{max:4294967295})),d=J({elementCount:c,maxComputeWorkgroupsPerDimension:u}),f=a&&o!=null?w(o,`fixedElementCount`,{max:c}):null,p=f===null?d:J({elementCount:f,maxComputeWorkgroupsPerDimension:u}),m=a?w(s,`retainedParamsSlotCount`,{max:v}):0,h=p.levelCount*256,g=z();try{let t=le(e,n),r=a?g.ownBuffer(e.createBuffer({label:`${n}-params-retained`,size:h*m,usage:C.UNIFORM|C.COPY_DST})):null,o=d.levels.map(t=>g.ownBuffer(L(e,`${n}-level-${t.level}-block-sums`,t.groupCount))),s=d.levels.map(t=>t.groupCount>1?g.ownBuffer(L(e,`${n}-level-${t.level}-block-offsets`,t.groupCount)):null),l=new Set,_=r?new WeakMap:null,v=Array.from({length:m},()=>null),y={},b=new WeakMap,D=new WeakSet,O=new WeakSet,k=new WeakMap,A=r&&f===null?Array.from({length:m},(e,t)=>({slotIndex:t,inUse:!1})):null,j=!1;function M(e){let t=Error(`${n} retained variable params slot ${e} is in use`);return t.code=`ERR_WEBGPU_SCAN_PARAMS_SLOT_IN_USE`,t.slotIndex=e,t.slotCapacity=m,t}function N(e){if(A?.[e]?.inUse)throw M(e)}function ee(e){if(!A)return null;N(e);let t=A[e];t.inUse=!0;let n=!1;return{owner:y,slotIndex:e,release(){return n?!1:(n=!0,t.inUse=!1,!0)}}}function P(e){if(j||!e||typeof e!=`object`||!D.has(e)||O.has(e))return!1;let t=e&&typeof e==`object`?b.get(e)??null:null;return A===null||t?.owner===y}function F(e){if(!P(e))return!1;let t=b.get(e)??null;return t&&t.release()!==!0?!1:(t&&b.delete(e),O.add(e),!0)}function I(e){let t=[];for(let n of e||[])l.has(n)&&(l.delete(n),t.push(n));R(t)}function z(e,{destroyTransientBuffers:t=!0,ownedTransientBuffers:n=null}={}){if(!P(e))return!1;let r=n??k.get(e)??Object.freeze([]);return F(e)?(k.delete(e),t&&I(r),!0):!1}function B(e,{discardedEncoder:t=!1}={}){if(!P(e))return!1;if(t!==!0)throw TypeError(`${n} releasePrepared requires { discardedEncoder: true }; use releasePreparedAfter with a submission-fence thenable after submission`);return z(e)}function ne(e,t){let n=P(e)?k.get(e)??Object.freeze([]):null;return E(t,`submissionFence must be a thenable that resolves after GPU completion`).then(()=>n===null?!1:z(e,{ownedTransientBuffers:n}))}function re(e){return r!==null&&P(e)}function H(e){return re(e)?z(e,{destroyTransientBuffers:!1}):!1}function U(e,t={}){if(!P(e))return!1;if((b.get(e)??null)?.owner===y&&t.discardedEncoder!==!0)throw TypeError(`${n} retained variable params require { discardedEncoder: true }; use releasePreparedAfter with a submission-fence thenable after submission`);return z(e)}function ae({inputBuffer:i,outputBuffer:a,elementCount:d,retainedParamsSlotIndex:g=0}){if(j)throw Error(`${n} is destroyed`);if(!i||!a)throw TypeError(`exclusive scan requires inputBuffer and outputBuffer`);let y=w(d,`elementCount`,{max:c});if(f!==null&&y!==f)throw RangeError(`${n} retained scan params require fixed elementCount ${f}`);let S=r?T(g,`retainedParamsSlotIndex`,{max:m-1}):0;N(S);let E=f===null?J({elementCount:y,maxComputeWorkgroupsPerDimension:u}):p,O=r?S*h:0,A=Y(E),M=`${E.levelCount}:${A??`none`}`,P=_?.get(i)?.get(a)?.[S]??null,F=P?.topologyKey===M,I=null,L=null;try{let c=r||e.createBuffer({label:`${n}-params-${y}`,size:E.levelCount*256,usage:C.UNIFORM|C.COPY_DST}),u=new Uint32Array(E.levelCount*256/x);for(let e of E.levels)u[e.level*256/x]=e.elementCount,u[e.level*256/x+1]=e.dispatch[0];let d=!r||v[S]!==y;r||(l.add(c),I=c);let f=[],p=i,h=a;for(let r of E.levels){let i=r.level===A?null:F?P.levels[r.level].scanBindGroup:e.createBindGroup({label:`${n}-scan-level-${r.level}`,layout:t.scan.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:p}},{binding:1,resource:{buffer:h}},{binding:2,resource:{buffer:o[r.level]}},{binding:3,resource:{buffer:c,offset:O+r.level*256,size:16}}]});f.push({...r,inputBuffer:p,outputBuffer:h,scanBindGroup:i}),r.groupCount>1&&(p=o[r.level],h=s[r.level])}for(let r=f.length-2;r>=0;--r){let i=f[r];r!==A-1&&(i.addBindGroup=F?P.levels[i.level].addBindGroup:e.createBindGroup({label:`${n}-add-level-${i.level}`,layout:t.add.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i.outputBuffer}},{binding:1,resource:{buffer:s[i.level]}},{binding:3,resource:{buffer:c,offset:O+i.level*256,size:16}}]}))}if(A!==null){let r=f[A],i=f[A-1];r.fusedTopAddBindGroup=F?P.levels[r.level].fusedTopAddBindGroup:e.createBindGroup({label:`${n}-fused-top-${r.level}-add-${i.level}`,layout:t.fusedTopAdd.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:r.inputBuffer}},{binding:1,resource:{buffer:r.outputBuffer}},{binding:2,resource:{buffer:o[r.level]}},{binding:3,resource:{buffer:c,offset:O+r.level*256,size:16}},{binding:4,resource:{buffer:i.outputBuffer}},{binding:5,resource:{buffer:c,offset:O+i.level*256,size:16}}]})}let g=X(E);L=ee(S),d&&(e.queue.writeBuffer(c,O,u),r&&(v[S]=y));let w=Object.freeze(r?[]:[c]),T={plan:E,paramsBuffer:c,paramsData:u,paramsBaseOffset:O,retainedParamsSlotIndex:r?S:null,levels:f,fusedTopLevelIndex:A,fusedTopAddEnabled:A!==null,encodedDispatchCount:g,bindGroupCreationCount:F?0:g,paramsWritePerformed:d,paramsWriteCount:+!!d,preparedScanCacheHit:F,transientBuffers:[...w],paramsBufferResidency:r?`retained-reused`:`transient-per-encode`};if(L&&b.set(T,L),_&&!F){let e=_.get(i);e||(e=new WeakMap,_.set(i,e));let t=e.get(a);t||(t=Array.from({length:m},()=>null),e.set(a,t)),t[S]={topologyKey:M,levels:f.map(({scanBindGroup:e,addBindGroup:t,fusedTopAddBindGroup:n})=>({scanBindGroup:e,addBindGroup:t,fusedTopAddBindGroup:n}))}}return k.set(T,w),D.add(T),T}catch(e){throw L?.release(),I&&l.delete(I)&&R([I]),e}}function W(e,r,{timestampProfiler:i=null,timestampMetadata:a={},labelPrefix:o=n,computePass:s=null,dispatchIndirectProvider:c=null}={}){if(!e?.beginComputePass)throw TypeError(`exclusive scan encoding requires a GPUCommandEncoder-like object`);let l=te(i);if(s&&l)throw Error(`exclusive scan cannot share a compute pass while timestamp profiling is active`);if(s&&(!s.setPipeline||!s.dispatchWorkgroups))throw TypeError(`computePass must be a GPUComputePassEncoder-like object`);if(l){for(let n of r.levels){if(n.level===r.fusedTopLevelIndex){ie(e,i,`${o}ScanTopAddL${n.level}`,{...a,scanLevel:n.level,elementCount:n.elementCount,fusedLowerLevel:n.level-1},t.fusedTopAdd,n.fusedTopAddBindGroup,[1,1,1],c);continue}ie(e,i,`${o}ScanBlocksL${n.level}`,{...a,scanLevel:n.level,elementCount:n.elementCount},t.scan,n.scanBindGroup,n.dispatch,c)}for(let n=r.levels.length-2;n>=0;--n){if(n===r.fusedTopLevelIndex-1)continue;let s=r.levels[n];ie(e,i,`${o}ScanAddL${s.level}`,{...a,scanLevel:s.level,elementCount:s.elementCount},t.add,s.addBindGroup,s.dispatch,c)}return r}let u=s||e.beginComputePass({label:`${o}GroupedScan`});for(let e of r.levels){if(e.level===r.fusedTopLevelIndex){V(u,t.fusedTopAdd,e.fusedTopAddBindGroup,[1,1,1],c);continue}V(u,t.scan,e.scanBindGroup,e.dispatch,c)}for(let e=r.levels.length-2;e>=0;--e){if(e===r.fusedTopLevelIndex-1)continue;let n=r.levels[e];V(u,t.add,n.addBindGroup,n.dispatch,c)}return s||u.end(),r}let G={schema:i,status:`webgpu-u32-exclusive-scan-ready`,pipelineCount:Object.keys(t).length,maxElementCount:c,fixedElementCount:f,retainedParamsSlotCount:m,retainedParamsSlotStrideBytes:r?h:0,maxPlan:d,blockSums:o,blockOffsets:s,prepare:ae,encodePrepared:W,encode(e,t,n={}){let r=ae(t);try{return W(e,r,n),r}catch(e){throw z(r),e}},releasePrepared:B,releasePreparedAfter:ne,canReleasePreparedQueueOrdered:re,releasePreparedQueueOrdered:H,releaseTransientBuffers:U,allocationEntries(){return[...r?[{role:`scan-params-retained`,buffer:r}]:[],...o.map((e,t)=>({role:`scan-level-${t}-block-sums`,buffer:e})),...s.map((e,t)=>e?{role:`scan-level-${t}-block-offsets`,buffer:e}:null).filter(Boolean),...[...l].map(e=>({role:`scan-params-transient`,buffer:e}))]},destroy(){if(!j){j=!0,R([r,...o,...s,...l]),l.clear(),v.fill(null);for(let e of A||[])e.inUse=!1}}};return S.set(G,{hasPreparedLease(e){return b.has(e)},releasePreparedLease:F,finalizePreparedFromParent(e){return z(e)}}),g.commit(),G}catch(e){throw g.rollback(),e}}function de(e,t,{serialHistogramScanEnabled:n=!1}={}){let r=ce(),i=t=>c(e,t).pipeline;return{initialize:i(r.initialize),histogram:i(r.histogram),scatter:i(r.scatter),...n?{serialHistogramScan:i(r.serialHistogramScan)}:{},markHeads:i(r.markHeads),scatterUnique:i(r.scatterUnique),finalizeUnique:i(r.finalizeUnique)}}const fe=new WeakMap,pe=Symbol.for(`ulg.webgpu.rawDevice`);function me(e,t){let n=e?.[pe]??e,r=typeof globalThis.GPUDevice==`function`&&n instanceof globalThis.GPUDevice;if(r){let e=fe.get(n);if(e)return e}let i=e.createShaderModule({label:`${t}-gpu-count-prepare-shader`,code:G}),a=e.createShaderModule({label:`${t}-gpu-count-scan-shader`,code:K}),o=e.createShaderModule({label:`${t}-gpu-count-radix-shader`,code:q}),s=e.createShaderModule({label:`${t}-gpu-count-unique-shader`,code:se}),c=(n,r,i)=>e.createComputePipeline({label:`${t}-gpu-count-${n}`,layout:`auto`,compute:{module:r,entryPoint:i}}),l={prepare:c(`prepare`,i,`prepare_gpu_count`),scanBlocks:c(`scan-blocks`,a,`scan_gpu_count_blocks`),scanAdd:c(`scan-add`,a,`add_gpu_count_block_offsets`),scanFusedTopAdd:c(`scan-fused-top-add`,a,`scan_gpu_count_top_and_add_lower`),initialize:c(`initialize`,o,`initialize_gpu_count_indices`),histogram:c(`histogram`,o,`histogram_gpu_count`),scatter:c(`scatter`,o,`scatter_gpu_count`),markHeads:c(`mark-heads`,s,`mark_gpu_count_heads`),scatterUnique:c(`scatter-unique`,s,`scatter_gpu_count_unique`),finalizeUnique:c(`finalize-unique`,s,`finalize_gpu_count_unique`)};return r&&fe.set(n,l),l}function he(e){return{histogram8:c(e,{cacheKey:`ulg-webgpu-stable-radix-8bit-histogram.v1`,label:`ulg-webgpu-stable-radix-8bit-histogram`,code:ae,entryPoint:`histogram_8bit`,bindings:[u(0,`read-only-storage`),u(1,`read-only-storage`),u(3,`storage`),u(5,`uniform`)]}).pipeline,scanHistogram8:c(e,{cacheKey:`ulg-webgpu-stable-radix-8bit-scan-histogram.v1`,label:`ulg-webgpu-stable-radix-8bit-scan-histogram`,code:ae,entryPoint:`scan_histogram_8bit`,bindings:[u(3,`storage`),u(5,`uniform`)]}).pipeline,scatter8:c(e,{cacheKey:`ulg-webgpu-stable-radix-8bit-scatter.v1`,label:`ulg-webgpu-stable-radix-8bit-scatter`,code:ae,entryPoint:`scatter_8bit`,bindings:[u(0,`read-only-storage`),u(1,`read-only-storage`),u(2,`storage`),u(4,`read-only-storage`),u(5,`uniform`)]}).pipeline}}function ge(e){return{histogram8:c(e,{cacheKey:`ulg-webgpu-radix-gpu-count-8bit-histogram.v1`,label:`ulg-webgpu-radix-gpu-count-8bit-histogram`,code:oe,entryPoint:`histogram_gpu_count_8bit`,bindings:[u(0,`read-only-storage`),u(1,`read-only-storage`),u(3,`storage`),u(5,`read-only-storage`),u(6,`uniform`)]}).pipeline,scanHistogram8:c(e,{cacheKey:`ulg-webgpu-radix-gpu-count-8bit-scan-histogram.v1`,label:`ulg-webgpu-radix-gpu-count-8bit-scan-histogram`,code:oe,entryPoint:`scan_histogram_gpu_count_8bit`,bindings:[u(3,`storage`),u(5,`read-only-storage`)]}).pipeline,scatter8:c(e,{cacheKey:`ulg-webgpu-radix-gpu-count-8bit-scatter.v1`,label:`ulg-webgpu-radix-gpu-count-8bit-scatter`,code:oe,entryPoint:`scatter_gpu_count_8bit`,bindings:[u(0,`read-only-storage`),u(1,`read-only-storage`),u(2,`storage`),u(4,`read-only-storage`),u(5,`read-only-storage`),u(6,`uniform`)]}).pipeline}}function _e(e){let t=[];for(let n=0;n<e.length;n+=1){let r=Math.floor(e[n]/2);(t.length===0||t[t.length-1]!==r)&&t.push(r)}return t}function ve(e,{maxElementCount:t,maxKeyWordCount:i=8,label:a=`ulg-webgpu-radix-unique`,maxComputeWorkgroupsPerDimension:o=null,retainConstantScanParamsBuffers:s=!1,retainVariableScanParamsBuffers:c=!1,serialHistogramScanMaxElementCount:l=0,retainedParamsSlotCount:u=128,prefer8BitRadix:d=!1}={}){I(e);let f=w(t,`maxElementCount`,{max:4294967295}),p=w(i,`maxKeyWordCount`,{max:8}),m=T(l,`serialHistogramScanMaxElementCount`,{max:4294967295}),h=w(e.limits?.maxComputeWorkgroupsPerDimension??65535,`device.limits.maxComputeWorkgroupsPerDimension`,{max:4294967295}),g=o==null?h:Math.min(h,w(o,`maxComputeWorkgroupsPerDimension`,{max:4294967295})),_=w(e.limits?.maxComputeWorkgroupStorageSize??y,`device.limits.maxComputeWorkgroupStorageSize`,{max:4294967295});if(_<y)throw RangeError(`${a} scatter entry point requires ${y} bytes of workgroup storage but device.limits.maxComputeWorkgroupStorageSize is ${_}`);let N=s===!0,P=N?w(u,`retainedParamsSlotCount`,{max:v}):0,B=O(e),ne=p*8,re=ne*B,H=B,U=Number(e.limits?.maxBufferSize??2**53-1),ae=Number(e.limits?.maxUniformBufferBindingSize??2**53-1),W=(e,t)=>{let n=P*e;if(!Number.isSafeInteger(n)||n>U)throw RangeError(`${a} ${t} params arena requires ${n} bytes beyond device capacity`);if(32>ae)throw RangeError(`${a} ${t} params binding exceeds maxUniformBufferBindingSize`);return n},G=M(f),K=G*16,q=Number(e.limits?.maxStorageBufferBindingSize??2**53-1),oe=(G+1)*256,se=D(oe*x),J=d===!0&&G<=8192&&se<=U&&se<=q,Y=F({maxElementCount:f,maxComputeWorkgroupsPerDimension:g}),X=z();try{let t=de(e,a,{serialHistogramScanEnabled:m>0}),i=J?he(e):null,o=X.ownBuffer(L(e,`${a}-sorted-indices-a`,f)),l=X.ownBuffer(L(e,`${a}-sorted-indices-b`,f)),u=X.ownBuffer(L(e,`${a}-histograms`,K)),d=X.ownBuffer(L(e,`${a}-histogram-offsets`,K)),h=J?X.ownBuffer(L(e,`${a}-histograms-8bit`,oe)):null,_=X.ownBuffer(L(e,`${a}-head-flags`,f)),v=X.ownBuffer(L(e,`${a}-head-offsets`,f)),y=X.ownBuffer(L(e,`${a}-unique-keys`,f*p)),D=X.ownBuffer(L(e,`${a}-unique-offsets`,f+1)),O=X.ownBuffer(L(e,`${a}-evidence`,8)),F=X.ownBuffer(L(e,`${a}-dispatch-indirect`,3,C.INDIRECT)),I=N?X.ownBuffer(e.createBuffer({label:`${a}-radix-params-retained-arena`,size:W(re,`radix`),usage:C.UNIFORM|C.COPY_DST})):null,ae=N?X.ownBuffer(e.createBuffer({label:`${a}-unique-params-retained-arena`,size:W(H,`unique`),usage:C.UNIFORM|C.COPY_DST})):null,G=X.ownRuntime(ue(e,{maxElementCount:K,label:`${a}-histogram-scan`,maxComputeWorkgroupsPerDimension:g,retainParamsBuffer:s,fixedElementCount:c?null:K,retainedParamsSlotCount:c&&P||1})),q=X.ownRuntime(ue(e,{maxElementCount:f,label:`${a}-head-scan`,maxComputeWorkgroupsPerDimension:g,retainParamsBuffer:s,fixedElementCount:c?null:f,retainedParamsSlotCount:c&&P||1})),se=(e,t,n)=>{let r=S.get(t);return!e||!r?.hasPreparedLease(n)?!1:e.addChildLease({release:()=>r.releasePreparedLease(n)})},ce=new Set,le=Array.from({length:P},(e,t)=>({slotIndex:t,inUse:!1,radixByteOffset:t*re,uniqueByteOffset:t*H,bindGroups:new Map})),fe=new WeakMap,pe=new WeakSet,ve=new WeakMap,ye=new WeakMap,Z=null,be=!1;function xe(){if(Z)return Z;if(be)throw Error(`${a} is destroyed`);let t=z();try{let n=me(e,a),r=J?ge(e):null,i=t.ownBuffer(L(e,`${a}-gpu-count-control`,Y.controlWordCount,C.INDIRECT)),o=1*B;if(!Number.isSafeInteger(o)||o>U)throw RangeError(`${a} GPU-count config arena requires ${o} bytes beyond device capacity`);let s=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-config-retained-arena`,size:o,usage:C.UNIFORM|C.COPY_DST})),c=Array.from({length:1},(e,t)=>({slotIndex:t,byteOffset:t*B,inUse:!1,bindGroups:new Map})),l=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-digit-static`,size:ne*B,usage:C.UNIFORM|C.COPY_DST})),m=new Uint32Array(ne*B/x),g=0;for(let e=p-1;e>=0;--e)for(let t=0;t<32;t+=4){let n=g*B/x;m[n]=e,m[n+1]=t,g+=1}e.queue.writeBuffer(l,0,m);let y=null;if(J){let n=p*4;y=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-digit-static-8bit`,size:n*B,usage:C.UNIFORM|C.COPY_DST}));let r=new Uint32Array(n*B/x),i=0;for(let e=p-1;e>=0;--e)for(let t=0;t<32;t+=8){let n=i*B/x;r[n]=e,r[n+1]=t,i+=1}e.queue.writeBuffer(y,0,r)}let b=Y.histogramScanLevelCount+Y.headScanLevelCount,S=t.ownBuffer(e.createBuffer({label:`${a}-gpu-count-scan-static`,size:b*B,usage:C.UNIFORM|C.COPY_DST})),w=new Uint32Array(b*B/x),E=0,D=(e,t,n)=>{let r=E;for(let r=0;r<n;r+=1){let n=E*B/x;w[n]=e+r,w[n+1]=t+r*6,w[n+2]=t+r*6+3,E+=1}return r},O=D(Y.histogramScanCountOffsetWords,Y.histogramScanDispatchOffsetWords,Y.histogramScanLevelCount),k=D(Y.headScanCountOffsetWords,Y.headScanDispatchOffsetWords,Y.headScanLevelCount);e.queue.writeBuffer(S,0,w);let A=[{role:`radix-gpu-count-control`,buffer:i},{role:`radix-gpu-count-config-retained-arena`,buffer:s},{role:`radix-gpu-count-digit-static`,buffer:l},...y?[{role:`radix-gpu-count-digit-static-8bit`,buffer:y}]:[],{role:`radix-gpu-count-scan-static`,buffer:S}],M=({prefix:r,maximumElementCount:o,levelCount:s,countOffsetWords:c,dispatchOffsetWords:l,firstStaticRow:u,sourceInputBuffer:d,sourceOutputBuffer:f})=>{let p=[],m=[],h=[],g=o;for(let n=0;n<s;n+=1){h.push(g);let i=j(g),o=t.ownBuffer(L(e,`${a}-gpu-count-${r}-level-${n}-sums`,i)),s=t.ownBuffer(L(e,`${a}-gpu-count-${r}-level-${n}-offsets`,i));p.push(o),m.push(s),A.push({role:`radix-gpu-count-${r}-scan-sums`,buffer:o},{role:`radix-gpu-count-${r}-scan-offsets`,buffer:s}),g=i}let _=s>=2&&h[s-2]<=32768?s-1:null,v=[];for(let t=0;t<s;t+=1){let o=t===0?d:p[t-1],s=t===0?f:m[t-1],g=(u+t)*B,y=e.createBindGroup({label:`${a}-gpu-count-${r}-scan-block-${t}`,layout:n.scanBlocks.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:p[t]}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:S,offset:g,size:16}}]}),b=e.createBindGroup({label:`${a}-gpu-count-${r}-scan-add-${t}`,layout:n.scanAdd.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:s}},{binding:3,resource:{buffer:m[t]}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:S,offset:g,size:16}}]}),C=t===_?e.createBindGroup({label:`${a}-gpu-count-${r}-scan-fused-top-${t}`,layout:n.scanFusedTopAdd.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:p[t]}},{binding:4,resource:{buffer:i}},{binding:5,resource:{buffer:S,offset:g,size:16}},{binding:6,resource:{buffer:t===1?f:m[t-2]}},{binding:7,resource:{buffer:S,offset:(u+t-1)*B,size:16}}]}):null;v.push(Object.freeze({level:t,maximumElementCount:h[t],countOffsetWords:c+t,blockDispatchOffsetWords:l+t*6,blockDispatchOffsetBytes:(l+t*6)*x,addDispatchOffsetWords:l+t*6+3,addDispatchOffsetBytes:(l+t*6+3)*x,blockBindGroup:y,addBindGroup:b,fusedTopAddBindGroup:C}))}return Object.freeze({levels:v,fusedTopLevelIndex:_,fusedTopAddEnabled:_!==null,encodedDispatchCount:v.length*2-1-(_===null?0:1)})},N=J?null:M({prefix:`histogram`,maximumElementCount:K,levelCount:Y.histogramScanLevelCount,countOffsetWords:Y.histogramScanCountOffsetWords,dispatchOffsetWords:Y.histogramScanDispatchOffsetWords,firstStaticRow:O,sourceInputBuffer:u,sourceOutputBuffer:d}),ee=J?e.createBindGroup({label:`${a}-gpu-count-8bit-scan-histogram`,layout:r.scanHistogram8.getBindGroupLayout(0),entries:[{binding:3,resource:{buffer:h}},{binding:5,resource:{buffer:i}}]}):null,P=M({prefix:`head`,maximumElementCount:f,levelCount:Y.headScanLevelCount,countOffsetWords:Y.headScanCountOffsetWords,dispatchOffsetWords:Y.headScanDispatchOffsetWords,firstStaticRow:k,sourceInputBuffer:_,sourceOutputBuffer:v}),F={pipelines:n,pipelines8:r,controlBuffer:i,configArena:s,configSlotCount:1,digitStaticBuffer:l,digitStatic8Buffer:y,scanHistogram8BindGroup:ee,scanStaticBuffer:S,histogramScanPopulation:N,headScanPopulation:P,allocationEntries:A,acquireConfigSlot(e=null){let t=null;if(t=e==null?c.find(e=>!e.inUse)??null:c[T(e,`retainedParamsSlotIndex`,{max:0})],!t||t.inUse){let t=Error(`${a} already has a GPU-count execution in flight`);throw t.code=`ERR_WEBGPU_RADIX_GPU_COUNT_EXECUTION_IN_FLIGHT`,t.slotCapacity=1,t.requestedSlotIndex=e??null,t}t.inUse=!0;let n=!1;return{slot:t,release(){return n?!1:(n=!0,t.inUse=!1,!0)}}},destroy(){R(A.map(({buffer:e})=>e));for(let e of c)e.inUse=!1,e.bindGroups.clear()}};return t.commit(),Z=F,F}catch(e){throw t.rollback(),e}}function Se(e,t,{ownedTransientBuffers:n=[],childPreparedScans:r=[]}={}){let i=Object.freeze([...n]),o=Object.freeze(r.map(({scanRuntime:e,internals:t,prepared:n})=>{let r=t??S.get(e);if(!r?.finalizePreparedFromParent)throw Error(`${a} child scan cleanup capability is unavailable`);return Object.freeze({internals:r,prepared:n})}));return ve.set(e,i),ye.set(e,o),pe.add(e),t&&fe.set(e,t),e}function Ce(e=null){if(!N)return null;let t=null;if(e!=null)t=le[T(e,`retainedParamsSlotIndex`,{max:P-1})];else for(let e=0;e<P;e+=1)if(!le[e].inUse){t=le[e];break}if(!t||t.inUse){let t=Error(`${a} retained params slot arena is exhausted`);throw t.code=`ERR_WEBGPU_RADIX_PARAMS_ARENA_EXHAUSTED`,t.slotCapacity=P,t.requestedSlotIndex=e??null,t}t.inUse=!0;let n=!1,r=new Set;return{slot:t,addChildLease(e){return e?.release?n?(e.release(),!1):(r.add(e),!0):!1},release(){if(n)return!1;n=!0;for(let e of r)e.release();return r.clear(),t.inUse=!1,!0}}}function Q(t,n,r,i,a,o){let s=A(r,a),c=t?.bindGroups.get(n)??null;if(c&&k(c.signature,s))return o.reused+=1,c.bindGroup;let l=e.createBindGroup({label:i,layout:r.getBindGroupLayout(0),entries:a});return t&&t.bindGroups.set(n,{signature:s,bindGroup:l}),o.created+=1,l}function we({elementCount:e,keyWordCount:t,keyStrideWords:n}){if(be)throw Error(`${a} is destroyed`);let r=T(e,`elementCount`,{max:f}),i=w(t,`keyWordCount`,{max:p}),o=w(n,`keyStrideWords`,{max:65535});if(o<i)throw RangeError(`keyStrideWords must cover keyWordCount`);return{count:r,words:i,stride:o}}function Te(e,t=null){let n=e*8;if(t==null)return Array.from({length:n},(e,t)=>t);if(!Array.isArray(t)||t.length===0)throw RangeError(`significantDigitRows must retain at least one digit`);let r=[];for(let e=0;e<t.length;e+=1){let i=T(t[e],`significantDigitRows[${e}]`,{max:n-1});if(e>0&&i<=r[e-1])throw RangeError(`significantDigitRows must be strictly increasing in LSD radix order`);r.push(i)}return r}function Ee({count:t,words:n,stride:r,generationId:i,digitRows:o=null,use8Bit:s=!1},c=null){let l=Te(n,o),u=s?_e(l):l,d=s?4:8,f=s?8:4,p=u.length,m=c?.slot??null,h=m?.inUse===!0?I:e.createBuffer({label:`${a}-radix-params-${i}`,size:Math.max(B,p*B),usage:C.UNIFORM|C.COPY_DST}),_=m?null:h;try{let a=m?.radixByteOffset??0,o=new Uint32Array(Math.max(B,p*B)/x),s=M(t),c=ee(s,g);for(let e=0;e<u.length;e+=1){let a=u[e],l=n-1-Math.floor(a/d),p=a%d*f,m=e*B/x;o[m]=t,o[m+1]=s,o[m+2]=r,o[m+3]=l,o[m+4]=p,o[m+5]=n,o[m+6]=i,o[m+7]=c[0]}return e.queue.writeBuffer(h,a,o),_&&ce.add(_),{buffer:h,byteOffset:a,transientBuffer:_,paramsSlotIndex:m?.slotIndex??null,paramsBufferResidency:m?`retained-slot-arena`:`transient-per-encode`}}catch(e){throw _&&(ce.delete(_),R([_])),e}}function De(e,{keyBuffer:r,elementCount:s,keyWordCount:f,keyStrideWords:p=f,generationId:_=0,significantDigitRows:v=null,timestampProfiler:y=null,timestampMetadata:b={},dispatchIndirectProvider:x=null}={},C=null){if(!e?.beginComputePass)throw TypeError(`stable radix encoding requires a GPUCommandEncoder-like object`);if(!r)throw TypeError(`stable radix encoding requires keyBuffer`);let{count:w,words:E,stride:D}=we({elementCount:s,keyWordCount:f,keyStrideWords:p}),O=Te(E,v);if(w===0)return Se({schema:n,status:`webgpu-stable-radix-empty`,elementCount:0,sortedIndicesBuffer:o,transientBuffers:[]},C,{ownedTransientBuffers:[]});let k=T(_,`generationId`,{max:4294967295});if(N&&!C?.slot?.inUse)throw Error(`${a} retained radix encoding requires an active params slot lease`);let A=null,j=null;try{A=Ee({count:w,words:E,stride:D,generationId:k,digitRows:O,use8Bit:J},C);let s=A.buffer,f=A.byteOffset,p=M(w),_=ee(p,g),v=J?_e(O):O,S=J?(p+1)*256:p*16,T=!J&&m>0&&S>512&&S<=m;j=J||T?null:G.prepare({inputBuffer:u,outputBuffer:d,elementCount:S,retainedParamsSlotIndex:c?C?.slot?.slotIndex??0:0}),j&&se(C,G,j);let N=[...A.transientBuffer?[A.transientBuffer]:[],...j?.transientBuffers??[]],P={created:0,reused:0},F=[{binding:2,resource:{buffer:o}},{binding:5,resource:{buffer:s,offset:f,size:32}}],I=Q(C?.slot,`radix-initialize`,t.initialize,`${a}-initialize-bind-group`,F,P),L=J?Q(C?.slot,`radix8-scan-histogram`,i.scanHistogram8,`${a}-8bit-scan-histogram-bind-group`,[{binding:3,resource:{buffer:h}},{binding:5,resource:{buffer:s,offset:f,size:32}}],P):null,R=T?Q(C?.slot,`radix-serial-histogram-scan`,t.serialHistogramScan,`${a}-serial-histogram-scan-bind-group`,[{binding:0,resource:{buffer:u}},{binding:1,resource:{buffer:d}},{binding:2,resource:{buffer:s,offset:f,size:32}}],P):null,z=o,ne=l,re=v.length,H=J?4:8,U=J?8:4,ae=[];for(let e=0;e<v.length;e+=1){let n=v[e],o=E-1-Math.floor(n/H),c=n%H*U,l=f+e*B,p=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:z}},{binding:3,resource:{buffer:J?h:u}},{binding:5,resource:{buffer:s,offset:l,size:32}}],m=Q(C?.slot,J?`radix8-histogram-${e}`:`radix-histogram-${e}`,J?i.histogram8:t.histogram,`${a}-histogram-${o}-${c}`,p,P),g=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:z}},{binding:2,resource:{buffer:ne}},{binding:4,resource:{buffer:J?h:d}},{binding:5,resource:{buffer:s,offset:l,size:32}}],_=Q(C?.slot,J?`radix8-scatter-${e}`:`radix-scatter-${e}`,J?i.scatter8:t.scatter,`${a}-scatter-${o}-${c}`,g,P);ae.push({word:o,shift:c,histogramBindGroup:m,scatterBindGroup:_}),[z,ne]=[ne,z]}let W=te(y),K=W?null:e.beginComputePass({label:`${a}GroupedRadixSort`});W?ie(e,y,`${a}Initialize`,{...b,generationId:k,elementCount:w},t.initialize,I,_,x):V(K,t.initialize,I,_,x);let q=J?i.histogram8:t.histogram,oe=J?i.scatter8:t.scatter;for(let n of ae){let r={...b,generationId:k,keyWord:n.word,bitOffset:n.shift};W?ie(e,y,`${a}Histogram`,r,q,n.histogramBindGroup,_,x):V(K,q,n.histogramBindGroup,_,x),J?W?ie(e,y,`${a}RadixHistogram8BitScan`,r,i.scanHistogram8,L,[1,1,1],x):V(K,i.scanHistogram8,L,[1,1,1],x):T?W?ie(e,y,`${a}RadixHistogramSerialScan`,r,t.serialHistogramScan,R,[1,1,1],x):V(K,t.serialHistogramScan,R,[1,1,1],x):G.encodePrepared(e,j,{timestampProfiler:y,timestampMetadata:r,labelPrefix:`${a}RadixHistogram`,computePass:K,dispatchIndirectProvider:x}),W?ie(e,y,`${a}Scatter`,r,oe,n.scatterBindGroup,_,x):V(K,oe,n.scatterBindGroup,_,x)}return K?.end(),Se({schema:n,status:`webgpu-stable-multiword-radix-encoded`,generationId:k,elementCount:w,keyWordCount:E,keyStrideWords:D,radixBitsPerPass:U,passCount:re,sortedIndicesBuffer:z,histogramElementCount:S,histogramScanMode:J?`parallel-8bit-single-wg`:T?`serial-small`:`parallel-scan`,encodedDispatchCount:1+re*(J||T?3:2+j.encodedDispatchCount),encodedComputePassCount:W?1+re*(J||T?3:2+j.encodedDispatchCount):1,bindGroupCreationCount:P.created+(j?.bindGroupCreationCount??0),bindGroupReuseCount:P.reused+(J||T?Math.max(0,re-1):Math.max(0,re-+!j.preparedScanCacheHit)*j.encodedDispatchCount),paramsBufferCreationCount:+!!A.transientBuffer,paramsWriteCount:1+(j?.paramsWriteCount??0),paramsSlotIndex:A.paramsSlotIndex,paramsBufferResidency:A.paramsBufferResidency,readbackPerformed:!1,transientBuffers:N},C,{ownedTransientBuffers:N,childPreparedScans:j?[{scanRuntime:G,prepared:j}]:[]})}catch(e){throw j&&S.get(G)?.finalizePreparedFromParent(j),A?.transientBuffer&&ce.delete(A.transientBuffer)&&R([A.transientBuffer]),e}}function Oe({count:t,words:n,stride:r,generationId:i,consumerWorkgroupSize:o,dispatchX:s},c=null){let l=c?.slot??null,u=l?.inUse===!0?ae:e.createBuffer({label:`${a}-unique-params-${i}`,size:B,usage:C.UNIFORM|C.COPY_DST}),d=l?null:u;try{let a=l?.uniqueByteOffset??0;return e.queue.writeBuffer(u,a,new Uint32Array([t,r,n,i,o,s,0,0])),d&&ce.add(d),{buffer:u,byteOffset:a,transientBuffer:d,paramsSlotIndex:l?.slotIndex??null,paramsBufferResidency:l?`retained-slot-arena`:`transient-per-encode`}}catch(e){throw d&&(ce.delete(d),R([d])),e}}function ke(e,{keyBuffer:r,sortedIndicesBuffer:i,elementCount:o,keyWordCount:s,keyStrideWords:l=s,generationId:u=0,consumerWorkgroupSize:d=64,timestampProfiler:p=null,timestampMetadata:m={},dispatchIndirectProvider:h=null}={},C=null){if(!e?.beginComputePass||!e?.clearBuffer)throw TypeError(`unique encoding requires a GPUCommandEncoder-like object`);if(!r||!i)throw TypeError(`unique encoding requires keyBuffer and sortedIndicesBuffer`);let{count:E,words:k,stride:A}=we({elementCount:o,keyWordCount:s,keyStrideWords:l}),j=T(u,`generationId`,{max:4294967295}),P=w(d,`consumerWorkgroupSize`,{max:1024}),I=ee(E>0?M(E):1,g);if(N&&!C?.slot?.inUse)throw Error(`${a} retained unique encoding requires an active params slot lease`);let L=null,z=null;try{L=Oe({count:E,words:k,stride:A,generationId:j,consumerWorkgroupSize:P,dispatchX:I[0]},C);let o=L.buffer,s=L.byteOffset,l=L.transientBuffer?[L.transientBuffer]:[],u={created:0,reused:0};e.clearBuffer(O),e.clearBuffer(F),e.clearBuffer(D,0,x);let d=null,g=null;if(E>0){let e=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:_}},{binding:8,resource:{buffer:o,offset:s,size:32}}];d=Q(C?.slot,`unique-mark-heads`,t.markHeads,`${a}-mark-heads-bind-group`,e,u),z=q.prepare({inputBuffer:_,outputBuffer:v,elementCount:E,retainedParamsSlotIndex:c?C?.slot?.slotIndex??0:0}),se(C,q,z),l.push(...z.transientBuffers);let n=[{binding:0,resource:{buffer:r}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}},{binding:4,resource:{buffer:y}},{binding:5,resource:{buffer:D}},{binding:8,resource:{buffer:o,offset:s,size:32}}];g=Q(C?.slot,`unique-scatter`,t.scatterUnique,`${a}-scatter-unique-bind-group`,n,u)}let S=[{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}},{binding:5,resource:{buffer:D}},{binding:6,resource:{buffer:O}},{binding:7,resource:{buffer:F}},{binding:8,resource:{buffer:o,offset:s,size:32}}],w=Q(C?.slot,`unique-finalize`,t.finalizeUnique,`${a}-finalize-unique-bind-group`,S,u),T=te(p),M={...m,generationId:j,elementCount:E},N=T?null:e.beginComputePass({label:`${a}GroupedUnique`});return E>0&&(T?ie(e,p,`${a}MarkUniqueHeads`,M,t.markHeads,d,I,h):V(N,t.markHeads,d,I,h),q.encodePrepared(e,z,{timestampProfiler:p,timestampMetadata:{...m,generationId:j},labelPrefix:`${a}UniqueHead`,computePass:N,dispatchIndirectProvider:h}),T?ie(e,p,`${a}ScatterUnique`,M,t.scatterUnique,g,I,h):V(N,t.scatterUnique,g,I,h)),T?ie(e,p,`${a}FinalizeUnique`,M,t.finalizeUnique,w,[1,1,1],h):(V(N,t.finalizeUnique,w,[1,1,1],h),N.end()),Se({schema:n,status:`webgpu-sorted-unique-csr-encoded`,generationId:j,elementCount:E,keyWordCount:k,keyStrideWords:A,sortedIndicesBuffer:i,uniqueHeadFlagsBuffer:_,uniqueGroupIndexBySortedPositionBuffer:v,uniqueKeysBuffer:y,uniqueOffsetsBuffer:D,uniqueEvidenceBuffer:O,uniqueDispatchIndirectBuffer:F,uniqueKeyCapacity:f,uniqueOffsetCapacity:f+1,consumerWorkgroupSize:P,encodedDispatchCount:(E>0?2+z.encodedDispatchCount:0)+1,encodedComputePassCount:T?(E>0?2+z.encodedDispatchCount:0)+1:1,bindGroupCreationCount:u.created+(z?.bindGroupCreationCount??0),bindGroupReuseCount:u.reused+(z?.preparedScanCacheHit?z.encodedDispatchCount:0),paramsBufferCreationCount:+!!L.transientBuffer,paramsWriteCount:1+(z?.paramsWriteCount??0),clearedWordCount:b,paramsSlotIndex:L.paramsSlotIndex,paramsBufferResidency:L.paramsBufferResidency,readbackPerformed:!1,transientBuffers:l},C,{ownedTransientBuffers:l,childPreparedScans:z?[{scanRuntime:q,prepared:z}]:[]})}catch(e){throw z&&S.get(q)?.finalizePreparedFromParent(z),L?.transientBuffer&&ce.delete(L.transientBuffer)&&R([L.transientBuffer]),e}}function Ae(t,i={}){if(!t?.beginComputePass||!t?.clearBuffer)throw TypeError(`GPU-authored count radix encoding requires a GPUCommandEncoder-like object`);let s=i.keyBuffer,c=i.authorityBuffer??i.countAuthorityBuffer;if(!s||!c)throw TypeError(`GPU-authored count radix encoding requires keyBuffer and authorityBuffer`);let m=w(i.maxElementCount,`maxElementCount`,{max:f}),S=w(i.keyWordCount,`keyWordCount`,{max:p}),C=w(i.keyStrideWords??S,`keyStrideWords`,{max:65535});if(C<S)throw RangeError(`keyStrideWords must cover keyWordCount`);let E=w(i.consumerWorkgroupSize??64,`consumerWorkgroupSize`,{max:1024}),k=T(i.authorityCountByteOffset??i.countByteOffset??0,`authorityCountByteOffset`,{max:4294967292});if(k%x!==0)throw RangeError(`authorityCountByteOffset must be u32 aligned`);let A=i.generationSeal&&typeof i.generationSeal==`object`?i.generationSeal:null,j=w(A?.expected??A?.value??i.generationSeal,`generationSeal`,{max:4294967295}),M=T(A?.byteOffset??i.authoritySealByteOffset??k+x,`authoritySealByteOffset`,{max:4294967292});if(M%x!==0)throw RangeError(`authoritySealByteOffset must be u32 aligned`);if(M===k)throw RangeError(`authority count and generation seal require distinct u32 words`);if(Number.isFinite(Number(c.size))){let e=Number(c.size);if(k+x>e||M+x>e)throw RangeError(`authority count and generation seal offsets must be inside authorityBuffer`)}if(Number.isFinite(Number(s.size))){let e=m*C*x;if(!Number.isSafeInteger(e)||e>Number(s.size))throw RangeError(`keyBuffer must cover maxElementCount * keyStrideWords (${e} bytes)`)}let N=T(i.generationId??j,`generationId`,{max:4294967295});if(!Z){let e=Error(`${a} GPU-count resources are not prepared; call prepareGpuCountResources() outside the encode hot loop`);throw e.code=`ERR_WEBGPU_RADIX_GPU_COUNT_NOT_PREPARED`,e}let ee=Z,{pipelines:P,pipelines8:I,controlBuffer:L,configArena:R,digitStaticBuffer:z,digitStatic8Buffer:te,scanHistogram8BindGroup:re,histogramScanPopulation:V,headScanPopulation:ie}=ee,H=ee.acquireConfigSlot(i.retainedParamsSlotIndex),U={created:0,reused:0},ae=H.slot.byteOffset,W=new Uint32Array(B/x);W[0]=k/x,W[1]=M/x,W[2]=j,W[3]=m,W[4]=S,W[5]=C,W[6]=E,W[7]=N,W[8]=g,W[9]=Y.histogramScanCountOffsetWords,W[10]=Y.headScanCountOffsetWords,W[11]=Y.radixDispatchOffsetWords,W[12]=Y.histogramScanDispatchOffsetWords,W[13]=Y.headScanDispatchOffsetWords,W[14]=Y.histogramScanLevelCount,W[15]=Y.headScanLevelCount,W[16]=Y.indirectRowCount,W[17]=Y.controlWordCount,W[18]=f,e.queue.writeBuffer(R,ae,W);try{let w=Q(H.slot,`gpu-count-prepare`,P.prepare,`${a}-gpu-count-prepare-bind-group`,[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:L}},{binding:2,resource:{buffer:R,offset:ae,size:80}}],U),E=Q(H.slot,`gpu-count-initialize`,P.initialize,`${a}-gpu-count-initialize-bind-group`,[{binding:2,resource:{buffer:o}},{binding:5,resource:{buffer:L}}],U),A=(p-S)*8,ee=Array.from({length:S*8},(e,t)=>A+t),W=i.significantDigitRows,G=W==null?ee:Array.from(W,(e,t)=>{let n=T(e,`significantDigitRows[${t}]`,{max:ne-1});if(n<A)throw RangeError(`significantDigitRows must address only active key words`);return n});if(G.length===0)throw RangeError(`significantDigitRows must retain at least one digit`);for(let e=1;e<G.length;e+=1)if(G[e]<=G[e-1])throw RangeError(`significantDigitRows must be strictly increasing in LSD radix order`);let K=o,q=l,oe=[];if(J){let e=_e(G);for(let t=0;t<e.length;t+=1){let n=e[t],r={buffer:te,offset:n*B,size:16},i=K===o?`a`:`b`,c=Q(H.slot,`gpu-count-8bit-histogram-${n}-${i}`,I.histogram8,`${a}-gpu-count-8bit-histogram-${t}`,[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:K}},{binding:3,resource:{buffer:h}},{binding:5,resource:{buffer:L}},{binding:6,resource:r}],U),l=Q(H.slot,`gpu-count-8bit-scatter-${n}-${i}`,I.scatter8,`${a}-gpu-count-8bit-scatter-${t}`,[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:K}},{binding:2,resource:{buffer:q}},{binding:4,resource:{buffer:h}},{binding:5,resource:{buffer:L}},{binding:6,resource:r}],U);oe.push({histogramBindGroup:c,scatterBindGroup:l}),[K,q]=[q,K]}}else for(let e=0;e<G.length;e+=1){let t=G[e],n={buffer:z,offset:t*B,size:16},r=Q(H.slot,`gpu-count-histogram-${t}`,P.histogram,`${a}-gpu-count-histogram-${e}`,[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:K}},{binding:3,resource:{buffer:u}},{binding:5,resource:{buffer:L}},{binding:6,resource:n}],U),i=Q(H.slot,`gpu-count-scatter-${t}`,P.scatter,`${a}-gpu-count-scatter-${e}`,[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:K}},{binding:2,resource:{buffer:q}},{binding:4,resource:{buffer:d}},{binding:5,resource:{buffer:L}},{binding:6,resource:n}],U);oe.push({histogramBindGroup:r,scatterBindGroup:i}),[K,q]=[q,K]}let se=K,X=Q(H.slot,`gpu-count-mark-heads`,P.markHeads,`${a}-gpu-count-mark-heads-bind-group`,[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:se}},{binding:2,resource:{buffer:_}},{binding:8,resource:{buffer:L}}],U),ce=Q(H.slot,`gpu-count-scatter-unique`,P.scatterUnique,`${a}-gpu-count-scatter-unique-bind-group`,[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:se}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}},{binding:4,resource:{buffer:y}},{binding:5,resource:{buffer:D}},{binding:8,resource:{buffer:L}}],U),le=Q(H.slot,`gpu-count-finalize-unique`,P.finalizeUnique,`${a}-gpu-count-finalize-unique-bind-group`,[{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}},{binding:5,resource:{buffer:D}},{binding:6,resource:{buffer:O}},{binding:7,resource:{buffer:F}},{binding:8,resource:{buffer:L}},{binding:9,resource:{buffer:c}}],U),ue=i.gpuTimestampRecorder??null,de=typeof i.timestampProducerId==`string`&&i.timestampProducerId.trim()?i.timestampProducerId.trim():`webgpu-gpu-count-radix-sort-unique`,fe=ue?.active===!0&&typeof ue.beginEncoderSpan==`function`?ue.beginEncoderSpan(t,{producerId:de,stage:`gpu-count-radix-sort-unique`,spanClass:`same-grouped-production-compute-pass`,...i.timestampMetadata||{},elementCount:null,elementCountSource:`authenticated-gpu-authority`,maxElementCount:m,keyWordCount:S}):null;t.clearBuffer(L),t.clearBuffer(O),t.clearBuffer(F),t.clearBuffer(D,0,x);let pe=t.beginComputePass({label:`${a}GpuCountPrepare`});pe.setPipeline(P.prepare),pe.setBindGroup(0,w),pe.dispatchWorkgroups(1,1,1),pe.end();let me=t.beginComputePass({label:`${a}GroupedGpuCountRadixUnique`}),he=e=>Number.isSafeInteger(e)&&e>0&&e<=g?e:null,ge=he(Math.ceil(m/256)),ve=0,ye=0,Z=(e,t,n,r=null)=>{if(me.setPipeline(e),me.setBindGroup(0,t),r!=null){me.dispatchWorkgroups(r,1,1),ve+=1;return}if(ye+=1,typeof me.dispatchWorkgroupsIndirect!=`function`)throw TypeError(`GPU-authored count radix encoding requires dispatchWorkgroupsIndirect`);me.dispatchWorkgroupsIndirect(L,n)},be=t=>{for(let e of t.levels){let n=he(Math.ceil(e.maximumElementCount/512));if(e.level===t.fusedTopLevelIndex){Z(P.scanFusedTopAdd,e.fusedTopAddBindGroup,e.blockDispatchOffsetBytes,n);continue}Z(P.scanBlocks,e.blockBindGroup,e.blockDispatchOffsetBytes,n)}let n=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice;for(let e=t.levels.length-2;e>=0;--e){if(e===t.fusedTopLevelIndex-1)continue;let r=t.levels[e],i=n?he(Math.ceil(r.maximumElementCount/512)):null;Z(P.scanAdd,r.addBindGroup,r.addDispatchOffsetBytes,i)}};Z(P.initialize,E,Y.radixDispatchOffsetBytes,ge);for(let e of oe)J?(Z(I.histogram8,e.histogramBindGroup,Y.radixDispatchOffsetBytes,ge),Z(I.scanHistogram8,re,Y.radixDispatchOffsetBytes,1),Z(I.scatter8,e.scatterBindGroup,Y.radixDispatchOffsetBytes,ge)):(Z(P.histogram,e.histogramBindGroup,Y.radixDispatchOffsetBytes,ge),be(V),Z(P.scatter,e.scatterBindGroup,Y.radixDispatchOffsetBytes,ge));Z(P.markHeads,X,Y.radixDispatchOffsetBytes,ge),be(ie),Z(P.scatterUnique,ce,Y.radixDispatchOffsetBytes,ge),me.setPipeline(P.finalizeUnique),me.setBindGroup(0,le),me.dispatchWorkgroups(1,1,1),me.end(),fe&&ue.endEncoderSpan(t,fe);let xe=oe.length,Ce=ve+ye;return Se({schema:n,countAuthoritySchema:r,status:`webgpu-stable-radix-sort-unique-gpu-count-encoded`,elementCount:null,elementCountSource:`authenticated-gpu-authority`,maxElementCount:m,runtimeMaxElementCount:f,generationId:N,generationSeal:j,authorityBuffer:c,authorityCountByteOffset:k,authoritySealByteOffset:M,keyWordCount:S,keyStrideWords:C,radixBitsPerPass:J?8:4,radixPassCount:xe,significantDigitRows:Object.freeze([...G]),sortedIndicesBuffer:se,uniqueHeadFlagsBuffer:_,uniqueGroupIndexBySortedPositionBuffer:v,uniqueKeysBuffer:y,uniqueOffsetsBuffer:D,uniqueEvidenceBuffer:O,uniqueDispatchIndirectBuffer:F,uniqueKeyCapacity:f,uniqueOffsetCapacity:f+1,gpuCountControlBuffer:L,gpuCountControlLayout:Y,histogramScanMode:J?`gpu-count-8bit-single-wg`:V.fusedTopAddEnabled?`gpu-count-fixed-hierarchical-fused-top`:`gpu-count-fixed-hierarchical`,histogramScanFusedTopAddEnabled:J?!1:V.fusedTopAddEnabled,headScanFusedTopAddEnabled:ie.fusedTopAddEnabled,histogramScanEncodedDispatchCount:J?1:V.encodedDispatchCount,headScanEncodedDispatchCount:ie.encodedDispatchCount,encodedDispatchCount:Ce+2,encodedIndirectDispatchCount:ye,encodedDirectDispatchCount:ve+2,encodedComputePassCount:2,fixedMaximumTopology:!0,timestampProducerId:de,executionConcurrency:`single-flight-per-runtime`,inactiveDispatchPolicy:`gpu-count-element-guarded-ceiling-with-indirect-parent-adds`,paramsBufferCreationCount:0,gpuBufferCreationCountDuringEncode:0,bindGroupCreationCount:U.created,bindGroupReuseCount:U.reused,paramsWriteCount:1,paramsSlotIndex:H.slot.slotIndex,paramsBufferResidency:`retained-gpu-count-config-arena`,clearedWordCount:b,gpuCountControlClearedWordCount:Y.controlWordCount,readbackPerformed:!1,transientBuffers:[]},H,{ownedTransientBuffers:[]})}catch(e){throw H.release(),e}}let je=new WeakSet;function Me(e){return Object.freeze({ownedTransientBuffers:ve.get(e)??Object.freeze([]),childPreparedScans:ye.get(e)??Object.freeze([])})}function Ne(e,t=null){if(!e||!pe.has(e))return!1;let n=t??Me(e);for(let{internals:e,prepared:t}of n.childPreparedScans)e.finalizePreparedFromParent(t);let r=[];for(let e of n.ownedTransientBuffers)ce.delete(e)&&r.push(e);return R(r),ve.delete(e),ye.delete(e),!0}function Pe(e){if(!e||typeof e!=`object`||e.schema!==`peercompute.ulg.webgpu-radix-unique.v0`)throw TypeError(`releaseExecution requires a radix/scan/unique execution result`);if(!pe.has(e)){let e=Error(`${a} cannot release an execution owned by another runtime`);throw e.code=`ERR_WEBGPU_RADIX_FOREIGN_EXECUTION`,e}}function Fe(e,t=null){return Pe(e),je.has(e)?!1:(Ne(e,t),fe.get(e)?.release?.(),fe.delete(e),je.add(e),!0)}function Ie(e,{discardedEncoder:t=!1}={}){if(t!==!0)throw TypeError(`${a} releaseExecution is only for a discarded encoder; use releaseExecutionAfter with a submission-fence thenable after submission`);return Fe(e)}function Le(e){return Fe(e)}function Re(e){return!!(e&&typeof e==`object`&&e.schema===`peercompute.ulg.webgpu-radix-unique.v0`&&pe.has(e)&&!je.has(e))}async function $(e,t){if(Pe(e),je.has(e))return!1;let n=Me(e);return await E(t,`releaseExecutionAfter requires a submission-fence thenable`),Fe(e,n)}let ze={schema:n,status:`webgpu-stable-radix-scan-unique-ready`,get pipelineCount(){return Object.keys(t).length+G.pipelineCount+q.pipelineCount},get gpuCountPipelineCount(){return Z?Object.keys(Z.pipelines).length:0},get totalPipelineCount(){return Object.keys(t).length+G.pipelineCount+q.pipelineCount+(Z?Object.keys(Z.pipelines).length:0)},maxElementCount:f,maxKeyWordCount:p,radixBitsPerPass:J?8:4,gpuCountControlLayout:Y,serialHistogramScanMaxElementCount:m,retainedParamsSlotCount:P,variableRetainedScanCounts:N&&c===!0,paramsOffsetAlignment:B,radixParamsSlotStrideBytes:N?re:0,uniqueParamsSlotStrideBytes:N?H:0,prepareGpuCountResources(){let e=xe();return Object.freeze({status:`webgpu-radix-gpu-count-resources-prepared`,pipelineCount:Object.keys(e.pipelines).length,configSlotCount:e.configSlotCount,executionConcurrency:`single-flight-per-runtime`,gpuBufferCreationCountDuringEncode:0,controlBuffer:e.controlBuffer,controlLayout:Y})},encodeSort(e,t={}){if(!N||Number(t.elementCount)===0)return De(e,t);let n=Ce(t.retainedParamsSlotIndex);try{return De(e,t,n)}catch(e){throw n.release(),e}},encodeUnique(e,t={}){if(!N)return ke(e,t);let n=Ce(t.retainedParamsSlotIndex);try{return ke(e,t,n)}catch(e){throw n.release(),e}},encodeSortUnique(e,t={}){let n=N?Ce(t.retainedParamsSlotIndex):null,r=null,i=null;try{let a=t.gpuTimestampRecorder??null,o=typeof t.sortTimestampProducerId==`string`&&t.sortTimestampProducerId.trim()?t.sortTimestampProducerId.trim():`webgpu-stable-radix-sort`,s=typeof t.uniqueTimestampProducerId==`string`&&t.uniqueTimestampProducerId.trim()?t.uniqueTimestampProducerId.trim():`webgpu-sorted-unique`,c=a?.active===!0&&typeof a.beginEncoderSpan==`function`?a.beginEncoderSpan(e,{producerId:o,stage:`sort`,spanClass:`same-grouped-production-compute-pass`,...t.timestampMetadata||{},elementCount:Number(t.elementCount)||0,keyWordCount:Number(t.keyWordCount)||0}):null;r=De(e,t,n),c&&a.endEncoderSpan(e,c);let l=a?.active===!0&&typeof a.beginEncoderSpan==`function`?a.beginEncoderSpan(e,{producerId:s,stage:`unique`,spanClass:`same-grouped-production-compute-pass`,...t.timestampMetadata||{},elementCount:Number(t.elementCount)||0,keyWordCount:Number(t.keyWordCount)||0}):null;i=ke(e,{...t,sortedIndicesBuffer:r.sortedIndicesBuffer},n),l&&a.endEncoderSpan(e,l);let u=[...ve.get(r)??[],...ve.get(i)??[]],d=[...ye.get(r)??[],...ye.get(i)??[]];return Se({...i,status:`webgpu-stable-radix-sort-unique-csr-encoded`,radixPassCount:r.passCount??0,histogramElementCount:r.histogramElementCount??0,histogramScanMode:r.histogramScanMode??`none`,encodedDispatchCount:(r.encodedDispatchCount??0)+(i.encodedDispatchCount??0),encodedComputePassCount:(r.encodedComputePassCount??0)+(i.encodedComputePassCount??0),bindGroupCreationCount:(r.bindGroupCreationCount??0)+(i.bindGroupCreationCount??0),bindGroupReuseCount:(r.bindGroupReuseCount??0)+(i.bindGroupReuseCount??0),paramsBufferCreationCount:(r.paramsBufferCreationCount??0)+(i.paramsBufferCreationCount??0),paramsWriteCount:(r.paramsWriteCount??0)+(i.paramsWriteCount??0),clearedWordCount:i.clearedWordCount??0,transientBuffers:[...u]},n,{ownedTransientBuffers:u,childPreparedScans:d})}catch(e){throw Ne(r),Ne(i),n?.release(),e}},encodeSortUniqueGpuCount:Ae,releaseExecution:Ie,canReleaseExecutionQueueOrdered:Re,releaseExecutionQueueOrdered:Le,releaseExecutionAfter:$,allocationEntries(){return[{role:`radix-sorted-indices-a`,buffer:o},{role:`radix-sorted-indices-b`,buffer:l},{role:`radix-histograms`,buffer:u},{role:`radix-histogram-offsets`,buffer:d},...h?[{role:`radix-histograms-8bit`,buffer:h}]:[],{role:`unique-head-flags`,buffer:_},{role:`unique-head-offsets`,buffer:v},{role:`unique-keys`,buffer:y},{role:`unique-offsets`,buffer:D},{role:`unique-evidence`,buffer:O},{role:`unique-dispatch-indirect`,buffer:F},...I?[{role:`radix-params-retained-arena`,buffer:I}]:[],...ae?[{role:`unique-params-retained-arena`,buffer:ae}]:[],...Z?.allocationEntries??[],...G.allocationEntries(),...q.allocationEntries(),...[...ce].map(e=>({role:`radix-unique-params-transient`,buffer:e}))]},destroy(){if(!be){be=!0,R([o,l,u,d,h,_,v,y,D,O,F,I,ae]),G.destroy(),q.destroy(),Z?.destroy(),Z=null,R([...ce]),ce.clear();for(let e of le)e.inUse=!1,e.bindGroups.clear()}}};return X.commit(),ze}catch(e){throw X.rollback(),e}}const ye=new WeakMap,Z=_.wordCount,be=1+2*Z,xe=Object.freeze({schema:`peercompute.ulg.reaction-residual-ledger.v1`,format:_,headerWords:16,eventWords:32,massOffset:32,energyOffset:32+Z,sourceOffset:32+2*Z,rowWords:32+3*Z}),Se=xe;function Ce(e,t){let n=ye.get(e);if(!n||n.device!==t||!n.committed||n.closed||n.retired)throw TypeError(`Residual ledger requires its original live reaction producer`);return n}function Q(e,{device:t}={}){let n=Ce(e,t);n.readers++;let r=!0;return Object.freeze({record:e,buffer:e.buffer,layout:Se,validate(){if(!r||n.retired)throw TypeError(`Residual ledger read is retired`);return!0},release(){return r?(r=!1,n.readers--,n.retire(),!0):!1}})}const we=`
${h(_)}
${g(_)}
@group(0) @binding(0) var<storage,read> scratch:array<u32>;
@group(0) @binding(1) var<storage,read> events:array<u32>;
@group(0) @binding(2) var<storage,read> plans:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read_write> carrier_energy:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> history:array<atomic<u32>>;
struct Params { particles:u32, capacity:u32, generation:u32, pad:u32 };
@group(0) @binding(5) var<uniform> cfg:Params;
const HEADER:u32=${Se.headerWords}u;
const STRIDE:u32=${Se.rowWords}u;
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
  let packet=8u+cfg.particles+event*${be}u;
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
    atomicStore(&history[at+${Se.massOffset}u+w],mass.words[w]);
    atomicStore(&history[at+${Se.energyOffset}u+w],energy.value.words[w]);
    atomicStore(&history[at+${Se.sourceOffset}u+w],source.value.words[w]);
  }
  atomicAdd(&history[4],1u);
}`;function Te({device:e,capacity:t,generation:n}){let r=(Se.headerWords+Math.max(1,t)*Se.rowWords)*4;if(!Number.isSafeInteger(t)||Object.is(t,-0)||t<0||t>4294967295||!Number.isSafeInteger(n)||Object.is(n,-0)||n<0||n>4294967295||r>e.limits.maxBufferSize||r>e.limits.maxStorageBufferBindingSize||Math.ceil(t/64)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Residual ledger exceeds its declared GPU capacity`);let i=null,a=null,o=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,s=new Set,d={device:e,committed:!1,closed:!1,retired:!1,retiring:!1,readers:0,retire(){if(!this.closed||this.readers||this.retired||this.retiring)return;this.retiring=!0;let e=[];for(let t of[i,a])if(!(!t||s.has(t)))try{t.destroy(),s.add(t)}catch(t){e.push(t)}if(this.retiring=!1,this.retired=e.length===0,e.length)throw AggregateError(e,`Residual ledger retirement failed`)}},h=()=>{let e=!d.closed;return d.closed=!0,d.retire(),e};try{i=p(o?l(e,{bucketKey:`ulg-reaction-residual-ledger`,label:`ulg-reaction-residual-ledger`,size:r,usage:140}):e.createBuffer({label:`ulg-reaction-residual-ledger`,size:r,usage:140}),e);let s=i.destroy.bind(i);if(i.destroy=()=>{if(!d.retiring)throw TypeError(`Residual ledger is retained by its producer or readers`);o?(i.destroy=s,f(e,i,{bucketKey:`ulg-reaction-residual-ledger`,size:r,usage:140})):s()},a=o?l(e,{bucketKey:`ulg-reaction-residual-params`,label:`ulg-reaction-residual-params`,size:16,usage:72}):e.createBuffer({label:`ulg-reaction-residual-params`,size:16,usage:72}),o){let t=a.destroy.bind(a);a.destroy=()=>{a.destroy=t,f(e,a,{bucketKey:`ulg-reaction-residual-params`,size:16,usage:72})}}let g=Object.freeze({device:e,buffer:i,layout:Se,capacity:t,generation:n,physicalPublicationAdmitted:!1});ye.set(g,d);let _=!1;return Object.freeze({destroy:h,encode(s,{scratch:l,events:f,eventPlan:p,energyOutput:h,particleCount:g}){if(_||d.closed)throw TypeError(`Residual ledger must be encoded once`);if(!Number.isSafeInteger(g)||g<1||g>4294967295||[l,f,p,h].some(t=>m(t)!==e)||f.size<t*128||p.size<t*32||l.size<(8+g+Math.max(1,t)*be)*4||h.size<(2*g*Z+4)*4)throw TypeError(`Residual ledger requires the complete original reaction buffers`);o&&s.clearBuffer(i,0,r),e.queue.writeBuffer(a,0,new Uint32Array([g,t,n,0]));for(let n of[`initialize`,`retain_residual`]){let r=c(e,{code:we,entryPoint:n,label:`ulg-reaction-residual-${n}`,cacheKey:`ulg-reaction-residual-v1-${n}`,bindings:[`read-only-storage`,`read-only-storage`,`read-only-storage`,`storage`,`storage`,`uniform`].map((e,t)=>u(t,e))}),o=e.createBindGroup({layout:r.bindGroupLayout,entries:[l,f,p,h,i,a].map((e,t)=>({binding:t,resource:{buffer:e}}))}),d=s.beginComputePass();d.setPipeline(r.pipeline),d.setBindGroup(0,o),d.dispatchWorkgroups(n===`initialize`?1:Math.max(1,Math.ceil(t/64))),d.end()}_=!0},commit(){if(!_||d.closed||d.committed)throw TypeError(`Residual ledger requires one encoded producer`);return d.committed=!0,g}})}catch(e){throw h(),e}}const Ee=new WeakMap;function De(e,{device:t,source:n}={}){let r=Ee.get(e);if(!r||r.device!==t||r.closed||r.retired||!r.finalized||e.sourceHistory!==n)throw TypeError(`Residual history requires its original finalized transport producer`);r.validate(),r.readers++;let i=!0;return Object.freeze({record:e,validate(){if(!i||r.retired)throw TypeError(`Residual transport read is retired`);return r.validate(),!0},forkSourceRead(){return this.validate(),He(r.historyRead,{device:t})},forkCarrierRead(){return this.validate(),r.forkCarrierRead()},release(){return i&&(i=!1,r.readers--),r.retire()}})}var Oe=e({SPH_REACTION_RESIDUAL_HISTORY_ERROR:()=>ze,SPH_REACTION_RESIDUAL_HISTORY_LAYOUT:()=>Re,SPH_REACTION_RESIDUAL_HISTORY_TRANSPORT_REQUIRED:()=>Be,borrowSphReactionResidualHistory:()=>Ve,forkSphReactionResidualHistoryRead:()=>He,prepareSphReactionResidualHistory:()=>Ke,validateSphReactionResidualHistoryCandidate:()=>We});const ke=new WeakMap,Ae=new WeakMap,je=new WeakMap,Me=new WeakMap;function Ne(e,t){let n=Me.get(e);if(n){let e=n.get(t);if(e&&e.length>0)return e.pop()}return ue(e,{maxElementCount:t,retainParamsBuffer:!0,fixedElementCount:t,label:`ulg-reaction-residual-history-scan`})}function Pe(e,t,n){if(!n)return;let r=Me.get(e);r||(r=new Map,Me.set(e,r));let i=r.get(t);i||(i=[],r.set(t,i)),i.length<8?i.push(n):n.destroy()}let Fe=1;const Ie=Math.ceil(xe.rowWords/4)*4,Le=Ie+52,Re=Object.freeze({...xe,schema:`peercompute.ulg.reaction-residual-history.v2`,version:2,headerWords:64,physicalOffset:Ie,stateOffset:Ie,thermoOffset:Ie+8,mechanicsOffset:Ie+20,rowWords:Le,rowBytes:Le*4}),$=Re,ze=1048576,Be=2097152;function Ve(e,{device:t}={}){let n=Ae.get(e);if(!n||n.device!==t||!n.privateLive||n.retired)throw TypeError(`Residual history requires its original live private owner`);return Ue(e,n)}function He(e,{device:t}={}){let n=je.get(e);if(!n||n.device!==t)throw TypeError(`Residual history fork requires its original retained read`);return e.validate(),Ue(e.history,n)}function Ue(e,t){t.readers++;let n=!0,r=Object.freeze({history:e,buffer:e.buffer,transportRecord:t.emittedRead?null:t.transportRead?.record??null,controlBuffer:t.controlBuffer,validate(){if(!n||t.retired)throw TypeError(`Residual history read is retired`);return!0},release(){return n?(n=!1,t.readers--,t.retire(),!0):(t.retire(),!1)}});return je.set(r,t),r}function We(e,t){let n=ke.get(e);if(!n||n.device!==t||n.closed||n.retired)throw TypeError(`Residual history requires its genuine retained producer`);return n.sourceRead?.validate(),n.emittedRead?.validate(),n.transportRead?.validate(),!0}const Ge=`
${h($.format)}
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
const EMIT_HEAD:u32=${xe.headerWords}u;
const EMIT_ROW:u32=${xe.rowWords}u;
const MAGIC:u32=0x50484731u;
fn fail(){atomicOr(&control[2],${ze}u);}
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
  if(source_count()!=0u || output[3]!=0u){atomicOr(&control[2],${Be}u);}
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
}`;function Ke({device:e,source:t=null,emitted:n=null,transported:r=null,capacity:i=null,controlBuffer:a}){if(r&&!t)throw TypeError(`Residual transport requires its original history`);if(!t&&!n)return null;let o=null,s=null,h=null,g=null,_=null,v=0,y=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,b=new Set,x=new Set,S=new Set,C=new Map,w=()=>{if(!g)return;let t=g;g=null,y&&v>0?Pe(e,v,t):t.destroy()},T={device:e,closed:!1,privateLive:!1,retired:!1,retiring:!1,producerStageRetired:!1,readers:0,sourceRead:null,emittedRead:null,transportRead:null,controlBuffer:null,releaseProducerStage(){if(!this.closed||this.producerStageRetired||this.retired||this.retiring)return;this.retiring=!0;let e=[];for(let t of b)if(!(x.has(t)||S.has(t)))try{t.destroy(),S.add(t)}catch(t){e.push(t)}if(this.retiring=!1,e.length)throw AggregateError(e,`Residual history retirement failed`);this.producerStageRetired=!0,w(),o?.release(),s?.release()},retire(){if(!this.closed||this.retired||this.retiring)return;if(this.privateLive||this.readers){this.releaseProducerStage();return}this.retiring=!0;let e=[];for(let t of b)if(!S.has(t))try{t.destroy(),S.add(t)}catch(t){e.push(t)}if(this.retiring=!1,e.length)throw AggregateError(e,`Residual history retirement failed`);this.producerStageRetired=!0,w(),o?.release(),s?.release(),h?.release(),this.retired=!0}},E=()=>{let e=!T.closed;return T.closed=!0,T.retire(),e},D=(t,n=null)=>{b.add(t),n&&C.set(t,n);let r=t.destroy.bind(t);return t.destroy=()=>{if(S.has(t))return;if(!T.retiring)throw TypeError(`Residual history storage is retained`);let n=C.get(t);n?(t.destroy=r,f(e,t,n)):r(),S.add(t)},t},O=(t,n,r)=>{if(y){let i={bucketKey:t,size:n,usage:r};return D(p(l(e,{bucketKey:t,label:t,size:n,usage:r}),e),i)}return D(p(e.createBuffer({label:t,size:n,usage:r}),e))};try{h=r?De(r,{device:e,source:t}):null,o=h?h.forkSourceRead():t?Ve(t,{device:e}):null,s=n?Q(n,{device:e}):null,T.sourceRead=o,T.emittedRead=s,T.transportRead=h;let l=Math.floor((Math.min(e.limits.maxBufferSize,e.limits.maxStorageBufferBindingSize)-$.headerWords*4)/$.rowBytes),f=i??t?.capacity??Math.min(l,Math.max(64,(n?.capacity??0)*8)),p=n?.capacity??0,b=Math.max(1,p),S=(t?.generation??0)+1,C=Fe++;if(!Number.isSafeInteger(f)||f<1||f>l||f<(t?.capacity??0)||S>4294967295||!Number.isSafeInteger(C)||C>4294967295||Math.ceil(Math.max(f,t?.capacity??0,b)/64)>e.limits.maxComputeWorkgroupsPerDimension||m(a)!==e||a.size<12||!(a.usage&128))throw RangeError(`Residual history requires bounded same-device storage and count identities`);_=O(`ulg-reaction-residual-history`,($.headerWords+f*$.rowWords)*4,140),x.add(_),h&&(T.controlBuffer=O(`ulg-reaction-residual-history-verdict`,12,140),x.add(T.controlBuffer));let w=O(`ulg-reaction-residual-live-flags`,b*4,140),k=O(`ulg-reaction-residual-live-prefix`,b*4,140),A=O(`ulg-reaction-residual-history-identities`,48,72);if(e.queue.writeBuffer(A,0,new Uint32Array([f,t?.capacity??0,p,+!!t,t?.generation??0,t?.seal??0,S,C,n?.generation??0,+!!n,b,+!!h])),v=b,y)g=Ne(e,b);else{g=ue(e,{maxElementCount:b,retainParamsBuffer:!0,fixedElementCount:b,label:`ulg-reaction-residual-history-scan`});for(let{buffer:e}of g.allocationEntries())D(e)}let j=Object.freeze({device:e,buffer:_,layout:$,capacity:f,generation:S,seal:C,beforeBuffer:o?.buffer??null,beforeCapacity:t?.capacity??0,beforeGeneration:t?.generation??0,beforeSeal:t?.seal??0,physicalPublicationAdmitted:!1});ke.set(j,T);let M=[`read-only-storage`,`read-only-storage`,`storage`,`read-only-storage`,`storage`,`storage`,`uniform`,`read-only-storage`,`read-only-storage`],N=o?.buffer??s.buffer,ee=[N,s?.buffer??o.buffer,w,k,_,a,A,r?.buffer??N,r?.controlBuffer??N],P=Object.fromEntries([`initialize`,`mark_rows`,`decide`,`scatter`,`check`,`require_empty`,`restore_rows`,`restore_count`].map(t=>{let n=c(e,{code:Ge,entryPoint:t,label:`ulg-residual-history-${t}`,cacheKey:`ulg-residual-history-v${$.version}-${t}`,bindings:M.map((e,t)=>u(t,e))}),r=d(e,{layout:n.bindGroupLayout,entries:ee.map((e,t)=>({binding:t,resource:{buffer:e}}))});return[t,(e,t)=>{let i=e.beginComputePass();i.setPipeline(n.pipeline),i.setBindGroup(0,r),i.dispatchWorkgroups(t),i.end()}]})),F=Math.ceil(Math.max(t?.capacity??0,b)/64),I=!1,L=!1,R=!1,z=()=>We(j,e),B=()=>{if(z(),!I)throw TypeError(`Residual history was not encoded`)};return Object.freeze({record:j,destroy:E,encode(e){if(z(),I)throw TypeError(`Residual history must be encoded once`);y&&(e.clearBuffer(_),e.clearBuffer(w),e.clearBuffer(k),T.controlBuffer&&e.clearBuffer(T.controlBuffer)),P.initialize(e,1),P.mark_rows(e,F);let t=g.encode(e,{inputBuffer:w,outputBuffer:k,elementCount:b});g.releasePreparedQueueOrdered(t),P.decide(e,1),P.scatter(e,F),I=!0},check(e){B(),P.check(e,F)},requireEmptyForMechanics(e){B(),P.require_empty(e,1)},restore(e){if(B(),L)throw TypeError(`Residual history was already finalized`);P.restore_rows(e,Math.ceil(f/64)),P.restore_count(e,1),T.controlBuffer&&e.copyBufferToBuffer(a,0,T.controlBuffer,0,12),L=!0},transfer(){if(B(),!L||R)throw TypeError(`Residual history requires one finalized handover`);R=!0,T.privateLive=!0;let t=Object.freeze({device:e,buffer:_,layout:$,capacity:f,generation:S,seal:C});return Ae.set(t,T),Object.freeze({history:t,destroy(){let e=T.privateLive;return T.privateLive=!1,T.retire(),e}})}})}catch(e){throw E(),e}}export{Oe as a,Te as c,Ke as i,ve as l,Re as n,We as o,Ve as r,be as s,ze as t,ue as u};