import {
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphPressureInterfaceForceRowsWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';

export const SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS = SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length;
export const SPH_PRESSURE_INTERFACE_FORCE_FLOATS = SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length;
export const SPH_GAS_PRESSURE_CELL_FLOATS = 12;

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA = 'peercompute.ulg.sph-local-pressure-gradient-field.v0';
const UNIFORM_GAS_PRESSURE_FIELD_MODE = 'uniform-single-cell-sealed-gas';
const UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION = 'lumped-sealed-box';
const LOCAL_GAS_CELL_PRESSURE_FIELD_MODE = 'local-gas-cell-pressure-gradient';
const LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION = 'structured-gas-cell-grid';
const LOCAL_PRESSURE_GRADIENT_BLOCKERS = Object.freeze([
  'single-cell-uniform-pressure-field',
  'resident-gas-cell-eos-gradient-not-derived'
]);

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

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function vectorMagnitude3(value = [0, 0, 0]) {
  return Math.hypot(
    finiteNumber(value[0], 0),
    finiteNumber(value[1], 0),
    finiteNumber(value[2], 0)
  );
}

function cleanVector3(value = [0, 0, 0]) {
  return [
    Math.abs(finiteNumber(value[0], 0)) < 1e-12 ? 0 : finiteNumber(value[0], 0),
    Math.abs(finiteNumber(value[1], 0)) < 1e-12 ? 0 : finiteNumber(value[1], 0),
    Math.abs(finiteNumber(value[2], 0)) < 1e-12 ? 0 : finiteNumber(value[2], 0)
  ];
}

function addVector3(a = [0, 0, 0], b = [0, 0, 0]) {
  return [
    finiteNumber(a[0], 0) + finiteNumber(b[0], 0),
    finiteNumber(a[1], 0) + finiteNumber(b[1], 0),
    finiteNumber(a[2], 0) + finiteNumber(b[2], 0)
  ];
}

function vector3From(value = null, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((index) => {
    const number = Number(Array.isArray(value) ? value[index] : undefined);
    return Number.isFinite(number) ? number : fallback[index];
  });
}

function gasPressureFieldResolutionDiagnostics(gasCellField = null) {
  const unavailable = !gasCellField || gasCellField.status === 'gas-cell-pressure-field-unavailable';
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true;
  const blockers = Array.isArray(gasCellField?.localPressureGradientBlockers)
    ? [...gasCellField.localPressureGradientBlockers]
    : (localPressureGradientReady ? [] : [...LOCAL_PRESSURE_GRADIENT_BLOCKERS]);
  return {
    pressureFieldMode: gasCellField?.pressureFieldMode || (
      localPressureGradientReady
        ? LOCAL_GAS_CELL_PRESSURE_FIELD_MODE
        : (unavailable ? 'pressure-field-unavailable' : UNIFORM_GAS_PRESSURE_FIELD_MODE)
    ),
    pressureFieldResolution: gasCellField?.pressureFieldResolution || (
      localPressureGradientReady
        ? LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION
        : (unavailable ? 'pressure-field-unavailable' : UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION)
    ),
    pressureGradientStatus: gasCellField?.gradientStatus || (
      localPressureGradientReady
        ? 'local-pressure-gradient-field-ready'
        : (unavailable ? 'pressure-field-unavailable' : 'uniform-sealed-gas-pressure-zero-gradient')
    ),
    localPressureGradientSchema: gasCellField?.localPressureGradientSchema || ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
    localPressureGradientReady,
    localPressureGradientStatus: gasCellField?.localPressureGradientStatus || (
      localPressureGradientReady
        ? 'local-pressure-gradient-field-ready'
        : (unavailable
            ? 'blocked-pressure-field-unavailable'
            : 'blocked-uniform-single-cell-field-has-no-local-gradient')
    ),
    localPressureGradientBlockers: blockers,
    localPressureGradientForceCouplingStatus: localPressureGradientReady
      ? 'local-pressure-gradient-force-coupling-ready'
      : 'blocked-local-pressure-gradient-field-required',
    localPressureGradientValidation: gasCellField?.localPressureGradientValidation === true
  };
}

function normalizedGasPressureCells(gasCellField = null) {
  if (gasCellField?.localPressureGradientReady !== true || !Array.isArray(gasCellField?.cells)) return [];
  const cells = [];
  for (const [index, cell] of gasCellField.cells.entries()) {
    const pressurePa = finiteNumber(cell?.pressurePa, Number.NaN);
    if (!Number.isFinite(pressurePa) || pressurePa < 0) continue;
    cells.push({
      index: finiteNumber(cell?.index, index),
      gridIndex: Array.isArray(cell?.gridIndex)
        ? cell.gridIndex.map((value) => Math.max(0, Math.round(finiteNumber(value, 0)))).slice(0, 3)
        : [index, 0, 0],
      centerM: vector3From(cell?.centerM ?? cell?.centroidM),
      pressurePa,
      pressureGradientPaPerM: vector3From(cell?.pressureGradientPaPerM ?? cell?.gradientPaPerM),
      volumeM3: finiteNumber(cell?.volumeM3, 0),
      status: cell?.status || 'local-gas-pressure-cell-ready'
    });
  }
  return cells;
}

export function packGasPressureCellRows(gasCellField = null) {
  const cells = normalizedGasPressureCells(gasCellField);
  const rows = new Float32Array(cells.length * SPH_GAS_PRESSURE_CELL_FLOATS);
  for (const [index, cell] of cells.entries()) {
    const offset = index * SPH_GAS_PRESSURE_CELL_FLOATS;
    rows.set([
      finiteNumber(cell.gridIndex[0], 0),
      finiteNumber(cell.gridIndex[1], 0),
      finiteNumber(cell.gridIndex[2], 0),
      cell.status === 'local-gas-pressure-cell-ready' ? 1 : 0,
      cell.centerM[0],
      cell.centerM[1],
      cell.centerM[2],
      cell.pressurePa,
      cell.pressureGradientPaPerM[0],
      cell.pressureGradientPaPerM[1],
      cell.pressureGradientPaPerM[2],
      cell.volumeM3
    ], offset);
  }
  return {
    cells,
    rows,
    rowCount: cells.length,
    rowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
    rowByteLength: rows.byteLength
  };
}

function pressureForElementFromCells(element = {}, cells = [], fallbackPressurePa = 0) {
  if (!cells.length) return fallbackPressurePa;
  const centroid = vector3From(element.centroidM);
  let selected = null;
  let selectedDistance2 = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (cell.status !== 'local-gas-pressure-cell-ready') continue;
    const dx = centroid[0] - cell.centerM[0];
    const dy = centroid[1] - cell.centerM[1];
    const dz = centroid[2] - cell.centerM[2];
    const distance2 = dx * dx + dy * dy + dz * dz;
    if (distance2 < selectedDistance2) {
      selected = { cell, deltaM: [dx, dy, dz] };
      selectedDistance2 = distance2;
    }
  }
  if (!selected) return fallbackPressurePa;
  const gradient = selected.cell.pressureGradientPaPerM;
  return Math.max(
    0,
    selected.cell.pressurePa
      + gradient[0] * selected.deltaM[0]
      + gradient[1] * selected.deltaM[1]
      + gradient[2] * selected.deltaM[2]
  );
}

