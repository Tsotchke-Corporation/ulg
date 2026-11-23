# ULG Current Plan (Authoritative Routing Document)

- **Effective:** 2026-11-22 AKST
- **Active branch:** `feat/star-spec-generalization-audit` (Priorities 0–3 Slice 1 landed through `abd76e44`; `main` & `origin/main` at `f1cf07c7`)
- **Publication hold:** **ACTIVE** — local commits on feature branch only; no `git push`, no merge to `main`, and no `npm run build:pages` / `docs/` edits without explicit authorization from **big dog**.
- **Formal campaign oracle status:** **2 of 13 formally accepted** — **G5** ([done/g5-reservation.md](done/g5-reservation.md)) and **G7** ([done/g7-release-audit.md](done/g7-release-audit.md)). All other 11 campaign milestones (G1–G4, G6, A1–A6) have major P0–P3 remediation landed and verified (`6,194 pass / 0 fail` host suite + 13 native Vulkan & real-browser WebRTC proofs), **verified remaining architectural/budget gaps documented below**, and **zero newly stamped PASS `ulg.campaign.receipt.v1` bundles on disk** (honesty rule: never mark unaccepted oracles `completed`).

This file is the **single active source of truth** for execution order, honest
campaign status, performance budgets, and next-work prioritization. Where any
older doc, audit, or archive conflicts with this document, **this document
governs**.

---

## 1. Non-Negotiable Core Rules

1. **Star Spec physics-first:** Macroscopic behavior emerges from activated laws
   and validity-checked closures. Zero per-preset/material physics branches,
   zero scripted animations or CSS visual fakes, zero `(0,0,0)` origin anchors.
   Never remove or demote a physical law.
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
   production-bundled CPU test mirrors) once the canonical GPU replacement
   passes its invariants.
6. **Hardware, WM, & visual hygiene:** Headless Vulkan Chrome by default; ask
   **big dog** before launching visible desktop Chrome on Wayland (never
   `terminal-browser` or terminal splits; close only owned browser/server
   processes). One GPU workload at a time (`--test-concurrency=1`, `gpuprobe.sh`,
   `MemoryMax=4G`, `<=80%` GPU target, inspect `journalctl -k` for Xid/OOM).
7. **G7 stays advisory:** Scientific database comparisons remain offline,
   operator-side, and advisory — never a blocking runtime admission gate.
8. **Publication hold & house rule:** No push, merge to `main`, or Pages build
   without authorization. Address the user as **big dog** in every response.

---

## 2. Standing Architectural Contracts (Preserved Across Slices)

- **Cache Layering:** Hot (GPU/worker buffers) → Warm (StateManager refs/deltas
  + G5 CAS reservations) → Cold (content-addressed JSON/cache bank). Cache keys
  bind inputs, tool versions, validity domain, ABI, schema, and validation
  flags.
- **Copy-Avoidance & Zero-Copy Residency:** Hot GPU state stays on-device;
  publish compact deltas / retained buffer refs / fixed-size reduction records
  only. Clamp GPU allocations to `device.limits.maxStorageBufferBindingSize`.
- **Scale & Separation Rule:** Keep the 5 hierarchy authorities strictly
  separated (physical representation, law query/activation, contact proxy,
  dynamic LOD, render LOD). Zero new private spatial grids or 4,096-bucket
  hashes beside the canonical SS spatial epoch.
- **Rollback & Benchmark Constants:** Check spatial-authority rollbacks with
  `&observeSpatialAuthority=1`; Iron Ice benchmark `dt = 0.5 ms`; default
  G1 target is latest committed physics state presented at `>= 54 Hz` across all
  shipped presets with verified visible motion cadence (not raw idle `UI rAF`).
- **Bank-Anchored & Mixture Decisions (2026-11-19):** General bank-anchored
  product closures carry explicit `imported` provenance; `environmentAirParcels`
  defaults to `'mixture'` (currently active whenever `environmentMode='air'`).

---

## 3. Hard Per-Step Performance & Dispatch Budget Gate

Every runtime slice touching the step loop, SS chain, contact, solids, or
closures must report and pass these targets via `scripts/gpuprobe.sh` (one GPU
job at a time, `CPUQuota=50%`, `S0_RESIDENT_PERF=1`):

