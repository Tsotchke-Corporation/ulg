export const ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-free-volume-source.v2';
export const ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-free-volume-execution.v2';

export const SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC = 0x5347_4631;
export const SPH_SPATIAL_GAS_FREE_VOLUME_VERSION = 2;
export const SPH_SPATIAL_GAS_FREE_VOLUME_WORKGROUP_SIZE = 64;
export const SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_WORDS = 64;
export const SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS = 4;
export const SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES = 256;

export const SPH_SPATIAL_GAS_FREE_VOLUME_STATUS = Object.freeze({
  READY: 1 << 0,
  ADMITTED: 1 << 1,
  FAIL_CLOSED: 1 << 2,
  INVALID_DIRECTORY: 1 << 3,
  INVALID_MOMENT: 1 << 4,
  INVALID_PARENT: 1 << 5,
  INVALID_GEOMETRY: 1 << 6,
  OVERFILLED: 1 << 7,
  NONFINITE_VOLUME: 1 << 8,
  COUNT_MISMATCH: 1 << 9
});

export const SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS = Object.freeze({
  MAGIC: 0,
  VERSION: 1,
  STATUS_FLAGS: 2,
  ERROR_FLAGS: 3,
  GAS_FREE_VOLUME_GENERATION: 4,
  SOURCE_GENERATION: 5,
  DIRECTORY_GENERATION: 6,
  STORAGE_GENERATION: 7,
  CELL_CAPACITY: 8,
  ROW_WORDS: 9,
  EXACT_LEVEL_COUNT: 10,
  SELECTED_LEVEL: 11,
  FINE_MOMENT_GENERATION: 12,
  COARSE_MOMENT_GENERATION: 13,
  PARENT_COMPLETION_ORDINAL: 14,
  COMPLETED_CELL_COUNT: 15,
  INVALID_DIRECTORY_COUNT: 16,
  INVALID_MOMENT_COUNT: 17,
  INVALID_PARENT_COUNT: 18,
  INVALID_GEOMETRY_COUNT: 19,
  OVERFILLED_CELL_COUNT: 20,
  NONFINITE_VOLUME_COUNT: 21,
  DIRECTORY_CELL_COUNT: 22,
  READBACK_PERFORMED: 23,
  DISPATCH_X: 24,
  DISPATCH_Y: 25,
  DISPATCH_Z: 26,
  REDUCTION_VERSION: 27,
  FINE_SCATTER_DISPATCH_X: 28,
  FINE_SCATTER_DISPATCH_Y: 29,
  COARSE_SCATTER_DISPATCH_X: 30,
  COARSE_SCATTER_DISPATCH_Y: 31,
  KEYED_LOOKUP_MAX_STEPS: 32
});

export const SPH_SPATIAL_GAS_FREE_VOLUME_ROW_LAYOUT = Object.freeze([
  'geometricVolumeM3:f32-bits',
  'condensedVolumeM3:f32-bits',
  'freeVolumeM3:f32-bits',
  'statusFlags:u32'
]);

const UINT32_MAX = 0xffff_ffff;

function integer(value, label, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
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
  if (!(number > 0)) throw new RangeError(`${label} must be positive`);
  return number;
}

function vec3(value, label, parser = finiteF32) {
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 3) {
    throw new TypeError(`${label} must be an array-like vec3`);
  }
  return Object.freeze(Array.from(value, (entry, axis) => (
    parser(entry, `${label}[${axis}]`)
  )));
}

function gridDescriptor(grid, label = 'grid') {
  const gridDims = vec3(grid?.gridDims, `${label}.gridDims`, (value, name) => (
    integer(value, name, 1, 0x7fff_ffff)
  ));
  const gridNodeCount = integer(grid?.gridNodeCount, `${label}.gridNodeCount`, 1);
  if (gridDims[0] * gridDims[1] * gridDims[2] !== gridNodeCount) {
    throw new RangeError(`${label}.gridNodeCount must equal the gridDims product`);
  }
  return Object.freeze({
    gridDims,
    gridNodeCount,
    gridShift: integer(grid?.gridShift, `${label}.gridShift`, 0, 0x7fff_ffff),
    gridSpacingM: positiveF32(grid?.gridSpacingM, `${label}.gridSpacingM`),
    chartId: integer(grid?.chartId ?? 0, `${label}.chartId`),
    selectedLevel: integer(
      grid?.selectedLevel,
      `${label}.selectedLevel`,
      -0x8000_0000,
      0x7fff_ffff
    )
  });
}

