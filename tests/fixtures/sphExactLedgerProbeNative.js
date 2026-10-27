// G2 Phase 0 feasibility probe for exact integer ledgers (plan/todo/
// g2-integer-ledger-proposal.md). It is not product code: it exercises the
// ledger kernels at Iron Ice capacity on whatever GPUDevice it is handed, so
// the same run can execute on a static page or inside the live app.
//
// One probe step is six compute passes:
//   match    one thread per disjoint pair: random mass and energy transfers,
//            the mass packet clamped exactly to the donor (fuses into phase
//            transfer and reaction kernels in the solver);
//   conduct  one thread per row: canonical-order f32 pair packets over a
//            neighbour graph, applied as exact quanta (fuses into thermal);
//   f32      the same neighbour loop with f32 accumulation, for comparison;
//   scatter  many-to-one transfers, whole-row deposits and recorded sources
//            through chunked atomics (fuses into the producing kernel);
//   carry    folds the atomic counters into the ledgers, rewrites the f32
//            projections, and accumulates the budget (a ledger-only pass);
//   budget   one thread: sum M == M0 and sum U == U0 + sources, exactly
//            (the opt-in ledger-only pass).
// Only carry and budget are passes the solver does not already run.
import {
  createSphExactMassFormat, encodeSphExactMass, decodeSphExactMass, encodeSphExactMassUnits,
  SPH_EXACT_MASS_ERROR as E
} from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import {
  encodeSphExactSigned, decodeSphExactSignedUnits, encodeSphExactSignedUnits, sphExactUnitsFromF32Bits
} from '../../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { createSphExactMassWgsl } from '../../src/runtime/sph/sphExactMassWgsl.js';
import { createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl } from '../../src/runtime/sph/sphExactLedgerWgsl.js';

// Re-exported so a browser caller shares this module graph's format identity
// (the development server may stamp ABI imports with an HMR query).
export { createSphExactMassFormat, createSphExactMassWgsl, createSphExactLedgerWgsl, createSphExactLedgerScatterWgsl };

export const SPH_EXACT_LEDGER_PROBE_SCHEMA = 'ulg.g2-exact-ledger-probe.v1';
export const SPH_EXACT_LEDGER_PROBE_PASSES = Object.freeze(['match', 'conduct', 'f32', 'scatter', 'carry', 'budget']);
// Passes the solver does not already run; the proposal's pass budget is 2.
export const SPH_EXACT_LEDGER_PROBE_LEDGER_ONLY_PASSES = Object.freeze(['carry', 'budget']);

const SEED = 0x6a09e667;
const C = Object.freeze({ STEP: 0, FAILURES: 1, FIRST_FAILURE: 2, ERRORS: 3, REJECTED: 4, CLAMPED: 5,
  DEPOSITS: 6, AUDIT: 7, SOURCES: 8 });

export function sphExactLedgerProbeMix(value) {
  let v = value >>> 0;
  v ^= v >>> 16; v = Math.imul(v, 0x7feb352d) >>> 0;
  v ^= v >>> 15; v = Math.imul(v, 0x846ca68b) >>> 0;
  v ^= v >>> 16; return v >>> 0;
}
const mix = sphExactLedgerProbeMix;
const mix3 = (a, b, c) => mix((a ^ mix((b ^ mix((c ^ SEED) >>> 0)) >>> 0)) >>> 0);

// One-sided source packet: host-reproducible bits (zero for 7 of 8 rows).
export function sphExactLedgerProbeSourceBits(step, row) {
  const h = mix3(step, row, 0x50);
  if ((h & 7) !== 0) return 0;
  const m = mix((h ^ 0x9e3779b9) >>> 0), sign = (h >>> 7) & 1, kind = (h >>> 3) & 15;
  if (kind === 0) return (sign << 31) >>> 0;
  if (kind === 1) return ((sign << 31) | (m & 0x7fffff)) >>> 0;
  const field = 1 + ((h >>> 8) % 130);
  return ((sign << 31) | (field << 23) | (m & 0x7fffff)) >>> 0;
}

