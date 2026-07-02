# Fable Plan: SS Checkpoint Then Physics-First

Date: 2026-07-02
Branch: `SS`
Status: Phase 0 landed in `a1e5378`. Phase 1 landed in `320917c` (coupling
operator), `91da8cf` (two-level co-simulation), and `9048d4d` (admitted split
count mutation). Remaining follow-ups: orchestration wiring for the count
summary, free-slot compaction for merges, then the deferred distribution
work.
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
