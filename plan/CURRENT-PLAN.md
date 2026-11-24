# ULG Current Plan (Authoritative Routing Document — Unified 40-OOM Scale-Ladder Roadmap)

- **Effective:** 2026-11-23 AKST (Unified 40-OOM Foundation-First Scale-Ladder Roadmap — **Gate 4 formally ICC-accepted at `44bb6f13` [`5/8` accepted: `G5`, `G7`, `Gate 1`, `Gate 2`, `Gate 4`]**; Priority 2 `Gate 0` → Priority 3 `Gate 3` → Priority 4 `Gate 5` executing next)
- **Active branch:** `feat/star-spec-generalization-audit` (HEAD `44bb6f13`; `main` & `origin/main` at `f1cf07c7`)
- **Publication hold:** **ACTIVE** — local commits on feature branch only; no `git push`, no merge to `main`, and no `npm run build:pages` / `docs/` edits without explicit authorization from **big dog**.
- **Master Mission (Unchanged — `10⁻¹⁵ m → 10⁺²⁵ m`):** ULG is a **first-principles, browser-native WebGPU multiscale physics engine** spanning 40 orders of magnitude — from nuclear structure (`10⁻¹⁵ m`) through atoms, crystals, chemistry, macroscopic continuum matter (`10⁻⁶..10⁺² m`), planets, stars, galaxies, and supergalactic cosmic-web cosmology (`10⁺²⁵ m`) — governed by Star Spec v0.4, the **Schroeder Simulation (`SS`) Scale Atlas**, the **Tier 0–3 Closure Economy**, and the **PeerCompute / Eshkol / MoonLab Triad**.
- **Immediate Scope (Foundation-First Execution Order):** Rather than building upper scales on `reference-fallback` material seeds and CPU-bound closures, we execute strictly **bottom-up** so every higher scale inherits validated GPU primitives, first-principles closures, and convex Polytope Atlases from the rungs beneath it:
  - **Gate 0 (Priority 0 — 0A–0C Verified; 0D Zero-Churn In Progress):** Architectural & GPU Numerical Foundation (`peercompute-core`, `gpuMath`, Canonical ABIs, Zero-Churn Step Loop).
  - **Gate 1 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Complete First-Principles Periodic Table Material Engine (`Z = 1..118` + `(Z, A)` isotopes: Nuclear + Relativistic Atomic + EM/Magnetism/Optics/Conductivity + Bulk DFT + WebGPU MD) with **real live WebGPU visualizations** (`elements-lab.html`) — see [`plan/done/gate1-periodic-table.md`](done/gate1-periodic-table.md).
  - **Gate 2 (ACCEPTED 2026-11-23 — `3/3 PASS`):** First-Principles Chemical Reactions (100% WebGPU RHF + CI-NEB) → **Recursive Compound Feedback Loop** → **Per-Material & Per-Compound 4-Phase Convex Polytope Atlas** (`A x <= b` + persisted GPU Chebyshev Tier-1 tables) — see [`plan/done/gate2-reactions-polytope-atlas.md`](done/gate2-reactions-polytope-atlas.md).
  - **Gate 3 (Priority 3 — In Progress):** Macroscopic Continuum Engine (`SS` + MLS-MPM + Exact `2^-149` Ledgers + Unified Solids + Section 3 GPU Budgets) consuming the Gate 2 Polytope Atlas natively.
  - **Gate 4 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Decoupled Interactive Studio Presentation (`72.96–113.25 Hz` mean presented, `62–100 Hz` min sustained 500ms, `25.3–33.5 ms` max gap, `visibleMotionCadenceVerified: true` & `resetVerified: true` across all 5 active presets) — see [`plan/done/gate4-studio-presentation.md`](done/gate4-studio-presentation.md).
  - **Gate 5 (Priority 4 — Pre-Acceptance Audit Complete; `B1–B8` Remediation Next):** Planetary (`10⁺⁶ m`) → Stellar (`10⁺⁸–10⁺¹⁷ m`) → Galactic (`10⁺¹⁷–10⁺²² m`) → Supergalactic Cosmology (`10⁺²²–10⁺²⁵ m` FLRW TreePM + distributed PeerCompute `SpatialTileLeaseBroker` scaling) built directly on Gate 0's `fft3dWebGpu` + canonical `SS` Scale Atlas multipole + Gate 1–2 nuclear/atomic/polytope closures.