// Host-side fixture: exact initial ledgers, matchings and a neighbour graph.
export function createSphExactLedgerProbeFixture({ rows = 6784, rounds = 64, scatterTargets = 4,
  depositMask = 63, conductance = 0.02 } = {}) {
  if (!Number.isInteger(rows) || rows < 16 || rows % 2) throw new RangeError('Probe needs an even row count >= 16');
  const format = createSphExactMassFormat();
  const W = format.wordCount;
  let state = 0x243f6a88;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const f32 = new Float32Array(1);
  const mass = new Uint32Array(rows * W), energy = new Uint32Array(rows * W);
  let massTotal = 0n, energyTotal = 0n;
  for (let row = 0; row < rows; row++) {
    // Iron Ice carriers hold milligrams; a few rows start empty or at one quantum.
    f32[0] = (1 + random()) * 2 ** -(10 + Math.floor(random() * 12));
    let m = row % 997 === 5 ? 0 : f32[0];
    let mUnits = decodeSphExactMass(encodeSphExactMass(m, format), format).coefficient;
    if (row % 1009 === 7) mUnits = 1n;
    f32[0] = m * (random() * 3.2e6 - 2e5);
    const uUnits = m ? decodeSphExactSignedUnits(encodeSphExactSigned(f32[0], format), format) : 0n;
    mass.set(encodeSphExactMassUnits(mUnits, format), row * W);
    energy.set(encodeSphExactSignedUnits(uUnits, format), row * W);
    massTotal += mUnits; energyTotal += uUnits;
  }
  const pairs = rows / 2, topology = [];
  const order = Array.from({ length: rows }, (_, i) => i);
  for (let round = 0; round < rounds; round++) {
    for (let i = rows - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    for (let p = 0; p < pairs; p++) topology.push(order[2 * p], order[2 * p + 1]);
  }
  // Rows on a cubic lattice; neighbours within two lattice spacings (<= 32).
  const side = Math.ceil(Math.cbrt(rows));
  const offsets = [];
  for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > 0 && r2 <= 4) offsets.push([dx, dy, dz]);
  }
  const graphStart = topology.length;
  const indexStart = graphStart + rows + 1;
  const neighbours = [];
  const rowOffsets = [indexStart];
  for (let row = 0; row < rows; row++) {
    const x = row % side, y = Math.floor(row / side) % side, z = Math.floor(row / (side * side));
    for (const [dx, dy, dz] of offsets) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= side || ny >= side || nz >= side) continue;
      const other = nx + side * (ny + side * nz);
      if (other < rows) neighbours.push(other);
    }
    rowOffsets.push(indexStart + neighbours.length);
  }
  for (const value of rowOffsets) topology.push(value);
  for (const value of neighbours) topology.push(value);
  const hot = [0, Math.floor(rows / 3), Math.floor((2 * rows) / 3), rows - 1];
  return Object.freeze({ schema: SPH_EXACT_LEDGER_PROBE_SCHEMA, format, rows, pairs, rounds, scatterTargets,
    depositMask, conductance, hot, mass, energy, topology: new Uint32Array(topology), graphStart,
    neighbourCount: neighbours.length, massTotal, energyTotal });
}

