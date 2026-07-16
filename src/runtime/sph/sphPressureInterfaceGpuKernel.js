import {
  createSchroederSpatialEpochLayout,
  SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
  SCHROEDER_SPATIAL_EPOCH_MAGIC,
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
  SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT,
  SPH_INTERFACE_SOURCE_KEY_ROW_LAYOUT,
  SPH_INTERFACE_CONTACT_KINEMATICS_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
  ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
  ULG_SPH_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphPressureInterfaceSpatialExactNearContactKinematicsWgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearWgsl.js';
import {
  sphPressureInterfaceContactKinematicsWgsl,
  sphPressureInterfaceParticleBinsWgsl,
  sphPressureInterfaceForceRowsWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
} from './schroederSpatialEpochGpu.js';
import { tagWebGpuBufferDevice, webGpuDeviceMismatchInfo } from './sphGpuDeviceIdentity.js';

export const SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS = SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length;
export const SPH_PRESSURE_INTERFACE_FORCE_FLOATS = SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length;
export const SPH_GAS_PRESSURE_CELL_FLOATS = 12;
export const SPH_ALGORITHM_CONTACT_POLICY_FLOATS = 16;
// row0: gap, normal velocity, representative mass, ready
// row1: source domain id, target domain id, exact-pair ready,
// selected contact-policy row token (one-based; zero means unresolved/legacy)
export const SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS =
  SPH_INTERFACE_CONTACT_KINEMATICS_ROW_LAYOUT.length;
export const ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-pair-response.v0';
export const ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA =
  ULG_SPH_INTERFACE_CONTACT_KINEMATICS_SCHEMA;
export const ULG_INTERFACE_SOURCE_KEY_SCHEMA = ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA;

const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA = 'peercompute.ulg.sph-local-pressure-gradient-field.v0';
const ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA = 'peercompute.ulg.algorithm-material-contact-rows.v0';
const UNIFORM_GAS_PRESSURE_FIELD_MODE = 'uniform-single-cell-sealed-gas';
const UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION = 'lumped-sealed-box';
const LOCAL_GAS_CELL_PRESSURE_FIELD_MODE = 'local-gas-cell-pressure-gradient';
const LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION = 'structured-gas-cell-grid';
const DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE = 1e-4;
const DEFAULT_ALGORITHM_CONTACT_PAIR_MAX_PRESSURE_PA = 5e5;
const DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M = 0;
const DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M = 0;
const DEFAULT_CONTACT_PARTICLE_BIN_CAPACITY = 64;
const CONTACT_PARTICLE_BIN_CAPACITY_OCCUPANCY_MULTIPLIER = 4;
const CONTACT_PARTICLE_BIN_INDEX_BUFFER_BUDGET_BYTES = 128 * 1024 * 1024;
const CONTACT_PARTICLE_BIN_GRID_MAX_AXIS_CELLS = 64;
const CONTACT_PARTICLE_BIN_GRID_MAX_CELL_COUNT = CONTACT_PARTICLE_BIN_GRID_MAX_AXIS_CELLS ** 3;
const SCHROEDER_PRESSURE_INTERFACE_LAW_CONTACT_MASK = 2;
const SCHROEDER_PRESSURE_INTERFACE_LAW_INTERFACE_MASK = 4;
const SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK =
  SCHROEDER_PRESSURE_INTERFACE_LAW_CONTACT_MASK | SCHROEDER_PRESSURE_INTERFACE_LAW_INTERFACE_MASK;
const SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS =
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT.length;
const SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS = SCHROEDER_LAW_QUEUE_ROW_LAYOUT.length;
const SPH_INTERFACE_SOURCE_KEY_FLOATS = SPH_INTERFACE_SOURCE_KEY_ROW_LAYOUT.length;
const SCHROEDER_SPATIAL_ACTIVE_NODE_FLOATS = 16;
const SCHROEDER_SPATIAL_LEVEL_SPACING_MODE = 'base-grid-spacing-times-pow2-level';
const SCHROEDER_SPATIAL_POSITION_AUTHORITY = 'same-epoch-pre-integration-particle-state';
const SCHROEDER_SPATIAL_SOURCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-active-node-source.v1';
const LOCAL_PRESSURE_GRADIENT_BLOCKERS = Object.freeze([
  'single-cell-uniform-pressure-field',
  'resident-gas-cell-eos-gradient-not-derived'
]);

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampPositive(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function finiteOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = finiteOptionalNumber(value);
    if (number != null) return number;
  }
  return null;
}

function clamp01(value) {
  const number = finiteNumber(value, 0);
  if (number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
}

async function readSchroederExactNearDirectoryDiagnostics(device, spatialBuild) {
  const execution = spatialBuild?.execution || null;
  const layout = execution?.layout || null;
  const directoryBuffer = execution?.directoryBuffer || null;
  const byteLength = Math.max(
    0,
    Math.trunc(finiteNumber(layout?.byteLength ?? directoryBuffer?.size, 0))
  );
  if (!directoryBuffer || byteLength < SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS * 4) {
    return {
      directoryDiagnosticStatus: 'directory-readback-unavailable',
      actualCellCount: null,
      keyOrderViolationCount: null,
      cellOffsetViolationCount: null
    };
  }
  const readback = device.createBuffer({
    label: 'ulg-sph-pressure-interface-exact-near-directory-diagnostic',
    size: byteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  try {
    const encoder = device.createCommandEncoder({
      label: 'ulg-sph-pressure-interface-exact-near-directory-diagnostic'
    });
    encoder.copyBufferToBuffer(directoryBuffer, 0, readback, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPU_MAP_MODE.READ);
    const words = new Uint32Array(readback.getMappedRange()).slice();
    readback.unmap();
    const actualCellCount = words[18] ?? 0;
    const sourceCount = words[16] ?? 0;
    const cellKeysOffsetWords = words[29] ?? 0;
    const cellOffsetsOffsetWords = words[30] ?? 0;
    let keyOrderViolationCount = 0;
    let cellOffsetViolationCount = 0;
    let firstKeyOrderViolationIndex = null;
    let minimumMemberIndex = null;
    let maximumMemberIndex = null;
    const keyAt = (index) => Array.from(
      words.slice(
        cellKeysOffsetWords + index * SCHROEDER_SPATIAL_EPOCH_KEY_WORDS,
        cellKeysOffsetWords + (index + 1) * SCHROEDER_SPATIAL_EPOCH_KEY_WORDS
      )
    );
    const compareKeys = (left, right) => {
      for (let index = 0; index < SCHROEDER_SPATIAL_EPOCH_KEY_WORDS; index += 1) {
        if (left[index] < right[index]) return -1;
        if (left[index] > right[index]) return 1;
      }
      return 0;
    };
    let previousKey = null;
    for (let cellIndex = 0; cellIndex < actualCellCount; cellIndex += 1) {
      const key = keyAt(cellIndex);
      if (previousKey && compareKeys(previousKey, key) >= 0) {
        keyOrderViolationCount += 1;
        if (firstKeyOrderViolationIndex == null) {
          firstKeyOrderViolationIndex = cellIndex;
        }
      }
      previousKey = key;
      const begin = words[cellOffsetsOffsetWords + cellIndex] ?? 0;
      const end = words[cellOffsetsOffsetWords + cellIndex + 1] ?? 0;
      if (begin > end || end > sourceCount) cellOffsetViolationCount += 1;
      for (let memberOffset = begin; memberOffset < end && memberOffset < sourceCount; memberOffset += 1) {
        const memberIndex = words[(words[31] ?? 0) + memberOffset] ?? 0;
        minimumMemberIndex = minimumMemberIndex == null
          ? memberIndex
          : Math.min(minimumMemberIndex, memberIndex);
        maximumMemberIndex = maximumMemberIndex == null
          ? memberIndex
          : Math.max(maximumMemberIndex, memberIndex);
      }
    }
    return {
      directoryDiagnosticStatus: 'directory-readback-complete',
      actualCellCount,
      sourceCount,
      keyOrderViolationCount,
      cellOffsetViolationCount,
      firstKeyOrderViolationIndex,
      minimumMemberIndex,
      maximumMemberIndex
    };
  } finally {
    readback.destroy?.();
  }
}

function stableMaterialId(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  return stableOpticalMaterialId(value);
}

function stablePhaseId(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  return gpuPhaseId(value);
}

function normalizedKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function gasPressureTractionEligibleForElement(element = {}) {
  const phase = normalizedKey(element?.phase);
  const phaseId = Math.round(finiteNumber(element?.phaseId, 0));
  // The gas EOS is already the stress closure for gas/plasma carriers.
  // Applying the pressure it produced back onto its own rendered free surface
  // double-counts that stress and is especially destructive for tiny product
  // masses. Interface traction is the gas boundary condition on condensed
  // matter; algorithmic contact pressure remains independent below.
  return phase !== 'gas'
    && phase !== 'vapor'
    && phase !== 'vapour'
    && phase !== 'plasma'
    && phaseId !== 3
    && phaseId !== 4;
}

function materialPhaseIdsForContactRow(row = {}) {
  const materialIds = Array.isArray(row.materialIds)
    ? row.materialIds.map(stableMaterialId)
    : (Array.isArray(row.materials) ? row.materials.map(stableMaterialId) : []);
  const phaseIds = Array.isArray(row.phaseIds)
    ? row.phaseIds.map(stablePhaseId)
    : (Array.isArray(row.phases) ? row.phases.map(stablePhaseId) : []);
  return {
    materialIds: [finiteNumber(materialIds[0], 0), finiteNumber(materialIds[1], 0)],
    phaseIds: [finiteNumber(phaseIds[0], 0), finiteNumber(phaseIds[1], 0)]
  };
}

function stableDomainId(value) {
  const numeric = Number(value);
  // Domain ids are u32 in the particle sidecar, but pressure/interface rows
  // are f32. Keep the shared identifier inside f32's exact integer range so
  // two distinct initial bodies can never alias during contact selection.
  return Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 0x00ff_ffff
    ? numeric
    : 0;
}

function normalizedBodyId(value) {
  const bodyId = String(value ?? '').trim();
  return bodyId || null;
}

function pairValues(source, normalize) {
  if (!Array.isArray(source)) return [normalize(null), normalize(null)];
  return [normalize(source[0]), normalize(source[1])];
}

function bodyDomainIdentityForContactRow(row = {}) {
  const domainIds = pairValues(
    row.domainIds ?? row.bodyDomainIds ?? row.renderDomainIds,
    stableDomainId
  );
  const bodyIds = pairValues(row.bodyIds, normalizedBodyId);
  const domainPairReady = domainIds[0] > 0 && domainIds[1] > 0;
  const bodyPairReady = Boolean(bodyIds[0] && bodyIds[1]);
  const bodySpecific = domainIds.some((id) => id > 0) || bodyIds.some(Boolean);
  return {
    domainIds,
    bodyIds,
    domainPairReady,
    bodyPairReady,
    bodySpecific,
    identityStatus: domainPairReady
      ? 'algorithm-contact-domain-pair-ready'
      : (bodyPairReady
          ? 'algorithm-contact-body-pair-ready'
          : (bodySpecific
              ? 'algorithm-contact-body-pair-incomplete'
              : 'algorithm-contact-generic-material-phase-row'))
  };
}

function firstPositiveDomainId(...values) {
  for (const value of values) {
    const domainId = stableDomainId(value);
    if (domainId > 0) return domainId;
  }
  return 0;
}

function firstBodyId(...values) {
  for (const value of values) {
    const bodyId = normalizedBodyId(value);
    if (bodyId) return bodyId;
  }
  return null;
}

function firstIdentityPair(sources, normalize, ready) {
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    const pair = pairValues(source, normalize);
    if (ready(pair)) return pair;
  }
  return null;
}

function bodyDomainIdentityForInterfaceElement(element = {}) {
  const contact = element?.contact && typeof element.contact === 'object'
    ? element.contact
    : {};
  const explicitDomainPair = firstIdentityPair([
    element.domainIds,
    element.contactDomainIds,
    element.bodyDomainIds,
    element.renderDomainIds,
    element.interfaceDomainIds,
    contact.domainIds,
    contact.contactDomainIds,
    contact.bodyDomainIds,
    contact.renderDomainIds
  ], stableDomainId, (pair) => pair[0] > 0 && pair[1] > 0);
  const explicitBodyPair = firstIdentityPair([
    element.bodyIds,
    element.contactBodyIds,
    element.interfaceBodyIds,
    contact.bodyIds,
    contact.contactBodyIds
  ], normalizedBodyId, (pair) => Boolean(pair[0] && pair[1]));
  const sourceDomainId = firstPositiveDomainId(
    element.sourceDomainId,
    element.domainId,
    element.renderDomainId,
    element.initialBodyDomainId,
    contact.sourceDomainId,
    contact.domainId
  );
  const targetDomainId = firstPositiveDomainId(
    element.targetDomainId,
    element.otherDomainId,
    element.neighborDomainId,
    element.counterpartyDomainId,
    contact.targetDomainId,
    contact.otherDomainId,
    contact.neighborDomainId
  );
  const sourceBodyId = firstBodyId(
    element.sourceBodyId,
    element.bodyId,
    element.initialBodyId,
    contact.sourceBodyId,
    contact.bodyId
  );
  const targetBodyId = firstBodyId(
    element.targetBodyId,
    element.otherBodyId,
    element.neighborBodyId,
    element.counterpartyBodyId,
    contact.targetBodyId,
    contact.otherBodyId,
    contact.neighborBodyId
  );
  const domainIds = explicitDomainPair
    ?? (sourceDomainId > 0 && targetDomainId > 0 ? [sourceDomainId, targetDomainId] : null);
  const bodyIds = explicitBodyPair
    ?? (sourceBodyId && targetBodyId ? [sourceBodyId, targetBodyId] : null);
  return {
    domainIds,
    bodyIds,
    sourceDomainId,
    targetDomainId,
    sourceBodyId,
    targetBodyId,
    domainPairReady: Boolean(domainIds),
    bodyPairReady: Boolean(bodyIds),
    bodyIdentityObserved: Boolean(
      domainIds
      || bodyIds
      || sourceDomainId > 0
      || targetDomainId > 0
      || sourceBodyId
      || targetBodyId
    )
  };
}

function unorderedNumberPairMatches(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (!(left[0] > 0 && left[1] > 0 && right[0] > 0 && right[1] > 0)) return false;
  return (left[0] === right[0] && left[1] === right[1])
    || (left[0] === right[1] && left[1] === right[0]);
}

function unorderedStringPairMatches(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (!(left[0] && left[1] && right[0] && right[1])) return false;
  return (left[0] === right[0] && left[1] === right[1])
    || (left[0] === right[1] && left[1] === right[0]);
}

function contactRowMatchesElementMaterialPhase(row, {
  elementMaterialId,
  elementPhaseId,
  elementMaterial,
  elementPhase
}) {
  const materialIds = Array.isArray(row.materialIds) ? row.materialIds : [];
  const materials = Array.isArray(row.materials) ? row.materials : [];
  const phaseIds = Array.isArray(row.phaseIds) ? row.phaseIds : [];
  const phases = Array.isArray(row.phases) ? row.phases : [];
  const materialIdMatch = elementMaterialId > 0
    && materialIds.some((id) => Math.abs(id - elementMaterialId) < 0.5);
  const materialNameMatch = elementMaterial && materials.map(normalizedKey).includes(elementMaterial);
  const presentPhaseIds = phaseIds.filter((id) => id > 0);
  const phaseNames = phases.map(normalizedKey).filter(Boolean);
  const phaseMatch = presentPhaseIds.length === 0 && phaseNames.length === 0
    ? true
    : ((elementPhaseId > 0 && presentPhaseIds.some((id) => Math.abs(id - elementPhaseId) < 0.5))
        || (elementPhase && phaseNames.includes(elementPhase)));
  return (materialIdMatch || materialNameMatch) && phaseMatch;
}

function contactRowMatchesElementAtPairIndex(row, pairIndex, elementIdentity) {
  if (!(pairIndex === 0 || pairIndex === 1)) return false;
  const rowMaterialId = finiteNumber(row.materialIds?.[pairIndex], 0);
  const rowMaterial = normalizedKey(row.materials?.[pairIndex]);
  const rowPhaseId = finiteNumber(row.phaseIds?.[pairIndex], 0);
  const rowPhase = normalizedKey(row.phases?.[pairIndex]);
  const materialMatch = (elementIdentity.elementMaterialId > 0 && rowMaterialId > 0
    && Math.abs(rowMaterialId - elementIdentity.elementMaterialId) < 0.5)
    || (elementIdentity.elementMaterial && rowMaterial === elementIdentity.elementMaterial);
  const phaseMatch = rowPhaseId <= 0 && !rowPhase
    ? true
    : ((elementIdentity.elementPhaseId > 0 && rowPhaseId > 0
        && Math.abs(rowPhaseId - elementIdentity.elementPhaseId) < 0.5)
      || (elementIdentity.elementPhase && rowPhase === elementIdentity.elementPhase));
  return materialMatch && phaseMatch;
}

function sourceSideSpecificRows(rows, elementIdentity, { fallbackToRows = true } = {}) {
  let sourceIdentityObserved = false;
  if (elementIdentity.sourceDomainId > 0) {
    sourceIdentityObserved = true;
    const matches = rows.filter((row) => {
      const index = row.domainIds?.findIndex((id) => id === elementIdentity.sourceDomainId) ?? -1;
      return contactRowMatchesElementAtPairIndex(row, index, elementIdentity);
    });
    if (matches.length > 0) return matches;
  }
  if (elementIdentity.sourceBodyId) {
    sourceIdentityObserved = true;
    const matches = rows.filter((row) => {
      const index = row.bodyIds?.findIndex((id) => id === elementIdentity.sourceBodyId) ?? -1;
      return contactRowMatchesElementAtPairIndex(row, index, elementIdentity);
    });
    if (matches.length > 0) return matches;
  }
  return fallbackToRows || !sourceIdentityObserved ? rows : [];
}

function contactPressureCap({ algorithmContactMaxPressurePa = null } = {}) {
  const explicit = finiteNumber(algorithmContactMaxPressurePa, Number.NaN);
  return explicit > 0 ? explicit : DEFAULT_ALGORITHM_CONTACT_PAIR_MAX_PRESSURE_PA;
}

export function interfaceContactKinematicsForElement(element = {}) {
  const contact = element?.contact && typeof element.contact === 'object' ? element.contact : {};
  const gapM = firstFiniteNumber(
    element?.gapM,
    element?.contactGapM,
    element?.interfaceGapM,
    contact.gapM,
    contact.contactGapM
  );
  const normalVelocityMPerS = firstFiniteNumber(
    element?.normalVelocityMPerS,
    element?.relativeNormalVelocityMPerS,
    element?.contactNormalVelocityMPerS,
    contact.normalVelocityMPerS,
    contact.relativeNormalVelocityMPerS,
    contact.contactNormalVelocityMPerS
  ) ?? 0;
  const representativeMassKg = firstFiniteNumber(
    element?.representativeMassKg,
    element?.effectiveContactMassKg,
    element?.contactMassKg,
    contact.representativeMassKg,
    contact.effectiveContactMassKg,
    contact.contactMassKg
  ) ?? 0;
  const ready = gapM != null;
  return {
    schema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    status: ready
      ? 'interface-contact-kinematics-ready'
      : 'interface-contact-kinematics-unavailable',
    gapM: Math.max(0, finiteNumber(gapM, 0)),
    normalVelocityMPerS,
    representativeMassKg: clampPositive(representativeMassKg, 0),
    ready
  };
}

export function algorithmContactPressureForKinematics({
  row = null,
  element = {},
  kinematics = interfaceContactKinematicsForElement(element)
} = {}) {
  if (!row || row.status !== 'algorithm-contact-pair-response-row-ready') {
    return {
      status: 'algorithm-contact-pair-response-row-inactive',
      contactPressurePa: 0,
      kinematics
    };
  }
  if (kinematics?.status !== 'interface-contact-kinematics-ready') {
    return {
      status: 'algorithm-contact-pair-response-kinematics-unavailable',
      contactPressurePa: 0,
      kinematics
    };
  }
  const areaM2 = clampPositive(element?.areaM2, 0);
  const areaSupportM = areaM2 > 0 ? Math.sqrt(areaM2) : 0;
  const supportRadiusM = clampPositive(row.supportRadiusM, 0) || areaSupportM || 1e-6;
  const gapM = Math.max(0, finiteNumber(kinematics.gapM, 0));
  const normalVelocityMPerS = finiteNumber(kinematics.normalVelocityMPerS, 0);
  const closingSpeedMPerS = Math.max(0, -normalVelocityMPerS);
  const inContactWindow = gapM <= supportRadiusM
    || (closingSpeedMPerS > 0 && gapM <= supportRadiusM * 2);
  if (!inContactWindow) {
    return {
      status: 'algorithm-contact-pair-response-outside-support',
      contactPressurePa: 0,
      kinematics,
      supportRadiusM,
      gapM,
      normalVelocityMPerS,
      closingSpeedMPerS
    };
  }
  const effectiveGapM = Math.max(gapM, supportRadiusM * 1e-3, 1e-9);
  const proximity = clamp01((supportRadiusM - gapM) / supportRadiusM);
  const barrierGain = proximity * Math.min((supportRadiusM / effectiveGapM) ** 2, 1e6);
  const elasticPressurePa = clampPositive(row.normalStiffnessPa, 0)
    * clampPositive(row.responseScale, 0)
    * barrierGain;
  const dampingPressurePa = clampPositive(row.dampingViscosityPaS, 0)
    * closingSpeedMPerS
    / supportRadiusM;
  const inertialPressurePa = kinematics.representativeMassKg > 0 && closingSpeedMPerS > 0 && areaM2 > 0
    ? (kinematics.representativeMassKg * closingSpeedMPerS * closingSpeedMPerS)
      / Math.max(areaM2 * effectiveGapM, 1e-12)
    : 0;
  const cap = contactPressureCap({ algorithmContactMaxPressurePa: row.maxContactPressurePa });
  const contactPressurePa = Math.min(
    Math.max(0, elasticPressurePa + dampingPressurePa + inertialPressurePa),
    cap
  );
  return {
    status: contactPressurePa > 0
      ? 'algorithm-contact-pair-response-applied-kinematic'
      : 'algorithm-contact-pair-response-inactive-kinematic',
    contactPressurePa,
    kinematics,
    supportRadiusM,
    gapM,
    effectiveGapM,
    normalVelocityMPerS,
    closingSpeedMPerS,
    proximity,
    barrierGain,
    elasticPressurePa,
    dampingPressurePa,
    inertialPressurePa,
    maxContactPressurePa: cap
  };
}

export function normalizeAlgorithmContactPairResponsePolicy({
  algorithmMaterialContactRows = null,
  algorithmContactPairResponseScale = DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE,
  algorithmContactMaxPressurePa = DEFAULT_ALGORITHM_CONTACT_PAIR_MAX_PRESSURE_PA
} = {}) {
  const rowSourceReady = algorithmMaterialContactRows?.schema === ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA;
  const scale = clampPositive(algorithmContactPairResponseScale, DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE);
  const maxContactPressurePa = contactPressureCap({ algorithmContactMaxPressurePa });
  const rows = rowSourceReady && Array.isArray(algorithmMaterialContactRows.rows)
    ? algorithmMaterialContactRows.rows
      .map((row, index) => {
        const normalStiffnessPa = clampPositive(row?.normalStiffnessPa, 0);
        const rowScale = clampPositive(row?.contactPairResponseScale, scale);
        const rowMaxPressurePa = contactPressureCap({
          algorithmContactMaxPressurePa: row?.maxContactPressurePa ?? maxContactPressurePa
        });
        const contactPressurePa = Math.min(normalStiffnessPa * rowScale, rowMaxPressurePa);
        const { materialIds, phaseIds } = materialPhaseIdsForContactRow(row);
        const bodyDomainIdentity = bodyDomainIdentityForContactRow(row);
        return {
          index,
          pairKey: row?.pairKey ?? null,
          roles: Array.isArray(row?.roles) ? [...row.roles] : [],
          bodyIds: bodyDomainIdentity.bodyIds,
          domainIds: bodyDomainIdentity.domainIds,
          domainPairReady: bodyDomainIdentity.domainPairReady,
          bodyPairReady: bodyDomainIdentity.bodyPairReady,
          bodySpecific: bodyDomainIdentity.bodySpecific,
          identityStatus: bodyDomainIdentity.identityStatus,
          materials: Array.isArray(row?.materials) ? [...row.materials] : [],
          materialIds,
          phases: Array.isArray(row?.phases) ? [...row.phases] : [],
          phaseIds,
          normalStiffnessPa,
          dampingViscosityPaS: clampPositive(row?.dampingViscosityPaS, 0),
          supportRadiusM: clampPositive(row?.supportRadiusM, 0),
          responseScale: rowScale,
          maxContactPressurePa: rowMaxPressurePa,
          contactPressurePa,
          status: normalStiffnessPa > 0 && rowScale > 0 && contactPressurePa > 0
            ? 'algorithm-contact-pair-response-row-ready'
            : 'algorithm-contact-pair-response-row-inactive',
          sourceStatus: row?.status ?? null,
          forceMutationAuthority: row?.forceMutationAuthority ?? null
        };
      })
      .filter((row) => row.status === 'algorithm-contact-pair-response-row-ready')
    : [];
  const domainPairRowCount = rows.filter((row) => row.domainPairReady).length;
  const bodyPairRowCount = rows.filter((row) => row.bodyPairReady).length;
  const bodySpecificRowCount = rows.filter((row) => row.bodySpecific).length;
  return {
    schema: ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-contact-pair-response-policy-ready'
      : (rowSourceReady
          ? 'algorithm-contact-pair-response-policy-empty'
          : 'algorithm-contact-pair-response-policy-unavailable'),
    sourceRowsSchema: algorithmMaterialContactRows?.schema ?? null,
    sourceRowsStatus: algorithmMaterialContactRows?.status ?? null,
    rowCount: rows.length,
    genericMaterialPhaseRowCount: rows.length - bodySpecificRowCount,
    bodySpecificRowCount,
    bodyPairRowCount,
    domainPairRowCount,
    bodyDomainSelectionStatus: bodySpecificRowCount > 0
      ? 'algorithm-contact-body-domain-policy-available-to-cpu-selection'
      : 'algorithm-contact-generic-material-phase-policy',
    rows,
    responseScale: scale,
    maxContactPressurePa,
    forceMutationAuthority: 'non-authoritative-force-row-policy-consumed-by-pressure-interface-stage',
    strictSourceOfTruth: false
  };
}

export function algorithmContactPairResponseForElement(element = {}, policy = null) {
  if (policy?.schema !== ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA || !Array.isArray(policy.rows)) {
    return {
      status: 'algorithm-contact-pair-response-policy-unavailable',
      contactPressurePa: 0,
      row: null
    };
  }
  const elementMaterialId = stableMaterialId(element.materialId ?? element.material);
  const elementPhaseId = stablePhaseId(element.phaseId ?? element.phase);
  const elementMaterial = normalizedKey(element.material);
  const elementPhase = normalizedKey(element.phase);
  const bodyDomainIdentity = bodyDomainIdentityForInterfaceElement(element);
  const elementIdentity = {
    ...bodyDomainIdentity,
    elementMaterialId,
    elementPhaseId,
    elementMaterial,
    elementPhase
  };
  const matchingRows = policy.rows.filter((row) => (
    contactRowMatchesElementMaterialPhase(row, elementIdentity)
  ));
  if (matchingRows.length === 0) {
    return {
      status: 'algorithm-contact-pair-response-no-matching-row',
      contactPressurePa: 0,
      row: null,
      bodyDomainIdentity
    };
  }
  const normalizedMatchingRows = matchingRows.map((row) => ({
    row,
    ...bodyDomainIdentityForContactRow(row)
  }));
  const genericRows = normalizedMatchingRows.filter(({ bodySpecific }) => !bodySpecific);
  const specificRows = normalizedMatchingRows.filter(({ bodySpecific }) => bodySpecific);
  const selectedResponse = (row, selectionStatus) => {
    const dynamicPressure = algorithmContactPressureForKinematics({ row, element });
    return {
      status: dynamicPressure.status,
      selectionStatus,
      contactPressurePa: dynamicPressure.contactPressurePa,
      row,
      kinematics: dynamicPressure.kinematics,
      dynamicPressure,
      bodyDomainIdentity
    };
  };
  const ambiguousResponse = (rows, reason) => ({
    status: 'algorithm-contact-pair-response-body-specific-ambiguous',
    reason,
    contactPressurePa: 0,
    row: null,
    bodyDomainIdentity,
    ambiguousRowCount: rows.length,
    ambiguousPairKeys: rows.map((entry) => entry.row.pairKey).filter(Boolean)
  });

  if (bodyDomainIdentity.domainPairReady) {
    let exactRows = specificRows.filter(({ domainIds, domainPairReady }) => (
      domainPairReady && unorderedNumberPairMatches(domainIds, bodyDomainIdentity.domainIds)
    ));
    if (bodyDomainIdentity.bodyPairReady && exactRows.length > 1) {
      const exactBodyRows = exactRows.filter(({ bodyIds, bodyPairReady }) => (
        bodyPairReady && unorderedStringPairMatches(bodyIds, bodyDomainIdentity.bodyIds)
      ));
      if (exactBodyRows.length > 0) exactRows = exactBodyRows;
    }
    exactRows = sourceSideSpecificRows(
      exactRows.map(({ row }) => row),
      elementIdentity,
      { fallbackToRows: false }
    ).map((row) => ({ row }));
    if (exactRows.length === 1) {
      return selectedResponse(exactRows[0].row, 'algorithm-contact-exact-unordered-domain-pair-selected');
    }
    if (exactRows.length > 1) {
      if (genericRows.length > 0) {
        return selectedResponse(
          genericRows[0].row,
          'algorithm-contact-ambiguous-domain-pair-generic-material-phase-fallback-selected'
        );
      }
      return ambiguousResponse(exactRows, 'multiple-body-specific-rows-match-exact-domain-pair');
    }
    if (genericRows.length > 0) {
      return selectedResponse(genericRows[0].row, 'algorithm-contact-generic-material-phase-fallback-selected');
    }
    return {
      status: 'algorithm-contact-pair-response-no-matching-body-domain-row',
      reason: 'explicit-element-domain-pair-has-no-policy-row-or-generic-fallback',
      contactPressurePa: 0,
      row: null,
      bodyDomainIdentity
    };
  }

  if (bodyDomainIdentity.bodyPairReady) {
    let exactRows = specificRows.filter(({ bodyIds, bodyPairReady }) => (
      bodyPairReady && unorderedStringPairMatches(bodyIds, bodyDomainIdentity.bodyIds)
    ));
    exactRows = sourceSideSpecificRows(
      exactRows.map(({ row }) => row),
      elementIdentity,
      { fallbackToRows: false }
    ).map((row) => ({ row }));
    if (exactRows.length === 1) {
      return selectedResponse(exactRows[0].row, 'algorithm-contact-exact-unordered-body-pair-selected');
    }
    if (exactRows.length > 1) {
      if (genericRows.length > 0) {
        return selectedResponse(
          genericRows[0].row,
          'algorithm-contact-ambiguous-body-pair-generic-material-phase-fallback-selected'
        );
      }
      return ambiguousResponse(exactRows, 'multiple-body-specific-rows-match-exact-body-pair');
    }
    if (genericRows.length > 0) {
      return selectedResponse(genericRows[0].row, 'algorithm-contact-generic-material-phase-fallback-selected');
    }
    return {
      status: 'algorithm-contact-pair-response-no-matching-body-domain-row',
      reason: 'explicit-element-body-pair-has-no-policy-row-or-generic-fallback',
      contactPressurePa: 0,
      row: null,
      bodyDomainIdentity
    };
  }

  let scopedRows = specificRows;
  if (bodyDomainIdentity.sourceDomainId > 0 || bodyDomainIdentity.targetDomainId > 0) {
    const observedDomainIds = [
      bodyDomainIdentity.sourceDomainId,
      bodyDomainIdentity.targetDomainId
    ].filter((id) => id > 0);
    scopedRows = scopedRows.filter(({ domainIds }) => (
      observedDomainIds.every((id) => domainIds.includes(id))
    ));
  }
  if (bodyDomainIdentity.sourceBodyId || bodyDomainIdentity.targetBodyId) {
    const observedBodyIds = [
      bodyDomainIdentity.sourceBodyId,
      bodyDomainIdentity.targetBodyId
    ].filter(Boolean);
    scopedRows = scopedRows.filter(({ bodyIds }) => (
      observedBodyIds.every((id) => bodyIds.includes(id))
    ));
  }
  if (scopedRows.length > 1) {
    scopedRows = sourceSideSpecificRows(scopedRows.map(({ row }) => row), elementIdentity)
      .map((row) => ({ row }));
  }
  if (scopedRows.length === 1) {
    return selectedResponse(scopedRows[0].row, bodyDomainIdentity.bodyIdentityObserved
      ? 'algorithm-contact-partial-body-domain-row-selected'
      : 'algorithm-contact-single-body-specific-material-phase-row-selected');
  }
  if (genericRows.length > 0) {
    return selectedResponse(genericRows[0].row, 'algorithm-contact-generic-material-phase-fallback-selected');
  }
  if (scopedRows.length > 1) {
    return ambiguousResponse(scopedRows, bodyDomainIdentity.bodyIdentityObserved
      ? 'partial-element-body-domain-identity-matches-multiple-specific-rows'
      : 'element-has-no-body-domain-pair-and-material-phase-matches-multiple-specific-rows');
  }
  return {
    status: 'algorithm-contact-pair-response-no-matching-body-domain-row',
    reason: 'partial-element-body-domain-identity-has-no-policy-row-or-generic-fallback',
    contactPressurePa: 0,
    row: null,
    bodyDomainIdentity
  };
}

export function packAlgorithmContactPolicyRows(policy = null) {
  const rows = policy?.schema === ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA && Array.isArray(policy.rows)
    ? policy.rows
    : [];
  const domainPairRowCount = rows.filter((row) => (
    bodyDomainIdentityForContactRow(row).domainPairReady
  )).length;
  const bodySpecificWithoutDomainPairRowCount = rows.filter((row) => {
    const identity = bodyDomainIdentityForContactRow(row);
    return identity.bodySpecific && !identity.domainPairReady;
  }).length;
  const values = new Float32Array(rows.length * SPH_ALGORITHM_CONTACT_POLICY_FLOATS);
  for (const [index, row] of rows.entries()) {
    const offset = index * SPH_ALGORITHM_CONTACT_POLICY_FLOATS;
    const identity = bodyDomainIdentityForContactRow(row);
    values.set([
      finiteNumber(row.materialIds?.[0], 0),
      finiteNumber(row.materialIds?.[1], 0),
      finiteNumber(row.phaseIds?.[0], 0),
      finiteNumber(row.phaseIds?.[1], 0),
      finiteNumber(row.normalStiffnessPa, 0),
      finiteNumber(row.dampingViscosityPaS, 0),
      finiteNumber(row.supportRadiusM, 0),
      finiteNumber(row.responseScale, 0),
      finiteNumber(row.maxContactPressurePa, 0),
      1,
      finiteNumber(row.index, index),
      finiteNumber(row.contactPressurePa, 0),
      identity.domainIds[0],
      identity.domainIds[1],
      identity.bodySpecific ? 1 : 0,
      identity.domainPairReady ? 1 : 0
    ], offset);
  }
  return {
    schema: ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-contact-policy-rows-packed'
      : 'algorithm-contact-policy-rows-empty',
    rows: values,
    rowCount: rows.length,
    rowStrideFloats: SPH_ALGORITHM_CONTACT_POLICY_FLOATS,
    rowByteLength: values.byteLength,
    domainPairRowCount,
    bodySpecificWithoutDomainPairRowCount,
    domainPairGpuSelectionReady: bodySpecificWithoutDomainPairRowCount === 0,
    domainPairGpuSelectionStatus: bodySpecificWithoutDomainPairRowCount > 0
      ? 'blocked-body-specific-contact-policy-missing-exact-domain-pair'
      : (domainPairRowCount > 0
          ? 'algorithm-contact-exact-domain-pairs-encoded-in-gpu-rows'
          : 'not-required-generic-material-phase-contact-policy')
  };
}

export function packMaterialInterfaceContactKinematicsRows(materialInterfaceField = null) {
  const elements = readyInterfaceElements(materialInterfaceField);
  const rows = new Float32Array(elements.length * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS);
  let readyCount = 0;
  let domainPairReadyCount = 0;
  let domainIdentityObservedCount = 0;
  for (const [index, element] of elements.entries()) {
    const kinematics = interfaceContactKinematicsForElement(element);
    const identity = bodyDomainIdentityForInterfaceElement(element);
    const domainIds = identity.domainIds ?? [identity.sourceDomainId, identity.targetDomainId];
    if (kinematics.status === 'interface-contact-kinematics-ready') readyCount += 1;
    if (identity.domainPairReady) domainPairReadyCount += 1;
    if (identity.bodyIdentityObserved) domainIdentityObservedCount += 1;
    const offset = index * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS;
    rows.set([
      kinematics.gapM,
      kinematics.normalVelocityMPerS,
      kinematics.representativeMassKg,
      kinematics.ready ? 1 : 0,
      stableDomainId(domainIds?.[0]),
      stableDomainId(domainIds?.[1]),
      identity.domainPairReady ? 1 : 0,
      0
    ], offset);
  }
  return {
    schema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    status: readyCount > 0
      ? 'interface-contact-kinematics-packed'
      : (elements.length > 0
          ? 'interface-contact-kinematics-unavailable'
          : 'interface-contact-kinematics-empty'),
    rows,
    rowCount: elements.length,
    readyCount,
    domainPairReadyCount,
    domainIdentityObservedCount,
    rowStrideFloats: SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
    rowByteLength: rows.byteLength
  };
}

function vectorMagnitude3(value = [0, 0, 0]) {
  return Math.hypot(
    finiteNumber(value[0], 0),
    finiteNumber(value[1], 0),
    finiteNumber(value[2], 0)
  );
}

function cleanVector3(value = [0, 0, 0]) {
  return [
    Math.abs(finiteNumber(value[0], 0)) < 1e-12 ? 0 : finiteNumber(value[0], 0),
    Math.abs(finiteNumber(value[1], 0)) < 1e-12 ? 0 : finiteNumber(value[1], 0),
    Math.abs(finiteNumber(value[2], 0)) < 1e-12 ? 0 : finiteNumber(value[2], 0)
  ];
}

function addVector3(a = [0, 0, 0], b = [0, 0, 0]) {
  return [
    finiteNumber(a[0], 0) + finiteNumber(b[0], 0),
    finiteNumber(a[1], 0) + finiteNumber(b[1], 0),
    finiteNumber(a[2], 0) + finiteNumber(b[2], 0)
  ];
}

function vector3From(value = null, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((index) => {
    const number = Number(Array.isArray(value) ? value[index] : undefined);
    return Number.isFinite(number) ? number : fallback[index];
  });
}

function gasPressureFieldResolutionDiagnostics(gasCellField = null) {
  const unavailable = !gasCellField || gasCellField.status === 'gas-cell-pressure-field-unavailable';
  const localPressureGradientReady = gasCellField?.localPressureGradientReady === true;
  const blockers = Array.isArray(gasCellField?.localPressureGradientBlockers)
    ? [...gasCellField.localPressureGradientBlockers]
    : (localPressureGradientReady ? [] : [...LOCAL_PRESSURE_GRADIENT_BLOCKERS]);
  return {
    pressureFieldMode: gasCellField?.pressureFieldMode || (
      localPressureGradientReady
        ? LOCAL_GAS_CELL_PRESSURE_FIELD_MODE
        : (unavailable ? 'pressure-field-unavailable' : UNIFORM_GAS_PRESSURE_FIELD_MODE)
    ),
    pressureFieldResolution: gasCellField?.pressureFieldResolution || (
      localPressureGradientReady
        ? LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION
        : (unavailable ? 'pressure-field-unavailable' : UNIFORM_GAS_PRESSURE_FIELD_RESOLUTION)
    ),
    pressureGradientStatus: gasCellField?.gradientStatus || (
      localPressureGradientReady
        ? 'local-pressure-gradient-field-ready'
        : (unavailable ? 'pressure-field-unavailable' : 'uniform-sealed-gas-pressure-zero-gradient')
    ),
    localPressureGradientSchema: gasCellField?.localPressureGradientSchema || ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
    localPressureGradientReady,
    localPressureGradientStatus: gasCellField?.localPressureGradientStatus || (
      localPressureGradientReady
        ? 'local-pressure-gradient-field-ready'
        : (unavailable
            ? 'blocked-pressure-field-unavailable'
            : 'blocked-uniform-single-cell-field-has-no-local-gradient')
    ),
    localPressureGradientBlockers: blockers,
    localPressureGradientForceCouplingStatus: localPressureGradientReady
      ? 'local-pressure-gradient-force-coupling-ready'
      : 'blocked-local-pressure-gradient-field-required',
    localPressureGradientValidation: gasCellField?.localPressureGradientValidation === true
  };
}

function normalizedGasPressureCells(gasCellField = null) {
  if (gasCellField?.localPressureGradientReady !== true || !Array.isArray(gasCellField?.cells)) return [];
  const cells = [];
  for (const [index, cell] of gasCellField.cells.entries()) {
    const pressurePa = finiteNumber(cell?.pressurePa, Number.NaN);
    if (!Number.isFinite(pressurePa) || pressurePa < 0) continue;
    cells.push({
      index: finiteNumber(cell?.index, index),
      gridIndex: Array.isArray(cell?.gridIndex)
        ? cell.gridIndex.map((value) => Math.max(0, Math.round(finiteNumber(value, 0)))).slice(0, 3)
        : [index, 0, 0],
      centerM: vector3From(cell?.centerM ?? cell?.centroidM),
      pressurePa,
      pressureGradientPaPerM: vector3From(cell?.pressureGradientPaPerM ?? cell?.gradientPaPerM),
      volumeM3: finiteNumber(cell?.volumeM3, 0),
      status: cell?.status || 'local-gas-pressure-cell-ready'
    });
  }
  return cells;
}

export function packGasPressureCellRows(gasCellField = null) {
  const cells = normalizedGasPressureCells(gasCellField);
  const rows = new Float32Array(cells.length * SPH_GAS_PRESSURE_CELL_FLOATS);
  for (const [index, cell] of cells.entries()) {
    const offset = index * SPH_GAS_PRESSURE_CELL_FLOATS;
    rows.set([
      finiteNumber(cell.gridIndex[0], 0),
      finiteNumber(cell.gridIndex[1], 0),
      finiteNumber(cell.gridIndex[2], 0),
      cell.status === 'local-gas-pressure-cell-ready' ? 1 : 0,
      cell.centerM[0],
      cell.centerM[1],
      cell.centerM[2],
      cell.pressurePa,
      cell.pressureGradientPaPerM[0],
      cell.pressureGradientPaPerM[1],
      cell.pressureGradientPaPerM[2],
      cell.volumeM3
    ], offset);
  }
  return {
    cells,
    rows,
    rowCount: cells.length,
    rowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
    rowByteLength: rows.byteLength
  };
}

function pressureForElementFromCells(element = {}, cells = [], fallbackPressurePa = 0) {
  if (!cells.length) return fallbackPressurePa;
  const centroid = vector3From(element.centroidM);
  let selected = null;
  let selectedDistance2 = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (cell.status !== 'local-gas-pressure-cell-ready') continue;
    const dx = centroid[0] - cell.centerM[0];
    const dy = centroid[1] - cell.centerM[1];
    const dz = centroid[2] - cell.centerM[2];
    const distance2 = dx * dx + dy * dy + dz * dz;
    if (distance2 < selectedDistance2) {
      selected = { cell, deltaM: [dx, dy, dz] };
      selectedDistance2 = distance2;
    }
  }
  if (!selected) return fallbackPressurePa;
  const gradient = selected.cell.pressureGradientPaPerM;
  return Math.max(
    0,
    selected.cell.pressurePa
      + gradient[0] * selected.deltaM[0]
      + gradient[1] * selected.deltaM[1]
      + gradient[2] * selected.deltaM[2]
  );
}

function normalAreaVectorForElement(element = {}) {
  if (Array.isArray(element.normalAreaVectorM2)) {
    return [
      finiteNumber(element.normalAreaVectorM2[0], 0),
      finiteNumber(element.normalAreaVectorM2[1], 0),
      finiteNumber(element.normalAreaVectorM2[2], 0)
    ];
  }
  if (Array.isArray(element.normal)) {
    const area = finiteNumber(element.areaM2, 0);
    return [
      finiteNumber(element.normal[0], 0) * area,
      finiteNumber(element.normal[1], 0) * area,
      finiteNumber(element.normal[2], 0) * area
    ];
  }
  return [0, 0, 0];
}

function readyInterfaceElements(materialInterfaceField = null) {
  return Array.isArray(materialInterfaceField?.elements)
    ? materialInterfaceField.elements.filter((element) => (
        element?.status === 'interface-element-ready'
        && finiteNumber(element.areaM2, 0) > 0
      ))
    : [];
}

export function packMaterialInterfaceElementRows(materialInterfaceField = null) {
  const elements = readyInterfaceElements(materialInterfaceField);
  const rows = new Float32Array(elements.length * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS);
  for (const [index, element] of elements.entries()) {
    const offset = index * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS;
    const centroid = Array.isArray(element.centroidM) ? element.centroidM : [0, 0, 0];
    const normal = Array.isArray(element.normal) ? element.normal : [0, 0, 0];
    const normalArea = normalAreaVectorForElement(element);
    rows.set([
      finiteNumber(element.surfaceIndex, 0),
      finiteNumber(element.materialId, 0),
      finiteNumber(element.phaseId, 0),
      finiteNumber(element.axisId, 0),
      finiteNumber(centroid[0], 0),
      finiteNumber(centroid[1], 0),
      finiteNumber(centroid[2], 0),
      finiteNumber(element.areaM2, 0),
      finiteNumber(normal[0], 0),
      finiteNumber(normal[1], 0),
      finiteNumber(normal[2], 0),
      normalArea[0],
      normalArea[1],
      normalArea[2],
      finiteNumber(element.crossingSign, 0),
      1
    ], offset);
  }
  return {
    elements,
    rows,
    rowCount: elements.length,
    rowStrideFloats: SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
    rowByteLength: rows.byteLength
  };
}

function sourceParticleIndexForInterfaceElement(element = {}) {
  return finiteOptionalNumber(
    element.sourceParticleIndex
      ?? element.sourceParticle?.index
      ?? element.sourceParticleId
      ?? element.sourceParticleID
  );
}

export function packMaterialInterfaceSourceKeyRows(materialInterfaceField = null) {
  const elements = readyInterfaceElements(materialInterfaceField);
  const rows = new Float32Array(elements.length * SPH_INTERFACE_SOURCE_KEY_FLOATS);
  let readyCount = 0;
  for (const [index, element] of elements.entries()) {
    const offset = index * SPH_INTERFACE_SOURCE_KEY_FLOATS;
    const sourceParticleIndex = sourceParticleIndexForInterfaceElement(element);
    const ready = sourceParticleIndex != null && sourceParticleIndex >= 0;
    if (ready) readyCount += 1;
    rows.set([
      index,
      ready ? sourceParticleIndex : 0,
      ready ? 1 : 0,
      0
    ], offset);
  }
  return {
    schema: ULG_INTERFACE_SOURCE_KEY_SCHEMA,
    status: readyCount > 0
      ? 'interface-source-key-rows-packed'
      : (elements.length > 0
          ? 'interface-source-key-rows-unavailable'
          : 'interface-source-key-rows-empty'),
    rows,
    rowCount: elements.length,
    readyCount,
    rowStrideFloats: SPH_INTERFACE_SOURCE_KEY_FLOATS,
    rowByteLength: rows.byteLength,
    source: 'material-interface-elements'
  };
}

export function createPressureInterfaceParamsArray({
  elementCount = 0,
  pressurePa = 0,
  gasPressureCellCount = 0,
  pressureModelId = 0,
  contactPolicyRowCount = 0,
  algorithmContactPairResponseScale = DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE,
  algorithmContactMaxPressurePa = DEFAULT_ALGORITHM_CONTACT_PAIR_MAX_PRESSURE_PA,
  algorithmContactPairResponseEnabled = false
} = {}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(elementCount, 0))), true);
  view.setFloat32(4, finiteNumber(pressurePa, 0), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(gasPressureCellCount, 0))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(pressureModelId, 0))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(contactPolicyRowCount, 0))), true);
  view.setFloat32(20, clampPositive(algorithmContactPairResponseScale, DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE), true);
  view.setFloat32(24, contactPressureCap({ algorithmContactMaxPressurePa }), true);
  view.setFloat32(28, algorithmContactPairResponseEnabled ? 1 : 0, true);
  return buffer;
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(16, data?.byteLength ?? 0);
  const buffer = tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  if (data?.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function spatialU32(value, fallback = 0) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 0xffff_ffff
    ? value
    : fallback;
}

