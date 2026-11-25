# Gate 6 Formal Acceptance Record — ULG Architecture 1.0 Completion Campaign (`ulg-gate6-architecture-1-0`)

- **Accepted Date:** 2026-11-25 AKST
- **ICC Completion Oracle:** `ulg-gate6-architecture-1-0` — **`3/3 PASS`, `status: complete`** (`0` dropped, `0` truncated, `0` config errors, `oracle_config_source: "head"`) on **`FRESH`** ICC index (`codebase_index.json` HEAD `e4631ccb78646ff698bd7c1f6ceccd4422726eb8`)
- **Contract:** `ulg.gate6-architecture-1-0.v1` (`.icc/completion-oracles.yaml:143-159`)
- **Accepted Candidate Git HEAD:**
  - ULG (`/home/cos/projects/ulg`, branch `feat/gate6-architecture-1-0`, **PUBLICATION HOLD ACTIVE**): `e4631ccb78646ff698bd7c1f6ceccd4422726eb8` (`dirty: false`)
  - Sibling Eshkol (`/home/cos/projects/eshkol`, branch `ulg`): `fc771717d0e5e531ccd5f90e8ac88fdad6b3a431` (`dirty: false`)
- **Source Manifest:** `97` ULG files + `3` Eshkol files (`100/100` SHA-256 verified; `reviewWorktreeFingerprint`: `1e32f5aa074f3fe929ededc83e750cc88bf79e4d0ffe7d77dfb1f0fdf1d2cc4f`)
- **Evidence Bundle:** `/home/cos/.cache/icc/repos/ulg/gate6-acceptance-20261125/` (`gate6-reviewed-receipts.jsonl` SHA-256 `cd3d79cd6387cf69f9682427f4445abe8a9d363b35b190d18ce40489deb0f24f`)
- **Independent Adversarial Read-Only Review Lineage:**
  - Round 1 FAIL (`d0513253`, reviewer `f84d775e-5477-45a5-a030-67f55a44d293` — identified `B1–B4` + 6 polish items) — preserved verbatim at `independent-review-round1-fail.md`
  - Round 2 FAIL (`0f621fba`, reviewer `b44f0897-9d25-4ea5-80f0-ba02ea972768` — passed `B2`, `B3`, `B4`, all 6 polish items, and Criterion 3; identified remaining `R2-B1` coarse velocity publish CFL witness on `cesium-fluorine`) — preserved verbatim at `independent-review-round2-fail.md`
  - **Round 3 ACCEPT (`e4631ccb`, reviewer `5e8164b8-74a4-4c50-82ce-43e4bc7fb23a`)** — preserved verbatim at `independent-review.md` (**`3/3 PASS`**, zero blocking defects)
- **Governance:** `scientificValidation: false`, G7 offline advisory only, zero AI attribution, zero Star Spec preset/material physics hacks, `main` untouched (`8fd0558d`), `docs/` untouched, zero Gate 6 edits to `../peercompute`.

---

## Verified Acceptance Evidence (`e4631ccb`, `dirty: false`)

