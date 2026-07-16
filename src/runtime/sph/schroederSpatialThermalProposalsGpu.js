import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';
import {
  finalizeSchroederSpatialExactNearConsumerReceipt,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';

export const ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-proposal.v1';
export const ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-proposal-buffer.v1';
export const ULG_SCHROEDER_SPATIAL_THERMAL_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-thermal-evidence.v1';

export const SCHROEDER_SPATIAL_THERMAL_CONSUMER = Object.freeze({
  CONDUCTION: 'thermal-conduction',
  RADIATION: 'thermal-radiation'
});

export const SCHROEDER_SPATIAL_THERMAL_CONSUMERS = Object.freeze([
  Object.freeze({
    consumerId: SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
  }),
  Object.freeze({
    consumerId: SCHROEDER_SPATIAL_THERMAL_CONSUMER.RADIATION,
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
  })
]);

export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC = 0x5450_4831;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION = 1;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS = 16;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS = 4;
export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_FLOATS = 4;
export const SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS = 16;
export const SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS = 4;
export const SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS = 4;
export const SCHROEDER_SPATIAL_THERMAL_PARAMS_BYTES = 48;
export const SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES = 104;
export const SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL = 1;

export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'particleCount:u32',
  'rowWords:u32',
  'conductionInvalidCount:atomic<u32>',
  'radiationInvalidCount:atomic<u32>',
  'conductionSupportProfileId:u32',
  'radiationSupportProfileId:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'reserved:u32'
]);

export const SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT = Object.freeze([
  'conductionSpecificEnergyDeltaJPerKg:f32',
  'radiationSpecificEnergyDeltaJPerKg:f32',
  'neighborMinTemperatureK:f32',
  'neighborMaxTemperatureK:f32'
]);

export const SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT = Object.freeze([
  'sourceInvocationCount:atomic<u32>',
  'directoryAdmissionCount:atomic<u32>',
  'directoryRejectCount:atomic<u32>',
  'candidateVisitCount:atomic<u32>',
  'consumerMaskHitCount:atomic<u32>',
  'malformedTraversalCount:atomic<u32>',
  'proposalRowCount:atomic<u32>',
  'nonFiniteProposalCount:atomic<u32>',
  'evidenceMagic:u32',
  'supportProfileId:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'traversalCount:u32',
  'privateLookupBuildCount:u32',
  'fixedCandidateBuildCount:u32',
  'exhaustiveTraversalCount:u32'
]);

const THERMAL_EVIDENCE_MAGIC = 0x5448_4531;
const EXPECTATION_BYTES = 112;
const WORKGROUP_SIZE = 64;
const PAIR_CONDUCTION_RELAXATION_LIMIT = 0.25;
const PAIR_CONDUCTION_RATE_DEFAULT = 1500;
const STEFAN_BOLTZMANN_W_PER_M2_K4 = 5.670374419e-8;
const RADIATION_PAIR_RANGE_RADII = 4;

const GPU_BUFFER_USAGE = Object.freeze({
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
});

const thermalRuntimeByDevice = new WeakMap();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function exactU32(value, label, { positive = false } = {}) {
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

function positiveCapacity(value) {
  let capacity = 1;
  const target = exactU32(value, 'particleCount', { positive: true });
  while (capacity < target) capacity *= 2;
  return capacity;
}

function requireBuffer(device, buffer, label, minimumByteLength = 0) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  if (
    minimumByteLength > 0
    && Number.isFinite(Number(buffer.size))
    && Number(buffer.size) < minimumByteLength
  ) {
    throw new RangeError(`${label} is smaller than its declared thermal row count`);
  }
  return buffer;
}

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function destroyOnce(buffer) {
  let destroyed = false;
  return () => {
    if (destroyed) return false;
    destroyed = true;
    buffer?.destroy?.();
    return true;
  };
}

function clampPairEnergy({
  energyJ,
  temperatureK,
  otherTemperatureK,
  temperatureSlopeKdPerJPerKg,
  otherTemperatureSlopeKdPerJPerKg,
  massKg,
  otherMassKg
}) {
  if (energyJ === 0) return 0;
  const gapK = otherTemperatureK - temperatureK;
  if (gapK === 0 || Math.sign(energyJ) !== Math.sign(gapK)) return energyJ;
  const responsePerJ = temperatureSlopeKdPerJPerKg / Math.max(massKg, 1e-30)
    + otherTemperatureSlopeKdPerJPerKg / Math.max(otherMassKg, 1e-30);
  if (!(responsePerJ > 0)) return energyJ;
  const equalizingEnergyJ = Math.abs(gapK) / responsePerJ;
  return Math.sign(energyJ) * Math.min(
    Math.abs(energyJ),
    equalizingEnergyJ * PAIR_CONDUCTION_RELAXATION_LIMIT
  );
}

function radiativeViewAreaM2(radiusM, otherRadiusM, distanceM) {
  if (!(radiusM > 0) || !(otherRadiusM > 0)) return 0;
  const distanceSquared = Math.max(distanceM * distanceM, 1e-12);
  const geometric = Math.PI * radiusM * radiusM
    * (otherRadiusM * otherRadiusM) / (4 * distanceSquared);
  const contactLimit = Math.PI * Math.min(radiusM, otherRadiusM) ** 2;
  return Math.min(geometric, contactLimit);
}

