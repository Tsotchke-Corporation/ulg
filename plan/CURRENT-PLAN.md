# ULG Current Plan (Authoritative Routing Document — Unified 40-OOM Scale-Ladder Roadmap)

- **Effective:** 2026-11-24 AKST (Unified 40-OOM Foundation-First Scale-Ladder Roadmap — **ALL `8/8` GATES FORMALLY ICC-ACCEPTED [`G5`, `G7`, `Gate 0`, `Gate 1`, `Gate 2`, `Gate 3`, `Gate 4`, `Gate 5`] + Material Physics Lab v2 (`elements-lab.html`: 100K-Atom Lock-Free Linked-Cell GPU MD + Live GPU Gravity, 3D Maxwell–KS, 3D Polytope Atlas, Reusable Chemistry Engines, IUPAC Picker & Right Data Dock) Deployed to `main`/Pages → Returning to Continuum Architecture Queue!**)
- **Active branch:** `feat/continuum-architecture-refraction-lod` (branched off deployed `main` at `4798ce1c` — **STRICT PUBLICATION HOLD ACTIVE**)
- **Publication hold:** **ACTIVE ON FEATURE BRANCHES** (after authorized `feat/chemistry-polytope-ui-rethink` merge & Pages deploy on 2026-11-24; do not push/merge/deploy subsequent architecture work without fresh authorization from `big dog`).
- **Master Mission (Unchanged — `10⁻¹⁵ m → 10⁺²⁵ m`):** ULG is a **first-principles, browser-native WebGPU multiscale physics engine** spanning 40 orders of magnitude — from nuclear structure (`10⁻¹⁵ m`) through atoms, crystals, chemistry, macroscopic continuum matter (`10⁻⁶..10⁺² m`), planets, stars, galaxies, and supergalactic cosmic-web cosmology (`10⁺²⁵ m`) — governed by Star Spec v0.4, the **Schroeder Simulation (`SS`) Scale Atlas**, the **Tier 0–3 Closure Economy**, and the **PeerCompute / Eshkol / MoonLab Triad**.
- **Immediate Scope (Foundation-First Execution Order):** Rather than building upper scales on `reference-fallback` material seeds and CPU-bound closures, we execute strictly **bottom-up** so every higher scale inherits validated GPU primitives, first-principles closures, and convex Polytope Atlases from the rungs beneath it:
  - **Gate 0 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Architectural & GPU Numerical Foundation (`peercompute-core` `37 MB` `dist/`, `gpuMath` Vulkan proofs, Canonical ABIs, Zero-Churn Step Loop `S0_ATTRIBUTION=1` `0/step` physics churn, contact deduplication, `thermalPotential` `'cadence-deferred'`, production 63-limb/CPU-mirror retirement) — see [`plan/done/gate0-foundation-arch.md`](done/gate0-foundation-arch.md).
  - **Gate 1 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Complete First-Principles Periodic Table Material Engine (`Z = 1..118` + `(Z, A)` isotopes: Nuclear + Relativistic Atomic + EM/Magnetism/Optics/Conductivity + Bulk DFT + WebGPU MD) with **real live WebGPU visualizations** (`elements-lab.html`) — see [`plan/done/gate1-periodic-table.md`](done/gate1-periodic-table.md).
  - **Gate 2 (ACCEPTED 2026-11-23 — `3/3 PASS`):** First-Principles Chemical Reactions (100% WebGPU RHF + CI-NEB) → **Recursive Compound Feedback Loop** → **Per-Material & Per-Compound 4-Phase Convex Polytope Atlas** (`A x <= b` + persisted GPU Chebyshev Tier-1 tables) — see [`plan/done/gate2-reactions-polytope-atlas.md`](done/gate2-reactions-polytope-atlas.md).
  - **Gate 3 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Macroscopic Continuum Engine (`SS` + MLS-MPM + Exact `2^-149` Ledgers + Unified SS Solids + Section 3 Hard GPU Budgets met across all 5 presets incl. `water-realtime = 1.3065x RT` at `CPUQuota=50%`, `air3` 3-level `14.89 <= 16` indirect total & `0` createBuffer) consuming Gate 2 Polytope Atlas inline in WGSL + live GPU A3 radiative flux physics consumption — see [`plan/done/gate3-continuum-substrate-and-physics.md`](done/gate3-continuum-substrate-and-physics.md).
  - **Gate 4 (ACCEPTED 2026-11-23 — `3/3 PASS`):** Decoupled Interactive Studio Presentation (`72.96–113.25 Hz` mean presented, `62–100 Hz` min sustained 500ms, `25.3–33.5 ms` max gap, `visibleMotionCadenceVerified: true` & `resetVerified: true` across all 5 active presets) — see [`plan/done/gate4-studio-presentation.md`](done/gate4-studio-presentation.md).
  - **Gate 5 (ACCEPTED 2026-11-24 — `3/3 PASS`):** Planetary (`10⁺⁶ m`) → Stellar (`10⁺⁸–10⁺¹⁷ m`) → Galactic (`10⁺¹⁷–10⁺²² m`) → Supergalactic Cosmology (`10⁺²²–10⁺²⁵ m` 1-submit FLRW TreePM + live GPU `P(k)` + official PeerCompute `SpatialTileLeaseBroker` disjoint-slab 2-browser WebRTC) built directly on Gate 0's `fft3dWebGpu` + canonical parallel `SS` Scale Atlas multipole + Gate 1–2 nuclear/atomic/polytope closures — see [`plan/done/gate5-planetary-to-supergalactic.md`](done/gate5-planetary-to-supergalactic.md).
