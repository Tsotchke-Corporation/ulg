export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_SCHEMA =
  'peercompute.ulg.sph-authoritative-gpu-material-phase-checkpoint.v1';
export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_CAPTURE_SCHEMA =
  'peercompute.ulg.sph-authoritative-gpu-checkpoint-capture.v1';
export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_REDUCTION_SCHEMA =
  'peercompute.ulg.sph-authoritative-gpu-material-phase-reduction.v0';

export const SPH_CHECKPOINT_STATE_STRIDE_FLOATS = 8;
export const SPH_CHECKPOINT_THERMO_STRIDE_FLOATS = 12;
export const SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY = 64;
export const SPH_CHECKPOINT_GLOBAL_WORDS = 16;
export const SPH_CHECKPOINT_BUCKET_WORDS = 20;

export const SPH_CHECKPOINT_GLOBAL_WORD = Object.freeze({
  liveParticleCount: 0,
  nonPositiveMassParticleCount: 1,
  invalidMassParticleCount: 2,
  materialPhaseCount: 3,
  phaseContributionCount: 4,
  overflowContributionCount: 5,
  totalMassKg: 6,
  internalEnergyJ: 7,
  kineticEnergyJ: 8,
  overflowMassKg: 9,
  processedParticleCount: 10,
  phaseFractionProblemParticleCount: 11,
  phaseFractionFallbackParticleCount: 12,
  maxPhaseFractionResidual: 13,
  phaseFractionResidualAbsKg: 14,
  unclassifiedMassKg: 15
});

export const SPH_CHECKPOINT_BUCKET_WORD = Object.freeze({
  key: 0,
  materialId: 1,
  phaseId: 2,
  liveParticleCount: 3,
  phaseWeightedParticleCount: 4,
  massKg: 5,
  yMinM: 6,
  yMaxM: 7,
  massWeightedYSumKgM: 8,
  ySampleMassKg: 9,
  temperatureSampleCount: 10,
  temperatureSumK: 11,
  temperatureMassWeightedSumKgK: 12,
  temperatureSampleMassKg: 13,
  temperatureMinK: 14,
  temperatureMaxK: 15,
  internalEnergyJ: 16,
  internalEnergySampleMassKg: 17,
  kineticEnergyJ: 18,
  kineticEnergySampleMassKg: 19
});

const PHASE_BY_ID = Object.freeze({
  0: 'unknown',
  1: 'solid',
  2: 'liquid',
  3: 'gas',
  4: 'plasma'
});

const pipelineByDevice = new WeakMap();

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function stableHashMaterialId(material) {
  let hash = 0x811c9dc5;
  for (const ch of String(material || 'unknown').toLowerCase()) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 1000 + (hash % 8_000_000);
}

function materialKey(value) {
  const key = String(value || '').trim();
  return key || null;
}

function floatWord(value) {
  const row = new Float32Array(1);
  row[0] = value;
  return new Uint32Array(row.buffer)[0];
}

function wordFloat(value) {
  const row = new Uint32Array(1);
  row[0] = value >>> 0;
  return new Float32Array(row.buffer)[0];
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function materialKeyByIdFromSphViewState(viewState = null) {
  const byId = {};
  const properties = viewState?.materialProperties || {};

  for (const key of Object.keys(properties)) {
    const material = materialKey(key);
    if (material) byId[stableHashMaterialId(material)] = material;
  }

  const metadata = viewState?.sphGpuParticleState?.metadata || [];
  for (const row of metadata) {
    const id = Math.round(Number(row?.materialId));
    const material = materialKey(row?.material);
    if (Number.isFinite(id) && id > 0 && material) byId[id] = material;
  }

  for (const reaction of viewState?.reactions || []) {
    const keys = [
      reaction?.product,
      ...(reaction?.stoichiometry?.products || []).flatMap((term) => [term?.material, term?.formula])
    ];
    for (const value of keys) {
      const material = materialKey(value)?.toLowerCase() || null;
      if (material) byId[stableHashMaterialId(material)] = material;
    }
  }

  return byId;
}

export function createAuthoritativeGpuEvidenceWords(
  bucketCapacity = SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY
) {
  const capacity = positiveInteger(bucketCapacity, SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY);
  const words = new Uint32Array(
    SPH_CHECKPOINT_GLOBAL_WORDS + capacity * SPH_CHECKPOINT_BUCKET_WORDS
  );
  const positiveInfinity = floatWord(Infinity);
  const negativeInfinity = floatWord(-Infinity);
  for (let bucketIndex = 0; bucketIndex < capacity; bucketIndex += 1) {
    const offset = SPH_CHECKPOINT_GLOBAL_WORDS + bucketIndex * SPH_CHECKPOINT_BUCKET_WORDS;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.yMinM] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.yMaxM] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.temperatureMinK] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.temperatureMaxK] = negativeInfinity;
  }
  return words;
}

