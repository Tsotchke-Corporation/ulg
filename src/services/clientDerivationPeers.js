// A6: PeerCompute peers as browser pages. Same-origin pages exchange the
// NodeKernel compute messages over a BroadcastChannel; responders announce
// presence every 250 ms and on pagehide, and a requester treats a peer it has
// not heard from in 1 s (or that said goodbye) as gone, so a closed primary
// page fails its placement and PeerCompute promotes a replica.
import { NodeKernel } from '../../../peercompute/peercompute/src/peercompute/nodeKernel/NodeKernel.js';
import { ComputeManager } from '../../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js';
import { createRemoteResultQuorumValidator } from '../../../peercompute/peercompute/src/peercompute/computeManager/RemoteResultQuorumValidator.js';

export function startClientDerivationResponder({ channelName, peerId, nodeId }) {
  globalThis.__ulgA6PeerId = peerId;
  const channel = new BroadcastChannel(channelName);
  const kernel = new NodeKernel({ enableRemoteComputeResponder: true });
  kernel.nodeId = nodeId;
  kernel.isStarted = true;
  kernel.computeManager = new ComputeManager({ enableWorkers: false });
  kernel.computeManager.setCommitDeltaHandler(() => {});
  kernel.networkManager = {
    sendToPeer: async (to, message) => channel.postMessage({ to, from: peerId, type: message.type, data: message.data })
  };
  channel.onmessage = async (event) => {
    const message = event.data ?? {};
    if (message.to !== peerId || message.type !== 'compute-task') return;
    await kernel._handleComputeTask(message.from, message.data);
  };
  const announce = (alive) => channel.postMessage({ type: 'presence', from: peerId, alive });
  announce(true);
  const timer = setInterval(() => announce(true), 250);
  globalThis.addEventListener?.('pagehide', () => { clearInterval(timer); announce(false); });
  return { kernel, stop() { clearInterval(timer); announce(false); channel.close(); } };
}

export function startClientDerivationRequester({ channelName, peerId, primaryPeerId, replicaPeerIds, timeoutMs = 30_000 }) {
  const channel = new BroadcastChannel(channelName);
  const kernel = new NodeKernel({});
  kernel.nodeId = `requester:${peerId}`;
  kernel.isStarted = true;
  const presence = new Map();
  channel.onmessage = (event) => {
    const message = event.data ?? {};
    if (message.type === 'presence') { presence.set(message.from, { alive: message.alive, at: performance.now() }); return; }
    if (message.to === peerId && message.type === 'compute-result') kernel._handleComputeResult(message.from, message.data);
  };
  kernel.networkManager = {
    sendToPeer: async (to, message) => {
      const seen = presence.get(to);
      if (!seen?.alive || performance.now() - seen.at > 1000) {
        const error = new Error(`client peer ${to} is not present`);
        error.code = 'ERR_CLIENT_PEER_ABSENT';
        throw error;
      }
      channel.postMessage({ to, from: peerId, type: message.type, data: message.data });
    }
  };
  const peers = [primaryPeerId, ...replicaPeerIds];
  const placementExecutor = kernel.createRedundantNetworkPlacementExecutor(peers, {
    executorId: `ulg-a6-client:${peers.join(',')}`, timeoutMs, requestId: 'ulg-a6-client' });
  const deltas = [];
  const compute = new ComputeManager({
    enableWorkers: false,
    placementExecutor,
    placementExecutorId: placementExecutor.placementExecutorId,
    placementAdmission: () => ({ accepted: true, reason: 'ulg-a6-same-origin-client-peers' }),
    placementTaskSigner: (packet) => ({ signed: true, signerId: 'ulg-a6-client', signature: `sig:${packet.taskHash}`,
      signatureAlgorithm: 'ulg-a6-client-test-signature' }),
    placementResultValidator: createRemoteResultQuorumValidator({ validationId: 'ulg-a6-client-quorum',
      minReplicaCount: 2, minMatchingReplicas: 2, compareCommitDeltaHash: false })
  });
  compute.setCommitDeltaHandler((delta) => deltas.push(delta));
  const lastProvenance = () => compute.getStats().taskPlacement?.lastPlacement?.provenance ?? null;
  const submit = (id, data) => compute.submitTask({
    id, runtime: 'js', taskFamily: 'ulg-client-derivation',
    module: new URL('/src/services/clientWarmDerivationTask.js', globalThis.location.href).href, exportName: 'run', data,
    placementHint: { requestedPlacement: 'peer', recommendedPlacement: 'peer', advisoryOnly: false,
      solverKey: `ulg-client-${data.service}`, solverId: 'ulg-client-derivation', confidence: 1,
      targetReplicaCount: peers.length, peerId: primaryPeerId, timeoutMs }
  });
  const submitWithProvenance = async (id, data) => {
    const deltaCountBefore = deltas.length;
    const value = await submit(id, data);
    const commitDelta = deltas.length > deltaCountBefore ? deltas.at(-1) : null;
    return {
      value,
      commitDelta,
      provenance: lastProvenance()
    };
  };
  return {
    kernel,
    compute,
    deltas,
    presence,
    submit,
    submitWithProvenance,
    lastProvenance,
    stop() {
      channel.close();
    }
  };
}

