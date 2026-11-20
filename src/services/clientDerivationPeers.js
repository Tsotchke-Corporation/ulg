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
