# ULG Todo Handoff - 2026-06-12

Timestamp: 2026-06-12 15:51 AKDT

## Current Snapshot

- Repo: `/home/cos/projects/ulg`
- Branch: `main`
- Current `HEAD`: `c81a66a85c82eb7ce3d960bcd8de0b35ff7d5676`
- Local policy: keep commits local and do not push.
- Worktree: intentionally dirty from the long-running ULG runtime work. Do not
  revert unrelated changes.
- Vite dev server: listening on `0.0.0.0:5173` as process `MainThread`
  pid `242294`.
- ICC: ULG is registered at
  `/home/cos/projects/infinite_context_coder/artifacts/repos/ulg`.
  `npm run icc:update` is the active refresh command.
- New Codex skill: `/home/cos/.codex/skills/icc/SKILL.md` now documents the ICC
  workflow for future sessions.
- User clarification: the physics behavior is still severely broken. Treat
  `plan/todo/physics-behavior-regression-plan.md` as P0 above further broad
  WebGPU migration. Architecture plumbing only counts if reset/playback,
  pressure/interface force application, reaction/product/gas carry-forward,
  thermal/phase continuity, stale mirror guards, and diagnostics become
  behaviorally coherent.
- Latest P0 behavior finding: resident no-full-readback steps now carry
  post-thermal SPH state forward when reaction emits no particle mutation, the
  resident mechanics/constitutive refresh stage updates MLS-MPM mechanics from
  post-thermal phase/EOS state before the next P2G, pressure-interface force
  rows are blocked unless explicitly approved for MLS-MPM grid application,
  P2G/grid-update execution envelopes preserve `gridShift` for WebGPU G2P, and
  the page now honors the MLS-MPM cadence contract (`substeps=16 target=16`)
  instead of silently capping resident submissions at four substeps. Hot
  resident mutation passes now cache compute pipelines and defer no-full
  cleanup instead of blocking after every pass. Short-horizon H2O/H2O resident
  gravity motion is coherent again. The remaining immediate blocker is no
  longer stale thermal mechanics, unapproved pressure rows, mismatched G2P
  grid origin, or the four-substep cadence cap; it is still long-horizon
  H2O/H2O liquid settling/contact, corrected-cadence throughput, and
  render-surface coherency.
- Latest pressure/gas regression recheck: `c81a66a` reproduces the separated
  H2O/H2O scene failure under the current standalone probe after `1 x 16`
  steps: pressure rows `302`, consumer
  `grid-momentum-impulse-submitted-unverified-no-full-readback`, max speed
  `20.7157 m/s`, J `0.509843..1.372338`, and visible H2O outside the box by
  about `1.31 m`. The current dirty tree passes the same short scene probe with
  pressure rows `0`, consumer `blocked-pressure-force-rows-unavailable`, J near
  one, and bounded visible geometry. This only proves the short-horizon
  pressure/render regression is gated; same-material liquid settling remains
  P0.
- Latest compact-diagnostic upgrade: the MLS-MPM resident compact summary now
  returns source/next center of mass and source/next particle bounds in the
  no-full-readback path. The compact readback is `224` bytes. Updated direct
  and scene H2O/H2O probes both classify `good` and include COM/AABB telemetry;
  the scene probe reports `nextCenterOfMassYDeltaM=-0.0013416` with visible
  bounds inside the container. Use max-Y/bounds and sparse visual probes for
  long-horizon settling, because total COM is dominated by the base block. The
  live HTTPS derived-material e2e now passes with the `224` byte compact
  summary and COM/AABB diagnostics after accepting the refreshed-mechanics
  retained buffer mode and explicit overlay-policy bridge status.
- History-probe finding: the same H2O/H2O contact-near probe is good at
  `f0d101f` and bad at `c81a66a`. The c81 bad run jumps to
  `max-v=303.441 m/s` and `J=0.1..8.343449` after pressure-interface rows
  become an unverified grid momentum consumer
  (`grid-momentum-impulse-submitted-unverified-no-full-readback`). The current
  dirty tree is good under the same standalone probe: `max-v=0.140798 m/s`,
  `J=0.999399..1.0`, pressure rows `0`, and consumer
  `blocked-pressure-force-rows-unavailable`. Repeat with
  `npm run probe:sph-long-horizon` and `ULG_PROBE_REPO_DIR=<worktree>`.
- New screenshot/GIF evidence: same-material H2O/H2O at about 300 K still
  shows detached floating/faceted blobs, delayed reconfiguration after
  recording stops, and a warning that resident displacement is below the
  visible threshold while the visible state is plainly nonphysical. Treat this
  as a P0 same-material liquid settling and render-state coherency regression,
  ahead of any broader architecture win.
