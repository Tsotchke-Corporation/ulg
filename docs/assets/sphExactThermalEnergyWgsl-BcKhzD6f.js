import{c as e,l as t}from"./webgpuComputeLayout-DLLtg7sT.js";import{n,s as r,t as i}from"./sphExactMassInventory-FFefHwOc.js";import{t as a}from"./sphExactMassWgsl-ChqpSzqB.js";function o(e){return r(e),`
fn el_negative(a: ExactMass) -> bool { return (a.words[EM_WORDS - 1u] & 0x80000000u) != 0u; }
fn el_negate(a: ExactMass) -> ExactMass {
  var result: ExactMass; var carry = 1u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let inverted = ~a.words[i]; let sum = inverted + carry;
    carry = select(0u, 1u, sum < inverted);
    result.words[i] = sum;
  }
  return result;
}
// Magnitude of a signed value. The minimum value has no magnitude in range and
// returns OVERFLOW.
fn el_magnitude(a: ExactMass) -> ExactMassResult {
  if (!el_negative(a)) { return ExactMassResult(a, 0u); }
  let magnitude = el_negate(a);
  if (el_negative(magnitude)) { return ExactMassResult(a, ${i.OVERFLOW}u); }
  return ExactMassResult(magnitude, 0u);
}
fn el_add(a: ExactMass, b: ExactMass) -> ExactMassResult {
  var result: ExactMass; var carry = 0u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let first = a.words[i] + b.words[i];
    let second = first + carry;
    carry = select(0u, 1u, first < a.words[i] || second < first);
    result.words[i] = second;
  }
  if (el_negative(a) == el_negative(b) && el_negative(result) != el_negative(a)) {
    return ExactMassResult(a, ${i.OVERFLOW}u);
  }
  return ExactMassResult(result, 0u);
}
fn el_subtract(a: ExactMass, b: ExactMass) -> ExactMassResult {
  var result: ExactMass; var borrow = 0u;
  for (var i = 0u; i < EM_WORDS; i++) {
    let first = a.words[i] - b.words[i];
    let second = first - borrow;
    borrow = select(0u, 1u, a.words[i] < b.words[i] || first < borrow);
    result.words[i] = second;
  }
  if (el_negative(a) != el_negative(b) && el_negative(result) != el_negative(a)) {
    return ExactMassResult(a, ${i.OVERFLOW}u);
  }
  return ExactMassResult(result, 0u);
}
fn el_compare(a: ExactMass, b: ExactMass) -> i32 {
  let top_a = bitcast<i32>(a.words[EM_WORDS - 1u]);
  let top_b = bitcast<i32>(b.words[EM_WORDS - 1u]);
  if (top_a < top_b) { return -1; }
  if (top_a > top_b) { return 1; }
  for (var i = i32(EM_WORDS) - 2; i >= 0; i--) {
    if (a.words[u32(i)] < b.words[u32(i)]) { return -1; }
    if (a.words[u32(i)] > b.words[u32(i)]) { return 1; }
  }
  return 0;
}
// A finite f32 packet as exact signed quanta. The 24-bit coefficient lands in
// at most two adjacent words, so this is one W-word select loop. A packet that
// needs the sign bit, or is finer than the run quantum, is rejected rather
// than rounded.
fn el_from_f32_bits(bits: u32) -> ExactMassResult {
  let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { return ExactMassResult(ExactMass(), ${i.INVALID_FLOAT}u); }
  var coefficient = bits & 0x007fffffu; var exponent = -149i;
  if (encoded != 0u) { coefficient |= 0x00800000u; exponent = i32(encoded) - 150; }
  var shift = exponent - EM_QUANTUM;
  if (shift < 0) {
    let dropped = u32(-shift);
    let mask = select((1u << dropped) - 1u, 0xffffffffu, dropped >= 24u);
    if ((coefficient & mask) != 0u) { return ExactMassResult(ExactMass(), ${i.INEXACT_INPUT}u); }
    coefficient = select(coefficient >> dropped, 0u, dropped >= 24u);
    shift = 0;
  }
  if (coefficient == 0u) { return ExactMassResult(ExactMass(), 0u); }
  let word = u32(shift) / 32u; let offset = u32(shift) % 32u;
  let low = coefficient << offset;
  let high = select(0u, coefficient >> (32u - offset), offset != 0u);
  let top = select(word, word + 1u, high != 0u);
  if (top >= EM_WORDS || (top == EM_WORDS - 1u && (select(low, high, high != 0u) & 0x80000000u) != 0u)) {
    return ExactMassResult(ExactMass(), ${i.OVERFLOW}u);
  }
  var result: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) {
    result.words[i] = select(0u, low, i == word) | select(0u, high, i == word + 1u);
  }
  if ((bits & 0x80000000u) != 0u) { result = el_negate(result); }
  return ExactMassResult(result, 0u);
}
// Nearest-even f32 bits of a signed value: the view the f32 solver reads.
fn el_project_f32_bits(a: ExactMass) -> ExactMassProjection {
  let magnitude = el_magnitude(a);
  if (magnitude.error != 0u) { return ExactMassProjection(0u, ${i.PROJECTION_OVERFLOW}u); }
  let projection = em_project_f32_bits(magnitude.value);
  if (!el_negative(a) || projection.error != 0u || projection.bits == 0u) { return projection; }
  return ExactMassProjection(projection.bits | 0x80000000u, 0u);
}
`}function s(e,{prefix:t,counters:n,stride:a=4*e.wordCount,offset:o=0}){if(r(e),!/^[a-z][a-z0-9_]*$/.test(t)||!/^[a-z][a-z0-9_]*$/.test(n))throw TypeError(`Scatter prefix and counter names must be WGSL identifiers`);if(!Number.isInteger(a)||a<0||!Number.isInteger(o)||o<0)throw RangeError(`Scatter stride and offset must be nonnegative integers`);let s=2*e.wordCount;return`
fn ${t}_base(row: u32, negative: bool) -> u32 {
  return row * ${a}u + ${o}u + select(0u, ${s}u, negative);
}
fn ${t}_add_chunk(base: u32, chunk: u32, digit: u32) -> u32 {
  if (digit == 0u) { return 0u; }
  if (chunk >= ${s}u) { return ${i.OVERFLOW}u; }
  atomicAdd(&${n}[base + chunk], digit);
  return 0u;
}
// Scatter one finite f32 packet as exact quanta: at most three atomic adds.
fn ${t}_scatter_f32(row: u32, bits: u32) -> u32 {
  let encoded = (bits >> 23u) & 255u;
  if (encoded == 255u) { return ${i.INVALID_FLOAT}u; }
  var coefficient = bits & 0x007fffffu; var exponent = -149i;
  if (encoded != 0u) { coefficient |= 0x00800000u; exponent = i32(encoded) - 150; }
  if (coefficient == 0u) { return 0u; }
  let shift = exponent - EM_QUANTUM;
  if (shift < 0) { return ${i.INEXACT_INPUT}u; }
  let chunk = u32(shift) / 16u; let offset = u32(shift) % 16u;
  let shifted = coefficient << offset;
  let base = ${t}_base(row, (bits & 0x80000000u) != 0u);
  var error = ${t}_add_chunk(base, chunk, shifted & 0xffffu);
  error |= ${t}_add_chunk(base, chunk + 1u, shifted >> 16u);
  error |= ${t}_add_chunk(base, chunk + 2u, select(0u, coefficient >> (32u - offset), offset != 0u));
  return error;
}
// Scatter a full-width signed value (a whole ledger moving, for example).
fn ${t}_scatter_value(row: u32, value: ExactMass) -> u32 {
  let magnitude = el_magnitude(value);
  if (magnitude.error != 0u) { return magnitude.error; }
  let base = ${t}_base(row, el_negative(value));
  for (var i = 0u; i < EM_WORDS; i++) {
    let word = magnitude.value.words[i];
    ${t}_add_chunk(base, 2u * i, word & 0xffffu);
    ${t}_add_chunk(base, 2u * i + 1u, word >> 16u);
  }
  return 0u;
}
// Add raw counters (already chunk sums) from another accumulator.
fn ${t}_add_counter(row: u32, index: u32, counter: u32) {
  if (counter != 0u) { atomicAdd(&${n}[row * ${a}u + ${o}u + index], counter); }
}
fn ${t}_drain_half(base: u32) -> ExactMassResult {
  var result: ExactMass; var carry = 0u;
  for (var chunk = 0u; chunk < ${s}u; chunk++) {
    let counter = atomicExchange(&${n}[base + chunk], 0u);
    let sum = counter + carry;
    let wrapped = select(0u, 1u, sum < counter);
    let digit = sum & 0xffffu;
    carry = (sum >> 16u) | (wrapped << 16u);
    if ((chunk & 1u) == 0u) { result.words[chunk / 2u] = digit; }
    else { result.words[chunk / 2u] |= digit << 16u; }
  }
  if (carry != 0u || el_negative(result)) { return ExactMassResult(result, ${i.OVERFLOW}u); }
  return ExactMassResult(result, 0u);
}
// The row's signed total since the last drain; the counters are cleared.
fn ${t}_drain(row: u32) -> ExactMassResult {
  let positive = ${t}_drain_half(${t}_base(row, false));
  let negative = ${t}_drain_half(${t}_base(row, true));
  let error = positive.error | negative.error;
  if (error != 0u) { return ExactMassResult(ExactMass(), error); }
  return el_subtract(positive.value, negative.value);
}
`}const c=`peercompute.ulg.sph-thermal-environment-authority.v0`,l=`peercompute.ulg.sph-wall-reservoir-authority.v0`,u=Object.freeze([`xMin`,`xMax`,`yMin`,`yMax`,`zMin`,`zMax`]),d=`adiabatic`,f=`finite-heat-capacity-lumped-face`;function p(e,t){let n=Number(e);if(!Number.isFinite(n))throw RangeError(`${t} must be finite`);return Math.max(0,n)}function m(e,{label:t,readyStatus:n}){if(e.status!==n)throw TypeError(`${t}.status must be ${n}`);if(e.authoritative!==!0)throw TypeError(`${t}.authoritative must be true`);if(typeof e.source!=`string`||e.source.trim().length===0)throw TypeError(`${t}.source must be a nonempty string`);if(typeof e.defaultApplied!=`boolean`)throw TypeError(`${t}.defaultApplied must be boolean`)}function h({ambientTemperatureK:e,thermalEnvironmentAuthority:t=null,defaultAmbientTemperatureK:n=293,source:r=`thermal-step-caller`,defaultSource:i=`sph-thermal-kernel-default`,sourceScenarioId:a=null}={}){let o=t!=null;if(o&&t?.schema!==`peercompute.ulg.sph-thermal-environment-authority.v0`)throw TypeError(`thermalEnvironmentAuthority must use ${c}`);o&&m(t,{label:`thermalEnvironmentAuthority`,readyStatus:`thermal-environment-authority-ready`});let s=e!==void 0,l=o?p(t.ambientTemperatureK,`thermalEnvironmentAuthority.ambientTemperatureK`):null,u=s?p(e,`ambientTemperatureK`):null;if(s&&o&&u!==l)throw RangeError(`ambientTemperatureK must match thermalEnvironmentAuthority.ambientTemperatureK`);let d=!s&&!o,f=s?u:o?l:p(n,`defaultAmbientTemperatureK`);return Object.freeze({schema:c,status:`thermal-environment-authority-ready`,ambientTemperatureK:f,source:o?t.source:d?i:r,sourceScenarioId:t?.sourceScenarioId??a??null,defaultApplied:o?t.defaultApplied===!0:d,inheritedAuthority:o,authoritative:!0,scientificValidation:!1,fullPhysicsValidation:!1})}function g(e,t){let n=Number(e);if(!Number.isFinite(n))throw RangeError(`${t} must be finite`);return n}function _(e,t){if(e!==`infinite-fixed-temperature-reservoir`&&e!==`adiabatic`&&e!==`finite-heat-capacity-lumped-face`)throw RangeError(`${t} must be infinite-fixed-temperature-reservoir, ${d} or ${f}`);return e}function v(e,t){let n={};for(let r of u){let i=Number(e?.[r]);if(!Number.isFinite(i)||!(i>0))throw RangeError(`${t}.${r} must be a positive finite J/K`);n[r]=i}return Object.freeze(n)}function y(){return globalThis.crypto?.randomUUID?.()||`wall-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}function b(e,t,{requireEveryFace:n=!1,label:r=`wallTemperaturesK`}={}){let i={};for(let a of u){if(n&&!Object.prototype.hasOwnProperty.call(e||{},a))throw TypeError(`${r}.${a} is required`);i[a]=g(e?.[a]??t,`${r}.${a}`)}return Object.freeze(i)}function x({wallTemperaturesK:e,wallReservoirAuthority:t=null,wallModel:n,wallFaceHeatCapacitiesJPerK:r=null,wallMaterial:i=null,wallThicknessM:a=null,defaultWallTemperatureK:o=0,source:s=`thermal-step-caller`,defaultSource:c=`sph-thermal-kernel-default`,sourceScenarioId:p=null}={}){let h=t!=null;if(h&&t?.schema!==`peercompute.ulg.sph-wall-reservoir-authority.v0`)throw TypeError(`wallReservoirAuthority must use ${l}`);h&&m(t,{label:`wallReservoirAuthority`,readyStatus:`wall-reservoir-authority-ready`});let g=h?_(t.model,`wallReservoirAuthority.model`):null,x=n===void 0?null:_(n,`wallModel`);if(h&&x!=null&&x!==g)throw RangeError(`wallModel must match wallReservoirAuthority.model`);let S=h?b(t.faces,o,{requireEveryFace:!0,label:`wallReservoirAuthority.faces`}):null;if(h&&t.exchangeEnabled!==(g!==`adiabatic`))throw TypeError(`wallReservoirAuthority.exchangeEnabled must match wallReservoirAuthority.model`);if(h&&t.finiteCapacity!==(g===`finite-heat-capacity-lumped-face`))throw TypeError(`wallReservoirAuthority.finiteCapacity must match wallReservoirAuthority.model`);let C=e!==void 0,w=C?b(e,o):null;if(h&&C){for(let e of u)if(w[e]!==S[e])throw RangeError(`wallTemperaturesK.${e} must match wallReservoirAuthority.faces.${e}`)}let T=!h&&!C&&x==null,E=g??x??`infinite-fixed-temperature-reservoir`,D=S??w??b(void 0,o),O=E===f,k=O?v(h?t.faceHeatCapacitiesJPerK:r,h?`wallReservoirAuthority.faceHeatCapacitiesJPerK`:`wallFaceHeatCapacitiesJPerK`):null,A=O?String(h?t.instanceId||``:y()):null;if(O&&!A)throw TypeError(`wallReservoirAuthority.instanceId is required for finite walls`);return Object.freeze({schema:l,status:`wall-reservoir-authority-ready`,model:E,faces:D,exchangeEnabled:E!==d,finiteCapacity:O,...O?{faceHeatCapacitiesJPerK:k,instanceId:A,wallMaterial:h?t.wallMaterial??null:i,wallThicknessM:h?t.wallThicknessM??null:a}:{},source:h?t.source:T?c:s,sourceScenarioId:t?.sourceScenarioId??p??null,defaultApplied:h?t.defaultApplied===!0:T,inheritedAuthority:h,authoritative:!0,scientificValidation:!1,fullPhysicsValidation:!1})}const S=1180126257,C=1180124465,w=Object.freeze({STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8});function T(e){return`
fn finite_wall_energy_add(face: u32, energy_j: f32) {
  if (face >= 6u || energy_j == 0.0 || energy_j != energy_j
      || arrayLength(&${e}) < 64u) { return; }
  let word = 12u + face;
  var prior = atomicLoad(&${e}[word]);
  loop {
    let next = bitcast<u32>(bitcast<f32>(prior) + energy_j);
    let exchanged = atomicCompareExchangeWeak(&${e}[word], prior, next);
    if (exchanged.exchanged) { break; }
    prior = exchanged.old_value;
  }
}
`}const E=`
@group(0) @binding(0) var<storage, read_write> wall: array<atomic<u32>>;

@compute @workgroup_size(1)
fn update_finite_walls() {
  if (arrayLength(&wall) < 64u
      || atomicLoad(&wall[24u]) != ${S}u) { return; }
  if (arrayLength(&wall) >= 128u) {
    atomicStore(&wall[126u], 1u);
    if (atomicLoad(&wall[25u]) != 3u) { return; }
  }
  for (var face = 0u; face < 6u; face = face + 1u) {
    let energy = bitcast<f32>(atomicExchange(&wall[12u + face], 0u));
    let capacity = bitcast<f32>(atomicLoad(&wall[6u + face]));
    if (!(capacity > 0.0) || energy != energy) { continue; }
    // Exact cumulative energy: a signed 64-bit count of microjoule quanta.
    let quanta = i32(clamp(round(energy / 1.0e-6),
      -2147483520.0, 2147483520.0));
    let lo = atomicLoad(&wall[48u + face]);
    let hi = atomicLoad(&wall[54u + face]);
    let add_lo = bitcast<u32>(quanta);
    let add_hi = select(0u, 0xffffffffu, quanta < 0);
    let next_lo = lo + add_lo;
    let carry = select(0u, 1u, next_lo < lo);
    let next_hi = hi + add_hi + carry;
    atomicStore(&wall[48u + face], next_lo);
    atomicStore(&wall[54u + face], next_hi);
    let total = f32(bitcast<i32>(next_hi)) * (4294967296.0 * 1.0e-6)
      + f32(next_lo) * 1.0e-6;
    atomicStore(&wall[18u + face], bitcast<u32>(total));
    let initial = bitcast<f32>(atomicLoad(&wall[32u + face]));
    atomicStore(&wall[face], bitcast<u32>(max(0.0, initial + total / capacity)));
  }
  atomicAdd(&wall[26u], 1u);
}
`,D=new WeakMap,O=new WeakMap;function k(e){let t=new ArrayBuffer(512),n=new Float32Array(t),r=new Uint32Array(t);return u.forEach((t,r)=>{n[r]=Number(e.faces[t]),n[6+r]=Number(e.faceHeatCapacitiesJPerK[t]),n[32+r]=Number(e.faces[t])}),r[24]=S,r[25]=3,r[118]=C,r[119]=1,t}function A(n,r){if(r?.model!==`finite-heat-capacity-lumped-face`||r.finiteCapacity!==!0||!r.instanceId||!n?.createBuffer)return null;let i=D.get(n);i||(i=new Map,D.set(n,i));let a=i.get(r.instanceId);if(a)return i.delete(r.instanceId),i.set(r.instanceId,a),a;if(i.size>=4){let e=[...i.entries()].find(([,e])=>!O.get(e).borrows);if(!e)throw RangeError(`All finite wall cache owners are retained`);let[t,n]=e;i.delete(t);let r=O.get(n);r.evicted=!0,r.retire()}let o=n.createBuffer({label:`ulg-sph-finite-wall-state`,size:512,usage:w.STORAGE|w.COPY_SRC|w.COPY_DST});n.queue.writeBuffer(o,0,k(r));let s=t(n,{cacheKey:`ulg-sph-finite-wall-update.v4-canonical-invalidation`,label:`ulg-sph-finite-wall-update`,code:E,entryPoint:`update_finite_walls`,bindings:[e(0,`storage`)]}),c=n.createBindGroup({layout:s.bindGroupLayout,entries:[{binding:0,resource:{buffer:o}}]}),l=o.destroy.bind(o),u={device:n,borrows:0,evicted:!1,retired:!1,retire(){!this.evicted||this.borrows||this.retired||(this.retired=!0,n.queue.onSubmittedWorkDone().then(l).catch(()=>{}))}};o.destroy=()=>{if(u.borrows)throw TypeError(`Finite wall state is retained by a canonical candidate`);u.retired=!0,l()};let d=Object.freeze({instanceId:r.instanceId,buffer:o,encodeTemperatureCopy(e,t,n,r=6,i=0){e.copyBufferToBuffer(o,i*4,t,n,r*4)},encodeUpdate(e){if(u.borrows||u.retired)throw TypeError(`Finite wall state has an active canonical reader or is retired`);let t=e.beginComputePass({label:`ulg-sph-finite-wall-update`});t.setPipeline(s.pipeline),t.setBindGroup(0,c),t.dispatchWorkgroups(1),t.end()}});return O.set(d,u),i.set(r.instanceId,d),d}function j(e,t){let n=O.get(t);if(!n||n.device!==e||n.retired||n.borrows)throw TypeError(`Finite wall candidate requires an available original wall owner`);n.borrows++;let r=!0;return Object.freeze({buffer:t.buffer,instanceId:t.instanceId,validate(){if(!r||n.retired)throw TypeError(`Finite wall source read was retired`);return!0},release(){return r?(r=!1,n.borrows--,n.retire(),!0):!1}})}const M=n(),N=M.wordCount,P=Object.freeze({ROW_REJECTED:1,ARITHMETIC:2,OUTSIDE_DOMAIN:4,UNLEDGERED_WRITER:8,ROUTE:16});function F(e){if(!Number.isSafeInteger(e)||e<1)throw RangeError(`Exact energy record requires a positive row count`);return 2*e*N+4}const I=N,L=P;function R(){return`
struct MechanicsHeatPacket { value:ExactMass, error:u32, recorded:u32 };
fn mechanics_heat_packet(energy:ExactMass,mass:f32,incoming_u:f32)->MechanicsHeatPacket {
  var out=MechanicsHeatPacket();
  let incoming=el_project_f32_bits(energy);
  if(!(mass>0.0) || !(abs(incoming_u)<=3.402823e38) || abs(incoming_u)>3.402823e38/mass){out.error=1u;return out;}
  let seeded=el_from_f32_bits(bitcast<u32>(mass*incoming_u));
  let is_projection=incoming.error==0u && bitcast<f32>(incoming.bits)/mass==incoming_u;
  let is_seed=seeded.error==0u && el_compare(seeded.value,energy)==0;
  if(!is_projection && !is_seed){
    let heat=el_from_f32_bits(bitcast<u32>(mass*incoming_u-bitcast<f32>(incoming.bits)));
    out.value=heat.value;out.error=incoming.error|heat.error;out.recorded=1u;
  }
  return out;
}`}function z(e,t,n,r){let i=e.indexOf(t);if(i<0||e.indexOf(t,i+t.length)>=0)throw Error(`Exact thermal energy WGSL anchor drifted: ${r}`);return e.slice(0,i)+n+e.slice(i+t.length)}const B=`
${a(M)}
${o(M)}
${R()}

fn thermal_energy_load(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = atomicLoad(&exact_energy_rows[word + i]); }
  return value;
}

