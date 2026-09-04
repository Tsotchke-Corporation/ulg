import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUEUE_ORDERED_CLEANUP_CLAIM_SCHEMA,
  QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA,
  QUEUE_ORDERED_SUBMITTED_WORK_CLEANUP_RECEIPT_SCHEMA,
  abortQueueOrderedSubmissionBatch,
  appendQueueOrderedSubmissionBatch,
  cancelQueueOrderedCleanupClaim,
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createQueueOrderedCleanupClaimIssuer,
  createQueueOrderedSubmissionBatch,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  releaseSubmittedWorkCleanupQueueOrdered,
  sealQueueOrderedFinalConsumerCapability,
  submitQueueOrderedFinalConsumerWork,
  submitQueueOrderedWork
} from '../src/runtime/webgpuComputeLayout.js';

test('cached explicit pipelines share identical shader modules per device', () => {
  const shaderModules = [];
  const bindGroupLayouts = [];
  const pipelineLayouts = [];
  const pipelines = [];
  const device = {
    createShaderModule(descriptor) {
      const module = { descriptor };
      shaderModules.push(module);
      return module;
    },
    createBindGroupLayout(descriptor) {
      const layout = { descriptor };
      bindGroupLayouts.push(layout);
      return layout;
    },
    createPipelineLayout(descriptor) {
      const layout = { descriptor };
      pipelineLayouts.push(layout);
      return layout;
    },
    createComputePipeline(descriptor) {
      const pipeline = { descriptor };
      pipelines.push(pipeline);
      return pipeline;
    }
  };
  const code = '@compute @workgroup_size(1) fn first() {} fn second() {}';
  const bindings = [computeBufferBinding(0, 'storage')];
  const first = createCachedExplicitComputePipeline(device, {
    cacheKey: 'first',
    label: 'first',
    code,
    entryPoint: 'first',
    bindings
  });
  const second = createCachedExplicitComputePipeline(device, {
    cacheKey: 'second',
    label: 'second',
    code,
    entryPoint: 'second',
    bindings
  });
  const repeated = createCachedExplicitComputePipeline(device, {
    cacheKey: 'first',
    label: 'first',
    code,
    entryPoint: 'first',
    bindings
  });

  assert.equal(shaderModules.length, 1);
  assert.equal(bindGroupLayouts.length, 1);
  assert.equal(pipelineLayouts.length, 1);
  assert.equal(pipelines.length, 2);
  assert.equal(first.shaderModuleCacheStatus, 'shader-module-cache-miss');
  assert.equal(second.shaderModuleCacheStatus, 'shader-module-cache-hit');
  assert.equal(
    first.explicitLayoutCacheStatus,
    'explicit-layout-cache-miss'
  );
  assert.equal(
    second.explicitLayoutCacheStatus,
    'explicit-layout-cache-hit'
  );
  assert.equal(repeated.shaderModuleCacheStatus, 'pipeline-cache-hit');
  assert.equal(first.pipeline.descriptor.compute.module, shaderModules[0]);
  assert.equal(second.pipeline.descriptor.compute.module, shaderModules[0]);
  assert.equal(first.bindGroupLayout, second.bindGroupLayout);
  assert.equal(first.pipelineLayout, second.pipelineLayout);
});

test('explicit layout cache distinguishes dynamic offsets and binding sizes', () => {
  const bindGroupLayouts = [];
  const device = {
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) {
      bindGroupLayouts.push(descriptor);
      return descriptor;
    },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) { return descriptor; }
  };
  const code = '@compute @workgroup_size(1) fn main() {}';
  const variants = [
    computeBufferBinding(0, 'uniform', { minBindingSize: 16 }),
    computeBufferBinding(0, 'uniform', {
      hasDynamicOffset: true,
      minBindingSize: 16
    }),
    computeBufferBinding(0, 'uniform', { minBindingSize: 32 })
  ];
  for (const [index, binding] of variants.entries()) {
    createCachedExplicitComputePipeline(device, {
      cacheKey: `layout-variant-${index}`,
      label: `layout-variant-${index}`,
      code,
      entryPoint: 'main',
      bindings: [binding]
    });
  }
  assert.equal(bindGroupLayouts.length, 3);
});

function fenceDevice() {
  const resolvers = [];
  let created = 0;
  return {
    fencesCreated: () => created,
    async settleAll() {
      const pending = resolvers.splice(0, resolvers.length);
      for (const resolve of pending) resolve();
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    },
    device: {
      queue: {
        onSubmittedWorkDone() {
          created += 1;
          return new Promise((resolve) => { resolvers.push(resolve); });
        }
      }
    }
  };
}

