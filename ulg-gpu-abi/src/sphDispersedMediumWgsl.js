import {
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS
} from './sphDispersedMedium.js';

export const sphDispersedMediumOpticsWgsl = /* wgsl */ `
struct SphDispersedMediumOptics {
  dispersed_material_id: f32,
  dispersed_phase_id: f32,
  optical_state_id: f32,
  status: f32,
  dispersed_mass_kg: f32,
  scattering_cross_section_m2: f32,
  absorption_cross_section_m2: f32,
  scattering_asymmetry_cross_section_m2: f32,
};

const SPH_DISPERSED_MEDIUM_OPTICS_STATUS_READY: f32 = ${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready}.0;
const SPH_DISPERSED_MEDIUM_OPTICS_STATUS_BLOCKED: f32 = ${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked}.0;

fn sph_dispersed_medium_optics_finite(value: f32) -> bool {
  return value == value && abs(value) <= bitcast<f32>(0x7f7fffffu);
}

fn sph_dispersed_medium_optics_identifier(
  value: f32,
  positive: bool
) -> bool {
  let minimum = select(0.0, 1.0, positive);
  return sph_dispersed_medium_optics_finite(value)
    && value >= minimum
    && value <= 16777215.0
    && floor(value) == value;
}

fn sph_dispersed_medium_optics_row_is_ready(
  row: SphDispersedMediumOptics
) -> bool {
  return row.status == SPH_DISPERSED_MEDIUM_OPTICS_STATUS_READY
    && sph_dispersed_medium_optics_identifier(
      row.dispersed_material_id,
      false
    )
    && sph_dispersed_medium_optics_identifier(row.dispersed_phase_id, false)
    && sph_dispersed_medium_optics_identifier(row.optical_state_id, true)
    && sph_dispersed_medium_optics_finite(row.dispersed_mass_kg)
    && row.dispersed_mass_kg >= 0.0
    && sph_dispersed_medium_optics_finite(row.scattering_cross_section_m2)
    && row.scattering_cross_section_m2 >= 0.0
    && sph_dispersed_medium_optics_finite(row.absorption_cross_section_m2)
    && row.absorption_cross_section_m2 >= 0.0
    && sph_dispersed_medium_optics_finite(
      row.scattering_asymmetry_cross_section_m2
    )
    && abs(row.scattering_asymmetry_cross_section_m2)
      <= row.scattering_cross_section_m2;
}

fn sph_dispersed_medium_optics_row_is_blocked(
  row: SphDispersedMediumOptics
) -> bool {
  return row.status == SPH_DISPERSED_MEDIUM_OPTICS_STATUS_BLOCKED;
}
`;