function probeWgsl(fixture) {
  const { format, rows, pairs, rounds, scatterTargets, depositMask, conductance, hot, graphStart } = fixture;
  const W = format.wordCount, chunks4 = 4 * W;
  const BUDGET = 16 + 8 * W;
  const at = Object.freeze({ M0: 16, U0: 16 + W, SOURCE: 16 + 2 * W, LAST_M: 16 + 3 * W, LAST_U: 16 + 4 * W,
    AUDIT_M: 16 + 5 * W, AUDIT_U: 16 + 6 * W });
  const scatter = (prefix, counters, stride, offset) =>
    createSphExactLedgerScatterWgsl(format, { prefix, counters, stride, offset });
  const code = createSphExactMassWgsl(format) + createSphExactLedgerWgsl(format) + /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> mass: array<u32>;
@group(0) @binding(1) var<storage, read_write> energy: array<u32>;
@group(0) @binding(2) var<storage, read_write> projection: array<u32>;
@group(0) @binding(3) var<storage, read_write> topology: array<u32>;
@group(0) @binding(4) var<storage, read_write> row_counters: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> control: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> reference: array<f32>;
var<workgroup> wg_counters: array<atomic<u32>, ${2 * chunks4}>;
var<workgroup> wg_tally: atomic<u32>;

const ROWS: u32 = ${rows}u;
const PAIRS: u32 = ${pairs}u;
const ROUNDS: u32 = ${rounds}u;
const GRAPH: u32 = ${graphStart}u;
const SCATTER_TARGETS: u32 = ${scatterTargets}u;
const DEPOSIT_MASK: u32 = ${depositMask}u;
const SEED: u32 = ${SEED}u;
const CONDUCTANCE: f32 = ${conductance};
const BUDGET: u32 = ${BUDGET}u;
const HOT0: u32 = ${hot[0]}u;
const HOT1: u32 = ${hot[1]}u;
const HOT2: u32 = ${hot[2]}u;
const HOT3: u32 = ${hot[3]}u;
${scatter('mass_counter', 'row_counters', 8 * W, 0)}
${scatter('energy_counter', 'row_counters', 8 * W, chunks4)}
${scatter('wg_first', 'wg_counters', 0, 0)}
${scatter('wg_second', 'wg_counters', 0, chunks4)}
${scatter('budget_mass', 'control', 0, BUDGET)}
${scatter('budget_energy', 'control', 0, BUDGET + chunks4)}
${scatter('budget_source', 'control', 0, BUDGET + 2 * chunks4)}

fn mix(x: u32) -> u32 {
  var v = x;
  v ^= v >> 16u; v *= 0x7feb352du; v ^= v >> 15u; v *= 0x846ca68bu; v ^= v >> 16u;
  return v;
}
fn mix3(a: u32, b: u32, c: u32) -> u32 { return mix(a ^ mix(b ^ mix(c ^ SEED))); }
fn fail(bits: u32) { atomicOr(&control[${C.ERRORS}u], bits); }
fn load_mass(row: u32) -> ExactMass {
  var v: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = mass[row * EM_WORDS + i]; }
  return v;
}
fn store_mass(row: u32, v: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { mass[row * EM_WORDS + i] = v.words[i]; }
}
fn load_energy(row: u32) -> ExactMass {
  var v: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = energy[row * EM_WORDS + i]; }
  return v;
}
fn store_energy(row: u32, v: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { energy[row * EM_WORDS + i] = v.words[i]; }
}
fn load_control(base: u32) -> ExactMass {
  var v: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { v.words[i] = atomicLoad(&control[base + i]); }
  return v;
}
fn store_control(base: u32, v: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&control[base + i], v.words[i]); }
}
fn project_row(row: u32, m: ExactMass, e: ExactMass) {
  let pm = em_project_f32_bits(m); let pe = el_project_f32_bits(e);
  if ((pm.error | pe.error) != 0u) { fail(pm.error | pe.error); }
  projection[row * 2u] = pm.bits; projection[row * 2u + 1u] = pe.bits;
}
fn source_bits(step: u32, row: u32) -> u32 {
  let h = mix3(step, row, 0x50u);
  if ((h & 7u) != 0u) { return 0u; }
  let m = mix(h ^ 0x9e3779b9u); let sign = (h >> 7u) & 1u; let kind = (h >> 3u) & 15u;
  if (kind == 0u) { return sign << 31u; }
  if (kind == 1u) { return (sign << 31u) | (m & 0x007fffffu); }
  return (sign << 31u) | ((1u + ((h >> 8u) % 130u)) << 23u) | (m & 0x007fffffu);
}
fn hot_row(i: u32) -> u32 { return select(select(HOT0, HOT1, i == 1u), select(HOT2, HOT3, i == 3u), i >= 2u); }
fn is_hot(row: u32) -> bool { return row == HOT0 || row == HOT1 || row == HOT2 || row == HOT3; }

@compute @workgroup_size(64)
fn ledger_match(@builtin(global_invocation_id) id: vec3<u32>) {
  let pair = id.x;
  if (pair >= PAIRS) { return; }
  let step = atomicLoad(&control[${C.STEP}u]);
  let base = ((step % ROUNDS) * PAIRS + pair) * 2u;
  let h = mix3(step, pair, 0xa1u);
  let forward = (h & 1u) == 0u;
  let donor = select(topology[base + 1u], topology[base], forward);
  let receiver = select(topology[base], topology[base + 1u], forward);
  let donor_mass = load_mass(donor); let receiver_mass = load_mass(receiver);
  let donor_energy = load_energy(donor); let receiver_energy = load_energy(receiver);
  // The packet is an f32 evaluation from the donor's projection, as in the
  // solver; only its application is exact. Factors above 1 force depletion.
  let k = i32((h >> 3u) % 32u) - 1;
  let factor = ldexp(1.0 + f32(mix(h) >> 9u) * (1.0 / 8388608.0), -k);
  let requested = bitcast<f32>(projection[donor * 2u]) * factor;
  var mass_packet = el_from_f32_bits(bitcast<u32>(requested));
  var errors = mass_packet.error;
  var depleted = em_zero(donor_mass);
  if (!depleted && em_compare(mass_packet.value, donor_mass) >= 0) {
    mass_packet = ExactMassResult(donor_mass, 0u); depleted = true;
    atomicAdd(&control[${C.CLAMPED}u], 1u);
  }
  // A donor left with no mass hands over all of its energy, so no empty row
  // keeps orphaned energy. Otherwise the moved mass carries the donor's
  // specific energy: the same fraction of its (signed) energy. Fractions of a
  // row's own value never grow the sum of |U|, so the test stays in range.
  var energy_packet = ExactMassResult(donor_energy, 0u);
  if (!depleted) {
    energy_packet = el_from_f32_bits(bitcast<u32>(bitcast<f32>(projection[donor * 2u + 1u]) * factor));
  }
  errors |= energy_packet.error;
  let moved = em_transfer(donor_mass, receiver_mass, mass_packet.value);
  let debit = el_subtract(donor_energy, energy_packet.value);
  let credit = el_add(receiver_energy, energy_packet.value);
  errors |= moved.error | debit.error | credit.error;
  if (errors != 0u) { fail(errors); return; }
  store_mass(donor, moved.donor); store_mass(receiver, moved.receiver);
  store_energy(donor, debit.value); store_energy(receiver, credit.value);
  project_row(donor, moved.donor, debit.value); project_row(receiver, moved.receiver, credit.value);
}

