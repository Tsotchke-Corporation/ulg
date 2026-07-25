/**
 * Pressure-adjusted carrier transform, shared by every GPU thermal consumer.
 *
 * This is the device-side twin of
 * `src/runtime/material/pressureCarrierTransform.js`. Both must agree, so the
 * branch structure here is deliberately identical to the host implementation
 * rather than algebraically rearranged: the reference-pressure case is decided
 * on f32 bit equality before any arithmetic so it stays bitwise identical to
 * doing nothing, and every malformed input fails closed with valid = 0 instead
 * of falling back to one atmosphere.
 */
export const pressureCarrierTransformWgsl = /* wgsl */ `
const ULG_PRESSURE_CARRIER_LAW_REFERENCE_ONLY: u32 = 0u;
const ULG_PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU: u32 = 1u;
const ULG_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K: f32 = 8.314462618;

struct UlgPressurePlateau {
  shifted_temperature_k: f32,
  shifted_plateau_start_j_per_kg: f32,
  shifted_plateau_end_j_per_kg: f32,
  anchor_energy_j_per_kg: f32,
  plateau_start_j_per_kg: f32,
  plateau_end_j_per_kg: f32,
  law_id: u32,
  identity: u32,
  valid: u32,
};

fn ulg_pressure_carrier_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn ulg_pressure_carrier_finite_positive(value: f32) -> bool {
  return ulg_pressure_carrier_finite(value) && value > 0.0;
}

// Decided on the bit patterns, before any arithmetic, so a run at the
// reference pressure cannot drift by a rounding step.
fn ulg_is_reference_pressure(
  absolute_pressure_pa: f32, reference_pressure_pa: f32
) -> bool {
  return bitcast<u32>(absolute_pressure_pa)
    == bitcast<u32>(reference_pressure_pa);
}

fn ulg_pressure_plateau_invalid() -> UlgPressurePlateau {
  return UlgPressurePlateau(
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    ULG_PRESSURE_CARRIER_LAW_REFERENCE_ONLY, 0u, 0u
  );
}

// Slope form: beta = R / (L * M) is precomputed on the host and packed into the
// thermal material record, so a device consumer does not have to carry latent
// heat and molar mass to reach the same plateau.
fn ulg_resolve_pressure_plateau_with_slope(
  anchor_energy_j_per_kg: f32,
  anchor_temperature_k: f32,
  plateau_start_j_per_kg: f32,
  plateau_end_j_per_kg: f32,
  reference_temperature_k: f32,
  absolute_pressure_pa: f32,
  reference_pressure_pa: f32,
  inv_temperature_log_slope_per_k: f32
) -> UlgPressurePlateau {
  let ea = anchor_energy_j_per_kg;
  let e0 = plateau_start_j_per_kg;
  let e1 = plateau_end_j_per_kg;
  if (!ulg_pressure_carrier_finite(ea)
      || !ulg_pressure_carrier_finite(e0)
      || !ulg_pressure_carrier_finite(e1)
      || !ulg_pressure_carrier_finite_positive(anchor_temperature_k)
      || !ulg_pressure_carrier_finite_positive(reference_temperature_k)
      || !ulg_pressure_carrier_finite_positive(absolute_pressure_pa)
      || !ulg_pressure_carrier_finite_positive(reference_pressure_pa)
      || !ulg_pressure_carrier_finite_positive(inv_temperature_log_slope_per_k)
      || !(e0 > ea)
      || !(e1 >= e0)
      || !(reference_temperature_k > anchor_temperature_k)) {
    return ulg_pressure_plateau_invalid();
  }

  if (ulg_is_reference_pressure(absolute_pressure_pa, reference_pressure_pa)) {
    return UlgPressurePlateau(
      reference_temperature_k, e0, e1, ea, e0, e1,
      ULG_PRESSURE_CARRIER_LAW_REFERENCE_ONLY, 1u, 1u
    );
  }

  let inv_t = 1.0 / reference_temperature_k
    - inv_temperature_log_slope_per_k
      * log(absolute_pressure_pa / reference_pressure_pa);
  if (!ulg_pressure_carrier_finite_positive(inv_t)) {
    return ulg_pressure_plateau_invalid();
  }
  let shifted_temperature_k = 1.0 / inv_t;
  if (!ulg_pressure_carrier_finite_positive(shifted_temperature_k)) {
    return ulg_pressure_plateau_invalid();
  }

  let mean_heat_capacity =
    (e0 - ea) / (reference_temperature_k - anchor_temperature_k);
  let e0s = ea + mean_heat_capacity * (shifted_temperature_k - anchor_temperature_k);
  let e1s = e0s + (e1 - e0);
  if (!ulg_pressure_carrier_finite(e0s)
      || !ulg_pressure_carrier_finite(e1s)
      || !(e0s > ea)) {
    return ulg_pressure_plateau_invalid();
  }

  return UlgPressurePlateau(
    shifted_temperature_k, e0s, e1s, ea, e0, e1,
    ULG_PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU, 0u, 1u
  );
}

// Latent-heat form, for consumers that carry L and M rather than the packed
// slope. Identical result; the slope is just derived here instead of on the
// host.
fn ulg_resolve_pressure_plateau(
  anchor_energy_j_per_kg: f32,
  anchor_temperature_k: f32,
  plateau_start_j_per_kg: f32,
  plateau_end_j_per_kg: f32,
  reference_temperature_k: f32,
  absolute_pressure_pa: f32,
  reference_pressure_pa: f32,
  latent_heat_j_per_kg: f32,
  molar_mass_kg_per_mol: f32
) -> UlgPressurePlateau {
  if (!ulg_pressure_carrier_finite_positive(latent_heat_j_per_kg)
      || !ulg_pressure_carrier_finite_positive(molar_mass_kg_per_mol)) {
    return ulg_pressure_plateau_invalid();
  }
  let l_molar = latent_heat_j_per_kg * molar_mass_kg_per_mol;
  if (!ulg_pressure_carrier_finite_positive(l_molar)) {
    return ulg_pressure_plateau_invalid();
  }
  return ulg_resolve_pressure_plateau_with_slope(
    anchor_energy_j_per_kg,
    anchor_temperature_k,
    plateau_start_j_per_kg,
    plateau_end_j_per_kg,
    reference_temperature_k,
    absolute_pressure_pa,
    reference_pressure_pa,
    ULG_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K / l_molar
  );
}

fn ulg_carrier_from_physical_energy(
  plateau: UlgPressurePlateau, physical_energy_j_per_kg: f32
) -> f32 {
  if (plateau.valid == 0u || !ulg_pressure_carrier_finite(physical_energy_j_per_kg)) {
    return physical_energy_j_per_kg;
  }
  if (plateau.identity == 1u) { return physical_energy_j_per_kg; }
  let u = physical_energy_j_per_kg;
  let ea = plateau.anchor_energy_j_per_kg;
  let e0 = plateau.plateau_start_j_per_kg;
  let e0s = plateau.shifted_plateau_start_j_per_kg;
  let e1s = plateau.shifted_plateau_end_j_per_kg;
  if (u <= ea) { return u; }
  if (u < e0s) { return ea + ((u - ea) * (e0 - ea)) / (e0s - ea); }
  if (u <= e1s) { return e0 + (u - e0s); }
  return u - (e0s - e0);
}

fn ulg_physical_energy_from_carrier(
  plateau: UlgPressurePlateau, carrier_j_per_kg: f32
) -> f32 {
  if (plateau.valid == 0u || !ulg_pressure_carrier_finite(carrier_j_per_kg)) {
    return carrier_j_per_kg;
  }
  if (plateau.identity == 1u) { return carrier_j_per_kg; }
  let c = carrier_j_per_kg;
  let ea = plateau.anchor_energy_j_per_kg;
  let e0 = plateau.plateau_start_j_per_kg;
  let e1 = plateau.plateau_end_j_per_kg;
  let e0s = plateau.shifted_plateau_start_j_per_kg;
  if (c <= ea) { return c; }
  if (c < e0) { return ea + ((c - ea) * (e0s - ea)) / (e0 - ea); }
  if (c <= e1) { return e0s + (c - e0); }
  return c + (e0s - e0);
}
`;
