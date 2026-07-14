import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

import {
  SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL,
  SPH_CHECKPOINT_BUCKET_WORD,
  SPH_CHECKPOINT_BUCKET_WORDS,
  SPH_CHECKPOINT_GLOBAL_WORD,
  SPH_CHECKPOINT_GLOBAL_WORDS,
  createAuthoritativeGpuEvidenceWords,
  decodeAuthoritativeGpuEvidence,
  materialKeyByIdFromSphViewState,
  validateAuthoritativeGpuUploadPair
} from '../scripts/sph-authoritative-gpu-checkpoint.mjs';

function floatWord(value) {
  const row = new Float32Array([value]);
  return new Uint32Array(row.buffer)[0];
}

function setGlobal(words, key, value, { float = false } = {}) {
  words[SPH_CHECKPOINT_GLOBAL_WORD[key]] = float ? floatWord(value) : value;
}

function setBucket(words, bucketIndex, values) {
  const offset = SPH_CHECKPOINT_GLOBAL_WORDS + bucketIndex * SPH_CHECKPOINT_BUCKET_WORDS;
  for (const [key, value] of Object.entries(values)) {
    const word = SPH_CHECKPOINT_BUCKET_WORD[key];
    const integer = [
      'key',
      'materialId',
      'phaseId',
      'liveParticleCount',
      'temperatureSampleCount',
      'speedSampleCount',
      'mechanicsSampleCount',
      'volumeRatioCapBoundaryContributionCount'
    ].includes(key);
    words[offset + word] = integer ? value : floatWord(value);
  }
}

test('fixed GPU evidence decoder preserves material-phase physics summaries', () => {
  const capacity = 4;
  const words = createAuthoritativeGpuEvidenceWords(capacity);
  setGlobal(words, 'processedParticleCount', 5);
  setGlobal(words, 'liveParticleCount', 4);
  setGlobal(words, 'nonPositiveMassParticleCount', 1);
  setGlobal(words, 'materialPhaseCount', 2);
  setGlobal(words, 'phaseContributionCount', 4);
  setGlobal(words, 'totalMassKg', 6.5, { float: true });
  setGlobal(words, 'internalEnergyJ', 70, { float: true });
  setGlobal(words, 'kineticEnergyJ', 16.5, { float: true });
  setGlobal(words, 'speedSampleCount', 4);
  setGlobal(words, 'mechanicsSampleCount', 4);
  setGlobal(words, 'volumeRatioCapBoundaryParticleCount', 1);
  setBucket(words, 0, {
    key: 90,
    materialId: 11,
    phaseId: 2,
    liveParticleCount: 2,
    phaseWeightedParticleCount: 1.75,
    massKg: 3,
    yMinM: 1,
    yMaxM: 4,
    massWeightedYSumKgM: 6,
    ySampleMassKg: 3,
    temperatureSampleCount: 2,
    temperatureSumK: 900,
    temperatureMassWeightedSumKgK: 1200,
    temperatureSampleMassKg: 3,
    temperatureMinK: 300,
    temperatureMaxK: 600,
    internalEnergyJ: 40,
    internalEnergySampleMassKg: 3,
    kineticEnergyJ: 3,
    kineticEnergySampleMassKg: 3,
    speedSampleCount: 2,
    maxSpeedMPerS: 3,
    mechanicsSampleCount: 2,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.04,
    phaseWeightedRestVolumeM3: 0.003,
    phaseWeightedCurrentVolumeM3: 0.0031,
    phaseWeightedRepresentedVolumeM3: 0.0035,
    volumeRatioCapBoundaryContributionCount: 0
  });
  setBucket(words, 1, {
    key: 989,
    materialId: 123,
    phaseId: 3,
    liveParticleCount: 1,
    phaseWeightedParticleCount: 1,
    massKg: 3,
    yMinM: 2,
    yMaxM: 2,
    massWeightedYSumKgM: 6,
    ySampleMassKg: 3,
    temperatureSampleCount: 1,
    temperatureSumK: 500,
    temperatureMassWeightedSumKgK: 1500,
    temperatureSampleMassKg: 3,
    temperatureMinK: 500,
    temperatureMaxK: 500,
    internalEnergyJ: 15,
    internalEnergySampleMassKg: 3,
    kineticEnergyJ: 13.5,
    kineticEnergySampleMassKg: 3,
    speedSampleCount: 1,
    maxSpeedMPerS: 3,
    mechanicsSampleCount: 1,
    minVolumeRatioJ: 1000,
    maxVolumeRatioJ: 1000,
    phaseWeightedRestVolumeM3: 0.004,
    phaseWeightedCurrentVolumeM3: 4,
    phaseWeightedRepresentedVolumeM3: 4,
    volumeRatioCapBoundaryContributionCount: 1
  });

  const result = decodeAuthoritativeGpuEvidence({
    words,
    bucketCapacity: capacity,
    particleCount: 5,
    materialKeyById: { 11: 'Na', 123: 'h2' }
  });

  assert.equal(result.status, 'gpu-reduced');
  assert.equal(result.backend, 'webgpu-compute');
  assert.equal(result.materialPhaseCapacityStatus, 'within-capacity');
  assert.equal(result.materialMappingStatus, 'complete');
  assert.equal(result.liveParticleCount, 4);
  assert.equal(result.totals.massKg, 6.5);
  assert.equal(result.totals.internalEnergyJ, 70);
  assert.equal(result.totals.kineticEnergyJ, 16.5);
  assert.ok(Math.abs(result.totals.phaseWeightedRestVolumeM3 - 0.007) < 1e-7);
  assert.ok(Math.abs(result.totals.phaseWeightedCurrentVolumeM3 - 4.0031) < 1e-6);
  assert.ok(Math.abs(result.totals.phaseWeightedRepresentedVolumeM3 - 4.0035) < 1e-6);
  assert.equal(result.speedEvidenceStatus, 'complete');
  assert.equal(result.mechanicsEvidenceStatus, 'complete');
  assert.equal(result.volumeRatioCapBoundaryParticleCount, 1);
  const sodiumLiquid = result.materialPhases.find((row) => row.material === 'Na');
  assert.equal(sodiumLiquid.phase, 'liquid');
  assert.equal(sodiumLiquid.phaseWeightedParticleCount, 1.75);
  assert.equal(sodiumLiquid.yCenterMassWeightedM, 2);
  assert.equal(sodiumLiquid.temperatureMeanK, 450);
  assert.equal(sodiumLiquid.temperatureMassWeightedMeanK, 400);
  assert.equal(sodiumLiquid.kineticEnergyJ, 3);
  assert.equal(sodiumLiquid.speedSampleCount, 2);
  assert.equal(sodiumLiquid.maxSpeedMPerS, 3);
  assert.ok(Math.abs(sodiumLiquid.minVolumeRatioJ - 0.9) < 1e-6);
  assert.ok(Math.abs(sodiumLiquid.maxVolumeRatioJ - 1.04) < 1e-6);
  assert.equal(result.volumeRatioCapPolicy.condensedSolidOrTaitMaxJ, 1.05);
  assert.equal(result.volumeRatioCapPolicy.generalMaxJ, 64);
  assert.equal(result.volumeRatioCapPolicy.gasLinearizedMaxJ, 1000);
  const hydrogenGas = result.materialPhases.find((row) => row.material === 'h2');
  assert.equal(hydrogenGas.phase, 'gas');
  assert.equal(hydrogenGas.maxVolumeRatioJ, 1000);
  assert.equal(hydrogenGas.volumeRatioCapBoundaryContributionCount, 1);
});

