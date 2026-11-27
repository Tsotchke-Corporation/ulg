# PeerCompute Distributed WAN Stack Operator Runbook

This runbook explains how to run ULG's self-contained **PeerCompute distributed
networking stack** (WebSocket/WSS signaling relay + RFC 5389 STUN + RFC 5766
TURN UDP relay) for multi-window local testing and cross-machine LAN/WAN
sessions.

---

## 1. Architecture Overview

| Component | Module | Role |
|---|---|---|
| **STUN + TURN Relay** | [`src/services/localStunTurnServer.js`](../../src/services/localStunTurnServer.js) | Zero-dependency RFC 5389 STUN (`XOR-MAPPED-ADDRESS`, CRC-32 `FINGERPRINT`) + RFC 5766 TURN (`Allocate` 401/HMAC-SHA1 `MESSAGE-INTEGRITY`, `CreatePermission`, `ChannelBind`, `Send`/`Data` Indications, 4-byte `ChannelData`, ground-truth `getStats()`) |
| **Signaling Relay & `/ice-config`** | [`src/services/localPeerRelayServer.js`](../../src/services/localPeerRelayServer.js) | RFC 6455 room WebSocket/WSS signaling relay + HTTP `/health` + `/ice-config` ICE server advertisement + immediate disconnect goodbye notices |
| **Browser ICE & Diagnostics** | [`src/services/peerIceConfig.js`](../../src/services/peerIceConfig.js) | Query/config ICE parser (`?peerStun=`, `?peerTurn=`, `?peerTurnUser=`, `?peerTurnCred=`, `?icePolicy=all\|relay`), `/ice-config` auto-fetch, and live `RTCPeerConnection.getStats()` active candidate-pair inspection |
| **A6 Derivation Mesh** | [`src/services/clientDerivationPeers.js`](../../src/services/clientDerivationPeers.js) | `NodeKernel` + `ComputeManager` 2-of-2 quorum derivation mesh over WebRTC DataChannels with `pendingIce` buffering & `getIceDiagnostics()` |
| **Disjoint-Slab TreePM** | [`src/services/distributedSpatialPartitioner.js`](../../src/services/distributedSpatialPartitioner.js) | PeerCompute `SpatialTileLeaseBroker` CAS tile leases + fail-closed SHA-256 boundary admission + `connectWebRtcTreePmPeer` / `createWebRtcTreePmPeerCoordinator` |
| **Dev Stack Launcher** | [`scripts/peercompute-wan-dev-stack.mjs`](../../scripts/peercompute-wan-dev-stack.mjs) | One-command CLI starting STUN/TURN + Signaling Relay and printing role URLs |

---

## 2. Quick Start — Single Machine (3+ Browser Windows)

1. Start ULG's Vite HTTPS dev server (on `--host 0.0.0.0` if connecting a second computer):
   ```bash
   npx vite --host 0.0.0.0 --port 5173
   ```
2. In a second terminal, launch the PeerCompute WAN dev stack:
   ```bash
   node scripts/peercompute-wan-dev-stack.mjs --app-url=https://127.0.0.1:5173
   ```
3. Open the printed **Requester**, **Responder**, **Observer**, and optional **Validator** URLs in separate browser windows or incognito profiles.
4. To force **100% TURN relay traffic** even on localhost (simulating symmetric NAT / blocked direct UDP), open the printed **`icePolicy=relay`** URLs or select **`ICE: Force TURN Relay`** in Universes Settings (`PeerCompute Distributed Mesh`) or Studio's `Remote Derivation Peers` drawer.
5. Watch the terminal telemetry line confirm real TURN allocations and relayed traffic:
   ```text
   [peercompute-wan] peers=3 relayMsgs=... stunBindings=... turnAllocs=3/3 relayedPkts=... relayedBytes=...
   ```

---

## 3. Two-Machine LAN / WAN Deployment

