import {
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_INVENTORY_ROW_LAYOUT,
  SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION,
  SPH_REACTION_STRICT_GATE_BLOCKER,
  SPH_REACTION_STRICT_GATE_BYTES,
  SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE,
  SPH_REACTION_STRICT_GATE_INDEX,
  SPH_REACTION_STRICT_GATE_LAYOUT,
  SPH_REACTION_STRICT_GATE_MAGIC,
  SPH_REACTION_STRICT_GATE_PARAMS_BYTES,
  SPH_REACTION_STRICT_GATE_PARAMS_INDEX,
  SPH_REACTION_STRICT_GATE_PARAMS_LAYOUT,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_BYTES,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_LAYOUT,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS,
  SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT,
  SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS,
  SPH_REACTION_STRICT_GATE_STATUS,
  SPH_REACTION_STRICT_GATE_VERSION,
  SPH_REACTION_STRICT_GATE_WORDS,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA,
  ULG_SPH_REACTION_STRICT_GATE_PRODUCER_SHADOW_SCHEMA,
  createSphReactionStrictGateProducerShadow,
  createSphReactionStrictGateProducerReceipt,
  createSphReactionStrictGateBlockedSentinel,
  createSphReactionStrictGateFinalizeParams,
  decodeSphReactionStrictGateProducerReceipt,
  finalizeSphReactionStrictGateCpu,
  hashSphReactionStrictGateF32Rows,
  validateSphReactionStrictGateControl,
  validateSphReactionStrictGateProducerReceipt
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphReactionProductEventCompactWgsl,
  sphReactionProductEventPlacementEnvelopeWgsl,
  sphReactionProductEventPlacementWgsl,
  sphReactionAtomResidualWgsl,
  sphReactionGasSpeciesSummaryWgsl,
  sphReactionProductEventWgsl,
  sphReactionProductInventoryWgsl,
  sphReactionStrictGateFinalizeWgsl,
  sphReactionSummaryFinalizeWgsl,
  sphReactionSummaryPartialsWgsl
} from '../../../ulg-gpu-abi/src/wgsl.js';
import {
  sphReactionProductEventSpatialClassificationV2Wgsl,
  sphReactionProductEventSpatialClassificationWgsl,
  sphReactionProductSpareAssignWgsl,
  sphReactionProductSpareEventMarkWgsl,
  sphReactionProductSpareGroupScanWgsl,
  sphReactionProductSpareParticleMarkWgsl,
  sphReactionProductSpareScatterWgsl
} from '../../../ulg-gpu-abi/src/sphReactionProductEventSpatialClassificationWgsl.js';
import {
  SCHROEDER_SPATIAL_EPOCH_VERSION,
  SCHROEDER_SPATIAL_EPOCH_V2_VERSION
} from '../../../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from './sphGpuBuffers.js';
import {
  computeBufferBinding,
  createQueueOrderedCleanupClaimIssuer,
  createCachedExplicitComputePipeline,
  deferSubmittedWorkCleanup,
  registerQueueOrderedCleanupClaim,
  submitQueueOrderedFinalConsumerWork,
  releaseSubmittedWorkCleanupQueueOrdered
} from '../webgpuComputeLayout.js';
import {
  tagResidentProductMassDevice,
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from './sphGpuDeviceIdentity.js';
import {
  acquireSphReactionProductPlacementSegmentedArenaWebGpu,
  discardSphReactionProductPlacementSegmentedArenaLease,
  encodeSphReactionProductPlacementSegmentedWebGpu,
  finalizeSchroederSpatialReactionProductPlacementAuthority,
  observeSchroederSpatialReactionProductPlacementCompletion,
  releaseSphReactionProductPlacementSegmentedArenaAfterQueue,
  resolveSchroederSpatialReactionProductPlacementAuthority,
  sealSchroederSpatialReactionProductPlacementEncoding,
  submitSchroederSpatialReactionProductPlacementWebGpu
} from './schroederSpatialReactionProductPlacementGpu.js';
import {
  resolveSphReactionWarmArenaLease
} from './schroederSpatialReactionPlacementEpochGpu.js';
import {
  createGpuReadbackTelemetryAccumulator
} from './sphGpuReadbackTelemetry.js';

export {
  ULG_SPH_GPU_REACTION_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_REACTION_ATOM_RESIDUAL_SCHEMA,
  ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
  ULG_SPH_GPU_REACTION_PRODUCT_INVENTORY_SCHEMA,
  ULG_SPH_GPU_REACTION_SUMMARY_SCHEMA,
  ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA,
  ULG_SPH_REACTION_STRICT_GATE_PRODUCER_SHADOW_SCHEMA,
  SPH_REACTION_STRICT_GATE_BLOCKER,
  SPH_REACTION_STRICT_GATE_BYTES,
  SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE,
  SPH_REACTION_STRICT_GATE_INDEX,
  SPH_REACTION_STRICT_GATE_LAYOUT,
  SPH_REACTION_STRICT_GATE_MAGIC,
  SPH_REACTION_STRICT_GATE_PARAMS_BYTES,
  SPH_REACTION_STRICT_GATE_PARAMS_INDEX,
  SPH_REACTION_STRICT_GATE_PARAMS_LAYOUT,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_BYTES,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_INDEX,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_LAYOUT,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
  SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS,
  SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT,
  SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS,
  SPH_REACTION_STRICT_GATE_STATUS,
  SPH_REACTION_STRICT_GATE_VERSION,
  SPH_REACTION_STRICT_GATE_WORDS,
  createSphReactionStrictGateBlockedSentinel,
  createSphReactionStrictGateFinalizeParams,
  createSphReactionStrictGateProducerShadow,
  createSphReactionStrictGateProducerReceipt,
  decodeSphReactionStrictGateProducerReceipt,
  finalizeSphReactionStrictGateCpu,
  hashSphReactionStrictGateF32Rows,
  validateSphReactionStrictGateControl,
  validateSphReactionStrictGateProducerReceipt,
  sphReactionAtomResidualWgsl,
  sphReactionGasSpeciesSummaryWgsl,
  sphReactionProductEventCompactWgsl,
  sphReactionProductEventWgsl,
  sphReactionProductInventoryWgsl,
  sphReactionStrictGateFinalizeWgsl,
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
export const SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS =
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROWS =
  SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS / 4;
export const SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS = SPH_GPU_REACTION_ATOM_RESIDUAL_ROW_LAYOUT.length;
export const SPH_GPU_REACTION_ATOM_RESIDUAL_ROWS = SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS / 4;
const SPH_GPU_REACTION_ATOM_TERM_FLOATS =
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length;

const SUMMARY_WORKGROUP_SIZE = 64;
const SUMMARY_SCOPE = 'sph-reaction-visible-product-gas-compact-summary';
const reactionSummaryLocalCleanupClaimIssuer =
  createQueueOrderedCleanupClaimIssuer({
    producerFamily: 'sph-reaction-summary-local-buffers'
  });
export const ULG_SPH_REACTION_STRICT_GATE_SCHEMA = 'peercompute.ulg.sph-reaction-strict-gate.v0';
export const ULG_SPH_RESIDENT_PRODUCT_MASS_SCHEMA = 'peercompute.ulg.sph-resident-product-mass.v0';

export function strictReactionGateAllowsForceCoupling(gate = null) {
  return gate?.schema === ULG_SPH_REACTION_STRICT_GATE_SCHEMA
    && gate?.status === 'strict-reaction-gate-pass'
    && gate?.strictForceCouplingAllowed === true;
}

export function strictReactionGateIsClassified(gate = null) {
  return strictReactionGateAllowsForceCoupling(gate)
    || (
      gate?.schema === ULG_SPH_REACTION_STRICT_GATE_SCHEMA
      && gate?.status === 'strict-reaction-gate-blocked'
      && gate?.strictForceCouplingAllowed !== true
    );
}

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

function beginReactionSummaryTimestampSpan(
  gpuTimestampRecorder,
  encoder,
  descriptor
) {
  return gpuTimestampRecorder?.active === true
    && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
    && typeof gpuTimestampRecorder.endEncoderSpan === 'function'
    ? gpuTimestampRecorder.beginEncoderSpan(encoder, descriptor)
    : null;
}

function endReactionSummaryTimestampSpan(
  gpuTimestampRecorder,
  encoder,
  token
) {
  if (!token) return;
  gpuTimestampRecorder.endEncoderSpan(encoder, token);
}

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
  hasProposals = false,
  dtSeconds = 0
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
  // Interface-flux extent law substep duration (f32 in the _pad1 lane); must
  // match the apply kernel's dt so ledger and application agree.
  view.setFloat32(36, Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0, true);
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

const PRODUCT_EVENT_DISPOSITIONS = Object.freeze({
  0: 'invalid-or-empty',
  1: 'pending',
  2: 'direct-only',
  3: 'spare-slot',
  4: 'radius-capture-merge',
  5: 'fallback-merge',
  6: 'subthreshold-unplaced',
  7: 'no-carrier-unplaced',
  8: 'rejected'
});

function productEventDispositionName(id) {
  return PRODUCT_EVENT_DISPOSITIONS[Math.round(Number(id) || 0)] || 'unknown';
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
  let destroyPromise = null;
  let activeBorrowCount = 0;
  const borrowDrainWaiters = new Set();
  const waitForBorrowDrain = () => activeBorrowCount === 0
    ? Promise.resolve(true)
    : new Promise((resolve) => borrowDrainWaiters.add(resolve));
  const destroyResidentProductMassBuffers = retainedProductEventBuffer && sourceDestroy
    ? () => {
        if (destroyPromise) return destroyPromise;
        if (destroyed || reactionSummary.productEventBufferDestroyed) {
          return Promise.resolve(true);
        }
        destroyed = true;
        reactionSummary.productEventBufferDestroyed = true;
        // A warm product-event buffer is part of the same exact arena as the
        // reaction destinations. Return a completion promise so the arena
        // owner cannot recycle that buffer while an asynchronous consumer is
        // pinned before its eventual submit.
        if (activeBorrowCount === 0) {
          sourceDestroy();
          destroyPromise = Promise.resolve(true);
        } else {
          destroyPromise = waitForBorrowDrain().then(() => {
            sourceDestroy();
            return true;
          });
        }
        return destroyPromise;
      }
    : null;
  const productPlacementProvenance = reactionSummary.productPlacementProvenance?.schema
    === ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA
    ? { ...reactionSummary.productPlacementProvenance }
    : null;
  const prePlacementUnplacedProductMassKg = Number(reactionSummary.ledgerUnplacedProductMassKg)
    || Number(productEvents?.unplacedMassKg)
    || sumProductInventoryMass(productInventory, 'unplacedMassKg');
  const unplacedProductMassKg = productPlacementProvenance?.available
    ? (Number(productPlacementProvenance.unplacedMassKg) || 0)
    : prePlacementUnplacedProductMassKg;
  const placedProductMassKg = Number(productPlacementProvenance?.placedMassKg) || 0;
  const mergedProductMassKg = Number(productPlacementProvenance?.mergedMassKg) || 0;
  const visibleProductMassKg = Number(reactionSummary.ledgerVisibleProductMassKg)
    || sumProductInventoryMass(productInventory, 'visibleMassKg');
  const unplacedGasProductMassKg = productPlacementProvenance?.available
    ? (Number(productPlacementProvenance.gasUnplacedMassKg) || 0)
    : (Number(reactionSummary.ledgerUnplacedGasProductMassKg) || 0);
  const gasSpeciesLedger = mergeResidentGasSpeciesLedgers(reactionSummary.gasSpeciesLedger);
  const strictReactionGate = strictReactionGateIsClassified(reactionSummary.strictReactionGate)
    ? {
        ...reactionSummary.strictReactionGate,
        blockers: [...(reactionSummary.strictReactionGate.blockers || [])],
        warnings: [...(reactionSummary.strictReactionGate.warnings || [])],
        provisionalEnergetics: (reactionSummary.strictReactionGate.provisionalEnergetics || [])
          .map((record) => ({ ...record }))
      }
    : null;
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
    strictReactionGate,
    strictReactionGateSchema: strictReactionGate?.schema ?? null,
    strictReactionGateStatus: strictReactionGate?.status ?? null,
    strictForceCouplingAllowed: strictReactionGate?.strictForceCouplingAllowed === true,
    productPlacementProvenance,
    productPlacementProvenanceSchema: productPlacementProvenance?.schema ?? null,
    productPlacementProvenanceReadbackByteLength:
      reactionSummary.productPlacementProvenanceReadbackByteLength ?? 0,
    sealedBoxGasProductMoles: Number(reactionSummary.sealedBoxGasProductMoles) || gasSpeciesLedger?.records?.reduce((sum, row) => sum + (Number(row.moles) || 0), 0) || 0,
    visibleProductMassKg,
    prePlacementVisibleProductMassKg: visibleProductMassKg,
    prePlacementUnplacedProductMassKg,
    postPlacementPlacedProductMassKg: placedProductMassKg,
    postPlacementMergedProductMassKg: mergedProductMassKg,
    postPlacementUnplacedProductMassKg: unplacedProductMassKg,
    placedProductMassKg,
    mergedProductMassKg,
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
  Object.defineProperty(handle, '__ulgActiveBorrowCount', {
    configurable: false,
    enumerable: false,
    get() {
      return activeBorrowCount;
    },
    set(value) {
      activeBorrowCount = Math.max(0, Math.trunc(Number(value) || 0));
      if (activeBorrowCount !== 0) return;
      for (const resolve of borrowDrainWaiters) resolve(true);
      borrowDrainWaiters.clear();
    }
  });
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
  let activeUnplacedMassKg = 0;
  let unplacedMassKg = 0;
  let placedMassKg = 0;
  let mergedMassKg = 0;
  let consumedEventCount = 0;
  let rejectedEventCount = 0;
  for (let offset = 0; offset < values.length; offset += SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS) {
    const statusCode = values[offset + 18];
    const dispositionId = Math.round(values[offset + 31] ?? 0);
    const massKg = Math.max(0, Number(values[offset + 3]) || 0);
    if (statusCode !== 1 && !(dispositionId > 0 && massKg > 0)) continue;
    const productTermIndex = Math.round(values[offset + 5] ?? 0);
    const meta = metadata.find((item) => item.productTermIndex === productTermIndex) || metadata[productTermIndex] || null;
    const materialId = values[offset + 4];
    const material = meta?.material || String(Math.round(materialId));
    const moles = values[offset + 9];
    const phaseId = values[offset + 11];
    const rowPlacedMassKg = Math.min(massKg, Math.max(0, Number(values[offset + 12]) || 0));
    const rowUnplacedMassKg = Math.min(
      Math.max(0, massKg - rowPlacedMassKg),
      Math.max(0, Number(values[offset + 13]) || 0)
    );
    const rowMergedMassKg = Math.max(0, massKg - rowPlacedMassKg - rowUnplacedMassKg);
    const visibleMassKg = rowPlacedMassKg + rowMergedMassKg;
    const routingId = values[offset + 10];
    const active = statusCode === 1;
    const rejected = dispositionId === 8;
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
      placedMassKg: rowPlacedMassKg,
      mergedMassKg: rowMergedMassKg,
      unplacedMassKg: rowUnplacedMassKg,
      coefficient: meta?.coefficient ?? values[offset + 14],
      molarMassKgPerMol: meta?.molarMassKgPerMol ?? values[offset + 15],
      temperatureK: values[offset + 16],
      restDensityKgPerM3: values[offset + 17],
      specificInternalEnergyJPerKg: values[offset + 19],
      velocityMPerS: [values[offset + 20], values[offset + 21], values[offset + 22]],
      supportVolumeM3: values[offset + 23],
      effectiveBulkModulusPa: values[offset + 24],
      shearModulusPa: values[offset + 25],
      lameLambdaPa: values[offset + 26],
      soundSpeedMPerS: values[offset + 27],
      eosModelId: values[offset + 28],
      solidFlag: values[offset + 29],
      mechanicsStatus: values[offset + 30],
      dispositionId,
      disposition: productEventDispositionName(dispositionId),
      status: rejected ? 'rejected' : (active ? 'ready' : 'consumed'),
      lifecycle: rejected ? 'rejected' : (active ? 'active' : 'consumed'),
      statusCode,
      fullParticleReadbackPerformed: false,
      scientificValidation: false,
      chemistryValidation: false,
      fullPhysicsValidation: false
    };
    records.push(record);
    if (active) {
      activeMassKg += massKg;
      activeUnplacedMassKg += rowUnplacedMassKg;
    } else {
      consumedEventCount += 1;
    }
    if (rejected) rejectedEventCount += 1;
    placedMassKg += rowPlacedMassKg;
    mergedMassKg += rowMergedMassKg;
    unplacedMassKg += rowUnplacedMassKg;
    const key = String(record.material || Math.round(record.materialId)).toLowerCase();
    const bucket = byMaterial[key] || (byMaterial[key] = {
      material: key,
      materialId: record.materialId,
      massKg: 0,
      moles: 0,
      visibleMassKg: 0,
      placedMassKg: 0,
      mergedMassKg: 0,
      unplacedMassKg: 0,
      eventCount: 0,
      productTermIndices: [],
      fullParticleReadbackPerformed: false
    });
    bucket.massKg += record.massKg;
    bucket.moles += record.moles;
    bucket.visibleMassKg += record.visibleMassKg;
    bucket.placedMassKg += record.placedMassKg;
    bucket.mergedMassKg += record.mergedMassKg;
    bucket.unplacedMassKg += record.unplacedMassKg;
    bucket.eventCount += 1;
    if (!bucket.productTermIndices.includes(record.productTermIndex)) {
      bucket.productTermIndices.push(record.productTermIndex);
    }
  }
  return {
    schema: ULG_SPH_GPU_REACTION_PRODUCT_EVENT_SCHEMA,
    status: records.length ? 'product-event-sparse-storage-ready' : 'product-event-sparse-storage-empty',
    placementProvenanceDecoded: true,
    records,
    byMaterial,
    activeEventCount: records.filter((record) => record.statusCode === 1).length,
    provenanceEventCount: records.length,
    consumedEventCount,
    rejectedEventCount,
    activeMassKg,
    activeUnplacedMassKg,
    placedMassKg,
    mergedMassKg,
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

export function decodeSphReactionProductPlacementSummaryValues(
  values,
  reactionTable = null,
  {
    readbackMode = 'compact-product-placement-summary-readback',
    readbackCadence = 'single-step-final',
    sourceSummaryCount = 1
  } = {}
) {
  if (
    !(values instanceof Float32Array)
    || values.length === 0
    || values.length % SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS !== 0
  ) {
    throw new TypeError(
      'decodeSphReactionProductPlacementSummaryValues requires f32 rows aligned to the product-placement layout'
    );
  }
  const rowCount = values.length / SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS;
  const expectedRowCount = Math.max(0, Math.round(Number(reactionTable?.productTermCount) || 0));
  if (expectedRowCount > 0 && rowCount !== expectedRowCount) {
    throw new RangeError(
      `product-placement summary row count ${rowCount} does not match product term count ${expectedRowCount}`
    );
  }
  const metadata = Array.isArray(reactionTable?.productTermMetadata)
    ? reactionTable.productTermMetadata
    : [];
  const records = [];
  const byMaterial = {};
  const toleranceFor = (massKg) => Math.max(1e-9, Math.abs(massKg) * 1e-5);
  for (let offset = 0; offset < values.length; offset += SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS) {
    const fallbackProductTermIndex = offset / SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS;
    // The accumulator row order is the ABI authority. Empty product terms do
    // not have an event identity to encode and therefore retain zero in the
    // identity lane; trusting that zero would alias every empty row to term 0.
    const productTermIndex = fallbackProductTermIndex;
    const meta = metadata.find((item) => item.productTermIndex === productTermIndex)
      || metadata[productTermIndex]
      || null;
    const readyProductEventCount = values[offset + 6];
    const placementCandidateEventCount = values[offset + 7];
    const directPlacedEventCount = values[offset + 8];
    const sparePlacedEventCount = values[offset + 9];
    const captureMergedEventCount = values[offset + 10];
    const fallbackMergedEventCount = values[offset + 11];
    const unplacedEventCount = values[offset + 12];
    const subthresholdEventCount = values[offset + 13];
    const rejectedEventCount = values[offset + 14];
    const phaseRoutedEventCount = values[offset + 15];
    const readyProductMassKg = values[offset + 16];
    const directPlacedMassKg = values[offset + 17];
    const sparePlacedMassKg = values[offset + 18];
    const captureMergedMassKg = values[offset + 19];
    const fallbackMergedMassKg = values[offset + 20];
    const unplacedMassKg = values[offset + 21];
    const subthresholdMassKg = values[offset + 22];
    const rejectedMassKg = values[offset + 23];
    const candidateDispositionEventCount = sparePlacedEventCount
      + captureMergedEventCount
      + fallbackMergedEventCount
      + unplacedEventCount;
    const directOnlyEventCount = Math.max(0, readyProductEventCount - placementCandidateEventCount);
    const readyEventPartitionResidual = readyProductEventCount
      - directOnlyEventCount
      - placementCandidateEventCount;
    const candidateEventPartitionResidual = placementCandidateEventCount
      - candidateDispositionEventCount;
    const placedMassKg = directPlacedMassKg + sparePlacedMassKg;
    const mergedMassKg = captureMergedMassKg + fallbackMergedMassKg;
    const massPartitionResidualKg = readyProductMassKg
      - placedMassKg
      - mergedMassKg
      - unplacedMassKg;
    const massToleranceKg = toleranceFor(readyProductMassKg);
    const partitionComplete = Math.abs(readyEventPartitionResidual) <= 0.5
      && Math.abs(candidateEventPartitionResidual) <= 0.5
      && Math.abs(massPartitionResidualKg) <= massToleranceKg
      && subthresholdEventCount <= unplacedEventCount + 0.5
      && subthresholdMassKg <= unplacedMassKg + massToleranceKg;
    const statusCode = values[offset + 5];
    const shaderReady = statusCode === 1;
    const routingId = meta?.routing === 'gas'
      ? 1
      : Math.round(Number(values[offset + 3]) || 0);
    const phaseRoutingRequired = routingId === 1 && readyProductEventCount > 0;
    const phaseRoutingComplete = !phaseRoutingRequired
      || Math.abs(phaseRoutedEventCount - readyProductEventCount) <= 0.5;
    const materialId = Number(meta?.materialId) || Number(values[offset]) || 0;
    const material = meta?.material || String(Math.round(materialId));
    const record = {
      schema: ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
      material,
      materialId,
      productTermIndex,
      reactionIndex: meta?.reactionIndex ?? Math.round(Number(values[offset + 2]) || 0),
      routing: routingNameFromId(routingId, meta?.routing),
      routingId,
      phaseId: Number(values[offset + 4]) > 0
        ? values[offset + 4]
        : (meta?.targetPhasePolicyId ?? 0),
      status: !shaderReady
        ? 'product-placement-term-not-run'
        : (rejectedEventCount > 0 || rejectedMassKg > 0
            ? 'product-placement-term-rejected'
            : (partitionComplete
                ? (phaseRoutingComplete
                    ? 'product-placement-term-ready'
                    : 'product-placement-term-phase-routing-incomplete')
                : 'product-placement-term-partition-incomplete')),
      statusCode,
      shaderReady,
      partitionComplete,
      phaseRoutingRequired,
      phaseRoutingComplete,
      readyProductEventCount,
      directOnlyEventCount,
      placementCandidateEventCount,
      directPlacedEventCount,
      sparePlacedEventCount,
      placedEventCount: directOnlyEventCount + sparePlacedEventCount,
      captureMergedEventCount,
      fallbackMergedEventCount,
      mergedEventCount: captureMergedEventCount + fallbackMergedEventCount,
      unplacedEventCount,
      subthresholdEventCount,
      rejectedEventCount,
      phaseRoutedEventCount,
      readyProductMassKg,
      directPlacedMassKg,
      sparePlacedMassKg,
      placedMassKg,
      captureMergedMassKg,
      fallbackMergedMassKg,
      mergedMassKg,
      unplacedMassKg,
      subthresholdMassKg,
      rejectedMassKg,
      maxSparePlacedEventMassKg: values[offset + 24],
      maxMergedEventMassKg: values[offset + 25],
      maxPostMergeParticleMassKg: values[offset + 26],
      maxUnplacedEventMassKg: values[offset + 27],
      maxCaptureDistanceM: values[offset + 28],
      maxFallbackDistanceM: values[offset + 29],
      maxSparePlacedSupportRadiusM: values[offset + 30],
      maxReadyProductEventMassKg: values[offset + 31],
      readyEventPartitionResidual,
      candidateEventPartitionResidual,
      massPartitionResidualKg,
      massToleranceKg,
      fullParticleReadbackPerformed: false
    };
    records.push(record);
    const key = String(material || Math.round(materialId)).toLowerCase();
    const bucket = byMaterial[key] || (byMaterial[key] = {
      material: key,
      materialId,
      routing: record.routing,
      productTermIndices: [],
      readyProductEventCount: 0,
      placementCandidateEventCount: 0,
      directPlacedEventCount: 0,
      sparePlacedEventCount: 0,
      captureMergedEventCount: 0,
      fallbackMergedEventCount: 0,
      unplacedEventCount: 0,
      subthresholdEventCount: 0,
      rejectedEventCount: 0,
      phaseRoutedEventCount: 0,
      readyProductMassKg: 0,
      directPlacedMassKg: 0,
      sparePlacedMassKg: 0,
      placedMassKg: 0,
      captureMergedMassKg: 0,
      fallbackMergedMassKg: 0,
      mergedMassKg: 0,
      unplacedMassKg: 0,
      subthresholdMassKg: 0,
      rejectedMassKg: 0,
      fullParticleReadbackPerformed: false
    });
    for (const field of [
      'readyProductEventCount',
      'placementCandidateEventCount',
      'directPlacedEventCount',
      'sparePlacedEventCount',
      'captureMergedEventCount',
      'fallbackMergedEventCount',
      'unplacedEventCount',
      'subthresholdEventCount',
      'rejectedEventCount',
      'phaseRoutedEventCount',
      'readyProductMassKg',
      'directPlacedMassKg',
      'sparePlacedMassKg',
      'placedMassKg',
      'captureMergedMassKg',
      'fallbackMergedMassKg',
      'mergedMassKg',
      'unplacedMassKg',
      'subthresholdMassKg',
      'rejectedMassKg'
    ]) {
      bucket[field] += Number(record[field]) || 0;
    }
    bucket.productTermIndices.push(productTermIndex);
    if (bucket.routing !== record.routing) bucket.routing = 'mixed';
  }

  const sum = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  const max = (rows, field) => rows.reduce((largest, row) => Math.max(largest, Number(row[field]) || 0), 0);
  const placedReactionEventCount = (rows) => {
    const byReaction = new Map();
    for (const row of rows) {
      const reactionIndex = Number(row?.reactionIndex);
      const key = Number.isFinite(reactionIndex)
        ? `reaction:${Math.round(reactionIndex)}`
        : 'reaction:unknown';
      byReaction.set(
        key,
        Math.max(byReaction.get(key) ?? 0, Number(row?.placedEventCount) || 0)
      );
    }
    return [...byReaction.values()].reduce((total, count) => total + count, 0);
  };
  const gasRecords = records.filter((record) => Math.round(record.routingId) === 1);
  const aggregate = (rows, prefix = '') => {
    const key = (field) => prefix
      ? `${prefix}${field[0].toUpperCase()}${field.slice(1)}`
      : field;
    return {
      [key('readyProductEventCount')]: sum(rows, 'readyProductEventCount'),
      [key('placementCandidateEventCount')]: sum(rows, 'placementCandidateEventCount'),
      [key('directPlacedEventCount')]: sum(rows, 'directPlacedEventCount'),
      [key('sparePlacedEventCount')]: sum(rows, 'sparePlacedEventCount'),
      [key('captureMergedEventCount')]: sum(rows, 'captureMergedEventCount'),
      [key('fallbackMergedEventCount')]: sum(rows, 'fallbackMergedEventCount'),
      [key('mergedEventCount')]: sum(rows, 'mergedEventCount'),
      [key('unplacedEventCount')]: sum(rows, 'unplacedEventCount'),
      [key('subthresholdEventCount')]: sum(rows, 'subthresholdEventCount'),
      [key('rejectedEventCount')]: sum(rows, 'rejectedEventCount'),
      [key('phaseRoutedEventCount')]: sum(rows, 'phaseRoutedEventCount'),
      [key('readyProductMassKg')]: sum(rows, 'readyProductMassKg'),
      [key('directPlacedMassKg')]: sum(rows, 'directPlacedMassKg'),
      [key('sparePlacedMassKg')]: sum(rows, 'sparePlacedMassKg'),
      [key('placedMassKg')]: sum(rows, 'placedMassKg'),
      [key('captureMergedMassKg')]: sum(rows, 'captureMergedMassKg'),
      [key('fallbackMergedMassKg')]: sum(rows, 'fallbackMergedMassKg'),
      [key('mergedMassKg')]: sum(rows, 'mergedMassKg'),
      [key('unplacedMassKg')]: sum(rows, 'unplacedMassKg'),
      [key('subthresholdMassKg')]: sum(rows, 'subthresholdMassKg'),
      [key('rejectedMassKg')]: sum(rows, 'rejectedMassKg')
    };
  };
  const totals = aggregate(records);
  const gasTotals = aggregate(gasRecords, 'gas');
  const massPartitionResidualKg = sum(records, 'massPartitionResidualKg');
  const massToleranceKg = toleranceFor(totals.readyProductMassKg);
  const rejected = totals.rejectedEventCount > 0 || totals.rejectedMassKg > massToleranceKg;
  const shaderReady = records.length > 0 && records.every((record) => record.shaderReady);
  const partitionComplete = records.every((record) => record.partitionComplete)
    && Math.abs(massPartitionResidualKg) <= massToleranceKg;
  const phaseRoutingComplete = records.every((record) => record.phaseRoutingComplete);
  const available = shaderReady;
  return {
    schema: ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
    status: !available
      ? 'product-placement-provenance-not-run'
      : (rejected
          ? 'product-placement-provenance-rejected'
          : (partitionComplete
              ? (phaseRoutingComplete
                  ? 'product-placement-provenance-ready'
                  : 'product-placement-provenance-phase-routing-incomplete')
              : 'product-placement-provenance-partition-incomplete')),
    available,
    shaderReady,
    partitionComplete,
    phaseRoutingComplete,
    rejected,
    records,
    byMaterial,
    recordCount: records.length,
    materialCount: Object.keys(byMaterial).length,
    productTermCount: records.length,
    ...totals,
    ...gasTotals,
    placementCandidateEventCount: totals.placementCandidateEventCount,
    placedEventCount: sum(records, 'placedEventCount'),
    placedReactionEventCount: placedReactionEventCount(records),
    mergedEventCount: totals.mergedEventCount,
    unplacedEventCount: totals.unplacedEventCount,
    rejectedEventCount: totals.rejectedEventCount,
    readyProductMassKg: totals.readyProductMassKg,
    placedMassKg: totals.placedMassKg,
    mergedMassKg: totals.mergedMassKg,
    unplacedMassKg: totals.unplacedMassKg,
    rejectedMassKg: totals.rejectedMassKg,
    gasPlacementCandidateEventCount: gasTotals.gasPlacementCandidateEventCount,
    gasPlacedEventCount: sum(gasRecords, 'placedEventCount'),
    gasPlacedReactionEventCount: placedReactionEventCount(gasRecords),
    gasMergedEventCount: gasTotals.gasMergedEventCount,
    gasUnplacedEventCount: gasTotals.gasUnplacedEventCount,
    gasRejectedEventCount: gasTotals.gasRejectedEventCount,
    gasReadyProductMassKg: gasTotals.gasReadyProductMassKg,
    gasPlacedMassKg: gasTotals.gasPlacedMassKg,
    gasMergedMassKg: gasTotals.gasMergedMassKg,
    gasUnplacedMassKg: gasTotals.gasUnplacedMassKg,
    gasRejectedMassKg: gasTotals.gasRejectedMassKg,
    condensedPlacedMassKg: Math.max(0, totals.placedMassKg - gasTotals.gasPlacedMassKg),
    condensedMergedMassKg: Math.max(0, totals.mergedMassKg - gasTotals.gasMergedMassKg),
    condensedUnplacedMassKg: Math.max(0, totals.unplacedMassKg - gasTotals.gasUnplacedMassKg),
    maxSparePlacedEventMassKg: max(records, 'maxSparePlacedEventMassKg'),
    maxMergedEventMassKg: max(records, 'maxMergedEventMassKg'),
    maxPostMergeParticleMassKg: max(records, 'maxPostMergeParticleMassKg'),
    maxUnplacedEventMassKg: max(records, 'maxUnplacedEventMassKg'),
    maxCaptureDistanceM: max(records, 'maxCaptureDistanceM'),
    maxFallbackDistanceM: max(records, 'maxFallbackDistanceM'),
    maxSparePlacedSupportRadiusM: max(records, 'maxSparePlacedSupportRadiusM'),
    maxReadyProductEventMassKg: max(records, 'maxReadyProductEventMassKg'),
    massPartitionResidualKg,
    massToleranceKg,
    sourceSummaryCount,
    readbackMode,
    readbackCadence,
    rowLayout: [...SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS,
    rowStrideBytes:
      SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    readbackFloatCount: values.length,
    readbackByteLength: values.byteLength,
    fullParticleReadbackPerformed: false,
    scientificValidation: false,
    chemistryValidation: false,
    sphValidation: false,
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

function sphReactionStrictGateU32(value) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 0xffff_ffff
    ? value >>> 0
    : null;
}

function sphReactionStrictGateExactF32MetadataValue(value, encodedValue) {
  if (typeof value !== 'number') return false;
  const valueF32 = Math.fround(value);
  return Number.isFinite(valueF32) && Object.is(valueF32, encodedValue);
}

export function deriveSphReactionStrictGateStaticBlockerFlags(
  reactionTable = null
) {
  let blockers = 0;
  const reactionCount = sphReactionStrictGateU32(reactionTable?.reactionCount);
  const atomTermCount = sphReactionStrictGateU32(reactionTable?.atomTermCount);
  const reactantTermCount = sphReactionStrictGateU32(
    reactionTable?.reactantTermCount
  );
  const productTermCount = sphReactionStrictGateU32(
    reactionTable?.productTermCount
  );
  if (
    reactionTable?.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA
    || reactionCount === null
    || atomTermCount === null
    || reactantTermCount === null
    || productTermCount === null
    || reactionCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || atomTermCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || reactantTermCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || productTermCount >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || ((reactionCount === 0) !== (atomTermCount === 0))
  ) blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  const metadata = Array.isArray(reactionTable?.metadata)
    ? reactionTable.metadata
    : [];
  if (reactionCount !== null && metadata.length !== reactionCount) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  }
  const reactionTermRanges = [];
  let nextReactantTermOffset = 0;
  let nextProductTermOffset = 0;
  for (let reactionIndex = 0; reactionIndex < metadata.length; reactionIndex += 1) {
    const record = metadata[reactionIndex];
    const stoichiometry = record?.stoichiometry;
    if (stoichiometry?.provisionalEnergeticsStatus) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.PROVISIONAL_ENERGETICS;
    }
    if (stoichiometry?.atomBalance?.balanced !== true) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.ATOM_BALANCE_UNPROVEN;
    }
    if (stoichiometry?.chargeBalance?.balanced !== true) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.CHARGE_BALANCE_UNPROVEN;
    }
    const reactantOffset = sphReactionStrictGateU32(record?.reactantTermOffset);
    const reactantCount = sphReactionStrictGateU32(record?.reactantTermCount);
    const productOffset = sphReactionStrictGateU32(record?.productTermOffset);
    const productCount = sphReactionStrictGateU32(record?.productTermCount);
    const rangeValid = reactantOffset !== null
      && reactantCount !== null
      && productOffset !== null
      && productCount !== null
      && reactantOffset === nextReactantTermOffset
      && productOffset === nextProductTermOffset
      && reactantOffset + reactantCount <= reactantTermCount
      && productOffset + productCount <= productTermCount;
    if (!rangeValid) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
      reactionTermRanges.push(null);
      continue;
    }
    reactionTermRanges.push(Object.freeze({
      reactantOffset,
      reactantCount,
      productOffset,
      productCount
    }));
    nextReactantTermOffset += reactantCount;
    nextProductTermOffset += productCount;
  }
  if (
    nextReactantTermOffset !== reactantTermCount
    || nextProductTermOffset !== productTermCount
  ) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  }
  const atomTermValues = reactionTable?.atomTermRecords;
  const atomTermMetadata = Array.isArray(reactionTable?.atomTermMetadata)
    ? reactionTable.atomTermMetadata
    : [];
  if (
    atomTermCount === null
    || !(atomTermValues instanceof Float32Array)
    || atomTermValues.length !== atomTermCount * SPH_GPU_REACTION_ATOM_TERM_FLOATS
    || atomTermMetadata.length !== atomTermCount
    || reactionTable?.atomTermStrideFloats !== SPH_GPU_REACTION_ATOM_TERM_FLOATS
    || !Array.isArray(reactionTable?.atomTermLayout)
    || reactionTable.atomTermLayout.length !== SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT.length
    || reactionTable.atomTermLayout.some((field, index) =>
      field !== SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT[index]
    )
  ) {
    blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
  } else {
    let previousReactionIndex = -1;
    const seenReactions = new Set();
    const seenAtomTermIdentities = new Set();
    const seenDeclaredTerms = new Set();
    for (let rowIndex = 0; rowIndex < atomTermCount; rowIndex += 1) {
      const offset = rowIndex * SPH_GPU_REACTION_ATOM_TERM_FLOATS;
      const row = atomTermValues.subarray(
        offset,
        offset + SPH_GPU_REACTION_ATOM_TERM_FLOATS
      );
      const meta = atomTermMetadata[rowIndex];
      const [rowReaction, termKind, termIndex, atomicNumber,
        atomsPerFormula, coefficient, charge, status] = row;
      const reactionRange = Number.isInteger(rowReaction)
        ? reactionTermRanges[rowReaction]
        : null;
      const termOffset = termKind === 1
        ? reactionRange?.reactantOffset
        : (termKind === 2 ? reactionRange?.productOffset : null);
      const termCount = termKind === 1
        ? reactionRange?.reactantCount
        : (termKind === 2 ? reactionRange?.productCount : null);
      const identity = `${rowReaction}:${termKind}:${termIndex}:${atomicNumber}`;
      const valid = Array.from(row).every(Number.isFinite)
        && Number.isInteger(rowReaction)
        && !Object.is(rowReaction, -0)
        && rowReaction >= 0
        && rowReaction < reactionCount
        && rowReaction < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
        && (termKind === 1 || termKind === 2)
        && Number.isInteger(termIndex)
        && !Object.is(termIndex, -0)
        && termIndex >= 0
        && termIndex < SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
        && termOffset !== null
        && termOffset !== undefined
        && termCount !== null
        && termCount !== undefined
        && termIndex >= termOffset
        && termIndex < termOffset + termCount
        && Number.isInteger(atomicNumber)
        && atomicNumber >= 1
        && atomicNumber <= 118
        && atomsPerFormula > 0
        && coefficient > 0
        && status === 1
        && rowReaction >= previousReactionIndex
        && Object.is(meta?.atomTermIndex, rowIndex)
        && Object.is(meta?.reactionIndex, rowReaction)
        && Object.is(meta?.termKindId, termKind)
        && Object.is(meta?.termIndex, termIndex)
        && Object.is(meta?.atomicNumberZ, atomicNumber)
        && meta.atomsPerFormula > 0
        && sphReactionStrictGateExactF32MetadataValue(
          meta?.atomsPerFormula,
          atomsPerFormula
        )
        && meta.coefficient > 0
        && sphReactionStrictGateExactF32MetadataValue(
          meta?.coefficient,
          coefficient
        )
        && sphReactionStrictGateExactF32MetadataValue(meta?.charge, charge)
        && meta?.termKind === (termKind === 1 ? 'reactant' : 'product')
        && Object.is(meta?.status, status);
      if (!valid || seenAtomTermIdentities.has(identity)) {
        blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
        continue;
      }
      seenAtomTermIdentities.add(identity);
      seenDeclaredTerms.add(`${rowReaction}:${termKind}:${termIndex}`);
      previousReactionIndex = rowReaction;
      seenReactions.add(rowReaction);
    }
    if (seenReactions.size !== reactionCount) {
      blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
    }
    for (
      let reactionIndex = 0;
      reactionIndex < reactionTermRanges.length;
      reactionIndex += 1
    ) {
      const range = reactionTermRanges[reactionIndex];
      if (!range) continue;
      for (
        let termIndex = range.reactantOffset;
        termIndex < range.reactantOffset + range.reactantCount;
        termIndex += 1
      ) {
        if (!seenDeclaredTerms.has(`${reactionIndex}:1:${termIndex}`)) {
          blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
        }
      }
      for (
        let termIndex = range.productOffset;
        termIndex < range.productOffset + range.productCount;
        termIndex += 1
      ) {
        if (!seenDeclaredTerms.has(`${reactionIndex}:2:${termIndex}`)) {
          blockers |= SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID;
        }
      }
    }
  }
  return blockers >>> 0;
}