test('fixed GPU evidence reports hard-capacity overflow and phase residuals', () => {
  const words = createAuthoritativeGpuEvidenceWords(1);
  setGlobal(words, 'processedParticleCount', 3);
  setGlobal(words, 'liveParticleCount', 3);
  setGlobal(words, 'materialPhaseCount', 1);
  setGlobal(words, 'phaseContributionCount', 4);
  setGlobal(words, 'overflowContributionCount', 3);
  setGlobal(words, 'overflowMassKg', 2.5, { float: true });
  setGlobal(words, 'phaseFractionProblemParticleCount', 1);
  setGlobal(words, 'phaseFractionFallbackParticleCount', 1);
  setGlobal(words, 'maxPhaseFractionResidual', 0.2, { float: true });
  setGlobal(words, 'phaseFractionResidualAbsKg', 2, { float: true });
  setGlobal(words, 'unclassifiedMassKg', 4, { float: true });
  setBucket(words, 0, {
    key: 90,
    materialId: 11,
    phaseId: 2,
    liveParticleCount: 1,
    phaseWeightedParticleCount: 0.8,
    massKg: 8
  });

  const result = decodeAuthoritativeGpuEvidence({ words, bucketCapacity: 1 });
  assert.equal(result.materialPhaseCapacity, 1);
  assert.equal(result.materialPhaseCapacityStatus, 'overflow');
  assert.equal(result.overflowContributionCount, 3);
  assert.equal(result.overflowMassKg, 2.5);
  assert.equal(result.phaseFractionProblemParticleCount, 1);
  assert.equal(result.phaseFractionFallbackParticleCount, 1);
  assert.ok(Math.abs(result.maxPhaseFractionResidual - 0.2) < 1e-6);
  assert.equal(result.phaseFractionResidualAbsKg, 2);
  assert.equal(result.unclassifiedMassKg, 4);
  assert.equal(result.materialMappingStatus, 'unmapped-material-ids');
  assert.deepEqual(result.unmappedMaterialIds, [11]);
  assert.equal(result.mechanicsEvidenceStatus, 'incomplete-invalid-or-missing-mechanics');
  assert.equal(result.materialPhases[0].minVolumeRatioJ, null);
  assert.equal(result.materialPhases[0].maxVolumeRatioJ, null);
});

