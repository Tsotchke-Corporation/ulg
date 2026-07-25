import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  groupedPlacedReactionEventCount,
  groupedReactionEventCount,
  reactionLedgerEventCount,
  reactionProgressEventCount
} from '../scripts/sph-probe-reaction-evidence.mjs';
import {
  summarizeNativeSurfaceIndirectArgsReadback
} from '../scripts/sph-native-indirect-evidence.mjs';
import { validateAuthoritativeGpuUploadPair } from '../scripts/sph-authoritative-gpu-checkpoint.mjs';
import {
  createLatestSceneRefreshRequestGate,
  createResidentGpuArtifactRetirementBarrier,
  resolveSphMaterialInterfacePreIntegrationProvenance,
  resolveSphNativeSurfaceDiagnosticDrawPlan,
  runSphNativeSurfaceCandidateValidationTransaction
} from '../src/visualization/sphPhaseScene.js';
import {
  createBrowserConsoleCapture
} from '../scripts/sph-long-horizon-probe.mjs';
import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

function readRepoFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function materialInterfacePreIntegrationFixture() {
  const stateBuffer = { label: 'sph-state' };
  const thermoBuffer = { label: 'sph-thermo' };
  const identityBuffer = { label: 'sph-identity' };
  const mechanicsBuffer = { label: 'mls-mpm-mechanics' };
  const sphParticleState = {
    schema: 'peercompute.ulg.sph-gpu-particle-buffer.v1',
    particleCount: 4,
    step: 17,
    physicsSubstep: 2,
    storageGeneration: 9,
    positionEpoch: 17,
    topologyEpoch: 3,
    chartEpoch: 5,
    levelEpoch: 17,
    supportEpoch: 17
  };
  const mlsMpmParticleState = {
    schema: 'peercompute.ulg.mls-mpm-gpu-particle-buffer.v1',
    particleCount: 4,
    step: 17,
    physicsSubstep: 2,
    storageGeneration: 9
  };
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 4,
    storageGeneration: 9,
    positionEpoch: 17,
    topologyEpoch: 3,
    chartEpoch: 5,
    levelEpoch: 17,
    supportEpoch: 17,
    stateBuffer,
    thermoBuffer,
    identityBuffer
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 4,
    storageGeneration: 9,
    mechanicsBuffer
  };
  return {
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    mechanicsBuffer
  };
}