// Both endpoints evaluate the same expression on the same inputs in (lo, hi)
// order, so they see identical bits. Positive flows lo -> hi.
fn conduction_packet(lo: u32, hi: u32) -> f32 {
  let mass_lo = bitcast<f32>(projection[lo * 2u]); let mass_hi = bitcast<f32>(projection[hi * 2u]);
  if (!(mass_lo > 0.0) || !(mass_hi > 0.0)) { return 0.0; }
  let u_lo = bitcast<f32>(projection[lo * 2u + 1u]) / mass_lo;
  let u_hi = bitcast<f32>(projection[hi * 2u + 1u]) / mass_hi;
  let weight = f32(mix3(lo, hi, 0xc0u) >> 8u) * (1.0 / 16777216.0);
  return CONDUCTANCE * weight * (u_lo - u_hi) * min(mass_lo, mass_hi);
}

@compute @workgroup_size(64)
fn ledger_conduct(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= ROWS) { return; }
  var gained: ExactMass; var lost: ExactMass; var errors = 0u; var rejected = 0u;
  for (var k = topology[GRAPH + row]; k < topology[GRAPH + row + 1u]; k++) {
    let other = topology[k];
    let lo = min(row, other); let hi = max(row, other);
    let packet = conduction_packet(lo, hi);
    let bits = bitcast<u32>(packet);
    if ((bits & 0x7f800000u) == 0x7f800000u) { rejected++; continue; }
    if ((bits & 0x7fffffffu) == 0u) { continue; }
    let quanta = el_from_f32_bits(bits & 0x7fffffffu);
    if ((packet > 0.0) == (row == hi)) {
      let next = em_add(gained, quanta.value); errors |= quanta.error | next.error; gained = next.value;
    } else {
      let next = em_add(lost, quanta.value); errors |= quanta.error | next.error; lost = next.value;
    }
  }
  if (rejected != 0u) { atomicAdd(&control[${C.REJECTED}u], rejected); }
  if (el_negative(gained) || el_negative(lost)) { errors |= ${E.OVERFLOW}u; }
  let net = el_subtract(gained, lost);
  let next = el_add(load_energy(row), net.value);
  errors |= net.error | next.error;
  if (errors != 0u) { fail(errors); return; }
  store_energy(row, next.value);
}

@compute @workgroup_size(64)
fn reference_conduct(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= ROWS) { return; }
  var delta = 0.0;
  for (var k = topology[GRAPH + row]; k < topology[GRAPH + row + 1u]; k++) {
    let other = topology[k];
    let lo = min(row, other); let hi = max(row, other);
    let packet = conduction_packet(lo, hi);
    if ((bitcast<u32>(packet) & 0x7f800000u) == 0x7f800000u) { continue; }
    delta += select(-packet, packet, row == hi);
  }
  reference[row] = delta;
}

