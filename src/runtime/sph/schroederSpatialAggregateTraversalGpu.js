import {
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY,
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID,
  SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE,
  SCHROEDER_SPATIAL_AGGREGATE_LEVEL_ASSIGNMENT_QUERY_FLOATS,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_PARAMS_BYTES,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_FLOATS,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE,
  ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUBMISSION_RECEIPT_SCHEMA,
  ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA,
  createSchroederSpatialAggregateTraversalPlan,
  validateSchroederSpatialAggregateViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  schroederSpatialAggregateStacklessTraversalWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateViewWgsl.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';

const UINT32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const EPOCH_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

const finalizedTraversalSubmissionReceipts = new WeakSet();

function traversalError(message, code, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

function positiveInteger(value, label, max = 0xffff_ffff) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new RangeError(`${label} must be an integer in [1, ${max}]`);
  }
  return number;
}

function exactEpochIdentity(value, aggregateView) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) {
    throw new TypeError('aggregate traversal requires one frozen public E* epoch identity');
  }
  for (const field of EPOCH_FIELDS) {
    const actual = Number(value[field]);
    if (
      !Number.isInteger(actual)
      || actual < 0
      || actual > 0xffff_ffff
      || actual !== aggregateView[field]
    ) {
      throw traversalError(
        `public E* identity ${field} does not match the aggregate view`,
        'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_PUBLIC_EPOCH_IDENTITY'
      );
    }
  }
  return value;
}

function createOwnedBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function paramsData(plan) {
  const data = new ArrayBuffer(SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_PARAMS_BYTES);
  const view = new DataView(data);
  const u32 = (word, value) => view.setUint32(word * 4, Number(value) >>> 0, true);
  const f32 = (word, value) => view.setFloat32(word * 4, Number(value), true);
  u32(0, plan.queryCount);
  u32(1, plan.queryCapacity);
  u32(2, plan.queryStrideFloats);
  u32(3, plan.summaryStrideWords);
  u32(4, plan.generationId);
  u32(5, plan.deviceOrdinal);
  u32(6, plan.laneOrdinal);
  u32(7, plan.leaseToken);
  u32(8, plan.sourceFamilyId);
  u32(9, plan.storageGeneration);
  u32(10, plan.physicsTick);
  u32(11, plan.physicsSubstep);
  u32(12, plan.positionEpoch);
  u32(13, plan.topologyEpoch);
  u32(14, plan.chartEpoch);
  u32(15, plan.levelEpoch);
  u32(16, plan.supportEpoch);
  u32(17, plan.completionOrdinal);
  u32(18, plan.aggregateView.layout.wordLength);
  // The exact module-owned view object and full epoch identity provide CPU
  // provenance. The GPU recomputes the replay guard from the host-known source
  // count and resident cell count, then authenticates every visited rope record
  // without a hot-loop readback.
  u32(19, 0);
  u32(20, 0);
  u32(21, SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE);
  f32(22, plan.gravitationalConstant);
  f32(23, plan.softeningLengthM);
  f32(24, plan.forceScale);
  u32(25, plan.querySourceLayoutId);
  f32(26, plan.nearFieldSupportScale);
  f32(27, plan.openingTheta);
  u32(28, plan.aggregateView.sourceCount);
  return data;
}

function dispatchData(queryCount) {
  return new Uint32Array([
    Math.ceil(queryCount / SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE),
    1,
    1
  ]);
}

function identityObject(execution) {
  return Object.freeze(Object.fromEntries(EPOCH_FIELDS.map((field) => [
    field,
    execution[field]
  ])));
}

