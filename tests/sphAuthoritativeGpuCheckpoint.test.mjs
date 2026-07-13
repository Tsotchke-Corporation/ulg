import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL,
  SPH_CHECKPOINT_BUCKET_WORD,
  SPH_CHECKPOINT_BUCKET_WORDS,
  SPH_CHECKPOINT_GLOBAL_WORD,
  SPH_CHECKPOINT_GLOBAL_WORDS,
  createAuthoritativeGpuEvidenceWords,
  decodeAuthoritativeGpuEvidence,
  materialKeyByIdFromSphViewState
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
    const integer = ['key', 'materialId', 'phaseId', 'liveParticleCount', 'temperatureSampleCount'].includes(key);
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
    kineticEnergySampleMassKg: 3
  });
  setBucket(words, 1, {
    key: 989,
    materialId: 123,
    phaseId: 1,
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
    kineticEnergySampleMassKg: 3
  });

  const result = decodeAuthoritativeGpuEvidence({
    words,
    bucketCapacity: capacity,
    particleCount: 5,
    materialKeyById: { 11: 'Na', 123: 'naoh' }
  });

  assert.equal(result.status, 'gpu-reduced');
  assert.equal(result.backend, 'webgpu-compute');
  assert.equal(result.materialPhaseCapacityStatus, 'within-capacity');
  assert.equal(result.materialMappingStatus, 'complete');
  assert.equal(result.liveParticleCount, 4);
  assert.deepEqual(result.totals, { massKg: 6.5, internalEnergyJ: 70, kineticEnergyJ: 16.5 });
  const sodiumLiquid = result.materialPhases.find((row) => row.material === 'Na');
  assert.equal(sodiumLiquid.phase, 'liquid');
  assert.equal(sodiumLiquid.phaseWeightedParticleCount, 1.75);
  assert.equal(sodiumLiquid.yCenterMassWeightedM, 2);
  assert.equal(sodiumLiquid.temperatureMeanK, 450);
  assert.equal(sodiumLiquid.temperatureMassWeightedMeanK, 400);
  assert.equal(sodiumLiquid.kineticEnergyJ, 3);
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

test('checkpoint shader is general, fixed-capacity, and preserves raw phase fractions', () => {
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /@compute @workgroup_size\(128\)/);
  assert.match(SPH_AUTHORITATIVE_GPU_CHECKPOINT_WGSL, /fn claim_bucket\(material_id: u32, phase_id: u32\)/);
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
