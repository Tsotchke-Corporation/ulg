# Digest E: older Claude memory notes (2026-07 to 2026-08): traps and structural facts

Sources: `ulg-measure-at-real-horizon`, `ulg-gpu-native-validation`, `ulg-probe-ss-flag`, `ulg-ss-branch-readiness`, `ulg-lane-28-two-quantities`, `ulg-phase-carrier-j-reset`, `ulg-stage-mechanics-tracer`, `ulg-statemanager-no-exactly-once`, `ulg-worker-lane-compact-summary-off`, `ulg-validation-framework-task`, `ulg-adaptive-laws-night1`. Line numbers in these notes date from mid-2026 and may have moved.

## Measurement discipline
- Probe at the scenario's own batch/step budget. The visual matrix runs `standard-iron-ice-quench` at 10 batches x 512 steps; probing at 4x24 gave a confidently wrong "not a regression".
- A git worktree under `/tmp` cannot see `peercompute` (`vite.config.mjs` probes `../` and `../../../../`), so the app reports `simulation blocked` with zero particles while the probe still writes a plausible artifact. Baseline worktrees live beside the main checkout (e.g. `/home/cos/projects/ulg-s9-baseline`).
- Before believing any probe run: assert `'simulation blocked'` is not in statusText, particle count is nonzero, and `maxSpeed != 0` (the probe reports `status: good` for a simulation that never moved).
- GPU-native validation (2026-07-09) supersedes the "CPU reference is the oracle" guardrail in `Agents.md`. CPU paths in this repo frequently do not read the same lanes the shaders do.
- The default `sph-long-horizon-probe.mjs` URL does not set `ss=1`, so it never exercises the Schroeder path. Probe shared-runtime helper changes both ways. A failed batch shows `phase: resident-batch-error` with `error: null`; the message is in `timeline.errors[]`.
- Mechanics lane 28 (`resolvedAbsolutePressurePa`) holds a host-seeded hydrostatic gauge prestress with `ss=0` and the live absolute pressure with `ss=1`. Never compare it across the `ss` flag.
- `?stageMechanicsTrace=1` (`src/runtime/sph/sphStageMechanicsTracer.js`) shows which pipeline stage wrote a mechanics lane. The closure runs thermal -> reaction -> phaseCarrierTransfer -> mechanicsRefresh; the refresh is the LAST writer. Never leave it on in a timing run.
- Three whitelists sit between a new step field and the artifact: `residentStepEnvelope` (`sphMlsMpmGpuStep.js`), the long-horizon probe's field-by-field rebuild, and the synthetic step object when `twoLevelAuthoritative`.
- Diagnostic: C live but det(F) ~ 1 means something downstream renormalizes F's volume (the 2026-07-27 phase-carrier J reset bug, fixed in `420c525`). Keep `let volume_ratio_j = 1.0;` exactly as written (source-text pins).

## SS branch
- SS Slices 0-9 merged to main 2026-07-26. Both blockers claimed in `sol-critic.md` were disproved by measurement (7/7 scenarios good; the "~4x regression" does not exist; the refactor costs ~5%). Do not re-derive blocker status from `sol-critic.md`; read `plan/todo/SS/branch-merge-readiness.md` first.
- FIELD-0 done: the source-local splat is the default render field (3.8 ms vs 24.3 ms dense).
- Dispatch waste: 77.8% of GPU threads dead (19,772 slots for 4,394 live particles, from `appendPhaseCarrierLanes`). Live particles stop being contiguous once a phase transition materialises a companion. (This is the "compaction" item that G4 leaves to A1.)
- General anti-pattern found at eight sites: `writeStorageBuffer(device, label, new Float32Array(N))` uploads zeros into a buffer WebGPU already zeroed.

## PeerCompute StateManager (verified 2026-08-26); the reason G5 exists
- `DataState.commitDelta` is a last-writer-wins upsert (no dedup, no monotonicity, no CAS). ULG uses a stable taskId per stateKey, so only the latest schedule's receipt survives per slot.
- ComputeManager has ONE `commitDeltaHandler` slot; `setCommitDeltaHandler` silently replaces it. Never call it from validation code. The zero-authority tap is the `onAdmission` callback.
- ULG host defaults: `enablePersistence=false`, unique timestamped docName: warm receipts do not survive a page reload.

## Worker lane facts (verified 2026-08-26)
- The 88-float compact summary never executes on the worker lane (`summaryRunner = null` forced). A `compactSummaryMode` value in a receipt is not evidence the summary ran. Enabling a summaryRunner on lane steps disqualifies the exact canonical single-level queue-ordered cleanup path.
- The legacy conservation runners are unreachable on the lane's authoritative route (deliberate fail-closed guard).
- `lane.residentStepOptions` is a sticky merge across schedules: a diagnostic option set once persists until reset.

## Validation framework (user-stated next task as of 2026-08-26; spec `plan/todo/ss-regression.md:70-94`)
- Six receipt families (R1 conservation, R2 2:1 balance, R3 closure, R4 identities/exactly-once, R5 scenario milestones, R6 timings), opt-in and bounded, no hot-loop readbacks, never label architecture liveness as physics validation.
- Template to generalize: the terminal-reflux-receipt pipeline (per-step fixed-size GPU -> MAP_READ ring copy, single mapAsync at the schedule-terminal fence).
- Caching layer is a user requirement; "cached results stay WARN, never silently PASS".
- Scenario name mismatch: the spec says "sodium-bomb, water-cycle, rain, iron/ice" but presets are water-cycle / iron-ice-quench / sodium-water / cesium-fluorine; there is no rain preset.
- Hermes does not know whether this task was absorbed by the seven-goal campaign or is still pending; check `seven-goal-campaign.md`.

## Adaptive laws night 1 (2026-08-27/28, branch `performance`); design `plan/todo/scale-adaptive-law-activation-plan.md`
- bulk-water preset = Tier-0 acceptance scenario: 1k -> 109.9 steps/s, 13.8k -> 104.6, 32.8k -> 83.9, 64k -> 69.4, 103,831 live -> 55.9 steps/s. Yardstick: the user's modified `~/projects/WebGPU-Ocean` does 100k at 120 fps (equal-N gap ~4.3x).
- Landed, all general: consumer gating of capacity-tier constructions (`phaseVolumeSidecarsEnabled`, `mechanicsFieldViewsEnabled`); `ambientPressurePa` as an explicit boundary-condition knob; phase-companion lanes appended only when a phase-mutation path exists at t=0; `lawActivationReceipt` per schedule; `closureRegimeStore` (`src/runtime/closureRegimeStore.js`).
- Traps: the epoch stage payload does not carry mechanics-stage flags; `contactSolver=0` hangs worker admission (KNOWN GAP: the canonical lane cannot run contact-free); never overlap standard-matrix runs with probes.
- Remaining rocks then: contact graph build ~15 ms/step at 104k proving zero contacts; fused kernels ~10 ms at 104k; a validation layer consuming the receipts.
