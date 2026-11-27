#!/usr/bin/env node
// Local / LAN / WAN PeerCompute Dev Stack CLI (`scripts/peercompute-wan-dev-stack.mjs`)
//
// Starts ULG's self-contained:
//   1. RFC 5389 STUN + RFC 5766 TURN UDP relay server (`src/services/localStunTurnServer.js`)
//   2. RFC 6455 HTTP/WS (or HTTPS/WSS with --tls-cert/--tls-key) signaling relay
//      serving `/health` and `/ice-config` (`src/services/localPeerRelayServer.js`)
//
// Prints copy-pasteable URLs for:
//   - Single-machine multi-window testing (127.0.0.1)
//   - Two-machine LAN/WAN testing (auto-detected LAN IPv4 or `--public-ip=...`)
//   - All 4 PeerCompute roles: requester, responder, observer, validator
//   - Both `icePolicy=all` (direct + STUN + TURN) and `icePolicy=relay` (forced TURN)

import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import { createLocalStunTurnServer } from '../src/services/localStunTurnServer.js';
import { createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';

function parseArgs(argv) {
  const out = {
    host: '0.0.0.0',
    publicIp: '',
    relayPort: 8787,
    turnPort: 3478,
    appUrl: 'https://127.0.0.1:5173',
    room: 'ulg-wan-mesh-v1',
    turnUser: 'ulg-dev',
    turnPass: 'ulg-local-turn-pass',
    realm: 'ulg.peercompute.local',
    tlsKey: '',
    tlsCert: '',
    statsIntervalMs: 10_000,
    selfTestMs: 0
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (!arg.startsWith('--') || eq < 0) continue;
    const k = arg.slice(2, eq);
    const v = arg.slice(eq + 1);
    if (k === 'host') out.host = v;
    else if (k === 'public-ip') out.publicIp = v;
    else if (k === 'relay-port') out.relayPort = Number(v);
    else if (k === 'turn-port') out.turnPort = Number(v);
    else if (k === 'app-url') out.appUrl = v.replace(/\/+$/, '');
    else if (k === 'room') out.room = v;
    else if (k === 'turn-user') out.turnUser = v;
    else if (k === 'turn-pass') out.turnPass = v;
    else if (k === 'realm') out.realm = v;
    else if (k === 'tls-key') out.tlsKey = v;
    else if (k === 'tls-cert') out.tlsCert = v;
    else if (k === 'stats-interval-ms') out.statsIntervalMs = Number(v);
    else if (k === 'self-test-ms') out.selfTestMs = Number(v);
  }
  return out;
}

function detectLanIpv4() {
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    for (const info of entries || []) {
      if (info && info.family === 'IPv4' && !info.internal && info.address) {
        return info.address;
      }
    }
  }
  return '127.0.0.1';
}

