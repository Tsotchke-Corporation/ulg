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

| File | Gate | Live-Code Reality (`2fe9e47b`) & Open Work |
|---|---|---|
| [`periodic-table-polytope-atlas-foundation-plan.md`](periodic-table-polytope-atlas-foundation-plan.md) | **Gate 0 / 1 / 2 (Master)** | **Primary Foundation Blueprint:** Phase 0 (`peercompute-core`, `gpuMath`, Material-Bundle & Polytope-Atlas ABIs, Zero-Churn Step Loop), Gate 1 (`Z=1..118` Nuclear/Atomic/EM/Bulk-DFT/MD + real live GPU visualizations), Gate 2 (Reactions → recursive compound feedback → convex Polytope Atlas), and Scientific Honesty Boundary Matrix. |
| [`cold-start-cache-performance-plan.md`](cold-start-cache-performance-plan.md) | Gate 0A | Marching-cubes `maxStorageBufferBindingSize` clamp & `/@fs` build verification landed (P0); open: `peercompute-core` split cutting `83 MB` `ort-wasm` dist bloat (`117.5 MB → ~34 MB`) + persistent Polytope Atlas & shader warm cache. |
| [`a1-realtime-substrate.md`](a1-realtime-substrate.md) | Gate 0D / Gate 3 | Coupling #8 skipped on resident render, `lawAdapterContract.js` wired, `uncapturederror` & hot-buffer eviction fixed (P0/P1). Open (Zero-Churn Step Loop): eliminate `36.6` encoders, `16` `createBuffer`, `40.5` `bindGroups`, `3.26` `workDone`, `32` passes on `iron-ice`; deduplicate 5 contact laws; migrate/delete 63-limb `sphExactRational*` (`71` refs / `33` files) & CPU mirrors; burn down `76` WGSL patches & `248` `@workgroup_size(1)` kernels. |
| [`selective-contact-law-application-plan.md`](selective-contact-law-application-plan.md) | Gate 0D / Gate 3 | A/B and deduplicate 5 overlapping iron-ice contact responses down to 1 canonical GPU contact authority and retire legacy duplicate contact tests. |

---

## Priority 1 — Gate 1: Complete Periodic Table First-Principles Engine (`10⁻¹⁵ → 10⁻⁹ m`, `Z = 1..118`)

> Next flagship demo (`elements-lab.html`): derive nuclear, relativistic atomic,
> electromagnetic/magnetic/optical/conductive, bulk crystal, and MD/thermodynamic
> properties from first principles across **all 118 elements**, accompanied by
> real live WebGPU visualizations (zero animations) and G7 advisory scorecards.

| File | Gate | Live-Code Reality (`2fe9e47b`) & Open Work |
|---|---|---|
| [`webgpu-material-property-resolvers-plan.md`](webgpu-material-property-resolvers-plan.md) | Gate 1 | 100% GPU radial LDA SCF (`solveAtomFullWebGpu`, `0` readbacks) and GPU Drude–Lorentz/SO optical resolver landed; open: GPU nuclear structure/WKB (`P1.1`), GPU 4-component Dirac–KS + spin-PBE/SCAN + finite `R_nuc` + QED (`P1.2`), GPU `periodicBulkDft` (`mBJ/SCAN` + `DFT+U` + crystal selection + EM/magnetism/conductivity, `P1.3`), and WebGPU MD (`P1.4`). |
| [`electron-cloud-material-derivation-visualization-plan.md`](electron-cloud-material-derivation-visualization-plan.md) | Gate 1 / 2 | WebGPU `Data3DTexture` orbital raymarcher (`volumetricOrbitalRaymarcher.js`) landed; expand to live nuclear density & Chart of Nuclides, spin density `ρ_↑ − ρ_↓`, crystal Bloch density & 3D Fermi surface, live MD atoms, reactive orbital evolution, and 3D Polytope Atlas in `elements-lab.html`. |
| [`material-property-json-bank-plan.md`](material-property-json-bank-plan.md) | Gate 1 / 2 | `elements.json` covers 111/118 (missing 7 noble gases `He..Og`, lacks nuclear/EM/magnetic/conductivity closures); `compounds.json` is `15/15` `reference-fallback`. Close all 118 elements + reaction compounds and retire `reference-fallback` rows via Gate 1–2 derivations. |
| [`algorithm-derived-material-properties-plan.md`](algorithm-derived-material-properties-plan.md) | Gate 1 / 2 | First-principles Chapman–Enskog gas `μ(T)` & Modified Eucken `k(T)` landed (P2); pack unified Gate 1–2 closure bundles into algorithm-shaped GPU material rows. |

---

