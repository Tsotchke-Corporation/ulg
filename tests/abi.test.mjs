import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_EDGE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_OP_IDS,
  CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT,
  OPTICAL_GPU_RECORD_ROW_LAYOUT,
  OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT,
  OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT,
  OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT,
  MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT,
  MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT,
  createClosureTableDescriptor,
  createClosureLawGraphBuffers,
  createClosureLawGraphDescriptor,
  createClosureTableSampleBuffer,
  createClosureTableWgslDescriptor,
  createComplex64Vector,
  createProvenanceBlock,
  createSimulationArtifact,
  createTensorDescriptor,
  createToleranceReport,
  complex64ToPairs,
  ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA,
  ULG_OPTICAL_GPU_LOOKUP_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_THERMAL_STEP_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  mlsMpmG2pReconstructWgsl,
  mlsMpmGridUpdateWgsl,
  mlsMpmMechanicsPredictWgsl,
  mlsMpmP2gGridProjectionWgsl,
  mlsMpmResidentSummaryFinalizeWgsl,
  mlsMpmResidentSummaryPartialsWgsl,
  mlsMpmResidentSummaryWgsl,
  opticalLookupWgsl,
  sphReactionStepWgsl,
  sphRenderFieldWgsl,
  sphRenderRowsWgsl,
  sphThermalStepWgsl
} from '../ulg-gpu-abi/src/wgsl.js';

const ajv = new Ajv2020({ strict: false });

test('complex64 vectors round-trip through the shared ABI layout', () => {
  const vector = createComplex64Vector([[1, 2], [-3.5, 4.25]]);
  assert.equal(vector.byteLength, 16);
  assert.deepEqual(complex64ToPairs(vector), [[1, 2], [-3.5, 4.25]]);
});

test('tensor and closure descriptors carry ABI metadata', () => {
  const tensor = createTensorDescriptor({ id: 'psi', dtype: 'complex64', shape: [2, 4] });
  assert.equal(tensor.abiVersion, '0.5');
  assert.equal(tensor.byteLength, 64);
  assert.deepEqual(tensor.strides, [4, 1]);

  const closure = createClosureTableDescriptor({
    closureId: 'eos-demo',
    axes: [{ name: 'rho', samples: 8 }],
    outputs: [{ name: 'pressure', dtype: 'f32' }]
  });
  assert.equal(closure.layout, 'soa');
  assert.equal(closure.wgslTableDescriptor.schema, ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA);
  assert.equal(closure.wgslTableDescriptor.status, 'declared-table-wgsl-layout');
  assert.equal(closure.wgslTableDescriptor.axisName, 'rho');
  assert.equal(closure.wgslTableDescriptor.outputName, 'pressure');
  assert.equal(closure.wgslTableDescriptor.sampleCount, 8);
  assert.equal(closure.wgslTableDescriptor.sampleStrideBytes, 16);
  assert.deepEqual(closure.wgslTableDescriptor.rowLayout, CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT);
  assert.equal(closure.wgslTableDescriptor.materialValidation, false);
  assert.equal(closure.wgslTableDescriptor.eosValidation, false);
  assert.equal(closure.wgslTableDescriptor.sphValidation, false);
  assert.equal(closure.wgslTableDescriptor.phaseChangeValidation, false);
});

test('closure table WGSL descriptors and sample buffers use a stable f32x4 row layout', () => {
  const descriptor = createClosureTableWgslDescriptor({
    closureId: 'toy-table',
    axisName: 'r',
    outputName: 'energy',
    derivativeName: 'dEdr',
    sampleCount: 3
  });
  assert.equal(descriptor.schema, ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA);
  assert.equal(descriptor.bufferLayout, 'aos-f32x4');
  assert.equal(descriptor.sampleStruct, 'ClosureTableSample');
  assert.equal(descriptor.sampleStrideFloats, 4);
  assert.equal(descriptor.fullPhysicsValidation, false);

  const explicit = createClosureTableSampleBuffer([
    { axis: 0.5, value: 0.125, derivative: -0.5 },
    { axis: 1, value: 0, derivative: 0 },
    { axis: 1.5, value: 0.125, derivative: 0.5 }
  ]);
  assert.deepEqual(Array.from(explicit), [
    0.5, 0.125, -0.5, 0,
    1, 0, 0, 0,
    1.5, 0.125, 0.5, 0
  ]);

  const inferred = createClosureTableSampleBuffer([
    { r: 0, energy: 0 },
    { r: 1, energy: 2 },
    { r: 2, energy: 8 }
  ], {
    axisKey: 'r',
    outputKey: 'energy',
    derivativeKey: 'dEdr'
  });
  assert.deepEqual(Array.from(inferred), [
    0, 0, 2, 0,
    1, 2, 4, 0,
    2, 8, 6, 0
  ]);
  assert.throws(() => createClosureTableWgslDescriptor({
    closureId: 'overclaim',
    fullPhysicsValidation: true
  }), /fullPhysicsValidation must remain false/);
});

