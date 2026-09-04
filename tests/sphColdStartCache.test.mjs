import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_SCHEMA,
  SPH_STATIC_TABLE_CACHE_REHYDRATE_SCHEMA,
  SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA,
  collectiveOpticalRouteSetAuthoritiesExactlyEqual,
  compactSphStaticTableBundleForTransfer,
  createSphCollectiveOpticalRouteSetAuthority,
  createSphStaticTableCacheUpdate,
  parseSphStaticTableCacheSnapshot,
  rehydrateSphStaticTableBundle,
  rehydrateSphStaticTableCache,
  sphStaticTableInputsFromScene
} from '../src/runtime/sph/sphColdStartCache.js';
import {
  buildSphDispersedMediumOpticalClosureTable
} from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import {
  collectiveOpticalRouteDescriptor
} from '../src/runtime/sph/sphOpticalRouteIdentity.js';
import {
  buildOpticalGpuTableForSurfaceDescriptors
} from '../src/runtime/sph/sphStaticTableInputs.js';

const generatorFingerprint = 'ulg-test-generator-fingerprint';

test('scene static-table collection retains the dispersed closure through canonical and compatibility getters', () => {
  const expected = Object.freeze({ schema: 'test-dispersed-closure-table' });
  assert.equal(
    sphStaticTableInputsFromScene({
      getSphDispersedMediumOpticalClosureTable: () => expected
    }).dispersedMediumOpticalClosureTable,
    expected
  );
  assert.equal(
    sphStaticTableInputsFromScene({
      getDispersedMediumOpticalClosureTable: () => expected
    }).dispersedMediumOpticalClosureTable,
    expected
  );
});

