import { assertSphLegacyMassPathAllowed, markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
import {
  ULG_SPH_AEROSOL_PARCEL_SCHEMA,
  ULG_SPH_AEROSOL_BUDGET_SCHEMA,
  SPH_AEROSOL_PARCEL_BYTES,
  SPH_AEROSOL_PARCEL_WORDS,
  SPH_AEROSOL_BUDGET_BYTES,
  SPH_AEROSOL_BUDGET_WORDS,
  SPH_AEROSOL_BUDGET_MAGIC,
  SPH_AEROSOL_BUDGET_VERSION
} from '../../../ulg-gpu-abi/src/sphAerosolParcel.js';
import {
  sphAerosolParcelInitializeWgsl,
  sphAerosolInventoryPartialsWgsl,
  sphAerosolInventoryFinalizeWgsl
} from './sphAerosolParcelWgsl.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuBufferMatchesDevice } from './sphGpuDeviceIdentity.js';
import { watchSphDeviceLossFor } from './sphDeviceLossRelay.js';
import {
  sphAerosolCondensateProposalWgsl,
  sphAerosolCondensateApplyWgsl
} from './sphAerosolCondensateExtractionWgsl.js';
import { packSphPhaseCarrierClosureRows, validateSphPhaseCarrierPlan } from './sphPhaseCarrierTransferGpu.js';
import { validateSchroederSpatialEpochTransactionSourceFamily } from './schroederSpatialEpochTransaction.js';
import { validateSchroederSpatialAerosolPublicationWindow } from './schroederSpatialSuccessorSourceFamily.js';
import { sphAerosolSourceFamily } from './sphAerosolSpatialBinding.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from './sphMechanicsMaterialTable.js';
import { encodeSphExactAerosolInitialQuantities, sphExactAerosolQuantityLayout } from './sphExactAerosolQuantities.js';
import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';

const FAMILIES = new WeakMap();
const PARCEL_READS = new WeakMap();
const EXTRACTIONS = new WeakMap();
const EXTRACTION_PAIRS = new WeakMap();
const CONDENSATE_TRANSITIONS = new WeakMap();
const CONDENSATE_RESIDUAL_TRANSITIONS = new WeakMap();
// One selected source generation admits one batch, including when a caller
// constructs another genuine transaction object for the same source. Aerosol
// ancestry alone cannot prove that carrier mass has not already been debited.
const EXTRACTION_SOURCE_CLAIMS = new WeakMap();
const U64_MAX = (1n << 64n) - 1n;
const STORAGE = 128, UNIFORM = 64, COPY_SRC = 4, COPY_DST = 8;
const ENERGY_SCOPE = 'stored-internal-plus-translational-kinetic-only';
let nextFamilyId = 1;

function uint(value, name, maximum = 0xffffffff) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${name} must be an exact unsigned integer <= ${maximum}`);
  }
  return value;
}

function positiveU64(value, name) {
  if (typeof value !== 'bigint' && !Number.isSafeInteger(value)) {
    throw new TypeError(`${name} requires a bigint or exact safe integer`);
  }
  const number = BigInt(value);
  if (number <= 0n || number > U64_MAX) throw new RangeError(`${name} must be positive u64`);
  return number;
}

function physicalFloat(value, name, positive = false) {
  const packed = Math.fround(value);
  if (typeof value !== 'number' || !Number.isFinite(packed) || (positive && !(packed > 0))) {
    throw new RangeError(`${name} must be ${positive ? 'positive ' : ''}finite f32`);
  }
  return packed;
}

function vector(value, name) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${name} requires three components`);
  return value.map((component) => physicalFloat(component, name));
}

function packU64(words, offset, value) {
  words[offset] = Number(value & 0xffffffffn);
  words[offset + 1] = Number(value >> 32n);
}

function requireDevice(device) {
  if (!device?.createBuffer || !device?.createCommandEncoder || !device?.queue?.writeBuffer
      || !device?.queue?.submit || !device?.queue?.onSubmittedWorkDone || !device?.lost?.then) {
    throw new TypeError('Aerosol inventory requires a live WebGPU device with queue retirement');
  }
}

function allocate(device, resources, label, size, usage) {
  const limit = Math.min(device.limits?.maxBufferSize ?? Infinity,
    usage & STORAGE ? device.limits?.maxStorageBufferBindingSize ?? Infinity : Infinity);
  if (size > limit) throw new RangeError(`${label} exceeds device buffer limits`);
  const buffer = device.createBuffer({ label, size, usage });
  resources.push(buffer);
  tagWebGpuBufferDevice(buffer, device);
  return buffer;
}

function linearDispatch(count, device) {
  const limit = device.limits?.maxComputeWorkgroupsPerDimension ?? 65535;
  const x = Math.min(count, limit), y = Math.ceil(count / x);
  if (y > limit) throw new RangeError('Aerosol dispatch exceeds device dimensions');
  return { x, y, count: x * y };
}

function destroy(resources) {
  for (const buffer of resources.splice(0)) buffer.destroy();
}

const PENDING_UNCONFIRMED_CLEANUPS = new Set();

function invokeAfterQueueCallback(target) {
  PENDING_UNCONFIRMED_CLEANUPS.delete(target);
  target.callback();
}

function handleCondensateCandidateLost(candidateRecord) {
  if (candidateRecord.disposition === 'prepared') {
    if (candidateRecord.transition != null) discardSphAerosolCondensateTransition(candidateRecord.transition);
    else { candidateRecord.disposition = 'discarded'; candidateRecord.dispose(); }
  }
}

function handleAerosolChildLost(child) {
  child.lost = true;
  child.releaseRequested = true;
  retireFamily(child);
}

function handleExtractionPairLost(pairRecord) {
  pairRecord.released = true;
  destroy(pairRecord.resources);
}

function handleVaporTransitionRecordLost(record) {
  if (record.transition) discardSphAerosolCondensateTransition(record.transition);
  else record.dispose();
}

function handlePendingCondensateTransitionLost(pending) {
  pending.child.lost = true;
  pending.child.releaseRequested = true;
  retireFamily(pending.child);
  if (pending.disposition === 'published') retireCondensateTransitionResiduals(pending);
}

function afterQueue(device, callback, quarantine = () => {}) {
  // Call before returning: this fence names the submitted reads, not work a
  // later caller happens to enqueue. A failed fence alone is NOT confirmation
  // of device loss or completed reads. Retain/quarantine until loss confirms.
  const unconfirmed = () => {
    quarantine();
    const token = { callback };
    PENDING_UNCONFIRMED_CLEANUPS.add(token);
    if (!watchSphDeviceLossFor(device, token, invokeAfterQueueCallback)) {
      PENDING_UNCONFIRMED_CLEANUPS.delete(token);
    }
  };
  try { Promise.resolve(device.queue.onSubmittedWorkDone()).then(callback, unconfirmed); }
  catch { unconfirmed(); }
}

function retireFamily(record) {
  if (!record.releaseRequested || record.borrows || record.retirementScheduled) return;
  record.retirementScheduled = true;
  if (record.lost) destroy(record.resources);
  else afterQueue(record.device, () => destroy(record.resources), () => { record.quarantined = true; });
}

/**
 * Import an explicitly declared INITIAL physical population, never a hot-state
 * mirror or a claim that existing carrier mass was transferred. Missing N,
 * provenance or density cannot be repaired with an optical/render sample count.
 * Condensation/extraction must later create a paired conservative successor.
 */
