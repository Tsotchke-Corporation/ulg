export function createSchroederSpatialMechanicsFieldPairLifecycle({
  device,
  getRuntime,
  nextSerial,
  markDeviceLossObserved,
  allocationEntriesForArena,
  releaseArena
}) {
  const artifactGroups = new WeakMap();
  const releasedArtifacts = new WeakSet();
  const mutationSequenceOwnership = new WeakMap();
  const mutationSegmentOwnership = new WeakMap();
  const mutationTokenSequenceOwnership = new WeakMap();
  const publicationLockOwnership = new WeakMap();
  const publicationCapabilityOwnership = new WeakMap();
  const publicationRetirementOwnership = new WeakMap();

  function registerExecutionGroup(group) {
    group.registeredSourceBuffer = group.pairExecution.sourceBuffer;
    group.registeredIdentityBuffer = group.pairExecution.identityBuffer;
    group.registeredActiveSourceView = group.pairExecution.activeSourceView;
    group.registeredActiveSourceViewBuffer =
      group.pairExecution.activeSourceViewBuffer;
    group.registeredActiveSourceViewByteLength = Number(
      group.pairExecution.activeSourceView?.layout?.byteLength
    );
    artifactGroups.set(group.pairExecution, group);
    for (const child of group.children) artifactGroups.set(child, group);
  }

  function rawGroupFor(artifact) {
    const group = artifactGroups.get(artifact);
    const exactChildren = Array.isArray(group?.pairExecution?.mechanicsFieldViews)
      && group.pairExecution.mechanicsFieldViews.length === 2
      && group.children?.length === 2
      && group.children.every((child, levelOrdinal) => (
        group.pairExecution.mechanicsFieldViews[levelOrdinal] === child
        && child?.pairExecution === group.pairExecution
        && child?.fieldViewBuffer === group.arena.fieldViewBuffers[levelOrdinal]
        && child?.stableCandidateOrderBuffer
          === group.arena.stableOrderBuffers[levelOrdinal]
        && child?.candidateKeyBuffer === group.arena.candidateKeyBuffer
        && child?.sourceBuffer === group.registeredSourceBuffer
        && child?.identityBuffer === group.registeredIdentityBuffer
        && child?.activeSourceView === group.registeredActiveSourceView
        && child?.activeSourceViewBuffer
          === group.registeredActiveSourceViewBuffer
      ));
    if (
      !group
      || group.released
      || group.arena.inUse !== true
      || group.arena.token !== group.token
      || !exactChildren
      || group.pairExecution.sourceBuffer !== group.registeredSourceBuffer
      || group.pairExecution.identityBuffer !== group.registeredIdentityBuffer
      || group.pairExecution.activeSourceView
        !== group.registeredActiveSourceView
      || group.pairExecution.activeSourceViewBuffer
        !== group.registeredActiveSourceViewBuffer
      || group.registeredActiveSourceView?.activeSourceViewBuffer
        !== group.registeredActiveSourceViewBuffer
      || Number(group.registeredActiveSourceView?.layout?.byteLength)
        !== group.registeredActiveSourceViewByteLength
      || (
        artifact !== group.pairExecution
        && (
          !group.children.includes(artifact)
        )
      )
      || artifact?.ownerRuntime !== getRuntime()
    ) {
      const error = new Error(
        'mechanics field pair execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_FOREIGN_EXECUTION';
      throw error;
    }
    return group;
  }

  function groupFor(artifact) {
    const group = rawGroupFor(artifact);
    if (group.releaseInFlight) {
      const error = new Error(
        'mechanics field pair execution is retiring'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_FOREIGN_EXECUTION';
      throw error;
    }
    return group;
  }

  function childStateFor(execution) {
    const group = groupFor(execution);
    const levelOrdinal = group.children.indexOf(execution);
    if (levelOrdinal < 0) {
      const error = new TypeError(
        'mechanics field state lifecycle requires one child field view'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_FOREIGN_EXECUTION';
      throw error;
    }
    return {
      group,
      mutation: group.mutations[levelOrdinal],
      levelOrdinal
    };
  }

  function ownsExecution(artifact) {
    try {
      groupFor(artifact);
      return true;
    } catch {
      return false;
    }
  }

  function markExecutionSubmitted(artifact) {
    const group = groupFor(artifact);
    if (group.submitted) return false;
    group.submitted = true;
    Object.defineProperty(group.pairExecution, 'submitPerformed', {
      value: true,
      enumerable: true
    });
    Object.defineProperty(group.pairExecution, 'status', {
      value: 'schroeder-spatial-mechanics-field-pair-gpu-build-submitted',
      enumerable: true
    });
    for (const child of group.children) {
      Object.defineProperty(child, 'submitPerformed', {
        value: true,
        enumerable: true
      });
      Object.defineProperty(child, 'status', {
        value: 'schroeder-spatial-mechanics-field-view-gpu-build-submitted',
        enumerable: true
      });
    }
    return true;
  }

  function isExecutionSubmitted(artifact) {
    try {
      const group = groupFor(artifact);
      return group.submitted
        && group.pairExecution.submitPerformed === true
        && group.children.every((child) => child.submitPerformed === true);
    } catch {
      return false;
    }
  }

  function isExecutionRetirementInFlight(artifact) {
    try {
      const group = rawGroupFor(artifact);
      return group.submitted
        && group.releaseInFlight
        && group.retirementAttempt !== null;
    } catch {
      return false;
    }
  }

  function stateMutationState(execution) {
    const { mutation } = childStateFor(execution);
    return Object.freeze({
      ordinal: mutation.ordinal,
      encoding: mutation.encoding,
      operation: mutation.operation,
      pending: mutation.pending !== null,
      publicationLocked: mutation.publicationLock !== null,
      quarantined: mutation.quarantined === true
    });
  }

  function isStateMutationReservationActive(execution, token) {
    try {
      const { mutation } = childStateFor(execution);
      return token?.execution === execution
        && mutation.pending === token
        && mutation.quarantined !== true
        && mutation.ordinal === token.expectedOrdinal
        && mutation.encoding === token.expectedEncoding
        && token.outputOrdinal
          === token.expectedOrdinal + token.mutationCount
        && token.publicationLock === mutation.publicationLock
        && (
          token.publicationLock === null
          || publicationLockOwnership.get(token.publicationLock)?.status
            === 'active'
        );
    } catch {
      return false;
    }
  }

  function reserveStateMutation(execution, {
    expectedOrdinal,
    expectedEncoding,
    outputEncoding,
    operation,
    mutationCount = 1,
    publicationLock = null
  } = {}) {
    const { group, mutation } = childStateFor(execution);
    if (!group.submitted) {
      throw new Error('mechanics field mutation requires a submitted field view');
    }
    const expected = Number(expectedOrdinal);
    const expectedState = Number(expectedEncoding);
    const outputState = Number(outputEncoding);
    const count = Number(mutationCount);
    const activeLock = mutation.publicationLock;
    const lockAdmitted = activeLock === null
      ? publicationLock == null
      : activeLock === publicationLock
        && publicationLockOwnership.get(publicationLock)?.execution === execution
        && publicationLockOwnership.get(publicationLock)?.status === 'active';
    if (
      !Number.isSafeInteger(expected) || expected < 0
      || !Number.isSafeInteger(expectedState) || expectedState < 0
      || !Number.isSafeInteger(outputState) || outputState < 0
      || !Number.isSafeInteger(count) || count < 1
      || expected > 0xffff_ffff - count
      || mutation.ordinal !== expected
      || mutation.encoding !== expectedState
      || mutation.pending !== null
      || mutation.quarantined
      || !lockAdmitted
      || typeof operation !== 'string'
      || operation.length === 0
    ) {
      const error = new Error(
        'mechanics field mutation ordinal is stale or malformed'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    const token = Object.freeze({
      execution,
      expectedOrdinal: expected,
      outputOrdinal: expected + count,
      expectedEncoding: expectedState,
      outputEncoding: outputState,
      mutationCount: count,
      operation,
      publicationLock: activeLock
    });
    mutation.pending = token;
    return token;
  }

  function markStateMutationSubmitted(token) {
    const execution = token?.execution;
    const { mutation } = childStateFor(execution);
    if (mutation.pending !== token || mutation.quarantined) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    if (
      token.publicationLock !== mutation.publicationLock
      || (
        token.publicationLock !== null
        && publicationLockOwnership.get(token.publicationLock)?.status
          !== 'active'
      )
    ) {
      const error = new Error(
        'mechanics field publication lock changed during mutation'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    mutation.ordinal = token.outputOrdinal;
    mutation.encoding = token.outputEncoding;
    mutation.operation = token.operation;
    mutation.pending = null;
    return stateMutationState(execution);
  }

  function discardStateMutation(token, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'discardStateMutation requires { discardedEncoder: true }'
      );
    }
    const { mutation } = childStateFor(token?.execution);
    if (mutation.pending !== token || mutation.quarantined) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    mutation.pending = null;
    return true;
  }

  function quarantineStateMutation(token, {
    submissionObserved = false,
    reason = null
  } = {}) {
    if (submissionObserved !== true) {
      throw new TypeError(
        'quarantineStateMutation requires { submissionObserved: true }'
      );
    }
    const { group, mutation } = childStateFor(token?.execution);
    if (mutation.pending !== token || mutation.quarantined) {
      const error = new Error('mechanics field mutation token is not pending');
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_STALE';
      throw error;
    }
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    group.arena.quarantined = true;
    const lock = publicationLockOwnership.get(mutation.publicationLock);
    if (lock?.status === 'active') lock.status = 'quarantined';
    return true;
  }

  function reserveStateMutationSequence(execution, {
    expectedOrdinal,
    expectedEncoding,
    stages,
    operation = 'mechanics-field-mutation-sequence',
    publicationLock = null
  } = {}) {
    if (!Array.isArray(stages) || stages.length < 1 || stages.length > 16) {
      throw new RangeError(
        'mechanics field mutation sequence requires 1-16 stages'
      );
    }
    let ordinal = Number(expectedOrdinal);
    let encoding = Number(expectedEncoding);
    if (
      !Number.isSafeInteger(ordinal) || ordinal < 0
      || !Number.isSafeInteger(encoding) || encoding < 0
    ) {
      throw new RangeError(
        'mechanics field mutation sequence requires exact initial provenance'
      );
    }
    const normalized = stages.map((stage, stageIndex) => {
      const mutationCount = stage?.mutationCount == null
        ? 1
        : Number(stage.mutationCount);
      const outputEncoding = Number(stage?.outputEncoding);
      const stageOperation = stage?.operation;
      if (
        !Number.isSafeInteger(mutationCount) || mutationCount < 1
        || !Number.isSafeInteger(outputEncoding) || outputEncoding < 0
        || typeof stageOperation !== 'string' || stageOperation.length === 0
        || ordinal > 0xffff_ffff - mutationCount
      ) {
        throw new RangeError(
          `mechanics field mutation sequence stage ${stageIndex} is malformed`
        );
      }
      const segment = {
        execution,
        stageIndex,
        expectedOrdinal: ordinal,
        outputOrdinal: ordinal + mutationCount,
        expectedEncoding: encoding,
        outputEncoding,
        mutationCount,
        operation: stageOperation
      };
      ordinal = segment.outputOrdinal;
      encoding = outputEncoding;
      return segment;
    });
    const mutationCount = normalized.reduce(
      (sum, stage) => sum + stage.mutationCount,
      0
    );
    const token = reserveStateMutation(execution, {
      expectedOrdinal,
      expectedEncoding,
      outputEncoding: encoding,
      operation,
      mutationCount,
      publicationLock
    });
    const sequence = {
      execution,
      expectedOrdinal: token.expectedOrdinal,
      outputOrdinal: token.outputOrdinal,
      expectedEncoding: token.expectedEncoding,
      outputEncoding: token.outputEncoding,
      mutationCount: token.mutationCount,
      operation,
      stages: null
    };
    const frozenStages = normalized.map((stage) => {
      const segment = { ...stage };
      Object.defineProperty(segment, 'sequence', {
        value: sequence,
        enumerable: false
      });
      Object.freeze(segment);
      mutationSegmentOwnership.set(segment, {
        sequence,
        stageIndex: stage.stageIndex
      });
      return segment;
    });
    sequence.stages = Object.freeze(frozenStages);
    Object.freeze(sequence);
    mutationSequenceOwnership.set(sequence, {
      token,
      stages: sequence.stages,
      submittedStageCount: 0,
      submissionObservedStageIndex: null,
      completed: false,
      discarded: false,
      quarantined: false,
      quarantineReason: null
    });
    mutationTokenSequenceOwnership.set(token, sequence);
    return sequence;
  }

  function sequenceOwnershipFor(sequence) {
    const ownership = mutationSequenceOwnership.get(sequence);
    const { mutation } = childStateFor(sequence?.execution);
    if (
      !ownership
      || ownership.discarded
      || ownership.completed
      || mutation.pending !== ownership.token
      || sequence.stages !== ownership.stages
    ) {
      const error = new Error(
        'mechanics field mutation sequence is stale or foreign'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_STALE';
      throw error;
    }
    return ownership;
  }

  function sequenceSegmentOwnershipFor(sequence, segment) {
    const sequenceOwnership = sequenceOwnershipFor(sequence);
    const segmentOwnership = mutationSegmentOwnership.get(segment);
    if (
      !segmentOwnership
      || segmentOwnership.sequence !== sequence
      || sequence.stages[segmentOwnership.stageIndex] !== segment
    ) {
      const error = new Error(
        'mechanics field mutation segment is stale or foreign'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_STALE';
      throw error;
    }
    return { sequenceOwnership, segmentOwnership };
  }

  function stateMutationSequenceState(sequence) {
    const ownership = sequenceOwnershipFor(sequence);
    return Object.freeze({
      submittedStageCount: ownership.submittedStageCount,
      submissionObservedStageIndex: ownership.submissionObservedStageIndex,
      stageCount: ownership.stages.length,
      completed: ownership.completed,
      discarded: ownership.discarded,
      quarantined: ownership.quarantined,
      quarantineReason: ownership.quarantineReason
    });
  }

  function isStateMutationSequenceSegmentReady(execution, sequence, segment) {
    try {
      if (
        sequence?.execution !== execution
        || segment?.execution !== execution
      ) return false;
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return !sequenceOwnership.quarantined
        && sequenceOwnership.submissionObservedStageIndex === null
        && sequenceOwnership.submittedStageCount === segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function isStateMutationSequenceSegmentSubmitted(
    execution,
    sequence,
    segment
  ) {
    try {
      if (
        sequence?.execution !== execution
        || segment?.execution !== execution
      ) return false;
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return !sequenceOwnership.quarantined
        && sequenceOwnership.submittedStageCount > segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function markStateMutationSequenceStageSubmissionObserved(
    sequence,
    segment
  ) {
    const { sequenceOwnership, segmentOwnership } =
      sequenceSegmentOwnershipFor(sequence, segment);
    if (
      sequenceOwnership.quarantined
      || sequenceOwnership.submissionObservedStageIndex !== null
      || sequenceOwnership.submittedStageCount !== segmentOwnership.stageIndex
    ) {
      const error = new Error(
        'mechanics field mutation sequence stage submission is replayed or out of order'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER';
      throw error;
    }
    sequenceOwnership.submissionObservedStageIndex =
      segmentOwnership.stageIndex;
    return stateMutationSequenceState(sequence);
  }

  function isStateMutationSequenceStageSubmissionObserved(
    execution,
    sequence,
    segment
  ) {
    try {
      if (
        sequence?.execution !== execution
        || segment?.execution !== execution
      ) return false;
      const { sequenceOwnership, segmentOwnership } =
        sequenceSegmentOwnershipFor(sequence, segment);
      return !sequenceOwnership.quarantined
        && sequenceOwnership.submittedStageCount === segmentOwnership.stageIndex
        && sequenceOwnership.submissionObservedStageIndex
          === segmentOwnership.stageIndex;
    } catch {
      return false;
    }
  }

  function markStateMutationSequenceStageSubmitted(sequence, segment) {
    const { sequenceOwnership, segmentOwnership } =
      sequenceSegmentOwnershipFor(sequence, segment);
    if (
      sequenceOwnership.quarantined
      || sequenceOwnership.submittedStageCount !== segmentOwnership.stageIndex
      || sequenceOwnership.submissionObservedStageIndex
        !== segmentOwnership.stageIndex
    ) {
      const error = new Error(
        'mechanics field mutation sequence stage is replayed or out of order'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_ORDER';
      throw error;
    }
    sequenceOwnership.submissionObservedStageIndex = null;
    sequenceOwnership.submittedStageCount += 1;
    return stateMutationSequenceState(sequence);
  }

  function completeStateMutationSequence(sequence) {
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.quarantined
      || ownership.submittedStageCount !== ownership.stages.length
    ) {
      const error = new Error(
        'mechanics field mutation sequence cannot publish before every stage submits'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_INCOMPLETE';
      throw error;
    }
    const state = markStateMutationSubmitted(ownership.token);
    ownership.completed = true;
    return state;
  }

  function discardStateMutationSequence(sequence, {
    discardedEncoder = false
  } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'discardStateMutationSequence requires { discardedEncoder: true }'
      );
    }
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.submittedStageCount !== 0
      || ownership.submissionObservedStageIndex !== null
      || ownership.quarantined
    ) {
      const error = new Error(
        'submitted mechanics field mutation sequence cannot be discarded'
      );
      error.code =
        'ERR_SCHROEDER_MECHANICS_FIELD_MUTATION_SEQUENCE_SUBMITTED';
      throw error;
    }
    discardStateMutation(ownership.token, { discardedEncoder: true });
    ownership.discarded = true;
    return true;
  }

  function quarantineStateMutationSequence(sequence, reason = null) {
    const ownership = sequenceOwnershipFor(sequence);
    if (
      ownership.submittedStageCount === 0
      && ownership.submissionObservedStageIndex === null
    ) {
      throw new Error(
        'unsubmitted mechanics field mutation sequence must be discarded, not quarantined'
      );
    }
    ownership.quarantined = true;
    ownership.quarantineReason = reason ?? null;
    const { group, mutation } = childStateFor(sequence.execution);
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    group.arena.quarantined = true;
    const lock = publicationLockOwnership.get(mutation.publicationLock);
    if (lock?.status === 'active') lock.status = 'quarantined';
    return true;
  }

  function acquireStatePublicationLock(execution, {
    owner = null,
    publicationReceiptValidator = null
  } = {}) {
    const { group, mutation } = childStateFor(execution);
    if (
      !group.submitted
      || mutation.pending !== null
      || mutation.publicationLock !== null
      || mutation.quarantined
    ) {
      const error = new Error(
        'mechanics field publication lock cannot be acquired'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    const publicationLock = Object.freeze({
      schema: 'peercompute.ulg.schroeder-mechanics-field-publication-lock.v0',
      execution,
      owner,
      acquisitionOrdinal: mutation.ordinal,
      acquisitionEncoding: mutation.encoding,
      serial: nextSerial()
    });
    publicationLockOwnership.set(publicationLock, {
      execution,
      owner,
      status: 'active',
      publicationReceiptValidator:
        typeof publicationReceiptValidator === 'function'
          ? publicationReceiptValidator
          : null,
      acquisitionOrdinal: mutation.ordinal,
      acquisitionEncoding: mutation.encoding
    });
    mutation.publicationLock = publicationLock;
    return publicationLock;
  }

  function isStatePublicationLockActive(execution, publicationLock) {
    try {
      const { mutation } = childStateFor(execution);
      const ownership = publicationLockOwnership.get(publicationLock);
      return mutation.publicationLock === publicationLock
        && ownership?.execution === execution
        && ownership.status === 'active';
    } catch {
      return false;
    }
  }

  function discardStatePublicationLock(execution, publicationLock) {
    const { group, mutation } = childStateFor(execution);
    const ownership = publicationLockOwnership.get(publicationLock);
    if (
      !group.submitted
      || mutation.publicationLock !== publicationLock
      || ownership?.execution !== execution
      || ownership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined
      || mutation.ordinal !== ownership.acquisitionOrdinal
      || mutation.encoding !== ownership.acquisitionEncoding
    ) {
      const error = new Error(
        'only an unmodified mechanics field publication lock can be discarded'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    mutation.publicationLock = null;
    ownership.status = 'discarded';
    return true;
  }

  function mintStatePublicationCapability(execution, publicationLock, {
    terminalClosureReceipt,
    closureOrdinal
  } = {}) {
    const { mutation } = childStateFor(execution);
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    const resolvedClosureOrdinal = Number(closureOrdinal);
    let receiptAdmitted = false;
    try {
      receiptAdmitted = terminalClosureReceipt?.schema
          === 'peercompute.ulg.schroeder-mechanics-field-publication-receipt.v0'
        && terminalClosureReceipt?.status
          === 'macro-closure-gpu-verified-private'
        && terminalClosureReceipt?.particlePublicationAllowed === true
        && lockOwnership?.publicationReceiptValidator?.(
          device,
          terminalClosureReceipt,
          {
            execution,
            publicationLock,
            mutationOrdinal: mutation.ordinal,
            stateEncoding: mutation.encoding,
            closureOrdinal: resolvedClosureOrdinal
          }
        ) === true;
    } catch {
      receiptAdmitted = false;
    }
    if (
      mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined
      || !Number.isSafeInteger(resolvedClosureOrdinal)
      || resolvedClosureOrdinal < 0
      || !receiptAdmitted
    ) {
      const error = new Error(
        'mechanics field publication capability is stale'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    const capability = Object.freeze({
      schema:
        'peercompute.ulg.schroeder-mechanics-field-publication-capability.v0',
      closureOrdinal: resolvedClosureOrdinal,
      serial: nextSerial()
    });
    publicationCapabilityOwnership.set(capability, {
      execution,
      publicationLock,
      terminalClosureReceipt,
      closureOrdinal: resolvedClosureOrdinal,
      mutationOrdinal: mutation.ordinal,
      stateEncoding: mutation.encoding,
      status: 'ready'
    });
    return capability;
  }

  function promoteStatePublicationLock(
    execution,
    publicationLock,
    publicationCapability
  ) {
    const { mutation } = childStateFor(execution);
    const lockOwnership = publicationLockOwnership.get(publicationLock);
    const capabilityOwnership = publicationCapabilityOwnership.get(
      publicationCapability
    );
    if (
      mutation.publicationLock !== publicationLock
      || lockOwnership?.execution !== execution
      || lockOwnership.status !== 'active'
      || mutation.pending !== null
      || mutation.quarantined
      || capabilityOwnership?.execution !== execution
      || capabilityOwnership?.publicationLock !== publicationLock
      || capabilityOwnership.status !== 'ready'
      || capabilityOwnership.mutationOrdinal !== mutation.ordinal
      || capabilityOwnership.stateEncoding !== mutation.encoding
    ) {
      const error = new Error(
        'mechanics field publication promotion is stale'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
      throw error;
    }
    capabilityOwnership.status = 'consumed';
    lockOwnership.status = 'promoted';
    mutation.publicationLock = null;
    return true;
  }

  function isCurrentStateArtifact(execution, {
    mutationOrdinal,
    stateEncoding,
    publicationLock = null
  } = {}) {
    try {
      const { mutation } = childStateFor(execution);
      const activeLock = mutation.publicationLock;
      const publicationAdmitted = activeLock === null
        ? publicationLock == null
        : activeLock === publicationLock
          && publicationLockOwnership.get(publicationLock)?.status === 'active';
      return mutation.pending === null
        && !mutation.quarantined
        && publicationAdmitted
        && mutation.ordinal === mutationOrdinal
        && mutation.encoding === stateEncoding;
    } catch {
      return false;
    }
  }

  function quarantineCurrentStateArtifact(execution, {
    mutationOrdinal,
    stateEncoding,
    reason = null
  } = {}) {
    const { group, mutation } = childStateFor(execution);
    if (
      mutation.pending !== null
      || mutation.ordinal !== mutationOrdinal
      || mutation.encoding !== stateEncoding
      || mutation.quarantined
    ) {
      const error = new Error(
        'mechanics field current state cannot be quarantined'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_QUARANTINE_STALE';
      throw error;
    }
    mutation.quarantined = true;
    mutation.quarantineReason = reason ?? null;
    group.arena.quarantined = true;
    const lock = publicationLockOwnership.get(mutation.publicationLock);
    if (lock?.status === 'active') lock.status = 'quarantined';
    return true;
  }

  function isStateArtifactQuarantined(execution) {
    try {
      return childStateFor(execution).mutation.quarantined;
    } catch {
      return false;
    }
  }

  function allChildStateIdle(group, { allowQuarantined = false } = {}) {
    return group.mutations.every((mutation) => (
      mutation.pending === null
      && mutation.publicationLock === null
      && (allowQuarantined || !mutation.quarantined)
    ));
  }

  function markGroupReleased(group) {
    if (group.released) return true;
    const released = releaseArena(group.arena, group.token);
    if (!released) return false;
    group.released = true;
    group.releaseInFlight = false;
    group.retirementAttempt = null;
    releasedArtifacts.add(group.pairExecution);
    for (const child of group.children) releasedArtifacts.add(child);
    group.resolveCompletion(true);
    return true;
  }

  function finalizeNormalRelease(group, { radixReleased = false } = {}) {
    if (group.released) return true;
    if (!allChildStateIdle(group)) {
      throw new Error(
        'mechanics field pair release requires both child states to be idle'
      );
    }
    if (group.ownsRadixExecution && !radixReleased) {
      group.arena.radix.releaseExecution(
        group.radixUnique,
        { discardedEncoder: true }
      );
    }
    return markGroupReleased(group);
  }

  function finalizeQueueOrderedRelease(group) {
    if (group.released) return true;
    if (!group.submitted || !allChildStateIdle(group)) {
      throw new Error(
        'queue-ordered mechanics field pair release requires submitted idle child states'
      );
    }
    const radixReleased = group.ownsRadixExecution
      ? group.arena.radix.releaseExecutionQueueOrdered?.(group.radixUnique)
      : true;
    if (radixReleased !== true) {
      throw new Error(
        'queue-ordered mechanics field pair radix owner did not confirm release'
      );
    }
    return markGroupReleased(group);
  }

  function startQueueFenceRelease(group, ownerFence = null) {
    if (group.released) return group.completionPromise;
    if (group.retirementAttempt) return group.retirementAttempt.promise;
    if (!group.submitted) {
      throw new Error(
        'unsubmitted mechanics field pair requires discarded-encoder release'
      );
    }
    if (!allChildStateIdle(group)) {
      throw new Error(
        'mechanics field pair release requires both child states to be idle'
      );
    }
    const fence = ownerFence ?? device.queue?.onSubmittedWorkDone?.();
    if (!fence?.then) {
      throw new TypeError(
        'mechanics field pair release requires runtime-owned queue-fence support'
      );
    }
    const attempt = {
      mode: 'queue-fence',
      promise: null
    };
    group.retirementAttempt = attempt;
    group.releaseInFlight = true;
    let radixRelease;
    try {
      radixRelease = group.ownsRadixExecution
        ? group.arena.radix.releaseExecutionAfter(
            group.radixUnique,
            fence
          )
        : Promise.resolve(fence).then(() => true);
    } catch (error) {
      group.retirementAttempt = null;
      group.releaseInFlight = false;
      throw error;
    }
    const promise = Promise.race([
      Promise.resolve(radixRelease).then((released) => ({
        kind: 'radix-release',
        released
      })),
      group.completionPromise.then(() => ({
        kind: 'terminal-completion',
        released: true
      }))
    ]).then((result) => {
      if (result.kind === 'terminal-completion') return true;
      if (group.released) return true;
      if (group.retirementAttempt !== attempt) return group.completionPromise;
      if (result.released !== true) {
        throw new Error(
          'mechanics field pair shared radix owner did not confirm release'
        );
      }
      return finalizeNormalRelease(group, { radixReleased: true });
    }).catch((error) => {
      if (
        group.released
        || group.retirementAttempt !== attempt
      ) {
        return group.completionPromise;
      }
      if (group.retirementAttempt === attempt) {
        group.retirementAttempt = null;
        group.releaseInFlight = false;
      }
      throw error;
    });
    attempt.promise = promise;
    promise.catch(() => {});
    return promise;
  }

  function releaseExecution(artifact, { discardedEncoder = false } = {}) {
    if (discardedEncoder !== true) {
      throw new TypeError(
        'releaseExecution requires { discardedEncoder: true }'
      );
    }
    const group = rawGroupFor(artifact);
    if (group.released) return false;
    if (group.submitted) {
      throw new Error('submitted mechanics field pair requires a queue fence');
    }
    return finalizeNormalRelease(group);
  }

  function canReleaseExecutionQueueOrdered(artifact) {
    try {
      const group = rawGroupFor(artifact);
      return Boolean(
        !group.released
        && group.submitted
        && !group.retirementAttempt
        && allChildStateIdle(group)
        && (
          group.ownsRadixExecution !== true
          || group.arena.radix.canReleaseExecutionQueueOrdered?.(
            group.radixUnique
          ) === true
        )
      );
    } catch {
      return false;
    }
  }

  function releaseExecutionQueueOrdered(artifact) {
    if (!canReleaseExecutionQueueOrdered(artifact)) {
      throw new Error(
        'queue-ordered mechanics field pair release requires an exact submitted idle artifact'
      );
    }
    const group = rawGroupFor(artifact);
    return finalizeQueueOrderedRelease(group);
  }

  function releaseExecutionAfter(artifact) {
    try {
      const group = rawGroupFor(artifact);
      return startQueueFenceRelease(group);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function executionRetirementCompletionPromise(artifact) {
    const group = artifactGroups.get(artifact);
    if (
      !group
      || artifact?.ownerRuntime !== getRuntime()
      || (
        artifact !== group.pairExecution
        && !group.children.includes(artifact)
      )
    ) {
      const error = new Error(
        'mechanics field pair execution is not owned by this runtime'
      );
      error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_FOREIGN_EXECUTION';
      throw error;
    }
    return group.completionPromise;
  }

  function retireStatePublicationLockAfter(execution, publicationLock) {
    try {
      const existingRetirement =
        publicationRetirementOwnership.get(publicationLock);
      if (existingRetirement) {
        if (existingRetirement.execution === execution) {
          return existingRetirement.promise;
        }
        const error = new Error(
          'mechanics field private retirement is stale'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      const { group, mutation } = childStateFor(execution);
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      if (
        !group.submitted
        || mutation.publicationLock !== publicationLock
        || lockOwnership?.execution !== execution
        || lockOwnership.status !== 'active'
        || mutation.pending !== null
        || mutation.quarantined
      ) {
        const error = new Error(
          'mechanics field private retirement is stale'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
        throw new TypeError(
          'retireStatePublicationLockAfter requires runtime-owned queue-fence support'
        );
      }
      let fence;
      try {
        fence = device.queue.onSubmittedWorkDone();
        if (!fence?.then) {
          throw new TypeError('queue fence did not return a thenable');
        }
      } catch (error) {
        mutation.quarantined = true;
        mutation.quarantineReason = error;
        group.arena.quarantined = true;
        lockOwnership.status = 'quarantined';
        throw error;
      }
      lockOwnership.status = 'retiring';
      const fenceOutcome = Promise.resolve(fence).then(
        () => ({ kind: 'queue-fence' }),
        (error) => ({ kind: 'queue-fence-error', error })
      );
      const retirement = Promise.race([
        fenceOutcome,
        group.completionPromise.then(() => ({ kind: 'terminal-completion' }))
      ]).then((result) => {
        if (result.kind === 'terminal-completion') return true;
        if (
          group.released
          || group.retirementAttempt?.mode === 'device-loss'
        ) {
          return group.completionPromise;
        }
        if (result.kind === 'queue-fence-error') {
          throw result.error;
        }
        if (
          mutation.publicationLock !== publicationLock
          || lockOwnership.status !== 'retiring'
        ) {
          if (mutation.quarantined || group.arena.quarantined) {
            return group.completionPromise;
          }
          const error = new Error(
            'mechanics field private retirement is stale'
          );
          error.code =
            'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
          throw error;
        }
        mutation.publicationLock = null;
        lockOwnership.status = 'retired';
        return allChildStateIdle(group)
          ? startQueueFenceRelease(group, fence)
          : true;
      }).catch((error) => {
        if (
          group.released
          || group.retirementAttempt?.mode === 'device-loss'
        ) {
          return group.completionPromise;
        }
        mutation.quarantined = true;
        mutation.quarantineReason = error;
        group.arena.quarantined = true;
        lockOwnership.status = 'quarantined';
        throw error;
      });
      publicationRetirementOwnership.set(publicationLock, {
        execution,
        promise: retirement
      });
      retirement.catch(() => {});
      return retirement;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function retireStatePublicationLockQueueOrdered(
    execution,
    publicationLock
  ) {
    try {
      const existingRetirement =
        publicationRetirementOwnership.get(publicationLock);
      if (existingRetirement) {
        if (existingRetirement.execution === execution) {
          return existingRetirement.promise;
        }
        const error = new Error(
          'mechanics field private retirement is stale'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      const { group, mutation } = childStateFor(execution);
      const lockOwnership = publicationLockOwnership.get(publicationLock);
      if (
        !group.submitted
        || group.retirementAttempt
        || mutation.publicationLock !== publicationLock
        || lockOwnership?.execution !== execution
        || lockOwnership.status !== 'active'
        || mutation.pending !== null
        || mutation.quarantined
      ) {
        const error = new Error(
          'queue-ordered mechanics field private retirement is stale'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_PUBLICATION_LOCK_STALE';
        throw error;
      }
      mutation.publicationLock = null;
      lockOwnership.status = 'retired';
      const retired = allChildStateIdle(group)
        ? finalizeQueueOrderedRelease(group)
        : true;
      const retirement = Promise.resolve(retired);
      publicationRetirementOwnership.set(publicationLock, {
        execution,
        promise: retirement
      });
      return retirement;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function destroyArenaBuffers(arena) {
    const failures = [];
    for (const { buffer } of allocationEntriesForArena(arena)) {
      if (!buffer || arena.destroyedBuffers.has(buffer)) continue;
      try {
        buffer.destroy?.();
        arena.destroyedBuffers.add(buffer);
      } catch (error) {
        if (buffer.destroyed === true) {
          arena.destroyedBuffers.add(buffer);
        } else {
          failures.push(error);
        }
      }
    }
    arena.radixDeviceLossRetired = true;
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        'mechanics field pair arena retirement was incomplete'
      );
    }
  }

  function permanentlyRetireGroup(group) {
    if (group.released) return true;
    destroyArenaBuffers(group.arena);
    group.arena.retired = true;
    group.arena.quarantined = false;
    return markGroupReleased(group);
  }

  function quarantineWholeGroup(group, reason = null) {
    group.arena.quarantined = true;
    for (const mutation of group.mutations) {
      mutation.quarantined = true;
      if (mutation.quarantineReason == null) {
        mutation.quarantineReason = reason ?? null;
      }
      const lock = publicationLockOwnership.get(mutation.publicationLock);
      if (lock?.status === 'active' || lock?.status === 'retiring') {
        lock.status = 'quarantined';
      }
    }
  }

  function retireQuarantinedExecutionAfter(
    artifact,
    { deviceLost = false } = {}
  ) {
    if (deviceLost === true) {
      return quarantineExecutionAfterDeviceLoss(artifact);
    }
    try {
      const group = rawGroupFor(artifact);
      if (group.retirementAttempt) return group.retirementAttempt.promise;
      if (!group.mutations.some((mutation) => mutation.quarantined)) {
        const error = new Error(
          'mechanics field pair quarantine retirement is stale'
        );
        error.code = 'ERR_SCHROEDER_MECHANICS_FIELD_QUARANTINE_STALE';
        throw error;
      }
      quarantineWholeGroup(group);
      const fence = device.queue?.onSubmittedWorkDone?.();
      if (!fence?.then) {
        throw new TypeError(
          'retireQuarantinedExecutionAfter requires runtime-owned queue-fence evidence'
        );
      }
      const attempt = { mode: 'quarantine-fence', promise: null };
      group.retirementAttempt = attempt;
      group.releaseInFlight = true;
      const promise = Promise.race([
        Promise.resolve(fence).then(
          () => ({ kind: 'queue-fence' }),
          (error) => ({ kind: 'queue-fence-error', error })
        ),
        group.completionPromise.then(() => ({
          kind: 'terminal-completion'
        }))
      ]).then((result) => {
        if (result.kind === 'terminal-completion') return true;
        if (group.released) return true;
        if (group.retirementAttempt !== attempt) {
          return group.completionPromise;
        }
        if (result.kind === 'queue-fence-error') throw result.error;
        return permanentlyRetireGroup(group);
      }).catch((error) => {
        if (
          group.released
          || group.retirementAttempt !== attempt
        ) {
          return group.completionPromise;
        }
        if (group.retirementAttempt === attempt) {
          group.retirementAttempt = null;
          group.releaseInFlight = false;
        }
        throw error;
      });
      attempt.promise = promise;
      promise.catch(() => {});
      return promise;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function quarantineExecutionAfterDeviceLoss(
    artifact,
    { reason = null } = {}
  ) {
    try {
      const group = rawGroupFor(artifact);
      if (group.retirementAttempt?.mode === 'device-loss') {
        return group.retirementAttempt.promise;
      }
      const exactLossEvidence = device?.lost;
      if (!exactLossEvidence?.then) {
        const error = new TypeError(
          'mechanics field pair device-loss quarantine requires the exact GPUDevice.lost promise'
        );
        error.code =
          'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_DEVICE_LOSS_EVIDENCE';
        throw error;
      }
      if (
        group.deviceLossEvidence != null
        && group.deviceLossEvidence !== exactLossEvidence
      ) {
        const error = new Error(
          'mechanics field pair device-loss evidence changed'
        );
        error.code =
          'ERR_SCHROEDER_MECHANICS_FIELD_PAIR_DEVICE_LOSS_EVIDENCE';
        throw error;
      }
      group.deviceLossEvidence = exactLossEvidence;
      markDeviceLossObserved();
      quarantineWholeGroup(group, reason);
      const attempt = { mode: 'device-loss', promise: null };
      group.retirementAttempt = attempt;
      group.releaseInFlight = true;
      getRuntime().status =
        'schroeder-spatial-mechanics-field-pair-gpu-runtime-device-loss-quarantined';
      const promise = Promise.resolve(exactLossEvidence).then(() => {
        if (group.released) return true;
        if (group.retirementAttempt !== attempt) return group.completionPromise;
        return permanentlyRetireGroup(group);
      }).catch((error) => {
        if (group.retirementAttempt === attempt) {
          group.retirementAttempt = null;
          group.releaseInFlight = false;
        }
        throw error;
      });
      attempt.promise = promise;
      promise.catch(() => {});
      return promise;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return Object.freeze({
    registerExecutionGroup,
    ownsExecution,
    markExecutionSubmitted,
    isExecutionSubmitted,
    isExecutionRetirementInFlight,
    executionRetirementCompletionPromise,
    stateMutationState,
    isStateMutationReservationActive,
    reserveStateMutation,
    markStateMutationSubmitted,
    discardStateMutation,
    quarantineStateMutation,
    reserveStateMutationSequence,
    stateMutationSequenceState,
    isStateMutationSequenceSegmentReady,
    isStateMutationSequenceSegmentSubmitted,
    markStateMutationSequenceStageSubmissionObserved,
    isStateMutationSequenceStageSubmissionObserved,
    markStateMutationSequenceStageSubmitted,
    completeStateMutationSequence,
    discardStateMutationSequence,
    quarantineStateMutationSequence,
    acquireStatePublicationLock,
    isStatePublicationLockActive,
    discardStatePublicationLock,
    mintStatePublicationCapability,
    promoteStatePublicationLock,
    retireStatePublicationLockAfter,
    retireStatePublicationLockQueueOrdered,
    quarantineCurrentStateArtifact,
    isStateArtifactQuarantined,
    isCurrentStateArtifact,
    retireQuarantinedExecutionAfter,
    quarantineExecutionAfterDeviceLoss,
    releaseExecution,
    canReleaseExecutionQueueOrdered,
    releaseExecutionQueueOrdered,
    releaseExecutionAfter,
  });
}
