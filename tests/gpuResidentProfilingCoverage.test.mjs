import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ULG_BENCH_GPU_PROFILE = '1';
const {
  gpuTimestampStageCoverage,
  nativeSurfacePresentationSequenceGate,
  scenarioPerformanceGate
} = await import(`../scripts/sph-performance-benchmark.mjs?profiling-test=${Date.now()}`);
const { analyzeTimeline } = await import(
  `../scripts/sph-long-horizon-probe.mjs?surface-gate-test=${Date.now()}`
);

function profile(spans) {
  return {
    status: 'timestamp-profile-complete',
    validSpanCount: spans.length,
    spans: spans.map((span) => ({ valid: true, ...span })),
    stageTotals: Object.fromEntries(spans.map(({ label }) => [label, {
      validSpanCount: 1,
      totalMs: 0.1
    }]))
  };
}

function nativeSurfaceInterval({
  batchIndex,
  reused,
  reuseCount,
  extractionAllowed,
  cacheHit = null,
  cacheHitCount = null,
  cacheMissCount = null,
  cacheReleaseCount = null,
  generationId = 1,
  replaceCount = 0,
  visiblePointsObjectCount = 0,
  pointPresentationActive = false
}) {
  return {
    batchIndex,
    phase: batchIndex === 0 ? 'initial' : 'resident-batch',
    nativeSurfacePresentation: {
      schema: 'peercompute.ulg.sph-native-surface-presentation-interval.v0',
      status: 'native-triangle-presentation-ready',
      connectedCanvasCount: 1,
      visibleCanvasCount: 1,
      nativeCanvasConnected: true,
      nativeCanvasIsOnlyConnectedCanvas: true,
      rendererBridge: 'native-webgpu-surface-consumer',
      visibleRenderSource: 'resident-surface-draw-native-webgpu-consumer',
      engineIntegration: 'native-webgpu-engine-main-canvas-no-overlay',
      nativeMainThreadBridge: true,
      visiblePointsObjectCount,
      visiblePointsObjectNames: [],
      pointPresentationActive,
      particleRenderMode: null,
      triangleCount: 24,
      triangleCountSource: 'active-native-surface-execution',
      indirectDrawBufferBound: true,
      compactPositionBufferBound: true,
      compactPositionBufferByteLength: 1152,
      compactPositionSurfaceGeneration: generationId,
      packedNormalBufferBound: true,
      packedNormalBufferByteLength: 288,
      packedNormalRowCount: 72,
      packedNormalSurfaceGeneration: generationId,
      packedNormalGenerationMatchesPosition: true,
      packedNormalAdditionalSubmitCount: 0,
      surfaceAlphaMode: 'opaque',
      surfaceBlendEnabled: false,
      surfaceDepthWriteEnabled: true,
      transparencyCompositeMode: 'disabled-opaque-pbr',
      oitTargetsReady: false,
      lastOpaqueDrawCount: 1,
      lastRefractiveDrawCount: 0,
      lastTransparentDrawCount: 0,
      quantumSpectralRefractionRequired: true,
      opticalRecordCount: 1,
      opticalSpectralSampleCount: 3,
      opticalQuantumRefractiveAuthorityRecordCount: 1,
      opticalQuantumRefractiveSpectralSampleCount: 3,
      opticalQuantumRefractiveProvenanceSources: [
        'rhf-dipole-response-plus-lorentz-lorenz-local-field'
      ],
      refractionBackfaceStatus: 'native-refractive-backface-depth-not-required',
      refractionBackfaceDepthFormat: 'depth32float',
      refractionBackfaceByteLength: 0,
      refractionBackfaceCacheHit: false,
      refractionBackfacePassDrawCount: 0,
      refractionBackfaceAdditionalSubmitCount: 0,
      refractionTargetSetActive: false,
      refractionTargetGeneration: null,
      refractionTargetWidth: 0,
      refractionTargetHeight: 0,
      refractionTargetLifecycleStatus: 'opaque-no-targets',
      refractionTargetRetirementPendingCount: 0,
      refractionTargetRetirementCount: 0,
      sceneBackgroundImageUrl: null,
      backgroundImageGpuStatus: null,
      backgroundImageDrawn: false,
      backgroundImageDrawCount: 0,
      backgroundImageTextureWidth: 0,
      backgroundImageTextureHeight: 0,
      nativeSurfaceConsumerFramePacing: 'bounded-in-flight-submissions',
      nativeSurfaceConsumerInFlightSubmitCount: 1,
      nativeSurfaceConsumerInFlightSubmitPeak: 2,
      nativeSurfaceConsumerMaxInFlightSubmits: 2,
      nativeSurfaceResourceGeneration: generationId,
      workerPresentationAbsent: true,
      workerResidentStageChainAbsent: true,
      sparseRuntimePool: {
        schema: 'peercompute.ulg.sph-resident-sparse-render-field-runtime-pool.v0',
        status: reused
          ? 'sparse-render-field-runtime-pool-reused'
          : (replaceCount > 0
              ? 'sparse-render-field-runtime-pool-replaced'
              : 'sparse-render-field-runtime-pool-created'),
        generationId,
        reused,
        reuseCount,
        createCount: replaceCount + 1,
        replaceCount,
        lastReason: replaceCount > 0 ? 'capacity changed' : null
      },
      marchingCubes: {
        extractionAllowed,
        extractionStatus: extractionAllowed
          ? 'extension-surface-ready-needs-ulg-row-translation'
          : 'native-marching-cubes-render-field-extraction-skipped',
        extractionReason: extractionAllowed ? null : 'retained previous native surface',
        extractionElapsedMs: extractionAllowed ? 1.5 : null,
        extensionExecutionElapsedMs: extractionAllowed ? 0.5 : null,
        totalElapsedMs: extractionAllowed ? 2 : null,
        cacheStatus: extractionAllowed ? 'native-marching-cubes-adapter-cache-hit' : null,
        cacheReason: null,
        cacheHit,
        cacheEntryCount: extractionAllowed ? 3 : null,
        cacheHitCount,
        cacheMissCount,
        cacheReleaseCount
      }
    }
  };
}