/** Small manufactured-pair oracle only; never a production neighbor fallback. */
export function evaluateSchroederSpatialThermalPairProposal({
  distanceM,
  smoothingLengthM,
  radiusM,
  otherRadiusM,
  massKg,
  otherMassKg,
  temperatureK,
  otherTemperatureK,
  temperatureSlopeKdPerJPerKg,
  otherTemperatureSlopeKdPerJPerKg,
  emissivity = 0,
  otherEmissivity = 0,
  dtS,
  conductionRate = PAIR_CONDUCTION_RATE_DEFAULT
} = {}) {
  const distance = Math.max(0, finiteNumber(distanceM, 0));
  const selfMass = Math.max(1e-30, finiteNumber(massKg, 0));
  const otherMass = Math.max(1e-30, finiteNumber(otherMassKg, 0));
  const pairRadiiM = Math.max(0, finiteNumber(radiusM, 0))
    + Math.max(0, finiteNumber(otherRadiusM, 0));
  const conductionSupportM = Math.max(
    2 * Math.max(0, finiteNumber(smoothingLengthM, 0)),
    pairRadiiM
  );
  const radiationSupportM = RADIATION_PAIR_RANGE_RADII * pairRadiiM;
  let conductionEnergyJ = 0;
  let radiationEnergyJ = 0;
  if (conductionSupportM > 0 && distance < conductionSupportM) {
    const weight = 1 - distance / conductionSupportM;
    conductionEnergyJ = clampPairEnergy({
      energyJ: finiteNumber(conductionRate, 0)
        * (otherTemperatureK - temperatureK) * weight * finiteNumber(dtS, 0),
      temperatureK,
      otherTemperatureK,
      temperatureSlopeKdPerJPerKg,
      otherTemperatureSlopeKdPerJPerKg,
      massKg: selfMass,
      otherMassKg: otherMass
    });
  }
  if (
    radiationSupportM > 0
    && distance < radiationSupportM
    && emissivity > 0
    && otherEmissivity > 0
  ) {
    const viewAreaM2 = radiativeViewAreaM2(radiusM, otherRadiusM, distance);
    radiationEnergyJ = clampPairEnergy({
      energyJ: emissivity * otherEmissivity * STEFAN_BOLTZMANN_W_PER_M2_K4
        * (otherTemperatureK ** 4 - temperatureK ** 4)
        * viewAreaM2 * finiteNumber(dtS, 0),
      temperatureK,
      otherTemperatureK,
      temperatureSlopeKdPerJPerKg,
      otherTemperatureSlopeKdPerJPerKg,
      massKg: selfMass,
      otherMassKg: otherMass
    });
  }
  return Object.freeze({
    conductionSupportM,
    radiationSupportM,
    conductionEnergyJ,
    radiationEnergyJ,
    conductionSpecificEnergyDeltaJPerKg: conductionEnergyJ / selfMass,
    radiationSpecificEnergyDeltaJPerKg: radiationEnergyJ / selfMass,
    neighborMinTemperatureK: Math.min(temperatureK, otherTemperatureK),
    neighborMaxTemperatureK: Math.max(temperatureK, otherTemperatureK)
  });
}

function createThermalParamsArray({
  particleCount,
  materialCount,
  responseCount,
  dtS,
  smoothingLengthM,
  conductionRate
}) {
  const buffer = new ArrayBuffer(SCHROEDER_SPATIAL_THERMAL_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setUint32(4, exactU32(materialCount, 'materialCount'), true);
  view.setUint32(8, exactU32(responseCount, 'responseCount'), true);
  view.setUint32(12, SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1, true);
  view.setUint32(16, SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1, true);
  view.setUint32(20, 0, true);
  view.setFloat32(24, finiteNumber(dtS, 0), true);
  view.setFloat32(28, Math.max(0, finiteNumber(smoothingLengthM, 0)), true);
  view.setFloat32(32, Math.max(0, finiteNumber(conductionRate, 0)), true);
  view.setFloat32(36, RADIATION_PAIR_RANGE_RADII, true);
  view.setFloat32(40, STEFAN_BOLTZMANN_W_PER_M2_K4, true);
  view.setUint32(44, 0, true);
  return buffer;
}

function createProposalHeader(execution, particleCount) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS);
  words[0] = SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC;
  words[1] = SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION;
  words[2] = exactU32(execution.generationId, 'execution.generationId', { positive: true });
  words[3] = exactU32(execution.supportEpoch, 'execution.supportEpoch');
  words[4] = exactU32(particleCount, 'particleCount', { positive: true });
  words[5] = SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS;
  words[8] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1;
  words[9] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1;
  words[10] = exactU32(execution.positionEpoch, 'execution.positionEpoch');
  words[11] = exactU32(execution.topologyEpoch, 'execution.topologyEpoch');
  words[12] = exactU32(execution.storageGeneration, 'execution.storageGeneration', {
    positive: true
  });
  words[13] = exactU32(execution.physicsTick, 'execution.physicsTick');
  words[14] = exactU32(execution.physicsSubstep, 'execution.physicsSubstep');
  return words;
}

function createEvidenceInitial(execution, supportProfileId) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS);
  words[8] = THERMAL_EVIDENCE_MAGIC;
  words[9] = supportProfileId;
  words[10] = execution.generationId;
  words[11] = execution.supportEpoch;
  words[12] = 1;
  return words;
}

function proposalBufferByteLength(capacity) {
  return (
    SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS
    + capacity * SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
  ) * Uint32Array.BYTES_PER_ELEMENT;
}

function derivedBufferByteLength(capacity) {
  return (
    SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS
    + capacity * SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS
  ) * Uint32Array.BYTES_PER_ELEMENT;
}

function createRuntimeEntry(device, arenaIndex, spatialCapacity, capacity) {
  const buffers = {
    derivedBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-derived-${spatialCapacity}-arena-${arenaIndex}`,
      derivedBufferByteLength(capacity),
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    ),
    proposalBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-proposals-${spatialCapacity}-arena-${arenaIndex}`,
      proposalBufferByteLength(capacity),
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    conductionEvidenceBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-conduction-evidence-${spatialCapacity}-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    radiationEvidenceBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-radiation-evidence-${spatialCapacity}-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    ),
    conductionExpectationBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-conduction-expectation-${spatialCapacity}-arena-${arenaIndex}`,
      EXPECTATION_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    radiationExpectationBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-radiation-expectation-${spatialCapacity}-arena-${arenaIndex}`,
      EXPECTATION_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    ),
    paramsBuffer: createBuffer(
      device,
      `ulg-schroeder-spatial-thermal-params-${spatialCapacity}-arena-${arenaIndex}`,
      SCHROEDER_SPATIAL_THERMAL_PARAMS_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    )
  };
  return {
    arenaIndex,
    spatialCapacity,
    capacity,
    buffers,
    destroyers: Object.values(buffers).map(destroyOnce),
    inUseGenerationId: null,
    releaseScheduled: false
  };
}