function fakeTableInputs({
  closureScatteringEfficiencyQsca = 2
} = {}) {
  const dispersedMediumOpticalClosure = {
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactCondensateCarrierLowerBound,
    condensedDensityKgPerM3: 1_000,
    scatteringEfficiencyQsca: closureScatteringEfficiencyQsca,
    absorptionEfficiencyQabs: 0,
    asymmetryFactorG: 0,
    provenance: {
      status: 'reduced-estimate',
      source: 'focused-cache-test'
    },
    scientificValidation: false
  };
  const collectiveOpticalRouteDescriptors = Object.freeze([
    collectiveOpticalRouteDescriptor({
      material: 'h2o',
      condensedPhase: 'liquid',
      vaporPhase: 'gas',
      renderKey: 'steam',
      properties: { dispersedMediumOpticalClosure }
    })
  ]);
  const collectiveOpticalGpuTable =
    buildOpticalGpuTableForSurfaceDescriptors(
      collectiveOpticalRouteDescriptors,
      { materialProperties: { h2o: { dispersedMediumOpticalClosure } } }
    );
  const dispersedMediumOpticalClosureTable =
    buildSphDispersedMediumOpticalClosureTable(
      collectiveOpticalRouteDescriptors
    );
  return {
    thermalMaterialTable: {
      schema: 'peercompute.ulg.sph-thermal-material-table.v0',
      records: new Float32Array([1, 2, 3, 4]),
      segments: new Float32Array([5, 6, 7, 8]),
      materialCount: 1,
      segmentCount: 1,
      recordStrideFloats: 4,
      segmentStrideFloats: 4,
      recordLayout: { id: 0 },
      segmentLayout: { start: 0 },
      metadata: [{ material: 'h2o', phaseCount: 3 }],
      materialPropertyBankWarmInputConsumer: {
        schema: 'peercompute.ulg.sph-thermal-material-bank-warm-input-consumer.v0',
        status: 'thermal-material-table-annotated-with-material-bank-warm-inputs',
        sourceSchema: 'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0',
        sourceRowCount: 1,
        matchedMaterialCount: 1,
        consumer: 'sph-thermal-material-table',
        consumedAs: 'non-authoritative-warm-input-metadata-before-closure-derived-thermal-graphs',
        strictSourceOfTruth: false,
        shaderBound: false
      },
      materialPropertyBankWarmInputRowCount: 1,
      materialPropertyBankWarmInputMatchedMaterialCount: 1
    },
    thermalClosureGraphSet: {
      schema: 'peercompute.ulg.sph-thermal-closure-graph-buffer-set.v0',
      metadata: { materialCount: 1 },
      skippedSegments: [],
      graphBank: {
        schema: 'peercompute.ulg.closure-law-graph-bank.v0',
        nodeRows: new Float32Array([
          1, 0, 1, 2,
          0, 2, 0, 10,
          0, 0, 1, 0,
          0, 120001, 2, 0
        ]),
        edgeRows: new Float32Array([]),
        sampleRows: new Float32Array([
          0, 273, 1, 0,
          10, 373, 1, 0
        ]),
        slotRows: new Float32Array([
          0, 0, 1, 0,
          0, 0, 1, 0,
          0, 0, 1, 0
        ]),
        statusRows: new Float32Array([0, 1, 0, 0]),
        graphCount: 1,
        nodeCount: 1,
        edgeCount: 0,
        sampleCount: 2,
        slotCount: 3,
        statusCount: 1,
        graphRecords: [{
          graphIndex: 0,
          graphId: 'test-thermal-graph',
          nodeOffset: 0,
          nodeCount: 1,
          edgeOffset: 0,
          edgeCount: 0,
          sampleOffset: 0,
          sampleCount: 2,
          slotOffset: 0,
          slotCount: 3,
          statusOffset: 0,
          statusCount: 1,
          sourceSegmentIndex: 0,
          materialId: 120001,
          phaseFromId: 2,
          phaseToId: 2
        }]
      }
    },
    thermalPhaseResponseTable: {
      schema: 'peercompute.ulg.sph-thermal-phase-response-table.v0',
      records: new Float32Array([9, 10, 11, 12]),
      responses: new Float32Array([13, 14, 15, 16]),
      responseThermalConductivities: new Float32Array([2.16]),
      materialCount: 1,
      responseCount: 1,
      recordStrideFloats: 4,
      responseStrideFloats: 4,
      recordLayout: { id: 0 },
      responseLayout: { phase: 0 },
      metadata: [{ material: 'h2o' }]
    },
    opticalGpuTable: {
      schema: 'peercompute.ulg.optical-gpu-table.v0',
      records: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      spectralSamples: new Float32Array([450, 0.8, 550, 0.9]),
      materialPropertyBankPbrWarmInputRows: new Float32Array([
        120001, 8, 293.15, 101325, 64, 1, 0.1, 0.2,
        0.3, 0, 0.5, 1.33, 0, 1, 0, 0
      ]),
      recordCount: 1,
      spectralSampleCount: 2,
      recordStrideFloats: 4,
      spectralSampleStrideFloats: 2,
      recordLayout: { materialId: 0 },
      spectralSampleLayout: { wavelengthNm: 0 },
      materialMap: { h2o: 120001 },
      recordMetadata: [{
        material: 'h2o',
        phase: 'liquid',
        materialPropertyBankPbrWarmInputStatus: 'material-bank-pbr-warm-input-attached'
      }],
      materialPropertyBankPbrWarmInputConsumer: {
        schema: 'peercompute.ulg.optical-material-bank-pbr-warm-input-consumer.v0',
        status: 'optical-gpu-table-annotated-with-material-bank-pbr-warm-inputs',
        sourceSchema: 'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0',
        sourceRowCount: 1,
        matchedRecordCount: 1,
        consumer: 'optical-gpu-table',
        consumedAs: 'non-authoritative-pbr-warm-input-metadata-only-alongside-closure-derived-optical-rows',
        strictSourceOfTruth: false,
        shaderBound: false
      },
      materialPropertyBankPbrWarmInputRowCount: 1,
      materialPropertyBankPbrWarmInputRowStrideFloats: 16,
      materialPropertyBankPbrWarmInputMatchedRecordCount: 1,
      colorSpace: 'srgb'
    },
    collectiveOpticalRouteDescriptors,
    collectiveOpticalGpuTable,
    dispersedMediumOpticalClosureTable,
    reactionTable: {
      schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
      records: new Float32Array([1, 2, 3, 4]),
      reactionHeaders: new Float32Array([0, 0, 2, 0, 2, 0, 1, -1000, 0, 0.1, 1, 3, 0, 2, 1, 0]),
      reactantTermRecords: new Float32Array([
        0, 1, 2, 0.01, 0, 1, 0, 2, 1, 1, 1, 0,
        0, 2, 2, 0.02, 2, 2, 0, 2, 2, 2, 1, 0
      ]),
      productTermRecords: new Float32Array([
        0, 3, 2, 0.03, 0.9, 0, 0, 1, 3, 3, 0, 0, 1, 0, 0, 0,
        0, 4, 1, 0.004, 0.1, 1, 3, 1, 4, 4, 0, 1, 1, 4, 0, 0
      ]),
      gasProductRecords: new Float32Array([0, 1, 4, 1, 0.004, 1, 1, 0]),
      productPhaseRecords: new Float32Array([5, 6, 7, 8]),
      reactionCount: 1,
      reactionHeaderCount: 1,
      reactantTermCount: 2,
      productTermCount: 2,
      gasProductCount: 1,
      productPhaseCount: 1,
      recordStrideFloats: 4,
      reactionHeaderStrideFloats: 16,
      reactantTermStrideFloats: 12,
      productTermStrideFloats: 16,
      gasProductStrideFloats: 8,
      productPhaseStrideFloats: 4,
      recordLayout: { reactantA: 0 },
      reactionHeaderLayout: { reactionIndex: 0 },
      reactantTermLayout: { materialId: 1 },
      productTermLayout: { routingId: 5 },
      gasProductLayout: { materialId: 2 },
      productPhaseLayout: { product: 0 },
      metadata: [{ equation: '2 H2 + O2 -> 2 H2O' }],
      reactantTermMetadata: [{ material: 'h2' }, { material: 'o2' }],
      productTermMetadata: [{ material: 'h2o' }, { material: 'h2' }],
      gasProductMetadata: [{ material: 'h2' }],
      productPhaseMetadata: [{ material: 'h2o', phase: 'liquid' }]
    }
  };
}

