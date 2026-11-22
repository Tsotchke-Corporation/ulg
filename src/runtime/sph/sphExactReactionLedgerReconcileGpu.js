import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { createSphExactReactionAllocationWgsl } from './sphExactReactionAllocationWgsl.js';
import { createSphExactMassLedgerSuccessorWebGpu, acquireSphExactMassRead, releaseSphExactMassRead, releaseSphExactMassInventory }
  from './sphExactMassInventoryGpu.js';
import { encodeSphExactMassUnits } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { prepareSphReactionLineageCandidate } from './sphReactionLineageGpu.js';
import { createSphReactionResidualLedger, SPH_REACTION_LEDGER_PACKET_WORDS,
  SPH_REACTION_LEDGER_SCRATCH_HEADER_WORDS } from './sphReactionResidualLedgerGpu.js';
import {
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT, SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';
import {
  SPH_EXACT_THERMAL_ENERGY_FORMAT, SPH_EXACT_THERMAL_ENERGY_WORDS, SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS,
  sphExactThermalEnergyRecordWords
} from './sphExactThermalEnergyWgsl.js';

// Integer energy-ledger reaction step (plan/todo/g2-integer-ledger-proposal.md,
// Phase 3; user 2026-11-13: the heat-proxy reaction law, chemical heat as a
// recorded source). The f32 reaction resolve and product placement decide
// which pairs react, how much mass each consumes and where each product term
// lands. These passes run after the placement's transactional terminal seal,
// in the same encoder, and make that outcome exact:
//   - pairs: each committed pair takes integer stoichiometric debits from its
//     two donors (er_select_debits, cap = the f32 consumed total). A freed
//     donor gives its whole exact row. The exact total is split into product
//     terms by integer weight (er_product_share), and each term's mass into
//     its destinations (freed parent slots, placement events) by the
//     remainder rule. Consumed internal energy moves with the mass the same
//     way;
//   - events: a spare-row event writes its packet into the empty row;
//   - receivers: a capture-merge receiver adds every packet merged into it;
//   - projection: every touched row keeps the f32 path's u. Its exact energy
//     becomes fl32(m*u), and the difference from the energy that actually
//     arrived is booked to S. That difference is the chemical heat, the
//     thermalized relative kinetic energy and the f32 rounding of both.
//   - Mass is never a source: every quantum leaves one row and enters another.
// The f32 path drops a freed parent's remainder; the ledger moves it into the
// products, and the projection rewrites the f32 masses from the integer rows.
export const SPH_EXACT_REACTION_LEDGER_ERROR = Object.freeze({
  PARTIAL_COMMIT: 128, SPURIOUS_EVENT: 256, UNSUPPORTED_DISPOSITION: 512,
  REACTION_ARITHMETIC: 1024, LOST_TERM: 2048, NOT_EMPTY_SPARE: 4096
});
export const SPH_EXACT_REACTION_LEDGER_STATUS_REACTION = 4;
export const SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS = 8;
export const SPH_EXACT_REACTION_LEDGER_MAX_PRODUCT_TERMS = 16;
export const SPH_EXACT_REACTION_LEDGER_LOG_CAPACITY = 65536;
export const SPH_EXACT_REACTION_LEDGER_LOG_WORDS = 8;
const REACTION_VEC4 = 11, TERM_VEC4 = 6, HEADER_VEC4 = 2;
const TABLE_VEC4 = HEADER_VEC4 + SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS * REACTION_VEC4
  + SPH_EXACT_REACTION_LEDGER_MAX_PRODUCT_TERMS * TERM_VEC4;
const PACKET_WORDS = SPH_REACTION_LEDGER_PACKET_WORDS;
const SCRATCH_HEADER_WORDS = SPH_REACTION_LEDGER_SCRATCH_HEADER_WORDS;
const SAFE_PLACED = 1;
const NONE = 0xffffffff;
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, COPY_SRC: 0x04, COPY_DST: 0x08, UNIFORM: 0x40 });
const fail = message => { throw new TypeError(`Exact reaction ledger: ${message}`); };
const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };

function positiveDyadic(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) fail('positive finite term weight required');
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false), encoded = Number((bits >> 52n) & 2047n);
  let coefficient = (bits & ((1n << 52n) - 1n)) | (encoded ? 1n << 52n : 0n);
  let exponent = encoded ? encoded - 1075 : -1074;
  while ((coefficient & 1n) === 0n) { coefficient >>= 1n; exponent++; }
  return { coefficient, exponent };
}

// nu*M per term as exact integers with a common scale (gcd removed), from the
// table's own f32 coefficient and molar mass.
function integerWeights(terms) {
  const values = terms.map(term => {
    const a = positiveDyadic(term.coefficient), b = positiveDyadic(term.molarMass);
    return { coefficient: a.coefficient * b.coefficient, exponent: a.exponent + b.exponent };
  });
  const exponent = Math.min(...values.map(value => value.exponent));
  const integers = values.map(value => value.coefficient << BigInt(value.exponent - exponent));
  const divisor = integers.reduce(gcd);
  return integers.map(value => value / divisor);
}

/** Cold host compile of the heat-proxy reaction table into the reconcile's
 * integer weights and the resolve's freed-slot -> product-term map. */