| Metric | Old Baseline (Nov 3 Audit) | Canonical Target | Hard Regression Rule |
|---|---:|---:|---|
| `queue.submit` per substep | 30.5 | `<= 2` (and `K` steps/submit) | No slice may increase physics submits/step |
| Indirect dispatches per substep | 52 (216/pair in Nov 19 cross-transport) | `<= 16` total across active levels | **Hard fail** if any pass loops `> 16` indirect/level |
| Host `onSubmittedWorkDone` / `mapAsync` waits per substep | 9.1 | `0` per substep (schedule-boundary only) | Zero per-step host waits |
| Compute passes per substep | 106 | `<= 25` active passes | Dormant laws must add `0` active passes |
| Bulk quiescent substrate (A1 Tier-0 floor) | ~159 ms/step | `<= 1 ms/step` bulk, `>= 1.0x` real-time on `water-realtime` | Must hold after retiring redundant routes |

---

## 4. Code-Verified Campaign Scorecard (Post-P0..P3, 2026-11-22)

> **Honesty boundary:** Only **G5** and **G7** have accepted
> `ulg.campaign.receipt.v1` bundles on disk (`/home/cos/.cache/icc/repos/ulg/`).
> Fresh Section 3 `scripts/gpuprobe.sh` runs (`CPUQuota=50%`, `S0_RESIDENT_PERF=1`, `errors: []`, `gpuErrors: []`, `xid: []`):
> - `p03-water-realtime`: `computePasses/step 17.29 <= 25`, `dispatchIndirect/step 0.83 <= 16`, `mapAsync/step 0`, `pipelines 0`, **but** `submits/step 2.99`, `workDone/step 1.89`, `createBuffer/step 14.35`, `bindGroups/step 17.48`, `simPerWall 0.04x` (under 50% CPU quota).
> - `p03-iron-ice`: `dispatchIndirect/step 9.47 <= 16`, `pipelines 0`, `dispatch/step 402.58` (-11.8/step vs prior `414.38`), `submits/step 3.68` (-0.92/step vs prior `4.60`), **but** `computePasses/step 32.00 > 25`, `encoders/step 36.59`, `workDone/step 3.26`, `mapAsync/step 0.35`, `createBuffer/step 16.03`, `bindGroups/step 40.51`, `simPerWall 0.0015x`, `thermalPotential: deferred-capacity (0 hits)`, `parcelStage.ran: 0`.

