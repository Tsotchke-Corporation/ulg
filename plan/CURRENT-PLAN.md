# ULG Current Plan (Authoritative Routing Document — Unified 40-OOM Scale-Ladder Roadmap)

- **Effective:** 2026-11-23 AKST (Unified 40-OOM Foundation-First Scale-Ladder Roadmap — **Gate 1 & Gate 2 formally ICC-accepted at `b9e86811` [`4/8` accepted]** + **Gate 4 visible Wayland Chrome 5-preset sweep honestly measured**)
- **Active branch:** `feat/star-spec-generalization-audit` (HEAD `b9e86811`; `main` & `origin/main` at `f1cf07c7`)
- **Publication hold:** **ACTIVE** — local commits on feature branch only; no `git push`, no merge to `main`, and no `npm run build:pages` / `docs/` edits without explicit authorization from **big dog**.
- **Master Mission (Unchanged — `10⁻¹⁵ m → 10⁺²⁵ m`):** ULG is a **first-principles, browser-native WebGPU multiscale physics engine** spanning 40 orders of magnitude — from nuclear structure (`10⁻¹⁵ m`) through atoms, crystals, chemistry, macroscopic continuum matter (`10⁻⁶..10⁺² m`), planets, stars, galaxies, and supergalactic cosmic-web cosmology (`10⁺²⁵ m`) — governed by Star Spec v0.4, the **Schroeder Simulation (`SS`) Scale Atlas**, the **Tier 0–3 Closure Economy**, and the **PeerCompute / Eshkol / MoonLab Triad**.
- **Immediate Scope (Foundation-First Execution Order):** Rather than building upper scales on `reference-fallback` material seeds and CPU-bound closures, we execute strictly **bottom-up** so every higher scale inherits validated GPU primitives, first-principles closures, and convex Polytope Atlases from the rungs beneath it:
  - **Gate 0 (Priority 0 — 0A–0C Verified; 0D Zero-Churn In Progress):** Architectural & GPU Numerical Foundation (`peercompute-core`, `gpuMath`, Canonical ABIs, Zero-Churn Step Loop).
  - **Gate 1 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Complete First-Principles Periodic Table Material Engine (`Z = 1..118` + `(Z, A)` isotopes: Nuclear + Relativistic Atomic + EM/Magnetism/Optics/Conductivity + Bulk DFT + WebGPU MD) with **real live WebGPU visualizations** (`elements-lab.html`) — see [`plan/done/gate1-periodic-table.md`](done/gate1-periodic-table.md).
  - **Gate 2 (ACCEPTED 2026-11-23 — `3/3 PASS`):** First-Principles Chemical Reactions (100% WebGPU RHF + CI-NEB) → **Recursive Compound Feedback Loop** → **Per-Material & Per-Compound 4-Phase Convex Polytope Atlas** (`A x <= b` + persisted GPU Chebyshev Tier-1 tables) — see [`plan/done/gate2-reactions-polytope-atlas.md`](done/gate2-reactions-polytope-atlas.md).
  - **Gate 3 (Priority 3 — In Progress):** Macroscopic Continuum Engine (`SS` + MLS-MPM + Exact `2^-149` Ledgers + Unified Solids + Section 3 GPU Budgets) consuming the Gate 2 Polytope Atlas natively.
  - **Gate 4 (Priority 4 — In Progress):** Decoupled Interactive Studio Presentation (`>= 54 Hz` visibly advancing motion across all 5 active presets; visible Wayland sweep honestly measured `18.8–33.8 Hz`, double-vsync decoupling next).
  - **Gate 5 (Priority 5 — Implemented & Vulkan/WebRTC Verified; Receipt Pending):** Planetary (`10⁺⁶ m`) → Stellar (`10⁺⁸–10⁺¹⁷ m`) → Galactic (`10⁺¹⁷–10⁺²² m`) → Supergalactic Cosmology (`10⁺²²–10⁺²⁵ m` FLRW TreePM + distributed PeerCompute scaling) built directly on Gate 0's `fft3dWebGpu` + `SS` Scale Atlas multipole + Gate 1–2 nuclear/atomic/polytope closures.
- **Formal ICC Campaign Status:** **4 of 8 gates formally accepted** — **G5** ([done/g5-reservation.md](done/g5-reservation.md)), **G7** ([done/g7-release-audit.md](done/g7-release-audit.md)), **Gate 1** ([done/gate1-periodic-table.md](done/gate1-periodic-table.md)), and **Gate 2** ([done/gate2-reactions-polytope-atlas.md](done/gate2-reactions-polytope-atlas.md)). The 11 former fragmented open milestones (G1–G4, G6, A1–A6) are consolidated into **6 clean Scale-Ladder gates (`Gate 0` through `Gate 5`)** while preserving all historical legacy oracle definitions and audit history in [`.icc/completion-oracles.yaml`](../.icc/completion-oracles.yaml) (honesty rule: never mark unaccepted oracles `completed`).

This file is the **single active source of truth** for execution order, honest
campaign status, performance budgets, and next-work prioritization. Where any
older doc, audit, or archive conflicts with this document, **this document
governs**.

---

## 1. Non-Negotiable Core Rules

