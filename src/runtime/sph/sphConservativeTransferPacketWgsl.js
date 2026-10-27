// A numerical flux choice, separate from exact inventory accounting. Only a
// computed momentum/energy packet is rounded; its identical debit and credit
// are then accumulated exactly. Mass and the retained donor are never rounded.
export function validateSphTransportPacketMode(mode = 'exact-rational') {
  if (!['exact-rational', 'rounded-dyadic-53'].includes(mode)) {
    throw new TypeError('Unknown conservative transport packet mode');
  }
  return mode;
}

// Append to createSphExactRationalQuantityWgsl. Nearest-even, 53 significant
// bits, with a separate checked i32 exponent (not the binary64 exponent range).
// For a nonzero successful result the error is <= half its rounding quantum,
// hence relative error <= 2^-53. No nonzero packet silently underflows to zero.
export function createSphConservativeTransferPacketWgsl() {
  return /* wgsl */ `
fn xrp_round_transfer53(out: ptr<function, ExactRational>, source: ptr<function, ExactRational>) {
  var value: ExactRational; xrp_normalize(&value, source);
  if (value.error != 0u) { xrp_failure(out, value.error); return; }
  var numerator: ExactRationalWide; var denominator: ExactRationalWide;
  xrp_numerator(&numerator, &value); xrp_denominator(&denominator, &value);
  let top = xrp_top(&numerator);
  if (top < 0) { xrp_rational_zero(out); return; }
  var order = top - xrp_top(&denominator);
  var compared: ExactRationalWide;
  var comparison = 0;
  if (order >= 0) {
    xrp_copy(&compared, &denominator); xrp_shift_left(&compared, u32(order));
    comparison = xrp_compare(&numerator, &compared);
  } else {
    xrp_copy(&compared, &numerator); xrp_shift_left(&compared, u32(-order));
    comparison = xrp_compare(&compared, &denominator);
  }
  if (comparison < 0) { order--; }
  let shift = order - 52;
  if (shift >= 0) { xrp_shift_left(&denominator, u32(shift)); }
  else { xrp_shift_left(&numerator, u32(-shift)); }
  var aligned: ExactRationalWide;
  xrp_copy(&aligned, &denominator); xrp_shift_left(&aligned, 52u);
  let error = compared.error | numerator.error | denominator.error | aligned.error;
  if (error != 0u) { xrp_failure(out, error); return; }
  var coefficient: ExactRationalWide;
  for (var bit = 52; bit >= 0; bit--) {
    if (xrp_compare(&numerator, &aligned) >= 0) {
      xrp_subtract(&numerator, &aligned);
      coefficient.words[u32(bit) / 32u] |= 1u << (u32(bit) % 32u);
    }
    xrp_shift_right(&aligned, 1u);
  }
  var distance: ExactRationalWide;
  xrp_copy(&distance, &denominator); xrp_subtract(&distance, &numerator);
  if ((numerator.error | distance.error) != 0u) {
    xrp_failure(out, numerator.error | distance.error); return;
  }
  let halfway = xrp_compare(&numerator, &distance);
  if (halfway > 0 || (halfway == 0 && (coefficient.words[0] & 1u) != 0u)) {
    coefficient.words[0]++;
    if (coefficient.words[0] == 0u) { coefficient.words[1]++; }
  }
  // Normalize before checking the exponent, so exact powers of two at either
  // i32 boundary do not fail because of a temporary 53-bit representation.
  let trailing = xrp_trailing(&coefficient);
  xrp_shift_right(&coefficient, trailing);
  let exponent = xr_exponent_add(value.exponent, shift + i32(trailing));
  if (exponent.error != 0u) { xrp_failure(out, exponent.error); return; }
  var one: ExactRationalWide; one.words[0] = 1u;
  xrp_finish(out, &coefficient, &one, value.negative, exponent.value);
}
`;
}