export function createSphSpatialGasFreeVolumeLayout({ cellCapacity } = {}) {
  const capacity = integer(cellCapacity, 'cellCapacity', 1);
  const rowWords = capacity * SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS;
  if (!Number.isSafeInteger(rowWords) || rowWords > UINT32_MAX) {
    throw new RangeError('gas free-volume rows exceed the u32 word range');
  }
  return Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
    cellCapacity: capacity,
    controlWords: SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_WORDS,
    controlByteLength:
      SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    rowWords: SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
    rowsWordLength: rowWords,
    rowsByteLength: rowWords * Uint32Array.BYTES_PER_ELEMENT,
    paramsByteLength: SPH_SPATIAL_GAS_FREE_VOLUME_PARAMS_BYTES
  });
}

export function createSphSpatialGasFreeVolumePlan({
  cellCapacity,
  fineFieldCapacity,
  coarseFieldCapacity = 0,
  exactLevelCount,
  grid,
  boxMinM,
  boxMaxM,
  gasFreeVolumeGeneration,
  sourceGeneration,
  directoryGeneration,
  storageGeneration,
  fineMomentGeneration,
  coarseMomentGeneration = 0,
  parentCompletionOrdinal = 0,
  parentCapacityWords = 0,
  overfillToleranceRelative = 1e-5,
  overfillToleranceAbsoluteM3 = 1e-12
} = {}) {
  const levels = integer(exactLevelCount, 'exactLevelCount', 1, 2);
  const resolvedGrid = gridDescriptor(grid);
  const lower = vec3(boxMinM, 'boxMinM');
  const upper = vec3(boxMaxM, 'boxMaxM');
  if (upper.some((entry, axis) => !(entry > lower[axis]))) {
    throw new RangeError('boxMaxM must be strictly greater than boxMinM');
  }
  const relative = finiteF32(overfillToleranceRelative, 'overfillToleranceRelative');
  const absolute = finiteF32(
    overfillToleranceAbsoluteM3,
    'overfillToleranceAbsoluteM3'
  );
  if (relative < 0 || absolute < 0) {
    throw new RangeError('overfill tolerances must be non-negative');
  }
  const layout = createSphSpatialGasFreeVolumeLayout({ cellCapacity });
  return Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA,
    status: 'sph-spatial-gas-free-volume-plan-ready',
    layout,
    cellCapacity: layout.cellCapacity,
    fineFieldCapacity: integer(fineFieldCapacity, 'fineFieldCapacity', 1),
    coarseFieldCapacity: integer(
      coarseFieldCapacity,
      'coarseFieldCapacity',
      levels === 2 ? 1 : 0
    ),
    exactLevelCount: levels,
    grid: resolvedGrid,
    boxMinM: lower,
    boxMaxM: upper,
    gasFreeVolumeGeneration: integer(
      gasFreeVolumeGeneration,
      'gasFreeVolumeGeneration',
      1
    ),
    sourceGeneration: integer(sourceGeneration, 'sourceGeneration', 1),
    directoryGeneration: integer(directoryGeneration, 'directoryGeneration', 1),
    storageGeneration: integer(storageGeneration, 'storageGeneration', 1),
    fineMomentGeneration: integer(
      fineMomentGeneration,
      'fineMomentGeneration',
      1
    ),
    coarseMomentGeneration: integer(
      coarseMomentGeneration,
      'coarseMomentGeneration',
      levels === 2 ? 1 : 0
    ),
    parentCompletionOrdinal: integer(
      parentCompletionOrdinal,
      'parentCompletionOrdinal',
      levels === 2 ? 1 : 0
    ),
    parentCapacityWords: integer(
      parentCapacityWords,
      'parentCapacityWords',
      levels === 2 ? 80 : 0
    ),
    overfillToleranceRelative: relative,
    overfillToleranceAbsoluteM3: absolute,
    reductionVersion: 2,
    reductionAlgorithm:
      'directory-keyed-binary-lookup-atomic-f32-scatter',
    reductionWorkComplexity: 'O(C + (F + E + K) log C)',
    readbackRequired: false,
    mutationPolicy: 'sidecar-only-no-particle-grid-or-source-mutation'
  });
}