test('checkpoint material-ID map preserves atomic IDs and derives reaction-product IDs', () => {
  const map = materialKeyByIdFromSphViewState({
    materialProperties: { Na: {}, h2o: {}, naoh: {}, h2: {} },
    sphGpuParticleState: {
      metadata: [
        { material: 'Na', materialId: 11 },
        { material: 'h2o', materialId: 7_507_140 }
      ]
    },
    reactions: [{
      product: 'naoh',
      stoichiometry: {
        products: [
          { material: 'naoh', formula: 'NaOH' },
          { material: 'h2', formula: 'H2' }
        ]
      }
    }]
  });

  assert.equal(map[11], 'Na');
  assert.equal(map[7_507_140], 'h2o');
  assert.ok(Object.values(map).includes('naoh'));
  assert.ok(Object.values(map).includes('h2'));
});

test('authoritative checkpoint upload pairs fail closed on torn mechanics generations', () => {
  const stateBuffer = { label: 'state', size: 4 * 32 };
  const thermoBuffer = { label: 'thermo', size: 4 * 48 };
  const mechanicsBuffer = { label: 'mechanics', size: 4 * 128 };
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    stateBuffer,
    thermoBuffer,
    particleCount: 4,
    stateStrideBytes: 32,
    thermoStrideBytes: 48,
    slot: 1,
    sourceSlot: 0,
    nextSlot: 1,
    step: 8,
    time: 0.004
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    mechanicsBuffer,
    particleCount: 4,
    mechanicsStrideBytes: 128,
    slot: 1,
    sourceSlot: 0,
    nextSlot: 1,
    step: 8,
    time: 0.004
  };

  const coherentPair = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload,
    expectedStep: 8,
    expectedTimeS: 0.004,
    expectedParticleCount: 4
  });
  assert.equal(coherentPair.status, 'ready');
  assert.equal(coherentPair.metadataCoherenceVerified, true);
  assert.equal(coherentPair.sharedSlotIdentityVerified, true);
  assert.equal(coherentPair.coherenceLevel, 'shared-slot-and-metadata');

  for (const [field, value, blocker] of [
    ['step', 7, 'source-step-mismatch-or-invalid'],
    ['time', 0.0035, 'source-time-mismatch-or-invalid'],
    ['particleCount', 3, 'particle-count-mismatch-or-invalid']
  ]) {
    const result = validateAuthoritativeGpuUploadPair({
      sphParticleUpload,
      mlsMpmParticleUpload: { ...mlsMpmParticleUpload, [field]: value }
    });
    assert.equal(result.status, 'blocked');
    assert.ok(result.blockers.includes(blocker));
  }

  const missingMechanics = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload: { ...mlsMpmParticleUpload, mechanicsBuffer: null }
  });
  assert.equal(missingMechanics.status, 'blocked');
  assert.ok(missingMechanics.blockers.includes('mls-mpm-mechanics-buffer-missing'));

  const shortMechanics = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload: {
      ...mlsMpmParticleUpload,
      mechanicsBuffer: { label: 'short-mechanics', size: 3 * 128 }
    }
  });
  assert.equal(shortMechanics.status, 'blocked');
  assert.ok(shortMechanics.blockers.includes('mechanics-buffer-capacity-invalid'));

  const invalidStride = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload: { ...mlsMpmParticleUpload, mechanicsStrideBytes: 0 }
  });
  assert.equal(invalidStride.status, 'blocked');
  assert.ok(invalidStride.blockers.includes('mechanics-stride-invalid'));

  const undersizedAlignedStride = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload: {
      ...mlsMpmParticleUpload,
      mechanicsStrideBytes: 16,
      mechanicsBuffer: { label: 'wrong-abi-mechanics', size: 4 * 16 }
    }
  });
  assert.equal(undersizedAlignedStride.status, 'blocked');
  assert.ok(undersizedAlignedStride.blockers.includes('mechanics-stride-invalid'));

  const wrongSourceSchema = validateAuthoritativeGpuUploadPair({
    sphParticleUpload: { ...sphParticleUpload, sourceSchema: 'wrong-sph-source-schema' },
    mlsMpmParticleUpload
  });
  assert.equal(wrongSourceSchema.status, 'blocked');
  assert.ok(wrongSourceSchema.blockers.includes('sph-particle-source-schema-mismatch'));

  const tornSlot = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload: { ...mlsMpmParticleUpload, slot: 0 }
  });
  assert.equal(tornSlot.status, 'blocked');
  assert.ok(tornSlot.blockers.includes('slot-mismatch-or-invalid'));

  const staleParent = validateAuthoritativeGpuUploadPair({
    sphParticleUpload,
    mlsMpmParticleUpload,
    expectedStep: 9,
    expectedTimeS: 0.004,
    expectedParticleCount: 4
  });
  assert.equal(staleParent.status, 'blocked');
  assert.ok(staleParent.blockers.includes('source-step-does-not-match-parent-generation'));

  const numericStringTimeZero = validateAuthoritativeGpuUploadPair({
    sphParticleUpload: { ...sphParticleUpload, step: '0', time: '0' },
    mlsMpmParticleUpload: { ...mlsMpmParticleUpload, step: '0', time: '0' },
    requireTimeZero: true
  });
  assert.equal(numericStringTimeZero.status, 'blocked');

  const verifiedTimeZero = validateAuthoritativeGpuUploadPair({
    sphParticleUpload: { ...sphParticleUpload, step: 0, time: 0 },
    mlsMpmParticleUpload: { ...mlsMpmParticleUpload, step: 0, time: 0 },
    requireTimeZero: true
  });
  assert.equal(verifiedTimeZero.status, 'ready');
  assert.equal(verifiedTimeZero.timeZeroProvenanceVerified, true);
});

