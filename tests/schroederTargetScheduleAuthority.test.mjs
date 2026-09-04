import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS,
  SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION,
  SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINT_REVISION,
  ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
  ULG_SCHROEDER_TARGET_SCHEDULE_CONFIGURATION_SCHEMA,
  ULG_SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINTS_SCHEMA,
  ULG_SCHROEDER_TARGET_SCHEDULE_WRITER_SET_SCHEMA,
  createSchroederTargetScheduleAuthority,
  createSchroederTargetScheduleConfiguration,
  createSchroederTargetScheduleProviderAuthority,
  createSchroederTargetScheduleTableFingerprints,
  createSchroederTargetScheduleWriterSet,
  exactSchroederTargetScheduleAuthority,
  exactSchroederTargetScheduleConfiguration,
  exactSchroederTargetScheduleTableFingerprints,
  exactSchroederTargetScheduleWriterSet,
  schroederTargetScheduleWriterSetMatchesActivation
} from '../src/runtime/sph/schroederTargetScheduleAuthority.js';

const PROVIDER = createSchroederTargetScheduleProviderAuthority({
  kind: 'none'
});
const COMMON_CONFIGURATION = Object.freeze({
  maxFutureSubsteps: 2,
  dtS: 0.001,
  gridSpacingM: 0.25,
  cflFactor: 0.4,
  boxDimsM: Object.freeze([5, 5, 5])
});
const SOURCE_LINEAGE = Object.freeze({
  storageGeneration: 1,
  physicsTick: 2,
  physicsSubstep: 0,
  positionEpoch: 3,
  topologyEpoch: 4,
  chartEpoch: 5,
  levelEpoch: 6,
  supportEpoch: 7
});

function opticalInputs({
  closureWord = 4,
  seedWord = 8,
  source = 'fixture'
} = {}) {
  return {
    closure: {
      schema:
        'peercompute.ulg.sph-dispersed-medium-optical-closure-table.v0',
      status: 'dispersed-medium-optical-closure-table-ready',
      rowCount: 1,
      rows: new Float32Array([1, 2, 3, closureWord]),
      metadata: [{ source }]
    },
    seed: {
      schema: 'peercompute.ulg.sph-dispersed-medium-optics.v0',
      status: 'dispersed-medium-optics-seed-ready',
      rowCount: 1,
      rows: new Float32Array([1, 2, 3, 1, seedWord, 0, 0, 0]),
      routeDeclarations: [{ opticalStateId: 3, source }]
    }
  };
}

function residentStepOptions(inputs = opticalInputs()) {
  return {
    ambientPressurePa: 0,
    contactSolverEnabled: false,
    dispersedMediumOpticalClosureTable: inputs.closure,
    dispersedMediumOpticsSeedRows: inputs.seed
  };
}

function configuration(inputs = opticalInputs()) {
  return createSchroederTargetScheduleConfiguration({
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(inputs),
    scheduleStepOptionsProvider: PROVIDER
  });
}

function authority(inputs = opticalInputs()) {
  return createSchroederTargetScheduleAuthority({
    sourceScheduleId: 'schedule:source',
    targetScheduleRequestId: 'schedule:target',
    laneId: 'lane:optics',
    stateKey: 'state:optics',
    sourceLineage: SOURCE_LINEAGE,
    sourceParticleCount: 8,
    sourcePhaseLaneCount: 1,
    ...COMMON_CONFIGURATION,
    residentStepOptions: residentStepOptions(inputs),
    scheduleStepOptionsProvider: PROVIDER
  });
}

