// Extracted from wgsl.js (Gate 6 Phase D mechanical decomposition).

import {
  schroederSpatialExactNearTraversalV1Wgsl
} from './schroederSpatialExactNearTraversalWgsl.js';
import {
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
} from './sphReactionProductPlacementReceipt.js';
import { createSphReactionEnergyWgsl, sphReactionEnergyWgsl, sphReactionAppliedPairWgsl } from './sphReactionEnergyWgsl.js';
import { sphReactionPairWriterWgsl, sphReactionPairReaderWgsl } from './sphReactionPairAllocationWgsl.js';
import { sphGasConstitutiveWgsl } from './sphGasConstitutiveWgsl.js';


export function createSphReactionStepWgsl({ sharedAllocation = false } = {}) {
  return `
${createSphReactionEnergyWgsl({ selectedAllocation: sharedAllocation })}
${sphGasConstitutiveWgsl}
${sharedAllocation ? sphReactionPairWriterWgsl : ''}
struct ReactionParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  material_count: u32,
  response_count: u32,
  reset_mechanics: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  // Substep duration for the interface-flux extent law; 0 disables the cap
  // (legacy whole-particle consumption) so stale packers stay well-defined.
  dt_s: f32,
  // 1 when the host authenticated header/reactant/product rows. Only 0 with
  // every extended section absent is the distinguishable legacy schema.
  reaction_table_mode: u32,
  gas_constitutive_offset: u32,
  // Phase-carrier v2 lineage capacity (rows = 4 lanes x capacity), or 0 when
  // the state has no phase lanes. See reaction_row_hosts_product.
  phase_lineage_capacity: u32,
  _phase_pad0: u32,
  _phase_pad1: u32,
  _phase_pad2: u32,
};

struct ReactionParticleBinParams {
  particle_count: u32,
  cell_count: u32,
  bin_capacity: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  bins_enabled: u32,
  _pad0: u32,
  origin_x_m: f32,
  origin_y_m: f32,
  origin_z_m: f32,
  cell_size_m: f32,
  inv_cell_size_m: f32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
};

struct SchroederReactionLawQueueParams {
  enabled: u32,
  active_node_count: u32,
  law_queue_stride: u32,
  reaction_mask: u32,
};

struct SchroederReactionLawNeighborParams {
  enabled: u32,
  candidate_count: u32,
  candidate_stride: u32,
  candidate_budget: u32,
  reaction_mask: u32,
  source_span_count: u32,
  source_span_stride: u32,
  source_span_enabled: u32,
};

struct ThermalRows {
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
};

struct ProductMechanics {
  rest_density: f32,
  bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model: f32,
  solid: f32,
  status: f32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] this reactant can deliver to a reactive
  // contact at the reference temperature (kinetic-theory effusion for gases,
  // Clausius-Clapeyron vapor carrier for volatile condensed reactants, 0 when
  // no transport pathway is derivable). Packed by the reaction-table builder.
  interface_flux: f32,
};

struct ProductTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  routing_id: f32,
  status: f32,
  term_index: u32,
};

@group(0) @binding(0) var<storage, read> particle_records: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> unpack_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> source_sph_thermo: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> proposals: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_particle_records: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> unpack_sph_state: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> unpack_sph_thermo: array<vec4<f32>>;
@group(0) @binding(11) var<uniform> params: ReactionParams;
@group(0) @binding(12) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> pack_particle_records: array<vec4<f32>>;
@group(0) @binding(15) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(16) var<storage, read_write> reaction_particle_bin_counts: array<atomic<u32>>;
@group(0) @binding(17) var<storage, read_write> reaction_particle_bin_indices: array<u32>;
@group(0) @binding(18) var<storage, read_write> reaction_particle_bin_metadata: array<atomic<u32>>;
@group(0) @binding(19) var<uniform> reaction_particle_bin_params: ReactionParticleBinParams;
@group(0) @binding(20) var<storage, read> schroeder_reaction_law_queue_rows: array<f32>;
@group(0) @binding(21) var<uniform> schroeder_reaction_law_queue_params: SchroederReactionLawQueueParams;
@group(0) @binding(22) var<storage, read> schroeder_reaction_neighbor_candidate_rows: array<f32>;
@group(0) @binding(23) var<uniform> schroeder_reaction_neighbor_candidate_params: SchroederReactionLawNeighborParams;
@group(0) @binding(24) var<storage, read> schroeder_reaction_source_span_rows: array<f32>;

const REACTION_PARTICLE_RECORD_VEC4S: u32 = 13u;
const SCHROEDER_REACTION_LAW_QUEUE_STRIDE: u32 = 32u;
const SCHROEDER_REACTION_LAW_QUEUE_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_REACTION_LAW_QUEUE_LAW_MASK_OFFSET: u32 = 12u;
const SCHROEDER_REACTION_LAW_QUEUE_REACTION_ELIGIBLE_OFFSET: u32 = 13u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_STRIDE: u32 = 16u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_NEIGHBOR_OFFSET: u32 = 1u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_LAW_MASK_OFFSET: u32 = 2u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_OFFSET: u32 = 3u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_READY: f32 = 1.0;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE: u32 = 4u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_SOURCE_OFFSET: u32 = 0u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_START_OFFSET: u32 = 1u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_COUNT_OFFSET: u32 = 2u;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STATUS_OFFSET: u32 = 3u;
const REACTION_AVOGADRO_PER_MOL: f32 = 6.02214076e23;

fn state_pos_mass(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S];
}

fn state_vel_u(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 1u];
}

fn thermo_row0(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 2u];
}

fn thermo_row1(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 3u];
}

fn thermo_row2(index: u32) -> vec4<f32> {
  return particle_records[index * REACTION_PARTICLE_RECORD_VEC4S + 4u];
}

fn reaction_row0(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u];
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_row2(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 2u];
}

fn product_phase_row0(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u];
}

fn product_phase_row1(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u + 1u];
}

fn product_phase_row2(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u + 2u];
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reaction_header_row2(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

// Gauge-consistent heat proxy (src/runtime/sph/sphReactionHeatProxyGauge.js):
// the product term's runtime-gauge offset (word 15), 0 on single-gauge tables.
fn product_term_gauge(term_index: u32) -> f32 {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u].w;
}

// First-class air, slice 3 stage 2 (sphReactionGpuKernel.js
// reactionSpectatorForProductTerm): one row per product term immediately
// before the gas constitutive records, [flag, Cv_res/Cv_mix, mixture material
// id, sentinel]. A flagged term is the spectator residue of a reaction lifted
// onto an ideal-gas mixture; rows without the sentinel (tables packed before
// the section existed) are never spectators.
const REACTION_SPECTATOR_SECTION_SENTINEL: f32 = -7340.25;

fn product_term_spectator(term_index: u32) -> vec4<f32> {
  if (params.gas_constitutive_offset < params.product_term_count
      || term_index >= params.product_term_count) {
    return vec4<f32>(0.0);
  }
  let row = reaction_records[
    params.gas_constitutive_offset - params.product_term_count + term_index
  ];
  if (row.w != REACTION_SPECTATOR_SECTION_SENTINEL || row.x != 1.0 || !(row.y > 0.0)) {
    return vec4<f32>(0.0);
  }
  return row;
}

// Spectator specific energy: the residue leaves with its own sensible energy
// at the consumed mixture row's temperature, u_res = (Cv_res/Cv_mix) u_mix.
fn spectator_specific_energy(spectator: vec4<f32>, a_material: f32, a_u: f32, b_u: f32) -> f32 {
  return spectator.y * select(b_u, a_u, a_material == spectator.z);
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn response_row2(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 2u];
}

fn response_row3(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 3u];
}

fn graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn sample_temperature_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return left.y;
  }
  let t = clamp((x - left.x) / (right.x - left.x), 0.0, 1.0);
  return left.y + t * (right.y - left.y);
}

fn reaction_value_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn represented_entity_count_from_mass(
  mass_kg: f32,
  molar_mass_kg_per_mol: f32
) -> f32 {
  if (
    !reaction_value_finite(mass_kg)
    || !reaction_value_finite(molar_mass_kg_per_mol)
    || !(mass_kg > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
  ) {
    return 0.0;
  }
  return mass_kg / molar_mass_kg_per_mol * REACTION_AVOGADRO_PER_MOL;
}

fn phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  if (phase_id >= 31u) {
    return false;
  }
  return (mask & (1u << phase_id)) != 0u;
}

fn phase_fraction(phase_id: f32, solid: f32, liquid: f32, gas: f32, plasma: f32) -> f32 {
  if (phase_id == 1.0) { return solid; }
  if (phase_id == 2.0) { return liquid; }
  if (phase_id == 3.0) { return gas; }
  if (phase_id == 4.0) { return plasma; }
  return 0.0;
}

fn resolve_thermal_rows(material_id: f32, next_u: f32, source_row2: vec4<f32>, target_phase: f32) -> ThermalRows {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    return ThermalRows(
      vec4<f32>(material_id, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 0.0),
      vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w)
    );
  }

  var selected = material_response_offset;
  var selected_phase = target_phase == 0.0;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    let row1 = response_row1(candidate);
    if (target_phase > 0.0) {
      if (row1.z == target_phase && row1.w == target_phase
        && response_row0(candidate).y != 2.0 && next_u >= row1.x && next_u <= row1.y) {
        selected = candidate;
        selected_phase = true;
        break;
      }
      continue;
    }
    selected = candidate;
    if (next_u <= row1.y || local + 1u == material_response_count) {
      break;
    }
  }

  let response0 = response_row0(selected);
  let response1 = response_row1(selected);
  let response2 = response_row2(selected);
  let response3 = response_row3(selected);
  if (!selected_phase || response0.w != 1.0 || response0.z < 0.0) {
    return ThermalRows(
      vec4<f32>(material_id, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 0.0),
      vec4<f32>(source_row2.x, source_row2.y, 255.0, source_row2.w)
    );
  }
  let denom = max(response1.y - response1.x, 1.0e-12);
  let alpha = clamp((next_u - response1.x) / denom, 0.0, 1.0);
  let temperature_k = sample_temperature_from_graph(u32(response0.z), next_u);
  let from_fraction = clamp(response3.x * alpha + response3.y, 0.0, 1.0);
  let to_fraction = clamp(response3.z * alpha + response3.w, 0.0, 1.0);
  let solid = phase_fraction(response1.z, from_fraction, 0.0, 0.0, 0.0)
    + phase_fraction(response1.w, to_fraction, 0.0, 0.0, 0.0);
  let liquid = phase_fraction(response1.z, 0.0, from_fraction, 0.0, 0.0)
    + phase_fraction(response1.w, 0.0, to_fraction, 0.0, 0.0);
  let gas = phase_fraction(response1.z, 0.0, 0.0, from_fraction, 0.0)
    + phase_fraction(response1.w, 0.0, 0.0, to_fraction, 0.0);
  let plasma = phase_fraction(response1.z, 0.0, 0.0, 0.0, from_fraction)
    + phase_fraction(response1.w, 0.0, 0.0, 0.0, to_fraction);
  var phase_id = response1.z;
  var rest_density = response2.x;
  if (response0.y == 2.0 && alpha >= 0.5 && response2.w == 1.0) {
    phase_id = response1.w;
  }
  if (response0.y == 2.0 && alpha >= 0.5 && response2.z == 1.0) {
    rest_density = response2.y;
  }

  return ThermalRows(
    vec4<f32>(material_id, phase_id, temperature_k, rest_density),
    vec4<f32>(solid, liquid, gas, plasma),
    vec4<f32>(source_row2.x, source_row2.y, 1.0, source_row2.w)
  );
}

fn find_product_mechanics(material_id: f32, phase_id: f32, temperature_k: f32) -> ProductMechanics {
  for (var record_index = 0u; record_index < params.product_phase_count; record_index = record_index + 1u) {
    let row0 = product_phase_row0(record_index);
    if (row0.x == material_id && row0.y == phase_id) {
      let row1 = product_phase_row1(record_index);
      let row2 = product_phase_row2(record_index);
      var c = row1.z;
      if (row1.w == 2.0 && params.gas_constitutive_offset > 0u) {
        c = gas_constitutive_sound_speed(reaction_records[params.gas_constitutive_offset + record_index], temperature_k);
      }
      return ProductMechanics(row0.z, row0.w, row1.x, row1.y, c, row1.w, row2.x, row2.y);
    }
  }
  return ProductMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 255.0);
}

fn product_output_ready(
  index: u32,
  material_id: f32,
  mass_kg: f32,
  source_support_volume_m3: f32,
  next_u: f32,
  velocity: vec3<f32>,
  target_phase: f32
) -> bool {
  if (
    !reaction_value_finite(material_id)
    || !reaction_value_finite(mass_kg)
    || !reaction_value_finite(source_support_volume_m3)
    || !reaction_value_finite(next_u)
    || !all(velocity == velocity)
    || !all(abs(velocity) <= vec3<f32>(3.402823e38))
    || !(material_id > 0.0)
    || !(mass_kg > 0.0)
    || !(source_support_volume_m3 > 0.0)
  ) {
    return false;
  }
  let resolved = resolve_thermal_rows(material_id, next_u, thermo_row2(index), target_phase);
  let mechanics = find_product_mechanics(resolved.row0.x, resolved.row0.y, resolved.row0.z);
  let resolved_finite = all(resolved.row0 == resolved.row0)
    && all(resolved.row1 == resolved.row1)
    && all(resolved.row2 == resolved.row2)
    && all(abs(resolved.row0) <= vec4<f32>(3.402823e38))
    && all(abs(resolved.row1) <= vec4<f32>(3.402823e38))
    && all(abs(resolved.row2) <= vec4<f32>(3.402823e38));
  let mechanics_finite =
    reaction_value_finite(mechanics.rest_density)
    && reaction_value_finite(mechanics.bulk)
    && reaction_value_finite(mechanics.shear)
    && reaction_value_finite(mechanics.lambda)
    && reaction_value_finite(mechanics.sound_speed)
    && reaction_value_finite(mechanics.eos_model)
    && reaction_value_finite(mechanics.solid)
    && reaction_value_finite(mechanics.status);
  if (
    !resolved_finite
    || !mechanics_finite
    || resolved.row0.x != material_id
    || !(resolved.row0.y > 0.0)
    || !(resolved.row0.w > 0.0)
    || resolved.row2.z != 1.0
    || mechanics.status != 1.0
    || mechanics.sound_speed < 0.0
    || !(mechanics.rest_density > 0.0)
  ) {
    return false;
  }
  let rest_volume = mass_kg / resolved.row0.w;
  return reaction_value_finite(rest_volume)
    && rest_volume > 0.0;
}

fn copy_particle(index: u32) {
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  for (var row = 0u; row < REACTION_PARTICLE_RECORD_VEC4S; row = row + 1u) {
    out_particle_records[base + row] = particle_records[base + row];
  }
}

// Phase-carrier v2 keeps one material per lineage across its four phase
// lanes. A freed reactant row may host a product in place only while every
// other lane of its lineage is empty; otherwise the pair is deferred (see
// resolve_particle). Without this a partly frozen Fe lineage (solid lane
// active) hosted its liquid lane's oxide, and the contact graph then refused
// every step (lineage material mismatch).
fn reaction_row_hosts_product(index: u32) -> bool {
  let capacity = params.phase_lineage_capacity;
  if (capacity == 0u || capacity * 4u != params.particle_count) { return true; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let row = lane * capacity + lineage;
    if (row != index && particle_records[row * REACTION_PARTICLE_RECORD_VEC4S].w != 0.0) {
      return false;
    }
  }
  return true;
}

fn particle_current_volume(index: u32) -> f32 {
  let mechanics_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
  let volume_row = particle_records[mechanics_base + 4u];
  let constitutive_row = particle_records[mechanics_base + 5u];
  let eos_row = particle_records[mechanics_base + 6u];
  let current_volume = volume_row.z * volume_row.w;
  return select(
    -1.0,
    current_volume,
    reaction_value_finite(volume_row.z)
      && reaction_value_finite(volume_row.w)
      && reaction_value_finite(current_volume)
      && volume_row.z > 0.0
      && volume_row.w > 0.0
      && current_volume > 0.0
      && constitutive_row.y == 1.0
      && eos_row.w == 1.0
  );
}

fn copy_particle_with_mass(index: u32, mass_kg: f32, physical: bool) {
  copy_particle(index);
  let base = index * REACTION_PARTICLE_RECORD_VEC4S;
  let pos_mass = particle_records[base];
  let next_mass = max(mass_kg, 0.0);
  out_particle_records[base] = vec4<f32>(pos_mass.x, pos_mass.y, pos_mass.z, next_mass);
  let mechanics_base = base + 5u;
  let volume_row = out_particle_records[mechanics_base + 4u];
  if (pos_mass.w > 0.0) {
    // A partially consumed carrier retains its deformation and the same
    // specific current volume. Scaling V0 by the surviving mass fraction
    // retires exactly the consumed share; replacement product material is
    // born independently at its own target reference state. Uniform
    // composition makes represented entities proportional to the same mass
    // fraction.
    let surviving_fraction = clamp(next_mass / pos_mass.w, 0.0, 1.0);
    if (physical) {
      let reference_row = out_particle_records[mechanics_base + 7u];
      out_particle_records[mechanics_base + 7u] = vec4<f32>(reference_row.xyz, reference_row.w * surviving_fraction);
    }
    let thermo2 = out_particle_records[base + 4u];
    out_particle_records[base + 4u] = vec4<f32>(
      thermo2.x,
      thermo2.y * surviving_fraction,
      thermo2.z,
      thermo2.w
    );
    if (volume_row.w > 0.0) {
      out_particle_records[mechanics_base + 4u] = vec4<f32>(
        volume_row.x,
        volume_row.y,
        volume_row.z,
        volume_row.w * surviving_fraction
      );
    }
  }
}

fn write_reacted_mechanics(index: u32, mass_kg: f32, _source_support_volume_m3: f32, resolved: ThermalRows) {
  let mechanics = find_product_mechanics(resolved.row0.x, resolved.row0.y, resolved.row0.z);
  var rest_density = resolved.row0.w;
  if (rest_density <= 0.0) {
    rest_density = mechanics.rest_density;
  }
  var rest_volume = 0.0;
  if (rest_density > 0.0) {
    rest_volume = mass_kg / rest_density;
  }
  // Every caller authenticates the consumed source support volume before
  // reaching this mutation, but that support is routing geometry rather than
  // deformation authority for a newly born material. Chemical products start
  // relaxed at their target reference density, matching phase-component
  // materialization and preventing gas-scale support from becoming enormous
  // condensed-product strain.
  let deformation_j = 1.0;
  let deformation_scale = 1.0;
  let out_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
  out_particle_records[out_base] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 1u] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 2u] = vec4<f32>(deformation_scale, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  out_particle_records[out_base + 4u] = vec4<f32>(0.0, 0.0, deformation_j, rest_volume);
  out_particle_records[out_base + 5u] = vec4<f32>(mechanics.solid, mechanics.status, mechanics.bulk, mechanics.shear);
  out_particle_records[out_base + 6u] = vec4<f32>(mechanics.lambda, mechanics.sound_speed, mechanics.eos_model, mechanics.status);
  out_particle_records[out_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

fn write_product_particle(
  index: u32,
  material_id: f32,
  mass_kg: f32,
  current_volume_m3: f32,
  next_u: f32,
  velocity: vec3<f32>,
  represented_entity_count: f32,
  target_phase: f32
) -> bool {
  if (
    !reaction_value_finite(represented_entity_count)
    || !(represented_entity_count > 0.0)
    || !product_output_ready(
    index,
    material_id,
    mass_kg,
    current_volume_m3,
    next_u,
    velocity,
    target_phase
    )
  ) {
    return false;
  }
  let pos_mass = state_pos_mass(index);
  let source_row2 = thermo_row2(index);
  let resolved = resolve_thermal_rows(material_id, next_u, source_row2, target_phase);
  let out_base = index * REACTION_PARTICLE_RECORD_VEC4S;
  out_particle_records[out_base] = vec4<f32>(pos_mass.x, pos_mass.y, pos_mass.z, max(mass_kg, 0.0));
  out_particle_records[out_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, next_u);
  out_particle_records[out_base + 2u] = resolved.row0;
  out_particle_records[out_base + 3u] = resolved.row1;
  out_particle_records[out_base + 4u] = vec4<f32>(
    resolved.row2.x,
    max(represented_entity_count, 0.0),
    resolved.row2.z,
    resolved.row2.w
  );
  if (params.reset_mechanics != 0u) {
    write_reacted_mechanics(index, max(mass_kg, 0.0), current_volume_m3, resolved);
    if (target_phase > 0.0) {
      out_particle_records[out_base + 12u] = vec4<f32>(0.0, 0.0, 0.0, mass_kg);
    }
  } else {
    let mechanics_base = index * REACTION_PARTICLE_RECORD_VEC4S + 5u;
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_particle_records[mechanics_base + row] = particle_records[mechanics_base + row];
    }
    let volume_row = out_particle_records[mechanics_base + 4u];
    if (current_volume_m3 > 0.0 && volume_row.z > 0.0) {
      out_particle_records[mechanics_base + 4u] = vec4<f32>(
        volume_row.xyz,
        current_volume_m3 / volume_row.z
      );
    }
  }
  return true;
}


// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}



fn reaction_extended_stoichiometry_enabled() -> bool {
  return params.reaction_table_mode == 1u;
}

fn reaction_stoichiometry_header_ready(reaction_index: u32) -> bool {
  if (!reaction_extended_stoichiometry_enabled()) {
    return false;
  }
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let header2 = reaction_header_row2(reaction_index);
  if (
    !all(vec4<bool>(
      reaction_value_finite(header0.x),
      reaction_value_finite(header0.y),
      reaction_value_finite(header0.z),
      reaction_value_finite(header0.w)
    ))
    || !reaction_value_finite(header1.x)
    || header0.x != f32(reaction_index)
    || header0.y < 0.0
    || header0.y != floor(header0.y)
    || header0.z != 2.0
    || header0.w < 0.0
    || header0.w != floor(header0.w)
    || header1.x < 1.0
    || header1.x != floor(header1.x)
    || header2.z != 1.0
  ) {
    return false;
  }
  let reactant_term_offset = u32(header0.y);
  let reactant_term_count = u32(header0.z);
  let product_term_offset = u32(header0.w);
  let product_term_count = u32(header1.x);
  return reactant_term_offset <= params.reactant_term_count
    && reactant_term_count <= params.reactant_term_count - reactant_term_offset
    && product_term_offset <= params.product_term_count
    && product_term_count <= params.product_term_count - product_term_offset;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  if (!reaction_stoichiometry_header_ready(reaction_index)) {
    return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
  }
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(header0.y);
  let reactant_term_count = u32(header0.z);
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (
      term0.x == f32(reaction_index)
      && term0.y == material_id
      && reaction_value_finite(term0.z)
      && reaction_value_finite(term0.w)
      && term0.z > 0.0
      && term0.w > 0.0
      && term2.z == 1.0
    ) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn reaction_product_terms_ready(reaction_index: u32) -> bool {
  if (!reaction_stoichiometry_header_ready(reaction_index)) {
    return false;
  }
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(header0.w);
  let product_term_count = u32(header1.x);
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (
      term0.x != f32(reaction_index)
      || !reaction_value_finite(term0.y)
      || !reaction_value_finite(term0.z)
      || !reaction_value_finite(term0.w)
      || term0.y <= 0.0
      || term0.z <= 0.0
      || term0.w <= 0.0
      || (term1.y != 0.0 && term1.y != 1.0)
      || term1.z <= 0.0
      || term1.w != 1.0
    ) {
      return false;
    }
  }
  return true;
}

fn product_term_for_local_slot(reaction_index: u32, local_slot: u32) -> ProductTerm {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  if (product_term_count == 0u) {
    let rx0 = reaction_row0(reaction_index);
    return ProductTerm(rx0.z, 1.0, 0.0, 0.0, 1.0, 0u);
  }
  let product_term_offset = u32(max(header0.w, 0.0));
  let local = min(local_slot, product_term_count - 1u);
  let term_index = product_term_offset + local;
  let term0 = product_term_row0(term_index);
  let term1 = product_term_row1(term_index);
  return ProductTerm(term0.y, term0.z, term0.w, term1.y, term1.w, term_index);
}

fn product_term_for_visible_slot(reaction_index: u32, visible_slot: u32) -> ProductTerm {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let product_term_offset = u32(max(header0.w, 0.0));
  var visible_index = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term_index = product_term_offset + local;
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    let condensed = term1.y < 0.5;
    if (term1.w == 1.0 && condensed) {
      if (visible_index == visible_slot) {
        return ProductTerm(term0.y, term0.z, term0.w, term1.y, term1.w, term_index);
      }
      visible_index = visible_index + 1u;
    }
  }
  return ProductTerm(0.0, 0.0, 0.0, 0.0, 0.0, 0u);
}

fn product_visible_term_count(reaction_index: u32) -> u32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let product_term_offset = u32(max(header0.w, 0.0));
  var visible_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y < 0.5) {
      visible_count = visible_count + 1u;
    }
  }
  return visible_count;
}

fn product_term_for_gas_slot(reaction_index: u32, gas_slot: u32) -> ProductTerm {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_count = u32(max(header1.x, 0.0));
  let product_term_offset = u32(max(header0.w, 0.0));
  // Clamp to the last gas term: a lone gas product placed from both freed
  // parent slots receives each parent's own consumed-mass share, so the
  // total placed mass still sums to the stoichiometric product mass.
  var gas_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      gas_count = gas_count + 1u;
    }
  }
  if (gas_count == 0u) {
    return ProductTerm(0.0, 0.0, 0.0, 0.0, 0.0, 0u);
  }
  let target_slot = min(gas_slot, gas_count - 1u);
  var gas_index = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term_index = product_term_offset + local;
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      if (gas_index == target_slot) {
        return ProductTerm(term0.y, term0.z, term0.w, term1.y, term1.w, term_index);
      }
      gas_index = gas_index + 1u;
    }
  }
  return ProductTerm(0.0, 0.0, 0.0, 0.0, 0.0, 0u);
}

fn product_term_for_parent_slot(reaction_index: u32, parent_slot: u32) -> ProductTerm {
  // Condensed products claim freed parent slots first (they inherit the
  // condensed-pressure role of the consumed reactant); the remaining freed
  // slots place the GAS products as real eos=2 particles. Before this,
  // gas products only ever existed as immovable product-event mass/pressure
  // sources: the event kernel's visible-mass accounting now sees the placed
  // particle and zeroes the event's unplaced share, so the event compacts
  // away on the next pass -- mass is conserved between the two ledgers.
  let visible_count = product_visible_term_count(reaction_index);
  if (parent_slot < visible_count) {
    return product_term_for_visible_slot(reaction_index, parent_slot);
  }
  return product_term_for_gas_slot(reaction_index, parent_slot - visible_count);
}

fn product_raw_mass_sum(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(64)
fn pack_source(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let source_state_base = particle_index * 2u;
  let source_thermo_base = particle_index * 3u;
  let source_mechanics_base = particle_index * 8u;
  let out_base = particle_index * REACTION_PARTICLE_RECORD_VEC4S;
  pack_particle_records[out_base] = source_sph_state[source_state_base];
  pack_particle_records[out_base + 1u] = source_sph_state[source_state_base + 1u];
  pack_particle_records[out_base + 2u] = source_sph_thermo[source_thermo_base];
  pack_particle_records[out_base + 3u] = source_sph_thermo[source_thermo_base + 1u];
  pack_particle_records[out_base + 4u] = source_sph_thermo[source_thermo_base + 2u];
  for (var row = 0u; row < 8u; row = row + 1u) {
    pack_particle_records[out_base + 5u + row] = source_mls_mechanics[source_mechanics_base + row];
  }
}

fn reaction_particle_bin_ready() -> bool {
  return reaction_particle_bin_params.bins_enabled != 0u
    && reaction_particle_bin_params.cell_count > 0u
    && reaction_particle_bin_params.bin_capacity > 0u
    && reaction_particle_bin_params.grid_nx > 0u
    && reaction_particle_bin_params.grid_ny > 0u
    && reaction_particle_bin_params.grid_nz > 0u
    && reaction_particle_bin_params.cell_size_m > 0.0;
}

fn schroeder_reaction_law_queue_enabled() -> bool {
  return schroeder_reaction_law_queue_params.enabled != 0u
    && schroeder_reaction_law_queue_params.active_node_count > 0u
    && schroeder_reaction_law_queue_params.law_queue_stride > 0u
    && schroeder_reaction_law_queue_params.reaction_mask != 0u;
}

fn schroeder_reaction_law_queue_allows_particle(particle_index: u32) -> bool {
  if (!schroeder_reaction_law_queue_enabled()) {
    return true;
  }
  if (particle_index >= schroeder_reaction_law_queue_params.active_node_count) {
    return false;
  }
  let queue_stride = max(
    schroeder_reaction_law_queue_params.law_queue_stride,
    SCHROEDER_REACTION_LAW_QUEUE_STRIDE
  );
  let queue_offset = particle_index * queue_stride;
  let queue_status = schroeder_reaction_law_queue_rows[
    queue_offset + SCHROEDER_REACTION_LAW_QUEUE_STATUS_OFFSET
  ];
  let row_enabled = queue_status > 0.0 && queue_status < 32.0;
  let law_mask = u32(max(round(schroeder_reaction_law_queue_rows[
    queue_offset + SCHROEDER_REACTION_LAW_QUEUE_LAW_MASK_OFFSET
  ]), 0.0));
  let reaction_eligible = schroeder_reaction_law_queue_rows[
    queue_offset + SCHROEDER_REACTION_LAW_QUEUE_REACTION_ELIGIBLE_OFFSET
  ] > 0.5;
  return row_enabled
    && reaction_eligible
    && ((law_mask & schroeder_reaction_law_queue_params.reaction_mask) != 0u);
}

fn schroeder_reaction_neighbor_candidates_enabled() -> bool {
  return schroeder_reaction_neighbor_candidate_params.enabled != 0u
    && schroeder_reaction_neighbor_candidate_params.candidate_count > 0u
    && schroeder_reaction_neighbor_candidate_params.candidate_stride > 0u
    && schroeder_reaction_neighbor_candidate_params.reaction_mask != 0u;
}

fn schroeder_reaction_source_spans_enabled() -> bool {
  return schroeder_reaction_neighbor_candidates_enabled()
    && schroeder_reaction_neighbor_candidate_params.source_span_enabled != 0u
    && schroeder_reaction_neighbor_candidate_params.source_span_count > 0u
    && schroeder_reaction_neighbor_candidate_params.source_span_stride > 0u;
}

fn schroeder_reaction_neighbor_candidate_span(particle_index: u32) -> vec4<u32> {
  if (!schroeder_reaction_source_spans_enabled()
      || particle_index >= schroeder_reaction_neighbor_candidate_params.source_span_count) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let source_span_stride = max(
    schroeder_reaction_neighbor_candidate_params.source_span_stride,
    SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STRIDE
  );
  let span_offset = particle_index * source_span_stride;
  let status = schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let row_source = u32(max(round(schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_SOURCE_OFFSET
  ]), 0.0));
  if (row_source != particle_index) {
    return vec4<u32>(0u, 0u, 0u, 0u);
  }
  let span_start = u32(max(round(schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_START_OFFSET
  ]), 0.0));
  let span_count = u32(max(round(schroeder_reaction_source_span_rows[
    span_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_COUNT_OFFSET
  ]), 0.0));
  return vec4<u32>(span_start, span_count, 1u, 0u);
}

fn schroeder_reaction_neighbor_candidate_partner(particle_index: u32, candidate_index: u32) -> u32 {
  if (!schroeder_reaction_neighbor_candidates_enabled()
      || candidate_index >= schroeder_reaction_neighbor_candidate_params.candidate_count) {
    return 4294967295u;
  }
  let candidate_stride = max(
    schroeder_reaction_neighbor_candidate_params.candidate_stride,
    SCHROEDER_REACTION_LAW_NEIGHBOR_STRIDE
  );
  let candidate_offset = candidate_index * candidate_stride;
  let status = schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_OFFSET
  ];
  if (abs(status - SCHROEDER_REACTION_LAW_NEIGHBOR_STATUS_READY) > 0.5) {
    return 4294967295u;
  }
  let row_source = u32(max(round(schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_OFFSET
  ]), 0.0));
  if (row_source != particle_index) {
    return 4294967295u;
  }
  let law_mask = u32(max(round(schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_LAW_MASK_OFFSET
  ]), 0.0));
  if ((law_mask & schroeder_reaction_neighbor_candidate_params.reaction_mask) == 0u) {
    return 4294967295u;
  }
  return u32(max(round(schroeder_reaction_neighbor_candidate_rows[
    candidate_offset + SCHROEDER_REACTION_LAW_NEIGHBOR_NEIGHBOR_OFFSET
  ]), 0.0));
}

fn reaction_particle_bin_coord(value: f32, axis_count: u32) -> u32 {
  if (axis_count <= 1u) {
    return 0u;
  }
  let raw = floor(value * reaction_particle_bin_params.inv_cell_size_m);
  return u32(clamp(raw, 0.0, f32(axis_count - 1u)));
}

fn reaction_particle_bin_cell_index(coords: vec3<u32>) -> u32 {
  return coords.x
    + coords.y * reaction_particle_bin_params.grid_nx
    + coords.z * reaction_particle_bin_params.grid_nx * reaction_particle_bin_params.grid_ny;
}

@compute @workgroup_size(64)
fn bin_particles(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (
    !reaction_particle_bin_ready()
    || particle_index >= reaction_particle_bin_params.particle_count
    || particle_index >= params.particle_count
  ) {
    return;
  }
  let state0 = state_pos_mass(particle_index);
  if (state0.w <= 0.0) {
    return;
  }
  let relative = state0.xyz - vec3<f32>(
    reaction_particle_bin_params.origin_x_m,
    reaction_particle_bin_params.origin_y_m,
    reaction_particle_bin_params.origin_z_m
  );
  let coords = vec3<u32>(
    reaction_particle_bin_coord(relative.x, reaction_particle_bin_params.grid_nx),
    reaction_particle_bin_coord(relative.y, reaction_particle_bin_params.grid_ny),
    reaction_particle_bin_coord(relative.z, reaction_particle_bin_params.grid_nz)
  );
  let cell_index = reaction_particle_bin_cell_index(coords);
  if (cell_index >= reaction_particle_bin_params.cell_count) {
    return;
  }
  let slot = atomicAdd(&reaction_particle_bin_counts[cell_index], 1u);
  if (slot < reaction_particle_bin_params.bin_capacity) {
    reaction_particle_bin_indices[cell_index * reaction_particle_bin_params.bin_capacity + slot] = particle_index;
  } else {
    atomicAdd(&reaction_particle_bin_metadata[0u], 1u);
  }
}

fn reaction_partner_candidate(
  particle_index: u32,
  other: u32,
  reaction_index: u32,
  partner_material: f32,
  partner_phase_mask: f32,
  role: f32,
  activation_k: f32,
  contact_radius2: f32,
  self_temperature: f32,
  self_pos: vec3<f32>,
  best: vec4<f32>
) -> vec4<f32> {
  if (other == particle_index || other >= params.particle_count) {
    return best;
  }
  let other_thermo = thermo_row0(other);
  if (other_thermo.x != partner_material || !phase_mask_satisfied(partner_phase_mask, other_thermo.y)) {
    return best;
  }
  if (max(self_temperature, other_thermo.z) < activation_k) {
    return best;
  }
  let other_pos_mass = state_pos_mass(other);
  if (other_pos_mass.w <= 0.0) {
    return best;
  }
  let delta = self_pos - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
  let distance2 = dot(delta, delta);
  if (distance2 > contact_radius2) {
    return best;
  }
  if (
    distance2 < best.w
    || (distance2 == best.w && f32(other) < best.x)
  ) {
    return vec4<f32>(f32(other), f32(reaction_index), role, distance2);
  }
  return best;
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let using_schroeder_candidate_rows = schroeder_reaction_neighbor_candidates_enabled();
  if (!using_schroeder_candidate_rows && !schroeder_reaction_law_queue_allows_particle(particle_index)) {
    proposals[particle_index] = vec4<f32>(-1.0, -1.0, 0.0, 0.0);
    return;
  }

  let self_thermo = thermo_row0(particle_index);
  let self_material = self_thermo.x;
  let self_phase = self_thermo.y;
  let self_temperature = self_thermo.z;
  let self_pos_mass = state_pos_mass(particle_index);
  let self_pos = vec3<f32>(self_pos_mass.x, self_pos_mass.y, self_pos_mass.z);

  var best = vec4<f32>(-1.0, -1.0, 0.0, 3.402823e38);

  for (var reaction_index = 0u; reaction_index < params.reaction_count; reaction_index = reaction_index + 1u) {
    let rx0 = reaction_row0(reaction_index);
    let rx1 = reaction_row1(reaction_index);
    let rx2 = reaction_row2(reaction_index);
    if (rx2.x != 1.0) {
      continue;
    }

    var partner_material = 0.0;
    var partner_phase_mask = 0.0;
    var role = 0.0;
    if (self_material == rx0.x && phase_mask_satisfied(rx1.z, self_phase)) {
      partner_material = rx0.y;
      partner_phase_mask = rx1.w;
      role = 1.0;
    } else if (self_material == rx0.y && phase_mask_satisfied(rx1.w, self_phase)) {
      partner_material = rx0.x;
      partner_phase_mask = rx1.z;
      role = 2.0;
    } else {
      continue;
    }

    let activation_k = rx0.w;
    if (rx1.y <= 0.0) {
      continue;
    }
    let contact_radius2 = rx1.y * rx1.y;
    if (using_schroeder_candidate_rows) {
      let span = schroeder_reaction_neighbor_candidate_span(particle_index);
      var candidate_start = 0u;
      var candidate_end = schroeder_reaction_neighbor_candidate_params.candidate_count;
      if (span.z != 0u) {
        candidate_start = min(span.x, schroeder_reaction_neighbor_candidate_params.candidate_count);
        let max_span_count = schroeder_reaction_neighbor_candidate_params.candidate_count - candidate_start;
        candidate_end = candidate_start + min(span.y, max_span_count);
      }
      for (var candidate_index = candidate_start; candidate_index < candidate_end; candidate_index = candidate_index + 1u) {
        let other = schroeder_reaction_neighbor_candidate_partner(particle_index, candidate_index);
        if (other >= params.particle_count) {
          continue;
        }
        best = reaction_partner_candidate(
          particle_index,
          other,
          reaction_index,
          partner_material,
          partner_phase_mask,
          role,
          activation_k,
          contact_radius2,
          self_temperature,
          self_pos,
          best
        );
      }
    } else if (reaction_particle_bin_ready()) {
      let relative_self = self_pos - vec3<f32>(
        reaction_particle_bin_params.origin_x_m,
        reaction_particle_bin_params.origin_y_m,
        reaction_particle_bin_params.origin_z_m
      );
      let center_coords = vec3<i32>(
        i32(reaction_particle_bin_coord(relative_self.x, reaction_particle_bin_params.grid_nx)),
        i32(reaction_particle_bin_coord(relative_self.y, reaction_particle_bin_params.grid_ny)),
        i32(reaction_particle_bin_coord(relative_self.z, reaction_particle_bin_params.grid_nz))
      );
      let radius_cells = min(
        i32(8),
        max(1, i32(ceil(rx1.y / reaction_particle_bin_params.cell_size_m)))
      );
      for (var dz = -radius_cells; dz <= radius_cells; dz = dz + 1) {
        let cz = center_coords.z + dz;
        if (cz < 0 || cz >= i32(reaction_particle_bin_params.grid_nz)) {
          continue;
        }
        for (var dy = -radius_cells; dy <= radius_cells; dy = dy + 1) {
          let cy = center_coords.y + dy;
          if (cy < 0 || cy >= i32(reaction_particle_bin_params.grid_ny)) {
            continue;
          }
          for (var dx = -radius_cells; dx <= radius_cells; dx = dx + 1) {
            let cx = center_coords.x + dx;
            if (cx < 0 || cx >= i32(reaction_particle_bin_params.grid_nx)) {
              continue;
            }
            let cell_index = reaction_particle_bin_cell_index(vec3<u32>(u32(cx), u32(cy), u32(cz)));
            if (cell_index >= reaction_particle_bin_params.cell_count) {
              continue;
            }
            let count = min(
              atomicLoad(&reaction_particle_bin_counts[cell_index]),
              reaction_particle_bin_params.bin_capacity
            );
            for (var slot = 0u; slot < count; slot = slot + 1u) {
              let other = reaction_particle_bin_indices[cell_index * reaction_particle_bin_params.bin_capacity + slot];
              best = reaction_partner_candidate(
                particle_index,
                other,
                reaction_index,
                partner_material,
                partner_phase_mask,
                role,
                activation_k,
                contact_radius2,
                self_temperature,
                self_pos,
                best
              );
            }
          }
        }
      }
    } else {
      for (var other = 0u; other < params.particle_count; other = other + 1u) {
        best = reaction_partner_candidate(
          particle_index,
          other,
          reaction_index,
          partner_material,
          partner_phase_mask,
          role,
          activation_k,
          contact_radius2,
          self_temperature,
          self_pos,
          best
        );
      }
    }
  }

  proposals[particle_index] = best;
}

fn resolve_particle(particle_index: u32, pair_only: bool) {
  if (particle_index >= params.particle_count) {
    return;
  }

  let proposal = proposals[particle_index];
  ${sharedAllocation ? `if (pair_only) {
    if (!all(abs(proposal) <= vec4<f32>(3.402823e38))
      || proposal.x <= f32(particle_index) || proposal.x >= f32(params.particle_count)
      || proposal.x != floor(proposal.x) || proposal.y < 0.0
      || proposal.y >= f32(params.reaction_count) || proposal.y != floor(proposal.y)) { return; }
    if (!reaction_energy_enabled(u32(proposal.y))) { return; }
  }` : ''}
  if (
    !all(vec4<bool>(
      reaction_value_finite(proposal.x),
      reaction_value_finite(proposal.y),
      reaction_value_finite(proposal.z),
      reaction_value_finite(proposal.w)
    ))
    || proposal.x < 0.0
    || proposal.x != floor(proposal.x)
    || proposal.x >= f32(params.particle_count)
    || proposal.y < 0.0
    || proposal.y != floor(proposal.y)
    || proposal.y >= f32(params.reaction_count)
    || proposal.w < 0.0
  ) {
    copy_particle(particle_index);
    return;
  }
  let partner_index = u32(proposal.x + 0.5);
  if (partner_index >= params.particle_count) {
    copy_particle(particle_index);
    return;
  }
  let partner_proposal = proposals[partner_index];
  if (
    !all(vec4<bool>(
      reaction_value_finite(partner_proposal.x),
      reaction_value_finite(partner_proposal.y),
      reaction_value_finite(partner_proposal.z),
      reaction_value_finite(partner_proposal.w)
    ))
    || partner_proposal.x < 0.0
    || partner_proposal.x != floor(partner_proposal.x)
    || u32(partner_proposal.x) != particle_index
    || partner_proposal.y != proposal.y
    || partner_proposal.w < 0.0
  ) {
    copy_particle(particle_index);
    return;
  }

  let reaction_index = u32(proposal.y + 0.5);
  if (reaction_index >= params.reaction_count) {
    copy_particle(particle_index);
    return;
  }
  let rx0 = reaction_row0(reaction_index);
  let rx1 = reaction_row1(reaction_index);
  let rx2 = reaction_row2(reaction_index);
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let pos_mass = state_pos_mass(particle_index);
  let partner_pos_mass = state_pos_mass(partner_index);
  let vel_u = state_vel_u(particle_index);
  let partner_vel_u = state_vel_u(partner_index);
  let self_thermo = thermo_row0(particle_index);
  let partner_thermo = thermo_row0(partner_index);
  // Discovery is intentionally allowed to run against immutable x_n before
  // thermal and mechanics commit. Revalidate every chemistry-sensitive field
  // against the current post-thermal state before any material/topology
  // mutation. A stale contact candidate can therefore only become a no-op.
  let self_is_a = self_thermo.x == rx0.x
    && partner_thermo.x == rx0.y
    && phase_mask_satisfied(rx1.z, self_thermo.y)
    && phase_mask_satisfied(rx1.w, partner_thermo.y);
  let self_is_b = self_thermo.x == rx0.y
    && partner_thermo.x == rx0.x
    && phase_mask_satisfied(rx1.w, self_thermo.y)
    && phase_mask_satisfied(rx1.z, partner_thermo.y);
  let pair_delta = pos_mass.xyz - partner_pos_mass.xyz;
  let current_distance2 = dot(pair_delta, pair_delta);
  let contact_radius2 = rx1.y * rx1.y;
  let expected_self_role = select(2.0, 1.0, self_is_a);
  let expected_partner_role = select(1.0, 2.0, self_is_a);
  if (
    !all(vec4<bool>(
      reaction_value_finite(pos_mass.x),
      reaction_value_finite(pos_mass.y),
      reaction_value_finite(pos_mass.z),
      reaction_value_finite(pos_mass.w)
    ))
    || !all(vec4<bool>(
      reaction_value_finite(partner_pos_mass.x),
      reaction_value_finite(partner_pos_mass.y),
      reaction_value_finite(partner_pos_mass.z),
      reaction_value_finite(partner_pos_mass.w)
    ))
    || pos_mass.w <= 0.0
    || partner_pos_mass.w <= 0.0
    || !reaction_value_finite(rx0.x)
    || !reaction_value_finite(rx0.y)
    || !reaction_value_finite(rx0.w)
    || !reaction_value_finite(rx1.y)
    || !reaction_value_finite(rx1.z)
    || !reaction_value_finite(rx1.w)
    || !reaction_value_finite(self_thermo.x)
    || !reaction_value_finite(self_thermo.y)
    || !reaction_value_finite(self_thermo.z)
    || !reaction_value_finite(partner_thermo.x)
    || !reaction_value_finite(partner_thermo.y)
    || !reaction_value_finite(partner_thermo.z)
    || !reaction_value_finite(current_distance2)
    || !reaction_value_finite(contact_radius2)
    || rx2.x != 1.0
    || rx1.y <= 0.0
    || self_is_a == self_is_b
    || proposal.z != expected_self_role
    || partner_proposal.z != expected_partner_role
    || max(self_thermo.z, partner_thermo.z) < rx0.w
    || current_distance2 > contact_radius2
  ) {
    copy_particle(particle_index);
    return;
  }
  let self_current_volume = particle_current_volume(particle_index);
  let partner_current_volume = particle_current_volume(partner_index);
  if (!(self_current_volume > 0.0) || !(partner_current_volume > 0.0)) {
    copy_particle(particle_index);
    return;
  }
  let product_term_count = u32(max(header1.x, 0.0));
  let self_term = reactant_term_for_material(reaction_index, self_thermo.x);
  let partner_term = reactant_term_for_material(reaction_index, partner_thermo.x);
  let has_stoichiometry = self_term.status == 1.0
    && partner_term.status == 1.0
    && self_term.coefficient > 0.0
    && partner_term.coefficient > 0.0
    && self_term.molar_mass > 0.0
    && partner_term.molar_mass > 0.0
    && product_term_count > 0u
    && reaction_product_terms_ready(reaction_index);

  if (!has_stoichiometry) {
    if (reaction_extended_stoichiometry_enabled()) {
      // A current-schema row with a missing, corrupt, cross-reaction, or
      // out-of-range term is a deterministic no-op. Falling through to the
      // old whole-parent conversion here destroys excess unequal-mass
      // reactant and mints product mass.
      copy_particle(particle_index);
      return;
    }
    var legacy_product_material_id = rx0.z;
    var legacy_next_mass = pos_mass.w;
    var legacy_represented_entity_count = thermo_row2(particle_index).y;
    var legacy_next_u = vel_u.w - rx1.x;
    if (product_term_count > 0u) {
      let product_term_offset = u32(max(header0.w, 0.0));
      let slot_index = select(1u, 0u, particle_index < partner_index);
      let local_term = min(slot_index, product_term_count - 1u);
      let term_index = product_term_offset + local_term;
      legacy_next_u = legacy_next_u + product_term_gauge(term_index);
      let term0 = product_term_row0(term_index);
      let term1 = product_term_row1(term_index);
      legacy_product_material_id = term0.y;
      if (product_term_count > 1u) {
        legacy_next_mass = max((pos_mass.w + partner_pos_mass.w) * term1.x, 0.0);
      }
      legacy_represented_entity_count = represented_entity_count_from_mass(
        legacy_next_mass,
        term0.w
      );
    } else if (pos_mass.w > 0.0) {
      legacy_represented_entity_count = thermo_row2(particle_index).y
        * clamp(legacy_next_mass / pos_mass.w, 0.0, 1.0);
    }
    var legacy_current_volume = self_current_volume
      * legacy_next_mass / max(pos_mass.w, 1.0e-20);
    if (product_term_count > 1u) {
      let pair_current_volume = self_current_volume
        + partner_current_volume;
      legacy_current_volume = pair_current_volume * legacy_next_mass
        / max(pos_mass.w + partner_pos_mass.w, 1.0e-20);
    }
    let legacy_written = write_product_particle(
      particle_index,
      legacy_product_material_id,
      legacy_next_mass,
      legacy_current_volume,
      legacy_next_u,
      vel_u.xyz,
      legacy_represented_entity_count,
      0.0
    );
    if (!legacy_written) {
      copy_particle(particle_index);
    }
    return;
  }

  let physical_energy = reaction_energy_enabled(reaction_index);
  if (physical_energy) {
    for (var slot = 0u; slot < 2u; slot = slot + 1u) {
      let source = select(particle_index, partner_index, slot == 1u);
      let m = source * REACTION_PARTICLE_RECORD_VEC4S + 5u;
      if (!energy_source_ready(reaction_index, thermo_row0(source), thermo_row1(source),
          thermo_row2(source), state_vel_u(source))
        || !energy_relaxed_mechanics(particle_records[m], particle_records[m + 1u],
          particle_records[m + 2u], particle_records[m + 3u], particle_records[m + 4u])) {
        copy_particle(particle_index);
        return;
      }
    }
  }
  let self_limiting_extent = pos_mass.w / max(self_term.coefficient * self_term.molar_mass, 1.0e-20);
  let partner_limiting_extent = partner_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
  // Stoichiometric availability is the CAP; the interface flux sets the rate.
  let extent_availability_mol = min(self_limiting_extent, partner_limiting_extent);
  let extent_flux_cap_mol = interface_flux_extent_cap_mol(
    pos_mass.w, self_thermo.w, self_thermo.z,
    self_term.coefficient, self_term.molar_mass, self_term.interface_flux,
    partner_pos_mass.w, partner_thermo.w, partner_thermo.z,
    partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
    params.dt_s
  );
  ${sharedAllocation ? 'var' : 'let'} extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
  let self_consumed = reaction_consumed_mass(reaction_index, pos_mass.w, extent_mol, self_term.coefficient, self_term.molar_mass);
  let partner_consumed = reaction_consumed_mass(reaction_index, partner_pos_mass.w, extent_mol, partner_term.coefficient, partner_term.molar_mass);
  if (physical_energy && (pos_mass.w - self_consumed >= pos_mass.w
    || partner_pos_mass.w - partner_consumed >= partner_pos_mass.w)) {
    copy_particle(particle_index);
    return;
  }
  ${sharedAllocation ? 'var' : 'let'} consumed_mass = self_consumed + partner_consumed;
  ${sharedAllocation ? 'var' : 'let'} raw_product_mass = product_raw_mass_sum(reaction_index, extent_mol);
  if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
    copy_particle(particle_index);
    return;
  }

  let source0_index = min(particle_index, partner_index);
  let source1_index = max(particle_index, partner_index);
  let source0_pos_mass = state_pos_mass(source0_index);
  let source1_pos_mass = state_pos_mass(source1_index);
  let source0_thermo = thermo_row0(source0_index);
  let source1_thermo = thermo_row0(source1_index);
  let source0_term = reactant_term_for_material(reaction_index, source0_thermo.x);
  let source1_term = reactant_term_for_material(reaction_index, source1_thermo.x);
  let source0_current_volume = particle_current_volume(source0_index);
  let source1_current_volume = particle_current_volume(source1_index);
  ${sharedAllocation ? `var source0_consumed = select(partner_consumed, self_consumed, source0_index == particle_index);
  var source1_consumed = select(self_consumed, partner_consumed, source0_index == particle_index);`
    : `let source0_consumed = reaction_consumed_mass(reaction_index, source0_pos_mass.w, extent_mol, source0_term.coefficient, source0_term.molar_mass);
  let source1_consumed = reaction_consumed_mass(reaction_index, source1_pos_mass.w, extent_mol, source1_term.coefficient, source1_term.molar_mass);`}
  ${sharedAllocation ? 'var' : 'let'} consumed_current_volume =
    source0_current_volume * source0_consumed
      / max(source0_pos_mass.w, 1.0e-20)
    + source1_current_volume * source1_consumed
      / max(source1_pos_mass.w, 1.0e-20);
  ${sharedAllocation ? `var source0_remaining = 0.0;
  var source1_remaining = 0.0;
  var product_mass_scale = 0.0;
  if (pair_only) {
    if (!prepare_allocated_pair(source0_index, source1_index, reaction_index, extent_mol,
        source0_consumed, source1_consumed, raw_product_mass, consumed_current_volume)) {
      reject_allocated_pair(source0_index, source1_index, 4u);
      return;
    }
    let base = pair_allocation_base(source0_index);
    let selected = pair_allocations[base + 1u];
    let allocation = pair_allocations[base + 2u];
    let remaining = pair_selected_remainder(source0_index, source1_index);
    extent_mol = selected.x;
    source0_consumed = selected.y;
    source1_consumed = selected.z;
    raw_product_mass = selected.w;
    consumed_mass = allocation.x;
    product_mass_scale = allocation.y;
    consumed_current_volume = allocation.z;
    source0_remaining = remaining.x;
    source1_remaining = remaining.y;
  } else {
    source0_remaining = max(source0_pos_mass.w - source0_consumed, 0.0);
    source1_remaining = max(source1_pos_mass.w - source1_consumed, 0.0);
    product_mass_scale = consumed_mass / raw_product_mass;
  }` : `let source0_remaining = max(source0_pos_mass.w - source0_consumed, 0.0);
  let source1_remaining = max(source1_pos_mass.w - source1_consumed, 0.0);
  let product_mass_scale = consumed_mass / raw_product_mass;`}
  let source0_free = select(source0_remaining <= max(source0_pos_mass.w, 1.0) * 1.0e-7, source0_remaining == 0.0, physical_energy);
  let source1_free = select(source1_remaining <= max(source1_pos_mass.w, 1.0) * 1.0e-7, source1_remaining == 0.0, physical_energy);
  // A freed parent that cannot host its product in place (another phase lane
  // of its lineage still holds mass) defers the whole pair: the product may
  // neither join a mixed-material lineage nor leave as a condensed product
  // event (mechanics-field mode admits gas-only product events). Both rows
  // keep their state this step.
  if ((source0_free && !reaction_row_hosts_product(source0_index))
    || (source1_free && !reaction_row_hosts_product(source1_index))) {
    ${sharedAllocation ? `if (pair_only) {
      reject_allocated_pair(source0_index, source1_index, 8u);
      return;
    }` : ''}
    copy_particle(particle_index);
    return;
  }

  // Products are born at the consumed pair's mass-weighted COM velocity.
  // Momentum accounting: unconsumed remainders keep their own velocities, so
  // total momentum consumed*v_com + sum(remainder_i*v_i) equals the pair's
  // pre-reaction momentum exactly. The old behavior (each product inherits
  // one parent's full velocity) ejected hot products from the interface at
  // the pre-contact approach speed, carrying the reaction enthalpy away and
  // starving ignition (fork9 energy audit).
  let source0_vel_u = state_vel_u(source0_index);
  let source1_vel_u = state_vel_u(source1_index);
  let source0_velocity = source0_vel_u.xyz;
  let source1_velocity = source1_vel_u.xyz;
  let product_com_velocity = (source0_velocity * source0_consumed + source1_velocity * source1_consumed)
    / max(consumed_mass, 1.0e-20);
  let consumed_total_energy =
    source0_consumed * (source0_vel_u.w + 0.5 * dot(source0_velocity, source0_velocity))
    + source1_consumed * (source1_vel_u.w + 0.5 * dot(source1_velocity, source1_velocity));
  // Changing two reactant velocities to one COM velocity is an inelastic
  // merge. Preserve total energy by thermalizing the relative kinetic energy;
  // rx1.x is specific reaction enthalpy per kg of products (negative when
  // exothermic), so subtracting it adds released chemical heat.
  // Spectator residues (heat-proxy route) take their own sensible energy; the
  // real products share the rest, so energy is conserved and the reaction heat
  // goes to the real products as in the species reaction.
  var spectator_mass = 0.0;
  var spectator_energy = 0.0;
  if (!physical_energy) {
    for (var spectator_local = 0u; spectator_local < product_term_count; spectator_local = spectator_local + 1u) {
      let spectator_term_index = u32(max(header0.w, 0.0)) + spectator_local;
      let spectator = product_term_spectator(spectator_term_index);
      if (spectator.x != 1.0) { continue; }
      let spectator_term0 = product_term_row0(spectator_term_index);
      let term_mass = extent_mol * spectator_term0.z * spectator_term0.w * product_mass_scale;
      spectator_mass = spectator_mass + term_mass;
      spectator_energy = spectator_energy + term_mass * spectator_specific_energy(
        spectator, source0_thermo.x, source0_vel_u.w, source1_vel_u.w
      );
    }
  }
  let product_u = (
    consumed_total_energy
    - rx1.x * consumed_mass
    - 0.5 * consumed_mass * dot(product_com_velocity, product_com_velocity)
    - spectator_energy
  ) / max(consumed_mass - spectator_mass, 1.0e-20);
  var product_temperature = vec2<f32>(0.0);
  if (physical_energy) {
    product_temperature = energy_product_temperature(reaction_index, ${sharedAllocation ? 'source0_index, ' : ''}source0_thermo.x, source1_thermo.x,
      source0_consumed, source1_consumed, source0_vel_u, source1_vel_u, extent_mol, ${sharedAllocation ? '' : 'product_mass_scale, '}product_com_velocity);
    if (product_temperature.y != 1.0) {
      ${sharedAllocation ? `if (pair_only) {
        reject_allocated_pair(source0_index, source1_index, 5u);
        return;
      }` : ''}
      copy_particle(particle_index);
      return;
    }
  }
  // Validate every product lane against one deterministic source row before
  // either reacting invocation mutates. A corrupt phase/mechanics record
  // therefore rejects the pair atomically rather than publishing one product.
  for (var product_local = 0u; product_local < product_term_count; product_local = product_local + 1u) {
    let product_term_index = u32(max(header0.w, 0.0)) + product_local;
    let product_term0 = product_term_row0(product_term_index);
    let product_term1 = product_term_row1(product_term_index);
    ${sharedAllocation ? `var product_mass = 0.0;
    if (pair_only) {
      product_mass = pair_selected_product_mass(source0_index, reaction_index, product_term_index);
    } else {
      product_mass = extent_mol * product_term0.z * product_term0.w * product_mass_scale;
    }` : `let product_mass = extent_mol * product_term0.z * product_term0.w
      * product_mass_scale;`}
    let product_current_volume = consumed_current_volume
      * product_mass / max(consumed_mass, 1.0e-20);
    var product_energy_state = vec4<f32>(product_u + product_term_gauge(product_term_index), 0.0, 1.0, 0.0);
    let validated_spectator = product_term_spectator(product_term_index);
    if (!physical_energy && validated_spectator.x == 1.0) {
      product_energy_state.x = spectator_specific_energy(
        validated_spectator, source0_thermo.x, source0_vel_u.w, source1_vel_u.w
      );
    }
    if (physical_energy) {
      product_energy_state = energy_product_state(reaction_index, product_term_index, product_temperature.x);
    }
    if (
      product_term1.w != 1.0
      || product_energy_state.z != 1.0
      || (physical_energy && !reaction_value_finite(represented_entity_count_from_mass(product_mass, product_term0.w)))
      || !product_output_ready(
        source0_index,
        product_term0.y,
        product_mass,
        product_current_volume,
        product_energy_state.x,
        product_com_velocity,
        product_energy_state.w
      )
    ) {
      ${sharedAllocation ? `if (pair_only) {
        reject_allocated_pair(source0_index, source1_index, 6u);
        return;
      }` : ''}
      copy_particle(particle_index);
      return;
    }
  }

  ${sharedAllocation ? `if (pair_only) {
    commit_allocated_pair(source0_index, source1_index, reaction_index,
      product_temperature.x, product_com_velocity);
    return;
  }` : ''}

  var emits_product = false;
  var local_product_slot = 0u;
  var emitted_product_mass = 0.0;
  if (product_term_count == 1u) {
    if (particle_index == source0_index && source0_free) {
      emits_product = true;
      emitted_product_mass = select(consumed_mass, source0_consumed, source1_free);
    }
    if (particle_index == source1_index && source1_free) {
      emits_product = true;
      local_product_slot = select(0u, 1u, source0_free);
      emitted_product_mass = select(consumed_mass, source1_consumed, source0_free);
    }
  } else {
    if (particle_index == source0_index && source0_free) {
      emits_product = true;
      local_product_slot = 0u;
    }
    if (particle_index == source1_index && source1_free) {
      emits_product = true;
      local_product_slot = select(0u, 1u, source0_free);
    }
    if (emits_product && local_product_slot < product_term_count) {
      let product_term = product_term_for_parent_slot(reaction_index, local_product_slot);
      emitted_product_mass = extent_mol * product_term.coefficient * product_term.molar_mass * product_mass_scale;
    }
  }

  if (emits_product) {
    // Freed parent slots place condensed products first, then gas products
    // (product_term_for_parent_slot): the H2/gas term that previously only
    // existed as a frozen product event becomes a real eos=2 particle here.
    let product_term = product_term_for_parent_slot(reaction_index, local_product_slot);
    if (product_term.status == 1.0 && product_term.material_id > 0.0 && emitted_product_mass > 0.0) {
      let emitted_product_current_volume = consumed_current_volume
        * emitted_product_mass / max(consumed_mass, 1.0e-20);
      var product_energy_state = vec4<f32>(product_u + product_term_gauge(product_term.term_index), 0.0, 1.0, 0.0);
      let emitted_spectator = product_term_spectator(product_term.term_index);
      if (!physical_energy && emitted_spectator.x == 1.0) {
        product_energy_state.x = spectator_specific_energy(
          emitted_spectator, source0_thermo.x, source0_vel_u.w, source1_vel_u.w
        );
      }
      if (physical_energy) {
        product_energy_state = energy_product_state(reaction_index, product_term.term_index, product_temperature.x);
      }
      let product_written = write_product_particle(
        particle_index,
        product_term.material_id,
        emitted_product_mass,
        emitted_product_current_volume,
        product_energy_state.x,
        product_com_velocity,
        represented_entity_count_from_mass(
          emitted_product_mass,
          product_term.molar_mass
        ),
        product_energy_state.w
      );
      if (product_written) {
        return;
      }
      copy_particle(particle_index);
      return;
    }
  }

  let self_remaining = max(pos_mass.w - self_consumed, 0.0);
  copy_particle_with_mass(particle_index, self_remaining, physical_energy);
}

@compute @workgroup_size(64)
fn resolve(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.particle_count) { return; }
  ${sharedAllocation ? `let proposal = proposals[id.x];
  if (proposal.y >= 0.0 && proposal.y < f32(params.reaction_count)
    && proposal.y == floor(proposal.y) && reaction_energy_enabled(u32(proposal.y))) {
    // The pair dispatch already selected BOTH physical outputs, including
    // rejection. Do not overwrite either endpoint with an independent result.
    return;
  }` : ''}
  resolve_particle(id.x, false);
}
${sharedAllocation ? `
@compute @workgroup_size(64)
fn allocate_pairs(@builtin(global_invocation_id) id: vec3<u32>) {
  resolve_particle(id.x, true);
}` : ''}

@compute @workgroup_size(64)
fn unpack(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }
  let base = particle_index * REACTION_PARTICLE_RECORD_VEC4S;
  unpack_sph_state[particle_index * 2u] = out_particle_records[base];
  unpack_sph_state[particle_index * 2u + 1u] = out_particle_records[base + 1u];
  unpack_sph_thermo[particle_index * 3u] = out_particle_records[base + 2u];
  unpack_sph_thermo[particle_index * 3u + 1u] = out_particle_records[base + 3u];
  unpack_sph_thermo[particle_index * 3u + 2u] = out_particle_records[base + 4u];
  let mechanics_base = particle_index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    unpack_mls_mechanics[mechanics_base + row] = out_particle_records[base + 5u + row];
  }
}
`;

}
export const sphReactionStepWgsl = createSphReactionStepWgsl();