function validNativeSurfaceTimeline() {
  return {
    status: 'complete',
    surfaceDrawDiagnosticMode: 'native-webgpu-surface-consumer',
    metrics: [
      nativeSurfaceInterval({
        batchIndex: 0,
        reused: false,
        reuseCount: 0,
        extractionAllowed: true,
        cacheHit: true,
        cacheHitCount: 1,
        cacheMissCount: 3,
        cacheReleaseCount: 0
      }),
      nativeSurfaceInterval({
        batchIndex: 1,
        reused: true,
        reuseCount: 1,
        extractionAllowed: false
      }),
      nativeSurfaceInterval({
        batchIndex: 2,
        reused: true,
        reuseCount: 2,
        extractionAllowed: true,
        cacheHit: true,
        cacheHitCount: 2,
        cacheMissCount: 3,
        cacheReleaseCount: 0
      })
    ]
  };
}

test('required timestamp coverage matches exact labels and nested-stage metadata', () => {
  const coverage = gpuTimestampStageCoverage([profile([
    { label: 'residentNeighborhoodKeyBuild', metadata: { residentNeighborhoodStage: 'key-build' } },
    { label: 'radix-pass-0', metadata: { residentNeighborhoodStage: 'cell-sort-unique' } }
  ])], [
    { id: 'neighbor-key', label: 'residentNeighborhoodKeyBuild' },
    { id: 'neighbor-radix', metadata: { residentNeighborhoodStage: 'cell-sort-unique' } }
  ]);
  assert.equal(coverage.status, 'required-gpu-stages-attributed');
  assert.deepEqual(coverage.missingStageIds, []);
});