- Tactical hot-loop mitigation now in `src/visualization/sphPhaseDemoMount.js`:
  subvisible-motion suppression can skip non-cadence refreshes, but it can no
  longer suppress the cadence refresh itself. This is not the full physics fix;
  it prevents resident continuation from hiding behind an old mesh indefinitely
  when compact motion diagnostics under-report the visible divergence.
- Latest P0 visual harness status: `tests/demo.e2e.mjs` now has an opt-in
  `SPH phase visual sequence` test and `npm run test:sph-visual`. It writes
  frame PNGs, a JSON timeline, and GIF/WebM artifacts for H2O/H2O. The harness
  is now parameterized by `ULG_SPH_VISUAL_URL` and `ULG_SPH_VISUAL_LABEL`, so
  contact-near liquid/liquid and future representative scenarios can reuse the
  same test path. The current post-grid-origin default artifact is useful and
  no longer shows the old
  `max-v=140.18 m/s` spike: resident velocity progresses through about
  `0.0196`, `0.0392`, and `0.0588 m/s`, with pressure rows/impulse at zero.
  A contact-near H2O/H2O artifact (`ironh=0.85`) produced one visible merged
  surface with monotonic resident velocity and zero pressure impulse.
  The post-COM/AABB separated H2O/H2O sanity pass also writes artifacts at
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-com-bounds/`.
  Capture runs now add `visualCapture=1`, preserve the Three.js drawing buffer,
  and write frames through `canvas-to-data-url`; MediaRecorder still does not
  yield an extractable frame sequence in headless Chromium. The timeline still
  reports `captureCadence.status = slow-capture-cadence`, now attributable to
  runtime/render latency rather than blank canvas readback. Long-horizon
  liquid/contact and render-surface coherency remain the next P0 bug class.
- Latest retained-resident probe status: `scripts/sph-long-horizon-probe.mjs`
  now supports `ULG_PROBE_MODE=direct-resident` for faster mechanics/thermal
  telemetry without constructing the Three.js scene. The direct H2O/H2O
  `2 x 32` substep run stayed compact-stable (`max-v=0.1798196 m/s`,
  `max-dx=0.00008988 m`, active nodes `248`, `J=0.998767..0.999974`,
  pressure rows/impulse `0`) with `compactSummaryMode=final-only`. Treat this
  as resident-loop evidence only: direct mode bypasses scene-derived pressure
  rows and marching-cubes surfaces, so it must be paired with scene probes and
  visual sequences before claiming visible physics is fixed.
- Latest motion-diagnostic finding: compact summary `maxDisplacementM` is only
  the final substep displacement. A separated H2O/H2O direct run over `256`
  substeps reaches `1.2552514 m/s` after `0.128s`, but the final-substep
  displacement is only `0.0006275 m`. The demo now publishes a batch-motion
  upper-bound estimate and forces visual refresh with
  `resident-batch-motion-estimate-visual-refresh` when the estimate crosses the
  visible threshold. Sparse scene evidence confirms that path. Remaining P0:
  true liquid settling is not proven.
- Latest render-bounds finding: padded render-field coordinates were making
  physical blob radii about `1.79x` too large. The scene now maps physical
  radii through the padded field span, clips generated Three.js MarchingCubes
  geometry to the sealed container, and the standalone probe flags out-of-box
  visible surfaces. The separated H2O/H2O scene probe now reports y-min
  effectively at the floor (`-1.06e-8 m`) and `maxVisibleSurfaceOutsideM=0`.
  The probe also now distinguishes active draw vertices from MarchingCubes
  buffer capacity (`840` active H2O vertices versus `72000` capacity after
  resident refresh). Remaining P0: render-field readback is still active and
  same-material contact/settling is not validated.
- Latest visible-surface scale finding: the default raw isosurface scale still
  made sparse contact-near H2O/H2O look like oversized/nested water even when
  resident particles were bounded. The standalone probe now compares visible
  surface bounds against compact resident particle AABBs and flags
  `visible-surface-expanded-beyond-particle-bounds`. `blob=0.4` passed that
  guard, so `SPH_SURFACE_RADIUS_SCALE_DEFAULT` is now `0.4` for both scene
  defaults and the demo input. The no-override contact-near H2O/H2O probe now
  passes with `maxVisibleSurfaceOutsideParticleBoundsM=0`, and the required
  visual sequence wrote artifacts at
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-contact-near-default-blob-0p4/`.
  Remaining P0: this is render-surface coherency only; long-horizon liquid
  merge/settle physics still needs validation and likely solver work.
