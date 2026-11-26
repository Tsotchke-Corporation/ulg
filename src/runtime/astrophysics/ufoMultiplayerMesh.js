// Seedable URL Share-Links, PeerCompute Multiplayer UFO Presence/Combat Mesh
// (Real PeerCompute NodeKernel/NetworkManager libp2p+Gossipsub+WebRTC via live relay
//  + instant same-browser BroadcastChannel + optional custom WS relay, with Automatic Locked 1.0x Timescale!),
// & Kardashev / Von Neumann Progression (`src/runtime/astrophysics/ufoMultiplayerMesh.js`)

import { NodeKernel } from '../peercomputeCore.js';
import { createRelaySignalingTransport } from '../../services/clientDerivationPeers.js';

const DEFAULT_PEERCOMPUTE_RELAY_CONFIG_URL = 'https://secretworkshop.net/peercompute/config/relay-config.json';
const DEFAULT_PEERCOMPUTE_RELAY_FALLBACK = Object.freeze({
  bootstrapPeers: Object.freeze([
    '/dns4/secretworkshop.net/tcp/443/wss/p2p/12D3KooWN8PoXAkYjbzTD3SKJGP97peWDE9jFeqqS3ipJsgwDozs',
    '/dns6/secretworkshop.net/tcp/443/wss/p2p/12D3KooWN8PoXAkYjbzTD3SKJGP97peWDE9jFeqqS3ipJsgwDozs'
  ]),
  pubsubType: 'gossipsub',
  gossipsub: Object.freeze({
    D: 8,
    Dhi: 32,
    Dout: 1,
    scoreParams: Object.freeze({
      IPColocationFactorWeight: 0,
      behaviourPenaltyWeight: 0,
      topics: Object.freeze({
        __default: Object.freeze({
          meshMessageDeliveriesWeight: 0,
          meshMessageDeliveriesThreshold: 0,
          meshFailurePenaltyWeight: 0
        })
      })
    })
  }),
  webrtc: Object.freeze({
    iceServers: Object.freeze([
      Object.freeze({ urls: 'stun:stun.l.google.com:19302' }),
      Object.freeze({
        urls: Object.freeze([
          'turn:secretworkshop.net:3478?transport=udp',
          'turn:secretworkshop.net:3478?transport=tcp'
        ]),
        username: 'peer',
        credential: 'compute'
      })
    ]),
    preferDirect: true,
    dropRelayOnDirect: true,
    dropRelayBootstrapOnDirect: true,
    countRelayWebrtcAsDirectCapable: true,
    relayRetention: Object.freeze({ mode: 'logn', min: 1, max: 10 })
  })
});

const NO_FATAL_TRANSPORT_MANAGER = Object.freeze({ faultTolerance: 'no-fatal' });
const PEERCOMPUTE_SCHEDULER_PROFILE = Object.freeze({
  snapshotHz: 20,
  keepaliveMs: 1500,
  snapshotsRequireAuthority: false,
  reliableEventTypes: ['ufo-hit', 'ufo-missile', 'ufo-crater-stamp', 'ufo-leave']
});

function getPeerIdFromMultiaddr(addr) {
  const s = String(addr || '');
  const idx = s.lastIndexOf('/p2p/');
  return idx >= 0 ? s.slice(idx + 5).split('/')[0] : '';
}

function normalizeBootstrapPeers(peers) {
  if (!Array.isArray(peers)) return [];
  const preferSecure = typeof globalThis.location === 'object' && globalThis.location?.protocol === 'https:';
  return peers.filter((a) => typeof a === 'string' && a.trim().length > 0).map((addr) => (
    preferSecure ? addr.replace('/ws/', '/wss/') : addr
  ));
}

