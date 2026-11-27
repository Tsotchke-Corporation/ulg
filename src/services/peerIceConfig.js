// Browser-Safe PeerCompute ICE / STUN / TURN Configuration & Live `RTCPeerConnection.getStats()`
// Path Diagnostics (`src/services/peerIceConfig.js`).

export const ULG_PEER_ICE_CONFIG_SCHEMA = 'peercompute.ulg.peer-ice-config.v1';

export function normalizeIceTransportPolicy(policy) {
  return String(policy || '').trim().toLowerCase() === 'relay' ? 'relay' : 'all';
}

export function buildBrowserIceConfiguration({
  stunUrls = [],
  turnUrls = [],
  turnUsername = '',
  turnCredential = '',
  iceServers = null,
  iceTransportPolicy = 'all'
} = {}) {
  const servers = [];
  if (Array.isArray(iceServers)) {
    for (const entry of iceServers) {
      if (!entry || !entry.urls) continue;
      const urls = (Array.isArray(entry.urls) ? entry.urls : [entry.urls])
        .map((u) => String(u || '').trim())
        .filter(Boolean);
      if (!urls.length) continue;
      const item = { urls: Object.freeze(urls) };
      if (entry.username) item.username = String(entry.username);
      if (entry.credential) item.credential = String(entry.credential);
      servers.push(Object.freeze(item));
    }
  }
  const cleanStun = (Array.isArray(stunUrls) ? stunUrls : String(stunUrls || '').split(','))
    .map((u) => String(u || '').trim())
    .filter(Boolean);
  if (cleanStun.length > 0) {
    servers.push(Object.freeze({ urls: Object.freeze(cleanStun) }));
  }
  const cleanTurn = (Array.isArray(turnUrls) ? turnUrls : String(turnUrls || '').split(','))
    .map((u) => String(u || '').trim())
    .filter(Boolean);
  if (cleanTurn.length > 0) {
    const turnItem = { urls: Object.freeze(cleanTurn) };
    if (turnUsername) turnItem.username = String(turnUsername);
    if (turnCredential) turnItem.credential = String(turnCredential);
    servers.push(Object.freeze(turnItem));
  }
  const policy = normalizeIceTransportPolicy(iceTransportPolicy);
  return Object.freeze({
    schema: ULG_PEER_ICE_CONFIG_SCHEMA,
    iceServers: Object.freeze(servers),
    iceTransportPolicy: policy,
    stunConfigured: servers.some((s) => s.urls.some((u) => u.startsWith('stun:'))),
    turnConfigured: servers.some((s) => s.urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:')))
  });
}

/**
 * Parse STUN/TURN/ICE URL query parameters (`?peerStun=`, `?peerTurn=`,
 * `?peerTurnUser=`, `?peerTurnCred=`, `?icePolicy=all|relay`).
 */
export function resolvePeerIceConfigFromSearch(search = '') {
  const sp = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || '').startsWith('?') ? String(search).slice(1) : String(search || ''));
  const stunRaw = sp.get('peerStun') || sp.get('stun') || '';
  const turnRaw = sp.get('peerTurn') || sp.get('turn') || '';
  const turnUser = sp.get('peerTurnUser') || sp.get('turnUser') || '';
  const turnCred = sp.get('peerTurnCred') || sp.get('turnCred') || '';
  const policy = sp.get('icePolicy') || sp.get('iceTransportPolicy') || 'all';
  return buildBrowserIceConfiguration({
    stunUrls: stunRaw,
    turnUrls: turnRaw,
    turnUsername: turnUser,
    turnCredential: turnCred,
    iceTransportPolicy: policy
  });
}

/**
 * Derive HTTP `/ice-config` endpoint from a signaling WebSocket URL (`ws://` -> `http://`, `wss://` -> `https://`)
 * and fetch the relay's published STUN/TURN server list when available.
 */
export async function fetchRelayIceConfig(relayUrl, { fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  if (!relayUrl || typeof fetchImpl !== 'function') return null;
  try {
    const u = new URL(String(relayUrl).trim());
    u.protocol = u.protocol === 'wss:' ? 'https:' : (u.protocol === 'ws:' ? 'http:' : u.protocol);
    u.pathname = '/ice-config';
    u.search = '';
    u.hash = '';
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const resp = await fetchImpl(u.href, ctrl ? { signal: ctrl.signal } : {});
      if (!resp.ok) return null;
      const json = await resp.json();
      return buildBrowserIceConfiguration(json);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Inspect a live `RTCPeerConnection` via `pc.getStats()` to report exact
 * active ICE candidate pair type (`host`, `srflx`, `prflx`, `relay`),
 * whether traffic is traversing a TURN relay, RTT, and byte counts.
 */
export async function collectPeerConnectionIceDiagnostics(pc) {
  if (!pc || typeof pc.getStats !== 'function') {
    return Object.freeze({
      available: false,
      connectionState: pc?.connectionState ?? 'unknown',
      iceConnectionState: pc?.iceConnectionState ?? 'unknown',
      usingTurnRelay: false,
      localCandidateType: null,
      remoteCandidateType: null,
      localAddress: null,
      remoteAddress: null,
      bytesSent: 0,
      bytesReceived: 0,
      currentRoundTripTimeMs: null
    });
  }
  try {
    const report = await pc.getStats();
    const byId = new Map();
    let selectedPair = null;
    report.forEach((stat) => {
      byId.set(stat.id, stat);
      if (stat.type === 'transport' && stat.selectedCandidatePairId) {
        selectedPair = stat.selectedCandidatePairId;
      }
    });
    let pair = selectedPair ? byId.get(selectedPair) : null;
    if (!pair) {
      report.forEach((stat) => {
        if (stat.type === 'candidate-pair' && (stat.nominated || stat.selected || stat.state === 'succeeded')) {
          if (!pair || stat.nominated || stat.selected) pair = stat;
        }
      });
    }
    const localCand = pair?.localCandidateId ? byId.get(pair.localCandidateId) : null;
    const remoteCand = pair?.remoteCandidateId ? byId.get(pair.remoteCandidateId) : null;
    const localType = localCand?.candidateType ?? null;
    const remoteType = remoteCand?.candidateType ?? null;
    const usingTurnRelay = localType === 'relay' || remoteType === 'relay';
    return Object.freeze({
      available: true,
      connectionState: pc.connectionState ?? 'unknown',
      iceConnectionState: pc.iceConnectionState ?? 'unknown',
      usingTurnRelay,
      localCandidateType: localType,
      remoteCandidateType: remoteType,
      localAddress: localCand?.address ?? localCand?.ip ?? null,
      remoteAddress: remoteCand?.address ?? remoteCand?.ip ?? null,
      protocol: localCand?.protocol ?? null,
      bytesSent: Number(pair?.bytesSent ?? 0),
      bytesReceived: Number(pair?.bytesReceived ?? 0),
      currentRoundTripTimeMs: Number.isFinite(Number(pair?.currentRoundTripTime))
        ? Number((Number(pair.currentRoundTripTime) * 1000).toFixed(2))
        : null
    });
  } catch {
    return Object.freeze({
      available: false,
      connectionState: pc?.connectionState ?? 'unknown',
      iceConnectionState: pc?.iceConnectionState ?? 'unknown',
      usingTurnRelay: false,
      localCandidateType: null,
      remoteCandidateType: null,
      bytesSent: 0,
      bytesReceived: 0,
      currentRoundTripTimeMs: null
    });
  }
}
