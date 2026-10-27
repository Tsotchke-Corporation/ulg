import test from 'node:test';
import assert from 'node:assert/strict';
import { withActualExactFamily } from './fixtures/exactPlacementCompositionFamily.mjs';
import { prepareExactPlacementChain } from './fixtures/sphExactPlacementChainNative.js';
import { prewarmSphReactionProductPlacementExactWebGpu } from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import { releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue } from '../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js';

for (const mode of ['compile-failure', 'source-retirement', 'copied-authority']) {
  test(`exact placement prewarm denies ${mode} without submission or writes`, async () => {
    await withActualExactFamily(async ({ args, candidate, family }) => {
      const device = args.device;
      const chain = prepareExactPlacementChain({ device, family,
        productTermCount: args.reactionTable.productTermCount,
        eventCapacity: candidate.physicalOutput.denseEventCount });
      let retirement;
      try {
        const before = { writes: device.writes.length, dispatches: device.dispatches.length, submissions: device.submissions.length };
        let compilations = 0;
        const original = device.createComputePipeline.bind(device);
        const failure = new Error('Owned compiler failure');
        device.createComputePipelineAsync = async descriptor => {
          compilations++;
          if (mode === 'compile-failure') throw failure;
          if (mode === 'source-retirement') retirement = releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, { device, abandon: true });
          return original(descriptor);
        };
        if (mode === 'copied-authority') {
          await assert.rejects(prewarmSphReactionProductPlacementExactWebGpu({ device, authority: { ...chain.args.authority } }), /runtime-issued/);
          assert.equal(compilations, 0);
        } else {
          await assert.rejects(chain.prewarm(), mode === 'compile-failure' ? failure : /retir|live|released/);
          assert.equal(compilations, 1);
        }
        assert.deepEqual({ writes: device.writes.length, dispatches: device.dispatches.length, submissions: device.submissions.length }, before);
      } finally { chain.cleanup(); await retirement; }
    });
  });
}