test('SPH static table cache update serializes and rehydrates typed arrays off the UI path', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });

  assert.equal(update.schema, SPH_STATIC_TABLE_CACHE_UPDATE_SCHEMA);
  assert.equal(update.status, 'stored');
  assert.equal(update.counts.tables, 7);
  assert.equal(update.counts.gpuWarmup, 1);
  assert.equal(update.tableWriteCount, 7);
  assert.equal(update.gpuWarmupWriteCount, 1);
  assert.ok(update.cacheSnapshot.length > 1000);

  const rehydrated = rehydrateSphStaticTableCache(update.cacheSnapshot, { generatorFingerprint });
  assert.equal(rehydrated.schema, SPH_STATIC_TABLE_CACHE_REHYDRATE_SCHEMA);
  assert.equal(rehydrated.status, 'static-table-cache-hit');
  assert.equal(rehydrated.hitCount, 7);
  assert.deepEqual(new Set(rehydrated.families), new Set([
    'sph-thermal-material-table',
    'sph-thermal-closure-graph-bank',
    'sph-thermal-phase-response-table',
    'optical-pbr-table',
    'collective-optical-pbr-table',
    'sph-dispersed-medium-optical-closure-table',
    'sph-reaction-table'
  ]));
  const thermal = rehydrated.records.find((record) => record.family === 'sph-thermal-material-table');
  assert.ok(thermal.arrays.records instanceof Float32Array);
  assert.deepEqual([...thermal.arrays.records], [1, 2, 3, 4]);
});

test('SPH static table cache update detects unchanged warm records', () => {
  const cold = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const warm = createSphStaticTableCacheUpdate({
    previousSnapshot: cold.cacheSnapshot,
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });

  assert.equal(warm.tableWriteCount, 0);
  assert.equal(warm.gpuWarmupWriteCount, 0);
  assert.ok(warm.tableUnchangedCount >= 7);
  assert.equal(warm.counts.tables, 7);
  assert.equal(warm.counts.gpuWarmup, 1);
});

test('SPH static table cache rejects stale generator snapshots', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const parsed = parseSphStaticTableCacheSnapshot(update.cacheSnapshot, {
    generatorFingerprint: 'different-generator'
  });

  assert.equal(parsed.status, 'generator-fingerprint-mismatch');
  assert.equal(parsed.staleEntryCount, 8);
});