function buildRoleUrl({ appBase, page, relayUrl, room, role, stunUrl, turnUrl, turnUser, turnPass, icePolicy }) {
  const u = new URL(`${appBase}/${page}`);
  u.searchParams.set('peerRelay', relayUrl);
  u.searchParams.set('peerRoom', room);
  if (role) u.searchParams.set('peerRole', role);
  if (stunUrl) u.searchParams.set('peerStun', stunUrl);
  if (turnUrl) u.searchParams.set('peerTurn', turnUrl);
  if (turnUser) u.searchParams.set('peerTurnUser', turnUser);
  if (turnPass) u.searchParams.set('peerTurnCred', turnPass);
  if (icePolicy && icePolicy !== 'all') u.searchParams.set('icePolicy', icePolicy);
  return u.href;
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.help) {
    console.log([
      'ULG PeerCompute WAN Dev Stack (WSS/WS Signaling Relay + RFC 5389 STUN + RFC 5766 TURN)',
      '',
      'Usage:',
      '  node scripts/peercompute-wan-dev-stack.mjs [options]',
      '',
      'Options:',
      '  --host=0.0.0.0             Bind address for relay & STUN/TURN sockets',
      '  --public-ip=<IPv4>         Advertised IPv4 for remote machines (default: auto LAN IP)',
      '  --relay-port=8787          WebSocket signaling + HTTP /health & /ice-config port',
      '  --turn-port=3478           UDP STUN + TURN port',
      '  --app-url=https://...      Base URL of running Vite/ULG server',
      '  --room=ulg-wan-mesh-v1     Default mesh room ID',
      '  --turn-user=ulg-dev        Local TURN long-term credential username',
      '  --turn-pass=...            Local TURN long-term credential password',
      '  --tls-key=<path>           Optional TLS private key for HTTPS/WSS signaling',
      '  --tls-cert=<path>          Optional TLS certificate for HTTPS/WSS signaling',
      '  --stats-interval-ms=10000  Telemetry log interval (0 disables)',
      '  --self-test-ms=0           Auto-exit cleanly after N ms (for smoke tests)'
    ].join('\n'));
    return;
  }

  const advertisedIp = cfg.publicIp || (cfg.host === '127.0.0.1' ? '127.0.0.1' : detectLanIpv4());
  const tls = cfg.tlsKey && cfg.tlsCert
    ? { key: fs.readFileSync(cfg.tlsKey), cert: fs.readFileSync(cfg.tlsCert) }
    : null;

  const stunTurn = await createLocalStunTurnServer({
    host: cfg.host,
    port: cfg.turnPort,
    relayAddress: advertisedIp,
    realm: cfg.realm,
    username: cfg.turnUser,
    password: cfg.turnPass
  });

  const iceConfig = Object.freeze({
    iceServers: stunTurn.getIceServers(),
    iceTransportPolicy: 'all',
    stunConfigured: true,
    turnConfigured: true
  });

  const relay = await createLocalPeerRelayServer({
    host: cfg.host,
    port: cfg.relayPort,
    tls,
    iceConfig
  });

  const wsScheme = tls ? 'wss' : 'ws';
  const httpScheme = tls ? 'https' : 'http';
  const localRelayUrl = `${wsScheme}://127.0.0.1:${relay.port}`;
  const lanRelayUrl = `${wsScheme}://${advertisedIp}:${relay.port}`;
  const lanAppUrl = cfg.appUrl.replace('127.0.0.1', advertisedIp).replace('localhost', advertisedIp);

  console.log('========================================================================');
  console.log(' ULG PeerCompute WAN Dev Stack Ready (Signaling Relay + STUN + TURN)');
  console.log('========================================================================');
  console.log(` Signaling Relay (local) : ${localRelayUrl}`);
  console.log(` Signaling Relay (LAN)   : ${lanRelayUrl}`);
  console.log(` Relay /health           : ${httpScheme}://${advertisedIp}:${relay.port}/health`);
  console.log(` Relay /ice-config       : ${httpScheme}://${advertisedIp}:${relay.port}/ice-config`);
  console.log(` STUN URL                : ${stunTurn.stunUrl}`);
  console.log(` TURN URL                : ${stunTurn.turnUrl}`);
  console.log(` TURN Credentials (dev)  : user="${cfg.turnUser}" pass="${cfg.turnPass}" realm="${cfg.realm}"`);
  console.log('------------------------------------------------------------------------');
  console.log(' 1-Machine Multi-Window (Universes — Auto Direct + TURN):');
  for (const role of ['requester', 'responder', 'observer', 'validator']) {
    console.log(`   [${role.padEnd(9)}] ${buildRoleUrl({
      appBase: cfg.appUrl,
      page: 'universes.html',
      relayUrl: localRelayUrl,
      room: cfg.room,
      role,
      stunUrl: stunTurn.stunUrl,
      turnUrl: stunTurn.turnUrl,
      turnUser: cfg.turnUser,
      turnPass: cfg.turnPass,
      icePolicy: 'all'
    })}`);
  }
  console.log('------------------------------------------------------------------------');
  console.log(' 1-Machine Forced-TURN Proof (icePolicy=relay — verifies TURN bytes > 0):');
  for (const role of ['requester', 'responder', 'observer']) {
    console.log(`   [${role.padEnd(9)}] ${buildRoleUrl({
      appBase: cfg.appUrl,
      page: 'universes.html',
      relayUrl: localRelayUrl,
      room: `${cfg.room}-turn`,
      role,
      stunUrl: stunTurn.stunUrl,
      turnUrl: stunTurn.turnUrl,
      turnUser: cfg.turnUser,
      turnPass: cfg.turnPass,
      icePolicy: 'relay'
    })}`);
  }
  console.log('------------------------------------------------------------------------');
  console.log(` 2-Machine LAN/WAN (Open on Machine B pointing at ${advertisedIp}):`);
  for (const role of ['responder', 'observer', 'validator']) {
    console.log(`   [${role.padEnd(9)}] ${buildRoleUrl({
      appBase: lanAppUrl,
      page: 'universes.html',
      relayUrl: lanRelayUrl,
      room: cfg.room,
      role,
      stunUrl: stunTurn.stunUrl,
      turnUrl: stunTurn.turnUrl,
      turnUser: cfg.turnUser,
      turnPass: cfg.turnPass,
      icePolicy: 'all'
    })}`);
  }
  console.log('------------------------------------------------------------------------');
  console.log(' MLS-MPM Studio A6 Remote Quorum URL:');
  console.log(`   [studio   ] ${buildRoleUrl({
    appBase: cfg.appUrl,
    page: 'index.html',
    relayUrl: localRelayUrl,
    room: `${cfg.room}-studio`,
    role: '',
    stunUrl: stunTurn.stunUrl,
    turnUrl: stunTurn.turnUrl,
    turnUser: cfg.turnUser,
    turnPass: cfg.turnPass,
    icePolicy: 'all'
  })}&preset=water-realtime&studio=1`);
  console.log('========================================================================');

  let statsTimer = null;
  if (cfg.statsIntervalMs > 0) {
    statsTimer = setInterval(() => {
      const ts = stunTurn.getStats();
      const rs = relay.getStats();
      console.log(
        `[peercompute-wan] peers=${rs.connectedPeers} relayMsgs=${rs.totalMessagesRelayed} `
        + `stunBindings=${ts.stunBindingRequests} turnAllocs=${ts.activeAllocations}/${ts.turnAllocations} `
        + `relayedPkts=${ts.relayedPackets} relayedBytes=${ts.relayedBytes} `
        + `chDataIn=${ts.channelDataFramesIn} chDataOut=${ts.channelDataFramesOut}`
      );
    }, cfg.statsIntervalMs);
    statsTimer.unref?.();
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (statsTimer) clearInterval(statsTimer);
    await relay.close();
    await stunTurn.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (cfg.selfTestMs > 0) {
    setTimeout(() => { void shutdown(); }, cfg.selfTestMs);
  }
}

main().catch((err) => {
  console.error('[peercompute-wan] fatal:', err);
  process.exit(1);
});