test('dispersed-medium optics is an exact writer and activation field', () => {
  const inputs = opticalInputs();
  const writerSet = createSchroederTargetScheduleWriterSet({
    residentStepOptions: residentStepOptions(inputs),
    scheduleStepOptionsProvider: PROVIDER
  });

  assert.equal(
    ULG_SCHROEDER_TARGET_SCHEDULE_WRITER_SET_SCHEMA,
    'peercompute.ulg.schroeder-target-schedule-writer-set.v1'
  );
  assert.ok(
    SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS.includes(
      'dispersedMediumOptics'
    )
  );
  assert.equal(writerSet.dispersedMediumOptics, true);
  assert.equal(writerSet.contactSolver, false);
  assert.equal(writerSet.thermal, false);
  assert.equal(writerSet.mechanicsFieldViews, false);
  assert.deepEqual(writerSet.writerIds, ['dispersed-medium-optics']);
  assert.ok(exactSchroederTargetScheduleWriterSet(structuredClone(writerSet)));

  const activation = Object.fromEntries(
    SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS.map(
      (field) => [field, writerSet[field]]
    )
  );
  assert.equal(
    schroederTargetScheduleWriterSetMatchesActivation(writerSet, activation),
    true
  );
  activation.dispersedMediumOptics = false;
  assert.equal(
    schroederTargetScheduleWriterSetMatchesActivation(writerSet, activation),
    false
  );

  const closureOnly = createSchroederTargetScheduleWriterSet({
    residentStepOptions: {
      dispersedMediumOpticalClosureTable: inputs.closure
    },
    scheduleStepOptionsProvider: PROVIDER
  });
  const seedOnly = createSchroederTargetScheduleWriterSet({
    residentStepOptions: { dispersedMediumOpticsSeedRows: inputs.seed },
    scheduleStepOptionsProvider: PROVIDER
  });
  const neither = createSchroederTargetScheduleWriterSet({
    scheduleStepOptionsProvider: PROVIDER
  });
  assert.equal(closureOnly.dispersedMediumOptics, true);
  assert.equal(seedOnly.dispersedMediumOptics, true);
  assert.equal(neither.dispersedMediumOptics, false);

  const stale = structuredClone(writerSet);
  stale.schema = 'peercompute.ulg.schroeder-target-schedule-writer-set.v0';
  assert.equal(exactSchroederTargetScheduleWriterSet(stale), null);
});

test('optical closure and seed fingerprints cover exact clone-safe content', () => {
  const inputs = opticalInputs();
  const baseline = createSchroederTargetScheduleTableFingerprints({
    residentStepOptions: residentStepOptions(inputs)
  });

  assert.equal(
    ULG_SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINTS_SCHEMA,
    'peercompute.ulg.schroeder-target-schedule-table-fingerprints.v4'
  );
  assert.equal(
    SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINT_REVISION,
    'shader-bound-typed-array-content-layout-count-and-domain-sha256-v6'
  );
  assert.match(
    baseline.dispersedMediumOpticalClosureTable,
    /^sha256:schroeder-dispersed-medium-optical-closure-table-v2:/
  );
  assert.match(
    baseline.dispersedMediumOpticsSeedRows,
    /^sha256:schroeder-dispersed-medium-optics-seed-rows-v1:/
  );
  assert.ok(
    exactSchroederTargetScheduleTableFingerprints(structuredClone(baseline))
  );

  const changedClosureInputs = opticalInputs({ closureWord: 5 });
  const changedClosure = createSchroederTargetScheduleTableFingerprints({
    residentStepOptions: residentStepOptions(changedClosureInputs)
  });
  assert.notEqual(
    changedClosure.dispersedMediumOpticalClosureTable,
    baseline.dispersedMediumOpticalClosureTable
  );
  assert.equal(
    changedClosure.dispersedMediumOpticsSeedRows,
    baseline.dispersedMediumOpticsSeedRows
  );

  const changedSeedInputs = opticalInputs({ seedWord: 9 });
  const changedSeed = createSchroederTargetScheduleTableFingerprints({
    residentStepOptions: residentStepOptions(changedSeedInputs)
  });
  assert.equal(
    changedSeed.dispersedMediumOpticalClosureTable,
    baseline.dispersedMediumOpticalClosureTable
  );
  assert.notEqual(
    changedSeed.dispersedMediumOpticsSeedRows,
    baseline.dispersedMediumOpticsSeedRows
  );

  const changedMetadataInputs = opticalInputs({ source: 'changed' });
  const changedMetadata = createSchroederTargetScheduleTableFingerprints({
    residentStepOptions: residentStepOptions(changedMetadataInputs)
  });
  assert.notEqual(
    changedMetadata.dispersedMediumOpticalClosureTable,
    baseline.dispersedMediumOpticalClosureTable
  );
  assert.notEqual(
    changedMetadata.dispersedMediumOpticsSeedRows,
    baseline.dispersedMediumOpticsSeedRows
  );

  const directTypedSeed = createSchroederTargetScheduleTableFingerprints({
    residentStepOptions: {
      dispersedMediumOpticsSeedRows: new Float32Array([1, 2, 3, 4])
    }
  });
  assert.ok(
    exactSchroederTargetScheduleTableFingerprints(
      structuredClone(directTypedSeed)
    )
  );

  const stale = structuredClone(baseline);
  stale.schema =
    'peercompute.ulg.schroeder-target-schedule-table-fingerprints.v3';
  stale.revision =
    'shader-bound-typed-array-content-layout-count-and-domain-sha256-v5';
  assert.equal(exactSchroederTargetScheduleTableFingerprints(stale), null);
});

