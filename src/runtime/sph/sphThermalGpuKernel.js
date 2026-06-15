import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  createClosureLawGraphBuffers
} from '../../../ulg-gpu-abi/src/index.js';
import { sphThermalStepWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { evaluateClosureLawGraphCpu } from '../closureLawGraph.js';
import { GPU_PHASE_IDS, gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import {
  orderedSegments,
  segmentEnergyAbove,
  segmentTemperatureFromEnergyAbove
} from '../material/thermoState.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';

export {
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA,
  sphThermalStepWgsl
};

export const SPH_THERMAL_MATERIAL_RECORD_FLOATS = SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_SEGMENT_FLOATS = SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_RESPONSE_RECORD_FLOATS = SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT.length;
export const SPH_THERMAL_PHASE_RESPONSE_FLOATS = SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.length;
export const SPH_THERMAL_CLOSURE_GRAPH_SLOTS = Object.freeze({
  specificInternalEnergyJPerKg: 0,
  temperatureK: 1,
  dTemperatureKdSpecificInternalEnergyJPerKg: 2
});
export const SPH_THERMAL_DENSITY_POLICY_IDS = Object.freeze({
  dominantAtHalf: 1
});
export const SPH_THERMAL_STABLE_PHASE_POLICY_IDS = Object.freeze({
  dominantAtHalf: 1
});

const THERMAL_SCOPE = 'sph-thermal-closure-table-conduction-walls';
const THERMAL_SEGMENT_TYPES = Object.freeze({ phase: 1, plateau: 2 });
const THERMAL_STATUS = Object.freeze({ ready: 1, missingMaterial: 255 });
const PAIR_CONDUCTION_RELAXATION_LIMIT = 0.25;
const THERMAL_DEBYE_GRAPH_SAMPLE_COUNT = 32;
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

function assertPackedSphThermalMaterialTable(table) {
  if (table?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('Expected a packed SPH thermal material table');
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
  const segmentMetadata = [];
  for (const [material, properties] of sortedMaterialEntries(materialProperties)) {
    const materialId = stableOpticalMaterialId(material);
    const materialSegments = orderedSegments(properties);
    const segmentOffset = segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS;
    for (const segment of materialSegments) {
      const segmentIndex = segments.length / SPH_THERMAL_PHASE_SEGMENT_FLOATS;
      segmentMetadata[segmentIndex] = {
        ...segment,
        material,
        materialId,
        segmentIndex
      };
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
    segmentMetadata,
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function materialMetadataById(table) {
  const metadata = new Map();
  for (const entry of table.metadata || []) {
    metadata.set(entry.materialId, entry);
    metadata.set(new Float32Array([entry.materialId])[0], entry);
  }
  return metadata;
}

function segmentTypeName(segmentType) {
  return Math.round(segmentType) === THERMAL_SEGMENT_TYPES.plateau ? 'plateau' : 'phase';
}

function sampleDerivative(samples, index) {
  const left = samples[Math.max(0, index - 1)];
  const right = samples[Math.min(samples.length - 1, index + 1)];
  if (!left || !right || right.axis === left.axis) return 0;
  return (right.value - left.value) / (right.axis - left.axis);
}

function graphSamplesForThermalSegment(segment, sourceSegment = null) {
  const energyStart = finiteNumber(segment.energyStartJPerKg);
  const energyEnd = finiteNumber(segment.energyEndJPerKg);
  const temperatureStart = finiteNumber(segment.temperatureStartK);
  const temperatureEnd = finiteNumber(segment.temperatureEndK);
  const fallbackSlope = (temperatureEnd - temperatureStart) / Math.max(1e-30, energyEnd - energyStart);
  if (
    sourceSegment?.type !== 'phase'
    || !sourceSegment.debyeTemperatureK
    || !(energyEnd > energyStart)
    || !(sourceSegment.tHi > sourceSegment.tLo)
  ) {
    return [
      { axis: energyStart, value: temperatureStart, derivative: fallbackSlope },
      { axis: energyEnd, value: temperatureEnd, derivative: fallbackSlope }
    ];
  }

  const samples = [];
  for (let index = 0; index < THERMAL_DEBYE_GRAPH_SAMPLE_COUNT; index += 1) {
    const alpha = index / (THERMAL_DEBYE_GRAPH_SAMPLE_COUNT - 1);
    const temperatureK = sourceSegment.tLo + alpha * (sourceSegment.tHi - sourceSegment.tLo);
    const axis = sourceSegment.eStart + segmentEnergyAbove(sourceSegment, temperatureK);
    if (samples.length && axis <= samples[samples.length - 1].axis) continue;
    samples.push({ axis, value: temperatureK, derivative: 0 });
  }
  if (samples.length < 2 || samples[samples.length - 1].axis < energyEnd) {
    if (samples.length && energyEnd <= samples[samples.length - 1].axis) samples.pop();
    samples.push({ axis: energyEnd, value: temperatureEnd, derivative: 0 });
  }
  if (samples[0]?.axis > energyStart) {
    samples.unshift({ axis: energyStart, value: temperatureStart, derivative: 0 });
  }
  for (let index = 0; index < samples.length; index += 1) {
    samples[index].derivative = sampleDerivative(samples, index);
  }
  return samples.length >= 2
    ? samples
    : [
        { axis: energyStart, value: temperatureStart, derivative: fallbackSlope },
        { axis: energyEnd, value: temperatureEnd, derivative: fallbackSlope }
      ];
}

function buildThermalSegmentTemperatureGraph({ segment, segmentIndex, materialMetadata, sourceSegment = null }) {
  const energyStart = finiteNumber(segment.energyStartJPerKg);
  const energyEnd = finiteNumber(segment.energyEndJPerKg);
  if (!(energyEnd > energyStart)) {
    return null;
  }
  const temperatureStart = finiteNumber(segment.temperatureStartK);
  const temperatureEnd = finiteNumber(segment.temperatureEndK);
  const materialName = materialMetadata?.material || `material-${Math.round(segment.materialId)}`;
  const samples = graphSamplesForThermalSegment(segment, sourceSegment);
  const graph = createClosureLawGraphBuffers({
    graphId: `sph-thermal:${materialName}:${Math.round(segment.materialId)}:segment-${segmentIndex}:temperature-vs-energy`,
    nodes: [{
      op: 'tableLinear',
      inputSlot: SPH_THERMAL_CLOSURE_GRAPH_SLOTS.specificInternalEnergyJPerKg,
      outputSlot: SPH_THERMAL_CLOSURE_GRAPH_SLOTS.temperatureK,
      derivativeSlot: SPH_THERMAL_CLOSURE_GRAPH_SLOTS.dTemperatureKdSpecificInternalEnergyJPerKg,
      sampleOffset: 0,
      sampleCount: samples.length,
      domainMin: energyStart,
      domainMax: energyEnd,
      interpolation: 'linear',
      statusFlagId: 0,
      provenanceIndex: segmentIndex,
      materialId: segment.materialId,
      phaseId: segment.phaseFromId
    }],
    edges: [],
    samples,
    slotCount: 3,
    initialSlots: { 0: energyStart },
    statusCount: 1,
    strategy: 'sph-thermal-segment-flat-closure-law-graph'
  });
  return {
    ...graph,
    sourceSchema: ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
    sourceSegmentIndex: segmentIndex,
    sourceSegmentType: segmentTypeName(segment.segmentType),
    sourceMaterial: materialName,
    sourceMaterialId: segment.materialId,
    sourcePhaseFromId: segment.phaseFromId,
    sourcePhaseToId: segment.phaseToId,
    sourceSegment,
    axisName: 'specificInternalEnergyJPerKg',
    outputName: 'temperatureK',
    outputSlots: { ...SPH_THERMAL_CLOSURE_GRAPH_SLOTS },
    derivativeName: 'dTemperatureKdSpecificInternalEnergyJPerKg',
    compilerBackend: 'cpu-reference',
    compilerStatus: 'cpu-validated-sph-thermal-segment-closure-law-graph',
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false
  };
}

function packSphThermalClosureGraphBankFromGraphs({ graphs = [], metadata = [] } = {}) {
  const nodeRows = [];
  const edgeRows = [];
  const sampleRows = [];
  const slotRows = [];
  const statusRows = [];
  const graphRecords = [];
  let nodeOffset = 0;
  let edgeOffset = 0;
  let sampleOffset = 0;
  let slotOffset = 0;
  let statusOffset = 0;
  graphs.forEach((graph, graphIndex) => {
    const nodeCopy = new Float32Array(graph.nodeRows);
    for (let nodeIndex = 0; nodeIndex < graph.nodeCount; nodeIndex += 1) {
      const offset = nodeIndex * graph.nodeStrideFloats;
      nodeCopy[offset + 4] += sampleOffset;
      nodeCopy[offset + 8] += edgeOffset;
      nodeCopy[offset + 11] += statusOffset;
    }
    nodeRows.push(...nodeCopy);
    edgeRows.push(...(graph.edgeRows || new Float32Array()));
    sampleRows.push(...graph.sampleRows);
    slotRows.push(...graph.slotRows);
    statusRows.push(...graph.statusRows);
    graphRecords.push({
      graphIndex,
      graphId: graph.graphId,
      nodeOffset,
      nodeCount: graph.nodeCount,
      edgeOffset,
      edgeCount: graph.edgeCount,
      sampleOffset,
      sampleCount: graph.sampleCount,
      slotOffset,
      slotCount: graph.slotCount,
      statusOffset,
      statusCount: graph.statusCount,
      sourceSegmentIndex: metadata[graphIndex]?.segmentIndex ?? graph.sourceSegmentIndex ?? graphIndex,
      materialId: metadata[graphIndex]?.materialId ?? graph.sourceMaterialId ?? 0,
      phaseFromId: metadata[graphIndex]?.phaseFromId ?? graph.sourcePhaseFromId ?? 0,
      phaseToId: metadata[graphIndex]?.phaseToId ?? graph.sourcePhaseToId ?? 0
    });
    nodeOffset += graph.nodeCount;
    edgeOffset += graph.edgeCount;
    sampleOffset += graph.sampleCount;
    slotOffset += graph.slotCount;
    statusOffset += graph.statusCount;
  });
  return {
    schema: ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    status: 'packed-thermal-temperature-closure-graph-bank-ready',
    graphSchema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    graphCount: graphs.length,
    nodeCount: nodeOffset,
    edgeCount: edgeOffset,
    sampleCount: sampleOffset,
    slotCount: slotOffset,
    statusCount: statusOffset,
    nodeRows: new Float32Array(nodeRows),
    edgeRows: new Float32Array(edgeRows),
    sampleRows: new Float32Array(sampleRows),
    slotRows: new Float32Array(slotRows),
    statusRows: new Float32Array(statusRows),
    graphRecords,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function buildSphThermalClosureGraphBank(graphSet) {
  if (graphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('buildSphThermalClosureGraphBank requires an SPH thermal closure graph set');
  }
  return packSphThermalClosureGraphBankFromGraphs({
    graphs: graphSet.graphs,
    metadata: graphSet.metadata
  });
}

export function buildSphThermalClosureGraphBuffers(materialPropertiesOrTable = {}) {
  const table = materialPropertiesOrTable?.schema === ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
    ? materialPropertiesOrTable
    : buildSphThermalMaterialTable(materialPropertiesOrTable);
  assertPackedSphThermalMaterialTable(table);
  const materialMetadata = materialMetadataById(table);
  const graphs = [];
  const metadata = [];
  const skippedSegments = [];
  for (let segmentIndex = 0; segmentIndex < table.segmentCount; segmentIndex += 1) {
    const segment = segmentRows(table, segmentIndex);
    const material = materialMetadata.get(segment.materialId) || null;
    const sourceSegment = table.segmentMetadata?.[segmentIndex] || null;
    const graph = buildThermalSegmentTemperatureGraph({
      segment,
      segmentIndex,
      materialMetadata: material,
      sourceSegment
    });
    if (!graph) {
      skippedSegments.push({
        segmentIndex,
        material: material?.material || null,
        materialId: segment.materialId,
        segmentType: segmentTypeName(segment.segmentType),
        reason: 'non-positive-energy-domain'
      });
      continue;
    }
    const graphIndex = graphs.length;
    graphs.push(graph);
    metadata.push({
      graphIndex,
      graphId: graph.graphId,
      material: material?.material || null,
      materialId: segment.materialId,
      segmentIndex,
      segmentType: segmentTypeName(segment.segmentType),
      phaseFromId: segment.phaseFromId,
      phaseToId: segment.phaseToId,
      energyStartJPerKg: segment.energyStartJPerKg,
      energyEndJPerKg: segment.energyEndJPerKg,
      temperatureStartK: segment.temperatureStartK,
      temperatureEndK: segment.temperatureEndK,
      sourceSegmentType: sourceSegment?.type || null,
      sourceSegmentDebyeTemperatureK: sourceSegment?.debyeTemperatureK || null,
      graphSampleCount: graph.sampleCount,
      derivativeKdPerJPerKg: (segment.temperatureEndK - segment.temperatureStartK)
        / (segment.energyEndJPerKg - segment.energyStartJPerKg),
      graphSchema: graph.schema,
      graphStatus: graph.status
    });
  }
  const graphBank = packSphThermalClosureGraphBankFromGraphs({ graphs, metadata });
  return {
    schema: ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
    status: skippedSegments.length
      ? 'thermal-segment-closure-law-graphs-ready-with-skipped-segments'
      : 'thermal-segment-closure-law-graphs-ready',
    sourceSchema: table.schema,
    graphSchema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    graphBankSchema: ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    axisName: 'specificInternalEnergyJPerKg',
    outputName: 'temperatureK',
    outputSlots: { ...SPH_THERMAL_CLOSURE_GRAPH_SLOTS },
    derivativeName: 'dTemperatureKdSpecificInternalEnergyJPerKg',
    materialCount: table.materialCount,
    segmentCount: table.segmentCount,
    graphCount: graphs.length,
    skippedSegmentCount: skippedSegments.length,
    graphBank,
    graphs,
    metadata,
    skippedSegments,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
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

function assertPackedSphThermalPhaseResponseTable(table) {
  if (table?.schema !== ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA) {
    throw new TypeError('Expected a packed SPH thermal phase-response table');
  }
}

function responseRows(table, responseIndex) {
  const offset = responseIndex * SPH_THERMAL_PHASE_RESPONSE_FLOATS;
  return {
    materialId: table.responses[offset],
    segmentType: table.responses[offset + 1],
    temperatureGraphIndex: table.responses[offset + 2],
    status: table.responses[offset + 3],
    energyStartJPerKg: table.responses[offset + 4],
    energyEndJPerKg: table.responses[offset + 5],
    phaseFromId: table.responses[offset + 6],
    phaseToId: table.responses[offset + 7],
    densityFromKgPerM3: table.responses[offset + 8],
    densityToKgPerM3: table.responses[offset + 9],
    densityPolicyId: table.responses[offset + 10],
    stablePhasePolicyId: table.responses[offset + 11],
    fractionFromSlope: table.responses[offset + 12],
    fractionFromIntercept: table.responses[offset + 13],
    fractionToSlope: table.responses[offset + 14],
    fractionToIntercept: table.responses[offset + 15]
  };
}

function graphIndexBySegment(graphSet) {
  const index = new Map();
  for (const entry of graphSet?.metadata || []) {
    index.set(entry.segmentIndex, entry.graphIndex);
  }
  return index;
}

export function buildSphThermalPhaseResponseTable(materialPropertiesOrTable = {}, graphSet = null) {
  const table = materialPropertiesOrTable?.schema === ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA
    ? materialPropertiesOrTable
    : buildSphThermalMaterialTable(materialPropertiesOrTable);
  assertPackedSphThermalMaterialTable(table);
  const resolvedGraphSet = graphSet || buildSphThermalClosureGraphBuffers(table);
  if (resolvedGraphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('buildSphThermalPhaseResponseTable requires an SPH thermal closure graph set');
  }
  const graphBySegment = graphIndexBySegment(resolvedGraphSet);
  const records = [];
  const responses = [];
  const metadata = [];
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_MATERIAL_RECORD_FLOATS;
    const materialId = table.records[recordOffset];
    const segmentOffset = table.records[recordOffset + 1];
    const segmentCount = table.records[recordOffset + 2];
    const responseOffset = responses.length / SPH_THERMAL_PHASE_RESPONSE_FLOATS;
    for (let local = 0; local < segmentCount; local += 1) {
      const segmentIndex = segmentOffset + local;
      const segment = segmentRows(table, segmentIndex);
      const isPlateau = Math.round(segment.segmentType) === THERMAL_SEGMENT_TYPES.plateau;
      const temperatureGraphIndex = graphBySegment.get(segmentIndex) ?? -1;
      responses.push(
        segment.materialId,
        segment.segmentType,
        temperatureGraphIndex,
        temperatureGraphIndex >= 0 ? THERMAL_STATUS.ready : THERMAL_STATUS.missingMaterial,
        segment.energyStartJPerKg,
        segment.energyEndJPerKg,
        segment.phaseFromId,
        segment.phaseToId,
        segment.densityFromKgPerM3,
        segment.densityToKgPerM3,
        SPH_THERMAL_DENSITY_POLICY_IDS.dominantAtHalf,
        SPH_THERMAL_STABLE_PHASE_POLICY_IDS.dominantAtHalf,
        isPlateau ? -1 : 0,
        1,
        isPlateau ? 1 : 0,
        0
      );
    }
    records.push(materialId, responseOffset, segmentCount, THERMAL_STATUS.ready);
    metadata.push({
      materialId,
      responseOffset,
      responseCount: segmentCount
    });
  }
  return {
    schema: ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
    status: 'closure-derived-phase-response-table-ready',
    sourceSchema: table.schema,
    graphSetSchema: resolvedGraphSet.schema,
    graphBankSchema: resolvedGraphSet.graphBank?.schema ?? ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    materialCount: table.materialCount,
    responseCount: responses.length / SPH_THERMAL_PHASE_RESPONSE_FLOATS,
    recordLayout: [...SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT],
    responseLayout: [...SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT],
    recordStrideFloats: SPH_THERMAL_PHASE_RESPONSE_RECORD_FLOATS,
    responseStrideFloats: SPH_THERMAL_PHASE_RESPONSE_FLOATS,
    records: new Float32Array(records),
    responses: new Float32Array(responses),
    metadata,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function responseFractions(response, alpha) {
  if (Math.round(response.segmentType) !== THERMAL_SEGMENT_TYPES.plateau) {
    return phaseFractionsFor(response.phaseFromId, 1);
  }
  const fromFraction = Math.min(1, Math.max(0, response.fractionFromSlope * alpha + response.fractionFromIntercept));
  const toFraction = Math.min(1, Math.max(0, response.fractionToSlope * alpha + response.fractionToIntercept));
  return addFractions(
    phaseFractionsFor(response.phaseFromId, fromFraction),
    phaseFractionsFor(response.phaseToId, toFraction)
  );
}

export function resolveThermalPhaseResponseFromTable(table, materialId, specificInternalEnergyJPerKg) {
  assertPackedSphThermalPhaseResponseTable(table);
  for (let recordIndex = 0; recordIndex < table.materialCount; recordIndex += 1) {
    const recordOffset = recordIndex * SPH_THERMAL_PHASE_RESPONSE_RECORD_FLOATS;
    if (table.records[recordOffset] !== materialId) continue;
    const responseOffset = table.records[recordOffset + 1];
    const responseCount = table.records[recordOffset + 2];
    let selected = responseOffset;
    for (let local = 0; local < responseCount; local += 1) {
      const candidate = responseOffset + local;
      const response = responseRows(table, candidate);
      selected = candidate;
      if (specificInternalEnergyJPerKg <= response.energyEndJPerKg || local + 1 === responseCount) break;
    }
    const response = responseRows(table, selected);
    const rawAlpha = (
      specificInternalEnergyJPerKg - response.energyStartJPerKg
    ) / Math.max(1e-12, response.energyEndJPerKg - response.energyStartJPerKg);
    const alpha = Math.min(1, Math.max(0, rawAlpha));
    const isPlateau = Math.round(response.segmentType) === THERMAL_SEGMENT_TYPES.plateau;
    const dominantTo = isPlateau && alpha >= 0.5;
    const domainStatus = rawAlpha < 0 ? 'clamped-low' : (rawAlpha > 1 ? 'clamped-high' : 'in-domain');
    return {
      ...response,
      responseIndex: selected,
      alpha,
      rawAlpha,
      domainStatus,
      graphInputEnergyJPerKg: Math.min(response.energyEndJPerKg, Math.max(response.energyStartJPerKg, specificInternalEnergyJPerKg)),
      phaseId: dominantTo ? response.phaseToId : response.phaseFromId,
      restDensityKgPerM3: dominantTo ? response.densityToKgPerM3 : response.densityFromKgPerM3,
      phaseFractions: responseFractions(response, alpha),
      status: response.status
    };
  }
  return {
    responseIndex: -1,
    temperatureGraphIndex: -1,
    alpha: 0,
    rawAlpha: 0,
    domainStatus: 'missing-material',
    graphInputEnergyJPerKg: 0,
    phaseId: GPU_PHASE_IDS.unknown,
    restDensityKgPerM3: 0,
    phaseFractions: { solid: 0, liquid: 0, gas: 0, plasma: 0 },
    status: THERMAL_STATUS.missingMaterial
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

function temperatureFromPackedSegmentEnergy(table, segmentIndex, segment, specificInternalEnergyJPerKg) {
  const sourceSegment = table.segmentMetadata?.[segmentIndex] || null;
  if (sourceSegment?.type === 'phase' && sourceSegment.debyeTemperatureK) {
    const energyAbove = Math.min(
      sourceSegment.eEnd - sourceSegment.eStart,
      Math.max(0, specificInternalEnergyJPerKg - sourceSegment.eStart)
    );
    return segmentTemperatureFromEnergyAbove(sourceSegment, energyAbove);
  }
  const alpha = Math.min(1, Math.max(0, (
    specificInternalEnergyJPerKg - segment.energyStartJPerKg
  ) / Math.max(1e-12, segment.energyEndJPerKg - segment.energyStartJPerKg)));
  return segment.temperatureStartK + alpha * (segment.temperatureEndK - segment.temperatureStartK);
}

function temperatureSlopeFromPackedSegmentEnergy(table, segmentIndex, segment, specificInternalEnergyJPerKg) {
  const sourceSegment = table.segmentMetadata?.[segmentIndex] || null;
  const energySpan = segment.energyEndJPerKg - segment.energyStartJPerKg;
  if (!(energySpan > 0)) return 0;
  if (sourceSegment?.type !== 'phase' || !sourceSegment.debyeTemperatureK) {
    return (segment.temperatureEndK - segment.temperatureStartK) / energySpan;
  }
  const clampedEnergy = Math.min(segment.energyEndJPerKg, Math.max(segment.energyStartJPerKg, specificInternalEnergyJPerKg));
  const delta = Math.max(1e-3, energySpan * 1e-4);
  const lo = Math.max(segment.energyStartJPerKg, clampedEnergy - delta);
  const hi = Math.min(segment.energyEndJPerKg, clampedEnergy + delta);
  if (!(hi > lo)) return (segment.temperatureEndK - segment.temperatureStartK) / energySpan;
  const tLo = temperatureFromPackedSegmentEnergy(table, segmentIndex, segment, lo);
  const tHi = temperatureFromPackedSegmentEnergy(table, segmentIndex, segment, hi);
  return (tHi - tLo) / (hi - lo);
}

export function resolveThermalStateFromTable(table, materialId, specificInternalEnergyJPerKg) {
  assertPackedSphThermalMaterialTable(table);
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
      temperatureK: temperatureFromPackedSegmentEnergy(table, selected, segment, specificInternalEnergyJPerKg),
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

export function resolveThermalStateFromGraphPhaseResponseCpu({
  graphSet,
  responseTable,
  materialId,
  specificInternalEnergyJPerKg
} = {}) {
  if (graphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('resolveThermalStateFromGraphPhaseResponseCpu requires an SPH thermal closure graph set');
  }
  const response = resolveThermalPhaseResponseFromTable(responseTable, materialId, specificInternalEnergyJPerKg);
  if (response.status !== THERMAL_STATUS.ready || response.temperatureGraphIndex < 0) {
    return {
      temperatureK: 0,
      phaseId: GPU_PHASE_IDS.unknown,
      restDensityKgPerM3: 0,
      phaseFractions: response.phaseFractions,
      status: response.status,
      response,
      graphExecution: null
    };
  }
  const graph = graphSet.graphs?.[response.temperatureGraphIndex];
  if (graph?.schema !== ULG_CLOSURE_LAW_GRAPH_SCHEMA) {
    throw new TypeError(`Missing thermal temperature graph at index ${response.temperatureGraphIndex}`);
  }
  const graphExecution = evaluateClosureLawGraphCpu(graph, {
    inputs: {
      [SPH_THERMAL_CLOSURE_GRAPH_SLOTS.specificInternalEnergyJPerKg]: response.graphInputEnergyJPerKg
    }
  });
  return {
    temperatureK: graphExecution.slots[SPH_THERMAL_CLOSURE_GRAPH_SLOTS.temperatureK].value,
    phaseId: response.phaseId,
    restDensityKgPerM3: response.restDensityKgPerM3,
    phaseFractions: response.phaseFractions,
    status: response.status,
    response,
    graphExecution,
    closureRefreshRecommended: graphExecution.closureRefreshRecommended
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

function thermalTemperatureSlopeFromTable(table, materialId, specificInternalEnergyJPerKg) {
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
    return temperatureSlopeFromPackedSegmentEnergy(table, selected, segment, specificInternalEnergyJPerKg);
  }
  return 0;
}

function clampWallSpecificEnergyDelta({ dUSpecific, temperatureK, wallTemperatureK, temperatureSlopeKdPerJPerKg }) {
  if (!(temperatureSlopeKdPerJPerKg > 0)) return dUSpecific;
  if (!Number.isFinite(dUSpecific) || !Number.isFinite(temperatureK) || !Number.isFinite(wallTemperatureK)) return dUSpecific;
  const nextTemperatureK = temperatureK + dUSpecific * temperatureSlopeKdPerJPerKg;
  const crossesColdWall = temperatureK > wallTemperatureK && nextTemperatureK < wallTemperatureK;
  const crossesHotWall = temperatureK < wallTemperatureK && nextTemperatureK > wallTemperatureK;
  if (!crossesColdWall && !crossesHotWall) return dUSpecific;
  return (wallTemperatureK - temperatureK) / temperatureSlopeKdPerJPerKg;
}

function clampPairConductionEnergy({
  dE,
  temperatureK,
  otherTemperatureK,
  temperatureSlopeKdPerJPerKg,
  otherTemperatureSlopeKdPerJPerKg,
  massKg,
  otherMassKg
}) {
  if (!Number.isFinite(dE) || dE === 0) return 0;
  const gapK = otherTemperatureK - temperatureK;
  if (!Number.isFinite(gapK) || gapK === 0 || Math.sign(dE) !== Math.sign(gapK)) return dE;
  const responsePerJ = (temperatureSlopeKdPerJPerKg / Math.max(massKg, 1e-30))
    + (otherTemperatureSlopeKdPerJPerKg / Math.max(otherMassKg, 1e-30));
  if (!(responsePerJ > 0)) return dE;
  const equalizingEnergyJ = Math.abs(gapK) / responsePerJ;
  const limitJ = equalizingEnergyJ * PAIR_CONDUCTION_RELAXATION_LIMIT;
  return Math.sign(dE) * Math.min(Math.abs(dE), limitJ);
}

function clampSpecificEnergyDeltaToTemperatureRange({
  dUSpecific,
  temperatureK,
  temperatureSlopeKdPerJPerKg,
  minTemperatureK,
  maxTemperatureK
}) {
  if (!(temperatureSlopeKdPerJPerKg > 0)) return dUSpecific;
  if (!Number.isFinite(dUSpecific) || dUSpecific === 0 || !Number.isFinite(temperatureK)) return dUSpecific;
  const nextTemperatureK = temperatureK + dUSpecific * temperatureSlopeKdPerJPerKg;
  if (Number.isFinite(minTemperatureK) && nextTemperatureK < minTemperatureK) {
    return (minTemperatureK - temperatureK) / temperatureSlopeKdPerJPerKg;
  }
  if (Number.isFinite(maxTemperatureK) && nextTemperatureK > maxTemperatureK) {
    return (maxTemperatureK - temperatureK) / temperatureSlopeKdPerJPerKg;
  }
  return dUSpecific;
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
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null,
  thermalResponseGraphUpload = null,
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
    thermalClosureGraphSetSchema: thermalClosureGraphSet?.schema ?? null,
    thermalClosureGraphBankSchema: thermalClosureGraphBank?.schema ?? null,
    thermalPhaseResponseTableSchema: thermalPhaseResponseTable?.schema ?? null,
    thermalResponseGraphBufferSetSchema: thermalResponseGraphUpload?.schema ?? null,
    thermalResponseGraphBufferMode: thermalResponseGraphUpload
      ? (thermalResponseGraphUpload.borrowed ? 'borrowed-webgpu-upload' : 'temporary-webgpu-upload')
      : null,
    particleCount: sphParticleState.particleCount,
    materialCount: thermalMaterialTable.materialCount,
    segmentCount: thermalMaterialTable.segmentCount,
    responseCount: thermalPhaseResponseTable?.responseCount ?? null,
    thermalGraphCount: thermalClosureGraphBank?.graphCount ?? thermalClosureGraphSet?.graphCount ?? null,
    thermalResponseGraphBufferResponseByteLength: thermalResponseGraphUpload?.responseBufferByteLength ?? null,
    thermalResponseGraphBufferSampleByteLength: thermalResponseGraphUpload?.graphSampleBufferByteLength ?? null,
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
  conductionRate = 15,
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
    const materialId = sphParticleState.thermo[ti];
    const temperatureSlope = thermalTemperatureSlopeFromTable(
      thermalMaterialTable,
      materialId,
      finiteNumber(sphParticleState.state[oi + 7], 0)
    );
    let conductionDUSpecific = 0;
    let neighborMinTemperatureK = temperature;
    let neighborMaxTemperatureK = temperature;
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
      const otherTemperature = finiteNumber(sphParticleState.thermo[tj + 2], 0);
      neighborMinTemperatureK = Math.min(neighborMinTemperatureK, otherTemperature);
      neighborMaxTemperatureK = Math.max(neighborMaxTemperatureK, otherTemperature);
      const otherMass = Math.max(finiteNumber(sphParticleState.state[oj + 3], 0), 1e-30);
      const otherTemperatureSlope = thermalTemperatureSlopeFromTable(
        thermalMaterialTable,
        sphParticleState.thermo[tj],
        finiteNumber(sphParticleState.state[oj + 7], 0)
      );
      const rawDE = conductionRate * (otherTemperature - temperature) * weight * dt;
      const dE = clampPairConductionEnergy({
        dE: rawDE,
        temperatureK: temperature,
        otherTemperatureK: otherTemperature,
        temperatureSlopeKdPerJPerKg: temperatureSlope,
        otherTemperatureSlopeKdPerJPerKg: otherTemperatureSlope,
        massKg: mass,
        otherMassKg: otherMass
      });
      conductionDUSpecific += dE / mass;
    }
    const clampedConductionDUSpecific = clampSpecificEnergyDeltaToTemperatureRange({
      dUSpecific: conductionDUSpecific,
      temperatureK: temperature,
      temperatureSlopeKdPerJPerKg: temperatureSlope,
      minTemperatureK: neighborMinTemperatureK,
      maxTemperatureK: neighborMaxTemperatureK
    });
    du[i] += clampedConductionDUSpecific;
    const position = [
      sphParticleState.state[oi],
      sphParticleState.state[oi + 1],
      sphParticleState.state[oi + 2]
    ];
    for (let faceIndex = 0; faceIndex < FACE_IDS.length; faceIndex += 1) {
      const distance = wallDistance(position, dims, faceIndex);
      if (distance >= layer) continue;
      const faceWallTempK = wallTemp(wallTemperaturesK, FACE_IDS[faceIndex]);
      const currentTemperatureK = temperature + du[i] * temperatureSlope;
      const rawDUSpecific = wallRate * (faceWallTempK - currentTemperatureK) * (1 - distance / layer) * dt / mass;
      const dUSpecific = clampWallSpecificEnergyDelta({
        dUSpecific: rawDUSpecific,
        temperatureK: currentTemperatureK,
        wallTemperatureK: faceWallTempK,
        temperatureSlopeKdPerJPerKg: temperatureSlope
      });
      du[i] += dUSpecific;
      wallHeatJ[FACE_IDS[faceIndex]] += dUSpecific * mass;
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

function resolveThermalResponseGraphArtifacts({
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  if (thermalMaterialTable?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('Expected a packed SPH thermal material table');
  }
  const resolvedGraphSet = thermalClosureGraphSet || buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const resolvedGraphBank = thermalClosureGraphBank || resolvedGraphSet.graphBank || buildSphThermalClosureGraphBank(resolvedGraphSet);
  const resolvedPhaseResponseTable = thermalPhaseResponseTable || buildSphThermalPhaseResponseTable(thermalMaterialTable, resolvedGraphSet);
  if (resolvedGraphSet?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA) {
    throw new TypeError('Expected an SPH thermal closure graph set');
  }
  if (resolvedGraphBank?.schema !== ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA) {
    throw new TypeError('Expected an SPH thermal closure graph bank');
  }
  assertPackedSphThermalPhaseResponseTable(resolvedPhaseResponseTable);
  return {
    thermalClosureGraphSet: resolvedGraphSet,
    thermalClosureGraphBank: resolvedGraphBank,
    thermalPhaseResponseTable: resolvedPhaseResponseTable
  };
}

function assertOptionalThermalResponseGraphUpload(upload) {
  if (upload && upload.schema !== ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA) {
    throw new TypeError('Expected an SPH thermal response/graph WebGPU buffer set');
  }
}

export function uploadSphThermalResponseGraphBuffers(device, {
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('uploadSphThermalResponseGraphBuffers requires a WebGPU-like device with queue.writeBuffer');
  }
  const resolved = resolveThermalResponseGraphArtifacts({
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalClosureGraphBank,
    thermalPhaseResponseTable
  });
  const responseRecordBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-phase-response-records',
    resolved.thermalPhaseResponseTable.records
  );
  const responseBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-phase-responses',
    resolved.thermalPhaseResponseTable.responses
  );
  const graphNodeBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-graph-nodes',
    resolved.thermalClosureGraphBank.nodeRows
  );
  const graphSampleBuffer = writeStorageBuffer(
    device,
    'ulg-sph-thermal-graph-samples',
    resolved.thermalClosureGraphBank.sampleRows
  );
  return {
    schema: ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    sourceMaterialTableSchema: thermalMaterialTable.schema,
    thermalClosureGraphSetSchema: resolved.thermalClosureGraphSet.schema,
    thermalClosureGraphBankSchema: resolved.thermalClosureGraphBank.schema,
    thermalPhaseResponseTableSchema: resolved.thermalPhaseResponseTable.schema,
    materialCount: resolved.thermalPhaseResponseTable.materialCount,
    responseCount: resolved.thermalPhaseResponseTable.responseCount,
    graphCount: resolved.thermalClosureGraphBank.graphCount,
    nodeCount: resolved.thermalClosureGraphBank.nodeCount,
    sampleCount: resolved.thermalClosureGraphBank.sampleCount,
    responseRecordBuffer,
    responseBuffer,
    graphNodeBuffer,
    graphSampleBuffer,
    responseRecordBufferByteLength: resolved.thermalPhaseResponseTable.records.byteLength,
    responseBufferByteLength: resolved.thermalPhaseResponseTable.responses.byteLength,
    graphNodeBufferByteLength: resolved.thermalClosureGraphBank.nodeRows.byteLength,
    graphSampleBufferByteLength: resolved.thermalClosureGraphBank.sampleRows.byteLength,
    ownsResponseRecordBuffer: true,
    ownsResponseBuffer: true,
    ownsGraphNodeBuffer: true,
    ownsGraphSampleBuffer: true,
    thermalClosureGraphSet: resolved.thermalClosureGraphSet,
    thermalClosureGraphBank: resolved.thermalClosureGraphBank,
    thermalPhaseResponseTable: resolved.thermalPhaseResponseTable,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function destroySphThermalResponseGraphBuffers(buffers) {
  if (!buffers) return;
  if (buffers.ownsResponseRecordBuffer !== false) buffers.responseRecordBuffer?.destroy?.();
  if (buffers.ownsResponseBuffer !== false) buffers.responseBuffer?.destroy?.();
  if (buffers.ownsGraphNodeBuffer !== false) buffers.graphNodeBuffer?.destroy?.();
  if (buffers.ownsGraphSampleBuffer !== false) buffers.graphSampleBuffer?.destroy?.();
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
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null,
  thermalResponseGraphUpload = null,
  sphParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  wallTemperaturesK = {},
  boxDimsM = [5, 5, 5],
  dtS = 0,
  conductionRate = 15,
  wallRate = 6e4,
  wallLayerM = sphParticleState?.smoothingLengthM,
  retainOutputParticleBuffers = false,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  assertOptionalThermalResponseGraphUpload(thermalResponseGraphUpload);
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
  const resolvedGraphSet = thermalClosureGraphSet || buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const resolvedGraphBank = thermalClosureGraphBank || resolvedGraphSet.graphBank || buildSphThermalClosureGraphBank(resolvedGraphSet);
  const resolvedPhaseResponseTable = thermalPhaseResponseTable || buildSphThermalPhaseResponseTable(thermalMaterialTable, resolvedGraphSet);
  const borrowedResponseGraphUpload = thermalResponseGraphUpload?.status === 'webgpu-uploaded'
    ? { ...thermalResponseGraphUpload, borrowed: true }
    : null;
  const localResponseGraphUpload = borrowedResponseGraphUpload
    ? null
    : uploadSphThermalResponseGraphBuffers(device, {
      thermalMaterialTable,
      thermalClosureGraphSet: resolvedGraphSet,
      thermalClosureGraphBank: resolvedGraphBank,
      thermalPhaseResponseTable: resolvedPhaseResponseTable
    });
  const responseGraphUpload = borrowedResponseGraphUpload || localResponseGraphUpload;
  const responseRecordBuffer = responseGraphUpload.responseRecordBuffer;
  const responseBuffer = responseGraphUpload.responseBuffer;
  const graphNodeBuffer = responseGraphUpload.graphNodeBuffer;
  const graphSampleBuffer = responseGraphUpload.graphSampleBuffer;
  const outStateBuffer = writeStorageBuffer(device, 'ulg-sph-thermal-output-state', new Float32Array(sphParticleState.state.length), GPU_BUFFER_USAGE.COPY_SRC);
  const outThermoBuffer = writeStorageBuffer(device, 'ulg-sph-thermal-output-thermo', new Float32Array(sphParticleState.thermo.length), GPU_BUFFER_USAGE.COPY_SRC);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-thermal-params',
    size: 80,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    materialCount: resolvedPhaseResponseTable.materialCount,
    segmentCount: resolvedPhaseResponseTable.responseCount,
    dtS: finiteNumber(dtS, 0),
    smoothingLengthM: finiteNumber(sphParticleState.smoothingLengthM, 0),
    conductionRate,
    wallRate,
    wallLayerM: layer,
    boxDimsM: dims,
    wallTemperaturesK
  }));

  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-thermal-step.v1',
    label: 'ulg-sph-thermal-step',
    code: sphThermalStepWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage'),
      computeBufferBinding(6, 'storage'),
      computeBufferBinding(7, 'storage'),
      computeBufferBinding(8, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: responseRecordBuffer } },
      { binding: 3, resource: { buffer: responseBuffer } },
      { binding: 4, resource: { buffer: graphNodeBuffer } },
      { binding: 5, resource: { buffer: graphSampleBuffer } },
      { binding: 6, resource: { buffer: outStateBuffer } },
      { binding: 7, resource: { buffer: outThermoBuffer } },
      { binding: 8, resource: { buffer: paramsBuffer } }
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
  }
  const cleanup = () => {
    if (!borrowedStateBuffer) stateBuffer.destroy?.();
    if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
    if (localResponseGraphUpload) destroySphThermalResponseGraphBuffers(localResponseGraphUpload);
    paramsBuffer.destroy?.();
    if (!retainOutputParticleBuffers) {
      outStateBuffer.destroy?.();
      outThermoBuffer.destroy?.();
    }
  };
  if (noFullReadback) {
    deferSubmittedWorkCleanup(device, cleanup);
  } else {
    cleanup();
  }
  return outputEnvelope({
    backend: 'webgpu',
    sphParticleState,
    thermalMaterialTable,
    thermalClosureGraphSet: resolvedGraphSet,
    thermalClosureGraphBank: resolvedGraphBank,
    thermalPhaseResponseTable: resolvedPhaseResponseTable,
    thermalResponseGraphUpload: responseGraphUpload,
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
