import { createSphSpatialGasCaloricAuthority, resolveSphSpatialGasExchangeMaterials }
  from '../../src/runtime/sph/sphSpatialGasCaloricAdmission.js';
import { observeSphSpatialVaporAerosolExchangeCandidate, observeSphSpatialGasLedgerEosOracle } from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import { acquireSphAerosolParcelRead, releaseSphAerosolParcelRead } from '../../src/runtime/sph/sphAerosolParcelGpu.js';
import { acquireSchroederSpatialSuccessorAerosolRead } from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { selectMlsMpmTerminalParticleFamily } from '../../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import { inspectExactVaporAerosolPair, inspectExactVaporAerosolGraph } from './sphExactPlacementQuantityInspection.js';
import { schroederQuadraticControlVolumeAxisProjection as axisProjection }
  from '../../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjection.js';
import { inspectExactVaporRates } from './sphExactVaporRatesInspection.js';
import { inspectExactVaporMidpoint } from './sphExactVaporMidpointInspection.js';
import { inspectExactVaporSubsteps } from './sphExactVaporSubstepsInspection.js';

// Observe the actual production stages and their final outer publication. No
// observed words are ever supplied to a numerical owner or source registry.
export function createExactVaporCommitInspection({ device, models, thermalMaterialTable, initialAerosol, read,
  shared = false, graph = false, reverseEdges = false, cellPressureWork = false, produceRates = false,
  midpointRates = false, rateSubsteps = 1, dtSeconds = null,
  transportPacketMode = 'exact-rational', convergenceInspection = false }) {
  const caloricAuthority = createSphSpatialGasCaloricAuthority({ thermalMaterialTable,
    condensableThermodynamicsByMaterial: models });
  const surfaceModels = { h2o: { schema: 'peercompute.ulg.linear-pure-interface.v1',
    provenance: 'manufactured actual coupled exchange', interceptNPerM: .2, slopeNPerMK: -.0002,
    minTemperatureK: 200, maxTemperatureK: 500 } };
  const material = resolveSphSpatialGasExchangeMaterials(caloricAuthority, { thermalMaterialTable, surfaceModels });
  const edge = { gasKind: 1, gasIndex: 0, parcelIndex: 0, materialRow: material.materials.indexOf('h2o'),
    deltaMassKg: -(2 ** -16), transportEnthalpyCorrectionJ: 0, conductiveHeatJ: -28.5, pressureWorkIntoLiquidJ: -.1 };
  const half = { ...edge, deltaMassKg: edge.deltaMassKg / 2, conductiveHeatJ: edge.conductiveHeatJ / 2,
    pressureWorkIntoLiquidJ: edge.pressureWorkIntoLiquidJ / 2 };
  const edges = shared ? [{ ...half }, { ...half, parcelIndex: graph ? 1 : 0 }, { ...edge, gasIndex: 1,
    materialRow: material.materials.indexOf('h2o2'), deltaMassKg: 0,
    conductiveHeatJ: 2 ** -24, pressureWorkIntoLiquidJ: 0 }] : [edge];
  if (graph) edges.push({ ...edges[2], parcelIndex: 1, conductiveHeatJ: -(2 ** -25) });
  if (cellPressureWork) {
    for (const e of edges) e.pressureWorkIntoLiquidJ = 0;
    edges.push(...[0, 1].map(parcelIndex => ({ ...edges[2], parcelIndex, gasIndex: 2, conductiveHeatJ: 0 })));
    // A duplicate gas/parcel pair must not apply its boundary work twice.
    if (!produceRates) edges.push({ ...edges[0], deltaMassKg: 0, conductiveHeatJ: 0 });
  }
  const rateModels = produceRates ? { h2o: { schema: 'peercompute.ulg.near-equilibrium-onsager.v1',
    provenance: 'manufactured near-equilibrium rate verification, not calibrated water',
    massMobilityPerAreaKg2KPerJsM2: 1e-6, maxAbsAffinityJPerKgK: 100, maxTemperatureDifferenceK: 1,
    heatTransferCoefficientsWPerM2K: Object.fromEntries(material.materials.map(name => [name, 1])) } } : null;
  if (produceRates) for (const e of edges) {
    e.deltaMassKg = 0; e.transportEnthalpyCorrectionJ = 0; e.conductiveHeatJ = 0;
  }
  if (reverseEdges) edges.reverse();
  const checks = {};
  let before, layout, observed, oracle, publishedFamily, cellPressure, rateOracle, midpointOracle, substepOracle;
  let numericalEdges = edges;
  const same = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
  return {
    request: { caloricAuthority, surfaceModels, edges, transportPacketMode,
      ...(cellPressureWork ? { pressureWorkMode: 'initial-cell-pressure' } : {}),
      ...(produceRates ? { rateModels, rateIntegration: midpointRates ? 'midpoint' : 'initial-rate', rateSubsteps } : {}) },
    particleInput: () => observed.exactParticleWords,
    expectedHistory: () => observed.exactHistoryWords,
    expectedAerosol: () => ({ family: publishedFamily, words: observed.exactAerosolWords,
      ratePackets: produceRates ? { edges: numericalEdges, dtSeconds } : null,
      deltaMassKg: edge.deltaMassKg, massDeltas: numericalEdges.reduce((deltas, e) => {
        deltas[e.parcelIndex] = (deltas[e.parcelIndex] ?? 0) + e.deltaMassKg * (produceRates ? dtSeconds * 2 ** (e.intervalScaleExponent ?? 0) : 1); return deltas;
      }, {}) }),
    async inspectStage(stage, result, reaction) {
      if (stage === 'vaporExchangeGasState') {
        layout = result.completeHistory.exactProductHistoryLayout;
        before = await read(result.completeHistory.productEventBuffer);
        if (cellPressureWork) {
          const eos = await observeSphSpatialGasLedgerEosOracle(result.gasEos);
          if (eos.pressureCells.length !== 1 || eos.compactRows.length !== 3) throw new Error('Expected original three-population gas cell');
          const source = new Float32Array(before.buffer);
          cellPressure = { liquidDensity: material.records[material.materials.indexOf('h2o') * 16 + 8],
            cell: eos.pressureCells[0].gridIndex,
            gases: Object.fromEntries(edges.map(e => [`g:${e.gasKind}:${e.gasIndex}`, {
              molarMass: material.records[e.materialRow * 16 + 1], temperature: source[e.gasIndex * layout.rowWords + 16],
              freeVolume: eos.pressureValues[11] }])) };
        }
        checks.originalReactionHistoryBeforeExchange = Array.from({ length: reaction.residualRowCount }, (_, row) => row)
          .every(row => same(before.slice(row * layout.rowWords + layout.physicalOffsetWords,
            row * layout.rowWords + layout.physicalOffsetWords + 52), reaction.residualPhysical.slice(row * 52, (row + 1) * 52)));
      } else if (stage === 'vaporExchangeCandidate') {
        if (!result.ready) {
          console.log('exact-routing-progress', JSON.stringify({ phase: 'coupled-exchange-rejection-inputs',
            receipt: result.receipt, edges,
            history: Array.from({ length: 3 }, (_, row) => [...new Float32Array(before.buffer,
              row * layout.rowWords * 4, 32)]),
            materialRows: [...material.rows ?? material.materialRows ?? []] }));
          throw new Error(`Native coupled exchange rejected: ${JSON.stringify(result.receipt)}`);
        }
        observed = await observeSphSpatialVaporAerosolExchangeCandidate(result);
        const aerosol = acquireSphAerosolParcelRead({ device, family: initialAerosol.family, expectedGeneration: 0 });
        try {
          if (cellPressureWork) {
            const parcels = new Float32Array((await read(aerosol.buffer)).buffer);
            if (produceRates) {
              const values = new Float32Array(observed.rateWords.buffer);
              numericalEdges = edges.map((e, i) => ({ ...e, deltaMassKg: values[i * 8 + 4],
                transportEnthalpyCorrectionJ: values[i * 8 + 5], conductiveHeatJ: values[i * 8 + 6],
                pressureWorkIntoLiquidJ: values[i * 8 + 7] }));
              checks.noPrescribedRates = edges.every(e => e.deltaMassKg === 0 && e.conductiveHeatJ === 0 && e.transportEnthalpyCorrectionJ === 0);
              checks.nonzeroStateRates = numericalEdges.some(e => e.deltaMassKg !== 0);
            }
            const projected = new Float32Array(observed.exactProjectionWords.buffer);
            cellPressure.weights = edges.map((e, index) => {
              const position = [...parcels.slice(e.parcelIndex * 24, e.parcelIndex * 24 + 3)].map(v => v * 2);
              const base = position.map(v => Math.floor(v - .5)), f = position.map((v, a) => v - base[a]);
              const basis = (v, i) => i === 0 ? .5 * (1.5 - v) ** 2 : i === 1 ? .75 - (v - 1) ** 2 : .5 * (v - .5) ** 2;
              let weight = 0;
              for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
                const offsets = [x, y, z]; let contribution = 1;
                for (let axis = 0; axis < 3; axis++) {
                  const w = axisProjection(base[axis] + offsets[axis], 0, 0, 4, 0);
                  if (!w.valid) throw new Error('Invalid independent occupancy geometry');
                  contribution *= basis(f[axis], offsets[axis]) * ((w.cell0 === cellPressure.cell[axis] ? w.weight0 : 0)
                    + (w.cell1 === cellPressure.cell[axis] ? w.weight1 : 0));
                }
                weight += contribution;
              }
              const actual = projected[index * 32 + 26];
              if (!(actual > 0 && actual < 1 && Math.abs(actual - weight) <= weight * 2e-6)) {
                throw new Error(`Pressure occupancy weight ${index}: ${actual} != ${weight}`);
              }
              return actual;
            });
            checks.originalOccupancyWeights = cellPressure.weights.length === edges.length;
            if (rateSubsteps > 1) {
              substepOracle = inspectExactVaporSubsteps({ edges, models, material, rateModels, before, layout, convergenceInspection,
                parcels, cellPressure, observed, dtSeconds, liquidWords: initialAerosol.words,
                quantityLayout: aerosol.exactQuantities.quantityLayout, format: aerosol.exactQuantities.format });
              numericalEdges = substepOracle.packets;
              checks.independentMidpointSubsteps = substepOracle.pass;
              checks.wholeOriginalInterval = substepOracle.wholeInterval && observed.rateSubsteps === rateSubsteps;
            } else if (midpointRates) {
              midpointOracle = inspectExactVaporMidpoint({ edges, models, material, rateModels, before, layout,
                parcels, cellPressure, observed, dtSeconds, liquidWords: initialAerosol.words,
                quantityLayout: aerosol.exactQuantities.quantityLayout, format: aerosol.exactQuantities.format });
              rateOracle = midpointOracle.rateOracle;
              checks.independentMidpointStage = midpointOracle.pass;
            } else if (produceRates) {
              rateOracle = inspectExactVaporRates({ edges, models, material, rateModels, before, layout,
                parcels, cellPressure, rateWords: observed.rateWords, dtSeconds, observedInterval: observed.rateIntervalSeconds });
              checks.independentStateRates = rateOracle.pass;
            }
          }
          oracle = substepOracle ?? (shared ? inspectExactVaporAerosolGraph({ gasSources: Object.fromEntries(edges.map(e => [`g:${e.gasKind}:${e.gasIndex}`,
            before.slice(e.gasIndex * layout.rowWords + layout.quantityOffsetWords,
              e.gasIndex * layout.rowWords + layout.quantityOffsetWords + layout.quantityWords)])),
            liquidWords: initialAerosol.words, outputWords: observed.exactPairWords,
            layout: aerosol.exactQuantities.quantityLayout, format: aerosol.exactQuantities.format,
            edges: numericalEdges, surfaceValues: observed.surfaceValues, projectionWords: observed.exactProjectionWords,
            cellPressure: midpointOracle?.stageCellPressure ?? cellPressure, originalCellPressure: cellPressure,
            donorWords: midpointRates ? observed.midpointPairWords : null, dtSeconds: produceRates ? dtSeconds : null, transportPacketMode })
            : inspectExactVaporAerosolPair({ gasWords: before.slice(layout.quantityOffsetWords,
            layout.quantityOffsetWords + layout.quantityWords), liquidWords: initialAerosol.words,
            outputWords: observed.exactPairWords, layout: aerosol.exactQuantities.quantityLayout,
            format: aerosol.exactQuantities.format, edge, surfaceValues: observed.surfaceValues }));
        } finally { releaseSphAerosolParcelRead(aerosol); }
        checks.independentExchangeConservation = oracle.pass;
        checks.transportPacketMode = observed.transportPacketMode === transportPacketMode;
        if (transportPacketMode === 'rounded-dyadic-53') checks.roundedPacketsBounded = oracle.roundedPacketCount > 0 && oracle.pass;
        if (produceRates) checks.unchangedProjectedSurface = observed.surfaceValues[1] === observed.surfaceValues[3];
        else checks.finiteSurfaceChange = observed.surfaceValues[1] !== observed.surfaceValues[3];
        if (shared) {
          checks.sharedGasAndParcel = oracle.edgeCount === (produceRates ? 6 : cellPressureWork ? 7 : graph ? 4 : 3)
            && oracle.endpointCount === (cellPressureWork ? 5 : graph ? 4 : 3);
          if (cellPressureWork) {
            checks.noPrescribedWork = edges.every(e => e.pressureWorkIntoLiquidJ === 0);
            checks.allGasPopulationsDoWork = oracle.changedGasEnergies.includes('g:1:2')
              && edges.filter(e => e.gasIndex === 2).every(e => e.deltaMassKg === 0 && e.conductiveHeatJ === 0);
            checks.uniquePressureWorkPairs = oracle.pressurePairCount === 6;
          }
          checks.separateSpeciesHeat = oracle.changedGasEnergies.includes('g:1:1');
          if (!produceRates) checks.secondGasTemperatureChanged = new Float32Array(before.buffer)[layout.rowWords + 16]
            !== new Float32Array(observed.exactHistoryWords.buffer)[layout.rowWords + 16];
          checks.gatheredEveryGasOnce = edges.every((edge, index) => same(
            observed.exactHistoryWords.slice(edge.gasIndex * layout.rowWords + layout.quantityOffsetWords,
              edge.gasIndex * layout.rowWords + layout.quantityOffsetWords + layout.quantityWords),
            observed.exactPairWords.slice(index * 2 * layout.quantityWords, (index * 2 + 1) * layout.quantityWords)));
          checks.gatheredParcelOnce = edges.every((edge, index) => same(observed.exactAerosolWords.slice(
            edge.parcelIndex * layout.quantityWords, (edge.parcelIndex + 1) * layout.quantityWords),
            observed.exactPairWords.slice((index * 2 + 1) * layout.quantityWords, (index * 2 + 2) * layout.quantityWords)));
        }
      } else if (stage === 'postMechanicsClosure') {
        try {
          selectMlsMpmTerminalParticleFamily({ postMechanicsClosure: { ...result } });
          checks.copiedClosureRejected = false;
        } catch (error) { checks.copiedClosureRejected = error.code === 'ERR_MLS_MPM_POST_MECHANICS_FOREIGN_CLOSURE'; }
        const family = result.aerosolCondensateTransition.aerosolFamily;
        try { acquireSphAerosolParcelRead({ device, family, expectedGeneration: family.generation }); checks.unpublishedFamilyUnreadable = false; }
        catch { checks.unpublishedFamilyUnreadable = true; }
      }
    },
    async inspectPublished(next, closure) {
      const family = next.sphParticleUpload.aerosolFamily;
      publishedFamily = family;
      const aerosol = acquireSchroederSpatialSuccessorAerosolRead({ device,
        sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload });
      try {
        checks.originalCombinedPublication = family !== initialAerosol.family
          && family === closure.aerosolCondensateTransition.aerosolFamily
          && family === aerosol.family
          && next.sphParticleUpload.exactMassInventory.provenance.kind === 'vapor-aerosol-exchange';
        const owners = next.schroederSpatialSuccessorSourceFamily.componentOwnerStages;
        checks.publishedWriterLineage = owners.state === 'vapor-aerosol-exchange'
          && owners.thermo === 'vapor-aerosol-exchange' && owners.mechanics === 'exchange-mechanics-refresh';
        checks.publishedExactAerosol = same(await read(aerosol.exactQuantities.quantityBuffer), observed.exactAerosolWords);
        checks.publishedPhysicalAerosol = same(await read(aerosol.buffer), observed.parcelWords);
        checks.publishedParticleState = same(await read(next.sphParticleUpload.stateBuffer), new Uint32Array(observed.stateValues.buffer));
        checks.publishedParticleThermo = same(await read(next.sphParticleUpload.thermoBuffer), new Uint32Array(observed.thermoValues.buffer));
        const history = await read(next.residentProductMass.productEventBuffer);
        checks.publishedCompleteHistory = same(history.slice(0, observed.exactHistoryWords.length), observed.exactHistoryWords)
          && history.slice(observed.exactHistoryWords.length).every(word => word === 0);
        const old = new Float32Array(before.buffer), updated = new Float32Array(history.buffer);
        if (midpointRates) checks.actualResidualMassDirection = Math.sign(updated[13] - old[13])
          === -Math.sign(numericalEdges.filter(e => e.gasIndex === 0).reduce((sum, e) => sum + e.deltaMassKg, 0));
        else checks.actualResidualMassIncreased = updated[13] > old[13];
        checks.birthLineagePreserved = history[3] === before[3] && history[9] === before[9] && history[12] === before[12];
        checks.noKineticClaim = closure.vaporAerosolExchangeStep.kineticsAdmitted === false
          && closure.vaporAerosolExchangeStep.exchangeIntervalAdmitted === false;
      } finally { releaseSphAerosolParcelRead(aerosol); }
      const result = { checks: { ...checks }, oracle, rateOracle, midpointOracle, pass: Object.values(checks).every(Boolean) };
      if (!result.pass) throw new Error(`Actual exchange publication verification failed: ${JSON.stringify(result)}`);
      return result;
    }
  };
}
