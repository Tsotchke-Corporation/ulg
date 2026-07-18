# SS Todo Routing

Date: 2026-07-01 AKDT
Updated: 2026-07-18 AKDT
Active branch: `ss-spatial-authority-refactor`

`SS` means Schroeder Simulation. This folder is now the active routing layer for
new architecture work in ULG.

Primary plan:

- `schroeder-tree-and-algorithm-plan.md`

Required coherent-solid correction:

- `../sol-critic.md` - preserve solid body/material identity, pose, angular
  state, inertia, connectivity, contact proxies, and rest/material-space shape
  independently of the transient grid and render LOD. This is required for
  mostly-solid and mixed solid-liquid scenes from human to planetary scale.
  Use GPU-native invariant/metamorphic validation; do not build a CPU mirror.

Active execution plan (2026-07-18):

- `shared-spatial-authority-refactor-plan.md` — build one canonical
  GPU-resident cell/hierarchy generation per immutable spatial epoch and derive
  mechanics, exact-near, cross-level, aggregate-far, solid-proxy, and render
  views without independent law grids or maximal pair storage.

Historical July 2 Fable handoff/queue documents are preserved under
`plan/moot/SS/`; their landed checkpoints remain evidence, not active order.

Supporting routing:

- `todo-routing.md`

## Active Priority

1. One exact GPU particle-to-cell key emission and canonical sort/unique per
   immutable spatial epoch.
2. Compact unique cell/member directory with explicit byte capacity, overflow,
   identity, and completion evidence.
3. Derived exact-near support views that replace private reaction, contact,
   pressure/interface, separation, thermal, and radiation lookups one at a
   time.
4. Compact mechanics node/stencil view for same-level MLS-MPM/Ocean kernels.
5. Explicit epoch-boundary scheduling for position, topology, phase/support,
   and level changes.
6. Conservative two-level coupling and aggregate-far traversal; the third
   level remains on hold.
7. Coherent-solid body/member/contact/shape carriers and mixed solid-liquid
   coupling from `../sol-critic.md`.
8. Render/source-family views and PeerCompute portable summaries without
   presentation authority over physics.

## Rules

- Do not start with a CPU reference tree.
- Do not require full particle readback for the SS hot path.
- Do not create another law-specific grid before checking whether it belongs as
  an SS law adapter.
- Do not let presentation own physics cadence or state authority.
- Keep Ocean-style kernels as dense local backends inside the SS hierarchy.

## Current Status

Landed checkpoints:

1. `f662640` routes todo ownership and branch identity through `SS`.
2. `f4c8e88` adds retained GPU level assignment rows and execution contracts.
3. `b41c179` adds retained per-level active-node planning.
4. `55b3a59` adds same-level MLS-MPM mechanics orchestration.
5. `82044fd` adds retained cross-level coupling candidate rows.
6. `9d3ea80` wires cross-level prepass orchestration into SS mechanics.
7. `d752434` filters MLS-MPM P2G by selected Schroeder level assignment.
8. `e9997a3` enables fused no-full MLS-MPM P2G filtering by retained
   Schroeder level assignment.
9. `b9d35de` adds GPU-resident cross-level conservation summary rows for mass
   and represented volume residuals.
10. `38fd33b` adds GPU-resident cross-level transfer rows for mass,
    represented volume, momentum, and internal energy.
11. `c0b980f` adds GPU-resident pending cross-level state-delta rows for
    conservative source/target transfer application.
12. `60a63c2` adds StateManager-admission gating and retained merge buffers for
    cross-level state deltas.
13. `258d7c2` materializes admitted merge rows into retained SS hierarchy
    aggregate contribution rows.
14. `60d2d7e` reduces retained aggregate contribution rows into retained SS
    hierarchy aggregate-node rows with exact GPU duplicate-key summation.
15. `730f2ff` adds retained GPU phase-volume migration decision rows that
    consume level assignments and aggregate nodes without full particle
    readback.
