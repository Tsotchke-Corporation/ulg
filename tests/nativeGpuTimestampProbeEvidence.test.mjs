import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function probeSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const neighborhoodProbe = probeSource(
  '../scripts/resident-neighborhood-consumer-chain-probe.mjs'
);
const gasProbe = probeSource('../scripts/sph-spatial-gas-cell-eos-gpu-probe.mjs');
const solidProbe = probeSource('../scripts/coherent-solid-frame-probe.mjs');

test('native compute probes request GPU timestamps by default and preserve unsupported evidence', () => {
  for (const source of [neighborhoodProbe, gasProbe, solidProbe]) {
    assert.match(source, /process\.env\.ULG_NATIVE_GPU_PROFILE\s*!==\s*'0'/);
    assert.match(source, /adapter\.features\?\.has\?\.\('timestamp-query'\)\s*===\s*true/);
    assert.match(source, /requiredFeatures:\s*gpuTimestampProfilingRequested/);
    assert.match(source, /'inconclusive-unsupported'/);
    assert.match(source, /skippedSpanCount/);
    assert.match(source, /invalidSpanCount/);
    assert.match(source, /gpuTimestampStageTotals/);
  }
});

test('resident-neighborhood probe resolves its shared profiler in the measured submission', () => {
  assert.match(neighborhoodProbe, /createWebGpuTimestampProfiler\(device,/);
  assert.match(neighborhoodProbe, /timestampProfiler,\s*\n\s*timestampMetadata:/);
  const resolveIndex = neighborhoodProbe.indexOf('timestampProfiler.encodeResolve(encoder)');
  const submitIndex = neighborhoodProbe.indexOf('device.queue.submit([encoder.finish()])');
  assert.ok(resolveIndex >= 0, 'resident-neighborhood probe must encode timestamp resolve');
  assert.ok(submitIndex > resolveIndex, 'timestamp resolve must precede the measured submission');
  for (const stage of [
    'source-metadata',
    'cell-sort-unique',
    'candidate-count-scan',
    'RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.keyBuild',
    'RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.cellAssemble',
    'RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.candidateCount',
    'RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.finalize',
    'RESIDENT_NEIGHBORHOOD_GPU_TIMESTAMP_STAGE.candidateFill'
  ]) {
    assert.ok(neighborhoodProbe.includes(stage), `missing neighborhood timestamp gate ${stage}`);
  }
});

test('gas EOS probe uses the runner-owned measured submission and checks every stable stage', () => {
  assert.match(gasProbe, /measureGpuTimestamps:\s*gpuTimestampProfilingRequested/);
  assert.match(gasProbe, /entry\.gasResult\.gpuTimestampProfile/);
  assert.match(gasProbe, /metadata:\s*\{\s*sphGasCellEosStage:\s*'radix'\s*\}/);
  for (const stage of [
    'keyBuild',
    'dispatchPrepare',
    'cellReduce',
    'finalize',
    'gradient'
  ]) {
    assert.ok(
      gasProbe.includes(`SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.${stage}`),
      `missing gas EOS timestamp gate ${stage}`
    );
  }
});

test('coherent-solid frame probe resolves each case profile in its existing submission', () => {
  assert.match(solidProbe, /createWebGpuTimestampProfiler\(device,/);
  assert.match(solidProbe, /timestampProfiler,\s*\n\s*timestampMetadata:/);
  const resolveIndex = solidProbe.indexOf('timestampProfiler.encodeResolve(encoder)');
  const submitIndex = solidProbe.indexOf('device.queue.submit([encoder.finish()])');
  assert.ok(resolveIndex >= 0, 'coherent-solid probe must encode timestamp resolve');
  assert.ok(submitIndex > resolveIndex, 'timestamp resolve must precede the measured submission');
  assert.match(
    solidProbe,
    /Object\.entries\(\s*runtimeModule\.COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE\s*\)/
  );
});
