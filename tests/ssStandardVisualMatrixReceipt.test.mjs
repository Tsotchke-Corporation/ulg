import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  link,
  readFile,
  rename,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import {
  STANDARD_VISUAL_CAPTURE_SCHEMA,
  STANDARD_VISUAL_EVENT_KIND,
  STANDARD_VISUAL_EVENT_NAME,
  STANDARD_VISUAL_RECEIPT_SCHEMA,
  STANDARD_VISUAL_REVIEW_ATTESTATION,
  STANDARD_VISUAL_SCENARIO_TIMEOUT_MS,
  collectStandardVisualArtifactEvidence,
  createStandardVisualCommandPolicy,
  decodeStandardVisualPng,
  evaluateStandardVisualCapture,
  evaluateStandardVisualMatrixReceipt,
  evaluateStandardVisualReview,
  readStandardVisualMatrixReceiptEvidence,
  runStandardVisualCapture,
  runStandardVisualFixtureCapture,
  runStandardVisualFinalize,
  standardVisualMatrixIccEvent,
  standardVisualScenarioManifest
} from '../scripts/ss-standard-visual-matrix-receipt.mjs';
import {
  createNonProductionFixtureCapability,
  sha256Bytes
} from '../scripts/ss-release-evidence-common.mjs';
import {
  STANDARD_SCENARIOS,
  deterministicRandomPairScenarios,
  evaluateStandardScenarioBehavior,
  synthesizeStandardScenarioIssues
} from '../scripts/sph-visual-sanity-matrix.mjs';

const productionRepoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixtureCapabilityFor(repoDir) {
  return createNonProductionFixtureCapability({ repoDir, productionRepoDir });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.byteLength);
  chunk.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.byteLength);
  return chunk;
}

function rgbaPng(width, height, rgba) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4)));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function rgbaIhdr(width = 2, height = 1) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return ihdr;
}

function pngFromChunks(chunks) {
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunks
  ]);
}

const PNG_BYTES = rgbaPng(2, 1, Buffer.from([
  20, 40, 60, 255,
  180, 120, 30, 255
]));

function scenarioUrlWithProbeDefaults(url) {
  const parsed = new URL(url, 'http://ulg.invalid');
  if (!parsed.searchParams.has('visualCapture')) parsed.searchParams.set('visualCapture', '1');
  if (!parsed.searchParams.has('residentAuto')) parsed.searchParams.set('residentAuto', '0');
  return `${parsed.pathname}${parsed.search}`;
}

const SYNTHETIC_SURFACE_STRESS_SUBMISSION = Object.freeze({
  schema:
    'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
  status:
    'eighteen-pass-central-bond-surface-stress-submitted-unverified',
  requested: true,
  submitted: true,
  dispatchCount: 18,
  lifecycleDispatchCount: 21,
  lifecycleMode:
    'standalone-s9ab-initialize-ambient-eighteen-central-bonds-validate-commit',
  ambientBuoyancyMode:
    'field-local-s9ab-current-volume-ambient-source',
  selectedLevel: 0,
  levelRole: 'single',
  twoLevel: false,
  positiveSurfaceTensionPhaseRecordCount: 1,
  surfaceTensionCoefficientStatus:
    'positive-surface-tension-coefficient-ready',
  verification: 'queue-submitted-no-full-readback'
});

function syntheticMaterialPhase({
  material,
  phase,
  massKg,
  yCenterM = 0.5,
  temperatureK = 300,
  meanVyMPerS = 0.1,
  liveParticleCount = 10
}) {
  const materialIdByKey = {
    h2o: 3061144,
    fe: 26,
    na: 11,
    naoh: 665383,
    h2: 3022823,
    f: 9,
    cs: 55,
    csf: 550009,
    synthetic: 900001
  };
  const phaseIdByKey = { solid: 1, liquid: 2, gas: 3, plasma: 4 };
  return {
    material,
    materialId:
      materialIdByKey[String(material).toLowerCase()] ?? 990001,
    phase,
    phaseId: phaseIdByKey[String(phase).toLowerCase()] ?? 0,
    massKg,
    liveParticleCount,
    phaseWeightedParticleCount: liveParticleCount,
    speedSampleCount: liveParticleCount,
    mechanicsSampleCount: liveParticleCount,
    mechanicsProblemParticleCount: 0,
    minVolumeRatioJ: 1,
    maxVolumeRatioJ: 1,
    yCenterMassWeightedM: yCenterM,
    yMinM: yCenterM - 0.1,
    yMaxM: yCenterM + 0.1,
    meanVyMPerS,
    minVyMPerS: meanVyMPerS,
    maxVyMPerS: meanVyMPerS,
    maxSpeedMPerS: Math.abs(meanVyMPerS),
    vySampleMassKg: massKg,
    kineticEnergyJ: 0,
    temperatureMinK: temperatureK,
    temperatureMaxK: temperatureK,
    temperatureMassWeightedMeanK: temperatureK
  };
}

function syntheticCheckpoint(index, materialPhases, extra = {}) {
  const retainedMaterialPhases = materialPhases.map((entry) => ({
    ...entry,
    // This fixture represents advancing retained mechanics independently of
    // mass/temperature changes, which are deliberately excluded from the
    // mechanics-freshness signature.
    yMinM: entry.yMinM + index * 1e-4,
    yMaxM: entry.yMaxM + index * 1e-4
  }));
  const liveParticleCount = retainedMaterialPhases.reduce(
    (sum, entry) => sum + entry.liveParticleCount,
    0
  );
  return {
    status: 'captured',
    schema:
      'peercompute.ulg.sph-authoritative-gpu-material-phase-reduction.v1',
    aggregationStatus: 'gpu-reduced',
    backend: 'webgpu-compute',
    phase: index === 0 ? 'initial' : 'batch',
    source: index === 0
      ? 'retained-resident-particle-buffers'
      : 'worker-retained-terminal-compact-snapshot',
    authority: index === 0
      ? 'gpu-resident-retained-state'
      : 'worker-terminal-fence-and-state-manager-commit',
    sourceStep: index * 128,
    sourceTimeS: index,
    totals: { massKg: 1 },
    uploadPairCoherenceStatus: 'ready',
    uploadPairMetadataCoherent: true,
    uploadPairSharedSlotIdentityVerified: true,
    materialMappingStatus: 'complete',
    speedEvidenceStatus: 'complete',
    mechanicsEvidenceStatus: 'complete',
    liveParticleCount,
    speedSampleCount: liveParticleCount,
    mechanicsSampleCount: liveParticleCount,
    invalidMassParticleCount: 0,
    invalidMechanicsParticleCount: 0,
    overflowContributionCount: 0,
    materialPhases: retainedMaterialPhases,
    ...extra
  };
}

function syntheticFrozenGasCohort({
  massKg,
  yCenterM,
  activeGasCarrierCount,
  meanVyMPerS = 0.1
}) {
  return {
    status: 'captured',
    sameCarrierLineageProven: true,
    material: 'h2o',
    phase: 'gas',
    materialId: 3061144,
    massKg,
    yCenterMassWeightedM: yCenterM,
    yMinM: yCenterM - 0.1,
    yMaxM: yCenterM + 0.2,
    meanVyMPerS,
    vySampleMassKg: massKg,
    activeGasCarrierCount,
    inactiveFrozenLineageCount: 12 - activeGasCarrierCount,
    frozenLineageCount: 12,
    invalidActiveCarrierCount: 0,
    phasePurityProblemCount: 0,
    frozenLineageMaskHash: 'synthetic-water-gas-lineage',
    topologySignature: 'synthetic-water-topology',
    formedAtCheckpointIndex: 1
  };
}

