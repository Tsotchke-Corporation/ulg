# GPU-Resident Physics Refactor Branch

Branch: `gpu-resident-physics-refactor`

Base branch: `SS`

Base commit: `33c30757409c7739d927decc7f25a671ed65aa7e`

Created: 2026-07-10 20:35:36 AKDT

## Objective

Refactor the production physics and presentation pipeline around one
ComputeManager-owned, GPUHub-backed resident lane without changing laws to
fit individual demonstrations or material pairs. The branch must make the
current runtime measurable and correct before optimizing it, then remove
repeated dense/spatial work through general algorithms shared by all scenes.

ULG continues to own laws, closure content, domain integration, reference
artifacts, and browser visualization. PeerCompute continues to own accepted
distributed execution, GPU lane supervision, and StateManager admission of
authoritative mutations.

## 2026-07-12 Trajectory Change

Broad feature work is paused. Resume from `plan/todo/sol-handoff.md`, which
records the stabilized checkout, accepted and rejected artifacts, default-off
mutation-certificate state, dirty-worktree risk, and the required visual-first
restart order. Do not continue the numbered refactor sequence below until the
fresh post-refactor native surface matrix has been captured and inspected.

## Required Order

1. **Complete 2026-07-10.** Repair production WebGPU surface-resource liveness across initial,
   refresh-1, refresh-2, and final frames. Version or double-buffer resources
   and reclaim them only after the relevant submission fence.
2. **Complete 2026-07-11.** Add GPU timestamp-query spans plus submit, allocation, map, fence, byte,
   and pixel-liveness evidence. Do not optimize from host enqueue timings.
3. **Complete 2026-07-11.** Replace dense `surface-cell x particle` render-field construction with a
   source-local, tiled, sorted-range, or otherwise sparse general algorithm.
4. **Implemented; acceptance open.** Restore generation-correct smooth normals
   on that sparse surface without a dense mirror or mutable live-atlas draw
   binding, then remove alpha/OIT and admit refractive PBR only from
   provenance-bearing spectral optical response. Manufactured thickness and
   full visual-matrix gates still apply.
5. **Active.** Establish one persistent multiresolution neighborhood/index authority for
   mechanics, thermal, radiation, reaction, pressure/interface, and future
   solid contact.
6. Keep pressure/interface candidate-to-force-to-grid work on the same
   ComputeManager/GPUHub lane without default GPU-to-CPU-to-GPU feedback.
7. Make the two-level Schroeder path genuinely sparse: compact unique active
   nodes and replace particle-proportional candidate reservations with
   byte-bounded arenas and explicit overflow evidence.
8. Land coherent-solid `SOL-0` contracts/invariants and `SOL-1` objective
   rigid frames only after the runtime/evidence gates above are trustworthy.

## General-Fix Rule

- No branch on a named scenario, element, compound, or reaction pair inside a
  solver, shader, renderer lifecycle, or performance fix.
- Standard scenarios and random element pairs are validation inputs, not
  implementation selectors.
- Fixes must hold across particle count, material count/order, phase,
  optical class, resize/DPR, pause/play, and repeated resource refresh.
- A reduced law may be replaced only by a more general closure/law node with
  provenance and validation gates, never by a demo-specific coefficient.

## Surface And Optical Authority

- The pre-refactor smooth-normal reference is commits `1d7874d`, `80dd2f8`,
  and `6c08872`: isosurface normals are derived from the scalar-field gradient,
  and the sampled field must belong to the same extraction generation.
- FIELD-0 must not regress that contract. Production sparse extraction writes
  one octahedral `snorm16x2` normal u32 per emitted vertex in a same-queue GPU
  pass. The packed normal buffer shares the exact MC generation and submit-
  fence retirement. A live mutable atlas binding and an 85 MB/generation
  sparse snapshot are both rejected.
- Production WebGPU surfaces use alpha `1`, write depth, and have no blend or
  weighted-OIT route. Dielectric transmission is a PBR light-transport term,
  not framebuffer transparency.
