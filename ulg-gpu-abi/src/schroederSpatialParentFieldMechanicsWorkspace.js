export const ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-parent-field-mechanics-workspace.v4';

export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_MAGIC = 0x53505733;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION = 4;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS = 104;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS = 16;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS = 16;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS = 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARAMS_BYTES = 304;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ATOMIC_SCALE = 65536;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_BINDING_ALIGNMENT_WORDS =
  64;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARENT_TO_COARSE_ORDINAL_ENCODING =
  'zero-absent-u32-max-minus-ordinal-v1';

export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_READY = 1 << 0;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_ADMITTED = 1 << 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_FAIL_CLOSED = 1 << 2;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_SOURCE = 1 << 3;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_OVERFLOW = 1 << 4;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_NONFINITE = 1 << 5;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_KEY = 1 << 6;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_CSR = 1 << 7;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_REGISTRY = 1 << 8;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_INVALID_ROUTE = 1 << 9;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_ENERGY_REJECTED = 1 << 10;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_STATUS_CFL_REJECTED = 1 << 11;

export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_CLEARED = 0;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_BUILDING_MOMENTUM = 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_PREDICTOR_VELOCITY_READY = 2;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_FINE_CORRECTION_COMPLETE = 3;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PHASE_COARSE_PUBLISH_COMPLETE = 4;

export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_PARTICLE_OWNED_UNTOUCHED = 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_STRUCTURAL_UNMEASURED = 1;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_INTERNAL_ENERGY_REFLUX_DEPOSIT = 2;
export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_REFLUX_MEASURED_CONSERVATIVE = 2;

export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'abiVersion:u32',
  'statusFlags:u32',
  'generationId:u32',
  'deviceOrdinal:u32',
  'laneOrdinal:u32',
  'leaseToken:u32',
  'sourceFamilyId:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'chartEpoch:u32',
  'levelEpoch:u32',
  'supportEpoch:u32',
  'fineLevel:i32-bits',
  'coarseLevel:i32-bits',
  'fineFieldCapacity:u32',
  'coarseFieldCapacity:u32',
  'parentFieldCapacity:u32',
  'fineFieldCount:u32',
  'coarseFieldCount:u32',
  'parentFieldCount:u32',
  'edgeCount:u32',
  'accumulatorOffsetWords:u32',
  'baselineStateOffsetWords:u32',
  'combinedStateOffsetWords:u32',
  'rowWords:u32',
  'requiredWords:u32',
  'capacityWords:u32',
  'atomicScale:f32-bits',
  'dt:f32-bits',
  'deltaScale:f32-bits',
  'cflFactor:f32-bits',
  'maxCorrectionMPerS:f32-bits',
  'phase:u32',
  'invalidSourceCount:u32',
  'overflowCount:u32',
  'nonfiniteCount:u32',
  'invalidKeyCount:u32',
  'invalidCsrCount:u32',
  'restrictedEdgeCount:u32',
  'injectedCoarseCount:u32',
  'baselineActiveCount:u32',
  'combinedActiveCount:u32',
  'prolongedFineCount:u32',
  'publishedCoarseCount:u32',
  'fineFirstMomentResidualM:f32-bits',
  'fineFirstMomentSumAbsM:f32-bits',
  'finePartitionOfUnityResidual:f32-bits',
  'finePartitionOfUnitySumAbs:f32-bits',
  'completionOrdinal:u32',
  'parentCompletionOrdinal:u32',
  'fineCompletionOrdinal:u32',
  'coarseCompletionOrdinal:u32',
  'fineInputStateEncoding:u32',
  'coarseInputStateEncoding:u32',
  'fineOutputStateEncoding:u32',
  'coarseOutputStateEncoding:u32',
  'parentDispatchX:u32',
  'parentDispatchY:u32',
  'parentDispatchZ:u32',
  'fineDispatchX:u32',
  'fineDispatchY:u32',
  'fineDispatchZ:u32',
  'coarseDispatchX:u32',
  'coarseDispatchY:u32',
  'coarseDispatchZ:u32',
  'operationOrdinal:u32',
  'finalizationOrdinal:u32',
  'internalEnergyTransferStatus:u32',
  'refluxEvidenceStatus:u32',
  'fineImpulseOffsetWords:u32',
  'fineImpulseRowWords:u32',
  'routeProposalRowWords:u32',
  'fineSubstepOrdinal:u32',
  'coarsePredictorStateOffsetWords:u32',
  'routeProposalOffsetWords:u32',
  'parentToCoarseOrdinalOffsetWords:u32',
  'proposedFineLinearEnergyCoefficientJ:f32-bits',
  'proposedFineQuadraticEnergyCoefficientJ:f32-bits',
  'proposedCoarseLinearEnergyCoefficientJ:f32-bits',
  'proposedCoarseQuadraticEnergyCoefficientJ:f32-bits',
  'sealedRouteCflAlpha:f32-bits',
  'sealedCorrectionAlpha:f32-bits',
  'routeRejectCount:u32',
  'registryRejectCount:u32',
  'causalChannelCount:u32',
  'proposedFineCount:u32',
  'proposedFineImpulseXKgMPerS:f32-bits',
  'proposedFineImpulseYKgMPerS:f32-bits',
  'proposedFineImpulseZKgMPerS:f32-bits',
  'proposedCoarseImpulseXKgMPerS:f32-bits',
  'proposedCoarseImpulseYKgMPerS:f32-bits',
  'proposedCoarseImpulseZKgMPerS:f32-bits',
  'proposedFineAngularImpulseXKgM2PerS:f32-bits',
  'proposedFineAngularImpulseYKgM2PerS:f32-bits',
  'proposedFineAngularImpulseZKgM2PerS:f32-bits',
  'proposedCoarseAngularImpulseXKgM2PerS:f32-bits',
  'proposedCoarseAngularImpulseYKgM2PerS:f32-bits',
  'proposedCoarseAngularImpulseZKgM2PerS:f32-bits',
  'proposedMomentumToleranceKgMPerS:f32-bits',
  'proposedAngularToleranceKgM2PerS:f32-bits'
]);

