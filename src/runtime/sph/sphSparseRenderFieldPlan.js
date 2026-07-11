import {
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_PLAN_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';

export const SPH_SPARSE_RENDER_FIELD_DEFAULT_BRICK_SIZE = 8;
export const SPH_SPARSE_RENDER_FIELD_DEFAULT_ATLAS_CELL_STRIDE_BYTES = 32;
export const SPH_SPARSE_RENDER_FIELD_DIRECTORY_SENTINEL = 0xffffffff;

export const SPH_SPARSE_RENDER_FIELD_SOURCE_KIND_PARTICLE = 0;
export const SPH_SPARSE_RENDER_FIELD_SOURCE_KIND_PRODUCT_EVENT = 1;

export const SPH_SPARSE_RENDER_FIELD_ACTIVE_DIRECT = 1 << 0;
export const SPH_SPARSE_RENDER_FIELD_ACTIVE_HALO = 1 << 1;
export const SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_X = 1 << 2;
export const SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Y = 1 << 3;
export const SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Z = 1 << 4;

export const SPH_SPARSE_RENDER_FIELD_OVERFLOW_DIRECTORY = 1 << 0;
export const SPH_SPARSE_RENDER_FIELD_OVERFLOW_ROUTES = 1 << 1;
export const SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_BRICKS = 1 << 2;
export const SPH_SPARSE_RENDER_FIELD_OVERFLOW_ATLAS_CELLS = 1 << 3;
export const SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_VOXELS = 1 << 4;
export const SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES = 1 << 5;

export const SPH_SPARSE_RENDER_FIELD_ADMISSION_APPROVED = 1 << 0;
export const SPH_SPARSE_RENDER_FIELD_ADMISSION_FAIL_CLOSED = 1 << 1;
export const SPH_SPARSE_RENDER_FIELD_ADMISSION_RETAIN_PREVIOUS = 1 << 2;

export const SPH_SPARSE_RENDER_FIELD_FAIL_CLOSED_ACTION_NONE = 0;
export const SPH_SPARSE_RENDER_FIELD_FAIL_CLOSED_ACTION_SUPPRESS_RETAIN_PREVIOUS = 1;

export const SPH_SPARSE_RENDER_FIELD_ROW_STATUS_READY = 1;
export const SPH_SPARSE_RENDER_FIELD_ROW_STATUS_BLOCKED = 2;

export const SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS =
  SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT.length;
export const SPH_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_UINTS =
  SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_ROW_LAYOUT.length;
export const SPH_SPARSE_RENDER_FIELD_ROUTE_UINTS =
  SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT.length;
export const SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS =
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT.length;
export const SPH_SPARSE_RENDER_FIELD_CAPACITY_UINTS =
  SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_ROW_LAYOUT.length;
export const SPH_SPARSE_RENDER_FIELD_ADMISSION_UINTS =
  SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT.length;

const UINT32_MAX = 0xffffffff;
const UINT32_BASE = 0x100000000;
const ACTIVE_VOXEL_INDEX_STRIDE_BYTES = Uint32Array.BYTES_PER_ELEMENT;

function uint32(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > UINT32_MAX) {
    throw new RangeError(`${label} must be an integer in [${min}, ${UINT32_MAX}]`);
  }
  return number;
}

function positiveInteger(value, label) {
  return uint32(value, label, { min: 1 });
}

function safeInteger(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min) {
    throw new RangeError(`${label} must be a safe integer greater than or equal to ${min}`);
  }
  return number;
}

function checkedUint32Product(values, label) {
  let product = 1;
  for (const value of values) {
    product *= value;
    if (!Number.isSafeInteger(product) || product > UINT32_MAX) {
      throw new RangeError(`${label} exceeds u32 addressability`);
    }
  }
  return product;
}

function checkedUint32Add(left, right, label) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError(`${label} exceeds u32 addressability`);
  }
  return result;
}

function checkedByteLengthProduct(values, label) {
  let product = 1;
  for (const value of values) {
    product *= value;
    if (!Number.isSafeInteger(product)) {
      throw new RangeError(`${label} exceeds safe integer byte addressing`);
    }
  }
  return product;
}

function checkedByteLengthSum(values, label) {
  let sum = 0;
  for (const value of values) {
    sum += value;
    if (!Number.isSafeInteger(sum)) {
      throw new RangeError(`${label} exceeds safe integer byte addressing`);
    }
  }
  return sum;
}

function ceilDiv(value, divisor) {
  return Math.floor((value + divisor - 1) / divisor);
}

