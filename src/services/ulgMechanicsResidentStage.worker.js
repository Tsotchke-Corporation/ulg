import {
  runMlsMpmMechanicsG2pStageComputeTask,
  runMlsMpmMechanicsGridUpdateStageComputeTask,
  runMlsMpmMechanicsP2gStageComputeTask
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import { requestOpticalGpuDevice } from '../runtime/material/opticalGpuBuffers.js';

export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_PROTOCOL_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker-result.v0';

const STAGE_RUNNERS = {
  p2g: runMlsMpmMechanicsP2gStageComputeTask,
  gridUpdate: runMlsMpmMechanicsGridUpdateStageComputeTask,
  g2p: runMlsMpmMechanicsG2pStageComputeTask
};

const retainedLanes = new Map();
let workerDeviceResultPromise = null;

function normalizeString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function laneKeyFor(payload = {}) {
  return [
    normalizeString(payload.lease?.laneId ?? payload.lane?.laneId, 'worker-lane:default'),
    normalizeString(payload.lease?.stateKey ?? payload.lane?.stateKey, 'worker-state:default')
  ].join('|');
}

function getLaneRecord(payload = {}) {
  const key = laneKeyFor(payload);
  let record = retainedLanes.get(key);
  if (!record) {
    record = {
      key,
      stageResults: {},
      retainedBuffers: new Map(),
      nextBufferOrdinal: 1
    };
    retainedLanes.set(key, record);
  }
  return record;
}

function isGpuBufferLike(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && (
      value.constructor?.name === 'GPUBuffer'
      || typeof value.mapAsync === 'function'
      || typeof value.getMappedRange === 'function'
    )
  );
}

function retainGpuBuffer(record, stageId, path, buffer) {
  const ref = `ulg-worker:${record.key}:${stageId}:${path}:${record.nextBufferOrdinal++}`;
  record.retainedBuffers.set(ref, buffer);
  return {
    schema: 'peercompute.ulg.worker-retained-buffer-ref.v0',
    ref,
    stageId,
    path
  };
}

function cloneableValue(value, record, stageId, path = 'result', seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'function') return null;
  if (isGpuBufferLike(value)) return retainGpuBuffer(record, stageId, path, value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry, index) => cloneableValue(entry, record, stageId, `${path}.${index}`, seen));
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'device' || key === 'navigatorRef' || key === 'deviceResult') continue;
    out[key] = cloneableValue(entry, record, stageId, `${path}.${key}`, seen);
  }
  return out;
}