1. **Star Spec physics-first:** Macroscopic behavior emerges from activated laws
   and validity-checked closures. Zero per-preset/material/element physics
   branches, zero scripted animations or CSS visual fakes, zero `(0,0,0)` origin
   anchors. Never remove or demote a physical law.
2. **GPU-native validation only:** No production CPU mirror solvers, no CPU
   parity acceptance gates, no full-state hot-loop readback/reupload. Validate
   via GPU manufactured states, mathematical invariants, metamorphic/same-device
   A/B runs, and fixed-size GPU reductions.
3. **Exact integer conservation ledgers:** Keep 9-limb `2^-149` binary-dyadic
   integer ledgers for conserved carrier/parcel mass and `Σ(U − S)` internal
   energy accounting; momentum stays f32.
4. **PeerCompute authority at the schedule & peer boundary:** ComputeManager,
   GPUHub, StateManager, and ReservationLedger own scheduling, resource leases,
   epoch fencing, and admitted deltas. Drop intra-worker JS anti-forgery
   ceremony and manual multi-hundred-file hash manifests. Rendering consumes
   admitted outputs and never owns physics cadence.
5. **Retiring superseded routes is authorized (2026-11-19):** Delete dead or
   superseded execution routes (disabled 63-limb exact rationals, redundant
   non-fused shader duplicates, duplicate overlapping contact impulses,
   production-bundled CPU test mirrors, bespoke private octrees/4,096-bucket
   hashes) once the canonical GPU replacement passes its invariants.
6. **Hardware, WM, & visual hygiene:** Headless Vulkan Chrome by default; ask
   **big dog** before launching visible desktop Chrome on Wayland (never
   `terminal-browser` or terminal splits; close only owned browser/server
   processes). One GPU workload at a time (`--test-concurrency=1`, `gpuprobe.sh`,
   `MemoryMax=4G`, `<=80%` GPU target, inspect `journalctl -k` for Xid/OOM).
7. **G7 stays advisory:** Scientific database comparisons (NIST, CODATA, AME2020,
   PubChem, Materials Project, CRC, PREM, Lane–Emden/MESA, cosmological `P(k)`)
   remain offline, operator-side, and advisory — exposing honest deviations and
   uncertainty without ever becoming a blocking runtime admission gate.
8. **Publication hold & house rule:** No push, merge to `main`, or Pages build
   without authorization. Address the user as **big dog** in every response.

---

## 2. The 40-Order-of-Magnitude Causal Architecture (Standing Contracts)

Every layer shares one unified GPU spine so **zero infrastructure is thrown away as scale increases**:

- **Shared `gpuMath` & `SS` Scale Atlas Spine:**
  - `fft3dWebGpu.js` (Gate 0B) solves BOTH `10⁻⁹ m` Periodic Bulk DFT Hartree/Poisson AND `10⁺²⁵ m` Supergalactic FLRW TreePM periodic gravity.
  - `SchroederScaleAtlas` multipole (Gate 0B/3/5) replaces ALL private 4,096-bucket solid/dormancy hashes AND ALL private galactic/stellar octrees across `10⁻⁶ m → 10⁺²⁵ m`.
  - `peercompute-core` (Gate 0A) schedules BOTH Gate 1–2 distributed element/compound/polytope derivations AND Gate 5C–5D multi-host galactic/cosmological domain partitioning.
- **Closed Micro → Macro Physics Chain (Representative Sub-Simulation Principle):**
  ULG never attempts to simulate every atom in a star (`10⁵⁷` atoms) or every molecule in a lab block (`10²⁶` molecules). Every scale `S` queries **representative sub-simulations** executed at scale `S−1` (single-nucleus finite potential → single-atom Dirac–KS → canonical periodic Bloch cell → `1,024–4,096`-atom representative WebGPU MD cell → `(ρ, T, X)` stellar/planetary/ISM parcel) and compiles their outputs + error bounds into **Convex Polytope Atlases (`A x <= b` + GPU Chebyshev)** consumed in nanoseconds at scale `S`:
  `Nuclear (10⁻¹⁵ m) → Relativistic Atomic QM (10⁻¹⁰ m) → EM/Optical/Magnetic + Bulk Solid DFT (10⁻⁹ m) → WebGPU MD/Phonons → Z=1..118 Elements → Chemical Reactions → Recursive Compound Feedback → Convex Polytope Atlas → Macroscopic Continuum (10⁻⁶..10⁺² m) → Planetary/Stellar/Galactic/Supergalactic (10⁺⁶..10⁺²⁵ m)`.
- **Explicit Declared Accuracy Tiers (First-Class Metadata on Every Closure & Polytope):**
  - **`tier-1-quantitative`:** Direct GPU first-principles derivations with tight G7 advisory agreement (`~0.1–10%`, e.g., nuclear `B(Z, A)`, Dirac–KS energies/radii, canonical crystal `a_0/ρ_0`, exact conservation ledgers).
  - **`tier-2-representative-effective`:** Principled first-principles representative sub-simulations & homogenization closures (`~10–35%` G7 advisory envelope, e.g., `mBJ/DFT+U` band gaps & magnetism, DFT-fitted coexistence/Green–Kubo MD melting/viscosity/surface tension, reaction barriers, effective stellar neutrino/TOV & galactic ISM macro-particle closures).
  - **`tier-3-theoretical-envelope`:** Regimes beyond experimental measurement or real-time browser cell/correlation limits (e.g., millisecond-lived `Z = 101..118` superheavy bulk phases, 50–105 atom exotic polymorphs `α-Mn`/`β-B`/`Pu`, strongly correlated `5f` DMFT actinides) — derived from general laws, explicitly tagged with uncertainty and `scientificValidation: false`, never masked as measured truth.
