import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphReactionStepWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { GPU_PHASE_IDS, gpuPhaseId, requestOpticalGpuDevice, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  buildSphThermalClosureGraphBank,
  buildSphThermalClosureGraphBuffers,
  buildSphThermalPhaseResponseTable,
  destroySphThermalResponseGraphBuffers,
  resolveThermalStateFromGraphPhaseResponseCpu,
  uploadSphThermalResponseGraphBuffers,
  ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA
} from './sphThermalGpuKernel.js';

export {
  ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  sphReactionStepWgsl
};

export const SPH_REACTION_RECORD_FLOATS = SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length;
export const SPH_REACTION_PRODUCT_PHASE_FLOATS = SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length;

const REACTION_SCOPE = 'sph-reaction-mutual-contact-derived-network';
const REACTION_STATUS = Object.freeze({ ready: 1, missingProductMaterial: 255, invalidReaction: 254 });
const PRODUCT_PHASE_STATUS = Object.freeze({ ready: 1, missingPhase: 255 });
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const R_GAS = 8.314462618;
const DEFAULT_SOUND_SPEED_SCALE = 1;
const DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S = 40;
const MLS_MPM_EOS_MODEL_IDS = Object.freeze({
  disabled: 0,
  taitCondensed: 1,
  gasLinearized: 2
});

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

function assertPackedSphParticleState(sphParticleState) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH reaction GPU step requires a packed SPH GPU particle buffer');
  }
}

function assertPackedMlsMpmParticleState(mlsMpmParticleState) {
  if (mlsMpmParticleState?.schema !== ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH reaction GPU step requires a packed MLS-MPM GPU particle buffer');
  }
}

function assertReactionInputs({ sphParticleState, mlsMpmParticleState, reactionTable, thermalMaterialTable }) {
  assertPackedSphParticleState(sphParticleState);
  assertPackedMlsMpmParticleState(mlsMpmParticleState);
  if (sphParticleState.particleCount !== mlsMpmParticleState.particleCount) {
    throw new RangeError('SPH reaction step requires matching SPH and MLS-MPM particle counts');
  }
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('SPH reaction step requires a packed reaction table');
  }
  if (thermalMaterialTable?.schema !== ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA) {
    throw new TypeError('SPH reaction step requires a packed thermal material table');
  }
}

function assertOptionalThermalPhaseResponseTable(table) {
  if (table && table.schema !== ULG_SPH_GPU_THERMAL_PHASE_RESPONSE_TABLE_SCHEMA) {
    throw new TypeError('SPH reaction step requires a packed thermal phase-response table');
  }
}

function assertOptionalThermalResponseGraphUpload(upload) {
  if (upload && upload.schema !== ULG_SPH_GPU_THERMAL_RESPONSE_GRAPH_BUFFER_SET_SCHEMA) {
    throw new TypeError('SPH reaction step requires a packed thermal response/graph WebGPU buffer set');
  }
}

function materialPropertiesFor(material, materialProperties) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

function phaseMask(phases) {
  if (!phases || phases.length === 0) return 0;
  return phases.reduce((mask, phase) => {
    const id = gpuPhaseId(phase);
    return id > 0 ? (mask | (1 << id)) : mask;
  }, 0);
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
  const specificGasConstant = R_GAS / molarMassKgPerMol;
  const cp = finiteNumber(phase?.cpJPerKgK, 0);
  const gamma = cp > specificGasConstant ? cp / (cp - specificGasConstant) : 1.33;
  return Math.max(
    Math.sqrt(Math.max(gamma * specificGasConstant * phaseTemperatureK(phase), 0)) * soundSpeedScale,
    minGasSoundSpeedMPerS
  );
}

function phaseMechanicsRecord(material, properties, phase, options) {
  const materialId = stableOpticalMaterialId(material);
  const phaseId = gpuPhaseId(phase?.name);
  const restDensity = finiteNumber(phase?.densityKgPerM3, 0);
  const bulkRaw = finiteNumber(phase?.bulkModulusPa, 0);
  const shearRaw = phase?.name === 'solid' ? finiteNumber(phase?.shearModulusPa, 0) : 0;
  const soundSpeedScale = finiteNumber(options.soundSpeedScale, DEFAULT_SOUND_SPEED_SCALE);
  const modulusScale = soundSpeedScale * soundSpeedScale;
  const bulk = bulkRaw * modulusScale;
  const shear = shearRaw * modulusScale;
  const lambda = phase?.name === 'solid' ? Math.max((bulkRaw - (2 / 3) * shearRaw) * modulusScale, 0) : 0;
  const gas = phase?.name === 'gas';
  const soundSpeed = gas
    ? gasSoundSpeedMPerS(properties, phase, options)
    : (restDensity > 0 && bulk > 0 ? Math.sqrt(bulk / restDensity) : 0);
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
    phase?.name === 'solid' && shear > 0 ? 1 : 0,
    PRODUCT_PHASE_STATUS.ready,
    0,
    0
  ];
}