- Latest liquid-contact guard finding: `scripts/sph-long-horizon-probe.mjs`
  now fails same-material liquid H2O/H2O when the initial-order drop/base
  contact gap does not close over a long enough direct full-readback run, and
  when sparse scene rendering splits visible H2O into inconsistent phase/render
  descriptors. Current direct H2O/H2O `4 x 64` full-readback probe is `bad`:
  `same-material-contact-gap-not-closing`, drop COM `1.1000000 -> 1.0804508 m`,
  base/drop gap `0.0333334 -> 0.0321894 m` over `0.128s`, pressure impulse `0`,
  J `0.997498..1.000174`. Current scene H2O/H2O `4 x 64` probe is also `bad`:
  `same-material-h2o-visible-phase-split` and
  `same-material-h2o-nonliquid-visible-surface`, with visible `liquid:h2o` and
  `solid:ice` surfaces in the same 300 K H2O/H2O scenario. Next code should
  debug the mechanics/contact and phase/render-state source of those two
  failures, not tune the visual radius again.
- Latest pressure/gas regression correction: the earlier reduced-solver
  guardrail was wrong. Gas pressure remains nonnegative, but condensed Tait
  pressure must stay signed so expanded liquid has restoring pressure, and
  hidden condensed-liquid affine damping in G2P was suppressing gravity/contact
  motion. The current tree restores signed condensed pressure in CPU/WGSL P2G,
  removes the hidden liquid affine damping in CPU/WGSL G2P, and clamps
  finite-volume particle centers at wall clearance instead of treating
  particles as dimensionless points.
- Latest validation-harness correction: the long-horizon Playwright probe can
  force validation render-field readback, disable the resident overlay for that
  validation refresh, timeout render refreshes, and measure only
  MarchingCubes `drawRange` vertices. The old bounds sampler used the fixed
  `72000` vertex capacity, so unwritten zero vertices made surfaces look pinned
  or full-height in diagnostics even when the drawn mesh was smaller.

## Recent Completed Work

### ICC And Tooling

- Added `.icc/` policy files for ULG and rewrote them to be ULG-native rather
  than copied sibling-repo wording.
- Added `scripts/update-icc.mjs` and `npm run icc:update`.
- Reinitialized ICC artifacts non-destructively by moving the old generated
  artifact root to
  `/home/cos/projects/infinite_context_coder/artifacts/repos/ulg.reinit-20260612-154227`.
- Rebuilt ICC from scratch. Current refreshed result: `219` indexed files and
  `926` memory chunks after the latest plan/log updates.
- Verified ICC status reports `is_stale: false`.
- Created the user Codex `icc` skill so future sessions can trigger the ICC
  workflow from skill metadata.

Known ICC limitation:

- ICC parses many `.js` files and records partial symbols, but it still
  classifies `.mjs` scripts/tests as `text` with zero symbols.
- `find-symbol`, `function-map`, and `pack-symbols` are not reliable for ULG JS
  tasks yet. Prefer `architecture-summary`, `search-chunks`, `find-file`, and
  `read-lines` for ULG work.

### Resident Reaction/Product Pipeline

- Balanced multi-product reaction terms are now preserved through discovery and
  table packing.
- Runtime no longer has to collapse Na + H2O into one product. The current
  general path can represent NaOH plus H2 and can report gas product pressure
  diagnostics.
- Compact resident gas/product ledgers exist.
- Product inventory and atom/charge residual ledgers exist.
- Strict reaction gate contracts exist and block overclaiming when energetics
  or residuals are not validated.
- Sparse product-event rows now exist as a GPU-resident sidecar.
- Product-event rows now carry mechanics/EOS metadata: velocity, support
  volume, bulk/shear moduli, Lame lambda, sound speed, EOS model id, solid flag,
  and mechanics status.
- Resident product mass can be carried into repeated MLS-MPM steps and consumed
  by P2G as unplaced product mass. P2G also uses event velocity and local EOS
  pressure when the product-event row has enough derived mechanics/EOS data.

Remaining reaction/product gaps:

- Multi-generation product-event append/compaction is still not solved.
- Gas-cell or pressure-gradient force coupling still needs validation.
- Product-event mass participates more honestly than before, but gas/product
  dynamics are not yet fully closed.
- Strict thermochemistry remains reduced/provisional in some cases. Do not mark
  strict scientific validation true until energetics are actually derived and
  residual gates pass.

### Pressure And Force Coupling

- Pressure interface field and local interface element rows exist.
- Conservative pressure-interface force solver artifact exists.
- MLS-MPM grid update can consume pressure force rows and apply impulses to
  mass-bearing grid nodes through CPU and WGSL parity-gated paths.
- Resident MLS-MPM steps now receive pressure-interface force rows with a
  one-frame delay through the render-state pressure path.

Remaining pressure gaps:

- Need live-demo verification that the pressure force path visibly moves
  material in the expected way.
- Need gas-cell or pressure-gradient coupling for product gases, steam, and
  sealed-box pressure rather than relying on diagnostic pressure summaries.
- Need conservation tests around the actual resident force application, not only
  the current artifact/preview paths.

### Rendering And Hot Loop