function spatialI32(value, fallback = 0) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= -0x8000_0000
    && value <= 0x7fff_ffff
    ? value
    : fallback;
}

function spatialSize(value, fallback = 0) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    ? value
    : fallback;
}

function unavailableSchroederSpatialSource(source, device, status, reason, extra = {}) {
  return {
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
    sourceSchema: source?.schema ?? null,
    sourceStatus: source?.status ?? null,
    adapterSchema: source?.spatialEpochSourceSchema ?? null,
    adapterStatus: source?.spatialEpochSourceStatus ?? null,
    status,
    reason,
    ready: false,
    sourceCount: 0,
    sourceDeviceId: null,
    consumerDeviceId: device ? webGpuDeviceMismatchInfo({ device }).consumerDeviceId : null,
    ...extra
  };
}

export function resolveSchroederPressureInterfaceSpatialEpochSource(
  schroederActiveNodeList = null,
  { device = null, particleCount = 0 } = {}
) {
  const source = schroederActiveNodeList;
  if (!source) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-unavailable',
      'No canonical active-node source was provided to the pressure/interface stage'
    );
  }
  if (
    source.schema === ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA
    && source.status === 'schroeder-spatial-directory-source-ready'
    && source.ready === true
    && source.exactNearQueryProfile?.ready === true
  ) {
    const sourceBuffer = source.sourceBuffer ?? source.activeNodeBuffer ?? null;
    const queryProfile = source.exactNearQueryProfile;
    const sourceCount = spatialU32(source.sourceCount, Number.NaN);
    const expectedParticleCount = spatialU32(particleCount, Number.NaN);
    const sourceRowStrideFloats = spatialU32(
      source.sourceRowStrideFloats ?? source.activeNodeStrideFloats,
      Number.NaN
    );
    const sourceRowLayoutId = spatialU32(
      source.sourceRowLayoutId,
      Number.NaN
    );
    const sourceRowLayoutSupported =
      sourceRowLayoutId === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0
      || sourceRowLayoutId
        === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0;
    const mismatch = webGpuDeviceMismatchInfo({ buffer: sourceBuffer, device });
    if (
      !sourceBuffer
      || mismatch.mismatch
      || sourceCount <= 0
      || sourceCount !== expectedParticleCount
      || sourceRowStrideFloats !== SCHROEDER_SPATIAL_ACTIVE_NODE_FLOATS
      || !sourceRowLayoutSupported
    ) {
      return unavailableSchroederSpatialSource(
        source,
        device,
        'schroeder-spatial-exact-near-source-rejected-buffer-family',
        'Canonical directory source does not expose one same-device 16-float source family',
        mismatch
      );
    }
    return {
      schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
      sourceSchema: source.sourceSchema ?? null,
      sourceStatus: source.sourceStatus ?? null,
      adapterSchema: queryProfile.schema,
      adapterStatus: queryProfile.status,
      status: 'schroeder-spatial-exact-near-source-ready',
      reason: null,
      ready: true,
      sourceBuffer,
      sourceRowLayoutId,
      sourceRowStrideFloats,
      sourceCount,
      chartId: queryProfile.chartId,
      minLevel: queryProfile.minLevel,
      maxLevel: queryProfile.maxLevel,
      levelCount: queryProfile.levelCount,
      baseGridSpacingM: queryProfile.baseGridSpacingM,
      levelSpacingMode: queryProfile.levelSpacingMode,
      positionAuthority: queryProfile.positionAuthority,
      physicsTick: source.physicsTick,
      physicsSubstep: source.physicsSubstep,
      positionEpoch: source.positionEpoch,
      topologyEpoch: source.topologyEpoch,
      chartEpoch: source.chartEpoch,
      levelEpoch: source.levelEpoch,
      supportEpoch: source.supportEpoch,
      storageGeneration: source.storageGeneration,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  if (source.phaseVolumeAssignmentOverlayEnabled === true) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-overlay',
      'Phase-volume overlays require an explicit per-level spacing sidecar before canonical admission'
    );
  }
  if (
    source.spatialEpochSourceSchema !== SCHROEDER_SPATIAL_SOURCE_SCHEMA
    || source.spatialEpochSourceReady !== true
    || source.spatialEpochSourceStatus !== 'schroeder-spatial-active-node-source-ready'
  ) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-contract',
      source.spatialEpochSourceStatus
        || 'Canonical active-node spacing/source contract is not proven'
    );
  }
  if (
    source.spatialEpochLevelSpacingMode !== SCHROEDER_SPATIAL_LEVEL_SPACING_MODE
    || source.spatialEpochPositionAuthority !== SCHROEDER_SPATIAL_POSITION_AUTHORITY
  ) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-key-profile',
      'Canonical exact-near requires declared pow2 level spacing and pre-integration position authority'
    );
  }
  const activeNodeBuffer = source.activeNodeBuffer || source.buffer || null;
  if (!activeNodeBuffer) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-buffer',
      'Canonical active-node source has no retained GPU buffer'
    );
  }
  const mismatch = webGpuDeviceMismatchInfo({ buffer: activeNodeBuffer, device });
  if (mismatch.mismatch) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-device',
      'Canonical active-node source belongs to another WebGPU device',
      {
        sourceDeviceId: mismatch.sourceDeviceId,
        consumerDeviceId: mismatch.consumerDeviceId
      }
    );
  }
  const sourceCount = spatialU32(
    source.activeCandidateCount ?? source.activeNodeCount ?? source.particleCount,
    Number.NaN
  );
  const expectedParticleCount = spatialU32(particleCount, Number.NaN);
  const strideFloats = spatialU32(source.activeNodeStrideFloats, Number.NaN);
  if (sourceCount <= 0 || sourceCount !== expectedParticleCount) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-count',
      `Canonical active-node count ${sourceCount} does not match particle count ${expectedParticleCount}`,
      { sourceCount }
    );
  }
  if (strideFloats !== SCHROEDER_SPATIAL_ACTIVE_NODE_FLOATS) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-stride',
      `Canonical active-node stride ${strideFloats} is not ${SCHROEDER_SPATIAL_ACTIVE_NODE_FLOATS}`,
      { sourceCount }
    );
  }
  const requiredBytes = sourceCount
    * SCHROEDER_SPATIAL_ACTIVE_NODE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  if (Number.isFinite(Number(activeNodeBuffer.size)) && Number(activeNodeBuffer.size) < requiredBytes) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-buffer-size',
      `Canonical active-node buffer has ${activeNodeBuffer.size} bytes; ${requiredBytes} required`,
      { sourceCount }
    );
  }
  const minLevel = spatialI32(source.spatialEpochMinLevel, Number.NaN);
  const maxLevel = spatialI32(source.spatialEpochMaxLevel, Number.NaN);
  const chartId = spatialU32(source.spatialEpochChartId, Number.NaN);
  const baseGridSpacingM = typeof source.spatialEpochBaseGridSpacingM === 'number'
    && Number.isFinite(source.spatialEpochBaseGridSpacingM)
    ? source.spatialEpochBaseGridSpacingM
    : Number.NaN;
  const levelCount = maxLevel - minLevel + 1;
  const storageGeneration = spatialU32(source.spatialEpochStorageGeneration, Number.NaN);
  const physicsTick = spatialU32(source.spatialEpochPhysicsTick, Number.NaN);
  const physicsSubstep = spatialU32(source.spatialEpochPhysicsSubstep, Number.NaN);
  const positionEpoch = spatialU32(source.spatialEpochPositionEpoch, Number.NaN);
  const topologyEpoch = spatialU32(source.spatialEpochTopologyEpoch, Number.NaN);
  const chartEpoch = spatialU32(source.spatialEpochChartEpoch, Number.NaN);
  const levelEpoch = spatialU32(source.spatialEpochLevelEpoch, Number.NaN);
  const supportEpoch = spatialU32(source.spatialEpochSupportEpoch, Number.NaN);
  if (
    !Number.isInteger(minLevel)
    || !Number.isInteger(maxLevel)
    || levelCount <= 0
    || levelCount > 64
    || !Number.isInteger(chartId)
    || chartId < 0
    || chartId > 0x00ff_ffff
    || !(baseGridSpacingM > 0)
    || !Number.isFinite(baseGridSpacingM * (2 ** minLevel))
    || !(baseGridSpacingM * (2 ** minLevel) > 0)
    || !Number.isFinite(baseGridSpacingM * (2 ** maxLevel))
    || !(baseGridSpacingM * (2 ** maxLevel) > 0)
    || !Number.isInteger(storageGeneration)
    || storageGeneration < 1
    || !Number.isInteger(physicsTick)
    || !Number.isInteger(physicsSubstep)
    || !Number.isInteger(positionEpoch)
    || !Number.isInteger(topologyEpoch)
    || !Number.isInteger(chartEpoch)
    || !Number.isInteger(levelEpoch)
    || !Number.isInteger(supportEpoch)
  ) {
    return unavailableSchroederSpatialSource(
      source,
      device,
      'schroeder-spatial-exact-near-source-rejected-level-range',
      'Canonical active-node level/chart/base-spacing/generation profile is not safely queryable',
      { sourceCount }
    );
  }
  return {
    schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
    sourceSchema: source.schema ?? null,
    sourceStatus: source.status ?? null,
    adapterSchema: source.spatialEpochSourceSchema,
    adapterStatus: source.spatialEpochSourceStatus,
    status: 'schroeder-spatial-exact-near-source-ready',
    reason: null,
    ready: true,
    sourceBuffer: activeNodeBuffer,
    activeNodeBuffer,
    sourceRowLayoutId: SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0,
    sourceRowStrideFloats: strideFloats,
    sourceCount,
    activeNodeStrideFloats: strideFloats,
    chartId,
    minLevel,
    maxLevel,
    levelCount,
    baseGridSpacingM,
    levelSpacingMode: source.spatialEpochLevelSpacingMode,
    positionAuthority: source.spatialEpochPositionAuthority,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    storageGeneration,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId
  };
}