export function decodeAuthoritativeGpuEvidence({
  words,
  bucketCapacity = SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY,
  particleCount = null,
  stateStrideFloats = SPH_CHECKPOINT_STATE_STRIDE_FLOATS,
  thermoStrideFloats = SPH_CHECKPOINT_THERMO_STRIDE_FLOATS,
  materialKeyById = {}
} = {}) {
  if (!(words instanceof Uint32Array)) {
    throw new TypeError('authoritative GPU checkpoint evidence must be a Uint32Array');
  }
  const capacity = positiveInteger(bucketCapacity, SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY);
  const requiredWords = SPH_CHECKPOINT_GLOBAL_WORDS + capacity * SPH_CHECKPOINT_BUCKET_WORDS;
  if (words.length < requiredWords) {
    throw new RangeError(`authoritative GPU checkpoint evidence requires ${requiredWords} words`);
  }

  const global = SPH_CHECKPOINT_GLOBAL_WORD;
  const bucketWord = SPH_CHECKPOINT_BUCKET_WORD;
  const materialPhases = [];
  const unmappedMaterialIds = new Set();
  for (let bucketIndex = 0; bucketIndex < capacity; bucketIndex += 1) {
    const offset = SPH_CHECKPOINT_GLOBAL_WORDS + bucketIndex * SPH_CHECKPOINT_BUCKET_WORDS;
    if (words[offset + bucketWord.key] === 0) continue;
    const materialId = words[offset + bucketWord.materialId];
    const phaseId = words[offset + bucketWord.phaseId];
    const material = materialKeyById?.[materialId] || `material-${materialId}`;
    if (!materialKeyById?.[materialId]) unmappedMaterialIds.add(materialId);
    const massKg = wordFloat(words[offset + bucketWord.massKg]);
    const ySampleMassKg = wordFloat(words[offset + bucketWord.ySampleMassKg]);
    const temperatureSampleCount = words[offset + bucketWord.temperatureSampleCount];
    const temperatureSampleMassKg = wordFloat(words[offset + bucketWord.temperatureSampleMassKg]);
    materialPhases.push({
      material,
      materialId,
      phase: PHASE_BY_ID[phaseId] || `phase-${phaseId}`,
      phaseId,
      liveParticleCount: words[offset + bucketWord.liveParticleCount],
      phaseWeightedParticleCount: wordFloat(words[offset + bucketWord.phaseWeightedParticleCount]),
      massKg,
      yMinM: finiteOrNull(wordFloat(words[offset + bucketWord.yMinM])),
      yMaxM: finiteOrNull(wordFloat(words[offset + bucketWord.yMaxM])),
      yCenterMassWeightedM: ySampleMassKg > 0
        ? wordFloat(words[offset + bucketWord.massWeightedYSumKgM]) / ySampleMassKg
        : null,
      temperatureSampleCount,
      temperatureMinK: finiteOrNull(wordFloat(words[offset + bucketWord.temperatureMinK])),
      temperatureMeanK: temperatureSampleCount > 0
        ? wordFloat(words[offset + bucketWord.temperatureSumK]) / temperatureSampleCount
        : null,
      temperatureMassWeightedMeanK: temperatureSampleMassKg > 0
        ? wordFloat(words[offset + bucketWord.temperatureMassWeightedSumKgK]) / temperatureSampleMassKg
        : null,
      temperatureMaxK: finiteOrNull(wordFloat(words[offset + bucketWord.temperatureMaxK])),
      internalEnergyJ: wordFloat(words[offset + bucketWord.internalEnergyJ]),
      internalEnergySampleMassKg: wordFloat(words[offset + bucketWord.internalEnergySampleMassKg]),
      kineticEnergyJ: wordFloat(words[offset + bucketWord.kineticEnergyJ]),
      kineticEnergySampleMassKg: wordFloat(words[offset + bucketWord.kineticEnergySampleMassKg])
    });
  }
  materialPhases.sort((left, right) => (
    left.materialId - right.materialId || left.phaseId - right.phaseId
  ));

  const overflowContributionCount = words[global.overflowContributionCount];
  return {
    schema: SPH_AUTHORITATIVE_GPU_CHECKPOINT_REDUCTION_SCHEMA,
    status: 'gpu-reduced',
    backend: 'webgpu-compute',
    reductionStrategy: 'fixed-capacity-open-addressed-material-phase-table',
    particleCount: positiveInteger(particleCount, words[global.processedParticleCount]),
    processedParticleCount: words[global.processedParticleCount],
    liveParticleCount: words[global.liveParticleCount],
    nonPositiveMassParticleCount: words[global.nonPositiveMassParticleCount],
    invalidMassParticleCount: words[global.invalidMassParticleCount],
    phaseContributionCount: words[global.phaseContributionCount],
    phaseFractionProblemParticleCount: words[global.phaseFractionProblemParticleCount],
    phaseFractionFallbackParticleCount: words[global.phaseFractionFallbackParticleCount],
    maxPhaseFractionResidual: wordFloat(words[global.maxPhaseFractionResidual]),
    phaseFractionResidualAbsKg: wordFloat(words[global.phaseFractionResidualAbsKg]),
    unclassifiedMassKg: wordFloat(words[global.unclassifiedMassKg]),
    materialPhaseCount: materialPhases.length,
    materialPhaseClaimCount: words[global.materialPhaseCount],
    materialPhaseCapacity: capacity,
    materialPhaseCapacityStatus: overflowContributionCount > 0 ? 'overflow' : 'within-capacity',
    overflowContributionCount,
    overflowMassKg: wordFloat(words[global.overflowMassKg]),
    materialMappingStatus: unmappedMaterialIds.size > 0 ? 'unmapped-material-ids' : 'complete',
    unmappedMaterialIds: [...unmappedMaterialIds].sort((left, right) => left - right),
    stateStrideFloats,
    thermoStrideFloats,
    totals: {
      massKg: wordFloat(words[global.totalMassKg]),
      internalEnergyJ: wordFloat(words[global.internalEnergyJ]),
      kineticEnergyJ: wordFloat(words[global.kineticEnergyJ])
    },
    materialPhases
  };
}