- The Three.js continuous-volume fallback renders again.
- Flicker guard was tightened. Under-threshold transient fields retain the last
  valid mesh through the inactive-frame grace window before hiding.
- WebGPU render-field residency now exists for no-full-readback paths.
- WebGPU marching-cube classification exists.
- Deterministic fixed-slot surface-vertex emission exists.
- Per-surface draw metadata rows exist.
- Product-event rows can splat into the render field as unplaced product volume.

Remaining render/hot-loop gaps:

- The WebGPU marching-cubes path is not yet the active Three.js-integrated
  renderer.
- Prefix/compaction, indirect draw metadata, and direct draw binding are still
  pending.
- CPU `MarchingCubes` remains the visible fallback and is still a major
  performance cost.
- The current architecture still does too much CPU/readback work for target
  interactive performance.

### Cache And Worker State

- Cold-start cache correctness is partially implemented.
- Material closure, reaction closure, product reuse, static table, and GPU
  warmup signatures are persisted with generator/provenance guards.
- Static table cache serialization moved into the supervised `ulg-runtime`
  worker.
- Warm scene startup can consume rehydrated thermal, graph, phase-response,
  optical/PBR, and reaction table bundles in some paths.
- UI warning behavior exists for CPU derivation work. The ultra-low-FPS
  auto-pause behavior was intentionally removed.

Remaining cache gaps:

- Rehydrated table records still need deeper consumption in WebGPU upload paths.
- Material/reaction cache parsing should move farther out of the UI thread.
- Stale-record browser probes and measured cold/warm/clear-cache deltas are
  deferred until schemas stabilize.
- Cache keys should stay independent of particle count unless the particle
  change alters a derived physics input such as contact radius.

### Material And Optical Closures

- Strict material provenance gates exist.
- Fe, H2O, air, H2, O2, elements, and products now use a generic derivation
  path instead of reference constants as production truth.
- Element closures include scalar-relativistic interband optical response in
  CPU JavaScript.
- Optical/PBR lookup has a WebGPU table/lookup path.
- Human-readable element labels and a periodic-table-style picker exist.

Remaining material/optics gaps:

- WebGPU currently consumes packed optical rows. It does not derive the
  relativistic/interband optical response on GPU.
- Full WebGPU material property resolution is not implemented.
- Quantitative material accuracy is still limited by the reduced lower-level
  solvers. Keep validation flags honest.
- Any material property that does not resolve from a lower-level derivation or
  valid cache record remains a bug.

### Steam/Water Optics

- H2O gas descriptors now carry a bucketed sealed-box vapor optical state.
- Pure vapor can be nearly invisible, while supersaturated/condensed droplet
  steam can become visible through derived optical depth and scattering.
- Vapor surface visibility is gated by derived optical response, not the
  `steam` label alone.

Remaining steam gaps:

- Microphysics state is not yet resident per-cell/per-particle on the GPU.
- Explicit UI readout for pure vapor vs condensed steam mode is still pending.
- Steam pressure/volume/droplet dynamics need tighter coupling to the resident
  gas and phase systems.

## Active Todo Order

Use this order unless the user redirects:

1. Fix the P0 physics behavior regression before more architecture victory
   laps:
   - follow `plan/todo/physics-behavior-regression-plan.md`;
   - reproduce/pin the screenshot-backed same-material H2O/H2O settling failure
     first: water should fall, contact, merge, and settle into one coherent
     body with no detached floating blob, no delayed render-cadence jump, and
     no unbounded pulsing;
   - use the dense visual sequence harness after major todo completions, with
     close-spaced frames, resident diagnostics, and visible surface bounds;
   - start with same-material liquid/liquid, then rotate through solid/liquid,
     steam/water phase-change, and reaction/product scenarios;
   - no-op reaction or thermo-only output must not overwrite G2P mechanics;
   - pressure/interface extraction must be a physics stage, not a side effect of
     visible render refresh;
   - stale CPU mirrors are guarded at the resident MLS-MPM step boundary.
2. Establish law/state authority while preserving the P0 behavior gate:
   - follow `plan/todo/peercompute-law-graph-authority-plan.md`;
   - follow `plan/todo/resident-state-authority-contract-plan.md`;
   - follow `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`;
   - first resident authority ledger slice is implemented in
     `src/runtime/residentStateAuthority.js` and wired into
     `src/runtime/sph/sphMlsMpmGpuStep.js`;
   - first resident buffer lease slice is implemented in
     `src/runtime/residentBufferLease.js` and wired into resident MLS-MPM
     product-event cleanup;
   - retained surface-draw buffers and pressure-interface force-row uploads now
     publish lease ledgers and use guarded release/destroy paths;
   - keep PeerCompute NodeKernel, ComputeManager, and StateManager as the
     long-term authority path for distributed execution and accepted state;
   - require exactly one authoritative owner for each mutable resident state
     family after every stage.