export function resolveSchroederPressureInterfaceSpatialEpochProvenance({
  spatialSource = null,
  materialInterfaceField = null,
  particleSource = null,
  particleCount = 0,
  requireCompleteBufferFamily = false
} = {}) {
  const base = {
    status: 'schroeder-spatial-exact-near-interface-provenance-unavailable',
    reason: 'Material-interface epoch provenance was not provided',
    ready: false,
    sourcePositionEpoch: spatialSource?.positionEpoch ?? null,
    interfacePositionEpoch: null,
    sourceTopologyEpoch: spatialSource?.topologyEpoch ?? null,
    interfaceTopologyEpoch: null,
    sourceStorageGeneration: spatialSource?.storageGeneration ?? null,
    interfaceStorageGeneration: null,
    particleBufferFamilyReady: false
  };
  if (spatialSource?.ready !== true || !materialInterfaceField) return base;
  const positionEpoch = spatialU32(
    materialInterfaceField.spatialEpochPositionEpoch,
    Number.NaN
  );
  const topologyEpoch = spatialU32(
    materialInterfaceField.spatialEpochTopologyEpoch,
    Number.NaN
  );
  const sourceCount = spatialU32(
    materialInterfaceField.spatialEpochSourceCount,
    Number.NaN
  );
  const storageGeneration = spatialU32(
    materialInterfaceField.spatialEpochStorageGeneration,
    Number.NaN
  );
  const authority = materialInterfaceField.spatialEpochPositionAuthority;
  const expectedCount = spatialU32(particleCount, Number.NaN);
  const stateBufferReady = materialInterfaceField.spatialEpochSourceStateBuffer
    === particleSource?.stateBuffer;
  const thermoBufferReady = materialInterfaceField.spatialEpochSourceThermoBuffer
    === particleSource?.thermoBuffer;
  const identityBufferReady = particleSource?.identityReady === true
    ? materialInterfaceField.spatialEpochSourceIdentityBuffer
      === particleSource.identityBuffer
    : materialInterfaceField.spatialEpochSourceIdentityBuffer == null;
  const particleBufferFamilyReady = Boolean(
    particleSource?.ready === true
    && stateBufferReady
    && thermoBufferReady
    && identityBufferReady
  );
  const extendedEpochFields = [
    ['physicsTick', 'spatialEpochPhysicsTick'],
    ['physicsSubstep', 'spatialEpochPhysicsSubstep'],
    ['chartEpoch', 'spatialEpochChartEpoch'],
    ['levelEpoch', 'spatialEpochLevelEpoch'],
    ['supportEpoch', 'spatialEpochSupportEpoch']
  ];
  const extendedEpochsReady = extendedEpochFields.every(([sourceField, interfaceField]) => (
    spatialU32(materialInterfaceField[interfaceField], Number.NaN)
      === spatialSource[sourceField]
  ));
  const particleEpochsReady = !requireCompleteBufferFamily || [
    ['storageGeneration', 'storageGeneration'],
    ['physicsTick', 'physicsTick'],
    ['physicsSubstep', 'physicsSubstep'],
    ['positionEpoch', 'positionEpoch'],
    ['topologyEpoch', 'topologyEpoch'],
    ['chartEpoch', 'chartEpoch'],
    ['levelEpoch', 'levelEpoch'],
    ['supportEpoch', 'supportEpoch']
  ].every(([particleField, sourceField]) => (
    particleSource?.[particleField] === spatialSource[sourceField]
  ));
  const baseReady = materialInterfaceField.spatialEpochInterfaceProvenanceStatus
      === 'material-interface-current-particle-epoch-ready'
    && authority === SCHROEDER_SPATIAL_POSITION_AUTHORITY
    && positionEpoch === spatialSource.positionEpoch
    && topologyEpoch === spatialSource.topologyEpoch
    && sourceCount === spatialSource.sourceCount
    && sourceCount === expectedCount;
  const completeBufferFamilyReady = storageGeneration === spatialSource.storageGeneration
    && particleBufferFamilyReady
    && extendedEpochsReady
    && particleEpochsReady;
  const ready = baseReady && (
    requireCompleteBufferFamily !== true || completeBufferFamilyReady
  );
  return {
    status: ready
      ? 'schroeder-spatial-exact-near-interface-provenance-ready'
      : 'schroeder-spatial-exact-near-interface-provenance-rejected',
    reason: ready
      ? null
      : (baseReady
          ? 'Material-interface rows do not prove the complete storage/epoch/buffer family consumed by exact-near'
          : 'Material-interface rows do not prove the same position/topology/count epoch as the canonical directory source'),
    ready,
    authority: authority ?? null,
    sourcePositionEpoch: spatialSource.positionEpoch,
    interfacePositionEpoch: Number.isInteger(positionEpoch) ? positionEpoch : null,
    sourceTopologyEpoch: spatialSource.topologyEpoch,
    interfaceTopologyEpoch: Number.isInteger(topologyEpoch) ? topologyEpoch : null,
    sourceStorageGeneration: spatialSource.storageGeneration,
    interfaceStorageGeneration: Number.isInteger(storageGeneration)
      ? storageGeneration
      : null,
    sourceCount: spatialSource.sourceCount,
    interfaceSourceCount: Number.isInteger(sourceCount) ? sourceCount : null,
    requireCompleteBufferFamily: requireCompleteBufferFamily === true,
    particleBufferFamilyReady,
    stateBufferReady,
    thermoBufferReady,
    identityBufferReady,
    extendedEpochsReady,
    particleEpochsReady,
    completeBufferFamilyReady
  };
}

function rejectedBorrowedSchroederPressureSpatialGeneration(
  generation,
  device,
  status,
  reason,
  extra = {}
) {
  return {
    supplied: generation != null,
    selected: false,
    ready: false,
    borrowed: generation != null,
    ownsGeneration: false,
    directoryOwnership: generation != null
      ? 'borrowed-caller-owned-canonical-generation-rejected'
      : 'not-supplied',
    status,
    reason,
    source: null,
    execution: null,
    runtime: null,
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: Math.max(
      0,
      Math.trunc(finiteNumber(generation?.directoryBuildCount, 0))
    ),
    privateParticleBinBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveParticleScanCount: 0,
    releaseScheduled: false,
    releaseStatus: generation != null
      ? 'borrowed-generation-release-owned-by-caller'
      : 'not-applicable-no-generation',
    sourceDeviceId: null,
    consumerDeviceId: device ? webGpuDeviceMismatchInfo({ device }).consumerDeviceId : null,
    ...extra
  };
}

/**
 * Adapt a caller-owned canonical generation into the pressure exact-near view.
 * The exact-near source still supplies its chart/level-spacing query profile;
 * object identity plus every immutable epoch field proves that it is the same
 * source used to build the borrowed directory.  This consumer never releases
 * the generation: its owner must fence after the final reader submits.
 */
export function resolveSchroederPressureInterfaceSpatialEpochGeneration(
  generation = null,
  {
    device = null,
    spatialSource = null,
    spatialProvenance = null,
    particleSource = null,
    particleCount = 0
  } = {}
) {
  if (!generation) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-not-supplied',
      'No caller-owned canonical spatial generation was supplied'
    );
  }
  if (generation.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-schema',
      'Caller-owned spatial generation schema is not generation.v1'
    );
  }
  if (
    generation.status !== 'schroeder-spatial-epoch-generation-submitted'
    || generation.ready !== true
    || generation.selected !== true
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-state',
      generation.reason || 'Caller-owned spatial generation is not ready and selected'
    );
  }
  if (generation.releaseScheduled === true) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-release-scheduled',
      'The owner already captured the final-consumer fence for this generation'
    );
  }
  const execution = generation.execution || null;
  if (
    execution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || execution.status !== 'schroeder-spatial-epoch-gpu-build-submitted'
    || execution.submitPerformed !== true
    || execution.released === true
    || !execution.directoryBuffer
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-execution',
      execution?.released === true
        ? 'Caller-owned spatial generation was already released'
        : 'Caller-owned spatial execution is incomplete or was not submitted'
    );
  }
  const mismatch = webGpuDeviceMismatchInfo({
    buffer: execution.directoryBuffer,
    device
  });
  if (mismatch.mismatch) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-device',
      'Caller-owned spatial directory belongs to another WebGPU device',
      mismatch
    );
  }
  const ownerRuntime = generation.runtime || null;
  let ownerRuntimeOwnsExecution = false;
  let ownerRuntimeSubmissionProven = false;
  try {
    ownerRuntimeOwnsExecution = ownerRuntime?.ownsExecution?.(execution) === true;
    ownerRuntimeSubmissionProven = ownerRuntime?.isExecutionSubmitted?.(execution)
      === true;
  } catch {
    ownerRuntimeOwnsExecution = false;
    ownerRuntimeSubmissionProven = false;
  }
  if (
    ownerRuntime?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || ownerRuntime.status !== 'schroeder-spatial-epoch-gpu-runtime-ready'
    || ownerRuntime.deviceId !== mismatch.consumerDeviceId
    || ownerRuntime !== execution.ownerRuntime
    || typeof ownerRuntime.releaseExecutionAfter !== 'function'
    || !ownerRuntimeOwnsExecution
    || !ownerRuntimeSubmissionProven
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-owner-runtime',
      'Caller-owned spatial generation lacks a live same-device runtime that owns this execution'
    );
  }
  if (spatialSource?.ready !== true || spatialProvenance?.ready !== true) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-provenance',
      spatialProvenance?.reason
        || spatialSource?.reason
        || 'Exact-near source and interface rows do not prove one immutable epoch'
    );
  }
  const generationSource = generation.source || null;
  const expectedParticleCount = spatialU32(particleCount, Number.NaN);
  const spatialSourceBuffer = spatialSource.sourceBuffer
    ?? spatialSource.activeNodeBuffer
    ?? null;
  const executionSourceBuffer = execution.sourceBuffer
    ?? execution.activeNodeBuffer
    ?? null;
  const generationSourceBuffer = generationSource?.sourceBuffer
    ?? generationSource?.activeNodeBuffer
    ?? null;
  const sourceRowLayoutId = spatialU32(
    spatialSource.sourceRowLayoutId,
    Number.NaN
  );
  const expectedSourceFamily = sourceRowLayoutId
    === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0
    ? 'schroeder-level-assignment-particles'
    : sourceRowLayoutId === SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_ACTIVE_NODE_V0
      ? 'schroeder-active-node-particles'
      : null;
  if (executionSourceBuffer !== spatialSourceBuffer) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-execution-source',
      'Borrowed directory execution was encoded from a different source buffer'
    );
  }
  if (
    generationSource?.schema !== ULG_SCHROEDER_SPATIAL_DIRECTORY_SOURCE_SCHEMA
    || generationSource.status !== 'schroeder-spatial-directory-source-ready'
    || generationSource.ready !== true
    || generationSourceBuffer !== spatialSourceBuffer
    || generationSource.sourceCount !== spatialSource.sourceCount
    || generationSource.sourceCount !== expectedParticleCount
    || (generationSource.sourceRowStrideFloats
      ?? generationSource.activeNodeStrideFloats) !== SCHROEDER_SPATIAL_ACTIVE_NODE_FLOATS
    || generationSource.sourceRowLayoutId !== sourceRowLayoutId
    || execution.sourceRowLayoutId !== sourceRowLayoutId
    || expectedSourceFamily == null
    || generationSource.phaseVolumeAssignmentOverlayEnabled === true
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-source',
      'Borrowed directory source is not the exact canonical 16-float source layout admitted by pressure/contact'
    );
  }
  const queryProfile = generationSource.exactNearQueryProfile || null;
  if (
    queryProfile?.schema
      !== 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1'
    || queryProfile.status !== 'schroeder-spatial-exact-near-query-profile-ready'
    || queryProfile.ready !== true
    || (queryProfile.sourceBuffer ?? queryProfile.activeNodeBuffer)
      !== spatialSourceBuffer
    || queryProfile.sourceCount !== spatialSource.sourceCount
    || queryProfile.chartId !== spatialSource.chartId
    || queryProfile.minLevel !== spatialSource.minLevel
    || queryProfile.maxLevel !== spatialSource.maxLevel
    || queryProfile.levelCount !== spatialSource.levelCount
    || queryProfile.baseGridSpacingM !== spatialSource.baseGridSpacingM
    || queryProfile.levelSpacingMode !== spatialSource.levelSpacingMode
    || queryProfile.positionAuthority !== spatialSource.positionAuthority
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-query-profile',
      'Borrowed generation does not authenticate the exact chart/level/spacing query profile'
    );
  }
  const gpuQueryProfile = execution.exactNearQueryProfile || null;
  if (
    execution.sourceAdapterId
      !== SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || gpuQueryProfile?.schema
      !== 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1'
    || gpuQueryProfile.status
      !== 'schroeder-spatial-exact-near-query-profile-ready'
    || gpuQueryProfile.ready !== true
    || gpuQueryProfile.sourceAdapterId
      !== SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || gpuQueryProfile.sourceCount !== spatialSource.sourceCount
    || gpuQueryProfile.chartId !== spatialSource.chartId
    || gpuQueryProfile.minLevel !== spatialSource.minLevel
    || gpuQueryProfile.maxLevel !== spatialSource.maxLevel
    || gpuQueryProfile.levelCount !== spatialSource.levelCount
    || gpuQueryProfile.baseGridSpacingM
      !== Math.fround(spatialSource.baseGridSpacingM)
    || gpuQueryProfile.levelSpacingMode !== spatialSource.levelSpacingMode
    || gpuQueryProfile.positionAuthority !== spatialSource.positionAuthority
    || execution.queryGeometryEvidence !== gpuQueryProfile
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-gpu-query-evidence',
      'Borrowed generation is not adapter-2 GPU-authenticated for this exact chart, level range, and f32 spacing profile'
    );
  }
  const epochFields = [
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ];
  for (const field of epochFields) {
    if (
      generationSource[field] !== spatialSource[field]
      || queryProfile[field] !== spatialSource[field]
      || execution[field] !== spatialSource[field]
    ) {
      return rejectedBorrowedSchroederPressureSpatialGeneration(
        generation,
        device,
        `schroeder-spatial-exact-near-shared-generation-rejected-${field}`,
        `Borrowed directory ${field} does not match the exact-near source epoch`,
        {
          mismatchField: field,
          expected: spatialSource[field],
          sourceActual: generationSource[field],
          queryProfileActual: queryProfile[field],
          executionActual: execution[field]
        }
      );
    }
  }
  const generationId = spatialU32(execution.generationId, Number.NaN);
  const deviceOrdinal = spatialU32(execution.deviceOrdinal, Number.NaN);
  const laneOrdinal = spatialU32(execution.laneOrdinal, Number.NaN);
  const leaseToken = spatialU32(execution.leaseToken, Number.NaN);
  const sourceFamilyId = spatialU32(execution.sourceFamilyId, Number.NaN);
  const buildOrdinal = spatialU32(execution.buildOrdinal, Number.NaN);
  const sortUniqueOrdinal = spatialU32(execution.sortUniqueOrdinal, Number.NaN);
  const arenaIndex = spatialU32(execution.arenaIndex, Number.NaN);
  const arenaGeneration = spatialU32(execution.arenaGeneration, Number.NaN);
  const identityReady = Boolean(
    generationId > 0
    && Number.isInteger(deviceOrdinal)
    && Number.isInteger(laneOrdinal)
    && leaseToken > 0
    && sourceFamilyId > 0
    && execution.sourceFamily === expectedSourceFamily
    && buildOrdinal > 0
    && sortUniqueOrdinal === buildOrdinal
    && Number.isInteger(arenaIndex)
    && arenaGeneration > 0
    && execution.deviceId === mismatch.consumerDeviceId
  );
  if (!identityReady) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-identity',
      'Borrowed directory execution lacks complete device/lane/lease/source/build identity'
    );
  }
  const sourceCapacity = spatialU32(execution.sourceCapacity, Number.NaN);
  const cellCapacity = spatialU32(execution.cellCapacity, Number.NaN);
  let expectedLayout = null;
  if (
    Number.isInteger(sourceCapacity)
    && sourceCapacity >= expectedParticleCount
    && Number.isInteger(cellCapacity)
    && cellCapacity >= expectedParticleCount
  ) {
    try {
      expectedLayout = createSchroederSpatialEpochLayout({
        sourceCapacity,
        cellCapacity
      });
    } catch {
      expectedLayout = null;
    }
  }
  const layout = execution.layout || null;
  const layoutFields = [
    'schema',
    'headerOffsetWords',
    'headerWords',
    'cellKeysOffsetWords',
    'cellKeyWords',
    'cellOffsetsOffsetWords',
    'cellOffsetWords',
    'cellMembersOffsetWords',
    'cellMemberWords',
    'particleToCellOffsetWords',
    'particleToCellWords',
    'sourceCapacity',
    'cellCapacity',
    'wordLength',
    'byteLength'
  ];
  const layoutReady = expectedLayout != null && layoutFields.every((field) => (
    layout?.[field] === expectedLayout[field]
  ));
  const directoryBufferSize = execution.directoryBuffer?.size;
  const directoryBufferSizeReady = directoryBufferSize == null || (
    spatialSize(directoryBufferSize, Number.NaN) === directoryBufferSize
    && directoryBufferSize >= expectedLayout?.byteLength
  );
  if (
    execution.magic !== SCHROEDER_SPATIAL_EPOCH_MAGIC
    || execution.abiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
    || execution.exactKeyWordCount !== SCHROEDER_SPATIAL_EPOCH_KEY_WORDS
    || execution.sortKeyWordCount !== SCHROEDER_SPATIAL_EPOCH_KEY_WORDS
    || execution.sortMode !== SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5
    || execution.sourceCount !== expectedParticleCount
    || !layoutReady
    || !directoryBufferSizeReady
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-layout',
      'Borrowed directory is not a complete lexicographic u32x5 generation for this particle count'
    );
  }
  if (
    particleSource?.ready !== true
    || particleSource.particleCount !== expectedParticleCount
    || spatialProvenance.particleBufferFamilyReady !== true
    || spatialProvenance.completeBufferFamilyReady !== true
  ) {
    return rejectedBorrowedSchroederPressureSpatialGeneration(
      generation,
      device,
      'schroeder-spatial-exact-near-shared-generation-rejected-particle-family',
      'Exact-near particle buffers are not the complete immutable family proven by the interface field'
    );
  }
  return {
    supplied: true,
    selected: true,
    ready: true,
    borrowed: true,
    ownsGeneration: false,
    directoryOwnership: 'borrowed-caller-owned-canonical-generation',
    status: 'schroeder-spatial-exact-near-shared-generation-selected',
    reason: null,
    source: spatialSource,
    generation,
    execution,
    runtime: null,
    runtimeCapacity: generation.runtimeCapacity ?? execution.sourceCapacity,
    runtimeCacheHit: generation.runtimeCacheHit === true,
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: Math.max(
      0,
      Math.trunc(finiteNumber(generation.directoryBuildCount, 0))
    ),
    privateParticleBinBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveParticleScanCount: 0,
    queueCompletionStatus: 'borrowed-spatial-directory-already-submitted',
    queueCompletionMethod: 'caller-owned-queue.submit',
    releaseScheduled: false,
    releaseStatus: 'borrowed-generation-release-owned-by-caller',
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId
  };
}

export function createPressureInterfaceSpatialExactNearParamsArray({
  elementCount = 0,
  particleCount = 0,
  contactPolicyRowCount = 0,
  derivationEnabled = false,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  gapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M,
  spatialBuild = null
} = {}) {
  const execution = spatialBuild?.execution || null;
  const source = spatialBuild?.source || null;
  const layout = execution?.layout || {};
  const buffer = new ArrayBuffer(128);
  const view = new DataView(buffer);
  view.setUint32(0, spatialU32(elementCount), true);
  view.setUint32(4, spatialU32(particleCount), true);
  view.setUint32(8, spatialU32(contactPolicyRowCount), true);
  view.setUint32(12, derivationEnabled ? 1 : 0, true);
  view.setUint32(16, spatialU32(source?.chartId), true);
  view.setUint32(20, spatialU32(source?.levelCount), true);
  view.setUint32(24, spatialU32(execution?.generationId), true);
  view.setUint32(28, spatialU32(execution?.deviceOrdinal), true);
  view.setUint32(32, spatialU32(execution?.laneOrdinal), true);
  view.setUint32(36, spatialU32(execution?.leaseToken), true);
  view.setUint32(40, spatialU32(execution?.sourceFamilyId), true);
  view.setUint32(44, spatialU32(execution?.storageGeneration), true);
  view.setUint32(48, spatialU32(execution?.physicsTick), true);
  view.setUint32(52, spatialU32(execution?.physicsSubstep), true);
  view.setUint32(56, spatialU32(execution?.positionEpoch), true);
  view.setUint32(60, spatialU32(execution?.topologyEpoch), true);
  view.setUint32(64, spatialU32(execution?.chartEpoch), true);
  view.setUint32(68, spatialU32(execution?.levelEpoch), true);
  view.setUint32(72, spatialU32(execution?.supportEpoch), true);
  view.setInt32(76, spatialI32(source?.minLevel), true);
  view.setFloat32(80, clampPositive(source?.baseGridSpacingM, 0), true);
  view.setFloat32(84, clampPositive(maxSearchRadiusM, 0), true);
  view.setFloat32(88, clampPositive(gapFloorM, 0), true);
  view.setFloat32(92, 0, true);
  view.setUint32(96, spatialU32(layout.cellKeysOffsetWords), true);
  view.setUint32(100, spatialU32(layout.cellOffsetsOffsetWords), true);
  view.setUint32(104, spatialU32(layout.cellMembersOffsetWords), true);
  view.setUint32(108, spatialU32(layout.particleToCellOffsetWords), true);
  view.setUint32(112, spatialU32(layout.wordLength), true);
  view.setUint32(116, spatialU32(execution?.sourceCapacity), true);
  view.setUint32(120, spatialU32(execution?.cellCapacity), true);
  view.setUint32(124, 0, true);
  return buffer;
}

function resolveSchroederPressureInterfaceLawQueue(schroederLawQueue = null, {
  device = null,
  particleCount = 0
} = {}) {
  if (schroederLawQueue?.resolvedPressureInterfaceLawQueue === true) {
    return schroederLawQueue;
  }
  const base = {
    resolvedPressureInterfaceLawQueue: true,
    sourceSchema: schroederLawQueue?.schema ?? null,
    sourceStatus: schroederLawQueue?.status ?? null,
    status: 'schroeder-pressure-interface-law-queue-unavailable',
    consumerStatus: 'schroeder-pressure-interface-law-queue-not-provided',
    reason: schroederLawQueue ? null : 'No Schroeder law queue was provided to the pressure/interface stage',
    enabled: false,
    lawQueueBuffer: null,
    lawQueueBufferConsumed: false,
    activeNodeCount: 0,
    lawQueueStrideFloats: SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS,
    enabledLawMask: 0,
    contactInterfaceMask: SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK,
    sourceDeviceId: null,
    consumerDeviceId: device ? webGpuDeviceMismatchInfo({ device }).consumerDeviceId : null
  };
  if (!schroederLawQueue) return base;
  const schemaAccepted = schroederLawQueue.schema === ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA
    || schroederLawQueue.schema === ULG_SCHROEDER_LAW_QUEUE_SCHEMA;
  if (!schemaAccepted) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-queue-rejected',
      consumerStatus: 'schroeder-pressure-interface-law-queue-schema-mismatch',
      reason: 'Schroeder law queue schema is not compatible with the pressure/interface consumer'
    };
  }
  const lawQueueBuffer = schroederLawQueue.lawQueueBuffer
    || schroederLawQueue.queueBuffer
    || schroederLawQueue.buffer
    || null;
  if (!lawQueueBuffer) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-queue-rejected',
      consumerStatus: 'schroeder-pressure-interface-law-queue-buffer-missing',
      reason: 'Schroeder law queue did not expose a resident law queue buffer'
    };
  }
  const mismatch = webGpuDeviceMismatchInfo({ buffer: lawQueueBuffer, device });
  if (mismatch.mismatch) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-queue-rejected',
      consumerStatus: 'blocked-cross-device-schroeder-pressure-interface-law-queue',
      reason: 'Schroeder law queue buffer was created on a different WebGPU device',
      lawQueueBuffer,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  const activeNodeCount = Math.max(0, Math.round(finiteNumber(
    schroederLawQueue.activeNodeCount
      ?? schroederLawQueue.lawQueueRowCount
      ?? schroederLawQueue.queueRowCount
      ?? particleCount,
    particleCount
  )));
  if (activeNodeCount <= 0) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-queue-rejected',
      consumerStatus: 'schroeder-pressure-interface-law-queue-empty',
      reason: 'Schroeder law queue has no active rows',
      lawQueueBuffer,
      activeNodeCount,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  const lawQueueStrideFloats = Math.max(SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS, Math.round(finiteNumber(
    schroederLawQueue.lawQueueStrideFloats
      ?? schroederLawQueue.queueStrideFloats
      ?? schroederLawQueue.rowStrideFloats
      ?? SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS
  )));
  const enabledLawMask = Math.max(0, Math.round(finiteNumber(
    schroederLawQueue.enabledLawMask
      ?? schroederLawQueue.lawMask
      ?? SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK
  )));
  if ((enabledLawMask & SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK) === 0) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-queue-bypassed',
      consumerStatus: 'schroeder-pressure-interface-law-queue-contact-interface-mask-disabled',
      reason: 'Schroeder law queue is present but contact/interface law dispatch is disabled',
      lawQueueBuffer,
      activeNodeCount,
      lawQueueStrideFloats,
      enabledLawMask,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  return {
    ...base,
    status: 'schroeder-pressure-interface-law-queue-ready',
    consumerStatus: 'schroeder-pressure-interface-law-queue-ready',
    reason: null,
    enabled: true,
    lawQueueBuffer,
    activeNodeCount,
    lawQueueStrideFloats,
    enabledLawMask,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId
  };
}

function createSchroederPressureInterfaceLawQueueParamsArray(schroederLawQueue) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, schroederLawQueue?.enabled ? 1 : 0, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    schroederLawQueue?.activeNodeCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    schroederLawQueue?.lawQueueStrideFloats,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(
    schroederLawQueue?.contactInterfaceMask,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK
  ))), true);
  return buffer;
}

function createSchroederPressureInterfaceLawNeighborCandidateParamsArray(schroederLawNeighborCandidates) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, schroederLawNeighborCandidates?.neighborCandidateBufferConsumed ? 1 : 0, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates?.neighborCandidateCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    schroederLawNeighborCandidates?.neighborCandidateStrideFloats,
    SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates?.contactInterfaceMask,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK
  ))), true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

function createSchroederPressureInterfaceSourceSpanParamsArray(schroederLawNeighborCandidates) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, schroederLawNeighborCandidates?.sourceCandidateSpanBufferConsumed ? 1 : 0, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates?.sourceCandidateSpanCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    schroederLawNeighborCandidates?.sourceCandidateSpanStrideFloats,
    4
  ))), true);
  view.setUint32(12, schroederLawNeighborCandidates?.broadCandidateScanFallback === true ? 1 : 0, true);
  return buffer;
}

function createPressureInterfaceSourceKeyParamsArray(interfaceSourceKeys) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, interfaceSourceKeys?.sourceKeyBufferConsumed ? 1 : 0, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(interfaceSourceKeys?.rowCount, 0))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    interfaceSourceKeys?.rowStrideFloats,
    SPH_INTERFACE_SOURCE_KEY_FLOATS
  ))), true);
  view.setUint32(12, interfaceSourceKeys?.surfaceIndexFallbackEnabled === false ? 0 : 1, true);
  return buffer;
}

