import {
  SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT,
  SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_ROW_LAYOUT,
  SPH_INTERFACE_SOURCE_KEY_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT,
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  SPH_GPU_RENDER_ROW_LAYOUT,
  SPH_GPU_RENDER_SURFACE_ROW_LAYOUT,
  ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
  ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphRenderMarchingCubeCellsWgsl,
  sphRenderFieldSurfaceSummaryWgsl,
  sphRenderSurfaceDrawWgsl,
  sphRenderSurfaceVerticesWgsl,
  sphMaterialInterfaceCandidatesWgsl,
  sphMaterialInterfaceCompactCandidatesWgsl,
  sphRenderFieldWgsl,
  sphRenderRowsWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  GPU_PHASE_IDS,
  gpuPhaseId,
  requestOpticalGpuDevice,
  stableOpticalMaterialId,
  stableOpticalStateId,
  stableOpticalStateKey
} from '../material/opticalGpuBuffers.js';
import { opticalRenderParams } from '../material/opticalClosure.js';
import { incandescentColor } from '../material/radiationClosure.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline,
  createExplicitComputePipeline,
  deferSubmittedWorkCleanup
} from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  addResidentBufferLease,
  createResidentBufferLeaseLedger,
  destroyResidentBufferWithLease,
  registerResidentBufferResource,
  releaseResidentBufferLease,
  summarizeResidentBufferLeaseLedger
} from '../residentBufferLease.js';

export {
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
  ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
  ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  sphRenderMarchingCubeCellsWgsl,
  sphRenderFieldSurfaceSummaryWgsl,
  sphRenderSurfaceDrawWgsl,
  sphRenderSurfaceVerticesWgsl,
  sphMaterialInterfaceCandidatesWgsl,
  sphMaterialInterfaceCompactCandidatesWgsl,
  sphRenderFieldWgsl,
  sphRenderRowsWgsl
};

export const SPH_GPU_RENDER_ROW_FLOATS = SPH_GPU_RENDER_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_SURFACE_ROW_FLOATS = SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_FIELD_CELL_FLOATS = SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS = SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS = SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS = SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_SURFACE_DRAW_FLOATS = SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT.length;
export const SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS = SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT.length;
export const SPH_INTERFACE_SOURCE_KEY_FLOATS = SPH_INTERFACE_SOURCE_KEY_ROW_LAYOUT.length;
export const SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS = SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT.length;
export const SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS = SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT.length;
export const SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT = 64 * 1024 * 1024;
export const SPH_MATERIAL_INTERFACE_COMPACT_CANDIDATE_ROWS_DEFAULT = 32_768;
export const SPH_SURFACE_VERTEX_COMPACT_BYTE_BUDGET_DEFAULT = 64 * 1024 * 1024;
export const SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO = 4;
export const SPH_RENDER_ROW_MAX_VOLUME_RATIO_J = SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO ** 3;
export const SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO = 2;
export const SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO = 0.5;
const SPH_RENDER_ROWS_PARAMS_BYTES = 48;
export const ULG_SPH_RENDER_ROW_PARTICLE_SCALE_STABILITY_SCHEMA =
  'peercompute.ulg.sph-render-row-particle-scale-stability.v0';
export const ULG_SPH_RENDER_ROW_MATERIAL_BANK_PARTICLE_SIZE_CONSUMER_SCHEMA =
  'peercompute.ulg.sph-render-row-material-bank-particle-size-consumer.v0';

const RENDER_SCOPE = 'sph-resident-render-row-extraction';
const RENDER_FIELD_SCOPE = 'sph-resident-render-field-splat';
const MATERIAL_INTERFACE_SOURCE_FIELD_SCOPE = 'sph-resident-material-interface-source-field-splat';
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const MATERIAL_INTERFACE_DENSE_CANDIDATE_READBACK_MODE = 'dense-readback';
const MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE = 'compact-active-readback';
const MATERIAL_INTERFACE_GPU_RESIDENT_SUMMARY_MODE = 'gpu-resident-summary';
const SURFACE_VERTEX_EMISSION_FIXED_CELL_SLOTS = 'fixed-cell-slots';
const SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT = 'atomic-compact';
const PHASE_NAMES_BY_ID = Object.freeze(Object.fromEntries(
  Object.entries(GPU_PHASE_IDS).map(([name, id]) => [id, name])
));