test('checkpoint shader is general, fixed-capacity, and preserves raw phase fractions', () => {
  const words = createAuthoritativeGpuEvidenceWords(64);
  assert.equal(words.byteLength, 7504);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /@compute @workgroup_size\(128\)/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /fn claim_bucket\(material_id: u32, phase_id: u32\)/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /@binding\(2\) var<storage, read> mechanics_rows/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /let current_volume_m3 = rest_volume_m3 \* max\(volume_ratio_j, 1e-6\)/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /phase_volume_reference_mass_kg \/ rest_density_kg_per_m3/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /volume_ratio_cap_boundary_contribution_count/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /probe < params\.bucket_capacity/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /atomicAdd\(&global_words\[5\], 1u\)/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /contribute_phase\(material_id, 1u, raw_fractions\.x/);
  assert.doesNotMatch(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /raw_fractions \/ fraction_sum/);
  assert.doesNotMatch(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /\bNa\b|\bCs\b|h2o|csf|naoh/);
});

test('long-horizon probe maps compact evidence only and keeps compositor fixes', () => {
  const source = readFileSync(
    new URL('../scripts/sph-long-horizon-probe.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /reduceAuthoritativeGpuMaterialPhaseEvidence\(\{/);
  assert.doesNotMatch(source, /ulg-sph-authoritative-checkpoint-state-/);
  assert.doesNotMatch(source, /ulg-sph-authoritative-checkpoint-thermo-/);
  assert.match(source, /mappedByteLength: 0/);
  assert.match(source, /normalHotLoopReadbackFree: true/);
  assert.match(source, /visibleCanvases\.find\(\(candidate\) => candidate === nativeConsumer\?\.canvas\)/);
  assert.match(source, /visibleCanvases\.find\(\(candidate\) => candidate === renderBridge\?\.canvas\)/);
  assert.match(source, /status: 'missing-canvas',[\s\S]*?reason: 'no-visible-canvas-element'[\s\S]*?return;/);
  assert.match(source, /mode: nativeInnerRegionRequested \? 'inner-60-percent' : 'full-canvas'/);
  assert.match(source, /normalizedCanvasRegion: nativeInnerRegionRequested[\s\S]*?x: 0\.2, y: 0\.2, width: 0\.6, height: 0\.6/);
  assert.match(source, /compositorCaptureRegion: frame\.compositorCaptureRegion \?\? null/);
  assert.match(source, /frame\.png\?\.hasVisiblePixels === true[\s\S]*?frame\.png\?\.hasSurfaceLikeVariation === true/);
  assert.match(source, /authoritative-gpu-checkpoint-capacity-overflow/);
  assert.match(source, /checkpoint\.materialMappingStatus === 'complete'/);
  assert.match(source, /finalParticlesByMaterialSource/);
  assert.match(source, /eventCountInferred: false/);
  assert.match(
    source,
    /minReactionEventsTotal === 1[\s\S]*?timeline\?\.readbackMode === 'no-full-readback'[\s\S]*?authoritativeReactionProductMassGrowthConfirmed/,
    'no-readback reaction progress should require authoritative retained-GPU product growth'
  );
  assert.match(
    source,
    /reactionProgressGateEvidenceSource = 'authoritative-gpu-product-mass-growth'/,
    'the probe should label product-mass evidence without fabricating an event counter'
  );
});
