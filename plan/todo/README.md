# ULG Active Todo Index (Verified Against Live Code, 2026-11-22)

- **Start here:** Read [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md) first for
  execution order, honest G1–G7 / A1–A6 oracle status, Section 3 GPU budgets, and
  the prioritized next-work queue.
- **Historical todo log archive:** The superseded 3,638-line June–Nov routing log
  lives at [`plan/moot/superseded-todo-readme-log-2026-11-22.md`](../moot/superseded-todo-readme-log-2026-11-22.md).

Every file still in `plan/todo/` below corresponds to **verified open work** at
HEAD `23a961c4`. Completed items have been moved to [`plan/done/`](../done/);
superseded items have been moved to [`plan/moot/`](../moot/).

---

## 1. Campaign Master & Core Runtime Tracks (G1–G7, A1–A6)

> Only **G5** (`done/g5-reservation.md`) and **G7** (`done/g7-release-audit.md`)
> have formally accepted `ulg.campaign.receipt.v1` bundles. All tracks below
> remain open pending real live-code gap closure and formal oracle receipts.

| File | Track | Live-Code Reality & Open Work |
|---|---|---|
| [`seven-goal-campaign.md`](seven-goal-campaign.md) | Master | Formal G1–G7 + A1–A6 campaign contract & oracle criteria (referenced by `.icc/`). |
| [`a1-realtime-substrate.md`](a1-realtime-substrate.md) | A1 | Delete Coupling #8 render-cadence JS solver, deduplicate 5 contact responses, retire 63-limb rationals & CPU mirrors, cut 246 `@workgroup_size(1)` kernels, fix `device.lost`/`setHotBuffer` leaks, add `uncapturederror`. |
| [`a1-eshkol-coarse-dt.md`](a1-eshkol-coarse-dt.md) | A1 | `implicitPressure` is OFF on all standard presets; move Eshkol stiffness fit off CPU JS and promote inside 1% error envelope. |
| [`g2-integer-ledger-proposal.md`](g2-integer-ledger-proposal.md) | G2 | Exact 9-limb `2^-149` mass & `Σ(U − S)` ledgers implemented, **but OFF by default** on presets (`exactEnergyLedger=false`, `environmentMode='vacuum'`); retire 63-limb rationals; pass G2 oracle. |
| [`g2-exact-gpu-inventory.md`](g2-exact-gpu-inventory.md) | G2 | Exact GPU inventory design record paired with `g2-integer-ledger-proposal.md`. |
| [`g3-solids-proposal.md`](g3-solids-proposal.md) | G3 | Move rigid solids off 3 private 4,096-bucket hashes onto canonical SS cells; close all 5 pre-SOL-1 gates; pass G3 oracle. |
| [`a5-solid-fluid-coupling.md`](a5-solid-fluid-coupling.md) | A5 | Unify SOL-2/3 solid-fluid hashes into SS; fix SOL-4 N-level `mechanicsBuffer` no-op; fix SOL-5 zero `member_loads` + OOB buffer sizing; fix SOL-6 preset skip & `0` proxy consumers. |
| [`sol-critic.md`](sol-critic.md) | G3/A5 | Master coherent-solid & cross-level numerical contract (pre-SOL-1 gates, sparse CSR arena, cross-level coupling, extreme mass-ratio invariants). |
| [`g4-dynamic-laws-proposal.md`](g4-dynamic-laws-proposal.md) | G4 | Replace private 3D box grids with canonical SS active tree nodes; wire real `dispatchWorkgroupsIndirect` on all 4 live law families (currently 0/4!); fix `radiationEpsilonFluxWPerM2` & reaction/phase uncertainty. |
| [`scale-adaptive-law-activation-plan.md`](scale-adaptive-law-activation-plan.md) | G4/A3–A6 | Master Two Unifications & Tier 0–3 Closure Economy architecture spec. |
| [`g6-local-fit.md`](g6-local-fit.md) | G6 | `thermalPotential` ON by default & wired into thermal/radiation dormancy; close radiation epsilon / reaction-phase uncertainty gaps and pass G6 oracle. |
| [`a3-a4-regional-and-multidimensional-closures.md`](a3-a4-regional-and-multidimensional-closures.md) | A3/A4 | Bind `sphThermalRegionalClosureGpu` outputs to live GPU law shaders (0 consumers today); move A4 Chebyshev/response fitting from CPU JS onto GPU; enable on default presets. |
| [`a6-remote-derivation.md`](a6-remote-derivation.md) | A6 | Pass `device`/`lane` to `createWarmClosureMissBridge` (`sphPhaseScene.js:54631`) and `eshkolSample` in Triad synthesis (`warmClosureMissBridge.js:591`); remove `/@fs` paths; test real 2-machine WebRTC. |

---

## 2. Schroeder Simulation (`SS`) Hierarchy & Scale Architecture