function acquireRuntimeEntry(device, execution, particleCount) {
  const arenaIndex = exactU32(execution.arenaIndex, 'execution.arenaIndex');
  const spatialCapacity = exactU32(
    execution.sourceCapacity,
    'execution.sourceCapacity',
    { positive: true }
  );
  const entryKey = `${spatialCapacity}:${arenaIndex}`;
  const capacity = positiveCapacity(particleCount);
  let runtime = thermalRuntimeByDevice.get(device);
  if (!runtime) {
    runtime = { entries: new Map(), allocationCount: 0 };
    thermalRuntimeByDevice.set(device, runtime);
  }
  let entry = runtime.entries.get(entryKey) || null;
  let cacheHit = Boolean(entry && entry.capacity >= capacity);
  if (entry?.inUseGenerationId != null) {
    throw new Error(
      `Thermal proposal arena ${arenaIndex} is still leased by generation ${entry.inUseGenerationId}`
    );
  }
  if (!entry || entry.capacity < capacity) {
    if (entry) for (const destroy of entry.destroyers) destroy();
    entry = createRuntimeEntry(device, arenaIndex, spatialCapacity, capacity);
    runtime.entries.set(entryKey, entry);
    runtime.allocationCount += Object.keys(entry.buffers).length;
    cacheHit = false;
  }
  entry.inUseGenerationId = execution.generationId;
  entry.releaseScheduled = false;
  return { runtime, entry, cacheHit };
}

export function destroySchroederSpatialThermalProposalRuntime(device, {
  force = false
} = {}) {
  const runtime = thermalRuntimeByDevice.get(device);
  if (!runtime) return false;
  const active = [...runtime.entries.values()].filter(
    (entry) => entry.inUseGenerationId != null
  );
  if (active.length > 0 && !force) {
    throw new Error('Cannot destroy a thermal proposal runtime with active generation leases');
  }
  for (const entry of runtime.entries.values()) {
    for (const destroy of entry.destroyers) destroy();
  }
  thermalRuntimeByDevice.delete(device);
  return true;
}

export const schroederSpatialThermalDerivedPrepassWgsl = /* wgsl */ `
struct ThermalProposalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  conduction_support_profile_id: u32,
  radiation_support_profile_id: u32,
  _pad0: u32,
  dt_s: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  radiation_pair_range_radii: f32,
  stefan_boltzmann_w_per_m2_k4: f32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> thermal_derived: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> thermal_params: ThermalProposalParams;

fn thermal_prepass_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn thermal_prepass_response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn thermal_prepass_response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn thermal_prepass_graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn thermal_prepass_temperature_slope_from_graph(
  graph_index: u32,
  specific_internal_energy: f32
) -> f32 {
  let node1 = thermal_prepass_graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) { return 0.0; }
  let x = clamp(specific_internal_energy, node1.z, node1.w);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (
    var index = sample_offset;
    index + 1u < sample_offset + sample_count;
    index = index + 1u
  ) {
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
  if (right.x == left.x) { return 0.0; }
  return (right.y - left.y) / (right.x - left.x);
}

fn thermal_prepass_temperature_slope(
  material_id: f32,
  specific_internal_energy: f32
) -> f32 {
  var response_offset = 0u;
  var response_count = 0u;
  var found_material = false;
  for (
    var record_index = 0u;
    record_index < thermal_params.material_count;
    record_index = record_index + 1u
  ) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      response_offset = u32(max(record.y, 0.0));
      response_count = u32(max(record.z, 0.0));
      found_material = true;
      break;
    }
  }
  if (!found_material || response_count == 0u) { return 0.0; }
  var selected = response_offset;
  for (var local = 0u; local < response_count; local = local + 1u) {
    let candidate = response_offset + local;
    if (candidate >= thermal_params.response_count) { return 0.0; }
    let row1 = thermal_prepass_response_row1(candidate);
    selected = candidate;
    if (specific_internal_energy <= row1.y || local + 1u == response_count) {
      break;
    }
  }
  let response0 = thermal_prepass_response_row0(selected);
  if (response0.w != 1.0 || response0.z < 0.0) { return 0.0; }
  return thermal_prepass_temperature_slope_from_graph(
    u32(response0.z),
    specific_internal_energy
  );
}

fn thermal_prepass_emissivity(material_id: f32) -> f32 {
  for (
    var record_index = 0u;
    record_index < thermal_params.material_count;
    record_index = record_index + 1u
  ) {
    let record = phase_response_records[record_index * 2u];
    if (record.x == material_id) {
      return clamp(phase_response_records[record_index * 2u + 1u].x, 0.0, 1.0);
    }
  }
  return 0.0;
}

fn thermal_prepass_nominal_radius_m(mass_kg: f32, rest_density_kg_per_m3: f32) -> f32 {
  if (mass_kg <= 0.0 || rest_density_kg_per_m3 <= 0.0) { return 0.0; }
  return pow(0.238732414637843 * mass_kg / rest_density_kg_per_m3, 1.0 / 3.0);
}

@compute @workgroup_size(64)
fn derive(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= thermal_params.particle_count) { return; }
  let pos_mass = source_state[particle_index * 2u];
  let vel_u = source_state[particle_index * 2u + 1u];
  let thermo0 = source_thermo[particle_index * 3u];
  let temperature_k = thermo0.z;
  var temperature_slope = thermal_prepass_temperature_slope(thermo0.x, vel_u.w);
  var radius_m = thermal_prepass_nominal_radius_m(pos_mass.w, thermo0.w);
  var emissivity = thermal_prepass_emissivity(thermo0.x);
  if (
    !thermal_prepass_finite(temperature_k)
    || temperature_k < 0.0
    || !thermal_prepass_finite(temperature_slope)
    || !thermal_prepass_finite(radius_m)
    || !thermal_prepass_finite(emissivity)
  ) {
    atomicAdd(&thermal_derived[1u], 1u);
    temperature_slope = 0.0;
    radius_m = 0.0;
    emissivity = 0.0;
  }
  let row_offset = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u
    + particle_index * ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u;
  atomicStore(&thermal_derived[row_offset], bitcast<u32>(temperature_k));
  atomicStore(&thermal_derived[row_offset + 1u], bitcast<u32>(temperature_slope));
  atomicStore(&thermal_derived[row_offset + 2u], bitcast<u32>(radius_m));
  atomicStore(&thermal_derived[row_offset + 3u], bitcast<u32>(emissivity));
  if (radius_m > 0.0) {
    atomicMax(&thermal_derived[0u], bitcast<u32>(radius_m));
  }
  if (pos_mass.w > 0.0 && thermal_prepass_finite(temperature_k) && temperature_k >= 0.0) {
    let temperature_bits = bitcast<u32>(temperature_k);
    atomicMax(&thermal_derived[2u], temperature_bits);
    atomicMax(&thermal_derived[3u], ~temperature_bits);
  }
}
`;

const exactNearTraversalWgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});

export const schroederSpatialThermalProposalWgsl = /* wgsl */ `
struct ThermalProposalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  conduction_support_profile_id: u32,
  radiation_support_profile_id: u32,
  _pad0: u32,
  dt_s: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  radiation_pair_range_radii: f32,
  stefan_boltzmann_w_per_m2_k4: f32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> source_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> thermal_derived: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(3) var<storage, read_write> thermal_proposals: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> conduction_evidence: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> radiation_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> conduction_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(7) var<uniform> radiation_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(8) var<uniform> thermal_params: ThermalProposalParams;

${exactNearTraversalWgsl}

const THERMAL_PROPOSAL_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS}u;
const THERMAL_PROPOSAL_ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS}u;
const THERMAL_DERIVED_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_HEADER_WORDS}u;
const THERMAL_DERIVED_ROW_WORDS: u32 = ${SCHROEDER_SPATIAL_THERMAL_DERIVED_ROW_WORDS}u;
const THERMAL_PAIR_RELAXATION_LIMIT: f32 = 0.25;

fn thermal_derived_value(particle_index: u32, component: u32) -> f32 {
  let offset = THERMAL_DERIVED_HEADER_WORDS
    + particle_index * THERMAL_DERIVED_ROW_WORDS + component;
  return bitcast<f32>(atomicLoad(&thermal_derived[offset]));
}

fn thermal_pow4(value: f32) -> f32 {
  let squared = value * value;
  return squared * squared;
}

fn thermal_radiative_view_area_m2(
  radius_m: f32,
  other_radius_m: f32,
  distance_m: f32
) -> f32 {
  if (radius_m <= 0.0 || other_radius_m <= 0.0) { return 0.0; }
  let distance_squared = max(distance_m * distance_m, 1.0e-12);
  let geometric = 3.14159265359 * radius_m * radius_m
    * (other_radius_m * other_radius_m) / (4.0 * distance_squared);
  let contact_limit = 3.14159265359
    * min(radius_m, other_radius_m) * min(radius_m, other_radius_m);
  return min(geometric, contact_limit);
}

fn thermal_clamp_pair_energy(
  energy_j: f32,
  temperature_k: f32,
  other_temperature_k: f32,
  temperature_slope: f32,
  other_temperature_slope: f32,
  mass_kg: f32,
  other_mass_kg: f32
) -> f32 {
  if (energy_j == 0.0) { return 0.0; }
  let gap_k = other_temperature_k - temperature_k;
  if (gap_k == 0.0 || sign(energy_j) != sign(gap_k)) { return energy_j; }
  let response_per_j = temperature_slope / max(mass_kg, 1.0e-30)
    + other_temperature_slope / max(other_mass_kg, 1.0e-30);
  if (response_per_j <= 0.0) { return energy_j; }
  let equalizing_energy_j = abs(gap_k) / response_per_j;
  return sign(energy_j) * min(
    abs(energy_j),
    equalizing_energy_j * THERMAL_PAIR_RELAXATION_LIMIT
  );
}

fn thermal_mark_invalid(is_conduction: bool) {
  let header_index = select(7u, 6u, is_conduction);
  atomicAdd(&thermal_proposals[header_index], 1u);
}

fn thermal_increment_local(counter: ptr<function, u32>) -> bool {
  if (*counter == 0xffffffffu) { return false; }
  *counter = *counter + 1u;
  return true;
}

fn thermal_evidence_add(index: u32, count: u32, is_conduction: bool) -> u32 {
  if (is_conduction) {
    return atomicAdd(&conduction_evidence[index], count);
  }
  return atomicAdd(&radiation_evidence[index], count);
}

fn thermal_flush_evidence(index: u32, count: u32, is_conduction: bool) -> bool {
  if (count == 0u) { return true; }
  let previous = thermal_evidence_add(index, count, is_conduction);
  return previous <= 0xffffffffu - count;
}

fn thermal_visit_fused_pair(
  self_index: u32,
  other_index: u32,
  self_position: vec3<f32>,
  self_mass: f32,
  self_temperature: f32,
  self_temperature_slope: f32,
  self_radius_m: f32,
  self_emissivity: f32,
  conduction_specific_energy_delta: ptr<function, f32>,
  radiation_specific_energy_delta: ptr<function, f32>,
  neighbor_min_temperature: ptr<function, f32>,
  neighbor_max_temperature: ptr<function, f32>,
  conduction_candidate_visit_count: ptr<function, u32>,
  radiation_candidate_visit_count: ptr<function, u32>,
  conduction_mask_hit_count: ptr<function, u32>,
  radiation_mask_hit_count: ptr<function, u32>,
  local_count_overflow: ptr<function, bool>
) {
  if (other_index == self_index || other_index >= thermal_params.particle_count) { return; }
  let conduction_count_ready = thermal_increment_local(
    conduction_candidate_visit_count
  );
  let radiation_count_ready = thermal_increment_local(
    radiation_candidate_visit_count
  );
  if (!conduction_count_ready || !radiation_count_ready) {
    *local_count_overflow = true;
    return;
  }
  let other_pos_mass = source_state[other_index * 2u];
  if (other_pos_mass.w <= 0.0) { return; }
  let other_temperature = thermal_derived_value(other_index, 0u);
  let other_temperature_slope = thermal_derived_value(other_index, 1u);
  let other_radius_m = thermal_derived_value(other_index, 2u);
  let pair_radii_m = self_radius_m + other_radius_m;
  let distance_m = length(self_position - other_pos_mass.xyz);
  let conduction_support_m = max(
    2.0 * thermal_params.smoothing_length_m,
    pair_radii_m
  );
  let radiation_support_m = thermal_params.radiation_pair_range_radii
    * pair_radii_m;
  if (!ss_exact_near_finite(distance_m)) { return; }
  let conduction_hit = distance_m < conduction_support_m;
  let radiation_hit = distance_m < radiation_support_m;
  if (!conduction_hit && !radiation_hit) { return; }
  *neighbor_min_temperature = min(*neighbor_min_temperature, other_temperature);
  *neighbor_max_temperature = max(*neighbor_max_temperature, other_temperature);
  if (conduction_hit) {
    let weight = 1.0 - distance_m / conduction_support_m;
    let raw_energy_j = thermal_params.conduction_rate
      * (other_temperature - self_temperature) * weight * thermal_params.dt_s;
    let energy_j = thermal_clamp_pair_energy(
      raw_energy_j,
      self_temperature,
      other_temperature,
      self_temperature_slope,
      other_temperature_slope,
      self_mass,
      other_pos_mass.w
    );
    *conduction_specific_energy_delta = *conduction_specific_energy_delta
      + energy_j / self_mass;
    if (!thermal_increment_local(conduction_mask_hit_count)) {
      *local_count_overflow = true;
    }
  }
  if (radiation_hit) {
    if (!thermal_increment_local(radiation_mask_hit_count)) {
      *local_count_overflow = true;
    }
  }
  if (radiation_hit && self_emissivity > 0.0) {
    let other_emissivity = thermal_derived_value(other_index, 3u);
    if (other_emissivity > 0.0) {
      let view_area_m2 = thermal_radiative_view_area_m2(
        self_radius_m,
        other_radius_m,
        distance_m
      );
      let raw_energy_j = self_emissivity * other_emissivity
        * thermal_params.stefan_boltzmann_w_per_m2_k4
        * (thermal_pow4(other_temperature) - thermal_pow4(self_temperature))
        * view_area_m2 * thermal_params.dt_s;
      let energy_j = thermal_clamp_pair_energy(
        raw_energy_j,
        self_temperature,
        other_temperature,
        self_temperature_slope,
        other_temperature_slope,
        self_mass,
        other_pos_mass.w
      );
      *radiation_specific_energy_delta = *radiation_specific_energy_delta
        + energy_j / self_mass;
    }
  }
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= thermal_params.particle_count) { return; }
  thermal_evidence_add(0u, 1u, true);
  thermal_evidence_add(0u, 1u, false);
  let conduction_admitted = conduction_expectation.support_profile_id
      == thermal_params.conduction_support_profile_id
    && ss_exact_near_directory_admitted(conduction_expectation);
  let radiation_admitted = radiation_expectation.support_profile_id
      == thermal_params.radiation_support_profile_id
    && ss_exact_near_directory_admitted(radiation_expectation);
  if (!conduction_admitted) { thermal_evidence_add(2u, 1u, true); }
  if (!radiation_admitted) { thermal_evidence_add(2u, 1u, false); }
  if (!conduction_admitted || !radiation_admitted) {
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  if (atomicLoad(&thermal_derived[1u]) != 0u) {
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  thermal_evidence_add(1u, 1u, true);
  thermal_evidence_add(1u, 1u, false);
  let self_pos_mass = source_state[particle_index * 2u];
  let self_temperature = thermal_derived_value(particle_index, 0u);
  let row_offset = THERMAL_PROPOSAL_HEADER_WORDS
    + particle_index * THERMAL_PROPOSAL_ROW_WORDS;
  if (self_pos_mass.w <= 0.0) {
    atomicStore(&thermal_proposals[row_offset], 0u);
    atomicStore(&thermal_proposals[row_offset + 1u], 0u);
    atomicStore(&thermal_proposals[row_offset + 2u], bitcast<u32>(self_temperature));
    atomicStore(&thermal_proposals[row_offset + 3u], bitcast<u32>(self_temperature));
    thermal_evidence_add(6u, 1u, true);
    thermal_evidence_add(6u, 1u, false);
    return;
  }
  let self_mass = max(self_pos_mass.w, 1.0e-30);
  let self_temperature_slope = thermal_derived_value(particle_index, 1u);
  let self_radius_m = thermal_derived_value(particle_index, 2u);
  let self_emissivity = thermal_derived_value(particle_index, 3u);
  let global_max_temperature_bits = atomicLoad(&thermal_derived[2u]);
  let global_min_temperature_bits = ~atomicLoad(&thermal_derived[3u]);
  if (global_max_temperature_bits == global_min_temperature_bits) {
    atomicStore(&thermal_proposals[row_offset], 0u);
    atomicStore(&thermal_proposals[row_offset + 1u], 0u);
    atomicStore(&thermal_proposals[row_offset + 2u], global_min_temperature_bits);
    atomicStore(&thermal_proposals[row_offset + 3u], global_max_temperature_bits);
    thermal_evidence_add(6u, 1u, true);
    thermal_evidence_add(6u, 1u, false);
    return;
  }
  let global_max_radius_m = bitcast<f32>(atomicLoad(&thermal_derived[0u]));
  let conduction_query_radius_m = max(
    2.0 * thermal_params.smoothing_length_m,
    self_radius_m + global_max_radius_m
  );
  let radiation_query_radius_m = thermal_params.radiation_pair_range_radii
    * (self_radius_m + global_max_radius_m);
  let query_radius_m = max(conduction_query_radius_m, radiation_query_radius_m);
  if (!ss_exact_near_finite(query_radius_m) || query_radius_m <= 0.0) {
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  var conduction_specific_energy_delta = 0.0;
  var radiation_specific_energy_delta = 0.0;
  var neighbor_min_temperature = self_temperature;
  var neighbor_max_temperature = self_temperature;
  var conduction_candidate_visit_count = 0u;
  var radiation_candidate_visit_count = 0u;
  var conduction_mask_hit_count = 0u;
  var radiation_mask_hit_count = 0u;
  var local_count_overflow = false;
  var malformed = false;
  for (
    var level_ordinal = 0u;
    level_ordinal < conduction_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(conduction_expectation, level_ordinal)) {
      continue;
    }
    let level = conduction_expectation.min_level + i32(level_ordinal);
    let spacing_m = conduction_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(self_pos_mass.xyz / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(query_radius_m / spacing_m), 2147483520.0))
    );
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
      conduction_expectation,
      conduction_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      conduction_expectation,
      conduction_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      conduction_expectation,
      conduction_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < conduction_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(conduction_expectation, x_cursor, 2u);
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        conduction_expectation,
        conduction_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) { malformed = true; break; }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        conduction_expectation,
        conduction_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < conduction_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(conduction_expectation, y_cursor, 3u);
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          conduction_expectation,
          conduction_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) { malformed = true; break; }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          conduction_expectation,
          conduction_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          conduction_expectation,
          conduction_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let member_range = ss_exact_near_cell_member_range(
            conduction_expectation,
            cell_index
          );
          if (member_range.admitted == 0u) { malformed = true; break; }
          for (
            var member_offset = member_range.begin;
            member_offset < member_range.end;
            member_offset = member_offset + 1u
          ) {
            let lookup = ss_exact_near_source_at_member(
              conduction_expectation,
              member_offset
            );
            if (lookup.admitted == 0u) { malformed = true; break; }
            thermal_visit_fused_pair(
              particle_index,
              lookup.source_index,
              self_pos_mass.xyz,
              self_mass,
              self_temperature,
              self_temperature_slope,
              self_radius_m,
              self_emissivity,
              &conduction_specific_energy_delta,
              &radiation_specific_energy_delta,
              &neighbor_min_temperature,
              &neighbor_max_temperature,
              &conduction_candidate_visit_count,
              &radiation_candidate_visit_count,
              &conduction_mask_hit_count,
              &radiation_mask_hit_count,
              &local_count_overflow
            );
          }
          if (malformed) { break; }
        }
        if (malformed) { break; }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) { malformed = true; break; }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) { malformed = true; break; }
  }
  let conduction_candidate_count_admitted = thermal_flush_evidence(
    3u, conduction_candidate_visit_count, true
  );
  let radiation_candidate_count_admitted = thermal_flush_evidence(
    3u, radiation_candidate_visit_count, false
  );
  let conduction_mask_hit_count_admitted = thermal_flush_evidence(
    4u, conduction_mask_hit_count, true
  );
  let radiation_mask_hit_count_admitted = thermal_flush_evidence(
    4u, radiation_mask_hit_count, false
  );
  if (
    local_count_overflow
    || !conduction_candidate_count_admitted
    || !radiation_candidate_count_admitted
    || !conduction_mask_hit_count_admitted
    || !radiation_mask_hit_count_admitted
  ) {
    malformed = true;
  }
  if (malformed) {
    thermal_evidence_add(5u, 1u, true);
    thermal_evidence_add(5u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  if (
    !ss_exact_near_finite(conduction_specific_energy_delta)
    || !ss_exact_near_finite(radiation_specific_energy_delta)
  ) {
    thermal_evidence_add(7u, 1u, true);
    thermal_evidence_add(7u, 1u, false);
    thermal_mark_invalid(true);
    thermal_mark_invalid(false);
    return;
  }
  atomicStore(
    &thermal_proposals[row_offset],
    bitcast<u32>(conduction_specific_energy_delta)
  );
  atomicStore(
    &thermal_proposals[row_offset + 1u],
    bitcast<u32>(radiation_specific_energy_delta)
  );
  atomicStore(
    &thermal_proposals[row_offset + 2u],
    bitcast<u32>(neighbor_min_temperature)
  );
  atomicStore(
    &thermal_proposals[row_offset + 3u],
    bitcast<u32>(neighbor_max_temperature)
  );
  thermal_evidence_add(6u, 1u, true);
  thermal_evidence_add(6u, 1u, false);
}
`;

