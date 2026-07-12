import {
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT,
  SPH_INTERFACE_SOURCE_KEY_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphPressureInterfaceContactKinematicsWgsl,
  sphPressureInterfaceResidentContactKinematicsWgsl,
  sphPressureInterfaceParticleBinsWgsl,
  sphPressureInterfaceForceRowsWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuDeviceMismatchInfo } from './sphGpuDeviceIdentity.js';
import { resolveResidentNeighborhoodConsumer } from './residentNeighborhoodConsumer.js';
import {
  SPH_GAS_CELL_EOS_MAGIC,
  SPH_GAS_CELL_EOS_METADATA,
  SPH_GAS_CELL_EOS_METADATA_BYTES,
  SPH_GAS_CELL_EOS_METADATA_WORDS,
  SPH_GAS_CELL_EOS_GPU_STATUS,
  SPH_GAS_CELL_EOS_VERSION,
  ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA
} from './sphSpatialGasCellEosGpu.js';

export const SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS = SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length;
export const SPH_PRESSURE_INTERFACE_FORCE_FLOATS = SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length;
export const SPH_GAS_PRESSURE_CELL_FLOATS = 12;
export const SPH_ALGORITHM_CONTACT_POLICY_FLOATS = 16;
export const SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS = 4;
export const SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH = 144;
export const SPH_PRESSURE_INTERFACE_CONTACT_KINEMATICS_PARAMS_BYTE_LENGTH = 64;
export const SPH_PRESSURE_INTERFACE_LAW_QUEUE_PARAMS_BYTE_LENGTH = 16;
export const SPH_PRESSURE_INTERFACE_LAW_NEIGHBOR_PARAMS_BYTE_LENGTH = 64;
export const SPH_PRESSURE_INTERFACE_SOURCE_SPAN_PARAMS_BYTE_LENGTH = 16;
export const SPH_PRESSURE_INTERFACE_SOURCE_KEY_PARAMS_BYTE_LENGTH = 16;
export const SPH_PRESSURE_INTERFACE_SCATTER_PARAMS_BYTE_LENGTH = 80;
export const ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-pair-response.v0';
export const ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA =
  'peercompute.ulg.sph-interface-contact-kinematics.v0';
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
export const SPH_PRESSURE_INTERFACE_DISABLED_LAW_QUEUE_BYTE_LENGTH =
  SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const SPH_INTERFACE_SOURCE_KEY_FLOATS = SPH_INTERFACE_SOURCE_KEY_ROW_LAYOUT.length;
const RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_BYTES = 40 * Uint32Array.BYTES_PER_ELEMENT;
const LOCAL_PRESSURE_GRADIENT_BLOCKERS = Object.freeze([
  'single-cell-uniform-pressure-field',
  'resident-gas-cell-eos-gradient-not-derived'
]);

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

const PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH = 4 * Float32Array.BYTES_PER_ELEMENT;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function exactPressureBindingResource(buffer, offset = 0, size = null) {
  const byteOffset = Math.max(0, Math.trunc(finiteNumber(offset, 0)));
  const available = Math.max(0, Math.trunc(finiteNumber(buffer?.size, 0)) - byteOffset);
  const byteLength = size == null
    ? available
    : Math.max(0, Math.trunc(finiteNumber(size, available)));
  if (byteLength < Uint32Array.BYTES_PER_ELEMENT || byteLength > available) {
    throw new RangeError(
      `WebGPU pressure binding range [${byteOffset}, ${byteOffset + byteLength}) exceeds `
        + `the available ${available} bytes or the four-byte ABI minimum`
    );
  }
  return { buffer, offset: byteOffset, size: byteLength };
}

function exactPressureBindGroupSignature(layout, entries) {
  return [
    layout,
    ...entries.flatMap(({ binding, resource }) => [
      binding,
      resource.buffer,
      resource.offset ?? 0,
      resource.size ?? null
    ])
  ];
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
        return {
          index,
          pairKey: row?.pairKey ?? null,
          roles: Array.isArray(row?.roles) ? [...row.roles] : [],
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
  for (const row of policy.rows) {
    const materialIdMatch = elementMaterialId > 0 && row.materialIds.some((id) => Math.abs(id - elementMaterialId) < 0.5);
    const materialNameMatch = elementMaterial && row.materials.map(normalizedKey).includes(elementMaterial);
    const phaseIds = row.phaseIds.filter((id) => id > 0);
    const phaseNames = row.phases.map(normalizedKey).filter(Boolean);
    const phaseMatch = phaseIds.length === 0 && phaseNames.length === 0
      ? true
      : ((elementPhaseId > 0 && phaseIds.some((id) => Math.abs(id - elementPhaseId) < 0.5))
          || (elementPhase && phaseNames.includes(elementPhase)));
    if ((materialIdMatch || materialNameMatch) && phaseMatch) {
      const dynamicPressure = algorithmContactPressureForKinematics({ row, element });
      return {
        status: dynamicPressure.status,
        contactPressurePa: dynamicPressure.contactPressurePa,
        row,
        kinematics: dynamicPressure.kinematics,
        dynamicPressure
      };
    }
  }
  return {
    status: 'algorithm-contact-pair-response-no-matching-row',
    contactPressurePa: 0,
    row: null
  };
}

export function packAlgorithmContactPolicyRows(policy = null) {
  const rows = policy?.schema === ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA && Array.isArray(policy.rows)
    ? policy.rows
    : [];
  const values = new Float32Array(rows.length * SPH_ALGORITHM_CONTACT_POLICY_FLOATS);
  for (const [index, row] of rows.entries()) {
    const offset = index * SPH_ALGORITHM_CONTACT_POLICY_FLOATS;
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
      0,
      0,
      0,
      0
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
    rowByteLength: values.byteLength
  };
}

export function packMaterialInterfaceContactKinematicsRows(materialInterfaceField = null) {
  const elements = readyInterfaceElements(materialInterfaceField);
  const rows = new Float32Array(elements.length * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS);
  let readyCount = 0;
  for (const [index, element] of elements.entries()) {
    const kinematics = interfaceContactKinematicsForElement(element);
    if (kinematics.status === 'interface-contact-kinematics-ready') readyCount += 1;
    const offset = index * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS;
    rows.set([
      kinematics.gapM,
      kinematics.normalVelocityMPerS,
      kinematics.representativeMassKg,
      kinematics.ready ? 1 : 0
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
  algorithmContactPairResponseEnabled = false,
  residentCandidateMode = false,
  residentCandidateCapacity = 0,
  residentCandidateDenseCount = 0,
  residentCandidateGuardEnabled = false,
  residentNeighborhoodAdmission = null,
  retainedGasPressureCellMetadata = null
} = {}) {
  const buffer = new ArrayBuffer(SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH);
  const view = new DataView(buffer);
  view.setUint32(0, Math.max(0, Math.round(finiteNumber(elementCount, 0))), true);
  view.setFloat32(4, finiteNumber(pressurePa, 0), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(gasPressureCellCount, 0))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(pressureModelId, 0))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(contactPolicyRowCount, 0))), true);
  view.setFloat32(20, clampPositive(algorithmContactPairResponseScale, DEFAULT_ALGORITHM_CONTACT_PAIR_RESPONSE_SCALE), true);
  view.setFloat32(24, contactPressureCap({ algorithmContactMaxPressurePa }), true);
  view.setFloat32(28, algorithmContactPairResponseEnabled ? 1 : 0, true);
  view.setUint32(32, residentCandidateMode ? 1 : 0, true);
  view.setUint32(36, Math.max(0, Math.round(finiteNumber(residentCandidateCapacity, 0))), true);
  view.setUint32(40, Math.max(0, Math.round(finiteNumber(residentCandidateDenseCount, 0))), true);
  view.setUint32(44, residentCandidateGuardEnabled ? 1 : 0, true);
  const identity = residentNeighborhoodAdmission?.admitted === true
    ? residentNeighborhoodAdmission.expectedIdentity
    : null;
  view.setUint32(48, identity?.generation ?? 0, true);
  view.setUint32(52, identity?.leaseTokenLow ?? 0, true);
  view.setUint32(56, identity?.leaseTokenHigh ?? 0, true);
  view.setUint32(60, identity?.positionEpoch ?? 0, true);
  view.setUint32(64, identity?.sourceCount ?? 0, true);
  view.setUint32(68, identity?.consumerBit ?? 0, true);
  view.setUint32(72, identity ? 1 : 0, true);
  view.setUint32(76, 0, true);
  const gasMetadata = retainedGasPressureCellMetadata?.ready === true
    ? retainedGasPressureCellMetadata
    : null;
  view.setUint32(80, gasMetadata ? 1 : 0, true);
  view.setUint32(84, gasMetadata?.rowCapacity ?? 0, true);
  view.setUint32(88, gasMetadata?.generation ?? 0, true);
  view.setUint32(92, gasMetadata?.laneHashLow ?? 0, true);
  view.setUint32(96, gasMetadata?.laneHashHigh ?? 0, true);
  view.setUint32(100, gasMetadata?.sourceEpoch ?? 0, true);
  view.setUint32(104, gasMetadata?.sourceGeneration ?? 0, true);
  view.setUint32(108, gasMetadata?.gridDims?.[0] ?? 0, true);
  view.setUint32(112, gasMetadata?.gridDims?.[1] ?? 0, true);
  view.setUint32(116, gasMetadata?.gridDims?.[2] ?? 0, true);
  view.setUint32(120, gasMetadata?.gridCellCount ?? 0, true);
  view.setUint32(124, 0, true);
  view.setFloat32(128, gasMetadata?.boxDimsM?.[0] ?? 0, true);
  view.setFloat32(132, gasMetadata?.boxDimsM?.[1] ?? 0, true);
  view.setFloat32(136, gasMetadata?.boxDimsM?.[2] ?? 0, true);
  view.setFloat32(140, 0, true);
  return buffer;
}

function gasCellEosFieldSource(importValue = null) {
  if (!importValue || typeof importValue !== 'object') return null;
  return importValue.retainedGasCellFieldSource
    || importValue.pressureInterfaceGasCellFieldImport?.retainedGasCellFieldSource
    || importValue;
}