| File | Live-Code Reality & Open Work |
|---|---|
| [`SS/README.md`](SS/README.md) | Updated 2026-11-22 SS routing index. |
| [`SS/schroeder-tree-and-algorithm-plan.md`](SS/schroeder-tree-and-algorithm-plan.md) | Enforce typed **Law Adapter Contract** (`:129`, see `plan/ss-law-architecture-assessment.md`); wire `schroederSpatialScaleAtlasGpu.js`, migration, split/coarsen, and fix broken worker multipole call (`:15758`); run 3+ SS levels on live presets. |
| [`SS/dynamic-hierarchy-lod.md`](SS/dynamic-hierarchy-lod.md) | Connect `createDynamicHierarchyLodController` (currently write-only telemetry with hardcoded booleans) and `schroederActiveNodeCompactionGpu.js` (0 live consumers) to real dynamic level refinement/coarsening. |

---

## 3. Physics Interface, Air, Contact, & Steam Closures

| File | Live-Code Reality & Open Work |
|---|---|
| [`first-class-air.md`](first-class-air.md) | Default presets still run 1-level vacuum; enable Slice 1c worker split/merge by default; derive Slice 4 dilute-gas `k, μ` from `pairPotential.js` (still CRC/NIST bank); retire Slice 6 single-level implicit-atmosphere stand-in. |
| [`interface-resolution.md`](interface-resolution.md) | Enable automatic phase-front carrier refinement & split/coarsen on live scenes (`executeRepresentativeParticleSplitAndBulkCoarsen` has 0 callers in `src/`). |
| [`selective-contact-law-application-plan.md`](selective-contact-law-application-plan.md) | A/B and deduplicate the 5 overlapping contact responses at the iron-ice interface down to one coherent contact law. |
| [`surface-contact-transport-phase-closure-plan.md`](surface-contact-transport-phase-closure-plan.md) | Replace magic `80/82/24` isovalues (`sphPhaseScene.js:9520`), hardcoded `0.04` bulk alpha (`wgsl.js:10689`), and legacy `1500` conduction on non-SS path. |
| [`phase-resolved-steam-optics-plan.md`](phase-resolved-steam-optics-plan.md) | GPU κ-Köhler, Maxwell–Mason, and Stokes parcel stages are wired on the exact-ledger path, **but dormant on default vacuum presets**; add two-way gas-parcel momentum coupling and generalize hardcoded water/air parcel law constants. |

---

## 4. Frontier Materials, Eshkol/MoonLab, Multiscale, Distribution, & UX Backlog

| File | Live-Code Reality & Open Work |
|---|---|
| [`eshkol-higher-order-law-closure-plan.md`](eshkol-higher-order-law-closure-plan.md) | `eshkolHigherOrderLawCompiler.js` exists standalone, **NOT wired into any live SPH step** (worker only imports `LAW_FALLBACK_POLICY` enum). |
| [`algorithm-derived-material-properties-plan.md`](algorithm-derived-material-properties-plan.md) | Ongoing first-principles algorithm-shaped material closure derivations. |
| [`material-property-json-bank-plan.md`](material-property-json-bank-plan.md) | `elements.json` has 111 rows (106 `reduced-estimate`, 30 `reference-fallback`, missing 7 noble gases); `compounds.json` is 15/15 `reference-fallback`; crystal structures 7 `reference-fallback`. |
| [`material-polytope-registry-and-property-fit-plan.md`](material-polytope-registry-and-property-fit-plan.md) | `materialPolytopeRegistry` does **not** exist in `src/` yet (only a cosmetic HUD wireframe in `cosmicQuantumZoomDemo.js`). |
| [`sedenion-reaction-scoping-plan.md`](sedenion-reaction-scoping-plan.md) | **Active code bug:** `reactionCandidates.js:282, 362` drops `'inert'` candidates (`return null`) instead of only prioritizing them — fix to strictly prioritize without suppressing balanced channels. |
| [`webgpu-material-property-resolvers-plan.md`](webgpu-material-property-resolvers-plan.md) | Optical GPU resolver partially hybrid; `radialKohnShamWebGpu.js` reads `vElec` back to CPU every SCF iter; `periodicBulkDft.js` & `molecularHartreeFock.js` are 100% CPU JS; tracks remaining quantitative electronic-structure shortfalls from archived `done/frontier-todo.md`. |
| [`electron-cloud-material-derivation-visualization-plan.md`](electron-cloud-material-derivation-visualization-plan.md) | Phase 1 3D volumetric orbital raymarcher shipped (`volumetricOrbitalRaymarcher.js`); interactive polytope-discovery / sampling / fit diagnostic visualization still open. |
| [`hydrogen-nebula-to-star-fusion-bridge-plan.md`](hydrogen-nebula-to-star-fusion-bridge-plan.md) | Phase 1 `stellar-genesis.html` + generalized GPU `self-gravitating-hydro@1` shipped; share Scale Atlas multipole with SS & Cosmic-Quantum and add G7 Lane-Emden / MESA benchmarks. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Real 2-machine WebRTC `RTCPeerConnection` proof, spatial domain partitioning across peers, and removing `/@fs` hardcoded paths + unpinned Node engines. |
| [`cold-start-cache-performance-plan.md`](cold-start-cache-performance-plan.md) | Persistent shader/closure warm cache, `maxStorageBufferBindingSize` clamping on marching cubes (`sphPhaseScene.js:3279`), and `verify-pages-build.mjs` variable-held `/@fs` scan. |
| [`nitpicks.md`](nitpicks.md) | Open Studio & mount UX items: material-derived initial body dimensions, automatic overlap/OOB resolution with box expansion, pause-on-edit consistency, residual PBD drag. |