| ID | Formal Oracle (`ulg.campaign.receipt.v1`) | Live Code Reality Post-P0..P3 (`abd76e44`) | Remaining Open Gaps Blocking Formal Acceptance |
|---|---|---|---|
| **G5** | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Bounded single-realm JS CAS `ReservationLedger` live. | Multi-realm/distributed reservation remains future scope. |
| **G7** | **ACCEPTED** (`3/3 PASS`, 2026-11-18) | Offline advisory NIST/PubChem audit tooling live. | Offline advisory only; no runtime physics acceptance implied. |
| **A1** | **OPEN** (`0` receipts) | **Fixed in P0/P1:** Coupling #8 skipped under worker-owned resident rendering (`sphPhaseScene.js:50431`); enforced typed `lawAdapterContract.js` wired into `validateFusedResidentLawPlan`; `attachWebGpuUncapturedErrorTelemetry` wired at all 6 `requestDevice` sites; raw NUL byte, p-wave speed, `implicitZeroKelvinFaces`, `setBoundedHotBuffer` (64-key FIFO), and `sphAerosolParcelGpu.js` `GPUDevice` weak-ref `device.lost` relay fixed. | 5 overlapping contact responses remain pinned by legacy contact suites; 63-limb `sphExactRational` (`71` refs / `33` files) still needed by `sphPhaseCarrierTransferGpu.js`; `76` `replaceRequiredWgsl` patches & `248` `@workgroup_size(1)` kernels remain; `iron-ice-quench` still executes `32` compute passes, `36.6` encoders, `16` `createBuffer`, `3.26` `workDone` per step; formal oracle unrun. |
| **A2** | **OPEN** (`0` receipts) | **Fixed in P0/P2:** Worker Scale Atlas multipole call signature fixed (`{ atlas }`, `receipt.coupledPairDirectedCount`); `createDynamicHierarchyLodController` wired to physical density/thermal/interface observables; incremental CSR migration live by default. | `0` shipped presets run 3+ SS levels by default; `schroederSpatialScaleAtlasGpu.js` / split-coarsen not yet integrated into default preset step loop; `schroederActiveNodeCompactionGpu.js` remains opt-in; formal oracle unrun. |
| **G6** | **OPEN** (`0` PASS / `3` FAIL historical) | **Fixed in P1:** `radiationEpsilonFluxWPerM2` preserved in `normalizeThermalDormancyConfig`; packed `uncertaintyBuffer` + `uncertaintyWordOffset` wired into reaction & phase dormancy. | Live `iron-ice-quench` probe shows `thermalPotential.status === 'deferred-capacity'` (`0` consumer hits); formal oracle unrun. |
| **A3** | **OPEN** (`0` receipts) | **Fixed in P1:** Live GPU radiation consumer (`consume_thermal_regional_radiation`) wired into single schedule-boundary pass AND fixed critical production bug where `sphThermalRegionalClosureGpu.js` had `thermo0.x` (`materialId`) and `thermo0.z` (`temperatureK`) swapped! Verified on native Vulkan. | `implicitPressure` remains OFF on standard-matrix presets (only `water-realtime`); formal oracle unrun. |
| **A4** | **OPEN** (`0` receipts) | **Fixed in P1/P3:** GPU-native WebGPU Chebyshev fitter (`responseFunctionFitGpu.js`, 1D & 2D verified `<1e-4` on Vulkan), live `eshkolHigherOrderLawCompiler` wired into worker, and durable `materialPolytopeRegistry.js` created & wired into `cosmicQuantumZoomDemo.js`. | Legacy CPU JS response fitters (`gasResponseFunctions`, `eshkolEosStiffness`) still run at startup/fallback; formal oracle unrun. |
| **G2** | **OPEN** (`0` PASS / `18` FAIL historical) | **Fixed in P2:** First-principles Chapman–Enskog `μ(T)` & Modified Eucken `k(T)` added in `pairPotential.js` + `referenceBankAnchoring.js`; `sphExactVaporParcelLedgerGpu.js` generalized beyond H2O/air (`createSphExactVaporParcelLaw`); GPU two-way Stokes drag momentum conservation (`twoWayDrag: true`) verified on Vulkan. | Default `iron-ice-quench` & `sodium-water` presets stay `environmentMode='vacuum'` & `exactEnergyLedger=false` because `iron-ice` already breaches Section 3 budgets (`32` passes, `3.68` submits, `0.0015x` RT); split/merge opt-in; formal oracle unrun. |
| **G3 / A5** | **OPEN** (`0` receipts each) | **Fixed in P0/P2:** SOL-5 OOB capacity bug & 17 zero-load dispatches/step fixed; SOL-4 N-level `mechanicsBuffer` no-op fixed; SOL-6 `padToMultipleOf4` enables `10³` ice & `3³` Na/Cs + live GPU `consume_active_proxy_quadrature` consumer verified on Vulkan; material-derived contact law (`deriveSchroederSolidContactLaw`), surface-only solid radiation (`exposed_area_m2`), and frame-indifferent co-rotational velocity smear (`wgsl.js`) verified on Vulkan. | Solids still use 3 private 4,096-bucket hashes (`schroederSolidRigidGpu`, `schroederSolidFluidContactGpu`, `schroederSolidFluidThermalGpu`) rather than canonical SS cells; product placement `bodyId` & multi-level rigid coupling remain open; formal oracles unrun. |
| **G4** | **OPEN** (`0` receipts) | **Fixed in P1:** `propose_active` indirect dispatch (`dispatchWorkgroupsIndirect`) wired on reaction discovery + optional indirect dispatch on phase transfer + uncertainty propagation verified on Vulkan (`priority1GpuNative` & `schroederG4DynamicLawActivation` PASS). | Thermal & reaction dormancy still build private 3D box grids rather than consuming canonical SS tree nodes; thermal & radiation law steps still launch dense workgroups; formal oracle unrun. |
| **A6** | **OPEN** (`0` receipts) | **Fixed in P0/P3:** `warmClosureMissBridge` wires `eshkolSample` + `adoptedEosStiffnessBundles` into worker stiffness table; 6 hardcoded `/@fs/home/cos/...` URLs replaced with static relative imports; `verify-pages-build.mjs` hardened; **real 2-browser-context WebRTC `RTCPeerConnection` + `RTCDataChannel` proof PASS** (`priority3GpuAndWebRtc.native.test.mjs`, relay WS closed before `Au`/`Hg` derivation + fail-closed disconnect). | Cross-machine NAT/STUN/TURN validation over 2 physical hosts cannot be executed on one host; `../peercompute` still bundles `83 MB` of unused `ort-wasm-*.wasm` into `dist/`; formal oracle unrun. |
| **G1** | **OPEN** (prior 2026-09-13 attempt FAILED) | **Fixed in P0/P2/P3:** `dampedNativeSurfaceMotionAgeS` wired into live `workerOwnedNativeSurfaceMaterial.js`; marching cubes vertex-row budget clamped to `maxStorageBufferBindingSize`; magic `80/82/24` per-material `h2o`/`fe`/`steam` isovalues replaced with continuous density scaling; `plan/todo/nitpicks.md` closed & archived to `plan/done/nitpicks.md`. | `sphPresentationCadence.js` still marks `visibleMotionCadenceVerified: false`; `.icc/completion-oracles.yaml` still lists deleted `bulk-water` preset; true `>= 54 Hz` visibly advancing motion across all presets unverified on formal oracle. |