test('a device without a queue fence runs cleanup immediately', () => {
  let ran = 0;
  assert.equal(deferSubmittedWorkCleanup({}, () => { ran += 1; }), false);
  assert.equal(ran, 1);
});

test('a non-function cleanup is refused rather than scheduled', () => {
  const fake = fenceDevice();
  assert.equal(deferSubmittedWorkCleanup(fake.device, null), false);
  assert.equal(fake.fencesCreated(), 0);
});

test('a cleanup runs only after its own fence resolves', () => {
  const fake = fenceDevice();
  const ran = [];
  assert.equal(deferSubmittedWorkCleanup(fake.device, () => ran.push('released')), true);
  assert.equal(fake.fencesCreated(), 1);
  assert.deepEqual(ran, [], 'the buffer is still in use until the device goes idle');
});

test('each registration gets its own fence, and releases immediately on it', async () => {
  // This is load-bearing, not incidental. Arena leases are released through
  // this helper, so a release delayed behind another cleanup's fence lets the
  // next substep reach `acquire` while the lease is still held -- "Thermal
  // proposal arena 0 is still leased by generation 1", which is what happened
  // when these were coalesced onto a shared fence. See the note on the helper.
  const fake = fenceDevice();
  const ran = [];
  deferSubmittedWorkCleanup(fake.device, () => ran.push('first'));
  deferSubmittedWorkCleanup(fake.device, () => ran.push('second'));
  assert.equal(fake.fencesCreated(), 2);
  await fake.settleAll();
  assert.deepEqual(ran, ['first', 'second'], 'neither waits on the other');
});

test('a rejected fence still releases its cleanup', async () => {
  // Device loss rejects the fence. The buffers and leases still need releasing.
  const rejecters = [];
  const device = {
    queue: {
      onSubmittedWorkDone() {
        return new Promise((_, reject) => { rejecters.push(reject); });
      }
    }
  };
  const ran = [];
  deferSubmittedWorkCleanup(device, () => ran.push('released'));
  rejecters[0](new Error('device lost'));
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  assert.deepEqual(ran, ['released']);
});

test('a queue that cannot schedule a fence still retires cleanup exactly once', () => {
  const device = {
    queue: {
      onSubmittedWorkDone() {
        throw new Error('injected fence scheduling failure');
      }
    }
  };
  let cleanupCount = 0;
  assert.equal(
    deferSubmittedWorkCleanup(device, () => { cleanupCount += 1; }),
    false
  );
  assert.equal(cleanupCount, 1);
});

function queueOrderedDevice() {
  let submits = 0;
  let fences = 0;
  return {
    get submitCount() { return submits; },
    get fenceCount() { return fences; },
    queue: {
      submit() {
        submits += 1;
      },
      onSubmittedWorkDone() {
        fences += 1;
        throw new Error('queue fence must not be requested');
      }
    }
  };
}

test('queue-ordered batch submits exact members once and issues member receipts', async () => {
  const submissions = [];
  const device = {
    queue: {
      submit(commandBuffers) {
        submissions.push(commandBuffers);
      }
    }
  };
  const firstCommandBuffer = { label: 'fine-p2g' };
  const secondCommandBuffer = { label: 'coarse-predictor-p2g' };
  const batch = createQueueOrderedSubmissionBatch(device, {
    expectedCommandBufferCount: 2
  });
  const firstReceipt = appendQueueOrderedSubmissionBatch(
    batch,
    device,
    firstCommandBuffer
  );
  assert.equal(submissions.length, 0);
  const secondReceipt = appendQueueOrderedSubmissionBatch(
    batch,
    device,
    secondCommandBuffer
  );
  const [first, second] = await Promise.all([firstReceipt, secondReceipt]);

  assert.equal(submissions.length, 1);
  assert.deepEqual(submissions[0], [firstCommandBuffer, secondCommandBuffer]);
  assert.notEqual(first, second);
  assert.equal(first.commandBufferCount, 2);
  assert.equal(second.commandBufferCount, 2);
  assert.equal(first.batchMemberOrdinal, 0);
  assert.equal(second.batchMemberOrdinal, 1);
});

test('queue-ordered batch abort rejects pending members without submitting', async () => {
  const device = queueOrderedDevice();
  const batch = createQueueOrderedSubmissionBatch(device, {
    expectedCommandBufferCount: 2
  });
  const pending = appendQueueOrderedSubmissionBatch(
    batch,
    device,
    { label: 'only-member' }
  );
  const reason = new Error('paired producer failed before append');

  assert.equal(abortQueueOrderedSubmissionBatch(batch, device, reason), true);
  await assert.rejects(pending, reason);
  assert.equal(device.submitCount, 0);
  assert.equal(abortQueueOrderedSubmissionBatch(batch, device, reason), false);
});