16. `ab1ec57` adds StateManager-admitted retained phase-volume level-update
    rows and same-level orchestration handoff.
17. `3295777` adds compact GPU phase-volume diagnostic summaries over admitted
    level updates, including water-to-steam scale migration counters without
    full particle readback.
18. `dd3e928` publishes compact SS phase-volume diagnostic summaries through the
    scene/status path so water-to-steam level migration can be observed without
    particle readback.
19. `81f51cd` adds an auto-selected bounded bucket aggregate-node reducer for
    larger SS aggregate row counts while preserving the exact reducer for
    diagnostic counts.
20. `f7cf080` adds retained active-node law-queue descriptors for
    reaction/contact/interface candidate work, including exact-near-field,
    sedenion reaction scope, and state-admission metadata.
21. `8491fb5` routes retained SS law queues through the same-level mechanics
    prepass chain and forwards them to the resident backend as
    `schroederLawQueue`, with a per-use-case disable switch.
22. `6e275e0` gates SPH reaction proposal generation with retained
    `schroederLawQueue` rows, preserving strict reaction/sedenion checks while
    keeping the reaction stage resident and no-full-readback.
23. `b1b2206` gates pressure/interface contact-kinematics candidate particles
    with retained `schroederLawQueue` rows and threads the queue through the
    pressure/interface stage task.
24. `ae7f7d3` adds retained GPU `schroeder-law-neighbor-candidate` rows, a
    no-full-readback WebGPU producer, and same-level orchestration forwarding to
    the resident backend.
25. `9f6f961` routes retained `schroeder-law-neighbor-candidate` artifacts into
    reaction and pressure/interface consumers as validated, observed, fail-closed
    metadata.
26. `126f5d1` replaces the law-neighbor source-index window with a retained
    active-node tile traversal broad phase over support-inflated SS rows.
27. `a6315c1` binds traversal-backed law-neighbor candidate rows directly into
    reaction proposal and pressure/interface contact-kinematics kernels as
    authoritative retained GPU input.
28. `c22ed0a` adds retained particle source-span rows beside law-neighbor
    candidate rows, fixes the candidate params buffer size, and routes reaction
    proposal scans through per-source candidate spans when present.
29. `17c9de8` consumes retained SS active-node rows directly in fused P2G/G2P
    mechanics, with copy-through G2P behavior for filtered particles and dummy
    bindings for non-SS/shared shader callers.
30. `199f9e6` forwards the retained same-level active-node list into the
    resident mechanics backend so SS orchestration actually drives the fused
    P2G/G2P active-node consumer.
31. `6e7f5dc` adds a retained GPU bucket index over active-node tile anchors
    and exposes it as an opt-in same-level orchestration artifact without making
    it authoritative for neighbor pruning yet.
32. `1aa16a4` consumes the retained active-node bucket index in law-neighbor
    traversal with bucket-first enumeration and exact full-scan fallback outside
    indexed slots.
33. `255a67d` adds retained law-neighbor traversal diagnostic counters for
    bucket attempts/hits, exact fallback scans, inactive rows, bucket pressure,
    and source-span writes, plus an optional compact diagnostics readback mode.
34. `1ce29da` adds a traversal policy/status layer that decodes compact
    diagnostics, separates applied bucket/exact traversal from recommended
    sorted/radix traversal, and lets same-level use cases configure compact
    law-neighbor diagnostics separately from mechanics readback.
35. `f48631f` adds a retained sorted/radix active-node index, consumes it in
    law-neighbor traversal ahead of the bucket index, and exposes it as an
    opt-in same-level orchestration artifact without adding particle readback.
36. `f29951e` wires sorted/radix index construction into traversal policy and
    PeerCompute-style use-case config: disabled, auto, force, and
    diagnostic-driven selection are now explicit in same-level summaries.
37. `43b6809` carries retained Schroeder level and active-node filters into
    one-submit fused MLS-MPM resident sequences, including thermal sidecar
    direct-runner mechanics, without borrowing-buffer cleanup regressions.