function normalizedDimensions({ resolution = null, dimensions = null } = {}) {
  const source = dimensions ?? resolution;
  if (Array.isArray(source) || ArrayBuffer.isView(source)) {
    if (source.length < 3) {
      throw new RangeError('sparse render-field dimensions require three entries');
    }
    return [
      positiveInteger(source[0], 'dimensions[0]'),
      positiveInteger(source[1], 'dimensions[1]'),
      positiveInteger(source[2], 'dimensions[2]')
    ];
  }
  const resolved = positiveInteger(source, 'resolution');
  return [resolved, resolved, resolved];
}

function surfacePlanMap(surfacePlans) {
  const map = new Map();
  for (const surface of surfacePlans) {
    if (map.has(surface.surfaceIndex)) {
      throw new RangeError(`duplicate sparse render-field surface index ${surface.surfaceIndex}`);
    }
    map.set(surface.surfaceIndex, surface);
  }
  return map;
}

function brickCoordinates(value, label = 'brick') {
  const source = value?.brick ?? value?.coordinates ?? [value?.x, value?.y, value?.z];
  if ((!Array.isArray(source) && !ArrayBuffer.isView(source)) || source.length < 3) {
    throw new TypeError(`${label} requires [x, y, z] coordinates`);
  }
  return [
    uint32(source[0], `${label}[0]`),
    uint32(source[1], `${label}[1]`),
    uint32(source[2], `${label}[2]`)
  ];
}

function assertBrickInSurface(surface, brick, label = 'brick') {
  for (let axis = 0; axis < 3; axis += 1) {
    if (brick[axis] >= surface.brickCounts[axis]) {
      throw new RangeError(
        `${label}[${axis}] ${brick[axis]} is outside surface ${surface.surfaceIndex} brick count ${surface.brickCounts[axis]}`
      );
    }
  }
}

function brickLinearIndex(surface, brick) {
  return brick[0]
    + surface.brickCounts[0] * (brick[1] + surface.brickCounts[1] * brick[2]);
}

function sampleExtentForBrick(surface, brick) {
  return surface.dimensions.map((dimension, axis) =>
    Math.max(0, Math.min(surface.brickSize, dimension - brick[axis] * surface.brickSize))
  );
}

function voxelExtentForBrick(surface, brick) {
  return surface.dimensions.map((dimension, axis) => {
    const dualDimension = Math.max(0, dimension - 1);
    return Math.max(0, Math.min(surface.brickSize, dualDimension - brick[axis] * surface.brickSize));
  });
}

function uint64Words(value, label) {
  const number = safeInteger(value, label);
  return [number % UINT32_BASE, Math.floor(number / UINT32_BASE)];
}

function normalizedCapacity(value, required, label) {
  return value == null ? required : uint32(value, label);
}

export function createSphSparseRenderFieldSurfacePlan({
  surfaceIndex = 0,
  resolution = null,
  dimensions = null,
  brickSize = SPH_SPARSE_RENDER_FIELD_DEFAULT_BRICK_SIZE,
  directoryOffset = 0,
  generationId = 0,
  flags = 0
} = {}) {
  const resolvedSurfaceIndex = uint32(surfaceIndex, 'surfaceIndex');
  const resolvedGenerationId = uint32(generationId, 'generationId');
  const resolvedBrickSize = positiveInteger(brickSize, 'brickSize');
  const resolvedDimensions = normalizedDimensions({ resolution, dimensions });
  const brickCounts = resolvedDimensions.map((dimension) => ceilDiv(dimension, resolvedBrickSize));
  const directoryCount = checkedUint32Product(brickCounts, 'surface directory count');
  const resolvedDirectoryOffset = uint32(directoryOffset, 'directoryOffset');
  const directoryEnd = checkedUint32Add(
    resolvedDirectoryOffset,
    directoryCount,
    'surface directory end'
  );
  const brickVolume = checkedUint32Product(
    [resolvedBrickSize, resolvedBrickSize, resolvedBrickSize],
    'brick sample volume'
  );
  const logicalSampleCount = checkedUint32Product(resolvedDimensions, 'surface logical sample count');
  const paddedSampleCount = checkedUint32Product(
    [directoryCount, brickVolume],
    'surface padded sample count'
  );
  const dualVoxelCount = checkedUint32Product(
    resolvedDimensions.map((dimension) => Math.max(0, dimension - 1)),
    'surface dual voxel count'
  );
  const tailBrickSampleExtent = resolvedDimensions.map((dimension) => {
    const remainder = dimension % resolvedBrickSize;
    return remainder === 0 ? resolvedBrickSize : remainder;
  });
  return {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA,
    status: 'sparse-render-field-surface-plan-ready',
    surfaceIndex: resolvedSurfaceIndex,
    dimensions: resolvedDimensions,
    resolution: resolvedDimensions[0] === resolvedDimensions[1]
      && resolvedDimensions[1] === resolvedDimensions[2]
      ? resolvedDimensions[0]
      : null,
    brickSize: resolvedBrickSize,
    brickVolume,
    brickCounts,
    directoryOffset: resolvedDirectoryOffset,
    directoryEnd,
    directoryCount,
    directoryByteLength: directoryCount * Uint32Array.BYTES_PER_ELEMENT,
    logicalSampleCount,
    paddedSampleCount,
    paddingSampleCount: paddedSampleCount - logicalSampleCount,
    dualVoxelCount,
    tailBrickSampleExtent,
    generationId: resolvedGenerationId,
    flags: uint32(flags, 'surface flags'),
    structuralIntegerEncoding: 'u32',
    statusId: SPH_SPARSE_RENDER_FIELD_ROW_STATUS_READY
  };
}