3. Fix resident-loop bugs created by the WebGPU refactor:
   - borrowed pressure/render buffers now have local queue-work evidence on
     grid-update, render-field, surface-vertex, surface-draw, compact-summary,
     product-event merge/copy, and pressure-upload cleanup WebGPU paths, but
     distributed ULG lane workers still need to emit the new PeerCompute fence
     contract.
4. Finish reaction/product/gas dynamics:
   - add `plan/todo/sedenion-reaction-scoping-plan.md` as a symbolic
     reaction-channel prefilter, not as validated chemistry;
   - validated pressure-gradient or gas-cell force coupling;
   - multi-generation product-event append/compaction;
   - stricter atom/mass/charge/energy residual parity.
5. Finish sealed-gas and steam microphysics:
   - per-species gas inventory;
   - H2O vapor/condensation/droplet state;
   - pressure and optical response from resident state.
6. Add iron-on-ice scenario preflight and controls:
   - exact 10 m sealed box, 1 m Fe cube, 1 m H2O cube;
   - six wall-temperature sliders;
   - particle count controls;
   - represented atoms/molecules per macro-particle;
   - enthalpy and wall heat ledgers;
   - fail preflight when final state is thermodynamically implausible.
7. Continue WebGPU hot-loop work:
   - follow `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`;
   - prefix/compaction for surface vertices;
   - indirect draw rows;
   - Three.js/WebGPU-integrated continuous volume renderer;
   - compact summaries instead of full particle/grid readback;
   - WebGPU-Ocean-style fixed-point/tiled scatter where needed;
   - keep the worker shape compatible with PeerCompute ComputeManager;
   - keep hot mutation chains on one GPU resident lane per state key until
     explicit domain partitioning exists.
8. Move material property resolvers toward worker/WebGPU execution:
   - resolver manifest first;
   - optical/EOS/thermal table consumers;
   - flat closure graph rows;
   - Eshkol-derived reference/closure artifacts where useful;
   - atomic and molecular solver kernels later.
9. Add frontier physics as law graph nodes, not one-off scripts:
   - define isotope/radiation ABI;
   - energy deposition/daughter ledgers;
   - Cherenkov source rows from particle speed, medium IOR, and spectral
     response;
   - add gravity, MHD/PIC, quantum response, relativistic, and astrophysical
     closure paths with honest validation gates.
10. Cross-repo integration:
   - PeerCompute should supervise law workers, leases, artifact caches, and
     admitted compact deltas;
   - Eshkol should derive/compile closure and reference artifacts and stay warm
     when scenario latency requires it;
   - MoonLab should provide quantum/many-body response artifacts and stay warm
     when scenario latency requires it;
   - PeerCompute receiver still needs to accept MoonLab reduced browser WebGPU
     parity-scope evidence without treating it as full physics/runtime proof.
11. Return to cold-start performance polish only after schemas stabilize:
    - stale-record browser probes;
    - measured cold/warm/clear deltas;
    - GPU warmup persistence where WebGPU allows it.

## Problems To Keep In Mind

- Performance is still the biggest practical risk. The runtime is not close to
  60 Hz while CPU MarchingCubes, JavaScript closure derivation, and readback
  paths remain active.
- Authority is now the biggest correctness risk. The browser scene, CPU arrays,
  resident buffers, compact summaries, and PeerCompute state path must not all
  think they own the same mutable state family.
- Copying is now the biggest performance/architecture risk after authority. Do
  not fan a single hot resident state through arbitrary GPU child workers;
  preserve lane/device affinity and measure upload/readback budgets.
- The visible simulation should be manually watched after physics changes.
  Prior user reports included "physics FPS moving but no visible motion"; later
  reset-path continuity and pressure-row wiring were fixed, but live visual
  motion still needs repeated verification.
- The current WebGPU marching-cubes work is an ABI/kernel path, not yet a clean
  renderer replacement.
- Pressure force-row authority is now separated from resident render state via
  `sphResidentPressureInterfaceState`, and the playback loop refreshes that
  pressure state after resident physics steps even when visible render refresh
  is skipped.
- Material-interface authority is now also separated from resident render state
  via `sphResidentMaterialInterfaceState`. The playback loop refreshes it after
  resident physics and before pressure force rows, using retained field/surface
  buffers and the material-interface candidate WebGPU kernel. A
  `peercompute.ulg.sph-material-interface-source-field.v0` wrapper now gives
  pressure-only refreshes a material-interface source identity instead of only
  a render-field identity. Remaining: the scalar density source still reuses
  the existing field kernel, and candidate/interface compaction still reads rows
  back to CPU.