| Check | Result | Artifact |
|---|---|---|
| `npm run build && du -sh dist/` | **PASS** — `built in 5.09s`, `dist/` = **`38M`** (`< 45 MB`, `AI_ASSETS = 0`) | `npm-build.log` |
| Eshkol C99 WGSL & Law-IR Emitter | **PASS** — `gcc -std=c99 -Wall -Wextra -Werror` (`ESHKOL_SYM_SLAB_CAP = 256` multi-slab arena) | `eshkol-c99.log` |
| `npm test -- --test-concurrency=4` | **PASS** — **`6,255 pass / 0 fail / 0 cancelled`** (`211` opt-in skips, `6,466` total) | `npm-test.log` |
| Native Vulkan Suite (`8` files, `--test-concurrency=1`, `4G / 50% CPU`) | **PASS** — **`10/10 PASS, 0 fail, 0 skipped`** (`129.7 s`); all 4 `[gate6-phase-*]` markers verbatim (`5.40 ms/step` 100K continuum, `0.125 submits/step`, `8.125 passes/step`, `massRelErr=0`, `summaryStatus="compact-summary-ready"`; JS + C99 Law-IR parity; FLIP slip `+0` submits; live unseen `KBr`/`GeO2` → `opfs` → PeerCompute CAS → reload bit-exact & corrupt-cache recovery) | `gate6-native-vulkan.log` |
| Monolith Export Parity (`7` monoliths → `14` submodules) | **PASS** — **`1,132 / 1,132`** bit-exact (`0` missing, `0` added) | `monolith-export-parity.json` |
| Static Hygiene & Parallel Kernel Ratchet | **PASS** — `557` files (`505` runtime+ABI), `0` raw NUL bytes, `0` private 4,096 hashes, `0` `replaceRequiredWgsl(`, `233 <= 233` `@workgroup_size(1)`, `11,264 B <= 16,384 B` WG storage | `static-hygiene-audit.json` |
| `journalctl -k` | **PASS** — **`KERNEL_CLEAN`** (`0` NVIDIA Xid/NVRM/OOM faults) | `kernel-check.log` |

### Official 5/5 Live Studio `scripts/gpuprobe.sh` Matrix (`e4631ccb`, `S0_RESIDENT_PERF=1 S0_ATTRIBUTION=1` on ALL 5, `CPUQuota=50%`, `0` errors, `0` Xid, all 5 PNGs visually + pixel verified)

| Probe (`preset`) | Window Steps (`steps/s` / `RT`) | `physicsPerStep`: `submits` / `passes` / `indirect` / `createBuf` / `bindGrp` / `mapAsync` | Presentation & Terminal Execution |
|---|---|---|---|
| **`gate6-r3-water-rt`** (`water-realtime`) | `7,040` (`151.80` / **`1.2144x RT`**) | `0.03` / `9.15` / `0` / **`0.00`** / **`0.00`** / `0` | `displayOwnerContentReady: true`, `renderRows: rendered`, `blocked: false`, `play: "Pause"`, `laneSteps: 10,816` (`schedule:169`) |
| **`gate6-r3-water-cycle`** (`water-cycle`) | `192` (`4.34` / `0.0022x RT`) | `1.10` / `5.64` / `2.06` / **`0.01`** / `2.06` / `0.14` | `displayOwnerContentReady: true`, `renderRows: rendered`, `blocked: false`, `play: "Pause"`, `a3=225`, `laneSteps: 228` (`schedule:57`) |
| **`gate6-r3-iron`** (`iron-ice-quench`) | `92` (`1.94` / `0.0010x RT`) | `1.16` / `6.85` / `2.17` / **`0.01`** / `2.17` / `0.14` | `displayOwnerContentReady: true`, `renderRows: rendered`, `blocked: false`, `play: "Pause"`, `canonicalSsFluidDirectoryActive: true`, `laneSteps: 136` (`schedule:34`) |
| **`gate6-r3-sodium`** (`sodium-water`) | `60` (`1.16` / `0.0012x RT`) | `1.55` / `8.73` / `3.37` / **`0.18`** / `1.73` / `0.75` | `displayOwnerContentReady: true`, `renderRows: rendered`, `blocked: false`, `play: "Pause"`, `a3=74`, `laneSteps: 76` (`schedule:19`) |
| **`gate6-r3-cesium`** (`cesium-fluorine`, 2-level reflux) | `52` (`0.90` / `0.00019x RT`) | `90.67` / `774.33` / `232.06` / `169.33` / `346.67` / `3.69` | `displayOwnerContentReady: true`, `renderRows: rendered`, `blocked: false`, `play: "Pause"`, `twoLevelRefluxRejectionCount: 0`, `laneSteps: 64` (`schedule:16`, `68 steps / t=0.014s` in PNG, active emerald-green `Pause`) |