export const sphReactionProductEventCompactWgsl = `
struct ProductEventCompactParams {
  row_count: u32,
  row_stride_vec4: u32,
  group_count: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> source_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> compact_events: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> compact_counts: array<u32>;
@group(0) @binding(3) var<uniform> params: ProductEventCompactParams;
@group(0) @binding(4) var<storage, read_write> placement_completion_receipt: array<u32>;
@group(0) @binding(5) var<storage, read_write> compact_local_prefix_flags: array<u32>;
@group(0) @binding(6) var<storage, read_write> compact_group_counts: array<u32>;
@group(0) @binding(7) var<storage, read_write> compact_group_offsets: array<u32>;

var<workgroup> compact_scan_rows: array<u32, 64>;

// Single-invocation loop keeps compacted row order identical to source order so
// downstream f32 accumulations over events stay deterministic across runs.
@compute @workgroup_size(1)
fn compact_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  let stride = params.row_stride_vec4;
  if (stride < 8u) {
    return;
  }
  var live_rows = 0u;
  for (var row = 0u; row < params.row_count; row = row + 1u) {
    let base = row * stride;
    let event_row2 = source_events[base + 2u];
    let unplaced_mass_kg = source_events[base + 3u].y;
    let event_row4 = source_events[base + 4u];
    let event_row7 = source_events[base + 7u];
    let status = event_row4.z;
    let phase_id = event_row2.w;
    let rest_density = event_row4.y;
    let mechanics_status = event_row7.z;
    if (
      status != 1.0
      || mechanics_status != 1.0
      || !(phase_id > 0.0)
      || !(rest_density > 0.0)
      || unplaced_mass_kg <= 0.0
    ) {
      continue;
    }
    let out_base = live_rows * stride;
    for (var component = 0u; component < stride; component = component + 1u) {
      compact_events[out_base + component] = source_events[base + component];
    }
    live_rows = live_rows + 1u;
  }
  compact_counts[0] = live_rows;
}

// Compatibility-only compactor for callers without canonical placement
// authority. The authenticated Slice 8 route never creates this pipeline.
@compute @workgroup_size(1)
fn compact_placement_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  let stride = params.row_stride_vec4;
  if (stride < 8u) {
    compact_counts[0] = 0u;
    return;
  }
  var live_rows = 0u;
  for (var row = 0u; row < params.row_count; row = row + 1u) {
    let base = row * stride;
    let product_mass_kg = max(source_events[base].w, 0.0);
    let unplaced_mass_kg = max(source_events[base + 3u].y, 0.0);
    if (!(product_mass_kg > 0.0 || unplaced_mass_kg > 0.0)) { continue; }
    let out_base = live_rows * stride;
    for (var component = 0u; component < stride; component = component + 1u) {
      compact_events[out_base + component] = source_events[base + component];
    }
    live_rows = live_rows + 1u;
  }
  compact_counts[0] = live_rows;
}

// Count live placement rows and compute an exclusive stable prefix inside each
// 64-row group. This replaces the old single invocation N x product-term
// compaction scan. The high bit stores liveness; the remaining bits store the
// group-local exclusive prefix.
@compute @workgroup_size(64)
fn count_placement_rows(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = global_id.x;
  let lane = local_id.x;
  var live = 0u;
  let stride = params.row_stride_vec4;
  if (row < params.row_count && stride >= 8u) {
    let base = row * stride;
    let product_mass_kg = max(source_events[base].w, 0.0);
    let unplaced_mass_kg = max(source_events[base + 3u].y, 0.0);
    live = select(0u, 1u, product_mass_kg > 0.0 || unplaced_mass_kg > 0.0);
  }
  compact_scan_rows[lane] = live;
  workgroupBarrier();
  var offset = 1u;
  loop {
    if (offset >= 64u) { break; }
    var preceding = 0u;
    if (lane >= offset) {
      preceding = compact_scan_rows[lane - offset];
    }
    workgroupBarrier();
    let current = compact_scan_rows[lane];
    workgroupBarrier();
    compact_scan_rows[lane] = current + preceding;
    workgroupBarrier();
    offset = offset * 2u;
  }
  if (row < params.row_count && row < arrayLength(&compact_local_prefix_flags)) {
    let inclusive = compact_scan_rows[lane];
    let exclusive = inclusive - live;
    compact_local_prefix_flags[row] = exclusive | select(0u, 0x80000000u, live != 0u);
  }
  if (lane == 63u && workgroup_id.x < arrayLength(&compact_group_counts)) {
    compact_group_counts[workgroup_id.x] = compact_scan_rows[63u];
  }
  if (
    row == 0u
    && arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u
  ) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}] = 1u;
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionInputVisitCount}] = params.row_count;
  }
}

var<workgroup> compact_group_scan_carry: u32;
var<workgroup> compact_group_scan_overflow: atomic<u32>;

// Workgroup-parallel multi-tile scan over the group totals (ceil(N/64)).
@compute @workgroup_size(64)
fn scan_placement_row_groups(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (workgroup_id.x != 0u) { return; }
  let lane = local_id.x;
  let group_count = min(params.group_count, arrayLength(&compact_group_counts));
  let offsets_len = arrayLength(&compact_group_offsets);
  if (lane == 0u) {
    compact_group_scan_carry = 0u;
    atomicStore(&compact_group_scan_overflow, 0u);
  }
  workgroupBarrier();
  let tiles = (group_count + 63u) / 64u;
  for (var tile = 0u; tile < tiles; tile = tile + 1u) {
    let group = tile * 64u + lane;
    var val = 0u;
    if (group < group_count) {
      if (group >= offsets_len) {
        atomicAdd(&compact_group_scan_overflow, 1u);
      } else {
        val = compact_group_counts[group];
      }
    }
    compact_scan_rows[lane] = val;
    workgroupBarrier();
    var offset = 1u;
    loop {
      if (offset >= 64u) { break; }
      var preceding = 0u;
      if (lane >= offset) { preceding = compact_scan_rows[lane - offset]; }
      workgroupBarrier();
      let current = compact_scan_rows[lane];
      workgroupBarrier();
      compact_scan_rows[lane] = current + preceding;
      workgroupBarrier();
      offset = offset * 2u;
    }
    let carry = compact_group_scan_carry;
    if (group < group_count && group < offsets_len) {
      let excl = carry + (compact_scan_rows[lane] - val);
      let incl = carry + compact_scan_rows[lane];
      compact_group_offsets[group] = min(excl, params.row_count);
      if (incl < excl || incl > params.row_count) {
        atomicAdd(&compact_group_scan_overflow, 1u);
      }
    }
    workgroupBarrier();
    if (lane == 63u) {
      let next_carry = carry + compact_scan_rows[63u];
      if (next_carry < carry || next_carry > params.row_count) {
        atomicAdd(&compact_group_scan_overflow, 1u);
      }
      compact_group_scan_carry = min(next_carry, params.row_count);
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    let total = compact_group_scan_carry;
    let overflow = atomicLoad(&compact_group_scan_overflow);
    compact_counts[0] = select(total, 0u, overflow != 0u);
    if (arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}] = 1u;
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}] = compact_counts[0];
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionLiveFlagCount}] = total;
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}] = overflow;
    }
  }
}

// Scatter every live row independently. group offset + local exclusive prefix
// is the stable source-order destination index.
@compute @workgroup_size(64)
fn scatter_placement_rows(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = global_id.x;
  if (row == 0u && arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}] = 1u;
  }
  if (
    row >= params.row_count
    || row >= arrayLength(&compact_local_prefix_flags)
    || workgroup_id.x >= arrayLength(&compact_group_offsets)
  ) {
    return;
  }
  let packed_prefix = compact_local_prefix_flags[row];
  if ((packed_prefix & 0x80000000u) == 0u) { return; }
  let destination = compact_group_offsets[workgroup_id.x]
    + (packed_prefix & 0x7fffffffu);
  if (destination >= compact_counts[0]) { return; }
  let stride = params.row_stride_vec4;
  let source_base = row * stride;
  let destination_base = destination * stride;
  for (var component = 0u; component < stride; component = component + 1u) {
    compact_events[destination_base + component] = source_events[source_base + component];
  }
}
`;

