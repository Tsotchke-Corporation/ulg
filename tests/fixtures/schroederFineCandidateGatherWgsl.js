import { mlsMpmTrialDeformationWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS as FIELD_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_DESCRIPTOR_WORDS as FIELD_DESCRIPTOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_KEY_WORDS as FIELD_KEY_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_ACCUMULATOR_WORDS as FIELD_ACCUMULATOR_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS as FIELD_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATE_WORDS as FIELD_STATE_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS as FIELD_PRESSURE_WORDS
} from '../../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  extractRejectedParticleG2pFragments,
  schroederRejectedParticleDiagnosticWgsl
} from '../../src/runtime/sph/schroederRejectedParticleDiagnosticGpu.js';

export const FINE_CANDIDATE_GATHER_HEADER_WORDS = 16;
export const FINE_CANDIDATE_GATHER_ROW_WORDS = 64;
export const FINE_CANDIDATE_GATHER_PARAMS_BYTES = 32;

// Reuse the existing exact source/layout/pressure checks, not a CPU mirror.
// A changed or ambiguous function boundary disables this test diagnostic.
export function extractFineCandidateGatherValidationFragments(
  source = schroederRejectedParticleDiagnosticWgsl
) {
  const names = ['finite', 'finite3', 'fits', 'product_fits_u32',
    'determinant', 'pressure_admitted', 'g2p_scale_close', 'source_admitted'];
  return Object.freeze(Object.fromEntries(names.map((name) => {
    const anchor = `fn ${name}(`;
    const start = source.indexOf(anchor);
    if (start < 0 || source.indexOf(anchor, start + anchor.length) !== -1) {
      throw new Error(`Candidate gather lost unique production function: ${name}`);
    }
    const opening = source.indexOf('{', start);
    let depth = 1;
    let end = opening + 1;
    if (opening < 0) throw new Error(`Candidate gather lost unique production body: ${name}`);
    for (; end < source.length && depth > 0; end++) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}') depth--;
    }
    if (depth !== 0) throw new Error(`Candidate gather lost unique production closing brace: ${name}`);
    return [name, source.slice(start, end)];
  })));
}

const math = extractRejectedParticleG2pFragments();
const validation = extractFineCandidateGatherValidationFragments();

