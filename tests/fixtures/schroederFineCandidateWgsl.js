import { schroederSpatialParentFieldMechanicsWorkspaceWgsl as production }
  from '../../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspaceWgsl.js';

export const FINE_CANDIDATE_HEADER_WORDS = 16;
export const FINE_CANDIDATE_ROW_WORDS = 32;

// Test-only GPU experiment. These are source slices, not a CPU mechanics model.
// Missing/ambiguous anchors are errors. No production WGSL is rewritten.
function between(source, begin, end) {
  const start = source.indexOf(begin);
  const finish = source.indexOf(end, start + begin.length);
  if (start < 0 || finish < 0 || source.indexOf(begin, start + 1) !== -1
      || source.indexOf(end, finish + 1) !== -1) {
    throw new Error(`Fine candidate lost unique production anchor: ${begin}`);
  }
  return source.slice(start, finish);
}

export function extractFineCandidateFragments(source = production) {
  const validator = between(source,
    'fn validate_fine_velocity_correction(',
    'fn validate_routed_coarse_cfl(');
  const projector = between(source,
    'fn project_prepare_fine_rows(', 'fn project_prepare_coarse_rows(');
  return Object.freeze({
    // Includes exact CSR, source, mass and finite checks; ends before the
    // production node-CFL decision that this experiment is investigating.
    proposals: between(validator,
      '  let fine_field = indirect_row_index(id, workgroup_count);',
      '  let phase_delta = phase_impulse / mass;'),
    inputs: between(projector,
      '  let mass = bitcast<f32>(fine_load(state));',
      '  if (!(mass > 0.0) || !finite_f32(mass)'),
    velocity: between(projector,
      '  let applied_velocity_delta = applied / mass;',
      '  if (!all(vec3<bool>(\n      finite_f32(applied_velocity_delta.x)'),
    energy: between(projector,
      '  let pressure_velocity_delta = pressure_impulse / mass;',
      '  if (!finite_f32(delta)')
  });
}

const math = extractFineCandidateFragments();