test('closure-law graph ABI exposes flat WebGPU row layouts', () => {
  const descriptor = createClosureLawGraphDescriptor({
    graphId: 'toy-flat-closure-law-graph',
    nodeCount: 1,
    edgeCount: 0,
    sampleCount: 3,
    slotCount: 3
  });
  assert.equal(descriptor.schema, ULG_CLOSURE_LAW_GRAPH_SCHEMA);
  assert.equal(descriptor.nodeStrideFloats, 16);
  assert.equal(descriptor.edgeStrideFloats, 4);
  assert.equal(descriptor.sampleStrideFloats, 4);
  assert.equal(descriptor.slotStrideFloats, 4);
  assert.equal(descriptor.statusStrideFloats, 4);
  assert.equal(CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT.length % 4, 0);
  assert.equal(CLOSURE_LAW_GRAPH_EDGE_ROW_LAYOUT.length % 4, 0);
  assert.equal(CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT.length % 4, 0);
  assert.equal(CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT.length % 4, 0);
  assert.equal(CLOSURE_LAW_GRAPH_OP_IDS.tableLinear, 1);
  assert.equal(CLOSURE_LAW_GRAPH_OP_IDS.tableStep, 2);
  assert.equal(descriptor.opIds.tableStep, 2);
  assert.equal(descriptor.fullPhysicsValidation, false);

  const graph = createClosureLawGraphBuffers({
    graphId: 'toy-flat-closure-law-graph',
    nodes: [{
      op: 'tableLinear',
      inputSlot: 0,
      outputSlot: 1,
      derivativeSlot: 2,
      sampleOffset: 0,
      sampleCount: 3,
      domainMin: 0.5,
      domainMax: 1.5
    }],
    samples: [
      { axis: 0.5, value: 0.125, derivative: -0.5 },
      { axis: 1, value: 0, derivative: 0 },
      { axis: 1.5, value: 0.125, derivative: 0.5 }
    ],
    slotCount: 3,
    initialSlots: { 0: 1 }
  });
  assert.equal(graph.schema, ULG_CLOSURE_LAW_GRAPH_SCHEMA);
  assert.equal(graph.nodeRows.length, CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT.length);
  assert.equal(graph.edgeRows.length, 0);
  assert.equal(graph.sampleRows.length, 3 * CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length);
  assert.equal(graph.slotRows.length, 3 * CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT.length);
  assert.equal(graph.statusRows.length, CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT.length);
  assert.throws(() => createClosureLawGraphDescriptor({
    graphId: 'overclaim',
    nodeCount: 1,
    sampleCount: 2,
    slotCount: 2,
    fullPhysicsValidation: true
  }), /fullPhysicsValidation must remain false/);
});

test('optical GPU table ABI exposes stable storage-buffer row layouts', () => {
  assert.equal(ULG_OPTICAL_GPU_TABLE_SCHEMA, 'peercompute.ulg.optical-gpu-table.v0');
  assert.equal(ULG_OPTICAL_GPU_BUFFER_SET_SCHEMA, 'peercompute.ulg.optical-gpu-buffer-set.v0');
  assert.equal(ULG_OPTICAL_GPU_LOOKUP_SCHEMA, 'peercompute.ulg.optical-gpu-lookup.v0');
  assert.equal(ULG_OPTICAL_GPU_LOOKUP_EXECUTION_SCHEMA, 'peercompute.ulg.optical-gpu-lookup-execution.v0');
  assert.equal(ULG_OPTICAL_GPU_LOOKUP_PARITY_SCHEMA, 'peercompute.ulg.optical-gpu-lookup-parity.v0');
  assert.equal(OPTICAL_GPU_RECORD_ROW_LAYOUT.length, 24);
  assert.equal(OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT.length, 8);
  assert.equal(OPTICAL_GPU_LOOKUP_QUERY_ROW_LAYOUT.length, 4);
  assert.equal(OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT.length, 12);
  assert.deepEqual(OPTICAL_GPU_RECORD_ROW_LAYOUT.slice(0, 4), [
    'materialId:f32',
    'phaseId:f32',
    'spectralOffset:f32',
    'spectralCount:f32'
  ]);
  assert.deepEqual(OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT.slice(0, 5), [
    'wavelengthNm:f32',
    'reflectance:f32',
    'transmittance:f32',
    'absorptionCoefficientPerM:f32',
    'scatteringCoefficientPerM:f32'
  ]);
  assert.match(opticalLookupWgsl, /@group\(0\) @binding\(0\) var<storage, read> optical_records/);
  assert.match(opticalLookupWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> optical_outputs/);
  assert.match(opticalLookupWgsl, /@compute @workgroup_size\(64\)/);
});

