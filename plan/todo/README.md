# ULG Active Todo Index (Unified 40-OOM Scale-Ladder Roadmap, 2026-11-23)

- **Start here:** Read [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md) first for
  the full **40-order-of-magnitude bottom-up + bidirectional bookend roadmap
  (`10⁻¹⁵ m` Nuclear → `10⁺²⁵ m` Supergalactic)**, honest 8-gate scorecard (`G5`
  & `G7` accepted; `Gate 0`–`Gate 5` + **Priorities 1–5** implemented &
  Vulkan/WebRTC-verified through `c09644f8`, pending formal receipt capture &
  remaining Gate 0D/3/4 targets), Section 3 GPU budgets, and exact execution sequence.
- **Historical todo log archive:** The superseded 3,638-line June–Nov routing log
  lives at [`plan/moot/superseded-todo-readme-log-2026-11-22.md`](../moot/superseded-todo-readme-log-2026-11-22.md).

Every file in `plan/todo/` below corresponds to **verified open work** (`33`
active files; `nitpicks.md` completed and moved to [`plan/done/nitpicks.md`](../done/nitpicks.md)).
Completed items live in [`plan/done/`](../done/); superseded items live in
[`plan/moot/`](../moot/).

---

## Priority 0 — Gate 0: Architectural & GPU Numerical Foundation *(Do First)*

> Builds the shared WebGPU numerical substrate (`gpuMath`: eigensolver, 3D FFT,
> GPU MD, GPU Chebyshev), slim `peercompute-core` packaging, canonical
> Material-Bundle & Polytope-Atlas ABIs, and Continuum Zero-Churn Step Loop.

| File | Gate | Live-Code Reality (`c09644f8`, 2026-11-23) & Open Work |
|---|---|---|
| [`periodic-table-polytope-atlas-foundation-plan.md`](periodic-table-polytope-atlas-foundation-plan.md) | **Gate 0 / 1 / 2 (Master)** | **Primary Foundation Blueprint:** Gate 0A–0C, Gate 1 (`Z=1..118` + **Priority 1 end-to-end `(Z, A)` isotopes & isotopologues** + clickable Chart of Nuclides), and Gate 2 (`molecularHartreeFockWebGpu`, `recursiveCompoundPipeline`, **Priority 5 live CI-NEB reaction barrier visuals**, **Priority 3 `20` compounds covering `15/15` `compounds.json` with `0` `reference-fallback`**, and `foundationPolytopeAtlasGpuBridge.js`) **landed & Vulkan-verified**. Open: remaining Gate 0D iron-ice churn, deeper 4-comp Dirac/`DFT+U` refinements, OPFS Atlas cache, and formal `ulg.campaign.receipt.v1`. |
| [`cold-start-cache-performance-plan.md`](cold-start-cache-performance-plan.md) | Gate 0A | **0A DONE (`0af39d00`):** `peercomputeCore.js` + `worker.plugins` cut `dist/` **`117.5 MB → 36 MB`** (`0` `ort-wasm`/`transformers`/`sf3d` assets). Open: persistent IndexedDB/OPFS warm cache for derived Polytope Atlases & compiled WebGPU pipelines. |
| [`a1-realtime-substrate.md`](a1-realtime-substrate.md) | Gate 0D / Gate 3 | **0D Slices 1–2 DONE (`13bfda97`, `ca9824d8`):** `water-realtime` K-step pacing fixed (`0` boundary failures, `k=3`, **`submits 1.72 <= 2`**, `computePasses 16.24 <= 25`, `mapAsync 0`, **`15.45 steps/s` (`3.07x` faster!)**, GPU mean **`7.8%`**); 7 SS view bindGroup caches upgraded to 8-slot LRU + `nativeSurfaceTemperatureWgsl` slab binding (`iron-ice` **`bindGroups 40.51 → 30.79`**, `submits 4.30 → 3.65`, **`steps/s 2.61 → 3.77` (`+44%`)**, GPU mean **`8.0%`**). Open: drive `iron-ice` to `<= 25` passes / `<= 2` submits / `0` per-step `workDone` / `0` transient `createBuffer`, push `water-realtime` to `>= 1.0x` RT, deduplicate 5 contact laws, retire unused 63-limb `sphExactRational*`. |
| [`selective-contact-law-application-plan.md`](selective-contact-law-application-plan.md) | Gate 0D / Gate 3 | Duplicate solid-fluid 4,096-bucket thermal/contact spatial hash collapsed (`13bfda97`); open: A/B & deduplicate the 5 overlapping iron-ice contact responses down to 1 canonical GPU contact authority and retire legacy duplicate contact tests. |

---

## Priority 1 — Gate 1: Complete Periodic Table First-Principles Engine (`10⁻¹⁵ → 10⁻⁹ m`, `Z = 1..118` + Full `(Z, A)` Isotopes)

> Flagship demo [`elements-lab.html`](../../elements-lab.html) landed & visually
> verified across all 6 live GPU tabs + interactive **`(Z, A)` Isotope picker &
> clickable `118×200` Chart of Nuclides** (`f6623b39`) + live **CI-NEB Reaction
> Barrier (`E_a`, `‡ TS`)** (`c09644f8`).

