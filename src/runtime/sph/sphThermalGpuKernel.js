import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  createClosureLawGraphBuffers
} from '../../../ulg-gpu-abi/src/index.js';
import { sphThermalStepWgsl as sphThermalStepLegacyWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { evaluateClosureLawGraphCpu } from '../closureLawGraph.js';
import { GPU_PHASE_IDS, gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { opticalRenderParams } from '../material/opticalClosure.js';
import {
  PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU,
  PRESSURE_CARRIER_LAW_REFERENCE_ONLY
} from '../material/pressureCarrierTransform.js';
import {
  MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT,
  MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA
} from '../material/materialPropertyBank.js';
import {
  orderedSegments,
  segmentEnergyAbove,
  segmentTemperatureFromEnergyAbove
} from '../material/thermoState.js';
import {
  cancelQueueOrderedCleanupClaim,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createQueueOrderedCleanupClaimIssuer,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES,
  SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL,
  SCHROEDER_SPATIAL_THERMAL_CONSUMER,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS,
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION,
  ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA,
  ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_SCHEMA,
  createClassicThermalProposalWebGpuEncoderStage,
  createSchroederSpatialMatchedTimeThermalProposalEncoderStage,
  isLiveThermalProposalSourceAuthority
} from './schroederSpatialThermalProposalsGpu.js';
import {
  isSchroederSpatialExactNearResidentConsumerBinding,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  tagWebGpuBufferDevice,
  typedArrayContentFingerprint,
  webGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  appendGpuReadbackTelemetryObservation,
  createGpuReadbackTelemetry
} from './sphGpuReadbackTelemetry.js';
import {
  SPH_THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT as THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT,
  ULG_SPH_THERMAL_ENVIRONMENT_AUTHORITY_SCHEMA,
  ULG_SPH_WALL_RESERVOIR_AUTHORITY_SCHEMA,
  resolveSphThermalEnvironmentAuthority,
  resolveSphWallReservoirAuthority
} from '../thermalEnvironmentAuthority.js';

function replaceThermalWgslSection(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Unable to install canonical thermal proposal WGSL ${label}`);
  }
  return source.replace(before, after);
}

function createCanonicalThermalProposalApplyWgsl(legacyWgsl) {
  const proposalMagicWgsl = `0x${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC
    .toString(16).padStart(8, '0')}u`;
  const reachableEnergyDomainWgsl = `fn canonical_thermal_reachable_energy_domain(
  material_id: f32,
  specific_internal_energy: f32
) -> vec4<f32> {
  let rejected = vec4<f32>(
    specific_internal_energy,
    specific_internal_energy,
    0.0,
    0.0
  );
  if (!canonical_thermal_proposal_finite(specific_internal_energy)) {
    return rejected;
  }
  var response_offset = 0u;
  var response_count = 0u;
  var found_material = false;
  for (
    var record_index = 0u;
    record_index < params.material_count;
    record_index = record_index + 1u
  ) {
    if (record_index * 2u + 1u >= arrayLength(&phase_response_records)) {
      return rejected;
    }
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      if (
        record.w != 1.0
        || record.y < 0.0
        || record.z <= 0.0
        || floor(record.y) != record.y
        || floor(record.z) != record.z
      ) { return rejected; }
      response_offset = u32(record.y);
      response_count = u32(record.z);
      found_material = true;
      break;
    }
  }
  if (!found_material || response_count == 0u) { return rejected; }

  var domain_lo = 0.0;
  var domain_hi = 0.0;
  var previous_energy_hi = 0.0;
  var previous_temperature_hi = 0.0;
  var containing_count = 0u;
  for (var local = 0u; local < response_count; local = local + 1u) {
    let response_index = response_offset + local;
    if (
      response_index >= params.response_count
      || response_index * 4u + 3u >= arrayLength(&phase_responses)
    ) { return rejected; }
    let response0 = response_row0(response_index);
    let response1 = response_row1(response_index);
    if (
      response0.x != material_id
      || response0.w != 1.0
      || response0.z < 0.0
      || floor(response0.z) != response0.z
      || !canonical_thermal_proposal_finite(response1.x)
      || !canonical_thermal_proposal_finite(response1.y)
      || response1.y < response1.x
    ) { return rejected; }
    let graph_index = u32(response0.z);
    let graph_node_count = arrayLength(&thermal_graph_nodes);
    if (
      graph_node_count < 2u
      || graph_index > (graph_node_count - 2u) / 4u
    ) { return rejected; }
    let node1 = graph_node_row1(graph_index);
    let sample_offset = u32(max(node1.x, 0.0));
    let sample_count = u32(max(node1.y, 0.0));
    if (
      node1.x < 0.0
      || node1.y < 2.0
      || floor(node1.x) != node1.x
      || floor(node1.y) != node1.y
      || node1.z != response1.x
      || node1.w != response1.y
      || sample_offset > arrayLength(&thermal_graph_samples)
      || sample_count > arrayLength(&thermal_graph_samples) - sample_offset
    ) { return rejected; }
    let first = thermal_graph_samples[sample_offset];
    let last = thermal_graph_samples[sample_offset + sample_count - 1u];
    if (
      !canonical_thermal_proposal_finite(first.x)
      || !canonical_thermal_proposal_finite(first.y)
      || !canonical_thermal_proposal_finite(last.x)
      || !canonical_thermal_proposal_finite(last.y)
      || first.x != response1.x
      || last.x != response1.y
    ) { return rejected; }
    for (
      var sample_local = 0u;
      sample_local + 1u < sample_count;
      sample_local = sample_local + 1u
    ) {
      let left = thermal_graph_samples[sample_offset + sample_local];
      let right = thermal_graph_samples[sample_offset + sample_local + 1u];
      if (
        !canonical_thermal_proposal_finite(left.x)
        || !canonical_thermal_proposal_finite(left.y)
        || !canonical_thermal_proposal_finite(right.x)
        || !canonical_thermal_proposal_finite(right.y)
        || right.x < left.x
        || right.y < left.y
      ) { return rejected; }
    }
    if (local == 0u) {
      domain_lo = response1.x;
    } else if (
      response1.x != previous_energy_hi
      || first.y != previous_temperature_hi
    ) {
      return rejected;
    }
    domain_hi = response1.y;
    previous_energy_hi = response1.y;
    previous_temperature_hi = last.y;
    if (
      specific_internal_energy >= response1.x
      && specific_internal_energy <= response1.y
    ) {
      containing_count = containing_count + 1u;
    }
  }
  if (containing_count == 0u || domain_hi < domain_lo) { return rejected; }
  return vec4<f32>(domain_lo, domain_hi, 1.0, f32(response_count));
}

fn canonical_thermal_adjacent_f32(value: f32, toward_positive: bool) -> f32 {
  if (!canonical_thermal_proposal_finite(value)) { return value; }
  if (value == 0.0) {
    return bitcast<f32>(select(0x80000001u, 0x00000001u, toward_positive));
  }
  let bits = bitcast<u32>(value);
  let increment_bits = (value > 0.0) == toward_positive;
  return bitcast<f32>(select(bits - 1u, bits + 1u, increment_bits));
}

fn canonical_thermal_open_reservoir_delta(
  requested_du: f32,
  source_anchor_u: f32,
  pair_adjusted_u: f32,
  anchor_lo: f32,
  anchor_hi: f32,
  reachable_lo: f32,
  reachable_hi: f32
) -> f32 {
  if (
    !canonical_thermal_proposal_finite(requested_du)
    || !canonical_thermal_proposal_finite(source_anchor_u)
    || !canonical_thermal_proposal_finite(pair_adjusted_u)
    || !canonical_thermal_proposal_finite(anchor_lo)
    || !canonical_thermal_proposal_finite(anchor_hi)
    || !canonical_thermal_proposal_finite(reachable_lo)
    || !canonical_thermal_proposal_finite(reachable_hi)
    || anchor_lo > source_anchor_u
    || anchor_hi < source_anchor_u
    || anchor_lo > anchor_hi
    || reachable_lo > pair_adjusted_u
    || reachable_hi < pair_adjusted_u
    || reachable_lo > anchor_lo
    || reachable_hi < anchor_hi
  ) {
    return 0.0;
  }
  if (requested_du > 0.0) {
    var target_hi = anchor_hi;
    if (anchor_hi < reachable_hi) {
      let ingress_u = canonical_thermal_adjacent_f32(anchor_hi, true);
      if (ingress_u <= reachable_hi) { target_hi = ingress_u; }
    }
    return min(requested_du, max(0.0, target_hi - pair_adjusted_u));
  }
  if (requested_du < 0.0) {
    var target_lo = anchor_lo;
    if (anchor_lo > reachable_lo) {
      let ingress_u = canonical_thermal_adjacent_f32(anchor_lo, false);
      if (ingress_u >= reachable_lo) { target_lo = ingress_u; }
    }
    return max(requested_du, min(0.0, target_lo - pair_adjusted_u));
  }
  return 0.0;
}`;
  let code = replaceThermalWgslSection(
    legacyWgsl,
    `  ambient_temperature_k: f32,\n  _pad_b: f32,\n  ambient_radiation_exchange_enabled: u32,\n};`,
    `  ambient_temperature_k: f32,\n  canonical_proposal_enabled: u32,\n  canonical_generation_id: u32,\n  canonical_support_epoch: u32,\n  canonical_position_epoch: u32,\n  canonical_topology_epoch: u32,\n  canonical_storage_generation: u32,\n  canonical_physics_tick: u32,\n  canonical_physics_substep: u32,\n  ambient_radiation_exchange_enabled: u32,\n  _pad_d: u32,\n};`,
    'uniform identity extension'
  );
  code = replaceThermalWgslSection(
    code,
    `@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    `@group(0) @binding(10) var<storage, read> thermal_bins: array<u32>;\n\nconst THERMAL_PROPOSAL_MAGIC: u32 = ${proposalMagicWgsl};\nconst THERMAL_PROPOSAL_VERSION: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION}u;\nconst THERMAL_PROPOSAL_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS}u;\nconst THERMAL_PROPOSAL_ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS}u;\nconst THERMAL_CONDUCTION_SUPPORT_PROFILE_ID: u32 = 0x00010004u;\nconst THERMAL_RADIATION_SUPPORT_PROFILE_ID: u32 = 0x00010005u;\n\nfn canonical_thermal_proposal_header_valid() -> bool {\n  let required_words = THERMAL_PROPOSAL_HEADER_WORDS\n    + params.particle_count * THERMAL_PROPOSAL_ROW_WORDS;\n  return arrayLength(&thermal_bins) >= required_words\n    && thermal_bins[0u] == THERMAL_PROPOSAL_MAGIC\n    && thermal_bins[1u] == THERMAL_PROPOSAL_VERSION\n    && thermal_bins[2u] == params.canonical_generation_id\n    && thermal_bins[3u] == params.canonical_support_epoch\n    && thermal_bins[4u] == params.particle_count\n    && thermal_bins[5u] == THERMAL_PROPOSAL_ROW_WORDS\n    && thermal_bins[6u] == 0u\n    && thermal_bins[7u] == 0u\n    && thermal_bins[8u] == THERMAL_CONDUCTION_SUPPORT_PROFILE_ID\n    && thermal_bins[9u] == THERMAL_RADIATION_SUPPORT_PROFILE_ID\n    && thermal_bins[10u] == params.canonical_position_epoch\n    && thermal_bins[11u] == params.canonical_topology_epoch\n    && thermal_bins[12u] == params.canonical_storage_generation\n    && thermal_bins[13u] == params.canonical_physics_tick\n    && thermal_bins[14u] == params.canonical_physics_substep\n    && thermal_bins[15u] == 0u;\n}\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    'proposal header validator'
  );
  code = replaceThermalWgslSection(
    code,
    `    && thermal_bins[15u] == 0u;\n}\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    `    && thermal_bins[15u] == params.particle_count;\n}\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    'complete proposal row count'
  );
  code = replaceThermalWgslSection(
    code,
    `    && thermal_bins[15u] == params.particle_count;\n}\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    `    && thermal_bins[15u] == params.particle_count;\n}\n\nfn canonical_thermal_proposal_finite(value: f32) -> bool {\n  return value == value && abs(value) <= 3.402823466e+38;\n}\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    'finite-row guard'
  );
  code = replaceThermalWgslSection(
    code,
    `\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    `\n\n${reachableEnergyDomainWgsl}\n\nconst PAIR_CONDUCTION_RELAXATION_LIMIT: f32 = 0.25;`,
    'contiguous monotone reachable energy domain'
  );
  code = replaceThermalWgslSection(
    code,
    `\t  let carrier_domain = thermal_carrier_energy_domain(row0.x, vel_u.w);\n\t  let carrier_domain_ready = carrier_domain.z == 1.0;`,
    `\t  let carrier_domain = thermal_carrier_energy_domain(row0.x, vel_u.w);\n\t  let canonical_reachable_domain = canonical_thermal_reachable_energy_domain(\n\t    row0.x,\n\t    vel_u.w\n\t  );\n\t  let canonical_reachable_domain_ready = canonical_reachable_domain.z == 1.0;\n\t  let carrier_domain_ready = carrier_domain.z == 1.0;`,
    'current constitutive and reachable transport domains'
  );
  code = replaceThermalWgslSection(
    code,
    `\t  if (params.bins_enabled == 1u && params.bin_capacity > 0u && bins_cover_support) {`,
    `\t  if (params.canonical_proposal_enabled == 1u) {\n\t    if (canonical_thermal_proposal_header_valid()) {\n\t      let proposal_base = THERMAL_PROPOSAL_HEADER_WORDS\n\t        + particle_index * THERMAL_PROPOSAL_ROW_WORDS;\n\t      let proposed_conduction_du = bitcast<f32>(thermal_bins[proposal_base]);\n\t      let proposed_radiation_du = bitcast<f32>(thermal_bins[proposal_base + 1u]);\n\t      let proposed_u_lo = bitcast<f32>(thermal_bins[proposal_base + 2u]);\n\t      let proposed_u_hi = bitcast<f32>(thermal_bins[proposal_base + 3u]);\n\t      let proposed_pair_du = proposed_conduction_du + proposed_radiation_du;\n\t      let proposed_next_u = vel_u.w + proposed_pair_du;\n\t      if (\n\t        isFinite(proposed_conduction_du)\n\t        && isFinite(proposed_radiation_du)\n\t        && isFinite(proposed_u_lo)\n\t        && isFinite(proposed_u_hi)\n\t        && isFinite(proposed_next_u)\n\t        && carrier_domain_ready\n\t        && proposed_u_lo <= vel_u.w\n\t        && proposed_u_hi >= vel_u.w\n\t        && proposed_u_lo <= proposed_u_hi\n\t        && proposed_u_lo >= carrier_u_lo\n\t        && proposed_u_hi <= carrier_u_hi\n\t        && proposed_next_u >= proposed_u_lo\n\t        && proposed_next_u <= proposed_u_hi\n\t      ) {\n\t        conduction_du = proposed_pair_du;\n\t        carrier_u_lo = proposed_u_lo;\n\t        carrier_u_hi = proposed_u_hi;\n\t      }\n\t    }\n\t  } else if (params.bins_enabled == 1u && params.bin_capacity > 0u && bins_cover_support) {`,
    'canonical proposal branch'
  );
  code = replaceThermalWgslSection(
    code,
    `\t        && carrier_domain_ready\n\t        && proposed_u_lo <= vel_u.w\n\t        && proposed_u_hi >= vel_u.w\n\t        && proposed_u_lo <= proposed_u_hi\n\t        && proposed_u_lo >= carrier_u_lo\n\t        && proposed_u_hi <= carrier_u_hi`,
    `\t        && canonical_reachable_domain_ready\n\t        && proposed_u_lo <= vel_u.w\n\t        && proposed_u_hi >= vel_u.w\n\t        && proposed_u_lo <= proposed_u_hi\n\t        && proposed_u_lo >= canonical_reachable_domain.x\n\t        && proposed_u_hi <= canonical_reachable_domain.y`,
    'canonical proposal reachable-domain bounds'
  );
  code = replaceThermalWgslSection(
    code,
    `\t  du = du + clamp_du_to_temperature_range(\n\t    conduction_du,\n\t    temperature,\n\t    temperature_slope,\n\t    neighbor_min_temperature,\n\t    neighbor_max_temperature\n\t  );`,
    `\t  if (params.canonical_proposal_enabled == 1u) {\n\t    // Proposal v2 rows have already passed the reciprocal directional\n\t    // energy-domain limiter. Re-clamping their aggregate by temperature\n\t    // would break pair conservation in multi-neighbor gathers.\n\t    du = du + conduction_du;\n\t  } else {\n\t    du = du + clamp_du_to_temperature_range(\n\t      conduction_du,\n\t      temperature,\n\t      temperature_slope,\n\t      neighbor_min_temperature,\n\t      neighbor_max_temperature\n\t    );\n\t  }`,
    'proposal v2 limited-pair apply'
  );
  code = replaceThermalWgslSection(
    code,
    `\t      du = du + clamp_du_to_energy_domain(\n\t        equilibrium_limited_du,\n\t        current_u,\n\t        carrier_u_lo,\n\t        carrier_u_hi\n\t      );`,
    `\t      if (params.canonical_proposal_enabled == 1u\n\t        && canonical_reachable_domain_ready) {\n\t        du = du + canonical_thermal_open_reservoir_delta(\n\t          equilibrium_limited_du,\n\t          vel_u.w,\n\t          current_u,\n\t          carrier_domain.x,\n\t          carrier_domain.y,\n\t          canonical_reachable_domain.x,\n\t          canonical_reachable_domain.y\n\t        );\n\t      } else {\n\t        du = du + clamp_du_to_energy_domain(\n\t          equilibrium_limited_du,\n\t          current_u,\n\t          carrier_u_lo,\n\t          carrier_u_hi\n\t        );\n\t      }`,
    'wall one-ulp phase-boundary ingress'
  );
  code = replaceThermalWgslSection(
    code,
    `\t    du = du + clamp_du_to_energy_domain(\n\t      equilibrium_limited_du,\n\t      current_u,\n\t      carrier_u_lo,\n\t      carrier_u_hi\n\t    );`,
    `\t    if (params.canonical_proposal_enabled == 1u\n\t      && canonical_reachable_domain_ready) {\n\t      du = du + canonical_thermal_open_reservoir_delta(\n\t        equilibrium_limited_du,\n\t        vel_u.w,\n\t        current_u,\n\t        carrier_domain.x,\n\t        carrier_domain.y,\n\t        canonical_reachable_domain.x,\n\t        canonical_reachable_domain.y\n\t      );\n\t    } else {\n\t      du = du + clamp_du_to_energy_domain(\n\t        equilibrium_limited_du,\n\t        current_u,\n\t        carrier_u_lo,\n\t        carrier_u_hi\n\t      );\n\t    }`,
    'ambient one-ulp phase-boundary ingress'
  );
  code = replaceThermalWgslSection(
    code,
    `  if (carrier_domain_ready) {\n    next_u = clamp(\n      select(vel_u.w, candidate_next_u, thermal_value_finite(candidate_next_u)),\n      carrier_u_lo,\n      carrier_u_hi\n    );\n  }`,
    `  if (params.canonical_proposal_enabled == 1u) {\n    if (canonical_reachable_domain_ready) {\n      next_u = clamp(\n        select(vel_u.w, candidate_next_u, thermal_value_finite(candidate_next_u)),\n        canonical_reachable_domain.x,\n        canonical_reachable_domain.y\n      );\n    }\n  } else if (carrier_domain_ready) {\n    next_u = clamp(\n      select(vel_u.w, candidate_next_u, thermal_value_finite(candidate_next_u)),\n      carrier_u_lo,\n      carrier_u_hi\n    );\n  }`,
    'canonical final reachable-domain seal'
  );
  code = code.replaceAll('isFinite(', 'canonical_thermal_proposal_finite(');
  if (
    !code.includes(`THERMAL_PROPOSAL_MAGIC: u32 = ${proposalMagicWgsl}`)
    || !code.includes(
      `THERMAL_PROPOSAL_VERSION: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION}u`
    )
  ) {
    throw new Error('Canonical thermal proposal WGSL ABI constants are stale');
  }
  return code;
}

export const sphThermalStepWgsl = createCanonicalThermalProposalApplyWgsl(
  sphThermalStepLegacyWgsl
);

export {
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA
};

export const SPH_THERMAL_MATERIAL_RECORD_FLOATS = SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_SEGMENT_FLOATS = SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_RESPONSE_RECORD_FLOATS = SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_RESPONSE_FLOATS = SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.length;
export const SPH_THERMAL_CANONICAL_PROPOSAL_VERSION =
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION;
export const SPH_THERMAL_CANONICAL_PROPOSAL_ROW_WORDS =
  SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS;
