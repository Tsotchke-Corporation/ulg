import { createSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactMassWgsl } from './sphExactMassWgsl.js';
import { createSphExactLedgerWgsl } from './sphExactLedgerWgsl.js';
import { sphFiniteWallEnergyAddWgsl } from './sphFiniteWallStateGpu.js';

// Phase 1 integer energy ledger, canonical thermal apply variant
// (plan/todo/g2-integer-ledger-proposal.md, slice 1b). The energy record of
// N carriers in the standard run format is
//   [U rows: N*W words][S rows: N*W words][control: CONTROL_WORDS words]
// U is signed extensive internal energy m*u; S is the signed cumulative source
// energy applied to that row. Every row keeps one writer, and the budget is an
// integer identity with no tolerance: sum(U - S) never changes.
export const SPH_EXACT_THERMAL_ENERGY_FORMAT = createSphExactMassFormat();
export const SPH_EXACT_THERMAL_ENERGY_WORDS = SPH_EXACT_THERMAL_ENERGY_FORMAT.wordCount;
export const SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS = 4;
// Control word 0 accumulates these flags; any error bit fails the ledger.
export const SPH_EXACT_THERMAL_ENERGY_ERROR = Object.freeze({
  ROW_REJECTED: 1,
  ARITHMETIC: 2,
  OUTSIDE_DOMAIN: 4,
  UNLEDGERED_WRITER: 8,
  ROUTE: 16
});
// Control word 1: the proposal header was not admitted, so no row applied
// pair exchange this step. That is exact (no one applied it) but visible.
// Control words 2 and 3 count, over the run, the particle-steps without pair
// exchange and all ledger particle-steps, so the skipped fraction is known.
export const SPH_EXACT_THERMAL_ENERGY_STATUS_NO_PAIR_EXCHANGE = 1;
// Control word 1: mechanics heat reached u since the previous ledger step and
// was booked as a recorded source (G2 Phase 2, slice 2c).
export const SPH_EXACT_THERMAL_ENERGY_STATUS_MECHANICS_HEAT = 2;

export function sphExactThermalEnergyRecordWords(rowCount) {
  if (!Number.isSafeInteger(rowCount) || rowCount < 1) {
    throw new RangeError('Exact energy record requires a positive row count');
  }
  return 2 * rowCount * SPH_EXACT_THERMAL_ENERGY_WORDS + SPH_EXACT_THERMAL_ENERGY_CONTROL_WORDS;
}

const W = SPH_EXACT_THERMAL_ENERGY_WORDS;
const E = SPH_EXACT_THERMAL_ENERGY_ERROR;

/** Shared mechanics-source rule for carrier thermal apply and transported
 * canonical history. Both keep low integer limbs and add one identical packet
 * to U and S; an f32 view never replaces the extensive ledger. */
export function sphExactMechanicsHeatPacketWgsl() {
  return `
struct MechanicsHeatPacket { value:ExactMass, error:u32, recorded:u32 };
fn mechanics_heat_packet(energy:ExactMass,mass:f32,incoming_u:f32)->MechanicsHeatPacket {
  var out=MechanicsHeatPacket();
  let incoming=el_project_f32_bits(energy);
  if(!(mass>0.0) || !(abs(incoming_u)<=3.402823e38) || abs(incoming_u)>3.402823e38/mass){out.error=1u;return out;}
  let seeded=el_from_f32_bits(bitcast<u32>(mass*incoming_u));
  let is_projection=incoming.error==0u && bitcast<f32>(incoming.bits)/mass==incoming_u;
  let is_seed=seeded.error==0u && el_compare(seeded.value,energy)==0;
  if(!is_projection && !is_seed){
    let heat=el_from_f32_bits(bitcast<u32>(mass*incoming_u-bitcast<f32>(incoming.bits)));
    out.value=heat.value;out.error=incoming.error|heat.error;out.recorded=1u;
  }
  return out;
}`;
}

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Exact thermal energy WGSL anchor drifted: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