export const SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ABI = Object.freeze({
  schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
  version: SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION,
  headerLayout: SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT,
  row: Object.freeze([
    'mass:f32-or-fixed-i32-bits',
    'momentumOrVelocityX:f32-or-fixed-i32-bits',
    'momentumOrVelocityY:f32-or-fixed-i32-bits',
    'momentumOrVelocityZ:f32-or-fixed-i32-bits',
    'massGradientX:f32-or-fixed-i32-bits',
    'massGradientY:f32-or-fixed-i32-bits',
    'massGradientZ:f32-or-fixed-i32-bits',
    'contributionCountOrActive:u32'
  ]),
  topologyAuthority: 'immutable-schroeder-spatial-parent-field-view-v1',
  stateAuthority: 'mutable-per-generation-operation-workspace',
  transaction:
    'validate-and-seal-stored-fine-impulses-before-ordered-ledger-commit-then-physical-apply',
  transfer:
    'weighted-fine-restriction-plus-exact-native-coarse-injection-and-transpose-velocity-delta-prolongation',
  internalEnergyTransfer:
    'nonnegative-grid-kinetic-loss-deposited-through-transpose-g2p',
  refluxEvidence:
    'keyed-equal-opposite-linear-angular-momentum-pressure-drag-and-total-energy-ledger',
  parentToCoarseOrdinalEncoding:
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARENT_TO_COARSE_ORDINAL_ENCODING,
  thirdLevel: 'forbidden'
});

const UINT32_MAX = 0xffff_ffff;

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function checkedAdd(left, right, label) {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return value;
}

