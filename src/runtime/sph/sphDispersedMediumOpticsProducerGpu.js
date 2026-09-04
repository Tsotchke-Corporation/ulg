import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  deriveSphDispersedMediumOpticalMoments,
  validateSphDispersedMediumOpticalClosureTable
} from './sphDispersedMediumOpticalClosure.js';
import {
  SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY
} from '../material/opticalClosure.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createQueueOrderedCleanupClaimIssuer,
  submitQueueOrderedProducerWorkAndCleanup
} from '../webgpuComputeLayout.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferDevice
} from './sphGpuDeviceIdentity.js';
import { createGpuReadbackTelemetry } from './sphGpuReadbackTelemetry.js';
import {
  beginSphDispersedMediumGpuBufferBorrow,
  snapshotSphDispersedMediumGpuBufferDeclaration,
  sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches,
  validateSphDispersedMediumGpuBufferAuthority
} from './sphDispersedMediumGpuBuffers.js';
import {
  beginSphDispersedMediumOpticalClosureGpuTableBorrow,
  resolveSphDispersedMediumOpticalClosureGpuTable,
  snapshotSphDispersedMediumOpticalClosureTable
} from './sphDispersedMediumOpticalClosureGpuBuffers.js';

export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-producer.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ENCODER_STAGE_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-producer-encoder-stage.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_CLAIM_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-producer-adoption-claim.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_RECEIPT_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-producer-adoption-receipt.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_TRANSACTION_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-producer-adoption-transaction.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_TOPOLOGY_REBASE_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-producer-topology-rebase.v0';
export const SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_DECLARATION_MODE =
  Object.freeze({
    staticRows: 'static-row-prefixes-v0',
    dynamicRouteCatalog: 'gpu-dynamic-route-catalog-v0'
  });
export const SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_VERSION = 0;
export const SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_WORKGROUP_SIZE = 64;
export const SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_EVIDENCE_WORDS = 16;
export const SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_KERNEL_REVISION =
  'four-lane-reaction-birth-conserved-condensate-ledger-optical-moments-v1';

const REQUIRED_PHASE_CARRIER_PLAN_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-plan.v2';
const REQUIRED_PHASE_LANE_COUNT = 4;
const REQUIRED_STABLE_LANE_ADDRESS =
  'phaseLane*phaseLaneStride+lineageIndex';
const STATE_ROW_FLOATS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
const THERMO_ROW_FLOATS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const PARAMS_BYTES = 64;
const EVIDENCE_BYTES =
  SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_EVIDENCE_WORDS
  * Uint32Array.BYTES_PER_ELEMENT;
const EVIDENCE_MAGIC = 0x444d4f50;
const EVIDENCE_VERSION = 1;
const EXACT_F32_INTEGER_MAX = 0x00ff_ffff;
const PHASE_FRACTION_TOLERANCE = Math.fround(1e-5);
const MASS_EPSILON_KG = Math.fround(1e-20);

// A public descriptor is deliberately insufficient to transfer ownership of a
// GPU-produced sidecar. These private records bind the exact producer result,
// device, allocation, and full declaration snapshot to one opaque claim and
// its one successful adoption receipt.
const producerOutputAdoptionRecords = new WeakMap();
const producerAdoptionClaimRecords = new WeakMap();
const producerAdoptionReceiptRecords = new WeakMap();
const producerTopologyRebaseRecords = new WeakMap();
const producerSubmittedWorkCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'sph-dispersed-medium-optics-producer-submitted-work'
  });

function producerAdoptionAuthorityError(message) {
  const error = new Error(message);
  error.code =
    'ERR_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_UNAUTHORIZED';
  return error;
}

const GPU_BUFFER_USAGE = Object.freeze({
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
});

function exactPositiveInteger(value, label, maximum = 0xffff_ffff) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number <= 0
    || number > maximum
  ) {
    throw new RangeError(`${label} must be an exact positive integer`);
  }
  return number;
}

function exactF32Identifier(value, label) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number <= 0
    || number > EXACT_F32_INTEGER_MAX
    || Math.fround(number) !== number
  ) {
    throw new RangeError(`${label} must be a positive exact-f32 integer`);
  }
  return number;
}

function exactNonnegativeF32Identifier(value, label) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number < 0
    || number > EXACT_F32_INTEGER_MAX
    || Math.fround(number) !== number
  ) {
    throw new RangeError(`${label} must be a non-negative exact-f32 integer`);
  }
  return number;
}

function checkedByteLength(rowCount, rowFloats, label) {
  const count = exactPositiveInteger(rowCount, `${label} row count`);
  const floats = exactPositiveInteger(rowFloats, `${label} row stride`);
  const valueCount = count * floats;
  const byteLength = valueCount * FLOAT_BYTES;
  if (
    !Number.isSafeInteger(valueCount)
    || valueCount > 0xffff_ffff
    || !Number.isSafeInteger(byteLength)
  ) {
    throw new RangeError(`${label} byte length exceeds the addressable GPU range`);
  }
  return byteLength;
}

function validateFourLanePlan(phaseCarrierPlan, particleCount = null) {
  const lineageCapacity = Number(phaseCarrierPlan?.lineageCapacity);
  const resolvedParticleCount = Number(
    particleCount ?? phaseCarrierPlan?.particleCapacity
  );
  const accepted = phaseCarrierPlan?.schema
      === REQUIRED_PHASE_CARRIER_PLAN_SCHEMA
    && phaseCarrierPlan.status === 'phase-lane-capacity-ready'
    && Number.isSafeInteger(lineageCapacity)
    && lineageCapacity > 0
    && Number(phaseCarrierPlan.primaryCapacity) === lineageCapacity
    && Number(phaseCarrierPlan.phaseLaneCount)
      === REQUIRED_PHASE_LANE_COUNT
    && Number(phaseCarrierPlan.phaseLaneStride) === lineageCapacity
    && Number(phaseCarrierPlan.companionStart) === lineageCapacity
    && Number(phaseCarrierPlan.companionCapacity)
      === lineageCapacity * (REQUIRED_PHASE_LANE_COUNT - 1)
    && Number(phaseCarrierPlan.particleCapacity)
      === lineageCapacity * REQUIRED_PHASE_LANE_COUNT
    && resolvedParticleCount === phaseCarrierPlan.particleCapacity
    && phaseCarrierPlan.stableLaneAddress
      === REQUIRED_STABLE_LANE_ADDRESS
    && phaseCarrierPlan.phaseCompanionLanesRequired === true;
  if (!accepted) {
    throw new RangeError(
      'Dispersed-medium optics production requires the exact fixed four-lane phase-carrier plan'
    );
  }
  return Object.freeze({
    particleCount: resolvedParticleCount,
    lineageCapacity,
    phaseLaneCount: REQUIRED_PHASE_LANE_COUNT,
    phaseLaneStride: lineageCapacity
  });
}

function exactObjectReference(value) {
  return Boolean(
    value !== null
    && (typeof value === 'object' || typeof value === 'function')
  );
}

function canonicalProducerParticleLineage(
  device,
  particleCount,
  particleLineage
) {
  const lineageParticleCount = Number(particleLineage?.particleCount);
  const topologyEpoch = Number(particleLineage?.topologyEpoch);
  const identityRevision = particleLineage?.identityRevision;
  const identityBuffer = particleLineage?.identityBuffer ?? null;
  if (
    lineageParticleCount !== particleCount
    || !Number.isSafeInteger(lineageParticleCount)
    || lineageParticleCount <= 0
    || !Number.isSafeInteger(topologyEpoch)
    || topologyEpoch < 0
    || topologyEpoch > 0xffff_ffff
    || typeof identityRevision !== 'string'
    || identityRevision.length === 0
    || !exactObjectReference(identityBuffer)
    || webGpuBufferDevice(identityBuffer) !== device
  ) {
    throw new TypeError(
      'Dispersed-medium optics production requires exact same-device particle lineage authority'
    );
  }
  return Object.freeze({
    particleCount: lineageParticleCount,
    topologyEpoch,
    identityRevision,
    identityBuffer
  });
}

function canonicalProducerParticleSourceFamily(
  device,
  particleCount,
  particleLineage,
  stateBuffer,
  thermoBuffer
) {
  const lineage = canonicalProducerParticleLineage(
    device,
    particleCount,
    particleLineage
  );
  if (
    !exactObjectReference(stateBuffer)
    || !exactObjectReference(thermoBuffer)
    || webGpuBufferDevice(stateBuffer) !== device
    || webGpuBufferDevice(thermoBuffer) !== device
  ) {
    throw new TypeError(
      'Dispersed-medium optics production requires exact same-device state and thermo source buffers'
    );
  }
  return Object.freeze({
    particleCount: lineage.particleCount,
    topologyEpoch: lineage.topologyEpoch,
    identityRevision: lineage.identityRevision,
    identityBuffer: lineage.identityBuffer,
    stateBuffer,
    thermoBuffer
  });
}

function exactProducerParticleSourceFamilyMatches(
  record,
  particleSourceFamily
) {
  let candidate;
  try {
    candidate = canonicalProducerParticleSourceFamily(
      record.device,
      record.postTransferParticleSourceFamily.particleCount,
      particleSourceFamily,
      particleSourceFamily?.stateBuffer,
      particleSourceFamily?.thermoBuffer
    );
  } catch {
    return false;
  }
  const expected = record.postTransferParticleSourceFamily;
  return Boolean(
    candidate.particleCount === expected.particleCount
    && candidate.topologyEpoch === expected.topologyEpoch
    && candidate.identityRevision === expected.identityRevision
    && candidate.identityBuffer === expected.identityBuffer
    && candidate.stateBuffer === expected.stateBuffer
    && candidate.thermoBuffer === expected.thermoBuffer
  );
}

function exactFloatRows(rows, expectedLength, label) {
  if (!(rows instanceof Float32Array)) {
    throw new TypeError(`${label} must be a Float32Array`);
  }
  if (rows.length !== expectedLength) {
    throw new RangeError(`${label} must exactly fill its dense row layout`);
  }
  return rows;
}

function decodedClosureRow(table, rowIndex) {
  const lanes = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES;
  const offset = rowIndex * SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS;
  return Object.freeze({
    rowIndex,
    dispersedMaterialId: table.rows[offset + lanes.dispersedMaterialId],
    vaporPhaseId: table.rows[offset + lanes.vaporPhaseId],
    condensedPhaseId: table.rows[offset + lanes.condensedPhaseId],
    opticalStateId: table.rows[offset + lanes.opticalStateId],
    morphologyModelId: table.rows[offset + lanes.morphologyModelId],
    status: table.rows[offset + lanes.status],
    condensedDensityKgPerM3:
      table.rows[offset + lanes.condensedDensityKgPerM3],
    scatteringEfficiencyQsca:
      table.rows[offset + lanes.scatteringEfficiencyQsca],
    absorptionEfficiencyQabs:
      table.rows[offset + lanes.absorptionEfficiencyQabs],
    asymmetryFactorG: table.rows[offset + lanes.asymmetryFactorG],
    effectiveRadiusM: table.rows[offset + lanes.effectiveRadiusM],
    relativeRefractiveIndexN:
      table.rows[offset + lanes.relativeRefractiveIndexN],
    relativeExtinctionCoefficientK:
      table.rows[offset + lanes.relativeExtinctionCoefficientK],
    largeSizeRayAsymmetryFactorG:
      table.rows[offset + lanes.largeSizeRayAsymmetryFactorG],
    referenceWavelengthM: table.rows[offset + lanes.referenceWavelengthM]
  });
}

function validateProducerClosureTable(table) {
  validateSphDispersedMediumOpticalClosureTable(table);
  if (table.rowCount <= 0) {
    throw new RangeError(
      'Dispersed-medium optics production requires at least one static closure route'
    );
  }
  const identityKeys = new Set();
  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = decodedClosureRow(table, rowIndex);
    for (const [name, value] of [
      ['vaporPhaseId', row.vaporPhaseId],
      ['condensedPhaseId', row.condensedPhaseId]
    ]) {
      const phaseId = exactF32Identifier(value, `closure row ${rowIndex} ${name}`);
      if (phaseId > REQUIRED_PHASE_LANE_COUNT) {
        throw new RangeError(
          `closure row ${rowIndex} ${name} is outside the fixed four-lane carrier`
        );
      }
    }
    if (row.status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready) {
      continue;
    }
    const identityKey = [
      row.dispersedMaterialId,
      row.condensedPhaseId,
      row.opticalStateId
    ].join('|');
    if (identityKeys.has(identityKey)) {
      throw new RangeError(
        `closure row ${rowIndex} aliases a producer-visible optical route`
      );
    }
    identityKeys.add(identityKey);
  }
  return true;
}

function exactClosureRouteCatalog(table) {
  const readyOpticalStateIds = Object.freeze(
    [...table.readyOpticalStateIds].sort((left, right) => left - right)
  );
  const words = new Uint32Array(
    table.rows.buffer,
    table.rows.byteOffset,
    table.rows.length
  );
  const routeCatalogSignature = [
    'f32-bits-v0',
    table.rowCount,
    ...Array.from(words, (word) => word.toString(16).padStart(8, '0'))
  ].join(':');
  return Object.freeze({
    eligibleOpticalStateIds: readyOpticalStateIds,
    eligibleOpticalStateRouteCount: readyOpticalStateIds.length,
    routeCatalogRowCount: table.rowCount,
    routeCatalogSignature
  });
}

function closureRowForOpticsPrefix(table, {
  dispersedMaterialId,
  dispersedPhaseId,
  opticalStateId
}) {
  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = decodedClosureRow(table, rowIndex);
    if (
      row.status === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready
      && row.dispersedMaterialId === dispersedMaterialId
      && row.condensedPhaseId === dispersedPhaseId
      && row.opticalStateId === opticalStateId
    ) {
      return row;
    }
  }
  return null;
}

function finiteNonnegativeF32(value, label) {
  const rounded = Math.fround(Number(value));
  if (!Number.isFinite(rounded) || rounded < 0) {
    throw new RangeError(`${label} must be a finite non-negative f32`);
  }
  return rounded;
}

function finiteF32(value, label) {
  const rounded = Math.fround(Number(value));
  if (!Number.isFinite(rounded)) {
    throw new RangeError(`${label} must be a finite f32`);
  }
  return rounded;
}

/**
 * Materialize the immutable dense declaration used by the first resident
 * producer step. Numeric material identities select already-built static
 * routes; every ready route is placed on its condensed phase lane, and every
 * other particle slot is a canonical blocked row. No thermodynamic state is
 * consulted and no dispersed mass is inferred.
 */
export function buildSphDispersedMediumOpticsProducerSeedRows({
  phaseCarrierPlan,
  lineageMaterialIds,
  opticalClosureTable
} = {}) {
  const topology = validateFourLanePlan(phaseCarrierPlan);
  validateProducerClosureTable(opticalClosureTable);
  exactFloatRows(
    lineageMaterialIds,
    topology.lineageCapacity,
    'dispersed-medium lineage material ids'
  );
  const rows = new Float32Array(
    topology.particleCount * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
  );
  for (let particleIndex = 0;
    particleIndex < topology.particleCount;
    particleIndex += 1) {
    rows[particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS + 3] =
      SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
  }
  const readyRoutesByMaterial = new Map();
  for (let rowIndex = 0; rowIndex < opticalClosureTable.rowCount; rowIndex += 1) {
    const route = decodedClosureRow(opticalClosureTable, rowIndex);
    if (route.status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready) {
      continue;
    }
    let routes = readyRoutesByMaterial.get(route.dispersedMaterialId);
    if (!routes) {
      routes = [];
      readyRoutesByMaterial.set(route.dispersedMaterialId, routes);
    }
    routes.push(route);
  }
  const routeDeclarations = [];
  for (let lineageIndex = 0;
    lineageIndex < topology.lineageCapacity;
    lineageIndex += 1) {
    const materialId = exactNonnegativeF32Identifier(
      lineageMaterialIds[lineageIndex],
      `lineageMaterialIds[${lineageIndex}]`
    );
    const claimedCondensedPhases = new Set();
    for (const route of readyRoutesByMaterial.get(materialId) ?? []) {
      if (claimedCondensedPhases.has(route.condensedPhaseId)) {
        throw new RangeError(
          `lineage ${lineageIndex} has colliding ready optical routes on condensed phase ${route.condensedPhaseId}`
        );
      }
      claimedCondensedPhases.add(route.condensedPhaseId);
      const particleIndex =
        (route.condensedPhaseId - 1) * topology.phaseLaneStride
        + lineageIndex;
      const offset = particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
      rows.set([
        route.dispersedMaterialId,
        route.condensedPhaseId,
        route.opticalStateId,
        SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
        0,
        0,
        0,
        0
      ], offset);
      routeDeclarations.push(Object.freeze({
        lineageIndex,
        particleIndex,
        dispersedMaterialId: route.dispersedMaterialId,
        vaporPhaseId: route.vaporPhaseId,
        condensedPhaseId: route.condensedPhaseId,
        opticalStateId: route.opticalStateId,
        closureRowIndex: route.rowIndex
      }));
    }
  }
  const declaration = validateSphDispersedMediumOpticsProducerSeedRows({
    rows,
    particleCount: topology.particleCount,
    phaseCarrierPlan,
    opticalClosureTable
  });
  return Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
    status: declaration.readyRowCount > 0
      ? 'dispersed-medium-optics-producer-seed-ready'
      : 'dispersed-medium-optics-producer-seed-all-blocked',
    particleCount: declaration.particleCount,
    rowCount: declaration.rowCount,
    rowCapacity: declaration.rowCapacity,
    readyRowCount: declaration.readyRowCount,
    blockedRowCount: declaration.blockedRowCount,
    readyOpticalStateIds: declaration.readyOpticalStateIds,
    readyOpticalStateRouteCount: declaration.readyOpticalStateIds.length,
    rowLayout: SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
    rowStrideFloats: declaration.rowStrideFloats,
    rowStrideBytes: declaration.rowStrideBytes,
    bufferByteLength: declaration.bufferByteLength,
    rows,
    routeDeclarations: Object.freeze(routeDeclarations),
    declarationAuthority:
      'static-numeric-material-phase-closure-route-table',
    dispersedMassAuthority: 'none-seed-zero-only',
    saturationMassInference: false,
    hostHotLoopReadback: false
  });
}

