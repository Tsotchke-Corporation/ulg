# ULG Active Todo Index (Unified 40-OOM Scale-Ladder Roadmap, 2026-11-23)

- **Start here:** Read [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md) first for
  the full **40-order-of-magnitude bottom-up + bidirectional bookend roadmap
  (`10⁻¹⁵ m` Nuclear → `10⁺²⁵ m` Supergalactic)**, honest 8-gate scorecard (**6/8
  formally accepted:** `G5`, `G7`, [`Gate 0`](../done/gate0-foundation-arch.md),
  [`Gate 1`](../done/gate1-periodic-table.md),
  [`Gate 2`](../done/gate2-reactions-polytope-atlas.md), and
  [`Gate 4`](../done/gate4-studio-presentation.md); only Gates 3 and 5 honestly
  `in_progress` at `b46bf134`), Section 3 GPU budgets, and exact execution
  sequence.
- **Historical todo log archive:** The superseded 3,638-line June–Nov routing log
  lives at [`plan/moot/superseded-todo-readme-log-2026-11-22.md`](../moot/superseded-todo-readme-log-2026-11-22.md).

Every file in `plan/todo/` below corresponds to **verified open work** (`33`
active files; `nitpicks.md` completed and moved to [`plan/done/nitpicks.md`](../done/nitpicks.md)).
Completed items live in [`plan/done/`](../done/); superseded items live in
[`plan/moot/`](../moot/).

---

## Priority 0 — Gate 0: Architectural & GPU Numerical Foundation — **FORMALLY ACCEPTED (`3/3 PASS`, 2026-11-23)**

> Formal acceptance record: [`plan/done/gate0-foundation-arch.md`](../done/gate0-foundation-arch.md) (`b46bf134`, `3/3 PASS`). The files below remain open in `plan/todo/` strictly for **Gate 3** shared-device presentation/MC churn, full Section 3 continuum budgets, OPFS warm cache, and post-acceptance refinements.

| File | Gate | Live-Code Reality (`b9e86811`, 2026-11-23) & Open Work |
|---|---|---|
| [`periodic-table-polytope-atlas-foundation-plan.md`](periodic-table-polytope-atlas-foundation-plan.md) | **Gate 0 / 1 / 2 (Master)** | **Gate 1 & Gate 2 FORMALLY ACCEPTED (`3/3 PASS`, `b9e86811`):** See [`plan/done/gate1-periodic-table.md`](../done/gate1-periodic-table.md) & [`plan/done/gate2-reactions-polytope-atlas.md`](../done/gate2-reactions-polytope-atlas.md). Retained in `plan/todo/` strictly for remaining **Gate 0D** iron-ice Zero-Churn & optional post-acceptance fidelity/OPFS refinements (4-comp Dirac–KS/`DFT+U`, `Pu/Am/Bk` `5f` potential clamp, extended covalent `SiO2`, OPFS cache). |
| [`cold-start-cache-performance-plan.md`](cold-start-cache-performance-plan.md) | Gate 0A | **0A DONE (`0af39d00`):** `peercomputeCore.js` + `worker.plugins` cut `dist/` **`117.5 MB → 36 MB`** (`0` `ort-wasm`/`transformers`/`sf3d` assets). Open: persistent IndexedDB/OPFS warm cache for derived Polytope Atlases & compiled WebGPU pipelines. |
| [`a1-realtime-substrate.md`](a1-realtime-substrate.md) | Gate 0D / Gate 3 | **0D Slices 1–2 DONE (`13bfda97`, `ca9824d8`):** `water-realtime` K-step pacing fixed (`0` boundary failures, `k=3`, **`submits 1.72 <= 2`**, `computePasses 16.24 <= 25`, `mapAsync 0`, **`15.45 steps/s` (`3.07x` faster!)**, GPU mean **`7.8%`**); 7 SS view bindGroup caches upgraded to 8-slot LRU + `nativeSurfaceTemperatureWgsl` slab binding (`iron-ice` **`bindGroups 40.51 → 30.79`**, `submits 4.30 → 3.65`, **`steps/s 2.61 → 3.77` (`+44%`)**, GPU mean **`8.0%`**). Open: drive `iron-ice` to `<= 25` passes / `<= 2` submits / `0` per-step `workDone` / `0` transient `createBuffer`, push `water-realtime` to `>= 1.0x` RT, deduplicate 5 contact laws, retire unused 63-limb `sphExactRational*`. |
| [`selective-contact-law-application-plan.md`](selective-contact-law-application-plan.md) | Gate 0D / Gate 3 | Duplicate solid-fluid 4,096-bucket thermal/contact spatial hash collapsed (`13bfda97`); open: A/B & deduplicate the 5 overlapping iron-ice contact responses down to 1 canonical GPU contact authority and retire legacy duplicate contact tests. |

