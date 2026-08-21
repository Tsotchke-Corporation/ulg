const GPU_SHADER_STAGE = {
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 4
};

const DEVICE_COMPUTE_PIPELINE_CACHE = new WeakMap();
const DEVICE_SHADER_MODULE_CACHE = new WeakMap();
const DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE = new WeakMap();

export function computeBufferBinding(
  binding,
  type = 'read-only-storage',
  options = {}
) {
  return {
    binding,
    visibility: GPU_SHADER_STAGE.COMPUTE,
    buffer: { type, ...options }
  };
}

export function createExplicitComputePipeline(device, {
  label,
  module,
  entryPoint = 'main',
  bindings = [],
  explicitLayout = null
} = {}) {
  let bindGroupLayout = explicitLayout?.bindGroupLayout ?? null;
  let pipelineLayout = explicitLayout?.pipelineLayout ?? null;
  if (device?.createBindGroupLayout && device?.createPipelineLayout && bindings.length > 0) {
    if (!bindGroupLayout || !pipelineLayout) {
      bindGroupLayout = device.createBindGroupLayout({
        label: `${label || entryPoint}-bind-group-layout`,
        entries: bindings
      });
      pipelineLayout = device.createPipelineLayout({
        label: `${label || entryPoint}-pipeline-layout`,
        bindGroupLayouts: [bindGroupLayout]
      });
    }
  }
  const pipeline = device.createComputePipeline({
    label,
    layout: pipelineLayout || 'auto',
    compute: { module, entryPoint }
  });
  return {
    pipeline,
    bindGroupLayout: bindGroupLayout || pipeline.getBindGroupLayout(0)
  };
}

function computePipelineCacheForDevice(device) {
  let cache = DEVICE_COMPUTE_PIPELINE_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_COMPUTE_PIPELINE_CACHE.set(device, cache);
  }
  return cache;
}

function shaderModuleCacheForDevice(device) {
  let cache = DEVICE_SHADER_MODULE_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_SHADER_MODULE_CACHE.set(device, cache);
  }
  return cache;
}

function explicitComputeLayoutCacheForDevice(device) {
  let cache = DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE.get(device);
  if (!cache) {
    cache = new Map();
    DEVICE_EXPLICIT_COMPUTE_LAYOUT_CACHE.set(device, cache);
  }
  return cache;
}

function cachedShaderModule(device, { label, code }) {
  const cache = shaderModuleCacheForDevice(device);
  const cached = cache.get(code);
  if (cached) {
    return {
      module: cached,
      cacheStatus: 'shader-module-cache-hit'
    };
  }
  const module = device.createShaderModule({ label, code });
  cache.set(code, module);
  return {
    module,
    cacheStatus: 'shader-module-cache-miss'
  };
}

function bindingSignature(bindings = []) {
  return JSON.stringify(bindings.map((entry) => ({
    binding: entry.binding,
    visibility: entry.visibility,
    buffer: entry.buffer
      ? {
          type: entry.buffer.type || 'uniform',
          hasDynamicOffset: entry.buffer.hasDynamicOffset === true,
          minBindingSize: Number(entry.buffer.minBindingSize || 0)
        }
      : null,
    sampler: entry.sampler ?? null,
    texture: entry.texture ?? null,
    storageTexture: entry.storageTexture ?? null,
    externalTexture: entry.externalTexture ?? null
  })));
}

function cachedExplicitComputeLayout(device, { label, entryPoint, bindings }) {
  if (
    !device?.createBindGroupLayout
    || !device?.createPipelineLayout
    || bindings.length === 0
  ) return null;
  const signature = bindingSignature(bindings);
  const cache = explicitComputeLayoutCacheForDevice(device);
  const cached = cache.get(signature);
  if (cached) {
    return {
      ...cached,
      cacheStatus: 'explicit-layout-cache-hit'
    };
  }
  const bindGroupLayout = device.createBindGroupLayout({
    label: `${label || entryPoint}-bind-group-layout`,
    entries: bindings
  });
  const pipelineLayout = device.createPipelineLayout({
    label: `${label || entryPoint}-pipeline-layout`,
    bindGroupLayouts: [bindGroupLayout]
  });
  const created = { bindGroupLayout, pipelineLayout };
  cache.set(signature, created);
  return {
    ...created,
    cacheStatus: 'explicit-layout-cache-miss'
  };
}

