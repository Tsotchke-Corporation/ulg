import { runSchroederSameLevelMechanicsWebGpu } from '../../src/runtime/sph/schroederHierarchyGpu.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { runSphSpatialGasLedgerEosRetainedWebGpu, releaseSphSpatialGasLedgerEosAfterQueue,
  SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE } from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import { runSphSpatialVaporAerosolExchangeCandidate, observeSphSpatialVaporAerosolExchangeCandidate,
  releaseSphSpatialVaporAerosolExchangeCandidate } from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import { productEventLiveCountCopyDescriptor } from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { inspectExactHistoryP2gProjection, inspectExactVaporAerosolPair } from './sphExactPlacementQuantityInspection.js';
import { createSphSpatialGasCaloricAuthority, resolveSphSpatialGasExchangeMaterials } from '../../src/runtime/sph/sphSpatialGasCaloricAdmission.js';
import { inspectExactHistoryGasVolume } from './sphExactHistoryGasVolumeInspection.js';
import { acquireSphAerosolParcelRead, releaseSphAerosolParcelRead } from '../../src/runtime/sph/sphAerosolParcelGpu.js';
import { assertSphLegacyMassPathAllowed } from '../../src/runtime/sph/sphGpuBuffers.js';
import { stableOpticalMaterialId } from '../../src/runtime/material/opticalGpuBuffers.js';

