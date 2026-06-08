export const ULG_EDGE_MESSAGES_SCHEMA = 'peercompute.ulg.edge-messages.v0';
export const ULG_EDGE_MESSAGE_SUMMARY_SCHEMA = 'peercompute.ulg.edge-message-summary.v0';

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function vectorScale(vector, scalar) {
  return vector.map((value) => value * scalar);
}

function vectorAdd(left, right) {
  return left.map((value, index) => value + right[index]);
}

function vectorNegate(vector) {
  return vector.map((value) => -value);
}

function vectorMaxAbs(vector) {
  return vector.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function zeroVector(dimensions) {
  return Array.from({ length: dimensions }, () => 0);
}

function unitVector(displacement, distance) {
  if (distance <= 0) {
    throw new RangeError('edge messages require positive pair distance');
  }
  return displacement.map((value) => value / distance);
}

function readPairs({ neighborGraph, pairs }) {
  if (Array.isArray(pairs)) return pairs;
  if (Array.isArray(neighborGraph?.pairs)) return neighborGraph.pairs;
  throw new TypeError('evaluateEdgeMessages requires pairs or a neighbor graph');
}

function normalizePair(pair, index) {
  const left = Number.isInteger(pair.left) ? pair.left : pair.sourceIndex;
  const right = Number.isInteger(pair.right) ? pair.right : pair.targetIndex;
  const leftId = pair.leftId || pair.sourceId || `particle-${left}`;
  const rightId = pair.rightId || pair.targetId || `particle-${right}`;
  const displacement = (pair.dr || pair.displacement || []).map((value, axis) => (
    finiteNumber(value, `pairs[${index}].dr[${axis}]`)
  ));
  const distance = finiteNumber(pair.distance, `pairs[${index}].distance`);
  return {
    left,
    right,
    leftId,
    rightId,
    displacement,
    distance,
    distance2: finiteNumber(pair.distance2 ?? distance * distance, `pairs[${index}].distance2`),
    cellKey: pair.cellKey || null
  };
}

function createOutOfRangeEdge({ pair, index, error }) {
  return {
    index,
    left: pair.left,
    right: pair.right,
    leftId: pair.leftId,
    rightId: pair.rightId,
    distance: pair.distance,
    reason: error instanceof Error ? error.message : String(error)
  };
}

export function evaluateEdgeMessages({
  neighborGraph = null,
  pairs = null,
  particles = null,
  closureHandle,
  fields = {},
  tolerance = 1e-12
} = {}) {
  if (!closureHandle?.sample) {
    throw new TypeError('evaluateEdgeMessages requires a closure handle');
  }
  const sourcePairs = readPairs({ neighborGraph, pairs });
  const messages = [];
  const outOfRangeEdges = [];
  for (let index = 0; index < sourcePairs.length; index += 1) {
    const pair = normalizePair(sourcePairs[index], index);
    let sample;
    try {
      sample = closureHandle.sample({
        r: pair.distance,
        pair,
        particles,
        fields
      });
    } catch (error) {
      if (error instanceof RangeError) {
        outOfRangeEdges.push(createOutOfRangeEdge({ pair, index, error }));
        continue;
      }
      throw error;
    }
    const derivative = finiteNumber(sample.derivatives?.dEdr, `pairs[${index}].dEdr`);
    const direction = unitVector(pair.displacement, pair.distance);
    const forceOnSource = vectorScale(direction, derivative);
    const forceOnTarget = vectorNegate(forceOnSource);
    const antisymmetricResidual = vectorAdd(forceOnSource, forceOnTarget);
    messages.push({
      schema: ULG_EDGE_MESSAGES_SCHEMA,
      messageId: `${pair.leftId}->${pair.rightId}:${index}`,
      left: pair.left,
      right: pair.right,
      leftId: pair.leftId,
      rightId: pair.rightId,
      sourceId: pair.leftId,
      targetId: pair.rightId,
      sourceIndex: pair.left,
      targetIndex: pair.right,
      cellKey: pair.cellKey,
      distance: pair.distance,
      distance2: pair.distance2,
      displacement: pair.displacement,
      closureId: closureHandle.closureId,
      sampledPotentialEnergy: sample.value,
      sampledDerivative: derivative,
      forceOnSource,
      forceOnTarget,
      antisymmetricResidual,
      status: vectorMaxAbs(antisymmetricResidual) <= tolerance ? 'pass' : 'warn'
    });
  }
  const dimensions = neighborGraph?.dimensions || messages[0]?.forceOnSource?.length || 1;
  return {
    schema: ULG_EDGE_MESSAGES_SCHEMA,
    dimensions,
    tolerance,
    pairCount: sourcePairs.length,
    messageCount: messages.length,
    outOfRangeCount: outOfRangeEdges.length,
    messages,
    outOfRangeEdges,
    summary: summarizeEdgeMessages({ messages, dimensions, tolerance, outOfRangeEdges })
  };
}

export function summarizeEdgeMessages({
  messages,
  dimensions,
  tolerance = 1e-12,
  outOfRangeEdges = []
} = {}) {
  if (!Array.isArray(messages)) {
    throw new TypeError('summarizeEdgeMessages requires messages');
  }
  const resolvedDimensions = Number.isInteger(dimensions) && dimensions > 0
    ? dimensions
    : messages[0]?.forceOnSource?.length || 1;
  let netForce = zeroVector(resolvedDimensions);
  let maxAntisymmetricResidualAbs = 0;
  let totalSampledPotentialEnergy = 0;
  for (const message of messages) {
    netForce = vectorAdd(netForce, message.forceOnSource);
    netForce = vectorAdd(netForce, message.forceOnTarget);
    maxAntisymmetricResidualAbs = Math.max(
      maxAntisymmetricResidualAbs,
      vectorMaxAbs(message.antisymmetricResidual)
    );
    totalSampledPotentialEnergy += finiteNumber(message.sampledPotentialEnergy, 'sampledPotentialEnergy');
  }
  const maxNetForceAbs = vectorMaxAbs(netForce);
  const status = maxAntisymmetricResidualAbs <= tolerance
    && maxNetForceAbs <= tolerance
    && outOfRangeEdges.length === 0
    ? 'pass'
    : 'warn';
  return {
    schema: ULG_EDGE_MESSAGE_SUMMARY_SCHEMA,
    status,
    dimensions: resolvedDimensions,
    messageCount: messages.length,
    outOfRangeCount: outOfRangeEdges.length,
    netForce,
    maxNetForceAbs,
    maxAntisymmetricResidualAbs,
    totalSampledPotentialEnergy,
    tolerance,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}
