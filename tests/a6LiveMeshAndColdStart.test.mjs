import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import {
  clearReactionDiscoveryCache,
  discoverReactions
} from '../src/runtime/sph/reactionDiscovery.js';
import {
  ULG_A6_DERIVATION_TRANSPORT,
  ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  startLiveClientDerivationPeerMesh
} from '../src/services/clientDerivationPeers.js';
import { createWarmClosureMissBridge } from '../src/runtime/material/warmClosureMissBridge.js';
import { ESHKOL_EOS_MODEL } from '../src/runtime/material/eshkolEosStiffness.js';

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

const SIM_A6_TASK_MODULE_URL = `data:text/javascript,${encodeURIComponent(`
export async function run(data) {
  if (data?.service === 'eshkol') {
    const samples = (data.points || []).map(([rho]) => rho * (1480 ** 2) * ((rho / 1000) ** 6));
    return {
      value: { samples },
      commitDelta: {
        taskId: 'ulg-a6-client:eshkol',
        scope: 'cross-machine-test',
        version: 1,
        payload: { residency: { service: 'eshkol', peer: globalThis.__ulgA6PeerId || 'unknown', spawns: 1, calls: 1 } }
      }
    };
  }
  const qubits = Number(data?.qubits || 4);
  return {
    value: { circuit: 'ghz-' + qubits, dim: 2 ** qubits, probabilitySum: 1 },
    commitDelta: {
      taskId: 'ulg-a6-client:moonlab',
      scope: 'cross-machine-test',
      version: 1,
      payload: { residency: { service: 'moonlab', peer: globalThis.__ulgA6PeerId || 'unknown', spawns: 1, calls: 1 } }
    }
  };
}
`)}`;

function createSimulatedSignalingAndWebRtcEnv() {
  const sockets = new Set();
  const rtcPeersById = new Map();
  let offerSeq = 0;

  const webSocketFactory = () => {
    const listeners = { open: [], close: [], error: [], message: [] };
    const ws = {
      readyState: 0,
      addEventListener(type, fn) { listeners[type]?.push(fn); },
      send(raw) {
        if (ws.readyState !== 1) throw new Error('socket not open');
        const payload = JSON.parse(raw);
        for (const other of sockets) {
          if (other === ws || other.readyState !== 1) continue;
          if (payload.to && other._peerId && other._peerId !== payload.to) continue;
          if (payload.from) ws._peerId = payload.from;
          queueMicrotask(() => {
            if (other.readyState !== 1) return;
            for (const fn of other._listeners.message) fn({ data: raw });
          });
        }
        if (payload.from) ws._peerId = payload.from;
      },
      close() {
        if (ws.readyState === 3) return;
        ws.readyState = 3;
        sockets.delete(ws);
        for (const fn of listeners.close) fn({});
      },
      _listeners: listeners,
      _peerId: null
    };
    sockets.add(ws);
    queueMicrotask(() => {
      if (ws.readyState !== 0) return;
      ws.readyState = 1;
      for (const fn of listeners.open) fn({});
    });
    return ws;
  };

  const makeDataChannelPair = () => {
    const a = { readyState: 'connecting', onopen: null, onclose: null, onerror: null, onmessage: null };
    const b = { readyState: 'connecting', onopen: null, onclose: null, onerror: null, onmessage: null };
    a.send = (data) => {
      if (a.readyState !== 'open' || b.readyState !== 'open') throw new Error('dc not open');
      queueMicrotask(() => { if (b.readyState === 'open') b.onmessage?.({ data }); });
    };
    b.send = (data) => {
      if (b.readyState !== 'open' || a.readyState !== 'open') throw new Error('dc not open');
      queueMicrotask(() => { if (a.readyState === 'open') a.onmessage?.({ data }); });
    };
    a.close = () => {
      if (a.readyState === 'closed') return;
      a.readyState = 'closed';
      a.onclose?.();
      if (b.readyState !== 'closed') { b.readyState = 'closed'; b.onclose?.(); }
    };
    b.close = () => {
      if (b.readyState === 'closed') return;
      b.readyState = 'closed';
      b.onclose?.();
      if (a.readyState !== 'closed') { a.readyState = 'closed'; a.onclose?.(); }
    };
    return [a, b];
  };

  const rtcPeerConnectionFactory = () => {
    const id = `pc-${++offerSeq}`;
    let localDc = null;
    let remotePairDc = null;
    const pc = {
      connectionState: 'new',
      onicecandidate: null,
      onconnectionstatechange: null,
      ondatachannel: null,
      createDataChannel() {
        const [a, b] = makeDataChannelPair();
        localDc = a;
        remotePairDc = b;
        return a;
      },
      async createOffer() { return { type: 'offer', pcId: id }; },
      async createAnswer() { return { type: 'answer', pcId: id }; },
      async setLocalDescription() {},
      async setRemoteDescription(desc) {
        if (desc?.type === 'offer') {
          const initiator = rtcPeersById.get(desc.pcId);
          if (initiator?._remotePairDc) {
            localDc = initiator._remotePairDc;
            pc.connectionState = 'connected';
            initiator.connectionState = 'connected';
            pc.ondatachannel?.({ channel: localDc });
            queueMicrotask(() => {
              if (initiator._localDc.readyState === 'connecting') {
                initiator._localDc.readyState = 'open';
                initiator._localDc.onopen?.();
              }
              if (localDc.readyState === 'connecting') {
                localDc.readyState = 'open';
                localDc.onopen?.();
              }
            });
          }
        }
      },
      async addIceCandidate() {},
      close() {
        pc.connectionState = 'closed';
        localDc?.close?.();
        rtcPeersById.delete(id);
      },
      get _localDc() { return localDc; },
      get _remotePairDc() { return remotePairDc; }
    };
    rtcPeersById.set(id, pc);
    return pc;
  };

  return { webSocketFactory, rtcPeerConnectionFactory };
}