@compute @workgroup_size(64)
fn ledger_scatter(@builtin(global_invocation_id) id: vec3<u32>,
    @builtin(local_invocation_index) local: u32) {
  let row = id.x;
  if (row < ROWS) {
    let step = atomicLoad(&control[${C.STEP}u]);
    var row_mass = load_mass(row); var row_energy = load_energy(row); var errors = 0u;
    // Many-to-one transfers: the sender debits itself, receivers get counters.
    var sent: ExactMass;
    // Each packet is at most 1/8 of the row's own signed energy.
    let own = bitcast<f32>(projection[row * 2u + 1u]);
    for (var k = 0u; k < SCATTER_TARGETS; k++) {
      let h = mix3(step, row, 0xb0u + k);
      var receiver = (h >> 8u) % ROWS;
      if ((h & 7u) == 0u) { receiver = hot_row((h >> 3u) & 3u); }
      let scale = ldexp(1.0 + f32(mix(h) >> 9u) * (1.0 / 8388608.0), -4 - i32((h >> 5u) % 24u));
      let bits = bitcast<u32>(own * scale);
      let value = el_from_f32_bits(bits);
      let next = el_add(sent, value.value);
      errors |= value.error | next.error | energy_counter_scatter_f32(receiver, bits);
      sent = next.value;
    }
    let debited = el_subtract(row_energy, sent);
    errors |= debited.error; row_energy = debited.value;
    // A recorded one-sided source: applied here, summed for the budget.
    let source = source_bits(step, row);
    if ((source & 0x7fffffffu) != 0u) {
      let value = el_from_f32_bits(source);
      let credited = el_add(row_energy, value.value);
      errors |= value.error | credited.error | wg_first_scatter_f32(0u, source);
      row_energy = credited.value;
      atomicAdd(&wg_tally, 1u);
    }
    // Whole-row deposit onto a hot row: the row becomes exact zero.
    if (!is_hot(row) && (mix3(step, row, 0xd0u) & DEPOSIT_MASK) == 0u) {
      let sink = hot_row(mix3(step, row, 0xd1u) & 3u);
      errors |= mass_counter_scatter_value(sink, row_mass) | energy_counter_scatter_value(sink, row_energy);
      row_mass = ExactMass(); row_energy = ExactMass();
      atomicAdd(&control[${C.DEPOSITS}u], 1u);
    }
    if (errors != 0u) { fail(errors); }
    else { store_mass(row, row_mass); store_energy(row, row_energy); }
  }
  workgroupBarrier();
  for (var i = local; i < ${chunks4}u; i += 64u) {
    budget_source_add_counter(0u, i, atomicLoad(&wg_counters[i]));
  }
  if (local == 0u) {
    let tally = atomicLoad(&wg_tally);
    if (tally != 0u) { atomicAdd(&control[${C.SOURCES}u], tally); }
  }
}

@compute @workgroup_size(64)
fn ledger_carry(@builtin(global_invocation_id) id: vec3<u32>,
    @builtin(local_invocation_index) local: u32) {
  let row = id.x;
  if (row < ROWS) {
    let mass_in = mass_counter_drain(row);
    let energy_in = energy_counter_drain(row);
    var errors = mass_in.error | energy_in.error;
    if (el_negative(mass_in.value)) { errors |= ${E.UNDERFLOW}u; }
    let m = em_add(load_mass(row), mass_in.value);
    let e = el_add(load_energy(row), energy_in.value);
    errors |= m.error | e.error;
    if (errors != 0u) { fail(errors); }
    else {
      store_mass(row, m.value); store_energy(row, e.value); project_row(row, m.value, e.value);
      errors = wg_first_scatter_value(0u, m.value) | wg_second_scatter_value(0u, e.value);
      if (errors != 0u) { fail(errors); }
    }
  }
  workgroupBarrier();
  for (var i = local; i < ${2 * chunks4}u; i += 64u) {
    budget_mass_add_counter(0u, i, atomicLoad(&wg_counters[i]));
  }
}

@compute @workgroup_size(1)
fn ledger_budget() {
  let mass_sum = budget_mass_drain(0u);
  let energy_sum = budget_energy_drain(0u);
  let source_step = budget_source_drain(0u);
  let source_total = el_add(load_control(${at.SOURCE}u), source_step.value);
  let expected = el_add(load_control(${at.U0}u), source_total.value);
  let errors = mass_sum.error | energy_sum.error | source_step.error | source_total.error | expected.error;
  store_control(${at.SOURCE}u, source_total.value);
  store_control(${at.LAST_M}u, mass_sum.value);
  store_control(${at.LAST_U}u, energy_sum.value);
  let step = atomicLoad(&control[${C.STEP}u]);
  let balanced = errors == 0u && em_compare(mass_sum.value, load_control(${at.M0}u)) == 0
    && el_compare(energy_sum.value, expected.value) == 0;
  if (!balanced) {
    atomicAdd(&control[${C.FAILURES}u], 1u);
    if (atomicLoad(&control[${C.FIRST_FAILURE}u]) == 0u) { atomicStore(&control[${C.FIRST_FAILURE}u], step + 1u); }
  }
  if (errors != 0u) { fail(errors); }
  atomicStore(&control[${C.STEP}u], step + 1u);
}

// Independent end-of-run check: one thread sums every row with plain carry
// loops, sharing no code with the chunked-atomic budget path.
@compute @workgroup_size(1)
fn ledger_audit() {
  var mass_sum: ExactMass; var energy_sum: ExactMass; var errors = 0u;
  for (var row = 0u; row < ROWS; row++) {
    let m = em_add(mass_sum, load_mass(row)); let e = el_add(energy_sum, load_energy(row));
    errors |= m.error | e.error; mass_sum = m.value; energy_sum = e.value;
  }
  store_control(${at.AUDIT_M}u, mass_sum); store_control(${at.AUDIT_U}u, energy_sum);
  let agrees = errors == 0u && em_compare(mass_sum, load_control(${at.LAST_M}u)) == 0
    && el_compare(energy_sum, load_control(${at.LAST_U}u)) == 0;
  atomicStore(&control[${C.AUDIT}u], select(2u, 1u, agrees));
}