export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL = /* wgsl */ `
struct Params {
  particle_count: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  bucket_capacity: u32,
};

struct MaterialPhaseBucket {
  key: atomic<u32>,
  material_id: atomic<u32>,
  phase_id: atomic<u32>,
  live_particle_count: atomic<u32>,
  phase_weighted_particle_count: atomic<u32>,
  mass_kg: atomic<u32>,
  y_min_m: atomic<u32>,
  y_max_m: atomic<u32>,
  mass_weighted_y_sum_kg_m: atomic<u32>,
  y_sample_mass_kg: atomic<u32>,
  temperature_sample_count: atomic<u32>,
  temperature_sum_k: atomic<u32>,
  temperature_mass_weighted_sum_kg_k: atomic<u32>,
  temperature_sample_mass_kg: atomic<u32>,
  temperature_min_k: atomic<u32>,
  temperature_max_k: atomic<u32>,
  internal_energy_j: atomic<u32>,
  internal_energy_sample_mass_kg: atomic<u32>,
  kinetic_energy_j: atomic<u32>,
  kinetic_energy_sample_mass_kg: atomic<u32>,
};

@group(0) @binding(0) var<storage, read> state_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> thermo_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> global_words: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> buckets: array<MaterialPhaseBucket>;
@group(0) @binding(4) var<uniform> params: Params;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn atomic_add_f32(cell: ptr<storage, atomic<u32>, read_write>, value: f32) {
  if (!finite_f32(value) || value == 0.0) { return; }
  var old_bits = atomicLoad(cell);
  loop {
    let next_bits = bitcast<u32>(bitcast<f32>(old_bits) + value);
    let exchange = atomicCompareExchangeWeak(cell, old_bits, next_bits);
    if (exchange.exchanged) { return; }
    old_bits = exchange.old_value;
  }
}

fn atomic_min_f32(cell: ptr<storage, atomic<u32>, read_write>, value: f32) {
  if (!finite_f32(value)) { return; }
  var old_bits = atomicLoad(cell);
  loop {
    if (value >= bitcast<f32>(old_bits)) { return; }
    let exchange = atomicCompareExchangeWeak(cell, old_bits, bitcast<u32>(value));
    if (exchange.exchanged) { return; }
    old_bits = exchange.old_value;
  }
}

fn atomic_max_f32(cell: ptr<storage, atomic<u32>, read_write>, value: f32) {
  if (!finite_f32(value)) { return; }
  var old_bits = atomicLoad(cell);
  loop {
    if (value <= bitcast<f32>(old_bits)) { return; }
    let exchange = atomicCompareExchangeWeak(cell, old_bits, bitcast<u32>(value));
    if (exchange.exchanged) { return; }
    old_bits = exchange.old_value;
  }
}

fn claim_bucket(material_id: u32, phase_id: u32) -> i32 {
  let packed_key = 1u + material_id * 8u + min(phase_id, 7u);
  let first_index = (packed_key * 2654435761u) % params.bucket_capacity;
  for (var probe = 0u; probe < params.bucket_capacity; probe = probe + 1u) {
    let bucket_index = (first_index + probe) % params.bucket_capacity;
    var observed = atomicLoad(&buckets[bucket_index].key);
    loop {
      if (observed == packed_key) { return i32(bucket_index); }
      if (observed != 0u) { break; }
      let exchange = atomicCompareExchangeWeak(&buckets[bucket_index].key, 0u, packed_key);
      if (exchange.exchanged) {
        atomicStore(&buckets[bucket_index].material_id, material_id);
        atomicStore(&buckets[bucket_index].phase_id, phase_id);
        atomicAdd(&global_words[3], 1u);
        return i32(bucket_index);
      }
      observed = exchange.old_value;
    }
  }
  return -1;
}

fn contribute_phase(
  material_id: u32,
  phase_id: u32,
  fraction: f32,
  mass_kg: f32,
  y_m: f32,
  temperature_k: f32,
  specific_internal_energy_j_per_kg: f32,
  velocity_m_per_s: vec3<f32>
) {
  if (!(fraction > 1e-8)) { return; }
  atomicAdd(&global_words[4], 1u);
  let contribution_mass_kg = mass_kg * fraction;
  let bucket_index = claim_bucket(material_id, phase_id);
  if (bucket_index < 0) {
    atomicAdd(&global_words[5], 1u);
    atomic_add_f32(&global_words[9], contribution_mass_kg);
    return;
  }
  let index = u32(bucket_index);
  atomicAdd(&buckets[index].live_particle_count, 1u);
  atomic_add_f32(&buckets[index].phase_weighted_particle_count, fraction);
  atomic_add_f32(&buckets[index].mass_kg, contribution_mass_kg);
  if (finite_f32(y_m)) {
    atomic_min_f32(&buckets[index].y_min_m, y_m);
    atomic_max_f32(&buckets[index].y_max_m, y_m);
    atomic_add_f32(&buckets[index].mass_weighted_y_sum_kg_m, contribution_mass_kg * y_m);
    atomic_add_f32(&buckets[index].y_sample_mass_kg, contribution_mass_kg);
  }
  if (finite_f32(temperature_k)) {
    atomicAdd(&buckets[index].temperature_sample_count, 1u);
    atomic_add_f32(&buckets[index].temperature_sum_k, temperature_k);
    atomic_add_f32(
      &buckets[index].temperature_mass_weighted_sum_kg_k,
      contribution_mass_kg * temperature_k
    );
    atomic_add_f32(&buckets[index].temperature_sample_mass_kg, contribution_mass_kg);
    atomic_min_f32(&buckets[index].temperature_min_k, temperature_k);
    atomic_max_f32(&buckets[index].temperature_max_k, temperature_k);
  }
  if (finite_f32(specific_internal_energy_j_per_kg)) {
    atomic_add_f32(
      &buckets[index].internal_energy_j,
      contribution_mass_kg * specific_internal_energy_j_per_kg
    );
    atomic_add_f32(&buckets[index].internal_energy_sample_mass_kg, contribution_mass_kg);
  }
  if (all(velocity_m_per_s == velocity_m_per_s)) {
    let speed_squared = dot(velocity_m_per_s, velocity_m_per_s);
    if (finite_f32(speed_squared)) {
      atomic_add_f32(&buckets[index].kinetic_energy_j, 0.5 * contribution_mass_kg * speed_squared);
      atomic_add_f32(&buckets[index].kinetic_energy_sample_mass_kg, contribution_mass_kg);
    }
  }
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) invocation_id: vec3<u32>) {
  let particle_index = invocation_id.x;
  if (particle_index >= params.particle_count) { return; }
  atomicAdd(&global_words[10], 1u);

  let state_base = particle_index * params.state_stride_vec4;
  let thermo_base = particle_index * params.thermo_stride_vec4;
  let state0 = state_rows[state_base];
  let state1 = state_rows[state_base + 1u];
  let thermo0 = thermo_rows[thermo_base];
  let thermo1 = thermo_rows[thermo_base + 1u];
  let mass_kg = state0.w;
  if (!finite_f32(mass_kg)) {
    atomicAdd(&global_words[2], 1u);
    return;
  }
  if (!(mass_kg > 0.0)) {
    atomicAdd(&global_words[1], 1u);
    return;
  }

  atomicAdd(&global_words[0], 1u);
  atomic_add_f32(&global_words[6], mass_kg);
  if (finite_f32(state1.w)) {
    atomic_add_f32(&global_words[7], mass_kg * state1.w);
  }
  let speed_squared = dot(state1.xyz, state1.xyz);
  if (all(state1.xyz == state1.xyz) && finite_f32(speed_squared)) {
    atomic_add_f32(&global_words[8], 0.5 * mass_kg * speed_squared);
  }

  let material_id = select(0u, u32(max(round(thermo0.x), 0.0)), finite_f32(thermo0.x));
  let raw_fractions = max(thermo1, vec4<f32>(0.0));
  let fraction_sum = dot(raw_fractions, vec4<f32>(1.0));
  if (finite_f32(fraction_sum) && fraction_sum > 0.0) {
    let residual = abs(fraction_sum - 1.0);
    atomic_max_f32(&global_words[13], residual);
    atomic_add_f32(&global_words[14], mass_kg * residual);
    if (residual > 1e-4) { atomicAdd(&global_words[11], 1u); }
    contribute_phase(material_id, 1u, raw_fractions.x, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz);
    contribute_phase(material_id, 2u, raw_fractions.y, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz);
    contribute_phase(material_id, 3u, raw_fractions.z, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz);
    contribute_phase(material_id, 4u, raw_fractions.w, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz);
  } else {
    atomicAdd(&global_words[11], 1u);
    atomicAdd(&global_words[12], 1u);
    atomic_add_f32(&global_words[15], mass_kg);
  }
}
`;