// Phase-one integration is deliberately a pure build plan. It describes the
// GPU-resident finalizer and fail-closed initialization but does not allocate,
// dispatch, read back, or admit the control into any downstream force path.
export function createSphReactionStrictGateGpuFinalizePlan({
  reactionTable = null,
  atomResidualCapacity = reactionTable?.atomTermCount ?? 0,
  atomTermCapacity = reactionTable?.atomTermCount ?? 0,
  expectedSourceGeneration = 0,
  expectedCompletionGeneration = 0,
  expectedSeal = 0,
  staticBlockerFlags = 0,
  atomResidualToleranceMol = 1e-6,
  chargeResidualToleranceMol = 1e-6
} = {}) {
  const reactionCount = reactionTable?.reactionCount ?? 0;
  const atomTermCount = reactionTable?.atomTermCount ?? 0;
  const derivedStaticBlockers =
    deriveSphReactionStrictGateStaticBlockerFlags(reactionTable);
  const combinedStaticBlockers = (
    derivedStaticBlockers | (sphReactionStrictGateU32(staticBlockerFlags) ??
      SPH_REACTION_STRICT_GATE_BLOCKER.STATIC_INPUT_INVALID)
  ) >>> 0;
  const paramsWords = createSphReactionStrictGateFinalizeParams({
    reactionCount,
    atomTermCount,
    atomResidualCapacity,
    atomTermCapacity,
    expectedSourceGeneration,
    expectedCompletionGeneration,
    expectedSeal,
    staticBlockerFlags: combinedStaticBlockers,
    atomResidualToleranceMol,
    chargeResidualToleranceMol
  });
  const paramsIndex = SPH_REACTION_STRICT_GATE_PARAMS_INDEX;
  const packedStaticBlockers = paramsWords[paramsIndex.staticBlockerFlags] >>> 0;
  let configurationBlockers = packedStaticBlockers;
  if (
    paramsWords[paramsIndex.expectedSourceGeneration] === 0
    || paramsWords[paramsIndex.expectedCompletionGeneration] === 0
  ) configurationBlockers |= SPH_REACTION_STRICT_GATE_BLOCKER.GENERATION_MISMATCH;
  if (
    paramsWords[paramsIndex.expectedSeal] === 0
  ) configurationBlockers |= SPH_REACTION_STRICT_GATE_BLOCKER.SEAL_MISMATCH;
  if (
    paramsWords[paramsIndex.atomTermCapacity]
      < paramsWords[paramsIndex.atomTermCount]
    || paramsWords[paramsIndex.atomResidualCapacity]
      < paramsWords[paramsIndex.atomTermCount]
  ) configurationBlockers |=
    SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
    | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
  if (
    paramsWords[paramsIndex.reactionCount]
      >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || paramsWords[paramsIndex.atomTermCount]
      >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || paramsWords[paramsIndex.atomResidualCapacity]
      >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
    || paramsWords[paramsIndex.atomTermCapacity]
      >= SPH_REACTION_STRICT_GATE_F32_INDEX_EXCLUSIVE
  ) configurationBlockers |= SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
  if (
    (paramsWords[paramsIndex.reactionCount] === 0)
      !== (paramsWords[paramsIndex.atomTermCount] === 0)
  ) configurationBlockers |=
    SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
    | SPH_REACTION_STRICT_GATE_BLOCKER.LAYOUT_MISMATCH;
  const initialControlWords = createSphReactionStrictGateBlockedSentinel({
    sourceGeneration: 0,
    completionGeneration: 0,
    seal: 0,
    reactionCount: paramsWords[paramsIndex.reactionCount],
    atomTermCount: paramsWords[paramsIndex.atomTermCount],
    atomResidualToleranceMol,
    chargeResidualToleranceMol,
    staticBlockerFlags: packedStaticBlockers,
    blockerFlags: configurationBlockers
      | SPH_REACTION_STRICT_GATE_BLOCKER.MISSING_EVIDENCE
  });
  const configuredToPass = configurationBlockers === 0;
  const shadowPlaneWordCount = paramsWords[paramsIndex.atomTermCount]
    * SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS;
  const shadowLogicalWordCount = shadowPlaneWordCount
    * SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT;
  const shadowLogicalByteLength = shadowLogicalWordCount
    * Uint32Array.BYTES_PER_ELEMENT;
  return Object.freeze({
    schema: ULG_SPH_REACTION_STRICT_GATE_CONTROL_SCHEMA,
    status: configuredToPass
      ? 'sph-reaction-strict-gate-gpu-finalize-plan-ready'
      : 'sph-reaction-strict-gate-gpu-finalize-plan-fail-closed',
    configuredToPass,
    failClosed: true,
    gpuAuthoredControl: true,
    hostReadbackRequired: false,
    reactionCount: paramsWords[paramsIndex.reactionCount],
    atomTermCount: paramsWords[paramsIndex.atomTermCount],
    atomResidualCapacity: paramsWords[paramsIndex.atomResidualCapacity],
    atomTermCapacity: paramsWords[paramsIndex.atomTermCapacity],
    staticBlockerFlags: packedStaticBlockers,
    configurationBlockerFlags: configurationBlockers >>> 0,
    control: Object.freeze({
      byteLength: SPH_REACTION_STRICT_GATE_BYTES,
      wordLength: SPH_REACTION_STRICT_GATE_WORDS,
      initialWords: initialControlWords,
      layout: SPH_REACTION_STRICT_GATE_LAYOUT,
      magic: SPH_REACTION_STRICT_GATE_MAGIC,
      version: SPH_REACTION_STRICT_GATE_VERSION
    }),
    params: Object.freeze({
      byteLength: SPH_REACTION_STRICT_GATE_PARAMS_BYTES,
      words: paramsWords,
      layout: SPH_REACTION_STRICT_GATE_PARAMS_LAYOUT
    }),
    producerReceipt: Object.freeze({
      required: true,
      gpuAuthored: true,
      finalizerAccess: 'read-only',
      byteLength: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_BYTES,
      wordLength: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_WORDS,
      layout: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_LAYOUT,
      magic: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_MAGIC,
      version: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_VERSION,
      readyStatus: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_STATUS.READY,
      identityProof: 'full-bitwise-planar-shadow-v1'
    }),
    producerShadow: Object.freeze({
      schema: ULG_SPH_REACTION_STRICT_GATE_PRODUCER_SHADOW_SCHEMA,
      required: true,
      gpuAuthored: true,
      hostReadbackRequired: false,
      finalizerAccess: 'read-only',
      layout: 'planar-raw-u32-v1',
      rowCount: paramsWords[paramsIndex.atomTermCount],
      sourceRowWords: SPH_REACTION_STRICT_GATE_SHADOW_ROW_WORDS,
      planeCount: SPH_REACTION_STRICT_GATE_SHADOW_PLANE_COUNT,
      planeWordCount: shadowPlaneWordCount,
      logicalWordCount: shadowLogicalWordCount,
      logicalByteLength: shadowLogicalByteLength,
      bindingByteLength: Math.max(
        Uint32Array.BYTES_PER_ELEMENT,
        shadowLogicalByteLength
      ),
      exactBindingLengthRequired: true,
      zeroRowSentinelWord: 0,
      requiredUsage: Object.freeze(['COPY_DST', 'STORAGE']),
      sourceRequiredUsage: Object.freeze(['COPY_SRC', 'STORAGE']),
      copyOperations: Object.freeze([
        Object.freeze({
          sourceRole: 'atom-residual-evidence',
          sourceByteOffset: 0,
          destinationByteOffset: 0,
          byteLength: shadowPlaneWordCount * Uint32Array.BYTES_PER_ELEMENT
        }),
        Object.freeze({
          sourceRole: 'authoritative-atom-term-table',
          sourceByteOffset: 0,
          destinationByteOffset:
            shadowPlaneWordCount * Uint32Array.BYTES_PER_ELEMENT,
          byteLength: shadowPlaneWordCount * Uint32Array.BYTES_PER_ELEMENT
        })
      ])
    }),
    shader: Object.freeze({
      code: sphReactionStrictGateFinalizeWgsl,
      entryPoint: 'finalize_reaction_strict_gate',
      workgroupSize: 1
    }),
    bindings: Object.freeze([
      Object.freeze({
        binding: 0,
        role: 'atom-residual-evidence',
        bufferType: 'read-only-storage',
        shaderWordType: 'u32',
        rowStrideBytes: SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        logicalByteLength: paramsWords[paramsIndex.atomResidualCapacity]
          * SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        bindingByteLength: Math.max(
          Uint32Array.BYTES_PER_ELEMENT,
          paramsWords[paramsIndex.atomResidualCapacity]
            * SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS
            * Float32Array.BYTES_PER_ELEMENT
        ),
        exactBindingLengthRequired: true,
        zeroRowSentinelWord: 0
      }),
      Object.freeze({
        binding: 1,
        role: 'authoritative-atom-term-table',
        bufferType: 'read-only-storage',
        shaderWordType: 'u32',
        rowStrideBytes: SPH_GPU_REACTION_ATOM_TERM_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        logicalByteLength: paramsWords[paramsIndex.atomTermCapacity]
          * SPH_GPU_REACTION_ATOM_TERM_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        bindingByteLength: Math.max(
          Uint32Array.BYTES_PER_ELEMENT,
          paramsWords[paramsIndex.atomTermCapacity]
            * SPH_GPU_REACTION_ATOM_TERM_FLOATS
            * Float32Array.BYTES_PER_ELEMENT
        ),
        exactBindingLengthRequired: true,
        zeroRowSentinelWord: 0
      }),
      Object.freeze({
        binding: 2,
        role: 'atom-residual-producer-receipt',
        bufferType: 'read-only-storage',
        byteLength: SPH_REACTION_STRICT_GATE_PRODUCER_RECEIPT_BYTES
      }),
      Object.freeze({
        binding: 3,
        role: 'strict-gate-control',
        bufferType: 'storage',
        byteLength: SPH_REACTION_STRICT_GATE_BYTES
      }),
      Object.freeze({
        binding: 4,
        role: 'strict-gate-params',
        bufferType: 'uniform',
        byteLength: SPH_REACTION_STRICT_GATE_PARAMS_BYTES
      }),
      Object.freeze({
        binding: 5,
        role: 'exact-producer-shadow',
        bufferType: 'read-only-storage',
        byteLength: Math.max(
          Uint32Array.BYTES_PER_ELEMENT,
          shadowLogicalByteLength
        )
      })
    ]),
    dispatchWorkgroups: Object.freeze([1, 1, 1])
  });
}

