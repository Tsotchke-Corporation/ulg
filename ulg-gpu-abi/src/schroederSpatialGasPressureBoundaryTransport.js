export const ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA =
  'peercompute.ulg.schroeder-spatial-gas-pressure-boundary-transport.v1';

export const SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_VERSION = 1;
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
    storageBindingCount: 7
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
    'reserved0:u32',
    'reserved1:u32',
    'reserved2:u32',
    'reserved3:u32',
    'reserved4:u32',
    'reserved5:u32',
    'reserved6:u32',
    'reserved7:u32',
    'reserved8:u32',
    'reserved9:u32',
    'reserved10:u32',
    'reserved11:u32',
    'reserved12:u32',
    'reserved13:u32',
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
    pressureLaw:
      'gauge-pa=absolute-v4-pressure-pa-minus-explicit-ambient-pa;node-impulse-ns=pressure-scale-times-gauge-times-summed-condensed-v0j-gradient-m2-times-dt',
    distribution:
      'each-condensed-field-receives-node-impulse-times-field-v0j-volume-over-node-condensed-v0j-volume',
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
      'no-mapAsync-no-host-logical-count-no-all-cell-scan;static-authorities-validated-once-on-gpu;one-exact-directory-binary-search-per-condensed-node-head'
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
  gasDirectoryParticleToCellOffsetWords
} = {}) {
  if (transportEnabled !== true && transportEnabled !== false) {
    throw new TypeError('transportEnabled must be a boolean');
  }
  const policy = integer(missingCellPolicy, 'missingCellPolicy', 0, 1);
  const layout = createSchroederSpatialGasPressureBoundaryTransportLayout({
    fieldCapacity,
    maxComputeWorkgroupsPerDimension
  });
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
    signedInteger(selectedLevel, 'selectedLevel'),
    nodes,
    ...dims,
    ...origin,
    integer(chartId, 'chartId', 0, 0x00ff_ffff),
    positiveF32(dt, 'dt'),
    nonnegativeF32(ambientPressurePa, 'ambientPressurePa'),
    nonnegativeF32(pressureScale, 'pressureScale'),
    positiveF32(gridSpacingM, 'gridSpacingM'),
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
    ...layout.dispatchWorkgroups
  ];
  const buffer = new ArrayBuffer(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES
  );
  const view = new DataView(buffer);
  for (let word = 0; word < words.length; word += 1) {
    const value = words[word];
    if (word === 14 || (word >= 19 && word <= 21)) {
      view.setInt32(word * 4, value, true);
    } else if (word >= 23 && word <= 26) {
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
