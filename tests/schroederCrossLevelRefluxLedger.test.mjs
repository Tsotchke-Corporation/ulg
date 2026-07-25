import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS,
  SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED,
  SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY,
  SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED,
  createSchroederCrossLevelRefluxLedgerHeader,
  createSchroederCrossLevelRefluxLedgerLayout,
  deriveSchroederCrossLevelRefluxEnergyClosure,
  decodeSchroederCrossLevelRefluxEvidence
} from '../ulg-gpu-abi/src/schroederCrossLevelRefluxLedger.js';
import {
  createSchroederCrossLevelRefluxLedgerGpu,
  validateSchroederCrossLevelRefluxLedgerGpuOwnership
} from '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js';

function fakeDevice() {
  return {
    limits: {
      maxBufferSize: 16 * 1024 * 1024,
      maxStorageBufferBindingSize: 16 * 1024 * 1024
    },
    createBuffer(descriptor) {
      return {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
    },
    queue: { writeBuffer() {} }
  };
}

test('reflux-v3 header round-trips pressure, drag, ambient, provenance, and measured scales', () => {
  assert.equal(SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS, 136);
  assert.equal(SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT.length, 136);
  assert.equal(
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT[126],
    'operatorSplitSynchronizationWorkJ:f32-bits'
  );
  assert.equal(
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT[127],
    'operatorSplitSynchronizationWorkConditioningSumAbsJ:f32-bits'
  );
  assert.deepEqual(
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT.slice(128),
    [
      'fineCrossLevelPressureCompensationJ:f32-bits',
      'coarseCrossLevelPressureCompensationJ:f32-bits',
      'fineCrossLevelDragHeatJ:f32-bits',
      'coarseCrossLevelDragHeatJ:f32-bits',
      'cumulativeAmbientImpulseXNs:f32-bits',
      'cumulativeAmbientImpulseYNs:f32-bits',
      'cumulativeAmbientImpulseZNs:f32-bits',
      'cumulativeAmbientExternalWorkJ:f32-bits'
    ]
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS, 18);
  const layout = createSchroederCrossLevelRefluxLedgerLayout({
    parentFieldCapacity: 7,
    coarseFieldCapacity: 5
  });
  assert.equal(
    layout.rowOffsetWords,
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
  );
  assert.equal(
    layout.wordLength,
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
      + 5 * SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS
  );
  const words = new Uint32Array(layout.wordLength);
  words.set(createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 5,
    completionOrdinal: 17,
    fineSubstepCount: 4,
    fineLevel: 2,
    coarseLevel: 3,
    coarseGridSpacingM: 0.125,
    macroOwnerId: 29,
    macroOwnerGeneration: 31
  }));
  const floats = new Float32Array(words.buffer);
  words[2] = SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED;
  words[4] = 5;
  words[8] = 4;
  words[15] = 4;
  words[61] = 8;
  words[62] = 9;
  words[63] = 2;
  for (let word = 64; word <= 76; word += 1) words[word] = 100 + word;
  words[80] = SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED;
  words[81] = 0x1234abcd;
  floats[84] = 4.5;
  floats[85] = 9.5;
  floats[86] = 10.5;
  floats[87] = 11.5;
  floats[88] = 12.5;
  floats[89] = 13.5;
  floats[90] = 0.001;
  floats[91] = 27;
  floats[92] = 0.002;
  floats[93] = 28;
  words[94] = 41;
  words[95] = 0xc001c0de;
  words[96] = 1;
  words[97] = 5;
  words[99] = 1;
  words[100] = 1;
  words[101] = 1;
  words[102] = 1;
  words[103] = 1;
  words[108] = 2;
  words[109] = 3;
  words[110] = 4;
  words[111] = 0x10203040;
  floats[112] = 1.25;
  floats[113] = 2.25;
  floats[114] = 1.25;
  floats[115] = 2.25;
  floats[116] = 3.25;
  floats[117] = 3.25;
  words[118] = 1;
  words[119] = 1;
  words[120] = 4;
  words[121] = 1;
  floats[126] = -0.75;
  floats[127] = 2.5;
  floats[128] = -0.125;
  floats[129] = 0.25;
  floats[130] = 0.5;
  floats[131] = 0.75;
  floats[132] = 1.5;
  floats[133] = -2.5;
  floats[134] = 3.5;
  floats[135] = 4.5;

  const decoded = decodeSchroederCrossLevelRefluxEvidence(words);
  assert.equal(decoded.structuralValid, true);
  assert.equal(decoded.admitted, true);
  assert.equal(decoded.magic, SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC);
  assert.equal(decoded.abiVersion, SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION);
  assert.equal(decoded.committedFineSubstepCount, 4);
  assert.equal(decoded.consumedFineSubstepCount, 4);
  assert.equal(decoded.fineSubstepCount, 4);
  assert.equal(decoded.macroOwnerId, 29);
  assert.equal(decoded.macroOwnerGeneration, 31);
  assert.equal(decoded.terminalReceiptState, SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED);
  assert.equal(decoded.terminalReceiptToken, 0x1234abcd);
  assert.equal(decoded.particleConsumedHeatJ, 4.5);
  assert.equal(decoded.measuredScale.massSumAbsKg, 9.5);
  assert.equal(decoded.measuredScale.contributionCount, 41);
  assert.equal(decoded.publicationToken, 0xc001c0de);
  assert.equal(decoded.terminalG2pConsumeCount, 1);
  assert.equal(decoded.capturedOperationCount, 5);
  assert.equal(decoded.expectedOperationCount, 5);
  assert.deepEqual(decoded.receiptRejectCount, {
    replay: 2,
    skip: 3,
    duplicate: 4
  });
  assert.equal(decoded.transactionMutationToken, 0x10203040);
  assert.equal(decoded.heatSplit.cumulativeFineRouteHeatJ, 1.25);
  assert.equal(decoded.heatSplit.coarseDeferredRouteHeatJ, 2.25);
  assert.equal(decoded.fineReceiptConsumeCount, 4);
  assert.equal(decoded.coarseReceiptConsumeCount, 1);
  assert.deepEqual(decoded.operatorSplit, {
    synchronizationWorkJ: -0.75,
    synchronizationConditioningSumAbsJ: 2.5,
    synchronizationToleranceJ: 1024 * 2 ** -24 * 2.5,
    valid: true
  });
  assert.deepEqual(decoded.phaseVolumeTransport, {
    fineCrossLevelPressureCompensationJ: -0.125,
    coarseCrossLevelPressureCompensationJ: 0.25,
    fineCrossLevelDragHeatJ: 0.5,
    coarseCrossLevelDragHeatJ: 0.75,
    toleranceJ: 1024 * 2 ** -24 * 4.75,
    valid: true
  });
  assert.deepEqual(decoded.ambientBoundary, {
    cumulativeImpulseNs: [1.5, -2.5, 3.5],
    cumulativeExternalWorkJ: 4.5,
    valid: true
  });
  assert.deepEqual(decoded.finalIdentity, {
    generationId: 164,
    deviceOrdinal: 165,
    laneOrdinal: 166,
    leaseToken: 167,
    sourceFamilyId: 168,
    storageGeneration: 169,
    physicsTick: 170,
    physicsSubstep: 171,
    positionEpoch: 172,
    topologyEpoch: 173,
    chartEpoch: 174,
    levelEpoch: 175,
    supportEpoch: 176
  });
});

