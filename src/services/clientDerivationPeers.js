// A6: PeerCompute remote derivation peers across browser pages and machines.
// Supports:
//   - same-origin BroadcastChannel tabs ('broadcast-channel')
//   - cross-machine WebSocket signaling relay ('relay-websocket')
//   - WebRTC DataChannel peer mesh with signaling-relay fallback ('webrtc-relay')
//   - PeerCompute NetworkManager libp2p/WebRTC direct+pubsub transport ('peercompute-network')
//   - hybrid local BroadcastChannel + cross-machine relay/network ('hybrid')
//
// Responders announce presence every 250 ms and on pagehide. A requester treats
// any peer it has not heard from within staleMs (or that disconnected / said
// goodbye) as absent with ERR_CLIENT_PEER_ABSENT so PeerCompute's redundant
// placement executor promotes a surviving replica under 2-of-2 quorum validation
// or surfaces explicit remoteDebt without silent CPU hot-state fallback.
import {
  NodeKernel,
  ComputeManager,
  createRemoteResultQuorumValidator
} from '../runtime/peercomputeCore.js';

export const ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL = 'ulg-a6-derivation-peers-v1';

export const ULG_A6_DERIVATION_TRANSPORT = Object.freeze({
  BROADCAST_CHANNEL: 'broadcast-channel',
  RELAY_WEBSOCKET: 'relay-websocket',
  WEBRTC_RELAY: 'webrtc-relay',
  PEERCOMPUTE_NETWORK: 'peercompute-network',
  HYBRID: 'hybrid'
});

const A6_PEERCOMPUTE_ENVELOPE_TYPE = 'ulg-a6-derivation-envelope';

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function isTransportObject(candidate) {
  return Boolean(
    candidate
    && typeof candidate === 'object'
    && typeof candidate.send === 'function'
    && typeof candidate.onMessage === 'function'
    && typeof candidate.close === 'function'
  );
}