export function createSphSparseRenderFieldHomeBrickKey({
  surfacePlan,
  routeIndex = 0,
  sourceIndex,
  sourceKind = SPH_SPARSE_RENDER_FIELD_SOURCE_KIND_PARTICLE,
  normalizedPosition = null,
  sampleCoordinates = null,
  supportRadiusCells = 0,
  generationId = surfacePlan?.generationId ?? 0
} = {}) {
  if (!surfacePlan || surfacePlan.schema !== ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA) {
    throw new TypeError('home-brick key requires a sparse render-field surface plan');
  }
  let samples;
  if (sampleCoordinates != null) {
    samples = brickCoordinates({ brick: sampleCoordinates }, 'sampleCoordinates');
    for (let axis = 0; axis < 3; axis += 1) {
      if (samples[axis] >= surfacePlan.dimensions[axis]) {
        throw new RangeError(
          `sampleCoordinates[${axis}] ${samples[axis]} is outside resolution ${surfacePlan.dimensions[axis]}`
        );
      }
    }
  } else {
    if ((!Array.isArray(normalizedPosition) && !ArrayBuffer.isView(normalizedPosition))
      || normalizedPosition.length < 3) {
      throw new TypeError('home-brick key requires normalizedPosition or sampleCoordinates');
    }
    samples = surfacePlan.dimensions.map((dimension, axis) => {
      const position = Number(normalizedPosition[axis]);
      if (!Number.isFinite(position)) {
        throw new RangeError(`normalizedPosition[${axis}] must be finite`);
      }
      return Math.min(dimension - 1, Math.max(0, Math.floor(position * dimension)));
    });
  }
  const homeBrick = samples.map((sample) => Math.floor(sample / surfacePlan.brickSize));
  const homeBrickLinearIndex = brickLinearIndex(surfacePlan, homeBrick);
  const homeDirectoryIndex = checkedUint32Add(
    surfacePlan.directoryOffset,
    homeBrickLinearIndex,
    'home directory index'
  );
  const route = {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA,
    status: 'sparse-render-field-route-key-ready',
    routeIndex: uint32(routeIndex, 'routeIndex'),
    sourceIndex: uint32(sourceIndex, 'sourceIndex'),
    sourceKind: uint32(sourceKind, 'sourceKind'),
    surfaceIndex: surfacePlan.surfaceIndex,
    sampleCoordinates: samples,
    homeBrick,
    homeBrickLinearIndex,
    homeDirectoryIndex,
    supportRadiusCells: uint32(supportRadiusCells, 'supportRadiusCells'),
    generationId: uint32(generationId, 'generationId'),
    statusId: SPH_SPARSE_RENDER_FIELD_ROW_STATUS_READY,
    sortKeyWords: new Uint32Array([
      homeDirectoryIndex,
      uint32(sourceIndex, 'sourceIndex'),
      uint32(sourceKind, 'sourceKind'),
      uint32(generationId, 'generationId')
    ])
  };
  route.row = packSphSparseRenderFieldRouteRow(route);
  return route;
}