export const ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL = 'ulg-a6-derivation-peers-v1';

/**
 * Live self-discovering A6 PeerCompute client derivation mesh for browser
 * sessions. Each live tab acts as a PeerCompute NodeKernel responder over
 * `BroadcastChannel` and discovers sibling same-origin tabs. When at least two
 * sibling responders are alive, `getActiveRequester()` returns a 2-of-2 quorum
 * PeerCompute requester; when running solo, it returns `null` so the bridge
 * uses the local warm Eshkol/MoonLab WASM/WebGPU worker with zero spurious
 * peer-absent debt.
 */
export function startLiveClientDerivationPeerMesh({
  channelName = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  peerId = `ulg-tab-${Math.random().toString(36).slice(2, 10)}`,
  nodeId = null,
  timeoutMs = 15_000,
  staleMs = 1500
} = {}) {
  if (typeof BroadcastChannel !== 'function') return null;
  const resolvedNodeId = nodeId || `client-${peerId}`;
  const responder = startClientDerivationResponder({
    channelName,
    peerId,
    nodeId: resolvedNodeId
  });
  const discoveryChannel = new BroadcastChannel(channelName);
  const remotePresence = new Map(); // remotePeerId -> { alive, at }
  let activeRequester = null;
  let activePeerSignature = '';
  let stopped = false;

  const pruneAndListRemotePeers = () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const alive = [];
    for (const [id, rec] of remotePresence.entries()) {
      if (!rec.alive || now - rec.at > staleMs) {
        remotePresence.delete(id);
        continue;
      }
      alive.push(id);
    }
    alive.sort();
    return alive;
  };

  discoveryChannel.onmessage = (event) => {
    if (stopped) return;
    const message = event.data ?? {};
    if (message.type !== 'presence' || !message.from || message.from === peerId) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (message.alive) {
      remotePresence.set(message.from, { alive: true, at: now });
    } else {
      remotePresence.delete(message.from);
    }
  };

  function getActiveRequester() {
    if (stopped) return null;
    const peers = pruneAndListRemotePeers();
    if (peers.length < 2) {
      if (activeRequester) {
        try { activeRequester.stop(); } catch { /* Already closed. */ }
        activeRequester = null;
        activePeerSignature = '';
      }
      return null;
    }
    const sig = peers.join(',');
    if (activeRequester && activePeerSignature === sig) {
      return activeRequester;
    }
    if (activeRequester) {
      try { activeRequester.stop(); } catch { /* Already closed. */ }
      activeRequester = null;
    }
    activeRequester = startClientDerivationRequester({
      channelName,
      peerId: `${peerId}:req`,
      primaryPeerId: peers[0],
      replicaPeerIds: peers.slice(1),
      timeoutMs
    });
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    for (const id of peers) {
      activeRequester.presence.set(id, { alive: true, at: now });
    }
    activePeerSignature = sig;
    return activeRequester;
  }

  function getStatus() {
    const peers = stopped ? [] : pruneAndListRemotePeers();
    return Object.freeze({
      active: !stopped,
      channelName,
      peerId,
      nodeId: resolvedNodeId,
      remotePeerIds: Object.freeze(peers),
      remotePeerCount: peers.length,
      quorumReady: peers.length >= 2,
      requesterActive: Boolean(activeRequester)
    });
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (activeRequester) {
      try { activeRequester.stop(); } catch { /* Already closed. */ }
      activeRequester = null;
    }
    try { responder.stop(); } catch { /* Already closed. */ }
    try { discoveryChannel.close(); } catch { /* Already closed. */ }
    remotePresence.clear();
  }

  globalThis.addEventListener?.('pagehide', stop, { once: true });
  return Object.freeze({
    peerId,
    nodeId: resolvedNodeId,
    channelName,
    getActiveRequester,
    getStatus,
    stop
  });
}