function resolveGpuGuardedGasCellField({
  device,
  gpuResidentLaneLeaseIdentity = null,
  expectedGasPressureCellSourceEpoch = null,
  expectedGasPressureCellSourceGeneration = null,
  requireGpuGasCellTaskProvenance = true,
  retainedGasPressureCellImport = null,
  retainedGasPressureCellsBuffer = null,
  retainedGasPressureCellMetadataBuffer = null,
  retainedGasPressureCellLookupBuffer = null,
  retainedGasPressureCellRowCapacity = 0,
  retainedGasPressureCellRowStrideFloats = SPH_GAS_PRESSURE_CELL_FLOATS,
  retainedGasPressureCellGeneration = null,
  retainedGasPressureCellLaneHashLow = null,
  retainedGasPressureCellLaneHashHigh = null,
  retainedGasPressureCellSourceEpoch = null,
  retainedGasPressureCellSourceGeneration = null,
  retainedGasPressureCellGridDims = null,
  retainedGasPressureCellGridCellCount = null,
  retainedGasPressureCellBoxDimsM = null
} = {}) {
  const source = gasCellEosFieldSource(retainedGasPressureCellImport);
  const rowsBuffer = retainedGasPressureCellsBuffer
    || source?.gasPressureCellsBuffer
    || retainedGasPressureCellImport?.gasPressureCellsBuffer
    || null;
  const metadataBuffer = retainedGasPressureCellMetadataBuffer
    || source?.gasPressureCellMetadataBuffer
    || retainedGasPressureCellImport?.gasPressureCellMetadataBuffer
    || null;
  const lookupBuffer = retainedGasPressureCellLookupBuffer
    || source?.gasPressureCellLookupBuffer
    || retainedGasPressureCellImport?.gasPressureCellLookupBuffer
    || null;
  const advertisesGpuGuard = Boolean(
    metadataBuffer
      || lookupBuffer
      || source?.schema === ULG_PRESSURE_INTERFACE_GPU_GAS_CELL_FIELD_SOURCE_SCHEMA
      || retainedGasPressureCellImport?.gpuEvidence?.schema === 'peercompute.ulg.sph-spatial-gas-cell-eos-gpu-evidence.v0'
  );
  if (!advertisesGpuGuard) return { advertised: false, ready: false, source };
  const rowCapacity = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellRowCapacity
      || source?.gasPressureCellRowCapacity
      || retainedGasPressureCellImport?.pressureInterfaceGasPressureCellRowCapacity,
    0
  )));
  const rowStrideFloats = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellRowStrideFloats
      || source?.gasPressureCellRowStrideFloats
      || retainedGasPressureCellImport?.pressureInterfaceGasPressureCellRowStrideFloats,
    SPH_GAS_PRESSURE_CELL_FLOATS
  )));
  const generation = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellGeneration
      ?? source?.generation
      ?? retainedGasPressureCellImport?.generation,
    0
  )));
  const laneHashLow = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellLaneHashLow
      ?? retainedGasPressureCellImport?.laneIdentityHashLow
      ?? retainedGasPressureCellImport?.gpuEvidence?.expectedLaneHashLow,
    0
  ))) >>> 0;
  const laneHashHigh = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellLaneHashHigh
      ?? retainedGasPressureCellImport?.laneIdentityHashHigh
      ?? retainedGasPressureCellImport?.gpuEvidence?.expectedLaneHashHigh,
    0
  ))) >>> 0;
  const sourceEpoch = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellSourceEpoch
      ?? source?.sourceEpoch
      ?? retainedGasPressureCellImport?.sourceEpoch,
    0
  ))) >>> 0;
  const sourceGeneration = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellSourceGeneration
      ?? source?.sourceGeneration
      ?? retainedGasPressureCellImport?.sourceGeneration,
    0
  ))) >>> 0;
  const gridDimsValue = retainedGasPressureCellGridDims
    || source?.gridDims
    || retainedGasPressureCellImport?.gridDims;
  const gridDims = Array.isArray(gridDimsValue) || ArrayBuffer.isView(gridDimsValue)
    ? [0, 1, 2].map((axis) => Math.max(0, Math.trunc(finiteNumber(gridDimsValue[axis], 0))))
    : [0, 0, 0];
  const gridCellCount = Math.max(0, Math.trunc(finiteNumber(
    retainedGasPressureCellGridCellCount
      ?? source?.gridCellCount
      ?? retainedGasPressureCellImport?.gridCellCount,
    0
  )));
  const boxValue = retainedGasPressureCellBoxDimsM
    || source?.boxDimsM
    || retainedGasPressureCellImport?.boxDimsM;
  const boxDims = Array.isArray(boxValue) || ArrayBuffer.isView(boxValue)
    ? [0, 1, 2].map((axis) => finiteNumber(boxValue[axis], 0))
    : [0, 0, 0];
  const failures = [];
  const sourceLaneIdentity = retainedGasPressureCellImport?.gpuResidentLaneLeaseIdentity
    || source?.gpuResidentLaneLeaseIdentity
    || null;
  if (!rowsBuffer) failures.push('gas-pressure-cell-rows-buffer-required');
  if (!metadataBuffer) failures.push('gas-pressure-cell-metadata-buffer-required');
  if (!lookupBuffer) failures.push('gas-pressure-cell-lookup-buffer-required');
  if (rowCapacity < 1) failures.push('gas-pressure-cell-row-capacity-required');
  if (rowStrideFloats !== SPH_GAS_PRESSURE_CELL_FLOATS) failures.push('gas-pressure-cell-row-stride-mismatch');
  if (generation < 1) failures.push('gas-pressure-cell-generation-required');
  if (gridDims.some((value) => value < 1)) failures.push('gas-pressure-cell-grid-dims-required');
  if (gridDims.reduce((product, value) => product * value, 1) !== gridCellCount) {
    failures.push('gas-pressure-cell-grid-count-mismatch');
  }
  if (boxDims.some((value) => !(value > 0))) failures.push('gas-pressure-cell-box-dims-required');
  if (Number(metadataBuffer?.size ?? SPH_GAS_CELL_EOS_METADATA_BYTES) < SPH_GAS_CELL_EOS_METADATA_BYTES) {
    failures.push('gas-pressure-cell-metadata-buffer-too-small');
  }
  if (Number(lookupBuffer?.size ?? gridCellCount * Uint32Array.BYTES_PER_ELEMENT)
    < gridCellCount * Uint32Array.BYTES_PER_ELEMENT) {
    failures.push('gas-pressure-cell-lookup-buffer-too-small');
  }
  if (Number(rowsBuffer?.size ?? rowCapacity * SPH_GAS_PRESSURE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT)
    < rowCapacity * SPH_GAS_PRESSURE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT) {
    failures.push('gas-pressure-cell-rows-buffer-too-small');
  }
  for (const [name, buffer] of [['rows', rowsBuffer], ['metadata', metadataBuffer], ['lookup', lookupBuffer]]) {
    const mismatch = webGpuDeviceMismatchInfo({ buffer, device });
    if (mismatch.mismatch) failures.push(`gas-pressure-cell-${name}-buffer-device-mismatch`);
  }
  if (requireGpuGasCellTaskProvenance) {
    if (
      sourceLaneIdentity?.schema !== 'peercompute.compute.gpu-resident-lane-lease-identity.v0'
      || sourceLaneIdentity?.authoritative !== true
    ) {
      failures.push('gas-pressure-cell-source-lane-lease-identity-required');
    }
    if (
      gpuResidentLaneLeaseIdentity?.schema !== 'peercompute.compute.gpu-resident-lane-lease-identity.v0'
      || gpuResidentLaneLeaseIdentity?.authoritative !== true
    ) {
      failures.push('pressure-consumer-lane-lease-identity-required');
    }
    for (const field of ['leaseId', 'laneId', 'stateKey', 'sourceFamily']) {
      if (sourceLaneIdentity?.[field] !== gpuResidentLaneLeaseIdentity?.[field]) {
        failures.push(`gas-pressure-cell-${field}-mismatch`);
      }
    }
    if (expectedGasPressureCellSourceEpoch == null) {
      failures.push('expected-gas-pressure-cell-source-epoch-required');
    } else if (sourceEpoch !== (Math.max(0, Math.trunc(finiteNumber(expectedGasPressureCellSourceEpoch, 0))) >>> 0)) {
      failures.push('gas-pressure-cell-source-epoch-mismatch');
    }
    if (expectedGasPressureCellSourceGeneration == null) {
      failures.push('expected-gas-pressure-cell-source-generation-required');
    } else if (
      sourceGeneration
      !== (Math.max(0, Math.trunc(finiteNumber(expectedGasPressureCellSourceGeneration, 0))) >>> 0)
    ) {
      failures.push('gas-pressure-cell-source-generation-mismatch');
    }
  }
  return {
    advertised: true,
    ready: failures.length === 0,
    status: failures.length === 0
      ? 'gpu-guarded-gas-pressure-cell-field-ready'
      : 'gpu-guarded-gas-pressure-cell-field-blocked',
    failures,
    source,
    sourceLaneIdentity,
    consumerLaneIdentity: gpuResidentLaneLeaseIdentity,
    rowsBuffer,
    metadataBuffer,
    lookupBuffer,
    rowCapacity,
    rowStrideFloats,
    generation,
    laneHashLow,
    laneHashHigh,
    sourceEpoch,
    sourceGeneration,
    gridDims,
    gridCellCount,
    boxDimsM: boxDims,
    metadataLayout: { ...SPH_GAS_CELL_EOS_METADATA },
    metadataWordCount: SPH_GAS_CELL_EOS_METADATA_WORDS,
    expectedMagic: SPH_GAS_CELL_EOS_MAGIC,
    expectedVersion: SPH_GAS_CELL_EOS_VERSION,
    expectedReadyStatus: SPH_GAS_CELL_EOS_GPU_STATUS.ready,
    consumerAccessProtocol: 'same-device-gpu-metadata-guarded-cell-lookup'
  };
}

function authorityValue(authority, directKey, nestedKey, descriptorPath = null) {
  if (!authority || typeof authority !== 'object') return null;
  if (authority[directKey] != null) return authority[directKey];
  if (authority.expectedIdentity?.[nestedKey] != null) return authority.expectedIdentity[nestedKey];
  if (authority.identity?.[nestedKey] != null) return authority.identity[nestedKey];
  if (!descriptorPath) return null;
  let value = authority.descriptor;
  for (const key of descriptorPath) value = value?.[key];
  return value ?? null;
}