fn thermal_energy_store(word: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&exact_energy_rows[word + i], value.words[i]); }
}

fn thermal_energy_control_word() -> u32 {
  return 2u * params.particle_count * EM_WORDS;
}

fn thermal_energy_fail(errors: u32) {
  atomicOr(&exact_energy_rows[thermal_energy_control_word()], errors);
}

// Applies this row's exact pair net and its source packet, and returns the
// projected specific energy the f32 solver continues from. The f32 thermal
// result is replaced, never blended: u is the ledger's view.
// Move v by n ulps toward +inf (n > 0) or -inf (n < 0); zero steps to the
// smallest subnormal.
fn thermal_energy_ulp_step(v: f32, n: i32) -> f32 {
  if (v == 0.0) { return select(-1.0e-45, 1.0e-45, n > 0); }
  let bits = bitcast<i32>(v);
  return bitcast<f32>(select(bits - n, bits + n, v > 0.0));
}
fn thermal_exact_energy_finish(
  particle_index: u32,
  mass: f32,
  incoming_u: f32,
  source_du: f32,
  row_admitted: bool,
  domain_ready: bool,
  domain: vec2<f32>,
  fallback_u: f32
) -> f32 {
  let rows = params.particle_count * EM_WORDS;
  let u_word = particle_index * EM_WORDS;
  let s_word = rows + u_word;
  let ledger_energy = thermal_energy_load(u_word);
  var errors = 0u;
  // The incoming u is this ledger's own projection, the cold seed's factor
  // (U0 = fl32(m*u)), or the record plus mechanics heat: field wall and
  // contact heat deposited by G2P, pair-contact heat and surface-stress work
  // reach u between ledger steps. That heat is a recorded source (user,
  // 2026-10-27: "mechanics heat and wall heat as recorded sources"), booked
  // here as one exact packet m*u_in - U_view. Only a non-finite or
  // unrepresentable change fails the ledger.
  let heat=mechanics_heat_packet(ledger_energy,mass,incoming_u);
  var mechanics_heat=ExactMass();
  if(heat.error!=0u){errors|=${L.UNLEDGERED_WRITER}u;}
  else {
    mechanics_heat=heat.value;
    if(heat.recorded!=0u){atomicOr(&exact_energy_rows[thermal_energy_control_word()+1u],
      2u);}
  }
  let with_heat = el_add(ledger_energy, mechanics_heat);
  let energy = with_heat.value;
  var net: ExactMass;
  if (canonical_thermal_proposal_header_valid()) {
    if (row_admitted) {
      let base = THERMAL_PROPOSAL_HEADER_WORDS
        + params.particle_count * THERMAL_PROPOSAL_ROW_WORDS + particle_index * EM_WORDS;
      for (var i = 0u; i < EM_WORDS; i++) { net.words[i] = thermal_bins[base + i]; }
    } else {
      // The partner rows applied their halves; refusing this one would
      // otherwise silently create or destroy energy.
      errors |= ${L.ROW_REJECTED}u;
    }
  } else {
    atomicOr(&exact_energy_rows[thermal_energy_control_word() + 1u],
      1u);
    atomicAdd(&exact_energy_rows[thermal_energy_control_word() + 2u], 1u);
  }
  atomicAdd(&exact_energy_rows[thermal_energy_control_word() + 3u], 1u);
  let source = el_from_f32_bits(bitcast<u32>(source_du * mass));
  let with_pairs = el_add(energy, net);
  let next_energy = el_add(with_pairs.value, source.value);
  let sources = el_add(source.value, mechanics_heat);
  let next_source = el_add(thermal_energy_load(s_word), sources.value);
  let projection = el_project_f32_bits(next_energy.value);
  if ((with_heat.error | source.error | with_pairs.error | next_energy.error | sources.error
      | next_source.error | projection.error) != 0u) {
    errors |= ${L.ARITHMETIC}u;
  }
  if (errors != 0u) {
    thermal_energy_fail(errors);
    return fallback_u;
  }
  thermal_energy_store(u_word, next_energy.value);
  thermal_energy_store(s_word, next_source.value);
  let projected_u = bitcast<f32>(projection.bits) / mass;
  // The f32 path's own next u is limited to its caloric bounds. Where it is
  // the exact view up to rounding (<= 8 ulps) it is the view: a lane row one
  // ulp under its segment edge cannot be classified, with or without a
  // proposal domain. U stays exact; the next step books the difference to S.
  let fallback_ulps = abs(bitcast<i32>(projected_u) - bitcast<i32>(fallback_u));
  let next_u = select(projected_u, fallback_u,
    (projected_u >= 0.0) == (fallback_u >= 0.0) && fallback_ulps <= 8);
  if (domain_ready) {
    // U stays exact; only the f32 view is kept inside the domain, 4 ulps in
    // from each bound: the proposal's bound and the caloric ladder's segment
    // edge can differ by an ulp, and a view on that edge is unclassifiable.
    // Beyond rounding (> 4 ulps outside) the state has left its caloric
    // model, which is flagged: no clamp may silently hide that. The next
    // ledger step books the view's difference to S as a mechanics source.
    var inner_lo = thermal_energy_ulp_step(domain.x, 4);
    var inner_hi = thermal_energy_ulp_step(domain.y, -4);
    if (inner_lo > inner_hi) { inner_lo = 0.5 * (domain.x + domain.y); inner_hi = inner_lo; }
    if (next_u < domain.x || next_u > domain.y) {
      let bound = clamp(next_u, domain.x, domain.y);
      let ulps = abs(bitcast<i32>(next_u) - bitcast<i32>(bound));
      if ((next_u >= 0.0) != (bound >= 0.0) || ulps > 4) {
        thermal_energy_fail(${L.OUTSIDE_DOMAIN}u);
      }
    }
    return clamp(next_u, inner_lo, inner_hi);
  }
  return next_u;
}
`;function V(e,{finiteWalls:t=!1}={}){let n=z(e,`@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;
`,`@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;
@group(0) @binding(11) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;
`,`binding 11`);n=z(n,`    && thermal_bins[6u] == 0u
`,`    && thermal_bins[6u] == ${I}u\n`,`proposal ledger header word`),n=z(n,`	  var conduction_du = 0.0;
`,`	  var conduction_du = 0.0;
	  var exact_row_admitted = false;
