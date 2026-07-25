export const ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA =
  'peercompute.ulg.schroeder-cross-level-reflux-ledger.v3';

export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC = 0x53524c33;
export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION = 3;
export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS = 136;
export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS = 18;

export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY = 1 << 0;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_OVERFLOW = 1 << 3;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_NONFINITE = 1 << 4;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_CFL_REJECTED = 1 << 5;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ENERGY_REJECTED = 1 << 6;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_KEY_REJECTED = 1 << 7;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ROUTE_REJECTED = 1 << 8;
export const SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_PHASE_REJECTED = 1 << 9;

export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ALLOCATED = 0;
export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ACCUMULATING = 1;
export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_SEALED = 2;
export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_COARSE_APPLIED = 3;
export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ENERGY_READY = 4;
export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_G2P_CLAIMED = 5;
export const SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED = 6;

export const SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_EMPTY = 0;
export const SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CLAIMED = 1;
export const SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED = 2;
export const SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_REJECTED = 3;

export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'abiVersion:u32',
  'statusFlags:u32',
  'coarseRegistryCapacity:u32',
  'coarseRegistryCount:u32',
  'rowWords:u32',
  'headerWords:u32',
  'completionOrdinal:u32',
  'committedFineSubstepCount:u32',
  'coarseApplyCount:u32',
  'correctionClampCount:u32',
  'cflRejectCount:u32',
  'invalidCount:u32',
  'keyMismatchCount:u32',
  'routeRejectCount:u32',
  'consumedFineSubstepCount:u32',
  'fineImpulseXKgMPerS:f32-bits',
  'fineImpulseYKgMPerS:f32-bits',
  'fineImpulseZKgMPerS:f32-bits',
  'coarseImpulseXKgMPerS:f32-bits',
  'coarseImpulseYKgMPerS:f32-bits',
  'coarseImpulseZKgMPerS:f32-bits',
  'fineAngularImpulseXKgM2PerS:f32-bits',
  'fineAngularImpulseYKgM2PerS:f32-bits',
  'fineAngularImpulseZKgM2PerS:f32-bits',
  'coarseAngularImpulseXKgM2PerS:f32-bits',
  'coarseAngularImpulseYKgM2PerS:f32-bits',
  'coarseAngularImpulseZKgM2PerS:f32-bits',
  'fineKineticEnergyDeltaJ:f32-bits',
  'coarseKineticEnergyDeltaJ:f32-bits',
  'internalEnergyDepositJ:f32-bits',
  'totalEnergyResidualJ:f32-bits',
  'massResidualKg:f32-bits',
  'firstMassMomentResidualXKgM:f32-bits',
  'firstMassMomentResidualYKgM:f32-bits',
  'firstMassMomentResidualZKgM:f32-bits',
  'linearMomentumResidualXKgMPerS:f32-bits',
  'linearMomentumResidualYKgMPerS:f32-bits',
  'linearMomentumResidualZKgMPerS:f32-bits',
  'angularMomentumResidualXKgM2PerS:f32-bits',
  'angularMomentumResidualYKgM2PerS:f32-bits',
  'angularMomentumResidualZKgM2PerS:f32-bits',
  'maxFineCflRatio:f32-bits',
  'maxCoarseCflRatio:f32-bits',
  'minimumPublishedInternalEnergyJ:f32-bits',
  'momentumToleranceKgMPerS:f32-bits',
  'angularMomentumToleranceKgM2PerS:f32-bits',
  'energyToleranceJ:f32-bits',
  'positivityStatus:u32',
  'cflStatus:u32',
  'massComStatus:u32',
  'momentumStatus:u32',
  'angularMomentumStatus:u32',
  'energyStatus:u32',
  'substepCount:u32',
  'ratioNumerator:u32',
  'ratioDenominator:u32',
  'boundaryRejectCount:u32',
  'chartRejectCount:u32',
  'phase:u32',
  'registryGeneration:u32',
  'finalCoarseMutationInputOrdinal:u32',
  'finalCoarseMutationOutputOrdinal:u32',
  'finalCoarseStateEncoding:u32',
  'finalGenerationId:u32',
  'finalDeviceOrdinal:u32',
  'finalLaneOrdinal:u32',
  'finalLeaseToken:u32',
  'finalSourceFamilyId:u32',
  'finalStorageGeneration:u32',
  'finalPhysicsTick:u32',
  'finalPhysicsSubstep:u32',
  'finalPositionEpoch:u32',
  'finalTopologyEpoch:u32',
  'finalChartEpoch:u32',
  'finalLevelEpoch:u32',
  'finalSupportEpoch:u32',
  'fineLevel:i32-bits',
  'coarseLevel:i32-bits',
  'coarseGridSpacingM:f32-bits',
  'terminalReceiptState:u32',
  'terminalReceiptToken:u32',
  'macroOwnerId:u32',
  'macroOwnerGeneration:u32',
  'particleConsumedHeatJ:f32-bits',
  'massSumAbsKg:f32-bits',
  'firstMassMomentSumAbsKgM:f32-bits',
  'linearMomentumSumAbsKgMPerS:f32-bits',
  'angularMomentumSumAbsKgM2PerS:f32-bits',
  'totalEnergySumAbsJ:f32-bits',
  'partitionOfUnityResidual:f32-bits',
  'partitionOfUnitySumAbs:f32-bits',
  'firstMomentResidualM:f32-bits',
  'firstMomentSumAbsM:f32-bits',
  'measurementContributionCount:u32',
  'publicationToken:u32',
  'terminalG2pConsumeCount:u32',
  'capturedOperationCount:u32',
  'expectedOperationCount:u32',
  'finalP2gAuthorityStatus:u32',
  'finalG2pAuthorityStatus:u32',
  'particleHeatStatus:u32',
  'exactCountStatus:u32',
  'publicationStatus:u32',
  'fineP2gAuthorityRejectCount:u32',
  'fineG2pAuthorityRejectCount:u32',
  'finalP2gAuthorityRejectCount:u32',
  'finalG2pAuthorityRejectCount:u32',
  'receiptReplayRejectCount:u32',
  'receiptSkipRejectCount:u32',
  'receiptDuplicateRejectCount:u32',
  'transactionMutationToken:u32',
  'cumulativeFineRouteHeatJ:f32-bits',
  'coarseDeferredRouteHeatJ:f32-bits',
  'fineParticleConsumedRouteHeatJ:f32-bits',
  'coarseParticleConsumedRouteHeatJ:f32-bits',
  'cumulativeLocalHeatJ:f32-bits',
  'particleConsumedLocalHeatJ:f32-bits',
  'localHeatStatus:u32',
  'routeHeatStatus:u32',
  'fineReceiptConsumeCount:u32',
  'coarseReceiptConsumeCount:u32',
  'mutationRollbackCount:u32',
  'arenaGeneration:u32',
  'statusCaptureSentinel:u32',
  'statusCaptureMissingCount:u32',
  'operatorSplitSynchronizationWorkJ:f32-bits',
  'operatorSplitSynchronizationWorkConditioningSumAbsJ:f32-bits',
  'fineCrossLevelPressureCompensationJ:f32-bits',
  'coarseCrossLevelPressureCompensationJ:f32-bits',
  'fineCrossLevelDragHeatJ:f32-bits',
  'coarseCrossLevelDragHeatJ:f32-bits',
  'cumulativeAmbientImpulseXNs:f32-bits',
  'cumulativeAmbientImpulseYNs:f32-bits',
  'cumulativeAmbientImpulseZNs:f32-bits',
  'cumulativeAmbientExternalWorkJ:f32-bits'
]);

