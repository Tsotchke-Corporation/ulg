import { stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { isPhaseCaloricThermodynamics } from '../material/condensableThermodynamics.js';
import { condensableCaloricSegments, SPH_CALORIC_PHASE_IDS } from './sphCondensableCaloricTable.js';
import { condensableInitializationProperties } from './sphCondensableParticleInitialization.js';
import { resolveThermalResponseGraphArtifacts, ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA }
  from './sphThermalGpuKernel.js';

// Cold material admission only. The EOS owner must separately bind this data
// to an actual retained particle/product source interval. No phase exchange,
// source mutation, legacy U rebasing, or scientific calibration is authorized.
export const SPH_SPATIAL_GAS_CALORIC_AUTHORITY_SCHEMA =
  'peercompute.ulg.spatial-gas-caloric-authority.v1';
export const SPH_SPATIAL_GAS_CALORIC_MATERIAL_ROW_FLOATS = 8;
export const SPH_SPATIAL_GAS_CALORIC_CELL_ROW_FLOATS = 8;
export const SPH_SPATIAL_GAS_CALORIC_MATERIAL_LAYOUT = Object.freeze([
  'materialId', 'molarMassKgPerMol', 'cvJPerKgK', 'energyMinJPerKg',
  'energyMaxJPerKg', 'temperatureMinK', 'temperatureMaxK', 'status'
]);
export const SPH_SPATIAL_GAS_CALORIC_STATUS = Object.freeze({
  READY: 1, INVALID_MEMBER: 2, UNKNOWN_MATERIAL: 4, MOLAR_MASS_MISMATCH: 8,
  CALORIC_STATE_MISMATCH: 16, OUTSIDE_DOMAIN: 32, NUMERIC_FAILURE: 64
});
// A few f32 mass/mole operations (including residual product partition).
// Temperature uses the existing caloric compiler's absolute/relative budget.
// These are fixed packing checks, not tunable scientific validation tolerances.
export const SPH_SPATIAL_GAS_CALORIC_MOLAR_MASS_RELATIVE_BUDGET = 1e-5;
const authorities = new WeakMap();
const fail = (message) => { throw new TypeError(`Gas caloric authority: ${message}`); };
const f32Positive = (value) => typeof value === 'number' && Number.isFinite(value)
  && Number.isFinite(Math.fround(value)) && Math.fround(value) > 0;

// Canonical, type-preserving snapshot of cold DATA, including metadata used
// by the existing graph compiler. JSON alone would alias NaN/null, undefined,
// or -0/0; accessors and shared memory cannot issue stable cold authority.
function coldSnapshot(value, seen = new Set()) {
  if (value === null) return ['null'];
  const kind = typeof value;
  if (kind === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
  if (kind === 'string' || kind === 'boolean') return [kind, value];
  if (kind === 'undefined') return ['undefined'];
  if (kind !== 'object' || seen.has(value)) fail('cold inputs must be acyclic data');
  seen.add(value);
  let result;
  if (ArrayBuffer.isView(value)) {
    const ordinaryFloat = value instanceof Float32Array && value.constructor === Float32Array;
    const ordinaryUint = value instanceof Uint32Array && value.constructor === Uint32Array;
    if ((!ordinaryFloat && !ordinaryUint)
      || (typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer)) {
      fail('cold arrays must be ordinary Float32Array or Uint32Array storage');
    }
    result = [ordinaryFloat ? 'Float32Array' : 'Uint32Array',
      Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))];
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
      fail('cold metadata must be plain data');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) fail('symbol cold metadata is unsupported');
    result = [Array.isArray(value) ? 'array' : 'object', keys.sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!Object.hasOwn(descriptor, 'value')) fail('cold data accessors are not authority');
      return [key, coldSnapshot(descriptor.value, seen)];
    })];
  }
  seen.delete(value);
  return result;
}
const snapshot = (value) => JSON.stringify(coldSnapshot(value));
const rowMatches = (row, expected) => row.length >= expected.length
  && expected.every((value, lane) => Object.is(row[lane], value));