`,`row admission declaration`),n=z(n,`	        conduction_du = proposed_pair_du;
`,`	        conduction_du = proposed_pair_du;
	        exact_row_admitted = true;
`,`row admission`),n=z(n,`	      neighbor_max_temperature
	    );
	  }
`,`	      neighbor_max_temperature
	    );
	  }
	  let exact_du_before_sources = du;
`,`pair/source boundary`),n=z(n,`  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
`,`  if (params.canonical_proposal_enabled == 1u) {
    next_u = thermal_exact_energy_finish(particle_index, mass, vel_u.w,
      du - exact_du_before_sources, exact_row_admitted, canonical_reachable_domain_ready,
      canonical_reachable_domain.xy, next_u);
  } else {\n    thermal_energy_fail(${L.ROUTE}u);\n  }\n  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
`,`projected write`);let r=B;return t&&(n=z(n,T(`finite_wall_state`),`
fn finite_wall_exact_packet(row:u32,face:u32,energy_j:f32,prior:ExactMass) -> ExactMass {
  let packet=el_from_f32_bits(bitcast<u32>(energy_j));
  let opposite=el_subtract(ExactMass(),packet.value);
  let sum=el_add(prior,packet.value);
  if((packet.error|opposite.error|sum.error)!=0u) {thermal_energy_fail(${L.ARITHMETIC}u);}
  for(var w=0u;w<EM_WORDS;w++) {
    atomicStore(&finite_wall_state[(row*6u+face)*EM_WORDS+w],opposite.value.words[w]);
  }
  return sum.value;
}
`,`exact wall packet helper`),n=z(n,`	  let exact_du_before_sources = du;
`,`	  var exact_wall_source=ExactMass();
`,`wall source accumulator`),n=z(n,`finite_wall_energy_add(face, -mass * wall_applied_du);`,`exact_wall_source=finite_wall_exact_packet(particle_index,face,mass*wall_applied_du,exact_wall_source);`,`paired finite wall packet`),n=z(n,`	  // Radiative exchange with the ambient environment`,`	  let exact_du_before_sources=du;
	  // Radiative exchange with the ambient environment`,`ambient source boundary`),n=z(n,`      du - exact_du_before_sources, exact_row_admitted,`,`      du - exact_du_before_sources, exact_wall_source, exact_row_admitted,`,`wall source argument`),r=z(r,`  source_du: f32,
`,`  source_du: f32,
  wall_source: ExactMass,
`,`wall source parameter`),r=z(r,`  let source = el_from_f32_bits(bitcast<u32>(source_du * mass));`,`  let ambient = el_from_f32_bits(bitcast<u32>(source_du * mass));
  let source = el_add(ambient.value,wall_source);
  if(ambient.error!=0u) {errors|=${L.ARITHMETIC}u;}`,`exact wall and ambient sources`)),`${n}\n${r}`}export{F as a,T as c,l as d,h as f,o as h,V as i,A as l,s as m,M as n,C as o,x as p,N as r,j as s,P as t,c as u};