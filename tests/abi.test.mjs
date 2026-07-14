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
  SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_GPU_RENDER_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT,
  SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT,
  SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT,
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_DISPOSITION_IDS,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT,
  SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT,
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
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_REACTION_CLOSURE_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_COUPLING_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_PREVIEW_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
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
  sphReactionAtomResidualWgsl,
  sphReactionGasSpeciesSummaryWgsl,
  sphReactionProductEventCompactWgsl,
  sphReactionProductEventPlacementWgsl,
  sphReactionProductEventWgsl,
  sphReactionProductInventoryWgsl,
  sphReactionSummaryFinalizeWgsl,
  sphReactionSummaryPartialsWgsl,
  sphReactionStepWgsl,
  sphMaterialInterfaceCandidatesWgsl,
  sphRenderMarchingCubeCellsWgsl,
  sphRenderSurfaceDrawWgsl,
  sphRenderSurfaceVerticesWgsl,
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
  assert.equal(OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT.length, 16);
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
  assert.deepEqual(OPTICAL_GPU_LOOKUP_OUTPUT_ROW_LAYOUT.slice(12), [
    'opticalDepth:f32',
    'scatteringCoefficientPerM:f32',
    'absorptionCoefficientPerM:f32',
    'opticalStateId:f32'
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
  assert.equal(SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT[11], 'visualParticleRadiusM:f32');
});

