# Digest B: campaign timeline and project orientation

Sources: Claude memory note `ulg-seven-goal-campaign-state.md` (last modified 2026-11-16 06:51, so it stops before the first-class-air work) and `plan/project-orientation.md` (2026-07-25). Figures are Claude's.

## What the project is (plan/project-orientation.md)
- ULG = Universal Law Graph runtime. Macroscopic behaviour is activated, not implemented ("the graph never calls makeStar()").
- Three hard rules from the v0.4 Star Spec:
  1. No material property is primitive (resolved from active microscopic dynamics, or derived and cached as a response closure, or imported with explicit provenance/validity/uncertainty; the third must never be labelled emergent).
  2. No named phenomenon emerges without the substrate that can generate it.
  3. Schroedinger is foundational for ordinary electronic matter, not universal.
- A closure without a validity envelope is invalid by default.
- Four repos: `ulg` (law graph, carrier runtime, WebGPU physics, three.js demo); `peercompute` (orchestration authority); `eshkol` (derives/compiles laws, closures, derivatives); `moonlab` (quantum/many-body response).
- Integration rule: PeerCompute remains the orchestration authority. Exactly one authoritative owner per mutable state family at a time. The ULG scene is not a scheduler.
- SS (Schroeder Simulation) is the architectural direction. Law Adapter Contract at `plan/todo/SS/schroeder-tree-and-algorithm-plan.md:129`; modes `sameLevelMpm`, `crossLevelConservative`, `nearExactPairs`, `farAggregate`, `bulkCoarsen`, `surfaceRefine`, `renderLod`. Specified, not enforced as a type; see `plan/ss-law-architecture-assessment.md`.
- Load-bearing rules:
  1. GPU-native validation supersedes CPU parity (2026-07-09). No CPU mirror solver, no CPU parity gate, no CPU-owned hot state, no readback/reupload boundaries. Read back only fixed-size evidence.
  2. Add laws, never remove or demote one.
  3. Physics cadence is independent of render cadence.
  4. Boundary conditions are physics inputs (never silently 0 K / empty / disabled).
  5. Validate physics before tuning visuals.
  6. Epistemic discipline: `scientificValidation=false` / `fullPhysicsValidation=false` are load-bearing; status vocabulary is Runtime, Oracle, Reduced, Kernel suite, Metadata only, Missing (`plan/solver-law-inventory.md`).
- Design docs: `peercompute/plan/refs/ulg/ULG_PeerCompute_Star_Spec_v0.4.md`; `plan/todo/SS/schroeder-tree-and-algorithm-plan.md`; `plan/todo/sol-critic.md` (active architecture correction, Priority 0A-6); `plan/solver-law-inventory.md`; `Agents.md`.

