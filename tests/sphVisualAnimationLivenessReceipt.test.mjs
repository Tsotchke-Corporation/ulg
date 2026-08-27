import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import {
  VISUAL_LIVENESS_COVERAGE,
  VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS,
  VISUAL_LIVENESS_LIMITS_MS,
  VISUAL_LIVENESS_AUTOPLAY_START_MODE,
  MAX_COMPOSITOR_FRAME_COUNT,
  MIN_SUSTAINED_PRESENTED_STEP_COUNT,
  MIN_SUSTAINED_PROGRESS_MS,
  QUIESCENT_CAPTURE_STABILITY_MS,
  VISUAL_LIVENESS_POLICY_ID,
  VISUAL_LIVENESS_RECEIPT_SCHEMA,
  VISUAL_LIVENESS_SCENARIO_SCHEMA,
  evaluateVisualLivenessReceipt,
  readVisualLivenessArtifactEvidence,
  evaluateVisualLivenessMilestone,
  evaluateVisualLivenessSustainedProgress,
  resolveVisualLivenessDeadlines,
  standardVisualLivenessScenarios,
  terminateOwnedProcessGroup,
  timeoutFailure,
  visualLivenessReceiptSummary,
  visualLivenessCaptureWindowStable,
  visualLivenessInitialPresentationReady,
  visualLivenessQuiescentPresentationReady,
  visualLivenessQuiescentWindowStable,
  visualLivenessQuiescentSnapshotAdvanced,
  visualLivenessSnapshotAdvanced,
  visualLivenessSnapshotReady,
  waitForQuiescentCaptureSnapshot
} from '../scripts/sph-visual-animation-liveness-receipt.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function visualFixturePng(seed) {
  const width = 24;
  const height = 24;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const scanlines = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      scanlines[offset] = 24 + ((x * 17 + y * 3 + seed * 11) % 180);
      scanlines[offset + 1] = 31 + ((x * 5 + y * 19 + seed * 7) % 170);
      scanlines[offset + 2] = 10 + ((x * 13 + y * 11 + seed * 5) % 160);
    }
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND')
  ]);
}

function readySnapshot(overrides = {}) {
  return {
    overlayPresent: true,
    scenePresent: true,
    particleStateReady: true,
    residentAuto: false,
    residentAutoConfigured: false,
    playbackActive: true,
    playText: 'Pause',
    playButtonDisabled: false,
    rendererBackend: 'native-webgpu',
    surfaceDrawMode: 'native-webgpu-surface-consumer',
    nativePresentationReady: true,
    presentationAdmitted: true,
    pendingPresentationActive: false,
    residentError: null,
    renderError: null,
    workerRebuildError: null,
    nextStep: 0,
    nextTimeS: 0,
    lastResidentCompletionAtMs: 0,
    residentSubmissions: 0,
    renderBridgeFrameCount: 1,
    renderBridgeUpdateCount: 0,
    renderBridgeSubmittedDrawCount: 1,
    renderBridgeSourceResidentNextStep: 0,
    residentPending: null,
    staleResidentSubmissions: 0,
    telemetry: {
      schema: 'peercompute.ulg.gpu-readback-telemetry.v1',
      complete: true,
      normalHotLoopReadbackFree: true,
      mapAsyncCount: 0,
      readbackBytes: 0,
      hostQueueFenceCount: 0
    },
    ...overrides
  };
}

function quiescentSnapshot(overrides = {}) {
  return readySnapshot({
    ...overrides,
    playbackActive: false,
    playText: 'Play'
  });
}

function frameIdentity(snapshot) {
  return {
    residentStep: snapshot.nextStep,
    residentTimeS: snapshot.nextTimeS,
    presentedSourceStep: snapshot.renderBridgeSourceResidentNextStep,
    residentSubmissions: snapshot.residentSubmissions,
    renderBridgeFrameCount: snapshot.renderBridgeFrameCount,
    renderBridgeUpdateCount: snapshot.renderBridgeUpdateCount
  };
}

function productHistoryGpuCommit(overrides = {}) {
  return {
    residentProductMassStatus: 'resident-product-mass-merged-gpu-resident',
    compactionStatus: 'product-event-filtered-append-gpu-count-resident',
    gpuCommitStatus: 'gpu-conditioned-publication-commit-pending',
    arenaStatus: 'resident-product-history-arena-gpu-commit-pending',
    gridCouplingStatus: 'resident-product-mass-bound-to-p2g-grid',
    countAuthority: 'gpu-authored-filtered-live-prefix',
    rowCapacity: 131072,
    countHostKnown: false,
    dispatchMode: 'gpu-authored-indirect-live-count',
    renderProductEventBufferBound: true,
    renderProductEventBufferByteLength: 16 * 1024 * 1024,
    renderResidentProductMassStatus: 'resident-product-mass-merged-gpu-resident',
    renderCountAuthority: 'gpu-authored-filtered-live-prefix',
    renderControlAuthentication: 'full-eight-word-gpu-commit-gate',
    renderControlHostObserved: false,
    renderCountHostKnown: false,
    generation: 87,
    seal: 12345,
    renderGeneration: 87,
    renderSeal: 12345,
    ...overrides
  };
}