test('queue-ordered cleanup wraps one existing nonempty submit with no host fence', () => {
  const device = queueOrderedDevice();
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'thermal-output'
  });
  const producerOutput = {};
  const finalConsumerOwner = {};
  let cleanupCount = 0;
  const cleanup = () => { cleanupCount += 1; };
  const producerClaim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput,
    cleanup
  });

  assert.equal(producerClaim.schema, QUEUE_ORDERED_CLEANUP_CLAIM_SCHEMA);
  assert.throws(
    () => submitQueueOrderedWork(device, []),
    /nonempty exact command buffers/
  );
  assert.equal(device.submitCount, 0);

  const submissionReceipt = submitQueueOrderedWork(
    device,
    [{ label: 'existing-final-consumer-command-buffer' }]
  );
  const capability = sealQueueOrderedFinalConsumerCapability(
    submissionReceipt,
    device,
    {
      finalConsumerOwner,
      producerClaims: [producerClaim]
    }
  );
  assert.equal(device.submitCount, 1);
  assert.equal(device.fenceCount, 0);
  assert.equal(
    capability.schema,
    QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA
  );

  const receipt = releaseSubmittedWorkCleanupQueueOrdered(
    device,
    cleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim,
      producerOutput,
      producerFamily: 'thermal-output'
    }
  );
  assert.equal(cleanupCount, 1);
  assert.equal(device.submitCount, 1);
  assert.equal(device.fenceCount, 0);
  assert.equal(
    receipt.schema,
    QUEUE_ORDERED_SUBMITTED_WORK_CLEANUP_RECEIPT_SCHEMA
  );
  assert.equal(receipt.completed, true);
  assert.equal(receipt.hostQueueFenceCount, 0);
  assert.equal(receipt.remainingCapabilityClaimCount, 0);
  assert.equal(
    receipt.queueCompletionMethod,
    'same-gpu-queue-submission-order'
  );
});

