import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  abortSchroederFineMicroepochAfter,
  abortSchroederTwoLevelMacroAuthorityAfter,
  createSchroederCanonicalParticleContinuation,
  createSchroederFineMicroepochAuthority,
  createSchroederFusedFineSubstepMutationPlan,
  createSchroederFusedFineSubstepTransaction,
  createSchroederTwoLevelMacroAuthority,
  discardSchroederFusedFineSubstepTransaction,
  markSchroederFusedFineSubstepStageSubmissionObserved,
  markSchroederFusedFineSubstepStageSubmitted,
  quarantineSchroederFusedFineSubstepTransaction,
  schroederFusedFineSubstepTransactionState,
  validateSchroederCanonicalParticleContinuation,
  validateSchroederFineMicroepochAuthority,
  validateSchroederFusedFineSubstepTransaction,
  validateSchroederTwoLevelMacroAuthority
} from '../src/runtime/sph/schroederFusedFineSubstepGpu.js';
import {
  createSchroederCrossLevelRefluxLedgerGpu
} from '../src/runtime/sph/schroederSpatialParentFieldMechanicsWorkspaceGpu.js';

const TEST_STAGE_PRODUCER_VALIDATORS = Object.freeze(Object.fromEntries(
  ['p2g', 'grid-update', 'fine-correction', 'g2p'].map(
    (stage) => [stage, () => true]
  )
));