- **Cache Layering & Fail-Closed Validity:** Hot (resident GPU buffers) → Warm (StateManager refs/deltas + G5 CAS reservations) → Cold (content-addressed JSON & Polytope Atlas bank). Polytopes are strictly fail-closed (`A x <= b`) — never silently extrapolated; out-of-domain queries trigger Tier-2 (A3) or Tier-3 (A6 PeerCompute/Eshkol/MoonLab) synthesis.
- **Copy-Avoidance & Zero-Copy Residency:** Hot GPU state stays on-device; clamp allocations to `device.limits.maxStorageBufferBindingSize`; preserve the 5 strictly separated SS authorities (physical representation, law query/activation, contact proxy, dynamic LOD, render LOD).
- **Rollback & Benchmark Constants:** Check spatial-authority rollbacks with `&observeSpatialAuthority=1`; Iron Ice reference `dt = 0.5 ms`; Studio presentation target is `>= 54 Hz` visibly advancing latest committed state across the 5 shipped presets (`water-cycle`, `iron-ice-quench`, `sodium-water`, `cesium-fluorine`, `water-realtime`).

---

## 3. Hard Per-Step Continuum Performance & Dispatch Budget Gate

Every runtime slice touching the continuum SPH/SS step loop, contact, solids, or
closures must report and pass these targets via `scripts/gpuprobe.sh` (one GPU
job at a time, `CPUQuota=50%`, `S0_RESIDENT_PERF=1`):

| Metric | Old Baseline (Nov 3) | Current Live (`p2-iron-ice` / `p2-water-realtime`, Nov 23) | Canonical Target | Hard Regression Rule |
|---|---:|---:|---:|---|
| `queue.submit` per substep | 30.5 | `3.65` iron (**`1.72` water — MEETS TARGET**, down from `2.99`) | `<= 2` (and `K` steps/submit) | No slice may increase physics submits/step |
| Indirect dispatches per substep | 52 | `9.29` iron (`0.78` water) | `<= 16` total across active levels | **Hard fail** if any pass loops `> 16` indirect/level |
| Host `onSubmittedWorkDone` / `mapAsync` waits | 9.1 | `3.24` / `0.35` iron (`1.20` / `0` water) | `0` per substep (schedule-boundary only) | Zero per-step host waits |
| Compute passes per substep | 106 | `31.53` iron (`16.24` water) | `<= 25` active passes | Dormant laws must add `0` active passes |
| Steady-state `createBuffer` / `bindGroup` churn | — | `15.63` / `30.79` iron (`13.30` / `16.38` water) | `0` per steady-state step | Zero per-step transient allocation churn |
| Bulk quiescent substrate (Tier-0 floor) | ~159 ms/step | `0.124x` RT (`15.45 steps/s`, `3.07x` faster, `k=3`, `0` boundary err) water / `0.00189x` (`3.77 steps/s`, `+44%`) iron (50% CPU) | `<= 1 ms/step` bulk, `>= 1.0x` RT on `water-realtime` | Must hold after remaining Gate 0D Zero-Churn slices |

---

## 4. Honest 8-Gate Scale-Ladder Scorecard (2026-11-23)

> **Honesty boundary:** **4 of 8 gates** have formally accepted
> `ulg.campaign.receipt.v1` bundles on disk (`/home/cos/.cache/icc/repos/ulg/`):
> **G5**, **G7**, **Gate 1**, and **Gate 2**. Gates 0, 3, 4, and 5 remain
> honestly `in_progress`. Verified baseline at `b9e86811`: **`6,209 pass / 0
> fail`** full host suite (`197` opt-in skips, `6,406` total) + **`6/6` Gate
> 0–3 Vulkan native proofs PASS** (plus Gate 5 Vulkan & real 2-browser WebRTC
> TreePM proofs PASS) + live WebGPU `Z = 1..118` + `20` compounds atlas
> regeneration (`54.75 s`, `142,457` independent interior Chebyshev probes
> verified) + `npm run build` PASS (`3.49 s`, `dist/` = **`37 MB`**, `0`
> `ort-wasm`/`transformers`/`sf3d`) + visible Wayland Vulkan visuals for
> `elements-lab.html` (`10` PNGs inspected, `116,314` changed MD px) and all 5
> active Studio presets (`0` page/GPU/Xid errors, `KERNEL_CLEAN`).

