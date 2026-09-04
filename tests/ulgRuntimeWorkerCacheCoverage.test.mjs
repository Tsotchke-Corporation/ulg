import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import {
  createSphStaticTableCacheUpdate,
  rehydrateSphStaticTableBundle
} from '../src/runtime/sph/sphColdStartCache.js';
import {
  buildSphReactionTableFromViewState,
  buildSphThermalMaterialTableFromViewState,
  reactionTablesExactlyEqual,
  sphStaticTableInputsFromViewState,
  thermalMaterialTablesExactlyEqual
} from '../src/runtime/sph/sphStaticTableInputs.js';

test('ULG runtime worker static table coverage requires exact live thermal, reaction, and collective optical content', async () => {
  const previousSelf = globalThis.self;
  globalThis.self = {
    addEventListener() {},
    postMessage() {},
    close() {}
  };
  try {
    const { staticTableBundleCoversViewState } = await import('../src/services/ulgRuntime.worker.js');
    const closures = createReferenceMaterialClosures();
    const materialProperties = {
      h2o: closures.h2o.properties,
      fe: closures.fe.properties
    };
    const viewState = {
      materialProperties,
      materials: ['h2o', 'fe'],
      reactions: [{ a: 'fe', b: 'h2o', product: 'fe' }],
      reactionContactRadiusM: 0.25,
      sphGpuParticleState: { smoothingLengthM: 0.1, particleCount: 64 },
      mlsMpmGpuParticleState: {
        soundSpeedScale: 0.25,
        cflMaxSoundSpeedMPerS: 60,
        minGasSoundSpeedMPerS: 20
      }
    };
    const liveThermalMaterialTable =
      buildSphThermalMaterialTableFromViewState(viewState);
    const liveReactionTable = buildSphReactionTableFromViewState(viewState);
    const cacheUpdate = createSphStaticTableCacheUpdate({
      tableInputs: sphStaticTableInputsFromViewState(viewState, {
        thermalMaterialTable: liveThermalMaterialTable
      }),
      generatorFingerprint: 'ulg-runtime-worker-cache-coverage-test'
    });
    const bundle = rehydrateSphStaticTableBundle(cacheUpdate.cacheSnapshot, {
      generatorFingerprint: 'ulg-runtime-worker-cache-coverage-test'
    });

    assert.equal(bundle.hitCount, 7);
    assert.equal(staticTableBundleCoversViewState(bundle, viewState), true);
    assert.equal(
      staticTableBundleCoversViewState(structuredClone(bundle), viewState),
      true
    );
    assert.equal(staticTableBundleCoversViewState(bundle, {
      ...viewState,
      sphGpuParticleState: { smoothingLengthM: 0.1, particleCount: 512 }
    }), true);
    assert.equal(staticTableBundleCoversViewState(bundle, {
      ...viewState,
      reactionContactRadiusM: 0.5,
      sphGpuParticleState: { smoothingLengthM: 0.2, particleCount: 512 }
    }), false);
    assert.equal(staticTableBundleCoversViewState(bundle, {
      ...viewState,
      reactionContactRadiusM: 0.5,
      reactions: [{
        a: 'fe',
        b: 'h2o',
        product: 'fe',
        contactRadiusM: 0.25
      }]
    }), true);
    const changedMechanicsProfile = {
      ...viewState,
      mlsMpmGpuParticleState: {
        ...viewState.mlsMpmGpuParticleState,
        cflMaxSoundSpeedMPerS: 30
      }
    };
    assert.equal(
      reactionTablesExactlyEqual(
        liveReactionTable,
        buildSphReactionTableFromViewState(changedMechanicsProfile)
      ),
      false
    );
    assert.equal(staticTableBundleCoversViewState(bundle, changedMechanicsProfile), false);

    const staleRecords = new Float32Array(liveThermalMaterialTable.records);
    staleRecords[0] += 1;
    const staleBundle = {
      ...bundle,
      thermalMaterialTable: {
        ...liveThermalMaterialTable,
        records: staleRecords
      }
    };
    assert.equal(staticTableBundleCoversViewState(staleBundle, viewState), false);

    const staleLayoutBundle = {
      ...bundle,
      thermalMaterialTable: {
        ...liveThermalMaterialTable,
        segmentLayout: [...liveThermalMaterialTable.segmentLayout, 'stale-column']
      }
    };
    assert.equal(staticTableBundleCoversViewState(staleLayoutBundle, viewState), false);

    const staleCollectiveRecordsBundle = structuredClone(bundle);
    staleCollectiveRecordsBundle.collectiveOpticalGpuTable.records[2] += 0.125;
    assert.equal(
      staticTableBundleCoversViewState(staleCollectiveRecordsBundle, viewState),
      false
    );

    const staleCollectiveClosureRowsBundle = structuredClone(bundle);
    staleCollectiveClosureRowsBundle.dispersedMediumOpticalClosureTable.rows[8] += 0.125;
    assert.equal(
      staticTableBundleCoversViewState(
        staleCollectiveClosureRowsBundle,
        viewState
      ),
      false
    );

    const changedOpticalClosure = {
      ...materialProperties.h2o.dispersedMediumOpticalClosure,
      scatteringEfficiencyQsca: 1.5
    };
    const changedOpticalClosureViewState = {
      ...viewState,
      materialProperties: {
        ...materialProperties,
        h2o: {
          ...materialProperties.h2o,
          dispersedMediumOpticalClosure: changedOpticalClosure
        }
      }
    };
    assert.equal(
      staticTableBundleCoversViewState(bundle, changedOpticalClosureViewState),
      false
    );

    const legacyFiveFamilyBundle = structuredClone(bundle);
    legacyFiveFamilyBundle.restoredFamilies =
      legacyFiveFamilyBundle.restoredFamilies.filter((family) => (
        family !== 'collectiveOpticalGpuTable'
        && family !== 'dispersedMediumOpticalClosureTable'
      ));
    assert.equal(
      staticTableBundleCoversViewState(legacyFiveFamilyBundle, viewState),
      false
    );
    assert.equal(
      thermalMaterialTablesExactlyEqual(
        liveThermalMaterialTable,
        {
          ...liveThermalMaterialTable,
          records: new Float32Array(liveThermalMaterialTable.records),
          segments: new Float32Array(liveThermalMaterialTable.segments)
        }
      ),
      true
    );
  } finally {
    if (previousSelf === undefined) {
      delete globalThis.self;
    } else {
      globalThis.self = previousSelf;
    }
  }
});