function normalizeRelayUrl(relayUrl) {
  const trimmed = String(relayUrl ?? '').trim();
  if (!trimmed) return '';
  if (/^(?:wss?|https?):\/\//i.test(trimmed)) return trimmed;
  return trimmed;
}

/**
 * Same-origin browser BroadcastChannel transport.
 */
export function createBroadcastChannelTransport({
  channelName = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL
} = {}) {
  if (typeof BroadcastChannel !== 'function') {
    throw new Error('BroadcastChannel is not available in this environment');
  }
  const channel = new BroadcastChannel(channelName);
  const handlers = new Set();
  let closed = false;

  channel.onmessage = (event) => {
    if (closed) return;
    const envelope = event?.data ?? {};
    for (const fn of handlers) {
      try { fn(envelope); } catch { /* Isolate listener faults. */ }
    }
  };

  return Object.freeze({
    kind: ULG_A6_DERIVATION_TRANSPORT.BROADCAST_CHANNEL,
    send(envelope) {
      if (closed) return false;
      channel.postMessage(envelope);
      return true;
    },
    onMessage(handler) {
      if (typeof handler !== 'function') return () => {};
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    isConnected() {
      return !closed;
    },
    isPeerReachable() {
      return !closed;
    },
    getTransportMeta() {
      return Object.freeze({
        transport: ULG_A6_DERIVATION_TRANSPORT.BROADCAST_CHANNEL,
        channelName,
        roomId: channelName,
        relayUrl: null,
        connected: !closed,
        webrtcDataChannelPeers: Object.freeze([])
      });
    },
    close() {
      if (closed) return;
      closed = true;
      handlers.clear();
      try { channel.close(); } catch { /* Already closed. */ }
    }
  });
}

/**
 * Cross-machine WebSocket signaling relay transport with optional automatic
 * WebRTC DataChannel peer-to-peer upgrade and fail-closed disconnect tracking.
 */
export function createRelaySignalingTransport({
  relayUrl,
  roomId = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  peerId,
  enableWebRtc = true,
  rtcIceServers = [],
  webSocketFactory = null,
  rtcPeerConnectionFactory = null,
  reconnectDelayMs = 1500
} = {}) {
  const normalizedUrl = normalizeRelayUrl(relayUrl);
  if (!normalizedUrl) {
    throw new TypeError('createRelaySignalingTransport requires a non-empty relayUrl');
  }
  const resolvedRoomId = String(roomId || ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL).trim();
  const resolvedPeerId = String(peerId || `ulg-peer-${Math.random().toString(36).slice(2, 10)}`);
  const wsFactory = typeof webSocketFactory === 'function'
    ? webSocketFactory
    : (url) => {
        if (typeof globalThis.WebSocket !== 'function') {
          throw new Error('WebSocket is not available in this environment');
        }
        return new globalThis.WebSocket(url);
      };
  const rtcFactory = typeof rtcPeerConnectionFactory === 'function'
    ? rtcPeerConnectionFactory
    : (enableWebRtc && typeof globalThis.RTCPeerConnection === 'function'
        ? (config) => new globalThis.RTCPeerConnection(config)
        : null);

  const handlers = new Set();
  const rtcPeers = new Map(); // remotePeerId -> { pc, dc, ready }
  let socket = null;
  let socketOpen = false;
  let closed = false;
  let reconnectTimer = null;

  const dispatchEnvelope = (envelope) => {
    if (closed || !envelope || typeof envelope !== 'object') return;
    if (envelope.roomId && envelope.roomId !== resolvedRoomId) return;
    if (envelope.from && envelope.from === resolvedPeerId) return;
    for (const fn of handlers) {
      try { fn(envelope); } catch { /* Isolate listener faults. */ }
    }
  };

  const sendViaSocket = (payload) => {
    if (closed || !socket || !socketOpen) return false;
    try {
      socket.send(JSON.stringify({ ...payload, roomId: resolvedRoomId }));
      return true;
    } catch {
      return false;
    }
  };

  const cleanupRtcPeer = (remotePeerId) => {
    const entry = rtcPeers.get(remotePeerId);
    if (!entry) return;
    rtcPeers.delete(remotePeerId);
    try { entry.dc?.close?.(); } catch { /* Already closed. */ }
    try { entry.pc?.close?.(); } catch { /* Already closed. */ }
  };

  const attachDataChannel = (remotePeerId, entry, dc) => {
    entry.dc = dc;
    entry.ready = dc?.readyState === 'open';
    dc.onopen = () => { entry.ready = true; };
    dc.onclose = () => {
      entry.ready = false;
      if (rtcPeers.get(remotePeerId) === entry) cleanupRtcPeer(remotePeerId);
    };
    dc.onerror = () => { entry.ready = false; };
    dc.onmessage = (event) => {
      try {
        const parsed = typeof event?.data === 'string' ? JSON.parse(event.data) : event?.data;
        dispatchEnvelope(parsed);
      } catch {
        /* Ignore malformed WebRTC payload. */
      }
    };
  };

  const ensureRtcPeer = (remotePeerId, initiator) => {
    if (!rtcFactory || closed || !remotePeerId || remotePeerId === resolvedPeerId) return null;
    const existing = rtcPeers.get(remotePeerId);
    if (existing) return existing;
    let pc;
    try {
      pc = rtcFactory({ iceServers: Array.isArray(rtcIceServers) ? rtcIceServers : [] });
    } catch {
      return null;
    }
    const entry = { pc, dc: null, ready: false };
    rtcPeers.set(remotePeerId, entry);
    pc.onicecandidate = (event) => {
      if (event?.candidate) {
        sendViaSocket({
          type: 'rtc-ice',
          from: resolvedPeerId,
          to: remotePeerId,
          candidate: event.candidate
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        cleanupRtcPeer(remotePeerId);
      }
    };
    if (initiator) {
      try {
        const dc = pc.createDataChannel('ulg-a6-derivation');
        attachDataChannel(remotePeerId, entry, dc);
      } catch {
        cleanupRtcPeer(remotePeerId);
        return null;
      }
    } else {
      pc.ondatachannel = (event) => {
        if (event?.channel) attachDataChannel(remotePeerId, entry, event.channel);
      };
    }
    return entry;
  };

  const handleSignalingEnvelope = async (envelope) => {
    if (!envelope || typeof envelope !== 'object') return;
    if (envelope.roomId && envelope.roomId !== resolvedRoomId) return;
    if (envelope.from === resolvedPeerId) return;
    if (envelope.type === 'rtc-offer' && envelope.to === resolvedPeerId && rtcFactory) {
      const entry = ensureRtcPeer(envelope.from, false);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(envelope.sdp);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        sendViaSocket({ type: 'rtc-answer', from: resolvedPeerId, to: envelope.from, sdp: answer });
      } catch {
        cleanupRtcPeer(envelope.from);
      }
      return;
    }
    if (envelope.type === 'rtc-answer' && envelope.to === resolvedPeerId) {
      const entry = rtcPeers.get(envelope.from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(envelope.sdp);
      } catch {
        cleanupRtcPeer(envelope.from);
      }
      return;
    }
    if (envelope.type === 'rtc-ice' && envelope.to === resolvedPeerId) {
      const entry = rtcPeers.get(envelope.from);
      if (entry && envelope.candidate) {
        try { await entry.pc.addIceCandidate(envelope.candidate); } catch { /* Ignore late ICE. */ }
      }
      return;
    }
    if (
      envelope.type === 'presence'
      && envelope.alive
      && envelope.from
      && rtcFactory
      && resolvedPeerId < envelope.from
      && !rtcPeers.has(envelope.from)
    ) {
      const entry = ensureRtcPeer(envelope.from, true);
      if (entry) {
        try {
          const offer = await entry.pc.createOffer();
          await entry.pc.setLocalDescription(offer);
          sendViaSocket({ type: 'rtc-offer', from: resolvedPeerId, to: envelope.from, sdp: offer });
        } catch {
          cleanupRtcPeer(envelope.from);
        }
      }
    }
    if (envelope.type === 'presence' && envelope.alive === false && envelope.from) {
      cleanupRtcPeer(envelope.from);
    }
    dispatchEnvelope(envelope);
  };

  const connect = () => {
    if (closed) return;
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    let nextSocket;
    try {
      nextSocket = wsFactory(normalizedUrl);
    } catch {
      socketOpen = false;
      if (!closed && reconnectDelayMs > 0) {
        reconnectTimer = setTimeout(connect, reconnectDelayMs);
      }
      return;
    }
    socket = nextSocket;
    const onOpen = () => {
      if (closed || socket !== nextSocket) return;
      socketOpen = true;
      sendViaSocket({ type: 'join', from: resolvedPeerId });
    };
    const onClose = () => {
      if (socket !== nextSocket) return;
      socketOpen = false;
      if (!closed && reconnectDelayMs > 0) {
        reconnectTimer = setTimeout(connect, reconnectDelayMs);
      }
    };
    const onMessage = (event) => {
      if (closed || socket !== nextSocket) return;
      try {
        const raw = event?.data;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        void handleSignalingEnvelope(parsed);
      } catch {
        /* Ignore non-JSON relay frames. */
      }
    };
    if (typeof nextSocket.addEventListener === 'function') {
      nextSocket.addEventListener('open', onOpen);
      nextSocket.addEventListener('close', onClose);
      nextSocket.addEventListener('error', onClose);
      nextSocket.addEventListener('message', onMessage);
    } else {
      nextSocket.onopen = onOpen;
      nextSocket.onclose = onClose;
      nextSocket.onerror = onClose;
      nextSocket.onmessage = onMessage;
    }
    if (nextSocket.readyState === 1) {
      onOpen();
    }
  };

  connect();

  const openWebRtcPeers = () => {
    const out = [];
    for (const [remotePeerId, entry] of rtcPeers.entries()) {
      if (entry.ready && entry.dc?.readyState === 'open') out.push(remotePeerId);
    }
    out.sort();
    return out;
  };

  const kind = enableWebRtc && rtcFactory
    ? ULG_A6_DERIVATION_TRANSPORT.WEBRTC_RELAY
    : ULG_A6_DERIVATION_TRANSPORT.RELAY_WEBSOCKET;

  return Object.freeze({
    kind,
    send(envelope) {
      if (closed || !envelope) return false;
      if (envelope.to) {
        const rtcEntry = rtcPeers.get(envelope.to);
        if (rtcEntry?.ready && rtcEntry.dc?.readyState === 'open') {
          try {
            rtcEntry.dc.send(JSON.stringify({ ...envelope, roomId: resolvedRoomId }));
            return true;
          } catch {
            /* Fall back to signaling relay if direct DataChannel fails. */
          }
        }
      }
      return sendViaSocket(envelope);
    },
    onMessage(handler) {
      if (typeof handler !== 'function') return () => {};
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    isConnected() {
      return !closed && (socketOpen || openWebRtcPeers().length > 0);
    },
    isPeerReachable(targetPeerId) {
      if (closed) return false;
      const rtcEntry = rtcPeers.get(targetPeerId);
      if (rtcEntry?.ready && rtcEntry.dc?.readyState === 'open') return true;
      return socketOpen;
    },
    getTransportMeta() {
      return Object.freeze({
        transport: kind,
        channelName: resolvedRoomId,
        roomId: resolvedRoomId,
        relayUrl: normalizedUrl,
        connected: !closed && (socketOpen || openWebRtcPeers().length > 0),
        webrtcDataChannelPeers: Object.freeze(openWebRtcPeers())
      });
    },
    close() {
      if (closed) return;
      closed = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      for (const remotePeerId of [...rtcPeers.keys()]) {
        cleanupRtcPeer(remotePeerId);
      }
      handlers.clear();
      socketOpen = false;
      try { socket?.close?.(); } catch { /* Already closed. */ }
      socket = null;
    }
  });
}

/**
 * PeerCompute NetworkManager adapter transport (routes derivation envelopes
 * directly over PeerCompute's libp2p / WebRTC / pubsub NetworkManager).
 */
export function createPeerComputeNetworkManagerTransport({
  networkManager,
  peerId = null,
  roomId = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  topic = null
} = {}) {
  if (
    !networkManager
    || typeof networkManager.sendToPeer !== 'function'
    || typeof networkManager.broadcast !== 'function'
  ) {
    throw new TypeError('createPeerComputeNetworkManagerTransport requires a PeerCompute NetworkManager');
  }
  const resolvedRoomId = String(roomId || ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL).trim();
  const resolvedPeerId = String(peerId || networkManager.peerId || 'pc-peer');
  const handlers = new Set();
  let closed = false;

  const messageHandler = (_fromPeerId, message) => {
    if (closed || !message || typeof message !== 'object') return;
    const payload = message.payload && typeof message.payload === 'object' ? message.payload : message;
    if (payload.type !== A6_PEERCOMPUTE_ENVELOPE_TYPE) return;
    if (payload.roomId && payload.roomId !== resolvedRoomId) return;
    const envelope = payload.envelope;
    if (!envelope || typeof envelope !== 'object' || envelope.from === resolvedPeerId) return;
    for (const fn of handlers) {
      try { fn(envelope); } catch { /* Isolate listener faults. */ }
    }
  };

  if (typeof networkManager.addMessageHandler === 'function') {
    networkManager.addMessageHandler(messageHandler);
  }

  const connectedPeerSet = () => {
    if (typeof networkManager.getConnectedPeers !== 'function') return null;
    try {
      const list = networkManager.getConnectedPeers();
      if (!Array.isArray(list)) return null;
      return new Set(list.map((entry) => (typeof entry === 'string' ? entry : entry?.peerId || entry?.id)).filter(Boolean));
    } catch {
      return null;
    }
  };

  const isManagerConnected = () => {
    if (closed) return false;
    if (networkManager.isConnected === false || networkManager.isStarted === false) return false;
    return true;
  };

  return Object.freeze({
    kind: ULG_A6_DERIVATION_TRANSPORT.PEERCOMPUTE_NETWORK,
    send(envelope) {
      if (!isManagerConnected() || !envelope) return false;
      const wrapped = {
        type: A6_PEERCOMPUTE_ENVELOPE_TYPE,
        roomId: resolvedRoomId,
        envelope
      };
      try {
        if (envelope.to) {
          void Promise.resolve(networkManager.sendToPeer(envelope.to, wrapped)).catch(() => {});
        } else {
          void Promise.resolve(
            networkManager.broadcast(wrapped, topic ? { topic } : {})
          ).catch(() => {});
        }
        return true;
      } catch {
        return false;
      }
    },
    onMessage(handler) {
      if (typeof handler !== 'function') return () => {};
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    isConnected: isManagerConnected,
    isPeerReachable(targetPeerId) {
      if (!isManagerConnected()) return false;
      const peers = connectedPeerSet();
      if (!peers) return true;
      return peers.has(targetPeerId);
    },
    getTransportMeta() {
      return Object.freeze({
        transport: ULG_A6_DERIVATION_TRANSPORT.PEERCOMPUTE_NETWORK,
        channelName: resolvedRoomId,
        roomId: resolvedRoomId,
        relayUrl: null,
        connected: isManagerConnected(),
        webrtcDataChannelPeers: Object.freeze([])
      });
    },
    close() {
      if (closed) return;
      closed = true;
      handlers.clear();
      if (Array.isArray(networkManager.messageHandlers)) {
        const idx = networkManager.messageHandlers.indexOf(messageHandler);
        if (idx >= 0) networkManager.messageHandlers.splice(idx, 1);
      }
    }
  });
}

/**
 * Combines multiple transports (e.g. same-origin BroadcastChannel + cross-machine
 * WebRTC/signaling relay) into one unified peer mesh transport.
 */
export function createHybridDerivationTransport(transports = []) {
  const active = transports.filter(isTransportObject);
  if (active.length === 0) {
    throw new TypeError('createHybridDerivationTransport requires at least one transport');
  }
  const handlers = new Set();
  const unsubscribes = active.map((t) => t.onMessage((envelope) => {
    for (const fn of handlers) {
      try { fn(envelope); } catch { /* Isolate listener faults. */ }
    }
  }));
  let closed = false;

  return Object.freeze({
    kind: ULG_A6_DERIVATION_TRANSPORT.HYBRID,
    send(envelope) {
      if (closed) return false;
      let sent = false;
      for (const t of active) {
        if (t.send(envelope)) sent = true;
      }
      return sent;
    },
    onMessage(handler) {
      if (typeof handler !== 'function') return () => {};
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    isConnected() {
      return !closed && active.some((t) => t.isConnected());
    },
    isPeerReachable(targetPeerId) {
      return !closed && active.some((t) => (t.isPeerReachable ? t.isPeerReachable(targetPeerId) : t.isConnected()));
    },
    getTransportMeta() {
      const metas = active.map((t) => t.getTransportMeta?.() ?? {});
      const relayMeta = metas.find((m) => m.relayUrl);
      const rtcPeers = [...new Set(metas.flatMap((m) => m.webrtcDataChannelPeers ?? []))].sort();
      return Object.freeze({
        transport: ULG_A6_DERIVATION_TRANSPORT.HYBRID,
        channelName: metas[0]?.channelName ?? ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
        roomId: relayMeta?.roomId ?? metas[0]?.roomId ?? ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
        relayUrl: relayMeta?.relayUrl ?? null,
        connected: !closed && active.some((t) => t.isConnected()),
        webrtcDataChannelPeers: Object.freeze(rtcPeers)
      });
    },
    close() {
      if (closed) return;
      closed = true;
      for (const unsub of unsubscribes) {
        try { unsub(); } catch { /* Ignore. */ }
      }
      handlers.clear();
      for (const t of active) {
        try { t.close(); } catch { /* Ignore. */ }
      }
    }
  });
}

export function createDerivationPeerTransport({
  transport = null,
  channelName = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  relayUrl = '',
  roomId = null,
  peerId = null,
  networkManager = null,
  enableWebRtc = true,
  rtcIceServers = [],
  webSocketFactory = null,
  rtcPeerConnectionFactory = null,
  reconnectDelayMs = 1500
} = {}) {
  if (isTransportObject(transport)) {
    return { transport, owned: false };
  }
  const normalizedRelayUrl = normalizeRelayUrl(relayUrl);
  const resolvedRoomId = String(roomId || channelName || ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL).trim();
  const mode = String(transport || '').trim().toLowerCase();

  if (mode === ULG_A6_DERIVATION_TRANSPORT.PEERCOMPUTE_NETWORK || (!mode && networkManager && !normalizedRelayUrl)) {
    return {
      transport: createPeerComputeNetworkManagerTransport({
        networkManager,
        peerId,
        roomId: resolvedRoomId
      }),
      owned: true
    };
  }
  if (mode === ULG_A6_DERIVATION_TRANSPORT.RELAY_WEBSOCKET) {
    return {
      transport: createRelaySignalingTransport({
        relayUrl: normalizedRelayUrl,
        roomId: resolvedRoomId,
        peerId,
        enableWebRtc: false,
        webSocketFactory,
        reconnectDelayMs
      }),
      owned: true
    };
  }
  if (mode === ULG_A6_DERIVATION_TRANSPORT.WEBRTC_RELAY || (!mode && normalizedRelayUrl && typeof BroadcastChannel !== 'function')) {
    return {
      transport: createRelaySignalingTransport({
        relayUrl: normalizedRelayUrl,
        roomId: resolvedRoomId,
        peerId,
        enableWebRtc: enableWebRtc !== false,
        rtcIceServers,
        webSocketFactory,
        rtcPeerConnectionFactory,
        reconnectDelayMs
      }),
      owned: true
    };
  }
  if (mode === ULG_A6_DERIVATION_TRANSPORT.HYBRID || (!mode && normalizedRelayUrl && typeof BroadcastChannel === 'function')) {
    const parts = [];
    if (typeof BroadcastChannel === 'function') {
      parts.push(createBroadcastChannelTransport({ channelName: resolvedRoomId }));
    }
    if (normalizedRelayUrl) {
      parts.push(createRelaySignalingTransport({
        relayUrl: normalizedRelayUrl,
        roomId: resolvedRoomId,
        peerId,
        enableWebRtc: enableWebRtc !== false,
        rtcIceServers,
        webSocketFactory,
        rtcPeerConnectionFactory,
        reconnectDelayMs
      }));
    }
    if (networkManager) {
      parts.push(createPeerComputeNetworkManagerTransport({
        networkManager,
        peerId,
        roomId: resolvedRoomId
      }));
    }
    if (parts.length === 1) return { transport: parts[0], owned: true };
    return { transport: createHybridDerivationTransport(parts), owned: true };
  }
  return {
    transport: createBroadcastChannelTransport({ channelName: resolvedRoomId }),
    owned: true
  };
}

function buildRemoteModulePolicyConfig({
  allowedRemoteModules = null,
  allowedRemoteModuleOrigins = null,
  allowLocalFileRemoteModules = false,
  remoteModuleBaseUrl = null
} = {}) {
  const config = {};
  if (Array.isArray(allowedRemoteModules) && allowedRemoteModules.length > 0) {
    config.allowedRemoteModules = [...allowedRemoteModules];
  }
  if (Array.isArray(allowedRemoteModuleOrigins) && allowedRemoteModuleOrigins.length > 0) {
    config.allowedRemoteModuleOrigins = [...allowedRemoteModuleOrigins];
  }
  if (allowLocalFileRemoteModules === true) {
    config.allowLocalFileRemoteModules = true;
  }
  if (typeof remoteModuleBaseUrl === 'string' && remoteModuleBaseUrl.trim()) {
    config.remoteModuleBaseUrl = remoteModuleBaseUrl.trim();
  }
  return config;
}

export function startClientDerivationResponder({
  channelName = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  peerId,
  nodeId,
  transport = null,
  relayUrl = '',
  roomId = null,
  networkManager = null,
  enableWebRtc = true,
  rtcIceServers = [],
  webSocketFactory = null,
  rtcPeerConnectionFactory = null,
  announceIntervalMs = 250,
  allowedRemoteModules = null,
  allowedRemoteModuleOrigins = null,
  allowLocalFileRemoteModules = false,
  remoteModuleBaseUrl = null
} = {}) {
  globalThis.__ulgA6PeerId = peerId;
  const { transport: activeTransport, owned } = createDerivationPeerTransport({
    transport,
    channelName,
    relayUrl,
    roomId,
    peerId,
    networkManager,
    enableWebRtc,
    rtcIceServers,
    webSocketFactory,
    rtcPeerConnectionFactory
  });
  const kernel = new NodeKernel({
    enableRemoteComputeResponder: true,
    ...buildRemoteModulePolicyConfig({
      allowedRemoteModules,
      allowedRemoteModuleOrigins,
      allowLocalFileRemoteModules,
      remoteModuleBaseUrl
    })
  });
  kernel.nodeId = nodeId;
  kernel.isStarted = true;
  kernel.computeManager = new ComputeManager({ enableWorkers: false });
  kernel.computeManager.setCommitDeltaHandler(() => {});
  kernel.networkManager = {
    sendToPeer: async (to, message) => {
      activeTransport.send({ to, from: peerId, type: message.type, data: message.data });
    }
  };
  const unsubscribe = activeTransport.onMessage(async (message) => {
    if (message?.to !== peerId || message?.type !== 'compute-task') return;
    await kernel._handleComputeTask(message.from, message.data);
  });
  const announce = (alive) => activeTransport.send({ type: 'presence', from: peerId, alive });
  announce(true);
  const timer = setInterval(() => announce(true), announceIntervalMs);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    announce(false);
    unsubscribe();
    if (owned) activeTransport.close();
  };
  globalThis.addEventListener?.('pagehide', stop, { once: true });
  return { kernel, transport: activeTransport, stop };
}

export function startClientDerivationRequester({
  channelName = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  peerId,
  primaryPeerId,
  replicaPeerIds,
  timeoutMs = 30_000,
  staleMs = 1000,
  taskModuleUrl = null,
  transport = null,
  relayUrl = '',
  roomId = null,
  networkManager = null,
  enableWebRtc = true,
  rtcIceServers = [],
  webSocketFactory = null,
  rtcPeerConnectionFactory = null,
  allowedRemoteModules = null,
  allowedRemoteModuleOrigins = null,
  allowLocalFileRemoteModules = false,
  remoteModuleBaseUrl = null
} = {}) {
  const { transport: activeTransport, owned } = createDerivationPeerTransport({
    transport,
    channelName,
    relayUrl,
    roomId,
    peerId,
    networkManager,
    enableWebRtc,
    rtcIceServers,
    webSocketFactory,
    rtcPeerConnectionFactory
  });
  const kernel = new NodeKernel({
    ...buildRemoteModulePolicyConfig({
      allowedRemoteModules,
      allowedRemoteModuleOrigins,
      allowLocalFileRemoteModules,
      remoteModuleBaseUrl
    })
  });
  kernel.nodeId = `requester:${peerId}`;
  kernel.isStarted = true;
  const presence = new Map();
  const unsubscribe = activeTransport.onMessage((message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'presence') {
      presence.set(message.from, { alive: message.alive, at: nowMs() });
      return;
    }
    if (message.to === peerId && message.type === 'compute-result') {
      kernel._handleComputeResult(message.from, message.data);
    }
  });
  kernel.networkManager = {
    sendToPeer: async (to, message) => {
      const reachable = activeTransport.isPeerReachable
        ? activeTransport.isPeerReachable(to)
        : activeTransport.isConnected();
      const seen = presence.get(to);
      if (!reachable || !seen?.alive || nowMs() - seen.at > staleMs) {
        const error = new Error(`client peer ${to} is not present`);
        error.code = 'ERR_CLIENT_PEER_ABSENT';
        throw error;
      }
      const sent = activeTransport.send({ to, from: peerId, type: message.type, data: message.data });
      if (!sent) {
        const error = new Error(`client peer ${to} transport send failed`);
        error.code = 'ERR_CLIENT_PEER_ABSENT';
        throw error;
      }
    }
  };
  const peers = [primaryPeerId, ...replicaPeerIds];
  const placementExecutor = kernel.createRedundantNetworkPlacementExecutor(peers, {
    executorId: `ulg-a6-client:${peers.join(',')}`,
    timeoutMs,
    requestId: 'ulg-a6-client'
  });
  const deltas = [];
  const compute = new ComputeManager({
    enableWorkers: false,
    placementExecutor,
    placementExecutorId: placementExecutor.placementExecutorId,
    placementAdmission: () => ({ accepted: true, reason: 'ulg-a6-client-derivation-peers' }),
    placementTaskSigner: (packet) => ({
      signed: true,
      signerId: 'ulg-a6-client',
      signature: `sig:${packet.taskHash}`,
      signatureAlgorithm: 'ulg-a6-client-signature'
    }),
    placementResultValidator: createRemoteResultQuorumValidator({
      validationId: 'ulg-a6-client-quorum',
      minReplicaCount: 2,
      minMatchingReplicas: 2,
      compareCommitDeltaHash: false
    })
  });
  compute.setCommitDeltaHandler((delta) => deltas.push(delta));
  const lastProvenance = () => compute.getStats().taskPlacement?.lastPlacement?.provenance ?? null;
  const resolvedModuleUrl = taskModuleUrl
    || (globalThis.location?.href
      ? new URL('/src/services/clientWarmDerivationTask.js', globalThis.location.href).href
      : null);
  const submit = (id, data) => compute.submitTask({
    id,
    runtime: 'js',
    taskFamily: 'ulg-client-derivation',
    module: resolvedModuleUrl,
    exportName: 'run',
    data,
    placementHint: {
      requestedPlacement: 'peer',
      recommendedPlacement: 'peer',
      advisoryOnly: false,
      solverKey: `ulg-client-${data?.service ?? 'derivation'}`,
      solverId: 'ulg-client-derivation',
      confidence: 1,
      targetReplicaCount: peers.length,
      peerId: primaryPeerId,
      timeoutMs
    }
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
  let stopped = false;
  return {
    kernel,
    compute,
    deltas,
    presence,
    transport: activeTransport,
    submit,
    submitWithProvenance,
    lastProvenance,
    stop() {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      if (owned) activeTransport.close();
    }
  };
}

/**
 * Live self-discovering A6 PeerCompute client derivation mesh.
 * Supports same-origin BroadcastChannel tabs, cross-machine WebRTC / WebSocket
 * signaling relays, PeerCompute NetworkManager peers, and hybrid meshes.
 * When at least two remote responders are live on a connected transport,
 * `getActiveRequester()` returns a 2-of-2 quorum PeerCompute requester.
 */
export function startLiveClientDerivationPeerMesh({
  channelName = ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL,
  peerId = null,
  nodeId = null,
  timeoutMs = 15_000,
  staleMs = 1500,
  transport = null,
  relayUrl = '',
  roomId = null,
  networkManager = null,
  enableWebRtc = true,
  rtcIceServers = [],
  webSocketFactory = null,
  rtcPeerConnectionFactory = null,
  taskModuleUrl = null,
  announceIntervalMs = 250,
  allowedRemoteModules = null,
  allowedRemoteModuleOrigins = null,
  allowLocalFileRemoteModules = false,
  remoteModuleBaseUrl = null
} = {}) {
  const resolvedPeerId = String(peerId || networkManager?.peerId || `ulg-tab-${Math.random().toString(36).slice(2, 10)}`);
  peerId = resolvedPeerId;
  const normalizedRelayUrl = normalizeRelayUrl(relayUrl);
  const resolvedRoomId = String(roomId || channelName || ULG_LIVE_CLIENT_DERIVATION_PEER_MESH_CHANNEL).trim();
  const hasExplicitCrossMachine = Boolean(
    isTransportObject(transport)
    || normalizedRelayUrl
    || networkManager
    || (transport && transport !== ULG_A6_DERIVATION_TRANSPORT.BROADCAST_CHANNEL)
  );
  if (!hasExplicitCrossMachine && typeof BroadcastChannel !== 'function') return null;

  const resolvedNodeId = nodeId || `client-${peerId}`;
  // Cross-machine transports (WebSocket/WebRTC/NetworkManager) share ONE live
  // connection per mesh; BroadcastChannel keeps per-role channels so same-tab
  // broadcasts deliver across responder/discovery/requester cleanly.
  const shareSingleTransport = hasExplicitCrossMachine;
  const shared = shareSingleTransport
    ? createDerivationPeerTransport({
        transport,
        channelName: resolvedRoomId,
        relayUrl: normalizedRelayUrl,
        roomId: resolvedRoomId,
        peerId,
        networkManager,
        enableWebRtc,
        rtcIceServers,
        webSocketFactory,
        rtcPeerConnectionFactory
      })
    : null;

  const remoteModulePolicy = {
    allowedRemoteModules,
    allowedRemoteModuleOrigins,
    allowLocalFileRemoteModules,
    remoteModuleBaseUrl
  };
  const responder = startClientDerivationResponder({
    channelName: resolvedRoomId,
    peerId,
    nodeId: resolvedNodeId,
    transport: shared?.transport ?? null,
    announceIntervalMs,
    ...remoteModulePolicy
  });
  const discoveryTransport = shared
    ? shared.transport
    : createBroadcastChannelTransport({ channelName: resolvedRoomId });
  const remotePresence = new Map(); // remotePeerId -> { alive, at }
  let activeRequester = null;
  let activePeerSignature = '';
  let stopped = false;

  const pruneAndListRemotePeers = () => {
    const now = nowMs();
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

  const unsubscribeDiscovery = discoveryTransport.onMessage((message) => {
    if (stopped || !message || typeof message !== 'object') return;
    if (message.type !== 'presence' || !message.from || message.from === peerId) return;
    if (message.alive) {
      remotePresence.set(message.from, { alive: true, at: nowMs() });
    } else {
      remotePresence.delete(message.from);
    }
  });

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
      channelName: resolvedRoomId,
      peerId: shareSingleTransport ? peerId : `${peerId}:req`,
      primaryPeerId: peers[0],
      replicaPeerIds: peers.slice(1),
      timeoutMs,
      staleMs,
      taskModuleUrl,
      transport: shared?.transport ?? null,
      ...remoteModulePolicy
    });
    const now = nowMs();
    for (const id of peers) {
      activeRequester.presence.set(id, { alive: true, at: now });
    }
    activePeerSignature = sig;
    return activeRequester;
  }

  function getStatus() {
    const peers = stopped ? [] : pruneAndListRemotePeers();
    const meta = discoveryTransport.getTransportMeta?.() ?? {};
    const connected = !stopped && discoveryTransport.isConnected();
    return Object.freeze({
      active: !stopped,
      transport: meta.transport ?? ULG_A6_DERIVATION_TRANSPORT.BROADCAST_CHANNEL,
      channelName: resolvedRoomId,
      roomId: meta.roomId ?? resolvedRoomId,
      relayUrl: meta.relayUrl ?? (normalizedRelayUrl || null),
      connected,
      peerId,
      nodeId: resolvedNodeId,
      remotePeerIds: Object.freeze(peers),
      remotePeerCount: peers.length,
      quorumReady: connected && peers.length >= 2,
      requesterActive: Boolean(activeRequester),
      webrtcDataChannelPeers: Object.freeze(meta.webrtcDataChannelPeers ?? [])
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
    try { unsubscribeDiscovery(); } catch { /* Already closed. */ }
    if (shared) {
      if (shared.owned) {
        try { shared.transport.close(); } catch { /* Already closed. */ }
      }
    } else {
      try { discoveryTransport.close(); } catch { /* Already closed. */ }
    }
    remotePresence.clear();
  }

  globalThis.addEventListener?.('pagehide', stop, { once: true });
  return Object.freeze({
    peerId,
    nodeId: resolvedNodeId,
    channelName: resolvedRoomId,
    roomId: resolvedRoomId,
    transport: discoveryTransport,
    getActiveRequester,
    getStatus,
    stop
  });
}
