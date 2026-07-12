import test from 'node:test';
import assert from 'node:assert/strict';

import {
  installWebGpuImmutablePipelineCache,
  webGpuImmutablePipelineCacheSummary
} from '../src/runtime/webgpuImmutablePipelineCache.js';

function fakeDevice() {
  const calls = {
    shaderModules: 0,
    compilationInfo: 0,
    bindGroupLayouts: 0,
    pipelineLayouts: 0,
    computePipelines: 0
  };
  return {
    calls,
    createShaderModule(descriptor) {
      calls.shaderModules += 1;
      return {
        kind: 'shader-module',
        descriptor,
        async getCompilationInfo() {
          calls.compilationInfo += 1;
          return { messages: [] };
        }
      };
    },
    createBindGroupLayout(descriptor) {
      calls.bindGroupLayouts += 1;
      return { kind: 'bind-group-layout', descriptor };
    },
    createPipelineLayout(descriptor) {
      calls.pipelineLayouts += 1;
      return { kind: 'pipeline-layout', descriptor };
    },
    createComputePipeline(descriptor) {
      calls.computePipelines += 1;
      return { kind: 'compute-pipeline', descriptor };
    }
  };
}

test('device cache reuses immutable shader, layout, and compute pipeline objects', async () => {
  const device = fakeDevice();
  installWebGpuImmutablePipelineCache(device);
  const moduleA = device.createShaderModule({ label: 'first', code: '@compute fn main() {}' });
  const moduleB = device.createShaderModule({ label: 'second', code: '@compute fn main() {}' });
  assert.equal(moduleB, moduleA);
  await moduleA.getCompilationInfo();
  await moduleB.getCompilationInfo();

  const layoutDescriptor = {
    entries: [{ binding: 0, visibility: 4, buffer: { type: 'storage' } }]
  };
  const groupLayoutA = device.createBindGroupLayout({ label: 'a', ...layoutDescriptor });
  const groupLayoutB = device.createBindGroupLayout({ label: 'b', ...layoutDescriptor });
  assert.equal(groupLayoutB, groupLayoutA);
  const pipelineLayoutA = device.createPipelineLayout({ bindGroupLayouts: [groupLayoutA] });
  const pipelineLayoutB = device.createPipelineLayout({ bindGroupLayouts: [groupLayoutB] });
  assert.equal(pipelineLayoutB, pipelineLayoutA);
  const pipelineA = device.createComputePipeline({
    label: 'surface-a',
    layout: pipelineLayoutA,
    compute: { module: moduleA, entryPoint: 'main' }
  });
  const pipelineB = device.createComputePipeline({
    label: 'surface-b',
    layout: pipelineLayoutB,
    compute: { module: moduleB, entryPoint: 'main' }
  });
  assert.equal(pipelineB, pipelineA);

  assert.deepEqual(device.calls, {
    shaderModules: 1,
    compilationInfo: 1,
    bindGroupLayouts: 1,
    pipelineLayouts: 1,
    computePipelines: 1
  });
  const summary = webGpuImmutablePipelineCacheSummary(device);
  assert.equal(summary.shaderModuleHits, 1);
  assert.equal(summary.computePipelineHits, 1);
  assert.equal(summary.compilationInfoHits, 1);
});

test('semantic descriptor changes produce distinct immutable resources', () => {
  const device = fakeDevice();
  installWebGpuImmutablePipelineCache(device);
  const moduleA = device.createShaderModule({ code: 'one' });
  const moduleB = device.createShaderModule({ code: 'two' });
  assert.notEqual(moduleB, moduleA);
  const layoutA = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: 4, buffer: { type: 'storage' } }]
  });
  const layoutB = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: 4, buffer: { type: 'read-only-storage' } }]
  });
  assert.notEqual(layoutB, layoutA);
  assert.equal(device.calls.shaderModules, 2);
  assert.equal(device.calls.bindGroupLayouts, 2);
});

test('install is idempotent and leaves uncached device state explicit', () => {
  const uncached = fakeDevice();
  assert.equal(webGpuImmutablePipelineCacheSummary(uncached).installed, false);
  const first = installWebGpuImmutablePipelineCache(uncached);
  const second = installWebGpuImmutablePipelineCache(uncached);
  assert.equal(first.installed, true);
  assert.equal(second.installed, true);
});
