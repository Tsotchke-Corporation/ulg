import { normalizeParticleState } from './particleState.js';
import { ULG_NEIGHBOR_GRAPH_SCHEMA, buildNeighborGraph } from './spatialHash.js';

export const ULG_FIELD_OBSERVERS_SCHEMA = 'peercompute.ulg.field-observers.v0';
export const ULG_FIELD_OBSERVER_SUMMARY_SCHEMA = 'peercompute.ulg.field-observer-summary.v0';

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label);
  if (number <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
  return number;
}

function readScalarFields(fields, particleCount) {
  const scalarFields = {};
  for (const [name, values] of Object.entries(fields || {})) {
    if (!Array.isArray(values) || values.length !== particleCount) {
      throw new TypeError(`field ${name} must have one scalar value per particle`);
    }
    scalarFields[name] = values.map((value, index) => finiteNumber(value, `${name}[${index}]`));
  }
  return scalarFields;
}

function assertScalarFields(fields) {
  if (Object.keys(fields).length === 0) {
    throw new Error('field observers require at least one scalar field');
  }
}

function kernelWeight({ distance, smoothingLength, kernel }) {
  const h = positiveNumber(smoothingLength, 'smoothingLength');
  const q = finiteNumber(distance, 'distance') / h;
  if (q < 0 || q >= 1) return 0;
  if (kernel === 'linear-compact-reference') {
    return 1 - q;
  }
  throw new RangeError(`Unsupported observer kernel: ${kernel}`);
}

function createAccumulator({ id, index, fieldNames }) {
  return {
    id,
    index,
    neighborCount: 0,
    weightSum: 0,
    weightedSums: Object.fromEntries(fieldNames.map((name) => [name, 0])),
    observedFields: {}
  };
}

function addContribution({ accumulator, fields, sourceIndex, weight }) {
  if (weight <= 0) return;
  accumulator.weightSum += weight;
  if (sourceIndex !== accumulator.index) {
    accumulator.neighborCount += 1;
  }
  for (const [name, values] of Object.entries(fields)) {
    accumulator.weightedSums[name] += values[sourceIndex] * weight;
  }
}

function finalizeAccumulator(accumulator, fieldNames) {
  for (const name of fieldNames) {
    accumulator.observedFields[name] = accumulator.weightSum > 0
      ? accumulator.weightedSums[name] / accumulator.weightSum
      : null;
  }
  return accumulator;
}

function validateNeighborGraph(graph, particleState) {
  if (!graph || graph.schema !== ULG_NEIGHBOR_GRAPH_SCHEMA) {
    throw new TypeError(`neighborGraph.schema must be ${ULG_NEIGHBOR_GRAPH_SCHEMA}`);
  }
  if (graph.dimensions !== particleState.dimensions) {
    throw new Error('neighborGraph dimensions must match particle state dimensions');
  }
  const graphCount = graph.particleCount ?? graph.bodyCount;
  if (graphCount !== particleState.count) {
    throw new Error('neighborGraph particle count must match particle state count');
  }
  for (const [index, pair] of graph.pairs.entries()) {
    const left = Number.isInteger(pair.left) ? pair.left : pair.sourceIndex;
    const right = Number.isInteger(pair.right) ? pair.right : pair.targetIndex;
    if (!Number.isInteger(left) || left < 0 || left >= particleState.count) {
      throw new RangeError(`neighborGraph pair[${index}].left out of range`);
    }
    if (!Number.isInteger(right) || right < 0 || right >= particleState.count) {
      throw new RangeError(`neighborGraph pair[${index}].right out of range`);
    }
  }
}