export function packSphSparseRenderFieldRouteRow(route) {
  const row = new Uint32Array(SPH_SPARSE_RENDER_FIELD_ROUTE_UINTS);
  row.set([
    uint32(route.routeIndex, 'route.routeIndex'),
    uint32(route.sourceIndex, 'route.sourceIndex'),
    uint32(route.sourceKind, 'route.sourceKind'),
    uint32(route.surfaceIndex, 'route.surfaceIndex'),
    uint32(route.homeBrick?.[0], 'route.homeBrick[0]'),
    uint32(route.homeBrick?.[1], 'route.homeBrick[1]'),
    uint32(route.homeBrick?.[2], 'route.homeBrick[2]'),
    uint32(route.homeBrickLinearIndex, 'route.homeBrickLinearIndex'),
    uint32(route.homeDirectoryIndex, 'route.homeDirectoryIndex'),
    uint32(route.supportRadiusCells, 'route.supportRadiusCells'),
    uint32(route.generationId, 'route.generationId'),
    uint32(route.statusId ?? SPH_SPARSE_RENDER_FIELD_ROW_STATUS_READY, 'route.statusId')
  ]);
  return row;
}

export function expandSphSparseRenderFieldActiveBrickHalo({
  surfacePlans = [],
  directActiveBricks = [],
  predecessorHaloBricks = 1,
  generationId = null
} = {}) {
  const surfaces = surfacePlanMap(surfacePlans);
  const haloWidth = uint32(predecessorHaloBricks, 'predecessorHaloBricks');
  const active = new Map();
  const directKeys = new Set();
  const add = (surface, brick, flags) => {
    const localIndex = brickLinearIndex(surface, brick);
    const directoryIndex = surface.directoryOffset + localIndex;
    const key = `${surface.surfaceIndex}:${localIndex}`;
    const existing = active.get(key);
    if (existing) {
      existing.activationFlags |= flags;
      return existing;
    }
    const entry = {
      surface,
      surfaceIndex: surface.surfaceIndex,
      brick: [...brick],
      brickLinearIndex: localIndex,
      directoryIndex,
      activationFlags: flags
    };
    active.set(key, entry);
    return entry;
  };

  const normalizedDirect = [];
  for (let index = 0; index < directActiveBricks.length; index += 1) {
    const input = directActiveBricks[index];
    const surfaceIndex = uint32(input?.surfaceIndex, `directActiveBricks[${index}].surfaceIndex`);
    const surface = surfaces.get(surfaceIndex);
    if (!surface) {
      throw new RangeError(`direct active brick references unknown surface ${surfaceIndex}`);
    }
    const brick = brickCoordinates(input, `directActiveBricks[${index}].brick`);
    assertBrickInSurface(surface, brick, `directActiveBricks[${index}].brick`);
    const key = `${surfaceIndex}:${brickLinearIndex(surface, brick)}`;
    if (!directKeys.has(key)) {
      directKeys.add(key);
      normalizedDirect.push({ surface, brick });
    }
    add(surface, brick, SPH_SPARSE_RENDER_FIELD_ACTIVE_DIRECT);
  }

  for (const { surface, brick } of normalizedDirect) {
    const maxDx = Math.min(haloWidth, brick[0]);
    const maxDy = Math.min(haloWidth, brick[1]);
    const maxDz = Math.min(haloWidth, brick[2]);
    for (let dz = 0; dz <= maxDz; dz += 1) {
      for (let dy = 0; dy <= maxDy; dy += 1) {
        for (let dx = 0; dx <= maxDx; dx += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const candidate = [brick[0] - dx, brick[1] - dy, brick[2] - dz];
          let flags = SPH_SPARSE_RENDER_FIELD_ACTIVE_HALO;
          if (dx > 0) flags |= SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_X;
          if (dy > 0) flags |= SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Y;
          if (dz > 0) flags |= SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Z;
          add(surface, candidate, flags);
        }
      }
    }
  }

  const bricks = [...active.values()].sort((left, right) =>
    left.directoryIndex - right.directoryIndex
  );
  let atlasCellOffset = 0;
  let voxelCandidateCount = 0;
  const resolvedGenerationId = generationId == null
    ? null
    : uint32(generationId, 'generationId');
  for (let index = 0; index < bricks.length; index += 1) {
    const entry = bricks[index];
    const sampleExtent = sampleExtentForBrick(entry.surface, entry.brick);
    const voxelExtent = voxelExtentForBrick(entry.surface, entry.brick);
    const brickVoxelCandidateCount = checkedUint32Product(
      voxelExtent,
      'active brick voxel candidate count'
    );
    entry.atlasBrickIndex = index;
    entry.atlasCellOffset = atlasCellOffset;
    entry.sampleExtent = sampleExtent;
    entry.voxelExtent = voxelExtent;
    entry.voxelCandidateCount = brickVoxelCandidateCount;
    entry.generationId = resolvedGenerationId ?? entry.surface.generationId;
    entry.sourceRangeOffset = 0;
    entry.sourceRangeCount = 0;
    atlasCellOffset = checkedUint32Add(
      atlasCellOffset,
      entry.surface.brickVolume,
      'active brick atlas cell count'
    );
    voxelCandidateCount = checkedUint32Add(
      voxelCandidateCount,
      brickVoxelCandidateCount,
      'active voxel candidate count'
    );
  }
  return {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_SCHEMA,
    status: 'sparse-render-field-active-brick-halo-ready',
    haloMode: haloWidth > 0
      ? 'marching-cubes-predecessor-brick-halo'
      : 'direct-active-bricks-only',
    predecessorHaloBricks: haloWidth,
    directActiveBrickCount: directKeys.size,
    activeBrickCount: bricks.length,
    haloOnlyBrickCount: bricks.filter((entry) =>
      (entry.activationFlags & SPH_SPARSE_RENDER_FIELD_ACTIVE_DIRECT) === 0
    ).length,
    atlasCellCount: atlasCellOffset,
    activeVoxelCandidateCount: voxelCandidateCount,
    generationId: resolvedGenerationId,
    bricks,
    rowLayout: [...SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT],
    rowStrideUints: SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS,
    rows: packSphSparseRenderFieldActiveBrickRows(bricks),
    gpuFirst: true,
    cpuReferenceRequired: false
  };
}

