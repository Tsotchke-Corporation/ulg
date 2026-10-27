import { inspectExactVaporAerosolGraph } from './sphExactPlacementQuantityInspection.js';
import { inspectExactVaporRates } from './sphExactVaporRatesInspection.js';

export function inspectExactVaporMidpoint({ edges, models, material, rateModels, before, layout,
  parcels, cellPressure, observed, dtSeconds, liquidWords, quantityLayout, format,
  gasSources = null, gasStates: initialGasStates = null, intervalScaleExponent = 0, convergenceInspection = false }) {
  const fields = ['deltaMassKg', 'transportEnthalpyCorrectionJ', 'conductiveHeatJ', 'pressureWorkIntoLiquidJ'];
  const initialRates = new Float32Array(observed.midpointInitialRateWords.buffer);
  const initialEdges = edges.map((edge, i) => ({ ...edge,
    ...Object.fromEntries(fields.map((key, j) => [key, initialRates[i * 8 + 4 + j]])) }));
  const initialRateOracle = inspectExactVaporRates({ edges, models, material, rateModels, before, layout,
    parcels, cellPressure, rateWords: observed.midpointInitialRateWords, dtSeconds, observedInterval: observed.rateIntervalSeconds,
    gasStates: initialGasStates, gasStride: initialGasStates ? 32 : layout.rowWords });
  const predictorOracle = inspectExactVaporAerosolGraph({
    gasSources: gasSources ?? Object.fromEntries(edges.map(e => [`g:${e.gasKind}:${e.gasIndex}`,
      before.slice(e.gasIndex * layout.rowWords + layout.quantityOffsetWords,
        e.gasIndex * layout.rowWords + layout.quantityOffsetWords + layout.quantityWords)])),
    liquidWords, outputWords: observed.midpointPairWords, layout: quantityLayout, format,
    edges: initialEdges, surfaceValues: observed.midpointSurfaceValues,
    projectionWords: observed.midpointProjectionWords, cellPressure, dtSeconds, intervalScaleExponent: intervalScaleExponent - 1,
    transportPacketMode: observed.transportPacketMode });
  const offsets = observed.midpointViewLayout, staged = new Float32Array(observed.midpointSourceWords.buffer);
  const gasStates = staged.slice(offsets.productOffsetWords, offsets.productOffsetWords + 3 * 32);
  const midpointParcels = staged.slice(offsets.parcelOffsetWords, offsets.parcelOffsetWords + parcels.length);
  const stageCellPressure = { ...cellPressure, gases: Object.fromEntries(Object.entries(cellPressure.gases).map(([key, value]) => {
    const row = Number(key.split(':')[2]);
    return [key, { ...value, temperature: gasStates[row * 32 + 16], freeVolume: staged[offsets.pressureOffsetWords + 11] }];
  })) };
  const bits = new Uint32Array(gasStates.buffer), parcelBits = new Uint32Array(midpointParcels.buffer);
  const views = observed.midpointProjectionWords;
  const projectedInputsMatch = edges.every((e, i) => bits[e.gasIndex * 32 + 13] === views[i * 32]
    && bits[e.gasIndex * 32 + 19] === views[i * 32 + 8]
    && parcelBits[e.parcelIndex * 24 + 3] === views[i * 32 + 1]
    && parcelBits[e.parcelIndex * 24 + 7] === views[i * 32 + 9]
    && observed.midpointSourceWords[offsets.pressureOffsetWords + 11] === views[i * 32 + 27]);
  const rateOracle = inspectExactVaporRates({ edges, models, material, rateModels, before, layout,
    parcels: midpointParcels, cellPressure: stageCellPressure, rateWords: observed.rateWords,
    dtSeconds, observedInterval: observed.rateIntervalSeconds, gasStates, gasStride: 32 });
  const finalRates = new Float32Array(observed.rateWords.buffer);
  const reevaluated = edges.some((edge, i) => edge.gasIndex === 0
    && Math.abs(finalRates[i * 8 + 4] - initialRates[i * 8 + 4]) > Math.abs(initialRates[i * 8 + 4]) * .1);
  // The original manufactured witness still requires >10% rate change. A
  // refinement run instead checks both independently evaluated stages and
  // requires an observable change across the complete integration below.
  const observableRateChange = edges.some((edge, i) => finalRates[i * 8 + 4] !== initialRates[i * 8 + 4]);
  return { pass: initialRateOracle.pass && predictorOracle.pass && projectedInputsMatch && rateOracle.pass
    && (convergenceInspection || reevaluated)
    && observed.rateIntegration === 'midpoint',
    initialRateOracle, predictorOracle, projectedInputsMatch, rateOracle, reevaluated, observableRateChange, stageCellPressure };
}