function formalSnapshot({
  step,
  presentedStep = step,
  milestone,
  capturedAtMs = step * 500
}) {
  return readySnapshot({
    capturedAtMs,
    nextStep: step,
    nextTimeS: step / 1000,
    lastResidentCompletionAtMs: capturedAtMs - 1,
    residentSubmissions: step,
    staleResidentSubmissions: 0,
    renderBridgeFrameCount: step + 2,
    renderBridgeUpdateCount: step + 1,
    renderBridgeSubmittedDrawCount: 8,
    renderBridgeSourceResidentNextStep: presentedStep,
    residentPending: null,
    telemetry: {
      schema: 'peercompute.ulg.gpu-readback-telemetry.v1',
      complete: true,
      normalHotLoopReadbackFree: true,
      mapAsyncCount: 0,
      readbackBytes: 0,
      hostQueueFenceCount: 0
    },
    milestone
  });
}

function formalMilestone(id) {
  if (id === 'water-cycle') {
    return { thermalStatus: 'thermal-step-executed', thermalBackend: 'webgpu' };
  }
  if (id === 'iron-ice-quench') {
    return {
      surfaceStress: {
        schema: 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
        status: 'eighteen-pass-central-bond-surface-stress-submitted-unverified',
        submitted: true,
        dispatchCount: 18,
        lifecycleDispatchCount: 21
      }
    };
  }
  const milestone = { productHistory: productHistoryGpuCommit() };
  if (id === 'cesium-fluorine') {
    Object.assign(milestone, {
      twoLevelAuthority: 'authoritative',
      twoLevelCommitVerified: true,
      twoLevelFineSubstepCount: 2
    });
  }
  return milestone;
}

function formalReceiptFixture() {
  const fingerprint = {
    gitHead: 'a'.repeat(40),
    sourceFingerprint: 'b'.repeat(64),
    worktreeDirty: true,
    worktreeStatusHash: 'c'.repeat(64),
    trackedAndUntrackedFileCount: 42
  };
  const evidenceScenarios = [];
  const scenarios = standardVisualLivenessScenarios().map((expected, scenarioIndex) => {
    const milestoneSource = formalMilestone(expected.id);
    const initialPresentationSnapshot = quiescentSnapshot({
      capturedAtMs: 500,
      nextStep: 0,
      nextTimeS: 0,
      lastResidentCompletionAtMs: null,
      residentSubmissions: 0,
      renderBridgeFrameCount: 1,
      renderBridgeUpdateCount: 0,
      renderBridgeSubmittedDrawCount: 4,
      renderBridgeSourceResidentNextStep: 0,
      telemetry: null,
      milestone: milestoneSource
    });
    const baseline = formalSnapshot({ step: 1, milestone: milestoneSource });
    const checkpoints = VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.map(
      (threshold) => ({
        threshold,
        stepDelta: threshold,
        snapshot: quiescentSnapshot(formalSnapshot({
          step: threshold + 1,
          milestone: milestoneSource
        }))
      })
    );
    const finalSnapshot = formalSnapshot({
      step: 162,
      presentedStep: 161,
      milestone: milestoneSource,
      capturedAtMs: 61_500
    });
    const roles = ['initial', 'checkpoint-40', 'checkpoint-96', 'checkpoint-160'];
    const frameSnapshots = [
      initialPresentationSnapshot,
      ...checkpoints.map((row) => row.snapshot)
    ];
    const png = { status: 'ready', hasVisibleSurfaceContent: true };
    const frames = roles.map((role, frameIndex) => ({
      role,
      path: `/tmp/ulg-formal-${scenarioIndex}/frame-${String(frameIndex).padStart(2, '0')}-${role}.png`,
      byteLength: 100 + frameIndex,
      sha256: String(scenarioIndex * roles.length + frameIndex + 1).padStart(64, '0'),
      validationStatus: 'ready',
      visibleSurfaceContent: true,
      png,
      source: frameIdentity(frameSnapshots[frameIndex]),
      captureWindow: {
        before: frameIdentity(frameSnapshots[frameIndex]),
        after: frameIdentity(frameSnapshots[frameIndex])
      }
    }));
    const delta = { visibleContentAdvanced: true, candidateRole: 'checkpoint-160' };
    evidenceScenarios.push({
      id: expected.id,
      frames: frames.map((frame) => ({
        artifactPath: frame.path,
        byteLength: frame.byteLength,
        sha256: frame.sha256,
        png
      })),
      computedDelta: delta
    });
    const baseUrl = `http://127.0.0.1:${41000 + scenarioIndex}`;
    return {
      schema: VISUAL_LIVENESS_SCENARIO_SCHEMA,
      id: expected.id,
      label: expected.label,
      url: new URL(expected.url, baseUrl).href,
      status: 'complete',
      durationMs: 70_000,
      initialPresentation: {
        capturedAtMs: 500,
        snapshot: initialPresentationSnapshot
      },
      autoplayStart: {
        mode: VISUAL_LIVENESS_AUTOPLAY_START_MODE,
        startedAtMs: 750
      },
      readiness: {
        readyAtMs: 1_000,
        firstAdvanceAtMs: 1_500,
        initialSnapshot: baseline
      },
      acceptedSampleCount: 8,
      samples: [
        formalSnapshot({ step: 2, milestone: milestoneSource }),
        formalSnapshot({ step: 100, milestone: milestoneSource }),
        finalSnapshot
      ],
      checkpointSnapshots: checkpoints,
      milestone: evaluateVisualLivenessMilestone(expected.id, finalSnapshot),
      sustainedProgress: {
        passed: true,
        physicsStepDelta: 161,
        presentedStepDelta: 160,
        sustainedDurationMs: 60_000,
        checkpointsPassed: true
      },
      frames,
      compositorDelta: delta,
      consoleSummary: { issueCount: 0, pageErrorCount: 0, warningCounts: {} },
      consoleErrors: [],
      requestFailures: [],
      pageCrashes: [],
      browserLaunch: {
        headless: true,
        executablePath: null,
        args: [
          '--enable-unsafe-webgpu',
          '--use-angle=vulkan',
          '--enable-features=Vulkan,UseSkiaRenderer'
        ],
        viewport: { width: 640, height: 480 },
        ignoreHTTPSErrors: true
      },
      ownedServer: {
        ownership: 'owned-process-group-child',
        baseUrl,
        stoppedByScenario: true,
        stopped: true
      },
      supervisor: { exit: { code: 0, signal: null, error: null } },
      cleanup: { stopped: true },
      failure: null,
      artifactDirectory: `/tmp/ulg-formal-${scenarioIndex}`
    };
  });
  return {
    receipt: {
      schema: VISUAL_LIVENESS_RECEIPT_SCHEMA,
      policyId: VISUAL_LIVENESS_POLICY_ID,
      coverage: VISUAL_LIVENESS_COVERAGE,
      status: 'complete',
      durationMs: 280_000,
      deadlines: VISUAL_LIVENESS_LIMITS_MS,
      autoplayStartMode: VISUAL_LIVENESS_AUTOPLAY_START_MODE,
      minimumAdvancementSampleCount: 3,
      maximumCompositorFrameCount: 4,
      sourceFingerprintBefore: fingerprint,
      sourceFingerprintAfter: fingerprint,
      sourceStable: true,
      scenarioCount: 4,
      scenarios,
      failures: []
    },
    fingerprint,
    artifactEvidence: { scenarios: evidenceScenarios }
  };
}

