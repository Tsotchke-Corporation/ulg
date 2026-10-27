import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as R,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS as STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS as TERMINAL }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';
import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactRationalQuantityLayout } from './sphExactRationalQuantityWgsl.js';

// Reuses the original 64-byte placement uniform byte for byte. Integer views
// are deliberate: none of these terminal passes performs physical arithmetic.
const PARAMS = /* wgsl */ `
struct ExactPlacementTerminalParams { words: array<vec4<u32>, 4> }
`;

/** Exact generated kernels below are one-dimensional. Check expanded ledger
 * and current+residual row domains explicitly before any allocation/encoding;
 * valid base particle/event group counts do not bound these dispatches.
 */
export function planSphExactPlacementTerminalWorkgroups({ particleCount, eventCapacity,
  productTermCount, eventStrideVec4 = 8, maxComputeWorkgroupsPerDimension } = {}) {
  for (const [name, value] of Object.entries({ particleCount, eventCapacity, productTermCount,
    eventStrideVec4, maxComputeWorkgroupsPerDimension })) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0xffffffff) {
      throw new RangeError(`Exact terminal ${name} must be a positive u32`);
    }
  }
  const rows = { physical: particleCount, quantities: particleCount + eventCapacity,
    ledgers: Math.max(eventCapacity * eventStrideVec4, productTermCount * 8) };
  const groups = {};
  for (const [name, count] of Object.entries(rows)) {
    const groupCount = Math.ceil(count / 64);
    if (!Number.isSafeInteger(count) || count > 0xffffffff || groupCount > maxComputeWorkgroupsPerDimension) {
      throw new RangeError(`Exact terminal ${name} dispatch exceeds checked device capacity`);
    }
    groups[name] = groupCount;
  }
  return Object.freeze(groups);
}

/** Exact variants of the existing pre-terminal physical disposition counter
 * and final physical recovery. They use the same receipt counters and the
 * same sole final selector. All 52 physical words, including NaN payloads,
 * subnormals and signed zeros, are copied without a floating-point view.
 * This factory does not mint placement authority or choose terminal status.
 */
export function createSphExactPlacementPhysicalTerminalWgsl() {
  return PARAMS + /* wgsl */ `
@group(0) @binding(0) var<storage, read> xt_rollback_state: array<u32>;
@group(0) @binding(1) var<storage, read> xt_rollback_thermo: array<u32>;
@group(0) @binding(2) var<storage, read> xt_rollback_mechanics: array<u32>;
@group(0) @binding(3) var<storage, read_write> xt_state: array<u32>;
@group(0) @binding(4) var<storage, read_write> xt_thermo: array<u32>;
@group(0) @binding(5) var<storage, read_write> xt_mechanics: array<u32>;
@group(0) @binding(6) var<storage, read_write> xt_receipt: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> xt_params: ExactPlacementTerminalParams;
fn xt_restore_physical(particle: u32) {
  let state_stride = xt_params.words[0].w * 4u;
  let thermo_stride = xt_params.words[1].x * 4u;
  let mechanics_stride = xt_params.words[1].y * 4u;
  for (var i = 0u; i < state_stride; i++) { xt_state[particle * state_stride + i] = xt_rollback_state[particle * state_stride + i]; }
  for (var i = 0u; i < thermo_stride; i++) { xt_thermo[particle * thermo_stride + i] = xt_rollback_thermo[particle * thermo_stride + i]; }
  for (var i = 0u; i < mechanics_stride; i++) { xt_mechanics[particle * mechanics_stride + i] = xt_rollback_mechanics[particle * mechanics_stride + i]; }
}
@compute @workgroup_size(64)
fn publish_or_restore_placement_destination(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x == 0u) { atomicStore(&xt_receipt[${R.transactionalPublishPassCount}u], 1u); }
  if (id.x >= xt_params.words[0].x) { return; }
  if (atomicLoad(&xt_receipt[${R.status}u]) == ${STATUS.COMPLETE}u) {
    atomicAdd(&xt_receipt[${R.transactionalCommittedParticleCount}u], 1u);
  } else {
    xt_restore_physical(id.x);
    atomicAdd(&xt_receipt[${R.transactionalFallbackParticleCount}u], 1u);
  }
  atomicAdd(&xt_receipt[${R.transactionalVisitedParticleCount}u], 1u);
}
@compute @workgroup_size(64)
fn recover_unsafe_placement_destination(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= xt_params.words[0].x) { return; }
  if (atomicLoad(&xt_receipt[${R.transactionalTerminalStatus}u]) != ${TERMINAL.SAFE_PLACED}u) { xt_restore_physical(id.x); }
}
`;
}

