import { normalizeParticleState } from './particleState.js';

export const ULG_SPATIAL_HASH_SCHEMA = 'peercompute.ulg.spatial-hash.v0';
export const ULG_NEIGHBOR_GRAPH_SCHEMA = 'peercompute.ulg.neighbor-graph.v0';

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function normalizeOrigin(origin, dimensions) {
  const source = Array.isArray(origin) ? origin : [];
  return Array.from({ length: dimensions }, (_value, axis) => (
    finiteNumber(source[axis] ?? 0, `origin[${axis}]`)
  ));
}

function readBuildArgs(first, second) {
  if (first?.cellSize != null || first?.bodies || first?.particles || first?.state) {
    const state = first.state || first.particles || first.bodies || [];
    return { state, options: first };
  }
  return { state: first, options: second || {} };
}

function cellCoordsForPosition(position, { cellSize, origin }) {
  return position.map((coordinate, axis) => Math.floor((coordinate - origin[axis]) / cellSize));
}

function cellKey(coords) {
  return coords.join(':');
}

function createNeighborCellOffsets(dimensions, radiusCells) {
  const offsets = [];
  function visit(prefix, axis) {
    if (axis === dimensions) {
      offsets.push(prefix);
      return;
    }
    for (let value = -radiusCells; value <= radiusCells; value += 1) {
      visit([...prefix, value], axis + 1);
    }
  }
  visit([], 0);
  return offsets;
}

function squaredDistance(left, right) {
  let total = 0;
  for (let axis = 0; axis < left.length; axis += 1) {
    const delta = right[axis] - left[axis];
    total += delta * delta;
  }
  return total;
}

function particleRecord(particles, index) {
  return {
    index,
    id: particles.ids[index],
    position: particles.positions[index],
    velocity: particles.velocities[index],
    mass: particles.masses[index],
    smoothingLength: particles.smoothingLengths[index]
  };
}

