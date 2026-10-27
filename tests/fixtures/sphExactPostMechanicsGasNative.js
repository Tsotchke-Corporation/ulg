import * as closureSources from '../../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import { runSphPostMechanicsGasStateWebGpu, releaseSphPostMechanicsGasStateAfterQueue } from '../../src/runtime/sph/sphPostMechanicsGasStateGpu.js';
import { createSphSpatialGasCaloricAuthority, resolveSphSpatialGasExchangeMaterials } from '../../src/runtime/sph/sphSpatialGasCaloricAdmission.js';
import { runSphSpatialVaporAerosolExchangeCandidate, observeSphSpatialVaporAerosolExchangeCandidate,
  releaseSphSpatialVaporAerosolExchangeCandidate,
  SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE } from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import { acquireSphAerosolParcelRead, releaseSphAerosolParcelRead } from '../../src/runtime/sph/sphAerosolParcelGpu.js';
import { inspectExactVaporAerosolPair } from './sphExactPlacementQuantityInspection.js';
import { inspectExactVaporProducerNative } from './sphExactVaporProducerNative.js';

export async function inspectExactPostMechanicsGasNative({ device, closure, thermalMaterialTable,
  models, initialAerosol, mode, read }) {
  const checks = {}, evidence = {};
  if (mode === 'read') {
    const parent = closureSources.acquireMlsMpmPostMechanicsGasSourceRead(closure, { device });
    let first, second, retirement;
    try {
      first = closureSources.acquireMlsMpmPostMechanicsExactGasRead(parent, { device });
      const value = closureSources.resolveMlsMpmPostMechanicsExactGasRead(first, { device });
      checks.originalCurrentTuple = value.sourceSphUpload.stateBuffer === closure.continuation.stateBuffer
        && value.sourceSphUpload.thermoBuffer === closure.continuation.thermoBuffer
        && value.sourceMlsUpload.mechanicsBuffer === closure.continuation.mechanicsBuffer;
      const before = await read(value.quantities.quantityBuffer);
      try { closureSources.resolveMlsMpmPostMechanicsExactGasRead({ ...first }, { device }); checks.copiedReadRejected = false; }
      catch { checks.copiedReadRejected = true; }
      second = closureSources.forkMlsMpmPostMechanicsExactGasRead(first, { device });
      closureSources.releaseMlsMpmPostMechanicsExactGasRead(first); first = null;
      let settled = false;
      retirement = closureSources.releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(parent, { device }).then(v => { settled = true; return v; });
      await device.queue.onSubmittedWorkDone(); await Promise.resolve();
      checks.parentWaitsForFork = !settled;
      const retained = closureSources.resolveMlsMpmPostMechanicsExactGasRead(second, { device });
      const after = await read(retained.quantities.quantityBuffer);
      checks.quantitiesSurviveLogicalParentRelease = after.every((word, i) => word === before[i]);
      try { closureSources.releaseMlsMpmPostMechanicsExactMassCapture(closure); checks.capturePinned = false; }
      catch { checks.capturePinned = true; }
      closureSources.releaseMlsMpmPostMechanicsExactGasRead(second); second = null;
      checks.parentRetiresAfterFork = await retirement === true;
    } finally {
      if (first) closureSources.releaseMlsMpmPostMechanicsExactGasRead(first);
      if (second) closureSources.releaseMlsMpmPostMechanicsExactGasRead(second);
      await (retirement ?? closureSources.releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(parent, { device }));
    }
  } else {
    const caloricAuthority = createSphSpatialGasCaloricAuthority({ thermalMaterialTable,
      condensableThermodynamicsByMaterial: models });
    let current, aerosolRead, candidate;
    try {
      current = await runSphPostMechanicsGasStateWebGpu({ device, closure, caloricAuthority,
        caloricThermalMaterialTable: thermalMaterialTable, diagnosticsMode: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE });
      checks.originalCurrentSource = current.ready && current.sourceStage === 'post-mechanics-closure'
        && current.completeHistory === closure.continuation.residentProductMass;
      checks.newSpatialGeneration = current.spatialGeneration !== current.sourceGeneration;
      try { closureSources.releaseMlsMpmPostMechanicsExactMassCapture(closure); checks.capturePinned = false; }
      catch { checks.capturePinned = true; }
      aerosolRead = acquireSphAerosolParcelRead({ device, family: initialAerosol.family, expectedGeneration: 0 });
      const history = current.completeHistory, layout = history.exactProductHistoryLayout;
      const before = await read(history.productEventBuffer), liquid = await read(aerosolRead.exactQuantities.quantityBuffer);
      const surfaceModels = { h2o: { schema: 'peercompute.ulg.linear-pure-interface.v1',
        provenance: 'manufactured current exact exchange', interceptNPerM: .2, slopeNPerMK: -.0002,
        minTemperatureK: 200, maxTemperatureK: 500 } };
      const material = resolveSphSpatialGasExchangeMaterials(caloricAuthority, { thermalMaterialTable, surfaceModels });
      const evaporation = mode === 'surface-evaporation';
      const edge = { gasKind: 1, gasIndex: 0, parcelIndex: 0, materialRow: material.materials.indexOf('h2o'),
        deltaMassKg: evaporation ? -(2 ** -16) : 2 ** -90,
        transportEnthalpyCorrectionJ: evaporation ? 0 : 2 ** -72,
        conductiveHeatJ: evaporation ? -28.5 : 2 ** -70,
        pressureWorkIntoLiquidJ: evaporation ? -.1 : -(2 ** -74) };
      candidate = await runSphSpatialVaporAerosolExchangeCandidate(current.gasEos, { surfaceModels, edges: [edge] });
      evidence.receipt = candidate.receipt;
      if (!candidate.ready) throw new Error(`Current exact exchange rejected: ${JSON.stringify(evidence)}`);
      const observed = await observeSphSpatialVaporAerosolExchangeCandidate(candidate);
      evidence.oracle = inspectExactVaporAerosolPair({ gasWords: before.slice(layout.quantityOffsetWords,
        layout.quantityOffsetWords + layout.quantityWords), liquidWords: liquid,
        outputWords: observed.exactPairWords, layout: aerosolRead.exactQuantities.quantityLayout,
        format: aerosolRead.exactQuantities.format, edge, surfaceValues: observed.surfaceValues });
      checks.currentExactExchange = evidence.oracle.pass;
      const quantityWords = aerosolRead.exactQuantities.quantityLayout.recordWords;
      checks.fullAerosolQuantities = observed.exactAerosolWords.length === liquid.length
        && observed.exactAerosolWords.every((word, i) => word === (i < quantityWords
          ? observed.exactPairWords[quantityWords + i] : liquid[i]));
      checks.fullParticleQuantityCapacity = observed.exactParticleWords.length === current.particleCount * quantityWords;
      const updatedHistory = observed.exactHistoryWords;
      checks.historyQuantities = updatedHistory.slice(layout.quantityOffsetWords,
        layout.quantityOffsetWords + quantityWords).every((word, i) => word === observed.exactPairWords[i]);
      checks.historyResidualMass = updatedHistory.slice(layout.residualMassOffsetWords,
        layout.residualMassOffsetWords + layout.massWordCount).every((word, i) => word === observed.exactPairWords[16 + i]);
      const changed = new Set([13, 16, 19, 20, 21, 22, 23, 27,
        ...[3, 4, 5, 6, 7].map(i => layout.stateOffsetWords + i),
        ...[2, 9, 11].map(i => layout.thermoOffsetWords + i),
        ...[19, 25, 31].map(i => layout.mechanicsOffsetWords + i)]);
      for (let i = 0; i < quantityWords; i++) changed.add(layout.quantityOffsetWords + i);
      for (let i = 0; i < layout.massWordCount; i++) changed.add(layout.residualMassOffsetWords + i);
      checks.historyBirthLineageAndOtherRowsUnchanged = updatedHistory.length === before.length
        && updatedHistory.every((word, i) => changed.has(i) || word === before[i]);
      const eventWords = new Uint32Array(observed.productEventValues.buffer);
      checks.historyCurrentPhysicalViews = updatedHistory[layout.stateOffsetWords + 3] === eventWords[13]
        && updatedHistory[layout.stateOffsetWords + 7] === eventWords[19]
        && updatedHistory[layout.thermoOffsetWords + 2] === eventWords[16]
        && [0, 1, 2].every(axis => updatedHistory[layout.stateOffsetWords + 4 + axis] === eventWords[20 + axis]);
      if (evaporation) {
        const originalValues = new Float32Array(before.buffer), currentValues = new Float32Array(updatedHistory.buffer);
        checks.evaporationChangesPhysicalState = currentValues[layout.stateOffsetWords + 3] > originalValues[layout.stateOffsetWords + 3]
          && updatedHistory[layout.stateOffsetWords + 7] !== before[layout.stateOffsetWords + 7];
        checks.birthProductionIsNotCurrentInventory = currentValues[13] > currentValues[3]
          && updatedHistory[3] === before[3] && updatedHistory[9] === before[9]
          && observed.productEventValues[9] > currentValues[9];
        checks.surfaceEnergyChanged = observed.surfaceValues[3] !== observed.surfaceValues[1];
      }
      checks.noPrematurePublication = candidate.outerPublicationAdmitted === false && candidate.kineticAuthorization === false;
      const after = await read(history.productEventBuffer), liquidAfter = await read(aerosolRead.exactQuantities.quantityBuffer);
      checks.sourcesUnchanged = after.every((word, i) => word === before[i]) && liquidAfter.every((word, i) => word === liquid[i]);
      evidence.producer = await inspectExactVaporProducerNative({ device, closure, current, candidate, observed, read });
      checks.originalProducerConsumers = evidence.producer.pass;
    } finally {
      if (candidate?.ready) checks.candidateRetired = await releaseSphSpatialVaporAerosolExchangeCandidate(candidate) === true;
      if (aerosolRead) releaseSphAerosolParcelRead(aerosolRead);
      if (current) checks.currentRetired = await releaseSphPostMechanicsGasStateAfterQueue(current, { device }) === true;
    }
  }
  const result = { ...evidence, checks, pass: Object.values(checks).every(Boolean) };
  if (!result.pass) throw new Error(`Current exact gas verification failed: ${JSON.stringify(result)}`);
  return result;
}
