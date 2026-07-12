import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kernelCases = [
  {
    file: '../src/runtime/sph/sphThermalGpuKernel.js',
    functionName: 'createSphThermalStepWebGpuEncoderStage',
    labels: ['thermalStep'],
    profilerName: 'timestampProfiler'
  },
  {
    file: '../src/runtime/sph/sphReactionGpuKernel.js',
    functionName: 'runSphReactionStepWebGpu',
    labels: ['reactionStepPropose', 'reactionStepResolve'],
    profilerName: 'resolvedTimestampProfiler'
  },
  {
    file: '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
    functionName: 'createMlsMpmMechanicsRefreshWebGpuEncoderStage',
    labels: ['mechanicsRefresh'],
    profilerName: 'timestampProfiler'
  }
];

function sourceFor(file) {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

function exportedFunctionSource(source, functionName) {
  const start = source.indexOf(`export function ${functionName}(`) >= 0
    ? source.indexOf(`export function ${functionName}(`)
    : source.indexOf(`export async function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} export must exist`);
  const nextExport = source.indexOf('\nexport ', start + 1);
  return source.slice(start, nextExport >= 0 ? nextExport : source.length);
}

for (const { file, functionName, labels, profilerName } of kernelCases) {
  test(`${functionName} exposes its timestamp-profiled pass descriptors`, () => {
    const source = sourceFor(file);
    const functionSource = exportedFunctionSource(source, functionName);

    assert.match(functionSource, /timestampProfiler = null,/);
    assert.match(functionSource, /timestampMetadata = null/);
    for (const label of labels) {
      assert.match(functionSource, new RegExp(
        `encoder\\.beginComputePass\\(\\s*profiledComputePassDescriptor\\(${profilerName}, '${label}', timestampMetadata\\)\\s*\\)`
      ));
    }
    assert.ok(source.includes(
      'timestampProfiler.beginComputePassDescriptor(label, timestampMetadata || {})'
    ));
    assert.match(source, /:\s*\{ label \};/);
  });
}