- Refraction consumes provenance-bearing spectral `n(lambda), k(lambda)` from
  the optical closure. Scalar display IORs, material-bank overrides, and fixed
  water/gas/compound constants cannot authorize ray bending.
- When quantum optical response is unavailable or outside its validity domain,
  the renderer publishes a blocked/pending closure status and uses opaque
  non-refractive PBR. It must not substitute an attractive constant.

## Validation Rules

- Use the production `native-webgpu-surface-consumer` for every visual
  acceptance check. Particle spheres and offscreen draws are diagnostic only.
- Capture close-spaced compositor frames and compact GPU physics reductions at
  time zero, refresh-1, refresh-2, intermediate checkpoints, and final state.
- A blank, uniform, stale, UI-only, wrong-canvas, destroyed-buffer, or fallback
  frame is a hard failure.
- A faceted face-normal fallback, normal/field generation mismatch, alpha less
  than one, active blend target, transparent/OIT draw, non-depth-writing
  surface, or refraction without admitted quantum spectral provenance is a
  hard failure.
- Run the standard water-cycle, iron/ice, sodium/water, cesium/fluorine, and
  deterministic random-pair matrix after each major slice.
- Run focused tests, `npm test`, `npm run build`, `git diff --check`, and
  `npm run icc:update` before each coherent local commit.

## Non-Goals

- No new CPU mirror solver or CPU parity gate for production acceptance.
- No one-off fix for a demo, material, phase, element, or reaction family.
- No third Schroeder level until two-level sparsity and conservation gates are
  green.
- No kernel micro-optimization before GPU timestamp attribution exists.
- No scene-local scheduler competing with ComputeManager.
- No kernel performance claim before GPU timestamp attribution; the repaired
  production canvas is now presentation evidence, not a timing oracle.

## Source Plans

- `plan/todo/sol-critic.md`
- `plan/solver-law-inventory.md`
- `plan/todo/SS/schroeder-tree-and-algorithm-plan.md`
- `plan/todo/adaptive-mlsmpm-support-radius-and-coarsening-plan.md`
- `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`
- `plan/todo/peercompute-law-graph-authority-plan.md`
- `plan/tests.md`

## Current Status

The first runtime slice is complete. Native surface generations now own their
primary and additional extension results until submit-fence and validation
liveness permits exact-once retirement. Failed/device-lost bridges are
quarantined from both render-refresh entry points and can be force-drained on
explicit teardown. Captured visual intervals perform real native extraction;
performance-only probes remain final-extraction-only. Unchanged native canvas
dimensions no longer trigger resize, reconfigure, or a destructive clear.

Focused tests pass 125/125. The seven-scene production matrix at
`/tmp/ulg-standard-refactor/surface-generation-final4-2026-07-10/summary.json`
has 72/72 nonblank surface-varying frames, one context configuration per
scene, and zero browser/WebGPU issues or warnings. The mobile DPR-2 gate also
passes. These results close SURF-0 through SURF-2; named physics-behavior
failures remain open and are not presentation failures.

`PROF-0` is complete. Same-device optional timestamp queries cover mechanics,
separation, thermal, reaction, mechanics refresh, dense render fields, native
marching-cubes extraction, and surface translation. Required profiling is
explicitly inconclusive when unsupported and never substitutes host or fence
time. `/tmp/ulg-prof0-benchmark-final2.json` passes its required timestamp and
stage-fence gates with 10 valid resident spans, 2.557 ms GPU time versus 252 ms
host-visible stage time, 13.600 ms dense render-field GPU time, and zero
estimated per-step readback bytes.