export function createSchroederSpatialAggregateTraversalGpu(device, {
  maxQueryCount,
  arenaCount = 2,
  label = 'ulg-schroeder-spatial-aggregate-traversal'
} = {}) {
  if (
    !device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer
  ) {
    throw new TypeError('aggregate traversal requires a WebGPU-like device');
  }
  const resolvedMaxQueryCount = positiveInteger(maxQueryCount, 'maxQueryCount');
  const resolvedArenaCount = positiveInteger(arenaCount, 'arenaCount', 8);
  const maxComputeWorkgroupsPerDimension = positiveInteger(
    device.limits?.maxComputeWorkgroupsPerDimension ?? 65535,
    'device.limits.maxComputeWorkgroupsPerDimension'
  );
  if (
    Math.ceil(
      resolvedMaxQueryCount / SCHROEDER_SPATIAL_AGGREGATE_VIEW_WORKGROUP_SIZE
    ) > maxComputeWorkgroupsPerDimension
  ) {
    throw new RangeError('aggregate traversal query dispatch exceeds the WebGPU limit');
  }
  const summaryByteLength = resolvedMaxQueryCount
    * SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
    * UINT32_BYTES;
  const module = device.createShaderModule({
    label: `${label}-shader`,
    code: schroederSpatialAggregateStacklessTraversalWgsl
  });
  const pipeline = device.createComputePipeline({
    label: `${label}-pipeline`,
    layout: 'auto',
    compute: { module, entryPoint: 'traverse_aggregate_view' }
  });
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  const deviceId = webGpuDeviceId(device);
  let runtime = null;
  let destroyed = false;
  let deviceLossObserved = false;
  let serial = 0;
  const ownershipRecords = new WeakMap();
  const retirementCompletionPromises = new WeakMap();
  const releasedExecutions = new WeakSet();
  const submittedExecutions = new WeakSet();

  const arenas = Array.from({ length: resolvedArenaCount }, (_, arenaIndex) => {
    const arenaLabel = `${label}-arena-${arenaIndex}`;
    return {
      arenaIndex,
      generation: 0,
      inUse: false,
      retired: false,
      buffersDestroyed: false,
      execution: null,
      paramsBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-params`,
        SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      summaryBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-summaries`,
        summaryByteLength,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
      ),
      dispatchBuffer: createOwnedBuffer(
        device,
        `${arenaLabel}-dispatch`,
        3 * UINT32_BYTES,
        GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_DST
      )
    };
  });
  const retainedGpuBufferBytes = arenas.reduce((sum, arena) => (
    sum
      + Number(arena.paramsBuffer.size ?? 0)
      + Number(arena.summaryBuffer.size ?? 0)
      + Number(arena.dispatchBuffer.size ?? 0)
  ), 0);

  function destroyArenaBuffers(arena) {
    if (arena.buffersDestroyed) return false;
    arena.buffersDestroyed = true;
    arena.paramsBuffer.destroy?.();
    arena.summaryBuffer.destroy?.();
    arena.dispatchBuffer.destroy?.();
    return true;
  }

  function acquireArena() {
    if (destroyed) {
      throw traversalError(
        'aggregate traversal runtime is destroyed',
        'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_RUNTIME_DESTROYED'
      );
    }
    if (deviceLossObserved) {
      throw traversalError(
        'aggregate traversal runtime observed device loss',
        'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_DEVICE_LOST'
      );
    }
    const arena = arenas.find((candidate) => !candidate.inUse && !candidate.retired);
    if (!arena) {
      throw traversalError(
        'aggregate traversal arenas are under backpressure',
        'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_ARENA_EXHAUSTED'
      );
    }
    arena.inUse = true;
    arena.generation = ++serial;
    return arena;
  }

  function ownershipFor(execution) {
    const record = ownershipRecords.get(execution);
    if (
      !record
      || releasedExecutions.has(execution)
      || execution?.ownerRuntime !== runtime
      || record.arena.execution !== execution
      || record.arena.inUse !== true
      || record.arena.generation !== record.arenaGeneration
      || execution.arenaGeneration !== record.arenaGeneration
      || execution.aggregateView !== record.aggregateView
      || execution.queryBuffer !== record.queryBuffer
      || execution.publicEpochIdentity !== record.publicEpochIdentity
      || execution.topologyFingerprintCheckEncoded !== true
      || execution.globalTopologySealRequiredEncoded !== true
      || execution.visitedTopologyFingerprintRecomputeEncoded !== true
      || execution.expectedGlobalTopologyFingerprintCompared !== false
      || execution.replayGuardRecomputedEncoded !== true
    ) {
      throw traversalError(
        'aggregate traversal execution is stale or foreign',
        'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_FOREIGN_EXECUTION'
      );
    }
    return record;
  }

  function finishRetirement(record, { deviceLost = false } = {}) {
    if (record.completed) return true;
    const { arena, execution } = record;
    ownershipFor(execution);
    if (deviceLost) destroyArenaBuffers(arena);
    arena.inUse = false;
    arena.retired = deviceLost;
    arena.execution = null;
    releasedExecutions.add(execution);
    submittedExecutions.delete(execution);
      ownershipRecords.delete(execution);
    execution.releaseScheduled = false;
    execution.status = deviceLost
      ? 'schroeder-spatial-aggregate-traversal-device-loss-retired'
      : 'schroeder-spatial-aggregate-traversal-released';
    record.activeAttempt = null;
    record.completed = true;
    record.resolveCompletion(true);
    return true;
  }

  runtime = {
    schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA,
    status: 'schroeder-spatial-aggregate-traversal-runtime-ready',
    deviceId,
    maxQueryCount: resolvedMaxQueryCount,
    arenaCount: resolvedArenaCount,
    retainedGpuBufferBytes,
    normalHotLoopReadbackFree: true,

    encode(encoder, {
      aggregateView,
      queryBuffer,
      queryCount,
      queryStrideFloats = SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_FLOATS,
      querySourceLayoutId =
        SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT.PACKED_QUERY_V0,
      nearFieldSupportScale = 1,
      openingTheta = 0.5,
      publicEpochIdentity,
      gravitationalConstant = 6.6743e-11,
      softeningLengthM = 1e-6,
      forceScale = 1
    } = {}) {
      if (!encoder?.beginComputePass || !encoder?.clearBuffer) {
        throw new TypeError('aggregate traversal requires a caller-owned encoder');
      }
      const admission = validateSchroederSpatialAggregateViewDescriptor(aggregateView);
      if (!admission.admitted) {
        throw new TypeError(`aggregate traversal rejected view: ${admission.status}`);
      }
      if (
        aggregateView.deviceId !== deviceId
        || !webGpuBufferMatchesDevice(aggregateView.aggregateViewBuffer, device)
      ) {
        throw traversalError(
          'aggregate traversal view belongs to another device',
          'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_DEVICE_MISMATCH'
        );
      }
      if (!queryBuffer || !webGpuBufferMatchesDevice(queryBuffer, device)) {
        throw traversalError(
          'aggregate traversal query buffer belongs to another device',
          'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_DEVICE_MISMATCH'
        );
      }
      const count = positiveInteger(queryCount, 'queryCount', resolvedMaxQueryCount);
      const stride = positiveInteger(
        queryStrideFloats,
        'queryStrideFloats',
        64
      );
      const sourceLayoutId = Number(querySourceLayoutId);
      if (
        sourceLayoutId
          !== SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
            .PACKED_QUERY_V0
        && sourceLayoutId
          !== SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
            .LEVEL_ASSIGNMENT_V0
      ) {
        throw new RangeError('querySourceLayoutId is not a supported aggregate query ABI');
      }
      const minimumQueryStride = sourceLayoutId
        === SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
          .LEVEL_ASSIGNMENT_V0
        ? SCHROEDER_SPATIAL_AGGREGATE_LEVEL_ASSIGNMENT_QUERY_FLOATS
        : SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_FLOATS;
      const canonicalLevelAssignmentQuery = sourceLayoutId
        === SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
          .LEVEL_ASSIGNMENT_V0;
      if (stride < minimumQueryStride) {
        throw new RangeError(
          `queryStrideFloats must be at least ${minimumQueryStride}`
        );
      }
      if (
        Number.isFinite(Number(queryBuffer.size))
        && Number(queryBuffer.size) < count * stride * Float32Array.BYTES_PER_ELEMENT
      ) {
        throw new RangeError('aggregate traversal query buffer is undersized');
      }
      if (canonicalLevelAssignmentQuery && (
        aggregateView.spatialExecution?.sourceRowLayoutId !== 1
        || aggregateView.spatialSource?.sourceBuffer !== queryBuffer
        || aggregateView.sourceCount !== count
      )) {
        throw traversalError(
          'level-assignment aggregate queries must be the exact complete E* source rows',
          'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_QUERY_PROVENANCE'
        );
      }
      const epochIdentity = exactEpochIdentity(publicEpochIdentity, aggregateView);
      const plan = createSchroederSpatialAggregateTraversalPlan({
        aggregateView,
        queryCount: count,
        queryCapacity: resolvedMaxQueryCount,
        queryStrideFloats: stride,
        querySourceLayoutId: sourceLayoutId,
        nearFieldSupportScale,
        openingTheta,
        gravitationalConstant,
        softeningLengthM,
        forceScale
      });
      const arena = acquireArena();
      try {
        device.queue.writeBuffer(arena.paramsBuffer, 0, paramsData(plan));
        device.queue.writeBuffer(arena.dispatchBuffer, 0, dispatchData(count));
        encoder.clearBuffer(arena.summaryBuffer);
        const bindGroup = device.createBindGroup({
          label: `${label}-bind-group-${arena.arenaIndex}-${arena.generation}`,
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: aggregateView.aggregateViewBuffer } },
            { binding: 1, resource: { buffer: queryBuffer } },
            { binding: 2, resource: { buffer: arena.summaryBuffer } },
            { binding: 3, resource: { buffer: arena.paramsBuffer } }
          ]
        });
        const pass = encoder.beginComputePass({
          label: `${label}-pass-${arena.arenaIndex}-${arena.generation}`
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroupsIndirect(arena.dispatchBuffer, 0);
        pass.end();
        let resolveCompletion;
        const completionPromise = new Promise((resolve) => {
          resolveCompletion = resolve;
        });
        const execution = {
          ...plan,
          schema: ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SCHEMA,
          status: 'schroeder-spatial-aggregate-traversal-gpu-encoded',
          deviceId,
          arenaIndex: arena.arenaIndex,
          arenaGeneration: arena.generation,
          aggregateView,
          aggregateViewBuffer: aggregateView.aggregateViewBuffer,
          queryBuffer,
          publicEpochIdentity: epochIdentity,
          traversalSummaryBuffer: arena.summaryBuffer,
          indirectDispatchBuffer: arena.dispatchBuffer,
          indirectDispatchOffsetBytes: 0,
          submitPerformed: false,
          releaseScheduled: false,
          readbackPerformed: false,
          fullReadbackPerformed: false,
          materializedCandidateRowCount: 0,
          perSourceCandidateBudget: null,
          submissionAuthenticated: false,
          authenticationScope: 'submission-and-provenance-only',
          queueCompletionObserved: false,
          gpuResultObserved: false,
          resultAuthenticated: false,
          failClosedSummaryProtocolEncoded: true,
          exactNearFarPartitionCheckEncoded: true,
          topologyFingerprintCheckEncoded: true,
          globalTopologySealRequiredEncoded: true,
          visitedTopologyFingerprintRecomputeEncoded: true,
          expectedGlobalTopologyFingerprintCompared: false,
          replayGuardRecomputedEncoded: true,
          visitedNodeSummaryEncoded: true,
          summaryPublicationContract: 'per-row-status-gated-fail-closed',
          summaryCapacityHostValidated: true,
          gpuSummaryOutcomeObserved: false,
          mixedSummaryStatusPossible: true,
          authoritativeStateMutationCount: 0,
          authoritativeStatePublicationPerformed: false,
          canonicalQueryProvenanceAuthenticated:
            canonicalLevelAssignmentQuery,
          encodedDispatchCount: 1,
          encodedComputePassCount: 1,
          retainedGpuBufferBytes,
          gpuBufferCreationCountDuringEncode: 0
        };
        Object.defineProperty(execution, 'ownerRuntime', {
          value: runtime,
          enumerable: false
        });
        Object.defineProperty(execution, 'released', {
          get() { return releasedExecutions.has(execution); },
          enumerable: true
        });
        const record = {
          execution,
          arena,
          arenaGeneration: arena.generation,
          aggregateView,
          queryBuffer,
          publicEpochIdentity: epochIdentity,
          completionPromise,
          resolveCompletion,
          completed: false,
          activeAttempt: null,
          nextAttemptOrdinal: 0,
          deviceLossEvidence: null,
          submissionEvidence: null,
          finalizedSubmissionReceipt: null
        };
        arena.execution = execution;
        ownershipRecords.set(execution, record);
        retirementCompletionPromises.set(execution, completionPromise);
        return execution;
      } catch (error) {
        arena.inUse = false;
        arena.execution = null;
        throw error;
      }
    },

    ownsExecution(execution) {
      try {
        ownershipFor(execution);
        return true;
      } catch {
        return false;
      }
    },

    markExecutionSubmitted(execution) {
      const record = ownershipFor(execution);
      if (submittedExecutions.has(execution)) return false;
      submittedExecutions.add(execution);
      execution.submitPerformed = true;
      execution.submissionAuthenticated = true;
      execution.status = 'schroeder-spatial-aggregate-traversal-gpu-submitted';
      record.submissionEvidence = Object.freeze({
        schema:
          'peercompute.ulg.schroeder-spatial-aggregate-traversal-submission-evidence.v1',
        status: 'schroeder-spatial-aggregate-traversal-gpu-submission-authenticated',
        receiptKind: 'gpu-fail-closed-summary-dispatch',
        authenticated: true,
        submissionAuthenticated: true,
        authenticationScope: 'submission-and-provenance-only',
        queueCompletionObserved: false,
        gpuAuthenticated: false,
        gpuResultObserved: false,
        resultAuthenticated: false,
        execution,
        aggregateView: execution.aggregateView,
        queryCount: execution.queryCount,
        traversalCount: 1,
        failClosedSummaryProtocolEncoded: true,
        exactNearFarPartitionCheckEncoded: true,
        topologyFingerprintCheckEncoded: true,
        globalTopologySealRequiredEncoded: true,
        visitedTopologyFingerprintRecomputeEncoded: true,
        expectedGlobalTopologyFingerprintCompared: false,
        replayGuardRecomputedEncoded: true,
        visitedNodeSummaryEncoded: true,
        summaryPublicationContract: 'per-row-status-gated-fail-closed',
        summaryCapacityHostValidated: true,
        gpuSummaryOutcomeObserved: false,
        mixedSummaryStatusPossible: true,
        authoritativeStateMutationCount: 0,
        authoritativeStatePublicationPerformed: false,
        traversalSummaryBuffer: execution.traversalSummaryBuffer,
        traversalSummaryStrideWords:
          SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS,
        querySourceLayoutAuthenticated: true,
        querySourceLayoutId: execution.querySourceLayoutId,
        canonicalQueryProvenanceAuthenticated:
          execution.canonicalQueryProvenanceAuthenticated === true,
        materializedCandidateRowCount: 0,
        perSourceCandidateBudget: null,
        explicitExhaustiveFallbackDispatchCount: 0,
        explicitFallbackPathEncoded: false,
        fullReadbackPerformed: false
      });
      Object.defineProperty(execution, 'submissionEvidence', {
        value: record.submissionEvidence,
        enumerable: true
      });
      return true;
    },

    isExecutionSubmitted(execution) {
      return submittedExecutions.has(execution)
        && this.ownsExecution(execution)
        && execution.submitPerformed === true;
    },

    finalizeSubmissionReceipt(execution, submissionEvidence) {
      const record = ownershipFor(execution);
      if (record.finalizedSubmissionReceipt) {
        return record.finalizedSubmissionReceipt;
      }
      if (
        !submittedExecutions.has(execution)
        || submissionEvidence !== record.submissionEvidence
        || submissionEvidence?.execution !== execution
        || submissionEvidence.aggregateView !== execution.aggregateView
        || submissionEvidence.receiptKind
          !== 'gpu-fail-closed-summary-dispatch'
        || submissionEvidence.authenticated !== true
        || submissionEvidence.submissionAuthenticated !== true
        || submissionEvidence.authenticationScope
          !== 'submission-and-provenance-only'
        || submissionEvidence.queueCompletionObserved !== false
        || submissionEvidence.gpuAuthenticated !== false
        || submissionEvidence.gpuResultObserved !== false
        || submissionEvidence.resultAuthenticated !== false
        || submissionEvidence.traversalCount !== 1
        || submissionEvidence.failClosedSummaryProtocolEncoded !== true
        || submissionEvidence.exactNearFarPartitionCheckEncoded !== true
        || submissionEvidence.topologyFingerprintCheckEncoded !== true
        || submissionEvidence.globalTopologySealRequiredEncoded !== true
        || submissionEvidence.visitedTopologyFingerprintRecomputeEncoded !== true
        || submissionEvidence.expectedGlobalTopologyFingerprintCompared !== false
        || submissionEvidence.replayGuardRecomputedEncoded !== true
        || submissionEvidence.visitedNodeSummaryEncoded !== true
        || submissionEvidence.summaryPublicationContract
          !== 'per-row-status-gated-fail-closed'
        || submissionEvidence.summaryCapacityHostValidated !== true
        || submissionEvidence.gpuSummaryOutcomeObserved !== false
        || submissionEvidence.mixedSummaryStatusPossible !== true
        || submissionEvidence.authoritativeStateMutationCount !== 0
        || submissionEvidence.authoritativeStatePublicationPerformed !== false
        || submissionEvidence.traversalSummaryBuffer
          !== execution.traversalSummaryBuffer
        || submissionEvidence.traversalSummaryStrideWords
          !== SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
        || submissionEvidence.querySourceLayoutAuthenticated !== true
        || submissionEvidence.querySourceLayoutId !== execution.querySourceLayoutId
        || submissionEvidence.canonicalQueryProvenanceAuthenticated
          !== execution.canonicalQueryProvenanceAuthenticated
        || submissionEvidence.materializedCandidateRowCount !== 0
        || submissionEvidence.perSourceCandidateBudget !== null
        || submissionEvidence.explicitExhaustiveFallbackDispatchCount !== 0
        || submissionEvidence.explicitFallbackPathEncoded !== false
        || submissionEvidence.fullReadbackPerformed !== false
      ) {
        throw traversalError(
          'aggregate traversal submission receipt requires exact module-issued evidence',
          'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_GPU_EVIDENCE'
        );
      }
      const receipt = Object.freeze({
        schema:
          ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUBMISSION_RECEIPT_SCHEMA,
        status:
          'schroeder-spatial-aggregate-traversal-submission-receipt-finalized',
        receiptKind: 'gpu-fail-closed-summary-dispatch',
        authenticated: true,
        submissionAuthenticated: true,
        authenticationScope: 'submission-and-provenance-only',
        queueCompletionObserved: false,
        gpuAuthenticated: false,
        gpuResultObserved: false,
        resultAuthenticated: false,
        submitPerformed: true,
        generationBound: true,
        publicEpochBound: true,
        consumerId: SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID,
        phase: SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE,
        artifactFamily: SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY,
        deviceId,
        generationId: execution.generationId,
        completionOrdinal: execution.completionOrdinal,
        epochIdentity: identityObject(execution),
        aggregateView: execution.aggregateView,
        traversalExecution: execution,
        traversalCount: 1,
        queryCount: execution.queryCount,
        querySourceLayoutId: execution.querySourceLayoutId,
        querySourceLayout: execution.querySourceLayout,
        querySourceLayoutAuthenticated: true,
        canonicalQueryProvenanceAuthenticated:
          execution.canonicalQueryProvenanceAuthenticated === true,
        queryStrideFloats: execution.queryStrideFloats,
        nearFieldSupportScale: execution.nearFieldSupportScale,
        openingTheta: execution.openingTheta,
        failClosedSummaryProtocolEncoded: true,
        exactNearFarPartitionCheckEncoded: true,
        topologyFingerprintCheckEncoded: true,
        globalTopologySealRequiredEncoded: true,
        visitedTopologyFingerprintRecomputeEncoded: true,
        expectedGlobalTopologyFingerprintCompared: false,
        replayGuardRecomputedEncoded: true,
        visitedNodeSummaryEncoded: true,
        summaryPublicationContract: 'per-row-status-gated-fail-closed',
        summaryCapacityHostValidated: true,
        gpuSummaryOutcomeObserved: false,
        mixedSummaryStatusPossible: true,
        authoritativeStateMutationCount: 0,
        authoritativeStatePublicationPerformed: false,
        traversalSummaryBuffer: execution.traversalSummaryBuffer,
        traversalSummaryStrideWords:
          SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS,
        visitedNodeCountObserved: null,
        exactNearFarPartitionObserved: null,
        topologyFingerprintObserved: null,
        materializedCandidateRowCount: 0,
        perSourceCandidateBudget: null,
        privateLookupBuildCount: 0,
        fixedCandidateBuildCount: 0,
        explicitExhaustiveFallbackDispatchCount: 0,
        explicitFallbackPathEncoded: false,
        fullReadbackPerformed: false
      });
      record.finalizedSubmissionReceipt = receipt;
      finalizedTraversalSubmissionReceipts.add(receipt);
      return receipt;
    },

    releaseExecution(execution, { discardedEncoder = false } = {}) {
      if (discardedEncoder !== true) {
        throw new TypeError('releaseExecution requires { discardedEncoder: true }');
      }
      if (releasedExecutions.has(execution)) return true;
      const record = ownershipFor(execution);
      if (submittedExecutions.has(execution)) {
        throw new Error('submitted aggregate traversal requires a queue fence');
      }
      return finishRetirement(record);
    },

    releaseExecutionAfter(execution, submissionFence) {
      if (!submissionFence?.then) {
        throw new TypeError('releaseExecutionAfter requires a submission-fence thenable');
      }
      if (releasedExecutions.has(execution)) {
        return retirementCompletionPromises.get(execution) ?? Promise.resolve(true);
      }
      const record = ownershipFor(execution);
      if (deviceLossObserved) return this.quarantineExecutionAfterDeviceLoss(execution);
      if (!submittedExecutions.has(execution)) {
        throw new Error('unsubmitted aggregate traversal requires discarded-encoder release');
      }
      if (record.activeAttempt) return record.activeAttempt.promise;
      const attempt = {
        mode: 'queue-fence',
        ordinal: ++record.nextAttemptOrdinal,
        promise: null
      };
      record.activeAttempt = attempt;
      execution.releaseScheduled = true;
      const promise = Promise.resolve(submissionFence).then(
        () => {
          if (record.activeAttempt !== attempt) return record.completionPromise;
          return finishRetirement(record);
        },
        (error) => {
          if (record.activeAttempt !== attempt) return record.completionPromise;
          record.activeAttempt = null;
          execution.releaseScheduled = false;
          execution.status = 'schroeder-spatial-aggregate-traversal-release-blocked';
          throw error;
        }
      );
      attempt.promise = promise;
      return promise;
    },

    quarantineExecutionAfterDeviceLoss(execution) {
      if (releasedExecutions.has(execution)) {
        return retirementCompletionPromises.get(execution) ?? Promise.resolve(true);
      }
      const record = ownershipFor(execution);
      const exactLossEvidence = record.deviceLossEvidence ?? device?.lost;
      if (!exactLossEvidence || typeof exactLossEvidence.then !== 'function') {
        throw traversalError(
          'aggregate traversal quarantine requires the exact GPUDevice.lost promise',
          'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_DEVICE_LOSS_EVIDENCE',
          TypeError
        );
      }
      record.deviceLossEvidence = exactLossEvidence;
      deviceLossObserved = true;
      runtime.status = 'schroeder-spatial-aggregate-traversal-device-loss-quarantined';
      if (record.activeAttempt?.mode === 'device-loss') {
        return record.activeAttempt.promise;
      }
      record.activeAttempt?.promise?.catch?.(() => {});
      const attempt = {
        mode: 'device-loss',
        ordinal: ++record.nextAttemptOrdinal,
        promise: null
      };
      record.activeAttempt = attempt;
      execution.releaseScheduled = true;
      execution.status = 'schroeder-spatial-aggregate-traversal-device-loss-quarantined';
      const promise = Promise.resolve(exactLossEvidence).then(
        () => {
          if (record.activeAttempt !== attempt) return record.completionPromise;
          return finishRetirement(record, { deviceLost: true });
        },
        (error) => {
          if (record.activeAttempt !== attempt) return record.completionPromise;
          record.activeAttempt = null;
          execution.releaseScheduled = false;
          throw error;
        }
      );
      attempt.promise = promise;
      promise.catch(() => {});
      return promise;
    },

    executionRetirementCompletionPromise(execution) {
      const completionPromise = retirementCompletionPromises.get(execution);
      if (!completionPromise) {
        throw traversalError(
          'aggregate traversal execution is foreign',
          'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_FOREIGN_EXECUTION'
        );
      }
      return completionPromise;
    },

    activeExecutionCount() {
      return arenas.reduce((count, arena) => count + (arena.inUse ? 1 : 0), 0);
    },

    allocationEntries() {
      return arenas.flatMap((arena) => [
        { role: 'aggregate-traversal-params', arenaIndex: arena.arenaIndex, buffer: arena.paramsBuffer },
        { role: 'aggregate-traversal-summary', arenaIndex: arena.arenaIndex, buffer: arena.summaryBuffer },
        { role: 'aggregate-traversal-dispatch', arenaIndex: arena.arenaIndex, buffer: arena.dispatchBuffer }
      ]);
    },

    destroy() {
      if (destroyed) return true;
      if (arenas.some((arena) => arena.inUse)) return false;
      for (const arena of arenas) destroyArenaBuffers(arena);
      destroyed = true;
      this.status = 'schroeder-spatial-aggregate-traversal-runtime-destroyed';
      return true;
    }
  };
  return runtime;
}

