import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ELEMENT_MATERIAL_OPTIONS } from '../src/visualization/sphMaterialOptions.js';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  condensedLaunchEvidence,
  generatedCohortTrajectoryEvidence,
  phaseAwareVolumeRatioEvidence
} from './sph-visual-phase-acceptance.mjs';

const DEFAULT_BASE_PORT = 5310;
const DEFAULT_OUTPUT_DIR = '/tmp/ulg-visual-sanity-matrix';
const DEFAULT_BATCHES = 4;
const DEFAULT_BATCH_STEPS = 24;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_FRAME_MAX = 16;
const DEFAULT_GENERATED_COHORT_MINIMUM_SYSTEM_MASS_FRACTION = 1e-6;

const STANDARD_PHASE_ACCEPTANCE_BY_PRESET = Object.freeze({
  'water-cycle': Object.freeze({
    generatedGas: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']), phases: Object.freeze(['gas']) }),
      interfaceSelector: Object.freeze({ materials: Object.freeze(['h2o']), excludePhases: Object.freeze(['gas']) }),
      minimumMassFractionOfSystem: DEFAULT_GENERATED_COHORT_MINIMUM_SYSTEM_MASS_FRACTION,
      minimumSustainedRiseM: 0.05,
      tailSampleCount: 2
    })
  }),
  'iron-ice-quench': Object.freeze({
    generatedGas: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']), phases: Object.freeze(['gas']) }),
      interfaceSelector: Object.freeze({ materials: Object.freeze(['h2o']), excludePhases: Object.freeze(['gas']) }),
      minimumMassFractionOfSystem: DEFAULT_GENERATED_COHORT_MINIMUM_SYSTEM_MASS_FRACTION,
      minimumSustainedRiseM: 0.05,
      tailSampleCount: 2
    }),
    condensedLaunch: Object.freeze({
      selector: Object.freeze({ excludePhases: Object.freeze(['gas']) }),
      maxUpwardExcursionM: 0.35,
      minimumSampleCount: 4
    })
  }),
  'sodium-water': Object.freeze({
    generatedGas: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2']), phases: Object.freeze(['gas']) }),
      interfaceSelector: Object.freeze({ excludePhases: Object.freeze(['gas']) }),
      minimumMassFractionOfSystem: DEFAULT_GENERATED_COHORT_MINIMUM_SYSTEM_MASS_FRACTION,
      minimumSustainedRiseM: 0.05,
      tailSampleCount: 2
    })
  })
});

const STANDARD_SCENARIOS = SPH_PHASE_SCENARIO_PRESETS.map((entry) => ({
  label: `standard-${entry.id}`,
  presetId: entry.id,
  url: sphPhaseScenarioPresetUrl(entry.id, {
    renderer: 'native-webgpu',
    renderOwnership: 'main-thread-renderer',
    surfaceDraw: 'native-webgpu-surface-consumer',
    ss: '1',
    schroederLevel: '1',
    schroederPortableSummary: '1',
    schroederActiveNodeIndex: '1',
    // Slice 9 puts the two-level/cross-level transport under test. Leaving
    // these off runs the matrix around the feature it is supposed to gate.
    schroederTwoLevel: '1',
    schroederCrossLevelCoupling: '1',
    schroederPhaseVolumeMigration: '1',
    schroederLawQueue: '1',
    schroederLawNeighborCandidates: '1'
  }),
  visualRendererMode: 'native-webgpu-surface-consumer',
  ...entry.validation,
  phaseAwareAcceptance: STANDARD_PHASE_ACCEPTANCE_BY_PRESET[entry.id] || null,
  expectedCheckpoints: entry.validation.checkpoints,
  standardEnabled: true,
  defaultEnabled: false
}));

const LEGACY_SCENARIOS = [
  {
    label: 'liquid-liquid-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1
  },
  {
    label: 'liquid-liquid-h2o-mlsmpm-flow-sequence',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    expectLiquidFreeSurface: true,
    liquidFreeSurfaceMinTimeS: 0.8,
    minVisualFrameTimeSpanS: 0.8,
    batches: 4,
    batchSteps: 512,
    defaultEnabled: false
  },
  {
    label: 'liquid-liquid-h2o-mlsmpm-flow-smoke',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=4&boxx=5&boxy=5&boxz=5&mech=mlsmpm&renderer=native-webgpu&renderOwnership=main-thread-renderer&surfaceDraw=native-webgpu-surface-consumer',
    expectedMechanics: 'mlsmpm',
    visualRendererMode: 'native-webgpu-surface-consumer',
    expectedH2oVisibleSurfaceCount: 1,
    expectLiquidFreeSurface: true,
    liquidFreeSurfaceMinTimeS: 0.8,
    liquidFreeSurfaceMaxTallnessRatio: 0.8,
    minVisualFrameTimeSpanS: 0.8,
    batches: 8,
    batchSteps: 256,
    defaultEnabled: false
  },
  {
    label: 'liquid-liquid-h2o-cpu-sph',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph',
    expectedH2oVisibleSurfaceCount: 1
  },
  {
    label: 'liquid-liquid-h2o-cpu-sph-flow-sequence',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.01&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph',
    expectedH2oVisibleSurfaceCount: 1,
    expectLiquidFreeSurface: true,
    liquidFreeSurfaceMinTimeS: 0.8,
    minVisualFrameTimeSpanS: 0.8,
    batches: 8,
    batchSteps: 384,
    defaultEnabled: false
  },
  {
    label: 'solid-h2o-cpu-sph',
    url: '/?drop=h2o&base=h2o&dropt=250&baset=250&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph',
    expectedH2oVisibleSurfaceCount: 2,
    expectStatic: true,
    staticMaxDisplacementM: 1e-5,
    staticMaxCenterOfMassDeltaM: 1e-6
  },
  {
    label: 'solid-liquid-contact-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph'
  },
  {
    label: 'phase-change-hot-h2o-water',
    url: '/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=sph',
    expectedMechanics: 'sph'
  },
  {
    label: 'reaction-product-na-h2o',
    url: '/?drop=na&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&blob=1',
    expectedMechanics: 'sph',
    expectedMaterialPresent: ['naoh', 'h2'],
    expectedMaterialAbsent: ['Na'],
    minReactionEventsTotal: 1
  },
  {
    label: 'law-static-mechanics-off-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawmech=0&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'sph',
    expectStatic: true,
    staticMaxDisplacementM: 1e-7,
    staticMaxCenterOfMassDeltaM: 1e-7
  },
  {
    label: 'law-static-gravity-off-fe-h2o',
    url: '/?drop=fe&base=h2o&dropt=300&baset=300&iceh=0&ironh=1.5&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawmech=1&lawg=0&laweos=0&lawp=0&lawt=0&lawr=0&lawv=0&lawst=0',
    expectedMechanics: 'sph',
    expectStatic: true,
    staticMaxDisplacementM: 1e-5,
    staticMaxCenterOfMassDeltaM: 1e-6
  },
  {
    label: 'law-pressure-off-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=0&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-eos-off-h2o-mlsmpm',
    url: '/?drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=0&lawp=0&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-thermal-off-hot-h2o',
    url: '/?drop=h2o&base=h2o&dropt=450&baset=300&iceh=0&ironh=1&dropn=3&basen=5&boxx=5&boxy=5&boxz=5&mech=mlsmpm&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=0&lawr=0&lawv=1&lawst=0',
    expectedMechanics: 'mlsmpm',
    expectedH2oVisibleSurfaceCount: 1,
    maxSpeedMPerS: 10,
    minVolumeRatioJ: 0.9,
    maxVolumeRatioJ: 1.1
  },
  {
    label: 'law-reactions-off-na-h2o',
    url: '/?drop=na&base=h2o&dropt=293.15&baset=293.15&iceh=0&ironh=1&dropn=2&basen=5&boxx=5&boxy=5&boxz=5&mech=sph&lawmech=1&lawg=1&laweos=1&lawp=1&lawt=1&lawr=0&lawv=1&lawst=0&blob=1',
    expectedMechanics: 'sph',
    maxSpeedMPerS: 25
  }
];