test('supported profiling fails the performance gate when an active named stage is absent', () => {
  const residentProfile = profile([{ label: 'p2gGridProjection', metadata: {} }]);
  const coverage = gpuTimestampStageCoverage([residentProfile], [
    { id: 'resident-p2g', label: 'p2gGridProjection' },
    { id: 'resident-grid-update', label: 'gridUpdate' }
  ]);
  assert.equal(coverage.status, 'required-gpu-stages-missing');
  assert.deepEqual(coverage.missingStageIds, ['resident-grid-update']);
  const gate = scenarioPerformanceGate({
    residentGpuCompletedStageMs: 0.1,
    residentStageStepsPerSecond: 10_000,
    estimatedReadbackBytesPerStep: 0,
    activeGridDispatch: { useActiveGrid: true },
    residentStageTiming: { queueFenceStatus: { fusedMechanicsSequence: 'complete' } },
    residentGpuTimestampProfile: residentProfile,
    requiredGpuTimestampCoverage: coverage
  });
  assert.equal(gate.status, 'fail');
  assert.ok(gate.blockers.includes('required-gpu-timestamp-stages-missing'));
  assert.deepEqual(gate.observed.missingGpuTimestampStageIds, ['resident-grid-update']);
});

test('unsupported timestamp devices remain inconclusive instead of using host timing', () => {
  const unsupported = { status: 'unsupported', requested: true, spans: [], validSpanCount: 0 };
  const coverage = gpuTimestampStageCoverage([unsupported], [
    { id: 'resident-p2g', label: 'p2gGridProjection' }
  ]);
  assert.equal(coverage.status, 'inconclusive-unsupported');
  const gate = scenarioPerformanceGate({
    residentGpuCompletedStageMs: null,
    residentStageStepsPerSecond: null,
    estimatedReadbackBytesPerStep: 0,
    activeGridDispatch: { useActiveGrid: true },
    residentStageTiming: { queueFenceStatus: {} },
    residentGpuTimestampProfile: unsupported,
    requiredGpuTimestampCoverage: coverage
  });
  assert.equal(gate.status, 'inconclusive-unsupported');
  assert.ok(gate.blockers.includes('gpu-timestamps-unsupported'));
  assert.equal(gate.blockers.includes('required-gpu-timestamp-stages-missing'), false);
});

test('native surface sequence gate requires one canvas, triangles, no Points, and stable GPU caches', () => {
  const gate = nativeSurfacePresentationSequenceGate(validNativeSurfaceTimeline());
  assert.equal(gate.status, 'pass');
  assert.equal(gate.intervalCount, 3);
  assert.equal(gate.extractionIntervalCount, 2);
  assert.deepEqual(gate.poolGenerationIds, [1]);
  assert.equal(gate.cacheMissDelta, 0);
  assert.equal(gate.cacheReleaseDelta, 0);
  assert.deepEqual(gate.extractionElapsedMsSeries, [1.5, 1.5]);
});