function resolveThermalResponseUpload(device, upload) {
  if (
    upload?.schema !== ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
    || upload.status !== 'webgpu-uploaded'
    || upload.destroyed === true
  ) {
    throw new TypeError(
      'Canonical thermal proposals require one live SPH thermal response/graph upload'
    );
  }
  const materialCount = exactU32(upload.materialCount, 'thermalResponseGraphUpload.materialCount');
  const responseCount = exactU32(upload.responseCount, 'thermalResponseGraphUpload.responseCount');
  return Object.freeze({
    materialCount,
    responseCount,
    responseRecordBuffer: requireBuffer(
      device,
      upload.responseRecordBuffer,
      'thermalResponseGraphUpload.responseRecordBuffer',
      materialCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT
    ),
    responseBuffer: requireBuffer(
      device,
      upload.responseBuffer,
      'thermalResponseGraphUpload.responseBuffer',
      responseCount * 4 * 4 * Float32Array.BYTES_PER_ELEMENT
    ),
    graphNodeBuffer: requireBuffer(
      device,
      upload.graphNodeBuffer,
      'thermalResponseGraphUpload.graphNodeBuffer'
    ),
    graphSampleBuffer: requireBuffer(
      device,
      upload.graphSampleBuffer,
      'thermalResponseGraphUpload.graphSampleBuffer'
    )
  });
}