/** Exact event companions use the SAME stable prefix as projected events.
 * The legacy export above remains byte-identical. Exact variants require an
 * 8-byte compact count [live,error], the existing 16-byte params with stride8
 * and reserved0, and bindings8/9 for aligned companion subranges. */
export function createSphReactionProductEventCompactWgsl({ exactCompanion = null } = {}) {
  if (exactCompanion == null) return sphReactionProductEventCompactWgsl;
  const n = exactCompanion.massWordCount;
  if (!Number.isSafeInteger(n) || n < 1 || n > 66) throw new RangeError('Exact event companion mass word count must be in [1,66]');
  return /* wgsl */ `
struct ProductEventCompactParams { row_count: u32, row_stride_vec4: u32, group_count: u32, reserved0: u32 }
// Preserve projected f32 bits, including signed zero/subnormals, without f32 evaluation.
@group(0) @binding(0) var<storage, read> source_events: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read_write> compact_events: array<vec4<u32>>;
@group(0) @binding(2) var<storage, read_write> compact_counts: array<u32>;
@group(0) @binding(3) var<uniform> params: ProductEventCompactParams;
@group(0) @binding(4) var<storage, read_write> placement_completion_receipt: array<u32>;
@group(0) @binding(5) var<storage, read_write> compact_local_prefix_flags: array<u32>;
@group(0) @binding(6) var<storage, read_write> compact_group_counts: array<u32>;
@group(0) @binding(7) var<storage, read_write> compact_group_offsets: array<u32>;
@group(0) @binding(8) var<storage, read> source_companions: array<u32>;
@group(0) @binding(9) var<storage, read_write> compact_companions: array<u32>;
const ECMP_MASS_WORDS: u32 = ${n}u;
const ECMP_STRIDE: u32 = ${8 + 3 * n}u;
var<workgroup> exact_compact_scan: array<u32,64>;
var<workgroup> exact_compact_error: atomic<u32>;
fn exact_compact_layout_ready() -> bool {
  let expected_groups = params.row_count / 64u + select(0u,1u,params.row_count % 64u != 0u);
  return params.row_stride_vec4 == 8u && params.reserved0 == 0u
    && params.group_count == expected_groups
    && arrayLength(&compact_counts) >= 2u
    && arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u
    && arrayLength(&source_events) % 8u == 0u && arrayLength(&compact_events) % 8u == 0u
    && arrayLength(&source_companions) % ECMP_STRIDE == 0u
    && arrayLength(&compact_companions) % ECMP_STRIDE == 0u
    && arrayLength(&source_events) / 8u == arrayLength(&source_companions) / ECMP_STRIDE
    && arrayLength(&compact_events) / 8u == arrayLength(&compact_companions) / ECMP_STRIDE
    && params.row_count <= arrayLength(&source_events) / 8u
    && params.row_count <= arrayLength(&compact_local_prefix_flags)
    && params.group_count <= arrayLength(&compact_group_counts)
    && params.group_count <= arrayLength(&compact_group_offsets);
}
// 0=inactive,1=live,2=malformed. Activity never depends on projected f32 mass.
fn exact_compact_row_status(row: u32) -> u32 {
  let at = row * ECMP_STRIDE;
  let activity = source_companions[at + 4u]; let ready = source_companions[at + 5u];
  if (activity > 1u || ready > 1u || source_companions[at + 6u] != 0u || source_companions[at + 7u] != 0u) { return 2u; }
  if (ready == 0u && (source_companions[at] != 0u || source_companions[at + 1u] != 0u
      || source_companions[at + 2u] != 0u || source_companions[at + 3u] != 0u || activity != 0u)) { return 2u; }
  if (ready == 1u && (source_companions[at] == 0xffffffffu || source_companions[at + 1u] == 0xffffffffu
      || source_companions[at + 2u] < 2u || source_companions[at + 2u] == 0xffffffffu
      || source_companions[at + 3u] == 0u || source_companions[at + 3u] == 0xffffffffu)) { return 2u; }
  var nonzero = 0u; var carry = 0u;
  for (var word = 0u; word < ECMP_MASS_WORDS; word++) {
    let mass = source_companions[at + 8u + word]; nonzero |= mass;
    let direct = source_companions[at + 8u + ECMP_MASS_WORDS + word];
    let residual = source_companions[at + 8u + 2u * ECMP_MASS_WORDS + word];
    let first = direct + residual; let second = first + carry;
    carry = select(0u,1u,first < direct || second < first);
    if (second != mass) { return 2u; }
  }
  if (carry != 0u || activity != select(0u,1u,nonzero != 0u) || (activity != 0u && ready != 1u)) { return 2u; }
  return activity;
}
@compute @workgroup_size(64)
fn count_placement_rows(@builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let row = global_id.x; let lane = local_id.x;
  if (lane == 0u) { atomicStore(&exact_compact_error,0u); }
  workgroupBarrier();
  let layout_ready = exact_compact_layout_ready(); var live = 0u;
  if (!layout_ready) { atomicOr(&exact_compact_error,1u); }
  else if (row < params.row_count) {
    let status = exact_compact_row_status(row);
    if (status == 2u) { atomicOr(&exact_compact_error,1u); } else { live = status; }
  }
  exact_compact_scan[lane] = live; workgroupBarrier();
  var offset = 1u;
  loop {
    if (offset >= 64u) { break; }
    var preceding = 0u; if (lane >= offset) { preceding = exact_compact_scan[lane-offset]; }
    workgroupBarrier(); let current = exact_compact_scan[lane]; workgroupBarrier();
    exact_compact_scan[lane] = current + preceding; workgroupBarrier(); offset *= 2u;
  }
  if (row < params.row_count && row < arrayLength(&compact_local_prefix_flags)) {
    compact_local_prefix_flags[row] = (exact_compact_scan[lane]-live) | select(0u,0x80000000u,live != 0u);
  }
  if (lane == 63u && group_id.x < arrayLength(&compact_group_counts)) {
    compact_group_counts[group_id.x] = exact_compact_scan[63u] | select(0u,0x80000000u,atomicLoad(&exact_compact_error) != 0u);
  }
  if (row == 0u && arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}u] = 1u;
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionInputVisitCount}u] = params.row_count;
  }
}
var<workgroup> exact_compact_carry: u32;
@compute @workgroup_size(64)
fn scan_placement_row_groups(@builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wid: vec3<u32>) {
  if (wid.x != 0u) { return; }
  let lane = lid.x;
  let ready = exact_compact_layout_ready();
  if (lane == 0u) {
    exact_compact_carry = 0u;
    atomicStore(&exact_compact_error, select(1u, 0u, ready));
  }
  workgroupBarrier();
  let group_count = select(0u, params.group_count, ready);
  let tiles = (group_count + 63u) / 64u;
  for (var tile = 0u; tile < tiles; tile = tile + 1u) {
    let group = tile * 64u + lane;
    var count = 0u;
    if (group < group_count) {
      let packed = compact_group_counts[group];
      count = packed & 0x7fffffffu;
      let remaining = params.row_count - group * 64u;
      if ((packed & 0x80000000u) != 0u || count > min(64u, remaining)) {
        atomicOr(&exact_compact_error, 1u);
      }
    }
    exact_compact_scan[lane] = count;
    workgroupBarrier();
    var offset = 1u;
    loop {
      if (offset >= 64u) { break; }
      var preceding = 0u; if (lane >= offset) { preceding = exact_compact_scan[lane - offset]; }
      workgroupBarrier(); let current = exact_compact_scan[lane]; workgroupBarrier();
      exact_compact_scan[lane] = current + preceding; workgroupBarrier(); offset *= 2u;
    }
    let carry = exact_compact_carry;
    if (group < group_count) {
      let excl = carry + (exact_compact_scan[lane] - count);
      let incl = carry + exact_compact_scan[lane];
      compact_group_offsets[group] = excl;
      if (incl < excl || incl > params.row_count) { atomicOr(&exact_compact_error, 1u); }
    }
    workgroupBarrier();
    if (lane == 63u) {
      let next_carry = carry + exact_compact_scan[63u];
      if (next_carry < carry || next_carry > params.row_count) { atomicOr(&exact_compact_error, 1u); }
      exact_compact_carry = next_carry;
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    let total = exact_compact_carry;
    if (ready && total > arrayLength(&compact_events) / 8u) { atomicOr(&exact_compact_error, 1u); }
    let error = atomicLoad(&exact_compact_error);
    if (arrayLength(&compact_counts) > 0u) { compact_counts[0u] = select(total,0u,error != 0u); }
    if (arrayLength(&compact_counts) > 1u) { compact_counts[1u] = error; }
    if (arrayLength(&placement_completion_receipt) >= ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}u] = 1u;
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}u] = select(total,0u,error != 0u);
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionLiveFlagCount}u] = total;
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}u] = error;
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}u] = 0u;
    }
  }
}
@compute @workgroup_size(64)
fn scatter_placement_rows(@builtin(global_invocation_id) id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  if (!exact_compact_layout_ready() || compact_counts[1u] != 0u) { return; }
  if (id.x == 0u) { placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}u] = 1u; }
  if (id.x >= params.row_count) { return; }
  let prefix = compact_local_prefix_flags[id.x]; if ((prefix & 0x80000000u) == 0u) { return; }
  let dest = compact_group_offsets[group_id.x] + (prefix & 0x7fffffffu);
  if (dest >= compact_counts[0u]) { return; }
  for (var component = 0u; component < 8u; component++) {
    compact_events[dest*8u+component] = source_events[id.x*8u+component];
  }
  for (var word = 0u; word < ECMP_STRIDE; word++) {
    compact_companions[dest*ECMP_STRIDE+word] = source_companions[id.x*ECMP_STRIDE+word];
  }
}
`;
}