function resolveSchroederPressureInterfaceLawNeighborCandidates(schroederLawNeighborCandidates = null, {
  device = null
} = {}) {
  const base = {
    sourceSchema: schroederLawNeighborCandidates?.schema ?? null,
    sourceStatus: schroederLawNeighborCandidates?.status ?? null,
    status: 'schroeder-pressure-interface-law-neighbor-candidates-unavailable',
    consumerStatus: 'schroeder-pressure-interface-law-neighbor-candidates-not-provided',
    reason: schroederLawNeighborCandidates
      ? null
      : 'No Schroeder law-neighbor candidate rows were provided to the pressure/interface stage',
    available: false,
    authoritative: false,
    neighborCandidateBuffer: null,
    neighborCandidateBufferObserved: false,
    neighborCandidateBufferConsumed: false,
    neighborCandidateCount: 0,
    neighborCandidateStrideFloats: SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS,
    sourceCandidateSpanBuffer: null,
    sourceCandidateSpanBufferObserved: false,
    sourceCandidateSpanBufferConsumed: false,
    sourceCandidateSpanCount: 0,
    sourceCandidateSpanStrideFloats: 4,
    sourceCandidateSpanConsumerStatus: 'schroeder-pressure-interface-source-spans-not-provided',
    sourceCandidateSpanReason: schroederLawNeighborCandidates
      ? null
      : 'No Schroeder source-span table was provided to the pressure/interface stage',
    pressureInterfaceSpatialIndexStatus: 'pressure-interface-spatial-index-unavailable',
    pressureInterfaceSpatialIndexMode: null,
    broadCandidateScanFallback: false,
    candidateBudget: 0,
    lawQueueCount: 0,
    enabledLawMask: 0,
    contactInterfaceMask: SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK,
    enumerationMode: schroederLawNeighborCandidates?.enumerationMode ?? null,
    treeTraversalStatus: schroederLawNeighborCandidates?.treeTraversalStatus ?? null,
    sourceDeviceId: null,
    consumerDeviceId: device ? webGpuDeviceMismatchInfo({ device }).consumerDeviceId : null
  };
  if (!schroederLawNeighborCandidates) return base;
  const schemaAccepted = schroederLawNeighborCandidates.schema === ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA
    || schroederLawNeighborCandidates.schema === ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA;
  if (!schemaAccepted) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-neighbor-candidates-rejected',
      consumerStatus: 'schroeder-pressure-interface-law-neighbor-candidates-schema-mismatch',
      reason: 'Schroeder law-neighbor candidate schema is not compatible with the pressure/interface consumer'
    };
  }
  const neighborCandidateBuffer = schroederLawNeighborCandidates.neighborCandidateBuffer
    || schroederLawNeighborCandidates.candidateBuffer
    || schroederLawNeighborCandidates.buffer
    || null;
  if (!neighborCandidateBuffer) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-neighbor-candidates-rejected',
      consumerStatus: 'schroeder-pressure-interface-law-neighbor-candidates-buffer-missing',
      reason: 'Schroeder law-neighbor candidates did not expose a resident candidate buffer'
    };
  }
  const mismatch = webGpuDeviceMismatchInfo({ buffer: neighborCandidateBuffer, device });
  if (mismatch.mismatch) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-neighbor-candidates-rejected',
      consumerStatus: 'blocked-cross-device-schroeder-pressure-interface-law-neighbor-candidates',
      reason: 'Schroeder law-neighbor candidate buffer was created on a different WebGPU device',
      neighborCandidateBuffer,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  const neighborCandidateCount = Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates.neighborCandidateCount
      ?? schroederLawNeighborCandidates.candidateCount
      ?? schroederLawNeighborCandidates.rowCount,
    0
  )));
  if (neighborCandidateCount <= 0) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-neighbor-candidates-rejected',
      consumerStatus: 'schroeder-pressure-interface-law-neighbor-candidates-empty',
      reason: 'Schroeder law-neighbor candidates have no rows',
      neighborCandidateBuffer,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  const neighborCandidateStrideFloats = Math.max(
    SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS,
    Math.round(finiteNumber(
      schroederLawNeighborCandidates.neighborCandidateStrideFloats
        ?? schroederLawNeighborCandidates.candidateStrideFloats
        ?? schroederLawNeighborCandidates.rowStrideFloats,
      SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS
    ))
  );
  const enabledLawMask = Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates.enabledLawMask
      ?? schroederLawNeighborCandidates.lawMask
      ?? SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK
  )));
  if ((enabledLawMask & SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK) === 0) {
    return {
      ...base,
      status: 'schroeder-pressure-interface-law-neighbor-candidates-bypassed',
      consumerStatus: 'schroeder-pressure-interface-law-neighbor-candidates-contact-interface-mask-disabled',
      reason: 'Schroeder law-neighbor candidates are present but contact/interface law dispatch is disabled',
      neighborCandidateBuffer,
      neighborCandidateCount,
      neighborCandidateStrideFloats,
      enabledLawMask,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  const traversalBacked = String(schroederLawNeighborCandidates.enumerationMode || '').includes('active-node')
    || String(schroederLawNeighborCandidates.treeTraversalStatus || '').includes('active-node');
  const sourceCandidateSpanBuffer = schroederLawNeighborCandidates.sourceCandidateSpanBuffer
    || schroederLawNeighborCandidates.sourceSpanBuffer
    || schroederLawNeighborCandidates.sourceCandidateSpanRowsBuffer
    || null;
  const sourceCandidateSpanCount = Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates.sourceCandidateSpanCount
      ?? schroederLawNeighborCandidates.sourceSpanCount
      ?? schroederLawNeighborCandidates.particleCount,
    0
  )));
  const sourceCandidateSpanStrideFloats = Math.max(4, Math.round(finiteNumber(
    schroederLawNeighborCandidates.sourceCandidateSpanStrideFloats
      ?? schroederLawNeighborCandidates.sourceSpanStrideFloats
      ?? schroederLawNeighborCandidates.sourceCandidateSpanRowStrideFloats,
    4
  )));
  const sourceSpanMismatch = sourceCandidateSpanBuffer
    ? webGpuDeviceMismatchInfo({ buffer: sourceCandidateSpanBuffer, device })
    : null;
  const sourceSpanDeviceReady = Boolean(sourceCandidateSpanBuffer && !sourceSpanMismatch?.mismatch);
  const sourceSpanReady = Boolean(
    sourceSpanDeviceReady
      && sourceCandidateSpanCount > 0
      && sourceCandidateSpanStrideFloats >= 4
  );
  const broadCandidateScanFallback = schroederLawNeighborCandidates.broadCandidateScanFallback === true
    || schroederLawNeighborCandidates.allowBroadCandidateScanFallback === true;
  const candidateBufferConsumed = traversalBacked && (sourceSpanReady || broadCandidateScanFallback);
  const pressureInterfaceSpatialIndexStatus = sourceSpanReady
    ? 'pressure-interface-source-span-spatial-index-ready'
    : (sourceCandidateSpanBuffer && sourceSpanMismatch?.mismatch
        ? 'pressure-interface-source-span-spatial-index-rejected-cross-device'
        : (broadCandidateScanFallback
            ? 'pressure-interface-source-span-spatial-index-bypassed-broad-fallback-enabled'
            : 'pressure-interface-source-span-spatial-index-unavailable-using-particle-bins'));
  const sourceCandidateSpanConsumerStatus = sourceSpanReady
    ? 'schroeder-pressure-interface-source-spans-consumed'
    : (sourceCandidateSpanBuffer && sourceSpanMismatch?.mismatch
        ? 'blocked-cross-device-schroeder-pressure-interface-source-spans'
        : 'schroeder-pressure-interface-source-spans-missing-or-empty');
  return {
    ...base,
    status: 'schroeder-pressure-interface-law-neighbor-candidates-ready',
    consumerStatus: candidateBufferConsumed
      ? 'schroeder-pressure-interface-law-neighbor-candidates-consumed-authoritative'
      : 'schroeder-pressure-interface-law-neighbor-candidates-observed-not-authoritative',
    reason: candidateBufferConsumed
      ? (sourceSpanReady
          ? 'Traversal-backed law-neighbor candidate rows are consumed through retained source-span ranges'
          : 'Traversal-backed law-neighbor candidate rows are consumed with explicit broad-scan fallback')
      : 'Schroeder law-neighbor candidate rows are validated but not consumed until a retained source-span index is available',
    available: true,
    authoritative: candidateBufferConsumed,
    neighborCandidateBuffer,
    neighborCandidateBufferObserved: true,
    neighborCandidateBufferConsumed: candidateBufferConsumed,
    neighborCandidateCount,
    neighborCandidateStrideFloats,
    sourceCandidateSpanBuffer,
    sourceCandidateSpanBufferObserved: Boolean(sourceCandidateSpanBuffer),
    sourceCandidateSpanBufferConsumed: sourceSpanReady,
    sourceCandidateSpanCount,
    sourceCandidateSpanStrideFloats,
    sourceCandidateSpanConsumerStatus,
    sourceCandidateSpanReason: sourceSpanReady
      ? null
      : (sourceCandidateSpanBuffer && sourceSpanMismatch?.mismatch
          ? 'Schroeder source-span buffer was created on a different WebGPU device'
          : 'Schroeder source-span rows are required to avoid a full candidate scan in pressure/interface contact kinematics'),
    pressureInterfaceSpatialIndexStatus,
    pressureInterfaceSpatialIndexMode: sourceSpanReady
      ? 'source-particle-candidate-span-table'
      : (broadCandidateScanFallback ? 'full-candidate-scan-explicit-fallback' : null),
    broadCandidateScanFallback,
    candidateBudget: Math.max(0, Math.round(finiteNumber(schroederLawNeighborCandidates.candidateBudget, 0))),
    lawQueueCount: Math.max(0, Math.round(finiteNumber(schroederLawNeighborCandidates.lawQueueCount, 0))),
    enabledLawMask,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId
  };
}

function resolveParticleKinematicsSource({
  device,
  sphParticleState = null,
  sphParticleUpload = null,
  particleStateBuffer = null,
  particleThermoBuffer = null,
  particleIdentityBuffer = null,
  particleCount = null
} = {}) {
  const stateBuffer = particleStateBuffer
    || sphParticleUpload?.stateBuffer
    || sphParticleState?.stateBuffer
    || null;
  const thermoBuffer = particleThermoBuffer
    || sphParticleUpload?.thermoBuffer
    || sphParticleState?.thermoBuffer
    || null;
  const identityBuffer = particleIdentityBuffer
    || sphParticleUpload?.identityBuffer
    || sphParticleState?.identityBuffer
    || null;
  const identityRequired = sphParticleUpload?.identityRequired === true
    || sphParticleState?.identityRequired === true;
  const storageGeneration = spatialU32(
    sphParticleUpload?.storageGeneration
      ?? sphParticleUpload?.bufferFamilyGeneration
      ?? sphParticleState?.storageGeneration,
    Number.NaN
  );
  const positionEpoch = spatialU32(
    sphParticleUpload?.positionEpoch ?? sphParticleState?.positionEpoch,
    Number.NaN
  );
  const topologyEpoch = spatialU32(
    sphParticleUpload?.topologyEpoch ?? sphParticleState?.topologyEpoch,
    Number.NaN
  );
  const chartEpoch = spatialU32(
    sphParticleUpload?.chartEpoch ?? sphParticleState?.chartEpoch,
    Number.NaN
  );
  const levelEpoch = spatialU32(
    sphParticleUpload?.levelEpoch ?? sphParticleState?.levelEpoch,
    Number.NaN
  );
  const supportEpoch = spatialU32(
    sphParticleUpload?.supportEpoch ?? sphParticleState?.supportEpoch,
    Number.NaN
  );
  const physicsTick = spatialU32(
    sphParticleUpload?.physicsTick
      ?? sphParticleState?.physicsTick
      ?? positionEpoch,
    Number.NaN
  );
  const physicsSubstep = spatialU32(
    sphParticleUpload?.physicsSubstep ?? sphParticleState?.physicsSubstep ?? 0,
    Number.NaN
  );
  const resolvedParticleCount = spatialU32(
    particleCount
      ?? sphParticleUpload?.particleCount
      ?? sphParticleState?.particleCount,
    0
  );
  const identitySchema = sphParticleUpload?.identitySchema
    || sphParticleState?.identitySchema
    || null;
  const identityStrideValue = sphParticleUpload?.identityStrideBytes
    ?? sphParticleState?.identityStrideBytes;
  const declaredIdentityBufferByteLengthValue =
    sphParticleUpload?.identityBufferByteLength
      ?? sphParticleState?.identityBufferByteLength;
  const actualIdentityBufferByteLengthValue = identityBuffer?.byteLength
    ?? identityBuffer?.size;
  const identityStrideBytes = spatialU32(identityStrideValue, 0);
  const declaredIdentityBufferByteLength = spatialSize(
    declaredIdentityBufferByteLengthValue,
    0
  );
  const actualIdentityBufferByteLength = spatialSize(
    actualIdentityBufferByteLengthValue,
    0
  );
  const identityBufferByteLength = declaredIdentityBufferByteLengthValue != null
    ? declaredIdentityBufferByteLength
    : actualIdentityBufferByteLength;
  const identityNumericMetadataReady = Boolean(
    (identityStrideValue == null || identityStrideBytes === identityStrideValue)
    && (
      declaredIdentityBufferByteLengthValue == null
      || declaredIdentityBufferByteLength === declaredIdentityBufferByteLengthValue
    )
    && (
      actualIdentityBufferByteLengthValue == null
      || actualIdentityBufferByteLength === actualIdentityBufferByteLengthValue
    )
  );
  const identityMetadataObserved = identitySchema != null
    || identityStrideValue != null
    || declaredIdentityBufferByteLengthValue != null;
  const identityContractReady = Boolean(
    identityBuffer
    && identityNumericMetadataReady
    && (
      (
        !identityRequired
        && !identityMetadataObserved
        && identityBufferByteLength >= resolvedParticleCount * Uint32Array.BYTES_PER_ELEMENT
      )
      || (
        identitySchema === ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
        && identityStrideBytes === Uint32Array.BYTES_PER_ELEMENT
        && identityBufferByteLength >= resolvedParticleCount * Uint32Array.BYTES_PER_ELEMENT
        && (
          actualIdentityBufferByteLengthValue == null
          || actualIdentityBufferByteLength >= identityBufferByteLength
        )
      )
    )
  );
  if (!stateBuffer || !thermoBuffer || resolvedParticleCount <= 0) {
    return {
      status: 'interface-contact-kinematics-particle-source-unavailable',
      ready: false,
      stateBuffer: null,
      thermoBuffer: null,
      identityBuffer: null,
      identityReady: false,
      identityRequired,
      identitySchema,
      identityStrideBytes,
      identityBufferByteLength,
      storageGeneration,
      physicsTick,
      physicsSubstep,
      positionEpoch,
      topologyEpoch,
      chartEpoch,
      levelEpoch,
      supportEpoch,
      particleCount: resolvedParticleCount,
      sourceDeviceId: null,
      consumerDeviceId: device ? webGpuDeviceMismatchInfo({ device }).consumerDeviceId : null,
      reason: !stateBuffer || !thermoBuffer
        ? 'particle state/thermo WebGPU buffers unavailable'
        : 'particle count unavailable'
    };
  }
  const stateMismatch = webGpuDeviceMismatchInfo({ buffer: stateBuffer, device });
  const thermoMismatch = webGpuDeviceMismatchInfo({ buffer: thermoBuffer, device });
  const identityMismatch = identityBuffer
    ? webGpuDeviceMismatchInfo({ buffer: identityBuffer, device })
    : { mismatch: false, sourceDeviceId: null, consumerDeviceId: stateMismatch.consumerDeviceId };
  if (
    stateMismatch.mismatch
    || thermoMismatch.mismatch
    || (identityRequired && (!identityContractReady || identityMismatch.mismatch))
  ) {
    return {
      status: identityRequired && !identityContractReady
        ? 'blocked-interface-contact-kinematics-required-identity-unavailable'
        : 'blocked-cross-device-interface-contact-kinematics-particle-source',
      ready: false,
      stateBuffer: null,
      thermoBuffer: null,
      identityBuffer: null,
      identityReady: false,
      identityRequired,
      identitySchema,
      identityStrideBytes,
      identityBufferByteLength,
      storageGeneration,
      physicsTick,
      physicsSubstep,
      positionEpoch,
      topologyEpoch,
      chartEpoch,
      levelEpoch,
      supportEpoch,
      particleCount: resolvedParticleCount,
      sourceDeviceId:
        stateMismatch.sourceDeviceId
        || thermoMismatch.sourceDeviceId
        || identityMismatch.sourceDeviceId,
      consumerDeviceId:
        stateMismatch.consumerDeviceId
        || thermoMismatch.consumerDeviceId
        || identityMismatch.consumerDeviceId,
      reason: identityRequired && !identityContractReady
        ? 'required particle identity WebGPU buffer contract unavailable or invalid'
        : 'particle state/thermo/identity buffer created on different WebGPU device'
    };
  }
  const identityReady = Boolean(identityContractReady && !identityMismatch.mismatch);
  return {
    status: 'interface-contact-kinematics-particle-source-ready',
    ready: true,
    stateBuffer,
    thermoBuffer,
    identityBuffer: identityReady ? identityBuffer : null,
    identityReady,
    identityRequired,
    identitySchema,
    identityStrideBytes,
    identityBufferByteLength,
    storageGeneration,
    physicsTick,
    physicsSubstep,
    positionEpoch,
    topologyEpoch,
    chartEpoch,
    levelEpoch,
    supportEpoch,
    particleCount: resolvedParticleCount,
    sourceDeviceId:
      stateMismatch.sourceDeviceId
      || thermoMismatch.sourceDeviceId
      || identityMismatch.sourceDeviceId,
    consumerDeviceId:
      stateMismatch.consumerDeviceId
      || thermoMismatch.consumerDeviceId
      || identityMismatch.consumerDeviceId,
    reason: null
  };
}

function resolvePressureInterfaceSourceKeys(interfaceSourceKeys = null, {
  device,
  elementCount = 0
} = {}) {
  const base = {
    schema: interfaceSourceKeys?.schema ?? null,
    sourceStatus: interfaceSourceKeys?.status ?? null,
    status: 'interface-source-key-unavailable',
    consumerStatus: 'interface-source-key-not-provided',
    reason: interfaceSourceKeys
      ? null
      : 'No explicit interface source-key rows were provided',
    sourceKeyBuffer: null,
    sourceKeyBufferObserved: false,
    sourceKeyBufferConsumed: false,
    rowCount: 0,
    readyCount: 0,
    rowStrideFloats: SPH_INTERFACE_SOURCE_KEY_FLOATS,
    surfaceIndexFallbackEnabled: true,
    sourceDeviceId: null,
    consumerDeviceId: device ? webGpuDeviceMismatchInfo({ device }).consumerDeviceId : null,
    cleanupBuffers: []
  };
  if (!interfaceSourceKeys) return base;
  const rowCount = Math.max(0, Math.round(finiteNumber(
    interfaceSourceKeys.rowCount
      ?? interfaceSourceKeys.sourceKeyRowCount
      ?? elementCount,
    0
  )));
  const readyCount = Math.max(0, Math.round(finiteNumber(interfaceSourceKeys.readyCount, rowCount)));
  const rowStrideFloats = Math.max(SPH_INTERFACE_SOURCE_KEY_FLOATS, Math.round(finiteNumber(
    interfaceSourceKeys.rowStrideFloats
      ?? interfaceSourceKeys.sourceKeyStrideFloats,
    SPH_INTERFACE_SOURCE_KEY_FLOATS
  )));
  const sourceKeyBuffer = interfaceSourceKeys.sourceKeyBuffer
    || interfaceSourceKeys.interfaceSourceKeyBuffer
    || interfaceSourceKeys.buffer
    || null;
  const sourceRows = interfaceSourceKeys.rows instanceof Float32Array
    ? interfaceSourceKeys.rows
    : (interfaceSourceKeys.sourceKeyRows instanceof Float32Array
        ? interfaceSourceKeys.sourceKeyRows
        : null);
  let resolvedBuffer = sourceKeyBuffer;
  let borrowed = Boolean(sourceKeyBuffer);
  if (!resolvedBuffer && sourceRows?.byteLength > 0 && readyCount > 0) {
    resolvedBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-source-key-rows', sourceRows);
    borrowed = false;
  }
  if (!resolvedBuffer || rowCount <= 0 || readyCount <= 0) {
    return {
      ...base,
      status: 'interface-source-key-unavailable',
      consumerStatus: 'interface-source-key-empty-or-unresolved',
      reason: 'Explicit interface source-key rows are absent or have no ready rows',
      rowCount,
      readyCount,
      rowStrideFloats,
      surfaceIndexFallbackEnabled: interfaceSourceKeys.surfaceIndexFallbackEnabled !== false
    };
  }
  const mismatch = webGpuDeviceMismatchInfo({ buffer: resolvedBuffer, device });
  if (mismatch.mismatch) {
    if (!borrowed) resolvedBuffer.destroy?.();
    return {
      ...base,
      status: 'interface-source-key-rejected',
      consumerStatus: 'blocked-cross-device-interface-source-key-buffer',
      reason: 'Interface source-key buffer was created on a different WebGPU device',
      sourceKeyBuffer: resolvedBuffer,
      sourceKeyBufferObserved: true,
      rowCount,
      readyCount,
      rowStrideFloats,
      surfaceIndexFallbackEnabled: interfaceSourceKeys.surfaceIndexFallbackEnabled !== false,
      sourceDeviceId: mismatch.sourceDeviceId,
      consumerDeviceId: mismatch.consumerDeviceId
    };
  }
  return {
    ...base,
    status: 'interface-source-key-ready',
    consumerStatus: borrowed
      ? 'retained-interface-source-key-buffer-consumed'
      : 'packed-interface-source-key-buffer-consumed',
    reason: null,
    sourceKeyBuffer: resolvedBuffer,
    sourceKeyBufferObserved: true,
    sourceKeyBufferConsumed: true,
    rowCount,
    readyCount,
    rowStrideFloats,
    surfaceIndexFallbackEnabled: interfaceSourceKeys.surfaceIndexFallbackEnabled !== false,
    sourceDeviceId: mismatch.sourceDeviceId,
    consumerDeviceId: mismatch.consumerDeviceId,
    cleanupBuffers: borrowed ? [] : [resolvedBuffer]
  };
}

export function createPressureInterfaceContactKinematicsParamsArray({
  elementCount = 0,
  particleCount = 0,
  contactPolicyRowCount = 0,
  derivationEnabled = false,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  gapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M,
  particleBinGrid = null
} = {}) {
  const gridEnabled = particleBinGrid?.enabled === true;
  const gridDims = Array.isArray(particleBinGrid?.gridDims)
    ? particleBinGrid.gridDims
    : [0, 0, 0];
  const origin = Array.isArray(particleBinGrid?.originM)
    ? particleBinGrid.originM
    : [0, 0, 0];
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(elementCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(contactPolicyRowCount, 0))), true);
  view.setUint32(12, derivationEnabled ? 1 : 0, true);
  view.setUint32(16, gridEnabled ? 1 : 0, true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(particleBinGrid?.cellCount, 0))), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(particleBinGrid?.binCapacity, 0))), true);
  view.setUint32(28, Math.max(0, Math.round(finiteNumber(gridDims[0], 0))), true);
  view.setUint32(32, Math.max(0, Math.round(finiteNumber(gridDims[1], 0))), true);
  view.setUint32(36, Math.max(0, Math.round(finiteNumber(gridDims[2], 0))), true);
  view.setFloat32(40, clampPositive(maxSearchRadiusM, DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M), true);
  view.setFloat32(44, clampPositive(gapFloorM, DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M), true);
  view.setFloat32(48, finiteNumber(origin[0], 0), true);
  view.setFloat32(52, finiteNumber(origin[1], 0), true);
  view.setFloat32(56, finiteNumber(origin[2], 0), true);
  view.setFloat32(60, clampPositive(particleBinGrid?.cellSizeM, 0), true);
  return buffer;
}

export function createPressureInterfaceParticleBinParamsArray({
  particleCount = 0,
  particleBinGrid = null
} = {}) {
  const gridEnabled = particleBinGrid?.enabled === true;
  const gridDims = Array.isArray(particleBinGrid?.gridDims)
    ? particleBinGrid.gridDims
    : [0, 0, 0];
  const origin = Array.isArray(particleBinGrid?.originM)
    ? particleBinGrid.originM
    : [0, 0, 0];
  const boxDims = Array.isArray(particleBinGrid?.boxDimsM)
    ? particleBinGrid.boxDimsM
    : [0, 0, 0];
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(particleCount, 0))), true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(particleBinGrid?.cellCount, 0))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(particleBinGrid?.binCapacity, 0))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(gridDims[0], 0))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(gridDims[1], 0))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(gridDims[2], 0))), true);
  view.setUint32(24, gridEnabled ? 1 : 0, true);
  view.setUint32(28, 0, true);
  view.setFloat32(32, finiteNumber(origin[0], 0), true);
  view.setFloat32(36, finiteNumber(origin[1], 0), true);
  view.setFloat32(40, finiteNumber(origin[2], 0), true);
  view.setFloat32(44, clampPositive(particleBinGrid?.cellSizeM, 0), true);
  view.setFloat32(48, clampPositive(particleBinGrid?.cellSizeM, 0) > 0 ? 1 / particleBinGrid.cellSizeM : 0, true);
  view.setFloat32(52, clampPositive(boxDims[0], 0), true);
  view.setFloat32(56, clampPositive(boxDims[1], 0), true);
  view.setFloat32(60, clampPositive(boxDims[2], 0), true);
  return buffer;
}

function maxContactPolicySupportRadiusM(packedContactPolicy = null) {
  const rows = packedContactPolicy?.rows;
  const rowCount = Math.max(0, Math.round(finiteNumber(packedContactPolicy?.rowCount, 0)));
  let maxSupportRadiusM = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    maxSupportRadiusM = Math.max(
      maxSupportRadiusM,
      clampPositive(rows?.[rowIndex * SPH_ALGORITHM_CONTACT_POLICY_FLOATS + 6], 0)
    );
  }
  return maxSupportRadiusM;
}

export function resolvePressureInterfaceParticleBinGrid({
  boxDimsM = null,
  packedContactPolicy = null,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  binCapacity = DEFAULT_CONTACT_PARTICLE_BIN_CAPACITY,
  particleCount = 0,
  maxIndexBufferBytes = CONTACT_PARTICLE_BIN_INDEX_BUFFER_BUDGET_BYTES
} = {}) {
  const dims = vector3From(boxDimsM, [0, 0, 0]).map((value) => clampPositive(value, 0));
  if (dims.some((value) => value <= 0)) {
    return {
      status: 'interface-contact-particle-bin-grid-unavailable',
      reason: 'box dimensions unavailable',
      enabled: false,
      gridDims: [0, 0, 0],
      boxDimsM: dims,
      originM: [0, 0, 0],
      cellSizeM: 0,
      cellCount: 0,
      binCapacity: 0,
      averageOccupancy: 0,
      estimatedOverflowRisk: false,
      indexBufferByteLength: 0
    };
  }
  const requestedCapacity = Math.max(1, Math.round(finiteNumber(binCapacity, DEFAULT_CONTACT_PARTICLE_BIN_CAPACITY)));
  const maxDimM = Math.max(...dims);
  const supportRadiusM = maxContactPolicySupportRadiusM(packedContactPolicy);
  const requestedSearchRadiusM = Math.max(
    clampPositive(maxSearchRadiusM, 0),
    supportRadiusM * 2,
    maxDimM / CONTACT_PARTICLE_BIN_GRID_MAX_AXIS_CELLS,
    1e-6
  );
  const gridDims = dims.map((dim) => Math.max(
    1,
    Math.min(CONTACT_PARTICLE_BIN_GRID_MAX_AXIS_CELLS, Math.ceil(dim / requestedSearchRadiusM))
  ));
  const cellCount = gridDims[0] * gridDims[1] * gridDims[2];
  const normalizedParticleCount = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  const averageOccupancy = cellCount > 0 ? normalizedParticleCount / cellCount : 0;
  const adaptiveCapacity = Math.max(
    requestedCapacity,
    Math.ceil(averageOccupancy * CONTACT_PARTICLE_BIN_CAPACITY_OCCUPANCY_MULTIPLIER)
  );
  const budgetBytes = Math.max(4, Math.round(finiteNumber(maxIndexBufferBytes, CONTACT_PARTICLE_BIN_INDEX_BUFFER_BUDGET_BYTES)));
  const maxCapacityByBudget = cellCount > 0
    ? Math.max(1, Math.floor(budgetBytes / (cellCount * Uint32Array.BYTES_PER_ELEMENT)))
    : 0;
  const capacity = Math.max(1, Math.min(adaptiveCapacity, maxCapacityByBudget));
  const estimatedOverflowRisk = normalizedParticleCount > 0 && averageOccupancy > capacity / CONTACT_PARTICLE_BIN_CAPACITY_OCCUPANCY_MULTIPLIER;
  const indexBufferByteLength = cellCount * capacity * Uint32Array.BYTES_PER_ELEMENT;
  if (cellCount <= 0 || cellCount > CONTACT_PARTICLE_BIN_GRID_MAX_CELL_COUNT) {
    return {
      status: 'interface-contact-particle-bin-grid-unavailable',
      reason: 'derived bin grid exceeds bounded cell budget',
      enabled: false,
      gridDims,
      boxDimsM: dims,
      originM: [0, 0, 0],
      cellSizeM: requestedSearchRadiusM,
      cellCount,
      binCapacity: capacity,
      requestedBinCapacity: requestedCapacity,
      adaptiveBinCapacity: adaptiveCapacity,
      maxBinCapacityByBudget: maxCapacityByBudget,
      averageOccupancy,
      estimatedOverflowRisk,
      indexBufferByteLength
    };
  }
  return {
    status: 'interface-contact-particle-bin-grid-ready',
    reason: adaptiveCapacity > maxCapacityByBudget
      ? 'adaptive bin capacity capped by index-buffer budget'
      : null,
    enabled: true,
    gridDims,
    boxDimsM: dims,
    originM: [0, 0, 0],
    cellSizeM: requestedSearchRadiusM,
    cellCount,
    binCapacity: capacity,
    requestedBinCapacity: requestedCapacity,
    adaptiveBinCapacity: adaptiveCapacity,
    maxBinCapacityByBudget: maxCapacityByBudget,
    averageOccupancy,
    estimatedOverflowRisk,
    indexBufferByteLength,
    maxSupportRadiusM: supportRadiusM,
    maxSearchRadiusM: Math.max(clampPositive(maxSearchRadiusM, 0), supportRadiusM * 2)
  };
}

export function canDeriveInterfaceContactKinematicsOnGpu({
  packedInterfaceElements = null,
  packedContactPolicy = null,
  packedContactKinematics = null,
  particleSource = null,
  canonicalGenerationRequired = false
} = {}) {
  const missingRows = canonicalGenerationRequired === true
    || (packedContactKinematics?.readyCount ?? 0) < (packedInterfaceElements?.rowCount ?? 0);
  return Boolean(
    missingRows
    && (packedInterfaceElements?.rowCount ?? 0) > 0
    && (packedContactPolicy?.rowCount ?? 0) > 0
    && particleSource?.ready === true
    && (
      (packedContactPolicy?.domainPairRowCount ?? 0) === 0
      || particleSource?.identityReady === true
    )
  );
}

