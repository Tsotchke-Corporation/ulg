import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileSphExactReactionLedgerTable, sphExactReactionLedgerReconcileWgsl,
  sphExactReactionLedgerProjectionWgsl, sphExactReactionLedgerPrepareWgsl,
  SPH_EXACT_REACTION_LEDGER_ERROR, SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS
} from '../src/runtime/sph/sphExactReactionLedgerReconcileGpu.js';
import {
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT, SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import { SPH_EXACT_THERMAL_ENERGY_ERROR } from '../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { SPH_EXACT_PHASE_LEDGER_ERROR } from '../src/runtime/sph/sphExactPhaseLedgerReconcileGpu.js';

// 2 Na + 2 H2O -> 2 NaOH + H2, packed in the reaction table's own row layout.
function sodiumWaterTable({ energyAuthority = null } = {}) {
  const H = SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length, R = SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length;
  const P = SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length;
  const headers = new Float32Array(H), reactants = new Float32Array(2 * R), products = new Float32Array(2 * P);
  headers.set([0, 0, 2, 0, 2]);
  reactants.set([0, 11, 2, 0.02298977], 0);
  reactants.set([0, 501, 2, 0.01801528], R);
  // routing 0 = condensed, 1 = gas; status 1 = ready.
  products.set([0, 602, 2, 0.03999711, 0.97, 0, 2, 1], 0);
  products.set([0, 703, 1, 0.00201588, 0.03, 1, 3, 1], P);
  return { reactionHeaders: headers, reactantTermRecords: reactants, productTermRecords: products, energyAuthority };
}

test('the reaction ledger compiles integer nu*M weights and the freed-slot term map', () => {
  const compiled = compileSphExactReactionLedgerTable(sodiumWaterTable());
  assert.equal(compiled.reactionCount, 1);
  assert.equal(compiled.productTermTotal, 2);
  const [reaction] = compiled.reactions;
  assert.equal(reaction.admitted, true);
  const [wNa, wH2O] = reaction.reactantWeights;
  // Exact integers in the ratio of the table's own f32 nu*M.
  const f32 = Math.fround;
  const ratio = Number(wNa) / Number(wH2O);
  assert.ok(Math.abs(ratio - (f32(2) * f32(0.02298977)) / (f32(2) * f32(0.01801528))) < 1e-12);
  assert.equal(reaction.denominator, reaction.productWeights[0] + reaction.productWeights[1]);
  // Condensed NaOH claims freed slots first; the lone gas term takes the rest.
  assert.deepEqual(reaction.slotTerms, [0, 1]);
});

test('the reaction ledger refuses a physical-energy table', () => {
  assert.throws(() => compileSphExactReactionLedgerTable(sodiumWaterTable({ energyAuthority: {} })), /heat-proxy/);
  const many = sodiumWaterTable();
  const H = SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length;
  many.reactionHeaders = new Float32Array(H * (SPH_EXACT_REACTION_LEDGER_MAX_REACTIONS + 1));
  assert.throws(() => compileSphExactReactionLedgerTable(many), /at most/);
});

test('reaction ledger error bits are disjoint from the thermal and phase ledger bits', () => {
  const bits = [...Object.values(SPH_EXACT_THERMAL_ENERGY_ERROR), ...Object.values(SPH_EXACT_PHASE_LEDGER_ERROR),
    ...Object.values(SPH_EXACT_REACTION_LEDGER_ERROR)];
  assert.equal(new Set(bits).size, bits.length);
  for (const bit of bits) assert.equal(bit & (bit - 1), 0, `${bit} is one bit`);
});

test('reaction ledger WGSL keeps its contracts: GPU-read status, one writer per row, no struct select', () => {
  // The terminal status and event count are GPU results read from storage:
  // the compact-count buffer has no COPY_SRC, so a buffer copy would
  // invalidate the whole placement submission.
  assert.match(sphExactReactionLedgerPrepareWgsl, /atomicStore\(&scratch\[1\], receipt\[77\]\)/);
  assert.match(sphExactReactionLedgerPrepareWgsl, /atomicStore\(&scratch\[2\], compact_counts\[0\]\)/);
  assert.doesNotMatch(sphExactReactionLedgerReconcileWgsl, /table\.status\.x/);
  // Each endpoint writes only its own row; the lower endpoint writes packets.
  assert.match(sphExactReactionLedgerReconcileWgsl, /store_mass\(row, row_mass\)/);
  assert.match(sphExactReactionLedgerReconcileWgsl, /if \(row == lo\) \{\s*for \(var d = 0u; d < dests/);
  // A freed donor gives its whole row; nothing of it is dropped.
  assert.match(sphExactReactionLedgerReconcileWgsl, /if \(freed_lo\) \{ debit_lo = mass_lo; \}/);
  // The projection books f32-decided energy changes to S.
  assert.match(sphExactReactionLedgerProjectionWgsl, /let next_source = el_add\(source, delta\.value\)/);
  // The reconcile's own code (after the shared exact-mass libraries).
  const own = [sphExactReactionLedgerReconcileWgsl.slice(sphExactReactionLedgerReconcileWgsl.indexOf('struct LedgerTable')),
    sphExactReactionLedgerProjectionWgsl.slice(sphExactReactionLedgerProjectionWgsl.indexOf('struct ProjectionParams'))];
  for (const code of own) {
    assert.doesNotMatch(code, /var \w+: (ExactMass|array<)/, 'private values need explicit zero initializers');
    assert.doesNotMatch(code, /select\(ExactMass|select\([a-z_]*(mass|energy)[a-z_]*, /, 'no select on ExactMass structs');
  }
});