38. `ba87e41` adds descriptor-only SS portable summaries and render LOD payloads
    over retained level, active-node, law, aggregate, conservation, and
    phase-volume artifacts, then forwards them through same-level mechanics
    without raw `GPUBuffer` transfer or full particle readback.
39. `10d1f5c` admits descriptor-only SS portable render LOD summaries through
    render ownership policy and the resident authority host, storing compact
    StateManager warm deltas and hot-buffer descriptors without raw `GPUBuffer`
    transfer or full particle readback.
40. `df261c7` materializes admitted SS render LOD summaries as scene/render
    source metadata, including active leaf, coherent aggregate, law queue proxy,
    closure-PBR, admission, and no-full-readback fields on the existing resident
    render-source path.
41. `24ecd87` adds compact SS render proxy descriptor plans over
    `schroederRenderSource`, separating drawable active-leaf/coherent-aggregate
    proxy batches from diagnostic law-queue metadata without generating
    per-node JavaScript geometry.
42. `9b31697` binds SS render proxy descriptor plans into a renderer-visible
    consumer contract that defaults to descriptor import, leaves raw
    `GPUBuffer` drawing deferred until renderer capability/admission exists,
    and explicitly requires no frame-copy readback or overlay-owned physics.
43. `5b54457` adds the SS proxy draw-source contract: compact same-level
    portable summaries preserve descriptor-only retained refs, scene metadata
    selects active-leaf/coherent-aggregate retained sources, and draw batches
    stay descriptor-batched with no raw `GPUBuffer` binding, frame-copy
    readback, CPU geometry materialization, or overlay requirement.
44. `4316da6` adds SS proxy backend selection: native WebGPU retained-proxy
    draw is selected only with same-device renderer capability and a bound
    surface consumer, while diagnostic CPU proxy geometry remains explicit,
    capped, and outside the PeerCompute hot path.
45. `bdc48a5` adds a native WebGPU retained-proxy executor for SS active-leaf
    and coherent-aggregate draw batches. It resolves descriptor-only retained
    refs through a same-device buffer resolver, builds a no-readback instanced
    proxy-splat pipeline, and fails closed without raw `GPUBuffer` transfer,
    frame-copy readback, or overlay ownership.
46. `50337ae` gives SS portable retained descriptors deterministic local keys
    and adds a same-device-only local retained render-buffer resolver on SS
    execution results, so the native proxy executor can bind live retained
    buffers without making raw `GPUBuffer` handles portable PeerCompute state.
47. `6fc8f85` wires the SS native retained-proxy executor into the live native
    WebGPU surface render pass. The bridge now resolves same-device local SS
    buffers, rebuilds/reuses the proxy executor by resident generation and
    retained refs, writes camera/viewport uniforms from the scene camera, and
    submits active-leaf/coherent-aggregate proxy splats inside the main native
    pass with diagnostics for resolver, executor, camera update, and submit
    counts.
48. `efe73dc` live-validates the native same-device surface route in Chromium,
    fixes presentation-worker retained-output preemption for explicit
    `native-webgpu-surface-consumer` refreshes, and hardens the browser/probe
    harness against overlay launch races while keeping final same-device
    readiness strict.
49. `b573ccd` adds an opt-in scene resident execution path that wraps
    `runSchroederSameLevelMechanicsWebGpu` around the existing resident
    MLS-MPM step, carries portable render LOD and same-device local retained
    buffer resolver artifacts through resident publication, and proves in
    Chromium that the native surface pass submits SS active-leaf proxy draws
    without a frame-copy or overlay path.
50. `9699d58` exposes the scene-local SS execution path through URL and
    PeerCompute-style use-case configuration (`ss=1` / `schroeder=1` /
    `schroederSimulationPolicy`), threads that selection through the resident
    auto scheduler and batch signature, adds visible SS status telemetry, and
    fixes native surface auto-refresh so URL-configured SS runs submit retained
    native proxy draws without CPU render-field readback.
