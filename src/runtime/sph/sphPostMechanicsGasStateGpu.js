import * as closureSources from './sphMlsMpmPostMechanicsClosure.js';
import {
  runSchroederLevelAssignmentWebGpu,
  resolveSchroederParticleBufferFamilyGeneration,
  SCHROEDER_NO_FULL_READBACK_MODE
} from './schroederHierarchyGpu.js';
import {
  runSchroederSpatialEpochGenerationWithBackpressureWebGpu,
  validateSchroederSpatialEpochGenerationLevelAssignment,
  releaseSchroederSpatialEpochGenerationAfterQueue,
  quarantineSchroederSpatialEpochGenerationAfterDeviceLoss,
  isUnsubmittedSchroederSpatialEpochGeneration
} from './schroederSpatialEpochGpu.js';
import { forkSphAerosolParcelRead } from './sphAerosolParcelGpu.js';
import {
  captureSphAerosolPostMechanicsGasGeneration,
  releaseSphAerosolPostMechanicsGasGeneration
} from './sphAerosolSpatialBinding.js';

const SOURCES = new WeakMap();
const RESULTS = new WeakMap();
const EPOCH_FIELDS = ['storageGeneration', 'physicsTick', 'physicsSubstep',
  'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'];

function liveRecord(source, device, { allowRetiring = false } = {}) {
  const record = SOURCES.get(source);
  if (!record || record.device !== device || record.released || record.geometryReleased
      || (!allowRetiring && record.retiring)) {
    throw new TypeError('Current gas state requires its exact live private source');
  }
  const packet = closureSources.resolveMlsMpmPostMechanicsGasSourceRead(record.read, { device });
  for (const field of ['stateBuffer', 'thermoBuffer', 'mechanicsBuffer', 'residentProductMass',
    'identityBuffer', 'particleCount', 'sourceTransaction', 'sourceGeneration', 'aerosolFamily']) {
    if (packet[field] !== record.packet[field]) {
      throw new TypeError('Current gas state lost its completed-stage source tuple');
    }
  }
  if (!validateSchroederSpatialEpochGenerationLevelAssignment(record.generation, {
    device, levelAssignment: record.assignment,
    sphParticleUpload: record.packet.sphParticleUpload,
    mlsMpmParticleUpload: record.packet.mlsMpmParticleUpload
  })) throw new TypeError('Current gas state lost its freshly classified spatial generation');
  return record;
}

/** Used by the aerosol binding, not a public tuple-to-authority factory. Only
 * this module's real classifier/build chain can issue a source capability. */
export function resolveSphPostMechanicsGasSpatialSource(source, { device, generation } = {}) {
  const record = liveRecord(source, device, { allowRetiring: true });
  if (record.generation !== generation) throw new TypeError('Unmatched current gas spatial generation');
  return record.packet;
}

export function canReleaseSphPostMechanicsGasSpatialBinding(source, generation) {
  const record = SOURCES.get(source);
  return Boolean(record && record.generation === generation && record.geometryReleased);
}

/** The EOS owns a child hold; the parent keeps the genuine closure read until
 * ALL children and the new geometry have completed their last queue fences. */