export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_LAYOUT = Object.freeze([
  'coarseDenseNodeIndex:u32',
  'mechanicalFamilyId:u32',
  'materialId:u32',
  'continuityDomainId:u32',
  'frozenMassKg:f32-bits',
  'refluxMomentumXKgMPerS:f32-bits',
  'refluxMomentumYKgMPerS:f32-bits',
  'refluxMomentumZKgMPerS:f32-bits',
  'internalEnergyDepositJ:f32-bits',
  'coarseKineticEnergyDeltaJ:f32-bits',
  'appliedMomentumXKgMPerS:f32-bits',
  'appliedMomentumYKgMPerS:f32-bits',
  'appliedMomentumZKgMPerS:f32-bits',
  'contributionCount:u32',
  'registryFlags:u32',
  'cumulativeCausalLossWeightJ:f32-bits',
  'cumulativeCoarsePressureCompensationJ:f32-bits',
  'cumulativeCoarseDragHeatJ:f32-bits'
]);

const UINT32_MAX = 0xffff_ffff;

function positiveInteger(value, label) {
  const number = value;
  if (!Number.isInteger(number) || number < 1 || number > UINT32_MAX) {
    throw new RangeError(`${label} must be a positive u32 integer`);
  }
  return number;
}

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = value;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function finitePositiveF32(value, label) {
  if (typeof value !== 'number') {
    throw new RangeError(`${label} must be a positive finite f32`);
  }
  const number = Math.fround(value);
  if (!Number.isFinite(number) || !(number > 0)) {
    throw new RangeError(`${label} must be a positive finite f32`);
  }
  return number;
}

