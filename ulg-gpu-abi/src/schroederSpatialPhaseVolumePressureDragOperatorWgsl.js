/**
 * Shared, write-free gas/condensed pressure and drag evaluator.
 *
 * Adapters own topology authentication, staging, and publication. Keeping the
 * constitutive calculation here prevents same-level and cross-level transport
 * from drifting into different laws.
 */
export const schroederSpatialPhaseVolumePressureDragOperatorWgsl = /* wgsl */ `
struct SchroederPhaseVolumePressureDragResult {
  condensed_velocity: vec3<f32>,
  gas_velocity: vec3<f32>,
  pressure_impulse: vec3<f32>,
  drag_impulse: vec3<f32>,
  pressure_internal_compensation_j: f32,
  drag_heat_j: f32,
  interface_area_m2: f32,
  valid: u32,
};

fn schroeder_phase_volume_finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn schroeder_phase_volume_finite_vec3(value: vec3<f32>) -> bool {
  return schroeder_phase_volume_finite_f32(value.x)
    && schroeder_phase_volume_finite_f32(value.y)
    && schroeder_phase_volume_finite_f32(value.z);
}

fn schroeder_phase_volume_invalid_pair(
  condensed_velocity: vec3<f32>,
  gas_velocity: vec3<f32>
) -> SchroederPhaseVolumePressureDragResult {
  return SchroederPhaseVolumePressureDragResult(
    condensed_velocity,
    gas_velocity,
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0.0,
    0u
  );
}

fn schroeder_phase_volume_pressure_drag_pair(
  condensed_mass: f32,
  gas_mass: f32,
  condensed_response_inverse_mass: f32,
  gas_response_inverse_mass: f32,
  condensed_volume: f32,
  gas_volume: f32,
  condensed_gradient: vec3<f32>,
  gas_gradient: vec3<f32>,
  initial_condensed_velocity: vec3<f32>,
  initial_gas_velocity: vec3<f32>,
  condensed_sound_speed: f32,
  gas_sound_speed: f32,
  condensed_dynamic_viscosity: f32,
  gas_dynamic_viscosity: f32,
  condensed_absolute_pressure_pa: f32,
  gas_absolute_pressure_pa: f32,
  pressure_scale: f32,
  drag_scale: f32,
  max_impulse_fraction: f32,
  grid_spacing_m: f32,
  dt: f32,
  cfl_factor: f32
) -> SchroederPhaseVolumePressureDragResult {
  var invalid = schroeder_phase_volume_invalid_pair(
    initial_condensed_velocity,
    initial_gas_velocity
  );
  let pair_mass = condensed_mass + gas_mass;
  let pair_volume = condensed_volume + gas_volume;
  let response_inverse_mass =
    condensed_response_inverse_mass + gas_response_inverse_mass;
  if (!(condensed_mass > 0.0)
      || !(gas_mass > 0.0)
      || !(condensed_volume > 0.0)
      || !(gas_volume > 0.0)
      || !(pair_mass > 0.0)
      || !(pair_volume > 0.0)
      || !(condensed_response_inverse_mass > 0.0)
      || !(gas_response_inverse_mass > 0.0)
      || !(response_inverse_mass > 0.0)
      || !(grid_spacing_m > 0.0)
      || !(dt > 0.0)
      || !schroeder_phase_volume_finite_f32(condensed_mass)
      || !schroeder_phase_volume_finite_f32(gas_mass)
      || !schroeder_phase_volume_finite_f32(condensed_volume)
      || !schroeder_phase_volume_finite_f32(gas_volume)
      || !schroeder_phase_volume_finite_f32(
        condensed_response_inverse_mass
      )
      || !schroeder_phase_volume_finite_f32(gas_response_inverse_mass)
      || !schroeder_phase_volume_finite_f32(response_inverse_mass)
      || !schroeder_phase_volume_finite_vec3(condensed_gradient)
      || !schroeder_phase_volume_finite_vec3(gas_gradient)
      || !schroeder_phase_volume_finite_vec3(initial_condensed_velocity)
      || !schroeder_phase_volume_finite_vec3(initial_gas_velocity)
      || !schroeder_phase_volume_finite_f32(condensed_sound_speed)
      || !schroeder_phase_volume_finite_f32(gas_sound_speed)
      || !schroeder_phase_volume_finite_f32(condensed_dynamic_viscosity)
      || !schroeder_phase_volume_finite_f32(gas_dynamic_viscosity)
      || !(condensed_absolute_pressure_pa >= 0.0)
      || !(gas_absolute_pressure_pa >= 0.0)
      || !schroeder_phase_volume_finite_f32(
        condensed_absolute_pressure_pa
      )
      || !schroeder_phase_volume_finite_f32(gas_absolute_pressure_pa)
      || !schroeder_phase_volume_finite_f32(pressure_scale)
      || !schroeder_phase_volume_finite_f32(drag_scale)
      || !schroeder_phase_volume_finite_f32(max_impulse_fraction)
      || !schroeder_phase_volume_finite_f32(grid_spacing_m)
      || !schroeder_phase_volume_finite_f32(dt)
      || !schroeder_phase_volume_finite_f32(cfl_factor)) {
    return invalid;
  }

  let reduced_mass = 1.0 / response_inverse_mass;
  if (!(reduced_mass > 0.0)
      || !schroeder_phase_volume_finite_f32(reduced_mass)) {
    return invalid;
  }

  // The antisymmetric volume-gradient form is invariant to swapping the two
  // virtual bodies. Cap its magnitude by the smaller admitted volume over the
  // support length so malformed gradients cannot manufacture interface area.
  var area_vector = (
    gas_volume * condensed_gradient
      - condensed_volume * gas_gradient
  ) / pair_volume;
  let area_limit = min(condensed_volume, gas_volume) / grid_spacing_m;
  let raw_area = length(area_vector);
  if (!schroeder_phase_volume_finite_vec3(area_vector)
      || !schroeder_phase_volume_finite_f32(area_limit)
      || !schroeder_phase_volume_finite_f32(raw_area)) {
    return invalid;
  }
  if (raw_area > area_limit && raw_area > 0.0) {
    area_vector = area_vector * (area_limit / raw_area);
  }
  let interface_area = length(area_vector);

  // Pressure is resolved once by the exact P2G constitutive path and carried
  // by the canonical field row. Local and cross-level adapters must never
  // reconstruct it from density or silently substitute ambient pressure.
  let pressure_difference_pa = max(pressure_scale, 0.0)
    * (
      gas_absolute_pressure_pa
        - condensed_absolute_pressure_pa
    );
  var pressure_impulse = pressure_difference_pa * area_vector * dt;
  let acoustic_speed = max(
    1.0e-6,
    gas_sound_speed + condensed_sound_speed
  );
  let cfl_speed = max(
    1.0e-6,
    max(cfl_factor, 0.0) * grid_spacing_m / max(dt, 1.0e-12)
  );
  let pressure_impulse_limit = max(0.0, max_impulse_fraction)
    * reduced_mass
    * min(acoustic_speed, cfl_speed);
  let pressure_impulse_length = length(pressure_impulse);
  if (!schroeder_phase_volume_finite_f32(pressure_difference_pa)
      || !schroeder_phase_volume_finite_vec3(pressure_impulse)
      || !schroeder_phase_volume_finite_f32(pressure_impulse_limit)
      || !schroeder_phase_volume_finite_f32(pressure_impulse_length)) {
    return invalid;
  }
  if (pressure_impulse_length > pressure_impulse_limit
      && pressure_impulse_length > 0.0) {
    pressure_impulse = pressure_impulse
      * (pressure_impulse_limit / pressure_impulse_length);
  }

  var condensed_velocity =
    initial_condensed_velocity
      + pressure_impulse * condensed_response_inverse_mass;
  var gas_velocity =
    initial_gas_velocity - pressure_impulse * gas_response_inverse_mass;
  let pressure_kinetic_delta =
    dot(pressure_impulse, initial_condensed_velocity - initial_gas_velocity)
    + 0.5 * dot(pressure_impulse, pressure_impulse)
      * response_inverse_mass;
  let pressure_internal_compensation =
    -pressure_kinetic_delta;

  // Backward-Euler decay for relative velocity: alpha=x/(1+x). Unlike an
  // explicit clamp, this remains dissipative and asymptotically stable for
  // arbitrarily stiff admitted viscosities.
  let viscous_rate = max(drag_scale, 0.0)
    * (
      max(condensed_dynamic_viscosity, 0.0)
        + max(gas_dynamic_viscosity, 0.0)
    )
    * interface_area
    / grid_spacing_m;
  let drag_x = viscous_rate * dt / reduced_mass;
  let drag_alpha = select(
    0.0,
    drag_x / (1.0 + drag_x),
    drag_x > 0.0
  );
  let pre_drag_condensed_velocity = condensed_velocity;
  let pre_drag_gas_velocity = gas_velocity;
  let drag_impulse = reduced_mass
    * drag_alpha
    * (gas_velocity - condensed_velocity);
  condensed_velocity =
    condensed_velocity + drag_impulse * condensed_response_inverse_mass;
  gas_velocity =
    gas_velocity - drag_impulse * gas_response_inverse_mass;
  let drag_kinetic_delta =
    dot(
      drag_impulse,
      pre_drag_condensed_velocity - pre_drag_gas_velocity
    )
    + 0.5 * dot(drag_impulse, drag_impulse) * response_inverse_mass;
  let drag_heat = max(0.0, -drag_kinetic_delta);

  if (!schroeder_phase_volume_finite_vec3(condensed_velocity)
      || !schroeder_phase_volume_finite_vec3(gas_velocity)
      || !schroeder_phase_volume_finite_vec3(pressure_impulse)
      || !schroeder_phase_volume_finite_vec3(drag_impulse)
      || !schroeder_phase_volume_finite_f32(pressure_internal_compensation)
      || !schroeder_phase_volume_finite_f32(pressure_kinetic_delta)
      || !schroeder_phase_volume_finite_f32(drag_heat)
      || !schroeder_phase_volume_finite_f32(drag_kinetic_delta)
      || !schroeder_phase_volume_finite_f32(interface_area)
      || !schroeder_phase_volume_finite_f32(viscous_rate)
      || !schroeder_phase_volume_finite_f32(drag_x)
      || !schroeder_phase_volume_finite_f32(drag_alpha)) {
    return invalid;
  }

  return SchroederPhaseVolumePressureDragResult(
    condensed_velocity,
    gas_velocity,
    pressure_impulse,
    drag_impulse,
    pressure_internal_compensation,
    drag_heat,
    interface_area,
    1u
  );
}
`;