| Gate | Scale Span | ICC Oracle Target | Status | Live Code Today (`b9e86811`) | Remaining Work to Formally Accept Gate |
|---|---|---|---|---|---|
| **G5** | Cross-Scale | `ulg-g5-reservation` | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Bounded single-realm JS CAS `ReservationLedger` live + wired into Gate 5D `distributedSpatialPartitioner.js` & verified over real 2-browser WebRTC TreePM (`priority5ScaleAtlasAndWebRtcTreePm.native.test.mjs`). | Multi-realm distributed reservation extends via PeerCompute extension spec (`/home/cos/projects/peercompute/plan/todo/ulg-scale-ladder-peercompute-extensions.md`). |
| **G7** | Cross-Scale | `ulg-g7-release-audit` | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Offline advisory NIST/PubChem audit tooling live + Gate 1 element/compound advisory scorecards in `periodicTableEngineWebGpu.js` & `foundation-polytope-atlas.json`. | Keep extending immutable advisory datasets (AME2020, Materials Project, PREM, Lane–Emden/MESA, `P(k)`) — always non-blocking advisory. |
| **Gate 0** | Infrastructure | `ulg-gate0-foundation-arch` | **IN PROGRESS (0A–0C VERIFIED; 0D SLICES 1–2 LANDED)** | **0A DONE:** `src/runtime/peercomputeCore.js` + `vite.config.mjs` `worker.plugins` cut `dist/` **`117.5 MB → 37 MB` (`0` AI assets)**. **0B DONE & VULKAN-VERIFIED:** `src/runtime/gpuMath/` (`batchedSymmetricEigensolverGpu`, `fft3dWebGpu`, `molecularDynamicsWebGpu`, `chebyshevPolytopeFitGpu`). **0C DONE:** `ulg-gpu-abi/src/materialFoundationAbi.js` + `evaluatePolytopeAtlasWgsl` (`valid_mode = 2` exp) + `materialPolytopeRegistry.js` (`A x <= b` + `canonicalMaterialIsotopeKey`). **0D Slices 1–2:** 8-slot LRU bind-group caches across all 7 SS spatial views + gas-EOS/solid/mechanics views, pooled receipt ring, unified solid-fluid spatial hash, `water-realtime` K-step boundary fix (`14 → 0` err, `submits 1.72 <= 2`, `3.07x` faster, `iron-ice` `bindGroups 40.51 → 30.79`, `+44%` faster). | Finish remaining 0D Zero-Churn Slice 3 (`36.06` encoders/step, remaining `15.63`/`13.30` `createBuffer`, deduplicate 5 iron-ice contact paths, retire unused 63-limb `sphExactRational*`) + capture formal `ulg.campaign.receipt.v1`. |
| **Gate 1** | `10⁻¹⁵ → 10⁻⁹ m` | `ulg-gate1-periodic-table-engine` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b9e86811` after 3-round adversarial independent review (`plan/done/gate1-periodic-table.md`): full 5-domain WebGPU `Z = 1..118` + `(Z, A)` isotope engine (`0` SCF readbacks, `0` CPU interband fallbacks, 5 crystal classes `{ vdw-fcc: 16, bcc: 21, hcp: 50, diamond: 5, fcc: 26 }`, `50/50` exact 4-atom HCP volumes, metallic `fcc` `Pd`, `95` distinct element sRGBs, relativistic `Au`, `0/118` zero-MSD truncations) + real WebGPU 3D volumetric & zero-copy instanced MD renderer in `elements-lab.html` (`cameraAutoSpin: false`, `116,314` changed px across 10 inspected Wayland PNGs). | Accepted (`scientificValidation: false` & offline G7 advisory preserved). Optional post-acceptance deepening: 4-component Dirac–KS, `DFT+U`, and `Pu/Am/Bk` `5f` potential refinement. |
| **Gate 2** | `10⁻¹⁰ → 10⁻⁶ m` | `ulg-gate2-reactions-and-polytope-atlas` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b9e86811` after 3-round adversarial independent review (`plan/done/gate2-reactions-polytope-atlas.md`): 100% WebGPU RHF + `climbingImageNEBWebGpu` (`H2O`/`D2O` `E_a = 3.91 eV`), Slater + Allred–Rochow crystals (`Al2O3 corundum-D51`, `NaCl cscl-B2`, `Fe2O3`, `Na2O`), `discoverAndDeriveReactionProductsWebGpu` (`Na + H2O → NaOH + H2`), `20/20` compounds covering `15/15` legacy `compounds.json` (`0` `reference-fallback`, `provenance.gpuStagesExecuted`), persisted 4-phase GPU Chebyshev fits (`valueTransform: "exp"`, fail-closed hydration & `hitFlag == 0`) verified over `142,457` adversarial interior probes (`< 0.6%` ambient gases, `< 3.40%` structured interior across all `138/138` materials) + live WGSL Tab 6 Atlas. | Accepted (`scientificValidation: false` preserved). Optional post-acceptance deepening: extended covalent `SiO2` prototype, multi-step reaction networks, and persistent OPFS/IndexedDB Atlas cache. |
| **Gate 3** | `10⁻⁶ → 10⁺² m` | `ulg-gate3-continuum-substrate-and-physics` | **IN PROGRESS (GPU ATLAS BRIDGE, TRIAD MISS LOOP & ZERO-CHURN SLICE 2 LANDED)** | `foundationPolytopeAtlasGpuBridge.js` runs `evaluatePolytopeAtlasWgsl` directly on WebGPU (`hitFlag == 1` vs fail-closed `hitFlag == 0`, including `valid_mode = 2` exp fits), escalates misses through Eshkol AD + MoonLab 5-slot Triad GPU adoption, and seeds Studio's live worker GPU device automatically (`ulgMechanicsResidentStage.worker.js`); `water-realtime` hits **`submits/step 1.72 <= 2`**, `computePasses 16.24 <= 25`, `dispatchIndirect 0.78 <= 16`, `mapAsync 0`, `15.45 steps/s` (`3.07x` speedup, `0` boundary err); `iron-ice-quench` cut `bindGroups 40.51 → 30.79` & gained `+44%` speed (`3.77 steps/s`). | Hit full Section 3 budgets on `iron-ice-quench` (`submits <= 2`, `passes <= 25`, `workDone 0`, `createBuffer 0`) & `water-realtime >= 1.0x` RT under `gpuprobe.sh`, collapse remaining solid proxy hash onto canonical SS cells, wire in-shader WGSL Tier-1 atlas lookups directly into MPM/SPH hot loops, and capture formal receipt bundle. |
| **Gate 4** | `10⁻³ → 10⁺² m` | `ulg-gate4-studio-presentation` | **IN PROGRESS (VISIBLE WAYLAND SWEEP MEASURED `18.8–33.8 Hz`; DOUBLE-VSYNC DECOUPLING NEXT)** | Owner-approved visible Wayland Chrome 5-preset sweep completed (`gate4-wayland-sweep-20261123` + `v2`): all 5 presets rendered true WebGPU isosurfaces with `visibleContentAdvanced: true`, `0` page/GPU/Xid errors (`KERNEL_CLEAN`), and `water-realtime` at **`1.21–1.27x` RT**, but measured presented cadence stayed below `54 Hz` (`water-cycle` `21.29 → 27.49 Hz`, `iron-ice-quench` `18.79 Hz`, `sodium-water` `27.63 Hz`, `cesium-fluorine` `33.81 Hz`, `water-realtime` `22.93 Hz`; UI rAF `56.4–60.0 Hz`) due to double-vsync `onSubmittedWorkDone` + `rAF` contention on the shared WebGPU queue. | Decouple `onSubmittedWorkDone` / shared-queue `rAF` contention so all 5 active presets sustain `>= 54 Hz` visibly advancing state (`visibleMotionCadenceVerified: true`), re-verify on visible Wayland Chrome, and capture formal receipt bundle. |
| **Gate 5** | `10⁺⁶ → 10⁺²⁵ m` | `ulg-gate5-planetary-to-supergalactic` | **IMPLEMENTED & VULKAN + 2-BROWSER WEBRTC VERIFIED (FORMAL RECEIPT PENDING)** | **5A:** `planetaryStructureGpu.js`. **5B:** `stellarNucleosynthesisBridge.js` + canonical `SchroederScaleAtlas` multipole wired into `selfGravitatingHydroGpu.js` (`momentumRelError < 1e-4`, `+5000` shift `< 1e-4`). **5C:** `galacticIsmCoolingGpu.js` + canonical `SchroederScaleAtlas` multipole wired into `cosmicQuantumGpuKernels.js`. **5D:** **Hybrid FLRW TreePM** (`3×3×3` Gaussian-split peculiar-density sub-cell tree + Gate 0B `fft3dWebGpu.js` PM) in `supergalacticTreePmGpu.js` & **`supergalactic.html`** (visually verified sharp supercluster knots & filaments, `166,540` changed pixels), plus **real 2-browser-context WebRTC `RTCDataChannel` multi-host TreePM** (`tests/priority5ScaleAtlasAndWebRtcTreePm.native.test.mjs`: WS closed before RPC, G5 CAS tile leases, exact global mass conservation, fail-closed peer-loss reassignment). | Integrate `../peercompute` native extensions once `agy` ships them (GPU-buffer chunking, multi-realm distributed G5 reservations, `>= 128³` multi-node halo exchange), retire legacy octree helpers once all callers migrate, and capture formal receipt bundle. |