- **Formal ICC Campaign Status:** **ALL 8 of 8 gates formally accepted** — **G5** ([done/g5-reservation.md](done/g5-reservation.md)), **G7** ([done/g7-release-audit.md](done/g7-release-audit.md)), **Gate 0** ([done/gate0-foundation-arch.md](done/gate0-foundation-arch.md)), **Gate 1** ([done/gate1-periodic-table.md](done/gate1-periodic-table.md)), **Gate 2** ([done/gate2-reactions-polytope-atlas.md](done/gate2-reactions-polytope-atlas.md)), **Gate 3** ([done/gate3-continuum-substrate-and-physics.md](done/gate3-continuum-substrate-and-physics.md)), **Gate 4** ([done/gate4-studio-presentation.md](done/gate4-studio-presentation.md)), and **Gate 5** ([done/gate5-planetary-to-supergalactic.md](done/gate5-planetary-to-supergalactic.md)).

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

> **Honesty boundary:** **ALL 8 of 8 gates** have formally accepted
> `ulg.campaign.receipt.v1` bundles on disk (`/home/cos/.cache/icc/repos/ulg/`):
> **G5**, **G7**, **Gate 0**, **Gate 1**, **Gate 2**, **Gate 3**, **Gate 4**, and
> **Gate 5**. Verified baseline at `846ddaee`:
> **`6,215 pass / 0 fail`** full host suite (`198` opt-in skips, `6,413` total) +
> **`5/5`** Gate 5 native Vulkan & disjoint-slab 2-browser WebRTC suites PASS +
> all `10/10` locked-camera Gate 5 PNGs visually verified + `npm run build`
> PASS (`5.02 s`, `dist/` = **`37 MB`**, `0` AI/`ort-wasm` assets) + `KERNEL_CLEAN`.