// Header: magic/version, diagnostic flags, expected/visited/active/evaluated/
// finite/channel-closed/node-CFL-pass/delta-pass counts, generation/completion/
// fine ordinal, declared route alpha/causal alpha (float bits).
// Row: flags, ordinal, mass, vmax, prior.xyz, cfl ratio, candidate velocity.xyz,
// total signed work, applied.xyz, signed pressure work, pressure impulse.xyz,
// signed drag work, drag impulse.xyz, signed causal work, causal impulse.xyz,
// work conditioning, applied angular impulse.xyz, reserved.
// Flags: visited1/raw-ready2/evaluated4/finite8/energy-close16/node-CFL32/
// delta-ceiling64/active128. Header flags: complete1/finite2/source-admitted4/
// energy-close8. No flag grants physics admission.
export const schroederFineCandidateWgsl = /* wgsl */ `
${production}
@group(0) @binding(12) var<storage, read_write> candidate_output: array<u32>;

fn candidate_row(field: u32) -> u32 { return 16u + field * 32u; }
fn candidate_finite3(v: vec3<f32>) -> bool {
  return finite_f32(v.x) && finite_f32(v.y) && finite_f32(v.z);
}
fn candidate_put3(row: u32, offset: u32, value: vec3<f32>) {
  candidate_output[row + offset] = bitcast<u32>(value.x);
  candidate_output[row + offset + 1u] = bitcast<u32>(value.y);
  candidate_output[row + offset + 2u] = bitcast<u32>(value.z);
}

@compute @workgroup_size(64)
fn candidate_complete_fine_proposals(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let index = indirect_row_index(id, workgroup_count);
  if (index >= ws_load(21u) || index >= params.fine_capacity) { return; }
  let output_row = candidate_row(index);
  candidate_output[output_row] = 1u;
  candidate_output[output_row + 1u] = index;
${math.proposals}
  // No route/causal scalar is sealed. The raw proposal is complete only if
  // all original structural checks and every production causal helper pass.
  candidate_output[output_row] = 3u | 128u;
}

@compute @workgroup_size(64)
fn candidate_evaluate_fine_rows(
  @builtin(global_invocation_id) id: vec3<u32>,
  @builtin(num_workgroups) workgroup_count: vec3<u32>
) {
  let fine_field = indirect_row_index(id, workgroup_count);
  if (fine_field >= ws_load(21u) || fine_field >= params.fine_capacity
      || !workspace_admitted(PHASE_PREDICTORS)) { return; }
  let output_row = candidate_row(fine_field);
  if (candidate_output[output_row] != (3u | 128u)) { return; }
  let state = fine_load(30u) + fine_field * ROW_WORDS;
  let impulse_row = params.fine_impulse_offset + fine_field * FINE_IMPULSE_WORDS;
  // Explicit trial values, not production's unsealed workspace84/85.
  let route_cfl_alpha = 1.0;
  let causal_alpha = 1.0;
  let fine_spacing = bitcast<f32>(fine_load(23u));
  let fine_vmax = params.cfl_factor * fine_spacing / max(params.fine_dt, 1.0e-12);
${math.inputs}
${math.velocity}
${math.energy}
  let applied_angular = cross(fine_node_position(fine_field), applied);
  // Publish finite arithmetic even when a node fails the physical audit.
  // Such a candidate stays counterfactual and cannot authorize a commit.
  var flags = 1u | 2u | 4u | 128u;
  let finite_result = mass > 0.0 && finite_f32(mass)
    && fine_vmax > 0.0 && finite_f32(fine_vmax)
    && candidate_finite3(prior) && candidate_finite3(applied)
    && candidate_finite3(pressure_impulse) && candidate_finite3(drag_impulse)
    && candidate_finite3(causal_impulse) && candidate_finite3(applied_velocity_delta)
    && candidate_finite3(next_velocity) && candidate_finite3(applied_angular)
    && finite_f32(delta) && finite_f32(pressure_delta) && finite_f32(drag_delta)
    && finite_f32(causal_delta) && finite_f32(channel_operation_conditioning)
    && cfl_ratio >= 0.0 && finite_f32(cfl_ratio);
  if (finite_result) {
    flags = flags | 8u;
    if (measured_channel_energy_close(delta, pressure_delta, drag_delta,
        causal_delta, channel_operation_conditioning)) { flags = flags | 16u; }
    if (velocity_endpoint_within_physical_audit(next_velocity, fine_vmax)) {
      flags = flags | 32u;
    }
    if (velocity_delta_within_ceiling(applied_velocity_delta,
        max(params.max_correction_m_per_s, 0.0))) { flags = flags | 64u; }
  }
  candidate_output[output_row + 2u] = bitcast<u32>(mass);
  candidate_output[output_row + 3u] = bitcast<u32>(fine_vmax);
  candidate_put3(output_row, 4u, prior);
  candidate_output[output_row + 7u] = bitcast<u32>(cfl_ratio);
  candidate_put3(output_row, 8u, next_velocity);
  candidate_output[output_row + 11u] = bitcast<u32>(delta);
  candidate_put3(output_row, 12u, applied);
  candidate_output[output_row + 15u] = bitcast<u32>(pressure_delta);
  candidate_put3(output_row, 16u, pressure_impulse);
  candidate_output[output_row + 19u] = bitcast<u32>(drag_delta);
  candidate_put3(output_row, 20u, drag_impulse);
  candidate_output[output_row + 23u] = bitcast<u32>(causal_delta);
  candidate_put3(output_row, 24u, causal_impulse);
  candidate_output[output_row + 27u] = bitcast<u32>(channel_operation_conditioning);
  candidate_put3(output_row, 28u, applied_angular);
  candidate_output[output_row] = flags;
}

@compute @workgroup_size(1)
fn candidate_seal_evidence() {
  candidate_output[0u] = 0x46434331u;
  candidate_output[1u] = 1u;
  candidate_output[3u] = ws_load(21u);
  candidate_output[11u] = params.generation_id;
  candidate_output[12u] = params.completion_ordinal;
  candidate_output[13u] = params.fine_substep_ordinal;
  candidate_output[14u] = bitcast<u32>(1.0);
  candidate_output[15u] = bitcast<u32>(1.0);
  if (ws_load(21u) > params.fine_capacity) { return; }
  for (var index = 0u; index < ws_load(21u); index++) {
    let flags = candidate_output[candidate_row(index)];
    if ((flags & 1u) != 0u) { candidate_output[4u]++; }
    let state = fine_load(30u) + index * ROW_WORDS;
    if (fine_load(state + 7u) == 0u) { continue; }
    candidate_output[5u]++;
    if ((flags & (2u | 4u | 128u)) == (2u | 4u | 128u)) { candidate_output[6u]++; }
    if ((flags & 8u) != 0u) { candidate_output[7u]++; }
    if ((flags & 16u) != 0u) { candidate_output[8u]++; }
    if ((flags & 32u) != 0u) { candidate_output[9u]++; }
    if ((flags & 64u) != 0u) { candidate_output[10u]++; }
  }
  var flags = 0u;
  if (candidate_output[4u] == candidate_output[3u]
      && candidate_output[6u] == candidate_output[5u]) { flags = flags | 1u; }
  if (candidate_output[7u] == candidate_output[5u]) { flags = flags | 2u; }
  if (workspace_admitted(PHASE_PREDICTORS)) { flags = flags | 4u; }
  if (candidate_output[8u] == candidate_output[5u]) { flags = flags | 8u; }
  candidate_output[2u] = flags;
}
`;