@compute @workgroup_size(64)
fn ledger_project(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= ROWS) { return; }
  project_row(row, load_mass(row), load_energy(row));
}
`;
  return { code, at, BUDGET, controlWords: BUDGET + 3 * chunks4 };
}

const ENTRY = Object.freeze({ match: 'ledger_match', conduct: 'ledger_conduct', f32: 'reference_conduct',
  scatter: 'ledger_scatter', carry: 'ledger_carry', budget: 'ledger_budget' });

function summarize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pick = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { count: sorted.length, medianUs: pick(0.5), p90Us: pick(0.9), p99Us: pick(0.99),
    maxUs: sorted.at(-1), meanUs: sorted.reduce((a, b) => a + b, 0) / sorted.length };
}

// Runs the probe on `device` and returns fixed-size evidence. Never touches
// buffers it did not create. `yieldEvery` lets a host event loop (the live
// app's) run between submissions.
// On a device shared with a running app, pass errorScopes: false: scopes are a
// per-device stack, and interleaved async users would pop each other's scopes.
// Uncaptured errors are then collected by label from the device's event.
export async function runSphExactLedgerProbe(device, { fixture = createSphExactLedgerProbeFixture(),
  steps = 1000, batchSteps = 8, label = 'g2-ledger-probe', onBatch = null, errorScopes = true,
  stepIntervalMs = 0 } = {}) {
  const { format, rows, pairs } = fixture;
  const W = format.wordCount;
  const { code, at, controlWords } = probeWgsl(fixture);
  const timestamps = device.features.has('timestamp-query');
  const errors = [];
  const uncaptured = event => { if (String(event.error?.message).includes(label)) errors.push(String(event.error.message)); };
  if (errorScopes) for (const type of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(type);
  else device.addEventListener('uncapturederror', uncaptured);
  const created = [];
  const buffer = (name, size, usage, data = null) => {
    const value = device.createBuffer({ label: `${label}-${name}`, size: Math.max(16, Math.ceil(size / 16) * 16),
      usage, mappedAtCreation: Boolean(data) });
    if (data) { new data.constructor(value.getMappedRange()).set(data); value.unmap(); }
    created.push(value); return value;
  };
  const S = GPUBufferUsage.STORAGE, CS = GPUBufferUsage.COPY_SRC, CD = GPUBufferUsage.COPY_DST;
  const evidence = { schema: SPH_EXACT_LEDGER_PROBE_SCHEMA, rows, pairs, rounds: fixture.rounds,
    neighbourEdges: fixture.neighbourCount, scatterTargets: fixture.scatterTargets, steps,
    passes: SPH_EXACT_LEDGER_PROBE_PASSES, ledgerOnlyPasses: SPH_EXACT_LEDGER_PROBE_LEDGER_ONLY_PASSES,
    stepIntervalMs, timestamps, deviceFeatures: [...device.features], started: new Date().toISOString() };
  try {
    const module = device.createShaderModule({ label: `${label}-module`, code });
    const info = await module.getCompilationInfo();
    const bad = info.messages.filter(message => message.type === 'error');
    if (bad.length) throw new Error(bad.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));
    const layout = device.createBindGroupLayout({ label: `${label}-layout`, entries: Array.from({ length: 7 },
      (_, binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } })) });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const compileStarted = performance.now();
    const pipelines = {};
    for (const [name, entryPoint] of Object.entries({ ...ENTRY, audit: 'ledger_audit', project: 'ledger_project' })) {
      pipelines[name] = await device.createComputePipelineAsync({ label: `${label}-${name}`,
        layout: pipelineLayout, compute: { module, entryPoint } });
    }
    evidence.pipelineCompileMs = performance.now() - compileStarted;
    const control = new Uint32Array(controlWords);
    control.set(encodeSphExactMassUnits(fixture.massTotal, format), at.M0);
    control.set(encodeSphExactSignedUnits(fixture.energyTotal, format), at.U0);
    const buffers = [
      buffer('mass', fixture.mass.byteLength, S | CS, fixture.mass),
      buffer('energy', fixture.energy.byteLength, S | CS, fixture.energy),
      buffer('projection', rows * 8, S),
      buffer('topology', fixture.topology.byteLength, S, fixture.topology),
      buffer('row-counters', rows * 8 * W * 4, S),
      buffer('control', control.byteLength, S | CS, control),
      buffer('reference', rows * 4, S)
    ];
    const bindGroup = device.createBindGroup({ label: `${label}-bind`, layout,
      entries: buffers.map((value, binding) => ({ binding, resource: { buffer: value } })) });
    const groups = { match: Math.ceil(pairs / 64), conduct: Math.ceil(rows / 64), f32: Math.ceil(rows / 64),
      scatter: Math.ceil(rows / 64), carry: Math.ceil(rows / 64), budget: 1 };
    const passCount = SPH_EXACT_LEDGER_PROBE_PASSES.length;
    const queryCount = 2 * passCount * batchSteps;
    const querySet = timestamps ? device.createQuerySet({ label: `${label}-timestamps`, type: 'timestamp', count: queryCount }) : null;
    const resolve = timestamps ? buffer('resolve', queryCount * 8, GPUBufferUsage.QUERY_RESOLVE | CS) : null;
    const timing = Object.fromEntries(SPH_EXACT_LEDGER_PROBE_PASSES.map(name => [name, []]));
    const stepSpans = [];
    const readbacks = [];
    // Initial projections, so the first step reads the seeded ledgers.
    {
      const encoder = device.createCommandEncoder({ label: `${label}-seed` });
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipelines.project); pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(rows / 64)); pass.end();
      device.queue.submit([encoder.finish()]);
    }
    const runStarted = performance.now();
    let batchWallMax = 0;
    for (let first = 0; first < steps; first += batchSteps) {
      const count = Math.min(batchSteps, steps - first);
      const batchStarted = performance.now();
      for (let s = 0; s < count; s++) {
        const encoder = device.createCommandEncoder({ label: `${label}-step-${first + s}` });
        SPH_EXACT_LEDGER_PROBE_PASSES.forEach((name, p) => {
          const query = 2 * (s * passCount + p);
          const pass = encoder.beginComputePass({ label: `${label}-${name}`, ...(querySet ? { timestampWrites:
            { querySet, beginningOfPassWriteIndex: query, endOfPassWriteIndex: query + 1 } } : {}) });
          pass.setPipeline(pipelines[name]); pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(groups[name]); pass.end();
        });
        if (querySet && s === count - 1) {
          let readback = readbacks.pop();
          if (!readback) {
            readback = device.createBuffer({ label: `${label}-timestamp-readback`, size: queryCount * 8,
              usage: GPUBufferUsage.MAP_READ | CD });
            created.push(readback);
          }
          encoder.resolveQuerySet(querySet, 0, 2 * passCount * count, resolve, 0);
          encoder.copyBufferToBuffer(resolve, 0, readback, 0, 2 * passCount * count * 8);
          device.queue.submit([encoder.finish()]);
          await readback.mapAsync(GPUMapMode.READ);
          const ticks = new BigInt64Array(readback.getMappedRange().slice(0));
          readback.unmap(); readbacks.push(readback);
          for (let i = 0; i < count; i++) {
            const base = 2 * i * passCount;
            SPH_EXACT_LEDGER_PROBE_PASSES.forEach((name, p) => {
              timing[name].push(Number(ticks[base + 2 * p + 1] - ticks[base + 2 * p]) / 1000);
            });
            stepSpans.push(Number(ticks[base + 2 * passCount - 1] - ticks[base]) / 1000);
          }
        } else {
          device.queue.submit([encoder.finish()]);
        }
      }
      if (!querySet) await device.queue.onSubmittedWorkDone();
      batchWallMax = Math.max(batchWallMax, performance.now() - batchStarted);
      if (onBatch) await onBatch({ completed: first + count, steps });
      // Optional pacing: hold the average step interval, as a solver would
      // run its ledger passes once per simulation step.
      const due = runStarted + (first + count) * stepIntervalMs - performance.now();
      if (due > 0) await new Promise(resolve => setTimeout(resolve, due));
    }
    evidence.runWallMs = performance.now() - runStarted;
    evidence.batchWallMaxMs = batchWallMax;
    // Independent audit, then one fixed-size readback of the control record.
    const encoder = device.createCommandEncoder({ label: `${label}-audit` });
    const auditQuery = querySet ? { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } : undefined;
    const pass = encoder.beginComputePass({ label: `${label}-audit`, ...(auditQuery ? { timestampWrites: auditQuery } : {}) });
    pass.setPipeline(pipelines.audit); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(1); pass.end();
    const controlRead = device.createBuffer({ label: `${label}-control-read`, size: buffers[5].size,
      usage: GPUBufferUsage.MAP_READ | CD });
    created.push(controlRead);
    encoder.copyBufferToBuffer(buffers[5], 0, controlRead, 0, buffers[5].size);
    let auditRead = null;
    if (querySet) {
      auditRead = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | CD }); created.push(auditRead);
      encoder.resolveQuerySet(querySet, 0, 2, resolve, 0);
      encoder.copyBufferToBuffer(resolve, 0, auditRead, 0, 16);
    }
    device.queue.submit([encoder.finish()]);
    await controlRead.mapAsync(GPUMapMode.READ);
    const words = new Uint32Array(controlRead.getMappedRange().slice(0));
    controlRead.unmap();
    if (auditRead) {
      await auditRead.mapAsync(GPUMapMode.READ);
      const ticks = new BigInt64Array(auditRead.getMappedRange().slice(0));
      evidence.auditUs = Number(ticks[1] - ticks[0]) / 1000;
      auditRead.unmap();
    }
    querySet?.destroy();
    evidence.control = Array.from(words.slice(0, 16));
    evidence.ledgerWords = Object.fromEntries(Object.entries(at).map(([key, offset]) =>
      [key, Array.from(words.slice(offset, offset + W))]));
    evidence.timing = timestamps ? Object.fromEntries(Object.entries(timing).map(([name, values]) => [name, summarize(values)])) : null;
    evidence.stepGpuSpan = timestamps ? summarize(stepSpans) : null;
  } catch (error) {
    evidence.exception = error?.stack || String(error);
  } finally {
    if (errorScopes) {
      for (let i = 0; i < 3; i++) {
        const scoped = await device.popErrorScope().catch(error => error);
        if (scoped) errors.push(String(scoped.message || scoped));
      }
    } else device.removeEventListener('uncapturederror', uncaptured);
    for (const value of created) value.destroy();
    evidence.gpuErrors = errors;
    evidence.finished = new Date().toISOString();
  }
  return evidence;
}

// Host verification of the fixed-size evidence. Expected totals come from the
// host fixture and the host-reproducible source bits, not from the GPU.
export function verifySphExactLedgerProbeEvidence(evidence, fixture = createSphExactLedgerProbeFixture()) {
  const { format } = fixture;
  if (!evidence.control || !evidence.ledgerWords) {
    return Object.freeze({ passed: false, checks: { noException: !evidence.exception, evidenceRecorded: false } });
  }
  const words = key => Uint32Array.from(evidence.ledgerWords[key]);
  let sourceTotal = 0n, sourcePackets = 0;
  for (let step = 0; step < evidence.steps; step++) {
    for (let row = 0; row < fixture.rows; row++) {
      const bits = sphExactLedgerProbeSourceBits(step, row);
      if (bits & 0x7fffffff) { sourceTotal += sphExactUnitsFromF32Bits(bits, format); sourcePackets++; }
    }
  }
  const unsigned = key => decodeSphExactMass(words(key), format).coefficient;
  const signed = key => decodeSphExactSignedUnits(words(key), format);
  const control = evidence.control;
  const transfers = {
    match: evidence.steps * fixture.pairs,
    conductPairs: evidence.steps * fixture.neighbourCount / 2,
    scatter: evidence.steps * fixture.rows * fixture.scatterTargets,
    deposits: control[C.DEPOSITS], sources: control[C.SOURCES],
    clampedToDonor: control[C.CLAMPED], rejectedNonFinite: control[C.REJECTED]
  };
  const checks = {
    noException: !evidence.exception,
    noGpuErrors: evidence.gpuErrors.length === 0,
    allStepsRan: control[C.STEP] === evidence.steps,
    noArithmeticErrors: control[C.ERRORS] === 0,
    gpuBudgetEveryStep: control[C.FAILURES] === 0 && control[C.FIRST_FAILURE] === 0,
    massEqualsHostInitial: unsigned('LAST_M') === fixture.massTotal,
    sourcesMatchHost: signed('SOURCE') === sourceTotal && control[C.SOURCES] === sourcePackets,
    energyEqualsHostInitialPlusSources: signed('LAST_U') === fixture.energyTotal + sourceTotal,
    independentAuditAgrees: control[C.AUDIT] === 1 && unsigned('AUDIT_M') === fixture.massTotal
      && signed('AUDIT_U') === fixture.energyTotal + sourceTotal,
    atLeast1000RandomTransfers: transfers.match >= 1000,
    // Skipped non-finite packets would make the conduct timing optimistic.
    conductPacketsFinite: transfers.rejectedNonFinite <= 0.001 * 2 * transfers.conductPairs
  };
  return Object.freeze({ passed: Object.values(checks).every(Boolean), checks, transfers,
    massTotal: fixture.massTotal.toString(), energyInitial: fixture.energyTotal.toString(),
    sourceTotal: sourceTotal.toString(), energyFinal: signed('LAST_U').toString() });
}