// A real completed reaction's published owner and the following original SS
// generation feed the original EOS. Instrument allocations only to observe
// numeric views; no producer, history or count registration is synthesized.
export async function inspectExactHistoryGasNative({ args, next, read, expectedCondensedRows = 0 }) {
  const { device } = args, history = next.residentProductMass;
  const initialBorrowCount = history.__ulgActiveBorrowCount;
  const caloricAuthority = createSphSpatialGasCaloricAuthority({ thermalMaterialTable: args.thermalMaterialTable,
    condensableThermodynamicsByMaterial: args.condensableThermodynamicsByMaterial });
  const family = next.schroederSpatialSuccessorSourceFamily;
  const lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
  const before = await read(history.productEventBuffer), layout = history.exactProductHistoryLayout;
  const descriptor = productEventLiveCountCopyDescriptor(history, device);
  const count = (await read(descriptor.controlBuffer)).slice(descriptor.controlOffsetBytes / 4);
  if (count[3] === 0) {
    spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });
    throw new Error('Gas consumer verification requires genuine nonempty retained products');
  }
  const stop = new Error('Original gas consumer inspected before next mechanics');
  const checks = {}, evidence = {};
  const exchangedAerosol = args.vaporCommitNative?.expectedAerosol();
  let aerosolRead = null, aerosolWords = null;
  let spatialGeneration = null;
  const retire = async execution => releaseSphSpatialGasLedgerEosAfterQueue(execution) === true
    && await execution.releasePromise === true && execution.released === true;
  try {
    if (args.initialAerosol) {
      try {
        const unexpected = acquireSphAerosolParcelRead({ device, family: args.initialAerosol.family, expectedGeneration: 0 });
        releaseSphAerosolParcelRead(unexpected); checks.closedColdAerosolRejected = false;
      } catch { checks.closedColdAerosolRejected = true; }
      aerosolRead = spatial.acquireSchroederSpatialSuccessorAerosolRead({ device,
        sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload, consumerLease: lease });
      const exact = aerosolRead.exactQuantities;
      const quantityWords = await read(exact.quantityBuffer), l = exact.quantityLayout, q = exact.format.quantumExponent;
      const integer = words => Array.from(words).reverse().reduce((v, w) => (v << 32n) | BigInt(w), 0n);
      const mass = integer(quantityWords.slice(l.massOffsetWords, l.massOffsetWords + exact.format.wordCount));
      const expectedWords = exchangedAerosol?.words ?? args.initialAerosol.words;
      const expectedFamily = exchangedAerosol?.family ?? args.initialAerosol.family;
      const units = value => {
        const bits = new Uint32Array(new Float32Array([value]).buffer)[0], exponent = (bits >>> 23) & 255;
        const coefficient = BigInt((bits & 0x7fffff) | (exponent ? 0x800000 : 0));
        return (bits >>> 31 ? -coefficient : coefficient) << BigInt((exponent ? exponent - 150 : -149) - q);
      };
      const dyadic = value => {
        const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, true);
        const hi = view.getUint32(4, true), exponent = (hi >>> 20) & 2047;
        const coefficient = (BigInt((hi & 0xfffff) | (exponent ? 0x100000 : 0)) << 32n) | BigInt(view.getUint32(0, true));
        return { n: hi >>> 31 ? -coefficient : coefficient, e: exponent ? exponent - 1075 : -1074 };
      };
      const rateUnits = parcel => exchangedAerosol.ratePackets.edges.filter(edge => edge.parcelIndex === parcel).reduce((sum, edge) => {
        const rate = dyadic(edge.deltaMassKg), interval = dyadic(exchangedAerosol.ratePackets.dtSeconds);
        const shift = rate.e + interval.e + (edge.intervalScaleExponent ?? 0) - q, product = rate.n * interval.n;
        if (shift < 0 && product % (1n << BigInt(-shift)) !== 0n) throw new Error('Rate packet outside original integer quantum');
        return sum + (shift < 0 ? product / (1n << BigInt(-shift)) : product << BigInt(shift));
      }, 0n);
      checks.aerosolExactMass = Array.from({ length: aerosolRead.capacity }, (_, parcel) => {
        const at = parcel * l.recordWords + l.massOffsetWords;
        const original = integer(args.initialAerosol.words.slice(at, at + exact.format.wordCount));
        const actual = integer(quantityWords.slice(at, at + exact.format.wordCount));
        return actual === original + (exchangedAerosol?.ratePackets ? rateUnits(parcel) : units(exchangedAerosol?.massDeltas[parcel] ?? 0));
      }).every(Boolean);
      checks.aerosolQuantitiesPreserved = quantityWords.length === expectedWords.length
        && quantityWords.every((v, i) => v === expectedWords[i]);
      checks.aerosolOriginalOwner = aerosolRead.family === expectedFamily
        && next.sphParticleUpload.aerosolFamily === expectedFamily;
      if (exchangedAerosol) checks.exchangedAerosol = expectedFamily !== args.initialAerosol.family
        && (exchangedAerosol.ratePackets ? exchangedAerosol.ratePackets.edges.some(edge => edge.deltaMassKg !== 0)
          : exchangedAerosol.deltaMassKg === -(2 ** -16));
      aerosolWords = await read(aerosolRead.buffer);
      evidence.aerosol = { massUnits: mass.toString(), quantumExponent: q,
        physicalMass: new Float32Array(aerosolWords.buffer)[3], quantityWords: quantityWords.length };
    }
    await runSchroederSameLevelMechanicsWebGpu({ device,
      sphParticleState: { ...args.sphParticleState, cpuStateStale: true },
      mlsMpmParticleState: { ...args.mlsMpmParticleState, cpuStateStale: true },
      sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
      levelAssignment: next.schroederSpatialSuccessorLevelAssignment,
      levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
      selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
      dt: .000001, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
      enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
      enableLawQueue: false, enableLawNeighborCandidates: false,
      enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
      residentStepOptions: { thermalMaterialTable: args.thermalMaterialTable,
        mechanicsMaterialTable: args.mechanicsMaterialTable, internalPressureScale: 0,
        fuseNoFullResidentMechanics: false, gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null },
      gpuTimestampRecorder: { active: true, async measureQueueStage(meta, work) {
        const stageResult = await work();
        if (meta.stage === 'spatial-epoch-generation') { spatialGeneration = stageResult; return stageResult; }
        // The original resident stage starts after the original SS transaction
        // has bound its aerosol source. Inspect before P2G changes anything.
        if (meta.stage !== 'deviceAcquire' || !spatialGeneration) return stageResult;
        const result = spatialGeneration;
        const field = result.mechanicsLevelViews.at(-1).mechanicsFieldView;
        const options = { device, residentProductMass: history,
          sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
          schroederLevelAssignment: next.schroederSpatialSuccessorLevelAssignment,
          schroederSpatialEpochGeneration: result, sourceFamilyConsumerLease: lease,
          authenticateParticleProductSource: true, epochIdentity: family.successorEpochIdentity,
          caloricAuthority, caloricThermalMaterialTable: args.thermalMaterialTable,
          spatialGasGrid: { gridDims: field.gridDims, gridNodeCount: field.gridNodeCount,
            gridShift: field.gridShift, gridSpacingM: field.gridSpacingM, selectedLevel: field.selectedLevel },
          level: field.selectedLevel, boxMinM: [0, 0, 0], boxMaxM: [2, 2, 2],
          diagnosticsMode: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE };
        try {
          await runSphSpatialGasLedgerEosRetainedWebGpu({ ...options, residentProductMass: { ...history } });
          checks.clonedHistoryRejected = false;
        } catch { checks.clonedHistoryRejected = true; }
        const create = device.createBuffer, bind = device.createBindGroup;
        const captures = {}, volumeCaptures = new Map();
        let eos;
        device.createBuffer = function (descriptor) {
          const buffer = create.call(this, descriptor);
          if (descriptor.label === 'ulg-exact-history-p2g-views') captures.views = buffer;
          if (descriptor.label === 'ulg-exact-history-p2g-validation') captures.validation = buffer;
          if (descriptor.label === 'ulg-vapor-aerosol-exchange-candidate-state') captures.exchangeState = buffer;
          if (descriptor.label?.includes('-gas-free-volume-arena-')
            && /-(control|rows)$/.test(descriptor.label)) volumeCaptures.set(descriptor.label, buffer);
          return buffer;
        };
        // The earlier current-gas exchange may have warmed these arenas.
        // Observe the actual bindings as well as fresh allocations, so reused
        // storage is checked without replacing the real volume execution.
        device.createBindGroup = function (descriptor) {
          for (const entry of descriptor.entries) {
            const buffer = entry.resource?.buffer, label = buffer?.label;
            if (label?.includes('-gas-free-volume-arena-') && /-(control|rows)$/.test(label)) {
              volumeCaptures.set(label, buffer);
            }
          }
          return bind.call(this, descriptor);
        };
        try {
          eos = await runSphSpatialGasLedgerEosRetainedWebGpu(options);
          evidence.status = eos.status; evidence.reason = eos.reason;
          if (!eos.ready || !eos.oracleDiagnostics) throw new Error(JSON.stringify(evidence));
          const projected = await read(captures.views), validation = await read(captures.validation);
          evidence.projection = inspectExactHistoryP2gProjection({ source: before, layout, count,
            projected, validation, gasViews: true });
          checks.projection = evidence.projection.matches;
          const oracle = eos.oracleDiagnostics, views = new Float32Array(projected.buffer);
          evidence.rows = oracle.compactRows; evidence.pressure = oracle.pressureCells;
          evidence.caloric = oracle.caloricCells;
          checks.caloric = oracle.mixtureCaloricClosureAdmitted === true
            && oracle.caloricCells.reduce((sum, cell) => sum + cell.memberCount, 0) === count[3] - expectedCondensedRows
            && oracle.caloricCells.every(cell => cell.ready
              && (exchangedAerosol || Math.abs(cell.equilibriumTemperatureK - 300) < .001));
          if (exchangedAerosol) {
            // Independent constant-Cv mixture closure, retaining each product's
            // own reference energy and heat capacity. The exchange changes T;
            // it does not turn the other reaction products into water.
            const models = new Map(Object.entries(args.condensableThermodynamicsByMaterial)
              .map(([name, model]) => [stableOpticalMaterialId(name), model]));
            evidence.exchangedCaloric = oracle.pressureCells.map(cell => {
              const rows = oracle.compactRows.filter(row => row.positionM.every((p, i) =>
                Math.floor(p / field.gridSpacingM) === cell.gridIndex[i]));
              let centeredEnergy = 0, heatCapacity = 0, moles = 0, expectedPV = 0;
              for (const row of rows) {
                const model = models.get(row.materialId);
                if (!model) throw new Error('Missing independent gas caloric reference');
                centeredEnergy += row.massKg * (row.sourceSpecificInternalEnergyJPerKg
                  - model.vaporReferenceInternalEnergyJPerKg - model.vaporCvJPerKgK * (300 - model.referenceTemperatureK));
                heatCapacity += row.massKg * model.vaporCvJPerKgK;
                moles += row.moles;
                expectedPV += row.moles * 8.314462618 * row.temperatureK;
              }
              const expectedTemperatureK = 300 + centeredEnergy / heatCapacity;
              const caloric = oracle.caloricCells.find(row => row.cellIndex === cell.index);
              // Equilibrium T is a caloric diagnostic, not a thermalization
              // operation. Actual pressure retains every species' own T.
              const equilibratedPV = moles * 8.314462618 * expectedTemperatureK;
              return { memberCount: rows.length, expectedTemperatureK, expectedPV, equilibratedPV, centeredEnergy, heatCapacity,
                matches: rows.length > 0 && caloric.memberCount === rows.length
                  && Math.abs(caloric.equilibriumTemperatureK - expectedTemperatureK) < .001
                  && Math.abs(caloric.heatCapacityJPerK - heatCapacity) <= heatCapacity * 2e-6
                  && Math.abs(cell.pressurePa * cell.volumeM3 - expectedPV) <= expectedPV * 2e-6 };
            });
            checks.exchangedCaloric = evidence.exchangedCaloric.length > 0
              && evidence.exchangedCaloric.every(cell => cell.matches);
          }
          checks.originalCount = eos.productEventStrideFloats === layout.rowWords
            && eos.productEventRowCount === descriptor.rowCapacity;
          checks.paired = eos.particleProductSourcePaired === true && oracle.particleProductSourcePaired === true;
          checks.allGasRows = oracle.compactRows.length === count[3] - expectedCondensedRows
            && count[3] === 3 && oracle.compactRows.length > 0;
          checks.exactResiduals = oracle.compactRows.every(row => {
            const at = row.sourceRowIndex * 32;
            return row.sourceKind === 'product-event' && row.massKg === views[at + 13]
              && row.moles === views[at + 9] && row.supportVolumeM3 === views[at + 23]
              && row.sourceSpecificInternalEnergyJPerKg === views[at + 19];
          });
          const nT = oracle.compactRows.reduce((sum, row) => sum + row.moles * row.temperatureK, 0);
          const pV = oracle.pressureCells.reduce((sum, cell) => sum + cell.pressurePa * cell.volumeM3, 0);
          evidence.pressureClosure = { nRT: nT * 8.314462618, pV };
          checks.pressure = pV > 0 && Math.abs(pV - nT * 8.314462618) <= nT * 8.314462618 * 2e-6;
          checks.control = oracle.controlErrorFlags === 0;
          evidence.freeVolume = await inspectExactHistoryGasVolume({ result, captures: volumeCaptures,
            read, pressureCells: oracle.pressureCells, views, count, descriptor, expectedCondensedRows,
            aerosolRead, aerosolWords });
          checks.freeVolume = evidence.freeVolume.pass;
          if (args.initialAerosol?.exchange && !exchangedAerosol) {
            const surfaceModels = { h2o: { schema: 'peercompute.ulg.linear-pure-interface.v1',
              provenance: 'manufactured exact exchange surface', interceptNPerM: .2, slopeNPerMK: -.0002,
              minTemperatureK: 200, maxTemperatureK: 500 } };
            const material = resolveSphSpatialGasExchangeMaterials(caloricAuthority,
              { thermalMaterialTable: args.thermalMaterialTable, surfaceModels });
            const edge = { gasKind: 1, gasIndex: 0, parcelIndex: 0, materialRow: material.materials.indexOf('h2o'),
              deltaMassKg: args.initialAerosol.exchange === 'evaporation' ? -(2 ** -90) : 2 ** -90,
              transportEnthalpyCorrectionJ: 2 ** -72, conductiveHeatJ: 2 ** -70, pressureWorkIntoLiquidJ: -(2 ** -74) };
            const surfaceTransfer = args.initialAerosol.exchange === 'surface-evaporation';
            const expectRejected = args.initialAerosol.exchange === 'overdraw';
            if (surfaceTransfer) Object.assign(edge, { deltaMassKg: -(2 ** -16), transportEnthalpyCorrectionJ: 0,
              conductiveHeatJ: -28.5, pressureWorkIntoLiquidJ: -.1 });
            if (expectRejected) Object.assign(edge, { deltaMassKg: 1, transportEnthalpyCorrectionJ: 0,
              conductiveHeatJ: 0, pressureWorkIntoLiquidJ: 0 });
            const sources = [next.sphParticleUpload.stateBuffer, next.sphParticleUpload.thermoBuffer,
              next.mlsMpmParticleUpload.mechanicsBuffer, aerosolRead.buffer, aerosolRead.exactQuantities.quantityBuffer];
            const sourceWords = await Promise.all(sources.map(read));
            let candidate;
            try {
              candidate = await runSphSpatialVaporAerosolExchangeCandidate(eos, { surfaceModels, edges: [edge] });
              evidence.exchange = { ready: candidate.ready, receipt: candidate.receipt };
              try { assertSphLegacyMassPathAllowed({ stateBuffer: captures.exchangeState }, 'exchange native oracle'); checks.exchangeLegacyReuseRejected = false; }
              catch { checks.exchangeLegacyReuseRejected = Boolean(captures.exchangeState); }
              if (expectRejected) {
                checks.exchangeOverdrawRejected = !candidate.ready && (candidate.receipt.errorBits & 4096) !== 0;
              } else {
              if (!candidate.ready) throw new Error(`Exact exchange rejected: ${JSON.stringify(evidence.exchange)}`);
              const observed = await observeSphSpatialVaporAerosolExchangeCandidate(candidate);
              const q = layout.quantityOffsetWords;
              evidence.exchange.oracle = inspectExactVaporAerosolPair({ gasWords: before.slice(q, q + layout.quantityWords),
                liquidWords: args.initialAerosol.words, outputWords: observed.exactPairWords,
                layout: aerosolRead.exactQuantities.quantityLayout, format: aerosolRead.exactQuantities.format,
                edge, surfaceValues: observed.surfaceValues });
              checks.exactExchange = evidence.exchange.oracle.pass;
              if (surfaceTransfer) checks.exchangeSurfaceChange = observed.surfaceValues[3] !== observed.surfaceValues[1]
                && observed.parcelWords[3] !== aerosolWords[3] && observed.productEventValues[13] > views[13];
              else checks.exchangeBelowFloatMassIncrement = observed.productEventValues[13] === views[13]
                && observed.parcelWords[3] === aerosolWords[3];
              checks.exchangeNotPublished = candidate.outerPublicationAdmitted === false && candidate.kineticAuthorization === false;
              checks.exchangeNoForgedCount = observed.productCountWords === null && candidate.receipt.productCountIssued === false;
              try { await observeSphSpatialVaporAerosolExchangeCandidate({ ...candidate }); checks.exchangeCloneRejected = false; }
              catch { checks.exchangeCloneRejected = true; }
              }
            } finally { if (candidate?.ready) checks.exchangeRetired = await releaseSphSpatialVaporAerosolExchangeCandidate(candidate) === true; }
            const after = await Promise.all(sources.map(read));
            checks.exchangeSourceUnchanged = after.every((words, i) => words.length === sourceWords[i].length
              && words.every((word, j) => word === sourceWords[i][j]));
          }
        } finally {
          device.createBuffer = create;
          device.createBindGroup = bind;
          if (eos?.ready) checks.retired = await retire(eos);
          else await eos?.cleanupPromise;
        }
        checks.successBorrowsReleased = history.__ulgActiveBorrowCount === initialBorrowCount;
        // Fault the real exact molar identity; the original count stays live.
        // Projection failure must reject the entire original gas calculation.
        const molarOffset = layout.quantityOffsetWords + 4;
        device.queue.writeBuffer(history.productEventBuffer, molarOffset * 4, new Uint32Array([0]));
        try {
          const rejected = await runSphSpatialGasLedgerEosRetainedWebGpu(options);
          evidence.invalidProjection = { ready: rejected.ready, status: rejected.status, reason: rejected.reason };
          checks.invalidProjectionRejected = rejected.ready === false;
          if (rejected.ready) await retire(rejected);
          else checks.failureCleanupConfirmed = await rejected.cleanupPromise === true;
          checks.failureBorrowsReleased = history.__ulgActiveBorrowCount === initialBorrowCount;
        } finally {
          await device.queue.onSubmittedWorkDone();
          device.queue.writeBuffer(history.productEventBuffer, molarOffset * 4, before.slice(molarOffset, molarOffset + 1));
        }
        if (expectedCondensedRows > 0) {
          // Keep the genuine history internally consistent but move its liquid
          // outside the admitted grid. Gas classification still succeeds; the
          // original free-volume calculation must reject the entire EOS.
          const sourceFloats = new Float32Array(before.buffer);
          const row = Array.from({ length: count[3] }, (_, i) => i)
            .find(i => sourceFloats[i * layout.rowWords + 11] === 2);
          if (row === undefined) throw new Error('Expected original liquid history');
          const offsets = [row * layout.rowWords, row * layout.rowWords + layout.physicalOffsetWords];
          for (const offset of offsets) device.queue.writeBuffer(history.productEventBuffer, offset * 4, new Float32Array([10]));
          try {
            const rejected = await runSphSpatialGasLedgerEosRetainedWebGpu(options);
            evidence.invalidVolume = { ready: rejected.ready, status: rejected.status, reason: rejected.reason };
            checks.invalidVolumeRejected = rejected.ready === false;
            if (rejected.ready) await retire(rejected);
            else checks.volumeFailureCleanupConfirmed = await rejected.cleanupPromise === true;
            checks.volumeFailureBorrowsReleased = history.__ulgActiveBorrowCount === initialBorrowCount;
          } finally {
            await device.queue.onSubmittedWorkDone();
            for (const offset of offsets) device.queue.writeBuffer(history.productEventBuffer, offset * 4, before.slice(offset, offset + 1));
          }
        }
        const after = await read(history.productEventBuffer);
        checks.sourceUnchanged = before.length === after.length && before.every((word, i) => word === after[i]);
        throw stop;
      } } });
    throw new Error('Gas inspection missed the original SS generation');
  } catch (error) { if (error !== stop) throw error; }
  finally {
    if (aerosolRead) releaseSphAerosolParcelRead(aerosolRead);
    spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });
  }
  return { ...evidence, checks, pass: Object.values(checks).every(Boolean) };
}