function sequenceRuntime({ retireFailureCount = 0 } = {}) {
  let ordinal = 0;
  let encoding = SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY;
  let pending = null;
  let publicationLock = null;
  let quarantined = false;
  let released = false;
  const owners = new WeakMap();
  const lockOwners = new WeakMap();
  return {
    ownsExecution() { return !released; },
    isExecutionSubmitted() { return !released; },
    stateMutationState() {
      return {
        ordinal,
        encoding,
        operation: 'test',
        pending: pending != null,
        publicationLocked: publicationLock != null,
        quarantined
      };
    },
    acquireStatePublicationLock(execution, { owner = null } = {}) {
      assert.equal(publicationLock, null);
      assert.equal(pending, null);
      assert.equal(quarantined, false);
      const lock = Object.freeze({ execution, owner });
      publicationLock = lock;
      lockOwners.set(lock, { execution, status: 'active' });
      return lock;
    },
    isStatePublicationLockActive(execution, lock) {
      return publicationLock === lock
        && lockOwners.get(lock)?.execution === execution
        && lockOwners.get(lock)?.status === 'active';
    },
    discardStatePublicationLock(execution, lock) {
      assert.equal(this.isStatePublicationLockActive(execution, lock), true);
      assert.equal(pending, null);
      assert.equal(ordinal, 0);
      assert.equal(
        encoding,
        SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY
      );
      lockOwners.get(lock).status = 'discarded';
      publicationLock = null;
      return true;
    },
    reserveStateMutationSequence(execution, options) {
      assert.equal(pending, null);
      assert.equal(options.expectedOrdinal, ordinal);
      assert.equal(options.expectedEncoding, encoding);
      assert.equal(options.publicationLock, publicationLock);
      let nextOrdinal = ordinal;
      let nextEncoding = encoding;
      const sequence = {
        execution,
        expectedOrdinal: ordinal,
        outputOrdinal: null,
        expectedEncoding: encoding,
        outputEncoding: null,
        stages: null
      };
      sequence.stages = Object.freeze(options.stages.map((stage, stageIndex) => {
        const segment = Object.freeze({
          execution,
          stageIndex,
          expectedOrdinal: nextOrdinal,
          outputOrdinal: nextOrdinal + 1,
          expectedEncoding: nextEncoding,
          outputEncoding: stage.outputEncoding,
          mutationCount: 1,
          operation: stage.operation
        });
        nextOrdinal += 1;
        nextEncoding = stage.outputEncoding;
        return segment;
      }));
      sequence.outputOrdinal = nextOrdinal;
      sequence.outputEncoding = nextEncoding;
      Object.freeze(sequence);
      pending = sequence;
      owners.set(sequence, {
        submitted: 0,
        observed: null,
        outputOrdinal: nextOrdinal,
        outputEncoding: nextEncoding,
        quarantined: false
      });
      return sequence;
    },
    isStateMutationSequenceSegmentReady(execution, sequence, segment) {
      const owner = owners.get(sequence);
      return pending === sequence
        && sequence.execution === execution
        && owner?.quarantined !== true
        && owner?.observed === null
        && sequence.stages[owner.submitted] === segment;
    },
    isStateMutationSequenceSegmentSubmitted(execution, sequence, segment) {
      const owner = owners.get(sequence);
      return pending === sequence
        && sequence.execution === execution
        && owner?.quarantined !== true
        && sequence.stages.indexOf(segment) >= 0
        && sequence.stages.indexOf(segment) < owner.submitted;
    },
    markStateMutationSequenceStageSubmissionObserved(sequence, segment) {
      const owner = owners.get(sequence);
      assert.equal(owner.observed, null);
      assert.equal(sequence.stages[owner.submitted], segment);
      owner.observed = owner.submitted;
    },
    isStateMutationSequenceStageSubmissionObserved(execution, sequence, segment) {
      const owner = owners.get(sequence);
      return pending === sequence
        && sequence.execution === execution
        && owner?.quarantined !== true
        && owner?.observed === owner?.submitted
        && sequence.stages[owner.submitted] === segment;
    },
    markStateMutationSequenceStageSubmitted(sequence, segment) {
      const owner = owners.get(sequence);
      assert.equal(sequence.stages[owner.submitted], segment);
      assert.equal(owner.observed, owner.submitted);
      owner.observed = null;
      owner.submitted += 1;
    },
    completeStateMutationSequence(sequence) {
      const owner = owners.get(sequence);
      assert.equal(owner.submitted, sequence.stages.length);
      ordinal = owner.outputOrdinal;
      encoding = owner.outputEncoding;
      pending = null;
    },
    isCurrentStateArtifact(_execution, {
      mutationOrdinal,
      stateEncoding,
      publicationLock: candidateLock = null
    } = {}) {
      return pending == null
        && ordinal === mutationOrdinal
        && encoding === stateEncoding
        && (publicationLock == null || candidateLock === publicationLock)
        && !quarantined;
    },
    discardStateMutationSequence(sequence, { discardedEncoder }) {
      assert.equal(discardedEncoder, true);
      assert.equal(owners.get(sequence).submitted, 0);
      assert.equal(owners.get(sequence).observed, null);
      pending = null;
      return true;
    },
    quarantineStateMutationSequence(sequence) {
      const owner = owners.get(sequence);
      assert.ok(owner.submitted > 0 || owner.observed !== null);
      owner.quarantined = true;
      quarantined = true;
      const lockOwner = lockOwners.get(publicationLock);
      if (lockOwner) lockOwner.status = 'quarantined';
      return true;
    },
    quarantineCurrentStateArtifact() {
      quarantined = true;
      const lockOwner = lockOwners.get(publicationLock);
      if (lockOwner) lockOwner.status = 'quarantined';
      return true;
    },
    isStateArtifactQuarantined() {
      return quarantined;
    },
    async retireQuarantinedExecutionAfter() {
      assert.equal(quarantined, true);
      released = true;
      publicationLock = null;
      return true;
    },
    async quarantineExecutionAfterDeviceLoss(execution, { reason = null } = {}) {
      if (!quarantined) {
        this.quarantineCurrentStateArtifact(execution, {
          mutationOrdinal: ordinal,
          stateEncoding: encoding,
          reason
        });
      }
      return this.retireQuarantinedExecutionAfter(
        execution,
        { deviceLost: true }
      );
    },
    async retireStatePublicationLockAfter(execution, lock) {
      assert.equal(this.isStatePublicationLockActive(execution, lock), true);
      if (retireFailureCount > 0) {
        retireFailureCount -= 1;
        quarantined = true;
        lockOwners.get(lock).status = 'quarantined';
        throw new Error('runtime-owned queue fence rejected');
      }
      publicationLock = null;
      released = true;
      return true;
    }
  };
}