test('visual liveness deadlines are hard ceilings and cannot be extended by env', () => {
  const deadlines = resolveVisualLivenessDeadlines({});
  assert.deepEqual(deadlines, VISUAL_LIVENESS_LIMITS_MS);
  assert.throws(
    () => resolveVisualLivenessDeadlines({
      ULG_VISUAL_LIVENESS_ABSOLUTE_TIMEOUT_MS: '480001'
    }),
    /cannot exceed 480000 ms/
  );
  assert.throws(
    () => resolveVisualLivenessDeadlines({
      ULG_VISUAL_LIVENESS_READINESS_TIMEOUT_MS: '60000',
      ULG_VISUAL_LIVENESS_FIRST_ADVANCE_TIMEOUT_MS: '30000'
    }),
    /must be monotonic/
  );
});

test('bounded standard inventory preserves the worker-owned route while starting paused', () => {
  const scenarios = standardVisualLivenessScenarios();
  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    ['water-cycle', 'iron-ice-quench', 'sodium-water', 'cesium-fluorine']
  );
  for (const scenario of scenarios) {
    const url = new URL(scenario.url, 'https://ulg.invalid');
    assert.equal(url.searchParams.get('residentAuto'), '0');
    assert.equal(url.searchParams.get('residentStepsPerSchedule'), '1');
    assert.equal(url.searchParams.get('residentStepsPerScheduleMax'), '1');
    assert.equal(url.searchParams.get('visualCapture'), '1');
    assert.equal(url.searchParams.get('ss'), '1');
    assert.equal(url.searchParams.get('renderer'), 'native-webgpu');
    assert.equal(
      url.searchParams.get('surfaceDraw'),
      'native-webgpu-surface-consumer'
    );
    assert.equal(
      url.searchParams.get('renderOwnership'),
      'worker-owned-resident-render-producer'
    );
    assert.equal(
      scenario.expectedSurfaceDraw,
      'native-webgpu-surface-consumer'
    );
    assert.equal(
      scenario.expectedRenderOwnership,
      'worker-owned-resident-render-producer'
    );
  }
  const explicitCanonicalInventory = standardVisualLivenessScenarios(
    'water-cycle,iron-ice-quench,sodium-water,cesium-fluorine'
  );
  const inventoryRows = (inventory) => inventory.map(
    ({ id, label, url }) => ({ id, label, url })
  );
  assert.deepEqual(
    inventoryRows(explicitCanonicalInventory),
    inventoryRows(scenarios)
  );
  assert.notDeepEqual(
    inventoryRows(standardVisualLivenessScenarios('water-cycle')),
    inventoryRows(scenarios)
  );
});

