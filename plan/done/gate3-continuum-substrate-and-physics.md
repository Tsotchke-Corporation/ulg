# Gate 3 Formal Acceptance Record — Macroscopic Continuum Engine & Unified SS (`ulg-gate3-continuum-substrate-and-physics`)

- **Accepted Date:** 2026-11-23 AKST
- **ICC Completion Oracle:** `ulg-gate3-continuum-substrate-and-physics` — **`3/3 PASS`, `status: complete`** on `FRESH` ICC index (`codebase_index.json` HEAD `a5c632cb6072cf1668f5e34a3498bb9520220f3d`)
- **Contract:** `ulg.gate3-continuum-substrate-and-physics.v1` (`.icc/completion-oracles.yaml:89-105`)
- **Accepted Candidate Git HEAD:** `a5c632cb6072cf1668f5e34a3498bb9520220f3d` (`dirty: false`, branch `feat/star-spec-generalization-audit`, publication hold active)
- **Source Manifest:** `81` files (`reviewWorktreeFingerprint`: `4b3f28dc6742ce90b41044f859dc78f94a742ef0d65911919f6136d1f4a6f613`)
- **Evidence Bundle:** `/home/cos/.cache/icc/repos/ulg/gate3-acceptance-20261123/`
- **Independent Review Lineage:**
  - Round 1 FAIL (`09eec74b`, reviewer `d134a84f-054a-403f-9a0f-d4ce449f87f2`) — preserved verbatim at `independent-review-round1-fail.md`
  - Round 2 FAIL (`2db51ee2`, reviewer `2bcec1b6-fb27-44ad-8fd6-5e6a7523f397`) — preserved verbatim at `independent-review-round2-fail.md`
  - **Round 3 ACCEPT (`a5c632cb`, reviewer `a4a11f08-e3b6-4af3-8a44-f7bc10dadfe5`)** — preserved verbatim at `independent-review.md` (`3/3 PASS`)
- **Governance:** `scientificValidation: false`, G7 offline advisory only, zero AI attribution, zero Star Spec preset/material physics hacks, zero hot-loop CPU readbacks.

---

## Verified Acceptance Evidence (`a5c632cb`, `dirty: false`)

| Check | Result | Artifact |
|---|---|---|
| `npm run build && du -sh dist/` | **PASS** — `built in 4.23s`, `dist/` = **`37M`** (`< 45 MB`, `0` AI/`ort-wasm` assets) | `npm-build-r3.log` |
| `npm test` | **PASS** — **`6,215 pass / 0 fail / 0 cancelled`** (`198` opt-in skips, `6,413` total) | `npm-test-r3.log` |
| Gate 3 Core Native Vulkan (`13` files) | **PASS** — **`18/18 PASS, 0 fail, 0 skipped`** (`371.0 s`); logs verbatim `[priority3-gas-polytope] pressurePa=136124.61 idealPressurePa=101362.80 zMeasured=1.3429 hits=1 misses=0` | `gate3-r3-native-vulkan.log` |
| Gate 3 Exact Ledger Air Native (`3` files) | **PASS** — **`3/3 PASS, 0 fail, 0 skipped`** (`36.4 s`) | `gate3-r3-exact-ledger-air-native.log` |
| Gate 3 Air SS Native (`3` files) | **PASS** — **`3/3 PASS, 0 fail, 0 skipped`** (`46.4 s`) | `gate3-r3-air-ss-native.log` |
| `journalctl -k` | **PASS** — **`KERNEL_CLEAN`** (`0` NVIDIA Xid/NVRM/OOM faults) | `kernel-check-r3.log` |

### Official `scripts/gpuprobe.sh` Matrix (`S0_RESIDENT_PERF=1 S0_ATTRIBUTION=1`, `0` page/GPU/Xid errors, `0` split additivity mismatches across all 16 GPU fields)

