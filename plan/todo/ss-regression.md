# SS UI and Scheduling Regression

Date: 2026-08-23 AKDT
Updated: 2026-08-25 AKDT
Status: architecture correction implemented; physics validation is the next
formal validation-framework todo

## Disposition

The original P0 scheduling regression is corrected in the current
`ss-worker-lane-refactor` working tree. Eligible same-device interactive SS now
uses a worker-owned resident WebGPU lane by default, with explicit
ComputeManager lease and StateManager commit authority. Explicit ownership
overrides and capability failures remain fail-closed.

The original failure mode was not slow GPU arithmetic. SS kernels ran on the
GPU, but the page thread owned hierarchy/epoch construction, command authoring,
schedule publication, presentation gating, status traversal, and one-step
continuation. That destroyed preset batching and made renderer latency control
physics cadence.

## Acceptance mapping

- **Canonical SS is not direct scene-owned:** the ordinary route publishes
  `residentComputeManagerMode = 'worker-owned-resident-lane'`.
- **Valid batching without stale epochs:** each worker step creates and seals a
  fresh epoch; schedule identity must advance and fail-closes on regression.
- **UI and compositor decoupled:** continuation follows worker schedule
  completion, while versioned render candidates independently feed
  presentation.
- **Explicit authority:** each schedule completes a ComputeManager resident-lane
  lease and commits a compact StateManager delta before page publication.
- **Hierarchy layer communication:** one exact spatial-epoch transaction is
  authenticated and handed from epoch generation to same-level mechanics;
  compact hierarchy status crosses back to presentation.
- **No redundant materialization:** seed rows cross once, static thermal and
  mechanics tables upload once per lane, and the exact resident product owner
  carries forward.
- **Pipeline startup:** the full mechanical descriptor set prewarms concurrently
  on lane admission and is awaited to a truthful settled summary.
- **High concurrency:** one lane rejects overlapping mutation, while independent
  lane leases are not globally serialized and share the ordered device queue.
- **Readback discipline:** the normal hot loop performs no full particle
  readback; presentation uses worker-retained candidates and compact summaries.
- **Responsive browser evidence:** the durable Chromium/WebGPU harness observes
  advancing sim time during pointer drag and zero measured main-thread long
  tasks on both explicit and default sodium-bomb worker routes.

Do not weaken these properties by increasing timeouts, reusing an immutable
epoch across positions, inventing lineage, admitting a sentinel readback as the
required queue fence, or counting GPU-only timing as interactive throughput.

## Current sodium-water live evidence

The literal headed sodium-water acceptance run on 2026-08-25 completed two
consecutive 64-step schedules on the same retained worker lane and device. Each
schedule placed non-authoritative shared-queue drains at steps 16, 32, and 48,
then reached its sole authority-admitting terminal drain at step 64. All eight
drains completed through `worker-device.queue.onSubmittedWorkDone`;
ComputeManager completed both leases, StateManager committed cumulative totals
64 then 128, all 128 candidate frames rendered, and no fallback or device loss
appeared.

A post-commit retained-state snapshot contained positive NaOH and H2 carrier
mass in the expected reaction ratio, proving endpoint conversion into real
mechanics carriers rather than sidecar-only accounting. The H2 carriers had
negative mean vertical velocity at 0.128 s, so this architecture receipt is
deliberately not promoted to sustained-plume or full-physics validation.

## Next formal validation-framework todo: physics

Architecture liveness is not a physics proof. Add a separate formal validation
layer that consumes compact worker receipts and bounded diagnostic arms without
putting readbacks into the normal hot loop.

Required initial receipts:

1. Mass, momentum, and energy conservation across single- and two-level steps,
   with explicit tolerances and authority lineage.
2. Exact 2:1 cross-level transfer and phase-volume migration balance, including
   split/merge and storage materialization generations.
3. Thermal, phase-change, gas-pressure, and reaction-product closure over
   bounded reference scenarios.
4. Monotonic epoch/source-family identities and exactly-once StateManager
   admission across schedule boundaries.
