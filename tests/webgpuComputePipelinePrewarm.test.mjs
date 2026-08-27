import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  prewarmCachedExplicitComputePipeline
} from '../src/runtime/webgpuComputeLayout.js';

function fakeDevice({ asyncCreation = true, failAsync = false } = {}) {
  const counters = { sync: 0, async: 0, modules: 0 };
  let pipelineOrdinal = 0;
  const makePipeline = (descriptor) => ({
    label: descriptor.label,
    ordinal: (pipelineOrdinal += 1),
    getBindGroupLayout(index) { return { index, from: descriptor.label }; }
  });
  const device = {
    counters,
    createShaderModule(descriptor) {
      counters.modules += 1;
      return { label: descriptor.label, code: descriptor.code };
    },
    createBindGroupLayout(descriptor) { return { label: descriptor.label }; },
    createPipelineLayout(descriptor) { return { label: descriptor.label }; },
    createComputePipeline(descriptor) {
      counters.sync += 1;
      return makePipeline(descriptor);
    }
  };
  if (asyncCreation) {
    device.createComputePipelineAsync = async (descriptor) => {
      counters.async += 1;
      await Promise.resolve();
      if (failAsync) throw new Error('async compile refused');
      return makePipeline(descriptor);
    };
  }
  return device;
}

const DESCRIPTOR = Object.freeze({
  cacheKey: 'prewarm-probe',
  label: 'prewarm-probe',
  code: '@compute @workgroup_size(1) fn main() {}',
  entryPoint: 'main',
  bindings: [computeBufferBinding(0)]
});

test('prewarm populates the shared cache and the sync path hits it with the same pipeline', async () => {
  const device = fakeDevice();
  const warmed = await prewarmCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(warmed.cacheStatus, 'pipeline-prewarmed');
  assert.equal(warmed.prewarmed, true);
  assert.equal(device.counters.async, 1);
  assert.equal(device.counters.sync, 0);
  const synchronous = createCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(synchronous.cacheStatus, 'pipeline-cache-hit');
  assert.equal(synchronous.pipeline, warmed.pipeline);
  assert.equal(device.counters.sync, 0);
});

test('prewarm falls back to synchronous creation when async creation is absent', async () => {
  const device = fakeDevice({ asyncCreation: false });
  const warmed = await prewarmCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(warmed.cacheStatus, 'pipeline-prewarmed');
  assert.equal(device.counters.sync, 1);
  const synchronous = createCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(synchronous.cacheStatus, 'pipeline-cache-hit');
  assert.equal(device.counters.sync, 1);
});

test('prewarm failure is fail-open: cache untouched and the sync path still compiles', async () => {
  const device = fakeDevice({ failAsync: true });
  const failed = await prewarmCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(failed.cacheStatus, 'pipeline-prewarm-failed');
  assert.equal(failed.prewarmed, false);
  assert.equal(failed.pipeline, null);
  assert.match(String(failed.error), /async compile refused/u);
  const synchronous = createCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(synchronous.cacheStatus, 'pipeline-cache-miss');
  assert.ok(synchronous.pipeline);
});

test('concurrent prewarms of one key share a single in-flight compilation', async () => {
  const device = fakeDevice();
  const [first, second] = await Promise.all([
    prewarmCachedExplicitComputePipeline(device, DESCRIPTOR),
    prewarmCachedExplicitComputePipeline(device, DESCRIPTOR)
  ]);
  assert.equal(device.counters.async, 1);
  assert.equal(first.pipeline, second.pipeline);
});

test('a synchronous create racing a prewarm wins the cache and the prewarm defers to it', async () => {
  const device = fakeDevice();
  const pending = prewarmCachedExplicitComputePipeline(device, DESCRIPTOR);
  const synchronous = createCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(synchronous.cacheStatus, 'pipeline-cache-miss');
  const warmed = await pending;
  assert.equal(warmed.pipeline, synchronous.pipeline);
  const again = createCachedExplicitComputePipeline(device, DESCRIPTOR);
  assert.equal(again.cacheStatus, 'pipeline-cache-hit');
  assert.equal(again.pipeline, synchronous.pipeline);
});

test('prewarm without a cacheKey is refused', async () => {
  const device = fakeDevice();
  await assert.rejects(
    prewarmCachedExplicitComputePipeline(device, { ...DESCRIPTOR, cacheKey: null }),
    TypeError
  );
});
