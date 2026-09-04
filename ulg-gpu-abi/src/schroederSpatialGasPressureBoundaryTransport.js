import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS
} from './schroederSpatialParentFieldView.js';

export const ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-gas-pressure-boundary-transport.v2';

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_VERSION = 2;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE = 64;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES = 256;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC =
  0x5342_5031;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION =
  1;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS =
  12;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS =
  12;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_INITIALIZED =
  0x5342_494e;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_READY =
  0x5342_5259;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_FIELD_ADMISSION_SEAL =
  0x5342_4631;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SOURCE_ADMISSION_SEAL =
  0x5342_5331;

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD = 0;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED = 1;

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL =
  0;
export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT =
  1;

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_BINDINGS =
  Object.freeze({
    mechanicsField: 0,
    phaseVolumeReceiptControl: 1,
    phaseVolumeMomentRows: 2,
    gasPressureRowsPrivate: 3,
    gasDirectoryPrivate: 4,
    scratch: 5,
    gasAuthorityControlPrivate: 6,
    params: 7,
    parentFieldView: 8,
    storageBindingCount: 8
  });

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW =
  Object.freeze({
    velocityX: 0,
    velocityY: 1,
    velocityZ: 2,
    externalImpulseX: 3,
    externalImpulseY: 4,
    externalImpulseZ: 5,
    externalWorkJ: 6,
    fieldMassKg: 7,
    fieldVolumeM3: 8,
    gaugePressurePa: 9,
    status: 10,
    seal: 11
  });

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_LAYOUT =
  Object.freeze([
    'transportEnabled:u32',
    'missingCellPolicy:u32',
    'fieldCapacity:u32',
    'generationId:u32',
    'fieldCompletionOrdinal:u32',
    'fieldMutationOrdinal:u32',
    'storageGeneration:u32',
    'physicsTick:u32',
    'physicsSubstep:u32',
    'positionEpoch:u32',
    'topologyEpoch:u32',
    'chartEpoch:u32',
    'levelEpoch:u32',
    'supportEpoch:u32',
    'selectedLevel:i32-bits',
    'gridNodeCount:u32',
    'gridDimX:u32',
    'gridDimY:u32',
    'gridDimZ:u32',
    'gridCellOriginX:i32-bits',
    'gridCellOriginY:i32-bits',
    'gridCellOriginZ:i32-bits',
    'chartId:u32',
    'dt:f32-bits',
    'ambientPressurePa:f32-bits',
    'pressureScale:f32-bits',
    'gridSpacingM:f32-bits',
    'gasAuthorityExecutionGeneration:u32',
    'gasAuthorityStorageGeneration:u32',
    'gasPressureCellCapacity:u32',
    'gasPressureCellStrideFloats:u32',
    'gasDirectoryGeneration:u32',
    'gasDirectoryWordLength:u32',
    'gasDirectoryCellCapacity:u32',
    'gasDirectoryCellKeysOffsetWords:u32',
    'gasDirectoryCellOffsetsOffsetWords:u32',
    'gasDirectoryCellMembersOffsetWords:u32',
    'gasDirectoryParticleToCellOffsetWords:u32',
    'dispatchX:u32',
    'dispatchY:u32',
    'dispatchZ:u32',
    'crossLevelMappingMode:u32',
    'gasSelectedLevel:i32-bits',
    'gasGridNodeCount:u32',
    'gasGridDimX:u32',
    'gasGridDimY:u32',
    'gasGridDimZ:u32',
    'gasGridCellOriginX:i32-bits',
    'gasGridCellOriginY:i32-bits',
    'gasGridCellOriginZ:i32-bits',
    'gasGridSpacingM:f32-bits',
    'parentGenerationId:u32',
    'parentCompletionOrdinal:u32',
    'parentFieldCapacity:u32',
    'parentFieldWordCapacity:u32',
    'reserved14:u32',
    'reserved15:u32',
    'reserved16:u32',
    'reserved17:u32',
    'reserved18:u32',
    'reserved19:u32',
    'reserved20:u32',
    'reserved21:u32',
    'reserved22:u32'
  ]);

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_ABI =
  Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
    version: SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_VERSION,
    workgroupSize:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE,
    paramsBytes:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES,
    bindings: SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_BINDINGS,
    paramsLayout:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_LAYOUT,
    dispatchAuthority:
      'host-known-field-capacity-with-device-limit-bounded-two-dimensional-shape;gpu-field-count-is-never-read-back',
    condensedAuthority:
      'exact-s9a-v0-times-j-volume-and-gradient-rows-authenticated-by-s9b;phase-1-and-2-only',
    gasAuthority:
      'exact-v4-owner-private-pressure-rows-directory-and-control-bindings-3-4-6',
    parentAuthority:
      'fine-adjoint-only-read-only-parent-field-view-binding-8;exact-v1-header-layout-and-per-fine-field-partitioned-csr-authenticated-on-gpu',
    crossLevelMapping: Object.freeze({
      sameLevel:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL,
      fineToCoarseParentAdjoint:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT
    }),
    pressureLaw:
      'same-level:gauge-pa=absolute-v4-pressure-pa-minus-explicit-ambient-pa;node-impulse-ns=pressure-scale-times-gauge-times-summed-condensed-v0j-gradient-m2-times-dt;fine-adjoint:effective-gauge-pa=sum-parent-weight-times-parent-gauge-pa-and-field-impulse-ns=pressure-scale-times-effective-gauge-times-field-v0j-gradient-m2-times-dt',
    distribution:
      'same-level:each-condensed-field-receives-node-impulse-times-field-v0j-volume-over-node-condensed-v0j-volume;fine-adjoint:each-condensed-fine-field-receives-its-own-parent-transpose-impulse-without-node-redistribution',
    signConvention:
      'positive-gauge-times-s9-condensed-volume-gradient-matches-existing-schroeder-pressure-drag-condensed-impulse',
    missingCellPolicies: Object.freeze({
      noLoad: SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD,
      failClosed:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED
    }),
    transaction:
      'prevalidate-field-prevalidate-source-initialize-stage-validate-commit;only-store-only-commit-mutates-mechanics-field',
    residency:
      'no-mapAsync-no-host-logical-count-no-all-cell-scan;static-authorities-validated-once-on-gpu;same-level-one-exact-directory-binary-search-per-condensed-node-head;fine-adjoint-one-exact-binary-search-per-authenticated-parent-edge'
  });