function fixture({ fineSubstepCount = 4, fineRuntime = sequenceRuntime() } = {}) {
  const device = {
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024
    },
    queue: {
      writeBuffer() {},
      async onSubmittedWorkDone() {}
    },
    createBuffer(desc) {
      return {
        ...desc,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        }
      };
    }
  };
  const stateBuffer = { label: 'state-0' };
  const thermoBuffer = { label: 'thermo-0' };
  const identityBuffer = { label: 'identity-0' };
  const mechanicsBuffer = { label: 'mechanics-0' };
  const fineFieldView = {
    identityBuffer,
    fieldViewBuffer: { label: 'fine-field' },
    selectedLevel: 0,
    gridDims: [5, 5, 5],
    gridSpacingM: 0.25,
    ownerRuntime: fineRuntime
  };
  const coarseFieldView = {
    identityBuffer,
    fieldViewBuffer: { label: 'coarse-field' },
    selectedLevel: 1,
    gridDims: [3, 3, 3],
    gridSpacingM: 0.5,
    ownerRuntime: sequenceRuntime()
  };
  const parentFieldView = {
    fineLevel: 0,
    coarseLevel: 1,
    exactLevelCount: 2,
    parentFieldCapacity: 8,
    fineFieldCapacity: 8,
    coarseFieldCapacity: 4,
    fineFieldView,
    coarseFieldView
  };
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 2,
    stateBuffer,
    thermoBuffer,
    identityBuffer
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    particleCount: 2,
    mechanicsBuffer
  };
  const generation = {
    selected: true,
    ready: true,
    execution: {
      submitPerformed: true,
      released: false,
      generationId: 7
    },
    source: {
      sourceStateBuffer: stateBuffer,
      assignmentBuffer: { label: 'assignment-0' },
      topologyEpoch: 17,
      chartEpoch: 19,
      levelEpoch: 23,
      supportEpoch: 29,
      minLevel: 0,
      maxLevel: 1,
      chartId: 0,
      baseGridSpacingM: 0.25
    },
    parentFieldView
  };
  const canonicalEpoch = {
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload
  };
  const refluxLedger = createSchroederCrossLevelRefluxLedgerGpu(device, {
    parentFieldCapacity: parentFieldView.parentFieldCapacity,
    coarseFieldCapacity: parentFieldView.coarseFieldCapacity,
    completionOrdinal: 7,
    fineSubstepCount,
    fineLevel: 0,
    coarseLevel: 1,
    coarseGridSpacingM: 0.5
  });
  const macroAuthority = createSchroederTwoLevelMacroAuthority({
    device,
    canonicalEpoch,
    refluxLedger,
    fineSubstepCount,
    fineLevel: 0,
    coarseLevel: 1,
    fineDt: 0.04 / fineSubstepCount,
    macroDt: 0.04
  });
  const continuation = createSchroederCanonicalParticleContinuation({
    device,
    macroAuthority,
    sphParticleUpload,
    mlsMpmParticleUpload,
    ordinal: 0
  });
  const microepochAuthority = createSchroederFineMicroepochAuthority({
    device,
    macroAuthority,
    canonicalEpoch,
    particleContinuation: continuation,
    substepOrdinal: 0
  });
  return {
    device,
    parentFieldView,
    canonicalEpoch,
    refluxLedger,
    macroAuthority,
    microepochAuthority,
    continuation,
    fineRuntime,
    sphParticleUpload,
    mlsMpmParticleUpload
  };
}

test('fused fine-substep mutation plans reserve local 0→1→2→3 chains on every fresh E_j', () => {
  for (let ratio = 1; ratio <= 4; ratio += 1) {
    const plan = createSchroederFusedFineSubstepMutationPlan({
      fineSubstepCount: ratio
    });
    assert.equal(plan.length, ratio);
    assert.deepEqual(plan.map((entry) => [
      entry.inputOrdinal,
      entry.p2gOutputOrdinal,
      entry.gridUpdateOutputOrdinal,
      entry.fineCorrectionOutputOrdinal
    ]), Array.from({ length: ratio }, () => [0, 1, 2, 3]));
    assert.equal(Object.isFrozen(plan), true);
  }
  assert.throws(() => createSchroederFusedFineSubstepMutationPlan({
    fineSubstepCount: 2,
    initialFineFieldOrdinal: 3
  }), /local field ordinal zero/);
});