---

## Priority 1 — Gate 1: Complete Periodic Table First-Principles Engine (`10⁻¹⁵ → 10⁻⁹ m`, `Z = 1..118` + Full `(Z, A)` Isotopes) — **FORMALLY ACCEPTED (`3/3 PASS`, 2026-11-23)**

> Formal acceptance record: [`plan/done/gate1-periodic-table.md`](../done/gate1-periodic-table.md) (`b9e86811`, `3/3 PASS`). The files below remain open solely for optional post-acceptance fidelity deepening (4-comp Dirac–KS/`DFT+U`, `Pu/Am/Bk` `5f` potential refinement, 3D Fermi surface, legacy CRC test retirement).

| File | Gate | Live-Code Reality (`b9e86811`, 2026-11-23) & Optional Post-Acceptance Work |
|---|---|---|
| [`webgpu-material-property-resolvers-plan.md`](webgpu-material-property-resolvers-plan.md) | Gate 1 (Accepted) | **Gate 1 ACCEPTED (`b9e86811`):** Zero CPU interband fallbacks, `0` SCF readbacks, 5 crystal classes, `50/50` exact 4-atom HCP volumes, metallic `fcc` `Pd`, `95` distinct element sRGBs, `1e6` MSD precision, full `(Z, A)` isotopes. Optional deepening: 4-comp Dirac–KS / `DFT+U` / `Pu/Am/Bk` `5f` clamp. |
| [`electron-cloud-material-derivation-visualization-plan.md`](electron-cloud-material-derivation-visualization-plan.md) | Gate 1 / 2 (Accepted) | **Gate 1–2 ACCEPTED (`b9e86811`):** Real WebGPU 3D volumetric & zero-copy instanced MD renderer (`cameraAutoSpin: false`, `116,314` changed px across 10 inspected Wayland PNGs), clickable `118×200` Chart of Nuclides, live WebGPU CI-NEB barrier, live WGSL Polytope Atlas. Optional: full 3D Fermi isosurface & spin-difference `ρ_↑ − ρ_↓` slices. |
| [`material-property-json-bank-plan.md`](material-property-json-bank-plan.md) | Gate 1 / 2 (Accepted) | **Gate 1–2 ACCEPTED (`b9e86811`):** `elements.json` `118/118` + [`foundation-polytope-atlas.json`](../../data/material-properties/foundation-polytope-atlas.json) (`118` elements + `20` compounds covering `15/15` legacy `compounds.json`, persisted 4-phase GPU Chebyshev fits, `provenance` mirrored on `138/138`, `0` `reference-fallback`). Open: retire legacy CRC `compounds.json` tests once formal G7 benchmark switches over. |
| [`algorithm-derived-material-properties-plan.md`](algorithm-derived-material-properties-plan.md) | Gate 1 / 2 (Accepted) | **Gate 1–2 ACCEPTED (`b9e86811`):** Gate 1–2 5-domain isotope-aware bundles, Eshkol/MoonLab 5-slot GPU A4 packing, and automatic Studio worker Triad seeding (`foundationPolytopeAtlasGpuBridge.js`) landed & verified. |

---

## Priority 2 — Gate 2: Chemical Reactions → Compound Feedback Loop → Convex Polytope Atlas (`10⁻¹⁰ → 10⁻⁶ m`) — **FORMALLY ACCEPTED (`3/3 PASS`, 2026-11-23)**