---

## 5. Campaign Progress & Next Prioritized Queue (2026-11-23, Post-`b9e86811`)

### Completed & Formally Accepted (`f6623b39..b9e86811`)
- [x] **Gate 1 & Gate 2 Formal ICC Acceptance (`52d471fd..b9e86811` — `2/8 → 4/8` Accepted):** Remediated all 5 Round-1 & 3 Round-2 independent audit findings (zero CPU interband fallbacks, relativistic `Au`, 5 crystal symmetries, exact `50/50` 4-atom HCP volumes, metallic `fcc` `Pd`, `1e6` MSD precision, 100% WebGPU CI-NEB, Slater+Allred–Rochow ionic crystals, persisted 4-phase log-density Chebyshev fits verified over `142,457` adversarial interior probes, true WebGPU 3D/MD/Atlas renderer in `elements-lab.html`) and passed ICC completion oracles `ulg-gate1-periodic-table-engine` (`3/3 PASS`) and `ulg-gate2-reactions-and-polytope-atlas` (`3/3 PASS`). See [`plan/done/gate1-periodic-table.md`](done/gate1-periodic-table.md) & [`plan/done/gate2-reactions-polytope-atlas.md`](done/gate2-reactions-polytope-atlas.md).
- [x] **Gate 4 Honest Visible Wayland 5-Preset Sweep Measured:** Ran visible Wayland Chrome across all 5 active Studio presets (`0` errors, `KERNEL_CLEAN`, `visibleContentAdvanced: true`, `water-realtime` `1.21–1.27x` RT), measured real presented cadence `18.8–33.8 Hz` (honestly `in_progress` below `54 Hz`), and isolated double-vsync `onSubmittedWorkDone` + `rAF` contention on the shared WebGPU queue.
- [x] **Campaign Priorities 1–5 (`f6623b39..c09644f8`):** End-to-end `(Z, A)` isotopes & isotopologues (`f6623b39`), Gate 0D/3 Zero-Churn Slice 2 & `water-realtime` K-step pacing (`ca9824d8`), Gate 3 GPU Tier-1 Polytope Atlas bridge & `15/15` legacy compound coverage (`98214a11`), bulk viscosity alpha audit, and Hybrid FLRW TreePM + canonical Scale-Atlas astrophysics gravity + 2-browser WebRTC TreePM (`c09644f8`).