test('SPH GPU thermal material table ABI exposes closure-derived row layouts', () => {
  assert.equal(ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-material-table.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-phase-response-table.v0');
  assert.equal(
    ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA,
    'peercompute.ulg.sph-gpu-thermal-response-graph-buffer-set.v0'
  );
  assert.equal(ULG_SPH_GPU_THERMAL_STEP_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-step.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_STEP_EXECUTION_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-step-execution.v0');
  assert.equal(ULG_SPH_GPU_THERMAL_STEP_PARITY_SCHEMA, 'peercompute.ulg.sph-gpu-thermal-step-parity.v0');
  // Record rows grew 4 -> 8 (still vec4-aligned) for radiative transfer: the
  // second vec4 carries the Kirchhoff gray emissivity derived from the
  // optical closure at table build (2026-07-10 radiation law).
  assert.equal(SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length, 8);
  assert.equal(SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT.length, 8);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_THERMAL_PHASE_SEGMENT_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_RECORD_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_THERMAL_PHASE_RESPONSE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_THERMAL_MATERIAL_RECORD_ROW_LAYOUT, [
    'materialId:f32',
    'segmentOffset:f32',
    'segmentCount:f32',
    'status:f32',
    'emissivityGray:f32',
    'radiationPad0:f32',
    'radiationPad1:f32',
    'radiationPad2:f32'
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
    'status:f32',
    'emissivityGray:f32',
    'radiationPad0:f32',
    'radiationPad1:f32',
    'radiationPad2:f32'
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
  // Event row4.w carries the products' specific internal energy (parent
  // energies + enthalpy share) since gas-product placement landed: the
  // placement kernel needs u to mint a real particle from an event.
  assert.equal(ULG_SPH_GPU_REACTION_TABLE_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-table.v1');
  assert.equal(ULG_REACTION_CLOSURE_SCHEMA, 'peercompute.ulg.reaction-closure.v0');
  assert.equal(ULG_SPH_GPU_REACTION_STEP_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-step.v0');
  assert.equal(ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-step-execution.v0');
  assert.equal(ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-step-parity.v0');
  assert.equal(SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length, 8);
  assert.equal(SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length, 8);
  assert.equal(SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length % 4, 0);
  assert.equal(SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length % 4, 0);
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
  assert.deepEqual(SPH_GPU_REACTION_HEADER_ROW_LAYOUT.slice(0, 8), [
    'reactionIndex:f32',
    'reactantTermOffset:f32',
    'reactantTermCount:f32',
    'productTermOffset:f32',
    'productTermCount:f32',
    'gasProductTermOffset:f32',
    'gasProductTermCount:f32',
    'specificEnthalpyJPerKg:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.slice(0, 8), [
    'reactionIndex:f32',
    'materialId:f32',
    'coefficient:f32',
    'molarMassKgPerMol:f32',
    'phaseMask:f32',
    'roleId:f32',
    'charge:f32',
    'stoichiometricMoles:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.slice(0, 8), [
    'reactionIndex:f32',
    'materialId:f32',
    'coefficient:f32',
    'molarMassKgPerMol:f32',
    'massFraction:f32',
    'routingId:f32',
    'targetPhasePolicyId:f32',
    'status:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.slice(0, 7), [
    'reactionIndex:f32',
    'productTermIndex:f32',
    'materialId:f32',
    'molesPerExtent:f32',
    'molarMassKgPerMol:f32',
    'pressureRoutingId:f32',
    'status:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT, [
    'reactionIndex:f32',
    'termKindId:f32',
    'termIndex:f32',
    'atomicNumberZ:f32',
    'atomsPerFormula:f32',
    'coefficient:f32',
    'charge:f32',
    'status:f32'
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
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.slice(8, 12), [
    'solidFlag:f32',
    'status:f32',
    'dynamicViscosityPaS:f32',
    'surfaceTensionNPerM:f32'
  ]);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(3\) var<storage, read> reaction_records/);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(5\) var<storage, read> phase_response_records/);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(6\) var<storage, read> phase_responses/);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(7\) var<storage, read_write> proposals/);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(12\) var<storage, read> thermal_graph_nodes/);
  assert.match(sphReactionStepWgsl, /@group\(0\) @binding\(13\) var<storage, read> thermal_graph_samples/);
  assert.match(sphReactionStepWgsl, /reactant_term_count: u32/);
  assert.match(sphReactionStepWgsl, /product_term_count: u32/);
  assert.match(sphReactionStepWgsl, /gas_product_count: u32/);
  assert.match(sphReactionStepWgsl, /fn reaction_header_row0/);
  assert.match(sphReactionStepWgsl, /let base = \(params\.reaction_count \+ params\.product_phase_count\) \* 3u/);
  assert.match(sphReactionStepWgsl, /fn reactant_term_for_material/);
  assert.match(sphReactionStepWgsl, /fn product_term_row0/);
  assert.match(sphReactionStepWgsl, /let product_base = reactant_base \+ params\.reactant_term_count \* 3u/);
  assert.doesNotMatch(sphReactionStepWgsl, /thermal_segments/);
  assert.match(sphReactionStepWgsl, /fn propose/);
  assert.match(sphReactionStepWgsl, /fn resolve/);
  assert.match(sphReactionStepWgsl, /@compute @workgroup_size\(64\)/);
  assert.equal(ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA, 'peercompute.ulg.sph-gpu-reaction-summary.v0');
  assert.equal(
    ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
    'peercompute.ulg.sph-gpu-reaction-gas-species-summary.v0'
  );
  assert.equal(
    ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
    'peercompute.ulg.sph-gpu-reaction-product-inventory.v0'
  );
  assert.equal(
    ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
    'peercompute.ulg.sph-gpu-reaction-product-event.v1'
  );
  assert.equal(
    ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
    'peercompute.ulg.sph-gpu-reaction-product-placement-summary.v0'
  );
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_EVENT_DISPOSITION_IDS, {
    invalidOrEmpty: 0,
    pending: 1,
    directOnly: 2,
    spareSlot: 3,
    radiusCaptureMerge: 4,
    fallbackMerge: 5,
    subthresholdUnplaced: 6,
    noCarrierUnplaced: 7,
    rejected: 8
  });
  assert.equal(
    ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
    'peercompute.ulg.sph-gpu-reaction-atom-residual.v0'
  );
  assert.equal(
    ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-reaction-summary-execution.v0'
  );
  assert.equal(SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT.length, 32);
  assert.equal(SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT.slice(0, 8), [
    'particleCount:f32',
    'reactionCount:f32',
    'productTermCount:f32',
    'gasProductCount:f32',
    'changedMaterialCount:f32',
    'changedMassCount:f32',
    'visibleProductMassKg:f32',
    'visibleGasProductMassKg:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT.slice(16, 24), [
    'canonicalReactionEventCount:f32',
    'consumedReactantMassKg:f32',
    'expectedProductMassKg:f32',
    'rawProductMassKg:f32',
    'ledgerVisibleProductMassKg:f32',
    'ledgerUnplacedProductMassKg:f32',
    'ledgerGasProductMassKg:f32',
    'ledgerVisibleGasProductMassKg:f32'
  ]);
  assert.equal(SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT.length, 8);
  assert.deepEqual(SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT, [
    'materialId:f32',
    'massKg:f32',
    'moles:f32',
    'visibleMassKg:f32',
    'unplacedMassKg:f32',
    'eventCount:f32',
    'gasProductIndex:f32',
    'status:f32'
  ]);
  assert.equal(SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT.length, 16);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT.slice(0, 8), [
    'materialId:f32',
    'massKg:f32',
    'visibleMassKg:f32',
    'unplacedMassKg:f32',
    'moles:f32',
    'eventCount:f32',
    'productTermIndex:f32',
    'reactionIndex:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT.slice(8, 16), [
    'routingId:f32',
    'chargeMol:f32',
    'massResidualKg:f32',
    'status:f32',
    'coefficient:f32',
    'molarMassKgPerMol:f32',
    'rawMassKg:f32',
    'massScale:f32'
  ]);
  assert.equal(SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length, 32);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.slice(0, 8), [
    'positionXM:f32',
    'positionYM:f32',
    'positionZM:f32',
    'massKg:f32',
    'materialId:f32',
    'productTermIndex:f32',
    'reactionIndex:f32',
    'sourceParticleIndex:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.slice(8, 16), [
    'partnerParticleIndex:f32',
    'moles:f32',
    'routingId:f32',
    'phaseId:f32',
    'placedMassKg:f32',
    'unplacedMassKg:f32',
    'coefficient:f32',
    'molarMassKgPerMol:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.slice(16, 20), [
    'temperatureK:f32',
    'restDensityKgPerM3:f32',
    'status:f32',
    'specificInternalEnergyJPerKg:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.slice(20, 24), [
    'velocityXMPerS:f32',
    'velocityYMPerS:f32',
    'velocityZMPerS:f32',
    'supportVolumeM3:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.slice(24, 32), [
    'effectiveBulkModulusPa:f32',
    'shearModulusPa:f32',
    'lameLambdaPa:f32',
    'soundSpeedMPerS:f32',
    'eosModelId:f32',
    'solidFlag:f32',
    'mechanicsStatus:f32',
    'dispositionId:f32'
  ]);
  assert.equal(SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT.length, 32);
  assert.equal(SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT.slice(0, 16), [
    'materialId:f32',
    'productTermIndex:f32',
    'reactionIndex:f32',
    'routingId:f32',
    'phaseId:f32',
    'status:f32',
    'readyProductEventCount:f32',
    'placementCandidateEventCount:f32',
    'directPlacedEventCount:f32',
    'sparePlacedEventCount:f32',
    'captureMergedEventCount:f32',
    'fallbackMergedEventCount:f32',
    'unplacedEventCount:f32',
    'subthresholdEventCount:f32',
    'rejectedEventCount:f32',
    'reserved0:f32'
  ]);
  assert.deepEqual(SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT.slice(16, 32), [
    'readyProductMassKg:f32',
    'directPlacedMassKg:f32',
    'sparePlacedMassKg:f32',
    'captureMergedMassKg:f32',
    'fallbackMergedMassKg:f32',
    'unplacedMassKg:f32',
    'subthresholdMassKg:f32',
    'rejectedMassKg:f32',
    'maxSparePlacedEventMassKg:f32',
    'maxMergedEventMassKg:f32',
    'maxPostMergeParticleMassKg:f32',
    'maxUnplacedEventMassKg:f32',
    'maxCaptureDistanceM:f32',
    'maxFallbackDistanceM:f32',
    'maxSparePlacedSupportRadiusM:f32',
    'maxReadyProductEventMassKg:f32'
  ]);
  assert.equal(SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT.length, 8);
  assert.deepEqual(SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT, [
    'reactionIndex:f32',
    'atomicNumberZ:f32',
    'atomResidualMol:f32',
    'chargeResidualMol:f32',
    'eventCount:f32',
    'termKindId:f32',
    'termIndex:f32',
    'status:f32'
  ]);
  assert.match(sphReactionSummaryPartialsWgsl, /struct ReactionSummaryParams/);
  assert.match(sphReactionSummaryPartialsWgsl, /reactant_term_count: u32/);
  assert.match(sphReactionSummaryPartialsWgsl, /product_term_count: u32/);
  assert.match(sphReactionSummaryPartialsWgsl, /gas_product_count: u32/);
  assert.match(sphReactionSummaryPartialsWgsl, /has_proposals: u32/);
  assert.match(sphReactionSummaryPartialsWgsl, /@group\(0\) @binding\(4\) var<storage, read> reaction_records/);
  assert.match(sphReactionSummaryPartialsWgsl, /@group\(0\) @binding\(7\) var<storage, read> proposals/);
  assert.match(sphReactionSummaryPartialsWgsl, /let product_base = reactant_base \+ params\.reactant_term_count \* 3u/);
  assert.match(sphReactionSummaryPartialsWgsl, /fn gas_product_term_match/);
  assert.match(sphReactionSummaryPartialsWgsl, /fn reactant_term_for_material/);
  assert.match(sphReactionSummaryPartialsWgsl, /wg_ledger_unplaced_gas_product_mass/);
  assert.match(sphReactionSummaryPartialsWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(sphReactionSummaryFinalizeWgsl, /@group\(0\) @binding\(0\) var<storage, read> partial_summaries/);
  assert.match(sphReactionSummaryFinalizeWgsl, /reaction_summary\[7u\] = vec4<f32>/);
  assert.match(sphReactionSummaryFinalizeWgsl, /f32\(params\.gas_product_count\)/);
  assert.match(sphReactionGasSpeciesSummaryWgsl, /@group\(0\) @binding\(5\) var<storage, read> proposals/);
  assert.match(sphReactionGasSpeciesSummaryWgsl, /fn gas_product_row0/);
  assert.match(sphReactionGasSpeciesSummaryWgsl, /fn reactant_term_for_material/);
  assert.match(sphReactionGasSpeciesSummaryWgsl, /gas_species_summaries\[out_base\]/);
  assert.match(sphReactionGasSpeciesSummaryWgsl, /let species_moles = species_mass \/ molar_mass/);
  assert.match(sphReactionProductInventoryWgsl, /@group\(0\) @binding\(6\) var<storage, read_write> product_inventory/);
  assert.match(sphReactionProductInventoryWgsl, /fn product_term_row3/);
  assert.match(sphReactionProductInventoryWgsl, /let unplaced_mass_kg = max\(mass_kg - visible_mass_kg, 0\.0\)/);
  assert.match(sphReactionProductInventoryWgsl, /moles \* charge/);
  assert.match(sphReactionProductEventWgsl, /@group\(0\) @binding\(6\) var<storage, read_write> product_events/);
  assert.match(sphReactionProductEventWgsl, /let particle_index = linear_index \/ params\.product_term_count/);
  assert.match(sphReactionProductEventWgsl, /let product_term_index = linear_index - particle_index \* params\.product_term_count/);
  assert.match(sphReactionProductEventWgsl, /let out_base = linear_index \* 8u/);
  assert.match(sphReactionProductEventWgsl, /struct ProductMechanics/);
  assert.match(sphReactionProductEventWgsl, /fn product_mechanics_for/);
  assert.match(sphReactionProductEventWgsl, /fn resolved_product_phase_id/);
  assert.match(sphReactionProductEventWgsl, /fn product_term_index_for_parent_slot/);
  assert.match(sphReactionProductEventWgsl, /let source_free = source_remaining/);
  assert.match(sphReactionProductEventWgsl, /product_term_index_for_parent_slot\(reaction_index, 0u\) == product_term_index/);
  assert.match(sphReactionProductEventWgsl, /let partner_parent_slot = select\(0u, 1u, source_free\)/);
  assert.doesNotMatch(sphReactionProductEventWgsl, /visible_mass_kg = visible_mass_kg \+/);
  assert.match(sphReactionProductEventWgsl, /product_events\[out_base \+ 2u\] = vec4<f32>\(f32\(partner_index\), row_moles, routing_id, phase_id\)/);
  assert.match(sphReactionProductEventWgsl, /let event_ready = phase_id > 0\.0/);
  assert.match(sphReactionProductEventWgsl, /select\(0\.0, 1\.0, event_ready\)/);
  assert.match(sphReactionProductEventWgsl, /product_events\[out_base \+ 5u\] = vec4<f32>\(product_velocity\.x, product_velocity\.y, product_velocity\.z, support_volume_m3\)/);
  assert.match(sphReactionProductEventWgsl, /product_events\[out_base \+ 7u\] = vec4<f32>/);
  assert.match(sphReactionProductEventWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(sphReactionProductEventCompactWgsl, /mechanics_status != 1\.0/);
  assert.match(sphReactionProductEventCompactWgsl, /!\(phase_id > 0\.0\)/);
  assert.match(sphReactionProductEventCompactWgsl, /!\(rest_density > 0\.0\)/);
  assert.match(sphReactionProductEventCompactWgsl, /if \(stride < 8u\)/);
  assert.doesNotMatch(sphReactionProductEventCompactWgsl, /max\(params\.row_stride_vec4, 8u\)/);
  assert.match(sphReactionProductEventPlacementWgsl, /event_row7_header\.z != 1\.0/);
  assert.match(sphReactionProductEventPlacementWgsl, /!\(event_row2_header\.w > 0\.0\)/);
  assert.match(sphReactionProductEventPlacementWgsl, /!\(row4\.y > 0\.0\)/);
  assert.match(sphReactionProductEventPlacementWgsl, /product_term_count: u32/);
  assert.match(sphReactionProductEventPlacementWgsl, /@group\(0\) @binding\(5\) var<storage, read_write> placement_summary/);
  assert.match(sphReactionProductEventPlacementWgsl, /return product_term_index \* 8u/);
  assert.match(sphReactionProductEventPlacementWgsl, /fn record_ready_product/);
  assert.match(sphReactionProductEventPlacementWgsl, /fn record_spare_placement/);
  assert.match(sphReactionProductEventPlacementWgsl, /fn record_capture_merge/);
  assert.match(sphReactionProductEventPlacementWgsl, /fn record_fallback_merge/);
  assert.match(sphReactionProductEventPlacementWgsl, /fn record_unplaced/);
  assert.match(sphReactionProductEventPlacementWgsl, /fn record_rejected_placement/);
  assert.match(
    sphReactionProductEventPlacementWgsl,
    /let rejected_payload_mass_kg = max\(event_product_mass_kg, unplaced_mass_kg\)/
  );
  assert.match(
    sphReactionProductEventPlacementWgsl,
    /record_rejected_placement\(summary_base, rejected_payload_mass_kg\)/
  );
  assert.match(
    sphReactionProductEventPlacementWgsl,
    /product_events\[base \+ 4u\] = vec4<f32>\(row4\.x, row4\.y, 0\.0, row4\.w\)/
  );
  for (const dispositionId of [2, 3, 4, 5, 6, 7, 8]) {
    assert.match(
      sphReactionProductEventPlacementWgsl,
      new RegExp(`event_row7_header\\.xyz, ${dispositionId}\\.0`)
    );
  }
  assert.match(sphReactionAtomResidualWgsl, /atom_term_count: u32/);
  assert.match(sphReactionAtomResidualWgsl, /@group\(0\) @binding\(4\) var<storage, read_write> atom_residuals/);
  assert.match(sphReactionAtomResidualWgsl, /fn atom_term_row/);
  assert.match(sphReactionAtomResidualWgsl, /charge_residual_mol/);
  assert.match(sphReactionAtomResidualWgsl, /@compute @workgroup_size\(1\)/);
});

test('SPH GPU render rows ABI exposes compact render-state rows', () => {
  assert.equal(ULG_SPH_GPU_RENDER_ROWS_SCHEMA, 'peercompute.ulg.sph-gpu-render-rows.v0');
  assert.equal(
    ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-rows-execution.v0'
  );
  // 16 -> 20: phaseFractionSolid + vec4-alignment pads (tri-phase render
  // weighting so transition-boundary particles morph between phase surfaces).
  assert.equal(SPH_GPU_RENDER_ROW_LAYOUT.length, 20);
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
    'renderDomainId:f32',
    'currentVolumeM3:f32',
    'particleRadiusM:f32',
    'volumeRatioJ:f32',
    'pressurePa:f32',
    'phaseFractionSolid:f32',
    // Splash-shard dispersion: the former pads carry particle velocity.
    'velocityXMPerS:f32',
    'velocityYMPerS:f32',
    'velocityZMPerS:f32'
  ]);
  assert.match(sphRenderRowsWgsl, /struct RenderRowsParams/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(0\) var<storage, read> sph_state/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(1\) var<storage, read> sph_thermo/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> render_rows/);
  assert.match(sphRenderRowsWgsl, /@group\(0\) @binding\(4\) var<storage, read> mls_mpm_mechanics/);
  assert.match(sphRenderRowsWgsl, /@compute @workgroup_size\(64\)/);
});

