import {
  CLOSURE_LAW_GRAPH_EDGE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_NODE_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_SLOT_ROW_LAYOUT,
  CLOSURE_LAW_GRAPH_STATUS_ROW_LAYOUT,
  CLOSURE_TABLE_WGSL_SAMPLE_ROW_LAYOUT,
  OPTICAL_GPU_RECORD_ROW_LAYOUT,
  OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  ULG_OPTICAL_GPU_TABLE_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_BANK_SCHEMA,
  ULG_SPH_GPU_THERMAL_CLOSURE_GRAPH_SET_SCHEMA,
  hashPayload
} from '../../../ulg-gpu-abi/src/index.js';
import {
  OPTICAL_GPU_WGSL_STRUCTS
} from '../material/opticalGpuBuffers.js';
import {
  validateSphDispersedMediumOpticalClosureTable
} from './sphDispersedMediumOpticalClosure.js';
import {
  collectiveOpticalRouteDescriptor
} from './sphOpticalRouteIdentity.js';

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
export const SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-collective-optical-route-set-authority.v0';

const SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_STATUS =
  'sph-collective-optical-route-set-authority-ready';

const OPTICAL_GPU_TABLE_CANONICAL_STATUSES = new Set([
  'cpu-derived-gpu-buffer-ready',
  'static-table-cache-hit'
]);
const OPTICAL_GPU_RECORD_STRIDE_FLOATS = OPTICAL_GPU_RECORD_ROW_LAYOUT.length;
const OPTICAL_GPU_SPECTRAL_SAMPLE_STRIDE_FLOATS =
  OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT.length;
const OPTICAL_GPU_RECORD_STRIDE_BYTES =
  OPTICAL_GPU_RECORD_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
const OPTICAL_GPU_SPECTRAL_SAMPLE_STRIDE_BYTES =
  OPTICAL_GPU_SPECTRAL_SAMPLE_STRIDE_FLOATS
  * Float32Array.BYTES_PER_ELEMENT;

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

function jsonStableProjection(value) {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? null : JSON.parse(encoded);
}

function typedArrayContent(value) {
  if (!ArrayBuffer.isView(value)) return null;
  return {
    arrayType: value.constructor?.name ?? null,
    length: value.length,
    byteLength: value.byteLength,
    values: Array.from(value)
  };
}

function arrayLayoutExactlyMatches(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((field, index) => field === expected[index]);
}

function opticalGpuTableHasCanonicalAbi(table) {
  if (
    table?.schema !== ULG_OPTICAL_GPU_TABLE_SCHEMA
    || !OPTICAL_GPU_TABLE_CANONICAL_STATUSES.has(table.status)
    || !(table.records instanceof Float32Array)
    || !(table.spectralSamples instanceof Float32Array)
    || !(table.materialPropertyBankPbrWarmInputRows instanceof Float32Array)
    || !Number.isSafeInteger(table.recordCount)
    || table.recordCount < 0
    || !Number.isSafeInteger(table.spectralSampleCount)
    || table.spectralSampleCount < 0
    || table.recordStrideFloats !== OPTICAL_GPU_RECORD_STRIDE_FLOATS
    || table.spectralSampleStrideFloats
      !== OPTICAL_GPU_SPECTRAL_SAMPLE_STRIDE_FLOATS
    || table.recordStrideBytes !== OPTICAL_GPU_RECORD_STRIDE_BYTES
    || table.spectralSampleStrideBytes
      !== OPTICAL_GPU_SPECTRAL_SAMPLE_STRIDE_BYTES
    || table.wgslStructs !== OPTICAL_GPU_WGSL_STRUCTS
    || table.records.length
      !== table.recordCount * OPTICAL_GPU_RECORD_STRIDE_FLOATS
    || table.spectralSamples.length
      !== table.spectralSampleCount
        * OPTICAL_GPU_SPECTRAL_SAMPLE_STRIDE_FLOATS
    || !arrayLayoutExactlyMatches(
      table.recordLayout,
      OPTICAL_GPU_RECORD_ROW_LAYOUT
    )
    || !arrayLayoutExactlyMatches(
      table.spectralSampleLayout,
      OPTICAL_GPU_SPECTRAL_SAMPLE_ROW_LAYOUT
    )
    || !Array.isArray(table.materialMap)
    || !Array.isArray(table.recordMetadata)
    || table.recordMetadata.length !== table.recordCount
    || table.recordMetadata.some(
      (record) => !record || typeof record !== 'object' || Array.isArray(record)
    )
    || table.scientificValidation !== false
    || table.fullPhysicsValidation !== false
  ) return false;
  return true;
}