export function packSphSparseRenderFieldSurfaceRows(surfacePlans) {
  const surfaces = Array.isArray(surfacePlans) ? surfacePlans : surfacePlans?.surfaces || [];
  const rows = new Uint32Array(surfaces.length * SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS);
  for (let index = 0; index < surfaces.length; index += 1) {
    const surface = surfaces[index];
    rows.set([
      surface.surfaceIndex,
      surface.dimensions[0],
      surface.dimensions[1],
      surface.dimensions[2],
      surface.brickSize,
      surface.brickCounts[0],
      surface.brickCounts[1],
      surface.brickCounts[2],
      surface.directoryOffset,
      surface.directoryCount,
      surface.logicalSampleCount,
      surface.paddedSampleCount,
      surface.dualVoxelCount,
      surface.generationId,
      surface.flags,
      surface.statusId
    ], index * SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS);
  }
  return rows;
}

export function packSphSparseRenderFieldActiveBrickRows(activeBricks) {
  const bricks = Array.isArray(activeBricks) ? activeBricks : activeBricks?.bricks || [];
  const rows = new Uint32Array(bricks.length * SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS);
  for (let index = 0; index < bricks.length; index += 1) {
    const brick = bricks[index];
    rows.set([
      brick.surfaceIndex,
      brick.brick[0],
      brick.brick[1],
      brick.brick[2],
      brick.brickLinearIndex,
      brick.directoryIndex,
      brick.atlasBrickIndex,
      brick.atlasCellOffset,
      brick.sampleExtent[0],
      brick.sampleExtent[1],
      brick.sampleExtent[2],
      brick.voxelCandidateCount,
      brick.activationFlags,
      brick.generationId,
      brick.sourceRangeOffset,
      brick.sourceRangeCount
    ], index * SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS);
  }
  return rows;
}