test('SPH static table cache bundle restores scene-consumable table objects', () => {
  const tableInputs = fakeTableInputs();
  const update = createSphStaticTableCacheUpdate({
    tableInputs,
    generatorFingerprint
  });
  const bundle = rehydrateSphStaticTableBundle(update.cacheSnapshot, { generatorFingerprint });

  assert.equal(bundle.schema, 'peercompute.ulg.sph-static-table-cache-bundle.v0');
  assert.equal(bundle.status, 'static-table-cache-bundle-hit');
  assert.equal(bundle.hitCount, 7);
  assert.equal(bundle.thermalMaterialTable.status, 'static-table-cache-hit');
  assert.equal(
    bundle.thermalMaterialTable.materialPropertyBankWarmInputConsumer.status,
    'thermal-material-table-annotated-with-material-bank-warm-inputs'
  );
  assert.equal(bundle.thermalMaterialTable.materialPropertyBankWarmInputRowCount, 1);
  assert.equal(bundle.thermalMaterialTable.materialPropertyBankWarmInputMatchedMaterialCount, 1);
  assert.equal(bundle.thermalClosureGraphSet.status, 'static-table-cache-hit');
  assert.equal(bundle.thermalClosureGraphSet.graphs.length, 1);
  assert.equal(bundle.thermalClosureGraphSet.graphs[0].schema, 'peercompute.ulg.closure-law-graph.v0');
  assert.equal(bundle.thermalClosureGraphSet.graphs[0].nodeRows.length, 16);
  assert.equal(bundle.thermalPhaseResponseTable.records.length, 4);
  assert.equal(
    bundle.thermalClosureGraphSet.sourceThermalMaterialTableRowHash,
    bundle.thermalMaterialTable.cache.rowHash
  );
  assert.equal(
    bundle.thermalPhaseResponseTable.sourceThermalMaterialTableRowHash,
    bundle.thermalMaterialTable.cache.rowHash
  );
  assert.deepEqual(
    [...bundle.thermalPhaseResponseTable.responseThermalConductivities],
    [Math.fround(2.16)]
  );
  assert.equal(bundle.opticalGpuTable.recordCount, 1);
  assert.equal(
    bundle.opticalGpuTable.materialPropertyBankPbrWarmInputConsumer.status,
    'optical-gpu-table-annotated-with-material-bank-pbr-warm-inputs'
  );
  assert.equal(bundle.opticalGpuTable.materialPropertyBankPbrWarmInputRowCount, 1);
  assert.equal(bundle.opticalGpuTable.materialPropertyBankPbrWarmInputRows.length, 16);
  assert.equal(bundle.opticalGpuTable.materialPropertyBankPbrWarmInputRowStrideFloats, 16);
  assert.equal(bundle.opticalGpuTable.materialPropertyBankPbrWarmInputMatchedRecordCount, 1);
  assert.equal(bundle.collectiveOpticalRouteDescriptors.length, 1);
  assert.equal(bundle.collectiveOpticalGpuTable.recordCount, 1);
  assert.equal(
    bundle.collectiveOpticalGpuTable.status,
    tableInputs.collectiveOpticalGpuTable.status
  );
  assert.equal(
    bundle.collectiveOpticalGpuTable.recordStrideBytes,
    tableInputs.collectiveOpticalGpuTable.recordStrideBytes
  );
  assert.equal(
    bundle.collectiveOpticalGpuTable.spectralSampleStrideBytes,
    tableInputs.collectiveOpticalGpuTable.spectralSampleStrideBytes
  );
  assert.equal(
    bundle.collectiveOpticalGpuTable.wgslStructs,
    tableInputs.collectiveOpticalGpuTable.wgslStructs
  );
  assert.equal(
    bundle.collectiveOpticalRouteSetAuthority.schema,
    SPH_COLLECTIVE_OPTICAL_ROUTE_SET_AUTHORITY_SCHEMA
  );
  assert.match(bundle.collectiveOpticalRouteSetAuthority.contentHash, /^ulg:/);
  assert.equal(bundle.collectiveOpticalRouteSetAuthority.routeCount, 1);
  assert.equal(bundle.collectiveOpticalRouteSetAuthority.opticalRecordCount, 1);
  assert.equal(bundle.collectiveOpticalRouteSetAuthority.closureRowCount, 1);
  const liveCollectiveOpticalRouteSetAuthority =
    createSphCollectiveOpticalRouteSetAuthority({
      routeDescriptors: tableInputs.collectiveOpticalRouteDescriptors,
      opticalGpuTable: tableInputs.collectiveOpticalGpuTable,
      closureTable: tableInputs.dispersedMediumOpticalClosureTable
    });
  assert.equal(
    collectiveOpticalRouteSetAuthoritiesExactlyEqual(
      bundle.collectiveOpticalRouteSetAuthority,
      liveCollectiveOpticalRouteSetAuthority
    ),
    true
  );
  const clonedBundle = structuredClone(
    compactSphStaticTableBundleForTransfer(bundle)
  );
  assert.equal(
    collectiveOpticalRouteSetAuthoritiesExactlyEqual(
      clonedBundle.collectiveOpticalRouteSetAuthority,
      liveCollectiveOpticalRouteSetAuthority
    ),
    true
  );
  assert.ok(clonedBundle.collectiveOpticalGpuTable.records instanceof Float32Array);
  assert.ok(
    clonedBundle.dispersedMediumOpticalClosureTable.rows instanceof Float32Array
  );
  assert.equal(
    bundle.dispersedMediumOpticalClosureTable.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
  );
  assert.equal(bundle.dispersedMediumOpticalClosureTable.rowCount, 1);
  assert.equal(bundle.dispersedMediumOpticalClosureTable.readyRowCount, 1);
  assert.equal(bundle.dispersedMediumOpticalClosureTable.blockedRowCount, 0);
  assert.equal(
    bundle.dispersedMediumOpticalClosureTable.metadata[0].status,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready
  );
  const restoredRoute = bundle.collectiveOpticalRouteDescriptors[0];
  const restoredOptical = bundle.collectiveOpticalGpuTable.recordMetadata[0];
  const restoredClosure = bundle.dispersedMediumOpticalClosureTable.metadata[0];
  assert.equal(restoredRoute.routeId, restoredRoute.opticalStateId);
  assert.equal(restoredOptical.opticalStateId, restoredRoute.opticalStateId);
  assert.equal(restoredClosure.opticalStateId, restoredRoute.opticalStateId);
  assert.equal(restoredClosure.routeKey, restoredRoute.routeKey);
  assert.equal(
    restoredClosure.provenance.source,
    'focused-cache-test'
  );
  assert.equal(bundle.reactionTable.reactionClosureSchema, null);
  assert.equal(bundle.reactionTable.reactionHeaderCount, 1);
  assert.equal(bundle.reactionTable.reactantTermRecords.length, 24);
  assert.equal(bundle.reactionTable.productTermRecords.length, 32);
  assert.equal(bundle.reactionTable.gasProductRecords.length, 8);
  assert.equal(bundle.reactionTable.productTermMetadata[1].material, 'h2');
  assert.equal(bundle.reactionTable.combinedRecords.length, 88);
  assert.deepEqual(new Set(bundle.restoredFamilies), new Set([
    'thermalMaterialTable',
    'thermalClosureGraphSet',
    'thermalPhaseResponseTable',
    'opticalGpuTable',
    'collectiveOpticalGpuTable',
    'dispersedMediumOpticalClosureTable',
    'reactionTable'
  ]));
});