function normalAreaVectorForElement(element = {}) {
  if (Array.isArray(element.normalAreaVectorM2)) {
    return [
      finiteNumber(element.normalAreaVectorM2[0], 0),
      finiteNumber(element.normalAreaVectorM2[1], 0),
      finiteNumber(element.normalAreaVectorM2[2], 0)
    ];
  }
  if (Array.isArray(element.normal)) {
    const area = finiteNumber(element.areaM2, 0);
    return [
      finiteNumber(element.normal[0], 0) * area,
      finiteNumber(element.normal[1], 0) * area,
      finiteNumber(element.normal[2], 0) * area
    ];
  }
  return [0, 0, 0];
}

function readyInterfaceElements(materialInterfaceField = null) {
  return Array.isArray(materialInterfaceField?.elements)
    ? materialInterfaceField.elements.filter((element) => (
        element?.status === 'interface-element-ready'
        && finiteNumber(element.areaM2, 0) > 0
      ))
    : [];
}

export function packMaterialInterfaceElementRows(materialInterfaceField = null) {
  const elements = readyInterfaceElements(materialInterfaceField);
  const rows = new Float32Array(elements.length * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS);
  for (const [index, element] of elements.entries()) {
    const offset = index * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS;
    const centroid = Array.isArray(element.centroidM) ? element.centroidM : [0, 0, 0];
    const normal = Array.isArray(element.normal) ? element.normal : [0, 0, 0];
    const normalArea = normalAreaVectorForElement(element);
    rows.set([
      finiteNumber(element.surfaceIndex, 0),
      finiteNumber(element.materialId, 0),
      finiteNumber(element.phaseId, 0),
      finiteNumber(element.axisId, 0),
      finiteNumber(centroid[0], 0),
      finiteNumber(centroid[1], 0),
      finiteNumber(centroid[2], 0),
      finiteNumber(element.areaM2, 0),
      finiteNumber(normal[0], 0),
      finiteNumber(normal[1], 0),
      finiteNumber(normal[2], 0),
      normalArea[0],
      normalArea[1],
      normalArea[2],
      finiteNumber(element.crossingSign, 0),
      1
    ], offset);
  }
  return {
    elements,
    rows,
    rowCount: elements.length,
    rowStrideFloats: SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
    rowByteLength: rows.byteLength
  };
}

