import {
  CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_OP_IDS,
  CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_STATUS_IDS,
  CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT,
  CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT,
  ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  createClosureLawGraphBuffers,
  createClosureLawGraphStatusBuffer
} from '../../ulg-gpu-abi/src/index.js';
import { closureLawGraphEvalWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import { requestOpticalGpuDevice } from './material/opticalGpuBuffers.js';
import { computeBufferBinding, createExplicitComputePipeline } from './webgpuComputeLayout.js';
import { normalizeClosureTableSamples } from './closureHandle.js';

export {
  ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  closureLawGraphEvalWgsl
};

const NODE_FLOATS = CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT.length;
const SLOT_FLOATS = CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT.length;
const STATUS_FLOATS = CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT.length;
const SAMPLE_FLOATS = CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length;

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function graphIndex(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return number;
}

function derivativeAtSample(samples, index) {
  if (samples[index].derivative != null) return finiteNumber(samples[index].derivative, `samples[${index}].derivative`);
  const left = samples[Math.max(0, index - 1)];
  const right = samples[Math.min(samples.length - 1, index + 1)];
  if (right.axis === left.axis) return 0;
  return (right.value - left.value) / (right.axis - left.axis);
}

function tableForClosureArtifact(closureArtifact) {
  if (closureArtifact?.execution?.mode !== 'table-interpolation') {
    throw new Error(`Flat closure-law graph currently supports table-interpolation, got ${closureArtifact?.execution?.mode || 'missing'}`);
  }
  const table = closureArtifact.execution.table || closureArtifact.table;
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new Error('table-interpolation closure missing execution.table');
  }
  return table;
}

function normalizeGraphSamples(closureArtifact) {
  const table = tableForClosureArtifact(closureArtifact);
  const normalized = normalizeClosureTableSamples(table, { sort: false });
  if (normalized.samples.length < 2) {
    throw new Error('flat closure-law graph requires at least two table samples');
  }
  for (let index = 1; index < normalized.samples.length; index += 1) {
    if (!(normalized.samples[index].axis > normalized.samples[index - 1].axis)) {
      throw new Error('flat closure-law graph requires strictly increasing table axes');
    }
  }
  const samples = normalized.samples.map((sample, index) => ({
    axis: finiteNumber(sample.axis, `samples[${index}].axis`),
    value: finiteNumber(sample.value, `samples[${index}].value`),
    derivative: derivativeAtSample(normalized.samples, index)
  }));
  return {
    ...normalized,
    samples
  };
}