function checkedMultiply(left, right, label) {
  const value = left * right;
  if (!Number.isSafeInteger(value) || value > UINT32_MAX) {
    throw new RangeError(`${label} exceeds the u32 word range`);
  }
  return value;
}

function checkedAlignWords(value, alignment, label) {
  const remainder = value % alignment;
  return remainder === 0
    ? value
    : checkedAdd(value, alignment - remainder, label);
}

export function createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
  parentFieldCapacity,
  fineFieldCapacity = parentFieldCapacity
} = {}) {
  const capacity = integer(parentFieldCapacity, 'parentFieldCapacity', 1);
  const fineCapacity = integer(
    fineFieldCapacity,
    'fineFieldCapacity',
    1
  );
  const bankWords = checkedMultiply(
    capacity,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROW_WORDS,
    'parent mechanics workspace bank'
  );
  const accumulatorOffsetWords =
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS;
  const baselineStateOffsetWords = checkedAdd(
    accumulatorOffsetWords,
    bankWords,
    'baseline state offset'
  );
  const combinedStateOffsetWords = checkedAdd(
    baselineStateOffsetWords,
    bankWords,
    'combined state offset'
  );
  const coarsePredictorStateOffsetWords = checkedAdd(
    combinedStateOffsetWords,
    bankWords,
    'coarse predictor state offset'
  );
  const routeProposalOffsetWords = checkedAdd(
    coarsePredictorStateOffsetWords,
    bankWords,
    'route proposal offset'
  );
  const routeProposalWords = checkedMultiply(
    capacity,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS,
    'route proposal range'
  );
  const fineImpulseOffsetWords = checkedAdd(
    routeProposalOffsetWords,
    routeProposalWords,
    'fine impulse offset'
  );
  const fineImpulseWords = checkedMultiply(
    fineCapacity,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
    'fine impulse range'
  );
  const unalignedParentToCoarseOrdinalOffsetWords = checkedAdd(
    fineImpulseOffsetWords,
    fineImpulseWords,
    'parent-to-coarse reverse-map offset'
  );
  const parentToCoarseOrdinalOffsetWords = checkedAlignWords(
    unalignedParentToCoarseOrdinalOffsetWords,
    SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_BINDING_ALIGNMENT_WORDS,
    'parent-to-coarse reverse-map binding alignment'
  );
  const parentToCoarseOrdinalPaddingWords =
    parentToCoarseOrdinalOffsetWords
    - unalignedParentToCoarseOrdinalOffsetWords;
  if (
    parentToCoarseOrdinalPaddingWords
      < SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS
  ) {
    throw new RangeError(
      'parent mechanics workspace alignment padding cannot hold the CFL interval reduction'
    );
  }
  const cflIntervalOffsetWords =
    unalignedParentToCoarseOrdinalOffsetWords;
  const wordLength = checkedAdd(
    parentToCoarseOrdinalOffsetWords,
    capacity,
    'parent mechanics workspace length'
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
    headerWords: SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_WORDS,
    rowWords: SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROW_WORDS,
    parentFieldCapacity: capacity,
    fineFieldCapacity: fineCapacity,
    accumulatorOffsetWords,
    baselineStateOffsetWords,
    combinedStateOffsetWords,
    coarsePredictorStateOffsetWords,
    routeProposalOffsetWords,
    routeProposalWords,
    routeProposalRowWords:
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_ROUTE_WORDS,
    fineImpulseOffsetWords,
    fineImpulseWords,
    fineImpulseRowWords:
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_FINE_IMPULSE_WORDS,
    cflIntervalOffsetWords,
    cflIntervalWords:
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_CFL_INTERVAL_WORDS,
    parentToCoarseOrdinalOffsetWords,
    parentToCoarseOrdinalPaddingWords,
    parentToCoarseOrdinalWords: capacity,
    parentToCoarseOrdinalEncoding:
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_PARENT_TO_COARSE_ORDINAL_ENCODING,
    workspaceBindingWordLength: parentToCoarseOrdinalOffsetWords,
    workspaceBindingByteLength:
      parentToCoarseOrdinalOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
    parentToCoarseOrdinalByteOffset:
      parentToCoarseOrdinalOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
    parentToCoarseOrdinalByteLength:
      capacity * Uint32Array.BYTES_PER_ELEMENT,
    storageBindingAlignmentWords:
      SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_BINDING_ALIGNMENT_WORDS,
    bankWords,
    wordLength,
    byteLength: wordLength * Uint32Array.BYTES_PER_ELEMENT
  });
}

