import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SPH_PROBE_DURABLE_RELEASE_PUBLICATION_ENV,
  analyzeTimeline,
  durableProbeReleasePublicationEnabled,
  persistCapturedFrames,
  publishProbeReleaseArtifact
} from '../scripts/sph-long-horizon-probe.mjs';

function nativePresentationMetric(nativeSurfaceValidation) {
  return {
    sceneTimeS: 0.01,
    nativeSurfaceValidation,
    renderState: {
      source: 'resident-gpu-render-field',
      status: 'resident-surface-draw-buffers-retained',
      surfaceDrawGpuBufferHandoffReady: true,
      surfaceDrawVisibleGpuConsumerReady: true,
      surfaceDrawVisibleGpuConsumerRuntimePresentationAdmitted: true,
      surfaceDrawVisibleGpuConsumerForegroundProofValidated: true,
      surfaceDrawVisibleRendererBridge: 'native-webgpu-surface-consumer',
      surfaceDrawVisibleRenderSource:
        'resident-surface-draw-native-webgpu-consumer',
      surfaceDrawRenderBridgeStatus:
        'native-webgpu-surface-consumer-ready',
      surfaceDrawRenderBridgeLastRenderStatus:
        'native-webgpu-surface-consumer-rendered',
      surfaceDrawActiveSurfaceCount: 1,
      surfaceDrawVertexCount: 3
    }
  };
}

test('timeline analysis separates native presentation admission from foreground proof', () => {
  const timeline = {
    probeMode: 'scene',
    surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
    renderReadbackMode: 'no-full-readback',
    renderFieldSurfaceSummaryMode: 'skip',
    metrics: [nativePresentationMetric({
      sourceCurrent: true,
      admitted: true,
      runtimePresentationAdmitted: true,
      foregroundProved: false,
      foregroundProofValidated: false
    })]
  };
  const admittedOnly = analyzeTimeline(timeline);
  assert.equal(admittedOnly.residentSurfacePresentationAdmissionSampleCount, 1);
  assert.equal(admittedOnly.residentSurfacePresentationAdmissionAccepted, true);
  assert.equal(admittedOnly.nativeWebGpuSurfaceConsumerAccepted, true);
  assert.equal(admittedOnly.residentSurfaceForegroundProofSampleCount, 0);
  assert.equal(admittedOnly.residentSurfaceForegroundProofAccepted, false);
  assert.equal(admittedOnly.residentSurfaceVisibleGpuConsumerAccepted, false);

  timeline.metrics[0].nativeSurfaceValidation = {
    ...timeline.metrics[0].nativeSurfaceValidation,
    foregroundProved: true,
    foregroundProofValidated: true
  };
  const foregroundProved = analyzeTimeline(timeline);
  assert.equal(foregroundProved.residentSurfacePresentationAdmissionSampleCount, 1);
  assert.equal(foregroundProved.residentSurfaceForegroundProofSampleCount, 1);
  assert.equal(foregroundProved.residentSurfaceForegroundProofAccepted, true);
  assert.equal(foregroundProved.residentSurfaceVisibleGpuConsumerAccepted, true);
});