test('SPH static table cache fails closed on incomplete dispersed optical closure metadata', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const incompleteSnapshot = JSON.parse(update.cacheSnapshot);
  const closureRecord = Object.values(incompleteSnapshot.tables).find(
    (record) => record.family === 'sph-dispersed-medium-optical-closure-table'
  );
  delete closureRecord.metadata.propertySchema;

  const bundle = rehydrateSphStaticTableBundle(
    JSON.stringify(incompleteSnapshot),
    { generatorFingerprint }
  );

  assert.equal(bundle.collectiveOpticalRouteDescriptors, null);
  assert.equal(bundle.collectiveOpticalRouteSetAuthority, null);
  assert.equal(bundle.collectiveOpticalGpuTable, null);
  assert.equal(bundle.dispersedMediumOpticalClosureTable, null);
  assert.equal(bundle.opticalGpuTable.recordCount, 1);
  assert.equal(bundle.hitCount, 5);
  assert.deepEqual(bundle.staleDerivedFamilies, [{
    family: 'sph-dispersed-medium-optical-static-route-set',
    reason: 'collective-optical-route-table-parity-mismatch'
  }]);
});

test('SPH static table cache fails closed without throwing on malformed collective optical metadata', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const malformedSnapshot = JSON.parse(update.cacheSnapshot);
  const collectiveRecord = Object.values(malformedSnapshot.tables).find(
    (record) => record.family === 'collective-optical-pbr-table'
  );
  collectiveRecord.metadata.recordMetadata = {};

  let bundle = null;
  assert.doesNotThrow(() => {
    bundle = rehydrateSphStaticTableBundle(
      JSON.stringify(malformedSnapshot),
      { generatorFingerprint }
    );
  });
  assert.equal(bundle.collectiveOpticalRouteDescriptors, null);
  assert.equal(bundle.collectiveOpticalRouteSetAuthority, null);
  assert.equal(bundle.collectiveOpticalGpuTable, null);
  assert.equal(bundle.dispersedMediumOpticalClosureTable, null);
  assert.equal(bundle.hitCount, 5);
  assert.deepEqual(bundle.staleDerivedFamilies, [{
    family: 'sph-dispersed-medium-optical-static-route-set',
    reason: 'collective-optical-route-table-parity-mismatch'
  }]);
});