export function resolveSphReactionProductPlacementClassificationProgram(
  placement
) {
  const directoryAbiVersion = placement?.directoryAbiVersion;
  const authenticationDirectoryAbiVersion =
    placement?.authentication?.directoryAbiVersion;
  const generationDirectoryAbiVersion =
    placement?.generation?.execution?.abiVersion;
  const directoryV2 =
    directoryAbiVersion === SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
  if (
    directoryAbiVersion !== SCHROEDER_SPATIAL_EPOCH_VERSION
    && !directoryV2
  ) {
    const error = new TypeError(
      `reaction-product placement classification does not support directory ABI version ${
        directoryAbiVersion
      }`
    );
    error.code =
      'ERR_SPH_REACTION_PRODUCT_PLACEMENT_CLASSIFICATION_UNSUPPORTED_DIRECTORY_ABI';
    throw error;
  }
  if (
    authenticationDirectoryAbiVersion !== directoryAbiVersion
    || generationDirectoryAbiVersion !== directoryAbiVersion
    || placement.expectationBufferByteLength
      !== placement.authentication?.expectationUniformBytes
    || placement.authentication?.expectationData?.byteLength
      !== placement.expectationBufferByteLength
  ) {
    const error = new TypeError(
      'reaction-product placement classification directory/expectation ABI identity mismatch'
    );
    error.code =
      'ERR_SPH_REACTION_PRODUCT_PLACEMENT_CLASSIFICATION_DIRECTORY_ABI_MISMATCH';
    throw error;
  }
  return Object.freeze({
    directoryAbiVersion,
    cacheKeySuffix: `directory-v${directoryAbiVersion}`,
    shaderCode: directoryV2
      ? sphReactionProductEventSpatialClassificationV2Wgsl
      : sphReactionProductEventSpatialClassificationWgsl
  });
}

