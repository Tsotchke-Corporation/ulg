import { validateSphExactMassFormat, SPH_EXACT_MASS_ERROR as MASS_ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';

export const SPH_EXACT_REACTION_ALLOCATION_ERROR = Object.freeze({
  INVALID_WEIGHT: 16384, INVALID_SELECTION: 32768
});

// Numeric selection only. The actual reaction producer still owns chemistry,
// energy, placement, rollback and publication. No bindings or entry points are
// declared here, so a genuine producer can consume these same chosen amounts.
export function createSphExactReactionAllocationWgsl(format, { includeMassLibrary = true } = {}) {
  validateSphExactMassFormat(format);
  const E = SPH_EXACT_REACTION_ALLOCATION_ERROR;
  return (includeMassLibrary ? createSphExactMassWgsl(format) : '') + /* wgsl */ `
struct ExactReactionDebits {
  total: ExactMass, debit_a: ExactMass, debit_b: ExactMass,
  remainder_a: ExactMass, remainder_b: ExactMass, error: u32, executed: u32
}
struct ExactReactionProduct {
  mass: ExactMass, from_a: ExactMass, from_b: ExactMass, error: u32
}
fn er_min(a: ExactMass, b: ExactMass) -> ExactMass {
  if (em_compare(a, b) <= 0) { return a; }
  return b;
}
fn er_half(a: ExactMass) -> ExactMass {
  var value: ExactMass;
  var carry = 0u;
  for (var i = i32(EM_WORDS) - 1; i >= 0; i--) {
    let word = a.words[u32(i)];
    value.words[u32(i)] = (word >> 1u) | carry;
    carry = (word & 1u) << 31u;
  }
  return value;
}
fn er_inactive(a: ExactMass, b: ExactMass, error: u32) -> ExactReactionDebits {
  return ExactReactionDebits(ExactMass(), ExactMass(), ExactMass(), a, b, error, 0u);
}
fn er_select_debits(available_a: ExactMass, available_b: ExactMass,
  kinetic_cap: ExactMass, weight_a: ExactMass, weight_b: ExactMass) -> ExactReactionDebits {
  // The numeric candidate has N-word rows. An aggregate outside that domain
  // rejects even when a smaller kinetic cap would fit; it must never wrap.
  let available = em_add(available_a, available_b);
  let denominator = em_add(weight_a, weight_b);
  var error = available.error | denominator.error;
  if (em_zero(weight_a) || em_zero(weight_b)) { error |= ${E.INVALID_WEIGHT}u; }
  if (error != 0u) { return er_inactive(available_a, available_b, error); }
  let cap = er_min(kinetic_cap, available.value);
  let highest = em_top(cap);
  if (highest < 0) { return er_inactive(available_a, available_b, 0u); }
  // A feasible cap is already the greatest allowed total. Most kinetic-law
  // packets are smaller than both donor inventories, so one exact ratio can
  // avoid the bitwise availability search without changing the selected bits.
  let capped_a = em_multiply_ratio(cap, weight_a, denominator.value);
  let capped_b = em_subtract(cap, capped_a.value);
  error = capped_a.error | capped_b.error;
  if (error != 0u) { return er_inactive(available_a, available_b, error); }
  if (em_compare(capped_a.value, available_a) <= 0
      && em_compare(capped_b.value, available_b) <= 0) {
    if (em_zero(capped_a.value) || em_zero(capped_b.value)) {
      return er_inactive(available_a, available_b, 0u);
    }
    let remaining_a = em_subtract(available_a, capped_a.value);
    let remaining_b = em_subtract(available_b, capped_b.value);
    error = remaining_a.error | remaining_b.error;
    if (error != 0u) { return er_inactive(available_a, available_b, error); }
    return ExactReactionDebits(cap, capped_a.value, capped_b.value,
      remaining_a.value, remaining_b.value, 0u, 1u);
  }
  var power: ExactMass;
  power.words[u32(highest) / 32u] = 1u << (u32(highest) % 32u);
  let initial = em_multiply_ratio(power, weight_a, denominator.value);
  if (initial.error != 0u) { return er_inactive(available_a, available_b, initial.error); }
  var power_debit = initial.value;
  var power_remainder = initial.remainder;
  var total: ExactMass;
  var debit_a: ExactMass;
  var remainder: ExactMass;
  var one: ExactMass; one.words[0] = 1u;
  // Build the maximal feasible total from its high bit down. Both donor debits
  // are monotone, so a rejected bit cannot be recovered by any smaller suffix.
  // Carry the exact quotient/remainder for each power instead of dividing anew
  // inside every search iteration. The fallback adds one full ratio evaluation
  // after the cap feasibility check; each greedy iteration remains division-free.
  for (var bit = highest; bit >= 0; bit--) {
    let candidate = em_add(total, power);
    if (candidate.error != 0u) {
      return er_inactive(available_a, available_b, candidate.error);
    }
    if (em_compare(candidate.value, cap) <= 0) {
      let complement = em_subtract(denominator.value, power_remainder).value;
      let carry = em_compare(remainder, complement) >= 0;
      var next_remainder: ExactMass;
      if (carry) { next_remainder = em_subtract(remainder, complement).value; }
      else { next_remainder = em_add(remainder, power_remainder).value; }
      var next_debit = em_add(debit_a, power_debit);
      if (carry && next_debit.error == 0u) { next_debit = em_add(next_debit.value, one); }
      let other_debit = em_subtract(candidate.value, next_debit.value);
      error = next_debit.error | other_debit.error;
      if (error != 0u) { return er_inactive(available_a, available_b, error); }
      if (em_compare(next_debit.value, available_a) <= 0 && em_compare(other_debit.value, available_b) <= 0) {
        total = candidate.value; debit_a = next_debit.value; remainder = next_remainder;
      }
    }
    if (bit > 0) {
      // If P*w=q*d+r then (P/2)*w=floor(q/2)*d+(r+(q%2)*d)/2.
      // Halve before adding to avoid an overflowing r+d intermediate. The
      // numerator is even because P is still an even power of two here.
      var next_remainder = er_half(power_remainder);
      if ((power_debit.words[0] & 1u) != 0u) {
        next_remainder = em_add(next_remainder, er_half(denominator.value)).value;
        if ((power_remainder.words[0] & denominator.value.words[0] & 1u) != 0u) {
          next_remainder = em_add(next_remainder, one).value;
        }
      }
      power = er_half(power); power_debit = er_half(power_debit); power_remainder = next_remainder;
    }
  }
  let debit_b = em_subtract(total, debit_a);
  error = debit_b.error;
  if (error != 0u) { return er_inactive(available_a, available_b, error); }
  // A positive total with one zero required reactant cannot represent an event.
  if (em_zero(debit_a) || em_zero(debit_b.value)) {
    return er_inactive(available_a, available_b, 0u);
  }
  let remainder_a = em_subtract(available_a, debit_a);
  let remainder_b = em_subtract(available_b, debit_b.value);
  error |= remainder_a.error | remainder_b.error;
  if (error != 0u) { return er_inactive(available_a, available_b, error); }
  return ExactReactionDebits(total, debit_a, debit_b.value,
    remainder_a.value, remainder_b.value, 0u, 1u);
}
fn er_product_share(selected: ExactReactionDebits, lower: ExactMass,
  upper: ExactMass, denominator: ExactMass) -> ExactReactionProduct {
  if (selected.error != 0u) {
    return ExactReactionProduct(ExactMass(), ExactMass(), ExactMass(), selected.error);
  }
  let debit_sum = em_add(selected.debit_a, selected.debit_b);
  if (debit_sum.error != 0u || em_compare(debit_sum.value, selected.total) != 0
      || selected.executed > 1u || (selected.executed == 0u && !em_zero(selected.total))
      || (selected.executed == 1u && (em_zero(selected.debit_a) || em_zero(selected.debit_b)))) {
    return ExactReactionProduct(ExactMass(), ExactMass(), ExactMass(), ${E.INVALID_SELECTION}u);
  }
  if (em_compare(lower, upper) > 0) {
    return ExactReactionProduct(ExactMass(), ExactMass(), ExactMass(), ${MASS_ERROR.INVALID_RATIO}u);
  }
  let start = em_multiply_ratio(selected.total, lower, denominator);
  let end = em_multiply_ratio(selected.total, upper, denominator);
  var error = start.error | end.error;
  if (error != 0u) { return ExactReactionProduct(ExactMass(), ExactMass(), ExactMass(), error); }
  let mass = em_subtract(end.value, start.value);
  // Donor A occupies [0, debit_a), B [debit_a, total). Intersection with
  // each product interval retains routing contributions without double spend.
  let from_a = em_subtract(er_min(end.value, selected.debit_a), er_min(start.value, selected.debit_a));
  let from_b = em_subtract(mass.value, from_a.value);
  error |= mass.error | from_a.error | from_b.error;
  if (error != 0u) { return ExactReactionProduct(ExactMass(), ExactMass(), ExactMass(), error); }
  return ExactReactionProduct(mass.value, from_a.value, from_b.value, 0u);
}
`;
}