---

## 5. Additional Cross-Cutting Architectural & Production Debt (Verified at `23a961c4`)

1. **Unenforced Law Adapter Contract & Fragile Shader Patching:**
   `validateFusedResidentLawPlan` (`sphMlsMpmGpuStep.js:19108`) checks only 4
   hardcoded resource strings on one fused sidecar plan; `74` `replaceRequiredWgsl`
   string-patch calls remain in `sphMlsMpmGpuStep.js:5279-10132` (+ raw `.replace()`
   in 4 more files).
2. **Sedenion Plan Violation:** `src/runtime/chemistry/reactionCandidates.js:282, 362`
   returns `null` on `sedenionScope.reactiveClass === 'inert'` — suppressing
   balanced candidates instead of only prioritizing them (violates
   `plan/todo/sedenion-reaction-scoping-plan.md`).
3. **Production Portability & Packaging:**
   - `src/runtime/peercomputeBrowserResidentHost.js:163-168` hardcodes 6
     `/@fs/home/cos/projects/peercompute/...` URLs into `dist/` and `docs/`;
     `scripts/verify-pages-build.mjs` misses variable-held `/@fs` strings.
   - `package.json` has no `"engines"` field and depends on
     `file:../webgpu-marching-cubes`.
   - Marching cubes (`sphPhaseScene.js:3279`) allocates `256 MB` without clamping
     to `device.limits.maxStorageBufferBindingSize`.
4. **Multiscale & Electronic-Structure GPU Honesty:**
   - `selfGravitatingHydroGpu.js` and `cosmicQuantumGpuKernels.js` build private
     2-tier octrees instead of sharing Scale Atlas multipole.
   - `radialKohnShamWebGpu.js` reads `vElec` back to CPU every SCF iteration
     (`hybrid-webgpu-potential-cpu-eigensolver`); `periodicBulkDft.js` and
     `molecularHartreeFock.js` are 100% CPU JS; `materialPolytopeRegistry` does
     not exist in `src/` yet.
5. **Studio UX Open Items (`plan/todo/nitpicks.md`):** Material-derived initial
   body edge lengths, automatic overlap/OOB resolution (including box expansion),
   and pause-on-edit consistency remain open.

---

## 6. True Prioritized Next-Work Queue (What We Really Have To Do Next)

> **Rule:** Fix silent live-wiring bugs and architectural violations **before**
> chasing new demos or stamping formal oracle receipts. Each step below maps
> directly to verified code gaps above and ends with GPU invariants + Section 3
> `gpuprobe.sh` budget checks + formal `ulg.campaign.receipt.v1` capture.