function syntheticPassingCheckpoints(label) {
  if (label === 'standard-water-cycle') {
    const gas = [
      null,
      syntheticFrozenGasCohort({
        massKg: 0.1,
        yCenterM: 4.4,
        activeGasCarrierCount: 12
      }),
      syntheticFrozenGasCohort({
        massKg: 0.1,
        yCenterM: 4.5,
        activeGasCarrierCount: 12
      }),
      syntheticFrozenGasCohort({
        massKg: 0.12,
        yCenterM: 4.6,
        activeGasCarrierCount: 12
      }),
      syntheticFrozenGasCohort({
        massKg: 0.05,
        yCenterM: 4.4,
        activeGasCarrierCount: 5,
        meanVyMPerS: -0.1
      }),
      syntheticFrozenGasCohort({
        massKg: 0.05,
        yCenterM: 4.2,
        activeGasCarrierCount: 5,
        meanVyMPerS: -0.1
      })
    ];
    return gas.map((cohort, index) => {
      const gasMassKg = cohort?.massKg ?? 0;
      return syntheticCheckpoint(index, [
        syntheticMaterialPhase({
          material: 'h2o',
          phase: 'liquid',
          massKg: 1 - gasMassKg,
          yCenterM: 0.5 + index * 0.02
        }),
        ...(cohort
          ? [syntheticMaterialPhase({
              material: 'h2o',
              phase: 'gas',
              massKg: gasMassKg,
              yCenterM: cohort.yCenterMassWeightedM,
              meanVyMPerS: cohort.meanVyMPerS
            })]
          : [])
      ], {
        generatedGasCohortCapture: {
          status: 'captured',
          sameCarrierLineageProven: true,
          topologyEpoch: 1,
          identityRevision: 1
        },
        generatedGasCohorts: cohort ? [cohort] : []
      });
    });
  }
  if (label === 'standard-iron-ice-quench') {
    return [
      [
        syntheticMaterialPhase({
          material: 'h2o', phase: 'solid', massKg: 0.6,
          yCenterM: 0.5, temperatureK: 270
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'liquid', massKg: 0.4,
          yCenterM: 1, temperatureK: 1850
        })
      ],
      [
        syntheticMaterialPhase({
          material: 'h2o', phase: 'solid', massKg: 0.5,
          yCenterM: 0.5, temperatureK: 275
        }),
        syntheticMaterialPhase({
          material: 'h2o', phase: 'liquid', massKg: 0.05,
          yCenterM: 0.5, temperatureK: 300
        }),
        syntheticMaterialPhase({
          material: 'h2o', phase: 'gas', massKg: 0.05,
          yCenterM: 1, temperatureK: 400
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'liquid', massKg: 0.35,
          yCenterM: 0.975, temperatureK: 1840
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'solid', massKg: 0.05,
          yCenterM: 0.975, temperatureK: 1840
        })
      ],
      [
        syntheticMaterialPhase({
          material: 'h2o', phase: 'solid', massKg: 0.45,
          yCenterM: 0.5, temperatureK: 275
        }),
        syntheticMaterialPhase({
          material: 'h2o', phase: 'liquid', massKg: 0.1,
          yCenterM: 0.5, temperatureK: 300
        }),
        syntheticMaterialPhase({
          material: 'h2o', phase: 'gas', massKg: 0.05,
          yCenterM: 1.1, temperatureK: 400
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'liquid', massKg: 0.2,
          yCenterM: 0.975, temperatureK: 1820
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'solid', massKg: 0.2,
          yCenterM: 0.975, temperatureK: 1820
        })
      ],
      [
        syntheticMaterialPhase({
          material: 'h2o', phase: 'solid', massKg: 0.45,
          yCenterM: 0.5, temperatureK: 275
        }),
        syntheticMaterialPhase({
          material: 'h2o', phase: 'liquid', massKg: 0.1,
          yCenterM: 0.5, temperatureK: 300
        }),
        syntheticMaterialPhase({
          material: 'h2o', phase: 'gas', massKg: 0.05,
          yCenterM: 1.2, temperatureK: 400
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'liquid', massKg: 0.1,
          yCenterM: 0.975, temperatureK: 1800
        }),
        syntheticMaterialPhase({
          material: 'fe', phase: 'solid', massKg: 0.3,
          yCenterM: 0.975, temperatureK: 1800
        })
      ]
    ].map((rows, index) => syntheticCheckpoint(index, rows));
  }
  if (label === 'standard-sodium-water') {
    const states = [
      { na: 0.2, naoh: 0, h2: 0, y: 0, temperatureK: 300 },
      { na: 0.15, naoh: 0.03, h2: 0.02, y: 1, temperatureK: 360 },
      { na: 0.12, naoh: 0.04, h2: 0.04, y: 1.1, temperatureK: 380 },
      { na: 0.1, naoh: 0.05, h2: 0.05, y: 1.2, temperatureK: 400 }
    ];
    return states.map((state, index) => syntheticCheckpoint(index, [
      syntheticMaterialPhase({
        material: 'h2o', phase: 'liquid', massKg: 0.8,
        yCenterM: 0.5, temperatureK: state.temperatureK
      }),
      syntheticMaterialPhase({
        material: 'Na', phase: 'solid', massKg: state.na,
        yCenterM: 0.7, temperatureK: state.temperatureK
      }),
      ...(state.naoh > 0
        ? [syntheticMaterialPhase({
            material: 'naoh', phase: 'liquid', massKg: state.naoh,
            yCenterM: 0.6, temperatureK: state.temperatureK
          })]
        : []),
      ...(state.h2 > 0
        ? [syntheticMaterialPhase({
            material: 'h2', phase: 'gas', massKg: state.h2,
            yCenterM: state.y, temperatureK: state.temperatureK
          })]
        : [])
    ]));
  }
  if (label === 'standard-cesium-fluorine') {
    return [
      [
        syntheticMaterialPhase({
          material: 'F', phase: 'gas', massKg: 0.5,
          temperatureK: 293.15
        }),
        syntheticMaterialPhase({
          material: 'Cs', phase: 'solid', massKg: 0.5,
          temperatureK: 293.15
        })
      ],
      [
        syntheticMaterialPhase({
          material: 'F', phase: 'gas', massKg: 0.3,
          temperatureK: 900
        }),
        syntheticMaterialPhase({
          material: 'Cs', phase: 'liquid', massKg: 0.1,
          temperatureK: 900
        }),
        syntheticMaterialPhase({
          material: 'csf', phase: 'solid', massKg: 0.6,
          temperatureK: 900
        })
      ],
      [
        syntheticMaterialPhase({
          material: 'F', phase: 'gas', massKg: 0.2,
          temperatureK: 700
        }),
        syntheticMaterialPhase({
          material: 'Cs', phase: 'liquid', massKg: 0.1,
          temperatureK: 700
        }),
        syntheticMaterialPhase({
          material: 'csf', phase: 'solid', massKg: 0.7,
          temperatureK: 700
        })
      ]
    ].map((rows, index) => syntheticCheckpoint(index, rows));
  }
  return [0, 1, 2].map((index) => syntheticCheckpoint(index, [
    syntheticMaterialPhase({
      material: 'synthetic',
      phase: 'solid',
      massKg: 1,
      yCenterM: 0.5 - index * 0.01
    })
  ]));
}