test('joint physics and presentation progress is required; RAF/render-only motion is rejected', () => {
  const before = readySnapshot({
    nextStep: 1,
    nextTimeS: 0.001,
    lastResidentCompletionAtMs: 100,
    residentSubmissions: 1,
    renderBridgeFrameCount: 2,
    renderBridgeUpdateCount: 1,
    renderBridgeSubmittedDrawCount: 1,
    renderBridgeSourceResidentNextStep: 1
  });
  const after = readySnapshot({
    nextStep: 2,
    nextTimeS: 0.002,
    lastResidentCompletionAtMs: 200,
    residentSubmissions: 2,
    renderBridgeFrameCount: 3,
    renderBridgeUpdateCount: 2,
    renderBridgeSubmittedDrawCount: 1,
    renderBridgeSourceResidentNextStep: 2
  });
  assert.equal(visualLivenessSnapshotReady(before), true);
  assert.equal(visualLivenessSnapshotAdvanced(before, after), true);
  const stale = readySnapshot({
    ...after,
    staleResidentSubmissions: 1
  });
  assert.equal(visualLivenessSnapshotReady(stale), false);
  assert.equal(visualLivenessSnapshotAdvanced(before, stale), false);
  assert.equal(
    visualLivenessSnapshotAdvanced(
      before,
      readySnapshot({ renderBridgeFrameCount: 20 })
    ),
    false
  );
  assert.equal(
    visualLivenessSnapshotAdvanced(before, {
      ...after,
      renderBridgeSourceResidentNextStep: 0
    }),
    false
  );
  assert.equal(
    visualLivenessSnapshotAdvanced(before, {
      ...after,
      renderBridgeSourceResidentNextStep: 3
    }),
    false
  );
  assert.equal(
    visualLivenessSnapshotAdvanced(before, {
      ...after,
      playbackActive: false,
      playText: 'Play'
    }),
    false
  );
  assert.equal(
    visualLivenessSnapshotReady({ ...before, presentationAdmitted: false }),
    false
  );
  assert.equal(
    visualLivenessSnapshotReady({
      ...before,
      residentPending: { status: 'resident-execution-pending' }
    }),
    false
  );
  assert.equal(
    visualLivenessSnapshotAdvanced(before, {
      ...after,
      residentPending: { status: 'resident-execution-pending' }
    }),
    false
  );
});

test('initial and checkpoint compositor captures require a quiescent stable source', () => {
  const initial = quiescentSnapshot({
    nextStep: 0,
    nextTimeS: 0,
    residentSubmissions: 0,
    renderBridgeFrameCount: 1,
    renderBridgeUpdateCount: 0,
    renderBridgeSubmittedDrawCount: 4,
    renderBridgeSourceResidentNextStep: 0,
    telemetry: null
  });
  assert.equal(visualLivenessInitialPresentationReady(initial), true);
  assert.equal(
    visualLivenessInitialPresentationReady({
      ...initial,
      staleResidentSubmissions: 1
    }),
    false
  );
  assert.equal(
    visualLivenessInitialPresentationReady({
      ...initial,
      playbackActive: true,
      playText: 'Pause'
    }),
    false
  );
  assert.equal(
    visualLivenessInitialPresentationReady({ ...initial, residentPending: {} }),
    false
  );
  assert.equal(
    visualLivenessInitialPresentationReady({
      ...initial,
      pendingPresentationActive: true
    }),
    false
  );
  assert.equal(
    visualLivenessInitialPresentationReady({
      ...initial,
      renderBridgeSourceResidentNextStep: null
    }),
    false
  );
  for (const activeSchedulerState of [
    { renderRefreshActiveCount: 1 },
    { renderRefreshQueuedCount: 1 },
    { candidateValidationActiveCount: 1 },
    { candidateValidationQueuedCount: 1 },
    { postStepPresentationGateActive: true },
    { cameraPresentationRecoveryActive: true },
    { latePresentationRecoveryActive: true }
  ]) {
    assert.equal(
      visualLivenessInitialPresentationReady({
        ...initial,
        ...activeSchedulerState
      }),
      false
    );
  }

  const before = quiescentSnapshot(formalSnapshot({ step: 41 }));
  const after = {
    ...before,
    renderBridgeFrameCount: before.renderBridgeFrameCount + 1,
    renderBridgeUpdateCount: before.renderBridgeUpdateCount + 1
  };
  assert.equal(visualLivenessQuiescentPresentationReady(before), true);
  assert.equal(
    visualLivenessQuiescentSnapshotAdvanced(formalSnapshot({ step: 1 }), before),
    true
  );
  assert.equal(visualLivenessCaptureWindowStable(before, after), true);
  assert.equal(
    visualLivenessQuiescentWindowStable(before, after, {
      elapsedMs: QUIESCENT_CAPTURE_STABILITY_MS - 1
    }),
    false
  );
  assert.equal(
    visualLivenessQuiescentWindowStable(before, after, {
      elapsedMs: QUIESCENT_CAPTURE_STABILITY_MS
    }),
    true
  );
  const latentContinuation = quiescentSnapshot(formalSnapshot({ step: 42 }));
  assert.equal(
    visualLivenessQuiescentPresentationReady(latentContinuation),
    true
  );
  assert.equal(
    visualLivenessQuiescentWindowStable(before, latentContinuation, {
      elapsedMs: QUIESCENT_CAPTURE_STABILITY_MS
    }),
    false
  );
  assert.equal(
    visualLivenessCaptureWindowStable(before, { ...after, nextStep: 42 }),
    false
  );
  assert.equal(
    visualLivenessCaptureWindowStable(before, {
      ...after,
      renderBridgeSourceResidentNextStep: 42
    }),
    false
  );
  assert.equal(
    visualLivenessCaptureWindowStable(before, {
      ...after,
      residentSubmissions: 42
    }),
    false
  );
});