export function createCachedExplicitComputePipeline(device, {
  cacheKey,
  label,
  code,
  entryPoint = 'main',
  bindings = []
} = {}) {
  if (!cacheKey) {
    const module = device.createShaderModule({ label, code });
    return {
      ...createExplicitComputePipeline(device, {
        label,
        module,
        entryPoint,
        bindings
      }),
      cacheStatus: 'not-cached'
    };
  }
  const key = [
    cacheKey,
    label || '',
    entryPoint,
    bindingSignature(bindings)
  ].join('|');
  const cache = computePipelineCacheForDevice(device);
  const cached = cache.get(key);
  if (cached) {
    return {
      ...cached,
      cacheStatus: 'pipeline-cache-hit',
      shaderModuleCacheStatus: 'pipeline-cache-hit'
    };
  }
  const {
    module,
    cacheStatus: shaderModuleCacheStatus
  } = cachedShaderModule(device, { label, code });
  const explicitLayout = cachedExplicitComputeLayout(device, {
    label,
    entryPoint,
    bindings
  });
  const created = createExplicitComputePipeline(device, {
    label,
    module,
    entryPoint,
    bindings,
    explicitLayout
  });
  const entry = {
    ...created,
    pipelineLayout: explicitLayout?.pipelineLayout ?? null
  };
  cache.set(key, entry);
  return {
    ...entry,
    cacheStatus: 'pipeline-cache-miss',
    shaderModuleCacheStatus,
    explicitLayoutCacheStatus:
      explicitLayout?.cacheStatus ?? 'explicit-layout-not-cached'
  };
}

// One fence per registered cleanup, measured at 161 per batch in a production
// frame, all waiting for the same device idle point. Two ways of coalescing
// them were built and both were reverted; do not try a third without reading
// this.
//
// Keeping one fence in flight and making newcomers wait for the *next* one got
// 162 fences per batch down to 4 -- and broke every `ss=1` run with "Thermal
// proposal arena 0 is still leased by generation 1". Arena leases are released
// through this helper, so delaying a release by one fence round trip lets the
// next substep reach `acquire` before the previous release has run. The fence
// count is not the thing to optimise; release latency is a correctness
// property here.
//
// Closing a batch on a microtask instead is safe -- each cleanup's fence is
// created in its own turn -- and measured **no reduction at all**, 162 per
// batch, because the 161 registrations are already spread across separate
// microtask turns by the awaits between stages. Nothing to coalesce.
//
// So this generic fallback stays one fence per cleanup.
//
// A producer that owns an exact, already-submitted same-queue success receipt
// may instead use `releaseSubmittedWorkCleanupQueueOrdered`. That separate API
// requires the caller to authenticate its owner authority before destruction;
// it must never be used to turn this fallback into an optimistic cleanup path.
export function deferSubmittedWorkCleanup(device, cleanup) {
  if (typeof cleanup !== 'function') return false;
  if (!device?.queue?.onSubmittedWorkDone) {
    cleanup();
    return false;
  }
  device.queue.onSubmittedWorkDone()
    .catch(() => null)
    .finally(() => {
      cleanup();
    });
  return true;
}

export const QUEUE_ORDERED_SUBMITTED_WORK_CLEANUP_RECEIPT_SCHEMA =
  'peercompute.ulg.queue-ordered-submitted-work-cleanup-receipt.v0';
export const QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA =
  'peercompute.ulg.queue-ordered-final-consumer-capability.v0';
export const QUEUE_ORDERED_SUBMISSION_RECEIPT_SCHEMA =
  'peercompute.ulg.queue-ordered-submission-receipt.v0';
export const QUEUE_ORDERED_CLEANUP_CLAIM_SCHEMA =
  'peercompute.ulg.queue-ordered-cleanup-claim.v0';
export const QUEUE_ORDERED_CLEANUP_CLAIM_ISSUER_SCHEMA =
  'peercompute.ulg.queue-ordered-cleanup-claim-issuer.v0';