export async function runSphReactionSummaryWebGpu({
  device,
  sphParticleState,
  reactionTable,
  sourceStateBuffer = null,
  sourceThermoBuffer = null,
  sourceMechanicsBuffer = null,
  nextStateBuffer = null,
  nextThermoBuffer = null,
  nextMechanicsBuffer = null,
  reactionRecordBuffer = null,
  proposalBuffer = null,
  boxDimsM = null,
  dtSeconds = 0,
  readProductEvents = false,
  retainProductEventBuffer = false,
  productPlacementAccumulatorBuffer = null,
  readProductPlacementSummary = null,
  productPlacementReadbackCadence = 'single-step-final',
  productPlacementSourceSummaryCount = 1,
  readCompactSummary = null,
  readGasSpeciesSummary = null,
  readProductInventory = null,
  readAtomResidual = null,
  gpuTimestampRecorder = null,
  canonicalReactionProductPlacementAuthority = null,
  reactionWarmArenaLease = null,
  queueOrderedProducerClaims = []
} = {}) {
  const readbackTelemetry = createGpuReadbackTelemetryAccumulator({
    scope: 'sph-reaction-gpu-summary'
  });
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('runSphReactionSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer');
  }
  assertInputs({ sphParticleState, reactionTable });
  if (!sourceStateBuffer || !sourceThermoBuffer || !nextStateBuffer || !nextThermoBuffer) {
    throw new TypeError('SPH reaction summary requires retained source and output state/thermo buffers');
  }

  const particleCount = sphParticleState.particleCount;
  const exactConsumerClaims =
    Array.isArray(queueOrderedProducerClaims)
      ? queueOrderedProducerClaims
      : [];
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
  const useProductEventBuffer = productEventCount > 0 && (
    readProductEvents
    || retainProductEventBuffer
    || canonicalReactionProductPlacementAuthority != null
  );
  if (useProductEventBuffer && !sourceMechanicsBuffer) {
    throw new TypeError(
      'SPH reaction product events require the retained source mechanics buffer for authenticated support-volume routing'
    );
  }
  const productEventWorkgroupCount = Math.max(1, Math.ceil(Math.max(1, productEventCount) / SUMMARY_WORKGROUP_SIZE));
  const placementParticleWorkgroupCount = Math.max(
    1,
    Math.ceil(Math.max(1, particleCount) / SUMMARY_WORKGROUP_SIZE)
  );
  const productEventByteLength = productEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const productPlacementByteLength = productTermCount
    * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const atomResidualCount = Math.max(0, reactionTable.atomTermCount ?? 0);
  const atomResidualByteLength = atomResidualCount * SPH_GPU_REACTION_ATOM_RESIDUAL_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const diagnosticReadDefault = reactionWarmArenaLease ? false : true;
  const resolveDiagnosticRead = (requested) => requested == null
    ? diagnosticReadDefault
    : requested !== false;
  const shouldReadCompactSummary = resolveDiagnosticRead(readCompactSummary);
  const shouldReadGasSpeciesSummary = resolveDiagnosticRead(
    readGasSpeciesSummary
  );
  const shouldReadProductInventory = resolveDiagnosticRead(
    readProductInventory
  );
  const shouldReadAtomResidual = resolveDiagnosticRead(readAtomResidual);
  const shouldRunProductInventory = productInventoryCount > 0 && shouldReadProductInventory;
  const shouldRunGasSpecies = gasSpeciesCount > 0 && shouldReadGasSpeciesSummary;
  const shouldRunAtomResidual = atomResidualCount > 0 && shouldReadAtomResidual;
  const shouldRunProductPlacement = useProductEventBuffer
    && Boolean(nextMechanicsBuffer)
    && productPlacementByteLength > 0;
  const shouldReadProductPlacementSummary = shouldRunProductPlacement
    && resolveDiagnosticRead(readProductPlacementSummary);
  const canonicalSpatialPlacementRequested =
    canonicalReactionProductPlacementAuthority != null;
  const canonicalSpatialPlacement = canonicalSpatialPlacementRequested
    ? resolveSchroederSpatialReactionProductPlacementAuthority(
        canonicalReactionProductPlacementAuthority,
        {
          device,
          generation: canonicalReactionProductPlacementAuthority.generation,
          particleCount,
          productEventCapacity: productEventCount,
          sourceStateBuffer,
          sourceThermoBuffer,
          placedDestinationStateBuffer: nextStateBuffer,
          placedDestinationThermoBuffer: nextThermoBuffer,
          placedDestinationMechanicsBuffer: nextMechanicsBuffer
        }
      )
    : null;
  const canonicalSpatialPlacementEnabled =
    canonicalSpatialPlacement?.admitted === true;
  if (
    canonicalSpatialPlacementRequested
    && (!canonicalSpatialPlacementEnabled || !shouldRunProductPlacement)
  ) {
    throw new TypeError(
      'canonical product placement requires its branded fresh source authority and complete placed destination family'
    );
  }
  if (reactionWarmArenaLease && !canonicalSpatialPlacementEnabled) {
    throw new TypeError(
      'reaction warm arena summary execution requires canonical product placement'
    );
  }
  // The canonical path owns deterministic spatial routing, segmented
  // destination conflict resolution, represented-entity publication, and
  // relative-kinetic-energy thermalization. Product carriers now begin at
  // their target reference density (F = I, J = 1), but that does not make the
  // legacy mutation path equivalent. Any run that actually places products
  // must present the canonical placement authority or fail closed.
  if (shouldRunProductPlacement && !canonicalSpatialPlacementEnabled) {
    const error = new TypeError(
      'product placement requires the canonical Schroeder spatial placement authority'
    );
    error.code = 'ERR_SPH_REACTION_PRODUCT_PLACEMENT_AUTHORITY_REQUIRED';
    error.readbackTelemetry = readbackTelemetry.snapshot();
    throw error;
  }
  const placementClassificationProgram = canonicalSpatialPlacementEnabled
    ? resolveSphReactionProductPlacementClassificationProgram(
        canonicalSpatialPlacement
      )
    : null;
  const reactionWarmArena = reactionWarmArenaLease
    ? resolveSphReactionWarmArenaLease(reactionWarmArenaLease, {
        device,
        particleCapacity: particleCount,
        productEventCapacity: productEventCount,
        productTermCapacity: productTermCount
      })
    : null;
  const reactionWarmBuffers = reactionWarmArena?.buffers ?? null;
  let productPlacementSegmentedArenaLease = canonicalSpatialPlacementEnabled
    ? acquireSphReactionProductPlacementSegmentedArenaWebGpu({
        device,
        authority: canonicalReactionProductPlacementAuthority,
        particleCapacity: particleCount,
        eventCapacity: productEventCount,
        productTermCapacity: productTermCount,
        eventStrideVec4: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4,
        diagnosticReadbackRequested: shouldReadProductPlacementSummary
      })
    : null;
  const productPlacementSegmentedArena =
    productPlacementSegmentedArenaLease?.arena ?? null;
  const productPlacementWarmBuffers =
    productPlacementSegmentedArena?.buffers ?? null;
  let productPlacementSegmentedEncoding = null;
  let reactionProductPlacementSubmissionArtifact = null;
  let productPlacementArenaReleaseScheduled = false;
  try {
  const productPlacementBoxDimsM = [0, 1, 2].map((axis) => {
    const value = Number(boxDimsM?.[axis] ?? sphParticleState?.boxDimsM?.[axis]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const productPlacementBoxClampEnabled = productPlacementBoxDimsM.every((value) => value > 0);
  const borrowedProductPlacementAccumulatorBuffer = Boolean(productPlacementAccumulatorBuffer);
  if (
    borrowedProductPlacementAccumulatorBuffer
    && !webGpuBufferMatchesDevice(productPlacementAccumulatorBuffer, device)
  ) {
    throw new TypeError('product placement accumulator belongs to a different WebGPU device');
  }
  if (
    borrowedProductPlacementAccumulatorBuffer
    && Number.isFinite(Number(productPlacementAccumulatorBuffer?.size))
    && Number(productPlacementAccumulatorBuffer.size) < productPlacementByteLength
  ) {
    throw new RangeError('product placement accumulator is smaller than the per-product-term ABI requires');
  }
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
  const productEventBuffer = useProductEventBuffer
    ? (
        reactionWarmBuffers?.productEvent
        || tagWebGpuBufferDevice(device.createBuffer({
          label: 'ulg-sph-reaction-product-event-out',
          size: Math.max(4, productEventByteLength),
          usage:
            GPU_BUFFER_USAGE.STORAGE
            | GPU_BUFFER_USAGE.COPY_SRC
            | GPU_BUFFER_USAGE.COPY_DST
        }), device)
      )
    : null;
  const productEventEmissionBuffer = shouldRunProductPlacement
    ? (productPlacementWarmBuffers?.denseEmission || device.createBuffer({
        label: 'ulg-sph-reaction-product-event-dense-emission-scratch',
        size: Math.max(4, productEventByteLength),
        usage: GPU_BUFFER_USAGE.STORAGE
      }))
    : productEventBuffer;
  const productEventCompactCountBuffer = shouldRunProductPlacement
    ? (productPlacementWarmBuffers?.compactCount || device.createBuffer({
        label: 'ulg-sph-reaction-product-event-placement-compact-count',
        size: 4,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      }))
    : null;
  const productEventCompactParamsBuffer = shouldRunProductPlacement
    ? (productPlacementWarmBuffers?.compactParams || device.createBuffer({
        label: 'ulg-sph-reaction-product-event-placement-compact-params',
        size: 16,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      }))
    : null;
  const productEventCompactLocalPrefixBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.compactLocalPrefix
    : null;
  const productEventCompactGroupCountBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.compactGroupCount
    : null;
  const productEventCompactGroupOffsetBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.compactGroupOffset
    : null;
  const productEventPlacementDecisionBuffer = shouldRunProductPlacement
    ? (productPlacementWarmBuffers?.decisions || tagWebGpuBufferDevice(device.createBuffer({
        label: 'ulg-sph-reaction-product-event-placement-decisions',
        size: Math.max(16, productEventCount * 4 * Float32Array.BYTES_PER_ELEMENT),
        usage: GPU_BUFFER_USAGE.STORAGE
      }), device))
    : null;
  const productEventPlacementControlBuffer = shouldRunProductPlacement
    ? (productPlacementWarmBuffers?.control || tagWebGpuBufferDevice(device.createBuffer({
        label: 'ulg-sph-reaction-product-event-placement-control',
        size: 32,
        usage: GPU_BUFFER_USAGE.STORAGE
      }), device))
    : null;
  const productEventPlacementEnvelopePartialsBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.envelopePartials
    : null;
  const productPlacementSpareParticlePrefixBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareParticlePrefix
    : null;
  const productPlacementSpareParticleGroupCountBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareParticleGroupCount
    : null;
  const productPlacementSpareParticleGroupOffsetBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareParticleGroupOffset
    : null;
  const productPlacementSpareEventPrefixBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareEventPrefix
    : null;
  const productPlacementSpareEventGroupCountBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareEventGroupCount
    : null;
  const productPlacementSpareEventGroupOffsetBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareEventGroupOffset
    : null;
  const productPlacementSpareSlotsBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareSlots
    : null;
  const productPlacementSpareControlBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareControl
    : null;
  const productPlacementSpareParticleScanParamsBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareParticleScanParams
    : null;
  const productPlacementSpareEventScanParamsBuffer = canonicalSpatialPlacementEnabled
    ? productPlacementWarmBuffers.spareEventScanParams
    : null;
  const productEventPlacementCompletionReceiptBuffer =
    !shouldRunProductPlacement
      ? null
      : (
          canonicalSpatialPlacementEnabled
            ? canonicalSpatialPlacement.completionReceiptBuffer
            : tagWebGpuBufferDevice(device.createBuffer({
                label:
                  'ulg-sph-reaction-product-event-placement-local-completion-receipt',
                size: SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
                usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
              }), device)
        );
  const productEventPlacementCompletionReadBuffer =
    canonicalSpatialPlacementEnabled && shouldReadProductPlacementSummary
      ? productPlacementWarmBuffers.completionReadback
      : null;
  if (
    productEventPlacementCompletionReceiptBuffer
    && !canonicalSpatialPlacementEnabled
  ) {
    device.queue.writeBuffer(
      productEventPlacementCompletionReceiptBuffer,
      0,
      new Uint32Array(SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES / 4)
    );
  }
  if (productEventCompactParamsBuffer) {
    device.queue.writeBuffer(
      productEventCompactParamsBuffer,
      0,
      new Uint32Array([
        productEventCount,
        SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4,
        productEventWorkgroupCount,
        0
      ])
    );
  }
  if (productPlacementSpareControlBuffer) {
    device.queue.writeBuffer(
      productPlacementSpareControlBuffer,
      0,
      new Uint32Array(4)
    );
  }
  if (productPlacementSpareParticleScanParamsBuffer) {
    device.queue.writeBuffer(
      productPlacementSpareParticleScanParamsBuffer,
      0,
      new Uint32Array([
        placementParticleWorkgroupCount,
        0,
        particleCount,
        0
      ])
    );
  }
  if (productPlacementSpareEventScanParamsBuffer) {
    device.queue.writeBuffer(
      productPlacementSpareEventScanParamsBuffer,
      0,
      new Uint32Array([
        productEventWorkgroupCount,
        1,
        productEventCount,
        0
      ])
    );
  }
  const productPlacementSpatialDirectoryBuffer = canonicalSpatialPlacementEnabled
    ? canonicalSpatialPlacement.directoryBuffer
    : null;
  const productPlacementSpatialExpectationBuffer = canonicalSpatialPlacementEnabled
    ? canonicalSpatialPlacement.expectationBuffer
    : null;
  const productPlacementFrozenSourceStateBuffer = canonicalSpatialPlacementEnabled
    ? canonicalSpatialPlacement.frozenSourceStateBuffer
    : sourceStateBuffer;
  const productPlacementDirectoryPositionAuthorityStateBuffer =
    canonicalSpatialPlacementEnabled
      ? canonicalSpatialPlacement.directoryPositionAuthorityStateBuffer
      : productPlacementFrozenSourceStateBuffer;
  const productPlacementFrozenSourceThermoBuffer = canonicalSpatialPlacementEnabled
    ? canonicalSpatialPlacement.frozenSourceThermoBuffer
    : sourceThermoBuffer;
  let retainedProductEventBuffer = false;
  let reactionProductPlacementArtifact = null;
  const productEventReadBuffer = useProductEventBuffer && readProductEvents ? device.createBuffer({
    label: 'ulg-sph-reaction-product-event-readback',
    size: Math.max(4, productEventByteLength),
    usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST
  }) : null;
  const placementAccumulatorBuffer = shouldRunProductPlacement
    ? (
        productPlacementAccumulatorBuffer
        || reactionWarmBuffers?.productPlacementSummary
        || tagWebGpuBufferDevice(device.createBuffer({
          label: 'ulg-sph-reaction-product-placement-accumulator',
          size: Math.max(4, productPlacementByteLength),
          usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
        }), device)
      )
    : null;
  if (placementAccumulatorBuffer && !borrowedProductPlacementAccumulatorBuffer) {
    device.queue.writeBuffer(
      placementAccumulatorBuffer,
      0,
      new Uint8Array(productPlacementByteLength)
    );
  }
  const productPlacementReadBuffer = shouldReadProductPlacementSummary ? device.createBuffer({
    label: 'ulg-sph-reaction-product-placement-readback',
    size: Math.max(4, productPlacementByteLength),
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
  const paramsBuffer = reactionWarmBuffers?.summaryParams || device.createBuffer({
    label: 'ulg-sph-reaction-summary-params',
    size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
  });
  let deferLocalBufferCleanup = false;
  let localCleanupClaim = null;
  let localCleanupFinalConsumer = null;
  let localCleanupTelemetryTarget = null;
  const localCleanupOutput = {};
  const attachQueueOrderedFinalConsumer = (result) => {
    localCleanupTelemetryTarget = result;
    if (localCleanupFinalConsumer) {
      Object.defineProperty(
        result,
        'queueOrderedFinalConsumerCapability',
        {
          value: localCleanupFinalConsumer,
          enumerable: false
        }
      );
    }
    return result;
  };
  let localBuffersDestroyed = false;
  let productEventPlacementParamsBuffer = null;
  const productPlacementWarmBufferSet = new Set(
    [
      ...Object.values(productPlacementWarmBuffers ?? {}),
      ...Object.values(reactionWarmBuffers ?? {})
    ].filter(Boolean)
  );
  const destroyLocalPlacementBuffer = (buffer) => {
    if (buffer && !productPlacementWarmBufferSet.has(buffer)) {
      buffer.destroy?.();
    }
  };
  const destroyLocalBuffers = () => {
    if (localBuffersDestroyed) return;
    destroyLocalPlacementBuffer(productEventPlacementParamsBuffer);
    if (!borrowedReactionRecordBuffer) recordsBuffer.destroy?.();
    if (!borrowedProposalBuffer) proposalsBuffer.destroy?.();
    partialsBuffer?.destroy?.();
    summaryBuffer?.destroy?.();
    readBuffer?.destroy?.();
    gasSpeciesBuffer?.destroy?.();
    gasSpeciesReadBuffer?.destroy?.();
    productInventoryBuffer?.destroy?.();
    productInventoryReadBuffer?.destroy?.();
    if (productEventEmissionBuffer !== productEventBuffer) {
      destroyLocalPlacementBuffer(productEventEmissionBuffer);
    }
    destroyLocalPlacementBuffer(productEventCompactCountBuffer);
    destroyLocalPlacementBuffer(productEventCompactParamsBuffer);
    destroyLocalPlacementBuffer(productEventCompactLocalPrefixBuffer);
    destroyLocalPlacementBuffer(productEventCompactGroupCountBuffer);
    destroyLocalPlacementBuffer(productEventCompactGroupOffsetBuffer);
    destroyLocalPlacementBuffer(productEventPlacementDecisionBuffer);
    destroyLocalPlacementBuffer(productEventPlacementControlBuffer);
    destroyLocalPlacementBuffer(productEventPlacementEnvelopePartialsBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareParticlePrefixBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareParticleGroupCountBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareParticleGroupOffsetBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareEventPrefixBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareEventGroupCountBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareEventGroupOffsetBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareSlotsBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareControlBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareParticleScanParamsBuffer);
    destroyLocalPlacementBuffer(productPlacementSpareEventScanParamsBuffer);
    if (!canonicalSpatialPlacementEnabled) {
      productEventPlacementCompletionReceiptBuffer?.destroy?.();
    }
    destroyLocalPlacementBuffer(productEventPlacementCompletionReadBuffer);
    if (
      !retainedProductEventBuffer
      && productEventBuffer !== reactionWarmBuffers?.productEvent
    ) {
      productEventBuffer?.destroy?.();
    }
    productEventReadBuffer?.destroy?.();
    if (
      !borrowedProductPlacementAccumulatorBuffer
      && placementAccumulatorBuffer
        !== reactionWarmBuffers?.productPlacementSummary
    ) {
      placementAccumulatorBuffer?.destroy?.();
    }
    productPlacementReadBuffer?.destroy?.();
    atomResidualBuffer?.destroy?.();
    atomResidualReadBuffer?.destroy?.();
    if (paramsBuffer !== reactionWarmBuffers?.summaryParams) {
      paramsBuffer.destroy?.();
    }
    localBuffersDestroyed = true;
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
      hasProposals: borrowedProposalBuffer,
      dtSeconds
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
        cacheKey: 'ulg-sph-reaction-product-event-v2-current-volume',
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
          computeBufferBinding(7, 'uniform'),
          computeBufferBinding(8, 'read-only-storage')
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
          { binding: 6, resource: { buffer: productEventEmissionBuffer } },
          { binding: 7, resource: { buffer: paramsBuffer } },
          { binding: 8, resource: { buffer: sourceMechanicsBuffer } }
        ]
      });
    }
    let productEventPlacementPipeline = null;
    let productEventPlacementBindGroup = null;
    let productEventPlacementEnvelopePipeline = null;
    let productEventPlacementEnvelopeBindGroup = null;
    let productEventPlacementEnvelopeFinalizePipeline = null;
    let productEventPlacementEnvelopeFinalizeBindGroup = null;
    let productEventPlacementClassificationPipeline = null;
    let productEventPlacementClassificationBindGroup = null;
    let productPlacementSpareParticleMarkPipeline = null;
    let productPlacementSpareParticleMarkBindGroup = null;
    let productPlacementSpareParticleScanPipeline = null;
    let productPlacementSpareParticleScanBindGroup = null;
    let productPlacementSpareScatterPipeline = null;
    let productPlacementSpareScatterBindGroup = null;
    let productPlacementSpareEventMarkPipeline = null;
    let productPlacementSpareEventMarkBindGroup = null;
    let productPlacementSpareEventScanPipeline = null;
    let productPlacementSpareEventScanBindGroup = null;
    let productPlacementSpareAssignPipeline = null;
    let productPlacementSpareAssignBindGroup = null;
    let productEventCompactPipeline = null;
    let productEventCompactBindGroup = null;
    let productEventCompactScanPipeline = null;
    let productEventCompactScanBindGroup = null;
    let productEventCompactScatterPipeline = null;
    let productEventCompactScatterBindGroup = null;
    if (shouldRunProductPlacement && placementAccumulatorBuffer) {
      const legacyCompactBindings = [
          computeBufferBinding(0, 'read-only-storage'),
          computeBufferBinding(1, 'storage'),
          computeBufferBinding(2, 'storage'),
          computeBufferBinding(3, 'uniform'),
          computeBufferBinding(4, 'storage')
      ];
      const canonicalCompactBindings = [
        ...legacyCompactBindings,
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'storage'),
        computeBufferBinding(7, 'storage')
      ];
      const compactEntries = [
          { binding: 0, resource: { buffer: productEventEmissionBuffer } },
          { binding: 1, resource: { buffer: productEventBuffer } },
          { binding: 2, resource: { buffer: productEventCompactCountBuffer } },
          { binding: 3, resource: { buffer: productEventCompactParamsBuffer } },
          {
            binding: 4,
            resource: { buffer: productEventPlacementCompletionReceiptBuffer }
          }
      ];
      if (canonicalSpatialPlacementEnabled) {
        compactEntries.push(
          { binding: 5, resource: { buffer: productEventCompactLocalPrefixBuffer } },
          { binding: 6, resource: { buffer: productEventCompactGroupCountBuffer } },
          { binding: 7, resource: { buffer: productEventCompactGroupOffsetBuffer } }
        );
        const compactCountInfo = createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-sph-reaction-product-event-placement-compact-count-v3',
          label: 'ulg-sph-reaction-product-event-placement-compact-count',
          code: sphReactionProductEventCompactWgsl,
          entryPoint: 'count_placement_rows',
          bindings: canonicalCompactBindings
        });
        const compactScanInfo = createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-sph-reaction-product-event-placement-compact-scan-v3',
          label: 'ulg-sph-reaction-product-event-placement-compact-scan',
          code: sphReactionProductEventCompactWgsl,
          entryPoint: 'scan_placement_row_groups',
          bindings: canonicalCompactBindings
        });
        const compactScatterInfo = createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-sph-reaction-product-event-placement-compact-scatter-v3',
          label: 'ulg-sph-reaction-product-event-placement-compact-scatter',
          code: sphReactionProductEventCompactWgsl,
          entryPoint: 'scatter_placement_rows',
          bindings: canonicalCompactBindings
        });
        productEventCompactPipeline = compactCountInfo.pipeline;
        productEventCompactScanPipeline = compactScanInfo.pipeline;
        productEventCompactScatterPipeline = compactScatterInfo.pipeline;
        productEventCompactBindGroup = device.createBindGroup({
          layout: compactCountInfo.bindGroupLayout,
          entries: compactEntries
        });
        productEventCompactScanBindGroup = device.createBindGroup({
          layout: compactScanInfo.bindGroupLayout,
          entries: compactEntries
        });
        productEventCompactScatterBindGroup = device.createBindGroup({
          layout: compactScatterInfo.bindGroupLayout,
          entries: compactEntries
        });
      } else {
        const compactInfo = createCachedExplicitComputePipeline(device, {
          cacheKey: 'ulg-sph-reaction-product-event-placement-compact-v2',
          label: 'ulg-sph-reaction-product-event-placement-compact',
          code: sphReactionProductEventCompactWgsl,
          entryPoint: 'compact_placement_rows',
          bindings: legacyCompactBindings
        });
        productEventCompactPipeline = compactInfo.pipeline;
        productEventCompactBindGroup = device.createBindGroup({
          layout: compactInfo.bindGroupLayout,
          entries: compactEntries
        });
      }
      // Placement runs in the same submit right after the event kernel:
      // unplaced product mass claims spare zero-mass particle slots and the
      // consumed events are zeroed before compaction/merge or the grid splat
      // ever see them, so ledger mass and particle mass never double-count.
      const spatialClassificationBindings = [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'uniform'),
        computeBufferBinding(6, 'read-only-storage'),
        computeBufferBinding(7, 'read-only-storage'),
        computeBufferBinding(8, 'uniform'),
        computeBufferBinding(9, 'read-only-storage'),
        computeBufferBinding(10, 'storage'),
        computeBufferBinding(11, 'read-only-storage'),
        computeBufferBinding(12, 'storage')
      ];
      const placementCommitBindings = [
        computeBufferBinding(0, 'storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'storage'),
        computeBufferBinding(3, 'storage'),
        computeBufferBinding(4, 'uniform'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'read-only-storage'),
        computeBufferBinding(7, 'read-only-storage'),
        computeBufferBinding(8, 'read-only-storage'),
        computeBufferBinding(9, 'read-only-storage'),
        computeBufferBinding(10, 'storage')
      ];
      const placementEnvelopeBindings = [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'read-only-storage'),
        computeBufferBinding(2, 'read-only-storage'),
        computeBufferBinding(3, 'uniform'),
        computeBufferBinding(4, 'storage'),
        computeBufferBinding(5, 'storage'),
        computeBufferBinding(6, 'storage')
      ];
      const placementEnvelopeInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spatial-envelope-reduce-v4',
            label: 'ulg-sph-reaction-product-placement-spatial-envelope-reduce',
            code: sphReactionProductEventPlacementEnvelopeWgsl,
            entryPoint: 'reduce_placement_spatial_envelope',
            bindings: placementEnvelopeBindings
          })
        : null;
      const placementEnvelopeFinalizeInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spatial-envelope-finalize-v4',
            label: 'ulg-sph-reaction-product-placement-spatial-envelope-finalize',
            code: sphReactionProductEventPlacementEnvelopeWgsl,
            entryPoint: 'finalize_placement_spatial_envelope',
            bindings: placementEnvelopeBindings
          })
        : null;
      const placementClassificationInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey:
              'ulg-sph-reaction-product-placement-spatial-classification-v4-'
              + placementClassificationProgram.cacheKeySuffix,
            label:
              'ulg-sph-reaction-product-placement-spatial-classification-'
              + placementClassificationProgram.cacheKeySuffix,
            code: placementClassificationProgram.shaderCode,
            entryPoint: 'classify_product_events',
            bindings: spatialClassificationBindings
          })
        : null;
      const spareParticleMarkInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spare-particle-mark-v1',
            label: 'ulg-sph-reaction-product-placement-spare-particle-mark',
            code: sphReactionProductSpareParticleMarkWgsl,
            entryPoint: 'mark_spare_particles',
            bindings: [
              computeBufferBinding(0, 'read-only-storage'),
              computeBufferBinding(1, 'read-only-storage'),
              computeBufferBinding(2, 'storage'),
              computeBufferBinding(3, 'storage'),
              computeBufferBinding(4, 'uniform'),
              computeBufferBinding(5, 'storage')
            ]
          })
        : null;
      const spareGroupScanBindings = [
        computeBufferBinding(0, 'read-only-storage'),
        computeBufferBinding(1, 'storage'),
        computeBufferBinding(2, 'storage'),
        computeBufferBinding(3, 'uniform'),
        computeBufferBinding(4, 'storage')
      ];
      const spareParticleScanInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spare-particle-scan-v1',
            label: 'ulg-sph-reaction-product-placement-spare-particle-scan',
            code: sphReactionProductSpareGroupScanWgsl,
            entryPoint: 'scan_spare_groups',
            bindings: spareGroupScanBindings
          })
        : null;
      const spareScatterInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spare-scatter-v1',
            label: 'ulg-sph-reaction-product-placement-spare-scatter',
            code: sphReactionProductSpareScatterWgsl,
            entryPoint: 'scatter_spare_particles',
            bindings: [
              computeBufferBinding(0, 'read-only-storage'),
              computeBufferBinding(1, 'read-only-storage'),
              computeBufferBinding(2, 'storage'),
              computeBufferBinding(3, 'uniform'),
              computeBufferBinding(4, 'storage')
            ]
          })
        : null;
      const spareEventMarkInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spare-event-mark-v1',
            label: 'ulg-sph-reaction-product-placement-spare-event-mark',
            code: sphReactionProductSpareEventMarkWgsl,
            entryPoint: 'mark_spare_events',
            bindings: [
              computeBufferBinding(0, 'read-only-storage'),
              computeBufferBinding(1, 'read-only-storage'),
              computeBufferBinding(2, 'read-only-storage'),
              computeBufferBinding(3, 'storage'),
              computeBufferBinding(4, 'storage'),
              computeBufferBinding(5, 'uniform'),
              computeBufferBinding(6, 'storage')
            ]
          })
        : null;
      const spareEventScanInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spare-event-scan-v1',
            label: 'ulg-sph-reaction-product-placement-spare-event-scan',
            code: sphReactionProductSpareGroupScanWgsl,
            entryPoint: 'scan_spare_groups',
            bindings: spareGroupScanBindings
          })
        : null;
      const spareAssignInfo = canonicalSpatialPlacementEnabled
        ? createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-placement-spare-assign-v1',
            label: 'ulg-sph-reaction-product-placement-spare-assign',
            code: sphReactionProductSpareAssignWgsl,
            entryPoint: 'assign_spare_events',
            bindings: [
              computeBufferBinding(0, 'read-only-storage'),
              computeBufferBinding(1, 'read-only-storage'),
              computeBufferBinding(2, 'read-only-storage'),
              computeBufferBinding(3, 'read-only-storage'),
              computeBufferBinding(4, 'storage'),
              computeBufferBinding(5, 'uniform'),
              computeBufferBinding(6, 'storage')
            ]
          })
        : null;
      const placementPipelineInfo = canonicalSpatialPlacementEnabled
        ? null
        : createCachedExplicitComputePipeline(device, {
            cacheKey: 'ulg-sph-reaction-product-event-placement-commit-v6',
            label: 'ulg-sph-reaction-product-event-placement',
            code: sphReactionProductEventPlacementWgsl,
            entryPoint: 'place_product_events',
            bindings: placementCommitBindings
          });
      const placementParamsBuffer = canonicalSpatialPlacementEnabled
        ? productPlacementWarmBuffers.placementParams
        : tagWebGpuBufferDevice(device.createBuffer({
            label: 'ulg-sph-reaction-product-event-placement-params',
            size: 64,
            usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
          }), device);
      productEventPlacementParamsBuffer = placementParamsBuffer;
      device.queue.writeBuffer(placementParamsBuffer, 0, new Uint32Array([
        particleCount,
        productEventCount,
        SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS / 4,
        2,
        3,
        8
      ]));
      device.queue.writeBuffer(placementParamsBuffer, 24, new Float32Array([1.0e-9]));
      device.queue.writeBuffer(placementParamsBuffer, 28, new Uint32Array([productTermCount]));
      device.queue.writeBuffer(placementParamsBuffer, 32, new Float32Array(productPlacementBoxDimsM));
      device.queue.writeBuffer(
        placementParamsBuffer,
        44,
        new Uint32Array([productPlacementBoxClampEnabled ? 1 : 0])
      );
      device.queue.writeBuffer(
        placementParamsBuffer,
        48,
        new Uint32Array([
          canonicalSpatialPlacementEnabled ? 1 : 0,
          canonicalSpatialPlacement?.authority?.generationId ?? 0,
          canonicalSpatialPlacement?.authority?.supportProfileId ?? 0,
          SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION
        ])
      );
      productEventPlacementPipeline = placementPipelineInfo?.pipeline ?? null;
      const placementCommitEntries = [
        { binding: 0, resource: { buffer: productEventBuffer } },
        { binding: 1, resource: { buffer: nextStateBuffer } },
        { binding: 2, resource: { buffer: nextThermoBuffer } },
        { binding: 3, resource: { buffer: nextMechanicsBuffer } },
        { binding: 4, resource: { buffer: placementParamsBuffer } },
        { binding: 5, resource: { buffer: placementAccumulatorBuffer } },
        { binding: 6, resource: { buffer: productPlacementFrozenSourceStateBuffer } },
        { binding: 7, resource: { buffer: productPlacementFrozenSourceThermoBuffer } },
        { binding: 8, resource: { buffer: productEventCompactCountBuffer } },
        { binding: 9, resource: { buffer: productEventPlacementDecisionBuffer } },
        {
          binding: 10,
          resource: {
            buffer: productEventPlacementCompletionReceiptBuffer
          }
        }
      ];
      const spatialClassificationEntries = [
        { binding: 0, resource: { buffer: productEventBuffer } },
        { binding: 2, resource: { buffer: nextThermoBuffer } },
        { binding: 3, resource: { buffer: placementParamsBuffer } },
        { binding: 6, resource: { buffer: productEventCompactCountBuffer } },
        { binding: 7, resource: { buffer: productPlacementSpatialDirectoryBuffer } },
        { binding: 8, resource: { buffer: productPlacementSpatialExpectationBuffer } },
        { binding: 9, resource: { buffer: productPlacementFrozenSourceStateBuffer } },
        { binding: 10, resource: { buffer: productEventPlacementDecisionBuffer } },
        { binding: 11, resource: { buffer: productEventPlacementControlBuffer } },
        {
          binding: 12,
          resource: { buffer: productEventPlacementCompletionReceiptBuffer }
        }
      ];
      productEventPlacementBindGroup = placementPipelineInfo
        ? device.createBindGroup({
            layout: placementPipelineInfo.bindGroupLayout,
            entries: placementCommitEntries
          })
        : null;
      if (
        placementClassificationInfo
        && placementEnvelopeInfo
        && placementEnvelopeFinalizeInfo
        && spareParticleMarkInfo
        && spareParticleScanInfo
        && spareScatterInfo
        && spareEventMarkInfo
        && spareEventScanInfo
        && spareAssignInfo
      ) {
        productEventPlacementEnvelopePipeline = placementEnvelopeInfo.pipeline;
        productEventPlacementEnvelopeFinalizePipeline =
          placementEnvelopeFinalizeInfo.pipeline;
        productEventPlacementClassificationPipeline = placementClassificationInfo.pipeline;
        productEventPlacementClassificationBindGroup = device.createBindGroup({
          layout: placementClassificationInfo.bindGroupLayout,
          entries: spatialClassificationEntries
        });
        const placementEnvelopeEntries = [
            { binding: 0, resource: { buffer: nextStateBuffer } },
            { binding: 1, resource: { buffer: nextThermoBuffer } },
            {
              binding: 2,
              resource: {
                buffer:
                  productPlacementDirectoryPositionAuthorityStateBuffer
              }
            },
            { binding: 3, resource: { buffer: placementParamsBuffer } },
            { binding: 4, resource: { buffer: productEventPlacementControlBuffer } },
            {
              binding: 5,
              resource: { buffer: productEventPlacementCompletionReceiptBuffer }
            },
            {
              binding: 6,
              resource: { buffer: productEventPlacementEnvelopePartialsBuffer }
            }
        ];
        productEventPlacementEnvelopeBindGroup = device.createBindGroup({
          layout: placementEnvelopeInfo.bindGroupLayout,
          entries: placementEnvelopeEntries
        });
        productEventPlacementEnvelopeFinalizeBindGroup = device.createBindGroup({
          layout: placementEnvelopeFinalizeInfo.bindGroupLayout,
          entries: placementEnvelopeEntries
        });
        productPlacementSpareParticleMarkPipeline = spareParticleMarkInfo.pipeline;
        productPlacementSpareParticleMarkBindGroup = device.createBindGroup({
          layout: spareParticleMarkInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: nextStateBuffer } },
            { binding: 1, resource: { buffer: nextThermoBuffer } },
            { binding: 2, resource: { buffer: productPlacementSpareParticlePrefixBuffer } },
            { binding: 3, resource: { buffer: productPlacementSpareParticleGroupCountBuffer } },
            { binding: 4, resource: { buffer: placementParamsBuffer } },
            { binding: 5, resource: { buffer: productEventPlacementCompletionReceiptBuffer } }
          ]
        });
        productPlacementSpareParticleScanPipeline = spareParticleScanInfo.pipeline;
        productPlacementSpareParticleScanBindGroup = device.createBindGroup({
          layout: spareParticleScanInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: productPlacementSpareParticleGroupCountBuffer } },
            { binding: 1, resource: { buffer: productPlacementSpareParticleGroupOffsetBuffer } },
            { binding: 2, resource: { buffer: productPlacementSpareControlBuffer } },
            { binding: 3, resource: { buffer: productPlacementSpareParticleScanParamsBuffer } },
            { binding: 4, resource: { buffer: productEventPlacementCompletionReceiptBuffer } }
          ]
        });
        productPlacementSpareScatterPipeline = spareScatterInfo.pipeline;
        productPlacementSpareScatterBindGroup = device.createBindGroup({
          layout: spareScatterInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: productPlacementSpareParticlePrefixBuffer } },
            { binding: 1, resource: { buffer: productPlacementSpareParticleGroupOffsetBuffer } },
            { binding: 2, resource: { buffer: productPlacementSpareSlotsBuffer } },
            { binding: 3, resource: { buffer: placementParamsBuffer } },
            { binding: 4, resource: { buffer: productEventPlacementCompletionReceiptBuffer } }
          ]
        });
        productPlacementSpareEventMarkPipeline = spareEventMarkInfo.pipeline;
        productPlacementSpareEventMarkBindGroup = device.createBindGroup({
          layout: spareEventMarkInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: productEventBuffer } },
            { binding: 1, resource: { buffer: productEventCompactCountBuffer } },
            { binding: 2, resource: { buffer: productEventPlacementDecisionBuffer } },
            { binding: 3, resource: { buffer: productPlacementSpareEventPrefixBuffer } },
            { binding: 4, resource: { buffer: productPlacementSpareEventGroupCountBuffer } },
            { binding: 5, resource: { buffer: placementParamsBuffer } },
            { binding: 6, resource: { buffer: productEventPlacementCompletionReceiptBuffer } }
          ]
        });
        productPlacementSpareEventScanPipeline = spareEventScanInfo.pipeline;
        productPlacementSpareEventScanBindGroup = device.createBindGroup({
          layout: spareEventScanInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: productPlacementSpareEventGroupCountBuffer } },
            { binding: 1, resource: { buffer: productPlacementSpareEventGroupOffsetBuffer } },
            { binding: 2, resource: { buffer: productPlacementSpareControlBuffer } },
            { binding: 3, resource: { buffer: productPlacementSpareEventScanParamsBuffer } },
            { binding: 4, resource: { buffer: productEventPlacementCompletionReceiptBuffer } }
          ]
        });
        productPlacementSpareAssignPipeline = spareAssignInfo.pipeline;
        productPlacementSpareAssignBindGroup = device.createBindGroup({
          layout: spareAssignInfo.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: productPlacementSpareEventPrefixBuffer } },
            { binding: 1, resource: { buffer: productPlacementSpareEventGroupOffsetBuffer } },
            { binding: 2, resource: { buffer: productPlacementSpareSlotsBuffer } },
            { binding: 3, resource: { buffer: productPlacementSpareControlBuffer } },
            { binding: 4, resource: { buffer: productEventPlacementDecisionBuffer } },
            { binding: 5, resource: { buffer: placementParamsBuffer } },
            { binding: 6, resource: { buffer: productEventPlacementCompletionReceiptBuffer } }
          ]
        });
      }
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
    if (reactionWarmBuffers?.productEvent && useProductEventBuffer) {
      if (typeof encoder.clearBuffer !== 'function') {
        throw new TypeError(
          'reaction warm product-event reuse requires commandEncoder.clearBuffer'
        );
      }
      encoder.clearBuffer(
        productEventBuffer,
        0,
        Math.max(4, productEventByteLength)
      );
    }
    const encodeTimestampedComputePass = ({
      producerId,
      stage,
      pipeline,
      bindGroup,
      workgroupCount
    }) => {
      const timestampSpan = beginReactionSummaryTimestampSpan(
        gpuTimestampRecorder,
        encoder,
        {
          producerId,
          stage,
          spanClass: 'same-production-command-encoder-profiled-pass',
          summaryScope: SUMMARY_SCOPE,
          particleCount,
          productEventCount,
          productTermCount
        }
      );
      const pass = encoder.beginComputePass({
        label: `ulg-sph-reaction-summary-${stage}`
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroupCount);
      pass.end();
      endReactionSummaryTimestampSpan(
        gpuTimestampRecorder,
        encoder,
        timestampSpan
      );
    };
    if (shouldReadCompactSummary && partialsPipeline && partialsBindGroup && finalizePipeline && finalizeBindGroup) {
      encodeTimestampedComputePass({
        producerId: 'sph-reaction-summary:partials',
        stage: 'partials',
        pipeline: partialsPipeline,
        bindGroup: partialsBindGroup,
        workgroupCount: partialCount
      });
      encodeTimestampedComputePass({
        producerId: 'sph-reaction-summary:finalize',
        stage: 'finalize',
        pipeline: finalizePipeline,
        bindGroup: finalizeBindGroup,
        workgroupCount: 1
      });
    }
    if (productInventoryPipeline && productInventoryBindGroup && shouldRunProductInventory) {
      encodeTimestampedComputePass({
        producerId: 'sph-reaction-summary:product-inventory',
        stage: 'product-inventory',
        pipeline: productInventoryPipeline,
        bindGroup: productInventoryBindGroup,
        workgroupCount: productInventoryCount
      });
      encoder.copyBufferToBuffer(productInventoryBuffer, 0, productInventoryReadBuffer, 0, productInventoryByteLength);
    }
    if (productEventPipeline && productEventBindGroup && useProductEventBuffer) {
      encodeTimestampedComputePass({
        producerId: 'sph-reaction-summary:product-event-emission',
        stage: 'product-event-emission',
        pipeline: productEventPipeline,
        bindGroup: productEventBindGroup,
        workgroupCount: productEventWorkgroupCount
      });
      if (productEventCompactPipeline && productEventCompactBindGroup) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-compaction',
          stage: 'product-event-compaction',
          pipeline: productEventCompactPipeline,
          bindGroup: productEventCompactBindGroup,
          workgroupCount: canonicalSpatialPlacementEnabled
            ? productEventWorkgroupCount
            : 1
        });
      }
      if (productEventCompactScanPipeline && productEventCompactScanBindGroup) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-compaction-scan',
          stage: 'product-event-compaction-scan',
          pipeline: productEventCompactScanPipeline,
          bindGroup: productEventCompactScanBindGroup,
          workgroupCount: 1
        });
      }
      if (
        productEventCompactScatterPipeline
        && productEventCompactScatterBindGroup
      ) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-compaction-scatter',
          stage: 'product-event-compaction-scatter',
          pipeline: productEventCompactScatterPipeline,
          bindGroup: productEventCompactScatterBindGroup,
          workgroupCount: productEventWorkgroupCount
        });
      }
      if (
        productEventPlacementEnvelopePipeline
        && productEventPlacementEnvelopeBindGroup
      ) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-spatial-envelope',
          stage: 'product-event-spatial-envelope',
          pipeline: productEventPlacementEnvelopePipeline,
          bindGroup: productEventPlacementEnvelopeBindGroup,
          workgroupCount: placementParticleWorkgroupCount
        });
      }
      if (
        productEventPlacementEnvelopeFinalizePipeline
        && productEventPlacementEnvelopeFinalizeBindGroup
      ) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-spatial-envelope-finalize',
          stage: 'product-event-spatial-envelope-finalize',
          pipeline: productEventPlacementEnvelopeFinalizePipeline,
          bindGroup: productEventPlacementEnvelopeFinalizeBindGroup,
          workgroupCount: 1
        });
      }
      if (
        productEventPlacementClassificationPipeline
        && productEventPlacementClassificationBindGroup
      ) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-spatial-classification',
          stage: 'product-event-spatial-classification',
          pipeline: productEventPlacementClassificationPipeline,
          bindGroup: productEventPlacementClassificationBindGroup,
          workgroupCount: productEventWorkgroupCount
        });
      }
      const sparePasses = [
        {
          producerId: 'sph-reaction-summary:product-event-spare-particle-mark',
          stage: 'product-event-spare-particle-mark',
          pipeline: productPlacementSpareParticleMarkPipeline,
          bindGroup: productPlacementSpareParticleMarkBindGroup,
          workgroupCount: placementParticleWorkgroupCount
        },
        {
          producerId: 'sph-reaction-summary:product-event-spare-particle-scan',
          stage: 'product-event-spare-particle-scan',
          pipeline: productPlacementSpareParticleScanPipeline,
          bindGroup: productPlacementSpareParticleScanBindGroup,
          workgroupCount: 1
        },
        {
          producerId: 'sph-reaction-summary:product-event-spare-particle-scatter',
          stage: 'product-event-spare-particle-scatter',
          pipeline: productPlacementSpareScatterPipeline,
          bindGroup: productPlacementSpareScatterBindGroup,
          workgroupCount: placementParticleWorkgroupCount
        },
        {
          producerId: 'sph-reaction-summary:product-event-spare-event-mark',
          stage: 'product-event-spare-event-mark',
          pipeline: productPlacementSpareEventMarkPipeline,
          bindGroup: productPlacementSpareEventMarkBindGroup,
          workgroupCount: productEventWorkgroupCount
        },
        {
          producerId: 'sph-reaction-summary:product-event-spare-event-scan',
          stage: 'product-event-spare-event-scan',
          pipeline: productPlacementSpareEventScanPipeline,
          bindGroup: productPlacementSpareEventScanBindGroup,
          workgroupCount: 1
        },
        {
          producerId: 'sph-reaction-summary:product-event-spare-assign',
          stage: 'product-event-spare-assign',
          pipeline: productPlacementSpareAssignPipeline,
          bindGroup: productPlacementSpareAssignBindGroup,
          workgroupCount: productEventWorkgroupCount
        }
      ];
      for (const sparePass of sparePasses) {
        if (sparePass.pipeline && sparePass.bindGroup) {
          encodeTimestampedComputePass(sparePass);
        }
      }
      if (canonicalSpatialPlacementEnabled) {
        productPlacementSegmentedEncoding =
          encodeSphReactionProductPlacementSegmentedWebGpu({
            device,
            encoder,
            authority: canonicalReactionProductPlacementAuthority,
            arenaLease: productPlacementSegmentedArenaLease,
            productEventBuffer,
            nextStateBuffer,
            nextThermoBuffer,
            nextMechanicsBuffer,
            placementSummaryBuffer: placementAccumulatorBuffer,
            frozenSourceStateBuffer: productPlacementFrozenSourceStateBuffer,
            frozenSourceThermoBuffer: productPlacementFrozenSourceThermoBuffer,
            compactCountBuffer: productEventCompactCountBuffer,
            placementDecisionBuffer: productEventPlacementDecisionBuffer,
            placementControlBuffer: productEventPlacementControlBuffer,
            completionReceiptBuffer:
              productEventPlacementCompletionReceiptBuffer,
            productTermCount,
            boxDimsM: productPlacementBoxDimsM,
            gpuTimestampRecorder,
            diagnosticReadbackRequested:
              Boolean(productEventPlacementCompletionReadBuffer)
          });
      } else if (productEventPlacementPipeline && productEventPlacementBindGroup) {
        encodeTimestampedComputePass({
          producerId: 'sph-reaction-summary:product-event-placement',
          stage: 'product-event-placement',
          pipeline: productEventPlacementPipeline,
          bindGroup: productEventPlacementBindGroup,
          workgroupCount: 1
        });
      }
      if (productEventReadBuffer) {
        encoder.copyBufferToBuffer(productEventBuffer, 0, productEventReadBuffer, 0, productEventByteLength);
      }
      if (productPlacementReadBuffer) {
        encoder.copyBufferToBuffer(
          placementAccumulatorBuffer,
          0,
          productPlacementReadBuffer,
          0,
          productPlacementByteLength
        );
      }
    }
    if (atomResidualPipeline && atomResidualBindGroup && shouldRunAtomResidual) {
      encodeTimestampedComputePass({
        producerId: 'sph-reaction-summary:atom-residual',
        stage: 'atom-residual',
        pipeline: atomResidualPipeline,
        bindGroup: atomResidualBindGroup,
        workgroupCount: atomResidualCount
      });
      encoder.copyBufferToBuffer(atomResidualBuffer, 0, atomResidualReadBuffer, 0, atomResidualByteLength);
    }
    if (gasSpeciesPipeline && gasSpeciesBindGroup && shouldRunGasSpecies) {
      encodeTimestampedComputePass({
        producerId: 'sph-reaction-summary:gas-species',
        stage: 'gas-species',
        pipeline: gasSpeciesPipeline,
        bindGroup: gasSpeciesBindGroup,
        workgroupCount: gasSpeciesCount
      });
      encoder.copyBufferToBuffer(gasSpeciesBuffer, 0, gasSpeciesReadBuffer, 0, gasSpeciesByteLength);
    }
    if (shouldReadCompactSummary) {
      encoder.copyBufferToBuffer(summaryBuffer, 0, readBuffer, 0, summaryByteLength);
    }
    if (
      !shouldReadCompactSummary
      && (
        canonicalSpatialPlacementEnabled
        || exactConsumerClaims.length > 0
      )
    ) {
      localCleanupClaim = registerQueueOrderedCleanupClaim(
        reactionSummaryLocalCleanupClaimIssuer,
        device,
        {
          producerOutput: localCleanupOutput,
          cleanup: destroyLocalBuffers
        }
      );
    }
    if (canonicalSpatialPlacementEnabled) {
      const sealedPlacementEncoding =
        sealSchroederSpatialReactionProductPlacementEncoding(
          canonicalReactionProductPlacementAuthority,
          {
            segmentedEncoding: productPlacementSegmentedEncoding,
            completionReadbackBuffer:
              productEventPlacementCompletionReadBuffer
          }
        );
      reactionProductPlacementSubmissionArtifact =
        submitSchroederSpatialReactionProductPlacementWebGpu({
          authority: canonicalReactionProductPlacementAuthority,
          encoding: sealedPlacementEncoding,
          queueOrderedProducerClaims: [
            ...exactConsumerClaims,
            ...(localCleanupClaim ? [localCleanupClaim] : [])
          ]
        });
      localCleanupFinalConsumer =
        reactionProductPlacementSubmissionArtifact
          .queueOrderedFinalConsumerCapability ?? null;
    } else {
      const submittedClaims = [
        ...exactConsumerClaims,
        ...(localCleanupClaim ? [localCleanupClaim] : [])
      ];
      if (submittedClaims.length > 0) {
        localCleanupFinalConsumer =
          submitQueueOrderedFinalConsumerWork(
            device,
            [encoder.finish()],
            {
              finalConsumerOwner: localCleanupOutput,
              producerClaims: submittedClaims
            }
          );
      } else {
        device.queue.submit([encoder.finish()]);
      }
    }
    if (canonicalSpatialPlacementEnabled) {
      if (productEventPlacementCompletionReadBuffer) {
        readbackTelemetry.recordMapAsync(
          SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
          'reaction-product-placement-completion-receipt'
        );
        const completionObservation =
          await observeSchroederSpatialReactionProductPlacementCompletion(
            canonicalReactionProductPlacementAuthority,
            {
              submissionArtifact:
                reactionProductPlacementSubmissionArtifact,
              readbackBuffer: productEventPlacementCompletionReadBuffer
            }
          );
        reactionProductPlacementArtifact =
          finalizeSchroederSpatialReactionProductPlacementAuthority(
            canonicalReactionProductPlacementAuthority,
            {
              submissionArtifact:
                reactionProductPlacementSubmissionArtifact,
              placementDecisionBuffer: productEventPlacementDecisionBuffer,
              placementControlBuffer: productEventPlacementControlBuffer,
              productEventBuffer,
              completionObservation,
              dispatchCount: 1
            }
          );
      }
      releaseSphReactionProductPlacementSegmentedArenaAfterQueue(
        productPlacementSegmentedArenaLease,
        {
          device,
          authority: canonicalReactionProductPlacementAuthority,
          submissionArtifact:
            reactionProductPlacementSubmissionArtifact
        }
      );
      productPlacementArenaReleaseScheduled = true;
    }
    retainedProductEventBuffer = retainProductEventBuffer && Boolean(productEventBuffer);
    const destroyProductEventBuffer = retainedProductEventBuffer
      ? (
          productEventBuffer === reactionWarmBuffers?.productEvent
            ? () => false
            : () => productEventBuffer.destroy?.()
        )
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
    let productPlacementProvenance = null;
    if (productPlacementReadBuffer && productPlacementByteLength > 0) {
      readbackTelemetry.recordMapAsync(
        productPlacementByteLength,
        'reaction-product-placement-provenance'
      );
      await productPlacementReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const placementValues = new Float32Array(productPlacementReadBuffer.getMappedRange())
        .slice(0, productTermCount * SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_FLOATS);
      productPlacementReadBuffer.unmap();
      productPlacementProvenance = decodeSphReactionProductPlacementSummaryValues(
        placementValues,
        reactionTable,
        {
          readbackMode: borrowedProductPlacementAccumulatorBuffer
            ? 'resident-sequence-product-placement-accumulator-readback'
            : 'single-step-product-placement-accumulator-readback',
          readbackCadence: productPlacementReadbackCadence,
          sourceSummaryCount: productPlacementSourceSummaryCount
        }
      );
      productPlacementProvenance = {
        ...productPlacementProvenance,
        sourceStep: sphParticleState.step ?? null,
        sourceTime: sphParticleState.time ?? null,
        sourceParticleCount: particleCount,
        accumulatorScope: borrowedProductPlacementAccumulatorBuffer
          ? 'caller-owned-resident-sequence'
          : 'single-reaction-step'
      };
    }
    if (!shouldReadCompactSummary) {
      deferLocalBufferCleanup = true;
      // The gas-species ledger is a fixed-size readback (same budget class
      // as the compact particle summary) and the ONLY carrier of sealed-box
      // gas moles for products without particle slots; the resident no-full
      // shortcut must still surface it. Its dispatch and copy were already
      // submitted above, so this maps a tiny buffer that is ready.
      let residentGasSpeciesLedger = emptyGasSpeciesLedger;
      let residentGasSpeciesFloatCount = 0;
      if (shouldRunGasSpecies && gasSpeciesReadBuffer && gasSpeciesByteLength > 0) {
        readbackTelemetry.recordMapAsync(
          gasSpeciesByteLength,
          'reaction-gas-species-control-ledger'
        );
        await gasSpeciesReadBuffer.mapAsync(GPU_MAP_MODE.READ);
        const residentGasValues = new Float32Array(gasSpeciesReadBuffer.getMappedRange())
          .slice(0, gasSpeciesCount * SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS);
        gasSpeciesReadBuffer.unmap();
        residentGasSpeciesLedger = decodeSphReactionGasSpeciesSummaryValues(residentGasValues, reactionTable);
        residentGasSpeciesFloatCount = residentGasValues.length;
      }
      if (!localCleanupFinalConsumer) {
        readbackTelemetry.recordDeferredCleanupHostQueueFence(
          1,
          'reaction-summary-local-buffer-cleanup'
        );
      }
      return attachQueueOrderedFinalConsumer({
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
        localBufferCleanupStatus:
          localCleanupFinalConsumer
            ? 'queue-ordered-after-authenticated-submission'
            : 'submitted-work-cleanup-deferred-after-host-queue-fence',
        localBufferCleanupHostQueueFenceCount:
          localCleanupFinalConsumer ? 0 : 1,
        localBufferCleanupMethod:
          localCleanupFinalConsumer
            ? 'same-gpu-queue-submission-order'
            : 'gpu-queue-on-submitted-work-done',
        rowLayout: [...SPH_GPU_REACTION_SUMMARY_ROW_LAYOUT],
        summaryStrideFloats: SPH_GPU_REACTION_SUMMARY_FLOATS,
        summaryStrideBytes: SPH_GPU_REACTION_SUMMARY_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        gasSpeciesLedger: residentGasSpeciesLedger,
        gasSpeciesLedgerSchema: ULG_SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_SCHEMA,
        gasSpeciesLedgerCount: residentGasSpeciesLedger?.recordCount ?? 0,
        gasSpeciesReadbackFloatCount: residentGasSpeciesFloatCount,
        gasSpeciesReadbackByteLength: residentGasSpeciesFloatCount * Float32Array.BYTES_PER_ELEMENT,
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
        reactionProductPlacementSubmissionArtifact,
        reactionProductPlacementArtifact,
        reactionProductPlacementReceipt:
          reactionProductPlacementArtifact?.receipt ?? null,
        productPlacementProvenance,
        productPlacementProvenanceSchema: ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
        productPlacementProvenanceStatus: productPlacementProvenance?.status
          ?? (shouldRunProductPlacement
              ? 'product-placement-provenance-gpu-resident-not-read'
              : 'product-placement-provenance-not-run'),
        productPlacementProvenanceReadbackFloatCount:
          productPlacementProvenance?.readbackFloatCount ?? 0,
        productPlacementProvenanceReadbackByteLength:
          productPlacementProvenance?.readbackByteLength ?? 0,
        productPlacementAccumulatorByteLength: shouldRunProductPlacement
          ? productPlacementByteLength
          : 0,
        productPlacementAccumulatorBorrowed: borrowedProductPlacementAccumulatorBuffer,
        productPlacementReadbackCadence,
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
        ...readbackTelemetry.snapshot(),
        scientificValidation: false,
        chemistryValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      });
    }
    readbackTelemetry.recordMapAsync(
      summaryByteLength,
      'reaction-strict-gate-compact-summary'
    );
    await readBuffer.mapAsync(GPU_MAP_MODE.READ);
    const values = new Float32Array(readBuffer.getMappedRange()).slice(0, SPH_GPU_REACTION_SUMMARY_FLOATS);
    readBuffer.unmap();
    let gasSpeciesLedger = emptyGasSpeciesLedger;
    if (gasSpeciesReadBuffer && gasSpeciesByteLength > 0) {
      readbackTelemetry.recordMapAsync(
        gasSpeciesByteLength,
        'reaction-gas-species-control-ledger'
      );
      await gasSpeciesReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const gasValues = new Float32Array(gasSpeciesReadBuffer.getMappedRange()).slice(0, gasSpeciesCount * SPH_GPU_REACTION_GAS_SPECIES_SUMMARY_FLOATS);
      gasSpeciesReadBuffer.unmap();
      gasSpeciesLedger = decodeSphReactionGasSpeciesSummaryValues(gasValues, reactionTable);
    }
    let productInventory = emptyProductInventory;
    if (productInventoryReadBuffer && productInventoryByteLength > 0) {
      readbackTelemetry.recordMapAsync(
        productInventoryByteLength,
        'reaction-product-inventory-control-ledger'
      );
      await productInventoryReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const inventoryValues = new Float32Array(productInventoryReadBuffer.getMappedRange()).slice(0, productInventoryCount * SPH_GPU_REACTION_PRODUCT_INVENTORY_FLOATS);
      productInventoryReadBuffer.unmap();
      productInventory = decodeSphReactionProductInventoryValues(inventoryValues, reactionTable);
    }
    let productEvents = residentProductEvents;
    if (productEventReadBuffer && productEventByteLength > 0) {
      readbackTelemetry.recordMapAsync(
        productEventByteLength,
        'reaction-product-event-readback'
      );
      await productEventReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      const productEventValues = new Float32Array(productEventReadBuffer.getMappedRange()).slice(0, productEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
      productEventReadBuffer.unmap();
      productEvents = decodeSphReactionProductEventValues(productEventValues, reactionTable);
    }
    let atomResidualSummary = emptyAtomResidualSummary;
    if (atomResidualReadBuffer && atomResidualByteLength > 0) {
      readbackTelemetry.recordMapAsync(
        atomResidualByteLength,
        'reaction-strict-gate-atom-residual'
      );
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
    return attachQueueOrderedFinalConsumer({
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
      reactionProductPlacementSubmissionArtifact,
      reactionProductPlacementArtifact,
      reactionProductPlacementReceipt:
        reactionProductPlacementArtifact?.receipt ?? null,
      productPlacementProvenance,
      productPlacementProvenanceSchema: ULG_SPH_GPU_REACTION_PRODUCT_PLACEMENT_SUMMARY_SCHEMA,
      productPlacementProvenanceStatus: productPlacementProvenance?.status
        ?? (shouldRunProductPlacement
            ? 'product-placement-provenance-gpu-resident-not-read'
            : 'product-placement-provenance-not-run'),
      productPlacementProvenanceReadbackFloatCount:
        productPlacementProvenance?.readbackFloatCount ?? 0,
      productPlacementProvenanceReadbackByteLength:
        productPlacementProvenance?.readbackByteLength ?? 0,
      productPlacementAccumulatorByteLength: shouldRunProductPlacement
        ? productPlacementByteLength
        : 0,
      productPlacementAccumulatorBorrowed: borrowedProductPlacementAccumulatorBuffer,
      productPlacementReadbackCadence,
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
      compactLedgerProposalBufferBound: borrowedProposalBuffer,
      ...readbackTelemetry.snapshot()
    });
  } catch (error) {
    localCleanupTelemetryTarget = error;
    if (localCleanupFinalConsumer) {
      Object.defineProperty(
        error,
        'queueOrderedFinalConsumerCapability',
        {
          value: localCleanupFinalConsumer,
          enumerable: false
        }
      );
    }
    throw error;
  } finally {
    if (deferLocalBufferCleanup) {
      if (localCleanupClaim && localCleanupFinalConsumer) {
        try {
          releaseSubmittedWorkCleanupQueueOrdered(
            device,
            destroyLocalBuffers,
            {
              queueOrderedFinalConsumer: localCleanupFinalConsumer,
              producerClaim: localCleanupClaim,
              producerOutput: localCleanupOutput,
              producerFamily: 'sph-reaction-summary-local-buffers'
            }
          );
        } catch {
          // The final-consumer capability was already published on the result
          // (or error) before exact local cleanup. The local claim is already
          // consumed, so retry its idempotent destructor behind the ordinary
          // queue fence while preserving external claim recovery.
          readbackTelemetry.recordDeferredCleanupHostQueueFence(
            1,
            'reaction-summary-local-buffer-cleanup-fallback'
          );
          if (localCleanupTelemetryTarget) {
            Object.assign(
              localCleanupTelemetryTarget,
              readbackTelemetry.snapshot()
            );
          }
          deferSubmittedWorkCleanup(device, destroyLocalBuffers);
        }
      } else {
        const cleanupFence =
          typeof device.queue?.onSubmittedWorkDone === 'function'
            ? device.queue.onSubmittedWorkDone()
            : null;
        if (cleanupFence?.then) {
          cleanupFence.then(destroyLocalBuffers, destroyLocalBuffers);
        }
      }
    } else {
      destroyLocalBuffers();
    }
  }
  } finally {
    if (
      productPlacementSegmentedArenaLease
      && !productPlacementArenaReleaseScheduled
    ) {
      if (reactionProductPlacementSubmissionArtifact) {
        releaseSphReactionProductPlacementSegmentedArenaAfterQueue(
          productPlacementSegmentedArenaLease,
          {
            device,
            authority: canonicalReactionProductPlacementAuthority,
            submissionArtifact:
              reactionProductPlacementSubmissionArtifact
          }
        );
      } else {
        discardSphReactionProductPlacementSegmentedArenaLease(
          productPlacementSegmentedArenaLease,
          {
            device,
            authority: canonicalReactionProductPlacementAuthority
          }
        );
      }
      productPlacementArenaReleaseScheduled = true;
    }
  }
}