test('quiescent capture wait drains a latent paused continuation before release', async () => {
  let nowMs = 0;
  let sampleCount = 0;
  const beforeTail = quiescentSnapshot(formalSnapshot({
    step: 163,
    presentedStep: 162
  }));
  const afterTail = quiescentSnapshot(formalSnapshot({
    step: 164,
    presentedStep: 162
  }));
  const result = await waitForQuiescentCaptureSnapshot(null, {
    timeoutMs: 2_000,
    sampleSnapshot: async () => {
      sampleCount += 1;
      return sampleCount === 1 ? beforeTail : {
        ...afterTail,
        renderBridgeFrameCount:
          afterTail.renderBridgeFrameCount + sampleCount,
        renderBridgeUpdateCount:
          afterTail.renderBridgeUpdateCount + sampleCount
      };
    },
    sleep: async (ms) => { nowMs += ms; },
    now: () => nowMs
  });
  assert.equal(result.nextStep, 164);
  assert.equal(result.renderBridgeSourceResidentNextStep, 162);
  assert.equal(sampleCount, 7);
});

test('presented-source correlation accepts lagged fresh frames and rejects RAF-only snapshots', () => {
  const step78 = readySnapshot({
    nextStep: 78,
    nextTimeS: 0.078,
    lastResidentCompletionAtMs: 780,
    residentSubmissions: 78,
    renderBridgeFrameCount: 29,
    renderBridgeUpdateCount: 27,
    renderBridgeSubmittedDrawCount: 8,
    renderBridgeSourceResidentNextStep: 78
  });
  const step80Stale = readySnapshot({
    ...step78,
    nextStep: 80,
    nextTimeS: 0.080,
    lastResidentCompletionAtMs: 800,
    residentSubmissions: 80,
    renderBridgeFrameCount: 30
  });
  const step82Presented = readySnapshot({
    ...step80Stale,
    nextStep: 82,
    nextTimeS: 0.082,
    lastResidentCompletionAtMs: 820,
    residentSubmissions: 82,
    renderBridgeUpdateCount: 28,
    renderBridgeSourceResidentNextStep: 81
  });
  const step83Stale = readySnapshot({
    ...step82Presented,
    nextStep: 83,
    nextTimeS: 0.083,
    lastResidentCompletionAtMs: 830,
    residentSubmissions: 83,
    renderBridgeFrameCount: 31
  });
  const step85Presented = readySnapshot({
    ...step83Stale,
    nextStep: 85,
    nextTimeS: 0.085,
    lastResidentCompletionAtMs: 850,
    residentSubmissions: 85,
    renderBridgeUpdateCount: 29,
    renderBridgeSourceResidentNextStep: 84
  });

  assert.equal(visualLivenessSnapshotAdvanced(step78, step80Stale), false);
  assert.equal(visualLivenessSnapshotAdvanced(step78, step82Presented), true);
  assert.equal(visualLivenessSnapshotAdvanced(step82Presented, step83Stale), false);
  assert.equal(visualLivenessSnapshotAdvanced(step82Presented, step85Presented), true);
});

