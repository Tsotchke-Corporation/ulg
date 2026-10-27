import test from 'node:test';
import assert from 'node:assert/strict';
import { withActualExactFamily } from './fixtures/exactPlacementCompositionFamily.mjs';
import { prepareExactPlacementChain } from './fixtures/sphExactPlacementChainNative.js';
import {
  finalizeSchroederSpatialReactionPlacementPositionEpochFloor as finalize,
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue as releaseSource,
  transferSchroederSpatialReactionPlacementDestinationOwnership as transfer,
  releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue as retireDestination,
  createSchroederSpatialReactionPlacementMassInventory as copyMass,
  createSchroederSpatialReactionPlacementProductHistory as copyHistory
} from '../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js';
import { acquireSphExactMassRead, releaseSphExactMassRead, releaseSphExactMassInventory }
  from '../src/runtime/sph/sphExactMassInventoryGpu.js';
import { mergeResidentProductMassBuffersWebGpu as merge, resolveResidentProductExactHistoryLayout as resolveLayout,
  resolveResidentProductMassMergeSourceCapture as resolveCapture }
  from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { resolveResidentProductEventCountAuthority as countAuthority }
  from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { assertSphLegacyMassPathAllowed } from '../src/runtime/sph/sphGpuBuffers.js';
import { createSchroederSpatialReactionProductPlacementAuthorityWebGpu as createAuthority }
  from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import { runSphReactionSummaryWebGpu } from '../src/runtime/sph/sphReactionGpuSummary.js';

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('production exact summary rejects a substituted table, timestep or destination before allocation', async () => {
  await withActualExactFamily(async ({ args, candidate, family, inputs }) => {
    const authority = createAuthority(inputs), device = args.device;
    const options = { device, sphParticleState: args.sphParticleState, reactionTable: args.reactionTable,
      dtSeconds: args.dtSeconds, canonicalReactionProductPlacementAuthority: authority,
      sourceStateBuffer: family.transactionRollbackStateBuffer, sourceThermoBuffer: family.transactionRollbackThermoBuffer,
      sourceMechanicsBuffer: family.transactionRollbackMechanicsBuffer,
      nextStateBuffer: family.placedDestinationStateBuffer, nextThermoBuffer: family.placedDestinationThermoBuffer,
      nextMechanicsBuffer: family.placedDestinationMechanicsBuffer };
    const before = { buffers: device.createdBuffers.length, submissions: device.submissions.length };
    for (const changed of [{ reactionTable: { ...args.reactionTable } }, { dtSeconds: args.dtSeconds + 1 },
      { nextStateBuffer: candidate.physicalOutput.stateBuffer }, { sourceThermoBuffer: candidate.physicalOutput.thermoBuffer }]) {
      await assert.rejects(runSphReactionSummaryWebGpu({ ...options, ...changed }), /original|authority/i);
    }
    assert.equal(device.createdBuffers.length, before.buffers);
    assert.equal(device.submissions.length, before.submissions);
  });
});

async function withTransferred(callback) {
  return withActualExactFamily(async ({ args, candidate, family }) => {
    const device = args.device;
    const chain = prepareExactPlacementChain({ device, family, productTermCount: args.reactionTable.productTermCount,
      eventCapacity: candidate.physicalOutput.denseEventCount });
    let transferred = false;
    try {
      chain.encode();
      const artifact = chain.submitOwned();
      await finalize(family, { placementArtifact: artifact });
      releaseSource(family, { placementArtifact: artifact });
      transferred = transfer(family);
      assert.equal(transferred, true);
      return await callback({ device, family });
    } finally {
      if (transferred) await retireDestination(family);
      await chain.cleanup();
    }
  });
}

