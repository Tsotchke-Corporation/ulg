import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_SCHEMA =
  'peercompute.ulg.sph-authoritative-gpu-material-phase-checkpoint.v1';
export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_CAPTURE_SCHEMA =
  'peercompute.ulg.sph-authoritative-gpu-checkpoint-capture.v1';
export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_REDUCTION_SCHEMA =
  'peercompute.ulg.sph-authoritative-gpu-material-phase-reduction.v1';

export const SPH_CHECKPOINT_STATE_STRIDE_FLOATS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
export const SPH_CHECKPOINT_THERMO_STRIDE_FLOATS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
export const SPH_CHECKPOINT_MECHANICS_STRIDE_FLOATS =
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
export const SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY = 64;
export const SPH_CHECKPOINT_CONDENSED_VOLUME_RATIO_CAP_J = 1.05;
export const SPH_CHECKPOINT_GENERAL_VOLUME_RATIO_CAP_J = 64;
export const SPH_CHECKPOINT_GAS_VOLUME_RATIO_CAP_J = 1000;
export const SPH_CHECKPOINT_GLOBAL_WORDS = 20;
export const SPH_CHECKPOINT_BUCKET_WORDS = 48;

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
  unclassifiedMassKg: 15,
  speedSampleCount: 16,
  mechanicsSampleCount: 17,
  invalidMechanicsParticleCount: 18,
  volumeRatioCapBoundaryParticleCount: 19
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
  kineticEnergySampleMassKg: 19,
  speedSampleCount: 20,
  maxSpeedMPerS: 21,
  mechanicsSampleCount: 22,
  minVolumeRatioJ: 23,
  maxVolumeRatioJ: 24,
  phaseWeightedRestVolumeM3: 25,
  phaseWeightedCurrentVolumeM3: 26,
  phaseWeightedRepresentedVolumeM3: 27,
  volumeRatioCapBoundaryContributionCount: 28,
  // resolvedAbsolutePressurePa (mechanics field 28). Added to answer why a
  // 1000x density difference produces no buoyant separation: without a per-phase
  // pressure there is no way to tell "the EOS never builds expansion pressure"
  // from "it does and something else cancels it".
  pressureSampleCount: 29,
  minPressurePa: 30,
  maxPressurePa: 31,
  // The constitutive branch and the density it is evaluated at. `ss=1` pins the
  // liquid to exactly `ambientPressurePa` while `ss=0` produces a 0..8826 Pa
  // gauge profile, with J reported as exactly 1 in BOTH arms. The two branches
  // in the EOS behave differently at J == 1 -- the fluid branch returns ambient
  // exactly, the corotated branch returns max(0, ambient - tr(sigma)/3) -- so
  // the branch, not J, is the candidate discriminator. Density is carried
  // alongside because the fluid branch reads it rather than J directly.
  solidBranchCount: 32,
  densitySampleCount: 33,
  minDensityKgPerM3: 34,
  maxDensityKgPerM3: 35,
  // trace(C), the APIC velocity gradient's divergence. The fluid J update is
  // J_{n+1} = J_n * det(I + dt*C) ~= J_n * (1 + dt*tr(C)), and the stored J is
  // then round-tripped through `cbrt(J)^3`. That round-trip was MEASURED (see
  // scripts/measure-cubic-root-roundtrip.mjs) to annihilate any |dJ| <= 1.19e-7
  // while preserving 4.0e-6. So whether J can leave 1.0 at all depends entirely
  // on whether dt*tr(C) clears that dead zone -- which is what this records.
  divergenceSampleCount: 36,
  minVelocityDivergencePerS: 37,
  maxVelocityDivergencePerS: 38,
  maxAbsVelocityDivergencePerS: 39,
  // det(F) recomputed here from mechanics rows 0..2, alongside the stored J in
  // row4.z. Both come from the SAME read of the same buffer, so comparing them
  // separates the last two hypotheses for why J is bit-exactly 1.0 while
  // dt*div(v) reaches 9.4e-4:
  //   det(F) != 1, J == 1  -> J is overwritten independently of F
  //   det(F) == 1, J == 1  -> the F update never lands despite nonzero C
  // eosModelId rides along because every branch that could freeze J keys off it
  // (`deformation_disabled` needs row6.z < 0.5, `condensed` needs 0.5..1.5).
  detFSampleCount: 40,
  minDetF: 41,
  maxDetF: 42,
  maxEosModelId: 43,
  // Mass-weighted mean vertical velocity per phase. maxSpeedMPerS is an
  // unsigned population max and cannot distinguish "the gas is buoyant but
  // slow" from "the gas is velocity-locked to the liquid by the shared grid" --
  // the two hypotheses left for why a generated cohort rises at ~0.008 m/s
  // where a steam bubble in water rises at ~0.2-0.3 m/s.
  vySampleMassKg: 44,
  massWeightedVySumKgMPerS: 45,
  minVyMPerS: 46,
  maxVyMPerS: 47
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

function explicitFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function explicitPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function explicitPositiveVec4Stride(value) {
  return explicitPositiveInteger(value) && value % 16 === 0;
}

export function validateAuthoritativeGpuUploadPair({
  sphParticleUpload,
  mlsMpmParticleUpload,
  requireTimeZero = false,
  expectedStep = null,
  expectedTimeS = null,
  expectedParticleCount = null
} = {}) {
  const blockers = [];
  if (sphParticleUpload?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA) {
    blockers.push('sph-particle-upload-schema-mismatch');
  }
  if (mlsMpmParticleUpload?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA) {
    blockers.push('mls-mpm-particle-upload-schema-mismatch');
  }
  if (sphParticleUpload?.sourceSchema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    blockers.push('sph-particle-source-schema-mismatch');
  }
  if (mlsMpmParticleUpload?.sourceSchema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    blockers.push('mls-mpm-particle-source-schema-mismatch');
  }
  if (sphParticleUpload?.status !== 'webgpu-uploaded') {
    blockers.push('sph-particle-upload-not-webgpu-uploaded');
  }
  if (mlsMpmParticleUpload?.status !== 'webgpu-uploaded') {
    blockers.push('mls-mpm-particle-upload-not-webgpu-uploaded');
  }
  if (!sphParticleUpload?.stateBuffer || !sphParticleUpload?.thermoBuffer) {
    blockers.push('sph-state-thermo-buffer-pair-missing');
  }
  if (!mlsMpmParticleUpload?.mechanicsBuffer) {
    blockers.push('mls-mpm-mechanics-buffer-missing');
  }

  const sphParticleCount = sphParticleUpload?.particleCount;
  const mechanicsParticleCount = mlsMpmParticleUpload?.particleCount;
  if (
    !explicitPositiveInteger(sphParticleCount)
    || !explicitPositiveInteger(mechanicsParticleCount)
    || sphParticleCount !== mechanicsParticleCount
  ) {
    blockers.push('particle-count-mismatch-or-invalid');
  }
  if (expectedParticleCount != null && (
    !explicitPositiveInteger(expectedParticleCount)
    || sphParticleCount !== expectedParticleCount
  )) {
    blockers.push('particle-count-does-not-match-parent-generation');
  }

  const stateStrideBytes = sphParticleUpload?.stateStrideBytes;
  const thermoStrideBytes = sphParticleUpload?.thermoStrideBytes;
  const mechanicsStrideBytes = mlsMpmParticleUpload?.mechanicsStrideBytes;
  const expectedStateStrideBytes = SPH_CHECKPOINT_STATE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const expectedThermoStrideBytes = SPH_CHECKPOINT_THERMO_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const expectedMechanicsStrideBytes =
    SPH_CHECKPOINT_MECHANICS_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  if (stateStrideBytes !== expectedStateStrideBytes) blockers.push('state-stride-invalid');
  if (thermoStrideBytes !== expectedThermoStrideBytes) blockers.push('thermo-stride-invalid');
  if (mechanicsStrideBytes !== expectedMechanicsStrideBytes) blockers.push('mechanics-stride-invalid');
  for (const [name, buffer, strideBytes] of [
    ['state', sphParticleUpload?.stateBuffer, stateStrideBytes],
    ['thermo', sphParticleUpload?.thermoBuffer, thermoStrideBytes],
    ['mechanics', mlsMpmParticleUpload?.mechanicsBuffer, mechanicsStrideBytes]
  ]) {
    if (
      !explicitPositiveInteger(buffer?.size)
      || !explicitPositiveVec4Stride(strideBytes)
      || !explicitPositiveInteger(sphParticleCount)
      || buffer.size < sphParticleCount * strideBytes
    ) {
      blockers.push(`${name}-buffer-capacity-invalid`);
    }
  }

  const sphStep = sphParticleUpload?.step;
  const sphTimeS = sphParticleUpload?.time;
  const mechanicsStep = mlsMpmParticleUpload?.step;
  const mechanicsTimeS = mlsMpmParticleUpload?.time;
  if (
    !explicitFiniteNumber(sphStep)
    || !explicitFiniteNumber(mechanicsStep)
    || sphStep !== mechanicsStep
  ) {
    blockers.push('source-step-mismatch-or-invalid');
  }
  if (
    !explicitFiniteNumber(sphTimeS)
    || !explicitFiniteNumber(mechanicsTimeS)
    || sphTimeS !== mechanicsTimeS
  ) {
    blockers.push('source-time-mismatch-or-invalid');
  }
  if (requireTimeZero && (sphStep !== 0 || sphTimeS !== 0)) {
    blockers.push('source-is-not-time-zero');
  }
  if (expectedStep != null && (
    !explicitFiniteNumber(expectedStep)
    || sphStep !== expectedStep
  )) {
    blockers.push('source-step-does-not-match-parent-generation');
  }
  if (expectedTimeS != null && (
    !explicitFiniteNumber(expectedTimeS)
    || sphTimeS !== expectedTimeS
  )) {
    blockers.push('source-time-does-not-match-parent-generation');
  }
  const sharedSlotFields = ['slot', 'sourceSlot', 'nextSlot'];
  for (const field of sharedSlotFields) {
    const sphValue = sphParticleUpload?.[field];
    const mechanicsValue = mlsMpmParticleUpload?.[field];
    if (sphValue == null && mechanicsValue == null) continue;
    if (
      typeof sphValue !== 'number'
      || !Number.isInteger(sphValue)
      || typeof mechanicsValue !== 'number'
      || !Number.isInteger(mechanicsValue)
      || sphValue !== mechanicsValue
    ) {
      blockers.push(`${field}-mismatch-or-invalid`);
    }
  }
  const sharedSlotIdentityVerified = sharedSlotFields.every((field) => (
    typeof sphParticleUpload?.[field] === 'number'
    && Number.isInteger(sphParticleUpload[field])
    && typeof mlsMpmParticleUpload?.[field] === 'number'
    && Number.isInteger(mlsMpmParticleUpload[field])
    && sphParticleUpload[field] === mlsMpmParticleUpload[field]
  ));

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    ready: blockers.length === 0,
    blockers,
    particleCount: blockers.includes('particle-count-mismatch-or-invalid')
      ? null
      : sphParticleCount,
    sourceStep: explicitFiniteNumber(sphStep) ? sphStep : null,
    sourceTimeS: explicitFiniteNumber(sphTimeS) ? sphTimeS : null,
    stateStrideBytes: stateStrideBytes === expectedStateStrideBytes ? stateStrideBytes : null,
    thermoStrideBytes: thermoStrideBytes === expectedThermoStrideBytes ? thermoStrideBytes : null,
    mechanicsStrideBytes: mechanicsStrideBytes === expectedMechanicsStrideBytes
      ? mechanicsStrideBytes
      : null,
    metadataCoherenceVerified: blockers.length === 0,
    sharedSlotIdentityVerified: blockers.length === 0 && sharedSlotIdentityVerified,
    coherenceLevel: blockers.length > 0
      ? 'blocked'
      : (sharedSlotIdentityVerified ? 'shared-slot-and-metadata' : 'metadata-only'),
    requireTimeZero: Boolean(requireTimeZero),
    timeZeroProvenanceVerified: Boolean(
      requireTimeZero
      && blockers.length === 0
      && sphStep === 0
      && sphTimeS === 0
    )
  };
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
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.minVolumeRatioJ] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxVolumeRatioJ] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.minPressurePa] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.minDensityKgPerM3] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.minVelocityDivergencePerS] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.minDetF] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.minVyMPerS] = positiveInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxPressurePa] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxDensityKgPerM3] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxVelocityDivergencePerS] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxAbsVelocityDivergencePerS] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxDetF] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxEosModelId] = negativeInfinity;
    words[offset + SPH_CHECKPOINT_BUCKET_WORD.maxVyMPerS] = negativeInfinity;
  }
  return words;
}