test('legacy validators, cloned authority, and unsealed claims cannot authorize cleanup', () => {
  const device = queueOrderedDevice();
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'thermal-output'
  });
  const producerOutput = {};
  let cleanupCount = 0;
  const cleanup = () => { cleanupCount += 1; };
  const producerClaim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput,
    cleanup
  });

  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(
      device,
      cleanup,
      {
        submissionObserved: true,
        ownerAuthority: {},
        validateOwnerAuthority: () => true
      }
    ),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  const unsealedCapability = Object.freeze({
    schema: QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA
  });
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(device, cleanup, {
      queueOrderedFinalConsumer: unsealedCapability,
      producerClaim,
      producerOutput,
      producerFamily: 'thermal-output'
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.equal(cleanupCount, 0);

  const submissionReceipt = submitQueueOrderedWork(device, [{}]);
  const capability = sealQueueOrderedFinalConsumerCapability(
    submissionReceipt,
    device,
    {
      finalConsumerOwner: {},
      producerClaims: [producerClaim]
    }
  );
  const clonedCapability = { ...capability };
  const clonedClaim = { ...producerClaim };
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(device, cleanup, {
      queueOrderedFinalConsumer: clonedCapability,
      producerClaim,
      producerOutput,
      producerFamily: 'thermal-output'
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(device, cleanup, {
      queueOrderedFinalConsumer: capability,
      producerClaim: clonedClaim,
      producerOutput,
      producerFamily: 'thermal-output'
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.equal(cleanupCount, 0);
});

test('claim batches seal atomically and consume only exact bounded pairs', () => {
  const device = queueOrderedDevice();
  const otherDevice = queueOrderedDevice();
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'thermal-output'
  });
  const otherIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'thermal-output'
  });
  const firstOutput = {};
  const secondOutput = {};
  const firstCleanup = () => {};
  const secondCleanup = () => {};
  const replacementCleanup = () => {};
  const firstClaim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput: firstOutput,
    cleanup: firstCleanup
  });
  const secondClaim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput: secondOutput,
    cleanup: secondCleanup
  });
  const crossDomainClaim = registerQueueOrderedCleanupClaim(
    otherIssuer,
    device,
    {
      producerOutput: {},
      cleanup: () => {}
    }
  );
  const wrongDeviceClaim = registerQueueOrderedCleanupClaim(
    issuer,
    otherDevice,
    {
      producerOutput: {},
      cleanup: () => {}
    }
  );
  const receipt = submitQueueOrderedWork(device, [{}]);

  assert.throws(
    () => sealQueueOrderedFinalConsumerCapability(receipt, device, {
      finalConsumerOwner: {},
      producerClaims: [firstClaim, firstClaim]
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.throws(
    () => sealQueueOrderedFinalConsumerCapability(receipt, device, {
      finalConsumerOwner: {},
      producerClaims: [firstClaim, wrongDeviceClaim]
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );

  const capability = sealQueueOrderedFinalConsumerCapability(
    receipt,
    device,
    {
      finalConsumerOwner: {},
      producerClaims: [firstClaim, secondClaim]
    }
  );
  assert.throws(
    () => sealQueueOrderedFinalConsumerCapability(receipt, device, {
      finalConsumerOwner: {},
      producerClaims: [crossDomainClaim]
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  const otherReceipt = submitQueueOrderedWork(device, [{}]);
  assert.throws(
    () => sealQueueOrderedFinalConsumerCapability(otherReceipt, device, {
      finalConsumerOwner: {},
      producerClaims: [firstClaim]
    }),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );

  for (const invalid of [
    {
      cleanup: replacementCleanup,
      claim: firstClaim,
      output: firstOutput,
      family: 'thermal-output'
    },
    {
      cleanup: firstCleanup,
      claim: firstClaim,
      output: secondOutput,
      family: 'thermal-output'
    },
    {
      cleanup: firstCleanup,
      claim: firstClaim,
      output: firstOutput,
      family: 'reaction-product'
    },
    {
      cleanup: firstCleanup,
      claim: crossDomainClaim,
      output: firstOutput,
      family: 'thermal-output'
    }
  ]) {
    assert.throws(
      () => releaseSubmittedWorkCleanupQueueOrdered(
        device,
        invalid.cleanup,
        {
          queueOrderedFinalConsumer: capability,
          producerClaim: invalid.claim,
          producerOutput: invalid.output,
          producerFamily: invalid.family
        }
      ),
      (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
    );
  }
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(
      otherDevice,
      firstCleanup,
      {
        queueOrderedFinalConsumer: capability,
        producerClaim: firstClaim,
        producerOutput: firstOutput,
        producerFamily: 'thermal-output'
      }
    ),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );

  const firstReceipt = releaseSubmittedWorkCleanupQueueOrdered(
    device,
    firstCleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim: firstClaim,
      producerOutput: firstOutput,
      producerFamily: 'thermal-output'
    }
  );
  const secondReceipt = releaseSubmittedWorkCleanupQueueOrdered(
    device,
    secondCleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim: secondClaim,
      producerOutput: secondOutput,
      producerFamily: 'thermal-output'
    }
  );
  assert.equal(firstReceipt.remainingCapabilityClaimCount, 1);
  assert.equal(secondReceipt.remainingCapabilityClaimCount, 0);
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(
      device,
      firstCleanup,
      {
        queueOrderedFinalConsumer: capability,
        producerClaim: firstClaim,
        producerOutput: firstOutput,
        producerFamily: 'thermal-output'
      }
    ),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
});

test('combined final-consumer submit validates the complete claim batch before queue.submit', () => {
  const device = queueOrderedDevice();
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'combined-submit'
  });
  const producerOutput = {};
  const cleanup = () => {};
  const claim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput,
    cleanup
  });
  assert.throws(
    () => submitQueueOrderedFinalConsumerWork(
      device,
      [{}],
      {
        finalConsumerOwner: {},
        producerClaims: [claim, claim]
      }
    ),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.equal(device.submitCount, 0);

  const capability = submitQueueOrderedFinalConsumerWork(
    device,
    [{}],
    {
      finalConsumerOwner: {},
      producerClaims: [claim]
    }
  );
  assert.equal(device.submitCount, 1);
  assert.equal(capability.claimCount, 1);
});

test('cancelled claims and submit failures cannot run cleanup or strand retry authority', () => {
  let shouldThrow = true;
  let submitAttempts = 0;
  const device = {
    queue: {
      submit() {
        submitAttempts += 1;
        if (shouldThrow) throw new Error('injected submit failure');
      }
    }
  };
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'p2g-temporaries'
  });
  const producerOutput = {};
  let cleanupCount = 0;
  const cleanup = () => { cleanupCount += 1; };
  const producerClaim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput,
    cleanup
  });
  assert.throws(
    () => submitQueueOrderedWork(device, [{}]),
    /injected submit failure/
  );
  assert.equal(cleanupCount, 0);

  shouldThrow = false;
  const receipt = submitQueueOrderedWork(device, [{}]);
  const capability = sealQueueOrderedFinalConsumerCapability(
    receipt,
    device,
    {
      finalConsumerOwner: {},
      producerClaims: [producerClaim]
    }
  );
  releaseSubmittedWorkCleanupQueueOrdered(device, cleanup, {
    queueOrderedFinalConsumer: capability,
    producerClaim,
    producerOutput,
    producerFamily: 'p2g-temporaries'
  });
  assert.equal(submitAttempts, 2);
  assert.equal(cleanupCount, 1);

  const cancelledOutput = {};
  const cancelledCleanup = () => { cleanupCount += 1; };
  const cancelledClaim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput: cancelledOutput,
    cleanup: cancelledCleanup
  });
  assert.equal(
    cancelQueueOrderedCleanupClaim(cancelledClaim, device, {
      producerOutput: cancelledOutput,
      cleanup: cancelledCleanup
    }),
    true
  );
  const cancelledReceipt = submitQueueOrderedWork(device, [{}]);
  assert.throws(
    () => sealQueueOrderedFinalConsumerCapability(
      cancelledReceipt,
      device,
      {
        finalConsumerOwner: {},
        producerClaims: [cancelledClaim]
      }
    ),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.equal(cleanupCount, 1);
});