export function compileSphExactReactionLedgerTable(reactionTable, format = SPH_EXACT_THERMAL_ENERGY_FORMAT) {
  if (!reactionTable?.reactionHeaders || !reactionTable.reactantTermRecords || !reactionTable.productTermRecords) {
    fail('reaction table records required');
  }
  if (reactionTable.energyAuthority) fail('the ledger carries the heat-proxy law, not a physical-energy table');
  const H = SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length, R = SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length;
  const P = SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length;
  const headers = reactionTable.reactionHeaders, reactants = reactionTable.reactantTermRecords;
  const products = reactionTable.productTermRecords;
  const reactionCount = headers.length / H, productTermTotal = products.length / P;
  if (!Number.isInteger(reactionCount) || reactionCount > SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS
      || !Number.isInteger(productTermTotal) || productTermTotal > SPH_EXACT_REACTION_LEDGER_MAX_PRODUCT_TERMS) {
    fail(`at most ${SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS} reactions and ${SPH_EXACT_REACTION_LEDGER_MAX_PRODUCT_TERMS} product terms`);
  }
  const words = new Uint32Array(TABLE_VEC4 * 4);
  const f32Bits = value => new Uint32Array(new Float32Array([value]).buffer)[0];
  const putExact = (vec4, value) => words.set(encodeSphExactMassUnits(value, format), vec4 * 4);
  const reactions = [];
  for (let r = 0; r < reactionCount; r++) {
    const h = headers.subarray(r * H, (r + 1) * H);
    const [rOff, rCount, pOff, pCount] = [h[1], h[2], h[3], h[4]].map(Number);
    const base = HEADER_VEC4 + r * REACTION_VEC4;
    if (rCount !== 2 || pCount < 1) { reactions.push({ reactionIndex: r, admitted: false }); continue; }
    const reactantTerms = [0, 1].map(k => {
      const row = reactants.subarray((rOff + k) * R, (rOff + k + 1) * R);
      return { materialId: row[1], coefficient: row[2], molarMass: row[3] };
    });
    const productTerms = Array.from({ length: pCount }, (_, k) => {
      const row = products.subarray((pOff + k) * P, (pOff + k + 1) * P);
      return { termIndex: pOff + k, materialId: row[1], coefficient: row[2], molarMass: row[3],
        gas: row[5] >= 0.5, ready: row[7] === 1 };
    });
    const reactantWeights = integerWeights(reactantTerms), productWeights = integerWeights(productTerms);
    const denominator = productWeights.reduce((a, b) => a + b, 0n);
    // product_term_for_parent_slot: condensed ready terms claim freed parent
    // slots first, then gas terms, the gas index clamped to the last gas term.
    const condensed = productTerms.filter(term => term.ready && !term.gas);
    const gas = productTerms.filter(term => term.ready && term.gas);
    const slotTerm = slot => slot < condensed.length ? condensed[slot].termIndex
      : gas.length ? gas[Math.min(slot - condensed.length, gas.length - 1)].termIndex : NONE;
    words.set([f32Bits(reactantTerms[0].materialId), f32Bits(reactantTerms[1].materialId), pOff, pCount], base * 4);
    words.set([slotTerm(0), slotTerm(1), 1, 0], (base + 1) * 4);
    putExact(base + 2, reactantWeights[0]); putExact(base + 5, reactantWeights[1]); putExact(base + 8, denominator);
    let prefix = 0n;
    productTerms.forEach((term, k) => {
      const termBase = HEADER_VEC4 + SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS * REACTION_VEC4 + term.termIndex * TERM_VEC4;
      putExact(termBase, prefix); prefix += productWeights[k]; putExact(termBase + 3, prefix);
    });
    reactions.push({ reactionIndex: r, admitted: true, reactantWeights, productWeights, denominator,
      slotTerms: [slotTerm(0), slotTerm(1)], productTerms });
  }
  return Object.freeze({ words, reactionCount, productTermTotal, reactions: Object.freeze(reactions) });
}

export const sphExactReactionLedgerReconcileWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactReactionAllocationWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT, { includeMassLibrary: false })}
struct LedgerTable {
  // particle_count, product_term_total, mass_offset_words, reaction_count
  header: vec4<u32>,
  // unused, unused, event_capacity, generation (terminal status and event
  // count are GPU results; the prepare pass writes them to scratch[1..2])
  status: vec4<u32>,
  rows: array<vec4<u32>, ${TABLE_VEC4 - HEADER_VEC4}>,
};

@group(0) @binding(0) var<storage, read> in_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> in_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> events: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> out_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> out_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> mass_in: array<u32>;
@group(0) @binding(6) var<storage, read_write> mass_out: array<u32>;
@group(0) @binding(7) var<storage, read> energy_in: array<u32>;
@group(0) @binding(8) var<storage, read_write> energy_out: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read_write> scratch: array<atomic<u32>>;
@group(0) @binding(10) var<storage, read> event_plan: array<vec4<f32>>;
@group(0) @binding(11) var<storage, read_write> lineage: array<atomic<u32>>;
@group(0) @binding(12) var<uniform> table: LedgerTable;

const SAFE_PLACED: u32 = ${SAFE_PLACED}u;
const NONE: u32 = ${NONE}u;
const REACTION_VEC4: u32 = ${REACTION_VEC4}u;
const TERM_BASE: u32 = ${SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS * REACTION_VEC4}u;
const TERM_VEC4: u32 = ${TERM_VEC4}u;
const MAX_TERMS: u32 = ${SPH_EXACT_REACTION_LEDGER_MAX_PRODUCT_TERMS}u;
const MAX_DESTS: u32 = ${SPH_EXACT_REACTION_LEDGER_MAX_PRODUCT_TERMS + 2}u;
const PACKET_WORDS: u32 = ${PACKET_WORDS}u;
const SCRATCH_HEADER_WORDS: u32 = ${SCRATCH_HEADER_WORDS}u;
const LOG_CAPACITY: u32 = ${SPH_EXACT_REACTION_LEDGER_LOG_CAPACITY}u;
const LOG_WORDS: u32 = ${SPH_EXACT_REACTION_LEDGER_LOG_WORDS}u;
const EVENT_VEC4: u32 = 8u;
const E_PARTIAL: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.PARTIAL_COMMIT}u;
const E_SPURIOUS: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.SPURIOUS_EVENT}u;
const E_DISPOSITION: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.UNSUPPORTED_DISPOSITION}u;
const E_ARITHMETIC: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.REACTION_ARITHMETIC}u;
const E_LOST_TERM: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.LOST_TERM}u;
const E_NOT_EMPTY: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.NOT_EMPTY_SPARE}u;
const STATUS_REACTION: u32 = ${SPH_EXACT_REACTION_LEDGER_STATUS_REACTION}u;

