// Opt-in observations of an already finalized SS gas cell. This module owns no
// phase, pressure, mass, energy, directory or renderer authority. The saturation
// inverse is the existing packed reduced plateau law, not a new material model.
export const ULG_SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-species-diagnostic.v1';
export const SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_ROW_WORDS = 32;
export const SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_MAGIC = 0x5347_4431;
export const SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_VERSION = 1;

export const SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS = Object.freeze({
  INITIALIZED: 1 << 0,
  SOURCE_READY: 1 << 1,
  CELL_PRESENT: 1 << 2,
  SPECIES_PRESENT: 1 << 3,
  PARTIAL_PRESSURE_READY: 1 << 4,
  CELL_ISOTHERMAL: 1 << 5,
  SPECIES_ISOTHERMAL: 1 << 6,
  REDUCED_LAW_READY: 1 << 7,
  SATURATION_READY: 1 << 8,
  SPECIES_ABSENT: 1 << 9,
  CELL_ABSENT: 1 << 10,
  SOURCE_UNAVAILABLE: 1 << 11,
  INVALID_MEMBER: 1 << 12,
  TEMPERATURE_FALLBACK: 1 << 13,
  MIXED_CELL_TEMPERATURE: 1 << 14,
  MIXED_SPECIES_TEMPERATURE: 1 << 15,
  LAW_UNAVAILABLE: 1 << 16,
  LAW_AMBIGUOUS: 1 << 17,
  NUMERIC_UNDERFLOW: 1 << 18,
  NUMERIC_OVERFLOW: 1 << 19,
  NUMERIC_INVALID: 1 << 20,
  PARAMETERS_INVALID: 1 << 21,
  PROVENANCE_INVALID: 1 << 22,
  SOURCE_EMPTY: 1 << 23
});

export const SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_OFFSETS = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  STATUS_FLAGS: 2,
  EXECUTION_GENERATION: 3,
  SOURCE_STORAGE_GENERATION: 4,
  DIRECTORY_GENERATION: 5,
  CONTROL_VOLUME_GEOMETRY_SEAL: 6,
  CELL_INDEX: 7,
  MATERIAL_ID: 8,
  SPECIES_MOLES: 9,
  SPECIES_MOLE_TEMPERATURE_K: 10,
  SPECIES_PARTIAL_PRESSURE_PA: 11,
  TOTAL_CELL_PRESSURE_PA: 12,
  FREE_VOLUME_M3: 13,
  SPECIES_MIN_TEMPERATURE_K: 14,
  SPECIES_MAX_TEMPERATURE_K: 15,
  CELL_MIN_TEMPERATURE_K: 16,
  CELL_MAX_TEMPERATURE_K: 17,
  SATURATION_PRESSURE_PA: 18,
  SUPERSATURATION_RATIO: 19,
  LOG_SATURATION_OVER_REFERENCE: 20,
  SPECIES_PRODUCT_ROW_COUNT: 21,
  SPECIES_PARTICLE_ROW_COUNT: 22
});