// Resident product history is append-only after product placement. This
// kernel filters each new source before appending it to a stable live prefix,
// so the hot loop never needs to map a compacted count. Each published logical
// view owns an immutable aligned control record; later views may share the
// data buffer without widening an older view's readable prefix.
export const sphResidentProductHistoryFilteredAppendWgsl = `
struct ResidentProductHistoryAppendParams {
  source_a_row_count: u32,
  source_b_row_count: u32,
  row_capacity: u32,
  row_stride_vec4: u32,
  reuse_parent_prefix: u32,
  source_a_uses_parent_count: u32,
  expected_parent_generation: u32,
  expected_parent_seal: u32,
  next_generation: u32,
  next_seal: u32,
  expected_parent_row_capacity: u32,
  expected_parent_row_stride_vec4: u32,
};

@group(0) @binding(0) var<storage, read_write> history_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_a_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_b_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> parent_control: array<u32>;
@group(0) @binding(4) var<storage, read_write> next_control: array<u32>;
@group(0) @binding(5) var<uniform> params: ResidentProductHistoryAppendParams;

const HISTORY_CONTROL_MAGIC: u32 = 0x50484731u;
const HISTORY_CONTROL_VERSION: u32 = 1u;
const HISTORY_CONTROL_READY: u32 = 1u;
const HISTORY_CONTROL_FAILED: u32 = 0x80000000u;
const HISTORY_ERROR_PARENT: u32 = 1u;
const HISTORY_ERROR_SOURCE: u32 = 2u;
const HISTORY_ERROR_CAPACITY: u32 = 4u;

fn history_source_row_live(
  source_kind: u32,
  row: u32,
  stride: u32
) -> bool {
  let base = row * stride;
  if (source_kind == 0u) {
    let bound = arrayLength(&source_a_rows);
    if (stride < 8u || base > bound || stride > bound - base) {
      return false;
    }
    let row2 = source_a_rows[base + 2u];
    let row3 = source_a_rows[base + 3u];
    let row4 = source_a_rows[base + 4u];
    let row7 = source_a_rows[base + 7u];
    return row4.z == 1.0
      && row7.z == 1.0
      && row2.w > 0.0
      && row4.y > 0.0
      && row3.y > 0.0;
  }
  let bound = arrayLength(&source_b_rows);
  if (stride < 8u || base > bound || stride > bound - base) {
    return false;
  }
  let row2 = source_b_rows[base + 2u];
  let row3 = source_b_rows[base + 3u];
  let row4 = source_b_rows[base + 4u];
  let row7 = source_b_rows[base + 7u];
  return row4.z == 1.0
    && row7.z == 1.0
    && row2.w > 0.0
    && row4.y > 0.0
    && row3.y > 0.0;
}

fn history_source_row_valid(
  source_kind: u32,
  row: u32,
  stride: u32
) -> bool {
  return true;
}

fn history_fail(error: u32) {
  if (arrayLength(&next_control) < 12u) { return; }
  next_control[0u] = HISTORY_CONTROL_MAGIC;
  next_control[1u] = HISTORY_CONTROL_VERSION;
  next_control[2u] = HISTORY_CONTROL_FAILED;
  next_control[3u] = 0u;
  next_control[4u] = params.row_capacity;
  next_control[5u] = params.row_stride_vec4;
  next_control[6u] = params.next_generation;
  next_control[7u] = params.next_seal;
  next_control[8u] = 0u;
  next_control[9u] = 1u;
  next_control[10u] = 1u;
  next_control[11u] = error;
}

const HISTORY_WG_SIZE: u32 = 256u;
var<workgroup> wg_abort: u32;
var<workgroup> wg_source_a_count: u32;
var<workgroup> wg_source_b_count: u32;
var<workgroup> wg_base_count: u32;
var<workgroup> wg_stride: u32;
var<workgroup> wg_capacity: u32;
var<workgroup> wg_total_live: u32;
var<workgroup> wg_invalid: atomic<u32>;
var<workgroup> wg_scan: array<u32, 256>;
var<workgroup> wg_live_rows: array<u32, 256>;

@compute @workgroup_size(256)
fn append_filtered_sources(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (workgroup_id.x != 0u) { return; }
  let lid = local_id.x;
  if (lid == 0u) {
    wg_abort = 0u;
    atomicStore(&wg_invalid, 0u);
    if (
      arrayLength(&parent_control) < 12u
      || arrayLength(&next_control) < 12u
      || parent_control[0u] != HISTORY_CONTROL_MAGIC
      || parent_control[1u] != HISTORY_CONTROL_VERSION
      || parent_control[2u] != HISTORY_CONTROL_READY
      || parent_control[4u] != params.expected_parent_row_capacity
      || parent_control[5u] != params.expected_parent_row_stride_vec4
      || parent_control[6u] != params.expected_parent_generation
      || parent_control[7u] != params.expected_parent_seal
      || params.expected_parent_row_stride_vec4
        != params.row_stride_vec4
      || parent_control[3u] > params.expected_parent_row_capacity
    ) {
      history_fail(HISTORY_ERROR_PARENT);
      wg_abort = 1u;
    } else {
      let stride = params.row_stride_vec4;
      let capacity = params.row_capacity;
      if (
        stride < 8u
        || capacity == 0u
        || capacity > arrayLength(&history_rows) / stride
      ) {
        history_fail(HISTORY_ERROR_CAPACITY);
        wg_abort = 1u;
      } else {
        let parent_count = parent_control[3u];
        let source_a_count = select(
          params.source_a_row_count,
          parent_count,
          params.source_a_uses_parent_count == 1u
        );
        if (
          source_a_count > arrayLength(&source_a_rows) / stride
          || params.source_b_row_count > arrayLength(&source_b_rows) / stride
        ) {
          history_fail(HISTORY_ERROR_SOURCE);
          wg_abort = 1u;
        } else {
          wg_source_a_count = source_a_count;
          wg_source_b_count = params.source_b_row_count;
          wg_base_count = select(
            0u,
            parent_count,
            params.reuse_parent_prefix == 1u
          );
          wg_stride = stride;
          wg_capacity = capacity;
        }
      }
    }
  }
  if (workgroupUniformLoad(&wg_abort) != 0u) { return; }
  let source_a_count = workgroupUniformLoad(&wg_source_a_count);
  let source_b_count = workgroupUniformLoad(&wg_source_b_count);
  let base_count = workgroupUniformLoad(&wg_base_count);
  let stride = workgroupUniformLoad(&wg_stride);
  let capacity = workgroupUniformLoad(&wg_capacity);

  var local_live = 0u;
  for (var row = lid; row < source_a_count; row = row + HISTORY_WG_SIZE) {
    if (!history_source_row_valid(0u, row, stride)) {
      atomicStore(&wg_invalid, 1u);
    } else if (history_source_row_live(0u, row, stride)) {
      local_live = local_live + 1u;
    }
  }
  for (var row = lid; row < source_b_count; row = row + HISTORY_WG_SIZE) {
    if (!history_source_row_valid(1u, row, stride)) {
      atomicStore(&wg_invalid, 1u);
    } else if (history_source_row_live(1u, row, stride)) {
      local_live = local_live + 1u;
    }
  }
  wg_scan[lid] = local_live;
  workgroupBarrier();
  for (var offset = HISTORY_WG_SIZE >> 1u; offset > 0u; offset = offset >> 1u) {
    if (lid < offset) {
      wg_scan[lid] = wg_scan[lid] + wg_scan[lid + offset];
    }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let invalid = atomicLoad(&wg_invalid);
    let appended_count = wg_scan[0u];
    wg_total_live = appended_count;
    if (invalid != 0u) {
      history_fail(HISTORY_ERROR_SOURCE);
      wg_abort = 1u;
    } else if (appended_count > capacity || base_count > capacity - appended_count) {
      history_fail(HISTORY_ERROR_CAPACITY);
      wg_abort = 1u;
    }
  }
  if (workgroupUniformLoad(&wg_abort) != 0u) { return; }

  let total_live = workgroupUniformLoad(&wg_total_live);
  var destination = base_count;
  if (total_live > 0u) {
    for (var chunk = 0u; chunk < source_a_count; chunk = chunk + HISTORY_WG_SIZE) {
      let row = chunk + lid;
      let is_live = row < source_a_count && history_source_row_live(0u, row, stride);
      let val = select(0u, 1u, is_live);
      wg_scan[lid] = val;
      workgroupBarrier();
      var s = val;
      for (var d = 1u; d < HISTORY_WG_SIZE; d = d << 1u) {
        var addend = 0u;
        if (lid >= d) { addend = wg_scan[lid - d]; }
        workgroupBarrier();
        s = s + addend;
        wg_scan[lid] = s;
        workgroupBarrier();
      }
      let chunk_total = wg_scan[HISTORY_WG_SIZE - 1u];
      if (is_live) {
        wg_live_rows[s - 1u] = row;
      }
      workgroupBarrier();
      let copy_vec4s = chunk_total * stride;
      for (var k = lid; k < copy_vec4s; k = k + HISTORY_WG_SIZE) {
        let item = k / stride;
        let comp = k - item * stride;
        let src_row = wg_live_rows[item];
        history_rows[(destination + item) * stride + comp] =
          source_a_rows[src_row * stride + comp];
      }
      destination = destination + chunk_total;
      workgroupBarrier();
    }
    for (var chunk = 0u; chunk < source_b_count; chunk = chunk + HISTORY_WG_SIZE) {
      let row = chunk + lid;
      let is_live = row < source_b_count && history_source_row_live(1u, row, stride);
      let val = select(0u, 1u, is_live);
      wg_scan[lid] = val;
      workgroupBarrier();
      var s = val;
      for (var d = 1u; d < HISTORY_WG_SIZE; d = d << 1u) {
        var addend = 0u;
        if (lid >= d) { addend = wg_scan[lid - d]; }
        workgroupBarrier();
        s = s + addend;
        wg_scan[lid] = s;
        workgroupBarrier();
      }
      let chunk_total = wg_scan[HISTORY_WG_SIZE - 1u];
      if (is_live) {
        wg_live_rows[s - 1u] = row;
      }
      workgroupBarrier();
      let copy_vec4s = chunk_total * stride;
      for (var k = lid; k < copy_vec4s; k = k + HISTORY_WG_SIZE) {
        let item = k / stride;
        let comp = k - item * stride;
        let src_row = wg_live_rows[item];
        history_rows[(destination + item) * stride + comp] =
          source_b_rows[src_row * stride + comp];
      }
      destination = destination + chunk_total;
      workgroupBarrier();
    }
  }
  if (lid == 0u) {
    next_control[0u] = HISTORY_CONTROL_MAGIC;
    next_control[1u] = HISTORY_CONTROL_VERSION;
    next_control[2u] = HISTORY_CONTROL_READY;
    next_control[3u] = destination;
    next_control[4u] = capacity;
    next_control[5u] = stride;
    next_control[6u] = params.next_generation;
    next_control[7u] = params.next_seal;
    next_control[8u] = (destination + 63u) / 64u;
    next_control[9u] = 1u;
    next_control[10u] = 1u;
    next_control[11u] = 0u;
  }
}
`;