- **Formal ICC Campaign Status:** **5 of 8 gates formally accepted** — **G5** ([done/g5-reservation.md](done/g5-reservation.md)), **G7** ([done/g7-release-audit.md](done/g7-release-audit.md)), **Gate 1** ([done/gate1-periodic-table.md](done/gate1-periodic-table.md)), **Gate 2** ([done/gate2-reactions-polytope-atlas.md](done/gate2-reactions-polytope-atlas.md)), and **Gate 4** ([done/gate4-studio-presentation.md](done/gate4-studio-presentation.md)). The 11 former fragmented open milestones (G1–G4, G6, A1–A6) are consolidated into **6 clean Scale-Ladder gates (`Gate 0` through `Gate 5`)** while preserving all historical legacy oracle definitions and audit history in [`.icc/completion-oracles.yaml`](../.icc/completion-oracles.yaml) (honesty rule: never mark unaccepted oracles `completed`).

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

> **Honesty boundary:** **5 of 8 gates** have formally accepted
> `ulg.campaign.receipt.v1` bundles on disk (`/home/cos/.cache/icc/repos/ulg/`):
> **G5**, **G7**, **Gate 1**, **Gate 2**, and **Gate 4**. Gates 0, 3, and 5
> remain honestly `in_progress`. Verified baseline at `44bb6f13`: **`6,212 pass
> / 0 fail`** full host suite (`197` opt-in skips, `6,409` total) + **`3/3`
> Gate 4 native Vulkan optics/Cherenkov/parcel-optics PASS** + **`6/6` Gate 0–3
> Vulkan native proofs PASS** + **`5/5` visible Wayland Vulkan Studio presets
> PASS (`72.96–113.25 Hz`, `25.3–33.5 ms` max gap, `5/5` Pause/Step/Reset)** +
> `npm run build` PASS (`4.05 s`, `dist/` = **`37 MB`**, `0` AI/`ort-wasm`
> assets) + `KERNEL_CLEAN`.