export function createSchroederCrossLevelRefluxLedgerLayout({
  parentFieldCapacity,
  coarseFieldCapacity = parentFieldCapacity
} = {}) {
  const sourceParentFieldCapacity = positiveInteger(
    parentFieldCapacity,
    'parentFieldCapacity'
  );
  const rowCapacity = positiveInteger(
    coarseFieldCapacity,
    'coarseFieldCapacity'
  );
  const wordLength = SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
    + rowCapacity * SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS;
  if (!Number.isSafeInteger(wordLength) || wordLength > UINT32_MAX) {
    throw new RangeError('cross-level reflux ledger exceeds the u32 word range');
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
    sourceParentFieldCapacity,
    sourceCoarseFieldCapacity: rowCapacity,
    rowCapacity,
    headerWords: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
    rowWords: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS,
    rowOffsetWords: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederCrossLevelRefluxLedgerHeader({
  rowCapacity,
  completionOrdinal = 1,
  fineSubstepCount = 1,
  fineLevel = 0,
  coarseLevel = fineLevel + 1,
  coarseGridSpacingM = 1,
  macroOwnerId = completionOrdinal,
  macroOwnerGeneration = 1
} = {}) {
  const capacity = positiveInteger(rowCapacity, 'rowCapacity');
  const completion = positiveInteger(completionOrdinal, 'completionOrdinal');
  const substeps = positiveInteger(fineSubstepCount, 'fineSubstepCount');
  if (substeps === UINT32_MAX) {
    throw new RangeError('fineSubstepCount + terminal operation exceeds u32');
  }
  const fine = integer(fineLevel, 'fineLevel', -0x8000_0000, 0x7fff_ffff);
  const coarse = integer(coarseLevel, 'coarseLevel', -0x8000_0000, 0x7fff_ffff);
  if (coarse !== fine + 1) {
    throw new RangeError('coarseLevel must be exactly fineLevel + 1');
  }
  const spacing = finitePositiveF32(coarseGridSpacingM, 'coarseGridSpacingM');
  const ownerId = positiveInteger(macroOwnerId, 'macroOwnerId');
  const ownerGeneration = positiveInteger(
    macroOwnerGeneration,
    'macroOwnerGeneration'
  );
  const words = new Uint32Array(
    SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
  );
  const floats = new Float32Array(words.buffer);
  words[0] = SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC;
  words[1] = SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION;
  // Allocation is structural only. The first GPU registry pass admits the
  // frozen ordered coarse-key dictionary and advances to ACCUMULATING.
  words[2] = 0;
  words[3] = capacity;
  words[5] = SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS;
  words[6] = SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS;
  words[7] = completion;
  floats[44] = Number.POSITIVE_INFINITY;
  words[54] = substeps;
  words[55] = 2;
  words[56] = 1;
  words[59] = SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_ALLOCATED;
  words[77] = fine >>> 0;
  words[78] = coarse >>> 0;
  floats[79] = spacing;
  words[80] = SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_EMPTY;
  words[82] = ownerId;
  words[83] = ownerGeneration;
  words[98] = substeps + 1;
  // Transaction tokens are one-based: each fine commit increments once and
  // the terminal commit leaves H111 == expectedOperationCount + 1.
  words[111] = 1;
  words[123] = ownerGeneration;
  words[124] = UINT32_MAX;
  return words;
}

function f32(words, word) {
  return new Float32Array(words.buffer, words.byteOffset, words.length)[word];
}

function finiteF32Value(value, label, { nonnegative = false } = {}) {
  if (typeof value !== 'number') {
    throw new RangeError(`${label} must be a finite f32`);
  }
  const number = Math.fround(value);
  if (!Number.isFinite(number) || (nonnegative && number < 0)) {
    throw new RangeError(
      `${label} must be a ${nonnegative ? 'nonnegative ' : ''}finite f32`
    );
  }
  return number;
}

const addF32 = (left, right) => Math.fround(
  Math.fround(left) + Math.fround(right)
);
const subtractF32 = (left, right) => Math.fround(
  Math.fround(left) - Math.fround(right)
);

/**
 * Host oracle for the terminal reflux energy seal. Virtual coarse work is the
 * causal heat basis; the actual-minus-virtual temporal synchronization term is
 * explicit evidence and is never deposited as particle heat.
 */
export function deriveSchroederCrossLevelRefluxEnergyClosure({
  fineKineticEnergyDeltaJ,
  virtualCoarseKineticEnergyDeltaJ,
  actualCoarseKineticEnergyDeltaJ,
  cumulativeFineRouteHeatJ,
  fineCrossLevelPressureCompensationJ = 0,
  coarseCrossLevelPressureCompensationJ = 0,
  fineCrossLevelDragHeatJ = 0,
  coarseCrossLevelDragHeatJ = 0,
  actualCoarseEnergyConditioningSumAbsJ = Math.abs(
    actualCoarseKineticEnergyDeltaJ
  ),
  virtualCoarseEnergyConditioningSumAbsJ = Math.abs(
    virtualCoarseKineticEnergyDeltaJ
  )
} = {}) {
  const fine = finiteF32Value(
    fineKineticEnergyDeltaJ,
    'fineKineticEnergyDeltaJ'
  );
  const virtual = finiteF32Value(
    virtualCoarseKineticEnergyDeltaJ,
    'virtualCoarseKineticEnergyDeltaJ'
  );
  const actual = finiteF32Value(
    actualCoarseKineticEnergyDeltaJ,
    'actualCoarseKineticEnergyDeltaJ'
  );
  const fineHeat = finiteF32Value(
    cumulativeFineRouteHeatJ,
    'cumulativeFineRouteHeatJ',
    { nonnegative: true }
  );
  const finePressure = finiteF32Value(
    fineCrossLevelPressureCompensationJ,
    'fineCrossLevelPressureCompensationJ'
  );
  const coarsePressure = finiteF32Value(
    coarseCrossLevelPressureCompensationJ,
    'coarseCrossLevelPressureCompensationJ'
  );
  const fineDragHeat = finiteF32Value(
    fineCrossLevelDragHeatJ,
    'fineCrossLevelDragHeatJ',
    { nonnegative: true }
  );
  const coarseDragHeat = finiteF32Value(
    coarseCrossLevelDragHeatJ,
    'coarseCrossLevelDragHeatJ',
    { nonnegative: true }
  );
  const actualScale = finiteF32Value(
    actualCoarseEnergyConditioningSumAbsJ,
    'actualCoarseEnergyConditioningSumAbsJ',
    { nonnegative: true }
  );
  const virtualScale = finiteF32Value(
    virtualCoarseEnergyConditioningSumAbsJ,
    'virtualCoarseEnergyConditioningSumAbsJ',
    { nonnegative: true }
  );
  const synchronizationWorkJ = subtractF32(actual, virtual);
  const synchronizationConditioningSumAbsJ = addF32(
    actualScale,
    virtualScale
  );
  const pressureCompensationJ = addF32(finePressure, coarsePressure);
  const crossLevelDragHeatJ = addF32(fineDragHeat, coarseDragHeat);
  const causalKineticEnergyResidualJ = addF32(
    addF32(fine, virtual),
    pressureCompensationJ
  );
  const causalRouteHeatJ = Math.fround(Math.max(
    0,
    -causalKineticEnergyResidualJ
  ));
  const deferredRouteHeatUnclampedJ = subtractF32(
    causalRouteHeatJ,
    fineHeat
  );
  const coarseDeferredRouteHeatJ = Math.fround(Math.max(
    0,
    deferredRouteHeatUnclampedJ
  ));
  const totalRouteHeatJ = addF32(fineHeat, coarseDeferredRouteHeatJ);
  const causalEnergyResidualJ = addF32(
    causalKineticEnergyResidualJ,
    totalRouteHeatJ
  );
  const actualKineticEnergyResidualJ = addF32(
    addF32(fine, actual),
    pressureCompensationJ
  );
  const totalEnergyResidualJ = subtractF32(
    addF32(actualKineticEnergyResidualJ, totalRouteHeatJ),
    synchronizationWorkJ
  );
  const synchronizationToleranceJ = Math.fround(Math.max(
    8 * 1.175494351e-38,
    1024 * 2 ** -24 * synchronizationConditioningSumAbsJ
  ));
  const causalEnergyConditioningSumAbsJ = addF32(
    addF32(Math.abs(fine), virtualScale),
    addF32(Math.abs(finePressure), Math.abs(coarsePressure))
  );
  const causalEnergyToleranceJ = Math.fround(Math.max(
    8 * 1.175494351e-38,
    1024 * 2 ** -24 * causalEnergyConditioningSumAbsJ
  ));
  const totalEnergyConditioningSumAbsJ = addF32(
    addF32(
      addF32(Math.abs(fine), actualScale),
      addF32(Math.abs(finePressure), Math.abs(coarsePressure))
    ),
    addF32(Math.abs(totalRouteHeatJ), Math.abs(synchronizationWorkJ))
  );
  const totalEnergyToleranceJ = Math.fround(Math.max(
    8 * 1.175494351e-38,
    1024 * 2 ** -24 * totalEnergyConditioningSumAbsJ
  ));
  const causalValid = causalKineticEnergyResidualJ <= causalEnergyToleranceJ
    && deferredRouteHeatUnclampedJ >= -causalEnergyToleranceJ
    && fineDragHeat <= fineHeat + causalEnergyToleranceJ
    && coarseDragHeat
      <= coarseDeferredRouteHeatJ + causalEnergyToleranceJ
    && crossLevelDragHeatJ
      <= totalRouteHeatJ + causalEnergyToleranceJ
    && Math.abs(causalEnergyResidualJ) <= causalEnergyToleranceJ;
  const operatorSplitValid = Math.abs(synchronizationWorkJ)
    <= synchronizationConditioningSumAbsJ + synchronizationToleranceJ;
  const totalValid = Math.abs(totalEnergyResidualJ) <= totalEnergyToleranceJ;
  return Object.freeze({
    fineKineticEnergyDeltaJ: fine,
    virtualCoarseKineticEnergyDeltaJ: virtual,
    actualCoarseKineticEnergyDeltaJ: actual,
    fineCrossLevelPressureCompensationJ: finePressure,
    coarseCrossLevelPressureCompensationJ: coarsePressure,
    pressureCompensationJ,
    fineCrossLevelDragHeatJ: fineDragHeat,
    coarseCrossLevelDragHeatJ: coarseDragHeat,
    crossLevelDragHeatJ,
    causalKineticEnergyResidualJ,
    causalRouteHeatJ,
    cumulativeFineRouteHeatJ: fineHeat,
    deferredRouteHeatUnclampedJ,
    coarseDeferredRouteHeatJ,
    totalRouteHeatJ,
    causalEnergyResidualJ,
    actualKineticEnergyResidualJ,
    synchronizationWorkJ,
    synchronizationConditioningSumAbsJ,
    synchronizationToleranceJ,
    totalEnergyResidualJ,
    causalEnergyConditioningSumAbsJ,
    causalEnergyToleranceJ,
    totalEnergyConditioningSumAbsJ,
    totalEnergyToleranceJ,
    causalValid,
    operatorSplitValid,
    totalValid,
    valid: causalValid && operatorSplitValid && totalValid
  });
}

export function decodeSchroederCrossLevelRefluxEvidence(words) {
  if (!(words instanceof Uint32Array)
    || words.length < SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS) {
    return null;
  }
  const vector = (word) => [f32(words, word), f32(words, word + 1), f32(words, word + 2)];
  const structuralValid = words[0] === SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC
    && words[1] === SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION
    && words[3] > 0
    && words[5] === SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS
    && words[6] === SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
    && words[4] <= words[3]
    && words[8] <= words[54]
    && words[15] <= words[8]
    && words[54] > 0
    && words[82] > 0
    && words[83] > 0
    && words[98] === words[54] + 1
    && new Int32Array(words.buffer, words.byteOffset, words.length)[78]
      === new Int32Array(words.buffer, words.byteOffset, words.length)[77] + 1
    && Number.isFinite(f32(words, 79))
    && f32(words, 79) > 0
    && SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS
      + words[3] * SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS
      <= words.length;
  const statusAdmitted = structuralValid && words[2] === (
    SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_READY
    | SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_ADMITTED
  );
  const synchronizationWorkJ = f32(words, 126);
  const synchronizationConditioningSumAbsJ = f32(words, 127);
  const synchronizationToleranceJ = Math.max(
    8 * 1.175494351e-38,
    1024 * 2 ** -24 * synchronizationConditioningSumAbsJ
  );
  const operatorSplitValid = Number.isFinite(synchronizationWorkJ)
    && Number.isFinite(synchronizationConditioningSumAbsJ)
    && synchronizationConditioningSumAbsJ >= 0
    && Math.abs(synchronizationWorkJ)
      <= synchronizationConditioningSumAbsJ + synchronizationToleranceJ;
  const fineCrossLevelPressureCompensationJ = f32(words, 128);
  const coarseCrossLevelPressureCompensationJ = f32(words, 129);
  const fineCrossLevelDragHeatJ = f32(words, 130);
  const coarseCrossLevelDragHeatJ = f32(words, 131);
  const phaseVolumeToleranceJ = Math.max(
    8 * 1.175494351e-38,
    1024 * 2 ** -24 * (
      Math.abs(f32(words, 112))
        + Math.abs(f32(words, 113))
        + fineCrossLevelDragHeatJ
        + coarseCrossLevelDragHeatJ
    )
  );
  const phaseVolumeTransportValid =
    Number.isFinite(fineCrossLevelPressureCompensationJ)
    && Number.isFinite(coarseCrossLevelPressureCompensationJ)
    && Number.isFinite(fineCrossLevelDragHeatJ)
    && fineCrossLevelDragHeatJ >= 0
    && Number.isFinite(coarseCrossLevelDragHeatJ)
    && coarseCrossLevelDragHeatJ >= 0
    && fineCrossLevelDragHeatJ
      <= f32(words, 112) + phaseVolumeToleranceJ
    && coarseCrossLevelDragHeatJ
      <= f32(words, 113) + phaseVolumeToleranceJ;
  const cumulativeAmbientImpulseNs = [
    f32(words, 132),
    f32(words, 133),
    f32(words, 134)
  ];
  const cumulativeAmbientExternalWorkJ = f32(words, 135);
  const ambientBoundaryValid = cumulativeAmbientImpulseNs.every(Number.isFinite)
    && Number.isFinite(cumulativeAmbientExternalWorkJ);
  const terminalAdmitted = statusAdmitted
    && words[8] === words[54]
    && words[9] === words[4]
    && words[15] === words[54]
    && words[59] === SCHROEDER_CROSS_LEVEL_REFLUX_PHASE_CONSUMED
    && words[80] === SCHROEDER_CROSS_LEVEL_REFLUX_TERMINAL_RECEIPT_CONSUMED
    && words[81] !== 0
    && words[95] === words[81]
    && words[96] === 1
    && words[97] === words[98]
    && words[99] === 1
    && words[100] === 1
    && words[101] === 1
    && words[102] === 1
    && words[103] === 1
    && words[111] === words[98] + 1
    && words[118] === 1
    && words[119] === 1
    && words[120] === words[54]
    && words[121] === 1
    && words[124] === UINT32_MAX
    && words[125] === 0
    && operatorSplitValid
    && phaseVolumeTransportValid
    && ambientBoundaryValid;
  return Object.freeze({
    schema: ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
    magic: words[0],
    abiVersion: words[1],
    statusFlags: words[2],
    structuralValid,
    admitted: statusAdmitted,
    terminalAdmitted,
    failClosed: (words[2] & SCHROEDER_CROSS_LEVEL_REFLUX_STATUS_FAIL_CLOSED) !== 0,
    rowCapacity: words[3],
    rowCount: words[4],
    completionOrdinal: words[7],
    committedFineSubstepCount: words[8],
    coarseApplyCount: words[9],
    correctionClampCount: words[10],
    cflRejectCount: words[11],
    invalidCount: words[12],
    keyMismatchCount: words[13],
    routeRejectCount: words[14],
    consumedFineSubstepCount: words[15],
    fineImpulseKgMPerS: vector(16),
    coarseImpulseKgMPerS: vector(19),
    fineAngularImpulseKgM2PerS: vector(22),
    coarseAngularImpulseKgM2PerS: vector(25),
    fineKineticEnergyDeltaJ: f32(words, 28),
    coarseKineticEnergyDeltaJ: f32(words, 29),
    internalEnergyDepositJ: f32(words, 30),
    totalEnergyResidualJ: f32(words, 31),
    massResidualKg: f32(words, 32),
    firstMassMomentResidualKgM: vector(33),
    linearMomentumResidualKgMPerS: vector(36),
    angularMomentumResidualKgM2PerS: vector(39),
    maxFineCflRatio: f32(words, 42),
    maxCoarseCflRatio: f32(words, 43),
    minimumPublishedInternalEnergyJ: f32(words, 44),
    tolerance: Object.freeze({
      linearMomentumKgMPerS: f32(words, 45),
      angularMomentumKgM2PerS: f32(words, 46),
      totalEnergyJ: f32(words, 47)
    }),
    positivityStatus: words[48],
    cflStatus: words[49],
    massComStatus: words[50],
    momentumStatus: words[51],
    angularMomentumStatus: words[52],
    energyStatus: words[53],
    fineSubstepCount: words[54],
    levelRatio: [words[55], words[56]],
    boundaryRejectCount: words[57],
    chartRejectCount: words[58],
    phase: words[59],
    registryGeneration: words[60],
    finalCoarseMutationInputOrdinal: words[61],
    finalCoarseMutationOutputOrdinal: words[62],
    finalCoarseStateEncoding: words[63],
    finalIdentity: Object.freeze({
      generationId: words[64],
      deviceOrdinal: words[65],
      laneOrdinal: words[66],
      leaseToken: words[67],
      sourceFamilyId: words[68],
      storageGeneration: words[69],
      physicsTick: words[70],
      physicsSubstep: words[71],
      positionEpoch: words[72],
      topologyEpoch: words[73],
      chartEpoch: words[74],
      levelEpoch: words[75],
      supportEpoch: words[76]
    }),
    fineLevel: new Int32Array(words.buffer, words.byteOffset, words.length)[77],
    coarseLevel: new Int32Array(words.buffer, words.byteOffset, words.length)[78],
    coarseGridSpacingM: f32(words, 79),
    terminalReceiptState: words[80],
    terminalReceiptToken: words[81],
    macroOwnerId: words[82],
    macroOwnerGeneration: words[83],
    particleConsumedHeatJ: f32(words, 84),
    measuredScale: Object.freeze({
      massSumAbsKg: f32(words, 85),
      firstMassMomentSumAbsKgM: f32(words, 86),
      linearMomentumSumAbsKgMPerS: f32(words, 87),
      angularMomentumSumAbsKgM2PerS: f32(words, 88),
      totalEnergySumAbsJ: f32(words, 89),
      partitionOfUnityResidual: f32(words, 90),
      partitionOfUnitySumAbs: f32(words, 91),
      firstMomentResidualM: f32(words, 92),
      firstMomentSumAbsM: f32(words, 93),
      contributionCount: words[94]
    }),
    publicationToken: words[95],
    terminalG2pConsumeCount: words[96],
    capturedOperationCount: words[97],
    expectedOperationCount: words[98],
    finalP2gAuthorityStatus: words[99],
    finalG2pAuthorityStatus: words[100],
    particleHeatStatus: words[101],
    exactCountStatus: words[102],
    publicationStatus: words[103],
    authorityRejectCount: Object.freeze({
      fineP2g: words[104],
      fineG2p: words[105],
      finalP2g: words[106],
      finalG2p: words[107]
    }),
    receiptRejectCount: Object.freeze({
      replay: words[108],
      skip: words[109],
      duplicate: words[110]
    }),
    transactionMutationToken: words[111],
    heatSplit: Object.freeze({
      cumulativeFineRouteHeatJ: f32(words, 112),
      coarseDeferredRouteHeatJ: f32(words, 113),
      fineParticleConsumedRouteHeatJ: f32(words, 114),
      coarseParticleConsumedRouteHeatJ: f32(words, 115),
      cumulativeLocalHeatJ: f32(words, 116),
      particleConsumedLocalHeatJ: f32(words, 117),
      localHeatStatus: words[118],
      routeHeatStatus: words[119]
    }),
    fineReceiptConsumeCount: words[120],
    coarseReceiptConsumeCount: words[121],
    mutationRollbackCount: words[122],
    arenaGeneration: words[123],
    statusCaptureSentinel: words[124],
    statusCaptureMissingCount: words[125],
    operatorSplit: Object.freeze({
      synchronizationWorkJ,
      synchronizationConditioningSumAbsJ,
      synchronizationToleranceJ,
      valid: operatorSplitValid
    }),
    phaseVolumeTransport: Object.freeze({
      fineCrossLevelPressureCompensationJ,
      coarseCrossLevelPressureCompensationJ,
      fineCrossLevelDragHeatJ,
      coarseCrossLevelDragHeatJ,
      toleranceJ: phaseVolumeToleranceJ,
      valid: phaseVolumeTransportValid
    }),
    ambientBoundary: Object.freeze({
      cumulativeImpulseNs: Object.freeze(cumulativeAmbientImpulseNs),
      cumulativeExternalWorkJ: cumulativeAmbientExternalWorkJ,
      valid: ambientBoundaryValid
    })
  });
}

export const SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ABI = Object.freeze({
  schema: ULG_SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_SCHEMA,
  magic: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_MAGIC,
  version: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_VERSION,
  headerWords: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_WORDS,
  rowWords: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_WORDS,
  headerLayout: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_HEADER_LAYOUT,
  rowLayout: SCHROEDER_CROSS_LEVEL_REFLUX_LEDGER_ROW_LAYOUT,
  ownership:
    'private-device-lineage-plus-gpu-macro-owner-id-and-generation',
  transaction:
    'expected-committed-consumed-substep-counts-and-terminal-consumed-publication-token',
  registry: 'macro-frozen-ordered-full-coarse-key-and-mass-dictionary',
  accumulation: 'coarse-field-ordinal-aligned-phase-separated',
  route: 'coherent-causal-cohort-affine-transpose',
  operatorSplit:
    'causal-virtual-reflux-heat-plus-explicit-coarse-temporal-synchronization-work',
  phaseVolumeTransport:
    'signed-cross-level-pressure-compensation-plus-nonnegative-drag-heat',
  ambientBoundary:
    'sealed-external-ambient-impulse-and-kinetic-work-never-deposited-as-particle-heat',
  readbackPolicy: 'normal-path-gpu-canonicalization;fixed-header-explicit-audit-only'
});
