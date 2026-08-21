// Diagnostic GPU sidecar: borrows particle buffers but never joins the hot loop.
export const SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_SCHEMA =
  'peercompute.ulg.sph-authoritative-generated-gas-cohort.v0';
export const SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_CAPTURE_SCHEMA =
  'peercompute.ulg.sph-authoritative-generated-gas-cohort-capture.v0';
export const SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_TRACKER_SCHEMA =
  'peercompute.ulg.sph-authoritative-generated-gas-cohort-tracker.v0';

export const SPH_GENERATED_GAS_COHORT_SUMMARY_WORDS = 12;
export const SPH_GENERATED_GAS_COHORT_SUMMARY_WORD = Object.freeze({
  frozenLineageCount: 0,
  activeGasCarrierCount: 1,
  invalidActiveCarrierCount: 2,
  massKg: 3,
  massWeightedYKgM: 4,
  massWeightedVyKgMPerS: 5,
  yMinM: 6,
  yMaxM: 7,
  minVyMPerS: 8,
  maxVyMPerS: 9,
  processedFrozenLineageCount: 10,
  phasePurityProblemCount: 11
});

const GAS_PHASE_ID = 3;
const REQUIRED_PHASE_LANE_COUNT = 4;
const REQUIRED_PHASE_PLAN_SCHEMA = 'peercompute.ulg.sph-phase-carrier-plan.v2';
const REQUIRED_PHASE_PLAN_STATUS = 'phase-lane-capacity-ready';
const REQUIRED_STABLE_LANE_ADDRESS = 'phaseLane*phaseLaneStride+lineageIndex';
const pipelineSetByDevice = new WeakMap();

function explicitPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function explicitNonnegativeInteger(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

function explicitFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function floatWord(value) {
  const row = new Float32Array([value]);
  return new Uint32Array(row.buffer)[0];
}

function wordFloat(value) {
  const row = new Uint32Array([value >>> 0]);
  return new Float32Array(row.buffer)[0];
}

function materialKey(value) {
  const key = String(value || '').trim();
  return key || null;
}

export function phaseCarrierPlanSignature(plan = null) {
  if (!plan) return null;
  return [
    plan.schema,
    plan.status,
    plan.lineageCapacity,
    plan.primaryCapacity,
    plan.phaseLaneCount,
    plan.phaseLaneStride,
    plan.companionStart,
    plan.companionCapacity,
    plan.particleCapacity,
    plan.stableLaneAddress
  ].join('|');
}

export function validateFrozenGeneratedGasCohortTopology({
  particleCount,
  sphPhaseCarrierPlan,
  mechanicsPhaseCarrierPlan
} = {}) {
  const blockers = [];
  const plans = [
    ['sph', sphPhaseCarrierPlan],
    ['mechanics', mechanicsPhaseCarrierPlan]
  ];
  for (const [name, plan] of plans) {
    if (plan?.schema !== REQUIRED_PHASE_PLAN_SCHEMA) {
      blockers.push(`${name}-phase-plan-schema-mismatch`);
      continue;
    }
    if (plan.status !== REQUIRED_PHASE_PLAN_STATUS) {
      blockers.push(`${name}-phase-plan-not-ready`);
    }
    if (
      !explicitPositiveInteger(plan.lineageCapacity)
      || plan.primaryCapacity !== plan.lineageCapacity
      || plan.phaseLaneCount !== REQUIRED_PHASE_LANE_COUNT
      || plan.phaseLaneStride !== plan.lineageCapacity
      || plan.companionStart !== plan.lineageCapacity
      || plan.companionCapacity !== plan.lineageCapacity * (REQUIRED_PHASE_LANE_COUNT - 1)
      || plan.particleCapacity !== plan.lineageCapacity * REQUIRED_PHASE_LANE_COUNT
      || plan.stableLaneAddress !== REQUIRED_STABLE_LANE_ADDRESS
    ) {
      blockers.push(`${name}-phase-plan-topology-mismatch`);
    }
  }
  const sphSignature = phaseCarrierPlanSignature(sphPhaseCarrierPlan);
  const mechanicsSignature = phaseCarrierPlanSignature(mechanicsPhaseCarrierPlan);
  if (!sphSignature || sphSignature !== mechanicsSignature) {
    blockers.push('phase-plan-pair-signature-mismatch');
  }
  if (
    !explicitPositiveInteger(particleCount)
    || particleCount !== sphPhaseCarrierPlan?.particleCapacity
  ) {
    blockers.push('particle-count-phase-plan-mismatch');
  }
  return {
    schema: SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_TRACKER_SCHEMA,
    status: blockers.length === 0 ? 'ready' : 'blocked',
    ready: blockers.length === 0,
    blockers,
    signature: blockers.length === 0 ? sphSignature : null,
    particleCount: blockers.length === 0 ? particleCount : null,
    lineageCapacity: blockers.length === 0
      ? sphPhaseCarrierPlan.lineageCapacity
      : null,
    phaseLaneCount: blockers.length === 0
      ? sphPhaseCarrierPlan.phaseLaneCount
      : null,
    phaseLaneStride: blockers.length === 0
      ? sphPhaseCarrierPlan.phaseLaneStride
      : null,
    gasLane: GAS_PHASE_ID - 1
  };
}

export function createGeneratedGasCohortSummaryWords() {
  const words = new Uint32Array(SPH_GENERATED_GAS_COHORT_SUMMARY_WORDS);
  words[SPH_GENERATED_GAS_COHORT_SUMMARY_WORD.yMinM] = floatWord(Infinity);
  words[SPH_GENERATED_GAS_COHORT_SUMMARY_WORD.yMaxM] = floatWord(-Infinity);
  words[SPH_GENERATED_GAS_COHORT_SUMMARY_WORD.minVyMPerS] = floatWord(Infinity);
  words[SPH_GENERATED_GAS_COHORT_SUMMARY_WORD.maxVyMPerS] = floatWord(-Infinity);
  return words;
}

export function hashFrozenLineageMask(words) {
  if (!(words instanceof Uint32Array)) {
    throw new TypeError('frozen lineage mask must be a Uint32Array');
  }
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

export function decodeGeneratedGasCohortSummary({
  words,
  material,
  materialId,
  formedAtCheckpointIndex,
  formedAtStep,
  formedAtTimeS,
  frozenLineageMaskHash,
  frozenLineageMaskByteLength,
  topologySignature
} = {}) {
  if (
    !(words instanceof Uint32Array)
    || words.length < SPH_GENERATED_GAS_COHORT_SUMMARY_WORDS
  ) {
    throw new RangeError('generated gas cohort summary has an invalid word range');
  }
  const field = SPH_GENERATED_GAS_COHORT_SUMMARY_WORD;
  const frozenLineageCount = words[field.frozenLineageCount];
  const activeGasCarrierCount = words[field.activeGasCarrierCount];
  const invalidActiveCarrierCount = words[field.invalidActiveCarrierCount];
  const phasePurityProblemCount = words[field.phasePurityProblemCount];
  const massKg = wordFloat(words[field.massKg]);
  const massWeightedYKgM = wordFloat(words[field.massWeightedYKgM]);
  const massWeightedVyKgMPerS = wordFloat(words[field.massWeightedVyKgMPerS]);
  const sameCarrierLineageProven = Boolean(
    frozenLineageCount > 0
    && words[field.processedFrozenLineageCount] === frozenLineageCount
    && invalidActiveCarrierCount === 0
    && phasePurityProblemCount === 0
    && frozenLineageMaskHash
    && topologySignature
  );
  return {
    schema: SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_SCHEMA,
    status: sameCarrierLineageProven ? 'captured' : 'invalid',
    authority: 'gpu-resident-frozen-phase-lineage-bitmask',
    sameCarrierLineageProven,
    material: materialKey(material) || `material-${materialId}`,
    materialId,
    phase: 'gas',
    phaseId: GAS_PHASE_ID,
    formedAtCheckpointIndex,
    formedAtStep,
    formedAtTimeS,
    frozenLineageCount,
    activeGasCarrierCount,
    inactiveFrozenLineageCount: Math.max(
      0,
      frozenLineageCount - activeGasCarrierCount
    ),
    processedFrozenLineageCount: words[field.processedFrozenLineageCount],
    invalidActiveCarrierCount,
    phasePurityProblemCount,
    massKg,
    yCenterMassWeightedM: massKg > 0 ? massWeightedYKgM / massKg : null,
    meanVyMPerS: massKg > 0 ? massWeightedVyKgMPerS / massKg : null,
    vySampleMassKg: massKg,
    yMinM: massKg > 0 ? wordFloat(words[field.yMinM]) : null,
    yMaxM: massKg > 0 ? wordFloat(words[field.yMaxM]) : null,
    minVyMPerS: massKg > 0 ? wordFloat(words[field.minVyMPerS]) : null,
    maxVyMPerS: massKg > 0 ? wordFloat(words[field.maxVyMPerS]) : null,
    frozenLineageMaskHash,
    frozenLineageMaskByteLength,
    topologySignature,
    sourceBufferMutation: false,
    hotLoopParticipation: false,
    diagnosticOnly: true,
    physicsReference: false
  };
}

export const SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_WGSL = /* wgsl */ `
struct Params {
  particle_count: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  lineage_capacity: u32,
  phase_lane_stride: u32,
  gas_lane: u32,
  target_material_id: u32,
  mask_word_count: u32,
};

struct Summary {
  frozen_lineage_count: atomic<u32>,
  active_gas_carrier_count: atomic<u32>,
  invalid_active_carrier_count: atomic<u32>,
  mass_kg: atomic<u32>,
  mass_weighted_y_kg_m: atomic<u32>,
  mass_weighted_vy_kg_m_per_s: atomic<u32>,
  y_min_m: atomic<u32>,
  y_max_m: atomic<u32>,
  min_vy_m_per_s: atomic<u32>,
  max_vy_m_per_s: atomic<u32>,
  processed_frozen_lineage_count: atomic<u32>,
  phase_purity_problem_count: atomic<u32>,
};

@group(0) @binding(0) var<storage, read> state_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> thermo_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> lineage_mask: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> summary: Summary;
@group(0) @binding(4) var<uniform> params: Params;
@group(0) @binding(5) var<storage, read> frozen_lineage_mask: array<u32>;

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

fn gas_particle_index(lineage_index: u32) -> u32 {
  return params.gas_lane * params.phase_lane_stride + lineage_index;
}

fn phase_pure_gas(thermo1: vec4<f32>) -> bool {
  let fractions = max(thermo1, vec4<f32>(0.0));
  return abs(fractions.z - 1.0) <= 1e-4
    && fractions.x + fractions.y + fractions.w <= 1e-4;
}

@compute @workgroup_size(128)
fn freeze_main(@builtin(global_invocation_id) invocation_id: vec3<u32>) {
  let lineage_index = invocation_id.x;
  if (lineage_index >= params.lineage_capacity) { return; }
  // Keep the freeze/reduce bind-group layouts identical without mutating the
  // summary during mask creation.
  if (atomicLoad(&summary.processed_frozen_lineage_count) == 0xffffffffu) {
    return;
  }
  let particle_index = gas_particle_index(lineage_index);
  if (particle_index >= params.particle_count) { return; }
  let state0 = state_rows[particle_index * params.state_stride_vec4];
  let thermo0 = thermo_rows[particle_index * params.thermo_stride_vec4];
  let thermo1 = thermo_rows[particle_index * params.thermo_stride_vec4 + 1u];
  let material_id = u32(max(round(thermo0.x), 0.0));
  if (
    finite_f32(state0.w)
    && state0.w > 0.0
    && material_id == params.target_material_id
    && phase_pure_gas(thermo1)
  ) {
    let word_index = lineage_index >> 5u;
    let bit_index = lineage_index & 31u;
    if (word_index < params.mask_word_count) {
      atomicOr(&lineage_mask[word_index], 1u << bit_index);
    }
  }
}

@compute @workgroup_size(128)
fn reduce_main(@builtin(global_invocation_id) invocation_id: vec3<u32>) {
  let lineage_index = invocation_id.x;
  if (lineage_index >= params.lineage_capacity) { return; }
  let word_index = lineage_index >> 5u;
  let bit_index = lineage_index & 31u;
  if (
    word_index >= params.mask_word_count
    || (frozen_lineage_mask[word_index] & (1u << bit_index)) == 0u
  ) {
    return;
  }
  atomicAdd(&summary.frozen_lineage_count, 1u);
  atomicAdd(&summary.processed_frozen_lineage_count, 1u);
  let particle_index = gas_particle_index(lineage_index);
  if (particle_index >= params.particle_count) {
    atomicAdd(&summary.invalid_active_carrier_count, 1u);
    return;
  }
  let state0 = state_rows[particle_index * params.state_stride_vec4];
  let state1 = state_rows[particle_index * params.state_stride_vec4 + 1u];
  let thermo0 = thermo_rows[particle_index * params.thermo_stride_vec4];
  let thermo1 = thermo_rows[particle_index * params.thermo_stride_vec4 + 1u];
  let mass_kg = state0.w;
  if (!finite_f32(mass_kg)) {
    atomicAdd(&summary.invalid_active_carrier_count, 1u);
    return;
  }
  if (!(mass_kg > 0.0)) { return; }
  let material_id = u32(max(round(thermo0.x), 0.0));
  if (material_id != params.target_material_id) {
    atomicAdd(&summary.invalid_active_carrier_count, 1u);
    return;
  }
  if (!phase_pure_gas(thermo1)) {
    atomicAdd(&summary.phase_purity_problem_count, 1u);
    return;
  }
  if (!finite_f32(state0.y) || !finite_f32(state1.y)) {
    atomicAdd(&summary.invalid_active_carrier_count, 1u);
    return;
  }
  atomicAdd(&summary.active_gas_carrier_count, 1u);
  atomic_add_f32(&summary.mass_kg, mass_kg);
  atomic_add_f32(&summary.mass_weighted_y_kg_m, mass_kg * state0.y);
  atomic_add_f32(&summary.mass_weighted_vy_kg_m_per_s, mass_kg * state1.y);
  atomic_min_f32(&summary.y_min_m, state0.y);
  atomic_max_f32(&summary.y_max_m, state0.y);
  atomic_min_f32(&summary.min_vy_m_per_s, state1.y);
  atomic_max_f32(&summary.max_vy_m_per_s, state1.y);
}
`;

async function cohortPipelines(device) {
  let pipelines = pipelineSetByDevice.get(device);
  if (!pipelines) {
    pipelines = (async () => {
      const module = device.createShaderModule({
        label: 'ulg-sph-authoritative-generated-gas-cohort-module',
        code: SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_WGSL
      });
      const descriptor = (entryPoint) => ({
        label: `ulg-sph-authoritative-generated-gas-cohort-${entryPoint}`,
        layout: 'auto',
        compute: { module, entryPoint }
      });
      const create = (entryPoint) => (
        typeof device.createComputePipelineAsync === 'function'
          ? device.createComputePipelineAsync(descriptor(entryPoint))
          : device.createComputePipeline(descriptor(entryPoint))
      );
      return {
        freeze: await create('freeze_main'),
        reduce: await create('reduce_main')
      };
    })();
    pipelineSetByDevice.set(device, pipelines);
  }
  return pipelines;
}

function gasCandidates(reduction, minimumMassKg, targetMaterial) {
  return (reduction?.materialPhases || []).filter((row) => (
    row?.phaseId === GAS_PHASE_ID
    && explicitPositiveInteger(row?.materialId)
    && explicitFiniteNumber(row?.massKg)
    && row.massKg >= minimumMassKg
    && materialKey(row.material)?.toLowerCase() === targetMaterial
  ));
}

function destroyBuffer(buffer) {
  try { buffer?.destroy?.(); } catch (_) {}
}

export function createAuthoritativeGeneratedGasCohortTracker({
  targetMaterial,
  minimumMassFractionOfSystem = 1e-6,
  minimumMassKg = 0
} = {}) {
  const normalizedTargetMaterial = materialKey(targetMaterial)?.toLowerCase() || null;
  if (!normalizedTargetMaterial) {
    throw new TypeError(
      'authoritative generated-gas cohort tracker requires exactly one target material'
    );
  }
  const normalizedMinimumFraction = Math.max(
    0,
    explicitFiniteNumber(minimumMassFractionOfSystem)
      ? minimumMassFractionOfSystem
      : 0
  );
  const normalizedMinimumMassKg = Math.max(
    0,
    explicitFiniteNumber(minimumMassKg) ? minimumMassKg : 0
  );
  let deviceIdentity = null;
  let topology = null;
  let invalidation = null;
  let lastObservedSourceStep = null;
  let lastObservedSourceTimeS = null;
  let admittedTopologyEpoch = null;
  let lastObservedTopologyEpoch = null;
  let admittedIdentityRevision = null;
  const cohorts = new Map();

  const invalidate = (reason, detail = null) => {
    if (!invalidation) {
      invalidation = {
        reason,
        detail,
        invalidatedAt: new Date().toISOString()
      };
      for (const cohort of cohorts.values()) destroyBuffer(cohort.maskBuffer);
    }
    return invalidation;
  };

  const captureOne = async ({
    cohort,
    device,
    stateBuffer,
    thermoBuffer,
    stateStrideBytes,
    thermoStrideBytes,
    sourceStep,
    sourceTimeS,
    checkpointIndex,
    freeze
  }) => {
    const usage = globalThis.GPUBufferUsage || {};
    const mapMode = globalThis.GPUMapMode || {};
    const summaryWords = createGeneratedGasCohortSummaryWords();
    const summaryByteLength = summaryWords.byteLength;
    const maskByteLength = cohort.maskWordCount * Uint32Array.BYTES_PER_ELEMENT;
    const readMask = freeze && !cohort.maskHash;
    const readbackByteLength = summaryByteLength + (readMask ? maskByteLength : 0);
    const params = new Uint32Array([
      topology.particleCount,
      stateStrideBytes / 16,
      thermoStrideBytes / 16,
      topology.lineageCapacity,
      topology.phaseLaneStride,
      topology.gasLane,
      cohort.materialId,
      cohort.maskWordCount
    ]);
    let paramsBuffer = null;
    let summaryBuffer = null;
    let readbackBuffer = null;
    try {
      paramsBuffer = device.createBuffer({
        label: `ulg-generated-gas-${cohort.materialId}-params`,
        size: params.byteLength,
        usage: (usage.UNIFORM ?? 64) | (usage.COPY_DST ?? 8)
      });
      summaryBuffer = device.createBuffer({
        label: `ulg-generated-gas-${cohort.materialId}-summary`,
        size: summaryByteLength,
        usage: (usage.STORAGE ?? 128) | (usage.COPY_SRC ?? 4) | (usage.COPY_DST ?? 8)
      });
      readbackBuffer = device.createBuffer({
        label: `ulg-generated-gas-${cohort.materialId}-readback`,
        size: readbackByteLength,
        usage: (usage.MAP_READ ?? 1) | (usage.COPY_DST ?? 8)
      });
      device.queue.writeBuffer(paramsBuffer, 0, params);
      device.queue.writeBuffer(summaryBuffer, 0, summaryWords);
      const pipelines = await cohortPipelines(device);
      const commonBindGroupEntries = [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 3, resource: { buffer: summaryBuffer } },
        { binding: 4, resource: { buffer: paramsBuffer } }
      ];
      const encoder = device.createCommandEncoder({
        label: `ulg-generated-gas-${cohort.materialId}-encoder`
      });
      if (freeze) {
        const freezeBindGroup = device.createBindGroup({
          label: `ulg-generated-gas-${cohort.materialId}-freeze-bind-group`,
          layout: pipelines.freeze.getBindGroupLayout(0),
          entries: [
            ...commonBindGroupEntries,
            { binding: 2, resource: { buffer: cohort.maskBuffer } }
          ]
        });
        const pass = encoder.beginComputePass({
          label: `ulg-generated-gas-${cohort.materialId}-freeze`
        });
        pass.setPipeline(pipelines.freeze);
        pass.setBindGroup(0, freezeBindGroup);
        pass.dispatchWorkgroups(Math.ceil(topology.lineageCapacity / 128));
        pass.end();
      }
      const reduceBindGroup = device.createBindGroup({
        label: `ulg-generated-gas-${cohort.materialId}-reduce-bind-group`,
        layout: pipelines.reduce.getBindGroupLayout(0),
        entries: [
          ...commonBindGroupEntries,
          { binding: 5, resource: { buffer: cohort.maskBuffer } }
        ]
      });
      const reducePass = encoder.beginComputePass({
        label: `ulg-generated-gas-${cohort.materialId}-reduce`
      });
      reducePass.setPipeline(pipelines.reduce);
      reducePass.setBindGroup(0, reduceBindGroup);
      reducePass.dispatchWorkgroups(Math.ceil(topology.lineageCapacity / 128));
      reducePass.end();
      encoder.copyBufferToBuffer(
        summaryBuffer,
        0,
        readbackBuffer,
        0,
        summaryByteLength
      );
      if (readMask) {
        encoder.copyBufferToBuffer(
          cohort.maskBuffer,
          0,
          readbackBuffer,
          summaryByteLength,
          maskByteLength
        );
      }
      device.queue.submit([encoder.finish()]);
      await readbackBuffer.mapAsync(mapMode.READ ?? 1, 0, readbackByteLength);
      const range = readbackBuffer.getMappedRange(0, readbackByteLength);
      const capturedSummaryWords = new Uint32Array(
        range.slice(0, summaryByteLength)
      );
      if (readMask) {
        const maskWords = new Uint32Array(
          range.slice(summaryByteLength, summaryByteLength + maskByteLength)
        );
        cohort.maskHash = hashFrozenLineageMask(maskWords);
      }
      const decoded = decodeGeneratedGasCohortSummary({
        words: capturedSummaryWords,
        material: cohort.material,
        materialId: cohort.materialId,
        formedAtCheckpointIndex: cohort.formedAtCheckpointIndex,
        formedAtStep: cohort.formedAtStep,
        formedAtTimeS: cohort.formedAtTimeS,
        frozenLineageMaskHash: cohort.maskHash,
        frozenLineageMaskByteLength: maskByteLength,
        topologySignature: topology.signature
      });
      if (freeze && decoded.frozenLineageCount === 0) {
        return {
          ...decoded,
          status: 'formation-not-phase-lane-exact',
          sameCarrierLineageProven: false
        };
      }
      return {
        ...decoded,
        checkpointIndex,
        sourceStep,
        sourceTimeS,
        readback: {
          mode: 'fixed-size-frozen-lineage-cohort-summary',
          mappedParticleByteLength: 0,
          mappedSummaryByteLength: summaryByteLength,
          mappedMaskByteLength: readMask ? maskByteLength : 0,
          persistentMaskByteLength: maskByteLength
        }
      };
    } finally {
      try { readbackBuffer?.unmap?.(); } catch (_) {}
      destroyBuffer(readbackBuffer);
      destroyBuffer(summaryBuffer);
      destroyBuffer(paramsBuffer);
    }
  };

  return {
    schema: SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_TRACKER_SCHEMA,
    async capture({
      device,
      stateBuffer,
      thermoBuffer,
      particleCount,
      stateStrideBytes,
      thermoStrideBytes,
      sphPhaseCarrierPlan,
      mechanicsPhaseCarrierPlan,
      sharedSlotIdentityVerified,
      sourceStep,
      sourceTimeS,
      topologyEpoch,
      identityRevision,
      checkpointIndex,
      materialPhaseReduction,
      materialKeyById = {}
    } = {}) {
      const base = {
        schema: SPH_AUTHORITATIVE_GENERATED_GAS_COHORT_CAPTURE_SCHEMA,
        checkpointIndex,
        sourceStep,
        sourceTimeS,
        authority: 'gpu-resident-frozen-phase-lineage-bitmask',
        targetMaterial: normalizedTargetMaterial,
        minimumMassFractionOfSystem: normalizedMinimumFraction,
        requestedMinimumMassKg: normalizedMinimumMassKg,
        diagnosticOnly: true,
        physicsReference: false
      };
      if (invalidation) {
        return { ...base, status: 'invalidated', invalidation, cohorts: [] };
      }
      if (!device?.createBuffer || !device.queue?.submit) {
        return { ...base, status: 'unavailable', reason: 'GPUDevice unavailable', cohorts: [] };
      }
      if (
        !explicitPositiveInteger(stateStrideBytes)
        || stateStrideBytes % 16 !== 0
        || !explicitPositiveInteger(thermoStrideBytes)
        || thermoStrideBytes % 16 !== 0
      ) {
        return {
          ...base,
          status: 'unavailable',
          reason: 'particle row strides are invalid',
          cohorts: []
        };
      }
      const nextTopology = validateFrozenGeneratedGasCohortTopology({
        particleCount,
        sphPhaseCarrierPlan,
        mechanicsPhaseCarrierPlan
      });
      if (!nextTopology.ready) {
        if (topology || cohorts.size > 0) {
          invalidate('phase-carrier-topology-invalid', nextTopology);
          return { ...base, status: 'invalidated', invalidation, cohorts: [] };
        }
        return {
          ...base,
          status: 'awaiting-exact-phase-carrier-topology',
          topology: nextTopology,
          cohorts: []
        };
      }
      const systemMassKg = Math.max(
        0,
        Number(materialPhaseReduction?.totals?.massKg) || 0
      );
      const effectiveMinimumMassKg = Math.max(
        normalizedMinimumMassKg,
        normalizedMinimumFraction * systemMassKg
      );
      const candidates = gasCandidates(
        materialPhaseReduction,
        effectiveMinimumMassKg,
        normalizedTargetMaterial
      );
      if (!topology) {
        // The scene's time-zero SPH and mechanics uploads are coherent but
        // distinct buffers. The first resident continuation promotes them to
        // one fixed phase-lane slot identity. Arming against the unshared
        // upload makes that legitimate promotion look like a lineage break
        // (epoch 0 -> the first resident topology epoch) before a cohort can
        // exist. Wait for the first shared-slot authority instead. It remains
        // a valid pre-formation baseline only while no qualifying gas is
        // already present.
        if (sharedSlotIdentityVerified !== true) {
          return {
            ...base,
            status: 'awaiting-shared-slot-lineage',
            topology: nextTopology,
            effectiveMinimumMassKg,
            systemMassKg,
            cohorts: []
          };
        }
        if (
          !explicitNonnegativeInteger(sourceStep)
          || !explicitFiniteNumber(sourceTimeS)
          || sourceTimeS < 0
          || !explicitNonnegativeInteger(topologyEpoch)
          || topologyEpoch < 0
          || identityRevision == null
          || String(identityRevision).length === 0
        ) {
          invalidate('missing-coherent-shared-slot-arm', {
            sourceStep,
            sourceTimeS,
            topologyEpoch,
            identityRevision: identityRevision ?? null
          });
          return { ...base, status: 'invalidated', invalidation, cohorts: [] };
        }
        if (candidates.length > 0) {
          invalidate('missing-preformation-shared-slot-baseline', {
            sourceStep,
            sourceTimeS,
            topologyEpoch,
            candidateMaterialIds:
              candidates.map((candidate) => candidate.materialId)
          });
          return { ...base, status: 'invalidated', invalidation, cohorts: [] };
        }
        topology = nextTopology;
        deviceIdentity = device;
        admittedTopologyEpoch = topologyEpoch;
        lastObservedTopologyEpoch = topologyEpoch;
        admittedIdentityRevision = identityRevision;
      } else if (device !== deviceIdentity) {
        invalidate('gpu-device-identity-changed');
      } else if (nextTopology.signature !== topology.signature) {
        invalidate('phase-carrier-topology-changed', {
          expected: topology.signature,
          actual: nextTopology.signature
        });
      } else if (!explicitNonnegativeInteger(topologyEpoch)) {
        invalidate('topology-epoch-invalid', {
          actual: topologyEpoch
        });
      } else if (topologyEpoch < lastObservedTopologyEpoch) {
        invalidate('topology-epoch-regressed', {
          previous: lastObservedTopologyEpoch,
          actual: topologyEpoch
        });
      } else if (identityRevision !== admittedIdentityRevision) {
        invalidate('particle-identity-revision-changed', {
          expected: admittedIdentityRevision,
          actual: identityRevision
        });
      }
      if (invalidation) {
        return { ...base, status: 'invalidated', invalidation, cohorts: [] };
      }
      if (sharedSlotIdentityVerified !== true) {
        invalidate('shared-slot-lineage-not-verified');
        return { ...base, status: 'invalidated', invalidation, cohorts: [] };
      }
      if (
        explicitFiniteNumber(lastObservedSourceStep)
        && (
          !explicitFiniteNumber(sourceStep)
          || sourceStep <= lastObservedSourceStep
          || !explicitFiniteNumber(sourceTimeS)
          || sourceTimeS <= lastObservedSourceTimeS
        )
      ) {
        invalidate('source-step-time-not-strictly-increasing', {
          previousStep: lastObservedSourceStep,
          actualStep: sourceStep,
          previousTimeS: lastObservedSourceTimeS,
          actualTimeS: sourceTimeS
        });
        return { ...base, status: 'invalidated', invalidation, cohorts: [] };
      }
      const usage = globalThis.GPUBufferUsage || {};
      for (const candidate of candidates) {
        if (cohorts.has(candidate.materialId)) continue;
        const maskWordCount = Math.ceil(topology.lineageCapacity / 32);
        const maskBuffer = device.createBuffer({
          label: `ulg-generated-gas-${candidate.materialId}-frozen-lineage-mask`,
          size: maskWordCount * Uint32Array.BYTES_PER_ELEMENT,
          usage: (usage.STORAGE ?? 128) | (usage.COPY_SRC ?? 4) | (usage.COPY_DST ?? 8)
        });
        device.queue.writeBuffer(maskBuffer, 0, new Uint32Array(maskWordCount));
        cohorts.set(candidate.materialId, {
          materialId: candidate.materialId,
          material: materialKey(candidate.material)
            || materialKeyById?.[candidate.materialId]
            || `material-${candidate.materialId}`,
          maskWordCount,
          maskBuffer,
          maskHash: null,
          formedAtCheckpointIndex: checkpointIndex,
          formedAtStep: sourceStep,
          formedAtTimeS: sourceTimeS
        });
      }
      const captures = [];
      for (const cohort of cohorts.values()) {
        const freeze = cohort.maskHash == null;
        const captured = await captureOne({
          cohort,
          device,
          stateBuffer,
          thermoBuffer,
          stateStrideBytes,
          thermoStrideBytes,
          sourceStep,
          sourceTimeS,
          checkpointIndex,
          freeze
        });
        if (freeze && captured.frozenLineageCount === 0) {
          destroyBuffer(cohort.maskBuffer);
          cohorts.delete(cohort.materialId);
        }
        captures.push(captured);
      }
      const captureInvalid = captures.some((capture) => (
        capture.status !== 'captured'
        || capture.sameCarrierLineageProven !== true
      ));
      if (captureInvalid && cohorts.size > 0) {
        invalidate('frozen-cohort-capture-invalid', captures.map((capture) => ({
          materialId: capture.materialId,
          status: capture.status,
          frozenLineageCount: capture.frozenLineageCount,
          invalidActiveCarrierCount: capture.invalidActiveCarrierCount,
          phasePurityProblemCount: capture.phasePurityProblemCount
        })));
      }
      lastObservedSourceStep = sourceStep;
      lastObservedSourceTimeS = sourceTimeS;
      lastObservedTopologyEpoch = topologyEpoch;
      return {
        ...base,
        status: captureInvalid
          ? 'invalid'
          : captures.length > 0
          ? 'captured'
          : sharedSlotIdentityVerified === true
          ? 'awaiting-formation'
          : 'awaiting-shared-slot-lineage',
        sameCarrierLineageProven: captures.length > 0
          && captures.every((capture) => capture.sameCarrierLineageProven === true),
        topology: {
          signature: topology.signature,
          particleCount: topology.particleCount,
          lineageCapacity: topology.lineageCapacity,
          phaseLaneCount: topology.phaseLaneCount,
          phaseLaneStride: topology.phaseLaneStride,
          gasLane: topology.gasLane
        },
        topologyEpoch: admittedTopologyEpoch,
        observedTopologyEpoch: topologyEpoch,
        identityRevision: admittedIdentityRevision,
        effectiveMinimumMassKg,
        systemMassKg,
        cohortCount: captures.length,
        cohorts: captures
      };
    },
    destroy() {
      for (const cohort of cohorts.values()) destroyBuffer(cohort.maskBuffer);
      cohorts.clear();
    }
  };
}