fn particle_count() -> u32 { return table.header.x; }
fn energy_rows() -> u32 { return table.header.x * EM_WORDS; }
fn control_word() -> u32 { return 2u * energy_rows(); }
fn flag(bits: u32) { atomicOr(&energy_out[control_word()], bits); }
fn table_exact(vec4_index: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = table.rows[vec4_index + i / 4u][i % 4u]; }
  return value;
}
fn load_mass_in(row: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = mass_in[table.header.z + row * EM_WORDS + i]; }
  return value;
}
fn load_mass_out(row: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = mass_out[row * EM_WORDS + i]; }
  return value;
}
fn store_mass(row: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { mass_out[row * EM_WORDS + i] = value.words[i]; }
}
fn load_energy_in(word: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = energy_in[word + i]; }
  return value;
}
fn load_energy_out(word: u32) -> ExactMass {
  var value = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = atomicLoad(&energy_out[word + i]); }
  return value;
}
fn store_energy(word: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&energy_out[word + i], value.words[i]); }
}
fn touch(row: u32, bit: u32) { atomicOr(&scratch[SCRATCH_HEADER_WORDS + row], bit); }
fn packet_base(event: u32) -> u32 { return SCRATCH_HEADER_WORDS + particle_count() + event * PACKET_WORDS; }
fn store_packet(event: u32, mass: ExactMass, energy: ExactMass) {
  let base = packet_base(event);
  for (var i = 0u; i < EM_WORDS; i++) {
    atomicStore(&scratch[base + 1u + i], mass.words[i]);
    atomicStore(&scratch[base + 1u + EM_WORDS + i], energy.words[i]);
  }
  atomicStore(&scratch[base], 1u);
}
fn packet_valid(event: u32) -> bool { return atomicLoad(&scratch[packet_base(event)]) == 1u; }
fn packet_mass(event: u32) -> ExactMass {
  var value = ExactMass();
  let base = packet_base(event);
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = atomicLoad(&scratch[base + 1u + i]); }
  return value;
}
fn packet_energy(event: u32) -> ExactMass {
  var value = ExactMass();
  let base = packet_base(event);
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = atomicLoad(&scratch[base + 1u + EM_WORDS + i]); }
  return value;
}
fn log_append(a: u32, b: u32, c: u32, d: u32, e: u32, f: u32) {
  let slot = atomicAdd(&lineage[0], 1u);
  if (slot >= LOG_CAPACITY) { atomicOr(&lineage[1], 1u); return; }
  let base = LOG_WORDS + slot * LOG_WORDS;
  atomicStore(&lineage[base], table.status.w);
  atomicStore(&lineage[base + 1u], a); atomicStore(&lineage[base + 2u], b);
  atomicStore(&lineage[base + 3u], c); atomicStore(&lineage[base + 4u], d);
  atomicStore(&lineage[base + 5u], e); atomicStore(&lineage[base + 6u], f);
}
fn terminal_status() -> u32 { return atomicLoad(&scratch[1]); }
fn event_count() -> u32 { return min(atomicLoad(&scratch[2]), table.status.z); }
fn event_row(event: u32, k: u32) -> vec4<f32> { return events[event * EVENT_VEC4 + k]; }
fn in_material(row: u32) -> u32 { return bitcast<u32>(in_thermo[row * 3u].x); }
fn out_material(row: u32) -> u32 { return bitcast<u32>(out_thermo[row * 3u].x); }
fn row_changed(row: u32) -> bool {
  return bitcast<u32>(out_state[row * 2u].w) != bitcast<u32>(in_state[row * 2u].w)
    || out_material(row) != in_material(row);
}
fn quanta(x: f32) -> ExactMassResult { return em_from_f32_bits(bitcast<u32>(max(x, 0.0))); }
fn view(a: ExactMass) -> f32 { return bitcast<f32>(em_project_f32_bits(a).bits); }
fn min_exact(a: ExactMass, b: ExactMass) -> ExactMass { if (em_compare(a, b) <= 0) { return a; } return b; }

struct Pair { found: u32, lo: u32, hi: u32, rx: u32 }
fn find_pair(row: u32) -> Pair {
  for (var e = 0u; e < event_count(); e++) {
    let r1 = event_row(e, 1u);
    let a = u32(max(r1.w, 0.0) + 0.5);
    let b = u32(max(event_row(e, 2u).x, 0.0) + 0.5);
    if (a == row || b == row) {
      return Pair(1u, min(a, b), max(a, b), u32(max(r1.z, 0.0) + 0.5));
    }
  }
  return Pair(0u, 0u, 0u, 0u);
}
fn find_event(lo: u32, hi: u32, term: u32) -> u32 {
  for (var e = 0u; e < event_count(); e++) {
    let r1 = event_row(e, 1u);
    if (u32(max(r1.w, 0.0) + 0.5) == lo && u32(max(event_row(e, 2u).x, 0.0) + 0.5) == hi
        && u32(max(r1.y, 0.0) + 0.5) == term) { return e; }
  }
  return NONE;
}
// The consumed internal energy of a survivor: fl32(debit*u), clamped.
fn consumed_energy(debit: ExactMass, u: f32, energy: ExactMass) -> ExactMass {
  let packet = el_from_f32_bits(bitcast<u32>(view(debit) * u));
  if (packet.error != 0u) { flag(E_ARITHMETIC); return ExactMass(); }
  if (!el_negative(energy) && !el_negative(packet.value) && el_compare(packet.value, energy) > 0) { return energy; }
  return packet.value;
}