`FIELD-0` is complete after the independent audit. Native no-full production
uses wildcard-correct unique-home CSR routes, local support gathers, parallel
directory compaction, indirect sparse-atlas work, and aligned per-surface
candidate slices without allocating or snapshotting the old dense scalar
field. Planner admission now includes declared support radius, exact direct
and shared-primitive peak bytes, device limits, and single-flight transient
ownership. Producer and marching-cubes consumer use one authority-aware
isovalue, and GPU overflow/incomplete evidence forces candidate indirect X to
zero without a normal-path host map. `/tmp/ulg-field0-vulkan-native.json`
passes with actual native indirect `[10968,1,0,0]`, four surface-varying
frames, completed resident execution, and zero browser/WebGPU issues. The
measured up-to-eight predecessor/direct activation atomic fanout remains
optimization debt, not a correctness blocker.

The implementation corrections for `SURF-4`, `OPTICS-0`, and `OPTICS-1` are
now in the worktree, but their acceptance checkboxes remain open. Native
extraction owns packed octahedral normals for the exact marching-cubes
generation (1,398,101 u32 words for the observed 1,398,099 vertices, about
5.6 MB) and adds no submit. Native surfaces and proxy draws are alpha-one,
unblended, and depth writing. The selected background is drawn by an opaque
native fullscreen pass before surfaces and therefore appears in the scene-
color copy.

Optical admission now requires an exact, nonblocked optical-state match,
provenance, and distinct visible blue/green/red samples. The state-zero display
fallback cannot bend rays. A front-culled `depth32float` backface pass runs in
the same presentation encoder, supplies geometric rear-surface thickness, and
is reused on a stable-camera cache hit. It adds zero submissions and fails
closed for missing/open/invalid rear geometry. The accepted live frame
`/tmp/ulg-thickness-refraction-live2.png` reports 60.296 FPS, one refractive
draw, zero transparent draws, 2,457,600 backface-depth bytes, peak two
in-flight submissions, and no browser/WebGPU issue. The restored background is
also inspected in `/tmp/ulg-background-native-after2.png`.

The current molecular response is explicitly reduced and scientifically
unvalidated: STO-3G RHF independent-particle occupied/virtual dipole response
plus a Lorentz-Lorenz local-field conversion. Its provenance can authorize the
current reduced render route, but it is not full TDHF/periodic dielectric or
scientific validation. Manufactured slab thickness/dispersion/fail-close
metamorphic tests and a fresh full standard native visual matrix still block
acceptance.

The native extraction half is now concrete. The local
`webgpu-marching-cubes` branch commit `7e1f589` consumes an 8x8x8 sparse brick
atlas plus directory, active rows, and aligned candidate slices without
predensifying. `/tmp/webgpu-mc-sparse-probe.json` proves exact counter `564`,
finite varying positions, and clean WebGPU scopes. ULG's descriptor boundary
rejects stale, overflowed, cross-device, undersized, and unaligned generations.
The rejected first producer draft duplicated routes across neighbor bricks and
globally mixed candidate IDs. The accepted producer instead emits one route per
eligible source/surface pair, gathers bounded neighboring home-directory CSR
ranges, compacts directory flags, and publishes distinct aligned
sentinel-filled candidate slices.

`SS-0` is reopened at the production-consumer boundary. The shared radix/scan
backbone still compacts exact five-word hierarchy keys, indirect work, and fixed
evidence into byte-bounded retained/scratch arenas; the 300,000-route probe
stays below 41 MB and the third level is rejected. However, the current P2G
entry point does not consume the compact hierarchy to bound mechanics work,
and browser conservation checks still depend on a now-disabled host summary.
Compact P2G/G2P consumption and GPU-resident conservation evidence must land
before this slice is accepted.

The active branch slice is `NEIGH-0` and `LANE-0`. The packed resident
neighborhood must be the single generation shared by mechanics, thermal,
reaction, pressure/interface, and future solid contact. Consumers must reject
device, generation, lease, position-epoch, source-family, or mask mismatches,
and pressure/interface mutation must remain on the caller-owned
StateManager-admitted lane. The next coherent checkpoint remains local; do not
push it without an explicit request.

