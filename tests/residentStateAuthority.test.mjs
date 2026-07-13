import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESIDENT_STATE_FAMILIES,
  ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA,
  ULG_RESIDENT_STATE_AUTHORITY_SUMMARY_SCHEMA,
  assertResidentStateAuthorityLedger,
  buildMlsMpmResidentStepAuthorityLedger,
  createResidentStateAuthorityLedger,
  summarizeResidentStateAuthorityLedger
} from '../src/runtime/residentStateAuthority.js';

test('resident authority ledger tracks authoritative state-family owners', () => {
  const ledger = createResidentStateAuthorityLedger({
    ledgerId: 'unit-test-ledger',
    step: 3,
    time: 0.125,
    entries: [
      {
        family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        ownerStage: 'g2p',
        backend: 'webgpu',
        reads: [RESIDENT_STATE_FAMILIES.GRID_UPDATE],
        writes: [RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS],
        nextConsumers: ['next-step']
      },
      {
        family: RESIDENT_STATE_FAMILIES.MECHANICS,
        ownerStage: 'g2p',
        backend: 'webgpu',
        reads: [RESIDENT_STATE_FAMILIES.GRID_UPDATE],
        writes: [RESIDENT_STATE_FAMILIES.MECHANICS],
        nextConsumers: ['next-p2g']
      }
    ]
  });

  assert.equal(ledger.schema, ULG_RESIDENT_STATE_AUTHORITY_LEDGER_SCHEMA);
  assert.equal(ledger.status, 'resident-authority-ledger-ready');
  assert.equal(ledger.familyCount, 2);
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'g2p');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].backend, 'webgpu');
  assertResidentStateAuthorityLedger(ledger, {
    requiredFamilies: [
      RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
      RESIDENT_STATE_FAMILIES.MECHANICS
    ]
  });

  const summary = summarizeResidentStateAuthorityLedger(ledger);
  assert.equal(summary.schema, ULG_RESIDENT_STATE_AUTHORITY_SUMMARY_SCHEMA);
  assert.equal(summary.ledgerId, 'unit-test-ledger');
  assert.equal(summary.familyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
});

test('resident authority assertion fails when required families are missing', () => {
  const ledger = createResidentStateAuthorityLedger({
    entries: [
      {
        family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        ownerStage: 'g2p'
      }
    ]
  });

  assert.throws(
    () => assertResidentStateAuthorityLedger(ledger, {
      requiredFamilies: [RESIDENT_STATE_FAMILIES.THERMO_PHASE]
    }),
    /Resident state authority missing families: thermo-phase/
  );
});

test('resident authority ledger warns on unknown state families without blocking known contracts', () => {
  const ledger = createResidentStateAuthorityLedger({
    entries: [
      {
        family: 'custom-law-cache',
        ownerStage: 'law-cache-worker',
        backend: 'cpu-worker'
      }
    ]
  });

  assert.equal(ledger.status, 'resident-authority-ledger-ready');
  assert.ok(ledger.warnings.includes('unknown-resident-state-family:custom-law-cache'));
  assert.equal(ledger.blockers.length, 0);
});

test('resident authority ledger blocks conflicting authoritative owners without replacing the first owner', () => {
  const ledger = createResidentStateAuthorityLedger({
    entries: [
      {
        family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        ownerStage: 'g2p',
        backend: 'webgpu'
      },
      {
        family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        ownerStage: 'reaction-step',
        backend: 'webgpu'
      }
    ]
  });

  assert.equal(ledger.status, 'resident-authority-ledger-blocked');
  assert.equal(
    ledger.familyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage,
    'g2p'
  );
  assert.deepEqual(ledger.blockers, [
    'resident-state-authority-conflict:particle-kinematics:g2p:reaction-step'
  ]);
  assert.throws(
    () => assertResidentStateAuthorityLedger(ledger),
    /Resident state authority blocked: resident-state-authority-conflict:particle-kinematics:g2p:reaction-step/
  );
});

test('resident authority ledger permits a same-owner metadata refresh', () => {
  const ledger = createResidentStateAuthorityLedger({
    entries: [
      {
        family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        ownerStage: 'g2p',
        status: 'submitted',
        backend: 'webgpu'
      },
      {
        family: RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS,
        ownerStage: 'g2p',
        status: 'completed',
        backend: 'webgpu'
      }
    ]
  });

  assert.equal(ledger.status, 'resident-authority-ledger-ready');
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.familyCount, 1);
  assert.equal(ledger.blockers.length, 0);
  assert.equal(
    ledger.familyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].status,
    'completed'
  );
});