function validateThermalShape(table) {
  if (table?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
    || !Number.isSafeInteger(table.materialCount) || table.materialCount <= 0
    || !Number.isSafeInteger(table.segmentCount) || table.segmentCount <= 0
    || !(table.records instanceof Float32Array) || !(table.segments instanceof Float32Array)
    || table.records.length !== table.materialCount * 8
    || table.segments.length !== table.segmentCount * 12
    || table.recordStrideFloats !== 8 || table.segmentStrideFloats !== 12
    || !Array.isArray(table.metadata) || table.metadata.length !== table.materialCount
    || !Array.isArray(table.segmentMetadata) || table.segmentMetadata.length !== table.segmentCount) {
    fail('complete actual thermal rows and metadata required');
  }
  const ids = new Set();
  for (let i = 0; i < table.materialCount; i += 1) {
    const row = table.records.subarray(i * 8, i * 8 + 8);
    if (!row.every(Number.isFinite) || !Number.isInteger(row[0]) || row[0] < 1
      || row[0] > 16777215 || ids.has(row[0]) || !Number.isInteger(row[1])
      || !Number.isInteger(row[2]) || row[1] < 0 || row[2] <= 0
      || row[1] + row[2] > table.segmentCount) fail('invalid or duplicate thermal material');
    ids.add(row[0]);
  }
}

function validatePhaseGraph(artifacts, segmentIndex, id, phaseId, segment) {
  const { thermalClosureGraphSet: graphs, thermalPhaseResponseTable: responses } = artifacts;
  const mapping = graphs.metadata.filter((row) => row.segmentIndex === segmentIndex);
  if (mapping.length !== 1) fail('missing or ambiguous actual phase graph');
  const index = mapping[0].graphIndex;
  const graph = graphs.graphs[index];
  const responseMatches = [];
  for (let i = 0; i < responses.responseCount; i += 1) {
    const row = responses.responses.subarray(i * 16, i * 16 + 16);
    if (row[0] === id && row[6] === phaseId) responseMatches.push(row);
  }
  const expected = [id, segment.caloricSegmentType, index, 1, segment.eStart, segment.eEnd,
    phaseId, phaseId, segment.restDensityKgPerM3, segment.restDensityKgPerM3, 1, 1, 0, 1, 0, 0];
  if (responseMatches.length !== 1 || !rowMatches(responseMatches[0], expected)
    || graph?.nodeCount !== 1 || graph.sampleCount !== 2 || graph.sampleRows?.length !== 8
    || graph.nodeRows?.[0] !== 1 || graph.nodeRows[1] !== 0 || graph.nodeRows[2] !== 1
    || graph.nodeRows[4] !== 0 || graph.nodeRows[5] !== 2
    || graph.nodeRows[6] !== segment.eStart || graph.nodeRows[7] !== segment.eEnd
    || graph.nodeRows[10] !== 1) fail('explicit phase needs the exact affine thermal graph');
  const slope = Math.fround((segment.tHi - segment.tLo) / (segment.eEnd - segment.eStart));
  if (!rowMatches(graph.sampleRows, [segment.eStart, segment.tLo, slope, 0,
    segment.eEnd, segment.tHi, slope, 0])) fail('phase graph differs from the declared packed model');
}