function syntheticPassingTimeline(scenario) {
  const checkpoints = syntheticPassingCheckpoints(scenario.label);
  const scheduleCount = scenario.workerSchedulePlan?.scheduleCount
    ?? scenario.batches
    ?? Math.max(1, checkpoints.length - 1);
  const metrics = checkpoints.map((authoritativeGpuCheckpoint, index) => {
    const residentBatch = index > 0 && index <= scheduleCount;
    const requestedStepCount =
      scenario.workerSchedulePlan?.scheduleStepCount
      ?? scenario.batchSteps
      ?? 128;
    const scheduleId = `schedule:${scenario.label}:${index}`;
    const laneId = `lane:${scenario.label}`;
    const stateKey = `state:${scenario.label}`;
    const physicsTick = index * requestedStepCount - 1;
    const storageGeneration = index * 3;
    const frameCount = index + 1;
    const presentationLaneEpoch = index;
    const residentRoute = residentBatch
      ? {
          workerOffscreenRenderRows: {
            status:
              'worker-offscreen-resident-particle-state-producer-rendered',
            displayHandoff: 'transferControlToOffscreen',
            frameCopyBackRejected: true,
            workerReady: true,
            contextStatus: 'webgpu-context-ready',
            particleCount: authoritativeGpuCheckpoint.liveParticleCount,
            frameCount,
            readyEver: true,
            sphStep: physicsTick,
            lastPresentedSphStep: physicsTick,
            readyFrameCount: frameCount
          },
          workerOffscreenPresentation: {
            canvasTransferred: true,
            workerReady: true,
            contextStatus: 'webgpu-context-ready',
            displayOwner: 'worker',
            displayOwnerContentReady: true,
            displayOwnerContentFrameSerial: frameCount,
            displayOwnerPresentedSphStep: physicsTick,
            displayCanvasVisible: true,
            frameCount,
            readyFrameCount: frameCount,
            displayOwnerLastRenderedContent: {
              schema:
                'peercompute.ulg.worker-offscreen-resident-particle-state-producer.v0',
              renderRowsSchema:
                'peercompute.ulg.worker-offscreen-render-rows.v0',
              status:
                'worker-offscreen-resident-particle-state-producer-rendered',
              sphStep: physicsTick,
              particleCount: authoritativeGpuCheckpoint.liveParticleCount,
              frameCount,
              readyFrameCount: frameCount,
              residentScheduleCandidatePresentation: true,
              stateManagerCommittedPresentation: true,
              committedPresentationSchema:
                'peercompute.ulg.presentation-worker-committed-resident-schedule-presentation.v0',
              committedPresentationStatus:
                'state-manager-committed-resident-schedule-presentation-admission',
              scheduleId,
              laneId,
              stateKey,
              presentationLaneEpoch,
              residentExecutionGeneration: storageGeneration,
              stepOrdinal: requestedStepCount,
              authorityStatus: 'state-manager-committed-worker-schedule',
              computeManagerCompletionSchema:
                'peercompute.ulg.schroeder-worker-lane-compute-manager-completion.v0',
              computeManagerLeaseId: `lease:${scenario.label}:${index}`,
              computeManagerLeaseStatus: 'completed',
              computeManagerFenceSatisfied: true,
              stateManagerCommitStatus: 'committed',
              stateManagerCommitAccepted: true,
              terminalScheduleFence: true,
              terminalFenceScope: 'resident-schedule-terminal',
              terminalFenceSatisfied: true,
              terminalFenceAuthorityAdmissionReady: true,
              producerSourceKind: 'worker-retained-resident-stage-output',
              producerSourceTransport: 'worker-retained-resident-stage-output',
              sourceStageId: 'schroederSameLevelMechanics',
              retainedParticleStateStatus:
                'worker-retained-particle-state-ready'
            }
          },
          residentSteps: {
            residentComputeManagerMode: scenario.residentComputeManagerMode,
            workerLaneFallback: null,
            workerOwnedResidentLane: {
              laneId,
              stateKey,
              scheduleId,
              residentScheduleStatus: 'worker-resident-schedule-completed',
              terminalStatus:
                'worker-offscreen-resident-schedule-on-presentation-device-completed',
              requestedStepCount,
              completedStepCount: requestedStepCount,
              laneCompletedStepTotal: index * requestedStepCount,
              progressEverySteps: scenario.workerProgressEverySteps,
              cancelled: false,
              retainedBufferRefCount: 3,
              finalEpochIdentity: {
                storageGeneration,
                physicsTick,
                positionEpoch: index * requestedStepCount
              },
              gpuFence: {
                scope: 'resident-schedule-terminal',
                terminalScheduleFence: true,
                fenceSatisfied: true,
                queueCompletionStatus: 'queue-work-completed',
                authorityAdmissionReady: true
              },
              authority: {
                status: 'state-manager-committed-worker-schedule',
                computeManagerLeaseStatus: 'completed',
                computeManagerFenceSatisfied: true,
                stateManagerCommitStatus: 'committed'
              },
              ...(scenario.label === 'standard-cesium-fluorine'
                ? {
                    twoLevelMechanics: {
                      schema:
                        'peercompute.ulg.worker-resident-schedule-two-level-mechanics-evidence.v0',
                      requested: true,
                      authorityRequested: 'authoritative',
                      observedStepCount: requestedStepCount,
                      exactAuthoritativeStepCount: requestedStepCount,
                      cflFactorEvidenceRequired: true,
                      cflFactorRequested: 0.8,
                      cflFactorObservedStepCount: requestedStepCount,
                      exactCflFactorCount: requestedStepCount,
                      firstCflFactorMismatchStepOrdinal: null,
                      lastCflFactor: 0.8,
                      terminalRefluxReceiptRequired: true,
                      terminalRefluxReceipt: {
                        schema:
                          'peercompute.ulg.worker-resident-schedule-terminal-reflux-receipt.v0',
                        required: true,
                        scheduleId,
                        laneId,
                        stateKey,
                        expectedStepCount: requestedStepCount,
                        observedStepCount: requestedStepCount,
                        admittedStepCount: requestedStepCount,
                        firstRejectedStepOrdinal: null,
                        allStepsAdmitted: true,
                        status:
                          'terminal-reflux-schedule-receipt-admitted',
                        reason: null,
                        firstRejectedDiagnostic: null
                      },
                      terminalRefluxAdmittedStepCount: requestedStepCount,
                      firstIncompleteStepOrdinal: null,
                      coverageComplete: true,
                      fineSubstepCountRequested: 2,
                      lastStep: {
                        status:
                          'schroeder-two-level-authoritative-step-executed',
                        twoLevelMechanicsEnabled: true,
                        mechanicsLevelCount: 2,
                        twoLevelMechanicsAuthority: 'authoritative',
                        twoLevelFineSubstepCount: 2,
                        twoLevelAuthoritativeCommitVerified: true
                      }
                    }
                  }
                : {}),
              committedPresentation: {
                status:
                  'worker-offscreen-resident-particle-state-producer-rendered',
                scheduleId,
                laneId,
                stateKey,
                presentationLaneEpoch,
                sphStep: physicsTick,
                stateManagerCommittedPresentation: true
              }
            }
          }
        }
      : {};
    return {
      phase: residentBatch ? 'resident-batch' : authoritativeGpuCheckpoint.phase,
      authoritativeGpuCheckpoint,
      surfaceDraw: {
        visibleRendererBridge: scenario.visualRendererMode
      },
      peerComputeRenderOwnershipPolicy: {
        effectiveMode: scenario.visualRenderOwnershipMode
      },
      residentStep: {
        status: 'submitted-unverified',
        ...(scenario.label === 'standard-iron-ice-quench'
          ? {
              phaseVolumeSurfaceStressSubmission:
                SYNTHETIC_SURFACE_STRESS_SUBMISSION
            }
          : {})
      },
      schroederTelemetry: {
        residentComputeManagerMode: scenario.residentComputeManagerMode,
        ...(scenario.label === 'standard-cesium-fluorine'
          ? { twoLevelMechanicsCoverageComplete: true }
          : {})
      },
      ...residentRoute
    };
  });
  const requestedStepCount = scenario.workerSchedulePlan?.scheduleStepCount
    ?? scenario.batchSteps
    ?? 128;
  while (
    metrics.filter((metric) => metric.phase === 'resident-batch').length
      < scheduleCount
  ) {
    const metric = structuredClone(metrics.at(-1));
    delete metric.authoritativeGpuCheckpoint;
    metrics.push(metric);
  }
  const residentMetrics = metrics.filter(
    (metric) => metric.phase === 'resident-batch'
  );
  for (const [index, metric] of residentMetrics.entries()) {
    const scheduleOrdinal = index + 1;
    const scheduleId = `schedule:${scenario.label}:${scheduleOrdinal}`;
    const laneId = `lane:${scenario.label}`;
    const stateKey = `state:${scenario.label}`;
    const physicsTick = scheduleOrdinal * requestedStepCount - 1;
    const storageGeneration = scheduleOrdinal * 3;
    const presentation = metric.workerOffscreenPresentation;
    const rendered = presentation.displayOwnerLastRenderedContent;
    const lane = metric.residentSteps.workerOwnedResidentLane;
    metric.residentSteps.completedStepCount = requestedStepCount;
    metric.workerOffscreenRenderRows.sphStep = physicsTick;
    metric.workerOffscreenRenderRows.lastPresentedSphStep = physicsTick;
    presentation.displayOwnerPresentedSphStep = physicsTick;
    rendered.sphStep = physicsTick;
    rendered.scheduleId = scheduleId;
    rendered.laneId = laneId;
    rendered.stateKey = stateKey;
    rendered.presentationLaneEpoch = scheduleOrdinal;
    rendered.residentExecutionGeneration = storageGeneration;
    rendered.computeManagerLeaseId =
      `lease:${scenario.label}:${scheduleOrdinal}`;
    lane.scheduleId = scheduleId;
    lane.laneId = laneId;
    lane.stateKey = stateKey;
    lane.requestedStepCount = requestedStepCount;
    lane.completedStepCount = requestedStepCount;
    lane.laneCompletedStepTotal = scheduleOrdinal * requestedStepCount;
    lane.finalEpochIdentity = {
      storageGeneration,
      physicsTick,
      positionEpoch: scheduleOrdinal * requestedStepCount
    };
    lane.authority.status = 'state-manager-committed-worker-schedule';
    lane.committedPresentation.scheduleId = scheduleId;
    lane.committedPresentation.laneId = laneId;
    lane.committedPresentation.stateKey = stateKey;
    lane.committedPresentation.presentationLaneEpoch = scheduleOrdinal;
    lane.committedPresentation.sphStep = physicsTick;
    lane.laneSimTimeS = scheduleOrdinal * requestedStepCount * 0.0005;

    const nativeSourceStep = physicsTick + 1;
    const nativeRequestId = `${scheduleId}:native-surface:1:${scheduleOrdinal}`;
    metric.workerLaneNativeSurfacePresentation = {
      schema:
        'peercompute.ulg.worker-lane-native-surface-presentation-source.v0',
      status: 'worker-lane-native-surface-presentation-source-ready',
      scheduleId,
      laneId,
      stateKey,
      requestId: nativeRequestId,
      cacheKey: nativeRequestId,
      sourceStageId: 'schroederSameLevelMechanics',
      sourceStep: nativeSourceStep,
      sourceTimeS: lane.laneSimTimeS,
      particleCount:
        metric.authoritativeGpuCheckpoint?.liveParticleCount ?? 1,
      readbackScope: 'resident-schedule-terminal-presentation',
      terminalPresentationFullParticleReadbackPerformed: true,
      physicsHotLoopParticipation: false
    };
    metric.workerLaneNativeSurfaceSnapshotHandoff = {
      ...metric.workerLaneNativeSurfacePresentation,
      status: 'worker-lane-native-surface-presentation-source-admitted',
      sharedSlotIdentityVerified: true,
      workerLineageMetadataStatus:
        'worker-retained-compact-snapshot-lineage-metadata-ready',
      terminalCompactSnapshotReadback: true
    };
    metric.workerOffscreenPresentation.displayOwner = 'main-native';
    metric.workerOffscreenPresentation.displayCanvasVisible = false;
    metric.workerOffscreenCanvas = {
      count: 1,
      visibleCount: 0,
      visibility: 'hidden',
      display: 'block',
      opacity: '0',
      width: 1280,
      height: 800,
      visible: false
    };
    metric.sceneCanvasVisibility = {
      count: 2,
      visibleCount: 1,
      workerCount: 1,
      visibleWorkerCount: 0
    };
    metric.renderState = {
      status: 'resident-render-field-applied',
      sourceResidentRenderSourceStatus: 'resident-render-source-current',
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentNextStep: nativeSourceStep,
      sourceResidentNextTimeS: lane.laneSimTimeS,
      surfaceDrawVisibleRendererBridge: scenario.visualRendererMode,
      surfaceDrawOverlayPolicyStatus:
        'surface-draw-native-webgpu-main-canvas',
      workerOffscreenPresentationStatus:
        'worker-offscreen-display-hidden-main-native-owner',
      workerOffscreenRetainedCompactSnapshotStatus:
        'presentation-worker-retained-compact-snapshot-exported',
      workerOffscreenRetainedCompactSnapshotAvailable: true,
      workerOffscreenRetainedCompactSnapshotStep: nativeSourceStep
    };
    metric.surfaceDraw = {
      ...metric.surfaceDraw,
      status: 'native-webgpu-surface-consumer-ready',
      gpuBufferHandoffReady: true,
      visibleGpuConsumerReady: true,
      visibleGpuConsumerRuntimePresentationAdmitted: true,
      sourceResidentRenderSourceStatus: 'resident-render-source-current',
      sourceResidentExecutionGenerationMatchesCurrent: true,
      sourceResidentNextStep: nativeSourceStep,
      sourceResidentNextTimeS: lane.laneSimTimeS
    };
    metric.nativeSurfaceValidation = {
      native: true,
      ready: true,
      admitted: true,
      runtimePresentationAdmitted: true,
      sourceGenerationMatchesCurrent: true,
      sourceRetainedPrevious: false,
      sourceMarkedStale: false,
      sourceCurrent: true,
      status: 'native-surface-presentation-admitted',
      bridgeMode: scenario.visualRendererMode,
      gpuBufferHandoffReady: true
    };

    const twoLevel = scenario.label === 'standard-cesium-fluorine';
    const reaction = scenario.label === 'standard-sodium-water' || twoLevel;
    lane.hierarchyStageSummary = {
      schema: 'peercompute.ulg.worker-schroeder-hierarchy-stage-summary.v0',
      status: 'worker-schroeder-hierarchy-stage-summary-ready',
      mechanicsLevelCount: twoLevel ? 2 : 1,
      twoLevelMechanicsEnabled: twoLevel,
      twoLevelMechanicsAuthority: twoLevel ? 'authoritative' : 'observation',
      twoLevelFineSubstepCount: twoLevel ? 2 : null,
      twoLevelCflFactor: twoLevel ? 0.8 : null,
      twoLevelAuthoritativeCommitVerified: twoLevel,
      mechanicsFieldPairV2Enabled: twoLevel,
      lawQueueStatus: twoLevel
        ? 'disabled-local-law-queue'
        : 'schroeder-law-queue-submitted',
      lawNeighborCandidateStatus: twoLevel
        ? 'disabled-local-law-queue'
        : 'schroeder-law-neighbor-candidates-submitted',
      residentStageStatus: {
        thermal: 'thermal-step-executed',
        reaction: reaction ? 'reaction-step-executed' : 'missing'
      },
      residentStageBackends: {
        thermal: 'webgpu',
        reaction: reaction ? 'webgpu' : null
      },
      staticGpuTableUploadStatus: {
        thermalResponseGraph: 'webgpu-uploaded',
        mechanicsMaterialPhase: 'webgpu-uploaded',
        retainedAcrossSteps: true
      },
      postMechanicsClosure: twoLevel ? {
        schema: 'peercompute.ulg.mls-mpm-post-mechanics-closure.v1',
        status: 'post-mechanics-closure-complete',
        backend: 'webgpu',
        executedStageOrder: [
          'thermal-phase',
          'reaction-discovery',
          'reaction-product',
          'phase-carrier-transfer-v2',
          'mechanics-constitutive-refresh'
        ],
        fullParticleReadbackFree: true,
        residentContinuationReady: true
      } : null,
      thermalRequested: true,
      reactionRequested: reaction,
      fullParticleReadbackFree: true
    };

    if (scenario.label === 'standard-iron-ice-quench') {
      metric.residentSteps.finalStepPhaseVolumeSurfaceStressSubmission =
        SYNTHETIC_SURFACE_STRESS_SUBMISSION;
      metric.residentSteps.phaseVolumeSurfaceStressWorkerEvidence = {
        schema:
          'peercompute.ulg.worker-resident-schedule-surface-stress-evidence.v0',
        required: true,
        observedStepCount: requestedStepCount,
        expectedSubmissionCount: requestedStepCount,
        exactSubmissionCount: requestedStepCount,
        submissionEvidenceComplete: true,
        firstIncompleteStepOrdinal: null,
        finalSubmissionStepOrdinal: requestedStepCount,
        finalSubmission: SYNTHETIC_SURFACE_STRESS_SUBMISSION
      };
    }
  }
  return {
    mechanicsIntegrator: scenario.expectedMechanics,
    metrics
  };
}