/**
 * Derive the immutable producer declaration from the canonical packed
 * particle topology. Only the primary carrier's numeric material identity is
 * copied; thermodynamic values and masses remain GPU-owned runtime inputs.
 */
export function buildSphDispersedMediumOpticsProducerSeedRowsFromParticleState({
  sphParticleState,
  opticalClosureTable
} = {}) {
  const phaseCarrierPlan = sphParticleState?.phaseCarrierPlan ?? null;
  const topology = validateFourLanePlan(
    phaseCarrierPlan,
    sphParticleState?.particleCount
  );
  const thermo = sphParticleState?.thermo;
  if (
    !(thermo instanceof Float32Array)
    || thermo.length !== topology.particleCount * THERMO_ROW_FLOATS
    || Number(sphParticleState?.thermoStrideFloats) !== THERMO_ROW_FLOATS
  ) {
    throw new TypeError(
      'dispersed-medium seed derivation requires exact canonical packed particle thermo rows'
    );
  }
  const lineageMaterialIds = new Float32Array(topology.lineageCapacity);
  for (let lineageIndex = 0;
    lineageIndex < topology.lineageCapacity;
    lineageIndex += 1) {
    lineageMaterialIds[lineageIndex] = exactNonnegativeF32Identifier(
      thermo[lineageIndex * THERMO_ROW_FLOATS],
      `sphParticleState.thermo primary material ${lineageIndex}`
    );
  }
  return buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan,
    lineageMaterialIds,
    opticalClosureTable
  });
}

/**
 * Build the immutable optics declaration for the exact four-lane family that
 * a laws-quiescent single-lane particle state will materialize into.  This is
 * intentionally a CPU topology declaration only: it copies primary material
 * ids and never predicts phase, mass, or thermodynamic evolution.
 */
export function buildSphDispersedMediumOpticsProducerSeedRowsForProspectiveFourLaneMaterialization({
  sphParticleState,
  opticalClosureTable
} = {}) {
  const sourcePlan = sphParticleState?.phaseCarrierPlan ?? null;
  const lineageCapacity = Number(sphParticleState?.particleCount);
  const exactSingleLanePlan = Boolean(
    Number.isSafeInteger(lineageCapacity)
    && lineageCapacity > 0
    && lineageCapacity <= Math.floor(0xffff_ffff / REQUIRED_PHASE_LANE_COUNT)
    && sourcePlan?.schema === REQUIRED_PHASE_CARRIER_PLAN_SCHEMA
    && sourcePlan.status === 'phase-lane-capacity-ready'
    && Number(sourcePlan.lineageCapacity) === lineageCapacity
    && Number(sourcePlan.primaryCapacity) === lineageCapacity
    && Number(sourcePlan.phaseLaneCount) === 1
    && Number(sourcePlan.phaseLaneStride) === lineageCapacity
    && Number(sourcePlan.companionStart) === lineageCapacity
    && Number(sourcePlan.companionCapacity) === 0
    && Number(sourcePlan.particleCapacity) === lineageCapacity
    && sourcePlan.stableLaneAddress === REQUIRED_STABLE_LANE_ADDRESS
    && sourcePlan.phaseCompanionLanesRequired === false
  );
  if (!exactSingleLanePlan) {
    throw new RangeError(
      'Prospective dispersed-medium seed derivation requires the exact laws-quiescent single-lane phase-carrier plan'
    );
  }
  const thermo = sphParticleState?.thermo;
  if (
    !(thermo instanceof Float32Array)
    || thermo.length !== lineageCapacity * THERMO_ROW_FLOATS
    || Number(sphParticleState?.thermoStrideFloats) !== THERMO_ROW_FLOATS
  ) {
    throw new TypeError(
      'Prospective dispersed-medium seed derivation requires exact single-lane packed particle thermo rows'
    );
  }
  const lineageMaterialIds = new Float32Array(lineageCapacity);
  for (let lineageIndex = 0;
    lineageIndex < lineageCapacity;
    lineageIndex += 1) {
    lineageMaterialIds[lineageIndex] = exactNonnegativeF32Identifier(
      thermo[lineageIndex * THERMO_ROW_FLOATS],
      `sphParticleState.thermo primary material ${lineageIndex}`
    );
  }
  const particleCapacity = lineageCapacity * REQUIRED_PHASE_LANE_COUNT;
  if (!Number.isSafeInteger(particleCapacity)) {
    throw new RangeError(
      'Prospective dispersed-medium four-lane particle capacity is not safely addressable'
    );
  }
  const phaseCarrierPlan = Object.freeze({
    schema: REQUIRED_PHASE_CARRIER_PLAN_SCHEMA,
    status: 'phase-lane-capacity-ready',
    lineageCapacity,
    primaryCapacity: lineageCapacity,
    phaseLaneCount: REQUIRED_PHASE_LANE_COUNT,
    phaseLaneStride: lineageCapacity,
    companionStart: lineageCapacity,
    companionCapacity: particleCapacity - lineageCapacity,
    particleCapacity,
    stableLaneAddress: REQUIRED_STABLE_LANE_ADDRESS,
    phaseCompanionLanesRequired: true,
    reason: 'static-schedule-law-activation-requires-four-phase-carrier-lanes'
  });
  return buildSphDispersedMediumOpticsProducerSeedRows({
    phaseCarrierPlan,
    lineageMaterialIds,
    opticalClosureTable
  });
}

/**
 * Validate the immutable declaration carried by a dense seed. Ready rows are
 * legal only on the closure route's condensed carrier; blocked rows use the
 * canonical all-zero payload. Moment lanes may contain a prior ledger, but the
 * producer never changes declaration lanes 0-3.
 */
export function validateSphDispersedMediumOpticsProducerSeedRows({
  rows,
  particleCount,
  phaseCarrierPlan,
  opticalClosureTable
} = {}) {
  const topology = validateFourLanePlan(phaseCarrierPlan, particleCount);
  validateProducerClosureTable(opticalClosureTable);
  exactFloatRows(
    rows,
    topology.particleCount * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
    'dispersed-medium optics seed rows'
  );
  let readyRowCount = 0;
  let blockedRowCount = 0;
  const readyOpticalStateIds = new Set();
  for (let particleIndex = 0;
    particleIndex < topology.particleCount;
    particleIndex += 1) {
    const offset = particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    const status = rows[offset + 3];
    if (status === SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked) {
      for (let lane = 0; lane < SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS; lane += 1) {
        if (lane !== 3 && rows[offset + lane] !== 0) {
          throw new RangeError(
            `blocked dispersed-medium seed row ${particleIndex} must be canonical zero`
          );
        }
      }
      blockedRowCount += 1;
      continue;
    }
    if (status !== SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready) {
      throw new RangeError(
        `dispersed-medium seed row ${particleIndex} has invalid status`
      );
    }
    const dispersedMaterialId = exactF32Identifier(
      rows[offset],
      `dispersed-medium seed row ${particleIndex} material id`
    );
    const dispersedPhaseId = exactF32Identifier(
      rows[offset + 1],
      `dispersed-medium seed row ${particleIndex} phase id`
    );
    const opticalStateId = exactF32Identifier(
      rows[offset + 2],
      `dispersed-medium seed row ${particleIndex} optical state id`
    );
    const route = closureRowForOpticsPrefix(opticalClosureTable, {
      dispersedMaterialId,
      dispersedPhaseId,
      opticalStateId
    });
    if (!route) {
      throw new RangeError(
        `dispersed-medium seed row ${particleIndex} has no exact ready closure route`
      );
    }
    const phaseLane = Math.floor(
      particleIndex / topology.phaseLaneStride
    ) + 1;
    if (phaseLane !== route.condensedPhaseId) {
      throw new RangeError(
        `dispersed-medium seed row ${particleIndex} is not on its condensed carrier lane`
      );
    }
    const dispersedMassKg = finiteNonnegativeF32(
      rows[offset + 4],
      `dispersed-medium seed row ${particleIndex} mass`
    );
    const scattering = finiteNonnegativeF32(
      rows[offset + 5],
      `dispersed-medium seed row ${particleIndex} scattering`
    );
    finiteNonnegativeF32(
      rows[offset + 6],
      `dispersed-medium seed row ${particleIndex} absorption`
    );
    const asymmetry = finiteF32(
      rows[offset + 7],
      `dispersed-medium seed row ${particleIndex} asymmetry`
    );
    if (Math.abs(asymmetry) > scattering) {
      throw new RangeError(
        `dispersed-medium seed row ${particleIndex} asymmetry exceeds scattering`
      );
    }
    if (dispersedMassKg === 0 && (scattering !== 0 || rows[offset + 6] !== 0 || asymmetry !== 0)) {
      throw new RangeError(
        `zero-mass dispersed-medium seed row ${particleIndex} must have zero optical moments`
      );
    }
    readyRowCount += 1;
    readyOpticalStateIds.add(opticalStateId);
  }
  return Object.freeze({
    particleCount: topology.particleCount,
    rowCount: topology.particleCount,
    rowCapacity: topology.particleCount,
    readyRowCount,
    blockedRowCount,
    readyOpticalStateIds: Object.freeze(
      [...readyOpticalStateIds].sort((left, right) => left - right)
    ),
    rowStrideFloats: SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
    rowStrideBytes: SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
    bufferByteLength: rows.byteLength
  });
}

function sameExactArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function canonicalProducerAdoptionDeclaration({
  packed = null,
  rows = packed?.rows ?? null,
  particleCount,
  phaseCarrierPlan,
  opticalClosureTable,
  source,
  dynamicRouteIdentity = false
}) {
  if (packed != null && packed.schema !== ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA) {
    throw new TypeError(
      'Dispersed-medium optics adoptionDeclaration must be a packed optics declaration'
    );
  }
  // Validate the detached generation that will actually become authority.
  // Copying first closes SharedArrayBuffer/concurrent-writer drift between
  // validation and the later private snapshot.
  const privateRows = rows instanceof Float32Array ? rows.slice() : rows;
  const summary = validateSphDispersedMediumOpticsProducerSeedRows({
    rows: privateRows,
    particleCount,
    phaseCarrierPlan,
    opticalClosureTable
  });
  const routeCatalog = exactClosureRouteCatalog(opticalClosureTable);
  const declarationMode = dynamicRouteIdentity
    ? SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_DECLARATION_MODE
        .dynamicRouteCatalog
    : SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_DECLARATION_MODE.staticRows;
  if (packed != null) {
    const packedDynamic = packed.declarationMode
      === SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_DECLARATION_MODE
        .dynamicRouteCatalog;
    const rowMetadataMatches = packedDynamic
      ? Boolean(
          packed.initialReadyRowCount === summary.readyRowCount
          && packed.initialBlockedRowCount === summary.blockedRowCount
          && sameExactArray(
            packed.initialReadyOpticalStateIds,
            summary.readyOpticalStateIds
          )
        )
      : Boolean(
          packed.readyRowCount === summary.readyRowCount
          && packed.blockedRowCount === summary.blockedRowCount
          && packed.readyOpticalStateRouteCount
            === summary.readyOpticalStateIds.length
          && sameExactArray(
            packed.readyOpticalStateIds,
            summary.readyOpticalStateIds
          )
        );
    const catalogMetadataMatches = !packedDynamic || Boolean(
      packed.routeCatalogRowCount === routeCatalog.routeCatalogRowCount
      && packed.routeCatalogSignature === routeCatalog.routeCatalogSignature
      && packed.eligibleOpticalStateRouteCount
        === routeCatalog.eligibleOpticalStateRouteCount
      && sameExactArray(
        packed.eligibleOpticalStateIds,
        routeCatalog.eligibleOpticalStateIds
      )
    );
    const metadataMatches = Boolean(
      packed.particleCount === summary.particleCount
      && packed.rowCount === summary.rowCount
      && packed.rowCapacity === summary.rowCapacity
      && rowMetadataMatches
      && catalogMetadataMatches
      && sameExactArray(
        packed.rowLayout,
        SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT
      )
      && packed.rowStrideFloats === summary.rowStrideFloats
      && packed.rowStrideBytes === summary.rowStrideBytes
      && packed.bufferByteLength === summary.bufferByteLength
    );
    if (!metadataMatches) {
      throw new RangeError(
        'Dispersed-medium optics adoptionDeclaration metadata does not exactly match its rows'
      );
    }
  }
  return Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
    status: dynamicRouteIdentity
      ? 'dispersed-medium-optics-producer-dynamic-route-catalog-ready'
      : (summary.readyRowCount > 0
        ? 'dispersed-medium-optics-producer-adoption-declaration-ready'
        : 'dispersed-medium-optics-producer-adoption-declaration-all-blocked'),
    declarationMode,
    particleCount: summary.particleCount,
    rowCount: summary.rowCount,
    rowCapacity: summary.rowCapacity,
    readyRowCount: dynamicRouteIdentity ? null : summary.readyRowCount,
    blockedRowCount: dynamicRouteIdentity ? null : summary.blockedRowCount,
    readyOpticalStateIds: Object.freeze(dynamicRouteIdentity
      ? [...routeCatalog.eligibleOpticalStateIds]
      : [...summary.readyOpticalStateIds]),
    readyOpticalStateRouteCount: dynamicRouteIdentity
      ? routeCatalog.eligibleOpticalStateRouteCount
      : summary.readyOpticalStateIds.length,
    initialReadyRowCount: summary.readyRowCount,
    initialBlockedRowCount: summary.blockedRowCount,
    initialReadyOpticalStateIds: Object.freeze([
      ...summary.readyOpticalStateIds
    ]),
    ...routeCatalog,
    rowLayout: SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
    rowStrideFloats: summary.rowStrideFloats,
    rowStrideBytes: summary.rowStrideBytes,
    bufferByteLength: summary.bufferByteLength,
    rows: privateRows,
    declarationAuthority:
      dynamicRouteIdentity
        ? 'producer-private-static-eligible-route-catalog-with-gpu-resolved-active-prefixes'
        : 'producer-private-defensive-copy-of-static-numeric-route-declaration',
    activeRouteCountAuthority: dynamicRouteIdentity
      ? 'gpu-resident-unobserved-no-host-readback'
      : 'exact-static-row-prefix-counts',
    dispersedMassAuthority: 'gpu-produced-moment-lanes-not-host-declaration',
    source,
    hostHotLoopReadback: false
  });
}

function exactDeclarationRowsSnapshotMatches(declaration, snapshot) {
  if (
    !(declaration?.rows instanceof Float32Array)
    || !(snapshot instanceof Float32Array)
    || declaration.rows.length !== snapshot.length
  ) return false;
  const liveBits = new Uint32Array(
    declaration.rows.buffer,
    declaration.rows.byteOffset,
    declaration.rows.length
  );
  const snapshotBits = new Uint32Array(
    snapshot.buffer,
    snapshot.byteOffset,
    snapshot.length
  );
  for (let index = 0; index < liveBits.length; index += 1) {
    if (liveBits[index] !== snapshotBits[index]) return false;
  }
  return true;
}

function exactAdoptionDeclarationSnapshotMatches(record) {
  return exactDeclarationRowsSnapshotMatches(
    record.adoptionDeclaration,
    record.adoptionDeclarationRowsSnapshot
  );
}

function exactAdoptedOutputMatchesProducer(
  record,
  adoptedOutput,
  producerAdoptionDeclaration
) {
  const declaration = record.adoptionDeclaration;
  const authority = adoptedOutput?.authority;
  const dynamicRouteCatalog = declaration.declarationMode
    === SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_DECLARATION_MODE
      .dynamicRouteCatalog;
  const dynamicRouteCatalogMatches = !dynamicRouteCatalog || Boolean(
    adoptedOutput?.declarationMode === declaration.declarationMode
    && authority?.declarationMode === declaration.declarationMode
    && adoptedOutput?.initialReadyRowCount
      === declaration.initialReadyRowCount
    && adoptedOutput?.initialBlockedRowCount
      === declaration.initialBlockedRowCount
    && sameExactArray(
      adoptedOutput?.initialReadyOpticalStateIds,
      declaration.initialReadyOpticalStateIds
    )
    && sameExactArray(
      authority?.initialReadyOpticalStateIds,
      declaration.initialReadyOpticalStateIds
    )
    && adoptedOutput?.eligibleOpticalStateRouteCount
      === declaration.eligibleOpticalStateRouteCount
    && authority?.eligibleOpticalStateRouteCount
      === declaration.eligibleOpticalStateRouteCount
    && sameExactArray(
      adoptedOutput?.eligibleOpticalStateIds,
      declaration.eligibleOpticalStateIds
    )
    && sameExactArray(
      authority?.eligibleOpticalStateIds,
      declaration.eligibleOpticalStateIds
    )
    && adoptedOutput?.routeCatalogRowCount
      === declaration.routeCatalogRowCount
    && authority?.routeCatalogRowCount === declaration.routeCatalogRowCount
    && adoptedOutput?.routeCatalogSignature
      === declaration.routeCatalogSignature
    && authority?.routeCatalogSignature === declaration.routeCatalogSignature
    && adoptedOutput?.activeRouteCountAuthority
      === declaration.activeRouteCountAuthority
    && authority?.activeRouteCountAuthority
      === declaration.activeRouteCountAuthority
  );
  return Boolean(
    adoptedOutput
    && typeof adoptedOutput === 'object'
    && adoptedOutput.schema
      === ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA
    && adoptedOutput.status === 'webgpu-uploaded'
    && adoptedOutput.sourceSchema === ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA
    && adoptedOutput.buffer === record.outputBuffer
    && webGpuBufferDevice(adoptedOutput.buffer) === record.device
    && authority
    && typeof authority === 'object'
    && Object.isFrozen(authority)
    && authority.schema === ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA
    && authority.status === 'sph-dispersed-medium-optics-authority-ready'
    && dynamicRouteCatalogMatches
    && adoptedOutput.ownsBuffer === true
    && adoptedOutput.destroyed !== true
    && adoptedOutput.particleCount === declaration.particleCount
    && adoptedOutput.rowCount === declaration.rowCount
    && adoptedOutput.rowCapacity === declaration.rowCapacity
    && adoptedOutput.readyRowCount === declaration.readyRowCount
    && adoptedOutput.blockedRowCount === declaration.blockedRowCount
    && sameExactArray(
      adoptedOutput.readyOpticalStateIds,
      declaration.readyOpticalStateIds
    )
    && adoptedOutput.readyOpticalStateRouteCount
      === declaration.readyOpticalStateRouteCount
    && adoptedOutput.readyOpticalStateIds === authority.readyOpticalStateIds
    && Object.isFrozen(authority.readyOpticalStateIds)
    && authority.particleCount === declaration.particleCount
    && authority.rowCount === declaration.rowCount
    && authority.rowCapacity === declaration.rowCapacity
    && authority.readyRowCount === declaration.readyRowCount
    && authority.blockedRowCount === declaration.blockedRowCount
    && sameExactArray(
      authority.readyOpticalStateIds,
      declaration.readyOpticalStateIds
    )
    && authority.readyOpticalStateRouteCount
      === declaration.readyOpticalStateRouteCount
    && authority.rowStrideFloats === declaration.rowStrideFloats
    && authority.rowStrideBytes === declaration.rowStrideBytes
    && authority.bufferByteLength === declaration.bufferByteLength
    && adoptedOutput.rowStrideFloats === declaration.rowStrideFloats
    && adoptedOutput.rowStrideBytes === declaration.rowStrideBytes
    && adoptedOutput.bufferByteLength === declaration.bufferByteLength
    && validateSphDispersedMediumGpuBufferAuthority(
      record.device,
      authority,
      {
        upload: adoptedOutput,
        buffer: record.outputBuffer,
        particleCount: declaration.particleCount,
        rowCount: declaration.rowCount,
        rowStrideFloats: declaration.rowStrideFloats,
        bufferByteLength: declaration.bufferByteLength,
        particleLineage: record.postTransferParticleSourceFamily,
        producerAdoptionDeclaration,
        requireParticleLineage: true
      }
    )
  );
}

