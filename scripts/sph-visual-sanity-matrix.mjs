import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ELEMENT_MATERIAL_OPTIONS } from '../src/visualization/sphMaterialOptions.js';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetUrl
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from '../src/runtime/sph/schroederDynamicLawRoutingContract.js';
import {
  coldCeilingCondensationEvidence,
  condensedLaunchEvidence,
  generatedCohortTrajectoryEvidence,
  mechanicsStateAdvanceEvidence,
  phaseAwareVolumeRatioEvidence
} from './sph-visual-phase-acceptance.mjs';
import {
  assertArtifactPathOutsideRepo,
  createFailSentinelWriter
} from './ss-release-evidence-common.mjs';

const DEFAULT_BASE_PORT = 5310;
const DEFAULT_OUTPUT_DIR = '/tmp/ulg-visual-sanity-matrix';
const DEFAULT_BATCHES = 4;
const DEFAULT_BATCH_STEPS = 24;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_FRAME_MAX = 16;
const DEFAULT_GENERATED_COHORT_MINIMUM_SYSTEM_MASS_FRACTION = 1e-6;
export const STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE =
  'worker-owned-resident-render-producer';
export const STANDARD_VISUAL_MATRIX_RENDERER_MODE =
  'native-webgpu-surface-consumer';
const WORKER_PARTICLE_PRESENTATION_RENDERER_MODE =
  'worker-owned-resident-particle-state-producer';
export const STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE =
  'worker-owned-resident-lane';
// The presentation worker rejects schedules above 128 steps. Preserve each
// preset's complete validation horizon by splitting its logical batches into
// exact admitted schedules instead of silently falling back to the direct
// main-thread route. The worker's internal 16-step drains bound queued work;
// using the full admitted 128-step chunk avoids duplicating terminal snapshots
// and authority-fence overhead for presets whose interactive chunk is smaller.
export const STANDARD_VISUAL_MATRIX_WORKER_SCHEDULE_MAX_STEPS = 128;
// Standard validation advances 1 ms or less per physics step. Presenting any
// intermediate state before the shared-device terminal fence can invalidate
// Dawn's external Vulkan Instance on the sodium and iron workloads. A cadence
// larger than the admitted schedule cap suppresses pre-fence candidates; the
// presentation worker still draws its exact terminal candidate after the
// canonical queue fence. Interactive playback keeps the scene default of one
// candidate per step.
export const STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS =
  STANDARD_VISUAL_MATRIX_WORKER_SCHEDULE_MAX_STEPS + 1;
const STANDARD_VISUAL_MATRIX_TIMEOUT_MIN_MS_BY_PRESET = Object.freeze({
  'water-cycle': 1_200_000,
  'iron-ice-quench': 2_700_000,
  'sodium-water': 1_800_000,
  'cesium-fluorine': 1_800_000
});

export const SPH_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION_ENV =
  'ULG_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION';

export function durableVisualMatrixReleasePublicationEnabled(
  value = process.env[SPH_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION_ENV]
) {
  return value === '1';
}

export async function persistVisualMatrixArtifact({
  artifactPath,
  repoDir,
  value,
  label = 'SPH visual matrix artifact',
  durableReleasePublication = false
}) {
  const bytes = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? value
    : Buffer.from(String(value), 'utf8');
  if (!durableReleasePublication) {
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, bytes);
    return Object.freeze({ path: artifactPath, byteLength: bytes.byteLength });
  }
  const writer = await createFailSentinelWriter({
    outputPath: artifactPath,
    repoDir,
    sentinel: Buffer.from(`failed ${label} publication\n`, 'utf8'),
    format: 'text',
    label
  });
  await writer.replace(bytes);
  return Object.freeze({
    path: writer.outputPath,
    byteLength: bytes.byteLength,
    replacementCount: writer.replacementCount()
  });
}

const STANDARD_PHASE_ACCEPTANCE_BY_PRESET = Object.freeze({
  'water-cycle': Object.freeze({
    generatedGas: Object.freeze({
      selector: Object.freeze({ materials: Object.freeze(['h2o']), phases: Object.freeze(['gas']) }),
      interfaceSelector: Object.freeze({ materials: Object.freeze(['h2o']), excludePhases: Object.freeze(['gas']) }),
      minimumMassFractionOfSystem: DEFAULT_GENERATED_COHORT_MINIMUM_SYSTEM_MASS_FRACTION,
      minimumSustainedRiseM: 0.05,
      tailSampleCount: 2
    }),
    coldCeilingCondensation: Object.freeze({
      selector: Object.freeze({
        materials: Object.freeze(['h2o']),
        phases: Object.freeze(['gas'])
      }),
      minimumCeilingContactYM: 4.75,
      minimumGasMassLossFraction: 0.02,
      minimumGasMassLossFractionOfSystem: 1e-6,
      minimumReturnDropM: 0.25
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
      minimumSustainedMeanVyMPerS: 0.001,
      tailSampleCount: 2,
      upperWallTerminal: Object.freeze({
        boundaryCondition: 'closed-g2p-clamped',
        boxMaxYM: 3,
        wallInsetM: 0.12407009817988002,
        contactToleranceM: 2.4814019635976003e-7,
        maximumTailRetreatM: 0.0024814019635976003
      })
    })
  })
});

export function scaleStandardPhaseAcceptance(acceptance, sceneLengthScale = 1) {
  if (acceptance == null) return null;
  const scale = Number(sceneLengthScale);
  if (!Number.isFinite(scale) || !(scale > 0)) {
    throw new RangeError('sceneLengthScale must be a positive finite number');
  }
  return Object.freeze({
    ...acceptance,
    ...(acceptance.generatedGas
      ? {
          generatedGas: Object.freeze({
            ...acceptance.generatedGas,
            minimumSustainedRiseM:
              acceptance.generatedGas.minimumSustainedRiseM * scale,
            ...(acceptance.generatedGas.upperWallTerminal
              ? {
                  upperWallTerminal: Object.freeze({
                    ...acceptance.generatedGas.upperWallTerminal,
                    boxMaxYM:
                      acceptance.generatedGas.upperWallTerminal.boxMaxYM
                      * scale,
                    wallInsetM:
                      acceptance.generatedGas.upperWallTerminal.wallInsetM
                      * scale,
                    contactToleranceM:
                      acceptance.generatedGas.upperWallTerminal
                        .contactToleranceM * scale,
                    maximumTailRetreatM:
                      acceptance.generatedGas.upperWallTerminal
                        .maximumTailRetreatM * scale
                  })
                }
              : {})
          })
        }
      : {}),
    ...(acceptance.condensedLaunch
      ? {
          condensedLaunch: Object.freeze({
            ...acceptance.condensedLaunch,
            maxUpwardExcursionM:
              acceptance.condensedLaunch.maxUpwardExcursionM * scale
          })
        }
      : {}),
    ...(acceptance.coldCeilingCondensation
      ? {
          coldCeilingCondensation: Object.freeze({
            ...acceptance.coldCeilingCondensation,
            minimumCeilingContactYM:
              acceptance.coldCeilingCondensation
                .minimumCeilingContactYM * scale,
            minimumReturnDropM:
              acceptance.coldCeilingCondensation.minimumReturnDropM
              * scale
          })
        }
      : {})
  });
}

export function standardScenarioPhysicalLengthScale(entry) {
  const sceneLengthScale = Number(entry?.runtime?.sceneLengthScale ?? 1);
  const baseParticlesPerEdge = Number(entry?.controls?.basen ?? 5);
  if (
    !Number.isFinite(sceneLengthScale)
    || !(sceneLengthScale > 0)
    || !Number.isFinite(baseParticlesPerEdge)
    || !(baseParticlesPerEdge > 0)
  ) {
    throw new RangeError('standard scenario geometry scale must be positive and finite');
  }
  // Legacy phase controls define the physical base edge as
  // sceneLengthScale * basen / referenceBasen. This remains invariant when a
  // preset raises resolution by increasing basen while reducing the scale.
  return sceneLengthScale * baseParticlesPerEdge / 5;
}

export function resolveVisualMatrixScenarioTimeoutMs({
  scenarioTimeoutMs,
  matrixTimeoutMs,
  matrixTimeoutExplicit = false
}) {
  return matrixTimeoutExplicit
    ? matrixTimeoutMs
    : scenarioTimeoutMs ?? matrixTimeoutMs;
}

export function workerOwnedStandardScenarioSchedulePlan(
  entry,
  validation = entry?.validation
) {
  const sourceBatches = positiveInteger(validation?.batches, 1);
  const sourceBatchSteps = positiveInteger(validation?.batchSteps, 1);
  const totalStepCount = sourceBatches * sourceBatchSteps;
  let scheduleStepCount = Math.min(
    sourceBatchSteps,
    STANDARD_VISUAL_MATRIX_WORKER_SCHEDULE_MAX_STEPS
  );
  // Keep the terminal checkpoint on the exact preset horizon even for a
  // future validation shape that is not divisible by its preferred chunk.
  while (scheduleStepCount > 1 && totalStepCount % scheduleStepCount !== 0) {
    scheduleStepCount -= 1;
  }
  return Object.freeze({
    schema: 'peercompute.ulg.sph-worker-owned-visual-schedule-plan.v0',
    sourceBatches,
    sourceBatchSteps,
    totalStepCount,
    scheduleStepCount,
    scheduleCount: totalStepCount / scheduleStepCount
  });
}

function standardScenarioFromPreset(
  entry,
  {
    validation = entry.validation,
    label = `standard-${entry.id}`,
    acceptanceTrack = validation?.acceptanceTrack ?? 'scientific-validation'
  } = {}
) {
  const workerSchedulePlan = workerOwnedStandardScenarioSchedulePlan(
    entry,
    validation
  );
  return {
    label,
    presetId: entry.id,
    acceptanceTrack,
    // The preset runtime is the architecture source of truth. The matrix owns
    // only the paused/manual harness cadence; it must not silently manufacture
    // a second hierarchy, renderer, or body configuration.
    url: sphPhaseScenarioPresetUrl(entry.id, { residentAuto: '0' }),
    visualRendererMode: entry.runtime?.surfaceDraw ?? null,
    visualRenderOwnershipMode: entry.runtime?.renderOwnership ?? null,
    residentComputeManagerMode:
      entry.runtime?.residentComputeManagerMode ?? null,
    workerProgressEverySteps:
      STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
    ...validation,
    timeoutMs: Math.max(
      STANDARD_VISUAL_MATRIX_TIMEOUT_MIN_MS_BY_PRESET[entry.id]
        ?? 1_200_000,
      Number(validation.timeoutMs) || 0
    ),
    batches: workerSchedulePlan.scheduleCount,
    batchSteps: workerSchedulePlan.scheduleStepCount,
    workerSchedulePlan,
    phaseAwareAcceptance: scaleStandardPhaseAcceptance(
      STANDARD_PHASE_ACCEPTANCE_BY_PRESET[entry.id] || null,
      standardScenarioPhysicalLengthScale(entry)
    ),
    expectedCheckpoints: validation.checkpoints,
    expectAuthoritativeTwoLevelMechanics: Boolean(
      entry.runtime?.schroederTwoLevel === '1'
      && entry.runtime?.schroederTwoLevelAuthority === 'authoritative'
    ),
    expectedTwoLevelCflFactor:
      entry.runtime?.schroederTwoLevel === '1'
        ? Number(entry.runtime?.cfl)
        : null,
    standardEnabled: true,
    defaultEnabled: false
  };
}

