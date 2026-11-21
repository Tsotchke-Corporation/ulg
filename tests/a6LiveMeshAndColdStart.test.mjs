import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import {
  clearReactionDiscoveryCache,
  discoverReactions
} from '../src/runtime/sph/reactionDiscovery.js';
import {
  ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  startLiveClientDerivationPeerMesh
} from '../src/services/clientDerivationPeers.js';

test('Period-3 4-atom clusters (Al+Cl, Mg+Cl) discover reactions without 49s synchronous STO-3G HF stall', () => {
  // Warm one-time default scene material closure cache so we measure reaction +
  // product closure derivation (previously 49.5 s on Al+Cl due to 36-basis STO-3G HF).
  discoverReactions('H', 'O');
  clearReactionDiscoveryCache();
  const pairs = [
    ['Al', 'Cl', 'alcl3'],
    ['Mg', 'Cl', 'mgcl2']
  ];
  for (const [a, b, expectedProduct] of pairs) {
    const t0 = performance.now();
    const res = discoverReactions(a, b);
    const elapsedMs = performance.now() - t0;
    assert.ok(res.reactions.length >= 1, `${a} + ${b} should discover a reaction`);
    assert.equal(res.reactions[0].product, expectedProduct);
    assert.ok(res.reactions[0].specificEnthalpyJPerKg < 0, `${a} + ${b} must be exothermic`);
    assert.ok(elapsedMs < 6000, `${a} + ${b} discovery took ${elapsedMs.toFixed(1)} ms (budget < 6000 ms vs 49.5s regression)`);
  }
});

test('startLiveClientDerivationPeerMesh discovers sibling tabs and enables 2-of-2 quorum requester cleanly', async () => {
  assert.equal(typeof ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL, 'string');
  if (typeof BroadcastChannel !== 'function') return;
  const channelName = `ulg-a6-mesh-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const meshA = startLiveClientDerivationPeerMesh({ channelName, peerId: 'tab-A', nodeId: 'node-A' });
  assert.ok(meshA);
  // Solo tab: zero remote peers, no spurious requester.
  assert.equal(meshA.getActiveRequester(), null);
  assert.equal(meshA.getStatus().quorumReady, false);

  const meshB = startLiveClientDerivationPeerMesh({ channelName, peerId: 'tab-B', nodeId: 'node-B' });
  const meshC = startLiveClientDerivationPeerMesh({ channelName, peerId: 'tab-C', nodeId: 'node-C' });
  try {
    // Wait for BroadcastChannel presence announcements.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const statusA = meshA.getStatus();
    assert.equal(statusA.quorumReady, true);
    assert.deepEqual(statusA.remotePeerIds, ['tab-B', 'tab-C']);
    const req = meshA.getActiveRequester();
    assert.ok(req && typeof req.submit === 'function' && typeof req.submitWithProvenance === 'function');
    assert.equal(meshA.getStatus().requesterActive, true);
  } finally {
    meshC.stop();
    meshB.stop();
    meshA.stop();
  }
  assert.equal(meshA.getStatus().active, false);
});
