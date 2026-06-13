# ULG Todo Handoff - 2026-06-12

Timestamp: 2026-06-12 15:51 AKDT

## Current Snapshot

- Repo: `/home/cos/projects/ulg`
- Branch: `main`
- Current `HEAD`: `f0d101f7b23eee19cebcd44755292d010c5b15fd`
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

## Recent Completed Work

### ICC And Tooling

- Added `.icc/` policy files for ULG and rewrote them to be ULG-native rather
  than copied sibling-repo wording.
- Added `scripts/update-icc.mjs` and `npm run icc:update`.
- Reinitialized ICC artifacts non-destructively by moving the old generated
  artifact root to
  `/home/cos/projects/infinite_context_coder/artifacts/repos/ulg.reinit-20260612-154227`.
- Rebuilt ICC from scratch. Current result: `207` indexed files and `879`
  memory chunks after the latest plan/log updates.
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

1. Finish reaction/product/gas dynamics:
   - validated pressure-gradient or gas-cell force coupling;
   - multi-generation product-event append/compaction;
   - stricter atom/mass/charge/energy residual parity.
2. Finish sealed-gas and steam microphysics:
   - per-species gas inventory;
   - H2O vapor/condensation/droplet state;
   - pressure and optical response from resident state.
3. Add iron-on-ice scenario preflight and controls:
   - exact 10 m sealed box, 1 m Fe cube, 1 m H2O cube;
   - six wall-temperature sliders;
   - particle count controls;
   - represented atoms/molecules per macro-particle;
   - enthalpy and wall heat ledgers;
   - fail preflight when final state is thermodynamically implausible.
4. Continue WebGPU hot-loop work:
   - prefix/compaction for surface vertices;
   - indirect draw rows;
   - Three.js/WebGPU-integrated continuous volume renderer;
   - compact summaries instead of full particle/grid readback;
   - WebGPU-Ocean-style fixed-point/tiled scatter where needed.
5. Move material property resolvers toward WebGPU:
   - resolver manifest first;
   - optical/EOS/thermal table consumers;
   - flat closure graph rows;
   - atomic and molecular solver kernels later.
6. Return to cold-start performance polish only after schemas stabilize:
   - stale-record browser probes;
   - measured cold/warm/clear deltas;
   - GPU warmup persistence where WebGPU allows it.
7. Nuclear/radiation/Cherenkov stays later:
   - define isotope/radiation ABI;
   - energy deposition/daughter ledgers;
   - Cherenkov source rows from particle speed, medium IOR, and spectral
     response.
8. Cross-repo integration:
   - PeerCompute receiver still needs to accept MoonLab reduced browser WebGPU
     parity-scope evidence without treating it as full physics/runtime proof.

## Problems To Keep In Mind

- Performance is still the biggest practical risk. The runtime is not close to
  60 Hz while CPU MarchingCubes, JavaScript closure derivation, and readback
  paths remain active.
- The visible simulation should be manually watched after physics changes.
  Prior user reports included "physics FPS moving but no visible motion"; later
  reset-path continuity and pressure-row wiring were fixed, but live visual
  motion still needs repeated verification.
- The current WebGPU marching-cubes work is an ABI/kernel path, not yet a clean
  renderer replacement.
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

- This handoff slice has not rerun the full runtime suite yet.
- Recent immediate validation before this file:
  - `npm run icc:update` passed with `208` indexed files and `882` chunks
    after this handoff was added.
  - ICC direct status reported `is_stale: false`.
  - `git diff --check` passed.
  - `/home/cos/.codex/skills/icc/SKILL.md` frontmatter/body validation passed.
- The latest broader runtime validation recorded in
  `plan/implementation-status.md` includes full `npm test` and build passes
  around the render-field/draw-metadata checkpoints. Later product-event and
  ICC/tooling slices used focused validation. Before deeper runtime edits,
  rerun the focused SPH tests and preferably full `npm test`.

## Next Recommended Slice

Start with reaction/product pressure dynamics rather than cold-start polish:

1. Use ICC chunk lookup plus direct `rg`/file reads around:
   - `src/runtime/sph/sphMlsMpmGpuStep.js`
   - `src/runtime/sph/sphGridGpuKernel.js`
   - `src/runtime/sph/sphGridUpdateGpuKernel.js`
   - `src/runtime/sph/sphReactionGpuKernel.js`
   - `src/runtime/sph/sphReactionGpuSummary.js`
   - `src/runtime/sphPhaseDemo.js`
   - `src/visualization/sphPhaseScene.js`
2. Add or finish the gas-cell/pressure-gradient resident force coupling that
   consumes product-event/gas inventory state as dynamics, not only diagnostics.
3. Add conservation/parity tests before enabling any new force application in
   the live path.
4. Manually watch the browser for several minutes after the change and confirm
   visible motion matches the physics diagnostics.