export const SPH_THERMAL_CLOSURE_GRAPH_SLOTS = Object.freeze({
  specificInternalEnergyJPerKg: 0,
  temperatureK: 1,
  dTemperatureKdSpecificInternalEnergyJPerKg: 2
});
export const SPH_THERMAL_DENSITY_POLICY_IDS = Object.freeze({
  dominantAtHalf: 1
});
export const SPH_THERMAL_STABLE_PHASE_POLICY_IDS = Object.freeze({
  dominantAtHalf: 1
});
export const ULG_SPH_THERMAL_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA =
  'peercompute.ulg.sph-thermal-material-bank-warm-input-consumer.v0';

const THERMAL_SCOPE = 'sph-thermal-closure-table-conduction-walls';
const THERMAL_SEGMENT_TYPES = Object.freeze({ phase: 1, plateau: 2 });
const THERMAL_STATUS = Object.freeze({ ready: 1, missingMaterial: 255 });
const PAIR_CONDUCTION_RELAXATION_LIMIT = 0.25;
// Legacy resident-GPU pair coefficient. The CPU reference no longer consumes
// this demo-scale value: it derives a Fourier conductance from phase bulk
// conductivity and explicit contact geometry. Keep the option until the GPU
// producer/apply ABI migrates to the same material-derived law.
export const SPH_THERMAL_PAIR_CONDUCTION_RATE_DEFAULT = 1500;
export const SPH_THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT =
  THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT;
export {
  ULG_SPH_THERMAL_ENVIRONMENT_AUTHORITY_SCHEMA,
  ULG_SPH_WALL_RESERVOIR_AUTHORITY_SCHEMA
};
export const SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4 = 5.670374419e-8;
// Pair radiation truncation range in units of (r_i + r_j); mirrors the WGSL
// RADIATION_PAIR_RANGE_RADII constant (view factor < ~0.4% beyond it).
export const SPH_THERMAL_RADIATION_PAIR_RANGE_RADII = 4;
// Universal near-gray IR emissivity for condensed dielectrics: fundamental
// molecular/lattice vibrational bands make condensed non-metals near-black in
// thermal infrared (water 0.96, oxides 0.8-0.95). Same estimate class as the
// Drude omega_p/30 damping; refining it per material needs an IR-band optical
// closure (frontier).
const CONDENSED_DIELECTRIC_GRAY_EMISSIVITY = 0.9;

// Kirchhoff's law: emissivity = absorptivity, taken from the derived optical
// closure. Conductors: 1 - R with R the Drude luminous reflectance. Gas-only
// materials: the band-limited absorbed fraction 1 - exp(-opticalDepth) over
// the optics path (visible-band derived; IR ro-vibrational bands are a
// documented frontier gap, so thin diatomics radiate weakly here, which is the
// conservative direction). Condensed dielectrics: universal near-gray IR
// estimate above. Unknown/blocked optics fall to 0 for gases (no derived
// absorption -> transparent to radiation, fail-safe) and to the near-gray
// estimate for condensed matter.
export function deriveGrayEmissivityForMaterial(material, properties = null) {
  const conductionDensity = Number(properties?.conductionElectronDensityPerM3);
  const phases = Array.isArray(properties?.phases) ? properties.phases : [];
  const gasOnly = phases.length > 0 && phases.every((phase) => String(phase?.name).toLowerCase() === 'gas');
  try {
    if (Number.isFinite(conductionDensity) && conductionDensity > 0) {
      const optics = opticalRenderParams({ material, phase: 'solid', properties });
      const reflectance = Number(optics?.reflectance);
      if (Number.isFinite(reflectance)) {
        return Math.min(0.98, Math.max(0.02, 1 - reflectance));
      }
      return CONDENSED_DIELECTRIC_GRAY_EMISSIVITY;
    }
    if (gasOnly) {
      const optics = opticalRenderParams({ material, phase: 'gas', properties });
      const opticalDepth = Number(optics?.opticalDepth);
      if (Number.isFinite(opticalDepth) && opticalDepth > 0) {
        return Math.min(0.98, 1 - Math.exp(-opticalDepth));
      }
      return 0;
    }
  } catch {
    // Fall through to the class default below.
  }
  return CONDENSED_DIELECTRIC_GRAY_EMISSIVITY;
}
const THERMAL_DEBYE_GRAPH_SAMPLE_COUNT = 32;
const FACE_IDS = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const thermalOutputCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'thermal-output'
  });

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function assertPackedSphParticleState(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH thermal GPU step requires a packed SPH GPU particle buffer');
  }
}

function assertPackedSphThermalMaterialTable(table) {
  if (table?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('Expected a packed SPH thermal material table');
  }
}

function phaseDensity(properties, phaseName) {
  const exact = properties?.phases?.find((phase) => phase.name === phaseName);
  const fallback = properties?.phases?.find((phase) => phase.densityKgPerM3 > 0);
  return finiteNumber(exact?.densityKgPerM3 ?? fallback?.densityKgPerM3, 0);
}

function phaseThermalConductivity(properties, phaseName) {
  const phase = properties?.phases?.find((candidate) => candidate.name === phaseName);
  const value = Number(phase?.thermalConductivityWPerMK);
  const ready = Number.isFinite(value) && value > 0;
  return {
    ready,
    value: ready ? value : 0,
    provenance: {
      status: ready
        ? 'closure-phase-thermal-conductivity-ready'
        : 'closure-phase-thermal-conductivity-missing',
      source: 'material-properties.phases',
      phase: phaseName,
      field: 'thermalConductivityWPerMK',
      sourceProvenance:
        phase?.thermalConductivityProvenance
        ?? properties?.thermalConductivityProvenance
        ?? properties?.provenance
        ?? null
    }
  };
}

function harmonicMeanPositive(left, right) {
  if (!(left > 0) || !(right > 0)) return 0;
  return (2 * left * right) / (left + right);
}

function segmentThermalConductivity(properties, segment) {
  const from = phaseThermalConductivity(
    properties,
    segment.type === 'phase' ? segment.phase : segment.from
  );
  const to = segment.type === 'phase'
    ? from
    : phaseThermalConductivity(properties, segment.to);
  const value = segment.type === 'phase'
    ? from.value
    : harmonicMeanPositive(from.value, to.value);
  return {
    ready: value > 0,
    value,
    provenance: {
      status: value > 0
        ? 'closure-segment-thermal-conductivity-ready'
        : 'closure-segment-thermal-conductivity-missing',
      source: segment.type === 'phase'
        ? 'phase-bulk-conductivity'
        : 'harmonic-mean-adjacent-phase-bulk-conductivity',
      from: from.provenance,
      to: to.provenance
    }
  };
}

function phaseNameOfSegment(segment) {
  return segment.type === 'phase' ? segment.phase : segment.to;
}