const ledgerFunctionsWgsl = /* wgsl */ `
${createSphExactMassWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${createSphExactLedgerWgsl(SPH_EXACT_THERMAL_ENERGY_FORMAT)}
${sphExactMechanicsHeatPacketWgsl()}

fn thermal_energy_load(word: u32) -> ExactMass {
  var value: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = atomicLoad(&exact_energy_rows[word + i]); }
  return value;
}

fn thermal_energy_store(word: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { atomicStore(&exact_energy_rows[word + i], value.words[i]); }
}

fn thermal_energy_control_word() -> u32 {
  return 2u * params.particle_count * EM_WORDS;
}

fn thermal_energy_fail(errors: u32) {
  atomicOr(&exact_energy_rows[thermal_energy_control_word()], errors);
}

// Applies this row's exact pair net and its source packet, and returns the
// projected specific energy the f32 solver continues from. The f32 thermal
// result is replaced, never blended: u is the ledger's view.
// Move v by n ulps toward +inf (n > 0) or -inf (n < 0); zero steps to the
// smallest subnormal.
fn thermal_energy_ulp_step(v: f32, n: i32) -> f32 {
  if (v == 0.0) { return select(-1.0e-45, 1.0e-45, n > 0); }
  let bits = bitcast<i32>(v);
  return bitcast<f32>(select(bits - n, bits + n, v > 0.0));
}
fn thermal_exact_energy_finish(
  particle_index: u32,
  mass: f32,
  incoming_u: f32,
  source_du: f32,
  row_admitted: bool,
  domain_ready: bool,
  domain: vec2<f32>,
  fallback_u: f32
) -> f32 {
  let rows = params.particle_count * EM_WORDS;
  let u_word = particle_index * EM_WORDS;
  let s_word = rows + u_word;
  let ledger_energy = thermal_energy_load(u_word);
  var errors = 0u;
  // The incoming u is this ledger's own projection, the cold seed's factor
  // (U0 = fl32(m*u)), or the record plus mechanics heat: field wall and
  // contact heat deposited by G2P, pair-contact heat and surface-stress work
  // reach u between ledger steps. That heat is a recorded source (user,
  // 2026-10-27: "mechanics heat and wall heat as recorded sources"), booked
  // here as one exact packet m*u_in - U_view. Only a non-finite or
  // unrepresentable change fails the ledger.
  let heat=mechanics_heat_packet(ledger_energy,mass,incoming_u);
  var mechanics_heat=ExactMass();
  if(heat.error!=0u){errors|=${E.UNLEDGERED_WRITER}u;}
  else {
    mechanics_heat=heat.value;
    if(heat.recorded!=0u){atomicOr(&exact_energy_rows[thermal_energy_control_word()+1u],
      ${SPH_EXACT_THERMAL_ENERGY_STATUS_MECHANICS_HEAT}u);}
  }
  let with_heat = el_add(ledger_energy, mechanics_heat);
  let energy = with_heat.value;
  var net: ExactMass;
  if (canonical_thermal_proposal_header_valid()) {
    if (row_admitted) {
      let base = THERMAL_PROPOSAL_HEADER_WORDS
        + params.particle_count * THERMAL_PROPOSAL_ROW_WORDS + particle_index * EM_WORDS;
      for (var i = 0u; i < EM_WORDS; i++) { net.words[i] = thermal_bins[base + i]; }
    } else {
      // The partner rows applied their halves; refusing this one would
      // otherwise silently create or destroy energy.
      errors |= ${E.ROW_REJECTED}u;
    }
  } else {
    atomicOr(&exact_energy_rows[thermal_energy_control_word() + 1u],
      ${SPH_EXACT_THERMAL_ENERGY_STATUS_NO_PAIR_EXCHANGE}u);
    atomicAdd(&exact_energy_rows[thermal_energy_control_word() + 2u], 1u);
  }
  atomicAdd(&exact_energy_rows[thermal_energy_control_word() + 3u], 1u);
  let source = el_from_f32_bits(bitcast<u32>(source_du * mass));
  let with_pairs = el_add(energy, net);
  let next_energy = el_add(with_pairs.value, source.value);
  let sources = el_add(source.value, mechanics_heat);
  let next_source = el_add(thermal_energy_load(s_word), sources.value);
  let projection = el_project_f32_bits(next_energy.value);
  if ((with_heat.error | source.error | with_pairs.error | next_energy.error | sources.error
      | next_source.error | projection.error) != 0u) {
    errors |= ${E.ARITHMETIC}u;
  }
  if (errors != 0u) {
    thermal_energy_fail(errors);
    return fallback_u;
  }
  thermal_energy_store(u_word, next_energy.value);
  thermal_energy_store(s_word, next_source.value);
  let projected_u = bitcast<f32>(projection.bits) / mass;
  // The f32 path's own next u is limited to its caloric bounds. Where it is
  // the exact view up to rounding (<= 8 ulps) it is the view: a lane row one
  // ulp under its segment edge cannot be classified, with or without a
  // proposal domain. U stays exact; the next step books the difference to S.
  let fallback_ulps = abs(bitcast<i32>(projected_u) - bitcast<i32>(fallback_u));
  let next_u = select(projected_u, fallback_u,
    (projected_u >= 0.0) == (fallback_u >= 0.0) && fallback_ulps <= 8);
  if (domain_ready) {
    // U stays exact; only the f32 view is kept inside the domain, 4 ulps in
    // from each bound: the proposal's bound and the caloric ladder's segment
    // edge can differ by an ulp, and a view on that edge is unclassifiable.
    // Beyond rounding (> 4 ulps outside) the state has left its caloric
    // model, which is flagged: no clamp may silently hide that. The next
    // ledger step books the view's difference to S as a mechanics source.
    var inner_lo = thermal_energy_ulp_step(domain.x, 4);
    var inner_hi = thermal_energy_ulp_step(domain.y, -4);
    if (inner_lo > inner_hi) { inner_lo = 0.5 * (domain.x + domain.y); inner_hi = inner_lo; }
    if (next_u < domain.x || next_u > domain.y) {
      let bound = clamp(next_u, domain.x, domain.y);
      let ulps = abs(bitcast<i32>(next_u) - bitcast<i32>(bound));
      if ((next_u >= 0.0) != (bound >= 0.0) || ulps > 4) {
        thermal_energy_fail(${E.OUTSIDE_DOMAIN}u);
      }
    }
    return clamp(next_u, inner_lo, inner_hi);
  }
  return next_u;
}
`;