const queueOrderedFinalConsumerCapabilityRecords = new WeakMap();
const queueOrderedSubmissionReceiptRecords = new WeakMap();
const queueOrderedCleanupClaimIssuerRecords = new WeakMap();
const queueOrderedCleanupClaimRecords = new WeakMap();

function queueOrderedAuthorityReference(value) {
  return Boolean(
    value != null
    && (typeof value === 'object' || typeof value === 'function')
  );
}

function queueOrderedCleanupUnauthorized(message) {
  const error = new Error(message);
  error.code = 'ERR_QUEUE_ORDERED_CLEANUP_UNAUTHORIZED';
  return error;
}

/**
 * Create one producer-private claim domain. Producers retain the issuer in
 * module scope and only hand opaque claims to an exact final consumer.
 *
 * A claim binds the cleanup function itself, not merely public output
 * metadata. Creating another issuer therefore cannot authorize replacement
 * cleanup code for a producer's private allocation ledger.
 */
export function createQueueOrderedCleanupClaimIssuer({
  producerFamily = ''
} = {}) {
  const normalizedFamily = typeof producerFamily === 'string'
    ? producerFamily.trim()
    : '';
  if (!normalizedFamily) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered cleanup claim issuer requires one fixed producer family'
    );
  }
  const issuer = Object.freeze({
    schema: QUEUE_ORDERED_CLEANUP_CLAIM_ISSUER_SCHEMA,
    status: 'queue-ordered-cleanup-claim-issuer'
  });
  queueOrderedCleanupClaimIssuerRecords.set(issuer, {
    producerFamily: normalizedFamily,
    registrations: new WeakMap()
  });
  return issuer;
}

export function registerQueueOrderedCleanupClaim(
  issuer,
  device,
  {
    producerOutput = null,
    cleanup = null
  } = {}
) {
  const issuerRecord = queueOrderedCleanupClaimIssuerRecords.get(issuer);
  if (
    !issuerRecord
    || !device?.queue?.submit
    || !queueOrderedAuthorityReference(producerOutput)
    || typeof cleanup !== 'function'
  ) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered cleanup claim requires an exact producer issuer, device, output, and cleanup'
    );
  }
  if (issuerRecord.registrations.has(producerOutput)) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered cleanup claim output is already registered in this producer domain'
    );
  }
  const claim = Object.freeze({
    schema: QUEUE_ORDERED_CLEANUP_CLAIM_SCHEMA,
    status: 'queue-ordered-cleanup-claim-registered'
  });
  issuerRecord.registrations.set(producerOutput, claim);
  queueOrderedCleanupClaimRecords.set(claim, {
    issuer,
    device,
    producerOutput,
    producerFamily: issuerRecord.producerFamily,
    cleanup,
    state: 'registered',
    capability: null
  });
  return claim;
}

/**
 * Cancel a claim that never reached a final-consumer submission. Cancellation
 * requires the original device/output/cleanup tuple and is only valid before
 * sealing. The allocation owner must then use its normal failure cleanup.
 */
export function cancelQueueOrderedCleanupClaim(
  producerClaim,
  device,
  {
    producerOutput = null,
    cleanup = null
  } = {}
) {
  const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
  if (
    !claimRecord
    || claimRecord.state !== 'registered'
    || claimRecord.device !== device
    || claimRecord.producerOutput !== producerOutput
    || claimRecord.cleanup !== cleanup
  ) {
    throw queueOrderedCleanupUnauthorized(
      'only the exact unsealed producer cleanup claim can be cancelled'
    );
  }
  claimRecord.state = 'cancelled';
  return true;
}

/**
 * Submit one exact, nonempty command-buffer family and return an opaque,
 * single-seal receipt. Keeping queue.submit inside this helper prevents a
 * caller from claiming that a final-consumer submission happened when it did
 * not. Empty boundary submits are deliberately rejected: this API must wrap an
 * existing useful submission rather than add hot-loop work.
 */
function createQueueOrderedSubmissionReceipt(device, commandBufferCount, {
  batchMemberOrdinal = null
} = {}) {
  const receipt = Object.freeze({
    schema: QUEUE_ORDERED_SUBMISSION_RECEIPT_SCHEMA,
    status: 'queue-ordered-work-submitted',
    commandBufferCount,
    ...(batchMemberOrdinal == null ? {} : { batchMemberOrdinal })
  });
  queueOrderedSubmissionReceiptRecords.set(receipt, {
    device,
    bound: false
  });
  return receipt;
}