test('native WebGPU probe and benchmark flatten validation scope diagnostics', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const fields = [
    'surfaceDrawRenderBridgeNativeSurfaceValidationScope',
    'surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationEligible',
    'surfaceDrawRenderBridgeNativeSurfaceOffscreenValidationSkippedReason'
  ];

  for (const field of fields) {
    assert.match(probeSource, new RegExp(`${field}:`));
    assert.match(benchmarkSource, new RegExp(`${field},`));
  }

  assert.match(probeSource, /validationScope,/);
  assert.match(probeSource, /offscreenValidationEligible,/);
  assert.match(probeSource, /offscreenValidationSkippedReason,/);
  assert.match(probeSource, /nativeSurfaceValidation: nativeSurfaceValidationSnapshot\(\)/);
  assert.match(
    probeSource,
    /sphNativeSurfaceCandidateValidationScheduler[\s\S]*?candidateValidationSchedulerActiveCount[\s\S]*?candidateValidationSchedulerQueuedCount/,
    'the probe must observe detached candidate validation instead of accepting the ready prior bridge'
  );
  assert.match(
    probeSource,
    /const sourceCurrent = Boolean\([\s\S]*?sourceGenerationMatchesCurrent === true[\s\S]*?!sourceRetainedPrevious[\s\S]*?!sourceMarkedStale[\s\S]*?const ready = Boolean\(!candidateValidationPending && sourceCurrent[\s\S]*?const pending = Boolean\([\s\S]*?candidateValidationPending/,
    'a retained or marked-stale prior bridge cannot settle the current candidate checkpoint'
  );
  assert.match(
    probeSource,
    /sph-long-horizon-probe-initial-render-refresh[\s\S]*?await waitForNativeSurfaceValidation\(0\)[\s\S]*?sampling-initial-state/,
    'the time-zero visual checkpoint must settle detached candidate validation before sampling'
  );
  assert.match(
    probeSource,
    /phase === 'initial'[\s\S]*?scene-initial-particle-upload-pair[\s\S]*?getSphGpuParticleUpload[\s\S]*?getMlsMpmGpuParticleUpload[\s\S]*?resident-steps-next-particle-upload-pair/
  );
  assert.match(
    probeSource,
    /validateAuthoritativeGpuUploadPair\(\{[\s\S]*?sphParticleUpload: candidate\.sphParticleUpload[\s\S]*?mlsMpmParticleUpload: candidate\.mlsMpmParticleUpload[\s\S]*?requireTimeZero: phase === 'initial'/
  );
  assert.match(
    probeSource,
    /sourceStep: uploadPairValidation\.sourceStep[\s\S]*?sourceTimeS: uploadPairValidation\.sourceTimeS/
  );
  assert.match(
    probeSource,
    /const particleCount = uploadPairValidation\.particleCount/,
    'reduction length must come from the verified paired upload generation'
  );
  assert.match(
    probeSource,
    /const initialSphUpload = sceneApi\.getSphGpuParticleUpload[\s\S]*?const initialMlsMpmUpload = sceneApi\.getMlsMpmGpuParticleUpload[\s\S]*?refreshSphGpuParticleBuffers[\s\S]*?refreshMlsMpmGpuParticleBuffers[\s\S]*?markProbeProgress\('sampling-initial-state'\)/,
    'final-only visual probes must materialize a paired retained initial upload before sampling time zero'
  );
  assert.match(
    probeSource,
    /initialUploadPairValidation = checkpointModule\.validateAuthoritativeGpuUploadPair\(\{[\s\S]*?requireTimeZero: true[\s\S]*?if \(!initialUploadPairValidation\.ready\)/,
    'an existing initial pair is reusable only with exact paired zero-step and zero-time provenance'
  );
  assert.match(
    sceneSource,
    /threeWebGpuSurfaceBufferRetainResidentHandoff \|\| shouldUseNativeWebGpuSurfaceConsumerBridge[\s\S]*?visibleRenderFieldReadbackMode = RESIDENT_NO_FULL_READBACK_MODE[\s\S]*?native-webgpu-surface-consumer requires a retained no-full-readback render-field handoff/,
    'native surface presentation must coerce auto/full render-field reads to its GPU-resident handoff'
  );
  assert.match(probeSource, /validationBlockerFamily,/);
  assert.match(probeSource, /textureReadbackUnavailable,/);
  assert.match(probeSource, /gpuBufferHandoffReady,/);
  assert.match(
    probeSource,
    /page\.addInitScript\([\s\S]*?addEventListener\?\.\('uncapturederror'[\s\S]*?Promise\.resolve\(device\.lost\)/,
    'the probe must observe uncaptured errors and device loss on every device requested after page initialization'
  );
  assert.match(
    probeSource,
    /firstCriticalGpuMessage[\s\S]*?firstCriticalGpuMessagesByCategory[\s\S]*?browserConsoleFirstCriticalGpuMessage/,
    'critical GPU messages must remain latched outside capped console arrays'
  );
});

test('GPU stage timestamps discard only an unsubmitted encoder allocation suffix', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const spatialSource = readRepoFile(
    'src/runtime/sph/schroederSpatialEpochGpu.js'
  );

  assert.match(probeSource, /const encoderSpanTokens = new WeakMap\(\)/);
  assert.match(
    probeSource,
    /discardEncoderSpans\(encoder\)[\s\S]*?spanSuffixOffset[\s\S]*?spans\[spanSuffixOffset \+ index\] !== token/
  );
  assert.match(
    probeSource,
    /token\.endEncoder !== null && token\.endEncoder !== encoder/
  );
  assert.match(
    probeSource,
    /queryIndices\.length !== nextQueryIndex - rollbackStart[\s\S]*?queryIndex !== rollbackStart \+ index/
  );
  assert.match(
    probeSource,
    /pendingTokens\.delete\(token\)[\s\S]*?spans\.splice\(spanSuffixOffset, encoderTokens\.length\)[\s\S]*?nextQueryIndex = rollbackStart/
  );
  assert.match(
    spatialSource,
    /!submissionPerformed[\s\S]*?generationEncoder[\s\S]*?gpuTimestampRecorder\.discardEncoderSpans\(generationEncoder\)/
  );
});

test('native WebGPU probe batches primary and secondary indirect args into one checkpoint readback', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const evidenceSource = readRepoFile('scripts/sph-native-indirect-evidence.mjs');

  assert.match(
    probeSource,
    /const additionalEntries = \(Array\.isArray\(drawState\?\.additionalSurfaceDraws\)/,
    'checkpoint evidence must include retained secondary surface draw buffers'
  );
  assert.match(
    probeSource,
    /const entries = \[\.\.\.primaryEntries, \.\.\.additionalEntries\]/,
    'primary and secondary indirect rows must share one readback plan'
  );
  assert.match(
    probeSource,
    /entries\.forEach\([\s\S]*?encoder\.copyBufferToBuffer\([\s\S]*?device\.queue\.submit\(\[encoder\.finish\(\)\]\)[\s\S]*?await readback\.mapAsync/,
    'all indirect rows must use one command submission and one map operation'
  );
  assert.match(evidenceSource, /additionalDrawableDrawCount/);
  assert.match(evidenceSource, /aggregateIndirectVertexCount/);
  assert.match(probeSource, /surfaceKey: entry\.surfaceKey/);
});

test('native indirect evidence requires a primary draw and reports product geometry separately', () => {
  const evidence = summarizeNativeSurfaceIndirectArgsReadback({
    status: 'ready',
    readbackByteLength: 64,
    queueSubmitCount: 1,
    mapAsyncCount: 1,
    draws: [
      { source: 'primary', surfaceKey: 'h2o|h2o|liquid', args: [12, 1, 0, 0] },
      { source: 'additional', surfaceKey: 'naoh|naoh|liquid', args: [6, 1, 0, 0] },
      { source: 'additional', surfaceKey: 'h2|h2|gas', args: [3, 2, 0, 0] },
      { source: 'additional', surfaceKey: 'steam|h2o|gas', args: [0, 1, 0, 0] }
    ]
  });

  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.primaryStatus, 'drawable');
  assert.equal(evidence.secondaryStatus, 'has-drawable-secondary');
  assert.equal(evidence.productStatus, 'all-attached-products-drawable');
  assert.equal(evidence.productDrawCount, 2);
  assert.equal(evidence.productDrawableDrawCount, 2);
  assert.equal(evidence.aggregateIndirectVertexCount, 21);
  assert.equal(evidence.aggregateIndirectTriangleCount, 7);
  assert.equal(evidence.submittedVertexInstanceCount, 24);
  assert.equal(evidence.submittedTriangleInstanceCount, 8);
  assert.equal(evidence.queueSubmitCount, 1);
  assert.equal(evidence.mapAsyncCount, 1);
});

test('native indirect evidence never substitutes a secondary draw for a missing primary', () => {
  const evidence = summarizeNativeSurfaceIndirectArgsReadback({
    status: 'ready',
    draws: [
      { source: 'additional', surfaceKey: 'naoh|naoh|liquid', args: [6, 1, 0, 0] }
    ]
  });

  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.primaryStatus, 'missing');
  assert.equal(evidence.productStatus, 'all-attached-products-drawable');
  assert.equal(evidence.args, null);
});

test('native indirect evidence distinguishes attached but empty product surfaces', () => {
  const evidence = summarizeNativeSurfaceIndirectArgsReadback({
    status: 'ready',
    draws: [
      { source: 'primary', surfaceKey: 'h2o|h2o|liquid', args: [12, 1, 0, 0] },
      { source: 'additional', surfaceKey: 'naoh|naoh|liquid', args: [0, 1, 0, 0] },
      { source: 'additional', surfaceKey: 'h2|h2|gas', args: [0, 0, 0, 0] }
    ]
  });

  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.secondaryStatus, 'all-empty');
  assert.equal(evidence.productStatus, 'all-attached-products-empty');
  assert.equal(evidence.productDrawableDrawCount, 0);
  assert.equal(evidence.submittedVertexInstanceCount, 12);
});

test('native indirect evidence reports missing expected products and every primary row', () => {
  const evidence = summarizeNativeSurfaceIndirectArgsReadback({
    status: 'ready',
    draws: [
      { source: 'primary', surfaceKey: 'h2o:empty', args: [0, 1, 0, 0] },
      { source: 'primary', surfaceKey: 'h2o:drawable', args: [9, 1, 0, 0] },
      { source: 'additional', surfaceKey: 'naoh|naoh|liquid', args: [6, 1, 0, 0] }
    ]
  }, {
    expectedProductMaterials: ['NaOH', 'H2']
  });

  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.primaryStatus, 'partial-primary-drawable');
  assert.equal(evidence.primaryDrawCount, 2);
  assert.equal(evidence.primaryDrawableDrawCount, 1);
  assert.deepEqual(evidence.args, [9, 1, 0, 0]);
  assert.equal(evidence.productStatus, 'some-expected-products-missing');
  assert.deepEqual(evidence.expectedProductMaterials, ['naoh', 'h2']);
  assert.deepEqual(evidence.attachedProductMaterials, ['naoh']);
  assert.deepEqual(evidence.missingExpectedProductMaterials, ['h2']);
});

test('native product capture draw plan isolates exact product surfaces without mutating draw state', () => {
  const primaryDraws = [{ surfaceIndex: 0 }, { surfaceIndex: 1 }];
  const naoh = { surfaceKey: 'product|naoh|liquid' };
  const h2 = { surfaceKey: 'product|h2|gas' };
  const water = { surfaceKey: 'generic|h2o|liquid' };
  const additionalSurfaceDraws = [water, naoh, h2];
  const plan = resolveSphNativeSurfaceDiagnosticDrawPlan({
    drawOrder: primaryDraws,
    additionalSurfaceDraws,
    filter: {
      enabled: true,
      token: 'capture-1',
      filterAdditionalSurfaceDraws: true,
      additionalSurfaceKeys: [naoh.surfaceKey, h2.surfaceKey],
      suppressPrimarySurfaceDraws: true,
      suppressBackgroundImage: true,
      suppressBoxWireframe: true,
      suppressSchroederProxyDraws: true
    }
  });

  assert.equal(plan.active, true);
  assert.equal(plan.token, 'capture-1');
  assert.deepEqual(plan.drawOrder, []);
  assert.deepEqual(plan.additionalSurfaceDraws, [naoh, h2]);
  assert.equal(plan.suppressBackgroundImage, true);
  assert.equal(plan.suppressBoxWireframe, true);
  assert.equal(plan.suppressSchroederProxyDraws, true);
  assert.deepEqual(primaryDraws, [{ surfaceIndex: 0 }, { surfaceIndex: 1 }]);
  assert.deepEqual(additionalSurfaceDraws, [water, naoh, h2]);

  const inactivePlan = resolveSphNativeSurfaceDiagnosticDrawPlan({
    drawOrder: primaryDraws,
    additionalSurfaceDraws,
    filter: null
  });
  assert.equal(inactivePlan.active, false);
  assert.equal(inactivePlan.drawOrder, primaryDraws);
  assert.equal(inactivePlan.additionalSurfaceDraws, additionalSurfaceDraws);
  assert.equal(inactivePlan.suppressBackgroundImage, false);
  assert.equal(inactivePlan.suppressBoxWireframe, false);
  assert.equal(inactivePlan.suppressSchroederProxyDraws, false);
});

test('native H2 visibility plans preserve canonical draw identity for ablation and H2-only evidence', () => {
  const primary = { surfaceIndex: 0, surfaceKey: 'h2o|h2o|liquid|domain:base' };
  const waterGas = { surfaceKey: 'steam|h2o|gas' };
  const naoh = { surfaceKey: 'naoh|naoh|liquid' };
  const h2 = {
    surfaceKey: 'h2|h2|gas',
    depthWriteFlag: 1,
    bindGroup: { label: 'h2-original-bind-group' },
    drawIndirectRowsBuffer: { label: 'h2-original-indirect-buffer' }
  };
  const primaryDraws = [primary];
  const additionalSurfaceDraws = [waterGas, naoh, h2];

  const ablated = resolveSphNativeSurfaceDiagnosticDrawPlan({
    drawOrder: primaryDraws,
    additionalSurfaceDraws,
    filter: {
      enabled: true,
      token: 'h2-ablated',
      filterAdditionalSurfaceDraws: true,
      additionalSurfaceKeys: [waterGas.surfaceKey, naoh.surfaceKey],
      suppressPrimarySurfaceDraws: false,
      suppressBackgroundImage: false,
      suppressBoxWireframe: false,
      suppressSchroederProxyDraws: false
    }
  });
  assert.deepEqual(ablated.drawOrder, [primary]);
  assert.deepEqual(ablated.additionalSurfaceDraws, [waterGas, naoh]);
  assert.equal(ablated.drawOrder[0], primary);
  assert.equal(ablated.additionalSurfaceDraws[0], waterGas);
  assert.equal(ablated.additionalSurfaceDraws[1], naoh);
  assert.equal(ablated.suppressBackgroundImage, false);
  assert.equal(ablated.suppressBoxWireframe, false);
  assert.equal(ablated.suppressSchroederProxyDraws, false);

  const h2Only = resolveSphNativeSurfaceDiagnosticDrawPlan({
    drawOrder: primaryDraws,
    additionalSurfaceDraws,
    filter: {
      enabled: true,
      token: 'h2-only',
      filterAdditionalSurfaceDraws: true,
      additionalSurfaceKeys: [h2.surfaceKey],
      suppressPrimarySurfaceDraws: true,
      suppressBackgroundImage: true,
      suppressBoxWireframe: true,
      suppressSchroederProxyDraws: true
    }
  });
  assert.deepEqual(h2Only.drawOrder, []);
  assert.deepEqual(h2Only.additionalSurfaceDraws, [h2]);
  assert.equal(h2Only.additionalSurfaceDraws[0], h2);
  assert.equal(h2Only.additionalSurfaceDraws[0].bindGroup, h2.bindGroup);
  assert.equal(h2Only.additionalSurfaceDraws[0].drawIndirectRowsBuffer, h2.drawIndirectRowsBuffer);
  assert.equal(h2Only.additionalSurfaceDraws[0].depthWriteFlag, 1);
  assert.deepEqual(primaryDraws, [primary]);
  assert.deepEqual(additionalSurfaceDraws, [waterGas, naoh, h2]);
});

test('native product draw-filter probe uses identity-owned cleanup in a finally path', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(probeSource, /ULG_PROBE_CAPTURE_PRODUCT_SURFACES_ONLY/);
  assert.match(
    probeSource,
    /bridge\.__ulgProbeNativeSurfaceDrawFilter = filter[\s\S]*?const session = \{ bridge, filter, token: expectedToken \}/
  );
  assert.match(
    probeSource,
    /overlay\.__ulgProbeNativeProductDrawFilterSession[\s\S]*?native-product-draw-filter-busy/
  );
  assert.match(
    probeSource,
    /finally \{[\s\S]*?session\.token !== expectedToken[\s\S]*?installedBridge\.__ulgProbeNativeSurfaceDrawFilter === session\.filter[\s\S]*?delete installedBridge\.__ulgProbeNativeSurfaceDrawFilter/
  );
  assert.match(probeSource, /refresh\?\.surfaceOverlayRendered === true/);
  assert.match(probeSource, /capture-filter-continuity-proved/);
  assert.match(probeSource, /post-capture-filter-continuity-proved/);
  assert.match(probeSource, /frameCanvasSelectionProved: productFrameCanvasProved/);
  assert.match(probeSource, /all-expected-products-drawable/);
  assert.match(probeSource, /isolated-product-visibility-evidence-proved/);
  assert.doesNotMatch(probeSource, /drawState\.surfaceCount = 0/);
  assert.doesNotMatch(probeSource, /drawState\.additionalSurfaceDraws = productDraws/);
  assert.match(probeSource, /suppressedPrimarySurfaceDraws: true/);
  assert.match(probeSource, /suppressedNonProductAdditionalSurfaceDraws: true/);
  assert.match(probeSource, /suppressedBoxWireframe: true/);
  assert.match(probeSource, /suppressedSchroederProxyDraws: true/);
});

test('native H2 composited visibility probe captures ablation, H2-only, and exact restoration without material overrides', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(probeSource, /ULG_PROBE_CAPTURE_H2_VISIBILITY_ABLATION/);
  assert.match(probeSource, /post-probe-native-h2-ablated-composited/);
  assert.match(probeSource, /post-probe-native-h2-only/);
  assert.match(probeSource, /post-probe-native-h2-visibility-restored-canonical/);
  assert.match(probeSource, /compareCapturedPngFrames/);
  assert.match(probeSource, /canonicalAblatedDelta/);
  assert.match(probeSource, /canonicalRestoredNoise/);
  assert.match(probeSource, /native-h2-composited-visibility-proved/);
  assert.match(probeSource, /materialOverrideApplied: false/);
  assert.match(probeSource, /emissiveOverrideApplied: false/);
  assert.match(probeSource, /depthWriteOverrideApplied: false/);
  assert.match(probeSource, /Number\(draw\?\.depthWriteFlag\) === 1/);
  assert.match(probeSource, /finally \{/);
});

test('time-zero provenance rejects missing, empty, and non-finite metadata', () => {
  const sphBase = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    stateBuffer: { size: 32 },
    thermoBuffer: { size: 48 },
    particleCount: 1,
    stateStrideBytes: 32,
    thermoStrideBytes: 48
  };
  const mechanicsBase = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceSchema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
    mechanicsBuffer: { size: 128 },
    particleCount: 1,
    mechanicsStrideBytes: 128
  };

  for (const value of [
    null,
    undefined,
    '',
    ' ',
    '0',
    false,
    [],
    {},
    Number.NaN,
    Infinity,
    -Infinity,
    1,
    -1
  ]) {
    const validation = validateAuthoritativeGpuUploadPair({
      sphParticleUpload: { ...sphBase, step: value, time: value },
      mlsMpmParticleUpload: { ...mechanicsBase, step: value, time: value },
      requireTimeZero: true
    });
    assert.equal(validation.ready, false, `metadata value ${String(value)} must not prove time zero`);
  }
  assert.equal(validateAuthoritativeGpuUploadPair({
    sphParticleUpload: { ...sphBase, step: 0, time: 0 },
    mlsMpmParticleUpload: { ...mechanicsBase, step: 0, time: 0 },
    requireTimeZero: true
  }).timeZeroProvenanceVerified, true);
});

test('performance benchmark reports worker offscreen frame transport budget', () => {
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(
    benchmarkSource,
    /peercompute\.ulg\.worker-offscreen-frame-transport-budget\.v0/,
    'worker offscreen frame transport budget should have a stable schema'
  );
  assert.match(
    benchmarkSource,
    /worker-owned-presented-canvas/,
    'benchmark should identify transferred OffscreenCanvas-style presentation as the zero-copy path'
  );
  assert.match(
    benchmarkSource,
    /frame-copy-back/,
    'benchmark should keep the per-frame copy-back path visible as the rejected architecture'
  );
  assert.match(
    benchmarkSource,
    /rgba8FrameBytes/,
    'benchmark should estimate display-frame copy bytes from viewport dimensions'
  );
  assert.match(
    benchmarkSource,
    /workerOffscreenFrameTransportBudget:/,
    'benchmark scenarios should publish the worker offscreen transport budget'
  );
  assert.match(
    benchmarkSource,
    /ULG_BENCH_WORKER_OFFSCREEN_PRESENTATION/,
    'benchmark should expose an env switch for exercising the actual transferred-canvas path'
  );
  assert.match(
    benchmarkSource,
    /workerOffscreenPresentationRequested/,
    'benchmark report should record whether worker-offscreen presentation was requested'
  );
  assert.match(
    benchmarkSource,
    /peercompute\.ulg\.sph-performance-material-interface-source-field\.v0/,
    'benchmark scenarios should publish material-interface source-field diagnostics'
  );
  assert.match(
    benchmarkSource,
    /interfaceSourceFieldSourceLocalEstimatedCellVisits/,
    'benchmark should lift source-local material-interface work estimates'
  );
  assert.match(
    benchmarkSource,
    /refreshCandidateFieldMs/,
    'benchmark should lift material-interface diagnostic stage timings'
  );
  assert.match(
    benchmarkSource,
    /candidatePipelineCacheStatus/,
    'benchmark should lift material-interface pipeline cache diagnostics'
  );
  assert.match(
    benchmarkSource,
    /materialInterfaceStatus/,
    'benchmark should distinguish source-field diagnostics from intentional material-interface skips'
  );
  assert.match(
    benchmarkSource,
    /ULG_BENCH_RESIDENT_INTERFACE_WARMUP_FRAMES/,
    'benchmark should let source-field diagnostics runs disable interface warmup'
  );
  assert.match(
    benchmarkSource,
    /ULG_BENCH_MATERIAL_INTERFACE_DIAGNOSTIC/,
    'benchmark should expose an opt-in resident material-interface diagnostic run'
  );
  assert.match(
    probeSource,
    /residentMaterialInterfaceState/,
    'long-horizon probe should sample compact resident material-interface state'
  );
  assert.match(
    probeSource,
    /resident-material-interface-diagnostic-completed/,
    'long-horizon probe should be able to force a material-interface diagnostic refresh'
  );
  assert.match(
    probeSource,
    /sourceRenderFieldStatus/,
    'long-horizon probe should preserve render-field skip status for material-interface diagnostics'
  );
  assert.match(
    probeSource,
    /materialInterfaceRefreshCandidateFieldMs/,
    'long-horizon probe should publish compact material-interface refresh stage timings'
  );
});

test('performance benchmark reports Schroeder native render proxy telemetry', () => {
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(
    probeSource,
    /peercompute\.ulg\.sph-probe-schroeder-telemetry\.v0/,
    'long-horizon probe should publish a stable Schroeder telemetry schema'
  );
  assert.match(
    probeSource,
    /compactSchroederTelemetry/,
    'long-horizon probe should collect Schroeder execution and render-proxy status together'
  );
  assert.match(
    probeSource,
    /surfaceDrawRenderBridgeSchroederRenderProxyNativeLastSubmitDrawCommandCount/,
    'Schroeder telemetry should include native executor draw submissions'
  );
  assert.match(
    benchmarkSource,
    /ULG_BENCH_SCHROEDER_SIMULATION/,
    'benchmark should expose an opt-in SS scenario flag'
  );
  assert.match(
    benchmarkSource,
    /ULG_BENCH_SCHROEDER_TWO_LEVEL/,
    'benchmark should expose an explicit two-level mechanics flag'
  );
  assert.match(
    probeSource,
    /twoLevelAuthoritativeStepCount/,
    'long-horizon telemetry should count every authoritative two-level step'
  );
  assert.match(
    probeSource,
    /twoLevelMechanicsCoverageComplete/,
    'long-horizon telemetry should fail closed on partial two-level coverage'
  );
  assert.match(
    benchmarkSource,
    /schroederPortableSummaryRequested/,
    'benchmark should record whether portable summaries are enabled for the SS run'
  );
  assert.match(
    benchmarkSource,
    /schroederActiveNodeIndexRequested/,
    'benchmark should record whether the SS active-node index is enabled'
  );
  assert.match(
    benchmarkSource,
    /schroederTelemetry,/,
    'benchmark scenarios should retain the compact Schroeder telemetry object'
  );
  assert.match(
    benchmarkSource,
    /schroederNativeLastSubmitDrawCommandCount/,
    'benchmark should lift native render-proxy draw submissions into scenario summaries'
  );
  assert.match(
    benchmarkSource,
    /schroederRenderFieldReadback/,
    'benchmark should expose whether SS native rendering avoided render-field readback'
  );
  assert.match(
    benchmarkSource,
    /schroederActiveLeafProxyCount/,
    'benchmark should expose render LOD active leaf proxy counts'
  );
  assert.match(
    benchmarkSource,
    /schroeder-simulation-requested-but-inactive/,
    'an SS benchmark must fail its gate when requested execution was not active'
  );
  assert.match(
    benchmarkSource,
    /schroeder-spatial-transaction-coverage-incomplete/,
    'an active SS benchmark must require one complete canonical transaction per tick'
  );
  assert.match(
    benchmarkSource,
    /entry\?\.phase === 'resident-batch'/,
    'SS transaction coverage must aggregate every primary resident batch instead of the last metric'
  );
  assert.match(
    benchmarkSource,
    /transaction\?\.state === 'released'/,
    'SS transaction coverage must observe confirmed release rather than release scheduling'
  );
  assert.match(
    benchmarkSource,
    /transactionCounterTotals\.releaseCount === expectedStepCount/,
    'SS transaction coverage must confirm release for every completed tick'
  );
  assert.match(
    benchmarkSource,
    /phaseVolumeMigrationRequested = false[\s\S]*?schroederPhaseVolumeMigration: phaseVolumeMigrationRequested \? '1' : '0'/,
    'the transactional SS benchmark must make its phase-overlay compatibility profile explicit'
  );
  assert.match(
    benchmarkSource,
    /releaseRetryCount[\s\S]{0,200}legacyPrivateLookupBuildCount[\s\S]{0,100}legacyExhaustiveTraversalCount/,
    'SS benchmark evidence must include release retry and quarantined legacy lookup counters'
  );
  assert.match(
    benchmarkSource,
    /physicsStepsPerSecond: probeEngineStepsPerSecond \?\? probeWallStepsPerSecond/,
    'reported physics throughput must use complete-batch timing rather than the final step'
  );
  assert.match(
    probeSource,
    /schroederSpatialEpochGenerationSummaries/,
    'the probe should retain per-tick generation and bounded-backpressure evidence'
  );
});

test('direct resident throughput benchmark does not default to per-batch queue fences', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');

  assert.match(
    benchmarkSource,
    /const measureGpuQueueFence = booleanEnv\(\s*'ULG_BENCH_MEASURE_GPU_QUEUE_FENCE',\s*false\s*\)/,
    'direct-resident throughput benchmarks should not default to residentQueueFence=1'
  );
  assert.match(
    benchmarkSource,
    /const requireQueueFenceGate = booleanEnv\(\s*'ULG_BENCH_REQUIRE_QUEUE_FENCE',\s*measureGpuQueueFence\s*\)/,
    'queue-fence gate should follow the explicit queue-fence measurement request'
  );
  assert.match(
    probeSource,
    /queue\.onSubmittedWorkDone-before-direct-resident-cleanup/,
    'unfenced direct-resident probes should still drain the queue before GPU resource teardown'
  );
  assert.match(
    probeSource,
    /directResidentCleanupGpuResourceDestroySkipped/,
    'probe telemetry should report when cleanup skips explicit resource destruction after a failed cleanup fence'
  );
});

test('resident material interface seeds surface table before full render-row readback fallback', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(sceneSource, /function seedResidentMaterialInterfaceSurfaceTable/);
  assert.match(sceneSource, /materialInterfaceSeedSourcesFromResidentParticleState/);
  assert.match(
    sceneSource,
    /resident-material-interface-surface-table-seeded-gpu-resident/,
    'material-interface refresh should publish the readback-free seed status'
  );
  assert.match(
    sceneSource,
    /surfaceTableSeedState = seedResidentMaterialInterfaceSurfaceTable[\s\S]*needsSurfaceTableSeed = !surfaceTableSeedState\?\.surfaceTable\?\.schema;[\s\S]*readbackMode: needsSurfaceTableSeed \? 'full-parity-readback' : SPH_PHASE_RESIDENT_READBACK_MODE_DEFAULT/,
    'resident material-interface refresh should try GPU-resident surface-table seeding before full readback'
  );
  assert.match(
    sceneSource,
    /materialInterfaceSurfaceTableSeedReadbackFree/,
    'published material-interface diagnostics should expose readback-free seeding evidence'
  );
  assert.match(
    sceneSource,
    /materialInterfaceSurfaceTableSeedStatus: field\.materialInterfaceSurfaceTableSeedStatus/,
    'compact material-interface summaries should retain the seed status for probes'
  );
  assert.match(sceneSource, /SPH_MATERIAL_INTERFACE_MAX_FIELD_CELLS_DEFAULT = 8_000/);
  assert.match(sceneSource, /function createMaterialInterfaceSurfaceTableForResidentState/);
  assert.match(sceneSource, /sphMaterialInterfaceSurfaceTablePolicy/);
  assert.match(
    sceneSource,
    /surfaceTable: materialInterfaceSurfaceTable/,
    'material-interface source-field extraction should use the coarse pressure-interface table'
  );
  assert.match(
    sceneSource,
    /buildSphMaterialInterfaceSourceFieldLocalWebGpu/,
    'material-interface source-field extraction should use the source-local builder'
  );
  assert.match(
    sceneSource,
    /interfaceSourceFieldSourceLocalEstimatedCellVisits/,
    'material-interface diagnostics should expose source-local work estimates'
  );
  assert.match(
    sceneSource,
    /interfaceSourceFieldDenseCellParticlePairs/,
    'compact material-interface summaries should retain source-local dense comparison estimates'
  );
  const sourceLocalSource = readRepoFile('src/runtime/sph/sphMaterialInterfaceSourceFieldLocalGpu.js');
  assert.match(sourceLocalSource, /SPH_MATERIAL_INTERFACE_SOURCE_LOCAL_SCHEMA/);
  assert.match(sourceLocalSource, /array<atomic<u32>>/);
  assert.match(sourceLocalSource, /atomicAdd/);
  assert.match(sourceLocalSource, /atomicLoad/);
  assert.match(
    sceneSource,
    /materialInterfaceSurfaceTableTotalFieldCells/,
    'material-interface diagnostics should expose the coarse table cell count'
  );
  assert.match(
    sceneSource,
    /sphResidentMaterialInterfaceSourceFieldRowsBufferPool/,
    'material-interface source-field extraction should have an independent reusable field buffer pool'
  );
  assert.match(
    sceneSource,
    /targetFieldRowsBuffer: materialInterfaceSourceFieldRowsBufferPool\?\.buffer/,
    'material-interface source-field extraction should write into the pooled buffer'
  );
  assert.match(
    sceneSource,
    /waitForQueueCompletion: false/,
    'material-interface source-field extraction should submit a GPU handoff without an intermediate CPU queue fence'
  );
  assert.match(
    sceneSource,
    /interfaceSourceFieldRowsBufferPoolStatus/,
    'material-interface diagnostics should expose source-field buffer pool status'
  );
  const mountSource = readRepoFile('src/visualization/sphPhaseDemoMount.js');
  assert.match(mountSource, /materialInterfaceMaxFieldCells/);
  assert.match(mountSource, /miCells/);
  assert.match(mountSource, /materialInterfaceSurfaceTablePolicy: initialMaterialInterfaceSurfaceTablePolicy/);
  assert.match(
    mountSource,
    /schedulerResidentInterfaceRefreshMode = currentResidentInterfaceRefreshMode\(\)/,
    'resident playback scheduler should capture the interface refresh mode once per cycle'
  );
  assert.match(
    mountSource,
    /skipPressureInterfaceRefresh: true/,
    'resident playback render refresh should not duplicate the scheduler-owned interface refresh'
  );
});

test('resident material interface uses compact active-candidate readback', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const kernelSource = readRepoFile('src/runtime/sph/sphRenderGpuKernel.js');
  const wgslSource = readRepoFile('ulg-gpu-abi/src/wgsl.js');

  assert.match(kernelSource, /buildSphMaterialInterfaceCompactCandidateFieldWebGpu/);
  assert.match(kernelSource, /sphMaterialInterfaceCompactCandidatesWgsl/);
  assert.match(kernelSource, /compact-active-render-field-cell-axis-triplets/);
  assert.match(kernelSource, /candidateCompactRowsByteLength/);
  assert.match(wgslSource, /sphMaterialInterfaceCompactCandidatesWgsl/);
  assert.match(wgslSource, /atomicAdd\(&compact_metadata\[0\], 1u\)/);
  assert.match(wgslSource, /@group\(0\) @binding\(4\) var<storage, read_write> compact_metadata/);
  assert.match(
    sceneSource,
    /buildSphPhysicsMaterialInterfaceFieldWebGpu\(\{[\s\S]*candidateReadbackMode: 'compact-active-readback'/,
    'resident scene should opt into compact active-candidate readback for material-interface refresh'
  );
});

test('worker offscreen presentation path requires transferred canvas ownership', () => {
  const bridgeSource = readRepoFile('src/visualization/offscreenPresentationBridge.js');
  const workerSource = readRepoFile('src/services/ulgOffscreenRender.worker.js');
  const mechanicsWorkerSource = readRepoFile('src/services/ulgMechanicsResidentStage.worker.js');
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const mountSource = readRepoFile('src/visualization/sphPhaseDemoMount.js');
  const policySource = readRepoFile('src/runtime/peercomputeRenderOwnershipPolicy.js');
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');

  assert.match(workerSource, /peercompute\.ulg\.worker-offscreen-presentation\.v0/);
  assert.match(workerSource, /peercompute\.ulg\.worker-offscreen-render-rows\.v0/);
  assert.match(workerSource, /peercompute\.ulg\.worker-offscreen-resident-render-producer\.v0/);
  assert.match(workerSource, /peercompute\.ulg\.worker-offscreen-resident-particle-state-producer\.v0/);
  assert.match(bridgeSource, /transferControlToOffscreen/);
  assert.match(workerSource, /getContext\('webgpu'\)/);
  assert.match(workerSource, /type === 'draw-render-rows'/);
  assert.match(workerSource, /type === 'draw-resident-render-producer'/);
  assert.match(workerSource, /type === 'draw-resident-particle-state-producer'/);
  assert.match(workerSource, /worker-resident-particle-state-transfer/);
  assert.match(workerSource, /worker-resident-particle-state-cache/);
  assert.match(workerSource, /peercompute\.ulg\.presentation-worker-resident-stage\.v0/);
  assert.match(workerSource, /peercompute\.ulg\.presentation-worker-retained-compact-snapshot-export\.v0/);
  assert.match(workerSource, /run-resident-stage-on-presentation-device/);
  assert.match(workerSource, /export-retained-compact-snapshot/);
  assert.match(workerSource, /offscreen-presentation-worker-device/);
  assert.match(workerSource, /worker-offscreen-resident-stage-on-presentation-device-started/);
  assert.match(workerSource, /worker-offscreen-resident-stage-on-presentation-device-timeout/);
  assert.match(workerSource, /queueCompletionErrorMessage/);
  assert.match(workerSource, /sameWorkerQueueFenceFallback/);
  assert.match(mechanicsWorkerSource, /mapAsync\(worker-queue-fence-sentinel\)/);
  assert.match(mechanicsWorkerSource, /exportUlgMechanicsResidentStageWorkerRetainedCompactSnapshot/);
  assert.match(mechanicsWorkerSource, /compact-buffer-snapshot-exported-from-worker-retained-state/);
  assert.match(mechanicsWorkerSource, /queue-submitted-same-worker-gpu-handoff-no-cpu-fence/);
  assert.match(workerSource, /source-cache-reused/);
  assert.match(workerSource, /worker-offscreen-resident-render-producer-blocked-source-cache-miss/);
  assert.match(workerSource, /worker-resident-source-cache/);
  assert.match(workerSource, /createComputePipeline/);
  assert.match(workerSource, /createRenderPipeline/);
  assert.match(bridgeSource, /main-thread-compact-render-row-transfer/);
  assert.match(bridgeSource, /reuseSourceCache/);
  assert.match(bridgeSource, /source-cache-reused/);
  assert.match(bridgeSource, /sourceRowsPacked/);
  assert.match(bridgeSource, /drawResidentParticleStateProducer/);
  assert.match(bridgeSource, /runResidentStageOnPresentationDevice/);
  assert.match(bridgeSource, /exportRetainedCompactSnapshot/);
  assert.match(bridgeSource, /peercompute\.ulg\.presentation-worker-resident-stage\.v0/);
  assert.match(bridgeSource, /peercompute\.ulg\.presentation-worker-retained-compact-snapshot-export\.v0/);
  assert.match(bridgeSource, /peercompute\.ulg\.worker-offscreen-retained-gpubuffer-handoff\.v0/);
  assert.match(bridgeSource, /cross-worker-gpubuffer-structured-clone/);
  assert.match(bridgeSource, /worker-owned-resident-render-producer/);
  assert.match(policySource, /peercompute\.ulg\.render-ownership-policy\.v0/);
  assert.match(policySource, /worker-owned-resident-render-producer/);
  assert.match(policySource, /cross-worker-gpubuffer-structured-clone/);
  assert.match(bridgeSource, /worker-owned-presented-canvas/);
  assert.match(bridgeSource, /frame-copy-back/);
  assert.match(sceneSource, /createUlgWorkerOffscreenPresentationBridge/);
  assert.match(sceneSource, /sphPeerComputeRenderOwnershipPolicy/);
  assert.match(policySource, /presentation-worker-retained-output-presentation-only/);
  assert.match(policySource, /statePromotionMode/);
  assert.match(policySource, /retainedCompactSnapshotExportRequested/);
  assert.match(sceneSource, /sphWorkerOffscreenPresentation/);
  assert.match(sceneSource, /sphWorkerOffscreenRenderRows/);
  assert.match(sceneSource, /sphWorkerOffscreenResidentStage/);
  assert.match(sceneSource, /runWorkerOffscreenResidentStageOnPresentationDevice/);
  assert.match(sceneSource, /runWorkerOffscreenMechanicsStageChainOnPresentationDevice/);
  assert.match(sceneSource, /peercompute\.ulg\.presentation-worker-mechanics-stage-chain\.v0/);
  assert.match(sceneSource, /workerOffscreenResidentStageTimeoutMs/);
  assert.match(sceneSource, /workerOffscreenResidentStageErrorMessage/);
  assert.match(sceneSource, /workerOffscreenResidentStageQueueCompletionStatus/);
  assert.match(sceneSource, /workerOffscreenResidentStageQueueCompletionFallbackFrom/);
  assert.match(sceneSource, /workerOffscreenResidentStageSameWorkerGpuHandoff/);
  assert.match(sceneSource, /workerOffscreenResidentStageChainStatus/);
  assert.match(sceneSource, /workerOffscreenResidentStageChainAutoStatus/);
  assert.match(sceneSource, /presentation-worker-mechanics-stage-chain-auto\.v0/);
  assert.match(sceneSource, /presentation-worker-retained-state-promotion-candidate\.v0/);
  assert.match(sceneSource, /presentation-worker-retained-state-promotion-admission\.v0/);
  assert.match(sceneSource, /presentation-worker-retained-state-continuation\.v0/);
  assert.match(sceneSource, /presentation-worker-retained-compact-snapshot-export\.v0/);
  assert.match(sceneSource, /maybeRequestWorkerOffscreenRetainedCompactSnapshotExport/);
  assert.match(sceneSource, /retainedCompactSnapshotExportRequested !== true/);
  assert.match(sceneSource, /getWorkerOffscreenRetainedCompactSnapshotStatus/);
  assert.match(sceneSource, /worker-retained-portable-materialization-contract\.v0/);
  assert.match(sceneSource, /blocked-portable-compact-buffer-snapshot-required/);
  assert.match(sceneSource, /worker-retained-gpu-handles-are-not-cross-peer-portable/);
  assert.match(sceneSource, /useWorkerRetainedG2pInput/);
  assert.match(sceneSource, /requireWorkerRunner: false/);
  assert.match(sceneSource, /not-promoted-worker-local-output-awaiting-state-manager-admission/);
  assert.match(sceneSource, /pending-state-manager-admission-worker-local-retained-refs/);
  assert.match(sceneSource, /workerResidentParticleStateProducerColorRows/);
  assert.match(sceneSource, /drawResidentParticleStateProducer/);
  assert.match(sceneSource, /presentationWorkerRenderRetainedStageOutput/);
  assert.match(sceneSource, /presentation-worker-retained-stage-output-render-request\.v0/);
  assert.match(sceneSource, /getWorkerOffscreenRetainedStatePromotionCandidate/);
  assert.match(mountSource, /renderOwnershipPolicy: initialPeerComputeRenderOwnershipPolicy/);
  assert.match(mountSource, /workerOffscreenPresentation/);
  assert.match(mountSource, /presentationWorkerResidentStages/);
  assert.match(mountSource, /retainedCompactSnapshotExport/);
  assert.match(probeSource, /peerComputeRenderOwnershipPolicy/);
  assert.match(probeSource, /workerOffscreenPresentation: sceneUserData\.sphWorkerOffscreenPresentation/);
  assert.match(probeSource, /workerOffscreenRenderRows: sceneUserData\.sphWorkerOffscreenRenderRows/);
  assert.match(probeSource, /workerOffscreenResidentParticleStateVisible/);
  assert.match(probeSource, /workerOffscreenResidentParticleStateVisibleSampleCount/);
  assert.match(probeSource, /workerOffscreenResidentStage/);
  assert.match(probeSource, /workerOffscreenResidentStageChainAuto/);
  assert.match(probeSource, /workerOffscreenRetainedStatePromotionCandidate/);
  assert.match(probeSource, /workerOffscreenRetainedStatePromotionAdmission/);
  assert.match(probeSource, /workerOffscreenRetainedStateContinuation/);
  assert.match(probeSource, /workerOffscreenRetainedCompactSnapshot/);
  assert.match(probeSource, /waitForWorkerOffscreenRetainedCompactSnapshot/);
  assert.match(benchmarkSource, /ULG_BENCH_RENDER_OWNERSHIP/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipPolicyEffectiveMode/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipStatePromotionMode/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipPresentationWorkerRetainedOutputPresentationOnlyRequested/);
  assert.match(benchmarkSource, /workerOffscreenPresentationStatus/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsStatus/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsInputTransferBytes/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceCacheStatus/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceCacheKeyStrategy/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceCacheMissReason/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceCpuStateStale/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceCacheHit/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceRowsPacked/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceStateTransferBytes/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsProducerSourceKind/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceStageId/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsRetainedParticleStateStatus/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsRetainedStageOutputPreserved/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput/);
  assert.match(benchmarkSource, /validWorkerOwnedResidentParticleStateProducer/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageStatus/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageTimeoutMs/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageErrorMessage/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageQueueCompletionStatus/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageQueueCompletionFallbackFrom/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageChainStatus/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageChainAutoStatus/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageChainAutoStatePromotionStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStatePromotionCandidateStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStatePromotionCandidateAdmissionStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStatePromotionCandidateStatePromotionStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStatePromotionAdmissionStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStatePromotionAdmissionCommitted/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStateContinuationStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStateContinuationApplied/);
  assert.match(benchmarkSource, /workerOffscreenRetainedStateContinuationCrossPeerReplayStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedCompactSnapshotStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedCompactSnapshotReadbackByteLength/);
  assert.match(benchmarkSource, /ULG_BENCH_RETAINED_COMPACT_SNAPSHOT_EXPORT/);
  assert.match(benchmarkSource, /ULG_BENCH_PRESENTATION_WORKER_RESIDENT_STAGES/);
  assert.match(benchmarkSource, /ULG_BENCH_RENDER_USE_CASE/);
  assert.match(benchmarkSource, /renderUseCase/);
  assert.match(mountSource, /DEFAULT_INTERACTIVE_RENDER_OWNERSHIP_USE_CASE = 'same-device-interactive'/);
  assert.match(mountSource, /rawRenderOwnershipModeExplicitNonAuto/);
  assert.match(benchmarkSource, /probeMode === 'scene' \? 'same-device-interactive' : ''/);
  assert.match(benchmarkSource, /workerOffscreenResidentStageSameWorkerGpuHandoff/);
  assert.match(benchmarkSource, /renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipResidentInterfaceRefreshMode/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipResidentComputeManagerMode/);
  assert.match(benchmarkSource, /probeWallTimeAttribution/);
  assert.match(benchmarkSource, /probe-wall-dominated-by-browser-raf/);
  assert.match(benchmarkSource, /probeEngineStepsPerSecond/);
  assert.match(benchmarkSource, /probeResidentBatchViewportNonRafMs/);
  assert.match(sceneSource, /presentationWorkerRetainedOutputPresentationOnlyReadbackFree/);
  assert.match(sceneSource, /upgradeWorkerOffscreenRenderRowsWhenReady/);
  assert.match(sceneSource, /retainPreviousThreeRenderRowBridgeNoFull/);
  assert.match(sceneSource, /workerOwnedResidentParticleStateProducerBridge/);
  assert.match(sceneSource, /workerOwnedResidentParticleStateProducerPresentationOnly/);
  assert.match(sceneSource, /surfaceDrawWorkerOwnedResidentParticleStateProducerPresentationOnly/);
  assert.match(sceneSource, /resident-render-worker-owned-particle-state-producer-presented/);
  assert.match(policySource, /residentInterfaceRefreshMode/);
  assert.match(policySource, /residentComputeManagerMode/);
  assert.match(policySource, /workerOffscreenRenderRowsUpgradedToWorkerOwnedResidentProducer/);
  assert.match(probeSource, /presentationWorkerRetainedOutputPresentationOnlyReadbackFree/);
  assert.match(probeSource, /peerComputeRenderOwnershipResidentComputeManagerMode/);
  assert.match(benchmarkSource, /presentationWorkerRetainedOutputPresentationOnlyReadbackFree/);
  assert.match(sceneSource, /peerComputeRenderOwnershipResidentStepsPerScheduleMax/);
  assert.match(sceneSource, /peerComputeRenderOwnershipResidentComputeManagerMode/);
  assert.match(probeSource, /peerComputeRenderOwnershipResidentStepsPerScheduleMax/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipResidentStepsPerScheduleMax/);
  assert.match(mountSource, /residentStepsPerScheduleOverride/);
  assert.match(mountSource, /currentResidentComputeManagerMode/);
  assert.match(mountSource, /policy-bypassed-direct-resident-execution/);
  assert.match(mountSource, /Math\.min\(maxSteps, throughputCount\)/);
  assert.match(sceneSource, /resident-render-presentation-worker-retained-output-preserved/);
  assert.match(benchmarkSource, /workerOffscreenRetainedGpuBufferHandoffStatus/);
  assert.match(benchmarkSource, /workerOffscreenRetainedGpuBufferHandoffPlanChangeRequired/);
  assert.match(probeSource, /workerOffscreenRetainedGpuBufferHandoff/);
  assert.match(probeSource, /renderRowsReadbackForcedForWorkerOffscreenPresentation/);
  assert.match(benchmarkSource, /renderRowsReadbackForcedForWorkerOffscreenPresentation/);
  assert.match(workerSource, /worker-retained-resident-stage-output/);
  assert.match(workerSource, /resolveUlgMechanicsResidentStageWorkerRetainedParticleState/);
  assert.doesNotMatch(workerSource, /ImageBitmap|readPixels|toDataURL|toBlob/);
});

test('SS adopted particle storage publishes descriptor-only scene records and feeds mounted stage chains', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const mountSource = readRepoFile('src/visualization/sphPhaseDemoMount.js');
  const mlsMpmSource = readRepoFile('src/runtime/sph/sphMlsMpmGpuStep.js');

  assert.match(
    mlsMpmSource,
    /export function createSchroederAdoptedParticleStorageDescriptorFromStep/,
    'scene-local SS executions should reuse the same adopted-storage descriptor builder as ComputeManager tasks'
  );
  assert.match(
    sceneSource,
    /publishSchroederAdoptedParticleStorageDescriptor/,
    'scene resident executions should publish adopted particle-storage descriptors through the resident host'
  );
  assert.match(
    sceneSource,
    /sphParticleUpload: execution\.nextParticleUploads\.sphParticleUpload[\s\S]*mlsMpmParticleUpload: execution\.nextParticleUploads\.mlsMpmParticleUpload/,
    'scene publication should register local retained particle buffers with the host resolver'
  );
  assert.match(
    sceneSource,
    /mlsMpmResidentSchroederAdoptedParticleStoragePublication/,
    'scene diagnostics should expose the sanitized adopted-storage publication'
  );
  assert.match(
    mountSource,
    /schroederAdoptedParticleStorageContinuationHotBufferKey:[\s\S]*adoptedStorageContinuationHotBufferKey/,
    'mounted mechanics stage chains should consume the adopted-storage hot-buffer key'
  );
  assert.match(
    mountSource,
    /schroederAdoptedParticleStorageContinuationConsumerMode: 'same-device'/,
    'mounted mechanics stage chains should request same-device adopted-storage continuation'
  );
  assert.match(
    mountSource,
    /schroederAdoptedParticleStorageLocalResolverReady/,
    'mounted diagnostics should report local resolver readiness'
  );
  assert.match(
    mountSource,
    /raw-transfer=\$\{Boolean\(schroederAdoptedStorage\.rawGpuBufferPeerComputeTransfer\)\}/,
    'mounted status should prove no raw GPUBuffer PeerCompute transfer is being used'
  );
});

test('native WebGPU surface requests retain render-field buffers by default', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /\(threeWebGpuSurfaceBufferRetainResidentHandoff \|\| requestedNativeWebGpuSurfaceConsumerBridge\)[\s\S]*?requestedRenderFieldSurfaceSummaryMode === 'auto'/,
    'native WebGPU surface requests must coerce auto summary mode into retained render-field buffers'
  );
  assert.match(
    sceneSource,
    /native-webgpu-surface-consumer request retains render-field buffers without compact summary readback/,
    'native WebGPU surface coercion should remain explicit in diagnostics'
  );
});

