import {
  SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT,
  SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphReactionAtomResidualWgsl,
  sphReactionGasSpeciesSummaryWgsl,
  sphReactionProductEventWgsl,
  sphReactionProductInventoryWgsl,
  sphReactionSummaryFinalizeWgsl,
  sphReactionSummaryPartialsWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { tagResidentProductMassDevice, tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';

export {
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  sphReactionAtomResidualWgsl,
  sphReactionGasSpeciesSummaryWgsl,
  sphReactionProductEventWgsl,
  sphReactionProductInventoryWgsl,
  sphReactionSummaryFinalizeWgsl,
  sphReactionSummaryPartialsWgsl
};

export const SPH_GPU_REACTION_SUMMARY_FLOATS = SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_SUMMARY_ROWS = SPH_GPU_REACTION_SUMMARY_FLOATS / 4;
export const SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS = SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROWS = SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS / 4;
export const SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS = SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_PRODUCT_INVENTORY_ROWS = SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS / 4;
export const SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_PRODUCT_EVENT_ROWS = SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4;
export const SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS = SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_ATOM_RESIDUAL_ROWS = SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS / 4;

const SUMMARY_WORKGROUP_SIZE = 64;
const SUMMARY_SCOPE = 'sph-reaction-visible-product-gas-compact-summary';
export const ULG_SPH_REACTION_STRICT_GATE_SCHEMA = 'peercompute.ulg.sph-reaction-strict-gate.v0';
export const ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA = 'peercompute.ulg.sph-resident-product-mass.v0';

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

function assertInputs({ sphParticleState, reactionTable }) {
  if (sphParticleState?.schema !== ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA) {
    throw new TypeError('SPH reaction summary requires a packed SPH GPU particle buffer');
  }
  if (reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) {
    throw new TypeError('SPH reaction summary requires a packed reaction table');
  }
}

function writeStorageBuffer(device, label, data) {
  const byteLength = Math.max(4, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function createSummaryParamsArray({
  particleCount,
  reactionCount,
  productPhaseCount,
  reactantTermCount,
  productTermCount,
  gasProductCount,
  atomTermCount,
  partialCount,
  hasProposals = false
}) {
  const buffer = new ArrayBuffer(48);
  const view = new DataView(buffer);
  view.setUint32(0, particleCount, true);
  view.setUint32(4, reactionCount, true);
  view.setUint32(8, productPhaseCount, true);
  view.setUint32(12, reactantTermCount, true);
  view.setUint32(16, productTermCount, true);
  view.setUint32(20, gasProductCount, true);
  view.setUint32(24, partialCount, true);
  view.setUint32(28, hasProposals ? 1 : 0, true);
  view.setUint32(32, atomTermCount ?? 0, true);
  view.setUint32(36, 0, true);
  view.setUint32(40, 0, true);
  view.setUint32(44, 0, true);
  return buffer;
}

export function decodeSphReactionSummaryValues(values, {
  readbackMode = 'compact-reaction-summary-readback',
  reductionStrategy = 'two-pass-workgroup-reduction'
} = {}) {
  if (!(values instanceof Float32Array) || values.length < SPH_GPU_REACTION_SUMMARY_FLOATS) {
    throw new TypeError('decodeSphReactionSummaryValues requires a compact reaction summary Float32Array');
  }
  return {
    schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
    executionSchema: ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
    backend: 'webgpu',
    status: values[15] > 0 ? 'reaction-compact-summary-ready' : 'reaction-compact-summary-empty',
    kernelScope: SUMMARY_SCOPE,
    reductionStrategy,
    particleCount: values[0],
    reactionCount: values[1],
    productTermCount: values[2],
    gasProductCount: values[3],
    changedMaterialCount: values[4],
    changedMassCount: values[5],
    visibleProductMassKg: values[6],
    visibleGasProductMassKg: values[7],
    outputGasPhaseMassKg: values[8],
    sourceMassKg: values[9],
    nextMassKg: values[10],
    massDeltaKg: values[11],
    thermalReadyCount: values[12],
    thermalProblemCount: values[13],
    finiteTemperatureCount: values[14],
    reactionSummaryAvailable: values[15] > 0,
    canonicalReactionEventCount: values[16],
    consumedReactantMassKg: values[17],
    expectedProductMassKg: values[18],
    rawProductMassKg: values[19],
    ledgerVisibleProductMassKg: values[20],
    ledgerUnplacedProductMassKg: values[21],
    ledgerGasProductMassKg: values[22],
    ledgerVisibleGasProductMassKg: values[23],
    ledgerUnplacedGasProductMassKg: values[24],
    sealedBoxGasProductMoles: values[25],
    reactionHeatJ: values[26],
    ledgerMassResidualKg: values[27],
    ledgerReadyEventCount: values[28],
    ledgerProblemEventCount: values[29],
    proposalMutualPairCount: values[30],
    compactLedgerAvailable: values[31] > 0,
    visibleOnly: true,
    unplacedProductInventoryIncluded: values[31] > 0,
    readbackMode,
    fullParticleReadbackPerformed: false,
    rowLayout: [...SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT],
    summaryStrideFloats: SPH_GPU_REACTION_SUMMARY_FLOATS,
    summaryStrideBytes: SPH_GPU_REACTION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    scientificValidation: false,
    chemistryValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function decodeSphReactionGasSpeciesSummaryValues(values, reactionTable = null) {
  if (!(values instanceof Float32Array) || values.length % SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS !== 0) {
    throw new TypeError('decodeSphReactionGasSpeciesSummaryValues requires f32 rows aligned to the gas species summary layout');
  }
  const records = [];
  const bySpecies = {};
  const metadata = Array.isArray(reactionTable?.gasProductMetadata) ? reactionTable.gasProductMetadata : [];
  for (let offset = 0; offset < values.length; offset += SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS) {
    const gasProductIndex = Math.round(values[offset + 6] ?? (offset / SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS));
    const meta = metadata.find((item) => item.gasRecordIndex === gasProductIndex) || metadata[gasProductIndex] || null;
    const materialId = values[offset];
    const material = meta?.material || String(Math.round(materialId));
    const massKg = values[offset + 1];
    const moles = values[offset + 2];
    const visibleMassKg = values[offset + 3];
    const unplacedMassKg = values[offset + 4];
    const eventCount = values[offset + 5];
    const status = values[offset + 7];
    const record = {
      schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
      material,
      materialId,
      massKg,
      moles,
      visibleMassKg,
      unplacedMassKg,
      eventCount,
      gasProductIndex,
      productTermIndex: meta?.productTermIndex ?? null,
      reactionIndex: meta?.reactionIndex ?? null,
      molarMassKgPerMol: meta?.molarMassKgPerMol ?? (moles > 0 ? massKg / moles : null),
      status: status === 1 ? 'ready' : 'not-ready',
      statusCode: status,
      pressureRouting: meta?.pressureRouting ?? null,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    records.push(record);
    if (record.status === 'ready' && ((record.massKg ?? 0) > 0 || (record.moles ?? 0) > 0)) {
      const key = String(record.material || Math.round(record.materialId)).toLowerCase();
      const bucket = bySpecies[key] || (bySpecies[key] = {
        material: key,
        materialId: record.materialId,
        massKg: 0,
        moles: 0,
        visibleMassKg: 0,
        unplacedMassKg: 0,
        eventCount: 0,
        gasProductIndices: [],
        fullParticleReadbackPerformed: false
      });
      bucket.massKg += record.massKg;
      bucket.moles += record.moles;
      bucket.visibleMassKg += record.visibleMassKg;
      bucket.unplacedMassKg += record.unplacedMassKg;
      bucket.eventCount += record.eventCount;
      bucket.gasProductIndices.push(record.gasProductIndex);
    }
  }
  return {
    schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
    status: records.length ? 'gas-species-compact-ledger-ready' : 'gas-species-compact-ledger-empty',
    records,
    bySpecies,
    recordCount: records.length,
    speciesCount: Object.keys(bySpecies).length,
    rowLayout: [...SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS,
    rowStrideBytes: SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  };
}

function routingNameFromId(id, fallback = null) {
  const rounded = Math.round(Number(id) || 0);
  if (fallback) return fallback;
  if (rounded === 1) return 'gas';
  return 'condensed';
}

function sumProductInventoryMass(productInventory, fieldName) {
  if (!Array.isArray(productInventory?.records)) return 0;
  return productInventory.records.reduce((sum, row) => sum + (Number(row?.[fieldName]) || 0), 0);
}

function gasSpeciesRowsFromLedger(ledger) {
  if (!ledger?.schema && !ledger?.bySpecies && !Array.isArray(ledger?.records)) return [];
  const speciesRows = Object.values(ledger.bySpecies || {});
  const rows = speciesRows.length > 0 ? speciesRows : (Array.isArray(ledger.records) ? ledger.records : []);
  return rows.filter((row) => row && ((Number(row.moles) || 0) > 0 || (Number(row.massKg) || 0) > 0));
}

export function mergeResidentGasSpeciesLedgers(...ledgers) {
  const bySpecies = {};
  for (const ledger of ledgers) {
    for (const row of gasSpeciesRowsFromLedger(ledger)) {
      const key = String(row.material || Math.round(Number(row.materialId) || 0)).toLowerCase();
      if (!key) continue;
      const bucket = bySpecies[key] || (bySpecies[key] = {
        material: key,
        materialId: Number(row.materialId) || null,
        massKg: 0,
        moles: 0,
        visibleMassKg: 0,
        unplacedMassKg: 0,
        eventCount: 0,
        gasProductIndices: [],
        fullParticleReadbackPerformed: false
      });
      bucket.massKg += Number(row.massKg) || 0;
      bucket.moles += Number(row.moles) || 0;
      bucket.visibleMassKg += Number(row.visibleMassKg) || 0;
      bucket.unplacedMassKg += Number(row.unplacedMassKg) || 0;
      bucket.eventCount += Number(row.eventCount) || 0;
      if (Array.isArray(row.gasProductIndices)) {
        for (const index of row.gasProductIndices) {
          if (!bucket.gasProductIndices.includes(index)) bucket.gasProductIndices.push(index);
        }
      } else if (Number.isFinite(row.gasProductIndex) && !bucket.gasProductIndices.includes(row.gasProductIndex)) {
        bucket.gasProductIndices.push(row.gasProductIndex);
      }
    }
  }
  const records = Object.values(bySpecies).map((row, index) => ({
    schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
    material: row.material,
    materialId: row.materialId,
    massKg: row.massKg,
    moles: row.moles,
    visibleMassKg: row.visibleMassKg,
    unplacedMassKg: row.unplacedMassKg,
    eventCount: row.eventCount,
    gasProductIndex: row.gasProductIndices[0] ?? index,
    gasProductIndices: [...row.gasProductIndices],
    status: 'ready',
    statusCode: 1,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  }));
  if (!records.length) return null;
  return {
    schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
    status: 'gas-species-resident-ledger-ready',
    records,
    bySpecies,
    recordCount: records.length,
    speciesCount: records.length,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    gasValidation: false,
    fullPhysicsValidation: false
  };
}

export function createResidentProductMassHandle(reactionSummary = null) {
  if (!reactionSummary) return null;
  const retainedProductEventBuffer = Boolean(reactionSummary.productEventBufferRetained && reactionSummary.productEventBuffer);
  const hasInventory = Boolean(reactionSummary.productInventory?.schema);
  const hasEventRows = Boolean(reactionSummary.productEvents?.schema || reactionSummary.productEventRowCount);
  if (!retainedProductEventBuffer && !hasInventory && !hasEventRows) return null;
  const productEvents = reactionSummary.productEvents || null;
  const productInventory = reactionSummary.productInventory || null;
  const sourceDestroy = typeof reactionSummary.destroyProductEventBuffer === 'function'
    ? reactionSummary.destroyProductEventBuffer
    : null;
  let destroyed = Boolean(reactionSummary.productEventBufferDestroyed);
  const destroyResidentProductMassBuffers = retainedProductEventBuffer && sourceDestroy
    ? () => {
        if (destroyed || reactionSummary.productEventBufferDestroyed) return;
        destroyed = true;
        reactionSummary.productEventBufferDestroyed = true;
        sourceDestroy();
      }
    : null;
  const unplacedProductMassKg = Number(reactionSummary.ledgerUnplacedProductMassKg)
    || Number(productEvents?.unplacedMassKg)
    || sumProductInventoryMass(productInventory, 'unplacedMassKg');
  const visibleProductMassKg = Number(reactionSummary.ledgerVisibleProductMassKg)
    || sumProductInventoryMass(productInventory, 'visibleMassKg');
  const unplacedGasProductMassKg = Number(reactionSummary.ledgerUnplacedGasProductMassKg) || 0;
  const gasSpeciesLedger = mergeResidentGasSpeciesLedgers(reactionSummary.gasSpeciesLedger);
  const handle = {
    schema: ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA,
    status: retainedProductEventBuffer
      ? 'resident-product-mass-buffer-retained'
      : 'resident-product-mass-summary-only',
    source: 'reaction-summary-product-events-and-inventory',
    productEventBuffer: retainedProductEventBuffer ? reactionSummary.productEventBuffer : null,
    productEventBufferRetained: retainedProductEventBuffer,
    productEventBufferByteLength: reactionSummary.productEventBufferByteLength ?? 0,
    productEventRowCount: reactionSummary.productEventRowCount ?? productEvents?.rowCount ?? 0,
    productEventActiveEventCount: reactionSummary.productEventActiveEventCount ?? productEvents?.activeEventCount ?? 0,
    productEventStrideFloats: productEvents?.rowStrideFloats ?? SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    productEventStrideBytes: productEvents?.rowStrideBytes ?? SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    productEvents: productEvents
      ? {
          ...productEvents,
          records: Array.isArray(productEvents.records)
            ? productEvents.records.map((record) => ({ ...record }))
            : []
        }
      : null,
    productInventory: productInventory
      ? {
          ...productInventory,
          records: Array.isArray(productInventory.records)
            ? productInventory.records.map((record) => ({ ...record }))
            : []
        }
      : null,
    productInventorySchema: productInventory?.schema ?? null,
    productInventoryCount: reactionSummary.productInventoryCount ?? productInventory?.recordCount ?? 0,
    gasSpeciesLedgerSchema: gasSpeciesLedger?.schema ?? reactionSummary.gasSpeciesLedgerSchema ?? null,
    gasSpeciesLedger,
    gasSpeciesLedgerCount: gasSpeciesLedger?.recordCount ?? reactionSummary.gasSpeciesLedgerCount ?? 0,
    gasSpeciesReadbackByteLength: reactionSummary.gasSpeciesReadbackByteLength ?? 0,
    sealedBoxGasProductMoles: Number(reactionSummary.sealedBoxGasProductMoles) || gasSpeciesLedger?.records?.reduce((sum, row) => sum + (Number(row.moles) || 0), 0) || 0,
    visibleProductMassKg,
    unplacedProductMassKg,
    unplacedGasProductMassKg,
    consumeMassPolicy: 'unplaced-product-mass-only',
    visibleMassAlreadyInParticleBuffers: true,
    eosCouplingStatus: retainedProductEventBuffer
      ? 'resident-product-mass-p2g-eos-sidecar-ready'
      : 'resident-product-mass-summary-only-no-eos-buffer',
    forceCouplingStatus: retainedProductEventBuffer
      ? 'resident-product-mass-force-coupling-pending-pressure-solver'
      : 'resident-product-mass-summary-only-no-force-buffer',
    destroyResidentProductMassBuffers,
    scientificValidation: false,
    chemistryValidation: false,
    gasValidation: false,
    sphValidation: false,
    fullPhysicsValidation: false
  };
  return retainedProductEventBuffer
    ? tagResidentProductMassDevice(handle, reactionSummary.productEventDevice)
    : handle;
}

export function decodeSphReactionProductInventoryValues(values, reactionTable = null) {
  if (!(values instanceof Float32Array) || values.length % SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS !== 0) {
    throw new TypeError('decodeSphReactionProductInventoryValues requires f32 rows aligned to the product inventory layout');
  }
  const records = [];
  const byMaterial = {};
  const metadata = Array.isArray(reactionTable?.productTermMetadata) ? reactionTable.productTermMetadata : [];
  for (let offset = 0; offset < values.length; offset += SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS) {
    const productTermIndex = Math.round(values[offset + 6] ?? (offset / SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS));
    const reactionIndex = Math.round(values[offset + 7] ?? 0);
    const meta = metadata.find((item) => item.productTermIndex === productTermIndex) || metadata[productTermIndex] || null;
    const materialId = values[offset];
    const material = meta?.material || String(Math.round(materialId));
    const massKg = values[offset + 1];
    const visibleMassKg = values[offset + 2];
    const unplacedMassKg = values[offset + 3];
    const moles = values[offset + 4];
    const eventCount = values[offset + 5];
    const routingId = values[offset + 8];
    const chargeMol = values[offset + 9];
    const massResidualKg = values[offset + 10];
    const status = values[offset + 11];
    const coefficient = values[offset + 12];
    const molarMassKgPerMol = values[offset + 13];
    const rawMassKg = values[offset + 14];
    const massScale = values[offset + 15];
    const record = {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
      material,
      materialId,
      massKg,
      visibleMassKg,
      unplacedMassKg,
      moles,
      eventCount,
      productTermIndex,
      reactionIndex: meta?.reactionIndex ?? reactionIndex,
      routing: routingNameFromId(routingId, meta?.routing),
      routingId,
      chargeMol,
      massResidualKg,
      coefficient: meta?.coefficient ?? coefficient,
      molarMassKgPerMol: meta?.molarMassKgPerMol ?? molarMassKgPerMol,
      rawMassKg,
      massScale,
      status: status === 1 ? 'ready' : 'not-ready',
      statusCode: status,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    records.push(record);
    if (record.status === 'ready' && ((record.massKg ?? 0) > 0 || (record.moles ?? 0) > 0)) {
      const key = String(record.material || Math.round(record.materialId)).toLowerCase();
      const bucket = byMaterial[key] || (byMaterial[key] = {
        material: key,
        materialId: record.materialId,
        massKg: 0,
        visibleMassKg: 0,
        unplacedMassKg: 0,
        moles: 0,
        eventCount: 0,
        chargeMol: 0,
        massResidualKg: 0,
        rawMassKg: 0,
        routing: record.routing,
        productTermIndices: [],
        fullParticleReadbackPerformed: false
      });
      bucket.massKg += record.massKg;
      bucket.visibleMassKg += record.visibleMassKg;
      bucket.unplacedMassKg += record.unplacedMassKg;
      bucket.moles += record.moles;
      bucket.eventCount += record.eventCount;
      bucket.chargeMol += record.chargeMol;
      bucket.massResidualKg += record.massResidualKg;
      bucket.rawMassKg += record.rawMassKg;
      bucket.productTermIndices.push(record.productTermIndex);
      if (bucket.routing !== record.routing) bucket.routing = 'mixed';
    }
  }
  return {
    schema: ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
    status: records.length ? 'product-inventory-compact-ledger-ready' : 'product-inventory-compact-ledger-empty',
    records,
    byMaterial,
    recordCount: records.length,
    materialCount: Object.keys(byMaterial).length,
    rowLayout: [...SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS,
    rowStrideBytes: SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  };
}

export function decodeSphReactionProductEventValues(values, reactionTable = null) {
  if (!(values instanceof Float32Array) || values.length % SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS !== 0) {
    throw new TypeError('decodeSphReactionProductEventValues requires f32 rows aligned to the product event layout');
  }
  const records = [];
  const byMaterial = {};
  const metadata = Array.isArray(reactionTable?.productTermMetadata) ? reactionTable.productTermMetadata : [];
  let activeMassKg = 0;
  let unplacedMassKg = 0;
  for (let offset = 0; offset < values.length; offset += SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS) {
    const statusCode = values[offset + 18];
    if (statusCode !== 1) continue;
    const productTermIndex = Math.round(values[offset + 5] ?? 0);
    const meta = metadata.find((item) => item.productTermIndex === productTermIndex) || metadata[productTermIndex] || null;
    const materialId = values[offset + 4];
    const material = meta?.material || String(Math.round(materialId));
    const massKg = values[offset + 3];
    const moles = values[offset + 9];
    const phaseId = values[offset + 11];
    const visibleMassKg = values[offset + 12];
    const rowUnplacedMassKg = values[offset + 13];
    const routingId = values[offset + 10];
    const record = {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
      material,
      materialId,
      phaseId,
      productTermIndex,
      reactionIndex: Math.round(values[offset + 6] ?? meta?.reactionIndex ?? 0),
      sourceParticleIndex: Math.round(values[offset + 7] ?? 0),
      partnerParticleIndex: Math.round(values[offset + 8] ?? -1),
      positionM: [values[offset], values[offset + 1], values[offset + 2]],
      massKg,
      moles,
      routing: routingNameFromId(routingId, meta?.routing),
      routingId,
      visibleMassKg,
      unplacedMassKg: rowUnplacedMassKg,
      coefficient: meta?.coefficient ?? values[offset + 14],
      molarMassKgPerMol: meta?.molarMassKgPerMol ?? values[offset + 15],
      temperatureK: values[offset + 16],
      restDensityKgPerM3: values[offset + 17],
      velocityMPerS: [values[offset + 20], values[offset + 21], values[offset + 22]],
      supportVolumeM3: values[offset + 23],
      effectiveBulkModulusPa: values[offset + 24],
      shearModulusPa: values[offset + 25],
      lameLambdaPa: values[offset + 26],
      soundSpeedMPerS: values[offset + 27],
      eosModelId: values[offset + 28],
      solidFlag: values[offset + 29],
      mechanicsStatus: values[offset + 30],
      status: 'ready',
      statusCode,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    records.push(record);
    activeMassKg += massKg;
    unplacedMassKg += rowUnplacedMassKg;
    const key = String(record.material || Math.round(record.materialId)).toLowerCase();
    const bucket = byMaterial[key] || (byMaterial[key] = {
      material: key,
      materialId: record.materialId,
      massKg: 0,
      moles: 0,
      visibleMassKg: 0,
      unplacedMassKg: 0,
      eventCount: 0,
      productTermIndices: [],
      fullParticleReadbackPerformed: false
    });
    bucket.massKg += record.massKg;
    bucket.moles += record.moles;
    bucket.visibleMassKg += record.visibleMassKg;
    bucket.unplacedMassKg += record.unplacedMassKg;
    bucket.eventCount += 1;
    if (!bucket.productTermIndices.includes(record.productTermIndex)) {
      bucket.productTermIndices.push(record.productTermIndex);
    }
  }
  return {
    schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
    status: records.length ? 'product-event-sparse-storage-ready' : 'product-event-sparse-storage-empty',
    records,
    byMaterial,
    activeEventCount: records.length,
    activeMassKg,
    unplacedMassKg,
    rowCount: values.length / SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    materialCount: Object.keys(byMaterial).length,
    rowLayout: [...SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    rowStrideBytes: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    sparseStorage: true,
    renderableProductStorage: true,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  };
}

export function decodeSphReactionAtomResidualValues(values, reactionTable = null) {
  if (!(values instanceof Float32Array) || values.length % SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS !== 0) {
    throw new TypeError('decodeSphReactionAtomResidualValues requires f32 rows aligned to the atom residual layout');
  }
  const records = [];
  const atomResidualMolByZ = {};
  const metadata = Array.isArray(reactionTable?.atomTermMetadata) ? reactionTable.atomTermMetadata : [];
  let chargeResidualMol = 0;
  let readyEventCount = 0;
  let problemRowCount = 0;
  for (let offset = 0; offset < values.length; offset += SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS) {
    const atomTermIndex = offset / SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS;
    const meta = metadata[atomTermIndex] || null;
    const reactionIndex = Math.round(values[offset] ?? 0);
    const atomicNumberZ = Math.round(values[offset + 1] ?? meta?.atomicNumberZ ?? 0);
    const atomResidualMol = values[offset + 2];
    const rowChargeResidualMol = values[offset + 3];
    const eventCount = values[offset + 4];
    const termKindId = values[offset + 5];
    const termIndex = Math.round(values[offset + 6] ?? meta?.termIndex ?? 0);
    const statusCode = values[offset + 7];
    const status = statusCode === 1 ? 'ready' : 'not-ready';
    const record = {
      schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
      reactionIndex: meta?.reactionIndex ?? reactionIndex,
      atomTermIndex,
      termKind: meta?.termKind ?? (Math.round(termKindId) === 2 ? 'product' : 'reactant'),
      termKindId,
      termIndex,
      atomicNumberZ,
      atomResidualMol,
      chargeResidualMol: rowChargeResidualMol,
      eventCount,
      atomsPerFormula: meta?.atomsPerFormula ?? null,
      coefficient: meta?.coefficient ?? null,
      material: meta?.material ?? null,
      formula: meta?.formula ?? null,
      status,
      statusCode,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    records.push(record);
    if (status === 'ready') {
      if (atomicNumberZ > 0) {
        const key = String(atomicNumberZ);
        atomResidualMolByZ[key] = (atomResidualMolByZ[key] || 0) + atomResidualMol;
        if (Math.abs(atomResidualMolByZ[key]) < 1e-10) atomResidualMolByZ[key] = 0;
      }
      chargeResidualMol += rowChargeResidualMol;
      readyEventCount = Math.max(readyEventCount, eventCount);
    } else {
      problemRowCount += 1;
    }
  }
  const maxAbsAtomResidualMol = Object.values(atomResidualMolByZ)
    .reduce((max, value) => Math.max(max, Math.abs(Number(value) || 0)), 0);
  if (Math.abs(chargeResidualMol) < 1e-10) chargeResidualMol = 0;
  return {
    schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
    status: records.length ? 'atom-residual-compact-ledger-ready' : 'atom-residual-compact-ledger-empty',
    records,
    atomResidualMolByZ,
    maxAbsAtomResidualMol,
    chargeResidualMol,
    readyEventCount,
    problemRowCount,
    recordCount: records.length,
    rowLayout: [...SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS,
    rowStrideBytes: SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  };
}

export function reactionStrictGateFromSummary({
  compactSummary = null,
  atomResidualSummary = null,
  reactionTable = null,
  atomResidualToleranceMol = 1e-6,
  chargeResidualToleranceMol = 1e-6
} = {}) {
  const blockers = [];
  const warnings = [];
  const metadata = Array.isArray(reactionTable?.metadata) ? reactionTable.metadata : [];
  const provisionalEnergetics = metadata
    .map((record, reactionIndex) => ({
      reactionIndex,
      status: record?.stoichiometry?.provisionalEnergeticsStatus || null,
      energyModel: record?.energyModel || null,
      equation: record?.stoichiometry?.equation || null
    }))
    .filter((record) => record.status);
  if (provisionalEnergetics.length > 0) {
    blockers.push('provisional-energetics-not-strict');
  }
  const unbalancedAtomMetadata = metadata
    .filter((record) => record?.stoichiometry && record.stoichiometry?.atomBalance?.balanced !== true);
  if (unbalancedAtomMetadata.length > 0) {
    blockers.push('reaction-table-atom-balance-not-proven');
  }
  const maxAbsAtomResidualMol = Math.abs(Number(atomResidualSummary?.maxAbsAtomResidualMol) || 0);
  const chargeResidualMol = Math.abs(Number(atomResidualSummary?.chargeResidualMol) || 0);
  if ((atomResidualSummary?.recordCount ?? 0) > 0 && maxAbsAtomResidualMol > atomResidualToleranceMol) {
    blockers.push('atom-residual-out-of-tolerance');
  }
  if ((atomResidualSummary?.recordCount ?? 0) > 0 && chargeResidualMol > chargeResidualToleranceMol) {
    blockers.push('charge-residual-out-of-tolerance');
  }
  if ((reactionTable?.atomTermCount ?? 0) > 0 && (atomResidualSummary?.recordCount ?? 0) === 0) {
    blockers.push('atom-residual-ledger-missing');
  }
  const productMassScalingResidualKg = Number(compactSummary?.ledgerMassResidualKg) || 0;
  if (Math.abs(productMassScalingResidualKg) > 0) {
    warnings.push('product-raw-mass-scaled-to-consumed-reactant-mass');
  }
  return {
    schema: ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
    status: blockers.length ? 'strict-reaction-gate-blocked' : 'strict-reaction-gate-pass',
    blockers,
    warnings,
    reactionCount: reactionTable?.reactionCount ?? compactSummary?.reactionCount ?? 0,
    atomResidualRowCount: atomResidualSummary?.recordCount ?? 0,
    maxAbsAtomResidualMol,
    atomResidualToleranceMol,
    chargeResidualMol,
    chargeResidualToleranceMol,
    productMassScalingResidualKg,
    provisionalEnergetics,
    strictForceCouplingAllowed: blockers.length === 0,
    scientificValidation: false,
    chemistryValidation: false,
    fullPhysicsValidation: false
  };
}

export async function runSphReactionSummaryWebGpu({
  device,
  sphParticleState,
  reactionTable,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  nextStateBuffer = null,
  nextThermoBuffer = null,
  reactionRecordBuffer = null,
  proposalBuffer = null,
  readProductEvents = false,
  retainProductEventBuffer = false,
  readCompactSummary = true,
  readGasSpeciesSummary = true,
  readProductInventory = true,
  readAtomResidual = true
} = {}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphReactionSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertInputs({ sphParticleState, reactionTable });
  if (!sourceStateBuffer || !sourceThermoBuffer || !nextStateBuffer || !nextThermoBuffer) {
    throw new TypeError('SPH reaction summary requires retained source and output state/thermo buffers');
  }

  const particleCount = sphParticleState.particleCount;
  const partialCount = Math.max(1, Math.ceil(particleCount / SUMMARY_WORKGROUP_SIZE));
  const summaryByteLength = SPH_GPU_REACTION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const partialsByteLength = partialCount * summaryByteLength;
  const productTermCount = Math.max(0, reactionTable.productTermCount ?? 0);
  const gasProductCount = Math.max(0, reactionTable.gasProductCount ?? 0);
  const gasSpeciesCount = gasProductCount;
  const gasSpeciesByteLength = gasSpeciesCount * SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const productInventoryCount = productTermCount;
  const productInventoryByteLength = productInventoryCount * SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const productEventCount = Math.max(0, particleCount * (reactionTable.productTermCount ?? 0));
  const useProductEventBuffer = productEventCount > 0 && (readProductEvents || retainProductEventBuffer);
  const productEventWorkgroupCount = Math.max(1, Math.ceil(Math.max(1, productEventCount) / SUMMARY_WORKGROUP_SIZE));
  const productEventByteLength = productEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const atomResidualCount = Math.max(0, reactionTable.atomTermCount ?? 0);
  const atomResidualByteLength = atomResidualCount * SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const shouldReadCompactSummary = readCompactSummary !== false;
  const shouldReadGasSpeciesSummary = readGasSpeciesSummary !== false;
  const shouldReadProductInventory = readProductInventory !== false;
  const shouldReadAtomResidual = readAtomResidual !== false;
  const shouldRunProductInventory = productInventoryCount > 0 && shouldReadProductInventory;
  const shouldRunGasSpecies = gasSpeciesCount > 0 && shouldReadGasSpeciesSummary;
  const shouldRunAtomResidual = atomResidualCount > 0 && shouldReadAtomResidual;
  const borrowedReactionRecordBuffer = Boolean(reactionRecordBuffer);
  const recordsBuffer = reactionRecordBuffer || writeStorageBuffer(
    device,
    'ulg-sph-reaction-summary-records',
    reactionTable.combinedRecords || new Float32Array([
      ...(reactionTable.records || []),
      ...(reactionTable.productPhaseRecords || []),
      ...(reactionTable.reactionHeaders || []),
      ...(reactionTable.reactantTermRecords || []),
      ...(reactionTable.productTermRecords || []),
      ...(reactionTable.gasProductRecords || []),
      ...(reactionTable.atomTermRecords || [])
    ])
  );
  const borrowedProposalBuffer = Boolean(proposalBuffer);
  const proposalsBuffer = proposalBuffer || writeStorageBuffer(
    device,
    'ulg-sph-reaction-summary-proposals-empty',
    new Float32Array(Math.max(1, particleCount * 4))
  );
  const partialsBuffer = shouldReadCompactSummary ? device.createBuffer({
    label: 'ulg-sph-reaction-summary-partials',
    size: Math.max(4, partialsByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE
  }) : null;
  const summaryBuffer = shouldReadCompactSummary ? device.createBuffer({
    label: 'ulg-sph-reaction-summary-out',
    size: summaryByteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }) : null;
  const readBuffer = shouldReadCompactSummary ? device.createBuffer({
    label: 'ulg-sph-reaction-summary-readback',
    size: summaryByteLength,
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const gasSpeciesBuffer = shouldRunGasSpecies ? device.createBuffer({
    label: 'ulg-sph-reaction-gas-species-summary-out',
    size: Math.max(4, gasSpeciesByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }) : null;
  const gasSpeciesReadBuffer = shouldRunGasSpecies ? device.createBuffer({
    label: 'ulg-sph-reaction-gas-species-summary-readback',
    size: Math.max(4, gasSpeciesByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const productInventoryBuffer = shouldRunProductInventory ? device.createBuffer({
    label: 'ulg-sph-reaction-product-inventory-out',
    size: Math.max(4, productInventoryByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }) : null;
  const productInventoryReadBuffer = shouldRunProductInventory ? device.createBuffer({
    label: 'ulg-sph-reaction-product-inventory-readback',
    size: Math.max(4, productInventoryByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const productEventBuffer = useProductEventBuffer ? tagWebGpuBufferDevice(device.createBuffer({
    label: 'ulg-sph-reaction-product-event-out',
    size: Math.max(4, productEventByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }), device) : null;
  let retainedProductEventBuffer = false;
  const productEventReadBuffer = useProductEventBuffer && readProductEvents ? device.createBuffer({
    label: 'ulg-sph-reaction-product-event-readback',
    size: Math.max(4, productEventByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const atomResidualBuffer = shouldRunAtomResidual ? device.createBuffer({
    label: 'ulg-sph-reaction-atom-residual-out',
    size: Math.max(4, atomResidualByteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC
  }) : null;
  const atomResidualReadBuffer = shouldRunAtomResidual ? device.createBuffer({
    label: 'ulg-sph-reaction-atom-residual-readback',
    size: Math.max(4, atomResidualByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const paramsBuffer = device.createBuffer({
    label: 'ulg-sph-reaction-summary-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  let deferLocalBufferCleanup = false;
  let localBuffersDestroyed = false;
  const destroyLocalBuffers = () => {
    if (localBuffersDestroyed) return;
    localBuffersDestroyed = true;
    if (!borrowedReactionRecordBuffer) recordsBuffer.destroy?.();
    if (!borrowedProposalBuffer) proposalsBuffer.destroy?.();
    partialsBuffer?.destroy?.();
    summaryBuffer?.destroy?.();
    readBuffer?.destroy?.();
    gasSpeciesBuffer?.destroy?.();
    gasSpeciesReadBuffer?.destroy?.();
    productInventoryBuffer?.destroy?.();
    productInventoryReadBuffer?.destroy?.();
    if (!retainedProductEventBuffer) productEventBuffer?.destroy?.();
    productEventReadBuffer?.destroy?.();
    atomResidualBuffer?.destroy?.();
    atomResidualReadBuffer?.destroy?.();
    paramsBuffer.destroy?.();
  };

  try {
    device.queue.writeBuffer(paramsBuffer, 0, createSummaryParamsArray({
      particleCount,
      reactionCount: reactionTable.reactionCount ?? 0,
      productPhaseCount: reactionTable.productPhaseCount ?? 0,
      reactantTermCount: reactionTable.reactantTermCount ?? 0,
      productTermCount: reactionTable.productTermCount ?? 0,
      gasProductCount: reactionTable.gasProductCount ?? 0,
      atomTermCount: reactionTable.atomTermCount ?? 0,
      partialCount,
      hasProposals: borrowedProposalBuffer
    }));
    let partialsPipeline = null;
    let partialsBindGroup = null;
    let finalizePipeline = null;
    let finalizeBindGroup = null;
    if (shouldReadCompactSummary) {
      const partialsInfo = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-reaction-summary-partials',
        label: 'ulg-sph-reaction-summary-partials',
        code: sphReactionSummaryPartialsWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'read-only-storage'),
          computeBufferBinding(3, 'read-only-storage'),
          computeBufferBinding(4, 'read-only-storage'),
          computeBufferBinding(5, 'storage'),
          computeBufferBinding(6, 'uniform'),
          computeBufferBinding(7, 'read-only-storage')
        ]
      });
      partialsPipeline = partialsInfo.pipeline;
      partialsBindGroup = device.createBindGroup({
        layout: partialsInfo.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: sourceStateBuffer } },
          { binding: 1, resource: { buffer: sourceThermoBuffer } },
          { binding: 2, resource: { buffer: nextStateBuffer } },
          { binding: 3, resource: { buffer: nextThermoBuffer } },
          { binding: 4, resource: { buffer: recordsBuffer } },
          { binding: 5, resource: { buffer: partialsBuffer } },
          { binding: 6, resource: { buffer: paramsBuffer } },
          { binding: 7, resource: { buffer: proposalsBuffer } }
        ]
      });
      const finalizeInfo = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-reaction-summary-finalize',
        label: 'ulg-sph-reaction-summary-finalize',
        code: sphReactionSummaryFinalizeWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'storage'),
          computeBufferBinding(2, 'uniform')
        ]
      });
      finalizePipeline = finalizeInfo.pipeline;
      finalizeBindGroup = device.createBindGroup({
        layout: finalizeInfo.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: partialsBuffer } },
          { binding: 1, resource: { buffer: summaryBuffer } },
          { binding: 2, resource: { buffer: paramsBuffer } }
        ]
      });
    }
    let gasSpeciesPipeline = null;
    let gasSpeciesBindGroup = null;
    let productInventoryPipeline = null;
    let productInventoryBindGroup = null;
    let productEventPipeline = null;
    let productEventBindGroup = null;
    let atomResidualPipeline = null;
    let atomResidualBindGroup = null;
    if (shouldRunProductInventory) {
      const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-reaction-product-inventory',
        label: 'ulg-sph-reaction-product-inventory',
        code: sphReactionProductInventoryWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'read-only-storage'),
          computeBufferBinding(3, 'read-only-storage'),
          computeBufferBinding(4, 'read-only-storage'),
          computeBufferBinding(5, 'read-only-storage'),
          computeBufferBinding(6, 'storage'),
          computeBufferBinding(7, 'uniform')
        ]
      });
      productInventoryPipeline = pipeline;
      productInventoryBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: sourceStateBuffer } },
          { binding: 1, resource: { buffer: sourceThermoBuffer } },
          { binding: 2, resource: { buffer: nextStateBuffer } },
          { binding: 3, resource: { buffer: nextThermoBuffer } },
          { binding: 4, resource: { buffer: recordsBuffer } },
          { binding: 5, resource: { buffer: proposalsBuffer } },
          { binding: 6, resource: { buffer: productInventoryBuffer } },
          { binding: 7, resource: { buffer: paramsBuffer } }
        ]
      });
    }
    if (useProductEventBuffer) {
      const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-reaction-product-event',
        label: 'ulg-sph-reaction-product-event',
        code: sphReactionProductEventWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'read-only-storage'),
          computeBufferBinding(3, 'read-only-storage'),
          computeBufferBinding(4, 'read-only-storage'),
          computeBufferBinding(5, 'read-only-storage'),
          computeBufferBinding(6, 'storage'),
          computeBufferBinding(7, 'uniform')
        ]
      });
      productEventPipeline = pipeline;
      productEventBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: sourceStateBuffer } },
          { binding: 1, resource: { buffer: sourceThermoBuffer } },
          { binding: 2, resource: { buffer: nextStateBuffer } },
          { binding: 3, resource: { buffer: nextThermoBuffer } },
          { binding: 4, resource: { buffer: recordsBuffer } },
          { binding: 5, resource: { buffer: proposalsBuffer } },
          { binding: 6, resource: { buffer: productEventBuffer } },
          { binding: 7, resource: { buffer: paramsBuffer } }
        ]
      });
    }
    if (shouldRunAtomResidual) {
      const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-reaction-atom-residual',
        label: 'ulg-sph-reaction-atom-residual',
        code: sphReactionAtomResidualWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'read-only-storage'),
          computeBufferBinding(3, 'read-only-storage'),
          computeBufferBinding(4, 'storage'),
          computeBufferBinding(5, 'uniform')
        ]
      });
      atomResidualPipeline = pipeline;
      atomResidualBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: sourceStateBuffer } },
          { binding: 1, resource: { buffer: sourceThermoBuffer } },
          { binding: 2, resource: { buffer: recordsBuffer } },
          { binding: 3, resource: { buffer: proposalsBuffer } },
          { binding: 4, resource: { buffer: atomResidualBuffer } },
          { binding: 5, resource: { buffer: paramsBuffer } }
        ]
      });
    }
    if (shouldRunGasSpecies) {
      const { pipeline, bindGroupLayout } = createCachedExplicitComputePipeline(device, {
        cacheKey: 'ulg-sph-reaction-gas-species-summary',
        label: 'ulg-sph-reaction-gas-species-summary',
        code: sphReactionGasSpeciesSummaryWgsl,
        entryPoint: 'main',
        bindings: [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'read-only-storage'),
          computeBufferBinding(2, 'read-only-storage'),
          computeBufferBinding(3, 'read-only-storage'),
          computeBufferBinding(4, 'read-only-storage'),
          computeBufferBinding(5, 'read-only-storage'),
          computeBufferBinding(6, 'storage'),
          computeBufferBinding(7, 'uniform')
        ]
      });
      gasSpeciesPipeline = pipeline;
      gasSpeciesBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: sourceStateBuffer } },
          { binding: 1, resource: { buffer: sourceThermoBuffer } },
          { binding: 2, resource: { buffer: nextStateBuffer } },
          { binding: 3, resource: { buffer: nextThermoBuffer } },
          { binding: 4, resource: { buffer: recordsBuffer } },
          { binding: 5, resource: { buffer: proposalsBuffer } },
          { binding: 6, resource: { buffer: gasSpeciesBuffer } },
          { binding: 7, resource: { buffer: paramsBuffer } }
        ]
      });
    }
    const encoder = device.createCommandEncoder();
    if (shouldReadCompactSummary && partialsPipeline && partialsBindGroup && finalizePipeline && finalizeBindGroup) {
      const partialsPass = encoder.beginComputePass();
      partialsPass.setPipeline(partialsPipeline);
      partialsPass.setBindGroup(0, partialsBindGroup);
      partialsPass.dispatchWorkgroups(partialCount);
      partialsPass.end();
      const finalizePass = encoder.beginComputePass();
      finalizePass.setPipeline(finalizePipeline);
      finalizePass.setBindGroup(0, finalizeBindGroup);
      finalizePass.dispatchWorkgroups(1);
      finalizePass.end();
    }
    if (productInventoryPipeline && productInventoryBindGroup && shouldRunProductInventory) {
      const productInventoryPass = encoder.beginComputePass();
      productInventoryPass.setPipeline(productInventoryPipeline);
      productInventoryPass.setBindGroup(0, productInventoryBindGroup);
      productInventoryPass.dispatchWorkgroups(productInventoryCount);
      productInventoryPass.end();
      encoder.copyBufferToBuffer(productInventoryBuffer, 0, productInventoryReadBuffer, 0, productInventoryByteLength);
    }
    if (productEventPipeline && productEventBindGroup && useProductEventBuffer) {
      const productEventPass = encoder.beginComputePass();
      productEventPass.setPipeline(productEventPipeline);
      productEventPass.setBindGroup(0, productEventBindGroup);
      productEventPass.dispatchWorkgroups(productEventWorkgroupCount);
      productEventPass.end();
      if (productEventReadBuffer) {
        encoder.copyBufferToBuffer(productEventBuffer, 0, productEventReadBuffer, 0, productEventByteLength);
      }
    }
    if (atomResidualPipeline && atomResidualBindGroup && shouldRunAtomResidual) {
      const atomResidualPass = encoder.beginComputePass();
      atomResidualPass.setPipeline(atomResidualPipeline);
      atomResidualPass.setBindGroup(0, atomResidualBindGroup);
      atomResidualPass.dispatchWorkgroups(atomResidualCount);
      atomResidualPass.end();
      encoder.copyBufferToBuffer(atomResidualBuffer, 0, atomResidualReadBuffer, 0, atomResidualByteLength);
    }
    if (gasSpeciesPipeline && gasSpeciesBindGroup && shouldRunGasSpecies) {
      const gasPass = encoder.beginComputePass();
      gasPass.setPipeline(gasSpeciesPipeline);
      gasPass.setBindGroup(0, gasSpeciesBindGroup);
      gasPass.dispatchWorkgroups(gasSpeciesCount);
      gasPass.end();
      encoder.copyBufferToBuffer(gasSpeciesBuffer, 0, gasSpeciesReadBuffer, 0, gasSpeciesByteLength);
    }
    if (shouldReadCompactSummary) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, summaryByteLength);
    }
    device.queue.submit([encoder.finish()]);
    retainedProductEventBuffer = retainProductEventBuffer && Boolean(productEventBuffer);
    const destroyProductEventBuffer = retainedProductEventBuffer
      ? () => productEventBuffer.destroy?.()
      : null;
    const emptyGasSpeciesLedger = {
      schema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
      status: shouldRunGasSpecies ? 'gas-species-compact-ledger-pending-readback' : 'gas-species-compact-ledger-not-run',
      records: [],
      bySpecies: {},
      recordCount: 0,
      speciesCount: 0,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    const emptyProductInventory = {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
      status: shouldRunProductInventory ? 'product-inventory-compact-ledger-pending-readback' : 'product-inventory-compact-ledger-not-run',
      records: [],
      byMaterial: {},
      recordCount: 0,
      materialCount: 0,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    const residentProductEvents = {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
      status: useProductEventBuffer ? 'product-event-sparse-storage-gpu-resident' : 'product-event-sparse-storage-not-run',
      records: [],
      byMaterial: {},
      activeEventCount: 0,
      activeMassKg: 0,
      unplacedMassKg: 0,
      rowCount: useProductEventBuffer ? productEventCount : 0,
      materialCount: 0,
      rowLayout: [...SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT],
      rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
      rowStrideBytes: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
      sparseStorage: true,
      renderableProductStorage: true,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    const emptyAtomResidualSummary = {
      schema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
      status: shouldRunAtomResidual ? 'atom-residual-compact-ledger-pending-readback' : 'atom-residual-compact-ledger-not-run',
      records: [],
      atomResidualMolByZ: {},
      maxAbsAtomResidualMol: 0,
      chargeResidualMol: 0,
      readyEventCount: 0,
      problemRowCount: 0,
      recordCount: 0,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    if (!shouldReadCompactSummary) {
      deferLocalBufferCleanup = true;
      return {
        schema: ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
        executionSchema: ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
        backend: 'webgpu',
        status: useProductEventBuffer
          ? 'reaction-resident-product-event-buffer-ready'
          : 'reaction-resident-summary-readback-skipped',
        kernelScope: SUMMARY_SCOPE,
        reductionStrategy: 'skipped-resident-product-event-buffer-only',
        particleCount,
        reactionCount: reactionTable.reactionCount ?? 0,
        productTermCount,
        gasProductCount,
        changedMaterialCount: null,
        changedMassCount: null,
        visibleProductMassKg: null,
        visibleGasProductMassKg: null,
        outputGasPhaseMassKg: null,
        sourceMassKg: null,
        nextMassKg: null,
        massDeltaKg: null,
        thermalReadyCount: null,
        thermalProblemCount: null,
        finiteTemperatureCount: null,
        reactionSummaryAvailable: false,
        canonicalReactionEventCount: null,
        consumedReactantMassKg: null,
        expectedProductMassKg: null,
        rawProductMassKg: null,
        ledgerVisibleProductMassKg: null,
        ledgerUnplacedProductMassKg: null,
        ledgerGasProductMassKg: null,
        ledgerVisibleGasProductMassKg: null,
        ledgerUnplacedGasProductMassKg: null,
        sealedBoxGasProductMoles: null,
        reactionHeatJ: null,
        ledgerMassResidualKg: null,
        ledgerReadyEventCount: null,
        ledgerProblemEventCount: null,
        proposalMutualPairCount: null,
        compactLedgerAvailable: false,
        visibleOnly: true,
        unplacedProductInventoryIncluded: false,
        readbackMode: 'resident-product-event-buffer-no-readback',
        fullParticleReadbackPerformed: false,
        compactSummaryReadbackSkipped: true,
        compactSummaryReadbackSkipReason: 'resident no-full hot loop retains GPU product-event sidecar without CPU mapAsync',
        localBufferCleanupStatus: typeof device.queue?.onSubmittedWorkDone === 'function'
          ? 'deferred-until-queue-complete'
          : 'pending-no-queue-fence',
        rowLayout: [...SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT],
        summaryStrideFloats: SPH_GPU_REACTION_SUMMARY_FLOATS,
        summaryStrideBytes: SPH_GPU_REACTION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        gasSpeciesLedger: emptyGasSpeciesLedger,
        gasSpeciesLedgerSchema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        gasSpeciesLedgerCount: 0,
        gasSpeciesReadbackFloatCount: 0,
        gasSpeciesReadbackByteLength: 0,
        productInventory: emptyProductInventory,
        productInventorySchema: ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
        productInventoryCount: 0,
        productInventoryReadbackFloatCount: 0,
        productInventoryReadbackByteLength: 0,
        productEvents: residentProductEvents,
        productEventSchema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
        productEventRowCount: residentProductEvents.rowCount,
        productEventActiveEventCount: residentProductEvents.activeEventCount,
        productEventReadbackFloatCount: 0,
        productEventReadbackByteLength: 0,
        productEventBufferByteLength: useProductEventBuffer ? productEventByteLength : 0,
        productEventDevice: retainedProductEventBuffer ? device : null,
        productEventWorkgroupCount,
        productEventBufferRetained: retainedProductEventBuffer,
        productEventBuffer: retainedProductEventBuffer ? productEventBuffer : null,
        destroyProductEventBuffer,
        atomResidualSummary: emptyAtomResidualSummary,
        atomResidualSchema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
        atomResidualCount: 0,
        atomResidualReadbackFloatCount: 0,
        atomResidualReadbackByteLength: 0,
        strictReactionGate: {
          schema: ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
          status: 'strict-reaction-gate-not-run-resident-no-readback',
          blockers: ['compact reaction ledger readback skipped'],
          warnings: [],
          strictForceCouplingAllowed: false,
          scientificValidation: false,
          chemistryValidation: false,
          fullPhysicsValidation: false
        },
        strictReactionGateSchema: ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
        compactReadbackFloatCount: 0,
        compactReadbackByteLength: 0,
        compactPartialSummaryCount: 0,
        compactPartialSummaryByteLength: 0,
        compactReductionWorkgroupSize: SUMMARY_WORKGROUP_SIZE,
        sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
        sourceThermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
        compactLedgerProposalBufferBound: borrowedProposalBuffer,
        scientificValidation: false,
        chemistryValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      };
    }
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const values = new Float32Array(readBuffer.getMappedRange()).slice(0, SPH_GPU_REACTION_SUMMARY_FLOATS);
    readBuffer.unmap();
    let gasSpeciesLedger = emptyGasSpeciesLedger;
    if (gasSpeciesReadBuffer && gasSpeciesByteLength > 0) {
      await gasSpeciesReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const gasValues = new Float32Array(gasSpeciesReadBuffer.getMappedRange()).slice(0, gasSpeciesCount * SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS);
      gasSpeciesReadBuffer.unmap();
      gasSpeciesLedger = decodeSphReactionGasSpeciesSummaryValues(gasValues, reactionTable);
    }
    let productInventory = emptyProductInventory;
    if (productInventoryReadBuffer && productInventoryByteLength > 0) {
      await productInventoryReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const inventoryValues = new Float32Array(productInventoryReadBuffer.getMappedRange()).slice(0, productInventoryCount * SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS);
      productInventoryReadBuffer.unmap();
      productInventory = decodeSphReactionProductInventoryValues(inventoryValues, reactionTable);
    }
    let productEvents = residentProductEvents;
    if (productEventReadBuffer && productEventByteLength > 0) {
      await productEventReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const productEventValues = new Float32Array(productEventReadBuffer.getMappedRange()).slice(0, productEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
      productEventReadBuffer.unmap();
      productEvents = decodeSphReactionProductEventValues(productEventValues, reactionTable);
    }
    let atomResidualSummary = emptyAtomResidualSummary;
    if (atomResidualReadBuffer && atomResidualByteLength > 0) {
      await atomResidualReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const residualValues = new Float32Array(atomResidualReadBuffer.getMappedRange()).slice(0, atomResidualCount * SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS);
      atomResidualReadBuffer.unmap();
      atomResidualSummary = decodeSphReactionAtomResidualValues(residualValues, reactionTable);
    }
    const compactSummary = decodeSphReactionSummaryValues(values);
    const strictReactionGate = reactionStrictGateFromSummary({
      compactSummary,
      atomResidualSummary,
      reactionTable
    });
    return {
      ...compactSummary,
      gasSpeciesLedger,
      gasSpeciesLedgerSchema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
      gasSpeciesLedgerCount: gasSpeciesLedger.recordCount,
      gasSpeciesReadbackFloatCount: gasSpeciesLedger.recordCount * SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS,
      gasSpeciesReadbackByteLength: gasSpeciesByteLength,
      productInventory,
      productInventorySchema: ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
      productInventoryCount: productInventory.recordCount,
      productInventoryReadbackFloatCount: productInventory.recordCount * SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS,
      productInventoryReadbackByteLength: productInventoryByteLength,
      productEvents,
      productEventSchema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
      productEventRowCount: productEvents.rowCount,
      productEventActiveEventCount: productEvents.activeEventCount,
      productEventReadbackFloatCount: productEventReadBuffer ? productEvents.rowCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS : 0,
      productEventReadbackByteLength: productEventReadBuffer ? productEventByteLength : 0,
      productEventBufferByteLength: useProductEventBuffer ? productEventByteLength : 0,
      productEventDevice: retainedProductEventBuffer ? device : null,
      productEventWorkgroupCount,
      productEventBufferRetained: retainedProductEventBuffer,
      productEventBuffer: retainedProductEventBuffer ? productEventBuffer : null,
      destroyProductEventBuffer,
      atomResidualSummary,
      atomResidualSchema: ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
      atomResidualCount: atomResidualSummary.recordCount,
      atomResidualReadbackFloatCount: atomResidualSummary.recordCount * SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS,
      atomResidualReadbackByteLength: atomResidualByteLength,
      strictReactionGate,
      strictReactionGateSchema: ULG_SPH_REACTION_STRICT_GATE_SCHEMA,
      compactReadbackFloatCount: SPH_GPU_REACTION_SUMMARY_FLOATS,
      compactReadbackByteLength: summaryByteLength,
      compactPartialSummaryCount: partialCount,
      compactPartialSummaryByteLength: partialsByteLength,
      compactReductionWorkgroupSize: SUMMARY_WORKGROUP_SIZE,
      sourceStateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
      sourceThermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
      compactLedgerProposalBufferBound: borrowedProposalBuffer
    };
  } finally {
    if (deferLocalBufferCleanup) {
      const cleanupFence = typeof device.queue?.onSubmittedWorkDone === 'function'
        ? device.queue.onSubmittedWorkDone()
        : null;
      if (cleanupFence?.then) {
        cleanupFence.then(destroyLocalBuffers, destroyLocalBuffers);
      }
    } else {
      destroyLocalBuffers();
    }
  }
}