function appendProductPhaseRecords({
  product,
  materialProperties,
  productPhaseKeys,
  productPhaseRecords,
  metadata,
  options
}) {
  if (productPhaseKeys.has(product)) return;
  productPhaseKeys.add(product);
  const properties = materialPropertiesFor(product, materialProperties);
  if (!properties?.phases?.length) {
    metadata.push({
      material: product,
      materialId: stableOpticalMaterialId(product),
      status: PRODUCT_PHASE_STATUS.missingPhase,
      phaseCount: 0
    });
    return;
  }
  const phaseNames = [];
  for (const phase of properties.phases) {
    productPhaseRecords.push(...phaseMechanicsRecord(product, properties, phase, options));
    phaseNames.push(phase.name);
  }
  metadata.push({
    material: product,
    materialId: stableOpticalMaterialId(product),
    status: PRODUCT_PHASE_STATUS.ready,
    phaseCount: properties.phases.length,
    phaseNames
  });
}

export function buildSphReactionTable(reactions = [], {
  materialProperties = {},
  contactRadiusM = 0,
  soundSpeedScale = DEFAULT_SOUND_SPEED_SCALE,
  minGasSoundSpeedMPerS = DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S
} = {}) {
  const records = [];
  const metadata = [];
  const productPhaseRecords = [];
  const productPhaseMetadata = [];
  const productPhaseKeys = new Set();
  const options = { soundSpeedScale, minGasSoundSpeedMPerS };

  for (const reaction of reactions || []) {
    const a = reaction?.a;
    const b = reaction?.b;
    const product = reaction?.product;
    const aMaterialId = stableOpticalMaterialId(a);
    const bMaterialId = stableOpticalMaterialId(b);
    const productMaterialId = stableOpticalMaterialId(product);
    const productProperties = materialPropertiesFor(product, materialProperties);
    const activationTemperatureK = finiteNumber(reaction?.activationTemperatureK, 0);
    const specificEnthalpyJPerKg = finiteNumber(reaction?.specificEnthalpyJPerKg, 0);
    const radius = finiteNumber(reaction?.contactRadiusM ?? contactRadiusM, 0);
    const status = a && b && product && radius > 0 && productProperties?.phases?.length
      ? REACTION_STATUS.ready
      : (!productProperties?.phases?.length ? REACTION_STATUS.missingProductMaterial : REACTION_STATUS.invalidReaction);
    const phaseMaskA = phaseMask(reaction?.phaseRequirements?.[a]);
    const phaseMaskB = phaseMask(reaction?.phaseRequirements?.[b]);
    records.push(
      aMaterialId,
      bMaterialId,
      productMaterialId,
      activationTemperatureK,
      specificEnthalpyJPerKg,
      radius,
      phaseMaskA,
      phaseMaskB,
      status,
      0,
      0,
      0
    );
    metadata.push({
      a,
      b,
      product,
      aMaterialId,
      bMaterialId,
      productMaterialId,
      activationTemperatureK,
      specificEnthalpyJPerKg,
      contactRadiusM: radius,
      phaseMaskA,
      phaseMaskB,
      status,
      energyModel: reaction?.energyModel ?? null,
      activationModel: reaction?.activationModel ?? null
    });
    appendProductPhaseRecords({
      product,
      materialProperties,
      productPhaseKeys,
      productPhaseRecords,
      metadata: productPhaseMetadata,
      options
    });
  }

  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    status: records.length ? 'derived-reaction-table-ready' : 'no-derived-reactions',
    reactionCount: records.length / SPH_REACTION_RECORD_FLOATS,
    productPhaseCount: productPhaseRecords.length / SPH_REACTION_PRODUCT_PHASE_FLOATS,
    combinedRecordCount: (records.length + productPhaseRecords.length) / SPH_REACTION_RECORD_FLOATS,
    recordLayout: [...SPH_GPU_REACTION_RECORD_ROW_LAYOUT],
    productPhaseLayout: [...SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT],
    recordStrideFloats: SPH_REACTION_RECORD_FLOATS,
    productPhaseStrideFloats: SPH_REACTION_PRODUCT_PHASE_FLOATS,
    records: new Float32Array(records),
    productPhaseRecords: new Float32Array(productPhaseRecords),
    combinedRecords: new Float32Array([...records, ...productPhaseRecords]),
    metadata,
    productPhaseMetadata,
    scientificValidation: false,
    materialValidation: false,
    chemistryValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function reactionRecord(table, index) {
  const offset = index * SPH_REACTION_RECORD_FLOATS;
  return {
    aMaterialId: table.records[offset],
    bMaterialId: table.records[offset + 1],
    productMaterialId: table.records[offset + 2],
    activationTemperatureK: table.records[offset + 3],
    specificEnthalpyJPerKg: table.records[offset + 4],
    contactRadiusM: table.records[offset + 5],
    phaseMaskA: table.records[offset + 6],
    phaseMaskB: table.records[offset + 7],
    status: table.records[offset + 8]
  };
}

function productPhaseRecord(table, materialId, phaseId) {
  for (let index = 0; index < table.productPhaseCount; index += 1) {
    const offset = index * SPH_REACTION_PRODUCT_PHASE_FLOATS;
    if (table.productPhaseRecords[offset] === materialId && table.productPhaseRecords[offset + 1] === phaseId) {
      return {
        restDensityKgPerM3: table.productPhaseRecords[offset + 2],
        effectiveBulkModulusPa: table.productPhaseRecords[offset + 3],
        shearModulusPa: table.productPhaseRecords[offset + 4],
        lameLambdaPa: table.productPhaseRecords[offset + 5],
        soundSpeedMPerS: table.productPhaseRecords[offset + 6],
        eosModelId: table.productPhaseRecords[offset + 7],
        solidFlag: table.productPhaseRecords[offset + 8],
        status: table.productPhaseRecords[offset + 9]
      };
    }
  }
  return {
    restDensityKgPerM3: 0,
    effectiveBulkModulusPa: 0,
    shearModulusPa: 0,
    lameLambdaPa: 0,
    soundSpeedMPerS: 0,
    eosModelId: 0,
    solidFlag: 0,
    status: PRODUCT_PHASE_STATUS.missingPhase
  };
}

function phaseMaskSatisfied(mask, phaseId) {
  const integerMask = Math.round(finiteNumber(mask, 0));
  if (integerMask === 0) return true;
  const id = Math.round(finiteNumber(phaseId, GPU_PHASE_IDS.unknown));
  return id >= 0 && (integerMask & (1 << id)) !== 0;
}

function writeResolvedThermoRow(thermo, index, materialId, resolved, sourceThermo2) {
  const offset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
  thermo[offset] = materialId;
  thermo[offset + 1] = resolved.phaseId;
  thermo[offset + 2] = resolved.temperatureK;
  thermo[offset + 3] = resolved.restDensityKgPerM3;
  thermo[offset + 4] = resolved.phaseFractions.solid;
  thermo[offset + 5] = resolved.phaseFractions.liquid;
  thermo[offset + 6] = resolved.phaseFractions.gas;
  thermo[offset + 7] = resolved.phaseFractions.plasma;
  thermo[offset + 8] = sourceThermo2[0];
  thermo[offset + 9] = sourceThermo2[1];
  thermo[offset + 10] = resolved.status;
  thermo[offset + 11] = 0;
}

function resetMechanicsForProduct(mechanics, index, massKg, resolved, productMechanics) {
  const offset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  const restDensity = resolved.restDensityKgPerM3 > 0
    ? resolved.restDensityKgPerM3
    : productMechanics.restDensityKgPerM3;
  mechanics.set([
    1, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 1, restDensity > 0 ? massKg / restDensity : 0,
    productMechanics.solidFlag,
    productMechanics.status,
    productMechanics.effectiveBulkModulusPa,
    productMechanics.shearModulusPa,
    productMechanics.lameLambdaPa,
    productMechanics.soundSpeedMPerS,
    productMechanics.eosModelId,
    productMechanics.status,
    0,
    0,
    0,
    0
  ], offset);
}

function findBestProposal(index, sphParticleState, reactionTable) {
  const state = sphParticleState.state;
  const thermo = sphParticleState.thermo;
  const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
  const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
  const materialId = thermo[thermoOffset];
  const phaseId = thermo[thermoOffset + 1];
  const temperatureK = thermo[thermoOffset + 2];
  const x = state[stateOffset];
  const y = state[stateOffset + 1];
  const z = state[stateOffset + 2];
  let bestPartner = -1;
  let bestReaction = -1;
  let bestRole = 0;
  let bestDistance2 = Number.POSITIVE_INFINITY;

  for (let reactionIndex = 0; reactionIndex < reactionTable.reactionCount; reactionIndex += 1) {
    const rx = reactionRecord(reactionTable, reactionIndex);
    if (Math.round(rx.status) !== REACTION_STATUS.ready) continue;
    let partnerMaterialId = null;
    let partnerPhaseMask = 0;
    let role = 0;
    if (materialId === rx.aMaterialId && phaseMaskSatisfied(rx.phaseMaskA, phaseId)) {
      partnerMaterialId = rx.bMaterialId;
      partnerPhaseMask = rx.phaseMaskB;
      role = 1;
    } else if (materialId === rx.bMaterialId && phaseMaskSatisfied(rx.phaseMaskB, phaseId)) {
      partnerMaterialId = rx.aMaterialId;
      partnerPhaseMask = rx.phaseMaskA;
      role = 2;
    } else {
      continue;
    }
    const radius2 = rx.contactRadiusM * rx.contactRadiusM;
    for (let other = 0; other < sphParticleState.particleCount; other += 1) {
      if (other === index) continue;
      const otherThermoOffset = other * SPH_GPU_PARTICLE_THERMO_FLOATS;
      if (thermo[otherThermoOffset] !== partnerMaterialId) continue;
      if (!phaseMaskSatisfied(partnerPhaseMask, thermo[otherThermoOffset + 1])) continue;
      if (Math.max(temperatureK, thermo[otherThermoOffset + 2]) < rx.activationTemperatureK) continue;
      const otherStateOffset = other * SPH_GPU_PARTICLE_STATE_FLOATS;
      const dx = x - state[otherStateOffset];
      const dy = y - state[otherStateOffset + 1];
      const dz = z - state[otherStateOffset + 2];
      const distance2 = dx * dx + dy * dy + dz * dz;
      if (distance2 > radius2) continue;
      if (distance2 < bestDistance2 || (distance2 === bestDistance2 && (bestPartner < 0 || other < bestPartner))) {
        bestPartner = other;
        bestReaction = reactionIndex;
        bestRole = role;
        bestDistance2 = distance2;
      }
    }
  }
  return [bestPartner, bestReaction, bestRole, bestDistance2];
}

function outputEnvelope({
  backend,
  sphParticleState,
  mlsMpmParticleState,
  reactionTable,
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null,
  thermalResponseGraphUpload = null,
  state,
  thermo,
  mechanics,
  proposals,
  eventCount,
  conversionCount,
  stateBuffer = null,
  thermoBuffer = null,
  mechanicsBuffer = null,
  stateBufferByteLength = state.byteLength,
  thermoBufferByteLength = thermo.byteLength,
  mechanicsBufferByteLength = mechanics.byteLength,
  retainedOutputParticleBuffers = false,
  destroyOutputParticleBuffers = null,
  readbackMode = FULL_READBACK_MODE
}) {
  return {
    schema: ULG_SPH_GPU_REACTION_STEP_SCHEMA,
    backend,
    status: 'reaction-step-executed',
    kernelScope: REACTION_SCOPE,
    sourceSchema: sphParticleState.schema,
    sourceMechanicsSchema: mlsMpmParticleState.schema,
    reactionTableSchema: reactionTable.schema,
    thermalMaterialTableSchema: thermalMaterialTable.schema,
    thermalClosureGraphSetSchema: thermalClosureGraphSet?.schema ?? null,
    thermalClosureGraphBankSchema: thermalClosureGraphBank?.schema ?? null,
    thermalPhaseResponseTableSchema: thermalPhaseResponseTable?.schema ?? null,
    thermalResponseGraphBufferSetSchema: thermalResponseGraphUpload?.schema ?? null,
    thermalResponseGraphBufferMode: thermalResponseGraphUpload
      ? (thermalResponseGraphUpload.borrowed ? 'borrowed-webgpu-upload' : 'temporary-webgpu-upload')
      : null,
    particleCount: sphParticleState.particleCount,
    reactionCount: reactionTable.reactionCount,
    productPhaseCount: reactionTable.productPhaseCount,
    materialCount: thermalMaterialTable.materialCount,
    segmentCount: thermalMaterialTable.segmentCount,
    responseCount: thermalPhaseResponseTable?.responseCount ?? null,
    thermalGraphCount: thermalClosureGraphBank?.graphCount ?? thermalClosureGraphSet?.graphCount ?? null,
    thermalResponseGraphBufferResponseByteLength: thermalResponseGraphUpload?.responseBufferByteLength ?? null,
    thermalResponseGraphBufferSampleByteLength: thermalResponseGraphUpload?.graphSampleBufferByteLength ?? null,
    sourceStep: sphParticleState.step ?? 0,
    step: (sphParticleState.step ?? 0) + 1,
    sourceTime: sphParticleState.time ?? 0,
    time: sphParticleState.time ?? 0,
    stateLayout: [...SPH_GPU_PARTICLE_STATE_ROW_LAYOUT],
    thermoLayout: [...SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT],
    mechanicsLayout: [...MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT],
    reactionRecordLayout: [...SPH_GPU_REACTION_RECORD_ROW_LAYOUT],
    productPhaseLayout: [...SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT],
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    mechanicsStrideFloats: MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
    state,
    thermo,
    mechanics,
    proposals,
    eventCount,
    conversionCount,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    stateBufferByteLength,
    thermoBufferByteLength,
    mechanicsBufferByteLength,
    retainedOutputParticleBuffers,
    destroyOutputParticleBuffers,
    readbackMode,
    fullReadbackPerformed: readbackMode !== NO_FULL_READBACK_MODE,
    normalHotLoopReadbackFree: readbackMode === NO_FULL_READBACK_MODE,
    scientificValidation: false,
    materialValidation: false,
    chemistryValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function runSphReactionStepCpu({
  sphParticleState,
  mlsMpmParticleState,
  reactionTable,
  thermalMaterialTable,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null
} = {}) {
  assertReactionInputs({ sphParticleState, mlsMpmParticleState, reactionTable, thermalMaterialTable });
  assertOptionalThermalPhaseResponseTable(thermalPhaseResponseTable);
  const resolvedGraphSet = thermalClosureGraphSet || buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const resolvedGraphBank = thermalClosureGraphBank || resolvedGraphSet.graphBank || buildSphThermalClosureGraphBank(resolvedGraphSet);
  const resolvedPhaseResponseTable = thermalPhaseResponseTable || buildSphThermalPhaseResponseTable(thermalMaterialTable, resolvedGraphSet);
  const state = new Float32Array(sphParticleState.state);
  const thermo = new Float32Array(sphParticleState.thermo);
  const mechanics = new Float32Array(mlsMpmParticleState.mechanics);
  const proposals = new Float32Array(sphParticleState.particleCount * 4);
  let conversionCount = 0;

  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    proposals.set(findBestProposal(index, sphParticleState, reactionTable), index * 4);
  }

  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    const proposalOffset = index * 4;
    const partner = proposals[proposalOffset];
    const reactionIndex = proposals[proposalOffset + 1];
    if (partner < 0 || reactionIndex < 0) continue;
    const partnerIndex = Math.round(partner);
    if (partnerIndex < 0 || partnerIndex >= sphParticleState.particleCount) continue;
    const partnerOffset = partnerIndex * 4;
    if (Math.round(proposals[partnerOffset]) !== index || proposals[partnerOffset + 1] !== reactionIndex) continue;
    const rx = reactionRecord(reactionTable, Math.round(reactionIndex));
    const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
    const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
    const nextU = sphParticleState.state[stateOffset + 7] - rx.specificEnthalpyJPerKg;
    state[stateOffset + 7] = nextU;
    const resolved = resolveThermalStateFromGraphPhaseResponseCpu({
      graphSet: resolvedGraphSet,
      responseTable: resolvedPhaseResponseTable,
      materialId: rx.productMaterialId,
      specificInternalEnergyJPerKg: nextU
    });
    writeResolvedThermoRow(thermo, index, rx.productMaterialId, resolved, [
      sphParticleState.thermo[thermoOffset + 8],
      sphParticleState.thermo[thermoOffset + 9]
    ]);
    resetMechanicsForProduct(
      mechanics,
      index,
      sphParticleState.state[stateOffset + 3],
      resolved,
      productPhaseRecord(reactionTable, rx.productMaterialId, resolved.phaseId)
    );
    conversionCount += 1;
  }

  return outputEnvelope({
    backend: 'cpu-reference',
    sphParticleState,
    mlsMpmParticleState,
    reactionTable,
    thermalMaterialTable,
    thermalClosureGraphSet: resolvedGraphSet,
    thermalClosureGraphBank: resolvedGraphBank,
    thermalPhaseResponseTable: resolvedPhaseResponseTable,
    state,
    thermo,
    mechanics,
    proposals,
    conversionCount,
    eventCount: conversionCount / 2
  });
}

function writeStorageBuffer(device, label, data, extraUsage = 0) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST | extraUsage
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createParamsArray({
  particleCount,
  reactionCount,
  productPhaseCount,
  materialCount,
  segmentCount,
  resetMechanics
}) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, reactionCount, true);
  view.setUint32(8, productPhaseCount, true);
  view.setUint32(12, materialCount, true);
  view.setUint32(16, segmentCount, true);
  view.setUint32(20, resetMechanics ? 1 : 0, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);
  return buffer;
}