test('native WebGPU renderer canvas avoids exact full-viewport compositor capture path', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /if \(useNativeWebGpuRenderer\) \{[\s\S]*?style\.width = 'calc\(100% - 1px\)'[\s\S]*?style\.height = 'calc\(100% - 1px\)'/,
    'native WebGPU canvas should avoid the Chromium transparent screenshot path for exact full-viewport absolute canvases'
  );
  assert.match(
    sceneSource,
    /Chromium's native WebGPU screenshot path can expose an exactly full-viewport absolute canvas/,
    'the native canvas sizing guard should document the browser-frame validation reason'
  );
});

test('native WebGPU browser probe analyzes captured frames without artifact output', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(
    probeSource,
    /status: shouldWriteFrames \? 'ready' : 'analyzed-in-memory'/,
    'visual frame analysis should not require ULG_PROBE_FRAME_DIR'
  );
  assert.match(
    probeSource,
    /timeline\.visualFrameCapture\.analyzedFrameCount = visualFrameArtifacts\.analyzedFrameCount \?\? 0/,
    'probe telemetry should expose analyzed frame count separately from written files'
  );
  assert.match(
    probeSource,
    /timeline\.visualFrameCapture\.writtenFrameCount = visualFrameArtifacts\.writtenFrameCount \?\? 0/,
    'written frame count should only report files written to disk'
  );
  assert.match(
    probeSource,
    /nativeWebGpuSurfaceConsumerTextureReadbackUnavailable\s*\|\|\s*nativeWebGpuSurfaceConsumerBrowserFrameValidationRequired/,
    'native WebGPU canvas-capture classification should recognize browser-frame validation requirements'
  );
  assert.match(
    probeSource,
    /nativeSurfaceFrameValidationRequired\s*=\s*[\s\S]*?surfaceDrawDiagnosticMode === 'native-webgpu-surface-consumer'/,
    'native WebGPU probes should force browser-frame capture when frame validation owns readiness'
  );
  assert.match(
    probeSource,
    /captureFrames = probeMode !== 'direct-resident'[\s\S]*?\|\| nativeSurfaceFrameValidationRequired/,
    'native frame validation should not require ULG_PROBE_CAPTURE_FRAMES or ULG_PROBE_FRAME_DIR'
  );
  assert.match(
    probeSource,
    /nativeSurfaceFrameValidationViewport \? 320 : 1280/,
    'native browser-frame validation should default to a compositor-stable viewport unless the caller overrides it'
  );
  assert.match(
    probeSource,
    /nativeSurfaceFrameValidationViewport \? 240 : 800/,
    'native browser-frame validation should pair the stable viewport width with a stable height'
  );
  assert.doesNotMatch(
    probeSource,
    /if \(!frameDir\) \{\s*return \{[\s\S]*?frames: \[\]/,
    'captured frames must not be discarded just because artifact output is disabled'
  );
  assert.match(
    probeSource,
    /residentRenderSourceMetricTimeDeltaS/,
    'native no-full surface probes should accept current render-source samples across advancing metric time'
  );
  assert.match(
    probeSource,
    /residentNoReadbackRenderSourceEvidenceAvailable[\s\S]*?residentRenderSourceTimeAdvanced/,
    'native no-full surface probes should not require CPU motion diagnostics when render-source evidence is current'
  );
  assert.match(
    probeSource,
    /nativeSurfaceCaptureUiSuppressed[\s\S]*?#sph-phase-overlay #sph-panel[\s\S]*?#sph-phase-overlay #sph-warning-bar[\s\S]*?visibility:hidden!important/,
    'native surface captures must suppress overlaid controls so UI pixels cannot satisfy surface validation'
  );
});

test('direct resident plan-only probes use active-grid prediction as no-readback motion evidence', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');

  assert.match(
    probeSource,
    /directResidentNoReadbackActiveGridMotionEvidenceAvailable/,
    'direct-resident plan-only probes should publish a specific no-readback active-grid evidence flag'
  );
  assert.match(
    probeSource,
    /active-grid-predicted-motion/,
    'direct-resident plan-only probes should label active-grid prediction as the motion evidence source'
  );
  assert.match(
    benchmarkSource,
    /activeGridPredictedMaxDisplacementM: analysis\.activeGridPredictedMaxDisplacementM/,
    'benchmark summaries should flatten active-grid predicted displacement evidence'
  );
  assert.match(
    benchmarkSource,
    /motionSpeedEvidenceSource: analysis\.motionSpeedEvidenceSource/,
    'benchmark summaries should expose the motion evidence source'
  );
});