// Places unplaced product-event mass into spare (zero-mass) particle slots so
// gas products become real mechanics citizens instead of immovable event
// sources. Single-invocation deterministic loop (same policy as the event
// compactor): event order and slot-claim order are stable across runs.
// Conservation: the event carries the products' mass share, COM velocity,
// specific internal energy (parent energies + enthalpy share), temperature,
// rest density, and mechanics; placing it moves those amounts verbatim from
// the event ledger onto one particle and zeroes the event, so the event
// splat and the particle P2G never both see the same mass.
const sphReactionProductEventPlacementCombinedWgsl = `
struct ProductEventPlacementParams {
  particle_count: u32,
  event_row_count: u32,
  event_stride_vec4: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  min_placed_mass_kg: f32,
  product_term_count: u32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  box_clamp_enabled: u32,
  canonical_spatial_enabled: u32,
  generation_id: u32,
  support_profile_id: u32,
  receipt_version: u32,
};

@group(0) @binding(0) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> next_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> next_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> next_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: ProductEventPlacementParams;
@group(0) @binding(5) var<storage, read_write> placement_summary: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read> compact_counts: array<u32>;
// ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_BEGIN
@group(0) @binding(9) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(10) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(11) var<storage, read> frozen_placement_source_state: array<vec4<f32>>;
@group(0) @binding(12) var<storage, read_write> placement_decisions: array<vec4<f32>>;
@group(0) @binding(13) var<storage, read_write> placement_control: array<vec4<f32>>;
@group(0) @binding(14) var<storage, read_write> placement_completion_receipt: array<u32>;

${schroederSpatialExactNearTraversalV1Wgsl}
// ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_END

const PHASE_COMPANION_RESERVED_STATUS: f32 = 254.0;
const SPLIT_SPARE_RESERVED_STATUS: f32 = 252.0;
const REACTION_PRODUCT_PLACEMENT_AVOGADRO_PER_MOL: f32 = 6.02214076e23;

fn placement_represented_entity_count_for_product_mass(
  mass_kg: f32,
  molar_mass_kg_per_mol: f32
) -> f32 {
  if (
    !(mass_kg > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
    || mass_kg != mass_kg
    || molar_mass_kg_per_mol != molar_mass_kg_per_mol
  ) {
    return 0.0;
  }
  let represented_entity_count = mass_kg / molar_mass_kg_per_mol
    * REACTION_PRODUCT_PLACEMENT_AVOGADRO_PER_MOL;
  return select(
    0.0,
    represented_entity_count,
    represented_entity_count == represented_entity_count
      && abs(represented_entity_count) <= 3.0e38
  );
}

fn placement_product_event_moles_match_mass(
  product_mass_kg: f32,
  product_moles: f32,
  molar_mass_kg_per_mol: f32
) -> bool {
  if (
    !(product_mass_kg > 0.0)
    || !(product_moles > 0.0)
    || !(molar_mass_kg_per_mol > 0.0)
    || product_mass_kg != product_mass_kg
    || product_moles != product_moles
    || molar_mass_kg_per_mol != molar_mass_kg_per_mol
  ) {
    return false;
  }
  let derived_moles = product_mass_kg / molar_mass_kg_per_mol;
  if (
    !(derived_moles > 0.0)
    || derived_moles != derived_moles
    || abs(derived_moles) > 3.0e38
  ) {
    return false;
  }
  let tolerance = max(
    1.0e-20,
    1.0e-5 * max(abs(product_moles), abs(derived_moles))
  );
  return abs(product_moles - derived_moles) <= tolerance;
}

fn placement_summary_base(product_term_index: u32) -> u32 {
  return product_term_index * 8u;
}

fn record_placement_identity(base: u32, row1: vec4<f32>, row2: vec4<f32>) {
  placement_summary[base] = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(row2.w, 1.0, header.z, header.w);
}

fn record_ready_product(base: u32, product_mass_kg: f32, direct_placed_mass_kg: f32) {
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, header.y, header.z + 1.0, header.w);
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(
    counts.x + select(0.0, 1.0, direct_placed_mass_kg > 0.0),
    counts.y,
    counts.z,
    counts.w
  );
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(
    masses.x + product_mass_kg,
    masses.y + direct_placed_mass_kg,
    masses.z,
    masses.w
  );
  let maxima = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(maxima.x, maxima.y, maxima.z, max(maxima.w, product_mass_kg));
}

fn record_placement_candidate(base: u32) {
  let header = placement_summary[base + 1u];
  placement_summary[base + 1u] = vec4<f32>(header.x, header.y, header.z, header.w + 1.0);
}

fn record_rejected_placement(base: u32, rejected_mass_kg: f32) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(counts.x, counts.y, counts.z + 1.0, counts.w);
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(masses.x, masses.y, masses.z, masses.w + rejected_mass_kg);
}

fn record_unplaced(base: u32, mass_kg: f32, subthreshold: bool) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(
    counts.x + 1.0,
    counts.y + select(0.0, 1.0, subthreshold),
    counts.z,
    counts.w
  );
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(
    masses.x,
    masses.y + mass_kg,
    masses.z + select(0.0, mass_kg, subthreshold),
    masses.w
  );
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(maxima.x, maxima.y, maxima.z, max(maxima.w, mass_kg));
}

fn record_capture_merge(base: u32, mass_kg: f32, post_merge_mass_kg: f32, distance_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y, counts.z + 1.0, counts.w);
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(masses.x, masses.y, masses.z, masses.w + mass_kg);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(
    maxima.x,
    max(maxima.y, mass_kg),
    max(maxima.z, post_merge_mass_kg),
    maxima.w
  );
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(max(distances.x, distance_m), distances.y, distances.z, distances.w);
}

fn record_fallback_merge(base: u32, mass_kg: f32, post_merge_mass_kg: f32, distance_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y, counts.z, counts.w + 1.0);
  let masses = placement_summary[base + 5u];
  placement_summary[base + 5u] = vec4<f32>(masses.x + mass_kg, masses.y, masses.z, masses.w);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(
    maxima.x,
    max(maxima.y, mass_kg),
    max(maxima.z, post_merge_mass_kg),
    maxima.w
  );
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(distances.x, max(distances.y, distance_m), distances.z, distances.w);
}

fn record_spare_placement(base: u32, mass_kg: f32, support_radius_m: f32) {
  let counts = placement_summary[base + 2u];
  placement_summary[base + 2u] = vec4<f32>(counts.x, counts.y + 1.0, counts.z, counts.w);
  let masses = placement_summary[base + 4u];
  placement_summary[base + 4u] = vec4<f32>(masses.x, masses.y, masses.z + mass_kg, masses.w);
  let maxima = placement_summary[base + 6u];
  placement_summary[base + 6u] = vec4<f32>(max(maxima.x, mass_kg), maxima.y, maxima.z, maxima.w);
  let distances = placement_summary[base + 7u];
  placement_summary[base + 7u] = vec4<f32>(distances.x, distances.y, max(distances.z, support_radius_m), distances.w);
}

fn record_phase_routed_event(base: u32) {
  let counts = placement_summary[base + 3u];
  placement_summary[base + 3u] = vec4<f32>(counts.xyz, counts.w + 1.0);
}

fn placement_phase_is_liquid(phase_id: f32) -> bool {
  return phase_id >= 1.5 && phase_id < 2.5;
}

fn placement_phase_is_condensed(phase_id: f32) -> bool {
  return phase_id > 0.5 && phase_id < 2.5;
}

fn placement_phase_is_gas(phase_id: f32) -> bool {
  return phase_id >= 2.5 && phase_id < 3.5;
}

fn placement_reactant_radius_m(pos_mass: vec4<f32>, thermo0: vec4<f32>) -> f32 {
  if (!(pos_mass.w > 0.0) || !(thermo0.w > 0.0)) {
    return 0.0;
  }
  return pow(
    max(3.0 * pos_mass.w / (12.5663706 * thermo0.w), 1.0e-30),
    1.0 / 3.0
  );
}

fn placement_support_fits_box(support_radius_m: f32) -> bool {
  if (params.box_clamp_enabled == 0u) {
    return true;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  return support_radius_m <= max_margin_m;
}

fn placement_clamp_to_box(position: vec3<f32>, support_margin_m: f32) -> vec3<f32> {
  if (params.box_clamp_enabled == 0u) {
    return position;
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  let margin_m = clamp(support_margin_m, 0.0, max_margin_m);
  return clamp(
    position,
    vec3<f32>(margin_m),
    box_dims - vec3<f32>(margin_m)
  );
}

fn placement_pair_preserving_shift(
  source_position: vec3<f32>,
  partner_position: vec3<f32>,
  desired_shift: vec3<f32>,
  support_margin_m: f32
) -> vec4<f32> {
  if (params.box_clamp_enabled == 0u) {
    return vec4<f32>(desired_shift, 1.0);
  }
  let box_dims = vec3<f32>(params.box_x_m, params.box_y_m, params.box_z_m);
  let max_margin_m = 0.5 * min(box_dims.x, min(box_dims.y, box_dims.z));
  if (support_margin_m > max_margin_m) {
    return vec4<f32>(desired_shift, 0.0);
  }
  let margin_m = max(support_margin_m, 0.0);
  let lower = max(
    vec3<f32>(margin_m) - source_position,
    vec3<f32>(margin_m) - partner_position
  );
  let upper = min(
    box_dims - vec3<f32>(margin_m) - source_position,
    box_dims - vec3<f32>(margin_m) - partner_position
  );
  if (!all(lower <= upper)) {
    return vec4<f32>(desired_shift, 0.0);
  }
  let bounded_shift = clamp(desired_shift, lower, upper);
  let shift_error = bounded_shift - desired_shift;
  if (dot(shift_error, shift_error) > 1.0e-10) {
    return vec4<f32>(desired_shift, 0.0);
  }
  return vec4<f32>(bounded_shift, 1.0);
}

// Reaction placement must use the current reacting pair rather than the
// render-cadence material-interface table: source state is fresh for this
// reaction tick, deterministic, and already GPU resident. Select the
// condensed host (liquid first, then any condensed phase, then higher rest
// density, then lower stable particle index), point toward the other carrier,
// and route the gas center beyond the other reactant's surface by the gas
// support radius. As a merged bubble grows, its center advances by the radius
// growth so its volume does not expand back through the reacting pair.
// A zero w lane means the derivation failed and callers retain the midpoint.
fn placement_gas_target(
  source_index: u32,
  partner_index: u32,
  fallback_position: vec3<f32>,
  product_support_radius_m: f32
) -> vec4<f32> {
  if (
    source_index >= params.particle_count
    || partner_index >= params.particle_count
    || source_index == partner_index
  ) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let source_pos_mass = source_state[source_index * params.state_stride_vec4];
  let partner_pos_mass = source_state[partner_index * params.state_stride_vec4];
  let source_thermo0 = source_thermo[source_index * params.thermo_stride_vec4];
  let partner_thermo0 = source_thermo[partner_index * params.thermo_stride_vec4];
  let source_radius_m = placement_reactant_radius_m(source_pos_mass, source_thermo0);
  let partner_radius_m = placement_reactant_radius_m(partner_pos_mass, partner_thermo0);
  if (!(source_radius_m > 0.0) || !(partner_radius_m > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }

  let source_liquid = placement_phase_is_liquid(source_thermo0.y);
  let partner_liquid = placement_phase_is_liquid(partner_thermo0.y);
  let source_condensed = placement_phase_is_condensed(source_thermo0.y);
  let partner_condensed = placement_phase_is_condensed(partner_thermo0.y);
  var host_is_source = source_index < partner_index;
  if (source_liquid != partner_liquid) {
    host_is_source = source_liquid;
  } else if (source_condensed != partner_condensed) {
    host_is_source = source_condensed;
  } else if (abs(source_thermo0.w - partner_thermo0.w) > 1.0e-6) {
    host_is_source = source_thermo0.w > partner_thermo0.w;
  }

  let host_position = select(partner_pos_mass.xyz, source_pos_mass.xyz, host_is_source);
  let free_position = select(source_pos_mass.xyz, partner_pos_mass.xyz, host_is_source);
  let free_radius_m = select(source_radius_m, partner_radius_m, host_is_source);
  let host_to_free = free_position - host_position;
  let separation2 = dot(host_to_free, host_to_free);
  if (!(separation2 > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let contact_radius_m = min(source_radius_m, partner_radius_m);
  let outward_normal = host_to_free / sqrt(separation2);
  let product_radius_m = max(product_support_radius_m, 0.0);
  if (!placement_support_fits_box(product_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let required_clearance_m = free_radius_m + product_radius_m;
  var target_position = free_position + outward_normal * required_clearance_m;
  target_position = placement_clamp_to_box(target_position, product_radius_m);
  let final_clearance_m = dot(target_position - free_position, outward_normal);
  if (final_clearance_m < required_clearance_m - 1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(target_position, contact_radius_m);
}

fn placement_route_gas_merge_position(
  original_event_position: vec3<f32>,
  routed_event_position: vec3<f32>,
  phase_id: f32,
  event_support_radius_m: f32,
  merged_rest_volume_m3: f32,
  fallback_position: vec3<f32>
) -> vec4<f32> {
  if (!placement_phase_is_gas(phase_id) || !(merged_rest_volume_m3 > 0.0)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let route = routed_event_position - original_event_position;
  let route_length2 = dot(route, route);
  if (!(route_length2 > 1.0e-20)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let merged_support_radius_m = pow(
    max(merged_rest_volume_m3 * 0.238732414637843, 1.0e-30),
    1.0 / 3.0
  );
  if (!placement_support_fits_box(merged_support_radius_m)) {
    return vec4<f32>(fallback_position, 0.0);
  }
  let growth_offset_m = max(merged_support_radius_m - event_support_radius_m, 0.0);
  let outward_normal = route / sqrt(route_length2);
  let required_position = routed_event_position + outward_normal * growth_offset_m;
  let outward_penetration_m = max(
    dot(required_position - fallback_position, outward_normal),
    0.0
  );
  let projected_position = fallback_position + outward_normal * outward_penetration_m;
  let clamped_position = placement_clamp_to_box(projected_position, merged_support_radius_m);
  if (dot(clamped_position - required_position, outward_normal) < -1.0e-5) {
    return vec4<f32>(fallback_position, 0.0);
  }
  return vec4<f32>(clamped_position, 1.0);
}

fn placement_particle_rest_volume_m3(particle_index: u32) -> f32 {
  if (particle_index >= params.particle_count) {
    return 0.0;
  }
  let mechanics_row4 = next_mechanics[
    particle_index * params.mechanics_stride_vec4 + 4u
  ];
  if (mechanics_row4.w > 0.0) {
    return mechanics_row4.w;
  }
  let state0 = next_state[particle_index * params.state_stride_vec4];
  let thermo0 = next_thermo[particle_index * params.thermo_stride_vec4];
  if (state0.w > 0.0 && thermo0.w > 0.0) {
    return state0.w / thermo0.w;
  }
  return 0.0;
}

// ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_BEGIN
// LEGACY TEMPLATE-ONLY CLASSIFICATION BODY. The exported commit module removes
// this entire marked region before shader compilation. Slice 8 production uses
// sphReactionProductEventSpatialClassificationWgsl plus the parallel envelope
// module; no runtime pipeline can select the serial helper below.
struct PlacementCaptureResult {
  slot: u32,
  malformed: u32,
  distance_m: f32,
  _pad0: f32,
};

// The canonical directory indexes immutable fresh post-reaction placement
// positions, while placement observes its separately initialized destination.
// A radius/displacement envelope keeps lookup complete before exact filtering.
// ULG_PRODUCT_PLACEMENT_ENVELOPE_HELPER_BEGIN
fn placement_live_radius_and_displacement_envelope() -> vec2<f32> {
  var maximum_radius_m = 0.0;
  var maximum_displacement_m = 0.0;
  for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
    let authority_state0 = frozen_placement_source_state[candidate * params.state_stride_vec4];
    let state0 = next_state[candidate * params.state_stride_vec4];
    let thermo0 = next_thermo[candidate * params.thermo_stride_vec4];
    // Fixed-capacity generations contain zero-mass spare rows. An activated
    // spare belongs to the placed destination, never to this frozen query.
    if (authority_state0.w <= 0.0 || state0.w <= 0.0 || thermo0.w <= 0.0) {
      continue;
    }
    let radius_m = pow(
      max(3.0 * state0.w / (12.5663706 * thermo0.w), 1.0e-30),
      1.0 / 3.0
    );
    maximum_radius_m = max(maximum_radius_m, radius_m);
    maximum_displacement_m = max(
      maximum_displacement_m,
      length(state0.xyz - authority_state0.xyz)
    );
  }
  return vec2<f32>(maximum_radius_m, maximum_displacement_m);
}
// ULG_PRODUCT_PLACEMENT_ENVELOPE_HELPER_END

fn placement_consider_capture_candidate(
  candidate: u32,
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  current: PlacementCaptureResult
) -> PlacementCaptureResult {
  if (candidate >= params.particle_count) {
    return current;
  }
  let authority_state0 = frozen_placement_source_state[candidate * params.state_stride_vec4];
  let candidate_state = next_state[candidate * params.state_stride_vec4];
  if (authority_state0.w <= 0.0 || candidate_state.w <= 0.0) {
    return current;
  }
  let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
  if (
    candidate_row0.x != event_material_id
    || candidate_row0.y != event_phase_id
    || !(candidate_row0.w > 0.0)
  ) {
    return current;
  }
  let candidate_radius_m = pow(
    max(3.0 * candidate_state.w / (12.5663706 * candidate_row0.w), 1.0e-30),
    1.0 / 3.0
  );
  let capture_radius_m = 4.0 * (event_support_radius_m + candidate_radius_m);
  let delta = event_position - candidate_state.xyz;
  let distance_m = length(delta);
  if (
    distance_m <= capture_radius_m
    && (
      distance_m < current.distance_m
      || (distance_m == current.distance_m && candidate < current.slot)
    )
  ) {
    return PlacementCaptureResult(candidate, current.malformed, distance_m, 0.0);
  }
  return current;
}

// Query the fresh frozen placement source by its authenticated exact-near
// directory. The source-to-destination displacement envelope ensures the
// per-carrier capture law cannot omit a valid pre-existing carrier.
fn placement_find_capture_ss(
  event_position: vec3<f32>,
  event_material_id: f32,
  event_phase_id: f32,
  event_support_radius_m: f32,
  maximum_live_radius_m: f32,
  maximum_live_displacement_m: f32
) -> PlacementCaptureResult {
  var result = PlacementCaptureResult(
    params.particle_count,
    0u,
    3.0e38,
    0.0
  );
  if (
    params.canonical_spatial_enabled == 0u
    || spatial_expectation.source_count != params.particle_count
    || !ss_exact_near_directory_admitted(spatial_expectation)
  ) {
    result.malformed = select(0u, 1u, params.canonical_spatial_enabled != 0u);
    return result;
  }
  let search_radius_m = 4.0 * (
    max(event_support_radius_m, 0.0) + max(maximum_live_radius_m, 0.0)
  ) + max(maximum_live_displacement_m, 0.0);
  if (!ss_exact_near_finite(search_radius_m)) {
    result.malformed = 1u;
    return result;
  }

  var malformed = false;
  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(event_position / spacing_m));
    let radius_cells = max(0, i32(min(
      ceil(search_radius_m / spacing_m),
      2147483520.0
    )));
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(spatial_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) {
        malformed = true;
        break;
      }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(spatial_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) {
          malformed = true;
          break;
        }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (var cell_index = z_begin; cell_index < z_end; cell_index = cell_index + 1u) {
          let member_range = ss_exact_near_cell_member_range(
            spatial_expectation,
            cell_index
          );
          if (member_range.admitted == 0u) {
            malformed = true;
            break;
          }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            let lookup = ss_exact_near_source_at_member(
              spatial_expectation,
              member_offset
            );
            if (lookup.admitted == 0u) {
              malformed = true;
              break;
            }
            result = placement_consider_capture_candidate(
              lookup.source_index,
              event_position,
              event_material_id,
              event_phase_id,
              event_support_radius_m,
              result
            );
          }
          if (malformed) {
            break;
          }
        }
        if (malformed) {
          break;
        }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }
  result.malformed = select(0u, 1u, malformed);
  return result;
}

// Build one immutable envelope for the parallel event classifier. This is a
// source-family pass once per reaction step, rather than once per event.
// ULG_PRODUCT_PLACEMENT_ENVELOPE_ENTRY_BEGIN
@compute @workgroup_size(1)
fn prepare_placement_spatial_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  if (global_id.x != 0u || arrayLength(&placement_control) == 0u) {
    return;
  }
  placement_control[0] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.canonical_spatial_enabled == 0u) {
    return;
  }
  let envelope = placement_live_radius_and_displacement_envelope();
  placement_control[0] = vec4<f32>(envelope, 1.0, 0.0);
}
// ULG_PRODUCT_PLACEMENT_ENVELOPE_ENTRY_END

// Resolve the expensive exact-near capture query independently for every
// compact event. The following single-lane commit pass consumes these stable
// decisions in ascending event order, preserving deterministic reductions
// without serializing the spatial traversal itself.
@compute @workgroup_size(64)
fn classify_product_events(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let event = global_id.x;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  if (event >= active_event_count || event >= arrayLength(&placement_decisions)) {
    return;
  }
  placement_decisions[event] = vec4<f32>(
    f32(params.particle_count),
    3.0e38,
    0.0,
    0.0
  );
  let stride = params.event_stride_vec4;
  if (
    params.canonical_spatial_enabled == 0u
    || stride < 8u
    || arrayLength(&placement_control) == 0u
    || placement_control[0].z != 1.0
  ) {
    placement_decisions[event].z = 2.0;
    return;
  }
  let base = event * stride;
  let row0 = product_events[base];
  let row1 = product_events[base + 1u];
  let row2 = product_events[base + 2u];
  let row3 = product_events[base + 3u];
  let row4 = product_events[base + 4u];
  let row5 = product_events[base + 5u];
  let row7 = product_events[base + 7u];
  let event_valid = row4.z == 1.0
    && row7.z == 1.0
    && row2.w > 0.0
    && row4.y > 0.0;
  let unplaced_mass_kg = max(row3.y, 0.0);
  if (!event_valid || unplaced_mass_kg <= params.min_placed_mass_kg) {
    // Valid direct-only and subthreshold events need no capture query. The
    // commit pass still handles their provenance and disposition.
    placement_decisions[event].z = select(2.0, 1.0, event_valid);
    return;
  }
  var support_radius_m = 0.05;
  if (row5.w > 0.0) {
    support_radius_m = pow(row5.w * 0.238732414637843, 1.0 / 3.0);
  }
  var event_position = row0.xyz;
  if (placement_phase_is_gas(row2.w) && row0.w > 0.0) {
    let source_index_f = round(row1.w);
    let partner_index_f = round(row2.x);
    let pair_indices_valid = source_index_f >= 0.0
      && partner_index_f >= 0.0
      && source_index_f < f32(params.particle_count)
      && partner_index_f < f32(params.particle_count);
    if (pair_indices_valid) {
      let gas_target = placement_gas_target(
        u32(source_index_f),
        u32(partner_index_f),
        event_position,
        support_radius_m
      );
      if (gas_target.w > 0.0) {
        event_position = gas_target.xyz;
      }
    }
  }
  let capture = placement_find_capture_ss(
    event_position,
    row1.x,
    row2.w,
    support_radius_m,
    placement_control[0].x,
    placement_control[0].y
  );
  placement_decisions[event] = vec4<f32>(
    f32(capture.slot),
    capture.distance_m,
    select(1.0, 2.0, capture.malformed != 0u),
    0.0
  );
}

// ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_END

// ULG_PRODUCT_PLACEMENT_COMMIT_BEGIN
fn placement_direct_carrier_matches(
  particle_index: u32,
  material_id: f32,
  phase_id: f32
) -> bool {
  if (particle_index >= params.particle_count) {
    return false;
  }
  let state0 = next_state[particle_index * params.state_stride_vec4];
  let thermo0 = next_thermo[particle_index * params.thermo_stride_vec4];
  return state0.w > 0.0
    && abs(thermo0.x - material_id) < 0.5
    && abs(thermo0.y - phase_id) < 0.5;
}

// Direct placement can replace one freed parent before this pass. Relocate it
// only when exactly one endpoint owns this product term; two matching
// endpoints are a multi-carrier product and must retain their separation.
fn placement_route_direct_gas_carrier(
  source_index: u32,
  partner_index: u32,
  material_id: f32,
  phase_id: f32,
  original_event_position: vec3<f32>,
  target_position: vec3<f32>,
  event_support_radius_m: f32
) -> bool {
  let source_matches = placement_direct_carrier_matches(source_index, material_id, phase_id);
  let partner_matches = placement_direct_carrier_matches(partner_index, material_id, phase_id);
  if (!source_matches && !partner_matches) {
    return false;
  }
  if (source_matches && partner_matches) {
    let source_state_base = source_index * params.state_stride_vec4;
    let partner_state_base = partner_index * params.state_stride_vec4;
    let source_state0 = next_state[source_state_base];
    let partner_state0 = next_state[partner_state_base];
    let source_rest_volume_m3 = placement_particle_rest_volume_m3(source_index);
    let partner_rest_volume_m3 = placement_particle_rest_volume_m3(partner_index);
    if (!(source_rest_volume_m3 > 0.0) || !(partner_rest_volume_m3 > 0.0)) {
      return false;
    }
    let source_support_radius_m = pow(
      max(source_rest_volume_m3 * 0.238732414637843, 1.0e-30),
      1.0 / 3.0
    );
    let partner_support_radius_m = pow(
      max(partner_rest_volume_m3 * 0.238732414637843, 1.0e-30),
      1.0 / 3.0
    );
    let direct_support_radius_m = max(source_support_radius_m, partner_support_radius_m);
    let current_midpoint = 0.5 * (source_state0.xyz + partner_state0.xyz);
    let pair_separation = source_state0.xyz - partner_state0.xyz;
    let pair_support_radius_m = 0.5 * sqrt(dot(pair_separation, pair_separation))
      + direct_support_radius_m;
    let pair_support_volume_m3 = pair_support_radius_m
      * pair_support_radius_m
      * pair_support_radius_m
      / 0.238732414637843;
    let projected_route = placement_route_gas_merge_position(
      original_event_position,
      target_position,
      phase_id,
      event_support_radius_m,
      pair_support_volume_m3,
      current_midpoint
    );
    if (projected_route.w <= 0.0) {
      return false;
    }
    let shift = projected_route.xyz - current_midpoint;
    let bounded_shift = placement_pair_preserving_shift(
      source_state0.xyz,
      partner_state0.xyz,
      shift,
      direct_support_radius_m
    );
    if (bounded_shift.w <= 0.0) {
      return false;
    }
    next_state[source_state_base] = vec4<f32>(source_state0.xyz + bounded_shift.xyz, source_state0.w);
    next_state[partner_state_base] = vec4<f32>(partner_state0.xyz + bounded_shift.xyz, partner_state0.w);
    return true;
  }
  let direct_index = select(partner_index, source_index, source_matches);
  let state_base = direct_index * params.state_stride_vec4;
  let state0 = next_state[state_base];
  let direct_rest_volume_m3 = placement_particle_rest_volume_m3(direct_index);
  if (!(direct_rest_volume_m3 > 0.0)) {
    return false;
  }
  let direct_route = placement_route_gas_merge_position(
    original_event_position,
    target_position,
    phase_id,
    event_support_radius_m,
    direct_rest_volume_m3,
    state0.xyz
  );
  if (direct_route.w <= 0.0) {
    return false;
  }
  next_state[state_base] = vec4<f32>(direct_route.xyz, state0.w);
  return true;
}

@compute @workgroup_size(1)
fn place_product_events(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) {
    return;
  }
  if (arrayLength(&placement_completion_receipt) < ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS}u) {
    return;
  }
  placement_completion_receipt[0] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC}u;
  placement_completion_receipt[1] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u;
  placement_completion_receipt[2] = params.generation_id;
  placement_completion_receipt[3] = params.support_profile_id;
  placement_completion_receipt[4] = params.event_row_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.PENDING}u;
  let stride = params.event_stride_vec4;
  if (stride < 8u) {
    placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u;
    return;
  }
  var cursor = 0u;
  let active_event_count = min(compact_counts[0], params.event_row_count);
  let classifier_ready_count = placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierReadyCount}];
  let classifier_rejected_count = placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierRejectedCount}];
  let classifier_unknown_count = placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierUnknownCount}];
  if (params.canonical_spatial_enabled != 0u) {
    // Seal the complete parallel decision set before the first destination
    // mutation. Status 2 is reserved for missing/malformed canonical spatial
    // authority; one such row rejects placement for the whole batch rather
    // than publishing a partially applied prefix.
    if (
      params.receipt_version != ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION}u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactCountPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScanPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactScatterPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.activeEventCount}] != active_event_count
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.compactionOverflowCount}] != 0u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopePartialPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeFinalizePassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeAdmitted}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.classifierPassCount}] != 1u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareFlagPassCount}] != 2u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareScanPassCount}] != 2u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.spareAssignPassCount}] != 2u
      || placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}] != 0u
      || active_event_count > arrayLength(&placement_decisions)
    ) {
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CONTRACT_REJECTED}u;
      return;
    }
    if (
      classifier_ready_count + classifier_rejected_count
        + classifier_unknown_count != active_event_count
      || classifier_unknown_count != 0u
    ) {
      placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.CANONICAL_DECISION_REJECTED}u;
      return;
    }
  }
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyPassCount}] = 1u;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldPassCount}] = select(0u, 1u, active_event_count > 0u);
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.serialConflictFoldEventCount}] = active_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.maxSerialConflictFoldSize}] = active_event_count;
  // Mark every product-term accumulator row as executed only after the full
  // canonical decision set is sealed. Identity is written only by non-empty
  // events below; dense empty event rows must not overwrite a real term
  // identity. Keeping this after preflight makes rejection all-or-nothing for
  // both particle state and placement provenance.
  for (var product_term_index = 0u; product_term_index < params.product_term_count; product_term_index = product_term_index + 1u) {
    let summary_base = placement_summary_base(product_term_index);
    let header = placement_summary[summary_base + 1u];
    placement_summary[summary_base + 1u] = vec4<f32>(header.x, 1.0, header.z, header.w);
  }
  var processed_event_count = 0u;
  var capture_merge_event_count = 0u;
  var spare_placement_event_count = 0u;
  var direct_only_event_count = 0u;
  var fallback_event_count = 0u;
  var subthreshold_event_count = 0u;
  var no_carrier_event_count = 0u;
  var rejected_event_count = 0u;
  var unknown_disposition_count = 0u;
  for (var event = 0u; event < active_event_count; event = event + 1u) {
    processed_event_count = processed_event_count + 1u;
    let base = event * stride;
    let event_row0_header = product_events[base];
    let event_row1_header = product_events[base + 1u];
    let row3 = product_events[base + 3u];
    let row4 = product_events[base + 4u];
    let event_row2_header = product_events[base + 2u];
    let event_row5_header = product_events[base + 5u];
    let event_row7_header = product_events[base + 7u];
    let product_term_index = u32(max(event_row1_header.y, 0.0));
    if (product_term_index >= params.product_term_count) {
      rejected_event_count = rejected_event_count + 1u;
      continue;
    }
    let summary_base = placement_summary_base(product_term_index);
    let unplaced_mass_kg = max(row3.y, 0.0);
    let event_product_mass_kg = max(event_row0_header.w, 0.0);
    let unplaced_represented_entity_count =
      placement_represented_entity_count_for_product_mass(
        unplaced_mass_kg,
        row3.w
      );
    if (event_product_mass_kg > 0.0 || unplaced_mass_kg > 0.0) {
      record_placement_identity(summary_base, event_row1_header, event_row2_header);
    }
    let status = row4.z;
    let event_valid = !(
      status != 1.0
      || event_row7_header.z != 1.0
      || !(event_row2_header.y > 0.0)
      || !(event_row2_header.w > 0.0)
      || !(row3.w > 0.0)
      || !(row4.y > 0.0)
      || !placement_product_event_moles_match_mass(
        event_product_mass_kg,
        event_row2_header.y,
        row3.w
      )
      || (unplaced_mass_kg > 0.0
        && !(unplaced_represented_entity_count > 0.0))
    );
    if (!event_valid) {
      rejected_event_count = rejected_event_count + 1u;
      // Reject the whole non-empty event, including a direct-only event whose
      // unplaced lane is zero. Using only unplaced mass here made an invalid
      // direct placement disappear from the accumulator while the term still
      // looked executed and partition-complete.
      let rejected_payload_mass_kg = max(event_product_mass_kg, unplaced_mass_kg);
      if (rejected_payload_mass_kg > 0.0) {
        record_rejected_placement(summary_base, rejected_payload_mass_kg);
        // Invalid payloads must not remain eligible for the retained grid
        // splat or compaction consumers after the placement gate rejects them.
        product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 8.0);
      }
      continue;
    }
    let event_direct_placed_mass_kg = min(max(row3.x, 0.0), event_product_mass_kg);
    if (event_product_mass_kg > 0.0) {
      record_ready_product(summary_base, event_product_mass_kg, event_direct_placed_mass_kg);
    }
    var event_support_radius_m = 0.05;
    if (event_row5_header.w > 0.0) {
      event_support_radius_m = pow(
        event_row5_header.w * 0.238732414637843,
        1.0 / 3.0
      );
    }
    var event_position = event_row0_header.xyz;
    var event_phase_route_complete = false;
    if (placement_phase_is_gas(event_row2_header.w) && event_product_mass_kg > 0.0) {
      let source_index_f = round(event_row1_header.w);
      let partner_index_f = round(event_row2_header.x);
      let pair_indices_valid = source_index_f >= 0.0
        && partner_index_f >= 0.0
        && source_index_f < f32(params.particle_count)
        && partner_index_f < f32(params.particle_count);
      if (pair_indices_valid) {
        let source_index = u32(source_index_f);
        let partner_index = u32(partner_index_f);
        let gas_target = placement_gas_target(
          source_index,
          partner_index,
          event_position,
          event_support_radius_m
        );
        if (gas_target.w > 0.0) {
          event_position = gas_target.xyz;
          product_events[base] = vec4<f32>(event_position, event_row0_header.w);
          var direct_route_complete = true;
          if (event_direct_placed_mass_kg > 0.0) {
            direct_route_complete = placement_route_direct_gas_carrier(
              source_index,
              partner_index,
              event_row1_header.x,
              event_row2_header.w,
              event_row0_header.xyz,
              event_position,
              event_support_radius_m
            );
          }
          event_phase_route_complete = direct_route_complete;
        }
      }
    }
    if (unplaced_mass_kg <= 0.0) {
      direct_only_event_count = direct_only_event_count + 1u;
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 2.0);
      continue;
    }
    record_placement_candidate(summary_base);
    if (unplaced_mass_kg <= params.min_placed_mass_kg) {
      subthreshold_event_count = subthreshold_event_count + 1u;
      record_unplaced(summary_base, unplaced_mass_kg, true);
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 6.0);
      continue;
    }
    let event_row0 = event_row0_header;
    let event_row1 = event_row1_header;
    let event_row2 = product_events[base + 2u];
    let event_row4b = product_events[base + 4u];
    let event_row5 = product_events[base + 5u];
    let event_material_id = event_row1.x;
    let event_phase_id = event_row2.w;
    // Merge-first: with the interface-flux extent law, burning pairs emit a
    // small product event EVERY substep; minting a spare particle for each
    // would exhaust the spare pool within milliseconds. Physically the new
    // product joins the molten crown / gas bubble already at the interface,
    // so fold the event into the nearest same-material same-phase particle
    // within a capture radius (4x combined rest radii). Mass, momentum, and
    // energy move verbatim (mass-weighted merges), so conservation is exact.
    var merge_slot = params.particle_count;
    var merge_distance = 3.0e38;
    var nearest_slot = params.particle_count;
    var nearest_distance = 3.0e38;
    if (params.canonical_spatial_enabled != 0u) {
      let decision = placement_decisions[event];
      if (decision.z != 1.0) {
        // A malformed canonical traversal may not fall through to private
        // search or mutate destination particles. Retain the event mass for the
        // existing product sidecar/grid consumer and make the miss explicit.
        record_unplaced(summary_base, unplaced_mass_kg, false);
        no_carrier_event_count = no_carrier_event_count + 1u;
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
        continue;
      }
      if (decision.x >= 0.0 && decision.x < f32(params.particle_count)) {
        merge_slot = u32(round(decision.x));
        merge_distance = decision.y;
      }
    } else {
      for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
        let candidate_state = next_state[candidate * params.state_stride_vec4];
        if (candidate_state.w <= 0.0) {
          continue;
        }
        let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
        if (candidate_row0.x != event_material_id) {
          continue;
        }
        let candidate_rest_density = max(candidate_row0.w, 1.0e-6);
        let candidate_radius = pow(
          max(3.0 * candidate_state.w / (12.5663706 * candidate_rest_density), 1.0e-30),
          1.0 / 3.0
        );
        let capture_radius = 4.0 * (event_support_radius_m + candidate_radius);
        let delta = event_position - candidate_state.xyz;
        let distance = length(delta);
        if (
          candidate_row0.y == event_phase_id
          && distance <= capture_radius
          && distance < merge_distance
        ) {
          merge_distance = distance;
          merge_slot = candidate;
        }
        if (distance < nearest_distance) {
          nearest_distance = distance;
          nearest_slot = candidate;
        }
      }
    }
    if (merge_slot < params.particle_count) {
      capture_merge_event_count = capture_merge_event_count + 1u;
      let state_base = merge_slot * params.state_stride_vec4;
      let particle_pos_mass = next_state[state_base];
      let particle_vel_u = next_state[state_base + 1u];
      let merged_mass = particle_pos_mass.w + unplaced_mass_kg;
      let inv_merged = 1.0 / max(merged_mass, 1.0e-20);
      var merged_position = (particle_pos_mass.xyz * particle_pos_mass.w + event_position * unplaced_mass_kg) * inv_merged;
      let merged_velocity = (particle_vel_u.xyz * particle_pos_mass.w + event_row5.xyz * unplaced_mass_kg) * inv_merged;
      let merged_u = (particle_vel_u.w * particle_pos_mass.w + event_row4b.w * unplaced_mass_kg) * inv_merged;
      let mechanics_base = merge_slot * params.mechanics_stride_vec4;
      let mechanics_row4 = next_mechanics[mechanics_base + 4u];
      var merged_rest_volume = mechanics_row4.w;
      if (event_row4b.y > 0.0) {
        merged_rest_volume = merged_rest_volume + unplaced_mass_kg / event_row4b.y;
      }
      if (placement_phase_is_gas(event_phase_id)) {
        let merged_route = placement_route_gas_merge_position(
          event_row0_header.xyz,
          event_position,
          event_phase_id,
          event_support_radius_m,
          merged_rest_volume,
          merged_position
        );
        if (merged_route.w > 0.0) {
          merged_position = merged_route.xyz;
        } else {
          event_phase_route_complete = false;
        }
      }
      next_state[state_base] = vec4<f32>(merged_position, merged_mass);
      next_state[state_base + 1u] = vec4<f32>(merged_velocity, merged_u);
      let thermo_base = merge_slot * params.thermo_stride_vec4;
      let particle_thermo0 = next_thermo[thermo_base];
      let particle_thermo2 = next_thermo[thermo_base + 2u];
      let merged_temperature = (particle_thermo0.z * particle_pos_mass.w + event_row4b.x * unplaced_mass_kg) * inv_merged;
      next_thermo[thermo_base] = vec4<f32>(particle_thermo0.x, particle_thermo0.y, merged_temperature, particle_thermo0.w);
      next_thermo[thermo_base + 2u] = vec4<f32>(
        particle_thermo2.x,
        particle_thermo2.y + unplaced_represented_entity_count,
        particle_thermo2.z,
        particle_thermo2.w
      );
      // Rest volume grows by the event's share so density stays consistent.
      next_mechanics[mechanics_base + 4u] = vec4<f32>(mechanics_row4.x, mechanics_row4.y, mechanics_row4.z, merged_rest_volume);
      record_capture_merge(summary_base, unplaced_mass_kg, merged_mass, merge_distance);
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      // Consume the event. row3.x remains the direct/spare placed share;
      // merged mass is derived exactly as total - placed - unplaced.
      product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
      product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 4.0);
      continue;
    }
    // Canonical placement receives an ascending, prefix-scanned spare slot in
    // decision.w. The legacy route retains its cursor scan; it is unreachable
    // once fresh authenticated SS placement authority is selected.
    var slot = params.particle_count;
    if (params.canonical_spatial_enabled != 0u) {
      let assigned_spare = placement_decisions[event].w;
      if (assigned_spare >= 0.0 && assigned_spare < f32(params.particle_count)) {
        slot = u32(round(assigned_spare));
      }
    } else {
      for (var candidate = cursor; candidate < params.particle_count; candidate = candidate + 1u) {
        let candidate_thermo_base = candidate * params.thermo_stride_vec4;
        let candidate_reserved_for_phase =
          abs(next_thermo[candidate_thermo_base + 2u].z - PHASE_COMPANION_RESERVED_STATUS) < 0.5
          || abs(next_thermo[candidate_thermo_base + 2u].z - SPLIT_SPARE_RESERVED_STATUS) < 0.5;
        if (
          next_state[candidate * params.state_stride_vec4].w <= 0.0
          && !candidate_reserved_for_phase
        ) {
          slot = candidate;
          break;
        }
      }
    }
    if (slot >= params.particle_count) {
      // No later event can make an occupied or phase-reserved row available in
      // this commit. Latch exhaustion so the fixed-capacity phase-companion
      // reserve is scanned once, not once per remaining product event.
      cursor = params.particle_count;
      if (params.canonical_spatial_enabled != 0u) {
        // The canonical route never drops into an unauthenticated all-particle
        // fallback. Keep the mass resident in the event sidecar until a later
        // epoch supplies capacity or a hierarchy-authenticated fallback view.
        record_unplaced(summary_base, unplaced_mass_kg, false);
        no_carrier_event_count = no_carrier_event_count + 1u;
        if (event_phase_route_complete) {
          record_phase_routed_event(summary_base);
        }
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
        continue;
      }
      // Global nearest-material fallback is only needed after deterministic
      // spare exhaustion. Keep it out of the normal per-event hot path.
      if (nearest_slot >= params.particle_count) {
        for (var candidate = 0u; candidate < params.particle_count; candidate = candidate + 1u) {
          let candidate_state = next_state[candidate * params.state_stride_vec4];
          if (candidate_state.w <= 0.0) {
            continue;
          }
          let candidate_row0 = next_thermo[candidate * params.thermo_stride_vec4];
          if (candidate_row0.x != event_material_id) {
            continue;
          }
          let distance = length(event_position - candidate_state.xyz);
          if (
            distance < nearest_distance
            || (distance == nearest_distance && candidate < nearest_slot)
          ) {
            nearest_distance = distance;
            nearest_slot = candidate;
          }
        }
      }
      if (nearest_slot < params.particle_count) {
        // No spare capacity but a same-material carrier exists somewhere:
        // terminal fallback merge (see nearest_slot rationale above).
        merge_slot = nearest_slot;
        let state_base = merge_slot * params.state_stride_vec4;
        let particle_pos_mass = next_state[state_base];
        let particle_vel_u = next_state[state_base + 1u];
        let merged_mass = particle_pos_mass.w + unplaced_mass_kg;
        let inv_merged = 1.0 / max(merged_mass, 1.0e-20);
        var merged_position = (particle_pos_mass.xyz * particle_pos_mass.w + event_position * unplaced_mass_kg) * inv_merged;
        let merged_velocity = (particle_vel_u.xyz * particle_pos_mass.w + event_row5.xyz * unplaced_mass_kg) * inv_merged;
        let merged_u = (particle_vel_u.w * particle_pos_mass.w + event_row4b.w * unplaced_mass_kg) * inv_merged;
        let mechanics_base = merge_slot * params.mechanics_stride_vec4;
        let mechanics_row4 = next_mechanics[mechanics_base + 4u];
        var merged_rest_volume = mechanics_row4.w;
        if (event_row4b.y > 0.0) {
          merged_rest_volume = merged_rest_volume + unplaced_mass_kg / event_row4b.y;
        }
        let thermo_base = merge_slot * params.thermo_stride_vec4;
        let particle_thermo0 = next_thermo[thermo_base];
        let particle_thermo2 = next_thermo[thermo_base + 2u];
        if (placement_phase_is_gas(event_phase_id)) {
          if (abs(particle_thermo0.y - event_phase_id) < 0.5) {
            let merged_route = placement_route_gas_merge_position(
              event_row0_header.xyz,
              event_position,
              event_phase_id,
              event_support_radius_m,
              merged_rest_volume,
              merged_position
            );
            if (merged_route.w > 0.0) {
              merged_position = merged_route.xyz;
            } else {
              event_phase_route_complete = false;
            }
          } else {
            // Preserve the conserving terminal merge but do not teleport a
            // condensed carrier or claim that the gas reached its interface
            // route. The thermal solver remains responsible for phase change.
            event_phase_route_complete = false;
          }
        }
        next_state[state_base] = vec4<f32>(merged_position, merged_mass);
        next_state[state_base + 1u] = vec4<f32>(merged_velocity, merged_u);
        let merged_temperature = (particle_thermo0.z * particle_pos_mass.w + event_row4b.x * unplaced_mass_kg) * inv_merged;
        next_thermo[thermo_base] = vec4<f32>(particle_thermo0.x, particle_thermo0.y, merged_temperature, particle_thermo0.w);
        next_thermo[thermo_base + 2u] = vec4<f32>(
          particle_thermo2.x,
          particle_thermo2.y + unplaced_represented_entity_count,
          particle_thermo2.z,
          particle_thermo2.w
        );
        next_mechanics[mechanics_base + 4u] = vec4<f32>(mechanics_row4.x, mechanics_row4.y, mechanics_row4.z, merged_rest_volume);
        record_fallback_merge(summary_base, unplaced_mass_kg, merged_mass, nearest_distance);
        fallback_event_count = fallback_event_count + 1u;
        if (event_phase_route_complete) {
          record_phase_routed_event(summary_base);
        }
        product_events[base + 3u] = vec4<f32>(row3.x, 0.0, row3.z, row3.w);
        product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
        product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 5.0);
        continue;
      }
      // No spare capacity and no same-material carrier anywhere: the event
      // stays live and keeps feeding the grid splat ledger, so no mass is
      // lost either way.
      record_unplaced(summary_base, unplaced_mass_kg, false);
      no_carrier_event_count = no_carrier_event_count + 1u;
      if (event_phase_route_complete) {
        record_phase_routed_event(summary_base);
      }
      product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 7.0);
      continue;
    }
    if (params.canonical_spatial_enabled == 0u) {
      cursor = slot + 1u;
    }
    let row0 = product_events[base];
    let row1 = product_events[base + 1u];
    let row2 = product_events[base + 2u];
    let row5 = product_events[base + 5u];
    let row6 = product_events[base + 6u];
    let row7 = product_events[base + 7u];
    let material_id = row1.x;
    let phase_id = row2.w;
    let temperature_k = row4.x;
    var rest_density = row4.y;
    let product_u = row4.w;
    let support_volume_m3 = row5.w;
    let state_base = slot * params.state_stride_vec4;
    next_state[state_base] = vec4<f32>(row0.x, row0.y, row0.z, unplaced_mass_kg);
    next_state[state_base + 1u] = vec4<f32>(row5.x, row5.y, row5.z, product_u);
    // Thermo rows: single-phase product at the event temperature. Phase
    // fractions are the one-hot of the product term's target phase.
    let thermo_base = slot * params.thermo_stride_vec4;
    let solid_fraction = select(0.0, 1.0, phase_id > 0.5 && phase_id < 1.5);
    let liquid_fraction = select(0.0, 1.0, phase_id >= 1.5 && phase_id < 2.5);
    let gas_fraction = select(0.0, 1.0, phase_id >= 2.5 && phase_id < 3.5);
    let plasma_fraction = select(0.0, 1.0, phase_id >= 3.5);
    // Smoothing length / visual radius from the event's support volume
    // (mass over product rest density), the same rest-volume radius the
    // demo derives at build time.
    var support_radius_m = 0.05;
    if (support_volume_m3 > 0.0) {
      support_radius_m = pow(support_volume_m3 * 0.238732414637843, 1.0 / 3.0);
    }
    next_thermo[thermo_base] = vec4<f32>(material_id, phase_id, temperature_k, rest_density);
    next_thermo[thermo_base + 1u] = vec4<f32>(solid_fraction, liquid_fraction, gas_fraction, plasma_fraction);
    next_thermo[thermo_base + 2u] = vec4<f32>(
      support_radius_m,
      unplaced_represented_entity_count,
      1.0,
      support_radius_m
    );
    // Mechanics: fresh rest state (F = I, J = 1) with the event's product
    // mechanics -- mirrors write_reacted_mechanics in the reaction kernel.
    var rest_volume = 0.0;
    if (rest_density > 0.0) {
      rest_volume = unplaced_mass_kg / rest_density;
    }
    let mechanics_base = slot * params.mechanics_stride_vec4;
    next_mechanics[mechanics_base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    next_mechanics[mechanics_base + 4u] = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
    next_mechanics[mechanics_base + 5u] = vec4<f32>(row7.y, row7.z, row6.x, row6.y);
    next_mechanics[mechanics_base + 6u] = vec4<f32>(row6.z, row6.w, row7.x, row7.z);
    next_mechanics[mechanics_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    record_spare_placement(summary_base, unplaced_mass_kg, support_radius_m);
    spare_placement_event_count = spare_placement_event_count + 1u;
    if (event_phase_route_complete) {
      record_phase_routed_event(summary_base);
    }
    // Consume the event: zero its unplaced share and status so the compactor
    // and the grid splat drop it this substep.
    product_events[base + 3u] = vec4<f32>(row3.x + unplaced_mass_kg, 0.0, row3.z, row3.w);
    product_events[base + 4u] = vec4<f32>(row4.x, row4.y, 0.0, row4.w);
    product_events[base + 7u] = vec4<f32>(event_row7_header.xyz, 3.0);
  }
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.applyVisitedCount}] = processed_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.directOnlyEventCount}] = direct_only_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.sparePlacementEventCount}] = spare_placement_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.captureMergeEventCount}] = capture_merge_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.fallbackEventCount}] = fallback_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.subthresholdEventCount}] = subthreshold_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.noCarrierEventCount}] = no_carrier_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.rejectedEventCount}] = rejected_event_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.unknownDispositionCount}] = unknown_disposition_count;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.privateLookupBuildCount}] = 0u;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.exhaustiveTraversalCount}] = 0u;
  placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.status}] = ${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_STATUS.COMPLETE}u;
}
// ULG_PRODUCT_PLACEMENT_COMMIT_END
`;