test('reflux-v3 r=2 energy seal separates pressure, drag, and synchronization work', () => {
  const closure = deriveSchroederCrossLevelRefluxEnergyClosure({
    fineKineticEnergyDeltaJ: -0.008227603510022163,
    virtualCoarseKineticEnergyDeltaJ: 0.001635174616239965,
    actualCoarseKineticEnergyDeltaJ: 0.002498876303434372,
    cumulativeFineRouteHeatJ: 0.0058620525524020195,
    fineCrossLevelPressureCompensationJ: 0.000075,
    coarseCrossLevelPressureCompensationJ: 0.000125,
    fineCrossLevelDragHeatJ: 0.001,
    coarseCrossLevelDragHeatJ: 0.0001,
    actualCoarseEnergyConditioningSumAbsJ: 0.0029828576371073723,
    virtualCoarseEnergyConditioningSumAbsJ: 0.001635174616239965
  });
  assert.equal(closure.valid, true, JSON.stringify(closure));
  assert.equal(closure.causalValid, true, JSON.stringify(closure));
  assert.equal(closure.operatorSplitValid, true, JSON.stringify(closure));
  assert.equal(closure.totalValid, true, JSON.stringify(closure));
  assert.ok(
    Math.abs(closure.synchronizationWorkJ - 0.0008637015707790852)
      <= 2 ** -30,
    JSON.stringify(closure)
  );
  assert.ok(closure.coarseDeferredRouteHeatJ > 0.0005, JSON.stringify(closure));
  assert.equal(
    closure.pressureCompensationJ,
    Math.fround(Math.fround(0.000075) + Math.fround(0.000125))
  );
  assert.ok(
    Math.abs(closure.totalEnergyResidualJ)
      <= closure.totalEnergyToleranceJ,
    JSON.stringify(closure)
  );

  const actualBasisPhysicalHeat = Math.fround(Math.max(
    0,
    -Math.fround(
      closure.fineKineticEnergyDeltaJ
        + closure.actualCoarseKineticEnergyDeltaJ
    )
  ));
  const oldDeferredUnclamped = Math.fround(
    actualBasisPhysicalHeat - closure.cumulativeFineRouteHeatJ
  );
  assert.ok(oldDeferredUnclamped < -1.3e-4, JSON.stringify({
    closure,
    actualBasisPhysicalHeat,
    oldDeferredUnclamped
  }));
});