function fingerprint(overrides = {}) {
  return {
    gitHead: 'a'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'c'.repeat(64),
    trackedAndUntrackedFileCount: 31,
    ...overrides
  };
}

async function artifactMetadata(artifactPath) {
  const bytes = await readFile(artifactPath);
  return {
    path: artifactPath,
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  };
}

async function writeJson(outputPath, value) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createVisualFixture({
  fingerprintProvider = async () => fingerprint(),
  stabilityHook = null
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-standard-visual-'));
  const repoDir = path.join(root, 'repo');
  const artifactDir = path.join(root, 'artifacts');
  const capturePath = path.join(root, 'receipts', 'capture.json');
  const reviewPath = path.join(root, 'receipts', 'review.json');
  const receiptPath = path.join(root, 'receipts', 'receipt.json');
  await mkdir(repoDir);
  const fixtureCapability = await fixtureCapabilityFor(repoDir);
  const policy = createStandardVisualCommandPolicy({ artifactDir });

  const processRunner = async ({ stdoutPath, stderrPath }) => {
    await mkdir(path.dirname(stdoutPath), { recursive: true });
    await writeFile(stdoutPath, 'standard visual matrix synthetic stdout\n');
    await writeFile(stderrPath, '');
    const results = [];
    const ownedByLabel = new Map([
      ...STANDARD_SCENARIOS,
      ...deterministicRandomPairScenarios()
    ].map((scenario) => [scenario.label, scenario]));
    for (const scenario of policy.scenarios) {
      const ownedScenario = ownedByLabel.get(scenario.label);
      assert.ok(ownedScenario, scenario.label);
      const probePath = path.join(policy.outputRoot, `${scenario.label}.json`);
      const logPath = path.join(policy.outputRoot, `${scenario.label}.log`);
      const frameDir = path.join(
        policy.outputRoot,
        `${scenario.label}-frames`
      );
      const framePath = path.join(frameDir, 'frame-000.png');
      await mkdir(frameDir, { recursive: true });
      await writeFile(framePath, PNG_BYTES);
      await writeFile(logPath, `${scenario.label} passed\n`);
      const frameRow = {
        status: 'captured',
        index: 0,
        path: framePath,
        byteLength: PNG_BYTES.byteLength,
        png: {
          status: 'ready',
          hasVisiblePixels: true,
          hasSurfaceLikeVariation: true
        },
        blankFrame: false
      };
      await writeJson(probePath, {
        schema: 'peercompute.ulg.sph-history-probe-result.v0',
        status: 'good',
        analysis: {
          status: 'good',
          issues: [],
          visualSurfaceIssues: [],
          browserConsoleIssueCounts: {},
          browserConsoleWarningCounts: {},
          browserConsoleIssueCount: 0,
          browserConsoleWarningCount: 0,
          nativeBrowserFrameValidationStatus: 'passed'
        },
        timeline: syntheticPassingTimeline(ownedScenario),
        repoDir,
        probeMode: 'scene',
        baseUrl: 'http://127.0.0.1:5310',
        scenarioUrl: scenarioUrlWithProbeDefaults(scenario.url),
        browserLaunch: {
          schema: 'peercompute.ulg.sph-probe-browser-launch.v0',
          headless: false,
          channel: null,
          executablePath: '/usr/bin/google-chrome',
          args: [
            '--enable-unsafe-webgpu',
            '--use-angle=vulkan',
            '--enable-features=Vulkan,UseSkiaRenderer',
            '--ignore-gpu-blocklist',
            '--ozone-platform=x11',
            '--window-position=-10000,-10000',
            '--window-size=1280,800'
          ]
        },
        visualFrameArtifacts: {
          schema: 'peercompute.ulg.sph-probe-visual-frame-artifacts.v0',
          status: 'ready',
          frameCount: 1,
          analyzedFrameCount: 1,
          writtenFrameCount: 1,
          frames: [frameRow]
        }
      });
      results.push({
        label: scenario.label,
        presetId: scenario.presetId,
        acceptanceTrack: scenario.acceptanceTrack,
        workerSchedulePlan: ownedScenario.workerSchedulePlan,
        randomPair: scenario.randomPair,
        url: scenario.url,
        visualRendererMode: scenario.visualRendererMode,
        expectedMechanics: scenario.expectedMechanics,
        code: 0,
        timedOut: false,
        status: 'good',
        analysisStatus: 'good',
        failed: false,
        issueCount: 0,
        issues: [],
        visualSurfaceIssueCount: 0,
        visualSurfaceIssues: [],
        visualSurfaceIssueTypes: [],
        browserConsoleIssueCount: 0,
        browserConsoleWarningCount: 0,
        browserConsoleIssueCounts: {},
        browserConsoleWarningCounts: {},
        visualRendererModeMatched: true,
        expectedBehavior: { status: 'pass' },
        frameArtifactStatus: 'ready',
        frameCount: 1,
        outputPath: probePath,
        logPath,
        frameDir
      });
    }
    await writeJson(path.join(policy.outputRoot, 'summary.json'), {
      schema: 'peercompute.ulg.sph-visual-sanity-matrix.v0',
      standardMode: true,
      captureFrames: true,
      scenarioCount: policy.scenarios.length,
      failedCount: 0,
      randomSeed: '0x7a11d2026',
      outputRoot: policy.outputRoot,
      browserConsoleIssueCounts: {},
      browserConsoleWarningCounts: {},
      visualSurfaceIssueCounts: {},
      issueCounts: {},
      results
    });
    return {
      exitCode: 0,
      signal: null,
      spawnError: null,
      stdoutArtifact: await artifactMetadata(stdoutPath),
      stderrArtifact: await artifactMetadata(stderrPath)
    };
  };

  const captureRun = await runStandardVisualFixtureCapture({
    capturePath,
    artifactDir,
    reviewTemplatePath: reviewPath,
    repoDir,
    fixtureCapability,
    fixtureProcessRunner: processRunner,
    fingerprintProvider,
    stabilityHook
  });
  return {
    root,
    repoDir,
    artifactDir,
    capturePath,
    reviewPath,
    receiptPath,
    fixtureCapability,
    policy,
    captureRun
  };
}

function approveReview(template) {
  return {
    ...template,
    status: 'approved',
    reviewer: {
      kind: 'human',
      identifier: 'release-reviewer@example.invalid',
      automated: false
    },
    reviewedAt: '2026-07-31T12:00:00.000Z',
    frames: template.frames.map((frame) => ({
      ...frame,
      decision: 'pass'
    })),
    attestation: STANDARD_VISUAL_REVIEW_ATTESTATION
  };
}

test('standard visual policy pins the exact seven-scenario matrix', () => {
  const scenarios = standardVisualScenarioManifest();
  assert.deepEqual(
    scenarios.map((scenario) => scenario.label),
    [
      'standard-water-cycle',
      'standard-iron-ice-quench',
      'standard-sodium-water',
      'standard-cesium-fluorine',
      'random-elements-ba-pb',
      'random-elements-bk-lr',
      'random-elements-fr-fe'
    ]
  );
  assert.deepEqual(
    scenarios.slice(4).map((scenario) => scenario.randomPair),
    [
      { drop: 'Ba', base: 'Pb', seed: 32767811622 },
      { drop: 'Bk', base: 'Lr', seed: 32767811622 },
      { drop: 'Fr', base: 'fe', seed: 32767811622 }
    ]
  );
  const cesium = scenarios.find(
    (scenario) => scenario.label === 'standard-cesium-fluorine'
  );
  assert.ok(
    scenarios.every(
      (scenario) => scenario.acceptanceTrack === 'framework-liveness'
    )
  );
  assert.equal(cesium.acceptanceTrack, 'framework-liveness');
  assert.equal(cesium.totalStepCount, 256);
  for (const scenario of scenarios.slice(0, 4)) {
    assert.equal(scenario.acceptanceTrack, 'framework-liveness');
    assert.equal(scenario.totalStepCount, 256, scenario.label);
  }
  for (const scenario of scenarios.slice(4)) {
    assert.equal(scenario.acceptanceTrack, 'framework-liveness');
    assert.equal(scenario.totalStepCount, 192);
  }
  assert.equal(
    scenarios.some(
      (scenario) => scenario.label.startsWith('scientific-calibration-')
    ),
    false
  );
  const policy = createStandardVisualCommandPolicy({
    artifactDir: '/tmp/ulg-visual-policy-test'
  });
  assert.equal(policy.randomSeed, '0x7a11d2026');
  assert.equal(policy.randomPairCount, 3);
  assert.deepEqual(policy.unsetEnvironmentKeys, ['NODE_OPTIONS']);
  assert.equal(policy.command.environment.ULG_VISUAL_MATRIX_STANDARD, '1');
  assert.equal(policy.command.environment.ULG_VISUAL_MATRIX_CAPTURE_FRAMES, '1');
  assert.equal(policy.browserOwnership.headless, false);
  assert.equal(
    policy.browserOwnership.mode,
    'owned-isolated-offscreen-x11-chrome'
  );
  assert.equal(policy.command.environment.ULG_PROBE_HEADLESS, '0');
  assert.equal(
    policy.command.environment.ULG_PROBE_CHROMIUM_ARGS,
    '--ignore-gpu-blocklist --ozone-platform=x11 '
      + '--window-position=-10000,-10000 --window-size=1280,800'
  );
  assert.equal(STANDARD_VISUAL_SCENARIO_TIMEOUT_MS, 43_200_000);
  assert.equal(
    policy.command.environment.ULG_VISUAL_MATRIX_TIMEOUT_MS,
    String(STANDARD_VISUAL_SCENARIO_TIMEOUT_MS)
  );
  assert.equal(
    policy.command.environment.ULG_VISUAL_MATRIX_DURABLE_RELEASE_PUBLICATION,
    '1'
  );
});

test('synthetic visual receipt fixture independently satisfies every scenario evaluator', () => {
  const scenarios = [
    ...STANDARD_SCENARIOS,
    ...deterministicRandomPairScenarios()
  ];
  for (const scenario of scenarios) {
    const probe = {
      issues: [],
      analysis: { issues: [] },
      timeline: syntheticPassingTimeline(scenario)
    };
    const behavior = evaluateStandardScenarioBehavior(scenario, probe);
    assert.equal(
      behavior?.status,
      'pass',
      `${scenario.label}: ${JSON.stringify(behavior?.checks)}`
    );
    assert.deepEqual(
      synthesizeStandardScenarioIssues(scenario, probe),
      [],
      scenario.label
    );
  }
});

test('framework reactive fixtures require real reactant consumption and product publication', () => {
  const cases = [
    {
      label: 'standard-sodium-water',
      reactant: 'Na',
      products: ['naoh', 'h2'],
      blockingIds: ['sodium-consumed', 'sodium-products-form']
    },
    {
      label: 'standard-cesium-fluorine',
      reactant: 'F',
      products: ['csf'],
      blockingIds: ['fluorine-consumed', 'csf-forms']
    }
  ];
  for (const fixtureCase of cases) {
    const scenario = STANDARD_SCENARIOS.find(
      (candidate) => candidate.label === fixtureCase.label
    );
    assert.ok(scenario, fixtureCase.label);
    const passingTimeline = syntheticPassingTimeline(scenario);
    const passingProbe = {
      issues: [],
      analysis: { issues: [] },
      timeline: passingTimeline
    };
    const passing = evaluateStandardScenarioBehavior(scenario, passingProbe);
    assert.equal(passing.status, 'pass', fixtureCase.label);
    for (const id of fixtureCase.blockingIds) {
      assert.equal(
        passing.checks.find((check) => check.id === id)?.acceptance,
        'blocking',
        `${fixtureCase.label}:${id}`
      );
    }

    const noProductsProbe = structuredClone(passingProbe);
    const noProductsRows = noProductsProbe.timeline.metrics
      .filter((metric) => metric.authoritativeGpuCheckpoint)
      .at(-1).authoritativeGpuCheckpoint.materialPhases;
    for (const row of noProductsRows) {
      if (fixtureCase.products.includes(row.material)) row.massKg = 0;
    }
    assert.equal(
      evaluateStandardScenarioBehavior(scenario, noProductsProbe).status,
      'fail',
      `${fixtureCase.label}: product publication must be blocking`
    );

    const noConsumptionProbe = structuredClone(passingProbe);
    const checkpointMetrics = noConsumptionProbe.timeline.metrics.filter(
      (metric) => metric.authoritativeGpuCheckpoint
    );
    const initialReactantMass = checkpointMetrics[0]
      .authoritativeGpuCheckpoint.materialPhases
      .filter((row) => row.material === fixtureCase.reactant)
      .reduce((sum, row) => sum + Number(row.massKg || 0), 0);
    const finalReactantRows = checkpointMetrics.at(-1)
      .authoritativeGpuCheckpoint.materialPhases.filter(
        (row) => row.material === fixtureCase.reactant
      );
    assert.ok(finalReactantRows.length > 0, fixtureCase.label);
    finalReactantRows[0].massKg = initialReactantMass;
    for (const row of finalReactantRows.slice(1)) row.massKg = 0;
    assert.equal(
      evaluateStandardScenarioBehavior(scenario, noConsumptionProbe).status,
      'fail',
      `${fixtureCase.label}: reactant consumption must be blocking`
    );
  }
});

test('expected-behavior failures bind to synthesized issues without false telemetry drift', async () => {
  const fixture = await createVisualFixture();
  try {
    const evidence = await collectStandardVisualArtifactEvidence({
      policy: fixture.policy,
      stdoutArtifact: fixture.captureRun.capture.command.stdoutArtifact,
      stderrArtifact: fixture.captureRun.capture.command.stderrArtifact,
      repoDir: fixture.repoDir
    });
    const scenarioIndex = fixture.policy.scenarios.findIndex(
      (scenario) => scenario.label === 'standard-iron-ice-quench'
    );
    assert.ok(scenarioIndex >= 0);
    const scenario = STANDARD_SCENARIOS.find(
      (candidate) => candidate.label === 'standard-iron-ice-quench'
    );
    assert.ok(scenario);

    const failedEvidence = structuredClone(evidence);
    const probe = failedEvidence.scenarios[scenarioIndex].probe.json;
    const finalIronRows = probe.timeline.metrics
      .filter((metric) => metric.authoritativeGpuCheckpoint)
      .at(-1).authoritativeGpuCheckpoint.materialPhases.filter(
        (row) => row.material === 'fe'
      );
    assert.ok(finalIronRows.length > 0);
    for (const row of finalIronRows) {
      row.temperatureMinK = 1845;
      row.temperatureMaxK = 1845;
      row.temperatureMassWeightedMeanK = 1845;
    }
    const advisoryBehavior = evaluateStandardScenarioBehavior(
      scenario,
      probe
    );
    assert.equal(advisoryBehavior.status, 'pass');
    assert.equal(advisoryBehavior.scientificStatus, 'fail');
    assert.equal(
      advisoryBehavior.checks.find((check) => check.id === 'iron-cools')
        ?.acceptance,
      'scientific-advisory'
    );
    assert.deepEqual(
      synthesizeStandardScenarioIssues(scenario, probe, {
        expectedBehavior: advisoryBehavior
      }),
      []
    );

    for (const metric of probe.timeline.metrics.filter(
      (entry) => entry.phase === 'resident-batch'
    )) {
      metric.residentSteps.workerOwnedResidentLane.hierarchyStageSummary
        .lawQueueStatus = 'disabled-local-law-queue';
    }
    const expectedBehavior = evaluateStandardScenarioBehavior(scenario, probe);
    assert.equal(expectedBehavior.status, 'fail');
    const issues = synthesizeStandardScenarioIssues(scenario, probe, {
      expectedBehavior
    });
    assert.ok(issues.length > 0);
    assert.equal(
      issues.every((issue) => issue.startsWith('expected-behavior:')),
      true
    );
    const result = failedEvidence.summary.json.results[scenarioIndex];
    result.expectedBehavior = expectedBehavior;
    result.issues = issues;
    result.issueCount = issues.length;
    result.failed = true;
    failedEvidence.summary.json.failedCount = 1;
    failedEvidence.summary.json.issueCounts = Object.fromEntries(
      issues.map((issue) => [issue, 1])
    );

    const evaluation = evaluateStandardVisualCapture(
      fixture.captureRun.capture,
      {
        expectedPolicy: fixture.policy,
        currentFingerprint: fingerprint(),
        artifactEvidence: failedEvidence
      }
    );
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /failed acceptance/);
    assert.doesNotMatch(
      evaluation.failures.join('\n'),
      /telemetry cross-binding mismatch/
    );

    const issueMutations = [
      (values) => values.slice(1),
      (values) => [...values, 'forged-extra-issue']
    ];
    for (const mutateIssues of issueMutations) {
      const drifted = structuredClone(failedEvidence);
      const driftedResult = drifted.summary.json.results[scenarioIndex];
      driftedResult.issues = mutateIssues(driftedResult.issues);
      driftedResult.issueCount = driftedResult.issues.length;
      drifted.summary.json.issueCounts = Object.fromEntries(
        driftedResult.issues.map((issue) => [issue, 1])
      );
      const driftedEvaluation = evaluateStandardVisualCapture(
        fixture.captureRun.capture,
        {
          expectedPolicy: fixture.policy,
          currentFingerprint: fingerprint(),
          artifactEvidence: drifted
        }
      );
      assert.equal(driftedEvaluation.passed, false);
      assert.match(
        driftedEvaluation.failures.join('\n'),
        /visual scenario standard-iron-ice-quench telemetry cross-binding mismatch/
      );
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('capture, exact human PNG review, and final receipt pass together', async () => {
  const fixture = await createVisualFixture();
  try {
    const { capture, evaluation } = fixture.captureRun;
    assert.equal(capture.schema, STANDARD_VISUAL_CAPTURE_SCHEMA);
    assert.equal(capture.status, 'complete');
    assert.deepEqual(evaluation.failures, []);
    assert.equal(evaluation.passed, true);
    assert.equal(capture.artifactManifest.scenarios.length, 7);
    assert.equal(
      capture.artifactManifest.scenarios.every(
        (scenario) => scenario.frames.length === 1
      ),
      true
    );

    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    const review = approveReview(template);
    await writeJson(fixture.reviewPath, review);
    const finalized = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(finalized.receipt.schema, STANDARD_VISUAL_RECEIPT_SCHEMA);
    assert.equal(finalized.receipt.status, 'complete');
    assert.equal(finalized.evaluation.passed, true);
    const reread = await readStandardVisualMatrixReceiptEvidence({
      receipt: finalized.receipt,
      repoDir: fixture.repoDir
    });
    assert.equal(
      evaluateStandardVisualMatrixReceipt(finalized.receipt, {
        ...reread,
        currentFingerprint: fingerprint()
      }).passed,
      true
    );
    const event = standardVisualMatrixIccEvent(finalized);
    assert.equal(event.kind, STANDARD_VISUAL_EVENT_KIND);
    assert.equal(event.name, STANDARD_VISUAL_EVENT_NAME);
    assert.equal(event.status, 'PASS');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('visual evaluators reject source drift, frame tampering, and partial review', async () => {
  const fixture = await createVisualFixture();
  try {
    const { capture } = fixture.captureRun;
    const evidence = await collectStandardVisualArtifactEvidence({
      policy: fixture.policy,
      stdoutArtifact: capture.command.stdoutArtifact,
      stderrArtifact: capture.command.stderrArtifact,
      repoDir: fixture.repoDir
    });
    const drifted = evaluateStandardVisualCapture(capture, {
      expectedPolicy: fixture.policy,
      currentFingerprint: fingerprint({ sourceFingerprint: 'd'.repeat(64) }),
      artifactEvidence: evidence
    });
    assert.equal(drifted.passed, false);
    assert.match(drifted.failures.join('\n'), /fingerprint changed/);

    const blankEvidence = structuredClone(evidence);
    blankEvidence.scenarios[0].frames[0].sourceRow.blankFrame = true;
    const blank = evaluateStandardVisualCapture(capture, {
      expectedPolicy: fixture.policy,
      currentFingerprint: fingerprint(),
      artifactEvidence: blankEvidence
    });
    assert.equal(blank.passed, false);
    assert.match(blank.failures.join('\n'), /frame 0 invalid/);

    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    const review = approveReview(template);
    review.frames[3].decision = 'pending';
    const rejectedReview = evaluateStandardVisualReview(review, {
      capture,
      currentFingerprint: fingerprint()
    });
    assert.equal(rejectedReview.passed, false);
    assert.match(rejectedReview.failures.join('\n'), /review frame 3 mismatch/);

    const fakeArtifact = {
      path: path.join(fixture.root, 'input.json'),
      byteLength: 1,
      sha256: 'e'.repeat(64)
    };
    const forgedReceipt = evaluateStandardVisualMatrixReceipt({
      schema: STANDARD_VISUAL_RECEIPT_SCHEMA,
      policyTrack: capture.policyTrack,
      status: 'complete',
      sourceFingerprint: fingerprint(),
      captureManifestSha256: capture.captureManifestSha256,
      captureArtifact: fakeArtifact,
      reviewArtifact: fakeArtifact
    }, {
      expectedPolicy: fixture.policy,
      currentFingerprint: fingerprint(),
      captureArtifact: fakeArtifact,
      capture,
      artifactEvidence: evidence,
      reviewArtifact: fakeArtifact,
      review
    });
    assert.equal(forgedReceipt.passed, false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('receipt independently decodes PNG visibility and variation', async () => {
  const visible = decodeStandardVisualPng(PNG_BYTES);
  assert.equal(visible.status, 'ready');
  assert.equal(visible.hasVisiblePixels, true);
  assert.equal(visible.hasSurfaceLikeVariation, true);
  const black = decodeStandardVisualPng(rgbaPng(2, 1, Buffer.from([
    0, 0, 0, 255,
    0, 0, 0, 255
  ])));
  assert.equal(black.status, 'ready');
  assert.equal(black.hasVisiblePixels, false);
  assert.equal(black.hasSurfaceLikeVariation, false);

  const fixture = await createVisualFixture();
  try {
    const evidence = await collectStandardVisualArtifactEvidence({
      policy: fixture.policy,
      stdoutArtifact: fixture.captureRun.capture.command.stdoutArtifact,
      stderrArtifact: fixture.captureRun.capture.command.stderrArtifact,
      repoDir: fixture.repoDir
    });
    const forgedProbe = structuredClone(evidence);
    forgedProbe.scenarios[0].frames[0].sourceRow.png.hasVisiblePixels = true;
    forgedProbe.scenarios[0].frames[0].sourceRow.png.hasSurfaceLikeVariation = true;
    forgedProbe.scenarios[0].frames[0].sourceRow.blankFrame = false;
    forgedProbe.scenarios[0].frames[0].artifact.png = black;
    const evaluation = evaluateStandardVisualCapture(fixture.captureRun.capture, {
      expectedPolicy: fixture.policy,
      currentFingerprint: fingerprint(),
      artifactEvidence: forgedProbe
    });
    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures.join('\n'), /frame 0 invalid/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('PNG decoder rejects malformed structure and unconsumed IDAT bytes', () => {
  const rawRows = Buffer.from([0, 20, 40, 60, 255, 180, 120, 30, 255]);
  const compressed = deflateSync(rawRows);
  const ihdr = rgbaIhdr();
  const validChunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ];
  const fixtures = [
    [
      'repeated IHDR',
      pngFromChunks([
        pngChunk('IHDR', ihdr),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', compressed),
        pngChunk('IEND', Buffer.alloc(0))
      ])
    ],
    [
      'non-contiguous IDAT',
      pngFromChunks([
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', compressed.subarray(0, 4)),
        pngChunk('tEXt', Buffer.from('separates-idat')),
        pngChunk('IDAT', compressed.subarray(4)),
        pngChunk('IEND', Buffer.alloc(0))
      ])
    ],
    [
      'unknown critical chunk',
      pngFromChunks([
        pngChunk('IHDR', ihdr),
        pngChunk('ABCD', Buffer.alloc(0)),
        pngChunk('IDAT', compressed),
        pngChunk('IEND', Buffer.alloc(0))
      ])
    ],
    [
      'chunk after IEND',
      Buffer.concat([...validChunks, pngChunk('tEXt', Buffer.from('after-end'))])
    ],
    [
      'trailing compressed bytes',
      pngFromChunks([
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', Buffer.concat([compressed, Buffer.from([0])])),
        pngChunk('IEND', Buffer.alloc(0))
      ])
    ]
  ];
  for (const [label, bytes] of fixtures) {
    assert.equal(decodeStandardVisualPng(bytes).status, 'invalid', label);
  }
});

test('receipt rejects absent, non-record, non-numeric, and nonzero telemetry maps', async () => {
  const fixture = await createVisualFixture();
  try {
    const evidence = await collectStandardVisualArtifactEvidence({
      policy: fixture.policy,
      stdoutArtifact: fixture.captureRun.capture.command.stdoutArtifact,
      stderrArtifact: fixture.captureRun.capture.command.stderrArtifact,
      repoDir: fixture.repoDir
    });
    for (const invalidMap of [undefined, [], { gpu: '0' }, { gpu: 1 }]) {
      const mutated = structuredClone(evidence);
      mutated.summary.json.issueCounts = invalidMap;
      const evaluation = evaluateStandardVisualCapture(fixture.captureRun.capture, {
        expectedPolicy: fixture.policy,
        currentFingerprint: fingerprint(),
        artifactEvidence: mutated
      });
      assert.equal(evaluation.passed, false);
      assert.match(evaluation.failures.join('\n'), /reported issues or warnings/);
    }
    const telemetryMutations = [
      (value) => { delete value.summary.json.browserConsoleIssueCounts; },
      (value) => { delete value.summary.json.visualSurfaceIssueCounts; },
      (value) => { delete value.summary.json.results[0].browserConsoleIssueCounts; },
      (value) => { value.summary.json.results[0].browserConsoleIssueCount = 1; },
      (value) => { delete value.summary.json.results[0].visualSurfaceIssueTypes; },
      (value) => { delete value.scenarios[0].probe.json.analysis.browserConsoleIssueCounts; },
      (value) => { delete value.scenarios[0].probe.json.analysis.browserConsoleWarningCount; },
      (value) => { delete value.scenarios[0].probe.json.analysis.visualSurfaceIssues; }
    ];
    for (const mutate of telemetryMutations) {
      const mutated = structuredClone(evidence);
      mutate(mutated);
      const evaluation = evaluateStandardVisualCapture(fixture.captureRun.capture, {
        expectedPolicy: fixture.policy,
        currentFingerprint: fingerprint(),
        artifactEvidence: mutated
      });
      assert.equal(evaluation.passed, false);
      assert.match(evaluation.failures.join('\n'), /telemetry|reported issues or warnings|acceptance|probe evidence incomplete/);
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('receipt fails closed on unowned browser, remote Vite, or unsafe scenario provenance', async () => {
  const fixture = await createVisualFixture();
  try {
    const evidence = await collectStandardVisualArtifactEvidence({
      policy: fixture.policy,
      stdoutArtifact: fixture.captureRun.capture.command.stdoutArtifact,
      stderrArtifact: fixture.captureRun.capture.command.stderrArtifact,
      repoDir: fixture.repoDir
    });
    const mutate = [
      (probe) => { probe.browserLaunch.executablePath = '/tmp/chrome'; },
      (probe) => { probe.browserLaunch.headless = true; },
      (probe) => { probe.baseUrl = 'https://remote.invalid'; },
      (probe) => { probe.scenarioUrl = 'https://remote.invalid/'; }
    ];
    for (const apply of mutate) {
      const altered = structuredClone(evidence);
      apply(altered.scenarios[0].probe.json);
      const evaluation = evaluateStandardVisualCapture(fixture.captureRun.capture, {
        expectedPolicy: fixture.policy,
        currentFingerprint: fingerprint(),
        artifactEvidence: altered
      });
      assert.equal(evaluation.passed, false);
      assert.match(evaluation.failures.join('\n'), /owned local browser provenance mismatch/);
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('finalization independently re-hashes stream artifacts', async () => {
  const fixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    await writeJson(fixture.reviewPath, approveReview(template));
    await writeFile(
      fixture.captureRun.capture.command.stdoutArtifact.path,
      'tampered after capture\n'
    );
    const finalized = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(finalized.receipt.status, 'failed');
    assert.equal(finalized.evaluation.passed, false);
    assert.match(finalized.evaluation.failures.join('\n'), /stream artifact mismatch/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('capture writes durable fail sentinels when execution aborts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-visual-fail-'));
  try {
    const repoDir = path.join(root, 'repo');
    await mkdir(repoDir);
    const fixtureCapability = await fixtureCapabilityFor(repoDir);
    const result = await runStandardVisualFixtureCapture({
      capturePath: path.join(root, 'receipts', 'capture.json'),
      artifactDir: path.join(root, 'artifacts'),
      reviewTemplatePath: path.join(root, 'receipts', 'review.json'),
      repoDir,
      fixtureCapability,
      fixtureProcessRunner: async () => {
        throw new Error('synthetic runner abort');
      },
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(result.capture.status, 'failed');
    assert.match(result.capture.reason, /synthetic runner abort/);
    const review = JSON.parse(await readFile(result.reviewTemplatePath, 'utf8'));
    assert.equal(review.status, 'unavailable');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fixture executor cannot certify the source repository', async () => {
  let invoked = false;
  const sourceRepoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  await assert.rejects(
    runStandardVisualFixtureCapture({
      capturePath: '/tmp/fixture-capture.json',
      artifactDir: '/tmp/fixture-artifacts',
      reviewTemplatePath: '/tmp/fixture-review.json',
      repoDir: sourceRepoDir,
      fixtureProcessRunner: async () => { invoked = true; }
    }),
    /cannot certify the source repository/u
  );
  assert.equal(invoked, false);
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-visual-source-link-'));
  try {
    const sourceLink = path.join(root, 'source-repo-link');
    await symlink(sourceRepoDir, sourceLink, 'dir');
    await assert.rejects(
      runStandardVisualFixtureCapture({
        capturePath: path.join(root, 'capture.json'),
        artifactDir: path.join(root, 'artifacts'),
        reviewTemplatePath: path.join(root, 'review.json'),
        repoDir: sourceLink,
        fixtureProcessRunner: async () => { invoked = true; }
      }),
      /cannot certify the source repository/u
    );
    assert.equal(invoked, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('production visual APIs reject injected fingerprint providers and stability hooks', async () => {
  const injectedFingerprintProvider = async () => fingerprint();
  const injectedStabilityHook = async () => {};
  await assert.rejects(
    runStandardVisualCapture({
      fingerprintProvider: injectedFingerprintProvider
    }),
    /requires exactWorktreeFingerprint/u
  );
  await assert.rejects(
    runStandardVisualCapture({
      stabilityHook: injectedStabilityHook
    }),
    /does not accept fixture seams/u
  );
  await assert.rejects(
    runStandardVisualFinalize({
      capturePath: path.join(os.tmpdir(), 'ulg-production-capture.json'),
      reviewPath: path.join(os.tmpdir(), 'ulg-production-review.json'),
      receiptPath: path.join(os.tmpdir(), 'ulg-production-receipt.json'),
      repoDir: productionRepoDir,
      fingerprintProvider: injectedFingerprintProvider
    }),
    /requires an opaque fixture capability/u
  );
  await assert.rejects(
    runStandardVisualFinalize({
      capturePath: path.join(os.tmpdir(), 'ulg-production-capture.json'),
      reviewPath: path.join(os.tmpdir(), 'ulg-production-review.json'),
      receiptPath: path.join(os.tmpdir(), 'ulg-production-receipt.json'),
      repoDir: productionRepoDir,
      stabilityHook: injectedStabilityHook
    }),
    /requires an opaque fixture capability/u
  );
});

test('fixture finalization requires its opaque capability on every injected seam', async () => {
  const fixture = await createVisualFixture();
  try {
    await assert.rejects(
      runStandardVisualFinalize({
        capturePath: fixture.capturePath,
        reviewPath: fixture.reviewPath,
        receiptPath: fixture.receiptPath,
        repoDir: fixture.repoDir,
        fingerprintProvider: async () => fingerprint()
      }),
      /requires an opaque fixture capability/u
    );
    await assert.rejects(
      runStandardVisualFinalize({
        capturePath: fixture.capturePath,
        reviewPath: fixture.reviewPath,
        receiptPath: fixture.receiptPath,
        repoDir: fixture.repoDir,
        stabilityHook: async () => {}
      }),
      /requires an opaque fixture capability/u
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('capture and finalization convert post-write source drift into durable failures', async () => {
  let captureCalls = 0;
  const captureFixture = await createVisualFixture({
    fingerprintProvider: async () => (
      captureCalls += 1,
      captureCalls < 3 ? fingerprint() : fingerprint({ sourceFingerprint: 'd'.repeat(64) })
    )
  });
  try {
    assert.equal(captureFixture.captureRun.capture.status, 'failed');
    assert.equal(captureFixture.captureRun.evaluation.passed, false);
    const persisted = JSON.parse(await readFile(captureFixture.capturePath, 'utf8'));
    assert.match(persisted.reason, /post-write stability failure/);
  } finally {
    await rm(captureFixture.root, { recursive: true, force: true });
  }

  const finalizeFixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(finalizeFixture.reviewPath, 'utf8'));
    await writeJson(finalizeFixture.reviewPath, approveReview(template));
    let finalizeCalls = 0;
    const finalized = await runStandardVisualFinalize({
      capturePath: finalizeFixture.capturePath,
      reviewPath: finalizeFixture.reviewPath,
      receiptPath: finalizeFixture.receiptPath,
      repoDir: finalizeFixture.repoDir,
      fixtureCapability: finalizeFixture.fixtureCapability,
      fingerprintProvider: async () => (
        finalizeCalls += 1,
        finalizeCalls < 2 ? fingerprint() : fingerprint({ sourceFingerprint: 'd'.repeat(64) })
      )
    });
    assert.equal(finalized.receipt.status, 'failed');
    const persisted = JSON.parse(await readFile(finalizeFixture.receiptPath, 'utf8'));
    assert.match(persisted.reason, /post-write stability failure/);
  } finally {
    await rm(finalizeFixture.root, { recursive: true, force: true });
  }
});

test('stable visual evidence root rejects deterministic root substitutions and hardlinks', async () => {
  let captureSwapDone = false;
  const captureFixture = await createVisualFixture({
    stabilityHook: async ({ stage, policy }) => {
      if (stage !== 'capture:after-process') return;
      captureSwapDone = true;
      const displaced = `${policy.outputRoot}.displaced`;
      const attackerRoot = path.join(path.dirname(policy.outputRoot), 'attacker-root');
      await mkdir(attackerRoot);
      await rename(policy.outputRoot, displaced);
      await symlink(attackerRoot, policy.outputRoot, 'dir');
    }
  });
  try {
    assert.equal(captureSwapDone, true);
    assert.equal(captureFixture.captureRun.capture.status, 'failed');
    assert.match(
      captureFixture.captureRun.capture.reason,
      /output root.*non-symlink|symbolic link|identity changed/u
    );
  } finally {
    await rm(captureFixture.root, { recursive: true, force: true });
  }

  const hardlinkFixture = await createVisualFixture();
  try {
    const summaryPath = path.join(hardlinkFixture.policy.outputRoot, 'summary.json');
    const attackerPath = path.join(hardlinkFixture.root, 'attacker-summary.json');
    await writeFile(attackerPath, await readFile(summaryPath));
    await rm(summaryPath);
    await link(attackerPath, summaryPath);
    await assert.rejects(
      collectStandardVisualArtifactEvidence({
        policy: hardlinkFixture.policy,
        stdoutArtifact: hardlinkFixture.captureRun.capture.command.stdoutArtifact,
        stderrArtifact: hardlinkFixture.captureRun.capture.command.stderrArtifact,
        repoDir: hardlinkFixture.repoDir
      }),
      /unlinked regular non-symlink file/u
    );
  } finally {
    await rm(hardlinkFixture.root, { recursive: true, force: true });
  }

  const finalizeFixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(finalizeFixture.reviewPath, 'utf8'));
    await writeJson(finalizeFixture.reviewPath, approveReview(template));
    let finalizeSwapDone = false;
    const finalized = await runStandardVisualFinalize({
      capturePath: finalizeFixture.capturePath,
      reviewPath: finalizeFixture.reviewPath,
      receiptPath: finalizeFixture.receiptPath,
      repoDir: finalizeFixture.repoDir,
      fixtureCapability: finalizeFixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint(),
      stabilityHook: async ({ stage, policy }) => {
        if (stage !== 'finalize:after-write') return;
        finalizeSwapDone = true;
        const displaced = `${policy.outputRoot}.finalize-displaced`;
        const attackerRoot = path.join(path.dirname(policy.outputRoot), 'finalize-attacker-root');
        await mkdir(attackerRoot);
        await rename(policy.outputRoot, displaced);
        await symlink(attackerRoot, policy.outputRoot, 'dir');
      }
    });
    assert.equal(finalizeSwapDone, true);
    assert.equal(finalized.receipt.status, 'failed');
    assert.match(
      finalized.receipt.reason,
      /output root.*non-symlink|symbolic link|identity changed/u
    );
  } finally {
    await rm(finalizeFixture.root, { recursive: true, force: true });
  }
});

test('private visual run roots reject chmod drift during capture, finalization, and evidence reread', async () => {
  let captureChmodDone = false;
  const captureFixture = await createVisualFixture({
    stabilityHook: async ({ stage, policy }) => {
      if (stage !== 'capture:after-process') return;
      captureChmodDone = true;
      await chmod(policy.outputRoot, 0o755);
    }
  });
  try {
    assert.equal(captureChmodDone, true);
    assert.equal(captureFixture.captureRun.capture.status, 'failed');
    const persisted = JSON.parse(await readFile(captureFixture.capturePath, 'utf8'));
    assert.match(persisted.reason, /output root.*private and owned/u);
  } finally {
    await rm(captureFixture.root, { recursive: true, force: true });
  }

  const finalizeFixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(finalizeFixture.reviewPath, 'utf8'));
    await writeJson(finalizeFixture.reviewPath, approveReview(template));
    let finalizeChmodDone = false;
    const finalized = await runStandardVisualFinalize({
      capturePath: finalizeFixture.capturePath,
      reviewPath: finalizeFixture.reviewPath,
      receiptPath: finalizeFixture.receiptPath,
      repoDir: finalizeFixture.repoDir,
      fixtureCapability: finalizeFixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint(),
      stabilityHook: async ({ stage, policy }) => {
        if (stage !== 'finalize:after-write') return;
        finalizeChmodDone = true;
        await chmod(policy.outputRoot, 0o755);
      }
    });
    assert.equal(finalizeChmodDone, true);
    assert.equal(finalized.receipt.status, 'failed');
    const persisted = JSON.parse(await readFile(finalizeFixture.receiptPath, 'utf8'));
    assert.match(persisted.reason, /output root.*private and owned/u);
  } finally {
    await rm(finalizeFixture.root, { recursive: true, force: true });
  }

  const rereadFixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(rereadFixture.reviewPath, 'utf8'));
    await writeJson(rereadFixture.reviewPath, approveReview(template));
    const finalized = await runStandardVisualFinalize({
      capturePath: rereadFixture.capturePath,
      reviewPath: rereadFixture.reviewPath,
      receiptPath: rereadFixture.receiptPath,
      repoDir: rereadFixture.repoDir,
      fixtureCapability: rereadFixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(finalized.receipt.status, 'complete');
    await chmod(rereadFixture.policy.outputRoot, 0o755);
    await assert.rejects(
      readStandardVisualMatrixReceiptEvidence({
        receipt: finalized.receipt,
        repoDir: rereadFixture.repoDir
      }),
      /standard visual output root must be private and owned/u
    );
  } finally {
    await rm(rereadFixture.root, { recursive: true, force: true });
  }
});

test('finalization persists a failure when an existing receipt meets preflight root privacy drift', async () => {
  const fixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    await writeJson(fixture.reviewPath, approveReview(template));
    const firstFinalization = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(firstFinalization.receipt.status, 'complete');

    await chmod(fixture.policy.outputRoot, 0o755);
    const rejected = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(rejected.receipt.status, 'failed');
    assert.match(rejected.receipt.reason, /output root.*private and owned/u);
    const persisted = JSON.parse(await readFile(fixture.receiptPath, 'utf8'));
    assert.equal(persisted.status, 'failed');
    assert.match(persisted.reason, /output root.*private and owned/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('finalization rejects and preserves an unbound preexisting receipt', async () => {
  const fixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    await writeJson(fixture.reviewPath, approveReview(template));
    await mkdir(path.dirname(fixture.receiptPath), { recursive: true, mode: 0o700 });
    await chmod(path.dirname(fixture.receiptPath), 0o700);
    const forged = `${JSON.stringify({ schema: 'attacker.receipt.v1', status: 'complete' })}\n`;
    await writeFile(fixture.receiptPath, forged);

    await assert.rejects(
      runStandardVisualFinalize({
        capturePath: fixture.capturePath,
        reviewPath: fixture.reviewPath,
        receiptPath: fixture.receiptPath,
        repoDir: fixture.repoDir,
        fixtureCapability: fixture.fixtureCapability,
        fingerprintProvider: async () => fingerprint()
      }),
      /not a bound complete visual receipt/u
    );
    assert.equal(await readFile(fixture.receiptPath, 'utf8'), forged);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('finalization rejects and preserves existing receipts with altered source or policy binding', async () => {
  const fixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    await writeJson(fixture.reviewPath, approveReview(template));
    const first = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(first.receipt.status, 'complete');
    const completeReceipt = JSON.parse(await readFile(fixture.receiptPath, 'utf8'));
    const alteredReceipts = [
      ['source fingerprint', (receipt) => {
        receipt.sourceFingerprint = fingerprint({ sourceFingerprint: 'd'.repeat(64) });
      }],
      ['policy track', (receipt) => {
        receipt.policyTrack = 'attacker-policy-track';
      }]
    ];
    for (const [label, alter] of alteredReceipts) {
      const altered = structuredClone(completeReceipt);
      alter(altered);
      const exactBytes = `${JSON.stringify(altered, null, 2)}\n`;
      await writeFile(fixture.receiptPath, exactBytes);
      await assert.rejects(
        runStandardVisualFinalize({
          capturePath: fixture.capturePath,
          reviewPath: fixture.reviewPath,
          receiptPath: fixture.receiptPath,
          repoDir: fixture.repoDir,
          fixtureCapability: fixture.fixtureCapability,
          fingerprintProvider: async () => fingerprint()
        }),
        /not a bound complete visual receipt/u,
        label
      );
      assert.equal(await readFile(fixture.receiptPath, 'utf8'), exactBytes, label);
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('re-finalization persists source drift after a valid prior complete receipt', async () => {
  const fixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    await writeJson(fixture.reviewPath, approveReview(template));
    const first = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(first.receipt.status, 'complete');

    const rejected = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint({ sourceFingerprint: 'd'.repeat(64) })
    });
    assert.equal(rejected.receipt.status, 'failed');
    assert.match(rejected.receipt.reason, /exact source binding mismatch/u);
    const persisted = JSON.parse(await readFile(fixture.receiptPath, 'utf8'));
    assert.equal(persisted.status, 'failed');
    assert.match(persisted.reason, /exact source binding mismatch/u);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('finalization preserves an identity-swapped receipt before adoption', async () => {
  const fixture = await createVisualFixture();
  try {
    const template = JSON.parse(await readFile(fixture.reviewPath, 'utf8'));
    await writeJson(fixture.reviewPath, approveReview(template));
    const first = await runStandardVisualFinalize({
      capturePath: fixture.capturePath,
      reviewPath: fixture.reviewPath,
      receiptPath: fixture.receiptPath,
      repoDir: fixture.repoDir,
      fixtureCapability: fixture.fixtureCapability,
      fingerprintProvider: async () => fingerprint()
    });
    assert.equal(first.receipt.status, 'complete');

    const replacement = `${JSON.stringify({ attacker: 'replacement' })}\n`;
    let swapped = false;
    await assert.rejects(
      runStandardVisualFinalize({
        capturePath: fixture.capturePath,
        reviewPath: fixture.reviewPath,
        receiptPath: fixture.receiptPath,
        repoDir: fixture.repoDir,
        fixtureCapability: fixture.fixtureCapability,
        fingerprintProvider: async () => fingerprint(),
        stabilityHook: async ({ stage, receiptPath }) => {
          if (stage !== 'finalize:before-existing-receipt-adoption') return;
          swapped = true;
          const displaced = `${receiptPath}.displaced`;
          await rename(receiptPath, displaced);
          await writeFile(receiptPath, replacement);
        }
      }),
      /adopted existing output.*changed/u
    );
    assert.equal(swapped, true);
    assert.equal(await readFile(fixture.receiptPath, 'utf8'), replacement);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('visual producers reject colliding or repository-local outputs before execution', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-visual-paths-'));
  try {
    const repoDir = path.join(root, 'repo');
    const artifactDir = path.join(root, 'artifacts');
    const sharedPath = path.join(root, 'receipts', 'shared.json');
    await mkdir(repoDir);
    const fixtureCapability = await fixtureCapabilityFor(repoDir);
    await assert.rejects(
      runStandardVisualFixtureCapture({
        capturePath: sharedPath,
        artifactDir,
        reviewTemplatePath: sharedPath,
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: async () => {
          throw new Error('must not execute');
        },
        fingerprintProvider: async () => fingerprint()
      }),
      /pairwise distinct/u
    );
    await assert.rejects(
      runStandardVisualFixtureCapture({
        capturePath: path.join(root, 'receipts', 'capture.json'),
        artifactDir: path.join(repoDir, 'forbidden-artifacts'),
        reviewTemplatePath: path.join(root, 'receipts', 'review.json'),
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: async () => {
          throw new Error('must not execute');
        },
        fingerprintProvider: async () => fingerprint()
      }),
      /must be outside the repository/u
    );
    const escapedArtifactDir = path.join(root, 'escaped-artifacts');
    const escapedTarget = path.join(root, 'escaped-target');
    await mkdir(escapedArtifactDir);
    await mkdir(escapedTarget);
    await symlink(escapedTarget, path.join(escapedArtifactDir, 'matrix'), 'dir');
    let invoked = false;
    await assert.rejects(
      runStandardVisualFixtureCapture({
        capturePath: path.join(root, 'receipts', 'escaped-capture.json'),
        artifactDir: escapedArtifactDir,
        reviewTemplatePath: path.join(root, 'receipts', 'escaped-review.json'),
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: async () => { invoked = true; },
        fingerprintProvider: async () => fingerprint()
      }),
      /(?:output directory must be a real non-symlink directory|must not traverse a symbolic link)/u
    );
    assert.equal(invoked, false);
    await assert.rejects(
      runStandardVisualFixtureCapture({
        capturePath: path.join(artifactDir, 'capture.json'),
        artifactDir,
        reviewTemplatePath: path.join(root, 'receipts', 'review.json'),
        repoDir,
        fixtureCapability,
        fixtureProcessRunner: async () => {
          throw new Error('must not execute');
        },
        fingerprintProvider: async () => fingerprint()
      }),
      /must be outside the repository/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('visual finalizer rejects a receipt path colliding with an input', async () => {
  const fixture = await createVisualFixture();
  try {
    await assert.rejects(
      runStandardVisualFinalize({
        capturePath: fixture.capturePath,
        reviewPath: fixture.reviewPath,
        receiptPath: fixture.reviewPath,
        repoDir: fixture.repoDir,
        fixtureCapability: fixture.fixtureCapability,
        fingerprintProvider: async () => fingerprint()
      }),
      /pairwise distinct/u
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