5. Scenario milestone receipts for sodium-bomb, water-cycle, rain, and
   iron/ice, correlated with compositor motion and guarded by an early
   no-progress watchdog.
6. Separate timings for resident GPU work, worker orchestration, authority
   commit, presentation latency, and accepted/presented step cadence.

These should be opt-in native or bounded validation runs where readback is
scientifically necessary. They must not silently change production execution
or label architecture-only liveness as full physics validation.

## Separate follow-ons

- Incremental strict TypeScript/JSDoc control-plane typing: discriminated
  lifecycle unions, branded lineage/device/buffer identifiers, and single-source
  WGSL ABI layouts.
- Selective contact-law admission based on interface, kinematic, scale, and
  settledness predicates.
- Algorithmic improvement to the sweep admission rate beneath the already
  chunked matching cleanup.

See `plan/refactor/handoff.md` for implementation details and current evidence.

## Superseded baseline (retained for evidence provenance)

<details>
<summary>Original regression/refactor snapshot before this completion pass</summary>

# SS UI and Scheduling Regression

Date: 2026-08-10 AKDT
Status: P0 for default enablement; accepted post-merge debt for the contained,
default-off merge only

## Merge disposition

The device-resident ComputeManager/worker-lane correction is intentionally
deferred to the dedicated post-merge refactor. This does not downgrade the
issue for default enablement: the acceptance criteria below remain P0 before
paired-v2 or the reworked SS route can become the ordinary default.

For the current contained/default-off merge, the debt is nonblocking only when
all of the following remain true on the exact candidate source:

- independent-v2 remains the ordinary route and paired-v2 remains explicit
  opt-in;
- the bounded four-demo autoplay gate completes every demo in less than ten
  minutes with correlated compositor motion and its no-progress watchdog;
- the interactive presentation receipt passes without a readback, `mapAsync`,
  or an awaited host queue fence;
- cached interactive cadence and low-N throughput remain explicit WARN results,
  never silently promoted to PASS; and
- the post-merge refactor retains this file as the acceptance contract rather
  than increasing timeouts or weakening the workloads.

## Executive finding

The current Schroeder Simulation (SS) path is not running its GPU kernels as
JavaScript on the browser main thread, but most of the surrounding hot-path
work is main-thread-owned. Canonical SS execution explicitly bypasses the
ComputeManager worker route and uses the scene's `direct-schroeder-scene`
path. Hierarchy and epoch construction, pipeline and bind-group setup, command
encoding, queue submission orchestration, execution publication, presentation
gating, status generation, and DOM updates therefore contend with input and
rendering on the page thread.

This is partly pre-existing architectural debt and partly a current regression.
The direct SS scene path predates the present worktree. The current worktree,
however, forces SS scheduling to one resident step per schedule. That defeats
the sodium preset's intended 128-step batching and amortization. Every physics
step now pays a new schedule/epoch lifecycle and is serialized through RAF and
native-presentation handoff before the next step may begin.

## Primary evidence

- `src/visualization/sphPhaseScene.js` excludes requested Schroeder execution
  from its ComputeManager task branch and publishes the resulting execution as
  `residentComputeManagerMode = 'direct-schroeder-scene'`.
- `src/visualization/sphPhaseDemoMount.js` currently resolves every enabled SS
  resident schedule to exactly one step, including requests from presets that
  ask for a larger batch.
- `src/runtime/sphPhaseScenarioPresets.js` still requests 128 resident steps
  per sodium schedule specifically to amortize submission and cross the early
  contact horizon. The new one-step normalization makes that setting
  ineffective.
- Resident continuation is coupled to `requestAnimationFrame` and native
  presentation proof/handoff. Renderer latency therefore directly controls
  when the next SS physics epoch may be scheduled.
- `renderStatus()` and warning/status updates execute repeatedly in the
  resident lifecycle. `renderStatus()` traverses extensive runtime and scene
  state, constructs a large multiline report, and writes DOM text even though
  this work is not part of the physical solve.