| Probe (`CPUQuota`) | Steps (`steps/s` / `RT`) | `physicsPerStep`: `submits` (`<=2`) / `passes` (`<=25`) / `indirect` (`<=16`) / `workDone` / `mapAsync` / `createBuf` / `pipes` / `bindGrp` | `boundaryFailures` | Key Live Physics Proof |
|---|---|---|---|---|
| **`g3-r3-water-50`** (`50%`) | `6,400` (`163.32` / **`1.3065x RT`**) | `0.03` / `9.24` / `0` / `0.02` / `0` / `0` / `0` / `0` | `0` | Canonical `CPUQuota=50%` exceeds `1.0x RT`; `implicitPressure` consumes Eshkol Chebyshev A3 stiffness (`9,856` steps) |
| **`g3-r3-water-rt`** (`400%`) | `16,960` (`461.11` / **`3.6889x RT`**) | `0.03` / `9.10` / `0` / `0.02` / `0` / `0` / `0` / `0` | `0` | `implicitPressure` Eshkol Chebyshev A3 stiffness (`23,616` steps) |
| **`g3-r3-iron`** (`50%`) | `216` (`5.51` / `0.0028x RT`) | `1.12` / `5.71` / `2.05` / `0.62` / `0.16` / `0.01` / `0` / `1.02` | `0` | Canonical SS solid-fluid directory + SOL-5 + SOL-6 active; Polytope `223 hits / 7 melted water applied / 216 molten Fe phaseMismatches / 0 misses`; `thermalPotential` `50,358` hits |
| **`g3-r3-sodium`** (`50%`) | `60` (`1.43` / `0.0014x RT`) | `1.50` / `8.52` / `3.25` / `0.60` / `0.72` / `0.22` / `0` / `1.32` | `0` | Polytope **`152/152` applied**; live GPU A3 radiative flux physics consumer (`74` steps, batched in burst); **all 4 indirect law families exact** (`thermal`, `reaction`, `phase` `zeroWork=4`, `radiation`) |
| **`g3-r3-air3`** (`50%`, 3-level air) | `88` (`2.14` / `0.0003x RT`) | `0.66` / `13.67` / **`14.89`** (`15.93` total) / `0.72` / `0.40` / **`0`** / `0` / `22.76` | `0` | 3 active Schroeder levels (`41³→23³→14³`); `phaseVolumeMigration=true` (`2,272` rows); `parcelStage.ran=120`; `parcelOptics=29/29`; Polytope `180/208` applied; live GPU A3 radiative flux physics consumer (`117` steps) |

---

## Key Architectural Milestones Delivered

1. **Inline WGSL Tier-1 Polytope Atlas + Tier-2 A3 + Tier-3 A6 Closed Loop:** `sphMechanicsRefreshGpuKernel.js` evaluates packed multi-material convex polytope atlases directly on GPU with physical Tait pressure and separate `applied`/`phaseMismatches` receipts; `sphSpatialGasLedgerEosGpu.js` modulates gas cell pressure by real-gas `z_poly`; `foundationPolytopeAtlasGpuBridge.js` escalates misses through Eshkol AD + MoonLab 5-slot Triad adoption and rebuilds the resident GPU bank (`generation >= 2`); `sphThermalGpuKernel.js` consumes G5-CAS-adopted `a3ThermalRegional` radiative flux (`@binding(15)`) batched inside the open physics burst while preserving exact `2^-149` `Σ(U - S)`.
2. **Unified Canonical SS Solids (`SOL-0..SOL-6`):** Mechanics-only solid lane passes unwrapped `schroederSpatialEpochGeneration` (`hasCanonicalSsDir === true`), `schroederSolidRigidGpu.js` retired its private proxy spatial hash in favor of exact per-body bounding spheres (`body_bounds`), and `schroederSolidFluidContactGpu.js` / `schroederSolidFluidThermalGpu.js` eliminated silent fine-level halo drops with explicit overflow ledger flags.
3. **Hard Section 3 GPU Budgets & Safe Synchronous Burst-Bypass:** Consistent `__ulgDecoupledPresentationBypassBurst` handling across `writeBuffer`, `writeTexture`, `submit`, and `onSubmittedWorkDone` eliminates stale-uniform races and mid-step `'fence-request'` physics burst splits; WGSL-bounds-guarded host-ceiling dispatch + MRU bind-group caches + exact-ledger/cross-level bind-group caching + `residentStepsPerSchedule: '64'` on `water-realtime` bring all 5 presets inside every hard Section 3 budget.
4. **Honest Disclosures Preserved:** `scientificValidation: false`, G7 offline advisory only, schedule-boundary `workDone`/`mapAsync` (`0` per substep), molten `Fe` Gate 1 `Tm = 4,124.3 K` phase-mismatch safety fallback, and post-Gate-5 deferred Studio fidelity items (foreground refraction depth-rejection, cavitation tensile-floor fix, dynamic material-volume LOD).
