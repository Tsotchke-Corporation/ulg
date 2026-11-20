import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';
import { SPH_EXACT_VAPOR_PARCEL_PARAM_FLOATS } from './sphExactVaporParcelLedgerGpu.js';

// G2 integer ledger, Phase 5 (plan/todo/g2-integer-ledger-proposal.md):
// parcel transport and deposition with exact ownership.
//
// Transport (f32, declared one-way, Stokes number << 1): each parcel moves
// with the mass-weighted gas velocity of its cell plus Stokes settling with
// the Cunningham slip correction,
//   v_s = 2/9 (rho_p - rho_a) g r^2 C_c / mu,  C_c = 1 + Kn (1.257 + 0.4 e^(-1.1/Kn)).
// A parcel whose particle relaxation time exceeds the step is flagged, never
// silently moved (the one-way declaration no longer holds).
//
// Deposition (exact, whole parcel):
//   - a parcel inside the contact distance of a condensed water carrier
//     (carrier half-edge + droplet radius) gives that carrier its water mass
//     and water U; its dry core goes to the recorded solute sink, because a
//     carrier holds one species;
//   - a parcel that leaves the box goes whole to the recorded wall sink.
// Each receiving carrier sums its parcels in one thread; the sinks are one
// thread each; a deposited parcel's rows become exact zero. Mass and energy
// therefore close over carriers + parcels + sinks with no tolerance.
export const SPH_EXACT_PARCEL_TRANSPORT_ERROR = Object.freeze({ ARITHMETIC: 32768, STOKES_DECLARATION: 65536 });
export const SPH_EXACT_PARCEL_STATUS = Object.freeze({ AIRBORNE: 1, DEPOSITED_CARRIER: 2, DEPOSITED_WALL: 3 });
// Sink rows: [wall mass | wall U | solute mass | carrier-deposited dry count]
export const SPH_EXACT_PARCEL_SINK_ROWS = 3;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, COPY_SRC: 0x04, COPY_DST: 0x08, UNIFORM: 0x40 });
const fail = message => { throw new TypeError(`Exact parcel transport: ${message}`); };

export const sphExactParcelTransportLedgerWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
struct TransportParams {
  // carrier_count, parcel_count, cell_count, water_material_bits
  counts: vec4<u32>,
  dims: vec4<u32>,
  // origin xyz, cell size
  grid: vec4<f32>,
  // box size xyz, dt
  box: vec4<f32>,
  // gravity y, air density, air viscosity, mean free path
  air: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: TransportParams;
@group(0) @binding(1) var<storage, read_write> carrier_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> carrier_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> carrier_mass: array<u32>;
@group(0) @binding(4) var<storage, read_write> carrier_energy: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> parcels: array<f32>;
@group(0) @binding(6) var<storage, read_write> parcel_ledger: array<u32>;
@group(0) @binding(7) var<storage, read_write> parcel_target: array<u32>;
@group(0) @binding(8) var<storage, read_write> sinks: array<u32>;
@group(0) @binding(9) var<storage, read_write> carrier_mechanics: array<vec4<f32>>;

const PI: f32 = 3.14159265358979;
const RHO_W: f32 = 1000.0;
const PARAM_FLOATS: u32 = ${SPH_EXACT_VAPOR_PARCEL_PARAM_FLOATS}u;
const NONE: u32 = 0xffffffffu;
const WALL: u32 = 0xfffffffeu;
const E_ARITHMETIC: u32 = ${SPH_EXACT_PARCEL_TRANSPORT_ERROR.ARITHMETIC}u;
const E_STOKES: u32 = ${SPH_EXACT_PARCEL_TRANSPORT_ERROR.STOKES_DECLARATION}u;

fn rows() -> u32 { return params.counts.x * EM_WORDS; }
fn flag(bits: u32) { atomicOr(&carrier_energy[2u * rows()], bits); }
fn load_parcel(p: u32, slot: u32) -> ExactMass {
  var v = ExactMass(); let base = (p * 3u + slot) * EM_WORDS;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = parcel_ledger[base + i]; } return v;
}
fn store_parcel(p: u32, slot: u32, v: ExactMass) {
  let base = (p * 3u + slot) * EM_WORDS;
  for (var i = 0u; i < EM_WORDS; i++) { parcel_ledger[base + i] = v.words[i]; }
}
fn load_sink(slot: u32) -> ExactMass {
  var v = ExactMass(); for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = sinks[slot * EM_WORDS + i]; } return v;
}
fn store_sink(slot: u32, v: ExactMass) { for (var i = 0u; i < EM_WORDS; i++) { sinks[slot * EM_WORDS + i] = v.words[i]; } }
fn view(a: ExactMass) -> f32 { return bitcast<f32>(em_project_f32_bits(a).bits); }
fn is_water_carrier(row: u32) -> bool {
  let t = carrier_thermo[row * 3u];
  let phase = u32(t.y + 0.5);
  return bitcast<u32>(t.x) == params.counts.w && (phase == 1u || phase == 2u) && carrier_state[row * 2u].w > 0.0;
}