export function finalizeSchroederSpatialAggregateTraversalSubmissionReceipt(
  execution,
  submissionEvidence
) {
  if (typeof execution?.ownerRuntime?.finalizeSubmissionReceipt !== 'function') {
    throw new TypeError('aggregate traversal execution lacks its exact owner runtime');
  }
  return execution.ownerRuntime.finalizeSubmissionReceipt(
    execution,
    submissionEvidence
  );
}

export function isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt(
  receipt
) {
  return Boolean(
    receipt
    && finalizedTraversalSubmissionReceipts.has(receipt)
    && receipt.schema
      === ULG_SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUBMISSION_RECEIPT_SCHEMA
    && receipt.status
      === 'schroeder-spatial-aggregate-traversal-submission-receipt-finalized'
    && receipt.receiptKind === 'gpu-fail-closed-summary-dispatch'
    && receipt.authenticated === true
    && receipt.submissionAuthenticated === true
    && receipt.authenticationScope === 'submission-and-provenance-only'
    && receipt.queueCompletionObserved === false
    && receipt.gpuAuthenticated === false
    && receipt.gpuResultObserved === false
    && receipt.resultAuthenticated === false
    && receipt.submitPerformed === true
    && receipt.generationBound === true
    && receipt.publicEpochBound === true
    && receipt.consumerId === SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ID
    && receipt.phase === SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_PHASE
    && receipt.artifactFamily
      === SCHROEDER_SPATIAL_AGGREGATE_CONSUMER_ARTIFACT_FAMILY
    && receipt.traversalCount === 1
    && receipt.failClosedSummaryProtocolEncoded === true
    && receipt.exactNearFarPartitionCheckEncoded === true
    && receipt.topologyFingerprintCheckEncoded === true
    && receipt.globalTopologySealRequiredEncoded === true
    && receipt.visitedTopologyFingerprintRecomputeEncoded === true
    && receipt.expectedGlobalTopologyFingerprintCompared === false
    && receipt.replayGuardRecomputedEncoded === true
    && receipt.visitedNodeSummaryEncoded === true
    && receipt.summaryPublicationContract
      === 'per-row-status-gated-fail-closed'
    && receipt.summaryCapacityHostValidated === true
    && receipt.gpuSummaryOutcomeObserved === false
    && receipt.mixedSummaryStatusPossible === true
    && receipt.authoritativeStateMutationCount === 0
    && receipt.authoritativeStatePublicationPerformed === false
    && receipt.traversalSummaryBuffer
      === receipt.traversalExecution?.traversalSummaryBuffer
    && receipt.traversalSummaryStrideWords
      === SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
    && receipt.visitedNodeCountObserved === null
    && receipt.exactNearFarPartitionObserved === null
    && receipt.topologyFingerprintObserved === null
    && receipt.querySourceLayoutAuthenticated === true
    && typeof receipt.canonicalQueryProvenanceAuthenticated === 'boolean'
    && receipt.materializedCandidateRowCount === 0
    && receipt.perSourceCandidateBudget === null
    && receipt.explicitExhaustiveFallbackDispatchCount === 0
    && receipt.explicitFallbackPathEncoded === false
    && receipt.fullReadbackPerformed === false
  );
}