export function decodeAuthoritativeGpuEvidence({
  words,
  bucketCapacity = SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY,
  particleCount = null,
  stateStrideFloats = SPH_CHECKPOINT_STATE_STRIDE_FLOATS,
  thermoStrideFloats = SPH_CHECKPOINT_THERMO_STRIDE_FLOATS,
  mechanicsStrideFloats = SPH_CHECKPOINT_MECHANICS_STRIDE_FLOATS,
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
    const speedSampleCount = words[offset + bucketWord.speedSampleCount];
    const mechanicsSampleCount = words[offset + bucketWord.mechanicsSampleCount];
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
      kineticEnergySampleMassKg: wordFloat(words[offset + bucketWord.kineticEnergySampleMassKg]),
      speedSampleCount,
      maxSpeedMPerS: speedSampleCount > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxSpeedMPerS]))
        : null,
      mechanicsSampleCount,
      minVolumeRatioJ: mechanicsSampleCount > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.minVolumeRatioJ]))
        : null,
      solidBranchCount: words[offset + bucketWord.solidBranchCount],
      vySampleMassKg: wordFloat(words[offset + bucketWord.vySampleMassKg]),
      meanVyMPerS: wordFloat(words[offset + bucketWord.vySampleMassKg]) > 0
        ? wordFloat(words[offset + bucketWord.massWeightedVySumKgMPerS])
          / wordFloat(words[offset + bucketWord.vySampleMassKg])
        : null,
      minVyMPerS: wordFloat(words[offset + bucketWord.vySampleMassKg]) > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.minVyMPerS]))
        : null,
      maxVyMPerS: wordFloat(words[offset + bucketWord.vySampleMassKg]) > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxVyMPerS]))
        : null,
      detFSampleCount: words[offset + bucketWord.detFSampleCount],
      minDetF: words[offset + bucketWord.detFSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.minDetF]))
        : null,
      maxDetF: words[offset + bucketWord.detFSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxDetF]))
        : null,
      maxEosModelId: words[offset + bucketWord.detFSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxEosModelId]))
        : null,
      divergenceSampleCount: words[offset + bucketWord.divergenceSampleCount],
      minVelocityDivergencePerS: words[offset + bucketWord.divergenceSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.minVelocityDivergencePerS]))
        : null,
      maxVelocityDivergencePerS: words[offset + bucketWord.divergenceSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxVelocityDivergencePerS]))
        : null,
      maxAbsVelocityDivergencePerS: words[offset + bucketWord.divergenceSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxAbsVelocityDivergencePerS]))
        : null,
      densitySampleCount: words[offset + bucketWord.densitySampleCount],
      minDensityKgPerM3: words[offset + bucketWord.densitySampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.minDensityKgPerM3]))
        : null,
      maxDensityKgPerM3: words[offset + bucketWord.densitySampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxDensityKgPerM3]))
        : null,
      pressureSampleCount: words[offset + bucketWord.pressureSampleCount],
      minPressurePa: words[offset + bucketWord.pressureSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.minPressurePa]))
        : null,
      maxPressurePa: words[offset + bucketWord.pressureSampleCount] > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxPressurePa]))
        : null,
      maxVolumeRatioJ: mechanicsSampleCount > 0
        ? finiteOrNull(wordFloat(words[offset + bucketWord.maxVolumeRatioJ]))
        : null,
      mechanicsProblemParticleCount: Math.max(
        0,
        words[offset + bucketWord.liveParticleCount] - mechanicsSampleCount
      ),
      phaseWeightedRestVolumeM3:
        wordFloat(words[offset + bucketWord.phaseWeightedRestVolumeM3]),
      phaseWeightedCurrentVolumeM3:
        wordFloat(words[offset + bucketWord.phaseWeightedCurrentVolumeM3]),
      phaseWeightedRepresentedVolumeM3:
        wordFloat(words[offset + bucketWord.phaseWeightedRepresentedVolumeM3]),
      volumeRatioCapBoundaryContributionCount:
        words[offset + bucketWord.volumeRatioCapBoundaryContributionCount]
    });
  }
  materialPhases.sort((left, right) => (
    left.materialId - right.materialId || left.phaseId - right.phaseId
  ));

  const overflowContributionCount = words[global.overflowContributionCount];
  const speedSampleCount = words[global.speedSampleCount];
  const mechanicsSampleCount = words[global.mechanicsSampleCount];
  const invalidMechanicsParticleCount = words[global.invalidMechanicsParticleCount];
  const liveParticleCount = words[global.liveParticleCount];
  return {
    schema: SPH_AUTHORITATIVE_GPU_CHECKPOINT_REDUCTION_SCHEMA,
    status: 'gpu-reduced',
    backend: 'webgpu-compute',
    reductionStrategy: 'fixed-capacity-open-addressed-material-phase-table',
    particleCount: positiveInteger(particleCount, words[global.processedParticleCount]),
    processedParticleCount: words[global.processedParticleCount],
    liveParticleCount,
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
    mechanicsStrideFloats,
    speedSampleCount,
    speedEvidenceStatus: speedSampleCount === liveParticleCount
      ? 'complete'
      : 'incomplete-sample-count',
    mechanicsSampleCount,
    invalidMechanicsParticleCount,
    mechanicsEvidenceStatus: (
      invalidMechanicsParticleCount === 0
      && mechanicsSampleCount === liveParticleCount
    ) ? 'complete' : 'incomplete-invalid-or-missing-mechanics',
    volumeRatioCapBoundaryParticleCount: words[global.volumeRatioCapBoundaryParticleCount],
    volumeRatioCapEvidenceMode: 'post-state-boundary-observation',
    volumeRatioCapPolicy: {
      source: 'retained-g2p-effective-output-bounds',
      condensedSolidOrTaitMaxJ: SPH_CHECKPOINT_CONDENSED_VOLUME_RATIO_CAP_J,
      generalMaxJ: SPH_CHECKPOINT_GENERAL_VOLUME_RATIO_CAP_J,
      gasLinearizedMaxJ: SPH_CHECKPOINT_GAS_VOLUME_RATIO_CAP_J
    },
    totals: {
      massKg: wordFloat(words[global.totalMassKg]),
      internalEnergyJ: wordFloat(words[global.internalEnergyJ]),
      kineticEnergyJ: wordFloat(words[global.kineticEnergyJ]),
      phaseWeightedRestVolumeM3: materialPhases.reduce(
        (sum, row) => sum + row.phaseWeightedRestVolumeM3,
        0
      ),
      phaseWeightedCurrentVolumeM3: materialPhases.reduce(
        (sum, row) => sum + row.phaseWeightedCurrentVolumeM3,
        0
      ),
      phaseWeightedRepresentedVolumeM3: materialPhases.reduce(
        (sum, row) => sum + row.phaseWeightedRepresentedVolumeM3,
        0
      )
    },
    materialPhases
  };
}