/** Post-terminal exact current/residual selection in the original family's
 * independently owned destination arena. Original rows remain borrowed from
 * the real predecessor; current/residual candidates have already been written
 * under this transaction. A rejected or late-UNSAFE transaction restores the
 * complete original current records and clears only this step's residuals.
 * Prior history is deliberately not bound to this kernel.
 *
 * Host integration must include this exact dispatch, source/destination
 * identities, sufficient extents, and the original terminal gate in its
 * private one-shot encoding record before family transfer is possible.
 */
export function createSphExactPlacementQuantityTerminalWgsl(format, frozenSourceQuantityLayout) {
  validateSphExactMassFormat(format);
  const layout = frozenSourceQuantityLayout;
  const scalar = sphExactRationalQuantityLayout({ wordCount: layout?.scalar?.wordCount });
  const p = layout?.particleCount, e = layout?.eventCapacity, stride = layout?.recordWords;
  if (![p,e].every(x => Number.isSafeInteger(x) && x > 0 && x <= 0x3fffffff)
      || layout.massWordCount !== format.wordCount || layout.massOffsetWords !== 16
      || layout.scalarOffsetWords !== 16 + format.wordCount || layout.scalar.recordWords !== scalar.recordWords
      || stride !== 16 + format.wordCount + 7 * scalar.recordWords
      || layout.originalRowOffset !== 0 || layout.currentRowOffset !== p || layout.eventRowOffset !== 2*p
      || layout.rowCount !== 2*p+e || layout.wordLength !== layout.rowCount*stride
      || !Number.isSafeInteger(layout.wordLength) || layout.wordLength > 0x3fffffff) {
    throw new TypeError('Exact terminal requires complete original/current/residual source layout');
  }
  return PARAMS + /* wgsl */ `
@group(0) @binding(0) var<storage, read> xt_original_quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> xt_destination_quantities: array<u32>;
@group(0) @binding(2) var<storage, read_write> xt_destination_count: array<u32>;
@group(0) @binding(3) var<storage, read> xt_receipt: array<u32>;
@group(0) @binding(4) var<uniform> xt_params: ExactPlacementTerminalParams;
@compute @workgroup_size(64)
fn materialize_terminal_exact_placement_quantities(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  if (row >= ${p + e}u) { return; }
  if (xt_receipt[${R.transactionalTerminalStatus}u] == ${TERMINAL.SAFE_PLACED}u) { return; }
  let at = row * ${stride}u;
  if (row < ${p}u) {
    for (var i = 0u; i < ${stride}u; i++) { xt_destination_quantities[at + i] = xt_original_quantities[at + i]; }
  } else {
    for (var i = 0u; i < ${stride}u; i++) { xt_destination_quantities[at + i] = 0u; }
  }
  if (row == 0u) { xt_destination_count[0u] = 0u; xt_destination_count[1u] = 0u; }
}
`;
}

/** Contiguous numeric inventory comes only from the selected terminal rows.
 * Current carriers precede the residual capacity; the original selector has
 * already restored originals/cleared residuals on every non-placed outcome.
 * All limbs copy verbatim. No f32 mass or historical selected/direct mass is
 * a source, and the complete extensive quantity records remain intact.
 */
export function createSphExactPlacementMassTerminalWgsl(format, sourceLayout) {
  createSphExactPlacementQuantityTerminalWgsl(format, sourceLayout); // Same checked source layout.
  const rows = sourceLayout.particleCount + sourceLayout.eventCapacity;
  return /* wgsl */ `
@group(0) @binding(0) var<storage, read> xt_terminal_quantities: array<u32>;
@group(0) @binding(1) var<storage, read_write> xt_terminal_mass: array<u32>;
@compute @workgroup_size(64)
fn materialize_terminal_exact_placement_mass(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${rows}u) { return; }
  for (var word = 0u; word < ${format.wordCount}u; word++) {
    xt_terminal_mass[id.x * ${format.wordCount}u + word] =
      xt_terminal_quantities[id.x * ${sourceLayout.recordWords}u + 16u + word];
  }
}
`;
}

