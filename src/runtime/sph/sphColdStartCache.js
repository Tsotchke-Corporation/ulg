import {
  CLOSURE_LAW_GRAPH_EDGE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT,
  CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  hashPayload
} from '../../../ulg-gpu-abi/src/index.js';

export const SPH_COLD_START_CACHE_STORAGE_KEY = 'peercompute.ulg.sph-cold-start-cache.v1';
export const SPH_COLD_START_CACHE_SCHEMA = 'peercompute.ulg.sph-cold-start-cache.v0';
export const SPH_PRODUCT_REUSE_RECORD_SCHEMA = 'peercompute.ulg.sph-product-reuse-cache-record.v0';
export const SPH_STATIC_TABLE_CACHE_STORAGE_KEY = 'peercompute.ulg.sph-static-table-cache.v1';
export const SPH_STATIC_TABLE_CACHE_STORE_SCHEMA = 'peercompute.ulg.sph-static-table-cache-store.v0';
export const SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA = 'peercompute.ulg.sph-static-table-cache-update.v0';
export const SPH_STATIC_TABLE_CACHE_REHYDRATE_SCHEMA = 'peercompute.ulg.sph-static-table-cache-rehydrate.v0';
export const SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA = 'peercompute.ulg.sph-static-table-cache-bundle.v0';
export const SPH_TABLE_CACHE_RECORD_SCHEMA = 'peercompute.ulg.sph-static-table-cache.v0';
export const SPH_GPU_WARMUP_CACHE_SCHEMA = 'peercompute.ulg.sph-gpu-warmup-cache.v0';

const ARRAY_TYPES = Object.freeze({
  Float32Array,
  Float64Array,
  Int32Array,
  Uint32Array,
  Int16Array,
  Uint16Array,
  Int8Array,
  Uint8Array
});

function nowIso() {
  return new Date().toISOString();
}

function typedArrayCachePayload(value) {
  const data = ArrayBuffer.isView(value) ? Array.from(value) : [];
  return {
    arrayType: value?.constructor?.name || 'Float32Array',
    length: data.length,
    byteLength: value?.byteLength ?? (data.length * Float32Array.BYTES_PER_ELEMENT),
    hash: hashPayload(data),
    data
  };
}

export function decodeTypedArrayCachePayload(payload) {
  if (!payload || !Array.isArray(payload.data)) return null;
  if (payload.hash && payload.hash !== hashPayload(payload.data)) return null;
  if (Number.isFinite(payload.length) && payload.length !== payload.data.length) return null;
  const Ctor = ARRAY_TYPES[payload.arrayType] || Float32Array;
  return new Ctor(payload.data);
}

export function emptySphColdStartCache(status = 'empty', extra = {}) {
  return {
    schema: SPH_COLD_START_CACHE_SCHEMA,
    status,
    storageKey: SPH_COLD_START_CACHE_STORAGE_KEY,
    reactions: {},
    productReuse: {},
    tables: {},
    gpuWarmup: {},
    ...extra
  };
}

export function parseSphColdStartCacheSnapshot(snapshot, {
  generatorFingerprint = null
} = {}) {
  try {
    const parsed = typeof snapshot === 'string' && snapshot.length
      ? JSON.parse(snapshot)
      : null;
    if (!parsed || parsed.schema !== SPH_COLD_START_CACHE_SCHEMA) {
      return emptySphColdStartCache(parsed?.schema ? 'schema-mismatch' : 'empty', {
        previousSchema: parsed?.schema || null,
        staleEntryCount: Object.keys(parsed?.reactions || {}).length
          + Object.keys(parsed?.productReuse || {}).length
      });
    }
    if (generatorFingerprint && parsed.generatorFingerprint !== generatorFingerprint) {
      return emptySphColdStartCache('generator-fingerprint-mismatch', {
        generatorFingerprint,
        previousGeneratorFingerprint: parsed.generatorFingerprint || null,
        staleEntryCount: Object.keys(parsed.reactions || {}).length
          + Object.keys(parsed.productReuse || {}).length
          + Object.keys(parsed.tables || {}).length
          + Object.keys(parsed.gpuWarmup || {}).length
      });
    }
    return {
      ...parsed,
      status: 'loaded',
      storageKey: parsed.storageKey || SPH_COLD_START_CACHE_STORAGE_KEY,
      reactions: parsed.reactions || {},
      productReuse: parsed.productReuse || {},
      tables: parsed.tables || {},
      gpuWarmup: parsed.gpuWarmup || {}
    };
  } catch {
    return emptySphColdStartCache('parse-error');
  }
}