function publicAdoptionDeclarationCopy(adoptionDeclaration) {
  return Object.freeze({
    ...adoptionDeclaration,
    readyOpticalStateIds: Object.freeze([
      ...adoptionDeclaration.readyOpticalStateIds
    ]),
    initialReadyOpticalStateIds: Object.freeze([
      ...adoptionDeclaration.initialReadyOpticalStateIds
    ]),
    eligibleOpticalStateIds: Object.freeze([
      ...adoptionDeclaration.eligibleOpticalStateIds
    ]),
    rows: adoptionDeclaration.rows.slice()
  });
}

function setProducerAdoptionDiagnostic(record, status) {
  try { record.result.adoptionStatus = status; } catch {}
}

function requireProducerAdoptionRecord(producerResult) {
  const record = producerOutputAdoptionRecords.get(producerResult);
  if (!record || record.result !== producerResult) {
    throw producerAdoptionAuthorityError(
      'Dispersed-medium optics adoption requires an exact producer result'
    );
  }
  return record;
}

/**
 * Mint the one opaque claim authorized to adopt a producer-owned output.
 * Object shape is intentionally not authority: copied or reconstructed claims
 * are rejected by the module-private record.
 */
export function issueSphDispersedMediumOpticsProducerAdoptionClaim(
  producerResult
) {
  const record = requireProducerAdoptionRecord(producerResult);
  if (record.encodeState !== 'encoded') {
    throw producerAdoptionAuthorityError(
      'Dispersed-medium optics producer adoption requires one successfully encoded stage'
    );
  }
  if (
    record.state !== 'claim-unissued'
    || record.claim
    || webGpuBufferDevice(record.outputBuffer) !== record.device
    || !exactAdoptionDeclarationSnapshotMatches(record)
  ) {
    throw producerAdoptionAuthorityError(
      'Dispersed-medium optics producer adoption claim is no longer issuable'
    );
  }
  const claim = Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_CLAIM_SCHEMA,
    status: 'dispersed-medium-optics-producer-adoption-claim-issued',
    particleCount: record.adoptionDeclaration.particleCount,
    rowCount: record.adoptionDeclaration.rowCount,
    bufferByteLength: record.adoptionDeclaration.bufferByteLength
  });
  record.claim = claim;
  record.state = 'claim-issued';
  producerAdoptionClaimRecords.set(claim, record);
  setProducerAdoptionDiagnostic(record, 'claim-issued');
  return claim;
}

function invokeProducerAdoptionRollback(
  record,
  rollback,
  cause,
  { registrationMayHaveOccurred = false } = {}
) {
  if (typeof rollback !== 'function') {
    record.state = registrationMayHaveOccurred
      ? 'adoption-rollback-failed-quarantined'
      : 'adoption-failed-no-registration';
    setProducerAdoptionDiagnostic(record, record.state);
    return null;
  }
  try {
    if (rollback() !== true) {
      throw new TypeError(
        'Dispersed-medium optics adoption rollback did not confirm revocation'
      );
    }
    record.state = 'adoption-failed-rolled-back';
    setProducerAdoptionDiagnostic(record, 'adoption-failed-rolled-back');
    return null;
  } catch (rollbackError) {
    record.state = 'adoption-rollback-failed-quarantined';
    record.rollbackError = rollbackError;
    setProducerAdoptionDiagnostic(
      record,
      'adoption-rollback-failed-quarantined'
    );
    if (cause && typeof cause === 'object') {
      try {
        Object.defineProperty(cause, 'adoptionRollbackError', {
          configurable: true,
          enumerable: false,
          value: rollbackError
        });
      } catch {}
    }
    return rollbackError;
  }
}

/**
 * Atomically adopt and transfer one producer output. The callback must register
 * revocation as soon as low-level registration succeeds and return the exact
 * published child plus the same rollback. Any failure before the receipt-gated
 * transfer terminally consumes the claim and rolls publication back without
 * destroying the still producer-owned output.
 */
export function consumeSphDispersedMediumOpticsProducerAdoptionClaim(
  claim,
  options = {}
) {
  const record = producerAdoptionClaimRecords.get(claim);
  if (!record || record.claim !== claim) {
    throw producerAdoptionAuthorityError(
      'Dispersed-medium optics adoption requires the exact issued claim'
    );
  }
  if (record.state !== 'claim-issued') {
    throw producerAdoptionAuthorityError(
      'Dispersed-medium optics producer adoption claim is no longer consumable'
    );
  }
  // Claim the preflight state before reading any caller-controlled option or
  // source-family getter. Function-parameter destructuring is deliberately
  // avoided here because it would run before this one-shot gate.
  record.state = 'adoption-preflight';
  setProducerAdoptionDiagnostic(record, 'adoption-preflight');
  let device;
  let outputBuffer;
  let particleSourceFamily;
  let adopt;
  try {
    ({ device, outputBuffer, particleSourceFamily, adopt } = options ?? {});
    if (
      device !== record.device
      || webGpuBufferDevice(outputBuffer) !== device
    ) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption requires the exact producing device'
      );
    }
    if (outputBuffer !== record.outputBuffer) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption requires the exact produced buffer'
      );
    }
    if (!exactProducerParticleSourceFamilyMatches(
      record,
      particleSourceFamily
    )) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption requires the exact post-transfer particle source family'
      );
    }
    if (typeof adopt !== 'function') {
      throw new TypeError(
        'Dispersed-medium optics adoption requires one transactional adopt callback'
      );
    }
    if (!exactAdoptionDeclarationSnapshotMatches(record)) {
      record.state = 'adoption-declaration-invalidated';
      setProducerAdoptionDiagnostic(
        record,
        'adoption-declaration-invalidated'
      );
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption declaration was invalidated'
      );
    }
  } catch (error) {
    if (record.state === 'adoption-preflight') {
      record.state = 'claim-issued';
      setProducerAdoptionDiagnostic(record, 'claim-issued');
    }
    throw error;
  }

  record.state = 'adoption-in-progress';
  setProducerAdoptionDiagnostic(record, 'adoption-in-progress');
  let registeredRollback = null;
  let returnedRollback = null;
  let adoptionCallbackReturned = false;
  const adoptionDeclaration = publicAdoptionDeclarationCopy(
    record.adoptionDeclaration
  );
  const adoptionDeclarationRowsSnapshot = adoptionDeclaration.rows.slice();
  try {
    const registerRollback = (rollback) => {
      if (typeof rollback !== 'function') {
        throw new TypeError(
          'Dispersed-medium optics adoption rollback must be a function'
        );
      }
      if (registeredRollback && registeredRollback !== rollback) {
        throw new TypeError(
          'Dispersed-medium optics adoption registered more than one rollback'
        );
      }
      registeredRollback = rollback;
      return true;
    };
    const callbackResult = adopt(Object.freeze({
      schema:
        ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_TRANSACTION_SCHEMA,
      status: 'dispersed-medium-optics-producer-adoption-callback-ready',
      device: record.device,
      outputBuffer: record.outputBuffer,
      particleSourceFamily: record.postTransferParticleSourceFamily,
      adoptionDeclaration,
      registerRollback
    }));
    adoptionCallbackReturned = true;
    if (!callbackResult || typeof callbackResult !== 'object') {
      throw new TypeError(
        'Dispersed-medium optics adoption callback must return a transaction result'
      );
    }
    const { adoptedOutput, rollback } = callbackResult;
    returnedRollback = rollback;
    if (typeof returnedRollback !== 'function') {
      throw new TypeError(
        'Dispersed-medium optics adoption callback must return its rollback'
      );
    }
    if (registeredRollback && registeredRollback !== returnedRollback) {
      throw new TypeError(
        'Dispersed-medium optics adoption callback returned a different rollback'
      );
    }
    registeredRollback ??= returnedRollback;
    if (
      !exactAdoptionDeclarationSnapshotMatches(record)
      || !exactDeclarationRowsSnapshotMatches(
        adoptionDeclaration,
        adoptionDeclarationRowsSnapshot
      )
    ) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption mutated its immutable declaration'
      );
    }
    if (!exactAdoptedOutputMatchesProducer(
      record,
      adoptedOutput,
      adoptionDeclaration
    )) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption did not return the exact live child'
      );
    }
    // Descriptor/authority validation reads caller-controlled object fields.
    // Close that getter/proxy TOCTOU before minting the transfer receipt.
    if (
      !exactAdoptionDeclarationSnapshotMatches(record)
      || !exactDeclarationRowsSnapshotMatches(
        adoptionDeclaration,
        adoptionDeclarationRowsSnapshot
      )
    ) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium optics adoption mutated its immutable declaration'
      );
    }

    const adoptionReceipt = Object.freeze({
      schema:
        ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_RECEIPT_SCHEMA,
      status: 'dispersed-medium-optics-producer-adoption-recorded',
      particleCount: record.adoptionDeclaration.particleCount,
      rowCount: record.adoptionDeclaration.rowCount,
      bufferByteLength: record.adoptionDeclaration.bufferByteLength
    });
    const transaction = Object.freeze({
      schema:
        ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ADOPTION_TRANSACTION_SCHEMA,
      status: 'dispersed-medium-optics-producer-adoption-complete',
      adoptedOutput,
      adoptionReceipt,
      outputBuffer: record.outputBuffer
    });
    record.adoptedOutput = adoptedOutput;
    record.adoptionReceipt = adoptionReceipt;
    record.publishedAdoptionDeclaration = adoptionDeclaration;
    record.publishedAdoptionDeclarationRowsSnapshot =
      adoptionDeclarationRowsSnapshot;
    record.rollback = registeredRollback;
    record.state = 'adopted-pending-transfer';
    producerAdoptionReceiptRecords.set(adoptionReceipt, record);
    setProducerAdoptionDiagnostic(record, 'adopted-pending-transfer');

    // Keep this as the final potentially throwing operation. Once it succeeds,
    // the adopted child is the sole owner and rollback must never run.
    record.transferOutputBufferOwnership(record.outputBuffer, adoptionReceipt);
    return transaction;
  } catch (error) {
    if (record.adoptionReceipt) {
      producerAdoptionReceiptRecords.delete(record.adoptionReceipt);
      record.adoptionReceipt = null;
    }
    record.adoptedOutput = null;
    record.rollback = null;
    record.publishedAdoptionDeclaration = null;
    record.publishedAdoptionDeclarationRowsSnapshot = null;
    invokeProducerAdoptionRollback(
      record,
      registeredRollback ?? (
        typeof returnedRollback === 'function' ? returnedRollback : null
      ),
      error,
      { registrationMayHaveOccurred: adoptionCallbackReturned }
    );
    throw error;
  }
}

/**
 * Authenticate that one published sidecar is the exact live child produced
 * and adopted by this producer result. Public status strings and descriptor
 * shape are deliberately insufficient; authority remains bound to the
 * module-private producer, receipt, allocation, and source-family records.
 */
export function sphDispersedMediumOpticsProducerAdoptionMatches(
  producerResult,
  adoptedOutput,
  {
    device = null,
    particleSourceFamily = null
  } = {}
) {
  const record = producerOutputAdoptionRecords.get(producerResult);
  try {
    return Boolean(
      record
      && record.result === producerResult
      && record.state === 'ownership-transferred'
      && record.encodeState === 'encoded'
      && record.device === device
      && record.adoptedOutput === adoptedOutput
      && record.rollback == null
      && record.claim
      && producerAdoptionClaimRecords.get(record.claim) === record
      && record.adoptionReceipt
      && producerAdoptionReceiptRecords.get(record.adoptionReceipt) === record
      && record.publishedAdoptionDeclaration
      && exactAdoptionDeclarationSnapshotMatches(record)
      && exactDeclarationRowsSnapshotMatches(
        record.publishedAdoptionDeclaration,
        record.publishedAdoptionDeclarationRowsSnapshot
      )
      && exactProducerParticleSourceFamilyMatches(
        record,
        particleSourceFamily
      )
      && exactAdoptedOutputMatchesProducer(
        record,
        adoptedOutput,
        record.publishedAdoptionDeclaration
      )
    );
  } catch {
    return false;
  }
}

/**
 * Rebase one already-adopted producer record across the exact conservative
 * parent/child topology-epoch transition authenticated by sphGpuBuffers. The
 * lower child witness, not the public receipt fields, is the authority. No
 * buffer, identity revision, particle count, or source-family member may
 * change. The returned rollback must run before the parent transition's own
 * rollback when a successor publication fails.
 */
export function rebaseSphDispersedMediumOpticsProducerAdoptionTopologyEpoch(
  producerResult,
  adoptedOutput,
  {
    topologyEpochTransitionReceipt = null,
    targetParticleSourceFamily = null
  } = {}
) {
  const record = producerOutputAdoptionRecords.get(producerResult) ?? null;
  if (
    !record
    || record.result !== producerResult
    || record.state !== 'ownership-transferred'
    || record.adoptedOutput !== adoptedOutput
    || record.outputBuffer !== adoptedOutput?.buffer
    || record.topologyRebaseInProgress === true
  ) {
    throw producerAdoptionAuthorityError(
      'Dispersed-medium producer topology rebase requires one exact adopted output'
    );
  }
  record.topologyRebaseInProgress = true;
  const sourceFamily = record.postTransferParticleSourceFamily;
  let targetFamily = null;
  let priorGeneration = null;
  try {
    const transition = topologyEpochTransitionReceipt;
    const targetTopologyEpoch = transition?.targetTopologyEpoch;
    if (
      !Object.isFrozen(transition)
      || transition.schema
        !== 'peercompute.ulg.sph-particle-dispersed-medium-optics-topology-epoch-transition.v0'
      || transition.status
        !== 'sph-particle-dispersed-medium-optics-topology-epoch-advanced'
      || transition.particleCount !== sourceFamily.particleCount
      || transition.identityRevision !== sourceFamily.identityRevision
      || transition.sourceTopologyEpoch !== sourceFamily.topologyEpoch
      || !Number.isSafeInteger(targetTopologyEpoch)
      || targetTopologyEpoch !== sourceFamily.topologyEpoch + 1
    ) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium producer topology rebase requires the exact parent transition receipt'
      );
    }
    const targetCandidate = targetParticleSourceFamily ?? {
      ...sourceFamily,
      topologyEpoch: targetTopologyEpoch
    };
    targetFamily = canonicalProducerParticleSourceFamily(
      record.device,
      sourceFamily.particleCount,
      targetCandidate,
      targetCandidate?.stateBuffer,
      targetCandidate?.thermoBuffer
    );
    if (
      targetFamily.topologyEpoch !== targetTopologyEpoch
      || targetFamily.particleCount !== sourceFamily.particleCount
      || targetFamily.identityRevision !== sourceFamily.identityRevision
      || targetFamily.identityBuffer !== sourceFamily.identityBuffer
      || targetFamily.stateBuffer !== sourceFamily.stateBuffer
      || targetFamily.thermoBuffer !== sourceFamily.thermoBuffer
      || !sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches(
        transition.childTransitionWitness,
        {
          upload: adoptedOutput,
          sourceFamily,
          targetFamily
        }
      )
    ) {
      throw producerAdoptionAuthorityError(
        'Dispersed-medium producer topology rebase rejected the child transition witness'
      );
    }
    priorGeneration = Number(record.topologyRebaseGeneration) || 0;
    const targetGeneration = priorGeneration + 1;
    record.postTransferParticleSourceFamily = targetFamily;
    record.topologyRebaseGeneration = targetGeneration;
    if (!exactAdoptedOutputMatchesProducer(
      record,
      adoptedOutput,
      record.publishedAdoptionDeclaration
    )) {
      record.postTransferParticleSourceFamily = sourceFamily;
      record.topologyRebaseGeneration = priorGeneration;
      throw producerAdoptionAuthorityError(
        'Dispersed-medium producer topology rebase did not authenticate the rebased child'
      );
    }
    let active = true;
    const rebaseReceipt = Object.freeze({
      schema:
        ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_TOPOLOGY_REBASE_SCHEMA,
      status: 'sph-dispersed-medium-optics-producer-topology-rebased',
      particleCount: sourceFamily.particleCount,
      identityRevision: sourceFamily.identityRevision,
      sourceTopologyEpoch: sourceFamily.topologyEpoch,
      targetTopologyEpoch,
      rollback() {
        if (!active) return true;
        if (
          record.postTransferParticleSourceFamily !== targetFamily
          || record.topologyRebaseGeneration !== targetGeneration
          || !sphDispersedMediumGpuBufferParticleTopologyEpochTransitionMatches(
            transition.childTransitionWitness,
            {
              upload: adoptedOutput,
              sourceFamily,
              targetFamily
            }
          )
        ) return false;
        record.postTransferParticleSourceFamily = sourceFamily;
        record.topologyRebaseGeneration = targetGeneration + 1;
        active = false;
        return true;
      }
    });
    producerTopologyRebaseRecords.set(rebaseReceipt, {
      record,
      adoptedOutput,
      sourceFamily,
      targetFamily,
      transition
    });
    return rebaseReceipt;
  } finally {
    record.topologyRebaseInProgress = false;
  }
}