// Pass 1, one thread per airborne parcel: move it, then choose its fate.
@compute @workgroup_size(64)
fn transport_parcels(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.counts.y) { return; }
  parcel_target[p] = NONE;
  let base = p * PARAM_FLOATS;
  let n = max(parcels[base + 3u], 1.0);
  let water = load_parcel(p, 1u); let dry = load_parcel(p, 0u);
  if (em_zero(water) && em_zero(dry)) { return; }
  var position = vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u]);
  // Cell gas velocity: mass-weighted over gas carriers in the parcel's cell.
  let local = (position - params.grid.xyz) / params.grid.w;
  let dims = vec3<i32>(params.dims.xyz);
  let cell = clamp(vec3<i32>(floor(local)), vec3<i32>(0), dims - vec3<i32>(1));
  var momentum = vec3<f32>(0.0); var gas = 0.0;
  for (var row = 0u; row < params.counts.x; row++) {
    let s0 = carrier_state[row * 2u];
    if (u32(carrier_thermo[row * 3u].y + 0.5) != 3u || s0.w <= 0.0) { continue; }
    let rc = clamp(vec3<i32>(floor((s0.xyz - params.grid.xyz) / params.grid.w)), vec3<i32>(0), dims - vec3<i32>(1));
    if (any(rc != cell)) { continue; }
    momentum += s0.w * carrier_state[row * 2u + 1u].xyz; gas += s0.w;
  }
  let gas_velocity = select(vec3<f32>(0.0), momentum / gas, gas > 0.0);
  // Stokes settling with the Cunningham correction.
  let m_d = view(dry) / n; let m_w = view(water) / n;
  let dry_density = parcels[base + 4u];
  let volume = m_w / RHO_W + m_d / dry_density;
  let r = pow(3.0 * volume / (4.0 * PI), 1.0 / 3.0);
  let rho_p = (m_w + m_d) / max(volume, 1.0e-36);
  let kn = params.air.w / r;
  let slip = 1.0 + kn * (1.257 + 0.4 * exp(-1.1 / kn));
  let relaxation = rho_p * (2.0 * r) * (2.0 * r) * slip / (18.0 * params.air.z);
  if (relaxation > params.box.w) { flag(E_STOKES); return; }
  let settling = relaxation * (1.0 - params.air.y / rho_p) * params.air.x;
  let velocity = gas_velocity + vec3<f32>(0.0, settling, 0.0);
  position += velocity * params.box.w;
  parcels[base] = position.x; parcels[base + 1u] = position.y; parcels[base + 2u] = position.z;
  parcels[base + 7u] = r;
  if (any(position < vec3<f32>(0.0)) || any(position > params.box.xyz)) { parcel_target[p] = WALL; return; }
  // Nearest condensed water carrier within contact distance (lowest row on ties).
  var best = NONE; var best_d2 = 3.4e38;
  for (var row = 0u; row < params.counts.x; row++) {
    if (!is_water_carrier(row)) { continue; }
    let s0 = carrier_state[row * 2u];
    let half_edge = 0.5 * pow(s0.w / RHO_W, 1.0 / 3.0);
    let reach = half_edge + r;
    let d = s0.xyz - position;
    let d2 = dot(d, d);
    if (d2 <= reach * reach && d2 < best_d2) { best = row; best_d2 = d2; }
  }
  parcel_target[p] = best;
}