function createDisabledContactParticleBinBuffers(device, particleBinGrid = null) {
  const countsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-pressure-interface-particle-bin-counts-disabled',
    new Uint32Array(1)
  );
  const indicesBuffer = writeStorageBuffer(
    device,
    'ulg-sph-pressure-interface-particle-bin-indices-disabled',
    new Uint32Array([0xffffffff])
  );
  return {
    schema: 'peercompute.ulg.sph-pressure-interface-particle-bin-grid.v0',
    status: particleBinGrid?.status || 'interface-contact-particle-bin-grid-disabled',
    reason: particleBinGrid?.reason || 'particle bin grid disabled',
    enabled: false,
    particleBinGrid: particleBinGrid || null,
    countsBuffer,
    indicesBuffer,
    cleanupBuffers: [countsBuffer, indicesBuffer]
  };
}

export function runSphPressureInterfaceParticleBinsWebGpu({
  device,
  particleSource,
  particleBinGrid,
  readbackMetadata = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceParticleBinsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (particleSource?.ready !== true || particleBinGrid?.enabled !== true) {
    return createDisabledContactParticleBinBuffers(device, particleBinGrid);
  }
  const cellCount = Math.max(0, Math.round(finiteNumber(particleBinGrid.cellCount, 0)));
  const binCapacity = Math.max(1, Math.round(finiteNumber(particleBinGrid.binCapacity, DEFAULT_CONTACT_PARTICLE_BIN_CAPACITY)));
  if (cellCount <= 0) {
    return createDisabledContactParticleBinBuffers(device, {
      ...particleBinGrid,
      status: 'interface-contact-particle-bin-grid-unavailable',
      reason: 'particle bin grid has no cells',
      enabled: false
    });
  }
  const counts = new Uint32Array(cellCount);
  const indices = new Uint32Array(cellCount * binCapacity);
  indices.fill(0xffffffff);
  const countsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-pressure-interface-particle-bin-counts',
    counts
  );
  const indicesBuffer = writeStorageBuffer(
    device,
    'ulg-sph-pressure-interface-particle-bin-indices',
    indices
  );
  const metadataBuffer = writeStorageBuffer(
    device,
    'ulg-sph-pressure-interface-particle-bin-metadata',
    new Uint32Array(4)
  );
  const paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-particle-bin-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  device.queue.writeBuffer(paramsBuffer, 0, createPressureInterfaceParticleBinParamsArray({
    particleCount: particleSource.particleCount,
    particleBinGrid
  }));
  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-pressure-interface-particle-bins.v0',
    label: 'ulg-sph-pressure-interface-particle-bins',
    code: sphPressureInterfaceParticleBinsWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: particleSource.stateBuffer } },
      { binding: 1, resource: { buffer: countsBuffer } },
      { binding: 2, resource: { buffer: indicesBuffer } },
      { binding: 3, resource: { buffer: metadataBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } }
    ]
  });
  const metadataReadbackBuffer = readbackMetadata === true
    ? tagWebGpuBufferDevice(device.createBuffer({
        label: 'ulg-sph-pressure-interface-particle-bin-metadata-readback',
        size: 16,
        usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
      }), device)
    : null;
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(particleSource.particleCount / 64)));
  pass.end();
  if (metadataReadbackBuffer) {
    encoder.copyBufferToBuffer(metadataBuffer, 0, metadataReadbackBuffer, 0, 16);
  }
  device.queue.submit([encoder.finish()]);
  return {
    schema: 'peercompute.ulg.sph-pressure-interface-particle-bin-grid.v0',
    status: 'interface-contact-particle-bin-grid-submitted',
    reason: null,
    enabled: true,
    particleBinGrid,
    countsBuffer,
    indicesBuffer,
    metadataBuffer,
    metadataReadbackBuffer,
    paramsBuffer,
    cellCount,
    binCapacity,
    averageOccupancy: particleBinGrid.averageOccupancy || 0,
    estimatedOverflowRisk: particleBinGrid.estimatedOverflowRisk === true,
    indexBufferByteLength: indices.byteLength,
    overflowMetadataStatus: metadataReadbackBuffer
      ? 'particle-bin-overflow-readback-requested'
      : 'particle-bin-overflow-metadata-unread',
    overflowMetadataReadbackRequested: metadataReadbackBuffer != null,
    queueCompletionStatus: 'queue-submitted',
    queueCompletionMethod: 'queue.submit',
    cleanupBuffers: [countsBuffer, indicesBuffer, metadataBuffer, paramsBuffer, metadataReadbackBuffer].filter(Boolean)
  };
}

export function runSphPressureInterfaceSpatialExactNearContactKinematicsWebGpu({
  device,
  packedInterfaceElements,
  packedContactPolicy,
  interfaceElementsBuffer,
  contactPolicyBuffer,
  particleSource,
  spatialBuild,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  gapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError(
      'runSphPressureInterfaceSpatialExactNearContactKinematicsWebGpu requires a WebGPU-like device'
    );
  }
  if (
    !packedInterfaceElements?.rows
    || !packedContactPolicy?.rows
    || !interfaceElementsBuffer
    || !contactPolicyBuffer
    || particleSource?.ready !== true
    || spatialBuild?.selected !== true
    || spatialBuild.ready !== true
    || spatialBuild.borrowed !== true
    || spatialBuild.ownsGeneration !== false
    || spatialBuild.directoryOwnership !== 'borrowed-caller-owned-canonical-generation'
    || spatialBuild.directoryBuildCount !== 0
    || spatialBuild.sharedGenerationDirectoryBuildCount !== 1
    || spatialBuild.generation?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA
    || spatialBuild.generation?.status !== 'schroeder-spatial-epoch-generation-submitted'
    || spatialBuild.generation?.ready !== true
    || spatialBuild.generation?.selected !== true
    || spatialBuild.generation?.releaseScheduled === true
    || spatialBuild.generation?.execution !== spatialBuild.execution
    || spatialBuild.execution?.schema !== ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA
    || spatialBuild.execution?.status !== 'schroeder-spatial-epoch-gpu-build-submitted'
    || spatialBuild.execution?.submitPerformed !== true
    || spatialBuild.execution?.released === true
    || spatialBuild.execution?.sourceAdapterId
      !== SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY
    || spatialBuild.execution?.exactNearQueryProfile?.ready !== true
    || spatialBuild.execution?.queryGeometryEvidence
      !== spatialBuild.execution?.exactNearQueryProfile
    || !spatialBuild.execution?.directoryBuffer
  ) {
    throw new TypeError(
      'canonical pressure/contact kinematics requires packed rows, resident particles, and a live caller-owned borrowed spatial generation'
    );
  }
  if ((packedContactPolicy.domainPairRowCount ?? 0) > 0 && particleSource.identityReady !== true) {
    throw new TypeError(
      'canonical pressure/contact kinematics requires resident identity for domain-specific contact rows'
    );
  }
  const outputByteLength = Math.max(
    4,
    packedInterfaceElements.rowCount
      * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  );
  const outputBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-spatial-exact-near-kinematics-derived',
    size: outputByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-spatial-exact-near-params',
    size: 128,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const localParticleIdentityBuffer = particleSource.identityBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-spatial-exact-near-identity-disabled',
      new Uint32Array(Math.max(1, particleSource.particleCount))
    );
  const particleIdentityBuffer = particleSource.identityBuffer || localParticleIdentityBuffer;
  device.queue.writeBuffer(paramsBuffer, 0, createPressureInterfaceSpatialExactNearParamsArray({
    elementCount: packedInterfaceElements.rowCount,
    particleCount: particleSource.particleCount,
    contactPolicyRowCount: packedContactPolicy.rowCount,
    derivationEnabled: true,
    maxSearchRadiusM,
    gapFloorM,
    spatialBuild
  }));
  const { pipeline, bindGroupLayout, cacheStatus } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-pressure-interface-spatial-exact-near-contact-kinematics.v4',
    label: 'ulg-sph-pressure-interface-spatial-exact-near-contact-kinematics',
    code: sphPressureInterfaceSpatialExactNearContactKinematicsWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'read-only-storage')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: interfaceElementsBuffer } },
      { binding: 1, resource: { buffer: particleSource.stateBuffer } },
      { binding: 2, resource: { buffer: particleSource.thermoBuffer } },
      { binding: 3, resource: { buffer: contactPolicyBuffer } },
      { binding: 4, resource: { buffer: outputBuffer } },
      { binding: 5, resource: { buffer: paramsBuffer } },
      { binding: 6, resource: { buffer: spatialBuild.execution.directoryBuffer } },
      { binding: 7, resource: { buffer: particleIdentityBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder({
    label: 'ulg-sph-pressure-interface-spatial-exact-near-contact-kinematics'
  });
  const pass = encoder.beginComputePass({
    label: 'ulg-sph-pressure-interface-spatial-exact-near-contact-kinematics'
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(packedInterfaceElements.rowCount / 64)));
  pass.end();
  device.queue.submit([encoder.finish()]);
  return {
    schema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    spatialViewSchema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
    status: 'interface-contact-kinematics-spatial-exact-near-submitted',
    buffer: outputBuffer,
    bufferByteLength: outputByteLength,
    rowCount: packedInterfaceElements.rowCount,
    rowStrideFloats: SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
    particleCount: particleSource.particleCount,
    contactPolicyRowCount: packedContactPolicy.rowCount,
    particleIdentityReady: particleSource.identityReady === true,
    particleIdentityRequired: particleSource.identityRequired === true,
    particleIdentityBufferConsumed: particleSource.identityReady === true,
    particleBinGridStatus: 'suppressed-canonical-spatial-exact-near-selected',
    particleBinGridEnabled: false,
    particleBinGridCellCount: 0,
    particleBinGridBinCapacity: 0,
    particleBinGridAverageOccupancy: 0,
    particleBinGridEstimatedOverflowRisk: false,
    particleBinGridIndexBufferByteLength: 0,
    spatialExactNearStatus: spatialBuild.status,
    spatialExactNearSourceStatus: spatialBuild.source.status,
    spatialExactNearDirectoryOwnership: spatialBuild.directoryOwnership ?? null,
    spatialExactNearBorrowedGeneration: true,
    spatialExactNearConsumerReleaseAuthority: 'generation-owner',
    spatialExactNearGenerationId: spatialBuild.execution.generationId,
    spatialExactNearArenaIndex: spatialBuild.execution.arenaIndex,
    spatialExactNearRuntimeCapacity: spatialBuild.runtimeCapacity,
    spatialExactNearRuntimeCacheHit: spatialBuild.runtimeCacheHit === true,
    spatialExactNearDirectoryBuildCount: spatialBuild.directoryBuildCount,
    spatialExactNearSharedGenerationDirectoryBuildCount:
      spatialBuild.sharedGenerationDirectoryBuildCount ?? 0,
    spatialExactNearDirectoryLookupMode:
      'exact-cell-key-binary-search-sparse-prefix-csr-range',
    spatialExactNearCandidateBudget: null,
    spatialExactNearPrivateParticleBinBuildSuppressed: true,
    spatialExactNearPrivateParticleBinBuildCount: 0,
    spatialExactNearFixedCandidateBuildCount: 0,
    spatialExactNearExhaustiveParticleScanCount: 0,
    spatialExactNearGpuHeaderAdmission: 'required-fail-closed-zero-contact-rows',
    spatialExactNearGpuQueryEvidenceRequired: true,
    spatialExactNearGpuQueryEvidenceSourceAdapterId:
      SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    spatialExactNearGpuQueryEvidenceEnforcementStatus:
      'shader-validates-query-tail-at-dispatch-no-host-readback',
    spatialExactNearGpuAdmissionObserved: false,
    spatialExactNearGpuAdmissionStatus:
      'shader-validates-at-dispatch-no-host-readback',
    spatialExactNearGpuFallbackObserved: null,
    pressureInterfaceSpatialIndexStatus: 'pressure-interface-canonical-spatial-epoch-selected',
    pressureInterfaceSpatialIndexMode: 'ss-spatial-epoch-v1-exact-near-csr',
    queueCompletionStatus: 'queue-submitted',
    queueCompletionMethod: 'queue.submit',
    pipelineCacheStatus: cacheStatus,
    derivation: 'schroeder-spatial-epoch-exact-near-gpu-interface-contact-kinematics',
    source: particleSource.identityReady
      ? 'resident-sph-particle-state-thermo-identity-and-canonical-spatial-directory'
      : 'resident-sph-particle-state-thermo-and-canonical-spatial-directory-with-zero-identity',
    cleanupBuffers: [paramsBuffer, localParticleIdentityBuffer].filter(Boolean),
    destroyContactKinematicsBuffer() {
      outputBuffer.destroy?.();
    }
  };
}

function createFailClosedBorrowedSpatialContactKinematicsWebGpu({
  device,
  packedInterfaceElements,
  particleSource,
  spatialAdmission
} = {}) {
  const rowCount = Math.max(0, Math.trunc(finiteNumber(
    packedInterfaceElements?.rowCount,
    0
  )));
  const rows = new Float32Array(
    rowCount * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS
  );
  const buffer = writeStorageBuffer(
    device,
    'ulg-sph-pressure-interface-spatial-exact-near-fail-closed-zero-rows',
    rows
  );
  return {
    schema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    spatialViewSchema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
    status: 'interface-contact-kinematics-spatial-exact-near-fail-closed',
    reason: spatialAdmission?.reason || 'Caller-owned spatial generation was rejected',
    buffer,
    bufferByteLength: Math.max(16, rows.byteLength),
    rowCount,
    rowStrideFloats: SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
    particleCount: particleSource?.particleCount ?? 0,
    particleIdentityReady: particleSource?.identityReady === true,
    particleIdentityRequired: particleSource?.identityRequired === true,
    particleIdentityBufferConsumed: false,
    particleBinGridStatus: 'suppressed-borrowed-spatial-generation-fail-closed',
    particleBinGridEnabled: false,
    particleBinGridCellCount: 0,
    particleBinGridBinCapacity: 0,
    particleBinGridAverageOccupancy: 0,
    particleBinGridEstimatedOverflowRisk: false,
    particleBinGridIndexBufferByteLength: 0,
    spatialExactNearStatus: spatialAdmission?.status ?? null,
    spatialExactNearDirectoryOwnership:
      spatialAdmission?.directoryOwnership ?? null,
    spatialExactNearDirectoryBuildCount: 0,
    spatialExactNearSharedGenerationDirectoryBuildCount:
      spatialAdmission?.sharedGenerationDirectoryBuildCount ?? 0,
    spatialExactNearDirectoryLookupMode: null,
    spatialExactNearCandidateBudget: null,
    spatialExactNearPrivateParticleBinBuildSuppressed: true,
    spatialExactNearPrivateParticleBinBuildCount: 0,
    spatialExactNearFixedCandidateBuildCount: 0,
    spatialExactNearExhaustiveParticleScanCount: 0,
    spatialExactNearGpuHeaderAdmission: 'not-dispatched-host-admission-failed',
    spatialExactNearGpuAdmissionObserved: false,
    spatialExactNearGpuAdmissionStatus: 'not-dispatched-host-admission-failed',
    spatialExactNearGpuFallbackObserved: null,
    pressureInterfaceSpatialIndexStatus:
      'pressure-interface-shared-spatial-generation-rejected-fail-closed',
    pressureInterfaceSpatialIndexMode: null,
    queueCompletionStatus: 'zero-contact-rows-uploaded',
    queueCompletionMethod: 'queue.writeBuffer',
    pipelineCacheStatus: null,
    derivation: 'fail-closed-zero-contact-kinematics',
    source: 'host-rejected-caller-owned-canonical-spatial-generation',
    cleanupBuffers: []
  };
}

export function runSphPressureInterfaceContactKinematicsWebGpu({
  device,
  packedInterfaceElements,
  packedContactPolicy,
  interfaceElementsBuffer,
  contactPolicyBuffer,
  particleSource,
  particleBinGrid = null,
  particleBins = null,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  gapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null,
  interfaceSourceKeys = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceContactKinematicsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (!packedInterfaceElements?.rows || !packedContactPolicy?.rows || !interfaceElementsBuffer || !contactPolicyBuffer || particleSource?.ready !== true) {
    throw new TypeError('runSphPressureInterfaceContactKinematicsWebGpu requires packed interface rows, contact rows, source buffers, and particle buffers');
  }
  if ((packedContactPolicy.domainPairRowCount ?? 0) > 0 && particleSource.identityReady !== true) {
    throw new TypeError(
      'runSphPressureInterfaceContactKinematicsWebGpu requires resident particle identity for domain-specific contact rows'
    );
  }
  const outputByteLength = Math.max(
    4,
    packedInterfaceElements.rowCount * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  const outputBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-contact-kinematics-derived',
    size: outputByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const paramsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-contact-kinematics-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  const resolvedParticleBins = particleBins || createDisabledContactParticleBinBuffers(device, particleBinGrid);
  const resolvedSchroederLawQueue = resolveSchroederPressureInterfaceLawQueue(schroederLawQueue, {
    device,
    particleCount: particleSource.particleCount
  });
  const consumedSchroederLawQueue = resolvedSchroederLawQueue.enabled
    ? {
        ...resolvedSchroederLawQueue,
        consumerStatus: 'schroeder-pressure-interface-law-queue-consumed',
        lawQueueBufferConsumed: true
      }
    : resolvedSchroederLawQueue;
  const borrowedSchroederLawQueueBuffer = consumedSchroederLawQueue.enabled
    ? consumedSchroederLawQueue.lawQueueBuffer
    : null;
  const localSchroederLawQueueBuffer = borrowedSchroederLawQueueBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-schroeder-law-queue-disabled',
      new Float32Array(SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS)
    );
  const schroederLawQueueBuffer = borrowedSchroederLawQueueBuffer || localSchroederLawQueueBuffer;
  const schroederLawQueueParamsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-schroeder-law-queue-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  device.queue.writeBuffer(
    schroederLawQueueParamsBuffer,
    0,
    createSchroederPressureInterfaceLawQueueParamsArray(consumedSchroederLawQueue)
  );
  const consumedSchroederLawNeighborCandidates = schroederLawNeighborCandidates?.neighborCandidateBufferConsumed
    ? schroederLawNeighborCandidates
    : (schroederLawNeighborCandidates || null);
  const borrowedSchroederLawNeighborCandidateBuffer = consumedSchroederLawNeighborCandidates?.neighborCandidateBufferConsumed
    ? consumedSchroederLawNeighborCandidates.neighborCandidateBuffer
    : null;
  const localSchroederLawNeighborCandidateBuffer = borrowedSchroederLawNeighborCandidateBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-disabled',
      new Float32Array(SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS)
    );
  const schroederLawNeighborCandidateBuffer = borrowedSchroederLawNeighborCandidateBuffer
    || localSchroederLawNeighborCandidateBuffer;
  const schroederLawNeighborCandidateParamsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  device.queue.writeBuffer(
    schroederLawNeighborCandidateParamsBuffer,
    0,
    createSchroederPressureInterfaceLawNeighborCandidateParamsArray(consumedSchroederLawNeighborCandidates)
  );
  const borrowedSchroederSourceSpanBuffer = consumedSchroederLawNeighborCandidates?.sourceCandidateSpanBufferConsumed
    ? consumedSchroederLawNeighborCandidates.sourceCandidateSpanBuffer
    : null;
  const localSchroederSourceSpanBuffer = borrowedSchroederSourceSpanBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-schroeder-source-spans-disabled',
      new Float32Array(4)
    );
  const schroederSourceSpanBuffer = borrowedSchroederSourceSpanBuffer || localSchroederSourceSpanBuffer;
  const schroederSourceSpanParamsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-schroeder-source-spans-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  device.queue.writeBuffer(
    schroederSourceSpanParamsBuffer,
    0,
    createSchroederPressureInterfaceSourceSpanParamsArray(consumedSchroederLawNeighborCandidates)
  );
  const resolvedInterfaceSourceKeys = resolvePressureInterfaceSourceKeys(interfaceSourceKeys, {
    device,
    elementCount: packedInterfaceElements.rowCount
  });
  const localInterfaceSourceKeyBuffer = resolvedInterfaceSourceKeys.sourceKeyBufferConsumed
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-source-key-disabled',
      new Float32Array(SPH_INTERFACE_SOURCE_KEY_FLOATS)
    );
  const interfaceSourceKeyBuffer = resolvedInterfaceSourceKeys.sourceKeyBuffer || localInterfaceSourceKeyBuffer;
  const localParticleIdentityBuffer = particleSource.identityBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-particle-identity-disabled',
      new Uint32Array(1)
    );
  const particleIdentityBuffer = particleSource.identityBuffer || localParticleIdentityBuffer;
  const interfaceSourceKeyParamsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-pressure-interface-source-key-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  }), device);
  device.queue.writeBuffer(
    interfaceSourceKeyParamsBuffer,
    0,
    createPressureInterfaceSourceKeyParamsArray(resolvedInterfaceSourceKeys)
  );
  device.queue.writeBuffer(paramsBuffer, 0, createPressureInterfaceContactKinematicsParamsArray({
    elementCount: packedInterfaceElements.rowCount,
    particleCount: particleSource.particleCount,
    contactPolicyRowCount: packedContactPolicy.rowCount,
    derivationEnabled: true,
    maxSearchRadiusM,
    gapFloorM,
    particleBinGrid: resolvedParticleBins.enabled ? resolvedParticleBins.particleBinGrid : null
  }));
  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-pressure-interface-contact-kinematics.v5',
    label: 'ulg-sph-pressure-interface-contact-kinematics',
    code: sphPressureInterfaceContactKinematicsWgsl,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'read-only-storage'),
      computeBufferBinding(3, 'read-only-storage'),
      computeBufferBinding(4, 'storage'),
      computeBufferBinding(5, 'uniform'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'read-only-storage'),
      computeBufferBinding(8, 'read-only-storage'),
      computeBufferBinding(9, 'uniform'),
      computeBufferBinding(10, 'read-only-storage'),
      computeBufferBinding(11, 'uniform'),
      computeBufferBinding(12, 'read-only-storage'),
      computeBufferBinding(13, 'uniform'),
      computeBufferBinding(14, 'read-only-storage'),
      computeBufferBinding(15, 'uniform'),
      computeBufferBinding(16, 'read-only-storage')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: interfaceElementsBuffer } },
      { binding: 1, resource: { buffer: particleSource.stateBuffer } },
      { binding: 2, resource: { buffer: particleSource.thermoBuffer } },
      { binding: 3, resource: { buffer: contactPolicyBuffer } },
      { binding: 4, resource: { buffer: outputBuffer } },
      { binding: 5, resource: { buffer: paramsBuffer } },
      { binding: 6, resource: { buffer: resolvedParticleBins.countsBuffer } },
      { binding: 7, resource: { buffer: resolvedParticleBins.indicesBuffer } },
      { binding: 8, resource: { buffer: schroederLawQueueBuffer } },
      { binding: 9, resource: { buffer: schroederLawQueueParamsBuffer } },
      { binding: 10, resource: { buffer: schroederLawNeighborCandidateBuffer } },
      { binding: 11, resource: { buffer: schroederLawNeighborCandidateParamsBuffer } },
      { binding: 12, resource: { buffer: schroederSourceSpanBuffer } },
      { binding: 13, resource: { buffer: schroederSourceSpanParamsBuffer } },
      { binding: 14, resource: { buffer: interfaceSourceKeyBuffer } },
      { binding: 15, resource: { buffer: interfaceSourceKeyParamsBuffer } },
      { binding: 16, resource: { buffer: particleIdentityBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, Math.ceil(packedInterfaceElements.rowCount / 64)));
  pass.end();
  device.queue.submit([encoder.finish()]);
  return {
    schema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    status: 'interface-contact-kinematics-gpu-derivation-submitted',
    buffer: outputBuffer,
    bufferByteLength: outputByteLength,
    rowCount: packedInterfaceElements.rowCount,
    rowStrideFloats: SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
    particleCount: particleSource.particleCount,
    contactPolicyRowCount: packedContactPolicy.rowCount,
    particleIdentityReady: particleSource.identityReady === true,
    particleIdentityRequired: particleSource.identityRequired === true,
    particleIdentityBufferConsumed: particleSource.identityReady === true,
    particleBinGridStatus: resolvedParticleBins.status,
    particleBinGridEnabled: resolvedParticleBins.enabled === true,
    particleBinGrid: resolvedParticleBins.particleBinGrid || null,
    particleBinGridCellCount: resolvedParticleBins.cellCount || resolvedParticleBins.particleBinGrid?.cellCount || 0,
    particleBinGridBinCapacity: resolvedParticleBins.binCapacity || resolvedParticleBins.particleBinGrid?.binCapacity || 0,
    particleBinGridAverageOccupancy: resolvedParticleBins.averageOccupancy || resolvedParticleBins.particleBinGrid?.averageOccupancy || 0,
    particleBinGridEstimatedOverflowRisk: resolvedParticleBins.estimatedOverflowRisk === true || resolvedParticleBins.particleBinGrid?.estimatedOverflowRisk === true,
    particleBinGridIndexBufferByteLength: resolvedParticleBins.indexBufferByteLength || resolvedParticleBins.particleBinGrid?.indexBufferByteLength || 0,
    schroederLawQueueSchema: consumedSchroederLawQueue.sourceSchema,
    schroederLawQueueSourceStatus: consumedSchroederLawQueue.sourceStatus,
    schroederLawQueueStatus: consumedSchroederLawQueue.status,
    schroederLawQueueConsumerStatus: consumedSchroederLawQueue.consumerStatus,
    schroederLawQueueReason: consumedSchroederLawQueue.reason,
    schroederLawQueueEnabled: consumedSchroederLawQueue.enabled === true,
    schroederLawQueueActiveNodeCount: consumedSchroederLawQueue.activeNodeCount,
    schroederLawQueueStrideFloats: consumedSchroederLawQueue.lawQueueStrideFloats,
    schroederLawQueueEnabledLawMask: consumedSchroederLawQueue.enabledLawMask,
    schroederLawQueueContactInterfaceMask: consumedSchroederLawQueue.contactInterfaceMask,
    schroederLawQueueBufferConsumed: consumedSchroederLawQueue.lawQueueBufferConsumed === true,
    schroederLawQueueSourceDeviceId: consumedSchroederLawQueue.sourceDeviceId,
    schroederLawQueueConsumerDeviceId: consumedSchroederLawQueue.consumerDeviceId,
    schroederLawNeighborCandidateSchema: consumedSchroederLawNeighborCandidates?.sourceSchema ?? null,
    schroederLawNeighborCandidateSourceStatus: consumedSchroederLawNeighborCandidates?.sourceStatus ?? null,
    schroederLawNeighborCandidateStatus: consumedSchroederLawNeighborCandidates?.status ?? null,
    schroederLawNeighborCandidateConsumerStatus: consumedSchroederLawNeighborCandidates?.consumerStatus ?? null,
    schroederLawNeighborCandidateReason: consumedSchroederLawNeighborCandidates?.reason ?? null,
    schroederLawNeighborCandidateAvailable: consumedSchroederLawNeighborCandidates?.available === true,
    schroederLawNeighborCandidateAuthoritative: consumedSchroederLawNeighborCandidates?.authoritative === true,
    schroederLawNeighborCandidateCount: consumedSchroederLawNeighborCandidates?.neighborCandidateCount ?? 0,
    schroederLawNeighborCandidateStrideFloats: consumedSchroederLawNeighborCandidates?.neighborCandidateStrideFloats ?? null,
    schroederLawNeighborCandidateBudget: consumedSchroederLawNeighborCandidates?.candidateBudget ?? null,
    schroederLawNeighborCandidateLawQueueCount: consumedSchroederLawNeighborCandidates?.lawQueueCount ?? null,
    schroederLawNeighborCandidateEnabledLawMask: consumedSchroederLawNeighborCandidates?.enabledLawMask ?? null,
    schroederLawNeighborCandidateContactInterfaceMask: consumedSchroederLawNeighborCandidates?.contactInterfaceMask ?? null,
    schroederLawNeighborCandidateEnumerationMode: consumedSchroederLawNeighborCandidates?.enumerationMode ?? null,
    schroederLawNeighborCandidateTreeTraversalStatus: consumedSchroederLawNeighborCandidates?.treeTraversalStatus ?? null,
    schroederLawNeighborCandidateBufferObserved:
      consumedSchroederLawNeighborCandidates?.neighborCandidateBufferObserved === true,
    schroederLawNeighborCandidateBufferConsumed:
      consumedSchroederLawNeighborCandidates?.neighborCandidateBufferConsumed === true,
    schroederLawNeighborSourceSpanBufferObserved:
      consumedSchroederLawNeighborCandidates?.sourceCandidateSpanBufferObserved === true,
    schroederLawNeighborSourceSpanBufferConsumed:
      consumedSchroederLawNeighborCandidates?.sourceCandidateSpanBufferConsumed === true,
    schroederLawNeighborSourceSpanCount:
      consumedSchroederLawNeighborCandidates?.sourceCandidateSpanCount ?? 0,
    schroederLawNeighborSourceSpanStrideFloats:
      consumedSchroederLawNeighborCandidates?.sourceCandidateSpanStrideFloats ?? null,
    schroederLawNeighborSourceSpanConsumerStatus:
      consumedSchroederLawNeighborCandidates?.sourceCandidateSpanConsumerStatus ?? null,
    schroederLawNeighborSourceSpanReason:
      consumedSchroederLawNeighborCandidates?.sourceCandidateSpanReason ?? null,
    pressureInterfaceSpatialIndexStatus:
      consumedSchroederLawNeighborCandidates?.pressureInterfaceSpatialIndexStatus ?? null,
    pressureInterfaceSpatialIndexMode:
      consumedSchroederLawNeighborCandidates?.pressureInterfaceSpatialIndexMode ?? null,
    pressureInterfaceBroadCandidateScanFallback:
      consumedSchroederLawNeighborCandidates?.broadCandidateScanFallback === true,
    interfaceSourceKeySchema: resolvedInterfaceSourceKeys.schema,
    interfaceSourceKeySourceStatus: resolvedInterfaceSourceKeys.sourceStatus,
    interfaceSourceKeyStatus: resolvedInterfaceSourceKeys.status,
    interfaceSourceKeyConsumerStatus: resolvedInterfaceSourceKeys.consumerStatus,
    interfaceSourceKeyReason: resolvedInterfaceSourceKeys.reason,
    interfaceSourceKeyRowCount: resolvedInterfaceSourceKeys.rowCount,
    interfaceSourceKeyReadyCount: resolvedInterfaceSourceKeys.readyCount,
    interfaceSourceKeyStrideFloats: resolvedInterfaceSourceKeys.rowStrideFloats,
    interfaceSourceKeyBufferObserved: resolvedInterfaceSourceKeys.sourceKeyBufferObserved === true,
    interfaceSourceKeyBufferConsumed: resolvedInterfaceSourceKeys.sourceKeyBufferConsumed === true,
    interfaceSourceKeySurfaceIndexFallbackEnabled:
      resolvedInterfaceSourceKeys.surfaceIndexFallbackEnabled !== false,
    interfaceSourceKeySourceDeviceId: resolvedInterfaceSourceKeys.sourceDeviceId,
    interfaceSourceKeyConsumerDeviceId: resolvedInterfaceSourceKeys.consumerDeviceId,
    schroederLawNeighborCandidateSourceDeviceId: consumedSchroederLawNeighborCandidates?.sourceDeviceId ?? null,
    schroederLawNeighborCandidateConsumerDeviceId: consumedSchroederLawNeighborCandidates?.consumerDeviceId ?? null,
    queueCompletionStatus: 'queue-submitted',
    queueCompletionMethod: 'queue.submit',
    derivation: consumedSchroederLawNeighborCandidates?.neighborCandidateBufferConsumed
      ? 'schroeder-law-neighbor-candidates-authoritative-gpu-interface-element-candidate-contact-kinematics'
      : (resolvedParticleBins.enabled
          ? `${consumedSchroederLawQueue.enabled ? 'schroeder-law-queue-gated-' : ''}gpu-interface-element-neighbor-bin-contact-kinematics`
          : `${consumedSchroederLawQueue.enabled ? 'schroeder-law-queue-gated-' : ''}gpu-interface-element-nearest-particle-contact-kinematics`),
    source: particleSource.identityReady
      ? 'resident-sph-particle-state-thermo-and-identity-buffers'
      : 'resident-sph-particle-state-and-thermo-buffers-with-zero-identity',
    cleanupBuffers: [
      paramsBuffer,
      localSchroederLawQueueBuffer,
      schroederLawQueueParamsBuffer,
      localSchroederLawNeighborCandidateBuffer,
      schroederLawNeighborCandidateParamsBuffer,
      localSchroederSourceSpanBuffer,
      schroederSourceSpanParamsBuffer,
      localInterfaceSourceKeyBuffer,
      interfaceSourceKeyParamsBuffer,
      localParticleIdentityBuffer,
      ...(resolvedInterfaceSourceKeys.cleanupBuffers || []),
      ...(resolvedParticleBins.cleanupBuffers || [])
    ],
    destroyContactKinematicsBuffer() {
      outputBuffer.destroy?.();
    }
  };
}