test('native WebGPU browser-frame validation publishes back into scene state', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(
    sceneSource,
    /publishSphNativeWebGpuSurfaceConsumerBrowserFrameValidation/,
    'scene API should expose a browser-frame validation publisher for native WebGPU'
  );
  assert.match(
    sceneSource,
    /peercompute\.ulg\.sph-native-webgpu-browser-frame-validation\.v0/,
    'browser-frame validation should publish a schema-tagged engine-state record'
  );
  assert.match(
    sceneSource,
    /publishSphNativeWebGpuSurfaceConsumerPixelValidation\(bridge,[\s\S]*?source,[\s\S]*?nonzeroPixelCount,[\s\S]*?pixelCount/,
    'browser-frame validation must feed the same visible-consumer pixel-validation path'
  );
  assert.match(
    probeSource,
    /browserFrameValidationFromVisualFrame\(canvasCenterFrame,[\s\S]*?playwright-canvas-center-crop/,
    'probe should analyze the clipped canvas-center frame while the page is alive'
  );
  assert.match(
    probeSource,
    /publishSphNativeWebGpuSurfaceConsumerBrowserFrameValidation/,
    'probe should publish browser-frame validation back into the live scene API'
  );
  assert.match(
    probeSource,
    /lastMetric\.renderState = \{[\s\S]*?publishResult\.renderStatePatch/,
    'probe should patch final metric state after browser-frame validation publishes'
  );
  assert.match(
    probeSource,
    /Math\.max\(maxR - minR, maxG - minG, maxB - minB\)/,
    'uniform colored canvases must not pass by comparing RGB components within one pixel'
  );
  assert.match(
    probeSource,
    /visibleCanvases\.find\(\(entry\) => entry\.sameAsNativeConsumerCanvas\)[\s\S]*?sameAsRenderBridgeCanvas/,
    'native validation should prefer the actual consumer or render-bridge canvas over overlay order'
  );
});

test('standard material matrix pins production native WebGPU visual evidence', () => {
  const matrixSource = readRepoFile('scripts/sph-visual-sanity-matrix.mjs');

  assert.match(matrixSource, /renderer: 'native-webgpu'/);
  assert.match(matrixSource, /renderOwnership: 'main-thread-renderer'/);
  assert.match(matrixSource, /surfaceDraw: 'native-webgpu-surface-consumer'/);
  assert.match(matrixSource, /ss: '1'/);
  // Slice 9 is the two-level/cross-level transport, so the matrix that gates it
  // must actually execute it. These previously pinned '0', which kept every
  // scenario green on a configuration that never ran the feature under test.
  for (const flag of [
    'schroederTwoLevel',
    'schroederCrossLevelCoupling',
    'schroederPhaseVolumeMigration',
    'schroederLawQueue',
    'schroederLawNeighborCandidates'
  ]) {
    assert.match(
      matrixSource,
      new RegExp(`${flag}: '1'`),
      `${flag} must be enabled in the standard matrix scenarios`
    );
  }
  assert.match(matrixSource, /params\.set\('renderer', 'native-webgpu'\)/);
  assert.match(matrixSource, /params\.set\('renderOwnership', 'main-thread-renderer'\)/);
  assert.match(matrixSource, /params\.set\('surfaceDraw', 'native-webgpu-surface-consumer'\)/);
  assert.match(matrixSource, /params\.set\('ss', '1'\)/);
  for (const flag of [
    'schroederTwoLevel',
    'schroederCrossLevelCoupling',
    'schroederPhaseVolumeMigration',
    'schroederLawQueue',
    'schroederLawNeighborCandidates'
  ]) {
    assert.match(
      matrixSource,
      new RegExp(`params\\.set\\('${flag}', '1'\\)`),
      `${flag} must be enabled for the random-pair matrix scenarios`
    );
  }
  assert.match(matrixSource, /ULG_PROBE_VIEWPORT_WIDTH[\s\S]*?'1280'/);
  assert.match(matrixSource, /ULG_PROBE_VIEWPORT_HEIGHT[\s\S]*?'800'/);
  assert.match(
    matrixSource,
    /scenario\.visualRendererMode === 'native-webgpu-surface-consumer'[\s\S]*?ULG_PROBE_READBACK_MODE = 'no-full-readback'[\s\S]*?ULG_PROBE_RENDER_READBACK_MODE = 'no-full-readback'[\s\S]*?ULG_PROBE_RENDER_ROWS_READBACK_MODE = 'no-full-readback'/,
    'native standard scenarios must retain render-field buffers without full particle readback'
  );
  assert.match(
    matrixSource,
    /effectiveRendererModes\.some\(\(mode\) => mode !== scenario\.visualRendererMode\)[\s\S]*?'visual-renderer-mode-mismatch'/,
    'every standard visual interval must stay on the requested native surface bridge'
  );
  assert.match(
    matrixSource,
    /const checkpoint = metric\?\.authoritativeGpuCheckpoint\?\.status === 'captured'/,
    'compact evolution records should consume retained GPU checkpoint evidence'
  );
  assert.match(
    matrixSource,
    /'initial-state-captured'[\s\S]*?simulation time zero/,
    'initial-state claims should remain inconclusive without a time-zero GPU checkpoint'
  );
});

test('single-level SS is the production default while future hierarchy families stay opt-in', () => {
  const mountSource = readRepoFile('src/visualization/sphPhaseDemoMount.js');
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  for (const option of [
    'initialSchroederCrossLevelCouplingEnabled',
    'initialSchroederPhaseVolumeMigrationEnabled',
    'initialSchroederLawQueueEnabled',
    'initialSchroederLawNeighborCandidatesEnabled'
  ]) {
    assert.match(
      mountSource,
      new RegExp(`const ${option} = booleanUrlParam\\([\\s\\S]*?\\n    false\\n  \\);`),
      `${option} must remain opt-in until its immutable-epoch slice is complete`
    );
  }
  assert.match(mountSource, /initialSchroederPhaseVolumeMigrationEnabled\) q\.set\('schroederPhaseVolumeMigration', '1'\)/);
  assert.match(
    sceneSource,
    /schroederEnableCrossLevelCoupling = false,[\s\S]*?schroederEnablePhaseVolumeMigration = false,[\s\S]*?schroederEnableLawQueue = false,[\s\S]*?schroederEnableLawNeighborCandidates = false/,
    'programmatic scene callers must inherit the supported single-level Slice 5 boundary'
  );
});

test('native WebGPU offscreen validation binds opaque and refractive pipeline resources', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /beginSphNativeWebGpuSurfaceConsumerOffscreenValidation[\s\S]*?validationPass\.setPipeline\(bridge\.opaquePipeline\);[\s\S]*?validationPass\.setBindGroup\(1, bridge\.refractionDummyBindGroup\);[\s\S]*?validationPass\.setPipeline\(bridge\.refractivePipeline\);[\s\S]*?validationPass\.setBindGroup\(1, bridge\.refractionDummyBindGroup\);/,
    'opaque and refractive offscreen validation must satisfy the shared refraction and environment bind group layout'
  );
});

test('native WebGPU surface consumer uses a same-queue submission boundary', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /resolveNativeSurfaceSubmitSynchronization\(\{[\s\S]*?rendererBridge: bridge\?\.rendererBridge[\s\S]*?if \(!submitSynchronization\.requiresCpuQueueFence\)/,
    'native surface submissions should resolve the executable synchronization policy before requesting a queue fence'
  );
  assert.match(
    sceneSource,
    /resident-surface-draw-submit-same-queue-submission-boundary/,
    'native surface submission telemetry should report the ordered queue boundary'
  );
  assert.match(
    sceneSource,
    /flushSphNativeWebGpuSurfaceDeferredResourceReleases\(bridge, \{\s*reason: 'native-webgpu-surface-submit-boundary'/,
    'inactive generations should retire after their final referring command buffer is submitted'
  );
  assert.match(
    sceneSource,
    /const controlsChanged = controls\.update\(\) === true;/,
    'native surface rendering should observe camera changes before deciding whether to redraw'
  );
  assert.match(
    sceneSource,
    /resolveNativeSurfaceAnimationFramePolicy\(\{[\s\S]*?cameraDirty: nativeSurfaceCameraDirty,[\s\S]*?stateDirty: nativeSurfaceStateDirty,[\s\S]*?controlsChanged,[\s\S]*?continuousRedraw: nativeContinuousRedraw[\s\S]*?if \(rendered && nativeAnimationFrameDrawRequired\)/,
    'native surfaces should redraw for camera/state changes without continuously resubmitting an unchanged 466k-vertex frame'
  );
  assert.match(
    sceneSource,
    /const overlayRendered = renderSphResidentSurfaceDrawOverlay\([\s\S]*?if \(nativeBridge && overlayRendered\) \{[\s\S]*?nativeSurfaceCameraDirty = false;[\s\S]*?nativeSurfaceStateDirty = false;/,
    'native presentation invalidations must remain dirty until a surface draw is actually submitted'
  );
  assert.match(
    sceneSource,
    /nativeSurfaceConsumerContinuousRaf === true/,
    'continuous native RAF should remain an explicit diagnostic opt-in'
  );
  assert.doesNotMatch(
    sceneSource,
    /scheduleSphNativeWebGpuSurfaceConsumerFrame\(\{\s*reason: 'native-webgpu-surface-consumer-bridge-(?:ready|reused)'/,
    'native bridge creation/reuse should not schedule an extra RAF render on top of the caller-owned draw'
  );
  assert.doesNotMatch(
    sceneSource,
    /if \(bridge\.rendererBridge === SPH_NATIVE_WEBGPU_SURFACE_CONSUMER_BRIDGE_MODE\) \{\s*scheduleSphNativeWebGpuSurfaceConsumerFrame\(\);\s*\}/,
    'a completed native draw must not unconditionally schedule another draw and defeat on-demand rendering'
  );
  assert.doesNotMatch(
    sceneSource,
    /skipped-native-webgpu-surface-consumer/,
    'native surface draws should not fall through the obsolete bridge-skip path'
  );
});

test('native WebGPU environment loads invalidate one on-demand frame without a second RAF loop', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /image\.onload = \(\) => \{[\s\S]*?invalidateSphNativeWebGpuSurfaceFrame\(\s*bridge,\s*'native-surface-background-or-environment-image-loaded'/,
    'an asynchronously uploaded background or environment texture must invalidate native presentation state'
  );
  assert.doesNotMatch(
    sceneSource,
    /native-surface-background-or-environment-image-loaded'[\s\S]{0,300}scheduleSphNativeWebGpuSurfaceConsumerFrame/,
    'the regular animation frame should consume the invalidation without starting a second RAF loop'
  );
});

test('additional native surface publication invalidates the on-demand composite frame', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /bridge\.drawState\.additionalSurfaceDraws = draws;[\s\S]{0,1000}invalidateSphNativeWebGpuSurfaceFrame\(\s*bridge,\s*'additional-native-surface-draws-attached'/,
    'secondary surfaces published after the primary draw must invalidate the retained water-only frame'
  );
  assert.doesNotMatch(
    sceneSource,
    /additional-native-surface-draws-attached'[\s\S]{0,300}scheduleSphNativeWebGpuSurfaceConsumerFrame/,
    'secondary publication should be consumed by the existing animation loop, not a second RAF loop'
  );
});

test('native diagnostics bound prototype trace installation retries', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(
    probeSource,
    /queueFenceTraceInstallAttempts < 200[\s\S]*?setTimeout\(installQueueFenceTrace, 10\)/,
    'queue-fence trace installation retries must be finite and yield between attempts'
  );
  assert.match(
    probeSource,
    /deviceDestroyTraceInstallAttempts < 200[\s\S]*?setTimeout\(installDeviceDestroyTrace, 10\)/,
    'device-destroy trace installation retries must be finite and yield between attempts'
  );
});

test('direct resident chemistry probes match the interactive product tier and retain reaction evidence', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');

  assert.match(
    probeSource,
    /const driverOptions = \{[\s\S]*?allowReducedProductProperties: true/,
    'direct probes must use the same explicitly admitted reduced product closure as the live scene'
  );
  assert.match(
    probeSource,
    /params\.get\('sdt'\)[\s\S]*?\{ dt: value \}[\s\S]*?params\.get\('avAlpha'\)[\s\S]*?mlsMpmArtificialViscosityAlpha: value/,
    'direct probes must honor the live preview timestep and artificial-viscosity controls'
  );
  assert.match(probeSource, /productClosurePolicy: 'interactive-reduced-product-properties'/);
  assert.match(
    probeSource,
    /reactionEvidence: \{[\s\S]*?canonicalEventCount:[\s\S]*?gasSpeciesLedger:/,
    'compact probe serialization must preserve already-available reaction evidence without a new readback'
  );
  assert.match(
    probeSource,
    /reactionProgressEventCount\(evidence\)[\s\S]*?Math\.max\(\.\.\.counts\)/,
    'placed reaction products must retain event-count evidence after the active event row is consumed'
  );
});

test('reaction evidence groups product terms by reaction without losing condensed-only chemistry', () => {
  assert.equal(groupedReactionEventCount([
    { reactionIndex: 0, productTermIndex: 0, eventCount: 5 },
    { reactionIndex: 0, productTermIndex: 1, eventCount: 5 },
    { reactionIndex: 1, productTermIndex: 2, eventCount: 3 }
  ]), 8);
  assert.equal(reactionLedgerEventCount({
    productInventory: {
      records: [
        { reactionIndex: 4, material: 'condensed-a', eventCount: 7 },
        { reactionIndex: 4, material: 'condensed-b', eventCount: 7 }
      ]
    },
    gasSpeciesLedger: { records: [] }
  }), 7);
});

test('reaction evidence falls back to grouped gas ledger when product inventory was not run', () => {
  assert.equal(reactionLedgerEventCount({
    productInventory: { records: [] },
    gasSpeciesLedger: {
      records: [
        { reactionIndex: 0, material: 'gas-a', eventCount: 9 },
        { reactionIndex: 0, material: 'gas-b', eventCount: 9 }
      ]
    }
  }), 9);
});

test('reaction evidence does not let a zero product snapshot mask placed gas events', () => {
  assert.equal(reactionLedgerEventCount({
    productInventory: {
      records: [{ reactionIndex: 0, material: 'condensed', eventCount: 0 }]
    },
    gasSpeciesLedger: {
      records: [{ reactionIndex: 0, material: 'gas', eventCount: 9 }]
    }
  }), 9);
});

test('reaction progress groups placed product terms without double-counting one reaction', () => {
  const records = [
    { reactionIndex: 0, productTermIndex: 0, placedEventCount: 9 },
    { reactionIndex: 0, productTermIndex: 1, placedEventCount: 4 },
    { reactionIndex: 1, productTermIndex: 2, placedEventCount: 3 }
  ];
  assert.equal(groupedPlacedReactionEventCount(records), 12);
  assert.equal(reactionProgressEventCount({
    canonicalEventCount: 0,
    productEventActiveEventCount: 0,
    gasSpeciesLedger: { records: [] },
    productPlacementProvenance: { records }
  }), 12);
});

test('native WebGPU surface diagnostics distinguish opaque refraction and prove zero-submit normals', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  for (const field of [
    'renderBridgeLastRefractiveDrawCount',
    'renderBridgeConfiguredAlphaMode',
    'renderBridgeSurfaceBlendEnabled',
    'renderBridgePackedNormalReady',
    'renderBridgePackedNormalAdditionalSubmitCount',
    'renderBridgeVertexTemperatureReady',
    'renderBridgeVertexTemperatureByteLength',
    'renderBridgeVertexTemperatureRowCount',
    'renderBridgeVertexTemperatureEncoding',
    'renderBridgeVertexTemperatureSurfaceGenerationId',
    'renderBridgeVertexTemperatureVolumeGenerationId',
    'renderBridgeVertexTemperatureAdditionalSubmitCount',
    'renderBridgeVertexTemperatureAdditionalReadyCount',
    'renderBridgeRefractionTargetLifecycleStatus',
    'renderBridgeRefractionTargetGeneration',
    'renderBridgeRefractionBackfaceStatus',
    'renderBridgeRefractionBackfaceAdditionalSubmitCount',
    'renderBridgeBackgroundImageGpuStatus'
  ]) {
    assert.match(sceneSource, new RegExp(field));
  }
  assert.match(
    sceneSource,
    /allowExtensionDrawIndirectBuffer: renderBridgePlan\.useNativeWebGpuSurfaceConsumerBridge/,
    'the primary native draw should reuse the extension indirect buffer without a translation submit'
  );
  assert.match(
    sceneSource,
    /refractionTargetLifecycleStatus = 'target-set-created';\s*bridge\.refractionTargetLifecycleReason = null;/,
    'a successful refraction allocation must clear stale failure diagnostics'
  );
  assert.match(
    sceneSource,
    /backgroundImageGpuStatus = 'native-opaque-background-image-ready';\s*bridge\.backgroundImageGpuReason = null;/,
    'a successful background upload must clear stale failure diagnostics'
  );
  assert.match(
    sceneSource,
    /refractionTargetsRequired[\s\S]*?'native-refractive-backface-depth-required-unavailable'/,
    'missing rear depth must be reported as unavailable when a refractive draw requires it'
  );
  assert.match(
    sceneSource,
    /translateVertexRows: false,\s*allowExtensionDrawIndirectBuffer: true,/,
    'additional native surfaces should also reuse their extension indirect buffers'
  );
  assert.match(
    sceneSource,
    /nativeDrawInput\.temperatureBuffer \|\| bridge\.temperatureDummyBuffer/,
    'additional native draws must bind generation-owned vertex temperatures at binding 5'
  );
  assert.match(
    sceneSource,
    /nativeDrawInput\.temperatureBuffer \|\| previousBridge\.temperatureDummyBuffer/,
    'reused native bridges must bind the new primary temperature generation'
  );
  assert.match(
    sceneSource,
    /nativeDrawInput\.temperatureBuffer \|\| temperatureDummyBuffer/,
    'fresh native bridges must bind a fail-closed temperature fallback'
  );
  assert.match(
    sceneSource,
    /previousBridge\.temperatureDummyBuffer/,
    'the native bridge reuse gate must reject layouts predating binding 5'
  );
  assert.match(
    sceneSource,
    /encodeAndSubmitNativeSurfaceTemperatureRows\([\s\S]*?descriptor: nativeDescriptor/,
    'primary native extraction must encode its immutable temperature stream'
  );
  assert.match(
    sceneSource,
    /encodeAndSubmitNativeSurfaceTemperatureRows\([\s\S]*?descriptor: additionalDescriptor/,
    'additional native extractions must encode their own temperature streams'
  );
  assert.match(
    sceneSource,
    /destroyNativeSurfaceTemperatureRowsOnce\(\s*temperatureRetirement\.exactTemperatureRows,\s*temperatureRetirement\.exactDestroyMethod\s*\)/,
    'temperature buffers must retire through the privately authenticated generation-owned destroy hook'
  );
  assert.match(
    sceneSource,
    /destroyNativeSurfaceTemperatureRowsOnce\(\s*temperatureRetirement\.strayTemperatureRows\s*\)/,
    'a replaced public temperature alias must be retired separately without substituting for the authenticated generation'
  );
});

test('native WebGPU resource retirement uses same-queue and liveness boundaries', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /resourceReleaseBlocked: sphNativeWebGpuSurfaceResourceReleaseBlocked\(bridge\)/,
    'target replacement should defer only while a real validation or ownership reference remains live'
  );
  assert.match(
    sceneSource,
    /retired-after-liveness-boundary/,
    'retirement diagnostics should describe their actual liveness contract'
  );
  assert.doesNotMatch(
    sceneSource,
    /const nativeConsumerFence|nativeSurfaceConsumerInFlightSubmitCount = Math\.max\([\s\S]*?\) \+ 1;/,
    'the native same-queue path must not retain dead per-frame CPU fence accounting'
  );
});

test('native successor validation discards mapped bytes on every scoped GPU error', async () => {
  for (const injectedFilter of ['validation', 'internal', 'out-of-memory']) {
    const pushed = [];
    const popped = [];
    const device = {
      pushErrorScope(filter) {
        pushed.push(filter);
      },
      async popErrorScope() {
        const filter = pushed[pushed.length - popped.length - 1];
        popped.push(filter);
        return filter === injectedFilter
          ? {
              name: injectedFilter === 'out-of-memory'
                ? 'GPUOutOfMemoryError'
                : (injectedFilter === 'internal'
                  ? 'GPUInternalError'
                  : 'GPUValidationError'),
              message: `injected ${injectedFilter} candidate command failure`
            }
          : null;
      }
    };
    const stalePriorGenerationBytes = new Uint8Array([255, 255, 255, 255]);
    let completionCount = 0;
    let discardCount = 0;
    const result =
      await runSphNativeSurfaceCandidateValidationTransaction({
        device,
        transaction: () => ({ submitted: true }),
        completeTransaction: async () => {
          completionCount += 1;
          return {
            status: 'mapped',
            bytes: stalePriorGenerationBytes
          };
        },
        discardTransaction: () => {
          discardCount += 1;
        }
      });

    assert.equal(result.ok, false, injectedFilter);
    assert.equal(
      result.status,
      'native-surface-candidate-validation-transaction-error'
    );
    assert.equal(result.transactionValue, null);
    assert.equal(result.transactionValueDiscarded, true);
    assert.match(result.reason, new RegExp(`injected ${injectedFilter}`));
    assert.deepEqual(pushed, ['validation', 'internal', 'out-of-memory']);
    assert.deepEqual(popped, ['out-of-memory', 'internal', 'validation']);
    assert.equal(completionCount, 0, 'mapping must not start after a scoped error');
    assert.equal(discardCount, 1, 'the submitted readback must be poisoned once');
  }
});

test('native successor validation settles scopes after an injected submit throw', async () => {
  const activeFilters = [];
  const popped = [];
  const result = await runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
      },
      async popErrorScope() {
        const filter = activeFilters.pop();
        popped.push(filter);
        return null;
      }
    },
    transaction: () => {
      throw new Error('injected synchronous queue submit failure');
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.transactionValueDiscarded, false);
  assert.match(result.reason, /injected synchronous queue submit failure/);
  assert.deepEqual(popped, ['out-of-memory', 'internal', 'validation']);
});

test('native successor validation fails closed when WebGPU error scopes are unavailable', async () => {
  let submissionCount = 0;
  let completionCount = 0;
  let discardCount = 0;
  const result = await runSphNativeSurfaceCandidateValidationTransaction({
    device: {},
    transaction: () => {
      submissionCount += 1;
      return { submitted: true };
    },
    completeTransaction: async () => {
      completionCount += 1;
    },
    discardTransaction: () => {
      discardCount += 1;
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorScopeSupported, false);
  assert.equal(result.transactionValue, null);
  assert.equal(result.transactionValueDiscarded, false);
  assert.equal(submissionCount, 0);
  assert.equal(completionCount, 0);
  assert.equal(discardCount, 0);
  assert.match(result.reason, /requires WebGPU error scope support/);
  assert.equal(result.errors[0]?.source, 'error-scope-unsupported');
});

test('native successor validation closes GPU scopes before readback completion', async () => {
  const order = [];
  const activeFilters = [];
  const result = await runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
        order.push(`push:${filter}`);
      },
      async popErrorScope() {
        const filter = activeFilters.pop();
        order.push(`pop:${filter}`);
        return null;
      }
    },
    transaction: () => {
      order.push('submit');
      return { readback: 'pooled-16k' };
    },
    completeTransaction: async (submission) => {
      assert.equal(submission.readback, 'pooled-16k');
      order.push('mapAsync');
      return { status: 'mapped', bytes: new Uint8Array([1, 2, 3, 4]) };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(Number.isFinite(result.errorScopesMs), true);
  assert.ok(result.errorScopesMs >= 0);
  assert.deepEqual(order, [
    'push:validation',
    'push:internal',
    'push:out-of-memory',
    'submit',
    'pop:out-of-memory',
    'pop:internal',
    'pop:validation',
    'mapAsync'
  ]);
});

test('native successor validation may overlap a map request but never consumes it before clean scopes', async () => {
  const order = [];
  const activeFilters = [];
  const pendingPops = [];
  let resolveMap = null;
  const resultPromise = runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
        order.push(`push:${filter}`);
      },
      popErrorScope() {
        const filter = activeFilters.pop();
        order.push(`pop:${filter}`);
        return new Promise((resolve) => pendingPops.push({ filter, resolve }));
      }
    },
    transaction: () => {
      order.push('submit');
      return { submitted: true };
    },
    startCompletion: () => {
      const mapPromise = new Promise((resolve) => {
        resolveMap = () => {
          order.push('map-resolved');
          resolve('mapped');
        };
      });
      order.push('mapAsync');
      return { mapPromise };
    },
    completeTransaction: async (_submission, completionStart) => {
      order.push('readback-consume');
      assert.equal(await completionStart.mapPromise, 'mapped');
      return { status: 'mapped' };
    }
  });

  assert.deepEqual(order, [
    'push:validation',
    'push:internal',
    'push:out-of-memory',
    'submit',
    'pop:out-of-memory',
    'pop:internal',
    'pop:validation',
    'mapAsync'
  ]);
  resolveMap();
  await Promise.resolve();
  assert.equal(order.includes('readback-consume'), false);

  pendingPops.find(({ filter }) => filter === 'validation').resolve(null);
  pendingPops.find(({ filter }) => filter === 'internal').resolve(null);
  await Promise.resolve();
  assert.equal(order.includes('readback-consume'), false);

  pendingPops.find(({ filter }) => filter === 'out-of-memory').resolve(null);
  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.ok(
    order.indexOf('readback-consume') > order.indexOf('pop:validation'),
    'a prestarted MAP_READ request must not grant access before every scope settles clean'
  );
});

test('native successor validation preserves a timeout-first map outcome through delayed scope reports', async () => {
  const activeFilters = [];
  const pendingPops = [];
  const order = [];
  let settleMapOutcome = null;
  let resolveLateMap = null;
  let mappedByteAccessCount = 0;
  const readbackBuffer = {
    getMappedRange() {
      mappedByteAccessCount += 1;
      return new Uint8Array([1, 2, 3, 4]);
    }
  };
  const resultPromise = runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
      },
      popErrorScope() {
        const filter = activeFilters.pop();
        return new Promise((resolve) => pendingPops.push({ filter, resolve }));
      }
    },
    transaction: () => ({ submitted: true }),
    startCompletion: () => {
      const mapOutcome = new Promise((resolve) => {
        settleMapOutcome = resolve;
      });
      const mapPromise = new Promise((resolve) => {
        resolveLateMap = resolve;
      });
      order.push('map-requested');
      return { mapOutcome, mapPromise, readbackBuffer };
    },
    completeTransaction: async (_submission, completionStart) => {
      order.push('completion');
      const outcome = await completionStart.mapOutcome;
      if (outcome.status !== 'timeout') {
        completionStart.readbackBuffer.getMappedRange();
      }
      assert.equal(outcome.status, 'timeout');
      assert.equal(mappedByteAccessCount, 0, 'a timeout-first outcome must not consume mapped bytes');
      return {
        status: 'not-run',
        reason: 'candidate staged presentation color-difference proof timed out'
      };
    }
  });

  assert.deepEqual(order, ['map-requested']);
  settleMapOutcome({ status: 'timeout' });
  resolveLateMap('mapped-after-deadline');
  await Promise.resolve();
  assert.equal(
    order.includes('completion'),
    false,
    'scope reports remain the admission gate even after a map deadline settles'
  );

  for (const { resolve } of pendingPops) resolve(null);
  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.transactionValue?.status, 'not-run');
  assert.match(result.transactionValue?.reason || '', /timed out/);
  assert.equal(mappedByteAccessCount, 0);
});

