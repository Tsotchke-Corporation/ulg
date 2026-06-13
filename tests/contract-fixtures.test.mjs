import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  ULG_SERVICE_IDS,
  ULG_TASK_KINDS,
  createUlgServiceManifest,
  createUlgTaskCapsule,
  getUlgServiceContract
} from '../ulg-gpu-abi/src/serviceContract.js';
import { createSphPhaseRebuildTask, createSphStaticTableCacheTask } from '../src/runtime/demoRuntime.js';

const ajv = new Ajv2020({ strict: false });
const fixtureDir = resolve('ulg-gpu-abi/examples');
const schemaDir = resolve('ulg-gpu-abi/src/schemas');

test('published ULG adapter fixtures validate against package schemas', () => {
  assertFixture('compute_service_manifest.schema.json', 'eshkol-service-manifest.json');
  assertFixture('compute_service_manifest.schema.json', 'moonlab-service-manifest.json');
  assertFixture('task_capsule.schema.json', 'eshkol-task-capsule.json');
  assertFixture('task_capsule.schema.json', 'moonlab-task-capsule.json');
});

test('service-contract builders reproduce fixture defaults', () => {
  const eshkol = readFixture('eshkol-service-manifest.json');
  const moonlab = readFixture('moonlab-service-manifest.json');

  for (const fixture of [eshkol, moonlab]) {
    const built = createUlgServiceManifest({
      serviceId: fixture.serviceId,
      version: fixture.version,
      runtime: fixture.runtime,
      workerModule: fixture.entry.workerModule,
      loaderModule: fixture.entry.loaderModule,
      wasmModule: fixture.entry.wasmModule,
      serviceAssets: fixture.entry.serviceAssets,
      childWorkers: {
        allowedModules: fixture.childWorkers.allowedModules
      },
      validation: {
        toleranceProfile: fixture.validation.toleranceProfile
      }
    });

    assert.deepEqual(built.capabilities, fixture.capabilities);
    assert.deepEqual(built.entry, fixture.entry);
    assert.deepEqual(built.taskKinds, fixture.taskKinds);
    assert.deepEqual(built.abi, fixture.abi);
    assert.deepEqual(built.resources, fixture.resources);
    assert.deepEqual(built.validation, fixture.validation);
  }
});

test('task capsule builder emits schema-compatible default service capsules', () => {
  const moonlabContract = getUlgServiceContract('moonlab');
  assert.equal(moonlabContract.taskKinds[0], ULG_TASK_KINDS.quantumResponse);

  const capsule = createUlgTaskCapsule({
    taskId: 'contract-moonlab-task',
    serviceId: 'moonlab',
    inputHash: 'ulg:test-input',
    methodHash: 'ulg:test-method',
    provenance: {
      sourceService: 'moonlab',
      methodHash: 'ulg:test-method',
      inputHash: 'ulg:test-input',
      codeVersion: 'contract-test',
      deterministicSeed: 'contract-test-seed',
      createdAt: '2026-06-05T00:00:00.000Z',
      notes: ['schema-compatible builder output']
    }
  });

  assert.equal(capsule.taskKind, ULG_TASK_KINDS.quantumResponse);
  assert.deepEqual(capsule.outputs, [{ artifactKind: 'quantum-response' }]);
  assertValid('task_capsule.schema.json', capsule);
});

