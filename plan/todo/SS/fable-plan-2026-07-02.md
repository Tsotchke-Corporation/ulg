# Fable Plan: SS Checkpoint Then Physics-First

Date: 2026-07-02
Branch: `SS`
Status: Phase 0 landed in `a1e5378`. Phase 1 landed in `320917c` (coupling
operator), `91da8cf` (two-level co-simulation), and `9048d4d` (admitted split
count mutation). The follow-up arc landed in `52362e6` (compaction),
`6fb7462` (orchestration wiring), `d6956d9` (live leader-elected merges +
the allocator-admission capacity fix), `b4f4cb2` (momentum-conserving
merges), `75d266f` (mass-correct splits), `3066994` (thermal averaging +
entity counts), `7c1e1ec` (continuation stability after live coarsening),
and `4575083` (performance: SS overhead noise-level at 1k-8k particles).

The flagship acceptance gate now runs live and stable: steam scenes coarsen
their own particle count through admitted leader-elected merges with mass,
momentum, represented volume, thermal energy (uniform-c), and entity counts
conserved, and the continuation keeps simulating on the merged set.

Multi-level milestone (2026-07-03, slices 12-14, landed in `5a05ae2`,
`d60f043`, `c593cbd`): the two-level coupled step runs over one shared
particle set partitioned by level assignment (level-filtered P2G and
chainable copy-through-filtered G2P), supports subcycled fine substeps with
time-interpolated coarse corrections, excludes shared forces from the
transferred delta (the gravity double-counting hazard - constant-velocity
gates alone cannot see it; the gravity gates now pin every particle to
exactly v0 + g*dt at both substep counts), and runs inside the production
orchestrator as an opt-in observation stage with live compact conservation
telemetry while the resident step keeps state authority.

Authority switch landed (2026-07-03, slices 15-17, `ed3ac39`, `fb86e51`,
`232282f`): the two-level step emits a resident-compatible continuation
envelope, the orchestrator can make it the state authority (synthesized
resident-step-shaped result; mechanics-only, fail-closed against
particle-storage materialization), and the mounted URL-scheduled demo runs
its actual simulation on subcycled two-level mechanics with sim time
advancing and live conservation telemetry.

Motion-gate milestone (2026-07-03): restoring the compact GPU summary
(final-only) on the demo's no-full-readback hot path exposed that every
mounted `ss=1` scene had NEVER actually simulated - sim time advanced while
particle state froze at the initial upload. Root cause: the fused mechanics'
Schroeder "active-node particle filter" (codex-era `17c9de8`) indexed the
COMPACTED active-node list as if its rows were particle-aligned; the
producer writes particle-parallel candidate rows, but compaction re-packs
them tile-aligned, so the filter silently dropped nearly every particle
from P2G and copy-through'd G2P. Fixed by making particle filtering read
particle-parallel LEVEL-ASSIGNMENT rows everywhere (P2G kept its assignment
filter; G2P's filter binding was repurposed from active-node rows to
assignment rows; `runMlsMpmG2pWebGpu` now rejects `schroederActiveNodeList`
outright). Mounted `ss=1`, two-level observation, and two-level
authoritative (substeps 1 and 2) scenes now free-fall analytically
(maxSpeedMPerS = g*t to 4 digits, center of mass dropping, nonzero
maxDisplacementM). The same arc fixed the demo's render options (explicit
surfaceDraw / offscreenPresentation=0 / render-mode menu now override the
auto worker-owned presentation policy), premultiplied-alpha worker-canvas
clears, and gave the two-level authoritative step its own compact summary
as resident diagnostics.

Standing measurement rule learned the hard way: headless probes MUST launch
Chromium with `--use-angle=vulkan` or WebGPU canvas presentation silently
never composites (compute works; screenshots show nothing).

Composition milestone (2026-07-03, `660c168`, `e4ff639`): admitted
merges/splits and the thermal sidecar now run under two-level authority.
The storage chain merges from the step's input configuration and its
adopted buffers supersede the coupled outputs (topology-step precedence,
same as the single-level path); the thermal step runs sequentially on the
combined coupled state and owns the continuation when no adoption
happened. Gated live: the mounted steam scene coarsens 35 -> 27 under
two-level authority with adopted mass matching the coupled grid mass to
<1e-3 relative, and the heated scene's 650K drop cools toward the 300K
bath across chained schedules. The merged-set continuation freeze
(`660d6ce`: empty step.state poisoning the CPU chain, CPU-sized GPU
outputs, render bridge transferring live arrays) is fixed and gated by
the promoted anti-freeze e2e tests.

Next up:

1. **Remaining two-level sidecars**: reaction and pressure-interface
   stages on the authoritative path, at the same sequential insertion
   point as the thermal sidecar (consume thermal output when present,
   coupled outputs otherwise); gate on product-mass / impulse telemetry.
1c. Sparse-grid efficiency follow-up: active-node GRID gating (not particle
   gating) for the fused path, if profiling justifies it.
2. Live split policy: refine-pressure conditions near interfaces/walls in
   scenes (the chain is proven; enabling it in scenes is a policy slice).
3. Native-renderer + replay-mode diagnostic scenes emit repeated AbortError
   refresh failures after count-changing adoption (continuous path is
   unaffected) - triage.
4. The deferred distribution work (portable rematerializer, worker-owned
   adopted storage).

