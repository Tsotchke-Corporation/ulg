#!/usr/bin/env node
/**
 * Local PeerCompute Distributed Network Stack Launcher (Phase 11).
 *
 * Stands up the local WebSocket/WSS signaling relay + ICE (STUN/TURN) config
 * endpoint and prints ready-to-open multi-window / cross-machine URLs for
 * Requester, Responder, and Observer browser peers.
 */
import fs from 'node:fs';
import { buildPeerComputeIceConfig, createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';

const host = process.env.ULG_PEER_RELAY_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.ULG_PEER_RELAY_PORT || '8787', 10) || 8787;
const room = process.env.ULG_PEER_ROOM || 'ulg-distributed-lab';
const appOrigin = process.env.ULG_APP_ORIGIN || 'https://fastbox.tail5c077c.ts.net:5173';
const certPath = process.env.ULG_TLS_CERT || '';
const keyPath = process.env.ULG_TLS_KEY || '';
const tls = certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
  : null;

const iceConfig = buildPeerComputeIceConfig({
  stunUrls: (process.env.ULG_STUN_URLS || 'stun:stun.l.google.com:19302').split(','),
  turnUrls: process.env.ULG_TURN_URLS ? process.env.ULG_TURN_URLS.split(',') : [],
  turnUsername: process.env.ULG_TURN_USERNAME || '',
  turnCredential: process.env.ULG_TURN_CREDENTIAL || '',
  iceTransportPolicy: process.env.ULG_ICE_POLICY || 'all'
});

const relay = await createLocalPeerRelayServer({ host, port, tls, iceConfig });
const publicRelayUrl = process.env.ULG_PUBLIC_RELAY_URL || relay.url.replace('0.0.0.0', '127.0.0.1');
const encodedRelay = encodeURIComponent(publicRelayUrl);
const encodedRoom = encodeURIComponent(room);

console.log(`PeerCompute ULG Distributed Relay listening on ${relay.url}`);
console.log(`Health: ${relay.healthUrl}`);
console.log(`ICE Config: ${JSON.stringify(relay.iceConfig)}`);
console.log('');
console.log('Open across 3 browser windows or 2+ machines:');
console.log(`  Requester:  ${appOrigin}/?preset=iron-ice-quench&peerRelay=${encodedRelay}&peerRoom=${encodedRoom}&peerRole=requester`);
console.log(`  Responder1: ${appOrigin}/?peerRelay=${encodedRelay}&peerRoom=${encodedRoom}&peerRole=responder`);
console.log(`  Observer:   ${appOrigin}/universes.html?level=6&peerRelay=${encodedRelay}&peerRoom=${encodedRoom}&peerRole=observer`);

process.on('SIGINT', async () => {
  await relay.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await relay.close();
  process.exit(0);
});