test('a throwing cleanup consumes its exact claim before invoking the destructor', () => {
  const device = queueOrderedDevice();
  const issuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'throwing-cleanup'
  });
  const producerOutput = {};
  let cleanupCount = 0;
  const cleanup = () => {
    cleanupCount += 1;
    throw new Error('injected cleanup failure');
  };
  const claim = registerQueueOrderedCleanupClaim(issuer, device, {
    producerOutput,
    cleanup
  });
  const receipt = submitQueueOrderedWork(device, [{}]);
  const capability = sealQueueOrderedFinalConsumerCapability(
    receipt,
    device,
    {
      finalConsumerOwner: {},
      producerClaims: [claim]
    }
  );
  const options = {
    queueOrderedFinalConsumer: capability,
    producerClaim: claim,
    producerOutput,
    producerFamily: 'throwing-cleanup'
  };
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(device, cleanup, options),
    /injected cleanup failure/
  );
  assert.equal(cleanupCount, 1);
  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(device, cleanup, options),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );
  assert.equal(cleanupCount, 1);
});

test('a throwing local cleanup cannot strand another sealed producer claim', () => {
  const device = queueOrderedDevice();
  const localIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'g2p-local-temporaries'
  });
  const externalIssuer = createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'cross-level-temporaries'
  });
  const localOutput = {};
  const externalOutput = {};
  let localCleanupCount = 0;
  let externalCleanupCount = 0;
  const localCleanup = () => {
    localCleanupCount += 1;
    throw new Error('injected post-seal local cleanup failure');
  };
  const externalCleanup = () => {
    externalCleanupCount += 1;
  };
  const localClaim = registerQueueOrderedCleanupClaim(
    localIssuer,
    device,
    {
      producerOutput: localOutput,
      cleanup: localCleanup
    }
  );
  const externalClaim = registerQueueOrderedCleanupClaim(
    externalIssuer,
    device,
    {
      producerOutput: externalOutput,
      cleanup: externalCleanup
    }
  );
  const receipt = submitQueueOrderedWork(device, [{}]);
  const publishedCapability = sealQueueOrderedFinalConsumerCapability(
    receipt,
    device,
    {
      finalConsumerOwner: localOutput,
      producerClaims: [localClaim, externalClaim]
    }
  );

  assert.throws(
    () => releaseSubmittedWorkCleanupQueueOrdered(
      device,
      localCleanup,
      {
        queueOrderedFinalConsumer: publishedCapability,
        producerClaim: localClaim,
        producerOutput: localOutput,
        producerFamily: 'g2p-local-temporaries'
      }
    ),
    /injected post-seal local cleanup failure/
  );
  assert.equal(localCleanupCount, 1);
  assert.throws(
    () => cancelQueueOrderedCleanupClaim(
      externalClaim,
      device,
      {
        producerOutput: externalOutput,
        cleanup: externalCleanup
      }
    ),
    (error) => error?.code === 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED'
  );

  const externalReceipt = releaseSubmittedWorkCleanupQueueOrdered(
    device,
    externalCleanup,
    {
      queueOrderedFinalConsumer: publishedCapability,
      producerClaim: externalClaim,
      producerOutput: externalOutput,
      producerFamily: 'cross-level-temporaries'
    }
  );
  assert.equal(externalCleanupCount, 1);
  assert.equal(externalReceipt.remainingCapabilityClaimCount, 0);
  assert.equal(device.submitCount, 1);
  assert.equal(device.fenceCount, 0);
});