The 2026-07-11 14:09 AKDT remediation now supplies a persistent per-device
lane pool, one exact byte-accounted builder arena, external GPU per-source
chart/level/support assignments, post-separation generation rebuilds, and an
authority token derived from the actual ComputeManager lease identity. The
fused contract includes mechanics, contact, thermal, radiation, reaction,
pressure/interface, and coherent-solid kinematics. The live pressure-to-grid
probe passes in one caller-owned encoder with no stage-local submit, map, or
readback. NEIGH-0/LANE-0 remain open only at the production integration edge:
the older scene route must stop creating host pressure rows, and the retained
mutation must pass through StateManager admission before either checkbox can
be accepted.

The 2026-07-11 SOL remediation checkpoint is production-green without claiming
full SOL-0/SOL-1 closure. ComputeManager now returns the exact authoritative
lane identity consumed by the controller; StateManager admission binds the
same-device evidence and fail-close descriptor; ten pipelines and twenty
buffers persist in a two-slot arena; prior publications retire after their
queue fence; and the native renderer consumes one GPU-compacted indirect draw
group from the admitted resident frame. The scheduler is the sole native
presentation owner and paired frames at steps 0, 1, 30, 60, and 120 preserve
the full compositor. `/tmp/ulg-coherent-solid-production-bridge.json` and
`/tmp/ulg-coherent-solid-visual-sequence.json` both pass all 26 checks with no
browser/WebGPU errors. `/tmp/ulg-coherent-solid-frame.json` passes the four
manufactured/metamorphic GPU cases, including 100-cell translation and member
permutation.

SOL-0/SOL-1 remain unchecked because the declared complete acceptance set also
requires contact-proxy ordering, workgroup/dispatch partition variation, and
admitted SS-level/chart transition continuity. The authority, lifecycle,
fail-close, direct-shape, and close-spaced visual blockers found in the live
audit are closed; the remaining work is explicit validation breadth rather
than a CPU reference path.

The 2026-07-11 16:09 AKDT gas/EOS checkpoint removes the last known CPU
map/decode/reupload island in the retained product-event-to-pressure path. The
new persistent lane owns GPU key/radix/unique aggregation, parallel ideal-gas
cell reduction, gradient construction, compact metadata, lookup, and two
leased output generations. The pressure consumer uses the metadata's admitted
active count, not host capacity, and rejects a mismatched device, actual
ComputeManager lease, source epoch/generation, status, or overflow. Focused
tests pass `26/26`; `npm run probe:sph-gas-cell-eos` passes `12/12` and writes
`/tmp/ulg-sph-spatial-gas-cell-eos-gpu.json`. Production task-chain and mounted
StateManager admission remain the LANE-0 boundary; no checkbox is advanced by
this isolated gate.

## Current Performance Checkpoint - 2026-07-11

The largest confirmed reaction upload defect is removed. A 300k resident
reaction substep previously created and uploaded 192,000,000 zero bytes across
source, proposal, output, state, thermo, and mechanics rows. Ordered shaders
now initialize all live rows, compact counts/metadata use encoder clears, and
telemetry reports `hostZeroInitializationByteLength=0`.

This does not close physics performance. Warm reactive execution remains about
48-52 ms per substep. The active P0s are the product path, where capacity-sized
event rows can trigger an all-particle carrier scan and serial one-thread
placement, and redundant five-word neighborhood builds, each requiring 40
stable radix passes. Parallel placement and rebuild elimination are active
work but remain unaccepted until timestamped production evidence lands. P1 is
exact live-prefix indirect dispatch, indexed/cached thermal material and phase
lookup, and persistent per-lane workspaces instead of repeated transient
allocation.

No performance repair may introduce a CPU mirror, hot-state readback/upload,
named-scenario shortcut, or scheduler outside ComputeManager/GPUHub. Final
acceptance still requires the manufactured optical gates, fresh close-spaced
named/random native matrix, focused and full tests, build, diff check, ICC
refresh, and a coherent local commit.