test('SPH GPU particle buffer ABI exposes f32x4-aligned row layouts', () => {
  assert.equal(ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, 'peercompute.ulg.sph-gpu-particle-buffer.v0');
  assert.equal(ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA, 'peercompute.ulg.sph-gpu-particle-buffer-set.v0');
  assert.equal(SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length, 8);
  assert.equal(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.slice(0, 4), [
    'positionXM:f32',
    'positionYM:f32',
    'positionZM:f32',
    'massKg:f32'
  ]);
  assert.deepEqual(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.slice(0, 4), [
    'materialId:f32',
    'phaseId:f32',
    'temperatureK:f32',
    'restDensityKgPerM3:f32'
  ]);
});

test('SPH GPU thermal material table ABI exposes closure-derived row layouts', () => {
  assert.equal(ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-material-table.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-phase-response-table.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_STEP_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-step.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-step-execution.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-step-parity.v0');
  assert.equal(SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length, 4);
  assert.equal(SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT.length, 4);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT, [
    'materialId:f32',
    'segmentOffset:f32',
    'segmentCount:f32',
    'status:f32'
  ]);
  assert.deepEqual(SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.slice(0, 8), [
    'materialId:f32',
    'segmentType:f32',
    'phaseFromId:f32',
    'phaseToId:f32',
    'energyStartJPerKg:f32',
    'energyEndJPerKg:f32',
    'temperatureStartK:f32',
    'temperatureEndK:f32'
  ]);
  assert.deepEqual(SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT, [
    'materialId:f32',
    'responseOffset:f32',
    'responseCount:f32',
    'status:f32'
  ]);
  assert.deepEqual(SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.slice(0, 8), [
    'materialId:f32',
    'segmentType:f32',
    'temperatureGraphIndex:f32',
    'status:f32',
    'energyStartJPerKg:f32',
    'energyEndJPerKg:f32',
    'phaseFromId:f32',
    'phaseToId:f32'
  ]);
  assert.deepEqual(SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.slice(8), [
    'densityFromKgPerM3:f32',
    'densityToKgPerM3:f32',
    'densityPolicyId:f32',
    'stablePhasePolicyId:f32',
    'fractionFromSlope:f32',
    'fractionFromIntercept:f32',
    'fractionToSlope:f32',
    'fractionToIntercept:f32'
  ]);
  assert.match(sphThermalStepWgsl, /@group\(0\) @binding\(2\) var<storage, read> phase_response_records/);
  assert.match(sphThermalStepWgsl, /@group\(0\) @binding\(3\) var<storage, read> phase_responses/);
  assert.match(sphThermalStepWgsl, /@group\(0\) @binding\(4\) var<storage, read> thermal_graph_nodes/);
  assert.match(sphThermalStepWgsl, /@group\(0\) @binding\(5\) var<storage, read> thermal_graph_samples/);
  assert.match(sphThermalStepWgsl, /@group\(0\) @binding\(7\) var<storage, read_write> out_sph_thermo/);
  assert.match(sphThermalStepWgsl, /@compute @workgroup_size\(64\)/);
});

