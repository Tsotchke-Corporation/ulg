import { inspectExactVaporMidpoint } from './sphExactVaporMidpointInspection.js';
import { inspectExactVaporAerosolGraph } from './sphExactPlacementQuantityInspection.js';

// Walk the actual private stages in order. Each graph check independently
// derives all exact endpoint changes; only verified outputs feed the next
// check. No captured state or rate is supplied back to a production encoder.
export function inspectExactVaporSubsteps(inputs) {
  const { edges, before, layout, observed, quantityLayout: q, dtSeconds, format } = inputs;
  const n = observed.rateSubsteps, exponent = -Math.log2(n), stages = [], packets = [];
  if (!Number.isInteger(exponent) || n < 2) throw new Error('Expected dyadic midpoint substeps');
  let gasSources = Object.fromEntries(edges.map(e => [`g:${e.gasKind}:${e.gasIndex}`,
    before.slice(e.gasIndex * layout.rowWords + layout.quantityOffsetWords,
      e.gasIndex * layout.rowWords + layout.quantityOffsetWords + layout.quantityWords)]));
  let liquidWords = inputs.liquidWords.slice(), parcels = inputs.parcels, cellPressure = inputs.cellPressure;
  let gasStates = new Float32Array(3 * 32);
  for (let row = 0; row < 3; row++) gasStates.set(new Float32Array(before.buffer,
    row * layout.rowWords * 4, 32), row * 32);
  let linked = true;
  for (let step = 0; step < n; step++) {
    const prefix = `substep${step}:`;
    const capture = { ...observed, ...Object.fromEntries(Object.entries(observed)
      .filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value])) };
    const midpoint = inspectExactVaporMidpoint({ ...inputs, observed: capture, gasSources, gasStates,
      liquidWords, parcels, cellPressure, intervalScaleExponent: exponent });
    const rates = new Float32Array(capture.rateWords.buffer);
    const numericalEdges = edges.map((e, i) => ({ ...e, deltaMassKg: rates[i * 8 + 4],
      transportEnthalpyCorrectionJ: rates[i * 8 + 5], conductiveHeatJ: rates[i * 8 + 6],
      pressureWorkIntoLiquidJ: rates[i * 8 + 7], intervalScaleExponent: exponent }));
    const graph = inspectExactVaporAerosolGraph({ gasSources, liquidWords,
      outputWords: capture.exactPairWords, layout: q, format, edges: numericalEdges,
      surfaceValues: capture.surfaceValues, projectionWords: capture.exactProjectionWords,
      cellPressure: midpoint.stageCellPressure, originalCellPressure: cellPressure,
      donorWords: capture.midpointPairWords, dtSeconds, intervalScaleExponent: exponent,
      transportPacketMode: observed.transportPacketMode });
    const offsets = observed.midpointViewLayout, end = new Float32Array(capture.endpointSourceWords.buffer);
    const endBits = capture.endpointSourceWords, view = capture.exactProjectionWords;
    linked &&= edges.every((e, i) => endBits[offsets.productOffsetWords + e.gasIndex * 32 + 13] === view[i * 32]
      && endBits[offsets.productOffsetWords + e.gasIndex * 32 + 19] === view[i * 32 + 8]
      && endBits[offsets.parcelOffsetWords + e.parcelIndex * 24 + 3] === view[i * 32 + 1]
      && endBits[offsets.parcelOffsetWords + e.parcelIndex * 24 + 7] === view[i * 32 + 9]
      && endBits[offsets.pressureOffsetWords + 11] === view[i * 32 + 27]);
    if (step) {
      const previous = observed[`substep${step - 1}:surfaceValues`];
      linked &&= edges.every(e => capture.surfaceValues[e.parcelIndex * 4 + 1] === previous[e.parcelIndex * 4 + 3]);
    }
    gasStates = end.slice(offsets.productOffsetWords, offsets.productOffsetWords + 3 * 32);
    parcels = end.slice(offsets.parcelOffsetWords, offsets.parcelOffsetWords + parcels.length);
    cellPressure = { ...cellPressure, gases: Object.fromEntries(Object.entries(cellPressure.gases).map(([key, value]) =>
      [key, { ...value, temperature: gasStates[Number(key.split(':')[2]) * 32 + 16],
        freeVolume: end[offsets.pressureOffsetWords + 11] }])) };
    edges.forEach((e, i) => {
      gasSources[`g:${e.gasKind}:${e.gasIndex}`] = capture.exactPairWords.slice(i * 2 * q.recordWords, (i * 2 + 1) * q.recordWords);
      liquidWords.set(capture.exactPairWords.slice((i * 2 + 1) * q.recordWords, (i * 2 + 2) * q.recordWords), e.parcelIndex * q.recordWords);
    });
    packets.push(...numericalEdges); stages.push({ midpoint, graph });
  }
  const final = observed[`substep${n - 1}:exactPairWords`];
  linked &&= final.length === observed.exactPairWords.length && final.every((w, i) => w === observed.exactPairWords[i]);
  // n exact dyadic fractions of the original interval sum to that interval.
  const wholeInterval = BigInt(n) === 1n << BigInt(-exponent) && observed.rateIntervalSeconds === dtSeconds;
  const observableRateChange = stages.some(s => s.midpoint.observableRateChange);
  return { ...stages.at(-1).graph, pass: linked && wholeInterval && observableRateChange
    && stages.every(s => s.midpoint.pass && s.graph.pass), observableRateChange,
    linked, wholeInterval, stages, packets };
}
