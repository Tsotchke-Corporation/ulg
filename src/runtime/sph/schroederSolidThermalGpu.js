import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl } from './sphExactLedgerWgsl.js';
import { SPH_EXACT_THERMAL_ENERGY_FORMAT } from './sphExactThermalEnergyWgsl.js';
import { sphFiniteWallEnergyAddWgsl } from './sphFiniteWallStateGpu.js';

// G3 Phase 4a (plan/todo/g3-solids-proposal.md): thermal state of rigid-body
// members. Each member carries its specific internal energy u; temperature
// and liquid fraction follow from the material's own caloric branches (solid,
// melt plateau, liquid; condensableThermodynamics phaseCaloricBranches).
//
// Conduction, explicit in time, per member (one thread each):
//   - between lattice neighbours i, j (seed-time table, 6 per member):
//     Q_ij = k A (T_j - T_i) / d with the face area A and centre distance d
//     of that lattice axis; both members evaluate the same expression, so
//     Q_ji = -Q_ij exactly and internal exchange cancels;
//   - with a box wall the member touches (gap <= half a cell + slop):
//     Q = k A (T_wall - T_i) / (d / 2), across half a cell to the wall.
// The wall heat is scattered into an exact per-body ledger (the energy the
// walls supplied), so the body's energy budget closes against it.
//
// Member thermo rows, 4 floats: u (J/kg), T (K), liquid fraction, alive (1/0).
// Neighbour rows, 8 u32: +x, -x, +y, -y, +z, -z member indices (0xffffffff none), axis 0..2 for padding.
export const SCHROEDER_SOLID_THERMO_FLOATS = 4;
export const SCHROEDER_SOLID_NEIGHBOR_WORDS = 8;
const FORMAT = SPH_EXACT_THERMAL_ENERGY_FORMAT;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_SRC: 0x04, COPY_DST: 0x08 });

