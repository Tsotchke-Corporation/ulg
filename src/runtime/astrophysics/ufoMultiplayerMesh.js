// Seedable URL Share-Links, PeerCompute Multiplayer UFO Presence/Combat Mesh
// (with Automatic Locked 1.0x Synchronized Network Timescale!), & Kardashev / Von Neumann Progression
// (`src/runtime/astrophysics/ufoMultiplayerMesh.js`)

import { createRelaySignalingTransport } from '../../services/clientDerivationPeers.js';

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
// 2. PeerCompute + BroadcastChannel Multiplayer UFO Presence & Combat Sync
// =========================================================================
export function createUfoMultiplayerMesh({
  peerId = null,
  onWeaponHitLocal = null,
  onRemoteMissile = null,
  onStateChange = null
} = {}) {
  const selfId = peerId || `ufo-${Math.random().toString(36).slice(2, 8)}`;
  const remotePeers = new Map(); // peerId -> { state, lastSeenMs }
  let roomId = null;
  let relayUrl = '';
  let transport = null; // PeerCompute WebSocket + WebRTC DataChannel transport
  let bc = null;        // BroadcastChannel for zero-server same-origin multi-tab multiplayer!
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

  function handleEnvelope(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.from === selfId) return;
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
    } else if (msg.type === 'ufo-hit' && msg.targetPeerId === selfId) {
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
    } else if ((msg.type === 'ufo-leave' || msg.type === 'peer-disconnect') && (msg.from || msg.peerId)) {
      remotePeers.delete(msg.from || msg.peerId);
    }
    emitChange();
  }

  function sendPacket(payload) {
    if (!connected || !roomId) return false;
    const env = { ...payload, from: selfId, roomId, epochAnchorMs };
    let ok = false;
    if (bc) {
      try { bc.postMessage(env); ok = true; } catch {}
    }
    if (transport) {
      try { transport.send(env); ok = true; } catch {}
    }
    if (ok) messagesSent += 1;
    return ok;
  }

  function connect({ room = 'ulg-cosmos-1', relay = '' } = {}) {
    disconnect();
    const cleanRoom = String(room || '').trim();
    if (!cleanRoom) return getStatus();
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
    if (relayUrl) {
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
    emitChange();
    return getStatus();
  }

  function disconnect() {
    if (connected && roomId) {
      sendPacket({ type: 'ufo-leave' });
    }
    connected = false;
    roomId = null;
    relayUrl = '';
    remotePeers.clear();
    if (bc) { try { bc.close(); } catch {} bc = null; }
    if (transport) { try { transport.close(); } catch {} transport = null; }
    emitChange();
    return getStatus();
  }

  function broadcastLocalState(localState, force = false) {
    if (!connected) return;
    const now = Date.now();
    if (!force && now - lastBroadcastMs < 48) return;
    lastBroadcastMs = now;
    // Prune stale peers (> 6 s silent)
    for (const [id, entry] of remotePeers.entries()) {
      if (now - entry.lastSeenMs > 6000) remotePeers.delete(id);
    }
    sendPacket({ type: 'ufo-state', state: localState });
  }

  function sendWeaponHit(targetPeerId, { weapon = 'laser', damage = 8, wavelengthNm = 532 } = {}) {
    if (!connected || !targetPeerId) return false;
    shieldHitsDealt += 1;
    return sendPacket({ type: 'ufo-hit', targetPeerId, weapon, damage, wavelengthNm });
  }

  function broadcastMissileLaunch(missile) {
    if (!connected || !missile) return false;
    return sendPacket({ type: 'ufo-missile', missile });
  }

  function getRemotePeersForContext({ level, bodyId, surfaceActive } = {}) {
    const now = Date.now();
    const out = [];
    for (const [id, entry] of remotePeers.entries()) {
      if (now - entry.lastSeenMs > 6000) {
        remotePeers.delete(id);
        continue;
      }
      const st = entry.state;
      const sameSurface = Boolean(surfaceActive) && Boolean(st.surfaceActive) && (!bodyId || st.bodyId === bodyId);
      const sameSpace = !surfaceActive && !st.surfaceActive && (level == null || st.level === level);
      if (sameSurface || sameSpace) {
        out.push({ peerId: id, ...st });
      }
    }
    return out;
  }

  function getStatus() {
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
      transportKind: transport ? 'peercompute-webrtc+bc' : (bc ? 'broadcast-channel' : 'offline'),
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
    getRemotePeersForContext,
    getStatus,
    get isConnected() { return connected; },
    get timescaleLocked() { return connected; }
  });
}