> Formal acceptance record: [`plan/done/gate2-reactions-polytope-atlas.md`](../done/gate2-reactions-polytope-atlas.md) (`b9e86811`, `3/3 PASS`, `142,457` adversarial interior probes `< 0.6%` ambient gases / `< 3.40%` structured interior). Files below track remaining Gate 3 in-shader integration, OPFS caching, and multi-step reaction network expansion.

| File | Gate | Live-Code Reality (`b9e86811`, 2026-11-23) & Open Work |
|---|---|---|
| [`material-polytope-registry-and-property-fit-plan.md`](material-polytope-registry-and-property-fit-plan.md) | Gate 2 (Accepted) / Gate 3 | **Gate 2 ACCEPTED (`b9e86811`):** Persisted 4-phase GPU Chebyshev fits (`valueTransform: "exp"`, `valid_mode = 2` in WGSL), fail-closed hydration & `hitFlag == 0` rejection, `142,457` probes PASS. Open for Gate 3: wire `evaluatePolytopeAtlasWgsl` directly into hot-loop MPM/SPH WGSL kernels + persistent OPFS/IndexedDB Atlas cache. |
| [`sedenion-reaction-scoping-plan.md`](sedenion-reaction-scoping-plan.md) | Gate 2 (Accepted) | **Gate 2 ACCEPTED (`b9e86811`):** 100% WebGPU `climbingImageNEBWebGpu`, `discoverAndDeriveReactionProductsWebGpu` (`Na + H2O → NaOH + H2`), Slater+Allred–Rochow ionic/covalent crystals, isotopologue parser + ZPE feedback. Optional post-acceptance: extended covalent `SiO2` prototype & GPU-batched multi-step reaction networks. |

---

## Priority 3 — Gate 3: Macroscopic Continuum Engine & Unified SS (`10⁻⁶ → 10⁺² m`)

> Consumes the Gate 2 Polytope Atlas natively at Tier-1 GPU speed, unifies all
> solids and dynamic laws onto canonical Schroeder Simulation (`SS`) cells,
> turns on exact `2^-149` ledgers & multi-level first-class air by default, and
> passes Section 3 GPU budgets. Consolidates legacy A1–A6, G2–G4, G6.