export function createSphAerosolParcelFamilyWebGpu({ device, capacity, parcels = [], provenance, exactMass = null } = {}) {
  requireDevice(device);
  uint(capacity, 'aerosol capacity', 0xffffff);
  if (capacity === 0) throw new RangeError('aerosol capacity must be positive');
  if (!Array.isArray(parcels) || parcels.length > capacity) throw new RangeError('initial population exceeds capacity');
  const exactFormat = exactMass == null ? null : validateSphExactMassFormat(exactMass.format);
  if (provenance?.kind !== 'initial-conditions' || typeof provenance.reference !== 'string'
      || !provenance.reference.trim()) throw new TypeError('explicit initial-condition provenance is required');
  const byteLength = capacity * SPH_AEROSOL_PARCEL_BYTES;
  const maximum = Math.min(device.limits?.maxBufferSize ?? Infinity,
    device.limits?.maxStorageBufferBindingSize ?? Infinity);
  if (byteLength > maximum) throw new RangeError('aerosol capacity exceeds device buffer limits');
  if (exactFormat && sphExactAerosolQuantityLayout(exactFormat, capacity).byteLength > maximum) {
    throw new RangeError('Exact aerosol quantities exceed device buffer limits');
  }
  const coldMasses = exactFormat ? Array(capacity).fill(0) : null;
  const bytes = new ArrayBuffer(byteLength);
  const floats = new Float32Array(bytes), words = new Uint32Array(bytes);
  const slots = new Set(), ids = new Set(), nucleusIds = new Set();
  let population = 0n;
  for (const parcel of parcels) {
    const slot = uint(parcel.slot, 'parcel slot', capacity - 1);
    if (slots.has(slot)) throw new TypeError('duplicate initial parcel slot');
    slots.add(slot);
    const id = positiveU64(parcel.parcelId, 'parcel ID');
    if (ids.has(id)) throw new TypeError('duplicate initial parcel ID');
    ids.add(id);
    const multiplicity = positiveU64(parcel.physicalMultiplicity, 'physical droplet multiplicity');
    population += multiplicity;
    if (population > U64_MAX) throw new RangeError('physical population sum overflows u64');
    const nucleus = positiveU64(parcel.nucleusPopulationId, 'nucleus population ID');
    nucleusIds.add(nucleus);
    if (parcel.sourceLineageIndex !== 0xffffffff || parcel.sourceTopologyEpoch !== 0) {
      throw new TypeError('initial aerosol mass requires explicit non-carrier origin and epoch zero');
    }
    const material = uint(parcel.materialId, 'material ID', 0xffffff);
    if (!material || (parcel.phaseId !== 1 && parcel.phaseId !== 2)) {
      throw new RangeError('initial aerosol requires material identity and condensed phase');
    }
    const offset = slot * SPH_AEROSOL_PARCEL_WORDS;
    const massProperty = Object.getOwnPropertyDescriptor(parcel, 'massKg');
    if (exactFormat && (!massProperty || !Object.hasOwn(massProperty, 'value'))) {
      throw new TypeError('Exact aerosol initial mass must be explicit own data');
    }
    const massKg = exactFormat ? massProperty.value : parcel.massKg;
    if (coldMasses) coldMasses[slot] = massKg;
    floats.set([...vector(parcel.positionM, 'position'), physicalFloat(massKg, 'mass', true),
      ...vector(parcel.velocityMPerS, 'velocity'), physicalFloat(parcel.specificInternalEnergyJPerKg, 'specific internal energy'),
      physicalFloat(parcel.temperatureK, 'temperature', true),
      physicalFloat(parcel.condensedDensityKgM3, 'condensed density', true), 0, 0], offset);
    words[offset + 12] = material;
    words[offset + 13] = parcel.phaseId;
    packU64(words, offset + 14, multiplicity);
    packU64(words, offset + 16, id);
    words[offset + 18] = 0xffffffff;
    packU64(words, offset + 20, nucleus);
    words[offset + 22] = 1;
    words[offset + 23] = 1;
  }
  const exactSeed = exactFormat ? encodeSphExactAerosolInitialQuantities({ format: exactFormat,
    capacity, massesKg: coldMasses, parcelWords: words }) : null;
  if (exactSeed && exactSeed.layout.byteLength > maximum) {
    throw new RangeError('Exact aerosol quantities exceed device buffer limits');
  }
  const resources = [], temporaries = [];
  const dispatch = linearDispatch(Math.ceil(capacity / 64), device);
  let submissionStarted = false;
  try {
    const buffer = allocate(device, resources, 'ulg-aerosol-initial-population', byteLength, STORAGE | COPY_SRC | COPY_DST);
    const params = allocate(device, temporaries, 'ulg-aerosol-initial-params', 16, UNIFORM | COPY_DST);
    const quantityBuffer = exactSeed ? allocate(device, resources, 'ulg-aerosol-initial-exact-quantities',
      exactSeed.layout.byteLength, STORAGE | COPY_SRC | COPY_DST) : null;
    const exactQuantities = exactSeed ? Object.freeze({ format: exactFormat, quantityBuffer,
      quantityLayout: exactSeed.layout }) : null;
    submissionStarted = true;
    device.queue.writeBuffer(buffer, 0, bytes);
    device.queue.writeBuffer(params, 0, new Uint32Array([0, capacity, 1, 0]));
    if (exactSeed) device.queue.writeBuffer(quantityBuffer, 0, exactSeed.words);
    const info = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-aerosol-initialize.v0', label: 'ulg-aerosol-initialize',
      code: sphAerosolParcelInitializeWgsl, entryPoint: 'initialize_aerosol',
      bindings: [computeBufferBinding(0, 'storage'), computeBufferBinding(1, 'uniform')]
    });
    const group = device.createBindGroup({ layout: info.bindGroupLayout, entries: [
      { binding: 0, resource: { buffer } }, { binding: 1, resource: { buffer: params } }
    ] });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(info.pipeline); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(dispatch.x, dispatch.y); pass.end();
    const command = encoder.finish();
    submissionStarted = true;
    device.queue.submit([command]);
    const record = { device, buffer, resources, capacity, generation: 0, exactQuantities,
      population, ids, nucleusIds, extractionPending: null, successorAdopted: false,
      releaseRequested: false, retirementScheduled: false, borrows: 0, lost: false, quarantined: false };
    afterQueue(device, () => destroy(temporaries), () => { record.quarantined = true; });
    const family = Object.freeze({ schema: ULG_SPH_AEROSOL_PARCEL_SCHEMA,
      status: 'initial-aerosol-population-submitted', familyId: nextFamilyId++,
      capacity, generation: 0, initialParcelCount: parcels.length,
      exactMassFormat: exactFormat,
      provenance: Object.freeze({ kind: provenance.kind, reference: provenance.reference.trim() }),
      massSource: 'independent-explicit-initial-conditions-not-carrier-transfer',
      energyScope: ENERGY_SCOPE, fullPhysicsValidation: false });
    FAMILIES.set(family, record);
    device.lost?.then?.(() => {
      record.lost = true; record.releaseRequested = true; retireFamily(record);
    });
    return family;
  } catch (error) {
    const cleanup = () => { destroy(resources); destroy(temporaries); };
    if (submissionStarted) afterQueue(device, cleanup); else cleanup();
    throw error;
  }
}

export function releaseSphAerosolParcelFamily(family) {
  const record = FAMILIES.get(family);
  if (!record) throw new TypeError('Aerosol retirement requires the exact family owner');
  if (record.releaseRequested) return false;
  record.releaseRequested = true;
  retireFamily(record);
  return true;
}

function extractionSourceContext({ device, sourceLineage, sourceStateBuffer,
  sourceThermoBuffer, sourceMechanicsBuffer }) {
  const { transaction, generation, sphParticleUpload, mlsMpmParticleUpload } = sourceLineage || {};
  const count = uint(sphParticleUpload?.particleCount, 'extraction carrier count', 0xffffff);
  const phasePlan = sphParticleUpload?.phaseCarrierPlan;
  const plan = validateSphPhaseCarrierPlan(phasePlan, count);
  if (!plan.accepted || mlsMpmParticleUpload?.particleCount !== count) {
    throw new TypeError('Condensate extraction requires the exact four-lane source plan');
  }
  const topologyEpoch = uint(generation?.execution?.topologyEpoch, 'source topology epoch');
  const priorThermo = sphParticleUpload.thermoBuffer;
  // Optical capture needs the original stable particle identity, but extraction
  // alone does not require the optional optical lineage metadata.
  const opticalIdentityBuffer = sphParticleUpload.identityBuffer;
  const opticalIdentityRevision = sphParticleUpload.identityRevision;
  const validate = () => {
    if (!transaction || !generation || generation.releaseScheduled === true
        || generation.execution?.released === true
        || ['aborted', 'released', 'release-scheduled', 'release-blocked'].includes(transaction.state)
        || !validateSchroederSpatialEpochTransactionSourceFamily(transaction,
          { generation, sphParticleUpload, mlsMpmParticleUpload })
        || sphParticleUpload.particleCount !== count || mlsMpmParticleUpload.particleCount !== count
        || sphParticleUpload.thermoBuffer !== priorThermo
        || sphParticleUpload.phaseCarrierPlan !== phasePlan
        || !validateSphPhaseCarrierPlan(phasePlan, count).accepted) {
      throw new TypeError('Condensate extraction requires the exact live SS source transaction');
    }
    for (const field of ['storageGeneration', 'physicsTick', 'physicsSubstep',
      'positionEpoch', 'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']) {
      const value = transaction.epochIdentity?.[field];
      if (!Number.isSafeInteger(value) || generation.execution?.[field] !== value
          || sphParticleUpload[field] !== value || mlsMpmParticleUpload[field] !== value) {
        throw new TypeError('Condensate extraction source epochs no longer match');
      }
    }
    if (generation.execution.topologyEpoch !== topologyEpoch) {
      throw new TypeError('Condensate extraction source topology changed');
    }
    for (const [buffer, stride, name] of [[sourceStateBuffer, 32, 'extraction state'],
      [sourceThermoBuffer, 48, 'extraction thermo'], [sourceMechanicsBuffer, 128, 'extraction mechanics']]) {
      requireCarrierBuffer(buffer, count * stride, device, name);
      if (!(buffer.usage & COPY_SRC)) throw new TypeError(`${name} requires immutable candidate copy support`);
    }
    requireCarrierBuffer(priorThermo, count * 48, device, 'transaction-owned prior thermo');
  };
  validate();
  return { count, plan, topologyEpoch, priorThermo, transaction, generation,
    opticalIdentityBuffer, opticalIdentityRevision,
    sphParticleUpload, mlsMpmParticleUpload, validate };
}