| Gate | Scale Span | ICC Oracle Target | Status | Live Code Today (`a5c632cb`) | Remaining Work to Formally Accept Gate |
|---|---|---|---|---|---|
| **G5** | Cross-Scale | `ulg-g5-reservation` | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Bounded single-realm JS CAS `ReservationLedger` live + official `SpatialTileLeaseBroker` shipped in `../peercompute` `core.js`. | Wire `SpatialTileLeaseBroker` into Gate 5D `distributedSpatialPartitioner.js`. |
| **G7** | Cross-Scale | `ulg-g7-release-audit` | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Offline advisory NIST/PubChem audit tooling live + Gate 1 element/compound advisory scorecards in `periodicTableEngineWebGpu.js` & `foundation-polytope-atlas.json`. | Keep extending immutable advisory datasets (AME2020, Materials Project, PREM, Lane–Emden/MESA, `P(k)`) — always non-blocking advisory. |
| **Gate 0** | Infrastructure | `ulg-gate0-foundation-arch` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b46bf134` after 2-round adversarial independent review ([`plan/done/gate0-foundation-arch.md`](done/gate0-foundation-arch.md); Round 1 FAIL `2d851edd` preserved; Round 2 ACCEPT `1a8eddd4`): single `peercompute/core.js` import, `37M` `dist/` (`0` AI/`ort-wasm`), shared `peercomputeCompute.worker.js` + live built-`dist/` `sodium-water` smoke PASS, `gate0GpuMath` Vulkan PASS, canonical ABIs locked, `S0_ATTRIBUTION=1` `0/step` physics churn, iron-ice contact dedup, `thermalPotential` `'cadence-deferred'`, production 63-limb & CPU-mirror retirement. | Accepted (`scientificValidation: false` & offline G7 advisory preserved). Remaining shared-device MC churn & Section 3 continuum budgets tracked under Gate 3. |
| **Gate 1** | `10⁻¹⁵ → 10⁻⁹ m` | `ulg-gate1-periodic-table-engine` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b9e86811` after 3-round adversarial independent review (`plan/done/gate1-periodic-table.md`): full 5-domain WebGPU `Z = 1..118` + `(Z, A)` isotope engine (`0` SCF readbacks, `0` CPU interband fallbacks, 5 crystal classes `{ vdw-fcc: 16, bcc: 21, hcp: 50, diamond: 5, fcc: 26 }`, `50/50` exact 4-atom HCP volumes, metallic `fcc` `Pd`, `95` distinct element sRGBs, relativistic `Au`, `0/118` zero-MSD truncations) + real WebGPU 3D volumetric & zero-copy instanced MD renderer in `elements-lab.html` (`cameraAutoSpin: false`, `116,314` changed px across 10 inspected Wayland PNGs). | Accepted (`scientificValidation: false` & offline G7 advisory preserved). Optional post-acceptance deepening: 4-component Dirac–KS, `DFT+U`, and `Pu/Am/Bk` `5f` potential refinement. |
| **Gate 2** | `10⁻¹⁰ → 10⁻⁶ m` | `ulg-gate2-reactions-and-polytope-atlas` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `b9e86811` after 3-round adversarial independent review (`plan/done/gate2-reactions-polytope-atlas.md`): 100% WebGPU RHF + `climbingImageNEBWebGpu` (`H2O`/`D2O` `E_a = 3.91 eV`), Slater + Allred–Rochow crystals (`Al2O3 corundum-D51`, `NaCl cscl-B2`, `Fe2O3`, `Na2O`), `discoverAndDeriveReactionProductsWebGpu` (`Na + H2O → NaOH + H2`), `20/20` compounds covering `15/15` legacy `compounds.json` (`0` `reference-fallback`, `provenance.gpuStagesExecuted`), persisted 4-phase GPU Chebyshev fits (`valueTransform: "exp"`, fail-closed hydration & `hitFlag == 0`) verified over `142,457` adversarial interior probes (`< 0.6%` ambient gases, `< 3.40%` structured interior across all `138/138` materials) + live WGSL Tab 6 Atlas. | Accepted (`scientificValidation: false` preserved). Optional post-acceptance deepening: extended covalent `SiO2` prototype, multi-step reaction networks, and persistent OPFS/IndexedDB Atlas cache. |
| **Gate 3** | `10⁻⁶ → 10⁺² m` | `ulg-gate3-continuum-substrate-and-physics` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `a5c632cb` after 3-round adversarial independent review ([`plan/done/gate3-continuum-substrate-and-physics.md`](done/gate3-continuum-substrate-and-physics.md); Round 1 FAIL `d134a84f` & Round 2 FAIL `2bcec1b6` preserved; Round 3 ACCEPT `a4a11f08`): all 5 live `scripts/gpuprobe.sh` probes pass Section 3 hard budgets (`water-50` **`1.3065x RT`** at `CPUQuota=50%`, `0` boundaryFailures; `water-rt` **`3.6889x RT`**; `iron` `1.12/5.71/2.05`; `sodium` `1.50/8.52/3.25` + all 4 indirect law families exact; 3-level `air3` `0.66/13.67/14.89<=16` + `createBuf=0`), inline WGSL Tier-1 Polytope Atlas + real-gas `zMeasured=1.3429` + Tier-3 A6 escalation + live GPU A3 radiative flux physics consumer (`sodium` 74 / `air3` 117 steps), unified SS solids (private proxy hash retired to exact `body_bounds`), `24/24` Vulkan PASS, `6,215/6,215` host PASS, `KERNEL_CLEAN`. | Accepted (`scientificValidation: false` & offline G7 advisory preserved). Post-Gate-5 Studio refraction/cavitation/dynamic-LOD queued cleanly below. |
| **Gate 4** | `10⁻³ → 10⁺² m` | `ulg-gate4-studio-presentation` | **ACCEPTED** (`3/3 PASS`, 2026-11-23) | Accepted at `44bb6f13` after 2-round adversarial independent review (`plan/done/gate4-studio-presentation.md`; Round 1 FAIL `2d955c07` preserved; Round 2 ACCEPT `1b886022`): all 5 active Studio presets pass `>= 54 Hz` decoupled true-isosurface presentation (`water-cycle` `89.96 Hz / 25.3 ms`, `iron-ice-quench` `72.96 Hz / 33.5 ms`, `sodium-water` `76.82 Hz / 30.6 ms`, `cesium-fluorine` `74.29 Hz / 28.5 ms`, `water-realtime` `113.25 Hz / 25.7 ms / 1.84–2.09x RT`; UI rAF ~120 Hz reported separately), strictly finite motion horizon (distinct `f32` shader ages, zero Zeno loop), `5/5` Pause/Step/Reset across lane rebuilds (`resetStep: 4`), `3/3` native Vulkan optics PASS, `6,212/6,212` host tests PASS, `KERNEL_CLEAN`. | Accepted (`scientificValidation: false` preserved). |
| **Gate 5** | `10⁺⁶ → 10⁺²⁵ m` | `ulg-gate5-planetary-to-supergalactic` | **ACCEPTED** (`3/3 PASS`, 2026-11-24) | Accepted at `846ddaee` after independent adversarial review ([`plan/done/gate5-planetary-to-supergalactic.md`](done/gate5-planetary-to-supergalactic.md); pre-acceptance audit `cd3aaaf8` preserved; ACCEPT `66ba0501`): canonical parallel `@workgroup_size(64/256)` `SchroederScaleAtlas` multipole default gravity (zero private octrees, zero `@workgroup_size(1)`), inline WGSL `eval_polytope_atlas_bank_2d` planetary interiors (fail-closed out-of-domain), exact Gate 1 `β⁺/EC` Q-values + WebGPU nuclear/Lane–Emden + conservative `Q * dX` stellar heating, ping-pong compressible SPH ISM hydro + Gate 1 cooling + symmetric SMBH recoil (`momentumDrift < 1e-3`), 1-submit FLRW 3D-FFT TreePM + live GPU `P(k)` + full-Nyquist GPU Zel'dovich ICs, official PeerCompute `SpatialTileLeaseBroker` disjoint-slab 2-browser WebRTC (signaling closed, 32 B GPU multipoles, measurable `+X` pull, fail-closed eviction/reclaim), `cosmic-quantum.html` `supergalactic-cosmic` crash fixed, all `10/10` locked-camera PNGs visually verified (`210,265` pure WebGPU cosmic-web px outside HUD), `5/5` Vulkan/WebRTC PASS, `6,215/6,215` host PASS, `KERNEL_CLEAN`. | Accepted (`scientificValidation: false` & offline G7 advisory preserved). Optional operational check: physical 2-machine WAN/TURN deployment. |