export function createSphSparseRenderFieldCapacityDescriptor({
  generationId = 0,
  surfaceCount = 0,
  required = {},
  capacity = {},
  atlasCellStrideBytes = SPH_SPARSE_RENDER_FIELD_DEFAULT_ATLAS_CELL_STRIDE_BYTES,
  maxTotalByteLength = null
} = {}) {
  const resolvedGenerationId = uint32(generationId, 'generationId');
  const resolvedSurfaceCount = uint32(surfaceCount, 'surfaceCount');
  const resolvedAtlasCellStrideBytes = positiveInteger(atlasCellStrideBytes, 'atlasCellStrideBytes');
  const requiredCounts = {
    directoryEntryCount: uint32(required.directoryEntryCount ?? 0, 'required.directoryEntryCount'),
    routeCount: uint32(required.routeCount ?? 0, 'required.routeCount'),
    activeBrickCount: uint32(required.activeBrickCount ?? 0, 'required.activeBrickCount'),
    atlasCellCount: uint32(required.atlasCellCount ?? 0, 'required.atlasCellCount'),
    activeVoxelCount: uint32(required.activeVoxelCount ?? 0, 'required.activeVoxelCount')
  };
  const capacityCounts = {
    directoryEntryCount: normalizedCapacity(
      capacity.directoryEntryCount,
      requiredCounts.directoryEntryCount,
      'capacity.directoryEntryCount'
    ),
    routeCount: normalizedCapacity(capacity.routeCount, requiredCounts.routeCount, 'capacity.routeCount'),
    activeBrickCount: normalizedCapacity(
      capacity.activeBrickCount,
      requiredCounts.activeBrickCount,
      'capacity.activeBrickCount'
    ),
    atlasCellCount: normalizedCapacity(
      capacity.atlasCellCount,
      requiredCounts.atlasCellCount,
      'capacity.atlasCellCount'
    ),
    activeVoxelCount: normalizedCapacity(
      capacity.activeVoxelCount,
      requiredCounts.activeVoxelCount,
      'capacity.activeVoxelCount'
    )
  };
  const byteLengthsFor = (counts) => ({
    surfaceTable: checkedByteLengthProduct([
      resolvedSurfaceCount,
      SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS,
      Uint32Array.BYTES_PER_ELEMENT
    ], 'surface table byte length'),
    directory: checkedByteLengthProduct([
      counts.directoryEntryCount,
      SPH_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_UINTS,
      Uint32Array.BYTES_PER_ELEMENT
    ], 'directory byte length'),
    routes: checkedByteLengthProduct([
      counts.routeCount,
      SPH_SPARSE_RENDER_FIELD_ROUTE_UINTS,
      Uint32Array.BYTES_PER_ELEMENT
    ], 'route byte length'),
    activeBricks: checkedByteLengthProduct([
      counts.activeBrickCount,
      SPH_SPARSE_RENDER_FIELD_ACTIVE_BRICK_UINTS,
      Uint32Array.BYTES_PER_ELEMENT
    ], 'active brick byte length'),
    atlasCells: checkedByteLengthProduct([
      counts.atlasCellCount,
      resolvedAtlasCellStrideBytes
    ], 'atlas cell byte length'),
    activeVoxels: checkedByteLengthProduct([
      counts.activeVoxelCount,
      ACTIVE_VOXEL_INDEX_STRIDE_BYTES
    ], 'active voxel byte length'),
    capacityEvidence: SPH_SPARSE_RENDER_FIELD_CAPACITY_UINTS * Uint32Array.BYTES_PER_ELEMENT,
    admissionEvidence: SPH_SPARSE_RENDER_FIELD_ADMISSION_UINTS * Uint32Array.BYTES_PER_ELEMENT
  });
  const requiredByteLengths = byteLengthsFor(requiredCounts);
  const capacityByteLengths = byteLengthsFor(capacityCounts);
  const requiredByteLength = checkedByteLengthSum(
    Object.values(requiredByteLengths),
    'required sparse render-field byte length'
  );
  const capacityByteLength = checkedByteLengthSum(
    Object.values(capacityByteLengths),
    'capacity sparse render-field byte length'
  );
  const resolvedMaxTotalByteLength = maxTotalByteLength == null
    ? null
    : safeInteger(maxTotalByteLength, 'maxTotalByteLength');

  let overflowFlags = 0;
  if (requiredCounts.directoryEntryCount > capacityCounts.directoryEntryCount) {
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_DIRECTORY;
  }
  if (requiredCounts.routeCount > capacityCounts.routeCount) {
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_ROUTES;
  }
  if (requiredCounts.activeBrickCount > capacityCounts.activeBrickCount) {
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_BRICKS;
  }
  if (requiredCounts.atlasCellCount > capacityCounts.atlasCellCount) {
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_ATLAS_CELLS;
  }
  if (requiredCounts.activeVoxelCount > capacityCounts.activeVoxelCount) {
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_VOXELS;
  }
  if (
    resolvedMaxTotalByteLength != null
    && (requiredByteLength > resolvedMaxTotalByteLength
      || capacityByteLength > resolvedMaxTotalByteLength)
  ) {
    overflowFlags |= SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES;
  }
  const admitted = overflowFlags === 0;
  const admissionFlags = admitted
    ? SPH_SPARSE_RENDER_FIELD_ADMISSION_APPROVED
    : SPH_SPARSE_RENDER_FIELD_ADMISSION_FAIL_CLOSED
      | SPH_SPARSE_RENDER_FIELD_ADMISSION_RETAIN_PREVIOUS;
  const capacityDescriptor = {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_SCHEMA,
    status: admitted
      ? 'sparse-render-field-capacity-admitted'
      : 'sparse-render-field-capacity-overflow-fail-closed',
    generationId: resolvedGenerationId,
    surfaceCount: resolvedSurfaceCount,
    atlasCellStrideBytes: resolvedAtlasCellStrideBytes,
    required: requiredCounts,
    capacity: capacityCounts,
    requiredByteLengths,
    capacityByteLengths,
    requiredByteLength,
    capacityByteLength,
    maxTotalByteLength: resolvedMaxTotalByteLength,
    overflowFlags,
    overflow: overflowFlags !== 0,
    admitted,
    admissionFlags,
    statusId: admitted
      ? SPH_SPARSE_RENDER_FIELD_ROW_STATUS_READY
      : SPH_SPARSE_RENDER_FIELD_ROW_STATUS_BLOCKED
  };
  capacityDescriptor.row = packSphSparseRenderFieldCapacityRow(capacityDescriptor);
  return capacityDescriptor;
}