### Next Prioritized Campaign Queue (Post-`b9e86811`)
1. **Next Item 1 — Gate 4 Double-Vsync Decoupling (`18.8–33.8 Hz → >= 54 Hz`) & Formal Gate 4 Receipt:**
   - Eliminate double-vsync `onSubmittedWorkDone` + `rAF` contention on the shared WebGPU presentation queue (`ulgOffscreenRender.worker.js` / `sphWorkerPresentationQos.js`), re-run the visible Wayland Chrome 5-preset sweep to verify `visibleMotionCadenceVerified: true` at `>= 54 Hz` across all 5 presets, and capture a reviewed Gate 4 `ulg.campaign.receipt.v1` bundle.
2. **Next Item 2 — Gate 0D / Gate 3 Zero-Churn Slice 3 (`iron-ice` Section 3 Budgets & `water-realtime >= 1.0x` RT):**
   - Eliminate remaining `15.63` / `13.30` per-step `createBuffer` allocations, fuse `iron-ice-quench` passes (`31.53 → <= 25`, `submits 3.65 → <= 2`, `workDone 3.24 → 0`), deduplicate 5 overlapping iron-ice contact paths → 1 canonical GPU authority, collapse remaining solid proxy hash & dormancy grids onto SS cells, retire unused 63-limb `sphExactRational*`, and capture Gate 0 & Gate 3 formal receipts.
3. **Next Item 3 — In-Shader WGSL Tier-1 Polytope Atlas Evaluation Inside Live MPM/SPH Kernels:**
   - Bind the seeded `foundationPolytopeAtlasGpuBridge.js` GPU buffers (`valid_mode = 2` exp + polynomial) directly into resident SPH/MPM EOS & thermal WGSL kernels so per-particle/per-cell thermodynamics evaluate `evaluatePolytopeAtlasWgsl` inline with asynchronous `hitFlag == 0` Eshkol/MoonLab worker escalation.
4. **Next Item 4 — Gate 5 Formal Acceptance & Multi-Node PeerCompute Extension Integration:**
   - Capture formal Gate 5 (`ulg-gate5-planetary-to-supergalactic`) receipt bundle and integrate `../peercompute` extensions once `agy` completes `/home/cos/projects/peercompute/plan/todo/ulg-scale-ladder-peercompute-extensions.md` (zero-copy WebRTC GPU chunking, multi-realm distributed G5 `ReservationLedger`, `>= 128³` distributed TreePM halo exchange), retiring superseded legacy octree paths.
5. **Next Item 5 — Post-Acceptance Gate 1–2 Fidelity Deepening & OPFS Warm Cache (Optional):**
   - Upgrade `radialKohnShamWebGpu.js` toward full 4-component Dirac–KS + spin-polarized `DFT+U` / `mBJ`, refine `Pu/Am/Bk` `5f` Morse+EAM `alpha` clamp and extended covalent `SiO2` prototype, expand multi-step CI-NEB reaction networks, and add persistent OPFS/IndexedDB Atlas caching.

---

### Full Scale-Ladder Execution Reference (Bottom-Up From `10⁻¹⁵ m` to `10⁺²⁵ m`)

> **Master Blueprints:**
> - Gates 0–2 (`10⁻¹⁵ → 10⁻⁶ m` + Shared Foundation): [`plan/todo/periodic-table-polytope-atlas-foundation-plan.md`](todo/periodic-table-polytope-atlas-foundation-plan.md)
> - Gates 3–4 (`10⁻⁶ → 10⁺² m` Continuum & Studio): [`plan/todo/SS/schroeder-tree-and-algorithm-plan.md`](todo/SS/schroeder-tree-and-algorithm-plan.md), [`plan/todo/scale-adaptive-law-activation-plan.md`](todo/scale-adaptive-law-activation-plan.md), [`plan/todo/sol-critic.md`](todo/sol-critic.md), [`plan/todo/first-class-air.md`](todo/first-class-air.md)
> - Gate 5 (`10⁺⁶ → 10⁺²⁵ m` Planetary → Supergalactic): [`plan/todo/planetary-to-supergalactic-scale-atlas-plan.md`](todo/planetary-to-supergalactic-scale-atlas-plan.md), [`plan/todo/hydrogen-nebula-to-star-fusion-bridge-plan.md`](todo/hydrogen-nebula-to-star-fusion-bridge-plan.md), [`plan/todo/distributed-peercompute-network-stack-plan.md`](todo/distributed-peercompute-network-stack-plan.md)