---

## 5. Campaign Progress & Next Prioritized Queue (2026-11-23, Post-`b9e86811`)

### Completed & Formally Accepted (`f6623b39..HEAD` — **ALL `8/8` GATES ACCEPTED + MATERIAL PHYSICS LAB COMPLETE!**)
- [x] **Material Physics Demo Lab (`elements-lab.html`) & Canonical Quantum/Optical WebGPU Runtime Modules (2026-11-24):** Built reusable canonical runtime modules registered on `SimulationModuleRegistry` & `ClosureRegistry` (`orbitalPointCloudWebGpu.js`: `quantum-orbital-cloud@1` `50K–500K`-pt GPU Dirac–KS cloud + `quantum-tdks-photon@1` `180K`-pt TD-KS / Optical Bloch electron-cloud ↔ photon wavepacket with retarded Hertzian dipole radiation; `photonShellOpticsWebGpu.js`: `photon-shell-fdtd@1` `128×128` time-symmetric symplectic Yee–Taflove 2D Maxwell–ADE-FDTD optical cavity with 20 driven 3D Dirac–KS shells + `nuclear-tunneling-tdse@1` 1D symplectic Visscher quantum tunneling TDSE; universal solid-state Pauli-blocking Fermi-level shift in `electromagneticClosureWebGpu.js` yielding live Gold `[0.86, 0.81, 0.73]` rel ON vs Silver `[0.92, 0.92, 0.89]` rel OFF and live `H2O` Snell refraction `n_phase=1.200 / n_snell=1.204` at `θ_t=19.7°`). Full 6-tab lab with interactive CI-NEB `ξ` orbital scrubbing, multi-element Chemistry Combiner + one-click Compound Backfeed into ALL tabs (incl. 2D Maxwell refraction, composite nuclear volume, live MD + `T` slider, and interactive GPU Polytope Atlas cursor + `Lab 10 GPa / Planetary 1 TPa`). Verified: `4/4` native Vulkan suites PASS, `6,219 pass / 0 fail`, `37M dist/`, `0` AI/`ort-wasm`, `KERNEL_CLEAN`.
- [x] **Gate 5 Formal ICC Acceptance (`53917d84..846ddaee` — `7/8 → 8/8` Accepted!):** Remediated all 8 pre-acceptance blockers (`B1–B8`): canonical parallel `@workgroup_size(64/256)` `SchroederScaleAtlas` multipole default gravity (private octrees deleted), inline WGSL `eval_polytope_atlas_bank_2d` planetary interiors (fail-closed out-of-domain), exact Gate 1 `β⁺/EC` Q-values + WebGPU nuclear/Lane–Emden + conservative `Q * dX` stellar heating, ping-pong compressible SPH ISM hydro + Gate 1 cooling + symmetric SMBH recoil, 1-submit FLRW 3D-FFT TreePM + live GPU `P(k)` + full-Nyquist GPU Zel'dovich ICs + `GPUBufferUsage.VERTEX` on `particleBuf`, official PeerCompute `SpatialTileLeaseBroker` disjoint-slab 2-browser WebRTC, `cosmic-quantum.html` crash fixed, all `10/10` locked-camera PNGs visually verified, `5/5` Vulkan/WebRTC PASS, `6,215/6,215` host PASS, `37M dist/` (`0` AI/`ort-wasm`), `KERNEL_CLEAN`, and `ulg-gate5-planetary-to-supergalactic` (`3/3 PASS`, `status: complete`) on `FRESH` ICC index. See [`plan/done/gate5-planetary-to-supergalactic.md`](done/gate5-planetary-to-supergalactic.md).
- [x] **Gate 3 Formal ICC Acceptance (`09eec74b..a5c632cb` — `6/8 → 7/8` Accepted):** Inline WGSL Tier-1 Polytope Atlas (`sphMechanicsRefreshGpuKernel.js`, `sphSpatialGasLedgerEosGpu.js` `zMeasured=1.3429`), closed-loop Tier-3 A6 escalation (`foundationPolytopeAtlasGpuBridge.js`), live GPU Tier-2 A3 radiative flux physics consumer (`sphThermalGpuKernel.js` `@binding(15)` batched inside open physics burst, `sodium` 74 / `air3` 117 steps), unified canonical SS solids (private solid proxy hash retired to exact `body_bounds`, mechanics-only SS wiring fixed, zero silent fine-level halo drops), safe synchronous decoupled burst-bypass (`0` boundaryFailures), all 5 live probes passing hard Section 3 GPU budgets (incl. `water-realtime = 1.3065x RT` at canonical `CPUQuota=50%` and 3-level `air3` `submits=0.66, passes=13.67, indirect=14.89<=16, createBuf=0`), `24/24` Vulkan PASS, `6,215/6,215` host PASS, `KERNEL_CLEAN`, and `ulg-gate3-continuum-substrate-and-physics` (`3/3 PASS`, `status: complete`) on fresh ICC index. See [`plan/done/gate3-continuum-substrate-and-physics.md`](done/gate3-continuum-substrate-and-physics.md).
- [x] **Gate 0 Formal ICC Acceptance (`b1be203b..b46bf134` — `5/8 → 6/8` Accepted):** Consolidated official `peercompute/core.js` single-import boundary, fixed production `dist/` worker bootstrap (`peercomputeCompute.worker.js`, `ulgMechanicsResidentStage.worker.js`, `sphMlsMpmGpuStep.js`, `dist/ = 37M < 45 MB`, live `sodium-water` smoke `24` steps / `0` errors), remediated all 3 Round 1 independent audit blockers (`B1–B3`: preserved `blocksA`/`blocksB` parallel product-history append, stripped `finalizeSphReactionStrictGateCpu`, added `getCachedPipelineBindGroupLayout` + cached `sphImplicitPressureGpu` / `schroederHierarchyGpu` / `sphRenderGpuKernel` / `sphMlsMpmGpuStep` bindGroups proving `S0_ATTRIBUTION=1` steady-state physics `createBuffer = 0.003/step` water & `0/step` iron and physics `bindGroups = 0.059/step` water & `0.000/step` iron), deduplicated iron-ice unilateral contact, fixed `thermalPotential` `'cadence-deferred'` (`18,144` hits), and passed `ulg-gate0-foundation-arch` (`3/3 PASS`, `status: complete`) on fresh ICC index. See [`plan/done/gate0-foundation-arch.md`](done/gate0-foundation-arch.md).
- [x] **Gate 4 Formal ICC Acceptance (`2d955c07..44bb6f13` — `4/8 → 5/8` Accepted):** Eliminated double-vsync & shared-queue contention, remediated both Round 1 independent audit blockers (strictly finite motion horizon with distinct `f32` shader ages and zero Zeno loop; device-cached buffer ownership across `#sph-reset` lane rebuilds), verified `5/5` presets at `72.96–113.25 Hz` mean / `62–100 Hz` min sustained 500ms / `25.3–33.5 ms` max gap + `5/5` Pause/Step/Reset + `3/3` native Vulkan optics + `6,212/6,212` host tests + `KERNEL_CLEAN`, and passed `ulg-gate4-studio-presentation` (`3/3 PASS`, `status: complete`) on fresh ICC index. See [`plan/done/gate4-studio-presentation.md`](done/gate4-studio-presentation.md).
- [x] **Gate 1 & Gate 2 Formal ICC Acceptance (`52d471fd..b9e86811` — `2/8 → 4/8` Accepted):** Remediated all 5 Round-1 & 3 Round-2 independent audit findings and passed ICC completion oracles `ulg-gate1-periodic-table-engine` (`3/3 PASS`) and `ulg-gate2-reactions-and-polytope-atlas` (`3/3 PASS`). See [`plan/done/gate1-periodic-table.md`](done/gate1-periodic-table.md) & [`plan/done/gate2-reactions-polytope-atlas.md`](done/gate2-reactions-polytope-atlas.md).
- [x] **Campaign Priorities 1–5 (`f6623b39..c09644f8`):** End-to-end `(Z, A)` isotopes & isotopologues (`f6623b39`), Gate 0D/3 Zero-Churn Slice 2 & `water-realtime` K-step pacing (`ca9824d8`), Gate 3 GPU Tier-1 Polytope Atlas bridge & `15/15` legacy compound coverage (`98214a11`), bulk viscosity alpha audit, and Hybrid FLRW TreePM + canonical Scale-Atlas astrophysics gravity + 2-browser WebRTC TreePM (`c09644f8`).