export function computeSphSpatialGasFreeVolumeCpuOracle({
  cells,
  condensedContributions,
  boxMinM,
  boxMaxM,
  gridSpacingM,
  overfillToleranceRelative = 1e-5,
  overfillToleranceAbsoluteM3 = 1e-12
} = {}) {
  const lower = vec3(boxMinM, 'boxMinM');
  const upper = vec3(boxMaxM, 'boxMaxM');
  const spacing = positiveF32(gridSpacingM, 'gridSpacingM');
  const contributions = Array.from(
    condensedContributions ?? [],
    (value, index) => {
      const number = finiteF32(value, `condensedContributions[${index}]`);
      if (number < 0) {
        throw new RangeError(`condensedContributions[${index}] must be non-negative`);
      }
      return number;
    }
  );
  const relative = finiteF32(overfillToleranceRelative, 'overfillToleranceRelative');
  const absolute = finiteF32(
    overfillToleranceAbsoluteM3,
    'overfillToleranceAbsoluteM3'
  );
  const rows = Array.from(cells ?? [], (cell, index) => {
    const coordinate = vec3(cell, `cells[${index}]`, (value, name) => (
      integer(value, name, -0x8000_0000, 0x7fff_ffff)
    ));
    const overlap = coordinate.map((value, axis) => {
      const cellMin = value * spacing;
      const cellMax = cellMin + spacing;
      return Math.max(0, Math.min(cellMax, upper[axis]) - Math.max(cellMin, lower[axis]));
    });
    const geometricVolumeM3 = Math.fround(overlap[0] * overlap[1] * overlap[2]);
    const condensedVolumeM3 = Math.fround(contributions[index] ?? 0);
    const tolerance = Math.max(
      absolute,
      Math.abs(geometricVolumeM3) * relative
    );
    if (!(geometricVolumeM3 > 0)) {
      throw new RangeError(`cells[${index}] has no geometric box intersection`);
    }
    if (condensedVolumeM3 > geometricVolumeM3 + tolerance) {
      throw new RangeError(`cells[${index}] condensed volume overfills its geometry`);
    }
    return Object.freeze({
      geometricVolumeM3,
      condensedVolumeM3,
      freeVolumeM3: Math.fround(Math.max(0, geometricVolumeM3 - condensedVolumeM3)),
      statusFlags:
        SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.READY
        | SPH_SPATIAL_GAS_FREE_VOLUME_STATUS.ADMITTED
    });
  });
  return Object.freeze(rows);
}

export function validateSphSpatialGasFreeVolumeDescriptor(
  descriptor,
  expected = {}
) {
  if (
    !descriptor
    || descriptor.schema !== ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA
    || descriptor.gasFreeVolumeSchema
      !== ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA
    || descriptor.status !== 'sph-spatial-gas-free-volume-gpu-encoded'
    || descriptor.released === true
    || !descriptor.gasFreeVolumeBuffer
    || !descriptor.gasFreeVolumeControlBuffer
    || descriptor.gasFreeVolumeRowStrideFloats
      !== SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS
    || descriptor.gasFreeVolumeCellCapacity !== descriptor.cellCapacity
    || descriptor.readbackPerformed !== false
  ) {
    return Object.freeze({
      admitted: false,
      status: 'sph-spatial-gas-free-volume-rejected-shape'
    });
  }
  for (const field of [
    'gasFreeVolumeGeneration',
    'sourceGeneration',
    'directoryGeneration',
    'storageGeneration',
    'exactLevelCount',
    'cellCapacity'
  ]) {
    if (Object.hasOwn(expected, field) && descriptor[field] !== expected[field]) {
      return Object.freeze({
        admitted: false,
        status: `sph-spatial-gas-free-volume-rejected-${field}`,
        field
      });
    }
  }
  let owned = false;
  try {
    owned = descriptor.ownerRuntime?.ownsExecution?.(descriptor) === true;
  } catch {
    owned = false;
  }
  return Object.freeze({
    admitted: owned,
    status: owned
      ? 'sph-spatial-gas-free-volume-admitted'
      : 'sph-spatial-gas-free-volume-rejected-ownership'
  });
}

export const SPH_SPATIAL_GAS_FREE_VOLUME_ABI = Object.freeze({
  sourceSchema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_SOURCE_SCHEMA,
  executionSchema: ULG_SPH_SPATIAL_GAS_FREE_VOLUME_EXECUTION_SCHEMA,
  magic: SPH_SPATIAL_GAS_FREE_VOLUME_MAGIC,
  version: SPH_SPATIAL_GAS_FREE_VOLUME_VERSION,
  controlWords: SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_WORDS,
  rowWords: SPH_SPATIAL_GAS_FREE_VOLUME_ROW_WORDS,
  rowLayout: SPH_SPATIAL_GAS_FREE_VOLUME_ROW_LAYOUT,
  condensedFamilies: Object.freeze([1, 2]),
  pressureDenominator: 'box-clipped-geometric-volume-minus-solid-liquid-v0j',
  twoLevelProjection:
    'fine-moment-parent-csr-plus-coarse-native-parent-map',
  condensedReduction:
    'directory-keyed-binary-lookup-atomic-f32-scatter',
  workComplexity: 'O(C + (F + E + K) log C)',
  failureCounterSemantics:
    'invalid-source-records-plus-invalid-output-cells',
  readbackPolicy: 'none',
  failurePolicy: 'whole-sidecar-fail-closed'
});
