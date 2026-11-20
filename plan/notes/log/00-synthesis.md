# The development log and status log: Hermes's synthesis of the reader notes

Sources: reader notes `log/L01.md` to `log/L09.md` (all 45,148 lines of
`plan/log.md`) and `status/S01.md` (`plan/implementation-status.md:1-3781`).
All ten slices passed the checker on 2026-11-17: coverage lines match, and
1,906 verbatim quotes were found at their cited lines. Hermes read every
SUMMARY in full and has not yet read the reading logs under them. Bare numbers
in brackets are `plan/log.md` line numbers as given by the readers. `S02`
(the older half of the status log) is still being read.

## How the two files are laid out

- `plan/log.md` is not in one order. Lines 1-1379 are the campaign record,
  newest first (2026-10-26 back to 09-05). Lines 1381 to about 13,630 are
  June, newest first. From about 13,725 to the end the file runs oldest first,
  from the first prompt (2026-06-05) to 2026-09-05. The 07-02 to 09-04 record
  (GPU-native validation, the spatial refactor, the August work) is therefore
  at lines 37,124-44,847.
- **Nothing is logged for 09-15 to 09-21 or 09-23 to 10-25.** "the
  exact-rational G2 period is unlogged in this file but for 10-26" (L01).
  The status log has the same holes, and neither file has anything after
  10-26. The campaign of 11-03 to 11-17 exists only in `plan/todo/*.md`,
  Claude's notes and the working tree.
- Entries for 07-24 to 08-27 "were reconstructed afterwards" (L09,
  [43331-43334]).

## Direction, in order

| Date | Direction | Replaced |
|---|---|---|
| 06-05 | Triad v0.5: supervised MoonLab/Eshkol workers hand artifacts to PeerCompute's Multiscale demo; target a magnetar (L03) | — |
| 06-06 | Owner, three times: "do not pivot from the core technology to support an SPH demo" (L04 [16848-16851]) | — |
| 06-08 | The SPH phase demo: a sealed box, ice and molten iron, behaviour that must emerge "rather than being faked"; "Core physics first, not a faked demo" (L03 [10451], [10654]) | The 06-06 instruction, by the owner |
| 06-08 to 06-11 | A GPU-resident runtime: CPU only for validation, contracts, UI and closure invalidation. One general derivation engine instead of per-material formulas. A closure-law graph compiled on the CPU and evaluated flat on the GPU (L03) | CPU SPH carrier as the runtime |
| 06-12 | "Authority realignment": PeerCompute NodeKernel/ComputeManager/StateManager is the authority path; laws stay first-class; Eshkol/MoonLab are supervised providers; "multiscale physics is focus/resolution driven"; "plumbing is not complete while physics is visibly broken" (L05 [23685-23708], [24257]) | A ten-phase completion order |
| 06-14 | "Architecture first", on the premise of a working CPU oracle: every law stage becomes a PeerCompute task before any kernel is replaced (L06 [25908], [26450]). The physics worker is created 06-14 21:24 | Atomic-first physics fixes |
| 06-18 | An "Ocean-style" GPU-resident hot loop and renderer; "do not tune code that will be replaced" (L01 [4037]) | Bridge and readback paths |
| 06-22 | "True Adaptive MLS-MPM" (per-particle support radius, split/merge) planned and deferred (L07 [34183]) | — |
| 07-01 | **The SS plan.** First code the same day | The adaptive MLS-MPM todo |
| 07-02 | The "Fable" plan: physics-first SS (a real adjacent-level operator, numeric conservation gates, admitted split/merge) (L08 [37477]) | Contract-first SS work |
| 07-04 | Reference-bank anchoring becomes the default material closure; pure derivation stays behind `strictFirstPrinciplesMaterials` (L08 [39315]) | Pure derivation by default |
| 07-09 | Coherent solids (SOL-0 to SOL-6); **validation is GPU-native**: no CPU mirror solver, no CPU parity gate (L09 [41499-41520]) | CPU oracle and parity |
| 07-13 to 07-21 | SS shared spatial authority: "one canonical GPU membership/sort/unique generation per immutable spatial epoch" with views for every consumer (L09 [42653]) | Per-law queues and bins |
| 08-22 to 08-30 | The SS worker lane; Tier0 beside canonical; reaction activation routing | Page-thread SS |
| 08-31 | The seven goals; the plan archive | The reaction-activation queue |
| 09-04 to 09-13 | G1. Failed and deferred by the owner | — |
| 09-13 to 10-26 | G2 on exact rationals | — |
| 10-27 | "Stop and review first"; integer ledgers | Exact rationals |
| 11-13 to 11-17 | The campaign through G2-G7 and A1-A6, then first-class air | — |

## The owner's rules, with the date each first appears

- General physics. 06-09: "Stop the onesie-twosie per-material derivations —
  we need a GENERAL" engine (L03 [9996]). 06-11: general solutions, "no one
  off patching for specific materials or interactions" (L04 [19547]). 07-10:
  every fix is general, "never a demo or material-pair patch" (L09 [42363]).
