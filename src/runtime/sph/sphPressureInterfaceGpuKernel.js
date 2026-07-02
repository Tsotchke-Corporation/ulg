import {
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SPH_PRESSURE_INTERFACE_FORCE_SOLVER_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphPressureInterfaceContactKinematicsWgsl,
  sphPressureInterfaceParticleBinsWgsl,
  sphPressureInterfaceForceRowsWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import { gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline, deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice, webGpuDeviceMismatchInfo } from './sphGpuDeviceIdentity.js';

export const SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS = SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length;
export const SPH_PRESSURE_INTERFACE_FORCE_FLOATS = SPH_PRESSURE_INTERFACE_FORCE_ROW_LAYOUT.length;
export const SPH_GAS_PRESSURE_CELL_FLOATS = 12;
export const SPH_ALGORITHM_CONTACT_POLICY_FLOATS = 16;
export const SPH_INTERFACE_CONTACT_KINEMATICS_FLOATS = 4;
export const ULG_ALGORITHM_CONTACT_PAIR_RESPONSE_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-pair-response.v0';
export const ULG_INTERFACE_CONTACT_KINEMATICS_SCHEMA =
  'peercompute.ulg.sph-interface-contact-kinematics.v0';

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
  return {
    ...base,
    status: 'schroeder-pressure-interface-law-neighbor-candidates-ready',
    consumerStatus: 'schroeder-pressure-interface-law-neighbor-candidates-observed-not-authoritative',
    reason: 'Bounded law-neighbor candidate rows are validated but not authoritative until SS active-node/tree traversal replaces the source-window enumerator',
    available: true,
    authoritative: false,
    neighborCandidateBuffer,
    neighborCandidateBufferObserved: true,
    neighborCandidateBufferConsumed: false,
    neighborCandidateCount,
    neighborCandidateStrideFloats,
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
  contactPolicyBuffer,
  particleSource,
  particleBinGrid = null,
  particleBins = null,
  maxSearchRadiusM = DEFAULT_CONTACT_KINEMATICS_MAX_SEARCH_RADIUS_M,
  gapFloorM = DEFAULT_CONTACT_KINEMATICS_GAP_FLOOR_M,
  schroederLawQueue = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceContactKinematicsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  if (!packedInterfaceElements?.rows || !packedContactPolicy?.rows || !interfaceElementsBuffer || !contactPolicyBuffer || particleSource?.ready !== true) {
    throw new TypeError('runSphPressureInterfaceContactKinematicsWebGpu requires packed interface rows, contact rows, source buffers, and particle buffers');
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
    cacheKey: 'ulg-sph-pressure-interface-contact-kinematics.v1',
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
      computeBufferBinding(9, 'uniform')
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
      { binding: 9, resource: { buffer: schroederLawQueueParamsBuffer } }
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
    queueCompletionStatus: 'queue-submitted',
    queueCompletionMethod: 'queue.submit',
    derivation: resolvedParticleBins.enabled
      ? `${consumedSchroederLawQueue.enabled ? 'schroeder-law-queue-gated-' : ''}gpu-interface-element-neighbor-bin-contact-kinematics`
      : `${consumedSchroederLawQueue.enabled ? 'schroeder-law-queue-gated-' : ''}gpu-interface-element-nearest-particle-contact-kinematics`,
    source: 'resident-sph-particle-state-and-thermo-buffers',
    cleanupBuffers: [
      paramsBuffer,
      localSchroederLawQueueBuffer,
      schroederLawQueueParamsBuffer,
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
  schroederLawNeighborCandidates = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphPressureInterfaceForceRowsWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  const pressurePa = finiteNumber(
    pressureFeedback?.gasCellField?.uniformPressurePa ?? pressureFeedback?.totalPressurePa,
    Number.NaN
  );
  const pressureFieldResolution = gasPressureFieldResolutionDiagnostics(pressureFeedback?.gasCellField);
  const packed = packMaterialInterfaceElementRows(materialInterfaceField);
  const packedContactKinematics = packMaterialInterfaceContactKinematicsRows(materialInterfaceField);
  const packedGasPressureCells = packGasPressureCellRows(pressureFeedback?.gasCellField || null);
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
  const contactKinematicsGpuDerivationEligible = canDeriveInterfaceContactKinematicsOnGpu({
    packedInterfaceElements: packed,
    packedContactPolicy,
    packedContactKinematics,
    particleSource
  });
  const contactKinematicsParticleBinGrid = contactKinematicsGpuDerivationEligible
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
  const gasPressureCellsBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-gas-cells-in', packedGasPressureCells.rows);
  const contactPolicyBuffer = writeStorageBuffer(device, 'ulg-sph-pressure-interface-contact-policy-rows', packedContactPolicy.rows);
  let contactKinematicsBuffer = null;
  let contactKinematicsGpuDerivation = null;
  let contactKinematicsGpuDerived = false;
  let contactKinematicsParticleBins = null;
  let particleBinOverflowStatus = null;
  let particleBinOverflowCount = null;
  const contactKinematicsCleanupBuffers = [];
  if (contactKinematicsGpuDerivationEligible) {
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
      schroederLawQueue: schroederPressureInterfaceLawQueue
    });
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
      cacheKey: 'ulg-sph-pressure-interface-force-rows.v3',
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

    let forceRowValues = new Float32Array(0);
    if (!noFullReadback) {
      await readBuffer.mapAsync(GPU_MAP_MODE.READ);
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      forceRowValues = new Float32Array(readBuffer.getMappedRange()).slice(0, packed.rowCount * SPH_PRESSURE_INTERFACE_FORCE_FLOATS);
      readBuffer.unmap();
    } else {
      queueCompletionStatus = device.queue?.onSubmittedWorkDone
      ? 'queue-submitted-cleanup-deferred'
      : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : null;
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

    const summary = summarizeForceRowsFromElements(packed.elements, pressurePa, pressureFeedback?.gasCellField || null, contactPolicy);
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
      forceApplicationStatus: 'solver-ready-not-applied',
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
      gasPressureCellRowStrideFloats: SPH_GAS_PRESSURE_CELL_FLOATS,
      gasPressureCellRowsBufferRetained: retainForceRowsBuffer === true && packedGasPressureCells.rowCount > 0,
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
      totalInterfaceAreaM2: materialInterfaceField?.totalSurfaceAreaM2 ?? summary.totalInterfaceAreaM2,
      totalAbsMaterialForceN: summary.totalAbsMaterialForceN,
      netMaterialForceN: summary.netMaterialForceN,
      netGasReactionForceN: summary.netGasReactionForceN,
      conservationResidualN: summary.conservationResidualN,
      conservationResidualMagnitudeN: summary.conservationResidualMagnitudeN,
      maxPairResidualN: summary.maxPairResidualN,
      conservationStatus: summary.maxPairResidualN <= 1e-9
        ? 'pairwise-equal-opposite-force-conservative'
        : 'pairwise-force-residual-nonzero',
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
      gasPressureCellRowsBufferRetained: retainForceRowsBuffer === true && packedGasPressureCells.rowCount > 0,
      algorithmContactPolicyRowCount: packedContactPolicy.rowCount,
      algorithmContactPolicyRowByteLength: packedContactPolicy.rowByteLength,
      interfaceContactKinematicsRowCount: packedContactKinematics.rowCount,
      interfaceContactKinematicsReadyCount: packedContactKinematics.readyCount,
      interfaceContactKinematicsRowByteLength: packedContactKinematics.rowByteLength,
      interfaceContactKinematicsGpuDerivationEligible: contactKinematicsGpuDerivationEligible,
      interfaceContactKinematicsGpuDerived: contactKinematicsGpuDerived,
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
      forceRowValues,
      pressureInterfaceForceRowsRetained: outputByteLength > 0
    };
    if (retainForceRowsBuffer) {
      result.forceRowsBuffer = forceRowsBuffer;
      result.forceRowsBufferByteLength = outputByteLength;
      result.destroyForceRowsBuffer = () => forceRowsBuffer.destroy?.();
      returnedRetainedForceRowsBuffer = true;
    }
    if (retainForceRowsBuffer && packedGasPressureCells.rowCount > 0) {
      result.gasPressureCellsBuffer = gasPressureCellsBuffer;
      result.gasPressureCellRowsBufferByteLength = packedGasPressureCells.rowByteLength;
      result.destroyGasPressureCellsBuffer = () => gasPressureCellsBuffer.destroy?.();
      returnedRetainedGasPressureCellsBuffer = true;
    }
    return result;
  } finally {
    const cleanup = () => {
      inputBuffer.destroy?.();
      if (!returnedRetainedGasPressureCellsBuffer) gasPressureCellsBuffer.destroy?.();
      contactPolicyBuffer.destroy?.();
      contactKinematicsBuffer.destroy?.();
      for (const buffer of contactKinematicsCleanupBuffers) buffer?.destroy?.();
      paramsBuffer.destroy?.();
      readBuffer?.destroy?.();
      if (!retainForceRowsBuffer || !returnedRetainedForceRowsBuffer) forceRowsBuffer.destroy?.();
    };
    if (noFullReadback) {
      deferSubmittedWorkCleanup(device, cleanup);
    } else {
      cleanup();
    }
  }
}