export function createPressureInterfaceParamsArray({
  elementCount = 0,
  pressurePa = 0,
  gasPressureCellCount = 0,
  pressureModelId = 0
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(elementCount, 0))), true);
  view.setFloat32(4, finiteNumber(pressurePa, 0), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(gasPressureCellCount, 0))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(pressureModelId, 0))), true);
  return buffer;
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data?.byteLength ?? 0);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data?.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function summarizeForceRowsFromElements(elements = [], pressurePa = 0, gasCellField = null) {
  const pressureCells = normalizedGasPressureCells(gasCellField);
  const forceRows = [];
  const forceBySurface = new Map();
  let netMaterialForceN = [0, 0, 0];
  let netGasReactionForceN = [0, 0, 0];
  let totalAbsMaterialForceN = 0;
  let maxPairResidualN = 0;
  let minInterfacePressurePa = Number.POSITIVE_INFINITY;
  let maxInterfacePressurePa = Number.NEGATIVE_INFINITY;
  for (const element of elements) {
    const interfacePressurePa = pressureForElementFromCells(element, pressureCells, pressurePa);
    minInterfacePressurePa = Math.min(minInterfacePressurePa, interfacePressurePa);
    maxInterfacePressurePa = Math.max(maxInterfacePressurePa, interfacePressurePa);
    const normalArea = normalAreaVectorForElement(element);
    const materialForceN = cleanVector3(normalArea.map((component) => -interfacePressurePa * component));
    const gasReactionForceN = cleanVector3(materialForceN.map((component) => -component));
    const pairResidualN = cleanVector3(addVector3(materialForceN, gasReactionForceN));
    maxPairResidualN = Math.max(maxPairResidualN, vectorMagnitude3(pairResidualN));
    netMaterialForceN = addVector3(netMaterialForceN, materialForceN);
    netGasReactionForceN = addVector3(netGasReactionForceN, gasReactionForceN);
    totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
    const row = {
      index: forceRows.length,
      surfaceIndex: finiteNumber(element.surfaceIndex, 0),
      surfaceKey: element.surfaceKey || `${element.materialId}|${element.phaseId}`,
      material: element.material ?? null,
      phase: element.phase ?? null,
      materialId: finiteNumber(element.materialId, 0),
      phaseId: finiteNumber(element.phaseId, 0),
      axisId: finiteNumber(element.axisId, 0),
      centroidM: Array.isArray(element.centroidM) ? [...element.centroidM] : [0, 0, 0],
      areaM2: finiteNumber(element.areaM2, 0),
      pressurePa: interfacePressurePa,
      materialForceN,
      gasReactionForceN,
      pairResidualN,
      status: 'pressure-interface-force-row-ready'
    };
    forceRows.push(row);
    const surface = forceBySurface.get(row.surfaceKey) || {
      surfaceKey: row.surfaceKey,
      material: row.material,
      phase: row.phase,
      forceRowCount: 0,
      areaM2: 0,
      netMaterialForceN: [0, 0, 0],
      netGasReactionForceN: [0, 0, 0],
      totalAbsMaterialForceN: 0
    };
    surface.forceRowCount += 1;
    surface.areaM2 += row.areaM2;
    surface.netMaterialForceN = addVector3(surface.netMaterialForceN, materialForceN);
    surface.netGasReactionForceN = addVector3(surface.netGasReactionForceN, gasReactionForceN);
    surface.totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
    forceBySurface.set(row.surfaceKey, surface);
  }
  netMaterialForceN = cleanVector3(netMaterialForceN);
  netGasReactionForceN = cleanVector3(netGasReactionForceN);
  const conservationResidualN = cleanVector3(addVector3(netMaterialForceN, netGasReactionForceN));
  const conservationResidualMagnitudeN = vectorMagnitude3(conservationResidualN);
  return {
    forceRows,
    surfaceForceCount: forceBySurface.size,
    surfaceForces: [...forceBySurface.values()],
    totalInterfaceAreaM2: elements.reduce((sum, element) => sum + finiteNumber(element.areaM2, 0), 0),
    totalAbsMaterialForceN,
    netMaterialForceN,
    netGasReactionForceN,
    conservationResidualN,
    conservationResidualMagnitudeN,
    maxPairResidualN,
    gasInterfacePressureRangePa: forceRows.length > 0
      ? [minInterfacePressurePa, maxInterfacePressurePa]
      : null
  };
}