1. **Firewall / Ports on Host A:**
   - TCP `5173` — ULG HTTPS app server (or static preview server).
   - TCP `8787` — Signaling WebSocket (`ws://` or `wss://` with `--tls-key` / `--tls-cert`) and `/ice-config`.
   - UDP `3478` — STUN + TURN control port.
   - UDP ephemeral range — per-allocation TURN relay sockets created by `localStunTurnServer.js` (allow UDP loopback/LAN between Host A and Host B, or deploy behind a public IP with `--public-ip=<EXTERNAL_IPV4>`).
2. **TLS Note for Remote HTTPS Origins:**
   - Browsers on Host B visiting `https://<HOST_A_IP>:5173` require `wss://` (mixed-content blocks `ws://` from non-loopback `https://` pages). Pass `--tls-key=... --tls-cert=...` using the same local certificate trusted by Host B, or serve via a reverse proxy (Caddy/nginx) terminating TLS in front of port `8787`.
   - Credentials (`--turn-user`, `--turn-pass`) are strictly scoped to local/dev testing — rotate or replace them with ephemeral HMAC credentials before exposing any TURN relay to the public internet.
3. **Start the Stack on Host A:**
   ```bash
   node scripts/peercompute-wan-dev-stack.mjs \
     --host=0.0.0.0 \
     --public-ip=<HOST_A_LAN_OR_PUBLIC_IP> \
     --relay-port=8787 \
     --turn-port=3478 \
     --app-url=https://<HOST_A_LAN_OR_PUBLIC_IP>:5173
   ```
4. **Join from Host B:**
   Open the printed `2-Machine LAN/WAN` URLs (`responder`, `observer`, `validator`) on Host B. Universes automatically fetches `/ice-config` when `peerRelay` is provided without explicit `peerStun`/`peerTurn` overrides.

---

## 4. Browser Diagnostics Verification

In Browser DevTools (or Playwright tests), inspect live ICE/TURN and lease state:

- **Universes:**
  ```js
  await window.__ulgUniversesDemo.getPeerIceDiagnostics();
  window.__ulgUniversesDemo.getPeerMeshState();
  ```
  Verify `usingTurnRelay: true` and `localCandidateType: "relay"` when `icePolicy=relay` is active.
- **MLS-MPM Studio:**
  Open **Settings → Remote Derivation Peers (A6 WebRTC / STUN / TURN / Signaling Relay)** to configure `peerRelay`, `peerRoom`, `peerStun`, `peerTurn`, `peerTurnUser`, `peerTurnCred`, and `icePolicy`, or launch directly with URL query parameters.

---

## 5. Automated Verification & Honesty Boundary

- **Host unit tests:** `node --test tests/localStunTurnServer.test.mjs` verifies RFC 5389 STUN Binding, RFC 5766 TURN 401/HMAC-SHA1 authentication, `CreatePermission`, `Send`/`Data` Indications, `ChannelBind`/`ChannelData`, `Refresh(0)`, and `/ice-config`.
- **Single-host 3-browser forced-TURN & 5-failure-mode Vulkan/WebRTC suite:**
  ```bash
  env ULG_RUN_NATIVE_WEBGPU=1 node --test --test-concurrency=1 tests/distributedPeerComputeWanStack.native.test.mjs
  ```
  Proves 3 isolated Chromium browser contexts (`requester`, `responder`, `observer`) exchanging GPU TreePM multipoles and A6 tasks strictly through the local TURN relay (`turnServer.getStats().relayedBytes > 0`, `pc.getStats().usingTurnRelay === true`), plus responder mid-graph disconnect failover, duplicate responder quorum disagreement rejection, stale epoch/cache rejection, and missing GPU fence / invalid lease token rejection.
- **Physical 2-machine WAN boundary:** Single-host automated CI proves forced-TURN packet relay across isolated browser contexts on one machine; final physical two-computer WAN verification requires running `scripts/peercompute-wan-dev-stack.mjs` on Host A and opening the printed LAN/WAN URLs on a second physical computer.