| File | Sub-Track | Live-Code Reality (`d687b37e`, 2026-11-23) & Open Work |
|---|---|---|
| [`SS/README.md`](SS/README.md) | SS Index | Updated SS hierarchy routing index. |
| [`SS/schroeder-tree-and-algorithm-plan.md`](SS/schroeder-tree-and-algorithm-plan.md) | A2 / SS | `lawAdapterContract.js` & worker multipole `{ atlas }` fixed (P0/P1); open: run 3+ SS levels on default presets, wire Scale Atlas migration & split/coarsen into step loop, replace `76` `replaceRequiredWgsl` patches. |
| [`SS/dynamic-hierarchy-lod.md`](SS/dynamic-hierarchy-lod.md) | A2 / LOD | Physical observables wired into `createDynamicHierarchyLodController` (P2); open: connect `schroederActiveNodeCompactionGpu.js` to live dynamic level refinement/coarsening. |
| [`scale-adaptive-law-activation-plan.md`](scale-adaptive-law-activation-plan.md) | G4 / A3–A6 | Master Two Unifications (SS + Tier 0–3 Closure Economy) architecture spec. |
| [`g4-dynamic-laws-proposal.md`](g4-dynamic-laws-proposal.md) | G4 | `propose_active` indirect dispatch + G6 uncertainty wired on reaction discovery (P1); open: move thermal/reaction dormancy off private 3D box grids onto canonical SS tree nodes & switch all 4 law families to `dispatchWorkgroupsIndirect`. |
| [`g6-local-fit.md`](g6-local-fit.md) | G6 | `radiationEpsilonFluxWPerM2` & packed uncertainty propagation fixed (P1); open: fix live `iron-ice-quench` `thermalPotential` `deferred-capacity` stall (`0` hits). |
| [`a3-a4-regional-and-multidimensional-closures.md`](a3-a4-regional-and-multidimensional-closures.md) | A3 / A4 | Live GPU A3 radiation consumer + `thermo0.x/z` swap fixed, GPU Chebyshev fitter (`responseFunctionFitGpu.js`) & worker `eshkolHigherOrderLawCompiler` wired (P1); open: retire CPU startup fitters & connect to Gate 2 Polytope Atlas. |
| [`a1-eshkol-coarse-dt.md`](a1-eshkol-coarse-dt.md) | A1 / A4 | `implicitPressure` remains OFF on standard presets; promote inside 1% error envelope after Gate 0D. |
| [`eshkol-higher-order-law-closure-plan.md`](eshkol-higher-order-law-closure-plan.md) | A4 / Triad | Worker `eshkolHigherOrderLawCompiler` wired (P1); per-lane dynamic WGSL synthesis & Polytope Atlas integration remain open. |
| [`a6-remote-derivation.md`](a6-remote-derivation.md) | A6 / Triad | Live `eshkolSample` adoption, `/@fs` removal, and real 2-browser-context WebRTC `RTCDataChannel` proof PASS (P0/P3); open: `peercompute-core` slim split (Gate 0A) & physical 2-host WAN validation (Gate 5D). |
| [`g2-integer-ledger-proposal.md`](g2-integer-ledger-proposal.md) | G2 | Generalized vapor-parcel ledger, GPU two-way Stokes drag, and Chapman–Enskog gas `k, μ` landed (P2); open: enable `exactEnergyLedger` & first-class air by default after Gate 0D restores Section 3 headroom. |
| [`g2-exact-gpu-inventory.md`](g2-exact-gpu-inventory.md) | G2 | Exact `2^-149` GPU inventory design record paired with `g2-integer-ledger-proposal.md`. |
| [`first-class-air.md`](first-class-air.md) | G2 / Air | Slice 4 Chapman–Enskog dilute-gas `k, μ` landed (P2); open: default multi-level air + worker split/merge & retiring Slice 6 single-level implicit-atmosphere stand-in. |
| [`interface-resolution.md`](interface-resolution.md) | G2 / SS | Wire `executeRepresentativeParticleSplitAndBulkCoarsen` into live scenes for automatic phase-front carrier refinement. |
| [`phase-resolved-steam-optics-plan.md`](phase-resolved-steam-optics-plan.md) | G2 / Optics | Two-way GPU Stokes drag & generalized vapor-parcel laws landed (P2); open: enable on default room-air presets after Gate 0D. |
| [`g3-solids-proposal.md`](g3-solids-proposal.md) | G3 | 3 pre-SOL-1 gates closed in P2 (material-derived contact, exposed-face radiation, co-rotational smear); open: move rigid solids off 3 private 4,096-bucket hashes onto canonical SS cells, `bodyId` product placement, multi-level rigid coupling. |
| [`a5-solid-fluid-coupling.md`](a5-solid-fluid-coupling.md) | A5 | SOL-4 N-level `mechanicsBuffer`, SOL-5 OOB/zero-load waste, and SOL-6 `10³`/`3³` proxy quadrature consumer fixed (P0/P2); open: unify solid-fluid hashes onto SS cells, sparse CSR arena, cross-level coupling. |
| [`sol-critic.md`](sol-critic.md) | G3 / A5 | Master coherent-solid & cross-level numerical contract. |
| [`seven-goal-campaign.md`](seven-goal-campaign.md) | Legacy Lineage | Historical G1–G7 + A1–A6 campaign criteria (preserved for audit continuity; superseded as active routing by `plan/CURRENT-PLAN.md` Gates 0–5). |

---

## Priority 4 — Gate 4: Interactive Studio Presentation & Real-Time Optics (`10⁻³ → 10⁺² m`) — **FORMALLY ACCEPTED (`3/3 PASS`, 2026-11-23)**