test('real transferred owner pins both successor producers before suspension and closes independently', async () => {
  await withTransferred(async ({ device, family }) => {
    const massPending = copyMass(family, { device }), historyPending = copyHistory(family, { device });
    const closing = retireDestination(family);
    await assert.rejects(copyHistory(family, { device }), /original live transferred/);
    const [mass, history] = await Promise.all([massPending, historyPending]);
    assert.equal(await closing, true);
    const read = acquireSphExactMassRead({ family: mass, device });
    try {
      assert.equal(family.placedDestinationMassBuffer.destroyed, true);
      assert.equal(read.buffer.destroyed, false);
      assert.equal(history.productEventBuffer.destroyed, false);
      assert.equal(history.exactProductHistoryProvenance.first, mass.generation);
      assert.equal(history.exactProductHistoryProvenance.last, mass.generation);
      assert.equal(resolveLayout(history, { device }), history.exactProductHistoryLayout);
      assert.throws(() => assertSphLegacyMassPathAllowed({ productEventBuffer: history.productEventBuffer }, 'test'), /exact/i);
    } finally {
      await releaseSphExactMassRead(read); releaseSphExactMassInventory(mass);
      const control = countAuthority(history, device).controlBuffer;
      await history.destroyResidentProductMassBuffers();
      assert.equal(history.productEventBuffer.destroyed, true);
      assert.equal(control.destroyed, true);
      assert.equal(countAuthority(history, device), null);
    }
  });
});

test('exact history rejects copied, foreign, legacy and overlapping sources before GPU submission', async () => {
  await withTransferred(async ({ device, family }) => {
    const a = await copyHistory(family, { device }), b = await copyHistory(family, { device });
    try {
      const before = device.submissions.length;
      assert.throws(() => resolveLayout({ ...a }, { device }), /original producer/);
      assert.throws(() => resolveLayout(a, { device: {} }), /original live owner/);
      await assert.rejects(merge({ device, inputResidentProductMass: a, emittedResidentProductMass: b }), /overlapping/);
      const legacy = { ...a }; delete legacy.exactProductHistoryLayout;
      await assert.rejects(merge({ device, inputResidentProductMass: a, emittedResidentProductMass: legacy }), /legacy/);
      assert.equal(device.submissions.length, before);
      assert.equal(await merge({ device, inputResidentProductMass: a, emittedResidentProductMass: a }), a);
    } finally { await a.destroyResidentProductMassBuffers(); await b.destroyResidentProductMassBuffers(); }
    assert.throws(() => resolveLayout(a, { device }), /original live owner/);
  });
});

test('original bounded history arena holds an exact source through owner retirement during append', async () => {
  await withTransferred(async ({ device, family }) => {
    const source = await copyHistory(family, { device }), token = {};
    const pending = merge({ device, emittedResidentProductMass: source, postMechanicsSourceCapture: token });
    const closing = source.destroyResidentProductMassBuffers();
    let capture;
    try {
      const output = await pending;
      capture = resolveCapture(output, token);
      assert.equal(await closing, true);
      assert.equal(source.productEventBuffer.destroyed, true);
      assert.equal(output.productEventBuffer.destroyed, false);
      assert.equal(resolveLayout(output, { device }), source.exactProductHistoryLayout);
      assert.throws(() => assertSphLegacyMassPathAllowed({ productEventBuffer: output.productEventBuffer }, 'test'), /exact/i);
      assert.ok(countAuthority(output, device));
    } finally { capture?.release(); await capture?.retireOwnedOutput(); await closing; }
  });
});

test('rejected device loss does not destroy copied exact history', async () => {
  await withTransferred(async ({ device, family }) => {
    // The source owner already observes its original loss promise. This
    // independent new history owner must not mistake rejection for loss.
    let rejectLoss;
    device.lost = new Promise((_, reject) => { rejectLoss = reject; });
    const history = await copyHistory(family, { device });
    const control = countAuthority(history, device).controlBuffer;
    rejectLoss(new Error('loss observation failed')); await nextTurn();
    assert.equal(history.productEventBuffer.destroyed, false);
    assert.equal(control.destroyed, false);
    assert.equal(resolveLayout(history, { device }), history.exactProductHistoryLayout);
    await history.destroyResidentProductMassBuffers();
    assert.equal(control.destroyed, true);
  });
});

test('confirmed device loss destroys both copied history allocations without an explicit close', async () => {
  await withTransferred(async ({ device, family }) => {
    let lose;
    device.lost = new Promise(resolve => { lose = resolve; });
    const history = await copyHistory(family, { device });
    const control = countAuthority(history, device).controlBuffer;
    lose({ reason: 'destroyed' }); await nextTurn();
    assert.equal(history.productEventBuffer.destroyed, true);
    assert.equal(control.destroyed, true);
    assert.throws(() => resolveLayout(history, { device }), /original live owner/);
    assert.equal(countAuthority(history, device), null);
  });
});