## Campaign timeline (reordered oldest first)
- 08-30 to 09-14: Codex drove ulg under ICC umbrella task `ulg-seven-goals-and-architecture`. User paused 2026-09-14.
- Canonical roadmap: `plan/todo/seven-goal-campaign.md`. `plan/STATUS.md` and `plan/todo/README.md` were stale (claimed G1 met).
- Order: G2 -> G7, then A1-A6 by dependency, then reassess G1.
- G1 (>= 54 Hz visible on all 6 presets): FAILED/deferred by the user 09-13 ("wait for the architectural follow-on tasks"). At ~60 Hz rAF water-cycle and iron never reached 54. Codex's two-preset narrowing was never approved. 09-28: G1 is *delayed* until architecture makes it feasible, not finished.
- Publication hold from 09-01: "finish goal one before merging/pushing/building". Local commits are a separate question; authorized 10-24 for specific commits.
- 09-14: room air + nuclei approved for G2. Environment T/P/RH/nuclei must be configurable in the UI with real consumers.
- 10-24: user resumed full-scope G2 (a bounded-error f32 model needs explicit approval).
- 10-27: Codex's exact-rational path (R2xx-R327) never completed one Iron Ice step; every loss was Xid 109. User: "Stop and review first". Claude proposed `plan/todo/g2-integer-ledger-proposal.md`: exact integer mass + signed integer energy ledger; physics stays f32; momentum not ledgered. Pass budget: ledgers add at most 2 compute passes per step. Phase 0 PASSED.
- 10-27 evening, user answers Q1-Q4: momentum stays f32; exact energy budget with recorded sources; exact-rational disabled, not deleted (`46971c0`, `ROOM_AIR_EXACT_MASS_DECLARED = false`); Q4 = NEW SCOPE: plumes must run near real time (dt 0.5 ms means 2,000 steps/s).
- "please stop any work for now" means: stop the background probe, close its browser, leave edits uncommitted.
- 10-27 review: option A reframed as A' = no separate or preset-scoped route; generalize the canonical worker lane's fused Tier0 path to carry active laws. Order: (1) undo the presentation-hold regression, (2) contact admission per the selective-contact plan, (3) sidecar fusion guarded by a law descriptor, ledgers built in.
- 10-27 night: full read of all code and the dev log with 93 sub-agent slices (ICC task `ulg-full-code-and-log-review-20261027`). Verdict: new Step 0 baseline check; larger decoupling and fusion scope; contact first; a >= 1,000 steps/s every-law gate these steps cannot reach.
- 11-13, user: "defer architectural work until we reach the correct phase. and at least finish out this goal first"; "yes move it to A1, allow dt 1 ms". So G2 first; near-real-time moved to A1; A' Steps 1-3 and the steps/s gate deferred to A1 and G4. Longer recordings NOT approved (milestone cap applies). Design rule: no new per-step host fences or readbacks. "skip the commit".
- 11-14: G2 ledger Phases 0-6 done except the Iron Ice plume. G3 delivered (f32). G4 dormancy wired. G5, G6, G7 delivered. A6 delivered in the client. A1 slices 1-2 (Iron Ice 6.0 -> 19.5 steps/s). User: G2 stays OPEN until A5 ("therefore 2").
- 11-15: G2 Iron Ice plume criterion MET at dt 0.5 ms and 1 atm (steam rises, 0 rollbacks over 3 s). Memory leak fixed. water-realtime is REAL TIME by default (1.11 sim-s/s at ~44 fps: implicit pressure at 8 ms, real-time pacing, pipelined Tier-0 boundaries). G4 exact dormancy is the DEFAULT on all presets (water-cycle 41 -> 76 steps/s, sodium-water 34 -> 41; step-300 fingerprints bit-identical on Iron Ice, sodium-water, water-cycle; cesium-fluorine is nondeterministic even ungated, no hash gate). 14 of 28 indirect dispatch sites converted.
- 11-15 evening, USER DECISIONS: G2 "Keep the heat proxy" (do not switch the ledger route to reference thermochemistry without asking again). Eshkol larger dt: "Start, 1% error budget" (derived coarse-dt pressure/stress update with a validity envelope and an exact sub-step fallback; accept only where measured error vs exact small-dt runs stays within 1% for energy, momentum, positions).
- 11-16, USER DECISIONS: G4 eps > 0 allowed as opt-in only (`thermalDormancyK=<eps>`, receipt says `exact: false`); G2: build a gauge-consistent heat proxy (built: `sphReactionHeatProxyGauge.js`, 4 host tests); A6 cross-host: not now.
- 11-16 CORRECTION: Iron Ice is ~19 steps/s at 0.5 ms (0.0095 sim-s/s, ~105x from real time). The 42-49 steps/s figures were dropped work (see submit-completion-readback).

## Estimates Claude gave the user (2026-11-15)
G1 ~35% (deferred), G2 ~90%, G3/G5/G6/G7 ~95%, G4 ~70%, A1 ~20% then ~40% after water-realtime, A2 ~50% (parked by evidence), A3/A4 ~60% (not wired live), A5 ~30% (SOL-3 only), A6 ~85% (cross-host needs a go-ahead).

## Open items named in this note
- G4: per-schedule receipt; compaction (A1).
- A1: contact-owner speed, near-real-time; the empty-coarse two-level robustness item.
- `.icc/assistant-goals.yaml` statuses are stale (nearly all "todo"). Do not trust ICC's top recommendation.
- Never push, merge or build Pages without the user.