test('each standard scenario has an early route-specific milestone', () => {
  assert.equal(evaluateVisualLivenessMilestone('water-cycle', {
    milestone: { thermalStatus: 'thermal-step-executed', thermalBackend: 'webgpu' }
  }).passed, true);
  assert.equal(evaluateVisualLivenessMilestone('iron-ice-quench', {
    milestone: {
      surfaceStress: {
        schema: 'peercompute.ulg.schroeder-phase-volume-surface-stress-submission.v2',
        status: 'eighteen-pass-central-bond-surface-stress-submitted-unverified',
        submitted: true,
        dispatchCount: 18,
        lifecycleDispatchCount: 21
      }
    }
  }).passed, true);
  assert.equal(evaluateVisualLivenessMilestone('sodium-water', {
    milestone: { productHistory: productHistoryGpuCommit() }
  }).passed, true);
  assert.equal(evaluateVisualLivenessMilestone('sodium-water', {
    milestone: {
      productHistory: productHistoryGpuCommit({
        gridCouplingStatus:
          'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter',
        dispatchMode: 'gpu-authenticated-gas-only-no-mechanics-scatter',
        renderGeneration: 86,
        renderSeal: 54321
      })
    }
  }).passed, true);
  assert.equal(evaluateVisualLivenessMilestone('cesium-fluorine', {
    milestone: {
      productHistory: productHistoryGpuCommit(),
      twoLevelAuthority: 'authoritative',
      twoLevelCommitVerified: true,
      twoLevelFineSubstepCount: 2
    }
  }).passed, true);
  assert.equal(evaluateVisualLivenessMilestone('cesium-fluorine', {
    milestone: {
      productHistory: productHistoryGpuCommit({
        gridCouplingStatus: null,
        countAuthority: null,
        rowCapacity: null,
        countHostKnown: null,
        dispatchMode: null,
        generation: 157,
        renderGeneration: 156,
        renderSeal: 3272804553
      }),
      twoLevelAuthority: 'authoritative',
      twoLevelCommitVerified: true,
      twoLevelFineSubstepCount: 2
    }
  }).passed, true);
  assert.equal(evaluateVisualLivenessMilestone('sodium-water', {
    milestone: {
      productHistory: productHistoryGpuCommit({
        gridCouplingStatus: null,
        countAuthority: null,
        rowCapacity: null,
        countHostKnown: null,
        dispatchMode: null
      })
    }
  }).passed, false);
  assert.equal(evaluateVisualLivenessMilestone('sodium-water', {
    milestone: {
      productEventCount: 131072,
      productHistory: productHistoryGpuCommit({ countHostKnown: true })
    }
  }).passed, false);
  assert.equal(evaluateVisualLivenessMilestone('sodium-water', {
    milestone: {
      productHistory: productHistoryGpuCommit({
        gridCouplingStatus:
          'resident-product-mass-gas-only-certified-no-mechanics-p2g-scatter',
        dispatchMode: 'gpu-authored-indirect-live-count'
      })
    }
  }).passed, false);
});

test('visual success requires 160 correlated presented steps and 60 seconds of sustained progress', () => {
  const baseline = readySnapshot({
    nextStep: 4,
    nextTimeS: 0.004,
    renderBridgeSourceResidentNextStep: 3
  });
  const current = readySnapshot({
    nextStep: 165,
    nextTimeS: 0.165,
    lastResidentCompletionAtMs: 1650,
    residentSubmissions: 165,
    renderBridgeFrameCount: 80,
    renderBridgeUpdateCount: 78,
    renderBridgeSubmittedDrawCount: 8,
    renderBridgeSourceResidentNextStep: 163
  });
  const checkpointSnapshots = VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.map(
    (threshold) => ({ threshold, stepDelta: threshold })
  );
  const baseOptions = {
    baselineSnapshot: baseline,
    currentSnapshot: current,
    firstAdvanceAtMs: 1_000,
    checkpointSnapshots,
    milestonePassed: true
  };
  assert.equal(MIN_SUSTAINED_PRESENTED_STEP_COUNT, 160);
  assert.equal(MIN_SUSTAINED_PROGRESS_MS, 60_000);
  assert.equal(
    VISUAL_LIVENESS_CHECKPOINT_STEP_DELTAS.length + 1,
    MAX_COMPOSITOR_FRAME_COUNT
  );
  assert.equal(evaluateVisualLivenessSustainedProgress({
    ...baseOptions,
    currentAtMs: 60_999
  }).passed, false);
  const accepted = evaluateVisualLivenessSustainedProgress({
    ...baseOptions,
    currentAtMs: 61_000
  });
  assert.equal(accepted.passed, true);
  assert.equal(accepted.physicsStepDelta, 161);
  assert.equal(accepted.presentedStepDelta, 160);
  assert.equal(evaluateVisualLivenessSustainedProgress({
    ...baseOptions,
    currentAtMs: 61_000,
    checkpointSnapshots: checkpointSnapshots.slice(0, 2)
  }).passed, false);
});

test('supervisor timeout evidence retains completed frames and progress checkpoints', () => {
  const partialEvidence = {
    lastSnapshot: readySnapshot({ nextStep: 82 }),
    samples: [readySnapshot({ nextStep: 81 })],
    checkpointSnapshots: [{ threshold: 40, stepDelta: 42 }],
    milestone: { id: 'resident-product-history-gpu-commit', passed: true },
    sustainedProgress: { passed: false, presentedStepDelta: 42 },
    frames: [{ path: '/tmp/frame-00.png', sha256: 'abc' }],
    compositorDelta: { visibleContentAdvanced: true },
    consoleSummary: { issueCount: 0 }
  };
  const failed = timeoutFailure({
    scenario: { id: 'sodium-water', label: 'standard-sodium-water', url: '/demo' },
    type: 'absolute-timeout',
    message: 'bounded',
    startedAtMs: Date.now() - 1_000,
    lastSnapshot: null,
    partialEvidence,
    logs: {},
    artifactDirectory: '/tmp/evidence'
  });
  assert.deepEqual(failed.frames, partialEvidence.frames);
  assert.deepEqual(failed.samples, partialEvidence.samples);
  assert.deepEqual(failed.checkpointSnapshots, partialEvidence.checkpointSnapshots);
  assert.deepEqual(failed.compositorDelta, partialEvidence.compositorDelta);
  assert.equal(failed.artifactDirectory, '/tmp/evidence');
});