function phaseTransferContribution({
  state,
  thermo,
  particleIndex,
  materialId,
  targetPhaseId
}) {
  const stateOffset = particleIndex * STATE_ROW_FLOATS;
  const thermoOffset = particleIndex * THERMO_ROW_FLOATS;
  const massKg = Math.fround(state[stateOffset + 3]);
  if (!Number.isFinite(massKg) || massKg < 0) {
    return Object.freeze({ valid: false, massKg: 0 });
  }
  if (!(massKg > MASS_EPSILON_KG)) {
    return Object.freeze({ valid: true, massKg: 0 });
  }
  if (thermo[thermoOffset] !== materialId) {
    return Object.freeze({ valid: false, massKg: 0 });
  }
  const fraction = Math.fround(
    thermo[thermoOffset + 4 + targetPhaseId - 1]
  );
  if (
    !Number.isFinite(fraction)
    || fraction < -PHASE_FRACTION_TOLERANCE
    || fraction > 1 + PHASE_FRACTION_TOLERANCE
  ) {
    return Object.freeze({ valid: false, massKg: 0 });
  }
  return Object.freeze({
    valid: true,
    massKg: Math.fround(massKg * Math.min(1, Math.max(0, fraction)))
  });
}

function postCondensedMass({
  state,
  thermo,
  particleIndex,
  materialId,
  condensedPhaseId
}) {
  const stateOffset = particleIndex * STATE_ROW_FLOATS;
  const thermoOffset = particleIndex * THERMO_ROW_FLOATS;
  const massKg = Math.fround(state[stateOffset + 3]);
  if (!Number.isFinite(massKg) || massKg < 0) {
    return Object.freeze({ valid: false, massKg: 0 });
  }
  if (!(massKg > MASS_EPSILON_KG)) {
    return Object.freeze({ valid: true, massKg: 0 });
  }
  const phaseId = thermo[thermoOffset + 1];
  if (
    thermo[thermoOffset] !== materialId
    || phaseId !== condensedPhaseId
  ) {
    return Object.freeze({ valid: false, massKg: 0 });
  }
  return Object.freeze({ valid: true, massKg });
}

function conservativeDispersedMass({
  priorMassKg,
  gasToCondensedMassKg,
  condensedToGasMassKg,
  postCondensedMassKg
}) {
  const afterCondensation = Math.fround(
    Math.fround(priorMassKg) + Math.fround(gasToCondensedMassKg)
  );
  const afterEvaporation = Math.fround(
    afterCondensation - Math.fround(condensedToGasMassKg)
  );
  return Math.fround(Math.min(
    Math.fround(postCondensedMassKg),
    Math.max(0, afterEvaporation)
  ));
}

function lineageMaterialPhaseComponentMass({
  state,
  thermo,
  topology,
  lineageIndex,
  materialId,
  phaseId
}) {
  let totalMassKg = Math.fround(0);
  for (let phaseLane = 1;
    phaseLane <= topology.phaseLaneCount;
    phaseLane += 1) {
    const particleIndex =
      (phaseLane - 1) * topology.phaseLaneStride + lineageIndex;
    const stateOffset = particleIndex * STATE_ROW_FLOATS;
    const thermoOffset = particleIndex * THERMO_ROW_FLOATS;
    const massKg = Math.fround(state[stateOffset + 3]);
    if (!Number.isFinite(massKg) || massKg < 0) {
      return Object.freeze({ valid: false, massKg: 0 });
    }
    if (!(massKg > MASS_EPSILON_KG)) continue;
    if (thermo[thermoOffset] !== materialId) continue;
    const fraction = Math.fround(thermo[thermoOffset + 4 + phaseId - 1]);
    if (
      !Number.isFinite(fraction)
      || fraction < -PHASE_FRACTION_TOLERANCE
      || fraction > 1 + PHASE_FRACTION_TOLERANCE
    ) {
      return Object.freeze({ valid: false, massKg: 0 });
    }
    totalMassKg = Math.fround(
      totalMassKg + Math.fround(massKg * Math.min(1, Math.max(0, fraction)))
    );
  }
  return Object.freeze({ valid: true, massKg: totalMassKg });
}

function captureReactionBornDispersedMediumRows({
  topology,
  preReactionState,
  preReactionThermo,
  postReactionState,
  postReactionThermo,
  priorRows,
  opticalClosureTable
}) {
  const rows = new Float32Array(priorRows.length);
  for (let particleIndex = 0;
    particleIndex < topology.particleCount;
    particleIndex += 1) {
    rows[particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS + 3] =
      SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
  }
  let reactionBornMassKg = 0;
  let reactionBornRowCount = 0;
  let routeRemapRowCount = 0;
  let ambiguousRouteRowCount = 0;
  let invalidInputRowCount = 0;
  let readyRowCount = 0;
  const readyOpticalStateIds = new Set();

  for (let particleIndex = 0;
    particleIndex < topology.particleCount;
    particleIndex += 1) {
    const phaseLane = Math.floor(
      particleIndex / topology.phaseLaneStride
    ) + 1;
    const lineageIndex = particleIndex % topology.phaseLaneStride;
    const candidates = [];
    let candidateInputInvalid = false;
    for (let rowIndex = 0;
      rowIndex < opticalClosureTable.rowCount;
      rowIndex += 1) {
      const route = decodedClosureRow(opticalClosureTable, rowIndex);
      if (
        route.status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready
        || route.condensedPhaseId !== phaseLane
      ) continue;
      const component = lineageMaterialPhaseComponentMass({
        state: postReactionState,
        thermo: postReactionThermo,
        topology,
        lineageIndex,
        materialId: route.dispersedMaterialId,
        phaseId: route.condensedPhaseId
      });
      if (!component.valid) {
        candidateInputInvalid = true;
        continue;
      }
      if (component.massKg > MASS_EPSILON_KG) {
        candidates.push({ route, postReactionMassKg: component.massKg });
      }
    }
    if (candidates.length > 1) {
      ambiguousRouteRowCount += 1;
      invalidInputRowCount += 1;
      continue;
    }

    const opticsOffset =
      particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    const priorRoute = priorRows[opticsOffset + 3]
        === SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready
      ? closureRowForOpticsPrefix(opticalClosureTable, {
          dispersedMaterialId: priorRows[opticsOffset],
          dispersedPhaseId: priorRows[opticsOffset + 1],
          opticalStateId: priorRows[opticsOffset + 2]
        })
      : null;
    const selection = candidates[0] ?? (
      priorRoute && priorRoute.condensedPhaseId === phaseLane
        ? {
            route: priorRoute,
            postReactionMassKg:
              lineageMaterialPhaseComponentMass({
                state: postReactionState,
                thermo: postReactionThermo,
                topology,
                lineageIndex,
                materialId: priorRoute.dispersedMaterialId,
                phaseId: priorRoute.condensedPhaseId
              }).massKg
          }
        : null
    );
    if (!selection) {
      if (candidateInputInvalid) invalidInputRowCount += 1;
      continue;
    }
    const { route } = selection;
    const preReaction = lineageMaterialPhaseComponentMass({
      state: preReactionState,
      thermo: preReactionThermo,
      topology,
      lineageIndex,
      materialId: route.dispersedMaterialId,
      phaseId: route.condensedPhaseId
    });
    const postReaction = lineageMaterialPhaseComponentMass({
      state: postReactionState,
      thermo: postReactionThermo,
      topology,
      lineageIndex,
      materialId: route.dispersedMaterialId,
      phaseId: route.condensedPhaseId
    });
    const priorIdentityMatches = Boolean(
      priorRoute
      && priorRoute.dispersedMaterialId === route.dispersedMaterialId
      && priorRoute.condensedPhaseId === route.condensedPhaseId
      && priorRoute.opticalStateId === route.opticalStateId
    );
    const priorMassKg = Math.fround(
      priorIdentityMatches ? priorRows[opticsOffset + 4] : 0
    );
    const priorMassValid = Number.isFinite(priorMassKg) && priorMassKg >= 0;
    const reactionBorn = preReaction.valid && postReaction.valid
      ? Math.fround(Math.max(
          0,
          Math.fround(postReaction.massKg - preReaction.massKg)
        ))
      : 0;
    if (!preReaction.valid || !postReaction.valid || !priorMassValid) {
      invalidInputRowCount += 1;
    }
    const capturedMassKg = Math.fround(
      (priorMassValid ? priorMassKg : 0) + reactionBorn
    );
    rows.set([
      route.dispersedMaterialId,
      route.condensedPhaseId,
      route.opticalStateId,
      SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
      capturedMassKg,
      0,
      0,
      0
    ], opticsOffset);
    if (!priorIdentityMatches) routeRemapRowCount += 1;
    if (reactionBorn > 0) {
      reactionBornMassKg += reactionBorn;
      reactionBornRowCount += 1;
    }
    readyRowCount += 1;
    readyOpticalStateIds.add(route.opticalStateId);
  }
  return Object.freeze({
    rows,
    reactionBornMassKg,
    reactionBornRowCount,
    routeRemapRowCount,
    ambiguousRouteRowCount,
    invalidInputRowCount,
    readyRowCount,
    blockedRowCount: topology.particleCount - readyRowCount,
    readyOpticalStateIds: Object.freeze(
      [...readyOpticalStateIds].sort((left, right) => left - right)
    )
  });
}

/**
 * CPU oracle for the resident producer. The ledger consumes newly condensed
 * mass before pre-existing bulk liquid and therefore subtracts the literal
 * reverse phase-transfer delta on evaporation. No saturation or material-name
 * heuristic may create mass here.
 */
export function deriveSphDispersedMediumOpticsProducerReference({
  phaseCarrierPlan,
  particleCount = phaseCarrierPlan?.particleCapacity,
  preReactionState = null,
  preReactionThermo = null,
  preTransferState,
  preTransferThermo,
  postTransferState,
  postTransferThermo,
  priorOpticsRows = null,
  seedOpticsRows = null,
  opticalClosureTable
} = {}) {
  const topology = validateFourLanePlan(phaseCarrierPlan, particleCount);
  validateProducerClosureTable(opticalClosureTable);
  const stateLength = topology.particleCount * STATE_ROW_FLOATS;
  const thermoLength = topology.particleCount * THERMO_ROW_FLOATS;
  exactFloatRows(preTransferState, stateLength, 'pre-transfer state rows');
  exactFloatRows(preTransferThermo, thermoLength, 'pre-transfer thermo rows');
  exactFloatRows(postTransferState, stateLength, 'post-transfer state rows');
  exactFloatRows(postTransferThermo, thermoLength, 'post-transfer thermo rows');
  if ((preReactionState == null) !== (preReactionThermo == null)) {
    throw new TypeError(
      'CPU dispersed-medium reaction capture requires both pre-reaction state and thermo rows'
    );
  }
  const reactionCaptureEnabled = preReactionState != null;
  if (reactionCaptureEnabled) {
    exactFloatRows(preReactionState, stateLength, 'pre-reaction state rows');
    exactFloatRows(preReactionThermo, thermoLength, 'pre-reaction thermo rows');
  }
  if (priorOpticsRows && seedOpticsRows) {
    throw new TypeError(
      'CPU dispersed-medium production accepts prior rows or seed rows, not both'
    );
  }
  const sourceRows = priorOpticsRows ?? seedOpticsRows;
  if (!sourceRows) {
    throw new TypeError(
      'CPU dispersed-medium production requires an immutable prior or seed declaration'
    );
  }
  const declaration = validateSphDispersedMediumOpticsProducerSeedRows({
    rows: sourceRows,
    particleCount: topology.particleCount,
    phaseCarrierPlan,
    opticalClosureTable
  });
  const reactionCapture = reactionCaptureEnabled
    ? captureReactionBornDispersedMediumRows({
        topology,
        preReactionState,
        preReactionThermo,
        postReactionState: preTransferState,
        postReactionThermo: preTransferThermo,
        priorRows: sourceRows,
        opticalClosureTable
      })
    : null;
  const productionInputRows = reactionCapture?.rows ?? sourceRows;
  const rows = productionInputRows.slice();
  let gasToCondensedMassKg = 0;
  let condensedToGasMassKg = 0;
  let totalDispersedMassKg = 0;
  let condensationRowCount = 0;
  let evaporationRowCount = 0;
  let invalidInputRowCount = reactionCapture?.invalidInputRowCount ?? 0;
  for (let particleIndex = 0;
    particleIndex < topology.particleCount;
    particleIndex += 1) {
    const opticsOffset = particleIndex * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
    if (productionInputRows[opticsOffset + 3]
      !== SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready) {
      rows.fill(0, opticsOffset + 4, opticsOffset + 8);
      continue;
    }
    const route = closureRowForOpticsPrefix(opticalClosureTable, {
      dispersedMaterialId: productionInputRows[opticsOffset],
      dispersedPhaseId: productionInputRows[opticsOffset + 1],
      opticalStateId: productionInputRows[opticsOffset + 2]
    });
    if (!route) {
      rows.fill(0, opticsOffset + 4, opticsOffset + 8);
      invalidInputRowCount += 1;
      continue;
    }
    const lineageIndex = particleIndex % topology.phaseLaneStride;
    const gasParticleIndex =
      (route.vaporPhaseId - 1) * topology.phaseLaneStride + lineageIndex;
    const condensedParticleIndex =
      (route.condensedPhaseId - 1) * topology.phaseLaneStride + lineageIndex;
    const gasToCondensed = phaseTransferContribution({
      state: preTransferState,
      thermo: preTransferThermo,
      particleIndex: gasParticleIndex,
      materialId: route.dispersedMaterialId,
      targetPhaseId: route.condensedPhaseId
    });
    const condensedToGas = phaseTransferContribution({
      state: preTransferState,
      thermo: preTransferThermo,
      particleIndex: condensedParticleIndex,
      materialId: route.dispersedMaterialId,
      targetPhaseId: route.vaporPhaseId
    });
    const postCondensed = postCondensedMass({
      state: postTransferState,
      thermo: postTransferThermo,
      particleIndex: condensedParticleIndex,
      materialId: route.dispersedMaterialId,
      condensedPhaseId: route.condensedPhaseId
    });
    const priorMassKg = Math.fround(productionInputRows[opticsOffset + 4]);
    const priorMassValid = Number.isFinite(priorMassKg) && priorMassKg >= 0;
    const transferInputsValid = priorMassValid
      && gasToCondensed.valid
      && condensedToGas.valid
      && postCondensed.valid;
    const dispersedMassKg = transferInputsValid
      ? conservativeDispersedMass({
          priorMassKg,
          gasToCondensedMassKg: gasToCondensed.massKg,
          condensedToGasMassKg: condensedToGas.massKg,
          postCondensedMassKg: postCondensed.massKg
        })
      : Math.fround(Math.min(
          postCondensed.valid ? postCondensed.massKg : 0,
          priorMassValid ? priorMassKg : 0
        ));
    if (!transferInputsValid) invalidInputRowCount += 1;
    if (gasToCondensed.massKg > 0) {
      gasToCondensedMassKg += gasToCondensed.massKg;
      condensationRowCount += 1;
    }
    if (condensedToGas.massKg > 0) {
      condensedToGasMassKg += condensedToGas.massKg;
      evaporationRowCount += 1;
    }
    const moments = deriveSphDispersedMediumOpticalMoments({
      closureRow: route,
      dispersedMassKg
    });
    if (
      moments.status !== SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready
      || moments.dispersedMaterialId !== productionInputRows[opticsOffset]
      || moments.dispersedPhaseId !== productionInputRows[opticsOffset + 1]
      || moments.opticalStateId !== productionInputRows[opticsOffset + 2]
    ) {
      throw new RangeError(
        `closure route for dispersed-medium row ${particleIndex} changed immutable identity`
      );
    }
    rows.set([
      moments.dispersedMassKg,
      moments.scatteringCrossSectionM2,
      moments.absorptionCrossSectionM2,
      moments.scatteringAsymmetryCrossSectionM2
    ], opticsOffset + 4);
    totalDispersedMassKg += moments.dispersedMassKg;
  }
  return Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_SCHEMA,
    version: SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_VERSION,
    status: invalidInputRowCount > 0
      ? 'dispersed-medium-optics-producer-reference-ready-with-conservative-input-fallback'
      : 'dispersed-medium-optics-producer-reference-ready',
    backend: 'cpu-reference',
    sourceSchema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
    particleCount: topology.particleCount,
    rowCount: topology.particleCount,
    rowCapacity: topology.particleCount,
    rowLayout: SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
    rowStrideFloats: SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
    rowStrideBytes: SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
    bufferByteLength: rows.byteLength,
    readyRowCount: reactionCapture?.readyRowCount ?? declaration.readyRowCount,
    blockedRowCount:
      reactionCapture?.blockedRowCount ?? declaration.blockedRowCount,
    readyOpticalStateIds:
      reactionCapture?.readyOpticalStateIds ?? declaration.readyOpticalStateIds,
    rows,
    gasToCondensedMassKg,
    condensedToGasMassKg,
    totalDispersedMassKg,
    condensationRowCount,
    evaporationRowCount,
    invalidInputRowCount,
    reactionCaptureEnabled,
    reactionBornMassKg: reactionCapture?.reactionBornMassKg ?? 0,
    reactionBornRowCount: reactionCapture?.reactionBornRowCount ?? 0,
    routeRemapRowCount: reactionCapture?.routeRemapRowCount ?? 0,
    ambiguousRouteRowCount:
      reactionCapture?.ambiguousRouteRowCount ?? 0,
    immutableDeclarationLanes: reactionCaptureEnabled
      ? Object.freeze([])
      : Object.freeze([0, 1, 2, 3]),
    dynamicallyResolvedDeclarationLanes: reactionCaptureEnabled
      ? Object.freeze([0, 1, 2, 3])
      : Object.freeze([]),
    updatedMomentLanes: Object.freeze([4, 5, 6, 7]),
    massAuthority:
      reactionCaptureEnabled
        ? 'reaction-born-condensed-component-plus-literal-phase-transfer-delta-clamped-to-post-condensed-carrier-mass'
        : 'literal-phase-transfer-delta-clamped-to-post-condensed-carrier-mass',
    evaporationOrdering:
      'visible-dispersed-condensate-consumed-before-pre-existing-bulk-condensed-mass',
    saturationMassInference: false,
    sourceBufferMutation: false,
    hostHotLoopReadback: false
  });
}