function sortedMaterialEntries(materialProperties) {
  return Object.entries(materialProperties || {})
    .filter(([, properties]) => properties?.phases?.length)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function materialBankWarmInputsByMaterial(table = null) {
  const rows = new Map();
  if (table?.schema !== MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA) return rows;
  for (const metadata of table.metadata || []) {
    const material = String(metadata?.material || metadata?.requestedMaterial || '').toLowerCase();
    if (!material) continue;
    rows.set(material, { ...metadata });
  }
  return rows;
}

function materialBankWarmInputConsumerSummary({
  table = null,
  matchedMaterialCount = 0
} = {}) {
  const sourceRowCount = Math.max(0, Math.round(finiteNumber(table?.rowCount, 0)));
  const matchedCount = Math.max(0, Math.round(finiteNumber(matchedMaterialCount, 0)));
  return {
    schema: ULG_SPH_THERMAL_MATERIAL_BANK_WARM_INPUT_CONSUMER_SCHEMA,
    status: sourceRowCount <= 0
      ? 'no-material-bank-warm-input-table'
      : (matchedCount > 0
        ? 'thermal-material-table-annotated-with-material-bank-warm-inputs'
        : 'material-bank-warm-inputs-not-matched-to-thermal-materials'),
    sourceSchema: table?.schema ?? null,
    sourceRowCount,
    matchedMaterialCount: matchedCount,
    consumer: 'sph-thermal-material-table',
    consumedAs: 'non-authoritative-warm-input-metadata-before-closure-derived-thermal-graphs',
    strictSourceOfTruth: false,
    shaderBound: false,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function materialBankWarmInputConsumerForOutput(thermalMaterialTable, {
  shaderBound = false,
  shaderBinding = null,
  shaderRowCount = 0,
  bufferSource = null
} = {}) {
  const consumer = thermalMaterialTable?.materialPropertyBankWarmInputConsumer
    ?? materialBankWarmInputConsumerSummary();
  const boundRowCount = Math.max(0, Math.round(finiteNumber(shaderRowCount, 0)));
  const bound = shaderBound === true && boundRowCount > 0;
  return {
    ...consumer,
    status: bound
      ? 'thermal-material-bank-warm-inputs-bound-in-shader'
      : consumer.status,
    consumedAs: bound
      ? 'non-authoritative-shader-bound-warm-input-metadata-before-closure-derived-thermal-graphs'
      : consumer.consumedAs,
    shaderBound: bound,
    shaderBinding: bound ? shaderBinding : null,
    shaderRowCount: bound ? boundRowCount : 0,
    bufferSource: bound ? bufferSource : null
  };
}

// The packed plateau temperature is a material constant derived at the
// standard atmosphere, so that is the pressure the reference carrier ladder is
// defined against.
const THERMAL_CARRIER_REFERENCE_PRESSURE_PA = 101325;
const THERMAL_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K = 8.314462618;

/**
 * Derive the pressure-adjusted carrier lanes for one material.
 *
 * Only a material with exactly one admitted liquid-to-gas plateau of positive
 * latent width and a finite-positive molar mass can be pressure-shifted. Any
 * other material returns the identity law, so the device leaves it on the
 * reference ladder rather than inventing a plateau for it. Ambiguity (more than
 * one vaporization plateau) is deliberately not resolved by picking one.
 */
function derivePressureCarrierLanes(properties, materialSegments) {
  const plateaus = materialSegments.filter((segment) => segment.type !== 'phase'
    && segment.from === 'liquid'
    && segment.to === 'gas');
  const identity = {
    pressureCarrierLawId: PRESSURE_CARRIER_LAW_REFERENCE_ONLY,
    referencePressurePa: 0,
    clausiusInvTemperatureLogSlopePerK: 0
  };
  if (plateaus.length !== 1) return identity;
  const [plateau] = plateaus;
  const latentHeatJPerKg = finiteNumber(plateau.eEnd) - finiteNumber(plateau.eStart);
  const molarMassKgPerMol = Number(properties?.molarMassKgPerMol);
  const referenceTemperatureK = finiteNumber(plateau.temperatureK);
  if (
    !(latentHeatJPerKg > 0)
    || !Number.isFinite(molarMassKgPerMol)
    || !(molarMassKgPerMol > 0)
    || !(referenceTemperatureK > 0)
  ) return identity;
  const molarLatentHeat = latentHeatJPerKg * molarMassKgPerMol;
  const slope = THERMAL_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K / molarLatentHeat;
  if (!Number.isFinite(slope) || !(slope > 0)) return identity;
  return {
    pressureCarrierLawId: PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU,
    referencePressurePa: THERMAL_CARRIER_REFERENCE_PRESSURE_PA,
    clausiusInvTemperatureLogSlopePerK: slope
  };
}

export function buildSphThermalMaterialTable(materialProperties = {}, {
  materialPropertyBankGpuWarmInputTable = null
} = {}) {
  const records = [];
  const segments = [];
  const metadata = [];
  const segmentMetadata = [];
  const materialBankWarmInputs = materialBankWarmInputsByMaterial(materialPropertyBankGpuWarmInputTable);
  let materialBankWarmInputMatchedMaterialCount = 0;
  for (const [material, properties] of sortedMaterialEntries(materialProperties)) {
    const materialId = stableOpticalMaterialId(material);
    const materialSegments = orderedSegments(properties);
    const segmentOffset = segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS;
    const materialBankWarmInput = materialBankWarmInputs.get(String(material).toLowerCase()) || null;
    if (materialBankWarmInput) materialBankWarmInputMatchedMaterialCount += 1;
    for (const segment of materialSegments) {
      const segmentIndex = segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS;
      const conductivity = segmentThermalConductivity(properties, segment);
      segmentMetadata[segmentIndex] = {
        ...segment,
        material,
        materialId,
        segmentIndex,
        thermalConductivityWPerMK: conductivity.value,
        thermalConductivityProvenance: conductivity.provenance
      };
      if (segment.type === 'phase') {
        const phaseId = gpuPhaseId(segment.phase);
        segments.push(
          materialId,
          THERMAL_SEGMENT_TYPES.phase,
          phaseId,
          phaseId,
          finiteNumber(segment.eStart),
          finiteNumber(segment.eEnd),
          finiteNumber(segment.tLo),
          finiteNumber(segment.tHi),
          phaseDensity(properties, segment.phase),
          phaseDensity(properties, segment.phase),
          THERMAL_STATUS.ready,
          conductivity.value
        );
      } else {
        segments.push(
          materialId,
          THERMAL_SEGMENT_TYPES.plateau,
          gpuPhaseId(segment.from),
          gpuPhaseId(segment.to),
          finiteNumber(segment.eStart),
          finiteNumber(segment.eEnd),
          finiteNumber(segment.temperatureK),
          finiteNumber(segment.temperatureK),
          phaseDensity(properties, segment.from),
          phaseDensity(properties, segment.to),
          THERMAL_STATUS.ready,
          conductivity.value
        );
      }
    }
    const emissivityGray = deriveGrayEmissivityForMaterial(material, properties);
    const carrier = derivePressureCarrierLanes(properties, materialSegments);
    records.push(
      materialId,
      segmentOffset,
      materialSegments.length,
      THERMAL_STATUS.ready,
      emissivityGray,
      carrier.pressureCarrierLawId,
      carrier.referencePressurePa,
      carrier.clausiusInvTemperatureLogSlopePerK
    );
    metadata.push({
      material,
      materialId,
      segmentOffset,
      segmentCount: materialSegments.length,
      emissivityGray,
      ...carrier,
      phaseNames: [...new Set(materialSegments.map(phaseNameOfSegment))],
      materialPropertyBankWarmInput: materialBankWarmInput,
      materialPropertyBankWarmInputStatus: materialBankWarmInput
        ? 'material-bank-warm-input-attached'
        : 'no-material-bank-warm-input'
    });
  }
  const materialPropertyBankWarmInputConsumer = materialBankWarmInputConsumerSummary({
    table: materialPropertyBankGpuWarmInputTable,
    matchedMaterialCount: materialBankWarmInputMatchedMaterialCount
  });
  return {
    schema: ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
    status: 'closure-derived-thermal-table-ready',
    materialPropertyBankWarmInputConsumer,
    materialPropertyBankWarmInputRowCount: materialPropertyBankWarmInputConsumer.sourceRowCount,
    materialPropertyBankWarmInputMatchedMaterialCount:
      materialPropertyBankWarmInputConsumer.matchedMaterialCount,
    materialCount: records.length / SPH_THERMAL_MATERIAL_RECORD_FLOATS,
    segmentCount: segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS,
    recordLayout: [...SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT],
    segmentLayout: [...SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT],
    recordStrideFloats: SPH_THERMAL_MATERIAL_RECORD_FLOATS,
    segmentStrideFloats: SPH_THERMAL_PHASE_SEGMENT_FLOATS,
    records: new Float32Array(records),
    segments: new Float32Array(segments),
    metadata,
    segmentMetadata,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function materialMetadataById(table) {
  const metadata = new Map();
  for (const entry of table.metadata || []) {
    metadata.set(entry.materialId, entry);
    metadata.set(new Float32Array([entry.materialId])[0], entry);
  }
  return metadata;
}

function segmentTypeName(segmentType) {
  return Math.round(segmentType) === THERMAL_SEGMENT_TYPES.plateau ? 'plateau' : 'phase';
}

function sampleDerivative(samples, index) {
  const left = samples[Math.max(0, index - 1)];
  const right = samples[Math.min(samples.length - 1, index + 1)];
  if (!left || !right || right.axis === left.axis) return 0;
  return (right.value - left.value) / (right.axis - left.axis);
}

function graphSamplesForThermalSegment(segment, sourceSegment = null) {
  const energyStart = finiteNumber(segment.energyStartJPerKg);
  const energyEnd = finiteNumber(segment.energyEndJPerKg);
  const temperatureStart = finiteNumber(segment.temperatureStartK);
  const temperatureEnd = finiteNumber(segment.temperatureEndK);
  const fallbackSlope = (temperatureEnd - temperatureStart) / Math.max(1e-30, energyEnd - energyStart);
  if (
    sourceSegment?.type !== 'phase'
    || !sourceSegment.debyeTemperatureK
    || !(energyEnd > energyStart)
    || !(sourceSegment.tHi > sourceSegment.tLo)
  ) {
    return [
      { axis: energyStart, value: temperatureStart, derivative: fallbackSlope },
      { axis: energyEnd, value: temperatureEnd, derivative: fallbackSlope }
    ];
  }

  const samples = [];
  for (let index = 0; index < THERMAL_DEBYE_GRAPH_SAMPLE_COUNT; index += 1) {
    const alpha = index / (THERMAL_DEBYE_GRAPH_SAMPLE_COUNT - 1);
    const temperatureK = sourceSegment.tLo + alpha * (sourceSegment.tHi - sourceSegment.tLo);
    const axis = sourceSegment.eStart + segmentEnergyAbove(sourceSegment, temperatureK);
    if (samples.length && axis <= samples[samples.length - 1].axis) continue;
    samples.push({ axis, value: temperatureK, derivative: 0 });
  }
  if (samples.length < 2 || samples[samples.length - 1].axis < energyEnd) {
    if (samples.length && energyEnd <= samples[samples.length - 1].axis) samples.pop();
    samples.push({ axis: energyEnd, value: temperatureEnd, derivative: 0 });
  }
  if (samples[0]?.axis > energyStart) {
    samples.unshift({ axis: energyStart, value: temperatureStart, derivative: 0 });
  }
  for (let index = 0; index < samples.length; index += 1) {
    samples[index].derivative = sampleDerivative(samples, index);
  }
  return samples.length >= 2
    ? samples
    : [
        { axis: energyStart, value: temperatureStart, derivative: fallbackSlope },
        { axis: energyEnd, value: temperatureEnd, derivative: fallbackSlope }
      ];
}

function buildThermalSegmentTemperatureGraph({ segment, segmentIndex, materialMetadata, sourceSegment = null }) {
  const energyStart = finiteNumber(segment.energyStartJPerKg);
  const energyEnd = finiteNumber(segment.energyEndJPerKg);
  if (!(energyEnd > energyStart)) {
    return null;
  }
  const temperatureStart = finiteNumber(segment.temperatureStartK);
  const temperatureEnd = finiteNumber(segment.temperatureEndK);
  const materialName = materialMetadata?.material || `material-${Math.round(segment.materialId)}`;
  const samples = graphSamplesForThermalSegment(segment, sourceSegment);
  const graph = createClosureLawGraphBuffers({
    graphId: `sph-thermal:${materialName}:${Math.round(segment.materialId)}:segment-${segmentIndex}:temperature-vs-energy`,
    nodes: [{
      op: 'tableLinear',
      inputSlot: SPH_THERMAL_CLOSURE_GRAPH_SLOTS.specificInternalEnergyJPerKg,
      outputSlot: SPH_THERMAL_CLOSURE_GRAPH_SLOTS.temperatureK,
      derivativeSlot: SPH_THERMAL_CLOSURE_GRAPH_SLOTS.dTemperatureKdSpecificInternalEnergyJPerKg,
      sampleOffset: 0,
      sampleCount: samples.length,
      domainMin: energyStart,
      domainMax: energyEnd,
      interpolation: 'linear',
      statusFlagId: 0,
      provenanceIndex: segmentIndex,
      materialId: segment.materialId,
      phaseId: segment.phaseFromId
    }],
    edges: [],
    samples,
    slotCount: 3,
    initialSlots: { 0: energyStart },
    statusCount: 1,
    strategy: 'sph-thermal-segment-flat-closure-law-graph'
  });
  return {
    ...graph,
    sourceSchema: ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
    sourceSegmentIndex: segmentIndex,
    sourceSegmentType: segmentTypeName(segment.segmentType),
    sourceMaterial: materialName,
    sourceMaterialId: segment.materialId,
    sourcePhaseFromId: segment.phaseFromId,
    sourcePhaseToId: segment.phaseToId,
    sourceSegment,
    axisName: 'specificInternalEnergyJPerKg',
    outputName: 'temperatureK',
    outputSlots: { ...SPH_THERMAL_CLOSURE_GRAPH_SLOTS },
    derivativeName: 'dTemperatureKdSpecificInternalEnergyJPerKg',
    compilerBackend: 'cpu-reference',
    compilerStatus: 'cpu-validated-sph-thermal-segment-closure-law-graph',
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false
  };
}

function packSphThermalClosureGraphBankFromGraphs({ graphs = [], metadata = [] } = {}) {
  const nodeRows = [];
  const edgeRows = [];
  const sampleRows = [];
  const slotRows = [];
  const statusRows = [];
  const graphRecords = [];
  let nodeOffset = 0;
  let edgeOffset = 0;
  let sampleOffset = 0;
  let slotOffset = 0;
  let statusOffset = 0;
  graphs.forEach((graph, graphIndex) => {
    const nodeCopy = new Float32Array(graph.nodeRows);
    for (let nodeIndex = 0; nodeIndex < graph.nodeCount; nodeIndex += 1) {
      const offset = nodeIndex * graph.nodeStrideFloats;
      nodeCopy[offset + 4] += sampleOffset;
      nodeCopy[offset + 8] += edgeOffset;
      nodeCopy[offset + 11] += statusOffset;
    }
    nodeRows.push(...nodeCopy);
    edgeRows.push(...(graph.edgeRows || new Float32Array()));
    sampleRows.push(...graph.sampleRows);
    slotRows.push(...graph.slotRows);
    statusRows.push(...graph.statusRows);
    graphRecords.push({
      graphIndex,
      graphId: graph.graphId,
      nodeOffset,
      nodeCount: graph.nodeCount,
      edgeOffset,
      edgeCount: graph.edgeCount,
      sampleOffset,
      sampleCount: graph.sampleCount,
      slotOffset,
      slotCount: graph.slotCount,
      statusOffset,
      statusCount: graph.statusCount,
      sourceSegmentIndex: metadata[graphIndex]?.segmentIndex ?? graph.sourceSegmentIndex ?? graphIndex,
      materialId: metadata[graphIndex]?.materialId ?? graph.sourceMaterialId ?? 0,
      phaseFromId: metadata[graphIndex]?.phaseFromId ?? graph.sourcePhaseFromId ?? 0,
      phaseToId: metadata[graphIndex]?.phaseToId ?? graph.sourcePhaseToId ?? 0
    });
    nodeOffset += graph.nodeCount;
    edgeOffset += graph.edgeCount;
    sampleOffset += graph.sampleCount;
    slotOffset += graph.slotCount;
    statusOffset += graph.statusCount;
  });
  return {
    schema: ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    status: 'packed-thermal-temperature-closure-graph-bank-ready',
    graphSchema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    graphCount: graphs.length,
    nodeCount: nodeOffset,
    edgeCount: edgeOffset,
    sampleCount: sampleOffset,
    slotCount: slotOffset,
    statusCount: statusOffset,
    nodeRows: new Float32Array(nodeRows),
    edgeRows: new Float32Array(edgeRows),
    sampleRows: new Float32Array(sampleRows),
    slotRows: new Float32Array(slotRows),
    statusRows: new Float32Array(statusRows),
    graphRecords,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function buildSphThermalClosureGraphBank(graphSet) {
  if (graphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('buildSphThermalClosureGraphBank requires an SPH thermal closure graph set');
  }
  return packSphThermalClosureGraphBankFromGraphs({
    graphs: graphSet.graphs,
    metadata: graphSet.metadata
  });
}

export function buildSphThermalClosureGraphBuffers(materialPropertiesOrTable = {}) {
  const table = materialPropertiesOrTable?.schema === ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
    ? materialPropertiesOrTable
    : buildSphThermalMaterialTable(materialPropertiesOrTable);
  assertPackedSphThermalMaterialTable(table);
  const materialMetadata = materialMetadataById(table);
  const graphs = [];
  const metadata = [];
  const skippedSegments = [];
  for (let segmentIndex = 0; segmentIndex < table.segmentCount; segmentIndex += 1) {
    const segment = segmentRows(table, segmentIndex);
    const material = materialMetadata.get(segment.materialId) || null;
    const sourceSegment = table.segmentMetadata?.[segmentIndex] || null;
    const graph = buildThermalSegmentTemperatureGraph({
      segment,
      segmentIndex,
      materialMetadata: material,
      sourceSegment
    });
    if (!graph) {
      skippedSegments.push({
        segmentIndex,
        material: material?.material || null,
        materialId: segment.materialId,
        segmentType: segmentTypeName(segment.segmentType),
        reason: 'non-positive-energy-domain'
      });
      continue;
    }
    const graphIndex = graphs.length;
    graphs.push(graph);
    metadata.push({
      graphIndex,
      graphId: graph.graphId,
      material: material?.material || null,
      materialId: segment.materialId,
      segmentIndex,
      segmentType: segmentTypeName(segment.segmentType),
      phaseFromId: segment.phaseFromId,
      phaseToId: segment.phaseToId,
      energyStartJPerKg: segment.energyStartJPerKg,
      energyEndJPerKg: segment.energyEndJPerKg,
      temperatureStartK: segment.temperatureStartK,
      temperatureEndK: segment.temperatureEndK,
      sourceSegmentType: sourceSegment?.type || null,
      sourceSegmentDebyeTemperatureK: sourceSegment?.debyeTemperatureK || null,
      graphSampleCount: graph.sampleCount,
      derivativeKdPerJPerKg: (segment.temperatureEndK - segment.temperatureStartK)
        / (segment.energyEndJPerKg - segment.energyStartJPerKg),
      graphSchema: graph.schema,
      graphStatus: graph.status
    });
  }
  const graphBank = packSphThermalClosureGraphBankFromGraphs({ graphs, metadata });
  return {
    schema: ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
    status: skippedSegments.length
      ? 'thermal-segment-closure-law-graphs-ready-with-skipped-segments'
      : 'thermal-segment-closure-law-graphs-ready',
    sourceSchema: table.schema,
    graphSchema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    graphBankSchema: ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    axisName: 'specificInternalEnergyJPerKg',
    outputName: 'temperatureK',
    outputSlots: { ...SPH_THERMAL_CLOSURE_GRAPH_SLOTS },
    derivativeName: 'dTemperatureKdSpecificInternalEnergyJPerKg',
    materialCount: table.materialCount,
    segmentCount: table.segmentCount,
    graphCount: graphs.length,
    skippedSegmentCount: skippedSegments.length,
    graphBank,
    graphs,
    metadata,
    skippedSegments,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function segmentRows(table, segmentIndex) {
  const offset = segmentIndex * SPH_THERMAL_PHASE_SEGMENT_FLOATS;
  return {
    materialId: table.segments[offset],
    segmentType: table.segments[offset + 1],
    phaseFromId: table.segments[offset + 2],
    phaseToId: table.segments[offset + 3],
    energyStartJPerKg: table.segments[offset + 4],
    energyEndJPerKg: table.segments[offset + 5],
    temperatureStartK: table.segments[offset + 6],
    temperatureEndK: table.segments[offset + 7],
    densityFromKgPerM3: table.segments[offset + 8],
    densityToKgPerM3: table.segments[offset + 9],
    status: table.segments[offset + 10],
    thermalConductivityWPerMK: table.segments[offset + 11]
  };
}

function assertPackedSphThermalPhaseResponseTable(table) {
  if (table?.schema !== ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA) {
    throw new TypeError('Expected a packed SPH thermal phase-response table');
  }
}

function responseRows(table, responseIndex) {
  const offset = responseIndex * SPH_THERMAL_PHASE_RESPONSE_FLOATS;
  return {
    materialId: table.responses[offset],
    segmentType: table.responses[offset + 1],
    temperatureGraphIndex: table.responses[offset + 2],
    status: table.responses[offset + 3],
    energyStartJPerKg: table.responses[offset + 4],
    energyEndJPerKg: table.responses[offset + 5],
    phaseFromId: table.responses[offset + 6],
    phaseToId: table.responses[offset + 7],
    densityFromKgPerM3: table.responses[offset + 8],
    densityToKgPerM3: table.responses[offset + 9],
    densityPolicyId: table.responses[offset + 10],
    stablePhasePolicyId: table.responses[offset + 11],
    fractionFromSlope: table.responses[offset + 12],
    fractionFromIntercept: table.responses[offset + 13],
    fractionToSlope: table.responses[offset + 14],
    fractionToIntercept: table.responses[offset + 15]
  };
}

function graphIndexBySegment(graphSet) {
  const index = new Map();
  for (const entry of graphSet?.metadata || []) {
    index.set(entry.segmentIndex, entry.graphIndex);
  }
  return index;
}

export function buildSphThermalPhaseResponseTable(materialPropertiesOrTable = {}, graphSet = null) {
  const table = materialPropertiesOrTable?.schema === ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
    ? materialPropertiesOrTable
    : buildSphThermalMaterialTable(materialPropertiesOrTable);
  assertPackedSphThermalMaterialTable(table);
  const resolvedGraphSet = graphSet || buildSphThermalClosureGraphBuffers(table);
  if (resolvedGraphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('buildSphThermalPhaseResponseTable requires an SPH thermal closure graph set');
  }
  const graphBySegment = graphIndexBySegment(resolvedGraphSet);
  const records = [];
  const responses = [];
  const responseThermalConductivities = [];
  const metadata = [];
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    const materialId = table.records[recordOffset];
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    const responseOffset = responses.length / SPH_THERMAL_PHASE_RESPONSE_FLOATS;
    for (let local = 0; local < segmentCount; local += 1) {
      const segmentIndex = segmentOffset + local;
      const segment = segmentRows(table, segmentIndex);
      const isPlateau = Math.round(segment.segmentType) === THERMAL_SEGMENT_TYPES.plateau;
      const temperatureGraphIndex = graphBySegment.get(segmentIndex) ?? -1;
      responses.push(
        segment.materialId,
        segment.segmentType,
        temperatureGraphIndex,
        temperatureGraphIndex >= 0 ? THERMAL_STATUS.ready : THERMAL_STATUS.missingMaterial,
        segment.energyStartJPerKg,
        segment.energyEndJPerKg,
        segment.phaseFromId,
        segment.phaseToId,
        segment.densityFromKgPerM3,
        segment.densityToKgPerM3,
        SPH_THERMAL_DENSITY_POLICY_IDS.dominantAtHalf,
        SPH_THERMAL_STABLE_PHASE_POLICY_IDS.dominantAtHalf,
        isPlateau ? -1 : 0,
        1,
        isPlateau ? 1 : 0,
        0
      );
      responseThermalConductivities.push(
        Math.max(0, finiteNumber(segment.thermalConductivityWPerMK, 0))
      );
    }
    const emissivityGray = finiteNumber(table.records[recordOffset + 4], 0);
    // Carried through verbatim: the response ladder must resolve the same
    // plateau shift as the segment table it was derived from.
    const pressureCarrierLawId = finiteNumber(table.records[recordOffset + 5], 0);
    const referencePressurePa = finiteNumber(table.records[recordOffset + 6], 0);
    const clausiusInvTemperatureLogSlopePerK =
      finiteNumber(table.records[recordOffset + 7], 0);
    records.push(
      materialId,
      responseOffset,
      segmentCount,
      THERMAL_STATUS.ready,
      emissivityGray,
      pressureCarrierLawId,
      referencePressurePa,
      clausiusInvTemperatureLogSlopePerK
    );
    metadata.push({
      materialId,
      responseOffset,
      responseCount: segmentCount,
      emissivityGray,
      pressureCarrierLawId,
      referencePressurePa,
      clausiusInvTemperatureLogSlopePerK
    });
  }
  return {
    schema: ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
    status: 'closure-derived-phase-response-table-ready',
    sourceSchema: table.schema,
    graphSetSchema: resolvedGraphSet.schema,
    graphBankSchema: resolvedGraphSet.graphBank?.schema ?? ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    materialCount: table.materialCount,
    responseCount: responses.length / SPH_THERMAL_PHASE_RESPONSE_FLOATS,
    recordLayout: [...SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT],
    responseLayout: [...SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT],
    recordStrideFloats: SPH_THERMAL_PHASE_RESPONSE_RECORD_FLOATS,
    responseStrideFloats: SPH_THERMAL_PHASE_RESPONSE_FLOATS,
    records: new Float32Array(records),
    responses: new Float32Array(responses),
    // Response-aligned transport sidecar. Keep the public 16-float response
    // row ABI stable while allowing the phase-aware resident prepass to carry
    // the selected phase conductivity into its private proposal sidecar.
    responseThermalConductivities: new Float32Array(
      responseThermalConductivities
    ),
    metadata,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function responseFractions(response, alpha) {
  if (Math.round(response.segmentType) !== THERMAL_SEGMENT_TYPES.plateau) {
    return phaseFractionsFor(response.phaseFromId, 1);
  }
  const fromFraction = Math.min(1, Math.max(0, response.fractionFromSlope * alpha + response.fractionFromIntercept));
  const toFraction = Math.min(1, Math.max(0, response.fractionToSlope * alpha + response.fractionToIntercept));
  return addFractions(
    phaseFractionsFor(response.phaseFromId, fromFraction),
    phaseFractionsFor(response.phaseToId, toFraction)
  );
}

// Gray emissivity for a material id from a packed thermal table (material or
// phase-response — both carry it at record lane 4).
export function thermalEmissivityFromTable(table, materialId) {
  const stride = Math.max(1, Math.round(finiteNumber(table?.recordStrideFloats, SPH_THERMAL_MATERIAL_RECORD_FLOATS)));
  const materialCount = Math.max(0, Math.round(finiteNumber(table?.materialCount, 0)));
  for (let recordIndex = 0; recordIndex < materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * stride;
    if (table.records[recordOffset] !== materialId) continue;
    if (stride < 5) return 0;
    return Math.min(1, Math.max(0, finiteNumber(table.records[recordOffset + 4], 0)));
  }
  return 0;
}

export function resolveThermalConductivityFromTable(
  table,
  materialId,
  specificInternalEnergyJPerKg
) {
  assertPackedSphThermalMaterialTable(table);
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    let selected = segmentOffset;
    for (let local = 0; local < segmentCount; local += 1) {
      const candidate = segmentOffset + local;
      const segment = segmentRows(table, candidate);
      selected = candidate;
      if (
        specificInternalEnergyJPerKg <= segment.energyEndJPerKg
        || local + 1 === segmentCount
      ) break;
    }
    const segment = segmentRows(table, selected);
    const value = finiteNumber(segment.thermalConductivityWPerMK, 0);
    return {
      ready: value > 0 && segment.status === THERMAL_STATUS.ready,
      status: value > 0
        ? 'phase-thermal-conductivity-ready'
        : 'phase-thermal-conductivity-missing',
      thermalConductivityWPerMK: Math.max(0, value),
      segmentIndex: selected,
      segmentType: segmentTypeName(segment.segmentType),
      phaseFromId: segment.phaseFromId,
      phaseToId: segment.phaseToId,
      provenance:
        table.segmentMetadata?.[selected]?.thermalConductivityProvenance
        ?? null
    };
  }
  return {
    ready: false,
    status: 'material-thermal-conductivity-missing',
    thermalConductivityWPerMK: 0,
    segmentIndex: null,
    segmentType: null,
    phaseFromId: GPU_PHASE_IDS.unknown,
    phaseToId: GPU_PHASE_IDS.unknown,
    provenance: null
  };
}

function particleNominalRadiusM(massKg, restDensityKgPerM3) {
  if (!(massKg > 0) || !(restDensityKgPerM3 > 0)) return 0;
  return Math.cbrt((3 * massKg) / (4 * Math.PI * restDensityKgPerM3));
}

function conductiveSphereContactGeometry(radiusM, otherRadiusM, distanceM) {
  const leftRadius = Math.max(0, finiteNumber(radiusM, 0));
  const rightRadius = Math.max(0, finiteNumber(otherRadiusM, 0));
  const distance = Math.max(0, finiteNumber(distanceM, 0));
  const radiusSum = leftRadius + rightRadius;
  const surfaceGapM = distance - radiusSum;
  if (!(leftRadius > 0) || !(rightRadius > 0) || surfaceGapM >= 0) {
    return {
      contact: false,
      surfaceGapM,
      overlapM: Math.max(0, -surfaceGapM),
      contactAreaM2: 0,
      conductionPathLengthM: distance
    };
  }

  const minRadius = Math.min(leftRadius, rightRadius);
  let contactRadiusSquaredM2;
  if (distance === 0 || distance <= Math.abs(leftRadius - rightRadius)) {
    contactRadiusSquaredM2 = minRadius * minRadius;
  } else {
    const planeFromLeftM = (
      distance * distance
      + leftRadius * leftRadius
      - rightRadius * rightRadius
    ) / (2 * distance);
    contactRadiusSquaredM2 = Math.max(
      0,
      leftRadius * leftRadius - planeFromLeftM * planeFromLeftM
    );
  }
  return {
    contact: contactRadiusSquaredM2 > 0,
    surfaceGapM,
    overlapM: -surfaceGapM,
    contactAreaM2: Math.PI * contactRadiusSquaredM2,
    conductionPathLengthM: distance > 0 ? distance : minRadius
  };
}

function radiativeViewAreaM2(rI, rJ, distanceM) {
  if (!(rI > 0) || !(rJ > 0)) return 0;
  const d2 = Math.max(distanceM * distanceM, 1e-12);
  const geometric = Math.PI * rI * rI * (rJ * rJ) / (4 * d2);
  const rMin = Math.min(rI, rJ);
  return Math.min(geometric, Math.PI * rMin * rMin);
}

export function resolveThermalPhaseResponseFromTable(table, materialId, specificInternalEnergyJPerKg) {
  assertPackedSphThermalPhaseResponseTable(table);
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_PHASE_RESPONSE_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const responseOffset = table.records[recordOffset + 1];
    const responseCount = table.records[recordOffset + 2];
    let selected = responseOffset;
    for (let local = 0; local < responseCount; local += 1) {
      const candidate = responseOffset + local;
      const response = responseRows(table, candidate);
      selected = candidate;
      if (specificInternalEnergyJPerKg <= response.energyEndJPerKg || local + 1 === responseCount) break;
    }
    const response = responseRows(table, selected);
    const rawAlpha = (
      specificInternalEnergyJPerKg - response.energyStartJPerKg
    ) / Math.max(1e-12, response.energyEndJPerKg - response.energyStartJPerKg);
    const alpha = Math.min(1, Math.max(0, rawAlpha));
    const isPlateau = Math.round(response.segmentType) === THERMAL_SEGMENT_TYPES.plateau;
    const dominantTo = isPlateau && alpha >= 0.5;
    const domainStatus = rawAlpha < 0 ? 'clamped-low' : (rawAlpha > 1 ? 'clamped-high' : 'in-domain');
    return {
      ...response,
      responseIndex: selected,
      alpha,
      rawAlpha,
      domainStatus,
      graphInputEnergyJPerKg: Math.min(response.energyEndJPerKg, Math.max(response.energyStartJPerKg, specificInternalEnergyJPerKg)),
      phaseId: dominantTo ? response.phaseToId : response.phaseFromId,
      restDensityKgPerM3: dominantTo ? response.densityToKgPerM3 : response.densityFromKgPerM3,
      phaseFractions: responseFractions(response, alpha),
      status: response.status
    };
  }
  return {
    responseIndex: -1,
    temperatureGraphIndex: -1,
    alpha: 0,
    rawAlpha: 0,
    domainStatus: 'missing-material',
    graphInputEnergyJPerKg: 0,
    phaseId: GPU_PHASE_IDS.unknown,
    restDensityKgPerM3: 0,
    phaseFractions: { solid: 0, liquid: 0, gas: 0, plasma: 0 },
    status: THERMAL_STATUS.missingMaterial
  };
}

function phaseFractionsFor(phaseId, value) {
  return {
    solid: phaseId === GPU_PHASE_IDS.solid ? value : 0,
    liquid: phaseId === GPU_PHASE_IDS.liquid ? value : 0,
    gas: phaseId === GPU_PHASE_IDS.gas ? value : 0,
    plasma: phaseId === GPU_PHASE_IDS.plasma ? value : 0
  };
}

function addFractions(left, right) {
  return {
    solid: left.solid + right.solid,
    liquid: left.liquid + right.liquid,
    gas: left.gas + right.gas,
    plasma: left.plasma + right.plasma
  };
}

function temperatureFromPackedSegmentEnergy(table, segmentIndex, segment, specificInternalEnergyJPerKg) {
  const sourceSegment = table.segmentMetadata?.[segmentIndex] || null;
  if (sourceSegment?.type === 'phase' && sourceSegment.debyeTemperatureK) {
    const energyAbove = Math.min(
      sourceSegment.eEnd - sourceSegment.eStart,
      Math.max(0, specificInternalEnergyJPerKg - sourceSegment.eStart)
    );
    return segmentTemperatureFromEnergyAbove(sourceSegment, energyAbove);
  }
  const alpha = Math.min(1, Math.max(0, (
    specificInternalEnergyJPerKg - segment.energyStartJPerKg
  ) / Math.max(1e-12, segment.energyEndJPerKg - segment.energyStartJPerKg)));
  return segment.temperatureStartK + alpha * (segment.temperatureEndK - segment.temperatureStartK);
}

function temperatureSlopeFromPackedSegmentEnergy(table, segmentIndex, segment, specificInternalEnergyJPerKg) {
  const sourceSegment = table.segmentMetadata?.[segmentIndex] || null;
  const energySpan = segment.energyEndJPerKg - segment.energyStartJPerKg;
  if (!(energySpan > 0)) return 0;
  if (sourceSegment?.type !== 'phase' || !sourceSegment.debyeTemperatureK) {
    return (segment.temperatureEndK - segment.temperatureStartK) / energySpan;
  }
  const clampedEnergy = Math.min(segment.energyEndJPerKg, Math.max(segment.energyStartJPerKg, specificInternalEnergyJPerKg));
  const delta = Math.max(1e-3, energySpan * 1e-4);
  const lo = Math.max(segment.energyStartJPerKg, clampedEnergy - delta);
  const hi = Math.min(segment.energyEndJPerKg, clampedEnergy + delta);
  if (!(hi > lo)) return (segment.temperatureEndK - segment.temperatureStartK) / energySpan;
  const tLo = temperatureFromPackedSegmentEnergy(table, segmentIndex, segment, lo);
  const tHi = temperatureFromPackedSegmentEnergy(table, segmentIndex, segment, hi);
  return (tHi - tLo) / (hi - lo);
}

export function resolveThermalStateFromTable(table, materialId, specificInternalEnergyJPerKg) {
  assertPackedSphThermalMaterialTable(table);
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    let selected = segmentOffset;
    for (let local = 0; local < segmentCount; local += 1) {
      const candidate = segmentOffset + local;
      const segment = segmentRows(table, candidate);
      selected = candidate;
      if (specificInternalEnergyJPerKg <= segment.energyEndJPerKg || local + 1 === segmentCount) break;
    }
    const segment = segmentRows(table, selected);
    const alpha = Math.min(1, Math.max(0, (
      specificInternalEnergyJPerKg - segment.energyStartJPerKg
    ) / Math.max(1e-12, segment.energyEndJPerKg - segment.energyStartJPerKg)));
    if (Math.round(segment.segmentType) === THERMAL_SEGMENT_TYPES.plateau) {
      const from = phaseFractionsFor(segment.phaseFromId, 1 - alpha);
      const to = phaseFractionsFor(segment.phaseToId, alpha);
      return {
        temperatureK: segment.temperatureStartK,
        phaseId: alpha >= 0.5 ? segment.phaseToId : segment.phaseFromId,
        restDensityKgPerM3: alpha >= 0.5 ? segment.densityToKgPerM3 : segment.densityFromKgPerM3,
        phaseFractions: addFractions(from, to),
        status: THERMAL_STATUS.ready
      };
    }
    return {
      temperatureK: temperatureFromPackedSegmentEnergy(table, selected, segment, specificInternalEnergyJPerKg),
      phaseId: segment.phaseFromId,
      restDensityKgPerM3: segment.densityFromKgPerM3,
      phaseFractions: phaseFractionsFor(segment.phaseFromId, 1),
      status: THERMAL_STATUS.ready
    };
  }
  return {
    temperatureK: 0,
    phaseId: GPU_PHASE_IDS.unknown,
    restDensityKgPerM3: 0,
    phaseFractions: { solid: 0, liquid: 0, gas: 0, plasma: 0 },
    status: THERMAL_STATUS.missingMaterial
  };
}

export function resolveThermalStateFromGraphPhaseResponseCpu({
  graphSet,
  responseTable,
  materialId,
  specificInternalEnergyJPerKg
} = {}) {
  if (graphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('resolveThermalStateFromGraphPhaseResponseCpu requires an SPH thermal closure graph set');
  }
  const response = resolveThermalPhaseResponseFromTable(responseTable, materialId, specificInternalEnergyJPerKg);
  if (response.status !== THERMAL_STATUS.ready || response.temperatureGraphIndex < 0) {
    return {
      temperatureK: 0,
      phaseId: GPU_PHASE_IDS.unknown,
      restDensityKgPerM3: 0,
      phaseFractions: response.phaseFractions,
      status: response.status,
      response,
      graphExecution: null
    };
  }
  const graph = graphSet.graphs?.[response.temperatureGraphIndex];
  if (graph?.schema !== ULG_CLOSURE_LAW_GRAPH_SCHEMA) {
    throw new TypeError(`Missing thermal temperature graph at index ${response.temperatureGraphIndex}`);
  }
  const graphExecution = evaluateClosureLawGraphCpu(graph, {
    inputs: {
      [SPH_THERMAL_CLOSURE_GRAPH_SLOTS.specificInternalEnergyJPerKg]: response.graphInputEnergyJPerKg
    }
  });
  return {
    temperatureK: graphExecution.slots[SPH_THERMAL_CLOSURE_GRAPH_SLOTS.temperatureK].value,
    phaseId: response.phaseId,
    restDensityKgPerM3: response.restDensityKgPerM3,
    phaseFractions: response.phaseFractions,
    status: response.status,
    response,
    graphExecution,
    closureRefreshRecommended: graphExecution.closureRefreshRecommended
  };
}

function wallTemp(wallTemperaturesK, faceId) {
  return finiteNumber(wallTemperaturesK?.[faceId], 0);
}

function wallDistance(position, boxDimsM, faceIndex) {
  if (faceIndex === 0) return position[0];
  if (faceIndex === 1) return boxDimsM[0] - position[0];
  if (faceIndex === 2) return position[1];
  if (faceIndex === 3) return boxDimsM[1] - position[1];
  if (faceIndex === 4) return position[2];
  return boxDimsM[2] - position[2];
}

function classifyThermalCarrierPhase(phaseId, phaseFractions) {
  const epsilon = 1e-6;
  const fractions = [
    Number(phaseFractions?.[0]),
    Number(phaseFractions?.[1]),
    Number(phaseFractions?.[2]),
    Number(phaseFractions?.[3])
  ];
  const sum = fractions.reduce((total, fraction) => total + fraction, 0);
  const valid = fractions.every((fraction) => (
    Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 + epsilon
  ))
    && Math.abs(sum - 1) <= epsilon;
  const positiveCount = fractions.filter((fraction) => fraction > 0).length;
  const carrierPhaseId = Math.max(0, Math.min(4, Math.round(finiteNumber(phaseId, 0))));
  const carrierLane = carrierPhaseId - GPU_PHASE_IDS.solid;
  const purePhaseId = valid
    && positiveCount === 1
    && carrierLane >= 0
    && carrierLane < fractions.length
    && Math.abs(fractions[carrierLane] - 1) <= epsilon
    ? carrierPhaseId
    : GPU_PHASE_IDS.unknown;
  return {
    purePhaseId,
    mixed: valid && positiveCount >= 2
  };
}

export function resolveThermalCarrierTemperatureSlopeFromTable(
  table,
  materialId,
  specificInternalEnergyJPerKg,
  phaseId,
  phaseFractions
) {
  assertPackedSphThermalMaterialTable(table);
  const classification = classifyThermalCarrierPhase(phaseId, phaseFractions);
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    let fallback = segmentOffset;
    let fallbackFound = false;
    let containing = -1;
    let mixedPlateau = -1;
    let purePhaseSegment = -1;
    for (let local = 0; local < segmentCount; local += 1) {
      const candidate = segmentOffset + local;
      const segment = segmentRows(table, candidate);
      if (!fallbackFound) {
        fallback = candidate;
        if (specificInternalEnergyJPerKg <= segment.energyEndJPerKg || local + 1 === segmentCount) {
          fallbackFound = true;
        }
      }
      if (
        specificInternalEnergyJPerKg >= segment.energyStartJPerKg
        && specificInternalEnergyJPerKg <= segment.energyEndJPerKg
      ) {
        if (containing < 0) containing = candidate;
        if (
          classification.purePhaseId !== GPU_PHASE_IDS.unknown
          && Math.round(segment.phaseFromId) === classification.purePhaseId
          && Math.round(segment.phaseToId) === classification.purePhaseId
        ) {
          purePhaseSegment = candidate;
        }
        if (
          classification.mixed
          && Math.round(segment.segmentType) === THERMAL_SEGMENT_TYPES.plateau
        ) {
          mixedPlateau = candidate;
        }
      }
    }
    const selected = purePhaseSegment >= 0
      ? purePhaseSegment
      : mixedPlateau >= 0
        ? mixedPlateau
        : containing >= 0
          ? containing
          : fallback;
    const segment = segmentRows(table, selected);
    return temperatureSlopeFromPackedSegmentEnergy(table, selected, segment, specificInternalEnergyJPerKg);
  }
  return 0;
}

export function resolveThermalCarrierEnergyDomainFromTable(
  table,
  materialId,
  specificInternalEnergyJPerKg
) {
  assertPackedSphThermalMaterialTable(table);
  const specificEnergy = Number(specificInternalEnergyJPerKg);
  const failClosed = (status, materialFound = false) => ({
    ready: false,
    status,
    materialFound,
    energyMinJPerKg: Number.isFinite(specificEnergy) ? specificEnergy : 0,
    energyMaxJPerKg: Number.isFinite(specificEnergy) ? specificEnergy : 0,
    containingSegmentCount: 0
  });
  if (!Number.isFinite(specificEnergy)) return failClosed('non-finite-specific-energy');

  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    const recordStatus = table.records[recordOffset + 3];
    if (
      recordStatus !== THERMAL_STATUS.ready
      || !Number.isInteger(segmentOffset)
      || !Number.isInteger(segmentCount)
      || segmentOffset < 0
      || segmentCount <= 0
      || segmentOffset + segmentCount > table.segmentCount
    ) {
      return failClosed('invalid-material-response-record', true);
    }

    let energyMinJPerKg = Number.POSITIVE_INFINITY;
    let energyMaxJPerKg = Number.NEGATIVE_INFINITY;
    let containingSegmentCount = 0;
    for (let local = 0; local < segmentCount; local += 1) {
      const segment = segmentRows(table, segmentOffset + local);
      if (
        segment.status !== THERMAL_STATUS.ready
        || segment.materialId !== materialId
        || !Number.isFinite(segment.energyStartJPerKg)
        || !Number.isFinite(segment.energyEndJPerKg)
        || segment.energyStartJPerKg > segment.energyEndJPerKg
      ) {
        return failClosed('invalid-material-response-domain', true);
      }
      if (
        specificEnergy >= segment.energyStartJPerKg
        && specificEnergy <= segment.energyEndJPerKg
      ) {
        energyMinJPerKg = Math.min(energyMinJPerKg, segment.energyStartJPerKg);
        energyMaxJPerKg = Math.max(energyMaxJPerKg, segment.energyEndJPerKg);
        containingSegmentCount += 1;
      }
    }
    if (containingSegmentCount === 0) {
      return failClosed('specific-energy-outside-response-domain', true);
    }
    return {
      ready: true,
      status: 'ready',
      materialFound: true,
      energyMinJPerKg,
      energyMaxJPerKg,
      containingSegmentCount
    };
  }
  return failClosed('missing-material');
}

// The constitutive law (temperature and slope) is selected from the segment
// that contains the live carrier. Closed-system pair exchange has a different
// domain: it may cross a shared phase knot, so long as the material response is
// one contiguous, continuous, monotone enthalpy curve. Keeping this resolver
// separate prevents phase labels or a zero-slope plateau from turning a
// constitutive-selection detail into an artificial transport barrier.
export function resolveThermalCarrierReachableEnergyDomainFromTable(
  table,
  materialId,
  specificInternalEnergyJPerKg
) {
  assertPackedSphThermalMaterialTable(table);
  const specificEnergy = Number(specificInternalEnergyJPerKg);
  const failClosed = (status, materialFound = false) => ({
    ready: false,
    status,
    materialFound,
    energyMinJPerKg: Number.isFinite(specificEnergy) ? specificEnergy : 0,
    energyMaxJPerKg: Number.isFinite(specificEnergy) ? specificEnergy : 0,
    containingSegmentCount: 0,
    reachableSegmentCount: 0
  });
  if (!Number.isFinite(specificEnergy)) {
    return failClosed('non-finite-specific-energy');
  }

  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    const recordStatus = table.records[recordOffset + 3];
    if (
      recordStatus !== THERMAL_STATUS.ready
      || !Number.isInteger(segmentOffset)
      || !Number.isInteger(segmentCount)
      || segmentOffset < 0
      || segmentCount <= 0
      || segmentOffset + segmentCount > table.segmentCount
    ) {
      return failClosed('invalid-material-response-record', true);
    }

    let energyMinJPerKg = 0;
    let energyMaxJPerKg = 0;
    let previousEnergyEndJPerKg = null;
    let previousTemperatureEndK = null;
    let containingSegmentCount = 0;
    for (let local = 0; local < segmentCount; local += 1) {
      const segment = segmentRows(table, segmentOffset + local);
      if (
        segment.status !== THERMAL_STATUS.ready
        || segment.materialId !== materialId
        || !Number.isFinite(segment.energyStartJPerKg)
        || !Number.isFinite(segment.energyEndJPerKg)
        || !Number.isFinite(segment.temperatureStartK)
        || !Number.isFinite(segment.temperatureEndK)
        || segment.energyStartJPerKg > segment.energyEndJPerKg
        || segment.temperatureStartK > segment.temperatureEndK
      ) {
        return failClosed('invalid-material-response-domain', true);
      }
      if (local === 0) {
        energyMinJPerKg = segment.energyStartJPerKg;
      } else if (
        segment.energyStartJPerKg !== previousEnergyEndJPerKg
        || segment.temperatureStartK !== previousTemperatureEndK
      ) {
        return failClosed('disconnected-or-discontinuous-material-response', true);
      }
      energyMaxJPerKg = segment.energyEndJPerKg;
      previousEnergyEndJPerKg = segment.energyEndJPerKg;
      previousTemperatureEndK = segment.temperatureEndK;
      if (
        specificEnergy >= segment.energyStartJPerKg
        && specificEnergy <= segment.energyEndJPerKg
      ) {
        containingSegmentCount += 1;
      }
    }
    if (containingSegmentCount === 0) {
      return failClosed('specific-energy-outside-response-domain', true);
    }
    return {
      ready: true,
      status: 'ready-contiguous-monotone-response-domain',
      materialFound: true,
      energyMinJPerKg,
      energyMaxJPerKg,
      containingSegmentCount,
      reachableSegmentCount: segmentCount
    };
  }
  return failClosed('missing-material');
}

export function resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable(
  table,
  materialId,
  specificInternalEnergyJPerKg,
  minTemperatureK,
  maxTemperatureK
) {
  const responseDomain = resolveThermalCarrierReachableEnergyDomainFromTable(
    table,
    materialId,
    specificInternalEnergyJPerKg
  );
  const specificEnergy = Number(specificInternalEnergyJPerKg);
  const minTemperature = Number(minTemperatureK);
  const maxTemperature = Number(maxTemperatureK);
  const failClosed = (status) => ({
    ...responseDomain,
    ready: false,
    status,
    energyMinJPerKg: Number.isFinite(specificEnergy) ? specificEnergy : 0,
    energyMaxJPerKg: Number.isFinite(specificEnergy) ? specificEnergy : 0
  });
  if (!responseDomain.ready) return responseDomain;
  if (
    !Number.isFinite(minTemperature)
    || !Number.isFinite(maxTemperature)
    || minTemperature > maxTemperature
  ) {
    return failClosed('invalid-neighbor-temperature-range');
  }

  const temperatureAt = (energyJPerKg) => resolveThermalStateFromTable(
    table,
    materialId,
    energyJPerKg
  ).temperatureK;
  const domainLo = responseDomain.energyMinJPerKg;
  const domainHi = responseDomain.energyMaxJPerKg;
  const temperatureLo = temperatureAt(domainLo);
  const temperatureHi = temperatureAt(domainHi);
  if (
    !Number.isFinite(temperatureLo)
    || !Number.isFinite(temperatureHi)
    || temperatureLo > temperatureHi
  ) {
    return failClosed('non-monotone-response-temperature-domain');
  }

  let energyLo = domainLo;
  if (minTemperature > temperatureLo) {
    if (minTemperature > temperatureHi) return failClosed('neighbor-range-below-response');
    let lo = domainLo;
    let hi = domainHi;
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const mid = lo + (hi - lo) * 0.5;
      if (temperatureAt(mid) >= minTemperature) hi = mid;
      else lo = mid;
    }
    energyLo = hi;
  }

  let energyHi = domainHi;
  if (maxTemperature < temperatureHi) {
    if (maxTemperature < temperatureLo) return failClosed('neighbor-range-above-response');
    let lo = domainLo;
    let hi = domainHi;
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const mid = lo + (hi - lo) * 0.5;
      if (temperatureAt(mid) <= maxTemperature) lo = mid;
      else hi = mid;
    }
    energyHi = lo;
  }

  // The packed thermo temperature and the graph/table inverse can differ by a
  // few ulps (notably in Debye segments). The current carrier is definitionally
  // part of its self-inclusive neighbor range, so retain its exact packed U.
  energyLo = Math.min(energyLo, specificEnergy);
  energyHi = Math.max(energyHi, specificEnergy);

  if (
    !Number.isFinite(energyLo)
    || !Number.isFinite(energyHi)
    || energyLo > specificEnergy
    || energyHi < specificEnergy
    || energyLo > energyHi
  ) {
    return failClosed('current-energy-outside-neighbor-response-intersection');
  }
  return {
    ...responseDomain,
    status: 'ready-temperature-intersection',
    energyMinJPerKg: energyLo,
    energyMaxJPerKg: energyHi,
    minTemperatureK: minTemperature,
    maxTemperatureK: maxTemperature
  };
}

function clampSpecificEnergyDeltaToEnergyDomain({
  dUSpecific,
  currentSpecificEnergyJPerKg,
  energyDomain
}) {
  if (
    energyDomain?.ready !== true
    || !Number.isFinite(dUSpecific)
    || !Number.isFinite(currentSpecificEnergyJPerKg)
    || !Number.isFinite(energyDomain.energyMinJPerKg)
    || !Number.isFinite(energyDomain.energyMaxJPerKg)
    || energyDomain.energyMinJPerKg > energyDomain.energyMaxJPerKg
  ) {
    return 0;
  }
  return Math.min(
    energyDomain.energyMaxJPerKg - currentSpecificEnergyJPerKg,
    Math.max(
      energyDomain.energyMinJPerKg - currentSpecificEnergyJPerKg,
      dUSpecific
    )
  );
}

function adjacentFloat32(value, towardPositive) {
  if (!Number.isFinite(value)) return value;
  const scalar = new Float32Array([value]);
  const words = new Uint32Array(scalar.buffer);
  if (scalar[0] === 0) {
    words[0] = towardPositive ? 0x0000_0001 : 0x8000_0001;
  } else if ((scalar[0] > 0) === towardPositive) {
    words[0] += 1;
  } else {
    words[0] -= 1;
  }
  return scalar[0];
}

export function clampOpenReservoirSpecificEnergyDeltaToEnergyDomain({
  dUSpecific,
  sourceAnchorSpecificEnergyJPerKg,
  pairAdjustedSpecificEnergyJPerKg,
  energyDomain,
  reachableEnergyDomain
}) {
  if (
    energyDomain?.ready !== true
    || reachableEnergyDomain?.ready !== true
    || !Number.isFinite(dUSpecific)
    || !Number.isFinite(sourceAnchorSpecificEnergyJPerKg)
    || !Number.isFinite(pairAdjustedSpecificEnergyJPerKg)
  ) {
    return 0;
  }
  const anchorLo = Number(energyDomain.energyMinJPerKg);
  const anchorHi = Number(energyDomain.energyMaxJPerKg);
  const reachableLo = Number(reachableEnergyDomain.energyMinJPerKg);
  const reachableHi = Number(reachableEnergyDomain.energyMaxJPerKg);
  if (
    !Number.isFinite(anchorLo)
    || !Number.isFinite(anchorHi)
    || !Number.isFinite(reachableLo)
    || !Number.isFinite(reachableHi)
    || anchorLo > sourceAnchorSpecificEnergyJPerKg
    || anchorHi < sourceAnchorSpecificEnergyJPerKg
    || anchorLo > anchorHi
    || reachableLo > pairAdjustedSpecificEnergyJPerKg
    || reachableHi < pairAdjustedSpecificEnergyJPerKg
    || reachableLo > anchorLo
    || reachableHi < anchorHi
  ) {
    return 0;
  }
  if (dUSpecific > 0) {
    let targetHi = anchorHi;
    if (anchorHi < reachableHi) {
      const ingressEnergy = adjacentFloat32(anchorHi, true);
      if (ingressEnergy <= reachableHi) targetHi = ingressEnergy;
    }
    return Math.min(
      dUSpecific,
      Math.max(0, targetHi - pairAdjustedSpecificEnergyJPerKg)
    );
  }
  if (dUSpecific < 0) {
    let targetLo = anchorLo;
    if (anchorLo > reachableLo) {
      const ingressEnergy = adjacentFloat32(anchorLo, false);
      if (ingressEnergy >= reachableLo) targetLo = ingressEnergy;
    }
    return Math.max(
      dUSpecific,
      Math.min(0, targetLo - pairAdjustedSpecificEnergyJPerKg)
    );
  }
  return 0;
}

function clampWallSpecificEnergyDelta({ dUSpecific, temperatureK, wallTemperatureK, temperatureSlopeKdPerJPerKg }) {
  if (!(temperatureSlopeKdPerJPerKg > 0)) return dUSpecific;
  if (!Number.isFinite(dUSpecific) || !Number.isFinite(temperatureK) || !Number.isFinite(wallTemperatureK)) return dUSpecific;
  const nextTemperatureK = temperatureK + dUSpecific * temperatureSlopeKdPerJPerKg;
  const crossesColdWall = temperatureK > wallTemperatureK && nextTemperatureK < wallTemperatureK;
  const crossesHotWall = temperatureK < wallTemperatureK && nextTemperatureK > wallTemperatureK;
  if (!crossesColdWall && !crossesHotWall) return dUSpecific;
  return (wallTemperatureK - temperatureK) / temperatureSlopeKdPerJPerKg;
}

function clampPairConductionEnergy({
  dE,
  temperatureK,
  otherTemperatureK,
  temperatureSlopeKdPerJPerKg,
  otherTemperatureSlopeKdPerJPerKg,
  massKg,
  otherMassKg
}) {
  if (!Number.isFinite(dE) || dE === 0) return 0;
  const gapK = otherTemperatureK - temperatureK;
  if (!Number.isFinite(gapK) || gapK === 0 || Math.sign(dE) !== Math.sign(gapK)) return dE;
  const responsePerJ = (temperatureSlopeKdPerJPerKg / Math.max(massKg, 1e-30))
    + (otherTemperatureSlopeKdPerJPerKg / Math.max(otherMassKg, 1e-30));
  if (!(responsePerJ > 0)) return dE;
  const equalizingEnergyJ = Math.abs(gapK) / responsePerJ;
  const limitJ = equalizingEnergyJ * PAIR_CONDUCTION_RELAXATION_LIMIT;
  return Math.sign(dE) * Math.min(Math.abs(dE), limitJ);
}

function clampSpecificEnergyDeltaToTemperatureRange({
  dUSpecific,
  temperatureK,
  temperatureSlopeKdPerJPerKg,
  minTemperatureK,
  maxTemperatureK
}) {
  if (!(temperatureSlopeKdPerJPerKg > 0)) return dUSpecific;
  if (!Number.isFinite(dUSpecific) || dUSpecific === 0 || !Number.isFinite(temperatureK)) return dUSpecific;
  const nextTemperatureK = temperatureK + dUSpecific * temperatureSlopeKdPerJPerKg;
  if (Number.isFinite(minTemperatureK) && nextTemperatureK < minTemperatureK) {
    return (minTemperatureK - temperatureK) / temperatureSlopeKdPerJPerKg;
  }
  if (Number.isFinite(maxTemperatureK) && nextTemperatureK > maxTemperatureK) {
    return (maxTemperatureK - temperatureK) / temperatureSlopeKdPerJPerKg;
  }
  return dUSpecific;
}

function writeResolvedThermoRow(thermo, index, materialId, resolved, sourceThermo2) {
  const offset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
  thermo[offset] = materialId;
  thermo[offset + 1] = resolved.phaseId;
  thermo[offset + 2] = resolved.temperatureK;
  thermo[offset + 3] = resolved.restDensityKgPerM3;
  thermo[offset + 4] = resolved.phaseFractions.solid;
  thermo[offset + 5] = resolved.phaseFractions.liquid;
  thermo[offset + 6] = resolved.phaseFractions.gas;
  thermo[offset + 7] = resolved.phaseFractions.plasma;
  thermo[offset + 8] = sourceThermo2[0];
  thermo[offset + 9] = sourceThermo2[1];
  thermo[offset + 10] = resolved.status;
  thermo[offset + 11] = sourceThermo2[3] ?? 0;
}

function outputEnvelope({
  backend,
  sphParticleState,
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null,
  thermalResponseGraphUpload = null,
  state,
  thermo,
  wallHeatJ,
  radiativeAmbientHeatJ = 0,
  ambientRadiationExchangeEnabled = false,
  dtS,
  conductionRate,
  ambientTemperatureK = SPH_THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT,
  thermalEnvironmentAuthority = null,
  wallReservoirAuthority = null,
  requestedWallRate = null,
  wallRate,
  wallLayerM,
  boxDimsM,
  stateBuffer = null,
  thermoBuffer = null,
  stateBufferByteLength = state.byteLength,
  thermoBufferByteLength = thermo.byteLength,
  retainedOutputParticleBuffers = false,
  destroyOutputParticleBuffers = null,
  readbackMode = FULL_READBACK_MODE,
  outputBufferInitializationMode = null,
  materialPropertyBankWarmInputShaderBinding = null,
  neighborLookupMode = null,
  legacyPrivateSpatialBuildCount = 0,
  legacyFixedCandidateBuildCount = 0,
  legacyExhaustiveTraversalCount = 0,
  canonicalThermalProposal = null,
  readbackTelemetry = createGpuReadbackTelemetry({
    scope: 'sph-thermal-step',
    complete: false,
    unknownSources: ['unclassified-thermal-backend']
  })
}) {
  const materialPropertyBankWarmInputConsumer = materialBankWarmInputConsumerForOutput(
    thermalMaterialTable,
    materialPropertyBankWarmInputShaderBinding || {}
  );
  const canonicalSpatialThermalProposal = canonicalThermalProposal?.proposalMode
    === 'schroeder-spatial-exact-near-v2';
  const classicThermalProposalStage = canonicalThermalProposal?.proposalMode
    === 'classic-lookup-neutral-v2'
    ? canonicalThermalProposal.proposal
    : null;
  return {
    schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
    backend,
    status: 'thermal-step-executed',
    kernelScope: THERMAL_SCOPE,
    sourceSchema: sphParticleState.schema,
    materialTableSchema: thermalMaterialTable.schema,
    materialPropertyBankWarmInputConsumer,
    materialPropertyBankWarmInputRowCount:
      materialPropertyBankWarmInputConsumer.sourceRowCount ?? thermalMaterialTable.materialPropertyBankWarmInputRowCount ?? 0,
    materialPropertyBankWarmInputMatchedMaterialCount:
      materialPropertyBankWarmInputConsumer.matchedMaterialCount
        ?? thermalMaterialTable.materialPropertyBankWarmInputMatchedMaterialCount
        ?? 0,
    thermalClosureGraphSetSchema: thermalClosureGraphSet?.schema ?? null,
    thermalClosureGraphBankSchema: thermalClosureGraphBank?.schema ?? null,
    thermalPhaseResponseTableSchema: thermalPhaseResponseTable?.schema ?? null,
    thermalResponseGraphBufferSetSchema: thermalResponseGraphUpload?.schema ?? null,
    thermalResponseGraphBufferMode: thermalResponseGraphUpload
      ? (thermalResponseGraphUpload.borrowed ? 'borrowed-webgpu-upload' : 'temporary-webgpu-upload')
      : null,
    particleCount: sphParticleState.particleCount,
    materialCount: thermalMaterialTable.materialCount,
    segmentCount: thermalMaterialTable.segmentCount,
    responseCount: thermalPhaseResponseTable?.responseCount ?? null,
    thermalGraphCount: thermalClosureGraphBank?.graphCount ?? thermalClosureGraphSet?.graphCount ?? null,
    thermalResponseGraphBufferResponseByteLength: thermalResponseGraphUpload?.responseBufferByteLength ?? null,
    thermalResponseGraphBufferSampleByteLength: thermalResponseGraphUpload?.graphSampleBufferByteLength ?? null,
    sourceStep: sphParticleState.step ?? 0,
    step: (sphParticleState.step ?? 0) + 1,
    sourceTime: sphParticleState.time ?? 0,
    time: finiteNumber(sphParticleState.time, 0) + dtS,
    dtS,
    conductionRate,
    ambientTemperatureK,
    thermalEnvironmentAuthority,
    ambientRadiationExchangeEnabled,
    ambientRadiationExchangeAuthority:
      'wall-reservoir-authority.exchangeEnabled',
    wallReservoirAuthority,
    wallExchangeEnabled: wallReservoirAuthority?.exchangeEnabled === true,
    requestedWallRate,
    wallRate,
    wallLayerM,
    boxDimsM: [...boxDimsM],
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    state,
    thermo,
    stateBuffer,
    thermoBuffer,
    stateBufferByteLength,
    thermoBufferByteLength,
    retainedOutputParticleBuffers,
    destroyOutputParticleBuffers,
    readbackMode,
    outputBufferInitializationMode,
    neighborLookupMode,
    legacyPrivateSpatialBuildCount,
    legacyFixedCandidateBuildCount,
    legacyExhaustiveTraversalCount,
    thermalPairLaw: canonicalThermalProposal || backend === 'cpu-reference'
      ? 'reciprocal-directional-energy-budget-v2'
      : 'legacy-one-sided-aggregate',
    thermalPairConductanceAuthority: backend === 'cpu-reference'
      ? 'phase-bulk-conductivity-harmonic-mean'
      : 'legacy-global-conduction-rate',
    thermalPairContactGeometryAuthority: backend === 'cpu-reference'
      ? 'overlapping-sphere-contact-disk-center-path'
      : 'support-distance-weight',
    legacyConductionRateEffective: backend !== 'cpu-reference',
    thermalProposalMode: canonicalThermalProposal?.proposalMode ?? null,
    thermalProposalLookupMode:
      classicThermalProposalStage?.lookupMode ?? null,
    thermalProposalDispatchCount:
      classicThermalProposalStage?.proposalDispatchCount
        ?? canonicalThermalProposal?.producerStage?.proposalDispatchCount
        ?? 0,
    thermalProposalProducerApplySingleSubmission:
      canonicalThermalProposal?.producerApplySubmissionPolicy
        === 'single-command-buffer-producer-before-apply'
      || classicThermalProposalStage?.producerApplySubmissionPolicy
        === 'caller-single-command-buffer',
    thermalProposalMatchedTimeStateBound:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.matchedTimeStateBuffer != null
        : false,
    thermalProposalNormalLookupBinned:
      classicThermalProposalStage?.normalLookupBinned ?? false,
    thermalProposalResidentOverflowFallbackCapable:
      classicThermalProposalStage?.residentOverflowFallbackCapable ?? false,
    thermalProposalBinnedTraversalCount:
      classicThermalProposalStage?.binnedTraversalCount ?? 0,
    thermalProposalExhaustiveTraversalConfiguredCount:
      classicThermalProposalStage?.exhaustiveTraversalConfiguredCount ?? 0,
    thermalProposalExhaustiveTraversalPotentialCount:
      classicThermalProposalStage?.exhaustiveTraversalPotentialCount ?? 0,
    thermalProposalFallbackEvidenceWord:
      classicThermalProposalStage?.fallbackEvidenceWord ?? null,
    thermalProposalFallbackReason:
      classicThermalProposalStage?.neighborBinsFallbackReason ?? null,
    thermalProposalRuntimeCacheHit:
      classicThermalProposalStage?.runtimeCacheHit ?? null,
    thermalProposalRuntimeAllocationCount:
      classicThermalProposalStage?.runtimeAllocationCount ?? null,
    thermalProposalSchroederSpatialBuildCount:
      classicThermalProposalStage?.schroederSpatialBuildCount ?? 0,
    thermalProposalDiagnostics: classicThermalProposalStage
      ? Object.freeze({
        schema: 'peercompute.ulg.classic-thermal-proposal-diagnostics.v2',
        status: 'gpu-resident-counters-unread',
        conductionEvidenceBuffer:
          classicThermalProposalStage.conductionEvidenceBuffer,
        radiationEvidenceBuffer:
          classicThermalProposalStage.radiationEvidenceBuffer,
        exhaustiveFallbackEvidenceWord:
          classicThermalProposalStage.fallbackEvidenceWord,
        evidenceUnit: classicThermalProposalStage.fallbackEvidenceUnit,
        ownership: 'borrowed-until-pooled-arena-reuse'
      })
      : null,
    canonicalSpatialThermalProposal,
    canonicalSpatialThermalProposalStatus:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.proposal?.status ?? null
        : null,
    canonicalSpatialThermalGenerationId:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.execution?.generationId ?? null
        : null,
    canonicalSpatialThermalSupportEpoch:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.execution?.supportEpoch ?? null
        : null,
    canonicalSpatialThermalPositionEpoch:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.execution?.positionEpoch ?? null
        : null,
    canonicalSpatialThermalTopologyEpoch:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.execution?.topologyEpoch ?? null
        : null,
    canonicalSpatialThermalConsumerReceipts:
      canonicalSpatialThermalProposal
        ? canonicalThermalProposal?.consumerReceipts ?? null
        : null,
    canonicalThermalProposal,
    fullReadbackPerformed: readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackPerformed:
      readbackMode !== NO_FULL_READBACK_MODE,
    fullParticleReadbackFree:
      readbackMode === NO_FULL_READBACK_MODE,
    ...readbackTelemetry,
    wallHeatJ: { ...wallHeatJ },
    radiativeAmbientHeatJ,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function runSphThermalStepCpu({
  sphParticleState,
  thermalMaterialTable,
  wallTemperaturesK,
  wallReservoirAuthority = null,
  wallModel,
  boxDimsM = [5, 5, 5],
  dtS = 0,
  conductionRate = SPH_THERMAL_PAIR_CONDUCTION_RATE_DEFAULT,
  ambientTemperatureK,
  thermalEnvironmentAuthority = null,
  wallRate = 6e4,
  wallLayerM = sphParticleState?.smoothingLengthM
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  if (thermalMaterialTable?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('runSphThermalStepCpu requires a packed thermal material table');
  }
  const resolvedThermalEnvironmentAuthority =
    resolveSphThermalEnvironmentAuthority({
      ambientTemperatureK,
      thermalEnvironmentAuthority
    });
  const resolvedAmbientTemperatureK =
    resolvedThermalEnvironmentAuthority.ambientTemperatureK;
  const resolvedWallReservoirAuthority =
    resolveSphWallReservoirAuthority({
      wallTemperaturesK,
      wallReservoirAuthority,
      wallModel
    });
  const resolvedWallTemperaturesK =
    resolvedWallReservoirAuthority.faces;
  const requestedWallRate = wallRate;
  const effectiveWallRate = resolvedWallReservoirAuthority.exchangeEnabled
    ? wallRate
    : 0;
  const ambientRadiationExchangeEnabled =
    resolvedWallReservoirAuthority.exchangeEnabled === true;
  const particleCount = sphParticleState.particleCount;
  const dims = finiteVector3(boxDimsM, [5, 5, 5]);
  const dt = finiteNumber(dtS, 0);
  const h = finiteNumber(sphParticleState.smoothingLengthM, 0);
  const support = 2 * h;
  const layer = finiteNumber(wallLayerM, h);
  const state = new Float32Array(sphParticleState.state);
  const thermo = new Float32Array(sphParticleState.thermo);
  const du = new Float64Array(particleCount);
  const wallHeatJ = Object.fromEntries(FACE_IDS.map((faceId) => [faceId, 0]));
  let radiativeAmbientHeatJ = 0;

  const carriers = Array.from({ length: particleCount }, (_, index) => {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const sourceMass = Number(sphParticleState.state[stateOffset + 3]);
    if (!(Number.isFinite(sourceMass) && sourceMass > 0)) return null;
    const massKg = Math.max(sourceMass, 1e-30);
    const materialId = sphParticleState.thermo[thermoOffset];
    const specificEnergyJPerKg = Number(sphParticleState.state[stateOffset + 7]);
    const resolvedSourceThermalState = resolveThermalStateFromTable(
      thermalMaterialTable,
      materialId,
      specificEnergyJPerKg
    );
    const resolvedThermalConductivity = resolveThermalConductivityFromTable(
      thermalMaterialTable,
      materialId,
      specificEnergyJPerKg
    );
    return {
      index,
      stateOffset,
      thermoOffset,
      massKg,
      materialId,
      specificEnergyJPerKg,
      // Temperature is a derived law input. Resolve it from authoritative
      // (material,U); the cached thermo row may lag a phase transfer or source
      // family publication by one dispatch.
      temperatureK: finiteNumber(resolvedSourceThermalState.temperatureK, 0),
      temperatureSlopeKdPerJPerKg: resolveThermalCarrierTemperatureSlopeFromTable(
        thermalMaterialTable,
        materialId,
        specificEnergyJPerKg,
        sphParticleState.thermo[thermoOffset + 1],
        sphParticleState.thermo.subarray(thermoOffset + 4, thermoOffset + 8)
      ),
      energyDomain: resolveThermalCarrierEnergyDomainFromTable(
        thermalMaterialTable,
        materialId,
        specificEnergyJPerKg
      ),
      reachableEnergyDomain: resolveThermalCarrierReachableEnergyDomainFromTable(
        thermalMaterialTable,
        materialId,
        specificEnergyJPerKg
      ),
      radiusM: particleNominalRadiusM(
        massKg,
        finiteNumber(sphParticleState.thermo[thermoOffset + 3], 0)
      ),
      thermalConductivityWPerMK:
        resolvedThermalConductivity.thermalConductivityWPerMK,
      thermalConductivityStatus: resolvedThermalConductivity.status,
      emissivity: thermalEmissivityFromTable(thermalMaterialTable, materialId)
    };
  });
  const pairFluxes = [];
  const requestedGainJ = new Float64Array(particleCount);
  const requestedLossJ = new Float64Array(particleCount);
  const neighborMinTemperatureK = new Float64Array(particleCount);
  const neighborMaxTemperatureK = new Float64Array(particleCount);
  for (let index = 0; index < particleCount; index += 1) {
    const temperatureK = carriers[index]?.temperatureK ?? 0;
    neighborMinTemperatureK[index] = temperatureK;
    neighborMaxTemperatureK[index] = temperatureK;
  }

  // Build each unordered pair once. The signed energies are energy gained by
  // i; applying their exact negatives to j makes conservation structural.
  for (let i = 0; i < particleCount; i += 1) {
    const self = carriers[i];
    if (!self?.reachableEnergyDomain.ready) continue;
    for (let j = i + 1; j < particleCount; j += 1) {
      const other = carriers[j];
      if (!other?.reachableEnergyDomain.ready) continue;
      const dx = sphParticleState.state[self.stateOffset]
        - sphParticleState.state[other.stateOffset];
      const dy = sphParticleState.state[self.stateOffset + 1]
        - sphParticleState.state[other.stateOffset + 1];
      const dz = sphParticleState.state[self.stateOffset + 2]
        - sphParticleState.state[other.stateOffset + 2];
      const distanceM = Math.hypot(dx, dy, dz);
      const pairRadiiM = self.radiusM + other.radiusM;
      const pairSupportM = Math.max(support, pairRadiiM);
      const radiationSupportM = SPH_THERMAL_RADIATION_PAIR_RANGE_RADII * pairRadiiM;
      if (distanceM >= Math.max(pairSupportM, radiationSupportM)) continue;
      neighborMinTemperatureK[i] = Math.min(
        neighborMinTemperatureK[i],
        other.temperatureK
      );
      neighborMaxTemperatureK[i] = Math.max(
        neighborMaxTemperatureK[i],
        other.temperatureK
      );
      neighborMinTemperatureK[j] = Math.min(
        neighborMinTemperatureK[j],
        self.temperatureK
      );
      neighborMaxTemperatureK[j] = Math.max(
        neighborMaxTemperatureK[j],
        self.temperatureK
      );

      let conductionEnergyJ = 0;
      const contact = conductiveSphereContactGeometry(
        self.radiusM,
        other.radiusM,
        distanceM
      );
      if (
        contact.contact
        && self.thermalConductivityWPerMK > 0
        && other.thermalConductivityWPerMK > 0
        && contact.conductionPathLengthM > 0
      ) {
        const pairConductivityWPerMK = harmonicMeanPositive(
          self.thermalConductivityWPerMK,
          other.thermalConductivityWPerMK
        );
        const pairConductanceWPerK = pairConductivityWPerMK
          * contact.contactAreaM2
          / contact.conductionPathLengthM;
        conductionEnergyJ = clampPairConductionEnergy({
          dE: pairConductanceWPerK
            * (other.temperatureK - self.temperatureK)
            * dt,
          temperatureK: self.temperatureK,
          otherTemperatureK: other.temperatureK,
          temperatureSlopeKdPerJPerKg: self.temperatureSlopeKdPerJPerKg,
          otherTemperatureSlopeKdPerJPerKg: other.temperatureSlopeKdPerJPerKg,
          massKg: self.massKg,
          otherMassKg: other.massKg
        });
      }
      let radiationEnergyJ = 0;
      if (
        self.emissivity > 0
        && other.emissivity > 0
        && distanceM < radiationSupportM
      ) {
        const rawRadiationEnergyJ = self.emissivity * other.emissivity
          * SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4
          * (other.temperatureK ** 4 - self.temperatureK ** 4)
          * radiativeViewAreaM2(self.radiusM, other.radiusM, distanceM)
          * dt;
        radiationEnergyJ = clampPairConductionEnergy({
          dE: rawRadiationEnergyJ,
          temperatureK: self.temperatureK,
          otherTemperatureK: other.temperatureK,
          temperatureSlopeKdPerJPerKg: self.temperatureSlopeKdPerJPerKg,
          otherTemperatureSlopeKdPerJPerKg: other.temperatureSlopeKdPerJPerKg,
          massKg: self.massKg,
          otherMassKg: other.massKg
        });
      }
      const totalEnergyJ = conductionEnergyJ + radiationEnergyJ;
      if (!Number.isFinite(totalEnergyJ) || totalEnergyJ === 0) continue;
      pairFluxes.push({ i, j, conductionEnergyJ, radiationEnergyJ, totalEnergyJ });
      if (totalEnergyJ > 0) {
        requestedGainJ[i] += totalEnergyJ;
        requestedLossJ[j] += totalEnergyJ;
      } else {
        requestedLossJ[i] -= totalEnergyJ;
        requestedGainJ[j] -= totalEnergyJ;
      }
    }
  }

  for (let index = 0; index < particleCount; index += 1) {
    const carrier = carriers[index];
    if (!carrier?.reachableEnergyDomain.ready) continue;
    if (!(requestedGainJ[index] > 0 || requestedLossJ[index] > 0)) {
      carrier.pairEnergyDomain = carrier.reachableEnergyDomain;
      continue;
    }
    carrier.pairEnergyDomain =
      resolveThermalCarrierEnergyDomainForTemperatureRangeFromTable(
        thermalMaterialTable,
        carrier.materialId,
        carrier.specificEnergyJPerKg,
        neighborMinTemperatureK[index],
        neighborMaxTemperatureK[index]
      );
  }

  const gainScale = new Float64Array(particleCount);
  const lossScale = new Float64Array(particleCount);
  for (let index = 0; index < particleCount; index += 1) {
    const carrier = carriers[index];
    const pairEnergyDomain = carrier?.pairEnergyDomain;
    if (!pairEnergyDomain?.ready) continue;
    const gainRoomJ = Math.max(
      0,
      carrier.massKg * (
        pairEnergyDomain.energyMaxJPerKg - carrier.specificEnergyJPerKg
      )
    );
    const lossRoomJ = Math.max(
      0,
      carrier.massKg * (
        carrier.specificEnergyJPerKg - pairEnergyDomain.energyMinJPerKg
      )
    );
    gainScale[index] = requestedGainJ[index] > 0
      ? Math.min(1, gainRoomJ / requestedGainJ[index])
      : 1;
    lossScale[index] = requestedLossJ[index] > 0
      ? Math.min(1, lossRoomJ / requestedLossJ[index])
      : 1;
  }

  for (const pair of pairFluxes) {
    const scale = pair.totalEnergyJ > 0
      ? Math.min(gainScale[pair.i], lossScale[pair.j])
      : Math.min(lossScale[pair.i], gainScale[pair.j]);
    const acceptedEnergyJ = pair.totalEnergyJ * scale;
    du[pair.i] += acceptedEnergyJ / carriers[pair.i].massKg;
    du[pair.j] -= acceptedEnergyJ / carriers[pair.j].massKg;
  }

  for (let i = 0; i < particleCount; i += 1) {
    const carrier = carriers[i];
    if (!carrier?.energyDomain.ready) continue;
    const { stateOffset: oi, massKg: mass } = carrier;
    const position = [
      sphParticleState.state[oi],
      sphParticleState.state[oi + 1],
      sphParticleState.state[oi + 2]
    ];
    for (
      let faceIndex = 0;
      resolvedWallReservoirAuthority.exchangeEnabled
        && faceIndex < FACE_IDS.length;
      faceIndex += 1
    ) {
      const distance = wallDistance(position, dims, faceIndex);
      if (distance >= layer) continue;
      const faceWallTempK = wallTemp(
        resolvedWallTemperaturesK,
        FACE_IDS[faceIndex]
      );
      const currentSpecificEnergyJPerKg = carrier.specificEnergyJPerKg + du[i];
      const currentThermalState = resolveThermalStateFromTable(
        thermalMaterialTable,
        carrier.materialId,
        currentSpecificEnergyJPerKg
      );
      const currentTemperatureK = currentThermalState.temperatureK;
      const currentTemperatureSlope = resolveThermalCarrierTemperatureSlopeFromTable(
        thermalMaterialTable,
        carrier.materialId,
        currentSpecificEnergyJPerKg,
        currentThermalState.phaseId,
        [
          currentThermalState.phaseFractions.solid,
          currentThermalState.phaseFractions.liquid,
          currentThermalState.phaseFractions.gas,
          currentThermalState.phaseFractions.plasma
        ]
      );
      const rawDUSpecific =
        effectiveWallRate
        * (faceWallTempK - currentTemperatureK)
        * (1 - distance / layer)
        * dt
        / mass;
      const equilibriumLimitedDUSpecific = clampWallSpecificEnergyDelta({
        dUSpecific: rawDUSpecific,
        temperatureK: currentTemperatureK,
        wallTemperatureK: faceWallTempK,
        temperatureSlopeKdPerJPerKg: currentTemperatureSlope
      });
      const dUSpecific = clampOpenReservoirSpecificEnergyDeltaToEnergyDomain({
        dUSpecific: equilibriumLimitedDUSpecific,
        sourceAnchorSpecificEnergyJPerKg: carrier.specificEnergyJPerKg,
        pairAdjustedSpecificEnergyJPerKg: currentSpecificEnergyJPerKg,
        energyDomain: carrier.energyDomain,
        reachableEnergyDomain: carrier.reachableEnergyDomain
      });
      du[i] += dUSpecific;
      wallHeatJ[FACE_IDS[faceIndex]] += dUSpecific * mass;
    }
    // Ambient gray-body radiation (mirrors the WGSL kernel): full-sphere
    // Stefan-Boltzmann against the box environment; open-system source/sink
    // accounted in radiativeAmbientHeatJ (positive = absorbed by particles).
    if (
      ambientRadiationExchangeEnabled
      && carrier.emissivity > 0
      && carrier.radiusM > 0
      && resolvedAmbientTemperatureK > 0
    ) {
      const surfaceAreaM2 = 4 * Math.PI * carrier.radiusM * carrier.radiusM;
      const currentSpecificEnergyJPerKg = carrier.specificEnergyJPerKg + du[i];
      const currentThermalState = resolveThermalStateFromTable(
        thermalMaterialTable,
        carrier.materialId,
        currentSpecificEnergyJPerKg
      );
      const currentTemperatureK = currentThermalState.temperatureK;
      const currentTemperatureSlope = resolveThermalCarrierTemperatureSlopeFromTable(
        thermalMaterialTable,
        carrier.materialId,
        currentSpecificEnergyJPerKg,
        currentThermalState.phaseId,
        [
          currentThermalState.phaseFractions.solid,
          currentThermalState.phaseFractions.liquid,
          currentThermalState.phaseFractions.gas,
          currentThermalState.phaseFractions.plasma
        ]
      );
      const rawAmbientDE = carrier.emissivity * SPH_THERMAL_STEFAN_BOLTZMANN_W_PER_M2_K4
        * (resolvedAmbientTemperatureK ** 4 - currentTemperatureK ** 4)
        * surfaceAreaM2
        * dt;
      const equilibriumLimitedDUSpecific = clampWallSpecificEnergyDelta({
        dUSpecific: rawAmbientDE / mass,
        temperatureK: currentTemperatureK,
        wallTemperatureK: resolvedAmbientTemperatureK,
        temperatureSlopeKdPerJPerKg: currentTemperatureSlope
      });
      const ambientDUSpecific = clampOpenReservoirSpecificEnergyDeltaToEnergyDomain({
        dUSpecific: equilibriumLimitedDUSpecific,
        sourceAnchorSpecificEnergyJPerKg: carrier.specificEnergyJPerKg,
        pairAdjustedSpecificEnergyJPerKg: currentSpecificEnergyJPerKg,
        energyDomain: carrier.energyDomain,
        reachableEnergyDomain: carrier.reachableEnergyDomain
      });
      du[i] += ambientDUSpecific;
      radiativeAmbientHeatJ += ambientDUSpecific * mass;
    }
  }

  for (let i = 0; i < particleCount; i += 1) {
    const stateOffset = i * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = i * SPH_GPU_PARTICLE_THERMO_FLOATS;
    if (!(finiteNumber(sphParticleState.state[stateOffset + 3], 0) > 0)) continue;
    const carrier = carriers[i];
    const candidateSpecificEnergyJPerKg = carrier.specificEnergyJPerKg + du[i];
    state[stateOffset + 7] = carrier.reachableEnergyDomain.ready
      ? Math.min(
        carrier.reachableEnergyDomain.energyMaxJPerKg,
        Math.max(
          carrier.reachableEnergyDomain.energyMinJPerKg,
          Number.isFinite(candidateSpecificEnergyJPerKg)
            ? candidateSpecificEnergyJPerKg
            : carrier.specificEnergyJPerKg
        )
      )
      : (Number.isFinite(carrier.specificEnergyJPerKg) ? carrier.specificEnergyJPerKg : 0);
    const materialId = sphParticleState.thermo[thermoOffset];
    const resolved = resolveThermalStateFromTable(thermalMaterialTable, materialId, state[stateOffset + 7]);
    writeResolvedThermoRow(thermo, i, materialId, resolved, [
      sphParticleState.thermo[thermoOffset + 8],
      sphParticleState.thermo[thermoOffset + 9],
      sphParticleState.thermo[thermoOffset + 10],
      sphParticleState.thermo[thermoOffset + 11]
    ]);
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    thermalMaterialTable,
    state,
    thermo,
    wallHeatJ,
    radiativeAmbientHeatJ,
    ambientRadiationExchangeEnabled,
    dtS: dt,
    conductionRate,
    ambientTemperatureK: resolvedAmbientTemperatureK,
    thermalEnvironmentAuthority: resolvedThermalEnvironmentAuthority,
    wallReservoirAuthority: resolvedWallReservoirAuthority,
    requestedWallRate,
    wallRate: effectiveWallRate,
    wallLayerM: layer,
    boxDimsM: dims,
    neighborLookupMode: 'cpu-exhaustive-particle-scan',
    legacyPrivateSpatialBuildCount: 0,
    legacyExhaustiveTraversalCount: 1
  });
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return tagWebGpuBufferDevice(buffer, device);
}

function resolveMaterialBankWarmInputShaderBinding(device, {
  sphParticleState = null,
  sphParticleUpload = null
} = {}) {
  const borrowedBuffer = sphParticleUpload?.materialPropertyBankWarmInputBuffer || null;
  const borrowedRowCount = Math.max(0, Math.round(finiteNumber(
    sphParticleUpload?.materialPropertyBankWarmInputRowCount,
    0
  )));
  if (borrowedBuffer && borrowedRowCount > 0) {
    return {
      buffer: borrowedBuffer,
      rowCount: borrowedRowCount,
      bufferSource: 'sph-particle-upload',
      borrowed: true,
      destroy() {}
    };
  }
  const packedRows = sphParticleState?.materialPropertyBankWarmInputTable?.rows;
  const packedRowCount = Math.max(0, Math.round(finiteNumber(
    sphParticleState?.materialPropertyBankWarmInputTable?.rowCount,
    0
  )));
  if (packedRows?.byteLength > 0 && packedRowCount > 0) {
    const buffer = writeStorageBuffer(
      device,
      'ulg-sph-thermal-material-bank-warm-input-rows',
      packedRows
    );
    return {
      buffer,
      rowCount: packedRowCount,
      bufferSource: 'sph-particle-state',
      borrowed: false,
      destroy() {
        buffer.destroy?.();
      }
    };
  }
  const emptyBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-material-bank-warm-input-rows-empty',
    new Float32Array(MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length)
  );
  return {
    buffer: emptyBuffer,
    rowCount: 0,
    bufferSource: 'empty',
    borrowed: false,
    destroy() {
      emptyBuffer.destroy?.();
    }
  };
}

function createOutputStorageBuffer(device, label, byteLength, extraUsage = 0) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | extraUsage
  }), device);
}