test('receipt summary identifies bounded liveness rather than deep science', () => {
  assert.deepEqual(visualLivenessReceiptSummary({
    schema: VISUAL_LIVENESS_RECEIPT_SCHEMA,
    policyId: VISUAL_LIVENESS_POLICY_ID,
    coverage: VISUAL_LIVENESS_COVERAGE,
    status: 'complete',
    scenarios: [{ status: 'complete' }, { status: 'complete' }],
    failures: []
  }), {
    schema: VISUAL_LIVENESS_RECEIPT_SCHEMA,
    status: 'complete',
    policyId: VISUAL_LIVENESS_POLICY_ID,
    coverage: VISUAL_LIVENESS_COVERAGE,
    scenarioCount: 2,
    completeScenarioCount: 2,
    failureCount: 0
  });
});

test('formal bounded visual evaluator accepts only the complete four-demo evidence', () => {
  const fixture = formalReceiptFixture();
  assert.deepEqual(evaluateVisualLivenessReceipt(fixture.receipt, {
    currentFingerprint: fixture.fingerprint,
    artifactEvidence: fixture.artifactEvidence
  }), { passed: true, failures: [] });

  const subset = structuredClone(fixture.receipt);
  subset.scenarios.pop();
  subset.scenarioCount = 3;
  const subsetEvaluation = evaluateVisualLivenessReceipt(subset, {
    currentFingerprint: fixture.fingerprint,
    artifactEvidence: {
      scenarios: fixture.artifactEvidence.scenarios.slice(0, 3)
    }
  });
  assert.equal(subsetEvaluation.passed, false);
  assert.match(subsetEvaluation.failures.join('\n'), /complete four-demo inventory/);
});

test('formal bounded visual evaluator recomputes source, lifecycle, and frame evidence', () => {
  const fixture = formalReceiptFixture();
  for (const mutate of [
    (receipt) => { receipt.sourceFingerprintAfter.sourceFingerprint = 'd'.repeat(64); },
    (receipt) => { receipt.scenarios[0].ownedServer.ownership = 'borrowed'; },
    (receipt) => { receipt.scenarios[0].browserLaunch.headless = false; },
    (receipt) => { receipt.scenarios[0].autoplayStart = null; },
    (receipt) => { receipt.scenarios[0].autoplayStart.startedAtMs = 100; },
    (receipt) => {
      receipt.scenarios[0].initialPresentation.snapshot.playbackActive = true;
    },
    (receipt) => { receipt.scenarios[0].checkpointSnapshots[2].stepDelta = 159; },
    (receipt) => {
      receipt.scenarios[0].readiness.initialSnapshot
        .renderBridgeSourceResidentNextStep = null;
    },
    (receipt) => { receipt.scenarios[0].samples.at(-1).telemetry.readbackBytes = 4; },
    (receipt) => { receipt.scenarios[0].samples.at(-1).telemetry.mapAsyncCount = null; },
    (receipt) => { receipt.scenarios[0].samples.at(-1).telemetry.hostQueueFenceCount = '0'; },
    (receipt) => { receipt.scenarios[0].sustainedProgress.physicsStepDelta += 1; },
    (receipt) => {
      receipt.scenarios[0].frames[1].captureWindow.after.presentedSourceStep += 1;
    },
    (receipt) => { receipt.scenarios[0].frames[1].sha256 = 'e'.repeat(64); }
  ]) {
    const receipt = structuredClone(fixture.receipt);
    mutate(receipt);
    assert.equal(evaluateVisualLivenessReceipt(receipt, {
      currentFingerprint: fixture.fingerprint,
      artifactEvidence: fixture.artifactEvidence
    }).passed, false);
  }
});

