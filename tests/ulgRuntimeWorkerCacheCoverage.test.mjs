import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import {
  buildSphReactionTableFromViewState,
  buildSphThermalMaterialTableFromViewState,
  reactionTablesExactlyEqual,
  thermalMaterialTablesExactlyEqual
} from '../src/runtime/sph/sphStaticTableInputs.js';

test('ULG runtime worker static table coverage rejects stale thermal content and reaction radius', async () => {
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
    const bundle = {
      schema: 'peercompute.ulg.sph-static-table-cache-bundle.v0',
      hitCount: 5,
      restoredFamilies: [
        'thermalMaterialTable',
        'thermalClosureGraphSet',
        'thermalPhaseResponseTable',
        'opticalGpuTable',
        'reactionTable'
      ],
      thermalMaterialTable: liveThermalMaterialTable,
      opticalGpuTable: {
        recordMetadata: [
          { material: 'h2o', phase: 'phase-unspecified', opticalStateKey: 'default' },
          { material: 'fe', phase: 'phase-unspecified', opticalStateKey: 'default' }
        ]
      },
      reactionTable: liveReactionTable
    };

    assert.equal(staticTableBundleCoversViewState(bundle, viewState), true);
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
