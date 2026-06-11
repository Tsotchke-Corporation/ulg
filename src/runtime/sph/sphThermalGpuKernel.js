import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphThermalStepWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { GPU_PHASE_IDS, gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { orderedSegments } from '../material/thermoState.js';
import { computeBufferBinding, createExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  sphThermalStepWgsl
};

export const SPH_THERMAL_MATERIAL_RECORD_FLOATS = SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_SEGMENT_FLOATS = SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length;

const THERMAL_SCOPE = 'sph-thermal-closure-table-conduction-walls';
const THERMAL_SEGMENT_TYPES = Object.freeze({ phase: 1, plateau: 2 });
const THERMAL_STATUS = Object.freeze({ ready: 1, missingMaterial: 255 });
const FACE_IDS = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';

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

function finiteVector3(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2])
  ];
}

function assertPackedSphParticleState(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH thermal GPU step requires a packed SPH GPU particle buffer');
  }
}

function phaseDensity(properties, phaseName) {
  const exact = properties?.phases?.find((phase) => phase.name === phaseName);
  const fallback = properties?.phases?.find((phase) => phase.densityKgPerM3 > 0);
  return finiteNumber(exact?.densityKgPerM3 ?? fallback?.densityKgPerM3, 0);
}

function phaseNameOfSegment(segment) {
  return segment.type === 'phase' ? segment.phase : segment.to;
}

