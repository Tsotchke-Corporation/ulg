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
    /const controlsChanged = Boolean\(controls\.update\(\)\)/,
    'native surface rendering should redraw from OrbitControls camera changes'
  );
  assert.match(
    sceneSource,
    /!nativeSurfaceConsumerActive \|\| controlsChanged/,
    'native surface rendering should be on-demand instead of continuous in the main animation loop'
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