function summarizeForceRowsFromElements(elements = [], pressurePa = 0, gasCellField = null, contactPolicy = null) {
  const pressureCells = normalizedGasPressureCells(gasCellField);
  const forceRows = [];
  const forceBySurface = new Map();
  let netMaterialForceN = [0, 0, 0];
  let netGasReactionForceN = [0, 0, 0];
  let totalAbsMaterialForceN = 0;
  let maxPairResidualN = 0;
  let minInterfacePressurePa = Number.POSITIVE_INFINITY;
  let maxInterfacePressurePa = Number.NEGATIVE_INFINITY;
  let minAlgorithmContactPressurePa = Number.POSITIVE_INFINITY;
  let maxAlgorithmContactPressurePa = 0;
  let algorithmContactForceRowCount = 0;
  let interfaceContactKinematicsReadyCount = 0;
  const algorithmContactPairKeys = new Set();
  for (const element of elements) {
    const interfacePressurePa = gasPressureTractionEligibleForElement(element)
      ? pressureForElementFromCells(element, pressureCells, pressurePa)
      : 0;
    const elementKinematics = interfaceContactKinematicsForElement(element);
    if (elementKinematics.status === 'interface-contact-kinematics-ready') {
      interfaceContactKinematicsReadyCount += 1;
    }
    const contactResponse = algorithmContactPairResponseForElement(element, contactPolicy);
    const algorithmContactPressurePa = clampPositive(contactResponse.contactPressurePa, 0);
    const totalPressurePa = interfacePressurePa + algorithmContactPressurePa;
    minInterfacePressurePa = Math.min(minInterfacePressurePa, totalPressurePa);
    maxInterfacePressurePa = Math.max(maxInterfacePressurePa, totalPressurePa);
    if (algorithmContactPressurePa > 0) {
      algorithmContactForceRowCount += 1;
      minAlgorithmContactPressurePa = Math.min(minAlgorithmContactPressurePa, algorithmContactPressurePa);
      maxAlgorithmContactPressurePa = Math.max(maxAlgorithmContactPressurePa, algorithmContactPressurePa);
      if (contactResponse.row?.pairKey) algorithmContactPairKeys.add(contactResponse.row.pairKey);
    }
    const normalArea = normalAreaVectorForElement(element);
    const materialForceN = cleanVector3(normalArea.map((component) => -totalPressurePa * component));
    const gasReactionForceN = cleanVector3(materialForceN.map((component) => -component));
    const pairResidualN = cleanVector3(addVector3(materialForceN, gasReactionForceN));
    maxPairResidualN = Math.max(maxPairResidualN, vectorMagnitude3(pairResidualN));
    netMaterialForceN = addVector3(netMaterialForceN, materialForceN);
    netGasReactionForceN = addVector3(netGasReactionForceN, gasReactionForceN);
    totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
    const row = {
      index: forceRows.length,
      surfaceIndex: finiteNumber(element.surfaceIndex, 0),
      surfaceKey: element.surfaceKey || `${element.materialId}|${element.phaseId}`,
      material: element.material ?? null,
      phase: element.phase ?? null,
      materialId: finiteNumber(element.materialId, 0),
      phaseId: finiteNumber(element.phaseId, 0),
      axisId: finiteNumber(element.axisId, 0),
      centroidM: Array.isArray(element.centroidM) ? [...element.centroidM] : [0, 0, 0],
      areaM2: finiteNumber(element.areaM2, 0),
      pressurePa: totalPressurePa,
      gasInterfacePressurePa: interfacePressurePa,
      algorithmContactPressurePa,
      algorithmContactPairKey: contactResponse.row?.pairKey ?? null,
      algorithmContactPairResponseStatus: contactResponse.status,
      interfaceContactKinematicsStatus: elementKinematics.status,
      interfaceContactGapM: contactResponse.dynamicPressure?.gapM ?? null,
      interfaceContactNormalVelocityMPerS: contactResponse.dynamicPressure?.normalVelocityMPerS ?? null,
      interfaceContactPressureDerivation: contactResponse.dynamicPressure?.status ?? null,
      materialForceN,
      gasReactionForceN,
      pairResidualN,
      status: 'pressure-interface-force-row-ready'
    };
    forceRows.push(row);
    const surface = forceBySurface.get(row.surfaceKey) || {
      surfaceKey: row.surfaceKey,
      material: row.material,
      phase: row.phase,
      forceRowCount: 0,
      areaM2: 0,
      netMaterialForceN: [0, 0, 0],
      netGasReactionForceN: [0, 0, 0],
      totalAbsMaterialForceN: 0
    };
    surface.forceRowCount += 1;
    surface.areaM2 += row.areaM2;
    surface.netMaterialForceN = addVector3(surface.netMaterialForceN, materialForceN);
    surface.netGasReactionForceN = addVector3(surface.netGasReactionForceN, gasReactionForceN);
    surface.totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
    forceBySurface.set(row.surfaceKey, surface);
  }
  netMaterialForceN = cleanVector3(netMaterialForceN);
  netGasReactionForceN = cleanVector3(netGasReactionForceN);
  const conservationResidualN = cleanVector3(addVector3(netMaterialForceN, netGasReactionForceN));
  const conservationResidualMagnitudeN = vectorMagnitude3(conservationResidualN);
  const algorithmContactPairResponseApplied = algorithmContactForceRowCount > 0;
  return {
    forceRows,
    surfaceForceCount: forceBySurface.size,
    surfaceForces: [...forceBySurface.values()],
    totalInterfaceAreaM2: elements.reduce((sum, element) => sum + finiteNumber(element.areaM2, 0), 0),
    totalAbsMaterialForceN,
    netMaterialForceN,
    netGasReactionForceN,
    conservationResidualN,
    conservationResidualMagnitudeN,
    maxPairResidualN,
    gasInterfacePressureRangePa: forceRows.length > 0
      ? [minInterfacePressurePa, maxInterfacePressurePa]
      : null,
    algorithmContactPairResponseSchema: contactPolicy?.schema ?? ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA,
    algorithmContactPairResponseStatus: algorithmContactPairResponseApplied
      ? 'algorithm-contact-pair-response-applied'
      : (contactPolicy?.status ?? 'algorithm-contact-pair-response-policy-unavailable'),
    algorithmContactPairResponseApplied,
    algorithmContactPolicyRowCount: contactPolicy?.rowCount ?? 0,
    algorithmContactForceRowCount,
    interfaceContactKinematicsSchema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    interfaceContactKinematicsStatus: interfaceContactKinematicsReadyCount > 0
      ? 'interface-contact-kinematics-ready'
      : 'interface-contact-kinematics-unavailable',
    interfaceContactKinematicsReadyCount,
    interfaceContactKinematicsRowCount: elements.length,
    algorithmContactPairKeys: [...algorithmContactPairKeys],
    algorithmContactPressureRangePa: algorithmContactPairResponseApplied
      ? [minAlgorithmContactPressurePa, maxAlgorithmContactPressurePa]
      : null,
    maxAlgorithmContactPressurePa
  };
}

function summarizeForceRowsFromGpuValues(
  packedInterfaceElements = null,
  forceRowValues = null,
  contactPolicy = null
) {
  if (!(forceRowValues instanceof Float32Array)) {
    throw new TypeError('Shared exact-near full readback requires Float32Array force rows');
  }
  const elements = packedInterfaceElements?.elements || [];
  const packedRows = packedInterfaceElements?.rows;
  const rowCount = packedInterfaceElements?.rowCount ?? elements.length;
  if (
    !(packedRows instanceof Float32Array)
    || elements.length !== rowCount
    || forceRowValues.length !== rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS
  ) {
    throw new Error('Shared exact-near GPU force-row readback length is inconsistent with the packed interface input');
  }
  const forceRows = [];
  const forceBySurface = new Map();
  let netMaterialForceN = [0, 0, 0];
  let netGasReactionForceN = [0, 0, 0];
  let totalAbsMaterialForceN = 0;
  let maxPairResidualN = 0;
  let minTotalInterfacePressurePa = Number.POSITIVE_INFINITY;
  let maxTotalInterfacePressurePa = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < rowCount; index += 1) {
    const offset = index * SPH_PRESSURE_INTERFACE_FORCE_FLOATS;
    const element = elements[index] || {};
    const rowValues = forceRowValues.subarray(
      offset,
      offset + SPH_PRESSURE_INTERFACE_FORCE_FLOATS
    );
    if (![...rowValues].every(Number.isFinite)) {
      throw new Error(`Shared exact-near GPU force row ${index} contains non-finite values`);
    }
    for (let component = 0; component < 8; component += 1) {
      if (rowValues[component] !== packedRows[offset + component]) {
        throw new Error(`Shared exact-near GPU force row ${index} identity/geometry copy is torn`);
      }
    }
    if (rowValues[15] !== 1) {
      throw new Error(`Shared exact-near GPU force row ${index} is not exactly ready`);
    }
    if (rowValues[7] <= 0 || rowValues[14] < 0) {
      throw new Error(`Shared exact-near GPU force row ${index} has invalid area or total pressure`);
    }
    const centroidM = [
      forceRowValues[offset + 4],
      forceRowValues[offset + 5],
      forceRowValues[offset + 6]
    ];
    const materialForceN = [
      forceRowValues[offset + 8],
      forceRowValues[offset + 9],
      forceRowValues[offset + 10]
    ];
    const gasReactionForceN = [
      forceRowValues[offset + 11],
      forceRowValues[offset + 12],
      forceRowValues[offset + 13]
    ];
    const totalPressurePa = forceRowValues[offset + 14];
    minTotalInterfacePressurePa = Math.min(minTotalInterfacePressurePa, totalPressurePa);
    maxTotalInterfacePressurePa = Math.max(maxTotalInterfacePressurePa, totalPressurePa);
    const pairResidualN = addVector3(materialForceN, gasReactionForceN);
    maxPairResidualN = Math.max(maxPairResidualN, vectorMagnitude3(pairResidualN));
    netMaterialForceN = addVector3(netMaterialForceN, materialForceN);
    netGasReactionForceN = addVector3(netGasReactionForceN, gasReactionForceN);
    totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
    const surfaceKey = element.surfaceKey
      || `${forceRowValues[offset + 1]}|${forceRowValues[offset + 2]}`;
    const row = {
      index,
      surfaceIndex: forceRowValues[offset],
      surfaceKey,
      material: element.material ?? null,
      phase: element.phase ?? null,
      materialId: forceRowValues[offset + 1],
      phaseId: forceRowValues[offset + 2],
      axisId: forceRowValues[offset + 3],
      centroidM,
      areaM2: forceRowValues[offset + 7],
      pressurePa: totalPressurePa,
      gasInterfacePressurePa: null,
      algorithmContactPressurePa: null,
      algorithmContactPairKey: null,
      algorithmContactPairResponseStatus:
        'algorithm-contact-pair-response-component-unavailable-total-pressure-only-force-row-abi',
      interfaceContactKinematicsStatus:
        'interface-contact-kinematics-component-unavailable-total-pressure-only-force-row-abi',
      interfaceContactGapM: null,
      interfaceContactNormalVelocityMPerS: null,
      interfaceContactPressureDerivation:
        'authoritative-total-pressure-only-gpu-force-row-contact-component-unavailable',
      materialForceN,
      gasReactionForceN,
      pairResidualN,
      status: 'pressure-interface-force-row-ready'
    };
    forceRows.push(row);
    const surface = forceBySurface.get(surfaceKey) || {
      surfaceKey,
      material: row.material,
      phase: row.phase,
      forceRowCount: 0,
      areaM2: 0,
      netMaterialForceN: [0, 0, 0],
      netGasReactionForceN: [0, 0, 0],
      totalAbsMaterialForceN: 0
    };
    surface.forceRowCount += 1;
    surface.areaM2 += row.areaM2;
    surface.netMaterialForceN = addVector3(surface.netMaterialForceN, materialForceN);
    surface.netGasReactionForceN = addVector3(
      surface.netGasReactionForceN,
      gasReactionForceN
    );
    surface.totalAbsMaterialForceN += vectorMagnitude3(materialForceN);
    forceBySurface.set(surfaceKey, surface);
  }
  netMaterialForceN = cleanVector3(netMaterialForceN);
  netGasReactionForceN = cleanVector3(netGasReactionForceN);
  const conservationResidualN = cleanVector3(
    addVector3(netMaterialForceN, netGasReactionForceN)
  );
  const totalInterfacePressureRangePa = forceRows.length > 0
    ? [minTotalInterfacePressurePa, maxTotalInterfacePressurePa]
    : null;
  return {
    forceAggregateObserved: true,
    forceRowSummaryStatus: 'authoritative-gpu-force-row-summary-ready',
    pressureComponentDecompositionStatus:
      'unavailable-total-pressure-only-force-row-abi',
    forceRows,
    surfaceForceCount: forceBySurface.size,
    surfaceForces: [...forceBySurface.values()],
    totalInterfaceAreaM2: forceRows.reduce((sum, row) => sum + row.areaM2, 0),
    totalAbsMaterialForceN,
    netMaterialForceN,
    netGasReactionForceN,
    conservationResidualN,
    conservationResidualMagnitudeN: vectorMagnitude3(conservationResidualN),
    maxPairResidualN,
    totalInterfacePressureRangePa,
    gasInterfacePressureRangePa: null,
    algorithmContactPairResponseSchema:
      contactPolicy?.schema ?? ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA,
    algorithmContactPairResponseStatus:
      'algorithm-contact-pair-response-component-unavailable-total-pressure-only-force-row-abi',
    algorithmContactPairResponseApplied: null,
    algorithmContactPolicyRowCount: contactPolicy?.rowCount ?? 0,
    algorithmContactForceRowCount: null,
    interfaceContactKinematicsSchema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    interfaceContactKinematicsStatus:
      'interface-contact-kinematics-component-unavailable-total-pressure-only-force-row-abi',
    interfaceContactKinematicsReadyCount: null,
    interfaceContactKinematicsRowCount: rowCount,
    algorithmContactPairKeys: [],
    algorithmContactPressureRangePa: null,
    maxAlgorithmContactPressurePa: null
  };
}