function canonicalizePairs(pairs) {
  const seen = new Set();
  const canonical = [];
  for (const pair of pairs) {
    const left = Number.isInteger(pair.left) ? pair.left : pair.sourceIndex;
    const right = Number.isInteger(pair.right) ? pair.right : pair.targetIndex;
    const min = Math.min(left, right);
    const max = Math.max(left, right);
    const key = `${min}:${max}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (left <= right) {
      canonical.push(pair);
    } else {
      canonical.push({
        ...pair,
        left: right,
        right: left,
        sourceIndex: right,
        targetIndex: left,
        leftId: pair.rightId || pair.targetId,
        rightId: pair.leftId || pair.sourceId,
        sourceId: pair.targetId || pair.rightId,
        targetId: pair.sourceId || pair.leftId,
        dr: Array.isArray(pair.dr) ? pair.dr.map((value) => -value) : undefined,
        displacement: Array.isArray(pair.displacement) ? pair.displacement.map((value) => -value) : undefined
      });
    }
  }
  return canonical;
}

export function evaluateFieldObservers({
  particles,
  fields = {},
  neighborGraph = null,
  radius = null,
  cellSize = null,
  smoothingLength = null,
  kernel = 'linear-compact-reference',
  includeSelf = true
} = {}) {
  const particleState = normalizeParticleState(particles, {
    defaultSmoothingLength: smoothingLength
  });
  const fallbackSmoothingLength = positiveNumber(
    smoothingLength ?? radius ?? particleState.smoothingLengths.find((value) => value != null) ?? 1,
    'smoothingLength'
  );
  const smoothingLengths = particleState.smoothingLengths.map((value, index) => (
    positiveNumber(value ?? fallbackSmoothingLength, `smoothingLengths[${index}]`)
  ));
  const resolvedRadius = positiveNumber(radius ?? Math.max(...smoothingLengths), 'radius');
  const graph = neighborGraph || buildNeighborGraph(particleState, {
    cellSize: cellSize ?? resolvedRadius,
    radius: resolvedRadius,
    dimensions: particleState.dimensions
  });
  const scalarFields = readScalarFields(fields, particleState.count);
  assertScalarFields(scalarFields);
  validateNeighborGraph(graph, particleState);
  const fieldNames = Object.keys(scalarFields);
  const accumulators = particleState.ids.map((id, index) => createAccumulator({ id, index, fieldNames }));

  if (includeSelf) {
    for (let index = 0; index < particleState.count; index += 1) {
      addContribution({
        accumulator: accumulators[index],
        fields: scalarFields,
        sourceIndex: index,
        weight: kernelWeight({ distance: 0, smoothingLength: smoothingLengths[index], kernel })
      });
    }
  }

  for (const pair of canonicalizePairs(graph.pairs)) {
    const left = Number.isInteger(pair.left) ? pair.left : pair.sourceIndex;
    const right = Number.isInteger(pair.right) ? pair.right : pair.targetIndex;
    const distance = finiteNumber(pair.distance, 'pair.distance');
    addContribution({
      accumulator: accumulators[left],
      fields: scalarFields,
      sourceIndex: right,
      weight: kernelWeight({ distance, smoothingLength: smoothingLengths[left], kernel })
    });
    addContribution({
      accumulator: accumulators[right],
      fields: scalarFields,
      sourceIndex: left,
      weight: kernelWeight({ distance, smoothingLength: smoothingLengths[right], kernel })
    });
  }

  const observers = accumulators.map((accumulator) => finalizeAccumulator(accumulator, fieldNames));
  const zeroWeightCount = observers.filter((observer) => observer.weightSum === 0).length;
  const maxNeighborCount = observers.reduce((max, observer) => Math.max(max, observer.neighborCount), 0);
  const maxWeightSum = observers.reduce((max, observer) => Math.max(max, observer.weightSum), 0);
  return {
    schema: ULG_FIELD_OBSERVERS_SCHEMA,
    observerKind: 'compact-support-scalar-field-reference',
    kernel,
    dimensions: particleState.dimensions,
    particleCount: particleState.count,
    pairCount: graph.pairCount,
    observedFieldNames: fieldNames,
    includeSelf,
    radius: resolvedRadius,
    smoothingLengths,
    observers,
    summary: {
      schema: ULG_FIELD_OBSERVER_SUMMARY_SCHEMA,
      status: zeroWeightCount === 0 ? 'pass' : 'warn',
      observerKind: 'compact-support-scalar-field-reference',
      kernel,
      particleCount: particleState.count,
      pairCount: graph.pairCount,
      observedFieldNames: fieldNames,
      zeroWeightCount,
      maxNeighborCount,
      maxWeightSum,
      scientificValidation: false,
      fullPhysicsValidation: false
    }
  };
}