export const sphDispersedMediumOpticsReactionCaptureWgsl = /* wgsl */ `
struct ProducerParams {
  particle_count: u32,
  lineage_capacity: u32,
  phase_lane_count: u32,
  phase_lane_stride: u32,
  state_stride_floats: u32,
  thermo_stride_floats: u32,
  optics_stride_floats: u32,
  closure_stride_floats: u32,
  closure_row_count: u32,
  closure_version: u32,
  producer_version: u32,
  evidence_version: u32,
  phase_fraction_tolerance: f32,
  mass_epsilon_kg: f32,
  reserved0: u32,
  reserved1: u32,
};

struct ClosureRoute {
  header: vec4<u32>,
  identity: vec4<f32>,
};

struct ComponentMass {
  valid: u32,
  mass_kg: f32,
};

@group(0) @binding(0) var<storage, read> pre_reaction_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> pre_reaction_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> post_reaction_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> post_reaction_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> prior_optics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> closure_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> captured_optics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ProducerParams;

const READY_STATUS: f32 = ${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready}.0;
const BLOCKED_STATUS: f32 = ${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked}.0;
const CLOSURE_READY_STATUS: f32 = ${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready}.0;
const ERROR_LAYOUT: u32 = 1u;
const ERROR_ROUTE: u32 = 2u;
const ERROR_NONFINITE: u32 = 4u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn state0(
  rows: ptr<storage, array<vec4<f32>>, read>,
  index: u32
) -> vec4<f32> {
  return (*rows)[index * 2u];
}

fn thermo0(
  rows: ptr<storage, array<vec4<f32>>, read>,
  index: u32
) -> vec4<f32> {
  return (*rows)[index * 3u];
}

fn thermo1(
  rows: ptr<storage, array<vec4<f32>>, read>,
  index: u32
) -> vec4<f32> {
  return (*rows)[index * 3u + 1u];
}

fn missing_route() -> ClosureRoute {
  return ClosureRoute(vec4<u32>(0u), vec4<f32>(0.0));
}

fn decoded_route(row_index: u32) -> ClosureRoute {
  let base = row_index * 3u;
  let row0 = closure_rows[base];
  let row1 = closure_rows[base + 1u];
  return ClosureRoute(
    vec4<u32>(
      1u,
      u32(round(row0.y)),
      u32(round(row0.z)),
      u32(round(row1.x))
    ),
    vec4<f32>(row0.x, row0.z, row0.w, READY_STATUS)
  );
}

fn find_route(prefix: vec4<f32>) -> ClosureRoute {
  for (var row_index = 0u;
    row_index < params.closure_row_count;
    row_index += 1u) {
    let base = row_index * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    if (
      row1.y == CLOSURE_READY_STATUS
      && row0.x == prefix.x
      && row0.z == prefix.y
      && row0.w == prefix.z
    ) {
      return decoded_route(row_index);
    }
  }
  return missing_route();
}

fn component_mass(
  state_rows: ptr<storage, array<vec4<f32>>, read>,
  thermo_rows: ptr<storage, array<vec4<f32>>, read>,
  lineage_index: u32,
  material_id: f32,
  phase_id: u32
) -> ComponentMass {
  var total_mass_kg = 0.0;
  for (var phase_lane = 1u;
    phase_lane <= params.phase_lane_count;
    phase_lane += 1u) {
    let particle_index =
      (phase_lane - 1u) * params.phase_lane_stride + lineage_index;
    let mass_kg = state0(state_rows, particle_index).w;
    if (!finite_f32(mass_kg) || mass_kg < 0.0) {
      return ComponentMass(0u, 0.0);
    }
    if (!(mass_kg > params.mass_epsilon_kg)) { continue; }
    if (thermo0(thermo_rows, particle_index).x != material_id) { continue; }
    let fraction = thermo1(thermo_rows, particle_index)[phase_id - 1u];
    if (
      !finite_f32(fraction)
      || fraction < -params.phase_fraction_tolerance
      || fraction > 1.0 + params.phase_fraction_tolerance
    ) {
      return ComponentMass(0u, 0.0);
    }
    total_mass_kg += mass_kg * clamp(fraction, 0.0, 1.0);
  }
  return ComponentMass(1u, total_mass_kg);
}

@compute @workgroup_size(${SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_WORKGROUP_SIZE})
fn capture_reaction_births(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) { return; }
  let optics_base = particle_index * 2u;
  captured_optics[optics_base] =
    vec4<f32>(0.0, 0.0, 0.0, BLOCKED_STATUS);
  captured_optics[optics_base + 1u] = vec4<f32>(0.0);
  if (
    params.phase_lane_count != 4u
    || params.phase_lane_stride != params.lineage_capacity
    || params.particle_count
      != params.lineage_capacity * params.phase_lane_count
    || params.state_stride_floats != ${STATE_ROW_FLOATS}u
    || params.thermo_stride_floats != ${THERMO_ROW_FLOATS}u
    || params.optics_stride_floats
      != ${SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS}u
    || params.closure_stride_floats
      != ${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS}u
    || arrayLength(&pre_reaction_state) != params.particle_count * 2u
    || arrayLength(&pre_reaction_thermo) != params.particle_count * 3u
    || arrayLength(&post_reaction_state) != params.particle_count * 2u
    || arrayLength(&post_reaction_thermo) != params.particle_count * 3u
    || arrayLength(&prior_optics) != params.particle_count * 2u
    || arrayLength(&closure_rows) != params.closure_row_count * 3u
    || arrayLength(&captured_optics) != params.particle_count * 2u
  ) {
    atomicOr(&evidence[2u], ERROR_LAYOUT);
    return;
  }
  let phase_lane = particle_index / params.phase_lane_stride + 1u;
  let lineage_index = particle_index % params.phase_lane_stride;
  var selected_route = missing_route();
  var selected_count = 0u;
  var candidate_input_invalid = false;
  for (var row_index = 0u;
    row_index < params.closure_row_count;
    row_index += 1u) {
    let base = row_index * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    if (
      row1.y != CLOSURE_READY_STATUS
      || u32(round(row0.z)) != phase_lane
    ) { continue; }
    let component = component_mass(
      &post_reaction_state,
      &post_reaction_thermo,
      lineage_index,
      row0.x,
      u32(round(row0.z))
    );
    if (component.valid == 0u) {
      candidate_input_invalid = true;
      continue;
    }
    if (component.mass_kg > params.mass_epsilon_kg) {
      selected_route = decoded_route(row_index);
      selected_count += 1u;
    }
  }
  if (selected_count > 1u) {
    atomicOr(&evidence[2u], ERROR_ROUTE);
    atomicAdd(&evidence[8u], 1u);
    atomicAdd(&evidence[11u], 1u);
    return;
  }
  let prior_prefix = prior_optics[optics_base];
  if (selected_count == 0u && prior_prefix.w == READY_STATUS) {
    let prior_route = find_route(prior_prefix);
    if (
      prior_route.header.x != 0u
      && prior_route.header.z == phase_lane
    ) {
      selected_route = prior_route;
      selected_count = 1u;
    }
  }
  if (selected_count == 0u) {
    if (candidate_input_invalid) {
      atomicOr(&evidence[2u], ERROR_NONFINITE);
      atomicAdd(&evidence[8u], 1u);
    }
    atomicAdd(&evidence[7u], 1u);
    return;
  }
  let pre_component = component_mass(
    &pre_reaction_state,
    &pre_reaction_thermo,
    lineage_index,
    selected_route.identity.x,
    selected_route.header.z
  );
  let post_component = component_mass(
    &post_reaction_state,
    &post_reaction_thermo,
    lineage_index,
    selected_route.identity.x,
    selected_route.header.z
  );
  let prior_identity_matches =
    all(prior_prefix == selected_route.identity);
  let raw_prior_mass_kg = prior_optics[optics_base + 1u].x;
  let prior_mass_valid =
    finite_f32(raw_prior_mass_kg) && raw_prior_mass_kg >= 0.0;
  let prior_mass_kg = select(
    0.0,
    raw_prior_mass_kg,
    prior_identity_matches && prior_mass_valid
  );
  var reaction_born_mass_kg = 0.0;
  if (pre_component.valid != 0u && post_component.valid != 0u) {
    reaction_born_mass_kg = max(
      0.0,
      post_component.mass_kg - pre_component.mass_kg
    );
  } else {
    atomicOr(&evidence[2u], ERROR_NONFINITE);
    atomicAdd(&evidence[8u], 1u);
  }
  if (prior_identity_matches && !prior_mass_valid) {
    atomicOr(&evidence[2u], ERROR_NONFINITE);
    atomicAdd(&evidence[8u], 1u);
  }
  captured_optics[optics_base] = selected_route.identity;
  captured_optics[optics_base + 1u] = vec4<f32>(
    prior_mass_kg + reaction_born_mass_kg,
    0.0,
    0.0,
    0.0
  );
  if (!prior_identity_matches) {
    atomicAdd(&evidence[10u], 1u);
  }
  if (reaction_born_mass_kg > 0.0) {
    atomicAdd(&evidence[9u], 1u);
  }
  atomicAdd(&evidence[12u], 1u);
}
`;

