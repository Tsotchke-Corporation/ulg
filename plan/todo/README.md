# ULG Active Todo Index (Unified 40-OOM Scale-Ladder Roadmap, 2026-11-23)

- **Start here:** Read [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md) first for
  the full **40-order-of-magnitude bottom-up + bidirectional bookend roadmap
  (`10⁻¹⁵ m` Nuclear → `10⁺²⁵ m` Supergalactic)**, honest 8-gate scorecard (`G5`
  & `G7` accepted; `Gate 0`–`Gate 5` core engines, Triad bridge, and bookends
  implemented & Vulkan-verified at `99db3434`, pending formal receipt capture &
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

| File | Gate | Live-Code Reality (`d687b37e`, 2026-11-23) & Open Work |
|---|---|---|
| [`periodic-table-polytope-atlas-foundation-plan.md`](periodic-table-polytope-atlas-foundation-plan.md) | **Gate 0 / 1 / 2 (Master)** | **Primary Foundation Blueprint:** Gate 0A–0C (`peercomputeCore.js`, `dist/ 35 MB`, `src/runtime/gpuMath/`, `materialFoundationAbi.js`), Gate 1 (`Z=1..118` engine, `elements.json` `118/118`, `elements-lab.html`), and Gate 2 (`molecularHartreeFockWebGpu`, `recursiveCompoundPipeline`, Eshkol/MoonLab `polytopeAtlasBuilder`, `foundation-polytope-atlas.json`) **landed & Vulkan-verified**. Open: **End-to-End Isotope & Isotopologue Propagation** (`(Z, A)` mass/Debye/MD/formula/Cherenkov/UI), deeper Dirac 4-comp/`DFT+U`/CI-NEB visuals, remaining Gate 0D zero-churn, and formal `ulg.campaign.receipt.v1`. |
| [`cold-start-cache-performance-plan.md`](cold-start-cache-performance-plan.md) | Gate 0A | **0A DONE (`0af39d00`):** `peercomputeCore.js` + `worker.plugins` cut `dist/` **`117.5 MB → 35 MB`** (`0` `ort-wasm`/`transformers`/`sf3d` assets). Open: persistent IndexedDB/OPFS warm cache for derived Polytope Atlases & compiled WebGPU pipelines. |
| [`a1-realtime-substrate.md`](a1-realtime-substrate.md) | Gate 0D / Gate 3 | **0D Slice 1 DONE (`13bfda97`):** cached SS/gas-EOS/solid bind groups, pooled receipt ring, shared solid-fluid spatial hash (`water-realtime` `5.04 → 13.60 steps/s`, `2.70x` faster; `iron-ice` `bindGroups 40.51 → 36.42`, GPU mean `25.3%`). Open: fix `water-realtime` K-step boundary frame check (`>= 1.0x` RT), drive `iron-ice` to `<= 25` passes / `<= 2` submits / `0` per-step `workDone` / `0` transient `createBuffer`, deduplicate 5 contact laws, retire unused 63-limb `sphExactRational*`, burn down `76` WGSL patches & `@workgroup_size(1)` kernels. |
| [`selective-contact-law-application-plan.md`](selective-contact-law-application-plan.md) | Gate 0D / Gate 3 | Duplicate solid-fluid 4,096-bucket thermal/contact spatial hash collapsed (`13bfda97`); open: A/B & deduplicate the 5 overlapping iron-ice contact responses down to 1 canonical GPU contact authority and retire legacy duplicate contact tests. |

---

## Priority 1 — Gate 1: Complete Periodic Table First-Principles Engine (`10⁻¹⁵ → 10⁻⁹ m`, `Z = 1..118` + Isotopes)

> Flagship demo [`elements-lab.html`](../../elements-lab.html) landed & visually
> verified across all 6 live GPU tabs (Nuclear, Atomic QM, Crystal & EM, live 3D
> WebGPU MD, Compound & Reaction QM, `log10(T)` Convex Polytope Atlas).

| File | Gate | Live-Code Reality (`d687b37e`, 2026-11-23) & Open Work |
|---|---|---|
| [`webgpu-material-property-resolvers-plan.md`](webgpu-material-property-resolvers-plan.md) | Gate 1 | **P1.1–P1.5 Core Engine LANDED & VULKAN-VERIFIED:** `nuclearStructureGpu.js`, finite-nucleus Koelling–Harmon+QED `radialKohnShamWebGpu.js` (`0` SCF readbacks), `periodicBulkDftWebGpu.js`, `electromagneticClosureWebGpu.js`, `elementMdClosureWebGpu.js`, `periodicTableEngineWebGpu.js`. Open: **End-to-End `(Z, A)` Isotope Propagation** (propagate `nuclear.atomicMassU` into bulk density/Debye/MD/zero-point energy, add reduced-mass & hyperfine shifts, retire 4-isotope hardcoded table in `nuclearCherenkovClosure.js` onto `nuclearStructureGpu.js`), 4-comp Dirac–KS / `DFT+U` refinements, and formal receipt. |
| [`electron-cloud-material-derivation-visualization-plan.md`](electron-cloud-material-derivation-visualization-plan.md) | Gate 1 / 2 | Live nuclear 3D density + Chart of Nuclides + WKB barrier, atomic `ρ(r)`, Bloch 3D density + bands/DOS, live 3D WebGPU MD atoms, molecular RHF cloud, and `log10(T)` Polytope Atlas shipped in `elements-lab.html`. Open: interactive **Isotope `(A, N)` selector & clickable Chart of Nuclides**, spin-density `ρ_↑ − ρ_↓` / 3D Fermi surface views, and live CI-NEB reactive orbital evolution. |
| [`material-property-json-bank-plan.md`](material-property-json-bank-plan.md) | Gate 1 / 2 | **`elements.json` CLOSED TO `118/118` (`4c2f170b`)** (all 7 noble gases `He..Og` added, Ajv Draft 2020-12 PASS) + [`foundation-polytope-atlas.json`](../../data/material-properties/foundation-polytope-atlas.json) (`118` elements + `15` reaction compounds + G7 advisory benchmarks). Open: migrate legacy `compounds.json` (`15/15` `reference-fallback`) onto Gate 2 derived bundles & add isotope/isotopologue keying (`D2O`, `235UF6`, `60Co`, `14CO2`). |
| [`algorithm-derived-material-properties-plan.md`](algorithm-derived-material-properties-plan.md) | Gate 1 / 2 | Chapman–Enskog gas `μ, k`, Gate 1–2 5-domain bundles, and Eshkol/MoonLab 5-slot GPU A4 packing landed (`4c2f170b`); open: pack isotope-aware Gate 1–2 bundles natively into continuum GPU material rows. |

---

## Priority 2 — Gate 2: Chemical Reactions → Compound Feedback Loop → Convex Polytope Atlas (`10⁻¹⁰ → 10⁻⁶ m`)

> Discover balanced reactions on GPU, feed every resultant compound **straight
> back into Gate 1's simulation regime**, and compile every validated element,
> isotope, and compound into a piecewise-convex `(T, log10 P, ...)` **Polytope Atlas**.

| File | Gate | Live-Code Reality (`d687b37e`, 2026-11-23) & Open Work |
|---|---|---|
| [`material-polytope-registry-and-property-fit-plan.md`](material-polytope-registry-and-property-fit-plan.md) | Gate 2 | **Core Atlas LANDED & VULKAN-VERIFIED (`0af39d00`, `4326c34e`, `4c2f170b`):** slanted Clausius–Clapeyron `A x <= b` half-spaces, adaptive curvature-axis GPU Chebyshev fitter, `evaluatePolytopeAtlasWgsl`, Eshkol AD higher-order laws, MoonLab 5-slot Triad GPU synthesis, `MaterialRegistry.attachPolytopeAtlas`, and `log10(T)` visualizer. Open: isotopologue keying (`H2O` vs `D2O`, `235U` vs `238U`), live Studio Tier-1 WGSL lookup consumption, and formal receipt. |
| [`sedenion-reaction-scoping-plan.md`](sedenion-reaction-scoping-plan.md) | Gate 2 | Inert-candidate suppression fixed + `molecularHartreeFockWebGpu.js` & `recursiveCompoundPipeline.js` landed; open: GPU CI-NEB reaction barrier discovery wired into `elements-lab.html` + isotopologue formula parser (`D2O`, `[2H]2O`, `14C`, `235U`). |

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

| File | Sub-Scale | Live-Code Reality (`d687b37e`, 2026-11-23) & Open Work |
|---|---|---|
| [`planetary-to-supergalactic-scale-atlas-plan.md`](planetary-to-supergalactic-scale-atlas-plan.md) | **Gate 5 (Master)** | **5A–5D Core Engines & Top-Anchor Demo LANDED & VULKAN-VERIFIED (`4326c34e..99db3434`):** `planetaryStructureGpu.js` (5A), `stellarNucleosynthesisBridge.js` (5B), `galacticIsmCoolingGpu.js` (5C), `supergalacticTreePmGpu.js` + flagship `supergalactic.html` + `cosmicQuantumZoomDemo.js` FLRW upgrade + `distributedSpatialPartitioner.js` (5D). Open: migrate bespoke private octrees in `selfGravitatingHydroGpu.js` & `cosmicQuantumGpuKernels.js` onto canonical `SS` Scale Atlas multipole, multi-host WebRTC TreePM tile test (after `agy` ships PeerCompute extensions), and formal receipt. |
| [`hydrogen-nebula-to-star-fusion-bridge-plan.md`](hydrogen-nebula-to-star-fusion-bridge-plan.md) | Gate 5B (Stellar) | Phase 1 `stellar-genesis.html` & translation-invariant GPU `self-gravitating-hydro@1` shipped; migrate off private octree onto shared `SS` Scale Atlas multipole, wire Gate 1 nuclear networks, and add G7 Lane–Emden / MESA advisory benchmarks. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Gate 5D / Multi-Host | Single-host 2-browser-context WebRTC `RTCDataChannel` proof PASS (P3); stand up physical 2-machine WAN/NAT/STUN/TURN validation and distributed spatial domain partitioning for multi-GPU galactic & supergalactic simulations. |