- First principles. 06-10: "If any material property does not resolve from
  first principles, that is a bug. This includes compound molecules; cached
  values are allowed, but they must be derived." (L03 [11694-11696]).
- A closure library. 06-11: derived properties persist, "grow into a library,
  invalidate when the generating code changes" (L03 [10987]). The seed of G6.
- Profile first. 06-11: "run a profiler before optimizing" (L04 [19382]).
- Checks. 06-13: the owner called out visual and reactive edits made without
  atomic scientific checks; `npm run test:physics-atomics` came from that
  (L02 [9110]).
- Rendering. 07-03: an "overlay renderer" is "(verboten)". 07-05: only two
  architectures are acceptable, the whole renderer and engine in the worker
  lane or particles copied to the main thread; "One authoritative row source
  per frame" (L08 [39877-39881]). 07-05 and 07-10: fidelity evidence always
  uses the native WebGPU surface renderer and names it.
- Particles. 07-06: "a particle is a fixed quantum of matter, so block volume
  scales with counts" (L09 [40472]). 07-07: MLS-MPM resident is the default
  integrator.
- G1. 09-04: "≥54 visibly advancing presentations per wall-clock second across
  ALL presets including true isosurfaces; UI rAF, solver steps/s and sim time
  are not acceptance" (L09 [44533]). 09-06: "42 Hz is far better than the
  original ~1 Hz"; keep it "without relaxing the agreed target" (L01 [1312]).
- Cost. 09-14 and 10-26: a token-cost concern bounds the work to verification;
  it is "not a narrower definition of success" (S01 `:86-87`).
- The owner has reported z-buffer and draw-order faults since 06-14, each time
  "note for later and keep working" (L06). The 11-15 report is the same fault,
  five months on.

## SS history from the log

- **07-01 (Codex).** Far field built as six passes in
  `schroederHierarchyGpu.js`: aggregate candidate traversal with a
  Barnes-Hut-style opening ratio, force summaries, StateManager-admitted force
  deltas, fusion after G2P, read-only radiation/plasma/gas consumer rows.
  "Evidence for all six is host-only"; "no GPU run is cited" (L01
  [1400-1409]). The rule: "local incompressibility, reaction, contact and
  interface laws stay exact-near; far-field consumers must declare error bounds
  before mutating" (L01 [1576]). The decision whether to promote one consumer
  to a real state path is "still open" (L01 [1413]). Also law-queue gates,
  law-neighbour candidates, render LOD proxies, `ss=1`.
- **07-02 (Codex).** The `schroeder-particle-storage` authority family and the
  adopted-storage chain, same-device only.
- **07-02 to 07-03 (Fable).** `schroederCrossLevelCouplingGpu.js`: "2:1
  restriction (floor(index/2) parent), delta-form prolongation, a coarse
  boundary-band mask, and subcycling with shared-force (gravity) exclusion";
  the two-level step; observation mode by default, authoritative opt-in;
  thermal and reaction by sequential operator splitting (L08). "An N-level
  chain inherits these rules." Raw velocity-copy prolongation was rejected.
- **07-02 to 07-05.** Live split and merge: leader-elected merges that conserve
  momentum, temperature, entity count and centroid; divide-mass split;
  oscillation guard and hysteresis. Left unfinished: "the boiling scene creates
  mass ... because two topology epochs in one batch do not chain"; "Live splits
  are gated off"; "Mass that migrates beyond the simulated level window is
  copied through and frozen"; the one-level-per-epoch clamp "was reverted three
  times" (L08 [39819-39840], [38807-38886]). "This is the recorded motive for
  more levels."
- **About 07-09.** Two-level mechanics defaulted off; third level on hold
  (L09 [41902], [42543]).
- **07-13 to 07-21.** The shared spatial authority refactor (`ss/03`). Slice 7:
  a 4,097-leaf Morton-prefix hierarchy, aggregate invariants, stackless far
  traversal, r = 1..4 receipts. Measured: "authoritative two-level r=2 costs
  +147% p50 over single-level; reaction ~364-369 ms, spatial-epoch generation
  61-63 ms, derived views ~44 ms" (L09 [43132-43142]).
- **07-24.** Thermal traversal through the tree measured and rejected: the
  source-cell route was 1.196× slower on the composite and 2.7× on the sparse
  fixture. "The direct exact-cell directory stays the only production thermal
  traversal; a later thermal-tree adoption is a new gated task" (S01
  `:2808-2875`).
- **08-27/28.** "an unfinished V1→V2 directory consumer migration made every
  canonical step roll back silently while time advanced; every canonical rate
  before 08-28 is invalid" (L09 [43368-43386]). After the fix: "Canonical ~85
  vs ss=0 fused ~5.7k steps/s at 32.8k particles, 45-67x". "The visible-rate
  ceiling is the canonical route itself" [43439].