| Gate | Scale Span | ICC Oracle Target | Status | Live Code Today (`b9e86811`) | Remaining Work to Formally Accept Gate |
|---|---|---|---|---|---|
| **G5** | Cross-Scale | `ulg-g5-reservation` | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Bounded single-realm JS CAS `ReservationLedger` live + wired into Gate 5D `distributedSpatialPartitioner.js` & verified over real 2-browser WebRTC TreePM (`priority5ScaleAtlasAndWebRtcTreePm.native.test.mjs`). | Multi-realm distributed reservation extends via PeerCompute extension spec (`/home/cos/projects/peercompute/plan/todo/ulg-scale-ladder-peercompute-extensions.md`). |
| **G7** | Cross-Scale | `ulg-g7-release-audit` | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Offline advisory NIST/PubChem audit tooling live + Gate 1 element/compound advisory scorecards in `periodicTableEngineWebGpu.js` & `foundation-polytope-atlas.json`. | Keep extending immutable advisory datasets (AME2020, Materials Project, PREM, Lane–Emden/MESA, `P(k)`) — always non-blocking advisory. |
| **Gate 0** | Infrastructure | `ulg-gate0-foundation-arch` | **IN PROGRESS (0A–0C VERIFIED; 0D SLICES 1–2 LANDED)** | **0A DONE:** `src/runtime/peercomputeCore.js` + `vite.config.mjs` `worker.plugins` cut `dist/` **`117.5 MB → 37 MB` (`0` AI assets)**. **0B DONE & VULKAN-VERIFIED:** `src/runtime/gpuMath/` (`batchedSymmetricEigensolverGpu`, `fft3dWebGpu`, `molecularDynamicsWebGpu`, `chebyshevPolytopeFitGpu`). **0C DONE:** `ulg-gpu-abi/src/materialFoundationAbi.js` + `evaluatePolytopeAtlasWgsl` (`valid_mode = 2` exp) + `materialPolytopeRegistry.js` (`A x <= b` + `canonicalMaterialIsotopeKey`). **0D Slices 1–2:** 8-slot LRU bind-group caches across all 7 SS spatial views + gas-EOS/solid/mechanics views, pooled receipt ring, unified solid-fluid spatial hash, `water-realtime` K-step boundary fix (`14 → 0` err, `submits 1.72 <= 2`, `3.07x` faster, `iron-ice` `bindGroups 40.51 → 30.79`, `+44%` faster). | Finish remaining 0D Zero-Churn Slice 3 (`36.06` encoders/step, remaining `15.63`/`13.30` `createBuffer`, deduplicate 5 iron-ice contact paths, retire unused 63-limb `sphExactRational*`) + capture formal `ulg.campaign.receipt.v1`. |
| **Gate 1** | `10⁻¹⁵ → 10⁻⁹ m` | `ulg-gate1-periodic-table-engine` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b9e86811` after 3-round adversarial independent review (`plan/done/gate1-periodic-table.md`): full 5-domain WebGPU `Z = 1..118` + `(Z, A)` isotope engine (`0` SCF readbacks, `0` CPU interband fallbacks, 5 crystal classes `{ vdw-fcc: 16, bcc: 21, hcp: 50, diamond: 5, fcc: 26 }`, `50/50` exact 4-atom HCP volumes, metallic `fcc` `Pd`, `95` distinct element sRGBs, relativistic `Au`, `0/118` zero-MSD truncations) + real WebGPU 3D volumetric & zero-copy instanced MD renderer in `elements-lab.html` (`cameraAutoSpin: false`, `116,314` changed px across 10 inspected Wayland PNGs). | Accepted (`scientificValidation: false` & offline G7 advisory preserved). Optional post-acceptance deepening: 4-component Dirac–KS, `DFT+U`, and `Pu/Am/Bk` `5f` potential refinement. |
| **Gate 2** | `10⁻¹⁰ → 10⁻⁶ m` | `ulg-gate2-reactions-and-polytope-atlas` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b9e86811` after 3-round adversarial independent review (`plan/done/gate2-reactions-polytope-atlas.md`): 100% WebGPU RHF + `climbingImageNEBWebGpu` (`H2O`/`D2O` `E_a = 3.91 eV`), Slater + Allred–Rochow crystals (`Al2O3 corundum-D51`, `NaCl cscl-B2`, `Fe2O3`, `Na2O`), `discoverAndDeriveReactionProductsWebGpu` (`Na + H2O → NaOH + H2`), `20/20` compounds covering `15/15` legacy `compounds.json` (`0` `reference-fallback`, `provenance.gpuStagesExecuted`), persisted 4-phase GPU Chebyshev fits (`valueTransform: "exp"`, fail-closed hydration & `hitFlag == 0`) verified over `142,457` adversarial interior probes (`< 0.6%` ambient gases, `< 3.40%` structured interior across all `138/138` materials) + live WGSL Tab 6 Atlas. | Accepted (`scientificValidation: false` preserved). Optional post-acceptance deepening: extended covalent `SiO2` prototype, multi-step reaction networks, and persistent OPFS/IndexedDB Atlas cache. |
| **Gate 3** | `10⁻⁶ → 10⁺² m` | `ulg-gate3-continuum-substrate-and-physics` | **IN PROGRESS (GPU ATLAS BRIDGE, TRIAD MISS LOOP & ZERO-CHURN SLICE 2 LANDED)** | `foundationPolytopeAtlasGpuBridge.js` runs `evaluatePolytopeAtlasWgsl` directly on WebGPU (`hitFlag == 1` vs fail-closed `hitFlag == 0`, including `valid_mode = 2` exp fits), escalates misses through Eshkol AD + MoonLab 5-slot Triad GPU adoption, and seeds Studio's live worker GPU device automatically (`ulgMechanicsResidentStage.worker.js`); `water-realtime` hits **`submits/step 1.72 <= 2`**, `computePasses 16.24 <= 25`, `dispatchIndirect 0.78 <= 16`, `mapAsync 0`, `15.45 steps/s` (`3.07x` speedup, `0` boundary err); `iron-ice-quench` cut `bindGroups 40.51 → 30.79` & gained `+44%` speed (`3.77 steps/s`). | Hit full Section 3 budgets on `iron-ice-quench` (`submits <= 2`, `passes <= 25`, `workDone 0`, `createBuffer 0`) & `water-realtime >= 1.0x` RT under `gpuprobe.sh`, collapse remaining solid proxy hash onto canonical SS cells, wire in-shader WGSL Tier-1 atlas lookups directly into MPM/SPH hot loops, and capture formal receipt bundle. |
| **Gate 4** | `10⁻³ → 10⁺² m` | `ulg-gate4-studio-presentation` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `44bb6f13` after 2-round adversarial independent review (`plan/done/gate4-studio-presentation.md`; Round 1 FAIL `2d955c07` preserved; Round 2 ACCEPT `1b886022`): all 5 active Studio presets pass `>= 54 Hz` decoupled true-isosurface presentation (`water-cycle` `89.96 Hz / 25.3 ms`, `iron-ice-quench` `72.96 Hz / 33.5 ms`, `sodium-water` `76.82 Hz / 30.6 ms`, `cesium-fluorine` `74.29 Hz / 28.5 ms`, `water-realtime` `113.25 Hz / 25.7 ms / 1.84–2.09x RT`; UI rAF ~120 Hz reported separately), strictly finite motion horizon (distinct `f32` shader ages, zero Zeno loop), `5/5` Pause/Step/Reset across lane rebuilds (`resetStep: 4`), `3/3` native Vulkan optics PASS, `6,212/6,212` host tests PASS, `KERNEL_CLEAN`. | Accepted (`scientificValidation: false` preserved). |
| **Gate 5** | `10⁺⁶ → 10⁺²⁵ m` | `ulg-gate5-planetary-to-supergalactic` | **IN PROGRESS (PRE-ACCEPTANCE AUDIT IDENTIFIED `B1–B8`; PEERCOMPUTE `SpatialTileLeaseBroker` READY)** | Adversarial pre-acceptance audit (`cd3aaaf8`) identified 8 concrete blockers (`B1–B8`) before formal acceptance: migrate 5B/5C default gravity off private octrees onto parallel `@workgroup_size(64)` canonical `SchroederScaleAtlas` multipole (`B1`), WebGPU Polytope-Atlas hydrostatic 5A interiors (`B2`), beta/EC Q-value fix + GPU nuclear rates in 5B (`B3`), ping-pong buffer race + Gate 1 cooling + compressible ISM hydro + symmetric SMBH recoil in 5C (`B4`), 1-submit TreePM + GPU `P(k)` telemetry + GPU Zel'dovich ICs in 5D (`B5`), fail-closed `SpatialTileLeaseBroker` (now shipped in `../peercompute` `core.js`) + true disjoint-slab 2-browser WebRTC TreePM (`B6`), `cosmic-quantum.html` `supergalactic-cosmic` null-`byteLength` crash (`B7`), and `cameraAutoSpin: false` locked-camera visuals (`B8`). | Remediate `B1–B8`, verify all Gate 5 Vulkan + partitioned 2-browser WebRTC suites + locked-camera visual sequences, run independent review, and capture formal `ulg.campaign.receipt.v1`. |