@compute @workgroup_size(${SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS})
fn carry_ledger_control(@builtin(local_invocation_index) word: u32) {
  atomicStore(&energy_out[control_word() + word], energy_in[control_word() + word]);
}

@compute @workgroup_size(64)
fn reconcile_reaction_pairs(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= particle_count()) { return; }
  let rows = energy_rows();
  store_mass(row, load_mass_in(row));
  store_energy(row * EM_WORDS, load_energy_in(row * EM_WORDS));
  store_energy(rows + row * EM_WORDS, load_energy_in(rows + row * EM_WORDS));
  if (terminal_status() != SAFE_PLACED) { return; }
  let pair = find_pair(row);
  if (pair.found == 0u) { return; }
  let lo = pair.lo; let hi = pair.hi;
  let changed_lo = row_changed(lo); let changed_hi = row_changed(hi);
  if (!changed_lo && !changed_hi) { return; }
  // Every endpoint the f32 path touched is reprojected from the integer rows.
  touch(row, 1u);
  if (changed_lo != changed_hi || pair.rx >= table.header.w) { flag(E_PARTIAL); return; }
  if (row == lo) { atomicOr(&energy_out[control_word() + 1u], STATUS_REACTION); }
  let rbase = pair.rx * REACTION_VEC4;
  let rv0 = table.rows[rbase]; let rv1 = table.rows[rbase + 1u];
  let mat_lo = in_material(lo); let mat_hi = in_material(hi);
  var w_lo = ExactMass(); var w_hi = ExactMass();
  if (rv1.z != 1u) { flag(E_ARITHMETIC); return; }
  if (mat_lo == rv0.x && mat_hi == rv0.y) { w_lo = table_exact(rbase + 2u); w_hi = table_exact(rbase + 5u); }
  else if (mat_lo == rv0.y && mat_hi == rv0.x) { w_lo = table_exact(rbase + 5u); w_hi = table_exact(rbase + 2u); }
  else { flag(E_ARITHMETIC); return; }
  let mass_lo = load_mass_in(lo); let mass_hi = load_mass_in(hi);
  let energy_lo = load_energy_in(lo * EM_WORDS); let energy_hi = load_energy_in(hi * EM_WORDS);
  let freed_lo = out_material(lo) != mat_lo; let freed_hi = out_material(hi) != mat_hi;
  // The f32 path's consumed masses, as exact differences of its own rows.
  let in_lo = quanta(in_state[lo * 2u].w); let in_hi = quanta(in_state[hi * 2u].w);
  let out_lo = quanta(out_state[lo * 2u].w); let out_hi = quanta(out_state[hi * 2u].w);
  var consumed_lo = in_lo.value; var consumed_hi = in_hi.value;
  if (!freed_lo) { consumed_lo = em_subtract(in_lo.value, out_lo.value).value; }
  if (!freed_hi) { consumed_hi = em_subtract(in_hi.value, out_hi.value).value; }
  if ((in_lo.error | in_hi.error | out_lo.error | out_hi.error) != 0u
      || (!freed_lo && em_compare(out_lo.value, in_lo.value) > 0)
      || (!freed_hi && em_compare(out_hi.value, in_hi.value) > 0)) { flag(E_ARITHMETIC); return; }
  let cap = em_add(consumed_lo, consumed_hi);
  let selection = er_select_debits(mass_lo, mass_hi, cap.value, w_lo, w_hi);
  var debit_lo = selection.debit_a; var debit_hi = selection.debit_b;
  if (cap.error != 0u || selection.error != 0u || selection.executed == 0u) {
    flag(E_ARITHMETIC);
    debit_lo = min_exact(consumed_lo, mass_lo); debit_hi = min_exact(consumed_hi, mass_hi);
  }
  // A freed donor gives its whole row: the f32 path drops that remainder.
  if (freed_lo) { debit_lo = mass_lo; }
  if (freed_hi) { debit_hi = mass_hi; }
  let total = em_add(debit_lo, debit_hi);
  var q_lo = energy_lo; var q_hi = energy_hi;
  if (!freed_lo) { q_lo = consumed_energy(debit_lo, in_state[lo * 2u + 1u].w, energy_lo); }
  if (!freed_hi) { q_hi = consumed_energy(debit_hi, in_state[hi * 2u + 1u].w, energy_hi); }
  let energy_total = el_add(q_lo, q_hi);
  if ((total.error | energy_total.error) != 0u || em_zero(total.value)) { flag(E_ARITHMETIC); return; }
  // Freed parent slots: the lower endpoint is slot 0; the higher is slot 1 if
  // the lower is also freed, else slot 0.
  var slot_term_lo = NONE; var slot_term_hi = NONE;
  if (freed_lo) { slot_term_lo = rv1.x; }
  if (freed_hi) { slot_term_hi = select(rv1.x, rv1.y, freed_lo); }
  let shares = ExactReactionDebits(total.value, debit_lo, debit_hi, ExactMass(), ExactMass(), 0u, 1u);
  let denominator = table_exact(rbase + 8u);
  // Destinations in a fixed order; kind 0 = lower slot, 1 = higher slot, 2 = event.
  var dest_kind = array<u32, MAX_DESTS>();
  var dest_event = array<u32, MAX_DESTS>();
  var dest_mass = array<ExactMass, MAX_DESTS>();
  var dests = 0u;
  for (var k = 0u; k < min(rv0.w, MAX_TERMS); k++) {
    let term = rv0.z + k;
    let tbase = TERM_BASE + term * TERM_VEC4;
    let share = er_product_share(shares, table_exact(tbase), table_exact(tbase + 3u), denominator);
    if (share.error != 0u) { flag(E_ARITHMETIC); }
    var left = share.mass;
    let has_lo = slot_term_lo == term; let has_hi = slot_term_hi == term;
    let event = find_event(lo, hi, term);
    if (event != NONE && dests < MAX_DESTS) {
      var part = left;
      if (has_lo || has_hi) {
        let unplaced = quanta(event_row(event, 3u).y);
        part = min_exact(unplaced.value, left);
      }
      if (!em_zero(part)) {
        dest_kind[dests] = 2u; dest_event[dests] = event; dest_mass[dests] = part; dests++;
        left = em_subtract(left, part).value;
      }
    }
    if (has_lo && has_hi && dests + 1u < MAX_DESTS) {
      let split = em_multiply_ratio(left, consumed_lo, cap.value);
      dest_kind[dests] = 0u; dest_event[dests] = NONE; dest_mass[dests] = split.value; dests++;
      dest_kind[dests] = 1u; dest_event[dests] = NONE; dest_mass[dests] = em_subtract(left, split.value).value; dests++;
    } else if ((has_lo || has_hi) && dests < MAX_DESTS) {
      dest_kind[dests] = select(1u, 0u, has_lo); dest_event[dests] = NONE; dest_mass[dests] = left; dests++;
    } else if (!em_zero(left)) {
      // No slot and no event: keep the mass on the lower row, never drop it.
      flag(E_LOST_TERM);
      if (dests < MAX_DESTS) { dest_kind[dests] = 0u; dest_event[dests] = NONE; dest_mass[dests] = left; dests++; }
    }
  }
  // Consumed internal energy follows the mass with the remainder rule.
  var dest_energy = array<ExactMass, MAX_DESTS>();
  var energy_left = energy_total.value;
  let energy_per_mass = view(energy_total.value) / max(view(total.value), 1.0e-30);
  for (var d = 0u; d < dests; d++) {
    var packet = energy_left;
    if (d + 1u < dests) {
      let value = el_from_f32_bits(bitcast<u32>(view(dest_mass[d]) * energy_per_mass));
      packet = value.value;
      if (value.error != 0u) { flag(E_ARITHMETIC); packet = ExactMass(); }
      if (!el_negative(energy_left) && el_compare(packet, energy_left) > 0) { packet = energy_left; }
    }
    dest_energy[d] = packet;
    energy_left = el_subtract(energy_left, packet).value;
  }
  // Each endpoint writes only its own row.
  let mine = select(1u, 0u, row == lo);
  let freed_mine = select(freed_hi, freed_lo, row == lo);
  var row_mass = ExactMass(); var row_energy = ExactMass();
  if (!freed_mine) {
    if (row == lo) {
      row_mass = em_subtract(mass_lo, debit_lo).value; row_energy = el_subtract(energy_lo, q_lo).value;
    } else {
      row_mass = em_subtract(mass_hi, debit_hi).value; row_energy = el_subtract(energy_hi, q_hi).value;
    }
  }
  for (var d = 0u; d < dests; d++) {
    if (dest_kind[d] == mine) {
      row_mass = em_add(row_mass, dest_mass[d]).value;
      row_energy = el_add(row_energy, dest_energy[d]).value;
    }
  }
  store_mass(row, row_mass);
  store_energy(row * EM_WORDS, row_energy);
  if (row == lo) {
    for (var d = 0u; d < dests; d++) {
      if (dest_kind[d] == 2u) { store_packet(dest_event[d], dest_mass[d], dest_energy[d]); }
    }
    log_append(1u, pair.rx, lo, hi, select(0u, 1u, freed_lo) | select(0u, 2u, freed_hi), dests);
  }
}