async function checkpointPipeline(device) {
  let pipelinePromise = pipelineByDevice.get(device);
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const module = device.createShaderModule({
        label: 'ulg-sph-authoritative-checkpoint-reduction-wgsl',
        code: SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL
      });
      const pipelineDescriptor = {
        label: 'ulg-sph-authoritative-checkpoint-reduction-pipeline',
        layout: 'auto',
        compute: { module, entryPoint: 'main' }
      };
      return typeof device.createComputePipelineAsync === 'function'
        ? device.createComputePipelineAsync(pipelineDescriptor)
        : device.createComputePipeline(pipelineDescriptor);
    })();
    pipelineByDevice.set(device, pipelinePromise);
  }
  return pipelinePromise;
}

export async function reduceAuthoritativeGpuMaterialPhaseEvidence({
  device,
  stateBuffer,
  thermoBuffer,
  particleCount,
  stateStrideBytes = SPH_CHECKPOINT_STATE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
  thermoStrideBytes = SPH_CHECKPOINT_THERMO_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
  materialKeyById = {},
  bucketCapacity = SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY,
  label = 'ulg-sph-authoritative-checkpoint'
} = {}) {
  if (!device?.createBuffer || !device?.createCommandEncoder || !device.queue?.submit) {
    throw new TypeError('authoritative GPU checkpoint reduction requires a GPUDevice');
  }
  if (!stateBuffer || !thermoBuffer) {
    throw new TypeError('authoritative GPU checkpoint reduction requires retained state and thermo buffers');
  }
  const count = positiveInteger(particleCount, null);
  const capacity = positiveInteger(bucketCapacity, SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY);
  if (!count) throw new RangeError('authoritative GPU checkpoint particle count must be positive');
  if (stateStrideBytes % 16 !== 0 || thermoStrideBytes % 16 !== 0) {
    throw new RangeError('authoritative GPU checkpoint strides must be vec4-aligned');
  }

  const usage = globalThis.GPUBufferUsage || {};
  const mapMode = globalThis.GPUMapMode || {};
  const globalByteLength = SPH_CHECKPOINT_GLOBAL_WORDS * Uint32Array.BYTES_PER_ELEMENT;
  const bucketByteLength = capacity * SPH_CHECKPOINT_BUCKET_WORDS * Uint32Array.BYTES_PER_ELEMENT;
  const compactEvidenceByteLength = globalByteLength + bucketByteLength;
  const initialEvidence = createAuthoritativeGpuEvidenceWords(capacity);
  const params = new Uint32Array([
    count,
    stateStrideBytes / 16,
    thermoStrideBytes / 16,
    capacity
  ]);
  let paramsBuffer = null;
  let globalBuffer = null;
  let bucketBuffer = null;
  let readbackBuffer = null;
  const startedAtMs = performance.now();
  try {
    paramsBuffer = device.createBuffer({
      label: `${label}-params`,
      size: params.byteLength,
      usage: (usage.UNIFORM ?? 64) | (usage.COPY_DST ?? 8)
    });
    globalBuffer = device.createBuffer({
      label: `${label}-global-evidence`,
      size: globalByteLength,
      usage: (usage.STORAGE ?? 128) | (usage.COPY_SRC ?? 4) | (usage.COPY_DST ?? 8)
    });
    bucketBuffer = device.createBuffer({
      label: `${label}-material-phase-evidence`,
      size: bucketByteLength,
      usage: (usage.STORAGE ?? 128) | (usage.COPY_SRC ?? 4) | (usage.COPY_DST ?? 8)
    });
    readbackBuffer = device.createBuffer({
      label: `${label}-compact-readback`,
      size: compactEvidenceByteLength,
      usage: (usage.MAP_READ ?? 1) | (usage.COPY_DST ?? 8)
    });
    device.queue.writeBuffer(paramsBuffer, 0, params);
    device.queue.writeBuffer(
      globalBuffer,
      0,
      initialEvidence.subarray(0, SPH_CHECKPOINT_GLOBAL_WORDS)
    );
    device.queue.writeBuffer(
      bucketBuffer,
      0,
      initialEvidence.subarray(SPH_CHECKPOINT_GLOBAL_WORDS)
    );
    const pipeline = await checkpointPipeline(device);
    const bindGroup = device.createBindGroup({
      label: `${label}-bind-group`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: globalBuffer } },
        { binding: 3, resource: { buffer: bucketBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
    const pass = encoder.beginComputePass({ label: `${label}-compute` });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(count / 128));
    pass.end();
    encoder.copyBufferToBuffer(globalBuffer, 0, readbackBuffer, 0, globalByteLength);
    encoder.copyBufferToBuffer(
      bucketBuffer,
      0,
      readbackBuffer,
      globalByteLength,
      bucketByteLength
    );
    device.queue.submit([encoder.finish()]);
    await readbackBuffer.mapAsync(mapMode.READ ?? 1, 0, compactEvidenceByteLength);
    const words = new Uint32Array(
      readbackBuffer.getMappedRange(0, compactEvidenceByteLength)
    ).slice();
    const reduction = decodeAuthoritativeGpuEvidence({
      words,
      bucketCapacity: capacity,
      particleCount: count,
      stateStrideFloats: stateStrideBytes / Float32Array.BYTES_PER_ELEMENT,
      thermoStrideFloats: thermoStrideBytes / Float32Array.BYTES_PER_ELEMENT,
      materialKeyById
    });
    return {
      ...reduction,
      status: 'captured',
      aggregationStatus: reduction.status,
      diagnosticOnly: true,
      physicsReference: false,
      sourceBufferMutation: false,
      hotLoopParticipation: false,
      readback: {
        mode: 'fixed-size-compact-gpu-evidence',
        mappedParticleStateByteLength: 0,
        mappedParticleThermoByteLength: 0,
        mappedCompactEvidenceByteLength: compactEvidenceByteLength,
        globalEvidenceByteLength: globalByteLength,
        materialPhaseEvidenceByteLength: bucketByteLength,
        durationMs: performance.now() - startedAtMs,
        sourceBuffersRetained: true,
        sourceBuffersDestroyed: false
      }
    };
  } finally {
    try { readbackBuffer?.unmap?.(); } catch (_) {}
    readbackBuffer?.destroy?.();
    bucketBuffer?.destroy?.();
    globalBuffer?.destroy?.();
    paramsBuffer?.destroy?.();
  }
}