test('A6 cross-machine WebRTC/signaling relay mesh runs 2-of-2 quorum, promotes surviving replicas on peer loss, and records fail-closed remoteDebt without CPU fallback', async () => {
  const { webSocketFactory, rtcPeerConnectionFactory } = createSimulatedSignalingAndWebRtcEnv();
  const sharedOpts = {
    transport: ULG_A6_DERIVATION_TRANSPORT.WEBRTC_RELAY,
    relayUrl: 'wss://sim-relay.local/ws',
    roomId: 'cross-machine-room',
    webSocketFactory,
    rtcPeerConnectionFactory,
    taskModuleUrl: SIM_A6_TASK_MODULE_URL,
    announceIntervalMs: 30,
    staleMs: 300,
    timeoutMs: 5000
  };
  const meshA = startLiveClientDerivationPeerMesh({ ...sharedOpts, peerId: 'machine-A', nodeId: 'node-A' });
  const meshB = startLiveClientDerivationPeerMesh({ ...sharedOpts, peerId: 'machine-B', nodeId: 'node-B' });
  const meshC = startLiveClientDerivationPeerMesh({ ...sharedOpts, peerId: 'machine-C', nodeId: 'node-C' });
  const meshD = startLiveClientDerivationPeerMesh({ ...sharedOpts, peerId: 'machine-D', nodeId: 'node-D' });
  let meshE = null;
  let meshF = null;
  const commits = [];
  const bridge = createWarmClosureMissBridge({
    maxInFlight: 2,
    requireRemotePeer: true,
    onPeerExhaustion: 'debt',
    taskRunner: async () => { throw new Error('FORBIDDEN local fallback in strict remote debt mode'); },
    onStateCommit: (delta) => commits.push(delta)
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 180));
    const statusA = meshA.getStatus();
    assert.equal(statusA.transport, ULG_A6_DERIVATION_TRANSPORT.WEBRTC_RELAY);
    assert.equal(statusA.connected, true);
    assert.equal(statusA.quorumReady, true);
    assert.deepEqual(statusA.remotePeerIds, ['machine-B', 'machine-C', 'machine-D']);
    assert.ok(
      statusA.webrtcDataChannelPeers.includes('machine-B')
      && statusA.webrtcDataChannelPeers.includes('machine-C'),
      `expected direct WebRTC DataChannels to open, got ${JSON.stringify(statusA.webrtcDataChannelPeers)}`
    );

    const activeReq = meshA.getActiveRequester();
    assert.ok(activeReq);
    bridge.setPeerRequester(activeReq);

    // 1. Live cross-machine 2-of-2 quorum derivation over WebRTC DataChannels.
    const r1 = bridge.requestEosStiffnessClosureMiss({
      missKey: 'webrtc-eos-1',
      eosModel: ESHKOL_EOS_MODEL.TAIT,
      restDensityKgPerM3: 1000,
      soundSpeedMPerS: 1480,
      scheduleId: 's1'
    });
    const out1 = await r1.promise;
    assert.equal(out1.failed, undefined);
    assert.equal(out1.provenance.mode, 'peer-quorum');
    assert.equal(out1.provenance.quorum, 'quorum-accepted');
    assert.ok(out1.provenance.matching >= 2);
    assert.equal(bridge.adoptPendingAtScheduleBoundary({ scheduleId: 's2' }).adoptedCount, 1);

    // 2. Primary peer (machine-B) disconnects -> existing requester fails over via
    // ERR_CLIENT_PEER_ABSENT and promotes surviving replica with 2-of-2 quorum.
    meshB.stop();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const r2 = bridge.requestQuantumClosureProbeMiss({
      missKey: 'webrtc-q-failover',
      qubits: 6,
      scheduleId: 's3'
    });
    const out2 = await r2.promise;
    assert.equal(out2.failed, undefined);
    assert.equal(out2.provenance.role, 'promoted-replica');
    assert.equal(out2.provenance.primaryFailure, 'ERR_CLIENT_PEER_ABSENT');
    assert.equal(out2.provenance.quorum, 'quorum-accepted');
    assert.equal(bridge.getStatus().stats.replicaPromotions, 1);
    assert.equal(bridge.adoptPendingAtScheduleBoundary({ scheduleId: 's4' }).adoptedCount, 1);

    // 3. Remaining peers disconnect -> fail-closed explicit remoteDebt with ZERO local fallback.
    meshC.stop();
    meshD.stop();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(meshA.getStatus().quorumReady, false);
    bridge.setPeerRequester(meshA.getActiveRequester());
    const r3 = bridge.requestQuantumClosureProbeMiss({
      missKey: 'webrtc-q-debt',
      qubits: 5,
      scheduleId: 's5'
    });
    const out3 = await r3.promise;
    assert.equal(out3.failed, true);
    assert.equal(bridge.getStatus().remoteDebtCount, 1);
    assert.equal(bridge.getStatus().remoteDebt[0].ownerLoss, true);
    assert.equal(bridge.getStatus().stats.ownerLosses, 1);

    // 4. Fresh cross-machine peers join -> retryRemoteDebt clears debt cleanly.
    meshE = startLiveClientDerivationPeerMesh({ ...sharedOpts, peerId: 'machine-E', nodeId: 'node-E' });
    meshF = startLiveClientDerivationPeerMesh({ ...sharedOpts, peerId: 'machine-F', nodeId: 'node-F' });
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(meshA.getStatus().quorumReady, true);
    bridge.setPeerRequester(meshA.getActiveRequester());
    const retries = bridge.retryRemoteDebt({ scheduleId: 's6' });
    assert.equal(retries.length, 1);
    const out3Recovered = await retries[0].promise;
    assert.equal(out3Recovered.failed, undefined);
    assert.equal(out3Recovered.provenance.quorum, 'quorum-accepted');
    assert.equal(bridge.getStatus().remoteDebtCount, 0);
    assert.equal(bridge.getStatus().stats.debtCleared, 1);
    assert.equal(bridge.adoptPendingAtScheduleBoundary({ scheduleId: 's7' }).adoptedCount, 1);
    assert.equal(commits.length, 3);
  } finally {
    bridge.destroy();
    meshF?.stop();
    meshE?.stop();
    meshD.stop();
    meshC.stop();
    meshB.stop();
    meshA.stop();
  }
});