---

## 5. Campaign Progress & Next Prioritized Queue (2026-11-23, Post-`b9e86811`)

### Completed & Formally Accepted (`f6623b39..44bb6f13`)
- [x] **Gate 4 Formal ICC Acceptance (`2d955c07..44bb6f13` — `4/8 → 5/8` Accepted):** Eliminated double-vsync & shared-queue contention, remediated both Round 1 independent audit blockers (strictly finite motion horizon with distinct `f32` shader ages and zero Zeno loop; device-cached buffer ownership across `#sph-reset` lane rebuilds), verified `5/5` presets at `72.96–113.25 Hz` mean / `62–100 Hz` min sustained 500ms / `25.3–33.5 ms` max gap + `5/5` Pause/Step/Reset + `3/3` native Vulkan optics + `6,212/6,212` host tests + `KERNEL_CLEAN`, and passed `ulg-gate4-studio-presentation` (`3/3 PASS`, `status: complete`) on fresh ICC index. See [`plan/done/gate4-studio-presentation.md`](done/gate4-studio-presentation.md).
- [x] **Gate 1 & Gate 2 Formal ICC Acceptance (`52d471fd..b9e86811` — `2/8 → 4/8` Accepted):** Remediated all 5 Round-1 & 3 Round-2 independent audit findings and passed ICC completion oracles `ulg-gate1-periodic-table-engine` (`3/3 PASS`) and `ulg-gate2-reactions-and-polytope-atlas` (`3/3 PASS`). See [`plan/done/gate1-periodic-table.md`](done/gate1-periodic-table.md) & [`plan/done/gate2-reactions-polytope-atlas.md`](done/gate2-reactions-polytope-atlas.md).
- [x] **Campaign Priorities 1–5 (`f6623b39..c09644f8`):** End-to-end `(Z, A)` isotopes & isotopologues (`f6623b39`), Gate 0D/3 Zero-Churn Slice 2 & `water-realtime` K-step pacing (`ca9824d8`), Gate 3 GPU Tier-1 Polytope Atlas bridge & `15/15` legacy compound coverage (`98214a11`), bulk viscosity alpha audit, and Hybrid FLRW TreePM + canonical Scale-Atlas astrophysics gravity + 2-browser WebRTC TreePM (`c09644f8`).

