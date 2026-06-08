import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT,
  createClosureTableDescriptor,
  createClosureTableSampleBuffer,
  createClosureTableWgslDescriptor,
  createComplex64Vector,
  createProvenanceBlock,
  createSimulationArtifact,
  createTensorDescriptor,
  createToleranceReport,
  complex64ToPairs,
  ULG_CLOSURE_TABLE_WGSL_DESCRIPTOR_SCHEMA
} from '../ulg-gpu-abi/src/index.js';

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