export const sphDispersedMediumOpticsProducerWgsl = /* wgsl */ `
struct ProducerParams {
  particle_count: u32,
  lineage_capacity: u32,
  phase_lane_count: u32,
  phase_lane_stride: u32,
  state_stride_floats: u32,
  thermo_stride_floats: u32,
  optics_stride_floats: u32,
  closure_stride_floats: u32,
  closure_row_count: u32,
  closure_version: u32,
  producer_version: u32,
  evidence_version: u32,
  phase_fraction_tolerance: f32,
  mass_epsilon_kg: f32,
  reserved0: u32,
  reserved1: u32,
};

struct ClosureRoute {
  header: vec4<u32>,
  optics0: vec4<f32>,
  optics1: vec4<f32>,
};

struct TransferContribution {
  valid: u32,
  mass_kg: f32,
};

@group(0) @binding(0) var<storage, read> pre_transfer_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> pre_transfer_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> post_transfer_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> post_transfer_thermo: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> prior_optics: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> closure_rows: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_optics: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(8) var<uniform> params: ProducerParams;

const EVIDENCE_MAGIC: u32 = ${EVIDENCE_MAGIC}u;
const EVIDENCE_VERSION: u32 = ${EVIDENCE_VERSION}u;
const PRODUCER_VERSION: u32 = ${SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_VERSION}u;
const CLOSURE_VERSION: u32 = ${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION}u;
const READY_STATUS: f32 = ${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready}.0;
const BLOCKED_STATUS: f32 = ${SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked}.0;
const CLOSURE_READY_STATUS: f32 = ${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready}.0;
const COMPACT_MORPHOLOGY: u32 = ${SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.singleCompactCondensateCarrierLowerBound}u;
const MONODISPERSE_MORPHOLOGY: u32 = ${SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius}u;
const COMPACT_COMPLEX_INDEX_MORPHOLOGY: u32 = ${SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.singleCompactSphereComplexIndex}u;
const PI: f32 = 3.141592653589793;
const SPHERE_RAYLEIGH_MAX_X: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.rayleighMaxSizeParameter};
const SPHERE_RAYLEIGH_MAX_INTERNAL_X: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.rayleighMaxInternalSizeParameter};
const SPHERE_RAYLEIGH_MAX_CONTRAST_SQUARED: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.rayleighMaxContrastMagnitudeSquared};
const SPHERE_EXACT_MIE_MAX_X: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.exactMieMaxSizeParameter};
const SPHERE_EXACT_MIE_MAX_TERMS: u32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.exactMieMaxTerms}u;
const SPHERE_EXACT_MIE_MIN_INTERNAL_X_SQUARED: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.exactMieMinInternalSizeParameter ** 2};
const SPHERE_EXACT_MIE_ENERGY_RELATIVE_TOLERANCE: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.exactMieEnergyRelativeTolerance};
const SPHERE_GEOMETRIC_OPTICS_MIN_X: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.geometricOpticsMinSizeParameter};
const SPHERE_GEOMETRIC_OPTICS_MIN_CENTRAL_PHASE_DELAY: f32 = ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.geometricOpticsMinCentralPhaseDelay};
const ERROR_LAYOUT: u32 = 1u;
const ERROR_ROUTE: u32 = 2u;
const ERROR_NONFINITE: u32 = 4u;
const ERROR_PHASE: u32 = 8u;

fn finite_f32(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823e38;
}

fn state0(rows: ptr<storage, array<vec4<f32>>, read>, index: u32) -> vec4<f32> {
  return (*rows)[index * 2u];
}

fn thermo0(rows: ptr<storage, array<vec4<f32>>, read>, index: u32) -> vec4<f32> {
  return (*rows)[index * 3u];
}

fn thermo1(rows: ptr<storage, array<vec4<f32>>, read>, index: u32) -> vec4<f32> {
  return (*rows)[index * 3u + 1u];
}

fn phase_lane_index(lineage_index: u32, phase_id: u32) -> u32 {
  return (phase_id - 1u) * params.phase_lane_stride + lineage_index;
}

fn missing_route() -> ClosureRoute {
  return ClosureRoute(vec4<u32>(0u), vec4<f32>(0.0), vec4<f32>(0.0));
}

fn find_route(prefix: vec4<f32>) -> ClosureRoute {
  for (var row_index = 0u; row_index < params.closure_row_count; row_index += 1u) {
    let base = row_index * 3u;
    let row0 = closure_rows[base];
    let row1 = closure_rows[base + 1u];
    let row2 = closure_rows[base + 2u];
    if (
      row0.x == prefix.x
      && row0.z == prefix.y
      && row0.w == prefix.z
      && row1.y == CLOSURE_READY_STATUS
    ) {
      return ClosureRoute(
        vec4<u32>(1u, u32(round(row0.y)), u32(round(row0.z)), u32(round(row1.x))),
        vec4<f32>(row1.z, row1.w, row2.x, row2.y),
        vec4<f32>(row2.z, row2.w, 0.0, 0.0)
      );
    }
  }
  return missing_route();
}

fn transfer_contribution(
  particle_index: u32,
  material_id: f32,
  target_phase_id: u32
) -> TransferContribution {
  let mass_kg = state0(&pre_transfer_state, particle_index).w;
  if (!finite_f32(mass_kg) || mass_kg < 0.0) {
    return TransferContribution(0u, 0.0);
  }
  if (!(mass_kg > params.mass_epsilon_kg)) {
    return TransferContribution(1u, 0.0);
  }
  let material = thermo0(&pre_transfer_thermo, particle_index).x;
  if (material != material_id || target_phase_id < 1u || target_phase_id > 4u) {
    return TransferContribution(0u, 0.0);
  }
  let fraction = thermo1(&pre_transfer_thermo, particle_index)[target_phase_id - 1u];
  if (
    !finite_f32(fraction)
    || fraction < -params.phase_fraction_tolerance
    || fraction > 1.0 + params.phase_fraction_tolerance
  ) {
    return TransferContribution(0u, 0.0);
  }
  return TransferContribution(1u, mass_kg * clamp(fraction, 0.0, 1.0));
}

fn condensed_mass(
  particle_index: u32,
  material_id: f32,
  condensed_phase_id: u32
) -> TransferContribution {
  let mass_kg = state0(&post_transfer_state, particle_index).w;
  if (!finite_f32(mass_kg) || mass_kg < 0.0) {
    return TransferContribution(0u, 0.0);
  }
  if (!(mass_kg > params.mass_epsilon_kg)) {
    return TransferContribution(1u, 0.0);
  }
  let state = thermo0(&post_transfer_thermo, particle_index);
  if (state.x != material_id || state.y != f32(condensed_phase_id)) {
    return TransferContribution(0u, 0.0);
  }
  return TransferContribution(1u, mass_kg);
}

struct SphereEfficiencies {
  q_scattering: f32,
  q_absorption: f32,
  asymmetry: f32,
  valid: u32,
};

fn sphere_complex_add(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return a + b;
}

fn sphere_complex_sub(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return a - b;
}

fn sphere_complex_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

fn sphere_complex_div(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  let denominator = max(dot(b, b), 1e-30);
  return vec2<f32>(
    (a.x * b.x + a.y * b.y) / denominator,
    (a.y * b.x - a.x * b.y) / denominator
  );
}

fn sphere_complex_abs_squared(value: vec2<f32>) -> f32 {
  return dot(value, value);
}

fn sphere_complex_real_product_conjugate(
  left: vec2<f32>,
  right: vec2<f32>
) -> f32 {
  return dot(left, right);
}

fn sphere_rayleigh_efficiencies(
  size_parameter: f32,
  relative_index: vec2<f32>
) -> SphereEfficiencies {
  let index_squared = sphere_complex_mul(relative_index, relative_index);
  let contrast = sphere_complex_div(
    sphere_complex_sub(index_squared, vec2<f32>(1.0, 0.0)),
    sphere_complex_add(index_squared, vec2<f32>(2.0, 0.0))
  );
  let q_scattering = (8.0 / 3.0)
    * pow(size_parameter, 4.0)
    * sphere_complex_abs_squared(contrast);
  let q_absorption = max(0.0, 4.0 * size_parameter * contrast.y);
  let valid = select(
    0u,
    1u,
    finite_f32(q_scattering) && finite_f32(q_absorption)
  );
  return SphereEfficiencies(q_scattering, q_absorption, 0.0, valid);
}

fn sphere_rayleigh_domain_matches(
  size_parameter: f32,
  relative_index: vec2<f32>
) -> bool {
  if (
    size_parameter > SPHERE_RAYLEIGH_MAX_X
    || length(relative_index) * size_parameter
      > SPHERE_RAYLEIGH_MAX_INTERNAL_X
  ) {
    return false;
  }
  let index_squared = sphere_complex_mul(relative_index, relative_index);
  let contrast_denominator = sphere_complex_add(
    index_squared,
    vec2<f32>(2.0, 0.0)
  );
  let denominator_magnitude_squared = sphere_complex_abs_squared(
    contrast_denominator
  );
  if (!(denominator_magnitude_squared > 0.0)) { return false; }
  let contrast = sphere_complex_div(
    sphere_complex_sub(index_squared, vec2<f32>(1.0, 0.0)),
    contrast_denominator
  );
  let contrast_magnitude_squared = sphere_complex_abs_squared(contrast);
  return finite_f32(contrast_magnitude_squared)
    && contrast_magnitude_squared <= SPHERE_RAYLEIGH_MAX_CONTRAST_SQUARED;
}

fn sphere_lorenz_mie_efficiencies(
  size_parameter: f32,
  relative_index: vec2<f32>
) -> SphereEfficiencies {
  let mx = relative_index * size_parameter;
  if (dot(mx, mx) <= SPHERE_EXACT_MIE_MIN_INTERNAL_X_SQUARED) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
  }
  let series_terms = u32(ceil(
    size_parameter + 4.0 * pow(size_parameter, 1.0 / 3.0) + 2.0
  ));
  let downward_terms = u32(ceil(max(
    f32(series_terms + 16u),
    length(mx) + 16.0
  )));
  if (
    series_terms >= SPHERE_EXACT_MIE_MAX_TERMS
    || downward_terms >= SPHERE_EXACT_MIE_MAX_TERMS
  ) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 2u);
  }
  var logarithmic_derivative: array<vec2<f32>, ${SPHERE_OPTICAL_EFFICIENCY_NUMERIC_POLICY.exactMieMaxTerms}>;
  var downward_order = downward_terms;
  loop {
    if (downward_order == 0u) { break; }
    let order_over_mx = sphere_complex_div(
      vec2<f32>(f32(downward_order), 0.0),
      mx
    );
    logarithmic_derivative[downward_order - 1u] = sphere_complex_sub(
      order_over_mx,
      sphere_complex_div(
        vec2<f32>(1.0, 0.0),
        sphere_complex_add(
          logarithmic_derivative[downward_order],
          order_over_mx
        )
      )
    );
    downward_order -= 1u;
  }

  var psi_prior = cos(size_parameter);
  var psi_current = sin(size_parameter);
  var chi_prior = -sin(size_parameter);
  var chi_current = cos(size_parameter);
  var xi_current = vec2<f32>(psi_current, -chi_current);
  var previous_a = vec2<f32>(0.0);
  var previous_b = vec2<f32>(0.0);
  var scattering_sum = 0.0;
  var extinction_sum = 0.0;
  var asymmetry_sum = 0.0;
  for (var order = 1u; order <= series_terms; order += 1u) {
    let recurrence = f32(2u * order - 1u) / size_parameter;
    let psi_next = recurrence * psi_current - psi_prior;
    let chi_next = recurrence * chi_current - chi_prior;
    let xi_next = vec2<f32>(psi_next, -chi_next);
    let order_over_x = vec2<f32>(f32(order) / size_parameter, 0.0);
    let electric_factor = sphere_complex_add(
      sphere_complex_div(logarithmic_derivative[order], relative_index),
      order_over_x
    );
    let magnetic_factor = sphere_complex_add(
      sphere_complex_mul(relative_index, logarithmic_derivative[order]),
      order_over_x
    );
    let electric_denominator = sphere_complex_sub(
      sphere_complex_mul(electric_factor, xi_next),
      xi_current
    );
    let magnetic_denominator = sphere_complex_sub(
      sphere_complex_mul(magnetic_factor, xi_next),
      xi_current
    );
    if (
      sphere_complex_abs_squared(electric_denominator) <= 1e-30
      || sphere_complex_abs_squared(magnetic_denominator) <= 1e-30
    ) {
      return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
    }
    let electric = sphere_complex_div(
      sphere_complex_sub(electric_factor * psi_next, vec2<f32>(psi_current, 0.0)),
      electric_denominator
    );
    let magnetic = sphere_complex_div(
      sphere_complex_sub(magnetic_factor * psi_next, vec2<f32>(psi_current, 0.0)),
      magnetic_denominator
    );
    let weight = f32(2u * order + 1u);
    scattering_sum += weight * (
      sphere_complex_abs_squared(electric)
      + sphere_complex_abs_squared(magnetic)
    );
    extinction_sum += weight * (electric.x + magnetic.x);
    asymmetry_sum += (weight / f32(order * (order + 1u)))
      * sphere_complex_real_product_conjugate(electric, magnetic);
    if (order > 1u) {
      let adjacent_weight = f32((order - 1u) * (order + 1u)) / f32(order);
      asymmetry_sum += adjacent_weight * (
        sphere_complex_real_product_conjugate(previous_a, electric)
        + sphere_complex_real_product_conjugate(previous_b, magnetic)
      );
    }
    previous_a = electric;
    previous_b = magnetic;
    psi_prior = psi_current;
    psi_current = psi_next;
    chi_prior = chi_current;
    chi_current = chi_next;
    xi_current = xi_next;
  }
  let efficiency_scale = 2.0 / (size_parameter * size_parameter);
  let q_scattering = max(0.0, efficiency_scale * scattering_sum);
  let raw_q_extinction = efficiency_scale * extinction_sum;
  let energy_tolerance = SPHERE_EXACT_MIE_ENERGY_RELATIVE_TOLERANCE * max(
    1.0,
    max(q_scattering, abs(raw_q_extinction))
  );
  if (
    !finite_f32(raw_q_extinction)
    || raw_q_extinction + energy_tolerance < q_scattering
  ) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
  }
  let q_extinction = max(q_scattering, raw_q_extinction);
  let q_absorption = max(0.0, q_extinction - q_scattering);
  var asymmetry = 0.0;
  if (q_scattering > 0.0) {
    asymmetry = clamp(
      (4.0 * asymmetry_sum)
        / (size_parameter * size_parameter * q_scattering),
      -1.0,
      1.0
    );
  }
  let valid = select(
    0u,
    1u,
    finite_f32(q_scattering)
      && finite_f32(q_absorption)
      && finite_f32(asymmetry)
  );
  return SphereEfficiencies(q_scattering, q_absorption, asymmetry, valid);
}

fn sphere_geometric_optics_diffraction_efficiencies(
  size_parameter: f32,
  relative_index: vec2<f32>,
  large_size_ray_asymmetry: f32
) -> SphereEfficiencies {
  // General lossless large-sphere geometric-optics + Fraunhofer-diffraction
  // asymptotic. Qsca tends to 2; this is never interpreted as a lower bound.
  // Absorbing spheres, the 32 < x < 80 transition, and insufficient central
  // phase delay remain fail-closed rather than borrowing a soft-particle
  // approximation outside its domain.
  if (relative_index.y > 0.0) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
  }
  if (relative_index.x == 1.0) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 1u);
  }
  if (size_parameter < SPHERE_GEOMETRIC_OPTICS_MIN_X) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
  }
  let central_phase_delay = 2.0
    * size_parameter
    * abs(relative_index.x - 1.0);
  if (
    central_phase_delay
      < SPHERE_GEOMETRIC_OPTICS_MIN_CENTRAL_PHASE_DELAY
  ) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
  }
  let diffraction_asymmetry = clamp(
    1.0 - 1.0 / (2.0 * size_parameter * size_parameter),
    0.0,
    1.0
  );
  let asymmetry = clamp(
    0.5 * (diffraction_asymmetry + large_size_ray_asymmetry),
    -1.0,
    1.0
  );
  let valid = select(0u, 1u, finite_f32(asymmetry));
  return SphereEfficiencies(2.0, 0.0, asymmetry, valid);
}

fn compact_sphere_efficiencies(
  radius_m: f32,
  reference_wavelength_m: f32,
  relative_index_n: f32,
  relative_extinction_k: f32,
  large_size_ray_asymmetry: f32
) -> SphereEfficiencies {
  if (
    !(radius_m > 0.0)
    || !(reference_wavelength_m > 0.0)
    || !(relative_index_n > 0.0)
    || relative_extinction_k < 0.0
    || abs(large_size_ray_asymmetry) > 1.0
  ) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 0u);
  }
  let size_parameter = (2.0 * PI * radius_m) / reference_wavelength_m;
  let relative_index = vec2<f32>(relative_index_n, relative_extinction_k);
  if (relative_index_n == 1.0 && relative_extinction_k == 0.0) {
    return SphereEfficiencies(0.0, 0.0, 0.0, 1u);
  }
  if (sphere_rayleigh_domain_matches(size_parameter, relative_index)) {
    return sphere_rayleigh_efficiencies(size_parameter, relative_index);
  }
  if (size_parameter <= SPHERE_EXACT_MIE_MAX_X) {
    let exact = sphere_lorenz_mie_efficiencies(size_parameter, relative_index);
    // Any exact-series failure, including the deterministic term cap, remains
    // fail-closed. The large-sphere approximation is valid only by x-domain;
    // it is never a fallback for an unsupported material/index combination.
    return exact;
  }
  return sphere_geometric_optics_diffraction_efficiencies(
    size_parameter,
    relative_index,
    large_size_ray_asymmetry
  );
}

fn optical_moments(route: ClosureRoute, mass_kg: f32) -> vec4<f32> {
  if (!(mass_kg > 0.0)) {
    return vec4<f32>(0.0);
  }
  let morphology = route.header.w;
  let density = route.optics0.x;
  var q_scattering = route.optics0.y;
  var q_absorption = route.optics0.z;
  var asymmetry_factor = route.optics0.w;
  var geometric_cross_section_m2 = 0.0;
  var radius_m = 0.0;
  if (
    morphology == COMPACT_MORPHOLOGY
    || morphology == COMPACT_COMPLEX_INDEX_MORPHOLOGY
  ) {
    radius_m = pow(mass_kg / ((4.0 * PI / 3.0) * density), 1.0 / 3.0);
    geometric_cross_section_m2 = PI * radius_m * radius_m;
  } else if (morphology == MONODISPERSE_MORPHOLOGY) {
    let radius_m = route.optics1.x;
    geometric_cross_section_m2 = (0.75 * mass_kg) / (density * radius_m);
  } else {
    return vec4<f32>(mass_kg, 0.0, 0.0, 0.0);
  }
  if (morphology == COMPACT_COMPLEX_INDEX_MORPHOLOGY) {
    let efficiencies = compact_sphere_efficiencies(
      radius_m,
      route.optics1.y,
      route.optics0.y,
      route.optics0.z,
      route.optics0.w
    );
    if (efficiencies.valid == 0u) {
      return vec4<f32>(mass_kg, 0.0, 0.0, 0.0);
    }
    q_scattering = efficiencies.q_scattering;
    q_absorption = efficiencies.q_absorption;
    asymmetry_factor = efficiencies.asymmetry;
  }
  let scattering_m2 = q_scattering * geometric_cross_section_m2;
  let absorption_m2 = q_absorption * geometric_cross_section_m2;
  let asymmetry_m2 = clamp(
    asymmetry_factor * scattering_m2,
    -scattering_m2,
    scattering_m2
  );
  if (
    !finite_f32(geometric_cross_section_m2)
    || !finite_f32(scattering_m2)
    || !finite_f32(absorption_m2)
    || !finite_f32(asymmetry_m2)
    || scattering_m2 < 0.0
    || absorption_m2 < 0.0
  ) {
    return vec4<f32>(mass_kg, 0.0, 0.0, 0.0);
  }
  return vec4<f32>(mass_kg, scattering_m2, absorption_m2, asymmetry_m2);
}

@compute @workgroup_size(1)
fn preflight(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x != 0u) { return; }
  if (
    params.phase_lane_count != 4u
    || params.phase_lane_stride != params.lineage_capacity
    || params.particle_count != params.lineage_capacity * params.phase_lane_count
    || params.state_stride_floats != ${STATE_ROW_FLOATS}u
    || params.thermo_stride_floats != ${THERMO_ROW_FLOATS}u
    || params.optics_stride_floats != ${SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS}u
    || params.closure_stride_floats != ${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS}u
    || params.closure_row_count == 0u
    || params.closure_version != CLOSURE_VERSION
    || params.producer_version != PRODUCER_VERSION
    || params.evidence_version != EVIDENCE_VERSION
    || arrayLength(&pre_transfer_state) != params.particle_count * 2u
    || arrayLength(&pre_transfer_thermo) != params.particle_count * 3u
    || arrayLength(&post_transfer_state) != params.particle_count * 2u
    || arrayLength(&post_transfer_thermo) != params.particle_count * 3u
    || arrayLength(&prior_optics) != params.particle_count * 2u
    || arrayLength(&closure_rows) != params.closure_row_count * 3u
    || arrayLength(&out_optics) != params.particle_count * 2u
    || arrayLength(&evidence) != ${SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_EVIDENCE_WORDS}u
    || atomicLoad(&evidence[0u]) != EVIDENCE_MAGIC
    || atomicLoad(&evidence[1u]) != EVIDENCE_VERSION
  ) {
    atomicOr(&evidence[2u], ERROR_LAYOUT);
  }
}

@compute @workgroup_size(${SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_WORKGROUP_SIZE})
fn apply_production(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) { return; }
  let optics_base = particle_index * 2u;
  // Declaration identity/status are immutable. The producer writes only the
  // second vec4: conserved mass and its extensive optical moments.
  out_optics[optics_base] = prior_optics[optics_base];
  out_optics[optics_base + 1u] = prior_optics[optics_base + 1u];
  if ((atomicLoad(&evidence[2u]) & ERROR_LAYOUT) != 0u) { return; }
  let prefix = prior_optics[optics_base];
  if (prefix.w == BLOCKED_STATUS) {
    out_optics[optics_base + 1u] = vec4<f32>(0.0);
    atomicAdd(&evidence[7u], 1u);
    return;
  }
  if (prefix.w != READY_STATUS) {
    out_optics[optics_base + 1u] = vec4<f32>(0.0);
    atomicOr(&evidence[2u], ERROR_ROUTE);
    atomicAdd(&evidence[8u], 1u);
    return;
  }
  let route = find_route(prefix);
  if (route.header.x == 0u) {
    out_optics[optics_base + 1u] = vec4<f32>(0.0);
    atomicOr(&evidence[2u], ERROR_ROUTE);
    atomicAdd(&evidence[8u], 1u);
    return;
  }
  let vapor_phase_id = route.header.y;
  let condensed_phase_id = route.header.z;
  let phase_lane = particle_index / params.phase_lane_stride + 1u;
  if (
    vapor_phase_id < 1u || vapor_phase_id > 4u
    || condensed_phase_id < 1u || condensed_phase_id > 4u
    || vapor_phase_id == condensed_phase_id
    || phase_lane != condensed_phase_id
  ) {
    out_optics[optics_base + 1u] = vec4<f32>(0.0);
    atomicOr(&evidence[2u], ERROR_PHASE);
    atomicAdd(&evidence[8u], 1u);
    return;
  }
  let lineage_index = particle_index % params.phase_lane_stride;
  let gas_index = phase_lane_index(lineage_index, vapor_phase_id);
  let condensed_index = phase_lane_index(lineage_index, condensed_phase_id);
  let gas_to_condensed = transfer_contribution(
    gas_index,
    prefix.x,
    condensed_phase_id
  );
  let condensed_to_gas = transfer_contribution(
    condensed_index,
    prefix.x,
    vapor_phase_id
  );
  let post_condensed = condensed_mass(
    condensed_index,
    prefix.x,
    condensed_phase_id
  );
  let prior_mass_kg = prior_optics[optics_base + 1u].x;
  let prior_valid = finite_f32(prior_mass_kg) && prior_mass_kg >= 0.0;
  var dispersed_mass_kg = 0.0;
  if (
    prior_valid
    && gas_to_condensed.valid != 0u
    && condensed_to_gas.valid != 0u
    && post_condensed.valid != 0u
  ) {
    dispersed_mass_kg = clamp(
      prior_mass_kg + gas_to_condensed.mass_kg - condensed_to_gas.mass_kg,
      0.0,
      post_condensed.mass_kg
    );
  } else {
    let safe_prior = select(0.0, prior_mass_kg, prior_valid);
    let safe_post = select(0.0, post_condensed.mass_kg, post_condensed.valid != 0u);
    dispersed_mass_kg = min(safe_prior, safe_post);
    atomicOr(&evidence[2u], ERROR_NONFINITE);
    atomicAdd(&evidence[8u], 1u);
  }
  out_optics[optics_base + 1u] = optical_moments(route, dispersed_mass_kg);
  if (gas_to_condensed.mass_kg > 0.0) {
    atomicAdd(&evidence[4u], 1u);
  }
  if (condensed_to_gas.mass_kg > 0.0) {
    atomicAdd(&evidence[5u], 1u);
  }
  atomicAdd(&evidence[3u], 1u);
  atomicAdd(&evidence[6u], 1u);
}
`;

function producerBindings() {
  return [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'uniform')
  ];
}

export function sphDispersedMediumOpticsProducerPipelineDescriptors() {
  const bindings = producerBindings();
  return Object.freeze([
    Object.freeze({
      cacheKey:
        'ulg-sph-dispersed-medium-optics-producer.v1.capture-reaction-births',
      label:
        'ulg-sph-dispersed-medium-optics-producer-capture-reaction-births',
      code: sphDispersedMediumOpticsReactionCaptureWgsl,
      entryPoint: 'capture_reaction_births',
      bindings
    }),
    Object.freeze({
      cacheKey: 'ulg-sph-dispersed-medium-optics-producer.v1.preflight',
      label: 'ulg-sph-dispersed-medium-optics-producer-preflight',
      code: sphDispersedMediumOpticsProducerWgsl,
      entryPoint: 'preflight',
      bindings
    }),
    Object.freeze({
      cacheKey: 'ulg-sph-dispersed-medium-optics-producer.v1.apply',
      label: 'ulg-sph-dispersed-medium-optics-producer-apply',
      code: sphDispersedMediumOpticsProducerWgsl,
      entryPoint: 'apply_production',
      bindings
    })
  ]);
}