### Priority 0 (Gate 0) — Architectural & GPU Numerical Foundation *(Start Immediately)*
1. **0A. `peercompute-core` Slim Entrypoint Split:** Decouple ULG runtime imports from `../peercompute`'s AI inference stack (`onnxruntime-web`, `@wllama`, `@huggingface/transformers`), cutting `dist/` from `117.5 MB` to `~34 MB` (`0` `ort-wasm` assets).
2. **0B. Shared WebGPU Numerical Substrate (`src/runtime/gpuMath/`):** Build & Vulkan-verify:
   - `batchedSymmetricEigensolverGpu.js` (batched dense Hermitian/symmetric eigensolver)
   - `fft3dWebGpu.js` (batched 3D Radix-2 FFT/IFFT — powers BOTH Gate 1 Bulk DFT AND Gate 5D Cosmological TreePM!)
   - `molecularDynamicsWebGpu.js` (cell-list Velocity-Verlet + thermostat/barostat + EAM/pair/3-body potentials + GPU RDF/MSD/Green–Kubo reductions)
   - `chebyshevPolytopeFitGpu.js` (convex polytope `A x <= b` Chebyshev fitter extending `responseFunctionFitGpu.js`)
3. **0C. Canonical ABIs (`ulg-gpu-abi`):** Lock `ulg.material-property-bundle.v1` (Nuclear + Atomic + EM/Optical/Magnetic + Mechanical + Thermodynamic) and `ulg.polytope-atlas.v1` (half-space polytopes, slanted coexistence facets, GPU Chebyshev tables, fail-closed invalidation).
4. **0D. Continuum Zero-Churn Step Loop Sprint *(mandatory before Gate 3; can run right after 0A–0C or before Gate 3)*:** Eliminate `16` `createBuffer`, `40.5` `createBindGroup`, `36.6` encoders, `3.26` `workDone`, `0.35` `mapAsync` per step; deduplicate 5 overlapping iron-ice contact laws → 1 GPU authority; fix `thermalPotential` `deferred-capacity` stall; migrate `sphPhaseCarrierTransferGpu.js` off 63-limb `sphExactRational*` (`71` refs / `33` files) onto 9-limb `2^-149` and delete dead 63-limb + CPU mirror files.

### Priority 1 (Gate 1) — Complete Periodic Table Engine (`Z = 1..118`) + Real Live GPU Visualizations
5. **P1.1 Nuclear (`10⁻¹⁵ m`):** Full `(Z, A)` binding energy `B(Z, A)` (LDM + Strutinsky shells + pairing), finite `R_nuc(A)` feeding atomic DFT, Woods–Saxon levels (`I^π, μ_I`), `α/β±/EC/SF` Q-values & WKB Gamow tunneling + live GPU 3D nuclear density, Chart of Nuclides, and WKB barrier visuals.
6. **P1.2 Relativistic Atomic QM (`10⁻¹⁰ m`, WebGPU):** Upgrade `solveAtomFullWebGpu` to 4-component radial Dirac–KS + spin-polarized PBE/SCAN + finite `V_nuc(r)` + Uehling/Welton QED + GPU `ΔSCF` (`I_k, EA`), polarizability `α_0`, norm-conserving pseudopotentials + live 3D volumetric orbital, spin-density, radial-node, and SCF visuals.
7. **P1.3 EM, Magnetism, Optics & Bulk Solid DFT (`10⁻⁹ m`, WebGPU):** Port `periodicBulkDft` onto `gpuMath` (`mBJ/SCAN` + spin-polarized `DFT+U` + crystal selection) → `a_0, ρ_0, K, C_ij, G, Θ_D`, bands `E_n(k)`, DOS, `E_g, E_F, Φ`, Bloch–Grüneisen `σ(T)`, Stoner/Curie–Weiss `χ(T), M_s, T_C`, Kubo–Greenwood+Drude `ε(ω), n, k, R_0, sRGB`, `T_c` + live 3D Bloch charge/spin density, band/DOS, Fermi surface, and spectral visuals.
8. **P1.4 Statistical Mechanics, Phonons & WebGPU MD:** DFT-fitted potentials → WebGPU coexistence/slab/Green–Kubo MD + QHA phonons (`T_m, T_b, C_v, C_p, α_V, ΔH_fus, ΔH_vap, ρ_liq, η, k, γ`) + live 3D WebGPU atomic MD crystal/melting/vaporization visuals.
9. **P1.5 Complete `Z = 1..118` Audit:** Close 7 missing noble gases (`He..Og`), retire `reference-fallback` rows in `elements.json`, ship `elements-lab.html`, and publish offline G7 advisory scorecard.

### Priority 2 (Gate 2) — Chemical Reactions → Compound Feedback Loop → Convex Polytope Atlas
10. **P2.1–P2.2 GPU Molecular QM & Reactions:** Port RHF/UHF/UMP2/CAS(2,2)/CI-NEB onto `gpuMath`; generalized reaction discovery (`A + B → C + D`, Sedenion prioritized), `ΔH, ΔG(T), E_a` + live 3D reactive orbital evolution.
11. **P2.3 Recursive Compound Feedback:** Feed every resultant compound (`H₂O, NaOH, CsF, NaCl, FeO, CO₂, ...`) straight back into **P1.2–P1.4** (molecular PES/MD + canonical ionic/covalent crystal DFT/MD + EM/optical), retiring `15/15` `reference-fallback` compounds & additive blend shortcuts.
12. **P3.1–P3.3 Convex Polytope Atlas:** Decompose `(T, log10 P, ...)` phase diagrams into convex `A x <= b` polytopes along computed coexistence curves, fit GPU Chebyshev surfaces with auto-bisection & conservation/residual gates, ship 3D Atlas Visualizer, and wire direct Tier-1 GPU material packing.