async function loadPeerComputeRelayConfig(explicitUrl = '') {
  const tryFetch = async (url) => {
    if (!url || typeof globalThis.fetch !== 'function') return null;
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
      try {
        const res = await globalThis.fetch(url, { cache: 'no-store', ...(ctrl ? { signal: ctrl.signal } : {}) });
        if (res.ok) return await res.json();
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch { /* fall back cleanly */ }
    return null;
  };
  let urlParam = '';
  try {
    if (typeof globalThis.location === 'object' && globalThis.location?.search) {
      const sp = new URLSearchParams(globalThis.location.search);
      urlParam = (sp.get('relayConfigUrl') || sp.get('relayConfig') || '').trim();
    }
  } catch {}
  const targetUrl = String(explicitUrl || urlParam || DEFAULT_PEERCOMPUTE_RELAY_CONFIG_URL).trim();
  const remote = await tryFetch(targetUrl);
  if (remote && Array.isArray(remote.bootstrapPeers) && remote.bootstrapPeers.length > 0) {
    return remote;
  }
  return DEFAULT_PEERCOMPUTE_RELAY_FALLBACK;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// =========================================================================
// 1. Deterministic Universe URL Share-Link Codec
// =========================================================================
export function parseUniverseShareParams(searchStr = '') {
  const sp = new URLSearchParams(String(searchStr || ''));
  const num = (k, def = null) => {
    const v = sp.get(k);
    if (v === null || v === '') return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  return {
    seed: num('seed', null),
    epoch: sp.get('epoch') || null,
    log10SpanM: num('span', null),
    level: num('level', null),
    useSol: sp.has('sol') ? sp.get('sol') === '1' || sp.get('sol') === 'true' : null,
    bodyId: sp.get('body') || null,
    surfaceActive: sp.get('surf') === '1' || sp.get('surf') === 'true',
    pos: sp.has('x') && sp.has('z') ? [num('x', 0), num('y', 28), num('z', 0)] : null,
    yaw: num('yaw', null),
    simTimeS: num('t', null),
    roomId: (sp.get('room') || '').trim() || null,
    relayUrl: (sp.get('relay') || '').trim() || null,
    cockpit: sp.get('cockpit') === '1'
  };
}

export function buildUniverseShareUrl(baseHref, state = {}) {
  const url = new URL(baseHref || 'https://127.0.0.1:5173/universes.html');
  const sp = url.searchParams;
  sp.set('seed', String(Math.trunc(Number(state.seed) || 20261125)));
  if (state.epoch) sp.set('epoch', String(state.epoch));
  if (Number.isFinite(state.log10SpanM)) sp.set('span', Number(state.log10SpanM).toFixed(2));
  if (typeof state.useSol === 'boolean') sp.set('sol', state.useSol ? '1' : '0');
  if (state.bodyId) sp.set('body', String(state.bodyId));
  if (state.surfaceActive) {
    sp.set('surf', '1');
    if (Array.isArray(state.pos) && state.pos.length === 3) {
      sp.set('x', Number(state.pos[0]).toFixed(1));
      sp.set('y', Number(state.pos[1]).toFixed(1));
      sp.set('z', Number(state.pos[2]).toFixed(1));
    }
    if (Number.isFinite(state.yaw)) sp.set('yaw', Number(state.yaw).toFixed(2));
  } else {
    sp.delete('surf'); sp.delete('x'); sp.delete('y'); sp.delete('z'); sp.delete('yaw');
  }
  if (Number.isFinite(state.simTimeS)) sp.set('t', Number(state.simTimeS).toFixed(1));
  if (state.roomId) sp.set('room', String(state.roomId));
  else sp.delete('room');
  if (state.relayUrl) sp.set('relay', String(state.relayUrl));
  else sp.delete('relay');
  return url.toString();
}

// =========================================================================
// 2. PeerCompute NodeKernel (libp2p + WebRTC) + BroadcastChannel Multiplayer UFO Mesh
// =========================================================================
export function createUfoMultiplayerMesh({
  peerId = null,
  onWeaponHitLocal = null,
  onRemoteMissile = null,
  onRemoteCraterStamp = null,
  onStateChange = null
} = {}) {
  const selfId = peerId || `ufo-${Math.random().toString(36).slice(2, 8)}`;
  const remotePeers = new Map(); // peerId -> { peerId, state, lastSeenMs }
  const PEER_STALE_MS = 12000;
  let roomId = null;
  let relayUrl = '';
  let transport = null;      // Optional custom WebSocket signaling relay transport
  let bc = null;             // BroadcastChannel for zero-latency same-origin multi-tab sync
  let pcNode = null;         // Official PeerCompute NodeKernel (libp2p gossipsub + direct WebRTC + STUN/TURN!)
  let pcNet = null;          // NodeKernel NetworkManager
  let pcLibp2p = null;
  let pcPeerId = null;
  let pcRelayPeerIds = [];
  let pcRelayConnected = false;
  let pcDirectPeerCount = 0;
  let pcStatus = 'offline';  // 'offline' | 'connecting' | 'relay-online' | 'p2p-mesh' | 'local-only' | 'error'
  let pcError = null;
  let pcWatchdogTimer = null;
  let latestLocalState = null;
  let connectToken = 0;
  let connected = false;
  let epochAnchorMs = Date.now();
  let lastBroadcastMs = 0;
  let messagesSent = 0;
  let messagesReceived = 0;
  let shieldHitsTaken = 0;
  let shieldHitsDealt = 0;

  const emitChange = () => {
    if (typeof onStateChange === 'function') onStateChange(getStatus());
  };

  function refreshLibp2pCounters() {
    if (!pcLibp2p) {
      pcRelayConnected = false;
      pcDirectPeerCount = 0;
      return;
    }
    const rawConns = pcLibp2p.getConnections?.() || [];
    const list = Array.isArray(rawConns) ? rawConns : Array.from(rawConns.values?.() || []).flat();
    let hasRelay = false;
    const directIds = new Set();
    for (const c of list) {
      const pid = c?.remotePeer?.toString?.() || '';
      if (!pid) continue;
      if (pcRelayPeerIds.includes(pid)) hasRelay = true;
      else directIds.add(pid);
    }
    pcRelayConnected = hasRelay;
    pcDirectPeerCount = directIds.size;
    if (connected && pcNode) {
      pcStatus = pcDirectPeerCount > 0 ? 'p2p-mesh' : (pcRelayConnected ? 'relay-online' : 'connecting');
    }
  }

  function handleEnvelope(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.from === selfId || (pcPeerId && msg.from === pcPeerId)) return;
    if (roomId && msg.roomId && msg.roomId !== roomId) return;
    messagesReceived += 1;
    const now = Date.now();

    if (msg.type === 'ufo-state' && msg.from) {
      remotePeers.set(msg.from, {
        peerId: msg.from,
        state: msg.state || {},
        lastSeenMs: now
      });
      // Synchronize canonical multiplayer epoch anchor to earliest peer clock so all players share one clock!
      if (Number.isFinite(msg.epochAnchorMs) && msg.epochAnchorMs < epochAnchorMs) {
        epochAnchorMs = msg.epochAnchorMs;
      }
    } else if (msg.type === 'ufo-hit' && (msg.targetPeerId === selfId || (pcPeerId && msg.targetPeerId === pcPeerId))) {
      shieldHitsTaken += 1;
      if (typeof onWeaponHitLocal === 'function') {
        onWeaponHitLocal({
          from: msg.from,
          weapon: msg.weapon || 'laser',
          damage: Number(msg.damage) || 8,
          wavelengthNm: msg.wavelengthNm ?? 532
        });
      }
    } else if (msg.type === 'ufo-missile' && msg.from) {
      if (typeof onRemoteMissile === 'function') {
        onRemoteMissile(msg.missile, msg.from);
      }
    } else if (msg.type === 'ufo-crater-stamp' && msg.from) {
      if (typeof onRemoteCraterStamp === 'function') {
        onRemoteCraterStamp(msg.stamp, msg.from);
      }
    } else if ((msg.type === 'ufo-leave' || msg.type === 'peer-disconnect') && (msg.from || msg.peerId)) {
      remotePeers.delete(msg.from || msg.peerId);
    }
    emitChange();
  }

  function sendPacket(payload, { reliable = false } = {}) {
    if (!connected || !roomId) return false;
    const env = { ...payload, from: selfId, roomId, epochAnchorMs };
    let ok = false;
    if (bc) {
      try { bc.postMessage(env); ok = true; } catch {}
    }
    if (transport) {
      try { transport.send(env); ok = true; } catch {}
    }
    if (pcNet && payload.type !== 'ufo-state') {
      try {
        pcNet.queueEvent?.(env, { reliable: Boolean(reliable) });
        ok = true;
      } catch {}
    }
    if (ok) messagesSent += 1;
    return ok;
  }

  async function startPeerComputeMesh(token, cleanRoom, explicitRelayCfgUrl = '', explicitMultiaddr = '') {
    if (typeof globalThis.window === 'undefined' || typeof globalThis.WebSocket !== 'function') {
      pcStatus = 'local-only';
      emitChange();
      return;
    }
    pcStatus = 'connecting';
    pcError = null;
    emitChange();
    try {
      const cfg = await loadPeerComputeRelayConfig(explicitRelayCfgUrl);
      if (token !== connectToken || !connected) return;
      const rawPeers = explicitMultiaddr
        ? [explicitMultiaddr, ...(cfg.bootstrapPeers || [])]
        : (cfg.bootstrapPeers || []);
      const bootstrapPeers = normalizeBootstrapPeers(rawPeers);
      pcRelayPeerIds = bootstrapPeers.map(getPeerIdFromMultiaddr).filter(Boolean);

      const node = new NodeKernel({
        bootstrapPeers,
        enablePersistence: false,
        gameId: 'ulg-universes',
        roomId: cleanRoom,
        maxConnections: 12,
        transportManager: NO_FATAL_TRANSPORT_MANAGER,
        ...(cfg.pubsubType ? { pubsubType: String(cfg.pubsubType).trim().toLowerCase() } : { pubsubType: 'gossipsub' }),
        ...(cfg.gossipsub && typeof cfg.gossipsub === 'object' ? { gossipsub: { ...cfg.gossipsub } } : {}),
        ...(cfg.webrtc && typeof cfg.webrtc === 'object' ? { webrtc: { ...cfg.webrtc } } : {})
      });
      await node.initialize();
      if (token !== connectToken || !connected) {
        try { await node.stop(); } catch {}
        return;
      }
      await node.start();
      if (token !== connectToken || !connected) {
        try { await node.stop(); } catch {}
        return;
      }

      const nm = node.getNetworkManager();
      const libp2p = nm?.getLibp2pNode?.() || null;
      pcNode = node;
      pcNet = nm;
      pcLibp2p = libp2p;
      pcPeerId = node.getStatus?.()?.network?.peerId || null;

      nm.configureScheduler?.(PEERCOMPUTE_SCHEDULER_PROFILE);
      nm.registerStateProvider?.(() => (
        latestLocalState
          ? { ...latestLocalState, selfId, roomId: cleanRoom, epochAnchorMs }
          : { selfId, roomId: cleanRoom, epochAnchorMs, level: 2, surfaceActive: false, pos: [0, 0, 0], yaw: 0 }
      ), { id: 'ufo' });

      nm.addSnapshotHandler?.((peerIdFromNet, message) => {
        if (token !== connectToken || !connected) return;
        const fromNet = message?.header?.peerId || peerIdFromNet;
        if (!fromNet || fromNet === pcPeerId) return;
        const entries = Array.isArray(message?.payload) ? message.payload : [];
        for (const entry of entries) {
          if (!entry || entry.id !== 'ufo' || !entry.data) continue;
          const d = entry.data;
          handleEnvelope({
            type: 'ufo-state',
            from: d.selfId || fromNet,
            roomId: d.roomId || cleanRoom,
            epochAnchorMs: d.epochAnchorMs,
            state: d
          });
        }
      });

      nm.addEventHandler?.((peerIdFromNet, message) => {
        if (token !== connectToken || !connected) return;
        const fromNet = message?.header?.peerId || peerIdFromNet;
        if (!fromNet || fromNet === pcPeerId) return;
        const entries = Array.isArray(message?.payload) ? message.payload : [];
        for (const entry of entries) {
          const payload = entry?.payload;
          if (!payload || typeof payload !== 'object') continue;
          handleEnvelope({ ...payload, from: payload.from || fromNet });
        }
      });

      if (libp2p) {
        libp2p.addEventListener('connection:open', () => {
          if (token !== connectToken || !connected) return;
          refreshLibp2pCounters();
          nm.markStateDirty?.();
          emitChange();
        });
        libp2p.addEventListener('connection:close', () => {
          if (token !== connectToken || !connected) return;
          refreshLibp2pCounters();
          emitChange();
        });
      }

      refreshLibp2pCounters();
      nm.markStateDirty?.();
      try { await nm.redialBootstrapPeers?.(); } catch {}
      refreshLibp2pCounters();
      emitChange();

      pcWatchdogTimer = setInterval(() => {
        if (token !== connectToken || !connected || !pcNet) return;
        refreshLibp2pCounters();
        if (!pcRelayConnected && pcDirectPeerCount === 0) {
          pcNet.redialBootstrapPeers?.().catch(() => {});
        }
        emitChange();
      }, 10000);
    } catch (err) {
      if (token !== connectToken) return;
      pcStatus = 'error';
      pcError = err instanceof Error ? err.message : String(err);
      emitChange();
    }
  }

  function connect({
    room = 'ulg-cosmos-public',
    relay = '',
    relayConfigUrl = '',
    enablePeerCompute = true
  } = {}) {
    disconnect();
    const cleanRoom = String(room || '').trim();
    if (!cleanRoom) return getStatus();
    const token = ++connectToken;
    roomId = cleanRoom;
    relayUrl = String(relay || '').trim();
    epochAnchorMs = Date.now();
    connected = true;

    if (typeof globalThis.BroadcastChannel === 'function') {
      try {
        bc = new globalThis.BroadcastChannel(`ulg-ufo-room:${roomId}`);
        bc.onmessage = (ev) => handleEnvelope(ev.data);
      } catch {
        bc = null;
      }
    }

    const isMultiaddr = relayUrl.startsWith('/') && relayUrl.includes('/p2p/');
    const isCustomWsRelay = /^wss?:\/\//i.test(relayUrl);
    if (isCustomWsRelay) {
      try {
        transport = createRelaySignalingTransport({
          relayUrl,
          roomId: `ulg-ufo-room:${roomId}`,
          peerId: selfId,
          enableWebRtc: true
        });
        transport.onMessage((env) => handleEnvelope(env));
      } catch {
        transport = null;
      }
    }

    if (enablePeerCompute !== false && !isCustomWsRelay) {
      void startPeerComputeMesh(token, roomId, relayConfigUrl, isMultiaddr ? relayUrl : '');
    } else {
      pcStatus = transport ? 'relay-online' : 'local-only';
    }
    emitChange();
    return getStatus();
  }

  function disconnect() {
    connectToken += 1;
    if (pcWatchdogTimer) {
      clearInterval(pcWatchdogTimer);
      pcWatchdogTimer = null;
    }
    if (connected && roomId) {
      sendPacket({ type: 'ufo-leave' }, { reliable: true });
    }
    connected = false;
    roomId = null;
    relayUrl = '';
    latestLocalState = null;
    remotePeers.clear();
    if (bc) { try { bc.close(); } catch {} bc = null; }
    if (transport) { try { transport.close(); } catch {} transport = null; }
    const oldNode = pcNode;
    pcNode = null;
    pcNet = null;
    pcLibp2p = null;
    pcPeerId = null;
    pcRelayPeerIds = [];
    pcRelayConnected = false;
    pcDirectPeerCount = 0;
    pcStatus = 'offline';
    pcError = null;
    if (oldNode) {
      Promise.resolve().then(() => oldNode.stop?.()).catch(() => {});
    }
    emitChange();
    return getStatus();
  }

  function broadcastLocalState(localState, force = false) {
    if (!connected) return;
    latestLocalState = localState ? { ...localState } : latestLocalState;
    const now = Date.now();
    if (!force && now - lastBroadcastMs < 48) return;
    lastBroadcastMs = now;
    // Prune stale peers (> 12 s silent)
    for (const [id, entry] of remotePeers.entries()) {
      if (now - entry.lastSeenMs > PEER_STALE_MS) remotePeers.delete(id);
    }
    if (pcNet) {
      try { pcNet.markStateDirty?.(); } catch {}
    }
    sendPacket({ type: 'ufo-state', state: latestLocalState });
  }

  function sendWeaponHit(targetPeerId, { weapon = 'laser', damage = 8, wavelengthNm = 532 } = {}) {
    if (!connected || !targetPeerId) return false;
    shieldHitsDealt += 1;
    return sendPacket({ type: 'ufo-hit', targetPeerId, weapon, damage, wavelengthNm }, { reliable: true });
  }

  function broadcastMissileLaunch(missile) {
    if (!connected || !missile) return false;
    return sendPacket({ type: 'ufo-missile', missile }, { reliable: true });
  }

  function broadcastCraterStamp(stamp) {
    if (!connected || !stamp) return false;
    return sendPacket({ type: 'ufo-crater-stamp', stamp }, { reliable: true });
  }

  function getAllRemotePeers() {
    const now = Date.now();
    const out = [];
    for (const [id, entry] of remotePeers.entries()) {
      if (now - entry.lastSeenMs > PEER_STALE_MS) {
        remotePeers.delete(id);
        continue;
      }
      out.push({ peerId: id, ...entry.state });
    }
    out.sort((a, b) => String(a.peerId).localeCompare(String(b.peerId)));
    return out;
  }

  function getRemotePeersForContext({ level, bodyId, surfaceActive } = {}) {
    const out = [];
    for (const peer of getAllRemotePeers()) {
      const sameSurface = Boolean(surfaceActive) && Boolean(peer.surfaceActive) && (!bodyId || peer.bodyId === bodyId);
      const sameSpace = !surfaceActive && !peer.surfaceActive && (level == null || peer.level === level);
      if (sameSurface || sameSpace) {
        out.push(peer);
      }
    }
    return out;
  }

  function getStatus() {
    const transportKind = pcNode
      ? (pcDirectPeerCount > 0 ? 'peercompute-p2p+bc' : (pcRelayConnected ? 'peercompute-relay+bc' : 'peercompute-connecting+bc'))
      : (transport ? 'peercompute-webrtc+bc' : (pcStatus === 'connecting' ? 'peercompute-connecting+bc' : (bc ? 'broadcast-channel' : 'offline')));
    return {
      selfId,
      connected,
      roomId,
      relayUrl,
      // Multiplayer strictly locks timescale to canonical 1.0x synchronized epoch time!
      timescaleLocked: connected,
      syncedEpochSec: connected ? (Date.now() - epochAnchorMs) * 0.001 : null,
      remotePeerCount: remotePeers.size,
      remotePeerIds: [...remotePeers.keys()],
      transportKind,
      peerComputeStatus: pcStatus,
      peerComputePeerId: pcPeerId,
      peerComputeError: pcError,
      relayConnected: pcRelayConnected,
      libp2pPeerCount: pcDirectPeerCount + (pcRelayConnected ? 1 : 0),
      messagesSent,
      messagesReceived,
      shieldHitsTaken,
      shieldHitsDealt
    };
  }

  return Object.freeze({
    connect,
    disconnect,
    broadcastLocalState,
    sendWeaponHit,
    broadcastMissileLaunch,
    broadcastCraterStamp,
    getAllRemotePeers,
    getRemotePeersForContext,
    getStatus,
    get isConnected() { return connected; },
    get timescaleLocked() { return connected; }
  });
}

// =========================================================================
// 3. Playable Kardashev I -> II -> III & Multi-System Logistic Von Neumann Fleet
// =========================================================================
const TIER_MAX_POWER_W = Object.freeze([1e12, 1e15, 1e18, 1e22, 1e26]);
const L_SOLAR_W = 3.828e26;

/**
 * Exact closed-form logistic growth step:
 *   N(t + dt) = K / (1 + ((K - N) / max(1, N)) * exp(-r * dt))
 * Strictly bounded by carrying capacity K and overflow-safe from 1 -> 10^12 collectors!
 */
export function advanceLogisticPopulation(N, K, ratePerSec, dtSec) {
  const n0 = Math.max(0, Number(N) || 0);
  const kCap = Math.max(1, Number(K) || 1e9);
  if (n0 <= 0 || dtSec <= 0 || ratePerSec <= 0) return n0;
  if (n0 >= kCap) return kCap;
  const ratio = (kCap - n0) / Math.max(1e-9, n0);
  const eTerm = Math.exp(-Math.min(60, ratePerSec * dtSec));
  return Math.min(kCap, kCap / (1.0 + ratio * eTerm));
}

export function computeDysonOpticalDepth(probeCount, collectorAreaM2 = 1.2e12, swarmRadiusM = 1.496e11) {
  const n = Math.max(0, Number(probeCount) || 0);
  const sphereArea = 4.0 * Math.PI * swarmRadiusM * swarmRadiusM;
  const fCover = clamp((n * collectorAreaM2) / Math.max(1, sphereArea), 0.0, 0.992);
  const tauDyson = -Math.log(Math.max(1e-4, 1.0 - fCover));
  return { fCover, tauDyson };
}

export function createKardashevProgressionState() {
  const state = {
    silicatesKg: 120.0,
    volatilesKg: 80.0,
    metalsKg: 90.0,
    exoticsKg: 12.0,
    probes: [],              // <= 48 visual 3D probes orbiting the active system
    systems: new Map(),      // systemKey -> { systemKey, starPosGal, starLumW, swarmRadiusM, N_probes, K_cap, rGrowth, fCover, tauDyson, dysonPowerW, colonizedAtS }
    colonyLinks: [],         // { fromPosGal, toPosGal, progress } for L1 interstellar expansion arcs!
    totalProbeCount: 0,      // Exact analytic logistic count (1 -> 10^12+!)
    colonizedSystemCount: 0,
    activeSystemKey: 'sol',
    dysonCoveringFrac: 0.0,
    dysonTau: 0.0,
    reactorTier: 1,          // 1..5 -> dynamically lifts weapon power ceiling 1e12 -> 1e26 W!
    maxPowerW: TIER_MAX_POWER_W[0],
    shieldHp: 100,
    maxShieldHp: 100,
    shieldFlash: 0,
    harvestedPowerW: 1.8e13, // ~Type 0.72 baseline saucer fusion core
    kardashevIndex: 0.725,
    kardashevK: 0.725
  };

  function ensureSystemEntry(systemKey = state.activeSystemKey, { starPosGal = [4.8, 0.04, 2.1], starLumW = L_SOLAR_W } = {}) {
    const key = String(systemKey || 'sol');
    let entry = state.systems.get(key);
    if (!entry) {
      entry = {
        systemKey: key,
        starPosGal: Array.isArray(starPosGal) ? [...starPosGal] : [4.8, 0.04, 2.1],
        starLumW: Math.max(0.02 * L_SOLAR_W, Number(starLumW) || L_SOLAR_W),
        swarmRadiusM: 1.496e11,
        N_probes: 0,
        K_cap: 2.5e11, // Full Dyson shell carrying capacity (~2.5e11 1-km^2-equivalent collector swarms)
        rGrowth: 0.095,
        fCover: 0.0,
        tauDyson: 0.0,
        dysonPowerW: 0.0,
        seededNeighbors: false
      };
      state.systems.set(key, entry);
    }
    return entry;
  }

  function recomputeKardashev() {
    let totalProbes = 0;
    let totalDysonPower = 0;
    let colonized = 0;
    for (const sys of state.systems.values()) {
      if (sys.N_probes > 0) {
        colonized += 1;
        totalProbes += sys.N_probes;
        const { fCover, tauDyson } = computeDysonOpticalDepth(sys.N_probes, 1.2e12, sys.swarmRadiusM);
        sys.fCover = fCover;
        sys.tauDyson = tauDyson;
        // Thermodynamic Dyson capture (~42% Carnot conversion + baseline collector power per probe)
        sys.dysonPowerW = sys.starLumW * fCover * 0.42 + sys.N_probes * 2.5e14;
        totalDysonPower += sys.dysonPowerW;
      }
    }
    const activeSys = state.systems.get(state.activeSystemKey);
    state.totalProbeCount = totalProbes;
    state.colonizedSystemCount = colonized;
    state.dysonCoveringFrac = activeSys ? activeSys.fCover : 0.0;
    state.dysonTau = activeSys ? activeSys.tauDyson : 0.0;
    const baseReactorW = 1.8e13 * Math.pow(35, state.reactorTier - 1);
    // Type III SMBH Penrose boost once >= 6 star systems have active Dyson swarms!
    const penroseW = colonized >= 6 ? Math.pow(10, 31 + Math.min(5, colonized * 0.45)) : 0;
    state.harvestedPowerW = baseReactorW + totalDysonPower + penroseW;
    // Carl Sagan continuous Kardashev formula: K = (log10(P_watts) - 6) / 10
    const K = clamp((Math.log10(Math.max(1e6, state.harvestedPowerW)) - 6.0) / 10.0, 0.0, 3.2);
    state.kardashevIndex = K;
    state.kardashevK = K;
    const tierCapW = TIER_MAX_POWER_W[clamp(state.reactorTier - 1, 0, TIER_MAX_POWER_W.length - 1)];
    state.maxPowerW = Math.min(1e26, Math.max(tierCapW, state.harvestedPowerW * 0.25));
  }

  function addHarvest({ silicates = 0, volatiles = 0, metals = 0, exotics = 0 } = {}) {
    state.silicatesKg += Math.max(0, silicates);
    state.volatilesKg += Math.max(0, volatiles);
    state.metalsKg += Math.max(0, metals);
    state.exoticsKg += Math.max(0, exotics);
  }

  function setActiveSystemContext({ systemKey = 'sol', starPosGal = [4.8, 0.04, 2.1], starLumW = L_SOLAR_W } = {}) {
    state.activeSystemKey = String(systemKey || 'sol');
    const entry = state.systems.get(state.activeSystemKey);
    if (entry) {
      if (Array.isArray(starPosGal)) entry.starPosGal = [...starPosGal];
      if (Number.isFinite(starLumW) && starLumW > 0) entry.starLumW = starLumW;
    }
    recomputeKardashev();
  }

  function deployVonNeumannProbe({
    bodyId = 'earth',
    systemKey = state.activeSystemKey,
    starPosGal = [4.8, 0.04, 2.1],
    starLumW = L_SOLAR_W,
    orbitRadius = 2.2,
    stellarFluxMul = 1.0,
    seedCount = 1
  } = {}) {
    if (state.metalsKg < 40 || state.silicatesKg < 40) return null;
    state.metalsKg -= 40;
    state.silicatesKg -= 40;
    const entry = ensureSystemEntry(systemKey, { starPosGal, starLumW });
    entry.N_probes += Math.max(1, Number(seedCount) || 1);
    const probe = {
      id: `vn-${state.probes.length + 1}`,
      bodyId,
      systemKey: entry.systemKey,
      orbitRadius: Math.max(1.4, orbitRadius),
      angle: Math.random() * Math.PI * 2,
      inclination: (Math.random() - 0.5) * 0.75,
      gen: 1,
      replicationProgress: 0,
      powerW: 2.5e14 * Math.max(0.25, stellarFluxMul)
    };
    if (state.probes.length < 48) {
      state.probes.push(probe);
    }
    recomputeKardashev();
    return probe;
  }

  function upgradeReactor() {
    const costM = 80 * state.reactorTier;
    const costE = 10 * state.reactorTier;
    if (state.reactorTier >= 5 || state.metalsKg < costM || state.exoticsKg < costE) return false;
    state.metalsKg -= costM;
    state.exoticsKg -= costE;
    state.reactorTier += 1;
    state.maxShieldHp = 100 + (state.reactorTier - 1) * 45;
    state.shieldHp = state.maxShieldHp;
    recomputeKardashev();
    return true;
  }

  function step(dtSec, { growthTimeMul = 1.0 } = {}) {
    const dt = clamp(Number(dtSec) || 0.016, 0, 0.5);
    const effDt = dt * Math.max(0.1, Number(growthTimeMul) || 1.0);
    state.shieldFlash = Math.max(0, state.shieldFlash - dt * 2.6);
    state.shieldHp = Math.min(state.maxShieldHp, state.shieldHp + dt * (2.2 * state.reactorTier));

    // Advance exact closed-form logistic Von Neumann swarm growth across all colonized star systems!
    const newlySeeded = [];
    for (const sys of state.systems.values()) {
      if (sys.N_probes <= 0) continue;
      const resourceBoost = 1.0 + Math.min(1.5, (state.metalsKg + state.silicatesKg) / 1200.0);
      sys.N_probes = advanceLogisticPopulation(sys.N_probes, sys.K_cap, sys.rGrowth * resourceBoost, effDt);
      const { fCover } = computeDysonOpticalDepth(sys.N_probes, 1.2e12, sys.swarmRadiusM);
      // Launch deterministic interstellar colony seed waves once a Dyson swarm exceeds 25% coverage!
      if (fCover > 0.25 && !sys.seededNeighbors && state.systems.size < 16) {
        sys.seededNeighbors = true;
        const baseIdx = state.systems.size;
        for (let k = 0; k < 2; k += 1) {
          const ang = (baseIdx + k) * 2.39996;
          const rStep = 1.4 + k * 0.9;
          const toPos = [
            sys.starPosGal[0] + Math.cos(ang) * rStep,
            sys.starPosGal[1] + ((k % 2 === 0 ? 1 : -1) * 0.14),
            sys.starPosGal[2] + Math.sin(ang) * rStep
          ];
          const childKey = `colony-${baseIdx + k + 1}`;
          newlySeeded.push({ key: childKey, from: [...sys.starPosGal], to: toPos });
        }
      }
    }
    for (const ns of newlySeeded) {
      const child = ensureSystemEntry(ns.key, { starPosGal: ns.to, starLumW: L_SOLAR_W * 1.15 });
      child.N_probes = Math.max(child.N_probes, 64);
      state.colonyLinks.push({ fromPosGal: ns.from, toPosGal: ns.to, progress: 0.15 });
    }
    for (const link of state.colonyLinks) {
      link.progress = Math.min(1.0, link.progress + dt * 0.25);
    }

    // Visual orbiting 3D probe drones (<= 48 rendered in active system!) + continuous element mining
    const activeSys = state.systems.get(state.activeSystemKey);
    const targetVisualCount = activeSys ? Math.min(48, Math.max(state.probes.length, Math.min(48, Math.floor(Math.log2(1 + activeSys.N_probes) * 2.2)))) : state.probes.length;
    while (state.probes.length < targetVisualCount && state.probes.length > 0 && state.probes.length < 48) {
      const parent = state.probes[state.probes.length - 1];
      state.probes.push({
        id: `vn-${state.probes.length + 1}`,
        bodyId: parent.bodyId,
        systemKey: parent.systemKey,
        orbitRadius: parent.orbitRadius * (0.92 + Math.random() * 0.18),
        angle: parent.angle + 0.55,
        inclination: clamp(parent.inclination + (Math.random() - 0.5) * 0.45, -1.1, 1.1),
        gen: parent.gen + 1,
        replicationProgress: 0,
        powerW: parent.powerW
      });
    }
    for (let i = 0; i < state.probes.length; i += 1) {
      const p = state.probes[i];
      p.angle += dt * (0.42 + 0.12 * (i % 5));
      state.metalsKg += dt * 1.6;
      state.silicatesKg += dt * 1.8;
      state.exoticsKg += dt * 0.35;
    }
    recomputeKardashev();
  }

  function applyDamage(dmg) {
    state.shieldHp = Math.max(0, state.shieldHp - Math.max(0, dmg));
    state.shieldFlash = 1.0;
    if (state.shieldHp <= 0) {
      // Emergency capacitor reboot back to 45% after shield breach flash
      state.shieldHp = state.maxShieldHp * 0.45;
    }
  }

  recomputeKardashev();
  return {
    state,
    addHarvest,
    setActiveSystemContext,
    deployVonNeumannProbe,
    upgradeReactor,
    applyDamage,
    step
  };
}