const UINT32_MAX = 0xffff_ffff;
const MAX_SCRATCH_FIELD_CAPACITY = Math.floor(
  (UINT32_MAX
    - SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS)
  / SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS
);

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return number;
}

function signedInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < -0x8000_0000 || number > 0x7fff_ffff) {
    throw new RangeError(`${label} must be an i32`);
  }
  return number;
}

function finiteF32(value, label) {
  const number = Math.fround(Number(value));
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be a finite f32`);
  }
  return number;
}

function positiveF32(value, label) {
  const number = finiteF32(value, label);
  if (!(number > 0)) {
    throw new RangeError(`${label} must be a positive finite f32`);
  }
  return number;
}

function nonnegativeF32(value, label) {
  const number = finiteF32(value, label);
  if (number < 0) {
    throw new RangeError(`${label} must be a nonnegative finite f32`);
  }
  return number;
}

function tuple3(value, label, mapper) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new TypeError(`${label} must be an array-like vec3`);
  }
  if (value.length !== 3) {
    throw new RangeError(`${label} must contain exactly three values`);
  }
  return Object.freeze(Array.from(value, (entry, axis) => (
    mapper(entry, `${label}[${axis}]`)
  )));
}

function normalizeCrossLevelMappingMode(value) {
  if (
    value === 'same-level'
    || value
      === SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL
  ) {
    return SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL;
  }
  if (
    value === 'fine-to-coarse-parent-adjoint'
    || value
      === SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT
  ) {
    return SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT;
  }
  throw new RangeError(
    'crossLevelMappingMode must be same-level or fine-to-coarse-parent-adjoint'
  );
}

function exactParentFieldWordCapacity(fineFieldCapacity, parentFieldCapacity) {
  const edgeCapacity = fineFieldCapacity
    * SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD;
  const coarseFieldCapacity = parentFieldCapacity - edgeCapacity;
  if (
    !Number.isSafeInteger(edgeCapacity)
    || edgeCapacity > UINT32_MAX
    || !Number.isSafeInteger(coarseFieldCapacity)
    || coarseFieldCapacity < 1
  ) {
    throw new RangeError(
      'parentFieldCapacity must encode fineFieldCapacity * 8 plus a positive coarse capacity'
    );
  }
  const wordCapacity =
    SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_HEADER_WORDS
    + parentFieldCapacity * SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS
    + fineFieldCapacity
    + fineFieldCapacity + 1
    + edgeCapacity
    + edgeCapacity
    + coarseFieldCapacity;
  if (!Number.isSafeInteger(wordCapacity) || wordCapacity > UINT32_MAX) {
    throw new RangeError('parentFieldWordCapacity exceeds the u32 word range');
  }
  return wordCapacity;
}

function checkedScratchWordLength(fieldCapacity) {
  const capacity = integer(
    fieldCapacity,
    'fieldCapacity',
    1,
    MAX_SCRATCH_FIELD_CAPACITY
  );
  return SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS
    + capacity
      * SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS;
}

function exactCapacityDispatch(fieldCapacity, maxComputeWorkgroupsPerDimension) {
  const groups = Math.ceil(
    fieldCapacity
      / SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE
  );
  const maxDimension = integer(
    maxComputeWorkgroupsPerDimension,
    'maxComputeWorkgroupsPerDimension',
    1,
    65535
  );
  const x = Math.min(groups, maxDimension);
  const y = Math.ceil(groups / x);
  if (y > maxDimension) {
    throw new RangeError(
      'fieldCapacity exceeds the two-dimensional WebGPU dispatch range'
    );
  }
  return Object.freeze([x, y, 1]);
}

export function createSchroederSpatialGasPressureBoundaryTransportLayout({
  fieldCapacity,
  maxComputeWorkgroupsPerDimension = 65535
} = {}) {
  const scratchWords = checkedScratchWordLength(fieldCapacity);
  const capacity = integer(fieldCapacity, 'fieldCapacity', 1);
  const dispatchWorkgroups = exactCapacityDispatch(
    capacity,
    maxComputeWorkgroupsPerDimension
  );
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
    fieldCapacity: capacity,
    scratchHeaderWords:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS,
    scratchRowWords:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS,
    scratchWords,
    scratchByteLength: scratchWords * Uint32Array.BYTES_PER_ELEMENT,
    paramsByteLength:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES,
    workgroupSize:
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE,
    dispatchWorkgroups,
    dispatchInvocationCapacity:
      dispatchWorkgroups[0]
      * dispatchWorkgroups[1]
      * SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_WORKGROUP_SIZE
  });
}

function scratchHeaderSeal({
  fieldCapacity,
  generationId,
  fieldCompletionOrdinal,
  gasAuthorityExecutionGeneration
}) {
  return (
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC
    ^ SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION
    ^ fieldCapacity
    ^ generationId
    ^ fieldCompletionOrdinal
    ^ gasAuthorityExecutionGeneration
    ^ SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS
  ) >>> 0;
}

export function createSchroederSpatialGasPressureBoundaryTransportScratchHeader({
  fieldCapacity,
  generationId,
  fieldCompletionOrdinal,
  gasAuthorityExecutionGeneration
} = {}) {
  const identity = {
    fieldCapacity: integer(
      fieldCapacity,
      'fieldCapacity',
      1,
      MAX_SCRATCH_FIELD_CAPACITY
    ),
    generationId: integer(generationId, 'generationId', 1),
    fieldCompletionOrdinal: integer(
      fieldCompletionOrdinal,
      'fieldCompletionOrdinal',
      1
    ),
    gasAuthorityExecutionGeneration: integer(
      gasAuthorityExecutionGeneration,
      'gasAuthorityExecutionGeneration',
      1
    )
  };
  const header = new Uint32Array(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS
  );
  header[0] =
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC;
  header[1] =
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION;
  header[2] = 0;
  header[3] = identity.fieldCapacity;
  header[4] = identity.generationId;
  header[5] = identity.fieldCompletionOrdinal;
  header[6] = identity.gasAuthorityExecutionGeneration;
  header[7] =
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS;
  header[8] = 0;
  header[9] = 0;
  header[10] = 0;
  header[11] = scratchHeaderSeal(identity);
  return header;
}

/**
 * Setup helper. Production hot loops may clear a retained scratch buffer on
 * the device and upload only create...ScratchHeader(); row initialization is
 * performed by the first compute entry point.
 */
export function createSchroederSpatialGasPressureBoundaryTransportScratch(
  options = {}
) {
  const layout = createSchroederSpatialGasPressureBoundaryTransportLayout({
    fieldCapacity: options.fieldCapacity,
    maxComputeWorkgroupsPerDimension:
      options.maxComputeWorkgroupsPerDimension ?? 65535
  });
  const scratch = new Uint32Array(layout.scratchWords);
  scratch.set(
    createSchroederSpatialGasPressureBoundaryTransportScratchHeader(options)
  );
  return scratch;
}

export function createSchroederSpatialGasPressureBoundaryTransportParams({
  transportEnabled = true,
  missingCellPolicy =
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD,
  fieldCapacity,
  maxComputeWorkgroupsPerDimension = 65535,
  generationId,
  fieldCompletionOrdinal,
  fieldMutationOrdinal,
  storageGeneration,
  physicsTick,
  physicsSubstep,
  positionEpoch,
  topologyEpoch,
  chartEpoch,
  levelEpoch,
  supportEpoch,
  selectedLevel,
  gridNodeCount,
  gridDimensions,
  gridCellOrigin = [0, 0, 0],
  chartId,
  dt,
  ambientPressurePa,
  pressureScale = 1,
  gridSpacingM,
  gasAuthorityExecutionGeneration,
  gasAuthorityStorageGeneration,
  gasPressureCellCapacity,
  gasPressureCellStrideFloats = 12,
  gasDirectoryGeneration,
  gasDirectoryWordLength,
  gasDirectoryCellCapacity,
  gasDirectoryCellKeysOffsetWords,
  gasDirectoryCellOffsetsOffsetWords,
  gasDirectoryCellMembersOffsetWords,
  gasDirectoryParticleToCellOffsetWords,
  crossLevelMappingMode = 'same-level',
  gasSelectedLevel,
  gasGridNodeCount,
  gasGridDimensions,
  gasGridCellOrigin,
  gasGridSpacingM,
  parentGenerationId,
  parentCompletionOrdinal,
  parentFieldCapacity,
  parentFieldWordCapacity
} = {}) {
  if (transportEnabled !== true && transportEnabled !== false) {
    throw new TypeError('transportEnabled must be a boolean');
  }
  const policy = integer(missingCellPolicy, 'missingCellPolicy', 0, 1);
  const layout = createSchroederSpatialGasPressureBoundaryTransportLayout({
    fieldCapacity,
    maxComputeWorkgroupsPerDimension
  });
  const mappingMode = normalizeCrossLevelMappingMode(crossLevelMappingMode);
  const dims = tuple3(gridDimensions, 'gridDimensions', (value, label) => (
    integer(value, label, 1, 0x7fff_ffff)
  ));
  const nodes = integer(gridNodeCount, 'gridNodeCount', 1);
  if (dims[0] * dims[1] * dims[2] !== nodes) {
    throw new RangeError('gridDimensions product must equal gridNodeCount');
  }
  const origin = tuple3(gridCellOrigin, 'gridCellOrigin', signedInteger);
  for (let axis = 0; axis < 3; axis += 1) {
    const maximum = origin[axis] + dims[axis] - 1;
    if (maximum > 0x7fff_ffff) {
      throw new RangeError(`gridCellOrigin[${axis}] plus grid extent exceeds i32`);
    }
  }
  const targetLevel = signedInteger(selectedLevel, 'selectedLevel');
  const targetSpacing = positiveF32(gridSpacingM, 'gridSpacingM');
  if (
    mappingMode
      === SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT
  ) {
    for (const [label, value] of Object.entries({
      gasSelectedLevel,
      gasGridNodeCount,
      gasGridDimensions,
      gasGridCellOrigin,
      gasGridSpacingM,
      parentGenerationId,
      parentCompletionOrdinal,
      parentFieldCapacity,
      parentFieldWordCapacity
    })) {
      if (value == null) {
        throw new TypeError(`${label} is required for fine-to-coarse-parent-adjoint`);
      }
    }
  }
  const resolvedGasLevel = signedInteger(
    gasSelectedLevel ?? targetLevel,
    'gasSelectedLevel'
  );
  const gasDims = tuple3(
    gasGridDimensions ?? dims,
    'gasGridDimensions',
    (value, label) => integer(value, label, 1, 0x7fff_ffff)
  );
  const gasNodes = integer(
    gasGridNodeCount ?? nodes,
    'gasGridNodeCount',
    1
  );
  if (gasDims[0] * gasDims[1] * gasDims[2] !== gasNodes) {
    throw new RangeError(
      'gasGridDimensions product must equal gasGridNodeCount'
    );
  }
  const gasOrigin = tuple3(
    gasGridCellOrigin ?? origin,
    'gasGridCellOrigin',
    signedInteger
  );
  for (let axis = 0; axis < 3; axis += 1) {
    const maximum = gasOrigin[axis] + gasDims[axis] - 1;
    if (maximum > 0x7fff_ffff) {
      throw new RangeError(
        `gasGridCellOrigin[${axis}] plus grid extent exceeds i32`
      );
    }
  }
  const gasSpacing = positiveF32(
    gasGridSpacingM ?? targetSpacing,
    'gasGridSpacingM'
  );
  const resolvedParentGeneration = integer(
    parentGenerationId ?? 0,
    'parentGenerationId'
  );
  const resolvedParentCompletion = integer(
    parentCompletionOrdinal ?? 0,
    'parentCompletionOrdinal'
  );
  const resolvedParentFieldCapacity = integer(
    parentFieldCapacity ?? 0,
    'parentFieldCapacity'
  );
  const resolvedParentFieldWordCapacity = integer(
    parentFieldWordCapacity ?? 0,
    'parentFieldWordCapacity'
  );
  if (
    mappingMode
      === SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL
  ) {
    if (
      resolvedGasLevel !== targetLevel
      || gasNodes !== nodes
      || gasDims.some((value, axis) => value !== dims[axis])
      || gasOrigin.some((value, axis) => value !== origin[axis])
      || gasSpacing !== targetSpacing
      || resolvedParentGeneration !== 0
      || resolvedParentCompletion !== 0
      || resolvedParentFieldCapacity !== 0
      || resolvedParentFieldWordCapacity !== 0
    ) {
      throw new RangeError(
        'same-level gas metadata must match the target grid and omit parent identity'
      );
    }
  } else {
    if (targetLevel === 0x7fff_ffff || resolvedGasLevel !== targetLevel + 1) {
      throw new RangeError(
        'gasSelectedLevel must equal selectedLevel + 1 in fine adjoint mode'
      );
    }
    if (gasSpacing !== Math.fround(targetSpacing * 2)) {
      throw new RangeError(
        'gasGridSpacingM must be an exact 2:1 f32 ratio in fine adjoint mode'
      );
    }
    if (
      origin[0] !== origin[1]
      || origin[1] !== origin[2]
      || origin[0] > 0
      || origin[0] === -0x8000_0000
      || gasOrigin[0] !== gasOrigin[1]
      || gasOrigin[1] !== gasOrigin[2]
      || gasOrigin[0] > 0
      || gasOrigin[0] === -0x8000_0000
    ) {
      throw new RangeError(
        'fine adjoint grid origins must each encode one nonnegative scalar grid shift'
      );
    }
    if (resolvedParentGeneration < 1 || resolvedParentCompletion < 1) {
      throw new RangeError(
        'parentGenerationId and parentCompletionOrdinal must be positive in fine adjoint mode'
      );
    }
    if (resolvedParentGeneration !== integer(generationId, 'generationId', 1)) {
      throw new RangeError(
        'parentGenerationId must match generationId in fine adjoint mode'
      );
    }
    const expectedParentWords = exactParentFieldWordCapacity(
      layout.fieldCapacity,
      resolvedParentFieldCapacity
    );
    if (resolvedParentFieldWordCapacity !== expectedParentWords) {
      throw new RangeError(
        'parentFieldWordCapacity must match the exact parent-field view layout'
      );
    }
  }
  const pressureCapacity = integer(
    gasPressureCellCapacity,
    'gasPressureCellCapacity',
    1,
    Math.floor(UINT32_MAX / 12)
  );
  const directoryCapacity = integer(
    gasDirectoryCellCapacity,
    'gasDirectoryCellCapacity',
    1
  );
  if (directoryCapacity > pressureCapacity) {
    throw new RangeError(
      'gasDirectoryCellCapacity must not exceed gasPressureCellCapacity'
    );
  }
  const directoryKeysOffset = integer(
    gasDirectoryCellKeysOffsetWords,
    'gasDirectoryCellKeysOffsetWords',
    48
  );
  const directoryOffsetsOffset = integer(
    gasDirectoryCellOffsetsOffsetWords,
    'gasDirectoryCellOffsetsOffsetWords',
    48
  );
  const directoryMembersOffset = integer(
    gasDirectoryCellMembersOffsetWords,
    'gasDirectoryCellMembersOffsetWords',
    48
  );
  const directoryReverseOffset = integer(
    gasDirectoryParticleToCellOffsetWords,
    'gasDirectoryParticleToCellOffsetWords',
    48
  );
  const directoryWords = integer(
    gasDirectoryWordLength,
    'gasDirectoryWordLength',
    48
  );
  const expectedOffsetsOffset = 48 + directoryCapacity * 5;
  const expectedMembersOffset = expectedOffsetsOffset + directoryCapacity + 1;
  const expectedReverseOffset = expectedMembersOffset + pressureCapacity;
  const expectedDirectoryWords = expectedReverseOffset + pressureCapacity + 6;
  if (
    directoryKeysOffset !== 48
    || directoryOffsetsOffset !== expectedOffsetsOffset
    || directoryMembersOffset !== expectedMembersOffset
    || directoryReverseOffset !== expectedReverseOffset
    || directoryWords !== expectedDirectoryWords
  ) {
    throw new RangeError(
      'gas directory offsets and word length must match the exact v1 layout'
    );
  }
  const words = [
    transportEnabled ? 1 : 0,
    policy,
    layout.fieldCapacity,
    integer(generationId, 'generationId', 1),
    integer(fieldCompletionOrdinal, 'fieldCompletionOrdinal', 1),
    integer(fieldMutationOrdinal, 'fieldMutationOrdinal'),
    integer(storageGeneration, 'storageGeneration', 1),
    integer(physicsTick, 'physicsTick'),
    integer(physicsSubstep, 'physicsSubstep'),
    integer(positionEpoch, 'positionEpoch'),
    integer(topologyEpoch, 'topologyEpoch'),
    integer(chartEpoch, 'chartEpoch'),
    integer(levelEpoch, 'levelEpoch'),
    integer(supportEpoch, 'supportEpoch'),
    targetLevel,
    nodes,
    ...dims,
    ...origin,
    integer(chartId, 'chartId', 0, 0x00ff_ffff),
    positiveF32(dt, 'dt'),
    nonnegativeF32(ambientPressurePa, 'ambientPressurePa'),
    nonnegativeF32(pressureScale, 'pressureScale'),
    targetSpacing,
    integer(
      gasAuthorityExecutionGeneration,
      'gasAuthorityExecutionGeneration',
      1
    ),
    integer(
      gasAuthorityStorageGeneration,
      'gasAuthorityStorageGeneration',
      1
    ),
    pressureCapacity,
    integer(
      gasPressureCellStrideFloats,
      'gasPressureCellStrideFloats',
      12,
      12
    ),
    integer(gasDirectoryGeneration, 'gasDirectoryGeneration', 1),
    directoryWords,
    directoryCapacity,
    directoryKeysOffset,
    directoryOffsetsOffset,
    directoryMembersOffset,
    directoryReverseOffset,
    ...layout.dispatchWorkgroups,
    mappingMode,
    resolvedGasLevel,
    gasNodes,
    ...gasDims,
    ...gasOrigin,
    gasSpacing,
    resolvedParentGeneration,
    resolvedParentCompletion,
    resolvedParentFieldCapacity,
    resolvedParentFieldWordCapacity
  ];
  const buffer = new ArrayBuffer(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES
  );
  const view = new DataView(buffer);
  for (let word = 0; word < words.length; word += 1) {
    const value = words[word];
    if (
      word === 14
      || word === 42
      || (word >= 19 && word <= 21)
      || (word >= 47 && word <= 49)
    ) {
      view.setInt32(word * 4, value, true);
    } else if ((word >= 23 && word <= 26) || word === 50) {
      view.setFloat32(word * 4, value, true);
    } else {
      view.setUint32(word * 4, value, true);
    }
  }
  return new Uint8Array(buffer);
}

function f32(value) {
  const rounded = Math.fround(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function f32Vector3(value, label) {
  return tuple3(value, label, finiteF32);
}

function denseNodeCell(denseGridNodeId, dimensions, origin) {
  const yz = dimensions[1] * dimensions[2];
  const x = Math.floor(denseGridNodeId / yz);
  const remainder = denseGridNodeId - x * yz;
  const y = Math.floor(remainder / dimensions[2]);
  const z = remainder - y * dimensions[2];
  return [x + origin[0], y + origin[1], z + origin[2]];
}

function compareCell(left, right) {
  for (let axis = 0; axis < 3; axis += 1) {
    if (left[axis] !== right[axis]) return left[axis] < right[axis] ? -1 : 1;
  }
  return 0;
}

function binarySearchGasCell(cells, sought) {
  let low = 0;
  let high = cells.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (compareCell(cells[middle].cell, sought) < 0) low = middle + 1;
    else high = middle;
  }
  return low < cells.length && compareCell(cells[low].cell, sought) === 0
    ? cells[low]
    : null;
}

/**
 * Small explicit CPU oracle for law and distribution parity. It consumes
 * decoded rows only; production execution consumes the exact GPU ABI buffers.
 */
export function computeSchroederSpatialGasPressureBoundaryTransportCpuOracle({
  fields,
  gasCells,
  gridDimensions,
  gridCellOrigin = [0, 0, 0],
  dt,
  ambientPressurePa,
  pressureScale = 1,
  missingCellPolicy =
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD
} = {}) {
  if (!Array.isArray(fields) || !Array.isArray(gasCells)) {
    throw new TypeError('fields and gasCells must be arrays');
  }
  const dims = tuple3(gridDimensions, 'gridDimensions', (value, label) => (
    integer(value, label, 1, 0x7fff_ffff)
  ));
  const origin = tuple3(gridCellOrigin, 'gridCellOrigin', signedInteger);
  const step = positiveF32(dt, 'dt');
  const ambient = nonnegativeF32(ambientPressurePa, 'ambientPressurePa');
  const scale = nonnegativeF32(pressureScale, 'pressureScale');
  const policy = integer(missingCellPolicy, 'missingCellPolicy', 0, 1);
  const normalizedCells = gasCells.map((cell, index) => Object.freeze({
    cell: tuple3(cell?.cell, `gasCells[${index}].cell`, signedInteger),
    pressurePa: nonnegativeF32(
      cell?.absolutePressurePa ?? cell?.pressurePa,
      `gasCells[${index}].absolutePressurePa`
    ),
    ready: cell?.ready !== false
  }));
  for (let index = 1; index < normalizedCells.length; index += 1) {
    if (compareCell(normalizedCells[index - 1].cell, normalizedCells[index].cell) >= 0) {
      throw new RangeError('gasCells must be strictly lexicographically sorted');
    }
  }
  const rows = fields.map((field, index) => {
    const denseGridNodeId = integer(
      field?.denseGridNodeId,
      `fields[${index}].denseGridNodeId`,
      0,
      dims[0] * dims[1] * dims[2] - 1
    );
    const mechanicalFamilyId = integer(
      field?.mechanicalFamilyId ?? field?.phaseId,
      `fields[${index}].mechanicalFamilyId`,
      1,
      4
    );
    return {
      denseGridNodeId,
      mechanicalFamilyId,
      currentVolumeM3: positiveF32(
        field?.currentVolumeM3,
        `fields[${index}].currentVolumeM3`
      ),
      volumeGradientM2: f32Vector3(
        field?.volumeGradientM2,
        `fields[${index}].volumeGradientM2`
      ),
      massKg: positiveF32(field?.massKg, `fields[${index}].massKg`),
      initialVelocityMPerS: f32Vector3(
        field?.velocityMPerS,
        `fields[${index}].velocityMPerS`
      ),
      velocityMPerS: null,
      impulseNs: [0, 0, 0],
      externalWorkJ: 0,
      gaugePressurePa: 0,
      gasCellFound: false
    };
  });
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].denseGridNodeId > rows[index].denseGridNodeId) {
      throw new RangeError('fields must be sorted by denseGridNodeId');
    }
  }
  for (const row of rows) row.velocityMPerS = [...row.initialVelocityMPerS];
  let missingCellCount = 0;
  let appliedNodeCount = 0;
  let maximumDistributionResidualNs = 0;
  for (let begin = 0; begin < rows.length;) {
    let end = begin + 1;
    while (
      end < rows.length
      && rows[end].denseGridNodeId === rows[begin].denseGridNodeId
    ) end += 1;
    const condensed = rows.slice(begin, end).filter((row) => (
      row.mechanicalFamilyId === 1 || row.mechanicalFamilyId === 2
    ));
    if (condensed.length !== 0) {
      const sought = denseNodeCell(rows[begin].denseGridNodeId, dims, origin);
      const gasCell = binarySearchGasCell(normalizedCells, sought);
      if (!gasCell || !gasCell.ready) {
        missingCellCount += 1;
        if (
          policy
            === SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED
        ) {
          return Object.freeze({
            schema:
              ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
            status: 'gas-pressure-boundary-fail-closed-missing-cell',
            admitted: false,
            missingCellCount,
            appliedNodeCount,
            rows: Object.freeze([])
          });
        }
      } else {
        const sumVolume = f32(condensed.reduce(
          (sum, row) => f32(sum + row.currentVolumeM3),
          0
        ));
        const sumGradient = [0, 1, 2].map((axis) => f32(condensed.reduce(
          (sum, row) => f32(sum + row.volumeGradientM2[axis]),
          0
        )));
        const gauge = f32(gasCell.pressurePa - ambient);
        const totalImpulse = sumGradient.map((gradient) => (
          f32(f32(f32(scale * gauge) * gradient) * step)
        ));
        const assignedSum = [0, 0, 0];
        for (const row of condensed) {
          const share = f32(row.currentVolumeM3 / sumVolume);
          row.gaugePressurePa = gauge;
          row.gasCellFound = true;
          row.impulseNs = totalImpulse.map((impulse, axis) => {
            const assigned = f32(impulse * share);
            assignedSum[axis] = f32(assignedSum[axis] + assigned);
            return assigned;
          });
          row.velocityMPerS = row.initialVelocityMPerS.map((velocity, axis) => (
            f32(velocity + f32(row.impulseNs[axis] / row.massKg))
          ));
          const before = 0.5 * row.massKg * row.initialVelocityMPerS.reduce(
            (sum, value) => sum + value * value,
            0
          );
          const after = 0.5 * row.massKg * row.velocityMPerS.reduce(
            (sum, value) => sum + value * value,
            0
          );
          row.externalWorkJ = f32(after - before);
        }
        maximumDistributionResidualNs = Math.max(
          maximumDistributionResidualNs,
          ...totalImpulse.map((value, axis) => Math.abs(value - assignedSum[axis]))
        );
        appliedNodeCount += 1;
      }
    }
    begin = end;
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
    status: 'gas-pressure-boundary-cpu-oracle-ready',
    admitted: true,
    missingCellPolicy: policy,
    missingCellCount,
    appliedNodeCount,
    maximumDistributionResidualNs,
    rows: Object.freeze(rows.map((row) => Object.freeze({
      ...row,
      initialVelocityMPerS: Object.freeze(row.initialVelocityMPerS),
      velocityMPerS: Object.freeze(row.velocityMPerS),
      volumeGradientM2: Object.freeze(row.volumeGradientM2),
      impulseNs: Object.freeze(row.impulseNs)
    })))
  });
}

/**
 * Focused CPU oracle for the exact fine-field transpose of the coarse gas
 * pressure samples. Parent topology is supplied in the same published CSR
 * shape consumed by the GPU operator.
 */
export function computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle({
  fields,
  parentFieldKeys,
  fineEdgeOffsets,
  fineEdgeParentIndices,
  fineEdgeWeights,
  gasCells,
  gasGridDimensions,
  gasGridCellOrigin = [0, 0, 0],
  dt,
  ambientPressurePa,
  pressureScale = 1,
  missingCellPolicy =
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD
} = {}) {
  if (
    !Array.isArray(fields)
    || !Array.isArray(parentFieldKeys)
    || !Array.isArray(gasCells)
  ) {
    throw new TypeError('fields, parentFieldKeys, and gasCells must be arrays');
  }
  for (const [label, value] of Object.entries({
    fineEdgeOffsets,
    fineEdgeParentIndices,
    fineEdgeWeights
  })) {
    if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
      throw new TypeError(`${label} must be an array-like CSR lane`);
    }
  }
  const dims = tuple3(
    gasGridDimensions,
    'gasGridDimensions',
    (value, label) => integer(value, label, 1, 0x7fff_ffff)
  );
  const gasNodeCount = dims[0] * dims[1] * dims[2];
  if (!Number.isSafeInteger(gasNodeCount) || gasNodeCount > UINT32_MAX) {
    throw new RangeError('gasGridDimensions product exceeds the u32 node range');
  }
  const origin = tuple3(
    gasGridCellOrigin,
    'gasGridCellOrigin',
    signedInteger
  );
  const step = positiveF32(dt, 'dt');
  const ambient = nonnegativeF32(ambientPressurePa, 'ambientPressurePa');
  const scale = nonnegativeF32(pressureScale, 'pressureScale');
  const policy = integer(missingCellPolicy, 'missingCellPolicy', 0, 1);
  const normalizedCells = gasCells.map((cell, index) => Object.freeze({
    cell: tuple3(cell?.cell, `gasCells[${index}].cell`, signedInteger),
    pressurePa: nonnegativeF32(
      cell?.absolutePressurePa ?? cell?.pressurePa,
      `gasCells[${index}].absolutePressurePa`
    ),
    ready: cell?.ready !== false
  }));
  for (let index = 1; index < normalizedCells.length; index += 1) {
    if (
      compareCell(
        normalizedCells[index - 1].cell,
        normalizedCells[index].cell
      ) >= 0
    ) {
      throw new RangeError('gasCells must be strictly lexicographically sorted');
    }
  }
  const keys = parentFieldKeys.map((key, index) => {
    if (!Array.isArray(key) && !ArrayBuffer.isView(key)) {
      throw new TypeError(`parentFieldKeys[${index}] must be an array-like u32x4`);
    }
    if (key.length !== SCHROEDER_SPATIAL_PARENT_FIELD_VIEW_KEY_WORDS) {
      throw new RangeError(`parentFieldKeys[${index}] must contain four words`);
    }
    const normalized = Array.from(key, (word, column) => integer(
      word,
      `parentFieldKeys[${index}][${column}]`,
      column === 1 || column === 2 ? 1 : 0,
      column === 0
        ? gasNodeCount - 1
        : column === 1
          ? 4
          : column === 2
            ? 0x00ff_ffff
            : UINT32_MAX
    ));
    if (
      (normalized[1] === 1 && normalized[3] === 0)
      || (normalized[1] !== 1 && normalized[3] !== 0)
    ) {
      throw new RangeError(
        `parentFieldKeys[${index}] has a noncanonical continuity domain`
      );
    }
    return Object.freeze(normalized);
  });
  for (let index = 1; index < keys.length; index += 1) {
    let comparison = 0;
    for (let word = 0; word < keys[index].length; word += 1) {
      if (keys[index - 1][word] !== keys[index][word]) {
        comparison = keys[index - 1][word] < keys[index][word] ? -1 : 1;
        break;
      }
    }
    if (comparison >= 0) {
      throw new RangeError(
        'parentFieldKeys must be strictly lexicographically sorted'
      );
    }
  }
  const edgeParents = Array.from(
    fineEdgeParentIndices,
    (value, index) => integer(
      value,
      `fineEdgeParentIndices[${index}]`,
      0,
      Math.max(0, keys.length - 1)
    )
  );
  const edgeWeights = Array.from(fineEdgeWeights, (value, index) => (
    positiveF32(value, `fineEdgeWeights[${index}]`)
  ));
  const edgeOffsets = Array.from(fineEdgeOffsets, (value, index) => integer(
    value,
    `fineEdgeOffsets[${index}]`,
    0,
    edgeParents.length
  ));
  if (
    keys.length === 0
    || edgeParents.length !== edgeWeights.length
    || edgeOffsets.length !== fields.length + 1
    || edgeOffsets[0] !== 0
    || edgeOffsets.at(-1) !== edgeParents.length
    || edgeOffsets.some((value, index) => (
      index > 0 && value < edgeOffsets[index - 1]
    ))
  ) {
    throw new RangeError('parent topology must provide one exact monotonic CSR');
  }
  const rows = fields.map((field, index) => {
    const mechanicalFamilyId = integer(
      field?.mechanicalFamilyId ?? field?.phaseId,
      `fields[${index}].mechanicalFamilyId`,
      1,
      4
    );
    return {
      denseGridNodeId: integer(
        field?.denseGridNodeId,
        `fields[${index}].denseGridNodeId`
      ),
      mechanicalFamilyId,
      materialId: integer(
        field?.materialId ?? 1,
        `fields[${index}].materialId`,
        1,
        0x00ff_ffff
      ),
      continuityDomainId: integer(
        field?.continuityDomainId ?? (mechanicalFamilyId === 1 ? 1 : 0),
        `fields[${index}].continuityDomainId`,
        0
      ),
      currentVolumeM3: positiveF32(
        field?.currentVolumeM3,
        `fields[${index}].currentVolumeM3`
      ),
      volumeGradientM2: f32Vector3(
        field?.volumeGradientM2,
        `fields[${index}].volumeGradientM2`
      ),
      massKg: positiveF32(field?.massKg, `fields[${index}].massKg`),
      initialVelocityMPerS: f32Vector3(
        field?.velocityMPerS,
        `fields[${index}].velocityMPerS`
      ),
      velocityMPerS: null,
      impulseNs: [0, 0, 0],
      externalWorkJ: 0,
      effectiveGaugePressurePa: 0,
      foundParentCellCount: 0,
      missingParentCellCount: 0
    };
  });
  for (const [index, row] of rows.entries()) {
    if (
      (row.mechanicalFamilyId === 1 && row.continuityDomainId === 0)
      || (row.mechanicalFamilyId !== 1 && row.continuityDomainId !== 0)
    ) {
      throw new RangeError(
        `fields[${index}] has a noncanonical continuity domain`
      );
    }
  }
  for (const row of rows) row.velocityMPerS = [...row.initialVelocityMPerS];
  let missingCellCount = 0;
  let appliedFieldCount = 0;
  for (const [fieldIndex, row] of rows.entries()) {
    const begin = edgeOffsets[fieldIndex];
    const end = edgeOffsets[fieldIndex + 1];
    const edgeCount = end - begin;
    if (
      edgeCount < 1
      || edgeCount
        > SCHROEDER_SPATIAL_PARENT_FIELD_MAX_EDGES_PER_FINE_FIELD
    ) {
      throw new RangeError(`fine field ${fieldIndex} must have 1..8 parent edges`);
    }
    const distinctParents = new Set();
    let weightSum = 0;
    let effectiveGauge = 0;
    for (let edge = begin; edge < end; edge += 1) {
      const parentIndex = edgeParents[edge];
      const weight = edgeWeights[edge];
      const parentKey = keys[parentIndex];
      if (distinctParents.has(parentIndex)) {
        throw new RangeError(`fine field ${fieldIndex} repeats a parent edge`);
      }
      distinctParents.add(parentIndex);
      if (
        parentKey[1] !== row.mechanicalFamilyId
        || parentKey[2] !== row.materialId
        || parentKey[3] !== row.continuityDomainId
      ) {
        throw new RangeError(
          `fine field ${fieldIndex} parent key does not preserve field identity`
        );
      }
      weightSum = f32(weightSum + weight);
      const cell = denseNodeCell(parentKey[0], dims, origin);
      const pressureCell = binarySearchGasCell(normalizedCells, cell);
      if (!pressureCell || !pressureCell.ready) {
        row.missingParentCellCount += 1;
        missingCellCount += 1;
        if (
          policy
            === SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED
        ) {
          return Object.freeze({
            schema:
              ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
            status: 'gas-pressure-boundary-fine-adjoint-fail-closed-missing-cell',
            admitted: false,
            missingCellCount,
            appliedFieldCount,
            rows: Object.freeze([])
          });
        }
      } else {
        row.foundParentCellCount += 1;
        effectiveGauge = f32(
          effectiveGauge
            + f32(weight * f32(pressureCell.pressurePa - ambient))
        );
      }
    }
    if (Math.abs(weightSum - 1) > 2 ** -20) {
      throw new RangeError(`fine field ${fieldIndex} parent weights do not partition unity`);
    }
    if (
      row.mechanicalFamilyId !== 1
      && row.mechanicalFamilyId !== 2
    ) {
      continue;
    }
    row.effectiveGaugePressurePa = effectiveGauge;
    row.impulseNs = row.volumeGradientM2.map((gradient) => (
      f32(f32(f32(scale * effectiveGauge) * gradient) * step)
    ));
    row.velocityMPerS = row.initialVelocityMPerS.map((velocity, axis) => (
      f32(velocity + f32(row.impulseNs[axis] / row.massKg))
    ));
    const kineticBefore = 0.5 * row.massKg * row.initialVelocityMPerS.reduce(
      (sum, value) => sum + value * value,
      0
    );
    const kineticAfter = 0.5 * row.massKg * row.velocityMPerS.reduce(
      (sum, value) => sum + value * value,
      0
    );
    row.externalWorkJ = f32(kineticAfter - kineticBefore);
    if (row.foundParentCellCount > 0) appliedFieldCount += 1;
  }
  return Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
    status: 'gas-pressure-boundary-fine-adjoint-cpu-oracle-ready',
    admitted: true,
    missingCellPolicy: policy,
    missingCellCount,
    appliedFieldCount,
    rows: Object.freeze(rows.map((row) => Object.freeze({
      ...row,
      initialVelocityMPerS: Object.freeze(row.initialVelocityMPerS),
      velocityMPerS: Object.freeze(row.velocityMPerS),
      volumeGradientM2: Object.freeze(row.volumeGradientM2),
      impulseNs: Object.freeze(row.impulseNs)
    })))
  });
}