async function readBuffer(device, sourceBuffer, byteLength, label) {
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

export async function runSphReactionStepWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  reactionTable,
  thermalMaterialTable,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  sourceMechanicsBuffer = null,
  thermalClosureGraphSet = null,
  thermalClosureGraphBank = null,
  thermalPhaseResponseTable = null,
  thermalResponseGraphUpload = null,
  retainOutputParticleBuffers = false,
  resetMechanics = true,
  readbackMode = FULL_READBACK_MODE
} = {}) {
  assertReactionInputs({ sphParticleState, mlsMpmParticleState, reactionTable, thermalMaterialTable });
  assertOptionalThermalPhaseResponseTable(thermalPhaseResponseTable);
  assertOptionalThermalResponseGraphUpload(thermalResponseGraphUpload);
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphReactionStepWebGpu requires a WebGPU-like device');
  }
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE;
  const borrowedStateBuffer = sourceStateBuffer || sphParticleUpload?.stateBuffer || null;
  const borrowedThermoBuffer = sourceThermoBuffer || sphParticleUpload?.thermoBuffer || null;
  const borrowedMechanicsBuffer = sourceMechanicsBuffer || mlsMpmParticleUpload?.mechanicsBuffer || null;
  const stateBuffer = borrowedStateBuffer || writeStorageBuffer(device, 'ulg-sph-reaction-source-state', sphParticleState.state);
  const thermoBuffer = borrowedThermoBuffer || writeStorageBuffer(device, 'ulg-sph-reaction-source-thermo', sphParticleState.thermo);
  const mechanicsBuffer = borrowedMechanicsBuffer || writeStorageBuffer(device, 'ulg-sph-reaction-source-mechanics', mlsMpmParticleState.mechanics);
  const resolvedGraphSet = thermalClosureGraphSet || buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const resolvedGraphBank = thermalClosureGraphBank || resolvedGraphSet.graphBank || buildSphThermalClosureGraphBank(resolvedGraphSet);
  const resolvedPhaseResponseTable = thermalPhaseResponseTable || buildSphThermalPhaseResponseTable(thermalMaterialTable, resolvedGraphSet);
  const borrowedResponseGraphUpload = thermalResponseGraphUpload?.status === 'webgpu-uploaded'
    ? { ...thermalResponseGraphUpload, borrowed: true }
    : null;
  const localResponseGraphUpload = borrowedResponseGraphUpload
    ? null
    : uploadSphThermalResponseGraphBuffers(device, {
      thermalMaterialTable,
      thermalClosureGraphSet: resolvedGraphSet,
      thermalClosureGraphBank: resolvedGraphBank,
      thermalPhaseResponseTable: resolvedPhaseResponseTable
    });
  const responseGraphUpload = borrowedResponseGraphUpload || localResponseGraphUpload;
  const reactionRecordBuffer = writeStorageBuffer(
    device,
    'ulg-sph-reaction-records-and-product-phases',
    reactionTable.combinedRecords || new Float32Array([...reactionTable.records, ...reactionTable.productPhaseRecords])
  );
  const phaseResponseRecordBuffer = responseGraphUpload.responseRecordBuffer;
  const phaseResponseBuffer = responseGraphUpload.responseBuffer;
  const graphNodeBuffer = responseGraphUpload.graphNodeBuffer;
  const graphSampleBuffer = responseGraphUpload.graphSampleBuffer;
  const proposalBuffer = writeStorageBuffer(
    device,
    'ulg-sph-reaction-proposals',
    new Float32Array(sphParticleState.particleCount * 4),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const outStateBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-output-state', new Float32Array(sphParticleState.state.length), GPU_BUFFER_USAGE.COPY_SRC);
  const outThermoBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-output-thermo', new Float32Array(sphParticleState.thermo.length), GPU_BUFFER_USAGE.COPY_SRC);
  const outMechanicsBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-output-mechanics', new Float32Array(mlsMpmParticleState.mechanics.length), GPU_BUFFER_USAGE.COPY_SRC);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-reaction-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    reactionCount: reactionTable.reactionCount,
    productPhaseCount: reactionTable.productPhaseCount,
    materialCount: resolvedPhaseResponseTable.materialCount,
    segmentCount: resolvedPhaseResponseTable.responseCount,
    resetMechanics
  }));

  const module = device.createShaderModule({ label: 'ulg-sph-reaction-step', code: sphReactionStepWgsl });
  const reactionBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(11, 'uniform')
  ];
  const reactionResolveBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'read-only-storage'),
    computeBufferBinding(13, 'read-only-storage')
  ];
  const { pipeline: proposePipeline, bindGroupLayout: proposeBindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-reaction-propose',
    module,
    entryPoint: 'propose',
    bindings: reactionBindings
  });
  const { pipeline: resolvePipeline, bindGroupLayout: resolveBindGroupLayout } = createExplicitComputePipeline(device, {
    label: 'ulg-sph-reaction-resolve',
    module,
    entryPoint: 'resolve',
    bindings: reactionResolveBindings
  });
  const proposeBindEntries = (layout) => ({
    layout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 3, resource: { buffer: reactionRecordBuffer } },
      { binding: 7, resource: { buffer: proposalBuffer } },
      { binding: 11, resource: { buffer: paramsBuffer } }
    ]
  });
  const resolveBindEntries = (layout) => ({
    layout,
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: thermoBuffer } },
      { binding: 2, resource: { buffer: mechanicsBuffer } },
      { binding: 3, resource: { buffer: reactionRecordBuffer } },
      { binding: 5, resource: { buffer: phaseResponseRecordBuffer } },
      { binding: 6, resource: { buffer: phaseResponseBuffer } },
      { binding: 7, resource: { buffer: proposalBuffer } },
      { binding: 8, resource: { buffer: outStateBuffer } },
      { binding: 9, resource: { buffer: outThermoBuffer } },
      { binding: 10, resource: { buffer: outMechanicsBuffer } },
      { binding: 11, resource: { buffer: paramsBuffer } },
      { binding: 12, resource: { buffer: graphNodeBuffer } },
      { binding: 13, resource: { buffer: graphSampleBuffer } }
    ]
  });
  const proposeBindGroup = device.createBindGroup(proposeBindEntries(proposeBindGroupLayout));
  const resolveBindGroup = device.createBindGroup(resolveBindEntries(resolveBindGroupLayout));
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(proposePipeline);
  pass.setBindGroup(0, proposeBindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.setPipeline(resolvePipeline);
  pass.setBindGroup(0, resolveBindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.end();
  device.queue.submit([encoder.finish()]);

  let state = new Float32Array();
  let thermo = new Float32Array();
  let mechanics = new Float32Array();
  let proposals = new Float32Array();
  if (!noFullReadback) {
    const [stateBytes, thermoBytes, mechanicsBytes, proposalBytes] = await Promise.all([
      readBuffer(device, outStateBuffer, sphParticleState.state.byteLength, 'ulg-sph-reaction-state-readback'),
      readBuffer(device, outThermoBuffer, sphParticleState.thermo.byteLength, 'ulg-sph-reaction-thermo-readback'),
      readBuffer(device, outMechanicsBuffer, mlsMpmParticleState.mechanics.byteLength, 'ulg-sph-reaction-mechanics-readback'),
      readBuffer(device, proposalBuffer, sphParticleState.particleCount * 4 * Float32Array.BYTES_PER_ELEMENT, 'ulg-sph-reaction-proposal-readback')
    ]);
    state = new Float32Array(stateBytes);
    thermo = new Float32Array(thermoBytes);
    mechanics = new Float32Array(mechanicsBytes);
    proposals = new Float32Array(proposalBytes);
  } else if (device.queue?.onSubmittedWorkDone) {
    await device.queue.onSubmittedWorkDone();
  }

  if (!borrowedStateBuffer) stateBuffer.destroy?.();
  if (!borrowedThermoBuffer) thermoBuffer.destroy?.();
  if (!borrowedMechanicsBuffer) mechanicsBuffer.destroy?.();
  for (const buffer of [
    reactionRecordBuffer,
    proposalBuffer,
    paramsBuffer
  ]) {
    buffer.destroy?.();
  }
  if (localResponseGraphUpload) destroySphThermalResponseGraphBuffers(localResponseGraphUpload);
  if (!retainOutputParticleBuffers) {
    outStateBuffer.destroy?.();
    outThermoBuffer.destroy?.();
    outMechanicsBuffer.destroy?.();
  }

  return outputEnvelope({
    backend: 'webgpu',
    sphParticleState,
    mlsMpmParticleState,
    reactionTable,
    thermalMaterialTable,
    thermalClosureGraphSet: resolvedGraphSet,
    thermalClosureGraphBank: resolvedGraphBank,
    thermalPhaseResponseTable: resolvedPhaseResponseTable,
    thermalResponseGraphUpload: responseGraphUpload,
    state,
    thermo,
    mechanics,
    proposals,
    eventCount: null,
    conversionCount: null,
    stateBuffer: retainOutputParticleBuffers ? outStateBuffer : null,
    thermoBuffer: retainOutputParticleBuffers ? outThermoBuffer : null,
    mechanicsBuffer: retainOutputParticleBuffers ? outMechanicsBuffer : null,
    stateBufferByteLength: sphParticleState.state.byteLength,
    thermoBufferByteLength: sphParticleState.thermo.byteLength,
    mechanicsBufferByteLength: mlsMpmParticleState.mechanics.byteLength,
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
    destroyOutputParticleBuffers: retainOutputParticleBuffers
      ? () => {
        outStateBuffer.destroy?.();
        outThermoBuffer.destroy?.();
        outMechanicsBuffer.destroy?.();
      }
      : null,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE
  });
}

function createNoFullReadbackParityReport(tolerance = 2e-3) {
  return {
    schema: ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
    status: 'not-run-no-full-readback',
    tolerance,
    maxStateAbs: null,
    maxThermoAbs: null,
    maxMechanicsAbs: null,
    maxProposalAbs: null,
    lengthMismatch: null,
    reason: 'Full reaction particle readback and CPU parity were skipped for resident WebGPU execution',
    scientificValidation: false,
    materialValidation: false,
    chemistryValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function compareSphReactionStepParity(cpuResult, gpuResult, { tolerance = 2e-3 } = {}) {
  if (!cpuResult || !gpuResult) {
    return { schema: ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA, status: 'fail', reason: 'missing result', scientificValidation: false, chemistryValidation: false, phaseChangeValidation: false, fullPhysicsValidation: false };
  }
  const pairs = [
    ['state', 'maxStateAbs'],
    ['thermo', 'maxThermoAbs'],
    ['mechanics', 'maxMechanicsAbs'],
    ['proposals', 'maxProposalAbs']
  ];
  const report = {
    schema: ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
    status: 'pass',
    tolerance,
    maxStateAbs: 0,
    maxThermoAbs: 0,
    maxMechanicsAbs: 0,
    maxProposalAbs: 0,
    lengthMismatch: false,
    scientificValidation: false,
    materialValidation: false,
    chemistryValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  for (const [key, maxKey] of pairs) {
    if (cpuResult[key].length !== gpuResult[key].length) {
      report.lengthMismatch = true;
      report[maxKey] = Number.POSITIVE_INFINITY;
      report.status = 'fail';
      continue;
    }
    for (let index = 0; index < cpuResult[key].length; index += 1) {
      report[maxKey] = Math.max(report[maxKey], Math.abs(cpuResult[key][index] - gpuResult[key][index]));
    }
    if (report[maxKey] > tolerance) report.status = 'fail';
  }
  if (report.lengthMismatch) report.status = 'fail';
  return report;
}

export async function runSphReactionStepWithOptionalWebGpu({
  preferWebGpu = false,
  navigatorRef = globalThis.navigator,
  device = null,
  deviceResult = null,
  webGpuRunner = runSphReactionStepWebGpu,
  parityTolerance = 2e-3,
  readbackMode = FULL_READBACK_MODE,
  ...args
} = {}) {
  const cpuReference = runSphReactionStepCpu(args);
  if (!preferWebGpu) {
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'not-requested' },
      scientificValidation: false,
      materialValidation: false,
      chemistryValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  const resolvedDevice = device || deviceResult?.device || navigatorRef?.gpu?.device || null;
  const resolvedDeviceResult = resolvedDevice
    ? { status: 'webgpu-device-ready', device: resolvedDevice }
    : (deviceResult || await requestOpticalGpuDevice(navigatorRef));
  if (!resolvedDeviceResult?.device) {
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: resolvedDeviceResult?.reason || 'webgpu device unavailable' },
      scientificValidation: false,
      materialValidation: false,
      chemistryValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
  try {
    const webgpu = await webGpuRunner({
      ...args,
      device: resolvedDeviceResult.device,
      readbackMode
    });
    const parity = webgpu.readbackMode === NO_FULL_READBACK_MODE
      ? createNoFullReadbackParityReport(parityTolerance)
      : compareSphReactionStepParity(cpuReference, webgpu, { tolerance: parityTolerance });
    if (parity.status === 'pass' || parity.status === 'not-run-no-full-readback') {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: parity.status === 'pass' ? 'webgpu-accepted' : 'webgpu-accepted-no-full-readback',
        cpuReference,
        webgpu,
        result: webgpu,
        webgpuParity: parity,
        webgpuStatus: { status: 'webgpu-executed' },
        scientificValidation: false,
        materialValidation: false,
        chemistryValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-parity-failed-cpu-reference',
      cpuReference,
      webgpu,
      result: cpuReference,
      webgpuParity: parity,
      webgpuStatus: { status: 'fallback-cpu', reason: 'reaction parity failed' },
      scientificValidation: false,
      materialValidation: false,
      chemistryValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference,
      result: cpuReference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      scientificValidation: false,
      materialValidation: false,
      chemistryValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}