export function createSphSpatialGasCaloricAuthority({
  thermalMaterialTable, condensableThermodynamicsByMaterial
} = {}) {
  const tableSnapshot = snapshot(thermalMaterialTable);
  validateThermalShape(thermalMaterialTable);
  if (!condensableThermodynamicsByMaterial || typeof condensableThermodynamicsByMaterial !== 'object'
    || Array.isArray(condensableThermodynamicsByMaterial)) fail('explicit models by material required');
  snapshot(condensableThermodynamicsByMaterial);
  const entries = Object.entries(condensableThermodynamicsByMaterial);
  if (!entries.length) fail('at least one explicitly enrolled model required');
  const artifacts = resolveThermalResponseGraphArtifacts({ thermalMaterialTable, requireExactContent: true });
  const rows = [], admittedIds = new Set();
  for (const [material, model] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    if (!isPhaseCaloricThermodynamics(model)) fail('original created explicit model required');
    const id = stableOpticalMaterialId(material);
    if (admittedIds.has(id)) fail('duplicate enrolled material identity');
    admittedIds.add(id);
    const metadata = thermalMaterialTable.metadata.filter((row) => row.materialId === id);
    const recordIndices = [];
    for (let i = 0; i < thermalMaterialTable.materialCount; i += 1) {
      if (thermalMaterialTable.records[i * 8] === id) recordIndices.push(i);
    }
    if (metadata.length !== 1 || recordIndices.length !== 1 || metadata[0].material !== material
      || metadata[0].phaseCaloric !== true || metadata[0].caloricEnergyBasis !== model.energyBasis
      || metadata[0].caloricProvenance !== model.provenance
      || snapshot(metadata[0].caloricInitializationProperties) !== snapshot(condensableInitializationProperties(model))) {
      fail('thermal material lacks matching explicit model identity, M or Cp');
    }
    const record = thermalMaterialTable.records.subarray(recordIndices[0] * 8, recordIndices[0] * 8 + 8);
    const start = record[1];
    const segments = condensableCaloricSegments(model);
    if (record[2] !== segments.length || record[3] !== 1 || record[5] !== 0 || record[6] !== 0 || record[7] !== 0
      || metadata[0].segmentOffset !== start || metadata[0].segmentCount !== segments.length) {
      fail('enrolled material must contain its complete declared pure-phase roster');
    }
    for (let local = 0; local < segments.length; local += 1) {
      const s = segments[local], phaseId = SPH_CALORIC_PHASE_IDS[s.phase], index = start + local;
      const row = thermalMaterialTable.segments.subarray(index * 12, index * 12 + 12);
      const metadataRow = thermalMaterialTable.segmentMetadata[index];
      if (!rowMatches(row, [id, s.caloricSegmentType, phaseId, phaseId, s.eStart, s.eEnd,
        s.tLo, s.tHi, s.restDensityKgPerM3, s.restDensityKgPerM3, 1])
        || !Number.isFinite(row[11]) || row[11] < 0
        || metadataRow?.material !== material || metadataRow.materialId !== id
        || metadataRow.segmentIndex !== index || metadataRow.phaseCaloric !== true
        || Object.entries(s).some(([key, value]) => !Object.is(metadataRow[key], value))
        || metadataRow.debyeTemperatureK) fail('actual phase rows differ from the declared model');
      validatePhaseGraph(artifacts, index, id, phaseId, s);
    }
    const gas = segments.find((segment) => segment.phase === 'gas');
    const mass = Math.fround(model.molarMassKgPerMol);
    const cv = Math.fround((gas.eEnd - gas.eStart) / (gas.tHi - gas.tLo));
    if (!f32Positive(mass) || !f32Positive(cv)) fail('unrepresentable material M or Cv');
    rows.push(id, mass, cv, gas.eStart, gas.eEnd, gas.tLo, gas.tHi, 1);
  }
  // No caller can replace a live table during graph construction and retain
  // authority for the old caloric interpretation.
  if (snapshot(thermalMaterialTable) !== tableSnapshot) fail('thermal input changed during compilation');
  const authority = Object.freeze({ schema: SPH_SPATIAL_GAS_CALORIC_AUTHORITY_SCHEMA,
    materialCount: entries.length, exchangeIntervalAdmitted: false, scientificValidation: false });
  authorities.set(authority, { thermalMaterialTable, tableSnapshot, records: new Float32Array(rows),
    models: entries.sort(([a], [b]) => a.localeCompare(b)) });
  return authority;
}

function authorityRecord(authority, thermalMaterialTable) {
  const record = authorities.get(authority);
  if (!record || record.thermalMaterialTable !== thermalMaterialTable
    || snapshot(thermalMaterialTable) !== record.tableSnapshot) fail('unissued, copied or stale caloric authority');
  return record;
}

export function validateSphSpatialGasCaloricAuthority(authority, { thermalMaterialTable } = {}) {
  authorityRecord(authority, thermalMaterialTable);
  return true;
}

export function resolveSphSpatialGasCaloricAuthority(authority, { thermalMaterialTable } = {}) {
  const record = authorityRecord(authority, thermalMaterialTable);
  return Object.freeze({ schema: authority.schema, records: record.records.slice(),
    materialCount: authority.materialCount, recordStrideFloats: 8,
    exchangeIntervalAdmitted: false, scientificValidation: false });
}

