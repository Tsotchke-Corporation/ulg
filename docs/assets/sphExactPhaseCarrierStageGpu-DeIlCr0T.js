import{Ov as e,St as t,bt as n,j as r,ww as i}from"./sphReactionLineageGpu-BMboVLBV.js";import{Jd as a,N as o,Vd as s,Yd as c,j as l,kt as u}from"./sphGpuBuffers-CEDwd_gU.js";import{computeBufferBinding as d,deferConfirmedSubmittedWorkCleanup as f,prewarmCachedExplicitComputePipeline as p}from"../runtime/webgpuComputeLayout.js";import{s as m,t as h}from"./sphExactMassInventory-RqW1sZ8d.js";import{t as g}from"./sphExactMassWgsl-_uZ_GwYN.js";function _(e){return g(e)+`
const PC_LAYOUT: u32 = 0x01000000u;
const PC_FRACTION: u32 = 0x02000000u;
const PC_MATERIAL: u32 = 0x04000000u;
const PC_RATIO_CAPACITY: u32 = 0x08000000u;
const PC_CONSERVATION: u32 = 0x10000000u;
@group(0) @binding(0) var<storage, read> pc_mass: array<u32>;
@group(0) @binding(1) var<storage, read> pc_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pc_packets: array<u32>;
@group(0) @binding(3) var<storage, read_write> pc_sum: array<u32>;
@group(0) @binding(4) var<storage, read_write> pc_output: array<u32>;
@group(0) @binding(5) var<storage, read_write> pc_control: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> pc_shape: vec4<u32>;

fn pc_valid_layout() -> bool {
  let rows = pc_shape.x * 4u;
  return pc_shape.x > 0u && rows / 4u == pc_shape.x && pc_shape.y == rows
    && pc_shape.z == 0u && pc_shape.w == 0u
    && arrayLength(&pc_control) == 4u
    && arrayLength(&pc_mass) == rows * EM_WORDS
    && arrayLength(&pc_thermo) == rows * 3u
    && arrayLength(&pc_packets) == rows * 4u * EM_WORDS
    && arrayLength(&pc_sum) == rows * EM_WORDS
    && arrayLength(&pc_output) == rows * EM_WORDS;
}
fn pc_load_mass(row: u32) -> ExactMass {
  var mass: ExactMass;
  for (var limb = 0u; limb < EM_WORDS; limb++) { mass.words[limb] = pc_mass[row * EM_WORDS + limb]; }
  return mass;
}
fn pc_fraction_exponent(bits: u32) -> i32 {
  let encoded = (bits >> 23u) & 255u;
  return select(-149, i32(encoded) - 150, encoded != 0u);
}
fn pc_fraction_weight(bits: u32, common_exponent: i32) -> ExactMassResult {
  var weight = ExactMass();
  if ((bits & 0x7fffffffu) == 0u) { return ExactMassResult(weight, 0u); }
  let encoded = (bits >> 23u) & 255u;
  let coefficient = (bits & 0x7fffffu) | select(0u, 0x800000u, encoded != 0u);
  let shift = pc_fraction_exponent(bits) - common_exponent;
  if (shift < 0 || shift + 31 - i32(countLeadingZeros(coefficient)) >= i32(EM_WORDS * 32u)) {
    return ExactMassResult(weight, PC_RATIO_CAPACITY);
  }
  let word = u32(shift) / 32u; let within = u32(shift) % 32u;
  weight.words[word] = coefficient << within;
  if (within != 0u && word + 1u < EM_WORDS) { weight.words[word + 1u] = coefficient >> (32u - within); }
  return ExactMassResult(weight, 0u);
}

@compute @workgroup_size(32)
fn select_phase_packets(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= pc_shape.x) { return; }
  if (!pc_valid_layout()) { atomicOr(&pc_control[0], PC_LAYOUT); return; }
  var lineage_material = 0.0;
  for (var source_lane = 0u; source_lane < 4u; source_lane++) {
    let row = source_lane * pc_shape.x + id.x;
    for (var i = 0u; i < 4u * EM_WORDS; i++) { pc_packets[row * 4u * EM_WORDS + i] = 0u; }
    let mass = pc_load_mass(row);
    if (em_zero(mass)) { continue; }
    atomicAdd(&pc_control[1], 1u);
    let material = pc_thermo[row * 3u].x;
    if (!(material >= 1.0 && material <= 16777215.0) || material != floor(material)
        || (lineage_material != 0.0 && lineage_material != material)) {
      atomicOr(&pc_control[0], PC_MATERIAL); continue;
    }
    lineage_material = material;
    let fractions = pc_thermo[row * 3u + 1u];
    var positive = 0u; var first_phase = 0u; var last_phase = 0u;
    var common_exponent = 0; var sum = 0.0; var invalid = false;
    for (var phase = 0u; phase < 4u; phase++) {
      let fraction = fractions[phase];
      let bits = bitcast<u32>(fraction); let magnitude = bits & 0x7fffffffu;
      if (magnitude > 0x3f800000u || ((bits >> 31u) != 0u && magnitude != 0u)) { invalid = true; }
      sum += fraction;
      if (magnitude != 0u) {
        let exponent = pc_fraction_exponent(bits);
        common_exponent = select(min(common_exponent, exponent), exponent, positive == 0u);
        if (positive == 0u) { first_phase = phase; }
        last_phase = phase;
        positive++;
      }
    }
    if (invalid || positive == 0u || positive > 2u || abs(sum - 1.0) > 0.0000001) {
      atomicOr(&pc_control[0], PC_FRACTION); continue;
    }
    // Admission above allows at most two positive phases. A pure phase owns
    // the whole integer packet. For a pair, cumulative allocation is exactly
    // floor(M*w_first/(w_first+w_last)) and its integer remainder. This needs
    // one ratio evaluation instead of evaluating both ends of all four lanes.
    if (positive == 1u) {
      for (var limb = 0u; limb < EM_WORDS; limb++) {
        pc_packets[(row * 4u + first_phase) * EM_WORDS + limb] = mass.words[limb];
      }
      atomicAdd(&pc_control[2], 1u); continue;
    }
    let first_weight = pc_fraction_weight(bitcast<u32>(fractions[first_phase]), common_exponent);
    let last_weight = pc_fraction_weight(bitcast<u32>(fractions[last_phase]), common_exponent);
    let denominator = em_add(first_weight.value, last_weight.value);
    var error = first_weight.error | last_weight.error | denominator.error;
    if (error != 0u) { atomicOr(&pc_control[0], error | PC_RATIO_CAPACITY); continue; }
    let first = em_multiply_ratio(mass, first_weight.value, denominator.value);
    let last = em_subtract(mass, first.value);
    let allocated = em_add(first.value, last.value);
    error |= first.error | last.error | allocated.error;
    for (var limb = 0u; limb < EM_WORDS; limb++) {
      pc_packets[(row * 4u + first_phase) * EM_WORDS + limb] = first.value.words[limb];
      pc_packets[(row * 4u + last_phase) * EM_WORDS + limb] = last.value.words[limb];
    }
    if (!em_zero(first.value)) { atomicAdd(&pc_control[2], 1u); }
    if (!em_zero(last.value)) { atomicAdd(&pc_control[2], 1u); }
    if (em_compare(allocated.value, mass) != 0) { error |= PC_CONSERVATION; }
    if (error != 0u) { atomicOr(&pc_control[0], error); }
  }
}

@compute @workgroup_size(32)
fn gather_phase_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= pc_shape.y || !pc_valid_layout() || atomicLoad(&pc_control[0]) != 0u) { return; }
  let lineage = id.x % pc_shape.x; let target_phase = id.x / pc_shape.x;
  var mass: ExactMass; var error = 0u;
  for (var source = 0u; source < 4u; source++) {
    let row = source * pc_shape.x + lineage; var packet: ExactMass;
    for (var limb = 0u; limb < EM_WORDS; limb++) {
      packet.words[limb] = pc_packets[(row * 4u + target_phase) * EM_WORDS + limb];
    }
    let total = em_add(mass, packet); mass = total.value; error |= total.error;
  }
  for (var limb = 0u; limb < EM_WORDS; limb++) { pc_sum[id.x * EM_WORDS + limb] = mass.words[limb]; }
  if (error != 0u) { atomicOr(&pc_control[0], error); }
}

@compute @workgroup_size(32)
fn commit_phase_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= pc_shape.y || !pc_valid_layout()) { return; }
  let accepted = atomicLoad(&pc_control[0]) == 0u;
  for (var limb = 0u; limb < EM_WORDS; limb++) {
    let at = id.x * EM_WORDS + limb;
    pc_output[at] = select(pc_mass[at], pc_sum[at], accepted);
    if (!accepted) {
      for (var phase = 0u; phase < 4u; phase++) { pc_packets[(id.x * 4u + phase) * EM_WORDS + limb] = 0u; }
    }
  }
}
`}async function v({device:e,format:n,lineageCapacity:r,sourceMassBuffer:i,sourceThermoBuffer:a,allocate:o,validate:s}){if(m(n),typeof o!=`function`||typeof s!=`function`)throw TypeError(`Phase mass preparation requires producer allocation and validation`);s();let c=r*4,l=c*n.wordCount*4,u=l*4;if(!Number.isSafeInteger(r)||r<1||c>4294967295||!Number.isSafeInteger(u)||u/4>4294967295||u>e.limits.maxStorageBufferBindingSize||u>e.limits.maxBufferSize||Math.ceil(c/32)>e.limits.maxComputeWorkgroupsPerDimension||e.limits.maxStorageBuffersPerShaderStage<6||i?.size!==l||a?.size!==c*48||[i,a].some(n=>t(n)!==e||(n.usage&128)==0))throw RangeError(`Phase mass requires complete same-device four-lane inputs within capacity`);let f=(e,t,n=140)=>o({label:`ulg-exact-phase-${e}`,size:t,usage:n}),h=f(`packets`,u),g=f(`sum`,l),v=f(`mass`,l),y=f(`validation`,16),b=f(`params`,16,72);e.queue.writeBuffer(b,0,new Uint32Array([r,c,0,0]));let x=_(n),S=[`read-only-storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`,`uniform`],C=[i,a,h,g,v,y,b],w=[];for(let t of[`select_phase_packets`,`gather_phase_mass`,`commit_phase_mass`]){let r=await p(e,{code:x,entryPoint:t,cacheKey:`ulg-exact-phase-mass-v4:${n.wordCount}:${n.quantumExponent}:${t}`,label:`ulg-exact-phase-${t}`,bindings:S.map((e,t)=>d(t,e))});if(!r.pipeline)throw r.error??Error(`Phase mass pipeline unavailable: ${t}`);s(),w.push({pipeline:r.pipeline,bindGroup:e.createBindGroup({layout:r.bindGroupLayout,entries:C.map((e,t)=>({binding:t,resource:{buffer:e}}))})})}return Object.freeze({massBuffer:v,packetMassBuffer:h,validationBuffer:y,particleCount:c,format:n,transientBuffers:Object.freeze([g,b]),encode(e){s(),e.clearBuffer(y);for(let t=0;t<w.length;t++){let n=e.beginComputePass({label:`ulg-exact-phase-mass-${t}`});n.setPipeline(w[t].pipeline),n.setBindGroup(0,w[t].bindGroup),n.dispatchWorkgroups(Math.ceil((t===0?r:c)/32)),n.end()}}})}async function y({device:e,format:t,layout:n,sourceQuantityBuffer:i,packetMassBuffer:a,candidateMassBuffer:o,geometryBuffer:s,validationBuffer:c,lineageCapacity:l,allocate:u,validate:f}){f();let m=l*4,g=n.scalar.recordWords,_=n.recordWords,v=e.limits.minUniformBufferOffsetAlignment,y=m*_*4,b=m*24*g*4,x=m*16*g*4,S=(4+m*2)*4;if(n.rowCount!==m||n.massOffsetWords!==16||n.scalarOffsetWords!==16+t.wordCount||y!==i.size||a.size!==m*4*t.wordCount*4||o.size!==m*t.wordCount*4||s.size!==m*32||![y,b,x,S].every(t=>Number.isSafeInteger(t)&&t<=e.limits.maxStorageBufferBindingSize&&t<=e.limits.maxBufferSize)||Math.ceil(m*8/32)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Exact phase quantities require complete four-lane records within device capacity`);let C=[],w=(e,t,n,r,i,a)=>C.push({mode:e,phase:t,instruction:[n,r,i,a]}),T=(e,t,n,r)=>w(0,0,e,t,n,r);T(2,1,1,12),T(2,2,2,13),T(0,12,13,12),T(2,3,3,13),T(0,12,13,12),T(0,0,0,13),T(3,12,13,14),T(3,14,0,14);let E=C.length,D=[];for(let e=0;e<4;e++){let t=C.length,n=(t,n,r,i)=>w(1,e,t,n,r,i);n(3,5,0,15);for(let e=0;e<3;e++)n(2,e+1,15,e+17);n(0,6,14,16),n(2,5,16,20),D.push([t,C.length]);for(let e=0;e<4;e++)n(1,e+7,e+17,e+7)}let O=C.length,k=(e,t,n,r)=>w(2,0,e,t,n,r);k(2,1,1,12),k(2,2,2,13),k(0,12,13,12),k(2,3,3,13),k(0,12,13,12),k(0,0,0,13),k(3,12,13,14),k(1,4,14,16),k(3,16,0,16);for(let e=0;e<3;e++)k(3,e+1,0,e+17);k(3,0,5,9),k(3,6,7,8),k(2,9,8,10);let A=(e,t,n=140)=>u({label:`ulg-exact-phase-${e}`,size:t,usage:n}),ee=A(`quantities`,y),te=A(`quantity-scratch`,b),j=A(`packet-quantities`,x),M=A(`projection`,m*32),N=A(`quantity-params`,v*(C.length+6),72),P=A(`quantity-operations`,v*C.length,72),F=A(`quantity-normalization-queue`,S),I=A(`quantity-normalization-dispatch`,12,264),L=new Uint32Array(N.size/4),R=new Uint32Array(P.size/4);C.forEach((e,t)=>{L.set([m,l,e.mode,e.phase],t*v/4),R.set(e.instruction,t*v/4)});for(let e=0;e<6;e++)L.set([m,l,e===5?2:e===0?0:1,Math.max(0,e-1)],(C.length+e)*v/4);e.queue.writeBuffer(N,0,L),e.queue.writeBuffer(P,0,R);let z=`
@group(0) @binding(0) var<storage, read> pq_source: array<u32>;
@group(0) @binding(1) var<storage, read> pq_mass_packets: array<u32>;
@group(0) @binding(2) var<storage, read> pq_mass: array<u32>;
@group(0) @binding(3) var<storage, read> pq_geometry: array<u32>;
@group(0) @binding(4) var<storage, read_write> pq_scratch: array<u32>;
@group(0) @binding(5) var<storage, read_write> pq_packets: array<u32>;
@group(0) @binding(6) var<storage, read_write> pq_output: array<u32>;
@group(0) @binding(7) var<storage, read_write> pq_projection: array<u32>;
@group(0) @binding(8) var<storage, read_write> pq_validation: array<atomic<u32>>;
@group(0) @binding(9) var<uniform> pq_params: vec4<u32>;
@group(0) @binding(10) var<uniform> pq_op: vec4<u32>;
@group(0) @binding(11) var<storage, read_write> pq_normalization: array<atomic<u32>>;
fn pq_at(row: u32, slot: u32) -> u32 { return (row * 24u + slot) * ${g}u; }
fn pq_load(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = pq_at(row, slot);
  (*v).negative = pq_scratch[at]; (*v).error = pq_scratch[at + 1u];
  (*v).exponent = bitcast<i32>(pq_scratch[at + 2u]); (*v).reserved = pq_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { (*v).numerator[i] = pq_scratch[at + 4u + i]; (*v).denominator[i] = pq_scratch[at + 4u + XR_WORDS + i]; }
}
fn pq_store(row: u32, slot: u32, v: ptr<function, ExactRational>) {
  let at = pq_at(row, slot); pq_scratch[at] = (*v).negative; pq_scratch[at + 1u] = (*v).error;
  pq_scratch[at + 2u] = bitcast<u32>((*v).exponent); pq_scratch[at + 3u] = (*v).reserved;
  for (var i = 0u; i < XR_WORDS; i++) { pq_scratch[at + 4u + i] = (*v).numerator[i]; pq_scratch[at + 4u + XR_WORDS + i] = (*v).denominator[i]; }
  if ((*v).error != 0u) { atomicOr(&pq_validation[0], (*v).error); }
}
fn pq_source_scalar(row: u32, field: u32, v: ptr<function, ExactRational>) {
  let at = row * ${_}u + ${n.scalarOffsetWords}u + field * ${g}u;
  (*v).negative = pq_source[at]; (*v).error = pq_source[at + 1u]; (*v).exponent = bitcast<i32>(pq_source[at + 2u]); (*v).reserved = pq_source[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { (*v).numerator[i] = pq_source[at + 4u + i]; (*v).denominator[i] = pq_source[at + 4u + XR_WORDS + i]; }
}
fn pq_active(row: u32) -> bool {
  var mass = 0u;
  for (var i = 0u; i < ${t.wordCount}u; i++) { mass |= select(pq_source[row * ${_}u + 16u + i], pq_mass[row * ${t.wordCount}u + i], pq_params.z == 2u); }
  return mass != 0u;
}
fn pq_packet_active(row: u32, phase: u32) -> bool {
  var mass = 0u; for (var i = 0u; i < ${t.wordCount}u; i++) { mass |= pq_mass_packets[(row * 4u + phase) * ${t.wordCount}u + i]; }
  return mass != 0u;
}
fn pq_clear_scratch(row: u32) {
  for (var i = 0u; i < ${24*g}u; i++) { pq_scratch[pq_at(row, 0u) + i] = 0u; }
  for (var slot = 0u; slot < 24u; slot++) { pq_scratch[pq_at(row, slot) + 4u + XR_WORDS] = 1u; }
}
fn pq_zero_scalar(row: u32, slot: u32, error: u32) {
  let at = pq_at(row, slot);
  for (var i = 0u; i < ${g}u; i++) { pq_scratch[at + i] = 0u; }
  pq_scratch[at + 1u] = error; pq_scratch[at + 4u + XR_WORDS] = 1u;
  if (error != 0u) { atomicOr(&pq_validation[0], error); }
}
// Zero and power-of-two denominators need no wide GCD temporaries. Check
// the same input headers and exponent adjustment before changing any words.
fn pq_normalize_dyadic(row: u32, slot: u32) -> bool {
  let at = pq_at(row, slot); var nt = XR_WORDS * 32u; var dt = nt; var denominator_bits = 0u;
  for (var i = 0u; i < XR_WORDS; i++) {
    let n = pq_scratch[at + 4u + i]; let d = pq_scratch[at + 4u + XR_WORDS + i];
    if (n != 0u && nt == XR_WORDS * 32u) { nt = i * 32u + countTrailingZeros(n); }
    if (d != 0u && dt == XR_WORDS * 32u) { dt = i * 32u + countTrailingZeros(d); }
    denominator_bits += countOneBits(d);
  }
  var error = pq_scratch[at + 1u];
  if (pq_scratch[at] > 1u || pq_scratch[at + 3u] != 0u
      || (nt == XR_WORDS * 32u && pq_scratch[at] != 0u)) { error |= ${h.INVALID_RATIO}u; }
  if (denominator_bits == 0u) { error |= ${h.DIVISION_BY_ZERO}u; }
  if (error != 0u || nt == XR_WORDS * 32u) { pq_zero_scalar(row, slot, error); return true; }
  if (denominator_bits != 1u) { return false; }
  let exponent = xr_exponent_add(bitcast<i32>(pq_scratch[at + 2u]), i32(nt) - i32(dt));
  if (exponent.error != 0u) { pq_zero_scalar(row, slot, exponent.error); return true; }
  let whole = nt / 32u; let part = nt % 32u;
  // Ascending writes read only their own or higher untouched numerator words.
  for (var i = 0u; i < XR_WORDS; i++) {
    let source = i + whole; var word = 0u;
    if (source < XR_WORDS) {
      word = pq_scratch[at + 4u + source] >> part;
      if (part != 0u && source + 1u < XR_WORDS) { word |= pq_scratch[at + 5u + source] << (32u - part); }
    }
    pq_scratch[at + 4u + i] = word;
    pq_scratch[at + 4u + XR_WORDS + i] = select(0u, 1u, i == 0u);
  }
  pq_scratch[at + 2u] = bitcast<u32>(exponent.value);
  return true;
}
fn pq_scalar_zero(row: u32, slot: u32) -> bool {
  let at = pq_at(row, slot); var bits = 0u;
  for (var i = 0u; i < XR_WORDS; i++) { bits |= pq_scratch[at + 4u + i]; }
  return bits == 0u;
}
fn pq_copy_scalar(row: u32, destination: u32, source: u32, negate: bool) {
  let source_at = pq_at(row, source); let destination_at = pq_at(row, destination); let sign = pq_scratch[source_at];
  for (var i = 0u; i < ${g}u; i++) { pq_scratch[destination_at + i] = pq_scratch[source_at + i]; }
  pq_scratch[destination_at] = sign ^ select(0u, 1u, negate);
}
// Inputs passed the preceding normalization barrier. These exact identities
// avoid creating private wide arrays for zero momentum/energy components.
fn pq_zero_operation(row: u32) -> bool {
  let az = pq_scalar_zero(row, pq_op.y); let bz = pq_scalar_zero(row, pq_op.z);
  if (pq_op.x <= 1u) {
    if (az) { pq_copy_scalar(row, pq_op.w, pq_op.z, pq_op.x == 1u && !bz); return true; }
    if (bz) { pq_copy_scalar(row, pq_op.w, pq_op.y, false); return true; }
  }
  if (pq_op.x == 2u && (az || bz)) { pq_zero_scalar(row, pq_op.w, 0u); return true; }
  if (pq_op.x == 3u && (az || bz)) {
    pq_zero_scalar(row, pq_op.w, select(0u, ${h.DIVISION_BY_ZERO}u, bz)); return true;
  }
  return false;
}
@compute @workgroup_size(32)
fn prepare_phase_source(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x) { return; } pq_clear_scratch(row);
  for (var i = 0u; i < ${16*g}u; i++) { pq_packets[row * ${16*g}u + i] = 0u; }
  for (var field = 0u; field < 16u; field++) { pq_packets[(row * 16u + field) * ${g}u + 4u + XR_WORDS] = 1u; }
  if (!pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  if (pq_source[row * ${_}u] != 1u || pq_source[row * ${_}u + 1u] != 0u) { atomicOr(&pq_validation[0], 1u); return; }
  // These are serialized copies, not arithmetic. Scratch clearing established
  // the zero headers and unit denominators; avoid materializing wide private
  // rational temporaries merely to copy their words back to storage.
  let mass_at = pq_at(row, 0u);
  pq_scratch[mass_at + 2u] = bitcast<u32>(${t.quantumExponent}i);
  for (var i = 0u; i < ${t.wordCount}u; i++) {
    pq_scratch[mass_at + 4u + i] = pq_source[row * ${_}u + 16u + i];
  }
  for (var field = 0u; field < 4u; field++) {
    let source_at = row * ${_}u + ${n.scalarOffsetWords}u + field * ${g}u;
    let value_at = pq_at(row, field + 1u); let remaining_at = pq_at(row, field + 7u);
    for (var i = 0u; i < ${g}u; i++) {
      let word = pq_source[source_at + i]; pq_scratch[value_at + i] = word; pq_scratch[remaining_at + i] = word;
    }
    if (pq_source[source_at + 1u] != 0u) { atomicOr(&pq_validation[0], pq_source[source_at + 1u]); }
  }
}
@compute @workgroup_size(32)
fn seed_phase_packet(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var mass = xr_zero(); mass.exponent = ${t.quantumExponent}i;
  for (var i = 0u; i < ${t.wordCount}u; i++) { mass.numerator[i] = pq_mass_packets[(row * 4u + pq_params.w) * ${t.wordCount}u + i]; }
  pq_store(row, 5u, &mass); var u = xr_zero();
  if (pq_packet_active(row, pq_params.w)) { xrp_from_f32_bits(&u, pq_geometry[row * 8u + pq_params.w]); }
  pq_store(row, 6u, &u);
}
@compute @workgroup_size(32)
fn initialize_phase_quantity_normalization(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x != 0u) { return; }
  atomicStore(&pq_normalization[0], 0u); atomicStore(&pq_normalization[1], 0u);
  atomicStore(&pq_normalization[2], 1u); atomicStore(&pq_normalization[3], 1u);
}
@compute @workgroup_size(32)
fn normalize_phase_quantity_operands(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 2u; let operand = id.x % 2u;
  if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  // Equal input slots have one writer. Distinct slots are independent until
  // the following arithmetic pass, including operations that overwrite one.
  if (operand == 1u && pq_op.y == pq_op.z) { return; }
  let slot = select(pq_op.y, pq_op.z, operand == 1u);
  if (pq_normalize_dyadic(row, slot)) { return; }
  let index = atomicAdd(&pq_normalization[0], 1u);
  atomicStore(&pq_normalization[4u + index], id.x);
  atomicMax(&pq_normalization[1], (index + 32u) / 32u);
}
@compute @workgroup_size(32)
fn normalize_phase_quantity_general(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= atomicLoad(&pq_normalization[0]) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  let encoded = atomicLoad(&pq_normalization[4u + id.x]);
  let row = encoded / 2u; let slot = select(pq_op.y, pq_op.z, encoded % 2u == 1u);
  var source: ExactRational; var canonical: ExactRational;
  pq_load(row, slot, &source); xrp_normalize(&canonical, &source);
  pq_store(row, slot, &canonical);
}
@compute @workgroup_size(32)
fn prepare_phase_quantity_operation(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  if (pq_zero_operation(row)) { return; }
  let index = atomicAdd(&pq_normalization[0], 1u);
  atomicStore(&pq_normalization[4u + index], row);
  atomicMax(&pq_normalization[1], (index + 32u) / 32u);
}
@compute @workgroup_size(32)
fn execute_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= atomicLoad(&pq_normalization[0]) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  let row = atomicLoad(&pq_normalization[4u + id.x]);
  var a: ExactRational; var b: ExactRational; var v: ExactRational;
  pq_load(row, pq_op.y, &a); pq_load(row, pq_op.z, &b);
  switch pq_op.x {
    case 0u: { xrp_rational_add(&v, &a, &b); }
    case 1u: { xrp_rational_subtract(&v, &a, &b); }
    case 2u: { xrp_rational_multiply(&v, &a, &b); }
    case 3u: { xrp_rational_divide(&v, &a, &b); }
    default: { xrp_failure(&v, 1u); }
  }
  pq_store(row, pq_op.w, &v);
}
@compute @workgroup_size(32)
fn store_phase_packet(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var last_phase = 0u; for (var phase = 0u; phase < 4u; phase++) { if (pq_packet_active(row, phase)) { last_phase = phase; } }
  for (var field = 0u; field < 4u; field++) {
    if (pq_params.w == last_phase) {
      var value: ExactRational; pq_load(row, field + 7u, &value); pq_store(row, field + 17u, &value);
    }
    let at = pq_at(row, field + 17u); let destination = ((row * 4u + pq_params.w) * 4u + field) * ${g}u;
    for (var i = 0u; i < ${g}u; i++) { pq_packets[destination + i] = pq_scratch[at + i]; }
  }
}
@compute @workgroup_size(32)
fn prepare_phase_target(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x) { return; } pq_clear_scratch(row);
  if (!pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var mass = xr_zero(); mass.exponent = ${t.quantumExponent}i;
  for (var i = 0u; i < ${t.wordCount}u; i++) { mass.numerator[i] = pq_mass[row * ${t.wordCount}u + i]; }
  pq_store(row, 0u, &mass); var density = xr_zero(); xrp_from_f32_bits(&density, pq_geometry[row * 8u + 6u]); pq_store(row, 5u, &density);
  let template_row = pq_geometry[row * 8u + 4u];
  if (template_row >= pq_params.x) { atomicOr(&pq_validation[0], 1u); return; }
  if (pq_geometry[row * 8u + 5u] == 1u) {
    var current: ExactRational; var reference: ExactRational;
    pq_source_scalar(template_row, 5u, &current); pq_source_scalar(template_row, 4u, &reference);
    pq_store(row, 6u, &current); pq_store(row, 7u, &reference);
  } else {
    var one = xr_zero(); one.numerator[0] = 1u; pq_store(row, 6u, &one); pq_store(row, 7u, &one);
  }
}
@compute @workgroup_size(32)
fn gather_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 4u; let field = id.x % 4u;
  if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  var sum = xr_zero();
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * pq_params.y + row % pq_params.y;
    let at = ((source_row * 4u + row / pq_params.y) * 4u + field) * ${g}u;
    var value = xr_zero(); value.negative = pq_packets[at]; value.error = pq_packets[at + 1u];
    value.exponent = bitcast<i32>(pq_packets[at + 2u]); value.reserved = pq_packets[at + 3u];
    for (var i = 0u; i < XR_WORDS; i++) { value.numerator[i] = pq_packets[at + 4u + i]; value.denominator[i] = pq_packets[at + 4u + XR_WORDS + i]; }
    var combined = xr_zero(); xrp_rational_add(&combined, &sum, &value); xrp_rational_copy(&sum, &combined);
  }
  pq_store(row, field + 1u, &sum);
}
@compute @workgroup_size(32)
fn project_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x / 8u; let field = id.x % 8u;
  if (row >= pq_params.x || !pq_active(row) || atomicLoad(&pq_validation[0]) != 0u) { return; }
  let slots = array<u32, 8>(0u, 17u, 18u, 19u, 16u, 9u, 10u, 8u);
  var value: ExactRational; pq_load(row, slots[field], &value); let projected = xrp_project_f32_bits(&value);
  if (projected.error != 0u || (projected.bits & 0x7fffffffu) >= 0x7f800000u
      || ((field == 0u || field >= 5u) && ((projected.bits & 0x80000000u) != 0u || projected.bits < 0x00800000u))) {
    atomicOr(&pq_validation[0], projected.error | 1u);
  }
  pq_projection[row * 8u + field] = projected.bits;
}
@compute @workgroup_size(32)
fn commit_phase_quantity(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= pq_params.x) { return; }
  let base = row * ${_}u;
  if (atomicLoad(&pq_validation[0]) != 0u) {
    for (var i = 0u; i < ${_}u; i++) { pq_output[base + i] = pq_source[base + i]; } return;
  }
  for (var i = 0u; i < ${_}u; i++) { pq_output[base + i] = 0u; }
  for (var field = 0u; field < 7u; field++) { pq_output[base + ${n.scalarOffsetWords}u + field * ${g}u + 4u + XR_WORDS] = 1u; }
  if (!pq_active(row)) { return; }
  let template_row = pq_geometry[row * 8u + 4u];
  for (var i = 0u; i < 16u; i++) { pq_output[base + i] = pq_source[template_row * ${_}u + i]; }
  pq_output[base + 3u] = row / pq_params.y + 1u; pq_output[base + 6u] = row;
  for (var i = 0u; i < ${t.wordCount}u; i++) { pq_output[base + 16u + i] = pq_mass[row * ${t.wordCount}u + i]; }
  let fields = array<u32, 7>(1u, 2u, 3u, 4u, 9u, 10u, 0u);
  for (var field = 0u; field < 7u; field++) {
    let at = pq_at(row, fields[field]); let destination = base + ${n.scalarOffsetWords}u + field * ${g}u;
    for (var i = 0u; i < ${g}u; i++) { pq_output[destination + i] = pq_scratch[at + i]; }
  }
}
`,B=r({wordCount:n.scalar.wordCount})+z,V=r({wordCount:n.scalar.wordCount,canonicalOperands:!0})+z,H=[i,a,o,s,te,j,ee,M,c,N,P,F],U=[...[,,,,].fill(`read-only-storage`),...[,,,,,].fill(`storage`),`uniform`,`uniform`,`storage`],W=new Map,ne=[`add`,`subtract`,`multiply`,`divide`],G=/  switch pq_op\.x \{[\s\S]*?\n  \}\n  pq_store\(row, pq_op\.w, &v\);/,K=[`prepare_phase_source`,`seed_phase_packet`,`store_phase_packet`,`initialize_phase_quantity_normalization`,`normalize_phase_quantity_operands`,`normalize_phase_quantity_general`,`prepare_phase_quantity_operation`,`prepare_phase_target`,`gather_phase_quantity`,`project_phase_quantity`,`commit_phase_quantity`].map(e=>({key:e,entryPoint:e,code:B}));ne.forEach(e=>K.push({key:`execute_phase_${e}`,entryPoint:`execute_phase_quantity`,code:V.replace(G,`  xrp_rational_${e}(&v, &a, &b);\n  pq_store(row, pq_op.w, &v);`)}));for(let r of K){let{key:i,entryPoint:a}=r,o=await p(e,{code:r.code,entryPoint:a,cacheKey:`ulg-${i}-v9:${t.wordCount}:${t.quantumExponent}:${n.scalar.wordCount}`,label:`ulg-${i}`,bindings:U.map((e,t)=>d(t,e))});if(!o.pipeline)throw o.error??Error(`Exact phase quantity pipeline unavailable: ${a}`);f(),W.set(i,o)}let q=(t,n,r,i=0,a=1)=>{let o=W.get(n),s=e.createBindGroup({layout:o.bindGroupLayout,entries:H.map((e,t)=>({binding:t,resource:t===9||t===10?{buffer:e,offset:(t===9?r:i)*v,size:16}:{buffer:e}}))}),c=t.beginComputePass({label:n});c.setPipeline(o.pipeline),c.setBindGroup(0,s),n===`normalize_phase_quantity_general`||n.startsWith(`execute_phase_`)?c.dispatchWorkgroupsIndirect(I,0):c.dispatchWorkgroups(n===`initialize_phase_quantity_normalization`?1:Math.ceil(m*a/32)),c.end()},J=(e,t,n)=>{for(let r=t;r<n;r++)q(e,`initialize_phase_quantity_normalization`,r,r),q(e,`normalize_phase_quantity_operands`,r,r,2),e.copyBufferToBuffer(F,4,I,0,12),q(e,`normalize_phase_quantity_general`,r,r),q(e,`initialize_phase_quantity_normalization`,r,r),q(e,`prepare_phase_quantity_operation`,r,r),e.copyBufferToBuffer(F,4,I,0,12),q(e,`execute_phase_${ne[C[r].instruction[0]]}`,r,r)};return Object.freeze({quantityBuffer:ee,quantityLayout:n,format:t,packetQuantityBuffer:j,projectionBuffer:M,transientBuffers:Object.freeze([te,N,P,F,I]),encode(e){f(),q(e,`prepare_phase_source`,C.length),J(e,0,E);for(let t=0;t<4;t++){q(e,`seed_phase_packet`,C.length+t+1);let[n,r]=D[t];J(e,n,r),q(e,`store_phase_packet`,C.length+t+1),J(e,r,r+4)}q(e,`prepare_phase_target`,C.length+5),q(e,`gather_phase_quantity`,C.length+5,0,4),J(e,O,C.length),q(e,`project_phase_quantity`,C.length+5,0,8)},commit(e){f(),q(e,`commit_phase_quantity`,C.length+5)}})}function b(t){return`
${c}
${e}
struct Params {
  particle_count: u32, lineage_capacity: u32, phase_lane_count: u32, phase_lane_stride: u32,
  thermal_segment_count: u32, mechanics_record_count: u32, thermal_offset_vec4: u32, mechanics_offset_vec4: u32,
  reserved_status: u32, fraction_validation_epsilon: f32, relative_tolerance: f32, mass_epsilon: f32,
  material_record_count: u32, material_record_offset_vec4: u32, absolute_pressure_authority: u32, fraction_activation_epsilon: f32,
  response_count: u32, graph_node_offset: u32, graph_sample_offset: u32, graph_count: u32,
};
@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> closure_rows: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> packets: array<u32>;
@group(0) @binding(5) var<storage, read_write> geometry: array<u32>;
@group(0) @binding(6) var<storage, read> projected: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> caloric: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> out_thermo: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(11) var<storage, read_write> validation: array<atomic<u32>>;
@group(0) @binding(12) var<uniform> params: Params;
fn finite(value: f32) -> bool { return (bitcast<u32>(value) & 0x7fffffffu) < 0x7f800000u; }
fn packet_nonzero(row: u32, phase: u32) -> bool {
  var bits = 0u; for (var i = 0u; i < ${t.wordCount}u; i++) { bits |= packets[(row * 4u + phase) * ${t.wordCount}u + i]; }
  return bits != 0u;
}
fn packet_greater(a: u32, b: u32, phase: u32) -> bool {
  for (var j = ${t.wordCount}u; j > 0u; j--) {
    let x = packets[(a * 4u + phase) * ${t.wordCount}u + j - 1u];
    let y = packets[(b * 4u + phase) * ${t.wordCount}u + j - 1u];
    if (x != y) { return x > y; }
  } return false;
}
fn packet_position_weight(row: u32, phase: u32, high: u32) -> f32 {
  let at = (row * 4u + phase) * ${t.wordCount}u;
  var weight = f32(packets[at + high]);
  if (high > 0u) { weight += f32(packets[at + high - 1u]) * 2.3283064365386963e-10; }
  return weight;
}
fn phase_record(material: f32, phase: u32) -> u32 {
  for (var i = 0u; i < params.mechanics_record_count; i++) {
    let row = closure_rows[params.mechanics_offset_vec4 + i * 3u];
    if (row.x == material && row.y == f32(phase)) { return i; }
  } return 0xffffffffu;
}
fn component_energy(row: u32, phase: u32) -> vec2<f32> {
  let fractions = source_thermo[row * 3u + 1u];
  var count = 0u; var first = 0u; var second = 0u;
  for (var i = 0u; i < 4u; i++) {
    if ((bitcast<u32>(fractions[i]) & 0x7fffffffu) != 0u) {
      if (count == 0u) { first = i + 1u; } else { second = i + 1u; } count++;
    }
  }
  if (count == 1u && first == phase) { return vec2<f32>(source_state[row * 2u + 1u].w, 1.0); }
  if (count != 2u) { return vec2<f32>(0.0); }
  return plateau_endpoint(source_thermo[row * 3u].x, first, second,
    source_state[row * 2u + 1u].w, phase, source_mechanics[row * 8u + 7u].x);
}
@compute @workgroup_size(64)
fn prepare_phase_geometry(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&validation[0]) != 0u) { return; }
  for (var phase = 0u; phase < 4u; phase++) {
    if (!packet_nonzero(row, phase)) { continue; }
    let endpoint = component_energy(row, phase + 1u);
    if (endpoint.y != 1.0 || !finite(endpoint.x)) { atomicOr(&validation[0], 0x10000u); return; }
    geometry[row * 8u + phase] = bitcast<u32>(endpoint.x);
  }
  let lineage = row % params.lineage_capacity; let phase = row / params.lineage_capacity;
  var template_row = lineage; var found = false;
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * params.lineage_capacity + lineage;
    if (!packet_nonzero(source_row, phase)) { continue; }
    if (!found || packet_greater(source_row, template_row, phase)) { template_row = source_row; }
    found = true;
  }
  geometry[row * 8u + 4u] = template_row;
  if (!found) { geometry[row * 8u + 7u] = 0xffffffffu; return; }
  let material = source_thermo[template_row * 3u].x;
  let record = phase_record(material, phase + 1u);
  if (record == 0xffffffffu) { atomicOr(&validation[0], 0x20000u); return; }
  let base = params.mechanics_offset_vec4 + record * 3u;
  let r0 = closure_rows[base]; let r1 = closure_rows[base + 1u]; let r2 = closure_rows[base + 2u];
  let m5 = source_mechanics[template_row * 8u + 5u]; let m6 = source_mechanics[template_row * 8u + 6u];
  if (!(r0.z > 0.0) || !finite(r0.z) || r2.y != 1.0) { atomicOr(&validation[0], 0x20000u); return; }
  geometry[row * 8u + 5u] = select(0u, 1u, m5.x == r2.x && m6.z == r1.w && m5.y == 1.0 && m6.w == 1.0);
  geometry[row * 8u + 6u] = bitcast<u32>(r0.z);
  geometry[row * 8u + 7u] = record;
}
fn phase_temperature(material: f32, phase: u32, energy: f32) -> f32 {
  for (var response = 0u; response < params.response_count; response++) {
    let r0 = caloric[response * 4u]; let r1 = caloric[response * 4u + 1u];
    if (r0.x != material || r0.y == 2.0 || r0.w != 1.0 || r1.z != f32(phase) || r1.w != f32(phase)
        || energy < r1.x || energy > r1.y) { continue; }
    let graph = u32(r0.z); if (graph >= params.graph_count) { continue; }
    let node = caloric[params.graph_node_offset + graph * 4u + 1u];
    if (energy < node.z || energy > node.w || node.y < 2.0) { continue; }
    let start = params.graph_sample_offset + u32(node.x); let count = u32(node.y);
    if (start + count > arrayLength(&caloric)) { continue; }
    for (var i = start; i + 1u < start + count; i++) {
      let a = caloric[i]; let b = caloric[i + 1u];
      if (energy >= a.x && energy <= b.x && b.x > a.x) { return a.y + (energy - a.x) / (b.x - a.x) * (b.y - a.y); }
    }
  } return -1.0;
}
@compute @workgroup_size(64)
fn apply_phase_physical(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&validation[0]) != 0u) { return; }
  let phase = row / params.lineage_capacity + 1u; let record = geometry[row * 8u + 7u];
  if (record == 0xffffffffu) {
    out_state[row * 2u] = vec4<f32>(source_state[row * 2u].xyz, 0.0);
    out_state[row * 2u + 1u] = source_state[row * 2u + 1u];
    out_thermo[row * 3u] = vec4<f32>(source_thermo[row * 3u].x, f32(phase), source_thermo[row * 3u].zw);
    out_thermo[row * 3u + 1u] = vec4<f32>(0.0);
    out_thermo[row * 3u + 2u] = vec4<f32>(source_thermo[row * 3u + 2u].x, 0.0, f32(params.reserved_status), 0.0);
    for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[row * 8u + i]; }
    out_mechanics[row * 8u + 4u].w = 0.0; out_mechanics[row * 8u + 5u].y = f32(params.reserved_status);
    out_mechanics[row * 8u + 6u].w = f32(params.reserved_status); out_mechanics[row * 8u + 7u].w = 0.0; return;
  }
  let template_row = geometry[row * 8u + 4u]; let material = source_thermo[template_row * 3u].x;
  let p0 = projected[row * 2u]; let p1 = projected[row * 2u + 1u];
  let temperature = phase_temperature(material, phase, p1.x);
  let base = params.mechanics_offset_vec4 + record * 3u;
  let r0 = closure_rows[base]; let r1 = closure_rows[base + 1u]; let r2 = closure_rows[base + 2u];
  let gas_offset = params.material_record_offset_vec4 + params.material_record_count * 2u;
  var sound = r1.z;
  if (r1.w == 2.0 && arrayLength(&closure_rows) > gas_offset) {
    sound = gas_constitutive_sound_speed(closure_rows[gas_offset + record], temperature);
  }
  if (!(temperature > 0.0) || !finite(temperature) || !(sound >= 0.0) || !finite(sound)) { atomicOr(&validation[0], 0x40000u); return; }
  var high = 0u;
  for (var i = 0u; i < ${t.wordCount}u; i++) { if (packets[(template_row * 4u + phase - 1u) * ${t.wordCount}u + i] != 0u) { high = i; } }
  var position = vec3<f32>(0.0); var total = 0.0; var smoothing = 0.0;
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * params.lineage_capacity + row % params.lineage_capacity;
    let weight = packet_position_weight(source_row, phase - 1u, high);
    position += source_state[source_row * 2u].xyz * weight; total += weight;
    if (packet_nonzero(source_row, phase - 1u)) { smoothing = max(smoothing, source_thermo[source_row * 3u + 2u].x); }
  }
  position /= total;
  var entities = 0.0;
  for (var lane = 0u; lane < 4u; lane++) {
    let source_row = lane * params.lineage_capacity + row % params.lineage_capacity;
    if (!packet_nonzero(source_row, phase - 1u)) { continue; }
    let share = packet_position_weight(source_row, phase - 1u, high) / total;
    entities += source_thermo[source_row * 3u + 2u].y * ((p0.x * share) / source_state[source_row * 2u].w);
  }
  if (!finite(entities) || entities < 0.0 || !finite(smoothing)) { atomicOr(&validation[0], 0x80000u); return; }
  if (!all(position == position) || any(abs(position) > vec3<f32>(3.402823e38))) { atomicOr(&validation[0], 0x80000u); return; }
  out_state[row * 2u] = vec4<f32>(position, p0.x); out_state[row * 2u + 1u] = vec4<f32>(p0.yzw, p1.x);
  out_thermo[row * 3u] = vec4<f32>(material, f32(phase), temperature, r0.z);
  var fractions = vec4<f32>(0.0); fractions[phase - 1u] = 1.0; out_thermo[row * 3u + 1u] = fractions;
  // Radius follows the represented current volume; this is a bulk carrier,
  // never an aerosol parcel count or optical radius. The f32 entity count is
  // diagnostic; exact mass and the retained molecular identity remain owners.
  out_thermo[row * 3u + 2u] = vec4<f32>(smoothing, entities, 1.0, pow(p1.z * 0.238732414637843, 1.0 / 3.0));
  for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[template_row * 8u + i]; }
  if (geometry[row * 8u + 5u] == 0u) {
    for (var i = 0u; i < 3u; i++) { out_mechanics[row * 8u + i] = vec4<f32>(1.0, 0.0, 0.0, 0.0); }
    out_mechanics[row * 8u + 3u] = vec4<f32>(0.0); out_mechanics[row * 8u + 4u] = vec4<f32>(0.0);
  }
  out_mechanics[row * 8u + 4u].z = p1.w; out_mechanics[row * 8u + 4u].w = p1.y;
  out_mechanics[row * 8u + 5u] = vec4<f32>(r2.x, r2.y, r0.w, r1.x);
  out_mechanics[row * 8u + 6u] = vec4<f32>(r1.y, sound, r1.w, r2.y);
  out_mechanics[row * 8u + 7u] = vec4<f32>(out_mechanics[row * 8u + 7u].x, r2.z, r2.w, p0.x);
}
@compute @workgroup_size(64)
fn restore_rejected_phase_physical(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= params.particle_count || atomicLoad(&validation[0]) == 0u) { return; }
  for (var i = 0u; i < 2u; i++) { out_state[row * 2u + i] = source_state[row * 2u + i]; }
  for (var i = 0u; i < 3u; i++) { out_thermo[row * 3u + i] = source_thermo[row * 3u + i]; }
  for (var i = 0u; i < 8u; i++) { out_mechanics[row * 8u + i] = source_mechanics[row * 8u + i]; }
}
`}async function x({device:e,format:t,layout:n,massBuffer:i,stateBuffer:a,thermoBuffer:o,mechanicsBuffer:s,quantityBuffer:c,materialMolars:l,allocate:u,validate:f}){let m=n.rowCount,h=n.scalar.recordWords,g=n.recordWords,_=e.limits.minUniformBufferOffsetAlignment,v=[[2,0,1,8],[2,0,2,9],[2,0,3,10],[2,1,1,11],[2,2,2,12],[0,11,12,11],[2,3,3,12],[0,11,12,11],[2,11,7,11],[0,11,4,11],[2,11,0,11],[2,5,6,12]],y=u({label:`ulg-phase-initial-quantity-scratch`,size:m*13*h*4,usage:136}),b=u({label:`ulg-phase-initial-molar-identities`,size:Math.max(8,l.byteLength),usage:136}),x=u({label:`ulg-phase-initial-quantity-operations`,size:v.length*_,usage:72}),S=new Uint32Array(x.size/4);v.forEach((e,t)=>S.set(e,t*_/4)),e.queue.writeBuffer(x,0,S),e.queue.writeBuffer(b,0,l);let C=r({wordCount:n.scalar.wordCount})+`
@group(0) @binding(0) var<storage, read> initial_mass: array<u32>;
@group(0) @binding(1) var<storage, read> initial_state: array<u32>;
@group(0) @binding(2) var<storage, read> initial_thermo: array<u32>;
@group(0) @binding(3) var<storage, read> initial_mechanics: array<u32>;
@group(0) @binding(4) var<storage, read> initial_molars: array<u32>;
@group(0) @binding(5) var<storage, read_write> initial_scratch: array<u32>;
@group(0) @binding(6) var<storage, read_write> initial_quantities: array<u32>;
@group(0) @binding(7) var<uniform> initial_op: vec4<u32>;
fn initial_store(row: u32, slot: u32, v: ExactRational) {
  let at = (row * 13u + slot) * ${h}u;
  initial_scratch[at] = v.negative; initial_scratch[at + 1u] = v.error;
  initial_scratch[at + 2u] = bitcast<u32>(v.exponent); initial_scratch[at + 3u] = v.reserved;
  for (var i = 0u; i < XR_WORDS; i++) { initial_scratch[at + 4u + i] = v.numerator[i]; initial_scratch[at + 4u + XR_WORDS + i] = v.denominator[i]; }
  initial_quantities[row * ${g}u + 1u] |= v.error;
}
fn initial_load(row: u32, slot: u32) -> ExactRational {
  let at = (row * 13u + slot) * ${h}u; var v = xr_zero();
  v.negative = initial_scratch[at]; v.error = initial_scratch[at + 1u];
  v.exponent = bitcast<i32>(initial_scratch[at + 2u]); v.reserved = initial_scratch[at + 3u];
  for (var i = 0u; i < XR_WORDS; i++) { v.numerator[i] = initial_scratch[at + 4u + i]; v.denominator[i] = initial_scratch[at + 4u + XR_WORDS + i]; }
  return v;
}
@compute @workgroup_size(32)
fn seed_phase_initial_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= ${m}u) { return; } let at = row * ${g}u;
  for (var i = 0u; i < ${g}u; i++) { initial_quantities[at + i] = 0u; }
  for (var slot = 0u; slot < 13u; slot++) { initial_store(row, slot, xr_zero()); }
  var mass = xr_zero(); mass.exponent = ${t.quantumExponent}i; var has_mass = 0u;
  for (var i = 0u; i < ${t.wordCount}u; i++) {
    mass.numerator[i] = initial_mass[row * ${t.wordCount}u + i]; has_mass |= mass.numerator[i];
    initial_quantities[at + 16u + i] = mass.numerator[i];
  }
  let material = u32(bitcast<f32>(initial_thermo[row * 12u]));
  initial_quantities[at] = 1u; initial_quantities[at + 2u] = material;
  initial_quantities[at + 3u] = u32(bitcast<f32>(initial_thermo[row * 12u + 1u]));
  initial_quantities[at + 5u] = 1u; initial_quantities[at + 6u] = row;
  initial_quantities[at + 7u] = 0xffffffffu; initial_quantities[at + 8u] = 0xffffffffu;
  initial_quantities[at + 9u] = ${t.wordCount}u; initial_quantities[at + 10u] = XR_WORDS;
  initial_quantities[at + 11u] = select(0u, 1u, has_mass != 0u);
  if (has_mass == 0u) { return; }
  for (var i = 0u; i + 1u < arrayLength(&initial_molars); i += 2u) {
    if (initial_molars[i] == material) { initial_quantities[at + 4u] = initial_molars[i + 1u]; }
  }
  let molar_bits = initial_quantities[at + 4u];
  if (molar_bits < 0x00800000u || molar_bits >= 0x7f800000u) { initial_quantities[at + 1u] |= 1u; }
  initial_store(row, 0u, mass);
  for (var field = 0u; field < 4u; field++) { var value = xr_zero();
    xrp_from_f32_bits(&value, initial_state[row * 8u + 4u + field]); initial_store(row, field + 1u, value); }
  for (var field = 0u; field < 2u; field++) { var value = xr_zero();
    xrp_from_f32_bits(&value, initial_mechanics[row * 32u + 19u - field]); initial_store(row, field + 5u, value); }
  var half = xr_zero(); xrp_from_f32_bits(&half, 0x3f000000u); initial_store(row, 7u, half);
}
@compute @workgroup_size(32)
fn calculate_phase_initial_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= ${m}u || initial_quantities[row * ${g}u + 11u] == 0u) { return; }
  var a = initial_load(row, initial_op.y); var b = initial_load(row, initial_op.z); var value = xr_zero();
  if (initial_op.x == 0u) { xrp_rational_add(&value, &a, &b); } else { xrp_rational_multiply(&value, &a, &b); }
  initial_store(row, initial_op.w, value);
}
@compute @workgroup_size(32)
fn finish_phase_initial_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x; if (row >= ${m}u) { return; }
  let fields = array<u32, 7>(8u, 9u, 10u, 11u, 5u, 12u, 0u);
  for (var field = 0u; field < 7u; field++) {
    let input = (row * 13u + fields[field]) * ${h}u;
    let output = row * ${g}u + ${n.scalarOffsetWords}u + field * ${h}u;
    for (var i = 0u; i < ${h}u; i++) { initial_quantities[output + i] = initial_scratch[input + i]; }
  }
}
`,w=[i,a,o,s,b,y,c,x],T=[];for(let r of[`seed_phase_initial_quantities`,`calculate_phase_initial_quantities`,`finish_phase_initial_quantities`]){let i=await p(e,{code:C,entryPoint:r,cacheKey:`ulg-${r}-v2:${t.wordCount}:${t.quantumExponent}:${m}:${n.scalar.wordCount}`,bindings:[...[,,,,,].fill(`read-only-storage`),`storage`,`storage`,`uniform`].map((e,t)=>d(t,e))});if(!i.pipeline)throw i.error??Error(`Initial phase quantities unavailable: ${r}`);T.push(i),f()}let E=(t,n,r=0)=>{let i=T[n],a=e.createBindGroup({layout:i.bindGroupLayout,entries:w.map((e,t)=>({binding:t,resource:t===7?{buffer:e,offset:r*_,size:16}:{buffer:e}}))}),o=t.beginComputePass();o.setPipeline(i.pipeline),o.setBindGroup(0,a),o.dispatchWorkgroups(Math.ceil(m/32)),o.end()};return{encode(e){f(),E(e,0),v.forEach((t,n)=>E(e,1,n)),E(e,2)}}}async function S(e){let t=e.exactThermalResult!=null;if(t===(e.exactReactionResult!=null)||!e.postMechanicsSourceCapture||e.retainOutputParticleBuffers!==!0||e.readbackMode!==`no-full-readback`)throw TypeError(`Exact phase transfer requires one original retained thermal or reaction capture`);let r,c,m,h,g;if(t){let{resolveSphThermalSourceCapture:t,acquireSphThermalExactMassSourceCapture:n}=await i(async()=>{let{resolveSphThermalSourceCapture:e,acquireSphThermalExactMassSourceCapture:t}=await import(`./sphThermalGpuKernel-DoA-hCmI.js`);return{resolveSphThermalSourceCapture:e,acquireSphThermalExactMassSourceCapture:t}},[],import.meta.url);r=t(e.exactThermalResult,e.exactThermalSourceCapture),c=await n(e.exactThermalResult,e.exactThermalSourceCapture,{device:e.device,sphParticleUpload:e.sphParticleUpload,mlsMpmParticleUpload:e.mlsMpmParticleUpload,sphParticleState:e.sphParticleState,thermalMaterialTable:e.thermalMaterialTable,transaction:e.exactMassSpatialEpochTransaction,generation:e.exactMassSpatialEpochGeneration,g2pResult:e.exactMassG2pResult,dtSeconds:e.dtSeconds}),h=c.quantities,m={...h,format:c.format,particleCount:c.particleCount,stateBuffer:c.stateBuffer,thermoBuffer:c.thermoBuffer,mechanicsBuffer:c.mechanicsBuffer},g=c.inventoryGeneration}else{let{resolveSphReactionSourceCapture:t}=await i(async()=>{let{resolveSphReactionSourceCapture:e}=await import(`./sphReactionGpuKernel-_Tl4TDkK.js`);return{resolveSphReactionSourceCapture:e}},[],import.meta.url);r=t(e.exactReactionResult,e.exactReactionSourceCapture),c=r.retain(),h=r.exactReaction,m=h?.destinationRead,g=h?.carrierMassRead.generation}let _=new Set,S=new Set,C=!1,w=!1,T=!1,E=null,D=null,O=null,k=e=>{for(let t of e)t.destroy();e.clear()},A=()=>(T||(T=!0,E=C?f(e.device,()=>c.release()):Promise.resolve(c.release()),E.catch(()=>{})),E),ee=()=>{let t=()=>(k(S),k(_),w=!0,A());return C?f(e.device,t):Promise.resolve().then(t)};try{let{device:E}=e,te=()=>{if(w||T)throw TypeError(`Exact phase source was released`);if(r.validate(),c.validate(),!m||e.device!==r.inputs.device||e.sphParticleState!==r.inputs.sphParticleState||!t&&e.mlsMpmParticleState!==r.inputs.mlsMpmParticleState||e.thermalMaterialTable!==r.inputs.thermalMaterialTable||e.sourceStateBuffer!==m.stateBuffer||e.sourceThermoBuffer!==m.thermoBuffer||e.sourceMechanicsBuffer!==m.mechanicsBuffer)throw TypeError(`Exact phase transfer requires its complete original captured source tuple`)};te();let j=m.particleCount,M=m.format,N=a(e.phaseCarrierPlan,j);if(N.accepted!==!0||N.phaseLaneCount!==4||N.lineageCapacity*4!==j||N.phaseLaneStride!==N.lineageCapacity)throw TypeError(`Exact phase transfer requires four complete phase lanes`);let P=Object.entries(e.phaseCarrierPlan),F=s(e.thermalMaterialTable,e.mechanicsMaterialTable),{resolveThermalResponseGraphArtifacts:I}=await i(async()=>{let{resolveThermalResponseGraphArtifacts:e}=await import(`./sphThermalGpuKernel-DoA-hCmI.js`);return{resolveThermalResponseGraphArtifacts:e}},[],import.meta.url),L=I({thermalMaterialTable:e.thermalMaterialTable,requireExactContent:!0}),R=L.thermalPhaseResponseTable,z=L.thermalClosureGraphBank,B=new Float32Array(R.responses.length+z.nodeRows.length+z.sampleRows.length);B.set(R.responses),B.set(z.nodeRows,R.responses.length),B.set(z.sampleRows,R.responses.length+z.nodeRows.length);let V=()=>{if(te(),Object.keys(e.phaseCarrierPlan).length!==P.length||P.some(([t,n])=>e.phaseCarrierPlan[t]!==n))throw TypeError(`Exact phase plan changed during preparation`);let t=s(e.thermalMaterialTable,e.mechanicsMaterialTable).values;if(t.length!==F.values.length||new Uint32Array(t.buffer).some((e,t)=>e!==new Uint32Array(F.values.buffer)[t]))throw TypeError(`Exact phase material tables changed during preparation`)},H=(e,t=!1)=>{if(!Number.isSafeInteger(e.size)||e.size<4||e.size>E.limits.maxBufferSize||e.usage&128&&e.size>E.limits.maxStorageBufferBindingSize)throw RangeError(`Exact phase allocation exceeds device capacity`);let r=n(E.createBuffer(e),E);return(t?_:S).add(r),r},U=(e,t,n=!1,r=140)=>H({label:`ulg-exact-phase-${e}`,size:t,usage:r},n),W=(e,t,n=136)=>{let r=U(e,Math.max(4,t.byteLength),!1,n);return E.queue.writeBuffer(r,0,t),r},ne=m.quantityLayout??u(M,{particleCount:j,eventCapacity:1}),G=Object.freeze({...ne,rowCount:j,wordLength:j*ne.recordWords}),K=U(`source-quantities`,G.wordLength*4);if(m.quantityBuffer&&m.quantityBuffer.size<K.size)throw TypeError(`Incomplete exact phase source quantities`);let q=U(`source-mass`,j*M.wordCount*4),J=null;if(!m.quantityBuffer){if(!t||c.quantities||c.sourceRead.quantities||c.sourceRead.read.rowCount!==j||!(e.thermalMaterialTable.molarMassIdentities instanceof Uint32Array))throw TypeError(`Initial phase quantities require the original uncaptured thermal tuple and molecular identities`);J=await x({device:E,format:M,layout:G,massBuffer:q,stateBuffer:m.stateBuffer,thermoBuffer:m.thermoBuffer,mechanicsBuffer:m.mechanicsBuffer,quantityBuffer:K,materialMolars:e.thermalMaterialTable.molarMassIdentities,allocate:H,validate:V})}let re=U(`geometry`,j*32),Y=await v({device:E,format:M,lineageCapacity:N.lineageCapacity,sourceMassBuffer:q,sourceThermoBuffer:m.thermoBuffer,allocate:H,validate:V}),X=await y({device:E,format:M,layout:G,sourceQuantityBuffer:K,packetMassBuffer:Y.packetMassBuffer,candidateMassBuffer:Y.massBuffer,geometryBuffer:re,validationBuffer:Y.validationBuffer,lineageCapacity:N.lineageCapacity,allocate:H,validate:V});S.delete(X.quantityBuffer),_.add(X.quantityBuffer);let Z=U(`state`,j*32,!0),Q=U(`thermo`,j*48,!0),$=U(`mechanics`,j*128,!0),ie=[Z,Q,$,X.quantityBuffer];t?l(c.sourceRead,ie):await o(m,ie,{device:E});let ae=W(`closure`,F.values),oe=W(`caloric`,B),se=new ArrayBuffer(80),ce=new Uint32Array(se),le=new Float32Array(se);ce.set([j,N.lineageCapacity,4,N.lineageCapacity,F.thermalSegmentCount,F.mechanicsRecordCount,F.thermalOffsetVec4,F.mechanicsOffsetVec4,254]),le[9]=1e-7,le[10]=2e-4,ce[12]=F.materialRecordCount,ce[13]=F.materialRecordOffsetVec4,ce[14]=+(e.absolutePressureAuthority===!0),ce.set([R.responseCount,R.responses.length/4,(R.responses.length+z.nodeRows.length)/4,z.graphCount],16);let ue=W(`physical-params`,se,72),de=b(M),fe=[m.stateBuffer,m.thermoBuffer,m.mechanicsBuffer,ae,Y.packetMassBuffer,re,X.projectionBuffer,oe,Z,Q,$,Y.validationBuffer,ue],pe=[...[,,,,,].fill(`read-only-storage`),`storage`,`read-only-storage`,`read-only-storage`,...[,,,,].fill(`storage`),`uniform`],me=[];for(let e of[`prepare_phase_geometry`,`apply_phase_physical`,`restore_rejected_phase_physical`]){let t=await p(E,{code:de,entryPoint:e,label:e,cacheKey:`ulg-exact-${e}-v1:${M.wordCount}`,bindings:pe.map((e,t)=>d(t,e))});if(!t.pipeline)throw t.error??Error(`Phase physical pipeline unavailable: ${e}`);me.push({pipeline:t,group:E.createBindGroup({layout:t.bindGroupLayout,entries:fe.map((e,t)=>({binding:t,resource:{buffer:e}}))})}),V()}let he=await p(E,{code:`@group(0) @binding(0) var<storage, read> q: array<u32>;
@group(0) @binding(1) var<storage, read_write> m: array<u32>;
@compute @workgroup_size(64) fn gather_phase_source(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&m)){m[i]=q[(i/${M.wordCount}u)*${G.recordWords}u+16u+i%${M.wordCount}u];}}`,entryPoint:`gather_phase_source`,cacheKey:`ulg-phase-source-mass-v1:${M.wordCount}:${G.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>d(t,e))});if(!he.pipeline)throw he.error??Error(`Phase source mass gather unavailable`);let ge=E.createBindGroup({layout:he.bindGroupLayout,entries:[K,q].map((e,t)=>({binding:t,resource:{buffer:e}}))}),_e=(e,t,n,r)=>{let i=e.beginComputePass();i.setPipeline(t.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(r),i.end()},ve={state:Z,thermo:Q,mechanics:$},ye=e=>{for(let[t,n]of Object.entries(ve))e[t]&&_.delete(n)&&(n.destroy(),w=!0,be[`owns${t[0].toUpperCase()}${t.slice(1)}Buffer`]=!1);return Object.values(ve).some(e=>_.has(e))||(_.delete(X.quantityBuffer)&&X.quantityBuffer.destroy(),_.delete(Y.validationBuffer)&&Y.validationBuffer.destroy(),w=!0),!0},be={schema:`peercompute.ulg.sph-phase-carrier-transfer.v2`,status:`phase-carrier-transfer-submitted`,backend:`webgpu`,readbackMode:e.readbackMode,particleCount:j,phaseCarrierPlan:{...e.phaseCarrierPlan},stateBuffer:Z,thermoBuffer:Q,mechanicsBuffer:$,stateBufferByteLength:Z.size,thermoBufferByteLength:Q.size,mechanicsBufferByteLength:$.size,ownsStateBuffer:!0,ownsThermoBuffer:!0,ownsMechanicsBuffer:!0,retainedOutputParticleBuffers:!0,state:new Float32Array,thermo:new Float32Array,mechanics:new Float32Array,exactValidationBuffer:Y.validationBuffer,destroyOutputParticleBuffers:()=>ye({state:!0,thermo:!0,mechanics:!0}),destroyOutputParticleBufferComponents:ye};return S.delete(Y.validationBuffer),_.add(Y.validationBuffer),{result:be,exactPhase:Object.freeze({quantityBuffer:X.quantityBuffer,quantityLayout:G,format:M,particleCount:j,sourceInventoryGeneration:g,source:h??r,stateBuffer:Z,thermoBuffer:Q,mechanicsBuffer:$,get carrierMassRead(){return O},markDerivedBuffers(e){return t?l(c.sourceRead,e):o(m,e,{device:E})}}),releaseSource:A,abandon:ee,releaseQuantityStorage(){return f(E,()=>{for(let e of[X.quantityBuffer,Y.validationBuffer])_.delete(e)&&e.destroy()})},validateOutput(){if(w)throw TypeError(`Exact phase output retired`);return!0},encode(e){V(),J?(e.copyBufferToBuffer(c.sourceRead.read.buffer,c.sourceRead.read.byteOffset,q,0,q.size),J.encode(e)):e.copyBufferToBuffer(m.quantityBuffer,0,K,0,K.size),_e(e,he,ge,Math.ceil(j*M.wordCount/64)),Y.encode(e),_e(e,me[0].pipeline,me[0].group,Math.ceil(j/64)),X.encode(e);for(let t of me.slice(1))_e(e,t.pipeline,t.group,Math.ceil(j/64));X.commit(e)},markSubmitted(){C=!0},cleanupSubmittedWork(){k(S)},cleanupRetainedOutput:be.destroyOutputParticleBuffers,cleanupRetainedOutputComponents:ye,async completeInventory(e,t){let{createSphExactMassInventoryFromPhaseTransferWebGpu:n,acquireSphExactMassRead:r}=await i(async()=>{let{createSphExactMassInventoryFromPhaseTransferWebGpu:e,acquireSphExactMassRead:t}=await import(`./sphExactMassInventoryGpu-Dhi3o0Fb.js`);return{createSphExactMassInventoryFromPhaseTransferWebGpu:e,acquireSphExactMassRead:t}},[],import.meta.url);D=await n({device:E,result:e,token:t}),O=r({device:E,family:D})},async releaseInventory(){let{releaseSphExactMassRead:e,releaseSphExactMassInventory:t}=await i(async()=>{let{releaseSphExactMassRead:e,releaseSphExactMassInventory:t}=await import(`./sphExactMassInventoryGpu-Dhi3o0Fb.js`);return{releaseSphExactMassRead:e,releaseSphExactMassInventory:t}},[],import.meta.url);O&&await e(O),D&&await t(D)}}}catch(e){let t=ee();throw t.catch(()=>{}),e.exactPhaseCleanupCompletion=t,e}}export{S as prepareSphExactPhaseCarrierStage};