export function retainSphPostMechanicsGasSourcePair(source, { device, generation, levelAssignment,
  sphParticleUpload, mlsMpmParticleUpload, residentProductMass, particleCount, epochIdentity } = {}) {
  const record = liveRecord(source, device);
  const packet = record.packet;
  if (record.generation !== generation || record.assignment !== levelAssignment
      || sphParticleUpload !== packet.sphParticleUpload
      || mlsMpmParticleUpload !== packet.mlsMpmParticleUpload
      || residentProductMass !== packet.residentProductMass || particleCount !== packet.particleCount
      || EPOCH_FIELDS.some((key) => epochIdentity?.[key] !== packet.epochIdentity[key])) {
    throw new TypeError('Current gas mixture cannot replace or truncate its exact completed source');
  }
  record.children += 1;
  let released = false;
  const validate = () => {
    if (released) throw new TypeError('Current gas source pair has been released');
    liveRecord(source, device, { allowRetiring: true });
  };
  return {
    sphParticleUpload, mlsMpmParticleUpload, residentProductMass,
    sourceClosure: record.closure,
    sourcePacket: packet,
    read: Object.freeze({ particleCount, sourceFamily: null, sourceStage: 'post-mechanics-closure' }),
    validate,
    acquireAerosolRead() {
      validate();
      return packet.aerosolRead == null ? null : forkSphAerosolParcelRead(packet.aerosolRead, {
        device, family: packet.aerosolFamily, expectedGeneration: packet.aerosolRead.generation
      });
    },
    acquireExactQuantityRead() {
      validate();
      return closureSources.acquireMlsMpmPostMechanicsExactGasRead(record.read, { device });
    },
    release() {
      if (released) return false;
      released = true;
      record.children -= 1;
      if (record.children === 0) record.resolveChildDrain?.();
      return true;
    },
    isReleased: () => released,
    // No old outer-step fence proves completion of these new submissions.
    canReleaseQueueOrdered: () => false
  };
}

async function retire(record) {
  if (record.released) return true;
  record.retiring = true;
  try {
    if (!record.deviceLost && ((record.eosBuildAttempted && !record.eos)
        || (record.generationBuildAttempted && !record.generation))) return false;
    if (!record.deviceLost && record.eos?.ready) {
      const scheduled = record.eosModule.releaseSphSpatialGasLedgerEosAfterQueue(record.eos);
      if (scheduled !== true && !record.eos.releasePromise) return false;
      if (await record.eos.releasePromise !== true) return false;
    } else if (!record.deviceLost && record.eos?.cleanupPromise) {
      if (await record.eos.cleanupPromise !== true) return false;
    }
    if (record.children !== 0) {
      if (!record.deviceLost) return false;
      await new Promise((resolve) => { record.resolveChildDrain = resolve; });
    }
    if (record.deviceLost && record.generation
        && !isUnsubmittedSchroederSpatialEpochGeneration(record.generation, record.device)) {
      const retired = await quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(record.generation, record.device);
      if (retired !== true) return false;
    } else if (record.generation?.ready) {
      const scheduled = releaseSchroederSpatialEpochGenerationAfterQueue(record.generation, record.device);
      if (scheduled !== true && !record.generation.releasePromise) return false;
      if (await record.generation.releasePromise !== true) return false;
    } else if (record.generation?.releasePromise) {
      // Rejected post-submit SS builds return this actual owner promise, not
      // the cleanupPromise used by rejected EOS executions.
      if (await record.generation.releasePromise !== true) return false;
    } else if (record.generation?.postSubmitCleanupError || record.generation?.releaseScheduled) {
      return false;
    }
    // Covers classifier submission too if generation construction was rejected.
    // A rejected/missing fence is not completion and retains every source hold.
    if (!record.deviceLost) {
      const fence = record.device.queue.onSubmittedWorkDone();
      if (typeof fence?.then !== 'function') return false;
      await fence;
    }
    record.geometryReleased = true;
    if (record.assignment && !record.assignmentDestroyed) {
      record.assignmentBuffer.destroy();
      record.assignmentDestroyed = true;
    }
    if (record.bound) {
      releaseSphAerosolPostMechanicsGasGeneration(record.source, record.generation);
      record.bound = false;
    }
    if (await closureSources.releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(
      record.read, { device: record.device }) !== true) return false;
    record.released = true;
    record.lossCell.record = null;
    return true;
  } catch (error) {
    record.releaseError = error;
    return false;
  }
}