/** Cold inputs for the conservative existing-droplet writer. The bulk energy
 * zero and both phase curves come from the SAME original EOS authority, never
 * a caller replacement of gas-only rows. A linear pure-interface model is an
 * explicit bounded constitutive approximation, not a water/default or a
 * growth-rate law. For sigma=a+b*T, surface INTERNAL energy is a*A, not sigma*A.
 * The writer keeps that energy in a separate sidecar, outside bulk U(T).
 */
export function resolveSphSpatialGasExchangeMaterials(authority, {
  thermalMaterialTable, surfaceModels
} = {}) {
  const record = authorityRecord(authority, thermalMaterialTable);
  snapshot(surfaceModels);
  if (!surfaceModels || typeof surfaceModels !== 'object' || Array.isArray(surfaceModels)) {
    fail('explicit surface models by material required');
  }
  const names = new Set(record.models.map(([material]) => material));
  if (Object.keys(surfaceModels).some((name) => !names.has(name))) {
    fail('surface model material is not enrolled in the exact caloric authority');
  }
  const rows = [], materials = [];
  for (const [material, model] of record.models) {
    const segments = condensableCaloricSegments(model);
    const liquid = segments.find((segment) => segment.phase === 'liquid');
    const gas = segments.find((segment) => segment.phase === 'gas');
    const surface = Object.hasOwn(surfaceModels, material) ? surfaceModels[material] : null;
    let a = 0, b = 0, ready = 0;
    if (surface != null) {
      if (!liquid) fail('gas-only material cannot declare a liquid surface or mass-exchange law');
      const keys = ['schema', 'provenance', 'interceptNPerM', 'slopeNPerMK',
        'minTemperatureK', 'maxTemperatureK'];
      if (surface.schema !== 'peercompute.ulg.linear-pure-interface.v1'
        || typeof surface.provenance !== 'string' || !surface.provenance.trim()
        || Reflect.ownKeys(surface).some((key) => !keys.includes(key))
        || !keys.every((key) => Object.hasOwn(surface, key))
        || !Number.isFinite(surface.minTemperatureK) || !Number.isFinite(surface.maxTemperatureK)
        || !(surface.minTemperatureK > 0) || surface.minTemperatureK > liquid.tLo
        || surface.maxTemperatureK < liquid.tHi) fail('complete covering linear pure-interface model required');
      a = Math.fround(surface.interceptNPerM);
      b = Math.fround(surface.slopeNPerMK);
      const sigma = (temperature) => Math.fround(a + Math.fround(b * temperature));
      if (typeof surface.interceptNPerM !== 'number' || typeof surface.slopeNPerMK !== 'number'
        || !Number.isFinite(a) || !(a > 0) || !Number.isFinite(b)
        || !f32Positive(sigma(liquid.tLo)) || !f32Positive(sigma(liquid.tHi))) {
        fail('finite positive surface internal energy and tension throughout the packed domain required');
      }
      ready = 1;
    }
    const cv = Math.fround((gas.eEnd - gas.eStart) / (gas.tHi - gas.tLo));
    const gamma = Math.fround(1 + model.specificGasConstantJPerKgK / cv);
    // Lane 15 distinguishes a genuinely gas-only heat participant. Its liquid
    // interval/density are absent (zero), never a fabricated condensed phase.
    const row = [stableOpticalMaterialId(material), Math.fround(model.molarMassKgPerMol),
      gas.eStart, gas.eEnd, liquid?.eStart ?? 0, liquid?.eEnd ?? 0, gas.tLo, gas.tHi,
      liquid?.restDensityKgPerM3 ?? 0, a, b, ready, cv, gamma, Math.fround(model.maxPressurePa), liquid ? 0 : 1];
    if (!row.every(Number.isFinite) || !(gamma > 1) || !(row[14] > 0)) {
      fail('unrepresentable exchange material coefficients');
    }
    rows.push(...row); materials.push(material);
  }
  // Snapshot validation above cannot turn a reentrant table mutation into an
  // original bulk-caloric authority.
  authorityRecord(authority, thermalMaterialTable);
  return Object.freeze({ records: new Float32Array(rows), materialCount: materials.length,
    recordStrideFloats: 16, materials: Object.freeze(materials),
    surfaceModel: 'linear-pure-interface', kineticAuthorization: false,
    exchangeIntervalAdmitted: false, scientificValidation: false });
}