### Priority 0 — Fix Active Live Bugs & Production Safety Hazards
1. **Fix silent/hazardous live bugs immediately:**
   - Fix **SOL-5 OOB buffer capacity bug** (`frameBuffer`/`latticeBuffer` vs
     `maxBodyCapacity`) and either feed real contact/thermal stress into
     `memberLoadBuffer` or gate off zero-load dispatches (`schroederSolidFractureGpu.js`,
     `schroederSolidRigidLane.js`).
   - Fix **worker Scale Atlas multipole broken call signature**
     (`ulgMechanicsResidentStage.worker.js:15758`, `{ atlasPlan }` → `{ atlas }`).
   - Wire `dampedIsosurfaceShaderMotionAgeS` into the live native material path
     (`workerOwnedNativeSurfaceMaterial.js:141`) while pursuing true continuous
     cadence.
   - Wire `device` + `lane` into `createWarmClosureMissBridge`
     (`sphPhaseScene.js:54631`) and pass `eshkolSample` in
     `warmClosureMissBridge.js:591` so A6 actually adopts live Eshkol-WASM
     derivations into the GPU lane.
   - Fix `sedenionScope.reactiveClass === 'inert'` suppression in
     `reactionCandidates.js:282, 362` (prioritize only, never drop balanced
     candidates).
   - Remove the 6 hardcoded `/@fs/home/cos/...` URLs from
     `peercomputeBrowserResidentHost.js:163-168` and harden
     `verify-pages-build.mjs`; clamp marching-cubes storage allocation to
     `device.limits.maxStorageBufferBindingSize`; add `uncapturederror` listener;
     fix raw NUL byte at `sphPhaseViewStateTransport.js:98`, `0 K` default wall
     in `thermalEnvironmentAuthority.js:222`, `sphPhaseDemo.js:1204` p-wave speed,
     `device.lost` listener leaks (11 files), and `DataState.setHotBuffer`
     eviction.

### Priority 1 — Close True Architecture Debt (A1, SS Unification, G4, A3/A4)
2. **Finish A1 Substrate & Legacy Retirement (`plan/todo/a1-realtime-substrate.md`):**
   - Delete **Coupling #8** (move pressure-interface force rows strictly to GPU
     physics cadence; remove `sphPhaseScene.js:21478, 50435` render-cadence JS
     solver).
   - A/B and deduplicate the **5 overlapping iron-ice contact responses** down
     to one coherent GPU contact authority (`selective-contact-law-application-plan.md`).
   - Retire disabled **63-limb exact rationals** (`sphExactRational*` + 20+
     unused modules) and production-bundled **CPU test mirrors**
     (`mlsMpmCarrier.js`, `sphPhaseCarrier.js`, inline CPU mirrors in
     `schroederSpatialMechanicalProposalsGpu.js` / `sphRenderGpuKernel.js`).
   - Burn down hot-loop `@workgroup_size(1)` serial compute entry points and
     begin replacing `74` `replaceRequiredWgsl` patches with an enforced typed
     **Law Adapter Contract** (`ss-law-architecture-assessment.md`).
3. **Make G4 Truly Zero-Work & SS-Backed (`plan/todo/g4-dynamic-laws-proposal.md`):**
   - Replace private 3D box grids in thermal/reaction dormancy with canonical SS
     active tree nodes (`schroederActiveNodeCompactionGpu.js`).
   - Switch all 4 live law families (thermal, reaction, phase, radiation) from
     full `ceil(N/64)` workgroups to real **`dispatchWorkgroupsIndirect`**
     against compacted active-node lists.
   - Fix `radiationEpsilonFluxWPerM2` drop and wire uncertainty buffers into
     reaction & phase dormancy.
4. **Close the Real A3 / A4 / G6 GPU Closure Loop (`plan/todo/a3-a4-regional-and-multidimensional-closures.md`):**
   - Bind `sphThermalRegionalClosureGpu.js` outputs to live GPU thermal/phase
     law shaders (currently 0 consumers!).
   - Move A4 Chebyshev/response fitting (`fitResponseFunction`,
     `gasResponseFunctions`, `eshkolEosStiffness`) onto GPU + wire
     `eshkolHigherOrderLawCompiler.js` into live SPH closure misses.
   - Promote semi-implicit coarse-`dt` pressure (`a1-eshkol-coarse-dt.md`) onto
     canonical presets inside its 1% error envelope.

### Priority 2 — Unify Coherent Solids (G3/A5) & First-Class Air / Exact Ledgers (G2) on Multi-Level SS
5. **Unify G3 / A5 Coherent Solids onto SS Cells (`plan/todo/sol-critic.md`, `g3-solids-proposal.md`, `a5-solid-fluid-coupling.md`):**
   - Replace the **3 private 4,096-bucket solid hashes** with canonical SS
     spatial cells + solid proxy view.
   - Close all **5 pre-SOL-1 gates** (surface-only radiation, objective velocity
     smear, `bodyId`-aware product placement, multi-level rigid coupling,
     material-derived restitution/friction).
   - Fix **SOL-4 on N-level chain** (`mechanicsBuffer` binding) and **SOL-6
     preset eligibility + live `activeProxiesBuffer` consumption**.