test('macro authority rejects caller-selected and shaped reflux provenance', async () => {
  const f = fixture();
  const macroArgs = {
    device: f.device,
    canonicalEpoch: f.canonicalEpoch,
    refluxLedger: f.refluxLedger,
    fineSubstepCount: f.macroAuthority.fineSubstepCount,
    fineLevel: 0,
    coarseLevel: 1,
    fineDt: f.macroAuthority.fineDt,
    macroDt: f.macroAuthority.macroDt
  };
  assert.throws(() => createSchroederTwoLevelMacroAuthority({
    ...macroArgs,
    refluxLedgerValidator: () => true
  }), /module-owned and cannot be caller-selected/);
  const shapedLedger = { ...f.refluxLedger };
  Object.defineProperty(
    shapedLedger,
    Symbol.for(
      'peercompute.ulg.schroeder-cross-level-reflux-ledger-origin-validator.v0'
    ),
    {
      value: () => true,
      enumerable: false,
      configurable: false,
      writable: false
    }
  );
  assert.throws(() => createSchroederTwoLevelMacroAuthority({
    ...macroArgs,
    refluxLedger: shapedLedger
  }), /exact live frozen generation.*reflux ledger/);
  assert.equal(await abortSchroederTwoLevelMacroAuthorityAfter(
    f.device,
    f.macroAuthority,
    {
      microepochAuthority: f.microepochAuthority,
      reason: new Error('macro provenance negative fixture cleanup')
    }
  ), true);
  f.refluxLedger.destroy();
});

test('macro authority and fused transactions reject clones and forged stage producers', async () => {
  const f = fixture();
  assert.equal(validateSchroederTwoLevelMacroAuthority(
    f.device,
    f.macroAuthority,
    {
      canonicalEpoch: f.canonicalEpoch,
      parentFieldView: f.parentFieldView,
      refluxLedger: f.refluxLedger
    }
  ), true);
  assert.equal(validateSchroederTwoLevelMacroAuthority(
    f.device,
    { ...f.macroAuthority }
  ), false);
  assert.equal(validateSchroederCanonicalParticleContinuation(
    f.device,
    f.continuation,
    {
      macroAuthority: f.macroAuthority,
      ordinal: 0,
      stateBuffer: f.sphParticleUpload.stateBuffer,
      mechanicsBuffer: f.mlsMpmParticleUpload.mechanicsBuffer
    }
  ), true);
  assert.equal(validateSchroederCanonicalParticleContinuation(
    f.device,
    { ...f.continuation }
  ), false);

  assert.throws(() => createSchroederFusedFineSubstepTransaction({
    device: f.device,
    macroAuthority: f.macroAuthority,
    microepochAuthority: f.microepochAuthority,
    particleContinuation: f.continuation,
    substepOrdinal: 0,
    stageProducerValidators: TEST_STAGE_PRODUCER_VALIDATORS
  }), /module-owned and cannot be caller-selected/);
  const transaction = createSchroederFusedFineSubstepTransaction({
    device: f.device,
    macroAuthority: f.macroAuthority,
    microepochAuthority: f.microepochAuthority,
    particleContinuation: f.continuation,
    substepOrdinal: 0
  });
  assert.equal(validateSchroederFusedFineSubstepTransaction(
    f.device,
    transaction,
    { stage: 'p2g' }
  ), true);
  assert.equal(validateSchroederFusedFineSubstepTransaction(
    f.device,
    { ...transaction },
    { stage: 'p2g' }
  ), false);

  const p2gSegment = transaction.p2gMutation;
  const forgedP2g = {
    fusedFineSubstepTransaction: transaction,
    mechanicsFieldViewExecution: transaction.fineFieldView,
    fineMicroepochAuthority: transaction.microepochAuthority,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    mechanicsFieldMutationInputOrdinal: p2gSegment.expectedOrdinal,
    mechanicsFieldMutationOutputOrdinal: p2gSegment.outputOrdinal,
    mechanicsFieldMutationInputStateEncoding: p2gSegment.expectedEncoding,
    mechanicsFieldMutationOutputStateEncoding: p2gSegment.outputEncoding
  };
  for (const symbolName of [
    'peercompute.ulg.mechanics-field-p2g-origin-validator.v0',
    'peercompute.ulg.mechanics-field-grid-update-origin-validator.v0',
    'peercompute.ulg.parent-field-fine-correction-origin-validator.v0',
    'peercompute.ulg.mechanics-field-g2p-origin-validator.v0'
  ]) {
    Object.defineProperty(forgedP2g, Symbol.for(symbolName), {
      value: () => true,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  Object.freeze(forgedP2g);
  markSchroederFusedFineSubstepStageSubmissionObserved(
    f.device,
    transaction,
    { stage: 'p2g' }
  );
  assert.throws(() => markSchroederFusedFineSubstepStageSubmitted(
    f.device,
    transaction,
    { stage: 'p2g', artifact: forgedP2g }
  ), /stale, foreign, or out of order/);
  assert.equal(schroederFusedFineSubstepTransactionState(
    f.device,
    transaction
  ).stageIndex, 0);
  assert.equal(f.fineRuntime.stateMutationState().ordinal, 0);
  assert.equal(await abortSchroederTwoLevelMacroAuthorityAfter(
    f.device,
    f.macroAuthority,
    {
      microepochAuthority: f.microepochAuthority,
      reason: new Error('forged P2G was observed but never authenticated')
    }
  ), true);
  f.refluxLedger.destroy();
});

test('partially submitted fused fine substeps quarantine instead of becoming reusable', async () => {
  const f = fixture();
  const transaction = createSchroederFusedFineSubstepTransaction({
    device: f.device,
    macroAuthority: f.macroAuthority,
    microepochAuthority: f.microepochAuthority,
    particleContinuation: f.continuation,
    substepOrdinal: 0
  });
  markSchroederFusedFineSubstepStageSubmissionObserved(
    f.device,
    transaction,
    { stage: 'p2g' }
  );
  assert.equal(quarantineSchroederFusedFineSubstepTransaction(
    f.device,
    transaction,
    new Error('submission outcome unknown')
  ), true);
  assert.equal(schroederFusedFineSubstepTransactionState(
    f.device,
    transaction
  ).status, 'quarantined');
  assert.equal(validateSchroederFusedFineSubstepTransaction(
    f.device,
    transaction,
    { stage: 'p2g' }
  ), false);
  assert.throws(
    () => discardSchroederFusedFineSubstepTransaction(
      f.device,
      transaction,
      { discardedEncoder: true }
    ),
    /only an unsubmitted/
  );
  assert.equal(await abortSchroederFineMicroepochAfter(
    f.device,
    f.microepochAuthority,
    { reason: new Error('retire quarantined root') }
  ), true);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority
  ), false);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority,
    { requireLive: false }
  ), true);
});

