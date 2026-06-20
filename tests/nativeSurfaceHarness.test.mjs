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
