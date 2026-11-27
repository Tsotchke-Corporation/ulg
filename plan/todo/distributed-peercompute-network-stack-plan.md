# Distributed PeerCompute Network Stack Test Plan

Date: 2026-06-14 AKDT

> **2026-11-27 Live-Code Status (`feat/post-1-0-all-four-tracks` Track 4 — Self-Contained STUN/TURN/ICE WAN Stack):**
> - **Implemented & Verified on Single-Host 3-Browser Forced-TURN:** Zero-dependency RFC 5389 STUN + RFC 5766 TURN UDP relay server (`src/services/localStunTurnServer.js`), browser ICE/STUN/TURN config & `RTCPeerConnection.getStats()` path diagnostics (`src/services/peerIceConfig.js`), full ICE/TURN/policy/role (`requester`, `responder`, `observer`, `validator`) plumbing across `clientDerivationPeers.js`, `distributedSpatialPartitioner.js`, Universes (`universes.html`, `ulgUniversesPhysics.js`, `ulgUniversesDemo.js`), and MLS-MPM Studio (`ulgSimStudioModel.js`, `ulgSimStudioApp.js`, `sphPhaseDemoMount.js`, `sphPhaseScene.js`), one-command dev stack CLI (`scripts/peercompute-wan-dev-stack.mjs`), and operator runbook ([`plan/todo/peercompute-wan-runbook.md`](peercompute-wan-runbook.md)).
> - **Verified Automated Proofs:** `tests/localStunTurnServer.test.mjs` (RFC 5389 STUN + RFC 5766 TURN auth/Send/Data/ChannelData/Refresh) + `tests/distributedPeerComputeWanStack.native.test.mjs` (3 isolated Chromium browser contexts with forced `iceTransportPolicy: 'relay'` proving `turnServer.getStats().relayedBytes > 0` & `pc.getStats().usingTurnRelay === true`, plus all 5 failure modes: forced TURN relay, responder mid-graph disconnect failover, duplicate responder disagreement quorum rejection, stale epoch/cache rejection, and missing GPU fence / invalid lease token commit block).
> - **Honesty Boundary (Open):** Physical two-computer WAN validation requires launching `scripts/peercompute-wan-dev-stack.mjs` on Host A and opening the printed LAN/WAN URLs from a second physical computer.

## Purpose

Stand up a full local PeerCompute networking environment on this machine once
the resident law graph, state-seed, cache/admission, and worker-stage contracts
are stable enough to make distributed failures meaningful.

This is intentionally late in the todo order. Running three browser windows
across two computers is valuable for acceptance testing, but it should not
drive the architecture before single-node authority, state ownership, and
visual/atomic physics gates are solid.

## Target Stack

- WSS relay for browser/libp2p traffic.
- STUN for peer reflexive candidate discovery.
- TURN for relay fallback when direct peer paths fail.
- ICE configuration surfaced through PeerCompute/NodeKernel startup options.
- Local multi-window and multi-computer launch scripts with explicit room,
  peer id, role, and authority mode.
- Diagnostics for connection state, relay/TURN use, task placement, StateManager
  sync, GPU lane ownership, cache admission, and accepted deltas.

## Required Work

1. Inventory PeerCompute's existing relay/libp2p startup hooks and current
   browser WSS test harness.
2. Add a local dev stack config for WSS relay plus STUN/TURN services, with
   credentials scoped to local testing.
3. Add NodeKernel browser configuration for ICE servers and multi-peer roles:
   requester, responder, observer, and redundant validator.
4. Add a three-window/two-computer smoke:
   - one requester submits a non-advisory graph;
   - one responder executes allowed work;
   - one observer receives StateManager warm-state convergence;
   - cache artifacts and state seeds remain admitted through NodeKernel/
     StateManager;
   - remote GPU refs never masquerade as local leases.
5. Add failure-mode smokes:
   - direct path unavailable, TURN relay used;
   - responder disconnects mid-graph;
   - duplicate responders disagree;
   - stale cache artifact rejected;
   - missing GPU fence blocks commit.
6. Add operator docs for running the stack on this machine and connecting
   multiple browsers/computers.

## Acceptance Gates

- The stack can run on this machine and connect at least three browser windows
  across two computers.
- Distributed task placement, StateManager sync, cache admission, and hot-buffer
  refresh telemetry are visible in the browser diagnostics.
- Representative ULG visual scenarios still pass the dense visual matrix after
  distributed execution is enabled.
- No remote result can mutate authoritative ULG state without NodeKernel/
  StateManager admission and matching GPU fence/lease evidence.