## Priority 2 — Gate 2: Chemical Reactions → Compound Feedback Loop → Convex Polytope Atlas (`10⁻¹⁰ → 10⁻⁶ m`)

> Discover balanced reactions on GPU, feed every resultant compound **straight
> back into Gate 1's simulation regime**, and compile every validated element
> and compound into a piecewise-convex `(T, log10 P, ...)` **Polytope Atlas**.

| File | Gate | Live-Code Reality (`2fe9e47b`) & Open Work |
|---|---|---|
| [`material-polytope-registry-and-property-fit-plan.md`](material-polytope-registry-and-property-fit-plan.md) | Gate 2 | Core `materialPolytopeRegistry.js` (v0 boxes) and `responseFunctionFitGpu.js` (1D/2D GPU Chebyshev) landed (P1/P3); open: piecewise-convex `A x <= b` phase-boundary polytopes, auto-bisection, residual/conservation gates, 3D Atlas Visualizer, and direct Tier-1 GPU material packing. |
| [`sedenion-reaction-scoping-plan.md`](sedenion-reaction-scoping-plan.md) | Gate 2 | Inert-candidate suppression bug FIXED (P0); integrate Sedenion prioritization with Gate 2 GPU molecular QM (`molecularHartreeFockWebGpu`), reaction discovery, and recursive compound feedback loop. |

---

## Priority 3 — Gate 3: Macroscopic Continuum Engine & Unified SS (`10⁻⁶ → 10⁺² m`)

> Consumes the Gate 2 Polytope Atlas natively at Tier-1 GPU speed, unifies all
> solids and dynamic laws onto canonical Schroeder Simulation (`SS`) cells,
> turns on exact `2^-149` ledgers & multi-level first-class air by default, and
> passes Section 3 GPU budgets. Consolidates legacy A1–A6, G2–G4, G6.

| File | Sub-Track | Live-Code Reality (`2fe9e47b`) & Open Work |
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

| File | Gate | Live-Code Reality (`2fe9e47b`) & Open Work |
|---|---|---|
| [`surface-contact-transport-phase-closure-plan.md`](surface-contact-transport-phase-closure-plan.md) | Gate 3 / 4 | Magic `80/82/24` isovalues replaced with continuous density scaling (P2); remaining: hardcoded `0.04` bulk alpha, legacy non-SS conduction path, and formal Gate 4 `>= 54 Hz` visible motion cadence acceptance across the 5 active presets. |

---

## Priority 5 — Gate 5: Planetary → Stellar → Galactic → Supergalactic Cosmology (`10⁺⁶ → 10⁺²⁵ m`)

> Completes ULG's 40-order-of-magnitude scale ladder on the **exact same GPU
> primitives** built in Gates 0–3: `fft3dWebGpu` (Gate 0B) + canonical `SS`
> Scale Atlas multipole + Gate 1 nuclear/atomic closures + Gate 2 Polytope
> Atlases + `peercompute-core` multi-host domain partitioning.

| File | Sub-Scale | Live-Code Reality (`2fe9e47b`) & Open Work |
|---|---|---|
| [`planetary-to-supergalactic-scale-atlas-plan.md`](planetary-to-supergalactic-scale-atlas-plan.md) | **Gate 5 (Master)** | **Full `10⁺⁶ → 10⁺²⁵ m` Blueprint:** **(5A)** Polytope-Atlas planetary interiors & symplectic N-body/impact hydro; **(5B)** Unified `SS` stellar hydro & Gate 1 nuclear networks; **(5C)** Unified `SS` galactic dark-matter/star/ISM hydro + Gate 1 atomic line cooling + SMBH; **(5D)** Expanding FLRW comoving **GPU 3D-FFT TreePM (`fft3dWebGpu` + SS multipole)** from Zel'dovich `P(k)` ICs evolving real supergalactic cosmic-web filaments, halos, and voids. |
| [`hydrogen-nebula-to-star-fusion-bridge-plan.md`](hydrogen-nebula-to-star-fusion-bridge-plan.md) | Gate 5B (Stellar) | Phase 1 `stellar-genesis.html` & translation-invariant GPU `self-gravitating-hydro@1` shipped; migrate off private octree onto shared `SS` Scale Atlas multipole, wire Gate 1 nuclear networks, and add G7 Lane–Emden / MESA advisory benchmarks. |
| [`distributed-peercompute-network-stack-plan.md`](distributed-peercompute-network-stack-plan.md) | Gate 5D / Multi-Host | Single-host 2-browser-context WebRTC `RTCDataChannel` proof PASS (P3); stand up physical 2-machine WAN/NAT/STUN/TURN validation and distributed spatial domain partitioning for multi-GPU galactic & supergalactic simulations. |
