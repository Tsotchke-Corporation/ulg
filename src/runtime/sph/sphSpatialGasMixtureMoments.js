// Inventory moments on the existing SS gas directory, not a caloric model or
// an exchange/activation capability. In particular, a signed sum of source U
// does not establish compatible material energy references, Cv, molar mass,
// or a matched physical exchange interval. Preserve per-member material and
// source addresses in the compact rows for the eventual donor-resolved apply.
export const SPH_SPATIAL_GAS_MIXTURE_MOMENT_ROW_FLOATS = 8;
export const SPH_SPATIAL_GAS_MIXTURE_MOMENT_STATUS = Object.freeze({
  READY: 1,
  INVALID_MEMBER: 2,
  ACCUMULATION_OVERFLOW: 4
});

// Appended to the EOS shader; aggregate_cells calls these helpers in its
// existing member loop. No extra directory, GPU pass, or production readback.
export const sphSpatialGasMixtureMomentsWgsl = /* wgsl */ `
@group(0) @binding(11) var<storage, read_write> gas_mixture_moments: array<f32>;
struct GasMixtureMoments {
  mass_kg: f32,
  internal_energy_j: f32,
  moles: f32,
  mole_temperature_k: f32,
  min_temperature_k: f32,
  max_temperature_k: f32,
  member_count: u32,
  errors: u32,
};
fn gas_mixture_empty() -> GasMixtureMoments {
  return GasMixtureMoments(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0u, 0u);
}
fn gas_mixture_add(acc: GasMixtureMoments, row: u32) -> GasMixtureMoments {
  var next = acc;
  let material = compact_rows[row + 3u];
  let mass = compact_rows[row + 4u];
  let moles = compact_rows[row + 5u];
  let u = compact_rows[row + 12u];
  let temperature = compact_rows[row + 13u];
  if (params.compact_stride != 16u || !finite_f32(material)
    || !(material >= 1.0 && material <= 16777215.0) || floor(material) != material
    || !finite_f32(mass) || !(mass > 0.0)
    || !finite_f32(moles) || !(moles > 0.0)
    || !finite_f32(u) || !finite_f32(temperature) || !(temperature > 0.0)
    || compact_rows[row + 14u] != 3.0 || compact_rows[row + 15u] != 0.0) {
    next.errors = next.errors | 2u;
    return next;
  }
  // Residual-event mass is already unplaced mass, never total event mass.
  // Source U can be signed: neither clamp it nor add another latent credit.
  let energy = mass * u;
  let nT = moles * temperature;
  next.mass_kg = acc.mass_kg + mass;
  next.internal_energy_j = acc.internal_energy_j + energy;
  next.moles = acc.moles + moles;
  next.mole_temperature_k = acc.mole_temperature_k + nT;
  next.min_temperature_k = select(min(acc.min_temperature_k, temperature),
    temperature, acc.member_count == 0u);
  next.max_temperature_k = max(acc.max_temperature_k, temperature);
  next.member_count = acc.member_count + 1u;
  if (!finite_f32(energy) || !finite_f32(nT) || !finite_f32(next.mass_kg)
    || !finite_f32(next.internal_energy_j) || !finite_f32(next.moles)
    || !finite_f32(next.mole_temperature_k)) {
    next.errors = next.errors | 4u;
  }
  return next;
}
fn gas_mixture_write(cell_index: u32, acc: GasMixtureMoments) {
  let row = cell_index * 8u;
  // Clear failed cells, including when an arena is reused. The status, not
  // zero mass/energy, is the meaning of a rejected inventory observation.
  for (var i = 0u; i < 8u; i = i + 1u) { gas_mixture_moments[row + i] = 0.0; }
  if (acc.errors != 0u || acc.member_count == 0u) {
    gas_mixture_moments[row + 7u] = f32(acc.errors | 2u);
    return;
  }
  gas_mixture_moments[row] = acc.mass_kg;
  gas_mixture_moments[row + 1u] = acc.internal_energy_j;
  gas_mixture_moments[row + 2u] = acc.moles;
  gas_mixture_moments[row + 3u] = acc.mole_temperature_k;
  gas_mixture_moments[row + 4u] = acc.min_temperature_k;
  gas_mixture_moments[row + 5u] = acc.max_temperature_k;
  gas_mixture_moments[row + 6u] = f32(acc.member_count);
  gas_mixture_moments[row + 7u] = 1.0;
}
`;

export function decodeSphSpatialGasMixtureMomentRows(values) {
  if (!(values instanceof Float32Array) || values.length % 8 !== 0) {
    throw new TypeError('Mixture moments require complete eight-float rows');
  }
  const cells = [];
  for (let row = 0; row < values.length; row += 8) {
    const ready = values[row + 7] === SPH_SPATIAL_GAS_MIXTURE_MOMENT_STATUS.READY;
    cells.push(Object.freeze({
      cellIndex: row / 8,
      ready,
      statusFlags: values[row + 7],
      massKg: ready ? values[row] : null,
      internalEnergyJ: ready ? values[row + 1] : null,
      moles: ready ? values[row + 2] : null,
      moleTemperatureK: ready ? values[row + 3] : null,
      minTemperatureK: ready ? values[row + 4] : null,
      maxTemperatureK: ready ? values[row + 5] : null,
      memberCount: ready ? values[row + 6] : null,
      caloricClosureAdmitted: false,
      exchangeAuthority: false
    }));
  }
  return Object.freeze(cells);
}
