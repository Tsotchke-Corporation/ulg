import { createSphExactProductEnergyWgsl } from './sphExactProductEnergyWgsl.js';

export const SPH_EXACT_REACTION_PRODUCT_ENERGY_HEADER_WORDS = 8;
export const SPH_EXACT_REACTION_PRODUCT_ENERGY_FIELDS = Object.freeze([
  'comKineticCorrection', 'physicalEnergyResidual', 'productTotalEnergy'
]);

/** Complete energy coordinates of the existing prepared pair. The common
 * denominator is caloric field1 and the quantum is massQuantum-299-t.
 * A product/fragment of mass m owns exact momentum (m/C)*P and total energy
 * m*u + (m/C)*(projectedComKE + physicalEnergyResidual). Keeping this shared
 * basis avoids rounding fractions or eagerly multiplying another denominator.
 * Placement, terminal ownership and repeated-source admission remain separate.
 */
export function createSphExactReactionPacketGpuWgsl(format) {
  return createSphExactProductEnergyWgsl(format) + /* wgsl */ `
fn ep_store_field(at: u32, field: u32, value: ExactCaloric) {
  let dest = at + 8u + field * (EC_WORDS + 2u);
  es_output[dest] = value.negative; es_output[dest + 1u] = value.error;
  for (var i = 0u; i < EC_WORDS; i++) { es_output[dest + 2u + i] = value.words[i]; }
}
@compute @workgroup_size(1)
fn prepare_exact_reaction_product_energy(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= es_params.count) { return; }
  let out = id.x * es_params.record_words;
  let caloric = es_caloric_start(out);
  let at = caloric + es_params.caloric_record_words;
  if (es_output[out] != 1u || es_output[out + 1u] != 0u || es_output[caloric] != 1u) { return; }
  // A derived velocity can round to zero while exact momentum stays positive.
  // Its existing underflow receipt is retained; every other error rejects.
  let projection_error = es_output[es_extensive_start(out) + 3u];
  var error = es_output[out + 10u] & ~32u;
  var internal: ExactExtensive;
  for (var term = 0u; term < es_output[out + 5u]; term++) {
    let source = out + 12u + 7u * EM_WORDS + term * (4u + 3u * EM_WORDS);
    let mass = es_load_output(source + 4u);
    let state = es_caloric_product_start(out, 2u, term);
    if (es_output[source + 3u] != 0u || es_output[state + 7u] != 0u
        || es_output[state + 3u] != select(1u, 0u, em_zero(mass))) { error |= 8192u; }
    for (var field = 0u; field < 3u; field++) {
      if (es_output[source + field] != es_output[state + field]) { error |= 8192u; }
    }
    if (em_zero(mass)) { continue; }
    internal = ee_add(internal, ee_mass_scaled(mass, es_output[state + 4u]));
  }
  error |= internal.error;
  es_output[at + 4u] = projection_error;
  if (error != 0u) { es_output[at + 1u] = error; return; }
  let rule = es_output[out + 4u] * 24u; let scale_at = es_metadata[rule + 1u];
  var scale: ExactCaloric;
  for (var i = 0u; i < EM_WORDS + 4u; i++) { scale.words[i] = es_metadata[scale_at + 4u + i]; }
  let fractional_shift = es_output[caloric + 6u];
  let packet = ep_energy(es_load_output(out + 12u),
    es_load_extensive(out, 0u), es_load_extensive(out, 1u), es_load_extensive(out, 2u),
    es_load_extensive(out, 10u), internal, scale, es_load_caloric(out, 1u),
    fractional_shift, es_load_caloric(out, 4u));
  ep_store_field(at, 0u, packet.correction); ep_store_field(at, 1u, packet.residual);
  ep_store_field(at, 2u, packet.total);
  es_output[at + 1u] = packet.error; es_output[at + 2u] = fractional_shift;
  es_output[at + 3u] = bitcast<u32>(EM_QUANTUM - 299 - i32(fractional_shift));
  es_output[at] = select(0u, 1u, packet.error == 0u);
}
`;
}