// Cold coefficients for the explicitly bounded near-equilibrium model in
// condensableFiniteCell.js. Saturation and enthalpy come from the original
// caloric authority; callers cannot replace phase energies or latent offsets.
export function resolveSphSpatialGasExchangeRates(authority, {
  thermalMaterialTable, surfaceModels, rateModels
} = {}) {
  const record = authorityRecord(authority, thermalMaterialTable);
  const materialData = resolveSphSpatialGasExchangeMaterials(authority, { thermalMaterialTable, surfaceModels });
  snapshot(rateModels);
  if (!rateModels || Array.isArray(rateModels) || typeof rateModels !== 'object'
      || !Object.keys(rateModels).length) fail('explicit rate models by liquid material required');
  const names = materialData.materials, count = names.length;
  if (Object.keys(rateModels).some(name => !names.includes(name))) fail('rate material is not enrolled');
  const rows = new Float32Array(count * 16 + count * count);
  const pack = (value, name, positive = false) => {
    const packed = Math.fround(value);
    if (typeof value !== 'number' || !Number.isFinite(packed) || value < 0
        || (positive && value === 0) || (value !== 0 && packed < 2 ** -126)) {
      fail(`representable ${name} required`);
    }
    return packed;
  };
  for (const [index, [material, thermo]] of record.models.entries()) {
    if (!Object.hasOwn(rateModels, material)) continue;
    const model = rateModels[material];
    const keys = ['schema', 'provenance', 'massMobilityPerAreaKg2KPerJsM2',
      'maxAbsAffinityJPerKgK', 'maxTemperatureDifferenceK', 'heatTransferCoefficientsWPerM2K'];
    if (!model || typeof model !== 'object'
        || model.schema !== 'peercompute.ulg.near-equilibrium-onsager.v1'
        || typeof model.provenance !== 'string' || !model.provenance.trim()
        || Reflect.ownKeys(model).some(key => !keys.includes(key))
        || !keys.every(key => Object.hasOwn(model, key))
        || materialData.records[index * 16 + 11] !== 1) fail('complete bounded liquid rate model required');
    const heat = model.heatTransferCoefficientsWPerM2K;
    if (!heat || typeof heat !== 'object' || Array.isArray(heat)
        || Reflect.ownKeys(heat).length !== count || !names.every(name => Object.hasOwn(heat, name))) {
      fail('explicit heat coefficients for every enrolled gas material required');
    }
    rows.set([1, thermo.referenceTemperatureK, thermo.referencePressurePa,
      thermo.vaporizationReferenceEnthalpyJPerKg, thermo.liquidCpJPerKgK, thermo.vaporCpJPerKgK,
      thermo.specificGasConstantJPerKgK, thermo.vaporCvJPerKgK, thermo.vaporReferenceInternalEnergyJPerKg,
      pack(model.massMobilityPerAreaKg2KPerJsM2, 'mass mobility'),
      pack(model.maxAbsAffinityJPerKgK, 'affinity domain', true),
      pack(model.maxTemperatureDifferenceK, 'temperature-jump domain', true), 0, 0, 0, 0], index * 16);
    for (let gas = 0; gas < count; gas++) rows[count * 16 + index * count + gas] = pack(heat[names[gas]], 'heat coefficient');
  }
  if (!rows.every(Number.isFinite)) fail('unrepresentable rate thermodynamics');
  authorityRecord(authority, thermalMaterialTable);
  return Object.freeze({ records: rows, model: 'near-equilibrium-onsager',
    integration: 'frozen-initial-rate', scientificValidation: false });
}