export function submitQueueOrderedWork(device, commandBuffers) {
  if (!device?.queue?.submit) {
    throw new TypeError(
      'queue-ordered submission receipt requires a WebGPU queue'
    );
  }
  if (
    !Array.isArray(commandBuffers)
    || commandBuffers.length === 0
    || commandBuffers.some(
      (commandBuffer) => !queueOrderedAuthorityReference(commandBuffer)
    )
  ) {
    throw new TypeError(
      'queue-ordered submission receipt requires nonempty exact command buffers'
    );
  }
  device.queue.submit(commandBuffers);
  return createQueueOrderedSubmissionReceipt(device, commandBuffers.length);
}

const queueOrderedSubmissionBatchRecords = new WeakMap();

export function createQueueOrderedSubmissionBatch(device, {
  expectedCommandBufferCount
} = {}) {
  if (!device?.queue?.submit) {
    throw new TypeError('queue-ordered batch requires a WebGPU queue');
  }
  const expected = Number(expectedCommandBufferCount);
  if (!Number.isInteger(expected) || expected < 2 || expected > 64) {
    throw new RangeError('expectedCommandBufferCount must be in [2, 64]');
  }
  const batch = Object.freeze({
    schema: 'peercompute.ulg.queue-ordered-submission-batch.v0',
    status: 'queue-ordered-submission-batch-open'
  });
  queueOrderedSubmissionBatchRecords.set(batch, {
    device,
    expected,
    commandBuffers: [],
    waiters: [],
    state: 'open'
  });
  return batch;
}

export function appendQueueOrderedSubmissionBatch(
  batch,
  device,
  commandBuffer
) {
  const record = queueOrderedSubmissionBatchRecords.get(batch);
  if (
    !record
    || record.device !== device
    || record.state !== 'open'
    || !queueOrderedAuthorityReference(commandBuffer)
    || record.commandBuffers.includes(commandBuffer)
    || record.commandBuffers.length >= record.expected
  ) {
    throw new TypeError('queue-ordered batch member is stale, foreign, or invalid');
  }
  const promise = new Promise((resolve, reject) => {
    record.waiters.push({ resolve, reject });
  });
  record.commandBuffers.push(commandBuffer);
  if (record.commandBuffers.length === record.expected) {
    try {
      device.queue.submit(record.commandBuffers);
      record.state = 'submitted';
      for (let index = 0; index < record.waiters.length; index += 1) {
        record.waiters[index].resolve(createQueueOrderedSubmissionReceipt(
          device,
          record.commandBuffers.length,
          { batchMemberOrdinal: index }
        ));
      }
    } catch (error) {
      record.state = 'failed';
      for (const waiter of record.waiters) waiter.reject(error);
    }
  }
  return promise;
}

export function abortQueueOrderedSubmissionBatch(batch, device, reason) {
  const record = queueOrderedSubmissionBatchRecords.get(batch);
  if (!record || record.device !== device || record.state !== 'open') {
    return false;
  }
  const error = reason instanceof Error
    ? reason
    : new Error(String(reason || 'queue-ordered submission batch aborted'));
  record.state = 'aborted';
  for (const waiter of record.waiters) waiter.reject(error);
  return true;
}

function validateQueueOrderedFinalConsumerClaims(
  device,
  {
    finalConsumerOwner = null,
    producerClaims = []
  } = {}
) {
  if (!queueOrderedAuthorityReference(finalConsumerOwner)) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered final-consumer capability requires one exact owner'
    );
  }
  if (!Array.isArray(producerClaims) || producerClaims.length === 0) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered final-consumer capability requires producer-issued opaque claims'
    );
  }
  const uniqueClaims = new Set();
  const claimRecords = [];
  for (const producerClaim of producerClaims) {
    const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
    if (
      !claimRecord
      || claimRecord.state !== 'registered'
      || claimRecord.device !== device
      || uniqueClaims.has(producerClaim)
    ) {
      throw queueOrderedCleanupUnauthorized(
        'queue-ordered final-consumer capability rejected an invalid, transferred, or duplicate producer claim'
      );
    }
    uniqueClaims.add(producerClaim);
    claimRecords.push({ producerClaim, claimRecord });
  }
  return {
    finalConsumerOwner,
    uniqueClaims,
    claimRecords
  };
}

