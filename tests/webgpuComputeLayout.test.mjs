import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createCachedExplicitComputePipelineFamily,
  deferSubmittedWorkCleanup
} from '../src/runtime/webgpuComputeLayout.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function nextTurn() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('compute pipeline family shares one explicit layout and caches all entry points', () => {
  const shaderModules = [];
  const bindGroupLayouts = [];
  const pipelineLayouts = [];
  const pipelines = [];
  const device = {
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      pipelineLayouts.push(descriptor);
      return descriptor;
    },
    createComputePipeline(descriptor) {
      pipelines.push(descriptor);
      return descriptor;
    }
  };
  const options = {
    cacheKey: 'test-family',
    label: 'test-family',
    code: '@compute @workgroup_size(1) fn prepare() {}\n@compute @workgroup_size(1) fn main() {}',
    entryPoints: ['prepare', 'main'],
    bindings: [computeBufferBinding(0, 'storage')]
  };

  const first = createCachedExplicitComputePipelineFamily(device, options);
  const second = createCachedExplicitComputePipelineFamily(device, options);

  assert.equal(first.cacheStatus, 'pipeline-family-cache-miss');
  assert.equal(second.cacheStatus, 'pipeline-family-cache-hit');
  assert.equal(shaderModules.length, 1);
  assert.equal(bindGroupLayouts.length, 1);
  assert.equal(pipelineLayouts.length, 1);
  assert.equal(pipelines.length, 2);
  assert.equal(first.pipelines.prepare.layout, first.pipelineLayout);
  assert.equal(first.pipelines.main.layout, first.pipelineLayout);
  assert.equal(second.pipelines.prepare, first.pipelines.prepare);
  assert.deepEqual(first.entryPoints, ['prepare', 'main']);
});

test('dynamic storage offsets and minimum sizes are explicit cache-signature dimensions', () => {
  const shaderModules = [];
  const bindGroupLayouts = [];
  const pipelines = [];
  const device = {
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      pipelines.push(descriptor);
      return descriptor;
    }
  };
  const base = {
    cacheKey: 'mutation-writer-layout',
    label: 'mutation-writer-layout',
    code: '@compute @workgroup_size(1) fn main() {}'
  };
  const staticBinding = computeBufferBinding(9, 'storage');
  const dynamicBinding = computeBufferBinding(9, 'storage', { hasDynamicOffset: true });
  const dynamicSlotBinding = computeBufferBinding(9, 'storage', {
    hasDynamicOffset: true,
    minBindingSize: 64
  });

  const staticPipeline = createCachedExplicitComputePipeline(device, {
    ...base,
    bindings: [staticBinding]
  });
  const dynamicPipeline = createCachedExplicitComputePipeline(device, {
    ...base,
    bindings: [dynamicBinding]
  });
  const dynamicSlotPipeline = createCachedExplicitComputePipeline(device, {
    ...base,
    bindings: [dynamicSlotBinding]
  });
  const dynamicSlotPipelineAgain = createCachedExplicitComputePipeline(device, {
    ...base,
    bindings: [computeBufferBinding(9, 'storage', {
      hasDynamicOffset: true,
      minBindingSize: 64
    })]
  });

  assert.equal(staticPipeline.cacheStatus, 'pipeline-cache-miss');
  assert.equal(dynamicPipeline.cacheStatus, 'pipeline-cache-miss');
  assert.equal(dynamicSlotPipeline.cacheStatus, 'pipeline-cache-miss');
  assert.equal(dynamicSlotPipelineAgain.cacheStatus, 'pipeline-cache-hit');
  assert.equal(shaderModules.length, 3);
  assert.equal(bindGroupLayouts.length, 3);
  assert.equal(pipelines.length, 3);
  assert.deepEqual(staticBinding.buffer, { type: 'storage' });
  assert.deepEqual(dynamicBinding.buffer, { type: 'storage', hasDynamicOffset: true });
  assert.deepEqual(dynamicSlotBinding.buffer, {
    type: 'storage',
    hasDynamicOffset: true,
    minBindingSize: 64
  });
  assert.notEqual(staticPipeline.pipeline, dynamicPipeline.pipeline);
  assert.notEqual(dynamicPipeline.pipeline, dynamicSlotPipeline.pipeline);
  assert.equal(dynamicSlotPipelineAgain.pipeline, dynamicSlotPipeline.pipeline);
  assert.throws(() => computeBufferBinding(-1, 'storage'), /non-negative integer/);
  assert.throws(
    () => computeBufferBinding(0, 'storage', { minBindingSize: 1.5 }),
    /non-negative safe integer/
  );
});