export function createSchroederSpatialParentFieldMechanicsWorkspacePlan({
  parentFieldView,
  completionOrdinal = parentFieldView?.completionOrdinal
} = {}) {
  if (!parentFieldView || parentFieldView.exactLevelCount !== 2) {
    throw new TypeError('parent mechanics workspace requires one exact two-level parent-field view');
  }
  const fineLevel = integer(
    parentFieldView.fineLevel,
    'fineLevel',
    -0x8000_0000,
    0x7fff_ffff
  );
  const coarseLevel = integer(
    parentFieldView.coarseLevel,
    'coarseLevel',
    -0x8000_0000,
    0x7fff_ffff
  );
  if (coarseLevel !== fineLevel + 1) {
    throw new RangeError('parent mechanics workspace requires adjacent fine/coarse levels');
  }
  const identity = Object.fromEntries([
    'generationId',
    'deviceOrdinal',
    'laneOrdinal',
    'leaseToken',
    'sourceFamilyId',
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].map((field) => [field, integer(parentFieldView[field], field)]));
  const layout = createSchroederSpatialParentFieldMechanicsWorkspaceLayout({
    parentFieldCapacity: parentFieldView.parentFieldCapacity,
    fineFieldCapacity: parentFieldView.fineFieldCapacity
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
    status: 'schroeder-spatial-parent-field-mechanics-workspace-plan-ready',
    ...identity,
    fineLevel,
    coarseLevel,
    fineFieldCapacity: integer(parentFieldView.fineFieldCapacity, 'fineFieldCapacity', 1),
    coarseFieldCapacity: integer(parentFieldView.coarseFieldCapacity, 'coarseFieldCapacity', 1),
    parentFieldCapacity: layout.parentFieldCapacity,
    edgeCapacity: integer(parentFieldView.edgeCapacity, 'edgeCapacity', 1),
    completionOrdinal: integer(completionOrdinal, 'completionOrdinal', 1),
    parentCompletionOrdinal: integer(
      parentFieldView.completionOrdinal,
      'parentCompletionOrdinal',
      1
    ),
    fineCompletionOrdinal: integer(
      parentFieldView.fineFieldView?.completionOrdinal,
      'fineCompletionOrdinal',
      1
    ),
    coarseCompletionOrdinal: integer(
      parentFieldView.coarseFieldView?.completionOrdinal,
      'coarseCompletionOrdinal',
      1
    ),
    layout,
    fullParticleReadbackRequired: false,
    internalEnergyTransferStatus: 'particle-owned-untouched-not-proven',
    refluxEvidenceStatus: 'transpose-identity-structural-unmeasured'
  });
}

function row8(row, label) {
  const values = Array.from(row || []);
  if (values.length !== 8 || values.some((value) => !Number.isFinite(Number(value)))) {
    throw new TypeError(`${label} must contain eight finite numeric values`);
  }
  return values.map(Number);
}

function addScaled(target, source, weight) {
  for (let word = 0; word < 7; word += 1) target[word] += source[word] * weight;
  target[7] += 1;
}