test('native surface sequence cannot pass with Points or incomplete interval evidence', () => {
  const pointsTimeline = validNativeSurfaceTimeline();
  pointsTimeline.metrics[1] = nativeSurfaceInterval({
    batchIndex: 1,
    reused: true,
    reuseCount: 1,
    extractionAllowed: false,
    visiblePointsObjectCount: 1,
    pointPresentationActive: true
  });
  const pointsGate = nativeSurfacePresentationSequenceGate(pointsTimeline);
  assert.equal(pointsGate.status, 'fail');
  assert.ok(pointsGate.blockers.includes('native-surface-points-visible'));

  const alphaTimeline = validNativeSurfaceTimeline();
  alphaTimeline.metrics[1].nativeSurfacePresentation.surfaceBlendEnabled = true;
  alphaTimeline.metrics[1].nativeSurfacePresentation.lastTransparentDrawCount = 1;
  const alphaGate = nativeSurfacePresentationSequenceGate(alphaTimeline);
  assert.equal(alphaGate.status, 'fail');
  assert.ok(alphaGate.blockers.includes('native-surface-opaque-pbr-contract-invalid'));

  const normalTimeline = validNativeSurfaceTimeline();
  normalTimeline.metrics[1].nativeSurfacePresentation.packedNormalRowCount = 23;
  normalTimeline.metrics[1].nativeSurfacePresentation.packedNormalGenerationMatchesPosition = false;
  const normalGate = nativeSurfacePresentationSequenceGate(normalTimeline);
  assert.equal(normalGate.status, 'fail');
  assert.ok(normalGate.blockers.includes('native-surface-packed-normal-prefix-missing'));
  assert.ok(normalGate.blockers.includes('native-surface-packed-normal-generation-invalid'));

  const refractionTimeline = validNativeSurfaceTimeline();
  refractionTimeline.metrics[1].nativeSurfacePresentation.lastOpaqueDrawCount = 0;
  refractionTimeline.metrics[1].nativeSurfacePresentation.lastRefractiveDrawCount = 1;
  refractionTimeline.metrics[1].nativeSurfacePresentation.opticalQuantumRefractiveAuthorityRecordCount = 0;
  refractionTimeline.metrics[1].nativeSurfacePresentation.opticalQuantumRefractiveProvenanceSources = [];
  const refractionGate = nativeSurfacePresentationSequenceGate(refractionTimeline);
  assert.equal(refractionGate.status, 'fail');
  assert.ok(refractionGate.blockers.includes('native-surface-quantum-refraction-authority-missing'));

  const thicknessTimeline = validNativeSurfaceTimeline();
  thicknessTimeline.metrics[1].nativeSurfacePresentation.lastOpaqueDrawCount = 0;
  thicknessTimeline.metrics[1].nativeSurfacePresentation.lastRefractiveDrawCount = 1;
  thicknessTimeline.metrics[1].nativeSurfacePresentation.refractionBackfaceStatus =
    'native-refractive-backface-depth-not-required';
  thicknessTimeline.metrics[1].nativeSurfacePresentation.refractionBackfaceByteLength = 0;
  thicknessTimeline.metrics[1].nativeSurfacePresentation.refractionBackfaceCacheHit = false;
  const thicknessGate = nativeSurfacePresentationSequenceGate(thicknessTimeline);
  assert.equal(thicknessGate.status, 'fail');
  assert.ok(
    thicknessGate.blockers.includes('native-surface-geometric-refraction-thickness-missing')
  );

  const opaqueAllocationTimeline = validNativeSurfaceTimeline();
  opaqueAllocationTimeline.metrics[1].nativeSurfacePresentation.refractionBackfaceStatus =
    'native-refractive-backface-depth-cache-hit';
  opaqueAllocationTimeline.metrics[1].nativeSurfacePresentation.refractionBackfaceByteLength = 4096;
  opaqueAllocationTimeline.metrics[1].nativeSurfacePresentation.refractionBackfaceCacheHit = true;
  opaqueAllocationTimeline.metrics[1].nativeSurfacePresentation.refractionTargetSetActive = true;
  opaqueAllocationTimeline.metrics[1].nativeSurfacePresentation.refractionTargetWidth = 32;
  opaqueAllocationTimeline.metrics[1].nativeSurfacePresentation.refractionTargetHeight = 32;
  const opaqueAllocationGate = nativeSurfacePresentationSequenceGate(opaqueAllocationTimeline);
  assert.equal(opaqueAllocationGate.status, 'fail');
  assert.ok(
    opaqueAllocationGate.blockers.includes('native-surface-opaque-refraction-target-allocation')
  );

  const backgroundTimeline = validNativeSurfaceTimeline();
  backgroundTimeline.metrics[1].nativeSurfacePresentation.sceneBackgroundImageUrl =
    '/plan/background-1.jpg';
  backgroundTimeline.metrics[1].nativeSurfacePresentation.backgroundImageGpuStatus =
    'native-opaque-background-image-ready';
  const backgroundGate = nativeSurfacePresentationSequenceGate(backgroundTimeline);
  assert.equal(backgroundGate.status, 'fail');
  assert.ok(backgroundGate.blockers.includes('native-surface-opaque-background-image-missing'));

  const incompleteTimeline = validNativeSurfaceTimeline();
  delete incompleteTimeline.metrics[1].nativeSurfacePresentation;
  const incompleteGate = nativeSurfacePresentationSequenceGate(incompleteTimeline);
  assert.equal(incompleteGate.status, 'fail');
  assert.ok(incompleteGate.blockers.includes('native-surface-presentation-evidence-incomplete'));

  const analysis = analyzeTimeline(incompleteTimeline, { visualOnly: true });
  assert.equal(analysis.status, 'bad');
  assert.ok(analysis.issues.includes('native-surface-presentation-evidence-incomplete'));
});

