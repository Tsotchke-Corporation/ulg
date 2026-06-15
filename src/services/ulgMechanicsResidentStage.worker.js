import {
  runSphReactionProductStageComputeTask,
  runSphThermalPhaseStageComputeTask,
  runMlsMpmMechanicsG2pStageComputeTask,
  runMlsMpmMechanicsGridUpdateStageComputeTask,
  runMlsMpmMechanicsP2gStageComputeTask
} from '../runtime/sph/sphMlsMpmGpuStep.js';
import { requestOpticalGpuDevice } from '../runtime/material/opticalGpuBuffers.js';

export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_PROTOCOL_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker.v0';
export const ULG_MECHANICS_RESIDENT_STAGE_WORKER_RESULT_SCHEMA = 'peercompute.ulg.mechanics-resident-stage-worker-result.v0';

const NO_FULL_READBACK_MODE = 'no-full-readback';
const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

const STAGE_RUNNERS = {
  p2g: runMlsMpmMechanicsP2gStageComputeTask,
  gridUpdate: runMlsMpmMechanicsGridUpdateStageComputeTask,
  g2p: runMlsMpmMechanicsG2pStageComputeTask,
  thermalPhase: runSphThermalPhaseStageComputeTask,
  reactionProduct: runSphReactionProductStageComputeTask
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
      retainedThermoBuffer: null,
      retainedThermoBufferByteLength: 0,
      retainedThermoBufferSourceStage: null,
      retainedThermoBufferSeededFromCpu: false,
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
  if (stageId === 'thermalPhase') {
    if (result.stateBuffer || gpuResult.stateBuffer || result.state instanceof Float32Array || result.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result.thermoBuffer || gpuResult.thermoBuffer || result.thermo instanceof Float32Array || result.thermoBufferByteLength > 0) {
      refs.push('sph-thermo-buffer');
    }
  }
  if (stageId === 'reactionProduct') {
    if (result.stateBuffer || gpuResult.stateBuffer || result.state instanceof Float32Array || result.stateBufferByteLength > 0) {
      refs.push('sph-state-buffer');
    }
    if (result.thermoBuffer || gpuResult.thermoBuffer || result.thermo instanceof Float32Array || result.thermoBufferByteLength > 0) {
      refs.push('sph-thermo-buffer');
    }
    if (result.mechanicsBuffer || gpuResult.mechanicsBuffer || result.mechanics instanceof Float32Array || result.mechanicsBufferByteLength > 0) {
      refs.push('mls-mpm-mechanics-buffer');
    }
    if (
      result.residentProductMass?.productEventBufferRetained
      || result.residentProductMassBufferRetained
      || result.reactionSummary?.productEventBufferRetained
    ) {
      refs.push('resident-product-mass-buffer');
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

function writeWorkerStorageBuffer(device, label, data) {
  if (!device?.createBuffer || !device.queue?.writeBuffer || !ArrayBuffer.isView(data)) return null;
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function retainedG2pOutput(record) {
  const g2p = record?.stageResults?.g2p || null;
  const source = g2p?.gpuResult || g2p;
  if (!source?.stateBuffer || !source?.mechanicsBuffer) return null;
  return source;
}

function retainedThermalOutput(record) {
  const thermal = record?.stageResults?.thermalPhase || null;
  const source = thermal?.gpuResult || thermal;
  if (!source?.stateBuffer && !source?.thermoBuffer) return null;
  return source;
}

function stageUsesSphThermo(stageId) {
  return stageId === 'p2g' || stageId === 'g2p' || stageId === 'thermalPhase' || stageId === 'reactionProduct';
}

function ensureWorkerRetainedThermoBuffer({ data, record, workerDeviceResult }) {
  if (record.retainedThermoBuffer) {
    return {
      status: 'worker-retained-thermo-ready',
      thermoBuffer: record.retainedThermoBuffer,
      sourceStage: record.retainedThermoBufferSourceStage || 'worker-retained-lane',
      thermoBufferByteLength: record.retainedThermoBufferByteLength || data?.sphParticleState?.thermo?.byteLength || null,
      seededFromCpu: record.retainedThermoBufferSeededFromCpu === true
    };
  }
  const uploadedThermoBuffer = data?.sphParticleUpload?.status === 'webgpu-uploaded'
    ? data.sphParticleUpload.thermoBuffer
    : null;
  if (uploadedThermoBuffer) {
    record.retainedThermoBuffer = uploadedThermoBuffer;
    record.retainedThermoBufferByteLength = data?.sphParticleState?.thermo?.byteLength || 0;
    record.retainedThermoBufferSourceStage = 'input-upload';
    record.retainedThermoBufferSeededFromCpu = false;
    return {
      status: 'worker-retained-thermo-ready',
      thermoBuffer: record.retainedThermoBuffer,
      sourceStage: record.retainedThermoBufferSourceStage,
      thermoBufferByteLength: record.retainedThermoBufferByteLength || null,
      seededFromCpu: false
    };
  }
  const device = workerDeviceResult?.device || data?.deviceResult?.device || null;
  const thermo = data?.sphParticleState?.thermo;
  const thermoBuffer = writeWorkerStorageBuffer(
    device,
    'ulg-worker-retained-sph-thermo-seed',
    thermo
  );
  if (!thermoBuffer) {
    return {
      status: 'blocked-worker-retained-thermo-input-missing',
      thermoBuffer: null,
      sourceStage: null,
      thermoBufferByteLength: thermo?.byteLength || null,
      seededFromCpu: false
    };
  }
  record.retainedThermoBuffer = thermoBuffer;
  record.retainedThermoBufferByteLength = thermo?.byteLength || 0;
  record.retainedThermoBufferSourceStage = 'cpu-seed';
  record.retainedThermoBufferSeededFromCpu = true;
  return {
    status: 'worker-retained-thermo-ready',
    thermoBuffer: record.retainedThermoBuffer,
    sourceStage: record.retainedThermoBufferSourceStage,
    thermoBufferByteLength: record.retainedThermoBufferByteLength || null,
    seededFromCpu: true
  };
}

function applyWorkerRetainedThermoInput({ stageId, data, record, workerDeviceResult }) {
  if (data?.preferWebGpu !== true || !stageUsesSphThermo(stageId)) return null;
  const thermo = ensureWorkerRetainedThermoBuffer({ data, record, workerDeviceResult });
  if (!thermo.thermoBuffer) {
    return {
      status: thermo.status,
      applied: false,
      stageId,
      thermoBufferByteLength: thermo.thermoBufferByteLength,
      seededFromCpu: false
    };
  }
  data.sphParticleUpload = {
    ...(data.sphParticleUpload || {}),
    schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetainedThermo: true,
    thermoBuffer: thermo.thermoBuffer
  };
  return {
    status: 'applied-worker-retained-thermo-input',
    applied: true,
    stageId,
    sourceStage: thermo.sourceStage,
    thermoBufferByteLength: thermo.thermoBufferByteLength,
    seededFromCpu: thermo.seededFromCpu
  };
}

function recordWorkerRetainedThermoOutput({ stageId, rawResult, record }) {
  const source = rawResult?.gpuResult || rawResult;
  if (!source?.thermoBuffer) return null;
  record.retainedThermoBuffer = source.thermoBuffer;
  record.retainedThermoBufferByteLength = source.thermoBufferByteLength || record.retainedThermoBufferByteLength || 0;
  record.retainedThermoBufferSourceStage = stageId;
  record.retainedThermoBufferSeededFromCpu = false;
  return {
    status: 'adopted-worker-retained-thermo-output',
    stageId,
    thermoBufferByteLength: record.retainedThermoBufferByteLength || null,
    seededFromCpu: false
  };
}

function applyWorkerRetainedContinuationInput({ stageId, data, record, workerDeviceResult }) {
  const requested = data?.useWorkerRetainedG2pInput === true;
  if (!requested || stageId !== 'p2g') return null;
  const source = retainedG2pOutput(record);
  if (!source) {
    return {
      status: 'blocked-worker-retained-g2p-input-missing',
      requested: true,
      sourceStage: 'g2p'
    };
  }
  const thermo = ensureWorkerRetainedThermoBuffer({ data, record, workerDeviceResult });
  if (!thermo.thermoBuffer) {
    return {
      status: 'blocked-worker-retained-thermo-upload-missing',
      requested: true,
      sourceStage: 'g2p',
      thermoInputStatus: thermo.status
    };
  }
  data.sphParticleUpload = {
    ...(data.sphParticleUpload || {}),
    schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'g2p',
    particleCount: data?.sphParticleState?.particleCount ?? source.particleCount ?? null,
    stateBuffer: source.stateBuffer,
    thermoBuffer: record.retainedThermoBuffer
  };
  data.mlsMpmParticleUpload = {
    schema: 'peercompute.ulg.worker-retained-mls-mpm-particle-upload.v0',
    status: 'webgpu-uploaded',
    workerRetained: true,
    sourceStage: 'g2p',
    particleCount: data?.mlsMpmParticleState?.particleCount ?? data?.sphParticleState?.particleCount ?? null,
    mechanicsBuffer: source.mechanicsBuffer
  };
  return {
    status: 'applied-worker-retained-g2p-input',
    requested: true,
    sourceStage: 'g2p',
    stateBufferByteLength: source.stateBufferByteLength ?? null,
    mechanicsBufferByteLength: source.mechanicsBufferByteLength ?? null,
    thermoBufferRetained: true,
    thermoBufferSourceStage: thermo.sourceStage,
    thermoBufferSeededFromCpu: thermo.seededFromCpu
  };
}

async function completeWorkerQueueFence({ stageId, data, rawResult, workerDeviceResult }) {
  const shouldFence = data?.preferWebGpu === true
    && data?.readbackMode === NO_FULL_READBACK_MODE
    && rawResult?.backend === 'webgpu';
  if (!shouldFence) return null;
  const queue = workerDeviceResult?.device?.queue || data?.deviceResult?.device?.queue || null;
  if (typeof queue?.onSubmittedWorkDone !== 'function') {
    return {
      status: 'worker-queue-fence-unavailable',
      fenceSatisfied: false,
      reason: 'worker-webgpu-device-queue-missing',
      method: null
    };
  }
  await queue.onSubmittedWorkDone();
  const fencePatch = {
    schema: rawResult?.gpuFence?.schema || rawResult?.gpuFenceReport?.schema || 'peercompute.compute.gpu-fence-report.v0',
    required: rawResult?.gpuFence?.required === true || rawResult?.gpuFenceReport?.required === true,
    fenceSatisfied: true,
    status: 'gpu-fence-satisfied',
    reason: `${stageId}-worker-queue-completion-evidenced`,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'worker-device.queue.onSubmittedWorkDone',
    source: 'ulg-mechanics-resident-stage-worker'
  };
  rawResult.queueCompletionStatus = fencePatch.queueCompletionStatus;
  rawResult.queueCompletionMethod = fencePatch.queueCompletionMethod;
  rawResult.gpuFence = {
    ...(rawResult.gpuFence || rawResult.gpuFenceReport || {}),
    ...fencePatch
  };
  rawResult.gpuFenceReport = {
    ...(rawResult.gpuFenceReport || rawResult.gpuFence || {}),
    ...fencePatch
  };
  return fencePatch;
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
      : (stageId === 'thermalPhase'
        ? ['sph-state-buffer', 'sph-thermo-buffer']
        : (stageId === 'reactionProduct'
          ? ['sph-state-buffer', 'sph-thermo-buffer', 'mls-mpm-mechanics-buffer', 'resident-product-mass-buffer']
          : ['sph-state-buffer', 'mls-mpm-mechanics-buffer'])));
  return {
    ...common,
    ...(context.stageOptions?.[stageId] || {}),
    preferWebGpu: context.preferWebGpu === true || common.preferWebGpu === true,
    readbackMode: context.readbackMode || common.readbackMode || 'full-parity-readback',
    useWorkerRetainedG2pInput: context.useWorkerRetainedG2pInput === true
      || context.useRetainedG2pAsInput === true
      || common.useWorkerRetainedG2pInput === true,
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
  if (stageId === 'thermalPhase') {
    const g2pOutput = retainedG2pOutput(record);
    const retainedThermoBuffer = record.retainedThermoBuffer || data?.sourceThermoBuffer || data?.sphParticleUpload?.thermoBuffer || null;
    data.sourceStateBuffer = data.sourceStateBuffer || g2pOutput?.stateBuffer || data?.sphParticleUpload?.stateBuffer || null;
    data.sourceThermoBuffer = retainedThermoBuffer;
    if (data.sourceStateBuffer || retainedThermoBuffer) {
      data.sphParticleUpload = {
        ...(data.sphParticleUpload || {}),
        schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
        status: 'webgpu-uploaded',
        workerRetained: true,
        sourceStage: data.sourceStateBuffer === g2pOutput?.stateBuffer ? 'g2p' : (data.sphParticleUpload?.sourceStage || 'thermal-phase-input'),
        stateBuffer: data.sourceStateBuffer || data.sphParticleUpload?.stateBuffer || null,
        thermoBuffer: retainedThermoBuffer || data.sphParticleUpload?.thermoBuffer || null
      };
    }
  }
  if (stageId === 'reactionProduct') {
    const g2pOutput = retainedG2pOutput(record);
    const thermalOutput = retainedThermalOutput(record);
    const retainedThermoBuffer = thermalOutput?.thermoBuffer
      || record.retainedThermoBuffer
      || data?.sourceThermoBuffer
      || data?.sphParticleUpload?.thermoBuffer
      || null;
    data.sourceStateBuffer = data.sourceStateBuffer
      || thermalOutput?.stateBuffer
      || g2pOutput?.stateBuffer
      || data?.sphParticleUpload?.stateBuffer
      || null;
    data.sourceThermoBuffer = retainedThermoBuffer;
    data.sourceMechanicsBuffer = data.sourceMechanicsBuffer
      || g2pOutput?.mechanicsBuffer
      || data?.mlsMpmParticleUpload?.mechanicsBuffer
      || null;
    if (data.reactionStepOptions && typeof data.reactionStepOptions === 'object') {
      Object.assign(data, data.reactionStepOptions);
    }
    if (data.sourceStateBuffer || retainedThermoBuffer) {
      data.sphParticleUpload = {
        ...(data.sphParticleUpload || {}),
        schema: data.sphParticleUpload?.schema || 'peercompute.ulg.worker-retained-sph-particle-upload.v0',
        status: 'webgpu-uploaded',
        workerRetained: true,
        sourceStage: thermalOutput?.stateBuffer ? 'thermalPhase' : (data.sphParticleUpload?.sourceStage || 'g2p'),
        stateBuffer: data.sourceStateBuffer || data.sphParticleUpload?.stateBuffer || null,
        thermoBuffer: retainedThermoBuffer || data.sphParticleUpload?.thermoBuffer || null
      };
    }
    if (data.sourceMechanicsBuffer) {
      data.mlsMpmParticleUpload = {
        ...(data.mlsMpmParticleUpload || {}),
        schema: data.mlsMpmParticleUpload?.schema || 'peercompute.ulg.worker-retained-mls-mpm-particle-upload.v0',
        status: 'webgpu-uploaded',
        workerRetained: true,
        sourceStage: 'g2p',
        mechanicsBuffer: data.sourceMechanicsBuffer
      };
    }
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
  const workerRetainedContinuationInput = applyWorkerRetainedContinuationInput({
    stageId,
    data,
    record,
    workerDeviceResult
  });
  const workerRetainedThermoInput = applyWorkerRetainedThermoInput({
    stageId,
    data,
    record,
    workerDeviceResult
  });
  const rawResult = await runner(data);
  const workerQueueFence = await completeWorkerQueueFence({
    stageId,
    data,
    rawResult,
    workerDeviceResult
  });
  const workerRetainedThermoOutput = recordWorkerRetainedThermoOutput({
    stageId,
    rawResult,
    record
  });
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
    workerQueueFence,
    workerQueueFenceSatisfied: workerQueueFence?.fenceSatisfied === true,
    workerRetainedContinuationInput,
    workerRetainedContinuationInputStatus: workerRetainedContinuationInput?.status || null,
    workerRetainedThermoInput,
    workerRetainedThermoInputStatus: workerRetainedThermoInput?.status || null,
    workerRetainedThermoOutput,
    workerRetainedThermoOutputStatus: workerRetainedThermoOutput?.status || null,
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
      workerQueueFenceSatisfied: cloneableResult.workerResidentStage.workerQueueFenceSatisfied,
      workerRetainedContinuationInputStatus: cloneableResult.workerResidentStage.workerRetainedContinuationInputStatus,
      workerRetainedThermoInputStatus: cloneableResult.workerResidentStage.workerRetainedThermoInputStatus,
      workerRetainedThermoOutputStatus: cloneableResult.workerResidentStage.workerRetainedThermoOutputStatus,
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