test('SPH static table cache rejects noncanonical collective optical schema and ABI', () => {
  for (const mutate of [
    (table) => ({
      ...table,
      schema: 'peercompute.ulg.optical-gpu-table.v999'
    }),
    (table) => ({
      ...table,
      recordStrideBytes: table.recordStrideBytes + Float32Array.BYTES_PER_ELEMENT
    }),
    (table) => ({
      ...table,
      wgslStructs: `${table.wgslStructs}\n// stale`
    })
  ]) {
    const tableInputs = fakeTableInputs();
    tableInputs.collectiveOpticalGpuTable = mutate(
      tableInputs.collectiveOpticalGpuTable
    );
    const update = createSphStaticTableCacheUpdate({
      tableInputs,
      generatorFingerprint
    });
    const bundle = rehydrateSphStaticTableBundle(
      update.cacheSnapshot,
      { generatorFingerprint }
    );

    assert.equal(bundle.collectiveOpticalRouteDescriptors, null);
    assert.equal(bundle.collectiveOpticalRouteSetAuthority, null);
    assert.equal(bundle.collectiveOpticalGpuTable, null);
    assert.equal(bundle.dispersedMediumOpticalClosureTable, null);
    assert.equal(bundle.hitCount, 5);
  }
});

test('SPH static table cache keeps legacy five-family snapshots compatible', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const legacySnapshot = JSON.parse(update.cacheSnapshot);
  for (const [cacheKey, record] of Object.entries(legacySnapshot.tables)) {
    if (
      record.family === 'collective-optical-pbr-table'
      || record.family === 'sph-dispersed-medium-optical-closure-table'
    ) {
      delete legacySnapshot.tables[cacheKey];
    }
  }
  const opticalRecord = Object.values(legacySnapshot.tables).find(
    (record) => record.family === 'optical-pbr-table'
  );
  for (const field of [
    'status',
    'recordStrideBytes',
    'spectralSampleStrideBytes',
    'wgslStructs',
    'scientificValidation',
    'fullPhysicsValidation'
  ]) {
    delete opticalRecord.metadata[field];
  }

  const bundle = rehydrateSphStaticTableBundle(
    JSON.stringify(legacySnapshot),
    { generatorFingerprint }
  );
  assert.equal(bundle.hitCount, 5);
  assert.deepEqual(new Set(bundle.restoredFamilies), new Set([
    'thermalMaterialTable',
    'thermalClosureGraphSet',
    'thermalPhaseResponseTable',
    'opticalGpuTable',
    'reactionTable'
  ]));
  assert.equal(bundle.opticalGpuTable.status, 'static-table-cache-hit');
  assert.equal(bundle.opticalGpuTable.recordStrideBytes, 16);
  assert.equal(bundle.collectiveOpticalGpuTable, null);
  assert.equal(bundle.dispersedMediumOpticalClosureTable, null);
  assert.deepEqual(bundle.staleDerivedFamilies, []);
});

