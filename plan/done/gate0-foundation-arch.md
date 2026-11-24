# Gate 0 Formal ICC Acceptance Record (`ulg-gate0-foundation-arch`)

- **Status:** **ACCEPTED (`3/3 PASS`, `status: complete`)** on `FRESH` ICC index (`2026-11-23 AKST`)
- **Contract:** `ulg.gate0-foundation-arch.v1` (`.icc/completion-oracles.yaml:29-51`)
- **Accepted Git HEAD:** `b46bf13475d7a31f3bac61fa0ad1db5252e184ed` (`dirty: false`, branch `feat/star-spec-generalization-audit`, publication hold active)
- **Receipt Bundle:** `/home/cos/.cache/icc/repos/ulg/gate0-acceptance-20261123/gate0-reviewed-receipts.jsonl` (`15` SHA-256-hashed artifacts, `43/43` manifest files verified, `reviewWorktreeFingerprint: 973ca96dfeda02d9b851827b04cdcce61f91214da13fc650f7c887684522d37d`)
- **Independent Audit Lineage:**
  - Round 1 (`b1be203b`): **FAIL** (`2d851edd-a545-4be9-a737-bb13bda65d09`, preserved verbatim at `independent-review-round1-fail.md`) — passed Criterion 1, caught 3 Criterion 2 blockers (`B1`: `sphResidentProductHistoryParallelAppendGpu` mistakenly in `RETIRED_63_LIMB_MODULE_RE`; `B2`: `finalizeSphReactionStrictGateCpu` in `ulg-gpu-abi/src/sphReactionStrictGate.js` missed by `transform()` filter; `B3`: missing `S0_ATTRIBUTION=1` physics-vs-presentation split, 39 uncached bindGroup sites, and omitted `realtimePacing.boundaryFailures`).
  - Round 2 (`b46bf134`, remediating `B1–B3` + live production `dist/` worker bootstrap fix): **ACCEPT** (`1a8eddd4-1e7f-40c2-8d96-8478bc7ed602`, preserved verbatim at `independent-review.md`).

## Verified Gate 0 Deliverables
1. **0A — Official `peercompute/core.js` Consolidation & Production Bundle Hygiene:**
   - Single direct `peercompute/src/peercompute/core.js` import boundary across all of `src/` (`src/runtime/peercomputeCore.js:40`).
   - Production `npm run build` (`4.54 s`) outputs **`dist/` = `37 MB`** (`< 45 MB`, down from `117.5 MB`) with **`0` AI/`ort-wasm`/`wllama`/`transformers`/`sf3d` assets** (3 intentional Triad WASM modules under `dist/service-assets/`).
   - Shared worker entrypoints emitted cleanly in `vite.config.mjs` (and mirrored in `vite.pages.config.mjs`): `dist/assets/peercomputeCompute.worker.js` (`837 B`, registered via `registerDefaultWorkerBootstrapURL` in `src/main.js` & `src/sphStandalone.js`), `dist/assets/ulgMechanicsResidentStage.worker.js` (`345 KB`), and `dist/assets/sphMlsMpmGpuStep.js` (`14 KB`).
   - Live headless Vulkan smoke test against built `dist/index.html?preset=sodium-water&autoplay=1` (`dist-sodium-water-smoke.log`): **`ok: true`, `stepCount: 24`, `simTimeS: 0.024`, `blocked: false`, `authorityHostStatus: "ready"`, `workerReady: true`, `5` worker types booted, `pageErrors: []`, `consoleErrors: []`, `http404s: []`**.
2. **0B — Shared WebGPU Numerical Substrate (`src/runtime/gpuMath/`):**
   - `batchedSymmetricEigensolverGpu.js`, `fft3dWebGpu.js`, `molecularDynamicsWebGpu.js`, `chebyshevPolytopeFitGpu.js` (`@workgroup_size(64)`, zero hot-loop readbacks).
   - Native Vulkan `tests/gate0GpuMath.native.test.mjs`: **`1/1 PASS` (`4.23 s`)**.
