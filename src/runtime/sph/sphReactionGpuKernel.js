import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT,
  SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT,
  SCHROEDER_LAW_QUEUE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT,
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_REACTION_CLOSURE_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA,
  ULG_SCHROEDER_LAW_QUEUE_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import { sphReactionStepWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { GPU_PHASE_IDS, gpuPhaseId, requestOpticalGpuDevice, stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { describeChemicalFormula } from '../chemistry/formula.js';
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
import {
  createResidentProductMassHandle,
  runSphReactionSummaryWebGpu
} from './sphReactionGpuSummary.js';

export {
  ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_PARITY_SCHEMA,
  ULG_SPH_GPU_REACTION_STEP_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  sphReactionStepWgsl
};

export const SPH_REACTION_RECORD_FLOATS = SPH_GPU_REACTION_RECORD_ROW_LAYOUT.length;
export const SPH_REACTION_HEADER_FLOATS = SPH_GPU_REACTION_HEADER_ROW_LAYOUT.length;
export const SPH_REACTION_REACTANT_TERM_FLOATS = SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT.length;
export const SPH_REACTION_PRODUCT_TERM_FLOATS = SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT.length;
export const SPH_REACTION_GAS_PRODUCT_FLOATS = SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT.length;
export const SPH_REACTION_ATOM_TERM_FLOATS = SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length;
export const SPH_REACTION_PRODUCT_PHASE_FLOATS = SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT.length;
const SPH_REACTION_PACKED_PARTICLE_VEC4S = 13;
const SPH_REACTION_PACKED_PARTICLE_FLOATS = SPH_REACTION_PACKED_PARTICLE_VEC4S * 4;

const REACTION_SCOPE = 'sph-reaction-mutual-contact-derived-network';
const REACTION_STATUS = Object.freeze({ ready: 1, missingProductMaterial: 255, invalidReaction: 254 });
const PRODUCT_PHASE_STATUS = Object.freeze({ ready: 1, missingPhase: 255 });
const REACTION_TERM_STATUS = Object.freeze({ ready: 1, missingMaterialProperties: 255 });
const REACTION_PRODUCT_ROUTING = Object.freeze({ condensed: 0, gas: 1 });
const REACTION_PRESSURE_ROUTING = Object.freeze({ sealedBoxGasInventory: 1 });
const REACTION_ROLE_IDS = Object.freeze({ a: 1, b: 2, other: 3 });
const REACTION_ATOM_TERM_KIND_IDS = Object.freeze({ reactant: 1, product: 2 });
const FULL_READBACK_MODE = 'full-parity-readback';
const NO_FULL_READBACK_MODE = 'no-full-readback';
const R_GAS = 8.314462618;
const DEFAULT_SOUND_SPEED_SCALE = 1;
const DEFAULT_MIN_GAS_SOUND_SPEED_M_PER_S = 40;
const DEFAULT_REACTION_PARTICLE_BIN_CAPACITY = 64;
const REACTION_PARTICLE_BIN_CAPACITY_OCCUPANCY_MULTIPLIER = 4;
const REACTION_PARTICLE_BIN_INDEX_BUFFER_BUDGET_BYTES = 128 * 1024 * 1024;
const REACTION_PARTICLE_BIN_GRID_MAX_AXIS_CELLS = 64;
const REACTION_PARTICLE_BIN_GRID_MAX_CELL_COUNT = REACTION_PARTICLE_BIN_GRID_MAX_AXIS_CELLS ** 3;
const SCHROEDER_REACTION_LAW_MASK = 1;
const SCHROEDER_REACTION_LAW_NEIGHBOR_CANDIDATE_FLOATS = SCHROEDER_LAW_NEIGHBOR_CANDIDATE_ROW_LAYOUT.length;
const SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS = SCHROEDER_LAW_NEIGHBOR_SOURCE_SPAN_ROW_LAYOUT.length;
const SCHROEDER_REACTION_LAW_QUEUE_FLOATS = SCHROEDER_LAW_QUEUE_ROW_LAYOUT.length;
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

function clampPositive(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function vector3From(value, fallback = [0, 0, 0]) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return [
      finiteNumber(value[0], fallback[0] ?? 0),
      finiteNumber(value[1], fallback[1] ?? 0),
      finiteNumber(value[2], fallback[2] ?? 0)
    ];
  }
  if (value && typeof value === 'object') {
    return [
      finiteNumber(value.x ?? value.width, fallback[0] ?? 0),
      finiteNumber(value.y ?? value.height, fallback[1] ?? 0),
      finiteNumber(value.z ?? value.depth, fallback[2] ?? 0)
    ];
  }
  return [...fallback];
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

function normalizeFormulaKey(formula) {
  return String(formula || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function materialKeyForTerm(term, materialProperties = {}, fallback = null) {
  const candidates = [
    term?.material,
    term?.product,
    term?.key,
    normalizeFormulaKey(term?.formula),
    typeof term?.formula === 'string' ? term.formula.toLowerCase() : null,
    term?.formula,
    fallback
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (materialProperties[candidate]) return candidate;
    const lower = String(candidate).toLowerCase();
    if (materialProperties[lower]) return lower;
  }
  return candidates[0] || null;
}

function termCoefficient(term) {
  const coefficient = finiteNumber(term?.coefficient, 1);
  return coefficient > 0 ? coefficient : 1;
}

function termMolarMassKgPerMol(term, materialProperties = {}) {
  const properties = materialPropertiesFor(term?.material, materialProperties);
  const molarMass = finiteNumber(properties?.molarMassKgPerMol, 0);
  return molarMass > 0 ? molarMass : 0;
}

function productTermsForReaction(reaction, materialProperties = {}) {
  const sourceTerms = reaction?.stoichiometry?.products?.length
    ? reaction.stoichiometry.products
    : [{ coefficient: 1, formula: reaction?.product, material: reaction?.product }];
  return sourceTerms
    .map((term) => ({
      ...term,
      coefficient: termCoefficient(term),
      material: materialKeyForTerm(term, materialProperties, reaction?.product)
    }))
    .filter((term) => term.material);
}

function reactantTermsForReaction(reaction, materialProperties = {}) {
  const fallback = [
    { coefficient: 1, formula: reaction?.a, material: reaction?.a, role: 'a' },
    { coefficient: 1, formula: reaction?.b, material: reaction?.b, role: 'b' }
  ].filter((term) => term.material);
  const sourceTerms = reaction?.stoichiometry?.reactants?.length ? reaction.stoichiometry.reactants : fallback;
  return sourceTerms
    .map((term, index) => {
      const fallbackMaterial = index === 0 ? reaction?.a : index === 1 ? reaction?.b : null;
      const material = materialKeyForTerm(term, materialProperties, fallbackMaterial);
      const normalized = normalizeFormulaKey(term?.formula || material);
      const role = normalized === normalizeFormulaKey(reaction?.a)
        ? 'a'
        : normalized === normalizeFormulaKey(reaction?.b)
          ? 'b'
          : index === 0
            ? 'a'
            : index === 1
              ? 'b'
              : 'other';
      return {
        ...term,
        material,
        role,
        coefficient: termCoefficient(term)
      };
    })
    .filter((term) => term.material);
}

function productMassFractions(productTerms, materialProperties = {}) {
  const weighted = productTerms.map((term) => {
    const molarMassKgPerMol = termMolarMassKgPerMol(term, materialProperties);
    return {
      ...term,
      molarMassKgPerMol,
      massWeight: molarMassKgPerMol > 0 ? term.coefficient * molarMassKgPerMol : 0
    };
  });
  const total = weighted.reduce((sum, term) => sum + term.massWeight, 0);
  const fallbackFraction = weighted.length ? 1 / weighted.length : 0;
  return weighted.map((term) => ({
    ...term,
    massFraction: total > 0 ? term.massWeight / total : fallbackFraction
  }));
}

function termPhaseMask(term, reaction) {
  return phaseMask(reaction?.phaseRequirements?.[term?.material])
    || phaseMask(reaction?.phaseRequirements?.[String(term?.material || '').toLowerCase()])
    || phaseMask(reaction?.phaseRequirements?.[term?.formula]);
}

function termIsGas(term, materialProperties = {}) {
  const properties = materialPropertiesFor(term?.material, materialProperties);
  const phases = properties?.phases || [];
  const gasOnlyMaterial = phases.length > 0 && phases.every((phase) => phase?.name === 'gas');
  return gasOnlyMaterial
    || String(term?.phase || '').toLowerCase() === 'gas'
    || String(term?.targetPhase || '').toLowerCase() === 'gas'
    || String(term?.routing || '').toLowerCase() === 'gas';
}

function atomEntriesForTerm(term) {
  const atomCounts = term?.atomCounts || (() => {
    try {
      return describeChemicalFormula(term?.formula || term?.material).atomCounts;
    } catch {
      return null;
    }
  })();
  return Object.entries(atomCounts || {})
    .map(([Z, count]) => ({ Z: Number(Z), count: finiteNumber(count, 0) }))
    .filter((entry) => Number.isFinite(entry.Z) && entry.Z > 0 && entry.count > 0)
    .sort((left, right) => left.Z - right.Z);
}

function productPhaseRangeFor(productPhaseMetadata, material) {
  const materialId = stableOpticalMaterialId(material);
  let offset = 0;
  for (const item of productPhaseMetadata || []) {
    if (item.materialId === materialId) {
      return {
        offset,
        count: item.phaseCount || 0
      };
    }
    offset += item.phaseCount || 0;
  }
  return { offset: 0, count: 0 };
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
  const viscosityEnabled = Boolean(options.viscosityEnabled);
  const dynamicViscosityPaS = viscosityEnabled
    ? Math.max(finiteNumber(phase?.dynamicViscosityPaS, 0), 0)
    : 0;
  const surfaceTensionNPerM = options.surfaceTensionEnabled
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
    phase?.name === 'solid' && shear > 0 ? 1 : 0,
    PRODUCT_PHASE_STATUS.ready,
    dynamicViscosityPaS,
    surfaceTensionNPerM
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
  const reactionHeaders = [];
  const reactantTermRecords = [];
  const productTermRecords = [];
  const gasProductRecords = [];
  const atomTermRecords = [];
  const metadata = [];
  const reactantTermMetadata = [];
  const productTermMetadata = [];
  const gasProductMetadata = [];
  const atomTermMetadata = [];
  const productPhaseRecords = [];
  const productPhaseMetadata = [];
  const productPhaseKeys = new Set();
  const options = { soundSpeedScale, minGasSoundSpeedMPerS };

  for (let reactionIndex = 0; reactionIndex < (reactions || []).length; reactionIndex += 1) {
    const reaction = reactions[reactionIndex];
    const a = reaction?.a;
    const b = reaction?.b;
    const productTerms = productMassFractions(productTermsForReaction(reaction, materialProperties), materialProperties);
    const reactantTerms = reactantTermsForReaction(reaction, materialProperties);
    const primaryProductTerm = productTerms[0] || { material: reaction?.product, coefficient: 1, massFraction: 1 };
    const product = primaryProductTerm.material || reaction?.product;
    const aMaterialId = stableOpticalMaterialId(a);
    const bMaterialId = stableOpticalMaterialId(b);
    const productMaterialId = stableOpticalMaterialId(product);
    for (const term of productTerms) {
      appendProductPhaseRecords({
        product: term.material,
        materialProperties,
        productPhaseKeys,
        productPhaseRecords,
        metadata: productPhaseMetadata,
        options
      });
    }
    const productProperties = materialPropertiesFor(product, materialProperties);
    const allProductPropertiesReady = productTerms.length > 0 && productTerms.every((term) => (
      materialPropertiesFor(term.material, materialProperties)?.phases?.length
    ));
    const activationTemperatureK = finiteNumber(reaction?.activationTemperatureK, 0);
    const specificEnthalpyJPerKg = finiteNumber(reaction?.specificEnthalpyJPerKg, 0);
    const radius = finiteNumber(reaction?.contactRadiusM ?? contactRadiusM, 0);
    const status = a && b && product && radius > 0 && allProductPropertiesReady
      ? REACTION_STATUS.ready
      : (!productProperties?.phases?.length || !allProductPropertiesReady ? REACTION_STATUS.missingProductMaterial : REACTION_STATUS.invalidReaction);
    const phaseMaskA = phaseMask(reaction?.phaseRequirements?.[a]);
    const phaseMaskB = phaseMask(reaction?.phaseRequirements?.[b]);
    const reactantTermOffset = reactantTermRecords.length / SPH_REACTION_REACTANT_TERM_FLOATS;
    const productTermOffset = productTermRecords.length / SPH_REACTION_PRODUCT_TERM_FLOATS;
    const gasProductTermOffset = gasProductRecords.length / SPH_REACTION_GAS_PRODUCT_FLOATS;
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
    for (const term of reactantTerms) {
      const materialId = stableOpticalMaterialId(term.material);
      const properties = materialPropertiesFor(term.material, materialProperties);
      const molarMassKgPerMol = finiteNumber(properties?.molarMassKgPerMol, 0);
      const termStatus = molarMassKgPerMol > 0 ? REACTION_TERM_STATUS.ready : REACTION_TERM_STATUS.missingMaterialProperties;
      const reactantTermIndex = reactantTermRecords.length / SPH_REACTION_REACTANT_TERM_FLOATS;
      reactantTermRecords.push(
        reactionIndex,
        materialId,
        term.coefficient,
        molarMassKgPerMol,
        termPhaseMask(term, reaction),
        REACTION_ROLE_IDS[term.role] || REACTION_ROLE_IDS.other,
        finiteNumber(term.charge, 0),
        term.coefficient,
        stableOpticalMaterialId(term.material),
        stableOpticalMaterialId(term.formula || term.material),
        termStatus,
        0
      );
      reactantTermMetadata.push({
        reactionIndex,
        reactantTermIndex,
        material: term.material,
        materialId,
        formula: term.formula || term.material,
        coefficient: term.coefficient,
        molarMassKgPerMol,
        role: term.role,
        phaseMask: termPhaseMask(term, reaction),
        status: termStatus
      });
      const reactantAtomEntries = atomEntriesForTerm(term);
      for (let atomIndex = 0; atomIndex < reactantAtomEntries.length; atomIndex += 1) {
        const atom = reactantAtomEntries[atomIndex];
        const chargeForRow = atomIndex === 0 ? finiteNumber(term.charge, 0) : 0;
        const atomTermIndex = atomTermRecords.length / SPH_REACTION_ATOM_TERM_FLOATS;
        atomTermRecords.push(
          reactionIndex,
          REACTION_ATOM_TERM_KIND_IDS.reactant,
          reactantTermIndex,
          atom.Z,
          atom.count,
          term.coefficient,
          chargeForRow,
          termStatus
        );
        atomTermMetadata.push({
          reactionIndex,
          atomTermIndex,
          termKind: 'reactant',
          termKindId: REACTION_ATOM_TERM_KIND_IDS.reactant,
          termIndex: reactantTermIndex,
          material: term.material,
          formula: term.formula || term.material,
          atomicNumberZ: atom.Z,
          atomsPerFormula: atom.count,
          coefficient: term.coefficient,
          charge: chargeForRow,
          status: termStatus
        });
      }
    }
    for (const term of productTerms) {
      const materialId = stableOpticalMaterialId(term.material);
      const properties = materialPropertiesFor(term.material, materialProperties);
      const molarMassKgPerMol = finiteNumber(properties?.molarMassKgPerMol, 0);
      const gas = termIsGas(term, materialProperties);
      const phaseRange = productPhaseRangeFor(productPhaseMetadata, term.material);
      const productTermIndex = productTermRecords.length / SPH_REACTION_PRODUCT_TERM_FLOATS;
      const termStatus = molarMassKgPerMol > 0 && properties?.phases?.length
        ? REACTION_TERM_STATUS.ready
        : REACTION_TERM_STATUS.missingMaterialProperties;
      productTermRecords.push(
        reactionIndex,
        materialId,
        term.coefficient,
        molarMassKgPerMol,
        term.massFraction,
        gas ? REACTION_PRODUCT_ROUTING.gas : REACTION_PRODUCT_ROUTING.condensed,
        gas ? GPU_PHASE_IDS.gas : 0,
        termStatus,
        stableOpticalMaterialId(term.formula || term.material),
        stableOpticalMaterialId(term.material),
        termPhaseMask(term, reaction),
        phaseRange.offset,
        phaseRange.count,
        gas ? materialId : 0,
        finiteNumber(term.charge, 0),
        0
      );
      productTermMetadata.push({
        reactionIndex,
        productTermIndex,
        material: term.material,
        materialId,
        formula: term.formula || term.material,
        coefficient: term.coefficient,
        molarMassKgPerMol,
        massFraction: term.massFraction,
        routing: gas ? 'gas' : 'condensed',
        phaseRecordOffset: phaseRange.offset,
        phaseRecordCount: phaseRange.count,
        status: termStatus
      });
      const productAtomEntries = atomEntriesForTerm(term);
      for (let atomIndex = 0; atomIndex < productAtomEntries.length; atomIndex += 1) {
        const atom = productAtomEntries[atomIndex];
        const chargeForRow = atomIndex === 0 ? finiteNumber(term.charge, 0) : 0;
        const atomTermIndex = atomTermRecords.length / SPH_REACTION_ATOM_TERM_FLOATS;
        atomTermRecords.push(
          reactionIndex,
          REACTION_ATOM_TERM_KIND_IDS.product,
          productTermIndex,
          atom.Z,
          atom.count,
          term.coefficient,
          chargeForRow,
          termStatus
        );
        atomTermMetadata.push({
          reactionIndex,
          atomTermIndex,
          termKind: 'product',
          termKindId: REACTION_ATOM_TERM_KIND_IDS.product,
          termIndex: productTermIndex,
          material: term.material,
          formula: term.formula || term.material,
          atomicNumberZ: atom.Z,
          atomsPerFormula: atom.count,
          coefficient: term.coefficient,
          charge: chargeForRow,
          status: termStatus
        });
      }
      if (gas) {
        const gasRecordIndex = gasProductRecords.length / SPH_REACTION_GAS_PRODUCT_FLOATS;
        gasProductRecords.push(
          reactionIndex,
          productTermIndex,
          materialId,
          term.coefficient,
          molarMassKgPerMol,
          REACTION_PRESSURE_ROUTING.sealedBoxGasInventory,
          termStatus,
          0
        );
        gasProductMetadata.push({
          reactionIndex,
          gasRecordIndex,
          productTermIndex,
          material: term.material,
          materialId,
          formula: term.formula || term.material,
          coefficient: term.coefficient,
          molarMassKgPerMol,
          pressureRouting: 'sealed-box-gas-inventory',
          status: termStatus
        });
      }
    }
    const gasProductTermCount = (gasProductRecords.length / SPH_REACTION_GAS_PRODUCT_FLOATS) - gasProductTermOffset;
    reactionHeaders.push(
      reactionIndex,
      reactantTermOffset,
      reactantTerms.length,
      productTermOffset,
      productTerms.length,
      gasProductTermOffset,
      gasProductTermCount,
      specificEnthalpyJPerKg,
      activationTemperatureK,
      radius,
      status,
      productMaterialId,
      phaseMaskA,
      phaseMaskB,
      reaction?.stoichiometry?.atomBalance?.balanced ? 1 : 0,
      reaction?.stoichiometry?.chargeBalance?.balanced ? 1 : 0
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
      activationModel: reaction?.activationModel ?? null,
      reactionClosureSchema: ULG_REACTION_CLOSURE_SCHEMA,
      stoichiometry: reaction?.stoichiometry ?? null,
      reactantTermOffset,
      reactantTermCount: reactantTerms.length,
      productTermOffset,
      productTermCount: productTerms.length,
      gasProductTermOffset,
      gasProductTermCount,
      productTerms: productTermMetadata.filter((term) => term.reactionIndex === reactionIndex),
      reactantTerms: reactantTermMetadata.filter((term) => term.reactionIndex === reactionIndex),
      gasProductTerms: gasProductMetadata.filter((term) => term.reactionIndex === reactionIndex)
    });
  }

  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionClosureSchema: ULG_REACTION_CLOSURE_SCHEMA,
    status: records.length ? 'derived-reaction-table-ready' : 'no-derived-reactions',
    reactionCount: records.length / SPH_REACTION_RECORD_FLOATS,
    reactionHeaderCount: reactionHeaders.length / SPH_REACTION_HEADER_FLOATS,
    reactantTermCount: reactantTermRecords.length / SPH_REACTION_REACTANT_TERM_FLOATS,
    productTermCount: productTermRecords.length / SPH_REACTION_PRODUCT_TERM_FLOATS,
    gasProductCount: gasProductRecords.length / SPH_REACTION_GAS_PRODUCT_FLOATS,
    atomTermCount: atomTermRecords.length / SPH_REACTION_ATOM_TERM_FLOATS,
    productPhaseCount: productPhaseRecords.length / SPH_REACTION_PRODUCT_PHASE_FLOATS,
    combinedRecordCount: (
      records.length
      + productPhaseRecords.length
      + reactionHeaders.length
      + reactantTermRecords.length
      + productTermRecords.length
      + gasProductRecords.length
      + atomTermRecords.length
    ) / 4,
    recordLayout: [...SPH_GPU_REACTION_RECORD_ROW_LAYOUT],
    reactionHeaderLayout: [...SPH_GPU_REACTION_HEADER_ROW_LAYOUT],
    reactantTermLayout: [...SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT],
    productTermLayout: [...SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT],
    gasProductLayout: [...SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT],
    atomTermLayout: [...SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT],
    productPhaseLayout: [...SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT],
    recordStrideFloats: SPH_REACTION_RECORD_FLOATS,
    reactionHeaderStrideFloats: SPH_REACTION_HEADER_FLOATS,
    reactantTermStrideFloats: SPH_REACTION_REACTANT_TERM_FLOATS,
    productTermStrideFloats: SPH_REACTION_PRODUCT_TERM_FLOATS,
    gasProductStrideFloats: SPH_REACTION_GAS_PRODUCT_FLOATS,
    atomTermStrideFloats: SPH_REACTION_ATOM_TERM_FLOATS,
    productPhaseStrideFloats: SPH_REACTION_PRODUCT_PHASE_FLOATS,
    records: new Float32Array(records),
    reactionHeaders: new Float32Array(reactionHeaders),
    reactantTermRecords: new Float32Array(reactantTermRecords),
    productTermRecords: new Float32Array(productTermRecords),
    gasProductRecords: new Float32Array(gasProductRecords),
    atomTermRecords: new Float32Array(atomTermRecords),
    productPhaseRecords: new Float32Array(productPhaseRecords),
    combinedRecords: new Float32Array([
      ...records,
      ...productPhaseRecords,
      ...reactionHeaders,
      ...reactantTermRecords,
      ...productTermRecords,
      ...gasProductRecords,
      ...atomTermRecords
    ]),
    metadata,
    reactantTermMetadata,
    productTermMetadata,
    gasProductMetadata,
    atomTermMetadata,
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

function reactionHeaderRecord(table, index) {
  if (!table.reactionHeaders?.length) {
    const rx = reactionRecord(table, index);
    return {
      reactionIndex: index,
      productTermOffset: 0,
      productTermCount: 0,
      gasProductTermOffset: 0,
      gasProductTermCount: 0,
      specificEnthalpyJPerKg: rx.specificEnthalpyJPerKg,
      activationTemperatureK: rx.activationTemperatureK,
      contactRadiusM: rx.contactRadiusM,
      status: rx.status,
      primaryProductMaterialId: rx.productMaterialId
    };
  }
  const offset = index * SPH_REACTION_HEADER_FLOATS;
  return {
    reactionIndex: table.reactionHeaders[offset],
    reactantTermOffset: table.reactionHeaders[offset + 1],
    reactantTermCount: table.reactionHeaders[offset + 2],
    productTermOffset: table.reactionHeaders[offset + 3],
    productTermCount: table.reactionHeaders[offset + 4],
    gasProductTermOffset: table.reactionHeaders[offset + 5],
    gasProductTermCount: table.reactionHeaders[offset + 6],
    specificEnthalpyJPerKg: table.reactionHeaders[offset + 7],
    activationTemperatureK: table.reactionHeaders[offset + 8],
    contactRadiusM: table.reactionHeaders[offset + 9],
    status: table.reactionHeaders[offset + 10],
    primaryProductMaterialId: table.reactionHeaders[offset + 11],
    phaseMaskA: table.reactionHeaders[offset + 12],
    phaseMaskB: table.reactionHeaders[offset + 13],
    atomBalanceStatus: table.reactionHeaders[offset + 14],
    chargeBalanceStatus: table.reactionHeaders[offset + 15]
  };
}

function maxReactionContactRadiusM(reactionTable) {
  const count = Math.max(0, Math.round(finiteNumber(reactionTable?.reactionCount, 0)));
  let maxRadiusM = 0;
  for (let reactionIndex = 0; reactionIndex < count; reactionIndex += 1) {
    const rx = reactionRecord(reactionTable, reactionIndex);
    if (Math.round(finiteNumber(rx.status, 0)) !== REACTION_STATUS.ready) continue;
    maxRadiusM = Math.max(maxRadiusM, clampPositive(rx.contactRadiusM, 0));
  }
  return maxRadiusM;
}

function particleStateBounds(sphParticleState, paddingM = 0) {
  const state = sphParticleState?.state;
  const count = Math.max(0, Math.round(finiteNumber(sphParticleState?.particleCount, 0)));
  if (!(state instanceof Float32Array) || count <= 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let liveCount = 0;
  for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
    const offset = particleIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
    const massKg = finiteNumber(state[offset + 3], 0);
    if (massKg <= 0) continue;
    const x = finiteNumber(state[offset], Number.NaN);
    const y = finiteNumber(state[offset + 1], Number.NaN);
    const z = finiteNumber(state[offset + 2], Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
    liveCount += 1;
  }
  if (liveCount <= 0) return null;
  const padding = clampPositive(paddingM, 0);
  const originM = [minX - padding, minY - padding, minZ - padding];
  const boxDimsM = [
    Math.max(maxX - minX + padding * 2, padding || 1e-6),
    Math.max(maxY - minY + padding * 2, padding || 1e-6),
    Math.max(maxZ - minZ + padding * 2, padding || 1e-6)
  ];
  return { originM, boxDimsM, source: 'cpu-state-bounds-fallback' };
}

function resolveReactionParticleBinBounds({ boxDimsM = null, sphParticleState = null, paddingM = 0 } = {}) {
  const explicitDims = vector3From(
    boxDimsM
      ?? sphParticleState?.boxDimsM
      ?? sphParticleState?.boxDims
      ?? sphParticleState?.domainDimsM
      ?? null,
    [0, 0, 0]
  ).map((value) => clampPositive(value, 0));
  if (explicitDims.every((value) => value > 0)) {
    return {
      originM: [0, 0, 0],
      boxDimsM: explicitDims,
      source: boxDimsM ? 'explicit-box-dims' : 'particle-state-box-dims'
    };
  }
  return particleStateBounds(sphParticleState, paddingM) || {
    originM: [0, 0, 0],
    boxDimsM: explicitDims,
    source: 'unavailable'
  };
}

function createReactionParticleBinParamsArray({ particleCount = 0, particleBinGrid = null } = {}) {
  const gridEnabled = particleBinGrid?.enabled === true;
  const gridDims = Array.isArray(particleBinGrid?.gridDims) ? particleBinGrid.gridDims : [0, 0, 0];
  const origin = Array.isArray(particleBinGrid?.originM) ? particleBinGrid.originM : [0, 0, 0];
  const boxDims = Array.isArray(particleBinGrid?.boxDimsM) ? particleBinGrid.boxDimsM : [0, 0, 0];
  const cellSizeM = clampPositive(particleBinGrid?.cellSizeM, 0);
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
  view.setFloat32(44, cellSizeM, true);
  view.setFloat32(48, cellSizeM > 0 ? 1 / cellSizeM : 0, true);
  view.setFloat32(52, clampPositive(boxDims[0], 0), true);
  view.setFloat32(56, clampPositive(boxDims[1], 0), true);
  view.setFloat32(60, clampPositive(boxDims[2], 0), true);
  return buffer;
}

export function resolveReactionParticleBinGrid({
  boxDimsM = null,
  sphParticleState = null,
  reactionTable = null,
  particleCount = sphParticleState?.particleCount ?? 0,
  binCapacity = DEFAULT_REACTION_PARTICLE_BIN_CAPACITY,
  maxIndexBufferBytes = REACTION_PARTICLE_BIN_INDEX_BUFFER_BUDGET_BYTES
} = {}) {
  const maxContactRadiusM = maxReactionContactRadiusM(reactionTable);
  if (!(maxContactRadiusM > 0)) {
    return {
      status: 'reaction-particle-bin-grid-disabled',
      reason: 'no ready reactions with positive contact radius',
      enabled: false,
      neighborMode: 'all-particle-scan-fallback',
      gridDims: [0, 0, 0],
      boxDimsM: [0, 0, 0],
      originM: [0, 0, 0],
      boundsSource: 'unavailable',
      cellSizeM: 0,
      cellCount: 0,
      binCapacity: 0,
      averageOccupancy: 0,
      estimatedOverflowRisk: false,
      indexBufferByteLength: 0,
      maxContactRadiusM: 0
    };
  }
  const bounds = resolveReactionParticleBinBounds({
    boxDimsM,
    sphParticleState,
    paddingM: maxContactRadiusM
  });
  const dims = bounds.boxDimsM.map((value) => clampPositive(value, 0));
  if (dims.some((value) => value <= 0)) {
    return {
      status: 'reaction-particle-bin-grid-unavailable',
      reason: 'box dimensions unavailable',
      enabled: false,
      neighborMode: 'all-particle-scan-fallback',
      gridDims: [0, 0, 0],
      boxDimsM: dims,
      originM: bounds.originM,
      boundsSource: bounds.source,
      cellSizeM: 0,
      cellCount: 0,
      binCapacity: 0,
      averageOccupancy: 0,
      estimatedOverflowRisk: false,
      indexBufferByteLength: 0,
      maxContactRadiusM
    };
  }
  const requestedCapacity = Math.max(1, Math.round(finiteNumber(binCapacity, DEFAULT_REACTION_PARTICLE_BIN_CAPACITY)));
  const maxDimM = Math.max(...dims);
  const cellSizeM = Math.max(
    maxContactRadiusM,
    maxDimM / REACTION_PARTICLE_BIN_GRID_MAX_AXIS_CELLS,
    1e-6
  );
  const gridDims = dims.map((dim) => Math.max(
    1,
    Math.min(REACTION_PARTICLE_BIN_GRID_MAX_AXIS_CELLS, Math.ceil(dim / cellSizeM))
  ));
  const cellCount = gridDims[0] * gridDims[1] * gridDims[2];
  const normalizedParticleCount = Math.max(0, Math.round(finiteNumber(particleCount, 0)));
  const averageOccupancy = cellCount > 0 ? normalizedParticleCount / cellCount : 0;
  const adaptiveCapacity = Math.max(
    requestedCapacity,
    Math.ceil(averageOccupancy * REACTION_PARTICLE_BIN_CAPACITY_OCCUPANCY_MULTIPLIER)
  );
  const budgetBytes = Math.max(4, Math.round(finiteNumber(maxIndexBufferBytes, REACTION_PARTICLE_BIN_INDEX_BUFFER_BUDGET_BYTES)));
  const maxCapacityByBudget = cellCount > 0
    ? Math.max(1, Math.floor(budgetBytes / (cellCount * Uint32Array.BYTES_PER_ELEMENT)))
    : 0;
  const capacity = Math.max(1, Math.min(adaptiveCapacity, maxCapacityByBudget));
  const estimatedOverflowRisk = normalizedParticleCount > 0
    && averageOccupancy > capacity / REACTION_PARTICLE_BIN_CAPACITY_OCCUPANCY_MULTIPLIER;
  const indexBufferByteLength = cellCount * capacity * Uint32Array.BYTES_PER_ELEMENT;
  if (cellCount <= 0 || cellCount > REACTION_PARTICLE_BIN_GRID_MAX_CELL_COUNT) {
    return {
      status: 'reaction-particle-bin-grid-unavailable',
      reason: 'derived bin grid exceeds bounded cell budget',
      enabled: false,
      neighborMode: 'all-particle-scan-fallback',
      gridDims,
      boxDimsM: dims,
      originM: bounds.originM,
      boundsSource: bounds.source,
      cellSizeM,
      cellCount,
      binCapacity: capacity,
      requestedBinCapacity: requestedCapacity,
      adaptiveBinCapacity: adaptiveCapacity,
      maxBinCapacityByBudget: maxCapacityByBudget,
      averageOccupancy,
      estimatedOverflowRisk,
      indexBufferByteLength,
      maxContactRadiusM
    };
  }
  return {
    status: 'reaction-particle-bin-grid-ready',
    reason: adaptiveCapacity > maxCapacityByBudget
      ? 'adaptive bin capacity capped by index-buffer budget'
      : null,
    enabled: true,
    neighborMode: 'fixed-capacity-particle-bin-grid',
    gridDims,
    boxDimsM: dims,
    originM: bounds.originM,
    boundsSource: bounds.source,
    cellSizeM,
    cellCount,
    binCapacity: capacity,
    requestedBinCapacity: requestedCapacity,
    adaptiveBinCapacity: adaptiveCapacity,
    maxBinCapacityByBudget: maxCapacityByBudget,
    averageOccupancy,
    estimatedOverflowRisk,
    indexBufferByteLength,
    maxContactRadiusM
  };
}

function reactantTermRecord(table, termIndex) {
  if (!table.reactantTermRecords?.length) return null;
  const offset = termIndex * SPH_REACTION_REACTANT_TERM_FLOATS;
  return {
    reactantTermIndex: termIndex,
    reactionIndex: table.reactantTermRecords[offset],
    materialId: table.reactantTermRecords[offset + 1],
    coefficient: table.reactantTermRecords[offset + 2],
    molarMassKgPerMol: table.reactantTermRecords[offset + 3],
    phaseMask: table.reactantTermRecords[offset + 4],
    roleId: table.reactantTermRecords[offset + 5],
    charge: table.reactantTermRecords[offset + 6],
    stoichiometricMoles: table.reactantTermRecords[offset + 7],
    materialKeyHash: table.reactantTermRecords[offset + 8],
    formulaHash: table.reactantTermRecords[offset + 9],
    status: table.reactantTermRecords[offset + 10]
  };
}

function reactantTermsForReactionTableRecord(table, reactionIndex) {
  const header = reactionHeaderRecord(table, reactionIndex);
  const count = Math.max(0, Math.round(finiteNumber(header.reactantTermCount, 0)));
  const offset = Math.max(0, Math.round(finiteNumber(header.reactantTermOffset, 0)));
  const terms = [];
  for (let index = 0; index < count; index += 1) {
    const term = reactantTermRecord(table, offset + index);
    if (term && Math.round(term.status) === REACTION_TERM_STATUS.ready) terms.push(term);
  }
  return terms;
}

function productTermRecord(table, termIndex) {
  if (!table.productTermRecords?.length) return null;
  const offset = termIndex * SPH_REACTION_PRODUCT_TERM_FLOATS;
  return {
    productTermIndex: termIndex,
    reactionIndex: table.productTermRecords[offset],
    materialId: table.productTermRecords[offset + 1],
    coefficient: table.productTermRecords[offset + 2],
    molarMassKgPerMol: table.productTermRecords[offset + 3],
    massFraction: table.productTermRecords[offset + 4],
    routingId: table.productTermRecords[offset + 5],
    targetPhasePolicyId: table.productTermRecords[offset + 6],
    status: table.productTermRecords[offset + 7],
    formulaHash: table.productTermRecords[offset + 8],
    materialKeyHash: table.productTermRecords[offset + 9],
    phaseMask: table.productTermRecords[offset + 10],
    productPhaseRecordOffset: table.productTermRecords[offset + 11],
    productPhaseRecordCount: table.productTermRecords[offset + 12],
    gasSpeciesId: table.productTermRecords[offset + 13],
    charge: table.productTermRecords[offset + 14]
  };
}

function productTermsForReactionTableRecord(table, reactionIndex) {
  const header = reactionHeaderRecord(table, reactionIndex);
  const count = Math.max(0, Math.round(finiteNumber(header.productTermCount, 0)));
  const offset = Math.max(0, Math.round(finiteNumber(header.productTermOffset, 0)));
  const terms = [];
  for (let index = 0; index < count; index += 1) {
    const term = productTermRecord(table, offset + index);
    if (term && Math.round(term.status) === REACTION_TERM_STATUS.ready) terms.push(term);
  }
  if (terms.length) return terms;
  const rx = reactionRecord(table, reactionIndex);
  return [{
    reactionIndex,
    materialId: rx.productMaterialId,
    coefficient: 1,
    molarMassKgPerMol: 0,
    massFraction: 1,
    routingId: REACTION_PRODUCT_ROUTING.condensed,
    status: REACTION_TERM_STATUS.ready
  }];
}

function termMetadataFor(table, kind, term) {
  const list = kind === 'product' ? table.productTermMetadata : table.reactantTermMetadata;
  return (list || []).find((item) => (
    item[`${kind}TermIndex`] === term?.[`${kind}TermIndex`]
    || (item.reactionIndex === term?.reactionIndex && item.materialId === term?.materialId)
  )) || null;
}

function materialLedgerKey(table, term, kind = 'product') {
  const metadata = termMetadataFor(table, kind, term);
  if (metadata?.material) return String(metadata.material);
  return String(Math.round(finiteNumber(term?.materialId, 0)));
}

function updateMassBucket(target, key, massKg) {
  if (!key || !(Math.abs(massKg) > 0)) return;
  target[key] = (target[key] || 0) + massKg;
  if (Math.abs(target[key]) < 1e-12) target[key] = 0;
}

function createReactionLedger() {
  return {
    schema: 'peercompute.ulg.sph-gpu-reaction-ledger.v0',
    status: 'fixed-particle-buffer-stoichiometric-ledger',
    eventCount: 0,
    productMassKgByMaterial: {},
    gasMassKgByMaterial: {},
    visibleProductMassKgByMaterial: {},
    unplacedProductMassKgByMaterial: {},
    heatJ: 0,
    massResidualKg: 0,
    unplacedProductMassKg: 0,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  };
}

function appendReactionLedgerEvent(ledger, event) {
  ledger.events ??= [];
  ledger.events.push(event);
  ledger.eventCount += 1;
  ledger.heatJ += event.heatJ || 0;
  ledger.massResidualKg += event.massResidualKg || 0;
  ledger.unplacedProductMassKg += event.unplacedProductMassKg || 0;
  for (const product of event.products || []) {
    updateMassBucket(ledger.productMassKgByMaterial, product.material, product.massKg);
    updateMassBucket(ledger.visibleProductMassKgByMaterial, product.material, product.visibleMassKg);
    updateMassBucket(ledger.unplacedProductMassKgByMaterial, product.material, product.unplacedMassKg);
    if (product.routing === 'gas') {
      updateMassBucket(ledger.gasMassKgByMaterial, product.material, product.massKg);
    }
  }
}

function sourceInfoForReaction({ sphParticleState, index, reactantTerms }) {
  const stateOffset = index * SPH_GPU_PARTICLE_STATE_FLOATS;
  const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
  const materialId = sphParticleState.thermo[thermoOffset];
  const term = reactantTerms.find((candidate) => candidate.materialId === materialId) || null;
  if (!term) return null;
  const massKg = sphParticleState.state[stateOffset + 3];
  const molarMassKgPerMol = finiteNumber(term.molarMassKgPerMol, 0);
  const coefficient = finiteNumber(term.coefficient, 0);
  if (!(massKg > 0) || !(molarMassKgPerMol > 0) || !(coefficient > 0)) return null;
  return {
    index,
    term,
    materialId,
    massKg,
    specificInternalEnergyJPerKg: sphParticleState.state[stateOffset + 7],
    availableMoles: massKg / molarMassKgPerMol,
    limitingExtentMol: massKg / (coefficient * molarMassKgPerMol)
  };
}

function normalizedProductRecords({ table, productTerms, extentMol, consumedMassKg }) {
  const rawProducts = productTerms.map((term) => {
    const coefficient = finiteNumber(term.coefficient, 0);
    const molarMassKgPerMol = finiteNumber(term.molarMassKgPerMol, 0);
    return {
      term,
      material: materialLedgerKey(table, term, 'product'),
      rawMassKg: Math.max(extentMol * coefficient * molarMassKgPerMol, 0),
      routing: Math.round(finiteNumber(term.routingId, 0)) === REACTION_PRODUCT_ROUTING.gas ? 'gas' : 'condensed'
    };
  });
  const rawProductMassKg = rawProducts.reduce((sum, product) => sum + product.rawMassKg, 0);
  const massScale = rawProductMassKg > 0 ? consumedMassKg / rawProductMassKg : 0;
  return {
    rawProductMassKg,
    massScale,
    products: rawProducts.map((product) => ({
      ...product,
      massKg: product.rawMassKg * massScale
    }))
  };
}

function planStoichiometricFixedBufferEvent({
  table,
  reactionIndex,
  sourceIndices,
  sphParticleState
}) {
  const reactantTerms = reactantTermsForReactionTableRecord(table, reactionIndex);
  const productTerms = productTermsForReactionTableRecord(table, reactionIndex)
    .filter((term) => finiteNumber(term.molarMassKgPerMol, 0) > 0 && finiteNumber(term.coefficient, 0) > 0);
  if (reactantTerms.length < 2 || productTerms.length === 0) return null;
  const sources = sourceIndices.map((index) => sourceInfoForReaction({ sphParticleState, index, reactantTerms }));
  if (sources.some((source) => !source || !(source.limitingExtentMol > 0))) return null;
  const extentMol = Math.min(...sources.map((source) => source.limitingExtentMol));
  if (!(extentMol > 0)) return null;
  const consumed = sources.map((source) => {
    const consumedMassKg = Math.min(
      source.massKg,
      extentMol * source.term.coefficient * source.term.molarMassKgPerMol
    );
    return {
      ...source,
      consumedMassKg,
      remainingMassKg: Math.max(0, source.massKg - consumedMassKg)
    };
  });
  const consumedMassKg = consumed.reduce((sum, source) => sum + source.consumedMassKg, 0);
  if (!(consumedMassKg > 0)) return null;
  const { products, rawProductMassKg } = normalizedProductRecords({
    table,
    productTerms,
    extentMol,
    consumedMassKg
  });
  if (!products.length) return null;
  const rx = reactionRecord(table, reactionIndex);
  const consumedEnergyJ = consumed.reduce(
    (sum, source) => sum + source.consumedMassKg * source.specificInternalEnergyJPerKg,
    0
  );
  const heatJ = -rx.specificEnthalpyJPerKg * consumedMassKg;
  const productSpecificInternalEnergyJPerKg = (consumedEnergyJ + heatJ) / consumedMassKg;
  const freeSlots = consumed.filter((source) => {
    const epsilon = Math.max(source.massKg, 1) * 1e-7;
    return source.remainingMassKg <= epsilon;
  }).sort((left, right) => left.index - right.index);
  const visibleByIndex = new Map();
  const productVisibility = products.map((product) => ({
    ...product,
    visibleMassKg: 0,
    unplacedMassKg: product.massKg
  }));
  const visibleProductCandidates = productVisibility.filter((product) => product.routing !== 'gas');
  if (productVisibility.length === 1 && visibleProductCandidates.length === 1) {
    for (const source of freeSlots) {
      const massKg = freeSlots.length === 1
        ? consumedMassKg
        : source.consumedMassKg;
      visibleByIndex.set(source.index, {
        kind: 'product',
        productIndex: 0,
        product: productVisibility[0],
        massKg,
        specificInternalEnergyJPerKg: productSpecificInternalEnergyJPerKg
      });
      productVisibility[0].visibleMassKg += massKg;
      productVisibility[0].unplacedMassKg = Math.max(0, productVisibility[0].unplacedMassKg - massKg);
    }
  } else {
    for (let slot = 0; slot < freeSlots.length && slot < visibleProductCandidates.length; slot += 1) {
      const product = visibleProductCandidates[slot];
      visibleByIndex.set(freeSlots[slot].index, {
        kind: 'product',
        productIndex: slot,
        product,
        massKg: product.massKg,
        specificInternalEnergyJPerKg: productSpecificInternalEnergyJPerKg
      });
      product.visibleMassKg += product.massKg;
      product.unplacedMassKg = 0;
    }
  }
  const outputs = new Map();
  for (const source of consumed) {
    const visible = visibleByIndex.get(source.index);
    if (visible) {
      outputs.set(source.index, visible);
    } else {
      outputs.set(source.index, {
        kind: 'reactant',
        source,
        massKg: source.remainingMassKg,
        consumedMassKg: source.consumedMassKg
      });
    }
  }
  return {
    extentMol,
    consumedMassKg,
    rawProductMassKg,
    heatJ,
    productSpecificInternalEnergyJPerKg,
    outputs,
    event: {
      schema: 'peercompute.ulg.sph-gpu-reaction-ledger-event.v0',
      reactionIndex,
      extentMol,
      consumedMassKg,
      rawProductMassKg,
      productMassKg: consumedMassKg,
      massResidualKg: rawProductMassKg - consumedMassKg,
      heatJ,
      fixedParticleBuffer: true,
      unplacedProductMassKg: productVisibility.reduce((sum, product) => sum + product.unplacedMassKg, 0),
      reactants: consumed.map((source) => ({
        material: materialLedgerKey(table, source.term, 'reactant'),
        materialId: source.materialId,
        coefficient: source.term.coefficient,
        consumedMassKg: source.consumedMassKg,
        remainingMassKg: source.remainingMassKg
      })),
      products: productVisibility.map((product) => ({
        material: product.material,
        materialId: product.term.materialId,
        coefficient: product.term.coefficient,
        massKg: product.massKg,
        rawMassKg: product.rawMassKg,
        visibleMassKg: product.visibleMassKg,
        unplacedMassKg: product.unplacedMassKg,
        routing: product.routing
      }))
    }
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
  thermo[offset + 11] = sourceThermo2[3] ?? 0;
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

function updateMechanicsRestVolumeForMass(mechanics, thermo, index, massKg) {
  const mechanicsOffset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS;
  const thermoOffset = index * SPH_GPU_PARTICLE_THERMO_FLOATS;
  const restDensity = finiteNumber(thermo[thermoOffset + 3], 0);
  if (restDensity > 0) mechanics[mechanicsOffset + 19] = massKg / restDensity;
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
  let bestDistance2 = 3.402823e38;

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
  reactionLedger = null,
  reactionSummary = null,
  residentProductMass = createResidentProductMassHandle(reactionSummary),
  stateBuffer = null,
  thermoBuffer = null,
  mechanicsBuffer = null,
  stateBufferByteLength = state.byteLength,
  thermoBufferByteLength = thermo.byteLength,
  mechanicsBufferByteLength = mechanics.byteLength,
  retainedOutputParticleBuffers = false,
  destroyOutputParticleBuffers = null,
  readbackMode = FULL_READBACK_MODE,
  sourceParticlePackMode = null,
  reactionProposalNeighborMode = null,
  reactionParticleBinGrid = null,
  reactionParticleBins = null,
  schroederReactionLawQueue = null,
  schroederReactionLawNeighborCandidates = null,
  reactionParticleBinOverflowStatus = null,
  reactionParticleBinOverflowCount = null,
  queueCompletionStatus = null,
  queueCompletionMethod = null,
  scratchBufferCleanupStatus = null
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
    reactionHeaderCount: reactionTable.reactionHeaderCount ?? 0,
    reactantTermCount: reactionTable.reactantTermCount ?? 0,
    productTermCount: reactionTable.productTermCount ?? 0,
    gasProductCount: reactionTable.gasProductCount ?? 0,
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
    reactionHeaderLayout: [...SPH_GPU_REACTION_HEADER_ROW_LAYOUT],
    reactantTermLayout: [...SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT],
    productTermLayout: [...SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT],
    gasProductLayout: [...SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT],
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
    reactionLedger,
    reactionLedgerStatus: reactionLedger?.status ?? (
      reactionSummary?.compactLedgerAvailable
        ? 'compact-gpu-stoichiometric-ledger-summary'
        : (
      reactionTable.gasProductCount > 0 || reactionTable.productTermCount > sphParticleState.particleCount
        ? 'not-collected-for-this-backend'
        : null
        )
    ),
    reactionSummary,
    reactionSummaryStatus: reactionSummary?.status ?? null,
    residentProductMass,
    residentProductMassSchema: residentProductMass?.schema ?? null,
    residentProductMassStatus: residentProductMass?.status ?? null,
    residentProductMassBufferRetained: residentProductMass?.productEventBufferRetained ?? false,
    residentProductMassBufferByteLength: residentProductMass?.productEventBufferByteLength ?? 0,
    residentProductMassProductEventRowCount: residentProductMass?.productEventRowCount ?? 0,
    residentProductMassUnplacedProductMassKg: residentProductMass?.unplacedProductMassKg ?? null,
    residentProductMassUnplacedGasProductMassKg: residentProductMass?.unplacedGasProductMassKg ?? null,
    residentProductMassConsumePolicy: residentProductMass?.consumeMassPolicy ?? null,
    residentProductMassEosCouplingStatus: residentProductMass?.eosCouplingStatus ?? null,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    stateBufferByteLength,
    thermoBufferByteLength,
    mechanicsBufferByteLength,
    retainedOutputParticleBuffers,
    destroyOutputParticleBuffers,
    queueCompletionStatus,
    queueCompletionMethod,
    scratchBufferCleanupStatus,
    readbackMode,
    sourceParticlePackMode,
    reactionProposalNeighborMode,
    schroederLawQueueSchema: schroederReactionLawQueue?.sourceSchema ?? null,
    schroederLawQueueSourceStatus: schroederReactionLawQueue?.sourceStatus ?? null,
    schroederLawQueueStatus: schroederReactionLawQueue?.status ?? null,
    schroederLawQueueConsumerStatus: schroederReactionLawQueue?.consumerStatus ?? null,
    schroederLawQueueReason: schroederReactionLawQueue?.reason ?? null,
    schroederLawQueueEnabled: schroederReactionLawQueue?.enabled === true,
    schroederLawQueueActiveNodeCount: schroederReactionLawQueue?.activeNodeCount ?? 0,
    schroederLawQueueStrideFloats: schroederReactionLawQueue?.lawQueueStrideFloats ?? null,
    schroederLawQueueEnabledLawMask: schroederReactionLawQueue?.enabledLawMask ?? null,
    schroederLawQueueReactionMask: schroederReactionLawQueue?.reactionMask ?? null,
    schroederLawQueueReactionScopeStatus: schroederReactionLawQueue?.reactionScopeStatus ?? null,
    schroederLawQueueBufferConsumed: schroederReactionLawQueue?.lawQueueBufferConsumed === true,
    schroederLawNeighborCandidateSchema: schroederReactionLawNeighborCandidates?.sourceSchema ?? null,
    schroederLawNeighborCandidateSourceStatus: schroederReactionLawNeighborCandidates?.sourceStatus ?? null,
    schroederLawNeighborCandidateStatus: schroederReactionLawNeighborCandidates?.status ?? null,
    schroederLawNeighborCandidateConsumerStatus: schroederReactionLawNeighborCandidates?.consumerStatus ?? null,
    schroederLawNeighborCandidateReason: schroederReactionLawNeighborCandidates?.reason ?? null,
    schroederLawNeighborCandidateAvailable: schroederReactionLawNeighborCandidates?.available === true,
    schroederLawNeighborCandidateAuthoritative: schroederReactionLawNeighborCandidates?.authoritative === true,
    schroederLawNeighborCandidateCount: schroederReactionLawNeighborCandidates?.neighborCandidateCount ?? 0,
    schroederLawNeighborCandidateStrideFloats: schroederReactionLawNeighborCandidates?.neighborCandidateStrideFloats ?? null,
    schroederLawNeighborCandidateBudget: schroederReactionLawNeighborCandidates?.candidateBudget ?? null,
    schroederLawNeighborCandidateLawQueueCount: schroederReactionLawNeighborCandidates?.lawQueueCount ?? null,
    schroederLawNeighborCandidateEnabledLawMask: schroederReactionLawNeighborCandidates?.enabledLawMask ?? null,
    schroederLawNeighborCandidateReactionMask: schroederReactionLawNeighborCandidates?.reactionMask ?? null,
    schroederLawNeighborCandidateEnumerationMode: schroederReactionLawNeighborCandidates?.enumerationMode ?? null,
    schroederLawNeighborCandidateTreeTraversalStatus: schroederReactionLawNeighborCandidates?.treeTraversalStatus ?? null,
    schroederLawNeighborCandidateBufferObserved: schroederReactionLawNeighborCandidates?.neighborCandidateBufferObserved === true,
    schroederLawNeighborCandidateBufferConsumed: schroederReactionLawNeighborCandidates?.neighborCandidateBufferConsumed === true,
    reactionParticleBinGridSchema: reactionParticleBins?.schema ?? null,
    reactionParticleBinGridStatus: reactionParticleBins?.status ?? reactionParticleBinGrid?.status ?? null,
    reactionParticleBinGridReason: reactionParticleBins?.reason ?? reactionParticleBinGrid?.reason ?? null,
    reactionParticleBinGridEnabled: reactionParticleBinGrid?.enabled === true,
    reactionParticleBinGridBoundsSource: reactionParticleBinGrid?.boundsSource ?? null,
    reactionParticleBinGridDims: reactionParticleBinGrid?.gridDims ? [...reactionParticleBinGrid.gridDims] : null,
    reactionParticleBinGridCellCount: reactionParticleBinGrid?.cellCount ?? 0,
    reactionParticleBinGridCellSizeM: reactionParticleBinGrid?.cellSizeM ?? 0,
    reactionParticleBinGridBinCapacity: reactionParticleBinGrid?.binCapacity ?? 0,
    reactionParticleBinGridAverageOccupancy: reactionParticleBinGrid?.averageOccupancy ?? 0,
    reactionParticleBinGridEstimatedOverflowRisk: reactionParticleBinGrid?.estimatedOverflowRisk === true,
    reactionParticleBinGridIndexBufferByteLength: reactionParticleBins?.indexBufferByteLength ?? reactionParticleBinGrid?.indexBufferByteLength ?? 0,
    reactionParticleBinGridMaxContactRadiusM: reactionParticleBinGrid?.maxContactRadiusM ?? 0,
    reactionParticleBinOverflowStatus,
    reactionParticleBinOverflowCount,
    reactionParticleBinOverflowMetadataReadbackRequested: reactionParticleBins?.overflowMetadataReadbackRequested === true,
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
  const reactionLedger = createReactionLedger();
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
    if (index > partnerIndex) continue;
    const partnerOffset = partnerIndex * 4;
    if (Math.round(proposals[partnerOffset]) !== index || proposals[partnerOffset + 1] !== reactionIndex) continue;
    const rx = reactionRecord(reactionTable, Math.round(reactionIndex));
    const sourceIndices = [index, partnerIndex];
    const fixedBufferPlan = planStoichiometricFixedBufferEvent({
      table: reactionTable,
      reactionIndex: Math.round(reactionIndex),
      sourceIndices,
      sphParticleState
    });
    if (fixedBufferPlan) {
      for (const sourceIndex of sourceIndices) {
        const output = fixedBufferPlan.outputs.get(sourceIndex);
        if (!output) continue;
        const stateOffset = sourceIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
        const thermoOffset = sourceIndex * SPH_GPU_PARTICLE_THERMO_FLOATS;
        if (output.kind === 'reactant') {
          state[stateOffset + 3] = Math.max(output.massKg, 0);
          updateMechanicsRestVolumeForMass(mechanics, thermo, sourceIndex, state[stateOffset + 3]);
          continue;
        }
        const materialId = output.product?.term?.materialId || rx.productMaterialId;
        const nextMass = Math.max(output.massKg, 0);
        const nextU = output.specificInternalEnergyJPerKg;
        state[stateOffset + 3] = nextMass;
        state[stateOffset + 7] = nextU;
        const resolved = resolveThermalStateFromGraphPhaseResponseCpu({
          graphSet: resolvedGraphSet,
          responseTable: resolvedPhaseResponseTable,
          materialId,
          specificInternalEnergyJPerKg: nextU
        });
        writeResolvedThermoRow(thermo, sourceIndex, materialId, resolved, [
          sphParticleState.thermo[thermoOffset + 8],
          sphParticleState.thermo[thermoOffset + 9],
          sphParticleState.thermo[thermoOffset + 10],
          sphParticleState.thermo[thermoOffset + 11]
        ]);
        resetMechanicsForProduct(
          mechanics,
          sourceIndex,
          nextMass,
          resolved,
          productPhaseRecord(reactionTable, materialId, resolved.phaseId)
        );
        conversionCount += 1;
      }
      appendReactionLedgerEvent(reactionLedger, fixedBufferPlan.event);
      continue;
    }
    const productTerms = productTermsForReactionTableRecord(reactionTable, Math.round(reactionIndex));
    const sourceMasses = sourceIndices.map((sourceIndex) => {
      const stateOffset = sourceIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
      return sphParticleState.state[stateOffset + 3];
    });
    const totalSourceMass = sourceMasses.reduce((sum, mass) => sum + mass, 0);
    for (let slotIndex = 0; slotIndex < sourceIndices.length; slotIndex += 1) {
      const sourceIndex = sourceIndices[slotIndex];
      const term = productTerms[Math.min(slotIndex, productTerms.length - 1)] || productTerms[0];
      const materialId = term?.materialId || rx.productMaterialId;
      const massFraction = productTerms.length === 1
        ? sourceMasses[slotIndex] / Math.max(totalSourceMass, sourceMasses[slotIndex], 1)
        : finiteNumber(term.massFraction, sourceMasses[slotIndex] / Math.max(totalSourceMass, sourceMasses[slotIndex], 1));
      const stateOffset = sourceIndex * SPH_GPU_PARTICLE_STATE_FLOATS;
      const thermoOffset = sourceIndex * SPH_GPU_PARTICLE_THERMO_FLOATS;
      const nextMass = productTerms.length === 1
        ? sourceMasses[slotIndex]
        : Math.max(totalSourceMass * massFraction, 0);
      const nextU = sphParticleState.state[stateOffset + 7] - rx.specificEnthalpyJPerKg;
      state[stateOffset + 3] = nextMass;
      state[stateOffset + 7] = nextU;
      const resolved = resolveThermalStateFromGraphPhaseResponseCpu({
        graphSet: resolvedGraphSet,
        responseTable: resolvedPhaseResponseTable,
        materialId,
        specificInternalEnergyJPerKg: nextU
      });
      writeResolvedThermoRow(thermo, sourceIndex, materialId, resolved, [
        sphParticleState.thermo[thermoOffset + 8],
        sphParticleState.thermo[thermoOffset + 9],
        sphParticleState.thermo[thermoOffset + 10],
        sphParticleState.thermo[thermoOffset + 11]
      ]);
      resetMechanicsForProduct(
        mechanics,
        sourceIndex,
        nextMass,
        resolved,
        productPhaseRecord(reactionTable, materialId, resolved.phaseId)
      );
      conversionCount += 1;
    }
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
    eventCount: reactionLedger.eventCount || conversionCount / 2,
    reactionLedger: reactionLedger.eventCount > 0 ? reactionLedger : null
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

function resolveSchroederReactionLawQueue(schroederLawQueue = null, { particleCount = 0 } = {}) {
  const base = {
    sourceSchema: schroederLawQueue?.schema ?? null,
    sourceStatus: schroederLawQueue?.status ?? null,
    status: 'schroeder-reaction-law-queue-unavailable',
    consumerStatus: 'schroeder-reaction-law-queue-not-provided',
    reason: schroederLawQueue ? null : 'No Schroeder law queue was provided to the reaction stage',
    enabled: false,
    lawQueueBuffer: null,
    lawQueueBufferConsumed: false,
    activeNodeCount: 0,
    lawQueueStrideFloats: SCHROEDER_REACTION_LAW_QUEUE_FLOATS,
    enabledLawMask: 0,
    reactionMask: SCHROEDER_REACTION_LAW_MASK,
    reactionScopeStatus: schroederLawQueue?.reactionScopeStatus ?? null
  };
  if (!schroederLawQueue) return base;
  const schemaAccepted = schroederLawQueue.schema === ULG_SCHROEDER_LAW_QUEUE_EXECUTION_SCHEMA
    || schroederLawQueue.schema === ULG_SCHROEDER_LAW_QUEUE_SCHEMA;
  if (!schemaAccepted) {
    return {
      ...base,
      status: 'schroeder-reaction-law-queue-rejected',
      consumerStatus: 'schroeder-reaction-law-queue-schema-mismatch',
      reason: 'Schroeder law queue schema is not compatible with the reaction consumer'
    };
  }
  const lawQueueBuffer = schroederLawQueue.lawQueueBuffer
    || schroederLawQueue.queueBuffer
    || schroederLawQueue.buffer
    || null;
  if (!lawQueueBuffer) {
    return {
      ...base,
      status: 'schroeder-reaction-law-queue-rejected',
      consumerStatus: 'schroeder-reaction-law-queue-buffer-missing',
      reason: 'Schroeder law queue did not expose a resident law queue buffer'
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
      status: 'schroeder-reaction-law-queue-rejected',
      consumerStatus: 'schroeder-reaction-law-queue-empty',
      reason: 'Schroeder law queue has no active rows',
      lawQueueBuffer,
      activeNodeCount
    };
  }
  const lawQueueStrideFloats = Math.max(SCHROEDER_REACTION_LAW_QUEUE_FLOATS, Math.round(finiteNumber(
    schroederLawQueue.lawQueueStrideFloats
      ?? schroederLawQueue.queueStrideFloats
      ?? schroederLawQueue.rowStrideFloats
      ?? SCHROEDER_REACTION_LAW_QUEUE_FLOATS,
    SCHROEDER_REACTION_LAW_QUEUE_FLOATS
  )));
  const enabledLawMask = Math.max(0, Math.round(finiteNumber(
    schroederLawQueue.enabledLawMask
      ?? schroederLawQueue.lawMask
      ?? SCHROEDER_REACTION_LAW_MASK,
    SCHROEDER_REACTION_LAW_MASK
  )));
  if ((enabledLawMask & SCHROEDER_REACTION_LAW_MASK) === 0) {
    return {
      ...base,
      status: 'schroeder-reaction-law-queue-bypassed',
      consumerStatus: 'schroeder-reaction-law-queue-reaction-mask-disabled',
      reason: 'Schroeder law queue is present but reaction law dispatch is disabled',
      lawQueueBuffer,
      activeNodeCount,
      lawQueueStrideFloats,
      enabledLawMask
    };
  }
  return {
    ...base,
    status: 'schroeder-reaction-law-queue-ready',
    consumerStatus: 'schroeder-reaction-law-queue-consumed',
    reason: null,
    enabled: true,
    lawQueueBuffer,
    lawQueueBufferConsumed: true,
    activeNodeCount,
    lawQueueStrideFloats,
    enabledLawMask
  };
}

function createSchroederReactionLawQueueParamsArray(schroederReactionLawQueue) {
  const buffer = new ArrayBuffer(16);
  const view = new DataView(buffer);
  view.setUint32(0, schroederReactionLawQueue?.enabled ? 1 : 0, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    schroederReactionLawQueue?.activeNodeCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    schroederReactionLawQueue?.lawQueueStrideFloats,
    SCHROEDER_REACTION_LAW_QUEUE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(0, Math.round(finiteNumber(
    schroederReactionLawQueue?.reactionMask,
    SCHROEDER_REACTION_LAW_MASK
  ))), true);
  return buffer;
}

function createSchroederReactionLawNeighborCandidateParamsArray(schroederReactionLawNeighborCandidates) {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setUint32(0, schroederReactionLawNeighborCandidates?.neighborCandidateBufferConsumed ? 1 : 0, true);
  view.setUint32(4, Math.max(0, Math.round(finiteNumber(
    schroederReactionLawNeighborCandidates?.neighborCandidateCount,
    0
  ))), true);
  view.setUint32(8, Math.max(1, Math.round(finiteNumber(
    schroederReactionLawNeighborCandidates?.neighborCandidateStrideFloats,
    SCHROEDER_REACTION_LAW_NEIGHBOR_CANDIDATE_FLOATS
  ))), true);
  view.setUint32(12, Math.max(1, Math.round(finiteNumber(
    schroederReactionLawNeighborCandidates?.candidateBudget,
    1
  ))), true);
  view.setUint32(16, Math.max(0, Math.round(finiteNumber(
    schroederReactionLawNeighborCandidates?.reactionMask,
    SCHROEDER_REACTION_LAW_MASK
  ))), true);
  view.setUint32(20, Math.max(0, Math.round(finiteNumber(
    schroederReactionLawNeighborCandidates?.sourceCandidateSpanCount,
    0
  ))), true);
  view.setUint32(24, Math.max(1, Math.round(finiteNumber(
    schroederReactionLawNeighborCandidates?.sourceCandidateSpanStrideFloats,
    SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS
  ))), true);
  view.setUint32(28, schroederReactionLawNeighborCandidates?.sourceCandidateSpanBufferConsumed ? 1 : 0, true);
  return buffer;
}

function resolveSchroederReactionLawNeighborCandidates(schroederLawNeighborCandidates = null) {
  const base = {
    sourceSchema: schroederLawNeighborCandidates?.schema ?? null,
    sourceStatus: schroederLawNeighborCandidates?.status ?? null,
    status: 'schroeder-reaction-law-neighbor-candidates-unavailable',
    consumerStatus: 'schroeder-reaction-law-neighbor-candidates-not-provided',
    reason: schroederLawNeighborCandidates
      ? null
      : 'No Schroeder law-neighbor candidate rows were provided to the reaction stage',
    available: false,
    authoritative: false,
    neighborCandidateBuffer: null,
    neighborCandidateBufferObserved: false,
    neighborCandidateBufferConsumed: false,
    neighborCandidateCount: 0,
    neighborCandidateStrideFloats: SCHROEDER_REACTION_LAW_NEIGHBOR_CANDIDATE_FLOATS,
    sourceCandidateSpanBuffer: null,
    sourceCandidateSpanBufferObserved: false,
    sourceCandidateSpanBufferConsumed: false,
    sourceCandidateSpanCount: 0,
    sourceCandidateSpanStrideFloats: SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS,
    candidateBudget: 0,
    lawQueueCount: 0,
    enabledLawMask: 0,
    reactionMask: SCHROEDER_REACTION_LAW_MASK,
    enumerationMode: schroederLawNeighborCandidates?.enumerationMode ?? null,
    treeTraversalStatus: schroederLawNeighborCandidates?.treeTraversalStatus ?? null
  };
  if (!schroederLawNeighborCandidates) return base;
  const schemaAccepted = schroederLawNeighborCandidates.schema === ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_EXECUTION_SCHEMA
    || schroederLawNeighborCandidates.schema === ULG_SCHROEDER_LAW_NEIGHBOR_CANDIDATE_SCHEMA;
  if (!schemaAccepted) {
    return {
      ...base,
      status: 'schroeder-reaction-law-neighbor-candidates-rejected',
      consumerStatus: 'schroeder-reaction-law-neighbor-candidates-schema-mismatch',
      reason: 'Schroeder law-neighbor candidate schema is not compatible with the reaction consumer'
    };
  }
  const neighborCandidateBuffer = schroederLawNeighborCandidates.neighborCandidateBuffer
    || schroederLawNeighborCandidates.candidateBuffer
    || schroederLawNeighborCandidates.buffer
    || null;
  const sourceCandidateSpanBuffer = schroederLawNeighborCandidates.sourceCandidateSpanBuffer
    || schroederLawNeighborCandidates.sourceSpanBuffer
    || schroederLawNeighborCandidates.candidateSpanBuffer
    || null;
  if (!neighborCandidateBuffer) {
    return {
      ...base,
      status: 'schroeder-reaction-law-neighbor-candidates-rejected',
      consumerStatus: 'schroeder-reaction-law-neighbor-candidates-buffer-missing',
      reason: 'Schroeder law-neighbor candidates did not expose a resident candidate buffer'
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
      status: 'schroeder-reaction-law-neighbor-candidates-rejected',
      consumerStatus: 'schroeder-reaction-law-neighbor-candidates-empty',
      reason: 'Schroeder law-neighbor candidates have no rows',
      neighborCandidateBuffer
    };
  }
  const neighborCandidateStrideFloats = Math.max(
    SCHROEDER_REACTION_LAW_NEIGHBOR_CANDIDATE_FLOATS,
    Math.round(finiteNumber(
      schroederLawNeighborCandidates.neighborCandidateStrideFloats
        ?? schroederLawNeighborCandidates.candidateStrideFloats
        ?? schroederLawNeighborCandidates.rowStrideFloats,
      SCHROEDER_REACTION_LAW_NEIGHBOR_CANDIDATE_FLOATS
    ))
  );
  const enabledLawMask = Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates.enabledLawMask
      ?? schroederLawNeighborCandidates.lawMask
      ?? SCHROEDER_REACTION_LAW_MASK,
    SCHROEDER_REACTION_LAW_MASK
  )));
  if ((enabledLawMask & SCHROEDER_REACTION_LAW_MASK) === 0) {
    return {
      ...base,
      status: 'schroeder-reaction-law-neighbor-candidates-bypassed',
      consumerStatus: 'schroeder-reaction-law-neighbor-candidates-reaction-mask-disabled',
      reason: 'Schroeder law-neighbor candidates are present but reaction law dispatch is disabled',
      neighborCandidateBuffer,
      neighborCandidateCount,
      neighborCandidateStrideFloats,
      enabledLawMask
    };
  }
  const traversalBacked = String(schroederLawNeighborCandidates.enumerationMode || '').includes('active-node')
    || String(schroederLawNeighborCandidates.treeTraversalStatus || '').includes('active-node');
  const sourceCandidateSpanCount = Math.max(0, Math.round(finiteNumber(
    schroederLawNeighborCandidates.sourceCandidateSpanCount
      ?? schroederLawNeighborCandidates.sourceSpanCount
      ?? schroederLawNeighborCandidates.particleCount,
    0
  )));
  const sourceCandidateSpanStrideFloats = Math.max(
    SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS,
    Math.round(finiteNumber(
      schroederLawNeighborCandidates.sourceCandidateSpanStrideFloats
        ?? schroederLawNeighborCandidates.sourceSpanStrideFloats,
      SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS
    ))
  );
  const sourceCandidateSpanAvailable = Boolean(sourceCandidateSpanBuffer && sourceCandidateSpanCount > 0);
  return {
    ...base,
    status: 'schroeder-reaction-law-neighbor-candidates-ready',
    consumerStatus: traversalBacked
      ? 'schroeder-reaction-law-neighbor-candidates-consumed-authoritative'
      : 'schroeder-reaction-law-neighbor-candidates-observed-not-authoritative',
    reason: traversalBacked
      ? 'Traversal-backed law-neighbor candidate rows are consumed as direct reaction proposal input'
      : 'Bounded law-neighbor candidate rows are validated but not authoritative until SS active-node/tree traversal replaces the source-window enumerator',
    available: true,
    authoritative: traversalBacked,
    neighborCandidateBuffer,
    neighborCandidateBufferObserved: true,
    neighborCandidateBufferConsumed: traversalBacked,
    neighborCandidateCount,
    neighborCandidateStrideFloats,
    sourceCandidateSpanBuffer,
    sourceCandidateSpanBufferObserved: sourceCandidateSpanAvailable,
    sourceCandidateSpanBufferConsumed: traversalBacked && sourceCandidateSpanAvailable,
    sourceCandidateSpanCount,
    sourceCandidateSpanStrideFloats,
    candidateBudget: Math.max(0, Math.round(finiteNumber(schroederLawNeighborCandidates.candidateBudget, 0))),
    lawQueueCount: Math.max(0, Math.round(finiteNumber(schroederLawNeighborCandidates.lawQueueCount, 0))),
    enabledLawMask
  };
}

function createReactionParticleBinBuffers({
  device,
  sphParticleState,
  reactionTable,
  boxDimsM = null,
  binCapacity = DEFAULT_REACTION_PARTICLE_BIN_CAPACITY,
  readbackMetadata = false
} = {}) {
  const particleBinGrid = resolveReactionParticleBinGrid({
    boxDimsM,
    sphParticleState,
    reactionTable,
    particleCount: sphParticleState?.particleCount ?? 0,
    binCapacity
  });
  const disabled = particleBinGrid.enabled !== true;
  const cellCount = disabled ? 1 : Math.max(1, Math.round(finiteNumber(particleBinGrid.cellCount, 0)));
  const capacity = disabled ? 1 : Math.max(1, Math.round(finiteNumber(particleBinGrid.binCapacity, DEFAULT_REACTION_PARTICLE_BIN_CAPACITY)));
  const countsBuffer = writeStorageBuffer(
    device,
    disabled ? 'ulg-sph-reaction-particle-bin-counts-disabled' : 'ulg-sph-reaction-particle-bin-counts',
    new Uint32Array(cellCount)
  );
  const indices = new Uint32Array(cellCount * capacity);
  indices.fill(0xffffffff);
  const indicesBuffer = writeStorageBuffer(
    device,
    disabled ? 'ulg-sph-reaction-particle-bin-indices-disabled' : 'ulg-sph-reaction-particle-bin-indices',
    indices
  );
  const metadataBuffer = writeStorageBuffer(
    device,
    disabled ? 'ulg-sph-reaction-particle-bin-metadata-disabled' : 'ulg-sph-reaction-particle-bin-metadata',
    new Uint32Array(4),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const metadataReadbackBuffer = readbackMetadata === true && !disabled
    ? device.createBuffer({
        label: 'ulg-sph-reaction-particle-bin-metadata-readback',
        size: 16,
        usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
      })
    : null;
  const paramsBuffer = device.createBuffer({
    label: disabled ? 'ulg-sph-reaction-particle-bin-params-disabled' : 'ulg-sph-reaction-particle-bin-params',
    size: 64,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createReactionParticleBinParamsArray({
    particleCount: sphParticleState?.particleCount ?? 0,
    particleBinGrid
  }));
  return {
    schema: 'peercompute.ulg.sph-reaction-particle-bin-grid.v0',
    status: disabled ? particleBinGrid.status : 'reaction-particle-bin-grid-prepared',
    reason: particleBinGrid.reason ?? null,
    enabled: !disabled,
    neighborMode: particleBinGrid.neighborMode,
    particleBinGrid,
    countsBuffer,
    indicesBuffer,
    metadataBuffer,
    metadataReadbackBuffer,
    paramsBuffer,
    cellCount: disabled ? 0 : particleBinGrid.cellCount,
    binCapacity: disabled ? 0 : particleBinGrid.binCapacity,
    averageOccupancy: particleBinGrid.averageOccupancy || 0,
    estimatedOverflowRisk: particleBinGrid.estimatedOverflowRisk === true,
    indexBufferByteLength: disabled ? 0 : indices.byteLength,
    overflowMetadataStatus: metadataReadbackBuffer
      ? 'particle-bin-overflow-readback-requested'
      : (disabled ? null : 'particle-bin-overflow-metadata-unread'),
    overflowMetadataReadbackRequested: metadataReadbackBuffer != null,
    cleanupBuffers: [countsBuffer, indicesBuffer, metadataBuffer, metadataReadbackBuffer, paramsBuffer].filter(Boolean)
  };
}

function packReactionParticleRecords(sphParticleState, mlsMpmParticleState) {
  const packed = new Float32Array(sphParticleState.particleCount * SPH_REACTION_PACKED_PARTICLE_FLOATS);
  for (let index = 0; index < sphParticleState.particleCount; index += 1) {
    const out = index * SPH_REACTION_PACKED_PARTICLE_FLOATS;
    packed.set(
      sphParticleState.state.slice(
        index * SPH_GPU_PARTICLE_STATE_FLOATS,
        index * SPH_GPU_PARTICLE_STATE_FLOATS + SPH_GPU_PARTICLE_STATE_FLOATS
      ),
      out
    );
    packed.set(
      sphParticleState.thermo.slice(
        index * SPH_GPU_PARTICLE_THERMO_FLOATS,
        index * SPH_GPU_PARTICLE_THERMO_FLOATS + SPH_GPU_PARTICLE_THERMO_FLOATS
      ),
      out + SPH_GPU_PARTICLE_STATE_FLOATS
    );
    packed.set(
      mlsMpmParticleState.mechanics.slice(
        index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
        index * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS + MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
      ),
      out + SPH_GPU_PARTICLE_STATE_FLOATS + SPH_GPU_PARTICLE_THERMO_FLOATS
    );
  }
  return packed;
}

function createParamsArray({
  particleCount,
  reactionCount,
  productPhaseCount,
  reactantTermCount,
  productTermCount,
  gasProductCount,
  materialCount,
  segmentCount,
  resetMechanics
}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, reactionCount, true);
  view.setUint32(8, productPhaseCount, true);
  view.setUint32(12, materialCount, true);
  view.setUint32(16, segmentCount, true);
  view.setUint32(20, resetMechanics ? 1 : 0, true);
  view.setUint32(24, reactantTermCount, true);
  view.setUint32(28, productTermCount, true);
  view.setUint32(32, gasProductCount, true);
  view.setUint32(36, 0, true);
  view.setUint32(40, 0, true);
  view.setUint32(44, 0, true);
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
  boxDimsM = null,
  reactionParticleBinCapacity = DEFAULT_REACTION_PARTICLE_BIN_CAPACITY,
  reactionParticleBinMetadataReadback = false,
  retainOutputParticleBuffers = false,
  resetMechanics = true,
  readbackMode = FULL_READBACK_MODE,
  readCompactReactionSummary = true,
  readReactionGasSpeciesSummary = true,
  readReactionProductInventory = true,
  readReactionAtomResidual = true,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null
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
  const sourceUsesBorrowedGpuBuffers = Boolean(borrowedStateBuffer || borrowedThermoBuffer || borrowedMechanicsBuffer);
  const packedParticleRecords = sourceUsesBorrowedGpuBuffers
    ? new Float32Array(sphParticleState.particleCount * SPH_REACTION_PACKED_PARTICLE_FLOATS)
    : packReactionParticleRecords(sphParticleState, mlsMpmParticleState);
  const packedParticleRecordBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-packed-source-particles', packedParticleRecords);
  const localSourceStateBuffer = sourceUsesBorrowedGpuBuffers && !borrowedStateBuffer
    ? writeStorageBuffer(device, 'ulg-sph-reaction-pack-source-state-fallback', sphParticleState.state)
    : null;
  const localSourceThermoBuffer = sourceUsesBorrowedGpuBuffers && !borrowedThermoBuffer
    ? writeStorageBuffer(device, 'ulg-sph-reaction-pack-source-thermo-fallback', sphParticleState.thermo)
    : null;
  const localSourceMechanicsBuffer = sourceUsesBorrowedGpuBuffers && !borrowedMechanicsBuffer
    ? writeStorageBuffer(device, 'ulg-sph-reaction-pack-source-mechanics-fallback', mlsMpmParticleState.mechanics)
    : null;
  const packSourceStateBuffer = borrowedStateBuffer || localSourceStateBuffer;
  const packSourceThermoBuffer = borrowedThermoBuffer || localSourceThermoBuffer;
  const packSourceMechanicsBuffer = borrowedMechanicsBuffer || localSourceMechanicsBuffer;
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
  const reactionParticleBins = createReactionParticleBinBuffers({
    device,
    sphParticleState,
    reactionTable,
    boxDimsM,
    binCapacity: reactionParticleBinCapacity,
    readbackMetadata: reactionParticleBinMetadataReadback
  });
  const schroederReactionLawQueue = resolveSchroederReactionLawQueue(schroederLawQueue, {
    particleCount: sphParticleState.particleCount
  });
  const schroederReactionLawNeighborCandidates = resolveSchroederReactionLawNeighborCandidates(
    schroederLawNeighborCandidates
  );
  const borrowedSchroederLawQueueBuffer = schroederReactionLawQueue.enabled
    ? schroederReactionLawQueue.lawQueueBuffer
    : null;
  const localSchroederLawQueueBuffer = borrowedSchroederLawQueueBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-reaction-schroeder-law-queue-disabled',
      new Float32Array(SCHROEDER_REACTION_LAW_QUEUE_FLOATS)
    );
  const schroederReactionLawQueueBuffer = borrowedSchroederLawQueueBuffer || localSchroederLawQueueBuffer;
  const schroederReactionLawQueueParamsBuffer = device.createBuffer({
    label: 'ulg-sph-reaction-schroeder-law-queue-params',
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(
    schroederReactionLawQueueParamsBuffer,
    0,
    createSchroederReactionLawQueueParamsArray(schroederReactionLawQueue)
  );
  const borrowedSchroederLawNeighborCandidateBuffer = schroederReactionLawNeighborCandidates.neighborCandidateBufferConsumed
    ? schroederReactionLawNeighborCandidates.neighborCandidateBuffer
    : null;
  const localSchroederLawNeighborCandidateBuffer = borrowedSchroederLawNeighborCandidateBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-reaction-schroeder-law-neighbor-candidates-disabled',
      new Float32Array(SCHROEDER_REACTION_LAW_NEIGHBOR_CANDIDATE_FLOATS)
    );
  const schroederReactionLawNeighborCandidateBuffer = borrowedSchroederLawNeighborCandidateBuffer
    || localSchroederLawNeighborCandidateBuffer;
  const borrowedSchroederLawNeighborSourceSpanBuffer = schroederReactionLawNeighborCandidates.sourceCandidateSpanBufferConsumed
    ? schroederReactionLawNeighborCandidates.sourceCandidateSpanBuffer
    : null;
  const localSchroederLawNeighborSourceSpanBuffer = borrowedSchroederLawNeighborSourceSpanBuffer
    ? null
    : writeStorageBuffer(
      device,
      'ulg-sph-reaction-schroeder-law-neighbor-source-spans-disabled',
      new Float32Array(SCHROEDER_REACTION_LAW_NEIGHBOR_SOURCE_SPAN_FLOATS)
    );
  const schroederReactionLawNeighborSourceSpanBuffer = borrowedSchroederLawNeighborSourceSpanBuffer
    || localSchroederLawNeighborSourceSpanBuffer;
  const schroederReactionLawNeighborCandidateParamsBuffer = device.createBuffer({
    label: 'ulg-sph-reaction-schroeder-law-neighbor-candidates-params',
    size: 32,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(
    schroederReactionLawNeighborCandidateParamsBuffer,
    0,
    createSchroederReactionLawNeighborCandidateParamsArray(schroederReactionLawNeighborCandidates)
  );
  const proposalBuffer = writeStorageBuffer(
    device,
    'ulg-sph-reaction-proposals',
    new Float32Array(sphParticleState.particleCount * 4),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  const outPackedParticleRecordBuffer = writeStorageBuffer(
    device,
    'ulg-sph-reaction-packed-output-particles',
    new Float32Array(packedParticleRecords.length),
    GPU_BUFFER_USAGE.COPY_SRC
  );
  // Never size GPU outputs from the CPU arrays alone: under GPU-resident
  // continuation the CPU copies can be stale or detached (length 0).
  const outStateBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-output-state', new Float32Array(Math.max(
    sphParticleState.state.length,
    sphParticleState.particleCount * SPH_GPU_PARTICLE_STATE_FLOATS
  )), GPU_BUFFER_USAGE.COPY_SRC);
  const outThermoBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-output-thermo', new Float32Array(Math.max(
    sphParticleState.thermo.length,
    sphParticleState.particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS
  )), GPU_BUFFER_USAGE.COPY_SRC);
  const outMechanicsBuffer = writeStorageBuffer(device, 'ulg-sph-reaction-output-mechanics', new Float32Array(Math.max(
    mlsMpmParticleState.mechanics.length,
    mlsMpmParticleState.particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
  )), GPU_BUFFER_USAGE.COPY_SRC);
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-reaction-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(paramsBuffer, 0, createParamsArray({
    particleCount: sphParticleState.particleCount,
    reactionCount: reactionTable.reactionCount,
    productPhaseCount: reactionTable.productPhaseCount,
    reactantTermCount: reactionTable.reactantTermCount ?? 0,
    productTermCount: reactionTable.productTermCount ?? 0,
    gasProductCount: reactionTable.gasProductCount ?? 0,
    materialCount: resolvedPhaseResponseTable.materialCount,
    segmentCount: resolvedPhaseResponseTable.responseCount,
    resetMechanics
  }));

  const packBindings = [
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(14, 'storage'),
    computeBufferBinding(15, 'read-only-storage')
  ];
  const reactionBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(16, 'storage'),
    computeBufferBinding(17, 'storage'),
    computeBufferBinding(19, 'uniform'),
    computeBufferBinding(20, 'read-only-storage'),
    computeBufferBinding(21, 'uniform'),
    computeBufferBinding(22, 'read-only-storage'),
    computeBufferBinding(23, 'uniform'),
    computeBufferBinding(24, 'read-only-storage')
  ];
  const reactionParticleBinBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(16, 'storage'),
    computeBufferBinding(17, 'storage'),
    computeBufferBinding(18, 'storage'),
    computeBufferBinding(19, 'uniform')
  ];
  const reactionResolveBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'read-only-storage'),
    computeBufferBinding(13, 'read-only-storage')
  ];
  const unpackBindings = [
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform')
  ];
  const packPipelineInfo = sourceUsesBorrowedGpuBuffers
    ? createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-reaction-step',
      label: 'ulg-sph-reaction-pack-source',
      code: sphReactionStepWgsl,
      entryPoint: 'pack_source',
      bindings: packBindings
    })
    : null;
  const reactionParticleBinPipelineInfo = reactionParticleBins.enabled
    ? createCachedExplicitComputePipeline(device, {
      cacheKey: 'ulg-sph-reaction-step',
      label: 'ulg-sph-reaction-particle-bins',
      code: sphReactionStepWgsl,
      entryPoint: 'bin_particles',
      bindings: reactionParticleBinBindings
    })
    : null;
  const { pipeline: proposePipeline, bindGroupLayout: proposeBindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-step',
    label: 'ulg-sph-reaction-propose',
    code: sphReactionStepWgsl,
    entryPoint: 'propose',
    bindings: reactionBindings
  });
  const { pipeline: resolvePipeline, bindGroupLayout: resolveBindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-step',
    label: 'ulg-sph-reaction-resolve',
    code: sphReactionStepWgsl,
    entryPoint: 'resolve',
    bindings: reactionResolveBindings
  });
  const { pipeline: unpackPipeline, bindGroupLayout: unpackBindGroupLayout } = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-sph-reaction-step',
    label: 'ulg-sph-reaction-unpack',
    code: sphReactionStepWgsl,
    entryPoint: 'unpack',
    bindings: unpackBindings
  });
  const proposeBindEntries = (layout) => ({
    layout,
    entries: [
      { binding: 0, resource: { buffer: packedParticleRecordBuffer } },
      { binding: 3, resource: { buffer: reactionRecordBuffer } },
      { binding: 7, resource: { buffer: proposalBuffer } },
      { binding: 11, resource: { buffer: paramsBuffer } },
      { binding: 16, resource: { buffer: reactionParticleBins.countsBuffer } },
      { binding: 17, resource: { buffer: reactionParticleBins.indicesBuffer } },
      { binding: 19, resource: { buffer: reactionParticleBins.paramsBuffer } },
      { binding: 20, resource: { buffer: schroederReactionLawQueueBuffer } },
      { binding: 21, resource: { buffer: schroederReactionLawQueueParamsBuffer } },
      { binding: 22, resource: { buffer: schroederReactionLawNeighborCandidateBuffer } },
      { binding: 23, resource: { buffer: schroederReactionLawNeighborCandidateParamsBuffer } },
      { binding: 24, resource: { buffer: schroederReactionLawNeighborSourceSpanBuffer } }
    ]
  });
  const resolveBindEntries = (layout) => ({
    layout,
    entries: [
      { binding: 0, resource: { buffer: packedParticleRecordBuffer } },
      { binding: 3, resource: { buffer: reactionRecordBuffer } },
      { binding: 5, resource: { buffer: phaseResponseRecordBuffer } },
      { binding: 6, resource: { buffer: phaseResponseBuffer } },
      { binding: 7, resource: { buffer: proposalBuffer } },
      { binding: 8, resource: { buffer: outPackedParticleRecordBuffer } },
      { binding: 11, resource: { buffer: paramsBuffer } },
      { binding: 12, resource: { buffer: graphNodeBuffer } },
      { binding: 13, resource: { buffer: graphSampleBuffer } }
    ]
  });
  const unpackBindEntries = (layout) => ({
    layout,
    entries: [
      { binding: 2, resource: { buffer: outMechanicsBuffer } },
      { binding: 8, resource: { buffer: outPackedParticleRecordBuffer } },
      { binding: 9, resource: { buffer: outStateBuffer } },
      { binding: 10, resource: { buffer: outThermoBuffer } },
      { binding: 11, resource: { buffer: paramsBuffer } }
    ]
  });
  const packBindGroup = packPipelineInfo
    ? device.createBindGroup({
      layout: packPipelineInfo.bindGroupLayout,
      entries: [
        { binding: 1, resource: { buffer: packSourceStateBuffer } },
        { binding: 4, resource: { buffer: packSourceThermoBuffer } },
        { binding: 11, resource: { buffer: paramsBuffer } },
        { binding: 14, resource: { buffer: packedParticleRecordBuffer } },
        { binding: 15, resource: { buffer: packSourceMechanicsBuffer } }
      ]
    })
    : null;
  const reactionParticleBinBindGroup = reactionParticleBinPipelineInfo
    ? device.createBindGroup({
      layout: reactionParticleBinPipelineInfo.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: packedParticleRecordBuffer } },
        { binding: 11, resource: { buffer: paramsBuffer } },
        { binding: 16, resource: { buffer: reactionParticleBins.countsBuffer } },
        { binding: 17, resource: { buffer: reactionParticleBins.indicesBuffer } },
        { binding: 18, resource: { buffer: reactionParticleBins.metadataBuffer } },
        { binding: 19, resource: { buffer: reactionParticleBins.paramsBuffer } }
      ]
    })
    : null;
  const proposeBindGroup = device.createBindGroup(proposeBindEntries(proposeBindGroupLayout));
  const resolveBindGroup = device.createBindGroup(resolveBindEntries(resolveBindGroupLayout));
  const unpackBindGroup = device.createBindGroup(unpackBindEntries(unpackBindGroupLayout));
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  if (packPipelineInfo && packBindGroup) {
    pass.setPipeline(packPipelineInfo.pipeline);
    pass.setBindGroup(0, packBindGroup);
    pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  }
  if (reactionParticleBinPipelineInfo && reactionParticleBinBindGroup) {
    pass.setPipeline(reactionParticleBinPipelineInfo.pipeline);
    pass.setBindGroup(0, reactionParticleBinBindGroup);
    pass.dispatchWorkgroups(Math.max(1, Math.ceil(sphParticleState.particleCount / 64)));
  }
  pass.setPipeline(proposePipeline);
  pass.setBindGroup(0, proposeBindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.setPipeline(resolvePipeline);
  pass.setBindGroup(0, resolveBindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.setPipeline(unpackPipeline);
  pass.setBindGroup(0, unpackBindGroup);
  pass.dispatchWorkgroups(Math.ceil(sphParticleState.particleCount / 64));
  pass.end();
  if (reactionParticleBins.metadataReadbackBuffer) {
    encoder.copyBufferToBuffer(reactionParticleBins.metadataBuffer, 0, reactionParticleBins.metadataReadbackBuffer, 0, 16);
  }
  device.queue.submit([encoder.finish()]);

  let reactionParticleBinOverflowStatus = reactionParticleBins.overflowMetadataStatus ?? null;
  let reactionParticleBinOverflowCount = null;
  if (reactionParticleBins.metadataReadbackBuffer) {
    await reactionParticleBins.metadataReadbackBuffer.mapAsync(GPU_MAP_MODE.READ);
    const metadata = new Uint32Array(reactionParticleBins.metadataReadbackBuffer.getMappedRange()).slice(0, 4);
    reactionParticleBinOverflowCount = metadata[0] || 0;
    reactionParticleBinOverflowStatus = 'particle-bin-overflow-readback-completed';
    reactionParticleBins.metadataReadbackBuffer.unmap();
  }

  let reactionSummary = null;
  const temporarySummaryBuffers = [];
  if (noFullReadback && reactionTable.productTermCount > 0) {
    try {
      const summarySourceStateBuffer = packSourceStateBuffer
        || writeStorageBuffer(device, 'ulg-sph-reaction-summary-source-state', sphParticleState.state);
      const summarySourceThermoBuffer = packSourceThermoBuffer
        || writeStorageBuffer(device, 'ulg-sph-reaction-summary-source-thermo', sphParticleState.thermo);
      if (!packSourceStateBuffer) temporarySummaryBuffers.push(summarySourceStateBuffer);
      if (!packSourceThermoBuffer) temporarySummaryBuffers.push(summarySourceThermoBuffer);
      reactionSummary = await runSphReactionSummaryWebGpu({
        device,
        sphParticleState,
        reactionTable,
        sourceStateBuffer: summarySourceStateBuffer,
        sourceThermoBuffer: summarySourceThermoBuffer,
        nextStateBuffer: outStateBuffer,
        nextThermoBuffer: outThermoBuffer,
        reactionRecordBuffer,
        proposalBuffer,
        readProductEvents: false,
        retainProductEventBuffer: retainOutputParticleBuffers,
        readCompactSummary: readCompactReactionSummary,
        readGasSpeciesSummary: readReactionGasSpeciesSummary,
        readProductInventory: readReactionProductInventory,
        readAtomResidual: readReactionAtomResidual
      });
    } catch (error) {
      reactionSummary = {
        schema: ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'reaction-compact-summary-unavailable',
        reason: error instanceof Error ? error.message : String(error),
        reactionSummaryAvailable: false,
        fullParticleReadbackPerformed: false,
        scientificValidation: false,
        chemistryValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    } finally {
      for (const buffer of temporarySummaryBuffers) buffer?.destroy?.();
    }
  }

  let state = new Float32Array();
  let thermo = new Float32Array();
  let mechanics = new Float32Array();
  let proposals = new Float32Array();
  let queueCompletionStatus = 'queue-submitted';
  let queueCompletionMethod = 'queue.submit';
  let scratchBufferCleanupStatus = 'pending';
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
    queueCompletionStatus = 'readback-map-completed';
    queueCompletionMethod = 'mapAsync(output-readback-buffers)';
  }

  const nonRetainedOutputBuffers = retainOutputParticleBuffers
    ? []
    : [outStateBuffer, outThermoBuffer, outMechanicsBuffer];
  const scratchBuffers = [
    packedParticleRecordBuffer,
    outPackedParticleRecordBuffer,
    reactionRecordBuffer,
    proposalBuffer,
    paramsBuffer,
    localSchroederLawQueueBuffer,
    schroederReactionLawQueueParamsBuffer,
    localSchroederLawNeighborCandidateBuffer,
    localSchroederLawNeighborSourceSpanBuffer,
    schroederReactionLawNeighborCandidateParamsBuffer,
    ...reactionParticleBins.cleanupBuffers,
    localSourceStateBuffer,
    localSourceThermoBuffer,
    localSourceMechanicsBuffer,
    ...(noFullReadback ? nonRetainedOutputBuffers : [])
  ];
  let scratchBuffersDestroyed = false;
  const destroyScratchBuffers = () => {
    if (scratchBuffersDestroyed) return;
    scratchBuffersDestroyed = true;
    for (const buffer of scratchBuffers) buffer?.destroy?.();
    if (localResponseGraphUpload) destroySphThermalResponseGraphBuffers(localResponseGraphUpload);
  };
  if (noFullReadback) {
    const cleanupFence = typeof device.queue?.onSubmittedWorkDone === 'function'
      ? device.queue.onSubmittedWorkDone()
      : null;
    if (cleanupFence?.then) {
      scratchBufferCleanupStatus = 'deferred-until-queue-complete';
      queueCompletionStatus = 'queue-submitted-cleanup-deferred';
      queueCompletionMethod = 'queue.onSubmittedWorkDone(background-cleanup)';
      cleanupFence.then(destroyScratchBuffers, destroyScratchBuffers);
    } else {
      scratchBufferCleanupStatus = 'pending-no-queue-fence';
      queueCompletionStatus = 'queue-submitted-cleanup-pending';
      queueCompletionMethod = 'queue.submit';
    }
  } else {
    destroyScratchBuffers();
    scratchBufferCleanupStatus = 'destroyed-after-readback';
  }
  if (!retainOutputParticleBuffers && !noFullReadback) {
    outStateBuffer.destroy?.();
    outThermoBuffer.destroy?.();
    outMechanicsBuffer.destroy?.();
  }

	  const residentProductMass = createResidentProductMassHandle(reactionSummary);
	  let outputParticleBuffersDestroyed = false;
	  const destroyRetainedOutputParticleBuffers = retainOutputParticleBuffers
	    ? () => {
	      if (outputParticleBuffersDestroyed) return;
	      outputParticleBuffersDestroyed = true;
	      outStateBuffer.destroy?.();
	      outThermoBuffer.destroy?.();
	      outMechanicsBuffer.destroy?.();
	      residentProductMass?.destroyResidentProductMassBuffers?.();
	    }
	    : null;
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
    reactionSummary,
    residentProductMass,
    stateBuffer: retainOutputParticleBuffers ? outStateBuffer : null,
    thermoBuffer: retainOutputParticleBuffers ? outThermoBuffer : null,
    mechanicsBuffer: retainOutputParticleBuffers ? outMechanicsBuffer : null,
    stateBufferByteLength: sphParticleState.state.byteLength,
    thermoBufferByteLength: sphParticleState.thermo.byteLength,
    mechanicsBufferByteLength: mlsMpmParticleState.mechanics.byteLength,
    retainedOutputParticleBuffers: retainOutputParticleBuffers,
	    destroyOutputParticleBuffers: destroyRetainedOutputParticleBuffers,
    queueCompletionStatus,
    queueCompletionMethod,
    scratchBufferCleanupStatus,
    readbackMode: noFullReadback ? NO_FULL_READBACK_MODE : FULL_READBACK_MODE,
    sourceParticlePackMode: sourceUsesBorrowedGpuBuffers ? 'gpu-pack-source-buffers' : 'cpu-packed-source-arrays',
    reactionProposalNeighborMode: [
      schroederReactionLawQueue.enabled ? 'schroeder-law-queue-gated' : null,
      schroederReactionLawNeighborCandidates.neighborCandidateBufferConsumed
        ? 'schroeder-law-neighbor-candidates-authoritative'
        : (schroederReactionLawNeighborCandidates.available ? 'schroeder-law-neighbor-candidates-observed' : null),
      schroederReactionLawNeighborCandidates.sourceCandidateSpanBufferConsumed
        ? 'source-span-indexed'
        : null,
      schroederReactionLawNeighborCandidates.neighborCandidateBufferConsumed
        ? null
        : (reactionParticleBins.enabled ? 'fixed-capacity-particle-bin-grid' : 'all-particle-scan-fallback')
    ].filter(Boolean).join('-'),
    reactionParticleBinGrid: reactionParticleBins.particleBinGrid,
    reactionParticleBins,
    schroederReactionLawQueue,
    schroederReactionLawNeighborCandidates,
    reactionParticleBinOverflowStatus,
    reactionParticleBinOverflowCount
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
  const noFullReadback = readbackMode === NO_FULL_READBACK_MODE || args.readbackMode === NO_FULL_READBACK_MODE;
  let cpuReference = null;
  const getCpuReference = () => {
    if (!cpuReference) cpuReference = runSphReactionStepCpu(args);
    return cpuReference;
  };
  if (!preferWebGpu) {
    const reference = getCpuReference();
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'cpu-reference',
      cpuReference: reference,
      result: reference,
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
    const reference = getCpuReference();
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-unavailable-cpu-reference',
      cpuReference: reference,
      result: reference,
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
    if (noFullReadback || webgpu.readbackMode === NO_FULL_READBACK_MODE) {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted-no-full-readback',
        cpuReference: null,
        webgpu,
        result: webgpu,
        webgpuParity: createNoFullReadbackParityReport(parityTolerance),
        webgpuStatus: { status: 'webgpu-executed-no-full-readback' },
        scientificValidation: false,
        materialValidation: false,
        chemistryValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    const reference = getCpuReference();
    const parity = compareSphReactionStepParity(reference, webgpu, { tolerance: parityTolerance });
    if (parity.status === 'pass' || parity.status === 'not-run-no-full-readback') {
      return {
        schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: 'webgpu-accepted',
        cpuReference: reference,
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
      cpuReference: reference,
      webgpu,
      result: reference,
      webgpuParity: parity,
      webgpuStatus: { status: 'fallback-cpu', reason: 'reaction parity failed' },
      scientificValidation: false,
      materialValidation: false,
      chemistryValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  } catch (error) {
    const reference = getCpuReference();
    return {
      schema: ULG_SPH_GPU_REACTION_STEP_EXECUTION_SCHEMA,
      backend: 'cpu-reference',
      status: 'webgpu-error-cpu-reference',
      cpuReference: reference,
      result: reference,
      webgpuStatus: { status: 'fallback-cpu', reason: error instanceof Error ? error.message : String(error) },
      scientificValidation: false,
      materialValidation: false,
      chemistryValidation: false,
      phaseChangeValidation: false,
      fullPhysicsValidation: false
    };
  }
}