export function emptySphStaticTableCache(status = 'empty', extra = {}) {
  return {
    schema: SPH_STATIC_TABLE_CACHE_STORE_SCHEMA,
    status,
    storageKey: SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
    tables: {},
    gpuWarmup: {},
    ...extra
  };
}

export function parseSphStaticTableCacheSnapshot(snapshot, {
  generatorFingerprint = null
} = {}) {
  try {
    const parsed = typeof snapshot === 'string' && snapshot.length
      ? JSON.parse(snapshot)
      : null;
    if (!parsed || parsed.schema !== SPH_STATIC_TABLE_CACHE_STORE_SCHEMA) {
      return emptySphStaticTableCache(parsed?.schema ? 'schema-mismatch' : 'empty', {
        previousSchema: parsed?.schema || null,
        staleEntryCount: Object.keys(parsed?.tables || {}).length
          + Object.keys(parsed?.gpuWarmup || {}).length
      });
    }
    if (generatorFingerprint && parsed.generatorFingerprint !== generatorFingerprint) {
      return emptySphStaticTableCache('generator-fingerprint-mismatch', {
        generatorFingerprint,
        previousGeneratorFingerprint: parsed.generatorFingerprint || null,
        staleEntryCount: Object.keys(parsed.tables || {}).length
          + Object.keys(parsed.gpuWarmup || {}).length
      });
    }
    return {
      ...parsed,
      status: 'loaded',
      storageKey: parsed.storageKey || SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
      tables: parsed.tables || {},
      gpuWarmup: parsed.gpuWarmup || {}
    };
  } catch {
    return emptySphStaticTableCache('parse-error');
  }
}

function tableCacheRecord({
  family,
  table,
  arrays = {},
  metadata = {},
  generatorFingerprint,
  updatedAt = nowIso()
}) {
  if (!table?.schema || !generatorFingerprint) return null;
  const arrayPayloads = Object.fromEntries(
    Object.entries(arrays)
      .filter(([, value]) => ArrayBuffer.isView(value))
      .map(([name, value]) => [name, typedArrayCachePayload(value)])
  );
  const rowHash = hashPayload({
    family,
    sourceSchema: table.schema,
    arrays: Object.fromEntries(
      Object.entries(arrayPayloads).map(([name, payload]) => [name, {
        length: payload.length,
        byteLength: payload.byteLength,
        hash: payload.hash
      }])
    ),
    metadata
  });
  const cacheKey = hashPayload({
    cacheFamily: 'peercompute-local-sph-static-table',
    schema: SPH_TABLE_CACHE_RECORD_SCHEMA,
    family,
    sourceSchema: table.schema,
    rowHash,
    generatorFingerprint
  });
  return {
    schema: SPH_TABLE_CACHE_RECORD_SCHEMA,
    cacheKey,
    family,
    sourceSchema: table.schema,
    status: 'derived-static-table-cache-record-ready',
    rowHash,
    arrays: arrayPayloads,
    metadata,
    generatorFingerprint,
    updatedAt,
    provenance: {
      source: 'sph-phase-demo-derived-table',
      reusePolicy: 'schema-row-layout-row-hash-generator-fingerprint'
    }
  };
}

export function sphStaticTableInputsFromScene(scene) {
  return {
    thermalMaterialTable: scene?.getSphThermalMaterialTable?.() || null,
    thermalClosureGraphSet: scene?.getSphThermalClosureGraphBuffers?.() || null,
    thermalPhaseResponseTable: scene?.getSphThermalPhaseResponseTable?.() || null,
    opticalGpuTable: scene?.getOpticalGpuTable?.() || null,
    reactionTable: scene?.getSphReactionTable?.() || null
  };
}