51. `6fa1fec` feeds compact SS execution/render-proxy telemetry into the
    long-horizon probe and performance benchmark output: selected level, native
    grid spacing, active/coherent/law proxy counts, retained resolver status,
    backend selection, native executor/submit draw counts, surface-draw bridge,
    and render-field/render-row readback status.
52. `fc99828` hardens diagnostic CPU proxy selection so `auto` never falls back
    to CPU descriptor proxy geometry. Diagnostic CPU now requires explicit
    `diagnostic-cpu` preference, explicit admission, and an under-budget proxy
    count, and flattened telemetry marks it metadata-only and non-hot-path.
53. `f26f895` adds descriptor-only SS portable-summary replay descriptors and
    seeds to the StateManager admission path. Admissions, hot records, and warm
    deltas now publish replay-ready compact SS summaries/render LOD without raw
    `GPUBuffer` handles, and the resident authority host exposes a replay
    descriptor helper.
54. `ff29727` exposes bucket-first traversal/index policy telemetry so auto mode
    explicitly keeps the retained bucket index as the small-scene/default GPU
    index and records the sorted/radix escalation trigger only when forced by
    PeerCompute/traversal policy or justified by compact diagnostics.
55. `0fee1ef` adds retained GPU far-aggregate candidate traversal rows for
    aggregate-admissible laws. The same-level SS path now runs a
    Barnes-Hut-style aggregate-opening pass over active nodes and retained
    aggregate nodes, forwards descriptor-only far-field refs through portable
    summaries, excludes near-field/local laws, and keeps the default hot path
    no-full-readback.
56. `0773c25` adds retained GPU far-aggregate force-summary rows. The pass
    reduces far-aggregate candidates into read-only gravity-like
    acceleration/potential summaries with explicit error-bound telemetry,
    forwards descriptor-only refs through same-level/portable-summary paths, and
    keeps force application as a future StateManager-admitted mutation.
57. `70e21ce` adds compact GPU far-aggregate diagnostic summaries over retained
    force-summary rows. The pass reports source/candidate activity, overflow,
    blocked work, opening-ratio pressure, error-bound pressure, max
    acceleration/potential, and descriptor-only portable refs with compact
    summary readback only and no state mutation.
58. `f91259b` adds StateManager-admitted retained far-force application rows.
    The pass consumes retained far-force summaries and SPH particle mass state,
    emits velocity/momentum/energy delta rows only after admission, forwards the
    retained delta buffer into same-level resident mechanics, and publishes
    descriptor-only portable refs without full particle readback.
59. `ed15162` fuses admitted far-force application rows into resident SPH state.
    The resident MLS-MPM path now copies retained G2P state, scatters admitted
    velocity deltas into a retained fused state buffer, routes thermal/reaction
    sidecars from that state, and records `schroeder-far-force` authority in
    the resident StateManager ledger without default full particle readback.
60. `4a586fc` adds StateManager-admitted retained far-aggregate law-consumer
    rows. The pass consumes retained far-force summary rows and compact
    diagnostics, emits read-only radiation/plasma/gas-summary proxy rows,
    forwards the retained descriptor through same-level/resident paths, and
    publishes descriptor-only portable refs without mutating particle state.
61. `35779c2` adds compact retained far-aggregate law-consumer diagnostic
    summaries. The pass reduces admitted read-only radiation/plasma/gas-summary
    consumer rows into one pressure/exposure summary row, forwards it through
    same-level/resident and portable descriptor paths, and keeps the state
    mutation boundary closed.
62. `794e4aa` adds an explicit far-aggregate law-consumer authority policy over
    compact diagnostics. The default policy keeps pressure/exposure signals
    read-only, while opt-in use cases can mark a future
    StateManager-admitted state-delta path as required without mutating state.
63. `b3f62cf` adds StateManager-admitted retained far-aggregate gas state-delta
    rows. The pass consumes read-only gas-summary consumer rows and authority
    policy, emits retained density/pressure/work proxy deltas for the
    `gas-pressure` state family, forwards descriptor-only refs through
    same-level/resident paths, and keeps full particle readback disabled.