test('SPH GPU render field ABI exposes material-phase surface fields', () => {
  assert.equal(ULG_SPH_GPU_RENDER_FIELD_SCHEMA, 'peercompute.ulg.sph-gpu-render-field.v1');
  assert.equal(
    ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
    'peercompute.ulg.sph-material-interface-source-field.v0'
  );
  assert.equal(
    ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
    'peercompute.ulg.sph-material-interface-candidate-field.v0'
  );
  assert.equal(
    ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-material-interface-candidate-field-execution.v0'
  );
  assert.equal(ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA, 'peercompute.ulg.sph-material-interface-field.v0');
  assert.equal(ULG_SPH_PRESSURE_INTERFACE_COUPLING_SCHEMA, 'peercompute.ulg.sph-pressure-interface-coupling.v0');
  assert.equal(
    ULG_SPH_PRESSURE_INTERFACE_FORCE_PREVIEW_SCHEMA,
    'peercompute.ulg.sph-pressure-interface-force-preview.v0'
  );
  assert.equal(
    ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
    'peercompute.ulg.sph-pressure-interface-force-solver.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-field-execution.v1'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
    'peercompute.ulg.sph-gpu-render-marching-cube-cells.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-marching-cube-cells-execution.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    'peercompute.ulg.sph-gpu-render-surface-vertices.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-surface-vertices-execution.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    'peercompute.ulg.sph-gpu-render-surface-draw.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
    'peercompute.ulg.sph-gpu-render-surface-draw-execution.v0'
  );
  assert.equal(
    ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    'peercompute.ulg.sph-gpu-render-surface-draw-indirect.v0'
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
    'radiusNormOrNegativeParticleRadiusScale:f32',
    'colorLinearR:f32',
    'colorLinearG:f32',
    'colorLinearB:f32',
    'renderDomainId:f32',
    'opticalStateId:f32',
    'pad1:f32',
    'pad2:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT, [
    'density:f32',
    'paletteLinearR:f32',
    'paletteLinearG:f32',
    'paletteLinearB:f32',
    'temperatureK:f32',
    'reserved0:f32',
    'reserved1:f32',
    'reserved2:f32'
  ]);
  assert.equal(SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT.slice(0, 8), [
    'surfaceIndex:f32',
    'materialId:f32',
    'phaseId:f32',
    'voxelLinearIndex:f32',
    'centerXM:f32',
    'centerYM:f32',
    'centerZM:f32',
    'cellSizeM:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT.slice(8), [
    'cornerMask:f32',
    'edgeCrossingCount:f32',
    'reservedTriangleCount:f32',
    'reservedVertexCount:f32',
    'densityMin:f32',
    'densityMax:f32',
    'isolation:f32',
    'status:f32'
  ]);
  assert.equal(SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.slice(0, 8), [
    'surfaceIndex:f32',
    'materialId:f32',
    'phaseId:f32',
    'triangleIndex:f32',
    'vertexIndex:f32',
    'positionXM:f32',
    'positionYM:f32',
    'positionZM:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.slice(8), [
    'normalX:f32',
    'normalY:f32',
    'normalZ:f32',
    'opticalStateId:f32',
    'density:f32',
    'isolation:f32',
    'sourceVoxelLinearIndex:f32',
    'status:f32'
  ]);
  assert.equal(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.slice(0, 8), [
    'surfaceIndex:f32',
    'materialId:f32',
    'phaseId:f32',
    'opticalStateId:f32',
    'vertexOffset:f32',
    'vertexCount:f32',
    'triangleOffset:f32',
    'triangleCount:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.slice(8), [
    'renderOrder:f32',
    'transparencyClassId:f32',
    'depthWriteFlag:f32',
    'status:f32',
    'boundsCenterXM:f32',
    'boundsCenterYM:f32',
    'boundsCenterZM:f32',
    'boundsRadiusM:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT, [
    'vertexCount:u32',
    'instanceCount:u32',
    'firstVertex:u32',
    'firstInstance:u32'
  ]);
  assert.equal(SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length, 16);
  assert.equal(SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.slice(0, 8), [
    'surfaceIndex:f32',
    'materialId:f32',
    'phaseId:f32',
    'axisId:f32',
    'centroidXM:f32',
    'centroidYM:f32',
    'centroidZM:f32',
    'areaM2:f32'
  ]);
  assert.deepEqual(SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.slice(8), [
    'normalX:f32',
    'normalY:f32',
    'normalZ:f32',
    'normalAreaXM2:f32',
    'normalAreaYM2:f32',
    'normalAreaZM2:f32',
    'crossingSign:f32',
    'status:f32'
  ]);
  assert.equal(SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT.length, 16);
  assert.equal(SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT, SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT);
  assert.equal(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length, 16);
  assert.equal(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.slice(0, 8), [
    'surfaceIndex:f32',
    'materialId:f32',
    'phaseId:f32',
    'axisId:f32',
    'centroidXM:f32',
    'centroidYM:f32',
    'centroidZM:f32',
    'areaM2:f32'
  ]);
  assert.deepEqual(SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.slice(8), [
    'materialForceXN:f32',
    'materialForceYN:f32',
    'materialForceZN:f32',
    'gasReactionForceXN:f32',
    'gasReactionForceYN:f32',
    'gasReactionForceZN:f32',
    'pressurePa:f32',
    'status:f32'
  ]);
  assert.match(sphRenderFieldWgsl, /struct RenderFieldParams/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(0\) var<storage, read> render_rows/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(1\) var<storage, read> render_surfaces/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> render_field_cells/);
  assert.match(sphRenderFieldWgsl, /product_event_count: u32/);
  assert.match(sphRenderFieldWgsl, /@group\(0\) @binding\(4\) var<storage, read> product_events/);
  assert.match(sphRenderFieldWgsl, /fn product_event_row3/);
  assert.match(sphRenderFieldWgsl, /event_unplaced_mass_kg <= 0\.0/);
  assert.match(sphRenderFieldWgsl, /fn render_row3/);
  assert.match(sphRenderFieldWgsl, /particle_radius_scale = select\(0\.0, -s2\.x, s2\.x < 0\.0\)/);
  assert.match(sphRenderFieldWgsl, /particle_radius_norm_scale = particle_radius_scale \* span \/ ref_edge/);
  assert.match(sphRenderFieldWgsl, /row3\.y \* particle_radius_norm_scale/);
  assert.match(sphRenderFieldWgsl, /material_id/);
  assert.match(sphRenderFieldWgsl, /phase_id/);
  assert.match(sphMaterialInterfaceCandidatesWgsl, /struct InterfaceCandidateParams/);
  assert.match(sphMaterialInterfaceCandidatesWgsl, /@group\(0\) @binding\(0\) var<storage, read> render_surfaces/);
  assert.match(sphMaterialInterfaceCandidatesWgsl, /@group\(0\) @binding\(1\) var<storage, read> render_field_cells/);
  assert.match(sphMaterialInterfaceCandidatesWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> interface_candidates/);
  assert.match(sphMaterialInterfaceCandidatesWgsl, /local_candidate_index \/ 3u/);
  assert.match(sphMaterialInterfaceCandidatesWgsl, /field_offset \* 3u \+ local_candidate_index/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /struct MarchingCubesCandidateParams/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /@group\(0\) @binding\(0\) var<storage, read> render_surfaces/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /@group\(0\) @binding\(1\) var<storage, read> render_field_cells/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> marching_cubes_candidates/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /corner_mask/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /edge_crossing_count/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /reserved_triangle_count/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /cell_is_active/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /select\(0\.0, 12\.0, cell_is_active\)/);
  assert.match(sphRenderSurfaceVerticesWgsl, /struct SurfaceVertexParams/);
  assert.match(sphRenderSurfaceVerticesWgsl, /@group\(0\) @binding\(0\) var<storage, read> render_surfaces/);
  assert.match(sphRenderSurfaceVerticesWgsl, /@group\(0\) @binding\(1\) var<storage, read> render_field_cells/);
  assert.match(sphRenderSurfaceVerticesWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> surface_vertices/);
  assert.match(sphRenderSurfaceVerticesWgsl, /fn sv_emit_tetra/);
  assert.match(sphRenderSurfaceVerticesWgsl, /\(field_offset \+ local_voxel_index\) \* 36u/);
  assert.match(sphRenderSurfaceDrawWgsl, /struct SurfaceDrawParams/);
  assert.match(sphRenderSurfaceDrawWgsl, /@group\(0\) @binding\(0\) var<storage, read> render_surfaces/);
  assert.match(sphRenderSurfaceDrawWgsl, /@group\(0\) @binding\(1\) var<storage, read> source_surface_vertices/);
  assert.match(sphRenderSurfaceDrawWgsl, /@group\(0\) @binding\(2\) var<storage, read_write> compact_surface_vertices/);
  assert.match(sphRenderSurfaceDrawWgsl, /@group\(0\) @binding\(3\) var<storage, read_write> surface_draw_rows/);
  assert.match(sphRenderSurfaceDrawWgsl, /@group\(0\) @binding\(5\) var<storage, read_write> surface_draw_indirect_rows: array<vec4<u32>>/);
  assert.match(sphRenderSurfaceDrawWgsl, /explicit_transparency_class_id = surface_row3\.z/);
  assert.match(sphRenderSurfaceDrawWgsl, /explicit_depth_write_flag = surface_row3\.w/);
  assert.match(sphRenderSurfaceDrawWgsl, /prefix_vertex_count/);
  assert.match(sphRenderSurfaceDrawWgsl, /surface_is_active/);
  assert.match(sphRenderSurfaceDrawWgsl, /sd_write_compact_vertex/);
  assert.match(sphRenderSurfaceDrawWgsl, /sd_write_draw_indirect_row/);
  assert.match(sphRenderFieldWgsl, /@compute @workgroup_size\(64, 1, 1\)/);
  assert.match(sphRenderMarchingCubeCellsWgsl, /@compute @workgroup_size\(64, 1, 1\)/);
  assert.match(sphRenderSurfaceVerticesWgsl, /@compute @workgroup_size\(64, 1, 1\)/);
  assert.match(sphRenderSurfaceDrawWgsl, /@compute @workgroup_size\(1, 1, 1\)/);
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
  assert.deepEqual(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.slice(28, 32), [
    'hydrostaticPressurePa:f32',
    'dynamicViscosityPaS:f32',
    'surfaceTensionNPerM:f32',
    'phaseVolumeReferenceMassKg:f32'
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
  assert.match(mlsMpmP2gGridProjectionWgsl, /var<storage, read_write> grid_accumulators: array<atomic<i32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(6\) var<storage, read_write> grid_nodes: array<vec4<f32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /resident_product_event_count: u32/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(5\) var<storage, read> product_events: array<vec4<f32>>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@group\(0\) @binding\(8\) var<storage, read> schroeder_active_nodes: array<f32>/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn quadratic_weights/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn packed_pressure/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn corotated_stress/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn scatter_product_events/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /fn finalize_grid/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /event_unplaced_mass_kg <= 0.0/);
  assert.match(mlsMpmP2gGridProjectionWgsl, /@compute @workgroup_size\(64\)/);
  assert.doesNotMatch(mlsMpmP2gGridProjectionWgsl, /for \(var particle_index = 0u; particle_index < params\.particle_count/);
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
  assert.match(mlsMpmGridUpdateWgsl, /pressure_force_row_count: u32/);
  assert.match(
    mlsMpmGridUpdateWgsl,
    /@group\(0\) @binding\(3\) var<storage, read> pressure_force_rows: array<vec4<f32>>/
  );
  assert.match(mlsMpmGridUpdateWgsl, /fn grid_update_quadratic_weights/);
  assert.match(mlsMpmGridUpdateWgsl, /momentum = momentum \+ params\.dt \* weight \* force_row2\.xyz/);
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
  assert.match(mlsMpmG2pReconstructWgsl, /@group\(0\) @binding\(7\) var<storage, read> schroeder_level_assignments: array<f32>/);
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
  assert.equal(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.length, 84);
  assert.equal(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.length % 4, 0);
  assert.deepEqual(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.slice(0, 4), [
    'particleCount:f32',
    'gridNodeCount:f32',
    'activeGridNodeCount:f32',
    'sourceMassKg:f32'
  ]);
  assert.deepEqual(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.slice(32, 38), [
    'sourceCenterOfMassXM:f32',
    'sourceCenterOfMassYM:f32',
    'sourceCenterOfMassZM:f32',
    'nextCenterOfMassXM:f32',
    'nextCenterOfMassYM:f32',
    'nextCenterOfMassZM:f32'
  ]);
  assert.deepEqual(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.slice(44, 54), [
    'nextMinXM:f32',
    'nextMinYM:f32',
    'nextMinZM:f32',
    'nextMaxXM:f32',
    'nextMaxYM:f32',
    'nextMaxZM:f32',
    'sourcePositionBoundsStatus:f32',
    'nextPositionBoundsStatus:f32',
    'sourcePositionMassKg:f32',
    'nextPositionMassKg:f32'
  ]);
  assert.deepEqual(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.slice(56, 64), [
    'cohortSummaryStatus:f32',
    'baseCohortStartIndex:f32',
    'baseCohortEndIndex:f32',
    'dropCohortStartIndex:f32',
    'dropCohortEndIndex:f32',
    'baseCohortNextMassKg:f32',
    'baseCohortNextCenterXM:f32',
    'baseCohortNextCenterYM:f32'
  ]);
  assert.deepEqual(MLS_MPM_GPU_RESIDENT_SUMMARY_ROW_LAYOUT.slice(72, 83), [
    'dropCohortNextMassKg:f32',
    'dropCohortNextCenterXM:f32',
    'dropCohortNextCenterYM:f32',
    'dropCohortNextCenterZM:f32',
    'dropCohortNextMinXM:f32',
    'dropCohortNextMinYM:f32',
    'dropCohortNextMinZM:f32',
    'dropCohortNextMaxXM:f32',
    'dropCohortNextMaxYM:f32',
    'dropCohortNextMaxZM:f32',
    'dropCohortMaxSpeedMPerS:f32'
  ]);
  assert.match(mlsMpmResidentSummaryWgsl, /struct ResidentSummaryParams/);
  assert.equal(mlsMpmResidentSummaryWgsl, mlsMpmResidentSummaryPartialsWgsl);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> source_sph_state/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> next_sph_state/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> next_sph_thermo/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read> updated_grid_nodes/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<storage, read_write> partial_summaries/);
  assert.match(mlsMpmResidentSummaryWgsl, /wg_phase_mass_solid/);
  assert.match(mlsMpmResidentSummaryWgsl, /wg_temperature_mass_sum/);
  assert.match(mlsMpmResidentSummaryWgsl, /var<workgroup> wg_active_grid_nodes/);
  assert.match(mlsMpmResidentSummaryWgsl, /@compute @workgroup_size\(32\)/);
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