- Local queue-completion evidence now exists for the current grid-update,
  render-field, surface-vertex, surface-draw, compact-summary, and
  product-event merge/copy WebGPU paths, plus scene-level pressure force-row
  upload/cleanup ordering. Treat this as local lease/lifetime evidence only; it
  is not yet ULG lane integration with the PeerCompute-distributed GPU worker
  fence contract.
- PeerCompute `ComputeManager` now has the base distributed fence admission
  contract in `/home/cos/projects/peercompute`: task packets can require GPU
  fence evidence and remote placement verification rejects missing or
  unsatisfied `peercompute.compute.gpu-fence-report.v0` reports before
  `commitDelta`.
- PeerCompute Multiscale `ulg-runtime` now uses that contract from a real
  solver descriptor and task result: the descriptor declares a WebGPU queue
  fence, `stepUlgRuntime` emits the fence report, and loopback non-advisory
  remote placement accepts the compact ULG delta only after ComputeManager
  verifies the satisfied fence.
- PeerCompute now has a passive `GpuResidentLaneManager` under `ComputeManager`
  with state-keyed leases, retained-buffer refs, copy budgets, same-lane
  state-key conflict rejection, lane stats, and GPU fence reports. It does not
  yet schedule ULG SPH passes.
- PeerCompute `ComputeManager` now wraps declared inline GPU-resident lane
  tasks in `GpuResidentLaneManager` leases before local commit. Required queue/
  lane fences are no longer advisory for that path: missing or unsatisfied
  fences reject the task with `ERR_COMPUTE_GPU_FENCE_UNSATISFIED` before
  `commitDelta`.
- ULG now has a ComputeManager-shaped resident-step task bridge:
  `createMlsMpmResidentStepComputeTask()`,
  `runMlsMpmResidentStepComputeTask()`, and
  `submitMlsMpmResidentStepComputeTask()`. It declares GPU-lane residency and
  required fence metadata, returns explicit
  `peercompute.compute.gpu-fence-report.v0` evidence, and avoids local
  double-leasing so ComputeManager remains the lane owner.
- Reaction handling is more general than before, but not complete. Avoid
  material-pair scripts. Any new reaction behavior should route through the
  general closure/product-term machinery.
- The material resolver stack is still CPU-heavy. Optical lookup is GPU-side;
  optical derivation is not.
- Do not claim first-principles scientific completeness. Many validation flags
  intentionally remain false because the solvers are reduced and some
  energetics remain provisional.
- ICC is useful for source-focused context now, but its JS symbol layer is
  partial. Use chunk/file lookup when symbol tools miss obvious JS.
- The worktree includes many existing unrelated or prior-session changes. Read
  files before editing and do not revert anything you did not author.

## Useful Commands

```bash
# Use Node 24 if the shell has drifted.
nvm use 24

# Start or restart the demo so it is VPN-accessible.
npm run dev

# Refresh ULG ICC state.
npm run icc:update

# Check ICC staleness directly.
EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness

# Useful ICC fallback for ULG JS work.
EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py search-chunks --repo ulg --query "<topic>" --limit 8 --include-content

# Baseline hygiene.
git diff --check
npm test
npm run build
npm run build:pages

# Browser SPH smoke when the HTTPS dev server is already running.
PLAYWRIGHT_SKIP_WEB_SERVER=1 \
PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 \
PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 \
PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 \
npm run test:e2e -- --grep "SPH phase demo"
```

## Last Validation Notes

- Latest local verification for this handoff slice: `git diff --check` passed,
  `npm run build` passed with Vite's existing large-chunk warning, full
  `npm test` passed `456/456`, and `npm run icc:update` refreshed ICC with
  `224` indexed files and `980` memory chunks.
- Latest PeerCompute GPU resident lane validation:
  - `node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check peercompute/tests/unit/gpuResidentLaneManager.test.js` passed.
  - `node --test peercompute/tests/unit/gpuResidentLaneManager.test.js` passed, `5/5`.
  - `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js peercompute/tests/unit/gpuResidentLaneManager.test.js` passed, `32/32`.
  - `git diff --check` passed in `/home/cos/projects/peercompute`.
  - `npm --prefix /home/cos/projects/peercompute/peercompute run build` passed with PeerCompute's existing circular chunk and large bundle warnings.
  - `node --check peercompute/src/peercompute/computeManager/GpuResidentLaneManager.js && node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check peercompute/src/peercompute/index.js && node --check peercompute/tests/unit/gpuResidentLaneManager.test.js` passed.
  - `node --test peercompute/tests/unit/gpuResidentLaneManager.test.js` passed, `3/3`.
  - `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js peercompute/tests/unit/gpuResidentLaneManager.test.js` passed, `30/30`.
  - `git diff --check` passed in `/home/cos/projects/peercompute`.
  - `npm --prefix /home/cos/projects/peercompute/peercompute run build` passed with PeerCompute's existing circular chunk and large bundle warnings.