- Standard visual execution uses main-thread render ownership, so presentation
  encoding and compositor bridge publication share the same page thread as SS
  orchestration.
- `src/runtime/webgpuComputeLayout.js` still creates compute pipelines through
  synchronous `device.createComputePipeline()`. Cold compilation of the large
  mechanical-owner entry point can freeze the page independently of steady
  state execution.
- A bounded sodium run reported about 19.7 ms of resident GPU execution
  (roughly 51 GPU steps/s), while end-to-end progress was about 199 steps over
  60 seconds (roughly 3.3 steps/s). The discrepancy points to scheduling,
  presentation, compilation, and main-thread lifecycle overhead rather than
  raw GPU kernel time.

## Required architectural correction

1. Restore amortization without reusing an immutable SS generation across an
   invalid position epoch. The solution must preserve the one-position-epoch
   correctness contract while avoiding a full page-thread lifecycle for every
   individual step.
2. Move SS epoch preparation and command-authoring work off the interactive UI
   path, preferably into a worker-owned resident WebGPU lane with explicit
   StateManager/ComputeManager admission.
3. Decouple physics continuation from compositor presentation proof. Physics
   should publish versioned render candidates without waiting for a visible
   frame before it can schedule the next valid epoch.
4. Remove `renderStatus()` and warning construction from the per-step hot path.
   Sample compact telemetry at a bounded cadence and perform no expensive DOM
   work while the relevant UI is hidden.
5. Create/prewarm the mechanical owner pipeline asynchronously before the
   first interactive submission. A cache hit is useful, but synchronous cold
   pipeline construction must not block page responsiveness.
6. Measure GPU execution, page-thread orchestration, presentation latency, and
   end-to-end accepted-step cadence separately. Do not classify a fast GPU
   timestamp as a fast interactive simulation.

## Candidate refactor: strict TypeScript control plane

Treat a strict TypeScript migration as a candidate part of the post-merge SS
refactor, focused first on the JavaScript control plane and CPU/GPU contract
boundaries rather than on mechanically renaming the whole tree. High-value
targets are:

- discriminated unions for resident scheduling, generation ownership,
  submission, presentation, and fail-closed terminal states;
- branded identifiers for generations, devices, buffers, materials, phases,
  steps, byte offsets, word offsets, and SI-valued quantities that are easy to
  interchange accidentally in plain JavaScript;
- generated or single-source typed layouts for WGSL uniforms, storage rows,
  receipts, and telemetry so host byte lengths and shader field offsets cannot
  drift independently; and
- strict typing for cache keys, lifecycle handles, optional diagnostics, and
  worker message protocols, with exhaustive handling of every status variant.

Adopt this incrementally around stable module boundaries, beginning with
`checkJs`/JSDoc coverage where a full conversion would create a large merge
hazard. Keep GPU-native validation alongside it: TypeScript can prevent many
host-side shape, nullability, stale-generation, wrong-buffer, and receipt
serialization bugs, but it cannot prove WGSL arithmetic, workgroup/barrier
uniformity, atomic races, queue lifetime, shader compilation, or physical
correctness. Those still require ABI assertions and bounded native tests.

## Acceptance criteria

- Canonical SS execution no longer identifies itself as a direct scene-owned
  fallback during the normal production route.
- UI input, menu interaction, and compositor frames remain responsive during
  SS startup and sustained autoplay.
- Physics cadence is not gated by RAF or by completion of the preceding visible
  presentation.
- Hidden status UI performs no full status-string/scene traversal per resident
  step.
- Cold pipeline preparation cannot produce a multi-second page-thread stall.
- End-to-end accepted and presented step rates remain within a documented,
  bounded factor of resident GPU execution rate.
- Each standard demo reaches its key functional milestone with correlated
  compositor motion in less than ten minutes; a no-progress watchdog fails
  early instead of extending the run.

Do not conceal this regression by increasing visual-test timeouts, lowering
scientific workloads, reusing a stale SS epoch, or counting GPU-only timing as
interactive throughput.

</details>
