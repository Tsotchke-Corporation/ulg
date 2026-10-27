import { acquireSphExactMassRead, releaseSphExactMassRead } from '../../src/runtime/sph/sphExactMassInventoryGpu.js';
import { acquireSphAerosolParcelRead, releaseSphAerosolParcelRead } from '../../src/runtime/sph/sphAerosolParcelGpu.js';

// Fault the original step, observe its original cleanup, then let the caller
// retry from the same untouched initial owners. No output owner is synthesized.
export async function createExactVaporRejectionInspection({ device, mode, request,
  sphParticleUpload, mlsMpmParticleUpload, initialAerosol, read }) {
  if (!['overdraw', 'gross-overdraw', 'cross-cell', 'missing-gas-work', 'rate-domain', 'midpoint-domain', 'refresh-failure'].includes(mode)) throw new Error('Unknown exchange rejection fixture');
  const sourceMass = sphParticleUpload.exactMassInventory;
  const snapshot = async () => {
    const mass = acquireSphExactMassRead({ device, family: sourceMass });
    const aerosol = acquireSphAerosolParcelRead({ device, family: initialAerosol.family, expectedGeneration: 0 });
    try {
      return await Promise.all([sphParticleUpload.stateBuffer, sphParticleUpload.thermoBuffer,
        mlsMpmParticleUpload.mechanicsBuffer, sphParticleUpload.identityBuffer,
        mass.buffer, aerosol.buffer, aerosol.exactQuantities.quantityBuffer].map(read));
    } finally { await releaseSphExactMassRead(mass); releaseSphAerosolParcelRead(aerosol); }
  };
  const before = await snapshot(), edge = request.edges[0], originalEdges = request.edges.map(edge => ({ ...edge }));
  const originalAffinity = request.rateModels?.h2o.maxAbsAffinityJPerKgK;
  const originalTemperatureJump = request.rateModels?.h2o.maxTemperatureDifferenceK;
  const fault = new Error('Injected observer failure after genuine vapor mechanics refresh');
  const allocations = [], create = device.createBuffer;
  let candidateReceipt, refreshObserved = false, closureReturned = false, armed = true;
  device.createBuffer = function (descriptor) {
    const buffer = create.call(this, descriptor);
    if (/^ulg-(vapor-aerosol-exchange-|aerosol-vapor-successor|exact-mass-vapor-successor|vapor-closure-)/.test(descriptor.label ?? '')) {
      const record = { label: descriptor.label, destroyed: false }, destroy = buffer.destroy;
      allocations.push(record);
      buffer.destroy = function () { record.destroyed = true; return destroy.call(this); };
    }
    return buffer;
  };
  if (mode === 'overdraw') Object.assign(edge, { deltaMassKg: 1, conductiveHeatJ: 0, pressureWorkIntoLiquidJ: 0 });
  if (mode === 'gross-overdraw') {
    // Exact zero net mass would conceal two impossible gross donor debits.
    // All initial masses remain positive; no finite interval can spend these.
    request.edges.splice(0, request.edges.length, ...[-.25, .25].map(deltaMassKg => ({ ...edge,
      deltaMassKg, transportEnthalpyCorrectionJ: 0, conductiveHeatJ: 0, pressureWorkIntoLiquidJ: 0 })));
  }
  if (mode === 'cross-cell') edge.parcelIndex = 1;
  if (mode === 'missing-gas-work') request.edges.splice(0, request.edges.length, ...request.edges.filter(e => e.gasIndex !== 2));
  if (mode === 'rate-domain') request.rateModels.h2o.maxAbsAffinityJPerKgK = .001;
  if (mode === 'midpoint-domain') request.rateModels.h2o.maxTemperatureDifferenceK = .2;
  const restore = () => {
    device.createBuffer = create;
    Object.assign(edge, originalEdges[0]);
    request.edges.splice(0, request.edges.length, ...originalEdges);
    if (mode === 'rate-domain') request.rateModels.h2o.maxAbsAffinityJPerKgK = originalAffinity;
    if (mode === 'midpoint-domain') request.rateModels.h2o.maxTemperatureDifferenceK = originalTemperatureJump;
    armed = false;
  };
  return {
    inspectStage(stage, result) {
      if (!armed) return false;
      if (stage.startsWith('vaporExchange')) console.log('exact-routing-progress', JSON.stringify({
        phase: 'exchange-rejection-stage', mode, stage, ready: result.ready, receipt: result.receipt }));
      if (stage === 'postMechanicsClosure') closureReturned = true;
      if (stage === 'vaporExchangeCandidate' && mode !== 'refresh-failure') {
        candidateReceipt = result.receipt;
        return !result.ready; // Return the real rejected result to production.
      }
      if (stage === 'vaporExchangeMechanicsRefresh' && mode === 'refresh-failure') {
        refreshObserved = true;
        throw fault;
      }
      return false;
    },
    async finish(error) {
      try {
        console.log('exact-routing-progress', JSON.stringify({ phase: 'exchange-rejection-caught', mode,
          message: error.message, cleanup: error.postMechanicsCleanupReceipt }));
        const cleanup = await error.postMechanicsCleanupCompletion;
        console.log('exact-routing-progress', JSON.stringify({ phase: 'exchange-rejection-cleanup', mode, cleanup }));
        const mechanicsRetired = await error.exactMassG2pRetirement;
        console.log('exact-routing-progress', JSON.stringify({ phase: 'exchange-rejection-mechanics-retired', mode, mechanicsRetired }));
        await device.queue.onSubmittedWorkDone();
        console.log('exact-routing-progress', JSON.stringify({ phase: 'exchange-rejection-queue-drained', mode }));
        const after = await snapshot();
        console.log('exact-routing-progress', JSON.stringify({ phase: 'exchange-rejection-input-observed', mode }));
        const checks = {
          expectedFailure: mode !== 'refresh-failure'
            ? error.vaporExchangeReceipt === candidateReceipt && (candidateReceipt?.errorBits
              & (['rate-domain', 'midpoint-domain'].includes(mode) ? 2048 : ['cross-cell', 'missing-gas-work'].includes(mode) ? 512 : 4096)) !== 0
            : error === fault && refreshObserved,
          noClosurePublished: !closureReturned,
          originalMechanicsRetired: mechanicsRetired === true,
          originalCleanupConfirmed: cleanup?.status === 'post-mechanics-failure-cleanup-complete'
            && cleanup.blockers.length === 0,
          originalOwnersPreserved: sphParticleUpload.exactMassInventory === sourceMass
            && sphParticleUpload.aerosolFamily === initialAerosol.family,
          originalInventoriesUnchanged: before.every((words, i) => words.length === after[i].length
            && words.every((word, j) => word === after[i][j])),
          exchangeAllocationsRetired: allocations.length > 0 && allocations.every(row => row.destroyed)
        };
        if (mode === 'refresh-failure') checks.originalOutputConsumersReached = allocations.some(row => row.label === 'ulg-exact-mass-vapor-successor')
          && allocations.some(row => row.label === 'ulg-aerosol-vapor-successor')
          && allocations.some(row => row.label === 'ulg-aerosol-vapor-successor-quantities');
        const result = { mode, checks, allocations, cleanup, pass: Object.values(checks).every(Boolean) };
        if (!result.pass) throw new Error(`Coupled exchange rejection failed: ${JSON.stringify(result)}`);
        return result;
      } finally { restore(); }
    },
    restore
  };
}