- Latest PeerCompute ULG runtime fence validation:
  - `node --check demos/multiscale/src/compute/ulgRuntimeTasks.js && node --check demos/multiscale/src/compute/solverWorkerDescriptors.js && node --check peercompute/src/peercompute/computeManager/ComputeManager.js && node --check demos/multiscale/tests/multiscaleModel.test.mjs` passed.
  - `node --test --test-name-pattern "ULG runtime worker|multiscale solver descriptors can attach|loopback remote placement admits ULG|loopback remote placement executor runs" demos/multiscale/tests/multiscaleModel.test.mjs` passed, `4/4`.
  - `node --test peercompute/tests/computeManager.unit.test.js peercompute/tests/unit/computeManager.commitDelta.test.js peercompute/tests/unit/computeManager.wasm.test.js peercompute/tests/unit/computeManager.worker.test.js` passed, `27/27`.
  - `node --test demos/multiscale/tests/multiscaleModel.test.mjs` passed, `203/203`.
  - `git diff --check` passed in `/home/cos/projects/peercompute`.
  - `npm --prefix /home/cos/projects/peercompute/peercompute run build` passed with PeerCompute's existing circular chunk and large bundle warnings.
- Recent immediate validation after the resident authority/lease and queue
  evidence slices:
  - `node --check src/runtime/webgpuComputeLayout.js && node --check src/runtime/sph/sphGridGpuKernel.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphG2pGpuKernel.js && node --check src/runtime/sph/sphThermalGpuKernel.js && node --check src/runtime/sph/sphMechanicsRefreshGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuSummary.js` passed.
  - `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js && node --check scripts/sph-long-horizon-probe.mjs && node --check tests/demo.e2e.mjs` passed.
  - `ULG_PROBE_MODE=direct-resident ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5191 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=2 ULG_PROBE_BATCH_STEPS=32 ULG_PROBE_TIMEOUT_MS=300000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-direct-64-final-summary.json node scripts/sph-long-horizon-probe.mjs` classified `good`.
  - `ULG_PROBE_MODE=scene ULG_PROBE_REPO_DIR=/home/cos/projects/ulg ULG_PROBE_PORT=5192 ULG_PROBE_URL='/#drop=h2o&base=h2o&dropt=300&baset=300&iceh=0&ironh=0.85&dropn=3&basen=5&boxx=5&boxy=5&boxz=5' ULG_PROBE_BATCHES=1 ULG_PROBE_BATCH_STEPS=1 ULG_PROBE_RENDER_EVERY=1 ULG_PROBE_TIMEOUT_MS=180000 ULG_PROBE_OUTPUT=/tmp/ulg-history-probes/current-h2o-scene-cadence-final-summary.json node scripts/sph-long-horizon-probe.mjs` classified `good` and reported `substeps=16 target=16`.
  - `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphGridUpdateGpuKernel.test.mjs tests/sphG2pGpuKernel.test.mjs tests/sphMechanicsRefreshGpuKernel.test.mjs tests/sphMlsMpmGpuSummary.test.mjs tests/residentStateAuthority.test.mjs` passed, `74/74`.
  - `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"` passed, `75/75`.
  - `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"` passed, `76/76`.
  - `node --check ulg-gpu-abi/src/index.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check tests/abi.test.mjs && node --test tests/abi.test.mjs tests/sphRenderGpuKernel.test.mjs --test-name-pattern "render field ABI|material interface|physics material interface|source field"` passed, `47/47`.
  - `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary"` passed, `76/76`.
  - `node --check src/visualization/sphPhaseDemoMount.js && node --check tests/demo.e2e.mjs && node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "pressure interface state|resident overlay|render"` passed, `18/18`.
  - `git diff --check` passed.
  - `npm run build` passed with Vite's existing large-chunk warning.
  - `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"` passed, `1/1`, about `2.3m`, after fixing the post-reset wait to require `resident-gpu-render-field` for WebGPU resident render readiness and asserting the new `material iface` status line.
  - `npm run icc:update` passed with `219` indexed files and `922` chunks.
  - ICC direct status reported `is_stale: false`.