Author: Claude (Fable), taking over from the codex handoff
(`fable-handoff-2026-07-02.md`).

This plan supersedes the "Next Architecture Slice After This One" section of
the handoff. The portable cross-peer rematerializer is explicitly deferred.
Rationale: the SS branch has deep descriptor/admission plumbing but the two
claims that define Schroeder Simulation — multi-level conservative coupling
and volume-driven split/merge — are not implemented yet. More distribution
plumbing on top of unproven physics compounds rework risk.

## Phase 0: Land The Dirty Runtime-Policy Slice (in progress)

Goal: policy-driven SS particle-storage materialization works in a real
mounted scene, honestly telemetered, and committed as a checkpoint.

Findings so far (all confirmed by live-browser probes):

1. **Admission sizing bug (fixed).** The runtime policy sized admissions from
   the CPU-packed scene state and treated the URL row budget as a cap.
   Resident continuation grows the particle count past the packed count, and
   every pipeline stage requires one admitted row per source particle, so the
   fail-closed row checks blocked the whole chain. Fix: the packed count is
   continuation-aware and configured budgets floor at it
   (`sphPhaseScene.js`).
2. **Capacity-vs-count conflation in adoption (fixed).** Storage adoption set
   `authoritativeParticleCount = outputParticleCapacity`, silently growing the
   live particle count to buffer capacity (16 -> 48 with zero admitted
   splits/merges) — violating the plan's own "particle growth <= 1" gate and
   re-blocking the admissions from step 2 of every fused sequence. Fix:
   authoritative count = source count + explicitly admitted split/merge count
   delta (default 0), capacity kept as a separate field
   (`sphMlsMpmGpuStep.js`); unit tests updated to assert the corrected
   semantics.
3. **Worker-lane GPUBuffer leak (fixing now).** With adopted-storage
   continuation bound, the mounted stage-worker lane posts main-thread
   `GPUBuffer` handles inside the lane stage plan to the dedicated stage
   worker: `DataCloneError: GPUBuffer object could not be cloned`. The worker
   publication path then fails and the lane ends `worker-stage-lane-executed`
   instead of `worker-stage-lane-published`. Same-device continuation is only
   valid for main-thread/inline stage execution (which is how the committed
   `afa0e60` proof ran, with `enableWorkers: false`).

Remaining Phase 0 work:

1. In the mechanics stage chain, fail closed explicitly when same-device
   adopted-storage continuation is requested while stage execution is
   worker-lane-owned: do not bind main-thread retained uploads into
   worker-posted payloads; report a dedicated blocked status through chain
   telemetry instead of hanging or half-publishing.
2. Rescope the dirty e2e proof to the honest contract: policy-driven
   materialization, adoption, publication, local resolver readiness, lane
   published, raw-transfer=false, and adopted-storage continuation explicitly
   worker-lane-blocked. Worker-lane *consumption* of adopted storage is
   next-slice work (worker-owned rematerialization), per the existing SS plan
   queue item for worker-owned retained imports.
3. Full validation (`npm test`, targeted Playwright proofs, `git diff
   --check`), plan/log updates, ICC refresh, commit.

## Phase 1: Physics-First Checkpoint (next)

The critique this plan follows: SS slice status conflates scaffolding with
physics; acceptance gates are not tested numerically; sequencing is inverted
(Slices 6-8 driven deep while Slice 4's operator and Slice 5's mutation are
stubs). Phase 1 lands the smallest thing that makes the physics real:

1. **A real adjacent-level conservative coupling operator.** Restriction
   (fine -> coarse) and prolongation (coarse -> fine) of grid quantities
   between two SS levels, as WGSL passes over retained rows. Not more
   candidate/transfer descriptor rows — an operator that moves mass, momentum,
   and internal energy between level grids. New module file
   (`src/runtime/sph/schroederCrossLevelCouplingGpu.js` or similar), not more
   appends to `schroederHierarchyGpu.js` (14.9k lines).
2. **A two-level co-simulation proof with numeric conservation assertions.**
   A browser-scheduled scene where two levels are simultaneously active and
   coupled each step. Compact readback of conservation residuals (already
   allowed by the GPU-first rules) asserted against tolerances:
   `|dMass| < eps`, `|dMomentum| < eps`, constant-velocity-field preservation.
   Pass/fail on numbers, not on descriptor statuses.
3. **One actual admitted split/merge that changes particle count.** Drive one
   admitted merge (or split) through materialization with a nonzero
   `admittedParticleCountDelta` derived from a compact split/merge diagnostic
   readback, and prove live particle count changes by exactly that delta with
   mass conserved. This closes the loop the storage slices left open (slot
   sentinels -> real count mutation).

Acceptance gates for Phase 1 (numeric, not descriptor):

- Two-level step conserves mass to a stated tolerance (compact readback).
- Constant velocity field is preserved across restriction/prolongation.
- An admitted merge reduces particle count by its declared delta with
  conserved mass/represented volume.
- Default hot path remains no-full-readback.

## Deferred (explicitly)

- Portable cross-peer rematerializer (handoff's proposed next slice).
- Worker-owned adopted-storage rematerialization for stage worker lanes.
- Sorted/radix traversal escalation work beyond existing policy telemetry.

These resume after Phase 1 proves the hierarchy physics they would
distribute.
