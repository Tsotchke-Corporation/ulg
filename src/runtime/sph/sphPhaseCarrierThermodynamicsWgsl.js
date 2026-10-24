import { pressureCarrierTransformWgsl } from '../../../ulg-gpu-abi/src/pressureCarrierTransformWgsl.js';

// Exact phase-transfer thermodynamics, shared without changing its arithmetic.
// Consumers provide `params` with the existing thermal/material offsets and
// counts, pressure-authority flag and tolerance, plus `closure_rows`.
export const sphPhaseCarrierThermodynamicsWgsl = /* wgsl */ `
${pressureCarrierTransformWgsl}
// Resolve the pressure-adjusted plateau for this material's liquid-to-gas
// segment at the particle's resolved absolute pressure.
//
// Away from the reference pressure the plateau that actually contains the
// particle's physical energy is [E0*, E1*], not the packed [E0, E1]; searching
// the reference ladder directly would simply fail to recognize a boiling
// particle. Instead the particle's energy is mapped into reference-carrier
// space, the existing reference search runs unchanged, and the endpoint it
// returns is mapped back to physical energy.
//
// A material with no admitted plateau, or a nonpositive/nonfinite pressure,
// yields valid = 0 and the caller keeps the untransformed reference path.
fn carrier_plateau_for(material_id: f32, absolute_pressure_pa: f32) -> UlgPressurePlateau {
  // Refuse to interpret the pressure lane at all until the host says it is an
  // absolute pressure. There is deliberately no fallback to one atmosphere.
  if (params.absolute_pressure_authority == 0u) {
    return ulg_pressure_plateau_invalid();
  }
  var law_id = 0u;
  var reference_pressure_pa = 0.0;
  var log_slope = 0.0;
  var found = false;
  for (var record = 0u; record < params.material_record_count; record = record + 1u) {
    let base = params.material_record_offset_vec4 + record * 2u;
    let row0 = closure_rows[base];
    if (row0.x == material_id) {
      let row1 = closure_rows[base + 1u];
      law_id = u32(round(row1.y));
      reference_pressure_pa = row1.z;
      log_slope = row1.w;
      found = true;
      break;
    }
  }
  if (!found || law_id != ULG_PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU) {
    return ulg_pressure_plateau_invalid();
  }

  // Locate the packed liquid-to-gas plateau and the liquid branch that feeds
  // it. The anchor is the phase segment ending exactly where the plateau
  // starts, which is what makes cp = (E0-Ea)/(Tref-Ta) the liquid branch's
  // mean heat capacity rather than an unrelated slope.
  var plateau_start = 0.0;
  var plateau_end = 0.0;
  var reference_temperature_k = 0.0;
  var plateau_found = false;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    if (
      row0.x == material_id
      && abs(row0.y - 2.0) < 0.5
      && u32(round(row0.z)) == 2u
      && u32(round(row0.w)) == 3u
    ) {
      let row1 = closure_rows[base + 1u];
      plateau_start = row1.x;
      plateau_end = row1.y;
      reference_temperature_k = row1.z;
      plateau_found = true;
      break;
    }
  }
  if (!plateau_found) { return ulg_pressure_plateau_invalid(); }

  var anchor_energy = 0.0;
  var anchor_temperature_k = 0.0;
  var anchor_found = false;
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    if (
      row0.x == material_id
      && abs(row0.y - 1.0) < 0.5
      && row1.y == plateau_start
    ) {
      anchor_energy = row1.x;
      anchor_temperature_k = row1.z;
      anchor_found = true;
      break;
    }
  }
  if (!anchor_found) { return ulg_pressure_plateau_invalid(); }

  return ulg_resolve_pressure_plateau_with_slope(
    anchor_energy,
    anchor_temperature_k,
    plateau_start,
    plateau_end,
    reference_temperature_k,
    absolute_pressure_pa,
    reference_pressure_pa,
    log_slope
  );
}

fn plateau_endpoint(
  material_id: f32,
  phase0: u32,
  phase1: u32,
  source_u: f32,
  target_phase: u32,
  absolute_pressure_pa: f32
) -> vec2<f32> {
  // Reference-carrier space. At the reference pressure this is bitwise the
  // untransformed energy, so the search below is unchanged.
  let plateau = carrier_plateau_for(material_id, absolute_pressure_pa);
  let carrier_u = ulg_carrier_from_physical_energy(plateau, source_u);
  for (var segment = 0u; segment < params.thermal_segment_count; segment = segment + 1u) {
    let base = params.thermal_offset_vec4 + segment * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    if (
      row0.x == material_id
      && abs(row0.y - 2.0) < 0.5
      && u32(round(row0.z)) == phase0
      && u32(round(row0.w)) == phase1
      && carrier_u >= row1.x - params.relative_tolerance * max(1.0, abs(row1.x))
      && carrier_u <= row1.y + params.relative_tolerance * max(1.0, abs(row1.y))
    ) {
      if (target_phase == phase0) {
        return vec2<f32>(ulg_physical_energy_from_carrier(plateau, row1.x), 1.0);
      }
      if (target_phase == phase1) {
        return vec2<f32>(ulg_physical_energy_from_carrier(plateau, row1.y), 1.0);
      }
    }
  }
  return vec2<f32>(0.0, 0.0);
}

`;