function extractionDeclaration({ source, declarations, provenance, targetCapacity }) {
  if (provenance?.kind !== 'already-activated-condensate-population'
      || typeof provenance.reference !== 'string' || !provenance.reference.trim()) {
    throw new TypeError('Extraction needs an explicit already-activated physical population reference, not a nucleation claim');
  }
  if (!Array.isArray(declarations) || declarations.length === 0) {
    throw new TypeError('Extraction requires a nonempty explicit physical population');
  }
  const capacity = uint(targetCapacity ?? source.capacity + declarations.length, 'target aerosol capacity', 0xffffff);
  if (capacity < source.capacity + declarations.length) throw new RangeError('Insufficient distinct aerosol successor capacity');
  const ids = new Set(source.ids), nucleusIds = new Set(source.nucleusIds), lineages = new Set();
  const rows = new Uint32Array(declarations.length * 8);
  let population = source.population;
  declarations.forEach((item, index) => {
    const lineage = uint(item.lineageIndex, 'condensate source lineage', source.lineageCapacity - 1);
    if (lineages.has(lineage)) throw new TypeError('Duplicate condensate donor lineage');
    lineages.add(lineage);
    const id = positiveU64(item.parcelId, 'condensate parcel ID');
    const nucleus = positiveU64(item.nucleusPopulationId, 'condensate nucleus population ID');
    if (ids.has(id) || nucleusIds.has(nucleus)) throw new TypeError('Replayed parcel or physical population ID');
    ids.add(id); nucleusIds.add(nucleus);
    const number = positiveU64(item.physicalMultiplicity, 'condensate physical multiplicity');
    population += number;
    if (population > U64_MAX) throw new RangeError('Condensate physical population overflows u64');
    const base = index * 8;
    rows[base] = lineage; rows[base + 1] = source.capacity + index;
    packU64(rows, base + 2, number); packU64(rows, base + 4, id); packU64(rows, base + 6, nucleus);
  });
  return { capacity, ids, nucleusIds, population, rows, lineages: Object.freeze([...lineages]),
    provenance: Object.freeze({ kind: provenance.kind, reference: provenance.reference.trim() }) };
}

/** Prepare a real conservative debit in new GPU buffers. The exact SS input
 * authenticates prior pure-gas evidence; post-thermal S/T/M are the supplied
 * same-device candidate triple. This is NOT yet a resident successor commit,
 * gas-volume authority, nucleation law, optical admission or enabled preset.
 * Only the private paired adopt below can expose the new aerosol owner.
 */
