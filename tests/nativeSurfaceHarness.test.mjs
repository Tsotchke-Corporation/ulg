import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readRepoFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('native WebGPU probe and benchmark flatten validation scope diagnostics', () => {
  const probeSource = readRepoFile('scripts/sph-long-horizon-probe.mjs');
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');
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
  assert.match(probeSource, /validationBlockerFamily,/);
  assert.match(probeSource, /textureReadbackUnavailable,/);
  assert.match(probeSource, /gpuBufferHandoffReady,/);
});

test('performance benchmark reports worker offscreen frame transport budget', () => {
  const benchmarkSource = readRepoFile('scripts/sph-performance-benchmark.mjs');

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
    /materialInterfaceSurfaceTableTotalFieldCells/,
    'material-interface diagnostics should expose the coarse table cell count'
  );
  const mountSource = readRepoFile('src/visualization/sphPhaseDemoMount.js');
  assert.match(mountSource, /materialInterfaceMaxFieldCells/);
  assert.match(mountSource, /miCells/);
  assert.match(mountSource, /materialInterfaceSurfaceTablePolicy: initialMaterialInterfaceSurfaceTablePolicy/);
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
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceCacheHit/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceRowsPacked/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceStateTransferBytes/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsProducerSourceKind/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSourceStageId/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsRetainedParticleStateStatus/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsRetainedStageOutputPreserved/);
  assert.match(benchmarkSource, /workerOffscreenRenderRowsSkippedLegacyDrawForRetainedStageOutput/);
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
  assert.match(benchmarkSource, /workerOffscreenResidentStageSameWorkerGpuHandoff/);
  assert.match(benchmarkSource, /renderRowsReadbackWorkerOwnedResidentParticleStateProducerReadbackFree/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipResidentInterfaceRefreshMode/);
  assert.match(sceneSource, /presentationWorkerRetainedOutputPresentationOnlyReadbackFree/);
  assert.match(sceneSource, /upgradeWorkerOffscreenRenderRowsWhenReady/);
  assert.match(sceneSource, /retainPreviousThreeRenderRowBridgeNoFull/);
  assert.match(sceneSource, /workerOwnedResidentParticleStateProducerBridge/);
  assert.match(sceneSource, /workerOwnedResidentParticleStateProducerPresentationOnly/);
  assert.match(sceneSource, /surfaceDrawWorkerOwnedResidentParticleStateProducerPresentationOnly/);
  assert.match(sceneSource, /resident-render-worker-owned-particle-state-producer-presented/);
  assert.match(policySource, /residentInterfaceRefreshMode/);
  assert.match(policySource, /workerOffscreenRenderRowsUpgradedToWorkerOwnedResidentProducer/);
  assert.match(probeSource, /presentationWorkerRetainedOutputPresentationOnlyReadbackFree/);
  assert.match(benchmarkSource, /presentationWorkerRetainedOutputPresentationOnlyReadbackFree/);
  assert.match(sceneSource, /peerComputeRenderOwnershipResidentStepsPerScheduleMax/);
  assert.match(probeSource, /peerComputeRenderOwnershipResidentStepsPerScheduleMax/);
  assert.match(benchmarkSource, /peerComputeRenderOwnershipResidentStepsPerScheduleMax/);
  assert.match(mountSource, /residentStepsPerScheduleOverride/);
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
});

test('native WebGPU surface consumer uses submit-fence pacing', () => {
  const sceneSource = readRepoFile('src/visualization/sphPhaseScene.js');

  assert.match(
    sceneSource,
    /nativeSurfaceConsumerSubmitFencePending/,
    'native surface RAF scheduling should expose submit-fence pacing state'
  );
  assert.match(
    sceneSource,
    /native-webgpu-surface-consumer-after-submit-fence/,
    'native surface RAF should resume only after queue completion'
  );
  assert.match(
    sceneSource,
    /SPH_NATIVE_WEBGPU_SURFACE_SUBMIT_FENCE_TIMEOUT_MS/,
    'native surface submit fencing should be bounded in browsers where queue completion hangs'
  );
  assert.match(
    sceneSource,
    /resident-surface-draw-skipped-native-submit-fence-pending/,
    'main animation rendering should also respect native submit-fence pacing'
  );
  assert.match(
    sceneSource,
    /resident-surface-draw-skipped-native-submit-fence-timeout/,
    'automatic native redraws should pause after a bounded submit-fence timeout'
  );
  assert.match(
    sceneSource,
    /nativeSurfaceConsumerSubmitFenceTimedOut = false/,
    'new native surface submits should reset stale timeout diagnostics'
  );
  assert.match(
    sceneSource,
    /controls\.update\(\);\s*const rendered = renderSceneFrame\(\{ reason: 'animation-frame' \}\);/,
    'native surface rendering should update camera controls before each engine frame'
  );
  assert.match(
    sceneSource,
    /if \(rendered\) \{\s*renderSphResidentSurfaceDrawOverlay\(\{ reason: 'animation-frame' \}\);/,
    'native main-canvas WebGPU surfaces must redraw every engine frame because swap-chain contents are not retained'
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
    /skipped-native-webgpu-surface-consumer/,
    'native surface draws should no longer bypass submit fencing'
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
    /if \(!result\.device\) \{\s*opticalGpuDeviceResultPromise = null;[\s\S]*?transientDeviceUnavailable/,
    'transient requestAdapter null results should not poison the cached resident WebGPU device'
  );
});