test('SPH static table cache rejects cross-generation collective optics splicing by row content', () => {
  const generationA = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs({ closureScatteringEfficiencyQsca: 1.25 }),
    generatorFingerprint,
    updatedAt: '2026-09-03T12:00:00.000Z'
  });
  const generationB = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs({ closureScatteringEfficiencyQsca: 1.75 }),
    generatorFingerprint,
    updatedAt: '2026-09-03T12:00:01.000Z'
  });
  const parsedA = JSON.parse(generationA.cacheSnapshot);
  const parsedB = JSON.parse(generationB.cacheSnapshot);
  const recordOf = (snapshot, family) => Object.values(snapshot.tables).find(
    (record) => record.family === family
  );
  const opticalA = recordOf(parsedA, 'collective-optical-pbr-table');
  const closureA = recordOf(
    parsedA,
    'sph-dispersed-medium-optical-closure-table'
  );
  const closureB = recordOf(
    parsedB,
    'sph-dispersed-medium-optical-closure-table'
  );

  assert.equal(
    opticalA.metadata.collectiveOpticalRouteDescriptors[0].opticalStateId,
    closureB.metadata.tableMetadata[0].opticalStateId
  );
  assert.notEqual(closureA.arrays.rows.hash, closureB.arrays.rows.hash);
  assert.notEqual(
    opticalA.metadata.collectiveOpticalRouteSetAuthority.contentHash,
    closureB.metadata.collectiveOpticalRouteSetAuthority.contentHash
  );

  // Even if stale metadata advertises the matching generation-A authority,
  // rehydration recomputes it from generation-B's actual closure rows.
  closureB.metadata.collectiveOpticalRouteSetAuthority = JSON.parse(JSON.stringify(
    opticalA.metadata.collectiveOpticalRouteSetAuthority
  ));
  const splicedSnapshot = {
    ...parsedA,
    tables: {
      [opticalA.cacheKey]: opticalA,
      [closureB.cacheKey]: closureB
    },
    gpuWarmup: {}
  };
  const bundle = rehydrateSphStaticTableBundle(
    JSON.stringify(splicedSnapshot),
    { generatorFingerprint }
  );

  assert.equal(bundle.collectiveOpticalRouteDescriptors, null);
  assert.equal(bundle.collectiveOpticalRouteSetAuthority, null);
  assert.equal(bundle.collectiveOpticalGpuTable, null);
  assert.equal(bundle.dispersedMediumOpticalClosureTable, null);
  assert.equal(bundle.hitCount, 0);
  assert.deepEqual(bundle.staleDerivedFamilies, [{
    family: 'sph-dispersed-medium-optical-static-route-set',
    reason: 'collective-optical-route-table-parity-mismatch'
  }]);
});

test('SPH static table cache rejects a thermal response record without conductivity sidecar', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const staleSnapshot = JSON.parse(update.cacheSnapshot);
  const staleThermalResponseRecord = Object.values(staleSnapshot.tables).find(
    (record) => record.family === 'sph-thermal-phase-response-table'
  );
  delete staleThermalResponseRecord.arrays.responseThermalConductivities;

  const bundle = rehydrateSphStaticTableBundle(JSON.stringify(staleSnapshot), {
    generatorFingerprint
  });

  assert.equal(bundle.thermalPhaseResponseTable, null);
  assert.equal(bundle.hitCount, 6);
  assert.equal(bundle.staleCount, 1);
  assert.deepEqual(bundle.staleDerivedFamilies, [{
    family: 'sph-thermal-phase-response-table',
    reason: 'missing-response-thermal-conductivity-sidecar'
  }]);
});

test('SPH static table cache rejects a persisted v0 reaction table after the phase-policy ABI bump', () => {
  const update = createSphStaticTableCacheUpdate({
    tableInputs: fakeTableInputs(),
    generatorFingerprint
  });
  const staleSnapshot = JSON.parse(update.cacheSnapshot);
  const staleReactionRecord = Object.values(staleSnapshot.tables).find(
    (record) => record.family === 'sph-reaction-table'
  );
  staleReactionRecord.sourceSchema = 'peercompute.ulg.sph-gpu-reaction-table.v0';

  const bundle = rehydrateSphStaticTableBundle(JSON.stringify(staleSnapshot), {
    generatorFingerprint
  });

  assert.equal(bundle.reactionTable, null);
  assert.equal(bundle.hitCount, 6);
  assert.equal(bundle.staleCount, 1);
  assert.deepEqual(bundle.staleDerivedFamilies, [{
    family: 'sph-reaction-table',
    reason: 'reaction-table-schema-mismatch',
    sourceSchema: 'peercompute.ulg.sph-gpu-reaction-table.v0',
    requiredSchema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA
  }]);
});