### Next Prioritized Campaign Queue (Post-`44bb6f13`, `5/8 → 8/8`)
1. **Next Item 1 (Priority 2) — Gate 0D Zero-Churn Slice 3, Official `peercompute/core` Consolidation & Formal Gate 0 Acceptance (`5/8 → 6/8`):**
   - Route `src/runtime/peercomputeCore.js` and all 6 direct importers through official `../../../peercompute/peercompute/src/peercompute/core.js` (`0` AI/ORT edges, exporting `SpatialTileLeaseBroker`).
   - Fuse `thermalPotentialGpu.js` receipt copy + preserve last non-null `cumulativeConsumerHits`; finish remaining bindGroup caching (`sphSpatialGasLedgerEosGpu.js` generation suffix strip, `schroederHierarchyGpu.js`, `sphRenderGpuKernel.js`, `sphG2pGpuKernel.js`, `sphParticipatingMediumGpu.js`) & pooling; deduplicate overlapping iron-ice contact paths & retire dead 63-limb `sphExactRational*` production hooks; capture reviewed Gate 0 bundle & pass `ulg-gate0-foundation-arch`.
2. **Next Item 2 (Priority 3) — In-Shader WGSL Tier-1 Polytope Atlas Evaluation (`eval_polytope_atlas_bank_2d`), Async Miss Escalation & Formal Gate 3 Acceptance (`6/8 → 7/8`):**
   - Pack multi-material Polytope Atlas bank once per device, bind inline into `mlsMpmMechanicsRefreshWgsl` (`@binding(8)` + expanded `@binding(7)` miss receipt) and `sphSpatialGasLedgerEosGpu.js` (`@binding(10)`), wire schedule-boundary `escalatePolytopeMissToTriadGpu` adoption in `ulgMechanicsResidentStage.worker.js`, verify Section 3 GPU budgets via `scripts/gpuprobe.sh` + live Vulkan proof, and pass `ulg-gate3-continuum-substrate-and-physics`.
3. **Next Item 3 (Priority 4) — Gate 5 `B1–B8` Remediation, Official `SpatialTileLeaseBroker` & Formal Gate 5 Acceptance (`7/8 → 8/8`):**
   - Remediate all 8 adversarial pre-acceptance blockers (`B1–B8`): parallel `@workgroup_size(64)` canonical `SchroederScaleAtlas` multipole default gravity (5B/5C), WebGPU Polytope-Atlas hydrostatic 5A interiors, Gate 1 beta/EC Q-value fix + GPU nuclear rates in 5B, ping-pong buffer race + Gate 1 cooling + compressible ISM hydro + symmetric SMBH recoil in 5C, 1-submit TreePM + GPU `P(k)` + GPU Zel'dovich ICs in 5D, fail-closed `SpatialTileLeaseBroker` + disjoint-slab 2-browser WebRTC TreePM (`B6`), `cosmic-quantum.html` `supergalactic-cosmic` null-`byteLength` fix (`B7`), and `cameraAutoSpin: false` locked-camera visual sequences (`B8`), then pass `ulg-gate5-planetary-to-supergalactic`.
4. **Next Item 4 — Post-Gate-5 Continuum Visual & Material-Volume Fidelity Queue (Owner-Prioritized 2026-11-23):**
   - **Foreground Refraction Depth-Rejection (`plan/todo/surface-contact-transport-phase-closure-plan.md`):** Bind `opaque_scene_depth` (`@group(1) @binding(5)`) in `workerOwnedNativeSurfaceMaterial.js` & `nativeSurfaceMaterialWgsl.js` so refractive surfaces reject foreground occluders (`opaque_depth < in.position.z`) and refract only objects inside or behind them.
   - **Water "Gnocchi" Cavitation Floor & Dynamic Material-Volume LOD (`plan/todo/SS/dynamic-hierarchy-lod.md`):** Replace the artificial bulk Tait tensile floor (`-0.05 * stiffness` in `wgsl.js:11095` & `multiMaterialEos.js:82`) with physical cavitation + implicit divergence-free pressure (`sphImplicitPressureGpu.js`), and wire a GPU spare-lineage pool + live `1 -> 8` shear/interface carrier split and `8 -> 1` quiescent bulk coarsen so dense objects displace refined boundary-layer fluid and sink naturally.
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