const GPU_BUFFER_USAGE = {
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  VERTEX: globalThis.GPUBufferUsage?.VERTEX ?? 32,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

const GPU_MAP_MODE = {
  READ: globalThis.GPUMapMode?.READ ?? 1
};

function assertPackedSphParticleState(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH render rows require a packed SPH GPU particle buffer');
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSurfaceVertexEmissionMode(value, { noFullReadback = false } = {}) {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
    || normalized === 'webgpu-atomic-compact'
    || normalized === 'compact'
  ) {
    return SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT;
  }
  if (
    normalized === SURFACE_VERTEX_EMISSION_FIXED_CELL_SLOTS
    || normalized === 'webgpu-fixed-cell-slots'
    || normalized === 'fixed'
  ) {
    return SURFACE_VERTEX_EMISSION_FIXED_CELL_SLOTS;
  }
  return noFullReadback
    ? SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
    : SURFACE_VERTEX_EMISSION_FIXED_CELL_SLOTS;
}

function surfaceVertexEmissionModeId(mode) {
  return mode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT ? 1 : 0;
}

function resolveSurfaceVertexRowBudget({
  requiredVertexRows = 0,
  requestedMaxVertexRows = null,
  emissionMode = SURFACE_VERTEX_EMISSION_FIXED_CELL_SLOTS,
  compactByteBudget = SPH_SURFACE_VERTEX_COMPACT_BYTE_BUDGET_DEFAULT
} = {}) {
  const requiredRows = Math.max(0, Math.round(finiteNumber(requiredVertexRows, 0)));
  const requestedRows = requestedMaxVertexRows != null && requestedMaxVertexRows !== ''
    && Number.isFinite(Number(requestedMaxVertexRows))
    ? Math.max(0, Math.round(Number(requestedMaxVertexRows)))
    : null;
  if (emissionMode !== SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT) {
    return Math.max(requiredRows, requestedRows ?? requiredRows);
  }
  const rowByteLength = SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const budgetRows = Math.max(0, Math.floor(
    Math.max(rowByteLength, finiteNumber(compactByteBudget, SPH_SURFACE_VERTEX_COMPACT_BYTE_BUDGET_DEFAULT))
      / rowByteLength
  ));
  const requestedOrBudgetRows = requestedRows ?? budgetRows;
  const cappedRows = Math.min(requiredRows, requestedOrBudgetRows);
  return requiredRows > 0 ? Math.max(3, cappedRows - (cappedRows % 3)) : 0;
}

function phaseNameForId(phaseId) {
  return PHASE_NAMES_BY_ID[Math.round(finiteNumber(phaseId, 0))] || 'unknown';
}

function renderKeyFor(material, phase) {
  if (material === 'h2o' && phase === 'solid') return 'ice';
  if (material === 'h2o' && phase === 'gas') return 'steam';
  return material || 'unknown';
}

function renderDomainKeyForId(renderDomainId) {
  const id = Math.round(finiteNumber(renderDomainId, 0));
  if (id === 1) return 'base';
  if (id === 2) return 'drop';
  return null;
}

function canonicalRenderMaterialKey(material) {
  const key = String(material || '').trim();
  if (!key) return 'unknown';
  return /^[A-Z][a-z]?$/.test(key) ? key : key.toLowerCase();
}

export function buildSphRenderMaterialMap(materialProperties = {}, reactionTable = null) {
  const entries = new Map();
  for (const material of Object.keys(materialProperties || {})) {
    entries.set(stableOpticalMaterialId(material), canonicalRenderMaterialKey(material));
  }
  for (const reaction of reactionTable?.metadata || []) {
    if (reaction.product) entries.set(reaction.productMaterialId, reaction.product);
    if (reaction.a) entries.set(reaction.aMaterialId, reaction.a);
    if (reaction.b) entries.set(reaction.bMaterialId, reaction.b);
    for (const term of reaction.productTerms || []) {
      if (term.material && Number.isFinite(term.materialId)) {
        entries.set(term.materialId, term.material);
      }
    }
    for (const term of reaction.reactantTerms || []) {
      if (term.material && Number.isFinite(term.materialId)) {
        entries.set(term.materialId, term.material);
      }
    }
  }
  for (const term of reactionTable?.productTermMetadata || []) {
    if (term.material && Number.isFinite(term.materialId)) {
      entries.set(term.materialId, term.material);
    }
  }
  for (const term of reactionTable?.reactantTermMetadata || []) {
    if (term.material && Number.isFinite(term.materialId)) {
      entries.set(term.materialId, term.material);
    }
  }
  return entries;
}

function colorFor({ material, phase, temperatureK, materialProperties }) {
  const incandescence = incandescentColor(temperatureK);
  if (incandescence.visible) return [...incandescence.srgb];
  const properties = materialProperties?.[material]
    ?? materialProperties?.[String(material).toLowerCase()]
    ?? materialProperties?.[String(material).toUpperCase()]
    ?? null;
  const optics = opticalRenderParams({ material, phase, properties });
  return optics.baseColorSrgb ?? optics.pbr?.baseColorSrgb ?? [1, 1, 1];
}

export function emissiveByMaterialFromSphRenderRows(rows = []) {
  const acc = {};
  for (const row of rows || []) {
    const incandescence = incandescentColor(row.temperatureK);
    if (!incandescence.visible) continue;
    const lum = 0.2126 * incandescence.srgb[0] + 0.7152 * incandescence.srgb[1] + 0.0722 * incandescence.srgb[2];
    const keys = [row.material, row.renderKey].filter(Boolean);
    for (const key of keys) {
      const entry = acc[key] || (acc[key] = { r: 0, g: 0, b: 0, w: 0 });
      entry.r += incandescence.srgb[0] * lum;
      entry.g += incandescence.srgb[1] * lum;
      entry.b += incandescence.srgb[2] * lum;
      entry.w += lum;
    }
  }
  const out = {};
  for (const [material, entry] of Object.entries(acc)) {
    out[material] = entry.w > 0
      ? [entry.r / entry.w, entry.g / entry.w, entry.b / entry.w]
      : null;
  }
  return out;
}

export function decodeSphRenderRows(renderRows, {
  materialProperties = {},
  reactionTable = null,
  materialMap = buildSphRenderMaterialMap(materialProperties, reactionTable),
  gasPressureSummary = null
} = {}) {
  if (!(renderRows instanceof Float32Array)) {
    throw new TypeError('decodeSphRenderRows requires Float32Array render rows');
  }
  if (renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  const particleCount = renderRows.length / SPH_GPU_RENDER_ROW_FLOATS;
  const positionsM = new Float32Array(particleCount * 3);
  const colorsRgb = new Float32Array(particleCount * 3);
  const currentVolumesM3 = new Float32Array(particleCount);
  const particleRadiiM = new Float32Array(particleCount);
  const materials = new Array(particleCount);
  const rows = [];

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * SPH_GPU_RENDER_ROW_FLOATS;
    const materialId = renderRows[offset + 4];
    const phaseId = renderRows[offset + 5];
    const material = materialMap.get(materialId) || 'unknown';
    const phase = phaseNameForId(phaseId);
    const renderKey = renderKeyFor(material, phase);
    const temperatureK = renderRows[offset + 6];
    const renderDomainId = Math.max(0, Math.round(finiteNumber(renderRows[offset + 11], 0)));
    const currentVolumeM3 = finiteNumber(renderRows[offset + 12], 0);
    const particleRadiusM = finiteNumber(renderRows[offset + 13], 0);
    const volumeRatioJ = finiteNumber(renderRows[offset + 14], 1);
    const pressurePa = finiteNumber(renderRows[offset + 15], 0);
    const renderDomainKey = renderDomainKeyForId(renderDomainId);
    const h2oGas = gasPressureSummary?.bySpecies?.h2o || null;
    const opticalState = material === 'h2o' && phase === 'gas' && h2oGas
      ? {
          temperatureK: Number.isFinite(h2oGas.temperatureK) ? h2oGas.temperatureK : temperatureK,
          h2oPartialPressurePa: h2oGas.partialPressurePa,
          pressurePa: gasPressureSummary.totalPressurePa,
          source: gasPressureSummary.source || gasPressureSummary.status || 'gas-pressure-summary'
        }
      : null;
    const rgb = colorFor({ material, phase, temperatureK, materialProperties });
    positionsM.set([renderRows[offset], renderRows[offset + 1], renderRows[offset + 2]], index * 3);
    colorsRgb.set(rgb, index * 3);
    currentVolumesM3[index] = currentVolumeM3;
    particleRadiiM[index] = particleRadiusM;
    const descriptor = opticalState
      ? { material, phase, renderKey, opticalState }
      : { material, phase, renderKey };
    if (renderDomainId > 0) {
      descriptor.renderDomainId = renderDomainId;
      descriptor.renderDomainKey = renderDomainKey;
    }
    materials[index] = descriptor;
    rows.push({
      index,
      positionM: [renderRows[offset], renderRows[offset + 1], renderRows[offset + 2]],
      massKg: renderRows[offset + 3],
      materialId,
      material,
      phaseId,
      phase,
      temperatureK,
      status: renderRows[offset + 7],
      restDensityKgPerM3: renderRows[offset + 8],
      phaseFractionGas: renderRows[offset + 9],
      representedEntityCount: renderRows[offset + 10],
      renderDomainId,
      renderDomainKey,
      currentVolumeM3,
      particleRadiusM,
      volumeRatioJ,
      pressurePa,
      renderKey,
      opticalState
    });
  }

  return {
    schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
    status: 'render-rows-decoded',
    particleCount,
    positionsM,
    colorsRgb,
    currentVolumesM3,
    particleRadiiM,
    materials,
    rows,
    emissiveByMaterial: emissiveByMaterialFromSphRenderRows(rows),
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function renderDomainIdForParticleIndex(index, {
  renderDomainBaseCount = 0,
  renderDomainDropCount = 0
} = {}) {
  const baseCount = Math.max(0, Math.round(finiteNumber(renderDomainBaseCount, 0)));
  const dropCount = Math.max(0, Math.round(finiteNumber(renderDomainDropCount, 0)));
  if (baseCount > 0 && index < baseCount) return 1;
  if (dropCount > 0 && index >= baseCount && index < baseCount + dropCount) return 2;
  return 0;
}

function particleVolumeM3FromMassDensity(massKg, restDensityKgPerM3) {
  const mass = finiteNumber(massKg, 0);
  const restDensity = finiteNumber(restDensityKgPerM3, 0);
  return mass > 0 && restDensity > 0 ? mass / restDensity : 0;
}

function particleRadiusMFromVolume(volumeM3) {
  const volume = finiteNumber(volumeM3, 0);
  if (!(volume > 0)) return 0;
  return Math.cbrt((3 * volume) / (4 * Math.PI));
}

function particleVolumeM3FromRadius(radiusM) {
  const radius = finiteNumber(radiusM, 0);
  return radius > 0 ? (4 * Math.PI * radius ** 3) / 3 : 0;
}

function createParticleScaleStabilitySummary({
  particleCount,
  rowProducer,
  maxSupportRadiusM = 0,
  maxGasRadiusM = 0
}) {
  return {
    schema: ULG_SPH_RENDER_ROW_PARTICLE_SCALE_STABILITY_SCHEMA,
    status: 'particle-scale-bounded',
    rowProducer,
    particleCount,
    maxRadiusGrowthRatioAllowed: SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO,
    maxVolumeRatioJAllowed: SPH_RENDER_ROW_MAX_VOLUME_RATIO_J,
    maxSupportRadiusSmoothingRatioAllowed: SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO,
    maxSupportRadiusM: Math.max(0, finiteNumber(maxSupportRadiusM, 0)),
    maxGasRadiusSmoothingRatioAllowed: SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO,
    maxGasParticleRadiusM: Math.max(0, finiteNumber(maxGasRadiusM, 0)),
    supportRadiusPolicyAppliedInShader: false,
    capAppliedCount: 0,
    maxRawParticleRadiusM: 0,
    maxParticleRadiusM: 0,
    maxRawRadiusGrowthRatio: 0,
    maxEffectiveRadiusGrowthRatio: 0,
    maxRawVolumeRatioJ: 0,
    maxEffectiveVolumeRatioJ: 0,
    sampleCappedRows: [],
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function trackParticleScaleStability(summary, volumeState, {
  index,
  materialId,
  phaseId,
  maxSampleRows = 8
} = {}) {
  if (!summary || !volumeState) return;
  summary.maxRawParticleRadiusM = Math.max(
    summary.maxRawParticleRadiusM,
    finiteNumber(volumeState.rawParticleRadiusM, 0)
  );
  summary.maxParticleRadiusM = Math.max(
    summary.maxParticleRadiusM,
    finiteNumber(volumeState.particleRadiusM, 0)
  );
  summary.maxRawRadiusGrowthRatio = Math.max(
    summary.maxRawRadiusGrowthRatio,
    finiteNumber(volumeState.rawRadiusGrowthRatio, 0)
  );
  summary.maxEffectiveRadiusGrowthRatio = Math.max(
    summary.maxEffectiveRadiusGrowthRatio,
    finiteNumber(volumeState.effectiveRadiusGrowthRatio, 0)
  );
  summary.maxRawVolumeRatioJ = Math.max(
    summary.maxRawVolumeRatioJ,
    finiteNumber(volumeState.rawVolumeRatioJ, 0)
  );
  summary.maxEffectiveVolumeRatioJ = Math.max(
    summary.maxEffectiveVolumeRatioJ,
    finiteNumber(volumeState.volumeRatioJ, 0)
  );
  if (!volumeState.radiusCapApplied) return;
  summary.capAppliedCount += 1;
  summary.status = 'particle-scale-cap-applied';
  if (summary.sampleCappedRows.length >= maxSampleRows) return;
  summary.sampleCappedRows.push({
    index,
    materialId,
    phaseId,
    reason: volumeState.radiusCapReason,
    restVolumeM3: volumeState.restVolumeM3,
    rawCurrentVolumeM3: volumeState.rawCurrentVolumeM3,
    currentVolumeM3: volumeState.currentVolumeM3,
    restParticleRadiusM: volumeState.restParticleRadiusM,
    rawParticleRadiusM: volumeState.rawParticleRadiusM,
    particleRadiusM: volumeState.particleRadiusM,
    rawVolumeRatioJ: volumeState.rawVolumeRatioJ,
    volumeRatioJ: volumeState.volumeRatioJ,
    rawRadiusGrowthRatio: volumeState.rawRadiusGrowthRatio,
    effectiveRadiusGrowthRatio: volumeState.effectiveRadiusGrowthRatio
  });
}

function renderParticleScaleStabilityPolicy({
  particleCount,
  rowProducer,
  maxSupportRadiusM = 0,
  maxGasRadiusM = 0
}) {
  return {
    schema: ULG_SPH_RENDER_ROW_PARTICLE_SCALE_STABILITY_SCHEMA,
    status: 'gpu-row-cap-policy-applied-in-shader',
    rowProducer,
    particleCount,
    maxRadiusGrowthRatioAllowed: SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO,
    maxVolumeRatioJAllowed: SPH_RENDER_ROW_MAX_VOLUME_RATIO_J,
    maxSupportRadiusSmoothingRatioAllowed: SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO,
    maxSupportRadiusM: Math.max(0, finiteNumber(maxSupportRadiusM, 0)),
    maxGasRadiusSmoothingRatioAllowed: SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO,
    maxGasParticleRadiusM: Math.max(0, finiteNumber(maxGasRadiusM, 0)),
    supportRadiusPolicyAppliedInShader: true,
    capAppliedCount: null,
    capAppliedCountKnown: false,
    reason: 'WebGPU retained render rows apply radius growth, J, support-radius, and gas visual-radius caps in shader without a CPU particle scan',
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function renderVolumeStateForParticle({
  sphParticleState,
  mlsMpmParticleState = null,
  particleIndex,
  massKg,
  restDensityKgPerM3,
  visualParticleRadiusM = 0,
  phaseId = GPU_PHASE_IDS.unknown,
  maxSupportRadiusM = 0,
  maxGasRadiusM = 0
} = {}) {
  const fallbackRestVolumeM3 = particleVolumeM3FromMassDensity(massKg, restDensityKgPerM3);
  const visualRestVolumeM3 = particleVolumeM3FromRadius(visualParticleRadiusM);
  let restVolumeM3 = visualRestVolumeM3 > 0 ? visualRestVolumeM3 : fallbackRestVolumeM3;
  let volumeRatioJ = 1;
  let pressurePa = 0;
  const mechanics = mlsMpmParticleState?.mechanics;
  if (
    mechanics instanceof Float32Array
    && particleIndex >= 0
    && particleIndex < finiteNumber(sphParticleState?.particleCount, 0)
  ) {
    const mechanicsOffset = particleIndex * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
    if (mechanicsOffset + 28 < mechanics.length) {
      const mechanicsJ = finiteNumber(mechanics[mechanicsOffset + 18], 1);
      const mechanicsRestVolumeM3 = finiteNumber(mechanics[mechanicsOffset + 19], 0);
      const mechanicsPressurePa = finiteNumber(mechanics[mechanicsOffset + 28], 0);
      volumeRatioJ = mechanicsJ > 0 ? mechanicsJ : 1;
      if (mechanicsRestVolumeM3 > 0 && !(visualRestVolumeM3 > 0)) restVolumeM3 = mechanicsRestVolumeM3;
      pressurePa = Math.max(mechanicsPressurePa, 0);
    }
  }
  const effectiveRawVolumeRatioJ = Math.max(volumeRatioJ, 1e-9);
  const rawCurrentVolumeM3 = Math.max(restVolumeM3 * effectiveRawVolumeRatioJ, 0);
  const restParticleRadiusM = particleRadiusMFromVolume(restVolumeM3);
  const rawParticleRadiusM = particleRadiusMFromVolume(rawCurrentVolumeM3);
  const rawRadiusGrowthRatio = restParticleRadiusM > 0 && rawParticleRadiusM > 0
    ? rawParticleRadiusM / restParticleRadiusM
    : 0;
  let currentVolumeM3 = rawCurrentVolumeM3;
  let particleRadiusM = rawParticleRadiusM;
  let effectiveVolumeRatioJ = effectiveRawVolumeRatioJ;
  let effectiveRadiusGrowthRatio = rawRadiusGrowthRatio;
  let radiusCapApplied = false;
  let radiusCapReason = null;
  const maxParticleRadiusM = restParticleRadiusM * SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO;
  if (
    restParticleRadiusM > 0
    && rawParticleRadiusM > maxParticleRadiusM
  ) {
    radiusCapApplied = true;
    radiusCapReason = 'max-radius-growth-ratio';
    particleRadiusM = maxParticleRadiusM;
    currentVolumeM3 = restVolumeM3 * SPH_RENDER_ROW_MAX_VOLUME_RATIO_J;
    effectiveVolumeRatioJ = SPH_RENDER_ROW_MAX_VOLUME_RATIO_J;
    effectiveRadiusGrowthRatio = SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO;
  }
  const supportRadiusCapM = finiteNumber(maxSupportRadiusM, 0);
  if (supportRadiusCapM > 0 && particleRadiusM > supportRadiusCapM) {
    radiusCapApplied = true;
    radiusCapReason = radiusCapReason
      ? `${radiusCapReason}+max-support-radius`
      : 'max-support-radius';
    particleRadiusM = supportRadiusCapM;
    currentVolumeM3 = particleVolumeM3FromRadius(supportRadiusCapM);
    effectiveVolumeRatioJ = restVolumeM3 > 0
      ? Math.max(currentVolumeM3 / restVolumeM3, 1e-9)
      : effectiveVolumeRatioJ;
    effectiveRadiusGrowthRatio = restParticleRadiusM > 0
      ? particleRadiusM / restParticleRadiusM
      : 0;
  }
  const gasRadiusCapM = finiteNumber(maxGasRadiusM, 0);
  const gasPhase = Math.round(finiteNumber(phaseId, GPU_PHASE_IDS.unknown)) === GPU_PHASE_IDS.gas;
  if (gasPhase && gasRadiusCapM > 0 && particleRadiusM > gasRadiusCapM) {
    radiusCapApplied = true;
    radiusCapReason = radiusCapReason
      ? `${radiusCapReason}+gas-phase-visual-radius-proxy`
      : 'gas-phase-visual-radius-proxy';
    particleRadiusM = gasRadiusCapM;
    currentVolumeM3 = particleVolumeM3FromRadius(gasRadiusCapM);
    effectiveVolumeRatioJ = restVolumeM3 > 0
      ? Math.max(currentVolumeM3 / restVolumeM3, 1e-9)
      : effectiveVolumeRatioJ;
    effectiveRadiusGrowthRatio = restParticleRadiusM > 0
      ? particleRadiusM / restParticleRadiusM
      : 0;
  }
  return {
    currentVolumeM3,
    particleRadiusM,
    volumeRatioJ: effectiveVolumeRatioJ,
    pressurePa,
    restVolumeM3,
    rawCurrentVolumeM3,
    restParticleRadiusM,
    rawParticleRadiusM,
    rawVolumeRatioJ: effectiveRawVolumeRatioJ,
    rawRadiusGrowthRatio,
    effectiveRadiusGrowthRatio,
    radiusCapApplied,
    radiusCapReason
  };
}

export function extractSphRenderRowsCpu({
  sphParticleState,
  mlsMpmParticleState = null,
  renderDomainBaseCount = 0,
  renderDomainDropCount = 0
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  const renderRows = new Float32Array(sphParticleState.particleCount * SPH_GPU_RENDER_ROW_FLOATS);
  const maxSupportRadiusM = finiteNumber(sphParticleState.smoothingLengthM, 0)
    * SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO;
  const maxGasRadiusM = finiteNumber(sphParticleState.smoothingLengthM, 0)
    * SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO;
  const particleScaleStability = createParticleScaleStabilitySummary({
    particleCount: sphParticleState.particleCount,
    rowProducer: 'cpu-reference',
    maxSupportRadiusM,
    maxGasRadiusM
  });
  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const renderOffset = index * SPH_GPU_RENDER_ROW_FLOATS;
    const massKg = sphParticleState.state[stateOffset + 3];
    const materialId = sphParticleState.thermo[thermoOffset];
    const phaseId = sphParticleState.thermo[thermoOffset + 1];
    const restDensityKgPerM3 = sphParticleState.thermo[thermoOffset + 3];
    const visualParticleRadiusM = sphParticleState.thermo[thermoOffset + 11];
    const volumeState = renderVolumeStateForParticle({
      sphParticleState,
      mlsMpmParticleState,
      particleIndex: index,
      massKg,
      restDensityKgPerM3,
      visualParticleRadiusM,
      phaseId,
      maxSupportRadiusM,
      maxGasRadiusM
    });
    trackParticleScaleStability(particleScaleStability, volumeState, {
      index,
      materialId,
      phaseId
    });
    renderRows.set([
      sphParticleState.state[stateOffset],
      sphParticleState.state[stateOffset + 1],
      sphParticleState.state[stateOffset + 2],
      massKg,
      materialId,
      phaseId,
      sphParticleState.thermo[thermoOffset + 2],
      sphParticleState.thermo[thermoOffset + 10],
      restDensityKgPerM3,
      sphParticleState.thermo[thermoOffset + 6],
      sphParticleState.thermo[thermoOffset + 9],
      renderDomainIdForParticleIndex(index, { renderDomainBaseCount, renderDomainDropCount }),
      volumeState.currentVolumeM3,
      volumeState.particleRadiusM,
      volumeState.volumeRatioJ,
      volumeState.pressurePa
    ], renderOffset);
  }
  return {
    schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
    backend: 'cpu-reference',
    status: 'render-rows-extracted',
    kernelScope: RENDER_SCOPE,
    particleCount: sphParticleState.particleCount,
    rowLayout: [...SPH_GPU_RENDER_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_ROW_FLOATS,
    renderRows,
    renderRowByteLength: renderRows.byteLength,
    particleScaleStability,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  assertWebGpuBufferSizeFitsDevice(device, label, byteLength);
  assertWebGpuStorageBufferBindingSizeFitsDevice(device, label, byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function webGpuDeviceMaxBufferSize(device) {
  const value = Number(device?.limits?.maxBufferSize);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function webGpuDeviceMaxStorageBufferBindingSize(device) {
  const value = Number(device?.limits?.maxStorageBufferBindingSize);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function assertWebGpuBufferSizeFitsDevice(device, label, byteLength) {
  const maxBufferSize = webGpuDeviceMaxBufferSize(device);
  if (maxBufferSize == null) return;
  if (byteLength <= maxBufferSize) return;
  throw new RangeError(`${label} byte length ${byteLength} exceeds WebGPU device maxBufferSize ${maxBufferSize}`);
}

function assertWebGpuStorageBufferBindingSizeFitsDevice(device, label, byteLength) {
  const maxStorageBufferBindingSize = webGpuDeviceMaxStorageBufferBindingSize(device);
  if (maxStorageBufferBindingSize == null) return;
  if (byteLength <= maxStorageBufferBindingSize) return;
  throw new RangeError(`${label} byte length ${byteLength} exceeds WebGPU device maxStorageBufferBindingSize ${maxStorageBufferBindingSize}`);
}

function materialInterfaceCandidateRowsByteLength(renderField = null) {
  const totalFieldCells = Math.max(0, Math.round(finiteNumber(renderField?.totalFieldCells, 0)));
  return totalFieldCells * 3 * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
}

function materialInterfaceCandidateReadbackBlocker({
  device,
  candidateRowsByteLength,
  candidateReadbackByteBudget = SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT
} = {}) {
  const byteLength = Math.max(4, Math.round(finiteNumber(candidateRowsByteLength, 0)));
  const budget = Math.max(0, Math.round(finiteNumber(
    candidateReadbackByteBudget,
    SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT
  )));
  if (budget > 0 && byteLength > budget) {
    return {
      status: 'candidate-readback-budget-exceeded',
      reason: `material-interface candidate rows byte length ${byteLength} exceeds readback budget ${budget}`,
      byteLength,
      budget
    };
  }
  const maxBufferSize = webGpuDeviceMaxBufferSize(device);
  if (maxBufferSize != null && byteLength > maxBufferSize) {
    return {
      status: 'candidate-readback-max-buffer-size-exceeded',
      reason: `material-interface candidate rows byte length ${byteLength} exceeds WebGPU device maxBufferSize ${maxBufferSize}`,
      byteLength,
      maxBufferSize
    };
  }
  const maxStorageBufferBindingSize = webGpuDeviceMaxStorageBufferBindingSize(device);
  if (maxStorageBufferBindingSize != null && byteLength > maxStorageBufferBindingSize) {
    return {
      status: 'candidate-readback-max-storage-binding-size-exceeded',
      reason: `material-interface candidate rows byte length ${byteLength} exceeds WebGPU device maxStorageBufferBindingSize ${maxStorageBufferBindingSize}`,
      byteLength,
      maxStorageBufferBindingSize
    };
  }
  return null;
}

function skippedPhysicsMaterialInterfaceField({
  sourceField,
  sourceRenderField,
  resolvedFieldRowsBuffer,
  resolvedSurfaceBuffer,
  source,
  sourceCadence,
  candidateRowsByteLength,
  candidateReadbackByteBudget,
  candidateReadbackBlocker,
  candidateReadbackMode,
  compactCandidateField = null
}) {
  return {
    schema: ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA,
    status: 'material-interface-field-candidate-readback-skipped',
    reason: candidateReadbackBlocker.reason,
    backend: 'webgpu-candidate-readback-skipped',
    authority: 'resident-physics-material-interface-extractor',
    source,
    sourceCadence,
    sourceFieldSchema: sourceField?.schema ?? null,
    sourceFieldStatus: sourceField?.status ?? null,
    sourceFieldBackend: sourceField?.backend ?? null,
    sourceFieldPipelineCacheStatus: sourceField?.sourceRenderFieldPipelineCacheStatus
      ?? sourceField?.pipelineCacheStatus
      ?? null,
    sourceRenderFieldSchema: sourceRenderField?.schema ?? null,
    sourceRenderFieldBackend: sourceRenderField?.backend ?? null,
    sourceRenderFieldPipelineCacheStatus: sourceRenderField?.pipelineCacheStatus
      ?? sourceField?.sourceRenderFieldPipelineCacheStatus
      ?? null,
    sourceRenderFieldReadback: Boolean(sourceRenderField?.renderFieldReadback),
    sourceFieldRowsBufferBound: Boolean(resolvedFieldRowsBuffer),
    sourceSurfaceBufferBound: Boolean(resolvedSurfaceBuffer),
    surfaceCount: sourceRenderField?.surfaceCount ?? 0,
    readySurfaceCount: 0,
    totalSurfaceAreaM2: 0,
    candidateCount: Math.max(0, Math.round(finiteNumber(sourceRenderField?.totalFieldCells, 0))) * 3,
    activeCandidateCount: 0,
    candidateBackend: compactCandidateField?.backend ?? null,
    candidateReadback: false,
    candidateReadbackMode,
    candidateRowsByteLength,
    candidateReadbackByteBudget,
    candidateReadbackBlockerStatus: candidateReadbackBlocker.status,
    candidateReadbackBlocker: candidateReadbackBlocker,
    candidateCompactStatus: compactCandidateField?.status ?? null,
    candidateCompactOverflowCount: compactCandidateField?.compactCandidateOverflowCount ?? 0,
    candidateCompactCapacity: compactCandidateField?.compactCandidateCapacity ?? null,
    elementCount: 0,
    elementLayout: [...SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT],
    elementStrideFloats: SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
    elementRows: new Float32Array(),
    elements: [],
    forceCouplingStatus: 'blocked-material-interface-candidate-readback-skipped',
    surfaces: [],
    queueCompletionStatus: 'not-submitted-candidate-readback-skipped',
    queueCompletionMethod: null,
    normalDerivation: 'candidate-readback-skipped-budget-or-device-limit',
    surfaceAreaDerivation: 'candidate-readback-skipped-budget-or-device-limit',
    physicsStage: 'material-interface-extraction',
    pressureInterfaceProducer: false,
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
}

function gpuResidentSummaryPhysicsMaterialInterfaceField({
  sourceField,
  sourceRenderField,
  resolvedFieldRowsBuffer,
  resolvedSurfaceBuffer,
  source,
  sourceCadence,
  candidateRowsByteLength,
  candidateReadbackByteBudget,
  candidateReadbackMode,
  compactCandidateCapacity = null
}) {
  const surfaceCount = sourceRenderField?.surfaceTable?.surfaceCount
    ?? sourceRenderField?.surfaceCount
    ?? 0;
  const candidateCount = Math.max(0, Math.round(finiteNumber(sourceRenderField?.totalFieldCells, 0))) * 3;
  const compactCapacity = compactMaterialInterfaceCandidateCapacity({
    candidateCount,
    surfaceCount,
    compactCandidateCapacity
  });
  const candidateCompactRowsByteLength = compactCapacity
    * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  return {
    schema: ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA,
    status: 'material-interface-field-gpu-resident-summary-pending',
    reason: 'candidate rows remain GPU-resident; CPU material-interface elements require compact readback or a GPU pressure consumer',
    backend: 'webgpu-gpu-resident-summary',
    authority: 'resident-physics-material-interface-extractor',
    source,
    sourceCadence,
    sourceFieldSchema: sourceField?.schema ?? null,
    sourceFieldStatus: sourceField?.status ?? null,
    sourceFieldBackend: sourceField?.backend ?? null,
    sourceFieldPipelineCacheStatus: sourceField?.sourceRenderFieldPipelineCacheStatus
      ?? sourceField?.pipelineCacheStatus
      ?? null,
    sourceRenderFieldSchema: sourceRenderField?.schema ?? null,
    sourceRenderFieldBackend: sourceRenderField?.backend ?? null,
    sourceRenderFieldPipelineCacheStatus: sourceRenderField?.pipelineCacheStatus
      ?? sourceField?.sourceRenderFieldPipelineCacheStatus
      ?? null,
    sourceRenderFieldReadback: Boolean(sourceRenderField?.renderFieldReadback),
    sourceFieldRowsBufferBound: Boolean(resolvedFieldRowsBuffer),
    sourceSurfaceBufferBound: Boolean(resolvedSurfaceBuffer),
    surfaceCount,
    readySurfaceCount: 0,
    totalSurfaceAreaM2: 0,
    candidateCount,
    activeCandidateCount: 0,
    activeCandidateCountPending: true,
    candidateBackend: 'gpu-resident-summary',
    candidateReadback: false,
    candidateReadbackMode,
    candidateRowsByteLength,
    candidateDenseRowsByteLength: candidateRowsByteLength,
    candidateCompactRowsByteLength,
    candidateCompactCapacity: compactCapacity,
    candidateCompactOverflowCount: 0,
    candidateCompactFallbackStatus: null,
    candidateMetadataReadback: false,
    candidateReadbackByteBudget,
    candidatePipelineCacheStatus: null,
    elementCount: 0,
    elementLayout: [...SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT],
    elementStrideFloats: SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
    elementRows: new Float32Array(),
    elements: [],
    forceCouplingStatus: 'blocked-gpu-resident-pressure-interface-consumer-required',
    surfaces: [],
    queueCompletionStatus: 'not-submitted-gpu-resident-summary',
    queueCompletionMethod: null,
    normalDerivation: 'gpu-resident-candidate-summary-pending',
    surfaceAreaDerivation: 'gpu-resident-candidate-summary-pending',
    physicsStage: 'material-interface-extraction',
    pressureInterfaceProducer: false,
    gpuAuthoritativeState: true,
    gpuResidentMaterialInterfaceSummary: true,
    gpuResidentMaterialInterfaceSummaryPending: true,
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
}

function createParamsArray({
  particleCount,
  renderDomainBaseCount = 0,
  renderDomainDropCount = 0,
  hasMechanics = false,
  maxSupportRadiusM = 0,
  maxGasRadiusM = 0,
  materialBankParticleSizeRowCount = 0
} = {}) {
  const buffer = new ArrayBuffer(SPH_RENDER_ROWS_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(renderDomainBaseCount, 0))), true);
  view.setUint32(8, Math.max(0, Math.round(finiteNumber(renderDomainDropCount, 0))), true);
  view.setUint32(12, hasMechanics ? 1 : 0, true);
  view.setFloat32(16, Math.max(0, finiteNumber(maxSupportRadiusM, 0)), true);
  view.setFloat32(20, Math.max(0, finiteNumber(maxGasRadiusM, 0)), true);
  view.setUint32(24, Math.max(0, Math.round(finiteNumber(materialBankParticleSizeRowCount, 0))), true);
  return buffer;
}

function materialBankParticleSizeConsumerSummary({ rowCount = 0, bufferSource = 'none' } = {}) {
  const count = Math.max(0, Math.round(finiteNumber(rowCount, 0)));
  return {
    schema: ULG_SPH_RENDER_ROW_MATERIAL_BANK_PARTICLE_SIZE_CONSUMER_SCHEMA,
    status: count > 0
      ? 'shader-bound-material-bank-particle-size-rows'
      : 'no-material-bank-particle-size-rows',
    rowCount: count,
    shaderBinding: 5,
    bufferSource: count > 0 ? bufferSource : 'none',
    consumer: 'sph-render-rows-wgsl',
    consumedAs: 'non-authoritative-role-rest-volume-seed-before-mechanics',
    strictSourceOfTruth: false,
    mechanicsOverridePreserved: true,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function createRenderFieldParamsArray({
  particleCount,
  productEventCount = 0,
  surfaceCount,
  totalFieldCells,
  fieldPadding,
  refEdgeM
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, surfaceCount, true);
  view.setUint32(8, totalFieldCells, true);
  view.setUint32(12, productEventCount, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, 0, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

function createMaterialInterfaceCandidateParamsArray({
  surfaceCount,
  totalFieldCells,
  candidateCount,
  fieldPadding,
  refEdgeM,
  isolationScale,
  sourceKeyEnabled = false
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, surfaceCount, true);
  view.setUint32(4, totalFieldCells, true);
  view.setUint32(8, candidateCount, true);
  view.setUint32(12, sourceKeyEnabled ? 1 : 0, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, isolationScale, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

function createMarchingCubesCandidateParamsArray({
  surfaceCount,
  totalFieldCells,
  candidateCount,
  fieldPadding,
  refEdgeM,
  isolationScale
}) {
  return createMaterialInterfaceCandidateParamsArray({
    surfaceCount,
    totalFieldCells,
    candidateCount,
    fieldPadding,
    refEdgeM,
    isolationScale
  });
}

function createSurfaceVerticesParamsArray({
  surfaceCount,
  totalFieldCells,
  maxVertexRows,
  emissionModeId = 0,
  fieldPadding,
  refEdgeM,
  isolationScale
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, surfaceCount, true);
  view.setUint32(4, maxVertexRows, true);
  view.setUint32(8, totalFieldCells, true);
  view.setUint32(12, emissionModeId, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, isolationScale, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

function createRenderFieldSurfaceSummaryParamsArray({
  surfaceCount,
  totalFieldCells,
  fieldPadding,
  refEdgeM,
  isolationScale
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, surfaceCount, true);
  view.setUint32(4, totalFieldCells, true);
  view.setUint32(8, 0, true);
  view.setUint32(12, 0, true);
  view.setFloat32(16, fieldPadding, true);
  view.setFloat32(20, refEdgeM, true);
  view.setFloat32(24, isolationScale, true);
  view.setFloat32(28, 0, true);
  return buffer;
}

function createSurfaceDrawParamsArray({
  surfaceCount,
  sourceVertexRowCount,
  maxCompactVertexRows,
  sourceVertexCounterMode = 0
}) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, surfaceCount, true);
  view.setUint32(4, sourceVertexRowCount, true);
  view.setUint32(8, maxCompactVertexRows, true);
  view.setUint32(12, sourceVertexCounterMode, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label = 'ulg-sph-render-readback') {
  assertWebGpuBufferSizeFitsDevice(device, label, Math.max(4, byteLength));
  const readback = device.createBuffer({
    label,
    size: Math.max(4, byteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(sourceBuffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPU_MAP_MODE.READ);
  const copy = readback.getMappedRange().slice(0);
  readback.unmap();
  readback.destroy?.();
  return copy;
}

function emptyBounds3() {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  };
}

function finalizeBounds3(bounds) {
  if (!bounds) return null;
  const finite = bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite);
  return finite
    ? { min: [...bounds.min], max: [...bounds.max] }
    : null;
}

function expandBounds3(bounds, point) {
  for (let axis = 0; axis < 3; axis += 1) {
    const value = finiteNumber(point?.[axis], NaN);
    if (!Number.isFinite(value)) continue;
    bounds.min[axis] = Math.min(bounds.min[axis], value);
    bounds.max[axis] = Math.max(bounds.max[axis], value);
  }
}

function materialPhaseCountKey(materialId, phaseId) {
  return `${Math.round(finiteNumber(materialId, 0))}:${Math.round(finiteNumber(phaseId, 0))}`;
}

function summarizePackedSphParticleRows({
  state,
  thermo,
  particleCount,
  maxSampleRows = 8
} = {}) {
  const bounds = emptyBounds3();
  const materialPhaseCounts = {};
  const sampleRows = [];
  let finitePositionCount = 0;
  let zeroPositionCount = 0;
  let positiveMassCount = 0;
  let totalMassKg = 0;
  let minTemperatureK = Number.POSITIVE_INFINITY;
  let maxTemperatureK = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < particleCount; index += 1) {
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const positionM = [
      finiteNumber(state?.[stateOffset], NaN),
      finiteNumber(state?.[stateOffset + 1], NaN),
      finiteNumber(state?.[stateOffset + 2], NaN)
    ];
    const massKg = finiteNumber(state?.[stateOffset + 3], 0);
    const materialId = finiteNumber(thermo?.[thermoOffset], 0);
    const phaseId = finiteNumber(thermo?.[thermoOffset + 1], 0);
    const temperatureK = finiteNumber(thermo?.[thermoOffset + 2], NaN);
    const status = finiteNumber(thermo?.[thermoOffset + 10], 0);
    if (positionM.every(Number.isFinite)) {
      finitePositionCount += 1;
      expandBounds3(bounds, positionM);
      if (positionM.every((value) => Math.abs(value) <= 1e-12)) zeroPositionCount += 1;
    }
    if (massKg > 0) {
      positiveMassCount += 1;
      totalMassKg += massKg;
    }
    if (Number.isFinite(temperatureK)) {
      minTemperatureK = Math.min(minTemperatureK, temperatureK);
      maxTemperatureK = Math.max(maxTemperatureK, temperatureK);
    }
    const countKey = materialPhaseCountKey(materialId, phaseId);
    materialPhaseCounts[countKey] = (materialPhaseCounts[countKey] || 0) + 1;
    if (sampleRows.length < maxSampleRows) {
      sampleRows.push({
        index,
        positionM,
        massKg,
        materialId,
        phaseId,
        temperatureK: Number.isFinite(temperatureK) ? temperatureK : null,
        status
      });
    }
  }
  return {
    particleCount,
    finitePositionCount,
    zeroPositionCount,
    positiveMassCount,
    totalMassKg,
    boundsM: finalizeBounds3(bounds),
    minTemperatureK: Number.isFinite(minTemperatureK) ? minTemperatureK : null,
    maxTemperatureK: Number.isFinite(maxTemperatureK) ? maxTemperatureK : null,
    materialPhaseCounts,
    sampleRows
  };
}

function summarizeSphRenderRowData(renderRows, { maxSampleRows = 8 } = {}) {
  const particleCount = renderRows instanceof Float32Array
    ? Math.floor(renderRows.length / SPH_GPU_RENDER_ROW_FLOATS)
    : 0;
  const bounds = emptyBounds3();
  const materialPhaseCounts = {};
  const sampleRows = [];
  let finitePositionCount = 0;
  let zeroPositionCount = 0;
  let positiveMassCount = 0;
  let totalMassKg = 0;
  let minTemperatureK = Number.POSITIVE_INFINITY;
  let maxTemperatureK = Number.NEGATIVE_INFINITY;
  let minParticleRadiusM = Number.POSITIVE_INFINITY;
  let maxParticleRadiusM = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * SPH_GPU_RENDER_ROW_FLOATS;
    const positionM = [
      finiteNumber(renderRows[offset], NaN),
      finiteNumber(renderRows[offset + 1], NaN),
      finiteNumber(renderRows[offset + 2], NaN)
    ];
    const massKg = finiteNumber(renderRows[offset + 3], 0);
    const materialId = finiteNumber(renderRows[offset + 4], 0);
    const phaseId = finiteNumber(renderRows[offset + 5], 0);
    const temperatureK = finiteNumber(renderRows[offset + 6], NaN);
    const status = finiteNumber(renderRows[offset + 7], 0);
    const particleRadiusM = finiteNumber(renderRows[offset + 13], NaN);
    if (positionM.every(Number.isFinite)) {
      finitePositionCount += 1;
      expandBounds3(bounds, positionM);
      if (positionM.every((value) => Math.abs(value) <= 1e-12)) zeroPositionCount += 1;
    }
    if (massKg > 0) {
      positiveMassCount += 1;
      totalMassKg += massKg;
    }
    if (Number.isFinite(temperatureK)) {
      minTemperatureK = Math.min(minTemperatureK, temperatureK);
      maxTemperatureK = Math.max(maxTemperatureK, temperatureK);
    }
    if (Number.isFinite(particleRadiusM) && particleRadiusM > 0) {
      minParticleRadiusM = Math.min(minParticleRadiusM, particleRadiusM);
      maxParticleRadiusM = Math.max(maxParticleRadiusM, particleRadiusM);
    }
    const countKey = materialPhaseCountKey(materialId, phaseId);
    materialPhaseCounts[countKey] = (materialPhaseCounts[countKey] || 0) + 1;
    if (sampleRows.length < maxSampleRows) {
      sampleRows.push({
        index,
        positionM,
        massKg,
        materialId,
        phaseId,
        temperatureK: Number.isFinite(temperatureK) ? temperatureK : null,
        status,
        particleRadiusM: Number.isFinite(particleRadiusM) ? particleRadiusM : null
      });
    }
  }
  return {
    particleCount,
    finitePositionCount,
    zeroPositionCount,
    positiveMassCount,
    totalMassKg,
    boundsM: finalizeBounds3(bounds),
    minTemperatureK: Number.isFinite(minTemperatureK) ? minTemperatureK : null,
    maxTemperatureK: Number.isFinite(maxTemperatureK) ? maxTemperatureK : null,
    minParticleRadiusM: Number.isFinite(minParticleRadiusM) ? minParticleRadiusM : null,
    maxParticleRadiusM: Number.isFinite(maxParticleRadiusM) ? maxParticleRadiusM : null,
    materialPhaseCounts,
    sampleRows
  };
}

export async function summarizeSphResidentParticleUploadWebGpu({
  device,
  sphParticleState,
  sphParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  renderDomainBaseCount = 0,
  renderDomainDropCount = 0,
  includeRenderRows = true,
  maxSampleRows = 8
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('summarizeSphResidentParticleUploadWebGpu requires a WebGPU-like device');
  }
  const stateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const thermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  if (!stateBuffer || !thermoBuffer) {
    return {
      schema: 'peercompute.ulg.sph-resident-particle-upload-debug.v0',
      status: 'resident-particle-upload-debug-source-unavailable',
      reason: 'retained state and thermo buffers are required',
      particleCount: sphParticleState.particleCount,
      uploadStatus: sphParticleUpload?.status ?? null,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const particleCount = Math.max(0, Math.round(finiteNumber(sphParticleState.particleCount, 0)));
  const stateByteLength = particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const thermoByteLength = particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const [stateBytes, thermoBytes] = await Promise.all([
    readBuffer(device, stateBuffer, stateByteLength, 'ulg-sph-resident-debug-state-readback'),
    readBuffer(device, thermoBuffer, thermoByteLength, 'ulg-sph-resident-debug-thermo-readback')
  ]);
  const state = new Float32Array(stateBytes).slice(0, particleCount * SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermo = new Float32Array(thermoBytes).slice(0, particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
  const particleRows = summarizePackedSphParticleRows({
    state,
    thermo,
    particleCount,
    maxSampleRows
  });
  let renderRows = null;
  let renderRowsError = null;
  if (includeRenderRows) {
    try {
      const renderRowsExecution = await extractSphRenderRowsWebGpu({
        device,
        sphParticleState,
        sphParticleUpload,
        sourceStateBuffer: stateBuffer,
        sourceThermoBuffer: thermoBuffer,
        readbackMode: FULL_READBACK_MODE,
        renderDomainBaseCount,
        renderDomainDropCount
      });
      renderRows = summarizeSphRenderRowData(renderRowsExecution.renderRows, { maxSampleRows });
    } catch (error) {
      renderRowsError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    schema: 'peercompute.ulg.sph-resident-particle-upload-debug.v0',
    status: renderRowsError ? 'resident-particle-upload-debug-render-rows-error' : 'resident-particle-upload-debug-ready',
    uploadStatus: sphParticleUpload?.status ?? null,
    sourceStep: sphParticleUpload?.step ?? sphParticleState.step ?? null,
    sourceTime: sphParticleUpload?.time ?? sphParticleState.time ?? null,
    particleCount,
    readbackByteLength: stateByteLength + thermoByteLength,
    stateBufferLabel: stateBuffer?.label ?? null,
    thermoBufferLabel: thermoBuffer?.label ?? null,
    particleRows,
    renderRows,
    renderRowsError,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function buildSphRenderFieldSurfaceTable(surfaceDescriptors = [], {
  defaultResolution = 32,
  defaultIsolation = 80,
  defaultSubtract = 24
} = {}) {
  if (!Array.isArray(surfaceDescriptors)) {
    throw new TypeError('surfaceDescriptors must be an array');
  }
  const records = new Float32Array(surfaceDescriptors.length * SPH_GPU_RENDER_SURFACE_ROW_FLOATS);
  const metadata = [];
  let fieldOffset = 0;
  let maxFieldCellCount = 0;
  surfaceDescriptors.forEach((descriptor, index) => {
    const resolution = Math.max(4, Math.round(finiteNumber(descriptor.resolution, defaultResolution)));
    const fieldCellCount = resolution ** 3;
    const isolation = finiteNumber(descriptor.isolation, defaultIsolation);
    const subtract = Math.max(1e-12, finiteNumber(descriptor.subtract, defaultSubtract));
    const radiusNorm = clamp(finiteNumber(descriptor.radiusNorm, 0.05), 0.001, 0.5);
    const strength = Number.isFinite(descriptor.strength)
      ? descriptor.strength
      : (isolation + subtract) * radiusNorm * radiusNorm;
    const color = Array.isArray(descriptor.colorLinear) || ArrayBuffer.isView(descriptor.colorLinear)
      ? descriptor.colorLinear
      : [1, 1, 1];
    const materialId = finiteNumber(
      descriptor.materialId ?? (descriptor.material ? stableOpticalMaterialId(descriptor.material) : 0),
      0
    );
    const phaseId = finiteNumber(
      descriptor.phaseId ?? (descriptor.phase ? gpuPhaseId(descriptor.phase) : GPU_PHASE_IDS.unknown),
      GPU_PHASE_IDS.unknown
    );
    const opticalState = descriptor.opticalState || null;
    const opticalStateId = finiteNumber(descriptor.opticalStateId ?? stableOpticalStateId(opticalState), 0);
    const opticalStateKey = descriptor.opticalStateKey ?? stableOpticalStateKey(opticalState);
    const offset = index * SPH_GPU_RENDER_SURFACE_ROW_FLOATS;
    records.set([
      materialId,
      phaseId,
      fieldOffset,
      fieldCellCount,
      resolution,
      isolation,
      subtract,
      strength,
      radiusNorm,
      clamp(finiteNumber(color[0], 1), 0, 1),
      clamp(finiteNumber(color[1], 1), 0, 1),
      clamp(finiteNumber(color[2], 1), 0, 1),
      Math.max(0, Math.round(finiteNumber(descriptor.renderDomainId, 0))),
      opticalStateId,
      Number.isFinite(Number(descriptor.transparencyClassId)) ? Number(descriptor.transparencyClassId) : -1,
      Number.isFinite(Number(descriptor.depthWriteFlag)) ? Number(descriptor.depthWriteFlag) : -1
    ], offset);
    const renderPolicy = renderPolicyFieldsForSurface({
      ...descriptor,
      index,
      phaseId
    });
    const row = {
      index,
      surfaceKey: descriptor.surfaceKey ?? `${materialId}|${phaseId}`,
      material: descriptor.material ?? null,
      phase: descriptor.phase ?? null,
      renderKey: descriptor.renderKey ?? descriptor.material ?? null,
      opticalState: opticalState ? { ...opticalState } : null,
      opticalStateKey,
      opticalStateId,
      renderDomainId: Math.max(0, Math.round(finiteNumber(descriptor.renderDomainId, 0))),
      renderDomainKey: descriptor.renderDomainKey ?? renderDomainKeyForId(descriptor.renderDomainId),
      renderLayer: descriptor.renderLayer ?? renderPolicy.renderLayer,
      renderOrder: renderPolicy.renderOrder,
      transparencyClassId: renderPolicy.transparencyClassId,
      depthWriteFlag: renderPolicy.depthWriteFlag,
      materialId,
      phaseId,
      fieldOffset,
      fieldCellCount,
      resolution,
      isolation,
      subtract,
      strength,
      radiusNorm,
      colorLinear: [
        clamp(finiteNumber(color[0], 1), 0, 1),
        clamp(finiteNumber(color[1], 1), 0, 1),
        clamp(finiteNumber(color[2], 1), 0, 1)
      ],
      status: finiteNumber(descriptor.status, 1)
    };
    metadata.push(row);
    fieldOffset += fieldCellCount;
    maxFieldCellCount = Math.max(maxFieldCellCount, fieldCellCount);
  });
  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    status: 'render-field-surface-table-built',
    surfaceCount: surfaceDescriptors.length,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_ROW_FLOATS,
    records,
    metadata,
    totalFieldCells: fieldOffset,
    maxFieldCellCount,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function assertRenderFieldSurfaceTable(surfaceTable) {
  if (surfaceTable?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(surfaceTable.records instanceof Float32Array)) {
    throw new TypeError('SPH render field requires a render-field surface table');
  }
}

function normalizedPositionFromRenderRow(renderRows, offset, fieldPadding, refEdgeM) {
  const span = 1 - 2 * fieldPadding;
  const refEdge = Math.max(refEdgeM, 1e-12);
  return [
    clamp(fieldPadding + (renderRows[offset] / refEdge) * span, 0.001, 0.999),
    clamp(fieldPadding + (renderRows[offset + 1] / refEdge) * span, 0.001, 0.999),
    clamp(fieldPadding + (renderRows[offset + 2] / refEdge) * span, 0.001, 0.999)
  ];
}

function phaseMatchesEventSurface(eventPhaseId, surfacePhaseId) {
  return !(eventPhaseId > 0) || eventPhaseId === surfacePhaseId;
}

function renderDomainMatchesSurface(particleRenderDomainId, surfaceRenderDomainId) {
  const surfaceDomain = Math.max(0, Math.round(finiteNumber(surfaceRenderDomainId, 0)));
  if (surfaceDomain <= 0) return true;
  return Math.round(finiteNumber(particleRenderDomainId, 0)) === surfaceDomain;
}

function accumulateMetaballSample({
  cell,
  position,
  strength,
  subtract,
  supportNorm,
  color,
  density,
  palette
}) {
  const dx = cell[0] - position[0];
  const dy = cell[1] - position[1];
  const dz = cell[2] - position[2];
  const dist2 = dx * dx + dy * dy + dz * dz;
  const value = strength / (0.000001 + dist2) - subtract;
  if (value <= 0) return { density, palette };
  const ratio = Math.sqrt(dist2) / Math.max(supportNorm, 1e-6);
  const t = clamp(ratio, 0, 1);
  const weight = 1 - t ** 3 * (t * (t * 6 - 15) + 10);
  return {
    density: density + value,
    palette: [
      palette[0] + color[0] * weight,
      palette[1] + color[1] * weight,
      palette[2] + color[2] * weight
    ]
  };
}

export function buildSphRenderFieldCpu({
  renderRows,
  productEventRows = null,
  surfaceTable,
  particleCount = null,
  productEventCount = null,
  fieldPadding = 0.22,
  refEdgeM = 10
} = {}) {
  if (!(renderRows instanceof Float32Array)) {
    throw new TypeError('buildSphRenderFieldCpu requires Float32Array render rows');
  }
  if (renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  if (productEventRows && (!(productEventRows instanceof Float32Array) || productEventRows.length % SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS !== 0)) {
    throw new RangeError('SPH product-event rows length must align to the product-event row stride');
  }
  assertRenderFieldSurfaceTable(surfaceTable);
  const resolvedParticleCount = particleCount ?? (renderRows.length / SPH_GPU_RENDER_ROW_FLOATS);
  const resolvedProductEventCount = productEventCount ?? (productEventRows?.length ? productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS : 0);
  const fieldRows = new Float32Array(surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS);
  for (const surface of surfaceTable.metadata) {
    const resolution = surface.resolution;
    const supportNorm = Math.sqrt(Math.abs(surface.strength) / Math.max(surface.subtract, 1e-12));
    for (let cellIndex = 0; cellIndex < surface.fieldCellCount; cellIndex += 1) {
      const xy = resolution * resolution;
      const z = Math.floor(cellIndex / xy);
      const rem = cellIndex - z * xy;
      const y = Math.floor(rem / resolution);
      const x = rem - y * resolution;
      const cell = [x / resolution, y / resolution, z / resolution];
      let density = 0;
      let palette = [0, 0, 0];
      for (let particleIndex = 0; particleIndex < resolvedParticleCount; particleIndex += 1) {
        const renderOffset = particleIndex * SPH_GPU_RENDER_ROW_FLOATS;
        const materialId = renderRows[renderOffset + 4];
        const phaseId = renderRows[renderOffset + 5];
        const renderDomainId = renderRows[renderOffset + 11];
        if (
          materialId !== surface.materialId
          || phaseId !== surface.phaseId
          || !renderDomainMatchesSurface(renderDomainId, surface.renderDomainId)
        ) continue;
        const particle = normalizedPositionFromRenderRow(renderRows, renderOffset, fieldPadding, refEdgeM);
        const accumulated = accumulateMetaballSample({
          cell,
          position: particle,
          strength: surface.strength,
          subtract: surface.subtract,
          supportNorm,
          color: surface.colorLinear,
          density,
          palette
        });
        density = accumulated.density;
        palette = accumulated.palette;
      }
      for (let eventIndex = 0; eventIndex < resolvedProductEventCount; eventIndex += 1) {
        if (!productEventRows) break;
        const eventOffset = eventIndex * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS;
        const status = productEventRows[eventOffset + 18];
        const materialId = productEventRows[eventOffset + 4];
        const phaseId = productEventRows[eventOffset + 11];
        const unplacedMassKg = productEventRows[eventOffset + 13];
        if (
          status !== 1
          || !(unplacedMassKg > 0)
          || materialId !== surface.materialId
          || !phaseMatchesEventSurface(phaseId, surface.phaseId)
        ) {
          continue;
        }
        const eventPosition = [
          clamp(fieldPadding + (productEventRows[eventOffset] / Math.max(refEdgeM, 1e-12)) * (1 - 2 * fieldPadding), 0.001, 0.999),
          clamp(fieldPadding + (productEventRows[eventOffset + 1] / Math.max(refEdgeM, 1e-12)) * (1 - 2 * fieldPadding), 0.001, 0.999),
          clamp(fieldPadding + (productEventRows[eventOffset + 2] / Math.max(refEdgeM, 1e-12)) * (1 - 2 * fieldPadding), 0.001, 0.999)
        ];
        const accumulated = accumulateMetaballSample({
          cell,
          position: eventPosition,
          strength: surface.strength,
          subtract: surface.subtract,
          supportNorm,
          color: surface.colorLinear,
          density,
          palette
        });
        density = accumulated.density;
        palette = accumulated.palette;
      }
      const fieldOffset = (surface.fieldOffset + cellIndex) * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
      fieldRows[fieldOffset] = density;
      fieldRows[fieldOffset + 1] = palette[0];
      fieldRows[fieldOffset + 2] = palette[1];
      fieldRows[fieldOffset + 3] = palette[2];
    }
  }
  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'cpu-reference',
    status: 'render-field-built',
    kernelScope: RENDER_FIELD_SCOPE,
    particleCount: resolvedParticleCount,
    productEventCount: resolvedProductEventCount,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxFieldCellCount: surfaceTable.maxFieldCellCount,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
    fieldRows,
    fieldRowByteLength: fieldRows.byteLength,
    fieldPadding,
    refEdgeM,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function splitSphRenderFieldBySurface(renderField) {
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('splitSphRenderFieldBySurface requires an SPH render field');
  }
  return renderField.surfaceTable.metadata.map((surface) => {
    const field = new Float32Array(surface.fieldCellCount);
    const palette = new Float32Array(surface.fieldCellCount * 3);
    for (let cellIndex = 0; cellIndex < surface.fieldCellCount; cellIndex += 1) {
      const fieldOffset = (surface.fieldOffset + cellIndex) * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
      field[cellIndex] = renderField.fieldRows[fieldOffset];
      palette[cellIndex * 3] = renderField.fieldRows[fieldOffset + 1];
      palette[cellIndex * 3 + 1] = renderField.fieldRows[fieldOffset + 2];
      palette[cellIndex * 3 + 2] = renderField.fieldRows[fieldOffset + 3];
    }
    return {
      ...surface,
      field,
      palette
    };
  });
}

function normalizeVector3(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!(length > 0)) return [0, 0, 0];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cellPhysicalCenterM(x, y, z, resolution, fieldPadding, refEdgeM) {
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  const toM = (coord) => (((coord + 0.5) / resolution) - fieldPadding) * refEdgeM / span;
  return [toM(x), toM(y), toM(z)];
}

function fieldCoordPhysicalM(x, y, z, resolution, fieldPadding, refEdgeM) {
  const span = Math.max(1e-12, 1 - 2 * fieldPadding);
  const toM = (coord) => ((coord / resolution) - fieldPadding) * refEdgeM / span;
  return [toM(x), toM(y), toM(z)];
}

function fieldIndex3d(x, y, z, resolution) {
  return z * resolution * resolution + y * resolution + x;
}

function writeInterfaceCandidateRow(candidateRows, offset, {
  surface,
  axisId,
  centroidM = [0, 0, 0],
  areaM2 = 0,
  normal = [0, 0, 0],
  normalAreaVectorM2 = [0, 0, 0],
  crossingSign = 0,
  status = 0
}) {
  candidateRows.set([
    surface.index,
    surface.materialId,
    surface.phaseId,
    axisId,
    centroidM[0],
    centroidM[1],
    centroidM[2],
    areaM2,
    normal[0],
    normal[1],
    normal[2],
    normalAreaVectorM2[0],
    normalAreaVectorM2[1],
    normalAreaVectorM2[2],
    crossingSign,
    status
  ], offset);
}

export function deriveSphMaterialInterfaceCandidateField(renderField, {
  isolationScale = 1
} = {}) {
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('deriveSphMaterialInterfaceCandidateField requires an SPH render field');
  }
  const surfaceFields = splitSphRenderFieldBySurface(renderField);
  const candidateCount = Math.max(0, renderField.totalFieldCells || 0) * 3;
  const candidateRows = new Float32Array(candidateCount * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS);
  let activeCandidateCount = 0;
  const surfaces = surfaceFields.map((surface) => {
    const resolution = surface.resolution;
    const isolation = surface.isolation * finiteNumber(isolationScale, 1);
    const fieldPadding = finiteNumber(renderField.fieldPadding, 0.22);
    const refEdgeM = Math.max(finiteNumber(renderField.refEdgeM, 1), 1e-12);
    const span = Math.max(1e-12, 1 - 2 * fieldPadding);
    const cellSizeM = refEdgeM / (span * Math.max(resolution, 1));
    const faceAreaM2 = cellSizeM * cellSizeM;
    const candidateOffset = surface.fieldOffset * 3;
    const activeStart = activeCandidateCount;
    let activeCellCount = 0;

    for (let z = 0; z < resolution; z += 1) {
      for (let y = 0; y < resolution; y += 1) {
        for (let x = 0; x < resolution; x += 1) {
          const cellIndex = fieldIndex3d(x, y, z, resolution);
          const value = surface.field[cellIndex];
          if (value >= isolation) activeCellCount += 1;
          const neighbors = [
            [x + 1, y, z, 0],
            [x, y + 1, z, 1],
            [x, y, z + 1, 2]
          ];
          for (const [nx, ny, nz, axis] of neighbors) {
            const candidateIndex = (surface.fieldOffset + cellIndex) * 3 + axis;
            const candidateOffsetFloats = candidateIndex * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS;
            writeInterfaceCandidateRow(candidateRows, candidateOffsetFloats, {
              surface,
              axisId: axis
            });
            if (nx >= resolution || ny >= resolution || nz >= resolution) continue;
            const neighbor = surface.field[fieldIndex3d(nx, ny, nz, resolution)];
            const inside = value >= isolation;
            const neighborInside = neighbor >= isolation;
            if (inside === neighborInside) continue;
            const sign = inside ? 1 : -1;
            const normal = [0, 0, 0];
            normal[axis] = sign;
            const normalAreaVectorM2 = normal.map((component) => component * faceAreaM2);
            const center = cellPhysicalCenterM(
              (x + nx) * 0.5,
              (y + ny) * 0.5,
              (z + nz) * 0.5,
              resolution,
              fieldPadding,
              refEdgeM
            );
            writeInterfaceCandidateRow(candidateRows, candidateOffsetFloats, {
              surface,
              axisId: axis,
              centroidM: center,
              areaM2: faceAreaM2,
              normal,
              normalAreaVectorM2,
              crossingSign: sign,
              status: 1
            });
            activeCandidateCount += 1;
          }
        }
      }
    }

    return {
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      resolution,
      isolation,
      activeCellCount,
      candidateOffset,
      candidateCount: surface.fieldCellCount * 3,
      activeCandidateCount: activeCandidateCount - activeStart,
      status: activeCandidateCount > activeStart
        ? 'interface-candidates-active'
        : (activeCellCount > 0 ? 'interface-candidates-active-without-crossing' : 'interface-candidates-empty')
    };
  });

  return {
    schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
    backend: 'cpu-reference',
    status: activeCandidateCount > 0 ? 'material-interface-candidate-field-ready' : 'material-interface-candidate-field-empty',
    sourceSchema: renderField.schema,
    sourceBackend: renderField.backend,
    surfaceCount: surfaces.length,
    totalFieldCells: renderField.totalFieldCells,
    candidateCount,
    activeCandidateCount,
    rowLayout: [...SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT],
    rowStrideFloats: SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
    candidateRows,
    candidateRowByteLength: candidateRows.byteLength,
    candidateShape: 'fixed-render-field-cell-axis-triplets',
    surfaces,
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
}

function summarizeMaterialInterfaceCandidateSurfaces(renderField, candidateRows, isolationScale = 1) {
  const metadata = renderField.surfaceTable?.metadata || [];
  const activeBySurface = new Array(metadata.length).fill(0);
  const rowCount = candidateRows.length / SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS;
  for (let candidateIndex = 0; candidateIndex < rowCount; candidateIndex += 1) {
    const offset = candidateIndex * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS;
    const status = candidateRows[offset + 15];
    if (!(status > 0)) continue;
    const surfaceIndex = Math.round(candidateRows[offset]);
    if (surfaceIndex >= 0 && surfaceIndex < activeBySurface.length) {
      activeBySurface[surfaceIndex] += 1;
    }
  }
  return metadata.map((surface) => {
    const isolation = surface.isolation * finiteNumber(isolationScale, 1);
    let activeCellCount = 0;
    for (let cellIndex = 0; cellIndex < surface.fieldCellCount; cellIndex += 1) {
      const offset = (surface.fieldOffset + cellIndex) * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
      if (renderField.fieldRows?.[offset] >= isolation) activeCellCount += 1;
    }
    const activeCandidateCount = activeBySurface[surface.index] || 0;
    return {
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      resolution: surface.resolution,
      isolation,
      activeCellCount,
      candidateOffset: surface.fieldOffset * 3,
      candidateCount: surface.fieldCellCount * 3,
      activeCandidateCount,
      status: activeCandidateCount > 0
        ? 'interface-candidates-active'
        : (activeCellCount > 0 ? 'interface-candidates-active-without-crossing' : 'interface-candidates-empty')
    };
  });
}

export async function buildSphMaterialInterfaceCandidateFieldWebGpu({
  device,
  renderField,
  fieldRowsBuffer = null,
  surfaceBuffer = null,
  isolationScale = 1
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphMaterialInterfaceCandidateFieldWebGpu requires a WebGPU-like device');
  }
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    throw new TypeError('buildSphMaterialInterfaceCandidateFieldWebGpu requires an SPH render field');
  }
  if (!fieldRowsBuffer && !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('buildSphMaterialInterfaceCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer');
  }
  if (!surfaceBuffer && !(renderField.surfaceTable?.records instanceof Float32Array)) {
    throw new TypeError('buildSphMaterialInterfaceCandidateFieldWebGpu requires surface table records or surfaceBuffer');
  }
  const surfaceCount = renderField.surfaceTable?.surfaceCount ?? renderField.surfaceCount ?? 0;
  const totalFieldCells = renderField.totalFieldCells ?? 0;
  const candidateCount = totalFieldCells * 3;
  const candidateRowsByteLength = candidateCount
    * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  assertWebGpuBufferSizeFitsDevice(device, 'ulg-sph-interface-candidates', Math.max(4, candidateRowsByteLength));
  assertWebGpuBufferSizeFitsDevice(device, 'ulg-sph-interface-candidate-readback', Math.max(4, candidateRowsByteLength));
  assertWebGpuStorageBufferBindingSizeFitsDevice(device, 'ulg-sph-interface-candidates', Math.max(4, candidateRowsByteLength));
  const borrowedFieldRowsBuffer = fieldRowsBuffer || null;
  const borrowedSurfaceBuffer = surfaceBuffer || null;
  const sourceFieldRowsBuffer = borrowedFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-interface-source-render-field',
    renderField.fieldRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceSurfaceBuffer = borrowedSurfaceBuffer || writeStorageBuffer(
    device,
    'ulg-sph-interface-render-surfaces',
    renderField.surfaceTable.records
  );
  const candidateRowsBuffer = device.createBuffer({
    label: 'ulg-sph-interface-candidates',
    size: Math.max(4, candidateRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-interface-candidate-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createMaterialInterfaceCandidateParamsArray({
    surfaceCount,
    totalFieldCells,
    candidateCount,
    fieldPadding: finiteNumber(renderField.fieldPadding, 0.22),
    refEdgeM: finiteNumber(renderField.refEdgeM, 10),
    isolationScale: finiteNumber(isolationScale, 1)
  }));

  const module = device.createShaderModule({ label: 'ulg-sph-interface-candidates', code: sphMaterialInterfaceCandidatesWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-interface-candidates',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceSurfaceBuffer } },
      { binding: 1, resource: { buffer: sourceFieldRowsBuffer } },
      { binding: 2, resource: { buffer: candidateRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(Math.max(1, (renderField.maxFieldCellCount || 0) * 3) / 64),
    Math.max(1, surfaceCount)
  );
  pass.end();
  let queueCompletionStatus = 'queue-submitted';
  let queueCompletionMethod = 'queue.submit';
  device.queue.submit([encoder.finish()]);
  const bytes = await readBuffer(
    device,
    candidateRowsBuffer,
    candidateRowsByteLength,
    'ulg-sph-interface-candidate-readback'
  );
  queueCompletionStatus = 'readback-map-completed';
  queueCompletionMethod = 'mapAsync(readback-buffer)';
  const candidateRows = new Float32Array(bytes);

  if (!borrowedFieldRowsBuffer) sourceFieldRowsBuffer.destroy?.();
  if (!borrowedSurfaceBuffer) sourceSurfaceBuffer.destroy?.();
  candidateRowsBuffer.destroy?.();
  paramsBuffer.destroy?.();

  const surfaces = summarizeMaterialInterfaceCandidateSurfaces(renderField, candidateRows, isolationScale);
  const activeCandidateCount = surfaces.reduce((sum, surface) => sum + surface.activeCandidateCount, 0);
  return {
    schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
    backend: 'webgpu',
    status: activeCandidateCount > 0 ? 'material-interface-candidate-field-ready' : 'material-interface-candidate-field-empty',
    sourceSchema: renderField.schema,
    sourceBackend: renderField.backend,
    surfaceCount,
    totalFieldCells,
    candidateCount,
    activeCandidateCount,
    rowLayout: [...SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT],
    rowStrideFloats: SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
    candidateRows,
    candidateRowByteLength: candidateRows.byteLength,
    candidateShape: 'fixed-render-field-cell-axis-triplets',
    surfaces,
    fieldRowsBufferBound: Boolean(borrowedFieldRowsBuffer),
    surfaceBufferBound: Boolean(borrowedSurfaceBuffer),
    queueCompletionStatus,
    queueCompletionMethod,
    candidateReadback: true,
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
}

function compactMaterialInterfaceCandidateCapacity({
  candidateCount,
  surfaceCount,
  compactCandidateCapacity = null
}) {
  const requested = Math.round(finiteNumber(compactCandidateCapacity, 0));
  if (requested > 0) return Math.max(1, Math.min(candidateCount, requested));
  const surfaceScaled = Math.max(
    SPH_MATERIAL_INTERFACE_COMPACT_CANDIDATE_ROWS_DEFAULT,
    Math.max(1, Math.round(finiteNumber(surfaceCount, 0))) * 8192
  );
  return Math.max(1, Math.min(candidateCount, surfaceScaled));
}

function countReadyInterfaceSourceKeyRows(sourceKeyRows = null) {
  if (!(sourceKeyRows instanceof Float32Array) || sourceKeyRows.length <= 0) return 0;
  let readyCount = 0;
  for (let offset = 0; offset + 2 < sourceKeyRows.length; offset += SPH_INTERFACE_SOURCE_KEY_FLOATS) {
    if ((sourceKeyRows[offset + 2] || 0) > 0) readyCount += 1;
  }
  return readyCount;
}

export async function buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
  device,
  renderField,
  fieldRowsBuffer = null,
  surfaceBuffer = null,
  sourceIndexFieldBuffer = null,
  isolationScale = 1,
  compactCandidateCapacity = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires a WebGPU-like device');
  }
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    throw new TypeError('buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires an SPH render field');
  }
  if (!fieldRowsBuffer && !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires fieldRows or fieldRowsBuffer');
  }
  if (!surfaceBuffer && !(renderField.surfaceTable?.records instanceof Float32Array)) {
    throw new TypeError('buildSphMaterialInterfaceCompactCandidateFieldWebGpu requires surface table records or surfaceBuffer');
  }
  const surfaceCount = renderField.surfaceTable?.surfaceCount ?? renderField.surfaceCount ?? 0;
  const totalFieldCells = renderField.totalFieldCells ?? 0;
  const candidateCount = totalFieldCells * 3;
  const denseCandidateRowsByteLength = candidateCount
    * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const compactCapacity = compactMaterialInterfaceCandidateCapacity({
    candidateCount,
    surfaceCount,
    compactCandidateCapacity
  });
  const compactCandidateRowsByteLength = compactCapacity
    * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const compactSourceKeyRowsByteLength = compactCapacity
    * SPH_INTERFACE_SOURCE_KEY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  assertWebGpuBufferSizeFitsDevice(device, 'ulg-sph-interface-compact-candidates', Math.max(4, compactCandidateRowsByteLength));
  assertWebGpuStorageBufferBindingSizeFitsDevice(device, 'ulg-sph-interface-compact-candidates', Math.max(4, compactCandidateRowsByteLength));
  assertWebGpuBufferSizeFitsDevice(device, 'ulg-sph-interface-source-keys', Math.max(4, compactSourceKeyRowsByteLength));
  assertWebGpuStorageBufferBindingSizeFitsDevice(device, 'ulg-sph-interface-source-keys', Math.max(4, compactSourceKeyRowsByteLength));
  assertWebGpuBufferSizeFitsDevice(device, 'ulg-sph-interface-compact-metadata', 16);
  assertWebGpuStorageBufferBindingSizeFitsDevice(device, 'ulg-sph-interface-compact-metadata', 16);
  const borrowedFieldRowsBuffer = fieldRowsBuffer || null;
  const borrowedSurfaceBuffer = surfaceBuffer || null;
  const borrowedSourceIndexFieldBuffer = sourceIndexFieldBuffer || renderField.sourceIndexFieldBuffer || null;
  const sourceIndexFieldAvailable = Boolean(borrowedSourceIndexFieldBuffer);
  const sourceFieldRowsBuffer = borrowedFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-interface-source-render-field',
    renderField.fieldRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceSurfaceBuffer = borrowedSurfaceBuffer || writeStorageBuffer(
    device,
    'ulg-sph-interface-render-surfaces',
    renderField.surfaceTable.records
  );
  const sourceIndexFieldInputBuffer = borrowedSourceIndexFieldBuffer || writeStorageBuffer(
    device,
    'ulg-sph-interface-source-index-disabled',
    new Uint32Array(Math.max(1, totalFieldCells))
  );
  const candidateRowsBuffer = device.createBuffer({
    label: 'ulg-sph-interface-compact-candidates',
    size: Math.max(4, compactCandidateRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const interfaceSourceKeyBuffer = device.createBuffer({
    label: 'ulg-sph-interface-source-keys',
    size: Math.max(4, compactSourceKeyRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const compactMetadataBuffer = device.createBuffer({
    label: 'ulg-sph-interface-compact-metadata',
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-interface-compact-candidate-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createMaterialInterfaceCandidateParamsArray({
    surfaceCount,
    totalFieldCells,
    candidateCount,
    fieldPadding: finiteNumber(renderField.fieldPadding, 0.22),
    refEdgeM: finiteNumber(renderField.refEdgeM, 10),
    isolationScale: finiteNumber(isolationScale, 1),
    sourceKeyEnabled: sourceIndexFieldAvailable
  }));
  device.queue.writeBuffer(
    interfaceSourceKeyBuffer,
    0,
    new Float32Array(compactCapacity * SPH_INTERFACE_SOURCE_KEY_FLOATS)
  );
  device.queue.writeBuffer(compactMetadataBuffer, 0, new Uint32Array([
    0,
    0,
    compactCapacity,
    candidateCount
  ]));

  const compactCandidateBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'uniform'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage')
  ];
  const {
    pipeline,
    bindGroupLayout,
    cacheStatus: pipelineCacheStatus
  } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-interface-compact-candidates-v1',
    label: 'ulg-sph-interface-compact-candidates',
    code: sphMaterialInterfaceCompactCandidatesWgsl,
    entryPoint: 'main',
    bindings: compactCandidateBindings
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceSurfaceBuffer } },
      { binding: 1, resource: { buffer: sourceFieldRowsBuffer } },
      { binding: 2, resource: { buffer: candidateRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
      { binding: 4, resource: { buffer: compactMetadataBuffer } },
      { binding: 5, resource: { buffer: sourceIndexFieldInputBuffer } },
      { binding: 6, resource: { buffer: interfaceSourceKeyBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(Math.max(1, (renderField.maxFieldCellCount || 0) * 3) / 64),
    Math.max(1, surfaceCount)
  );
  pass.end();
  device.queue.submit([encoder.finish()]);
  const metadataBytes = await readBuffer(
    device,
    compactMetadataBuffer,
    16,
    'ulg-sph-interface-compact-candidate-metadata-readback'
  );
  const metadata = new Uint32Array(metadataBytes);
  const activeCandidateCount = metadata[0] ?? 0;
  const compactOverflowCount = metadata[1] ?? 0;
  const compactRowCount = Math.min(activeCandidateCount, compactCapacity);
  const activeRowsByteLength = compactRowCount
    * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const candidateRows = activeRowsByteLength > 0
    ? new Float32Array(await readBuffer(
      device,
      candidateRowsBuffer,
      activeRowsByteLength,
      'ulg-sph-interface-compact-candidate-readback'
    ))
    : new Float32Array();
  const activeSourceKeyRowsByteLength = compactRowCount
    * SPH_INTERFACE_SOURCE_KEY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const interfaceSourceKeyRows = sourceIndexFieldAvailable && activeSourceKeyRowsByteLength > 0
    ? new Float32Array(await readBuffer(
      device,
      interfaceSourceKeyBuffer,
      activeSourceKeyRowsByteLength,
      'ulg-sph-interface-source-key-readback'
    ))
    : new Float32Array();
  const interfaceSourceKeyReadyCount = countReadyInterfaceSourceKeyRows(interfaceSourceKeyRows);
  const keepInterfaceSourceKeyBuffer = Boolean(sourceIndexFieldAvailable && compactRowCount > 0);

  if (!borrowedFieldRowsBuffer) sourceFieldRowsBuffer.destroy?.();
  if (!borrowedSurfaceBuffer) sourceSurfaceBuffer.destroy?.();
  if (!borrowedSourceIndexFieldBuffer) sourceIndexFieldInputBuffer.destroy?.();
  candidateRowsBuffer.destroy?.();
  compactMetadataBuffer.destroy?.();
  paramsBuffer.destroy?.();
  if (!keepInterfaceSourceKeyBuffer) interfaceSourceKeyBuffer.destroy?.();

  const surfaces = summarizeMaterialInterfaceCandidateSurfaces(renderField, candidateRows, isolationScale);
  let retainedInterfaceSourceKeyBufferDestroyed = false;
  const result = {
    schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA,
    backend: 'webgpu-compact',
    status: compactOverflowCount > 0 || activeCandidateCount > compactCapacity
      ? 'material-interface-compact-candidate-field-overflow'
      : (activeCandidateCount > 0 ? 'material-interface-candidate-field-ready' : 'material-interface-candidate-field-empty'),
    reason: compactOverflowCount > 0 || activeCandidateCount > compactCapacity
      ? `compact material-interface candidate capacity ${compactCapacity} was exceeded by ${compactOverflowCount} rows`
      : null,
    sourceSchema: renderField.schema,
    sourceBackend: renderField.backend,
    surfaceCount,
    totalFieldCells,
    candidateCount,
    activeCandidateCount,
    rowLayout: [...SPH_MATERIAL_INTERFACE_CANDIDATE_ROW_LAYOUT],
    rowStrideFloats: SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
    candidateRows,
    candidateRowByteLength: candidateRows.byteLength,
    candidateDenseRowsByteLength: denseCandidateRowsByteLength,
    candidateCompactRowsByteLength: activeRowsByteLength,
    compactCandidateCapacity: compactCapacity,
    compactCandidateOverflowCount: compactOverflowCount,
    compactCandidateMetadata: {
      activeCandidateCount,
      overflowCount: compactOverflowCount,
      capacity: compactCapacity,
      denseCandidateCount: candidateCount
    },
    candidateShape: 'compact-active-render-field-cell-axis-triplets',
    surfaces,
    fieldRowsBufferBound: Boolean(borrowedFieldRowsBuffer),
    surfaceBufferBound: Boolean(borrowedSurfaceBuffer),
    sourceIndexFieldBufferBound: sourceIndexFieldAvailable,
    queueCompletionStatus: 'compact-readback-map-completed',
    queueCompletionMethod: 'mapAsync(compact-candidate-readback-buffer)',
    pipelineCacheStatus,
    candidateReadback: true,
    candidateReadbackMode: MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE,
    candidateMetadataReadback: true,
    interfaceSourceKeySchema: ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
    interfaceSourceKeyStatus: sourceIndexFieldAvailable
      ? (interfaceSourceKeyReadyCount > 0 ? 'interface-source-key-retained' : 'interface-source-key-empty')
      : 'interface-source-key-unavailable',
    interfaceSourceKeyReason: sourceIndexFieldAvailable
      ? null
      : 'source-local material-interface source-index field was unavailable',
    interfaceSourceKeyRows,
    interfaceSourceKeyReadback: Boolean(interfaceSourceKeyRows.length > 0),
    interfaceSourceKeyRowCount: compactRowCount,
    interfaceSourceKeyReadyCount,
    interfaceSourceKeyStrideFloats: SPH_INTERFACE_SOURCE_KEY_FLOATS,
    interfaceSourceKeyRowByteLength: activeSourceKeyRowsByteLength,
    interfaceSourceKeyBufferRetained: keepInterfaceSourceKeyBuffer,
    interfaceSourceKeyBufferByteLength: keepInterfaceSourceKeyBuffer ? compactSourceKeyRowsByteLength : 0,
    interfaceSourceKeySurfaceIndexFallbackEnabled: false,
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
  if (keepInterfaceSourceKeyBuffer) {
    result.interfaceSourceKeyBuffer = interfaceSourceKeyBuffer;
    result.destroyMaterialInterfaceCandidateFieldBuffers = ({
      reason = 'material-interface-candidate-field-buffer-cleanup'
    } = {}) => {
      if (retainedInterfaceSourceKeyBufferDestroyed) {
        return {
          schema: 'peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0',
          status: 'material-interface-candidate-field-buffers-already-destroyed',
          reason
        };
      }
      retainedInterfaceSourceKeyBufferDestroyed = true;
      interfaceSourceKeyBuffer.destroy?.();
      result.interfaceSourceKeyBufferRetained = false;
      result.interfaceSourceKeyBufferDestroyed = true;
      return {
        schema: 'peercompute.ulg.sph-material-interface-candidate-field-buffer-cleanup.v0',
        status: 'material-interface-candidate-field-buffers-destroyed',
        reason,
        interfaceSourceKeyBufferDestroyed: true
      };
    };
  }
  return result;
}

const MARCHING_CUBE_EDGE_CORNER_PAIRS = Object.freeze([
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7]
]);
const MARCHING_CUBE_TETRAHEDRA = Object.freeze([
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6]
]);
const MARCHING_CUBE_MAX_TRIANGLES_PER_CELL = 12;
const MARCHING_CUBE_MAX_VERTICES_PER_CELL = MARCHING_CUBE_MAX_TRIANGLES_PER_CELL * 3;

function marchingCubeVoxelCount(resolution) {
  const voxelResolution = Math.max(0, Math.round(finiteNumber(resolution, 0)) - 1);
  return voxelResolution * voxelResolution * voxelResolution;
}

function marchingCubeEdgeCrossingCount(cornerDensities, isolation) {
  let count = 0;
  for (const [leftIndex, rightIndex] of MARCHING_CUBE_EDGE_CORNER_PAIRS) {
    if ((cornerDensities[leftIndex] >= isolation) !== (cornerDensities[rightIndex] >= isolation)) {
      count += 1;
    }
  }
  return count;
}

function writeMarchingCubeCellRow(candidateRows, offset, {
  surface,
  voxelLinearIndex = 0,
  centerM = [0, 0, 0],
  cellSizeM = 0,
  caseIndex = 0,
  edgeCrossingCount = 0,
  triangleCount = 0,
  vertexCount = 0,
  densityMin = 0,
  densityMax = 0,
  isolation = 0,
  status = 0
}) {
  candidateRows.set([
    surface.index,
    surface.materialId,
    surface.phaseId,
    voxelLinearIndex,
    centerM[0],
    centerM[1],
    centerM[2],
    cellSizeM,
    caseIndex,
    edgeCrossingCount,
    triangleCount,
    vertexCount,
    densityMin,
    densityMax,
    isolation,
    status
  ], offset);
}

function vectorSubtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vectorCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function triangleNormal(a, b, c) {
  return normalizeVector3(vectorCross(vectorSubtract(b, a), vectorSubtract(c, a)));
}

function vectorAverage(vectors) {
  if (!vectors.length) return [0, 0, 0];
  const sum = vectors.reduce((acc, vector) => [
    acc[0] + vector[0],
    acc[1] + vector[1],
    acc[2] + vector[2]
  ], [0, 0, 0]);
  return [sum[0] / vectors.length, sum[1] / vectors.length, sum[2] / vectors.length];
}

function interpolateIsoPoint(a, b, valueA, valueB, isolation) {
  const denom = valueB - valueA;
  const t = Math.abs(denom) > 1e-12 ? clamp((isolation - valueA) / denom, 0, 1) : 0.5;
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function emitSurfaceTriangle(vertexRows, {
  surface,
  triangleIndex,
  sourceVoxelLinearIndex,
  isolation,
  vertices,
  outwardHint = null,
  density = isolation
}) {
  let orientedVertices = vertices;
  let normal = triangleNormal(vertices[0], vertices[1], vertices[2]);
  if (
    Array.isArray(outwardHint)
    && outwardHint.length >= 3
    && normal[0] * outwardHint[0] + normal[1] * outwardHint[1] + normal[2] * outwardHint[2] < 0
  ) {
    orientedVertices = [vertices[0], vertices[2], vertices[1]];
    normal = triangleNormal(orientedVertices[0], orientedVertices[1], orientedVertices[2]);
  }
  for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
    const vertex = orientedVertices[vertexIndex];
    vertexRows.push(
      surface.index,
      surface.materialId,
      surface.phaseId,
      triangleIndex,
      vertexIndex,
      vertex[0],
      vertex[1],
      vertex[2],
      normal[0],
      normal[1],
      normal[2],
      surface.opticalStateId || 0,
      density,
      isolation,
      sourceVoxelLinearIndex,
      1
    );
  }
}

function emitTetraSurfaceTriangles({
  vertexRows,
  surface,
  cornerPositions,
  cornerDensities,
  tetrahedron,
  isolation,
  sourceVoxelLinearIndex,
  triangleIndex
}) {
  const inside = [];
  const outside = [];
  for (const cornerIndex of tetrahedron) {
    if (cornerDensities[cornerIndex] >= isolation) {
      inside.push(cornerIndex);
    } else {
      outside.push(cornerIndex);
    }
  }
  if (inside.length === 0 || inside.length === 4) return triangleIndex;

  if (inside.length === 1 || inside.length === 3) {
    const source = inside.length === 1 ? inside[0] : outside[0];
    const targets = inside.length === 1 ? outside : inside;
    const sourcePosition = cornerPositions[source];
    const targetPositions = targets.map((target) => cornerPositions[target]);
    const outwardHint = inside.length === 1
      ? vectorSubtract(vectorAverage(targetPositions), sourcePosition)
      : vectorSubtract(sourcePosition, vectorAverage(targetPositions));
    const vertices = targets.map((target) => interpolateIsoPoint(
      cornerPositions[source],
      cornerPositions[target],
      cornerDensities[source],
      cornerDensities[target],
      isolation
    ));
    emitSurfaceTriangle(vertexRows, {
      surface,
      triangleIndex,
      sourceVoxelLinearIndex,
      isolation,
      vertices,
      outwardHint
    });
    return triangleIndex + 1;
  }

  const [insideA, insideB] = inside;
  const [outsideA, outsideB] = outside;
  const edgeA0 = interpolateIsoPoint(
    cornerPositions[insideA],
    cornerPositions[outsideA],
    cornerDensities[insideA],
    cornerDensities[outsideA],
    isolation
  );
  const edgeA1 = interpolateIsoPoint(
    cornerPositions[insideA],
    cornerPositions[outsideB],
    cornerDensities[insideA],
    cornerDensities[outsideB],
    isolation
  );
  const edgeB0 = interpolateIsoPoint(
    cornerPositions[insideB],
    cornerPositions[outsideA],
    cornerDensities[insideB],
    cornerDensities[outsideA],
    isolation
  );
  const edgeB1 = interpolateIsoPoint(
    cornerPositions[insideB],
    cornerPositions[outsideB],
    cornerDensities[insideB],
    cornerDensities[outsideB],
    isolation
  );
  const outwardHint = vectorSubtract(
    vectorAverage([cornerPositions[outsideA], cornerPositions[outsideB]]),
    vectorAverage([cornerPositions[insideA], cornerPositions[insideB]])
  );
  emitSurfaceTriangle(vertexRows, {
    surface,
    triangleIndex,
    sourceVoxelLinearIndex,
    isolation,
    vertices: [edgeA0, edgeA1, edgeB0],
    outwardHint
  });
  emitSurfaceTriangle(vertexRows, {
    surface,
    triangleIndex: triangleIndex + 1,
    sourceVoxelLinearIndex,
    isolation,
    vertices: [edgeB0, edgeA1, edgeB1],
    outwardHint
  });
  return triangleIndex + 2;
}

export function deriveSphRenderMarchingCubeCellsCpu(renderField, {
  isolationScale = 1
} = {}) {
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('deriveSphRenderMarchingCubeCellsCpu requires an SPH render field with fieldRows');
  }
  const surfaceFields = splitSphRenderFieldBySurface(renderField);
  const candidateCount = Math.max(0, renderField.totalFieldCells || 0);
  const cellRows = new Float32Array(candidateCount * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS);
  let activeCellCount = 0;
  let reservedTriangleCount = 0;
  let reservedVertexCount = 0;
  const surfaces = surfaceFields.map((surface) => {
    const resolution = surface.resolution;
    const voxelResolution = Math.max(0, resolution - 1);
    const voxelCount = marchingCubeVoxelCount(resolution);
    const isolation = surface.isolation * finiteNumber(isolationScale, 1);
    const fieldPadding = finiteNumber(renderField.fieldPadding, 0.22);
    const refEdgeM = Math.max(finiteNumber(renderField.refEdgeM, 1), 1e-12);
    const span = Math.max(1e-12, 1 - 2 * fieldPadding);
    const cellSizeM = refEdgeM / (span * Math.max(resolution, 1));
    const activeStart = activeCellCount;
    const triangleStart = reservedTriangleCount;

    for (let voxelIndex = 0; voxelIndex < voxelCount; voxelIndex += 1) {
      const z = Math.floor(voxelIndex / (voxelResolution * voxelResolution));
      const rem = voxelIndex - z * voxelResolution * voxelResolution;
      const y = Math.floor(rem / voxelResolution);
      const x = rem - y * voxelResolution;
      const cornerDensities = [
        surface.field[fieldIndex3d(x, y, z, resolution)],
        surface.field[fieldIndex3d(x + 1, y, z, resolution)],
        surface.field[fieldIndex3d(x + 1, y + 1, z, resolution)],
        surface.field[fieldIndex3d(x, y + 1, z, resolution)],
        surface.field[fieldIndex3d(x, y, z + 1, resolution)],
        surface.field[fieldIndex3d(x + 1, y, z + 1, resolution)],
        surface.field[fieldIndex3d(x + 1, y + 1, z + 1, resolution)],
        surface.field[fieldIndex3d(x, y + 1, z + 1, resolution)]
      ];
      let caseIndex = 0;
      for (let cornerIndex = 0; cornerIndex < cornerDensities.length; cornerIndex += 1) {
        if (cornerDensities[cornerIndex] >= isolation) caseIndex |= (1 << cornerIndex);
      }
      const edgeCrossingCount = marchingCubeEdgeCrossingCount(cornerDensities, isolation);
      const active = caseIndex !== 0 && caseIndex !== 255;
      const triangleCount = active ? MARCHING_CUBE_MAX_TRIANGLES_PER_CELL : 0;
      const vertexCount = triangleCount * 3;
      const centerM = fieldCoordPhysicalM(
        x + 0.5,
        y + 0.5,
        z + 0.5,
        resolution,
        fieldPadding,
        refEdgeM
      );
      writeMarchingCubeCellRow(cellRows, (surface.fieldOffset + voxelIndex) * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS, {
        surface,
        voxelLinearIndex: voxelIndex,
        centerM,
        cellSizeM,
        caseIndex,
        edgeCrossingCount,
        triangleCount,
        vertexCount,
        densityMin: Math.min(...cornerDensities),
        densityMax: Math.max(...cornerDensities),
        isolation,
        status: active ? 1 : 0
      });
      if (active) {
        activeCellCount += 1;
        reservedTriangleCount += triangleCount;
        reservedVertexCount += vertexCount;
      }
    }

    const surfaceActiveCellCount = activeCellCount - activeStart;
    const surfaceTriangleCount = reservedTriangleCount - triangleStart;
    return {
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      resolution,
      isolation,
      voxelResolution,
      voxelCount,
      cellOffset: surface.fieldOffset,
      cellCount: surface.fieldCellCount,
      activeCellCount: surfaceActiveCellCount,
      reservedTriangleCount: surfaceTriangleCount,
      reservedVertexCount: surfaceTriangleCount * 3,
      status: surfaceActiveCellCount > 0 ? 'marching-cube-cells-active' : 'marching-cube-cells-empty'
    };
  });

  return {
    schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
    backend: 'cpu-reference',
    status: activeCellCount > 0 ? 'marching-cube-cells-ready' : 'marching-cube-cells-empty',
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    cubeShape: 'fixed-surface-voxel-cubes',
    surfaceCount: surfaces.length,
    totalFieldCells: renderField.totalFieldCells,
    totalCubeCells: candidateCount,
    maxSurfaceCubeCells: Math.max(0, ...(surfaces.map((surface) => surface.voxelCount))),
    activeCellCount,
    reservedTriangleCount,
    reservedVertexCount,
    rowLayout: [...SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS,
    cellRows,
    cellRowsByteLength: cellRows.byteLength,
    marchingCubeCellReadback: true,
    renderFieldReadback: Boolean(renderField.renderFieldReadback),
    emissionStatus: 'pending-prefix-compact-and-triangle-emission',
    surfaces,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
}

export function deriveSphRenderSurfaceVerticesCpu(renderField, {
  isolationScale = 1
} = {}) {
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('deriveSphRenderSurfaceVerticesCpu requires an SPH render field with fieldRows');
  }
  const surfaceFields = splitSphRenderFieldBySurface(renderField);
  const vertexRows = [];
  let triangleCount = 0;
  let activeCellCount = 0;
  const surfaces = surfaceFields.map((surface) => {
    const resolution = surface.resolution;
    const voxelResolution = Math.max(0, resolution - 1);
    const voxelCount = marchingCubeVoxelCount(resolution);
    const isolation = surface.isolation * finiteNumber(isolationScale, 1);
    const fieldPadding = finiteNumber(renderField.fieldPadding, 0.22);
    const refEdgeM = Math.max(finiteNumber(renderField.refEdgeM, 1), 1e-12);
    const triangleStart = triangleCount;
    const vertexStart = vertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
    const activeCellStart = activeCellCount;

    for (let voxelIndex = 0; voxelIndex < voxelCount; voxelIndex += 1) {
      const z = Math.floor(voxelIndex / (voxelResolution * voxelResolution));
      const rem = voxelIndex - z * voxelResolution * voxelResolution;
      const y = Math.floor(rem / voxelResolution);
      const x = rem - y * voxelResolution;
      const cornerDensities = [
        surface.field[fieldIndex3d(x, y, z, resolution)],
        surface.field[fieldIndex3d(x + 1, y, z, resolution)],
        surface.field[fieldIndex3d(x + 1, y + 1, z, resolution)],
        surface.field[fieldIndex3d(x, y + 1, z, resolution)],
        surface.field[fieldIndex3d(x, y, z + 1, resolution)],
        surface.field[fieldIndex3d(x + 1, y, z + 1, resolution)],
        surface.field[fieldIndex3d(x + 1, y + 1, z + 1, resolution)],
        surface.field[fieldIndex3d(x, y + 1, z + 1, resolution)]
      ];
      let caseIndex = 0;
      for (let cornerIndex = 0; cornerIndex < cornerDensities.length; cornerIndex += 1) {
        if (cornerDensities[cornerIndex] >= isolation) caseIndex |= (1 << cornerIndex);
      }
      if (caseIndex === 0 || caseIndex === 255) continue;
      activeCellCount += 1;
      const cornerPositions = [
        fieldCoordPhysicalM(x, y, z, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x + 1, y, z, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x + 1, y + 1, z, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x, y + 1, z, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x, y, z + 1, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x + 1, y, z + 1, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x + 1, y + 1, z + 1, resolution, fieldPadding, refEdgeM),
        fieldCoordPhysicalM(x, y + 1, z + 1, resolution, fieldPadding, refEdgeM)
      ];
      for (const tetrahedron of MARCHING_CUBE_TETRAHEDRA) {
        triangleCount = emitTetraSurfaceTriangles({
          vertexRows,
          surface,
          cornerPositions,
          cornerDensities,
          tetrahedron,
          isolation,
          sourceVoxelLinearIndex: voxelIndex,
          triangleIndex: triangleCount
        });
      }
    }

    const surfaceTriangleCount = triangleCount - triangleStart;
    const surfaceVertexCount = surfaceTriangleCount * 3;
    const renderPolicy = renderPolicyFieldsForSurface(surface);
    return {
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      renderLayer: surface.renderLayer ?? renderPolicy.renderLayer,
      renderOrder: renderPolicy.renderOrder,
      transparencyClassId: renderPolicy.transparencyClassId,
      depthWriteFlag: renderPolicy.depthWriteFlag,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      opticalStateId: surface.opticalStateId || 0,
      resolution,
      isolation,
      voxelResolution,
      voxelCount,
      fieldOffset: surface.fieldOffset,
      fieldCellCount: surface.fieldCellCount,
      activeCellCount: activeCellCount - activeCellStart,
      triangleOffset: triangleStart,
      triangleCount: surfaceTriangleCount,
      vertexOffset: vertexStart,
      vertexCount: surfaceVertexCount,
      status: surfaceTriangleCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty'
    };
  });
  const vertexRowsArray = Float32Array.from(vertexRows);
  return {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'cpu-reference',
    status: triangleCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty',
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    surfaceExtractionMethod: 'tetrahedralized-render-field-cubes',
    compactionMode: 'cpu-compact',
    surfaceCount: surfaces.length,
    totalFieldCells: renderField.totalFieldCells,
    activeCellCount,
    triangleCount,
    vertexCount: triangleCount * 3,
    maxTrianglesPerCell: MARCHING_CUBE_MAX_TRIANGLES_PER_CELL,
    maxVerticesPerCell: MARCHING_CUBE_MAX_VERTICES_PER_CELL,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
    vertexRows: vertexRowsArray,
    vertexRowsByteLength: vertexRowsArray.byteLength,
    surfaceVertexReadback: true,
    renderFieldReadback: Boolean(renderField.renderFieldReadback),
    surfaces,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
}

function assertSurfaceVertexField(vertexField) {
  if (
    vertexField?.schema !== ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA
    || !(vertexField.vertexRows instanceof Float32Array)
  ) {
    throw new TypeError('surface vertex field requires packed vertexRows');
  }
  if (vertexField.vertexRows.length % SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS !== 0) {
    throw new RangeError('surface vertex rows must align to the vertex row stride');
  }
}

function transparencyClassForPhaseId(phaseId) {
  const id = Math.round(finiteNumber(phaseId, 0));
  if (id === GPU_PHASE_IDS.gas) return 3;
  if (id === GPU_PHASE_IDS.liquid) return 2;
  return 0;
}

function renderPolicyFieldsForSurface(surface = {}) {
  const explicitTransparency = Number(surface.transparencyClassId);
  const transparencyClassId = Number.isFinite(explicitTransparency) && explicitTransparency >= 0
    ? explicitTransparency
    : transparencyClassForPhaseId(surface.phaseId);
  const explicitDepthWrite = Number(surface.depthWriteFlag);
  const depthWriteFlag = Number.isFinite(explicitDepthWrite) && explicitDepthWrite >= 0
    ? explicitDepthWrite
    : (transparencyClassId > 0 ? 0 : 1);
  const explicitRenderOrder = Number(surface.renderOrder);
  const surfaceIndex = finiteNumber(surface.surfaceIndex ?? surface.index, 0);
  const renderOrder = Number.isFinite(explicitRenderOrder)
    ? explicitRenderOrder
    : (transparencyClassId * 1000 + surfaceIndex);
  return {
    renderLayer: surface.renderLayer ?? null,
    renderOrder,
    transparencyClassId,
    depthWriteFlag
  };
}

function writeSurfaceDrawRow(drawRows, offset, {
  surfaceIndex = 0,
  materialId = 0,
  phaseId = 0,
  opticalStateId = 0,
  vertexOffset = 0,
  vertexCount = 0,
  triangleOffset = 0,
  triangleCount = 0,
  renderOrder = 0,
  transparencyClassId = 0,
  depthWriteFlag = 1,
  status = 0,
  boundsCenterM = [0, 0, 0],
  boundsRadiusM = 0
}) {
  drawRows.set([
    surfaceIndex,
    materialId,
    phaseId,
    opticalStateId,
    vertexOffset,
    vertexCount,
    triangleOffset,
    triangleCount,
    renderOrder,
    transparencyClassId,
    depthWriteFlag,
    status,
    boundsCenterM[0],
    boundsCenterM[1],
    boundsCenterM[2],
    boundsRadiusM
  ], offset);
}

function writeSurfaceDrawIndirectRow(indirectRows, offset, {
  vertexCount = 0,
  instanceCount = 0,
  firstVertex = 0,
  firstInstance = 0
}) {
  indirectRows.set([
    Math.max(0, Math.round(finiteNumber(vertexCount, 0))),
    Math.max(0, Math.round(finiteNumber(instanceCount, 0))),
    Math.max(0, Math.round(finiteNumber(firstVertex, 0))),
    Math.max(0, Math.round(finiteNumber(firstInstance, 0)))
  ], offset);
}

function surfaceRecordsFromSurfaceVertexMetadata(surfaceVertices) {
  const surfaces = surfaceVertices?.surfaces || [];
  const surfaceCount = Math.max(0, Math.round(finiteNumber(surfaceVertices?.surfaceCount, surfaces.length)));
  const records = new Float32Array(surfaceCount * SPH_GPU_RENDER_SURFACE_ROW_FLOATS);
  for (let index = 0; index < surfaceCount; index += 1) {
    const surface = surfaces[index] || {};
    const offset = index * SPH_GPU_RENDER_SURFACE_ROW_FLOATS;
    const color = Array.isArray(surface.colorLinear) || ArrayBuffer.isView(surface.colorLinear)
      ? surface.colorLinear
      : [1, 1, 1];
    records.set([
      finiteNumber(surface.materialId, 0),
      finiteNumber(surface.phaseId, GPU_PHASE_IDS.unknown),
      finiteNumber(surface.fieldOffset ?? surface.cellOffset, 0),
      finiteNumber(surface.fieldCellCount ?? surface.cellCount ?? surface.voxelCount ?? 0, 0),
      finiteNumber(surface.resolution, 0),
      finiteNumber(surface.isolation, 0),
      finiteNumber(surface.subtract, 0),
      finiteNumber(surface.strength, 0),
      finiteNumber(surface.radiusNorm, 0),
      clamp(finiteNumber(color[0], 1), 0, 1),
      clamp(finiteNumber(color[1], 1), 0, 1),
      clamp(finiteNumber(color[2], 1), 0, 1),
      1,
      finiteNumber(surface.opticalStateId, 0),
      Number.isFinite(Number(surface.transparencyClassId)) ? Number(surface.transparencyClassId) : -1,
      Number.isFinite(Number(surface.depthWriteFlag)) ? Number(surface.depthWriteFlag) : -1
    ], offset);
  }
  return records;
}

export function deriveSphRenderSurfaceDrawMetadataCpu(surfaceVertices) {
  assertSurfaceVertexField(surfaceVertices);
  const surfaceDescriptors = surfaceVertices.surfaces || [];
  const groups = new Map();
  for (const surface of surfaceDescriptors) {
    const surfaceIndex = Math.round(finiteNumber(surface.surfaceIndex ?? surface.index, surfaceDescriptors.indexOf(surface)));
    const renderPolicy = renderPolicyFieldsForSurface({
      ...surface,
      surfaceIndex
    });
    groups.set(surfaceIndex, {
      surface,
      surfaceIndex,
      vertexOffset: Infinity,
      vertexCount: 0,
      triangleIds: new Set(),
      minTriangle: Infinity,
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
      ...renderPolicy
    });
  }

  const rowCount = surfaceVertices.vertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
    if (!(surfaceVertices.vertexRows[offset + 15] > 0)) continue;
    const surfaceIndex = Math.round(surfaceVertices.vertexRows[offset]);
    let group = groups.get(surfaceIndex);
    if (!group) {
      const phaseId = surfaceVertices.vertexRows[offset + 2];
      group = {
        surface: {
          surfaceKey: `surface-${surfaceIndex}`,
          materialId: surfaceVertices.vertexRows[offset + 1],
          phaseId,
          opticalStateId: surfaceVertices.vertexRows[offset + 11] || 0
        },
        surfaceIndex,
        vertexOffset: Infinity,
        vertexCount: 0,
        triangleIds: new Set(),
        minTriangle: Infinity,
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
        ...renderPolicyFieldsForSurface({
          phaseId,
          surfaceIndex
        })
      };
      groups.set(surfaceIndex, group);
    }
    group.vertexOffset = Math.min(group.vertexOffset, rowIndex);
    group.vertexCount += 1;
    const triangleIndex = Math.round(surfaceVertices.vertexRows[offset + 3]);
    group.triangleIds.add(triangleIndex);
    group.minTriangle = Math.min(group.minTriangle, triangleIndex);
    for (let axis = 0; axis < 3; axis += 1) {
      const value = surfaceVertices.vertexRows[offset + 5 + axis];
      group.min[axis] = Math.min(group.min[axis], value);
      group.max[axis] = Math.max(group.max[axis], value);
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => a.surfaceIndex - b.surfaceIndex);
  const drawRows = new Float32Array(sortedGroups.length * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS);
  const drawIndirectRows = new Uint32Array(sortedGroups.length * SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS);
  let activeSurfaceCount = 0;
  let totalVertexCount = 0;
  let totalTriangleCount = 0;
  const surfaces = sortedGroups.map((group, drawIndex) => {
    const vertexCount = group.vertexCount;
    const triangleCount = group.triangleIds.size;
    const active = vertexCount > 0 && triangleCount > 0;
    if (active) activeSurfaceCount += 1;
    totalVertexCount += vertexCount;
    totalTriangleCount += triangleCount;
    const boundsCenterM = active
      ? [
          (group.min[0] + group.max[0]) * 0.5,
          (group.min[1] + group.max[1]) * 0.5,
          (group.min[2] + group.max[2]) * 0.5
        ]
      : [0, 0, 0];
    const boundsRadiusM = active
      ? Math.hypot(
        group.max[0] - boundsCenterM[0],
        group.max[1] - boundsCenterM[1],
        group.max[2] - boundsCenterM[2]
      )
      : 0;
    const { renderOrder, transparencyClassId, depthWriteFlag } = renderPolicyFieldsForSurface({
      ...group.surface,
      surfaceIndex: group.surfaceIndex,
      renderOrder: group.renderOrder,
      transparencyClassId: group.transparencyClassId,
      depthWriteFlag: group.depthWriteFlag
    });
    const vertexOffset = active ? group.vertexOffset : 0;
    const triangleOffset = active ? group.minTriangle : 0;
    writeSurfaceDrawRow(drawRows, drawIndex * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS, {
      surfaceIndex: group.surfaceIndex,
      materialId: group.surface.materialId,
      phaseId: group.surface.phaseId,
      opticalStateId: group.surface.opticalStateId || 0,
      vertexOffset,
      vertexCount,
      triangleOffset,
      triangleCount,
      renderOrder,
      transparencyClassId,
      depthWriteFlag,
      status: active ? 1 : 0,
      boundsCenterM,
      boundsRadiusM
    });
    writeSurfaceDrawIndirectRow(drawIndirectRows, drawIndex * SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS, {
      vertexCount: active ? vertexCount : 0,
      instanceCount: active ? 1 : 0,
      firstVertex: vertexOffset,
      firstInstance: group.surfaceIndex
    });
    return {
      surfaceKey: group.surface.surfaceKey,
      material: group.surface.material,
      phase: group.surface.phase,
      renderKey: group.surface.renderKey,
      renderLayer: group.surface.renderLayer ?? group.renderLayer ?? null,
      surfaceIndex: group.surfaceIndex,
      materialId: group.surface.materialId,
      phaseId: group.surface.phaseId,
      opticalStateId: group.surface.opticalStateId || 0,
      vertexOffset,
      vertexCount,
      triangleOffset,
      triangleCount,
      renderOrder,
      transparencyClassId,
      depthWriteFlag,
      boundsCenterM,
      boundsRadiusM,
      status: active ? 'surface-draw-ready' : 'surface-draw-empty'
    };
  });

  return {
    schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    backend: 'cpu-reference',
    status: activeSurfaceCount > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty',
    sourceSurfaceVertexSchema: surfaceVertices.schema,
    sourceSurfaceVertexBackend: surfaceVertices.backend,
    surfaceCount: surfaces.length,
    activeSurfaceCount,
    vertexCount: totalVertexCount,
    triangleCount: totalTriangleCount,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
    drawRows,
    drawRowsByteLength: drawRows.byteLength,
    drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    drawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    drawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
    drawIndirectRows,
    drawIndirectRowsByteLength: drawIndirectRows.byteLength,
    compactionMode: 'cpu-prefix-from-compact-vertices',
    surfaces,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
}

function assertSurfaceDrawMetadata(drawMetadata) {
  if (
    drawMetadata?.schema !== ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA
    || !(drawMetadata.drawRows instanceof Float32Array)
  ) {
    throw new TypeError('surface draw metadata requires packed drawRows');
  }
  if (drawMetadata.drawRows.length % SPH_GPU_RENDER_SURFACE_DRAW_FLOATS !== 0) {
    throw new RangeError('surface draw rows must align to the draw row stride');
  }
}

function summarizeSurfaceDrawRows(drawRows, sourceSurfaces = []) {
  const surfaceCount = drawRows.length / SPH_GPU_RENDER_SURFACE_DRAW_FLOATS;
  let activeSurfaceCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  const surfaces = [];
  for (let index = 0; index < surfaceCount; index += 1) {
    const offset = index * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS;
    const sourceSurface = sourceSurfaces[index] || {};
    const active = drawRows[offset + 11] > 0;
    const surfaceVertexCount = Math.round(finiteNumber(drawRows[offset + 5], 0));
    const surfaceTriangleCount = Math.round(finiteNumber(drawRows[offset + 7], 0));
    if (active) activeSurfaceCount += 1;
    vertexCount += surfaceVertexCount;
    triangleCount += surfaceTriangleCount;
    surfaces.push({
      surfaceKey: sourceSurface.surfaceKey,
      material: sourceSurface.material,
      phase: sourceSurface.phase,
      renderKey: sourceSurface.renderKey,
      surfaceIndex: Math.round(finiteNumber(drawRows[offset], index)),
      materialId: drawRows[offset + 1],
      phaseId: drawRows[offset + 2],
      opticalStateId: drawRows[offset + 3],
      vertexOffset: Math.round(finiteNumber(drawRows[offset + 4], 0)),
      vertexCount: surfaceVertexCount,
      triangleOffset: Math.round(finiteNumber(drawRows[offset + 6], 0)),
      triangleCount: surfaceTriangleCount,
      renderOrder: drawRows[offset + 8],
      transparencyClassId: drawRows[offset + 9],
      depthWriteFlag: drawRows[offset + 10],
      boundsCenterM: [drawRows[offset + 12], drawRows[offset + 13], drawRows[offset + 14]],
      boundsRadiusM: drawRows[offset + 15],
      status: active ? 'surface-draw-ready' : 'surface-draw-empty'
    });
  }
  return { surfaces, activeSurfaceCount, vertexCount, triangleCount };
}

function physicalRenderFieldCoordM(coord, resolution, fieldPadding, refEdgeM) {
  const span = Math.max(1e-12, 1 - 2 * finiteNumber(fieldPadding, 0.22));
  return (((coord / Math.max(1, resolution)) - finiteNumber(fieldPadding, 0.22)) * Math.max(finiteNumber(refEdgeM, 10), 1e-12)) / span;
}

function writeRenderFieldSurfaceSummaryRow(rows, offset, {
  surfaceIndex,
  materialId,
  phaseId,
  opticalStateId = 0,
  activeCellCount = 0,
  crossingCellCount = activeCellCount,
  maxDensity = 0,
  isolation = 0,
  minActiveM = [0, 0, 0],
  maxActiveM = [0, 0, 0],
  cellSizeM = 0,
  boundsCenterM = [0, 0, 0],
  boundsRadiusM = 0,
  status = 0
}) {
  rows.set([
    surfaceIndex,
    materialId,
    phaseId,
    opticalStateId,
    activeCellCount,
    crossingCellCount,
    maxDensity,
    isolation,
    minActiveM[0],
    minActiveM[1],
    minActiveM[2],
    status,
    maxActiveM[0],
    maxActiveM[1],
    maxActiveM[2],
    cellSizeM,
    boundsCenterM[0],
    boundsCenterM[1],
    boundsCenterM[2],
    boundsRadiusM
  ], offset);
}

function summarizeRenderFieldSurfaceSummaryRows(summaryRows, sourceSurfaces = []) {
  const surfaceCount = summaryRows.length / SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS;
  let activeSurfaceCount = 0;
  let activeCellCount = 0;
  let maxDensity = 0;
  const surfaces = [];
  for (let index = 0; index < surfaceCount; index += 1) {
    const offset = index * SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS;
    const sourceSurface = sourceSurfaces[index] || {};
    const active = summaryRows[offset + 11] > 0;
    const surfaceActiveCellCount = Math.round(finiteNumber(summaryRows[offset + 4], 0));
    const surfaceMaxDensity = finiteNumber(summaryRows[offset + 6], 0);
    if (active) activeSurfaceCount += 1;
    activeCellCount += surfaceActiveCellCount;
    maxDensity = Math.max(maxDensity, surfaceMaxDensity);
    surfaces.push({
      surfaceKey: sourceSurface.surfaceKey,
      material: sourceSurface.material,
      phase: sourceSurface.phase,
      renderKey: sourceSurface.renderKey,
      surfaceIndex: Math.round(finiteNumber(summaryRows[offset], index)),
      materialId: summaryRows[offset + 1],
      phaseId: summaryRows[offset + 2],
      opticalStateId: summaryRows[offset + 3],
      activeCellCount: surfaceActiveCellCount,
      crossingCellCount: Math.round(finiteNumber(summaryRows[offset + 5], 0)),
      maxDensity: surfaceMaxDensity,
      isolation: summaryRows[offset + 7],
      minActiveM: [summaryRows[offset + 8], summaryRows[offset + 9], summaryRows[offset + 10]],
      maxActiveM: [summaryRows[offset + 12], summaryRows[offset + 13], summaryRows[offset + 14]],
      cellSizeM: summaryRows[offset + 15],
      boundsCenterM: [summaryRows[offset + 16], summaryRows[offset + 17], summaryRows[offset + 18]],
      boundsRadiusM: summaryRows[offset + 19],
      status: active ? 'render-field-surface-active' : 'render-field-surface-empty'
    });
  }
  return { surfaces, activeSurfaceCount, activeCellCount, maxDensity };
}

export function summarizeSphRenderFieldSurfacesCpu(renderField, {
  isolationScale = 1
} = {}) {
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA || !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('summarizeSphRenderFieldSurfacesCpu requires a render field with fieldRows');
  }
  const metadata = renderField.surfaceTable?.metadata || [];
  const summaryRows = new Float32Array(metadata.length * SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS);
  const fieldPadding = finiteNumber(renderField.fieldPadding, 0.22);
  const refEdgeM = finiteNumber(renderField.refEdgeM, 10);
  for (const surface of metadata) {
    const resolution = Math.max(1, Math.round(finiteNumber(surface.resolution, 1)));
    const boundedCellCount = Math.min(
      Math.max(0, Math.round(finiteNumber(surface.fieldCellCount, 0))),
      resolution ** 3
    );
    const isolation = finiteNumber(surface.isolation, 0) * finiteNumber(isolationScale, 1);
    const cellSizeM = Math.max(refEdgeM, 1e-12) / Math.max(1e-12, (1 - 2 * fieldPadding) * resolution);
    let activeCellCount = 0;
    let maxDensity = 0;
    const minActiveM = [Infinity, Infinity, Infinity];
    const maxActiveM = [-Infinity, -Infinity, -Infinity];
    for (let cellIndex = 0; cellIndex < boundedCellCount; cellIndex += 1) {
      const density = renderField.fieldRows[(surface.fieldOffset + cellIndex) * SPH_GPU_RENDER_FIELD_CELL_FLOATS];
      maxDensity = Math.max(maxDensity, finiteNumber(density, 0));
      if (!(density >= isolation && density > 0)) continue;
      const xy = resolution * resolution;
      const z = Math.floor(cellIndex / xy);
      const rem = cellIndex - z * xy;
      const y = Math.floor(rem / resolution);
      const x = rem - y * resolution;
      const pos = [
        physicalRenderFieldCoordM(x, resolution, fieldPadding, refEdgeM),
        physicalRenderFieldCoordM(y, resolution, fieldPadding, refEdgeM),
        physicalRenderFieldCoordM(z, resolution, fieldPadding, refEdgeM)
      ];
      for (let axis = 0; axis < 3; axis += 1) {
        minActiveM[axis] = Math.min(minActiveM[axis], pos[axis]);
        maxActiveM[axis] = Math.max(maxActiveM[axis], pos[axis]);
      }
      activeCellCount += 1;
    }
    const active = activeCellCount > 0;
    const resolvedMin = active ? minActiveM : [0, 0, 0];
    const resolvedMax = active ? maxActiveM : [0, 0, 0];
    const boundsCenterM = active
      ? [
          (resolvedMin[0] + resolvedMax[0]) * 0.5,
          (resolvedMin[1] + resolvedMax[1]) * 0.5,
          (resolvedMin[2] + resolvedMax[2]) * 0.5
        ]
      : [0, 0, 0];
    const boundsRadiusM = active
      ? Math.hypot(
        resolvedMax[0] - boundsCenterM[0],
        resolvedMax[1] - boundsCenterM[1],
        resolvedMax[2] - boundsCenterM[2]
      )
      : 0;
    writeRenderFieldSurfaceSummaryRow(
      summaryRows,
      surface.index * SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS,
      {
        surfaceIndex: surface.index,
        materialId: surface.materialId,
        phaseId: surface.phaseId,
        opticalStateId: surface.opticalStateId || 0,
        activeCellCount,
        crossingCellCount: activeCellCount,
        maxDensity,
        isolation,
        minActiveM: resolvedMin,
        maxActiveM: resolvedMax,
        cellSizeM,
        boundsCenterM,
        boundsRadiusM,
        status: active ? 1 : 0
      }
    );
  }
  const summary = summarizeRenderFieldSurfaceSummaryRows(summaryRows, metadata);
  return {
    schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA,
    backend: 'cpu-reference',
    status: summary.activeSurfaceCount > 0
      ? 'render-field-surface-summary-ready'
      : 'render-field-surface-summary-empty',
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    surfaceCount: metadata.length,
    activeSurfaceCount: summary.activeSurfaceCount,
    activeCellCount: summary.activeCellCount,
    maxDensity: summary.maxDensity,
    rowLayout: [...SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS,
    summaryRows,
    summaryRowsByteLength: summaryRows.byteLength,
    renderFieldReadback: Boolean(renderField.renderFieldReadback),
    surfaces: summary.surfaces,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
}

function assertRenderFieldSurfaceSummary(summary) {
  if (
    summary?.schema !== ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA
    || !(summary.summaryRows instanceof Float32Array)
  ) {
    throw new TypeError('render field surface summary requires packed summaryRows');
  }
  if (summary.summaryRows.length % SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS !== 0) {
    throw new RangeError('render field surface summary rows must align to the summary row stride');
  }
}

function assertMarchingCubeCellField(cellField) {
  if (
    cellField?.schema !== ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA
    || !(cellField.cellRows instanceof Float32Array)
  ) {
    throw new TypeError('marching-cube cell field requires packed cellRows');
  }
  if (cellField.cellRows.length % SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS !== 0) {
    throw new RangeError('marching-cube cell rows must align to the cell row stride');
  }
}

function summarizeMarchingCubeCellSurfaces(renderField, cellRows, isolationScale = 1) {
  const metadata = renderField.surfaceTable?.metadata || [];
  const activeBySurface = new Array(metadata.length).fill(0);
  const trianglesBySurface = new Array(metadata.length).fill(0);
  const rowCount = cellRows.length / SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS;
    if (!(cellRows[offset + 15] > 0)) continue;
    const surfaceIndex = Math.round(cellRows[offset]);
    if (surfaceIndex >= 0 && surfaceIndex < activeBySurface.length) {
      activeBySurface[surfaceIndex] += 1;
      trianglesBySurface[surfaceIndex] += cellRows[offset + 10] || 0;
    }
  }
  return metadata.map((surface) => {
    const activeCellCount = activeBySurface[surface.index] || 0;
    const reservedTriangleCount = trianglesBySurface[surface.index] || 0;
    return {
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      resolution: surface.resolution,
      isolation: surface.isolation * finiteNumber(isolationScale, 1),
      voxelResolution: Math.max(0, surface.resolution - 1),
      voxelCount: marchingCubeVoxelCount(surface.resolution),
      cellOffset: surface.fieldOffset,
      cellCount: surface.fieldCellCount,
      activeCellCount,
      reservedTriangleCount,
      reservedVertexCount: reservedTriangleCount * 3,
      status: activeCellCount > 0 ? 'marching-cube-cells-active' : 'marching-cube-cells-empty'
    };
  });
}

export async function summarizeSphRenderFieldSurfacesWebGpu({
  device,
  renderField,
  fieldRowsBuffer = null,
  surfaceBuffer = null,
  isolationScale = 1,
  retainSummaryRowsBuffer = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('summarizeSphRenderFieldSurfacesWebGpu requires a WebGPU-like device');
  }
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    throw new TypeError('summarizeSphRenderFieldSurfacesWebGpu requires an SPH render field');
  }
  if (!fieldRowsBuffer && !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('summarizeSphRenderFieldSurfacesWebGpu requires fieldRows or fieldRowsBuffer');
  }
  if (!surfaceBuffer && !(renderField.surfaceTable?.records instanceof Float32Array)) {
    throw new TypeError('summarizeSphRenderFieldSurfacesWebGpu requires surface table records or surfaceBuffer');
  }
  const surfaceCount = renderField.surfaceTable?.surfaceCount ?? renderField.surfaceCount ?? 0;
  const summaryRowsByteLength = surfaceCount
    * SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const borrowedFieldRowsBuffer = fieldRowsBuffer || null;
  const borrowedSurfaceBuffer = surfaceBuffer || null;
  const sourceFieldRowsBuffer = borrowedFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-summary-source-field',
    renderField.fieldRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceSurfaceBuffer = borrowedSurfaceBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-summary-surfaces',
    renderField.surfaceTable.records
  );
  const summaryRowsBuffer = device.createBuffer({
    label: 'ulg-sph-render-field-surface-summary',
    size: Math.max(4, summaryRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  if (summaryRowsByteLength > 0) {
    device.queue.writeBuffer(summaryRowsBuffer, 0, new Float32Array(surfaceCount * SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS));
  }
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-render-field-surface-summary-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createRenderFieldSurfaceSummaryParamsArray({
    surfaceCount,
    totalFieldCells: renderField.totalFieldCells ?? 0,
    fieldPadding: finiteNumber(renderField.fieldPadding, 0.22),
    refEdgeM: finiteNumber(renderField.refEdgeM, 10),
    isolationScale: finiteNumber(isolationScale, 1)
  }));

  const module = device.createShaderModule({ label: 'ulg-sph-render-field-surface-summary', code: sphRenderFieldSurfaceSummaryWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-render-field-surface-summary',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceSurfaceBuffer } },
      { binding: 1, resource: { buffer: sourceFieldRowsBuffer } },
      { binding: 2, resource: { buffer: summaryRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, surfaceCount));
  pass.end();
  device.queue.submit([encoder.finish()]);
  let queueCompletionStatus = 'queue-submitted';
  let queueCompletionMethod = 'queue.submit';
  let summaryRows = new Float32Array();
  if (summaryRowsByteLength > 0) {
    const bytes = await readBuffer(
      device,
      summaryRowsBuffer,
      summaryRowsByteLength,
      'ulg-sph-render-field-surface-summary-readback'
    );
    summaryRows = new Float32Array(bytes);
    queueCompletionStatus = 'compact-summary-readback-map-completed';
    queueCompletionMethod = 'mapAsync(compact-summary-readback-buffer)';
  }

  if (!borrowedFieldRowsBuffer) sourceFieldRowsBuffer.destroy?.();
  if (!borrowedSurfaceBuffer) sourceSurfaceBuffer.destroy?.();
  if (!retainSummaryRowsBuffer) summaryRowsBuffer.destroy?.();
  paramsBuffer.destroy?.();
  const summary = summarizeRenderFieldSurfaceSummaryRows(summaryRows, renderField.surfaceTable?.metadata || []);
  const result = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA,
    backend: 'webgpu',
    status: summary.activeSurfaceCount > 0
      ? 'render-field-surface-summary-ready'
      : 'render-field-surface-summary-empty',
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    surfaceCount,
    activeSurfaceCount: summary.activeSurfaceCount,
    activeCellCount: summary.activeCellCount,
    maxDensity: summary.maxDensity,
    rowLayout: [...SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS,
    summaryRows,
    summaryRowsByteLength,
    summaryRowsBufferByteLength: retainSummaryRowsBuffer ? summaryRowsByteLength : 0,
    summaryRowsBufferRetained: Boolean(retainSummaryRowsBuffer),
    fieldRowsBufferBound: Boolean(borrowedFieldRowsBuffer),
    surfaceBufferBound: Boolean(borrowedSurfaceBuffer),
    queueCompletionStatus,
    queueCompletionMethod,
    renderFieldSurfaceSummaryReadback: true,
    renderFieldReadback: Boolean(renderField.renderFieldReadback),
    surfaces: summary.surfaces,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  if (retainSummaryRowsBuffer) {
    result.summaryRowsBuffer = summaryRowsBuffer;
    result.destroySummaryRowsBuffer = () => summaryRowsBuffer.destroy?.();
  }
  return result;
}

export async function summarizeSphRenderFieldSurfacesWithOptionalWebGpu({
  renderField,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = summarizeSphRenderFieldSurfacesWebGpu,
  isolationScale = 1,
  parityTolerance = 1e-5,
  ...runnerArgs
} = {}) {
  const canBuildCpu = renderField?.fieldRows instanceof Float32Array && renderField.fieldRows.length > 0;
  const cpuReference = canBuildCpu ? summarizeSphRenderFieldSurfacesCpu(renderField, { isolationScale }) : null;
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      renderFieldSurfaceSummaryReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      renderFieldSurfaceSummaryReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({
      ...runnerArgs,
      renderField,
      isolationScale,
      device: resolvedDeviceResult.device
    });
    assertRenderFieldSurfaceSummary(webgpu);
    if (cpuReference && webgpu.summaryRows.length > 0) {
      const parityMaxAbsDiff = maxAbsDiff(cpuReference.summaryRows, webgpu.summaryRows);
      if (!(parityMaxAbsDiff <= parityTolerance)) {
        return {
          schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
          backend: 'cpu-reference',
          status: 'webgpu-parity-failed-cpu-reference',
          cpuReference,
          webgpu,
          result: cpuReference,
          webgpuStatus: { status: 'fallback-cpu', reason: 'render-field surface summary parity drift', parityMaxAbsDiff },
          renderFieldSurfaceSummaryReadback: false,
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        };
      }
      return {
        schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference,
        webgpu,
        result: webgpu,
        webgpuStatus: { status: 'webgpu-executed', parityMaxAbsDiff },
        renderFieldSurfaceSummaryReadback: true,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted-compact-summary',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed-compact-summary' },
      renderFieldSurfaceSummaryReadback: true,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      renderFieldSurfaceSummaryReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
}

export async function buildSphRenderMarchingCubeCellsWebGpu({
  device,
  renderField,
  fieldRowsBuffer = null,
  surfaceBuffer = null,
  isolationScale = 1,
  readbackMode = FULL_READBACK_MODE,
  retainCellRowsBuffer = false
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphRenderMarchingCubeCellsWebGpu requires a WebGPU-like device');
  }
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    throw new TypeError('buildSphRenderMarchingCubeCellsWebGpu requires an SPH render field');
  }
  if (!fieldRowsBuffer && !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('buildSphRenderMarchingCubeCellsWebGpu requires fieldRows or fieldRowsBuffer');
  }
  if (!surfaceBuffer && !(renderField.surfaceTable?.records instanceof Float32Array)) {
    throw new TypeError('buildSphRenderMarchingCubeCellsWebGpu requires surface table records or surfaceBuffer');
  }
  const surfaceCount = renderField.surfaceTable?.surfaceCount ?? renderField.surfaceCount ?? 0;
  const totalFieldCells = renderField.totalFieldCells ?? 0;
  const candidateCount = totalFieldCells;
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedFieldRowsBuffer = fieldRowsBuffer || null;
  const borrowedSurfaceBuffer = surfaceBuffer || null;
  const sourceFieldRowsBuffer = borrowedFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-marching-cube-source-render-field',
    renderField.fieldRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceSurfaceBuffer = borrowedSurfaceBuffer || writeStorageBuffer(
    device,
    'ulg-sph-marching-cube-render-surfaces',
    renderField.surfaceTable.records
  );
  const cellRowsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-marching-cube-cells',
    new Float32Array(candidateCount * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-marching-cube-cell-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createMarchingCubesCandidateParamsArray({
    surfaceCount,
    totalFieldCells,
    candidateCount,
    fieldPadding: finiteNumber(renderField.fieldPadding, 0.22),
    refEdgeM: finiteNumber(renderField.refEdgeM, 10),
    isolationScale: finiteNumber(isolationScale, 1)
  }));

  const module = device.createShaderModule({ label: 'ulg-sph-marching-cube-cells', code: sphRenderMarchingCubeCellsWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-marching-cube-cells',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceSurfaceBuffer } },
      { binding: 1, resource: { buffer: sourceFieldRowsBuffer } },
      { binding: 2, resource: { buffer: cellRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(Math.max(1, renderField.maxFieldCellCount || 0) / 64),
    Math.max(1, surfaceCount)
  );
  pass.end();
  let cellRows;
  if (!noFullReadback) {
    device.queue.submit([encoder.finish()]);
    const bytes = await readBuffer(
      device,
      cellRowsBuffer,
      candidateCount * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      'ulg-sph-marching-cube-cell-readback'
    );
    cellRows = new Float32Array(bytes);
  } else {
    if (device.queue?.onSubmittedWorkDone) {
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
    } else {
      device.queue.submit([encoder.finish()]);
    }
    cellRows = new Float32Array();
  }

  if (!borrowedFieldRowsBuffer) sourceFieldRowsBuffer.destroy?.();
  if (!borrowedSurfaceBuffer) sourceSurfaceBuffer.destroy?.();
  if (!retainCellRowsBuffer) cellRowsBuffer.destroy?.();
  paramsBuffer.destroy?.();

  const surfaces = cellRows.length
    ? summarizeMarchingCubeCellSurfaces(renderField, cellRows, isolationScale)
    : (renderField.surfaceTable?.metadata || []).map((surface) => ({
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      resolution: surface.resolution,
      isolation: surface.isolation * finiteNumber(isolationScale, 1),
      voxelResolution: Math.max(0, surface.resolution - 1),
      voxelCount: marchingCubeVoxelCount(surface.resolution),
      cellOffset: surface.fieldOffset,
      cellCount: surface.fieldCellCount,
      activeCellCount: null,
      reservedTriangleCount: null,
      reservedVertexCount: null,
      status: 'marching-cube-cell-summary-not-read'
    }));
  const activeCellCount = surfaces.reduce((sum, surface) => sum + (surface.activeCellCount || 0), 0);
  const reservedTriangleCount = surfaces.reduce((sum, surface) => sum + (surface.reservedTriangleCount || 0), 0);
  const cellRowsByteLength = candidateCount * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const result = {
    schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
    backend: 'webgpu',
    status: noFullReadback ? 'marching-cube-cells-resident' : (activeCellCount > 0 ? 'marching-cube-cells-ready' : 'marching-cube-cells-empty'),
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    cubeShape: 'fixed-surface-voxel-cubes',
    surfaceCount,
    totalFieldCells,
    totalCubeCells: candidateCount,
    maxSurfaceCubeCells: Math.max(0, ...(surfaces.map((surface) => surface.voxelCount || 0))),
    activeCellCount,
    reservedTriangleCount,
    reservedVertexCount: reservedTriangleCount * 3,
    rowLayout: [...SPH_GPU_RENDER_MARCHING_CUBE_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS,
    cellRows,
    cellRowsByteLength,
    cellRowsBufferByteLength: retainCellRowsBuffer ? cellRowsByteLength : 0,
    cellRowsBufferRetained: Boolean(retainCellRowsBuffer),
    fieldRowsBufferBound: Boolean(borrowedFieldRowsBuffer),
    surfaceBufferBound: Boolean(borrowedSurfaceBuffer),
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    marchingCubeCellReadback: !noFullReadback,
    renderFieldReadback: Boolean(renderField.renderFieldReadback),
    emissionStatus: 'pending-prefix-compact-and-triangle-emission',
    surfaces,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  if (retainCellRowsBuffer) {
    result.cellRowsBuffer = cellRowsBuffer;
    result.destroyMarchingCubeCellBuffers = () => cellRowsBuffer.destroy?.();
  }
  return result;
}

export async function deriveSphRenderMarchingCubeCellsWithOptionalWebGpu({
  renderField,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = buildSphRenderMarchingCubeCellsWebGpu,
  isolationScale = 1,
  parityTolerance = 1e-6,
  readbackMode = FULL_READBACK_MODE,
  ...runnerArgs
} = {}) {
  const canBuildCpu = renderField?.fieldRows instanceof Float32Array && renderField.fieldRows.length > 0;
  const cpuReference = canBuildCpu ? deriveSphRenderMarchingCubeCellsCpu(renderField, { isolationScale }) : null;
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      marchingCubeCellReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      marchingCubeCellReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({
      ...runnerArgs,
      renderField,
      isolationScale,
      readbackMode,
      device: resolvedDeviceResult.device
    });
    assertMarchingCubeCellField(webgpu);
    if (cpuReference && webgpu.cellRows.length > 0) {
      const parityMaxAbsDiff = maxAbsDiff(cpuReference.cellRows, webgpu.cellRows);
      if (!(parityMaxAbsDiff <= parityTolerance)) {
        return {
          schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
          backend: 'cpu-reference',
          status: 'webgpu-parity-failed-cpu-reference',
          cpuReference,
          webgpu,
          result: cpuReference,
          webgpuStatus: { status: 'fallback-cpu', reason: 'marching-cube cell parity drift', parityMaxAbsDiff },
          marchingCubeCellReadback: false,
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        };
      }
      return {
        schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference,
        webgpu,
        result: webgpu,
        webgpuStatus: { status: 'webgpu-executed', parityMaxAbsDiff },
        marchingCubeCellReadback: true,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-resident-no-full-readback',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed-no-full-readback' },
      marchingCubeCellReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      marchingCubeCellReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
}

function summarizeSurfaceVertexRows(renderField, vertexRows, isolationScale = 1) {
  const metadata = renderField.surfaceTable?.metadata || [];
  const triangleSets = metadata.map(() => new Set());
  const vertexCounts = new Array(metadata.length).fill(0);
  const rowCount = vertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
    if (!(vertexRows[offset + 15] > 0)) continue;
    const surfaceIndex = Math.round(vertexRows[offset]);
    if (surfaceIndex >= 0 && surfaceIndex < metadata.length) {
      vertexCounts[surfaceIndex] += 1;
      triangleSets[surfaceIndex].add(Math.round(vertexRows[offset + 3]));
    }
  }
  return metadata.map((surface) => {
    const vertexCount = vertexCounts[surface.index] || 0;
    const triangleCount = triangleSets[surface.index]?.size || 0;
    const renderPolicy = renderPolicyFieldsForSurface(surface);
    return {
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      renderLayer: surface.renderLayer ?? renderPolicy.renderLayer,
      renderOrder: renderPolicy.renderOrder,
      transparencyClassId: renderPolicy.transparencyClassId,
      depthWriteFlag: renderPolicy.depthWriteFlag,
      materialId: surface.materialId,
      phaseId: surface.phaseId,
      opticalStateKey: surface.opticalStateKey || 'default',
      opticalStateId: surface.opticalStateId || 0,
      resolution: surface.resolution,
      isolation: surface.isolation * finiteNumber(isolationScale, 1),
      voxelResolution: Math.max(0, surface.resolution - 1),
      voxelCount: marchingCubeVoxelCount(surface.resolution),
      fieldOffset: surface.fieldOffset,
      fieldCellCount: surface.fieldCellCount,
      activeCellCount: null,
      triangleOffset: null,
      triangleCount,
      vertexOffset: null,
      vertexCount,
      status: triangleCount > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty'
    };
  });
}

function compactSurfaceVertexSlotRows(slotRows) {
  if (!(slotRows instanceof Float32Array) || slotRows.length === 0) return new Float32Array();
  const rows = [];
  for (let offset = 0; offset < slotRows.length; offset += SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS) {
    if (slotRows[offset + 15] > 0) {
      const row = Array.from(slotRows.slice(offset, offset + SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS));
      const compactVertexIndex = rows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
      row[3] = Math.floor(compactVertexIndex / 3);
      row[4] = compactVertexIndex % 3;
      rows.push(...row);
    }
  }
  return Float32Array.from(rows);
}

export async function buildSphRenderSurfaceVerticesWebGpu({
  device,
  renderField,
  fieldRowsBuffer = null,
  surfaceBuffer = null,
  isolationScale = 1,
  readbackMode = FULL_READBACK_MODE,
  retainVertexRowsBuffer = false,
  maxVertexRows = null,
  surfaceVertexEmissionMode = null,
  compactByteBudget = SPH_SURFACE_VERTEX_COMPACT_BYTE_BUDGET_DEFAULT,
  onProgress = null,
  waitForQueueCompletion = true,
  deferCleanup = true,
  useQueueFenceForCleanup = true
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphRenderSurfaceVerticesWebGpu requires a WebGPU-like device');
  }
  if (renderField?.schema !== ULG_SPH_GPU_RENDER_FIELD_SCHEMA) {
    throw new TypeError('buildSphRenderSurfaceVerticesWebGpu requires an SPH render field');
  }
  if (!fieldRowsBuffer && !(renderField.fieldRows instanceof Float32Array)) {
    throw new TypeError('buildSphRenderSurfaceVerticesWebGpu requires fieldRows or fieldRowsBuffer');
  }
  if (!surfaceBuffer && !(renderField.surfaceTable?.records instanceof Float32Array)) {
    throw new TypeError('buildSphRenderSurfaceVerticesWebGpu requires surface table records or surfaceBuffer');
  }
  const surfaceCount = renderField.surfaceTable?.surfaceCount ?? renderField.surfaceCount ?? 0;
  const totalFieldCells = renderField.totalFieldCells ?? 0;
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const emissionMode = normalizeSurfaceVertexEmissionMode(surfaceVertexEmissionMode, { noFullReadback });
  const emissionModeId = surfaceVertexEmissionModeId(emissionMode);
  const requiredVertexRows = totalFieldCells * MARCHING_CUBE_MAX_VERTICES_PER_CELL;
  const resolvedMaxVertexRows = resolveSurfaceVertexRowBudget({
    requiredVertexRows,
    requestedMaxVertexRows: maxVertexRows,
    emissionMode,
    compactByteBudget
  });
  const fixedSlotVertexRowsByteLength = resolvedMaxVertexRows
    * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const surfaceVertexBudgetCapped = Boolean(emissionMode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
    && resolvedMaxVertexRows < requiredVertexRows);
  const retainVertexCounterBuffer = Boolean(
    noFullReadback
    && retainVertexRowsBuffer
    && emissionMode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
  );
  const markProgress = typeof onProgress === 'function'
    ? (status, extra = {}) => {
      try {
        onProgress({
          status,
          stage: 'surface-vertices',
          surfaceCount,
          totalFieldCells,
          maxFieldCellCount: renderField.maxFieldCellCount ?? null,
          requiredVertexRows,
          maxVertexRows: resolvedMaxVertexRows,
          fixedSlotVertexRowsByteLength,
          surfaceVertexEmissionMode: emissionMode,
          surfaceVertexBudgetCapped,
          compactByteBudget,
          readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
          ...extra
        });
      } catch {
        // Progress hooks are diagnostic-only and must not affect GPU execution.
      }
    }
    : () => {};
  markProgress('surface-vertices-kernel-started');
  const borrowedFieldRowsBuffer = fieldRowsBuffer || null;
  const borrowedSurfaceBuffer = surfaceBuffer || null;
  markProgress('surface-vertices-source-buffers-started');
  const sourceFieldRowsBuffer = borrowedFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-surface-vertices-source-render-field',
    renderField.fieldRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceSurfaceBuffer = borrowedSurfaceBuffer || writeStorageBuffer(
    device,
    'ulg-sph-surface-vertices-render-surfaces',
    renderField.surfaceTable.records
  );
  markProgress('surface-vertices-source-buffers-ready', {
    borrowedFieldRowsBuffer: Boolean(borrowedFieldRowsBuffer),
    borrowedSurfaceBuffer: Boolean(borrowedSurfaceBuffer)
  });
  markProgress('surface-vertices-output-buffer-create-started');
  const vertexRowsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-vertices',
    size: Math.max(4, fixedSlotVertexRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  markProgress('surface-vertices-output-buffer-create-complete');
  if (fixedSlotVertexRowsByteLength > 0) {
    markProgress('surface-vertices-output-buffer-zero-started');
    device.queue.writeBuffer(vertexRowsBuffer, 0, new Float32Array(resolvedMaxVertexRows * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS));
    markProgress('surface-vertices-output-buffer-zero-complete');
  }
  markProgress('surface-vertices-params-buffer-started');
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-vertex-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createSurfaceVerticesParamsArray({
    surfaceCount,
    totalFieldCells,
    maxVertexRows: resolvedMaxVertexRows,
    emissionModeId,
    fieldPadding: finiteNumber(renderField.fieldPadding, 0.22),
    refEdgeM: finiteNumber(renderField.refEdgeM, 10),
    isolationScale: finiteNumber(isolationScale, 1)
  }));
  markProgress('surface-vertices-params-buffer-complete');
  markProgress('surface-vertices-counter-buffer-started');
  const counterBuffer = device.createBuffer({
    label: 'ulg-sph-surface-vertex-counter',
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(counterBuffer, 0, new Uint32Array(4));
  markProgress('surface-vertices-counter-buffer-complete');

  markProgress('surface-vertices-shader-module-started');
  const module = device.createShaderModule({ label: 'ulg-sph-surface-vertices', code: sphRenderSurfaceVerticesWgsl });
  markProgress('surface-vertices-shader-module-complete');
  markProgress('surface-vertices-pipeline-started');
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-surface-vertices',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'storage')
    ]
  });
  markProgress('surface-vertices-pipeline-complete');
  markProgress('surface-vertices-bind-group-started');
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceSurfaceBuffer } },
      { binding: 1, resource: { buffer: sourceFieldRowsBuffer } },
      { binding: 2, resource: { buffer: vertexRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
      { binding: 4, resource: { buffer: counterBuffer } }
    ]
  });
  markProgress('surface-vertices-bind-group-complete');
  markProgress('surface-vertices-command-encode-started');
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(Math.max(1, renderField.maxFieldCellCount || 0) / 64),
    Math.max(1, surfaceCount)
  );
  pass.end();
  markProgress('surface-vertices-command-encode-complete', {
    workgroupCountX: Math.ceil(Math.max(1, renderField.maxFieldCellCount || 0) / 64),
    workgroupCountY: Math.max(1, surfaceCount)
  });

  let vertexRows = new Float32Array();
  let vertexCount = null;
  let triangleCount = null;
  let overflowCount = 0;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let deferNoFullCleanup = false;
  let surfaceVertexDeferredCleanup = false;
  if (!noFullReadback) {
    markProgress('surface-vertices-queue-submit-started');
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    markProgress('surface-vertices-queue-submit-complete', { queueCompletionStatus, queueCompletionMethod });
    if (resolvedMaxVertexRows > 0) {
      markProgress('surface-vertices-full-readback-started');
      const vertexBytes = await readBuffer(
        device,
        vertexRowsBuffer,
        fixedSlotVertexRowsByteLength,
        'ulg-sph-surface-vertex-readback'
      );
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      vertexRows = compactSurfaceVertexSlotRows(new Float32Array(vertexBytes));
      vertexCount = vertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
      triangleCount = vertexCount / 3;
      markProgress('surface-vertices-full-readback-complete', {
        queueCompletionStatus,
        queueCompletionMethod,
        vertexCount,
        triangleCount
      });
    } else {
      queueCompletionStatus = 'readback-skipped-empty-buffer';
      queueCompletionMethod = 'queue.submit';
      markProgress('surface-vertices-full-readback-skipped', { queueCompletionStatus, queueCompletionMethod });
    }
  } else {
    if (waitForQueueCompletion && device.queue?.onSubmittedWorkDone) {
      markProgress('surface-vertices-queue-submit-started');
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
      markProgress('surface-vertices-queue-submit-complete', { queueCompletionStatus, queueCompletionMethod });
      markProgress('surface-vertices-queue-work-wait-started');
      await device.queue.onSubmittedWorkDone();
      queueCompletionStatus = 'queue-work-completed';
      queueCompletionMethod = 'queue.onSubmittedWorkDone';
      markProgress('surface-vertices-queue-work-wait-complete', { queueCompletionStatus, queueCompletionMethod });
    } else {
      markProgress('surface-vertices-queue-submit-started');
      device.queue.submit([encoder.finish()]);
      const canFenceCleanup = Boolean(device.queue?.onSubmittedWorkDone && deferCleanup && useQueueFenceForCleanup);
      queueCompletionStatus = canFenceCleanup
        ? 'queue-submitted-cleanup-deferred'
        : (device.queue?.onSubmittedWorkDone
          ? 'queue-submitted-gpu-handoff-no-cpu-fence'
          : 'queue-submitted-no-explicit-completion');
      queueCompletionMethod = canFenceCleanup
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : (device.queue?.onSubmittedWorkDone
          ? 'queue.submit(in-order-gpu-surface-vertex-handoff)'
          : 'queue.submit');
      deferNoFullCleanup = canFenceCleanup;
      surfaceVertexDeferredCleanup = Boolean(device.queue?.onSubmittedWorkDone && deferCleanup && !useQueueFenceForCleanup);
      markProgress('surface-vertices-queue-submit-complete', { queueCompletionStatus, queueCompletionMethod });
    }
  }

  let cleanupDone = false;
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    if (!borrowedFieldRowsBuffer) sourceFieldRowsBuffer.destroy?.();
    if (!borrowedSurfaceBuffer) sourceSurfaceBuffer.destroy?.();
    if (!retainVertexRowsBuffer) vertexRowsBuffer.destroy?.();
    paramsBuffer.destroy?.();
    if (!retainVertexCounterBuffer) counterBuffer.destroy?.();
  };
  if (deferNoFullCleanup) {
    markProgress('surface-vertices-cleanup-deferred', { queueCompletionStatus, queueCompletionMethod });
    deferSubmittedWorkCleanup(device, () => {
      cleanup();
      markProgress('surface-vertices-deferred-cleanup-complete', { queueCompletionStatus, queueCompletionMethod });
    });
  } else if (surfaceVertexDeferredCleanup) {
    markProgress('surface-vertices-cleanup-deferred-no-queue-fence', {
      queueCompletionStatus,
      queueCompletionMethod,
      reason: 'retained resident handoff owns cleanup through buffer lease release'
    });
  } else if (noFullReadback && !waitForQueueCompletion && device.queue?.onSubmittedWorkDone && !deferCleanup) {
    markProgress('surface-vertices-cleanup-retained-for-resident-handoff', {
      queueCompletionStatus,
      queueCompletionMethod,
      reason: 'caller disabled queue-fence cleanup because a same-queue consumer/readback owns the synchronization boundary'
    });
  } else {
    markProgress('surface-vertices-cleanup-started');
    cleanup();
    markProgress('surface-vertices-cleanup-complete');
  }

  const surfaceVertexLeaseLedger = createResidentBufferLeaseLedger({
    ledgerId: `sph-surface-vertices:${surfaceCount}:${resolvedMaxVertexRows}:buffer-leases`,
    stateKey: 'sph-surface-vertices',
    scope: 'sph-surface-vertex-buffer-leases'
  });
  const surfaceVertexLeaseIds = [];
  const vertexRowsResourceKey = `surface-vertices:vertex-rows:${resolvedMaxVertexRows}:${fixedSlotVertexRowsByteLength}`;
  const vertexCounterBufferByteLength = 16;
  const vertexCounterResourceKey = `surface-vertices:vertex-counter:${resolvedMaxVertexRows}:${vertexCounterBufferByteLength}`;
  if (retainVertexRowsBuffer) {
    registerResidentBufferResource(surfaceVertexLeaseLedger, {
      resourceKey: vertexRowsResourceKey,
      resourceKind: 'surface-vertex-rows-buffer',
      stateFamily: 'render-surface-vertices',
      ownerStage: 'surface-vertex-builder',
      producerStage: 'surface-vertex-builder',
      source: 'buildSphRenderSurfaceVerticesWebGpu',
      status: 'resident-surface-vertex-buffer-retained',
      retained: true,
      byteLength: fixedSlotVertexRowsByteLength,
      rowCount: resolvedMaxVertexRows,
      bufferLabel: vertexRowsBuffer?.label,
      emissionMode,
      expectedConsumers: ['surface-draw-metadata']
    });
    const lease = addResidentBufferLease(surfaceVertexLeaseLedger, {
      resourceKey: vertexRowsResourceKey,
      consumerStage: 'surface-draw-metadata',
      reason: 'retained-surface-vertex-buffer'
    });
    surfaceVertexLeaseIds.push(lease.leaseId);
  }
  if (retainVertexCounterBuffer) {
    registerResidentBufferResource(surfaceVertexLeaseLedger, {
      resourceKey: vertexCounterResourceKey,
      resourceKind: 'surface-vertex-counter-buffer',
      stateFamily: 'render-surface-vertices',
      ownerStage: 'surface-vertex-builder',
      producerStage: 'surface-vertex-builder',
      source: 'buildSphRenderSurfaceVerticesWebGpu',
      status: 'resident-surface-vertex-counter-retained',
      retained: true,
      byteLength: vertexCounterBufferByteLength,
      rowCount: 1,
      bufferLabel: counterBuffer?.label,
      emissionMode,
      expectedConsumers: ['surface-draw-metadata']
    });
    const counterLease = addResidentBufferLease(surfaceVertexLeaseLedger, {
      resourceKey: vertexCounterResourceKey,
      consumerStage: 'surface-draw-metadata',
      reason: 'retained-surface-vertex-counter'
    });
    surfaceVertexLeaseIds.push(counterLease.leaseId);
  }

  const surfaces = vertexRows.length
    ? summarizeSurfaceVertexRows(renderField, vertexRows, isolationScale)
    : (renderField.surfaceTable?.metadata || []).map((surface) => {
      const renderPolicy = renderPolicyFieldsForSurface(surface);
      return {
        surfaceKey: surface.surfaceKey,
        material: surface.material,
        phase: surface.phase,
        renderKey: surface.renderKey,
        renderLayer: surface.renderLayer ?? renderPolicy.renderLayer,
        renderOrder: renderPolicy.renderOrder,
        transparencyClassId: renderPolicy.transparencyClassId,
        depthWriteFlag: renderPolicy.depthWriteFlag,
        materialId: surface.materialId,
        phaseId: surface.phaseId,
        opticalStateKey: surface.opticalStateKey || 'default',
        opticalStateId: surface.opticalStateId || 0,
        resolution: surface.resolution,
        isolation: surface.isolation * finiteNumber(isolationScale, 1),
        voxelResolution: Math.max(0, surface.resolution - 1),
        voxelCount: marchingCubeVoxelCount(surface.resolution),
        fieldOffset: surface.fieldOffset,
        fieldCellCount: surface.fieldCellCount,
        activeCellCount: null,
        triangleOffset: null,
        triangleCount: null,
        vertexOffset: null,
        vertexCount: null,
        status: 'surface-vertex-summary-not-read'
      };
    });
  const result = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
    backend: 'webgpu',
    status: noFullReadback
      ? (emissionMode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
        ? 'surface-vertices-resident-atomic-compact'
        : 'surface-vertices-resident-fixed-slots')
      : ((triangleCount || 0) > 0 ? 'surface-vertices-ready' : 'surface-vertices-empty'),
    sourceRenderFieldSchema: renderField.schema,
    sourceRenderFieldBackend: renderField.backend,
    surfaceExtractionMethod: 'tetrahedralized-render-field-cubes',
    compactionMode: noFullReadback
      ? (emissionMode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
        ? 'webgpu-atomic-compact'
        : 'webgpu-fixed-cell-slots')
      : 'webgpu-fixed-cell-slots-debug-compacted',
    surfaceVertexEmissionMode: emissionMode,
    surfaceVertexEmissionModeId: emissionModeId,
    surfaceVertexBudgetCapped,
    surfaceVertexCompactByteBudget: emissionMode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
      ? Math.max(0, Math.round(finiteNumber(compactByteBudget, SPH_SURFACE_VERTEX_COMPACT_BYTE_BUDGET_DEFAULT)))
      : null,
    requiredVertexRows,
    surfaceCount,
    totalFieldCells,
    activeCellCount: null,
    triangleCount,
    vertexCount,
    overflowCount: noFullReadback && emissionMode === SURFACE_VERTEX_EMISSION_ATOMIC_COMPACT
      ? null
      : overflowCount,
    maxTrianglesPerCell: MARCHING_CUBE_MAX_TRIANGLES_PER_CELL,
    maxVerticesPerCell: MARCHING_CUBE_MAX_VERTICES_PER_CELL,
    maxVertexRows: resolvedMaxVertexRows,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_VERTEX_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
    vertexRows,
    vertexRowsByteLength: vertexRows.byteLength,
    fixedSlotVertexRowsByteLength,
    fixedSlotVertexRowCount: resolvedMaxVertexRows,
    vertexRowsBufferByteLength: retainVertexRowsBuffer ? fixedSlotVertexRowsByteLength : 0,
    vertexRowsBufferRowCount: retainVertexRowsBuffer ? resolvedMaxVertexRows : 0,
    vertexRowsBufferRetained: Boolean(retainVertexRowsBuffer),
    vertexCounterBufferByteLength: retainVertexCounterBuffer ? vertexCounterBufferByteLength : 0,
    vertexCounterBufferRetained: retainVertexCounterBuffer,
    counterBufferRetained: retainVertexCounterBuffer,
    counterReadback: false,
    fieldRowsBufferBound: Boolean(borrowedFieldRowsBuffer),
    surfaceBufferBound: Boolean(borrowedSurfaceBuffer),
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    surfaceVertexDeferredCleanup,
    surfaceVertexReadback: !noFullReadback,
    renderFieldReadback: Boolean(renderField.renderFieldReadback),
    surfaces,
    residentBufferLeaseLedger: surfaceVertexLeaseLedger,
    residentBufferLeaseSummary: summarizeResidentBufferLeaseLedger(surfaceVertexLeaseLedger),
    residentBufferLeaseLedgerStatus: surfaceVertexLeaseLedger.status,
    residentBufferLeaseResourceCount: surfaceVertexLeaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: surfaceVertexLeaseLedger.activeLeaseCount,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  if (retainVertexRowsBuffer) {
    result.vertexRowsBuffer = vertexRowsBuffer;
    if (retainVertexCounterBuffer) result.vertexCounterBuffer = counterBuffer;
    let surfaceVertexBufferDestroyed = false;
    let surfaceVertexCounterBufferDestroyed = false;
    const refreshSurfaceVertexLeaseSummary = () => {
      result.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(surfaceVertexLeaseLedger);
      result.residentBufferLeaseLedgerStatus = result.residentBufferLeaseSummary.status;
      result.residentBufferLeaseResourceCount = result.residentBufferLeaseSummary.resourceCount;
      result.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseSummary.activeLeaseCount;
      return result.residentBufferLeaseSummary;
    };
    result.releaseSurfaceVertexBufferLeases = ({ status = 'released' } = {}) => {
      for (const leaseId of surfaceVertexLeaseIds) {
        releaseResidentBufferLease(surfaceVertexLeaseLedger, leaseId, { status });
      }
      return refreshSurfaceVertexLeaseSummary();
    };
    result.destroySurfaceVertexBuffers = ({
      force = false,
      releaseLeases = false,
      reason = 'surface-vertex-buffer-cleanup'
    } = {}) => {
      cleanup();
      if (releaseLeases) result.releaseSurfaceVertexBufferLeases();
      destroyResidentBufferWithLease(surfaceVertexLeaseLedger, vertexRowsResourceKey, () => {
        if (surfaceVertexBufferDestroyed) return;
        surfaceVertexBufferDestroyed = true;
        vertexRowsBuffer.destroy?.();
      }, { force, reason });
      if (retainVertexCounterBuffer) {
        destroyResidentBufferWithLease(surfaceVertexLeaseLedger, vertexCounterResourceKey, () => {
          if (surfaceVertexCounterBufferDestroyed) return;
          surfaceVertexCounterBufferDestroyed = true;
          counterBuffer.destroy?.();
        }, { force, reason });
      }
      return refreshSurfaceVertexLeaseSummary();
    };
  }
  return result;
}

export async function deriveSphRenderSurfaceVerticesWithOptionalWebGpu({
  renderField,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = buildSphRenderSurfaceVerticesWebGpu,
  isolationScale = 1,
  parityTolerance = 1e-5,
  readbackMode = FULL_READBACK_MODE,
  ...runnerArgs
} = {}) {
  const canBuildCpu = renderField?.fieldRows instanceof Float32Array && renderField.fieldRows.length > 0;
  const cpuReference = canBuildCpu ? deriveSphRenderSurfaceVerticesCpu(renderField, { isolationScale }) : null;
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      surfaceVertexReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      surfaceVertexReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({
      ...runnerArgs,
      renderField,
      isolationScale,
      readbackMode,
      device: resolvedDeviceResult.device
    });
    assertSurfaceVertexField(webgpu);
    if (cpuReference && webgpu.vertexRows.length > 0) {
      const parityMaxAbsDiff = maxAbsDiff(cpuReference.vertexRows, webgpu.vertexRows);
      if (!(parityMaxAbsDiff <= parityTolerance)) {
        return {
          schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
          backend: 'cpu-reference',
          status: 'webgpu-parity-failed-cpu-reference',
          cpuReference,
          webgpu,
          result: cpuReference,
          webgpuStatus: { status: 'fallback-cpu', reason: 'surface vertex parity drift', parityMaxAbsDiff },
          surfaceVertexReadback: false,
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        };
      }
      return {
        schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference,
        webgpu,
        result: webgpu,
        webgpuStatus: { status: 'webgpu-executed', parityMaxAbsDiff },
        surfaceVertexReadback: true,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-resident-no-full-readback',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed-no-full-readback' },
      surfaceVertexReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      surfaceVertexReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
}

export async function buildSphRenderSurfaceDrawMetadataWebGpu({
  device,
  surfaceVertices,
  surfaceBuffer = null,
  readbackMode = FULL_READBACK_MODE,
  compactSummaryReadback = false,
  retainDrawRowsBuffer = false,
  retainCompactedVertexRowsBuffer = false,
  retainDrawIndirectRowsBuffer = false,
  waitForQueueCompletion = true,
  onProgress = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphRenderSurfaceDrawMetadataWebGpu requires a WebGPU-like device');
  }
  if (surfaceVertices?.schema !== ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA) {
    throw new TypeError('buildSphRenderSurfaceDrawMetadataWebGpu requires an SPH surface vertex field');
  }
  const hasBorrowedVertexBuffer = Boolean(surfaceVertices.vertexRowsBuffer);
  const hasVertexRows = surfaceVertices.vertexRows instanceof Float32Array && surfaceVertices.vertexRows.length > 0;
  if (!hasBorrowedVertexBuffer && !hasVertexRows) {
    throw new TypeError('buildSphRenderSurfaceDrawMetadataWebGpu requires vertexRows or a retained vertexRowsBuffer');
  }
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const hasBorrowedVertexCounterBuffer = Boolean(surfaceVertices.vertexCounterBuffer);
  const sourceVertexCounterMode = hasBorrowedVertexCounterBuffer ? 1 : 0;
  const sourceVertexCounterModeName = hasBorrowedVertexCounterBuffer
    ? 'resident-vertex-counter'
    : 'uniform-upper-bound';
  const sourceVertexRowCount = Math.max(0, Math.round(finiteNumber(
    hasBorrowedVertexBuffer
      ? (surfaceVertices.vertexRowsBufferRowCount || surfaceVertices.maxVertexRows || (
          surfaceVertices.vertexRowsBufferByteLength
            ? surfaceVertices.vertexRowsBufferByteLength / (SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT)
            : 0
        ))
      : (surfaceVertices.vertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS),
    0
  )));
  const surfaceCount = Math.max(
    0,
    Math.round(finiteNumber(surfaceVertices.surfaceCount, surfaceVertices.surfaces?.length || 0))
  );
  const compactedVertexRowsByteLength = sourceVertexRowCount
    * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const drawRowsByteLength = surfaceCount
    * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const drawIndirectRowsByteLength = surfaceCount
    * SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS
    * Uint32Array.BYTES_PER_ELEMENT;
  const drawAggregateIndirectRowsByteLength = SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS
    * Uint32Array.BYTES_PER_ELEMENT;
  const markProgress = typeof onProgress === 'function'
    ? (status, extra = {}) => {
      try {
        onProgress({
          status,
          stage: 'surface-draw-metadata',
          surfaceCount,
          sourceVertexRowCount,
          compactedVertexRowsByteLength,
          drawRowsByteLength,
          drawIndirectRowsByteLength,
          drawAggregateIndirectRowsByteLength,
          sourceVertexCounterMode: sourceVertexCounterModeName,
          sourceVertexCounterBufferBound: hasBorrowedVertexCounterBuffer,
          readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
          compactSummaryReadback: Boolean(compactSummaryReadback),
          ...extra
        });
      } catch {
        // Progress hooks are diagnostic-only and must not affect GPU execution.
      }
    }
    : () => {};
  markProgress('surface-draw-metadata-kernel-started');
  const borrowedSurfaceBuffer = surfaceBuffer || null;
  markProgress('surface-draw-metadata-source-buffers-started', {
    hasBorrowedVertexBuffer,
    borrowedSurfaceBuffer: Boolean(borrowedSurfaceBuffer)
  });
  const sourceVertexRowsBuffer = hasBorrowedVertexBuffer
    ? surfaceVertices.vertexRowsBuffer
    : writeStorageBuffer(
        device,
        'ulg-sph-surface-draw-source-vertices',
        surfaceVertices.vertexRows,
        GPU_BUFFER_USAGE.COPY_SRC
      );
  const sourceSurfaceBuffer = borrowedSurfaceBuffer || writeStorageBuffer(
    device,
    'ulg-sph-surface-draw-surfaces',
    surfaceRecordsFromSurfaceVertexMetadata(surfaceVertices)
  );
  const sourceVertexCounterBuffer = hasBorrowedVertexCounterBuffer
    ? surfaceVertices.vertexCounterBuffer
    : device.createBuffer({
        label: 'ulg-sph-surface-draw-source-vertex-counter',
        size: 16,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      });
  if (!hasBorrowedVertexCounterBuffer) {
    device.queue.writeBuffer(sourceVertexCounterBuffer, 0, new Uint32Array([sourceVertexRowCount, 0, 0, 0]));
  }
  markProgress('surface-draw-metadata-source-buffers-ready', {
    hasBorrowedVertexBuffer,
    borrowedSurfaceBuffer: Boolean(borrowedSurfaceBuffer),
    hasBorrowedVertexCounterBuffer
  });
  markProgress('surface-draw-metadata-output-buffers-started');
  const compactedVertexRowsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-draw-compacted-vertices',
    size: Math.max(4, compactedVertexRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE
      | GPU_BUFFER_USAGE.VERTEX
      | GPU_BUFFER_USAGE.COPY_SRC
      | GPU_BUFFER_USAGE.COPY_DST
  });
  if (compactedVertexRowsByteLength > 0) {
    device.queue.writeBuffer(
      compactedVertexRowsBuffer,
      0,
      new Float32Array(sourceVertexRowCount * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS)
    );
  }
  const drawRowsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-draw-metadata',
    size: Math.max(4, drawRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  if (drawRowsByteLength > 0) {
    device.queue.writeBuffer(drawRowsBuffer, 0, new Float32Array(surfaceCount * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS));
  }
  const drawIndirectRowsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-draw-indirect',
    size: Math.max(4, drawIndirectRowsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  if (drawIndirectRowsByteLength > 0) {
    device.queue.writeBuffer(
      drawIndirectRowsBuffer,
      0,
      new Uint32Array(surfaceCount * SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS)
    );
  }
  const drawAggregateIndirectRowsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-draw-aggregate-indirect',
    size: drawAggregateIndirectRowsByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.INDIRECT | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(
    drawAggregateIndirectRowsBuffer,
    0,
    new Uint32Array(SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS)
  );
  markProgress('surface-draw-metadata-output-buffers-complete');
  markProgress('surface-draw-metadata-params-buffer-started');
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-surface-draw-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createSurfaceDrawParamsArray({
    surfaceCount,
    sourceVertexRowCount,
    maxCompactVertexRows: sourceVertexRowCount,
    sourceVertexCounterMode
  }));
  markProgress('surface-draw-metadata-params-buffer-complete');

  markProgress('surface-draw-metadata-shader-module-started');
  const module = device.createShaderModule({ label: 'ulg-sph-surface-draw', code: sphRenderSurfaceDrawWgsl });
  markProgress('surface-draw-metadata-shader-module-complete');
  markProgress('surface-draw-metadata-pipeline-started');
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-surface-draw',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'storage'),
      computeBufferBinding(4, 'uniform'),
      computeBufferBinding(5, 'storage'),
      computeBufferBinding(6, 'read-only-storage'),
      computeBufferBinding(7, 'storage')
    ]
  });
  markProgress('surface-draw-metadata-pipeline-complete');
  markProgress('surface-draw-metadata-bind-group-started');
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceSurfaceBuffer } },
      { binding: 1, resource: { buffer: sourceVertexRowsBuffer } },
      { binding: 2, resource: { buffer: compactedVertexRowsBuffer } },
      { binding: 3, resource: { buffer: drawRowsBuffer } },
      { binding: 4, resource: { buffer: paramsBuffer } },
      { binding: 5, resource: { buffer: drawIndirectRowsBuffer } },
      { binding: 6, resource: { buffer: sourceVertexCounterBuffer } },
      { binding: 7, resource: { buffer: drawAggregateIndirectRowsBuffer } }
    ]
  });
  markProgress('surface-draw-metadata-bind-group-complete');
  markProgress('surface-draw-metadata-command-encode-started');
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.max(1, surfaceCount));
  pass.end();
  markProgress('surface-draw-metadata-command-encode-complete', {
    workgroupCountX: Math.max(1, surfaceCount)
  });

  let drawRows = new Float32Array();
  let drawIndirectRows = new Uint32Array();
  let compactedVertexRows = new Float32Array();
  let activeSurfaceCount = null;
  let vertexCount = null;
  let triangleCount = null;
  let surfaces;
  let summaryReadback = false;
  let summaryReadbackByteLength = 0;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let deferNoFullCleanup = false;
  let gpuOnlyDrawRangeVertexCount = null;
  let gpuOnlyDrawRangeTriangleCount = null;
  let gpuOnlyDrawRangeStatus = null;
  let gpuOnlyDrawRangeReason = null;
  if (!noFullReadback) {
    markProgress('surface-draw-metadata-queue-submit-started');
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    markProgress('surface-draw-metadata-queue-submit-complete', { queueCompletionStatus, queueCompletionMethod });
    if (drawRowsByteLength > 0) {
      markProgress('surface-draw-metadata-full-readback-started');
      const drawBytes = await readBuffer(
        device,
        drawRowsBuffer,
        drawRowsByteLength,
        'ulg-sph-surface-draw-readback'
      );
      queueCompletionStatus = 'readback-map-completed';
      queueCompletionMethod = 'mapAsync(readback-buffer)';
      drawRows = new Float32Array(drawBytes);
      const summary = summarizeSurfaceDrawRows(drawRows, surfaceVertices.surfaces || []);
      surfaces = summary.surfaces;
      activeSurfaceCount = summary.activeSurfaceCount;
      vertexCount = summary.vertexCount;
      triangleCount = summary.triangleCount;
      if (vertexCount > 0) {
        const compactedBytes = await readBuffer(
          device,
          compactedVertexRowsBuffer,
          vertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT,
          'ulg-sph-surface-draw-compacted-vertex-readback'
        );
        compactedVertexRows = new Float32Array(compactedBytes);
      }
      if (drawIndirectRowsByteLength > 0) {
        const indirectBytes = await readBuffer(
          device,
          drawIndirectRowsBuffer,
          drawIndirectRowsByteLength,
          'ulg-sph-surface-draw-indirect-readback'
        );
        drawIndirectRows = new Uint32Array(indirectBytes);
      }
      markProgress('surface-draw-metadata-full-readback-complete', {
        queueCompletionStatus,
        queueCompletionMethod,
        activeSurfaceCount,
        vertexCount,
        triangleCount
      });
    } else {
      surfaces = [];
      activeSurfaceCount = 0;
      vertexCount = 0;
      triangleCount = 0;
      drawIndirectRows = new Uint32Array();
      queueCompletionStatus = 'readback-skipped-empty-buffer';
      queueCompletionMethod = 'queue.submit';
      markProgress('surface-draw-metadata-full-readback-skipped', { queueCompletionStatus, queueCompletionMethod });
    }
  } else {
    if (waitForQueueCompletion && device.queue?.onSubmittedWorkDone) {
      markProgress('surface-draw-metadata-queue-submit-started');
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
      markProgress('surface-draw-metadata-queue-submit-complete', { queueCompletionStatus, queueCompletionMethod });
      markProgress('surface-draw-metadata-queue-work-wait-started');
      await device.queue.onSubmittedWorkDone();
      queueCompletionStatus = 'queue-work-completed';
      queueCompletionMethod = 'queue.onSubmittedWorkDone';
      markProgress('surface-draw-metadata-queue-work-wait-complete', { queueCompletionStatus, queueCompletionMethod });
    } else {
      markProgress('surface-draw-metadata-queue-submit-started');
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = device.queue?.onSubmittedWorkDone && !compactSummaryReadback
        ? 'queue-submitted-cleanup-deferred'
        : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone && !compactSummaryReadback
        ? 'deferred queue.onSubmittedWorkDone cleanup'
        : 'queue.submit';
      deferNoFullCleanup = Boolean(device.queue?.onSubmittedWorkDone && !compactSummaryReadback);
      markProgress('surface-draw-metadata-queue-submit-complete', { queueCompletionStatus, queueCompletionMethod });
    }
    surfaces = (surfaceVertices.surfaces || []).map((surface, index) => ({
      ...(() => {
        const renderPolicy = renderPolicyFieldsForSurface({ ...surface, surfaceIndex: index });
        return {
          surfaceKey: surface.surfaceKey,
          material: surface.material,
          phase: surface.phase,
          renderKey: surface.renderKey,
          renderLayer: surface.renderLayer ?? renderPolicy.renderLayer,
          surfaceIndex: index,
          materialId: surface.materialId,
          phaseId: surface.phaseId,
          opticalStateId: surface.opticalStateId || 0,
          vertexOffset: null,
          vertexCount: null,
          triangleOffset: null,
          triangleCount: null,
          renderOrder: renderPolicy.renderOrder,
          transparencyClassId: renderPolicy.transparencyClassId,
          depthWriteFlag: renderPolicy.depthWriteFlag,
          boundsCenterM: [0, 0, 0],
          boundsRadiusM: null,
          status: 'surface-draw-summary-not-read'
        };
      })()
    }));
    if (compactSummaryReadback && drawRowsByteLength > 0) {
      markProgress('surface-draw-metadata-compact-summary-readback-started');
      const drawBytes = await readBuffer(
        device,
        drawRowsBuffer,
        drawRowsByteLength,
        'ulg-sph-surface-draw-compact-summary-readback'
      );
      drawRows = new Float32Array(drawBytes);
      const summary = summarizeSurfaceDrawRows(drawRows, surfaceVertices.surfaces || []);
      surfaces = summary.surfaces;
      activeSurfaceCount = summary.activeSurfaceCount;
      vertexCount = summary.vertexCount;
      triangleCount = summary.triangleCount;
      summaryReadback = true;
      summaryReadbackByteLength = drawRowsByteLength;
      queueCompletionStatus = 'compact-summary-readback-map-completed';
      queueCompletionMethod = 'mapAsync(compact-summary-readback-buffer)';
      markProgress('surface-draw-metadata-compact-summary-readback-complete', {
        queueCompletionStatus,
        queueCompletionMethod,
        activeSurfaceCount,
        vertexCount,
        triangleCount
      });
    } else {
      summaryReadback = false;
      summaryReadbackByteLength = 0;
      gpuOnlyDrawRangeVertexCount = Math.max(0, sourceVertexRowCount - (sourceVertexRowCount % 3));
      gpuOnlyDrawRangeTriangleCount = Math.floor(gpuOnlyDrawRangeVertexCount / 3);
      gpuOnlyDrawRangeStatus = gpuOnlyDrawRangeVertexCount >= 3
        ? 'surface-draw-gpu-resident-draw-range-available'
        : 'surface-draw-gpu-resident-empty-draw-range';
      gpuOnlyDrawRangeReason = gpuOnlyDrawRangeVertexCount >= 3
        ? 'compact surface-draw summary was not read; retained GPU buffers expose a conservative upper-bound draw range for same-device consumers'
        : 'compact surface-draw summary was not read and retained GPU buffers do not contain a drawable triangle range';
      markProgress('surface-draw-metadata-gpu-only-draw-range-ready', {
        queueCompletionStatus,
        queueCompletionMethod,
        gpuOnlyDrawRangeStatus,
        gpuOnlyDrawRangeVertexCount,
        gpuOnlyDrawRangeTriangleCount
      });
    }
  }

  const cleanup = () => {
    if (!hasBorrowedVertexBuffer) sourceVertexRowsBuffer.destroy?.();
    if (!borrowedSurfaceBuffer) sourceSurfaceBuffer.destroy?.();
    if (!hasBorrowedVertexCounterBuffer) sourceVertexCounterBuffer.destroy?.();
    paramsBuffer.destroy?.();
  };
  const keepDrawRowsBuffer = retainDrawRowsBuffer || noFullReadback;
  const keepCompactedVertexRowsBuffer = retainCompactedVertexRowsBuffer || noFullReadback;
  const keepDrawIndirectRowsBuffer = retainDrawIndirectRowsBuffer || noFullReadback;
  const keepDrawAggregateIndirectRowsBuffer = noFullReadback;
  if (!keepDrawRowsBuffer) drawRowsBuffer.destroy?.();
  if (!keepCompactedVertexRowsBuffer) compactedVertexRowsBuffer.destroy?.();
  if (!keepDrawIndirectRowsBuffer) drawIndirectRowsBuffer.destroy?.();
  if (!keepDrawAggregateIndirectRowsBuffer) drawAggregateIndirectRowsBuffer.destroy?.();
  if (deferNoFullCleanup) {
    markProgress('surface-draw-metadata-cleanup-deferred', { queueCompletionStatus, queueCompletionMethod });
    deferSubmittedWorkCleanup(device, () => {
      cleanup();
      markProgress('surface-draw-metadata-deferred-cleanup-complete', { queueCompletionStatus, queueCompletionMethod });
    });
  } else {
    markProgress('surface-draw-metadata-cleanup-started');
    cleanup();
    markProgress('surface-draw-metadata-cleanup-complete');
  }
  const surfaceDrawLeaseLedger = createResidentBufferLeaseLedger({
    ledgerId: `sph-resident-surface-draw:${surfaceCount}:buffer-leases`,
    stateKey: 'sph-resident-surface-draw',
    scope: 'sph-resident-surface-draw-buffer-leases'
  });
  const surfaceDrawLeaseIds = [];
  const registerRetainedSurfaceDrawBuffer = ({
    resourceKey,
    resourceKind,
    buffer,
    byteLength,
    rowCount
  }) => {
    registerResidentBufferResource(surfaceDrawLeaseLedger, {
      resourceKey,
      resourceKind,
      stateFamily: 'render-surface',
      ownerStage: 'surface-draw-metadata',
      producerStage: 'surface-draw-metadata',
      source: 'buildSphRenderSurfaceDrawMetadataWebGpu',
      status: 'resident-surface-draw-buffer-retained',
      retained: true,
      byteLength,
      rowCount,
      bufferLabel: buffer?.label,
      expectedConsumers: ['resident-surface-draw-overlay', 'diagnostics']
    });
    const lease = addResidentBufferLease(surfaceDrawLeaseLedger, {
      resourceKey,
      consumerStage: 'resident-surface-draw-overlay',
      reason: 'retained-overlay-draw-buffer'
    });
    surfaceDrawLeaseIds.push(lease.leaseId);
  };
  if (keepDrawRowsBuffer) {
    registerRetainedSurfaceDrawBuffer({
      resourceKey: `surface-draw:draw-rows:${surfaceCount}:${drawRowsByteLength}`,
      resourceKind: 'surface-draw-rows-buffer',
      buffer: drawRowsBuffer,
      byteLength: drawRowsByteLength,
      rowCount: surfaceCount
    });
  }
  if (keepDrawIndirectRowsBuffer) {
    registerRetainedSurfaceDrawBuffer({
      resourceKey: `surface-draw:draw-indirect:${surfaceCount}:${drawIndirectRowsByteLength}`,
      resourceKind: 'surface-draw-indirect-buffer',
      buffer: drawIndirectRowsBuffer,
      byteLength: drawIndirectRowsByteLength,
      rowCount: surfaceCount
    });
  }
  if (keepDrawAggregateIndirectRowsBuffer) {
    registerRetainedSurfaceDrawBuffer({
      resourceKey: `surface-draw:draw-aggregate-indirect:1:${drawAggregateIndirectRowsByteLength}`,
      resourceKind: 'surface-draw-aggregate-indirect-buffer',
      buffer: drawAggregateIndirectRowsBuffer,
      byteLength: drawAggregateIndirectRowsByteLength,
      rowCount: 1
    });
  }
  if (keepCompactedVertexRowsBuffer) {
    registerRetainedSurfaceDrawBuffer({
      resourceKey: `surface-draw:compacted-vertices:${sourceVertexRowCount}:${compactedVertexRowsByteLength}`,
      resourceKind: 'surface-draw-compacted-vertices-buffer',
      buffer: compactedVertexRowsBuffer,
      byteLength: compactedVertexRowsByteLength,
      rowCount: sourceVertexRowCount
    });
  }

  const result = {
    schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
    backend: 'webgpu',
    status: noFullReadback ? 'surface-draw-resident' : ((activeSurfaceCount || 0) > 0 ? 'surface-draw-metadata-ready' : 'surface-draw-metadata-empty'),
    sourceSurfaceVertexSchema: surfaceVertices.schema,
    sourceSurfaceVertexBackend: surfaceVertices.backend,
    surfaceCount,
    activeSurfaceCount,
    vertexCount,
    triangleCount,
    rowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
    drawRows,
    drawRowsByteLength,
    drawRowsBufferByteLength: keepDrawRowsBuffer ? drawRowsByteLength : 0,
    drawRowsBufferRetained: keepDrawRowsBuffer,
    drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
    drawIndirectRowLayout: [...SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_ROW_LAYOUT],
    drawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
    drawIndirectRows,
    drawIndirectRowsByteLength,
    drawIndirectRowsBufferByteLength: keepDrawIndirectRowsBuffer ? drawIndirectRowsByteLength : 0,
    drawIndirectRowsBufferRetained: keepDrawIndirectRowsBuffer,
    drawAggregateIndirectRowsByteLength,
    drawAggregateIndirectRowsBufferByteLength: keepDrawAggregateIndirectRowsBuffer
      ? drawAggregateIndirectRowsByteLength
      : 0,
    drawAggregateIndirectRowsBufferRetained: keepDrawAggregateIndirectRowsBuffer,
    compactedVertexRows,
    compactedVertexRowsByteLength: compactedVertexRows.byteLength,
    compactedVertexRowsBufferByteLength: keepCompactedVertexRowsBuffer ? compactedVertexRowsByteLength : 0,
    compactedVertexRowsBufferRetained: keepCompactedVertexRowsBuffer,
    sourceVertexRowCount,
    sourceVertexRowsBufferBound: hasBorrowedVertexBuffer,
    sourceVertexCounterMode: sourceVertexCounterModeName,
    sourceVertexCounterBufferBound: hasBorrowedVertexCounterBuffer,
    sourceVertexCounterBufferByteLength: hasBorrowedVertexCounterBuffer
      ? Math.max(0, Math.round(finiteNumber(surfaceVertices.vertexCounterBufferByteLength, 16)))
      : 0,
    surfaceBufferBound: Boolean(borrowedSurfaceBuffer),
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    surfaceDrawReadback: !noFullReadback,
    surfaceDrawSummaryReadback: summaryReadback,
    surfaceDrawSummaryReadbackByteLength: summaryReadbackByteLength,
    surfaceDrawGpuOnlyHandoff: Boolean(noFullReadback && !summaryReadback),
    surfaceDrawGpuOnlyHandoffStatus: gpuOnlyDrawRangeStatus,
    surfaceDrawGpuOnlyHandoffReason: gpuOnlyDrawRangeReason,
    surfaceDrawGpuOnlyUpperBoundVertexCount: gpuOnlyDrawRangeVertexCount,
    surfaceDrawGpuOnlyUpperBoundTriangleCount: gpuOnlyDrawRangeTriangleCount,
    surfaceDrawGpuOnlyAggregateIndirectReady: Boolean(
      noFullReadback
      && !summaryReadback
      && keepDrawAggregateIndirectRowsBuffer
      && hasBorrowedVertexCounterBuffer
    ),
    surfaceDrawGpuOnlyAggregateDrawRangeExact: Boolean(
      noFullReadback
      && !summaryReadback
      && hasBorrowedVertexCounterBuffer
    ),
    surfaceDrawGpuOnlyDrawRangeConservative: Boolean(
      noFullReadback
      && !summaryReadback
      && (gpuOnlyDrawRangeVertexCount || 0) >= 3
    ),
    fullSurfaceDrawReadback: !noFullReadback,
    compactionMode: 'webgpu-surface-prefix-scan-compact',
    surfaces,
    residentBufferLeaseLedger: surfaceDrawLeaseLedger,
    residentBufferLeaseSummary: summarizeResidentBufferLeaseLedger(surfaceDrawLeaseLedger),
    residentBufferLeaseLedgerStatus: surfaceDrawLeaseLedger.status,
    residentBufferLeaseResourceCount: surfaceDrawLeaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: surfaceDrawLeaseLedger.activeLeaseCount,
    scientificValidation: false,
    sphValidation: false,
    surfaceExtractionValidation: false,
    fullPhysicsValidation: false
  };
  if (keepDrawRowsBuffer) result.drawRowsBuffer = drawRowsBuffer;
  if (keepDrawIndirectRowsBuffer) result.drawIndirectRowsBuffer = drawIndirectRowsBuffer;
  if (keepDrawAggregateIndirectRowsBuffer) result.drawAggregateIndirectRowsBuffer = drawAggregateIndirectRowsBuffer;
  if (keepCompactedVertexRowsBuffer) result.compactedVertexRowsBuffer = compactedVertexRowsBuffer;
  if (keepDrawRowsBuffer || keepCompactedVertexRowsBuffer || keepDrawIndirectRowsBuffer) {
    const destroyedSurfaceDrawResourceKeys = new Set();
    const refreshSurfaceDrawLeaseSummary = () => {
      result.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(surfaceDrawLeaseLedger);
      result.residentBufferLeaseLedgerStatus = result.residentBufferLeaseSummary.status;
      result.residentBufferLeaseResourceCount = result.residentBufferLeaseSummary.resourceCount;
      result.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseSummary.activeLeaseCount;
      return result.residentBufferLeaseSummary;
    };
    result.releaseSurfaceDrawBufferLeases = ({ status = 'released' } = {}) => {
      for (const leaseId of surfaceDrawLeaseIds) {
        releaseResidentBufferLease(surfaceDrawLeaseLedger, leaseId, { status });
      }
      return refreshSurfaceDrawLeaseSummary();
    };
    const destroySurfaceDrawBufferOnce = (resourceKey, buffer) => {
      if (destroyedSurfaceDrawResourceKeys.has(resourceKey)) return;
      destroyedSurfaceDrawResourceKeys.add(resourceKey);
      buffer?.destroy?.();
    };
    result.destroySurfaceDrawBuffers = ({
      force = false,
      releaseLeases = false,
      reason = 'surface-draw-buffer-cleanup'
    } = {}) => {
      if (releaseLeases) result.releaseSurfaceDrawBufferLeases();
      if (keepDrawRowsBuffer) {
        const resourceKey = `surface-draw:draw-rows:${surfaceCount}:${drawRowsByteLength}`;
        destroyResidentBufferWithLease(surfaceDrawLeaseLedger, resourceKey, () => {
          destroySurfaceDrawBufferOnce(resourceKey, drawRowsBuffer);
        }, { force, reason });
      }
      if (keepCompactedVertexRowsBuffer) {
        const resourceKey = `surface-draw:compacted-vertices:${sourceVertexRowCount}:${compactedVertexRowsByteLength}`;
        destroyResidentBufferWithLease(surfaceDrawLeaseLedger, resourceKey, () => {
          destroySurfaceDrawBufferOnce(resourceKey, compactedVertexRowsBuffer);
        }, { force, reason });
      }
      if (keepDrawIndirectRowsBuffer) {
        const resourceKey = `surface-draw:draw-indirect:${surfaceCount}:${drawIndirectRowsByteLength}`;
        destroyResidentBufferWithLease(surfaceDrawLeaseLedger, resourceKey, () => {
          destroySurfaceDrawBufferOnce(resourceKey, drawIndirectRowsBuffer);
        }, { force, reason });
      }
      if (keepDrawAggregateIndirectRowsBuffer) {
        const resourceKey = `surface-draw:draw-aggregate-indirect:1:${drawAggregateIndirectRowsByteLength}`;
        destroyResidentBufferWithLease(surfaceDrawLeaseLedger, resourceKey, () => {
          destroySurfaceDrawBufferOnce(resourceKey, drawAggregateIndirectRowsBuffer);
        }, { force, reason });
      }
      return refreshSurfaceDrawLeaseSummary();
    };
  }
  return result;
}

export async function deriveSphRenderSurfaceDrawMetadataWithOptionalWebGpu({
  surfaceVertices,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = buildSphRenderSurfaceDrawMetadataWebGpu,
  parityTolerance = 1e-6,
  readbackMode = FULL_READBACK_MODE,
  ...runnerArgs
} = {}) {
  const cpuReference = surfaceVertices?.vertexRows instanceof Float32Array
    ? deriveSphRenderSurfaceDrawMetadataCpu(surfaceVertices)
    : null;
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      surfaceDrawReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      surfaceDrawReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({
      ...runnerArgs,
      surfaceVertices,
      readbackMode,
      device: resolvedDeviceResult.device
    });
    assertSurfaceDrawMetadata(webgpu);
    const hasFullDrawRowsReadback = webgpu.drawRows.length > 0
      && webgpu.readbackMode !== NO_FULL_READBACK_MODE
      && webgpu.surfaceDrawReadback !== false;
    if (cpuReference && hasFullDrawRowsReadback) {
      const parityMaxAbsDiff = maxAbsDiff(cpuReference.drawRows, webgpu.drawRows);
      if (!(parityMaxAbsDiff <= parityTolerance)) {
        return {
          schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
          backend: 'cpu-reference',
          status: 'webgpu-parity-failed-cpu-reference',
          cpuReference,
          webgpu,
          result: cpuReference,
          webgpuStatus: { status: 'fallback-cpu', reason: 'surface draw metadata parity drift', parityMaxAbsDiff },
          surfaceDrawReadback: false,
          scientificValidation: false,
          sphValidation: false,
          surfaceExtractionValidation: false,
          fullPhysicsValidation: false
        };
      }
      return {
        schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference,
        webgpu,
        result: webgpu,
        webgpuStatus: { status: 'webgpu-executed', parityMaxAbsDiff },
        surfaceDrawReadback: true,
        scientificValidation: false,
        sphValidation: false,
        surfaceExtractionValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-resident-no-full-readback',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed-no-full-readback' },
      surfaceDrawReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      surfaceDrawReadback: false,
      scientificValidation: false,
      sphValidation: false,
      surfaceExtractionValidation: false,
      fullPhysicsValidation: false
    };
  }
}

function assertMaterialInterfaceCandidateField(candidateField) {
  if (
    candidateField?.schema !== ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_SCHEMA
    || !(candidateField.candidateRows instanceof Float32Array)
  ) {
    throw new TypeError('compactSphMaterialInterfaceCandidates requires a material-interface candidate field');
  }
  if (candidateField.candidateRows.length % SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS !== 0) {
    throw new RangeError('material-interface candidate rows must align to the candidate row stride');
  }
}

export function compactSphMaterialInterfaceCandidates(candidateField) {
  assertMaterialInterfaceCandidateField(candidateField);
  const candidateRows = candidateField.candidateRows;
  const interfaceSourceKeyRows = candidateField.interfaceSourceKeyRows instanceof Float32Array
    ? candidateField.interfaceSourceKeyRows
    : null;
  const surfaceAccumulators = (candidateField.surfaces || []).map((surface) => ({
    ...surface,
    crossingFaceCount: 0,
    surfaceAreaM2: 0,
    normalAreaSum: [0, 0, 0],
    centroidAreaSum: [0, 0, 0],
    elementOffset: 0,
    elementCount: 0
  }));
  const elementValues = [];
  const elements = [];
  const rowCount = candidateRows.length / SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS;
  const sourceParticleIndexForElementIndex = (elementIndex) => {
    if (!interfaceSourceKeyRows) return null;
    const sourceKeyOffset = elementIndex * SPH_INTERFACE_SOURCE_KEY_FLOATS;
    if (sourceKeyOffset + 2 >= interfaceSourceKeyRows.length) return null;
    const rowElementIndex = Math.round(finiteNumber(interfaceSourceKeyRows[sourceKeyOffset], -1));
    const rowStatus = interfaceSourceKeyRows[sourceKeyOffset + 2] || 0;
    if (rowElementIndex !== elementIndex || !(rowStatus > 0)) return null;
    const sourceParticleIndex = Math.round(finiteNumber(interfaceSourceKeyRows[sourceKeyOffset + 1], -1));
    return sourceParticleIndex >= 0 ? sourceParticleIndex : null;
  };
  for (let candidateIndex = 0; candidateIndex < rowCount; candidateIndex += 1) {
    const offset = candidateIndex * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS;
    const status = candidateRows[offset + 15];
    if (!(status > 0)) continue;
    const surfaceIndex = Math.round(candidateRows[offset]);
    const surface = surfaceAccumulators[surfaceIndex];
    if (!surface) continue;
    if (surface.elementCount === 0) surface.elementOffset = elements.length;
    const areaM2 = candidateRows[offset + 7];
    const normalAreaVectorM2 = [
      candidateRows[offset + 11],
      candidateRows[offset + 12],
      candidateRows[offset + 13]
    ];
    const centroidM = [
      candidateRows[offset + 4],
      candidateRows[offset + 5],
      candidateRows[offset + 6]
    ];
    const normal = [
      candidateRows[offset + 8],
      candidateRows[offset + 9],
      candidateRows[offset + 10]
    ];
    const elementIndex = elements.length;
    const sourceParticleIndex = sourceParticleIndexForElementIndex(elementIndex);
    const element = {
      index: elementIndex,
      surfaceIndex,
      surfaceKey: surface.surfaceKey,
      material: surface.material,
      phase: surface.phase,
      renderKey: surface.renderKey,
      materialId: candidateRows[offset + 1],
      phaseId: candidateRows[offset + 2],
      axisId: candidateRows[offset + 3],
      centroidM,
      areaM2,
      normal,
      normalAreaVectorM2,
      crossingSign: candidateRows[offset + 14],
      ...(sourceParticleIndex == null ? {} : { sourceParticleIndex }),
      status: 'interface-element-ready'
    };
    elements.push(element);
    elementValues.push(
      element.surfaceIndex,
      element.materialId,
      element.phaseId,
      element.axisId,
      element.centroidM[0],
      element.centroidM[1],
      element.centroidM[2],
      element.areaM2,
      element.normal[0],
      element.normal[1],
      element.normal[2],
      element.normalAreaVectorM2[0],
      element.normalAreaVectorM2[1],
      element.normalAreaVectorM2[2],
      element.crossingSign,
      1
    );
    surface.crossingFaceCount += 1;
    surface.surfaceAreaM2 += areaM2;
    surface.normalAreaSum[0] += normalAreaVectorM2[0];
    surface.normalAreaSum[1] += normalAreaVectorM2[1];
    surface.normalAreaSum[2] += normalAreaVectorM2[2];
    surface.centroidAreaSum[0] += centroidM[0] * areaM2;
    surface.centroidAreaSum[1] += centroidM[1] * areaM2;
    surface.centroidAreaSum[2] += centroidM[2] * areaM2;
    surface.elementCount += 1;
  }
  const surfaces = surfaceAccumulators.map((surface) => ({
    surfaceKey: surface.surfaceKey,
    material: surface.material,
    phase: surface.phase,
    renderKey: surface.renderKey,
    materialId: surface.materialId,
    phaseId: surface.phaseId,
    opticalStateKey: surface.opticalStateKey || 'default',
    resolution: surface.resolution,
    isolation: surface.isolation,
    activeCellCount: surface.activeCellCount,
    crossingFaceCount: surface.crossingFaceCount,
    candidateOffset: surface.candidateOffset,
    candidateCount: surface.candidateCount,
    activeCandidateCount: surface.activeCandidateCount,
    elementOffset: surface.elementOffset,
    elementCount: surface.elementCount,
    surfaceAreaM2: surface.surfaceAreaM2,
    meanOutwardNormal: normalizeVector3(surface.normalAreaSum),
    areaCentroidM: surface.surfaceAreaM2 > 0
      ? surface.centroidAreaSum.map((value) => value / surface.surfaceAreaM2)
      : [null, null, null],
    normalDerivation: 'render-field-isosurface-threshold-crossing-candidates',
    surfaceAreaDerivation: 'fixed-cell-axis-candidate-face-area-sum',
    status: surface.surfaceAreaM2 > 0
      ? 'material-interface-derived'
      : (surface.activeCellCount > 0 ? 'material-interface-active-without-crossing' : 'material-interface-empty')
  }));
  const totalSurfaceAreaM2 = surfaces.reduce((sum, surface) => sum + surface.surfaceAreaM2, 0);
  const readySurfaceCount = surfaces.filter((surface) => surface.surfaceAreaM2 > 0).length;
  const field = {
    schema: ULG_SPH_MATERIAL_INTERFACE_FIELD_SCHEMA,
    status: readySurfaceCount > 0 ? 'material-interface-field-ready' : 'material-interface-field-empty',
    sourceSchema: candidateField.sourceSchema,
    sourceBackend: candidateField.sourceBackend,
    candidateFieldSchema: candidateField.schema,
    candidateBackend: candidateField.backend,
    surfaceCount: surfaces.length,
    readySurfaceCount,
    totalSurfaceAreaM2,
    candidateCount: candidateField.candidateCount,
    activeCandidateCount: candidateField.activeCandidateCount,
    candidateStrideFloats: candidateField.rowStrideFloats,
    candidateShape: candidateField.candidateShape,
    elementCount: elements.length,
    elementLayout: [...SPH_MATERIAL_INTERFACE_ELEMENT_ROW_LAYOUT],
    elementStrideFloats: SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
    elementRows: Float32Array.from(elementValues),
    elements,
    interfaceSourceKeySchema: candidateField.interfaceSourceKeySchema ?? null,
    interfaceSourceKeySourceStatus: candidateField.interfaceSourceKeyStatus ?? null,
    interfaceSourceKeyStatus: candidateField.interfaceSourceKeyStatus ?? null,
    interfaceSourceKeyReason: candidateField.interfaceSourceKeyReason ?? null,
    interfaceSourceKeyRows: candidateField.interfaceSourceKeyRows instanceof Float32Array
      ? candidateField.interfaceSourceKeyRows
      : new Float32Array(),
    interfaceSourceKeyReadback: Boolean(candidateField.interfaceSourceKeyReadback),
    interfaceSourceKeyRowCount: candidateField.interfaceSourceKeyRowCount ?? 0,
    interfaceSourceKeyReadyCount: candidateField.interfaceSourceKeyReadyCount ?? 0,
    interfaceSourceKeyStrideFloats: candidateField.interfaceSourceKeyStrideFloats ?? SPH_INTERFACE_SOURCE_KEY_FLOATS,
    interfaceSourceKeyBufferRetained: Boolean(candidateField.interfaceSourceKeyBufferRetained),
    interfaceSourceKeyBufferByteLength: candidateField.interfaceSourceKeyBufferByteLength ?? 0,
    interfaceSourceKeySurfaceIndexFallbackEnabled:
      candidateField.interfaceSourceKeySurfaceIndexFallbackEnabled !== false,
    forceCouplingStatus: readySurfaceCount > 0
      ? 'blocked-pressure-force-solver-not-implemented'
      : 'blocked-material-surface-normals-not-resolved',
    surfaces,
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
  if (candidateField.interfaceSourceKeyBuffer) {
    field.interfaceSourceKeyBuffer = candidateField.interfaceSourceKeyBuffer;
  }
  if (typeof candidateField.destroyMaterialInterfaceCandidateFieldBuffers === 'function') {
    field.destroyMaterialInterfaceFieldBuffers = ({
      reason = 'material-interface-field-buffer-cleanup'
    } = {}) => candidateField.destroyMaterialInterfaceCandidateFieldBuffers({ reason });
  }
  return field;
}

function maxAbsDiff(left, right) {
  if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length) {
    return Infinity;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff = Math.max(diff, Math.abs(left[i] - right[i]));
  }
  return diff;
}

export async function deriveSphMaterialInterfaceCandidateFieldWithOptionalWebGpu({
  renderField,
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = buildSphMaterialInterfaceCandidateFieldWebGpu,
  isolationScale = 1,
  parityTolerance = 1e-6
} = {}) {
  const cpuReference = deriveSphMaterialInterfaceCandidateField(renderField, { isolationScale });
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      candidateReadback: false,
      scientificValidation: false,
      sphValidation: false,
      forceCouplingValidation: false,
      fullPhysicsValidation: false
    };
  }
  if (typeof webGpuRunner !== 'function') {
    return {
      schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-runner-missing-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: 'material interface candidate WebGPU runner not implemented' },
      candidateReadback: false,
      scientificValidation: false,
      sphValidation: false,
      forceCouplingValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      candidateReadback: false,
      scientificValidation: false,
      sphValidation: false,
      forceCouplingValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({
      renderField,
      isolationScale,
      device: resolvedDeviceResult.device,
      candidateCount: cpuReference.candidateCount,
      rowStrideFloats: cpuReference.rowStrideFloats
    });
    assertMaterialInterfaceCandidateField(webgpu);
    const parityMaxAbsDiff = maxAbsDiff(cpuReference.candidateRows, webgpu.candidateRows);
    if (!(parityMaxAbsDiff <= parityTolerance)) {
      return {
        schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
        backend: 'cpu-reference',
        status: 'webgpu-parity-failed-cpu-reference',
        cpuReference,
        webgpu,
        result: cpuReference,
        webgpuStatus: { status: 'fallback-cpu', reason: 'candidate row parity drift', parityMaxAbsDiff },
        candidateReadback: false,
        scientificValidation: false,
        sphValidation: false,
        forceCouplingValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed', parityMaxAbsDiff },
      candidateReadback: true,
      scientificValidation: false,
      sphValidation: false,
      forceCouplingValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_MATERIAL_INTERFACE_CANDIDATE_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      candidateReadback: false,
      scientificValidation: false,
      sphValidation: false,
      forceCouplingValidation: false,
      fullPhysicsValidation: false
    };
  }
}

export function deriveSphMaterialInterfaceField(renderField, {
  isolationScale = 1
} = {}) {
  const candidateField = deriveSphMaterialInterfaceCandidateField(renderField, { isolationScale });
  return compactSphMaterialInterfaceCandidates(candidateField);
}

export async function buildSphPhysicsMaterialInterfaceFieldWebGpu({
  device,
  renderField,
  fieldRowsBuffer = null,
  surfaceBuffer = null,
  isolationScale = 1,
  source = 'resident-physics-material-interface-extractor',
  sourceCadence = 'resident-physics-stage',
  candidateReadbackByteBudget = SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT,
  candidateReadbackMode = MATERIAL_INTERFACE_DENSE_CANDIDATE_READBACK_MODE,
  compactCandidateCapacity = null
} = {}) {
  const sourceField = renderField?.schema === ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA
    ? renderField
    : null;
  const sourceRenderField = sourceField?.sourceRenderField || renderField;
  const resolvedFieldRowsBuffer = fieldRowsBuffer || sourceField?.fieldRowsBuffer || null;
  const resolvedSurfaceBuffer = surfaceBuffer || sourceField?.surfaceBuffer || null;
  const candidateRowsByteLength = materialInterfaceCandidateRowsByteLength(sourceRenderField);
  const normalizedCandidateReadbackMode =
    candidateReadbackMode === MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE
      ? MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE
      : (candidateReadbackMode === MATERIAL_INTERFACE_GPU_RESIDENT_SUMMARY_MODE
          ? MATERIAL_INTERFACE_GPU_RESIDENT_SUMMARY_MODE
          : MATERIAL_INTERFACE_DENSE_CANDIDATE_READBACK_MODE);
  if (normalizedCandidateReadbackMode === MATERIAL_INTERFACE_GPU_RESIDENT_SUMMARY_MODE) {
    return gpuResidentSummaryPhysicsMaterialInterfaceField({
      sourceField,
      sourceRenderField,
      resolvedFieldRowsBuffer,
      resolvedSurfaceBuffer,
      source,
      sourceCadence,
      candidateRowsByteLength,
      candidateReadbackByteBudget,
      candidateReadbackMode: normalizedCandidateReadbackMode,
      compactCandidateCapacity
    });
  }
  const normalizedReadbackCandidateMode =
    normalizedCandidateReadbackMode === MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE
      ? MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE
      : MATERIAL_INTERFACE_DENSE_CANDIDATE_READBACK_MODE;
  const candidateReadbackBlocker = normalizedReadbackCandidateMode === MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE
    ? null
    : materialInterfaceCandidateReadbackBlocker({
      device,
      candidateRowsByteLength,
      candidateReadbackByteBudget
    });
  if (candidateReadbackBlocker) {
    return skippedPhysicsMaterialInterfaceField({
      sourceField,
      sourceRenderField,
      resolvedFieldRowsBuffer,
      resolvedSurfaceBuffer,
      source,
      sourceCadence,
      candidateRowsByteLength,
      candidateReadbackByteBudget,
      candidateReadbackBlocker,
      candidateReadbackMode: normalizedReadbackCandidateMode
    });
  }
  let candidateField = null;
  if (normalizedReadbackCandidateMode === MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE) {
    candidateField = await buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
      device,
      renderField: sourceRenderField,
      fieldRowsBuffer: resolvedFieldRowsBuffer,
      surfaceBuffer: resolvedSurfaceBuffer,
      sourceIndexFieldBuffer: sourceField?.sourceIndexFieldBuffer || sourceRenderField?.sourceIndexFieldBuffer || null,
      isolationScale,
      compactCandidateCapacity
    });
    if (candidateField.status === 'material-interface-compact-candidate-field-overflow') {
      const fallbackBlocker = materialInterfaceCandidateReadbackBlocker({
        device,
        candidateRowsByteLength,
        candidateReadbackByteBudget
      });
      if (fallbackBlocker) {
        return skippedPhysicsMaterialInterfaceField({
          sourceField,
          sourceRenderField,
          resolvedFieldRowsBuffer,
          resolvedSurfaceBuffer,
          source,
          sourceCadence,
          candidateRowsByteLength,
          candidateReadbackByteBudget,
          candidateReadbackBlocker: fallbackBlocker,
          candidateReadbackMode: normalizedReadbackCandidateMode,
          compactCandidateField: candidateField
        });
      }
      candidateField = await buildSphMaterialInterfaceCandidateFieldWebGpu({
        device,
        renderField: sourceRenderField,
        fieldRowsBuffer: resolvedFieldRowsBuffer,
        surfaceBuffer: resolvedSurfaceBuffer,
        isolationScale
      });
      candidateField.compactFallbackStatus = 'fallback-dense-readback-after-compact-overflow';
    }
  } else {
    candidateField = await buildSphMaterialInterfaceCandidateFieldWebGpu({
      device,
      renderField: sourceRenderField,
      fieldRowsBuffer: resolvedFieldRowsBuffer,
      surfaceBuffer: resolvedSurfaceBuffer,
      isolationScale
    });
  }
  const interfaceField = compactSphMaterialInterfaceCandidates(candidateField);
  const compactCandidateReadback =
    candidateField.candidateReadbackMode === MATERIAL_INTERFACE_COMPACT_CANDIDATE_READBACK_MODE;
  return {
    ...interfaceField,
    backend: compactCandidateReadback ? 'webgpu-compact-candidate-readback' : 'webgpu-candidate-readback',
    authority: 'resident-physics-material-interface-extractor',
    source,
    sourceCadence,
    sourceFieldSchema: sourceField?.schema ?? null,
    sourceFieldStatus: sourceField?.status ?? null,
    sourceFieldBackend: sourceField?.backend ?? null,
    sourceFieldPipelineCacheStatus: sourceField?.sourceRenderFieldPipelineCacheStatus
      ?? sourceField?.pipelineCacheStatus
      ?? null,
    sourceRenderFieldSchema: sourceRenderField?.schema ?? null,
    sourceRenderFieldBackend: sourceRenderField?.backend ?? null,
    sourceRenderFieldPipelineCacheStatus: sourceRenderField?.pipelineCacheStatus
      ?? sourceField?.sourceRenderFieldPipelineCacheStatus
      ?? null,
    sourceRenderFieldReadback: Boolean(sourceRenderField?.renderFieldReadback),
    sourceFieldRowsBufferBound: Boolean(resolvedFieldRowsBuffer),
    sourceSurfaceBufferBound: Boolean(resolvedSurfaceBuffer),
    candidateBackend: candidateField.backend,
    candidateReadback: Boolean(candidateField.candidateReadback),
    candidateReadbackMode: candidateField.candidateReadbackMode ?? normalizedCandidateReadbackMode,
    candidateRowsByteLength,
    candidateDenseRowsByteLength: candidateField.candidateDenseRowsByteLength ?? candidateRowsByteLength,
    candidateCompactRowsByteLength: candidateField.candidateCompactRowsByteLength ?? null,
    candidateCompactCapacity: candidateField.compactCandidateCapacity ?? null,
    candidateCompactOverflowCount: candidateField.compactCandidateOverflowCount ?? 0,
    candidateCompactFallbackStatus: candidateField.compactFallbackStatus ?? null,
    candidateMetadataReadback: Boolean(candidateField.candidateMetadataReadback),
    candidatePipelineCacheStatus: candidateField.pipelineCacheStatus ?? null,
    queueCompletionStatus: candidateField.queueCompletionStatus ?? null,
    queueCompletionMethod: candidateField.queueCompletionMethod ?? null,
    normalDerivation: 'physics-owned-field-cell-crossing-candidates',
    surfaceAreaDerivation: 'physics-owned-fixed-cell-face-area-sum',
    physicsStage: 'material-interface-extraction',
    pressureInterfaceProducer: true
  };
}

export async function buildSphRenderFieldWebGpu({
  device,
  renderRows,
  renderRowsBuffer = null,
  productEventRows = null,
  productEventBuffer = null,
  surfaceTable,
  particleCount = null,
  productEventCount = null,
  fieldPadding = 0.22,
  refEdgeM = 10,
  readbackMode = FULL_READBACK_MODE,
  retainFieldRowsBuffer = false,
  retainSurfaceBuffer = false,
  waitForQueueCompletion = true,
  deferCleanup = true,
  useQueueFenceForCleanup = true,
  targetFieldRowsBuffer = null,
  targetFieldRowsBufferByteLength = null
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('buildSphRenderFieldWebGpu requires a WebGPU-like device');
  }
  if (!renderRowsBuffer && !(renderRows instanceof Float32Array)) {
    throw new TypeError('buildSphRenderFieldWebGpu requires renderRows or renderRowsBuffer');
  }
  if (renderRows && renderRows.length % SPH_GPU_RENDER_ROW_FLOATS !== 0) {
    throw new RangeError('SPH render rows length must align to the render row stride');
  }
  if (productEventRows && (!(productEventRows instanceof Float32Array) || productEventRows.length % SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS !== 0)) {
    throw new RangeError('SPH product-event rows length must align to the product-event row stride');
  }
  assertRenderFieldSurfaceTable(surfaceTable);
  const resolvedParticleCount = particleCount ?? (renderRows?.length ? renderRows.length / SPH_GPU_RENDER_ROW_FLOATS : 0);
  const resolvedProductEventCount = productEventCount ?? (
    productEventRows?.length ? productEventRows.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS : 0
  );
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedRenderRowsBuffer = renderRowsBuffer || null;
  const borrowedProductEventBuffer = productEventBuffer || null;
  const renderFieldInputSource = borrowedRenderRowsBuffer
    ? (borrowedProductEventBuffer ? 'resident-render-rows-and-product-events-buffer' : 'resident-render-rows-buffer')
    : (borrowedProductEventBuffer ? 'uploaded-render-rows-with-resident-product-events' : 'uploaded-render-rows');
  const sourceRowsBuffer = borrowedRenderRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-source-rows',
    renderRows,
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const sourceProductEventBuffer = borrowedProductEventBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-product-events',
    productEventRows || new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const surfaceBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-field-surfaces',
    surfaceTable.records
  );
  const fieldRowByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const targetFieldRowsByteLength = targetFieldRowsBuffer
    ? Math.max(0, Math.round(finiteNumber(
      targetFieldRowsBufferByteLength
        ?? targetFieldRowsBuffer.size
        ?? targetFieldRowsBuffer.byteLength
        ?? 0,
      0
    )))
    : 0;
  if (targetFieldRowsBuffer && targetFieldRowsByteLength < fieldRowByteLength) {
    throw new RangeError(
      `targetFieldRowsBuffer is too small (${targetFieldRowsByteLength}) for render field (${fieldRowByteLength})`
    );
  }
  const fieldRowsBufferBorrowed = Boolean(targetFieldRowsBuffer);
  const fieldRowsBuffer = targetFieldRowsBuffer || writeStorageBuffer(
    device,
    'ulg-sph-render-field-cells',
    new Float32Array(surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-render-field-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createRenderFieldParamsArray({
    particleCount: resolvedParticleCount,
    productEventCount: borrowedProductEventBuffer || productEventRows ? resolvedProductEventCount : 0,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    fieldPadding,
    refEdgeM
  }));

  const renderFieldBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'uniform'),
    computeBufferBinding(4, 'read-only-storage')
  ];
  const {
    pipeline,
    bindGroupLayout,
    cacheStatus: pipelineCacheStatus
  } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-render-field-v1',
    label: 'ulg-sph-render-field',
    code: sphRenderFieldWgsl,
    entryPoint: 'main',
    bindings: renderFieldBindings
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: sourceRowsBuffer } },
      { binding: 1, resource: { buffer: surfaceBuffer } },
      { binding: 2, resource: { buffer: fieldRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
      { binding: 4, resource: { buffer: sourceProductEventBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(Math.max(1, surfaceTable.maxFieldCellCount) / 64), Math.max(1, surfaceTable.surfaceCount));
  pass.end();
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let fieldRows;
  let deferNoFullCleanup = false;
  if (!noFullReadback) {
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    const fieldBytes = await readBuffer(
      device,
      fieldRowsBuffer,
      surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      'ulg-sph-render-field-readback'
    );
    queueCompletionStatus = 'readback-map-completed';
    queueCompletionMethod = 'mapAsync(readback-buffer)';
    fieldRows = new Float32Array(fieldBytes);
  } else {
    if (waitForQueueCompletion && device.queue?.onSubmittedWorkDone) {
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
      await device.queue.onSubmittedWorkDone();
      queueCompletionStatus = 'queue-work-completed';
      queueCompletionMethod = 'queue.onSubmittedWorkDone';
    } else {
      device.queue.submit([encoder.finish()]);
      queueCompletionStatus = device.queue?.onSubmittedWorkDone
        ? 'queue-submitted-gpu-handoff-no-cpu-fence'
        : 'queue-submitted-no-explicit-completion';
      queueCompletionMethod = device.queue?.onSubmittedWorkDone
        ? 'queue.submit(in-order-gpu-render-field-handoff)'
        : 'queue.submit';
      deferNoFullCleanup = Boolean(device.queue?.onSubmittedWorkDone && deferCleanup);
    }
    fieldRows = new Float32Array();
  }

  let cleanupDone = false;
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    if (!borrowedRenderRowsBuffer) sourceRowsBuffer.destroy?.();
    if (!borrowedProductEventBuffer) sourceProductEventBuffer.destroy?.();
    if (!retainSurfaceBuffer) surfaceBuffer.destroy?.();
    if (!retainFieldRowsBuffer && !fieldRowsBufferBorrowed) fieldRowsBuffer.destroy?.();
    paramsBuffer.destroy?.();
  };
  let renderFieldDeferredCleanup = false;
  if (deferNoFullCleanup && useQueueFenceForCleanup) {
    renderFieldDeferredCleanup = deferSubmittedWorkCleanup(device, cleanup);
  } else if (deferNoFullCleanup) {
    renderFieldDeferredCleanup = true;
  } else {
    cleanup();
  }

  const renderFieldLeaseLedger = createResidentBufferLeaseLedger({
    ledgerId: `sph-render-field:${surfaceTable.surfaceCount}:${surfaceTable.totalFieldCells}:buffer-leases`,
    stateKey: 'sph-render-field',
    scope: 'sph-render-field-buffer-leases'
  });
  const renderFieldLeaseIds = [];
  const registerRetainedRenderFieldBuffer = ({
    resourceKey,
    resourceKind,
    buffer,
    byteLength,
    rowCount,
    expectedConsumers = []
  }) => {
    registerResidentBufferResource(renderFieldLeaseLedger, {
      resourceKey,
      resourceKind,
      stateFamily: 'render-field',
      ownerStage: 'render-field-builder',
      producerStage: 'render-field-builder',
      source: 'buildSphRenderFieldWebGpu',
      status: 'resident-render-field-buffer-retained',
      retained: true,
      byteLength,
      rowCount,
      bufferLabel: buffer?.label,
      expectedConsumers
    });
    for (const consumerStage of expectedConsumers) {
      const lease = addResidentBufferLease(renderFieldLeaseLedger, {
        resourceKey,
        consumerStage,
        reason: 'retained-render-field-buffer'
      });
      renderFieldLeaseIds.push(lease.leaseId);
    }
  };
  const fieldRowsResourceKey = `render-field:field-rows:${surfaceTable.totalFieldCells}:${fieldRowByteLength}`;
  const surfaceTableResourceKey = `render-field:surface-table:${surfaceTable.surfaceCount}:${surfaceTable.records.byteLength}`;
  if (retainFieldRowsBuffer) {
    registerRetainedRenderFieldBuffer({
      resourceKey: fieldRowsResourceKey,
      resourceKind: 'render-field-rows-buffer',
      buffer: fieldRowsBuffer,
      byteLength: fieldRowByteLength,
      rowCount: surfaceTable.totalFieldCells,
      expectedConsumers: ['material-interface-extraction', 'surface-vertex-extraction']
    });
  }
  if (retainSurfaceBuffer) {
    registerRetainedRenderFieldBuffer({
      resourceKey: surfaceTableResourceKey,
      resourceKind: 'render-field-surface-table-buffer',
      buffer: surfaceBuffer,
      byteLength: surfaceTable.records.byteLength,
      rowCount: surfaceTable.surfaceCount,
      expectedConsumers: ['surface-vertex-extraction', 'surface-draw-metadata']
    });
  }
  const result = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu',
    status: 'render-field-built',
    kernelScope: RENDER_FIELD_SCOPE,
    particleCount: resolvedParticleCount,
    productEventCount: borrowedProductEventBuffer || productEventRows ? resolvedProductEventCount : 0,
    productEventBufferBound: Boolean(borrowedProductEventBuffer || productEventRows),
    productEventBufferByteLength: (borrowedProductEventBuffer || productEventRows)
      ? resolvedProductEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT
      : 0,
    surfaceCount: surfaceTable.surfaceCount,
    totalFieldCells: surfaceTable.totalFieldCells,
    maxFieldCellCount: surfaceTable.maxFieldCellCount,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_FLOATS,
    fieldRows,
    fieldRowByteLength,
    fieldPadding,
    refEdgeM,
    renderFieldInputSource,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    queueCompletionStatus,
    queueCompletionMethod,
    pipelineCacheStatus,
    renderFieldDeferredCleanup,
    renderFieldReadback: !noFullReadback,
    fullReadbackPerformed: !noFullReadback,
    normalHotLoopReadbackFree: noFullReadback,
    fieldRowsBufferRetained: Boolean(retainFieldRowsBuffer),
    fieldRowsBufferByteLength: retainFieldRowsBuffer ? fieldRowByteLength : 0,
    fieldRowsBufferBorrowed,
    fieldRowsBufferReused: fieldRowsBufferBorrowed,
    fieldRowsBufferOwnedByResult: !fieldRowsBufferBorrowed,
    surfaceBufferRetained: Boolean(retainSurfaceBuffer),
    surfaceBufferByteLength: retainSurfaceBuffer ? surfaceTable.records.byteLength : 0,
    residentBufferLeaseLedger: renderFieldLeaseLedger,
    residentBufferLeaseSummary: summarizeResidentBufferLeaseLedger(renderFieldLeaseLedger),
    residentBufferLeaseLedgerStatus: renderFieldLeaseLedger.status,
    residentBufferLeaseResourceCount: renderFieldLeaseLedger.resourceCount,
    residentBufferLeaseActiveLeaseCount: renderFieldLeaseLedger.activeLeaseCount,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  if (retainFieldRowsBuffer) result.fieldRowsBuffer = fieldRowsBuffer;
  if (retainSurfaceBuffer) result.surfaceBuffer = surfaceBuffer;
  if (retainFieldRowsBuffer || retainSurfaceBuffer) {
    const destroyedRenderFieldResourceKeys = new Set();
    const refreshRenderFieldLeaseSummary = () => {
      result.residentBufferLeaseSummary = summarizeResidentBufferLeaseLedger(renderFieldLeaseLedger);
      result.residentBufferLeaseLedgerStatus = result.residentBufferLeaseSummary.status;
      result.residentBufferLeaseResourceCount = result.residentBufferLeaseSummary.resourceCount;
      result.residentBufferLeaseActiveLeaseCount = result.residentBufferLeaseSummary.activeLeaseCount;
      return result.residentBufferLeaseSummary;
    };
    result.releaseRenderFieldBufferLeases = ({ status = 'released' } = {}) => {
      for (const leaseId of renderFieldLeaseIds) {
        releaseResidentBufferLease(renderFieldLeaseLedger, leaseId, { status });
      }
      return refreshRenderFieldLeaseSummary();
    };
    const destroyRenderFieldBufferOnce = (resourceKey, buffer) => {
      if (destroyedRenderFieldResourceKeys.has(resourceKey)) return;
      destroyedRenderFieldResourceKeys.add(resourceKey);
      buffer?.destroy?.();
    };
    result.destroyRenderFieldBuffers = ({
      force = false,
      releaseLeases = false,
      reason = 'render-field-buffer-cleanup'
    } = {}) => {
      cleanup();
      if (releaseLeases) result.releaseRenderFieldBufferLeases();
      if (retainFieldRowsBuffer) {
        destroyResidentBufferWithLease(renderFieldLeaseLedger, fieldRowsResourceKey, () => {
          if (!fieldRowsBufferBorrowed) {
            destroyRenderFieldBufferOnce(fieldRowsResourceKey, fieldRowsBuffer);
          }
        }, { force, reason });
      }
      if (retainSurfaceBuffer) {
        destroyResidentBufferWithLease(renderFieldLeaseLedger, surfaceTableResourceKey, () => {
          destroyRenderFieldBufferOnce(surfaceTableResourceKey, surfaceBuffer);
        }, { force, reason });
      }
      return refreshRenderFieldLeaseSummary();
    };
  }
  return result;
}

export async function buildSphMaterialInterfaceSourceFieldWebGpu({
  retainFieldRowsBuffer = true,
  retainSurfaceBuffer = true,
  source = 'resident-physics-material-interface-source-field',
  sourceCadence = 'resident-physics-stage',
  ...args
} = {}) {
  const sourceRenderField = await buildSphRenderFieldWebGpu({
    ...args,
    retainFieldRowsBuffer,
    retainSurfaceBuffer
  });
  return {
    schema: ULG_SPH_MATERIAL_INTERFACE_SOURCE_FIELD_SCHEMA,
    backend: sourceRenderField.backend,
    status: sourceRenderField.status === 'render-field-built'
      ? 'material-interface-source-field-ready'
      : sourceRenderField.status,
    source,
    sourceCadence,
    sourceRenderField,
    sourceRenderFieldSchema: sourceRenderField.schema,
    sourceRenderFieldBackend: sourceRenderField.backend,
    sourceRenderFieldStatus: sourceRenderField.status,
    sourceRenderFieldReadback: Boolean(sourceRenderField.renderFieldReadback),
    sourceRenderFieldReadbackMode: sourceRenderField.readbackMode ?? null,
    sourceRenderFieldQueueCompletionStatus: sourceRenderField.queueCompletionStatus ?? null,
    sourceRenderFieldQueueCompletionMethod: sourceRenderField.queueCompletionMethod ?? null,
    sourceRenderFieldPipelineCacheStatus: sourceRenderField.pipelineCacheStatus ?? null,
    kernelScope: MATERIAL_INTERFACE_SOURCE_FIELD_SCOPE,
    particleCount: sourceRenderField.particleCount,
    productEventCount: sourceRenderField.productEventCount,
    surfaceCount: sourceRenderField.surfaceCount,
    totalFieldCells: sourceRenderField.totalFieldCells,
    maxFieldCellCount: sourceRenderField.maxFieldCellCount,
    surfaceTable: sourceRenderField.surfaceTable,
    rowLayout: sourceRenderField.rowLayout,
    rowStrideFloats: sourceRenderField.rowStrideFloats,
    fieldRows: sourceRenderField.fieldRows,
    fieldRowByteLength: sourceRenderField.fieldRowByteLength,
    fieldPadding: sourceRenderField.fieldPadding,
    refEdgeM: sourceRenderField.refEdgeM,
    fieldRowsBuffer: sourceRenderField.fieldRowsBuffer || null,
    surfaceBuffer: sourceRenderField.surfaceBuffer || null,
    fieldRowsBufferRetained: Boolean(sourceRenderField.fieldRowsBufferRetained),
    fieldRowsBufferByteLength: sourceRenderField.fieldRowsBufferByteLength ?? 0,
    fieldRowsBufferBorrowed: Boolean(sourceRenderField.fieldRowsBufferBorrowed),
    fieldRowsBufferReused: Boolean(sourceRenderField.fieldRowsBufferReused),
    fieldRowsBufferOwnedByResult: sourceRenderField.fieldRowsBufferOwnedByResult ?? null,
    surfaceBufferRetained: Boolean(sourceRenderField.surfaceBufferRetained),
    surfaceBufferByteLength: sourceRenderField.surfaceBufferByteLength ?? 0,
    readbackMode: sourceRenderField.readbackMode ?? null,
    queueCompletionStatus: sourceRenderField.queueCompletionStatus ?? null,
    queueCompletionMethod: sourceRenderField.queueCompletionMethod ?? null,
    normalHotLoopReadbackFree: Boolean(sourceRenderField.normalHotLoopReadbackFree),
    residentBufferLeaseLedger: sourceRenderField.residentBufferLeaseLedger ?? null,
    residentBufferLeaseSummary: sourceRenderField.residentBufferLeaseSummary ?? null,
    residentBufferLeaseLedgerStatus: sourceRenderField.residentBufferLeaseLedgerStatus ?? null,
    residentBufferLeaseResourceCount: sourceRenderField.residentBufferLeaseResourceCount ?? 0,
    residentBufferLeaseActiveLeaseCount: sourceRenderField.residentBufferLeaseActiveLeaseCount ?? 0,
    releaseMaterialInterfaceSourceFieldLeases(options) {
      const summary = sourceRenderField.releaseRenderFieldBufferLeases?.(options) ?? null;
      this.residentBufferLeaseSummary = sourceRenderField.residentBufferLeaseSummary ?? summary;
      this.residentBufferLeaseLedgerStatus = sourceRenderField.residentBufferLeaseLedgerStatus ?? summary?.status ?? null;
      this.residentBufferLeaseResourceCount = sourceRenderField.residentBufferLeaseResourceCount ?? summary?.resourceCount ?? 0;
      this.residentBufferLeaseActiveLeaseCount = sourceRenderField.residentBufferLeaseActiveLeaseCount ?? summary?.activeLeaseCount ?? 0;
      return this.residentBufferLeaseSummary;
    },
    destroyMaterialInterfaceSourceFieldBuffers(options) {
      const summary = sourceRenderField.destroyRenderFieldBuffers?.(options) ?? null;
      this.residentBufferLeaseSummary = sourceRenderField.residentBufferLeaseSummary ?? summary;
      this.residentBufferLeaseLedgerStatus = sourceRenderField.residentBufferLeaseLedgerStatus ?? summary?.status ?? null;
      this.residentBufferLeaseResourceCount = sourceRenderField.residentBufferLeaseResourceCount ?? summary?.resourceCount ?? 0;
      this.residentBufferLeaseActiveLeaseCount = sourceRenderField.residentBufferLeaseActiveLeaseCount ?? summary?.activeLeaseCount ?? 0;
      return this.residentBufferLeaseSummary;
    },
    scientificValidation: false,
    sphValidation: false,
    forceCouplingValidation: false,
    fullPhysicsValidation: false
  };
}

export async function buildSphRenderFieldWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = buildSphRenderFieldWebGpu,
  ...args
} = {}) {
  const cpuReference = buildSphRenderFieldCpu(args);
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      renderFieldReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      renderFieldReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ ...args, device: resolvedDeviceResult.device });
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed' },
      renderFieldReadback: Boolean(webgpu.renderFieldReadback),
      readbackMode: webgpu.readbackMode ?? FULL_READBACK_MODE,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      renderFieldReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}

export async function extractSphRenderRowsWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  sourceMechanicsBuffer = null,
  retainRenderRowsBuffer = false,
  readbackMode = FULL_READBACK_MODE,
  renderDomainBaseCount = 0,
  renderDomainDropCount = 0
} = {}) {
  assertPackedSphParticleState(sphParticleState);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('extractSphRenderRowsWebGpu requires a WebGPU-like device');
  }
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const borrowedThermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  const mechanicsReady = mlsMpmParticleState?.mechanics instanceof Float32Array
    && mlsMpmParticleState.mechanics.length >= sphParticleState.particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  const borrowedMechanicsBuffer = sourceMechanicsBuffer || mlsMpmParticleUpload?.mechanicsBuffer || null;
  const packedMaterialBankParticleSizeRows = sphParticleState.materialPropertyBankParticleSizeTable?.rows;
  const packedMaterialBankParticleSizeRowCount = Math.max(
    0,
    Math.round(finiteNumber(sphParticleState.materialPropertyBankParticleSizeTable?.rowCount, 0))
  );
  const borrowedMaterialBankParticleSizeBuffer = sphParticleUpload?.materialPropertyBankParticleSizeBuffer || null;
  const uploadedMaterialBankParticleSizeRowCount = borrowedMaterialBankParticleSizeBuffer
    ? Math.max(0, Math.round(finiteNumber(sphParticleUpload?.materialPropertyBankParticleSizeRowCount, 0)))
    : 0;
  const materialBankParticleSizeRowCount = Math.max(
    0,
    Math.round(finiteNumber(
      borrowedMaterialBankParticleSizeBuffer
        ? uploadedMaterialBankParticleSizeRowCount
        : (packedMaterialBankParticleSizeRows?.byteLength > 0 ? packedMaterialBankParticleSizeRowCount : 0),
      0
    ))
  );
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-sph-render-source-state', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-sph-render-source-thermo', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer
    || writeStorageBuffer(
      device,
      mechanicsReady ? 'ulg-sph-render-source-mechanics' : 'ulg-sph-render-source-mechanics-empty',
      mechanicsReady ? mlsMpmParticleState.mechanics : new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS)
    );
  const materialBankParticleSizeBuffer = borrowedMaterialBankParticleSizeBuffer
    || writeStorageBuffer(
      device,
      materialBankParticleSizeRowCount > 0
        ? 'ulg-sph-render-material-bank-particle-size-rows'
        : 'ulg-sph-render-material-bank-particle-size-rows-empty',
      materialBankParticleSizeRowCount > 0 && packedMaterialBankParticleSizeRows?.byteLength > 0
        ? packedMaterialBankParticleSizeRows
        : new Float32Array(16)
    );
  const renderRowsBuffer = writeStorageBuffer(
    device,
    'ulg-sph-render-rows',
    new Float32Array(sphParticleState.particleCount * SPH_GPU_RENDER_ROW_FLOATS),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const renderRowsByteLength = sphParticleState.particleCount
    * SPH_GPU_RENDER_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const useGpuHandoffBuffer = noFullReadback && retainRenderRowsBuffer && renderRowsByteLength > 0;
  const retainedRenderRowsBuffer = useGpuHandoffBuffer
    ? device.createBuffer({
      label: 'ulg-sph-render-rows-retained-handoff',
      size: Math.max(4, renderRowsByteLength),
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    })
    : renderRowsBuffer;
  const maxSupportRadiusM = finiteNumber(sphParticleState.smoothingLengthM, 0)
    * SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO;
  const maxGasRadiusM = finiteNumber(sphParticleState.smoothingLengthM, 0)
    * SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO;
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-render-rows-params',
    size: SPH_RENDER_ROWS_PARAMS_BYTES,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
	    renderDomainBaseCount,
	    renderDomainDropCount,
	    hasMechanics: Boolean(borrowedMechanicsBuffer || mechanicsReady),
	    maxSupportRadiusM,
	    maxGasRadiusM,
	    materialBankParticleSizeRowCount
	  }));

  const module = device.createShaderModule({ label: 'ulg-sph-render-rows', code: sphRenderRowsWgsl });
  const { pipeline, bindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-render-rows',
    module,
    entryPoint: 'main',
    bindings: [
      computeBufferBinding(0, 'read-only-storage'),
      computeBufferBinding(1, 'read-only-storage'),
      computeBufferBinding(2, 'storage'),
      computeBufferBinding(3, 'uniform'),
      computeBufferBinding(4, 'read-only-storage'),
      computeBufferBinding(5, 'read-only-storage')
    ]
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: renderRowsBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
      { binding: 4, resource: { buffer: mechanicsBuffer } },
      { binding: 5, resource: { buffer: materialBankParticleSizeBuffer } }
    ]
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.end();
  if (useGpuHandoffBuffer) {
    encoder.copyBufferToBuffer(renderRowsBuffer, 0, retainedRenderRowsBuffer, 0, renderRowsByteLength);
  }
  let renderRows;
  let queueCompletionStatus = 'not-submitted';
  let queueCompletionMethod = null;
  let deferNoFullReadbackCleanup = false;
  if (!noFullReadback) {
    device.queue.submit([encoder.finish()]);
    queueCompletionStatus = 'queue-submitted';
    queueCompletionMethod = 'queue.submit';
    const bytes = await readBuffer(device, renderRowsBuffer, renderRowsByteLength);
    renderRows = new Float32Array(bytes);
    queueCompletionStatus = 'readback-map-completed';
    queueCompletionMethod = 'mapAsync(readback-buffer)';
  } else {
    device.queue.submit([encoder.finish()]);
    if (retainRenderRowsBuffer) {
      queueCompletionStatus = 'queue-submitted-gpu-handoff-no-cpu-fence';
      queueCompletionMethod = useGpuHandoffBuffer
        ? 'queue.submit(in-order-gpu-copy-handoff)'
        : 'queue.submit(in-order-gpu-buffer-handoff)';
      deferNoFullReadbackCleanup = true;
    } else if (device.queue?.onSubmittedWorkDone) {
      await device.queue.onSubmittedWorkDone();
      queueCompletionStatus = 'queue-work-completed';
      queueCompletionMethod = 'queue.onSubmittedWorkDone';
    } else {
      queueCompletionStatus = 'queue-submitted';
      queueCompletionMethod = 'queue.submit';
    }
    renderRows = new Float32Array();
  }
  let retainedRowsBufferDestroyed = false;
  const deferredCleanupBuffers = [];
  const destroyDeferredCleanupBuffers = () => {
    for (const buffer of deferredCleanupBuffers) {
      buffer?.destroy?.();
    }
    deferredCleanupBuffers.length = 0;
  };
  const destroyRetainedRenderRowsBuffer = () => {
    if (retainedRowsBufferDestroyed) return;
    retainedRowsBufferDestroyed = true;
    destroyDeferredCleanupBuffers();
    retainedRenderRowsBuffer.destroy?.();
  };

  const destroyOrDefer = (buffer) => {
    if (!buffer?.destroy) return;
    if (deferNoFullReadbackCleanup) deferredCleanupBuffers.push(buffer);
    else buffer.destroy();
  };
  if (!borrowedStateBuffer) destroyOrDefer(stateBuffer);
  if (!borrowedThermoBuffer) destroyOrDefer(thermoBuffer);
  if (!borrowedMechanicsBuffer) destroyOrDefer(mechanicsBuffer);
  if (!borrowedMaterialBankParticleSizeBuffer) destroyOrDefer(materialBankParticleSizeBuffer);
  if (useGpuHandoffBuffer) destroyOrDefer(renderRowsBuffer);
  if (!retainRenderRowsBuffer) destroyRetainedRenderRowsBuffer();
  destroyOrDefer(paramsBuffer);

  const result = {
    schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
    backend: 'webgpu',
    status: 'render-rows-extracted',
    kernelScope: RENDER_SCOPE,
    particleCount: sphParticleState.particleCount,
    rowLayout: [...SPH_GPU_RENDER_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_ROW_FLOATS,
    renderRows,
    renderRowByteLength: renderRowsByteLength,
    renderRowsReadbackByteLength: renderRows.byteLength,
    renderRowsBufferRetained: Boolean(retainRenderRowsBuffer),
    renderRowsBufferByteLength: renderRowsByteLength,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    renderRowsReadback: !noFullReadback,
    compactRenderReadback: !noFullReadback,
    fullReadbackPerformed: !noFullReadback,
	    normalHotLoopReadbackFree: noFullReadback,
	    renderRowsIncludeMechanicsVolume: Boolean(borrowedMechanicsBuffer || mechanicsReady),
      materialPropertyBankParticleSizeConsumer: materialBankParticleSizeConsumerSummary({
        rowCount: materialBankParticleSizeRowCount,
        bufferSource: borrowedMaterialBankParticleSizeBuffer
          ? 'sph-particle-upload'
          : (materialBankParticleSizeRowCount > 0 ? 'packed-sph-particle-state' : 'empty-buffer')
      }),
	    renderRowsGpuHandoffCopy: useGpuHandoffBuffer,
	    renderRowsHandoffMode: useGpuHandoffBuffer ? 'gpu-copy-barrier' : 'direct-render-row-buffer',
	    queueCompletionStatus,
	    queueCompletionMethod,
	    renderRowsDeferredCleanup: deferNoFullReadbackCleanup,
		    particleScaleStability: renderParticleScaleStabilityPolicy({
		      particleCount: sphParticleState.particleCount,
		      rowProducer: 'webgpu-shader',
		      maxSupportRadiusM,
		      maxGasRadiusM
		    }),
	    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  if (retainRenderRowsBuffer) {
    result.renderRowsBuffer = retainedRenderRowsBuffer;
    result.renderRowsBufferOwned = true;
    result.destroyRenderRowsBuffer = destroyRetainedRenderRowsBuffer;
  }
  return result;
}

export async function extractSphRenderRowsWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = extractSphRenderRowsWebGpu,
  ...args
} = {}) {
  const cpuReference = extractSphRenderRowsCpu(args);
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      compactRenderReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDeviceResult = device
    ? { status: 'webgpu-device-ready', device, reason: 'provided device' }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      compactRenderReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({ ...args, device: resolvedDeviceResult.device });
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'webgpu',
      status: 'webgpu-accepted',
      cpuReference,
      webgpu,
      result: webgpu,
      webgpuStatus: { status: 'webgpu-executed' },
      compactRenderReadback: Boolean(webgpu.compactRenderReadback),
      readbackMode: webgpu.readbackMode ?? FULL_READBACK_MODE,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      compactRenderReadback: false,
      scientificValidation: false,
      sphValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}