function authenticateThermalConsumers(device, generation) {
  return SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(
    ({ consumerId, supportProfileId }) => {
      const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
        generation,
        {
          device,
          runtime: generation?.runtime,
          consumerId,
          supportProfileId,
          sourceBuffer: generation?.source?.activeNodeBuffer
        }
      );
      if (authentication?.ready !== true || authentication.authenticated !== true) {
        const error = new Error(
          authentication?.reason
          || `Canonical spatial thermal consumer ${consumerId} was not authenticated`
        );
        error.code = 'ERR_SCHROEDER_SPATIAL_THERMAL_AUTHENTICATION';
        throw error;
      }
      return authentication;
    }
  );
}

function createThermalGpuEvidence({
  authentication,
  evidenceBuffer,
  particleCount
}) {
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_GPU_EVIDENCE_SCHEMA,
    status: 'schroeder-spatial-exact-near-gpu-authenticated',
    gpuAuthenticated: true,
    consumerId: authentication.consumerId,
    supportProfileId: authentication.supportProfileId,
    generationId: authentication.generationId,
    epochIdentity: authentication.epochIdentity,
    traversalCount: 1,
    candidateVisitCount: 0,
    consumerMaskHitCount: 0,
    migratedProposalCount: particleCount,
    candidateBytesRequired: 0,
    candidateBytesAdmitted: 0,
    candidateBytesCapacity: 0,
    candidateOverflowBytes: 0,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    overflowed: false,
    partialPublication: false,
    fallbackObserved: false,
    fullReadbackPerformed: false,
    evidenceBuffer,
    evidenceSchema: ULG_SCHROEDER_SPATIAL_THERMAL_EVIDENCE_SCHEMA,
    evidenceWordCount: SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS,
    counterValuesResident: true,
    malformedDirectoryApplyGuard: 'proposal-header-invalid-count-must-equal-zero'
  });
}

