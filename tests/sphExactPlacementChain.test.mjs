import test from 'node:test';
import assert from 'node:assert/strict';
import { withActualExactFamily } from './fixtures/exactPlacementCompositionFamily.mjs';
import { prepareExactPlacementChain } from './fixtures/sphExactPlacementChainNative.js';
import { encodeSphReactionProductPlacementSegmentedWebGpu as encode }
  from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';

test('genuine exact family encodes the complete placement chain without granting publication', async () => {
  await withActualExactFamily(async ({ args, candidate, family }) => {
    const device = args.device;
    const chain = prepareExactPlacementChain({ device, family,
      productTermCount: args.reactionTable.productTermCount, eventCapacity: candidate.physicalOutput.denseEventCount });
    try {
      const cold = await chain.prewarm();
      assert.ok(cold.pipelineCount > 12);
      assert.equal(cold.prewarmedCount, cold.pipelineCount);
      const warm = await chain.prewarm();
      assert.equal(warm.pipelineCount, cold.pipelineCount);
      assert.equal(warm.prewarmedCount, 0);
      const before = { dispatches: device.dispatches.length, writes: device.writes.length, submissions: device.submissions.length };
      assert.throws(() => encode({ ...chain.args, nextStateBuffer: family.frozenSourceStateBuffer }), /authority and arena family/);
      assert.equal(device.dispatches.length, before.dispatches);
      assert.equal(device.writes.length, before.writes);
      const encoded = chain.encode();
      assert.ok(encoded);
      assert.equal(device.submissions.length, before.submissions);
      const commands = device.dispatches.slice(before.dispatches).map(row => row.pipeline.compute.entryPoint);
      assert.ok(commands.indexOf('finish_exact_chemistry_evidence')
        < commands.indexOf('initialize_exact_receiver_physical_apply'));
      assert.ok(commands.indexOf('consume_exact_chemistry_placement_evidence')
        > commands.indexOf('consume_exact_receiver_physical_evidence'));
      const select = commands.indexOf('select_exact_receiver_caloric');
      assert.ok(select > commands.lastIndexOf('refine_exact_receiver_caloric_intervals'));
      assert.deepEqual(commands.slice(select, select + 3), ['select_exact_receiver_caloric',
        'prepare_exact_receiver_caloric_view_energy', 'finalize_exact_receiver_caloric']);
      // Real encoding must carry each pending physical row through all checks
      // before the only dispatch that can mutate its packed physical state.
      assert.deepEqual(commands.slice(select + 3, select + 19), [
        'initialize_exact_receiver_physical_apply',
        'validate_exact_receiver_physical_source',
        'validate_exact_receiver_volume',
        'validate_exact_receiver_old_volume_identity',
        'validate_exact_receiver_rest_delta',
        'validate_exact_receiver_volume_delta',
        'validate_exact_receiver_volume_closure',
        'validate_exact_receiver_volume_views',
        'validate_exact_receiver_momentum_x',
        'validate_exact_receiver_momentum_y',
        'validate_exact_receiver_momentum_z',
        'validate_exact_receiver_kinetic',
        'validate_exact_receiver_energy_view',
        'validate_exact_receiver_entities',
        'prepare_exact_receiver_physical_segment_tails',
        'apply_exact_receiver_physical_segment_tails'
      ]);
      assert.equal(commands.at(-1), 'materialize_terminal_residual_physical');
      assert.ok(commands.includes('seal_transactional_placement_publication'));
      assert.throws(() => chain.encode(), /already encoded/);
      const sealed = chain.seal();
      assert.equal(sealed.segmentedEncoding, encoded);
      assert.ok(sealed.exactTerminalEncoding);
      assert.throws(() => chain.seal(), /one-shot encoding seal/);
    } finally { await chain.cleanup(); }
  });
});

test('cached chemistry dispatch planning rechecks changed device limits between passes', async () => {
  await withActualExactFamily(async ({ args, candidate, family }) => {
    const device = args.device;
    const chain = prepareExactPlacementChain({ device, family,
      productTermCount: args.reactionTable.productTermCount,
      eventCapacity: candidate.physicalOutput.denseEventCount });
    const originalLimit = device.limits.maxComputeWorkgroupsPerDimension;
    const begin = chain.args.encoder.beginComputePass.bind(chain.args.encoder);
    let changed = false;
    chain.args.encoder.beginComputePass = options => {
      const pass = begin(options), end = pass.end.bind(pass);
      pass.end = () => {
        end();
        if (!changed && options?.label === 'normalize_exact_chemistry_residuals') {
          changed = true;
          device.limits.maxComputeWorkgroupsPerDimension = 0;
        }
      };
      return pass;
    };
    try {
      await chain.prewarm();
      assert.throws(() => chain.encode(), /dispatch limit/);
      assert.equal(changed, true, 'the mutation must happen after chemistry planning and recording begin');
      assert.equal(device.dispatches.at(-1).pipeline.compute.entryPoint, 'normalize_exact_chemistry_residuals');
    } finally {
      device.limits.maxComputeWorkgroupsPerDimension = originalLimit;
      await chain.cleanup();
    }
  });
});

test('chemistry recording rejects a changed source table before physical application or publication', async () => {
  await withActualExactFamily(async ({ args, candidate, family }) => {
    const device = args.device;
    const chain = prepareExactPlacementChain({ device, family,
      productTermCount: args.reactionTable.productTermCount,
      eventCapacity: candidate.physicalOutput.denseEventCount });
    const terms = args.reactionTable.productTermRecords, original = terms[3];
    const begin = chain.args.encoder.beginComputePass.bind(chain.args.encoder);
    let changed = false;
    chain.args.encoder.beginComputePass = options => {
      const pass = begin(options), end = pass.end.bind(pass);
      pass.end = () => {
        end();
        if (!changed && options?.label === 'normalize_exact_chemistry_residuals') {
          changed = true; terms[3] = original * 2;
        }
      };
      return pass;
    };
    try {
      await chain.prewarm();
      const before = device.submissions.length, start = device.dispatches.length;
      assert.throws(() => chain.encode(), /original|changed|table/i);
      assert.equal(changed, true);
      const recorded = device.dispatches.slice(start).map(row => row.pipeline.compute.entryPoint);
      assert.ok(!recorded.includes('initialize_exact_receiver_physical_apply'));
      assert.ok(!recorded.includes('seal_transactional_placement_publication'));
      assert.equal(device.submissions.length, before);
    } finally {
      terms[3] = original;
      await chain.cleanup();
    }
  });
});
