import{fo as e,jo as t,rt as n,so as r,tt as i,wo as a}from"./thermalPotentialGpu-DkLcy8o_.js";import{_ as o,c as s,p as c}from"./webgpuComputeLayout-CZMU6OGf.js";import{s as l,t as u}from"./sphExactMassInventory-FFefHwOc.js";import{t as d}from"./sphExactRationalQuantityWgsl-rrOl4iO8.js";import{i as f,o as p}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{t as m}from"./sphExactMassWgsl-ChqpSzqB.js";import{xn as h}from"./wgsl-C89He-PO.js";function g(e){return m(e)+`
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
`}async function _({device:e,format:t,lineageCapacity:n,sourceMassBuffer:r,sourceThermoBuffer:i,allocate:a,validate:c}){if(l(t),typeof a!=`function`||typeof c!=`function`)throw TypeError(`Phase mass preparation requires producer allocation and validation`);c();let u=n*4,d=u*t.wordCount*4,f=d*4;if(!Number.isSafeInteger(n)||n<1||u>4294967295||!Number.isSafeInteger(f)||f/4>4294967295||f>e.limits.maxStorageBufferBindingSize||f>e.limits.maxBufferSize||Math.ceil(u/32)>e.limits.maxComputeWorkgroupsPerDimension||e.limits.maxStorageBuffersPerShaderStage<6||r?.size!==d||i?.size!==u*48||[r,i].some(t=>p(t)!==e||(t.usage&128)==0))throw RangeError(`Phase mass requires complete same-device four-lane inputs within capacity`);let m=(e,t,n=140)=>a({label:`ulg-exact-phase-${e}`,size:t,usage:n}),h=m(`packets`,f),_=m(`sum`,d),v=m(`mass`,d),y=m(`validation`,16),b=m(`params`,16,72);e.queue.writeBuffer(b,0,new Uint32Array([n,u,0,0]));let x=g(t),S=[`read-only-storage`,`read-only-storage`,`storage`,`storage`,`storage`,`storage`,`uniform`],C=[r,i,h,_,v,y,b],w=[];for(let n of[`select_phase_packets`,`gather_phase_mass`,`commit_phase_mass`]){let r=await o(e,{code:x,entryPoint:n,cacheKey:`ulg-exact-phase-mass-v4:${t.wordCount}:${t.quantumExponent}:${n}`,label:`ulg-exact-phase-${n}`,bindings:S.map((e,t)=>s(t,e))});if(!r.pipeline)throw r.error??Error(`Phase mass pipeline unavailable: ${n}`);c(),w.push({pipeline:r.pipeline,bindGroup:e.createBindGroup({layout:r.bindGroupLayout,entries:C.map((e,t)=>({binding:t,resource:{buffer:e}}))})})}return Object.freeze({massBuffer:v,packetMassBuffer:h,validationBuffer:y,particleCount:u,format:t,transientBuffers:Object.freeze([_,b]),encode(e){c(),e.clearBuffer(y);for(let t=0;t<w.length;t++){let r=e.beginComputePass({label:`ulg-exact-phase-mass-${t}`});r.setPipeline(w[t].pipeline),r.setBindGroup(0,w[t].bindGroup),r.dispatchWorkgroups(Math.ceil((t===0?n:u)/32)),r.end()}}})}async function v({device:e,format:t,layout:n,sourceQuantityBuffer:r,packetMassBuffer:i,candidateMassBuffer:a,geometryBuffer:c,validationBuffer:l,lineageCapacity:f,allocate:p,validate:m}){m();let h=f*4,g=n.scalar.recordWords,_=n.recordWords,v=e.limits.minUniformBufferOffsetAlignment,y=h*_*4,b=h*24*g*4,x=h*16*g*4,S=(4+h*2)*4;if(n.rowCount!==h||n.massOffsetWords!==16||n.scalarOffsetWords!==16+t.wordCount||y!==r.size||i.size!==h*4*t.wordCount*4||a.size!==h*t.wordCount*4||c.size!==h*32||![y,b,x,S].every(t=>Number.isSafeInteger(t)&&t<=e.limits.maxStorageBufferBindingSize&&t<=e.limits.maxBufferSize)||Math.ceil(h*8/32)>e.limits.maxComputeWorkgroupsPerDimension)throw RangeError(`Exact phase quantities require complete four-lane records within device capacity`);let C=[],w=(e,t,n,r,i,a)=>C.push({mode:e,phase:t,instruction:[n,r,i,a]}),T=(e,t,n,r)=>w(0,0,e,t,n,r);T(2,1,1,12),T(2,2,2,13),T(0,12,13,12),T(2,3,3,13),T(0,12,13,12),T(0,0,0,13),T(3,12,13,14),T(3,14,0,14);let E=C.length,D=[];for(let e=0;e<4;e++){let t=C.length,n=(t,n,r,i)=>w(1,e,t,n,r,i);n(3,5,0,15);for(let e=0;e<3;e++)n(2,e+1,15,e+17);n(0,6,14,16),n(2,5,16,20),D.push([t,C.length]);for(let e=0;e<4;e++)n(1,e+7,e+17,e+7)}let ee=C.length,O=(e,t,n,r)=>w(2,0,e,t,n,r);O(2,1,1,12),O(2,2,2,13),O(0,12,13,12),O(2,3,3,13),O(0,12,13,12),O(0,0,0,13),O(3,12,13,14),O(1,4,14,16),O(3,16,0,16);for(let e=0;e<3;e++)O(3,e+1,0,e+17);O(3,0,5,9),O(3,6,7,8),O(2,9,8,10);let k=(e,t,n=140)=>p({label:`ulg-exact-phase-${e}`,size:t,usage:n}),te=k(`quantities`,y),A=k(`quantity-scratch`,b),j=k(`packet-quantities`,x),M=k(`projection`,h*32),N=k(`quantity-params`,v*(C.length+6),72),P=k(`quantity-operations`,v*C.length,72),F=k(`quantity-normalization-queue`,S),I=k(`quantity-normalization-dispatch`,12,264),L=new Uint32Array(N.size/4),R=new Uint32Array(P.size/4);C.forEach((e,t)=>{L.set([h,f,e.mode,e.phase],t*v/4),R.set(e.instruction,t*v/4)});for(let e=0;e<6;e++)L.set([h,f,e===5?2:e===0?0:1,Math.max(0,e-1)],(C.length+e)*v/4);e.queue.writeBuffer(N,0,L),e.queue.writeBuffer(P,0,R);let z=`
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
      || (nt == XR_WORDS * 32u && pq_scratch[at] != 0u)) { error |= ${u.INVALID_RATIO}u; }
  if (denominator_bits == 0u) { error |= ${u.DIVISION_BY_ZERO}u; }
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
    pq_zero_scalar(row, pq_op.w, select(0u, ${u.DIVISION_BY_ZERO}u, bz)); return true;
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
`,B=d({wordCount:n.scalar.wordCount})+z,V=d({wordCount:n.scalar.wordCount,canonicalOperands:!0})+z,H=[r,i,a,c,A,j,te,M,l,N,P,F],ne=[...[,,,,].fill(`read-only-storage`),...[,,,,,].fill(`storage`),`uniform`,`uniform`,`storage`],re=new Map,U=[`add`,`subtract`,`multiply`,`divide`],W=/  switch pq_op\.x \{[\s\S]*?\n  \}\n  pq_store\(row, pq_op\.w, &v\);/,G=[`prepare_phase_source`,`seed_phase_packet`,`store_phase_packet`,`initialize_phase_quantity_normalization`,`normalize_phase_quantity_operands`,`normalize_phase_quantity_general`,`prepare_phase_quantity_operation`,`prepare_phase_target`,`gather_phase_quantity`,`project_phase_quantity`,`commit_phase_quantity`].map(e=>({key:e,entryPoint:e,code:B}));U.forEach(e=>G.push({key:`execute_phase_${e}`,entryPoint:`execute_phase_quantity`,code:V.replace(W,`  xrp_rational_${e}(&v, &a, &b);\n  pq_store(row, pq_op.w, &v);`)}));for(let r of G){let{key:i,entryPoint:a}=r,c=await o(e,{code:r.code,entryPoint:a,cacheKey:`ulg-${i}-v9:${t.wordCount}:${t.quantumExponent}:${n.scalar.wordCount}`,label:`ulg-${i}`,bindings:ne.map((e,t)=>s(t,e))});if(!c.pipeline)throw c.error??Error(`Exact phase quantity pipeline unavailable: ${a}`);m(),re.set(i,c)}let K=(t,n,r,i=0,a=1)=>{let o=re.get(n),s=e.createBindGroup({layout:o.bindGroupLayout,entries:H.map((e,t)=>({binding:t,resource:t===9||t===10?{buffer:e,offset:(t===9?r:i)*v,size:16}:{buffer:e}}))}),c=t.beginComputePass({label:n});c.setPipeline(o.pipeline),c.setBindGroup(0,s),n===`normalize_phase_quantity_general`||n.startsWith(`execute_phase_`)?c.dispatchWorkgroupsIndirect(I,0):c.dispatchWorkgroups(n===`initialize_phase_quantity_normalization`?1:Math.ceil(h*a/32)),c.end()},q=(e,t,n)=>{for(let r=t;r<n;r++)K(e,`initialize_phase_quantity_normalization`,r,r),K(e,`normalize_phase_quantity_operands`,r,r,2),e.copyBufferToBuffer(F,4,I,0,12),K(e,`normalize_phase_quantity_general`,r,r),K(e,`initialize_phase_quantity_normalization`,r,r),K(e,`prepare_phase_quantity_operation`,r,r),e.copyBufferToBuffer(F,4,I,0,12),K(e,`execute_phase_${U[C[r].instruction[0]]}`,r,r)};return Object.freeze({quantityBuffer:te,quantityLayout:n,format:t,packetQuantityBuffer:j,projectionBuffer:M,transientBuffers:Object.freeze([A,N,P,F,I]),encode(e){m(),K(e,`prepare_phase_source`,C.length),q(e,0,E);for(let t=0;t<4;t++){K(e,`seed_phase_packet`,C.length+t+1);let[n,r]=D[t];q(e,n,r),K(e,`store_phase_packet`,C.length+t+1),q(e,r,r+4)}K(e,`prepare_phase_target`,C.length+5),K(e,`gather_phase_quantity`,C.length+5,0,4),q(e,ee,C.length),K(e,`project_phase_quantity`,C.length+5,0,8)},commit(e){m(),K(e,`commit_phase_quantity`,C.length+5)}})}function y(e){return`
${a}
${h}
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
  var bits = 0u; for (var i = 0u; i < ${e.wordCount}u; i++) { bits |= packets[(row * 4u + phase) * ${e.wordCount}u + i]; }
  return bits != 0u;
}
fn packet_greater(a: u32, b: u32, phase: u32) -> bool {
  for (var j = ${e.wordCount}u; j > 0u; j--) {
    let x = packets[(a * 4u + phase) * ${e.wordCount}u + j - 1u];
    let y = packets[(b * 4u + phase) * ${e.wordCount}u + j - 1u];
    if (x != y) { return x > y; }
  } return false;
}
fn packet_position_weight(row: u32, phase: u32, high: u32) -> f32 {
  let at = (row * 4u + phase) * ${e.wordCount}u;
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
  for (var i = 0u; i < ${e.wordCount}u; i++) { if (packets[(template_row * 4u + phase - 1u) * ${e.wordCount}u + i] != 0u) { high = i; } }
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
`}async function b({device:e,format:t,layout:n,massBuffer:r,stateBuffer:i,thermoBuffer:a,mechanicsBuffer:c,quantityBuffer:l,materialMolars:u,allocate:f,validate:p}){let m=n.rowCount,h=n.scalar.recordWords,g=n.recordWords,_=e.limits.minUniformBufferOffsetAlignment,v=[[2,0,1,8],[2,0,2,9],[2,0,3,10],[2,1,1,11],[2,2,2,12],[0,11,12,11],[2,3,3,12],[0,11,12,11],[2,11,7,11],[0,11,4,11],[2,11,0,11],[2,5,6,12]],y=f({label:`ulg-phase-initial-quantity-scratch`,size:m*13*h*4,usage:136}),b=f({label:`ulg-phase-initial-molar-identities`,size:Math.max(8,u.byteLength),usage:136}),x=f({label:`ulg-phase-initial-quantity-operations`,size:v.length*_,usage:72}),S=new Uint32Array(x.size/4);v.forEach((e,t)=>S.set(e,t*_/4)),e.queue.writeBuffer(x,0,S),e.queue.writeBuffer(b,0,u);let C=d({wordCount:n.scalar.wordCount})+`
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
`,w=[r,i,a,c,b,y,l,x],T=[];for(let r of[`seed_phase_initial_quantities`,`calculate_phase_initial_quantities`,`finish_phase_initial_quantities`]){let i=await o(e,{code:C,entryPoint:r,cacheKey:`ulg-${r}-v2:${t.wordCount}:${t.quantumExponent}:${m}:${n.scalar.wordCount}`,bindings:[...[,,,,,].fill(`read-only-storage`),`storage`,`storage`,`uniform`].map((e,t)=>s(t,e))});if(!i.pipeline)throw i.error??Error(`Initial phase quantities unavailable: ${r}`);T.push(i),p()}let E=(t,n,r=0)=>{let i=T[n],a=e.createBindGroup({layout:i.bindGroupLayout,entries:w.map((e,t)=>({binding:t,resource:t===7?{buffer:e,offset:r*_,size:16}:{buffer:e}}))}),o=t.beginComputePass();o.setPipeline(i.pipeline),o.setBindGroup(0,a),o.dispatchWorkgroups(Math.ceil(m/32)),o.end()};return{encode(e){p(),E(e,0),v.forEach((t,n)=>E(e,1,n)),E(e,2)}}}async function x(a){let l=a.exactThermalResult!=null;if(l===(a.exactReactionResult!=null)||!a.postMechanicsSourceCapture||a.retainOutputParticleBuffers!==!0||a.readbackMode!==`no-full-readback`)throw TypeError(`Exact phase transfer requires one original retained thermal or reaction capture`);let u,d,p,m,h;if(l){let{resolveSphThermalSourceCapture:e,acquireSphThermalExactMassSourceCapture:t}=await import(`./thermalPotentialGpu-DkLcy8o_.js`).then(e=>e.y);u=e(a.exactThermalResult,a.exactThermalSourceCapture),d=await t(a.exactThermalResult,a.exactThermalSourceCapture,{device:a.device,sphParticleUpload:a.sphParticleUpload,mlsMpmParticleUpload:a.mlsMpmParticleUpload,sphParticleState:a.sphParticleState,thermalMaterialTable:a.thermalMaterialTable,transaction:a.exactMassSpatialEpochTransaction,generation:a.exactMassSpatialEpochGeneration,g2pResult:a.exactMassG2pResult,dtSeconds:a.dtSeconds}),m=d.quantities,p={...m,format:d.format,particleCount:d.particleCount,stateBuffer:d.stateBuffer,thermoBuffer:d.thermoBuffer,mechanicsBuffer:d.mechanicsBuffer},h=d.inventoryGeneration}else{let{resolveSphReactionSourceCapture:e}=await import(`./sphReactionGpuKernel-EbjvxmXX.js`).then(e=>e.a);u=e(a.exactReactionResult,a.exactReactionSourceCapture),d=u.retain(),m=u.exactReaction,p=m?.destinationRead,h=m?.carrierMassRead.generation}let g=new Set,x=new Set,S=!1,C=!1,w=!1,T=null,E=null,D=null,ee=e=>{for(let t of e)t.destroy();e.clear()},O=()=>(w||(w=!0,T=S?c(a.device,()=>d.release()):Promise.resolve(d.release()),T.catch(()=>{})),T),k=()=>{let e=()=>(ee(x),ee(g),C=!0,O());return S?c(a.device,e):Promise.resolve().then(e)};try{let{device:T}=a,te=()=>{if(C||w)throw TypeError(`Exact phase source was released`);if(u.validate(),d.validate(),!p||a.device!==u.inputs.device||a.sphParticleState!==u.inputs.sphParticleState||!l&&a.mlsMpmParticleState!==u.inputs.mlsMpmParticleState||a.thermalMaterialTable!==u.inputs.thermalMaterialTable||a.sourceStateBuffer!==p.stateBuffer||a.sourceThermoBuffer!==p.thermoBuffer||a.sourceMechanicsBuffer!==p.mechanicsBuffer)throw TypeError(`Exact phase transfer requires its complete original captured source tuple`)};te();let A=p.particleCount,j=p.format,M=e(a.phaseCarrierPlan,A);if(M.accepted!==!0||M.phaseLaneCount!==4||M.lineageCapacity*4!==A||M.phaseLaneStride!==M.lineageCapacity)throw TypeError(`Exact phase transfer requires four complete phase lanes`);let N=Object.entries(a.phaseCarrierPlan),P=r(a.thermalMaterialTable,a.mechanicsMaterialTable),{resolveThermalResponseGraphArtifacts:F}=await import(`./thermalPotentialGpu-DkLcy8o_.js`).then(e=>e.y),I=F({thermalMaterialTable:a.thermalMaterialTable,requireExactContent:!0}),L=I.thermalPhaseResponseTable,R=I.thermalClosureGraphBank,z=new Float32Array(L.responses.length+R.nodeRows.length+R.sampleRows.length);z.set(L.responses),z.set(R.nodeRows,L.responses.length),z.set(R.sampleRows,L.responses.length+R.nodeRows.length);let B=()=>{if(te(),Object.keys(a.phaseCarrierPlan).length!==N.length||N.some(([e,t])=>a.phaseCarrierPlan[e]!==t))throw TypeError(`Exact phase plan changed during preparation`);let e=r(a.thermalMaterialTable,a.mechanicsMaterialTable).values;if(e.length!==P.values.length||new Uint32Array(e.buffer).some((e,t)=>e!==new Uint32Array(P.values.buffer)[t]))throw TypeError(`Exact phase material tables changed during preparation`)},V=(e,t=!1)=>{if(!Number.isSafeInteger(e.size)||e.size<4||e.size>T.limits.maxBufferSize||e.usage&128&&e.size>T.limits.maxStorageBufferBindingSize)throw RangeError(`Exact phase allocation exceeds device capacity`);let n=f(T.createBuffer(e),T);return(t?g:x).add(n),n},H=(e,t,n=!1,r=140)=>V({label:`ulg-exact-phase-${e}`,size:t,usage:r},n),ne=(e,t,n=136)=>{let r=H(e,Math.max(4,t.byteLength),!1,n);return T.queue.writeBuffer(r,0,t),r},re=p.quantityLayout??t(j,{particleCount:A,eventCapacity:1}),U=Object.freeze({...re,rowCount:A,wordLength:A*re.recordWords}),W=H(`source-quantities`,U.wordLength*4);if(p.quantityBuffer&&p.quantityBuffer.size<W.size)throw TypeError(`Incomplete exact phase source quantities`);let G=H(`source-mass`,A*j.wordCount*4),K=null;if(!p.quantityBuffer){if(!l||d.quantities||d.sourceRead.quantities||d.sourceRead.read.rowCount!==A||!(a.thermalMaterialTable.molarMassIdentities instanceof Uint32Array))throw TypeError(`Initial phase quantities require the original uncaptured thermal tuple and molecular identities`);K=await b({device:T,format:j,layout:U,massBuffer:G,stateBuffer:p.stateBuffer,thermoBuffer:p.thermoBuffer,mechanicsBuffer:p.mechanicsBuffer,quantityBuffer:W,materialMolars:a.thermalMaterialTable.molarMassIdentities,allocate:V,validate:B})}let q=H(`geometry`,A*32),J=await _({device:T,format:j,lineageCapacity:M.lineageCapacity,sourceMassBuffer:G,sourceThermoBuffer:p.thermoBuffer,allocate:V,validate:B}),Y=await v({device:T,format:j,layout:U,sourceQuantityBuffer:W,packetMassBuffer:J.packetMassBuffer,candidateMassBuffer:J.massBuffer,geometryBuffer:q,validationBuffer:J.validationBuffer,lineageCapacity:M.lineageCapacity,allocate:V,validate:B});x.delete(Y.quantityBuffer),g.add(Y.quantityBuffer);let X=H(`state`,A*32,!0),Z=H(`thermo`,A*48,!0),Q=H(`mechanics`,A*128,!0),ie=[X,Z,Q,Y.quantityBuffer];l?i(d.sourceRead,ie):await n(p,ie,{device:T});let ae=ne(`closure`,P.values),oe=ne(`caloric`,z),se=new ArrayBuffer(80),$=new Uint32Array(se),ce=new Float32Array(se);$.set([A,M.lineageCapacity,4,M.lineageCapacity,P.thermalSegmentCount,P.mechanicsRecordCount,P.thermalOffsetVec4,P.mechanicsOffsetVec4,254]),ce[9]=1e-7,ce[10]=2e-4,$[12]=P.materialRecordCount,$[13]=P.materialRecordOffsetVec4,$[14]=+(a.absolutePressureAuthority===!0),$.set([L.responseCount,L.responses.length/4,(L.responses.length+R.nodeRows.length)/4,R.graphCount],16);let le=ne(`physical-params`,se,72),ue=y(j),de=[p.stateBuffer,p.thermoBuffer,p.mechanicsBuffer,ae,J.packetMassBuffer,q,Y.projectionBuffer,oe,X,Z,Q,J.validationBuffer,le],fe=[...[,,,,,].fill(`read-only-storage`),`storage`,`read-only-storage`,`read-only-storage`,...[,,,,].fill(`storage`),`uniform`],pe=[];for(let e of[`prepare_phase_geometry`,`apply_phase_physical`,`restore_rejected_phase_physical`]){let t=await o(T,{code:ue,entryPoint:e,label:e,cacheKey:`ulg-exact-${e}-v1:${j.wordCount}`,bindings:fe.map((e,t)=>s(t,e))});if(!t.pipeline)throw t.error??Error(`Phase physical pipeline unavailable: ${e}`);pe.push({pipeline:t,group:T.createBindGroup({layout:t.bindGroupLayout,entries:de.map((e,t)=>({binding:t,resource:{buffer:e}}))})}),B()}let me=await o(T,{code:`@group(0) @binding(0) var<storage, read> q: array<u32>;
@group(0) @binding(1) var<storage, read_write> m: array<u32>;
@compute @workgroup_size(64) fn gather_phase_source(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&m)){m[i]=q[(i/${j.wordCount}u)*${U.recordWords}u+16u+i%${j.wordCount}u];}}`,entryPoint:`gather_phase_source`,cacheKey:`ulg-phase-source-mass-v1:${j.wordCount}:${U.recordWords}`,bindings:[`read-only-storage`,`storage`].map((e,t)=>s(t,e))});if(!me.pipeline)throw me.error??Error(`Phase source mass gather unavailable`);let he=T.createBindGroup({layout:me.bindGroupLayout,entries:[W,G].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ge=(e,t,n,r)=>{let i=e.beginComputePass();i.setPipeline(t.pipeline),i.setBindGroup(0,n),i.dispatchWorkgroups(r),i.end()},_e={state:X,thermo:Z,mechanics:Q},ve=e=>{for(let[t,n]of Object.entries(_e))e[t]&&g.delete(n)&&(n.destroy(),C=!0,ye[`owns${t[0].toUpperCase()}${t.slice(1)}Buffer`]=!1);return Object.values(_e).some(e=>g.has(e))||(g.delete(Y.quantityBuffer)&&Y.quantityBuffer.destroy(),g.delete(J.validationBuffer)&&J.validationBuffer.destroy(),C=!0),!0},ye={schema:`peercompute.ulg.sph-phase-carrier-transfer.v2`,status:`phase-carrier-transfer-submitted`,backend:`webgpu`,readbackMode:a.readbackMode,particleCount:A,phaseCarrierPlan:{...a.phaseCarrierPlan},stateBuffer:X,thermoBuffer:Z,mechanicsBuffer:Q,stateBufferByteLength:X.size,thermoBufferByteLength:Z.size,mechanicsBufferByteLength:Q.size,ownsStateBuffer:!0,ownsThermoBuffer:!0,ownsMechanicsBuffer:!0,retainedOutputParticleBuffers:!0,state:new Float32Array,thermo:new Float32Array,mechanics:new Float32Array,exactValidationBuffer:J.validationBuffer,destroyOutputParticleBuffers:()=>ve({state:!0,thermo:!0,mechanics:!0}),destroyOutputParticleBufferComponents:ve};return x.delete(J.validationBuffer),g.add(J.validationBuffer),{result:ye,exactPhase:Object.freeze({quantityBuffer:Y.quantityBuffer,quantityLayout:U,format:j,particleCount:A,sourceInventoryGeneration:h,source:m??u,stateBuffer:X,thermoBuffer:Z,mechanicsBuffer:Q,get carrierMassRead(){return D},markDerivedBuffers(e){return l?i(d.sourceRead,e):n(p,e,{device:T})}}),releaseSource:O,abandon:k,releaseQuantityStorage(){return c(T,()=>{for(let e of[Y.quantityBuffer,J.validationBuffer])g.delete(e)&&e.destroy()})},validateOutput(){if(C)throw TypeError(`Exact phase output retired`);return!0},encode(e){B(),K?(e.copyBufferToBuffer(d.sourceRead.read.buffer,d.sourceRead.read.byteOffset,G,0,G.size),K.encode(e)):e.copyBufferToBuffer(p.quantityBuffer,0,W,0,W.size),ge(e,me,he,Math.ceil(A*j.wordCount/64)),J.encode(e),ge(e,pe[0].pipeline,pe[0].group,Math.ceil(A/64)),Y.encode(e);for(let t of pe.slice(1))ge(e,t.pipeline,t.group,Math.ceil(A/64));Y.commit(e)},markSubmitted(){S=!0},cleanupSubmittedWork(){ee(x)},cleanupRetainedOutput:ye.destroyOutputParticleBuffers,cleanupRetainedOutputComponents:ve,async completeInventory(e,t){let{createSphExactMassInventoryFromPhaseTransferWebGpu:n,acquireSphExactMassRead:r}=await import(`./sphExactMassInventoryGpu-BsMxVd5z.js`).then(e=>e.c);E=await n({device:T,result:e,token:t}),D=r({device:T,family:E})},async releaseInventory(){let{releaseSphExactMassRead:e,releaseSphExactMassInventory:t}=await import(`./sphExactMassInventoryGpu-BsMxVd5z.js`).then(e=>e.c);D&&await e(D),E&&await t(E)}}}catch(e){let t=k();throw t.catch(()=>{}),e.exactPhaseCleanupCompletion=t,e}}export{x as prepareSphExactPhaseCarrierStage};