const SCENARIOS = [...STANDARD_SCENARIOS, ...LEGACY_SCENARIOS];

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function envFlagEnabled(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  return fallback;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(...sources) {
  const values = [];
  const seen = new Set();
  for (const source of sources) {
    for (const value of arrayOf(source)) {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      values.push(text);
    }
  }
  return values;
}

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inferMechanicsIntegrator(probe) {
  const direct = String(probe?.timeline?.mechanicsIntegrator || probe?.analysis?.mechanicsIntegrator || '').trim();
  if (direct) return direct;
  const metrics = Array.isArray(probe?.timeline?.metrics) ? probe.timeline.metrics : [];
  const lastMetric = metrics.length ? metrics[metrics.length - 1] : null;
  const schemaText = [
    lastMetric?.residentStep?.schema,
    lastMetric?.residentSteps?.schema,
    probe?.timeline?.schema
  ].filter(Boolean).join(' ');
  if (schemaText.includes('plain-sph')) return 'sph';
  if (schemaText.includes('mls-mpm')) return 'mlsmpm';
  return null;
}

function effectiveVisualRendererModes(probe) {
  return uniqueStrings(arrayOf(probe?.timeline?.metrics).map((metric) => (
    metric?.surfaceDraw?.visibleRendererBridge
      ?? metric?.renderState?.surfaceDrawVisibleRendererBridge
      ?? metric?.surfaceDraw?.rendererBridge
      ?? null
  )));
}

function visualSurfaceIssueKey(issue) {
  const axes = Array.isArray(issue?.axes) ? issue.axes.join(',') : '';
  return [
    issue?.issue || 'unknown',
    issue?.materialKey || '',
    issue?.phase || '',
    issue?.renderSource || '',
    axes
  ].join('|');
}

function compactVisualSurfaceIssue(issue) {
  return {
    issue: issue?.issue || 'unknown',
    metricIndex: Number.isFinite(Number(issue?.metricIndex)) ? Number(issue.metricIndex) : null,
    materialKey: issue?.materialKey ?? null,
    phase: issue?.phase ?? null,
    renderSource: issue?.renderSource ?? null,
    renderLayer: issue?.renderLayer ?? null,
    renderOrder: finiteOrNull(issue?.renderOrder),
    renderOrderBase: finiteOrNull(issue?.renderOrderBase),
    renderOrderPolicy: issue?.renderOrderPolicy ?? null,
    materialTransparent: issue?.materialTransparent ?? null,
    materialDepthWrite: issue?.materialDepthWrite ?? null,
    materialDepthTest: issue?.materialDepthTest ?? null,
    axes: Array.isArray(issue?.axes) ? issue.axes : [],
    maxOverflowM: finiteOrNull(issue?.maxOverflowM),
    particleBoundsToleranceM: finiteOrNull(issue?.particleBoundsToleranceM),
    particleSupportRadiusM: finiteOrNull(issue?.particleSupportRadiusM),
    marchingCubesCellSizeM: finiteOrNull(issue?.marchingCubesCellSizeM),
    allowedParticleBoundsOverflowM: finiteOrNull(issue?.allowedParticleBoundsOverflowM)
  };
}

function uniqueVisualSurfaceIssues(...sources) {
  const values = [];
  const seen = new Set();
  for (const source of sources) {
    for (const issue of arrayOf(source)) {
      if (!issue || typeof issue !== 'object') continue;
      const key = visualSurfaceIssueKey(issue);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(compactVisualSurfaceIssue(issue));
    }
  }
  return values;
}

function countBy(values, keyOf = (value) => value) {
  const counts = {};
  for (const value of arrayOf(values)) {
    const key = String(keyOf(value) || '').trim();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function selectedScenarios() {
  const filter = String(process.env.ULG_VISUAL_MATRIX_SCENARIOS || '').trim();
  if (!filter && envFlagEnabled(process.env.ULG_VISUAL_MATRIX_STANDARD, false)) {
    return [...STANDARD_SCENARIOS, ...deterministicRandomPairScenarios()];
  }
  if (!filter) return SCENARIOS.filter((scenario) => scenario.defaultEnabled !== false);
  const wanted = new Set(filter.split(',').map((entry) => entry.trim()).filter(Boolean));
  return SCENARIOS.filter((scenario) => wanted.has(scenario.label));
}

function deterministicRandomPairScenarios() {
  const count = positiveInteger(process.env.ULG_VISUAL_MATRIX_RANDOM_PAIR_COUNT, 3);
  const rawSeed = Number(process.env.ULG_VISUAL_MATRIX_RANDOM_SEED ?? 0x7a11d2026);
  let state = Number.isFinite(rawSeed) ? (Math.trunc(rawSeed) >>> 0) : 0x7a11d2026;
  const nextIndex = (length) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % length;
  };
  const scenarios = [];
  const used = new Set();
  while (scenarios.length < count && used.size < ELEMENT_MATERIAL_OPTIONS.length ** 2) {
    const drop = ELEMENT_MATERIAL_OPTIONS[nextIndex(ELEMENT_MATERIAL_OPTIONS.length)];
    const base = ELEMENT_MATERIAL_OPTIONS[nextIndex(ELEMENT_MATERIAL_OPTIONS.length)];
    if (!drop || !base || drop.key === base.key) continue;
    const key = `${drop.key}:${base.key}`;
    if (used.has(key)) continue;
    used.add(key);
    const params = new URLSearchParams({
      drop: drop.key,
      base: base.key,
      dropt: '300',
      baset: '300',
      wxmin: '293.15',
      wxmax: '293.15',
      wymin: '293.15',
      wymax: '293.15',
      wzmin: '293.15',
      wzmax: '293.15',
      iceh: '0',
      ironh: '1.01',
      dropn: '2',
      basen: '3',
      boxx: '4',
      boxy: '4',
      boxz: '4',
      mech: 'mlsmpm'
    });
    params.set('renderer', 'native-webgpu');
    params.set('renderOwnership', 'main-thread-renderer');
    params.set('surfaceDraw', 'native-webgpu-surface-consumer');
    params.set('ss', '1');
    params.set('schroederLevel', '1');
    params.set('schroederPortableSummary', '1');
    params.set('schroederActiveNodeIndex', '1');
    // See STANDARD_SCENARIOS: the Slice 9 transport must be live here too.
    params.set('schroederTwoLevel', '1');
    params.set('schroederCrossLevelCoupling', '1');
    params.set('schroederPhaseVolumeMigration', '1');
    params.set('schroederLawQueue', '1');
    params.set('schroederLawNeighborCandidates', '1');
    scenarios.push({
      label: `random-elements-${drop.key.toLowerCase()}-${base.key.toLowerCase()}`,
      randomPair: { drop: drop.key, base: base.key, seed: rawSeed },
      url: `/?${params.toString()}`,
      expectedMechanics: 'mlsmpm',
      batches: positiveInteger(process.env.ULG_VISUAL_MATRIX_RANDOM_PAIR_BATCHES, 3),
      batchSteps: positiveInteger(process.env.ULG_VISUAL_MATRIX_RANDOM_PAIR_BATCH_STEPS, 64),
      visualRendererMode: 'native-webgpu-surface-consumer',
      visualOnly: true,
      standardEnabled: true,
      defaultEnabled: false,
      expectedCheckpoints: [
        { id: 'initial', expectation: 'both derived element cohorts are visible and finite' },
        { id: 'late', expectation: 'the scene advances without NaNs, mass loss, or frozen rendering' }
      ]
    });
  }
  return scenarios;
}

function compactEvolutionTimeline(probe) {
  return arrayOf(probe?.timeline?.metrics).map((metric, index) => {
    const step = metric?.residentStep || metric?.plainSphStepResult || null;
    const diagnostics = step?.diagnostics || null;
    const checkpoint = metric?.authoritativeGpuCheckpoint?.status === 'captured'
      ? metric.authoritativeGpuCheckpoint
      : null;
    const checkpointRows = arrayOf(checkpoint?.materialPhases);
    const checkpointMassByPhase = checkpointRows.reduce((result, row) => {
      const phase = String(row?.phase || '').trim();
      if (!phase) return result;
      result[phase] = (result[phase] || 0) + (finiteOrNull(row?.massKg) || 0);
      return result;
    }, {});
    const checkpointMassForTemperature = checkpointRows.reduce((sum, row) => (
      sum + (finiteOrNull(row?.massKg) || 0)
    ), 0);
    const checkpointMeanTemperature = checkpointMassForTemperature > 0
      ? checkpointRows.reduce((sum, row) => (
          sum
          + (finiteOrNull(row?.temperatureMassWeightedMeanK) || 0)
            * (finiteOrNull(row?.massKg) || 0)
        ), 0) / checkpointMassForTemperature
      : null;
    const checkpointTemperatures = checkpointRows.flatMap((row) => [
      finiteOrNull(row?.temperatureMinK),
      finiteOrNull(row?.temperatureMaxK)
    ]).filter(Number.isFinite);
    const checkpointSpeedReady = checkpoint?.speedEvidenceStatus === 'complete';
    const checkpointMechanicsRows = checkpointRows.filter((row) => (
      Number(row?.mechanicsSampleCount) > 0
      && Number(row?.mechanicsProblemParticleCount) === 0
    ));
    const checkpointSpeeds = checkpointSpeedReady
      ? checkpointRows.map((row) => finiteOrNull(row?.maxSpeedMPerS)).filter(Number.isFinite)
      : [];
    const checkpointMinVolumeRatios = checkpointMechanicsRows
      .map((row) => finiteOrNull(row?.minVolumeRatioJ))
      .filter(Number.isFinite);
    const checkpointMaxVolumeRatios = checkpointMechanicsRows
      .map((row) => finiteOrNull(row?.maxVolumeRatioJ))
      .filter(Number.isFinite);
    const checkpointParticlesByMaterial = checkpointRows.reduce((result, row) => {
      const material = String(row?.material || '').trim();
      if (!material) return result;
      result[material] = (result[material] || 0) + Math.max(
        0,
        finiteOrNull(row?.phaseWeightedParticleCount) ?? finiteOrNull(row?.liveParticleCount) ?? 0
      );
      return result;
    }, {});
    return {
      index,
      batchIndex: finiteOrNull(metric?.batchIndex),
      phase: metric?.phase || null,
      batchMs: finiteOrNull(metric?.batchMs),
      simulationTimeS: finiteOrNull(
        checkpoint?.sourceTimeS
          ?? step?.particlePingPong?.nextTime
          ?? step?.time
          ?? metric?.residentSteps?.finalStep?.particlePingPong?.nextTime
      ),
      phaseMassKg: diagnostics?.phaseMassKg || (checkpoint ? checkpointMassByPhase : null),
      meanTemperatureK: finiteOrNull(diagnostics?.temperatureMassWeightedMeanK ?? checkpointMeanTemperature),
      minTemperatureK: finiteOrNull(
        diagnostics?.minTemperatureK
          ?? (checkpointTemperatures.length ? Math.min(...checkpointTemperatures) : null)
      ),
      maxTemperatureK: finiteOrNull(
        diagnostics?.maxTemperatureK
          ?? (checkpointTemperatures.length ? Math.max(...checkpointTemperatures) : null)
      ),
      maxSpeedMPerS: finiteOrNull(
        diagnostics?.maxSpeedMPerS
          ?? (checkpointSpeeds.length ? Math.max(...checkpointSpeeds) : null)
      ),
      minVolumeRatioJ: finiteOrNull(
        diagnostics?.minVolumeRatioJ
          ?? (checkpointMinVolumeRatios.length ? Math.min(...checkpointMinVolumeRatios) : null)
      ),
      maxVolumeRatioJ: finiteOrNull(
        diagnostics?.maxVolumeRatioJ
          ?? (checkpointMaxVolumeRatios.length ? Math.max(...checkpointMaxVolumeRatios) : null)
      ),
      checkpointSpeedEvidenceStatus: checkpoint?.speedEvidenceStatus ?? null,
      checkpointMechanicsEvidenceStatus: checkpoint?.mechanicsEvidenceStatus ?? null,
      phaseWeightedRestVolumeM3: checkpoint
        ? finiteOrNull(checkpoint?.totals?.phaseWeightedRestVolumeM3)
        : null,
      phaseWeightedCurrentVolumeM3: checkpoint
        ? finiteOrNull(checkpoint?.totals?.phaseWeightedCurrentVolumeM3)
        : null,
      phaseWeightedRepresentedVolumeM3: checkpoint
        ? finiteOrNull(checkpoint?.totals?.phaseWeightedRepresentedVolumeM3)
        : null,
      volumeRatioCapBoundaryParticleCount: checkpoint
        ? finiteOrNull(checkpoint?.volumeRatioCapBoundaryParticleCount)
        : null,
      maxDisplacementM: finiteOrNull(diagnostics?.maxDisplacementM),
      reactionEventsTotal: finiteOrNull(
        step?.reactionEventsTotal ?? step?.reactionLedger?.eventCount
      ),
      particlesByMaterial: step?.particlesByMaterial || (checkpoint
        ? Object.fromEntries(Object.entries(checkpointParticlesByMaterial).map(([material, count]) => [
            material,
            Math.round(count)
          ]))
        : null),
      stageMs: step?.stageTiming?.stageMs || null,
      queueFenceMs: step?.stageTiming?.queueFenceMs || null
    };
  });
}

function authoritativeCheckpointSeries(probe) {
  return arrayOf(probe?.timeline?.metrics)
    .map((metric) => metric?.authoritativeGpuCheckpoint)
    .filter((checkpoint) => checkpoint?.status === 'captured');
}

function checkpointRows(checkpoint, material = null, phase = null) {
  const wantedMaterial = material == null ? null : String(material).toLowerCase();
  const wantedPhase = phase == null ? null : String(phase).toLowerCase();
  return arrayOf(checkpoint?.materialPhases).filter((row) => (
    (wantedMaterial == null || String(row?.material || '').toLowerCase() === wantedMaterial)
    && (wantedPhase == null || String(row?.phase || '').toLowerCase() === wantedPhase)
  ));
}

function checkpointMass(checkpoint, material = null, phase = null) {
  return checkpointRows(checkpoint, material, phase)
    .reduce((sum, row) => sum + (finiteOrNull(row?.massKg) || 0), 0);
}

function checkpointMaxTemperature(checkpoint, material = null, phase = null) {
  const values = checkpointRows(checkpoint, material, phase)
    .map((row) => finiteOrNull(row?.temperatureMaxK))
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function checkpointYCenter(checkpoint, material = null, phase = null) {
  const rows = checkpointRows(checkpoint, material, phase);
  const totalMass = rows.reduce((sum, row) => sum + (finiteOrNull(row?.massKg) || 0), 0);
  if (!(totalMass > 0)) return null;
  return rows.reduce((sum, row) => (
    sum + (finiteOrNull(row?.yCenterMassWeightedM) || 0) * (finiteOrNull(row?.massKg) || 0)
  ), 0) / totalMass;
}

function behaviorCheck(id, expectation, passed, observed, { inconclusive = false } = {}) {
  return {
    id,
    expectation,
    status: inconclusive ? 'inconclusive' : passed ? 'pass' : 'fail',
    observed
  };
}

function evaluateStandardScenarioBehavior(scenario, probe) {
  if (!scenario.standardEnabled) return null;
  const checkpoints = authoritativeCheckpointSeries(probe);
  if (checkpoints.length < 2) {
    return {
      schema: 'peercompute.ulg.sph-standard-scenario-behavior.v0',
      status: 'inconclusive',
      presetId: scenario.presetId || null,
      checkpointCount: checkpoints.length,
      checks: [behaviorCheck(
        'authoritative-checkpoint-series',
        'at least two authoritative GPU checkpoints are captured',
        false,
        { checkpointCount: checkpoints.length },
        { inconclusive: true }
      )]
    };
  }

  const capturedInitial = checkpoints.find((checkpoint) => (
    checkpoint?.phase === 'initial'
    && Math.abs(finiteOrNull(checkpoint?.sourceTimeS) || 0) <= 1e-12
  )) || null;
  const first = capturedInitial || checkpoints[0];
  const last = checkpoints[checkpoints.length - 1];
  const masses = checkpoints.map((checkpoint) => finiteOrNull(checkpoint?.totals?.massKg)).filter(Number.isFinite);
  const massMin = masses.length ? Math.min(...masses) : null;
  const massMax = masses.length ? Math.max(...masses) : null;
  const massScale = masses.length ? Math.max(Math.abs(masses[0]), 1e-9) : null;
  const massRelativeSpan = massScale == null ? null : (massMax - massMin) / massScale;
  const phaseAwareConfig = scenario.phaseAwareAcceptance || {};
  const volumeRatioEvidence = phaseAwareVolumeRatioEvidence(
    checkpoints,
    phaseAwareConfig.volumeRatio || {}
  );
  const generatedGasEvidence = phaseAwareConfig.generatedGas
    ? generatedCohortTrajectoryEvidence(checkpoints, phaseAwareConfig.generatedGas)
    : null;
  const launchEvidence = phaseAwareConfig.condensedLaunch
    ? condensedLaunchEvidence(checkpoints, phaseAwareConfig.condensedLaunch)
    : null;
  const checks = [behaviorCheck(
    'particle-mass-bounded',
    'checkpoint particle mass stays conserved within 0.1%',
    Number.isFinite(massRelativeSpan) && massRelativeSpan <= 1e-3,
    { massMinKg: massMin, massMaxKg: massMax, relativeSpan: massRelativeSpan },
    { inconclusive: !Number.isFinite(massRelativeSpan) }
  ), behaviorCheck(
    'phase-volume-ratios-bounded',
    'condensed and gas mechanics remain inside their phase-appropriate volume-ratio domains',
    volumeRatioEvidence.status === 'pass',
    volumeRatioEvidence,
    { inconclusive: volumeRatioEvidence.status === 'inconclusive' }
  )];
  if (scenario.presetId) {
    checks.push(behaviorCheck(
      'initial-state-captured',
      'a retained authoritative GPU checkpoint exists at simulation time zero',
      capturedInitial != null,
      {
        captured: capturedInitial != null,
        firstCapturedPhase: checkpoints[0]?.phase || null,
        firstCapturedTimeS: finiteOrNull(checkpoints[0]?.sourceTimeS)
      },
      { inconclusive: capturedInitial == null }
    ));
  }
  if (launchEvidence) {
    checks.push(behaviorCheck(
      'condensed-motion-non-explosive',
      'the mass-weighted condensed population does not launch upward after settling',
      launchEvidence.status === 'pass',
      launchEvidence,
      { inconclusive: launchEvidence.status === 'inconclusive' }
    ));
  }

  if (scenario.presetId === 'water-cycle') {
    const gasMasses = checkpoints.map((checkpoint) => checkpointMass(checkpoint, 'h2o', 'gas'));
    const significantGasMasses = gasMasses.map((massKg) => (
      massKg >= (generatedGasEvidence?.minimumMassKg ?? 0) ? massKg : 0
    ));
    const peakGasMass = Math.max(...significantGasMasses);
    checks.push(
      behaviorCheck('liquid-flow', 'liquid water changes position over the sequence', (
        Math.abs((checkpointYCenter(last, 'h2o', 'liquid') || 0) - (checkpointYCenter(first, 'h2o', 'liquid') || 0)) > 0.02
      ), {
        initialYCenterM: checkpointYCenter(first, 'h2o', 'liquid'),
        finalYCenterM: checkpointYCenter(last, 'h2o', 'liquid')
      }),
      behaviorCheck('steam-forms', 'the 400 K floor creates water vapor', (
        generatedGasEvidence?.formed === true
      ), { peakGasMassKg: peakGasMass, trajectory: generatedGasEvidence }),
      behaviorCheck('steam-rises', 'water vapor sustains an upward trajectory through the headspace', (
        generatedGasEvidence?.status === 'pass'
      ), generatedGasEvidence, { inconclusive: generatedGasEvidence?.formed !== true }),
      behaviorCheck('steam-condenses', 'cold-ceiling vapor later condenses', (
        peakGasMass > 0 && significantGasMasses.at(-1) < peakGasMass * 0.98
      ), {
        gasMassesKg: gasMasses,
        significantGasMassesKg: significantGasMasses,
        minimumSignificantMassKg: generatedGasEvidence?.minimumMassKg ?? null
      }, { inconclusive: generatedGasEvidence?.formed !== true })
    );
  } else if (scenario.presetId === 'iron-ice-quench') {
    const initialFeLiquid = checkpointMass(first, 'fe', 'liquid');
    const finalFeLiquid = checkpointMass(last, 'fe', 'liquid');
    const initialFeSolid = checkpointMass(first, 'fe', 'solid');
    const finalFeSolid = checkpointMass(last, 'fe', 'solid');
    const initialFeTemperature = checkpointMaxTemperature(first, 'fe');
    const finalFeTemperature = checkpointMaxTemperature(last, 'fe');
    checks.push(
      behaviorCheck('iron-starts-molten', 'the falling iron begins liquid', initialFeLiquid > 0, { initialFeLiquidKg: initialFeLiquid }),
      behaviorCheck('ice-melts', 'solid water creates a liquid-water population', checkpointMass(last, 'h2o', 'liquid') > 0, {
        finalWaterLiquidKg: checkpointMass(last, 'h2o', 'liquid')
      }),
      behaviorCheck('steam-forms', 'iron quench creates a material water-vapor population', generatedGasEvidence?.formed === true, {
        finalSteamMassKg: checkpointMass(last, 'h2o', 'gas'),
        trajectory: generatedGasEvidence
      }),
      behaviorCheck('iron-solidifies', 'liquid iron decreases while solid iron grows', (
        finalFeLiquid < initialFeLiquid && finalFeSolid > initialFeSolid
      ), { initialFeLiquidKg: initialFeLiquid, finalFeLiquidKg: finalFeLiquid, initialFeSolidKg: initialFeSolid, finalFeSolidKg: finalFeSolid }),
      behaviorCheck('iron-cools', 'iron peak temperature decreases by at least 10 K', (
        Number.isFinite(initialFeTemperature) && Number.isFinite(finalFeTemperature)
        && finalFeTemperature <= initialFeTemperature - 10
      ), { initialMaxTemperatureK: initialFeTemperature, finalMaxTemperatureK: finalFeTemperature }),
      behaviorCheck('steam-rises', 'quench steam sustains an upward trajectory into the container headspace', (
        generatedGasEvidence?.status === 'pass'
      ), generatedGasEvidence, { inconclusive: generatedGasEvidence?.formed !== true })
    );
  } else if (scenario.presetId === 'sodium-water') {
    const initialNaMass = checkpointMass(first, 'Na');
    const finalNaMass = checkpointMass(last, 'Na');
    const maxTemperatures = checkpoints.map((checkpoint) => checkpointMaxTemperature(checkpoint)).filter(Number.isFinite);
    const initialMaxTemperature = finiteOrNull(scenario.initialMaxTemperatureK);
    const minimumTemperatureRise = finiteOrNull(scenario.minimumReactionTemperatureRiseK) ?? 50;
    const minimumHydrogenRise = finiteOrNull(scenario.minimumHydrogenRiseM) ?? 0.05;
    checks.push(
      behaviorCheck('sodium-consumed', 'sodium mass decreases across the captured interval', finalNaMass < initialNaMass, {
        firstCapturedNaKg: initialNaMass,
        finalNaKg: finalNaMass
      }),
      behaviorCheck('sodium-products-form', 'NaOH and H2 become real particle populations', (
        checkpointMass(last, 'naoh') > 0 && checkpointMass(last, 'h2') > 0
      ), { finalNaohKg: checkpointMass(last, 'naoh'), finalH2Kg: checkpointMass(last, 'h2') }),
      behaviorCheck('reaction-heats', `reaction temperature rises at least ${minimumTemperatureRise} K above the declared initial maximum`, (
        Number.isFinite(initialMaxTemperature)
        && maxTemperatures.length > 0
        && Math.max(...maxTemperatures) >= initialMaxTemperature + minimumTemperatureRise
      ), {
        declaredInitialMaxTemperatureK: initialMaxTemperature,
        requiredRiseK: minimumTemperatureRise,
        maxTemperaturesK: maxTemperatures
      }, { inconclusive: !Number.isFinite(initialMaxTemperature) || maxTemperatures.length === 0 }),
      behaviorCheck('hydrogen-rises', 'hydrogen products sustain upward motion after formation', (
        generatedGasEvidence?.status === 'pass'
        && generatedGasEvidence.minimumSustainedRiseM >= minimumHydrogenRise
      ), generatedGasEvidence, { inconclusive: generatedGasEvidence?.formed !== true })
    );
  } else if (scenario.presetId === 'cesium-fluorine') {
    const initialFluorineMass = checkpointMass(first, 'F');
    const finalFluorineMass = checkpointMass(last, 'F');
    const maxTemperatures = checkpoints.map((checkpoint) => checkpointMaxTemperature(checkpoint)).filter(Number.isFinite);
    const csfTemperatures = checkpoints.map((checkpoint) => checkpointMaxTemperature(checkpoint, 'csf')).filter(Number.isFinite);
    const initialMaxTemperature = finiteOrNull(scenario.initialMaxTemperatureK);
    const minimumTemperatureRise = finiteOrNull(scenario.minimumReactionTemperatureRiseK) ?? 500;
    checks.push(
      behaviorCheck('fluorine-consumed', 'fluorine mass decreases across the captured interval', finalFluorineMass < initialFluorineMass, {
        firstCapturedFluorineKg: initialFluorineMass,
        finalFluorineKg: finalFluorineMass
      }),
      behaviorCheck('csf-forms', 'CsF becomes a real particle population', checkpointMass(last, 'csf') > 0, {
        finalCsfKg: checkpointMass(last, 'csf')
      }),
      behaviorCheck('highly-exothermic', `reaction peak exceeds the declared initial maximum by at least ${minimumTemperatureRise} K`, (
        Number.isFinite(initialMaxTemperature)
        && maxTemperatures.length > 0
        && Math.max(...maxTemperatures) >= initialMaxTemperature + minimumTemperatureRise
      ), {
        declaredInitialMaxTemperatureK: initialMaxTemperature,
        requiredRiseK: minimumTemperatureRise,
        maxTemperaturesK: maxTemperatures
      }, { inconclusive: !Number.isFinite(initialMaxTemperature) || maxTemperatures.length === 0 }),
      behaviorCheck('cesium-melts', 'cesium develops a liquid population', (
        checkpoints.some((checkpoint) => checkpointMass(checkpoint, 'Cs', 'liquid') > 0)
      ), { liquidCesiumMassesKg: checkpoints.map((checkpoint) => checkpointMass(checkpoint, 'Cs', 'liquid')) }),
      behaviorCheck('products-cool', 'hot CsF products cool after their peak', (
        csfTemperatures.length > 1 && csfTemperatures.at(-1) < Math.max(...csfTemperatures)
      ), { csfMaxTemperaturesK: csfTemperatures })
    );
  } else if (scenario.randomPair) {
    checks.push(behaviorCheck(
      'random-pair-advances',
      'the seeded pair advances through at least two finite checkpoints',
      checkpoints.every((checkpoint) => (
        Number(checkpoint?.invalidMassParticleCount || 0) === 0
        && Number(checkpoint?.liveParticleCount || 0) > 0
      )),
      {
        pair: scenario.randomPair,
        liveParticleCounts: checkpoints.map((checkpoint) => checkpoint.liveParticleCount),
        invalidMassParticleCounts: checkpoints.map((checkpoint) => checkpoint.invalidMassParticleCount)
      }
    ));
  }

  return {
    schema: 'peercompute.ulg.sph-standard-scenario-behavior.v0',
    status: checks.some((check) => check.status === 'fail')
      ? 'fail'
      : checks.some((check) => check.status === 'inconclusive')
      ? 'inconclusive'
      : 'pass',
    presetId: scenario.presetId || null,
    checkpointCount: checkpoints.length,
    checkpoints,
    phaseAwareEvidence: {
      volumeRatio: volumeRatioEvidence,
      generatedGas: generatedGasEvidence,
      condensedLaunch: launchEvidence
    },
    checks
  };
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function terminateProcessGroup(proc) {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try { proc.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => {
    if (proc.exitCode != null || proc.killed) return;
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      try { proc.kill('SIGKILL'); } catch {}
    }
  }, 5000).unref();
}

function runCommand(command, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut, ...result });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `\n[sph-visual-matrix] scenario hard timeout after ${timeoutMs} ms\n`;
      terminateProcessGroup(proc);
    }, Math.max(1000, timeoutMs)).unref();
    proc.stdout.on('data', (chunk) => { stdout += String(chunk); });
    proc.stderr.on('data', (chunk) => { stderr += String(chunk); });
    proc.on('error', (error) => {
      finish({ code: 1, stdout, stderr: `${stderr}${error.stack || error.message || String(error)}\n` });
    });
    proc.on('close', (code) => {
      finish({ code: code ?? (timedOut ? 124 : 1), stdout, stderr });
    });
  });
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function scenarioEnv({
  scenario,
  outputPath,
  frameDir,
  port,
  batches,
  batchSteps,
  timeoutMs
}) {
  const captureFrames = envFlagEnabled(process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, true);
  const env = {
    ...process.env,
    ULG_PROBE_URL: scenario.url,
    ULG_PROBE_OUTPUT: outputPath,
    ULG_PROBE_PORT: String(port),
    ULG_PROBE_BATCHES: String(scenario.batches ?? batches),
    ULG_PROBE_BATCH_STEPS: String(scenario.batchSteps ?? batchSteps),
    ULG_PROBE_RENDER_EVERY: String(scenario.renderEvery ?? 1),
    ULG_PROBE_TIMEOUT_MS: String(scenario.timeoutMs ?? timeoutMs),
    ULG_PROBE_FAIL_ON_BAD: '1'
  };
  if (scenario.standardEnabled) {
    env.ULG_PROBE_VIEWPORT_WIDTH = process.env.ULG_VISUAL_MATRIX_VIEWPORT_WIDTH || '1280';
    env.ULG_PROBE_VIEWPORT_HEIGHT = process.env.ULG_VISUAL_MATRIX_VIEWPORT_HEIGHT || '800';
    env.ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS =
      process.env.ULG_VISUAL_MATRIX_NATIVE_SURFACE_VALIDATION_WAIT_MS || '1500';
    // The probe-level guard admits the complete phase domain. The matrix then
    // applies tighter condensed bounds without misclassifying legal sparse-gas
    // expansion at J=0.1 as a condensed collapse.
    env.ULG_PROBE_MIN_J = '0.1';
    env.ULG_PROBE_MAX_J = '1000';
  }
  if (scenario.visualRendererMode === 'native-webgpu-surface-consumer') {
    env.ULG_PROBE_READBACK_MODE = 'no-full-readback';
    env.ULG_PROBE_RENDER_READBACK_MODE = 'no-full-readback';
    env.ULG_PROBE_RENDER_ROWS_READBACK_MODE = 'no-full-readback';
    env.ULG_PROBE_COMPACT_SUMMARY_MODE = 'final-only';
    env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE = 'native-webgpu-surface-consumer';
    env.ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS =
      process.env.ULG_VISUAL_MATRIX_NATIVE_SURFACE_VALIDATION_WAIT_MS || '1500';
  }
  if (!scenario.standardEnabled && scenario.expectedH2oVisibleSurfaceCount != null) {
    env.ULG_PROBE_EXPECT_H2O_VISIBLE_SURFACE_COUNT = String(scenario.expectedH2oVisibleSurfaceCount);
  }
  if (!scenario.standardEnabled && Array.isArray(scenario.expectedMaterialPresent) && scenario.expectedMaterialPresent.length) {
    env.ULG_PROBE_EXPECT_MATERIAL_PRESENT = scenario.expectedMaterialPresent.join(',');
  }
  if (Array.isArray(scenario.expectedMaterialAbsent) && scenario.expectedMaterialAbsent.length) {
    env.ULG_PROBE_EXPECT_MATERIAL_ABSENT = scenario.expectedMaterialAbsent.join(',');
  }
  if (!scenario.standardEnabled && scenario.minReactionEventsTotal != null) {
    env.ULG_PROBE_MIN_REACTION_EVENTS_TOTAL = String(scenario.minReactionEventsTotal);
  }
  if (scenario.maxSpeedMPerS != null) {
    env.ULG_PROBE_MAX_SPEED = String(scenario.maxSpeedMPerS);
  }
  if (!scenario.standardEnabled && scenario.minVolumeRatioJ != null) {
    env.ULG_PROBE_MIN_J = String(scenario.minVolumeRatioJ);
  }
  if (!scenario.standardEnabled && scenario.maxVolumeRatioJ != null) {
    env.ULG_PROBE_MAX_J = String(scenario.maxVolumeRatioJ);
  }
  if (scenario.expectStatic === true) {
    env.ULG_PROBE_EXPECT_STATIC = '1';
  }
  if (scenario.staticMaxDisplacementM != null) {
    env.ULG_PROBE_STATIC_MAX_DISPLACEMENT_M = String(scenario.staticMaxDisplacementM);
  }
  if (scenario.staticMaxCenterOfMassDeltaM != null) {
    env.ULG_PROBE_STATIC_MAX_COM_DELTA_M = String(scenario.staticMaxCenterOfMassDeltaM);
  }
  if (scenario.expectLiquidMerge === true) {
    env.ULG_PROBE_EXPECT_LIQUID_MERGE = '1';
  }
  if (scenario.expectLiquidSettled === true) {
    env.ULG_PROBE_EXPECT_LIQUID_SETTLE = '1';
  }
  if (scenario.expectLiquidFreeSurface === true) {
    env.ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE = '1';
  }
  if (scenario.liquidMergeMaxFinalSupportGapM != null) {
    env.ULG_PROBE_LIQUID_MERGE_MAX_FINAL_SUPPORT_GAP_M = String(scenario.liquidMergeMaxFinalSupportGapM);
  }
  if (scenario.liquidSettledMinTimeS != null) {
    env.ULG_PROBE_LIQUID_SETTLE_MIN_TIME_S = String(scenario.liquidSettledMinTimeS);
  }
  if (scenario.liquidSettledMaxFinalDropSpeedMPerS != null) {
    env.ULG_PROBE_LIQUID_SETTLE_MAX_FINAL_DROP_SPEED = String(scenario.liquidSettledMaxFinalDropSpeedMPerS);
  }
  if (scenario.liquidFreeSurfaceMinTimeS != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MIN_TIME_S = String(scenario.liquidFreeSurfaceMinTimeS);
  }
  if (scenario.liquidFreeSurfaceMaxTallnessRatio != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_TALLNESS = String(scenario.liquidFreeSurfaceMaxTallnessRatio);
  }
  if (scenario.liquidFreeSurfaceMinFootprintFillRatio != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MIN_FOOTPRINT_FILL = String(scenario.liquidFreeSurfaceMinFootprintFillRatio);
  }
  if (scenario.liquidFreeSurfaceMaxHeightM != null) {
    env.ULG_PROBE_LIQUID_FREE_SURFACE_MAX_HEIGHT_M = String(scenario.liquidFreeSurfaceMaxHeightM);
  }
  if (captureFrames && scenario.minVisualFrameTimeSpanS != null) {
    env.ULG_PROBE_MIN_VISUAL_FRAME_TIME_SPAN_S = String(scenario.minVisualFrameTimeSpanS);
  }
  if (scenario.visualOnly === true) {
    env.ULG_PROBE_VISUAL_ONLY = '1';
  }
  if (process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES === '1') {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_EVERY, 1));
    env.ULG_PROBE_FRAME_MAX = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_MAX, DEFAULT_FRAME_MAX));
  } else if (captureFrames) {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_EVERY, 1));
    env.ULG_PROBE_FRAME_MAX = String(positiveInteger(process.env.ULG_VISUAL_MATRIX_FRAME_MAX, DEFAULT_FRAME_MAX));
  }
  return env;
}