6. **Turn G2 Exact Ledgers & Multi-Level First-Class Air ON by Default (`plan/todo/first-class-air.md`, `g2-integer-ledger-proposal.md`, `phase-resolved-steam-optics-plan.md`):**
   - Enable `exactEnergyLedger`, multi-level SS air + worker split/merge
     (`schroederPhaseSlotRefinement`), and GPU κ-Köhler/Maxwell–Mason/Stokes
     plume stages on canonical room-air scenarios under Section 3 GPU budgets.
   - Wire dynamic LOD (`dynamic-hierarchy-lod.md`) and Scale Atlas multipole
     into live SS + share multipole across `selfGravitatingHydroGpu.js` and
     `cosmicQuantumGpuKernels.js`.
   - Derive dilute-gas `k, μ` from `pairPotential.js` (Slice 4) and retire the
     single-level implicit-atmosphere stand-in (Slice 6) + magic `80/82/24`
     isovalues (`surface-contact-transport-phase-closure-plan.md`).

### Priority 3 — Formal Oracle Acceptance (A1–A6, G1–G4, G6) & Frontier Backlog
7. **Capture & Review Formal `ulg.campaign.receipt.v1` Oracle Bundles:**
   - Run and independently verify `.icc/completion-oracles.yaml` targets in
     dependency order (`A1 → A2 → G6/A3/A4 → G2 → G3/A5 → G4 → A6 → G1`),
     flipping each goal to `completed` (`accepted`) in `.icc/assistant-goals.yaml`
     **only** after its formal receipt bundle passes.
   - Run real 2-machine / real-browser WebRTC `RTCPeerConnection` A6 validation
     (`distributed-peercompute-network-stack-plan.md`).
8. **Frontier Science & UX Backlog (`plan/todo/README.md` Section 4):**
   - GPU Kohn–Sham SCF eigensolver & GPU bulk DFT (`webgpu-material-property-resolvers-plan.md`),
     `materialPolytopeRegistry` (`material-polytope-registry-and-property-fit-plan.md`),
     complete non-fallback material bank (`material-property-json-bank-plan.md`),
     Studio UX nitpicks (`nitpicks.md`), and G7 Lane-Emden/MESA benchmarks for
     Stellar Genesis (`hydrogen-nebula-to-star-fusion-bridge-plan.md`).

---

## 7. Document & Evidence Map

- **Canonical rules:** [`AGENTS.md`](../AGENTS.md) (`CLAUDE.md` → `@AGENTS.md`)
- **Active routing (read first):** `plan/CURRENT-PLAN.md` (this file)
- **Live checkpoint log:** [`plan/STATUS.md`](STATUS.md) (top ~40 lines)
- **Active todo index (all 32 open docs):** [`plan/todo/README.md`](todo/README.md)
- **Architecture reference:** [`plan/project-orientation.md`](project-orientation.md),
  [`plan/ss-law-architecture-assessment.md`](ss-law-architecture-assessment.md),
  [`plan/solver-law-inventory.md`](solver-law-inventory.md),
  [`plan/ULG_Triad_Current_Plan_Addendum.html`](ULG_Triad_Current_Plan_Addendum.html)
- **ICC durable control plane:** [`.icc/completion-oracles.yaml`](../.icc/completion-oracles.yaml),
  [`.icc/assistant-goals.yaml`](../.icc/assistant-goals.yaml),
  [`.icc/quality-campaigns.yaml`](../.icc/quality-campaigns.yaml) (external
  receipts under `/home/cos/.cache/icc/repos/ulg/`)
- **Archives (consult only on historical audit):** `plan/done/` (incl.
  `done/handoffs/`, `done/audits/`, `done/refactor/`, `done/SS/`),
  `plan/moot/`, `plan/log.md`, `plan/plan.md`, `plan/implementation-status.md`,
  `plan/tests.md`, `plan/notes/` (start at `plan/notes/BRIEF.md`)