test('bounded visual artifact reader rehashes, decodes, and compares compositor PNGs', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'ulg-visual-reader-'));
  const scenarioDirectory = path.join(fixtureRoot, 'water-cycle', 'attempt');
  await mkdir(scenarioDirectory, { recursive: true });
  const roles = ['initial', 'checkpoint-40', 'checkpoint-96', 'checkpoint-160'];
  const frames = [];
  try {
    for (let index = 0; index < roles.length; index += 1) {
      const bytes = visualFixturePng(index);
      const framePath = path.join(
        scenarioDirectory,
        `frame-${String(index).padStart(2, '0')}-${roles[index]}.png`
      );
      await writeFile(framePath, bytes);
      frames.push({
        role: roles[index],
        path: framePath,
        byteLength: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex')
      });
    }
    const evidence = await readVisualLivenessArtifactEvidence({
      receipt: {
        scenarios: [{
          id: 'water-cycle',
          artifactDirectory: scenarioDirectory,
          frames
        }]
      },
      repoDir
    });
    assert.equal(evidence.scenarios[0].frames.length, 4);
    assert.equal(evidence.scenarios[0].frames[0].sha256, frames[0].sha256);
    assert.equal(evidence.scenarios[0].frames[0].png.hasVisibleSurfaceContent, true);
    assert.equal(evidence.scenarios[0].computedDelta.visibleContentAdvanced, true);

    await writeFile(frames[1].path, visualFixturePng(99));
    const changed = await readVisualLivenessArtifactEvidence({
      receipt: {
        scenarios: [{
          id: 'water-cycle',
          artifactDirectory: scenarioDirectory,
          frames
        }]
      },
      repoDir
    });
    assert.notEqual(changed.scenarios[0].frames[1].sha256, frames[1].sha256);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('owned process-group cleanup escalates past an ignored SIGTERM', {
  skip: process.platform === 'win32'
}, async () => {
  const child = spawn(process.execPath, ['-e', [
    "process.on('SIGTERM', () => {});",
    "process.stdout.write('ready\\n');",
    'setInterval(() => {}, 1000);'
  ].join('')], {
    detached: true,
    stdio: ['ignore', 'pipe', 'ignore']
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('fixture child did not become ready')),
        2_000
      );
      child.stdout.once('data', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    const cleanup = await terminateOwnedProcessGroup(child.pid, {
      termGraceMs: 100,
      killGraceMs: 2_000
    });
    assert.equal(cleanup.existed, true);
    assert.equal(cleanup.termSent, true);
    assert.equal(cleanup.killSent, true);
    assert.equal(cleanup.stopped, true);
  } finally {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
  }
});

test('normal visual commands are bounded and legacy campaigns are explicitly named', async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repoDir, 'package.json'), 'utf8')
  );
  assert.equal(
    packageJson.scripts['test:sph-visual'],
    'ULG_VISUAL_MATRIX_SCENARIOS=standard-cesium-fluorine ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 node scripts/sph-visual-sanity-matrix.mjs'
  );
  assert.equal(
    packageJson.scripts['test:sph-standard-visual'],
    'ULG_VISUAL_MATRIX_SCENARIOS=standard-cesium-fluorine ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1 ULG_VISUAL_MATRIX_TIMEOUT_MS=600000 node scripts/sph-visual-sanity-matrix.mjs'
  );
  assert.match(
    packageJson.scripts['test:sph-standard-visual:deep'],
    /sph-visual-sanity-matrix\.mjs/
  );
  assert.match(
    packageJson.scripts['test:sph-visual:sequence'],
    /SPH phase visual sequence/
  );

  const demoSource = await readFile(path.join(repoDir, 'tests/demo.e2e.mjs'), 'utf8');
  assert.match(demoSource, /MAX_SPH_VISUAL_FALLBACK_FRAME_COUNT = 4/);
  assert.match(demoSource, /MAX_SPH_VISUAL_FALLBACK_DURATION_MS = 180_000/);
  assert.match(demoSource, /SPH visual fallback did not advance before frame/);

  const harnessSource = await readFile(
    path.join(repoDir, 'scripts/sph-visual-animation-liveness-receipt.mjs'),
    'utf8'
  );
  assert.match(
    harnessSource,
    /surfaceDraw\?\.surfaceDrawVisibleGpuConsumerReady\s*\n\s*\?\? surfaceDraw\?\.visibleGpuConsumerReady/
  );
  assert.match(
    harnessSource,
    /surfaceDraw\?\.surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted/
  );
  assert.match(harnessSource, /renderBridgeLastRenderStatus/);
  assert.match(harnessSource, /timeout: COMPOSITOR_CAPTURE_TIMEOUT_MS/);
  const matrixMainStart = harnessSource.indexOf('async function matrixMain()');
  const matrixMainEnd = harnessSource.indexOf(
    'export function visualLivenessReceiptSummary',
    matrixMainStart
  );
  assert.notEqual(matrixMainStart, -1);
  assert.notEqual(matrixMainEnd, -1);
  const matrixMainSource = harnessSource.slice(matrixMainStart, matrixMainEnd);
  assert.match(matrixMainSource, /readVisualLivenessArtifactEvidence\(\{/);
  assert.match(matrixMainSource, /evaluateVisualLivenessReceipt\(receipt,/);
  assert.match(matrixMainSource, /formal-evaluation-failed/);
  assert.match(matrixMainSource, /exactStandardScenarioInventory/);
  assert.doesNotMatch(
    matrixMainSource,
    /receipt\.status === 'complete' && scenarioSelection == null/
  );
  assert.doesNotMatch(
    harnessSource,
    /\.(?:mapAsync|getMappedRange|onSubmittedWorkDone)\s*\(/
  );
});