export function buildSpatialHash(first = {}, second = {}) {
  const { state, options } = readBuildArgs(first, second);
  const resolvedCellSize = finiteNumber(options.cellSize, 'cellSize');
  if (resolvedCellSize <= 0) {
    throw new RangeError('cellSize must be positive');
  }
  const boundary = options.boundary || 'open';
  if (boundary !== 'open') {
    throw new RangeError(`Unsupported spatial hash boundary: ${boundary}`);
  }
  const particles = normalizeParticleState(state, {
    dimensions: options.dimensions,
    defaultSmoothingLength: options.defaultSmoothingLength
  });
  const origin = normalizeOrigin(options.origin, particles.dimensions);
  const cellMap = new Map();
  const assignments = [];
  for (let index = 0; index < particles.count; index += 1) {
    const record = particleRecord(particles, index);
    const coords = cellCoordsForPosition(record.position, {
      cellSize: resolvedCellSize,
      origin
    });
    const key = cellKey(coords);
    if (!cellMap.has(key)) {
      cellMap.set(key, { key, coords, particleIds: [], particleIndices: [] });
    }
    const cell = cellMap.get(key);
    cell.particleIds.push(record.id);
    cell.particleIndices.push(index);
    assignments.push({ particleId: record.id, particleIndex: index, cellKey: key, coords });
  }
  const cells = [...cellMap.values()]
    .map((cell) => ({
      key: cell.key,
      coords: cell.coords,
      particleIds: [...cell.particleIds].sort(),
      particleIndices: [...cell.particleIndices].sort((left, right) => left - right),
      bodyIds: [...cell.particleIds].sort(),
      bodyIndices: [...cell.particleIndices].sort((left, right) => left - right)
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    schema: ULG_SPATIAL_HASH_SCHEMA,
    dimensions: particles.dimensions,
    cellSize: resolvedCellSize,
    boundary,
    origin,
    particleCount: particles.count,
    bodyCount: particles.count,
    cellCount: cells.length,
    cells,
    assignments: assignments.sort((left, right) => left.particleIndex - right.particleIndex),
    particles
  };
}

export function queryNeighborPairs(hash, {
  radius,
  includeSelf = false,
  symmetric = false,
  maxPairs = Infinity
} = {}) {
  if (!hash || hash.schema !== ULG_SPATIAL_HASH_SCHEMA) {
    throw new TypeError('queryNeighborPairs requires a spatial hash');
  }
  const resolvedRadius = finiteNumber(radius, 'radius');
  if (resolvedRadius <= 0) {
    throw new RangeError('radius must be positive');
  }
  const resolvedMaxPairs = maxPairs === Infinity ? Infinity : Number(maxPairs);
  if (resolvedMaxPairs !== Infinity && (!Number.isInteger(resolvedMaxPairs) || resolvedMaxPairs < 0)) {
    throw new RangeError('maxPairs must be a non-negative integer or Infinity');
  }
  const particles = hash.particles;
  const cellByKey = new Map(hash.cells.map((cell) => [cell.key, cell]));
  const assignmentByIndex = new Map(hash.assignments.map((assignment) => [assignment.particleIndex, assignment]));
  const radiusCells = Math.ceil(resolvedRadius / hash.cellSize);
  const offsets = createNeighborCellOffsets(hash.dimensions, radiusCells);
  const pairs = [];
  for (let leftIndex = 0; leftIndex < particles.count; leftIndex += 1) {
    const leftAssignment = assignmentByIndex.get(leftIndex);
    for (const offset of offsets) {
      const neighborCoords = leftAssignment.coords.map((coordinate, axis) => coordinate + offset[axis]);
      const cell = cellByKey.get(cellKey(neighborCoords));
      if (!cell) continue;
      for (const rightIndex of cell.particleIndices) {
        if (!includeSelf && rightIndex === leftIndex) continue;
        if (!symmetric && rightIndex <= leftIndex) continue;
        const dr = particles.positions[rightIndex].map((coordinate, axis) => coordinate - particles.positions[leftIndex][axis]);
        const distance2 = squaredDistance(particles.positions[leftIndex], particles.positions[rightIndex]);
        if (distance2 > resolvedRadius * resolvedRadius) continue;
        pairs.push({
          left: leftIndex,
          right: rightIndex,
          leftId: particles.ids[leftIndex],
          rightId: particles.ids[rightIndex],
          sourceId: particles.ids[leftIndex],
          targetId: particles.ids[rightIndex],
          sourceIndex: leftIndex,
          targetIndex: rightIndex,
          dr,
          displacement: dr,
          distance: Math.sqrt(distance2),
          distance2,
          cellKey: cell.key
        });
        if (pairs.length >= resolvedMaxPairs) {
          return { pairs, truncated: true, radius: resolvedRadius, symmetric, includeSelf };
        }
      }
    }
  }
  pairs.sort((left, right) => (
    left.left - right.left
    || left.right - right.right
    || left.cellKey.localeCompare(right.cellKey)
  ));
  return { pairs, truncated: false, radius: resolvedRadius, symmetric, includeSelf };
}

export function buildNeighborGraph(first = {}, second = {}) {
  const { state, options } = readBuildArgs(first, second);
  const radius = options.radius ?? second.radius;
  const hash = buildSpatialHash(state, options);
  const pairResult = queryNeighborPairs(hash, {
    radius,
    includeSelf: options.includeSelf ?? false,
    symmetric: options.symmetric ?? false,
    maxPairs: options.maxPairs ?? Infinity
  });
  return {
    schema: ULG_NEIGHBOR_GRAPH_SCHEMA,
    dimensions: hash.dimensions,
    radius: pairResult.radius,
    cellSize: hash.cellSize,
    boundary: hash.boundary,
    particleCount: hash.particleCount,
    bodyCount: hash.bodyCount,
    pairCount: pairResult.pairs.length,
    pairs: pairResult.pairs,
    truncated: pairResult.truncated,
    spatialHash: {
      schema: hash.schema,
      dimensions: hash.dimensions,
      cellSize: hash.cellSize,
      boundary: hash.boundary,
      particleCount: hash.particleCount,
      bodyCount: hash.bodyCount,
      cellCount: hash.cellCount,
      cells: hash.cells
    }
  };
}