> Formal acceptance record: [`plan/done/gate4-studio-presentation.md`](../done/gate4-studio-presentation.md)
> (`44bb6f13`, `3/3 PASS`: all 5 active Studio presets `72.96–113.25 Hz` mean
> presented, `62–100 Hz` min sustained 500ms, `25.3–33.5 ms` max gap, `5/5`
> Pause/Step/Reset across lane rebuilds, `3/3` native Vulkan optics PASS,
> `6,212/6,212` host tests PASS, `KERNEL_CLEAN`). File below remains open solely
> for remaining Gate 3 non-SS conduction retirement.

| File | Gate | Live-Code Reality (`44bb6f13`, 2026-11-23) & Remaining Gate 3 Work |
|---|---|---|
| [`surface-contact-transport-phase-closure-plan.md`](surface-contact-transport-phase-closure-plan.md) | Gate 3 / Gate 4 (Accepted) | **Gate 4 ACCEPTED (`44bb6f13`):** All 5 active Studio presets verified `>= 54 Hz` visibly advancing true-isosurface presentation (`visibleMotionCadenceVerified: true`, `resetVerified: true`, `water-realtime` `113.25 Hz` / `1.84–2.09x` RT). Remaining Gate 3 item: retire legacy non-SS conduction path. |

---

## Priority 5 — Gate 5: Planetary → Stellar → Galactic → Supergalactic Cosmology (`10⁺⁶ → 10⁺²⁵ m`)

> Completes ULG's 40-order-of-magnitude scale ladder on the **exact same GPU
> primitives** built in Gates 0–3: `fft3dWebGpu` (Gate 0B) + canonical `SS`
> Scale Atlas multipole + Gate 1 nuclear/atomic closures + Gate 2 Polytope
> Atlases + `peercompute-core` multi-host domain partitioning.

| File | Sub-Scale | Live-Code Reality (`c09644f8`, 2026-11-23) & Open Work |
|---|---|---|
| [`planetary-to-supergalactic-scale-atlas-plan.md`](planetary-to-supergalactic-scale-atlas-plan.md) | **Gate 5 (Master)** | **5A–5D + Priority 5 Hybrid TreePM, Canonical Scale-Atlas Multipole & 2-Browser WebRTC TreePM LANDED & VERIFIED (`c09644f8`):** `planetaryStructureGpu.js`, `stellarNucleosynthesisBridge.js`, `galacticIsmCoolingGpu.js`, **`scaleAtlasAstrophysicsGravityBridge.js`** wired into BOTH `selfGravitatingHydroGpu.js` & `cosmicQuantumGpuKernels.js` (`momentumRelError < 1e-4`, `+5000` shift `< 1e-4`), **Hybrid FLRW TreePM** (`supergalacticTreePmGpu.js`: short-range `3×3×3` Gaussian-split tree + long-range `fft3dWebGpu` PM), and **2-browser-context WebRTC `RTCDataChannel` multi-host TreePM** (`priority5ScaleAtlasAndWebRtcTreePm.native.test.mjs`). Open: physical 2-machine WAN/TURN validation after `agy` ships PeerCompute extensions & formal receipt. |
| [`hydrogen-nebula-to-star-fusion-bridge-plan.md`](hydrogen-nebula-to-star-fusion-bridge-plan.md) | Gate 5B (Stellar) | `selfGravitatingHydroGpu.js` wired onto canonical `SchroederScaleAtlas` multipole (`evaluateSelfGravitatingHydroScaleAtlasMultipoleWebGpu`, `c09644f8`) + Gate 1 nuclear Q-values & RK4 Lane–Emden in `stellarNucleosynthesisBridge.js`; open: retire internal octree fallback & add MESA advisory tables. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Gate 5D / Multi-Host | **2-Browser-Context WebRTC `RTCDataChannel` A6 (`priority3GpuAndWebRtc`) + Multi-Host TreePM (`priority5ScaleAtlasAndWebRtcTreePm`, signaling WS closed + G5 CAS leases + fail-closed peer-loss reassignment) PASS (`c09644f8`)**; open: physical 2-machine WAN/NAT/STUN/TURN validation once `agy` ships `../peercompute` extensions. |