function resolveGpuResidentMaterialInterfaceRows({
  device,
  materialInterfaceField,
  commandEncoder,
  residentNeighborhoodAdmission
} = {}) {
  const candidateRowsBuffer = materialInterfaceField?.candidateRowsBuffer || null;
  const compactMetadataBuffer = materialInterfaceField?.compactMetadataBuffer || null;
  const candidateDispatchIndirectBuffer =
    materialInterfaceField?.candidateDispatchIndirectBuffer || null;
  const advertisesResidentCandidates = materialInterfaceField?.gpuResidentInterfaceCandidates === true
    || materialInterfaceField?.candidateRowsBufferRetained === true
    || candidateRowsBuffer != null;
  if (!advertisesResidentCandidates) return null;
  const failures = [];
  if (!commandEncoder) failures.push('caller-owned-command-encoder-required');
  if (!candidateRowsBuffer) failures.push('candidate-rows-buffer-missing');
  if (!compactMetadataBuffer) failures.push('compact-metadata-buffer-missing');
  if (!candidateDispatchIndirectBuffer) failures.push('candidate-dispatch-indirect-buffer-missing');
  if (materialInterfaceField?.candidateRowsBufferRetained === false) failures.push('candidate-rows-buffer-released');
  if (materialInterfaceField?.compactMetadataBufferRetained === false) failures.push('compact-metadata-buffer-released');
  if (materialInterfaceField?.candidateDispatchIndirectBufferRetained === false) {
    failures.push('candidate-dispatch-indirect-buffer-released');
  }
  const rowStrideFloats = Math.max(0, Math.round(finiteNumber(
    materialInterfaceField?.elementStrideFloats
      ?? materialInterfaceField?.rowStrideFloats,
    0
  )));
  if (rowStrideFloats !== SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS) {
    failures.push('candidate-row-stride-mismatch');
  }
  const rowCapacity = Math.max(0, Math.round(finiteNumber(
    materialInterfaceField?.candidateCompactCapacity
      ?? materialInterfaceField?.compactCandidateCapacity
      ?? materialInterfaceField?.elementCount,
    0
  )));
  if (rowCapacity <= 0) failures.push('candidate-row-capacity-missing');
  const requiredCandidateBytes = rowCapacity
    * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const declaredCandidateBytes = Math.max(0, Math.round(finiteNumber(
    materialInterfaceField?.candidateRowsBufferByteLength
      ?? candidateRowsBuffer?.size,
    0
  )));
  if (declaredCandidateBytes < requiredCandidateBytes) failures.push('candidate-rows-buffer-too-small');
  const declaredMetadataBytes = Math.max(0, Math.round(finiteNumber(
    materialInterfaceField?.compactMetadataBufferByteLength
      ?? compactMetadataBuffer?.size,
    0
  )));
  if (declaredMetadataBytes < 16) failures.push('compact-metadata-buffer-too-small');
  const declaredDispatchBytes = Math.max(0, Math.round(finiteNumber(
    materialInterfaceField?.candidateDispatchIndirectBufferByteLength
      ?? candidateDispatchIndirectBuffer?.size,
    0
  )));
  if (declaredDispatchBytes < 12) failures.push('candidate-dispatch-indirect-buffer-too-small');
  const candidateDispatchIndirectOffsetBytes = Math.max(0, Math.round(finiteNumber(
    materialInterfaceField?.candidateDispatchIndirectOffsetBytes,
    0
  )));
  if (candidateDispatchIndirectOffsetBytes % 4 !== 0) {
    failures.push('candidate-dispatch-indirect-offset-misaligned');
  }
  if (candidateDispatchIndirectOffsetBytes + 12 > declaredDispatchBytes) {
    failures.push('candidate-dispatch-indirect-range-out-of-bounds');
  }
  const dispatchUsage = Number(candidateDispatchIndirectBuffer?.usage);
  if (
    candidateDispatchIndirectBuffer
    && Number.isFinite(dispatchUsage)
    && (dispatchUsage & (GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT))
      !== (GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT)
  ) {
    failures.push('candidate-dispatch-indirect-buffer-usage-invalid');
  }
  const candidateMismatch = webGpuDeviceMismatchInfo({ buffer: candidateRowsBuffer, device });
  const metadataMismatch = webGpuDeviceMismatchInfo({ buffer: compactMetadataBuffer, device });
  const dispatchMismatch = webGpuDeviceMismatchInfo({
    buffer: candidateDispatchIndirectBuffer,
    device
  });
  if (candidateRowsBuffer && candidateMismatch.sourceDeviceId === null) {
    failures.push('candidate-buffer-device-identity-unavailable');
  }
  if (compactMetadataBuffer && metadataMismatch.sourceDeviceId === null) {
    failures.push('metadata-buffer-device-identity-unavailable');
  }
  if (candidateDispatchIndirectBuffer && dispatchMismatch.sourceDeviceId === null) {
    failures.push('candidate-dispatch-buffer-device-identity-unavailable');
  }
  if (candidateMismatch.mismatch) failures.push('candidate-buffer-device-mismatch');
  if (metadataMismatch.mismatch) failures.push('metadata-buffer-device-mismatch');
  if (dispatchMismatch.mismatch) failures.push('candidate-dispatch-buffer-device-mismatch');
  if (!residentNeighborhoodAdmission?.admitted) {
    failures.push('resident-neighborhood-admission-required');
  }
  const expected = residentNeighborhoodAdmission?.expectedIdentity || null;
  const authority = materialInterfaceField?.residentAuthority || null;
  const authorityIdentity = {
    generation: authorityValue(authority, 'generation', 'generation', ['generation']),
    leaseTokenLow: authorityValue(authority, 'leaseTokenLow', 'leaseTokenLow', ['lease', 'tokenLow']),
    leaseTokenHigh: authorityValue(authority, 'leaseTokenHigh', 'leaseTokenHigh', ['lease', 'tokenHigh']),
    positionEpoch: authorityValue(authority, 'positionEpoch', 'positionEpoch', ['positionValidity', 'positionEpoch']),
    sourceCount: authorityValue(authority, 'sourceCount', 'sourceCount', ['capacityEvidence', 'sourceCount']),
    sourceFamily: authorityValue(authority, 'sourceFamily', 'sourceFamily', ['lease', 'sourceFamily'])
  };
  if (!authority) failures.push('candidate-resident-authority-missing');
  if (expected) {
    for (const key of ['generation', 'leaseTokenLow', 'leaseTokenHigh', 'positionEpoch', 'sourceCount', 'sourceFamily']) {
      if (authorityIdentity[key] !== expected[key]) failures.push(`candidate-${key}-mismatch`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`GPU-resident material-interface candidates rejected: ${failures.join(', ')}`);
  }
  return {
    mode: 'gpu-resident-compact-candidate-buffer',
    rows: new Float32Array(),
    elements: [],
    rowCount: rowCapacity,
    rowCapacity,
    rowStrideFloats,
    rowByteLength: requiredCandidateBytes,
    denseCandidateCount: Math.max(0, Math.round(finiteNumber(
      materialInterfaceField?.candidateCount,
      0
    ))),
    candidateRowsBuffer,
    compactMetadataBuffer,
    candidateDispatchIndirectBuffer,
    candidateDispatchIndirectOffsetBytes,
    candidateDispatchIndirectByteLength: declaredDispatchBytes,
    candidateDispatchAuthority: materialInterfaceField?.candidateDispatchAuthority
      ?? 'gpu-finalized-active-count-fail-closed-indirect',
    sourceDeviceId: candidateMismatch.sourceDeviceId,
    consumerDeviceId: candidateMismatch.consumerDeviceId,
    residentAuthority: authorityIdentity,
    metadataGuard: 'active-count-capacity-overflow-gpu-fail-closed',
    activeRowCountPending: true
  };
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

function assertPressureTargetBuffer({
  device,
  buffer,
  name,
  minimumByteLength,
  requiredUsage
}) {
  if (!buffer) return;
  if (Math.max(0, Number(buffer.size) || 0) < minimumByteLength) {
    throw new RangeError(`${name} must provide at least ${minimumByteLength} bytes`);
  }
  const usage = Number(buffer.usage);
  if (Number.isFinite(usage) && (usage & requiredUsage) !== requiredUsage) {
    throw new TypeError(`${name} requires usage mask ${requiredUsage}`);
  }
  const mismatch = webGpuDeviceMismatchInfo({ buffer, device });
  if (mismatch.mismatch) {
    throw new TypeError(`${name} was created on a different WebGPU device`);
  }
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

function createSchroederPressureInterfaceLawNeighborCandidateParamsArray(
  schroederLawNeighborCandidates,
  residentNeighborhoodAdmission = null
) {
  const buffer = new ArrayBuffer(64);
  const view = new DataView(buffer);
  const residentEnabled = residentNeighborhoodAdmission?.admitted === true;
  view.setUint32(
    0,
    residentEnabled ? 2 : (schroederLawNeighborCandidates?.neighborCandidateBufferConsumed ? 1 : 0),
    true
  );
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    residentEnabled
      ? residentNeighborhoodAdmission.descriptor.capacityEvidence.capacity.candidateCount
      : schroederLawNeighborCandidates?.neighborCandidateCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    residentEnabled ? 2 : schroederLawNeighborCandidates?.neighborCandidateStrideFloats,
    SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(
    residentEnabled
      ? residentNeighborhoodAdmission.expectedIdentity.consumerBit
      : schroederLawNeighborCandidates?.contactInterfaceMask,
    SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_MASK
  ))), true);
  const identity = residentNeighborhoodAdmission?.expectedIdentity;
  view.setUint32(16, residentEnabled ? 2 : 0, true);
  view.setUint32(20, identity?.generation ?? 0, true);
  view.setUint32(24, identity?.leaseTokenLow ?? 0, true);
  view.setUint32(28, identity?.leaseTokenHigh ?? 0, true);
  view.setUint32(32, identity?.positionEpoch ?? 0, true);
  view.setUint32(36, identity?.sourceCount ?? 0, true);
  view.setUint32(40, identity?.consumerBit ?? 0, true);
  view.setUint32(44, residentEnabled ? 1 : 0, true);
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
  const resolvedParticleCount = Math.max(0, Math.round(finiteNumber(
    particleCount
      ?? sphParticleUpload?.particleCount
      ?? sphParticleState?.particleCount,
    0
  )));
  if (!stateBuffer || !thermoBuffer || resolvedParticleCount <= 0) {
    return {
      status: 'interface-contact-kinematics-particle-source-unavailable',
      ready: false,
      stateBuffer: null,
      thermoBuffer: null,
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
  if (stateMismatch.mismatch || thermoMismatch.mismatch) {
    return {
      status: 'blocked-cross-device-interface-contact-kinematics-particle-source',
      ready: false,
      stateBuffer: null,
      thermoBuffer: null,
      particleCount: resolvedParticleCount,
      sourceDeviceId: stateMismatch.sourceDeviceId || thermoMismatch.sourceDeviceId,
      consumerDeviceId: stateMismatch.consumerDeviceId || thermoMismatch.consumerDeviceId,
      reason: 'particle state/thermo buffer created on different WebGPU device'
    };
  }
  return {
    status: 'interface-contact-kinematics-particle-source-ready',
    ready: true,
    stateBuffer,
    thermoBuffer,
    particleCount: resolvedParticleCount,
    sourceDeviceId: stateMismatch.sourceDeviceId || thermoMismatch.sourceDeviceId,
    consumerDeviceId: stateMismatch.consumerDeviceId || thermoMismatch.consumerDeviceId,
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
      sourceKeyBuffer: null,
      sourceKeyBufferObserved: true,
      sourceKeyBufferConsumed: false,
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
  particleSource = null
} = {}) {
  const missingRows = (packedContactKinematics?.readyCount ?? 0) < (packedInterfaceElements?.rowCount ?? 0);
  return Boolean(
    missingRows
    && (packedInterfaceElements?.rowCount ?? 0) > 0
    && (packedContactPolicy?.rowCount ?? 0) > 0
    && particleSource?.ready === true
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

export function runSphPressureInterfaceContactKinematicsWebGpu({
  device,
  packedInterfaceElements,
  packedContactPolicy,
  interfaceElementsBuffer,
  candidateDispatchIndirectBuffer = null,
  candidateDispatchIndirectOffsetBytes = 0,
  contactPolicyBuffer,
  particleSource,
  particleBinGrid = null,
  particleBins = null,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  gapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null,
  interfaceSourceKeys = null,
  residentNeighborhood = null,
  residentNeighborhoodValidation = null,
  targetOutputBuffer = null,
  workspaceResources = null,
  commandEncoder = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceContactKinematicsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const callerOwnsEncoder = commandEncoder != null;
  if (callerOwnsEncoder && !commandEncoder?.beginComputePass) {
    throw new TypeError('commandEncoder must be a WebGPU command encoder');
  }
  if (!packedInterfaceElements?.rows || !packedContactPolicy?.rows || !interfaceElementsBuffer || !contactPolicyBuffer || particleSource?.ready !== true) {
    throw new TypeError('runSphPressureInterfaceContactKinematicsWebGpu requires packed interface rows, contact rows, source buffers, and particle buffers');
  }
  const residentNeighborhoodAdmission = residentNeighborhood
    ? resolveResidentNeighborhoodConsumer({
        residentNeighborhood,
        device,
        consumer: 'pressureInterface',
        sourceCount: particleSource.particleCount,
        ...(residentNeighborhoodValidation || {})
      })
    : null;
  if (residentNeighborhood && !residentNeighborhoodAdmission.admitted) {
    throw new Error(
      `pressure/interface resident neighborhood rejected: ${residentNeighborhoodAdmission.reasonCodes.join(', ')}`
    );
  }
  const outputByteLength = Math.max(
    4,
    packedInterfaceElements.rowCount * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS * Float32Array.BYTES_PER_ELEMENT
  );
  assertPressureTargetBuffer({
    device,
    buffer: targetOutputBuffer,
    name: 'targetOutputBuffer',
    minimumByteLength: outputByteLength,
    requiredUsage: GPU_BUFFER_USAGE.STORAGE
  });
  const ownsOutputBuffer = !targetOutputBuffer;
  const outputBuffer = targetOutputBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-contact-kinematics-derived',
      size: outputByteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  const paramsBuffer = workspaceResources?.contactKinematicsParamsBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-contact-kinematics-params',
      size: SPH_PRESSURE_INTERFACE_CONTACT_KINEMATICS_PARAMS_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  const ownsParamsBuffer = !workspaceResources?.contactKinematicsParamsBuffer;
  const paramsByteOffset = workspaceResources?.contactKinematicsParamsByteOffset ?? 0;
  const resolvedParticleBins = residentNeighborhoodAdmission
    ? (workspaceResources?.disabledParticleBins
        ? {
            schema: 'peercompute.ulg.sph-pressure-interface-particle-bin-grid.v0',
            status: 'interface-contact-particle-bin-grid-disabled-workspace',
            reason: 'resident neighborhood path uses workspace-owned disabled bin bindings',
            enabled: false,
            particleBinGrid: null,
            countsBuffer: workspaceResources.disabledParticleBins.countsBuffer,
            indicesBuffer: workspaceResources.disabledParticleBins.indicesBuffer,
            cleanupBuffers: []
          }
        : createDisabledContactParticleBinBuffers(device, null))
    : (particleBins || createDisabledContactParticleBinBuffers(device, particleBinGrid));
  const residentContactKinematicsPath = Boolean(residentNeighborhoodAdmission);
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
  const workspaceSchroederLawQueueBuffer = borrowedSchroederLawQueueBuffer
    ? null
    : workspaceResources?.disabledLawQueueBuffer;
  const localSchroederLawQueueBuffer = borrowedSchroederLawQueueBuffer
    || workspaceSchroederLawQueueBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-schroeder-law-queue-disabled',
      new Float32Array(SCHROEDER_PRESSURE_INTERFACE_LAW_QUEUE_FLOATS)
    );
  const schroederLawQueueBuffer = borrowedSchroederLawQueueBuffer
    || workspaceSchroederLawQueueBuffer
    || localSchroederLawQueueBuffer;
  const schroederLawQueueParamsBuffer = workspaceResources?.lawQueueParamsBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-schroeder-law-queue-params',
      size: SPH_PRESSURE_INTERFACE_LAW_QUEUE_PARAMS_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  const ownsSchroederLawQueueParamsBuffer = !workspaceResources?.lawQueueParamsBuffer;
  const schroederLawQueueParamsByteOffset =
    workspaceResources?.lawQueueParamsByteOffset ?? 0;
  device.queue.writeBuffer(
    schroederLawQueueParamsBuffer,
    schroederLawQueueParamsByteOffset,
    createSchroederPressureInterfaceLawQueueParamsArray(consumedSchroederLawQueue)
  );
  const consumedSchroederLawNeighborCandidates = schroederLawNeighborCandidates?.neighborCandidateBufferConsumed
    ? schroederLawNeighborCandidates
    : (schroederLawNeighborCandidates || null);
  const borrowedSchroederLawNeighborCandidateBuffer = residentNeighborhoodAdmission
    ? residentNeighborhoodAdmission.packedCandidateCsrBuffer
    : (consumedSchroederLawNeighborCandidates?.neighborCandidateBufferConsumed
      ? consumedSchroederLawNeighborCandidates.neighborCandidateBuffer
      : null);
  const localSchroederLawNeighborCandidateBuffer = borrowedSchroederLawNeighborCandidateBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-disabled',
      new Float32Array(SCHROEDER_PRESSURE_INTERFACE_LAW_NEIGHBOR_CANDIDATE_FLOATS)
    );
  const schroederLawNeighborCandidateBuffer = borrowedSchroederLawNeighborCandidateBuffer
    || localSchroederLawNeighborCandidateBuffer;
  const schroederLawNeighborCandidateParamsBuffer = workspaceResources?.lawNeighborParamsBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-schroeder-law-neighbor-candidates-params',
      size: SPH_PRESSURE_INTERFACE_LAW_NEIGHBOR_PARAMS_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  const ownsSchroederLawNeighborCandidateParamsBuffer =
    !workspaceResources?.lawNeighborParamsBuffer;
  const schroederLawNeighborCandidateParamsByteOffset =
    workspaceResources?.lawNeighborParamsByteOffset ?? 0;
  device.queue.writeBuffer(
    schroederLawNeighborCandidateParamsBuffer,
    schroederLawNeighborCandidateParamsByteOffset,
    createSchroederPressureInterfaceLawNeighborCandidateParamsArray(
      consumedSchroederLawNeighborCandidates,
      residentNeighborhoodAdmission
    )
  );
  const borrowedSchroederSourceSpanBuffer = !residentNeighborhoodAdmission
    && consumedSchroederLawNeighborCandidates?.sourceCandidateSpanBufferConsumed
    ? consumedSchroederLawNeighborCandidates.sourceCandidateSpanBuffer
    : null;
  const localSchroederSourceSpanBuffer = borrowedSchroederSourceSpanBuffer
    || residentContactKinematicsPath
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-schroeder-source-spans-disabled',
      new Float32Array(4)
    );
  const schroederSourceSpanBuffer = borrowedSchroederSourceSpanBuffer || localSchroederSourceSpanBuffer;
  const schroederSourceSpanParamsBuffer = workspaceResources?.sourceSpanParamsBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-schroeder-source-spans-params',
      size: SPH_PRESSURE_INTERFACE_SOURCE_SPAN_PARAMS_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  const ownsSchroederSourceSpanParamsBuffer = !workspaceResources?.sourceSpanParamsBuffer;
  const schroederSourceSpanParamsByteOffset =
    workspaceResources?.sourceSpanParamsByteOffset ?? 0;
  device.queue.writeBuffer(
    schroederSourceSpanParamsBuffer,
    schroederSourceSpanParamsByteOffset,
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
  const interfaceSourceKeyBuffer = resolvedInterfaceSourceKeys.sourceKeyBufferConsumed
    ? resolvedInterfaceSourceKeys.sourceKeyBuffer
    : localInterfaceSourceKeyBuffer;
  const interfaceSourceKeyParamsBuffer = workspaceResources?.sourceKeyParamsBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-source-key-params',
      size: SPH_PRESSURE_INTERFACE_SOURCE_KEY_PARAMS_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    }), device);
  const ownsInterfaceSourceKeyParamsBuffer = !workspaceResources?.sourceKeyParamsBuffer;
  const interfaceSourceKeyParamsByteOffset =
    workspaceResources?.sourceKeyParamsByteOffset ?? 0;
  device.queue.writeBuffer(
    interfaceSourceKeyParamsBuffer,
    interfaceSourceKeyParamsByteOffset,
    createPressureInterfaceSourceKeyParamsArray(resolvedInterfaceSourceKeys)
  );
  device.queue.writeBuffer(paramsBuffer, paramsByteOffset, createPressureInterfaceContactKinematicsParamsArray({
    elementCount: packedInterfaceElements.rowCount,
    particleCount: particleSource.particleCount,
    contactPolicyRowCount: packedContactPolicy.rowCount,
    derivationEnabled: true,
    maxSearchRadiusM,
    gapFloorM,
    particleBinGrid: resolvedParticleBins.enabled ? resolvedParticleBins.particleBinGrid : null
  }));
  const contactKinematicsBindings = [
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
    ...(residentContactKinematicsPath
      ? []
      : [computeBufferBinding(12, 'read-only-storage')]),
    computeBufferBinding(13, 'uniform'),
    computeBufferBinding(14, 'read-only-storage'),
    computeBufferBinding(15, 'uniform')
  ];
  const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: residentContactKinematicsPath
      ? 'ulg-sph-pressure-interface-contact-kinematics.resident.v5'
      : 'ulg-sph-pressure-interface-contact-kinematics.v4',
    label: residentContactKinematicsPath
      ? 'ulg-sph-pressure-interface-contact-kinematics-resident'
      : 'ulg-sph-pressure-interface-contact-kinematics',
    code: residentContactKinematicsPath
      ? sphPressureInterfaceResidentContactKinematicsWgsl
      : sphPressureInterfaceContactKinematicsWgsl,
    entryPoint: 'main',
    bindings: contactKinematicsBindings
  });
  const contactPolicyByteOffset = workspaceResources?.contactPolicyByteOffset ?? 0;
  const contactPolicyBindingByteLength = workspaceResources?.contactPolicyByteLength
    ?? Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, packedContactPolicy.rows.byteLength);
  const contactBindGroupEntries = [
    { binding: 0, resource: exactPressureBindingResource(interfaceElementsBuffer) },
    { binding: 1, resource: exactPressureBindingResource(particleSource.stateBuffer) },
    { binding: 2, resource: exactPressureBindingResource(particleSource.thermoBuffer) },
    { binding: 3, resource: exactPressureBindingResource(
      contactPolicyBuffer,
      contactPolicyByteOffset,
      contactPolicyBindingByteLength
    ) },
    { binding: 4, resource: exactPressureBindingResource(outputBuffer, 0, outputByteLength) },
    { binding: 5, resource: exactPressureBindingResource(
      paramsBuffer,
      paramsByteOffset,
      SPH_PRESSURE_INTERFACE_CONTACT_KINEMATICS_PARAMS_BYTE_LENGTH
    ) },
    { binding: 6, resource: exactPressureBindingResource(resolvedParticleBins.countsBuffer) },
    { binding: 7, resource: exactPressureBindingResource(resolvedParticleBins.indicesBuffer) },
    { binding: 8, resource: exactPressureBindingResource(schroederLawQueueBuffer) },
    { binding: 9, resource: exactPressureBindingResource(
      schroederLawQueueParamsBuffer,
      schroederLawQueueParamsByteOffset,
      SPH_PRESSURE_INTERFACE_LAW_QUEUE_PARAMS_BYTE_LENGTH
    ) },
    { binding: 10, resource: exactPressureBindingResource(schroederLawNeighborCandidateBuffer) },
    { binding: 11, resource: exactPressureBindingResource(
      schroederLawNeighborCandidateParamsBuffer,
      schroederLawNeighborCandidateParamsByteOffset,
      SPH_PRESSURE_INTERFACE_LAW_NEIGHBOR_PARAMS_BYTE_LENGTH
    ) },
    ...(residentContactKinematicsPath
      ? []
      : [{ binding: 12, resource: exactPressureBindingResource(schroederSourceSpanBuffer) }]),
    { binding: 13, resource: exactPressureBindingResource(
      schroederSourceSpanParamsBuffer,
      schroederSourceSpanParamsByteOffset,
      SPH_PRESSURE_INTERFACE_SOURCE_SPAN_PARAMS_BYTE_LENGTH
    ) },
    { binding: 14, resource: exactPressureBindingResource(interfaceSourceKeyBuffer) },
    { binding: 15, resource: exactPressureBindingResource(
      interfaceSourceKeyParamsBuffer,
      interfaceSourceKeyParamsByteOffset,
      SPH_PRESSURE_INTERFACE_SOURCE_KEY_PARAMS_BYTE_LENGTH
    ) }
  ];
  const contactBindGroupCache = workspaceResources?.bindGroupForKind?.(
    'contactKinematics',
    exactPressureBindGroupSignature(bindGroupLayout, contactBindGroupEntries),
    () => device.createBindGroup({ layout: bindGroupLayout, entries: contactBindGroupEntries })
  ) ?? null;
  const bindGroup = contactBindGroupCache?.bindGroup || device.createBindGroup({
    layout: bindGroupLayout,
    entries: contactBindGroupEntries
  });
  const encoder = commandEncoder || device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  if (candidateDispatchIndirectBuffer) {
    if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
      throw new TypeError('pressure/interface contact kinematics requires dispatchWorkgroupsIndirect support');
    }
    pass.dispatchWorkgroupsIndirect(
      candidateDispatchIndirectBuffer,
      candidateDispatchIndirectOffsetBytes
    );
  } else {
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(packedInterfaceElements.rowCount / 64)));
  }
  pass.end();
  if (!callerOwnsEncoder) device.queue.submit([encoder.finish()]);
  return {
    schema: ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA,
    status: callerOwnsEncoder
      ? 'interface-contact-kinematics-gpu-derivation-encoded'
      : 'interface-contact-kinematics-gpu-derivation-submitted',
    buffer: outputBuffer,
    bufferOwned: ownsOutputBuffer,
    bufferByteLength: outputByteLength,
    rowCount: packedInterfaceElements.rowCount,
    rowStrideFloats: SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS,
    dispatchMode: candidateDispatchIndirectBuffer
      ? 'gpu-authored-candidate-count-indirect'
      : 'host-capacity-direct',
    candidateDispatchIndirectBufferConsumed: Boolean(candidateDispatchIndirectBuffer),
    candidateDispatchIndirectOffsetBytes: candidateDispatchIndirectBuffer
      ? candidateDispatchIndirectOffsetBytes
      : null,
    pipelineVariant: residentContactKinematicsPath
      ? 'resident-neighborhood-source-span-free'
      : 'general-schroeder-source-span',
    storageBufferBindingCount: residentContactKinematicsPath ? 10 : 11,
    maxStorageBuffersPerShaderStage:
      device.limits?.maxStorageBuffersPerShaderStage ?? null,
    particleCount: particleSource.particleCount,
    contactPolicyRowCount: packedContactPolicy.rowCount,
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
    queueCompletionStatus: callerOwnsEncoder ? 'encoded-awaiting-caller-submit' : 'queue-submitted',
    queueCompletionMethod: callerOwnsEncoder ? 'caller-owned-command-encoder' : 'queue.submit',
    commandEncoderOwnership: callerOwnsEncoder ? 'caller' : 'local',
    queueSubmitPerformed: !callerOwnsEncoder,
    mapPerformed: false,
    readbackPerformed: false,
    controlWorkspaceBound: Boolean(workspaceResources),
    controlSlotIndex: workspaceResources?.slotIndex ?? null,
    contactBindGroupCacheHit: contactBindGroupCache?.cacheHit === true,
    residentNeighborhoodAdmission,
    neighborhoodMode: residentNeighborhoodAdmission
      ? 'resident-neighborhood-packed-csr'
      : (resolvedParticleBins.enabled ? 'fixed-bin-compatibility' : 'all-particle-diagnostic-fallback'),
    derivation: residentNeighborhoodAdmission
      ? 'resident-neighborhood-packed-csr-gpu-interface-element-candidate-contact-kinematics'
      : (consumedSchroederLawNeighborCandidates?.neighborCandidateBufferConsumed
      ? 'schroeder-law-neighbor-candidates-authoritative-gpu-interface-element-candidate-contact-kinematics'
      : (resolvedParticleBins.enabled
          ? `${consumedSchroederLawQueue.enabled ? 'schroeder-law-queue-gated-' : ''}gpu-interface-element-neighbor-bin-contact-kinematics`
          : `${consumedSchroederLawQueue.enabled ? 'schroeder-law-queue-gated-' : ''}gpu-interface-element-nearest-particle-contact-kinematics`)),
    source: 'resident-sph-particle-state-and-thermo-buffers',
    cleanupBuffers: [
      ownsParamsBuffer ? paramsBuffer : null,
      localSchroederLawQueueBuffer,
      ownsSchroederLawQueueParamsBuffer ? schroederLawQueueParamsBuffer : null,
      localSchroederLawNeighborCandidateBuffer,
      ownsSchroederLawNeighborCandidateParamsBuffer
        ? schroederLawNeighborCandidateParamsBuffer
        : null,
      localSchroederSourceSpanBuffer,
      ownsSchroederSourceSpanParamsBuffer ? schroederSourceSpanParamsBuffer : null,
      localInterfaceSourceKeyBuffer,
      ownsInterfaceSourceKeyParamsBuffer ? interfaceSourceKeyParamsBuffer : null,
      ...(resolvedInterfaceSourceKeys.cleanupBuffers || []),
      ...(resolvedParticleBins.cleanupBuffers || [])
    ].filter(Boolean),
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
    const interfacePressurePa = pressureForElementFromCells(element, pressureCells, pressurePa);
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
  residentNeighborhood = null,
  residentNeighborhoodValidation = null,
  targetContactKinematicsBuffer = null,
  targetForceRowsBuffer = null,
  pressureInterfaceWorkspace = null,
  pressureInterfaceWorkspaceSubstepIndex = 0,
  commandEncoder = null,
  diagnosticCpuMaterialInterfaceInput = false,
  gpuResidentLaneLeaseIdentity = null,
  expectedGasPressureCellSourceEpoch = null,
  expectedGasPressureCellSourceGeneration = null,
  requireGpuGasCellTaskProvenance = true,
  retainedGasPressureCellsBuffer = null,
  retainedGasPressureCellRowCount = 0,
  retainedGasPressureCellRowCapacity = 0,
  retainedGasPressureCellRowStrideFloats = SPH_GAS_PRESSURE_CELL_FLOATS,
  retainedGasPressureCellRowByteLength = 0,
  retainedGasPressureCellMetadataBuffer = null,
  retainedGasPressureCellLookupBuffer = null,
  retainedGasPressureCellGeneration = null,
  retainedGasPressureCellLaneHashLow = null,
  retainedGasPressureCellLaneHashHigh = null,
  retainedGasPressureCellSourceEpoch = null,
  retainedGasPressureCellSourceGeneration = null,
  retainedGasPressureCellGridDims = null,
  retainedGasPressureCellGridCellCount = null,
  retainedGasPressureCellBoxDimsM = null,
  retainedPressureFieldMode = LOCAL_GAS_CELL_PRESSURE_FIELD_MODE,
  retainedPressureFieldResolution = LOCAL_GAS_CELL_PRESSURE_FIELD_RESOLUTION,
  retainedLocalPressureGradientStatus = 'retained-gpu-gas-cell-rows-ready-cpu-snapshot-not-read',
  retainedGasPressureCellImport = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceForceRowsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const callerOwnsEncoder = commandEncoder != null;
  if (callerOwnsEncoder && !commandEncoder?.beginComputePass) {
    throw new TypeError('commandEncoder must be a WebGPU command encoder');
  }
  const gpuGuardedGasCellField = resolveGpuGuardedGasCellField({
    device,
    gpuResidentLaneLeaseIdentity,
    expectedGasPressureCellSourceEpoch,
    expectedGasPressureCellSourceGeneration,
    requireGpuGasCellTaskProvenance,
    retainedGasPressureCellImport,
    retainedGasPressureCellsBuffer,
    retainedGasPressureCellMetadataBuffer,
    retainedGasPressureCellLookupBuffer,
    retainedGasPressureCellRowCapacity,
    retainedGasPressureCellRowStrideFloats,
    retainedGasPressureCellGeneration,
    retainedGasPressureCellLaneHashLow,
    retainedGasPressureCellLaneHashHigh,
    retainedGasPressureCellSourceEpoch,
    retainedGasPressureCellSourceGeneration,
    retainedGasPressureCellGridDims,
    retainedGasPressureCellGridCellCount,
    retainedGasPressureCellBoxDimsM
  });
  if (gpuGuardedGasCellField.advertised && !gpuGuardedGasCellField.ready) {
    throw new Error(
      `pressure/interface GPU gas-cell field rejected: ${gpuGuardedGasCellField.failures.join(', ')}`
    );
  }
  const legacyRetainedGasPressureRowsReady = Boolean(
    retainedGasPressureCellsBuffer
      && Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0))) > 0
      && Math.max(1, Math.trunc(finiteNumber(
        retainedGasPressureCellRowStrideFloats,
        SPH_GAS_PRESSURE_CELL_FLOATS
      ))) === SPH_GAS_PRESSURE_CELL_FLOATS
  );
  const gpuGuardedGasPressureRowsReady = gpuGuardedGasCellField.ready === true;
  const retainedGasPressureRowsReady = gpuGuardedGasPressureRowsReady || legacyRetainedGasPressureRowsReady;
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
  const cpuPackedInterfaceElements = packMaterialInterfaceElementRows(materialInterfaceField);
  const packedContactKinematics = packMaterialInterfaceContactKinematicsRows(materialInterfaceField);
  const cpuPackedGasPressureCells = packGasPressureCellRows(pressureFeedback?.gasCellField || null);
  const packedGasPressureCells = retainedGasPressureRowsReady
    ? {
        rows: new Float32Array(0),
        rowCount: gpuGuardedGasPressureRowsReady
          ? 0
          : Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0))),
        rowCapacity: gpuGuardedGasPressureRowsReady
          ? gpuGuardedGasCellField.rowCapacity
          : Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0))),
        rowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
        rowByteLength: Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowByteLength, 0)))
          || (gpuGuardedGasPressureRowsReady
            ? gpuGuardedGasCellField.rowCapacity
            : Math.max(0, Math.trunc(finiteNumber(retainedGasPressureCellRowCount, 0))))
            * SPH_GAS_PRESSURE_CELL_FLOATS
            * Float32Array.BYTES_PER_ELEMENT
      }
    : cpuPackedGasPressureCells;
  const contactPolicy = normalizeAlgorithmContactPairResponsePolicy({
    algorithmMaterialContactRows,
    algorithmContactPairResponseScale,
    algorithmContactMaxPressurePa
  });
  const packedContactPolicy = packAlgorithmContactPolicyRows(contactPolicy);
  const pressureWorkspaceResources = pressureInterfaceWorkspace?.substepResources
    ? pressureInterfaceWorkspace.substepResources(
        pressureInterfaceWorkspaceSubstepIndex,
        { contactPolicyByteLength: packedContactPolicy.rows.byteLength }
      )
    : null;
  const particleSource = resolveParticleKinematicsSource({
    device,
    sphParticleState,
    sphParticleUpload,
    particleStateBuffer,
    particleThermoBuffer,
    particleCount
  });
  const residentNeighborhoodAdmission = residentNeighborhood
    ? resolveResidentNeighborhoodConsumer({
        residentNeighborhood,
        device,
        consumer: 'pressureInterface',
        sourceCount: particleSource.particleCount,
        ...(residentNeighborhoodValidation || {})
      })
    : null;
  if (residentNeighborhood && !residentNeighborhoodAdmission.admitted) {
    throw new Error(
      `pressure/interface resident neighborhood rejected: ${residentNeighborhoodAdmission.reasonCodes.join(', ')}`
    );
  }
  const residentMaterialInterfaceRows = resolveGpuResidentMaterialInterfaceRows({
    device,
    materialInterfaceField,
    commandEncoder,
    residentNeighborhoodAdmission
  });
  if (callerOwnsEncoder && !residentMaterialInterfaceRows && diagnosticCpuMaterialInterfaceInput !== true) {
    throw new Error(
      'caller-owned pressure/interface stages require GPU-resident candidate rows; '
      + 'CPU-packed interface rows are available only with diagnosticCpuMaterialInterfaceInput=true'
    );
  }
  const packed = residentMaterialInterfaceRows || cpuPackedInterfaceElements;
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
  const schroederPressureInterfaceLawQueue = resolveSchroederPressureInterfaceLawQueue(schroederLawQueue, {
    device,
    particleCount: particleSource.particleCount
  });
  const schroederPressureInterfaceLawNeighborCandidates = resolveSchroederPressureInterfaceLawNeighborCandidates(
    schroederLawNeighborCandidates,
    { device }
  );
  const contactKinematicsGpuDerivationEligible = canDeriveInterfaceContactKinematicsOnGpu({
    packedInterfaceElements: packed,
    packedContactPolicy,
    packedContactKinematics,
    particleSource
  });
  const contactKinematicsParticleBinGrid = contactKinematicsGpuDerivationEligible
    && !residentNeighborhoodAdmission
    ? resolvePressureInterfaceParticleBinGrid({
        boxDimsM,
        packedContactPolicy,
        maxSearchRadiusM: contactKinematicsMaxSearchRadiusM,
        binCapacity: contactKinematicsParticleBinCapacity,
        particleCount: particleSource.particleCount
      })
    : null;
  const pressureModelId = (gpuGuardedGasPressureRowsReady || packedGasPressureCells.rowCount > 0)
    && pressureFieldResolution.localPressureGradientReady
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
        algorithmContactForceRowCount: 0,
        algorithmContactPressureRangePa: null,
        algorithmContactPairKeys: [],
        interfaceContactKinematicsSchema: packedContactKinematics.schema,
        interfaceContactKinematicsStatus: packedContactKinematics.status,
        interfaceContactKinematicsRowCount: packedContactKinematics.rowCount,
        interfaceContactKinematicsReadyCount: packedContactKinematics.readyCount,
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

  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE || callerOwnsEncoder;
  const outputByteLength = packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  assertPressureTargetBuffer({
    device,
    buffer: targetContactKinematicsBuffer,
    name: 'targetContactKinematicsBuffer',
    minimumByteLength: Math.max(
      PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH,
      packed.rowCount
        * SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT
    ),
    requiredUsage: GPU_BUFFER_USAGE.STORAGE
      | (contactKinematicsGpuDerivationEligible ? 0 : GPU_BUFFER_USAGE.COPY_DST)
  });
  assertPressureTargetBuffer({
    device,
    buffer: targetForceRowsBuffer,
    name: 'targetForceRowsBuffer',
    minimumByteLength: Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, outputByteLength),
    requiredUsage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const borrowedInterfaceElementsBuffer = residentMaterialInterfaceRows?.candidateRowsBuffer || null;
  const localInterfaceElementsBuffer = borrowedInterfaceElementsBuffer
    ? null
    : writeStorageBuffer(device, 'ulg-sph-pressure-interface-elements-in', packed.rows);
  const inputBuffer = borrowedInterfaceElementsBuffer || localInterfaceElementsBuffer;
  const borrowedCandidateMetadataBuffer = residentMaterialInterfaceRows?.compactMetadataBuffer || null;
  const localCandidateMetadataBuffer = borrowedCandidateMetadataBuffer
    ? null
    : writeStorageBuffer(
        device,
        'ulg-sph-pressure-interface-compact-metadata-disabled',
        new Uint32Array(4)
      );
  const candidateMetadataBuffer = borrowedCandidateMetadataBuffer || localCandidateMetadataBuffer;
  const borrowedResidentNeighborhoodBuffer = residentNeighborhoodAdmission?.packedCandidateCsrBuffer || null;
  const localResidentNeighborhoodBuffer = borrowedResidentNeighborhoodBuffer
    ? null
    : writeStorageBuffer(
        device,
        'ulg-sph-pressure-interface-resident-neighborhood-disabled',
        new Uint32Array(RESIDENT_NEIGHBORHOOD_PACKED_CSR_HEADER_BYTES / Uint32Array.BYTES_PER_ELEMENT)
      );
  const residentNeighborhoodBuffer = borrowedResidentNeighborhoodBuffer || localResidentNeighborhoodBuffer;
  const gasPressureCellsBuffer = retainedGasPressureRowsReady
    ? (gpuGuardedGasCellField.rowsBuffer || retainedGasPressureCellsBuffer)
    : writeStorageBuffer(device, 'ulg-sph-pressure-interface-gas-cells-in', packedGasPressureCells.rows);
  const localGasPressureCellMetadataBuffer = gpuGuardedGasPressureRowsReady
    ? null
    : writeStorageBuffer(
        device,
        'ulg-sph-pressure-interface-gas-cell-metadata-disabled',
        new Uint32Array(SPH_GAS_CELL_EOS_METADATA_WORDS)
      );
  const gasPressureCellMetadataBuffer = gpuGuardedGasCellField.metadataBuffer
    || localGasPressureCellMetadataBuffer;
  const localGasPressureCellLookupBuffer = gpuGuardedGasPressureRowsReady
    ? null
    : writeStorageBuffer(
        device,
        'ulg-sph-pressure-interface-gas-cell-lookup-disabled',
        new Uint32Array(1)
      );
  const gasPressureCellLookupBuffer = gpuGuardedGasCellField.lookupBuffer
    || localGasPressureCellLookupBuffer;
  const contactPolicyBuffer = pressureWorkspaceResources?.contactPolicyBuffer
    || writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-contact-policy-rows',
      packedContactPolicy.rows
    );
  const ownsContactPolicyBuffer = !pressureWorkspaceResources?.contactPolicyBuffer;
  if (!ownsContactPolicyBuffer) {
    device.queue.writeBuffer(
      contactPolicyBuffer,
      pressureWorkspaceResources?.contactPolicyByteOffset ?? 0,
      packedContactPolicy.rows
    );
  }
  let contactKinematicsBuffer = null;
  let contactKinematicsGpuDerivation = null;
  let contactKinematicsGpuDerived = false;
  let contactKinematicsParticleBins = null;
  let particleBinOverflowStatus = null;
  let particleBinOverflowCount = null;
  const contactKinematicsCleanupBuffers = [];
  if (contactKinematicsGpuDerivationEligible) {
    contactKinematicsParticleBins = residentNeighborhoodAdmission
      ? null
      : runSphPressureInterfaceParticleBinsWebGpu({
          device,
          particleSource,
          particleBinGrid: contactKinematicsParticleBinGrid,
          readbackMetadata: callerOwnsEncoder ? false : contactKinematicsParticleBinMetadataReadback
        });
    contactKinematicsGpuDerivation = runSphPressureInterfaceContactKinematicsWebGpu({
      device,
      packedInterfaceElements: packed,
      packedContactPolicy,
      interfaceElementsBuffer: inputBuffer,
      candidateDispatchIndirectBuffer:
        residentMaterialInterfaceRows?.candidateDispatchIndirectBuffer ?? null,
      candidateDispatchIndirectOffsetBytes:
        residentMaterialInterfaceRows?.candidateDispatchIndirectOffsetBytes ?? 0,
      contactPolicyBuffer,
      particleSource,
      particleBinGrid: contactKinematicsParticleBinGrid,
      particleBins: contactKinematicsParticleBins,
      maxSearchRadiusM: contactKinematicsMaxSearchRadiusM,
      gapFloorM: contactKinematicsGapFloorM,
      schroederLawQueue: schroederPressureInterfaceLawQueue,
      schroederLawNeighborCandidates: schroederPressureInterfaceLawNeighborCandidates,
      interfaceSourceKeys: packedInterfaceSourceKeys,
      residentNeighborhood,
      residentNeighborhoodValidation,
      targetOutputBuffer: targetContactKinematicsBuffer,
      workspaceResources: pressureWorkspaceResources,
      commandEncoder
    });
    contactKinematicsBuffer = contactKinematicsGpuDerivation.buffer;
    contactKinematicsGpuDerived = true;
    contactKinematicsCleanupBuffers.push(...(contactKinematicsGpuDerivation.cleanupBuffers || []));
  } else {
    const contactKinematicsByteLength = Math.max(16, packedContactKinematics.rows.byteLength);
    assertPressureTargetBuffer({
      device,
      buffer: targetContactKinematicsBuffer,
      name: 'targetContactKinematicsBuffer',
      minimumByteLength: contactKinematicsByteLength,
      requiredUsage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
    });
    contactKinematicsBuffer = targetContactKinematicsBuffer || writeStorageBuffer(
      device,
      'ulg-sph-pressure-interface-contact-kinematics-rows',
      packedContactKinematics.rows
    );
    if (targetContactKinematicsBuffer && packedContactKinematics.rows.byteLength > 0) {
      device.queue.writeBuffer(
        targetContactKinematicsBuffer,
        0,
        packedContactKinematics.rows
      );
    }
  }
  const ownsContactKinematicsBuffer = contactKinematicsGpuDerivation
    ? contactKinematicsGpuDerivation.bufferOwned !== false
    : !targetContactKinematicsBuffer;
  assertPressureTargetBuffer({
    device,
    buffer: targetForceRowsBuffer,
    name: 'targetForceRowsBuffer',
    minimumByteLength: Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, outputByteLength),
    requiredUsage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  });
  const ownsForceRowsBuffer = !targetForceRowsBuffer;
  const forceRowsBuffer = targetForceRowsBuffer
    || tagWebGpuBufferDevice(device.createBuffer({
      label: 'ulg-sph-pressure-interface-force-rows-out',
      size: Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, outputByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
    }), device);
  const paramsBuffer = pressureWorkspaceResources?.forceParamsBuffer || device.createBuffer({
    label: 'ulg-sph-pressure-interface-force-params',
    size: SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  const ownsParamsBuffer = !pressureWorkspaceResources?.forceParamsBuffer;
  const forceParamsByteOffset = pressureWorkspaceResources?.forceParamsByteOffset ?? 0;
  const readBuffer = noFullReadback
    ? null
    : device.createBuffer({
        label: 'ulg-sph-pressure-interface-force-rows-readback',
        size: Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, outputByteLength),
        usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
      });
  let returnedRetainedForceRowsBuffer = false;
  let returnedRetainedGasPressureCellsBuffer = false;
  let callerOwnedResult = null;
  let cleanupPerformed = false;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  const gasCellLeaseOwner = gpuGuardedGasPressureRowsReady
    && typeof retainedGasPressureCellImport?.addConsumerLease === 'function'
    && typeof retainedGasPressureCellImport?.releaseConsumerLease === 'function'
    ? retainedGasPressureCellImport
    : null;
  let gasCellConsumerLeaseId = null;
  let gasCellConsumerLeaseReleased = false;
  let gasCellConsumerLeaseReleaseAttempts = 0;
  let gasCellConsumerLeaseEvidenceResult = null;
  const releaseGasCellConsumerLease = () => {
    if (gasCellConsumerLeaseReleased || !gasCellLeaseOwner || gasCellConsumerLeaseId == null) return false;
    gasCellConsumerLeaseReleaseAttempts += 1;
    let acknowledgement = false;
    let releaseError = null;
    try {
      const releaseResult = gasCellLeaseOwner.releaseConsumerLease(gasCellConsumerLeaseId, {
        reason: 'pressure-interface-gas-cell-consumer-submit-settled'
      });
      acknowledgement = releaseResult === true
        || releaseResult?.released === true
        || releaseResult?.accepted === true;
    } catch (error) {
      releaseError = error instanceof Error ? error.message : String(error);
    }
    if (acknowledgement) gasCellConsumerLeaseReleased = true;
    if (gasCellConsumerLeaseEvidenceResult) {
      gasCellConsumerLeaseEvidenceResult.gasPressureCellConsumerLeaseReleaseAcknowledged =
        acknowledgement;
      gasCellConsumerLeaseEvidenceResult.gasPressureCellConsumerLeaseReleaseAttempts =
        gasCellConsumerLeaseReleaseAttempts;
      gasCellConsumerLeaseEvidenceResult.gasPressureCellConsumerLeaseReleaseError =
        releaseError;
      gasCellConsumerLeaseEvidenceResult.gasPressureCellConsumerLeaseReleaseStatus =
        acknowledgement
          ? 'consumer-lease-release-acknowledged'
          : (gasCellConsumerLeaseReleaseAttempts >= 3
              ? 'consumer-lease-release-retry-exhausted'
              : 'consumer-lease-release-not-acknowledged');
    }
    return acknowledgement;
  };
  const retryGasCellConsumerLeaseRelease = () => {
    if (
      gasCellConsumerLeaseReleased
      || !gasCellLeaseOwner
      || gasCellConsumerLeaseId == null
      || gasCellConsumerLeaseReleaseAttempts >= 3
    ) return;
    const retry = () => {
      if (!releaseGasCellConsumerLease()) retryGasCellConsumerLeaseRelease();
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(retry);
    else Promise.resolve().then(retry);
  };

  try {
    if (gpuGuardedGasPressureRowsReady && !gasCellLeaseOwner) {
      throw new Error('pressure/interface GPU gas-cell consumer lease protocol required');
    }
    const gasCellConsumerLease = gasCellLeaseOwner?.addConsumerLease({
      consumerStage: 'pressureInterface',
      reason: 'same-device-gpu-gas-cell-pressure-consumption'
    });
    gasCellConsumerLeaseId = gasCellConsumerLease?.leaseId ?? gasCellConsumerLease ?? null;
    if (
      gasCellLeaseOwner
      && (gasCellConsumerLeaseId == null
        || gasCellConsumerLease?.accepted === false
        || String(gasCellConsumerLease?.status || '').includes('rejected'))
    ) {
      throw new Error(
        gasCellConsumerLease?.reason || 'pressure/interface GPU gas-cell consumer lease rejected'
      );
    }
    device.queue.writeBuffer(paramsBuffer, forceParamsByteOffset, createPressureInterfaceParamsArray({
      elementCount: packed.rowCount,
      pressurePa,
      gasPressureCellCount: packedGasPressureCells.rowCount,
      pressureModelId,
      contactPolicyRowCount: packedContactPolicy.rowCount,
      algorithmContactPairResponseScale: contactPolicy.responseScale,
      algorithmContactMaxPressurePa: contactPolicy.maxContactPressurePa,
      algorithmContactPairResponseEnabled: packedContactPolicy.rowCount > 0,
      residentCandidateMode: Boolean(residentMaterialInterfaceRows),
      residentCandidateCapacity: residentMaterialInterfaceRows?.rowCapacity ?? 0,
      residentCandidateDenseCount: residentMaterialInterfaceRows?.denseCandidateCount ?? 0,
      residentCandidateGuardEnabled: Boolean(residentMaterialInterfaceRows),
      residentNeighborhoodAdmission,
      retainedGasPressureCellMetadata: gpuGuardedGasCellField
    }));
    const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-pressure-interface-force-rows.v5-gpu-gas-cell-metadata',
      label: 'ulg-sph-pressure-interface-force-rows',
      code: sphPressureInterfaceForceRowsWgsl,
      entryPoint: 'main',
      bindings: [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'uniform'),
        computeBufferBinding(3, 'read-only-storage'),
        computeBufferBinding(4, 'read-only-storage'),
        computeBufferBinding(5, 'read-only-storage'),
        computeBufferBinding(6, 'read-only-storage'),
        computeBufferBinding(7, 'read-only-storage'),
        computeBufferBinding(8, 'storage'),
        computeBufferBinding(9, 'read-only-storage')
      ]
    });
    const forceBindGroupEntries = [
      { binding: 0, resource: exactPressureBindingResource(inputBuffer) },
      { binding: 1, resource: exactPressureBindingResource(
        forceRowsBuffer,
        0,
        Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, outputByteLength)
      ) },
      { binding: 2, resource: exactPressureBindingResource(
        paramsBuffer,
        forceParamsByteOffset,
        SPH_PRESSURE_INTERFACE_FORCE_PARAMS_BYTE_LENGTH
      ) },
      { binding: 3, resource: exactPressureBindingResource(gasPressureCellsBuffer) },
      { binding: 4, resource: exactPressureBindingResource(
        contactPolicyBuffer,
        pressureWorkspaceResources?.contactPolicyByteOffset ?? 0,
        pressureWorkspaceResources?.contactPolicyByteLength
          ?? Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, packedContactPolicy.rows.byteLength)
      ) },
      { binding: 5, resource: exactPressureBindingResource(contactKinematicsBuffer) },
      { binding: 6, resource: exactPressureBindingResource(candidateMetadataBuffer, 0, 16) },
      { binding: 7, resource: exactPressureBindingResource(residentNeighborhoodBuffer) },
      { binding: 8, resource: exactPressureBindingResource(gasPressureCellMetadataBuffer) },
      { binding: 9, resource: exactPressureBindingResource(gasPressureCellLookupBuffer) }
    ];
    const forceBindGroupCache = pressureWorkspaceResources?.bindGroupForKind?.(
      'force',
      exactPressureBindGroupSignature(bindGroupLayout, forceBindGroupEntries),
      () => device.createBindGroup({ layout: bindGroupLayout, entries: forceBindGroupEntries })
    ) ?? null;
    const bindGroup = forceBindGroupCache?.bindGroup || device.createBindGroup({
      layout: bindGroupLayout,
      entries: forceBindGroupEntries
    });
    const encoder = commandEncoder || device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    if (residentMaterialInterfaceRows?.candidateDispatchIndirectBuffer) {
      if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
        throw new TypeError('pressure/interface force rows require dispatchWorkgroupsIndirect support');
      }
      pass.dispatchWorkgroupsIndirect(
        residentMaterialInterfaceRows.candidateDispatchIndirectBuffer,
        residentMaterialInterfaceRows.candidateDispatchIndirectOffsetBytes
      );
    } else {
      pass.dispatchWorkgroups(Math.max(1, Math.ceil(packed.rowCount / 64)));
    }
    pass.end();
    if (!noFullReadback && !callerOwnsEncoder) {
      encoder.copyBufferToBuffer(
        forceRowsBuffer,
        0,
        readBuffer,
        0,
        Math.max(PRESSURE_RUNTIME_ARRAY_MIN_BYTE_LENGTH, outputByteLength)
      );
    }
    if (!callerOwnsEncoder) {
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
      releaseGasCellConsumerLease();
    } else {
      queueCompletionStatus = 'encoded-awaiting-caller-submit';
      queueCompletionMethod = 'caller-owned-command-encoder';
    }

    let forceRowValues = new Float32Array(0);
    if (!noFullReadback && !callerOwnsEncoder) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      forceRowValues = new Float32Array(readBuffer.getMappedRange()).slice(0, packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
      readBuffer.unmap();
    } else if (!callerOwnsEncoder) {
      queueCompletionStatus = device.queue?.onSubmittedWorkDone
      ? 'queue-submitted-cleanup-deferred'
      : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : null;
    }
    if (!callerOwnsEncoder && contactKinematicsParticleBins?.metadataReadbackBuffer) {
      await contactKinematicsParticleBins.metadataReadbackBuffer.mapAsync(GPU_MAP_MODE.READ);
      const metadata = new Uint32Array(contactKinematicsParticleBins.metadataReadbackBuffer.getMappedRange()).slice(0, 4);
      particleBinOverflowCount = metadata[0] || 0;
      particleBinOverflowStatus = 'particle-bin-overflow-readback-completed';
      contactKinematicsParticleBins.metadataReadbackBuffer.unmap();
    } else {
      particleBinOverflowStatus = contactKinematicsParticleBins?.overflowMetadataStatus || null;
    }

    const summary = summarizeForceRowsFromElements(packed.elements, pressurePa, pressureFeedback?.gasCellField || null, contactPolicy);
    const gpuResidentForceEvidencePending = Boolean(residentMaterialInterfaceRows);
    const forceDerivationSuffix = summary.algorithmContactPairResponseApplied
      ? '-plus-algorithm-contact-pair-response'
      : '';
    const forceResolutionSuffix = summary.algorithmContactPairResponseApplied
      ? '+algorithm-contact-pair-response'
      : '';
    const solver = {
      schema: ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA,
      status: 'pressure-interface-force-solver-ready',
      backend: 'webgpu',
      materialInterfaceInputMode: residentMaterialInterfaceRows
        ? 'gpu-resident-compact-candidate-buffer'
        : 'cpu-packed-diagnostic-elements',
      materialInterfaceInputAuthoritative: Boolean(residentMaterialInterfaceRows),
      gpuResidentCandidateMetadataGuard: residentMaterialInterfaceRows?.metadataGuard ?? null,
      gpuResidentCandidateAuthority: residentMaterialInterfaceRows?.residentAuthority ?? null,
      gpuResidentCandidateSourceDeviceId: residentMaterialInterfaceRows?.sourceDeviceId ?? null,
      gpuResidentCandidateConsumerDeviceId: residentMaterialInterfaceRows?.consumerDeviceId ?? null,
      gpuResidentCandidateMetadataBufferRetained: Boolean(residentMaterialInterfaceRows),
      gpuResidentCandidateMetadataBufferByteLength: residentMaterialInterfaceRows ? 16 : 0,
      gpuResidentCandidateMetadataLayout: residentMaterialInterfaceRows
        ? ['activeCandidateCount:u32', 'overflowCount:u32', 'capacity:u32', 'denseCandidateCount:u32']
        : [],
      candidateDispatchIndirectBuffer:
        residentMaterialInterfaceRows?.candidateDispatchIndirectBuffer ?? null,
      candidateDispatchIndirectBufferRetained: Boolean(residentMaterialInterfaceRows),
      candidateDispatchIndirectBufferByteLength:
        residentMaterialInterfaceRows?.candidateDispatchIndirectByteLength ?? 0,
      candidateDispatchIndirectOffsetBytes:
        residentMaterialInterfaceRows?.candidateDispatchIndirectOffsetBytes ?? null,
      candidateDispatchAuthority:
        residentMaterialInterfaceRows?.candidateDispatchAuthority ?? null,
      candidateDispatchMode: residentMaterialInterfaceRows
        ? 'dispatchWorkgroupsIndirect'
        : 'dispatchWorkgroups',
      forceRowCapacity: packed.rowCount,
      forceRowActiveCountPending: gpuResidentForceEvidencePending,
      forceRowStatusGate: residentMaterialInterfaceRows
        ? 'row3.w-positive-after-gpu-candidate-metadata-and-resident-neighborhood-header-guard'
        : 'row3.w-positive',
      forceApplicationStatus: 'solver-ready-not-applied',
      controlWorkspaceBound: Boolean(pressureWorkspaceResources),
      controlSlotIndex: pressureWorkspaceResources?.slotIndex ?? null,
      contactBindGroupCacheHit:
        contactKinematicsGpuDerivation?.contactBindGroupCacheHit === true,
      forceBindGroupCacheHit: forceBindGroupCache?.cacheHit === true,
      pressureInterfaceCouplingStatus: pressureInterfaceCoupling?.status || null,
      forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
      gasInterfacePressurePa: pressurePa,
      gasInterfacePressureRangePa: summary.gasInterfacePressureRangePa,
      pressureFieldMode: pressureFieldResolution.pressureFieldMode,
      pressureFieldResolution: pressureFieldResolution.pressureFieldResolution,
      pressureGradientStatus: pressureFieldResolution.pressureGradientStatus,
      localPressureGradientSchema: pressureFieldResolution.localPressureGradientSchema,
      localPressureGradientReady: pressureFieldResolution.localPressureGradientReady,
      localPressureGradientStatus: pressureFieldResolution.localPressureGradientStatus,
      localPressureGradientBlockers: pressureFieldResolution.localPressureGradientBlockers,
      localPressureGradientForceCouplingStatus: pressureFieldResolution.localPressureGradientForceCouplingStatus,
      gasPressureCellRowCount: packedGasPressureCells.rowCount,
      gasPressureCellRowCountSource: gpuGuardedGasPressureRowsReady
        ? `gpu-metadata-word-${SPH_GAS_CELL_EOS_METADATA.admittedActiveCellCount}`
        : 'host-row-count',
      gasPressureCellRowCapacity: packedGasPressureCells.rowCapacity ?? packedGasPressureCells.rowCount,
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowsBufferRetained:
        (retainForceRowsBuffer === true || retainedGasPressureRowsReady)
          && (gpuGuardedGasPressureRowsReady || packedGasPressureCells.rowCount > 0),
      gasPressureCellRowsBufferBorrowed: retainedGasPressureRowsReady,
      gasPressureCellGpuMetadataGuarded: gpuGuardedGasPressureRowsReady,
      gasPressureCellGpuMetadataStatus: gpuGuardedGasCellField.status || null,
      gasPressureCellGpuMetadataGeneration: gpuGuardedGasCellField.generation || 0,
      gasPressureCellGpuMetadataBufferRetained: gpuGuardedGasPressureRowsReady,
      gasPressureCellGpuLookupBufferRetained: gpuGuardedGasPressureRowsReady,
      gasPressureCellGpuConsumerAccessProtocol: gpuGuardedGasCellField.consumerAccessProtocol || null,
      gasPressureCellGpuFailCloseStatus:
        'metadata-magic-version-generation-lane-source-overflow-status-and-admitted-count-guarded',
      retainedGasPressureCellImportSchema: retainedGasPressureCellImport?.schema || null,
      retainedGasPressureCellImportStatus: retainedGasPressureCellImport?.status || null,
      pressureModelId,
      algorithmContactPairResponseSchema: summary.algorithmContactPairResponseSchema,
      algorithmContactPairResponseStatus: summary.algorithmContactPairResponseStatus,
      algorithmContactPolicyRowsSchema: algorithmMaterialContactRows?.schema ?? null,
      algorithmContactPolicyRowsStatus: algorithmMaterialContactRows?.status ?? null,
      algorithmContactPolicyRowCount: summary.algorithmContactPolicyRowCount,
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
      interfaceContactKinematicsGpuDerivationEligible: contactKinematicsGpuDerivationEligible,
      interfaceContactKinematicsGpuDerived: contactKinematicsGpuDerived,
      interfaceContactKinematicsDispatchMode:
        contactKinematicsGpuDerivation?.dispatchMode ?? null,
      interfaceContactKinematicsCandidateDispatchIndirectConsumed:
        contactKinematicsGpuDerivation?.candidateDispatchIndirectBufferConsumed === true,
      interfaceContactKinematicsDerivationStatus: contactKinematicsGpuDerivation?.status
        || (contactKinematicsGpuDerivationEligible
            ? 'interface-contact-kinematics-gpu-derivation-not-run'
            : 'interface-contact-kinematics-uses-element-fields-or-unavailable'),
      interfaceContactKinematicsDerivation: contactKinematicsGpuDerivation?.derivation || null,
      interfaceContactKinematicsParticleSourceStatus: particleSource.status,
      interfaceContactKinematicsParticleCount: particleSource.particleCount,
      interfaceContactKinematicsParticleSourceDeviceId: particleSource.sourceDeviceId,
      interfaceContactKinematicsConsumerDeviceId: particleSource.consumerDeviceId,
      interfaceContactKinematicsParticleBinGridStatus: contactKinematicsGpuDerivation?.particleBinGridStatus || contactKinematicsParticleBinGrid?.status || null,
      interfaceContactKinematicsParticleBinGridEnabled: contactKinematicsGpuDerivation?.particleBinGridEnabled === true,
      interfaceContactKinematicsParticleBinGridCellCount: contactKinematicsGpuDerivation?.particleBinGridCellCount || contactKinematicsParticleBinGrid?.cellCount || 0,
      interfaceContactKinematicsParticleBinGridBinCapacity: contactKinematicsGpuDerivation?.particleBinGridBinCapacity || contactKinematicsParticleBinGrid?.binCapacity || 0,
      interfaceContactKinematicsParticleBinGridAverageOccupancy: contactKinematicsGpuDerivation?.particleBinGridAverageOccupancy || contactKinematicsParticleBinGrid?.averageOccupancy || 0,
      interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk: contactKinematicsGpuDerivation?.particleBinGridEstimatedOverflowRisk === true || contactKinematicsParticleBinGrid?.estimatedOverflowRisk === true,
      interfaceContactKinematicsParticleBinGridIndexBufferByteLength: contactKinematicsGpuDerivation?.particleBinGridIndexBufferByteLength || contactKinematicsParticleBinGrid?.indexBufferByteLength || 0,
      interfaceContactKinematicsParticleBinOverflowStatus: particleBinOverflowStatus,
      interfaceContactKinematicsParticleBinOverflowCount: particleBinOverflowCount,
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
      forceRowsBufferRetained: retainForceRowsBuffer === true || callerOwnsEncoder,
      forceRowsBufferOwned: ownsForceRowsBuffer,
      surfaceForceCount: summary.surfaceForceCount,
      surfaceForces: summary.surfaceForces,
      totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? summary.totalInterfaceAreaM2,
      totalAbsMaterialForceN: summary.totalAbsMaterialForceN,
      netMaterialForceN: summary.netMaterialForceN,
      netGasReactionForceN: summary.netGasReactionForceN,
      conservationResidualN: summary.conservationResidualN,
      conservationResidualMagnitudeN: summary.conservationResidualMagnitudeN,
      maxPairResidualN: summary.maxPairResidualN,
      conservationStatus: gpuResidentForceEvidencePending
        ? 'gpu-resident-pairwise-conservation-evidence-not-read'
        : (summary.maxPairResidualN <= 1e-9
            ? 'pairwise-equal-opposite-force-conservative'
            : 'pairwise-force-residual-nonzero'),
      forceDerivation: pressureModelId === 1
        ? `webgpu-local-gas-cell-pressure-gradient-interface-normal-area-with-equal-opposite-gas-reaction${forceDerivationSuffix}`
        : `webgpu-uniform-gas-pressure-interface-normal-area-with-equal-opposite-gas-reaction${forceDerivationSuffix}`,
      forceResolution: pressureModelId === 1
        ? `local-gradient-interface-traction${forceResolutionSuffix}`
        : `uniform-interface-traction${forceResolutionSuffix}`,
      forceApplicationTarget: residentMaterialInterfaceRows
        ? 'same-encoder-status-gated-sparse-grid-force-scatter'
        : 'pending-mls-mpm-grid-force-consumer',
      localPressureGradientValidation: pressureModelId === 1,
      forceCouplingValidation: false,
      scientificValidation: false,
      gasValidation: false,
      sphValidation: false,
      fullPhysicsValidation: false
    };
    const result = {
      backend: 'webgpu',
      status: callerOwnsEncoder
        ? 'pressure-interface-stage-encoded-awaiting-caller-submit'
        : 'pressure-interface-stage-solver-ready',
      executionSource: 'sphPressureInterfaceForceRowsWebGpu',
      readbackMode: (noFullReadback || callerOwnsEncoder) ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
      fullReadbackPerformed: !noFullReadback && !callerOwnsEncoder,
      normalHotLoopReadbackFree: noFullReadback || callerOwnsEncoder,
      queueCompletionStatus,
      queueCompletionMethod,
      commandEncoderOwnership: callerOwnsEncoder ? 'caller' : 'local',
      submissionOwnership: callerOwnsEncoder ? 'caller' : 'local',
      queueSubmitPerformed: !callerOwnsEncoder,
      mapPerformed: !noFullReadback && !callerOwnsEncoder,
      readbackPerformed: !noFullReadback && !callerOwnsEncoder,
      controlWorkspaceBound: Boolean(pressureWorkspaceResources),
      controlSlotIndex: pressureWorkspaceResources?.slotIndex ?? null,
      contactBindGroupCacheHit:
        contactKinematicsGpuDerivation?.contactBindGroupCacheHit === true,
      forceBindGroupCacheHit: forceBindGroupCache?.cacheHit === true,
      residentNeighborhoodAdmission,
      neighborhoodMode: residentNeighborhoodAdmission
        ? 'resident-neighborhood-packed-csr'
        : (contactKinematicsParticleBins?.enabled
          ? 'fixed-bin-compatibility'
          : 'all-particle-diagnostic-fallback'),
      pressureInterfaceForcePreview,
      pressureInterfaceForceSolver: solver,
      materialInterfaceInputMode: solver.materialInterfaceInputMode,
      materialInterfaceInputAuthoritative: solver.materialInterfaceInputAuthoritative,
      candidateMetadataBuffer: residentMaterialInterfaceRows?.compactMetadataBuffer ?? null,
      candidateMetadataBufferBorrowed: Boolean(residentMaterialInterfaceRows),
      candidateMetadataBufferByteLength: residentMaterialInterfaceRows ? 16 : 0,
      candidateMetadataLayout: solver.gpuResidentCandidateMetadataLayout,
      candidateMetadataGuard: solver.gpuResidentCandidateMetadataGuard,
      candidateDispatchIndirectBuffer:
        residentMaterialInterfaceRows?.candidateDispatchIndirectBuffer ?? null,
      candidateDispatchIndirectBufferBorrowed: Boolean(residentMaterialInterfaceRows),
      candidateDispatchIndirectBufferByteLength:
        residentMaterialInterfaceRows?.candidateDispatchIndirectByteLength ?? 0,
      candidateDispatchIndirectOffsetBytes:
        residentMaterialInterfaceRows?.candidateDispatchIndirectOffsetBytes ?? null,
      candidateDispatchAuthority:
        residentMaterialInterfaceRows?.candidateDispatchAuthority ?? null,
      candidateDispatchMode: residentMaterialInterfaceRows
        ? 'dispatchWorkgroupsIndirect'
        : 'dispatchWorkgroups',
      gpuFailCloseStatusSource: residentMaterialInterfaceRows
        ? 'candidate-metadata-plus-resident-neighborhood-header-written-to-force-row-status'
        : null,
      forceRowCount: packed.rowCount,
      forceRowCapacity: packed.rowCount,
      forceRowActiveCountPending: gpuResidentForceEvidencePending,
      forceRowStrideFloats: SPH_PRESSURE_INTERFACE_FORCE_FLOATS,
      forceRowByteLength: outputByteLength,
      forceRowStatusGate: solver.forceRowStatusGate,
      gasPressureCellRowCount: packedGasPressureCells.rowCount,
      gasPressureCellRowCountSource: gpuGuardedGasPressureRowsReady
        ? `gpu-metadata-word-${SPH_GAS_CELL_EOS_METADATA.admittedActiveCellCount}`
        : 'host-row-count',
      gasPressureCellRowCapacity: packedGasPressureCells.rowCapacity ?? packedGasPressureCells.rowCount,
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowByteLength: packedGasPressureCells.rowByteLength,
      gasPressureCellRowsBufferRetained:
        (retainForceRowsBuffer === true || retainedGasPressureRowsReady)
          && (gpuGuardedGasPressureRowsReady || packedGasPressureCells.rowCount > 0),
      gasPressureCellRowsBufferBorrowed: retainedGasPressureRowsReady,
      gasPressureCellGpuMetadataGuarded: gpuGuardedGasPressureRowsReady,
      gasPressureCellMetadataBuffer: gpuGuardedGasPressureRowsReady ? gasPressureCellMetadataBuffer : null,
      gasPressureCellLookupBuffer: gpuGuardedGasPressureRowsReady ? gasPressureCellLookupBuffer : null,
      gasPressureCellMetadataLayout: gpuGuardedGasPressureRowsReady
        ? { ...SPH_GAS_CELL_EOS_METADATA }
        : null,
      gasPressureCellMetadataWordCount: gpuGuardedGasPressureRowsReady
        ? SPH_GAS_CELL_EOS_METADATA_WORDS
        : 0,
      gasPressureCellGeneration: gpuGuardedGasCellField.generation || 0,
      gasPressureCellLaneHashLow: gpuGuardedGasCellField.laneHashLow || 0,
      gasPressureCellLaneHashHigh: gpuGuardedGasCellField.laneHashHigh || 0,
      gasPressureCellSourceEpoch: gpuGuardedGasCellField.sourceEpoch || 0,
      gasPressureCellSourceGeneration: gpuGuardedGasCellField.sourceGeneration || 0,
      gasPressureCellGridDims: gpuGuardedGasPressureRowsReady ? [...gpuGuardedGasCellField.gridDims] : null,
      gasPressureCellGridCellCount: gpuGuardedGasCellField.gridCellCount || 0,
      gasPressureCellConsumerLeaseHeldUntilSubmit: gasCellConsumerLeaseId != null,
      gasPressureCellConsumerLeaseReleaseStatus: gasCellConsumerLeaseId != null
        ? 'consumer-lease-release-pending-submit-settlement'
        : 'consumer-lease-release-not-required',
      gasPressureCellConsumerLeaseReleaseAcknowledged: gasCellConsumerLeaseId == null,
      gasPressureCellConsumerLeaseReleaseAttempts: 0,
      gasPressureCellConsumerLeaseReleaseError: null,
      retainedGasPressureCellImportSchema: retainedGasPressureCellImport?.schema || null,
      retainedGasPressureCellImportStatus: retainedGasPressureCellImport?.status || null,
      algorithmContactPolicyRowCount: packedContactPolicy.rowCount,
      algorithmContactPolicyRowByteLength: packedContactPolicy.rowByteLength,
      interfaceContactKinematicsRowCount: packedContactKinematics.rowCount,
      interfaceContactKinematicsReadyCount: packedContactKinematics.readyCount,
      interfaceContactKinematicsRowByteLength: packedContactKinematics.rowByteLength,
      interfaceContactKinematicsGpuDerivationEligible: contactKinematicsGpuDerivationEligible,
      interfaceContactKinematicsGpuDerived: contactKinematicsGpuDerived,
      interfaceContactKinematicsBufferOwned: ownsContactKinematicsBuffer,
      interfaceContactKinematicsDispatchMode:
        contactKinematicsGpuDerivation?.dispatchMode ?? null,
      interfaceContactKinematicsCandidateDispatchIndirectConsumed:
        contactKinematicsGpuDerivation?.candidateDispatchIndirectBufferConsumed === true,
      interfaceContactKinematicsDerivationStatus: contactKinematicsGpuDerivation?.status
        || (contactKinematicsGpuDerivationEligible
            ? 'interface-contact-kinematics-gpu-derivation-not-run'
            : 'interface-contact-kinematics-uses-element-fields-or-unavailable'),
      interfaceContactKinematicsParticleSourceStatus: particleSource.status,
      interfaceContactKinematicsParticleCount: particleSource.particleCount,
      interfaceContactKinematicsParticleBinGridStatus: contactKinematicsGpuDerivation?.particleBinGridStatus || contactKinematicsParticleBinGrid?.status || null,
      interfaceContactKinematicsParticleBinGridEnabled: contactKinematicsGpuDerivation?.particleBinGridEnabled === true,
      interfaceContactKinematicsParticleBinGridCellCount: contactKinematicsGpuDerivation?.particleBinGridCellCount || contactKinematicsParticleBinGrid?.cellCount || 0,
      interfaceContactKinematicsParticleBinGridBinCapacity: contactKinematicsGpuDerivation?.particleBinGridBinCapacity || contactKinematicsParticleBinGrid?.binCapacity || 0,
      interfaceContactKinematicsParticleBinGridAverageOccupancy: contactKinematicsGpuDerivation?.particleBinGridAverageOccupancy || contactKinematicsParticleBinGrid?.averageOccupancy || 0,
      interfaceContactKinematicsParticleBinGridEstimatedOverflowRisk: contactKinematicsGpuDerivation?.particleBinGridEstimatedOverflowRisk === true || contactKinematicsParticleBinGrid?.estimatedOverflowRisk === true,
      interfaceContactKinematicsParticleBinGridIndexBufferByteLength: contactKinematicsGpuDerivation?.particleBinGridIndexBufferByteLength || contactKinematicsParticleBinGrid?.indexBufferByteLength || 0,
      interfaceContactKinematicsParticleBinOverflowStatus: particleBinOverflowStatus,
      interfaceContactKinematicsParticleBinOverflowCount: particleBinOverflowCount,
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
    result.gpuAllocationEntries = [
      {
        role: 'pressure-interface-elements',
        buffer: inputBuffer,
        owned: Boolean(localInterfaceElementsBuffer),
        lifetime: localInterfaceElementsBuffer ? 'transient-submission' : 'borrowed'
      },
      {
        role: 'pressure-interface-candidate-metadata',
        buffer: candidateMetadataBuffer,
        owned: Boolean(localCandidateMetadataBuffer),
        lifetime: localCandidateMetadataBuffer ? 'transient-submission' : 'borrowed'
      },
      residentMaterialInterfaceRows ? {
        role: 'pressure-interface-candidate-dispatch-indirect',
        buffer: residentMaterialInterfaceRows.candidateDispatchIndirectBuffer,
        owned: false,
        lifetime: 'borrowed'
      } : null,
      {
        role: 'pressure-interface-resident-neighborhood',
        buffer: residentNeighborhoodBuffer,
        owned: Boolean(localResidentNeighborhoodBuffer),
        lifetime: localResidentNeighborhoodBuffer ? 'transient-submission' : 'borrowed'
      },
      {
        role: 'pressure-interface-gas-pressure-cells',
        buffer: gasPressureCellsBuffer,
        owned: !retainedGasPressureRowsReady,
        lifetime: retainedGasPressureRowsReady ? 'borrowed' : 'transient-submission'
      },
      {
        role: 'pressure-interface-gas-cell-metadata',
        buffer: gasPressureCellMetadataBuffer,
        owned: Boolean(localGasPressureCellMetadataBuffer),
        lifetime: localGasPressureCellMetadataBuffer ? 'transient-submission' : 'borrowed'
      },
      {
        role: 'pressure-interface-gas-cell-lookup',
        buffer: gasPressureCellLookupBuffer,
        owned: Boolean(localGasPressureCellLookupBuffer),
        lifetime: localGasPressureCellLookupBuffer ? 'transient-submission' : 'borrowed'
      },
      {
        role: 'pressure-interface-contact-policy',
        buffer: contactPolicyBuffer,
        owned: ownsContactPolicyBuffer,
        lifetime: ownsContactPolicyBuffer ? 'transient-submission' : 'persistent-workspace'
      },
      {
        role: 'pressure-interface-contact-kinematics',
        buffer: contactKinematicsBuffer,
        owned: ownsContactKinematicsBuffer,
        lifetime: ownsContactKinematicsBuffer ? 'transient-submission' : 'borrowed'
      },
      ...contactKinematicsCleanupBuffers.map((buffer, index) => ({
        role: `pressure-interface-contact-kinematics-cleanup-${index}`,
        buffer,
        owned: true,
        lifetime: 'transient-submission'
      })),
      {
        role: 'pressure-interface-force-rows',
        buffer: forceRowsBuffer,
        owned: ownsForceRowsBuffer,
        lifetime: ownsForceRowsBuffer ? 'transient-submission' : 'borrowed'
      },
      {
        role: 'pressure-interface-force-params',
        buffer: paramsBuffer,
        owned: ownsParamsBuffer,
        lifetime: ownsParamsBuffer ? 'transient-submission' : 'persistent-workspace'
      },
      readBuffer ? {
        role: 'pressure-interface-force-readback',
        buffer: readBuffer,
        owned: true,
        lifetime: 'transient-submission'
      } : null
    ].filter((entry) => entry?.buffer);
    gasCellConsumerLeaseEvidenceResult = result;
    if (retainForceRowsBuffer || callerOwnsEncoder) {
      result.forceRowsBuffer = forceRowsBuffer;
      result.forceRowsBufferByteLength = outputByteLength;
      result.forceRowsBufferOwned = ownsForceRowsBuffer;
      result.destroyForceRowsBuffer = () => {
        if (!ownsForceRowsBuffer) return false;
        forceRowsBuffer.destroy?.();
        return true;
      };
      returnedRetainedForceRowsBuffer = true;
    }
    if (
      (retainForceRowsBuffer || retainedGasPressureRowsReady)
      && (gpuGuardedGasPressureRowsReady || packedGasPressureCells.rowCount > 0)
    ) {
      result.gasPressureCellsBuffer = gasPressureCellsBuffer;
      result.gasPressureCellRowsBufferByteLength = packedGasPressureCells.rowByteLength;
      result.destroyGasPressureCellsBuffer = retainedGasPressureRowsReady
        ? null
        : () => gasPressureCellsBuffer.destroy?.();
      returnedRetainedGasPressureCellsBuffer = true;
    }
    if (callerOwnsEncoder) callerOwnedResult = result;
    return result;
  } finally {
    const cleanup = () => {
      if (cleanupPerformed) return;
      cleanupPerformed = true;
      localInterfaceElementsBuffer?.destroy?.();
      localCandidateMetadataBuffer?.destroy?.();
      localResidentNeighborhoodBuffer?.destroy?.();
      localGasPressureCellMetadataBuffer?.destroy?.();
      localGasPressureCellLookupBuffer?.destroy?.();
      if (!retainedGasPressureRowsReady && !returnedRetainedGasPressureCellsBuffer) {
        gasPressureCellsBuffer.destroy?.();
      }
      if (ownsContactPolicyBuffer) contactPolicyBuffer.destroy?.();
      if (ownsContactKinematicsBuffer) contactKinematicsBuffer.destroy?.();
      for (const buffer of contactKinematicsCleanupBuffers) buffer?.destroy?.();
      if (ownsParamsBuffer) paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
      if (
        ownsForceRowsBuffer
        && (!retainForceRowsBuffer || !returnedRetainedForceRowsBuffer)
      ) {
        forceRowsBuffer.destroy?.();
      }
      if (!releaseGasCellConsumerLease()) retryGasCellConsumerLeaseRelease();
    };
    if (callerOwnsEncoder) {
      if (callerOwnedResult) callerOwnedResult.cleanupSubmittedWork = cleanup;
      else cleanup();
    } else if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}

export function createSphPressureInterfaceForceRowsWebGpuEncoderStage(args = {}) {
  if (!args.commandEncoder) {
    throw new TypeError('pressure/interface encoder stage requires a caller-owned commandEncoder');
  }
  return runSphPressureInterfaceForceRowsWebGpu({
    ...args,
    retainForceRowsBuffer: true,
    readbackMode: NO_FULL_READBACK_MODE,
    contactKinematicsParticleBinMetadataReadback: false
  });
}