function resolveThermalResponseGraphArtifacts({
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  if (thermalMaterialTable?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('Expected a packed SPH thermal material table');
  }
  const resolvedGraphSet = thermalClosureGraphSet || buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const resolvedGraphBank = thermalClosureGraphBank || resolvedGraphSet.graphBank || buildSphThermalClosureGraphBank(resolvedGraphSet);
  const resolvedPhaseResponseTable = thermalPhaseResponseTable || buildSphThermalPhaseResponseTable(thermalMaterialTable, resolvedGraphSet);
  if (resolvedGraphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('Expected an SPH thermal closure graph set');
  }
  if (resolvedGraphBank?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA) {
    throw new TypeError('Expected an SPH thermal closure graph bank');
  }
  assertPackedSphThermalPhaseResponseTable(resolvedPhaseResponseTable);
  return {
    thermalClosureGraphSet: resolvedGraphSet,
    thermalClosureGraphBank: resolvedGraphBank,
    thermalPhaseResponseTable: resolvedPhaseResponseTable
  };
}

function assertOptionalThermalResponseGraphUpload(upload) {
  if (upload && upload.schema !== ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA) {
    throw new TypeError('Expected an SPH thermal response/graph WebGPU buffer set');
  }
}

function thermalResponseGraphContentFingerprint({
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  if (!thermalClosureGraphBank || !thermalPhaseResponseTable) return null;
  return [
    typedArrayContentFingerprint(thermalPhaseResponseTable.records),
    typedArrayContentFingerprint(thermalPhaseResponseTable.responses),
    typedArrayContentFingerprint(
      thermalPhaseResponseTable.responseThermalConductivities
    ),
    typedArrayContentFingerprint(thermalClosureGraphBank.nodeRows),
    typedArrayContentFingerprint(thermalClosureGraphBank.sampleRows)
  ].join('|');
}

export function thermalResponseGraphUploadMatchesDevice(upload, device, {
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  if (
    upload?.status !== 'webgpu-uploaded'
    || upload.destroyed === true
    || !device
  ) return false;
  const buffersMatch = [
    upload.responseRecordBuffer,
    upload.responseBuffer,
    upload.responseThermalConductivityBuffer,
    upload.graphNodeBuffer,
    upload.graphSampleBuffer
  ].every((buffer) => buffer && webGpuBufferDevice(buffer) === device);
  const expectedContentFingerprint = thermalResponseGraphContentFingerprint({
    thermalClosureGraphBank,
    thermalPhaseResponseTable
  });
  return Boolean(buffersMatch && (
    !expectedContentFingerprint
    || upload.contentFingerprint === expectedContentFingerprint
  ));
}

export function uploadSphThermalResponseGraphBuffers(device, {
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadSphThermalResponseGraphBuffers requires a WebGPU-like device with queue.writeBuffer');
  }
  const resolved = resolveThermalResponseGraphArtifacts({
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalClosureGraphBank,
    thermalPhaseResponseTable
  });
  const responseRecordBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-phase-response-records',
    resolved.thermalPhaseResponseTable.records
  );
  const responseBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-phase-responses',
    resolved.thermalPhaseResponseTable.responses
  );
  const responseThermalConductivityBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-phase-response-conductivities',
    resolved.thermalPhaseResponseTable.responseThermalConductivities
  );
  const graphNodeBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-graph-nodes',
    resolved.thermalClosureGraphBank.nodeRows
  );
  const graphSampleBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-graph-samples',
    resolved.thermalClosureGraphBank.sampleRows
  );
  return {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceMaterialTableSchema: thermalMaterialTable.schema,
    contentFingerprint: thermalResponseGraphContentFingerprint({
      thermalClosureGraphBank: resolved.thermalClosureGraphBank,
      thermalPhaseResponseTable: resolved.thermalPhaseResponseTable
    }),
    thermalClosureGraphSetSchema: resolved.thermalClosureGraphSet.schema,
    thermalClosureGraphBankSchema: resolved.thermalClosureGraphBank.schema,
    thermalPhaseResponseTableSchema: resolved.thermalPhaseResponseTable.schema,
    materialCount: resolved.thermalPhaseResponseTable.materialCount,
    responseCount: resolved.thermalPhaseResponseTable.responseCount,
    graphCount: resolved.thermalClosureGraphBank.graphCount,
    nodeCount: resolved.thermalClosureGraphBank.nodeCount,
    sampleCount: resolved.thermalClosureGraphBank.sampleCount,
    responseRecordBuffer,
    responseBuffer,
    responseThermalConductivityBuffer,
    graphNodeBuffer,
    graphSampleBuffer,
    responseRecordBufferByteLength: resolved.thermalPhaseResponseTable.records.byteLength,
    responseBufferByteLength: resolved.thermalPhaseResponseTable.responses.byteLength,
    responseThermalConductivityBufferByteLength:
      resolved.thermalPhaseResponseTable.responseThermalConductivities.byteLength,
    graphNodeBufferByteLength: resolved.thermalClosureGraphBank.nodeRows.byteLength,
    graphSampleBufferByteLength: resolved.thermalClosureGraphBank.sampleRows.byteLength,
    ownsResponseRecordBuffer: true,
    ownsResponseBuffer: true,
    ownsResponseThermalConductivityBuffer: true,
    ownsGraphNodeBuffer: true,
    ownsGraphSampleBuffer: true,
    thermalClosureGraphSet: resolved.thermalClosureGraphSet,
    thermalClosureGraphBank: resolved.thermalClosureGraphBank,
    thermalPhaseResponseTable: resolved.thermalPhaseResponseTable,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function destroySphThermalResponseGraphBuffers(buffers) {
  if (!buffers || buffers.destroyed === true) return;
  if (buffers.ownsResponseRecordBuffer !== false) buffers.responseRecordBuffer?.destroy?.();
  if (buffers.ownsResponseBuffer !== false) buffers.responseBuffer?.destroy?.();
  if (buffers.ownsResponseThermalConductivityBuffer !== false) {
    buffers.responseThermalConductivityBuffer?.destroy?.();
  }
  if (buffers.ownsGraphNodeBuffer !== false) buffers.graphNodeBuffer?.destroy?.();
  if (buffers.ownsGraphSampleBuffer !== false) buffers.graphSampleBuffer?.destroy?.();
  buffers.destroyed = true;
}

// Widest conduction pair support in the scene: max over particles of the
// nominal contact radius r = (3m/(4*pi*rho_min))^(1/3), where rho_min is the
// particle material's lowest phase density (its gas phase — the largest the
// particle can physically become). Bounds the GPU neighbor-bin scan radius;
// the per-pair support itself is computed in-kernel from each pair's rest
// densities. CPU copies may be stale under GPU-resident continuation — a
// stale mass bound only widens/narrows the scan, never breaks pair symmetry.
// Memoised per state buffer, and monotone non-decreasing.
//
// Two problems with rescanning every time. It is an O(N) CPU walk performed
// while constructing each GPU stage, which serialises graph construction on the
// host; and the CPU mirrors it reads can be stale under GPU-resident
// continuation, in which case a low bound *narrows* the neighbour scan and
// silently drops radiation pairs. Widening is harmless -- more cells inspected
// -- so the cached value is only ever raised, never lowered. A stale mirror can
// then cost a little extra scan work but can no longer lose a pair.
//
// Keyed on the state typed array identity: a genuinely new particle buffer gets
// a fresh scan, while the repeated calls within one step share one.
const thermalMaxPairSupportCache = new WeakMap();

export function resolveThermalMaxPairSupportM(sphParticleState, phaseResponseTable) {
  const state = sphParticleState?.state;
  const thermo = sphParticleState?.thermo;
  const responses = phaseResponseTable?.responses;
  const count = Math.max(0, Math.round(Number(sphParticleState?.particleCount) || 0));
  if (!state?.length || !thermo?.length || !responses?.length || count === 0) return 0;
  const memo = thermalMaxPairSupportCache.get(state);
  if (memo && memo.count === count) return memo.supportM;
  const minDensityByMaterial = new Map();
  for (let offset = 0; offset + 9 < responses.length; offset += SPH_THERMAL_PHASE_RESPONSE_FLOATS) {
    const materialId = Math.round(responses[offset]);
    const densities = [responses[offset + 8], responses[offset + 9]]
      .filter((density) => Number.isFinite(density) && density > 0);
    if (!densities.length) continue;
    const localMin = Math.min(...densities);
    const previous = minDensityByMaterial.get(materialId);
    minDensityByMaterial.set(materialId, previous > 0 ? Math.min(previous, localMin) : localMin);
  }
  let maxRadiusM = 0;
  for (let p = 0; p < count; p += 1) {
    const mass = state[p * SPH_GPU_PARTICLE_STATE_FLOATS + 3];
    if (!(mass > 0)) continue;
    const materialId = Math.round(thermo[p * SPH_GPU_PARTICLE_THERMO_FLOATS]);
    const density = minDensityByMaterial.get(materialId);
    if (!(density > 0)) continue;
    const radius = Math.cbrt((3 * mass) / (4 * Math.PI * density));
    if (radius > maxRadiusM) maxRadiusM = radius;
  }
  // Radiation pairs interact out to RADIATION_PAIR_RANGE_RADII * (r_i + r_j);
  // the neighbor structure must reach that far, not just contact range.
  const supportM = maxRadiusM > 0
    ? SPH_THERMAL_RADIATION_PAIR_RANGE_RADII * 2 * maxRadiusM
    : 0;
  const cached = thermalMaxPairSupportCache.get(state);
  const monotoneM = cached?.supportM > supportM ? cached.supportM : supportM;
  thermalMaxPairSupportCache.set(state, { supportM: monotoneM, count });
  return monotoneM;
}

const THERMAL_PARAMS_BYTES = 144;
const CANONICAL_THERMAL_EPOCH_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

function exactThermalU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw new RangeError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`);
  }
  return value;
}

function rejectCanonicalThermalProposal(reason) {
  const error = new Error(reason);
  error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_APPLY_REJECTED';
  throw error;
}

function resolveCanonicalThermalProposal({
  device,
  sphParticleState,
  schroederSpatialEpochGeneration,
  schroederSpatialThermalProposal,
  proposalStateBuffer,
  proposalThermoBuffer
}) {
  const generationProvided = schroederSpatialEpochGeneration != null;
  const proposalProvided = schroederSpatialThermalProposal != null;
  if (!generationProvided && !proposalProvided) return null;
  if (!generationProvided || !proposalProvided) {
    rejectCanonicalThermalProposal(
      'Canonical thermal apply requires both the retained spatial generation and its proposal'
    );
  }
  const generation = schroederSpatialEpochGeneration;
  const proposal = schroederSpatialThermalProposal;
  const execution = generation?.execution;
  const particleCount = exactThermalU32(
    sphParticleState?.particleCount,
    'sphParticleState.particleCount',
    { positive: true }
  );
  if (
    proposal?.schema !== ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_SCHEMA
    || proposal.status !== 'schroeder-spatial-thermal-proposal-prepared'
    || proposal.ready !== true
    || proposal.released === true
    || proposal.generation !== generation
  ) {
    rejectCanonicalThermalProposal(
      'Thermal proposal is not the live proposal issued for the retained generation'
    );
  }
  if (
    proposal.proposalBufferSchema !== ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA
    || proposal.proposalHeaderWords !== SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
    || proposal.proposalRowWords !== SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
    || proposal.canonicalApplyMode?.replacesLegacyNeighborBinding !== 10
    || proposal.canonicalApplyMode?.paramsSentinelOffsetBytes
      !== SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES
    || proposal.canonicalApplyMode?.paramsSentinelValue
      !== SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL
    || proposal.canonicalApplyMode?.publishedRowCountHeaderWord !== 15
    || proposal.canonicalApplyMode?.completeSetPolicy
      !== 'both-invalid-counts-zero-and-published-row-count-equals-particle-count-or-apply-no-pair-rows'
    || proposal.canonicalApplyMode?.specificEnergyDeltaPolicy
      !== 'reciprocal-directional-energy-budget-with-live-response-and-neighbor-inverse-bounds-before-wall-and-ambient-laws'
    || proposal.thermalConductionProposalBuffer !== proposal.proposalBuffer
    || proposal.thermalRadiationProposalBuffer !== proposal.proposalBuffer
    || proposal.traversalCount !== 2
    || proposal.traversalCountPerConsumer !== 2
    || proposal.sharedTraversalConsumerCount !== 2
    || proposal.privateBuildCount !== 0
    || proposal.fixedCandidateBuildCount !== 0
    || proposal.exhaustiveTraversalCount !== 0
    || proposal.fullParticleReadbackPerformed !== false
  ) {
    rejectCanonicalThermalProposal('Thermal proposal does not carry the canonical apply ABI');
  }
  const sourceAuthority = proposal.thermalProposalSourceAuthority;
  if (!isLiveThermalProposalSourceAuthority(sourceAuthority, {
    device,
    generation,
    stateBuffer: sourceAuthority?.stateBuffer,
    thermoBuffer: sourceAuthority?.thermoBuffer,
    particleCount
  })) {
    rejectCanonicalThermalProposal(
      'Canonical thermal apply does not carry the exact immutable x_n proposal source family'
    );
  }
  for (const field of CANONICAL_THERMAL_EPOCH_FIELDS) {
    if (!Object.is(sourceAuthority.epochIdentity?.[field], execution?.[field])) {
      rejectCanonicalThermalProposal(
        `Canonical thermal proposal source authority has stale ${field} identity`
      );
    }
  }
  if (
    proposal.particleCount !== particleCount
    || generation?.source?.sourceCount !== particleCount
    || execution?.sourceCount !== particleCount
    || proposal.generationId !== execution?.generationId
    || proposal.supportEpoch !== execution?.supportEpoch
  ) {
    rejectCanonicalThermalProposal(
      'Thermal proposal particle count or generation identity does not match the thermal step'
    );
  }
  const activeProposalByteLength = (
    SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
    + particleCount * SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
  ) * Uint32Array.BYTES_PER_ELEMENT;
  const proposalBuffer = proposal.proposalBuffer;
  if (
    !proposalBuffer
    || webGpuBufferDevice(proposalBuffer) !== device
    || !Number.isFinite(Number(proposalBuffer.size))
    || Number(proposalBuffer.size) < activeProposalByteLength
    || Number(proposal.activeProposalByteLength) !== activeProposalByteLength
  ) {
    rejectCanonicalThermalProposal(
      'Canonical thermal proposal buffer is not a complete same-device particle row set'
    );
  }
  const consumerContracts = [
    [
      SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION,
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
    ],
    [
      SCHROEDER_SPATIAL_THERMAL_CONSUMER.RADIATION,
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
    ]
  ];
  const consumerReceipts = {};
  const consumerAuthentications = {};
  for (const [consumerId, supportProfileId] of consumerContracts) {
    const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
      generation,
      {
        device,
        runtime: generation.runtime,
        consumerId,
        supportProfileId,
        sourceBuffer: generation.source?.sourceBuffer
          ?? generation.source?.activeNodeBuffer,
        expected: {
          generationId: proposal.generationId,
          sourceCount: particleCount,
          supportEpoch: proposal.supportEpoch,
          positionEpoch: execution.positionEpoch,
          topologyEpoch: execution.topologyEpoch
        }
      }
    );
    const receipt = proposal.consumerReceipt?.(consumerId)
      ?? proposal.consumerReceipts?.[consumerId]
      ?? null;
    if (
      authentication?.authenticated !== true
      || authentication.ready !== true
      || !isSchroederSpatialExactNearResidentConsumerBinding(receipt)
      || receipt.consumerId !== consumerId
      || receipt.supportProfileId !== supportProfileId
      || receipt.deviceId !== webGpuDeviceId(device)
      || receipt.generationId !== execution.generationId
      || receipt.bindingAuthenticated !== true
      || receipt.resultAuthenticated !== false
      || receipt.submissionAuthenticated !== false
      || receipt.countersObserved !== false
      || receipt.residentEvidence?.controlBuffer !== proposalBuffer
    ) {
      rejectCanonicalThermalProposal(
        `Canonical thermal consumer ${consumerId} is not authenticated for this generation`
      );
    }
    for (const field of CANONICAL_THERMAL_EPOCH_FIELDS) {
      if (!Object.is(receipt.epochIdentity?.[field], execution[field])) {
        rejectCanonicalThermalProposal(
          `Canonical thermal consumer ${consumerId} has stale ${field} identity`
        );
      }
    }
    consumerReceipts[consumerId] = receipt;
    consumerAuthentications[consumerId] = authentication;
  }
  const queueOrderedCanonicalApplyRetirementAuthorized =
    proposal.hasQueueOrderedCanonicalApplyRetirementAuthority?.({
      generation,
      execution
    }) === true;
  return Object.freeze({
    proposalMode: 'schroeder-spatial-exact-near-v2',
    proposal,
    proposalBuffer,
    generation,
    execution,
    particleCount,
    activeProposalByteLength,
    sourceAuthority,
    currentStateBuffer: proposalStateBuffer,
    currentThermoBuffer: proposalThermoBuffer,
    queueOrderedCanonicalApplyRetirementAuthorized,
    consumerReceipts: Object.freeze(consumerReceipts),
    consumerAuthentications: Object.freeze(consumerAuthentications)
  });
}

function createParamsArray({
  particleCount,
  materialCount,
  segmentCount,
  dtS,
  smoothingLengthM,
  conductionRate,
  wallRate,
  wallLayerM,
  boxDimsM,
  wallTemperaturesK,
  materialBankWarmInputRowCount = 0,
  neighborBins = null,
  maxPairSupportM = 0,
  ambientTemperatureK,
  ambientRadiationExchangeEnabled,
  canonicalThermalProposal = null
}) {
  const buffer = new ArrayBuffer(THERMAL_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, materialCount, true);
  view.setUint32(8, segmentCount, true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(materialBankWarmInputRowCount, 0))), true);
  view.setFloat32(16, dtS, true);
  view.setFloat32(20, smoothingLengthM, true);
  view.setFloat32(24, conductionRate, true);
  view.setFloat32(28, wallRate, true);
  view.setFloat32(32, wallLayerM, true);
  view.setFloat32(36, boxDimsM[0], true);
  view.setFloat32(40, boxDimsM[1], true);
  view.setFloat32(44, boxDimsM[2], true);
  view.setFloat32(48, wallTemp(wallTemperaturesK, 'xMin'), true);
  view.setFloat32(52, wallTemp(wallTemperaturesK, 'xMax'), true);
  view.setFloat32(56, wallTemp(wallTemperaturesK, 'yMin'), true);
  view.setFloat32(60, wallTemp(wallTemperaturesK, 'yMax'), true);
  view.setFloat32(64, wallTemp(wallTemperaturesK, 'zMin'), true);
  view.setFloat32(68, wallTemp(wallTemperaturesK, 'zMax'), true);
  const binsEnabled = canonicalThermalProposal == null && Boolean(
    neighborBins?.binsBuffer
    && Number(neighborBins?.capacity) > 0
    && Number(neighborBins?.nx) > 0
    && Number(neighborBins?.ny) > 0
    && Number(neighborBins?.nz) > 0
    && Number(neighborBins?.cellSizeM) > 0
  );
  view.setUint32(72, binsEnabled ? 1 : 0, true);
  view.setUint32(76, binsEnabled ? Math.round(neighborBins.capacity) : 0, true);
  view.setUint32(80, binsEnabled ? Math.round(neighborBins.nx) : 0, true);
  view.setUint32(84, binsEnabled ? Math.round(neighborBins.ny) : 0, true);
  view.setUint32(88, binsEnabled ? Math.round(neighborBins.nz) : 0, true);
  view.setFloat32(92, binsEnabled ? Number(neighborBins.cellSizeM) : 0, true);
  view.setFloat32(96, Math.max(0, finiteNumber(maxPairSupportM, 0)), true);
  view.setFloat32(100, ambientTemperatureK, true);
  view.setUint32(136, ambientRadiationExchangeEnabled ? 1 : 0, true);
  if (canonicalThermalProposal) {
    const execution = canonicalThermalProposal.execution;
    view.setUint32(
      SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES,
      SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL,
      true
    );
    view.setUint32(108, exactThermalU32(execution.generationId, 'generationId', {
      positive: true
    }), true);
    view.setUint32(112, exactThermalU32(execution.supportEpoch, 'supportEpoch'), true);
    view.setUint32(116, exactThermalU32(execution.positionEpoch, 'positionEpoch'), true);
    view.setUint32(120, exactThermalU32(execution.topologyEpoch, 'topologyEpoch'), true);
    view.setUint32(124, exactThermalU32(
      execution.storageGeneration,
      'storageGeneration',
      { positive: true }
    ), true);
    view.setUint32(128, exactThermalU32(execution.physicsTick, 'physicsTick'), true);
    view.setUint32(132, exactThermalU32(execution.physicsSubstep, 'physicsSubstep'), true);
  }
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength) {
  const readback = device.createBuffer({
    label: 'ulg-sph-thermal-readback',
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  let mapped = false;
  try {
    encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPU_MAP_MODE.READ);
    mapped = true;
    return readback.getMappedRange().slice(0);
  } finally {
    if (mapped) {
      try { readback.unmap(); } catch {}
    }
    readback.destroy?.();
  }
}

export function createSphThermalStepWebGpuEncoderStage({
  device,
  sphParticleState,
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null,
  thermalResponseGraphUpload = null,
  sphParticleUpload = null,
  proposalStateBuffer = null,
  proposalThermoBuffer = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  wallTemperaturesK,
  wallReservoirAuthority = null,
  wallModel,
  boxDimsM = [5, 5, 5],
  dtS = 0,
  smoothingLengthM = sphParticleState?.smoothingLengthM,
  conductionRate = SPH_THERMAL_PAIR_CONDUCTION_RATE_DEFAULT,
  ambientTemperatureK,
  thermalEnvironmentAuthority = null,
  wallRate = 6e4,
  wallLayerM = sphParticleState?.smoothingLengthM,
  retainOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE,
  schroederSpatialEpochGeneration = null,
  schroederSpatialThermalProposal = null,
  gpuTimestampRecorder = null,
  // Shared per-substep neighbor bins refilled after in-place separation.
  // Classic execution uses them only to enumerate the common v2 pair law;
  // overflow or unsupported support radii fall back inside the proposal pass.
  neighborBins = null
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  assertOptionalThermalResponseGraphUpload(thermalResponseGraphUpload);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphThermalStepWebGpu requires a WebGPU-like device');
  }
  const resolvedThermalEnvironmentAuthority =
    resolveSphThermalEnvironmentAuthority({
      ambientTemperatureK,
      thermalEnvironmentAuthority
    });
  const resolvedAmbientTemperatureK =
    resolvedThermalEnvironmentAuthority.ambientTemperatureK;
  const resolvedWallReservoirAuthority =
    resolveSphWallReservoirAuthority({
      wallTemperaturesK,
      wallReservoirAuthority,
      wallModel
    });
  const resolvedWallTemperaturesK =
    resolvedWallReservoirAuthority.faces;
  const requestedWallRate = wallRate;
  const effectiveWallRate = resolvedWallReservoirAuthority.exchangeEnabled
    ? wallRate
    : 0;
  const ambientRadiationExchangeEnabled =
    resolvedWallReservoirAuthority.exchangeEnabled === true;
  const canonicalGenerationProvided = schroederSpatialEpochGeneration != null;
  const canonicalProposalProvided = schroederSpatialThermalProposal != null;
  if (canonicalGenerationProvided !== canonicalProposalProvided) {
    rejectCanonicalThermalProposal(
      'Canonical thermal apply requires both the retained spatial generation and its proposal'
    );
  }
  const canonicalThermalRequested = canonicalGenerationProvided
    && canonicalProposalProvided;
  let spatialCanonicalThermalProposal = null;
  const dims = finiteVector3(boxDimsM, [5, 5, 5]);
  const layer = finiteNumber(wallLayerM, sphParticleState.smoothingLengthM);
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const borrowedThermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  if (
    canonicalThermalRequested
    && (
      (borrowedStateBuffer && webGpuBufferDevice(borrowedStateBuffer) !== device)
      || (borrowedThermoBuffer && webGpuBufferDevice(borrowedThermoBuffer) !== device)
    )
  ) {
    rejectCanonicalThermalProposal(
      'Canonical thermal apply source state and thermo buffers must belong to the generation device'
    );
  }
  const setupFailureCleanups = [];
  const registerSetupFailureCleanup = (cleanup) => {
    if (typeof cleanup === 'function') setupFailureCleanups.push(cleanup);
  };
  try {
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-sph-thermal-source-state', sphParticleState.state);
  if (!borrowedStateBuffer) {
    registerSetupFailureCleanup(() => stateBuffer.destroy?.());
  }
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-sph-thermal-source-thermo', sphParticleState.thermo);
  if (!borrowedThermoBuffer) {
    registerSetupFailureCleanup(() => thermoBuffer.destroy?.());
  }
  if (canonicalThermalRequested && (
    webGpuBufferDevice(stateBuffer) !== device
    || webGpuBufferDevice(thermoBuffer) !== device
  )) {
    rejectCanonicalThermalProposal(
      'Canonical thermal apply source state and thermo buffers must belong to the generation device'
    );
  }
  const thermalProposalStateBuffer = proposalStateBuffer || stateBuffer;
  const thermalProposalThermoBuffer = proposalThermoBuffer || thermoBuffer;
  if (
    !webGpuBufferMatchesDevice(thermalProposalStateBuffer, device)
    || !webGpuBufferMatchesDevice(thermalProposalThermoBuffer, device)
  ) {
    throw new TypeError(
      'Thermal proposal source state and thermo buffers must belong to the thermal device'
    );
  }
  if (canonicalThermalRequested && (
    thermalProposalStateBuffer !== stateBuffer
    || thermalProposalThermoBuffer !== thermoBuffer
  )) {
    rejectCanonicalThermalProposal(
      'Canonical thermal producer and apply must bind the exact same current state and thermo buffers'
    );
  }
  spatialCanonicalThermalProposal = resolveCanonicalThermalProposal({
    device,
    sphParticleState,
    schroederSpatialEpochGeneration,
    schroederSpatialThermalProposal,
    proposalStateBuffer: thermalProposalStateBuffer,
    proposalThermoBuffer: thermalProposalThermoBuffer
  });
  const resolvedGraphSet = thermalClosureGraphSet || buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const resolvedGraphBank = thermalClosureGraphBank || resolvedGraphSet.graphBank || buildSphThermalClosureGraphBank(resolvedGraphSet);
  const resolvedPhaseResponseTable = thermalPhaseResponseTable || buildSphThermalPhaseResponseTable(thermalMaterialTable, resolvedGraphSet);
  const borrowedResponseGraphUpload = thermalResponseGraphUploadMatchesDevice(
    thermalResponseGraphUpload,
    device,
    {
      thermalClosureGraphBank: resolvedGraphBank,
      thermalPhaseResponseTable: resolvedPhaseResponseTable
    }
  )
    ? { ...thermalResponseGraphUpload, borrowed: true }
    : null;
  const localResponseGraphUpload = borrowedResponseGraphUpload
    ? null
    : uploadSphThermalResponseGraphBuffers(device, {
      thermalMaterialTable,
      thermalClosureGraphSet: resolvedGraphSet,
      thermalClosureGraphBank: resolvedGraphBank,
      thermalPhaseResponseTable: resolvedPhaseResponseTable
    });
  if (localResponseGraphUpload) {
    registerSetupFailureCleanup(() => {
      destroySphThermalResponseGraphBuffers(localResponseGraphUpload);
    });
  }
  const responseGraphUpload = borrowedResponseGraphUpload || localResponseGraphUpload;
  const responseRecordBuffer = responseGraphUpload.responseRecordBuffer;
  const responseBuffer = responseGraphUpload.responseBuffer;
  const graphNodeBuffer = responseGraphUpload.graphNodeBuffer;
  const graphSampleBuffer = responseGraphUpload.graphSampleBuffer;
  const classicThermalProposalStage = spatialCanonicalThermalProposal
    ? null
    : createClassicThermalProposalWebGpuEncoderStage({
      device,
      sphParticleState,
      stateBuffer: thermalProposalStateBuffer,
      thermoBuffer: thermalProposalThermoBuffer,
      thermalResponseGraphUpload: responseGraphUpload,
      neighborBins,
      dtS: finiteNumber(dtS, 0),
      smoothingLengthM: finiteNumber(smoothingLengthM, 0),
      conductionRate
    });
  if (classicThermalProposalStage) {
    registerSetupFailureCleanup(() => {
      classicThermalProposalStage.cleanupSubmittedWork();
    });
  }
  const matchedTimeThermalProposalStage = spatialCanonicalThermalProposal
    ? createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
        device,
        schroederSpatialThermalProposal,
        currentStateBuffer: thermalProposalStateBuffer,
        currentThermoBuffer: thermalProposalThermoBuffer,
        thermalResponseGraphUpload: responseGraphUpload,
        dtS,
        smoothingLengthM,
        conductionRate,
        gpuTimestampRecorder
      })
    : null;
  if (matchedTimeThermalProposalStage) {
    registerSetupFailureCleanup(() => {
      schroederSpatialThermalProposal?.abandonPreparedWork?.(
        'thermal-encoder-stage-setup-failed-after-matched-time-binding'
      );
    });
  }
  const canonicalThermalProposal = spatialCanonicalThermalProposal
    ? Object.freeze({
        ...spatialCanonicalThermalProposal,
        producerStage: matchedTimeThermalProposalStage,
        producerApplySubmissionPolicy:
          'single-command-buffer-producer-before-apply',
        matchedTimeStateBuffer: thermalProposalStateBuffer,
        matchedTimeThermoBuffer: thermalProposalThermoBuffer
      })
    : Object.freeze({
      proposalMode: 'classic-lookup-neutral-v2',
      proposal: classicThermalProposalStage,
      proposalBuffer: classicThermalProposalStage.proposalBuffer,
      execution: classicThermalProposalStage.execution,
      particleCount: sphParticleState.particleCount,
      activeProposalByteLength:
        classicThermalProposalStage.activeProposalByteLength,
      consumerReceipts: null,
      consumerAuthentications: null
    });
  const materialBankWarmInputBinding = resolveMaterialBankWarmInputShaderBinding(device, {
    sphParticleState,
    sphParticleUpload
  });
  if (!materialBankWarmInputBinding.borrowed) {
    registerSetupFailureCleanup(() => materialBankWarmInputBinding.destroy());
  }
  const outputBufferInitializationMode = 'shader-writes-all-particle-rows';
  // Never size GPU outputs from the CPU arrays alone: under GPU-resident
  // continuation the CPU copies can be stale or detached (byteLength 0).
  const outStateByteLength = Math.max(
    sphParticleState.state.byteLength,
    sphParticleState.particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const outThermoByteLength = Math.max(
    sphParticleState.thermo.byteLength,
    sphParticleState.particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const outStateBuffer = createOutputStorageBuffer(
    device,
    'ulg-sph-thermal-output-state',
    outStateByteLength,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  registerSetupFailureCleanup(() => outStateBuffer.destroy?.());
  const outThermoBuffer = createOutputStorageBuffer(
    device,
    'ulg-sph-thermal-output-thermo',
    outThermoByteLength,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  registerSetupFailureCleanup(() => outThermoBuffer.destroy?.());
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-thermal-params',
    size: THERMAL_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  registerSetupFailureCleanup(() => paramsBuffer.destroy?.());
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    materialCount: resolvedPhaseResponseTable.materialCount,
    segmentCount: resolvedPhaseResponseTable.responseCount,
    dtS: finiteNumber(dtS, 0),
    smoothingLengthM: finiteNumber(smoothingLengthM, 0),
    conductionRate,
    wallRate: effectiveWallRate,
    wallLayerM: layer,
    boxDimsM: dims,
    wallTemperaturesK: resolvedWallTemperaturesK,
    materialBankWarmInputRowCount: materialBankWarmInputBinding.rowCount,
    neighborBins,
    maxPairSupportM: resolveThermalMaxPairSupportM(sphParticleState, resolvedPhaseResponseTable),
    ambientTemperatureK: resolvedAmbientTemperatureK,
    ambientRadiationExchangeEnabled,
    canonicalThermalProposal
  }));
  const spatialInputBuffer = canonicalThermalProposal.proposalBuffer;
  const spatialInputBound = Boolean(spatialInputBuffer);
  // Binding 10 must always be present in the layout; a tiny placeholder
  // satisfies it when the exhaustive fallback runs (bins_enabled=0).
  const binPlaceholderBuffer = spatialInputBound
    ? null
    : device.createBuffer({
      label: 'ulg-sph-thermal-bin-placeholder',
      size: 4,
      usage: GPU_BUFFER_USAGE.STORAGE
    });
  if (binPlaceholderBuffer) {
    registerSetupFailureCleanup(() => binPlaceholderBuffer.destroy?.());
  }

  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-thermal-step.v6',
    label: 'ulg-sph-thermal-step',
    code: sphThermalStepWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'storage'),
      computeBufferBinding(8, 'uniform'),
      computeBufferBinding(9, 'read-only-storage'),
      computeBufferBinding(10, 'read-only-storage')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: responseRecordBuffer } },
      { binding: 3, resource: { buffer: responseBuffer } },
      { binding: 4, resource: { buffer: graphNodeBuffer } },
      { binding: 5, resource: { buffer: graphSampleBuffer } },
      { binding: 6, resource: { buffer: outStateBuffer } },
      { binding: 7, resource: { buffer: outThermoBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } },
      { binding: 9, resource: { buffer: materialBankWarmInputBinding.buffer } },
      { binding: 10, resource: { buffer: spatialInputBound ? spatialInputBuffer : binPlaceholderBuffer } }
    ]
  });
  const state = new Float32Array();
  const thermo = new Float32Array();
  let commonResourcesCleaned = false;
  let outputParticleBuffersDestroyed = false;
  let outputParticleBufferDestroyScheduled = false;
  let thermalPrimarySubmissionObserved = false;
  let result = null;
  let outputParticleBufferCleanupClaim = null;
  const cleanupCommonResources = () => {
    if (commonResourcesCleaned) return false;
    commonResourcesCleaned = true;
    classicThermalProposalStage?.cleanupSubmittedWork();
    if (matchedTimeThermalProposalStage) {
      if (matchedTimeThermalProposalStage.submissionObserved) {
        schroederSpatialThermalProposal
          ?.releaseAfterCanonicalApplySubmittedWork?.();
      } else {
        schroederSpatialThermalProposal?.abandonPreparedWork?.(
          'thermal-encoder-stage-cleaned-without-observed-submission'
        );
      }
    }
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (localResponseGraphUpload) destroySphThermalResponseGraphBuffers(localResponseGraphUpload);
    if (!materialBankWarmInputBinding.borrowed) materialBankWarmInputBinding.destroy();
    paramsBuffer.destroy?.();
    binPlaceholderBuffer?.destroy?.();
    return true;
  };
  const destroyOutputParticleBuffersNow = () => {
    if (outputParticleBuffersDestroyed) return false;
    outputParticleBufferDestroyScheduled = false;
    outputParticleBuffersDestroyed = true;
    outStateBuffer.destroy?.();
    outThermoBuffer.destroy?.();
    return true;
  };
  const registerRetainedOutputCleanupClaim = () => {
    if (
      outputParticleBufferCleanupClaim != null
      || !retainOutputParticleBuffers
      || thermalPrimarySubmissionObserved !== true
      || !result
      || spatialCanonicalThermalProposal
        ?.queueOrderedCanonicalApplyRetirementAuthorized !== true
    ) {
      return outputParticleBufferCleanupClaim;
    }
    const sourceAuthority =
      spatialCanonicalThermalProposal.sourceAuthority;
    const exactProposal =
      spatialCanonicalThermalProposal.proposal;
    if (
      sourceAuthority !== exactProposal?.thermalProposalSourceAuthority
      || spatialCanonicalThermalProposal.currentStateBuffer !== stateBuffer
      || spatialCanonicalThermalProposal.currentThermoBuffer !== thermoBuffer
    ) {
      return null;
    }
    if (!isLiveThermalProposalSourceAuthority(sourceAuthority, {
      device,
      generation: spatialCanonicalThermalProposal.generation,
      stateBuffer:
        exactProposal.thermalProposalSourceAuthority.stateBuffer,
      thermoBuffer:
        exactProposal.thermalProposalSourceAuthority.thermoBuffer,
      particleCount: sphParticleState.particleCount
    })) {
      return null;
    }
    outputParticleBufferCleanupClaim = registerQueueOrderedCleanupClaim(
      thermalOutputCleanupClaimIssuer,
      device,
      {
        producerOutput: result,
        cleanup: destroyOutputParticleBuffersNow
      }
    );
    Object.defineProperty(result, 'queueOrderedCleanupClaim', {
      value: outputParticleBufferCleanupClaim,
      enumerable: false,
      configurable: false,
      writable: false
    });
    return outputParticleBufferCleanupClaim;
  };
  const cleanupSubmittedWork = () => {
    const cleaned = cleanupCommonResources();
    if (!retainOutputParticleBuffers) destroyOutputParticleBuffersNow();
    return cleaned;
  };
  const cleanupAbortedWork = () => {
    if (outputParticleBufferCleanupClaim != null) {
      try {
        cancelQueueOrderedCleanupClaim(
          outputParticleBufferCleanupClaim,
          device,
          {
            producerOutput: result,
            cleanup: destroyOutputParticleBuffersNow
          }
        );
      } catch {
        // A sealed final-consumer claim cannot be cancelled here.
      }
    }
    const cleaned = cleanupCommonResources();
    destroyOutputParticleBuffersNow();
    return cleaned;
  };
  const destroyRetainedOutputParticleBuffers = retainOutputParticleBuffers
    ? ({
        queueOrderedFinalConsumer = null
      } = {}) => {
      if (
        outputParticleBuffersDestroyed
        || outputParticleBufferDestroyScheduled
      ) return false;
      if (queueOrderedFinalConsumer != null) {
        const receipt = releaseSubmittedWorkCleanupQueueOrdered(
          device,
          destroyOutputParticleBuffersNow,
          {
            queueOrderedFinalConsumer,
            producerClaim: outputParticleBufferCleanupClaim,
            producerOutput: result,
            producerFamily: 'thermal-output'
          }
        );
        if (result) {
          result.outputParticleBufferCleanupReceipt = receipt;
          result.outputParticleBufferCleanupStatus = receipt.status;
          result.outputParticleBufferQueueCompletionMethod =
            receipt.queueCompletionMethod;
        }
        return true;
      }
      if (outputParticleBufferCleanupClaim != null) {
        try {
          cancelQueueOrderedCleanupClaim(
            outputParticleBufferCleanupClaim,
            device,
            {
              producerOutput: result,
              cleanup: destroyOutputParticleBuffersNow
            }
          );
        } catch {
          // A sealed claim remains owned by its exact final consumer.
        }
      }
      outputParticleBufferDestroyScheduled = true;
      const deferredHostQueueFenceScheduled =
        deferSubmittedWorkCleanup(device, destroyOutputParticleBuffersNow);
      if (result) {
        if (deferredHostQueueFenceScheduled) {
          appendGpuReadbackTelemetryObservation(result, {
            hostQueueFenceCount: 1,
            deferredCleanupHostQueueFenceCount: 1
          }, {
            source: 'thermal-output-buffer-cleanup'
          });
        }
        result.outputParticleBufferCleanupStatus =
          deferredHostQueueFenceScheduled
            ? 'submitted-output-cleanup-deferred-after-host-queue-fence'
            : 'submitted-output-cleanup-completed-without-host-queue-fence';
        result.outputParticleBufferQueueCompletionMethod =
          deferredHostQueueFenceScheduled
            ? 'gpu-queue-on-submitted-work-done'
            : 'synchronous-cleanup-no-queue-fence';
      }
      return true;
    }
    : null;
  result = outputEnvelope({
    backend: 'webgpu',
    sphParticleState,
    thermalMaterialTable,
    thermalClosureGraphSet: resolvedGraphSet,
    thermalClosureGraphBank: resolvedGraphBank,
    thermalPhaseResponseTable: resolvedPhaseResponseTable,
    thermalResponseGraphUpload: responseGraphUpload,
    state,
    thermo,
    wallHeatJ: Object.fromEntries(FACE_IDS.map((faceId) => [faceId, null])),
    radiativeAmbientHeatJ: null,
    ambientRadiationExchangeEnabled,
    dtS: finiteNumber(dtS, 0),
    conductionRate,
    ambientTemperatureK: resolvedAmbientTemperatureK,
    thermalEnvironmentAuthority: resolvedThermalEnvironmentAuthority,
    wallReservoirAuthority: resolvedWallReservoirAuthority,
    requestedWallRate,
    wallRate: effectiveWallRate,
    wallLayerM: layer,
    boxDimsM: dims,
    neighborLookupMode: spatialCanonicalThermalProposal
      ? 'canonical-schroeder-spatial-thermal-proposals'
      : (classicThermalProposalStage.normalLookupBinned
        ? 'canonical-post-separation-binned-thermal-proposals'
        : 'canonical-diagnosed-exhaustive-thermal-proposals'),
    legacyPrivateSpatialBuildCount: 0,
    legacyExhaustiveTraversalCount: 0,
    canonicalThermalProposal,
    stateBuffer: retainOutputParticleBuffers ? outStateBuffer : null,
    thermoBuffer: retainOutputParticleBuffers ? outThermoBuffer : null,
    stateBufferByteLength: outStateByteLength,
    thermoBufferByteLength: outThermoByteLength,
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
    destroyOutputParticleBuffers: destroyRetainedOutputParticleBuffers,
    outputBufferInitializationMode,
    materialPropertyBankWarmInputShaderBinding: {
      shaderBound: materialBankWarmInputBinding.rowCount > 0,
      shaderBinding: 9,
      shaderRowCount: materialBankWarmInputBinding.rowCount,
      bufferSource: materialBankWarmInputBinding.bufferSource
    },
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    readbackTelemetry: noFullReadback
      ? createGpuReadbackTelemetry({
          scope: 'sph-thermal-step-webgpu',
          mapAsyncCount: 0,
          readbackBytes: 0
        })
      : createGpuReadbackTelemetry({
          scope: 'sph-thermal-step-webgpu',
          complete: false,
          unknownSources: ['full-readback-pending']
        })
  });
  const encodedProposalDispatchCount = Number(
    matchedTimeThermalProposalStage?.proposalDispatchCount
    ?? classicThermalProposalStage?.proposalDispatchCount
    ?? 0
  );
  const encodedDispatchCount = encodedProposalDispatchCount + 1;
  result.encodedProposalDispatchCount = encodedProposalDispatchCount;
  result.encodedDispatchCount = encodedDispatchCount;
  return {
    schema: 'peercompute.ulg.sph-thermal-encoder-stage.v0',
    status: 'thermal-encoder-stage-ready',
    backend: 'webgpu',
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    result,
    thermalProposalDiagnostics: result.thermalProposalDiagnostics,
    encodedProposalDispatchCount,
    encodedDispatchCount,
    stateBuffer: outStateBuffer,
    thermoBuffer: outThermoBuffer,
    stateBufferByteLength: outStateByteLength,
    thermoBufferByteLength: outThermoByteLength,
    encode(encoder) {
      matchedTimeThermalProposalStage?.encode(encoder);
      classicThermalProposalStage?.encode(encoder);
      const pass = encoder.beginComputePass({
        label: 'ulg-sph-thermal-v2-canonical-proposal-apply'
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
      pass.end();
    },
    markSubmittedWork() {
      thermalPrimarySubmissionObserved = true;
      const marked =
        matchedTimeThermalProposalStage?.markSubmittedWork() ?? false;
      registerRetainedOutputCleanupClaim();
      return marked;
    },
    queueOrderedCanonicalApplyRetirementAuthorized:
      spatialCanonicalThermalProposal
        ?.queueOrderedCanonicalApplyRetirementAuthorized === true,
    cleanupSubmittedWork,
    cleanupAbortedWork
  };
  } catch (error) {
    for (let index = setupFailureCleanups.length - 1; index >= 0; index -= 1) {
      try { setupFailureCleanups[index](); } catch {}
    }
    throw error;
  }
}

export async function runSphThermalStepWebGpu(args = {}) {
  const stage = createSphThermalStepWebGpuEncoderStage(args);
  const { device, sphParticleState, retainOutputParticleBuffers = false } = args;
  const noFullReadback = stage.readbackMode === NO_FULL_READBACK_MODE;
  let submitted = false;
  try {
    const encoder = device.createCommandEncoder();
    stage.encode(encoder);
    device.queue.submit([encoder.finish()]);
    submitted = true;
    stage.markSubmittedWork?.();
    if (!noFullReadback) {
      const [stateBytes, thermoBytes] = await Promise.all([
        readBuffer(device, stage.stateBuffer, sphParticleState.state.byteLength),
        readBuffer(device, stage.thermoBuffer, sphParticleState.thermo.byteLength)
      ]);
      stage.result.state = new Float32Array(stateBytes);
      stage.result.thermo = new Float32Array(thermoBytes);
      Object.assign(stage.result, createGpuReadbackTelemetry({
        scope: 'sph-thermal-step-webgpu',
        mapAsyncCount: 2,
        readbackBytes:
          Math.max(4, sphParticleState.state.byteLength)
          + Math.max(4, sphParticleState.thermo.byteLength)
      }));
    }
    if (
      noFullReadback
      && stage.queueOrderedCanonicalApplyRetirementAuthorized === true
    ) {
      // The canonical proposal and apply were encoded in this submission and
      // the hierarchy authenticated it as their final same-queue consumer.
      // These are one-shot temporaries, so immediate destruction preserves
      // queue order without asking the host to observe device idle.
      stage.cleanupSubmittedWork();
    } else if (noFullReadback) {
      const scheduled = deferSubmittedWorkCleanup(
        device,
        stage.cleanupSubmittedWork
      );
      if (scheduled) {
        appendGpuReadbackTelemetryObservation(stage.result, {
          hostQueueFenceCount: 1,
          deferredCleanupHostQueueFenceCount: 1
        }, {
          source: 'thermal-submitted-temporary-cleanup'
        });
        stage.result.submittedTemporaryCleanupStatus =
          'submitted-temporary-cleanup-deferred-after-host-queue-fence';
        stage.result.submittedTemporaryQueueCompletionMethod =
          'gpu-queue-on-submitted-work-done';
      }
    } else {
      stage.cleanupSubmittedWork();
    }
    if (!retainOutputParticleBuffers) {
      stage.result.stateBuffer = null;
      stage.result.thermoBuffer = null;
    }
    return stage.result;
  } catch (error) {
    if (submitted) {
      deferSubmittedWorkCleanup(device, stage.cleanupAbortedWork);
    } else {
      stage.cleanupAbortedWork();
    }
    throw error;
  }
}

export function compareSphThermalStepParity(cpuResult, gpuResult, { tolerance = 2e-3 } = {}) {
  if (!cpuResult || !gpuResult) {
    return { schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA, status: 'fail', reason: 'missing result', scientificValidation: false, phaseChangeValidation: false, fullPhysicsValidation: false };
  }
  let maxStateAbs = 0;
  let maxThermoAbs = 0;
  if (cpuResult.state.length !== gpuResult.state.length || cpuResult.thermo.length !== gpuResult.thermo.length) {
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
      status: 'fail',
      lengthMismatch: true,
      maxStateAbs: Infinity,
      maxThermoAbs: Infinity,
      tolerance,
      scientificValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  for (let i = 0; i < cpuResult.state.length; i += 1) maxStateAbs = Math.max(maxStateAbs, Math.abs(cpuResult.state[i] - gpuResult.state[i]));
  for (let i = 0; i < cpuResult.thermo.length; i += 1) maxThermoAbs = Math.max(maxThermoAbs, Math.abs(cpuResult.thermo[i] - gpuResult.thermo[i]));
  const pass = maxStateAbs <= tolerance && maxThermoAbs <= tolerance;
  return {
    schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
    status: pass ? 'pass' : 'fail',
    maxStateAbs,
    maxThermoAbs,
    tolerance,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createNoFullReadbackThermalParityReport(tolerance = 2e-3) {
  return {
    schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    reason: 'Full thermal state/thermo readback and CPU parity were skipped for resident WebGPU execution',
    maxStateAbs: null,
    maxThermoAbs: null,
    tolerance,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runSphThermalStepWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = runSphThermalStepWebGpu,
  parityTolerance = 2e-3,
  ...args
} = {}) {
  const noFullReadback = args.readbackMode === NO_FULL_READBACK_MODE;
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) cpuReference = runSphThermalStepCpu(args);
    return cpuReference;
  };
  if (!preferWebGpu) {
    const reference = getCpuReference();
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference: reference,
      result: reference,
      webgpuStatus: { status: 'not-requested' },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDevice = device || deviceResult?.device || navigatorRef?.gpu?.device || null;
  if (!resolvedDevice) {
    const reference = getCpuReference();
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference: reference,
      result: reference,
      webgpuStatus: { status: 'fallback-cpu', reason: 'webgpu device unavailable' },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ ...args, device: resolvedDevice });
    if (noFullReadback) {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted-no-full-readback',
        cpuReference: null,
        webgpu,
        result: webgpu,
        webgpuParity: createNoFullReadbackThermalParityReport(parityTolerance),
        webgpuStatus: { status: 'webgpu-executed-no-full-readback' },
        scientificValidation: false,
        materialValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    const reference = getCpuReference();
    const parity = compareSphThermalStepParity(reference, webgpu, { tolerance: parityTolerance });
    if (parity.status === 'pass') {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference: reference,
        webgpu,
        result: webgpu,
        webgpuParity: parity,
        webgpuStatus: { status: 'webgpu-executed' },
        scientificValidation: false,
        materialValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-parity-failed-cpu-reference',
      cpuReference: reference,
      webgpu,
      result: reference,
      webgpuParity: parity,
      webgpuStatus: { status: 'fallback-cpu', reason: 'thermal parity failed' },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    const reference = getCpuReference();
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference: reference,
      result: reference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}