export const SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL = /* wgsl */ `
struct Params {
  particle_count: u32,
  state_stride_vec4: u32,
  thermo_stride_vec4: u32,
  mechanics_stride_vec4: u32,
  bucket_capacity: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
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
  speed_sample_count: atomic<u32>,
  max_speed_m_per_s: atomic<u32>,
  mechanics_sample_count: atomic<u32>,
  min_volume_ratio_j: atomic<u32>,
  max_volume_ratio_j: atomic<u32>,
  phase_weighted_rest_volume_m3: atomic<u32>,
  phase_weighted_current_volume_m3: atomic<u32>,
  phase_weighted_represented_volume_m3: atomic<u32>,
  volume_ratio_cap_boundary_contribution_count: atomic<u32>,
  pressure_sample_count: atomic<u32>,
  min_pressure_pa: atomic<u32>,
  max_pressure_pa: atomic<u32>,
  solid_branch_count: atomic<u32>,
  density_sample_count: atomic<u32>,
  min_density_kg_per_m3: atomic<u32>,
  max_density_kg_per_m3: atomic<u32>,
  divergence_sample_count: atomic<u32>,
  min_velocity_divergence_per_s: atomic<u32>,
  max_velocity_divergence_per_s: atomic<u32>,
  max_abs_velocity_divergence_per_s: atomic<u32>,
  det_f_sample_count: atomic<u32>,
  min_det_f: atomic<u32>,
  max_det_f: atomic<u32>,
  max_eos_model_id: atomic<u32>,
  vy_sample_mass_kg: atomic<u32>,
  mass_weighted_vy_sum_kg_m_per_s: atomic<u32>,
  min_vy_m_per_s: atomic<u32>,
  max_vy_m_per_s: atomic<u32>,
};

@group(0) @binding(0) var<storage, read> state_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> thermo_rows: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mechanics_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> global_words: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> buckets: array<MaterialPhaseBucket>;
@group(0) @binding(5) var<uniform> params: Params;

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

fn volume_ratio_cap_j(solid_flag: f32, eos_model_id: f32) -> f32 {
  let is_condensed = solid_flag > 0.5 || (eos_model_id > 0.5 && eos_model_id < 1.5);
  let is_gas = eos_model_id > 1.5 && eos_model_id < 2.5;
  return select(select(
    ${SPH_CHECKPOINT_GENERAL_VOLUME_RATIO_CAP_J}.0,
    ${SPH_CHECKPOINT_GAS_VOLUME_RATIO_CAP_J}.0,
    is_gas
  ), ${SPH_CHECKPOINT_CONDENSED_VOLUME_RATIO_CAP_J}, is_condensed);
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
  velocity_m_per_s: vec3<f32>,
  speed_valid: bool,
  speed_m_per_s: f32,
  mechanics_valid: bool,
  volume_ratio_j: f32,
  rest_volume_m3: f32,
  current_volume_m3: f32,
  represented_volume_m3: f32,
  volume_ratio_cap_hit: bool,
  pressure_valid: bool,
  resolved_pressure_pa: f32,
  solid_branch: bool,
  density_valid: bool,
  density_kg_per_m3: f32,
  divergence_valid: bool,
  velocity_divergence_per_s: f32,
  det_f_valid: bool,
  det_f: f32,
  eos_model_id: f32,
  vy_valid: bool,
  vy_m_per_s: f32
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
  if (speed_valid) {
    atomicAdd(&buckets[index].speed_sample_count, 1u);
    atomic_max_f32(&buckets[index].max_speed_m_per_s, speed_m_per_s);
  }
  if (mechanics_valid) {
    atomicAdd(&buckets[index].mechanics_sample_count, 1u);
    atomic_min_f32(&buckets[index].min_volume_ratio_j, volume_ratio_j);
    atomic_max_f32(&buckets[index].max_volume_ratio_j, volume_ratio_j);
    atomic_add_f32(&buckets[index].phase_weighted_rest_volume_m3, rest_volume_m3 * fraction);
    atomic_add_f32(&buckets[index].phase_weighted_current_volume_m3, current_volume_m3 * fraction);
    atomic_add_f32(
      &buckets[index].phase_weighted_represented_volume_m3,
      represented_volume_m3 * fraction
    );
    if (volume_ratio_cap_hit) {
      atomicAdd(&buckets[index].volume_ratio_cap_boundary_contribution_count, 1u);
    }
  }
  if (pressure_valid) {
    atomicAdd(&buckets[index].pressure_sample_count, 1u);
    atomic_min_f32(&buckets[index].min_pressure_pa, resolved_pressure_pa);
    atomic_max_f32(&buckets[index].max_pressure_pa, resolved_pressure_pa);
  }
  if (solid_branch) {
    atomicAdd(&buckets[index].solid_branch_count, 1u);
  }
  if (density_valid) {
    atomicAdd(&buckets[index].density_sample_count, 1u);
    atomic_min_f32(&buckets[index].min_density_kg_per_m3, density_kg_per_m3);
    atomic_max_f32(&buckets[index].max_density_kg_per_m3, density_kg_per_m3);
  }
  if (vy_valid) {
    atomic_add_f32(&buckets[index].vy_sample_mass_kg, contribution_mass_kg);
    atomic_add_f32(
      &buckets[index].mass_weighted_vy_sum_kg_m_per_s,
      contribution_mass_kg * vy_m_per_s
    );
    atomic_min_f32(&buckets[index].min_vy_m_per_s, vy_m_per_s);
    atomic_max_f32(&buckets[index].max_vy_m_per_s, vy_m_per_s);
  }
  if (det_f_valid) {
    atomicAdd(&buckets[index].det_f_sample_count, 1u);
    atomic_min_f32(&buckets[index].min_det_f, det_f);
    atomic_max_f32(&buckets[index].max_det_f, det_f);
    atomic_max_f32(&buckets[index].max_eos_model_id, eos_model_id);
  }
  if (divergence_valid) {
    atomicAdd(&buckets[index].divergence_sample_count, 1u);
    atomic_min_f32(&buckets[index].min_velocity_divergence_per_s, velocity_divergence_per_s);
    atomic_max_f32(&buckets[index].max_velocity_divergence_per_s, velocity_divergence_per_s);
    atomic_max_f32(
      &buckets[index].max_abs_velocity_divergence_per_s,
      abs(velocity_divergence_per_s)
    );
  }
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) invocation_id: vec3<u32>) {
  let particle_index = invocation_id.x;
  if (particle_index >= params.particle_count) { return; }
  atomicAdd(&global_words[10], 1u);

  let state_base = particle_index * params.state_stride_vec4;
  let thermo_base = particle_index * params.thermo_stride_vec4;
  let mechanics_base = particle_index * params.mechanics_stride_vec4;
  let state0 = state_rows[state_base];
  let state1 = state_rows[state_base + 1u];
  let thermo0 = thermo_rows[thermo_base];
  let thermo1 = thermo_rows[thermo_base + 1u];
  let mechanics0 = mechanics_rows[mechanics_base];
  let mechanics1 = mechanics_rows[mechanics_base + 1u];
  let mechanics2 = mechanics_rows[mechanics_base + 2u];
  let mechanics3 = mechanics_rows[mechanics_base + 3u];
  let mechanics4 = mechanics_rows[mechanics_base + 4u];
  let mechanics5 = mechanics_rows[mechanics_base + 5u];
  let mechanics6 = mechanics_rows[mechanics_base + 6u];
  let mechanics7 = mechanics_rows[mechanics_base + 7u];
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
  let speed_valid = all(state1.xyz == state1.xyz) && finite_f32(speed_squared) && speed_squared >= 0.0;
  let speed_m_per_s = select(0.0, sqrt(max(speed_squared, 0.0)), speed_valid);
  if (speed_valid) {
    atomic_add_f32(&global_words[8], 0.5 * mass_kg * speed_squared);
    atomicAdd(&global_words[16], 1u);
  }

  let volume_ratio_j = mechanics4.z;
  let rest_volume_m3 = mechanics4.w;
  let current_volume_m3 = rest_volume_m3 * max(volume_ratio_j, 1e-6);
  let solid_flag = mechanics5.x;
  let eos_model_id = mechanics6.z;
  // resolvedAbsolutePressurePa, mechanics float 28 = vec4 7 component 0.
  let resolved_pressure_pa = mechanics7.x;
  let pressure_valid = finite_f32(resolved_pressure_pa);
  // Mirror the EOS's own branch test and density exactly (ulg-gpu-abi/src/wgsl.js
  // "mechanics constitutive pressure"): volume is authoritative only when both
  // stored V0 and J are finite-positive, the corotated branch is taken when
  // solid_flag > 0.5 && shear modulus > 0, and the fluid branch divides mass by
  // that same volume. Recomputing it here rather than reading a published flag
  // keeps this evidence honest if the branch test ever moves.
  let eos_volume_m3 = select(
    0.0,
    rest_volume_m3 * volume_ratio_j,
    rest_volume_m3 > 0.0 && volume_ratio_j > 0.0
  );
  let solid_branch = eos_volume_m3 > 0.0 && solid_flag > 0.5 && mechanics5.w > 0.0;
  let density_valid = eos_volume_m3 > 0.0 && finite_f32(mass_kg);
  let density_kg_per_m3 = select(0.0, mass_kg / eos_volume_m3, density_valid);
  // Mechanics rows 2..4 pack the APIC affine matrix as
  //   row2 = (nf22, c00, c01, c02), row3 = (c10, c11, c12, c20),
  //   row4 = (c21, c22, next_j, rest_volume)
  // so the divergence is c00 + c11 + c22 = row2.y + row3.y + row4.y.
  let velocity_divergence_per_s = mechanics2.y + mechanics3.y + mechanics4.y;
  let divergence_valid = finite_f32(velocity_divergence_per_s);
  // F is packed as row0 = (f00,f01,f02,f10), row1 = (f11,f12,f20,f21),
  // row2.x = f22 -- the same unpacking the G2P integrator does.
  let f00 = mechanics0.x; let f01 = mechanics0.y; let f02 = mechanics0.z;
  let f10 = mechanics0.w; let f11 = mechanics1.x; let f12 = mechanics1.y;
  let f20 = mechanics1.z; let f21 = mechanics1.w; let f22 = mechanics2.x;
  let det_f = f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
  let det_f_valid = finite_f32(det_f);
  let vy_m_per_s = state1.y;
  let vy_valid = finite_f32(vy_m_per_s);
  let rest_density_kg_per_m3 = thermo0.w;
  let phase_volume_reference_mass_kg = mechanics7.w;
  var density_represented_volume_m3 = 0.0;
  if (phase_volume_reference_mass_kg > 0.0 && rest_density_kg_per_m3 > 0.0) {
    density_represented_volume_m3 = phase_volume_reference_mass_kg / rest_density_kg_per_m3;
  }
  var represented_volume_m3 = max(current_volume_m3, density_represented_volume_m3);
  if (!(represented_volume_m3 > 0.0) && rest_density_kg_per_m3 > 0.0 && mass_kg > 0.0) {
    represented_volume_m3 = mass_kg / rest_density_kg_per_m3;
  }
  let mechanics_valid = finite_f32(volume_ratio_j)
    && volume_ratio_j > 0.0
    && finite_f32(rest_volume_m3)
    && rest_volume_m3 > 0.0
    && finite_f32(current_volume_m3)
    && current_volume_m3 > 0.0
    && finite_f32(represented_volume_m3)
    && represented_volume_m3 > 0.0
    && finite_f32(solid_flag)
    && finite_f32(eos_model_id)
    && finite_f32(rest_density_kg_per_m3)
    && rest_density_kg_per_m3 >= 0.0
    && finite_f32(phase_volume_reference_mass_kg)
    && phase_volume_reference_mass_kg >= 0.0;
  let volume_ratio_cap = volume_ratio_cap_j(solid_flag, eos_model_id);
  let cap_epsilon = max(1e-4, volume_ratio_cap * 1e-6);
  let volume_ratio_cap_hit = mechanics_valid && volume_ratio_j >= volume_ratio_cap - cap_epsilon;
  if (mechanics_valid) {
    atomicAdd(&global_words[17], 1u);
    if (volume_ratio_cap_hit) { atomicAdd(&global_words[19], 1u); }
  } else {
    atomicAdd(&global_words[18], 1u);
  }

  let material_id = select(0u, u32(max(round(thermo0.x), 0.0)), finite_f32(thermo0.x));
  let raw_fractions = max(thermo1, vec4<f32>(0.0));
  let fraction_sum = dot(raw_fractions, vec4<f32>(1.0));
  if (finite_f32(fraction_sum) && fraction_sum > 0.0) {
    let residual = abs(fraction_sum - 1.0);
    atomic_max_f32(&global_words[13], residual);
    atomic_add_f32(&global_words[14], mass_kg * residual);
    if (residual > 1e-4) { atomicAdd(&global_words[11], 1u); }
    contribute_phase(material_id, 1u, raw_fractions.x, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz, speed_valid, speed_m_per_s, mechanics_valid, volume_ratio_j, rest_volume_m3, current_volume_m3, represented_volume_m3, volume_ratio_cap_hit, pressure_valid, resolved_pressure_pa, solid_branch, density_valid, density_kg_per_m3, divergence_valid, velocity_divergence_per_s, det_f_valid, det_f, eos_model_id, vy_valid, vy_m_per_s);
    contribute_phase(material_id, 2u, raw_fractions.y, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz, speed_valid, speed_m_per_s, mechanics_valid, volume_ratio_j, rest_volume_m3, current_volume_m3, represented_volume_m3, volume_ratio_cap_hit, pressure_valid, resolved_pressure_pa, solid_branch, density_valid, density_kg_per_m3, divergence_valid, velocity_divergence_per_s, det_f_valid, det_f, eos_model_id, vy_valid, vy_m_per_s);
    contribute_phase(material_id, 3u, raw_fractions.z, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz, speed_valid, speed_m_per_s, mechanics_valid, volume_ratio_j, rest_volume_m3, current_volume_m3, represented_volume_m3, volume_ratio_cap_hit, pressure_valid, resolved_pressure_pa, solid_branch, density_valid, density_kg_per_m3, divergence_valid, velocity_divergence_per_s, det_f_valid, det_f, eos_model_id, vy_valid, vy_m_per_s);
    contribute_phase(material_id, 4u, raw_fractions.w, mass_kg, state0.y, thermo0.z, state1.w, state1.xyz, speed_valid, speed_m_per_s, mechanics_valid, volume_ratio_j, rest_volume_m3, current_volume_m3, represented_volume_m3, volume_ratio_cap_hit, pressure_valid, resolved_pressure_pa, solid_branch, density_valid, density_kg_per_m3, divergence_valid, velocity_divergence_per_s, det_f_valid, det_f, eos_model_id, vy_valid, vy_m_per_s);
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
  mechanicsBuffer,
  particleCount,
  stateStrideBytes = SPH_CHECKPOINT_STATE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
  thermoStrideBytes = SPH_CHECKPOINT_THERMO_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
  mechanicsStrideBytes = SPH_CHECKPOINT_MECHANICS_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT,
  materialKeyById = {},
  bucketCapacity = SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY,
  label = 'ulg-sph-authoritative-checkpoint'
} = {}) {
  if (!device?.createBuffer || !device?.createCommandEncoder || !device.queue?.submit) {
    throw new TypeError('authoritative GPU checkpoint reduction requires a GPUDevice');
  }
  if (!stateBuffer || !thermoBuffer || !mechanicsBuffer) {
    throw new TypeError(
      'authoritative GPU checkpoint reduction requires retained state, thermo, and mechanics buffers'
    );
  }
  const count = explicitPositiveInteger(particleCount) ? particleCount : null;
  const capacity = positiveInteger(bucketCapacity, SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY);
  if (!count) throw new RangeError('authoritative GPU checkpoint particle count must be positive');
  if (
    stateStrideBytes !== SPH_CHECKPOINT_STATE_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    || thermoStrideBytes !== SPH_CHECKPOINT_THERMO_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT
    || mechanicsStrideBytes !== SPH_CHECKPOINT_MECHANICS_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT
  ) {
    throw new RangeError('authoritative GPU checkpoint strides must exactly match the v0 particle ABI');
  }
  for (const [name, buffer, strideBytes] of [
    ['state', stateBuffer, stateStrideBytes],
    ['thermo', thermoBuffer, thermoStrideBytes],
    ['mechanics', mechanicsBuffer, mechanicsStrideBytes]
  ]) {
    const byteLength = buffer?.size;
    if (!explicitPositiveInteger(byteLength) || byteLength < count * strideBytes) {
      throw new RangeError(
        `authoritative GPU checkpoint ${name} buffer is smaller than the requested particle range`
      );
    }
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
    mechanicsStrideBytes / 16,
    capacity,
    0,
    0,
    0
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
        { binding: 2, resource: { buffer: mechanicsBuffer } },
        { binding: 3, resource: { buffer: globalBuffer } },
        { binding: 4, resource: { buffer: bucketBuffer } },
        { binding: 5, resource: { buffer: paramsBuffer } }
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
      mechanicsStrideFloats: mechanicsStrideBytes / Float32Array.BYTES_PER_ELEMENT,
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
        mappedParticleMechanicsByteLength: 0,
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