// =========================================================================
// 3. Playable Kardashev Scale & Self-Replicating Von Neumann Probe Economy
// =========================================================================
export function createKardashevProgressionState() {
  const state = {
    silicatesKg: 120.0,
    volatilesKg: 80.0,
    metalsKg: 90.0,
    exoticsKg: 12.0,
    probes: [],          // { id, bodyId, orbitRadius, angle, inclination, gen, powerW }
    reactorTier: 1,      // 1..5 -> raises max laser power & shield regen
    maxPowerW: 1e10,     // Starts at 10 GW; scales up to 100 TW -> 10^26 W Kardashev II+!
    shieldHp: 100,
    maxShieldHp: 100,
    shieldFlash: 0,
    harvestedPowerW: 1.8e13, // ~Type 0.72 baseline saucer fusion core
    kardashevIndex: 0.725
  };

  function recomputeKardashev() {
    let probePower = 0;
    for (const p of state.probes) probePower += p.powerW;
    state.harvestedPowerW = 1.8e13 * Math.pow(12, state.reactorTier - 1) + probePower;
    // Carl Sagan continuous Kardashev formula: K = (log10(P_watts) - 6) / 10
    state.kardashevIndex = clamp((Math.log10(Math.max(1e6, state.harvestedPowerW)) - 6.0) / 10.0, 0.0, 3.2);
    state.maxPowerW = Math.min(1e14, 1e10 * Math.pow(10, state.reactorTier - 1));
  }

  function addHarvest({ silicates = 0, volatiles = 0, metals = 0, exotics = 0 } = {}) {
    state.silicatesKg += Math.max(0, silicates);
    state.volatilesKg += Math.max(0, volatiles);
    state.metalsKg += Math.max(0, metals);
    state.exoticsKg += Math.max(0, exotics);
  }

  function deployVonNeumannProbe({ bodyId = 'earth', orbitRadius = 2.2, stellarFluxMul = 1.0 } = {}) {
    if (state.metalsKg < 40 || state.silicatesKg < 40) return null;
    state.metalsKg -= 40;
    state.silicatesKg -= 40;
    const probe = {
      id: `vn-${state.probes.length + 1}`,
      bodyId,
      orbitRadius: Math.max(1.4, orbitRadius),
      angle: Math.random() * Math.PI * 2,
      inclination: (Math.random() - 0.5) * 0.75,
      gen: 1,
      replicationProgress: 0,
      powerW: 2.5e14 * Math.max(0.25, stellarFluxMul)
    };
    state.probes.push(probe);
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

  function step(dtSec) {
    const dt = clamp(Number(dtSec) || 0.016, 0, 0.2);
    state.shieldFlash = Math.max(0, state.shieldFlash - dt * 2.6);
    state.shieldHp = Math.min(state.maxShieldHp, state.shieldHp + dt * (2.2 * state.reactorTier));

    // Self-replicating Von Neumann probes harvest raw elements & replicate up to 32 visual swarms (representing exponential fleets!)
    for (let i = 0; i < state.probes.length; i += 1) {
      const p = state.probes[i];
      p.angle += dt * (0.42 + 0.12 * (i % 5));
      p.replicationProgress += dt * 0.035;
      state.metalsKg += dt * 1.4;
      state.silicatesKg += dt * 1.6;
      state.exoticsKg += dt * 0.25;
      if (p.replicationProgress >= 1.0) {
        p.replicationProgress = 0;
        p.powerW *= 1.45;
        if (state.probes.length < 28) {
          state.probes.push({
            id: `vn-${state.probes.length + 1}`,
            bodyId: p.bodyId,
            orbitRadius: p.orbitRadius * (0.94 + Math.random() * 0.14),
            angle: p.angle + 0.5,
            inclination: clamp(p.inclination + (Math.random() - 0.5) * 0.35, -0.9, 0.9),
            gen: p.gen + 1,
            replicationProgress: 0,
            powerW: p.powerW * 0.85
          });
        }
      }
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
    deployVonNeumannProbe,
    upgradeReactor,
    applyDamage,
    step
  };
}