test('native surface sequence accepts one exact refractive target set and rejects opaque retention', () => {
  const refractiveTimeline = validNativeSurfaceTimeline();
  const interval = refractiveTimeline.metrics[1].nativeSurfacePresentation;
  interval.lastOpaqueDrawCount = 0;
  interval.lastRefractiveDrawCount = 1;
  interval.refractionBackfaceStatus = 'native-refractive-backface-depth-rendered';
  interval.refractionBackfaceByteLength = 4096;
  interval.refractionBackfaceCacheHit = false;
  interval.refractionBackfacePassDrawCount = 1;
  interval.refractionTargetSetActive = true;
  interval.refractionTargetGeneration = 2;
  interval.refractionTargetWidth = 32;
  interval.refractionTargetHeight = 32;
  interval.refractionTargetLifecycleStatus = 'target-set-created';
  assert.equal(nativeSurfacePresentationSequenceGate(refractiveTimeline).status, 'pass');

  interval.lastOpaqueDrawCount = 1;
  interval.lastRefractiveDrawCount = 0;
  const retainedOpaqueGate = nativeSurfacePresentationSequenceGate(refractiveTimeline);
  assert.equal(retainedOpaqueGate.status, 'fail');
  assert.ok(
    retainedOpaqueGate.blockers.includes('native-surface-opaque-refraction-target-allocation')
  );
});

test('native pool or marching-cubes cache churn blocks the performance pass', () => {
  const timeline = validNativeSurfaceTimeline();
  timeline.metrics[2] = nativeSurfaceInterval({
    batchIndex: 2,
    reused: false,
    reuseCount: 1,
    extractionAllowed: true,
    cacheHit: false,
    cacheHitCount: 1,
    cacheMissCount: 4,
    cacheReleaseCount: 3,
    generationId: 2,
    replaceCount: 1
  });
  const nativeGate = nativeSurfacePresentationSequenceGate(timeline);
  assert.equal(nativeGate.status, 'fail');
  assert.ok(nativeGate.blockers.includes('native-surface-sparse-runtime-pool-replaced'));
  assert.ok(nativeGate.blockers.includes('native-surface-marching-cubes-cache-miss-increased'));
  assert.ok(nativeGate.blockers.includes('native-surface-marching-cubes-cache-release-increased'));
  assert.ok(nativeGate.blockers.includes('native-surface-final-marching-cubes-cache-hit-missing'));

  const residentProfile = profile([{ label: 'p2gGridProjection', metadata: {} }]);
  const performanceGate = scenarioPerformanceGate({
    residentGpuCompletedStageMs: 0.1,
    residentStageStepsPerSecond: 10_000,
    estimatedReadbackBytesPerStep: 0,
    activeGridDispatch: { useActiveGrid: true },
    residentStageTiming: { queueFenceStatus: { fusedMechanicsSequence: 'complete' } },
    residentGpuTimestampProfile: residentProfile,
    nativeSurfacePresentationGate: nativeGate
  });
  assert.equal(performanceGate.status, 'fail');
  assert.ok(performanceGate.blockers.includes('native-surface-presentation-sequence-failed'));
});