test('A6 PeerCompute NetworkManager adapter achieves 2-of-2 quorum and cleans up messageHandlers on stop', async () => {
  const nodes = new Map();
  const makeNetworkManager = (peerId) => {
    const mgr = {
      peerId,
      isStarted: true,
      messageHandlers: [],
      addMessageHandler(fn) { mgr.messageHandlers.push(fn); },
      getConnectedPeers() {
        return [...nodes.keys()].filter((id) => id !== peerId);
      },
      async sendToPeer(targetId, message) {
        const target = nodes.get(targetId);
        if (!target) throw new Error(`peer ${targetId} disconnected`);
        queueMicrotask(() => {
          for (const fn of [...target.messageHandlers]) fn(peerId, message);
        });
      },
      async broadcast(message) {
        for (const [otherId, target] of nodes.entries()) {
          if (otherId === peerId) continue;
          queueMicrotask(() => {
            for (const fn of [...target.messageHandlers]) fn(peerId, message);
          });
        }
      }
    };
    nodes.set(peerId, mgr);
    return mgr;
  };

  const nmA = makeNetworkManager('pc-node-A');
  const nmB = makeNetworkManager('pc-node-B');
  const nmC = makeNetworkManager('pc-node-C');
  const opts = {
    roomId: 'pc-net-room',
    taskModuleUrl: SIM_A6_TASK_MODULE_URL,
    announceIntervalMs: 30,
    staleMs: 300,
    timeoutMs: 5000
  };
  const meshA = startLiveClientDerivationPeerMesh({ ...opts, networkManager: nmA });
  const meshB = startLiveClientDerivationPeerMesh({ ...opts, networkManager: nmB });
  const meshC = startLiveClientDerivationPeerMesh({ ...opts, networkManager: nmC });

  try {
    await new Promise((resolve) => setTimeout(resolve, 140));
    const statusA = meshA.getStatus();
    assert.equal(statusA.transport, ULG_A6_DERIVATION_TRANSPORT.PEERCOMPUTE_NETWORK);
    assert.equal(statusA.peerId, 'pc-node-A');
    assert.equal(statusA.quorumReady, true);
    assert.deepEqual(statusA.remotePeerIds, ['pc-node-B', 'pc-node-C']);
    const req = meshA.getActiveRequester();
    assert.ok(req);
    const out = await req.submitWithProvenance('pc-net-task-1', { service: 'moonlab', qubits: 5 });
    assert.equal(out.value.circuit, 'ghz-5');
    assert.equal(out.provenance.validation.reason, 'quorum-accepted');
    assert.equal(out.provenance.validation.matchingResultCount, 2);
  } finally {
    meshC.stop();
    meshB.stop();
    meshA.stop();
  }
  assert.equal(nmA.messageHandlers.length, 0, 'NetworkManager handler must be removed on stop()');
  assert.equal(nmB.messageHandlers.length, 0);
  assert.equal(nmC.messageHandlers.length, 0);
});