test('submitted-work cleanup coalesces same-turn requests behind one queue fence', async () => {
  const fence = deferred();
  let observerCount = 0;
  let submittedSerial = 1;
  let observedSerial = null;
  const device = {
    queue: {
      onSubmittedWorkDone() {
        observerCount += 1;
        observedSerial = submittedSerial;
        return fence.promise;
      }
    }
  };
  const cleaned = [];

  assert.equal(deferSubmittedWorkCleanup(device, () => cleaned.push('first')), true);
  submittedSerial += 1;
  assert.equal(deferSubmittedWorkCleanup(device, () => cleaned.push('second')), true);
  assert.equal(observerCount, 0, 'the fence is captured after same-turn submissions finish');

  await Promise.resolve();
  assert.equal(observerCount, 1);
  assert.equal(observedSerial, 2);
  assert.deepEqual(cleaned, []);

  fence.resolve();
  await fence.promise;
  await Promise.resolve();
  assert.deepEqual(cleaned, ['first', 'second']);
});

test('submitted-work cleanup gives a later turn its own queue fence', async () => {
  const fences = [deferred(), deferred()];
  let observerCount = 0;
  const device = {
    queue: {
      onSubmittedWorkDone() {
        const fence = fences[observerCount];
        observerCount += 1;
        return fence.promise;
      }
    }
  };
  const cleaned = [];

  deferSubmittedWorkCleanup(device, () => cleaned.push('first-turn'));
  await nextTurn();
  assert.equal(observerCount, 1);

  deferSubmittedWorkCleanup(device, () => cleaned.push('second-turn'));
  await Promise.resolve();
  assert.equal(observerCount, 2, 'a pending older fence must not capture later-turn cleanup');

  fences[1].resolve();
  await fences[1].promise;
  await Promise.resolve();
  assert.deepEqual(cleaned, ['second-turn']);

  fences[0].resolve();
  await fences[0].promise;
  await Promise.resolve();
  assert.deepEqual(cleaned, ['second-turn', 'first-turn']);
});

test('submitted-work cleanup runs after both resolved and rejected fences', async () => {
  const resolvedFence = deferred();
  const rejectedFence = deferred();
  const fences = [resolvedFence, rejectedFence];
  let observerCount = 0;
  const device = {
    queue: {
      onSubmittedWorkDone() {
        const fence = fences[observerCount];
        observerCount += 1;
        return fence.promise;
      }
    }
  };
  const cleaned = [];

  deferSubmittedWorkCleanup(device, () => cleaned.push('resolved'));
  await Promise.resolve();
  resolvedFence.resolve();
  await resolvedFence.promise;
  await Promise.resolve();

  await nextTurn();
  deferSubmittedWorkCleanup(device, () => cleaned.push('rejected'));
  await Promise.resolve();
  rejectedFence.reject(new Error('device lost'));
  await rejectedFence.promise.catch(() => null);
  await Promise.resolve();

  assert.equal(observerCount, 2);
  assert.deepEqual(cleaned, ['resolved', 'rejected']);
});

test('submitted-work cleanup runs synchronously when no queue observer exists', () => {
  const cleaned = [];

  assert.equal(deferSubmittedWorkCleanup({}, () => cleaned.push('no-queue')), false);
  assert.equal(
    deferSubmittedWorkCleanup({ queue: {} }, () => cleaned.push('no-observer')),
    false
  );
  assert.deepEqual(cleaned, ['no-queue', 'no-observer']);
});