test('macro abort quarantines an observed P2G submission before artifact publication', async () => {
  const f = fixture();
  const transaction = createSchroederFusedFineSubstepTransaction({
    device: f.device,
    macroAuthority: f.macroAuthority,
    microepochAuthority: f.microepochAuthority,
    particleContinuation: f.continuation,
    substepOrdinal: 0
  });

  assert.equal(markSchroederFusedFineSubstepStageSubmissionObserved(
    f.device,
    transaction,
    { stage: 'p2g' }
  ), true);
  assert.equal(validateSchroederFusedFineSubstepTransaction(
    f.device,
    transaction,
    { stage: 'p2g' }
  ), false);
  assert.deepEqual(schroederFusedFineSubstepTransactionState(
    f.device,
    transaction
  ), {
    status: 'p2g-submitted-artifact-pending',
    stageIndex: 0,
    submissionObservedStage: 'p2g',
    nextStage: 'p2g',
    submittedStageCount: 0,
    g2pSubmitted: false,
    gpuReceiptStatus: 'submission-observed-artifact-pending',
    gpuReceiptVerified: false,
    quarantineReason: null
  });
  assert.throws(
    () => discardSchroederFusedFineSubstepTransaction(
      f.device,
      transaction,
      { discardedEncoder: true }
    ),
    /only an unsubmitted/
  );
  assert.throws(
    () => markSchroederFusedFineSubstepStageSubmissionObserved(
      f.device,
      transaction,
      { stage: 'p2g' }
    ),
    /stale, foreign, or out of order/
  );

  assert.equal(await abortSchroederTwoLevelMacroAuthorityAfter(
    f.device,
    f.macroAuthority,
    {
      microepochAuthority: f.microepochAuthority,
      reason: new Error('P2G queue submitted before artifact construction failed')
    }
  ), true);
  assert.equal(f.fineRuntime.ownsExecution(), false);
  assert.equal(f.fineRuntime.stateMutationState().quarantined, true);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority
  ), false);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority,
    { requireLive: false }
  ), true);
});