test('timeline analysis accepts browser-proved native surfaces without demanding H2O from non-water scenarios', () => {
  const nativeBrowserProof = {
    probeMode: 'scene',
    surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
    renderReadbackMode: 'auto',
    renderFieldSurfaceSummaryMode: 'auto',
    nativeSurfaceBrowserFrameValidation: {
      status: 'passed',
      publishStatus: {
        status: 'browser-frame-validation-passed',
        source: 'playwright-canvas-center-crop',
        nonzeroPixelCount: 128,
        resourceGeneration: 7
      }
    },
    metrics: [{
      surfaceDraw: {
        surfaceDrawVisibleGpuConsumerNativeActiveResourceGeneration: 7
      }
    }]
  };
  const scenarioUrl = '/?drop=Na&base=F&dropt=293.15&baset=293.15';
  const analysis = analyzeTimeline(nativeBrowserProof, {
    scenarioUrl,
    visualOnly: true
  });

  assert.equal(analysis.nativeBrowserFramePixelValidated, true);
  assert.equal(analysis.issues.includes('no-visible-surface-samples'), false);
  assert.equal(analysis.issues.includes('no-visible-h2o-surface-samples'), false);

  const nonWaterWithoutProof = analyzeTimeline({
    probeMode: 'scene',
    metrics: []
  }, {
    scenarioUrl,
    visualOnly: true
  });
  assert.equal(nonWaterWithoutProof.issues.includes('no-visible-surface-samples'), true);
  assert.equal(nonWaterWithoutProof.issues.includes('no-visible-h2o-surface-samples'), false);

  const waterWithoutProof = analyzeTimeline({
    probeMode: 'scene',
    metrics: []
  }, {
    scenarioUrl: '/?drop=h2o&base=h2o&dropt=293.15&baset=293.15',
    visualOnly: true
  });
  assert.equal(waterWithoutProof.issues.includes('no-visible-h2o-surface-samples'), true);

  const mixedColdWaterWithoutProof = analyzeTimeline({
    probeMode: 'scene',
    metrics: []
  }, {
    scenarioUrl: '/?drop=fe&base=h2o&baset=233.15',
    visualOnly: true
  });
  assert.equal(
    mixedColdWaterWithoutProof.issues.includes('no-visible-h2o-surface-samples'),
    true
  );

  const canonicalNonWaterBodiesWithoutProof = analyzeTimeline({
    probeMode: 'scene',
    metrics: []
  }, {
    scenarioUrl: `/?bodies=${encodeURIComponent(JSON.stringify({
      schema: 'peercompute.ulg.sph-initial-bodies.v0',
      bodies: [
        { id: 'base', material: 'F' },
        { id: 'drop', material: 'Na' }
      ]
    }))}`,
    visualOnly: true
  });
  assert.equal(
    canonicalNonWaterBodiesWithoutProof.issues.includes('no-visible-h2o-surface-samples'),
    false
  );
});

test('timeline analysis derives authoritative global motion across material phase changes', () => {
  const checkpoint = ({ sourceTimeS, rows }) => ({
    status: 'captured',
    sourceTimeS,
    materialPhaseCapacityStatus: 'within-capacity',
    materialMappingStatus: 'complete',
    phaseFractionProblemParticleCount: 0,
    unclassifiedMassKg: 0,
    mechanicsEvidenceStatus: 'complete',
    speedEvidenceStatus: 'complete',
    materialPhases: rows.map((row) => ({
      ...row,
      maxSpeedMPerS: 0,
      mechanicsSampleCount: 1,
      mechanicsProblemParticleCount: 0
    }))
  });
  const timeline = {
    probeMode: 'scene',
    compactSummaryMode: 'none',
    metrics: [
      {
        phase: 'initial',
        sceneTimeS: 0,
        authoritativeGpuCheckpoint: checkpoint({
          sourceTimeS: 0,
          rows: [
            { material: 'A', phase: 'solid', massKg: 2, yCenterMassWeightedM: 1 },
            { material: 'B', phase: 'gas', massKg: 1, yCenterMassWeightedM: 4 }
          ]
        })
      },
      {
        phase: 'resident-batch',
        sceneTimeS: 0.5,
        authoritativeGpuCheckpoint: checkpoint({
          sourceTimeS: 0.5,
          rows: [
            { material: 'A', phase: 'liquid', massKg: 1, yCenterMassWeightedM: 2 },
            { material: 'C', phase: 'solid', massKg: 2, yCenterMassWeightedM: 5 }
          ]
        })
      }
    ]
  };

  const analysis = analyzeTimeline(timeline);
  assert.equal(analysis.authoritativeCheckpointMotionEvidenceAvailable, true);
  assert.equal(analysis.authoritativeCheckpointMotionSampleCount, 2);
  assert.deepEqual(analysis.authoritativeCheckpointGlobalMassWeightedYSeriesM, [2, 4]);
  assert.equal(analysis.authoritativeCheckpointMaxGlobalYDisplacementM, 2);
  assert.equal(analysis.authoritativeCheckpointEstimatedMaxGlobalYSpeedMPerS, 4);
  assert.equal(analysis.motionMaxDisplacementObservedM, 2);
  assert.equal(analysis.motionMaxSpeedObservedMPerS, 4);
  assert.equal(
    analysis.motionSpeedEvidenceSource,
    'authoritative-gpu-material-phase-checkpoint+authoritative-gpu-global-mass-weighted-y-checkpoint'
  );
  assert.equal(
    analysis.motionDisplacementEvidenceSource,
    'authoritative-gpu-global-mass-weighted-y-checkpoint'
  );
  assert.equal(analysis.issues.includes('missing-resident-diagnostics'), false);
  assert.equal(analysis.issues.includes('missing-max-speed'), false);
  assert.equal(analysis.issues.includes('no-positive-displacement'), false);
});