export function compileClosureLawGraphFromTableClosure(closureArtifact, {
  graphId = `${closureArtifact?.closureId || 'closure'}:flat-law-graph`,
  inputSlot = 0,
  outputSlot = 1,
  derivativeSlot = 2,
  initialInputs = {},
  materialId = 0,
  phaseId = 0,
  provenanceIndex = 0
} = {}) {
  const resolvedInputSlot = graphIndex(inputSlot, 'inputSlot');
  const resolvedOutputSlot = graphIndex(outputSlot, 'outputSlot');
  const resolvedDerivativeSlot = graphIndex(derivativeSlot, 'derivativeSlot');
  const { axisName, outputName, derivativeName, samples } = normalizeGraphSamples(closureArtifact);
  const slotCount = Math.max(resolvedInputSlot, resolvedOutputSlot, resolvedDerivativeSlot) + 1;
  const nodes = [{
    op: 'tableLinear',
    inputSlot: resolvedInputSlot,
    outputSlot: resolvedOutputSlot,
    derivativeSlot: resolvedDerivativeSlot,
    sampleOffset: 0,
    sampleCount: samples.length,
    domainMin: samples[0].axis,
    domainMax: samples[samples.length - 1].axis,
    interpolation: 'linear',
    statusFlagId: 0,
    provenanceIndex,
    materialId,
    phaseId
  }];
  const graph = createClosureLawGraphBuffers({
    graphId,
    nodes,
    edges: [],
    samples,
    slotCount,
    initialSlots: initialInputs,
    statusCount: nodes.length
  });
  return {
    ...graph,
    sourceClosureId: closureArtifact.closureId || null,
    sourceClosureKind: closureArtifact.closureKind || null,
    axisName,
    outputName,
    derivativeName,
    compilerBackend: 'cpu-reference',
    compilerStatus: 'cpu-validated-flat-closure-law-graph',
    provenance: closureArtifact.provenance || null,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function assertClosureLawGraph(graph) {
  if (graph?.schema !== ULG_CLOSURE_LAW_GRAPH_SCHEMA) {
    throw new TypeError('Expected a flat closure-law graph');
  }
  if (!(graph.nodeRows instanceof Float32Array) || graph.nodeRows.length !== graph.nodeCount * NODE_FLOATS) {
    throw new TypeError('Closure-law graph node rows are missing or malformed');
  }
  if (!(graph.sampleRows instanceof Float32Array) || graph.sampleRows.length !== graph.sampleCount * SAMPLE_FLOATS) {
    throw new TypeError('Closure-law graph sample rows are missing or malformed');
  }
  if (!(graph.slotRows instanceof Float32Array) || graph.slotRows.length !== graph.slotCount * SLOT_FLOATS) {
    throw new TypeError('Closure-law graph slot rows are missing or malformed');
  }
}

function setStatus(statusRows, nodeIndex, status, observedInput = 0, limit = 0) {
  const offset = nodeIndex * STATUS_FLOATS;
  statusRows[offset] = nodeIndex;
  statusRows[offset + 1] = status;
  statusRows[offset + 2] = observedInput;
  statusRows[offset + 3] = limit;
}

function applyInputs(slotRows, inputs = {}) {
  for (const [slotKey, value] of Object.entries(inputs || {})) {
    const slot = graphIndex(slotKey, `inputs.${slotKey}`);
    const offset = slot * SLOT_FLOATS;
    if (offset + SLOT_FLOATS > slotRows.length) {
      throw new RangeError(`input slot ${slot} is outside graph slot rows`);
    }
    if (typeof value === 'number') {
      slotRows[offset] = finiteNumber(value, `inputs.${slotKey}`);
      slotRows[offset + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.ok;
    } else if (value && typeof value === 'object') {
      slotRows[offset] = finiteNumber(value.value ?? 0, `inputs.${slotKey}.value`);
      slotRows[offset + 1] = finiteNumber(value.derivative ?? 0, `inputs.${slotKey}.derivative`);
      slotRows[offset + 2] = finiteNumber(value.status ?? CLOSURE_LAW_GRAPH_STATUS_IDS.ok, `inputs.${slotKey}.status`);
    }
  }
}

function tableLinear(sampleRows, sampleOffset, sampleCount, x) {
  const start = sampleOffset * SAMPLE_FLOATS;
  let leftIndex = sampleOffset;
  let rightIndex = sampleOffset + sampleCount - 1;
  for (let index = sampleOffset; index + 1 < sampleOffset + sampleCount; index += 1) {
    const leftAxis = sampleRows[index * SAMPLE_FLOATS];
    const rightAxis = sampleRows[(index + 1) * SAMPLE_FLOATS];
    if (x >= leftAxis && x <= rightAxis) {
      leftIndex = index;
      rightIndex = index + 1;
      break;
    }
  }
  const leftOffset = leftIndex * SAMPLE_FLOATS;
  const rightOffset = rightIndex * SAMPLE_FLOATS;
  const leftAxis = sampleRows[leftOffset];
  const rightAxis = sampleRows[rightOffset];
  const leftValue = sampleRows[leftOffset + 1];
  const rightValue = sampleRows[rightOffset + 1];
  const leftDerivative = sampleRows[leftOffset + 2];
  const rightDerivative = sampleRows[rightOffset + 2];
  const t = rightAxis === leftAxis ? 0 : (x - leftAxis) / (rightAxis - leftAxis);
  return {
    value: leftValue + t * (rightValue - leftValue),
    derivative: leftDerivative + t * (rightDerivative - leftDerivative),
    sampleStart: start
  };
}

function tableStep(sampleRows, sampleOffset, sampleCount, x) {
  let selectedIndex = sampleOffset;
  for (let index = sampleOffset; index < sampleOffset + sampleCount; index += 1) {
    const axis = sampleRows[index * SAMPLE_FLOATS];
    if (x >= axis) {
      selectedIndex = index;
    } else {
      break;
    }
  }
  const selectedOffset = selectedIndex * SAMPLE_FLOATS;
  return {
    value: sampleRows[selectedOffset + 1],
    derivative: 0,
    sampleStart: sampleOffset * SAMPLE_FLOATS
  };
}

function decodeSlots(slotRows) {
  const slots = [];
  for (let slot = 0; slot < slotRows.length / SLOT_FLOATS; slot += 1) {
    const offset = slot * SLOT_FLOATS;
    slots.push({
      value: slotRows[offset],
      derivative: slotRows[offset + 1],
      status: slotRows[offset + 2]
    });
  }
  return slots;
}

function graphStatusFromRows(statusRows) {
  for (let index = 0; index < statusRows.length / STATUS_FLOATS; index += 1) {
    const status = statusRows[index * STATUS_FLOATS + 1];
    if (status === CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainLow || status === CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainHigh) {
      return 'closure-law-graph-domain-exit';
    }
    if (status === CLOSURE_LAW_GRAPH_STATUS_IDS.unsupportedOperation) {
      return 'closure-law-graph-unsupported-operation';
    }
  }
  return 'closure-law-graph-evaluated';
}

export function evaluateClosureLawGraphCpu(graph, { inputs = {}, slotRows = null } = {}) {
  assertClosureLawGraph(graph);
  const slots = slotRows instanceof Float32Array
    ? new Float32Array(slotRows)
    : new Float32Array(graph.slotRows);
  const statuses = createClosureLawGraphStatusBuffer(graph.statusCount);
  applyInputs(slots, inputs);
  for (let nodeIndex = 0; nodeIndex < graph.nodeCount; nodeIndex += 1) {
    const nodeOffset = nodeIndex * NODE_FLOATS;
    const opId = graph.nodeRows[nodeOffset];
    const inputSlot = graphIndex(graph.nodeRows[nodeOffset + 1], `node[${nodeIndex}].inputSlot`);
    const outputSlot = graphIndex(graph.nodeRows[nodeOffset + 2], `node[${nodeIndex}].outputSlot`);
    const derivativeSlot = graphIndex(graph.nodeRows[nodeOffset + 3], `node[${nodeIndex}].derivativeSlot`);
    const sampleOffset = graphIndex(graph.nodeRows[nodeOffset + 4], `node[${nodeIndex}].sampleOffset`);
    const sampleCount = graphIndex(graph.nodeRows[nodeOffset + 5], `node[${nodeIndex}].sampleCount`);
    const domainMin = graph.nodeRows[nodeOffset + 6];
    const domainMax = graph.nodeRows[nodeOffset + 7];
    const inputValue = slots[inputSlot * SLOT_FLOATS];
    if (opId !== CLOSURE_LAW_GRAPH_OP_IDS.tableLinear && opId !== CLOSURE_LAW_GRAPH_OP_IDS.tableStep) {
      setStatus(statuses, nodeIndex, CLOSURE_LAW_GRAPH_STATUS_IDS.unsupportedOperation, opId, 0);
      continue;
    }
    if (opId === CLOSURE_LAW_GRAPH_OP_IDS.tableLinear && sampleCount < 2) {
      setStatus(statuses, nodeIndex, CLOSURE_LAW_GRAPH_STATUS_IDS.unsupportedOperation, sampleCount, 2);
      continue;
    }
    if (opId === CLOSURE_LAW_GRAPH_OP_IDS.tableStep && sampleCount < 1) {
      setStatus(statuses, nodeIndex, CLOSURE_LAW_GRAPH_STATUS_IDS.unsupportedOperation, sampleCount, 1);
      continue;
    }
    if (inputValue < domainMin) {
      setStatus(statuses, nodeIndex, CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainLow, inputValue, domainMin);
      slots[outputSlot * SLOT_FLOATS + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainLow;
      slots[derivativeSlot * SLOT_FLOATS + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainLow;
      continue;
    }
    if (inputValue > domainMax) {
      setStatus(statuses, nodeIndex, CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainHigh, inputValue, domainMax);
      slots[outputSlot * SLOT_FLOATS + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainHigh;
      slots[derivativeSlot * SLOT_FLOATS + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.outOfDomainHigh;
      continue;
    }
    const sampled = opId === CLOSURE_LAW_GRAPH_OP_IDS.tableStep
      ? tableStep(graph.sampleRows, sampleOffset, sampleCount, inputValue)
      : tableLinear(graph.sampleRows, sampleOffset, sampleCount, inputValue);
    const outputOffset = outputSlot * SLOT_FLOATS;
    const derivativeOffset = derivativeSlot * SLOT_FLOATS;
    slots[outputOffset] = sampled.value;
    slots[outputOffset + 1] = sampled.derivative;
    slots[outputOffset + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.ok;
    slots[derivativeOffset] = sampled.derivative;
    slots[derivativeOffset + 2] = CLOSURE_LAW_GRAPH_STATUS_IDS.ok;
    setStatus(statuses, nodeIndex, CLOSURE_LAW_GRAPH_STATUS_IDS.ok, inputValue, 0);
  }
  const status = graphStatusFromRows(statuses);
  return {
    schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
    graphSchema: graph.schema,
    backend: 'cpu-reference',
    status,
    graphId: graph.graphId,
    nodeCount: graph.nodeCount,
    slotCount: graph.slotCount,
    statusCount: graph.statusCount,
    slotRows: slots,
    statusRows: statuses,
    slots: decodeSlots(slots),
    closureRefreshRecommended: status === 'closure-law-graph-domain-exit',
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const size = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) {
    device.queue.writeBuffer(buffer, 0, data);
  }
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label) {
  const readback = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, Math.max(4, byteLength));
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

function createParamsArray({ nodeCount, slotCount, sampleCount, statusCount }) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, nodeCount, true);
  view.setUint32(4, slotCount, true);
  view.setUint32(8, sampleCount, true);
  view.setUint32(12, statusCount, true);
  return buffer;
}

export async function runClosureLawGraphWebGpu({ device, graph, inputs = {}, slotRows = null } = {}) {
  assertClosureLawGraph(graph);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runClosureLawGraphWebGpu requires a WebGPU-like device');
  }
  const initialSlots = slotRows instanceof Float32Array
    ? new Float32Array(slotRows)
    : new Float32Array(graph.slotRows);
  applyInputs(initialSlots, inputs);
  const initialStatuses = createClosureLawGraphStatusBuffer(graph.statusCount);
  const nodeBuffer = writeStorageBuffer(device, 'ulg-closure-law-graph-nodes', graph.nodeRows);
  const edgeBuffer = writeStorageBuffer(device, 'ulg-closure-law-graph-edges', graph.edgeRows || new Float32Array());
  const sampleBuffer = writeStorageBuffer(device, 'ulg-closure-law-graph-samples', graph.sampleRows);
  const slotBuffer = writeStorageBuffer(device, 'ulg-closure-law-graph-slots', initialSlots, GPU_BUFFER_USAGE.COPY_SRC);
  const statusBuffer = writeStorageBuffer(device, 'ulg-closure-law-graph-status', initialStatuses, GPU_BUFFER_USAGE.COPY_SRC);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-closure-law-graph-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
      nodeCount: graph.nodeCount,
      slotCount: graph.slotCount,
      sampleCount: graph.sampleCount,
      statusCount: graph.statusCount
    }));
    const module = device.createShaderModule({ label: 'ulg-closure-law-graph-eval', code: closureLawGraphEvalWgsl });
    const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
      label: 'ulg-closure-law-graph-eval',
      module,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'uniform')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: nodeBuffer } },
        { binding: 1, resource: { buffer: edgeBuffer } },
        { binding: 2, resource: { buffer: sampleBuffer } },
        { binding: 3, resource: { buffer: slotBuffer } },
        { binding: 4, resource: { buffer: statusBuffer } },
        { binding: 5, resource: { buffer: paramsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    device.queue.submit([encoder.finish()]);
    const [slotBytes, statusBytes] = await Promise.all([
      readBuffer(device, slotBuffer, graph.slotCount * SLOT_FLOATS * Float32Array.BYTES_PER_ELEMENT, 'ulg-closure-law-graph-slots-readback'),
      readBuffer(device, statusBuffer, graph.statusCount * STATUS_FLOATS * Float32Array.BYTES_PER_ELEMENT, 'ulg-closure-law-graph-status-readback')
    ]);
    const outputSlots = new Float32Array(slotBytes);
    const outputStatuses = new Float32Array(statusBytes);
    const status = graphStatusFromRows(outputStatuses);
    return {
      schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
      graphSchema: graph.schema,
      backend: 'webgpu',
      status,
      graphId: graph.graphId,
      nodeCount: graph.nodeCount,
      slotCount: graph.slotCount,
      statusCount: graph.statusCount,
      slotRows: outputSlots,
      statusRows: outputStatuses,
      slots: decodeSlots(outputSlots),
      closureRefreshRecommended: status === 'closure-law-graph-domain-exit',
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  } finally {
    nodeBuffer.destroy?.();
    edgeBuffer.destroy?.();
    sampleBuffer.destroy?.();
    slotBuffer.destroy?.();
    statusBuffer.destroy?.();
    paramsBuffer.destroy?.();
  }
}

export function createClosureLawGraphParityReport({ cpuReference, gpuResult, tolerance = 1e-5 }) {
  let maxSlotAbs = 0;
  let maxStatusAbs = 0;
  const slotLength = Math.min(cpuReference.slotRows.length, gpuResult.slotRows.length);
  const statusLength = Math.min(cpuReference.statusRows.length, gpuResult.statusRows.length);
  for (let index = 0; index < slotLength; index += 1) {
    maxSlotAbs = Math.max(maxSlotAbs, Math.abs(cpuReference.slotRows[index] - gpuResult.slotRows[index]));
  }
  for (let index = 0; index < statusLength; index += 1) {
    maxStatusAbs = Math.max(maxStatusAbs, Math.abs(cpuReference.statusRows[index] - gpuResult.statusRows[index]));
  }
  const passed = cpuReference.status === gpuResult.status
    && cpuReference.slotRows.length === gpuResult.slotRows.length
    && cpuReference.statusRows.length === gpuResult.statusRows.length
    && maxSlotAbs <= tolerance
    && maxStatusAbs <= tolerance;
  return {
    schema: 'peercompute.ulg.closure-law-graph-parity.v0',
    status: passed ? 'pass' : 'fail',
    tolerance,
    maxSlotAbs,
    maxStatusAbs,
    cpuStatus: cpuReference.status,
    gpuStatus: gpuResult.status,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runClosureLawGraphWithOptionalWebGpu({
  graph,
  inputs = {},
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = runClosureLawGraphWebGpu,
  parityTolerance = 1e-5
} = {}) {
  const cpuReference = evaluateClosureLawGraphCpu(graph, { inputs });
  if (!preferWebGpu) {
    return {
      schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      result: cpuReference,
      cpuReference,
      webgpuStatus: { status: 'not-requested' },
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', reason: 'provided device', device }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      result: cpuReference,
      cpuReference,
      webgpuStatus: {
        status: resolvedDeviceResult?.status || 'blocked-webgpu-unavailable',
        reason: resolvedDeviceResult?.reason || 'WebGPU unavailable',
        fallback: 'cpu-reference'
      },
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ device: resolvedDeviceResult.device, graph, inputs });
    const webgpuParity = createClosureLawGraphParityReport({
      cpuReference,
      gpuResult: webgpu,
      tolerance: parityTolerance
    });
    if (webgpuParity.status !== 'pass') {
      return {
        schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
        backend: 'cpu-reference',
        status: 'webgpu-parity-failed-cpu-reference',
        result: cpuReference,
        cpuReference,
        webgpu,
        webgpuParity,
        webgpuStatus: {
          status: 'webgpu-parity-failed',
          fallback: 'cpu-reference'
        },
        scientificValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted',
      result: webgpu,
      cpuReference,
      webgpu,
      webgpuParity,
      webgpuStatus: { status: 'webgpu-executed' },
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      result: cpuReference,
      cpuReference,
      webgpuStatus: {
        status: 'webgpu-error-fallback',
        reason: error instanceof Error ? error.message : String(error),
        fallback: 'cpu-reference'
      },
      scientificValidation: false,
      fullPhysicsValidation: false
    };
  }
}