export const STANDARD_SCENARIOS = SPH_PHASE_SCENARIO_PRESETS
  .filter((entry) => entry.standardMatrixEnabled !== false)
  .map((entry) => (
    standardScenarioFromPreset(entry, {
      validation: entry.frameworkValidation ?? entry.validation,
      acceptanceTrack:
        entry.frameworkValidation?.acceptanceTrack ?? 'framework-liveness'
    })
  ));

// A framework arm may deliberately end after it has exercised every intended
// authority and presentation component. Preserve its original longer horizon
// as an explicit, independently selectable calibration diagnostic. These arms
// stay fail-closed and retain the same physics checks, but are not silently
// folded into ULG_VISUAL_MATRIX_STANDARD or the seven-scenario release receipt.
export const SCIENTIFIC_CALIBRATION_SCENARIOS =
  SPH_PHASE_SCENARIO_PRESETS
    .filter((entry) => entry.frameworkValidation)
    .map((entry) => standardScenarioFromPreset(entry, {
      validation: entry.validation,
      label: `scientific-calibration-${entry.id}`,
      acceptanceTrack: 'scientific-calibration'
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

const SCENARIOS = [
  ...STANDARD_SCENARIOS,
  ...SCIENTIFIC_CALIBRATION_SCENARIOS,
  ...LEGACY_SCENARIOS
];

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

function workerOwnedResidentPresentationProven(metric) {
  const rows = metric?.workerOffscreenRenderRows;
  const presentation = metric?.workerOffscreenPresentation;
  const renderedContent = presentation?.displayOwnerLastRenderedContent;
  const lane = metric?.residentSteps?.workerOwnedResidentLane;
  const committedPresentation = lane?.committedPresentation;
  if (!rows || !presentation || !renderedContent) return false;
  const renderedStep = Number(renderedContent.sphStep);
  const finalPhysicsTick = Number(lane?.finalEpochIdentity?.physicsTick);
  const currentRowsMatchRenderedContent = rows.status
    === 'worker-offscreen-resident-particle-state-producer-rendered'
    && Number(rows.sphStep) === renderedStep;
  const staleRowsPreserveRenderedContent = rows.status
    === 'worker-offscreen-presentation-superseded-stale-step'
    && Number.isSafeInteger(Number(rows.sphStep))
    && Number.isSafeInteger(Number(rows.lastPresentedSphStep))
    && Number(rows.sphStep) < Number(rows.lastPresentedSphStep)
    && Number(rows.lastPresentedSphStep) === renderedStep;
  return Boolean(
    (currentRowsMatchRenderedContent || staleRowsPreserveRenderedContent)
    && rows.displayHandoff === 'transferControlToOffscreen'
    && rows.frameCopyBackRejected === true
    && rows.workerReady === true
    && rows.contextStatus === 'webgpu-context-ready'
    && presentation.canvasTransferred === true
    && presentation.workerReady === true
    && presentation.contextStatus === 'webgpu-context-ready'
    && presentation.displayOwner === 'worker'
    && presentation.displayOwnerContentReady === true
    && Number(presentation.displayOwnerContentFrameSerial) > 0
    && presentation.displayCanvasVisible === true
    && Number.isSafeInteger(renderedStep)
    && renderedStep >= 0
    && Number.isSafeInteger(finalPhysicsTick)
    && renderedStep === finalPhysicsTick
    && Number(presentation.displayOwnerPresentedSphStep) === renderedStep
    && renderedContent.schema
      === 'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0'
    && renderedContent.renderRowsSchema
      === 'peercompute.ulg.worker-offscreen-render-rows.v0'
    && renderedContent.status
      === 'worker-offscreen-resident-particle-state-producer-rendered'
    && renderedContent.residentScheduleCandidatePresentation === true
    && renderedContent.stateManagerCommittedPresentation === true
    && renderedContent.committedPresentationSchema
      === 'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0'
    && renderedContent.committedPresentationStatus
      === 'state-manager-committed-resident-schedule-presentation-admission'
    && renderedContent.scheduleId === lane?.scheduleId
    && renderedContent.laneId === lane?.laneId
    && renderedContent.stateKey === lane?.stateKey
    && Number.isSafeInteger(Number(renderedContent.presentationLaneEpoch))
    && Number(renderedContent.presentationLaneEpoch) > 0
    && Number(renderedContent.residentExecutionGeneration)
      === Number(lane?.finalEpochIdentity?.storageGeneration)
    && Number(renderedContent.stepOrdinal) === Number(lane?.completedStepCount)
    && renderedContent.authorityStatus
      === 'state-manager-committed-worker-schedule'
    && renderedContent.computeManagerCompletionSchema
      === 'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0'
    && typeof renderedContent.computeManagerLeaseId === 'string'
    && renderedContent.computeManagerLeaseId.length > 0
    && renderedContent.computeManagerLeaseStatus === 'completed'
    && renderedContent.computeManagerFenceSatisfied === true
    && renderedContent.stateManagerCommitStatus === 'committed'
    && renderedContent.stateManagerCommitAccepted === true
    && renderedContent.terminalScheduleFence === true
    && renderedContent.terminalFenceScope === 'resident-schedule-terminal'
    && renderedContent.terminalFenceSatisfied === true
    && renderedContent.terminalFenceAuthorityAdmissionReady === true
    && committedPresentation?.stateManagerCommittedPresentation === true
    && committedPresentation?.scheduleId === lane?.scheduleId
    && committedPresentation?.laneId === lane?.laneId
    && committedPresentation?.stateKey === lane?.stateKey
    && Number(committedPresentation?.presentationLaneEpoch)
      === Number(renderedContent.presentationLaneEpoch)
    && Number(committedPresentation?.sphStep) === renderedStep
    && renderedContent.producerSourceKind
      === 'worker-retained-resident-stage-output'
    && renderedContent.producerSourceTransport
      === 'worker-retained-resident-stage-output'
    && renderedContent.sourceStageId === 'schroederSameLevelMechanics'
    && renderedContent.retainedParticleStateStatus
      === 'worker-retained-particle-state-ready'
    && Number(renderedContent.particleCount) > 0
    && Number(renderedContent.frameCount) > 0
    && Number(renderedContent.readyFrameCount) > 0
    && Number(presentation.frameCount) === Number(renderedContent.frameCount)
    && Number(presentation.readyFrameCount)
      === Number(renderedContent.readyFrameCount)
  );
}

function workerOwnedNativeSurfacePresentationProven(metric) {
  const lane = metric?.residentSteps?.workerOwnedResidentLane;
  const committedPresentation = lane?.committedPresentation;
  const presentation = metric?.workerLaneNativeSurfacePresentation;
  const handoff = metric?.workerLaneNativeSurfaceSnapshotHandoff;
  const workerPresentation = metric?.workerOffscreenPresentation;
  const workerCanvas = metric?.workerOffscreenCanvas;
  const sceneCanvases = metric?.sceneCanvasVisibility;
  const renderState = metric?.renderState;
  const surfaceDraw = metric?.surfaceDraw;
  const nativeValidation = metric?.nativeSurfaceValidation;
  const sourceStep = Number(presentation?.sourceStep);
  const sourceTimeS = Number(presentation?.sourceTimeS);
  const expectedSourceStep = Number(committedPresentation?.sphStep) + 1;
  const laneTimeS = Number(lane?.laneSimTimeS);
  const visibleBridge = surfaceDraw?.visibleRendererBridge
    ?? renderState?.surfaceDrawVisibleRendererBridge
    ?? surfaceDraw?.rendererBridge
    ?? null;
  return Boolean(
    lane
    && committedPresentation?.stateManagerCommittedPresentation === true
    && committedPresentation?.scheduleId === lane.scheduleId
    && committedPresentation?.laneId === lane.laneId
    && committedPresentation?.stateKey === lane.stateKey
    && presentation?.schema
      === 'peercompute.ulg.worker-lane-native-surface-presentation-source.v0'
    && presentation?.status
      === 'worker-lane-native-surface-presentation-source-ready'
    && presentation?.scheduleId === lane.scheduleId
    && presentation?.laneId === lane.laneId
    && presentation?.stateKey === lane.stateKey
    && typeof presentation?.requestId === 'string'
    && presentation.requestId.length > 0
    && presentation.cacheKey === presentation.requestId
    && Number.isSafeInteger(sourceStep)
    && sourceStep === expectedSourceStep
    && Number.isFinite(sourceTimeS)
    && Number.isFinite(laneTimeS)
    && Math.abs(sourceTimeS - laneTimeS) <= 1e-9
    && presentation?.readbackScope
      === 'resident-schedule-terminal-presentation'
    && presentation?.terminalPresentationFullParticleReadbackPerformed === true
    && presentation?.physicsHotLoopParticipation === false
    && Number(presentation?.particleCount) > 0
    && handoff?.schema === presentation.schema
    && handoff?.status
      === 'worker-lane-native-surface-presentation-source-admitted'
    && handoff?.scheduleId === presentation.scheduleId
    && handoff?.laneId === presentation.laneId
    && handoff?.stateKey === presentation.stateKey
    && handoff?.requestId === presentation.requestId
    && handoff?.cacheKey === presentation.cacheKey
    && Number(handoff?.sourceStep) === sourceStep
    && Math.abs(Number(handoff?.sourceTimeS) - sourceTimeS) <= 1e-9
    && handoff?.sharedSlotIdentityVerified === true
    && handoff?.workerLineageMetadataStatus
      === 'worker-retained-compact-snapshot-lineage-metadata-ready'
    && handoff?.terminalCompactSnapshotReadback === true
    && renderState?.status === 'resident-render-field-applied'
    && renderState?.sourceResidentRenderSourceStatus
      === 'resident-render-source-current'
    && renderState?.sourceResidentExecutionGenerationMatchesCurrent === true
    && Number(renderState?.sourceResidentNextStep) === sourceStep
    && Math.abs(Number(renderState?.sourceResidentNextTimeS) - sourceTimeS)
      <= 1e-9
    && renderState?.surfaceDrawOverlayPolicyStatus
      === 'surface-draw-native-webgpu-main-canvas'
    && renderState?.workerOffscreenPresentationStatus
      === 'worker-offscreen-display-hidden-main-native-owner'
    && renderState?.workerOffscreenRetainedCompactSnapshotStatus
      === 'presentation-worker-retained-compact-snapshot-exported'
    && renderState?.workerOffscreenRetainedCompactSnapshotAvailable === true
    && Number(renderState?.workerOffscreenRetainedCompactSnapshotStep)
      === sourceStep
    && surfaceDraw?.sourceResidentRenderSourceStatus
      === 'resident-render-source-current'
    && surfaceDraw?.sourceResidentExecutionGenerationMatchesCurrent === true
    && Number(surfaceDraw?.sourceResidentNextStep) === sourceStep
    && Math.abs(Number(surfaceDraw?.sourceResidentNextTimeS) - sourceTimeS)
      <= 1e-9
    && visibleBridge === STANDARD_VISUAL_MATRIX_RENDERER_MODE
    && surfaceDraw?.gpuBufferHandoffReady === true
    && surfaceDraw?.visibleGpuConsumerReady === true
    && surfaceDraw?.visibleGpuConsumerRuntimePresentationAdmitted === true
    && nativeValidation?.native === true
    && nativeValidation?.bridgeMode === STANDARD_VISUAL_MATRIX_RENDERER_MODE
    && nativeValidation?.ready === true
    && nativeValidation?.admitted === true
    && nativeValidation?.sourceCurrent === true
    && nativeValidation?.runtimePresentationAdmitted === true
    && nativeValidation?.gpuBufferHandoffReady === true
    && workerPresentation?.displayOwner === 'main-native'
    && workerPresentation?.displayCanvasVisible === false
    && workerCanvas?.visible === false
    && workerCanvas?.visibility === 'hidden'
    && Number(workerCanvas?.visibleCount) === 0
    && Number(sceneCanvases?.visibleWorkerCount) === 0
    && Number(sceneCanvases?.visibleCount) === 1
  );
}

function workerParticleOverlayVisibleOverNativeSurface(metric) {
  const visibleBridge = metric?.surfaceDraw?.visibleRendererBridge
    ?? metric?.renderState?.surfaceDrawVisibleRendererBridge
    ?? metric?.surfaceDraw?.rendererBridge
    ?? null;
  const presentation = metric?.workerOffscreenPresentation;
  const workerCanvas = metric?.workerOffscreenCanvas;
  return Boolean(
    visibleBridge === STANDARD_VISUAL_MATRIX_RENDERER_MODE
    && (
      presentation?.displayCanvasVisible === true
      || workerCanvas?.visible === true
      || Number(workerCanvas?.visibleCount) > 0
      || Number(metric?.sceneCanvasVisibility?.visibleWorkerCount) > 0
    )
  );
}

function effectiveVisualRendererModes(probe, { residentOnly = false } = {}) {
  const metrics = arrayOf(probe?.timeline?.metrics).filter((metric) => (
    !residentOnly || metric?.phase === 'resident-batch'
  ));
  return uniqueStrings(metrics.map((metric) => (
    metric?.surfaceDraw?.visibleRendererBridge
    ?? metric?.renderState?.surfaceDrawVisibleRendererBridge
    ?? metric?.surfaceDraw?.rendererBridge
    ?? (workerOwnedResidentPresentationProven(metric)
      ? WORKER_PARTICLE_PRESENTATION_RENDERER_MODE
      : null)
  )));
}

function effectiveVisualRenderOwnershipModes(probe) {
  return uniqueStrings(arrayOf(probe?.timeline?.metrics).map((metric) => (
    metric?.peerComputeRenderOwnershipPolicy?.effectiveMode ?? null
  )));
}

function effectiveResidentComputeManagerModes(probe) {
  return uniqueStrings(arrayOf(probe?.timeline?.metrics).map((metric) => (
    metric?.schroederTelemetry?.residentComputeManagerMode
      ?? metric?.residentSteps?.residentComputeManagerMode
      ?? null
  )));
}

export function workerOwnedVisualRouteIssues(scenario, probe) {
  if (
    scenario?.visualRenderOwnershipMode
      !== STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE
  ) {
    return [];
  }
  const metrics = arrayOf(probe?.timeline?.metrics).filter((metric) => (
    metric?.phase === 'resident-batch' && metric?.residentSteps
  ));
  if (metrics.length === 0) {
    return ['worker-owned-resident-route-missing'];
  }
  const issues = [];
  const expectedProgressEverySteps = positiveInteger(
    scenario?.workerProgressEverySteps,
    0
  );
  for (const metric of metrics) {
    const steps = metric.residentSteps;
    const lane = steps.workerOwnedResidentLane;
    if (steps.workerLaneFallback) {
      issues.push('worker-owned-resident-fallback');
    }
    if (!lane) {
      issues.push('worker-owned-resident-route-missing');
      continue;
    }
    const requestedStepCount = Number(lane.requestedStepCount);
    const completedStepCount = Number(lane.completedStepCount);
    if (
      lane.residentScheduleStatus !== 'worker-resident-schedule-completed'
      || lane.terminalStatus
        !== 'worker-offscreen-resident-schedule-on-presentation-device-completed'
      || lane.cancelled !== false
      || !Number.isSafeInteger(requestedStepCount)
      || requestedStepCount <= 0
      || !Number.isSafeInteger(completedStepCount)
      || completedStepCount !== requestedStepCount
      || !Number.isSafeInteger(Number(lane.retainedBufferRefCount))
      || Number(lane.retainedBufferRefCount) <= 0
    ) {
      issues.push('worker-owned-resident-schedule-incomplete');
    }
    if (
      expectedProgressEverySteps > 0
      && Number(lane.progressEverySteps) !== expectedProgressEverySteps
    ) {
      issues.push('worker-owned-resident-progress-cadence-mismatch');
    }
    if (
      lane.gpuFence?.scope !== 'resident-schedule-terminal'
      || lane.gpuFence?.terminalScheduleFence !== true
      || lane.gpuFence?.fenceSatisfied !== true
      || lane.gpuFence?.queueCompletionStatus !== 'queue-work-completed'
      || lane.gpuFence?.authorityAdmissionReady !== true
      || lane.authority?.computeManagerLeaseStatus !== 'completed'
      || lane.authority?.computeManagerFenceSatisfied !== true
      || lane.authority?.stateManagerCommitStatus !== 'committed'
    ) {
      issues.push('worker-owned-resident-authority-uncommitted');
    }
  }
  const nativeSurfacePresentationRequired =
    scenario?.visualRendererMode === STANDARD_VISUAL_MATRIX_RENDERER_MODE;
  const presentationProven = Boolean(
    metrics.length > 0
    && metrics.every((metric) => (
      nativeSurfacePresentationRequired
        ? workerOwnedNativeSurfacePresentationProven(metric)
        : workerOwnedResidentPresentationProven(metric)
    ))
  );
  if (!presentationProven) {
    issues.push('worker-owned-render-presentation-unproven');
  }
  if (
    nativeSurfacePresentationRequired
    && (
      metrics.some(workerParticleOverlayVisibleOverNativeSurface)
      || Number(
        probe?.analysis
          ?.workerOffscreenResidentParticleStateVisibleSampleCount
      ) > 0
    )
  ) {
    issues.push('worker-particle-overlay-visible-over-native-surface');
  }
  return uniqueStrings(issues);
}

export function synthesizeStandardScenarioIssues(
  scenario,
  probe,
  {
    expectedBehavior = evaluateStandardScenarioBehavior(scenario, probe),
    mechanicsIntegrator = inferMechanicsIntegrator(probe),
    rendererModes = effectiveVisualRendererModes(probe, {
      residentOnly: scenario?.visualRenderOwnershipMode
        === STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE
    }),
    renderOwnershipModes = effectiveVisualRenderOwnershipModes(probe),
    residentComputeManagerModes = effectiveResidentComputeManagerModes(probe)
  } = {}
) {
  const mechanicsMismatchIssues = scenario?.expectedMechanics
    && mechanicsIntegrator
    && mechanicsIntegrator !== scenario.expectedMechanics
    ? ['mechanics-integrator-mismatch']
    : [];
  const rendererMismatchIssues = scenario?.visualRendererMode
    && (
      rendererModes.length === 0
      || rendererModes.some(
        (mode) => mode !== scenario.visualRendererMode
      )
    )
    ? ['visual-renderer-mode-mismatch']
    : [];
  const renderOwnershipMismatchIssues = scenario?.visualRenderOwnershipMode
    && (
      renderOwnershipModes.length === 0
      || renderOwnershipModes.some(
        (mode) => mode !== scenario.visualRenderOwnershipMode
      )
    )
    ? ['visual-render-ownership-mode-mismatch']
    : [];
  const residentComputeManagerMismatchIssues = scenario?.residentComputeManagerMode
    && (
      residentComputeManagerModes.length === 0
      || residentComputeManagerModes.some(
        (mode) => mode !== scenario.residentComputeManagerMode
      )
    )
    ? ['resident-compute-manager-mode-mismatch']
    : [];
  const workerOwnedRouteIssues = workerOwnedVisualRouteIssues(scenario, probe);
  const expectedBehaviorIssues = expectedBehavior?.status === 'pass'
    ? []
    : expectedBehavior?.checks
      ?.filter((check) => (
        check.status !== 'pass'
        && check.acceptance !== 'scientific-advisory'
      ))
      .map((check) => `expected-behavior:${check.id}`) || [];
  return uniqueStrings(
    probe?.issues,
    probe?.analysis?.issues,
    mechanicsMismatchIssues,
    rendererMismatchIssues,
    renderOwnershipMismatchIssues,
    residentComputeManagerMismatchIssues,
    workerOwnedRouteIssues,
    expectedBehaviorIssues
  );
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

export function deterministicRandomPairScenarios() {
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
    params.set('renderOwnership', STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE);
    params.set('surfaceDraw', STANDARD_VISUAL_MATRIX_RENDERER_MODE);
    params.set('residentAuto', '0');
    params.set('ss', '1');
    params.set('schroederLevel', '0');
    params.set('schroederMinLevel', '0');
    params.set('schroederMaxLevel', '0');
    params.set('schroederPortableSummary', '1');
    params.set('schroederActiveNodeIndex', '1');
    params.set('schroederActiveNodeSortedIndex', '1');
    // See STANDARD_SCENARIOS: these equal-spacing visual fixtures occupy one
    // SS level. Cross-level mechanics is covered by populated native fixtures.
    params.set('schroederTwoLevel', '0');
    params.set('schroederCrossLevelCoupling', '0');
    params.set('schroederMechanicsFieldPairV2', '0');
    params.set('schroederPhaseVolumeMigration', '1');
    params.set('schroederLawQueue', '1');
    params.set('schroederLawNeighborCandidates', '1');
    const batches = positiveInteger(
      process.env.ULG_VISUAL_MATRIX_RANDOM_PAIR_BATCHES,
      3
    );
    const batchSteps = positiveInteger(
      process.env.ULG_VISUAL_MATRIX_RANDOM_PAIR_BATCH_STEPS,
      64
    );
    const workerSchedulePlan = Object.freeze({
      schema: 'peercompute.ulg.sph-worker-owned-visual-schedule-plan.v0',
      sourceBatches: batches,
      sourceBatchSteps: batchSteps,
      totalStepCount: batches * batchSteps,
      scheduleStepCount: batchSteps,
      scheduleCount: batches
    });
    scenarios.push({
      label: `random-elements-${drop.key.toLowerCase()}-${base.key.toLowerCase()}`,
      randomPair: { drop: drop.key, base: base.key, seed: rawSeed },
      acceptanceTrack: 'framework-liveness',
      url: `/?${params.toString()}`,
      expectedMechanics: 'mlsmpm',
      batches,
      batchSteps,
      workerSchedulePlan,
      workerProgressEverySteps:
        STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS,
      visualRendererMode: STANDARD_VISUAL_MATRIX_RENDERER_MODE,
      visualRenderOwnershipMode: STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE,
      residentComputeManagerMode: STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE,
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

export function checkpointMassWeightedMeanTemperature(
  checkpoint,
  material = null,
  phase = null
) {
  const rows = checkpointRows(checkpoint, material, phase);
  const massKg = rows.reduce(
    (sum, row) => sum + (finiteOrNull(row?.massKg) || 0),
    0
  );
  if (!(massKg > 0)) return null;
  return rows.reduce((sum, row) => (
    sum
    + (finiteOrNull(row?.temperatureMassWeightedMeanK) || 0)
      * (finiteOrNull(row?.massKg) || 0)
  ), 0) / massKg;
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

const FRAMEWORK_BLOCKING_BEHAVIOR_CHECK_IDS = new Set([
  'authoritative-checkpoint-series',
  'mechanics-state-advanced',
  'worker-owned-ss-framework-path',
  'surface-stress-execution-evidence',
  'authoritative-two-level-mechanics-coverage',
  'initial-state-captured',
  // Reaction-stage dispatch alone is insufficient architecture evidence: the
  // bounded reactive fixtures must consume a reactant and publish a real
  // product population across the worker-owned hierarchy. Quantitative heat,
  // plume, melt, and cooling outcomes remain scientific calibration.
  'sodium-consumed',
  'sodium-products-form',
  'fluorine-consumed',
  'csf-forms',
  'random-pair-advances'
]);

function standardScenarioBehaviorResult({
  scenario,
  checkpointCount,
  checkpoints = undefined,
  phaseAwareEvidence,
  checks
}) {
  const frameworkTrack = scenario?.acceptanceTrack === 'framework-liveness';
  const classifiedChecks = checks.map((check) => ({
    ...check,
    acceptance: frameworkTrack
      && !FRAMEWORK_BLOCKING_BEHAVIOR_CHECK_IDS.has(check.id)
      ? 'scientific-advisory'
      : 'blocking'
  }));
  const blockingChecks = classifiedChecks.filter(
    (check) => check.acceptance === 'blocking'
  );
  const statusFor = (selectedChecks) => selectedChecks.some(
    (check) => check.status === 'fail'
  )
    ? 'fail'
    : selectedChecks.some((check) => check.status === 'inconclusive')
      ? 'inconclusive'
      : 'pass';
  const scientificStatus = statusFor(classifiedChecks);
  const status = statusFor(blockingChecks);
  return {
    schema: 'peercompute.ulg.sph-standard-scenario-behavior.v1',
    status,
    scientificStatus,
    acceptanceTrack: scenario?.acceptanceTrack ?? null,
    presetId: scenario?.presetId || null,
    checkpointCount,
    ...(checkpoints === undefined ? {} : { checkpoints }),
    phaseAwareEvidence,
    blockingCheckIds: blockingChecks.map((check) => check.id),
    scientificAdvisories: classifiedChecks.filter((check) => (
      check.acceptance === 'scientific-advisory'
      && check.status !== 'pass'
    )),
    checks: classifiedChecks
  };
}

const SURFACE_STRESS_SUBMISSION_SCHEMA =
  'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2';
const SURFACE_STRESS_SUBMISSION_STATUS =
  'eighteen-pass-central-bond-surface-stress-submitted-unverified';
const SURFACE_STRESS_STANDALONE_LIFECYCLE =
  'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit';
const SURFACE_STRESS_AMBIENT_BUOYANCY_MODE =
  'field-local-s9ab-current-volume-ambient-source';

function metricSurfaceStressSubmission(metric) {
  return metric?.residentStep?.phaseVolumeSurfaceStressSubmission
    ?? metric?.residentSteps?.finalStepPhaseVolumeSurfaceStressSubmission
    ?? metric?.residentSteps?.phaseVolumeSurfaceStressWorkerEvidence
      ?.finalSubmission
    ?? metric?.residentSteps?.workerOwnedResidentLane
      ?.phaseVolumeSurfaceStress?.finalSubmission
    ?? metric?.schroederTelemetry?.phaseVolumeSurfaceStressSubmission
    ?? null;
}

function surfaceStressSubmissionExact(submission, selectedLevel) {
  return Boolean(
    submission?.schema === SURFACE_STRESS_SUBMISSION_SCHEMA
    && submission?.status === SURFACE_STRESS_SUBMISSION_STATUS
    && submission?.requested === true
    && submission?.submitted === true
    && Number(submission?.dispatchCount) === 18
    && Number(submission?.lifecycleDispatchCount) === 21
    && submission?.lifecycleMode === SURFACE_STRESS_STANDALONE_LIFECYCLE
    && submission?.ambientBuoyancyMode
      === SURFACE_STRESS_AMBIENT_BUOYANCY_MODE
    && submission?.levelRole === 'single'
    && submission?.twoLevel === false
    && Number(submission?.positiveSurfaceTensionPhaseRecordCount) > 0
    && submission?.surfaceTensionCoefficientStatus
      === 'positive-surface-tension-coefficient-ready'
    && submission?.verification === 'queue-submitted-no-full-readback'
    && Number(submission?.selectedLevel) === selectedLevel
  );
}

function metricSurfaceStressEvidenceExact(metric, selectedLevel) {
  const finalSubmission = metricSurfaceStressSubmission(metric);
  if (!surfaceStressSubmissionExact(finalSubmission, selectedLevel)) {
    return false;
  }
  const steps = metric?.residentSteps;
  if (!steps) return true;
  const completedStepCount = Number(steps.completedStepCount);
  const workerEvidence =
    steps.phaseVolumeSurfaceStressWorkerEvidence
    ?? steps.workerOwnedResidentLane?.phaseVolumeSurfaceStress
    ?? null;
  if (workerEvidence) {
    return Boolean(
      workerEvidence.schema
        === 'peercompute.ulg.worker-resident-schedule-surface-stress-evidence.v0'
      && workerEvidence.required === true
      && workerEvidence.submissionEvidenceComplete === true
      && Number.isInteger(completedStepCount)
      && completedStepCount > 0
      && Number(workerEvidence.observedStepCount) === completedStepCount
      && Number(workerEvidence.expectedSubmissionCount) === completedStepCount
      && Number(workerEvidence.exactSubmissionCount) === completedStepCount
      && workerEvidence.firstIncompleteStepOrdinal == null
      && Number(workerEvidence.finalSubmissionStepOrdinal)
        === completedStepCount
      && surfaceStressSubmissionExact(
        workerEvidence.finalSubmission,
        selectedLevel
      )
    );
  }
  const submissions = arrayOf(steps.phaseVolumeSurfaceStressSubmissions);
  return Boolean(
    steps.phaseVolumeSurfaceStressRequired === true
    && steps.phaseVolumeSurfaceStressSubmissionEvidenceComplete === true
    && Number.isInteger(completedStepCount)
    && completedStepCount > 0
    && Number(steps.phaseVolumeSurfaceStressExpectedSubmissionCount)
      === completedStepCount
    && Number(steps.phaseVolumeSurfaceStressSubmissionCount)
      === completedStepCount
    && submissions.length === completedStepCount
    && submissions.every((submission) => (
      surfaceStressSubmissionExact(submission, selectedLevel)
    ))
  );
}

function residentExecutionMetricsForEvidence(scenario, probe) {
  const metrics = arrayOf(probe?.timeline?.metrics);
  const workerOwned = Boolean(
    scenario?.visualRenderOwnershipMode
      === STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE
    || scenario?.residentComputeManagerMode
      === STANDARD_VISUAL_MATRIX_RESIDENT_COMPUTE_MODE
  );
  if (!workerOwned) {
    return {
      workerOwned: false,
      metrics: metrics.filter((metric) => (
        !String(metric?.phase || '').includes('error')
        && (
          metric?.residentStep != null
          || Number(metric?.residentSteps?.completedStepCount) > 0
        )
      )),
      expectedSampleCount: null,
      duplicateScheduleIdCount: 0,
      primaryAttemptCount: 0,
      invalidExecutionSampleCount: 0,
      coverageComplete: true
    };
  }
  const expectedSampleCount = positiveInteger(
    scenario?.workerSchedulePlan?.scheduleCount,
    positiveInteger(scenario?.batches, 0)
  );
  const seenScheduleIds = new Set();
  let duplicateScheduleIdCount = 0;
  let primaryAttemptCount = 0;
  let invalidExecutionSampleCount = 0;
  const successful = [];
  const expectedScheduleStepCount = positiveInteger(
    scenario?.workerSchedulePlan?.scheduleStepCount,
    0
  );
  const expectedProgressEverySteps = positiveInteger(
    scenario?.workerProgressEverySteps,
    0
  );
  const expectedTotalStepCount = positiveInteger(
    scenario?.workerSchedulePlan?.totalStepCount,
    expectedScheduleStepCount * expectedSampleCount
  );
  for (const metric of metrics) {
    if (!String(metric?.phase || '').startsWith('resident-batch')) continue;
    primaryAttemptCount += 1;
    const steps = metric?.residentSteps ?? null;
    const lane = steps?.workerOwnedResidentLane ?? null;
    const scheduleId = String(lane?.scheduleId || '').trim();
    const requestedStepCount = Number(lane?.requestedStepCount);
    const completedStepCount = Number(lane?.completedStepCount);
    const exact = Boolean(
      metric?.phase === 'resident-batch'
      && steps?.residentComputeManagerMode === 'worker-owned-resident-lane'
      && steps?.workerLaneFallback == null
      && lane?.residentScheduleStatus === 'worker-resident-schedule-completed'
      && lane?.terminalStatus
        === 'worker-offscreen-resident-schedule-on-presentation-device-completed'
      && scheduleId
      && Number.isSafeInteger(requestedStepCount)
      && requestedStepCount > 0
      && (
        expectedScheduleStepCount <= 0
        || requestedStepCount === expectedScheduleStepCount
      )
      && completedStepCount === requestedStepCount
      && (
        expectedProgressEverySteps <= 0
        || Number(lane?.progressEverySteps) === expectedProgressEverySteps
      )
      && lane?.cancelled === false
      && lane?.gpuFence?.scope === 'resident-schedule-terminal'
      && lane?.gpuFence?.terminalScheduleFence === true
      && lane?.gpuFence?.fenceSatisfied === true
      && lane?.gpuFence?.authorityAdmissionReady === true
      && lane?.authority?.status === 'state-manager-committed-worker-schedule'
      && lane?.authority?.computeManagerLeaseStatus === 'completed'
      && lane?.authority?.computeManagerFenceSatisfied === true
      && lane?.authority?.stateManagerCommitStatus === 'committed'
    );
    if (!exact) {
      invalidExecutionSampleCount += 1;
      continue;
    }
    if (seenScheduleIds.has(scheduleId)) {
      duplicateScheduleIdCount += 1;
      continue;
    }
    seenScheduleIds.add(scheduleId);
    successful.push(metric);
  }
  const requestedStepCountSum = successful.reduce((sum, metric) => (
    sum + Number(
      metric?.residentSteps?.workerOwnedResidentLane?.requestedStepCount || 0
    )
  ), 0);
  const finalLaneCompletedStepTotal = Number(
    successful.at(-1)?.residentSteps?.workerOwnedResidentLane
      ?.laneCompletedStepTotal
  );
  const coverageComplete = Boolean(
    expectedSampleCount > 0
    && successful.length === expectedSampleCount
    && primaryAttemptCount === expectedSampleCount
    && invalidExecutionSampleCount === 0
    && duplicateScheduleIdCount === 0
    && (
      expectedTotalStepCount <= 0
      || (
        requestedStepCountSum === expectedTotalStepCount
        && finalLaneCompletedStepTotal === expectedTotalStepCount
      )
    )
  );
  return {
    workerOwned: true,
    metrics: successful,
    expectedSampleCount,
    duplicateScheduleIdCount,
    primaryAttemptCount,
    invalidExecutionSampleCount,
    expectedScheduleStepCount,
    expectedTotalStepCount,
    requestedStepCountSum,
    finalLaneCompletedStepTotal: Number.isSafeInteger(finalLaneCompletedStepTotal)
      ? finalLaneCompletedStepTotal
      : null,
    coverageComplete
  };
}

/**
 * Require queue-submission evidence from every retained resident execution
 * sample when a standard scenario requests the surface-tension law.
 */
export function evaluateSurfaceStressExecutionEvidence(scenario, probe) {
  const url = new URL(scenario?.url || '/', 'https://ulg.invalid');
  const requested = /^(1|true|on|yes)$/i.test(
    String(url.searchParams.get('lawst') || '')
  );
  if (!requested) return null;

  const selectedLevel = Number(url.searchParams.get('schroederLevel'));
  const executionEvidence = residentExecutionMetricsForEvidence(
    scenario,
    probe
  );
  const residentMetrics = executionEvidence.metrics;
  const submissions = residentMetrics.map(metricSurfaceStressSubmission);
  const exactSubmissionCount = residentMetrics.filter((metric) => (
    metricSurfaceStressEvidenceExact(metric, selectedLevel)
  )).length;
  const lastSubmission = submissions.at(-1) || null;
  const passed = (
    Number.isInteger(selectedLevel)
    && residentMetrics.length > 0
    && exactSubmissionCount === residentMetrics.length
    && metricSurfaceStressEvidenceExact(residentMetrics.at(-1), selectedLevel)
    && executionEvidence.duplicateScheduleIdCount === 0
    && executionEvidence.invalidExecutionSampleCount === 0
    && (
      executionEvidence.workerOwned !== true
      || executionEvidence.coverageComplete === true
    )
  );

  return behaviorCheck(
    'surface-stress-execution-evidence',
    'every retained resident execution submits the exact single-level nine-dispatch surface-stress lifecycle',
    passed,
    {
      requested,
      selectedLevel: Number.isInteger(selectedLevel) ? selectedLevel : null,
      residentExecutionSampleCount: residentMetrics.length,
      expectedExecutionSampleCount: executionEvidence.expectedSampleCount,
      duplicateScheduleIdCount: executionEvidence.duplicateScheduleIdCount,
      primaryAttemptCount: executionEvidence.primaryAttemptCount,
      invalidExecutionSampleCount:
        executionEvidence.invalidExecutionSampleCount,
      expectedScheduleStepCount: executionEvidence.expectedScheduleStepCount,
      expectedTotalStepCount: executionEvidence.expectedTotalStepCount,
      requestedStepCountSum: executionEvidence.requestedStepCountSum,
      finalLaneCompletedStepTotal:
        executionEvidence.finalLaneCompletedStepTotal,
      exactSubmissionCount,
      lastSubmission
    }
  );
}

export function evaluateAuthoritativeTwoLevelMechanicsEvidence(
  scenario,
  probe
) {
  if (scenario?.expectAuthoritativeTwoLevelMechanics !== true) return null;
  const executionEvidence = residentExecutionMetricsForEvidence(
    scenario,
    probe
  );
  const residentMetrics = executionEvidence.metrics;
  const expectedCflFactor = Number(scenario?.expectedTwoLevelCflFactor);
  const expectedCflFactorRequired = Number.isFinite(expectedCflFactor)
    && expectedCflFactor > 0;
  const metricCoverageComplete = (metric) => {
    const lane = metric?.residentSteps?.workerOwnedResidentLane ?? null;
    const evidence = lane?.twoLevelMechanics ?? null;
    if (!evidence) {
      return !expectedCflFactorRequired && metric?.schroederTelemetry
        ?.twoLevelMechanicsCoverageComplete === true;
    }
    const completedStepCount = Number(lane.completedStepCount);
    const lastStep = evidence.lastStep ?? null;
    const terminalRefluxReceipt = evidence.terminalRefluxReceipt ?? null;
    return Boolean(
      evidence.schema
        === 'peercompute.ulg.worker-resident-schedule-two-level-mechanics-evidence.v0'
      && evidence.requested === true
      && evidence.authorityRequested === 'authoritative'
      && Number.isInteger(completedStepCount)
      && completedStepCount > 0
      && Number(evidence.observedStepCount) === completedStepCount
      && Number(evidence.exactAuthoritativeStepCount)
        === completedStepCount
      && (
        !expectedCflFactorRequired
        || (
          evidence.cflFactorEvidenceRequired === true
          && Number(evidence.cflFactorRequested) === expectedCflFactor
          && Number(evidence.cflFactorObservedStepCount)
            === completedStepCount
          && Number(evidence.exactCflFactorCount) === completedStepCount
          && evidence.firstCflFactorMismatchStepOrdinal == null
          && Number(evidence.lastCflFactor) === expectedCflFactor
        )
      )
      && evidence.firstIncompleteStepOrdinal == null
      && evidence.coverageComplete === true
      && evidence.terminalRefluxReceiptRequired === true
      && terminalRefluxReceipt?.schema
        === 'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0'
      && terminalRefluxReceipt.required === true
      && terminalRefluxReceipt.scheduleId === lane.scheduleId
      && terminalRefluxReceipt.laneId === lane.laneId
      && terminalRefluxReceipt.stateKey === lane.stateKey
      && Number(terminalRefluxReceipt.expectedStepCount)
        === completedStepCount
      && Number(terminalRefluxReceipt.observedStepCount)
        === completedStepCount
      && Number(terminalRefluxReceipt.admittedStepCount)
        === completedStepCount
      && Number(evidence.terminalRefluxAdmittedStepCount)
        === completedStepCount
      && terminalRefluxReceipt.firstRejectedStepOrdinal == null
      && terminalRefluxReceipt.allStepsAdmitted === true
      && terminalRefluxReceipt.status
        === 'terminal-reflux-schedule-receipt-admitted'
      && terminalRefluxReceipt.reason == null
      && terminalRefluxReceipt.firstRejectedDiagnostic == null
      && lastStep.status
        === 'schroeder-two-level-authoritative-step-executed'
      && lastStep.twoLevelMechanicsEnabled === true
      && Number(lastStep.mechanicsLevelCount) >= 2
      && lastStep.twoLevelMechanicsAuthority === 'authoritative'
      && Number(lastStep.twoLevelFineSubstepCount)
        === Number(evidence.fineSubstepCountRequested)
      && lastStep.twoLevelAuthoritativeCommitVerified === true
    );
  };
  const completeSampleCount = residentMetrics.filter(
    metricCoverageComplete
  ).length;
  return behaviorCheck(
    'authoritative-two-level-mechanics-coverage',
    'every retained resident execution completes authoritative adjacent-level mechanics',
    (
      residentMetrics.length > 0
      && completeSampleCount === residentMetrics.length
      && executionEvidence.duplicateScheduleIdCount === 0
      && executionEvidence.invalidExecutionSampleCount === 0
      && (
        executionEvidence.workerOwned !== true
        || executionEvidence.coverageComplete === true
      )
    ),
    {
      requested: true,
      expectedCflFactor:
        expectedCflFactorRequired ? expectedCflFactor : null,
      residentExecutionSampleCount: residentMetrics.length,
      expectedExecutionSampleCount: executionEvidence.expectedSampleCount,
      duplicateScheduleIdCount: executionEvidence.duplicateScheduleIdCount,
      primaryAttemptCount: executionEvidence.primaryAttemptCount,
      invalidExecutionSampleCount:
        executionEvidence.invalidExecutionSampleCount,
      expectedScheduleStepCount: executionEvidence.expectedScheduleStepCount,
      expectedTotalStepCount: executionEvidence.expectedTotalStepCount,
      requestedStepCountSum: executionEvidence.requestedStepCountSum,
      finalLaneCompletedStepTotal:
        executionEvidence.finalLaneCompletedStepTotal,
      completeSampleCount,
      lastSchroederTelemetry:
        residentMetrics.at(-1)?.schroederTelemetry ?? null
    }
  );
}

/**
 * Prove that the framework path, rather than a calibrated outcome, executed
 * on every committed worker schedule. Single-level arms exercise the explicit
 * local law queue and neighbor candidate stages. The adjacent-level Cs/F arm
 * uses the canonical mechanics-field transaction instead, whose authority is
 * independently sealed by the terminal reflux evaluator above.
 */
function exactConfiguredPresetDynamicReactionActivation({
  activation,
  receipt,
  firstActiveScheduleId = null
}) {
  const nonEmpty = (value) => (
    typeof value === 'string' && value.trim().length > 0
  );
  const sourceParticleCount = Number(receipt?.sourceParticleCount);
  const terminalParticleCount = Number(receipt?.terminalParticleCount);
  return Boolean(
    activation?.state === 'active'
    && nonEmpty(activation.transitionFingerprint)
    && nonEmpty(activation.committedScheduleId)
    && receipt?.schema
      === 'peercompute.ulg.sph-scene-dynamic-reaction-activation.v0'
    && receipt?.status
      === 'dynamic-reaction-activation-consumed-and-admitted'
    && nonEmpty(receipt.predecessorScheduleId)
    && nonEmpty(receipt.consumerScheduleId)
    && receipt.consumerScheduleId === activation.committedScheduleId
    && receipt.targetScheduleRequestId === receipt.consumerScheduleId
    && (
      firstActiveScheduleId == null
      || receipt.consumerScheduleId === firstActiveScheduleId
    )
    && receipt.configurationContinuityMode
      === 'prospective-reaction-dormant-to-executing'
    && receipt.transitionKind
      === 'reaction-dormant-watch-to-executing-reaction'
    && receipt.transitionFingerprint === activation.transitionFingerprint
    && receipt.route === 'canonical-schroeder'
    && [
      'fresh-or-canonical-continuation',
      'tier0-to-canonical-schedule-boundary',
      'tier0-one-to-four-to-canonical-schedule-boundary'
    ].includes(receipt.routeTransition)
    && receipt.reactionExecution === true
    && Number.isSafeInteger(sourceParticleCount)
    && sourceParticleCount > 0
    && terminalParticleCount === sourceParticleCount
    && receipt.sourcePhaseLaneCount === 4
    && receipt.terminalPhaseLaneCount === 4
    && receipt.phaseCarrierTopologyAuthority
      === 'preexisting-four-carrier-plan'
    && receipt.phaseCarrierTrigger == null
    && receipt.phaseCarrierMapAsyncCount === 0
    && receipt.phaseCarrierReadbackBytes === 0
    && receipt.terminalGpuFenceSatisfied === true
    && receipt.stateManagerCommitted === true
    && receipt.consumedBeforeLeaseAcquisition === true
    && receipt.consumedBeforeRouteSelection === true
    && receipt.consumedBeforeGpuWork === true
    && receipt.shadowOnly === SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    && receipt.routingAuthority === SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    && receipt.executionGating
      === SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE
  );
}

export function evaluateWorkerOwnedSsFrameworkEvidence(scenario, probe) {
  const executionEvidence = residentExecutionMetricsForEvidence(
    scenario,
    probe
  );
  if (executionEvidence.workerOwned !== true) return null;

  const twoLevelRequired =
    scenario?.expectAuthoritativeTwoLevelMechanics === true;
  const reactionRequired = scenario?.presetId === 'sodium-water'
    || scenario?.presetId === 'cesium-fluorine';
  const minimumScheduleCount = scenario?.acceptanceTrack === 'framework-liveness'
    ? 2
    : 1;
  const samples = [];
  let cumulativeCompletedStepCount = 0;
  let previousCompletedTotal = 0;
  let previousStorageGeneration = null;
  let previousPhysicsTick = null;
  let previousPositionEpoch = null;
  let canonicalLaneId = null;
  let canonicalStateKey = null;
  let dynamicReactionDormantObserved = false;
  let dynamicReactionActiveObserved = false;
  let dynamicReactionActivationFingerprint = null;
  let dynamicReactionCommittedScheduleId = null;

  for (const metric of executionEvidence.metrics) {
    const lane = metric?.residentSteps?.workerOwnedResidentLane ?? null;
    const hierarchy = lane?.hierarchyStageSummary ?? null;
    const blockers = [];
    const completedStepCount = Number(lane?.completedStepCount);
    const completedTotal = Number(lane?.laneCompletedStepTotal);
    const storageGeneration = Number(
      lane?.finalEpochIdentity?.storageGeneration
    );
    const physicsTick = Number(lane?.finalEpochIdentity?.physicsTick);
    const positionEpoch = Number(lane?.finalEpochIdentity?.positionEpoch);
    const laneId = String(lane?.laneId || '');
    const stateKey = String(lane?.stateKey || '');
    const dynamicReactionActivation =
      lane?.dynamicReactionActivation ?? null;
    const dynamicReactionActivationReceipt =
      lane?.dynamicReactionActivationReceipt ?? null;

    if (canonicalLaneId == null) canonicalLaneId = laneId;
    if (canonicalStateKey == null) canonicalStateKey = stateKey;
    if (!laneId || laneId !== canonicalLaneId) blockers.push('lane-identity-drift');
    if (!stateKey || stateKey !== canonicalStateKey) {
      blockers.push('state-identity-drift');
    }

    cumulativeCompletedStepCount += Number.isSafeInteger(completedStepCount)
      ? completedStepCount
      : 0;
    if (
      !Number.isSafeInteger(completedTotal)
      || completedTotal !== cumulativeCompletedStepCount
      || completedTotal <= previousCompletedTotal
    ) {
      blockers.push('lane-step-total-not-monotonic');
    }
    previousCompletedTotal = completedTotal;

    const epochFields = [storageGeneration, physicsTick, positionEpoch];
    if (!epochFields.every(Number.isSafeInteger)) {
      blockers.push('terminal-epoch-identity-incomplete');
    } else if (
      previousStorageGeneration != null
      && (
        storageGeneration <= previousStorageGeneration
        || physicsTick <= previousPhysicsTick
        || positionEpoch <= previousPositionEpoch
      )
    ) {
      blockers.push('terminal-epoch-identity-not-monotonic');
    }
    previousStorageGeneration = storageGeneration;
    previousPhysicsTick = physicsTick;
    previousPositionEpoch = positionEpoch;

    if (
      hierarchy?.schema
        !== 'peercompute.ulg.worker-schroeder-hierarchy-stage-summary.v0'
      || hierarchy?.status
        !== 'worker-schroeder-hierarchy-stage-summary-ready'
    ) {
      blockers.push('hierarchy-stage-summary-unproven');
    }
    if (
      hierarchy?.fullParticleReadbackPerformed === true
      || hierarchy?.fullParticleReadbackFree !== true
    ) {
      blockers.push('hierarchy-hot-loop-readback-observed');
    }
    if (
      hierarchy?.staticGpuTableUploadStatus?.retainedAcrossSteps !== true
      || hierarchy?.staticGpuTableUploadStatus?.thermalResponseGraph
        !== 'webgpu-uploaded'
      || hierarchy?.staticGpuTableUploadStatus?.mechanicsMaterialPhase
        !== 'webgpu-uploaded'
    ) {
      blockers.push('static-gpu-table-path-unproven');
    }
    let reactionActive = false;
    if (reactionRequired) {
      reactionActive = dynamicReactionActivation?.state === 'active';
      if (!reactionActive) {
        if (
          dynamicReactionActiveObserved
          || dynamicReactionActivation?.state !== 'dormant'
          || dynamicReactionActivation?.transitionFingerprint != null
          || dynamicReactionActivation?.committedScheduleId != null
          || dynamicReactionActivationReceipt != null
        ) {
          blockers.push('dynamic-reaction-dormant-state-unproven');
        } else {
          dynamicReactionDormantObserved = true;
        }
      } else {
        const firstActiveScheduleId = dynamicReactionActiveObserved
          ? null
          : lane?.scheduleId ?? null;
        if (!exactConfiguredPresetDynamicReactionActivation({
          activation: dynamicReactionActivation,
          receipt: dynamicReactionActivationReceipt,
          firstActiveScheduleId
        })) {
          blockers.push('dynamic-reaction-activation-receipt-unproven');
        }
        if (
          !dynamicReactionDormantObserved
          || (
            dynamicReactionActivationFingerprint != null
            && dynamicReactionActivation.transitionFingerprint
              !== dynamicReactionActivationFingerprint
          )
          || (
            dynamicReactionCommittedScheduleId != null
            && dynamicReactionActivation.committedScheduleId
              !== dynamicReactionCommittedScheduleId
          )
        ) {
          blockers.push('dynamic-reaction-activation-lineage-unproven');
        }
        dynamicReactionActiveObserved = true;
        dynamicReactionActivationFingerprint =
          dynamicReactionActivation.transitionFingerprint;
        dynamicReactionCommittedScheduleId =
          dynamicReactionActivation.committedScheduleId;
      }
    }
    if (twoLevelRequired) {
      const closure = hierarchy?.postMechanicsClosure ?? null;
      const executedStageOrder = arrayOf(closure?.executedStageOrder);
      const requiredClosureStageOrder = reactionActive
        ? [
            'thermal-phase',
            'reaction-discovery',
            'reaction-product',
            'phase-carrier-transfer-v2',
            'mechanics-constitutive-refresh'
          ]
        : [
            'thermal-phase',
            'phase-carrier-transfer-v2',
            'mechanics-constitutive-refresh'
          ];
      let previousStageIndex = -1;
      const closureStagesOrdered = requiredClosureStageOrder.every(
        (stage) => {
          const index = executedStageOrder.indexOf(stage);
          if (index <= previousStageIndex) return false;
          previousStageIndex = index;
          return true;
        }
      );
      if (
        Number(hierarchy?.mechanicsLevelCount) < 2
        || hierarchy?.twoLevelMechanicsEnabled !== true
        || hierarchy?.twoLevelMechanicsAuthority !== 'authoritative'
        || hierarchy?.twoLevelAuthoritativeCommitVerified !== true
        || hierarchy?.mechanicsFieldPairV2Enabled !== true
      ) {
        blockers.push('adjacent-level-mechanics-path-unproven');
      }
      if (
        hierarchy?.thermalRequested !== true
        || hierarchy?.reactionRequested !== reactionActive
        || closure?.schema
          !== 'peercompute.ulg.mls-mpm-post-mechanics-closure.v1'
        || closure?.status !== 'post-mechanics-closure-complete'
        || closure?.backend !== 'webgpu'
        || (
          reactionActive
            ? closure?.reactionStatus !== 'reaction-step-executed'
            : closure?.reactionStatus != null
        )
        || closure?.fullParticleReadbackFree !== true
        || closure?.residentContinuationReady !== true
        || !closureStagesOrdered
      ) {
        blockers.push('post-mechanics-law-closure-unproven');
      }
    } else {
      if (
        hierarchy?.thermalRequested !== true
        || hierarchy?.residentStageStatus?.thermal
          !== 'thermal-step-executed'
        || hierarchy?.residentStageBackends?.thermal !== 'webgpu'
      ) {
        blockers.push('thermal-law-path-unproven');
      }
      if (
        reactionRequired
        && (reactionActive
          ? (
              hierarchy?.reactionRequested !== true
              || hierarchy?.residentStageStatus?.reaction
                !== 'reaction-step-executed'
              || hierarchy?.residentStageBackends?.reaction !== 'webgpu'
            )
          : (
              hierarchy?.reactionRequested !== false
              || hierarchy?.residentStageStatus?.reaction !== 'missing'
              || hierarchy?.residentStageBackends?.reaction != null
            ))
      ) {
        blockers.push('reaction-law-path-unproven');
      }
      const canonicalExactNearLocalLawPath = Boolean(
        hierarchy?.lawNeighborCandidateStatus
          === 'schroeder-law-neighbor-candidates-superseded-by-canonical-exact-near-consumers'
        && hierarchy?.lawNeighborCandidateConsumerStatus
          === 'canonical-exact-near-consumers-reject-legacy-law-neighbor-candidates'
        && hierarchy?.lawQueueConsumerStatus
          === 'law-queue-retained-as-canonical-dynamic-law-activation-carrier'
      );
      if (
        Number(hierarchy?.mechanicsLevelCount) < 1
        || hierarchy?.lawQueueStatus !== 'schroeder-law-queue-submitted'
        || !canonicalExactNearLocalLawPath
      ) {
        blockers.push('local-law-queue-path-unproven');
      }
    }

    samples.push({
      scheduleId: lane?.scheduleId ?? null,
      laneId: laneId || null,
      stateKey: stateKey || null,
      completedStepCount:
        Number.isSafeInteger(completedStepCount) ? completedStepCount : null,
      laneCompletedStepTotal:
        Number.isSafeInteger(completedTotal) ? completedTotal : null,
      finalEpochIdentity: lane?.finalEpochIdentity ?? null,
      dynamicReactionActivation,
      dynamicReactionActivationReceipt,
      hierarchyStageSummary: hierarchy,
      blockers
    });
  }

  const passed = Boolean(
    executionEvidence.coverageComplete === true
    && samples.length >= minimumScheduleCount
    && (
      !reactionRequired
      || (
        dynamicReactionDormantObserved
        && dynamicReactionActiveObserved
      )
    )
    && samples.every((sample) => sample.blockers.length === 0)
  );
  return behaviorCheck(
    'worker-owned-ss-framework-path',
    'the worker-owned SS hierarchy executes its law path and advances one persistent lane without fallback or a stalled worker schedule',
    passed,
    {
      acceptanceTrack: scenario?.acceptanceTrack ?? null,
      twoLevelRequired,
      reactionRequired,
      dynamicReactionDormantObserved,
      dynamicReactionActiveObserved,
      dynamicReactionActivationFingerprint,
      dynamicReactionCommittedScheduleId,
      minimumScheduleCount,
      residentExecutionSampleCount: samples.length,
      expectedExecutionSampleCount: executionEvidence.expectedSampleCount,
      coverageComplete: executionEvidence.coverageComplete,
      finalLaneCompletedStepTotal:
        executionEvidence.finalLaneCompletedStepTotal,
      samples
    }
  );
}

export function evaluateStandardScenarioBehavior(scenario, probe) {
  if (!scenario.standardEnabled) return null;
  const surfaceStressExecutionCheck =
    evaluateSurfaceStressExecutionEvidence(scenario, probe);
  const authoritativeTwoLevelMechanicsCheck =
    evaluateAuthoritativeTwoLevelMechanicsEvidence(scenario, probe);
  const workerOwnedSsFrameworkCheck =
    evaluateWorkerOwnedSsFrameworkEvidence(scenario, probe);
  const checkpoints = authoritativeCheckpointSeries(probe);
  const mechanicsStateAdvance = mechanicsStateAdvanceEvidence(checkpoints);
  const mechanicsStateAdvanceCheck = behaviorCheck(
    'mechanics-state-advanced',
    'authoritative mechanics state advances across captured checkpoints',
    mechanicsStateAdvance.status === 'pass',
    mechanicsStateAdvance,
    { inconclusive: mechanicsStateAdvance.status === 'inconclusive' }
  );
  if (checkpoints.length < 2) {
    const checks = [
      behaviorCheck(
        'authoritative-checkpoint-series',
        'at least two authoritative GPU checkpoints are captured',
        false,
        { checkpointCount: checkpoints.length },
        { inconclusive: true }
      ),
      mechanicsStateAdvanceCheck,
      ...(workerOwnedSsFrameworkCheck ? [workerOwnedSsFrameworkCheck] : []),
      ...(surfaceStressExecutionCheck ? [surfaceStressExecutionCheck] : []),
      ...(authoritativeTwoLevelMechanicsCheck
        ? [authoritativeTwoLevelMechanicsCheck]
        : [])
    ];
    return standardScenarioBehaviorResult({
      scenario,
      checkpointCount: checkpoints.length,
      phaseAwareEvidence: {
        mechanicsStateAdvance
      },
      checks
    });
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
  const condensationEvidence = phaseAwareConfig.coldCeilingCondensation
    ? coldCeilingCondensationEvidence(
        checkpoints,
        phaseAwareConfig.coldCeilingCondensation
      )
    : null;
  const generatedGasCheckpoints =
    condensationEvidence?.ceilingContactCheckpointIndex != null
      ? checkpoints.slice(
          0,
          condensationEvidence.ceilingContactCheckpointIndex + 1
        )
      : checkpoints;
  const generatedGasEvidence = phaseAwareConfig.generatedGas
    ? generatedCohortTrajectoryEvidence(
        generatedGasCheckpoints,
        phaseAwareConfig.generatedGas
      )
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
  ), mechanicsStateAdvanceCheck, behaviorCheck(
    'phase-volume-ratios-bounded',
    'condensed and gas mechanics remain inside their phase-appropriate volume-ratio domains',
    volumeRatioEvidence.status === 'pass',
    volumeRatioEvidence,
    { inconclusive: volumeRatioEvidence.status === 'inconclusive' }
  )];
  if (workerOwnedSsFrameworkCheck) checks.push(workerOwnedSsFrameworkCheck);
  if (surfaceStressExecutionCheck) checks.push(surfaceStressExecutionCheck);
  if (authoritativeTwoLevelMechanicsCheck) {
    checks.push(authoritativeTwoLevelMechanicsCheck);
  }
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
        condensationEvidence?.status === 'pass'
      ), {
        gasMassesKg: gasMasses,
        significantGasMassesKg: significantGasMasses,
        minimumSignificantMassKg:
          generatedGasEvidence?.minimumMassKg ?? null,
        condensation: condensationEvidence
      }, {
        inconclusive:
          generatedGasEvidence?.formed !== true
          || condensationEvidence?.status === 'inconclusive'
      })
    );
  } else if (scenario.presetId === 'iron-ice-quench') {
    const initialFeLiquid = checkpointMass(first, 'fe', 'liquid');
    const finalFeLiquid = checkpointMass(last, 'fe', 'liquid');
    const initialFeSolid = checkpointMass(first, 'fe', 'solid');
    const finalFeSolid = checkpointMass(last, 'fe', 'solid');
    const initialFeTemperature =
      checkpointMassWeightedMeanTemperature(first, 'fe');
    const finalFeTemperature =
      checkpointMassWeightedMeanTemperature(last, 'fe');
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
      behaviorCheck('iron-cools', 'iron mass-weighted mean temperature decreases by at least 10 K', (
        Number.isFinite(initialFeTemperature) && Number.isFinite(finalFeTemperature)
        && finalFeTemperature <= initialFeTemperature - 10
      ), {
        statistic: 'mass-weighted-mean-temperature',
        initialMeanTemperatureK: initialFeTemperature,
        finalMeanTemperatureK: finalFeTemperature
      }),
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
      behaviorCheck('hydrogen-rises', 'hydrogen products rise into the headspace and remain there or sustain upward motion', (
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

  return standardScenarioBehaviorResult({
    scenario,
    checkpointCount: checkpoints.length,
    checkpoints,
    phaseAwareEvidence: {
      volumeRatio: volumeRatioEvidence,
      mechanicsStateAdvance,
      generatedGas: generatedGasEvidence,
      coldCeilingCondensation: condensationEvidence,
      condensedLaunch: launchEvidence
    },
    checks
  });
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

export function scenarioEnv({
  scenario,
  outputPath,
  frameDir,
  port,
  batches,
  batchSteps,
  timeoutMs,
  durableReleasePublication = false
}) {
  const captureFrames = envFlagEnabled(process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, true);
  const env = {
    ...process.env,
    ULG_PROBE_URL: scenario.url,
    ULG_PROBE_OUTPUT: outputPath,
    // The probe JSON is authoritative at outputPath. Re-emitting the same
    // 100+ MiB payload through the child stdout pipe made the matrix retain a
    // second full copy and then persist a duplicate .log.
    ULG_PROBE_STDOUT_MODE: 'none',
    // Visual acceptance consumes final/checkpoint evidence and exact CSS
    // submissions, not replay-only per-step Schroeder transaction histories.
    // Compact in the browser so Playwright never serializes the large arrays.
    ULG_PROBE_ARTIFACT_DETAIL_MODE: 'visual-compact',
    ULG_PROBE_PORT: String(port),
    ULG_PROBE_BATCHES: String(scenario.batches ?? batches),
    ULG_PROBE_BATCH_STEPS: String(scenario.batchSteps ?? batchSteps),
    ULG_PROBE_RENDER_EVERY: String(scenario.renderEvery ?? 1),
    ULG_PROBE_TIMEOUT_MS: String(timeoutMs),
    ULG_PROBE_FAIL_ON_BAD: '1'
  };
  delete env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS;
  delete env.ULG_PROBE_USE_MOUNTED_RESIDENT_SCHEDULER;
  // Child durability is controlled solely by the matrix's explicit opt-in,
  // rather than an unrelated inherited probe setting.
  delete env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION;
  if (durableReleasePublication) {
    env.ULG_PROBE_DURABLE_RELEASE_PUBLICATION = '1';
  }
  if (scenario.standardEnabled) {
    env.ULG_PROBE_USE_MOUNTED_RESIDENT_SCHEDULER = '1';
    // The visual gate covers a desktop and a mobile preset. Without
    // ULG_VISUAL_MATRIX_MOBILE the matrix only ever ran 1280x800 at scale 1,
    // so the mobile half of the gate was never actually executed.
    const mobile = envFlagEnabled(process.env.ULG_VISUAL_MATRIX_MOBILE, false);
    if (mobile) {
      env.ULG_PROBE_VIEWPORT_WIDTH =
        process.env.ULG_VISUAL_MATRIX_MOBILE_VIEWPORT_WIDTH || '390';
      env.ULG_PROBE_VIEWPORT_HEIGHT =
        process.env.ULG_VISUAL_MATRIX_MOBILE_VIEWPORT_HEIGHT || '844';
      env.ULG_PROBE_DEVICE_SCALE_FACTOR =
        process.env.ULG_VISUAL_MATRIX_MOBILE_DEVICE_SCALE_FACTOR || '3';
      env.ULG_PROBE_IS_MOBILE = '1';
      env.ULG_PROBE_HAS_TOUCH = '1';
    } else {
      env.ULG_PROBE_VIEWPORT_WIDTH = process.env.ULG_VISUAL_MATRIX_VIEWPORT_WIDTH || '1280';
      env.ULG_PROBE_VIEWPORT_HEIGHT = process.env.ULG_VISUAL_MATRIX_VIEWPORT_HEIGHT || '800';
    }
    env.ULG_PROBE_NATIVE_SURFACE_VALIDATION_WAIT_MS =
      process.env.ULG_VISUAL_MATRIX_NATIVE_SURFACE_VALIDATION_WAIT_MS || '1500';
    // The probe-level guard admits the complete phase domain. The matrix then
    // applies tighter condensed bounds without misclassifying legal sparse-gas
    // expansion at J=0.1 as a condensed collapse.
    env.ULG_PROBE_MIN_J = '0.1';
    env.ULG_PROBE_MAX_J = '1000';
    if (scenario.visualRendererMode === STANDARD_VISUAL_MATRIX_RENDERER_MODE) {
      const requestedWorkerProgressEverySteps =
        process.env.ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS;
      const workerProgressEverySteps = requestedWorkerProgressEverySteps == null
        ? STANDARD_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS
        : positiveInteger(requestedWorkerProgressEverySteps, null);
      if (workerProgressEverySteps == null) {
        throw new RangeError(
          'ULG_VISUAL_MATRIX_WORKER_PROGRESS_EVERY_STEPS must be a positive integer'
        );
      }
      env.ULG_PROBE_WORKER_PROGRESS_EVERY_STEPS =
        String(workerProgressEverySteps);
    }
  }
  if (scenario.phaseAwareAcceptance?.generatedGas) {
    const generatedGas = scenario.phaseAwareAcceptance.generatedGas;
    const targetMaterials = Array.isArray(generatedGas.selector?.materials)
      ? generatedGas.selector.materials.filter(Boolean)
      : [];
    if (targetMaterials.length !== 1) {
      throw new RangeError(
        `${scenario.label || 'visual scenario'} generated-gas acceptance requires exactly one target material`
      );
    }
    env.ULG_PROBE_GENERATED_GAS_TARGET_MATERIAL = String(targetMaterials[0]);
    env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_KG = String(
      Math.max(0, finiteOrNull(generatedGas.minimumMassKg) ?? 0)
    );
    env.ULG_PROBE_GENERATED_GAS_MINIMUM_MASS_FRACTION_OF_SYSTEM = String(
      Math.max(
        0,
        finiteOrNull(generatedGas.minimumMassFractionOfSystem) ?? 0
      )
    );
  }
  if (
    scenario.visualRendererMode === 'native-webgpu-surface-consumer'
    || scenario.visualRendererMode === STANDARD_VISUAL_MATRIX_RENDERER_MODE
  ) {
    env.ULG_PROBE_READBACK_MODE = 'no-full-readback';
    env.ULG_PROBE_RENDER_READBACK_MODE = 'no-full-readback';
    env.ULG_PROBE_RENDER_ROWS_READBACK_MODE = 'no-full-readback';
    env.ULG_PROBE_COMPACT_SUMMARY_MODE = 'final-only';
    env.ULG_PROBE_SURFACE_DRAW_DIAGNOSTIC_MODE =
      'native-webgpu-surface-consumer';
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
  const captureFrameMax = positiveInteger(
    process.env.ULG_VISUAL_MATRIX_FRAME_MAX,
    DEFAULT_FRAME_MAX
  );
  const captureBatchCount = positiveInteger(
    scenario?.batches,
    batches
  );
  const captureFrameEvery = positiveInteger(
    process.env.ULG_VISUAL_MATRIX_FRAME_EVERY,
    Math.max(
      1,
      Math.ceil(captureBatchCount / Math.max(1, captureFrameMax - 1))
    )
  );
  if (process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES === '1') {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(captureFrameEvery);
    env.ULG_PROBE_FRAME_MAX = String(captureFrameMax);
  } else if (captureFrames) {
    env.ULG_PROBE_CAPTURE_FRAMES = '1';
    env.ULG_PROBE_FRAME_DIR = frameDir;
    env.ULG_PROBE_FRAME_EVERY = String(captureFrameEvery);
    env.ULG_PROBE_FRAME_MAX = String(captureFrameMax);
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
  const matrixTimeoutExplicit =
    process.env.ULG_VISUAL_MATRIX_TIMEOUT_MS != null;
  const allowFailures = process.env.ULG_VISUAL_MATRIX_ALLOW_FAILURES === '1';
  const durableReleasePublication = durableVisualMatrixReleasePublicationEnabled();
  const captureFrames = envFlagEnabled(process.env.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, true);
  const scenarios = selectedScenarios();
  if (!scenarios.length) {
    throw new Error('No SPH visual sanity matrix scenarios selected');
  }
  if (durableReleasePublication) {
    await assertArtifactPathOutsideRepo({
      artifactPath: path.join(outputRoot, 'summary.json'),
      repoDir,
      label: 'SPH visual matrix durable output root'
    });
  } else {
    await mkdir(outputRoot, { recursive: true });
  }

  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const scenarioTimeoutMs = resolveVisualMatrixScenarioTimeoutMs({
      scenarioTimeoutMs: scenario.timeoutMs,
      matrixTimeoutMs: timeoutMs,
      matrixTimeoutExplicit
    });
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
      timeoutMs: scenarioTimeoutMs,
      durableReleasePublication
    });
    console.log(`[sph-visual-matrix] ${scenario.label}`);
    const run = await runCommand(process.execPath, ['scripts/sph-long-horizon-probe.mjs'], {
      cwd: repoDir,
      env,
      timeoutMs: scenarioTimeoutMs + 30_000
    });
    await persistVisualMatrixArtifact({
      artifactPath: logPath,
      repoDir,
      value: `${run.stdout}\n${run.stderr}`,
      label: `SPH visual matrix ${scenario.label} log`,
      durableReleasePublication
    });
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
      await persistVisualMatrixArtifact({
        artifactPath: outputPath,
        repoDir,
        value: `${JSON.stringify(probe, null, 2)}\n`,
        label: `SPH visual matrix ${scenario.label} fallback JSON`,
        durableReleasePublication
      });
    }
    const analysis = probe?.analysis || {};
    const expectedBehavior = evaluateStandardScenarioBehavior(scenario, probe);
    const mechanicsIntegrator = inferMechanicsIntegrator(probe);
    const effectiveRendererModes = effectiveVisualRendererModes(probe, {
      residentOnly: scenario?.visualRenderOwnershipMode
        === STANDARD_VISUAL_MATRIX_RENDER_OWNERSHIP_MODE
    });
    const effectiveRenderOwnershipModes =
      effectiveVisualRenderOwnershipModes(probe);
    const effectiveResidentComputeModes =
      effectiveResidentComputeManagerModes(probe);
    const issues = synthesizeStandardScenarioIssues(scenario, probe, {
      expectedBehavior,
      mechanicsIntegrator,
      rendererModes: effectiveRendererModes,
      renderOwnershipModes: effectiveRenderOwnershipModes,
      residentComputeManagerModes: effectiveResidentComputeModes
    });
    const visualSurfaceIssues = uniqueVisualSurfaceIssues(
      probe?.visualSurfaceIssues,
      probe?.analysis?.visualSurfaceIssues
    );
    const failed = run.code !== 0 || probe?.status === 'bad' || issues.length > 0;
    results.push({
      label: scenario.label,
      presetId: scenario.presetId || null,
      acceptanceTrack: scenario.acceptanceTrack || null,
      randomPair: scenario.randomPair || null,
      visualRendererMode: scenario.visualRendererMode || null,
      effectiveVisualRendererModes: effectiveRendererModes,
      visualRendererModeMatched: scenario.visualRendererMode
        ? effectiveRendererModes.length > 0
          && effectiveRendererModes.every((mode) => mode === scenario.visualRendererMode)
        : null,
      visualRenderOwnershipMode: scenario.visualRenderOwnershipMode || null,
      effectiveVisualRenderOwnershipModes: effectiveRenderOwnershipModes,
      visualRenderOwnershipModeMatched: scenario.visualRenderOwnershipMode
        ? effectiveRenderOwnershipModes.length > 0
          && effectiveRenderOwnershipModes.every(
            (mode) => mode === scenario.visualRenderOwnershipMode
          )
        : null,
      residentComputeManagerMode: scenario.residentComputeManagerMode || null,
      effectiveResidentComputeManagerModes: effectiveResidentComputeModes,
      residentComputeManagerModeMatched: scenario.residentComputeManagerMode
        ? effectiveResidentComputeModes.length > 0
          && effectiveResidentComputeModes.every(
            (mode) => mode === scenario.residentComputeManagerMode
          )
        : null,
      workerSchedulePlan: scenario.workerSchedulePlan || null,
      workerProgressEverySteps: scenario.workerProgressEverySteps ?? null,
      url: scenario.url,
      expectedMechanics: scenario.expectedMechanics || null,
      mechanicsIntegrator,
      code: run.code,
      timedOut: run.timedOut,
      status: probe?.status || null,
      analysisStatus: analysis.status || null,
      fatalTermination: probe?.timeline?.fatalTermination || null,
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
  await persistVisualMatrixArtifact({
    artifactPath: summaryPath,
    repoDir,
    value: `${JSON.stringify(summary, null, 2)}\n`,
    label: 'SPH visual matrix summary',
    durableReleasePublication
  });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failedCount > 0 && !allowFailures) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}