function startRetirement(record) {
  if (record.released) return Promise.resolve(true);
  if (record.releasePromise) return record.releasePromise;
  const startedAfterLoss = record.deviceLost;
  record.releasePromise = retire(record).then(async (released) => {
    // A loss notification may arrive while a normal queue-fence attempt is
    // pending. Fold in one actual loss retirement; blocked loss attempts stay
    // explicitly retryable rather than caching a false result forever.
    if (!released && !startedAfterLoss && record.deviceLost) released = await retire(record);
    if (!released) record.releasePromise = null;
    return released;
  });
  return record.releasePromise;
}

/** Build a private CURRENT-state gas view, not a public successor. No copied
 * assignment rows, pre-P2G occupancy or intermediate source-family publication
 * enters this path. The preserved epoch words are scoped by a distinct genuine
 * stage read and a newly issued spatial generation; they are not successor labels.
 *
 * This integration supplies state to microphysics. It does not choose a rate,
 * grant an exchange interval, invent nuclei or adopt any transfer candidate.
 */
export async function runSphPostMechanicsGasStateWebGpu({ device, closure,
  caloricAuthority = null, caloricThermalMaterialTable = null,
  speciesDiagnostics = null, diagnosticsMode = 'none', closureExchangeOperation = null } = {}) {
  const read = closureSources.acquireMlsMpmPostMechanicsGasSourceRead(closure,
    { device, exchangeOperation: closureExchangeOperation });
  const record = { device, closure, read, packet: null, assignment: null, generation: null,
    source: null, eos: null, eosModule: null, bound: false, children: 0,
    retiring: false, geometryReleased: false, released: false, releasePromise: null,
    deviceLost: false, lossCell: null, assignmentBuffer: null, assignmentDestroyed: false };
  // The device-lived callback retains only this small cell after retirement,
  // not every completed stage and its GPU buffers. A rejected lost thenable
  // is NOT confirmation of device loss.
  const lossCell = { record };
  record.lossCell = lossCell;
  device.lost?.then(() => {
    const owner = lossCell.record;
    if (!owner) return;
    owner.deviceLost = true;
    if (owner.retiring) startRetirement(owner);
  }, () => {});
  try {
    const packet = closureSources.resolveMlsMpmPostMechanicsGasSourceRead(read, { device });
    record.packet = packet;
    if (caloricAuthority != null && caloricThermalMaterialTable !== packet.thermalMaterialTable) {
      throw new TypeError('Current gas calorics require the exact thermal table used by the completed stages');
    }
    const family = resolveSchroederParticleBufferFamilyGeneration({
      sphParticleUpload: packet.sphParticleUpload, mlsMpmParticleUpload: packet.mlsMpmParticleUpload,
      particleCount: packet.particleCount
    });
    if (!family.ready || !packet.classificationPolicy || !packet.mechanicsLevels?.length
        || !Array.isArray(packet.boxDimsM) || packet.boxDimsM.length !== 3
        || packet.boxDimsM.some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new TypeError('Current gas state requires the original exact particle, classification and box domain');
    }
    record.assignment = await runSchroederLevelAssignmentWebGpu({
      ...packet.classificationPolicy, device,
      sphParticleState: packet.sphParticleState, mlsMpmParticleState: packet.mlsMpmParticleState,
      sphParticleUpload: packet.sphParticleUpload, mlsMpmParticleUpload: packet.mlsMpmParticleUpload,
      retainAssignmentBuffer: true, readbackMode: SCHROEDER_NO_FULL_READBACK_MODE
    });
    record.assignmentBuffer = record.assignment.assignmentBuffer;
    closureSources.resolveMlsMpmPostMechanicsGasSourceRead(read, { device });
    record.generationBuildAttempted = true;
    record.generation = await runSchroederSpatialEpochGenerationWithBackpressureWebGpu({
      device, levelAssignment: record.assignment, particleCount: packet.particleCount,
      activeSourceCapacity: packet.particleCount, particleIdentityBuffer: packet.identityBuffer,
      particleIdentityStrideWords: packet.sphParticleUpload.identityStrideBytes / 4,
      // No inherited bounded-sort atlas: canonical directory-v2 sorting keeps
      // all coordinate digits. Physical bounds still come from the exact box
      // and mechanics grids, independently of this optional sort optimization.
      exactCellAtlas: null, mechanicsLevels: packet.mechanicsLevels,
      phaseVolumeSidecarsEnabled: true, mechanicsFieldViewsEnabled: true,
      exactNearCellTreeEnabled: false, phaseVolumeInterfaceProposalEnabled: false,
      laneId: 'post-mechanics-current-gas'
    });
    if (!record.generation.ready || !record.generation.selected) {
      throw new Error(record.generation.reason || record.generation.status);
    }
    record.source = Object.freeze({ schema: 'peercompute.ulg.post-mechanics-gas-source.v1' });
    SOURCES.set(record.source, record);
    liveRecord(record.source, device);
    await captureSphAerosolPostMechanicsGasGeneration(record.source, {
      device, generation: record.generation
    });
    record.bound = true;
    record.eosModule = await import('./sphSpatialGasLedgerEosGpu.js');
    liveRecord(record.source, device);
    const selected = packet.mechanicsLevels.at(-1);
    record.eosBuildAttempted = true;
    record.eos = await record.eosModule.runSphSpatialGasLedgerEosRetainedWebGpu({
      device, residentProductMass: packet.residentProductMass,
      sphParticleUpload: packet.sphParticleUpload, mlsMpmParticleUpload: packet.mlsMpmParticleUpload,
      schroederLevelAssignment: record.assignment, schroederSpatialEpochGeneration: record.generation,
      epochIdentity: packet.epochIdentity, aerosolFamily: packet.aerosolFamily,
      spatialGasGrid: { ...selected.grid, selectedLevel: selected.selectedLevel }, level: selected.selectedLevel,
      chartId: packet.classificationPolicy.chartId,
      // The shared stage's physical wall convention is0..boxDimsM.
      boxMinM: [0, 0, 0], boxMaxM: packet.boxDimsM,
      postMechanicsGasSource: record.source, authenticateParticleProductSource: true,
      caloricAuthority, caloricThermalMaterialTable, speciesDiagnostics, diagnosticsMode,
      laneId: 'post-mechanics-current-gas'
    });
    if (!record.eos.ready) throw new Error(record.eos.reason || record.eos.status);
    liveRecord(record.source, device);
    const result = Object.freeze({ schema: 'peercompute.ulg.post-mechanics-gas-state.v1',
      ready: true, status: 'current-gas-state-submitted', sourceStage: 'post-mechanics-closure',
      levelAssignment: record.assignment, spatialGeneration: record.generation, gasEos: record.eos,
      sourceGeneration: packet.sourceGeneration, epochIdentity: packet.epochIdentity,
      dtSeconds: packet.dtSeconds, particleCount: packet.particleCount,
      completeHistory: packet.residentProductMass, kineticsAdmitted: false,
      exchangeIntervalAdmitted: false, outerPublicationAdmitted: false, scientificValidation: false });
    RESULTS.set(result, record);
    return result;
  } catch (error) {
    const cleanupConfirmed = await startRetirement(record);
    error.cleanupConfirmed = cleanupConfirmed;
    if (!cleanupConfirmed) {
      // Preserve an exact recovery handle, never turn uncertain cleanup into
      // a success or destroy the original source/transaction to clear a slot.
      const failure = Object.freeze({ schema: 'peercompute.ulg.post-mechanics-gas-state.v1',
        ready: false, status: 'current-gas-state-cleanup-quarantined' });
      RESULTS.set(failure, record);
      error.retainedGasState = failure;
    }
    throw error;
  }
}

export function releaseSphPostMechanicsGasStateAfterQueue(result, { device } = {}) {
  const record = RESULTS.get(result);
  if (!record || record.device !== device) {
    throw new TypeError('Current gas retirement requires the exact same-device result');
  }
  return startRetirement(record);
}