export function packSphSparseRenderFieldCapacityRow(descriptor) {
  const requiredByteWords = uint64Words(descriptor.requiredByteLength, 'requiredByteLength');
  const capacityByteWords = uint64Words(descriptor.capacityByteLength, 'capacityByteLength');
  return new Uint32Array([
    descriptor.generationId,
    descriptor.surfaceCount,
    descriptor.required.directoryEntryCount,
    descriptor.capacity.directoryEntryCount,
    descriptor.required.routeCount,
    descriptor.capacity.routeCount,
    descriptor.required.activeBrickCount,
    descriptor.capacity.activeBrickCount,
    descriptor.required.atlasCellCount,
    descriptor.capacity.atlasCellCount,
    descriptor.required.activeVoxelCount,
    descriptor.capacity.activeVoxelCount,
    requiredByteWords[0],
    requiredByteWords[1],
    capacityByteWords[0],
    capacityByteWords[1],
    descriptor.overflowFlags,
    descriptor.admissionFlags,
    descriptor.statusId,
    0
  ]);
}

export function packSphSparseRenderFieldAdmissionRow(descriptor) {
  return new Uint32Array([
    uint32(descriptor.generationId, 'admission.generationId'),
    uint32(descriptor.overflowFlags, 'admission.overflowFlags'),
    uint32(descriptor.admissionFlags, 'admission.admissionFlags'),
    descriptor.generationPublicationAllowed ? 1 : 0,
    descriptor.failClosed ? 1 : 0,
    descriptor.retainPreviousAcceptedGeneration ? 1 : 0,
    uint32(descriptor.failClosedActionId, 'admission.failClosedActionId'),
    uint32(descriptor.statusId, 'admission.statusId')
  ]);
}