---

## Key Architecture 1.0 Deliverables (Phases A–E)

1. **Phase A — Declarative Law-IR → WGSL Compiler (JS + Zero-LLVM C99 Eshkol Emitter) & Law-DAG Epoch Scheduler:** `ulg-gpu-abi/src/lawIrWgslCompiler.js`, `src/runtime/sph/lawDagEpochScheduler.js`, and sibling `../eshkol` (`inc/eshkol/backend/wgsl_emitter.h`, `lib/backend/vm_wgsl_emitter.c`, `ESHKOL_SYM_SLAB_CAP = 256` slab arena) compile symbolic physical laws + exact automatic derivatives into identical fail-closed WGSL verified on Vulkan alongside hoisted `cell-local` SS views and drained `GpuResourceLeaseScope`.
2. **Phase B — Parallel GPU Kernel Overhaul & 100K Continuum Scale Proof:** Parallelized 10 hot-path `@workgroup_size(1)` prefix-scan/reduction kernels into workgroup-parallel `@workgroup_size(32/64)` passes within `11,264 B <= 16,384 B` baseline workgroup storage, locked a permanent `<= 233` `@workgroup_size(1)` ratchet (`tests/gate6ParallelKernelAudit.test.mjs`), and proved `100,000` live continuum H₂O carriers stepping at `5.40 ms/step` (`0.125 submits/step`, `8.125 passes/step`, `massRelErr = 0`) on Vulkan.
3. **Phase C — Zero-Private-Grid Continuum, Live FLIP Solid-Liquid Slip & Unified Defaults:** Retired the final private 4,096-bucket solid-fluid hashes (`0` remaining across all 505 runtime+ABI files), wired exact P2G-adjoint momentum-conserving FLIP unilateral solid-liquid slip (`src/runtime/sph/sphSolidLiquidVelocitySeparationGpu.js`) live into `sphMlsMpmGpuStep.js` (`+0` extra submits on shared open encoder), fixed `authorityValidationBuffer` pool return in `sphMechanicsRefreshGpuKernel.js`, fixed `validate_coarse_velocity_publish` physical coarse CFL reject trace publication + pre-cancellation conditioning in `schroederSpatialParentFieldMechanicsWorkspaceWgsl.js`, and proved all `5/5` Studio presets running unblocked with unified defaults (`exactEnergyLedger=1`, `dynamicHierarchyLod=1`).
4. **Phase D — Mechanical Monolith Decomposition & `plan/todo/` Archive Hygiene:** Mechanically decomposed all 7 giant monoliths into 14 focused submodules with `1,132 / 1,132` bit-exact ESM export parity (`38M` zero-AI `dist/`), eliminated raw NUL bytes (`0`), and archived 26 completed/superseded plans (`25` to `plan/done/`, `1` to `plan/moot/`).
5. **Phase E — Live Unseen-Material OPFS + PeerCompute CAS Hot-Swap Loop:** Proved end-to-end on native Vulkan that previously unseen compounds (`KBr` `cscl-B2`, `GeO2` `cristobalite-C9`) derive on GPU → persist in real browser `opfs` → hot-swap into the resident continuum GPU bank under PeerCompute `ReservationLedger` CAS (`gen 1 -> 2 -> 3`) → hit bit-exact across page reloads (`1331.361083984375`, `5666.82568359375`) and recover fail-closed on corrupt-cache injection (`epoch 0 -> 1`).
6. **Honest Standing Scope & Post-1.0 Extensions Preserved:** `scientificValidation: false`, offline advisory-only G7, two-level reflux submit/buffer pooling on `cesium-fluorine`, solid-liquid slip extension to K-step sequences and mid-run GPU phase-change re-detection, full imperative step-loop adoption of `createCanonicalMlsMpmLawDagEpochScheduler`, physical 2-machine WAN/NAT PeerCompute deployment, and default-ON multi-level room air remain tracked cleanly in `plan/todo/README.md`.