// Spare-row events write their packet into the empty row (one writer each).
@compute @workgroup_size(64)
fn reconcile_reaction_events(@builtin(global_invocation_id) id: vec3<u32>) {
  let event = id.x;
  if (event >= event_count() || terminal_status() != SAFE_PLACED) { return; }
  let plan = event_plan[event * 2u + 1u];
  let disposition = u32(max(plan.x, 0.0) + 0.5);
  let valid = packet_valid(event);
  if (!valid) {
    if (disposition == 3u || disposition == 4u || disposition == 6u) { flag(E_SPURIOUS); }
    return;
  }
  if (disposition == 3u) {
    let spare_row = u32(max(plan.z, 0.0) + 0.5);
    if (spare_row >= particle_count()) { flag(E_ARITHMETIC); return; }
    if (!em_zero(load_mass_in(spare_row))) { flag(E_NOT_EMPTY); }
    store_mass(spare_row, em_add(load_mass_out(spare_row), packet_mass(event)).value);
    store_energy(spare_row * EM_WORDS, el_add(load_energy_out(spare_row * EM_WORDS), packet_energy(event)).value);
    touch(spare_row, 2u);
    log_append(2u, event, spare_row, 3u, u32(max(event_row(event, 1u).w, 0.0) + 0.5),
      u32(max(event_row(event, 2u).x, 0.0) + 0.5));
  } else if (disposition == 4u) {
    log_append(2u, event, u32(max(plan.y, 0.0) + 0.5), 4u, u32(max(event_row(event, 1u).w, 0.0) + 0.5),
      u32(max(event_row(event, 2u).x, 0.0) + 0.5));
  } else if (disposition != 2u) {
    // Private residual rows are retained exactly in a separate ledger below.
    // Keep admission refused until history merge and native mechanics consume
    // that owner; producing its quantities alone is not physical publication.
    flag(E_DISPOSITION);
  }
}