test('MLS-MPM resident authority ledger preserves g2p ownership when reaction emits no particle mutation', () => {
  const ledger = buildMlsMpmResidentStepAuthorityLedger({
    step: 1,
    time: 0.1,
    readbackMode: 'no-full-readback',
    backend: 'webgpu',
    stageStatus: {
      p2g: 'webgpu-executed-no-full-readback',
      gridUpdate: 'webgpu-executed-no-full-readback',
      g2p: 'webgpu-executed-no-full-readback',
      reaction: 'reaction-no-op'
    },
    stageBackends: {
      p2g: 'webgpu',
      gridUpdate: 'webgpu',
      g2p: 'webgpu',
      reaction: 'webgpu'
    },
    reactionStep: { result: { status: 'reaction-no-op', backend: 'webgpu' } },
    reactionOutputParticleMutation: false,
    residentBuffersRetained: true
  });

  assert.equal(ledger.status, 'resident-authority-ledger-ready');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'g2p');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS].ownerStage, 'reaction-step');
  assert.ok(ledger.warnings.includes('reaction-no-op-not-particle-authority'));
  assert.ok(ledger.warnings.includes('cpu-mirrors-stale-unless-admitted-readback'));
});

test('MLS-MPM resident authority ledger warns when thermal state advances without mechanics refresh', () => {
  const ledger = buildMlsMpmResidentStepAuthorityLedger({
    step: 3,
    time: 0.3,
    readbackMode: 'no-full-readback',
    backend: 'webgpu',
    stageStatus: {
      p2g: 'webgpu-executed-no-full-readback',
      gridUpdate: 'webgpu-executed-no-full-readback',
      g2p: 'webgpu-executed-no-full-readback',
      thermal: 'thermal-step-executed'
    },
    stageBackends: {
      p2g: 'webgpu',
      gridUpdate: 'webgpu',
      g2p: 'webgpu',
      thermal: 'webgpu'
    },
    thermalStep: { status: 'thermal-step-executed', backend: 'webgpu' },
    nextUsesThermalState: true,
    nextUsesThermalThermo: true,
    residentBuffersRetained: true
  });

  assert.equal(ledger.status, 'resident-authority-ledger-ready');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage, 'thermal-phase-step');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].ownerStage, 'g2p');
  assert.ok(ledger.warnings.includes('mechanics-constitutive-refresh-pending-after-thermal-state'));
});

test('MLS-MPM resident authority ledger records resident product mass and gas pressure ownership', () => {
  const ledger = buildMlsMpmResidentStepAuthorityLedger({
    step: 2,
    time: 0.2,
    readbackMode: 'no-full-readback',
    backend: 'webgpu',
    stageStatus: {
      p2g: 'webgpu-executed-no-full-readback',
      gridUpdate: 'webgpu-executed-no-full-readback',
      g2p: 'webgpu-executed-no-full-readback'
    },
    stageBackends: {
      p2g: 'webgpu',
      gridUpdate: 'webgpu',
      g2p: 'webgpu',
      reaction: 'webgpu'
    },
    residentProductMass: {
      status: 'resident-product-mass-buffer-retained',
      productEventBufferRetained: true,
      gasSpeciesLedgerCount: 2,
      sealedBoxGasProductMoles: 0.75
    },
    residentBuffersRetained: true
  });

  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.REACTION_PRODUCTS].ownerStage, 'resident-product-mass-handle');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.GAS_PRESSURE].ownerStage, 'resident-gas-product-ledger');
  assert.equal(ledger.familyOwners[RESIDENT_STATE_FAMILIES.GAS_PRESSURE].status, 'resident-gas-species-ledger-authority');
});

test('MLS-MPM resident authority ledger adopts admitted Schroeder particle storage', () => {
  const ledger = buildMlsMpmResidentStepAuthorityLedger({
    step: 4,
    time: 0.4,
    readbackMode: 'no-full-readback',
    backend: 'webgpu',
    stageStatus: {
      p2g: 'webgpu-executed-no-full-readback',
      gridUpdate: 'webgpu-executed-no-full-readback',
      g2p: 'webgpu-executed-no-full-readback',
      schroederParticleStorageMaterialization: 'schroeder-particle-storage-materialization-submitted'
    },
    stageBackends: {
      p2g: 'webgpu',
      gridUpdate: 'webgpu',
      g2p: 'webgpu',
      schroederParticleStorageMaterialization: 'webgpu'
    },
    schroederParticleStorageAdoption: {
      status: 'schroeder-particle-storage-adopted',
      adopted: true,
      backend: 'webgpu',
      stateBuffer: { label: 'materialized-state' },
      thermoBuffer: { label: 'materialized-thermo' },
      mechanicsBuffer: { label: 'materialized-mechanics' }
    },
    nextUsesSchroederParticleStorageMaterialization: true,
    residentBuffersRetained: true
  });

  assert.equal(ledger.status, 'resident-authority-ledger-ready');
  assert.equal(
    ledger.familyOwners[RESIDENT_STATE_FAMILIES.SCHROEDER_PARTICLE_STORAGE].ownerStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(
    ledger.familyOwners[RESIDENT_STATE_FAMILIES.PARTICLE_KINEMATICS].ownerStage,
    'schroeder-particle-storage-materialization'
  );
  assert.equal(
    ledger.familyOwners[RESIDENT_STATE_FAMILIES.MECHANICS].status,
    'schroeder-particle-storage-materialized-mechanics-drives-next-particles'
  );
  assert.equal(
    ledger.familyOwners[RESIDENT_STATE_FAMILIES.THERMO_PHASE].status,
    'schroeder-particle-storage-materialized-thermo-drives-next-particles'
  );
});