### Priority 3 (Gate 3) — Macroscopic Continuum Engine & Unified SS (`10⁻⁶ → 10⁺² m`)
13. Plug Gate 2 Polytope Atlas natively into ULG Studio's Tier-1 GPU buffers (with Tier-2 A3 regional sampling & Tier-3 A6 PeerCompute miss synthesis); finish 0D Zero-Churn Step Loop; collapse 3 private 4,096-bucket solid hashes & private dormancy 3D grids onto canonical SS cells; enable indirect dispatch on all 4 law families + exact `2^-149` ledgers + multi-level first-class air + 3+ SS levels on canonical presets passing Section 3 GPU budgets.

### Priority 4 (Gate 4) — Interactive Real-Time Studio Presentation (`10⁻³ → 10⁺² m`)
14. Verify `visibleMotionCadenceVerified: true` at `>= 54 Hz` decoupled latest committed state across all 5 active Studio presets (`water-cycle`, `iron-ice-quench`, `sodium-water`, `cesium-fluorine`, `water-realtime`) with true isosurfaces, refraction, Cherenkov, volumetric plumes, and zero visual fakes.

### Priority 5 (Gate 5) — Planetary → Stellar → Galactic → Supergalactic Cosmology (`10⁺⁶ → 10⁺²⁵ m`)
15. **5A Planetary:** Polytope-Atlas planetary interiors + symplectic Scale Atlas N-body & tidal/impact hydro.
16. **5B Stellar:** Migrate `self-gravitating-hydro@1` onto canonical `SS` Scale Atlas multipole + Gate 1 nuclear networks + TOV/degeneracy + G7 Lane–Emden/MESA checks.
17. **5C Galactic:** Migrate `cosmicQuantumGpuKernels` off private octree onto `SS` Scale Atlas multipole + coupled compressible ISM hydro + Gate 1 atomic cooling + SMBH.
18. **5D Supergalactic Cosmology:** Expanding FLRW comoving **GPU 3D-FFT TreePM** (`fft3dWebGpu` + `SS` Scale Atlas multipole) from Zel'dovich `P(k)` ICs evolving real dark-matter filaments, halos, voids, and baryon WHIM + multi-host PeerCompute WAN/WebRTC domain partitioning (`distributed-peercompute-network-stack-plan.md`).

---

## 6. Document & Evidence Map

- **Canonical rules:** [`AGENTS.md`](../AGENTS.md) (`CLAUDE.md` → `@AGENTS.md`)
- **Active routing (read first):** `plan/CURRENT-PLAN.md` (this file)
- **Scale-Ladder Master Blueprints:**
  - Gates 0–2 (`10⁻¹⁵ → 10⁻⁶ m`): [`plan/todo/periodic-table-polytope-atlas-foundation-plan.md`](todo/periodic-table-polytope-atlas-foundation-plan.md)
  - Gates 3–4 (`10⁻⁶ → 10⁺² m`): [`plan/todo/SS/schroeder-tree-and-algorithm-plan.md`](todo/SS/schroeder-tree-and-algorithm-plan.md), [`plan/todo/scale-adaptive-law-activation-plan.md`](todo/scale-adaptive-law-activation-plan.md)
  - Gate 5 (`10⁺⁶ → 10⁺²⁵ m`): [`plan/todo/planetary-to-supergalactic-scale-atlas-plan.md`](todo/planetary-to-supergalactic-scale-atlas-plan.md)
- **Live checkpoint log:** [`plan/STATUS.md`](STATUS.md) (top ~40 lines)
- **Active todo index (all 33 open docs organized by Gate 0–5):** [`plan/todo/README.md`](todo/README.md)
- **Architecture reference:** [`plan/project-orientation.md`](project-orientation.md),
  [`plan/ss-law-architecture-assessment.md`](ss-law-architecture-assessment.md),
  [`plan/solver-law-inventory.md`](solver-law-inventory.md),
  [`plan/ULG_Triad_Current_Plan_Addendum.html`](ULG_Triad_Current_Plan_Addendum.html)
- **ICC durable control plane:** [`.icc/completion-oracles.yaml`](../.icc/completion-oracles.yaml),
  [`.icc/assistant-goals.yaml`](../.icc/assistant-goals.yaml),
  [`.icc/quality-campaigns.yaml`](../.icc/quality-campaigns.yaml) (external
  receipts under `/home/cos/.cache/icc/repos/ulg/`)
- **Archives (consult only on historical audit):** `plan/done/` (incl.
  `done/handoffs/`, `done/audits/`, `done/refactor/`, `done/SS/`, `done/nitpicks.md`),
  `plan/moot/`, `plan/log.md`, `plan/plan.md`, `plan/implementation-status.md`,
  `plan/tests.md`, `plan/notes/` (start at `plan/notes/BRIEF.md`)
