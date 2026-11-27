import{t as e}from"./sphExactMassWgsl-quqzAZyn.js";import{a as t,h as n,n as r,r as i}from"./sphExactThermalEnergyWgsl-7q9ex9fJ.js";import{S as a,c as o,n as s,u as c,x as l}from"./webgpuComputeLayout-tWh43k53.js";import{i as u,o as d}from"./sphGpuDeviceIdentity-CsdIpAMj.js";import{l as f,s as p,t as m,u as h}from"./sphExactMassInventoryGpu-ChibJisW.js";const g=Object.freeze({ORPHAN_ENERGY:32,ARITHMETIC:64}),_=Object.freeze({STORAGE:128,COPY_SRC:4,COPY_DST:8,UNIFORM:64}),v=`
${e(r)}
${n(r)}
struct ReconcileParams {
  lineage_count: u32,
  lane_stride: u32,
  particle_count: u32,
  mass_offset_words: u32,
};

@group(0) @binding(0) var<storage, read> input_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> out_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> mass_in: array<u32>;
@group(0) @binding(5) var<storage, read_write> mass_out: array<u32>;
@group(0) @binding(6) var<storage, read> energy_in: array<u32>;
@group(0) @binding(7) var<storage, read_write> energy_out: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ReconcileParams;

const LANES: u32 = 4u;
const ERROR_ORPHAN_ENERGY: u32 = ${g.ORPHAN_ENERGY}u;
const ERROR_ARITHMETIC: u32 = ${g.ARITHMETIC}u;

fn load_mass(row: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = mass_in[params.mass_offset_words + row * EM_WORDS + i]; }
  return value;
}
fn load_energy(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = energy_in[word + i]; }
  return value;
}
fn store_mass(row: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { mass_out[row * EM_WORDS + i] = value.words[i]; }
}
fn store_energy(word: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&energy_out[word + i], value.words[i]); }
}
fn kinetic_energy(state: vec4<f32>, velocity: vec4<f32>) -> f32 {
  return 0.5 * state.w * dot(velocity.xyz, velocity.xyz);
}

// Control words follow the U and S rows; the predecessor's are carried.
@compute @workgroup_size(4)
fn carry_ledger_control(@builtin(local_invocation_index) word: u32) {
  let base = 2u * params.particle_count * EM_WORDS;
  atomicStore(&energy_out[base + word], energy_in[base + word]);
}

@compute @workgroup_size(64)
fn reconcile_phase_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  let lineage = id.x;
  if (lineage >= params.lineage_count) { return; }
  let rows = params.particle_count * EM_WORDS;
  var mass_total: ExactMass;
  var energy_total: ExactMass;
  var source_total: ExactMass;
  var errors = 0u;
  var kinetic_in = 0.0;
  var kinetic_out = 0.0;
  var remainder_lane = LANES;
  var remainder_mass = -1.0;
  for (var lane = 0u; lane < LANES; lane++) {
    let row = lane * params.lane_stride + lineage;
    if (row >= params.particle_count) { continue; }
    let mass = em_add(mass_total, load_mass(row));
    let energy = el_add(energy_total, load_energy(row * EM_WORDS));
    let source = el_add(source_total, load_energy(rows + row * EM_WORDS));
    errors |= select(0u, ERROR_ARITHMETIC, (mass.error | energy.error | source.error) != 0u);
    mass_total = mass.value; energy_total = energy.value; source_total = source.value;
    kinetic_in += kinetic_energy(input_state[row * 2u], input_state[row * 2u + 1u]);
    let out0 = out_state[row * 2u];
    kinetic_out += kinetic_energy(out0, out_state[row * 2u + 1u]);
    if (out0.w > remainder_mass) { remainder_mass = out0.w; remainder_lane = lane; }
  }
  // The transfer thermalizes the kinetic energy its momentum merge removes;
  // that conversion is a source of internal energy, never an exchange.
  let thermalized = el_from_f32_bits(bitcast<u32>(max(kinetic_in - kinetic_out, 0.0)));
  let budget = el_add(energy_total, thermalized.value);
  let sources = el_add(source_total, thermalized.value);
  errors |= select(0u, ERROR_ARITHMETIC, (thermalized.error | budget.error | sources.error) != 0u);
  var mass_left = mass_total;
  var energy_left = budget.value;
  for (var lane = 0u; lane < LANES; lane++) {
    let row = lane * params.lane_stride + lineage;
    if (row >= params.particle_count || lane == remainder_lane) { continue; }
    let out0 = out_state[row * 2u];
    // Explicit zero per iteration: a declaration without an initializer kept
    // the previous lane's value on the native compiler.
    var lane_mass = ExactMass();
    var lane_energy = ExactMass();
    if (out0.w > 0.0) {
      let packet = el_from_f32_bits(bitcast<u32>(out0.w));
      errors |= select(0u, ERROR_ARITHMETIC, packet.error != 0u);
      // Clamp to what remains of the lineage with an integer compare.
      lane_mass = packet.value;
      if (em_compare(packet.value, mass_left) > 0) { lane_mass = mass_left; }
      if (!em_zero(lane_mass)) {
        let lane_u = out_state[row * 2u + 1u].w;
        let energy_packet = el_from_f32_bits(bitcast<u32>(out0.w * lane_u));
        errors |= select(0u, ERROR_ARITHMETIC, energy_packet.error != 0u);
        lane_energy = energy_packet.value;
      }
    }
    let mass_next = em_subtract(mass_left, lane_mass);
    let energy_next = el_subtract(energy_left, lane_energy);
    errors |= select(0u, ERROR_ARITHMETIC, (mass_next.error | energy_next.error) != 0u);
    mass_left = mass_next.value; energy_left = energy_next.value;
    store_mass(row, lane_mass);
    store_energy(row * EM_WORDS, lane_energy);
    store_energy(rows + row * EM_WORDS, ExactMass());
  }
  if (remainder_lane < LANES) {
    let row = remainder_lane * params.lane_stride + lineage;
    if (em_zero(mass_left) && !em_zero(energy_left)) { errors |= ERROR_ORPHAN_ENERGY; }
    store_mass(row, mass_left);
    store_energy(row * EM_WORDS, energy_left);
    store_energy(rows + row * EM_WORDS, sources.value);
  }
  // u, mass and the mass-derived mechanics lanes are the integer rows' view.
  for (var lane = 0u; lane < LANES; lane++) {
    let row = lane * params.lane_stride + lineage;
    if (row >= params.particle_count) { continue; }
    var mass_value: ExactMass;
    var energy_value: ExactMass;
    for (var i = 0u; i < EM_WORDS; i++) {
      mass_value.words[i] = mass_out[row * EM_WORDS + i];
      energy_value.words[i] = atomicLoad(&energy_out[row * EM_WORDS + i]);
    }
    let mass_bits = em_project_f32_bits(mass_value);
    let energy_bits = el_project_f32_bits(energy_value);
    errors |= select(0u, ERROR_ARITHMETIC, (mass_bits.error | energy_bits.error) != 0u);
    let mass = bitcast<f32>(mass_bits.bits);
    let state0 = out_state[row * 2u];
    let state1 = out_state[row * 2u + 1u];
    // An empty lane keeps the transfer's in-domain u: its exact energy is 0,
    // which the next ledger step recognises as fl32(0 * u). A lane whose
    // projection differs from the transfer's u by rounding only also keeps
    // the transfer's u: at a phase-domain boundary that ulp would otherwise
    // leave the lane unclassifiable (phase 0 then fails the spatial
    // directory, contact and pair conduction for the whole step). "Rounding"
    // is 8 ulps, the ledger thermal stage's own bound: it holds its view up
    // to 4 ulps inside the caloric domain while the exact U/m may sit up to 4
    // ulps outside before OUTSIDE_DOMAIN, so the two legitimately differ by
    // 8 (measured: humid air at the 200 K top wall, view domain.x + 4 ulps,
    // exact domain.x - 1 ulp). U stays exact; the next ledger step books the
    // view's rounding to S as a mechanics source.
    let projected_u = bitcast<f32>(energy_bits.bits) / max(mass, 1.0e-30);
    let ulps = abs(bitcast<i32>(projected_u) - bitcast<i32>(state1.w));
    let rounding_only = (projected_u >= 0.0) == (state1.w >= 0.0) && ulps <= 8;
    let u = select(state1.w, projected_u, mass > 0.0 && !rounding_only);
    if (bitcast<u32>(state0.w) != mass_bits.bits) {
      let rest_density = out_thermo[row * 3u].w;
      let mechanics4 = out_mechanics[row * 8u + 4u];
      out_mechanics[row * 8u + 4u] = vec4<f32>(mechanics4.xyz,
        select(0.0, mass / rest_density, rest_density > 0.0));
      let mechanics7 = out_mechanics[row * 8u + 7u];
      out_mechanics[row * 8u + 7u] = vec4<f32>(mechanics7.xyz, mass);
    }
    out_state[row * 2u] = vec4<f32>(state0.xyz, mass);
    out_state[row * 2u + 1u] = vec4<f32>(state1.xyz, u);
  }
  if (errors != 0u) { atomicOr(&energy_out[2u * rows], errors); }
}
`;function y({device:e,lineageCount:n,laneStride:g,particleCount:y,inputStateBuffer:b,outStateBuffer:x,outThermoBuffer:S,outMechanicsBuffer:C,massRead:w,energy:T}={}){let E=y;if(!Number.isSafeInteger(E)||E<1||!Number.isSafeInteger(n)||n<1||g!==n||3*g+n<E)throw TypeError(`Ledger phase reconcile requires the transfer lane layout`);if(!T||T.rowCount!==E||T.format.wordCount!==i||T.format.quantumExponent!==r.quantumExponent||T.energyBuffer.size!==t(E)*4||d(T.energyBuffer)!==e||w?.rowCount!==E||w.format!==T.format||w.byteOffset%4!=0)throw TypeError(`Ledger phase reconcile requires complete carrier mass and energy records`);for(let t of[b,x,S,C])if(d(t)!==e)throw TypeError(`Ledger phase reconcile buffers must share the device`);let D=typeof globalThis.GPUDevice==`function`&&e instanceof globalThis.GPUDevice,O=(t,n,r)=>D?l(s(e,{bucketKey:t,label:t,size:n,usage:r}),e,{bucketKey:t,size:n,usage:r}):e.createBuffer({label:t,size:n,usage:r}),k=p({device:e,sourceRead:w}),A=null,j=null,M=!1;try{A=u(O(`ulg-exact-energy-phase-ledger`,T.energyBuffer.size,_.STORAGE|_.COPY_SRC|_.COPY_DST),e),j=O(`ulg-exact-phase-ledger-params`,16,_.UNIFORM|_.COPY_DST),e.queue.writeBuffer(j,0,new Uint32Array([n,g,E,w.byteOffset/4]));let t=[`read-only-storage`,`storage`,`storage`,`read-only-storage`,`read-only-storage`,`storage`,`read-only-storage`,`storage`,`uniform`].map((e,t)=>o(t,e)),r=[`reconcile_phase_ledger`,`carry_ledger_control`].map(n=>c(e,{cacheKey:`ulg-exact-phase-ledger-${n}.v1`,label:`ulg-exact-phase-ledger-${n}`,code:v,entryPoint:n,bindings:t})),s=e.createBindGroup({layout:r[0].bindGroupLayout,entries:[b,x,C,S,w.buffer,k.buffer,T.energyBuffer,A,j].map((e,t)=>({binding:t,resource:{buffer:e}}))}),l=()=>{a(A),a(j)};return Object.freeze({encode(e){D&&e.clearBuffer(A,2*E*i*4,16);for(let[t,i]of[[1,1],[0,Math.ceil(n/64)]]){let n=e.beginComputePass({label:`ulg-exact-phase-ledger-reconcile`});n.setPipeline(r[t].pipeline),n.setBindGroup(0,s),n.dispatchWorkgroups(i),n.end()}},commit(){if(M)throw TypeError(`Ledger phase reconcile was already settled`);M=!0,a(j),j=null;let t=k.commit(),n=!1;return Object.freeze({carrierMassRead:m({family:t,device:e}),exactEnergy:Object.freeze({energyBuffer:A,format:T.format,rowCount:E}),transferExactEnergy(){if(n)throw TypeError(`Exact energy record was already adopted`);n=!0},get energyAdopted(){return n}})},abandon(){return M?!1:(M=!0,k.abandon(),l(),!0)},releaseUnadopted(e){return h(e.carrierMassRead,{deferInBurst:!0}).then(()=>{e.energyAdopted||a(A),f(e.carrierMassRead.family)})}})}catch(e){throw k.abandon(),a(A),a(j),e}}export{y as createSphExactPhaseLedgerReconcileStage};