- Latest ULG resident SPH GPU lane adapter validation:
  - `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
  - `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "compute task|GPU resident lane|retain buffers without full readback"` passed, `22/22`.
  - `node --test tests/sphMlsMpmGpuStep.test.mjs` passed, `22/22`.
  - `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary|GPU resident lane|compute task"` passed, `80/80`.
  - `npm test` passed, `439/439`.
  - `npm run build` passed with Vite's existing large-chunk warning.
  - `npm run icc:update` passed with `220` indexed files and `937` chunks.
  - `node --check src/runtime/sph/sphMlsMpmGpuStep.js` passed.
  - `node --check tests/sphMlsMpmGpuStep.test.mjs` passed.
  - `node --test tests/sphMlsMpmGpuStep.test.mjs` passed, `19/19`.
  - `node --check src/runtime/sph/sphMlsMpmGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/visualization/sphPhaseScene.js && node --check src/visualization/sphPhaseDemoMount.js && node --test tests/sphGridUpdateGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "queue|pressure|material interface|source field|resident|overlay|render|surface|stale CPU|ping-pong unread|no-full|cleanup preserves|merges carried|retained buffer|retained buffers|compact summary|resident summary|GPU resident lane"` passed, `77/77`.
  - `git diff --check` passed.
  - `npm test` passed, `436/436`.
  - `npm run build` passed with Vite's existing large-chunk warning.
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5273 PLAYWRIGHT_WEB_SERVER_URL=http://127.0.0.1:5273 PLAYWRIGHT_WEB_SERVER_COMMAND='npm run dev -- --host 127.0.0.1 --port 5273 --strictPort' PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"` passed, `1/1`, about `2.3m`. This used an isolated port because an existing `5173` listener returned `ERR_EMPTY_RESPONSE` to `npm run status:live`.
- The latest broader runtime validation recorded in
  `plan/implementation-status.md` includes full `npm test` and build passes
  around the render-field/draw-metadata checkpoints. Later product-event and
  ICC/tooling slices used focused validation. Before deeper runtime edits,
  rerun the focused SPH tests and preferably full `npm test`.

## Next Recommended Slice

Continue the P0 physics behavior remediation before counting more architecture
work as progress:

1. First continue `plan/todo/physics-behavior-regression-plan.md` from the
   current fixed boundary: the pressure/gas spike, G2P grid-origin mismatch,
   and four-substep cadence cap are fixed, but the H2O/H2O liquid/contact
   behavior is not proven. Next work should make corrected-cadence resident
   batches fast enough to cover a settling horizon, pair direct-resident
   compact telemetry with sparse scene/visual pressure-surface evidence, and
   add assertions for no detached blobs, no delayed cadence jumps, no unbounded
   pulsing, and no stale render-state contradiction before counting more
   WebGPU plumbing as progress.
2. Treat resident GPU surface draw as opt-in until the raw WebGPU overlay hang
   is fixed. The scene now supports `surfaceOverlay=1`, `surfaceOverlay=auto`,
   and `surfaceOverlay=0`, but the default remains disabled because the forced
   overlay probe timed out after `30000ms` in headless Chromium/SwiftShader.
   The fallback/default scene probe still classifies `good` with bounded H2O
   geometry and zero pressure impulse. Do not remove the Three/MarchingCubes
   visible fallback until the overlay path passes the visual/probe harness.
3. Use ICC chunk lookup plus direct `rg`/file reads around:
   - `src/runtime/residentStateAuthority.js`
   - `src/runtime/sph/sphMlsMpmGpuStep.js`
   - `src/runtime/sph/sphGridGpuKernel.js`
   - `src/runtime/sph/sphGridUpdateGpuKernel.js`
   - `src/runtime/sph/sphReactionGpuKernel.js`
   - `src/runtime/sph/sphReactionGpuSummary.js`
   - `src/runtime/sphPhaseDemo.js`
   - `src/visualization/sphPhaseScene.js`
4. Continue pressure/interface decoupling. The physics-owned
   `sphResidentMaterialInterfaceState` now refreshes before pressure force rows
   when visible rendering is skipped, and a material-interface source-field ABI
   wraps retained source buffers. The remaining source shader should stop
   sharing render naming/ownership and candidate/interface compaction should
   move fully GPU-side.
5. Wire ULG resident GPU lane worker submissions into the PeerCompute
   `peercompute.compute.gpu-fence-report.v0` contract. The local grid-update,
   render-field, surface-vertex, surface-draw, compact-summary,
   product-event merge/copy, and scene pressure upload cleanup paths already
   report readback-map, write-buffer ordering, or queue fence metadata. The
   PeerCompute Multiscale `ulg-runtime` descriptor/task path now proves remote
   fence admission, and `GpuResidentLaneManager` now provides the passive lane
   lease API. `ComputeManager` now also wraps declared inline GPU-lane tasks in
   those leases before local commit. ULG resident MLS-MPM/SPH has an optional
   shape-compatible adapter that can acquire/complete/reject those leases and
   publish copy budgets/fence evidence locally, plus a ComputeManager-shaped
   resident-step task bridge that returns required fence evidence without local
   double-leasing. The remaining work is wiring that task through a real
   ComputeManager/GPUHub resident-lane execution path for the whole SPH pass
   DAG, not adding another synthetic fence gate.
6. Extend repeated-step tests for queue/fence lease evidence, pressure rows
   without rendering, compact-summary non-authority, and bounded
   conservation/residual counters.