test('configuration and authority seal optical closure and seed identity', () => {
  const inputs = opticalInputs();
  const sealedConfiguration = configuration(inputs);
  const sealedAuthority = authority(inputs);

  assert.equal(
    ULG_SCHROEDER_TARGET_SCHEDULE_CONFIGURATION_SCHEMA,
    'peercompute.ulg.schroeder-target-schedule-configuration.v1'
  );
  assert.equal(
    ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
    'peercompute.ulg.schroeder-target-schedule-authority.v6'
  );
  assert.equal(
    SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION,
    'main-thread-next-schedule-request-prospective-writer-transition-sha256-v10'
  );
  assert.ok(
    exactSchroederTargetScheduleConfiguration(
      structuredClone(sealedConfiguration)
    )
  );
  assert.ok(
    exactSchroederTargetScheduleAuthority(structuredClone(sealedAuthority))
  );
  assert.equal(sealedAuthority.writerSet.dispersedMediumOptics, true);

  const changedClosureAuthority = authority(
    opticalInputs({ closureWord: 5 })
  );
  const changedSeedAuthority = authority(opticalInputs({ seedWord: 9 }));
  assert.notEqual(
    changedClosureAuthority.requestFingerprint,
    sealedAuthority.requestFingerprint
  );
  assert.notEqual(
    changedSeedAuthority.requestFingerprint,
    sealedAuthority.requestFingerprint
  );
  assert.equal(
    changedClosureAuthority.tableFingerprints.dispersedMediumOpticsSeedRows,
    sealedAuthority.tableFingerprints.dispersedMediumOpticsSeedRows
  );
  assert.equal(
    changedSeedAuthority.tableFingerprints
      .dispersedMediumOpticalClosureTable,
    sealedAuthority.tableFingerprints.dispersedMediumOpticalClosureTable
  );

  const tamperedConfiguration = structuredClone(sealedConfiguration);
  tamperedConfiguration.writerSet.dispersedMediumOptics = false;
  assert.equal(
    exactSchroederTargetScheduleConfiguration(tamperedConfiguration),
    null
  );
  const tamperedAuthority = structuredClone(sealedAuthority);
  tamperedAuthority.tableFingerprints.dispersedMediumOpticsSeedRows = null;
  tamperedAuthority.tableFingerprints.dispersedMediumOpticalClosureTable = null;
  assert.equal(exactSchroederTargetScheduleAuthority(tamperedAuthority), null);

  const staleConfiguration = structuredClone(sealedConfiguration);
  staleConfiguration.schema =
    'peercompute.ulg.schroeder-target-schedule-configuration.v0';
  assert.equal(
    exactSchroederTargetScheduleConfiguration(staleConfiguration),
    null
  );
  const staleAuthority = structuredClone(sealedAuthority);
  staleAuthority.schema =
    'peercompute.ulg.schroeder-target-schedule-authority.v5';
  staleAuthority.authorityRevision =
    'main-thread-next-schedule-request-prospective-writer-transition-sha256-v9';
  assert.equal(exactSchroederTargetScheduleAuthority(staleAuthority), null);
});