async function main() {
  if (process.argv.includes('--list')) {
    for (const scenario of SCENARIOS) console.log(scenario.label);
    return;
  }
  const repoDir = process.env.ULG_VISUAL_MATRIX_REPO_DIR || process.cwd();
  const runId = process.env.ULG_VISUAL_MATRIX_RUN_ID || timestampSlug();
  const outputRoot = path.join(process.env.ULG_VISUAL_MATRIX_OUTPUT_DIR || DEFAULT_OUTPUT_DIR, runId);
  const basePort = positiveInteger(process.env.ULG_VISUAL_MATRIX_BASE_PORT, DEFAULT_BASE_PORT);
  const batches = positiveInteger(process.env.ULG_VISUAL_MATRIX_BATCHES, DEFAULT_BATCHES);
  const batchSteps = positiveInteger(process.env.ULG_VISUAL_MATRIX_BATCH_STEPS, DEFAULT_BATCH_STEPS);
  const timeoutMs = positiveInteger(process.env.ULG_VISUAL_MATRIX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const allowFailures = process.env.ULG_VISUAL_MATRIX_ALLOW_FAILURES === '1';
  const captureFrames = envFlagEnabled(process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, true);
  const scenarios = selectedScenarios();
  if (!scenarios.length) {
    throw new Error('No SPH visual sanity matrix scenarios selected');
  }
  await mkdir(outputRoot, { recursive: true });

  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const outputPath = path.join(outputRoot, `${scenario.label}.json`);
    const logPath = path.join(outputRoot, `${scenario.label}.log`);
    const frameDir = path.join(outputRoot, `${scenario.label}-frames`);
    const env = scenarioEnv({
      scenario,
      outputPath,
      frameDir,
      port: basePort + index,
      batches,
      batchSteps,
      timeoutMs
    });
    console.log(`[sph-visual-matrix] ${scenario.label}`);
    const run = await runCommand(process.execPath, ['scripts/sph-long-horizon-probe.mjs'], {
      cwd: repoDir,
      env,
      timeoutMs: (scenario.timeoutMs ?? timeoutMs) + 30_000
    });
    await writeFile(logPath, `${run.stdout}\n${run.stderr}`, 'utf8');
    let probe = await readJsonIfPresent(outputPath);
    if (!probe) {
      probe = {
        schema: 'peercompute.ulg.sph-visual-sanity-matrix-scenario-result.v0',
        status: 'bad',
        label: scenario.label,
        url: scenario.url,
        code: run.code,
        timedOut: run.timedOut,
        issues: [
          run.timedOut
            ? 'visual-matrix-scenario-timeout'
            : 'visual-matrix-scenario-output-missing'
        ],
        visualSurfaceIssues: [],
        logPath,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
      await writeFile(outputPath, `${JSON.stringify(probe, null, 2)}\n`, 'utf8');
    }
    const analysis = probe?.analysis || {};
    const expectedBehavior = evaluateStandardScenarioBehavior(scenario, probe);
    const mechanicsIntegrator = inferMechanicsIntegrator(probe);
    const effectiveRendererModes = effectiveVisualRendererModes(probe);
    const mechanicsMismatchIssues = scenario.expectedMechanics
      && mechanicsIntegrator
      && mechanicsIntegrator !== scenario.expectedMechanics
      ? ['mechanics-integrator-mismatch']
      : [];
    const rendererMismatchIssues = scenario.visualRendererMode
      && (
        effectiveRendererModes.length === 0
        || effectiveRendererModes.some((mode) => mode !== scenario.visualRendererMode)
      )
      ? ['visual-renderer-mode-mismatch']
      : [];
    const expectedBehaviorIssues = expectedBehavior?.status === 'pass'
      ? []
      : expectedBehavior?.checks
        ?.filter((check) => check.status !== 'pass')
        .map((check) => `expected-behavior:${check.id}`) || [];
    const issues = uniqueStrings(
      probe?.issues,
      probe?.analysis?.issues,
      mechanicsMismatchIssues,
      rendererMismatchIssues,
      expectedBehaviorIssues
    );
    const visualSurfaceIssues = uniqueVisualSurfaceIssues(
      probe?.visualSurfaceIssues,
      probe?.analysis?.visualSurfaceIssues
    );
    const failed = run.code !== 0 || probe?.status === 'bad' || issues.length > 0;
    results.push({
      label: scenario.label,
      presetId: scenario.presetId || null,
      randomPair: scenario.randomPair || null,
      visualRendererMode: scenario.visualRendererMode || null,
      effectiveVisualRendererModes: effectiveRendererModes,
      visualRendererModeMatched: scenario.visualRendererMode
        ? effectiveRendererModes.length > 0
          && effectiveRendererModes.every((mode) => mode === scenario.visualRendererMode)
        : null,
      url: scenario.url,
      expectedMechanics: scenario.expectedMechanics || null,
      mechanicsIntegrator,
      code: run.code,
      timedOut: run.timedOut,
      status: probe?.status || null,
      analysisStatus: analysis.status || null,
      issues,
      issueCount: issues.length,
      visualSurfaceIssues,
      visualSurfaceIssueCount: visualSurfaceIssues.length,
      visualSurfaceIssueTypes: Object.keys(countBy(visualSurfaceIssues, (issue) => issue.issue)),
      browserConsoleIssueCounts: analysis.browserConsoleIssueCounts || {},
      browserConsoleWarningCounts: analysis.browserConsoleWarningCounts || {},
      browserConsoleIssueCount: finiteOrNull(analysis.browserConsoleIssueCount) ?? 0,
      browserConsoleWarningCount: finiteOrNull(analysis.browserConsoleWarningCount) ?? 0,
      maxSpeedObservedMPerS: finiteOrNull(analysis.maxSpeedObservedMPerS),
      maxDisplacementObservedM: finiteOrNull(analysis.maxDisplacementObservedM),
      minVolumeObservedJ: finiteOrNull(analysis.minVolumeObservedJ),
      maxVolumeObservedJ: finiteOrNull(analysis.maxVolumeObservedJ),
      maxPressureImpulseNSeconds: finiteOrNull(analysis.maxPressureImpulseNSeconds),
      maxReactionEventsTotal: finiteOrNull(analysis.maxReactionEventsTotal),
      finalParticlesByMaterial: analysis.finalParticlesByMaterial || null,
      maxNextTimeS: finiteOrNull(analysis.maxNextTimeS),
      minVisualFrameTimeSpanS: finiteOrNull(analysis.minVisualFrameTimeSpanS),
      visualFrameTimeSpanS: finiteOrNull(analysis.visualFrameTimeSpanS),
      visualFrameTimesS: Array.isArray(analysis.visualFrameTimesS) ? analysis.visualFrameTimesS : [],
      expectLiquidFreeSurface: analysis.expectLiquidFreeSurface === true,
      liquidFreeSurfaceMinTimeS: finiteOrNull(analysis.liquidFreeSurfaceMinTimeS),
      liquidFreeSurfaceMaxTallnessRatio: finiteOrNull(analysis.liquidFreeSurfaceMaxTallnessRatio),
      liquidFreeSurfaceMinFootprintFillRatio: finiteOrNull(analysis.liquidFreeSurfaceMinFootprintFillRatio),
      liquidFreeSurfaceMaxHeightM: finiteOrNull(analysis.liquidFreeSurfaceMaxHeightM),
      firstH2oVisibleSurfaceCount: finiteOrNull(analysis.firstH2oVisibleSurfaceCount),
      lastH2oVisibleSurfaceCount: finiteOrNull(analysis.lastH2oVisibleSurfaceCount),
      maxVisibleSurfaceComponentCount: finiteOrNull(analysis.maxVisibleSurfaceComponentCount),
      maxVisibleSurfaceSmallComponentCount: finiteOrNull(analysis.maxVisibleSurfaceSmallComponentCount),
      minVisibleSurfaceLargestComponentRatio: finiteOrNull(analysis.minVisibleSurfaceLargestComponentRatio),
      maxH2oLiquidSurfaceHeightM: finiteOrNull(analysis.maxH2oLiquidSurfaceHeightM),
      maxH2oLiquidSurfaceTallnessRatio: finiteOrNull(analysis.maxH2oLiquidSurfaceTallnessRatio),
      minH2oLiquidSurfaceFootprintFillRatio: finiteOrNull(analysis.minH2oLiquidSurfaceFootprintFillRatio),
      lastH2oLiquidSurfaceHeightM: finiteOrNull(analysis.lastH2oLiquidSurfaceHeightM),
      lastH2oLiquidSurfaceTallnessRatio: finiteOrNull(analysis.lastH2oLiquidSurfaceTallnessRatio),
      lastH2oLiquidSurfaceFootprintFillRatio: finiteOrNull(analysis.lastH2oLiquidSurfaceFootprintFillRatio),
      maxVisibleSurfaceOutsideM: finiteOrNull(analysis.maxVisibleSurfaceOutsideM),
      maxVisibleSurfaceOutsideParticleBoundsM: finiteOrNull(analysis.maxVisibleSurfaceOutsideParticleBoundsM),
      meanBatchMs: finiteOrNull(analysis.meanBatchMs),
      maxBatchMs: finiteOrNull(analysis.maxBatchMs),
      meanCompactSummaryMs: finiteOrNull(analysis.meanCompactSummaryMs),
      compactSummaryMeanBatchShare: finiteOrNull(analysis.compactSummaryMeanBatchShare),
      expectedCheckpoints: scenario.expectedCheckpoints || [],
      expectedBehavior,
      evolutionTimeline: compactEvolutionTimeline(probe),
      outputPath,
      logPath,
      frameDir: captureFrames ? frameDir : null,
      frameArtifactStatus: probe?.visualFrameArtifacts?.status || null,
      frameCount: probe?.visualFrameArtifacts?.frameCount ?? 0,
      failed
    });
  }

  const summary = {
    schema: 'peercompute.ulg.sph-visual-sanity-matrix.v0',
    runId,
    outputRoot,
    scenarioCount: results.length,
    standardMode: envFlagEnabled(process.env.ULG_VISUAL_MATRIX_STANDARD, false),
    randomSeed: process.env.ULG_VISUAL_MATRIX_RANDOM_SEED ?? '0x7a11d2026',
    failedCount: results.filter((result) => result.failed).length,
    captureFrames,
    issueCounts: countBy(results.flatMap((result) => result.issues)),
    browserConsoleIssueCounts: results.reduce((counts, result) => {
      for (const [key, value] of Object.entries(result.browserConsoleIssueCounts || {})) {
        counts[key] = (counts[key] || 0) + Number(value || 0);
      }
      return counts;
    }, {}),
    browserConsoleWarningCounts: results.reduce((counts, result) => {
      for (const [key, value] of Object.entries(result.browserConsoleWarningCounts || {})) {
        counts[key] = (counts[key] || 0) + Number(value || 0);
      }
      return counts;
    }, {}),
    visualSurfaceIssueCounts: countBy(
      results.flatMap((result) => result.visualSurfaceIssues),
      (issue) => issue.issue
    ),
    results
  };
  const summaryPath = path.join(outputRoot, 'summary.json');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failedCount > 0 && !allowFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