const PRODUCT_PLACEMENT_SPATIAL_BINDINGS_PATTERN =
  /\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_BEGIN[\s\S]*?\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_BINDINGS_END\n/;
const PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_PATTERN =
  /\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_BEGIN[\s\S]*?\/\/ ULG_PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_END\n/;

// Native WebGPU drivers compile each pipeline entry point independently.
// Keep the exact-near classifier and deterministic commit in separate WGSL
// modules so the large traversal is validated once and never recompiled for
// the commit-only pipeline.
export const sphReactionProductEventPlacementEnvelopeWgsl = `
struct ProductEventPlacementParams {
  particle_count: u32,
  event_row_count: u32,
  event_stride_vec4: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  min_placed_mass_kg: f32,
  product_term_count: u32,
  box_x_m: f32,
  box_y_m: f32,
  box_z_m: f32,
  box_clamp_enabled: u32,
  canonical_spatial_enabled: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> frozen_placement_source_state: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: ProductEventPlacementParams;
@group(0) @binding(4) var<storage, read_write> placement_control: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> placement_completion_receipt: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> envelope_partials: array<vec4<f32>>;

var<workgroup> envelope_radius: array<f32, 64>;
var<workgroup> envelope_displacement: array<f32, 64>;
var<workgroup> envelope_admitted_count: array<u32, 64>;

fn placement_envelope_finite_scalar(value: f32) -> bool {
  return value == value && abs(value) < 3.0e38;
}

fn placement_envelope_finite_vec4(value: vec4<f32>) -> bool {
  return all(value == value) && all(abs(value) < vec4<f32>(3.0e38));
}

fn placement_envelope_reject_motion_bound() {
  atomicOr(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
    ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.MOTION_BOUND_REJECTED}u
  );
}

fn placement_envelope_record_visit() {
  let previous = atomicAdd(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeInputVisitCount}],
    1u
  );
  if (previous == 0xffffffffu) {
    atomicOr(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}],
      ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.ATOMIC_COUNTER}u
    );
  }
}

@compute @workgroup_size(64)
fn reduce_placement_spatial_envelope(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let candidate = global_id.x;
  let lane = local_id.x;
  var radius_m = 0.0;
  var displacement_m = 0.0;
  var admitted = 0u;
  if (candidate < params.particle_count) {
    placement_envelope_record_visit();
    let authority_state0 = frozen_placement_source_state[
      candidate * params.state_stride_vec4
    ];
    let state0 = next_state[candidate * params.state_stride_vec4];
    let thermo0 = next_thermo[candidate * params.thermo_stride_vec4];
    let finite_inputs = placement_envelope_finite_vec4(authority_state0)
      && placement_envelope_finite_vec4(state0)
      && placement_envelope_finite_vec4(thermo0);
    let nonnegative_inputs = authority_state0.w >= 0.0
      && state0.w >= 0.0
      && thermo0.w >= 0.0;
    let authority_active = authority_state0.w > 0.0;
    let current_active = state0.w > 0.0;
    if (
      params.canonical_spatial_enabled == 0u
      || !finite_inputs
      || !nonnegative_inputs
      || (current_active && (!authority_active || !(thermo0.w > 0.0)))
    ) {
      placement_envelope_reject_motion_bound();
    } else if (current_active) {
      admitted = 1u;
      radius_m = pow(
        max(3.0 * state0.w / (12.5663706 * thermo0.w), 1.0e-30),
        1.0 / 3.0
      );
      displacement_m = length(state0.xyz - authority_state0.xyz);
      if (
        !placement_envelope_finite_scalar(radius_m)
        || !placement_envelope_finite_scalar(displacement_m)
        || radius_m < 0.0
        || displacement_m < 0.0
      ) {
        radius_m = 0.0;
        displacement_m = 0.0;
        admitted = 0u;
        placement_envelope_reject_motion_bound();
      }
    }
  }
  envelope_radius[lane] = radius_m;
  envelope_displacement[lane] = displacement_m;
  envelope_admitted_count[lane] = admitted;
  workgroupBarrier();
  var width = 32u;
  loop {
    if (width == 0u) { break; }
    if (lane < width) {
      envelope_radius[lane] = max(
        envelope_radius[lane],
        envelope_radius[lane + width]
      );
      envelope_displacement[lane] = max(
        envelope_displacement[lane],
        envelope_displacement[lane + width]
      );
      envelope_admitted_count[lane] = envelope_admitted_count[lane]
        + envelope_admitted_count[lane + width];
    }
    workgroupBarrier();
    width = width / 2u;
  }
  if (lane == 0u && workgroup_id.x < arrayLength(&envelope_partials)) {
    envelope_partials[workgroup_id.x] = vec4<f32>(
      envelope_radius[0],
      envelope_displacement[0],
      f32(envelope_admitted_count[0]),
      1.0
    );
  }
  if (candidate == 0u) {
    atomicStore(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopePartialPassCount}],
      1u
    );
  }
}

@compute @workgroup_size(64)
fn finalize_placement_spatial_envelope(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (workgroup_id.x != 0u || arrayLength(&placement_control) == 0u) { return; }
  let lane = local_id.x;
  let partial_count = min(
    (params.particle_count + 63u) / 64u,
    arrayLength(&envelope_partials)
  );
  var maximum_radius_m = 0.0;
  var maximum_displacement_m = 0.0;
  var admitted_count = 0u;
  for (var partial = lane; partial < partial_count; partial = partial + 64u) {
    let row = envelope_partials[partial];
    maximum_radius_m = max(maximum_radius_m, row.x);
    maximum_displacement_m = max(maximum_displacement_m, row.y);
    admitted_count = admitted_count + u32(max(row.z, 0.0));
  }
  envelope_radius[lane] = maximum_radius_m;
  envelope_displacement[lane] = maximum_displacement_m;
  envelope_admitted_count[lane] = admitted_count;
  workgroupBarrier();
  var width = 32u;
  loop {
    if (width == 0u) { break; }
    if (lane < width) {
      envelope_radius[lane] = max(envelope_radius[lane], envelope_radius[lane + width]);
      envelope_displacement[lane] = max(envelope_displacement[lane], envelope_displacement[lane + width]);
      envelope_admitted_count[lane] = envelope_admitted_count[lane] + envelope_admitted_count[lane + width];
    }
    workgroupBarrier();
    width = width / 2u;
  }
  if (lane != 0u) { return; }
  let final_radius = envelope_radius[0];
  let final_displacement = envelope_displacement[0];
  let final_admitted_count = envelope_admitted_count[0];
  let admitted = params.canonical_spatial_enabled != 0u
    && partial_count == (params.particle_count + 63u) / 64u
    && atomicLoad(
      &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeInputVisitCount}]
    ) == params.particle_count
    && (
      atomicLoad(
        &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.overflowFlags}]
      ) & ${SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS.MOTION_BOUND_REJECTED}u
    ) == 0u;
  placement_control[0] = vec4<f32>(
    final_radius,
    final_displacement,
    select(0.0, 1.0, admitted),
    f32(final_admitted_count)
  );
  atomicStore(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeFinalizePassCount}],
    1u
  );
  atomicStore(
    &placement_completion_receipt[${SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.envelopeAdmitted}],
    select(0u, 1u, admitted)
  );
}
`;

export const sphReactionProductEventPlacementWgsl =
  sphReactionProductEventPlacementCombinedWgsl
    .replace(
      PRODUCT_PLACEMENT_SPATIAL_BINDINGS_PATTERN,
      '@group(0) @binding(9) var<storage, read> placement_decisions: array<vec4<f32>>;\n@group(0) @binding(10) var<storage, read_write> placement_completion_receipt: array<u32>;\n'
    )
    .replace(PRODUCT_PLACEMENT_SPATIAL_CLASSIFICATION_PATTERN, '')
    .replaceAll('// ULG_PRODUCT_PLACEMENT_COMMIT_BEGIN\n', '')
    .replaceAll('// ULG_PRODUCT_PLACEMENT_COMMIT_END\n', '');

