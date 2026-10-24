import {
  acquireSphAerosolParcelRead,
  forkSphAerosolParcelRead,
  releaseSphAerosolParcelRead,
  validateSphAerosolParcelRead,
  sphAerosolParcelFamilyMatchesDevice,
  validateSphAerosolCondensateTransition
} from './sphAerosolParcelGpu.js';
import {
  validateSchroederSpatialEpochTransactionSourceFamily
} from './schroederSpatialEpochTransaction.js';
import { validateMlsMpmPostMechanicsContinuationClaim } from './sphMlsMpmPostMechanicsClosure.js';
import { acquireSchroederSpatialSuccessorAerosolRead } from './schroederSpatialSuccessorSourceFamily.js';

const GENERATIONS = new WeakMap();
const READS = new WeakMap();
const CONTINUATIONS = new WeakMap();

export function sphAerosolCondensateTransitionForUploads(uploads) {
  if (uploads == null) return null;
  const descriptor = Object.getOwnPropertyDescriptor(uploads, 'aerosolCondensateTransition');
  if (!descriptor) {
    if ('aerosolCondensateTransition' in uploads) throw new TypeError('Inherited aerosol transition is not authority');
    return null;
  }
  if (!Object.hasOwn(descriptor, 'value')) throw new TypeError('Aerosol transition must be an own data property');
  return descriptor.value ?? null;
}

/** Only a real closure's private positive claim can join the pending debit to
 * terminal carrier outputs. Epoch stamping happens later in SS preflight;
 * buffer, particle and optical-stage lineage must already be exact here.
 */
export function bindSphAerosolSpatialContinuation({ transition, closure, claim,
  nextParticleUploads, device, transaction, generation } = {}) {
  const sph = nextParticleUploads?.sphParticleUpload;
  const mls = nextParticleUploads?.mlsMpmParticleUpload;
  if (!validateMlsMpmPostMechanicsContinuationClaim(closure, claim, { nextParticleUploads })
      || claim.nextParticleUploads !== nextParticleUploads
      || claim.aerosolCondensateTransition !== transition
      || !validateSphAerosolCondensateTransition(transition, { device, transaction, generation,
        sourceFamily: transition?.sourceAerosolFamily, nextFamily: transition?.aerosolFamily })
      || sph?.particleCount !== transition?.particleCount
      || mls?.particleCount !== sph?.particleCount) {
    throw new TypeError('Aerosol terminal binding requires the exact claimed post-mechanics continuation');
  }
  const prior = CONTINUATIONS.get(transition);
  if (prior) {
    if (prior.nextParticleUploads !== nextParticleUploads || prior.claim !== claim) {
      throw new TypeError('Aerosol transition already belongs to another terminal continuation');
    }
    return transition;
  }
  if (sphAerosolCondensateTransitionForUploads(nextParticleUploads) != null
      || sphAerosolSourceFamily(sph) !== transition.sourceAerosolFamily) {
    throw new TypeError('Aerosol terminal binding cannot overwrite another family or transition');
  }
  const familyDescriptor = Object.getOwnPropertyDescriptor(sph, 'aerosolFamily');
  if (!Object.isExtensible(nextParticleUploads)
      || (familyDescriptor ? familyDescriptor.writable !== true : !Object.isExtensible(sph))) {
    throw new TypeError('Aerosol terminal envelope is not writable');
  }
  sph.aerosolFamily = transition.aerosolFamily;
  Object.defineProperty(nextParticleUploads, 'aerosolCondensateTransition', {
    value: transition, enumerable: false, configurable: false, writable: false
  });
  CONTINUATIONS.set(transition, { transition, closure, claim, nextParticleUploads,
    device, transaction, generation, sph, mls, state: sph.stateBuffer,
    thermo: sph.thermoBuffer, identity: sph.identityBuffer, mechanics: mls.mechanicsBuffer,
    particleCount: sph.particleCount, phaseCarrierPlan: sph.phaseCarrierPlan });
  return transition;
}

export function validateSphAerosolSpatialContinuation(transition, {
  device, transaction, generation, nextParticleUploads
} = {}) {
  try {
    const record = CONTINUATIONS.get(transition);
    if (!record || record.device !== device || record.transaction !== transaction
        || record.generation !== generation || record.nextParticleUploads !== nextParticleUploads
        || sphAerosolCondensateTransitionForUploads(nextParticleUploads) !== transition) return false;
    const { sph, mls } = record;
    return nextParticleUploads.sphParticleUpload === sph && nextParticleUploads.mlsMpmParticleUpload === mls
      && sph.stateBuffer === record.state && sph.thermoBuffer === record.thermo
      && sph.identityBuffer === record.identity && mls.mechanicsBuffer === record.mechanics
      && sph.particleCount === record.particleCount && mls.particleCount === record.particleCount
      && sph.phaseCarrierPlan === record.phaseCarrierPlan
      && sphAerosolSourceFamily(sph) === transition.aerosolFamily
      && validateMlsMpmPostMechanicsContinuationClaim(record.closure, record.claim, { nextParticleUploads })
      && validateSphAerosolCondensateTransition(transition, { device, transaction, generation,
        sourceFamily: transition.sourceAerosolFamily, nextFamily: transition.aerosolFamily });
  } catch { return false; }
}