### Next Prioritized Campaign Queue (Post-`846ddaee`, `8/8` All Scale-Ladder Gates Accepted!)
1. **Next Item 1 (ACTIVE — Post-Deploy Continuum Architecture & Material-Volume Fidelity Queue, Owner-Prioritized):**
   - [x] **Foreground Refraction Depth-Rejection (`plan/todo/surface-contact-transport-phase-closure-plan.md`, COMPLETE 2026-11-24):** Bound `opaque_scene_depth` (`@group(1) @binding(5)`) across both worker-owned (`workerOwnedNativeSurfaceMaterial.js`, `workerOwnedIsosurfacePresenter.js`, `ulgOffscreenRender.worker.js`) and page-native (`sphPhaseScene.js`) surface refraction paths with 2×2 bilinear depth filtering (`nativeRefractionTransportWgsl.js`, `nativeSurfaceMaterialWgsl.js`); verified on Vulkan (`57/57` science probe, `tests/nativeRefractionForegroundRejection.native.test.mjs` bit-exact `0.000` foreground bleed + submerged refraction + translation invariance, live `iron-ice-quench` `gpuprobe.sh` `0` errors).
   - [x] **Water "Gnocchi" Cavitation Floor & Dynamic Material-Volume LOD (`plan/todo/SS/dynamic-hierarchy-lod.md`, COMPLETE 2026-11-24):** Retired artificial `-0.05 * stiffness` bulk Tait tensile cohesion across GPU P2G (`wgsl.js`), GPU implicit pressure (`sphImplicitPressureGpu.js`: `ratio < 0.9999`), and host EOS (`multiMaterialEos.js`, `sphGridGpuKernel.js`); generalized canonical GPU split-spare pool + 9-limb `2^-149` mass & `Σ(U − S)` energy ledger materializer (`schroederPhaseSlotMaterializationGpu.js`, `schroederPhaseSlotLedgerGpu.js`, `schroederHierarchyGpu.js`, `wgsl.js`) to support both liquid (`lane 1`) and gas (`lane 2`) `1 -> 8` interface splits and `8 -> 1` quiescent coarsening driven by canonical SS `mechanicsFieldView` (verified: `443/443` host + `4/4` Vulkan suites + live `water-realtime` `0.07` submits/step & `iron-ice-quench` `4.97 steps/s` `gpuprobe.sh`, `KERNEL_CLEAN`).
   - [x] **Remaining SS Spatial & Law Adapter Architecture Debt (`plan/ss-law-architecture-assessment.md`, `plan/todo/SS/schroeder-tree-and-algorithm-plan.md`, COMPLETE 2026-11-24):** Delivered all 5 `ulg-gpu-abi` declarative guardrails: generated WGSL lane accessors from `*_ROW_LAYOUT` (`laneAccessorGenerator.js`), symbol-branded paired `(V0, J)` `RepresentedVolume` type + generated WGSL (`representedVolume.js`), explicit `GpuResourceLeaseScope` (`gpuResourceLease.js`, wired into `schroederPhaseSlotRefinementGpu.js`), Law-Descriptor-derived WebGPU bind-group layouts + `implicit-pressure-solve` / `phase-slot-refinement` canonical adapters (`lawAdapterContract.js`), and named WGSL fragment composition (`wgslComposer.js`, migrated `sphMlsMpmGpuStep.js` active-grid/compact variants + manifest registry + ambiguity-hardened anchors; confirmed thermal/reaction dormancy already run in `canonicalSsDirectoryMode: true`). Verified on host (`279/279` + full suite) and real Vulkan (`ssLawArchitectureGuardrails.native.test.mjs` & `schroederPhaseSlotLedger.native.test.mjs`, `KERNEL_CLEAN`).
2. **Next Item 2 — Post-Acceptance Gate 1–2 Fidelity Deepening & OPFS Warm Cache (Optional):**
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