/** Canonical-proposal thermal apply with the integer energy ledger. The
 * input is the patched production thermal step; the default variant stays
 * byte-identical. Binding 11 holds the successor energy record. */
export function appendSphExactThermalEnergyWgsl(thermalStepWgsl, { finiteWalls = false } = {}) {
  let code = replaceOnce(thermalStepWgsl,
    '@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;\n',
    '@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;\n'
      + '@group(0) @binding(11) var<storage, read_write> exact_energy_rows: array<atomic<u32>>;\n',
    'binding 11');
  // The producer must have written the integer section this variant reads.
  code = replaceOnce(code, '    && thermal_bins[6u] == 0u\n',
    `    && thermal_bins[6u] == ${W}u\n`, 'proposal ledger header word');
  code = replaceOnce(code, '\t  var conduction_du = 0.0;\n',
    '\t  var conduction_du = 0.0;\n\t  var exact_row_admitted = false;\n', 'row admission declaration');
  code = replaceOnce(code, '\t        conduction_du = proposed_pair_du;\n',
    '\t        conduction_du = proposed_pair_du;\n\t        exact_row_admitted = true;\n', 'row admission');
  code = replaceOnce(code, '\t      neighbor_max_temperature\n\t    );\n\t  }\n',
    '\t      neighbor_max_temperature\n\t    );\n\t  }\n\t  let exact_du_before_sources = du;\n',
    'pair/source boundary');
  code = replaceOnce(code,
    '  out_sph_state[particle_index * 2u] = pos_mass;\n'
      + '  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);\n',
    '  if (params.canonical_proposal_enabled == 1u) {\n'
      + '    next_u = thermal_exact_energy_finish(particle_index, mass, vel_u.w,\n'
      + '      du - exact_du_before_sources, exact_row_admitted, canonical_reachable_domain_ready,\n'
      + '      canonical_reachable_domain.xy, next_u);\n'
      + `  } else {\n    thermal_energy_fail(${E.ROUTE}u);\n  }\n`
      + '  out_sph_state[particle_index * 2u] = pos_mass;\n'
      + '  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);\n',
    'projected write');
  let ledger = ledgerFunctionsWgsl;
  if (finiteWalls) {
    code = replaceOnce(code, sphFiniteWallEnergyAddWgsl('finite_wall_state'), /* wgsl */ `
fn finite_wall_exact_packet(row:u32,face:u32,energy_j:f32,prior:ExactMass) -> ExactMass {
  let packet=el_from_f32_bits(bitcast<u32>(energy_j));
  let opposite=el_subtract(ExactMass(),packet.value);
  let sum=el_add(prior,packet.value);
  if((packet.error|opposite.error|sum.error)!=0u) {thermal_energy_fail(${E.ARITHMETIC}u);}
  for(var w=0u;w<EM_WORDS;w++) {
    atomicStore(&finite_wall_state[(row*6u+face)*EM_WORDS+w],opposite.value.words[w]);
  }
  return sum.value;
}
`, 'exact wall packet helper');
    code = replaceOnce(code, '\t  let exact_du_before_sources = du;\n',
      '\t  var exact_wall_source=ExactMass();\n', 'wall source accumulator');
    code = replaceOnce(code, 'finite_wall_energy_add(face, -mass * wall_applied_du);',
      'exact_wall_source=finite_wall_exact_packet(particle_index,face,mass*wall_applied_du,exact_wall_source);',
      'paired finite wall packet');
    code = replaceOnce(code, '\t  // Radiative exchange with the ambient environment',
      '\t  let exact_du_before_sources=du;\n\t  // Radiative exchange with the ambient environment', 'ambient source boundary');
    code = replaceOnce(code, '      du - exact_du_before_sources, exact_row_admitted,',
      '      du - exact_du_before_sources, exact_wall_source, exact_row_admitted,', 'wall source argument');
    ledger = replaceOnce(ledger, '  source_du: f32,\n', '  source_du: f32,\n  wall_source: ExactMass,\n', 'wall source parameter');
    ledger = replaceOnce(ledger, '  let source = el_from_f32_bits(bitcast<u32>(source_du * mass));',
      `  let ambient = el_from_f32_bits(bitcast<u32>(source_du * mass));
  let source = el_add(ambient.value,wall_source);
  if(ambient.error!=0u) {errors|=${E.ARITHMETIC}u;}`, 'exact wall and ambient sources');
  }
  return `${code}\n${ledger}`;
}