// Pass 2, one thread per carrier: add every parcel that deposits into it.
@compute @workgroup_size(64)
fn deposit_into_carriers(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.counts.x) { return; }
  var mass = ExactMass(); var energy = ExactMass(); var any_parcel = false;
  for (var p = 0u; p < params.counts.y; p++) {
    if (parcel_target[p] != row) { continue; }
    let added_mass = em_add(mass, load_parcel(p, 1u));
    let added_energy = el_add(energy, load_parcel(p, 2u));
    if ((added_mass.error | added_energy.error) != 0u) { flag(E_ARITHMETIC); return; }
    mass = added_mass.value; energy = added_energy.value;
    any_parcel = true;
  }
  if (!any_parcel) { return; }
  var held = ExactMass(); var held_energy = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) {
    held.words[i] = carrier_mass[row * EM_WORDS + i];
    held_energy.words[i] = atomicLoad(&carrier_energy[row * EM_WORDS + i]);
  }
  let next = em_add(held, mass); let next_energy = el_add(held_energy, energy);
  if ((next.error | next_energy.error) != 0u) { flag(E_ARITHMETIC); return; }
  for (var i = 0u; i < EM_WORDS; i++) {
    carrier_mass[row * EM_WORDS + i] = next.value.words[i];
    atomicStore(&carrier_energy[row * EM_WORDS + i], next_energy.value.words[i]);
  }
  // The receiver's f32 view: mass, u = U/m, and its mass-derived mechanics lanes.
  let m = view(next.value);
  let state0 = carrier_state[row * 2u]; let state1 = carrier_state[row * 2u + 1u];
  let u = bitcast<f32>(el_project_f32_bits(next_energy.value).bits) / max(m, 1.0e-36);
  if (state0.w > 0.0) {
    let m4 = carrier_mechanics[row * 8u + 4u];
    carrier_mechanics[row * 8u + 4u] = vec4<f32>(m4.xyz, m4.w * m / state0.w);
  }
  let m7 = carrier_mechanics[row * 8u + 7u];
  carrier_mechanics[row * 8u + 7u] = vec4<f32>(m7.xyz, m);
  carrier_state[row * 2u] = vec4<f32>(state0.xyz, m);
  carrier_state[row * 2u + 1u] = vec4<f32>(state1.xyz, u);
}

// Pass 3, one thread: the wall sink takes whole wall parcels; the solute sink
// takes the dry cores of carrier-deposited parcels.
@compute @workgroup_size(1)
fn deposit_into_sinks() {
  var wall_mass = load_sink(0u); var wall_energy = load_sink(1u); var solute = load_sink(2u);
  for (var p = 0u; p < params.counts.y; p++) {
    let target_row = parcel_target[p];
    if (target_row == WALL) {
      let a = em_add(wall_mass, load_parcel(p, 0u));
      let b = em_add(a.value, load_parcel(p, 1u));
      let c = el_add(wall_energy, load_parcel(p, 2u));
      if ((a.error | b.error | c.error) != 0u) { flag(E_ARITHMETIC); return; }
      wall_mass = b.value; wall_energy = c.value;
    } else if (target_row != NONE) {
      let added = em_add(solute, load_parcel(p, 0u));
      if (added.error != 0u) { flag(E_ARITHMETIC); return; }
      solute = added.value;
    }
  }
  store_sink(0u, wall_mass); store_sink(1u, wall_energy); store_sink(2u, solute);
}

