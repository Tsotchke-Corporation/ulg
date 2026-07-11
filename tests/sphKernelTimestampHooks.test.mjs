import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kernelCases = [
  {
    file: '../src/runtime/sph/sphThermalGpuKernel.js',
    functionName: 'createSphThermalStepWebGpuEncoderStage',
    label: 'thermalStep',
    profilerName: 'timestampProfiler'
  },
  {
    file: '../src/runtime/sph/sphReactionGpuKernel.js',
    functionName: 'runSphReactionStepWebGpu',
    label: 'reactionStep',
    profilerName: 'resolvedTimestampProfiler'
  },
  {
    file: '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
    functionName: 'createMlsMpmMechanicsRefreshWebGpuEncoderStage',
    label: 'mechanicsRefresh',
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

for (const { file, functionName, label, profilerName } of kernelCases) {
  test(`${functionName} exposes a timestamp-profiled ${label} pass descriptor`, () => {
    const source = sourceFor(file);
    const functionSource = exportedFunctionSource(source, functionName);

    assert.match(functionSource, /timestampProfiler = null,/);
    assert.match(functionSource, /timestampMetadata = null/);
    assert.match(functionSource, new RegExp(
      `encoder\\.beginComputePass\\(\\s*profiledComputePassDescriptor\\(${profilerName}, '${label}', timestampMetadata\\)\\s*\\)`
    ));
    assert.ok(source.includes(
      'timestampProfiler.beginComputePassDescriptor(label, timestampMetadata || {})'
    ));
    assert.match(source, /:\s*\{ label \};/);
  });
}