/**
 * Submit two independent direct exact-near traversals against immutable x_n.
 * The device/arena cache owns every output buffer; callers release the arena
 * lease after the canonical thermal apply submission and destroy the cache
 * only with destroySchroederSpatialThermalProposalRuntime.
 */
export function runSchroederSpatialThermalProposalWebGpu({
  device,
  generation,
  sphParticleState,
  sphParticleUpload,
  thermalResponseGraphUpload,
  dtS = 0,
  smoothingLengthM = sphParticleState?.smoothingLengthM ?? 0,
  conductionRate = PAIR_CONDUCTION_RATE_DEFAULT
} = {}) {
  if (!device?.createBuffer || !device?.createCommandEncoder || !device.queue?.writeBuffer) {
    throw new TypeError('Canonical thermal proposals require a WebGPU-like device');
  }
  const particleCount = exactU32(
    sphParticleState?.particleCount,
    'sphParticleState.particleCount',
    { positive: true }
  );
  if (generation?.source?.sourceCount !== particleCount) {
    throw new RangeError(
      'Canonical thermal proposal particle count must match the frozen spatial source count'
    );
  }
  const stateBuffer = requireBuffer(
    device,
    sphParticleUpload?.stateBuffer,
    'sphParticleUpload.stateBuffer',
    particleCount * 2 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const thermoBuffer = requireBuffer(
    device,
    sphParticleUpload?.thermoBuffer,
    'sphParticleUpload.thermoBuffer',
    particleCount * 3 * 4 * Float32Array.BYTES_PER_ELEMENT
  );
  const responseUpload = resolveThermalResponseUpload(device, thermalResponseGraphUpload);
  const authentications = authenticateThermalConsumers(device, generation);
  const conductionAuthentication = authentications[0];
  const radiationAuthentication = authentications[1];
  const execution = generation.execution;
  const { runtime, entry, cacheHit } = acquireRuntimeEntry(
    device,
    execution,
    particleCount
  );
  const {
    derivedBuffer,
    proposalBuffer,
    conductionEvidenceBuffer,
    radiationEvidenceBuffer,
    conductionExpectationBuffer,
    radiationExpectationBuffer,
    paramsBuffer
  } = entry.buffers;

  try {

  device.queue.writeBuffer(
    proposalBuffer,
    0,
    createProposalHeader(execution, particleCount)
  );
  device.queue.writeBuffer(
    conductionEvidenceBuffer,
    0,
    createEvidenceInitial(
      execution,
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_THERMAL_CONDUCTION_V1
    )
  );
  device.queue.writeBuffer(
    radiationEvidenceBuffer,
    0,
    createEvidenceInitial(
      execution,
      SCHROEDER_SPATIAL_SUPPORT_PROFILE_RADIATION_WIDE_V1
    )
  );
  device.queue.writeBuffer(
    conductionExpectationBuffer,
    0,
    conductionAuthentication.expectationData
  );
  device.queue.writeBuffer(
    radiationExpectationBuffer,
    0,
    radiationAuthentication.expectationData
  );
  device.queue.writeBuffer(paramsBuffer, 0, createThermalParamsArray({
    particleCount,
    materialCount: responseUpload.materialCount,
    responseCount: responseUpload.responseCount,
    dtS,
    smoothingLengthM,
    conductionRate
  }));

  const derivedPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-derived-prepass.v1',
    label: 'ulg-schroeder-spatial-thermal-derived-prepass',
    code: schroederSpatialThermalDerivedPrepassWgsl,
    entryPoint: 'derive',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'uniform')
    ]
  });
  const proposalPipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-schroeder-spatial-thermal-fused-proposal.v2',
    label: 'ulg-schroeder-spatial-thermal-fused-proposal',
    code: schroederSpatialThermalProposalWgsl,
    entryPoint: 'propose',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'uniform'),
      computeBufferBinding(7, 'uniform'),
      computeBufferBinding(8, 'uniform')
    ]
  });
  const derivedBindGroup = device.createBindGroup({
    layout: derivedPipeline.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: responseUpload.responseRecordBuffer } },
      { binding: 3, resource: { buffer: responseUpload.responseBuffer } },
      { binding: 4, resource: { buffer: responseUpload.graphNodeBuffer } },
      { binding: 5, resource: { buffer: responseUpload.graphSampleBuffer } },
      { binding: 6, resource: { buffer: derivedBuffer } },
      { binding: 7, resource: { buffer: paramsBuffer } }
    ]
  });
  const proposalBindGroup = device.createBindGroup({
    layout: proposalPipeline.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: derivedBuffer } },
      { binding: 2, resource: { buffer: execution.directoryBuffer } },
      { binding: 3, resource: { buffer: proposalBuffer } },
      { binding: 4, resource: { buffer: conductionEvidenceBuffer } },
      { binding: 5, resource: { buffer: radiationEvidenceBuffer } },
      { binding: 6, resource: { buffer: conductionExpectationBuffer } },
      { binding: 7, resource: { buffer: radiationExpectationBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } }
    ]
  });
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  const encoder = device.createCommandEncoder({
    label: 'ulg-schroeder-spatial-thermal-proposals'
  });
  encoder.clearBuffer(derivedBuffer, 0, derivedBufferByteLength(entry.capacity));
  encoder.clearBuffer(
    proposalBuffer,
    SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    particleCount * SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS
      * Uint32Array.BYTES_PER_ELEMENT
  );
  const derivedPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-thermal-derived-prepass'
  });
  derivedPass.setPipeline(derivedPipeline.pipeline);
  derivedPass.setBindGroup(0, derivedBindGroup);
  derivedPass.dispatchWorkgroups(workgroups);
  derivedPass.end();
  const proposalPass = encoder.beginComputePass({
    label: 'ulg-schroeder-spatial-thermal-fused-conduction-radiation-proposal'
  });
  proposalPass.setPipeline(proposalPipeline.pipeline);
  proposalPass.setBindGroup(0, proposalBindGroup);
  proposalPass.dispatchWorkgroups(workgroups);
  proposalPass.end();
  device.queue.submit([encoder.finish()]);

  const gpuEvidenceByConsumer = Object.freeze({
    [SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION]: createThermalGpuEvidence({
      authentication: conductionAuthentication,
      evidenceBuffer: conductionEvidenceBuffer,
      particleCount
    }),
    [SCHROEDER_SPATIAL_THERMAL_CONSUMER.RADIATION]: createThermalGpuEvidence({
      authentication: radiationAuthentication,
      evidenceBuffer: radiationEvidenceBuffer,
      particleCount
    })
  });
  const consumerReceipts = Object.freeze(Object.fromEntries(
    authentications.map((authentication) => [
      authentication.consumerId,
      finalizeSchroederSpatialExactNearConsumerReceipt(
        authentication,
        gpuEvidenceByConsumer[authentication.consumerId]
      )
    ])
  ));

  let released = false;
  const releaseLease = () => {
    if (released) return false;
    released = true;
    entry.inUseGenerationId = null;
    entry.releaseScheduled = false;
    return true;
  };
  const releaseAfterCanonicalApplySubmittedWork = () => {
    if (released || entry.releaseScheduled) return false;
    entry.releaseScheduled = true;
    deferSubmittedWorkCleanup(device, releaseLease);
    return true;
  };

  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_SCHEMA,
    status: 'schroeder-spatial-thermal-proposals-submitted',
    ready: true,
    backend: 'webgpu',
    particleCount,
    generation,
    generationId: execution.generationId,
    supportEpoch: execution.supportEpoch,
    arenaIndex: execution.arenaIndex,
    sourcePositionAuthority: 'same-epoch-pre-integration-particle-state',
    supportProfiles: SCHROEDER_SPATIAL_THERMAL_CONSUMERS,
    traversalCount: 1,
    traversalCountPerConsumer: 1,
    sharedTraversalConsumerCount: 2,
    proposalBuffer,
    thermalConductionProposalBuffer: proposalBuffer,
    thermalRadiationProposalBuffer: proposalBuffer,
    proposalBufferSchema: ULG_SCHROEDER_SPATIAL_THERMAL_PROPOSAL_BUFFER_SCHEMA,
    proposalHeaderWords: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS,
    proposalRowWords: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_WORDS,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_FLOATS,
    proposalBufferByteLength: proposalBufferByteLength(entry.capacity),
    activeProposalByteLength: proposalBufferByteLength(particleCount),
    proposalRowByteOffset:
      SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    proposalRowLayout: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_ROW_LAYOUT,
    proposalHeaderLayout: SCHROEDER_SPATIAL_THERMAL_PROPOSAL_HEADER_LAYOUT,
    conductionEvidenceBuffer,
    radiationEvidenceBuffer,
    evidenceSchema: ULG_SCHROEDER_SPATIAL_THERMAL_EVIDENCE_SCHEMA,
    evidenceLayout: SCHROEDER_SPATIAL_THERMAL_EVIDENCE_LAYOUT,
    evidenceWordCount: SCHROEDER_SPATIAL_THERMAL_EVIDENCE_WORDS,
    consumerAuthentications: Object.freeze([...authentications]),
    consumerReceipts,
    consumerReceipt(consumerId) {
      return consumerReceipts[consumerId] ?? null;
    },
    gpuEvidenceByConsumer,
    artifactDescriptors: Object.freeze({
      [SCHROEDER_SPATIAL_THERMAL_CONSUMER.CONDUCTION]: Object.freeze({
        spatialEpochGenerationId: execution.generationId,
        thermalConductionProposalBuffer: proposalBuffer,
        consumerReceiptBuffer: conductionEvidenceBuffer,
        owned: false,
        owner: 'schroeder-spatial-thermal-device-arena-cache'
      }),
      [SCHROEDER_SPATIAL_THERMAL_CONSUMER.RADIATION]: Object.freeze({
        spatialEpochGenerationId: execution.generationId,
        thermalRadiationProposalBuffer: proposalBuffer,
        consumerReceiptBuffer: radiationEvidenceBuffer,
        owned: false,
        owner: 'schroeder-spatial-thermal-device-arena-cache'
      })
    }),
    canonicalApplyMode: Object.freeze({
      status: 'thermal-canonical-proposal-apply-ready',
      replacesLegacyNeighborBinding: 10,
      paramsSentinelOffsetBytes: SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_OFFSET_BYTES,
      paramsSentinelValue: SCHROEDER_SPATIAL_THERMAL_CANONICAL_PARAMS_SENTINEL,
      invalidHeaderWordIndices: Object.freeze([6, 7]),
      completeSetPolicy: 'both-invalid-counts-zero-or-apply-no-rows',
      specificEnergyDeltaPolicy:
        'clamp-conduction-plus-radiation-to-neighbor-temperature-range-before-wall-and-ambient-laws'
    }),
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: 1,
    privateBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    candidateBudget: null,
    fullParticleReadbackPerformed: false,
    readbackMode: 'no-full-readback',
    bufferOwnership: 'device-arena-runtime-cache',
    ownsProposalBuffer: false,
    ownsEvidenceBuffers: false,
    runtimeCacheHit: cacheHit,
    runtimeCapacity: entry.capacity,
    spatialRuntimeCapacity: entry.spatialCapacity,
    runtimeAllocationCount: runtime.allocationCount,
    releaseAfterCanonicalApplySubmittedWork,
    get released() { return released; }
  });
  } catch (error) {
    entry.inUseGenerationId = null;
    entry.releaseScheduled = false;
    throw error;
  }
}