| File | Gate | Live-Code Reality (`c09644f8`, 2026-11-23) & Open Work |
|---|---|---|
| [`webgpu-material-property-resolvers-plan.md`](webgpu-material-property-resolvers-plan.md) | Gate 1 | **P1.1–P1.5 + Priority 1 `(Z, A)` Isotope Propagation DONE & VULKAN-VERIFIED (`f6623b39`):** two-body reduced-mass shift & Fermi-contact hyperfine splitting (`radialKohnShamWebGpu.js`), isotope mass/ZPE/Debye/MD (`periodicBulkDftWebGpu.js`, `elementMdClosureWebGpu.js`), arbitrary `(Z, A)` Gate 1 decay chains & Bateman ledger (`nuclearCherenkovClosure.js`). Open: 4-comp Dirac–KS / `DFT+U` refinements and formal receipt. |
| [`electron-cloud-material-derivation-visualization-plan.md`](electron-cloud-material-derivation-visualization-plan.md) | Gate 1 / 2 | Interactive **Isotope `(A, N)` selector, `A*` reset, clickable `118×200` Chart of Nuclides, decay-chain readout (`f6623b39`)**, and live **CI-NEB Reaction Barrier & `‡ TS` curve (`c09644f8`)** landed & visually verified in `elements-lab.html`. Open: spin-density `ρ_↑ − ρ_↓` / 3D Fermi surface views. |
| [`material-property-json-bank-plan.md`](material-property-json-bank-plan.md) | Gate 1 / 2 | **`elements.json` CLOSED TO `118/118` (`4c2f170b`)** + [`foundation-polytope-atlas.json`](../../data/material-properties/foundation-polytope-atlas.json) expanded to **`118` elements + `20` compounds (`98214a11`, covering `15/15` `compounds.json` with `0` `reference-fallback`)** + `foundationPolytopeCompoundRecordFor` & isotopologue keying (`D2O`, `T2O`, `235UF6`, `14CO2`, `60Co`, `3He`). Open: retire legacy CRC `compounds.json` tests once formal G7 benchmark switches over. |
| [`algorithm-derived-material-properties-plan.md`](algorithm-derived-material-properties-plan.md) | Gate 1 / 2 | Chapman–Enskog gas `μ, k`, Gate 1–2 5-domain isotope-aware bundles, Eshkol/MoonLab 5-slot GPU A4 packing, and automatic Studio worker Triad seeding (`foundationPolytopeAtlasGpuBridge.js`, `98214a11`) landed. |

---

## Priority 2 — Gate 2: Chemical Reactions → Compound Feedback Loop → Convex Polytope Atlas (`10⁻¹⁰ → 10⁻⁶ m`)

> Discover balanced reactions on GPU, feed every resultant compound & isotopologue
> **straight back into Gate 1's simulation regime**, and compile every validated
> element, isotope, and compound into a piecewise-convex `(T, log10 P, ...)` **Polytope Atlas**.

| File | Gate | Live-Code Reality (`c09644f8`, 2026-11-23) & Open Work |
|---|---|---|
| [`material-polytope-registry-and-property-fit-plan.md`](material-polytope-registry-and-property-fit-plan.md) | Gate 2 / 3 | **DONE & VULKAN-VERIFIED (`0af39d00`, `f6623b39`, `98214a11`):** slanted Clausius–Clapeyron `A x <= b` half-spaces, `canonicalMaterialIsotopeKey` for `(Z/formula, A)`, adaptive GPU Chebyshev fitter, **`foundationPolytopeAtlasGpuBridge.js` live Vulkan `evaluatePolytopeAtlasWgsl` batch evaluation + `hitFlag == 0` Eshkol/MoonLab Triad miss escalation + automatic Studio worker seeding**. Open: OPFS/IndexedDB Atlas cache and formal receipt. |
| [`sedenion-reaction-scoping-plan.md`](sedenion-reaction-scoping-plan.md) | Gate 2 | Isotopologue parser (`describeIsotopologueFormula`: `D2O`, `T2O`, `[2H]2O`, `235UF6`, `14CO2`, `60Co`) + H-site ZPE melting shift (`f6623b39`) AND live **CI-NEB reaction barrier (`E_a`, `‡ TS`)** in `elements-lab.html` (`c09644f8`) landed & verified. Open: GPU-batched multi-reaction network exploration. |

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

## Priority 4 — Gate 4: Interactive Studio Presentation & Real-Time Optics (`10⁻³ → 10⁺² m`)

> Decoupled `>= 54 Hz` presentation (`visibleMotionCadenceVerified: true`)
> across all 5 active Studio presets with true WebGPU isosurfaces, refraction,
> Cherenkov, and volumetric plumes.

| File | Gate | Live-Code Reality (`d687b37e`, 2026-11-23) & Open Work |
|---|---|---|
| [`surface-contact-transport-phase-closure-plan.md`](surface-contact-transport-phase-closure-plan.md) | Gate 3 / 4 | Magic `80/82/24` isovalues replaced with continuous density scaling; all 5 Studio presets boot & step cleanly (`0` page/GPU errors) in `scripts/gate-visual-motion-verify.mjs`. Remaining: hardcoded `0.04` bulk alpha, legacy non-SS conduction path, and owner-approved visible Wayland Chrome `>= 54 Hz` pixel-motion cadence acceptance across all 5 active presets. |

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