export async function runSphPressureInterfaceForceRowsWebGpu({
  device,
  pressureFeedback = null,
  pressureInterfaceCoupling = null,
  pressureInterfaceForcePreview = null,
  materialInterfaceField = null,
  algorithmMaterialContactRows = null,
  algorithmContactPairResponseScale = DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE,
  algorithmContactMaxPressurePa = DEFAULT_ALGORITHM_CONTACT_PAIR_MAX_PRESSURE_PA,
  sphParticleState = null,
  sphParticleUpload = null,
  particleStateBuffer = null,
  particleThermoBuffer = null,
  particleIdentityBuffer = null,
  particleCount = null,
  contactKinematicsMaxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  contactKinematicsGapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M,
  contactKinematicsParticleBinCapacity = DEFAULT_CONTACT_PARTICLE_BIN_CAPACITY,
  contactKinematicsParticleBinMetadataReadback = false,
  boxDimsM = null,
  retainForceRowsBuffer = false,
  readbackMode = FULL_READBACK_MODE,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null,
  schroederActiveNodeList = null,
  schroederSpatialEpochGeneration = null,
  sharedSpatialFenceAuthority = 'consumer',
  retainedGasPressureCellsBuffer = null,
  retainedGasPressureCellRowCount = 0,
  retainedGasPressureCellRowStrideFloats = SPH_GAS_PRESSURE_CELL_FLOATS,
  retainedGasPressureCellRowByteLength = 0,
  retainedPressureFieldMode = LOCAL_GAS_CELL_PRESSURE_FIELD_MODE,
  retainedPressureFieldResolution = LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION,
  retainedLocalPressureGradientStatus = 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
  retainedGasPressureCellImport = null,
  measureGpuQueueFence = false,
  onGpuStageProgress = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceForceRowsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const reportGpuStage = (status, stage, details = {}) => {
    if (typeof onGpuStageProgress !== 'function') return;
    onGpuStageProgress({ status, stage, ...details });
  };
  const retainedGasPressureRowsReady = Boolean(
    retainedGasPressureCellsBuffer
      && Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0))) > 0
      && Math.max(1, Math.trunc(finiteNumber(
        retainedGasPressureCellRowStrideFloats,
        SPH_GAS_PRESSURE_CELL_FLOATS
      ))) === SPH_GAS_PRESSURE_CELL_FLOATS
  );
  const pressurePa = finiteNumber(
    pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa,
    retainedGasPressureRowsReady ? 0 : Number.NaN
  );
  const pressureFieldResolution = retainedGasPressureRowsReady
    ? {
        pressureFieldMode: retainedPressureFieldMode || LOCAL_GAS_CELL_PRESSURE_FIELD_MODE,
        pressureFieldResolution: retainedPressureFieldResolution || LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION,
        pressureGradientStatus: 'retained-gpu-gas-cell-pressure-rows-consumed',
        localPressureGradientSchema: ULG_SPH_LOCAL_PRESSURE_GRADIENT_FIELD_SCHEMA,
        localPressureGradientReady: true,
        localPressureGradientStatus: retainedLocalPressureGradientStatus,
        localPressureGradientBlockers: [],
        localPressureGradientForceCouplingStatus: 'retained-gpu-gas-cell-rows-ready-for-force-coupling',
        localPressureGradientValidation: false
      }
    : gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const packed = packMaterialInterfaceElementRows(materialInterfaceField);
  const packedContactKinematics = packMaterialInterfaceContactKinematicsRows(materialInterfaceField);
  const packedInterfaceSourceKeys = materialInterfaceField?.interfaceSourceKeyBuffer
    || materialInterfaceField?.sourceKeyBuffer
    ? {
        schema: materialInterfaceField.interfaceSourceKeySchema || ULG_INTERFACE_SOURCE_KEY_SCHEMA,
        status: materialInterfaceField.interfaceSourceKeyStatus || 'interface-source-key-retained',
        sourceKeyBuffer: materialInterfaceField.interfaceSourceKeyBuffer || materialInterfaceField.sourceKeyBuffer,
        rowCount: materialInterfaceField.interfaceSourceKeyRowCount ?? packed.rowCount,
        readyCount: materialInterfaceField.interfaceSourceKeyReadyCount ?? packed.rowCount,
        rowStrideFloats: materialInterfaceField.interfaceSourceKeyStrideFloats ?? SPH_INTERFACE_SOURCE_KEY_FLOATS,
        surfaceIndexFallbackEnabled: materialInterfaceField.interfaceSourceKeySurfaceIndexFallbackEnabled !== false
      }
    : packMaterialInterfaceSourceKeyRows(materialInterfaceField);
  const cpuPackedGasPressureCells = packGasPressureCellRows(pressureFeedback?.gasCellField || null);
  const packedGasPressureCells = retainedGasPressureRowsReady
    ? {
        rows: new Float32Array(0),
        rowCount: Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0))),
        rowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
        rowByteLength: Math.max(
          0,
          Math.trunc(finiteNumber(
            retainedGasPressureCellRowByteLength,
            Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0)))
              * SPH_GAS_PRESSURE_CELL_FLOATS
              * Float32Array.BYTES_PER_ELEMENT
          ))
        )
      }
    : cpuPackedGasPressureCells;
  const contactPolicy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows,
    algorithmContactPairResponseScale,
    algorithmContactMaxPressurePa
  });
  const packedContactPolicy = packAlgorithmContactPolicyRows(contactPolicy);
  const particleSource = resolveParticleKinematicsSource({
    device,
    sphParticleState,
    sphParticleUpload,
    particleStateBuffer,
    particleThermoBuffer,
    particleIdentityBuffer,
    particleCount
  });
  const schroederPressureInterfaceLawQueue = resolveSchroederPressureInterfaceLawQueue(schroederLawQueue, {
    device,
    particleCount: particleSource.particleCount
  });
  const schroederPressureInterfaceLawNeighborCandidates = resolveSchroederPressureInterfaceLawNeighborCandidates(
    schroederLawNeighborCandidates,
    { device }
  );
  const schroederPressureInterfaceSpatialSource =
    resolveSchroederPressureInterfaceSpatialEpochSource(
      schroederSpatialEpochGeneration?.source ?? schroederActiveNodeList,
      {
      device,
      particleCount: particleSource.particleCount
      }
    );
  const schroederPressureInterfaceSpatialProvenance =
    resolveSchroederPressureInterfaceSpatialEpochProvenance({
      spatialSource: schroederPressureInterfaceSpatialSource,
      materialInterfaceField,
      particleSource,
      particleCount: particleSource.particleCount,
      requireCompleteBufferFamily: schroederSpatialEpochGeneration != null
    });
  const schroederPressureInterfaceSharedSpatialGeneration =
    resolveSchroederPressureInterfaceSpatialEpochGeneration(
      schroederSpatialEpochGeneration,
      {
        device,
        spatialSource: schroederPressureInterfaceSpatialSource,
        spatialProvenance: schroederPressureInterfaceSpatialProvenance,
        particleSource,
        particleCount: particleSource.particleCount
      }
    );
  const sharedSpatialGenerationSupplied = schroederSpatialEpochGeneration != null;
  const contactKinematicsGpuDerivationEligible = canDeriveInterfaceContactKinematicsOnGpu({
    packedInterfaceElements: packed,
    packedContactPolicy,
    packedContactKinematics,
    particleSource,
    canonicalGenerationRequired: sharedSpatialGenerationSupplied
  });
  const contactKinematicsParticleBinGrid = contactKinematicsGpuDerivationEligible
    && !sharedSpatialGenerationSupplied
    ? resolvePressureInterfaceParticleBinGrid({
        boxDimsM,
        packedContactPolicy,
        maxSearchRadiusM: contactKinematicsMaxSearchRadiusM,
        binCapacity: contactKinematicsParticleBinCapacity,
        particleCount: particleSource.particleCount
      })
    : null;
  const pressureModelId = packedGasPressureCells.rowCount > 0 && pressureFieldResolution.localPressureGradientReady
    ? 1
    : 0;
  const canSolve = pressureInterfaceCoupling?.status === 'pressure-interface-coupling-ready-for-solver'
    && Number.isFinite(pressurePa)
    && pressurePa >= 0
    && packed.rowCount > 0;
  if (!canSolve) {
    return {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-blocked',
      reason: pressureInterfaceCoupling?.status || 'pressure-interface-coupling-not-ready',
      readbackMode,
      fullReadbackPerformed: false,
      normalHotLoopReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
      pressureInterfaceForcePreview,
      forceRowCount: 0,
      forceRowByteLength: 0,
      forceRowValues: new Float32Array(0),
      pressureInterfaceForceSolver: {
        schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
        status: 'pressure-interface-force-solver-blocked',
        forceApplicationStatus: 'not-applied-solver-blocked',
        pressureInterfaceCouplingStatus: pressureInterfaceCoupling?.status || null,
        forceCouplingStatus: pressureInterfaceCoupling?.forceCouplingStatus || null,
        gasInterfacePressurePa: Number.isFinite(pressurePa) ? pressurePa : null,
        gasInterfacePressureRangePa: null,
        pressureFieldMode: pressureFieldResolution.pressureFieldMode,
        pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
        pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
        localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
        localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
        localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
        localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
        localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
        gasPressureCellRowCount: packedGasPressureCells.rowCount,
        gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
        pressureModelId,
        algorithmContactPairResponseSchema: contactPolicy.schema,
        algorithmContactPairResponseStatus: contactPolicy.status,
        algorithmContactPolicyRowsSchema: algorithmMaterialContactRows?.schema ?? null,
        algorithmContactPolicyRowCount: contactPolicy.rowCount,
        algorithmContactDomainPairRowCount: packedContactPolicy.domainPairRowCount,
        algorithmContactBodySpecificWithoutDomainPairRowCount:
          packedContactPolicy.bodySpecificWithoutDomainPairRowCount,
        algorithmContactDomainPairGpuSelectionReady:
          packedContactPolicy.domainPairGpuSelectionReady,
        algorithmContactDomainPairGpuSelectionStatus:
          packedContactPolicy.domainPairGpuSelectionStatus,
        algorithmContactForceRowCount: 0,
        algorithmContactPressureRangePa: null,
        algorithmContactPairKeys: [],
        interfaceContactKinematicsSchema: packedContactKinematics.schema,
        interfaceContactKinematicsStatus: packedContactKinematics.status,
        interfaceContactKinematicsRowCount: packedContactKinematics.rowCount,
        interfaceContactKinematicsReadyCount: sharedSpatialGenerationSupplied
          ? null
          : packedContactKinematics.readyCount,
        interfaceContactKinematicsDomainPairReadyCount:
          sharedSpatialGenerationSupplied
            ? null
            : packedContactKinematics.domainPairReadyCount,
        interfaceContactKinematicsGpuDerivationEligible: false,
        interfaceContactKinematicsDerivationStatus: canDeriveInterfaceContactKinematicsOnGpu({
          packedInterfaceElements: packed,
          packedContactPolicy,
          packedContactKinematics,
          particleSource
        })
          ? 'blocked-solver-not-ready-before-contact-kinematics-derivation'
          : 'interface-contact-kinematics-uses-element-fields-or-unavailable',
        interfaceContactKinematicsParticleSourceStatus: particleSource.status,
        interfaceContactKinematicsParticleCount: particleSource.particleCount,
        interfaceContactKinematicsParticleIdentityReady: particleSource.identityReady === true,
        interfaceContactKinematicsParticleIdentityRequired: particleSource.identityRequired === true,
        interfaceContactKinematicsParticleBinGridStatus: contactKinematicsParticleBinGrid?.status || null,
        interfaceContactKinematicsParticleBinGridEnabled: contactKinematicsParticleBinGrid?.enabled === true,
        interfaceContactKinematicsParticleBinGridCellCount: contactKinematicsParticleBinGrid?.cellCount || 0,
        interfaceContactKinematicsParticleBinGridBinCapacity: contactKinematicsParticleBinGrid?.binCapacity || 0,
        interfaceContactKinematicsParticleBinGridAverageOccupancy: contactKinematicsParticleBinGrid?.averageOccupancy || 0,
        interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk: contactKinematicsParticleBinGrid?.estimatedOverflowRisk === true,
        interfaceContactKinematicsParticleBinGridIndexBufferByteLength: contactKinematicsParticleBinGrid?.indexBufferByteLength || 0,
        interfaceSourceKeySchema: packedInterfaceSourceKeys.schema,
        interfaceSourceKeyStatus: packedInterfaceSourceKeys.status,
        interfaceSourceKeyRowCount: packedInterfaceSourceKeys.rowCount,
        interfaceSourceKeyReadyCount: packedInterfaceSourceKeys.readyCount,
        interfaceSourceKeyStrideFloats: packedInterfaceSourceKeys.rowStrideFloats,
        interfaceSourceKeyBufferObserved: Boolean(packedInterfaceSourceKeys.sourceKeyBuffer),
        interfaceSourceKeyBufferConsumed: false,
        interfaceSourceKeySurfaceIndexFallbackEnabled:
          packedInterfaceSourceKeys.surfaceIndexFallbackEnabled !== false,
        schroederLawQueueSchema: schroederPressureInterfaceLawQueue.sourceSchema,
        schroederLawQueueSourceStatus: schroederPressureInterfaceLawQueue.sourceStatus,
        schroederLawQueueStatus: schroederPressureInterfaceLawQueue.status,
        schroederLawQueueConsumerStatus: schroederPressureInterfaceLawQueue.consumerStatus,
        schroederLawQueueReason: schroederPressureInterfaceLawQueue.reason,
        schroederLawQueueEnabled: schroederPressureInterfaceLawQueue.enabled === true,
        schroederLawQueueActiveNodeCount: schroederPressureInterfaceLawQueue.activeNodeCount,
        schroederLawQueueStrideFloats: schroederPressureInterfaceLawQueue.lawQueueStrideFloats,
        schroederLawQueueEnabledLawMask: schroederPressureInterfaceLawQueue.enabledLawMask,
        schroederLawQueueContactInterfaceMask: schroederPressureInterfaceLawQueue.contactInterfaceMask,
        schroederLawQueueBufferConsumed: false,
        schroederLawQueueSourceDeviceId: schroederPressureInterfaceLawQueue.sourceDeviceId,
        schroederLawQueueConsumerDeviceId: schroederPressureInterfaceLawQueue.consumerDeviceId,
        schroederLawNeighborCandidateSchema: schroederPressureInterfaceLawNeighborCandidates.sourceSchema,
        schroederLawNeighborCandidateSourceStatus: schroederPressureInterfaceLawNeighborCandidates.sourceStatus,
        schroederLawNeighborCandidateStatus: schroederPressureInterfaceLawNeighborCandidates.status,
        schroederLawNeighborCandidateConsumerStatus: schroederPressureInterfaceLawNeighborCandidates.consumerStatus,
        schroederLawNeighborCandidateReason: schroederPressureInterfaceLawNeighborCandidates.reason,
        schroederLawNeighborCandidateAvailable: schroederPressureInterfaceLawNeighborCandidates.available === true,
        schroederLawNeighborCandidateAuthoritative: schroederPressureInterfaceLawNeighborCandidates.authoritative === true,
        schroederLawNeighborCandidateCount: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateCount,
        schroederLawNeighborCandidateStrideFloats: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateStrideFloats,
        schroederLawNeighborCandidateBudget: schroederPressureInterfaceLawNeighborCandidates.candidateBudget,
        schroederLawNeighborCandidateLawQueueCount: schroederPressureInterfaceLawNeighborCandidates.lawQueueCount,
        schroederLawNeighborCandidateEnabledLawMask: schroederPressureInterfaceLawNeighborCandidates.enabledLawMask,
        schroederLawNeighborCandidateContactInterfaceMask: schroederPressureInterfaceLawNeighborCandidates.contactInterfaceMask,
        schroederLawNeighborCandidateEnumerationMode: schroederPressureInterfaceLawNeighborCandidates.enumerationMode,
        schroederLawNeighborCandidateTreeTraversalStatus: schroederPressureInterfaceLawNeighborCandidates.treeTraversalStatus,
        schroederLawNeighborCandidateBufferObserved: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateBufferObserved === true,
        schroederLawNeighborCandidateBufferConsumed: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateBufferConsumed === true,
        schroederLawNeighborSourceSpanBufferObserved:
          schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanBufferObserved === true,
        schroederLawNeighborSourceSpanBufferConsumed:
          schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanBufferConsumed === true,
        schroederLawNeighborSourceSpanCount:
          schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanCount,
        schroederLawNeighborSourceSpanStrideFloats:
          schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanStrideFloats,
        schroederLawNeighborSourceSpanConsumerStatus:
          schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanConsumerStatus,
        schroederLawNeighborSourceSpanReason:
          schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanReason,
        pressureInterfaceSpatialIndexStatus:
          schroederPressureInterfaceLawNeighborCandidates.pressureInterfaceSpatialIndexStatus,
        pressureInterfaceSpatialIndexMode:
          schroederPressureInterfaceLawNeighborCandidates.pressureInterfaceSpatialIndexMode,
        pressureInterfaceBroadCandidateScanFallback:
          schroederPressureInterfaceLawNeighborCandidates.broadCandidateScanFallback === true,
        schroederLawNeighborCandidateSourceDeviceId: schroederPressureInterfaceLawNeighborCandidates.sourceDeviceId,
        schroederLawNeighborCandidateConsumerDeviceId: schroederPressureInterfaceLawNeighborCandidates.consumerDeviceId,
        sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? 0,
        forceRowCount: 0,
        forceRowLayout: [...SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT],
        forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
        forceRowValues: new Float32Array(0),
        forceResolution: pressureModelId === 1 ? 'local-gradient-interface-traction' : 'uniform-interface-traction',
        localPressureGradientValidation: pressureModelId === 1,
        conservationStatus: 'not-evaluated'
      }
    };
  }

  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const outputByteLength = packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const inputBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-elements-in', packed.rows);
  const gasPressureCellsBuffer = retainedGasPressureRowsReady
    ? retainedGasPressureCellsBuffer
    : writeStorageBuffer(device, 'ulg-sph-pressure-interface-gas-cells-in', packedGasPressureCells.rows);
  const contactPolicyBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-contact-policy-rows', packedContactPolicy.rows);
  let contactKinematicsBuffer = null;
  let contactKinematicsGpuDerivation = null;
  let contactKinematicsGpuDerived = false;
  let contactKinematicsParticleBins = null;
  let contactKinematicsSpatialBuild = null;
  let particleBinOverflowStatus = null;
  let particleBinOverflowCount = null;
  const contactKinematicsCleanupBuffers = [];
  if (sharedSpatialGenerationSupplied || contactKinematicsGpuDerivationEligible) {
    if (sharedSpatialGenerationSupplied) {
      contactKinematicsSpatialBuild =
        schroederPressureInterfaceSharedSpatialGeneration;
    }
    if (
      contactKinematicsSpatialBuild?.selected === true
      && contactKinematicsGpuDerivationEligible
    ) {
      Object.assign(schroederPressureInterfaceLawNeighborCandidates, {
        authoritative: false,
        neighborCandidateBufferConsumed: false,
        sourceCandidateSpanBufferConsumed: false,
        consumerStatus:
          'schroeder-pressure-interface-law-neighbor-candidates-bypassed-canonical-spatial-epoch',
        sourceCandidateSpanConsumerStatus:
          'schroeder-pressure-interface-source-spans-bypassed-canonical-spatial-epoch',
        pressureInterfaceSpatialIndexStatus:
          'pressure-interface-canonical-spatial-epoch-selected',
        pressureInterfaceSpatialIndexMode: 'ss-spatial-epoch-v1-exact-near-csr',
        broadCandidateScanFallback: false
      });
      const exactNearProgress = {
        elementCount: packed.rowCount,
        contactPolicyRowCount: packedContactPolicy.rowCount,
        particleCount: particleSource.particleCount,
        levelCount: contactKinematicsSpatialBuild.source?.levelCount ?? null,
        sourceCount: contactKinematicsSpatialBuild.source?.sourceCount ?? null,
        sourceCapacity: contactKinematicsSpatialBuild.execution?.sourceCapacity ?? null,
        cellCapacity: contactKinematicsSpatialBuild.execution?.cellCapacity ?? null
      };
      const baseGridSpacingM = finiteNumber(
        contactKinematicsSpatialBuild.source?.baseGridSpacingM,
        0
      );
      const minLevel = finiteNumber(contactKinematicsSpatialBuild.source?.minLevel, 0);
      const minLevelSpacingM = baseGridSpacingM * (2 ** minLevel);
      const maxSupportRadiusM = maxContactPolicySupportRadiusM(packedContactPolicy);
      const resolvedSearchRadiusM = Math.max(
        maxSupportRadiusM * 2,
        clampPositive(contactKinematicsMaxSearchRadiusM, 0),
        1e-6
      );
      let maximumCentroidAbsM = 0;
      for (let rowIndex = 0; rowIndex < packed.rowCount; rowIndex += 1) {
        const rowOffset = rowIndex * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS;
        maximumCentroidAbsM = Math.max(
          maximumCentroidAbsM,
          Math.abs(finiteNumber(packed.rows[rowOffset + 4], 0)),
          Math.abs(finiteNumber(packed.rows[rowOffset + 5], 0)),
          Math.abs(finiteNumber(packed.rows[rowOffset + 6], 0))
        );
      }
      Object.assign(exactNearProgress, {
        baseGridSpacingM,
        minLevel,
        minLevelSpacingM,
        maxSupportRadiusM,
        resolvedSearchRadiusM,
        maximumCentroidAbsM,
        maximumCentroidCellMagnitude: minLevelSpacingM > 0
          ? maximumCentroidAbsM / minLevelSpacingM
          : null,
        maximumQueryRadiusCells: minLevelSpacingM > 0
          ? resolvedSearchRadiusM * Math.SQRT2 / minLevelSpacingM
          : null
      });
      if (measureGpuQueueFence === true) {
        Object.assign(
          exactNearProgress,
          await readSchroederExactNearDirectoryDiagnostics(
            device,
            contactKinematicsSpatialBuild
          )
        );
      }
      reportGpuStage(
        'pressure-interface-gpu-stage-started',
        'canonical-exact-near-contact-kinematics',
        exactNearProgress
      );
      contactKinematicsGpuDerivation =
        runSphPressureInterfaceSpatialExactNearContactKinematicsWebGpu({
          device,
          packedInterfaceElements: packed,
          packedContactPolicy,
          interfaceElementsBuffer: inputBuffer,
          contactPolicyBuffer,
          particleSource,
          spatialBuild: contactKinematicsSpatialBuild,
          maxSearchRadiusM: contactKinematicsMaxSearchRadiusM,
          gapFloorM: contactKinematicsGapFloorM
        });
      reportGpuStage(
        'pressure-interface-gpu-stage-submitted',
        'canonical-exact-near-contact-kinematics',
        exactNearProgress
      );
      if (measureGpuQueueFence === true) {
        reportGpuStage(
          'pressure-interface-gpu-stage-started',
          'canonical-exact-near-contact-kinematics-queue-fence',
          exactNearProgress
        );
        if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
          throw new Error('Pressure/interface GPU substage measurement requires queue.onSubmittedWorkDone');
        }
        await device.queue.onSubmittedWorkDone();
        reportGpuStage(
          'pressure-interface-gpu-stage-complete',
          'canonical-exact-near-contact-kinematics-queue-fence',
          exactNearProgress
        );
      }
    } else if (sharedSpatialGenerationSupplied) {
      Object.assign(schroederPressureInterfaceLawNeighborCandidates, {
        authoritative: false,
        neighborCandidateBufferConsumed: false,
        sourceCandidateSpanBufferConsumed: false,
        consumerStatus:
          'schroeder-pressure-interface-law-neighbor-candidates-suppressed-shared-generation-rejected',
        sourceCandidateSpanConsumerStatus:
          'schroeder-pressure-interface-source-spans-suppressed-shared-generation-rejected',
        pressureInterfaceSpatialIndexStatus:
          'pressure-interface-shared-spatial-generation-rejected-fail-closed',
        pressureInterfaceSpatialIndexMode: null,
        broadCandidateScanFallback: false
      });
      contactKinematicsGpuDerivation =
        createFailClosedBorrowedSpatialContactKinematicsWebGpu({
          device,
          packedInterfaceElements: packed,
          particleSource,
          spatialAdmission: contactKinematicsSpatialBuild?.selected === true
            ? {
                ...contactKinematicsSpatialBuild,
                status:
                  'schroeder-spatial-exact-near-generation-consumer-prerequisites-unavailable',
                reason:
                  'Caller-owned spatial generation was selected but canonical contact-kinematics prerequisites were unavailable'
              }
            : contactKinematicsSpatialBuild
        });
    } else {
      contactKinematicsParticleBins = runSphPressureInterfaceParticleBinsWebGpu({
        device,
        particleSource,
        particleBinGrid: contactKinematicsParticleBinGrid,
        readbackMetadata: contactKinematicsParticleBinMetadataReadback
      });
      contactKinematicsGpuDerivation = runSphPressureInterfaceContactKinematicsWebGpu({
        device,
        packedInterfaceElements: packed,
        packedContactPolicy,
        interfaceElementsBuffer: inputBuffer,
        contactPolicyBuffer,
        particleSource,
        particleBinGrid: contactKinematicsParticleBinGrid,
        particleBins: contactKinematicsParticleBins,
        maxSearchRadiusM: contactKinematicsMaxSearchRadiusM,
        gapFloorM: contactKinematicsGapFloorM,
        schroederLawQueue: schroederPressureInterfaceLawQueue,
        schroederLawNeighborCandidates: schroederPressureInterfaceLawNeighborCandidates,
        interfaceSourceKeys: packedInterfaceSourceKeys
      });
    }
    contactKinematicsBuffer = contactKinematicsGpuDerivation.buffer;
    contactKinematicsGpuDerived = true;
    contactKinematicsCleanupBuffers.push(...(contactKinematicsGpuDerivation.cleanupBuffers || []));
  } else {
    contactKinematicsBuffer = writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-contact-kinematics-rows',
      packedContactKinematics.rows
    );
  }
  const forceRowsBuffer = device.createBuffer({
    label: 'ulg-sph-pressure-interface-force-rows-out',
    size: Math.max(4, outputByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-pressure-interface-force-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
        label: 'ulg-sph-pressure-interface-force-rows-readback',
        size: Math.max(4, outputByteLength),
        usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
      });
  let returnedRetainedForceRowsBuffer = false;
  let returnedRetainedGasPressureCellsBuffer = false;
  let returnedResultForOwnerCleanup = null;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createPressureInterfaceParamsArray({
      elementCount: packed.rowCount,
      pressurePa,
      gasPressureCellCount: packedGasPressureCells.rowCount,
      pressureModelId,
      contactPolicyRowCount: packedContactPolicy.rowCount,
      algorithmContactPairResponseScale: contactPolicy.responseScale,
      algorithmContactMaxPressurePa: contactPolicy.maxContactPressurePa,
      algorithmContactPairResponseEnabled: packedContactPolicy.rowCount > 0
    }));
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-pressure-interface-force-rows.v4',
      label: 'ulg-sph-pressure-interface-force-rows',
      code: sphPressureInterfaceForceRowsWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'read-only-storage')
      ]
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: forceRowsBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
        { binding: 3, resource: { buffer: gasPressureCellsBuffer } },
        { binding: 4, resource: { buffer: contactPolicyBuffer } },
        { binding: 5, resource: { buffer: contactKinematicsBuffer } }
      ]
    });
    const forceRowsProgress = {
      elementCount: packed.rowCount,
      contactPolicyRowCount: packedContactPolicy.rowCount,
      particleCount: particleSource.particleCount,
      pressureModelId
    };
    reportGpuStage(
      'pressure-interface-gpu-stage-started',
      'force-rows',
      forceRowsProgress
    );
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(packed.rowCount / 64)));
    pass.end();
    if (!noFullReadback) {
      encoder.copyBufferToBuffer(forceRowsBuffer, 0, readBuffer, 0, Math.max(4, outputByteLength));
    }
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    reportGpuStage(
      'pressure-interface-gpu-stage-submitted',
      'force-rows',
      forceRowsProgress
    );
    if (measureGpuQueueFence === true) {
      reportGpuStage(
        'pressure-interface-gpu-stage-started',
        'force-rows-queue-fence',
        forceRowsProgress
      );
      if (typeof device.queue?.onSubmittedWorkDone !== 'function') {
        throw new Error('Pressure/interface GPU substage measurement requires queue.onSubmittedWorkDone');
      }
      await device.queue.onSubmittedWorkDone();
      reportGpuStage(
        'pressure-interface-gpu-stage-complete',
        'force-rows-queue-fence',
        forceRowsProgress
      );
    }

    let forceRowValues = new Float32Array(0);
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      forceRowValues = new Float32Array(readBuffer.getMappedRange()).slice(0, packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
      readBuffer.unmap();
    } else {
      if (
        schroederSpatialEpochGeneration != null
        && sharedSpatialFenceAuthority !== 'generation-owner'
        && typeof device.queue?.onSubmittedWorkDone === 'function'
      ) {
        await device.queue.onSubmittedWorkDone();
        queueCompletionStatus = 'queue-work-completed';
        queueCompletionMethod = 'queue.onSubmittedWorkDone';
      } else if (
        schroederSpatialEpochGeneration != null
        && sharedSpatialFenceAuthority === 'generation-owner'
      ) {
        queueCompletionStatus = 'queue-submitted-generation-owner-fence-pending';
        queueCompletionMethod = 'generation-owner-final-consumer-fence';
      } else {
        queueCompletionStatus = device.queue?.onSubmittedWorkDone
          ? 'queue-submitted-cleanup-deferred'
          : 'queue-submitted-no-explicit-completion';
        queueCompletionMethod = device.queue?.onSubmittedWorkDone
          ? 'deferred queue.onSubmittedWorkDone cleanup'
          : null;
      }
    }
    if (contactKinematicsParticleBins?.metadataReadbackBuffer) {
      await contactKinematicsParticleBins.metadataReadbackBuffer.mapAsync(GPU_MAP_MODE.READ);
      const metadata = new Uint32Array(contactKinematicsParticleBins.metadataReadbackBuffer.getMappedRange()).slice(0, 4);
      particleBinOverflowCount = metadata[0] || 0;
      particleBinOverflowStatus = 'particle-bin-overflow-readback-completed';
      contactKinematicsParticleBins.metadataReadbackBuffer.unmap();
    } else {
      particleBinOverflowStatus = contactKinematicsParticleBins?.overflowMetadataStatus || null;
    }

    const sharedSpatialGenerationSupplied = schroederSpatialEpochGeneration != null;
    const sharedSpatialExactNearFailClosed =
      sharedSpatialGenerationSupplied
      && contactKinematicsGpuDerivation?.status
        === 'interface-contact-kinematics-spatial-exact-near-fail-closed';
    let summary;
    let algorithmContactSummarySource;
    let algorithmContactSummaryObserved;
    if (!sharedSpatialGenerationSupplied) {
      const hostSummary = summarizeForceRowsFromElements(
        packed.elements,
        pressurePa,
        pressureFeedback?.gasCellField || null,
        contactPolicy
      );
      summary = {
        ...hostSummary,
        forceAggregateObserved: true,
        forceRowSummaryStatus: 'host-interface-element-force-summary-ready',
        pressureComponentDecompositionStatus: 'host-interface-element-kinematics',
        totalInterfacePressureRangePa: hostSummary.gasInterfacePressureRangePa
      };
      algorithmContactSummarySource = 'host-interface-element-kinematics';
      algorithmContactSummaryObserved = true;
    } else if (!noFullReadback) {
      const gpuSummary = summarizeForceRowsFromGpuValues(
        packed,
        forceRowValues,
        contactPolicy
      );
      if (sharedSpatialExactNearFailClosed) {
        summary = {
          ...gpuSummary,
          pressureComponentDecompositionStatus:
            'shared-spatial-exact-near-fail-closed-contact-known-zero',
          gasInterfacePressureRangePa: gpuSummary.totalInterfacePressureRangePa,
          algorithmContactPairResponseStatus:
            'algorithm-contact-pair-response-fail-closed-zero',
          algorithmContactPairResponseApplied: false,
          algorithmContactForceRowCount: 0,
          interfaceContactKinematicsStatus:
            'interface-contact-kinematics-spatial-exact-near-fail-closed',
          interfaceContactKinematicsReadyCount: 0,
          algorithmContactPressureRangePa: null,
          maxAlgorithmContactPressurePa: 0,
          forceRows: gpuSummary.forceRows.map((row) => ({
            ...row,
            gasInterfacePressurePa: row.pressurePa,
            algorithmContactPressurePa: 0,
            algorithmContactPairResponseStatus:
              'algorithm-contact-pair-response-fail-closed-zero',
            interfaceContactKinematicsStatus:
              'interface-contact-kinematics-spatial-exact-near-fail-closed',
            interfaceContactPressureDerivation:
              'shared-spatial-exact-near-fail-closed-zero-kinematics'
          }))
        };
        algorithmContactSummarySource =
          'authoritative-gpu-force-row-full-readback-shared-exact-near-fail-closed-zero-contact';
        algorithmContactSummaryObserved = true;
      } else {
        summary = gpuSummary;
        algorithmContactSummarySource =
          'authoritative-gpu-force-row-full-readback-total-pressure-only-contact-component-unavailable';
        algorithmContactSummaryObserved = false;
      }
    } else {
      summary = {
        forceAggregateObserved: false,
        forceRowSummaryStatus:
          'retained-gpu-force-row-summary-unavailable-no-readback',
        pressureComponentDecompositionStatus: sharedSpatialExactNearFailClosed
          ? 'shared-spatial-exact-near-fail-closed-contact-known-zero-no-force-readback'
          : 'unavailable-retained-gpu-force-rows-no-readback',
        forceRows: [],
        surfaceForceCount: null,
        surfaceForces: [],
        totalInterfaceAreaM2: null,
        totalAbsMaterialForceN: null,
        netMaterialForceN: null,
        netGasReactionForceN: null,
        conservationResidualN: null,
        conservationResidualMagnitudeN: null,
        maxPairResidualN: null,
        totalInterfacePressureRangePa: null,
        gasInterfacePressureRangePa: null,
        algorithmContactPairResponseSchema: contactPolicy.schema,
        algorithmContactPairResponseStatus: sharedSpatialExactNearFailClosed
          ? 'algorithm-contact-pair-response-fail-closed-zero'
          : 'algorithm-contact-pair-response-gpu-summary-unavailable-no-readback',
        algorithmContactPairResponseApplied: sharedSpatialExactNearFailClosed
          ? false
          : null,
        algorithmContactPolicyRowCount: contactPolicy.rowCount,
        algorithmContactForceRowCount: sharedSpatialExactNearFailClosed ? 0 : null,
        interfaceContactKinematicsSchema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
        interfaceContactKinematicsStatus: sharedSpatialExactNearFailClosed
          ? 'interface-contact-kinematics-spatial-exact-near-fail-closed'
          : 'interface-contact-kinematics-gpu-summary-unavailable-no-readback',
        interfaceContactKinematicsReadyCount: sharedSpatialExactNearFailClosed ? 0 : null,
        interfaceContactKinematicsRowCount: packed.elements.length,
        algorithmContactPairKeys: [],
        algorithmContactPressureRangePa: null,
        maxAlgorithmContactPressurePa: sharedSpatialExactNearFailClosed ? 0 : null
      };
      algorithmContactSummarySource = sharedSpatialExactNearFailClosed
        ? 'shared-spatial-exact-near-fail-closed-zero-kinematics-no-force-readback'
        : 'retained-gpu-force-rows-no-readback';
      algorithmContactSummaryObserved = sharedSpatialExactNearFailClosed;
    }
    const contactComponentUnresolved = sharedSpatialGenerationSupplied
      && !sharedSpatialExactNearFailClosed
      && contactPolicy.rowCount > 0;
    const forceDerivationSuffix = summary.algorithmContactPairResponseApplied === true
      ? '-plus-algorithm-contact-pair-response'
      : (contactComponentUnresolved
          ? '-with-algorithm-contact-component-unresolved'
          : '');
    const forceResolutionSuffix = summary.algorithmContactPairResponseApplied === true
      ? '+algorithm-contact-pair-response'
      : (contactComponentUnresolved
          ? '+algorithm-contact-component-unresolved'
          : '');
    const solver = {
      schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
      status: 'pressure-interface-force-solver-ready',
      backend: 'webgpu',
      forceApplicationStatus: 'solver-ready-not-applied',
      pressureInterfaceCouplingStatus: pressureInterfaceCoupling?.status || null,
      forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
      gasInterfacePressurePa: pressurePa,
      gasInterfacePressureRangePa: summary.gasInterfacePressureRangePa,
      totalInterfacePressureRangePa: summary.totalInterfacePressureRangePa,
      pressureComponentDecompositionStatus:
        summary.pressureComponentDecompositionStatus,
      pressureFieldMode: pressureFieldResolution.pressureFieldMode,
      pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
      pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
      localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
      localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
      localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
      localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
      localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
      gasPressureCellRowCount: packedGasPressureCells.rowCount,
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowsBufferRetained:
        (retainForceRowsBuffer === true || retainedGasPressureRowsReady) && packedGasPressureCells.rowCount > 0,
      gasPressureCellRowsBufferBorrowed: retainedGasPressureRowsReady,
      retainedGasPressureCellImportSchema: retainedGasPressureCellImport?.schema || null,
      retainedGasPressureCellImportStatus: retainedGasPressureCellImport?.status || null,
      pressureModelId,
      algorithmContactPairResponseSchema: summary.algorithmContactPairResponseSchema,
      algorithmContactPairResponseStatus: summary.algorithmContactPairResponseStatus,
      algorithmContactSummarySource,
      algorithmContactSummaryObserved,
      forceAggregateSummaryObserved: summary.forceAggregateObserved === true,
      forceRowSummaryStatus: summary.forceRowSummaryStatus,
      algorithmContactPolicyRowsSchema: algorithmMaterialContactRows?.schema ?? null,
      algorithmContactPolicyRowsStatus: algorithmMaterialContactRows?.status ?? null,
      algorithmContactPolicyRowCount: summary.algorithmContactPolicyRowCount,
      algorithmContactDomainPairRowCount: packedContactPolicy.domainPairRowCount,
      algorithmContactBodySpecificWithoutDomainPairRowCount:
        packedContactPolicy.bodySpecificWithoutDomainPairRowCount,
      algorithmContactDomainPairGpuSelectionReady:
        packedContactPolicy.domainPairGpuSelectionReady,
      algorithmContactDomainPairGpuSelectionStatus:
        packedContactPolicy.domainPairGpuSelectionStatus,
      algorithmContactForceRowCount: summary.algorithmContactForceRowCount,
      algorithmContactPairKeys: summary.algorithmContactPairKeys,
      algorithmContactPressureRangePa: summary.algorithmContactPressureRangePa,
      maxAlgorithmContactPressurePa: summary.maxAlgorithmContactPressurePa,
      algorithmContactPairResponseScale: contactPolicy.responseScale,
      algorithmContactMaxPressurePa: contactPolicy.maxContactPressurePa,
      interfaceContactKinematicsSchema: summary.interfaceContactKinematicsSchema,
      interfaceContactKinematicsStatus: summary.interfaceContactKinematicsStatus,
      interfaceContactKinematicsRowCount: summary.interfaceContactKinematicsRowCount,
      interfaceContactKinematicsReadyCount: summary.interfaceContactKinematicsReadyCount,
      interfaceContactKinematicsDomainPairReadyCount:
        sharedSpatialGenerationSupplied
          ? (sharedSpatialExactNearFailClosed ? 0 : null)
          : packedContactKinematics.domainPairReadyCount,
      interfaceContactKinematicsGpuDerivationEligible: contactKinematicsGpuDerivationEligible,
      interfaceContactKinematicsGpuDerived: contactKinematicsGpuDerived,
      interfaceContactKinematicsDerivationStatus: contactKinematicsGpuDerivation?.status
        || (contactKinematicsGpuDerivationEligible
            ? 'interface-contact-kinematics-gpu-derivation-not-run'
            : 'interface-contact-kinematics-uses-element-fields-or-unavailable'),
      interfaceContactKinematicsDerivation: contactKinematicsGpuDerivation?.derivation || null,
      interfaceContactKinematicsParticleSourceStatus: particleSource.status,
      interfaceContactKinematicsParticleCount: particleSource.particleCount,
      interfaceContactKinematicsParticleIdentityReady: particleSource.identityReady === true,
      interfaceContactKinematicsParticleIdentityRequired: particleSource.identityRequired === true,
      interfaceContactKinematicsParticleIdentityBufferConsumed:
        contactKinematicsGpuDerivation?.particleIdentityBufferConsumed === true,
      interfaceContactKinematicsParticleSourceDeviceId: particleSource.sourceDeviceId,
      interfaceContactKinematicsConsumerDeviceId: particleSource.consumerDeviceId,
      interfaceContactKinematicsParticleBinGridStatus: contactKinematicsGpuDerivation?.particleBinGridStatus || contactKinematicsParticleBinGrid?.status || null,
      interfaceContactKinematicsParticleBinGridEnabled: contactKinematicsGpuDerivation?.particleBinGridEnabled === true,
      interfaceContactKinematicsParticleBinGridCellCount:
        contactKinematicsGpuDerivation?.particleBinGridCellCount
        ?? contactKinematicsParticleBinGrid?.cellCount
        ?? 0,
      interfaceContactKinematicsParticleBinGridBinCapacity:
        contactKinematicsGpuDerivation?.particleBinGridBinCapacity
        ?? contactKinematicsParticleBinGrid?.binCapacity
        ?? 0,
      interfaceContactKinematicsParticleBinGridAverageOccupancy:
        contactKinematicsGpuDerivation?.particleBinGridAverageOccupancy
        ?? contactKinematicsParticleBinGrid?.averageOccupancy
        ?? 0,
      interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk:
        contactKinematicsGpuDerivation
          ? contactKinematicsGpuDerivation.particleBinGridEstimatedOverflowRisk === true
          : contactKinematicsParticleBinGrid?.estimatedOverflowRisk === true,
      interfaceContactKinematicsParticleBinGridIndexBufferByteLength:
        contactKinematicsGpuDerivation?.particleBinGridIndexBufferByteLength
        ?? contactKinematicsParticleBinGrid?.indexBufferByteLength
        ?? 0,
      interfaceContactKinematicsParticleBinOverflowStatus: particleBinOverflowStatus,
      interfaceContactKinematicsParticleBinOverflowCount: particleBinOverflowCount,
      schroederSpatialExactNearViewSchema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_VIEW_SCHEMA,
      schroederSpatialExactNearSourceStatus: schroederPressureInterfaceSpatialSource.status,
      schroederSpatialExactNearSourceReason: schroederPressureInterfaceSpatialSource.reason,
      schroederSpatialExactNearSourceReady:
        schroederPressureInterfaceSpatialSource.ready === true,
      schroederSpatialExactNearInterfaceProvenanceStatus:
        schroederPressureInterfaceSpatialProvenance.status,
      schroederSpatialExactNearInterfaceProvenanceReason:
        schroederPressureInterfaceSpatialProvenance.reason,
      schroederSpatialExactNearInterfaceProvenanceReady:
        schroederPressureInterfaceSpatialProvenance.ready === true,
      schroederSpatialExactNearSelectionStatus: contactKinematicsSpatialBuild?.status
        ?? (schroederPressureInterfaceSpatialSource.ready
            ? schroederPressureInterfaceSpatialProvenance.status
            : schroederPressureInterfaceSpatialSource.status),
      schroederSpatialExactNearSelected: contactKinematicsSpatialBuild?.selected === true,
      schroederSpatialExactNearGenerationSupplied:
        schroederSpatialEpochGeneration != null,
      schroederSpatialExactNearHostAdmissionStatus:
        schroederPressureInterfaceSharedSpatialGeneration.status,
      schroederSpatialExactNearHostAdmissionReason:
        schroederPressureInterfaceSharedSpatialGeneration.reason,
      schroederSpatialExactNearBorrowedGeneration:
        contactKinematicsSpatialBuild?.borrowed === true,
      schroederSpatialExactNearDirectoryOwnership:
        contactKinematicsSpatialBuild?.directoryOwnership ?? null,
      schroederSpatialExactNearConsumerReleaseAuthority:
        contactKinematicsSpatialBuild?.borrowed === true
          ? 'generation-owner'
          : null,
      schroederSpatialExactNearGenerationId:
        contactKinematicsSpatialBuild?.execution?.generationId ?? null,
      schroederSpatialExactNearArenaIndex:
        contactKinematicsSpatialBuild?.execution?.arenaIndex ?? null,
      schroederSpatialExactNearRuntimeCapacity:
        contactKinematicsSpatialBuild?.runtimeCapacity ?? null,
      schroederSpatialExactNearRuntimeCacheHit:
        contactKinematicsSpatialBuild?.runtimeCacheHit === true,
      schroederSpatialExactNearDirectoryBuildCount:
        contactKinematicsSpatialBuild?.directoryBuildCount ?? 0,
      schroederSpatialExactNearSharedGenerationDirectoryBuildCount:
        contactKinematicsSpatialBuild?.sharedGenerationDirectoryBuildCount ?? 0,
      schroederSpatialExactNearLookupMode:
        contactKinematicsGpuDerivation?.spatialExactNearDirectoryLookupMode ?? null,
      schroederSpatialExactNearCandidateBudget:
        contactKinematicsGpuDerivation?.spatialExactNearCandidateBudget ?? null,
      schroederSpatialExactNearPrivateParticleBinBuildSuppressed:
        contactKinematicsGpuDerivation?.spatialExactNearPrivateParticleBinBuildSuppressed === true,
      schroederSpatialExactNearPrivateParticleBinBuildCount:
        contactKinematicsSpatialBuild?.selected === true ? 0 : (contactKinematicsParticleBins?.enabled ? 1 : 0),
      schroederSpatialExactNearFixedCandidateBuildCount: 0,
      schroederSpatialExactNearExhaustiveParticleScanCount: 0,
      schroederSpatialExactNearGpuHeaderAdmission:
        contactKinematicsGpuDerivation?.spatialExactNearGpuHeaderAdmission ?? null,
      schroederSpatialExactNearGpuQueryEvidenceRequired:
        contactKinematicsGpuDerivation?.spatialExactNearGpuQueryEvidenceRequired === true,
      schroederSpatialExactNearGpuQueryEvidenceSourceAdapterId:
        contactKinematicsGpuDerivation
          ?.spatialExactNearGpuQueryEvidenceSourceAdapterId ?? null,
      schroederSpatialExactNearGpuQueryEvidenceEnforcementStatus:
        contactKinematicsGpuDerivation
          ?.spatialExactNearGpuQueryEvidenceEnforcementStatus ?? null,
      schroederSpatialExactNearGpuAdmissionObserved:
        contactKinematicsGpuDerivation?.spatialExactNearGpuAdmissionObserved === true,
      schroederSpatialExactNearGpuAdmissionStatus:
        contactKinematicsGpuDerivation?.spatialExactNearGpuAdmissionStatus ?? null,
      schroederSpatialExactNearGpuFallbackObserved:
        contactKinematicsGpuDerivation?.spatialExactNearGpuFallbackObserved ?? null,
      schroederSpatialExactNearArenaReleaseStatus:
        contactKinematicsSpatialBuild?.releaseStatus ?? null,
      interfaceSourceKeySchema: contactKinematicsGpuDerivation?.interfaceSourceKeySchema
        ?? packedInterfaceSourceKeys.schema,
      interfaceSourceKeySourceStatus: contactKinematicsGpuDerivation?.interfaceSourceKeySourceStatus
        ?? packedInterfaceSourceKeys.status,
      interfaceSourceKeyStatus: contactKinematicsGpuDerivation?.interfaceSourceKeyStatus
        ?? packedInterfaceSourceKeys.status,
      interfaceSourceKeyConsumerStatus: contactKinematicsGpuDerivation?.interfaceSourceKeyConsumerStatus
        ?? null,
      interfaceSourceKeyReason: contactKinematicsGpuDerivation?.interfaceSourceKeyReason
        ?? null,
      interfaceSourceKeyRowCount: contactKinematicsGpuDerivation?.interfaceSourceKeyRowCount
        ?? packedInterfaceSourceKeys.rowCount,
      interfaceSourceKeyReadyCount: contactKinematicsGpuDerivation?.interfaceSourceKeyReadyCount
        ?? packedInterfaceSourceKeys.readyCount,
      interfaceSourceKeyStrideFloats: contactKinematicsGpuDerivation?.interfaceSourceKeyStrideFloats
        ?? packedInterfaceSourceKeys.rowStrideFloats,
      interfaceSourceKeyBufferObserved: contactKinematicsGpuDerivation?.interfaceSourceKeyBufferObserved === true
        || Boolean(packedInterfaceSourceKeys.sourceKeyBuffer),
      interfaceSourceKeyBufferConsumed: contactKinematicsGpuDerivation?.interfaceSourceKeyBufferConsumed === true,
      interfaceSourceKeySurfaceIndexFallbackEnabled:
        contactKinematicsGpuDerivation?.interfaceSourceKeySurfaceIndexFallbackEnabled !== false,
      schroederLawQueueSchema: contactKinematicsGpuDerivation?.schroederLawQueueSchema
        ?? schroederPressureInterfaceLawQueue.sourceSchema,
      schroederLawQueueSourceStatus: contactKinematicsGpuDerivation?.schroederLawQueueSourceStatus
        ?? schroederPressureInterfaceLawQueue.sourceStatus,
      schroederLawQueueStatus: contactKinematicsGpuDerivation?.schroederLawQueueStatus
        ?? schroederPressureInterfaceLawQueue.status,
      schroederLawQueueConsumerStatus: contactKinematicsGpuDerivation?.schroederLawQueueConsumerStatus
        ?? schroederPressureInterfaceLawQueue.consumerStatus,
      schroederLawQueueReason: contactKinematicsGpuDerivation?.schroederLawQueueReason
        ?? schroederPressureInterfaceLawQueue.reason,
      schroederLawQueueEnabled: contactKinematicsGpuDerivation?.schroederLawQueueEnabled === true
        || schroederPressureInterfaceLawQueue.enabled === true,
      schroederLawQueueActiveNodeCount: contactKinematicsGpuDerivation?.schroederLawQueueActiveNodeCount
        ?? schroederPressureInterfaceLawQueue.activeNodeCount,
      schroederLawQueueStrideFloats: contactKinematicsGpuDerivation?.schroederLawQueueStrideFloats
        ?? schroederPressureInterfaceLawQueue.lawQueueStrideFloats,
      schroederLawQueueEnabledLawMask: contactKinematicsGpuDerivation?.schroederLawQueueEnabledLawMask
        ?? schroederPressureInterfaceLawQueue.enabledLawMask,
      schroederLawQueueContactInterfaceMask: contactKinematicsGpuDerivation?.schroederLawQueueContactInterfaceMask
        ?? schroederPressureInterfaceLawQueue.contactInterfaceMask,
      schroederLawQueueBufferConsumed: contactKinematicsGpuDerivation?.schroederLawQueueBufferConsumed === true,
      schroederLawQueueSourceDeviceId: contactKinematicsGpuDerivation?.schroederLawQueueSourceDeviceId
        ?? schroederPressureInterfaceLawQueue.sourceDeviceId,
      schroederLawQueueConsumerDeviceId: contactKinematicsGpuDerivation?.schroederLawQueueConsumerDeviceId
        ?? schroederPressureInterfaceLawQueue.consumerDeviceId,
      schroederLawNeighborCandidateSchema: schroederPressureInterfaceLawNeighborCandidates.sourceSchema,
      schroederLawNeighborCandidateSourceStatus: schroederPressureInterfaceLawNeighborCandidates.sourceStatus,
      schroederLawNeighborCandidateStatus: schroederPressureInterfaceLawNeighborCandidates.status,
      schroederLawNeighborCandidateConsumerStatus: schroederPressureInterfaceLawNeighborCandidates.consumerStatus,
      schroederLawNeighborCandidateReason: schroederPressureInterfaceLawNeighborCandidates.reason,
      schroederLawNeighborCandidateAvailable: schroederPressureInterfaceLawNeighborCandidates.available === true,
      schroederLawNeighborCandidateAuthoritative: schroederPressureInterfaceLawNeighborCandidates.authoritative === true,
      schroederLawNeighborCandidateCount: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateCount,
      schroederLawNeighborCandidateStrideFloats: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateStrideFloats,
      schroederLawNeighborCandidateBudget: schroederPressureInterfaceLawNeighborCandidates.candidateBudget,
      schroederLawNeighborCandidateLawQueueCount: schroederPressureInterfaceLawNeighborCandidates.lawQueueCount,
      schroederLawNeighborCandidateEnabledLawMask: schroederPressureInterfaceLawNeighborCandidates.enabledLawMask,
      schroederLawNeighborCandidateContactInterfaceMask: schroederPressureInterfaceLawNeighborCandidates.contactInterfaceMask,
      schroederLawNeighborCandidateEnumerationMode: schroederPressureInterfaceLawNeighborCandidates.enumerationMode,
      schroederLawNeighborCandidateTreeTraversalStatus: schroederPressureInterfaceLawNeighborCandidates.treeTraversalStatus,
      schroederLawNeighborCandidateBufferObserved: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateBufferObserved === true,
      schroederLawNeighborCandidateBufferConsumed: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateBufferConsumed === true,
      schroederLawNeighborSourceSpanBufferObserved:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanBufferObserved === true,
      schroederLawNeighborSourceSpanBufferConsumed:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanBufferConsumed === true,
      schroederLawNeighborSourceSpanCount:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanCount,
      schroederLawNeighborSourceSpanStrideFloats:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanStrideFloats,
      schroederLawNeighborSourceSpanConsumerStatus:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanConsumerStatus,
      schroederLawNeighborSourceSpanReason:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanReason,
      pressureInterfaceSpatialIndexStatus:
        contactKinematicsGpuDerivation?.pressureInterfaceSpatialIndexStatus
        ?? schroederPressureInterfaceLawNeighborCandidates.pressureInterfaceSpatialIndexStatus,
      pressureInterfaceSpatialIndexMode:
        contactKinematicsGpuDerivation?.pressureInterfaceSpatialIndexMode
        ?? schroederPressureInterfaceLawNeighborCandidates.pressureInterfaceSpatialIndexMode,
      pressureInterfaceBroadCandidateScanFallback:
        contactKinematicsGpuDerivation?.pressureInterfaceBroadCandidateScanFallback === true
        || schroederPressureInterfaceLawNeighborCandidates.broadCandidateScanFallback === true,
      schroederLawNeighborCandidateSourceDeviceId: schroederPressureInterfaceLawNeighborCandidates.sourceDeviceId,
      schroederLawNeighborCandidateConsumerDeviceId: schroederPressureInterfaceLawNeighborCandidates.consumerDeviceId,
      sourceInterfaceElementCount: materialInterfaceField?.elementCount ?? materialInterfaceField?.elements?.length ?? packed.rowCount,
      forceRowCount: packed.rowCount,
      forceRowLayout: [...SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT],
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
      forceRows: noFullReadback ? [] : summary.forceRows,
      forceRowValues,
      forceRowsBufferRetained: retainForceRowsBuffer === true,
      surfaceForceCount: summary.surfaceForceCount,
      surfaceForces: summary.surfaceForces,
      totalInterfaceAreaM2: sharedSpatialGenerationSupplied
        ? summary.totalInterfaceAreaM2
        : (materialInterfaceField?.totalSurfaceAreaM2 ?? summary.totalInterfaceAreaM2),
      totalAbsMaterialForceN: summary.totalAbsMaterialForceN,
      netMaterialForceN: summary.netMaterialForceN,
      netGasReactionForceN: summary.netGasReactionForceN,
      conservationResidualN: summary.conservationResidualN,
      conservationResidualMagnitudeN: summary.conservationResidualMagnitudeN,
      maxPairResidualN: summary.maxPairResidualN,
      conservationStatus: summary.forceAggregateObserved !== true
        ? 'not-observed-gpu-force-rows-not-read-back'
        : (summary.maxPairResidualN <= 1e-9
            ? 'pairwise-equal-opposite-force-conservative'
            : 'pairwise-force-residual-nonzero'),
      forceDerivation: pressureModelId === 1
        ? `webgpu-local-gas-cell-pressure-gradient-interface-normal-area-with-equal-opposite-gas-reaction${forceDerivationSuffix}`
        : `webgpu-uniform-gas-pressure-interface-normal-area-with-equal-opposite-gas-reaction${forceDerivationSuffix}`,
      forceResolution: pressureModelId === 1
        ? `local-gradient-interface-traction${forceResolutionSuffix}`
        : `uniform-interface-traction${forceResolutionSuffix}`,
      forceApplicationTarget: 'pending-mls-mpm-grid-force-consumer',
      localPressureGradientValidation: pressureModelId === 1,
      forceCouplingValidation: false,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    const result = {
      backend: 'webgpu',
      status: 'pressure-interface-stage-solver-ready',
      executionSource: 'sphPressureInterfaceForceRowsWebGpu',
      readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback,
      normalHotLoopReadbackFree: noFullReadback,
      queueCompletionStatus,
      queueCompletionMethod,
      pressureInterfaceForcePreview,
      pressureInterfaceForceSolver: solver,
      forceRowCount: packed.rowCount,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
      forceRowByteLength: outputByteLength,
      gasPressureCellRowCount: packedGasPressureCells.rowCount,
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowByteLength: packedGasPressureCells.rowByteLength,
      gasPressureCellRowsBufferRetained:
        (retainForceRowsBuffer === true || retainedGasPressureRowsReady) && packedGasPressureCells.rowCount > 0,
      gasPressureCellRowsBufferBorrowed: retainedGasPressureRowsReady,
      retainedGasPressureCellImportSchema: retainedGasPressureCellImport?.schema || null,
      retainedGasPressureCellImportStatus: retainedGasPressureCellImport?.status || null,
      algorithmContactPolicyRowCount: packedContactPolicy.rowCount,
      algorithmContactPolicyRowByteLength: packedContactPolicy.rowByteLength,
      algorithmContactDomainPairRowCount: packedContactPolicy.domainPairRowCount,
      algorithmContactDomainPairGpuSelectionReady:
        packedContactPolicy.domainPairGpuSelectionReady,
      algorithmContactDomainPairGpuSelectionStatus:
        packedContactPolicy.domainPairGpuSelectionStatus,
      interfaceContactKinematicsRowCount: packedContactKinematics.rowCount,
      interfaceContactKinematicsReadyCount: sharedSpatialGenerationSupplied
        ? summary.interfaceContactKinematicsReadyCount
        : packedContactKinematics.readyCount,
      interfaceContactKinematicsDomainPairReadyCount:
        sharedSpatialGenerationSupplied
          ? (sharedSpatialExactNearFailClosed ? 0 : null)
          : packedContactKinematics.domainPairReadyCount,
      interfaceContactKinematicsRowByteLength: packedContactKinematics.rowByteLength,
      interfaceContactKinematicsGpuDerivationEligible: contactKinematicsGpuDerivationEligible,
      interfaceContactKinematicsGpuDerived: contactKinematicsGpuDerived,
      interfaceContactKinematicsDerivationStatus: contactKinematicsGpuDerivation?.status
        || (contactKinematicsGpuDerivationEligible
            ? 'interface-contact-kinematics-gpu-derivation-not-run'
            : 'interface-contact-kinematics-uses-element-fields-or-unavailable'),
      interfaceContactKinematicsParticleSourceStatus: particleSource.status,
      interfaceContactKinematicsParticleCount: particleSource.particleCount,
      interfaceContactKinematicsParticleIdentityReady: particleSource.identityReady === true,
      interfaceContactKinematicsParticleIdentityRequired: particleSource.identityRequired === true,
      interfaceContactKinematicsParticleBinGridStatus: contactKinematicsGpuDerivation?.particleBinGridStatus || contactKinematicsParticleBinGrid?.status || null,
      interfaceContactKinematicsParticleBinGridEnabled: contactKinematicsGpuDerivation?.particleBinGridEnabled === true,
      interfaceContactKinematicsParticleBinGridCellCount:
        contactKinematicsGpuDerivation?.particleBinGridCellCount
        ?? contactKinematicsParticleBinGrid?.cellCount
        ?? 0,
      interfaceContactKinematicsParticleBinGridBinCapacity:
        contactKinematicsGpuDerivation?.particleBinGridBinCapacity
        ?? contactKinematicsParticleBinGrid?.binCapacity
        ?? 0,
      interfaceContactKinematicsParticleBinGridAverageOccupancy:
        contactKinematicsGpuDerivation?.particleBinGridAverageOccupancy
        ?? contactKinematicsParticleBinGrid?.averageOccupancy
        ?? 0,
      interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk:
        contactKinematicsGpuDerivation
          ? contactKinematicsGpuDerivation.particleBinGridEstimatedOverflowRisk === true
          : contactKinematicsParticleBinGrid?.estimatedOverflowRisk === true,
      interfaceContactKinematicsParticleBinGridIndexBufferByteLength:
        contactKinematicsGpuDerivation?.particleBinGridIndexBufferByteLength
        ?? contactKinematicsParticleBinGrid?.indexBufferByteLength
        ?? 0,
      interfaceContactKinematicsParticleBinOverflowStatus: particleBinOverflowStatus,
      interfaceContactKinematicsParticleBinOverflowCount: particleBinOverflowCount,
      schroederSpatialExactNearViewSchema: solver.schroederSpatialExactNearViewSchema,
      schroederSpatialExactNearSourceStatus: solver.schroederSpatialExactNearSourceStatus,
      schroederSpatialExactNearSourceReason: solver.schroederSpatialExactNearSourceReason,
      schroederSpatialExactNearSourceReady: solver.schroederSpatialExactNearSourceReady,
      schroederSpatialExactNearInterfaceProvenanceStatus:
        solver.schroederSpatialExactNearInterfaceProvenanceStatus,
      schroederSpatialExactNearInterfaceProvenanceReason:
        solver.schroederSpatialExactNearInterfaceProvenanceReason,
      schroederSpatialExactNearInterfaceProvenanceReady:
        solver.schroederSpatialExactNearInterfaceProvenanceReady,
      schroederSpatialExactNearSelectionStatus:
        solver.schroederSpatialExactNearSelectionStatus,
      schroederSpatialExactNearSelected: solver.schroederSpatialExactNearSelected,
      schroederSpatialExactNearGenerationSupplied:
        solver.schroederSpatialExactNearGenerationSupplied,
      schroederSpatialExactNearHostAdmissionStatus:
        solver.schroederSpatialExactNearHostAdmissionStatus,
      schroederSpatialExactNearHostAdmissionReason:
        solver.schroederSpatialExactNearHostAdmissionReason,
      schroederSpatialExactNearBorrowedGeneration:
        solver.schroederSpatialExactNearBorrowedGeneration,
      schroederSpatialExactNearDirectoryOwnership:
        solver.schroederSpatialExactNearDirectoryOwnership,
      schroederSpatialExactNearConsumerReleaseAuthority:
        solver.schroederSpatialExactNearConsumerReleaseAuthority,
      schroederSpatialExactNearGenerationId: solver.schroederSpatialExactNearGenerationId,
      schroederSpatialExactNearArenaIndex: solver.schroederSpatialExactNearArenaIndex,
      schroederSpatialExactNearRuntimeCapacity: solver.schroederSpatialExactNearRuntimeCapacity,
      schroederSpatialExactNearRuntimeCacheHit: solver.schroederSpatialExactNearRuntimeCacheHit,
      schroederSpatialExactNearDirectoryBuildCount:
        solver.schroederSpatialExactNearDirectoryBuildCount,
      schroederSpatialExactNearSharedGenerationDirectoryBuildCount:
        solver.schroederSpatialExactNearSharedGenerationDirectoryBuildCount,
      schroederSpatialExactNearLookupMode: solver.schroederSpatialExactNearLookupMode,
      schroederSpatialExactNearCandidateBudget:
        solver.schroederSpatialExactNearCandidateBudget,
      schroederSpatialExactNearPrivateParticleBinBuildSuppressed:
        solver.schroederSpatialExactNearPrivateParticleBinBuildSuppressed,
      schroederSpatialExactNearPrivateParticleBinBuildCount:
        solver.schroederSpatialExactNearPrivateParticleBinBuildCount,
      schroederSpatialExactNearFixedCandidateBuildCount:
        solver.schroederSpatialExactNearFixedCandidateBuildCount,
      schroederSpatialExactNearExhaustiveParticleScanCount:
        solver.schroederSpatialExactNearExhaustiveParticleScanCount,
      schroederSpatialExactNearGpuHeaderAdmission:
        solver.schroederSpatialExactNearGpuHeaderAdmission,
      schroederSpatialExactNearGpuQueryEvidenceRequired:
        solver.schroederSpatialExactNearGpuQueryEvidenceRequired,
      schroederSpatialExactNearGpuQueryEvidenceSourceAdapterId:
        solver.schroederSpatialExactNearGpuQueryEvidenceSourceAdapterId,
      schroederSpatialExactNearGpuQueryEvidenceEnforcementStatus:
        solver.schroederSpatialExactNearGpuQueryEvidenceEnforcementStatus,
      schroederSpatialExactNearGpuAdmissionObserved:
        solver.schroederSpatialExactNearGpuAdmissionObserved,
      schroederSpatialExactNearGpuAdmissionStatus:
        solver.schroederSpatialExactNearGpuAdmissionStatus,
      schroederSpatialExactNearGpuFallbackObserved:
        solver.schroederSpatialExactNearGpuFallbackObserved,
      schroederSpatialExactNearArenaReleaseStatus:
        contactKinematicsSpatialBuild?.releaseStatus ?? solver.schroederSpatialExactNearArenaReleaseStatus,
      interfaceSourceKeyStatus: solver.interfaceSourceKeyStatus,
      interfaceSourceKeyConsumerStatus: solver.interfaceSourceKeyConsumerStatus,
      interfaceSourceKeyRowCount: solver.interfaceSourceKeyRowCount,
      interfaceSourceKeyReadyCount: solver.interfaceSourceKeyReadyCount,
      interfaceSourceKeyBufferObserved: solver.interfaceSourceKeyBufferObserved,
      interfaceSourceKeyBufferConsumed: solver.interfaceSourceKeyBufferConsumed,
      interfaceSourceKeySurfaceIndexFallbackEnabled:
        solver.interfaceSourceKeySurfaceIndexFallbackEnabled,
      schroederLawQueueStatus: contactKinematicsGpuDerivation?.schroederLawQueueStatus
        ?? schroederPressureInterfaceLawQueue.status,
      schroederLawQueueConsumerStatus: contactKinematicsGpuDerivation?.schroederLawQueueConsumerStatus
        ?? schroederPressureInterfaceLawQueue.consumerStatus,
      schroederLawQueueBufferConsumed: contactKinematicsGpuDerivation?.schroederLawQueueBufferConsumed === true,
      schroederLawNeighborCandidateStatus: schroederPressureInterfaceLawNeighborCandidates.status,
      schroederLawNeighborCandidateConsumerStatus: schroederPressureInterfaceLawNeighborCandidates.consumerStatus,
      schroederLawNeighborCandidateBufferObserved:
        schroederPressureInterfaceLawNeighborCandidates.neighborCandidateBufferObserved === true,
      schroederLawNeighborCandidateBufferConsumed:
        schroederPressureInterfaceLawNeighborCandidates.neighborCandidateBufferConsumed === true,
      schroederLawNeighborCandidateAvailable: schroederPressureInterfaceLawNeighborCandidates.available === true,
      schroederLawNeighborCandidateAuthoritative: schroederPressureInterfaceLawNeighborCandidates.authoritative === true,
      schroederLawNeighborCandidateCount: schroederPressureInterfaceLawNeighborCandidates.neighborCandidateCount,
      schroederLawNeighborSourceSpanBufferObserved:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanBufferObserved === true,
      schroederLawNeighborSourceSpanBufferConsumed:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanBufferConsumed === true,
      schroederLawNeighborSourceSpanCount:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanCount,
      schroederLawNeighborSourceSpanConsumerStatus:
        schroederPressureInterfaceLawNeighborCandidates.sourceCandidateSpanConsumerStatus,
      pressureInterfaceSpatialIndexStatus:
        contactKinematicsGpuDerivation?.pressureInterfaceSpatialIndexStatus
        ?? schroederPressureInterfaceLawNeighborCandidates.pressureInterfaceSpatialIndexStatus,
      pressureInterfaceSpatialIndexMode:
        contactKinematicsGpuDerivation?.pressureInterfaceSpatialIndexMode
        ?? schroederPressureInterfaceLawNeighborCandidates.pressureInterfaceSpatialIndexMode,
      forceRowValues,
      pressureInterfaceForceRowsRetained: outputByteLength > 0
    };
    if (retainForceRowsBuffer) {
      result.forceRowsBuffer = forceRowsBuffer;
      result.forceRowsBufferByteLength = outputByteLength;
      result.destroyForceRowsBuffer = () => forceRowsBuffer.destroy?.();
      returnedRetainedForceRowsBuffer = true;
    }
    if ((retainForceRowsBuffer || retainedGasPressureRowsReady) && packedGasPressureCells.rowCount > 0) {
      result.gasPressureCellsBuffer = gasPressureCellsBuffer;
      result.gasPressureCellRowsBufferByteLength = packedGasPressureCells.rowByteLength;
      result.destroyGasPressureCellsBuffer = retainedGasPressureRowsReady
        ? null
        : () => gasPressureCellsBuffer.destroy?.();
      returnedRetainedGasPressureCellsBuffer = true;
    }
    returnedResultForOwnerCleanup = result;
    return result;
  } finally {
    let cleanupPerformed = false;
    const cleanup = () => {
      if (cleanupPerformed) return false;
      cleanupPerformed = true;
      inputBuffer.destroy?.();
      if (!retainedGasPressureRowsReady && !returnedRetainedGasPressureCellsBuffer) {
        gasPressureCellsBuffer.destroy?.();
      }
      contactPolicyBuffer.destroy?.();
      contactKinematicsBuffer.destroy?.();
      for (const buffer of contactKinematicsCleanupBuffers) buffer?.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
      if (!retainForceRowsBuffer || !returnedRetainedForceRowsBuffer) forceRowsBuffer.destroy?.();
      return true;
    };
    if (
      noFullReadback
      && schroederSpatialEpochGeneration != null
      && sharedSpatialFenceAuthority === 'generation-owner'
      && returnedResultForOwnerCleanup
    ) {
      returnedResultForOwnerCleanup.pressureInterfaceOwnerScopeTemporaryCleanupDelegated = true;
      returnedResultForOwnerCleanup.pressureInterfaceOwnerScopeTemporaryCleanupStatus =
        'pending-generation-owner-final-consumer-fence';
      returnedResultForOwnerCleanup.destroyOwnerScopeTemporaryBuffers = ({
        reason = 'pressure-interface-generation-owner-scope-temporary-cleanup'
      } = {}) => {
        const cleaned = cleanup();
        returnedResultForOwnerCleanup.pressureInterfaceOwnerScopeTemporaryCleanupStatus = cleaned
          ? 'destroyed-after-generation-owner-final-consumer-fence'
          : 'already-destroyed-after-generation-owner-final-consumer-fence';
        returnedResultForOwnerCleanup.pressureInterfaceOwnerScopeTemporaryCleanupReason = reason;
        return cleaned;
      };
    } else if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}