function collectiveOpticalTableAuthorityPayload(table) {
  if (!opticalGpuTableHasCanonicalAbi(table)) return null;
  return {
    schema: table.schema,
    status: table.status,
    recordCount: table.recordCount,
    spectralSampleCount: table.spectralSampleCount,
    recordStrideFloats: table.recordStrideFloats,
    spectralSampleStrideFloats: table.spectralSampleStrideFloats,
    recordStrideBytes: table.recordStrideBytes,
    spectralSampleStrideBytes: table.spectralSampleStrideBytes,
    recordLayout: jsonStableProjection(table.recordLayout),
    spectralSampleLayout: jsonStableProjection(table.spectralSampleLayout),
    wgslStructs: table.wgslStructs,
    materialMap: jsonStableProjection(table.materialMap),
    recordMetadata: jsonStableProjection(table.recordMetadata),
    materialPropertyBankPbrWarmInputConsumer:
      jsonStableProjection(table.materialPropertyBankPbrWarmInputConsumer ?? null),
    materialPropertyBankPbrWarmInputRowCount:
      table.materialPropertyBankPbrWarmInputRowCount ?? 0,
    materialPropertyBankPbrWarmInputRowStrideFloats:
      table.materialPropertyBankPbrWarmInputRowStrideFloats ?? 0,
    materialPropertyBankPbrWarmInputMatchedRecordCount:
      table.materialPropertyBankPbrWarmInputMatchedRecordCount ?? 0,
    colorSpace: table.colorSpace,
    scientificValidation: table.scientificValidation,
    fullPhysicsValidation: table.fullPhysicsValidation,
    records: typedArrayContent(table.records),
    spectralSamples: typedArrayContent(table.spectralSamples),
    materialPropertyBankPbrWarmInputRows: typedArrayContent(
      table.materialPropertyBankPbrWarmInputRows ?? new Float32Array()
    )
  };
}

function dispersedMediumOpticalClosureAuthorityPayload(table) {
  if (!table?.schema || !(table.rows instanceof Float32Array)) return null;
  const expectedStatus = table.rowCount === 0
    ? 'dispersed-medium-optical-closure-table-empty'
    : 'dispersed-medium-optical-closure-table-ready';
  if (table.status !== expectedStatus) return null;
  return {
    schema: table.schema,
    status: table.status,
    propertySchema: table.propertySchema,
    version: table.version,
    rowCount: table.rowCount,
    routeCount: table.routeCount,
    readyRowCount: table.readyRowCount,
    blockedRowCount: table.blockedRowCount,
    readyOpticalStateIds: jsonStableProjection(table.readyOpticalStateIds),
    rowStrideFloats: table.rowStrideFloats,
    rowStrideBytes: table.rowStrideBytes,
    rowLayout: jsonStableProjection(table.rowLayout),
    bufferByteLength: table.bufferByteLength,
    metadata: jsonStableProjection(table.metadata),
    routeLookup: table.routeLookup,
    massAuthority: table.massAuthority,
    saturationMassInference: table.saturationMassInference,
    scientificValidation: table.scientificValidation,
    rows: typedArrayContent(table.rows)
  };
}

/**
 * Bind the three independently cached collective-optics artifacts to their
 * complete static content. Cache timestamps are excluded deliberately; source
 * statuses, every descriptor, and every optical and closure row are
 * authoritative.
 */
export function createSphCollectiveOpticalRouteSetAuthority({
  routeDescriptors = null,
  opticalGpuTable = null,
  closureTable = null
} = {}) {
  if (!Array.isArray(routeDescriptors)) return null;
  const descriptorPayload = jsonStableProjection(routeDescriptors);
  const opticalTablePayload = collectiveOpticalTableAuthorityPayload(
    opticalGpuTable
  );
  const closureTablePayload = dispersedMediumOpticalClosureAuthorityPayload(
    closureTable
  );
  if (
    !opticalTablePayload
    || !closureTablePayload
    || opticalTablePayload.scientificValidation !== false
    || opticalTablePayload.fullPhysicsValidation !== false
    || closureTablePayload.scientificValidation !== false
  ) return null;
  const content = {
    schema: SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_SCHEMA,
    routeDescriptors: descriptorPayload,
    opticalGpuTable: opticalTablePayload,
    dispersedMediumOpticalClosureTable: closureTablePayload
  };
  return Object.freeze({
    schema: SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_SCHEMA,
    status: SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_STATUS,
    contentHash: hashPayload(content),
    routeDescriptorContentHash: hashPayload(descriptorPayload),
    opticalTableContentHash: hashPayload(opticalTablePayload),
    closureTableContentHash: hashPayload(closureTablePayload),
    routeCount: routeDescriptors.length,
    opticalRecordCount: opticalGpuTable.recordCount,
    closureRowCount: closureTable.rowCount,
    scientificValidation: false
  });
}