export const schroederSolidThermalWgsl = /* wgsl */ `
${createSphExactMassWgsl(FORMAT)}
${createSphExactLedgerWgsl(FORMAT)}
${createSphExactLedgerScatterWgsl(FORMAT, { prefix: 'wh', counters: 'heat_counters' })}
struct ThermalParams {
  // member_count, body_count, release enabled (1/0), unused
  counts: vec4<u32>,
  // solid branch: reference T, reference u, cv, energy max (plateau start)
  solid: vec4<f32>,
  // liquid branch: reference T, reference u, cv, energy min (plateau end)
  liquid: vec4<f32>,
  // melt temperature, solid conductivity, liquid conductivity, dt
  melt: vec4<f32>,
  // lattice pitch x, y, z, contact slop
  pitch: vec4<f32>,
  // wall temperatures: x min, x max, y min, y max
  walls0: vec4<f32>,
  // wall temperatures: z min, z max; box x, y
  walls1: vec4<f32>,
  // box z, member radius, ambient_temperature_k (0 = off), emissivity (0 = off)
  box: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: ThermalParams;
@group(0) @binding(1) var<storage, read_write> members: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> member_world: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> thermo_in: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> thermo_out: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> neighbors: array<vec4<u32>>;
@group(0) @binding(6) var<storage, read_write> heat_counters: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> heat_ledger: array<u32>;
// Release events (Phase 4b), 3 vec4 each: [member, mass, u, T], [world pos, body], [velocity, 0];
// release_count[0] is the event count since the last activation.
@group(0) @binding(8) var<storage, read_write> release_events: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> release_count: array<atomic<u32>>;
// Honest finite walls (sphFiniteWallStateGpu.js): the energy each member gives
// a face is added to that face's pending energy. A 16-byte placeholder (fixed
// or adiabatic walls) makes the add a no-op.
@group(0) @binding(10) var<storage, read_write> finite_wall_state: array<atomic<u32>>;
${sphFiniteWallEnergyAddWgsl('finite_wall_state')}

const NONE: u32 = 0xffffffffu;

// Temperature and liquid fraction of u on the solid / plateau / liquid branches.
fn caloric(u: f32) -> vec2<f32> {
  if (u <= params.solid.w) {
    return vec2<f32>(params.solid.x + (u - params.solid.y) / params.solid.z, 0.0);
  }
  if (u < params.liquid.w) {
    return vec2<f32>(params.melt.x, (u - params.solid.w) / (params.liquid.w - params.solid.w));
  }
  return vec2<f32>(params.liquid.x + (u - params.liquid.y) / params.liquid.z, 1.0);
}
fn conductivity(fraction: f32) -> f32 { return mix(params.melt.y, params.melt.z, clamp(fraction, 0.0, 1.0)); }
fn axis_area(axis: u32) -> f32 {
  let p = params.pitch;
  if (axis == 0u) { return p.y * p.z; }
  if (axis == 1u) { return p.x * p.z; }
  return p.x * p.y;
}

@compute @workgroup_size(64)
fn conduct_members(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let state = thermo_in[i];
  if (state.w == 0.0) { thermo_out[i] = state; return; }
  let mass = members[i * 2u].w;
  let body = bitcast<u32>(members[i * 2u + 1u].x);
  let k_i = conductivity(state.z);
  var heat = 0.0;
  let n0 = neighbors[i * 2u]; let n1 = neighbors[i * 2u + 1u];
  let ids = array<u32, 6>(n0.x, n0.y, n0.z, n0.w, n1.x, n1.y);
  var exposed_area_m2 = 0.0;
  for (var face = 0u; face < 6u; face++) {
    let j = ids[face];
    let axis = face / 2u;
    if (j == NONE) {
      exposed_area_m2 += axis_area(axis);
      continue;
    }
    let other = thermo_in[j];
    if (other.w == 0.0) {
      exposed_area_m2 += axis_area(axis);
      continue;
    }
    // Series conductance of the two half cells (harmonic mean), symmetric in i, j.
    let k = 2.0 * k_i * conductivity(other.z) / max(k_i + conductivity(other.z), 1.0e-30);
    heat += k * axis_area(axis) * (other.y - state.y) / params.pitch[axis];
  }
  // Surface-only gray-body ambient thermal radiation: strictly gated on
  // exposed lattice faces (interior solid members have exposed_area_m2 == 0
  // and emit zero ambient radiation).
  var rad_heat = 0.0;
  let amb_t = params.box.z;
  let emiss = params.box.w;
  if (exposed_area_m2 > 0.0 && amb_t > 0.0 && emiss > 0.0) {
    let t_s = max(state.y, 1.0);
    let t_s2 = t_s * t_s;
    let t_a2 = amb_t * amb_t;
    let raw_rad = emiss * 5.670374419e-8 * (t_a2 * t_a2 - t_s2 * t_s2) * exposed_area_m2;
    let cv_eff = select(params.solid.z, params.liquid.z, state.z >= 1.0);
    let max_eq_power = mass * max(cv_eff, 1.0) * abs(amb_t - t_s) / max(params.melt.w, 1.0e-9);
    rad_heat = clamp(raw_rad, -max_eq_power, max_eq_power);
  }
  // Walls: the member's nearest face of the box, if it touches it.
  let p = member_world[i * 2u].xyz; let r = params.box.y;
  let gaps = array<f32, 6>(p.x - r, params.walls1.z - p.x - r, p.y - r, params.walls1.w - p.y - r,
    p.z - r, params.box.x - p.z - r);
  let temps = array<f32, 6>(params.walls0.x, params.walls0.y, params.walls0.z, params.walls0.w,
    params.walls1.x, params.walls1.y);
  var wall_heat = 0.0;
  for (var w = 0u; w < 6u; w++) {
    if (gaps[w] > params.pitch.w || !(temps[w] > 0.0)) { continue; }
    let axis = w / 2u;
    let face_heat = k_i * axis_area(axis) * (temps[w] - state.y) / (0.5 * params.pitch[axis]);
    wall_heat += face_heat;
    finite_wall_energy_add(w, -params.melt.w * face_heat);
  }
  let dt = params.melt.w;
  let boundary_heat = wall_heat + rad_heat;
  let u = state.x + dt * (heat + boundary_heat) / mass;
  let c = caloric(u);
  // A fully melted member leaves the body: ownership passes to the fluid
  // lane (schroederSolidReleaseGpu.js) with its mass, u, position and rigid
  // velocity; the rigid lane rebases the body on its next step.
  if (c.y >= 1.0 && params.counts.z != 0u) {
    thermo_out[i] = vec4<f32>(u, c.x, c.y, 0.0);
    members[i * 2u] = vec4<f32>(members[i * 2u].xyz, 0.0);
    let slot = atomicAdd(&release_count[0], 1u);
    if (slot < params.counts.x) {
      release_events[slot * 3u] = vec4<f32>(bitcast<f32>(i), mass, u, c.x);
      release_events[slot * 3u + 1u] = vec4<f32>(member_world[i * 2u].xyz, bitcast<f32>(body));
      release_events[slot * 3u + 2u] = vec4<f32>(member_world[i * 2u + 1u].xyz, 0.0);
    }
  } else {
    thermo_out[i] = vec4<f32>(u, c.x, c.y, state.w);
  }
  // Exact boundary-heat ledger: the f32 energy the walls + ambient radiation delivered to this member.
  if (boundary_heat != 0.0) {
    let error = wh_scatter_f32(body, bitcast<u32>(dt * boundary_heat));
    if (error != 0u) { atomicOr(&heat_counters[params.counts.y * ${4 * FORMAT.wordCount}u], error); }
  }
}

// One thread per body: accumulate the drained wall heat into its exact ledger row.
@compute @workgroup_size(64)
fn drain_wall_heat(@builtin(global_invocation_id) id: vec3<u32>) {
  let body = id.x;
  if (body >= params.counts.y) { return; }
  let total = wh_drain(body);
  var ledger: ExactMass;
  for (var w = 0u; w < EM_WORDS; w++) { ledger.words[w] = heat_ledger[body * EM_WORDS + w]; }
  let next = el_add(ledger, total.value);
  for (var w = 0u; w < EM_WORDS; w++) { heat_ledger[body * EM_WORDS + w] = next.value.words[w]; }
}
`;