/**
 * Read-only producer-claim preflight for consumers that must create their own
 * output object after queue.submit returns. This does not mint authority; it
 * only proves that the exact opaque batch is presently registered for one
 * device so a useful submission is not issued for an already-invalid batch.
 */
export function assertQueueOrderedCleanupClaimsRegistered(
  device,
  producerClaims
) {
  if (!Array.isArray(producerClaims)) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered producer claim preflight requires an array'
    );
  }
  const uniqueClaims = new Set();
  for (const producerClaim of producerClaims) {
    const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
    if (
      !claimRecord
      || claimRecord.state !== 'registered'
      || claimRecord.device !== device
      || uniqueClaims.has(producerClaim)
    ) {
      throw queueOrderedCleanupUnauthorized(
        'queue-ordered producer claim preflight rejected an invalid, transferred, or duplicate claim'
      );
    }
    uniqueClaims.add(producerClaim);
  }
  return true;
}

function commitQueueOrderedFinalConsumerCapability(
  submissionRecord,
  device,
  validated
) {
  const capability = Object.freeze({
    schema: QUEUE_ORDERED_FINAL_CONSUMER_CAPABILITY_SCHEMA,
    status: 'queue-ordered-final-consumer-capability-issued',
    claimCount: validated.claimRecords.length
  });
  submissionRecord.bound = true;
  for (const { claimRecord } of validated.claimRecords) {
    claimRecord.state = 'sealed';
    claimRecord.capability = capability;
  }
  queueOrderedFinalConsumerCapabilityRecords.set(capability, {
    device,
    finalConsumerOwner: validated.finalConsumerOwner,
    claims: new Set(validated.uniqueClaims),
    remainingClaimCount: validated.claimRecords.length
  });
  return capability;
}

/**
 * Seal producer-issued opaque claims into one helper-observed final-consumer
 * submission. Validation is atomic: a bad or duplicate batch changes neither
 * the receipt nor any claim, so the producer can fall back safely.
 */
export function sealQueueOrderedFinalConsumerCapability(
  submissionReceipt,
  device,
  {
    finalConsumerOwner = null,
    producerClaims = []
  } = {}
) {
  const submissionRecord =
    queueOrderedSubmissionReceiptRecords.get(submissionReceipt);
  if (
    !submissionRecord
    || submissionRecord.bound === true
    || submissionRecord.device !== device
  ) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered final-consumer capability requires one unbound exact submission receipt and owner'
    );
  }
  const validated = validateQueueOrderedFinalConsumerClaims(device, {
    finalConsumerOwner,
    producerClaims
  });
  return commitQueueOrderedFinalConsumerCapability(
    submissionRecord,
    device,
    validated
  );
}

export function submitQueueOrderedFinalConsumerWork(
  device,
  commandBuffers,
  options = {}
) {
  // Validate every claim before the useful queue submission. A submit failure
  // leaves the validated claims registered and retryable; a successful submit
  // has no fallible validation step between receipt creation and commit.
  const validated = validateQueueOrderedFinalConsumerClaims(device, options);
  const submissionReceipt = submitQueueOrderedWork(device, commandBuffers);
  const submissionRecord =
    queueOrderedSubmissionReceiptRecords.get(submissionReceipt);
  return commitQueueOrderedFinalConsumerCapability(
    submissionRecord,
    device,
    validated
  );
}

/**
 * Mechanical same-module path for submitted scratch allocations. The module
 * keeps `issuer` private; this helper registers the exact cleanup, wraps the
 * existing nonempty submit, seals the claim, and consumes it immediately.
 */