export function enumerateSphDispersedMediumOpticsProducerPrewarmPipelineDescriptors() {
  return [...sphDispersedMediumOpticsProducerPipelineDescriptors()];
}

function exactDeviceLimit(device, name) {
  const value = Number(device?.limits?.[name]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(
      `Dispersed-medium optics production requires exact ${name} device authority`
    );
  }
  return value;
}

function validateDeviceLimits(device, {
  particleCount,
  stateBufferByteLength,
  thermoBufferByteLength,
  opticsBufferByteLength,
  closureBufferByteLength
}) {
  const limits = Object.freeze({
    maxStorageBuffersPerShaderStage: exactDeviceLimit(
      device,
      'maxStorageBuffersPerShaderStage'
    ),
    maxBufferSize: exactDeviceLimit(device, 'maxBufferSize'),
    maxStorageBufferBindingSize: exactDeviceLimit(
      device,
      'maxStorageBufferBindingSize'
    ),
    maxUniformBufferBindingSize: exactDeviceLimit(
      device,
      'maxUniformBufferBindingSize'
    ),
    maxComputeInvocationsPerWorkgroup: exactDeviceLimit(
      device,
      'maxComputeInvocationsPerWorkgroup'
    ),
    maxComputeWorkgroupSizeX: exactDeviceLimit(
      device,
      'maxComputeWorkgroupSizeX'
    ),
    maxComputeWorkgroupsPerDimension: exactDeviceLimit(
      device,
      'maxComputeWorkgroupsPerDimension'
    )
  });
  if (limits.maxStorageBuffersPerShaderStage < 8) {
    throw new RangeError(
      'Dispersed-medium optics production requires eight storage bindings'
    );
  }
  if (
    limits.maxComputeInvocationsPerWorkgroup
      < SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_WORKGROUP_SIZE
    || limits.maxComputeWorkgroupSizeX
      < SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_WORKGROUP_SIZE
  ) {
    throw new RangeError(
      'Dispersed-medium optics production exceeds the compute workgroup limit'
    );
  }
  if (limits.maxUniformBufferBindingSize < PARAMS_BYTES) {
    throw new RangeError(
      'Dispersed-medium optics producer params exceed the uniform binding limit'
    );
  }
  for (const [label, byteLength] of [
    ['state rows', stateBufferByteLength],
    ['thermo rows', thermoBufferByteLength],
    ['optics rows', opticsBufferByteLength],
    ['closure rows', closureBufferByteLength],
    ['producer evidence', EVIDENCE_BYTES]
  ]) {
    if (
      byteLength > limits.maxBufferSize
      || byteLength > limits.maxStorageBufferBindingSize
    ) {
      throw new RangeError(
        `Dispersed-medium ${label} exceed the exact WebGPU buffer limit`
      );
    }
  }
  const dispatchWorkgroupCount = Math.ceil(
    particleCount / SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_WORKGROUP_SIZE
  );
  if (dispatchWorkgroupCount > limits.maxComputeWorkgroupsPerDimension) {
    throw new RangeError(
      'Dispersed-medium optics production exceeds the compute dispatch limit'
    );
  }
  return Object.freeze({ ...limits, dispatchWorkgroupCount });
}

function requireExactStorageBuffer(device, buffer, byteLength, label) {
  if (!buffer || webGpuBufferDevice(buffer) !== device) {
    throw new TypeError(
      `Dispersed-medium optics ${label} must be an exact same-device GPU buffer`
    );
  }
  if (Number(buffer.size) !== byteLength) {
    throw new RangeError(
      `Dispersed-medium optics ${label} must have the exact dense byte length`
    );
  }
  const usage = Number(buffer.usage);
  if (
    !Number.isSafeInteger(usage)
    || (usage & GPU_BUFFER_USAGE.STORAGE) !== GPU_BUFFER_USAGE.STORAGE
  ) {
    throw new RangeError(
      `Dispersed-medium optics ${label} lacks GPUBufferUsage.STORAGE`
    );
  }
  return buffer;
}

function createParamsArray(topology, closureRowCount) {
  const buffer = new ArrayBuffer(PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, topology.particleCount, true);
  view.setUint32(4, topology.lineageCapacity, true);
  view.setUint32(8, topology.phaseLaneCount, true);
  view.setUint32(12, topology.phaseLaneStride, true);
  view.setUint32(16, STATE_ROW_FLOATS, true);
  view.setUint32(20, THERMO_ROW_FLOATS, true);
  view.setUint32(24, SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS, true);
  view.setUint32(28, SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS, true);
  view.setUint32(32, closureRowCount, true);
  view.setUint32(36, SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION, true);
  view.setUint32(40, SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_VERSION, true);
  view.setUint32(44, EVIDENCE_VERSION, true);
  view.setFloat32(48, PHASE_FRACTION_TOLERANCE, true);
  view.setFloat32(52, MASS_EPSILON_KG, true);
  return buffer;
}

function initialEvidence() {
  const words = new Uint32Array(
    SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_EVIDENCE_WORDS
  );
  words[0] = EVIDENCE_MAGIC;
  words[1] = EVIDENCE_VERSION;
  return words;
}

function createOwnedBuffer(device, descriptor) {
  const buffer = device.createBuffer(descriptor);
  try {
    return tagWebGpuBufferDevice(buffer, device);
  } catch (error) {
    try { buffer?.destroy?.(); } catch {}
    throw error;
  }
}

