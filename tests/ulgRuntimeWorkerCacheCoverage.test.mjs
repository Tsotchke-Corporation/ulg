import assert from 'node:assert/strict';
import { test } from 'node:test';

test('ULG runtime worker static table coverage ignores particle count but rejects stale reaction radius', async () => {
  const previousSelf = globalThis.self;
  globalThis.self = {
    addEventListener() {},
    postMessage() {},
    close() {}
  };
  try {
    const { staticTableBundleCoversViewState } = await import('../src/services/ulgRuntime.worker.js');
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
      thermalMaterialTable: {
        metadata: [{ material: 'na' }, { material: 'h2o' }]
      },
      opticalGpuTable: {
        recordMetadata: [
          { material: 'na', phase: 'phase-unspecified', opticalStateKey: 'default' },
          { material: 'h2o', phase: 'phase-unspecified', opticalStateKey: 'default' }
        ]
      },
      reactionTable: {
        reactionCount: 1,
        metadata: [{ product: 'naoh', contactRadiusM: 0.25 }],
        reactionHeaders: new Float32Array([0, 0, 2, 0, 2, 0, 1, -1000, 0, 0.25, 1, 3, 0, 2, 1, 0])
      }
    };
    const viewState = {
      materialProperties: { na: {}, h2o: {} },
      materials: ['na', 'h2o'],
      reactions: [{ a: 'na', b: 'h2o', product: 'naoh' }],
      reactionContactRadiusM: 0.25,
      sphGpuParticleState: { smoothingLengthM: 0.1, particleCount: 64 }
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
      reactions: [{ a: 'na', b: 'h2o', product: 'naoh', contactRadiusM: 0.25 }]
    }), true);
  } finally {
    if (previousSelf === undefined) {
      delete globalThis.self;
    } else {
      globalThis.self = previousSelf;
    }
  }
});