export async function runSphAerosolCondensateExtractionWebGpu({ device, sourceFamily, sourceRead = null,
  expectedGeneration, sourceLineage, sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer,
  thermalMaterialTable, mechanicsMaterialTable, declarations, provenance, targetCapacity,
  absolutePressureAuthority = false } = {}) {
  assertSphLegacyMassPathAllowed({ sourceStateBuffer, sourceThermoBuffer }, 'Condensate extraction');
  requireDevice(device);
  // A generation-held capability may outlive the original public owner. Take
  // our own fork below, so the caller can retire its read during the dispatch.
  if (sourceRead != null && !validateSphAerosolParcelRead(sourceRead,
    { device, family: sourceFamily, expectedGeneration })) {
    throw new TypeError('Condensate extraction requires an exact live source read');
  }
  const source = sourceRead == null ? requireFamily(sourceFamily, device) : PARCEL_READS.get(sourceRead).source;
  if (source.exactQuantities) throw new TypeError('Exact aerosol quantities require the conservative exact extraction writer');
  if (expectedGeneration !== source.generation || source.generation === 0xffffffff
      || source.extractionPending || source.successorAdopted) {
    throw new TypeError('Aerosol extraction source generation is stale, pending or already adopted');
  }
  const context = extractionSourceContext({ device, sourceLineage,
    sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer });
  const sourceClaim = EXTRACTION_SOURCE_CLAIMS.get(context.generation) || { pending: null, adopted: false };
  if (sourceClaim.pending || sourceClaim.adopted) {
    throw new TypeError('Condensate carrier source generation is pending or already consumed');
  }
  if (!(thermalMaterialTable?.segments instanceof Float32Array) || thermalMaterialTable.segments.length % 12
      || !(thermalMaterialTable?.records instanceof Float32Array) || thermalMaterialTable.records.length % 8
      || mechanicsMaterialTable?.schema !== ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA
      || !(mechanicsMaterialTable.records instanceof Float32Array)) {
    throw new TypeError('Condensate extraction requires complete packed physical closure tables');
  }
  const declaration = extractionDeclaration({ source: { ...source, lineageCapacity: context.plan.lineageCapacity },
    declarations, provenance, targetCapacity });
  const requestCount = declarations.length;
  const closure = packSphPhaseCarrierClosureRows(thermalMaterialTable, mechanicsMaterialTable);
  const header = new Uint32Array([0x41455830, 0, 0, 0, requestCount, context.count,
    source.capacity, declaration.capacity, source.generation, source.generation + 1, context.topologyEpoch, 0, 0, 0, 0, 0]);
  const paramsData = new Uint32Array(24);
  paramsData.set([context.count, context.plan.lineageCapacity, requestCount, source.capacity,
    declaration.capacity, source.generation, source.generation + 1, context.topologyEpoch,
    closure.thermalSegmentCount, closure.mechanicsRecordCount, closure.thermalOffsetVec4,
    closure.mechanicsOffsetVec4, closure.materialRecordCount, closure.materialRecordOffsetVec4,
    absolutePressureAuthority === true ? 1 : 0]);
  new Float32Array(paramsData.buffer).set([1e-7, 2e-4, 1e-20, 0], 16);
  const dispatch = linearDispatch(Math.ceil(requestCount / 64), device);
  const outputs = [], temporaries = [], reservation = {};
  let retainedRead = null;
  const validateSource = () => {
    if (retainedRead == null) return requireFamily(sourceFamily, device);
    if (!validateSphAerosolParcelRead(retainedRead, { device, family: sourceFamily, expectedGeneration })) {
      throw new TypeError('Condensate extraction lost its exact retained source read');
    }
    return source;
  };
  let submitted = false, sourceBorrowed = true, mapped = null;
  sourceClaim.pending = reservation;
  EXTRACTION_SOURCE_CLAIMS.set(context.generation, sourceClaim);
  source.extractionPending = reservation;
  source.borrows++;
  const dropSource = () => {
    if (!sourceBorrowed) return;
    sourceBorrowed = false;
    if (source.extractionPending === reservation) source.extractionPending = null;
    if (sourceClaim.pending === reservation) sourceClaim.pending = null;
    if (retainedRead == null) { source.borrows--; retireFamily(source); }
    else releaseSphAerosolParcelRead(retainedRead);
  };
  const dispose = () => {
    const cleanup = () => { destroy(outputs); destroy(temporaries); dropSource(); };
    if (submitted) afterQueue(device, cleanup, () => { source.quarantined = true; }); else cleanup();
  };
  try {
    if (sourceRead != null) {
      // Reserve before the fork installs its loss handler: reentrant setup may
      // not start a second debit. Once the fork owns the hold, drop our manual
      // temporary borrow; failures still use the ordinary rollback below.
      retainedRead = forkSphAerosolParcelRead(sourceRead,
        { device, family: sourceFamily, expectedGeneration });
      source.borrows--;
    }
    const state = allocate(device, outputs, 'ulg-aerosol-extraction-residual-state', context.count * 32, STORAGE | COPY_SRC | COPY_DST);
    const thermo = allocate(device, outputs, 'ulg-aerosol-extraction-residual-thermo', context.count * 48, STORAGE | COPY_SRC | COPY_DST);
    const mechanics = allocate(device, outputs, 'ulg-aerosol-extraction-residual-mechanics', context.count * 128, STORAGE | COPY_SRC | COPY_DST);
    const parcels = allocate(device, outputs, 'ulg-aerosol-extraction-successor-parcels', declaration.capacity * 96, STORAGE | COPY_SRC | COPY_DST);
    const scratch = allocate(device, temporaries, 'ulg-aerosol-extraction-proposals', 64 + requestCount * 320, STORAGE | COPY_SRC | COPY_DST);
    const params = allocate(device, temporaries, 'ulg-aerosol-extraction-params', 96, UNIFORM | COPY_DST);
    const closureBuffer = allocate(device, temporaries, 'ulg-aerosol-extraction-closure', Math.max(16, closure.values.byteLength), STORAGE | COPY_DST);
    const requests = allocate(device, temporaries, 'ulg-aerosol-extraction-declarations', declaration.rows.byteLength, STORAGE | COPY_DST);
    const readback = allocate(device, temporaries, 'ulg-aerosol-extraction-verdict', 64, 1 | COPY_DST);
    device.queue.writeBuffer(scratch, 0, header); device.queue.writeBuffer(params, 0, paramsData);
    if (closure.values.byteLength) device.queue.writeBuffer(closureBuffer, 0, closure.values);
    device.queue.writeBuffer(requests, 0, declaration.rows);
    const stage = (code, name, types, buffers) => {
      const info = createCachedExplicitComputePipeline(device, { cacheKey: `ulg-aerosol-${name}.v0`,
        label: `ulg-aerosol-${name}`, code, entryPoint: name,
        bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
      const group = device.createBindGroup({ layout: info.bindGroupLayout,
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      return { info, group };
    };
    const proposal = stage(sphAerosolCondensateProposalWgsl, 'propose_condensate',
      ['read-only-storage', 'read-only-storage', 'read-only-storage', 'read-only-storage',
        'read-only-storage', 'read-only-storage', 'storage', 'uniform'],
      [sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, context.priorThermo,
        closureBuffer, requests, scratch, params]);
    const apply = stage(sphAerosolCondensateApplyWgsl, 'apply_condensate',
      ['storage', 'storage', 'storage', 'storage', 'storage', 'uniform'],
      [scratch, state, thermo, mechanics, parcels, params]);
    const encoder = device.createCommandEncoder();
    [[sourceStateBuffer, state, 32], [sourceThermoBuffer, thermo, 48], [sourceMechanicsBuffer, mechanics, 128]]
      .forEach(([input, output, stride]) => encoder.copyBufferToBuffer(input, 0, output, 0, context.count * stride));
    encoder.copyBufferToBuffer(source.buffer, 0, parcels, 0, source.capacity * 96);
    for (const { info, group } of [proposal, apply]) {
      const pass = encoder.beginComputePass();
      pass.setPipeline(info.pipeline); pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(dispatch.x, dispatch.y); pass.end();
    }
    encoder.copyBufferToBuffer(scratch, 0, readback, 0, 64);
    const command = encoder.finish();
    context.validate();
    submitted = true; device.queue.submit([command]);
    await readback.mapAsync(1); mapped = readback;
    const receipt = new Uint32Array(readback.getMappedRange()).slice();
    readback.unmap(); mapped = null;
    context.validate(); validateSource();
    if (receipt.length !== 16 || receipt[2] !== 0 || receipt[3] !== requestCount || receipt[11] !== requestCount
        || [...header].some((value, index) => ![2, 3, 11].includes(index) && receipt[index] !== value)) {
      throw new Error(`Condensate extraction rejected GPU candidate (errors=${receipt[2]}, ready=${receipt[3]}, applied=${receipt[11]})`);
    }
    const candidate = Object.freeze({ schema: 'peercompute.ulg.sph-aerosol-condensate-candidate.v0',
      status: 'condensate-candidate-ready-not-resident-adopted', generation: source.generation + 1,
      sourceFamilyId: sourceFamily.familyId, requestCount, readbackBytes: 64, readbackCount: 1,
      dispatchCount: 2, energyScope: ENERGY_SCOPE, fullPhysicsValidation: false });
    const candidateRecord = { device, source, sourceFamily, context, sourceClaim, reservation, outputs,
      temporaries, declaration, state, thermo, mechanics, parcels, receipt, dropSource, dispose,
      sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, validateSource,
      transition: null, transitionPreparing: false, disposition: 'prepared' };
    EXTRACTIONS.set(candidate, candidateRecord);
    watchSphDeviceLossFor(device, candidateRecord, handleCondensateCandidateLost);
    afterQueue(device, () => destroy(temporaries), () => { source.quarantined = true; });
    return candidate;
  } catch (error) {
    if (mapped) mapped.unmap();
    dispose(); throw error;
  }
}

export function discardSphAerosolCondensateExtraction(candidate) {
  const record = EXTRACTIONS.get(candidate);
  if (!record) throw new TypeError('Condensate discard requires the exact candidate');
  if (record.disposition !== 'prepared') return false;
  if (record.transition != null) return discardSphAerosolCondensateTransition(record.transition);
  record.disposition = 'discarded'; record.dispose(); return true;
}

/** Transfer BOTH residual carrier and aerosol ownership, never one half.
 * This prepares an isolated paired family, not the outer SS publication gate.
 */
export function adoptSphAerosolCondensateExtraction(candidate) {
  const record = EXTRACTIONS.get(candidate);
  if (!record || record.disposition !== 'prepared' || record.transition != null || record.transitionPreparing) {
    throw new TypeError('Condensate adoption requires the exact unconsumed candidate, not an outer-reserved transition');
  }
  const { device, source, declaration, context } = record;
  context.validate(); record.validateSource();
  if (source.successorAdopted || source.extractionPending !== record.reservation
      || record.sourceClaim.adopted || record.sourceClaim.pending !== record.reservation) {
    throw new TypeError('Condensate successor source was already adopted or invalidated');
  }
  const family = Object.freeze({ schema: ULG_SPH_AEROSOL_PARCEL_SCHEMA,
    status: 'paired-condensate-inventory-adopted-not-spatially-admitted', familyId: nextFamilyId++,
    capacity: declaration.capacity, generation: source.generation + 1,
    provenance: declaration.provenance, massSource: 'paired-pre-transfer-carrier-debit',
    energyScope: ENERGY_SCOPE, fullPhysicsValidation: false });
  const child = { device, buffer: record.parcels, resources: [record.parcels], capacity: declaration.capacity,
    generation: family.generation, population: declaration.population, ids: declaration.ids,
    nucleusIds: declaration.nucleusIds, extractionPending: null, successorAdopted: false,
    releaseRequested: false, retirementScheduled: false, borrows: 0, lost: false, quarantined: false };
  FAMILIES.set(family, child);
  watchSphDeviceLossFor(device, child, handleAerosolChildLost);
  const pair = Object.freeze({ schema: 'peercompute.ulg.sph-condensate-residual-aerosol-pair.v0',
    status: 'isolated-paired-inventory-ready-not-ss-successor', particleCount: context.count,
    stateBuffer: record.state, thermoBuffer: record.thermo, mechanicsBuffer: record.mechanics,
    aerosolFamily: family, sourceAerosolFamily: record.sourceFamily,
    sourceTopologyEpoch: context.topologyEpoch, energyScope: ENERGY_SCOPE,
    gasVolumeAuthority: false, opticalAuthority: false, fullPhysicsValidation: false });
  const pairRecord = { device, family, resources: [record.state, record.thermo, record.mechanics], released: false };
  EXTRACTION_PAIRS.set(pair, pairRecord);
  watchSphDeviceLossFor(device, pairRecord, handleExtractionPairLost);
  record.disposition = 'adopted'; source.successorAdopted = true; record.sourceClaim.adopted = true;
  record.outputs.length = 0; record.dropSource();
  return pair;
}

export function releaseSphAerosolCondensatePair(pair) {
  const record = EXTRACTION_PAIRS.get(pair);
  if (!record) throw new TypeError('Condensate pair retirement requires the exact owner');
  if (record.released) return false;
  record.released = true;
  releaseSphAerosolParcelFamily(record.family);
  afterQueue(record.device, () => destroy(record.resources), () => {
    const family = FAMILIES.get(record.family); if (family) family.quarantined = true;
  });
  return true;
}

function requirePendingCondensateSource(record) {
  if (!record || record.disposition !== 'prepared') {
    throw new TypeError('Condensate transition requires the exact pending candidate');
  }
  record.context.validate();
  record.validateSource();
  if (record.source.successorAdopted || record.source.extractionPending !== record.reservation
      || record.sourceClaim.adopted || record.sourceClaim.pending !== record.reservation
      || sphAerosolSourceFamily(record.context.sphParticleUpload) !== record.sourceFamily) {
    throw new TypeError('Condensate transition requires the unconsumed transaction-owned aerosol source');
  }
}

/** Reserve BOTH candidate halves for the actual outer SS publication. The
 * prospective token is deliberately absent from FAMILIES; neither ordinary
 * reads nor a copied upload can turn this pending descriptor into inventory.
 * Only the original post-thermal input triple can claim these residuals.
 */
export function prepareSphAerosolCondensateTransition(candidate, {
  device, transaction, generation, sphParticleUpload, mlsMpmParticleUpload,
  sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer
} = {}) {
  const record = EXTRACTIONS.get(candidate);
  requirePendingCondensateSource(record);
  const { context, source, declaration } = record;
  if (record.transition != null || record.transitionPreparing || device !== record.device
      || transaction !== context.transaction || generation !== context.generation
      || sphParticleUpload !== context.sphParticleUpload || mlsMpmParticleUpload !== context.mlsMpmParticleUpload
      || sourceStateBuffer !== record.sourceStateBuffer || sourceThermoBuffer !== record.sourceThermoBuffer
      || sourceMechanicsBuffer !== record.sourceMechanicsBuffer) {
    throw new TypeError('Condensate transition must reserve the exact original source tuple once');
  }
  return prepareCondensateTransitionForRecord(record);
}

/** Reserve an existing exact aerosol population from the genuine completed
 * exchange producer. This uses the same source claim and outer publication
 * window as extraction. The prospective family remains unreadable until both
 * its carrier/history counterpart and this aerosol are actually committed.
 */
export async function prepareSphAerosolVaporTransition({ device, producerRead } = {}) {
  const { forkSphSpatialVaporAerosolProducerRead: fork,
    resolveSphSpatialVaporAerosolProducerRead: resolve,
    releaseSphSpatialVaporAerosolProducerRead: release } = await import('./sphSpatialGasLedgerEosGpu.js');
  const held = fork(producerRead, { device });
  let retainedRead = null, source = null, sourceClaim = null, reservation = null, submitted = false;
  let dropped = false, resolveCleanup;
  const outputs = [], cleanupCompletion = new Promise(resolve => { resolveCleanup = resolve; });
  const dropSource = () => {
    if (dropped) return;
    dropped = true;
    if (reservation && source.extractionPending === reservation) source.extractionPending = null;
    if (reservation && sourceClaim.pending === reservation) sourceClaim.pending = null;
    if (retainedRead) releaseSphAerosolParcelRead(retainedRead);
    release(held); resolveCleanup(true);
  };
  const dispose = () => {
    const cleanup = () => { destroy(outputs); dropSource(); };
    if (submitted) afterQueue(device, cleanup, () => { source.quarantined = true; }); else cleanup();
  };
  try {
    const producer = resolve(held, { device }), packet = producer.sourcePacket;
    const sourceFamily = packet.aerosolFamily;
    retainedRead = forkSphAerosolParcelRead(packet.aerosolRead, {
      device, family: sourceFamily, expectedGeneration: packet.aerosolRead?.generation });
    source = PARCEL_READS.get(retainedRead).source;
    const { sourceTransaction: transaction, sourceGeneration: generation,
      originalSphParticleUpload: sphParticleUpload, originalMlsMpmParticleUpload: mlsMpmParticleUpload } = packet;
    const validateSource = () => {
      if (!validateSphAerosolParcelRead(retainedRead, { device, family: sourceFamily,
        expectedGeneration: source.generation })) throw new TypeError('Exact vapor transition lost its original aerosol read');
    };
    const context = { transaction, generation, sphParticleUpload, mlsMpmParticleUpload,
      count: producer.particleCount, topologyEpoch: packet.epochIdentity.topologyEpoch,
      validate() {
        if (resolve(held, { device }) !== producer || generation.releaseScheduled === true
            || generation.execution?.released === true
            || ['aborted', 'released', 'release-scheduled', 'release-blocked'].includes(transaction.state)
            || !validateSchroederSpatialEpochTransactionSourceFamily(transaction,
              { generation, sphParticleUpload, mlsMpmParticleUpload })
            || sphAerosolSourceFamily(sphParticleUpload) !== sourceFamily) {
          throw new TypeError('Exact vapor transition requires the original current closure transaction');
        }
        validateSource();
      } };
    context.validate();
    if (!source.exactQuantities || source.exactQuantities.format !== producer.format
        || producer.endpoints.aerosolLayout !== source.exactQuantities.quantityLayout
        || producer.endpoints.aerosolBuffer.size !== source.exactQuantities.quantityBuffer.size
        || producer.parcelBuffer.size !== source.buffer.size || source.generation === 0xffffffff
        || source.extractionPending || source.successorAdopted) {
      throw new TypeError('Exact vapor transition requires the complete unused original population');
    }
    sourceClaim = EXTRACTION_SOURCE_CLAIMS.get(generation) ?? { pending: null, adopted: false };
    if (sourceClaim.pending || sourceClaim.adopted) throw new TypeError('Aerosol source generation already reserved or consumed');
    reservation = {};
    sourceClaim.pending = reservation; source.extractionPending = reservation;
    EXTRACTION_SOURCE_CLAIMS.set(generation, sourceClaim);
    const parcels = allocate(device, outputs, 'ulg-aerosol-vapor-successor', source.buffer.size, STORAGE | COPY_SRC | COPY_DST);
    const quantities = allocate(device, outputs, 'ulg-aerosol-vapor-successor-quantities',
      source.exactQuantities.quantityBuffer.size, STORAGE | COPY_SRC | COPY_DST);
    markSphExactMassDerivedBuffers(producer.sourceParticleRead, [parcels, quantities]);
    context.validate();
    const encoder = device.createCommandEncoder({ label: 'ulg-aerosol-vapor-successor' });
    encoder.copyBufferToBuffer(producer.parcelBuffer, 0, parcels, 0, parcels.size);
    encoder.copyBufferToBuffer(producer.endpoints.aerosolBuffer, 0, quantities, 0, quantities.size);
    submitted = true; device.queue.submit([encoder.finish()]);
    context.validate();
    const record = { device, source, sourceFamily, context, sourceClaim, reservation, outputs,
      kind: 'vapor-exchange', producer, state: producer.stateBuffer, thermo: producer.thermoBuffer,
      mechanics: producer.mechanicsBuffer, parcels, disposition: 'prepared', transition: null,
      massSource: 'paired-current-vapor-aerosol-exchange',
      energyScope: 'stored-internal-plus-translational-kinetic-plus-linear-surface',
      declaration: { capacity: source.capacity, population: source.population,
        ids: source.ids, nucleusIds: source.nucleusIds, provenance: sourceFamily.provenance },
      exactQuantities: Object.freeze({ format: producer.format, quantityBuffer: quantities,
        quantityLayout: producer.endpoints.aerosolLayout }),
      validateSource, dropSource, dispose, cleanupCompletion };
    watchSphDeviceLossFor(device, record, handleVaporTransitionRecordLost);
    return prepareCondensateTransitionForRecord(record);
  } catch (error) {
    dispose();
    Object.defineProperty(error, 'exactVaporTransitionCleanupCompletion', { value: cleanupCompletion, configurable: true });
    throw error;
  }
}

function prepareCondensateTransitionForRecord(record) {
  requirePendingCondensateSource(record);
  const { device, context, source, declaration } = record;
  const energyScope = record.energyScope ?? ENERGY_SCOPE;
  const family = Object.freeze({ schema: ULG_SPH_AEROSOL_PARCEL_SCHEMA,
    status: 'outer-condensate-inventory-descriptor', familyId: nextFamilyId++,
    capacity: declaration.capacity, generation: source.generation + 1,
    provenance: declaration.provenance, massSource: record.massSource ?? 'paired-pre-transfer-carrier-debit',
    exactMassFormat: record.exactQuantities?.format ?? null,
    energyScope, fullPhysicsValidation: false });
  const child = { device, buffer: record.parcels, resources: [], capacity: declaration.capacity,
    generation: family.generation, population: declaration.population, ids: declaration.ids,
    exactQuantities: record.exactQuantities ?? null,
    nucleusIds: declaration.nucleusIds, extractionPending: null, successorAdopted: false,
    releaseRequested: false, retirementScheduled: false, borrows: 0, lost: false, quarantined: false };
  const pending = { record, child, family, read: null, transition: null, disposition: 'pending', finalizing: false,
    parcelResources: [record.parcels, record.exactQuantities?.quantityBuffer].filter(Boolean),
    residualResources: record.kind === 'vapor-exchange' ? [] : [record.state, record.thermo, record.mechanics],
    residualsRetired: false };
  record.transitionPreparing = true;
  try {
    // Register every child/read loss handler before reserving the transition.
    // Until publication, the extraction alone owns all four output buffers.
    watchSphDeviceLossFor(device, pending, handlePendingCondensateTransitionLost);
    pending.read = mintParcelRead(child, family);
    requirePendingCondensateSource(record);
    const transition = Object.freeze({ schema: 'peercompute.ulg.sph-aerosol-condensate-transition.v0',
      status: 'paired-condensate-outer-publication-reservation', particleCount: context.count,
      stateBuffer: record.state, thermoBuffer: record.thermo, mechanicsBuffer: record.mechanics,
      aerosolFamily: family, sourceAerosolFamily: record.sourceFamily,
      sourceTopologyEpoch: context.topologyEpoch, energyScope,
      ...(record.cleanupCompletion ? { cleanupCompletion: record.cleanupCompletion } : {}),
      gasVolumeAuthority: false, opticalAuthority: false, fullPhysicsValidation: false });
    pending.transition = transition;
    CONDENSATE_TRANSITIONS.set(transition, pending);
    if (record.kind !== 'vapor-exchange') {
      CONDENSATE_RESIDUAL_TRANSITIONS.set(record.state, transition);
      CONDENSATE_RESIDUAL_TRANSITIONS.set(record.thermo, transition);
    }
    record.transition = transition;
    return transition;
  } catch (error) {
    // The staged read has never escaped or submitted any work. Retiring that
    // empty child synchronously must not release the still-retryable candidate.
    if (pending.read != null) drainParcelRead(PARCEL_READS.get(pending.read));
    throw error;
  } finally { record.transitionPreparing = false; }
}

export function validateSphAerosolCondensateTransition(transition, input = {}) {
  try {
    const { device, transaction, generation, sourceFamily, nextFamily } = input ?? {};
    const pending = CONDENSATE_TRANSITIONS.get(transition);
    if (!pending || pending.transition !== transition || pending.disposition !== 'pending'
        || pending.child.lost || pending.child.quarantined
        || pending.record.transition !== transition || pending.record.device !== device
        || pending.record.context.transaction !== transaction || pending.record.context.generation !== generation
        || pending.record.sourceFamily !== sourceFamily || pending.family !== nextFamily) return false;
    requirePendingCondensateSource(pending.record);
    return true;
  } catch { return false; }
}

/** Cold donor addresses only, never material/mass readback or new inventory.
 * The completed extraction has already checked each donor's exact post-reaction
 * S/T/M and removed ALL its liquid component. Optical capture may exclude that
 * same component from both reaction sums, reading its material from the bound
 * GPU thermo input. A caller-supplied list or copied reservation is not proof.
 */
export function resolveSphAerosolCondensateOpticalExclusion(transition, {
  device, phaseCarrierPlan, particleLineage, postReactionStateBuffer,
  postReactionThermoBuffer, preTransferStateBuffer, preTransferThermoBuffer
} = {}) {
  const stateTransition = CONDENSATE_RESIDUAL_TRANSITIONS.get(preTransferStateBuffer);
  const thermoTransition = CONDENSATE_RESIDUAL_TRANSITIONS.get(preTransferThermoBuffer);
  if (transition == null && stateTransition == null && thermoTransition == null) return null;
  const pending = CONDENSATE_TRANSITIONS.get(transition);
  if (!pending || pending.disposition !== 'pending' || pending.transition !== transition
      || pending.child.lost || pending.child.quarantined
      || stateTransition !== transition || thermoTransition !== transition) {
    throw new TypeError('Condensate optical exclusion requires the exact pending transition, not an omitted or copied token');
  }
  const { record } = pending;
  requirePendingCondensateSource(record);
  const { context } = record;
  if (device !== record.device || phaseCarrierPlan !== context.sphParticleUpload.phaseCarrierPlan
      || particleLineage?.particleCount !== context.count
      || particleLineage?.topologyEpoch !== context.topologyEpoch
      || typeof context.opticalIdentityRevision !== 'string' || context.opticalIdentityRevision.length === 0
      || context.sphParticleUpload.identityBuffer !== context.opticalIdentityBuffer
      || context.sphParticleUpload.identityRevision !== context.opticalIdentityRevision
      || particleLineage?.identityBuffer !== context.opticalIdentityBuffer
      || particleLineage?.identityRevision !== context.opticalIdentityRevision
      || postReactionStateBuffer !== record.sourceStateBuffer
      || postReactionThermoBuffer !== record.sourceThermoBuffer
      || preTransferStateBuffer !== record.state || preTransferThermoBuffer !== record.thermo) {
    throw new TypeError('Condensate optical exclusion requires exact source, residual and particle lineage identities');
  }
  return record.declaration.lineages;
}

export function discardSphAerosolCondensateTransition(transition) {
  const pending = CONDENSATE_TRANSITIONS.get(transition);
  if (!pending) throw new TypeError('Condensate transition retirement requires the exact reservation');
  if (pending.disposition !== 'pending') return false;
  pending.disposition = 'discarded';
  pending.record.disposition = 'discarded';
  // This unadmitted read was never available to a GPU consumer. The residual
  // buffers may have been consumed by phase transfer, so their owner still
  // retires ALL candidate outputs behind the current queue fence.
  drainParcelRead(PARCEL_READS.get(pending.read));
  pending.record.dispose();
  return true;
}

function retireCondensateTransitionResiduals(pending) {
  if (pending.residualsRetired || pending.disposition !== 'published') return;
  pending.residualsRetired = true;
  try { destroy(pending.residualResources); }
  finally { pending.record.dropSource(); }
}

/** Called only in the authentic successor owner's synchronous publication
 * window, AFTER the real carrier commit. Failed authority never consumes a
 * claim. All fallible fence setup precedes the adjacent private state writes;
 * no callback, GPU operation or disposal runs in the activated-state section.
 * The caller owns BOTH the returned read and the new ordinary family owner.
 */
export function finalizeSphAerosolCondensateTransition(transition, input = {}) {
  let guarded = null;
  try {
    const pending = CONDENSATE_TRANSITIONS.get(transition);
    if (!pending || pending.finalizing) return null;
    // A queue implementation (or even an input getter) can call back into us.
    // Guard before all caller-controlled access, without consuming any claim.
    pending.finalizing = true;
    guarded = pending;
    const { plan, commitReceipt } = input ?? {};
    const { record, family, child } = pending;
    const expected = { device: record.device, transaction: record.context.transaction,
      generation: record.context.generation, sourceFamily: record.sourceFamily, nextFamily: family };
    if (!validateSphAerosolCondensateTransition(transition, expected)
        || !validateSchroederSpatialAerosolPublicationWindow({ plan, transition, commitReceipt })) return null;
    // Phase transfer has already read the residual triple. Capture THAT queue
    // prefix, not the earlier extraction/map fence. Confirmed loss has its own
    // preinstalled cleanup; an unconfirmed fence only quarantines ownership.
    const quarantine = () => { child.quarantined = true; record.source.quarantined = true; };
    try {
      Promise.resolve(record.device.queue.onSubmittedWorkDone()).then(
        () => retireCondensateTransitionResiduals(pending), quarantine);
    } catch { quarantine(); return null; }
    if (!validateSphAerosolCondensateTransition(transition, expected)
        || !validateSchroederSpatialAerosolPublicationWindow({ plan, transition, commitReceipt })) return null;

    child.resources = pending.parcelResources;
    FAMILIES.set(family, child);
    pending.disposition = 'published';
    record.disposition = 'published';
    record.source.successorAdopted = true;
    record.sourceClaim.adopted = true;
    record.outputs.length = 0;
    return pending.read;
  } catch { return null; }
  finally { if (guarded) guarded.finalizing = false; }
}

function requireFamily(family, device) {
  const record = FAMILIES.get(family);
  if (!record || record.device !== device || record.releaseRequested || record.lost || record.quarantined) {
    throw new TypeError('Aerosol budget requires an exact live same-device family');
  }
  return record;
}

export function sphAerosolParcelFamilyMatchesDevice(family, device) {
  try { requireFamily(family, device); return true; } catch { return false; }
}

/** Internal GPU consumer borrow. It does not transfer ownership or admit a
 * parcel family to SS. A family release forbids NEW borrows, but an existing
 * read keeps its exact buffer alive until the consumer's submitted work ends.
 */
export function acquireSphAerosolParcelRead({ family, device, expectedGeneration } = {}) {
  const source = requireFamily(family, device);
  if (expectedGeneration !== source.generation) throw new TypeError('Aerosol read generation mismatch');
  return mintParcelRead(source, family);
}

/** A retained owner may delegate its exact live read after the original family
 * owner requested release. This is not a new unowned-family admission: the
 * parent capability, device, and generation must all still authenticate.
 */
export function forkSphAerosolParcelRead(read, input = {}) {
  if (!validateSphAerosolParcelRead(read, input)) {
    throw new TypeError('Aerosol read fork requires the exact live parent capability');
  }
  return mintParcelRead(PARCEL_READS.get(read).source, read.family);
}

function mintParcelRead(source, family) {
  const read = Object.freeze({ family, buffer: source.buffer, capacity: source.capacity,
    familyId: family.familyId, generation: source.generation, exactQuantities: source.exactQuantities ?? null });
  const record = { source, read, released: false, drained: false };
  PARCEL_READS.set(read, record);
  source.borrows++;
  try {
    if (!watchSphDeviceLossFor(source.device, record, drainParcelRead)) {
      throw new TypeError('Aerosol parcel read requires a WebGPU device with a lost promise');
    }
  }
  catch (error) {
    PARCEL_READS.delete(read);
    if (!record.drained) { record.drained = true; source.borrows--; }
    throw error;
  }
  return read;
}

function drainParcelRead(record) {
  if (record.drained) return;
  record.drained = true;
  record.released = true;
  record.source.borrows--;
  retireFamily(record.source);
}

export function validateSphAerosolParcelRead(read, { family, device, expectedGeneration } = {}) {
  const record = PARCEL_READS.get(read);
  return Boolean(record && record.read === read && !record.released
    && !record.source.lost && !record.source.quarantined
    && record.source.device === device && read.family === family
    && read.generation === expectedGeneration && read.buffer === record.source.buffer
    && read.exactQuantities === (record.source.exactQuantities ?? null)
    && FAMILIES.get(family) === record.source);
}

export function releaseSphAerosolParcelRead(read) {
  const record = PARCEL_READS.get(read);
  if (!record) throw new TypeError('Aerosol read retirement requires the exact capability');
  if (record.released) return false;
  record.released = true;
  if (record.source.lost) drainParcelRead(record);
  else afterQueue(record.source.device, () => drainParcelRead(record), () => {
    record.source.quarantined = true;
  });
  return true;
}

function requireCarrierBuffer(buffer, size, device, name) {
  if (!buffer || !Number.isSafeInteger(buffer.size) || buffer.size < Math.max(16, size)
      || (buffer.usage & STORAGE) !== STORAGE || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${name} requires a sufficiently sized same-device storage buffer`);
  }
}

function decodeEndpoint(values, offset, family, particleCount) {
  const words = new Uint32Array(values.buffer, values.byteOffset + offset * 4, SPH_AEROSOL_BUDGET_WORDS);
  if (words[34] !== 0 || words[35] !== SPH_AEROSOL_BUDGET_MAGIC
      || words[36] !== SPH_AEROSOL_BUDGET_VERSION || words[37] !== family.capacity
      || words[38] !== particleCount || words[39] !== family.generation) {
    throw new Error(`Invalid combined aerosol budget authority (error bits ${words[34]})`);
  }
  const f = values.subarray(offset, offset + SPH_AEROSOL_BUDGET_WORDS);
  for (let i = 0; i <= 29; i++) {
    if (!Number.isFinite(f[i])) throw new Error('Nonfinite combined aerosol budget');
  }
  return Object.freeze({ massKg: f[0], phaseMassKg: Object.freeze({ solid: f[1], liquid: f[2], gas: f[3], plasma: f[4] }),
    momentumKgMPerS: Object.freeze([...f.slice(5, 8)]), internalEnergyJ: f[8],
    translationalKineticEnergyJ: f[9], internalPlusTranslationalKineticEnergyJ: f[10],
    aerosolMassKg: f[11], firstMomentKgM: Object.freeze([...f.slice(12, 15)]), temperatureMassKgK: f[15],
    positionMinM: Object.freeze([...f.slice(16, 19)]), positionMaxM: Object.freeze([...f.slice(19, 22)]),
    minTemperatureK: f[22], maxTemperatureK: f[23], maxSpeedMPerS: f[24],
    aerosolCondensedVolumeM3: f[25], aerosolGeometricCrossSectionM2: f[26],
    minDropletRadiusM: f[27], maxDropletRadiusM: f[28],
    carrierCount: words[30], parcelCount: words[31],
    physicalMultiplicity: ((BigInt(words[33]) << 32n) | BigInt(words[32])).toString(),
    familyId: family.familyId, generation: family.generation });
}

/** Append both endpoint reductions to the caller's existing submission/readback.
 * No particle readback, hidden host solver, source mutation, or extra submit.
 */
export function createSphAerosolCombinedBudgetStage({ device, sourceFamily, terminalFamily,
  sourceStateBuffer, sourceThermoBuffer, terminalStateBuffer, terminalThermoBuffer, particleCount } = {}) {
  requireDevice(device);
  uint(particleCount, 'carrier count', 0xffffff);
  const source = requireFamily(sourceFamily, device), terminal = requireFamily(terminalFamily, device);
  for (const [buffer, stride, name] of [[sourceStateBuffer, 32, 'source state'],
    [sourceThermoBuffer, 48, 'source thermo'], [terminalStateBuffer, 32, 'terminal state'],
    [terminalThermoBuffer, 48, 'terminal thermo']]) {
    requireCarrierBuffer(buffer, particleCount * stride, device, name);
  }
  const borrowed = [...new Set([source, terminal])];
  borrowed.forEach((record) => { record.borrows++; });
  const resources = [];
  let disposed = false, encoded = false, submissionStarted = false;
  let dependentCleanup = null;
  const cleanup = () => {
    try { dependentCleanup?.(); }
    finally {
      destroy(resources);
      borrowed.forEach((record) => { record.borrows--; retireFamily(record); });
    }
  };
  const dispose = (afterReads = null) => {
    if (disposed) return false;
    if (afterReads !== null && typeof afterReads !== 'function') throw new TypeError('Aerosol dependent cleanup must be a function');
    dependentCleanup = afterReads;
    disposed = true;
    if (submissionStarted) afterQueue(device, cleanup, () => {
      borrowed.forEach((record) => { record.quarantined = true; });
    });
    else cleanup();
    return true;
  };
  try {
    const partialInfo = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-aerosol-inventory-partials.v0', label: 'ulg-aerosol-inventory-partials',
      code: sphAerosolInventoryPartialsWgsl, entryPoint: 'inventory_partials',
      bindings: [computeBufferBinding(0, 'read-only-storage'), computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'), computeBufferBinding(3, 'storage'), computeBufferBinding(4, 'uniform')]
    });
    const finalInfo = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-aerosol-inventory-finalize.v0', label: 'ulg-aerosol-inventory-finalize',
      code: sphAerosolInventoryFinalizeWgsl, entryPoint: 'inventory_finalize',
      bindings: [computeBufferBinding(0, 'read-only-storage'), computeBufferBinding(1, 'storage'), computeBufferBinding(2, 'uniform')]
    });
    const endpoints = [[source, sourceStateBuffer, sourceThermoBuffer], [terminal, terminalStateBuffer, terminalThermoBuffer]]
      .map(([record, state, thermo], index) => {
        const count = Math.max(1, Math.ceil(Math.max(particleCount, record.capacity) / 32));
        const dispatch = linearDispatch(count, device);
        const params = allocate(device, resources, `ulg-aerosol-budget-params-${index}`, 16, UNIFORM | COPY_DST);
        const partials = allocate(device, resources, `ulg-aerosol-budget-partials-${index}`, count * SPH_AEROSOL_BUDGET_BYTES, STORAGE);
        const output = allocate(device, resources, `ulg-aerosol-budget-${index}`, SPH_AEROSOL_BUDGET_BYTES, STORAGE | COPY_SRC);
        device.queue.writeBuffer(params, 0, new Uint32Array([particleCount, record.capacity, count, record.generation]));
        const bind = (layout, buffers) => device.createBindGroup({ layout,
          entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
        return { count, dispatch, output,
          partialGroup: bind(partialInfo.bindGroupLayout, [state, thermo, record.buffer, partials, params]),
          finalGroup: bind(finalInfo.bindGroupLayout, [partials, output, params]) };
      });
    return Object.freeze({
      byteLength: 2 * SPH_AEROSOL_BUDGET_BYTES, dispatchCount: 4,
      workgroupCount: endpoints.reduce((sum, endpoint) => sum + endpoint.dispatch.count + 1, 0),
      encode(encoder, { copyTargetBuffer, copyTargetOffsetBytes = 0 } = {}) {
        if (disposed || encoded || borrowed.some((record) => record.lost || record.quarantined)) throw new Error('Aerosol budget stage is retired or already encoded');
        if (!copyTargetBuffer || copyTargetOffsetBytes % 4 !== 0 || copyTargetOffsetBytes < 0
            || copyTargetBuffer.size < copyTargetOffsetBytes + 2 * SPH_AEROSOL_BUDGET_BYTES
            || !(copyTargetBuffer.usage & COPY_DST)) throw new TypeError('Aerosol budget copy target is invalid');
        encoded = true;
        endpoints.forEach((endpoint, index) => {
          const pass = encoder.beginComputePass();
          pass.setPipeline(partialInfo.pipeline); pass.setBindGroup(0, endpoint.partialGroup);
          pass.dispatchWorkgroups(endpoint.dispatch.x, endpoint.dispatch.y); pass.end();
          const final = encoder.beginComputePass();
          final.setPipeline(finalInfo.pipeline); final.setBindGroup(0, endpoint.finalGroup);
          final.dispatchWorkgroups(1); final.end();
          encoder.copyBufferToBuffer(endpoint.output, 0, copyTargetBuffer,
            copyTargetOffsetBytes + index * SPH_AEROSOL_BUDGET_BYTES, SPH_AEROSOL_BUDGET_BYTES);
        });
      },
      markSubmissionStarted() {
        if (!encoded || disposed || submissionStarted) throw new Error('Aerosol budget submission order is invalid');
        submissionStarted = true;
      },
      decode(values, offsetWords = 0) {
        if (!(values instanceof Float32Array) || !Number.isSafeInteger(offsetWords) || offsetWords < 0
            || values.length < offsetWords + 2 * SPH_AEROSOL_BUDGET_WORDS || !submissionStarted
            || disposed || borrowed.some((record) => record.lost || record.quarantined)) throw new TypeError('Aerosol budget observation is not live');
        return Object.freeze({ schema: ULG_SPH_AEROSOL_BUDGET_SCHEMA,
          status: 'combined-carrier-aerosol-budget-ready', energyScope: ENERGY_SCOPE,
          source: decodeEndpoint(values, offsetWords, sourceFamily, particleCount),
          terminal: decodeEndpoint(values, offsetWords + SPH_AEROSOL_BUDGET_WORDS, terminalFamily, particleCount),
          fullPhysicsValidation: false });
      },
      dispose
    });
  } catch (error) { dispose(); throw error; }
}

export function mergeSphAerosolInventoryIntoResidentSummary(summary, inventory) {
  const { source, terminal } = inventory;
  const center = (endpoint) => endpoint.firstMomentKgM.map((value) => endpoint.massKg > 0 ? value / endpoint.massKg : 0);
  const sourceCenter = center(source), nextCenter = center(terminal);
  const bounds = (endpoint) => ({ status: endpoint.massKg > 0 ? 'position-bounds-ready' : 'position-bounds-empty',
    min: [...endpoint.positionMinM], max: [...endpoint.positionMaxM], massKg: endpoint.massKg });
  const carrierFields = ['status', 'sourceMassKg', 'nextMassKg', 'massDeltaKg', 'phaseMassKg', 'phaseMassTotalKg',
    'sourceMomentumKgMPerS', 'nextMomentumKgMPerS', 'momentumDeltaKgMPerS',
    'sourceCenterOfMassM', 'nextCenterOfMassM', 'centerOfMassDeltaM', 'sourcePositionBoundsM', 'nextPositionBoundsM',
    'temperatureMassWeightedMeanK', 'minTemperatureK', 'maxTemperatureK', 'maxSpeedMPerS',
    'thermalSummaryStatus', 'thermalPhaseSummaryAvailable'];
  return { ...summary, inventoryScope: 'carriers-and-independent-aerosol-parcels',
    carrierOnlyInventory: Object.fromEntries(carrierFields.map((field) => [field, summary[field]])),
    cohortInventoryScope: 'bulk-carrier-lineages-only', thermalCountScope: 'bulk-carriers-only',
    mechanicsDiagnosticScope: 'bulk-carriers-only-including-displacement-and-J',
    particleCountScope: 'bulk-carrier-capacity-not-physical-droplet-population',
    status: terminal.massKg > 0 ? 'compact-summary-ready' : 'compact-summary-empty',
    thermalSummaryStatus: terminal.massKg > 0 ? 'thermal-phase-summary-ready' : 'thermal-phase-summary-empty',
    thermalPhaseSummaryAvailable: terminal.massKg > 0,
    combinedInventory: inventory, sourceMassKg: source.massKg, nextMassKg: terminal.massKg,
    massDeltaKg: terminal.massKg - source.massKg, phaseMassKg: { ...terminal.phaseMassKg },
    phaseMassTotalKg: Object.values(terminal.phaseMassKg).reduce((sum, value) => sum + value, 0),
    sourceMomentumKgMPerS: [...source.momentumKgMPerS], nextMomentumKgMPerS: [...terminal.momentumKgMPerS],
    momentumDeltaKgMPerS: terminal.momentumKgMPerS.map((value, axis) => value - source.momentumKgMPerS[axis]),
    sourceCenterOfMassM: sourceCenter, nextCenterOfMassM: nextCenter,
    centerOfMassDeltaM: nextCenter.map((value, axis) => value - sourceCenter[axis]),
    sourcePositionBoundsM: bounds(source), nextPositionBoundsM: bounds(terminal),
    temperatureMassWeightedMeanK: terminal.massKg > 0 ? terminal.temperatureMassKgK / terminal.massKg : 0,
    minTemperatureK: terminal.minTemperatureK, maxTemperatureK: terminal.maxTemperatureK,
    maxSpeedMPerS: terminal.maxSpeedMPerS, aerosolParcelCount: terminal.parcelCount,
    internalPlusTranslationalKineticEnergyDeltaJ:
      terminal.internalPlusTranslationalKineticEnergyJ - source.internalPlusTranslationalKineticEnergyJ };
}