// A capture-merge receiver adds every packet merged into it.
@compute @workgroup_size(64)
fn reconcile_reaction_receivers(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= particle_count() || terminal_status() != SAFE_PLACED) { return; }
  var mass = ExactMass(); var energy = ExactMass(); var any = false;
  for (var e = 0u; e < event_count(); e++) {
    let plan = event_plan[e * 2u + 1u];
    if (u32(max(plan.x, 0.0) + 0.5) != 4u || u32(max(plan.y, 0.0) + 0.5) != row || !packet_valid(e)) { continue; }
    mass = em_add(mass, packet_mass(e)).value;
    energy = el_add(energy, packet_energy(e)).value;
    any = true;
  }
  if (!any) { return; }
  store_mass(row, em_add(load_mass_out(row), mass).value);
  store_energy(row * EM_WORDS, el_add(load_energy_out(row * EM_WORDS), energy).value);
  touch(row, 4u);
}
`;

// The placement's own GPU results: the transactional terminal status
// (receipt word 77) and the compacted event count, into the scratch header.
export const sphExactReactionLedgerPrepareWgsl = /* wgsl */ `
@group(0) @binding(0) var<storage, read> receipt: array<u32>;
@group(0) @binding(1) var<storage, read> compact_counts: array<u32>;
@group(0) @binding(2) var<storage, read_write> scratch: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> validation: array<u32>;
@compute @workgroup_size(1)
fn prepare_reaction_ledger() {
  atomicStore(&scratch[1], receipt[77]);
  atomicStore(&scratch[2], compact_counts[0]);
  validation[0] = 0x524c4731u;
  validation[1] = 1u;
  validation[2] = receipt[77];
  validation[3] = compact_counts[0];
  validation[4] = receipt[47];
  validation[5] = receipt[46];
  validation[6] = receipt[15];
  validation[7] = receipt[18];
}
`;

// The projection pass binds the destination mechanics and writes the f32 view.
export const sphExactReactionLedgerProjectionWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
struct ProjectionParams { particle_count: u32, pad0: u32, pad1: u32, pad2: u32 };
@group(0) @binding(0) var<storage, read_write> out_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> out_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> out_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> mass_out: array<u32>;
@group(0) @binding(4) var<storage, read_write> energy_out: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> scratch: array<u32>;
@group(0) @binding(6) var<uniform> params: ProjectionParams;
const SCRATCH_HEADER_WORDS: u32 = ${SCRATCH_HEADER_WORDS}u;
const E_ARITHMETIC: u32 = ${SPH_EXACT_REACTION_LEDGER_ERROR.REACTION_ARITHMETIC}u;

@compute @workgroup_size(64)
fn project_reaction_ledger(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= params.particle_count || scratch[SCRATCH_HEADER_WORDS + row] == 0u) { return; }
  let rows = params.particle_count * EM_WORDS;
  var mass = ExactMass(); var energy = ExactMass(); var source = ExactMass();
  for (var i = 0u; i < EM_WORDS; i++) {
    mass.words[i] = mass_out[row * EM_WORDS + i];
    energy.words[i] = atomicLoad(&energy_out[row * EM_WORDS + i]);
    source.words[i] = atomicLoad(&energy_out[rows + row * EM_WORDS + i]);
  }
  let mass_bits = em_project_f32_bits(mass);
  let m = bitcast<f32>(mass_bits.bits);
  let state0 = out_state[row * 2u];
  let state1 = out_state[row * 2u + 1u];
  // The f32 path decides u; the integer energy becomes fl32(m*u) and the
  // difference from what arrived (chemical heat, merge KE, rounding) is S.
  var final_energy = ExactMass();
  var errors = mass_bits.error;
  if (m > 0.0) {
    let value = el_from_f32_bits(bitcast<u32>(m * state1.w));
    final_energy = value.value; errors |= value.error;
  }
  let delta = el_subtract(final_energy, energy);
  let next_source = el_add(source, delta.value);
  errors |= delta.error | next_source.error;
  for (var i = 0u; i < EM_WORDS; i++) {
    atomicStore(&energy_out[row * EM_WORDS + i], final_energy.words[i]);
    atomicStore(&energy_out[rows + row * EM_WORDS + i], next_source.value.words[i]);
  }
  if (bitcast<u32>(state0.w) != mass_bits.bits) {
    let mechanics4 = out_mechanics[row * 8u + 4u];
    let rest_density = out_thermo[row * 3u].w;
    let rest_volume = select(mechanics4.w * m / max(state0.w, 1.0e-30), m / rest_density,
      rest_density > 0.0);
    out_mechanics[row * 8u + 4u] = vec4<f32>(mechanics4.xyz, select(0.0, rest_volume, m > 0.0));
    let mechanics7 = out_mechanics[row * 8u + 7u];
    out_mechanics[row * 8u + 7u] = vec4<f32>(mechanics7.xyz, m);
  }
  out_state[row * 2u] = vec4<f32>(state0.xyz, m);
  if (errors != 0u) { atomicOr(&energy_out[2u * rows], E_ARITHMETIC); }
}
`;

const lineageBuffers = new WeakMap();
const reconcileStages = new WeakSet();
/** A ledger reconcile stage created by this module: the reaction placement's
 * exact-inventory authority on the G2 ledger route. */
