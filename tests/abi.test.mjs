import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  createClosureTableDescriptor,
  createComplex64Vector,
  createProvenanceBlock,
  createTensorDescriptor,
  createToleranceReport,
  complex64ToPairs
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
    outputs: {},
    validation: {},
    provenance
  };
  const toleranceReport = createToleranceReport({
    status: 'pass',
    toleranceProfile: 'demo',
    metrics: { maxAbsError: 0 },
    provenance
  });

  assertValid('compute_service_manifest.schema.json', serviceManifest);
  assertValid('task_capsule.schema.json', taskCapsule);
  assertValid('closure_artifact.schema.json', closureArtifact);
  assertValid('quantum_response_artifact.schema.json', quantumArtifact);
  assertValid('tolerance_report.schema.json', toleranceReport);
});

function assertValid(schemaFile, value) {
  const schema = JSON.parse(readFileSync(resolve('ulg-gpu-abi/src/schemas', schemaFile), 'utf8'));
  const validate = ajv.compile(schema);
  assert.equal(validate(value), true, JSON.stringify(validate.errors, null, 2));
}