64. `8d87b5b` materializes admitted far-aggregate gas state-delta rows into
    retained pressure-interface gas-cell rows. The pass writes
    `SPH_GAS_PRESSURE_CELL_FLOATS`-compatible rows from retained gas deltas and
    force-summary centers, forwards descriptor-only refs through same-level,
    resident, and portable summary paths, and keeps CPU gas-cell snapshots out
    of the default hot path.
65. `bbd4bdf` lets the pressure-interface WebGPU force-row producer consume
    retained SS gas-cell rows directly. The stage normalizes
    `schroeder-far-aggregate-gas-cell-import` artifacts as retained local
    pressure-gradient imports, binds the borrowed gas-pressure-cell buffer at
    the existing pressure-interface gas-cell binding, and avoids the CPU
    gas-cell snapshot/upload bridge on the default path.
66. `04d7627` promotes retained SS gas-cell imports from same-level resident
    execution into the scene pressure-interface state. Mounted scheduling can
    now reuse a pressure-interface import descriptor that preserves the
    retained gas-pressure-cell GPU buffer, row metadata, and admission evidence;
    the resident cleanup preservation list also carries that buffer forward.
67. `c0707cb` surfaces retained-row pressure reuse telemetry across lane
    summaries, pressure-interface worker publication candidates, and mounted
    worker-lane reports. The pressure path now records whether retained SS
    gas-cell rows were borrowed/retained by the force-row producer, while the
    mounted worker-lane report distinguishes main-thread promoted imports from
    worker-lane consumption instead of implying cross-worker `GPUBuffer`
    transfer.
68. `0a91ae6` reuses retained SS gas-cell imports as pressure-feedback inputs.
    The runtime now normalizes retained pressure rows into a descriptor-backed
    gas-cell field without CPU cell snapshots, shared gas-pressure feedback
    summaries accept retained row metadata as local-gradient-ready but
    unvalidated, and the scene pressure refresh injects promoted SS imports
    into next-frame same-level pressure feedback.

Historical implementation queue (superseded 2026-07-13 by
`shared-spatial-authority-refactor-plan.md`):

1. Continue Slice 7 by adding a worker-owned retained gas-cell import/admission
   path for dedicated mounted worker lanes. Keep the boundary descriptor-only
   across PeerCompute and consume only worker-local retained refs.
2. Keep pressure/interface exact-near-field work separate from far-aggregate
   traversal.
3. Keep radiation, plasma/electromagnetic approximation, and gas-summary
   adapters behind explicit law admissibility, compact diagnostics, and
   StateManager admission.

Current implementation queue:

1. Transport the verified Slice 7 snapshot: its paired non-target and
   GPU-timestamp performance receipts, Pages build/static smoke, 87-path staged
   secret/conflict audit, ICC completion oracle, readiness, and production
   audit are recorded. Make the one requested full-slice commit, then non-force
   push the branch and the same Pages-bearing commit to `main`; record the
   immutable SHA/ref receipts in ICC and the final handoff.
2. Start Slice 8 by adapting product/gas, coherent-solid proxy, sparse-render,
   source-field, and surface routes where their coordinates and ownership match
   the canonical spatial epoch. Delete duplicate bins, independent sorts,
   fixed candidate queues, exhaustive fallbacks, and host feedback only as
   their authoritative replacement is proved. Start with the measured
   post-mechanics reaction hotspot (`364..369 ms` p50 in the Slice 7 target
   characterization), not an unmeasured rewrite.
3. Keep phase-resolved represented-current-volume and volume-gradient moments,
   shared local/reflux pressure and drag, hydrostatic ambient or resolved air,
   and conserved phase/reaction birth volume as an explicit gas-interface and
   phase-volume transport follow-on. Steam rise/condensation and hydrogen rise
   remain failed expectations until that work is verified; do not hide them by
   relaxing the standard visual matrix.