/** Exact event/summary variant of the existing post-terminal materializer.
 * Event count uses the original vec4 units; the data copy uses u32 words.
 * Rejection clears current-step events and preserves the prior accumulator.
 */
export function createSphExactPlacementLedgerTerminalWgsl() {
  return PARAMS + /* wgsl */ `
@group(0) @binding(0) var<storage, read> xt_candidate_events: array<u32>;
@group(0) @binding(1) var<storage, read_write> xt_published_events: array<u32>;
@group(0) @binding(2) var<storage, read> xt_candidate_summary: array<u32>;
@group(0) @binding(3) var<storage, read_write> xt_published_summary: array<u32>;
@group(0) @binding(4) var<storage, read> xt_receipt: array<u32>;
@group(0) @binding(5) var<uniform> xt_params: ExactPlacementTerminalParams;
@compute @workgroup_size(64)
fn materialize_safe_placement_ledgers(@builtin(global_invocation_id) id: vec3<u32>) {
  let row = id.x;
  let safe_placed = xt_receipt[${R.transactionalTerminalStatus}u] == ${TERMINAL.SAFE_PLACED}u;
  if (row < xt_params.words[0].y * xt_params.words[0].z) {
    for (var lane = 0u; lane < 4u; lane++) {
      let at = row * 4u + lane;
      if (safe_placed) { xt_published_events[at] = xt_candidate_events[at]; }
      else { xt_published_events[at] = 0u; }
    }
  }
  if (row < xt_params.words[1].w * 8u && safe_placed) {
    for (var lane = 0u; lane < 4u; lane++) {
      let at = row * 4u + lane; xt_published_summary[at] = xt_candidate_summary[at];
    }
  }
}

`;
}

/** Keep the original producer's complete physical template in the same
 * compact order as the terminal residual quantities. The event disposition
 * stage authenticated each live template before the original terminal vote.
 * Rejected transactions and inactive capacity produce entirely zero rows.
 * These are numerical views: retained quantities remain the extensive state.
 */
export function createSphExactPlacementResidualPhysicalTerminalWgsl(layout) {
  const { eventCapacity: e, companionWords: c, output } = layout;
  if (!Number.isSafeInteger(e) || e < 1 || output?.denseEventCount !== e
      || output.eventParticleStrideWords !== 64 || output.packedParticleWords !== 52) {
    throw new TypeError('Residual physical storage requires the original product template layout');
  }
  return /* wgsl */ `
@group(0) @binding(0) var<storage,read> rp_templates:array<u32>;
@group(0) @binding(1) var<storage,read> rp_companions:array<u32>;
@group(0) @binding(2) var<storage,read> rp_events:array<u32>;
@group(0) @binding(3) var<storage,read> rp_count:array<u32>;
@group(0) @binding(4) var<storage,read> rp_receipt:array<u32>;
@group(0) @binding(5) var<storage,read_write> rp_physical:array<u32>;
@compute @workgroup_size(64)
fn materialize_terminal_residual_physical(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${e}u){return;}
  let dest=row*52u;
  for(var i=0u;i<52u;i++){rp_physical[dest+i]=0u;}
  if(rp_receipt[${R.transactionalTerminalStatus}u]!=${TERMINAL.SAFE_PLACED}u
     ||rp_count[1u]!=0u||rp_count[0u]>${e}u||row>=rp_count[0u]){return;}
  let pair=rp_companions[row*${c}u];let ordinal=rp_companions[row*${c}u+2u];
  let source=${output.eventParticleOffsetWords}u+(pair*${output.productCapacity}u+ordinal-2u)*64u+12u;
  for(var i=0u;i<52u;i++){rp_physical[dest+i]=rp_templates[source+i];}
  for(var axis=0u;axis<3u;axis++){rp_physical[dest+axis]=rp_events[row*32u+axis];}
}
`;
}