3. **0C — Canonical Material-Bundle & Convex Polytope-Atlas ABIs:**
   - `ulg-gpu-abi/src/materialFoundationAbi.js` (`ulg.material-property-bundle.v1`, `ulg.polytope-atlas.v1`, `ulg.polytope-atlas-gpu-buffer.v1`, `ULG_ACCURACY_TIERS`, `packPolytopeAtlasForGpu`, fail-closed `evaluatePolytopeAtlasWgsl` with `valid_mode = 2` exp fits & `hitFlag == 0` out-of-domain invalidation) + `src/runtime/material/materialPolytopeRegistry.js`.
4. **0D — Continuum Zero-Churn Step Loop, Contact Dedup, `thermalPotential` Fix & Production 63-Limb/CPU-Mirror Retirement:**
   - `S0_ATTRIBUTION=1` on `g0-accept-r2-water` (`water-realtime`, `698` steps, `24.49 steps/s`, `0.196x` RT @ 50% CPU): `submits = 1.68 <= 2`, `computePasses = 15.43 <= 25`, `dispatchIndirect = 0.67 <= 16`, `mapAsync = 0`, `pipelines = 0`, `bindGroups = 7.24` (`-56%` vs `16.38`); attributed steady-state physics `createBuffer = 0.003/step` (`3,773/3,781 = 99.79%` presentation) and physics `bindGroups = 0.059/step` (`4,780/4,821 = 99.15%` presentation). `realtimePacing`: `k = 3`, `boundaryFailures = 1` (disclosed honestly).
   - `S0_ATTRIBUTION=1` on `g0-accept-r2-iron` (`iron-ice-quench`, `56` steps, `1.81 steps/s` @ 50% CPU): `encoders = 7.25` (`-80%` vs `36.06`), `computePasses = 19.95 <= 25` (`-37%` vs `31.53`), `dispatchIndirect = 9.59 <= 16`, `mapAsync = 0.13` (schedule-boundary only), `bindGroups = 15.77` (`-61%` vs `40.51`); attributed physics `createBuffer = 0/step` (`644/656 = 98.17%` presentation + `12` `g6-potential-*` over 3 candidate generations) and physics `bindGroups = 0.000/step` (`762/762 = 100.00%` presentation).
   - `getCachedPipelineBindGroupLayout` WeakMap cache (`src/runtime/webgpuComputeLayout.js`) eliminates Chromium/Dawn `getBindGroupLayout(0)` wrapper identity misses.
   - Overlapping iron-ice unilateral velocity contact deduplicated via `identity_enabled` bit 1 (`schroederSpatialMechanicalProposalsGpu.js` + `sphMlsMpmGpuStep.js`).
   - `thermalPotential` `'cadence-deferred'` status fix verified live (`ordinal: 1`, `status: "cadence-deferred"`, `cumulativeConsumerHits: 18144`, zero `deferred-capacity` stall).
   - Production `dist/` contains `0` `sphExactRational` modules, strips `finalizeSphReactionStrictGateCpu` & all `/src/runtime/sph/*Cpu` solver bodies, and preserves canonical `blocksA`/`blocksB` parallel product-history append.

## Verification Summary (`b46bf134`, `dirty: false`)
- `npm test`: **`6,213 pass / 0 fail / 0 cancelled`** (`197` opt-in skips, `6,410` total)
- `npm run build`: PASS (`4.54 s`, `37M dist/`, `0` AI/`ort-wasm` assets)
- Live built-`dist/` `sodium-water` smoke: PASS (`24` steps, `0` page/console/HTTP errors)
- `tests/gate0GpuMath.native.test.mjs`: PASS (`1/1`, `4.23 s`)
- `scripts/gpuprobe.sh` (`g0-accept-r2-water`, `g0-accept-r2-iron`, `S0_ATTRIBUTION=1`): PASS (`0` errors, `0` GPU errors, `0` Xid)
- `journalctl -k`: `KERNEL_CLEAN`
- `scientificValidation: false` and offline advisory-only G7 preserved. Remaining shared-device presentation/MC churn, full Section 3 budgets, inline WGSL Tier-1 Polytope Atlas evaluation, and private solid/dormancy SS collapse continue under **Gate 3 (`ulg-gate3-continuum-substrate-and-physics`)**.