function collectiveOpticalRouteSetAuthorityMatches(actual, expected) {
  if (!actual || !expected) return false;
  return [
    'schema',
    'status',
    'contentHash',
    'routeDescriptorContentHash',
    'opticalTableContentHash',
    'closureTableContentHash',
    'routeCount',
    'opticalRecordCount',
    'closureRowCount',
    'scientificValidation'
  ].every((field) => actual[field] === expected[field]);
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
    collectiveOpticalRouteDescriptors:
      scene?.getCollectiveOpticalRouteDescriptors?.() || null,
    collectiveOpticalGpuTable: scene?.getCollectiveOpticalGpuTable?.() || null,
    dispersedMediumOpticalClosureTable:
      scene?.getSphDispersedMediumOpticalClosureTable?.() || null,
    reactionTable: scene?.getSphReactionTable?.() || null
  };
}

function opticalGpuTableCacheRecord({
  family,
  table,
  collectiveOpticalRouteDescriptors = null,
  collectiveOpticalRouteSetAuthority = null,
  generatorFingerprint,
  updatedAt
}) {
  if (!table) return null;
  return tableCacheRecord({
    family,
    table,
    arrays: {
      records: table.records,
      spectralSamples: table.spectralSamples,
      materialPropertyBankPbrWarmInputRows:
        table.materialPropertyBankPbrWarmInputRows ?? new Float32Array()
    },
    metadata: {
      status: table.status,
      recordCount: table.recordCount,
      spectralSampleCount: table.spectralSampleCount,
      recordStrideFloats: table.recordStrideFloats,
      spectralSampleStrideFloats: table.spectralSampleStrideFloats,
      recordStrideBytes: table.recordStrideBytes,
      spectralSampleStrideBytes: table.spectralSampleStrideBytes,
      recordLayout: table.recordLayout,
      spectralSampleLayout: table.spectralSampleLayout,
      wgslStructs: table.wgslStructs,
      materialMap: table.materialMap,
      recordMetadata: table.recordMetadata,
      materialPropertyBankPbrWarmInputConsumer:
        table.materialPropertyBankPbrWarmInputConsumer ?? null,
      materialPropertyBankPbrWarmInputRowCount:
        table.materialPropertyBankPbrWarmInputRowCount ?? 0,
      materialPropertyBankPbrWarmInputRowStrideFloats:
        table.materialPropertyBankPbrWarmInputRowStrideFloats ?? 0,
      materialPropertyBankPbrWarmInputMatchedRecordCount:
        table.materialPropertyBankPbrWarmInputMatchedRecordCount ?? 0,
      colorSpace: table.colorSpace,
      scientificValidation: table.scientificValidation,
      fullPhysicsValidation: table.fullPhysicsValidation,
      ...(Array.isArray(collectiveOpticalRouteDescriptors)
        ? { collectiveOpticalRouteDescriptors }
        : {}),
      ...(collectiveOpticalRouteSetAuthority
        ? { collectiveOpticalRouteSetAuthority }
        : {})
    },
    generatorFingerprint,
    updatedAt
  });
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
    collectiveOpticalRouteDescriptors = null,
    collectiveOpticalGpuTable = null,
    dispersedMediumOpticalClosureTable = null,
    reactionTable = null
  } = tableInputs || {};
  const collectiveOpticalRouteSetAuthority =
    createSphCollectiveOpticalRouteSetAuthority({
      routeDescriptors: collectiveOpticalRouteDescriptors,
      opticalGpuTable: collectiveOpticalGpuTable,
      closureTable: dispersedMediumOpticalClosureTable
    });
  const records = [];
  let thermalMaterialTableRecord = null;
  if (thermalMaterialTable) {
    thermalMaterialTableRecord = tableCacheRecord({
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
    });
    if (thermalMaterialTableRecord) records.push(thermalMaterialTableRecord);
  }
  const sourceThermalMaterialTableRowHash = thermalMaterialTableRecord?.rowHash ?? null;
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
        skippedSegments: thermalClosureGraphSet.skippedSegments,
        sourceThermalMaterialTableRowHash
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
        responses: thermalPhaseResponseTable.responses,
        responseThermalConductivities:
          thermalPhaseResponseTable.responseThermalConductivities
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
        tableMetadata: thermalPhaseResponseTable.metadata,
        sourceThermalMaterialTableRowHash
      },
      generatorFingerprint,
      updatedAt
    }));
  }
  if (opticalGpuTable) {
    records.push(opticalGpuTableCacheRecord({
      family: 'optical-pbr-table',
      table: opticalGpuTable,
      generatorFingerprint,
      updatedAt
    }));
  }
  if (collectiveOpticalGpuTable) {
    records.push(opticalGpuTableCacheRecord({
      family: 'collective-optical-pbr-table',
      table: collectiveOpticalGpuTable,
      collectiveOpticalRouteDescriptors,
      collectiveOpticalRouteSetAuthority,
      generatorFingerprint,
      updatedAt
    }));
  }
  if (dispersedMediumOpticalClosureTable) {
    records.push(tableCacheRecord({
      family: 'sph-dispersed-medium-optical-closure-table',
      table: dispersedMediumOpticalClosureTable,
      arrays: {
        rows: dispersedMediumOpticalClosureTable.rows
      },
      metadata: {
        propertySchema: dispersedMediumOpticalClosureTable.propertySchema,
        version: dispersedMediumOpticalClosureTable.version,
        status: dispersedMediumOpticalClosureTable.status,
        rowCount: dispersedMediumOpticalClosureTable.rowCount,
        routeCount: dispersedMediumOpticalClosureTable.routeCount,
        readyRowCount: dispersedMediumOpticalClosureTable.readyRowCount,
        blockedRowCount: dispersedMediumOpticalClosureTable.blockedRowCount,
        readyOpticalStateIds:
          dispersedMediumOpticalClosureTable.readyOpticalStateIds,
        rowStrideFloats: dispersedMediumOpticalClosureTable.rowStrideFloats,
        rowStrideBytes: dispersedMediumOpticalClosureTable.rowStrideBytes,
        rowLayout: dispersedMediumOpticalClosureTable.rowLayout,
        bufferByteLength: dispersedMediumOpticalClosureTable.bufferByteLength,
        tableMetadata: dispersedMediumOpticalClosureTable.metadata,
        routeLookup: dispersedMediumOpticalClosureTable.routeLookup,
        massAuthority: dispersedMediumOpticalClosureTable.massAuthority,
        saturationMassInference:
          dispersedMediumOpticalClosureTable.saturationMassInference,
        scientificValidation: false,
        ...(collectiveOpticalRouteSetAuthority
          ? { collectiveOpticalRouteSetAuthority }
          : {})
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
      'sph-dispersed-medium-optics-producer',
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
    sourceThermalMaterialTableRowHash:
      metadata.sourceThermalMaterialTableRowHash ?? null,
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function restoreThermalPhaseResponseTable(record) {
  if (
    !record?.arrays?.records
    || !record?.arrays?.responses
    || !record?.arrays?.responseThermalConductivities
  ) return null;
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
    responseThermalConductivities:
      record.arrays.responseThermalConductivities,
    metadata: metadata.tableMetadata || [],
    sourceThermalMaterialTableRowHash:
      metadata.sourceThermalMaterialTableRowHash ?? null,
    cache: cacheMetadata(record),
    scientificValidation: false,
    materialValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}

function restoreOpticalGpuTable(record, {
  requireCanonicalAbi = false
} = {}) {
  if (
    !(record?.arrays?.records instanceof Float32Array)
    || !(record?.arrays?.spectralSamples instanceof Float32Array)
  ) return null;
  const metadata = record.metadata || {};
  // recordMetadata is consumed as an array before any renderer-side rebuild.
  // Reject malformed persistent data here instead of allowing a cache hit to
  // throw while the application is starting.
  if (!Array.isArray(metadata.recordMetadata)) return null;
  const recordStrideFloats = metadata.recordStrideFloats || 0;
  const spectralSampleStrideFloats = metadata.spectralSampleStrideFloats || 0;
  const restored = {
    schema: record.sourceSchema,
    status: metadata.status || 'static-table-cache-hit',
    records: record.arrays.records,
    spectralSamples: record.arrays.spectralSamples,
    recordCount: metadata.recordCount ?? 0,
    spectralSampleCount: metadata.spectralSampleCount ?? 0,
    recordStrideFloats,
    spectralSampleStrideFloats,
    recordStrideBytes: metadata.recordStrideBytes
      ?? (recordStrideFloats * Float32Array.BYTES_PER_ELEMENT),
    spectralSampleStrideBytes: metadata.spectralSampleStrideBytes
      ?? (spectralSampleStrideFloats * Float32Array.BYTES_PER_ELEMENT),
    recordLayout: metadata.recordLayout || [],
    spectralSampleLayout: metadata.spectralSampleLayout || [],
    wgslStructs: metadata.wgslStructs
      ?? (record.sourceSchema === ULG_OPTICAL_GPU_TABLE_SCHEMA
        ? OPTICAL_GPU_WGSL_STRUCTS
        : null),
    materialMap: metadata.materialMap || [],
    recordMetadata: metadata.recordMetadata,
    materialPropertyBankPbrWarmInputConsumer:
      metadata.materialPropertyBankPbrWarmInputConsumer ?? null,
    materialPropertyBankPbrWarmInputRowCount:
      metadata.materialPropertyBankPbrWarmInputRowCount ?? 0,
    materialPropertyBankPbrWarmInputRows:
      record.arrays.materialPropertyBankPbrWarmInputRows ?? new Float32Array(),
    materialPropertyBankPbrWarmInputRowStrideFloats:
      metadata.materialPropertyBankPbrWarmInputRowStrideFloats ?? 0,
    materialPropertyBankPbrWarmInputMatchedRecordCount:
      metadata.materialPropertyBankPbrWarmInputMatchedRecordCount ?? 0,
    colorSpace: metadata.colorSpace || 'linear-rgb-from-srgb-closure-output',
    cache: cacheMetadata(record),
    scientificValidation: metadata.scientificValidation ?? false,
    fullPhysicsValidation: metadata.fullPhysicsValidation ?? false
  };
  if (requireCanonicalAbi && !opticalGpuTableHasCanonicalAbi(restored)) {
    return null;
  }
  return restored;
}

function restoreCollectiveOpticalRouteDescriptors(record) {
  const source = record?.metadata?.collectiveOpticalRouteDescriptors;
  if (!Array.isArray(source)) return null;
  try {
    const restored = source.map((cached) => {
      const canonical = collectiveOpticalRouteDescriptor(cached);
      for (const field of [
        'schema',
        'routeKey',
        'routeId',
        'opticalStateId',
        'materialId',
        'condensedPhase',
        'condensedPhaseId',
        'vaporPhase',
        'vaporPhaseId',
        'closureModel',
        'closureModelId',
        'phase',
        'phaseId',
        'dispersedPhase',
        'dispersedPhaseId',
        'surfaceIdentityKey'
      ]) {
        if (cached?.[field] !== canonical[field]) {
          throw new RangeError(
            `cached collective optical route ${field} is inconsistent`
          );
        }
      }
      if (
        cached?.opticalState?.collectiveOpticalRouteKey
          !== canonical.opticalState.collectiveOpticalRouteKey
      ) {
        throw new RangeError('cached collective optical state key is inconsistent');
      }
      return canonical;
    });
    const routeIds = new Set(restored.map((route) => route.routeId));
    if (routeIds.size !== restored.length) {
      throw new RangeError('cached collective optical route ids are not unique');
    }
    return Object.freeze(restored);
  } catch {
    return null;
  }
}

function restoreDispersedMediumOpticalClosureTable(record) {
  if (
    record?.sourceSchema
      !== ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
    || !(record?.arrays?.rows instanceof Float32Array)
  ) return null;
  const metadata = record.metadata || {};
  if (
    metadata.propertySchema
      !== ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
    || metadata.version !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION
    || metadata.rowStrideFloats
      !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS
    || metadata.rowStrideBytes
      !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES
    || !Array.isArray(metadata.rowLayout)
    || metadata.rowLayout.length
      !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT.length
    || metadata.rowLayout.some(
      (field, index) => field
        !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT[index]
    )
    || metadata.scientificValidation !== false
  ) return null;
  try {
    const table = Object.freeze({
      schema: record.sourceSchema,
      propertySchema: metadata.propertySchema,
      version: metadata.version,
      status: metadata.status || 'static-table-cache-hit',
      rowCount: metadata.rowCount,
      routeCount: metadata.routeCount,
      readyRowCount: metadata.readyRowCount,
      blockedRowCount: metadata.blockedRowCount,
      readyOpticalStateIds: Object.freeze([
        ...(metadata.readyOpticalStateIds || [])
      ]),
      rowStrideFloats: metadata.rowStrideFloats,
      rowStrideBytes: metadata.rowStrideBytes,
      rowLayout: Object.freeze([...(metadata.rowLayout || [])]),
      bufferByteLength: metadata.bufferByteLength,
      rows: record.arrays.rows,
      metadata: Object.freeze((metadata.tableMetadata || []).map((entry) => (
        Object.freeze({ ...entry })
      ))),
      routeLookup: metadata.routeLookup,
      massAuthority: metadata.massAuthority,
      saturationMassInference: metadata.saturationMassInference,
      cache: cacheMetadata(record),
      scientificValidation: false
    });
    validateSphDispersedMediumOpticalClosureTable(table);
    return table;
  } catch {
    return null;
  }
}

function collectiveOpticalTablesHaveRouteParity({
  routeDescriptors,
  opticalGpuTable,
  closureTable
}) {
  if (
    !Array.isArray(routeDescriptors)
    || !opticalGpuTable?.schema
    || !closureTable?.schema
    || !Array.isArray(opticalGpuTable.recordMetadata)
    || !Array.isArray(closureTable.metadata)
    || opticalGpuTable.recordCount !== routeDescriptors.length
    || closureTable.rowCount !== routeDescriptors.length
    || opticalGpuTable.recordMetadata.some(
      (record) => !record || typeof record !== 'object' || Array.isArray(record)
    )
    || closureTable.metadata.some(
      (record) => !record || typeof record !== 'object' || Array.isArray(record)
    )
  ) return false;
  const opticalByStateId = new Map(
    (opticalGpuTable.recordMetadata || []).map((record) => [
      record.opticalStateId,
      record
    ])
  );
  const closureByStateId = new Map(
    (closureTable.metadata || []).map((record) => [
      record.opticalStateId,
      record
    ])
  );
  if (
    opticalByStateId.size !== routeDescriptors.length
    || closureByStateId.size !== routeDescriptors.length
  ) return false;
  return routeDescriptors.every((route) => {
    const optical = opticalByStateId.get(route.opticalStateId);
    const closure = closureByStateId.get(route.opticalStateId);
    return Boolean(
      optical
      && closure
      && optical.materialId === route.materialId
      && optical.phaseId === route.condensedPhaseId
      && closure.routeKey === route.routeKey
      && closure.dispersedMaterialId === route.materialId
      && closure.vaporPhaseId === route.vaporPhaseId
      && closure.condensedPhaseId === route.condensedPhaseId
      && closure.morphologyModelId === route.closureModelId
    );
  });
}

function restoreReactionTable(record) {
  if (!record?.arrays?.records || !record?.arrays?.productPhaseRecords) return null;
  // v1 makes a positive, coherent product phase policy mandatory for ready
  // terms.  Restoring a v0 table would bypass the fresh builder and revive
  // ambiguous phase-zero reactions from persistent storage.
  if (record.sourceSchema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA) return null;
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
  const thermalMaterialTableRecord = byFamily.get('sph-thermal-material-table') || null;
  // Derived thermal families are only reusable when they were built from the
  // exact thermal-material-table rows being restored alongside them. Serving a
  // graph bank or phase-response table from a different table generation moves
  // phase/plateau boundaries (observed: cached graphs boiling water at 329K
  // while the co-cached table derives 377K) - stale-by-source records rebuild.
  const staleDerivedFamilies = [];
  const derivedThermalRecord = (family) => {
    const record = byFamily.get(family);
    if (!record) return null;
    const sourceRowHash = record.metadata?.sourceThermalMaterialTableRowHash ?? null;
    if (!sourceRowHash || !thermalMaterialTableRecord || sourceRowHash !== thermalMaterialTableRecord.rowHash) {
      staleDerivedFamilies.push({
        family,
        reason: sourceRowHash
          ? 'source-thermal-material-table-row-hash-mismatch'
          : 'missing-source-thermal-material-table-row-hash'
      });
      return null;
    }
    return record;
  };
  const thermalMaterialTable = restoreThermalMaterialTable(thermalMaterialTableRecord);
  const thermalClosureGraphSet = restoreThermalClosureGraphSet(derivedThermalRecord('sph-thermal-closure-graph-bank'));
  const thermalPhaseResponseTableRecord =
    derivedThermalRecord('sph-thermal-phase-response-table');
  const thermalPhaseResponseTable =
    restoreThermalPhaseResponseTable(thermalPhaseResponseTableRecord);
  if (thermalPhaseResponseTableRecord && !thermalPhaseResponseTable) {
    staleDerivedFamilies.push({
      family: 'sph-thermal-phase-response-table',
      reason: 'missing-response-thermal-conductivity-sidecar'
    });
  }
  const opticalGpuTable = restoreOpticalGpuTable(byFamily.get('optical-pbr-table'));
  const collectiveOpticalGpuTableRecord =
    byFamily.get('collective-optical-pbr-table') || null;
  let collectiveOpticalGpuTable = restoreOpticalGpuTable(
    collectiveOpticalGpuTableRecord,
    { requireCanonicalAbi: true }
  );
  let collectiveOpticalRouteDescriptors =
    restoreCollectiveOpticalRouteDescriptors(collectiveOpticalGpuTableRecord);
  const dispersedMediumOpticalClosureTableRecord =
    byFamily.get('sph-dispersed-medium-optical-closure-table') || null;
  let dispersedMediumOpticalClosureTable =
    restoreDispersedMediumOpticalClosureTable(
      dispersedMediumOpticalClosureTableRecord
    );
  let collectiveOpticalRouteSetAuthority = null;
  if (
    collectiveOpticalGpuTableRecord
    || dispersedMediumOpticalClosureTableRecord
  ) {
    const recomputedAuthority =
      createSphCollectiveOpticalRouteSetAuthority({
        routeDescriptors: collectiveOpticalRouteDescriptors,
        opticalGpuTable: collectiveOpticalGpuTable,
        closureTable: dispersedMediumOpticalClosureTable
      });
    const opticalRecordAuthority = collectiveOpticalGpuTableRecord
      ?.metadata?.collectiveOpticalRouteSetAuthority ?? null;
    const closureRecordAuthority = dispersedMediumOpticalClosureTableRecord
      ?.metadata?.collectiveOpticalRouteSetAuthority ?? null;
    if (!collectiveOpticalTablesHaveRouteParity({
      routeDescriptors: collectiveOpticalRouteDescriptors,
      opticalGpuTable: collectiveOpticalGpuTable,
      closureTable: dispersedMediumOpticalClosureTable
    })
      || !collectiveOpticalRouteSetAuthorityMatches(
        opticalRecordAuthority,
        recomputedAuthority
      )
      || !collectiveOpticalRouteSetAuthorityMatches(
        closureRecordAuthority,
        recomputedAuthority
      )) {
      staleDerivedFamilies.push({
        family: 'sph-dispersed-medium-optical-static-route-set',
        reason: 'collective-optical-route-table-parity-mismatch'
      });
      collectiveOpticalGpuTable = null;
      collectiveOpticalRouteDescriptors = null;
      dispersedMediumOpticalClosureTable = null;
    } else {
      collectiveOpticalRouteSetAuthority = recomputedAuthority;
    }
  }
  const reactionTableRecord = byFamily.get('sph-reaction-table');
  const reactionTable = restoreReactionTable(reactionTableRecord);
  if (reactionTableRecord && !reactionTable) {
    staleDerivedFamilies.push({
      family: 'sph-reaction-table',
      reason: 'reaction-table-schema-mismatch',
      sourceSchema: reactionTableRecord.sourceSchema || null,
      requiredSchema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA
    });
  }
  const restored = {
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalPhaseResponseTable,
    opticalGpuTable,
    collectiveOpticalGpuTable,
    dispersedMediumOpticalClosureTable,
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
    staleDerivedFamilies,
    staleCount: rehydrated.staleCount + staleDerivedFamilies.length,
    tableCount: rehydrated.tableCount,
    gpuWarmupCount: rehydrated.gpuWarmupCount,
    source: rehydrated,
    collectiveOpticalRouteDescriptors,
    collectiveOpticalRouteSetAuthority,
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
