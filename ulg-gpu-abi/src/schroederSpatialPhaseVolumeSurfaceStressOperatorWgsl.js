/**
 * Shared, write-free continuum-surface-stress central-bond evaluator.
 *
 * The S9 phase-volume moment stores g = sum(V0 J grad(N)), with units m^2.
 * Dividing |g| by h^3 turns that color gradient into the regularized
 * interface delta (1/m). The resulting stress is
 *
 *   T = sigma |g| / h^3 (I - n n)
 *
 * A symmetric stress tensor is decomposed over three axial and six signed
 * face-diagonal bond families. Each reciprocal impulse is parallel to its
 * node separation, so every pair has exactly zero torque. Adapters own sparse
 * topology authentication, bond coloring, staging, and publication. A future
 * coarse/fine adapter may reuse this law only after it supplies uniquely
 * owned physical central bonds; affine parent interpolation edges are not
 * physical bonds.
 */
export const schroederSpatialPhaseVolumeSurfaceStressOperatorWgsl = /* wgsl */ `
struct SchroederPhaseVolumeSurfaceStressBondResult {
  bond_impulse_ns: vec3<f32>,
  valid: u32,
};

fn schroeder_phase_volume_surface_stress_finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn schroeder_phase_volume_surface_stress_finite_vec3(
  value: vec3<f32>
) -> bool {
  return schroeder_phase_volume_surface_stress_finite_f32(value.x)
    && schroeder_phase_volume_surface_stress_finite_f32(value.y)
    && schroeder_phase_volume_surface_stress_finite_f32(value.z);
}

fn schroeder_phase_volume_surface_stress_invalid_bond(
) -> SchroederPhaseVolumeSurfaceStressBondResult {
  return SchroederPhaseVolumeSurfaceStressBondResult(
    vec3<f32>(0.0),
    0u
  );
}

fn schroeder_phase_volume_surface_stress_component(
  surface_tension_n_per_m: f32,
  volume_gradient_m2: vec3<f32>,
  grid_spacing_m: f32,
  component_axis_a: u32,
  component_axis_b: u32
) -> f32 {
  if (!(surface_tension_n_per_m > 0.0)) { return 0.0; }
  let gradient_length_m2 = length(volume_gradient_m2);
  if (!(gradient_length_m2 > 0.0)) { return 0.0; }
  let normal = volume_gradient_m2 / gradient_length_m2;
  let stress_pa = surface_tension_n_per_m
    * gradient_length_m2
    / (grid_spacing_m * grid_spacing_m * grid_spacing_m);
  let identity_component = select(
    0.0,
    1.0,
    component_axis_a == component_axis_b
  );
  return stress_pa * (
    identity_component
      - normal[component_axis_a] * normal[component_axis_b]
  );
}

/**
 * Exact symmetric-stress decomposition over central lattice bonds.
 * Axial bonds carry T_aa. The two a/b face diagonals carry +T_ab and -T_ab,
 * so their dyads reconstruct both shear entries. Every reciprocal impulse is
 * collinear with its node separation and therefore has zero pair torque.
 */
fn schroeder_phase_volume_surface_stress_bond(
  left_mass_kg: f32,
  right_mass_kg: f32,
  left_response_inverse_mass: f32,
  right_response_inverse_mass: f32,
  left_volume_gradient_m2: vec3<f32>,
  right_volume_gradient_m2: vec3<f32>,
  left_surface_tension_n_per_m: f32,
  right_surface_tension_n_per_m: f32,
  left_to_right_bond: vec3<f32>,
  component_axis_a: u32,
  component_axis_b: u32,
  component_sign: f32,
  bond_length_cells: f32,
  max_impulse_fraction: f32,
  grid_spacing_m: f32,
  dt: f32,
  cfl_factor: f32
) -> SchroederPhaseVolumeSurfaceStressBondResult {
  let invalid = schroeder_phase_volume_surface_stress_invalid_bond();
  let response_inverse_mass =
    left_response_inverse_mass + right_response_inverse_mass;
  let bond_axis_length = length(left_to_right_bond);
  if (!(left_mass_kg > 0.0)
      || !(right_mass_kg > 0.0)
      || !(left_response_inverse_mass > 0.0)
      || !(right_response_inverse_mass > 0.0)
      || !(response_inverse_mass > 0.0)
      || !(grid_spacing_m > 0.0)
      || !(dt > 0.0)
      || !(bond_axis_length > 0.0)
      || !(bond_length_cells > 0.0)
      || component_axis_a >= 3u
      || component_axis_b >= 3u
      || !(left_surface_tension_n_per_m >= 0.0)
      || !(right_surface_tension_n_per_m >= 0.0)
      || !schroeder_phase_volume_surface_stress_finite_f32(left_mass_kg)
      || !schroeder_phase_volume_surface_stress_finite_f32(right_mass_kg)
      || !schroeder_phase_volume_surface_stress_finite_f32(
        left_response_inverse_mass
      )
      || !schroeder_phase_volume_surface_stress_finite_f32(
        right_response_inverse_mass
      )
      || !schroeder_phase_volume_surface_stress_finite_f32(
        response_inverse_mass
      )
      || !schroeder_phase_volume_surface_stress_finite_vec3(
        left_volume_gradient_m2
      )
      || !schroeder_phase_volume_surface_stress_finite_vec3(
        right_volume_gradient_m2
      )
      || !schroeder_phase_volume_surface_stress_finite_f32(
        left_surface_tension_n_per_m
      )
      || !schroeder_phase_volume_surface_stress_finite_f32(
        right_surface_tension_n_per_m
      )
      || !schroeder_phase_volume_surface_stress_finite_vec3(
        left_to_right_bond
      )
      || !schroeder_phase_volume_surface_stress_finite_f32(bond_axis_length)
      || !schroeder_phase_volume_surface_stress_finite_f32(component_sign)
      || !schroeder_phase_volume_surface_stress_finite_f32(bond_length_cells)
      || !schroeder_phase_volume_surface_stress_finite_f32(
        max_impulse_fraction
      )
      || !schroeder_phase_volume_surface_stress_finite_f32(grid_spacing_m)
      || !schroeder_phase_volume_surface_stress_finite_f32(dt)
      || !schroeder_phase_volume_surface_stress_finite_f32(cfl_factor)) {
    return invalid;
  }

  let bond_axis = left_to_right_bond / bond_axis_length;
  let left_component_pa = schroeder_phase_volume_surface_stress_component(
    left_surface_tension_n_per_m,
    left_volume_gradient_m2,
    grid_spacing_m,
    component_axis_a,
    component_axis_b
  );
  let right_component_pa = schroeder_phase_volume_surface_stress_component(
    right_surface_tension_n_per_m,
    right_volume_gradient_m2,
    grid_spacing_m,
    component_axis_a,
    component_axis_b
  );
  let bond_stress_pa = component_sign
    * 0.5
    * (left_component_pa + right_component_pa);
  var bond_impulse_ns = dt
    * grid_spacing_m
    * grid_spacing_m
    / bond_length_cells
    * bond_stress_pa
    * bond_axis;

  let reduced_mass = 1.0 / response_inverse_mass;
  let cfl_speed = max(
    1.0e-6,
    max(cfl_factor, 0.0) * grid_spacing_m / max(dt, 1.0e-12)
  );
  let impulse_limit = max(0.0, max_impulse_fraction)
    * reduced_mass
    * cfl_speed;
  let impulse_length = length(bond_impulse_ns);
  if (!schroeder_phase_volume_surface_stress_finite_f32(left_component_pa)
      || !schroeder_phase_volume_surface_stress_finite_f32(right_component_pa)
      || !schroeder_phase_volume_surface_stress_finite_f32(bond_stress_pa)
      || !schroeder_phase_volume_surface_stress_finite_vec3(bond_impulse_ns)
      || !schroeder_phase_volume_surface_stress_finite_f32(reduced_mass)
      || !schroeder_phase_volume_surface_stress_finite_f32(cfl_speed)
      || !schroeder_phase_volume_surface_stress_finite_f32(impulse_limit)
      || !schroeder_phase_volume_surface_stress_finite_f32(impulse_length)) {
    return invalid;
  }
  if (impulse_length > impulse_limit && impulse_length > 0.0) {
    bond_impulse_ns =
      bond_impulse_ns * (impulse_limit / impulse_length);
  }

  return SchroederPhaseVolumeSurfaceStressBondResult(
    bond_impulse_ns,
    1u
  );
}
`;