export function sphAerosolSourceFamily(upload) {
  if (upload == null) return null;
  const descriptor = Object.getOwnPropertyDescriptor(upload, 'aerosolFamily');
  if (!descriptor) {
    if ('aerosolFamily' in upload) throw new TypeError('SS aerosol source cannot use inherited metadata');
    return null;
  }
  if (!Object.hasOwn(descriptor, 'value')) throw new TypeError('SS aerosol source must be an own data property');
  return descriptor.value ?? null;
}

/** No reservoir mutation is implicit in ordinary carrier mechanics. Extraction
 * and deposition must later supply their exact paired outer-commit authority;
 * copying a new family label or dropping the old one is not such authority.
 */
export function assertSphAerosolSpatialContinuation({ device, transaction, generation,
  sourceFamily, nextFamily, nextParticleUploads = null } = {}) {
  const transition = sphAerosolCondensateTransitionForUploads(nextParticleUploads);
  if (sourceFamily !== nextFamily) {
    if (transition?.sourceAerosolFamily === sourceFamily && transition?.aerosolFamily === nextFamily
        && validateSphAerosolSpatialContinuation(transition,
          { device, transaction, generation, nextParticleUploads })) return;
    throw new TypeError('SS aerosol replacement requires paired carrier/aerosol commit authority');
  }
  if (transition != null) throw new TypeError('An unchanged aerosol family cannot carry a replacement transition');
  if (nextFamily != null) {
    const binding = GENERATIONS.get(generation);
    if (!binding || binding.device !== device || binding.family !== nextFamily
        || !binding.transactions.has(transaction) || !bindingLive(binding)
        || !validateSphAerosolParcelRead(binding.parcelRead,
          { device, family: nextFamily, expectedGeneration: binding.familyGeneration })) {
      throw new TypeError('SS continuation requires a retained same-device aerosol source');
    }
  }
}

// Absence is source state too. A new transaction around the same generation
// cannot attach a different reservoir after the gas volume has been encoded.
// Only the actual transaction constructor calls this after authenticating its
// source tuple and registering its private authority.
export function captureSphAerosolSpatialGeneration({ device, transaction, generation,
  sphParticleUpload, mlsMpmParticleUpload, aerosolSourceFamilyConsumerLease = null } = {}) {
  if (!validateSchroederSpatialEpochTransactionSourceFamily(transaction,
    { generation, sphParticleUpload, mlsMpmParticleUpload })
    || ['aborted', 'released', 'release-scheduled', 'release-blocked'].includes(transaction.state)) {
    throw new TypeError('Aerosol spatial source requires the exact SS transaction');
  }
  const family = sphAerosolSourceFamily(sphParticleUpload);
  const prior = GENERATIONS.get(generation);
  if (prior && (prior.family !== family || prior.device !== device)) {
    throw new TypeError('Aerosol spatial generation cannot replace or omit its sealed family');
  }
  const binding = prior ?? { device, generation, family,
    familyGeneration: family?.generation ?? null, parcelRead: null, transactions: new Map() };
  if (family != null && binding.parcelRead == null) {
    binding.parcelRead = acquireSchroederSpatialSuccessorAerosolRead({
      device, sphParticleUpload, mlsMpmParticleUpload, consumerLease: aerosolSourceFamilyConsumerLease
    });
    if (!binding.parcelRead && !sphAerosolParcelFamilyMatchesDevice(family, device)) {
      throw new TypeError('Aerosol spatial source requires the exact live same-device parcel family');
    }
    binding.parcelRead ??= acquireSphAerosolParcelRead({ device, family,
      expectedGeneration: binding.familyGeneration });
  } else if (family != null && !validateSphAerosolParcelRead(binding.parcelRead,
    { device, family, expectedGeneration: binding.familyGeneration })) {
    throw new TypeError('Aerosol spatial source lost its retained parcel read');
  }
  binding.transactions.set(transaction, { generation, sphParticleUpload, mlsMpmParticleUpload });
  GENERATIONS.set(generation, binding);
}

/** Delegate the actual source-window hold to a closure or successor owner.
 * A mutable upload or a copied family token alone cannot reopen a retired read.
 */
export function acquireSphAerosolSpatialParcelRead({ device, transaction, generation,
  family } = {}) {
  const binding = GENERATIONS.get(generation);
  if (!binding || binding.device !== device || binding.family !== family
      || !binding.transactions.has(transaction) || !bindingLive(binding)) {
    throw new TypeError('Aerosol successor requires the exact retained SS source');
  }
  return family == null ? null : forkSphAerosolParcelRead(binding.parcelRead,
    { device, family, expectedGeneration: binding.familyGeneration });
}

function bindingLive(binding) {
  try { return binding.generation.ready === true && binding.generation.selected === true
    && binding.generation.releaseScheduled !== true
    && binding.generation.execution?.released !== true
    && (binding.currentGasSource ? binding.currentGasLive() : [...binding.transactions].some(([transaction, source]) =>
      sphAerosolSourceFamily(source.sphParticleUpload) === binding.family
      && validateSchroederSpatialEpochTransactionSourceFamily(transaction, source)));
  } catch { return false; }
}