export async function runSphPressureInterfaceForceRowsWebGpu({
  device,
  pressureFeedback = null,
  pressureInterfaceCoupling = null,
  pressureInterfaceForcePreview = null,
  materialInterfaceField = null,
  retainForceRowsBuffer = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceForceRowsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const pressurePa = finiteNumber(
    pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa,
    Number.NaN
  );
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const packed = packMaterialInterfaceElementRows(materialInterfaceField);
  const packedGasPressureCells = packGasPressureCellRows(pressureFeedback?.gasCellField || null);
  const pressureModelId = packedGasPressureCells.rowCount > 0 && pressureFieldResolution.localPressureGradientReady
    ? 1
    : 0;
  const canSolve = pressureInterfaceCoupling?.status === 'pressure-interface-coupling-ready-for-solver'
    && Number.isFinite(pressurePa)
    && pressurePa >= 0
    && packed.rowCount > 0;
  if (!canSolve) {
    return {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-blocked',
      reason: pressureInterfaceCoupling?.status || 'pressure-interface-coupling-not-ready',
      readbackMode,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
      pressureInterfaceForcePreview,
      forceRowCount: 0,
      forceRowByteLength: 0,
      forceRowValues: new Float32Array(0),
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-blocked',
        forceApplicationStatus: 'not-applied-solver-blocked',
        pressureInterfaceCouplingStatus: pressureInterfaceCoupling?.status || null,
        forceCouplingStatus: pressureInterfaceCoupling?.forceCouplingStatus || null,
        gasInterfacePressurePa: Number.isFinite(pressurePa) ? pressurePa : null,
        gasInterfacePressureRangePa: null,
        pressureFieldMode: pressureFieldResolution.pressureFieldMode,
        pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
        pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
        localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
        localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
        localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
        localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
        localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
        gasPressureCellRowCount: packedGasPressureCells.rowCount,
        gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
        pressureModelId,
        sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? 0,
        forceRowCount: 0,
        forceRowLayout: [...SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT],
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
        forceRowValues: new Float32Array(0),
        forceResolution: pressureModelId === 1 ? 'local-gradient-interface-traction' : 'uniform-interface-traction',
        localPressureGradientValidation: pressureModelId === 1,
        conservationStatus: 'not-evaluated'
      }
    };
  }

  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const outputByteLength = packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const inputBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-elements-in', packed.rows);
  const gasPressureCellsBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-gas-cells-in', packedGasPressureCells.rows);
  const forceRowsBuffer = device.createBuffer({
    label: 'ulg-sph-pressure-interface-force-rows-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-pressure-interface-force-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
        label: 'ulg-sph-pressure-interface-force-rows-readback',
        size: Math.max(4, outputByteLength),
        usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
      });
  let returnedRetainedForceRowsBuffer = false;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createPressureInterfaceParamsArray({
      elementCount: packed.rowCount,
      pressurePa,
      gasPressureCellCount: packedGasPressureCells.rowCount,
      pressureModelId
    }));
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-pressure-interface-force-rows.v1',
      label: 'ulg-sph-pressure-interface-force-rows',
      code: sphPressureInterfaceForceRowsWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform'),
        computeBufferBinding(3, 'read-only-storage')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: forceRowsBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: gasPressureCellsBuffer } }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(packed.rowCount / 64)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(forceRowsBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    }
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';

    let forceRowValues = new Float32Array(0);
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      forceRowValues = new Float32Array(readBuffer.getMappedRange()).slice(0, packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
      readBuffer.unmap();
    } else {
      queueCompletionStatus = device.queue?.onSubmittedWorkDone
        ? 'queue-submitted-cleanup-deferred'
        : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : null;
    }

    const summary = summarizeForceRowsFromElements(packed.elements, pressurePa, pressureFeedback?.gasCellField || null);
    const solver = {
      schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
      status: 'pressure-interface-force-solver-ready',
      backend: 'webgpu',
      forceApplicationStatus: 'solver-ready-not-applied',
      pressureInterfaceCouplingStatus: pressureInterfaceCoupling?.status || null,
      forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
      gasInterfacePressurePa: pressurePa,
      gasInterfacePressureRangePa: summary.gasInterfacePressureRangePa,
      pressureFieldMode: pressureFieldResolution.pressureFieldMode,
      pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
      pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
      localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
      localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
      localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
      localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
      localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
      gasPressureCellRowCount: packedGasPressureCells.rowCount,
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowsBufferRetained: packedGasPressureCells.rowCount > 0,
      pressureModelId,
      sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? packed.rowCount,
      forceRowCount: packed.rowCount,
      forceRowLayout: [...SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT],
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
      forceRows: noFullReadback ? [] : summary.forceRows,
      forceRowValues,
      forceRowsBufferRetained: retainForceRowsBuffer === true,
      surfaceForceCount: summary.surfaceForceCount,
      surfaceForces: summary.surfaceForces,
      totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? summary.totalInterfaceAreaM2,
      totalAbsMaterialForceN: summary.totalAbsMaterialForceN,
      netMaterialForceN: summary.netMaterialForceN,
      netGasReactionForceN: summary.netGasReactionForceN,
      conservationResidualN: summary.conservationResidualN,
      conservationResidualMagnitudeN: summary.conservationResidualMagnitudeN,
      maxPairResidualN: summary.maxPairResidualN,
      conservationStatus: summary.maxPairResidualN <= 1e-9
        ? 'pairwise-equal-opposite-force-conservative'
        : 'pairwise-force-residual-nonzero',
      forceDerivation: pressureModelId === 1
        ? 'webgpu-local-gas-cell-pressure-gradient-interface-normal-area-with-equal-opposite-gas-reaction'
        : 'webgpu-uniform-gas-pressure-interface-normal-area-with-equal-opposite-gas-reaction',
      forceResolution: pressureModelId === 1 ? 'local-gradient-interface-traction' : 'uniform-interface-traction',
      forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
      localPressureGradientValidation: pressureModelId === 1,
      forceCouplingValidation: false,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    const result = {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      executionSource: 'sphPressureInterfaceForceRowsWebGpu',
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      normalHotLoopReadbackFree: noFullReadback,
      queueCompletionStatus,
      queueCompletionMethod,
      pressureInterfaceForcePreview,
      pressureInterfaceForceSolver: solver,
      forceRowCount: packed.rowCount,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
      forceRowByteLength: outputByteLength,
      gasPressureCellRowCount: packedGasPressureCells.rowCount,
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowByteLength: packedGasPressureCells.rowByteLength,
      forceRowValues,
      pressureInterfaceForceRowsRetained: outputByteLength > 0
    };
    if (retainForceRowsBuffer) {
      result.forceRowsBuffer = forceRowsBuffer;
      result.forceRowsBufferByteLength = outputByteLength;
      result.destroyForceRowsBuffer = () => forceRowsBuffer.destroy?.();
      returnedRetainedForceRowsBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      inputBuffer.destroy?.();
      gasPressureCellsBuffer.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
      if (!retainForceRowsBuffer || !returnedRetainedForceRowsBuffer) forceRowsBuffer.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}