/**
 * Cold thermal seed: per-member u at the body temperature on the solid
 * branch, and the lattice neighbour table from the seed's lattice keys.
 */
export function seedSchroederSolidMemberThermal({ seeds, pitchByAxisM, temperaturesK, solidBranch }) {
  const memberCount = seeds.reduce((sum, seed) => sum + seed.members.length, 0);
  const thermo = new Float32Array(memberCount * 4);
  const neighbors = new Uint32Array(memberCount * 8).fill(0xffffffff);
  let offset = 0;
  seeds.forEach((seed, body) => {
    const pitch = pitchByAxisM[body];
    // Lattice keys along the seed-time world axes (the members' original grid).
    const [x, y, z, w] = seed.quaternion;
    const rot = v => { const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
      return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])]; };
    // Integer lattice coordinates relative to the first member (robust to the
    // centre of mass lying anywhere within a cell).
    const origin = rot(seed.members[0].rest);
    const keys = seed.members.map(member => rot(member.rest).map((v, k) => Math.round((v - origin[k]) / pitch[k])));
    const index = new Map(keys.map((key, i) => [key.join(','), i]));
    const u = solidBranch.referenceInternalEnergyJPerKg + solidBranch.cvJPerKgK * (temperaturesK[body] - solidBranch.referenceTemperatureK);
    seed.members.forEach((member, i) => {
      thermo.set([u, temperaturesK[body], 0, 1], (offset + i) * 4);
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach((d, face) => {
        const j = index.get(keys[i].map((v, k) => v + d[k]).join(','));
        if (j !== undefined) neighbors[(offset + i) * 8 + face] = offset + j;
      });
    });
    offset += seed.members.length;
  });
  return { thermo, neighbors, memberCount };
}