/** Small manufactured oracle; never a production CPU transfer authority. */
export function buildSchroederSpatialParentFieldMechanicsCpuOracle({
  parentFieldKeys,
  fineEdgeOffsets,
  fineEdgeParentIndices,
  fineEdgeWeights,
  coarseNativeToParentField,
  fineStateRows,
  coarseStateRows,
  deltaScale = 1
} = {}) {
  const keys = Array.from(parentFieldKeys || [], (key, index) => {
    const words = Array.from(key || []);
    if (words.length !== 4 || words.some((value) => !Number.isInteger(Number(value)))) {
      throw new TypeError(`parentFieldKeys[${index}] must be one u32x4 key`);
    }
    return words.map(Number);
  });
  const fineRows = Array.from(fineStateRows || [], (row, index) => row8(row, `fineStateRows[${index}]`));
  const coarseRows = Array.from(coarseStateRows || [], (row, index) => row8(row, `coarseStateRows[${index}]`));
  const offsets = Array.from(fineEdgeOffsets || [], Number);
  const parents = Array.from(fineEdgeParentIndices || [], Number);
  const weights = Array.from(fineEdgeWeights || [], Number);
  const coarseMap = Array.from(coarseNativeToParentField || [], Number);
  if (
    offsets.length !== fineRows.length + 1
    || offsets[0] !== 0
    || offsets.at(-1) !== parents.length
    || parents.length !== weights.length
    || coarseMap.length !== coarseRows.length
  ) {
    throw new RangeError('parent mechanics CPU oracle requires one exact fine CSR and coarse map');
  }
  const baselineMomentum = Array.from({ length: keys.length }, () => Array(8).fill(0));
  for (let fine = 0; fine < fineRows.length; fine += 1) {
    let sum = 0;
    for (let edge = offsets[fine]; edge < offsets[fine + 1]; edge += 1) {
      const parent = parents[edge];
      const weight = weights[edge];
      if (!Number.isInteger(parent) || parent < 0 || parent >= keys.length || !(weight > 0)) {
        throw new RangeError('parent mechanics CPU oracle received an invalid fine edge');
      }
      addScaled(baselineMomentum[parent], fineRows[fine], weight);
      sum += weight;
    }
    if (Math.abs(sum - 1) > 2 ** -18) {
      throw new RangeError('parent mechanics CPU oracle requires partition-of-unity fine weights');
    }
  }
  const combinedMomentum = baselineMomentum.map((row) => row.slice());
  for (let coarse = 0; coarse < coarseRows.length; coarse += 1) {
    const parent = coarseMap[coarse];
    if (!Number.isInteger(parent) || parent < 0 || parent >= keys.length) {
      throw new RangeError('parent mechanics CPU oracle received an invalid coarse map');
    }
    for (let word = 0; word < 7; word += 1) {
      combinedMomentum[parent][word] += coarseRows[coarse][word];
    }
    combinedMomentum[parent][7] += 1;
  }
  const velocityState = (row) => {
    const out = row.slice();
    const mass = row[0];
    if (mass > 0) {
      out[1] /= mass;
      out[2] /= mass;
      out[3] /= mass;
      out[7] = 1;
    } else {
      out[1] = 0;
      out[2] = 0;
      out[3] = 0;
      out[7] = 0;
    }
    return out;
  };
  const baselineVelocity = baselineMomentum.map(velocityState);
  const combinedVelocity = combinedMomentum.map(velocityState);
  const fineVelocityCorrection = fineRows.map((_, fine) => {
    const correction = [0, 0, 0];
    for (let edge = offsets[fine]; edge < offsets[fine + 1]; edge += 1) {
      const parent = parents[edge];
      const weight = weights[edge];
      for (let axis = 0; axis < 3; axis += 1) {
        correction[axis] += weight * (
          combinedVelocity[parent][axis + 1]
          - baselineVelocity[parent][axis + 1]
        );
      }
    }
    return correction.map((value) => value * Number(deltaScale));
  });
  const refluxMomentumByParent = Array.from(
    { length: keys.length },
    () => [0, 0, 0]
  );
  let fineKineticEnergyDeltaJ = 0;
  const fineImpulse = fineRows.map((row, fine) => {
    const mass = row[0];
    const prior = mass > 0
      ? [row[1] / mass, row[2] / mass, row[3] / mass]
      : [0, 0, 0];
    const correction = fineVelocityCorrection[fine];
    const next = prior.map((value, axis) => value + correction[axis]);
    fineKineticEnergyDeltaJ += 0.5 * mass * (
      next.reduce((sum, value) => sum + value * value, 0)
      - prior.reduce((sum, value) => sum + value * value, 0)
    );
    const impulse = correction.map((value) => mass * value);
    for (let edge = offsets[fine]; edge < offsets[fine + 1]; edge += 1) {
      const parent = parents[edge];
      const weight = weights[edge];
      for (let axis = 0; axis < 3; axis += 1) {
        refluxMomentumByParent[parent][axis] -= weight * impulse[axis];
      }
    }
    return impulse;
  });
  let coarseKineticEnergyDeltaJ = 0;
  const coarsePublishedVelocity = coarseRows.map((row, coarse) => {
    const mass = row[0];
    const prior = mass > 0
      ? [row[1] / mass, row[2] / mass, row[3] / mass]
      : [0, 0, 0];
    const reflux = refluxMomentumByParent[coarseMap[coarse]];
    const next = prior.map((value, axis) => (
      mass > 0 ? value + reflux[axis] / mass : value
    ));
    coarseKineticEnergyDeltaJ += 0.5 * mass * (
      next.reduce((sum, value) => sum + value * value, 0)
      - prior.reduce((sum, value) => sum + value * value, 0)
    );
    return next;
  });
  const totalFineImpulse = fineImpulse.reduce(
    (sum, impulse) => sum.map((value, axis) => value + impulse[axis]),
    [0, 0, 0]
  );
  const totalCoarseImpulse = refluxMomentumByParent.reduce(
    (sum, impulse) => sum.map((value, axis) => value + impulse[axis]),
    [0, 0, 0]
  );
  const momentumResidual = totalFineImpulse.map(
    (value, axis) => value + totalCoarseImpulse[axis]
  );
  const internalEnergyDepositJ = Math.max(
    0,
    -(fineKineticEnergyDeltaJ + coarseKineticEnergyDeltaJ)
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_SCHEMA,
    status: 'schroeder-spatial-parent-field-mechanics-cpu-oracle-complete',
    parentFieldKeys: Object.freeze(keys.map(Object.freeze)),
    baselineMomentum: Object.freeze(baselineMomentum.map(Object.freeze)),
    combinedMomentum: Object.freeze(combinedMomentum.map(Object.freeze)),
    baselineVelocity: Object.freeze(baselineVelocity.map(Object.freeze)),
    combinedVelocity: Object.freeze(combinedVelocity.map(Object.freeze)),
    fineVelocityCorrection: Object.freeze(fineVelocityCorrection.map(Object.freeze)),
    fineImpulse: Object.freeze(fineImpulse.map(Object.freeze)),
    refluxMomentumByParent: Object.freeze(
      refluxMomentumByParent.map(Object.freeze)
    ),
    coarsePublishedVelocity: Object.freeze(
      coarsePublishedVelocity.map(Object.freeze)
    ),
    momentumResidual: Object.freeze(momentumResidual),
    fineKineticEnergyDeltaJ,
    coarseKineticEnergyDeltaJ,
    internalEnergyDepositJ,
    totalEnergyResidualJ: fineKineticEnergyDeltaJ
      + coarseKineticEnergyDeltaJ + internalEnergyDepositJ,
    internalEnergyTransferStatus:
      'nonnegative-reflux-kinetic-loss-deposited-by-transpose-g2p',
    refluxEvidenceStatus:
      'cpu-measured-equal-opposite-linear-momentum-and-energy'
  });
}