- **08-28 to 08-30.** Reaction activation routing (`ss/05`). Its limits in the
  status log: "the watcher proves fixed carrier slots, not Tier1 Schroeder
  aggregate-node law authority"; "execution never returns to dormant" (S01
  `:2751`, `:2293`).
- **09-04 to 09-13.** Cs/F on the two-level route "rejects on fine-field
  velocity from fine/coarse momentum exchange"; tiny-mass fine nodes (1.76
  micrograms, +162.6 m/s per fine step) fail nodal CFL "while particles stay
  bounded". Fixed by interval refinement, never by "dt/ratio tweaks, floors or
  bypass" (S01 `:2137-2166`).
- One line from 07-09 that anticipates November: "sub-cell steam bubbles need
  'the finer SS level'" (L09 [41929-41933]).

## The honesty record (why the owner distrusts green tests)

- "mounted SS scenes were frozen from Codex commit `17c9de8` until 07-03", with
  status, count and sim-time gates all green (L08 [38366-38385]).
- "the flagship 'coarsening' was deletion until 07-05" [39690].
- "Split/merge conservation is now complete" and "multi-level milestone is
  complete" were both written while scenes were frozen (L08).
- 06-15: "Every manual frame inspection ... but one found the visible physics
  wrong while the architecture slices passed" (L06).
- 06-19: a "good" native result retracted as "superseded false positives"
  (L07). 08-27: the silent-rollback rates above.
- L08's conclusion: "Only displacement, first-moment and per-epoch mass gates
  found the truth."

## What the log adds to each goal and track

- **G1.** The September rates were "presentation-only extrapolation (a GPU
  velocity sidecar capped at one source interval and one field cell) between
  physics sources that arrived at 0.2-0.8 states/s on isosurface presets and
  about every 2.6 s on iron" (S01 `:1893-1900`, `:1915`, `:1128`). So even the
  five presets near 54 were showing extrapolated frames around roughly one
  physics state per second. G1 was scoped "with no real-time-physics
  requirement"; that requirement is A1's.
- **A1.** 06-14: batching commands into one submission "gained nothing";
  dispatching only the active grid cut a 64-substep fence from 13.44 s to
  3.02 s (L06). 07-18: `dispatchWorkgroupsIndirect` costs about 0.25 ms each
  (L09 [43349]). The canonical route was 45-67× slower than the fused `ss=0`
  route in August.
- **G2.** "the same two failures from 07-10 to 09-05: steam does not rise or
  condense, hydrogen does not rise" (L09). 06-10: "Pure vapour is nearly
  invisible until a derived condensation/nucleation droplet closure exists; the
  hard-coded steam scatter was removed as fake" (L03 [11460]). The energy
  budget of the scene, 06-08: the iron's ~864 MJ melts all the ice (~382 MJ)
  but cannot boil it all (~2,835 MJ) (L03 [10490]).
- **G4.** Law groups were switchable per run from June (URL `law*`); per-node
  gating first appears as SS law-queue masks on 07-01; routing authority exists
  for reactions only, and "the log forbids generalizing it" without its own
  authority contract (L09 [44117-44122]).
- **G5, A6.** PeerCompute task graphs, remote placement, quorum smoke tests and
  warm-service ideas date from 06-12 to 06-17; they were proven "only in
  in-memory tests" (L06 [26958]). The magnetar handoff "stopped at smoke
  execution, blocked" (L04).
- **G6, A4.** The loop "domain-exit → invalidate → rederive → re-register"
  was written on 06-08 to 06-11 (L03 [10706-10723]).
- **A2.** "nothing on incremental membership repair"; the storage chain "redoes
  its full propose/materialize work every step" (L08 [38749]).
- **A3.** L08 infers that live coarsening of coherent bulk into merged
  particles was "the first representative-sample mechanism".

## Residue the readers flagged for the code read (to verify)

- CPU physics still on disk and partly wired: `mlsMpmCarrier.js`,
  `sphPhaseCarrier.js` (imported at `sphPhaseDemo.js:49`), CPU gas-cell EOS in
  `sphPhaseDemo.js`, `cpu-reference` in 28 source files, `src/main.js:122`.
- Hard numeric clamps in mechanics: G2P `J` at most 64 and condensed `J` within
  `1 ± 0.005` (`sphG2pGpuKernel.js:178-179`).
- A "provisional activation threshold" for reactions; a class rule for alkali
  metal + gaseous halogen; `reactionDiscovery.js:683` branching on
  `active-metal-water-hydroxide`; sodium and cesium presets requesting the
  authoritative reaction route.
- A hand-written kinematic free-surface relaxation in the CPU SPH carrier,
  added 06-15 "to make a gate pass".
- Global artificial viscosity 0.04, which "is not physical water viscosity";
  a "universal near-gray IR estimate 0.9".
- The pressure-interface force built from render rows, "gated, not deleted".