test('SPH GPU reaction table ABI exposes derived reaction and product phase rows', () => {
  assert.equal(ULG_SPH_GPU_REACTION_TABLE_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-table.v0');
  assert.equal(ULG_SPH_GPU_REACTION_STEP_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-step.v0');
  assert.equal(ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-step-execution.v0');
  assert.equal(ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-step-parity.v0');
  assert.equal(SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_REACTION_RECORD_ROW_LAYOUT.slice(0, 8), [
    'reactantAMaterialId:f32',
    'reactantBMaterialId:f32',
    'productMaterialId:f32',
    'activationTemperatureK:f32',
    'specificEnthalpyJPerKg:f32',
    'contactRadiusM:f32',
    'phaseMaskA:f32',
    'phaseMaskB:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.slice(0, 8), [
    'materialId:f32',
    'phaseId:f32',
    'restDensityKgPerM3:f32',
    'effectiveBulkModulusPa:f32',
    'shearModulusPa:f32',
    'lameLambdaPa:f32',
    'soundSpeedMPerS:f32',
    'eosModelId:f32'
  ]);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(3\) var<storage, read> reaction_records/);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(7\) var<storage, read_write> proposals/);
  assert.match(sphReactionStepWgsl, /fn propose/);
  assert.match(sphReactionStepWgsl, /fn resolve/);
  assert.match(sphReactionStepWgsl, /@compute @workgroup_size\(64\)/);
});

test('SPH GPU render rows ABI exposes compact render-state rows', () => {
  assert.equal(ULG_SPH_GPU_RENDER_ROWS_SCHEMA, 'peercompute.ulg.sph-gpu-render-rows.v0');
  assert.equal(
    ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-rows-execution.v0'
  );
  assert.equal(SPH_GPU_RENDER_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_RENDER_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_RENDER_ROW_LAYOUT.slice(0, 8), [
    'positionXM:f32',
    'positionYM:f32',
    'positionZM:f32',
    'massKg:f32',
    'materialId:f32',
    'phaseId:f32',
    'temperatureK:f32',
    'status:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_ROW_LAYOUT.slice(8), [
    'restDensityKgPerM3:f32',
    'phaseFractionGas:f32',
    'representedEntityCount:f32',
    'pad0:f32'
  ]);
  assert.match(sphRenderRowsWgsl, /struct RenderRowsParams/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(0\) var<storage, read> sph_state/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(1\) var<storage, read> sph_thermo/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> render_rows/);
  assert.match(sphRenderRowsWgsl, /@compute @workgroup_size\(64\)/);
});

test('SPH GPU render field ABI exposes material-phase surface fields', () => {
  assert.equal(ULG_SPH_GPU_RENDER_FIELD_SCHEMA, 'peercompute.ulg.sph-gpu-render-field.v0');
  assert.equal(
    ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-field-execution.v0'
  );
  assert.equal(SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.slice(0, 8), [
    'materialId:f32',
    'phaseId:f32',
    'fieldOffset:f32',
    'fieldCellCount:f32',
    'resolution:f32',
    'isolation:f32',
    'subtract:f32',
    'strength:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.slice(8), [
    'radiusNorm:f32',
    'colorLinearR:f32',
    'colorLinearG:f32',
    'colorLinearB:f32',
    'status:f32',
    'pad0:f32',
    'pad1:f32',
    'pad2:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT, [
    'density:f32',
    'paletteLinearR:f32',
    'paletteLinearG:f32',
    'paletteLinearB:f32'
  ]);
  assert.match(sphRenderFieldWgsl, /struct RenderFieldParams/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(0\) var<storage, read> render_rows/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(1\) var<storage, read> render_surfaces/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> render_field_cells/);
  assert.match(sphRenderFieldWgsl, /material_id/);
  assert.match(sphRenderFieldWgsl, /phase_id/);
  assert.match(sphRenderFieldWgsl, /@compute @workgroup_size\(64, 1, 1\)/);
});

test('MLS-MPM GPU particle buffer ABI exposes f32x4-aligned mechanics rows', () => {
  assert.equal(ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-particle-buffer.v0');
  assert.equal(ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0');
  assert.equal(
    ULG_MLS_MPM_GPU_MECHANICS_PREDICTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0'
  );
  assert.equal(
    ULG_MLS_MPM_GPU_MECHANICS_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-mechanics-execution.v0'
  );
  assert.equal(
    ULG_MLS_MPM_GPU_MECHANICS_PARITY_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-mechanics-parity.v0'
  );
  assert.equal(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length, 32);
  assert.equal(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.slice(0, 4), [
    'deformationF00:f32',
    'deformationF01:f32',
    'deformationF02:f32',
    'deformationF10:f32'
  ]);
  assert.deepEqual(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.slice(18, 22), [
    'volumeRatioJ:f32',
    'restVolumeM3:f32',
    'solidFlag:f32',
    'status:f32'
  ]);
  assert.deepEqual(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.slice(22, 28), [
    'effectiveBulkModulusPa:f32',
    'shearModulusPa:f32',
    'lameLambdaPa:f32',
    'soundSpeedMPerS:f32',
    'eosModelId:f32',
    'constitutiveStatus:f32'
  ]);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read> sph_state: array<vec4<f32>>/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read> mls_mechanics: array<vec4<f32>>/);
  assert.match(mlsMpmMechanicsPredictWgsl, /var<storage, read_write> out_mls_mechanics: array<vec4<f32>>/);
  assert.match(mlsMpmMechanicsPredictWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM GPU P2G grid projection ABI exposes f32x4-aligned grid rows', () => {
  assert.equal(ULG_MLS_MPM_GPU_GRID_PROJECTION_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-grid-projection.v0');
  assert.equal(
    ULG_MLS_MPM_GPU_GRID_PROJECTION_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0'
  );
  assert.equal(
    ULG_MLS_MPM_GPU_GRID_PROJECTION_PARITY_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-grid-projection-parity.v0'
  );
  assert.equal(MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length, 8);
  assert.equal(MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(MLS_MPM_GPU_GRID_NODE_ROW_LAYOUT.slice(0, 4), [
    'massKg:f32',
    'momentumXKgMPerS:f32',
    'momentumYKgMPerS:f32',
    'momentumZKgMPerS:f32'
  ]);
  assert.match(mlsMpmP2gGridProjectionWgsl, /struct P2gProjectionParams/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> sph_state: array<vec4<f32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read> mls_mechanics: array<vec4<f32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read_write> grid_nodes: array<vec4<f32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn quadratic_weights/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn packed_pressure/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn corotated_stress/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM GPU grid update ABI exposes f32x4-aligned velocity rows', () => {
  assert.equal(ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-grid-update.v0');
  assert.equal(
    ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-grid-update-execution.v0'
  );
  assert.equal(
    ULG_MLS_MPM_GPU_GRID_UPDATE_PARITY_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-grid-update-parity.v0'
  );
  assert.equal(MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT.length, 8);
  assert.equal(MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(MLS_MPM_GPU_GRID_VELOCITY_ROW_LAYOUT.slice(0, 4), [
    'massKg:f32',
    'velocityXMPerS:f32',
    'velocityYMPerS:f32',
    'velocityZMPerS:f32'
  ]);
  assert.match(mlsMpmGridUpdateWgsl, /struct GridUpdateParams/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read> p2g_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /var<storage, read_write> updated_grid_nodes/);
  assert.match(mlsMpmGridUpdateWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM GPU G2P reconstruction ABI exposes execution schemas and WGSL bindings', () => {
  assert.equal(ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-g2p-reconstruction.v0');
  assert.equal(
    ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-execution.v0'
  );
  assert.equal(
    ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-parity.v0'
  );
  assert.match(mlsMpmG2pReconstructWgsl, /struct G2pParams/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read> updated_grid_nodes/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_sph_state/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_mls_mechanics/);
  assert.match(mlsMpmG2pReconstructWgsl, /@compute @workgroup_size\(64\)/);
});

test('MLS-MPM GPU resident step ABI exposes chain execution schemas', () => {
  assert.equal(ULG_MLS_MPM_GPU_RESIDENT_STEP_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-resident-step.v0');
  assert.equal(
    ULG_MLS_MPM_GPU_RESIDENT_STEP_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0'
  );
  assert.equal(
    ULG_MLS_MPM_GPU_RESIDENT_STEPS_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0'
  );
});

test('MLS-MPM GPU resident summary ABI exposes compact f32x4 diagnostics', () => {
  assert.equal(ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_SCHEMA, 'peercompute.ulg.mls-mpm-gpu-resident-summary.v0');
  assert.equal(
    ULG_MLS_MPM_GPU_RESIDENT_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.mls-mpm-gpu-resident-summary-execution.v0'
  );
  assert.equal(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.length, 20);
  assert.equal(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.slice(0, 4), [
    'particleCount:f32',
    'gridNodeCount:f32',
    'activeGridNodeCount:f32',
    'sourceMassKg:f32'
  ]);
  assert.match(mlsMpmResidentSummaryWgsl, /struct ResidentSummaryParams/);
  assert.equal(mlsMpmResidentSummaryWgsl, mlsMpmResidentSummaryPartialsWgsl);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> source_sph_state/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> next_sph_state/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> updated_grid_nodes/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read_write> partial_summaries/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<workgroup> wg_active_grid_nodes/);
  assert.match(mlsMpmResidentSummaryWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(mlsMpmResidentSummaryFinalizeWgsl, /var<storage, read> partial_summaries/);
  assert.match(mlsMpmResidentSummaryFinalizeWgsl, /var<storage, read_write> resident_summary/);
  assert.match(mlsMpmResidentSummaryFinalizeWgsl, /@compute @workgroup_size\(1\)/);
});

test('schema sketches validate representative artifacts', () => {
  const provenance = createProvenanceBlock({
    sourceService: 'eshkol',
    methodHash: 'method',
    inputHash: 'input'
  });
  const serviceManifest = {
    serviceId: 'eshkol',
    version: '0.5.0-demo',
    runtime: 'js',
    entry: { workerModule: '/workers/eshkol.js' },
    childWorkers: { allowed: true, maxChildren: 2, allowedModules: ['/workers/child.js'], sameOriginOnly: true },
    resources: { maxWasmMemoryBytes: 1024 },
    capabilities: ['ulg.closure.derive'],
    abi: { ulgIrVersion: '0.5', gpuAbiVersion: '0.5', supportedDTypes: ['f32'], supportedLayouts: ['soa'] },
    validation: { requiresCpuReference: true, toleranceProfile: 'demo', parityModes: ['wasm-reference'] }
  };
  const taskCapsule = {
    taskId: 'task-1',
    rootTaskId: 'task-1',
    serviceId: 'eshkol',
    taskKind: 'eshkol.closure.derive',
    inputHash: 'input',
    methodHash: 'method',
    resources: { priority: 'simulation', gpu: 'optional' },
    validation: { mode: 'self', toleranceProfile: 'demo' },
    provenance
  };
  const closureArtifact = {
    closureId: 'closure-1',
    sourceService: 'eshkol',
    closureKind: 'demo',
    inputs: [],
    outputs: [],
    execution: {},
    validity: {},
    provenance
  };
  const quantumArtifact = {
    artifactId: 'quantum-1',
    sourceService: 'moonlab',
    taskKind: 'quantum.response',
    inputHash: 'input',
    method: 'demo',
    representation: 'state_vector',
    responseDescriptor: {
      schema: 'peercompute.ulg.quantum-response-descriptor.v0',
      sample: 'bell_phi_plus',
      qubitCount: 2,
      basis: { kind: 'computational', states: ['00', '01', '10', '11'] },
      representation: { state: 'state_vector', amplitudeDType: 'complex64' },
      deterministic: true,
      expectedProbabilities: [0.5, 0, 0, 0.5],
      observedProbabilities: [0.5, 0, 0, 0.5],
      invariants: { probabilitySum: 1, normalizationDelta: 0 }
    },
    outputs: {
      basisProbabilities: [0.5, 0, 0, 0.5],
      bellState: 'bell_phi_plus'
    },
    parity: {
      schema: 'peercompute.ulg.quantum-response-parity.v0',
      status: 'pass',
      reference: { mode: 'analytic-bell-phi-plus' },
      comparisons: [
        { mode: 'moonlab-wasm-core', status: 'pass', maxProbabilityError: 0 },
        { mode: 'moonlab-webgpu', status: 'unsupported', reason: 'moonlab-webgpu-response-kernel-unavailable' }
      ],
      metrics: { maxProbabilityError: 0, unsupportedModeCount: 1 }
    },
    validation: { status: 'pass' },
    provenance
  };
  const toleranceReport = createToleranceReport({
    status: 'pass',
    toleranceProfile: 'demo',
    metrics: { maxAbsError: 0 },
    provenance
  });
  const simulationArtifact = createSimulationArtifact({
    artifactId: 'simulation-1',
    closureRef: {
      uri: 'artifact://sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      artifactHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    },
    outputs: {
      deltas: [],
      invariants: { status: 'pass' }
    },
    execution: {
      backend: 'cpu-reference',
      dt: 0.002,
      steps: 1,
      integrator: 'velocity-verlet'
    },
    validity: { status: 'toy-reference-valid' },
    provenance
  });

  assertValid('compute_service_manifest.schema.json', serviceManifest);
  assertValid('task_capsule.schema.json', taskCapsule);
  assertValid('closure_artifact.schema.json', closureArtifact);
  assertValid('quantum_response_artifact.schema.json', quantumArtifact);
  assertValid('tolerance_report.schema.json', toleranceReport);
  assertValid('simulation_artifact.schema.json', simulationArtifact);
});

function assertValid(schemaFile, value) {
  const schema = JSON.parse(readFileSync(resolve('ulg-gpu-abi/src/schemas', schemaFile), 'utf8'));
  const validate = ajv.compile(schema);
  assert.equal(validate(value), true, JSON.stringify(validate.errors, null, 2));
}