function sortedMaterialEntries(materialProperties) {
  return Object.entries(materialProperties || {})
    .filter(([, properties]) => properties?.phases?.length)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

export function buildSphThermalMaterialTable(materialProperties = {}) {
  const records = [];
  const segments = [];
  const metadata = [];
  for (const [material, properties] of sortedMaterialEntries(materialProperties)) {
    const materialId = stableOpticalMaterialId(material);
    const materialSegments = orderedSegments(properties);
    const segmentOffset = segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS;
    for (const segment of materialSegments) {
      if (segment.type === 'phase') {
        const phaseId = gpuPhaseId(segment.phase);
        segments.push(
          materialId,
          THERMAL_SEGMENT_TYPES.phase,
          phaseId,
          phaseId,
          finiteNumber(segment.eStart),
          finiteNumber(segment.eEnd),
          finiteNumber(segment.tLo),
          finiteNumber(segment.tHi),
          phaseDensity(properties, segment.phase),
          phaseDensity(properties, segment.phase),
          THERMAL_STATUS.ready,
          0
        );
      } else {
        segments.push(
          materialId,
          THERMAL_SEGMENT_TYPES.plateau,
          gpuPhaseId(segment.from),
          gpuPhaseId(segment.to),
          finiteNumber(segment.eStart),
          finiteNumber(segment.eEnd),
          finiteNumber(segment.temperatureK),
          finiteNumber(segment.temperatureK),
          phaseDensity(properties, segment.from),
          phaseDensity(properties, segment.to),
          THERMAL_STATUS.ready,
          0
        );
      }
    }
    records.push(materialId, segmentOffset, materialSegments.length, THERMAL_STATUS.ready);
    metadata.push({
      material,
      materialId,
      segmentOffset,
      segmentCount: materialSegments.length,
      phaseNames: [...new Set(materialSegments.map(phaseNameOfSegment))]
    });
  }
  return {
    schema: ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
    status: 'closure-derived-thermal-table-ready',
    materialCount: records.length / SPH_THERMAL_MATERIAL_RECORD_FLOATS,
    segmentCount: segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS,
    recordLayout: [...SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT],
    segmentLayout: [...SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT],
    recordStrideFloats: SPH_THERMAL_MATERIAL_RECORD_FLOATS,
    segmentStrideFloats: SPH_THERMAL_PHASE_SEGMENT_FLOATS,
    records: new Float32Array(records),
    segments: new Float32Array(segments),
    metadata,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function segmentRows(table, segmentIndex) {
  const offset = segmentIndex * SPH_THERMAL_PHASE_SEGMENT_FLOATS;
  return {
    materialId: table.segments[offset],
    segmentType: table.segments[offset + 1],
    phaseFromId: table.segments[offset + 2],
    phaseToId: table.segments[offset + 3],
    energyStartJPerKg: table.segments[offset + 4],
    energyEndJPerKg: table.segments[offset + 5],
    temperatureStartK: table.segments[offset + 6],
    temperatureEndK: table.segments[offset + 7],
    densityFromKgPerM3: table.segments[offset + 8],
    densityToKgPerM3: table.segments[offset + 9],
    status: table.segments[offset + 10]
  };
}

function phaseFractionsFor(phaseId, value) {
  return {
    solid: phaseId === GPU_PHASE_IDS.solid ? value : 0,
    liquid: phaseId === GPU_PHASE_IDS.liquid ? value : 0,
    gas: phaseId === GPU_PHASE_IDS.gas ? value : 0,
    plasma: phaseId === GPU_PHASE_IDS.plasma ? value : 0
  };
}

function addFractions(left, right) {
  return {
    solid: left.solid + right.solid,
    liquid: left.liquid + right.liquid,
    gas: left.gas + right.gas,
    plasma: left.plasma + right.plasma
  };
}

export function resolveThermalStateFromTable(table, materialId, specificInternalEnergyJPerKg) {
  if (table?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('resolveThermalStateFromTable requires a packed thermal material table');
  }
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    let selected = segmentOffset;
    for (let local = 0; local < segmentCount; local += 1) {
      const candidate = segmentOffset + local;
      const segment = segmentRows(table, candidate);
      selected = candidate;
      if (specificInternalEnergyJPerKg <= segment.energyEndJPerKg || local + 1 === segmentCount) break;
    }
    const segment = segmentRows(table, selected);
    const alpha = Math.min(1, Math.max(0, (
      specificInternalEnergyJPerKg - segment.energyStartJPerKg
    ) / Math.max(1e-12, segment.energyEndJPerKg - segment.energyStartJPerKg)));
    if (Math.round(segment.segmentType) === THERMAL_SEGMENT_TYPES.plateau) {
      const from = phaseFractionsFor(segment.phaseFromId, 1 - alpha);
      const to = phaseFractionsFor(segment.phaseToId, alpha);
      return {
        temperatureK: segment.temperatureStartK,
        phaseId: alpha >= 0.5 ? segment.phaseToId : segment.phaseFromId,
        restDensityKgPerM3: alpha >= 0.5 ? segment.densityToKgPerM3 : segment.densityFromKgPerM3,
        phaseFractions: addFractions(from, to),
        status: THERMAL_STATUS.ready
      };
    }
    return {
      temperatureK: segment.temperatureStartK + alpha * (segment.temperatureEndK - segment.temperatureStartK),
      phaseId: segment.phaseFromId,
      restDensityKgPerM3: segment.densityFromKgPerM3,
      phaseFractions: phaseFractionsFor(segment.phaseFromId, 1),
      status: THERMAL_STATUS.ready
    };
  }
  return {
    temperatureK: 0,
    phaseId: GPU_PHASE_IDS.unknown,
    restDensityKgPerM3: 0,
    phaseFractions: { solid: 0, liquid: 0, gas: 0, plasma: 0 },
    status: THERMAL_STATUS.missingMaterial
  };
}

function wallTemp(wallTemperaturesK, faceId) {
  return finiteNumber(wallTemperaturesK?.[faceId], 0);
}

function wallDistance(position, boxDimsM, faceIndex) {
  if (faceIndex === 0) return position[0];
  if (faceIndex === 1) return boxDimsM[0] - position[0];
  if (faceIndex === 2) return position[1];
  if (faceIndex === 3) return boxDimsM[1] - position[1];
  if (faceIndex === 4) return position[2];
  return boxDimsM[2] - position[2];
}

function writeResolvedThermoRow(thermo, index, materialId, resolved, sourceThermo2) {
  const offset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
  thermo[offset] = materialId;
  thermo[offset + 1] = resolved.phaseId;
  thermo[offset + 2] = resolved.temperatureK;
  thermo[offset + 3] = resolved.restDensityKgPerM3;
  thermo[offset + 4] = resolved.phaseFractions.solid;
  thermo[offset + 5] = resolved.phaseFractions.liquid;
  thermo[offset + 6] = resolved.phaseFractions.gas;
  thermo[offset + 7] = resolved.phaseFractions.plasma;
  thermo[offset + 8] = sourceThermo2[0];
  thermo[offset + 9] = sourceThermo2[1];
  thermo[offset + 10] = resolved.status;
  thermo[offset + 11] = 0;
}

function outputEnvelope({
  backend,
  sphParticleState,
  thermalMaterialTable,
  state,
  thermo,
  wallHeatJ,
  dtS,
  conductionRate,
  wallRate,
  wallLayerM,
  boxDimsM,
  stateBuffer = null,
  thermoBuffer = null,
  stateBufferByteLength = state.byteLength,
  thermoBufferByteLength = thermo.byteLength,
  retainedOutputParticleBuffers = false,
  destroyOutputParticleBuffers = null,
  readbackMode = FULL_READBACK_MODE
}) {
  return {
    schema: ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
    backend,
    status: 'thermal-step-executed',
    kernelScope: THERMAL_SCOPE,
    sourceSchema: sphParticleState.schema,
    materialTableSchema: thermalMaterialTable.schema,
    particleCount: sphParticleState.particleCount,
    materialCount: thermalMaterialTable.materialCount,
    segmentCount: thermalMaterialTable.segmentCount,
    sourceStep: sphParticleState.step ?? 0,
    step: (sphParticleState.step ?? 0) + 1,
    sourceTime: sphParticleState.time ?? 0,
    time: finiteNumber(sphParticleState.time, 0) + dtS,
    dtS,
    conductionRate,
    wallRate,
    wallLayerM,
    boxDimsM: [...boxDimsM],
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    state,
    thermo,
    stateBuffer,
    thermoBuffer,
    stateBufferByteLength,
    thermoBufferByteLength,
    retainedOutputParticleBuffers,
    destroyOutputParticleBuffers,
    readbackMode,
    fullReadbackPerformed: readbackMode !== NO_FULL_READBACK_MODE,
    normalHotLoopReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
    wallHeatJ: { ...wallHeatJ },
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function runSphThermalStepCpu({
  sphParticleState,
  thermalMaterialTable,
  wallTemperaturesK = {},
  boxDimsM = [5, 5, 5],
  dtS = 0,
  conductionRate = 1.5e4,
  wallRate = 6e4,
  wallLayerM = sphParticleState?.smoothingLengthM
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  if (thermalMaterialTable?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('runSphThermalStepCpu requires a packed thermal material table');
  }
  const particleCount = sphParticleState.particleCount;
  const dims = finiteVector3(boxDimsM, [5, 5, 5]);
  const dt = finiteNumber(dtS, 0);
  const h = finiteNumber(sphParticleState.smoothingLengthM, 0);
  const support = 2 * h;
  const layer = finiteNumber(wallLayerM, h);
  const state = new Float32Array(sphParticleState.state);
  const thermo = new Float32Array(sphParticleState.thermo);
  const du = new Float64Array(particleCount);
  const wallHeatJ = Object.fromEntries(FACE_IDS.map((faceId) => [faceId, 0]));

  for (let i = 0; i < particleCount; i += 1) {
    const oi = i * SPH_GPU_PARTICLE_STATE_FLOATS;
    const ti = i * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const mass = Math.max(finiteNumber(sphParticleState.state[oi + 3], 0), 1e-30);
    const temperature = finiteNumber(sphParticleState.thermo[ti + 2], 0);
    for (let j = 0; j < particleCount; j += 1) {
      if (i === j) continue;
      const oj = j * SPH_GPU_PARTICLE_STATE_FLOATS;
      const dx = sphParticleState.state[oi] - sphParticleState.state[oj];
      const dy = sphParticleState.state[oi + 1] - sphParticleState.state[oj + 1];
      const dz = sphParticleState.state[oi + 2] - sphParticleState.state[oj + 2];
      const r = Math.hypot(dx, dy, dz);
      if (r >= support) continue;
      const tj = j * SPH_GPU_PARTICLE_THERMO_FLOATS;
      const weight = 1 - r / support;
      const dE = conductionRate * (finiteNumber(sphParticleState.thermo[tj + 2], 0) - temperature) * weight * dt;
      du[i] += dE / mass;
    }
    const position = [
      sphParticleState.state[oi],
      sphParticleState.state[oi + 1],
      sphParticleState.state[oi + 2]
    ];
    for (let faceIndex = 0; faceIndex < FACE_IDS.length; faceIndex += 1) {
      const distance = wallDistance(position, dims, faceIndex);
      if (distance >= layer) continue;
      const dE = wallRate * (wallTemp(wallTemperaturesK, FACE_IDS[faceIndex]) - temperature) * (1 - distance / layer) * dt;
      du[i] += dE / mass;
      wallHeatJ[FACE_IDS[faceIndex]] += dE;
    }
  }

  for (let i = 0; i < particleCount; i += 1) {
    const stateOffset = i * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = i * SPH_GPU_PARTICLE_THERMO_FLOATS;
    state[stateOffset + 7] = sphParticleState.state[stateOffset + 7] + du[i];
    const materialId = sphParticleState.thermo[thermoOffset];
    const resolved = resolveThermalStateFromTable(thermalMaterialTable, materialId, state[stateOffset + 7]);
    writeResolvedThermoRow(thermo, i, materialId, resolved, [
      sphParticleState.thermo[thermoOffset + 8],
      sphParticleState.thermo[thermoOffset + 9]
    ]);
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    thermalMaterialTable,
    state,
    thermo,
    wallHeatJ,
    dtS: dt,
    conductionRate,
    wallRate,
    wallLayerM: layer,
    boxDimsM: dims
  });
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createParamsArray({
  particleCount,
  materialCount,
  segmentCount,
  dtS,
  smoothingLengthM,
  conductionRate,
  wallRate,
  wallLayerM,
  boxDimsM,
  wallTemperaturesK
}) {
  const buffer = new ArrayBuffer(80);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, materialCount, true);
  view.setUint32(8, segmentCount, true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, dtS, true);
  view.setFloat32(20, smoothingLengthM, true);
  view.setFloat32(24, conductionRate, true);
  view.setFloat32(28, wallRate, true);
  view.setFloat32(32, wallLayerM, true);
  view.setFloat32(36, boxDimsM[0], true);
  view.setFloat32(40, boxDimsM[1], true);
  view.setFloat32(44, boxDimsM[2], true);
  view.setFloat32(48, wallTemp(wallTemperaturesK, 'xMin'), true);
  view.setFloat32(52, wallTemp(wallTemperaturesK, 'xMax'), true);
  view.setFloat32(56, wallTemp(wallTemperaturesK, 'yMin'), true);
  view.setFloat32(60, wallTemp(wallTemperaturesK, 'yMax'), true);
  view.setFloat32(64, wallTemp(wallTemperaturesK, 'zMin'), true);
  view.setFloat32(68, wallTemp(wallTemperaturesK, 'zMax'), true);
  view.setFloat32(72, 0, true);
  view.setFloat32(76, 0, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength) {
  const readback = device.createBuffer({
    label: 'ulg-sph-thermal-readback',
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

export async function runSphThermalStepWebGpu({
  device,
  sphParticleState,
  thermalMaterialTable,
  sphParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  wallTemperaturesK = {},
  boxDimsM = [5, 5, 5],
  dtS = 0,
  conductionRate = 1.5e4,
  wallRate = 6e4,
  wallLayerM = sphParticleState?.smoothingLengthM,
  retainOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphThermalStepWebGpu requires a WebGPU-like device');
  }
  const dims = finiteVector3(boxDimsM, [5, 5, 5]);
  const layer = finiteNumber(wallLayerM, sphParticleState.smoothingLengthM);
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const borrowedThermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-sph-thermal-source-state', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-sph-thermal-source-thermo', sphParticleState.thermo);
  const recordBuffer = writeStorageBuffer(device, 'ulg-sph-thermal-material-records', thermalMaterialTable.records);
  const segmentBuffer = writeStorageBuffer(device, 'ulg-sph-thermal-segments', thermalMaterialTable.segments);
  const outStateBuffer = writeStorageBuffer(device, 'ulg-sph-thermal-output-state', new Float32Array(sphParticleState.state.length), GPU_BUFFER_USAGE.COPY_SRC);
  const outThermoBuffer = writeStorageBuffer(device, 'ulg-sph-thermal-output-thermo', new Float32Array(sphParticleState.thermo.length), GPU_BUFFER_USAGE.COPY_SRC);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-thermal-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    materialCount: thermalMaterialTable.materialCount,
    segmentCount: thermalMaterialTable.segmentCount,
    dtS: finiteNumber(dtS, 0),
    smoothingLengthM: finiteNumber(sphParticleState.smoothingLengthM, 0),
    conductionRate,
    wallRate,
    wallLayerM: layer,
    boxDimsM: dims,
    wallTemperaturesK
  }));

  const module = device.createShaderModule({ label: 'ulg-sph-thermal-step', code: sphThermalStepWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-thermal-step',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: recordBuffer } },
      { binding: 3, resource: { buffer: segmentBuffer } },
      { binding: 4, resource: { buffer: outStateBuffer } },
      { binding: 5, resource: { buffer: outThermoBuffer } },
      { binding: 6, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);

  let state = new Float32Array();
  let thermo = new Float32Array();
  if (!noFullReadback) {
    const [stateBytes, thermoBytes] = await Promise.all([
      readBuffer(device, outStateBuffer, sphParticleState.state.byteLength),
      readBuffer(device, outThermoBuffer, sphParticleState.thermo.byteLength)
    ]);
    state = new Float32Array(stateBytes);
    thermo = new Float32Array(thermoBytes);
  } else if (device.queue?.onSubmittedWorkDone) {
    await device.queue.onSubmittedWorkDone();
  }
  if (!borrowedStateBuffer) stateBuffer.destroy?.();
  if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
  for (const buffer of [recordBuffer, segmentBuffer, paramsBuffer]) {
    buffer.destroy?.();
  }
  if (!retainOutputParticleBuffers) {
    outStateBuffer.destroy?.();
    outThermoBuffer.destroy?.();
  }
  return outputEnvelope({
    backend: 'webgpu',
    sphParticleState,
    thermalMaterialTable,
    state,
    thermo,
    wallHeatJ: Object.fromEntries(FACE_IDS.map((faceId) => [faceId, null])),
    dtS: finiteNumber(dtS, 0),
    conductionRate,
    wallRate,
    wallLayerM: layer,
    boxDimsM: dims,
    stateBuffer: retainOutputParticleBuffers ? outStateBuffer : null,
    thermoBuffer: retainOutputParticleBuffers ? outThermoBuffer : null,
    stateBufferByteLength: sphParticleState.state.byteLength,
    thermoBufferByteLength: sphParticleState.thermo.byteLength,
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
    destroyOutputParticleBuffers: retainOutputParticleBuffers
      ? () => {
        outStateBuffer.destroy?.();
        outThermoBuffer.destroy?.();
      }
      : null,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
  });
}

export function compareSphThermalStepParity(cpuResult, gpuResult, { tolerance = 2e-3 } = {}) {
  if (!cpuResult || !gpuResult) {
    return { schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA, status: 'fail', reason: 'missing result', scientificValidation: false, phaseChangeValidation: false, fullPhysicsValidation: false };
  }
  let maxStateAbs = 0;
  let maxThermoAbs = 0;
  if (cpuResult.state.length !== gpuResult.state.length || cpuResult.thermo.length !== gpuResult.thermo.length) {
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
      status: 'fail',
      lengthMismatch: true,
      maxStateAbs: Infinity,
      maxThermoAbs: Infinity,
      tolerance,
      scientificValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  for (let i = 0; i < cpuResult.state.length; i += 1) maxStateAbs = Math.max(maxStateAbs, Math.abs(cpuResult.state[i] - gpuResult.state[i]));
  for (let i = 0; i < cpuResult.thermo.length; i += 1) maxThermoAbs = Math.max(maxThermoAbs, Math.abs(cpuResult.thermo[i] - gpuResult.thermo[i]));
  const pass = maxStateAbs <= tolerance && maxThermoAbs <= tolerance;
  return {
    schema: ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
    status: pass ? 'pass' : 'fail',
    maxStateAbs,
    maxThermoAbs,
    tolerance,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runSphThermalStepWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = runSphThermalStepWebGpu,
  parityTolerance = 2e-3,
  ...args
} = {}) {
  const cpuReference = runSphThermalStepCpu(args);
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDevice = device || deviceResult?.device || navigatorRef?.gpu?.device || null;
  if (!resolvedDevice) {
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: 'webgpu device unavailable' },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ ...args, device: resolvedDevice });
    const parity = compareSphThermalStepParity(cpuReference, webgpu, { tolerance: parityTolerance });
    if (parity.status === 'pass') {
      return {
        schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference,
        webgpu,
        result: webgpu,
        webgpuParity: parity,
        webgpuStatus: { status: 'webgpu-executed' },
        scientificValidation: false,
        materialValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-parity-failed-cpu-reference',
      cpuReference,
      webgpu,
      result: cpuReference,
      webgpuParity: parity,
      webgpuStatus: { status: 'fallback-cpu', reason: 'thermal parity failed' },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      scientificValidation: false,
      materialValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}