// Test-only raw pre-wall/pre-volume-cap first-fine candidate, NOT an admitted
// endpoint, a full-r2 transaction, or a production field/receipt replacement.
// Run begin(1), particles(ceil(particleCount/64)), seal(1) in ordered passes.
// Output is 16 + particleCount*64 words. Rows are indexed by active ordinal.
// Header: magic/version, flags(complete1/finite2/source4/candidate8), particles,
// expected-active, visited, fine-active, complete-fine, nonfinite, incomplete,
// clipped, deformation-disabled, raw-J-nonpositive, field-gen/complete, fine-ordinal.
// Row: particle, flags, samples, weight, posMass4, velocity3, rawJ, rawC9,
// rawTrialF9, inputF9, effectiveJ, effectiveC9, effectiveTrialF9, clipped,
// missing, visited-stencil, displacement/dx, max-node-speed, active ordinal.
// Row flags: visited1/fine-active2/evaluated4/finite8/complete16/disabled32/
// missing64/clipped128/raw-J-nonpositive256/invalid-source-or-descriptor512.
export const schroederFineCandidateGatherWgsl = /* wgsl */ `
// Test-only raw pre-wall/pre-volume-cap first-fine candidate; no admission.
${mlsMpmTrialDeformationWgsl}
const FIELD_HEADER_WORDS: u32 = ${FIELD_HEADER_WORDS}u;
const FIELD_DESCRIPTOR_WORDS: u32 = ${FIELD_DESCRIPTOR_WORDS}u;
const FIELD_KEY_WORDS: u32 = ${FIELD_KEY_WORDS}u;
const FIELD_ACCUMULATOR_WORDS: u32 = ${FIELD_ACCUMULATOR_WORDS}u;
const FIELD_RECEIPT_WORDS: u32 = ${FIELD_RECEIPT_WORDS}u;
const FIELD_STATE_WORDS: u32 = ${FIELD_STATE_WORDS}u;
const FIELD_PRESSURE_WORDS: u32 = ${FIELD_PRESSURE_WORDS}u;
const FIELD_TAIL_WORDS: u32 = FIELD_STATE_WORDS + FIELD_PRESSURE_WORDS;
@group(0) @binding(0) var<storage, read> field: array<u32>;
@group(0) @binding(1) var<storage, read> candidate: array<u32>;
@group(0) @binding(2) var<storage, read> active_source: array<u32>;
@group(0) @binding(3) var<storage, read> state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> output: array<u32>;
struct Inputs {
  particle_count: u32, grid_spacing_m: f32, inv_grid_spacing_m: f32,
  candidate_completion_ordinal: u32,
  dt: f32, pressure_scale: f32, internal_pressure_scale: f32,
  fine_substep_ordinal: u32
};
@group(0) @binding(6) var<uniform> inputs: Inputs;
struct GatherParams {
  grid_nx: u32, grid_ny: u32, grid_nz: u32, shift: u32,
  grid_spacing_m: f32, inv_grid_spacing_m: f32, dt: f32
};
var<private> params: GatherParams;
${math.functions}
${math.grid}
${Object.values(validation).join('\n')}
fn output_row(ordinal: u32) -> u32 { return 16u + ordinal * 64u; }
fn put(index: u32, value: f32) { output[index] = bitcast<u32>(value); }

fn candidate_source_valid() -> bool {
  if (!source_admitted() || field[2] != 3u
      || inputs.particle_count == 0u
      || inputs.particle_count > arrayLength(&state) / 2u
      || inputs.particle_count > arrayLength(&mechanics) / 8u
      || !fits(16u, inputs.particle_count, 64u, arrayLength(&output))
      || !finite(inputs.dt) || !(inputs.dt > 0.0)
      || !finite(inputs.grid_spacing_m) || !(inputs.grid_spacing_m > 0.0)
      || bitcast<u32>(inputs.grid_spacing_m) != field[23]
      || !finite(inputs.inv_grid_spacing_m) || !(inputs.inv_grid_spacing_m > 0.0)
      || !finite(inputs.pressure_scale) || !finite(inputs.internal_pressure_scale)
      || inputs.candidate_completion_ordinal == 0u) { return false; }
  params = GatherParams(field[19], field[20], field[21], field[22],
    inputs.grid_spacing_m, inputs.inv_grid_spacing_m, inputs.dt);
  if (params.grid_nx == 0u || params.grid_ny == 0u || params.grid_nz == 0u
      || params.grid_nx > 2147483647u || params.grid_ny > 2147483647u
      || params.grid_nz > 2147483647u || params.shift > 2147483647u
      || !product_fits_u32(params.grid_nx, params.grid_ny)
      || !product_fits_u32(params.grid_nx * params.grid_ny, params.grid_nz)
      || params.grid_nx * params.grid_ny * params.grid_nz != field[18]) { return false; }
  if (arrayLength(&candidate) < 16u || candidate[0u] != 0x46434331u
      || candidate[1u] != 1u || candidate[2u] != 15u
      || candidate[3u] != field[34] || candidate[4u] != candidate[3u]
      || candidate[5u] > candidate[3u] || candidate[6u] != candidate[5u]
      || candidate[7u] != candidate[5u] || candidate[8u] != candidate[5u]
      || candidate[11u] != field[3]
      || candidate[12u] != inputs.candidate_completion_ordinal
      || candidate[13u] != inputs.fine_substep_ordinal
      || candidate[14u] != bitcast<u32>(1.0)
      || candidate[15u] != bitcast<u32>(1.0)
      || !fits(16u, candidate[3u], 32u, arrayLength(&candidate))) { return false; }
  return true;
}

@compute @workgroup_size(1)
fn candidate_gather_begin() {
  if (arrayLength(&output) < 16u) { return; }
  // A missing subsequent dispatch cannot inherit old row completion flags.
  for (var index = 0u; index < arrayLength(&output); index++) { output[index] = 0u; }
  output[0u] = 0x46434731u;
  output[1u] = 1u;
  output[3u] = inputs.particle_count;
  if (!candidate_source_valid()) { return; }
  output[2u] = 4u | 8u;
  output[4u] = active_source[18];
  output[13u] = field[3];
  output[14u] = field[38];
  output[15u] = candidate[13u];
}

@compute @workgroup_size(64)
fn candidate_gather_particles(@builtin(global_invocation_id) id: vec3<u32>) {
  if (!candidate_source_valid() || output[2u] != 12u) { return; }
  let ordinal = id.x;
  if (ordinal >= active_source[18]) { return; }
  let row = output_row(ordinal);
  let particle = active_source[active_source[25] + ordinal];
  output[row] = particle;
  output[row + 1u] = 1u;
  output[row + 63u] = ordinal;
  if (particle >= inputs.particle_count
      || active_source[active_source[26] + particle] != ordinal) {
    output[row + 1u] = 1u | 512u;
    return;
  }
  let descriptor = field[24] + particle * FIELD_DESCRIPTOR_WORDS;
  if (field[descriptor + 3u] == 0u) { return; }
  if (field[descriptor + 3u] != 1u) {
    output[row + 1u] = 1u | 512u;
    return;
  }
  output[row + 1u] = 1u | 2u;
  let pos_mass = state[particle * 2u];
  let mechanics_base = particle * 8u;
  let row0 = mechanics[mechanics_base]; let row1 = mechanics[mechanics_base + 1u];
  let row2 = mechanics[mechanics_base + 2u];
  let row5 = mechanics[mechanics_base + 5u]; let row6 = mechanics[mechanics_base + 6u];
  let f = array<vec3<f32>, 3>(row0.xyz, vec3<f32>(row0.w, row1.x, row1.y),
    vec3<f32>(row1.z, row1.w, row2.x));
  if (!finite3(pos_mass.xyz) || !finite(pos_mass.w) || !(pos_mass.w > 0.0)
      || !finite3(f[0]) || !finite3(f[1]) || !finite3(f[2])
      || !finite(row5.x) || !finite(row6.z)) { return; }
  let grid_pos = pos_mass.xyz * params.inv_grid_spacing_m;
  if (!finite3(grid_pos) || any(abs(grid_pos) >= vec3<f32>(2147483000.0))) { return; }
${math.setup}
  var sample_count = 0u; var clipped = 0u; var missing = 0u; var bad = false;
  var visited_stencil = 0u; var nodal_speed = 0.0;
  for (var a = 0i; a < 3i; a++) {
    for (var b = 0i; b < 3i; b++) {
      for (var c = 0i; c < 3i; c++) {
        visited_stencil++;
        let node_i = base_x + a; let node_j = base_y + b; let node_k = base_z + c;
        let weight = g2p_weight_at(wx, a) * g2p_weight_at(wy, b) * g2p_weight_at(wz, c);
        if (!finite(weight) || weight < 0.0) { bad = true; continue; }
        if (weight == 0.0) { continue; }
        if (!g2p_in_range(node_i, node_j, node_k)) { clipped++; continue; }
        let idx = g2p_grid_index(node_i, node_j, node_k);
        let field_index = field[descriptor + 4u + u32(a * 9i + b * 3i + c)];
        if (field_index >= field[34]) { missing++; continue; }
        let key = field[26] + field_index * FIELD_KEY_WORDS;
        if (field[key] != idx || field[key + 1u] != field[descriptor]
            || field[key + 2u] != field[descriptor + 1u]
            || field[key + 3u] != field[descriptor + 2u]) { missing++; continue; }
        let state_row = field[30] + field_index * FIELD_STATE_WORDS;
        let mass = bitcast<f32>(field[state_row]);
        let candidate_row = 16u + field_index * 32u;
        if ((candidate[candidate_row] & 159u) != 159u
            || candidate[candidate_row + 1u] != field_index) { missing++; continue; }
        let grid_velocity = vec3<f32>(bitcast<f32>(candidate[candidate_row + 8u]),
          bitcast<f32>(candidate[candidate_row + 9u]),
          bitcast<f32>(candidate[candidate_row + 10u]));
        if (!finite(mass) || !finite3(grid_velocity)) { bad = true; continue; }
        if (!(mass > 0.0) || field[state_row + 7u] == 0u
            || !pressure_admitted(field_index)) { missing++; continue; }
        sample_count++; sampled_weight = sampled_weight + weight;
        nodal_speed = max(nodal_speed, length(grid_velocity));
${math.accumulate}
      }
    }
  }
${math.normalize}
  let gathered_c = array<vec3<f32>, 3>(vec3<f32>(c00,c01,c02),
    vec3<f32>(c10,c11,c12), vec3<f32>(c20,c21,c22));
  let trial = g2p_trial_deformation(f[0],f[1],f[2],gathered_c[0],gathered_c[1],gathered_c[2],params.dt);
  let raw_j = determinant(trial);
  let solid = row5.x > 0.5;
  let disabled = !solid && (row6.z < 0.5 || inputs.internal_pressure_scale == 0.0);
  let effective_j = select(raw_j, determinant(f), disabled);
  let displacement = length(params.dt * velocity) / params.grid_spacing_m;
  let finite_result = !bad && finite3(velocity)
    && finite3(gathered_c[0]) && finite3(gathered_c[1]) && finite3(gathered_c[2])
    && finite3(trial[0]) && finite3(trial[1]) && finite3(trial[2])
    && finite(raw_j) && finite(effective_j) && finite(displacement)
    && finite(nodal_speed) && finite(sampled_weight);
  let complete = missing == 0u && clipped == 0u && sample_count > 0u && visited_stencil == 27u;
  var flags = 1u | 2u | 4u;
  if (finite_result) { flags = flags | 8u; }
  if (complete) { flags = flags | 16u; }
  if (disabled) { flags = flags | 32u; }
  if (missing > 0u) { flags = flags | 64u; }
  if (clipped > 0u) { flags = flags | 128u; }
  if (finite(raw_j) && raw_j <= 0.0) { flags = flags | 256u; }
  output[row + 2u] = sample_count;
  put(row + 3u, sampled_weight);
  for (var i = 0u; i < 3u; i++) {
    put(row + 4u + i, pos_mass[i]);
    put(row + 8u + i, velocity[i]);
    for (var j = 0u; j < 3u; j++) {
      let index = 3u * i + j;
      put(row + 12u + index, gathered_c[i][j]);
      put(row + 21u + index, trial[i][j]);
      put(row + 30u + index, f[i][j]);
      put(row + 40u + index, select(gathered_c[i][j], 0.0, disabled));
      put(row + 49u + index, select(trial[i][j], f[i][j], disabled));
    }
  }
  put(row + 7u, pos_mass.w);
  put(row + 11u, raw_j);
  put(row + 39u, effective_j);
  output[row + 58u] = clipped;
  output[row + 59u] = missing;
  output[row + 60u] = visited_stencil;
  put(row + 61u, displacement);
  put(row + 62u, nodal_speed);
  output[row + 1u] = flags;
}

@compute @workgroup_size(1)
fn candidate_gather_seal() {
  if (!candidate_source_valid() || output[2u] != 12u) { return; }
  for (var ordinal = 0u; ordinal < active_source[18]; ordinal++) {
    let row = output_row(ordinal);
    let flags = output[row + 1u];
    if ((flags & 1u) == 0u) { output[9u]++; continue; }
    output[5u]++;
    if (output[row + 63u] != ordinal
        || output[row] != active_source[active_source[25] + ordinal]) {
      output[9u]++;
      continue;
    }
    if ((flags & 512u) != 0u) { output[9u]++; }
    if ((flags & 2u) == 0u) { continue; }
    output[6u]++;
    if ((flags & 8u) == 0u) { output[8u]++; }
    if ((flags & (4u | 8u | 16u)) == (4u | 8u | 16u)) { output[7u]++; }
    if ((flags & 16u) == 0u) { output[9u]++; }
    if ((flags & 128u) != 0u) { output[10u]++; }
    if ((flags & 32u) != 0u) { output[11u]++; }
    if ((flags & 256u) != 0u) { output[12u]++; }
  }
  var flags = 4u | 8u;
  if (output[5u] == output[4u] && output[7u] == output[6u]
      && output[9u] == 0u) { flags = flags | 1u; }
  if (output[8u] == 0u) { flags = flags | 2u; }
  output[2u] = flags;
}
`;