// Append to sphSpatialGasLedgerEosWgsl. All helpers reached here only read the
// finalized EOS resources; bindings 5/6 of that module are deliberately unused.
// Float quantities occupy their f32 bit patterns in the diagnostic u32 packet.
// Temperature ranges describe the effective EOS contributions. FALLBACK clears
// CELL_ISOTHERMAL even if those effective values happen to coincide.
export const sphSpatialGasSpeciesDiagnosticsWgsl = /* wgsl */ `
${Object.entries(SPH_SPATIAL_GAS_SPECIES_DIAGNOSTIC_STATUS)
    .map(([name, value]) => `const SGD_${name}: u32 = ${value}u;`).join('\n')}

struct SpeciesDiagnosticParams {
  material_id: f32,
  material_record_count: u32,
  thermal_segment_count: u32,
  thermal_offset_floats: u32,
  product_event_capacity: u32,
  product_event_stride: u32,
  particle_count: u32,
  reserved: u32,
};
@group(0) @binding(7) var<uniform> species_params: SpeciesDiagnosticParams;
@group(0) @binding(8) var<storage, read> species_thermal: array<f32>;
@group(0) @binding(9) var<storage, read> species_product_events: array<f32>;
@group(0) @binding(10) var<storage, read_write> species_diagnostics: array<u32>;

fn sgd_positive(value: f32) -> bool {
  return finite_f32(value) && value > 0.0;
}
fn sgd_index(value: f32) -> bool {
  return finite_f32(value) && value >= 0.0 && value <= 16777215.0
    && floor(value) == value;
}
fn sgd_range(offset: u32, count: u32, length: u32) -> bool {
  return offset <= length && count <= length - offset;
}
fn sgd_source_ready() -> bool {
  if (arrayLength(&authority) < 34u || arrayLength(&directory) < 48u
    || params.compact_stride != 16u || params.pressure_stride != 12u
    || params.directory_capacity_words > arrayLength(&directory)
    || params.source_capacity > arrayLength(&compact_rows) / 16u
    || params.cell_capacity > arrayLength(&pressure_cells) / 12u
    || params.cell_capacity > params.source_capacity
    || !sgd_positive(params.gas_constant_j_per_mol_k)) { return false; }
  let live_count = atomicLoad(&authority[8u]);
  let cell_count = directory[18u];
  if (cell_count > params.cell_capacity
    || !sgd_range(params.cell_keys_offset_words, cell_count * 5u,
      params.directory_capacity_words)
    || !sgd_range(params.cell_offsets_offset_words, cell_count + 1u,
      params.directory_capacity_words)
    || !sgd_range(params.cell_members_offset_words, live_count,
      params.directory_capacity_words)
    || !sgd_range(params.particle_to_cell_offset_words, live_count,
      params.directory_capacity_words)) { return false; }
  return directory_ready()
    && params.execution_generation != 0u
    && atomicLoad(&authority[5u]) == params.execution_generation
    && atomicLoad(&authority[6u]) == params.free_volume_storage_generation
    && atomicLoad(&authority[9u]) == params.directory_generation_id
    && atomicLoad(&authority[10u]) == cell_count
    && atomicLoad(&authority[11u]) == cell_count
    && atomicLoad(&authority[31u]) == cell_count
    && params.free_volume_directory_generation == params.directory_generation_id
    && params.free_volume_cell_capacity == params.cell_capacity
    && (atomicLoad(&authority[2u]) & (CONTROL_STATUS_DIRECTORY_READY
      | CONTROL_STATUS_EOS_READY | CONTROL_STATUS_PRESSURE_READY))
      == (CONTROL_STATUS_DIRECTORY_READY | CONTROL_STATUS_EOS_READY
        | CONTROL_STATUS_PRESSURE_READY);
}

struct SpeciesReducedLaw {
  flags: u32,
  reference_temperature_k: f32,
  reference_pressure_pa: f32,
  beta: f32,
};
fn sgd_reduced_law() -> SpeciesReducedLaw {
  var law = SpeciesReducedLaw(SGD_LAW_UNAVAILABLE, 0.0, 0.0, 0.0);
  let length = arrayLength(&species_thermal);
  if (species_params.material_record_count > length / 8u
    || species_params.thermal_offset_floats
      != species_params.material_record_count * 8u
    || species_params.thermal_offset_floats > length
    || species_params.thermal_segment_count
      > (length - species_params.thermal_offset_floats) / 12u) { return law; }
  var found = 0u;
  var record = 0u;
  for (var i = 0u; i < species_params.material_record_count; i = i + 1u) {
    if (species_thermal[i * 8u] == species_params.material_id) {
      found = found + 1u;
      record = i * 8u;
    }
  }
  if (found > 1u) { law.flags = law.flags | SGD_LAW_AMBIGUOUS; }
  if (found != 1u || species_thermal[record + 3u] != 1.0
    || species_thermal[record + 5u] != 1.0
    || !sgd_positive(species_thermal[record + 6u])
    || !sgd_positive(species_thermal[record + 7u])) { return law; }
  let start_f = species_thermal[record + 1u];
  let count_f = species_thermal[record + 2u];
  if (!sgd_index(start_f) || !sgd_index(count_f)
    || !sgd_range(u32(start_f), u32(count_f),
      species_params.thermal_segment_count)) { return law; }
  var plateau_count = 0u;
  var valid = true;
  var reference_temperature = 0.0;
  for (var i = 0u; i < u32(count_f); i = i + 1u) {
    let segment = species_params.thermal_offset_floats + (u32(start_f) + i) * 12u;
    if (species_thermal[segment] != species_params.material_id
      || species_thermal[segment + 10u] != 1.0) { valid = false; }
    if (species_thermal[segment + 1u] == 2.0
      && species_thermal[segment + 2u] == 2.0
      && species_thermal[segment + 3u] == 3.0) {
      plateau_count = plateau_count + 1u;
      reference_temperature = species_thermal[segment + 6u];
      let e0 = species_thermal[segment + 4u];
      let e1 = species_thermal[segment + 5u];
      if (!finite_f32(e0) || !finite_f32(e1) || !sgd_positive(e1 - e0)
        || !sgd_positive(reference_temperature)
        || species_thermal[segment + 7u] != reference_temperature) { valid = false; }
    }
  }
  if (plateau_count > 1u) { law.flags = law.flags | SGD_LAW_AMBIGUOUS; }
  if (plateau_count != 1u || !valid) { return law; }
  return SpeciesReducedLaw(SGD_REDUCED_LAW_READY, reference_temperature,
    species_thermal[record + 6u], species_thermal[record + 7u]);
}

@compute @workgroup_size(64)
fn diagnose_species_cells(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(num_workgroups) dispatch: vec3<u32>
) {
  let cell_index = linear_cell_index(local_id, workgroup_id, dispatch.x);
  if (cell_index >= params.cell_capacity
    || cell_index >= arrayLength(&species_diagnostics) / 32u) { return; }
  let output = cell_index * 32u;
  for (var word = 0u; word < 32u; word = word + 1u) {
    species_diagnostics[output + word] = 0u;
  }
  species_diagnostics[output] = 0x53474431u;
  species_diagnostics[output + 1u] = 1u;
  species_diagnostics[output + 3u] = params.execution_generation;
  species_diagnostics[output + 4u] = params.free_volume_storage_generation;
  species_diagnostics[output + 5u] = params.directory_generation_id;
  species_diagnostics[output + 6u] = params.geometry_seal;
  species_diagnostics[output + 7u] = cell_index;
  species_diagnostics[output + 8u] = bitcast<u32>(species_params.material_id);
  var flags = SGD_INITIALIZED;
  if (!sgd_positive(species_params.material_id) || !sgd_index(species_params.material_id)
    || species_params.reserved != 0u) {
    species_diagnostics[output + 2u] = flags | SGD_PARAMETERS_INVALID;
    return;
  }
  if (!sgd_source_ready()) {
    species_diagnostics[output + 2u] = flags | SGD_SOURCE_UNAVAILABLE;
    return;
  }
  flags = flags | SGD_SOURCE_READY;
  if (atomicLoad(&authority[8u]) == 0u) { flags = flags | SGD_SOURCE_EMPTY; }
  if (cell_index >= directory[18u]) {
    species_diagnostics[output + 2u] = flags | SGD_CELL_ABSENT;
    return;
  }
  flags = flags | SGD_CELL_PRESENT;
  let pressure_row = cell_index * 12u;
  let total_pressure = pressure_cells[pressure_row + 7u];
  let free_volume = pressure_cells[pressure_row + 11u];
  if (pressure_cells[pressure_row + 3u] != 1.0
    || !finite_f32(total_pressure) || total_pressure < 0.0
    || !sgd_positive(free_volume)
    || key_word(cell_index, 0u) != params.chart_id
    || key_word(cell_index, 1u) != params.level_order_key) {
    species_diagnostics[output + 2u] = flags | SGD_SOURCE_UNAVAILABLE;
    return;
  }
  let begin = directory[params.cell_offsets_offset_words + cell_index];
  let end = directory[params.cell_offsets_offset_words + cell_index + 1u];
  let live_count = atomicLoad(&authority[8u]);
  if (begin >= end || end > live_count) {
    species_diagnostics[output + 2u] = flags | SGD_INVALID_MEMBER;
    return;
  }
  var moles = 0.0;
  var mole_temperature = 0.0;
  var species_min_t = 3.402823466e+38;
  var species_max_t = 0.0;
  var cell_min_t = 3.402823466e+38;
  var cell_max_t = 0.0;
  var product_count = 0u;
  var particle_count = 0u;
  var species_fallback = false;
  for (var member = begin; member < end; member = member + 1u) {
    let source_index = directory[params.cell_members_offset_words + member];
    if (source_index >= live_count
      || directory[params.particle_to_cell_offset_words + source_index] != cell_index) {
      species_diagnostics[output + 2u] = flags | SGD_INVALID_MEMBER;
      return;
    }
    let row = source_index * params.compact_stride;
    let material = compact_rows[row + 3u];
    let n = compact_rows[row + 5u];
    let temperature = compact_rows[row + 6u];
    let provenance = compact_rows[row + 8u];
    let source_row = compact_rows[row + 9u];
    if (compact_rows[row + 10u] != 1.0
      || !finite_f32(compact_rows[row + 11u])
      || compact_rows[row + 11u] <= 0.5 || compact_rows[row + 11u] >= 1.5
      || !sgd_positive(material) || !sgd_index(material) || !sgd_positive(n)
      || !sgd_positive(compact_rows[row + 4u]) || !sgd_positive(temperature)
      || !finite_f32(compact_rows[row]) || !finite_f32(compact_rows[row + 1u])
      || !finite_f32(compact_rows[row + 2u]) || !sgd_index(source_row)) {
      species_diagnostics[output + 2u] = flags | SGD_INVALID_MEMBER;
      return;
    }
    var fallback = false;
    if (provenance == -1.0) {
      if (u32(source_row) >= species_params.particle_count) {
        species_diagnostics[output + 2u] = flags | SGD_PROVENANCE_INVALID;
        return;
      }
    } else {
      if (!sgd_index(provenance) || species_params.product_event_stride != 32u
        || u32(source_row) >= species_params.product_event_capacity
        || u32(source_row) >= arrayLength(&species_product_events) / 32u) {
        species_diagnostics[output + 2u] = flags | SGD_PROVENANCE_INVALID;
        return;
      }
      let product = u32(source_row) * 32u;
      let source_t = species_product_events[product + 16u];
      fallback = !sgd_positive(source_t);
      let expected_t = select(source_t, params.fallback_temperature_k, fallback);
      if (species_product_events[product + 4u] != material
        || species_product_events[product + 5u] != provenance
        || bitcast<u32>(expected_t) != bitcast<u32>(temperature)
        || !finite_f32(species_product_events[product + 18u])
        || species_product_events[product + 18u] <= 0.5
        || species_product_events[product + 10u] != compact_rows[row + 11u]) {
        species_diagnostics[output + 2u] = flags | SGD_PROVENANCE_INVALID;
        return;
      }
    }
    cell_min_t = min(cell_min_t, temperature);
    cell_max_t = max(cell_max_t, temperature);
    if (fallback) { flags = flags | SGD_TEMPERATURE_FALLBACK; }
    if (material == species_params.material_id) {
      moles = moles + n;
      mole_temperature = mole_temperature + n * temperature;
      species_min_t = min(species_min_t, temperature);
      species_max_t = max(species_max_t, temperature);
      species_fallback = species_fallback || fallback;
      if (provenance == -1.0) { particle_count = particle_count + 1u; }
      else { product_count = product_count + 1u; }
    }
  }
  let partial_pressure = mole_temperature * params.gas_constant_j_per_mol_k / free_volume;
  if (!finite_f32(moles) || !finite_f32(mole_temperature)
    || !finite_f32(partial_pressure) || partial_pressure < 0.0) {
    species_diagnostics[output + 2u] = flags | SGD_NUMERIC_INVALID;
    return;
  }
  if (product_count + particle_count > 0u
    && (!(mole_temperature > 0.0) || !(partial_pressure > 0.0))) {
    species_diagnostics[output + 2u] = flags | SGD_NUMERIC_UNDERFLOW;
    return;
  }
  flags = flags | SGD_PARTIAL_PRESSURE_READY;
  if (product_count + particle_count == 0u) {
    flags = flags | SGD_SPECIES_ABSENT;
    species_min_t = 0.0;
  } else {
    flags = flags | SGD_SPECIES_PRESENT;
    if (species_min_t != species_max_t) { flags = flags | SGD_MIXED_SPECIES_TEMPERATURE; }
    else if (!species_fallback) { flags = flags | SGD_SPECIES_ISOTHERMAL; }
  }
  if (cell_min_t != cell_max_t) { flags = flags | SGD_MIXED_CELL_TEMPERATURE; }
  else if ((flags & SGD_TEMPERATURE_FALLBACK) == 0u) { flags = flags | SGD_CELL_ISOTHERMAL; }
  species_diagnostics[output + 9u] = bitcast<u32>(moles);
  species_diagnostics[output + 10u] = bitcast<u32>(mole_temperature);
  species_diagnostics[output + 11u] = bitcast<u32>(partial_pressure);
  species_diagnostics[output + 12u] = bitcast<u32>(total_pressure);
  species_diagnostics[output + 13u] = bitcast<u32>(free_volume);
  species_diagnostics[output + 14u] = bitcast<u32>(species_min_t);
  species_diagnostics[output + 15u] = bitcast<u32>(species_max_t);
  species_diagnostics[output + 16u] = bitcast<u32>(cell_min_t);
  species_diagnostics[output + 17u] = bitcast<u32>(cell_max_t);
  species_diagnostics[output + 21u] = product_count;
  species_diagnostics[output + 22u] = particle_count;
  let law = sgd_reduced_law();
  flags = flags | law.flags;
  if ((flags & (SGD_REDUCED_LAW_READY | SGD_CELL_ISOTHERMAL))
    != (SGD_REDUCED_LAW_READY | SGD_CELL_ISOTHERMAL)) {
    species_diagnostics[output + 2u] = flags;
    return;
  }
  let log_ratio = (1.0 / law.reference_temperature_k - 1.0 / cell_min_t) / law.beta;
  species_diagnostics[output + 20u] = bitcast<u32>(log_ratio);
  let log_pressure = log(law.reference_pressure_pa) + log_ratio;
  // Restrict to normal f32 outputs: WebGPU may flush subnormals to zero.
  if (!finite_f32(log_ratio) || !finite_f32(log_pressure)) {
    flags = flags | SGD_NUMERIC_INVALID;
  } else if (log_pressure < -87.33654475) {
    flags = flags | SGD_NUMERIC_UNDERFLOW;
  } else if (log_pressure > 88.72283905) {
    flags = flags | SGD_NUMERIC_OVERFLOW;
  } else {
    var saturation = law.reference_pressure_pa;
    if (cell_min_t != law.reference_temperature_k) { saturation = exp(log_pressure); }
    let ratio = partial_pressure / saturation;
    if (!finite_f32(saturation) || !finite_f32(ratio)) {
      flags = flags | SGD_NUMERIC_OVERFLOW;
    } else if (saturation < 1.175494351e-38
      || (partial_pressure > 0.0 && ratio < 1.175494351e-38)) {
      flags = flags | SGD_NUMERIC_UNDERFLOW;
    } else {
      species_diagnostics[output + 18u] = bitcast<u32>(saturation);
      species_diagnostics[output + 19u] = bitcast<u32>(ratio);
      flags = flags | SGD_SATURATION_READY;
    }
  }
  species_diagnostics[output + 2u] = flags;
}
`;