test('reflux-v3 constructors and decoder reject malformed ranges and undersized evidence', () => {
  assert.throws(() => createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 1,
    fineSubstepCount: 0
  }), /fineSubstepCount/);
  assert.throws(() => createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 1,
    fineLevel: 4,
    coarseLevel: 6
  }), /coarseLevel/);
  assert.throws(() => createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 1,
    coarseGridSpacingM: Number.POSITIVE_INFINITY
  }), /coarseGridSpacingM/);
  assert.throws(() => createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: 1,
    macroOwnerGeneration: 0
  }), /macroOwnerGeneration/);
  assert.throws(() => createSchroederCrossLevelRefluxLedgerHeader({
    rowCapacity: '1'
  }), /rowCapacity/);
  assert.throws(() => createSchroederCrossLevelRefluxLedgerLayout({
    parentFieldCapacity: 0xffff_ffff,
    coarseFieldCapacity: 0xffff_ffff
  }), /u32 word range/);
  assert.equal(
    decodeSchroederCrossLevelRefluxEvidence(
      new Uint32Array(SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS - 1)
    ),
    null
  );
  const malformed = new Uint32Array(
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
      + SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS
  );
  malformed.set(createSchroederCrossLevelRefluxLedgerHeader({ rowCapacity: 1 }));
  malformed[0] = 0;
  malformed[2] = SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED;
  assert.equal(decodeSchroederCrossLevelRefluxEvidence(malformed).structuralValid, false);
  assert.equal(decodeSchroederCrossLevelRefluxEvidence(malformed).admitted, false);
  malformed.set(createSchroederCrossLevelRefluxLedgerHeader({ rowCapacity: 1 }));
  malformed[2] = SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED;
  malformed[4] = 2;
  assert.equal(decodeSchroederCrossLevelRefluxEvidence(malformed).structuralValid, false);
  assert.equal(decodeSchroederCrossLevelRefluxEvidence(malformed).admitted, false);
  malformed.set(createSchroederCrossLevelRefluxLedgerHeader({ rowCapacity: 1 }));
  malformed[2] = SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED;
  assert.equal(decodeSchroederCrossLevelRefluxEvidence(malformed).admitted, false);
});

test('reflux-v3 GPU ownership survives module reloads but rejects foreign, cloned, mutated, undersized, and destroyed ledgers', async () => {
  const device = fakeDevice();
  const ledger = createSchroederCrossLevelRefluxLedgerGpu(device, {
    parentFieldCapacity: 3,
    coarseFieldCapacity: 2,
    completionOrdinal: 7,
    fineSubstepCount: 2,
    fineLevel: 0,
    coarseLevel: 1,
    coarseGridSpacingM: 0.5
  });
  assert.equal(validateSchroederCrossLevelRefluxLedgerGpuOwnership(device, ledger, {
    minimumCoarseFieldCapacity: 2,
    fineSubstepCount: 2,
    fineLevel: 0,
    coarseLevel: 1,
    coarseGridSpacingM: 0.5
  }), true);
  const reloadedOwnership = await import(
    '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js?reflux-owner-reload'
  );
  assert.equal(
    reloadedOwnership.validateSchroederCrossLevelRefluxLedgerGpuOwnership(
      device,
      ledger,
      {
        minimumCoarseFieldCapacity: 2,
        fineSubstepCount: 2,
        fineLevel: 0,
        coarseLevel: 1,
        coarseGridSpacingM: 0.5
      }
    ),
    true
  );
  assert.equal(validateSchroederCrossLevelRefluxLedgerGpuOwnership(
    fakeDevice(), ledger
  ), false);
  assert.equal(validateSchroederCrossLevelRefluxLedgerGpuOwnership(
    device, { ...ledger }
  ), false);
  const descriptorClone = Object.create(
    Object.getPrototypeOf(ledger),
    Object.getOwnPropertyDescriptors(ledger)
  );
  assert.equal(
    reloadedOwnership.validateSchroederCrossLevelRefluxLedgerGpuOwnership(
      device,
      descriptorClone
    ),
    false
  );
  ledger.ownerGeneration += 1;
  assert.equal(
    reloadedOwnership.validateSchroederCrossLevelRefluxLedgerGpuOwnership(
      device,
      ledger
    ),
    false
  );
  ledger.ownerGeneration -= 1;
  const originalSize = ledger.buffer.size;
  ledger.buffer.size = ledger.byteLength - 4;
  assert.equal(validateSchroederCrossLevelRefluxLedgerGpuOwnership(device, ledger), false);
  ledger.buffer.size = originalSize;
  ledger.rowCapacity += 1;
  assert.equal(validateSchroederCrossLevelRefluxLedgerGpuOwnership(device, ledger), false);
  ledger.rowCapacity -= 1;
  assert.equal(ledger.destroy(), true);
  assert.equal(validateSchroederCrossLevelRefluxLedgerGpuOwnership(device, ledger), false);
});