export function createSphStaticTableCacheRecords(tableInputs = {}, {
  generatorFingerprint,
  updatedAt = nowIso()
} = {}) {
  const {
    thermalMaterialTable = null,
    thermalClosureGraphSet = null,
    thermalPhaseResponseTable = null,
    opticalGpuTable = null,
    reactionTable = null
  } = tableInputs || {};
  const records = [];
  if (thermalMaterialTable) {
    records.push(tableCacheRecord({
      family: 'sph-thermal-material-table',
      table: thermalMaterialTable,
      arrays: {
        records: thermalMaterialTable.records,
        segments: thermalMaterialTable.segments
      },
      metadata: {
        materialCount: thermalMaterialTable.materialCount,
        segmentCount: thermalMaterialTable.segmentCount,
        recordStrideFloats: thermalMaterialTable.recordStrideFloats,
        segmentStrideFloats: thermalMaterialTable.segmentStrideFloats,
        recordLayout: thermalMaterialTable.recordLayout,
        segmentLayout: thermalMaterialTable.segmentLayout,
        materials: thermalMaterialTable.metadata,
        materialPropertyBankWarmInputConsumer:
          thermalMaterialTable.materialPropertyBankWarmInputConsumer ?? null,
        materialPropertyBankWarmInputRowCount:
          thermalMaterialTable.materialPropertyBankWarmInputRowCount ?? 0,
        materialPropertyBankWarmInputMatchedMaterialCount:
          thermalMaterialTable.materialPropertyBankWarmInputMatchedMaterialCount ?? 0
      },
      generatorFingerprint,
      updatedAt
    }));
  }
  if (thermalClosureGraphSet?.graphBank) {
    const graphBank = thermalClosureGraphSet.graphBank;
    records.push(tableCacheRecord({
      family: 'sph-thermal-closure-graph-bank',
      table: graphBank,
      arrays: {
        nodeRows: graphBank.nodeRows,
        edgeRows: graphBank.edgeRows,
        sampleRows: graphBank.sampleRows,
        slotRows: graphBank.slotRows,
        statusRows: graphBank.statusRows
      },
      metadata: {
        graphSetSchema: thermalClosureGraphSet.schema,
        graphCount: graphBank.graphCount,
        nodeCount: graphBank.nodeCount,
        edgeCount: graphBank.edgeCount,
        sampleCount: graphBank.sampleCount,
        slotCount: graphBank.slotCount,
        statusCount: graphBank.statusCount,
        graphRecords: graphBank.graphRecords,
        graphMetadata: thermalClosureGraphSet.metadata,
        skippedSegments: thermalClosureGraphSet.skippedSegments
      },
      generatorFingerprint,
      updatedAt
    }));
  }
  if (thermalPhaseResponseTable) {
    records.push(tableCacheRecord({
      family: 'sph-thermal-phase-response-table',
      table: thermalPhaseResponseTable,
      arrays: {
        records: thermalPhaseResponseTable.records,
        responses: thermalPhaseResponseTable.responses
      },
      metadata: {
        sourceSchema: thermalPhaseResponseTable.sourceSchema || null,
        graphSetSchema: thermalPhaseResponseTable.graphSetSchema || null,
        graphBankSchema: thermalPhaseResponseTable.graphBankSchema || null,
        materialCount: thermalPhaseResponseTable.materialCount,
        responseCount: thermalPhaseResponseTable.responseCount,
        recordStrideFloats: thermalPhaseResponseTable.recordStrideFloats,
        responseStrideFloats: thermalPhaseResponseTable.responseStrideFloats,
        recordLayout: thermalPhaseResponseTable.recordLayout,
        responseLayout: thermalPhaseResponseTable.responseLayout,
        tableMetadata: thermalPhaseResponseTable.metadata
      },
      generatorFingerprint,
      updatedAt
    }));
  }
  if (opticalGpuTable) {
    records.push(tableCacheRecord({
      family: 'optical-pbr-table',
      table: opticalGpuTable,
      arrays: {
        records: opticalGpuTable.records,
        spectralSamples: opticalGpuTable.spectralSamples
      },
      metadata: {
        recordCount: opticalGpuTable.recordCount,
        spectralSampleCount: opticalGpuTable.spectralSampleCount,
        recordStrideFloats: opticalGpuTable.recordStrideFloats,
        spectralSampleStrideFloats: opticalGpuTable.spectralSampleStrideFloats,
        recordLayout: opticalGpuTable.recordLayout,
        spectralSampleLayout: opticalGpuTable.spectralSampleLayout,
        materialMap: opticalGpuTable.materialMap,
        recordMetadata: opticalGpuTable.recordMetadata,
        colorSpace: opticalGpuTable.colorSpace
      },
      generatorFingerprint,
      updatedAt
    }));
  }
  if (reactionTable) {
    records.push(tableCacheRecord({
      family: 'sph-reaction-table',
      table: reactionTable,
      arrays: {
        records: reactionTable.records,
        reactionHeaders: reactionTable.reactionHeaders,
        reactantTermRecords: reactionTable.reactantTermRecords,
        productTermRecords: reactionTable.productTermRecords,
        gasProductRecords: reactionTable.gasProductRecords,
        atomTermRecords: reactionTable.atomTermRecords,
        productPhaseRecords: reactionTable.productPhaseRecords
      },
      metadata: {
        reactionClosureSchema: reactionTable.reactionClosureSchema || null,
        reactionCount: reactionTable.reactionCount,
        reactionHeaderCount: reactionTable.reactionHeaderCount || 0,
        reactantTermCount: reactionTable.reactantTermCount || 0,
        productTermCount: reactionTable.productTermCount || 0,
        gasProductCount: reactionTable.gasProductCount || 0,
        atomTermCount: reactionTable.atomTermCount || 0,
        productPhaseCount: reactionTable.productPhaseCount,
        recordStrideFloats: reactionTable.recordStrideFloats,
        reactionHeaderStrideFloats: reactionTable.reactionHeaderStrideFloats || 0,
        reactantTermStrideFloats: reactionTable.reactantTermStrideFloats || 0,
        productTermStrideFloats: reactionTable.productTermStrideFloats || 0,
        gasProductStrideFloats: reactionTable.gasProductStrideFloats || 0,
        atomTermStrideFloats: reactionTable.atomTermStrideFloats || 0,
        productPhaseStrideFloats: reactionTable.productPhaseStrideFloats,
        recordLayout: reactionTable.recordLayout,
        reactionHeaderLayout: reactionTable.reactionHeaderLayout || [],
        reactantTermLayout: reactionTable.reactantTermLayout || [],
        productTermLayout: reactionTable.productTermLayout || [],
        gasProductLayout: reactionTable.gasProductLayout || [],
        atomTermLayout: reactionTable.atomTermLayout || [],
        productPhaseLayout: reactionTable.productPhaseLayout,
        reactionMetadata: reactionTable.metadata,
        reactantTermMetadata: reactionTable.reactantTermMetadata || [],
        productTermMetadata: reactionTable.productTermMetadata || [],
        gasProductMetadata: reactionTable.gasProductMetadata || [],
        atomTermMetadata: reactionTable.atomTermMetadata || [],
        productPhaseMetadata: reactionTable.productPhaseMetadata
      },
      generatorFingerprint,
      updatedAt
    }));
  }
  return records.filter(Boolean);
}