// Optional EOS variant only: the owner supplies bindings and calls these
// functions in its existing compact16 member/aggregate loop. No extra spatial
// pass or production readback. Raw source T is checked, never pressure's
// fallback lane; actual U determines caloric contributions.
export const sphSpatialGasCaloricAdmissionWgsl = /* wgsl */ `
@group(0) @binding(12) var<storage, read> gas_caloric_materials: array<f32>;
@group(0) @binding(13) var<storage, read_write> gas_caloric_cells: array<f32>;
struct GasCaloricState {
  heat_capacity: f32,
  centered_energy: f32,
  anchor_temperature: f32,
  min_temperature: f32,
  max_temperature: f32,
  member_count: u32,
  errors: u32,
};
fn gas_caloric_empty() -> GasCaloricState {
  return GasCaloricState(0.0, 0.0, 0.0, 0.0, 0.0, 0u, 0u);
}
fn gas_caloric_add(acc: GasCaloricState, row: u32) -> GasCaloricState {
  var next = acc;
  if (params.compact_stride != 16u || row > arrayLength(&compact_rows)
    || arrayLength(&compact_rows) - row < 16u || acc.member_count >= 16777215u) {
    next.errors = next.errors | 2u; return next;
  }
  let id = compact_rows[row + 3u];
  let mass = compact_rows[row + 4u];
  let moles = compact_rows[row + 5u];
  let u = compact_rows[row + 12u];
  let raw_temperature = compact_rows[row + 13u];
  if (!finite_f32(id) || id < 1.0 || id > 16777215.0 || floor(id) != id
    || !finite_f32(mass) || !(mass > 0.0) || !finite_f32(moles) || !(moles > 0.0)
    || !finite_f32(u) || !finite_f32(raw_temperature) || !(raw_temperature > 0.0)
    || compact_rows[row + 10u] != 1.0 || compact_rows[row + 11u] != 1.0
    || compact_rows[row + 14u] != 3.0 || compact_rows[row + 15u] != 0.0) {
    next.errors = next.errors | 2u; return next;
  }
  var material = 0u;
  var matches = 0u;
  for (var offset = 0u; offset + 7u < arrayLength(&gas_caloric_materials); offset = offset + 8u) {
    if (gas_caloric_materials[offset] == id) { material = offset; matches = matches + 1u; }
  }
  if (matches != 1u || arrayLength(&gas_caloric_materials) % 8u != 0u) {
    next.errors = next.errors | 4u; return next;
  }
  for (var lane = 0u; lane < 8u; lane = lane + 1u) {
    if (!finite_f32(gas_caloric_materials[material + lane])) {
      next.errors = next.errors | 64u; return next;
    }
  }
  let molar_mass = gas_caloric_materials[material + 1u];
  let cv = gas_caloric_materials[material + 2u];
  let u_lo = gas_caloric_materials[material + 3u];
  let u_hi = gas_caloric_materials[material + 4u];
  let t_lo = gas_caloric_materials[material + 5u];
  let t_hi = gas_caloric_materials[material + 6u];
  let span_u = u_hi - u_lo;
  let span_t = t_hi - t_lo;
  if (!(molar_mass > 0.0) || !(cv > 0.0) || !(t_lo > 0.0) || !(span_t > 0.0)
    || !finite_f32(span_u) || !(span_u > 0.0) || !finite_f32(span_t)
    || gas_caloric_materials[material + 7u] != 1.0) {
    next.errors = next.errors | 64u; return next;
  }
  let expected_mass = moles * molar_mass;
  if (!finite_f32(expected_mass) || !(expected_mass > 0.0)
    || abs(mass - expected_mass) > 1.0e-5 * max(mass, expected_mass)) {
    next.errors = next.errors | 8u; return next;
  }
  if (u < u_lo || u > u_hi || raw_temperature < t_lo || raw_temperature > t_hi) {
    next.errors = next.errors | 32u; return next;
  }
  let above_lo = u - u_lo;
  let resolved_temperature = t_lo + (above_lo / span_u) * span_t;
  let temperature_budget = max(1.0e-4, t_hi * 1.0e-6);
  if (!finite_f32(above_lo) || !finite_f32(resolved_temperature)
    || abs(raw_temperature - resolved_temperature) > temperature_budget) {
    next.errors = next.errors | 16u; return next;
  }
  // Center each member's ACTUAL U on the first member's resolved temperature.
  // Subtract its own Ulo first, so independent material energy-zero shifts
  // never pollute the sum with absolute formation/reference energies.
  let anchor = select(acc.anchor_temperature, resolved_temperature, acc.member_count == 0u);
  let anchor_above_lo = (anchor - t_lo) * cv;
  let centered_u = above_lo - anchor_above_lo;
  let capacity = mass * cv;
  let centered_energy = mass * centered_u;
  next.heat_capacity = acc.heat_capacity + capacity;
  next.centered_energy = acc.centered_energy + centered_energy;
  next.anchor_temperature = anchor;
  next.min_temperature = select(max(acc.min_temperature, t_lo), t_lo, acc.member_count == 0u);
  next.max_temperature = select(min(acc.max_temperature, t_hi), t_hi, acc.member_count == 0u);
  next.member_count = acc.member_count + 1u;
  if (!finite_f32(anchor_above_lo) || !finite_f32(centered_u)
    || !finite_f32(capacity) || !(capacity > 0.0) || !finite_f32(centered_energy)
    || !finite_f32(next.heat_capacity) || !finite_f32(next.centered_energy)) {
    next.errors = next.errors | 64u;
  }
  if (next.min_temperature > next.max_temperature) { next.errors = next.errors | 32u; }
  return next;
}
fn gas_caloric_write(cell_index: u32, acc: GasCaloricState) {
  let row = cell_index * 8u;
  for (var lane = 0u; lane < 8u; lane = lane + 1u) { gas_caloric_cells[row + lane] = 0.0; }
  var errors = acc.errors;
  if (acc.member_count == 0u || !(acc.heat_capacity > 0.0)) { errors = errors | 2u; }
  var temperature = 0.0;
  if (errors == 0u) {
    temperature = acc.anchor_temperature + acc.centered_energy / acc.heat_capacity;
    if (!finite_f32(temperature)) { errors = errors | 64u; }
    if (temperature < acc.min_temperature || temperature > acc.max_temperature) { errors = errors | 32u; }
  }
  if (errors != 0u) { gas_caloric_cells[row + 7u] = f32(errors); return; }
  gas_caloric_cells[row] = acc.heat_capacity;
  gas_caloric_cells[row + 1u] = acc.centered_energy;
  gas_caloric_cells[row + 2u] = acc.anchor_temperature;
  gas_caloric_cells[row + 3u] = temperature;
  gas_caloric_cells[row + 4u] = acc.min_temperature;
  gas_caloric_cells[row + 5u] = acc.max_temperature;
  gas_caloric_cells[row + 6u] = f32(acc.member_count);
  gas_caloric_cells[row + 7u] = 1.0;
}
`;