function retainedRefsForStageResult(stageId, result = {}) {
  const refs = [];
  const gpuResult = result.gpuResult || {};
  if (stageId === 'p2g' && (result.gridBuffer || gpuResult.gridBuffer || result.gridBufferByteLength > 0)) {
    refs.push('mls-mpm-p2g-grid-buffer');
  }
  if (stageId === 'gridUpdate' && (
    result.updatedGridBuffer
    || gpuResult.updatedGridBuffer
    || result.updatedGridBufferByteLength > 0
  )) {
    refs.push('mls-mpm-grid-update-buffer');
  }
  if (stageId === 'g2p') {
    if (result.stateBuffer || gpuResult.stateBuffer || result.state instanceof Float32Array || result.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (
      result.mechanicsBuffer
      || gpuResult.mechanicsBuffer
      || result.mechanics instanceof Float32Array
      || result.mechanicsBufferByteLength > 0
    ) {
      refs.push('mls-mpm-mechanics-buffer');
    }
  }
  return refs;
}

function retainedWorkerRefs(value = {}, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (value.schema === 'peercompute.ulg.worker-retained-buffer-ref.v0' && value.ref) {
    out.push(value.ref);
    return out;
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return out;
  for (const entry of Object.values(value)) retainedWorkerRefs(entry, out);
  return out;
}

function workerContext(payload = {}) {
  return payload.context?.ulgMechanicsResidentStageWorker
    || payload.context?.mechanicsResidentStageWorker
    || {};
}

async function getWorkerDeviceResult(preferWebGpu) {
  if (preferWebGpu !== true) return null;
  if (!workerDeviceResultPromise) {
    workerDeviceResultPromise = requestOpticalGpuDevice(globalThis.navigator, {
      onDeviceLost() {
        workerDeviceResultPromise = null;
      }
    });
  }
  return workerDeviceResultPromise;
}

function baseStageData(payload = {}) {
  const context = workerContext(payload);
  const common = context.common || {};
  const stageId = normalizeString(payload.stage?.id, null);
  const laneId = normalizeString(payload.lease?.laneId ?? payload.lane?.laneId, null);
  const stateKey = normalizeString(payload.lease?.stateKey ?? payload.lane?.stateKey, null);
  const domainKey = normalizeString(payload.lease?.domainKey ?? payload.lane?.domainKey, null);
  const retainedBufferRefs = stageId === 'p2g'
    ? ['mls-mpm-p2g-grid-buffer']
    : (stageId === 'gridUpdate'
      ? ['mls-mpm-grid-update-buffer']
      : ['sph-state-buffer', 'mls-mpm-mechanics-buffer']);
  return {
    ...common,
    ...(context.stageOptions?.[stageId] || {}),
    preferWebGpu: context.preferWebGpu === true || common.preferWebGpu === true,
    readbackMode: context.readbackMode || common.readbackMode || 'full-parity-readback',
    computeTaskId: `${context.taskIdPrefix || 'ulg-worker:mechanics-stage'}:${stageId}`,
    lawGraphNode: {
      schema: 'peercompute.ulg.law-graph-node-task-ref.v0',
      nodeId: payload.stage?.lawNodeId || `ulg-mls-mpm-mechanics-${stageId}-stage`,
      solverId: `ulg-mls-mpm-mechanics-${stageId}-stage`,
      runtimeTarget: 'gpu-hub-resident-stage-worker',
      readFamilies: [...(payload.stage?.reads || [])],
      writeFamilies: [...(payload.stage?.writes || [])]
    },
    expectedOutputFamilies: [...(payload.stage?.writes || [])],
    gpuFenceRequirement: laneId && stateKey
      ? {
          schema: 'peercompute.compute.gpu-fence-requirement.v0',
          required: true,
          laneId,
          stateKey,
          queueFencePolicy: payload.lease?.queueFencePolicy || 'queue.onSubmittedWorkDone-before-admission',
          retainedBufferRefs,
          source: 'ulg-mechanics-resident-stage-worker'
        }
      : null,
    gpuResidentLane: laneId && stateKey
      ? {
          schema: 'peercompute.compute.gpu-resident-lane-task.v0',
          enabled: true,
          localExecution: 'worker',
          laneId,
          stateKey,
          domainKey,
          solverId: 'ulg-mls-mpm-mechanics-stage-worker',
          owner: 'ulg-mls-mpm-mechanics-law',
          retainedBufferRefs
        }
      : null
  };
}

function stageDataForPayload(payload = {}, record) {
  const stageId = normalizeString(payload.stage?.id, null);
  const data = baseStageData(payload);
  if (stageId === 'gridUpdate') {
    data.p2gGridProjection = record.stageResults.p2g || payload.input;
  }
  if (stageId === 'g2p') {
    data.gridUpdate = record.stageResults.gridUpdate || payload.input;
  }
  return data;
}

export async function runUlgMechanicsResidentStageWorkerPayload(payload = {}) {
  const stageId = normalizeString(payload.stage?.id, null);
  const runner = STAGE_RUNNERS[stageId];
  if (typeof runner !== 'function') {
    throw new Error(`Unsupported ULG mechanics resident worker stage: ${stageId || 'missing-stage'}`);
  }
  const record = getLaneRecord(payload);
  const data = stageDataForPayload(payload, record);
  const workerDeviceResult = await getWorkerDeviceResult(data.preferWebGpu === true);
  if (workerDeviceResult) {
    data.deviceResult = workerDeviceResult;
    data.navigatorRef = globalThis.navigator;
  }
  const rawResult = await runner(data);
  record.stageResults[stageId] = rawResult;
  const cloneableResult = cloneableValue(rawResult, record, stageId);
  const workerRetainedBufferRefs = [...new Set(retainedWorkerRefs(cloneableResult))];
  const retainedBufferRefs = [...new Set([
    ...retainedRefsForStageResult(stageId, rawResult),
    ...workerRetainedBufferRefs
  ])];
  cloneableResult.workerResidentStage = {
    schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
    status: 'worker-stage-completed',
    stageId,
    laneId: payload.lease?.laneId || payload.lane?.laneId || null,
    stateKey: payload.lease?.stateKey || payload.lane?.stateKey || null,
    retainedWithinWorker: true,
    workerWebGpuRequested: data.preferWebGpu === true,
    workerWebGpuStatus: rawResult?.webgpuStatus?.status || workerDeviceResult?.status || null,
    workerWebGpuFallback: rawResult?.webgpuStatus?.fallback || null,
    workerDeviceCached: Boolean(workerDeviceResult?.device),
    workerRetainedBufferRefs,
    cloneableResultReturned: true
  };
  return {
    value: cloneableResult,
    retainedBufferRefs,
    gpuFence: cloneableResult.gpuFence || cloneableResult.gpuFenceReport || null,
    summary: {
      schema: ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA,
      status: 'worker-stage-completed',
      stageId,
      backend: cloneableResult.backend || null,
      workerWebGpuStatus: cloneableResult.workerResidentStage.workerWebGpuStatus,
      retainedBufferRefCount: retainedBufferRefs.length,
      workerRetainedBufferRefCount: workerRetainedBufferRefs.length
    }
  };
}

function postWorkerResult(id, result) {
  globalThis.self.postMessage({
    type: 'resident-stage-result',
    id,
    result
  });
}

function postWorkerError(id, error) {
  globalThis.self.postMessage({
    type: 'resident-stage-error',
    id,
    error: error instanceof Error ? error.message : String(error)
  });
}

if (typeof globalThis.self?.addEventListener === 'function') {
  globalThis.self.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type !== 'run-resident-stage') return;
    runUlgMechanicsResidentStageWorkerPayload(message.payload || {})
      .then((result) => postWorkerResult(message.id, result))
      .catch((error) => postWorkerError(message.id, error));
  });
}