export function warmupCacheRecordForTableRecords(records = [], {
  generatorFingerprint,
  updatedAt = nowIso()
} = {}) {
  if (!records.length || !generatorFingerprint) return null;
  const tableHashes = Object.fromEntries(records.map((record) => [record.family, record.rowHash]));
  const signature = hashPayload({
    schema: SPH_GPU_WARMUP_CACHE_SCHEMA,
    tableHashes,
    generatorFingerprint
  });
  return {
    schema: SPH_GPU_WARMUP_CACHE_SCHEMA,
    cacheKey: signature,
    status: 'static-upload-and-pipeline-signature-ready',
    tableHashes,
    pipelineFamilies: [
      'optical-gpu-lookup',
      'sph-thermal-step',
      'sph-reaction-step',
      'mls-mpm-resident-step',
      'sph-resident-render-field'
    ],
    generatorFingerprint,
    updatedAt,
    provenance: {
      source: 'sph-phase-demo-derived-table-signatures',
      reusePolicy: 'metadata-only-warmup-signal-live-webgpu-resources-recreated-per-session'
    }
  };
}

export function createSphStaticTableCacheUpdate({
  previousCache = null,
  previousSnapshot = null,
  tableInputs = {},
  records = null,
  generatorFingerprint,
  updatedAt = nowIso()
} = {}) {
  const parsedPrevious = previousCache?.schema
    ? previousCache
    : parseSphStaticTableCacheSnapshot(previousSnapshot, { generatorFingerprint });
  const nextRecords = Array.isArray(records)
    ? records
    : createSphStaticTableCacheRecords(tableInputs, { generatorFingerprint, updatedAt });
  const tables = { ...(parsedPrevious.tables || {}) };
  const gpuWarmup = { ...(parsedPrevious.gpuWarmup || {}) };
  let tableWriteCount = 0;
  let tableUnchangedCount = 0;
  for (const record of nextRecords) {
    if (!record?.cacheKey) continue;
    if (tables[record.cacheKey]?.rowHash === record.rowHash) {
      tableUnchangedCount += 1;
    } else {
      tables[record.cacheKey] = record;
      tableWriteCount += 1;
    }
  }
  const warmupRecord = warmupCacheRecordForTableRecords(nextRecords, { generatorFingerprint, updatedAt });
  let gpuWarmupWriteCount = 0;
  if (warmupRecord) {
    if (gpuWarmup[warmupRecord.cacheKey]?.updatedAt) {
      tableUnchangedCount += 1;
    } else {
      gpuWarmup[warmupRecord.cacheKey] = warmupRecord;
      gpuWarmupWriteCount = 1;
    }
  }
  const next = {
    schema: SPH_STATIC_TABLE_CACHE_STORE_SCHEMA,
    status: 'stored',
    storageKey: SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
    generatorFingerprint,
    tables,
    gpuWarmup,
    tableSchema: SPH_TABLE_CACHE_RECORD_SCHEMA,
    gpuWarmupSchema: SPH_GPU_WARMUP_CACHE_SCHEMA,
    updatedAt,
    counts: {
      tables: Object.keys(tables).length,
      gpuWarmup: Object.keys(gpuWarmup).length
    },
    provenance: {
      source: 'sph-phase-demo-static-table-cache-coordinator',
      reusePolicy: 'derived-artifact-cache-only'
    }
  };
  const cacheSnapshot = JSON.stringify(next);
  return {
    schema: SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
    status: 'stored',
    storageKey: SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
    cacheSnapshot,
    counts: next.counts,
    tableWriteCount,
    tableUnchangedCount,
    gpuWarmupWriteCount,
    writtenFamilies: nextRecords.map((record) => record.family),
    generatorFingerprint,
    previousStatus: parsedPrevious.status,
    tableSchema: SPH_TABLE_CACHE_RECORD_SCHEMA,
    gpuWarmupSchema: SPH_GPU_WARMUP_CACHE_SCHEMA,
    updatedAt,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function rehydrateSphStaticTableCache(snapshotOrCache, {
  generatorFingerprint = null,
  families = null
} = {}) {
  const cache = typeof snapshotOrCache === 'string'
    ? parseSphStaticTableCacheSnapshot(snapshotOrCache, { generatorFingerprint })
    : parseSphStaticTableCacheSnapshot(JSON.stringify(snapshotOrCache || null), { generatorFingerprint });
  const allowedFamilies = families ? new Set(families) : null;
  const records = [];
  const stale = [];
  for (const record of Object.values(cache.tables || {})) {
    if (!record?.cacheKey) continue;
    if (allowedFamilies && !allowedFamilies.has(record.family)) continue;
    if (record.schema !== SPH_TABLE_CACHE_RECORD_SCHEMA) {
      stale.push({ cacheKey: record.cacheKey, family: record.family || null, reason: 'record-schema-mismatch' });
      continue;
    }
    if (generatorFingerprint && record.generatorFingerprint !== generatorFingerprint) {
      stale.push({ cacheKey: record.cacheKey, family: record.family || null, reason: 'generator-fingerprint-mismatch' });
      continue;
    }
    const arrays = {};
    let valid = true;
    for (const [name, payload] of Object.entries(record.arrays || {})) {
      const decoded = decodeTypedArrayCachePayload(payload);
      if (!decoded) {
        stale.push({ cacheKey: record.cacheKey, family: record.family, array: name, reason: 'array-hash-or-shape-mismatch' });
        valid = false;
        break;
      }
      arrays[name] = decoded;
    }
    if (!valid) continue;
    records.push({
      ...record,
      arrays,
      rehydrated: true
    });
  }
  return {
    schema: SPH_STATIC_TABLE_CACHE_REHYDRATE_SCHEMA,
    status: records.length ? 'static-table-cache-hit' : cache.status === 'loaded' ? 'static-table-cache-miss' : cache.status,
    storageStatus: cache.status,
    storageKey: SPH_STATIC_TABLE_CACHE_STORAGE_KEY,
    records,
    families: records.map((record) => record.family),
    tableCount: Object.keys(cache.tables || {}).length,
    gpuWarmupCount: Object.keys(cache.gpuWarmup || {}).length,
    hitCount: records.length,
    staleCount: stale.length + (cache.staleEntryCount || 0),
    stale,
    generatorFingerprint
  };
}

export function summarizeSphStaticTableCacheSnapshot(snapshot, options = {}) {
  const rehydrated = rehydrateSphStaticTableCache(snapshot, options);
  return {
    ...rehydrated,
    records: rehydrated.records.map((record) => ({
      cacheKey: record.cacheKey,
      family: record.family,
      sourceSchema: record.sourceSchema,
      rowHash: record.rowHash,
      arrays: Object.fromEntries(
        Object.entries(record.arrays || {}).map(([name, value]) => [name, {
          arrayType: value.constructor.name,
          length: value.length,
          byteLength: value.byteLength
        }])
      ),
      metadata: record.metadata,
      generatorFingerprint: record.generatorFingerprint,
      updatedAt: record.updatedAt
    }))
  };
}

function latestRecordByFamily(records = []) {
  const byFamily = new Map();
  for (const record of records) {
    if (!record?.family) continue;
    const previous = byFamily.get(record.family);
    if (!previous || String(record.updatedAt || '') >= String(previous.updatedAt || '')) {
      byFamily.set(record.family, record);
    }
  }
  return byFamily;
}

function cacheMetadata(record) {
  return {
    cacheKey: record.cacheKey,
    family: record.family,
    rowHash: record.rowHash,
    sourceSchema: record.sourceSchema,
    generatorFingerprint: record.generatorFingerprint,
    updatedAt: record.updatedAt
  };
}

function restoreThermalMaterialTable(record) {
  if (!record?.arrays?.records || !record?.arrays?.segments) return null;
  const metadata = record.metadata || {};
  return {
    schema: record.sourceSchema,
    status: 'static-table-cache-hit',
    materialCount: metadata.materialCount ?? (record.arrays.records.length / (metadata.recordStrideFloats || 4)),
    segmentCount: metadata.segmentCount ?? 0,
    recordLayout: metadata.recordLayout || [],
    segmentLayout: metadata.segmentLayout || [],
    recordStrideFloats: metadata.recordStrideFloats || 4,
    segmentStrideFloats: metadata.segmentStrideFloats || 12,
    records: record.arrays.records,
    segments: record.arrays.segments,
    metadata: metadata.materials || [],
    materialPropertyBankWarmInputConsumer:
      metadata.materialPropertyBankWarmInputConsumer ?? null,
    materialPropertyBankWarmInputRowCount:
      metadata.materialPropertyBankWarmInputRowCount ?? 0,
    materialPropertyBankWarmInputMatchedMaterialCount:
      metadata.materialPropertyBankWarmInputMatchedMaterialCount ?? 0,
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function sliceRows(rows, offset, count, stride) {
  const start = Math.max(0, Number(offset) || 0) * stride;
  const end = start + Math.max(0, Number(count) || 0) * stride;
  return rows.slice(start, end);
}

function restoreClosureGraphFromBank(graphBank, graphRecord, graphMetadata = null) {
  const nodeStride = CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT.length;
  const edgeStride = CLOSURE_LAW_GRAPH_EDGE_ROW_LAYOUT.length;
  const sampleStride = CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT.length;
  const slotStride = CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT.length;
  const statusStride = CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT.length;
  const nodeRows = sliceRows(graphBank.nodeRows, graphRecord.nodeOffset, graphRecord.nodeCount, nodeStride);
  for (let nodeIndex = 0; nodeIndex < graphRecord.nodeCount; nodeIndex += 1) {
    const offset = nodeIndex * nodeStride;
    nodeRows[offset + 4] -= graphRecord.sampleOffset || 0;
    nodeRows[offset + 8] -= graphRecord.edgeOffset || 0;
    nodeRows[offset + 11] -= graphRecord.statusOffset || 0;
  }
  return {
    schema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    status: 'static-table-cache-hit',
    graphId: graphRecord.graphId,
    nodeCount: graphRecord.nodeCount,
    edgeCount: graphRecord.edgeCount,
    sampleCount: graphRecord.sampleCount,
    slotCount: graphRecord.slotCount,
    statusCount: graphRecord.statusCount,
    nodeRows,
    edgeRows: sliceRows(graphBank.edgeRows, graphRecord.edgeOffset, graphRecord.edgeCount, edgeStride),
    sampleRows: sliceRows(graphBank.sampleRows, graphRecord.sampleOffset, graphRecord.sampleCount, sampleStride),
    slotRows: sliceRows(graphBank.slotRows, graphRecord.slotOffset, graphRecord.slotCount, slotStride),
    statusRows: sliceRows(graphBank.statusRows, graphRecord.statusOffset, graphRecord.statusCount, statusStride),
    nodeStrideFloats: nodeStride,
    edgeStrideFloats: edgeStride,
    sampleStrideFloats: sampleStride,
    slotStrideFloats: slotStride,
    statusStrideFloats: statusStride,
    sourceSegmentIndex: graphRecord.sourceSegmentIndex,
    sourceMaterialId: graphRecord.materialId,
    sourcePhaseFromId: graphRecord.phaseFromId,
    sourcePhaseToId: graphRecord.phaseToId,
    ...(graphMetadata || {}),
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function restoreThermalClosureGraphSet(record) {
  const arrays = record?.arrays || {};
  if (!arrays.nodeRows || !arrays.edgeRows || !arrays.sampleRows || !arrays.slotRows || !arrays.statusRows) {
    return null;
  }
  const metadata = record.metadata || {};
  const graphBank = {
    schema: record.sourceSchema,
    status: 'static-table-cache-hit',
    graphSchema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    graphCount: metadata.graphCount ?? 0,
    nodeCount: metadata.nodeCount ?? 0,
    edgeCount: metadata.edgeCount ?? 0,
    sampleCount: metadata.sampleCount ?? 0,
    slotCount: metadata.slotCount ?? 0,
    statusCount: metadata.statusCount ?? 0,
    nodeRows: arrays.nodeRows,
    edgeRows: arrays.edgeRows,
    sampleRows: arrays.sampleRows,
    slotRows: arrays.slotRows,
    statusRows: arrays.statusRows,
    graphRecords: metadata.graphRecords || [],
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  const graphMetadata = metadata.graphMetadata?.metadata || metadata.graphMetadata || [];
  const graphMetadataByIndex = new Map(
    Array.isArray(graphMetadata)
      ? graphMetadata.map((entry) => [entry.graphIndex, entry])
      : []
  );
  const graphs = graphBank.graphRecords.map((graphRecord) => (
    restoreClosureGraphFromBank(graphBank, graphRecord, graphMetadataByIndex.get(graphRecord.graphIndex) || null)
  ));
  return {
    schema: metadata.graphSetSchema || ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
    status: 'static-table-cache-hit',
    sourceSchema: metadata.sourceSchema || null,
    graphSchema: ULG_CLOSURE_LAW_GRAPH_SCHEMA,
    graphBankSchema: graphBank.schema || ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    axisName: 'specificInternalEnergyJPerKg',
    outputName: 'temperatureK',
    derivativeName: 'dTemperatureKdSpecificInternalEnergyJPerKg',
    materialCount: metadata.graphMetadata?.materialCount ?? null,
    segmentCount: metadata.graphMetadata?.segmentCount ?? null,
    graphCount: graphBank.graphCount,
    skippedSegmentCount: metadata.skippedSegments?.length || 0,
    graphBank,
    graphs,
    metadata: Array.isArray(graphMetadata) ? graphMetadata : [],
    skippedSegments: metadata.skippedSegments || [],
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function restoreThermalPhaseResponseTable(record) {
  if (!record?.arrays?.records || !record?.arrays?.responses) return null;
  const metadata = record.metadata || {};
  return {
    schema: record.sourceSchema,
    status: 'static-table-cache-hit',
    sourceSchema: metadata.sourceSchema || null,
    graphSetSchema: metadata.graphSetSchema || ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
    graphBankSchema: metadata.graphBankSchema || ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
    materialCount: metadata.materialCount ?? 0,
    responseCount: metadata.responseCount ?? 0,
    recordLayout: metadata.recordLayout || [],
    responseLayout: metadata.responseLayout || [],
    recordStrideFloats: metadata.recordStrideFloats || 4,
    responseStrideFloats: metadata.responseStrideFloats || 16,
    records: record.arrays.records,
    responses: record.arrays.responses,
    metadata: metadata.tableMetadata || [],
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function restoreOpticalGpuTable(record) {
  if (!record?.arrays?.records || !record?.arrays?.spectralSamples) return null;
  const metadata = record.metadata || {};
  return {
    schema: record.sourceSchema,
    status: 'static-table-cache-hit',
    records: record.arrays.records,
    spectralSamples: record.arrays.spectralSamples,
    recordCount: metadata.recordCount ?? 0,
    spectralSampleCount: metadata.spectralSampleCount ?? 0,
    recordStrideFloats: metadata.recordStrideFloats || 0,
    spectralSampleStrideFloats: metadata.spectralSampleStrideFloats || 0,
    recordLayout: metadata.recordLayout || [],
    spectralSampleLayout: metadata.spectralSampleLayout || [],
    materialMap: metadata.materialMap || [],
    recordMetadata: metadata.recordMetadata || [],
    colorSpace: metadata.colorSpace || 'linear-rgb-from-srgb-closure-output',
    cache: cacheMetadata(record),
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}

function restoreReactionTable(record) {
  if (!record?.arrays?.records || !record?.arrays?.productPhaseRecords) return null;
  const metadata = record.metadata || {};
  return {
    schema: record.sourceSchema,
    status: 'static-table-cache-hit',
    reactionClosureSchema: metadata.reactionClosureSchema || null,
    reactionCount: metadata.reactionCount ?? 0,
    reactionHeaderCount: metadata.reactionHeaderCount ?? 0,
    reactantTermCount: metadata.reactantTermCount ?? 0,
    productTermCount: metadata.productTermCount ?? 0,
    gasProductCount: metadata.gasProductCount ?? 0,
    atomTermCount: metadata.atomTermCount ?? 0,
    productPhaseCount: metadata.productPhaseCount ?? 0,
    combinedRecordCount: (
      record.arrays.records.length
      + record.arrays.productPhaseRecords.length
      + (record.arrays.reactionHeaders?.length || 0)
      + (record.arrays.reactantTermRecords?.length || 0)
      + (record.arrays.productTermRecords?.length || 0)
      + (record.arrays.gasProductRecords?.length || 0)
      + (record.arrays.atomTermRecords?.length || 0)
    ) / 4,
    recordLayout: metadata.recordLayout || [],
    reactionHeaderLayout: metadata.reactionHeaderLayout || [],
    reactantTermLayout: metadata.reactantTermLayout || [],
    productTermLayout: metadata.productTermLayout || [],
    gasProductLayout: metadata.gasProductLayout || [],
    atomTermLayout: metadata.atomTermLayout || [],
    productPhaseLayout: metadata.productPhaseLayout || [],
    recordStrideFloats: metadata.recordStrideFloats || 12,
    reactionHeaderStrideFloats: metadata.reactionHeaderStrideFloats || 0,
    reactantTermStrideFloats: metadata.reactantTermStrideFloats || 0,
    productTermStrideFloats: metadata.productTermStrideFloats || 0,
    gasProductStrideFloats: metadata.gasProductStrideFloats || 0,
    atomTermStrideFloats: metadata.atomTermStrideFloats || 0,
    productPhaseStrideFloats: metadata.productPhaseStrideFloats || 12,
    records: record.arrays.records,
    reactionHeaders: record.arrays.reactionHeaders || new Float32Array(0),
    reactantTermRecords: record.arrays.reactantTermRecords || new Float32Array(0),
    productTermRecords: record.arrays.productTermRecords || new Float32Array(0),
    gasProductRecords: record.arrays.gasProductRecords || new Float32Array(0),
    atomTermRecords: record.arrays.atomTermRecords || new Float32Array(0),
    productPhaseRecords: record.arrays.productPhaseRecords,
    combinedRecords: Float32Array.from([
      ...record.arrays.records,
      ...record.arrays.productPhaseRecords,
      ...(record.arrays.reactionHeaders || []),
      ...(record.arrays.reactantTermRecords || []),
      ...(record.arrays.productTermRecords || []),
      ...(record.arrays.gasProductRecords || []),
      ...(record.arrays.atomTermRecords || [])
    ]),
    metadata: metadata.reactionMetadata || [],
    reactantTermMetadata: metadata.reactantTermMetadata || [],
    productTermMetadata: metadata.productTermMetadata || [],
    gasProductMetadata: metadata.gasProductMetadata || [],
    atomTermMetadata: metadata.atomTermMetadata || [],
    productPhaseMetadata: metadata.productPhaseMetadata || [],
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    chemistryValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

export function rehydrateSphStaticTableBundle(snapshotOrCache, options = {}) {
  const rehydrated = rehydrateSphStaticTableCache(snapshotOrCache, options);
  const byFamily = latestRecordByFamily(rehydrated.records);
  const thermalMaterialTable = restoreThermalMaterialTable(byFamily.get('sph-thermal-material-table'));
  const thermalClosureGraphSet = restoreThermalClosureGraphSet(byFamily.get('sph-thermal-closure-graph-bank'));
  const thermalPhaseResponseTable = restoreThermalPhaseResponseTable(byFamily.get('sph-thermal-phase-response-table'));
  const opticalGpuTable = restoreOpticalGpuTable(byFamily.get('optical-pbr-table'));
  const reactionTable = restoreReactionTable(byFamily.get('sph-reaction-table'));
  const restored = {
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalPhaseResponseTable,
    opticalGpuTable,
    reactionTable
  };
  const restoredFamilies = Object.entries(restored)
    .filter(([, value]) => value?.schema)
    .map(([family]) => family);
  return {
    schema: SPH_STATIC_TABLE_CACHE_BUNDLE_SCHEMA,
    status: restoredFamilies.length ? 'static-table-cache-bundle-hit' : rehydrated.status,
    storageStatus: rehydrated.storageStatus,
    restoredFamilies,
    hitCount: restoredFamilies.length,
    staleCount: rehydrated.staleCount,
    tableCount: rehydrated.tableCount,
    gpuWarmupCount: rehydrated.gpuWarmupCount,
    source: rehydrated,
    ...restored,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function compactRehydratedRecord(record) {
  return {
    cacheKey: record.cacheKey,
    family: record.family,
    sourceSchema: record.sourceSchema,
    rowHash: record.rowHash,
    rehydrated: record.rehydrated === true,
    arrays: Object.fromEntries(
      Object.entries(record.arrays || {}).map(([name, value]) => [name, {
        arrayType: value?.constructor?.name || null,
        length: value?.length ?? 0,
        byteLength: value?.byteLength ?? 0
      }])
    ),
    generatorFingerprint: record.generatorFingerprint,
    updatedAt: record.updatedAt
  };
}

export function compactSphStaticTableBundleForTransfer(bundle) {
  if (!bundle?.schema) return bundle || null;
  return {
    ...bundle,
    source: bundle.source
      ? {
          ...bundle.source,
          records: (bundle.source.records || []).map(compactRehydratedRecord)
        }
      : null
  };
}