export function createSphSparseRenderFieldPlan({
  surfaces = [],
  brickSize = SPH_SPARSE_RENDER_FIELD_DEFAULT_BRICK_SIZE,
  generationId = 0,
  directActiveBricks = [],
  predecessorHaloBricks = 1,
  requiredRouteCount = 0,
  capacity = {},
  atlasCellStrideBytes = SPH_SPARSE_RENDER_FIELD_DEFAULT_ATLAS_CELL_STRIDE_BYTES,
  maxTotalByteLength = null
} = {}) {
  if (!Array.isArray(surfaces)) {
    throw new TypeError('sparse render-field surfaces must be an array');
  }
  const resolvedGenerationId = uint32(generationId, 'generationId');
  const defaultBrickSize = positiveInteger(brickSize, 'brickSize');
  let directoryOffset = 0;
  const surfacePlans = surfaces.map((descriptor, index) => {
    const surface = createSphSparseRenderFieldSurfacePlan({
      surfaceIndex: descriptor.surfaceIndex ?? descriptor.index ?? index,
      resolution: descriptor.resolution ?? null,
      dimensions: descriptor.dimensions ?? descriptor.dims ?? null,
      brickSize: descriptor.brickSize ?? defaultBrickSize,
      directoryOffset,
      generationId: resolvedGenerationId,
      flags: descriptor.flags ?? 0
    });
    directoryOffset = surface.directoryEnd;
    return surface;
  });
  surfacePlanMap(surfacePlans);
  const activeBrickPlan = expandSphSparseRenderFieldActiveBrickHalo({
    surfacePlans,
    directActiveBricks,
    predecessorHaloBricks,
    generationId: resolvedGenerationId
  });
  const required = {
    directoryEntryCount: directoryOffset,
    routeCount: uint32(requiredRouteCount, 'requiredRouteCount'),
    activeBrickCount: activeBrickPlan.activeBrickCount,
    atlasCellCount: activeBrickPlan.atlasCellCount,
    activeVoxelCount: activeBrickPlan.activeVoxelCandidateCount
  };
  const capacityDescriptor = createSphSparseRenderFieldCapacityDescriptor({
    generationId: resolvedGenerationId,
    surfaceCount: surfacePlans.length,
    required,
    capacity,
    atlasCellStrideBytes,
    maxTotalByteLength
  });
  const admission = {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_SCHEMA,
    status: capacityDescriptor.admitted
      ? 'sparse-render-field-generation-admission-approved'
      : 'sparse-render-field-generation-admission-blocked-capacity-overflow',
    generationId: resolvedGenerationId,
    admitted: capacityDescriptor.admitted,
    generationPublicationAllowed: capacityDescriptor.admitted,
    failClosed: !capacityDescriptor.admitted,
    failClosedAction: capacityDescriptor.admitted
      ? null
      : 'suppress-incomplete-generation-retain-last-accepted-generation',
    failClosedActionId: capacityDescriptor.admitted
      ? SPH_SPARSE_RENDER_FIELD_FAIL_CLOSED_ACTION_NONE
      : SPH_SPARSE_RENDER_FIELD_FAIL_CLOSED_ACTION_SUPPRESS_RETAIN_PREVIOUS,
    retainPreviousAcceptedGeneration: !capacityDescriptor.admitted,
    overflowFlags: capacityDescriptor.overflowFlags,
    admissionFlags: capacityDescriptor.admissionFlags,
    capacitySchema: capacityDescriptor.schema,
    capacityStatus: capacityDescriptor.status,
    bufferCapacityAdmissionRequired: true,
    stateMutationRequired: false,
    stateManagerAdmissionRequired: false,
    stateAuthorityStatus: 'derived-render-artifact-no-authoritative-state-mutation',
    executionAuthority: 'compute-manager-owned-gpuhub-resident-lane',
    rowLayout: [...SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT],
    rowStrideUints: SPH_SPARSE_RENDER_FIELD_ADMISSION_UINTS,
    statusId: capacityDescriptor.statusId
  };
  admission.row = packSphSparseRenderFieldAdmissionRow(admission);
  const logicalSampleCount = surfacePlans.reduce(
    (sum, surface) => checkedUint32Add(sum, surface.logicalSampleCount, 'total logical sample count'),
    0
  );
  const directoryDensityRatio = logicalSampleCount > 0 ? directoryOffset / logicalSampleCount : 0;
  return {
    schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_PLAN_SCHEMA,
    artifactSchema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA,
    status: admission.admitted
      ? 'sparse-render-field-plan-ready'
      : 'sparse-render-field-plan-blocked-capacity-overflow',
    generationId: resolvedGenerationId,
    generationKey: `sph-sparse-render-field-generation:${resolvedGenerationId}`,
    surfaceTable: {
      schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA,
      status: 'sparse-render-field-surface-table-ready',
      surfaceCount: surfacePlans.length,
      rowLayout: [...SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT],
      rowStrideUints: SPH_SPARSE_RENDER_FIELD_SURFACE_UINTS,
      rows: packSphSparseRenderFieldSurfaceRows(surfacePlans),
      surfaces: surfacePlans
    },
    directory: {
      schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_SCHEMA,
      status: 'sparse-render-field-dense-brick-directory-planned',
      entryLayout: [...SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_ROW_LAYOUT],
      entryStrideUints: SPH_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_UINTS,
      entryCount: directoryOffset,
      byteLength: directoryOffset * Uint32Array.BYTES_PER_ELEMENT,
      emptySentinel: SPH_SPARSE_RENDER_FIELD_DIRECTORY_SENTINEL,
      granularity: 'dense-at-brick-granularity-sparse-at-sample-granularity',
      directoryToLogicalSampleRatio: directoryDensityRatio
    },
    routes: {
      schema: ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA,
      status: 'sparse-render-field-route-capacity-planned',
      rowLayout: [...SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT],
      rowStrideUints: SPH_SPARSE_RENDER_FIELD_ROUTE_UINTS,
      requiredCount: required.routeCount,
      capacity: capacityDescriptor.capacity.routeCount,
      ordering: 'stable-directory-source-index-source-kind-generation-key'
    },
    activeBricks: activeBrickPlan,
    capacity: capacityDescriptor,
    admission,
    generationPublicationAllowed: admission.generationPublicationAllowed,
    failClosed: admission.failClosed,
    failClosedAction: admission.failClosedAction,
    producerAuthority: 'compute-manager-owned-gpuhub-resident-lane',
    stateMutationRequired: false,
    stateAuthorityStatus: 'derived-render-artifact-no-authoritative-state-mutation',
    sameDeviceRequired: true,
    gpuFirst: true,
    cpuReferenceRequired: false,
    fullParticleReadbackRequired: false,
    sceneSpecificBranching: false,
    materialSpecificBranching: false
  };
}