/** A new private classifier may read unchanged parcels without inventing an
 * intermediate public transaction. The actual current-stage builder issues
 * this capability; callers cannot seal arbitrary generation/upload tuples. */
export async function captureSphAerosolPostMechanicsGasGeneration(source, { device, generation } = {}) {
  const current = await import('./sphPostMechanicsGasStateGpu.js');
  const resolve = () => current.resolveSphPostMechanicsGasSpatialSource(source, { device, generation });
  const packet = resolve();
  if (GENERATIONS.has(generation)) throw new TypeError('Current gas generation already has an aerosol binding');
  const family = packet.aerosolFamily;
  const parcelRead = family == null ? null : forkSphAerosolParcelRead(packet.aerosolRead, {
    device, family, expectedGeneration: packet.aerosolRead?.generation
  });
  GENERATIONS.set(generation, { device, generation, family,
    familyGeneration: packet.aerosolRead?.generation ?? null, parcelRead,
    transactions: new Map(), currentGasSource: source,
    currentGasLive: () => resolve().aerosolFamily === family,
    canReleaseCurrentGas: () => current.canReleaseSphPostMechanicsGasSpatialBinding(source, generation) });
}

export function releaseSphAerosolPostMechanicsGasGeneration(source, generation) {
  const binding = GENERATIONS.get(generation);
  if (!binding || binding.currentGasSource !== source || !binding.canReleaseCurrentGas()) {
    throw new TypeError('Current aerosol binding retirement requires its completed private geometry owner');
  }
  if (binding.parcelRead) releaseSphAerosolParcelRead(binding.parcelRead);
  binding.parcelRead = null;
  GENERATIONS.delete(generation);
  return true;
}

/** Only the real transaction's terminal transition retires its capture lease.
 * Failed generation-owner retirement retains it. Multiple real transactions
 * around one generation share a hold; consumer forks have separate fences.
 * Successor publication/lane teardown remain separate ownership boundaries.
 */
export function releaseSphAerosolSpatialTransaction(transaction, generation) {
  const binding = GENERATIONS.get(generation);
  if (!binding?.transactions.has(transaction)) return false;
  if (transaction.state !== 'released' && transaction.state !== 'aborted') {
    throw new TypeError('Aerosol spatial retirement requires the actual terminal transaction');
  }
  binding.transactions.delete(transaction);
  if (binding.transactions.size === 0 && binding.parcelRead != null) {
    releaseSphAerosolParcelRead(binding.parcelRead);
    binding.parcelRead = null;
  }
  return true;
}

/** Select the immutable SS snapshot, not a caller's mutable upload metadata.
 * Legacy no-aerosol generations may precede transaction creation. A nonempty
 * family is NEVER admitted that way. Passing null explicitly against a sealed
 * family rejects; undefined lets the normal EOS route derive the sealed source.
 */
export function acquireSphAerosolSpatialGenerationRead({ device, generation,
  aerosolFamily = undefined } = {}) {
  const binding = GENERATIONS.get(generation);
  const family = binding?.family ?? null;
  if (aerosolFamily !== undefined && aerosolFamily !== family) {
    throw new TypeError('Aerosol free-volume input omitted or replaced the SS source family');
  }
  if (!binding) {
    if (aerosolFamily != null) throw new TypeError('Aerosol free-volume source is not sealed by SS');
    return null;
  }
  if (binding.device !== device || !bindingLive(binding)) {
    throw new TypeError('Aerosol spatial source generation is stale');
  }
  if (!family) return null;
  const parcelRead = forkSphAerosolParcelRead(binding.parcelRead, { family, device,
    expectedGeneration: binding.familyGeneration });
  const read = Object.freeze({ family, buffer: parcelRead.buffer,
    capacity: parcelRead.capacity, familyId: parcelRead.familyId,
    generation: parcelRead.generation, spatialGeneration: generation });
  READS.set(read, { binding, parcelRead, released: false });
  return read;
}

export function validateSphAerosolSpatialGenerationRead(read, { device, generation,
  aerosolFamily = undefined } = {}) {
  if (read == null) {
    const binding = GENERATIONS.get(generation);
    return aerosolFamily == null && (!binding || (binding.family == null
      && binding.device === device && bindingLive(binding)));
  }
  const record = READS.get(read);
  if (!record || record.released) return false;
  const { binding, parcelRead } = record;
  return binding.device === device && binding.generation === generation
    && GENERATIONS.get(generation) === binding && bindingLive(binding)
    && (aerosolFamily === undefined || aerosolFamily === binding.family)
    && validateSphAerosolParcelRead(parcelRead, { device, family: binding.family,
      expectedGeneration: binding.familyGeneration });
}

export function releaseSphAerosolSpatialGenerationRead(read) {
  if (read == null) return false;
  const record = READS.get(read);
  if (!record) throw new TypeError('Aerosol spatial read requires the exact capability');
  if (record.released) return false;
  record.released = true;
  releaseSphAerosolParcelRead(record.parcelRead);
  return true;
}
