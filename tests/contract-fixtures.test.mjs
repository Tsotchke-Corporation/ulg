import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  ULG_TASK_KINDS,
  createUlgServiceManifest,
  createUlgTaskCapsule,
  getUlgServiceContract
} from '../ulg-gpu-abi/src/serviceContract.js';

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
      childWorkers: {
        allowedModules: fixture.childWorkers.allowedModules
      },
      validation: {
        toleranceProfile: fixture.validation.toleranceProfile
      }
    });

    assert.deepEqual(built.capabilities, fixture.capabilities);
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