export function submitQueueOrderedProducerWorkAndCleanup(
  issuer,
  device,
  commandBuffers,
  {
    producerOutput = null,
    finalConsumerOwner = producerOutput,
    cleanup = null
  } = {}
) {
  const issuerRecord = queueOrderedCleanupClaimIssuerRecords.get(issuer);
  const producerClaim = registerQueueOrderedCleanupClaim(
    issuer,
    device,
    {
      producerOutput,
      cleanup
    }
  );
  let capability;
  try {
    capability = submitQueueOrderedFinalConsumerWork(
      device,
      commandBuffers,
      {
        finalConsumerOwner,
        producerClaims: [producerClaim]
      }
    );
  } catch (error) {
    cancelQueueOrderedCleanupClaim(
      producerClaim,
      device,
      {
        producerOutput,
        cleanup
      }
    );
    throw error;
  }
  const cleanupReceipt = releaseSubmittedWorkCleanupQueueOrdered(
    device,
    cleanup,
    {
      queueOrderedFinalConsumer: capability,
      producerClaim,
      producerOutput,
      producerFamily: issuerRecord.producerFamily
    }
  );
  return Object.freeze({
    submissionReceiptStatus: 'queue-ordered-work-submitted',
    capability,
    producerClaim,
    cleanupReceipt
  });
}

function consumeQueueOrderedFinalConsumerCapability(
  capability,
  {
    device,
    producerClaim,
    producerOutput,
    producerFamily,
    cleanup
  }
) {
  const record =
    queueOrderedFinalConsumerCapabilityRecords.get(capability);
  const claimRecord = queueOrderedCleanupClaimRecords.get(producerClaim);
  if (
    !record
    || record.device !== device
    || !claimRecord
    || claimRecord.state !== 'sealed'
    || claimRecord.capability !== capability
    || claimRecord.device !== device
    || !record.claims.has(producerClaim)
    || !queueOrderedAuthorityReference(producerOutput)
    || typeof producerFamily !== 'string'
    || !producerFamily.trim()
    || claimRecord.producerOutput !== producerOutput
    || claimRecord.producerFamily !== producerFamily.trim()
    || claimRecord.cleanup !== cleanup
  ) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered submitted-work cleanup requires a registered exact final-consumer capability'
    );
  }
  // Consume before invoking user cleanup. A throwing destructor must not make
  // the authority replayable with replacement cleanup code.
  claimRecord.state = 'consumed';
  record.claims.delete(producerClaim);
  record.remainingClaimCount -= 1;
  if (record.remainingClaimCount === 0) {
    queueOrderedFinalConsumerCapabilityRecords.delete(capability);
  }
  return record.remainingClaimCount;
}

/**
 * Destroy one-shot producer temporaries at an authenticated same-queue
 * submission boundary.
 *
 * WebGPU keeps resources referenced by prior submissions alive internally
 * after destroy(), so no host-observed device-idle fence is needed when the
 * exact owner has already submitted every consumer. Arena reuse remains the
 * owner's responsibility and must itself be ordered on the same queue.
 */
export function releaseSubmittedWorkCleanupQueueOrdered(
  device,
  cleanup,
  {
    queueOrderedFinalConsumer = null,
    producerClaim = null,
    producerOutput = null,
    producerFamily = null
  } = {}
) {
  if (typeof cleanup !== 'function') return false;
  if (!device?.queue?.submit) {
    throw new TypeError(
      'queue-ordered submitted-work cleanup requires a WebGPU queue'
    );
  }
  if (queueOrderedFinalConsumer == null) {
    throw queueOrderedCleanupUnauthorized(
      'queue-ordered submitted-work cleanup requires an opaque final-consumer capability'
    );
  }
  const remainingCapabilityClaimCount =
    consumeQueueOrderedFinalConsumerCapability(
      queueOrderedFinalConsumer,
      {
        device,
        producerClaim,
        producerOutput,
        producerFamily,
        cleanup
      }
    );
  cleanup();
  return Object.freeze({
    schema: QUEUE_ORDERED_SUBMITTED_WORK_CLEANUP_RECEIPT_SCHEMA,
    status: 'queue-ordered-submitted-work-cleanup-completed',
    completed: true,
    hostQueueFenceCount: 0,
    queueOrderedFinalConsumerCapabilityClaimConsumed:
      queueOrderedFinalConsumer != null,
    remainingCapabilityClaimCount,
    queueCompletionStatus: 'queue-ordered-owner-submission-authenticated',
    queueCompletionMethod: 'same-gpu-queue-submission-order'
  });
}