export function createSphReactionSummaryPartialsWgsl({ sharedAllocation = false } = {}) {
  return `
${sphReactionEnergyWgsl}
${sharedAllocation ? sphReactionPairReaderWgsl + `
fn physical_reaction_pair_applied(rx: u32, a: u32, b: u32) -> bool {
  if (!reaction_energy_enabled(rx)) { return true; }
  return pair_allocation_ready(rx, a, b);
}` : sphReactionAppliedPairWgsl}
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  // Offset 32 is the shared packer's atom_term_count lane (used by the
  // atom-residual summary kernel); keep it reserved here.
  _pad0: u32,
  // Substep duration for the interface-flux extent law; must match the apply
  // kernel's dt_s so ledger and application agree. 0 disables the cap.
  dt_s: f32,
  _pad2: u32,
  // Phase-carrier v2 lineage capacity (summary params word 11), or 0.
  phase_lineage_capacity: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] this reactant can deliver to a reactive
  // contact at the reference temperature (kinetic-theory effusion for gases,
  // Clausius-Clapeyron vapor carrier for volatile condensed reactants, 0 when
  // no transport pathway is derivable). Packed by the reaction-table builder.
  interface_flux: f32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> partial_summaries: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: ReactionSummaryParams;
@group(0) @binding(7) var<storage, read> proposals: array<vec4<f32>>;

// Mirrors the step kernel's in-place hosting deferral (reaction_row_hosts_product)
// on the same pre-reaction state: a pair whose freed parent cannot host its
// product did not react, so no ledger may count its consumption.
fn reaction_lineage_row_hosts(index: u32) -> bool {
  let capacity = params.phase_lineage_capacity;
  if (capacity == 0u || capacity * 4u != params.particle_count) { return true; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let row = lane * capacity + lineage;
    if (row != index && source_state[row * 2u].w != 0.0) { return false; }
  }
  return true;
}

fn reaction_pair_deferred(a: u32, a_mass: f32, a_consumed: f32, b: u32, b_mass: f32, b_consumed: f32, energy: bool) -> bool {
  let a_remaining = max(a_mass - a_consumed, 0.0);
  let b_remaining = max(b_mass - b_consumed, 0.0);
  let a_free = a_remaining <= select(max(a_mass, 1.0) * 1.0e-7, 0.0, energy);
  let b_free = b_remaining <= select(max(b_mass, 1.0) * 1.0e-7, 0.0, energy);
  return (a_free && !reaction_lineage_row_hosts(a)) || (b_free && !reaction_lineage_row_hosts(b));
}

var<workgroup> wg_changed_material: array<f32, 64>;
var<workgroup> wg_changed_mass: array<f32, 64>;
var<workgroup> wg_visible_product_mass: array<f32, 64>;
var<workgroup> wg_visible_gas_product_mass: array<f32, 64>;
var<workgroup> wg_output_gas_phase_mass: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_next_mass: array<f32, 64>;
var<workgroup> wg_thermal_ready: array<f32, 64>;
var<workgroup> wg_thermal_problem: array<f32, 64>;
var<workgroup> wg_finite_temperature: array<f32, 64>;
var<workgroup> wg_canonical_events: array<f32, 64>;
var<workgroup> wg_consumed_reactant_mass: array<f32, 64>;
var<workgroup> wg_expected_product_mass: array<f32, 64>;
var<workgroup> wg_raw_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_visible_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_unplaced_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_gas_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_visible_gas_product_mass: array<f32, 64>;
var<workgroup> wg_ledger_unplaced_gas_product_mass: array<f32, 64>;
var<workgroup> wg_sealed_box_gas_product_moles: array<f32, 64>;
var<workgroup> wg_reaction_heat: array<f32, 64>;
var<workgroup> wg_ledger_mass_residual: array<f32, 64>;
var<workgroup> wg_ledger_ready_events: array<f32, 64>;
var<workgroup> wg_ledger_problem_events: array<f32, 64>;
var<workgroup> wg_mutual_pairs: array<f32, 64>;

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

// Gauge-consistent heat proxy (src/runtime/sph/sphReactionHeatProxyGauge.js):
// the product term's runtime-gauge offset (word 15), 0 on single-gauge tables.
fn product_term_gauge(term_index: u32) -> f32 {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u].w;
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

fn product_term_material_match(reaction_index: u32, material_id: f32) -> bool {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

fn gas_product_term_material_match(reaction_index: u32, material_id: f32) -> bool {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

fn gas_product_mass_for_extent(reaction_index: u32, extent_mol: f32, mass_scale: f32) -> vec2<f32> {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var mass_kg = 0.0;
  var moles = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      moles = moles + extent_mol * term0.z * mass_scale;
      mass_kg = mass_kg + extent_mol * term0.z * term0.w * mass_scale;
    }
  }
  return vec2<f32>(mass_kg, moles);
}

fn product_term_match(material_id: f32) -> bool {
  for (var term_index = 0u; term_index < params.product_term_count; term_index = term_index + 1u) {
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

fn gas_product_term_match(material_id: f32) -> bool {
  for (var term_index = 0u; term_index < params.product_term_count; term_index = term_index + 1u) {
    let term0 = product_term_row0(term_index);
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term1.y == 1.0 && term0.y == material_id) {
      return true;
    }
  }
  return false;
}

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let local = local_id.x;
  let particle_index = global_id.x;
  wg_changed_material[local] = 0.0;
  wg_changed_mass[local] = 0.0;
  wg_visible_product_mass[local] = 0.0;
  wg_visible_gas_product_mass[local] = 0.0;
  wg_output_gas_phase_mass[local] = 0.0;
  wg_source_mass[local] = 0.0;
  wg_next_mass[local] = 0.0;
  wg_thermal_ready[local] = 0.0;
  wg_thermal_problem[local] = 0.0;
  wg_finite_temperature[local] = 0.0;
  wg_canonical_events[local] = 0.0;
  wg_consumed_reactant_mass[local] = 0.0;
  wg_expected_product_mass[local] = 0.0;
  wg_raw_product_mass[local] = 0.0;
  wg_ledger_visible_product_mass[local] = 0.0;
  wg_ledger_unplaced_product_mass[local] = 0.0;
  wg_ledger_gas_product_mass[local] = 0.0;
  wg_ledger_visible_gas_product_mass[local] = 0.0;
  wg_ledger_unplaced_gas_product_mass[local] = 0.0;
  wg_sealed_box_gas_product_moles[local] = 0.0;
  wg_reaction_heat[local] = 0.0;
  wg_ledger_mass_residual[local] = 0.0;
  wg_ledger_ready_events[local] = 0.0;
  wg_ledger_problem_events[local] = 0.0;
  wg_mutual_pairs[local] = 0.0;

  if (particle_index < params.particle_count) {
    let source_pos_mass = source_state[particle_index * 2u];
    let next_pos_mass = next_state[particle_index * 2u];
    let source_row0 = source_thermo[particle_index * 3u];
    let next_row0 = next_thermo[particle_index * 3u];
    let next_row2 = next_thermo[particle_index * 3u + 2u];
    wg_source_mass[local] = source_pos_mass.w;
    wg_next_mass[local] = next_pos_mass.w;
    if (source_row0.x != next_row0.x) {
      wg_changed_material[local] = 1.0;
    }
    if (abs(source_pos_mass.w - next_pos_mass.w) > max(max(source_pos_mass.w, next_pos_mass.w), 1.0) * 1.0e-7) {
      wg_changed_mass[local] = 1.0;
    }
    if (product_term_match(next_row0.x)) {
      wg_visible_product_mass[local] = next_pos_mass.w;
    }
    if (gas_product_term_match(next_row0.x)) {
      wg_visible_gas_product_mass[local] = next_pos_mass.w;
    }
    if (next_row0.y == 3.0) {
      wg_output_gas_phase_mass[local] = next_pos_mass.w;
    }
    if (next_row2.z == 1.0) {
      wg_thermal_ready[local] = 1.0;
    } else {
      wg_thermal_problem[local] = 1.0;
    }
    if (next_row0.z == next_row0.z) {
      wg_finite_temperature[local] = 1.0;
    }

    if (params.has_proposals != 0u) {
      let proposal = proposals[particle_index];
      if (proposal.x >= 0.0 && proposal.y >= 0.0) {
        let partner_index = u32(proposal.x + 0.5);
        if (partner_index < params.particle_count && particle_index < partner_index) {
          let partner_proposal = proposals[partner_index];
          if (partner_proposal.x >= 0.0 && u32(partner_proposal.x + 0.5) == particle_index && partner_proposal.y == proposal.y) {
            wg_mutual_pairs[local] = 1.0;
            let reaction_index = u32(proposal.y + 0.5);
            let partner_source_pos_mass = source_state[partner_index * 2u];
            let self_source_row0 = source_thermo[particle_index * 3u];
            let partner_source_row0 = source_thermo[partner_index * 3u];
            let self_term = reactant_term_for_material(reaction_index, self_source_row0.x);
            let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
            let header1 = reaction_header_row1(reaction_index);
            let product_term_count = u32(max(header1.x, 0.0));
            let has_stoichiometry = self_term.status == 1.0
              && partner_term.status == 1.0
              && self_term.coefficient > 0.0
              && partner_term.coefficient > 0.0
              && self_term.molar_mass > 0.0
              && partner_term.molar_mass > 0.0
              && product_term_count > 0u;
            if (has_stoichiometry && physical_reaction_pair_applied(reaction_index, particle_index, partner_index)) {
${sharedAllocation ? `              if (reaction_energy_enabled(reaction_index)) {
                let base = pair_allocation_base(particle_index);
                let chosen = pair_allocations[base + 1u];
                let products = pair_product_totals(particle_index, reaction_index, 0.0, false);
                let gas = pair_product_totals(particle_index, reaction_index, 0.0, true);
                wg_canonical_events[local] = 1.0;
                wg_consumed_reactant_mass[local] = chosen.y + chosen.z;
                wg_expected_product_mass[local] = products.x;
                wg_raw_product_mass[local] = chosen.w;
                wg_ledger_visible_product_mass[local] = products.z;
                wg_ledger_unplaced_product_mass[local] = products.w;
                wg_ledger_gas_product_mass[local] = gas.x;
                wg_ledger_visible_gas_product_mass[local] = gas.z;
                wg_ledger_unplaced_gas_product_mass[local] = gas.w;
                wg_sealed_box_gas_product_moles[local] = gas.y;
                wg_reaction_heat[local] = -reaction_row1(reaction_index).x * (chosen.y + chosen.z);
                wg_ledger_mass_residual[local] = chosen.w - products.x;
                wg_ledger_ready_events[local] = 1.0;
              } else {` : ''}
              let self_extent = source_pos_mass.w / max(self_term.coefficient * self_term.molar_mass, 1.0e-20);
              let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
              // Mirror of the apply kernel's flux-capped extent so ledger and
              // application account the same consumed mass.
              let extent_availability_mol = min(self_extent, partner_extent);
              let extent_flux_cap_mol = interface_flux_extent_cap_mol(
                source_pos_mass.w, self_source_row0.w, self_source_row0.z,
                self_term.coefficient, self_term.molar_mass, self_term.interface_flux,
                partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
                partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
                params.dt_s
              );
              let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
              let self_consumed = reaction_consumed_mass(reaction_index, source_pos_mass.w, extent_mol, self_term.coefficient, self_term.molar_mass);
              let partner_consumed = reaction_consumed_mass(reaction_index, partner_source_pos_mass.w, extent_mol, partner_term.coefficient, partner_term.molar_mass);
              let consumed_mass = self_consumed + partner_consumed;
              let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
              let pair_deferred = reaction_pair_deferred(particle_index, source_pos_mass.w, self_consumed,
                partner_index, partner_source_pos_mass.w, partner_consumed, reaction_energy_enabled(reaction_index));
              if (!pair_deferred && extent_mol > 0.0 && consumed_mass > 0.0 && raw_product_mass > 0.0) {
                let mass_scale = consumed_mass / raw_product_mass;
                let partner_next_pos_mass = next_state[partner_index * 2u];
                let self_next_row0 = next_thermo[particle_index * 3u];
                let partner_next_row0 = next_thermo[partner_index * 3u];
                var event_visible_product_mass = 0.0;
                var event_visible_gas_product_mass = 0.0;
                if (product_term_material_match(reaction_index, self_next_row0.x)) {
                  event_visible_product_mass = event_visible_product_mass + next_pos_mass.w;
                }
                if (product_term_material_match(reaction_index, partner_next_row0.x)) {
                  event_visible_product_mass = event_visible_product_mass + partner_next_pos_mass.w;
                }
                if (gas_product_term_material_match(reaction_index, self_next_row0.x)) {
                  event_visible_gas_product_mass = event_visible_gas_product_mass + next_pos_mass.w;
                }
                if (gas_product_term_material_match(reaction_index, partner_next_row0.x)) {
                  event_visible_gas_product_mass = event_visible_gas_product_mass + partner_next_pos_mass.w;
                }
                let gas = gas_product_mass_for_extent(reaction_index, extent_mol, mass_scale);
                let rx1 = reaction_row1(reaction_index);
                wg_canonical_events[local] = 1.0;
                wg_consumed_reactant_mass[local] = consumed_mass;
                wg_expected_product_mass[local] = consumed_mass;
                wg_raw_product_mass[local] = raw_product_mass;
                wg_ledger_visible_product_mass[local] = event_visible_product_mass;
                wg_ledger_unplaced_product_mass[local] = max(consumed_mass - event_visible_product_mass, 0.0);
                wg_ledger_gas_product_mass[local] = gas.x;
                wg_ledger_visible_gas_product_mass[local] = event_visible_gas_product_mass;
                wg_ledger_unplaced_gas_product_mass[local] = max(gas.x - event_visible_gas_product_mass, 0.0);
                wg_sealed_box_gas_product_moles[local] = gas.y;
                wg_reaction_heat[local] = -rx1.x * consumed_mass;
                wg_ledger_mass_residual[local] = raw_product_mass - consumed_mass;
                wg_ledger_ready_events[local] = 1.0;
              } else {
                wg_ledger_problem_events[local] = 1.0;
              }
${sharedAllocation ? '}' : ''}
            } else {
              wg_ledger_problem_events[local] = 1.0;
            }
          }
        }
      }
    }
  }

  workgroupBarrier();
  var stride = 32u;
  loop {
    if (local < stride) {
      wg_changed_material[local] = wg_changed_material[local] + wg_changed_material[local + stride];
      wg_changed_mass[local] = wg_changed_mass[local] + wg_changed_mass[local + stride];
      wg_visible_product_mass[local] = wg_visible_product_mass[local] + wg_visible_product_mass[local + stride];
      wg_visible_gas_product_mass[local] = wg_visible_gas_product_mass[local] + wg_visible_gas_product_mass[local + stride];
      wg_output_gas_phase_mass[local] = wg_output_gas_phase_mass[local] + wg_output_gas_phase_mass[local + stride];
      wg_source_mass[local] = wg_source_mass[local] + wg_source_mass[local + stride];
      wg_next_mass[local] = wg_next_mass[local] + wg_next_mass[local + stride];
      wg_thermal_ready[local] = wg_thermal_ready[local] + wg_thermal_ready[local + stride];
      wg_thermal_problem[local] = wg_thermal_problem[local] + wg_thermal_problem[local + stride];
      wg_finite_temperature[local] = wg_finite_temperature[local] + wg_finite_temperature[local + stride];
      wg_canonical_events[local] = wg_canonical_events[local] + wg_canonical_events[local + stride];
      wg_consumed_reactant_mass[local] = wg_consumed_reactant_mass[local] + wg_consumed_reactant_mass[local + stride];
      wg_expected_product_mass[local] = wg_expected_product_mass[local] + wg_expected_product_mass[local + stride];
      wg_raw_product_mass[local] = wg_raw_product_mass[local] + wg_raw_product_mass[local + stride];
      wg_ledger_visible_product_mass[local] = wg_ledger_visible_product_mass[local] + wg_ledger_visible_product_mass[local + stride];
      wg_ledger_unplaced_product_mass[local] = wg_ledger_unplaced_product_mass[local] + wg_ledger_unplaced_product_mass[local + stride];
      wg_ledger_gas_product_mass[local] = wg_ledger_gas_product_mass[local] + wg_ledger_gas_product_mass[local + stride];
      wg_ledger_visible_gas_product_mass[local] = wg_ledger_visible_gas_product_mass[local] + wg_ledger_visible_gas_product_mass[local + stride];
      wg_ledger_unplaced_gas_product_mass[local] = wg_ledger_unplaced_gas_product_mass[local] + wg_ledger_unplaced_gas_product_mass[local + stride];
      wg_sealed_box_gas_product_moles[local] = wg_sealed_box_gas_product_moles[local] + wg_sealed_box_gas_product_moles[local + stride];
      wg_reaction_heat[local] = wg_reaction_heat[local] + wg_reaction_heat[local + stride];
      wg_ledger_mass_residual[local] = wg_ledger_mass_residual[local] + wg_ledger_mass_residual[local + stride];
      wg_ledger_ready_events[local] = wg_ledger_ready_events[local] + wg_ledger_ready_events[local + stride];
      wg_ledger_problem_events[local] = wg_ledger_problem_events[local] + wg_ledger_problem_events[local + stride];
      wg_mutual_pairs[local] = wg_mutual_pairs[local] + wg_mutual_pairs[local + stride];
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (local == 0u) {
    let base = workgroup_id.x * 8u;
    partial_summaries[base] = vec4<f32>(
      wg_changed_material[0u],
      wg_changed_mass[0u],
      wg_visible_product_mass[0u],
      wg_visible_gas_product_mass[0u]
    );
    partial_summaries[base + 1u] = vec4<f32>(
      wg_output_gas_phase_mass[0u],
      wg_source_mass[0u],
      wg_next_mass[0u],
      wg_next_mass[0u] - wg_source_mass[0u]
    );
    partial_summaries[base + 2u] = vec4<f32>(
      wg_thermal_ready[0u],
      wg_thermal_problem[0u],
      wg_finite_temperature[0u],
      1.0
    );
    partial_summaries[base + 3u] = vec4<f32>(
      wg_canonical_events[0u],
      wg_consumed_reactant_mass[0u],
      wg_expected_product_mass[0u],
      wg_raw_product_mass[0u]
    );
    partial_summaries[base + 4u] = vec4<f32>(
      wg_ledger_visible_product_mass[0u],
      wg_ledger_unplaced_product_mass[0u],
      wg_ledger_gas_product_mass[0u],
      wg_ledger_visible_gas_product_mass[0u]
    );
    partial_summaries[base + 5u] = vec4<f32>(
      wg_ledger_unplaced_gas_product_mass[0u],
      wg_sealed_box_gas_product_moles[0u],
      wg_reaction_heat[0u],
      wg_ledger_mass_residual[0u]
    );
    partial_summaries[base + 6u] = vec4<f32>(
      wg_ledger_ready_events[0u],
      wg_ledger_problem_events[0u],
      wg_mutual_pairs[0u],
      select(0.0, 1.0, params.has_proposals != 0u)
    );
    partial_summaries[base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
}
`;

}
export const sphReactionSummaryPartialsWgsl = createSphReactionSummaryPartialsWgsl();

export const sphReactionSummaryFinalizeWgsl = `
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  _pad0: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  _pad3: u32,
};

@group(0) @binding(0) var<storage, read> partial_summaries: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> reaction_summary: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: ReactionSummaryParams;

var<workgroup> rx_sum_r0: array<vec4<f32>, 64>;
var<workgroup> rx_sum_r1: array<vec4<f32>, 64>;
var<workgroup> rx_sum_r2: array<vec4<f32>, 64>;
var<workgroup> rx_sum_r3: array<vec4<f32>, 64>;
var<workgroup> rx_sum_r4: array<vec4<f32>, 64>;
var<workgroup> rx_sum_r5: array<vec4<f32>, 64>;
var<workgroup> rx_sum_r6: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  if (workgroup_id.x > 0u) { return; }
  let lane = local_id.x;
  var acc0 = vec4<f32>(0.0);
  var acc1 = vec4<f32>(0.0);
  var acc2 = vec4<f32>(0.0);
  var acc3 = vec4<f32>(0.0);
  var acc4 = vec4<f32>(0.0);
  var acc5 = vec4<f32>(0.0);
  var acc6 = vec4<f32>(0.0);
  for (var partial_index = lane; partial_index < params.partial_count; partial_index = partial_index + 64u) {
    let base = partial_index * 8u;
    acc0 = acc0 + partial_summaries[base];
    acc1 = acc1 + partial_summaries[base + 1u];
    acc2 = acc2 + partial_summaries[base + 2u];
    acc3 = acc3 + partial_summaries[base + 3u];
    acc4 = acc4 + partial_summaries[base + 4u];
    acc5 = acc5 + partial_summaries[base + 5u];
    let r6 = partial_summaries[base + 6u];
    acc6 = vec4<f32>(acc6.xyz + r6.xyz, max(acc6.w, r6.w));
  }
  rx_sum_r0[lane] = acc0;
  rx_sum_r1[lane] = acc1;
  rx_sum_r2[lane] = acc2;
  rx_sum_r3[lane] = acc3;
  rx_sum_r4[lane] = acc4;
  rx_sum_r5[lane] = acc5;
  rx_sum_r6[lane] = acc6;
  workgroupBarrier();
  var stride = 32u;
  loop {
    if (stride == 0u) { break; }
    if (lane < stride) {
      rx_sum_r0[lane] = rx_sum_r0[lane] + rx_sum_r0[lane + stride];
      rx_sum_r1[lane] = rx_sum_r1[lane] + rx_sum_r1[lane + stride];
      rx_sum_r2[lane] = rx_sum_r2[lane] + rx_sum_r2[lane + stride];
      rx_sum_r3[lane] = rx_sum_r3[lane] + rx_sum_r3[lane + stride];
      rx_sum_r4[lane] = rx_sum_r4[lane] + rx_sum_r4[lane + stride];
      rx_sum_r5[lane] = rx_sum_r5[lane] + rx_sum_r5[lane + stride];
      let a = rx_sum_r6[lane];
      let b = rx_sum_r6[lane + stride];
      rx_sum_r6[lane] = vec4<f32>(a.xyz + b.xyz, max(a.w, b.w));
    }
    workgroupBarrier();
    stride = stride / 2u;
  }
  if (lane != 0u) { return; }
  let r0 = rx_sum_r0[0];
  let r1 = rx_sum_r1[0];
  let r2 = rx_sum_r2[0];
  let r3 = rx_sum_r3[0];
  let r4 = rx_sum_r4[0];
  let r5 = rx_sum_r5[0];
  let r6 = rx_sum_r6[0];
  let changed_material = r0.x;
  let changed_mass = r0.y;
  let visible_product_mass = r0.z;
  let visible_gas_product_mass = r0.w;
  let output_gas_phase_mass = r1.x;
  let source_mass = r1.y;
  let next_mass = r1.z;
  let thermal_ready = r2.x;
  let thermal_problem = r2.y;
  let finite_temperature = r2.z;
  let canonical_events = r3.x;
  let consumed_reactant_mass = r3.y;
  let expected_product_mass = r3.z;
  let raw_product_mass = r3.w;
  let ledger_visible_product_mass = r4.x;
  let ledger_unplaced_product_mass = r4.y;
  let ledger_gas_product_mass = r4.z;
  let ledger_visible_gas_product_mass = r4.w;
  let ledger_unplaced_gas_product_mass = r5.x;
  let sealed_box_gas_product_moles = r5.y;
  let reaction_heat = r5.z;
  let ledger_mass_residual = r5.w;
  let ledger_ready_events = r6.x;
  let ledger_problem_events = r6.y;
  let mutual_pairs = r6.z;
  let compact_ledger_available = r6.w;
  reaction_summary[0u] = vec4<f32>(
    f32(params.particle_count),
    f32(params.reaction_count),
    f32(params.product_term_count),
    f32(params.gas_product_count)
  );
  reaction_summary[1u] = vec4<f32>(
    changed_material,
    changed_mass,
    visible_product_mass,
    visible_gas_product_mass
  );
  reaction_summary[2u] = vec4<f32>(
    output_gas_phase_mass,
    source_mass,
    next_mass,
    next_mass - source_mass
  );
  reaction_summary[3u] = vec4<f32>(
    thermal_ready,
    thermal_problem,
    finite_temperature,
    1.0
  );
  reaction_summary[4u] = vec4<f32>(
    canonical_events,
    consumed_reactant_mass,
    expected_product_mass,
    raw_product_mass
  );
  reaction_summary[5u] = vec4<f32>(
    ledger_visible_product_mass,
    ledger_unplaced_product_mass,
    ledger_gas_product_mass,
    ledger_visible_gas_product_mass
  );
  reaction_summary[6u] = vec4<f32>(
    ledger_unplaced_gas_product_mass,
    sealed_box_gas_product_moles,
    reaction_heat,
    ledger_mass_residual
  );
  reaction_summary[7u] = vec4<f32>(
    ledger_ready_events,
    ledger_problem_events,
    mutual_pairs,
    compact_ledger_available
  );
}
`;

export function createSphReactionProductInventoryWgsl({ sharedAllocation = false } = {}) {
  return `
${sphReactionEnergyWgsl}
${sharedAllocation ? sphReactionPairReaderWgsl + `
fn physical_reaction_pair_applied(rx: u32, a: u32, b: u32) -> bool {
  if (!reaction_energy_enabled(rx)) { return true; }
  return pair_allocation_ready(rx, a, b);
}` : sphReactionAppliedPairWgsl}
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  _pad0: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  // Phase-carrier v2 lineage capacity (summary params word 11), or 0.
  phase_lineage_capacity: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> product_inventory: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ReactionSummaryParams;

// Mirrors the step kernel's in-place hosting deferral (reaction_row_hosts_product)
// on the same pre-reaction state: a pair whose freed parent cannot host its
// product did not react, so no ledger may count its consumption.
fn reaction_lineage_row_hosts(index: u32) -> bool {
  let capacity = params.phase_lineage_capacity;
  if (capacity == 0u || capacity * 4u != params.particle_count) { return true; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let row = lane * capacity + lineage;
    if (row != index && source_state[row * 2u].w != 0.0) { return false; }
  }
  return true;
}

fn reaction_pair_deferred(a: u32, a_mass: f32, a_consumed: f32, b: u32, b_mass: f32, b_consumed: f32, energy: bool) -> bool {
  let a_remaining = max(a_mass - a_consumed, 0.0);
  let b_remaining = max(b_mass - b_consumed, 0.0);
  let a_free = a_remaining <= select(max(a_mass, 1.0) * 1.0e-7, 0.0, energy);
  let b_free = b_remaining <= select(max(b_mass, 1.0) * 1.0e-7, 0.0, energy);
  return (a_free && !reaction_lineage_row_hosts(a)) || (b_free && !reaction_lineage_row_hosts(b));
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

// Gauge-consistent heat proxy (src/runtime/sph/sphReactionHeatProxyGauge.js):
// the product term's runtime-gauge offset (word 15), 0 on single-gauge tables.
fn product_term_gauge(term_index: u32) -> f32 {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u].w;
}

fn product_term_row3(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let product_term_index = global_id.x;
  if (product_term_index >= params.product_term_count) {
    return;
  }
  let term0 = product_term_row0(product_term_index);
  let term1 = product_term_row1(product_term_index);
  let term3 = product_term_row3(product_term_index);
  let reaction_index = u32(max(term0.x, 0.0));
  let material_id = term0.y;
  let coefficient = term0.z;
  let molar_mass = term0.w;
  let routing_id = term1.y;
  let status = term1.w;
  let charge = term3.z;
  var raw_mass_kg = 0.0;
  var mass_kg = 0.0;
  var moles = 0.0;
  var visible_mass_kg = 0.0;
  var event_count = 0.0;
  var mass_scale_acc = 0.0;

  if (params.has_proposals != 0u && status == 1.0 && molar_mass > 0.0 && coefficient > 0.0) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let proposal = proposals[particle_index];
      if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index) {
        continue;
      }
      let partner_index = u32(proposal.x + 0.5);
      if (partner_index >= params.particle_count || particle_index >= partner_index) {
        continue;
      }
      let partner_proposal = proposals[partner_index];
      if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
        continue;
      }
      if (!physical_reaction_pair_applied(reaction_index, particle_index, partner_index)) { continue; }
${sharedAllocation ? `      if (reaction_energy_enabled(reaction_index)) {
        let base = pair_event_base(particle_index, product_term_index);
        let chosen_mass = pair_allocations[base].w;
        let chosen_moles = pair_allocations[base + 2u].y;
        let chosen_direct = pair_allocations[base + 3u].x;
        let chosen_pair = pair_allocations[pair_allocation_base(particle_index) + 1u];
        raw_mass_kg += chosen_pair.x * coefficient * molar_mass;
        mass_kg += chosen_mass; moles += chosen_moles; visible_mass_kg += chosen_direct;
        mass_scale_acc += pair_allocations[pair_allocation_base(particle_index) + 2u].y;
        event_count += 1.0; continue;
      }` : ''}
      let source_pos_mass = source_state[particle_index * 2u];
      let partner_source_pos_mass = source_state[partner_index * 2u];
      let source_row0 = source_thermo[particle_index * 3u];
      let partner_source_row0 = source_thermo[partner_index * 3u];
      let source_term = reactant_term_for_material(reaction_index, source_row0.x);
      let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
      let has_stoichiometry = source_term.status == 1.0
        && partner_term.status == 1.0
        && source_term.coefficient > 0.0
        && partner_term.coefficient > 0.0
        && source_term.molar_mass > 0.0
        && partner_term.molar_mass > 0.0;
      if (!has_stoichiometry) {
        continue;
      }
      let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
      let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
      // Identical flux cap as the apply kernel so every ledger agrees on the
      // consumed extent (divergence here mints phantom product mass).
      let extent_availability_mol = min(source_extent, partner_extent);
      let extent_flux_cap_mol = interface_flux_extent_cap_mol(
        source_pos_mass.w, source_row0.w, source_row0.z,
        source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
        partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
        partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
        params.dt_s
      );
      let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
      let source_consumed = reaction_consumed_mass(reaction_index, source_pos_mass.w, extent_mol, source_term.coefficient, source_term.molar_mass);
      let partner_consumed = reaction_consumed_mass(reaction_index, partner_source_pos_mass.w, extent_mol, partner_term.coefficient, partner_term.molar_mass);
      let consumed_mass = source_consumed + partner_consumed;
      let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
      if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
        continue;
      }
      if (reaction_pair_deferred(particle_index, source_pos_mass.w, source_consumed,
          partner_index, partner_source_pos_mass.w, partner_consumed, reaction_energy_enabled(reaction_index))) {
        continue;
      }
      let mass_scale = consumed_mass / raw_product_mass;
      let row_raw_mass = extent_mol * coefficient * molar_mass;
      let row_mass = row_raw_mass * mass_scale;
      raw_mass_kg = raw_mass_kg + row_raw_mass;
      mass_kg = mass_kg + row_mass;
      moles = moles + row_mass / molar_mass;
      mass_scale_acc = mass_scale_acc + mass_scale;
      let next0 = next_thermo[particle_index * 3u];
      let next1 = next_thermo[partner_index * 3u];
      if (next0.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_state[particle_index * 2u].w;
      }
      if (next1.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_state[partner_index * 2u].w;
      }
      event_count = event_count + 1.0;
    }
  }

  let out_base = product_term_index * 4u;
  let unplaced_mass_kg = max(mass_kg - visible_mass_kg, 0.0);
  let mean_mass_scale = select(0.0, mass_scale_acc / event_count, event_count > 0.0);
  product_inventory[out_base] = vec4<f32>(material_id, mass_kg, visible_mass_kg, unplaced_mass_kg);
  product_inventory[out_base + 1u] = vec4<f32>(moles, event_count, f32(product_term_index), f32(reaction_index));
  product_inventory[out_base + 2u] = vec4<f32>(routing_id, moles * charge, raw_mass_kg - mass_kg, status);
  product_inventory[out_base + 3u] = vec4<f32>(coefficient, molar_mass, raw_mass_kg, mean_mass_scale);
}
`;

}
export const sphReactionProductInventoryWgsl = createSphReactionProductInventoryWgsl();

export function createSphReactionProductEventWgsl({ sharedAllocation = false } = {}) {
  return `
${sphReactionEnergyWgsl}
${sharedAllocation ? sphReactionPairReaderWgsl + `
fn physical_reaction_pair_applied(rx: u32, a: u32, b: u32) -> bool {
  if (!reaction_energy_enabled(rx)) { return true; }
  return pair_allocation_ready(rx, a, b);
}` : sphReactionAppliedPairWgsl}
${sphGasConstitutiveWgsl}
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  atom_term_count: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  gas_constitutive_offset: u32,
  // Phase-carrier v2 lineage capacity, or 0; must match the step kernel's
  // reaction_row_hosts_product so both agree on in-place product hosting.
  phase_lineage_capacity: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

struct ProductMechanics {
  rest_density: f32,
  effective_bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model_id: f32,
  solid_flag: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> product_events: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ReactionSummaryParams;
@group(0) @binding(8) var<storage, read> source_mechanics: array<vec4<f32>>;

// Mirrors the step kernel's reaction_row_hosts_product on the same
// pre-reaction state, so both kernels defer exactly the same pairs.
fn reaction_event_row_hosts_product(index: u32) -> bool {
  let capacity = params.phase_lineage_capacity;
  if (capacity == 0u || capacity * 4u != params.particle_count) { return true; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let row = lane * capacity + lineage;
    if (row != index && source_state[row * 2u].w != 0.0) { return false; }
  }
  return true;
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

fn product_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 2u];
}

fn product_term_row3(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let product_base = header_base + params.reaction_count * 4u + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u];
}

// First-class air, slice 3 stage 2: the spectator table, identical to the
// step kernel's product_term_spectator (the event energy must match apply).
const REACTION_SPECTATOR_SECTION_SENTINEL: f32 = -7340.25;

fn product_term_spectator(term_index: u32) -> vec4<f32> {
  if (params.gas_constitutive_offset < params.product_term_count
      || term_index >= params.product_term_count) {
    return vec4<f32>(0.0);
  }
  let row = reaction_records[
    params.gas_constitutive_offset - params.product_term_count + term_index
  ];
  if (row.w != REACTION_SPECTATOR_SECTION_SENTINEL || row.x != 1.0 || !(row.y > 0.0)) {
    return vec4<f32>(0.0);
  }
  return row;
}

fn spectator_specific_energy(spectator: vec4<f32>, a_material: f32, a_u: f32, b_u: f32) -> f32 {
  return spectator.y * select(b_u, a_u, a_material == spectator.z);
}

fn product_phase_row0(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u];
}

fn product_phase_row1(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u + 1u];
}

fn product_phase_row2(phase_index: u32) -> vec4<f32> {
  let phase_base = params.reaction_count * 3u;
  return reaction_records[phase_base + phase_index * 3u + 2u];
}

fn resolved_product_phase_id(term_index: u32, target_phase_id: f32, material_id: f32) -> f32 {
  if (target_phase_id > 0.0) {
    return target_phase_id;
  }
  let term2 = product_term_row2(term_index);
  let term3 = product_term_row3(term_index);
  let phase_offset = u32(max(term2.w, 0.0));
  let phase_count = u32(max(term3.x, 0.0));
  if (phase_count != 1u || phase_offset >= params.product_phase_count) {
    return 0.0;
  }
  let phase0 = product_phase_row0(phase_offset);
  let phase2 = product_phase_row2(phase_offset);
  if (phase0.x != material_id || !(phase0.y > 0.0) || !(phase0.z > 0.0) || phase2.y != 1.0) {
    return 0.0;
  }
  return phase0.y;
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

// Mirrors product_term_for_parent_slot in the apply kernel, but returns the
// packed product-term index so event provenance can attribute the exact
// freed-parent assignment. Material matching is not sufficient: distinct
// terms may share a material, and reactant remainder mass may share it too.
fn product_term_index_for_parent_slot(reaction_index: u32, parent_slot: u32) -> u32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var condensed_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y < 0.5) {
      condensed_count = condensed_count + 1u;
    }
  }
  if (parent_slot < condensed_count) {
    var condensed_index = 0u;
    for (var local = 0u; local < product_term_count; local = local + 1u) {
      let term_index = product_term_offset + local;
      let term1 = product_term_row1(term_index);
      if (term1.w == 1.0 && term1.y < 0.5) {
        if (condensed_index == parent_slot) {
          return term_index;
        }
        condensed_index = condensed_index + 1u;
      }
    }
  }
  var gas_count = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      gas_count = gas_count + 1u;
    }
  }
  if (gas_count == 0u) {
    return 0xffffffffu;
  }
  let gas_slot = min(parent_slot - condensed_count, gas_count - 1u);
  var gas_index = 0u;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term_index = product_term_offset + local;
    let term1 = product_term_row1(term_index);
    if (term1.w == 1.0 && term1.y >= 0.5) {
      if (gas_index == gas_slot) {
        return term_index;
      }
      gas_index = gas_index + 1u;
    }
  }
  return 0xffffffffu;
}

fn product_mechanics_for(material_id: f32, phase_id: f32, temperature_k: f32) -> ProductMechanics {
  for (var phase_index = 0u; phase_index < params.product_phase_count; phase_index = phase_index + 1u) {
    let row0 = product_phase_row0(phase_index);
    let row1 = product_phase_row1(phase_index);
    let row2 = product_phase_row2(phase_index);
    if (row0.x == material_id && row0.y == phase_id && row2.y == 1.0) {
      var c = row1.z;
      if (row1.w == 2.0 && params.gas_constitutive_offset > 0u) {
        c = gas_constitutive_sound_speed(reaction_records[params.gas_constitutive_offset + phase_index], temperature_k);
      }
      return ProductMechanics(
        row0.z,
        row0.w,
        row1.x,
        row1.y,
        c,
        row1.w,
        row2.x,
        row2.y
      );
    }
  }
  return ProductMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let linear_index = global_id.x;
  let event_capacity = params.particle_count * params.product_term_count;
  if (linear_index >= event_capacity || params.particle_count == 0u) {
    return;
  }
  let particle_index = linear_index / params.product_term_count;
  let product_term_index = linear_index - particle_index * params.product_term_count;
	  let out_base = linear_index * 8u;
	  product_events[out_base] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 1u] = vec4<f32>(0.0, f32(product_term_index), 0.0, f32(particle_index));
	  product_events[out_base + 2u] = vec4<f32>(-1.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 4u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 5u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 6u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	  product_events[out_base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  if (params.has_proposals == 0u || particle_index >= params.particle_count) {
    return;
  }

  let term0 = product_term_row0(product_term_index);
  let term1 = product_term_row1(product_term_index);
  let reaction_index = u32(max(term0.x, 0.0));
  let material_id = term0.y;
	  let coefficient = term0.z;
	  let molar_mass = term0.w;
	  let routing_id = term1.y;
	  let target_phase_id = term1.z;
	  let status = term1.w;
  let proposal = proposals[particle_index];
  if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index || status != 1.0 || molar_mass <= 0.0 || coefficient <= 0.0) {
    return;
  }
  let partner_index = u32(proposal.x + 0.5);
  if (partner_index >= params.particle_count || particle_index >= partner_index) {
    return;
  }
  let partner_proposal = proposals[partner_index];
  if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
    return;
  }

  if (!physical_reaction_pair_applied(reaction_index, particle_index, partner_index)) { return; }
  ${sharedAllocation ? `if (reaction_energy_enabled(reaction_index)) {
    let chosen = pair_event_base(particle_index, product_term_index);
    for (var row = 0u; row < 8u; row++) { product_events[out_base + row] = pair_allocations[chosen + row]; }
    return;
  }` : ''}

  let source_pos_mass = source_state[particle_index * 2u];
  let partner_source_pos_mass = source_state[partner_index * 2u];
  let source_row0 = source_thermo[particle_index * 3u];
  let partner_source_row0 = source_thermo[partner_index * 3u];
  let source_term = reactant_term_for_material(reaction_index, source_row0.x);
  let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
  let has_stoichiometry = source_term.status == 1.0
    && partner_term.status == 1.0
    && source_term.coefficient > 0.0
    && partner_term.coefficient > 0.0
    && source_term.molar_mass > 0.0
    && partner_term.molar_mass > 0.0;
  if (!has_stoichiometry) {
    return;
  }
  let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
  let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
  // Identical flux cap as the apply kernel so every ledger agrees on the
  // consumed extent (divergence here mints phantom product mass).
  let extent_availability_mol = min(source_extent, partner_extent);
  let extent_flux_cap_mol = interface_flux_extent_cap_mol(
    source_pos_mass.w, source_row0.w, source_row0.z,
    source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
    partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
    partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
    params.dt_s
  );
  let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
  let source_consumed = reaction_consumed_mass(reaction_index, source_pos_mass.w, extent_mol, source_term.coefficient, source_term.molar_mass);
  let partner_consumed = reaction_consumed_mass(reaction_index, partner_source_pos_mass.w, extent_mol, partner_term.coefficient, partner_term.molar_mass);
  let consumed_mass = source_consumed + partner_consumed;
  let source_volume_row = source_mechanics[particle_index * 8u + 4u];
  let partner_volume_row = source_mechanics[partner_index * 8u + 4u];
  let source_constitutive_row = source_mechanics[particle_index * 8u + 5u];
  let partner_constitutive_row = source_mechanics[partner_index * 8u + 5u];
  let source_eos_row = source_mechanics[particle_index * 8u + 6u];
  let partner_eos_row = source_mechanics[partner_index * 8u + 6u];
  let source_current_volume = source_volume_row.z * source_volume_row.w;
  let partner_current_volume = partner_volume_row.z * partner_volume_row.w;
  if (
    !all(vec4<bool>(
      source_volume_row.z > 0.0,
      source_volume_row.w > 0.0,
      source_current_volume > 0.0,
      source_current_volume == source_current_volume
    ))
    || !all(vec4<bool>(
      partner_volume_row.z > 0.0,
      partner_volume_row.w > 0.0,
      partner_current_volume > 0.0,
      partner_current_volume == partner_current_volume
    ))
    || abs(source_current_volume) > 3.402823e38
    || abs(partner_current_volume) > 3.402823e38
    || source_constitutive_row.y != 1.0
    || partner_constitutive_row.y != 1.0
    || source_eos_row.w != 1.0
    || partner_eos_row.w != 1.0
  ) {
    return;
  }
  let consumed_current_volume =
    source_current_volume * source_consumed / max(source_pos_mass.w, 1.0e-20)
    + partner_current_volume * partner_consumed / max(partner_source_pos_mass.w, 1.0e-20);
  let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
  if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
    return;
  }
  let mass_scale = consumed_mass / raw_product_mass;
  let row_mass = extent_mol * coefficient * molar_mass * mass_scale;
  let row_moles = row_mass / molar_mass;
  let row_current_volume = consumed_current_volume * row_mass / max(consumed_mass, 1.0e-20);
	  let next0 = next_thermo[particle_index * 3u];
	  let next1 = next_thermo[partner_index * 3u];
	  var phase_id = resolved_product_phase_id(product_term_index, target_phase_id, material_id);
	  var temperature_k = 0.5 * (source_row0.z + partner_source_row0.z);
	  var rest_density_kg_per_m3 = 0.0;
	  if (next0.x == material_id) {
	    phase_id = select(phase_id, next0.y, phase_id <= 0.0);
	    temperature_k = next0.z;
	    rest_density_kg_per_m3 = next0.w;
	  }
	  if (next1.x == material_id) {
	    phase_id = select(phase_id, next1.y, phase_id <= 0.0);
	    temperature_k = next1.z;
	    rest_density_kg_per_m3 = next1.w;
	  }
	  let source_remaining = max(source_pos_mass.w - source_consumed, 0.0);
	  let partner_remaining = max(partner_source_pos_mass.w - partner_consumed, 0.0);
	  let source_free = source_remaining <= select(max(source_pos_mass.w, 1.0) * 1.0e-7, 0.0, reaction_energy_enabled(reaction_index));
	  let partner_free = partner_remaining <= select(max(partner_source_pos_mass.w, 1.0) * 1.0e-7, 0.0, reaction_energy_enabled(reaction_index));
	  // Mirrors the step kernel's deferral: such a pair did not react.
	  if ((source_free && !reaction_event_row_hosts_product(particle_index))
	    || (partner_free && !reaction_event_row_hosts_product(partner_index))) {
	    return;
	  }
	  let reaction_product_term_count = u32(max(reaction_header_row1(reaction_index).x, 0.0));
	  var direct_placed_mass_kg = 0.0;
	  if (source_free && product_term_index_for_parent_slot(reaction_index, 0u) == product_term_index) {
	    direct_placed_mass_kg = direct_placed_mass_kg + select(
	      row_mass,
	      source_consumed,
	      reaction_product_term_count == 1u && partner_free
	    );
	  }
	  let partner_parent_slot = select(0u, 1u, source_free);
	  if (partner_free && product_term_index_for_parent_slot(reaction_index, partner_parent_slot) == product_term_index) {
	    direct_placed_mass_kg = direct_placed_mass_kg + select(
	      row_mass,
	      partner_consumed,
	      reaction_product_term_count == 1u && source_free
	    );
	  }
	  direct_placed_mass_kg = min(max(direct_placed_mass_kg, 0.0), row_mass);
	  let unplaced_mass_kg = max(row_mass - direct_placed_mass_kg, 0.0);
	  let source_velocity = source_state[particle_index * 2u + 1u].xyz;
	  let partner_velocity = source_state[partner_index * 2u + 1u].xyz;
	  let product_velocity = (source_velocity * source_consumed + partner_velocity * partner_consumed)
	    / max(consumed_mass, 1.0e-20);
	  // Specific internal energy is identical to the apply kernel: the consumed
	  // total (internal + kinetic) energy, plus reaction heat, minus the product
	  // COM kinetic energy. Relative approach kinetic energy is thermalized.
	  let source_u = source_state[particle_index * 2u + 1u].w;
	  let partner_u = source_state[partner_index * 2u + 1u].w;
	  let rx1 = reaction_row1(reaction_index);
	  let consumed_total_energy =
	    source_consumed * (source_u + 0.5 * dot(source_velocity, source_velocity))
	    + partner_consumed * (partner_u + 0.5 * dot(partner_velocity, partner_velocity));
	  // Spectator residues (heat-proxy route) keep their own sensible energy;
	  // the real products share the rest (identical to the apply kernel).
	  var spectator_mass = 0.0;
	  var spectator_energy = 0.0;
	  if (!reaction_energy_enabled(reaction_index)) {
	    let spectator_offset = u32(max(reaction_header_row0(reaction_index).w, 0.0));
	    for (var spectator_local = 0u; spectator_local < reaction_product_term_count; spectator_local = spectator_local + 1u) {
	      let spectator = product_term_spectator(spectator_offset + spectator_local);
	      if (spectator.x != 1.0) { continue; }
	      let spectator_term0 = product_term_row0(spectator_offset + spectator_local);
	      let term_mass = extent_mol * spectator_term0.z * spectator_term0.w * mass_scale;
	      spectator_mass = spectator_mass + term_mass;
	      spectator_energy = spectator_energy
	        + term_mass * spectator_specific_energy(spectator, source_row0.x, source_u, partner_u);
	    }
	  }
	  var product_u = (
	    consumed_total_energy
	    - rx1.x * consumed_mass
	    - 0.5 * consumed_mass * dot(product_velocity, product_velocity)
	    - spectator_energy
	  ) / max(consumed_mass - spectator_mass, 1.0e-20)
	    // Gauge-consistent heat proxy offset (word 15), 0 on single-gauge tables.
	    + product_term_row3(product_term_index).w;
	  let event_spectator = product_term_spectator(product_term_index);
	  if (!reaction_energy_enabled(reaction_index) && event_spectator.x == 1.0) {
	    product_u = spectator_specific_energy(event_spectator, source_row0.x, source_u, partner_u);
	  }
	  if (reaction_energy_enabled(reaction_index)) {
	    let temperature = energy_product_temperature(reaction_index, source_row0.x, partner_source_row0.x,
	      source_consumed, partner_consumed, source_state[particle_index * 2u + 1u],
	      source_state[partner_index * 2u + 1u], extent_mol, mass_scale, product_velocity);
	    if (temperature.y != 1.0) { return; }
	    let energy_state = energy_product_state(reaction_index, product_term_index, temperature.x);
	    if (energy_state.z != 1.0 || energy_state.w != phase_id) { return; }
	    product_u = energy_state.x;
	    temperature_k = temperature.x;
	    rest_density_kg_per_m3 = energy_state.y;
	  }
	  let product_mechanics = product_mechanics_for(material_id, phase_id, temperature_k);
	  rest_density_kg_per_m3 = select(rest_density_kg_per_m3, product_mechanics.rest_density,
	    rest_density_kg_per_m3 <= 0.0 && product_mechanics.rest_density > 0.0);
	  let support_volume_m3 = row_current_volume
	    * unplaced_mass_kg / max(row_mass, 1.0e-20);
	  let event_ready = phase_id > 0.0
	    && energy_finite(product_u) && energy_finite(temperature_k) && temperature_k > 0.0
	    && all(abs(product_velocity) <= vec3<f32>(3.402823e38))
	    && rest_density_kg_per_m3 > 0.0
	    && product_mechanics.status == 1.0
	    && product_mechanics.sound_speed >= 0.0
	    && (unplaced_mass_kg <= 0.0 || support_volume_m3 > 0.0);
	  var midpoint = 0.5 * (source_pos_mass.xyz + partner_source_pos_mass.xyz);
	  if (reaction_energy_enabled(reaction_index)) {
	    midpoint = (source_pos_mass.xyz * source_consumed + partner_source_pos_mass.xyz * partner_consumed) / consumed_mass;
	  }
	  product_events[out_base] = vec4<f32>(midpoint.x, midpoint.y, midpoint.z, row_mass);
	  product_events[out_base + 1u] = vec4<f32>(material_id, f32(product_term_index), f32(reaction_index), f32(particle_index));
	  product_events[out_base + 2u] = vec4<f32>(f32(partner_index), row_moles, routing_id, phase_id);
	  product_events[out_base + 3u] = vec4<f32>(direct_placed_mass_kg, unplaced_mass_kg, coefficient, molar_mass);
	  product_events[out_base + 4u] = vec4<f32>(
	    temperature_k,
	    rest_density_kg_per_m3,
	    select(0.0, 1.0, event_ready),
	    product_u
	  );
	  product_events[out_base + 5u] = vec4<f32>(product_velocity.x, product_velocity.y, product_velocity.z, support_volume_m3);
	  product_events[out_base + 6u] = vec4<f32>(
	    product_mechanics.effective_bulk,
	    product_mechanics.shear,
	    product_mechanics.lambda,
	    product_mechanics.sound_speed
	  );
	  product_events[out_base + 7u] = vec4<f32>(
	    product_mechanics.eos_model_id,
	    product_mechanics.solid_flag,
	    product_mechanics.status,
	    select(0.0, 1.0, event_ready)
	  );
	}
`;

}
export const sphReactionProductEventWgsl = createSphReactionProductEventWgsl();

export function createSphReactionAtomResidualWgsl({ sharedAllocation = false } = {}) {
  return `
${sphReactionEnergyWgsl}
${sharedAllocation ? sphReactionPairReaderWgsl + `
fn physical_reaction_pair_applied(rx: u32, a: u32, b: u32) -> bool {
  if (!reaction_energy_enabled(rx)) { return true; }
  return pair_allocation_ready(rx, a, b);
}` : sphReactionAppliedPairWgsl}
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  atom_term_count: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  // Phase-carrier v2 lineage capacity (summary params word 11), or 0.
  phase_lineage_capacity: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> atom_residuals: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: ReactionSummaryParams;

// Mirrors the step kernel's in-place hosting deferral (reaction_row_hosts_product)
// on the same pre-reaction state: a pair whose freed parent cannot host its
// product did not react, so no ledger may count its consumption.
fn reaction_lineage_row_hosts(index: u32) -> bool {
  let capacity = params.phase_lineage_capacity;
  if (capacity == 0u || capacity * 4u != params.particle_count) { return true; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let row = lane * capacity + lineage;
    if (row != index && source_state[row * 2u].w != 0.0) { return false; }
  }
  return true;
}

fn reaction_pair_deferred(a: u32, a_mass: f32, a_consumed: f32, b: u32, b_mass: f32, b_consumed: f32, energy: bool) -> bool {
  let a_remaining = max(a_mass - a_consumed, 0.0);
  let b_remaining = max(b_mass - b_consumed, 0.0);
  let a_free = a_remaining <= select(max(a_mass, 1.0) * 1.0e-7, 0.0, energy);
  let b_free = b_remaining <= select(max(b_mass, 1.0) * 1.0e-7, 0.0, energy);
  return (a_free && !reaction_lineage_row_hosts(a)) || (b_free && !reaction_lineage_row_hosts(b));
}
@group(0) @binding(6) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> next_thermo: array<vec4<f32>>;

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

// Gauge-consistent heat proxy (src/runtime/sph/sphReactionHeatProxyGauge.js):
// the product term's runtime-gauge offset (word 15), 0 on single-gauge tables.
fn product_term_gauge(term_index: u32) -> f32 {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u].w;
}

fn atom_term_row(atom_term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  let atom_base = gas_base + params.gas_product_count * 2u;
  return reaction_records[atom_base + atom_term_index * 2u];
}

fn atom_term_row1(atom_term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  let atom_base = gas_base + params.gas_product_count * 2u;
  return reaction_records[atom_base + atom_term_index * 2u + 1u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let atom_term_index = global_id.x;
  if (atom_term_index >= params.atom_term_count) {
    return;
  }
  let atom0 = atom_term_row(atom_term_index);
  let atom1 = atom_term_row1(atom_term_index);
  let reaction_index = u32(max(atom0.x, 0.0));
  let term_kind_id = atom0.y;
  let source_term_index = atom0.z;
  let atomic_number_z = atom0.w;
  let atoms_per_formula = atom1.x;
  let coefficient = atom1.y;
  let charge = atom1.z;
  let status = atom1.w;
  var atom_residual_mol = 0.0;
  var charge_residual_mol = 0.0;
  var event_count = 0.0;

  if (params.has_proposals != 0u && status == 1.0 && atomic_number_z > 0.0 && atoms_per_formula > 0.0 && coefficient > 0.0) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let proposal = proposals[particle_index];
      if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index) {
        continue;
      }
      let partner_index = u32(proposal.x + 0.5);
      if (partner_index >= params.particle_count || particle_index >= partner_index) {
        continue;
      }
      let partner_proposal = proposals[partner_index];
      if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
        continue;
      }
      if (!physical_reaction_pair_applied(reaction_index, particle_index, partner_index)) { continue; }
${sharedAllocation ? `      if (reaction_energy_enabled(reaction_index)) {
        var chosen_moles = 0.0;
        if (term_kind_id == 2.0) {
          chosen_moles = pair_allocations[pair_event_base(particle_index, u32(source_term_index)) + 2u].y;
        } else {
          let term = reactant_term_row0(u32(source_term_index));
          let chosen = pair_allocations[pair_allocation_base(particle_index) + 1u];
          chosen_moles = select(chosen.z, chosen.y, source_thermo[particle_index * 3u].x == term.y) / term.w;
        }
        let sign = select(-1.0, 1.0, term_kind_id == 2.0);
        atom_residual_mol += sign * chosen_moles * atoms_per_formula;
        charge_residual_mol += sign * chosen_moles * charge;
        event_count += 1.0; continue;
      }` : ''}
      let source_pos_mass = source_state[particle_index * 2u];
      let partner_source_pos_mass = source_state[partner_index * 2u];
      let source_row0 = source_thermo[particle_index * 3u];
      let partner_source_row0 = source_thermo[partner_index * 3u];
      let source_term = reactant_term_for_material(reaction_index, source_row0.x);
      let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
      let has_stoichiometry = source_term.status == 1.0
        && partner_term.status == 1.0
        && source_term.coefficient > 0.0
        && partner_term.coefficient > 0.0
        && source_term.molar_mass > 0.0
        && partner_term.molar_mass > 0.0;
      if (!has_stoichiometry) {
        continue;
      }
      let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
      let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
      // Identical flux cap as the apply kernel so every ledger agrees on the
      // consumed extent (divergence here mints phantom product mass).
      let extent_availability_mol = min(source_extent, partner_extent);
      let extent_flux_cap_mol = interface_flux_extent_cap_mol(
        source_pos_mass.w, source_row0.w, source_row0.z,
        source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
        partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
        partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
        params.dt_s
      );
      let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
      let source_consumed = reaction_consumed_mass(reaction_index, source_pos_mass.w, extent_mol, source_term.coefficient, source_term.molar_mass);
      let partner_consumed = reaction_consumed_mass(reaction_index, partner_source_pos_mass.w, extent_mol, partner_term.coefficient, partner_term.molar_mass);
      let consumed_mass = source_consumed + partner_consumed;
      let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
      if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
        continue;
      }
      if (reaction_pair_deferred(particle_index, source_pos_mass.w, source_consumed,
          partner_index, partner_source_pos_mass.w, partner_consumed, reaction_energy_enabled(reaction_index))) {
        continue;
      }
      let mass_scale = consumed_mass / raw_product_mass;
      let product_side_scale = select(1.0, mass_scale, term_kind_id == 2.0);
      let sign = select(-1.0, 1.0, term_kind_id == 2.0);
      let term_moles = extent_mol * coefficient * product_side_scale;
      atom_residual_mol = atom_residual_mol + sign * term_moles * atoms_per_formula;
      charge_residual_mol = charge_residual_mol + sign * term_moles * charge;
      event_count = event_count + 1.0;
    }
  }

  let out_base = atom_term_index * 2u;
  atom_residuals[out_base] = vec4<f32>(f32(reaction_index), atomic_number_z, atom_residual_mol, charge_residual_mol);
  atom_residuals[out_base + 1u] = vec4<f32>(event_count, term_kind_id, source_term_index, status);
}
`;

}
export const sphReactionAtomResidualWgsl = createSphReactionAtomResidualWgsl();

export function createSphReactionGasSpeciesSummaryWgsl({ sharedAllocation = false } = {}) {
  return `
${sphReactionEnergyWgsl}
${sharedAllocation ? sphReactionPairReaderWgsl + `
fn physical_reaction_pair_applied(rx: u32, a: u32, b: u32) -> bool {
  if (!reaction_energy_enabled(rx)) { return true; }
  return pair_allocation_ready(rx, a, b);
}` : sphReactionAppliedPairWgsl}
struct ReactionSummaryParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  reactant_term_count: u32,
  product_term_count: u32,
  gas_product_count: u32,
  partial_count: u32,
  has_proposals: u32,
  _pad0: u32,
  // Interface-flux extent law substep duration (offset 36 in the shared
  // summary params packer); must match the apply kernel's dt_s.
  dt_s: f32,
  _pad2: u32,
  // Phase-carrier v2 lineage capacity (summary params word 11), or 0.
  phase_lineage_capacity: u32,
};

struct ReactantTerm {
  material_id: f32,
  coefficient: f32,
  molar_mass: f32,
  status: f32,
  // Interface mass flux [kg/m^2/s] at the reference temperature — the
  // transport prefactor for the interface-flux extent law (see the shared
  // helper); packed by the reaction-table builder in the term row pad lane.
  interface_flux: f32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> next_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> proposals: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> gas_species_summaries: array<vec4<f32>>;
@group(0) @binding(7) var<uniform> params: ReactionSummaryParams;

// Mirrors the step kernel's in-place hosting deferral (reaction_row_hosts_product)
// on the same pre-reaction state: a pair whose freed parent cannot host its
// product did not react, so no ledger may count its consumption.
fn reaction_lineage_row_hosts(index: u32) -> bool {
  let capacity = params.phase_lineage_capacity;
  if (capacity == 0u || capacity * 4u != params.particle_count) { return true; }
  let lineage = index % capacity;
  for (var lane = 0u; lane < 4u; lane = lane + 1u) {
    let row = lane * capacity + lineage;
    if (row != index && source_state[row * 2u].w != 0.0) { return false; }
  }
  return true;
}

fn reaction_pair_deferred(a: u32, a_mass: f32, a_consumed: f32, b: u32, b_mass: f32, b_consumed: f32, energy: bool) -> bool {
  let a_remaining = max(a_mass - a_consumed, 0.0);
  let b_remaining = max(b_mass - b_consumed, 0.0);
  let a_free = a_remaining <= select(max(a_mass, 1.0) * 1.0e-7, 0.0, energy);
  let b_free = b_remaining <= select(max(b_mass, 1.0) * 1.0e-7, 0.0, energy);
  return (a_free && !reaction_lineage_row_hosts(a)) || (b_free && !reaction_lineage_row_hosts(b));
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_header_row0(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u];
}

fn reaction_header_row1(reaction_index: u32) -> vec4<f32> {
  let base = (params.reaction_count + params.product_phase_count) * 3u;
  return reaction_records[base + reaction_index * 4u + 1u];
}

fn reactant_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u];
}

fn reactant_term_row2(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  return reaction_records[reactant_base + term_index * 3u + 2u];
}

fn product_term_row0(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u];
}

fn product_term_row1(term_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 1u];
}

// Gauge-consistent heat proxy (src/runtime/sph/sphReactionHeatProxyGauge.js):
// the product term's runtime-gauge offset (word 15), 0 on single-gauge tables.
fn product_term_gauge(term_index: u32) -> f32 {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  return reaction_records[product_base + term_index * 4u + 3u].w;
}

fn gas_product_row0(gas_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  return reaction_records[gas_base + gas_index * 2u];
}

fn gas_product_row1(gas_index: u32) -> vec4<f32> {
  let header_base = (params.reaction_count + params.product_phase_count) * 3u;
  let reactant_base = header_base + params.reaction_count * 4u;
  let product_base = reactant_base + params.reactant_term_count * 3u;
  let gas_base = product_base + params.product_term_count * 4u;
  return reaction_records[gas_base + gas_index * 2u + 1u];
}

// Interface-flux extent cap [mol] for one reacting pair over one substep.
// A contact event may only convert as much matter as transport can deliver
// through the contact interface: extent_rate = A_contact * max_i(nu_i /
// (coef_i * M_i)) where nu_i is reactant i's interface mass flux [kg/m^2/s]
// at its current temperature and the max expresses that the mobile species'
// pathway governs (e.g. water vapor reaching a sodium surface). A_contact is
// the contact disc of the smaller rest-volume radius - the same contact
// geometry the pair-conduction law uses - so thermal and chemical transport
// see one consistent interface. nu scales as sqrt(T/T_ref) (effusion flux
// rho*vbar/4 with vbar ~ sqrt(T)); the vapor-carrier density's exponential
// Clausius-Clapeyron growth with T is NOT modelled - a conservative,
// documented frontier gap. When neither reactant carries a derivable flux
// (nu_i = 0: condensed-condensed, non-volatile) or dt is 0 (stale packer),
// the cap disables and the stoichiometric availability bound alone applies -
// the pre-flux-law behavior. Every module that computes a reaction extent
// (apply, summary partials, product inventory, product events, atom
// residual, gas species) MUST apply this identical cap or their ledgers
// disagree and phantom product mass appears.
const INTERFACE_FLUX_REFERENCE_TEMPERATURE_K: f32 = 293.15;

fn interface_flux_extent_cap_mol(
  self_mass_kg: f32,
  self_rest_density: f32,
  self_temperature_k: f32,
  self_coefficient: f32,
  self_molar_mass: f32,
  self_interface_flux: f32,
  partner_mass_kg: f32,
  partner_rest_density: f32,
  partner_temperature_k: f32,
  partner_coefficient: f32,
  partner_molar_mass: f32,
  partner_interface_flux: f32,
  dt_s: f32
) -> f32 {
  let no_cap = 3.0e38;
  if (dt_s <= 0.0) {
    return no_cap;
  }
  let self_rate = self_interface_flux
    * sqrt(max(self_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(self_coefficient * self_molar_mass, 1.0e-20);
  let partner_rate = partner_interface_flux
    * sqrt(max(partner_temperature_k, 1.0) / INTERFACE_FLUX_REFERENCE_TEMPERATURE_K)
    / max(partner_coefficient * partner_molar_mass, 1.0e-20);
  let mobile_rate = max(self_rate, partner_rate);
  if (mobile_rate <= 0.0) {
    return no_cap;
  }
  let self_radius = pow(
    max(3.0 * self_mass_kg / (12.5663706 * max(self_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let partner_radius = pow(
    max(3.0 * partner_mass_kg / (12.5663706 * max(partner_rest_density, 1.0e-6)), 1.0e-30),
    1.0 / 3.0
  );
  let contact_radius = min(self_radius, partner_radius);
  let contact_area = 3.14159265 * contact_radius * contact_radius;
  return mobile_rate * contact_area * dt_s;
}

fn reactant_term_for_material(reaction_index: u32, material_id: f32) -> ReactantTerm {
  let header0 = reaction_header_row0(reaction_index);
  let reactant_term_offset = u32(max(header0.y, 0.0));
  let reactant_term_count = u32(max(header0.z, 0.0));
  for (var local = 0u; local < reactant_term_count; local = local + 1u) {
    let term_index = reactant_term_offset + local;
    let term0 = reactant_term_row0(term_index);
    let term2 = reactant_term_row2(term_index);
    if (term0.y == material_id && term2.z == 1.0) {
      return ReactantTerm(term0.y, term0.z, term0.w, term2.z, term2.w);
    }
  }
  return ReactantTerm(0.0, 0.0, 0.0, 0.0, 0.0);
}

fn product_raw_mass_sum_for_extent(reaction_index: u32, extent_mol: f32) -> f32 {
  let header0 = reaction_header_row0(reaction_index);
  let header1 = reaction_header_row1(reaction_index);
  let product_term_offset = u32(max(header0.w, 0.0));
  let product_term_count = u32(max(header1.x, 0.0));
  var sum = 0.0;
  for (var local = 0u; local < product_term_count; local = local + 1u) {
    let term0 = product_term_row0(product_term_offset + local);
    let term1 = product_term_row1(product_term_offset + local);
    if (term1.w == 1.0 && term0.z > 0.0 && term0.w > 0.0) {
      sum = sum + extent_mol * term0.z * term0.w;
    }
  }
  return sum;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let gas_index = global_id.x;
  if (gas_index >= params.gas_product_count) {
    return;
  }
  let gas0 = gas_product_row0(gas_index);
  let gas1 = gas_product_row1(gas_index);
  let reaction_index = u32(max(gas0.x, 0.0));
  let material_id = gas0.z;
  let moles_per_extent = gas0.w;
  let molar_mass = gas1.x;
  let status = gas1.z;
  var mass_kg = 0.0;
  var moles = 0.0;
  var visible_mass_kg = 0.0;
  var event_count = 0.0;

  if (params.has_proposals != 0u && status == 1.0 && molar_mass > 0.0 && moles_per_extent > 0.0) {
    for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
      let proposal = proposals[particle_index];
      if (proposal.x < 0.0 || proposal.y < 0.0 || u32(proposal.y + 0.5) != reaction_index) {
        continue;
      }
      let partner_index = u32(proposal.x + 0.5);
      if (partner_index >= params.particle_count || particle_index >= partner_index) {
        continue;
      }
      let partner_proposal = proposals[partner_index];
      if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
        continue;
      }
      if (!physical_reaction_pair_applied(reaction_index, particle_index, partner_index)) { continue; }
${sharedAllocation ? `      if (reaction_energy_enabled(reaction_index)) {
        // The gas ABI has one row per product term, even for repeated species.
        let base = pair_event_base(particle_index, u32(gas0.y));
        mass_kg += pair_allocations[base].w;
        moles += pair_allocations[base + 2u].y;
        visible_mass_kg += pair_allocations[base + 3u].x;
        event_count += 1.0; continue;
      }` : ''}
      let source_pos_mass = source_state[particle_index * 2u];
      let partner_source_pos_mass = source_state[partner_index * 2u];
      let source_row0 = source_thermo[particle_index * 3u];
      let partner_source_row0 = source_thermo[partner_index * 3u];
      let source_term = reactant_term_for_material(reaction_index, source_row0.x);
      let partner_term = reactant_term_for_material(reaction_index, partner_source_row0.x);
      let has_stoichiometry = source_term.status == 1.0
        && partner_term.status == 1.0
        && source_term.coefficient > 0.0
        && partner_term.coefficient > 0.0
        && source_term.molar_mass > 0.0
        && partner_term.molar_mass > 0.0;
      if (!has_stoichiometry) {
        continue;
      }
      let source_extent = source_pos_mass.w / max(source_term.coefficient * source_term.molar_mass, 1.0e-20);
      let partner_extent = partner_source_pos_mass.w / max(partner_term.coefficient * partner_term.molar_mass, 1.0e-20);
      // Identical flux cap as the apply kernel so every ledger agrees on the
      // consumed extent (divergence here mints phantom product mass).
      let extent_availability_mol = min(source_extent, partner_extent);
      let extent_flux_cap_mol = interface_flux_extent_cap_mol(
        source_pos_mass.w, source_row0.w, source_row0.z,
        source_term.coefficient, source_term.molar_mass, source_term.interface_flux,
        partner_source_pos_mass.w, partner_source_row0.w, partner_source_row0.z,
        partner_term.coefficient, partner_term.molar_mass, partner_term.interface_flux,
        params.dt_s
      );
      let extent_mol = min(extent_availability_mol, extent_flux_cap_mol);
      let source_consumed = reaction_consumed_mass(reaction_index, source_pos_mass.w, extent_mol, source_term.coefficient, source_term.molar_mass);
      let partner_consumed = reaction_consumed_mass(reaction_index, partner_source_pos_mass.w, extent_mol, partner_term.coefficient, partner_term.molar_mass);
      let consumed_mass = source_consumed + partner_consumed;
      let raw_product_mass = product_raw_mass_sum_for_extent(reaction_index, extent_mol);
      if (extent_mol <= 0.0 || consumed_mass <= 0.0 || raw_product_mass <= 0.0) {
        continue;
      }
      if (reaction_pair_deferred(particle_index, source_pos_mass.w, source_consumed,
          partner_index, partner_source_pos_mass.w, partner_consumed, reaction_energy_enabled(reaction_index))) {
        continue;
      }
      let mass_scale = consumed_mass / raw_product_mass;
      let species_mass = extent_mol * moles_per_extent * molar_mass * mass_scale;
      let species_moles = species_mass / molar_mass;
      let next0 = next_thermo[particle_index * 3u];
      let next1 = next_thermo[partner_index * 3u];
      let next_mass0 = next_state[particle_index * 2u].w;
      let next_mass1 = next_state[partner_index * 2u].w;
      mass_kg = mass_kg + species_mass;
      moles = moles + species_moles;
      if (next0.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_mass0;
      }
      if (next1.x == material_id) {
        visible_mass_kg = visible_mass_kg + next_mass1;
      }
      event_count = event_count + 1.0;
    }
  }

  let out_base = gas_index * 2u;
  gas_species_summaries[out_base] = vec4<f32>(material_id, mass_kg, moles, visible_mass_kg);
  gas_species_summaries[out_base + 1u] = vec4<f32>(max(mass_kg - visible_mass_kg, 0.0), event_count, f32(gas_index), status);
}
`;

}
export const sphReactionGasSpeciesSummaryWgsl = createSphReactionGasSpeciesSummaryWgsl();