/** The member thermal stage over caller-owned member and member-world buffers. */
export function createSchroederSolidThermalStage({ device, memberCount, bodyCount, memberBuffer, memberWorldBuffer,
  thermo, neighbors, solidBranch, liquidBranch, meltTemperatureK, solidConductivity, liquidConductivity,
  pitchM, memberRadiusM, slopM = 5e-4, wallTemperaturesK, boxM, neighborBuffer: sharedNeighbors = null,
  finiteWallState = null, ambientTemperatureK = 0, emissivity = 0 } = {}) {
  const bindings = ['uniform', 'storage', 'read-only-storage', 'read-only-storage', 'storage',
    'read-only-storage', 'storage', 'storage', 'storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type));
  const pipelines = Object.fromEntries(['conduct_members', 'drain_wall_heat'].map(entryPoint => [entryPoint,
    createCachedExplicitComputePipeline(device, { cacheKey: `ulg-solid-thermal-${entryPoint}.v4`,
      label: `ulg-solid-thermal-${entryPoint}`, code: schroederSolidThermalWgsl, entryPoint, bindings })]));
  const storage = (label, data) => { const b = device.createBuffer({ label, size: Math.max(16, data.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
    device.queue.writeBuffer(b, 0, data); return b; };
  const thermoA = storage('ulg-solid-member-thermo-a', thermo), thermoB = storage('ulg-solid-member-thermo-b', thermo);
  const neighborBuffer = sharedNeighbors ?? storage('ulg-solid-member-neighbors', neighbors);
  const heatCounters = device.createBuffer({ label: 'ulg-solid-wall-heat-counters',
    size: (bodyCount * 4 * FORMAT.wordCount + 4) * 4, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const heatLedger = device.createBuffer({ label: 'ulg-solid-wall-heat-ledger', size: bodyCount * FORMAT.wordCount * 4,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const releaseEvents = device.createBuffer({ label: 'ulg-solid-release-events', size: Math.max(1, memberCount) * 48,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC });
  const releaseCount = device.createBuffer({ label: 'ulg-solid-release-count', size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  const params = device.createBuffer({ label: 'ulg-solid-thermal-params', size: 128,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(128), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([memberCount, bodyCount, 0, 0], 0);
  f.set([solidBranch.referenceTemperatureK, solidBranch.referenceInternalEnergyJPerKg, solidBranch.cvJPerKgK,
    solidBranch.energyMaxJPerKg], 4);
  f.set([liquidBranch.referenceTemperatureK, liquidBranch.referenceInternalEnergyJPerKg, liquidBranch.cvJPerKgK,
    liquidBranch.energyMinJPerKg], 8);
  f.set([meltTemperatureK, solidConductivity, liquidConductivity, 0], 12);
  f.set([...pitchM, slopM], 16);
  f.set([wallTemperaturesK[0], wallTemperaturesK[1], wallTemperaturesK[2], wallTemperaturesK[3]], 20);
  f.set([wallTemperaturesK[4], wallTemperaturesK[5], boxM[0], boxM[1]], 24);
  f.set([boxM[2], memberRadiusM, Number(ambientTemperatureK) > 0 ? Number(ambientTemperatureK) : 0,
    Number(emissivity) > 0 ? Math.min(1, Number(emissivity)) : 0], 28);
  const wallPlaceholder = finiteWallState ? null : device.createBuffer({ label: 'ulg-solid-finite-wall-placeholder',
    size: 16, usage: GPU_BUFFER_USAGE.STORAGE });
  const groupFor = (input, output) => device.createBindGroup({ layout: pipelines.conduct_members.bindGroupLayout,
    entries: [params, memberBuffer, memberWorldBuffer, input, output, neighborBuffer, heatCounters, heatLedger,
      releaseEvents, releaseCount, finiteWallState?.buffer ?? wallPlaceholder]
      .map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const groups = [groupFor(thermoA, thermoB), groupFor(thermoB, thermoA)];
  let current = 0;
  return Object.freeze({
    get thermoBuffer() { return current === 0 ? thermoA : thermoB; },
    heatLedgerBuffer: heatLedger, releaseEventBuffer: releaseEvents, releaseCountBuffer: releaseCount,
    prepare(encoder, dtSeconds, { releaseEnabled = false } = {}) {
      f[15] = dtSeconds; u[2] = releaseEnabled ? 1 : 0; device.queue.writeBuffer(params, 0, words);
      // Finite walls: the live face temperatures (x min..y max at byte 80,
      // z min/max at byte 96) replace the seeded ones for this step.
      if (finiteWallState) {
        finiteWallState.encodeTemperatureCopy(encoder, params, 80, 4, 0);
        finiteWallState.encodeTemperatureCopy(encoder, params, 96, 2, 4);
      }
    },
    /**
     * Encode one conduction step; release events accumulate until the caller
     * clears the count. Without `releaseEnabled` a melted member stays in its
     * body (no fluid lane to receive it), so mass is never dropped.
     */
    encode(encoder, dtSeconds, { releaseEnabled = false, pass: sharedPass = null, prepared = false } = {}) {
      if (!prepared) {
        f[15] = dtSeconds; u[2] = releaseEnabled ? 1 : 0; device.queue.writeBuffer(params, 0, words);
        if (finiteWallState) {
          finiteWallState.encodeTemperatureCopy(encoder, params, 80, 4, 0);
          finiteWallState.encodeTemperatureCopy(encoder, params, 96, 2, 4);
        }
      }
      const pass = sharedPass ?? encoder.beginComputePass({ label: 'ulg-solid-thermal' });
      pass.setBindGroup(0, groups[current]);
      for (const [entryPoint, count] of [['conduct_members', memberCount], ['drain_wall_heat', bodyCount]]) {
        pass.setPipeline(pipelines[entryPoint].pipeline);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
      }
      if (!sharedPass) pass.end();
      current = 1 - current;
    },
    destroy() {
      for (const b of [thermoA, thermoB, heatCounters, heatLedger, params, releaseEvents, releaseCount]) b.destroy();
      wallPlaceholder?.destroy();
      if (!sharedNeighbors) neighborBuffer.destroy();
    }
  });
}