export function isSphExactReactionLedgerReconcileStage(stage) {
  return reconcileStages.has(stage);
}
/** One persistent lineage log per device: word 0 counts appended rows; each
 * row is [generation, kind, a, b, c, d, e, 0]. Kind 1 = committed pair
 * (rx, lower, higher, freed bits, destinations); kind 2 = event delivery
 * (event, destination row, disposition, lower, higher). */
export function sphExactReactionLedgerLineageBuffer(device) {
  let buffer = lineageBuffers.get(device);
  if (!buffer) {
    buffer = tagWebGpuBufferDevice(device.createBuffer({ label: 'ulg-exact-reaction-lineage',
      size: (1 + SPH_EXACT_REACTION_LEDGER_LOG_CAPACITY) * SPH_EXACT_REACTION_LEDGER_LOG_WORDS * 4,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST }), device);
    lineageBuffers.set(device, buffer);
  }
  return buffer;
}

/** Prepares the ledger passes for one f32 reaction step. The placement
 * encoder calls encode() after its transactional terminal seal. The successor
 * mass family and energy record belong to the result until a continuation
 * owner adopts them. */
export function createSphExactReactionLedgerReconcileStage({ device, particleCount, compiledTable,
  massRead, energy, generation = 0, privateLineage = false, lineageSource = null } = {}) {
  const rowCount = particleCount;
  if (!Number.isSafeInteger(rowCount) || rowCount < 1 || !compiledTable?.words) {
    fail('particle count and compiled reaction table required');
  }
  if (!energy || energy.rowCount !== rowCount || energy.format.wordCount !== SPH_EXACT_THERMAL_ENERGY_WORDS
      || energy.format.quantumExponent !== SPH_EXACT_THERMAL_ENERGY_FORMAT.quantumExponent
      || energy.energyBuffer.size !== sphExactThermalEnergyRecordWords(rowCount) * 4
      || webGpuBufferDevice(energy.energyBuffer) !== device
      || massRead?.rowCount !== rowCount || massRead.format !== energy.format || massRead.byteOffset % 4 !== 0) {
    fail('complete carrier mass and energy records required');
  }
  const useQueueOrderedPool = Boolean(
    typeof globalThis.GPUDevice === 'function'
    && device instanceof globalThis.GPUDevice
  );
  const allocTemp = (label, size, usage) => (
    useQueueOrderedPool
      ? registerQueueOrderedPooledBufferReturn(
          acquireQueueOrderedPooledBuffer(device, { bucketKey: label, label, size, usage }),
          device,
          { bucketKey: label, size, usage }
        )
      : device.createBuffer({ label, size, usage })
  );
  const massSuccessor = createSphExactMassLedgerSuccessorWebGpu({ device, sourceRead: massRead });
  let energyOutput = null, validationBuffer = null, tableBuffer = null, projectionParams = null, scratch = null, lineageCandidate = null, residualLedger = null;
  let settled = false, encoded = false;
  const destroyOwned = () => {
    releaseOrDestroyQueueOrderedPooledBuffer(energyOutput);
    releaseOrDestroyQueueOrderedPooledBuffer(validationBuffer);
    releaseOrDestroyQueueOrderedPooledBuffer(tableBuffer);
    releaseOrDestroyQueueOrderedPooledBuffer(projectionParams);
    releaseOrDestroyQueueOrderedPooledBuffer(scratch);
    lineageCandidate?.destroy();
    residualLedger?.destroy();
  };
  try {
    if (lineageSource && !privateLineage) fail('private lineage cannot return to the global diagnostic log');
    if (privateLineage) lineageCandidate = prepareSphReactionLineageCandidate({ device, source: lineageSource });
    validationBuffer = tagWebGpuBufferDevice(allocTemp('ulg-exact-reaction-ledger-validation',
      32, GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST), device);
    energyOutput = tagWebGpuBufferDevice(allocTemp('ulg-exact-energy-reaction-ledger',
      energy.energyBuffer.size,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST), device);
    const tableWords = compiledTable.words.slice();
    tableWords.set([rowCount, compiledTable.productTermTotal, massRead.byteOffset / 4, compiledTable.reactionCount], 0);
    tableWords.set([0, 0, 0, generation >>> 0], 4);
    tableBuffer = allocTemp('ulg-exact-reaction-ledger-table', tableWords.byteLength,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST);
    projectionParams = allocTemp('ulg-exact-reaction-ledger-projection-params', 16,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST);
    device.queue.writeBuffer(projectionParams, 0, new Uint32Array([rowCount, 0, 0, 0]));
    const lineage = lineageCandidate?.record.buffer ?? sphExactReactionLedgerLineageBuffer(device);
    const bindings = ['read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage',
      'read-only-storage', 'read-only-storage', 'storage', 'read-only-storage', 'storage', 'storage',
      'read-only-storage', 'storage', 'uniform'].map((type, binding) => computeBufferBinding(binding, type));
    const pipelines = Object.fromEntries(['carry_ledger_control', 'reconcile_reaction_pairs',
      'reconcile_reaction_events', 'reconcile_reaction_receivers'].map(entryPoint => [entryPoint,
      createCachedExplicitComputePipeline(device, { cacheKey: `ulg-exact-reaction-ledger-${entryPoint}.v3-residual`,
        label: `ulg-exact-reaction-ledger-${entryPoint}`, code: sphExactReactionLedgerReconcileWgsl, entryPoint, bindings })]));
    const projectionBindings = ['storage', 'read-only-storage', 'storage', 'read-only-storage', 'storage',
      'read-only-storage', 'uniform'].map((type, binding) => computeBufferBinding(binding, type));
    const prepare = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-exact-reaction-ledger-prepare.v2',
      label: 'ulg-exact-reaction-ledger-prepare', code: sphExactReactionLedgerPrepareWgsl,
      entryPoint: 'prepare_reaction_ledger',
      bindings: ['read-only-storage', 'read-only-storage', 'storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type)) });
    const projection = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-exact-reaction-ledger-projection.v1',
      label: 'ulg-exact-reaction-ledger-projection', code: sphExactReactionLedgerProjectionWgsl,
      entryPoint: 'project_reaction_ledger', bindings: projectionBindings });
    const groups = Math.ceil(rowCount / 64);
    const stage = Object.freeze({
      get encoded() { return encoded; },
      /** Encode after the placement's transactional terminal seal. */
      encode(encoder, { events, eventPlan, compactCount, receipt, eventCapacity,
        rollbackState, rollbackThermo, state, thermo, mechanics } = {}) {
        if (settled || encoded) fail('reconcile already encoded or settled');
        for (const buffer of [events, eventPlan, compactCount, receipt, rollbackState, rollbackThermo, state, thermo, mechanics]) {
          if (!buffer || webGpuBufferDevice(buffer) !== device) fail('placement buffers must share the device');
        }
        if (!Number.isSafeInteger(eventCapacity) || eventCapacity < 0) fail('event capacity required');
        lineageCandidate?.encodeBefore(encoder);
        tableWords[6] = eventCapacity;
        device.queue.writeBuffer(tableBuffer, 0, tableWords);
        const scratchWords = SCRATCH_HEADER_WORDS + rowCount + Math.max(eventCapacity, 1) * PACKET_WORDS;
        scratch = tagWebGpuBufferDevice(allocTemp('ulg-exact-reaction-ledger-scratch', scratchWords * 4,
          GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST), device);
        if (useQueueOrderedPool) {
          encoder.clearBuffer(validationBuffer, 0, 32);
          encoder.clearBuffer(scratch, 0, scratchWords * 4);
          encoder.clearBuffer(energyOutput, 2 * rowCount * SPH_EXACT_THERMAL_ENERGY_WORDS * 4, 16);
        }
        const prepareGroup = device.createBindGroup({ layout: prepare.bindGroupLayout,
          entries: [receipt, compactCount, scratch, validationBuffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
        const bindGroup = device.createBindGroup({ layout: pipelines.reconcile_reaction_pairs.bindGroupLayout,
          entries: [rollbackState, rollbackThermo, events, state, thermo, massRead.buffer, massSuccessor.buffer,
            energy.energyBuffer, energyOutput, scratch, eventPlan, lineage, tableBuffer]
            .map((buffer, binding) => ({ binding, resource: { buffer } })) });
        const projectionGroup = device.createBindGroup({ layout: projection.bindGroupLayout,
          entries: [state, thermo, mechanics, massSuccessor.buffer, energyOutput, scratch, projectionParams]
            .map((buffer, binding) => ({ binding, resource: { buffer } })) });
        const run = (pipeline, group, workgroups) => {
          const pass = encoder.beginComputePass({ label: 'ulg-exact-reaction-ledger' });
          pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(workgroups); pass.end();
        };
        run(prepare, prepareGroup, 1);
        run(pipelines.carry_ledger_control, bindGroup, 1);
        run(pipelines.reconcile_reaction_pairs, bindGroup, groups);
        run(pipelines.reconcile_reaction_events, bindGroup, Math.max(1, Math.ceil(eventCapacity / 64)));
        run(pipelines.reconcile_reaction_receivers, bindGroup, groups);
        run(projection, projectionGroup, groups);
        if (privateLineage) {
          residualLedger = createSphReactionResidualLedger({ device, capacity: eventCapacity, generation: generation >>> 0 });
          residualLedger.encode(encoder, { scratch, events, eventPlan, energyOutput, particleCount: rowCount });
        }
        encoded = true;
      },
      /** After submission: the successor mass read and energy record. */
      commit() {
        if (settled || !encoded) fail('reconcile must be encoded once before commit');
        settled = true;
        releaseOrDestroyQueueOrderedPooledBuffer(tableBuffer); tableBuffer = null;
        releaseOrDestroyQueueOrderedPooledBuffer(projectionParams); projectionParams = null;
        releaseOrDestroyQueueOrderedPooledBuffer(scratch); scratch = null;
        const family = massSuccessor.commit();
        let energyAdopted = false;
        return Object.freeze({
          carrierMassRead: acquireSphExactMassRead({ family, device }),
          validationBuffer,
          lineageRecord: lineageCandidate?.record ?? null,
          transferLineage: lineageCandidate?.transfer ?? null,
          residualLedger: residualLedger?.commit() ?? null,
          exactEnergy: Object.freeze({ energyBuffer: energyOutput, format: energy.format, rowCount }),
          transferExactEnergy() {
            if (energyAdopted) fail('exact energy record was already adopted');
            energyAdopted = true;
          },
          get energyAdopted() { return energyAdopted; }
        });
      },
      abandon() {
        if (settled) return false;
        settled = true; massSuccessor.abandon(); destroyOwned(); return true;
      },
      releaseUnadopted(committed, { deferInBurst = true } = {}) {
        return releaseSphExactMassRead(committed.carrierMassRead, { deferInBurst }).then(() => {
          if (!committed.energyAdopted) releaseOrDestroyQueueOrderedPooledBuffer(energyOutput);
          releaseOrDestroyQueueOrderedPooledBuffer(validationBuffer);
          lineageCandidate?.destroy();
          residualLedger?.destroy();
          releaseSphExactMassInventory(committed.carrierMassRead.family);
        });
      }
    });
    reconcileStages.add(stage);
    return stage;
  } catch (error) {
    massSuccessor.abandon(); destroyOwned();
    throw error;
  }
}