function uploadOwnedRows(device, label, rows) {
  const buffer = createOwnedBuffer(device, {
    label,
    size: rows.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    device.queue.writeBuffer(buffer, 0, rows);
    return buffer;
  } catch (error) {
    try { buffer.destroy?.(); } catch {}
    throw error;
  }
}

/**
 * Create an encode-only producer stage. It does not submit work, wait on a
 * queue fence, or read data back. The caller owns submission ordering and must
 * retain transient inputs through completion before calling cleanupSubmittedWork.
 */
export function createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
  device,
  phaseCarrierPlan,
  particleCount = phaseCarrierPlan?.particleCapacity,
  particleLineage,
  preReactionStateBuffer = null,
  preReactionThermoBuffer = null,
  preTransferStateBuffer,
  preTransferThermoBuffer,
  postTransferStateBuffer,
  postTransferThermoBuffer,
  priorOptics = null,
  seedOpticsRows = null,
  opticalClosureTable,
  opticalClosureGpuTable = null,
  label = 'ulg-sph-dispersed-medium-optics-producer'
} = {}) {
  if (
    !device?.createBuffer
    || !device?.queue?.writeBuffer
    || !device?.createBindGroup
    || !device?.createShaderModule
    || !device?.createBindGroupLayout
    || !device?.createPipelineLayout
    || !device?.createComputePipeline
  ) {
    throw new TypeError(
      'Dispersed-medium optics production requires a WebGPU-like device'
    );
  }
  const topology = validateFourLanePlan(phaseCarrierPlan, particleCount);
  if ((preReactionStateBuffer == null) !== (preReactionThermoBuffer == null)) {
    throw new TypeError(
      'Dispersed-medium reaction capture requires both pre-reaction state and thermo buffers'
    );
  }
  const reactionCaptureEnabled = preReactionStateBuffer != null;
  const requestedOpticalClosureTable =
    snapshotSphDispersedMediumOpticalClosureTable(opticalClosureTable);
  const resolvedOpticalClosureGpuTable = opticalClosureGpuTable
    ? resolveSphDispersedMediumOpticalClosureGpuTable(
        opticalClosureGpuTable,
        { device, table: requestedOpticalClosureTable }
      )
    : null;
  const resolvedOpticalClosureTable =
    resolvedOpticalClosureGpuTable?.table ?? requestedOpticalClosureTable;
  validateProducerClosureTable(resolvedOpticalClosureTable);
  const hasPriorOptics = priorOptics != null;
  if (hasPriorOptics && seedOpticsRows) {
    throw new TypeError(
      'Dispersed-medium optics production accepts a prior GPU buffer or seed rows, not both'
    );
  }
  if (!hasPriorOptics && !seedOpticsRows) {
    throw new TypeError(
      'Dispersed-medium optics production requires a prior buffer or preregistered seed rows'
    );
  }
  const stateBufferByteLength = checkedByteLength(
    topology.particleCount,
    STATE_ROW_FLOATS,
    'particle state'
  );
  const thermoBufferByteLength = checkedByteLength(
    topology.particleCount,
    THERMO_ROW_FLOATS,
    'particle thermo'
  );
  const opticsBufferByteLength = checkedByteLength(
    topology.particleCount,
    SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
    'dispersed-medium optics'
  );
  const closureBufferByteLength = checkedByteLength(
    resolvedOpticalClosureTable.rowCount,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
    'dispersed-medium closure'
  );
  const deviceLimits = validateDeviceLimits(device, {
    particleCount: topology.particleCount,
    stateBufferByteLength,
    thermoBufferByteLength,
    opticsBufferByteLength,
    closureBufferByteLength
  });
  const sourceBuffers = [
    requireExactStorageBuffer(
      device,
      preTransferStateBuffer,
      stateBufferByteLength,
      'preTransferStateBuffer'
    ),
    requireExactStorageBuffer(
      device,
      preTransferThermoBuffer,
      thermoBufferByteLength,
      'preTransferThermoBuffer'
    ),
    requireExactStorageBuffer(
      device,
      postTransferStateBuffer,
      stateBufferByteLength,
      'postTransferStateBuffer'
    ),
    requireExactStorageBuffer(
      device,
      postTransferThermoBuffer,
      thermoBufferByteLength,
      'postTransferThermoBuffer'
    )
  ];
  if (new Set(sourceBuffers).size !== sourceBuffers.length) {
    throw new RangeError(
      'Dispersed-medium optics production requires distinct pre/post state and thermo buffers'
    );
  }
  const reactionSourceBuffers = reactionCaptureEnabled
    ? [
        requireExactStorageBuffer(
          device,
          preReactionStateBuffer,
          stateBufferByteLength,
          'preReactionStateBuffer'
        ),
        requireExactStorageBuffer(
          device,
          preReactionThermoBuffer,
          thermoBufferByteLength,
          'preReactionThermoBuffer'
        )
      ]
    : [];
  if (
    reactionCaptureEnabled
    && reactionSourceBuffers[0] === reactionSourceBuffers[1]
  ) {
    throw new RangeError(
      'Dispersed-medium reaction capture requires distinct state and thermo buffers'
    );
  }
  const boundParticleLineage = canonicalProducerParticleLineage(
    device,
    topology.particleCount,
    particleLineage
  );
  const preTransferParticleSourceFamily =
    canonicalProducerParticleSourceFamily(
      device,
      topology.particleCount,
      boundParticleLineage,
      preTransferStateBuffer,
      preTransferThermoBuffer
    );
  const preReactionParticleSourceFamily = reactionCaptureEnabled
    ? canonicalProducerParticleSourceFamily(
        device,
        topology.particleCount,
        boundParticleLineage,
        preReactionStateBuffer,
        preReactionThermoBuffer
      )
    : preTransferParticleSourceFamily;
  const postTransferParticleSourceFamily =
    canonicalProducerParticleSourceFamily(
      device,
      topology.particleCount,
      boundParticleLineage,
      postTransferStateBuffer,
      postTransferThermoBuffer
    );
  const priorAdoptionDeclaration = hasPriorOptics
    ? snapshotSphDispersedMediumGpuBufferDeclaration(
        priorOptics,
        {
          device,
          particleSourceFamily: preTransferParticleSourceFamily
        }
      )
    : null;
  const priorOpticsBuffer = priorAdoptionDeclaration?.buffer ?? null;
  const privateAdoptionDeclaration = canonicalProducerAdoptionDeclaration({
    packed: priorAdoptionDeclaration,
    rows: priorAdoptionDeclaration?.rows ?? seedOpticsRows,
    particleCount: topology.particleCount,
    phaseCarrierPlan,
    opticalClosureTable: resolvedOpticalClosureTable,
    dynamicRouteIdentity: reactionCaptureEnabled,
    source: priorOpticsBuffer
      ? 'private-authenticated-prior-resident-declaration-snapshot'
      : 'derived-from-preregistered-seed-rows'
  });
  const declaration = Object.freeze({
    particleCount: privateAdoptionDeclaration.particleCount,
    rowCount: privateAdoptionDeclaration.rowCount,
    rowCapacity: privateAdoptionDeclaration.rowCapacity,
    readyRowCount: privateAdoptionDeclaration.readyRowCount,
    blockedRowCount: privateAdoptionDeclaration.blockedRowCount,
    readyOpticalStateIds:
      privateAdoptionDeclaration.readyOpticalStateIds,
    declarationMode: privateAdoptionDeclaration.declarationMode,
    initialReadyRowCount:
      privateAdoptionDeclaration.initialReadyRowCount,
    initialBlockedRowCount:
      privateAdoptionDeclaration.initialBlockedRowCount,
    initialReadyOpticalStateIds:
      privateAdoptionDeclaration.initialReadyOpticalStateIds,
    eligibleOpticalStateIds:
      privateAdoptionDeclaration.eligibleOpticalStateIds,
    eligibleOpticalStateRouteCount:
      privateAdoptionDeclaration.eligibleOpticalStateRouteCount,
    routeCatalogRowCount:
      privateAdoptionDeclaration.routeCatalogRowCount,
    routeCatalogSignature:
      privateAdoptionDeclaration.routeCatalogSignature,
    rowStrideFloats: privateAdoptionDeclaration.rowStrideFloats,
    rowStrideBytes: privateAdoptionDeclaration.rowStrideBytes,
    bufferByteLength: privateAdoptionDeclaration.bufferByteLength
  });
  if (priorOpticsBuffer) {
    requireExactStorageBuffer(
      device,
      priorOpticsBuffer,
      opticsBufferByteLength,
      'priorOpticsBuffer'
    );
  }
  const opticalClosureTableBuffer =
    resolvedOpticalClosureGpuTable?.buffer ?? null;
  if (opticalClosureTableBuffer) {
    requireExactStorageBuffer(
      device,
      opticalClosureTableBuffer,
      closureBufferByteLength,
      'opticalClosureTableBuffer'
    );
  }
  const externalBuffers = [
    ...sourceBuffers,
    priorOpticsBuffer,
    opticalClosureTableBuffer
  ].filter(Boolean);
  if (new Set(externalBuffers).size !== externalBuffers.length) {
    throw new RangeError(
      'Dispersed-medium optics production rejects aliased input buffer roles'
    );
  }
  if (
    reactionSourceBuffers.some((buffer) => (
      buffer === priorOpticsBuffer || buffer === opticalClosureTableBuffer
    ))
  ) {
    throw new RangeError(
      'Dispersed-medium reaction capture rejects particle/static buffer aliasing'
    );
  }

  const allocated = [];
  const own = (buffer) => {
    allocated.push(buffer);
    return buffer;
  };
  const destroyAllocated = () => {
    let firstError = null;
    const destroyed = new Set();
    for (const buffer of allocated.splice(0).reverse()) {
      if (!buffer || destroyed.has(buffer)) continue;
      try { buffer.destroy?.(); } catch (error) { firstError ??= error; }
      destroyed.add(buffer);
    }
    if (firstError) throw firstError;
    return true;
  };
  let releaseOpticalClosureGpuTableBorrow = null;
  let releasePriorOpticsBorrow = null;
  try {
    if (priorOptics) {
      releasePriorOpticsBorrow = beginSphDispersedMediumGpuBufferBorrow(
        device,
        priorOptics
      );
    }
    if (opticalClosureGpuTable) {
      releaseOpticalClosureGpuTableBorrow =
        beginSphDispersedMediumOpticalClosureGpuTableBorrow(
          device,
          opticalClosureGpuTable,
          { table: resolvedOpticalClosureTable }
        );
    }
    const resolvedPriorOpticsBuffer = priorOpticsBuffer ?? own(uploadOwnedRows(
      device,
      `${label}-seed-optics`,
      privateAdoptionDeclaration.rows
    ));
    const resolvedClosureBuffer = opticalClosureTableBuffer ?? own(uploadOwnedRows(
      device,
      `${label}-closure-rows`,
      resolvedOpticalClosureTable.rows
    ));
    const reactionCaptureBuffer = reactionCaptureEnabled
      ? own(createOwnedBuffer(device, {
          label: `${label}-reaction-capture`,
          size: opticsBufferByteLength,
          usage: GPU_BUFFER_USAGE.STORAGE
        }))
      : null;
    const productionInputOpticsBuffer =
      reactionCaptureBuffer ?? resolvedPriorOpticsBuffer;
    const outputBuffer = own(createOwnedBuffer(device, {
      label: `${label}-output`,
      size: opticsBufferByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    }));
    const evidenceValues = initialEvidence();
    const evidenceBuffer = own(createOwnedBuffer(device, {
      label: `${label}-evidence`,
      size: EVIDENCE_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST
    }));
    device.queue.writeBuffer(evidenceBuffer, 0, evidenceValues);
    const paramsBuffer = own(createOwnedBuffer(device, {
      label: `${label}-params`,
      size: PARAMS_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }));
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      createParamsArray(topology, resolvedOpticalClosureTable.rowCount)
    );

    const pipelineDescriptors =
      sphDispersedMediumOpticsProducerPipelineDescriptors();
    const captureDescriptor = pipelineDescriptors.find(
      (descriptor) => descriptor.entryPoint === 'capture_reaction_births'
    );
    const preflightDescriptor = pipelineDescriptors.find(
      (descriptor) => descriptor.entryPoint === 'preflight'
    );
    const applyDescriptor = pipelineDescriptors.find(
      (descriptor) => descriptor.entryPoint === 'apply_production'
    );
    const capturePipeline = reactionCaptureEnabled
      ? createCachedExplicitComputePipeline(device, captureDescriptor)
      : null;
    const preflightPipeline = createCachedExplicitComputePipeline(
      device,
      preflightDescriptor
    );
    const applyPipeline = createCachedExplicitComputePipeline(
      device,
      applyDescriptor
    );
    const applyEntries = [
      {
        binding: 0,
        resource: { buffer: preTransferStateBuffer, size: stateBufferByteLength }
      },
      {
        binding: 1,
        resource: { buffer: preTransferThermoBuffer, size: thermoBufferByteLength }
      },
      {
        binding: 2,
        resource: { buffer: postTransferStateBuffer, size: stateBufferByteLength }
      },
      {
        binding: 3,
        resource: { buffer: postTransferThermoBuffer, size: thermoBufferByteLength }
      },
      {
        binding: 4,
        resource: {
          buffer: productionInputOpticsBuffer,
          size: opticsBufferByteLength
        }
      },
      {
        binding: 5,
        resource: { buffer: resolvedClosureBuffer, size: closureBufferByteLength }
      },
      {
        binding: 6,
        resource: { buffer: outputBuffer, size: opticsBufferByteLength }
      },
      {
        binding: 7,
        resource: { buffer: evidenceBuffer, size: EVIDENCE_BYTES }
      },
      {
        binding: 8,
        resource: { buffer: paramsBuffer, size: PARAMS_BYTES }
      }
    ];
    const preflightBindGroup = device.createBindGroup({
      label: `${label}-preflight-bind-group`,
      layout: preflightPipeline.bindGroupLayout,
      entries: applyEntries
    });
    const applyBindGroup = device.createBindGroup({
      label: `${label}-apply-bind-group`,
      layout: applyPipeline.bindGroupLayout,
      entries: applyEntries
    });
    const captureBindGroup = reactionCaptureEnabled
      ? device.createBindGroup({
          label: `${label}-reaction-capture-bind-group`,
          layout: capturePipeline.bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: {
                buffer: preReactionStateBuffer,
                size: stateBufferByteLength
              }
            },
            {
              binding: 1,
              resource: {
                buffer: preReactionThermoBuffer,
                size: thermoBufferByteLength
              }
            },
            {
              binding: 2,
              resource: {
                buffer: preTransferStateBuffer,
                size: stateBufferByteLength
              }
            },
            {
              binding: 3,
              resource: {
                buffer: preTransferThermoBuffer,
                size: thermoBufferByteLength
              }
            },
            {
              binding: 4,
              resource: {
                buffer: resolvedPriorOpticsBuffer,
                size: opticsBufferByteLength
              }
            },
            {
              binding: 5,
              resource: {
                buffer: resolvedClosureBuffer,
                size: closureBufferByteLength
              }
            },
            {
              binding: 6,
              resource: {
                buffer: reactionCaptureBuffer,
                size: opticsBufferByteLength
              }
            },
            {
              binding: 7,
              resource: { buffer: evidenceBuffer, size: EVIDENCE_BYTES }
            },
            {
              binding: 8,
              resource: { buffer: paramsBuffer, size: PARAMS_BYTES }
            }
          ]
        })
      : null;
    let submittedCleanupComplete = false;
    let opticalClosureBorrowReleased = false;
    let priorOpticsBorrowReleased = false;
    let outputCleanupComplete = false;
    let outputOwnershipTransferred = false;
    let encodeState = 'constructed';
    const transientBuffers = [
      ...(priorOpticsBuffer ? [] : [resolvedPriorOpticsBuffer]),
      ...(opticalClosureTableBuffer ? [] : [resolvedClosureBuffer]),
      ...(reactionCaptureBuffer ? [reactionCaptureBuffer] : []),
      evidenceBuffer,
      paramsBuffer
    ];
    const removeAllocated = (buffer) => {
      const index = allocated.indexOf(buffer);
      if (index >= 0) allocated.splice(index, 1);
    };
    const cleanupSubmittedWork = () => {
      if (submittedCleanupComplete) return true;
      if (encodeState === 'encoding') {
        throw producerAdoptionAuthorityError(
          'Dispersed-medium optics submitted-work cleanup is quarantined while encoding'
        );
      }
      let firstError = null;
      for (const buffer of transientBuffers) {
        try {
          buffer.destroy?.();
          removeAllocated(buffer);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (
        releaseOpticalClosureGpuTableBorrow
        && !opticalClosureBorrowReleased
      ) {
        try {
          if (releaseOpticalClosureGpuTableBorrow() !== true) {
            throw new TypeError(
              'Dispersed-medium closure GPU-table borrow was already released'
            );
          }
          opticalClosureBorrowReleased = true;
        } catch (error) {
          firstError ??= error;
        }
      }
      if (releasePriorOpticsBorrow && !priorOpticsBorrowReleased) {
        try {
          if (releasePriorOpticsBorrow() !== true) {
            throw new TypeError(
              'Dispersed-medium prior-optics borrow was already released'
            );
          }
          priorOpticsBorrowReleased = true;
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError) throw firstError;
      submittedCleanupComplete = true;
      if (encodeState === 'constructed') {
        encodeState = 'resources-retired-before-encode';
        if (producerOutputAdoptionRecord) {
          producerOutputAdoptionRecord.encodeState = encodeState;
          setProducerAdoptionDiagnostic(
            producerOutputAdoptionRecord,
            encodeState
          );
        }
      }
      return true;
    };
    let result = null;
    let producerOutputAdoptionRecord = null;
    const cleanupRetainedOutput = () => {
      if (outputCleanupComplete) return true;
      if (
        encodeState === 'encoding'
        || producerOutputAdoptionRecord
        && (
          producerOutputAdoptionRecord.state === 'adoption-preflight'
          || producerOutputAdoptionRecord.state === 'adoption-in-progress'
          || producerOutputAdoptionRecord.state === 'adopted-pending-transfer'
          || producerOutputAdoptionRecord.state
            === 'adoption-rollback-failed-quarantined'
        )
      ) {
        throw producerAdoptionAuthorityError(
          'Dispersed-medium optics output cleanup is quarantined while encoding or during unresolved adoption'
        );
      }
      outputBuffer.destroy?.();
      removeAllocated(outputBuffer);
      outputCleanupComplete = true;
      if (producerOutputAdoptionRecord) {
        producerOutputAdoptionRecord.state = 'output-retired';
        setProducerAdoptionDiagnostic(
          producerOutputAdoptionRecord,
          'output-retired'
        );
      }
      if (result) {
        try { result.ownsBuffer = false; } catch {}
        try { result.ownsOutputBuffer = false; } catch {}
      }
      return true;
    };
    const transferOutputBufferOwnership = (
      expectedOutputBuffer = outputBuffer,
      adoptionReceipt = null
    ) => {
      if (expectedOutputBuffer !== outputBuffer) {
        throw new TypeError(
          'Dispersed-medium optics output ownership requires the exact produced buffer'
        );
      }
      if (
        !producerOutputAdoptionRecord
        || producerAdoptionReceiptRecords.get(adoptionReceipt)
          !== producerOutputAdoptionRecord
        || producerOutputAdoptionRecord.adoptionReceipt !== adoptionReceipt
        || producerOutputAdoptionRecord.state !== 'adopted-pending-transfer'
      ) {
        throw producerAdoptionAuthorityError(
          'Dispersed-medium optics output ownership requires its exact successful adoption receipt'
        );
      }
      if (outputCleanupComplete || outputOwnershipTransferred) {
        throw new TypeError(
          'Dispersed-medium optics output ownership is no longer held by this stage'
        );
      }
      removeAllocated(outputBuffer);
      outputOwnershipTransferred = true;
      outputCleanupComplete = true;
      producerOutputAdoptionRecord.state = 'ownership-transferred';
      producerOutputAdoptionRecord.rollback = null;
      setProducerAdoptionDiagnostic(
        producerOutputAdoptionRecord,
        'ownership-transferred'
      );
      if (result) {
        try { result.ownsBuffer = false; } catch {}
        try { result.ownsOutputBuffer = false; } catch {}
        try { result.outputOwnershipTransferred = true; } catch {}
      }
      return outputBuffer;
    };
    result = {
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_SCHEMA,
      version: SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_VERSION,
      status: 'dispersed-medium-optics-producer-ready-to-encode',
      backend: 'webgpu',
      kernelRevision: SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_KERNEL_REVISION,
      sourceSchema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
      particleCount: topology.particleCount,
      rowCount: topology.particleCount,
      rowCapacity: topology.particleCount,
      readyRowCount: declaration?.readyRowCount ?? null,
      blockedRowCount: declaration?.blockedRowCount ?? null,
      readyOpticalStateIds: declaration?.readyOpticalStateIds
        ?? resolvedOpticalClosureTable.readyOpticalStateIds,
      rowLayout: SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
      rowStrideFloats: SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
      rowStrideBytes: SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
      bufferByteLength: opticsBufferByteLength,
      buffer: outputBuffer,
      outputBuffer,
      ownsBuffer: true,
      ownsOutputBuffer: true,
      outputOwnershipTransferred: false,
      declaration,
      adoptionDeclaration: publicAdoptionDeclarationCopy(
        privateAdoptionDeclaration
      ),
      adoptionDeclarationSchema: privateAdoptionDeclaration.schema,
      adoptionStatus: 'claim-unissued',
      evidenceBuffer,
      evidenceBufferByteLength: EVIDENCE_BYTES,
      deviceLimits,
      encodedDispatchCount: 0,
      reactionCaptureEnabled,
      reactionCaptureDispatchWorkgroupCount: reactionCaptureEnabled
        ? deviceLimits.dispatchWorkgroupCount
        : 0,
      preflightDispatchWorkgroupCount: 1,
      productionDispatchWorkgroupCount: deviceLimits.dispatchWorkgroupCount,
      priorSource: priorOpticsBuffer
        ? 'resident-prior-optics-buffer'
        : 'preregistered-host-seed-rows',
      closureSource: opticalClosureTableBuffer
        ? 'authenticated-resident-static-closure-buffer'
        : 'uploaded-private-static-closure-snapshot',
      particleSourceFamilyAuthority:
        reactionCaptureEnabled
          ? 'exact-pre-reaction-post-reaction-post-transfer-state-thermo-identity-topology-and-revision'
          : 'exact-pre-post-state-thermo-identity-topology-and-revision',
      immutableDeclarationLanes: reactionCaptureEnabled
        ? Object.freeze([])
        : Object.freeze([0, 1, 2, 3]),
      dynamicallyResolvedDeclarationLanes: reactionCaptureEnabled
        ? Object.freeze([0, 1, 2, 3])
        : Object.freeze([]),
      updatedMomentLanes: Object.freeze([4, 5, 6, 7]),
      massAuthority:
        reactionCaptureEnabled
          ? 'reaction-born-condensed-component-plus-literal-phase-transfer-delta-clamped-to-post-condensed-carrier-mass'
          : 'literal-phase-transfer-delta-clamped-to-post-condensed-carrier-mass',
      evaporationOrdering:
        'visible-dispersed-condensate-consumed-before-pre-existing-bulk-condensed-mass',
      saturationMassInference: false,
      sourceBufferMutation: false,
      freshOutputBuffer: true,
      readbackMode: 'no-full-readback',
      fullReadbackPerformed: false,
      fullParticleReadbackPerformed: false,
      fullParticleReadbackFree: true,
      ...createGpuReadbackTelemetry({
        scope: 'sph-dispersed-medium-optics-producer',
        mapAsyncCount: 0,
        readbackBytes: 0,
        hostQueueFenceCount: 0
      }),
      destroyOutputBuffer: cleanupRetainedOutput,
      transferOutputBufferOwnership
    };
    producerOutputAdoptionRecord = {
      device,
      outputBuffer,
      result,
      adoptionDeclaration: privateAdoptionDeclaration,
      adoptionDeclarationRowsSnapshot:
        privateAdoptionDeclaration.rows.slice(),
      preReactionParticleSourceFamily,
      preTransferParticleSourceFamily,
      postTransferParticleSourceFamily,
      state: 'claim-unissued',
      encodeState,
      claim: null,
      adoptedOutput: null,
      adoptionReceipt: null,
      publishedAdoptionDeclaration: null,
      publishedAdoptionDeclarationRowsSnapshot: null,
      rollback: null,
      rollbackError: null,
      topologyRebaseInProgress: false,
      topologyRebaseGeneration: 0,
      transferOutputBufferOwnership
    };
    producerOutputAdoptionRecords.set(result, producerOutputAdoptionRecord);
    const cleanupReturnedStage = () => {
      let firstError = null;
      try { cleanupSubmittedWork(); } catch (error) { firstError ??= error; }
      try { cleanupRetainedOutput(); } catch (error) { firstError ??= error; }
      if (firstError) throw firstError;
      return true;
    };
    return {
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_PRODUCER_ENCODER_STAGE_SCHEMA,
      status: 'dispersed-medium-optics-producer-encoder-stage-ready',
      result,
      outputBuffer,
      adoptionDeclaration: result.adoptionDeclaration,
      evidenceBuffer,
      outputBufferByteLength: opticsBufferByteLength,
      evidenceBufferByteLength: EVIDENCE_BYTES,
      encode(encoder) {
        if (!encoder?.beginComputePass) {
          throw new TypeError(
            'Dispersed-medium optics production requires a WebGPU command encoder'
          );
        }
        if (
          encodeState !== 'constructed'
          || submittedCleanupComplete
          || outputCleanupComplete
          || outputOwnershipTransferred
          || producerOutputAdoptionRecord.state !== 'claim-unissued'
        ) {
          throw producerAdoptionAuthorityError(
            'Dispersed-medium optics producer stage is no longer eligible for encoding'
          );
        }
        encodeState = 'encoding';
        producerOutputAdoptionRecord.encodeState = encodeState;
        setProducerAdoptionDiagnostic(producerOutputAdoptionRecord, encodeState);
        try {
          if (reactionCaptureEnabled) {
            const capturePass = encoder.beginComputePass({
              label: `${label}-reaction-capture`
            });
            capturePass.setPipeline(capturePipeline.pipeline);
            capturePass.setBindGroup(0, captureBindGroup);
            capturePass.dispatchWorkgroups(
              deviceLimits.dispatchWorkgroupCount,
              1,
              1
            );
            capturePass.end();
          }
          const preflightPass = encoder.beginComputePass({
            label: `${label}-preflight`
          });
          preflightPass.setPipeline(preflightPipeline.pipeline);
          preflightPass.setBindGroup(0, preflightBindGroup);
          preflightPass.dispatchWorkgroups(1, 1, 1);
          preflightPass.end();
          const applyPass = encoder.beginComputePass({
            label: `${label}-apply`
          });
          applyPass.setPipeline(applyPipeline.pipeline);
          applyPass.setBindGroup(0, applyBindGroup);
          applyPass.dispatchWorkgroups(
            deviceLimits.dispatchWorkgroupCount,
            1,
            1
          );
          applyPass.end();
          encodeState = 'encoded';
          producerOutputAdoptionRecord.encodeState = encodeState;
          result.status =
            'dispersed-medium-optics-producer-ready-to-submit';
          result.encodedDispatchCount = reactionCaptureEnabled ? 3 : 2;
          setProducerAdoptionDiagnostic(
            producerOutputAdoptionRecord,
            'encoded'
          );
          return true;
        } catch (error) {
          encodeState = 'encode-failed';
          producerOutputAdoptionRecord.encodeState = encodeState;
          result.status = 'dispersed-medium-optics-producer-encode-failed';
          setProducerAdoptionDiagnostic(
            producerOutputAdoptionRecord,
            'encode-failed'
          );
          throw error;
        }
      },
      markSubmittedWork({
        commandSubmissionCount = 1,
        owningCommandSubmissionOrdinal = null,
        submittedStepCount = null
      } = {}) {
        if (encodeState !== 'encoded') {
          throw producerAdoptionAuthorityError(
            'Dispersed-medium optics submission evidence requires one completely encoded producer stage'
          );
        }
        if (result.submitted === true) return true;
        Object.assign(result, {
          status: 'dispersed-medium-optics-producer-submitted',
          submitted: true,
          commandSubmissionCount: Math.max(
            1,
            Math.round(Number(commandSubmissionCount) || 1)
          ),
          owningCommandSubmissionOrdinal:
            Number.isSafeInteger(owningCommandSubmissionOrdinal)
              ? owningCommandSubmissionOrdinal
              : null,
          submittedStepCount:
            Number.isSafeInteger(submittedStepCount)
              ? submittedStepCount
              : null
        });
        return true;
      },
      cleanupSubmittedWork,
      cleanupRetainedOutput,
      transferOutputBufferOwnership,
      cleanupConstructionFailure: cleanupReturnedStage
    };
  } catch (error) {
    try { destroyAllocated(); } catch {}
    try { releasePriorOpticsBorrow?.(); } catch {}
    try { releaseOpticalClosureGpuTableBorrow?.(); } catch {}
    throw error;
  }
}

/**
 * Submit one standalone producer stage without introducing a host-observed
 * queue fence. The exact producer submission is also the final consumer of
 * its uploaded closure/seed rows and evidence scratch, so the module-private
 * cleanup claim can retire those temporaries immediately after queue.submit.
 * The fresh output remains producer-owned until its one-shot adoption claim
 * transfers it into an authenticated particle-upload family.
 */
export function runSphDispersedMediumOpticsProducerWebGpu(args = {}) {
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(args);
  const device = args?.device;
  try {
    const encoder = device.createCommandEncoder({
      label: 'ulg-sph-dispersed-medium-optics-producer-submit'
    });
    stage.encode(encoder);
    const commandBuffer = encoder.finish();
    const submission = submitQueueOrderedProducerWorkAndCleanup(
      producerSubmittedWorkCleanupClaimIssuer,
      device,
      [commandBuffer],
      {
        producerOutput: stage,
        finalConsumerOwner: stage,
        cleanup: stage.cleanupSubmittedWork
      }
    );
    stage.markSubmittedWork({
      commandSubmissionCount: 1,
      owningCommandSubmissionOrdinal: 1,
      submittedStepCount: 1
    });
    Object.assign(stage.result, {
      submittedWorkCleanupStatus: submission.cleanupReceipt.status,
      submittedWorkCleanupHostQueueFenceCount:
        submission.cleanupReceipt.hostQueueFenceCount,
      submittedWorkCleanupMethod:
        submission.cleanupReceipt.queueCompletionMethod
    });
    return stage.result;
  } catch (error) {
    try { stage.cleanupConstructionFailure?.(); } catch {}
    throw error;
  }
}
