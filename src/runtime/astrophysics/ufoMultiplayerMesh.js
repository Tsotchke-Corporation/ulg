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
  onRemoteCraterStamp = null,
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
    } else if (msg.type === 'ufo-crater-stamp' && msg.from) {
      if (typeof onRemoteCraterStamp === 'function') {
        onRemoteCraterStamp(msg.stamp, msg.from);
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

  function broadcastCraterStamp(stamp) {
    if (!connected || !stamp) return false;
    return sendPacket({ type: 'ufo-crater-stamp', stamp });
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
    broadcastCraterStamp,
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