test('ULG runtime service contract emits simulation-step capsules', () => {
  const runtimeContract = getUlgServiceContract(ULG_SERVICE_IDS.ulgRuntime);
  assert.deepEqual(runtimeContract.taskKinds, [
    ULG_TASK_KINDS.simulationStep,
    ULG_TASK_KINDS.sphPhaseRebuild,
    ULG_TASK_KINDS.sphStaticTableCache,
    ULG_TASK_KINDS.closureConsume
  ]);
  assert.deepEqual(runtimeContract.capabilities, [
    'ulg.simulation.step',
    'ulg.sph.phase.rebuild',
    'ulg.sph.static-table-cache',
    'ulg.closure.consume',
    'ulg.invariants.reference'
  ]);
  assert.equal(runtimeContract.outputArtifactKind, 'simulation-delta');

  const manifest = createUlgServiceManifest({
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    runtime: 'js',
    workerModule: '/src/services/ulgRuntime.worker.js',
    childWorkers: { allowed: false, maxChildren: 0, allowedModules: [] },
    validation: {
      toleranceProfile: 'toy-carrier-reference',
      parityModes: ['cpu-reference', 'cpu-webgpu']
    }
  });
  assert.deepEqual(manifest.validation.parityModes, ['cpu-reference', 'cpu-webgpu']);
  assertValid('compute_service_manifest.schema.json', manifest);

  const capsule = createUlgTaskCapsule({
    taskId: 'contract-ulg-runtime-task',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    input: {
      closureRef: { uri: 'artifact://sha256:fixture' },
      steps: 4,
      backendPreference: ['webgpu', 'cpu-reference']
    },
    method: {
      serviceId: ULG_SERVICE_IDS.ulgRuntime,
      taskKind: ULG_TASK_KINDS.simulationStep,
      backend: 'webgpu-or-cpu-reference',
      backendPreference: ['webgpu', 'cpu-reference']
    },
    resources: { gpu: 'optional', gpuMemoryBytes: 1024 * 1024 },
    validation: { mode: 'cpu-webgpu', toleranceProfile: 'toy-carrier-reference' }
  });
  assert.equal(capsule.taskKind, ULG_TASK_KINDS.simulationStep);
  assert.deepEqual(capsule.outputs, [{ artifactKind: 'simulation-delta' }]);
  assert.equal(capsule.input.steps, 4);
  assert.deepEqual(capsule.input.backendPreference, ['webgpu', 'cpu-reference']);
  assert.equal(capsule.method.backend, 'webgpu-or-cpu-reference');
  assert.deepEqual(capsule.method.backendPreference, ['webgpu', 'cpu-reference']);
  assert.equal(capsule.validation.mode, 'cpu-webgpu');
  assertValid('task_capsule.schema.json', capsule);

  const sphTask = createSphPhaseRebuildTask({
    dropMaterial: 'Li',
    baseMaterial: 'h2o',
    dropParticleEdge: 2,
    baseParticleEdge: 2
  });
  assert.equal(sphTask.serviceId, ULG_SERVICE_IDS.ulgRuntime);
  assert.equal(sphTask.taskKind, ULG_TASK_KINDS.sphPhaseRebuild);
  assert.deepEqual(sphTask.outputs, [{ artifactKind: 'sph-phase-rebuild-view-state' }]);
  assert.equal(sphTask.method.backend, 'supervised-cpu-worker');
  assert.equal(sphTask.resources.priority, 'background');
  assert.equal(sphTask.input.options.dropMaterial, 'Li');
  assert.equal(sphTask.input.options.baseMaterial, 'h2o');
  assertValid('task_capsule.schema.json', sphTask);

  const sphCachedTask = createSphPhaseRebuildTask({
    dropMaterial: 'Na',
    baseMaterial: 'h2o',
    __cacheLookup: { materialCacheSnapshot: '{"schema":"material"}' },
    __cachePersistence: { coldStartCacheSnapshot: '{"schema":"cold"}' },
    __staticTableCache: { cacheSnapshot: '{"schema":"static"}' }
  });
  assert.equal(sphCachedTask.input.options.dropMaterial, 'Na');
  assert.equal(sphCachedTask.input.options.__cacheLookup, undefined);
  assert.equal(sphCachedTask.input.cacheLookup.materialCacheSnapshot, '{"schema":"material"}');
  assert.equal(sphCachedTask.input.cachePersistence.coldStartCacheSnapshot, '{"schema":"cold"}');
  assert.equal(sphCachedTask.input.staticTableCache.cacheSnapshot, '{"schema":"static"}');
  assertValid('task_capsule.schema.json', sphCachedTask);

  const staticCacheTask = createSphStaticTableCacheTask({
    cacheSnapshot: null,
    tableInputs: {},
    generatorFingerprint: 'contract-generator'
  });
  assert.equal(staticCacheTask.serviceId, ULG_SERVICE_IDS.ulgRuntime);
  assert.equal(staticCacheTask.taskKind, ULG_TASK_KINDS.sphStaticTableCache);
  assert.deepEqual(staticCacheTask.outputs, [{ artifactKind: 'sph-static-table-cache' }]);
  assert.equal(staticCacheTask.method.backend, 'supervised-cpu-worker');
  assert.equal(staticCacheTask.resources.priority, 'background');
  assert.equal(staticCacheTask.resources.gpu, 'none');
  assert.equal(staticCacheTask.input.mode, 'update');
  assert.equal(staticCacheTask.input.generatorFingerprint, 'contract-generator');
  assertValid('task_capsule.schema.json', staticCacheTask);

  const staticReadTask = createSphStaticTableCacheTask({
    mode: 'rehydrate',
    cacheSnapshot: '{"schema":"example"}',
    tableInputs: { ignored: true },
    generatorFingerprint: 'contract-generator'
  });
  assert.equal(staticReadTask.taskKind, ULG_TASK_KINDS.sphStaticTableCache);
  assert.equal(staticReadTask.input.mode, 'rehydrate');
  assert.equal(staticReadTask.input.cacheSnapshot, '{"schema":"example"}');
  assert.deepEqual(staticReadTask.input.tableInputs, {});
  assert.ok(staticReadTask.provenance.notes.includes('static-table-cache-rehydration-offloaded-from-ui-thread'));
  assertValid('task_capsule.schema.json', staticReadTask);
});

function assertFixture(schemaFile, fixtureFile) {
  assertValid(schemaFile, readFixture(fixtureFile));
}

function assertValid(schemaFile, value) {
  const schema = JSON.parse(readFileSync(resolve(schemaDir, schemaFile), 'utf8'));
  const validate = ajv.compile(schema);
  assert.equal(validate(value), true, JSON.stringify(validate.errors, null, 2));
}

function readFixture(fixtureFile) {
  return JSON.parse(readFileSync(resolve(fixtureDir, fixtureFile), 'utf8'));
}