test('native successor validation discards a prestarted map after a scoped error without access', async () => {
  const activeFilters = [];
  const pendingPops = [];
  let completionCount = 0;
  let discardedHandle = null;
  const resultPromise = runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
      },
      popErrorScope() {
        const filter = activeFilters.pop();
        return new Promise((resolve) => pendingPops.push({ filter, resolve }));
      }
    },
    transaction: () => ({ submitted: true }),
    startCompletion: () => ({
      mapPromise: Promise.resolve('mapped-looking-stale-prior-generation-bytes')
    }),
    completeTransaction: async () => {
      completionCount += 1;
      return { status: 'mapped' };
    },
    discardTransaction: (_submission, completionStart) => {
      discardedHandle = completionStart;
    }
  });

  pendingPops.find(({ filter }) => filter === 'out-of-memory').resolve(null);
  pendingPops.find(({ filter }) => filter === 'internal').resolve(null);
  pendingPops.find(({ filter }) => filter === 'validation').resolve({
    name: 'GPUValidationError',
    message: 'injected scope failure after MAP_READ request'
  });
  const result = await resultPromise;

  assert.equal(result.ok, false);
  assert.equal(result.transactionValue, null);
  assert.equal(completionCount, 0);
  assert.equal(
    await discardedHandle?.mapPromise,
    'mapped-looking-stale-prior-generation-bytes'
  );
  assert.match(result.reason, /scope failure after MAP_READ request/);
});

test('native successor validation never starts a map after a synchronous pop failure', async () => {
  const activeFilters = [];
  let startCount = 0;
  let completionCount = 0;
  let discardCount = 0;
  const result = await runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
      },
      popErrorScope() {
        const filter = activeFilters.pop();
        if (filter === 'out-of-memory') {
          throw new Error('injected synchronous scope-pop failure');
        }
        return Promise.resolve(null);
      }
    },
    transaction: () => ({ submitted: true }),
    startCompletion: () => {
      startCount += 1;
      return { mapPromise: Promise.resolve('must-not-start') };
    },
    completeTransaction: async () => {
      completionCount += 1;
    },
    discardTransaction: () => {
      discardCount += 1;
    }
  });

  assert.equal(result.ok, false);
  assert.equal(startCount, 0);
  assert.equal(completionCount, 0);
  assert.equal(discardCount, 1);
  assert.match(result.reason, /synchronous scope-pop failure/);
});

test('native successor validation starts every LIFO scope pop before awaiting any result', async () => {
  const order = [];
  const activeFilters = [];
  const pendingPops = [];
  let completionCount = 0;
  const resultPromise = runSphNativeSurfaceCandidateValidationTransaction({
    device: {
      pushErrorScope(filter) {
        activeFilters.push(filter);
        order.push(`push:${filter}`);
      },
      popErrorScope() {
        const filter = activeFilters.pop();
        order.push(`pop:${filter}`);
        return new Promise((resolve) => {
          pendingPops.push({ filter, resolve });
        });
      }
    },
    transaction: () => {
      order.push('submit');
      return { readback: 'pooled-16k' };
    },
    completeTransaction: async () => {
      completionCount += 1;
      order.push('mapAsync');
      return { status: 'mapped' };
    }
  });

  assert.deepEqual(order, [
    'push:validation',
    'push:internal',
    'push:out-of-memory',
    'submit',
    'pop:out-of-memory',
    'pop:internal',
    'pop:validation'
  ]);
  assert.equal(completionCount, 0);

  pendingPops.find(({ filter }) => filter === 'internal').resolve(null);
  await Promise.resolve();
  assert.equal(completionCount, 0, 'mapping waits for every scope result');

  pendingPops.find(({ filter }) => filter === 'validation').resolve(null);
  await Promise.resolve();
  assert.equal(completionCount, 0, 'mapping waits for the final scope result');

  pendingPops.find(({ filter }) => filter === 'out-of-memory').resolve(null);
  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(completionCount, 1);
  assert.deepEqual(order.at(-1), 'mapAsync');
});

test('probe preserves first critical GPU faults after console and issue caps', () => {
  const capture = createBrowserConsoleCapture();
  for (let index = 0; index < 510; index += 1) {
    capture.recordConsole({
      type: () => 'warning',
      text: () => `[Invalid Buffer] injected capped warning ${index}`,
      location: () => ({
        url: 'https://probe.invalid/',
        lineNumber: index,
        columnNumber: 0
      })
    });
  }
  capture.recordConsole({
    type: () => 'error',
    text: () => '[ulg-gpu-uncaptured-error:GPUOutOfMemoryError] injected oom'
  });
  capture.recordConsole({
    type: () => 'error',
    text: () => '[ulg-gpu-device-lost] reason=unknown message=injected loss'
  });
  capture.recordConsole({
    type: () => 'error',
    text: () => '[ulg-gpu-uncaptured-error:GPUValidationError] injected invalid command'
  });

  const summary = capture.summary();
  assert.equal(summary.retainedEntryCount, 500);
  assert.equal(summary.retainedIssueCount, 200);
  assert.ok(summary.droppedEntryCount > 0);
  assert.ok(summary.droppedIssueCount > 0);
  assert.equal(summary.firstCriticalGpuMessage.category, 'out-of-memory');
  assert.match(summary.firstCriticalGpuMessage.text, /injected oom/);
  assert.match(
    summary.firstCriticalGpuMessagesByCategory['device-lost'].text,
    /injected loss/
  );
  assert.match(
    summary.firstCriticalGpuMessagesByCategory['uncaptured-error'].text,
    /injected invalid command/
  );
});