export function decodeSphSpatialGasCaloricAdmissionRows(values) {
  if (!(values instanceof Float32Array) || values.length % 8 !== 0) {
    throw new TypeError('Caloric admission needs complete eight-float rows');
  }
  const cells = [];
  for (let offset = 0; offset < values.length; offset += 8) {
    const row = values.subarray(offset, offset + 8), ready = row[7] === 1;
    if (!Number.isInteger(row[7]) || row[7] < 0 || row[7] > 127
      || (row[7] !== 1 && (row[7] & 1) !== 0)
      || (ready && (!row.every(Number.isFinite) || !(row[0] > 0) || !(row[2] > 0)
        || !(row[4] > 0) || row[4] > row[5] || row[3] < row[4] || row[3] > row[5]
        || !Number.isInteger(row[6]) || row[6] < 1 || row[6] > 16777215))) {
      throw new TypeError('Malformed caloric admission result');
    }
    cells.push(Object.freeze({ cellIndex: offset / 8, ready, statusFlags: row[7],
      heatCapacityJPerK: ready ? row[0] : null, centeredEnergyJ: ready ? row[1] : null,
      anchorTemperatureK: ready ? row[2] : null, equilibriumTemperatureK: ready ? row[3] : null,
      minDomainTemperatureK: ready ? row[4] : null, maxDomainTemperatureK: ready ? row[5] : null,
      memberCount: ready ? row[6] : null, caloricClosureAdmitted: ready,
      exchangeIntervalAdmitted: false, scientificValidation: false }));
  }
  return Object.freeze(cells);
}