// Pass 4, one thread per parcel: a deposited parcel's rows become exact zero.
@compute @workgroup_size(64)
fn retire_deposited(@builtin(global_invocation_id) id: vec3<u32>) {
  let p = id.x;
  if (p >= params.counts.y || parcel_target[p] == NONE) { return; }
  store_parcel(p, 0u, ExactMass()); store_parcel(p, 1u, ExactMass()); store_parcel(p, 2u, ExactMass());
  parcels[p * PARAM_FLOATS + 7u] = 0.0;
}
`;

/** Prepares the transport/deposition passes over caller-owned buffers. */
export function createSphExactParcelTransportStage({ device, carrierCount, parcelCount, dims, origin, cellSizeM, boxM,
  waterMaterialId, airDensityKgPerM3 = 1.2, airViscosityPaS = 1.81e-5, meanFreePathM = 6.6e-8, gravityMPerS2 = -9.81,
  carrierStateBuffer, carrierThermoBuffer, carrierMassBuffer, carrierEnergyBuffer, parcelBuffer, parcelLedgerBuffer,
  sinkBuffer, carrierMechanicsBuffer = null, carrierMassRange = null } = {}) {
  if (!(carrierCount > 0) || !(parcelCount > 0) || !(cellSizeM > 0)) fail('counts and grid required');
  const target = device.createBuffer({ label: 'ulg-exact-parcel-target', size: parcelCount * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const params = device.createBuffer({ label: 'ulg-exact-parcel-transport-params', size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(80), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([carrierCount, parcelCount, dims[0] * dims[1] * dims[2], new Uint32Array(new Float32Array([waterMaterialId]).buffer)[0]], 0);
  u.set([dims[0], dims[1], dims[2], 0], 4);
  f.set([origin[0], origin[1], origin[2], cellSizeM], 8);
  f.set([boxM[0], boxM[1], boxM[2], 0], 12);
  f.set([gravityMPerS2, airDensityKgPerM3, airViscosityPaS, meanFreePathM], 16);
  const bindings = ['uniform', 'storage', 'read-only-storage', 'storage', 'storage', 'storage', 'storage',
    'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['transport_parcels', 'deposit_into_carriers', 'deposit_into_sinks',
    'retire_deposited'].map(entryPoint => [entryPoint, createCachedExplicitComputePipeline(device, {
    cacheKey: `ulg-exact-parcel-transport-${entryPoint}.v2`, label: `ulg-exact-parcel-transport-${entryPoint}`,
    code: sphExactParcelTransportLedgerWgsl, entryPoint, bindings })]));
  const scratchMechanics = carrierMechanicsBuffer ? null : device.createBuffer({ label: 'ulg-exact-parcel-mechanics-scratch',
    size: carrierCount * 128, usage: GPU_BUFFER_USAGE.STORAGE });
  const bindGroup = device.createBindGroup({ layout: pipelines.transport_parcels.bindGroupLayout, entries: [params,
    carrierStateBuffer, carrierThermoBuffer, carrierMassBuffer, carrierEnergyBuffer, parcelBuffer, parcelLedgerBuffer,
    target, sinkBuffer, carrierMechanicsBuffer ?? scratchMechanics].map((buffer, binding) => ({ binding,
      resource: binding === 3 && carrierMassRange ? { buffer, offset: carrierMassRange.offset, size: carrierMassRange.size }
        : { buffer } })) });
  return Object.freeze({
    targetBuffer: target,
    encode(encoder, dt) {
      f[15] = dt; device.queue.writeBuffer(params, 0, words);
      for (const [name, groups] of [['transport_parcels', Math.ceil(parcelCount / 64)],
        ['deposit_into_carriers', Math.ceil(carrierCount / 64)], ['deposit_into_sinks', 1],
        ['retire_deposited', Math.ceil(parcelCount / 64)]]) {
        const pass = encoder.beginComputePass({ label: `ulg-exact-parcel-transport-${name}` });
        pass.setPipeline(pipelines[name].pipeline); pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(groups); pass.end();
      }
    },
    destroy() { target.destroy(); params.destroy(); scratchMechanics?.destroy(); }
  });
}

/** f64 settling velocity of the same law (Stokes with Cunningham), for checks. */
export function sphExactParcelSettlingVelocity({ r, rhoParticle, airDensity = 1.2, viscosity = 1.81e-5,
  meanFreePath = 6.6e-8, gravity = -9.81 }) {
  const kn = meanFreePath / r;
  const slip = 1 + kn * (1.257 + 0.4 * Math.exp(-1.1 / kn));
  const relaxation = rhoParticle * (2 * r) ** 2 * slip / (18 * viscosity);
  return relaxation * (1 - airDensity / rhoParticle) * gravity;
}