function capturedFrame(bytes) {
  return {
    status: 'captured',
    batchIndex: 1,
    phase: 'release-proof',
    dataUrl: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
  };
}

test('durable release publication is explicit and preserves ordinary probe overwrite behavior', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ulg-probe-publication-'));
  try {
    const repoDir = path.join(root, 'repo');
    const legacyFrameDir = path.join(repoDir, 'legacy-frames');
    await mkdir(repoDir, { recursive: true });

    assert.equal(durableProbeReleasePublicationEnabled('1'), true);
    assert.equal(durableProbeReleasePublicationEnabled('true'), false);
    assert.equal(
      SPH_PROBE_DURABLE_RELEASE_PUBLICATION_ENV,
      'ULG_PROBE_DURABLE_RELEASE_PUBLICATION'
    );

    const firstLegacy = await persistCapturedFrames({
      frames: [capturedFrame('legacy-first')],
      frameDir: legacyFrameDir
    });
    const legacyPath = firstLegacy.frames[0].path;
    await persistCapturedFrames({
      frames: [capturedFrame('legacy-second')],
      frameDir: legacyFrameDir
    });
    assert.deepEqual(await readFile(legacyPath), Buffer.from('legacy-second'));

    const releaseDir = path.join(root, 'release');
    const outputPath = path.join(releaseDir, 'probe.json');
    const outputBytes = Buffer.from('{"status":"complete"}\n', 'utf8');
    await publishProbeReleaseArtifact({
      artifactPath: outputPath,
      repoDir,
      bytes: outputBytes,
      label: 'test durable JSON output'
    });
    const outputStat = await lstat(outputPath);
    const releaseStat = await lstat(releaseDir);
    assert.equal(outputStat.mode & 0o777, 0o600);
    assert.equal(releaseStat.mode & 0o777, 0o700);
    assert.deepEqual(await readFile(outputPath), outputBytes);
    await assert.rejects(
      publishProbeReleaseArtifact({
        artifactPath: outputPath,
        repoDir,
        bytes: Buffer.from('replacement', 'utf8'),
        label: 'test durable JSON output'
      }),
      /already exists and will not be replaced/
    );
    assert.deepEqual(await readFile(outputPath), outputBytes);

    const durableFrameDir = path.join(releaseDir, 'frames');
    const durableFrames = await persistCapturedFrames({
      frames: [capturedFrame('durable-png-bytes')],
      frameDir: durableFrameDir,
      repoDir,
      durableReleasePublication: true
    });
    const durableFramePath = durableFrames.frames[0].path;
    const frameStat = await lstat(durableFramePath);
    const frameParentStat = await lstat(durableFrameDir);
    assert.equal(frameStat.mode & 0o777, 0o600);
    assert.equal(frameParentStat.mode & 0o777, 0o700);
    assert.deepEqual(await readFile(durableFramePath), Buffer.from('durable-png-bytes'));
    await assert.rejects(
      persistCapturedFrames({
        frames: [capturedFrame('replacement-png-bytes')],
        frameDir: durableFrameDir,
        repoDir,
        durableReleasePublication: true
      }),
      /already exists and will not be replaced/
    );
    assert.deepEqual(await readFile(durableFramePath), Buffer.from('durable-png-bytes'));

    await assert.rejects(
      publishProbeReleaseArtifact({
        artifactPath: path.join(repoDir, 'unsafe.json'),
        repoDir,
        bytes: Buffer.from('unsafe', 'utf8')
      }),
      /outside the repository/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