test('native composite staging validates asynchronously before a short irreversible publication', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const mountSource = readRepoFile('src/visualization/sphPhaseDemoMount.js');
  const lifecycleSource = readRepoFile(
    'src/visualization/nativeSurfaceResourceLifecycle.js'
  );

  assert.match(
    sceneSource,
    /queue\.submit\(\[encoder\.finish\(\)\]\);\s*primaryFrameSubmitted = true;\s*if \(!stageOnly\) markSphNativeSurfaceRenderBridgeFirstFrameSubmitted\(bridge\);/,
    'only a visible normal submit may latch the transaction immediately after the primary submit returns'
  );
  const stagedPresenter = sceneSource.match(
    /function presentStagedSphNativeSurfaceCandidateComposite\([\s\S]*?\n  function prepareSphNativeWebGpuSurfaceForegroundValidationGeneration/
  )?.[0] || '';
  assert.match(
    stagedPresenter,
    /encoder\.copyTextureToTexture\([\s\S]*?queue\.submit\(\[encoder\.finish\(\)\]\);\s*submitted = true;\s*markSphNativeSurfaceRenderBridgeFirstFrameSubmitted\(bridge\);/,
    'the staged route may latch only after its private composite has been copied to the visible canvas'
  );
  assert.match(
    sceneSource,
    /function snapshotStagedSphNativeSurfaceCandidatePresentationTiming\([\s\S]*?return Object\.freeze\(\{[\s\S]*?proofTotalMs: Number\.isFinite\(originAtMs\)[\s\S]*?\}\);/,
    'candidate proof telemetry must publish an immutable CPU-wall-clock receipt only after validation settles'
  );
  assert.match(
    sceneSource,
    /const timing = \{[\s\S]*?schema: 'peercompute\.ulg\.sph-native-surface-candidate-presentation-timing\.v0',[\s\S]*?targetAllocationMs: null,[\s\S]*?stageRenderSubmitMs: null,[\s\S]*?errorScopesMs: null,[\s\S]*?mapMs: null,[\s\S]*?presentationCopySubmitMs: null,/,
    'candidate proof telemetry must name the allocation, submit, scope, map, and final-copy phases explicitly'
  );
  assert.match(
    sceneSource,
    /const targetAllocationStartedAtMs = nowMs\(\);[\s\S]*?ensureStagedSphNativeSurfaceCandidatePresentationTargets\([\s\S]*?timing\.targetAllocationMs = Math\.max\(/,
    'candidate proof telemetry must time the private-target allocation boundary without adding GPU synchronization'
  );
  assert.match(
    sceneSource,
    /const stageRenderSubmitStartedAtMs = nowMs\(\);[\s\S]*?renderSphResidentSurfaceDrawOverlay\([\s\S]*?\} finally \{[\s\S]*?timing\.stageRenderSubmitMs = Math\.max\(/,
    'candidate proof telemetry must time the synchronous private-stage encode and submit path even when it throws'
  );
  assert.match(
    sceneSource,
    /const errorScopesMs = Math\.max\(0, nowMs\(\) - errorScopesStartedAtMs\);[\s\S]*?errorScopesMs,/,
    'GPU error-scope settlement latency must remain separately observable from map latency'
  );
  assert.match(
    sceneSource,
    /const mapTiming = \{[\s\S]*?startedAtMs: null,[\s\S]*?settledAtMs: null,[\s\S]*?deadlineAtMs: null[\s\S]*?const mapRequestedAtMs = nowMs\(\);[\s\S]*?mapTiming\.startedAtMs = mapRequestedAtMs;[\s\S]*?mapTiming\.deadlineAtMs = mapRequestedAtMs[\s\S]*?mapTiming\.settledAtMs = nowMs\(\);[\s\S]*?\} finally \{[\s\S]*?timing\.mapMs = Math\.max\(/,
    'candidate proof telemetry must time MAP_READ from its request deadline through every completion outcome in a finally path'
  );
  assert.match(
    stagedPresenter,
    /queue\.submit\(\[encoder\.finish\(\)\]\);\s*submitted = true;\s*markSphNativeSurfaceRenderBridgeFirstFrameSubmitted\(bridge\);\s*const presentationCopySubmittedAtMs = nowMs\(\);[\s\S]*?presentationCopySubmitMs: Math\.max\([\s\S]*?bridge\.nativeSurfaceCandidateStagedPresentationTiming = presentationTiming;/,
    'final-copy telemetry may be published only after the visible copy has submitted and the first-frame latch is irrevocable'
  );
  assert.doesNotMatch(
    stagedPresenter,
    /drawIndirect\(/,
    'staged publication must not encode a second geometry draw after proof admission'
  );
  assert.match(
    stagedPresenter,
    /copyTextureToTexture\(\s*\{ texture: targets\.texture \},\s*\{ texture: canvasTexture \}/,
    'staged publication must promote the proven private composite with a direct same-device texture copy'
  );
  assert.doesNotMatch(
    stagedPresenter,
    /renderSphResidentSurfaceDrawOverlay\(|beginRenderPass\(/,
    'the visible staged route must not hide a second render path behind a renderer or render pass call'
  );
  assert.match(
    stagedPresenter,
    /const bridgeRecord = record\?\.renderBridgeCandidate[\s\S]*?sphNativeSurfaceRenderBridgeTransactionRecord\([\s\S]*?record\.renderBridgeCandidate[\s\S]*?bridgeRecord\.candidatePresentationTargets !== targets[\s\S]*?targets\.candidateRecord !== bridgeRecord[\s\S]*?targets\.candidateBridge !== record\.renderBridgeCandidate/,
    'the copy admission must resolve the native-bridge transaction record instead of comparing its target ownership to the distinct resident-draw record'
  );
  assert.match(
    stagedPresenter,
    /validateSphNativeSurfaceCandidatePresentationSnapshot\([\s\S]*?record: bridgeRecord[\s\S]*?validateSphNativeSurfaceCandidatePresentationSnapshot\([\s\S]*?record: bridgeRecord/,
    'both pre- and post-acquire freshness checks must retain the bridge-record identity captured before the private submission'
  );
  assert.match(
    stagedPresenter,
    /nativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount = 0;/,
    'the publication receipt must report that no geometry was submitted after proof admission'
  );
  const stagedBasePassIndex = sceneSource.indexOf(
    'const basePass = encoder.beginRenderPass({'
  );
  const stagedOpaquePassIndex = sceneSource.indexOf(
    'const opaquePass = encoder.beginRenderPass({',
    stagedBasePassIndex
  );
  const stagedBaseBoxPassIndex = sceneSource.indexOf(
    'const stagedBaseBoxPass = encoder.beginRenderPass({',
    stagedOpaquePassIndex
  );
  assert.ok(
    stagedBasePassIndex >= 0
      && stagedOpaquePassIndex > stagedBasePassIndex
      && stagedBaseBoxPassIndex > stagedOpaquePassIndex,
    'the staged proof must initialize both proof textures, draw candidate opaque geometry once, then match baseline chrome'
  );
  const stagedBaseInitPass = sceneSource.slice(
    stagedBasePassIndex,
    stagedOpaquePassIndex
  );
  assert.match(
    stagedBaseInitPass,
    /colorAttachments: \[\{[\s\S]*?view: presentationTarget\.baseView,[\s\S]*?\}, \{[\s\S]*?view: canvasView,/,
    'one staged pass must initialize distinct baseline and composite attachments together'
  );
  assert.match(
    stagedBaseInitPass,
    /drawSphNativeSurfaceBackgroundImage\(bridge, basePass, \{[\s\S]*?stagedMrt: true/,
    'an active background image must sample once and write the same value to both proof textures'
  );
  assert.doesNotMatch(
    stagedBaseInitPass,
    /encoder\.copyTextureToTexture\(/,
    'the staged proof must not copy the baseline into the composite before geometry'
  );
  assert.doesNotMatch(
    stagedBaseInitPass,
    /drawSphNativeSurfaceBoxWireframe\(/,
    'the baseline must not paint static chrome before candidate depth exists'
  );
  assert.doesNotMatch(
    stagedBaseInitPass,
    /drawIndirect\(/,
    'the baseline must contain background and clear only, never candidate geometry'
  );
  const stagedBaseBoxPass = sceneSource.slice(
    stagedBaseBoxPassIndex,
    sceneSource.indexOf('const refractionTargetsRequired', stagedBaseBoxPassIndex)
  );
  assert.match(
    stagedBaseBoxPass,
    /view: presentationTarget\.baseView,[\s\S]*?view: depthView,[\s\S]*?depthLoadOp: 'load',[\s\S]*?drawSphNativeSurfaceBoxWireframe\([\s\S]*?stagedBaseBoxPass/,
    'the proof baseline must receive the static box with the candidate depth already established'
  );
  const stagedCandidateOpaqueSegment = sceneSource.slice(
    stagedOpaquePassIndex,
    stagedBaseBoxPassIndex
  );
  assert.equal(
    stagedCandidateOpaqueSegment.match(/const opaquePass = encoder\.beginRenderPass\(/g)?.length,
    1,
    'the private stage must encode exactly one opaque candidate render pass'
  );
  assert.equal(
    stagedCandidateOpaqueSegment.match(/for \(const draw of opaqueDraws\)/g)?.length,
    1,
    'the private stage must walk its primary opaque candidate draws once'
  );
  assert.equal(
    stagedCandidateOpaqueSegment.match(/for \(const additionalDraw of additionalOpaqueDraws\)/g)?.length,
    1,
    'the private stage must walk its additional opaque candidate draws once'
  );
  assert.equal(
    stagedCandidateOpaqueSegment.match(/opaquePass\.drawIndirect\(/g)?.length,
    2,
    'the one opaque pass may issue primary and additional candidate indirect draws, but no duplicate candidate pass'
  );
  assert.match(
    stagedCandidateOpaqueSegment,
    /if \(stagedStaticBoxRequired\) \{[\s\S]*?drawSphNativeSurfaceBoxWireframe\(bridge, opaquePass, viewProjection\);[\s\S]*?opaquePass\.end\(\);/,
    'the private composite must receive its matching static box in the already-open opaque pass'
  );
  assert.doesNotMatch(
    stagedCandidateOpaqueSegment,
    /stagedCompositeBoxPass/,
    'the staged path must not reopen a redundant composite-only chrome pass'
  );
  assert.doesNotMatch(
    stagedBaseBoxPass,
    /drawIndirect\(/,
    'the remaining baseline chrome pass must not duplicate candidate geometry'
  );
  assert.match(
    sceneSource,
    /record\.candidatePresentationTargets = targets;[\s\S]*?sphNativeSurfaceCandidatePresentationStagingTargetSet\.add\(targets\);/,
    'full-resolution staging targets must be candidate-owned rather than reused by an unrelated validation'
  );
  const stagedTargetAllocation = sceneSource.slice(
    sceneSource.indexOf('targets.texture = device.createTexture({'),
    sceneSource.indexOf('const diff = createStagedSphNativeSurfaceCandidatePresentationDiffPipeline(device);')
  );
  assert.doesNotMatch(
    stagedTargetAllocation,
    /GPU_TEXTURE_USAGE\.COPY_DST/,
    'MRT initialization must not retain the old baseline-to-composite copy destination usage'
  );
  assert.match(
    sceneSource,
    /function ensureSphNativeSurfaceBackgroundRenderer\(bridge\) \{[\s\S]*?entryPoint: 'fs_staged_mrt_main',[\s\S]*?targets: \[\{ format: bridge\.format \}, \{ format: bridge\.format \}\][\s\S]*?stagedMrtPipeline/,
    'the background renderer must own a distinct two-attachment pipeline for candidate staging'
  );
  assert.match(
    sceneSource,
    /const stagedMrtBindGroup = bridge\.device\.createBindGroup\([\s\S]*?layout: renderer\.stagedMrtPipeline\.getBindGroupLayout\(0\)[\s\S]*?renderer\.stagedMrtBindGroup = stagedMrtBindGroup/,
    'the auto-layout MRT pipeline must receive its own compatible background bind group'
  );
  assert.match(
    sceneSource,
    /backgroundImageRendererStagedMrtBindGroup:[\s\S]*?stagedMrtBindGroup[\s\S]*?'backgroundImageRendererStagedMrtBindGroup'/,
    'current-source snapshots must reject a changed dual-target background binding'
  );
  assert.match(
    sceneSource,
    /const backgroundMrtReady = !backgroundUrl \|\| Boolean\([\s\S]*?stagedMrtPipeline[\s\S]*?stagedMrtBindGroup[\s\S]*?const maxColorAttachments = Number\([\s\S]*?const dualColorAttachmentSupported = !Number\.isFinite\(maxColorAttachments\)[\s\S]*?&& backgroundMrtReady[\s\S]*?&& dualColorAttachmentSupported/,
    'candidate staging must fail closed unless its exact background MRT binding and two color attachments are available'
  );
  assert.doesNotMatch(
    sceneSource,
    /baseDepth(?:Texture|View)/,
    'the baseline background pass must share the candidate depth attachment instead of allocating a redundant full-resolution depth target'
  );
  assert.match(
    sceneSource,
    /stagedPresentationBytes: width \* height \* 12/,
    'candidate staging telemetry must account for composite color/depth plus baseline color only'
  );
  assert.match(
    sceneSource.slice(stagedBasePassIndex, stagedOpaquePassIndex),
    /depthStencilAttachment: \{[\s\S]*?view: depthView,[\s\S]*?depthLoadOp: 'clear'/,
    'the baseline must clear the shared private depth attachment before background rendering'
  );
  assert.match(
    sceneSource.slice(stagedOpaquePassIndex, stagedBaseBoxPassIndex),
    /const opaquePass = encoder\.beginRenderPass\([\s\S]*?depthStencilAttachment: depthView[\s\S]*?view: depthView,[\s\S]*?depthLoadOp: 'clear'/,
    'the opaque candidate pass must clear that shared depth attachment again before geometry'
  );
  const stagedCandidateDiffShader = sceneSource.match(
    /function createStagedSphNativeSurfaceCandidatePresentationDiffPipeline\(device\) \{[\s\S]*?return created;\n  \}/
  )?.[0] || '';
  assert.match(
    stagedCandidateDiffShader,
    /var<workgroup> workgroup_changed_pixels: array<u32, 64>;[\s\S]*?@builtin\(local_invocation_index\) local_index: u32[\s\S]*?workgroup_changed_pixels\[local_index\] = changed;[\s\S]*?workgroupBarrier\(\);[\s\S]*?for \(var index = 0u; index < 64u; index = index \+ 1u\)[\s\S]*?atomicAdd\(&changed_pixels\.value, workgroup_changed_count\);/,
    'the exact full-resolution foreground proof must reduce each 8x8 workgroup locally before issuing at most one global atomic add'
  );
  const stagedDiffCounterResetIndex = sceneSource.indexOf(
    'encoder.clearBuffer(',
    stagedOpaquePassIndex
  );
  const stagedDiffPassIndex = sceneSource.indexOf(
    "const diffPass = encoder.beginComputePass({",
    stagedDiffCounterResetIndex
  );
  assert.ok(
    stagedDiffCounterResetIndex > stagedOpaquePassIndex
      && stagedDiffPassIndex > stagedDiffCounterResetIndex,
    'the exact difference counter must reset inside the staged command buffer before the compute proof dispatch'
  );
  assert.match(
    sceneSource.slice(stagedDiffCounterResetIndex, stagedDiffPassIndex),
    /encoder\.clearBuffer\(\s*presentationTarget\.diffCounterBuffer,\s*0,\s*presentationTarget\.byteLength\s*\)/,
    'the candidate proof must use an ordered command-buffer clear rather than a separate queue write'
  );
  assert.doesNotMatch(
    sceneSource.slice(stagedOpaquePassIndex, stagedDiffPassIndex),
    /queue\.writeBuffer\(\s*presentationTarget\.diffCounterBuffer/,
    'the counter reset must not introduce an extra queue submission boundary'
  );
  assert.match(
    sceneSource,
    /const sphNativeSurfaceCandidatePresentationDiffPipelineCache = new WeakMap\(\);[\s\S]*?function createStagedSphNativeSurfaceCandidatePresentationDiffPipeline\(device\) \{[\s\S]*?const cached = sphNativeSurfaceCandidatePresentationDiffPipelineCache\.get\(device\);[\s\S]*?if \(cached\?\.module && cached\?\.pipeline\) return cached;[\s\S]*?sphNativeSurfaceCandidatePresentationDiffPipelineCache\.set\(device, created\);/,
    'candidate-private proof inputs may share only an immutable per-device diff pipeline cache'
  );
  assert.match(
    sceneSource,
    /function releaseStagedSphNativeSurfaceCandidatePresentationTargetsForDevice[\s\S]*?sphNativeSurfaceCandidatePresentationDiffPipelineCache\.delete\(device\);/,
    'a lost device must evict its cached immutable proof pipeline before another candidate can be admitted'
  );
  assert.match(
    sceneSource,
    /const sphNativeSurfaceBoxWireframePipelineCache = new WeakMap\(\);[\s\S]*?function ensureSphNativeSurfaceBoxWireframe[\s\S]*?sphNativeSurfaceBoxWireframePipelineCache\.get\(device\)[\s\S]*?pipelineByFormat\.get\(bridge\.format\)[\s\S]*?pipelineByFormat\.set\(bridge\.format, pipeline\);/,
    'the staged box may cache only its immutable device+format pipeline while retaining a candidate-owned uniform and bind group'
  );
  assert.match(
    sceneSource,
    /sphNativeSurfaceCandidatePresentationDiffPipelineCache\.delete\(device\);[\s\S]*?sphNativeSurfaceBoxWireframePipelineCache\.delete\(device\);/,
    'device loss must evict both immutable candidate-presentation pipeline caches'
  );
  assert.doesNotMatch(
    stagedCandidateDiffShader,
    /if \(id\.x >= dimensions\.x \|\| id\.y >= dimensions\.y\) \{\s*return;/,
    'partial edge workgroups must not return before the proof reducer barrier'
  );
  assert.match(
    sceneSource,
    /detachStagedSphNativeSurfaceCandidatePresentationReadbackBuffer\([\s\S]*?candidate-presentation-color-difference-map-timeout/,
    'a timed-out MAP_READ buffer must be detached instead of reused by the next candidate'
  );
  assert.match(
    sceneSource,
    /async function commitStagedSphResidentSurfaceDrawCandidate[\s\S]*?suppliedForegroundValidation[\s\S]*?resolveNativeSurfaceSuccessorPromotion\([\s\S]*?if \(!successorPromotion\.promoteCandidate\)[\s\S]*?activateSphNativeSurfaceRenderBridgeCandidate/,
    'an exact-generation nonzero foreground proof must precede bridge activation and visible publication'
  );
  assert.match(
    sceneSource,
    /scheduleStagedSphResidentSurfaceDrawCandidateValidation\([\s\S]*?native surface successor is validating while the last committed presentation remains visible/,
    'the refresh must enqueue validation and retain the prior presentation instead of awaiting the map'
  );
  assert.doesNotMatch(
    sceneSource,
    /await\s+candidateValidationRequest\.completion/,
    'Scene must keep staged candidate validation asynchronous; mounted scheduling owns presentation backpressure'
  );
  assert.match(
    sceneSource,
    /const sphNativeSurfaceCandidateCompletionHandoffs = new Map\(\);[\s\S]*?retainSphNativeSurfaceCandidateCompletionHandoff[\s\S]*?getSphNativeSurfaceCandidateValidationCompletion/,
    'Scene must expose only a bounded, scene-private exact candidate completion handoff rather than serializing a completion promise into render state'
  );
  assert.match(
    sceneSource,
    /function scheduleStagedSphResidentSurfaceDrawCandidateValidation[\s\S]*?const request = ensureSphNativeSurfaceCandidateValidationScheduler\(\)\.enqueue\(item\);[\s\S]*?retainSphNativeSurfaceCandidateCompletionHandoff\(\{[\s\S]*?request,[\s\S]*?preparation,[\s\S]*?residentRenderSource/,
    'each staged candidate must register its immutable source receipt before the asynchronous scheduler can settle it'
  );
  assert.doesNotMatch(
    sceneSource,
    /native-surface-candidate-validated-and-published[\s\S]{0,500}forceViewportRefreshBurst/,
    'candidate commit already submits its exact validated surface; it must not schedule a duplicate viewport/overlay render'
  );
  assert.match(
    sceneSource,
    /item\.publicationReceipt = Object\.freeze\([\s\S]*?requestToken:[\s\S]*?candidateGeneration:[\s\S]*?residentDraw: result\.residentDraw,[\s\S]*?renderBridge: result\.renderBridge/,
    'candidate publication must retain an exact private compare-and-swap receipt for the originating refresh tail'
  );
  assert.match(
    sceneSource,
    /const nativeCandidatePublishedDuringRefresh = Boolean\([\s\S]*?publicationReceipt\.requestToken[\s\S]*?publicationReceipt\.sourceResidentExecutionGeneration[\s\S]*?publicationReceipt\.residentDraw === sphResidentSurfaceDraw[\s\S]*?nextResidentSurfaceDraw = sphResidentSurfaceDraw;[\s\S]*?retainingPreviousResidentSurfaceDraw = false;/,
    'a matching committed candidate must win over its refresh tail\'s stale pending placeholder'
  );
  assert.match(
    sceneSource,
    /const firstFrameAlreadyIncludesPublishedAdditionalDraws = Boolean\([\s\S]*?lastNativeSurfaceDebugMode !== 'clear-only'[\s\S]*?lastNativeSurfaceDiagnosticDrawFilterActive !== true[\s\S]*?lastNativeSurfaceDiagnosticSelectedAdditionalDrawCount[\s\S]*?additionalPlan\.draws\.length[\s\S]*?settlePublishedAdditionalNativeSurfaceDraws\([\s\S]*?firstFrameAlreadyIncludesPublishedAdditionalDraws[\s\S]*?if \(!completeCompositeAlreadySubmitted\) \{[\s\S]*?invalidateSphNativeWebGpuSurfaceFrame/,
    'only an unfiltered, non-clear first frame that drew every additional surface may skip the redundant composite redraw'
  );
  assert.match(
    mountSource,
    /currentNativeSurfaceCandidateCompletionHandoff\(\s*execution,\s*\{\s*allowSurfaceDrawRequestFallback:\s*false\s*\}\s*\)[\s\S]*?waitForNativeSurfaceCandidateCompletionHandoff[\s\S]*?resolveSphNativeSurfaceCandidateCompletionHandoff[\s\S]*?residentPresentationIsVisible\([\s\S]*?requireCurrentSource:\s*true/,
    'mounted playback may use only an exact scheduler handoff with no retained-draw fallback, and only after it rechecks the unchanged current-source foreground proof'
  );
  assert.match(
    mountSource,
    /native-surface-post-step-presentation-proof-pending[\s\S]*?active:\s*true[\s\S]*?waitForNativeSurfaceCandidateCompletionHandoff/,
    'the post-step gate must become active before the candidate-completion wait begins'
  );
  assert.match(
    mountSource,
    /const scheduledScene = scene;[\s\S]*?const residentScheduleIsCurrent = \(\) => \([\s\S]*?scene === scheduledScene[\s\S]*?pendingMlsMpmResidentStepsToken[\s\S]*?await waitForNativeSurfaceCandidateCompletionHandoff[\s\S]*?if \(!residentScheduleIsCurrent\(\)\) \{[\s\S]*?discardStaleResidentPresentationContinuation\(\);[\s\S]*?return;/,
    'a reset or superseding schedule must fail closed after a native completion await rather than publish an obsolete foreground proof'
  );
  assert.match(
    mountSource,
    /function invalidateResidentRuntimeForReset[\s\S]*?residentPostStepPresentationGate = null;[\s\S]*?__sphResidentPostStepPresentationProof = null;[\s\S]*?__sphResidentPostStepPresentationHandoff = null;/,
    'reset must clear post-step native proof artifacts before it advances the particle generation'
  );
  assert.match(
    sceneSource,
    /function nativeSurfaceCompletionHandoffExactInteger\(value\) \{\s*return typeof value === 'number'/,
    'scene-private handoff identities must reject coercible missing-like values'
  );
  assert.match(
    mountSource,
    /function nativeSurfaceCandidateCompletionHandoffExactInteger\(value\) \{\s*return typeof value === 'number'/,
    'mounted handoff identities must reject coercible missing-like values'
  );
  assert.match(
    mountSource,
    /waitForNativeSurfaceCandidateCompletionHandoff[\s\S]*?timeoutMs:\s*NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS[\s\S]*?requireCurrentSource:\s*selectedNativeSurfaceConsumerRefresh,[\s\S]*?timeoutMs:\s*remainingProofTimeoutMs/,
    'the mounted native scheduler must keep the same bounded exact current-source proof deadline after each forced refresh'
  );
  assert.match(
    mountSource,
    /initial-t0-resident-foreground-proof-ready[\s\S]*?requireCurrentSource:\s*nativeSurfaceConsumerRefresh,[\s\S]*?timeoutMs:\s*nativeSurfaceConsumerRefresh[\s\S]*?NATIVE_SURFACE_CURRENT_PRESENTATION_WAIT_MS/,
    'native startup must require an exact current-source proof with the same bounded foreground deadline'
  );
  assert.match(
    mountSource,
    /residentPostStepPresentationGate\s*=\s*Object\.freeze\([\s\S]*?active:\s*!postStepPresentationVisible,[\s\S]*?scheduleContinuation = false;[\s\S]*?restartPlaybackContinuation = false;/,
    'a failed post-step proof must hold both resident continuation paths before they can supersede its candidate'
  );
  const playbackTickSource = mountSource.slice(
    mountSource.indexOf('function tick()'),
    mountSource.indexOf("overlay.querySelector('#sph-preflight')")
  );
  assert.match(
    playbackTickSource,
    /residentPostStepPresentationGate\?\.active[\s\S]*?resident-auto-schedule-held-for-current-native-presentation[\s\S]*?window\.setTimeout/,
    'the playback RAF must honor a failed post-step foreground gate instead of scheduling another physics batch'
  );
  assert.match(
    mountSource,
    /wait\.timeoutId\s*=\s*window\.setTimeout\(/,
    'the mounted proof wait needs a wall-clock watchdog when requestAnimationFrame is suspended'
  );
  assert.match(
    mountSource,
    /status:\s*'resident-presentation-proof-wait-timeout'/,
    'the mounted proof watchdog must report a bounded timeout rather than leaving the scheduler pending'
  );
  assert.match(
    sceneSource,
    /scheduleStagedSphResidentSurfaceDrawCandidateValidation\(\{[\s\S]*?residentRenderSource[\s\S]*?applyResidentRenderSourceMetadata\(residentDraw, residentRenderSource\)[\s\S]*?preparation\.renderBridgeCandidate,[\s\S]*?residentRenderSource/,
    'the scheduled candidate and bridge must carry the exact source receipt captured by their refresh'
  );
  assert.match(
    sceneSource,
    /const result = await commitStagedSphResidentSurfaceDrawCandidate\([\s\S]*?result\.residentDraw,[\s\S]*?item\.residentRenderSource[\s\S]*?surfaceDrawSourceResidentExecutionGenerationMatchesCurrent/,
    'async publication must replace retained-frame provenance in the public draw and render state'
  );
  assert.match(
    sceneSource,
    /visibleGpuConsumer\s*\n\s*\}\);[\s\S]*?assignResidentSurfaceVisibleGpuConsumer\(\s*nextResidentSurfaceDraw,[\s\S]*?\.record\.visibleGpuConsumer/,
    'the pending placeholder must retain candidate input-readiness diagnostics without publishing candidate GPU resources'
  );
  assert.match(
    sceneSource,
    /nativeMarchingCubesCandidateValidationPending = true;[\s\S]*?!nativeMarchingCubesSurfaceDrawReady[\s\S]*?&& !nativeMarchingCubesCandidateValidationPending[\s\S]*?\|\| nativeMarchingCubesCandidateValidationPending/,
    'a scheduled candidate must bypass fallback publication and artifact clearing until validation settles'
  );
  assert.match(
    sceneSource,
    /let nextResidentSurfaceDraw = null;[\s\S]{0,800}?let nativeMarchingCubesCandidateValidationPending = false;[\s\S]*?\|\| nativeMarchingCubesCandidateValidationPending/,
    'candidate-pending state must remain in refresh-wide scope through the publication decision'
  );
  assert.equal(
    sceneSource.match(/let nativeMarchingCubesCandidateValidationPending = false;/g)?.length,
    1,
    'candidate-pending state must have one authoritative declaration'
  );
  assert.match(
    sceneSource,
    /if \(!nativeMarchingCubesCandidateValidationPending\) \{\s*const visibleGpuConsumer = resolveResidentSurfaceVisibleGpuConsumer\([\s\S]*?assignResidentSurfaceVisibleGpuConsumer\(nextResidentSurfaceDraw, visibleGpuConsumer\);/,
    'generic placeholder handoff diagnostics must not erase the scheduled candidate import receipt'
  );
  assert.match(
    sceneSource,
    /surfaceDrawGpuBufferHandoffKind: gpuBufferHandoff\.handoffKind,[\s\S]*?surfaceDrawGpuBufferHandoffInputSchema:[\s\S]*?gpuBufferHandoff\.directConsumerInputSchema,[\s\S]*?surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction:[\s\S]*?gpuBufferHandoff\.requiresSurfaceExtraction/,
    'the staged candidate must own a complete handoff receipt before scheduler ownership transfer'
  );
  const stagedHandoffReadyReceiptCount =
    sceneSource.match(/surfaceDrawGpuBufferHandoffReady: gpuBufferHandoff\.ready/g)?.length ?? 0;
  assert.equal(
    sceneSource.match(/surfaceDrawGpuBufferHandoffKind: gpuBufferHandoff\.handoffKind/g)?.length ?? 0,
    stagedHandoffReadyReceiptCount,
    'every staged ready handoff receipt must retain its exact handoff kind'
  );
  assert.equal(
    sceneSource.match(/surfaceDrawGpuBufferHandoffInputSchema:\s*gpuBufferHandoff\.directConsumerInputSchema/g)?.length ?? 0,
    stagedHandoffReadyReceiptCount,
    'every staged ready handoff receipt must retain its input schema'
  );
  assert.equal(
    sceneSource.match(/surfaceDrawGpuBufferHandoffRequiresSurfaceExtraction:\s*gpuBufferHandoff\.requiresSurfaceExtraction/g)?.length ?? 0,
    stagedHandoffReadyReceiptCount,
    'every staged ready handoff receipt must retain its extraction requirement'
  );
  assert.match(
    lifecycleSource,
    /createNativeSurfaceLatestValidationScheduler[\s\S]*?let active = null;[\s\S]*?let queuedLatest = null;/,
    'foreground validation must keep exactly one active and one replaceable latest request'
  );
  const stagedPresentationValidation = sceneSource.match(
    /async function validateStagedSphNativeSurfaceCandidateForegroundPresentation\([\s\S]*?\n  async function validateStagedSphNativeSurfaceCandidateForeground\(/
  )?.[0] || '';
  const stagedValidation = sceneSource.match(
    /async function validateStagedSphNativeSurfaceCandidateForegroundLegacyReadback\([\s\S]*?\n  function resolveSphNativeSurfaceCandidatePresentationStagingCapability/
  )?.[0] || '';
  assert.match(
    sceneSource,
    /visibleCanvasTouched: false,[\s\S]*?currentTextureRequested: false,[\s\S]*?candidateLocal: true/,
    'candidate validation must explicitly remain local and leave the visible canvas untouched'
  );
  assert.doesNotMatch(
    stagedPresentationValidation,
    /getCurrentTexture\(/,
    'candidate validation must not clear or request the visible swap-chain texture'
  );
  assert.match(
    stagedPresentationValidation,
    /presentationTarget: targets,[\s\S]*?stageOnly: true,[\s\S]*?onStageInputsFrozen: \(\) => \{[\s\S]*?snapshotSphNativeSurfaceCandidatePresentation\([\s\S]*?targets\.presentationSnapshot = snapshot;[\s\S]*?return snapshot;/,
    'the full-resolution candidate proof must freeze its exact encode inputs synchronously before the asynchronous readback begins'
  );
  assert.doesNotMatch(
    stagedPresentationValidation,
    /const presentationSnapshot = snapshotSphNativeSurfaceCandidatePresentation\(/,
    'a mapped proof must retain the pre-submit input snapshot rather than recapturing state after mapAsync'
  );
  const rendererFreezeIndex = sceneSource.indexOf(
    "if (stageOnly && typeof onStageInputsFrozen === 'function')"
  );
  const rendererCameraWriteIndex = sceneSource.indexOf(
    'bridge.device.queue.writeBuffer(',
    rendererFreezeIndex
  );
  const rendererStageSubmitIndex = sceneSource.indexOf(
    'bridge.device.queue.submit([encoder.finish()]);',
    rendererFreezeIndex
  );
  assert.ok(
    rendererFreezeIndex >= 0 && rendererCameraWriteIndex > rendererFreezeIndex,
    'the staged input snapshot must be frozen before this renderer writes its camera uniforms'
  );
  assert.ok(
    rendererFreezeIndex >= 0 && rendererStageSubmitIndex > rendererFreezeIndex,
    'the staged input snapshot must be frozen before its private command buffer is submitted'
  );
  assert.match(
    stagedPresentationValidation,
    /presentationSnapshot: stagedPresentationSnapshot[\s\S]*?startCompletion: \(submission\) => \{[\s\S]*?submittedPresentationSnapshot\s*=\s*submission\?\.presentationSnapshot[\s\S]*?submittedPresentationSnapshot !== targets\.presentationSnapshot/,
    'the exact pre-submit snapshot identity must be retained by the prestarted-map handle'
  );
  assert.match(
    stagedPresentationValidation,
    /startCompletion: \(submission\) => \{[\s\S]*?readbackBuffer\.mapAsync[\s\S]*?completeTransaction: async \(submission, completionStart\)[\s\S]*?submittedReadbackBuffer = completionStart\?\.readbackBuffer[\s\S]*?const mapOutcome = completionStart\?\.mapOutcome[\s\S]*?const mapOutcomeResult = await mapOutcome\.promise;[\s\S]*?mapOutcomeResult\?\.status === 'timeout'[\s\S]*?submittedReadbackBuffer\.getMappedRange/,
    'the prestarted map request must reach mapped-byte access only through the scope-gated, timeout-first completion path'
  );
  assert.match(
    stagedPresentationValidation,
    /submittedReadbackBuffer\.getMappedRange[\s\S]*?presentationSnapshot: submittedPresentationSnapshot/,
    'the mapped proof must return the exact snapshot captured before the private submission'
  );
  assert.match(
    stagedPresentationValidation,
    /const mapOutcome = \{[\s\S]*?status: 'pending',[\s\S]*?promise: null,[\s\S]*?const settleMapOutcome = \(status, error = null\) => \{[\s\S]*?mapOutcome\.resolve\?\.\(\{ status, error \}\);[\s\S]*?const settleMapTimeout = \(\) => \{[\s\S]*?mapTiming\.settledAtMs = nowMs\(\);[\s\S]*?settleMapOutcome\('timeout'\)[\s\S]*?detachStagedSphNativeSurfaceCandidatePresentationReadbackBuffer\([\s\S]*?candidate-presentation-color-difference-map-timeout[\s\S]*?const mapRequestedAtMs = nowMs\(\);[\s\S]*?mapTiming\.deadlineAtMs = mapRequestedAtMs[\s\S]*?readbackBuffer\.mapAsync\([\s\S]*?const mapSettledAtMs = nowMs\(\);[\s\S]*?mapSettledAtMs >= mapTiming\.deadlineAtMs[\s\S]*?settleMapTimeout\(\);[\s\S]*?targets\.readbackMapPending = true;[\s\S]*?timeoutHandle = setTimeout\([\s\S]*?settleMapTimeout,[\s\S]*?mapTiming\.deadlineAtMs - nowMs\(\)[\s\S]*?mapOutcome\.timeoutHandle = timeoutHandle;[\s\S]*?return \{[\s\S]*?mapOutcome,[\s\S]*?mapStartError: null[\s\S]*?completeTransaction: async/,
    'the map deadline must use both timer and observed settlement time, then quarantine before delayed scope reports can admit a late map'
  );
  assert.doesNotMatch(
    stagedPresentationValidation,
    /Promise\.race\(\[mapPromise,\s*timeoutPromise\]\)/,
    'a late map must not be compared against timeout only after error scopes settle'
  );
  assert.match(
    stagedPresentationValidation,
    /discardTransaction: \(submission, completionStart\) => \{[\s\S]*?completionStart\?\.mapPromise[\s\S]*?detachStagedSphNativeSurfaceCandidatePresentationReadbackBuffer\([\s\S]*?candidate-presentation-command-or-scope-failed-after-map-start/,
    'a scoped error after a prestarted map must quarantine the readback buffer rather than allowing it to be reused'
  );
  assert.match(
    sceneSource,
    /const result = device\.popErrorScope\(\);[\s\S]*?pendingScopePops\.push\([\s\S]*?let completionStartValue = null;[\s\S]*?scopedErrorsByFilter\.size === 0[\s\S]*?completionStartValue = startCompletion\(submissionValue\);[\s\S]*?await Promise\.all\(pendingScopePops\)[\s\S]*?completeTransaction\(submissionValue, completionStartValue\)/,
    'a MAP_READ start hook must run only after every LIFO pop call, while mapped-byte access remains gated on all scope reports'
  );
  assert.match(
    stagedValidation,
    /additionalOpaqueDraws[\s\S]*?additionalRefractiveDraws[\s\S]*?additionalVaporDraws/,
    'foreground admission must validate the complete primary and additional-surface composite'
  );
  assert.match(
    stagedValidation,
    /runSphNativeSurfaceCandidateValidationTransaction\([\s\S]*?transaction: \(\) =>[\s\S]*?device\.queue\.submit\(\[encoder\.finish\(\)\]\)[\s\S]*?completeTransaction: async[\s\S]*?readbackBuffer\.mapAsync/,
    'GPU scopes must cover synchronous submission and close before readback mapping starts'
  );
  assert.match(
    stagedValidation,
    /readbackGeneration[\s\S]*?Uint8Array\.from\([\s\S]*?if \(!validationTransaction\.ok\)[\s\S]*?status: 'error'/,
    'each pooled readback generation must reject mapped-looking bytes when a GPU error scope fails'
  );
  assert.match(
    sceneSource,
    /foreground-validation-readback-pool-[\s\S]*?foreground-validation-map-timeout[\s\S]*?replaceStagedSphNativeSurfaceCandidateForegroundReadbackBuffer/,
    'the exact 16 KiB readback must be reused after success and replaced after timeout or failure'
  );
  assert.match(
    sceneSource,
    /resolveNativeSurfaceSubmitFailureAction\(\{\s*primaryFrameSubmitted\s*\}\)[\s\S]*?if \(failureAction\.committed\)[\s\S]*?return failureAction\.renderResult;/,
    'post-submit failures must preserve the committed render result'
  );
  assert.match(
    sceneSource,
    /rollbackSphNativeSurfaceRenderBridgeCandidate[\s\S]*?\.rollbackAllowed\) return false;/,
    'rollback must refuse a transaction whose first frame was submitted'
  );
  assert.match(
    sceneSource,
    /discardSphNativeSurfaceRenderBridgeCandidate[\s\S]*?\.discardAllowed\) return false;/,
    'discard must refuse to release a transaction whose first frame was submitted'
  );
  assert.match(
    lifecycleSource,
    /createNativeSurfaceProvisionalResourceReceipt\(bridge\)[\s\S]*?newDepthTextures[\s\S]*?deferredDepthTextures[\s\S]*?newRefractionTargetSets[\s\S]*?deferredRefractionTargetSets/,
    'depth and refraction replacements must settle through one provisional receipt'
  );
  assert.match(
    lifecycleSource,
    /newDestroyableResources: new Map\(\)[\s\S]*?deferredDestroyableResources: new Map\(\)[\s\S]*?settlementAttempts/,
    'the same retryable receipt must own every other pre-submit destroyable allocation'
  );
  assert.match(
    sceneSource,
    /nextOpticalGpuBuffers = opticalGpuBufferUpdateRequired[\s\S]*?binding: 2, resource: \{ buffer: nextOpticalGpuBuffers\.recordsBuffer \}[\s\S]*?previousOpticalGpuBuffers: previousBridge\.opticalGpuBuffers/,
    'bridge reuse must bind private candidate optical buffers without rewriting the live pair'
  );
  assert.doesNotMatch(
    sceneSource,
    /updateUploadedOpticalGpuTable/,
    'the native transaction must never attempt an in-place optical rollback'
  );
  assert.match(
    sceneSource,
    /candidate-box-wireframe-uniform-buffer[\s\S]*?candidate-pixel-validation-readback-buffer/,
    'wireframe and validation allocations must be registered with the provisional receipt'
  );
  assert.match(
    sceneSource,
    /function isolateSphNativeSurfaceCandidatePresentationResources\(bridge\) \{[\s\S]*?const previousBridge = record\.kind === 'reuse'[\s\S]*?bridge\.depthTexture === previousBridge\.depthTexture[\s\S]*?deferredDepthTextures\.add\(bridge\.depthTexture\)[\s\S]*?bridge\.refractionTargetSet === previousBridge\.refractionTargetSet[\s\S]*?deferredRefractionTargetSets\.add\([\s\S]*?const boxUniformBuffer = bridge\.boxWireframe\?\.uniformBuffer \?\? null;[\s\S]*?deferredDestroyableResources\.set\([\s\S]*?superseded-box-wireframe-uniform-buffer/,
    'reuse isolation must defer retirement of exactly inherited depth, refraction, and box-uniform resources before clearing candidate aliases'
  );
  assert.match(
    sceneSource,
    /superseded-environment-map-texture[\s\S]*?superseded-background-image-texture/,
    'environment clearing must defer old texture retirement until the composite commits'
  );
  assert.match(
    sceneSource,
    /const failureAction = resolveNativeSurfaceSubmitFailureAction\([\s\S]*?if \(!failureAction\.committed\) \{[\s\S]*?sphResidentSurfaceDraw = previousPublishedSurfaceDraw/,
    'the outer commit catch may restore the prior draw only after proving no submit occurred'
  );
  assert.match(
    sceneSource,
    /createNativeSurfaceCommittedFinisher\(\)[\s\S]*?'render-bridge-finalize'[\s\S]*?'resource-owner-install'[\s\S]*?'additional-surface-publication'[\s\S]*?stagedSphResidentSurfaceDrawCandidates\.delete\(residentDraw\)/,
    'all fallible committed publication steps must run through the no-throw finisher before staging cleanup'
  );
  assert.match(
    sceneSource,
    /const bridgeOwnedAllocations = new Set\(\)[\s\S]*?trackBridgeOwnedAllocation\(opticalGpuBuffers\.recordsBuffer\)[\s\S]*?trackBridgeOwnedAllocation\(opticalGpuBuffers\.spectralSamplesBuffer\)[\s\S]*?releaseBridgeOwnedAllocations\(\);/,
    'fresh bridge construction must retire every partial owned allocation'
  );
  assert.match(
    sceneSource,
    /retainedSharedExecutionOwners = \[\][\s\S]*?owner\.surfaceDrawExecution === activeExecution[\s\S]*?retireSphNativeWebGpuSurfaceResourceOwner/,
    'retired owner cleanup must filter executions still shared by the active owner before destroying anything'
  );
});

test('native pre-submit render errors preserve the last committed geometry bundle', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  assert.match(
    sceneSource,
    /resolveNativeSurfacePreSubmitDrawStateLiveness\(\{[\s\S]*?provisionalTransactionActive:[\s\S]*?committedDrawStateAvailable:[\s\S]*?if \(preSubmitDrawStateLiveness\.clearDrawState\) \{\s*bridge\.drawState = null;\s*\} else \{[\s\S]*?nativeSurfaceStateDirty = true;/,
    'a transient getCurrentTexture, context, camera, or resize failure must retain and retry the exact committed draw state'
  );
});

test('native WebGPU resident refresh reuses the engine-owned consumer device', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /function nativeWebGpuSurfaceConsumerDeviceResult\(\)/,
    'native WebGPU renderer should expose its resident canvas consumer device to refresh callers'
  );
  assert.match(
    sceneSource,
    /status: 'webgpu-native-surface-consumer-device-ready'/,
    'native consumer device reuse should be visible in diagnostics'
  );
  assert.match(
    sceneSource,
    /rendererOwnedWebGpuDeviceResult\(\)\s*\|\|\s*nativeWebGpuSurfaceConsumerDeviceResult\(\)/,
    'cached resident device resolution should prefer an existing native canvas consumer before requesting another adapter'
  );
  assert.match(
    sceneSource,
    /function clearCachedOpticalGpuDeviceResult\([\s\S]*?requestPromise && opticalGpuDeviceResultPromise !== requestPromise[\s\S]*?device && opticalGpuDeviceResultDevice !== device[\s\S]*?opticalGpuDeviceResultPromise = null;/,
    'cached device clearing should reject stale request and stale device owners'
  );
  assert.match(
    sceneSource,
    /if \(!result\.device\) \{[\s\S]*?clearCachedOpticalGpuDeviceResult\(\{ requestPromise \}\);[\s\S]*?transientDeviceUnavailable/,
    'transient requestAdapter null results should not poison the cached resident WebGPU device'
  );
  assert.match(
    sceneSource,
    /result\.device\.lost\.finally\(\(\) => \{[\s\S]*?clearCachedOpticalGpuDeviceResult\(\{[\s\S]*?device: result\.device,[\s\S]*?requestPromise/,
    'a late loss callback may clear only the promise that acquired that device'
  );
});

test('native WebGPU probe retains generation ownership and fence diagnostics', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const fields = [
    'renderBridgeNativeSurfaceResourceGeneration',
    'renderBridgeNativeSurfaceRetiredGenerationCount',
    'renderBridgeNativeSurfaceConsumerSubmitFencePending',
    'renderBridgeNativeSurfaceConsumerSubmitFenceFailed',
    'renderBridgeNativeSurfaceConsumerSubmitFenceExceededBudget',
    'renderBridgeNativeSurfaceConsumerInFlightSubmitCount',
    'renderBridgeAdditionalSurfaceAttachStatus',
    'renderBridgeAdditionalSurfaceDrawCount',
    'renderBridgeNativeSurfaceCandidateStageSubmissionCount',
    'renderBridgeNativeSurfaceCandidatePresentationCopyCount',
    'renderBridgeNativeSurfaceCandidatePresentationPostAdmissionGeometrySubmitCount',
    'renderBridgeNativeSurfaceCandidateStagedPresentationStatus',
    'renderBridgeNativeSurfaceCandidateStagedPresentationChangedPixelCount',
    'renderBridgeLastRefractiveDrawCount',
    'renderBridgeConfiguredAlphaMode',
    'renderBridgePackedNormalReady',
    'renderBridgePackedNormalAdditionalSubmitCount',
    'renderBridgeVertexTemperatureReady',
    'renderBridgeVertexTemperatureByteLength',
    'renderBridgeVertexTemperatureRowCount',
    'renderBridgeVertexTemperatureEncoding',
    'renderBridgeVertexTemperatureSurfaceGenerationId',
    'renderBridgeVertexTemperatureVolumeGenerationId',
    'renderBridgeVertexTemperatureAdditionalSubmitCount',
    'renderBridgeVertexTemperatureAdditionalReadyCount',
    'renderBridgeRefractionTargetLifecycleStatus',
    'renderBridgeRefractionTargetGeneration',
    'renderBridgeRefractionBackfaceStatus',
    'renderBridgeRefractionBackfaceAdditionalSubmitCount',
    'renderBridgeBackgroundImageGpuStatus'
  ];

  for (const field of fields) {
    assert.match(probeSource, new RegExp(`${field}:`));
  }
});

test('native WebGPU refresh entry points quarantine one device and admit a replacement', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /async function refreshSphResidentSurfaceDrawFromExtension[\s\S]*?resolveNativeSurfaceBridgeDeviceAdmission[\s\S]*?!nativeBridgeAdmission\.admitted[\s\S]*?resident extension surface refresh blocked[\s\S]*?nativeBridgeAdmission\.replacementDevice[\s\S]*?clearSphResidentSurfaceDrawArtifacts/,
    'direct extension refresh must retain same-device quarantine and clear only for a replacement'
  );
  assert.match(
    sceneSource,
    /async function refreshSphResidentRenderStateUnserialized[\s\S]*?nativeBridgeFailure = nativeSurfaceBridgeFailureReason\([\s\S]*?resolveNativeSurfaceBridgeDeviceAdmission[\s\S]*?!nativeBridgeAdmission\.admitted[\s\S]*?resident render refresh blocked[\s\S]*?clearSphResidentSurfaceDrawArtifacts/,
    'resident render refresh must retain same-device quarantine and clear only after replacement admission'
  );
});

test('static scene uploads order replacement-device requests before async acquisition', async () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const thermalStart = sceneSource.indexOf('async function refreshSphThermalResponseGraphBuffers');
  const mechanicsStart = sceneSource.indexOf('async function refreshMlsMpmMechanicsMaterialPhaseUpload');
  const mechanicsEnd = sceneSource.indexOf('async function refreshMlsMpmMechanicsPrediction', mechanicsStart);
  const thermalSource = sceneSource.slice(thermalStart, mechanicsStart);
  const mechanicsSource = sceneSource.slice(mechanicsStart, mechanicsEnd);

  for (const [label, source] of [
    ['thermal', thermalSource],
    ['mechanics', mechanicsSource]
  ]) {
    const beginIndex = source.indexOf('UploadRequestGate.begin()');
    const acquisitionIndex = source.indexOf('await requestCachedOpticalGpuDevice');
    const latestIndex = source.indexOf('UploadRequestGate.isLatest(requestToken)');
    assert.ok(beginIndex >= 0, `${label} upload should begin an ordered request`);
    assert.ok(acquisitionIndex > beginIndex, `${label} request order must precede device acquisition`);
    assert.ok(latestIndex > acquisitionIndex, `${label} upload must reject stale acquisition completion`);
    assert.match(
      source,
      /pending[\s\S]*?deviceRequestKey === deviceRequestKey[\s\S]*?return pending[^;]+\.promise/,
      `${label} identical pending requests should coalesce`
    );
    assert.match(
      source,
      /authorityGeneration[\s\S]*?residentExecutionGenerationIsStale/,
      `${label} cache mutation should be gated by resident authority generation`
    );
  }

  const gate = createLatestSceneRefreshRequestGate();
  let releaseDeviceA;
  const delayedDeviceA = new Promise((resolve) => { releaseDeviceA = resolve; });
  let publishedDevice = null;
  const refresh = async (devicePromise) => {
    const requestToken = gate.begin();
    const device = await devicePromise;
    if (!gate.isLatest(requestToken)) return 'stale-upload-discarded';
    publishedDevice = device;
    return 'published';
  };
  const older = refresh(delayedDeviceA);
  assert.equal(await refresh(Promise.resolve('Device-B')), 'published');
  releaseDeviceA('Device-A');
  assert.equal(await older, 'stale-upload-discarded');
  assert.equal(publishedDevice, 'Device-B');
});

test('resident GPU artifact retirement waits for all future submitters before fencing cleanup', () => {
  const scheduled = [];
  const events = [];
  const barrier = createResidentGpuArtifactRetirementBarrier({
    deferCleanup(device, cleanup) {
      events.push(`fence:${device}`);
      scheduled.push({ device, cleanup });
      return true;
    }
  });
  let deviceACleanupCount = 0;
  const releaseOlder = barrier.acquire();
  const releaseReplacement = barrier.acquire();

  assert.equal(barrier.retire({
    device: 'Device-A',
    cleanup() {
      deviceACleanupCount += 1;
    }
  }), true);
  assert.equal(barrier.pendingRetirementCount, 1);
  assert.deepEqual(events, []);

  events.push('later-submit:Device-A');
  assert.equal(releaseReplacement(), true);
  assert.deepEqual(events, ['later-submit:Device-A']);
  assert.equal(releaseOlder(), true);
  assert.deepEqual(events, ['later-submit:Device-A', 'fence:Device-A']);
  assert.equal(barrier.pendingRetirementCount, 0);
  assert.equal(scheduled.length, 1);

  scheduled[0].cleanup();
  scheduled[0].cleanup();
  assert.equal(deviceACleanupCount, 1);
  assert.equal(releaseOlder(), false);

  const releaseBatch = barrier.acquire();
  barrier.retire({ device: 'Device-B', cleanup() {} });
  barrier.retire({ device: 'Device-C', cleanup() {} });
  releaseBatch();
  assert.deepEqual(events.slice(-2), ['fence:Device-B', 'fence:Device-C']);

  barrier.retire({ device: 'Device-D', cleanup() {} });
  assert.equal(events.at(-1), 'fence:Device-D');
});

test('material-interface pre-integration provenance retains one complete epoch and buffer family', () => {
  const fixture = materialInterfacePreIntegrationFixture();
  const provenance = resolveSphMaterialInterfacePreIntegrationProvenance(fixture);

  assert.equal(provenance.ready, true);
  assert.equal(provenance.status, 'material-interface-current-particle-epoch-ready');
  assert.deepEqual(provenance.blockers, []);
  assert.deepEqual({
    storageGeneration: provenance.storageGeneration,
    physicsTick: provenance.physicsTick,
    physicsSubstep: provenance.physicsSubstep,
    positionEpoch: provenance.positionEpoch,
    topologyEpoch: provenance.topologyEpoch,
    chartEpoch: provenance.chartEpoch,
    levelEpoch: provenance.levelEpoch,
    supportEpoch: provenance.supportEpoch,
    particleCount: provenance.particleCount
  }, {
    storageGeneration: 9,
    physicsTick: 17,
    physicsSubstep: 2,
    positionEpoch: 17,
    topologyEpoch: 3,
    chartEpoch: 5,
    levelEpoch: 17,
    supportEpoch: 17,
    particleCount: 4
  });
  assert.strictEqual(provenance.sourceStateBuffer, fixture.stateBuffer);
  assert.strictEqual(provenance.sourceThermoBuffer, fixture.thermoBuffer);
  assert.strictEqual(provenance.sourceIdentityBuffer, fixture.identityBuffer);
  assert.strictEqual(provenance.sourceMechanicsBuffer, fixture.mechanicsBuffer);
});

test('material-interface pre-integration provenance rejects torn epochs and buffer families', () => {
  const cases = [
    {
      blocker: 'storage-generation-mismatch',
      mutate(fixture) {
        fixture.mlsMpmParticleUpload.storageGeneration += 1;
      }
    },
    {
      blocker: 'storage-generation-mismatch',
      mutate(fixture) {
        fixture.sphParticleUpload.storageGeneration = '9';
      }
    },
    {
      blocker: 'chart-epoch-state-upload-mismatch',
      mutate(fixture) {
        fixture.sphParticleState.chartEpoch += 1;
      }
    },
    {
      blocker: 'physics-tick-mismatch',
      mutate(fixture) {
        fixture.sphParticleUpload.physicsTick = fixture.sphParticleState.step + 1;
      }
    },
    {
      blocker: 'physics-substep-mismatch',
      mutate(fixture) {
        fixture.sphParticleUpload.physicsSubstep = fixture.sphParticleState.physicsSubstep + 1;
      }
    },
    {
      blocker: 'sph-buffer-identity-incomplete',
      mutate(fixture) {
        fixture.sphParticleUpload.identityBuffer = null;
      }
    },
    {
      blocker: 'mls-mpm-buffer-identity-incomplete',
      mutate(fixture) {
        fixture.mlsMpmParticleUpload.mechanicsBuffer = null;
      }
    }
  ];

  for (const { blocker, mutate } of cases) {
    const fixture = materialInterfacePreIntegrationFixture();
    mutate(fixture);
    const provenance = resolveSphMaterialInterfacePreIntegrationProvenance(fixture);
    assert.equal(provenance.ready, false, blocker);
    assert.ok(provenance.blockers.includes(blocker), blocker);
    assert.equal(provenance.sourceStateBuffer, null, `${blocker}: state identity must fail closed`);
    assert.equal(provenance.sourceMechanicsBuffer, null, `${blocker}: mechanics identity must fail closed`);
  }
});

test('resident material-interface refresh defaults to publishing and supports caller-owned results', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const materialStart = sceneSource.indexOf('async function refreshSphResidentMaterialInterfaceState');
  const materialEnd = sceneSource.indexOf(
    'async function refreshSphResidentPressureInterfaceState',
    materialStart
  );
  const materialSource = sceneSource.slice(materialStart, materialEnd);
  const publisherCalls = materialSource.match(/publishSphResidentMaterialInterfaceState\(/g) || [];
  const completionCalls = materialSource.match(/return completeMaterialInterfaceState\(/g) || [];

  assert.match(materialSource, /candidateReadbackMode = 'compact-active-readback',\s*publishState = true/);
  assert.match(
    materialSource,
    /publishState === false\s*\? \(state \|\| null\)\s*:\s*publishSphResidentMaterialInterfaceState\(state\)/,
    'explicit non-publishing refreshes must return caller-owned state without replacing scene state'
  );
  assert.equal(publisherCalls.length, 1, 'all refresh exits should use the publication gate');
  assert.equal(completionCalls.length, 6, 'success and every fail-closed exit should share the gate');
  assert.match(
    materialSource,
    /seedResidentMaterialInterfaceSurfaceTable\(\{[\s\S]*?publishState[\s\S]*?\}\)/,
    'cold-start surface-table seeding must receive the publication policy'
  );
  assert.match(
    materialSource,
    /if \(publishState === false\) \{[\s\S]*?readbackSurfaceState = createResidentRenderSurfaceState[\s\S]*?\} else \{[\s\S]*?captureResidentRenderSurfaceState/,
    'non-published readback fallback must build a caller-local render surface state'
  );
  assert.match(
    sceneSource,
    /const state = publishState === false[\s\S]*?createResidentRenderSurfaceState[\s\S]*?: captureResidentRenderSurfaceState/,
    'cold-start seeding must not capture global render state when publication is disabled'
  );
  const pureSurfaceStateStart = sceneSource.indexOf('function createResidentRenderSurfaceState');
  const captureSurfaceStateStart = sceneSource.indexOf(
    'function captureResidentRenderSurfaceState',
    pureSurfaceStateStart
  );
  const pureSurfaceStateSource = sceneSource.slice(
    pureSurfaceStateStart,
    captureSurfaceStateStart
  );
  assert.doesNotMatch(pureSurfaceStateSource, /scene\.userData|sphResidentRenderSurfaceState\s*=/);
  assert.match(materialSource, /sourceIdentityBuffer: nextSphUpload\.identityBuffer \|\| null/);
  assert.match(materialSource, /sourceMechanicsBuffer: nextMlsMpmUpload\?\.mechanicsBuffer \|\| null/);
  for (const field of [
    'spatialEpochPhysicsTick',
    'spatialEpochPhysicsSubstep',
    'spatialEpochStorageGeneration',
    'spatialEpochPositionEpoch',
    'spatialEpochTopologyEpoch',
    'spatialEpochChartEpoch',
    'spatialEpochLevelEpoch',
    'spatialEpochSupportEpoch',
    'spatialEpochSourceStateBuffer',
    'spatialEpochSourceThermoBuffer',
    'spatialEpochSourceIdentityBuffer',
    'spatialEpochSourceMechanicsBuffer'
  ]) {
    assert.match(materialSource, new RegExp(`materialInterfaceField\\.${field}`), field);
  }
});

test('resident GPU consumers lease captured buffers before asynchronous device acquisition', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const materialStart = sceneSource.indexOf('async function refreshSphResidentMaterialInterfaceState');
  const materialEnd = sceneSource.indexOf('async function refreshSphResidentPressureInterfaceState', materialStart);
  const renderStart = sceneSource.indexOf('async function refreshSphResidentRenderStateUnserialized');
  const renderEnd = sceneSource.indexOf('async function debugSphResidentParticleUpload', renderStart);

  const materialSource = sceneSource.slice(materialStart, materialEnd);
  const materialCaptureIndex = materialSource.indexOf('const nextSphUpload');
  const materialLeaseIndex = materialSource.indexOf('residentGpuArtifactRetirementBarrier.acquire()');
  const materialDeviceAwaitIndex = materialSource.indexOf('await requestCachedOpticalGpuDevice');
  assert.ok(materialCaptureIndex >= 0, 'material interface should capture its retained source');
  assert.ok(materialLeaseIndex > materialCaptureIndex, 'material interface should lease the captured source');
  assert.ok(materialDeviceAwaitIndex > materialLeaseIndex, 'material interface must lease before device acquisition');
  assert.ok(
    materialSource.lastIndexOf('releaseResidentArtifactLease()') > materialDeviceAwaitIndex,
    'material interface should release after device-dependent consumption'
  );

  const renderSource = sceneSource.slice(renderStart, renderEnd);
  const renderLeaseIndex = renderSource.indexOf('residentGpuArtifactRetirementBarrier.acquire()');
  const renderFirstDeviceAwaitIndex = renderSource.indexOf('await requestCachedOpticalGpuDevice');
  assert.ok(renderLeaseIndex >= 0, 'resident render should lease its entry-time residentSteps source');
  assert.ok(
    renderFirstDeviceAwaitIndex > renderLeaseIndex,
    'resident render must lease before every asynchronous device-recovery/acquisition path'
  );
  assert.ok(
    renderSource.lastIndexOf('releaseResidentArtifactLease()') > renderFirstDeviceAwaitIndex,
    'resident render should release after device-dependent consumption'
  );

  const serializedRenderStart = sceneSource.indexOf('let sphResidentRenderRefreshActive');
  const serializedRenderSource = sceneSource.slice(serializedRenderStart, renderStart);
  const queuedLeaseIndex = serializedRenderSource.indexOf('residentGpuArtifactRetirementBarrier.acquire()');
  assert.ok(queuedLeaseIndex >= 0, 'resident render should lease an explicitly queued source');
  assert.match(
    serializedRenderSource,
    /sphResidentRenderRefreshActive[\s\S]*?sphResidentRenderRefreshQueuedLatest/,
    'resident render scheduling must expose one active and one latest queued slot'
  );
  assert.match(
    serializedRenderSource,
    /request\.releaseQueuedResidentArtifactLease\?\.\(\)[\s\S]*?replaced\.releaseQueuedResidentArtifactLease\?\.\(\)/,
    'active and replaced queued sources must release their own exact leases'
  );
  assert.doesNotMatch(
    serializedRenderSource,
    /sphResidentRenderRefreshTail|await previous\.catch/,
    'resident render scheduling must not retain an unbounded FIFO promise tail'
  );

  const pressureStart = sceneSource.indexOf('async function refreshSphResidentPressureInterfaceState');
  const pressureEnd = sceneSource.indexOf('function sphThermalResponseGraphSignature', pressureStart);
  const pressureSource = sceneSource.slice(pressureStart, pressureEnd);
  const pressureLeaseIndex = pressureSource.indexOf('residentGpuArtifactRetirementBarrier.acquire()');
  const spatialLedgerAwaitIndex = pressureSource.indexOf(
    'await submitSceneSpatialGasLedgerProducerStageForPressureInterface'
  );
  assert.ok(pressureLeaseIndex >= 0, 'pressure interface should lease its resident product source');
  assert.ok(
    spatialLedgerAwaitIndex > pressureLeaseIndex,
    'pressure interface must lease before a spatial-ledger ComputeManager submission can queue'
  );
  assert.ok(
    pressureSource.lastIndexOf('releasePressureInterfaceArtifactLease()') > spatialLedgerAwaitIndex,
    'pressure interface should release after queued producer and pressure consumption complete'
  );
});

test('scene lifecycle invalidates static uploads and rejects known-lost device reuse', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /nativeWebGpuKnownLostDeviceSet[\s\S]*?device\.lost\.then[\s\S]*?nativeWebGpuKnownLostDeviceSet\?\.add\(device\)/,
    'the scene must remember devices after their loss promise settles'
  );
  assert.match(
    sceneSource,
    /resolveNativeSurfaceConsumerDeviceTransition\(\{[\s\S]*?deviceKnownLost:[\s\S]*?if \(deviceTransition\.deviceKnownLost\)/,
    'consumer recreation must reject an already-lost device'
  );
  assert.match(
    sceneSource,
    /function dispose\(\)[\s\S]*?clearSphThermalResponseGraphUpload\(\);[\s\S]*?clearMlsMpmMechanicsMaterialPhaseUpload\(\);/,
    'scene disposal must clear references and invalidate pending static uploads'
  );
  assert.match(
    sceneSource,
    /async function refreshMlsMpmResidentStep[\s\S]*?refreshSphThermalResponseGraphBuffers\(\{[\s\S]*?authorityGeneration: executionGeneration[\s\S]*?refreshMlsMpmMechanicsMaterialPhaseUpload\(\{[\s\S]*?authorityGeneration: executionGeneration/,
    'single resident steps must bind static uploads to their captured authority generation'
  );
  assert.match(
    sceneSource,
    /async function refreshMlsMpmResidentSteps[\s\S]*?refreshSphThermalResponseGraphBuffers\(\{[\s\S]*?authorityGeneration: executionGeneration[\s\S]*?refreshMlsMpmMechanicsMaterialPhaseUpload\(\{[\s\S]*?authorityGeneration: executionGeneration/,
    'resident step batches must bind static uploads to their captured authority generation'
  );
  assert.match(
    sceneSource,
    /resident execution invalidated during GPU upload preparation/,
    'stale resident work must stop before pressure upload and kernel execution'
  );
});

test('Schroeder scene samples one non-published pre-integration interface field per resident batch', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');
  const loopStart = sceneSource.indexOf('const runSchroederSceneResidentSteps');
  const loopEnd = sceneSource.indexOf('const residentStepsRunner', loopStart);
  const loopSource = sceneSource.slice(loopStart, loopEnd);
  const forIndex = loopSource.indexOf('for (let index = 0; index < count; index += 1)');
  const fieldIndex = loopSource.indexOf(
    'await refreshSphResidentMaterialInterfaceState',
    forIndex
  );
  const hierarchyIndex = loopSource.indexOf(
    'await runSchroederSameLevelMechanicsWebGpu',
    fieldIndex
  );

  assert.ok(forIndex >= 0, 'Schroeder resident sequence must retain its explicit substep loop');
  assert.ok(fieldIndex > forIndex, 'the sampled field must be produced inside the resident loop');
  assert.ok(hierarchyIndex > fieldIndex, 'the field must be ready before canonical generation ownership runs');
  assert.match(
    loopSource,
    /pressureInterfaceOwnerScopeDiagnosticRequested[\s\S]*?index === pressureInterfaceOwnerScopeDiagnosticSampleIndex/
  );
  assert.match(
    loopSource,
    /pressureInterfaceOwnerScopeDiagnosticSampleIndex\s*=\s*\n?\s*pressureInterfaceOwnerScopeDiagnosticRequested \? 0 : null/
  );
  assert.match(
    loopSource,
    /once-per-resident-batch-first-substep-before-integration/
  );
  assert.match(
    loopSource,
    /pressureInterfaceOwnerScopeDiagnosticBlockedByOverlay[\s\S]*?stepPhaseVolumeAssignmentOverlay/
  );
  assert.match(
    loopSource,
    /phase-volume-assignment-overlay-requires-overlay-capable-exact-near-adapter/
  );
  assert.match(loopSource, /nextSphParticleState: currentSphParticleState/);
  assert.match(loopSource, /nextMlsMpmParticleState: currentMlsMpmParticleState/);
  assert.match(loopSource, /sphParticleUpload: currentSphParticleUpload/);
  assert.match(loopSource, /mlsMpmParticleUpload: currentMlsMpmParticleUpload/);
  assert.match(loopSource, /publishState: false/);
  assert.match(loopSource, /spatialEpochOwnerScopeEphemeral = true/);
  assert.match(
    loopSource,
    /residentStepOptions\.materialInterfaceField\s*=\s*preIntegrationMaterialInterfaceField/
  );
  assert.match(
    loopSource,
    /enablePressureInterfaceOwnerScope:\s*\n?\s*shouldBuildPreIntegrationMaterialInterfaceField/
  );
  assert.match(
    loopSource,
    /schroederPressureInterfaceOwnerScopeDiagnosticSampleCount:\s*\n?\s*pressureInterfaceOwnerScopeDiagnosticSample \? 1 : 0/
  );
  assert.match(
    loopSource,
    /schroederPressureInterfaceOwnerScopeDiagnosticSubmittedCount:[\s\S]*?schroeder-pressure-interface-owner-scope-submitted/
  );
  assert.match(
    loopSource,
    /schroederPressureInterfaceOwnerScopeDiagnosticBorrowedCount:[\s\S]*?borrowedSpatialGeneration === true/
  );
  assert.match(
    loopSource,
    /schroederStepSummaries\.every\([\s\S]*?normalHotLoopReadbackFree === true/
  );
  assert.match(
    loopSource,
    /spatialEpochOwnerScopeCleanupScheduled !== true[\s\S]*?onSubmittedWorkDone[\s\S]*?then\([\s\S]*?cleanupOwnerScopeField,[\s\S]*?blockOwnerScopeCleanup/,
    'a hierarchy call rejected before ownership transfer must retire the ephemeral field only after a confirmed queue fence'
  );
  assert.match(
    loopSource,
    /await settleSchroederSpatialEpochBatchEvidence\(\{[\s\S]*?settlements: schroederSpatialEpochReleaseSettlements,[\s\S]*?expectedCount: count/,
    'the resident batch must settle every generation-owner fence and resample released transactions before publication'
  );
  assert.match(
    loopSource,
    /schroederSpatialEpochReleaseSettlementComplete:[\s\S]*?spatialEpochTransaction\?\.state === 'released'[\s\S]*?releaseCount === 1/,
    'batch telemetry must publish exact release completion coverage'
  );
  assert.match(
    loopSource,
    /schroederHierarchyArtifactLedgerSettlementComplete:[\s\S]*?hierarchyArtifactLedger\?\.safe === true/,
    'batch telemetry must publish safe artifact-ledger retirement coverage'
  );
});
