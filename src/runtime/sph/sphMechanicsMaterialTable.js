import {
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';
import { gpuPhaseId, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';

export const ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA = 'peercompute.ulg.mls-mpm-mechanics-material-table.v0';
export const MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS = SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length;

const AVOGADRO_R = 8.314462618;
const DEFAULT_SOUND_SPEED_SCALE = 1;
const DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S = 40;
const DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA = 0.04;
export const MLS_MPM_EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1,
  gasLinearized: 2
});
export const MLS_MPM_MECHANICS_MATERIAL_STATUS = Object.freeze({
  ready: 1,
  missingPhase: 255
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sortedMaterialEntries(materialProperties) {
  return Object.entries(materialProperties || {})
    .filter(([, properties]) => properties?.phases?.length)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function phaseTemperatureK(phase) {
  if (Number.isFinite(phase?.temperatureK)) return phase.temperatureK;
  if (Array.isArray(phase?.temperatureRange) && phase.temperatureRange.length >= 2) {
    const lo = finiteNumber(phase.temperatureRange[0], 293.15);
    const hi = finiteNumber(phase.temperatureRange[1], lo);
    return (lo + hi) / 2;
  }
  return 293.15;
}

function gasSoundSpeedMPerS(properties, phase, {
  soundSpeedScale = DEFAULT_SOUND_SPEED_SCALE,
  minGasSoundSpeedMPerS = DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S
} = {}) {
  const molarMassKgPerMol = finiteNumber(properties?.molarMassKgPerMol, 0);
  if (!(molarMassKgPerMol > 0)) return 0;
  const specificGasConstant = AVOGADRO_R / molarMassKgPerMol;
  const cp = finiteNumber(phase?.cpJPerKgK, 0);
  const gamma = cp > specificGasConstant ? cp / (cp - specificGasConstant) : 1.33;
  return Math.max(
    Math.sqrt(Math.max(gamma * specificGasConstant * phaseTemperatureK(phase), 0)) * soundSpeedScale,
    minGasSoundSpeedMPerS
  );
}

export function mechanicsMaterialPhaseRecord(material, properties, phase, {
  soundSpeedScale = DEFAULT_SOUND_SPEED_SCALE,
  minGasSoundSpeedMPerS = DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S,
  viscosityEnabled = false,
  mlsMpmArtificialViscosityAlpha = DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA,
  viscosityLengthM = 0,
  surfaceTensionEnabled = false
} = {}) {
  const materialId = stableOpticalMaterialId(material);
  const phaseName = String(phase?.name || '').toLowerCase();
  const phaseId = gpuPhaseId(phaseName);
  const restDensity = finiteNumber(phase?.densityKgPerM3, 0);
  const soundScale = finiteNumber(soundSpeedScale, DEFAULT_SOUND_SPEED_SCALE);
  const modulusScale = soundScale * soundScale;
  const bulkRaw = finiteNumber(phase?.bulkModulusPa, 0);
  const shearRaw = phaseName === 'solid' ? finiteNumber(phase?.shearModulusPa, 0) : 0;
  const bulk = bulkRaw * modulusScale;
  const shear = shearRaw * modulusScale;
  const lambda = phaseName === 'solid' ? Math.max((bulkRaw - (2 / 3) * shearRaw) * modulusScale, 0) : 0;
  const gas = phaseName === 'gas';
  const soundSpeed = gas
    ? gasSoundSpeedMPerS(properties, phase, { soundSpeedScale, minGasSoundSpeedMPerS })
    : (restDensity > 0 && bulk > 0 ? Math.sqrt(bulk / restDensity) : 0);
  const closureViscosityPaS = Math.max(finiteNumber(phase?.dynamicViscosityPaS, 0), 0);
  const artificialViscosityPaS = viscosityEnabled && phaseName === 'liquid'
    ? Math.max(
      restDensity
        * soundSpeed
        * finiteNumber(viscosityLengthM, 0)
        * finiteNumber(mlsMpmArtificialViscosityAlpha, DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA),
      0
    )
    : 0;
  const dynamicViscosityPaS = viscosityEnabled ? closureViscosityPaS + artificialViscosityPaS : 0;
  const surfaceTensionNPerM = surfaceTensionEnabled
    ? Math.max(finiteNumber(phase?.surfaceTensionNPerM, 0), 0)
    : 0;
  const eosModelId = gas
    ? MLS_MPM_EOS_MODEL_IDS.gasLinearized
    : (bulk > 0 ? MLS_MPM_EOS_MODEL_IDS.taitCondensed : MLS_MPM_EOS_MODEL_IDS.disabled);
  return [
    materialId,
    phaseId,
    restDensity,
    bulk,
    shear,
    lambda,
    soundSpeed,
    eosModelId,
    phaseName === 'solid' && shear > 0 ? 1 : 0,
    MLS_MPM_MECHANICS_MATERIAL_STATUS.ready,
    dynamicViscosityPaS,
    surfaceTensionNPerM
  ];
}

export function buildMlsMpmMechanicsMaterialTable(materialProperties = {}, {
  soundSpeedScale = DEFAULT_SOUND_SPEED_SCALE,
  minGasSoundSpeedMPerS = DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S,
  viscosityEnabled = false,
  mlsMpmArtificialViscosityAlpha = DEFAULT_MLS_MPM_ARTIFICIAL_VISCOSITY_ALPHA,
  viscosityLengthM = 0,
  surfaceTensionEnabled = false
} = {}) {
  const records = [];
  const metadata = [];
  const options = {
    soundSpeedScale,
    minGasSoundSpeedMPerS,
    viscosityEnabled,
    mlsMpmArtificialViscosityAlpha,
    viscosityLengthM,
    surfaceTensionEnabled
  };
  for (const [material, properties] of sortedMaterialEntries(materialProperties)) {
    const materialId = stableOpticalMaterialId(material);
    const offset = records.length / MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS;
    const phases = [];
    for (const phase of properties.phases || []) {
      records.push(...mechanicsMaterialPhaseRecord(material, properties, phase, options));
      phases.push(phase.name);
    }
    metadata.push({
      material,
      materialId,
      phaseOffset: offset,
      phaseCount: phases.length,
      phaseNames: phases,
      status: phases.length > 0
        ? MLS_MPM_MECHANICS_MATERIAL_STATUS.ready
        : MLS_MPM_MECHANICS_MATERIAL_STATUS.missingPhase
    });
  }
  return {
    schema: ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
    status: records.length ? 'mechanics-material-table-ready' : 'mechanics-material-table-empty',
    phaseRecordCount: records.length / MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS,
    recordLayout: [...SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT],
    recordStrideFloats: MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS,
    records: new Float32Array(records),
    metadata,
    soundSpeedScale,
    minGasSoundSpeedMPerS,
    viscosityEnabled,
    mlsMpmArtificialViscosityAlpha,
    viscosityLengthM,
    surfaceTensionEnabled,
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
}

export function findMechanicsMaterialPhaseRecord(table, materialId, phaseId) {
  if (table?.schema !== ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('Expected an MLS-MPM mechanics material table');
  }
  for (let index = 0; index < table.phaseRecordCount; index += 1) {
    const offset = index * MLS_MPM_MECHANICS_MATERIAL_PHASE_FLOATS;
    if (table.records[offset] === materialId && table.records[offset + 1] === phaseId) {
      return {
        restDensityKgPerM3: table.records[offset + 2],
        effectiveBulkModulusPa: table.records[offset + 3],
        shearModulusPa: table.records[offset + 4],
        lameLambdaPa: table.records[offset + 5],
        soundSpeedMPerS: table.records[offset + 6],
        eosModelId: table.records[offset + 7],
        solidFlag: table.records[offset + 8],
        status: table.records[offset + 9],
        dynamicViscosityPaS: table.records[offset + 10],
        surfaceTensionNPerM: table.records[offset + 11]
      };
    }
  }
  return {
    restDensityKgPerM3: 0,
    effectiveBulkModulusPa: 0,
    shearModulusPa: 0,
    lameLambdaPa: 0,
    soundSpeedMPerS: 0,
    eosModelId: MLS_MPM_EOS_MODEL_IDS.disabled,
    solidFlag: 0,
    status: MLS_MPM_MECHANICS_MATERIAL_STATUS.missingPhase,
    dynamicViscosityPaS: 0,
    surfaceTensionNPerM: 0
  };
}