test('macro abort retires an unused root microepoch exactly once', async () => {
  const f = fixture();
  assert.equal(await abortSchroederTwoLevelMacroAuthorityAfter(
    f.device,
    f.macroAuthority,
    {
      microepochAuthority: f.microepochAuthority,
      reason: new Error('macro setup abandoned')
    }
  ), true);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority
  ), false);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority,
    { requireLive: false }
  ), true);
  assert.equal(validateSchroederTwoLevelMacroAuthority(
    f.device,
    f.macroAuthority
  ), false);
  assert.throws(() => abortSchroederTwoLevelMacroAuthorityAfter(
    f.device,
    f.macroAuthority,
    { microepochAuthority: f.microepochAuthority }
  ), /stale or replayed/);
});

test('fresh root device-loss abort quarantines exact state before loss retirement', async () => {
  const f = fixture();
  let quarantineCount = 0;
  let quarantinedRetirementCount = 0;
  let normalRetirementCount = 0;
  const originalQuarantine = f.fineRuntime.quarantineCurrentStateArtifact;
  const originalQuarantinedRetirement =
    f.fineRuntime.retireQuarantinedExecutionAfter;
  const originalNormalRetirement = f.fineRuntime.retireStatePublicationLockAfter;
  f.fineRuntime.quarantineCurrentStateArtifact = (...args) => {
    quarantineCount += 1;
    return originalQuarantine(...args);
  };
  f.fineRuntime.retireQuarantinedExecutionAfter = async (...args) => {
    quarantinedRetirementCount += 1;
    assert.equal(args[1]?.deviceLost, true);
    return originalQuarantinedRetirement(...args);
  };
  f.fineRuntime.retireStatePublicationLockAfter = async (...args) => {
    normalRetirementCount += 1;
    return originalNormalRetirement(...args);
  };
  f.device.queue.onSubmittedWorkDone = () => {
    throw new Error('fresh device-loss abort must not request a queue fence');
  };
  f.device.lost = Promise.resolve({
    reason: 'destroyed',
    message: 'test device loss'
  });

  assert.equal(await abortSchroederTwoLevelMacroAuthorityAfter(
    f.device,
    f.macroAuthority,
    {
      microepochAuthority: f.microepochAuthority,
      reason: new Error('fresh root device loss'),
      deviceLost: true
    }
  ), true);
  assert.equal(quarantineCount, 1);
  assert.equal(quarantinedRetirementCount, 1);
  assert.equal(normalRetirementCount, 0);
  assert.equal(f.fineRuntime.ownsExecution(f.parentFieldView.fineFieldView), false);
});

test('queue-fence rejection leaves exact device-loss abort retirement retryable', async () => {
  const fineRuntime = sequenceRuntime({ retireFailureCount: 1 });
  const f = fixture({ fineRuntime });
  await assert.rejects(
    abortSchroederFineMicroepochAfter(
      f.device,
      f.microepochAuthority,
      { reason: new Error('queue fence rejected') }
    ),
    /runtime-owned queue fence rejected/
  );
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority
  ), false);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority,
    { requireLive: false }
  ), true);
  assert.equal(await abortSchroederFineMicroepochAfter(
    f.device,
    f.microepochAuthority,
    {
      reason: new Error('device lost after rejected fence'),
      deviceLost: true
    }
  ), true);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority
  ), false);
  assert.equal(validateSchroederFineMicroepochAuthority(
    f.device,
    f.microepochAuthority,
    { requireLive: false }
  ), true);
  assert.throws(() => abortSchroederFineMicroepochAfter(
    f.device,
    f.microepochAuthority,
    { deviceLost: true }
  ), /stale or replayed/);
});
