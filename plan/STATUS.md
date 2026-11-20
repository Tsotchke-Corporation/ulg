# Current status — 2026-11-19 AKST

**Active plan:** Read [`plan/CURRENT-PLAN.md`](CURRENT-PLAN.md) first (single
authoritative routing document).

- **2026-11-19 Slice 2.2 (G3/A5 — GPU-Binned Coherent Solids, Exact-Ledger Coupling & Default Rigid Ice):**
  - Replaced brute-force `O(N·M)` / `O(P²)` solid searches with lock-free 4096-bucket GPU 3D spatial cell hashes (with per-thread 27-cell bucket deduplication and deterministic tie-breaking) across `src/runtime/sph/schroederSolidFluidContactGpu.js`, `src/runtime/sph/schroederSolidFluidThermalGpu.js`, and `src/runtime/sph/schroederSolidRigidGpu.js` (`proxy_grid` inside the 12-storage-buffer floor).
  - Coalesced all 5 rigid-lane stages (`stage`, `thermalStage`, `couplingStage`, `contactStage`, `releaseStage`) into ONE shared WebGPU compute pass per step in `src/runtime/sph/schroederSolidRigidLane.js` with pre-pass `.prepare(...)` uniform/clear hoisting (safe under burst `pooledWriteThrough`).
  - Wired solid-fluid traction/buoyancy, solid-fluid thermal exchange (`U += pkt, S += pkt` preserving bit-exact `Σ(U − S)`), and melt release (`exact_mass_rows` + `exact_energy_rows`) onto the G2 exact-ledger canonical lane (`sphGpuParticleUploadExactMassBuffer`, `solidRigidReleaseFluidBuffers`, `schroederSolidFluidThermalGpu.js`, `schroederSolidReleaseGpu.js`).
  - Enabled general physics-driven coherent rigid solid admission **ON by default** (`rigidSolids: '1'` in `COMMON_RUNTIME`, `coherentRigidSolids` in `sphPhaseDemo.js` / `sphPhaseDemoMount.js`, preserving explicit `mechanicsMode: 'continuum'` / `rigidSolids=0` opt-outs and keeping reactive solids like `Na` and `Cs` on the continuum chemistry lane).
  - Verified: 135/135 host tests (including new `tests/schroederSolidAutoAdmission.test.mjs`) + `npm run build` PASS; ALL 9 native Vulkan SOL-0/1/2/3 suites PASS (including new `tests/schroederSolidBuoyancyAndExactLedger.native.test.mjs`: float `+0.588 m/s`, neutral `-1.70e-7 m/s`, sink `-0.514 m/s`, `maxMomentumErr <= 2.5e-8`, `uMinusSDrift = 0` across 4 released meltwater members and `8.59e9` quanta); real-desktop Chrome visual sequence on zero-flag default `iron-ice-quench` confirmed sharp coherent rigid ice (`comY = 0.013999 m`, 1,000 members, `releaseEnabled: true`, 110–120 Hz UI rAF, 0 errors) with glowing molten iron draping cleanly over the cube edges; Section 3 GPU budget probe (`slice2-2-iron-budget-v3`, zero opt-in flags, `CPUQuota=50%`) passed every target (**submits/step `1.66` (`<=2`)**, **computePasses/step `23.32` (`<=25`)**, **dispatchIndirect/step `9.49` (`<=16`)**, `6.02 steps/s`, GPU stepping mean `16.6%`, `gpuErrors: []`).

- **2026-11-19 Slice 2.1 (G2 — Bank-Anchored Product Closures, Mixture Air Default & Room-Air Plume Proof):**
  - Added general CRC/NIST-JANAF bank-anchored compound records (`feo`, `fe3o4`, `fe2o3`, `naoh`, `na2o`, `csf`) with explicit `reference-fallback` provenance to `data/material-properties/compounds.json`; extended `src/runtime/material/referenceBankAnchoring.js` to synthesize missing solid phases + melting transitions with complete property provenance and wired `anchorDerivedMaterialProperties()` into `src/runtime/material/compoundClosure.js` so reaction products inherit anchored solid/liquid/gas phases, densities, Cp, conductivities, and latent heats.
  - Promoted `environmentAirParcels: 'mixture'` to default in `src/runtime/sphEnvironmentControls.js` and `src/runtime/sphPhaseDemo.js` (keeping `'species'` opt-out intact).
  - Fixed two real room-air runtime bugs caught during real-desktop Chrome testing: (1) `src/runtime/sph/sphOpticalRouteIdentity.js` no longer synthesizes conflicting default collective optical routes for products with explicitly `blocked` dispersed optics; (2) `src/runtime/sph/sphReactionHeatProxyGauge.js` admits single-phase ideal-gas caloric products (`SPH_THERMAL_GAS_ONLY_CALORIC_SEGMENT_TYPE`, e.g. `H2`) while still failing closed on multi-phase condensables; (3) `persistWorkerScheduleResidentStepOptions` in `src/services/ulgMechanicsResidentStage.worker.js` respects explicit `null` overrides on `reactionActivationWatchTable` during dormant→active transitions instead of resurrecting the stale predecessor watch table.
  - Verified: all material-provenance, environment-particle, static-table, heat-proxy-gauge, and worker host tests + `npm run build` PASS; sequential real-desktop Chrome visual sequences passed with zero errors on room-air `iron-ice-quench` (`environmentMode=air`, `nuclei=500`, `exactEnergyLedger=1`, `mixture` air default: 16 schedules, 256 steps, 12–16 steps/s, 50,152 live G6 hits, molten iron deforming across melting ice) and room-air `sodium-water` (`environmentMode=air`, `mixture` air default, bank-anchored `NaOH` + gas `H2`: 9 schedules, 576 steps, 61–64 steps/s, 64,000 live G6 hits, clean dormant→active transition & 3D splash wave).

- **2026-11-19 Slice 1.5 (Close Live Eshkol / A3 / A4 / G6 Closure Loop — Phase 1 Complete):**
  - Integrated per-source G6 empirical temperature uncertainty (`dT = |T| * bounds.z`) into interval-aware G4 thermal dormancy (`src/runtime/sph/schroederThermalDormancyGpu.js` scatters conservative `[T - dT, T + dT]` halo intervals and checks `|T_wall - T| + dT > epsilon_T`; `src/runtime/sph/schroederSpatialThermalProposalsGpu.js` writes per-source uncertainty tail words and removes the `potentialBindings ? null :` dormancy bypass).
  - Upgraded `src/runtime/webgpuDeviceLimits.js` to request up to 16 storage buffers per shader stage when the adapter exposes `>= 16` (preserving the 12 floor for 12-slot adapters), enabling G6's 15-binding thermal derived prepass on live GPUs.
  - Enabled the live G6 caloric thermal-potential closure loop **ON by default** across thermal Schroeder scenes (`thermalPotential: '1'` in `COMMON_RUNTIME` in `src/runtime/sphPhaseScenarioPresets.js`, wired through `sphPhaseDemoMount.js`, `sphPhaseDemo.js`, `sphGpuBuffers.js`, and `sphPhaseScene.js` with compact `scene.userData.sphThermalPotentialStatus` telemetry).
  - Added G5-reserved A3 regional closure worker lane (`src/runtime/material/regionalClosureWorkerLane.js`) bridging `regionalClosureSamplerGpu.js` + Eshkol-AD A4 response tables + `updateSphImplicitPressureStiffnessTable()` (`src/runtime/sph/sphImplicitPressureGpu.js`).
  - Verified: 215/215 host tests (including new `tests/regionalClosureWorkerLane.test.mjs`) + `npm run build` PASS; native Vulkan `tests/schroederThermalDormancy.native.test.mjs` (D1–D4 incl. conservative G6 uncertainty intervals), `tests/thermalPotentialWorker.native.test.mjs`, and `tests/regionalClosureSamplerGpu.native.test.mjs` PASS; live default `iron-ice-quench` probes (`slice1-5-iron-g6-v2` & `slice1-5-iron-budget`, zero opt-in flags, `CPUQuota=50%`, 0 errors) confirmed live G6 adoption (`ordinal: 1–3`, `adopted: true`, `41,460–46,433` live GPU `rf_eval_differential` hits) running concurrently with G4 thermal dormancy (`220–240` encodes) while meeting Section 3 budgets (**submits/step `1.71` (`<=2`)**, **computePasses/step `22.50` (`<=25`)**, **dispatchIndirect/step `9.60` (`<=16`)**, `mapAsync/step 0.14`, `6.20 steps/s`, GPU stepping mean `15.2%`).

- **2026-11-19 Slice 1.4 (Fast N-Level SS Chain & Dynamic Split/Merge):**
  - Eliminated the 216-indirect-dispatch-per-pair cross-level transport loop in `ulg-gpu-abi/src/schroederSpatialChainCrossTransportWgsl.js` and `src/runtime/sph/schroederSpatialChainCrossTransportGpu.js`, replacing it with 3 simultaneous direct-dispatch Jacobi kernels (`count_coarse_overlap`, `exchange_simultaneous`, `apply_coarse_delta`) with Gershgorin-safe overlap scaling and atomic-CAS coarse accumulation. Indirect dispatches per adjacent level pair dropped **216 → 0** (6 direct dispatches in 1 compute pass, 256-byte uniform buffer instead of 55 KB).
  - Updated `src/runtime/sph/schroederSpatialChainResidentGpu.js` to admit `ambientPressurePa > 0` when `gasPressureMechanicsBoundaryEnabled` is enabled and forward `phaseSlotRefinement` through `closureOptions`; retired implicit-atmosphere stand-in (`explicitAtmosphereReferenceDensityKgPerM3`) on multi-level SS air in `src/visualization/sphPhaseDemoMount.js`.
  - Added Section 3 regression test in `tests/schroederSpatialEpochTransaction.test.mjs` enforcing `SCHROEDER_SPATIAL_CHAIN_CROSS_TRANSPORT_INDIRECT_DISPATCHES_PER_PAIR === 0` (`<= 16`).
  - Verified: 42/42 `tests/schroederSpatialEpochTransaction.test.mjs`, `npm run build`, native Vulkan `tests/schroederSpatialChainCrossTransport.native.test.mjs` (**21 scenarios × 2 cycles = 42 real Vulkan GPU runs**, including 2/3/6-level conservation, asymmetric, emptyMiddle, drag:false, torque/geometry/surface fault controls — `errors: []`, exact momentum/energy/angular conservation), and native Vulkan `tests/schroederSpatialChainPressureInterval.native.test.mjs` (cases 0, 6, 10: 3-level pressure + exact-energy phase intervals + native cross-transport + surface stress — `errors: []`, `mapAsyncCount: 0`, `hostQueueFenceCount: 0`).

- **2026-11-19 Slice 1.3 (Canonical Fused Multi-Step Substrate & Legacy Retirement):**
  - Added pooled staging write-through (`pooledWriteThrough`), disjoint-buffer hoisting compute-pass coalescing (`coalesceComputePasses`), render-pass immediate flush, `createTexture.destroy` / `buffer.mapAsync` burst safety, and queue-ordered FIFO buffer pooling (`acquireQueueOrderedPooledBuffer` / `releaseQueueOrderedPooledBuffer`) in `src/runtime/webgpuComputeLayout.js` (wired into `sphG2pGpuKernel.js`, `sphThermalGpuKernel.js`, and `sphPassTimestampCensus.js`).
  - Enabled burst batching + pass coalescing across active canonical schedules (`src/services/ulgMechanicsResidentStage.worker.js`, `submitBurstSteps: '4'` in `COMMON_RUNTIME` in `src/runtime/sphPhaseScenarioPresets.js`), eliminated per-step `paceCanonicalPhysicsQueue()` waits when presentation is in flight, and consumer-gated unapplied `lawQueue` / `phaseVolumeMigration` stages in `src/runtime/sph/schroederHierarchyGpu.js`.
  - Added executable law descriptor validation (`validateFusedResidentLawPlan` / `assertValidFusedResidentLawPlan` with `accumulates` contracts) and GPU multi-step epoch advancer / A2 bounded validity horizon admission in `src/runtime/sph/sphMlsMpmGpuStep.js`.
  - Optimized `src/runtime/sph/sphImplicitPressureGpu.js` (cached per-particle `kv` inside `partials` staying within the 12-storage-buffer limit, fast interior stencil mask, GPU early-exit `relativeTolerance = 1e-3`). Retired 370 KB dead tracked `src/services/ulgMechanicsResidentStage.worker.js.orig`.
  - Verified: 500+ host tests + native Vulkan `tests/sphImplicitPressureGpu.native.test.mjs` + `npm run build` PASS. Live GPU probes (`CPUQuota=50%`, `gpuErrors: []` on all 3): `iron-ice-quench` **submits/step `23.52 → 1.53` (`<=2`)**, **computePasses/step `123.73 → 22.78` (`<=25`)**, **dispatchIndirect/step `9.67` (`<=16`)**, `mapAsync/step 0.08`, `steps/s 2.73 → 6.51` (2.38×); `water-realtime` **submits/step `0.14`**, **computePasses/step `9.70`**, `dispatchIndirect/step 0`, **`120.57 steps/s`** (`1.029×` real-time median `995 ms / 128 steps`); `bulk-water` **submits/step `0.82`**, **computePasses/step `9.39`**, GPU util `7.0%`.

- **2026-11-19 Slice 1.2 (Parallel Jacobi Contact & Thermal Conduction Decoupling):**
  - Added multi-workgroup Parallel Jacobi Cleanup kernels (`parallel_jacobi_cleanup_measure`, `parallel_jacobi_cleanup_check_converged`, `parallel_jacobi_cleanup_solve`, `parallel_jacobi_cleanup_allocate_energy`) in `src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js`, running across all GPU SMs with Gershgorin stability, pairwise momentum conservation, exact `energy_ledger` closure, wall complementarity, active-edge skipping, and GPU early-exit convergence synthesis.
  - Added `SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_PASS_CAP_FALLBACK` (`ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js`) and `thermal_mechanical_interface_receipt_pass_cap_fallback()` (`src/runtime/sph/schroederSpatialThermalProposalsGpu.js`) so contact pass-cap exhaustion no longer silently aborts thermal conduction/radiation (thermal proceeds on conservative symmetric sphere geometry while corrupt/stale/nonfinite receipts still fail closed); added bounded per-device `matchedTimeBindGroupCache`.
  - Updated `iron-ice-quench` and `sodium-water` preset cleanup budgets (`src/runtime/sphPhaseScenarioPresets.js`: 24 parallel Jacobi rounds + 16-pass bounded polish).
  - Verified: 393/393 host tests pass, native Vulkan contact + exact thermal energy tests pass, `npm run build` passes (2.77s), and 15s live GPU pass census (`slice1-2-fast` vs `slice1-2-census`, `iron-ice-quench`, `CPUQuota=50%`) cut contact cleanup **307.1 ms → 6.27 ms/step (49× faster)**, total GPU compute **325.6 ms → 25.4 ms/step (12.8× faster)**, stepping GPU util **96.2% → 23.8%**, and restored live thermal conduction (`4.78 ms/step`, molten iron cooling); `slice1-2-sodium` verified `13.17 ms/step` total GPU time, `1.72 ms/step` cleanup, `18.3%` GPU util, 0 GPU/page errors.

- **2026-11-19 Slice 1.1 (A1 Step 1 — presentation decoupling & Z-buffer parity):**
  - Fixed the rigid-solid vs fluid-isosurface depth mismatch in
    `src/services/workerOwnedIsosurfacePresenter.js` (`threeViewProjectionToWebGpuClipMatrix`
    aligns solid clip-Z `[0, w]` with `workerNativeSurfaceMotionWgsl.js`),
    verified by unit test + native Vulkan `tests/schroederSolidShape.native.test.mjs`.
  - Added canonical worker-lane fast post-commit continuation in
    `src/visualization/sphPhaseDemoMount.js`
    (`resolveSphCanonicalWorkerLanePostCommitFastContinuation`), eliminating the
    duplicate 4.1 MB full-particle readback and page-GPU upload after every
    schedule when the worker already enqueued retained-GPU isosurface rendering.
  - Headless 20s `gpuprobe.sh` (`iron-ice-quench`, `CPUQuota=50%`,
    `slice1-1-fast-cont` vs `baseline-58353b6f`): post-compute page stall
    dropped **201.3 ms → 0.6 ms** (p90 494.5 ms → 0.7 ms), page GPU uploads
    **4.12 MB → 0 bytes**, worker particle `mapAsync` readbacks **12 → 0**,
    submits/step **23.52 → 19.88**, zero GPU/page errors, build passes.

- **2026-11-19 checkpoint & plan consolidation:** Local checkpoint `31fb694`
  landed on `main` capturing all Oct 27–Nov 19 worktree changes; active work
  branched to `feat/ulg-ga-consolidation` (push, merge, and Pages remain held).
  Owner approved architecture-first re-sequencing: **Phase 1** (A1 substrate
  floor + parallel Jacobi contact + fused GPU-epoch substrate + fast N-level SS
  chain + live Eshkol/A3/A4/G6 closure loop), **Phase 2** (land G2/G3/A5/G4/A6
  directly on the single canonical lane, ON by default), **Phase 3** (G1
  decoupled presentation reassessment at `>=54 Hz` latest committed state).
  Local slice commits, retiring superseded legacy code routes once GPU
  replacements pass, bank-anchored product closures (`imported` provenance),
  mixture-parcel default after verification, and a hard per-step submit /
  indirect-dispatch / ms budget gate are all in force. G5 and G7 remain the two
  accepted original milestones; all prior evidence is preserved below.

## Previous checkpoint entries (2026-11-19 UTC and earlier)

- G6 worker adoption now passes actual module-worker IPC with real
  ComputeManager/StateManager commits. Twelve direct/fitted physical intervals
  preserve exact mass/U-S; dropped acknowledgement delays adoption, changed
  source rejects before advancing physics, and fresh fit hits are recorded.
  Zero GPU errors; 732 host tests pass, three opt-in skips; build passes.
  Mounted scene/offscreen integration, G4 uncertainty, potential identities,
  Eshkol pinning and resource/performance acceptance remain. Only G5/G7 accepted.
  Evidence: `g6-worker-adoption-20261119/`.

- G6 now passes complete same-level thermal intervals across fit adoption:
  three manufactured scenarios, 18 intervals, exact mass/U-S, actual
  hot-to-cold transfer and fixed-size GPU evidence. State/thermo/energy rows
  are unchanged by adoption. Real StateManager commits follow fixture-owned
  queue observation; production worker IPC, G4 uncertainty and the remaining
  G6 acceptance gates stay open. 621 host checks pass, three opt-in skips;
  native has zero GPU errors and build passes. Only G5/G7 accepted.

- G6 opt-in canonical thermal prepass consumes a GPU-fitted caloric potential.
  Actual spatial misses, invalid-fit recovery, StateManager-gated adoption and
  subsequent spatial hits pass native checks, zero GPU errors. 84 host tests,
  build and independent review pass. Commit evidence is manufactured; complete
  physical interval, G4 uncertainty, worker/scene, source-potential identities,
  Eshkol pin and mounted/resource acceptance remain. Only G5/G7 accepted.

- G6 host admission/provenance/reservation repairs pass 29 focused checks.
  Independent review confirmed the original GPU-detected fit/adoption cycle,
  real SS consumer and mounted evidence remain required. The former 95%
  estimate overstated readiness; no new goal is accepted.

- Retained-product EOS coverage passes seven scenarios twice through six
  levels, including fault recovery and publication/retirement. Five original
  phase cases and three pressure regressions pass twice, zero GPU errors.
  This is manufactured-state evidence; actual room-air plume remains open.

- Native surface stress passes eight scenarios twice through six levels.
  Five repeated pressure/phase/surface scenarios pass twice, with exact mass/U-S
  and energy-fault recovery at 10 us. Larger-step and live-preset behavior are
  not accepted. Retained-product EOS coverage is verified above; its momentum
  check accounts for the existing boundary traction ledger. Full explicit-air
  coupling, live enrollment and actual plume remain. Only G5/G7 accepted.
  Evidence: `air-chain-surface-20261119/`.

- Cross-level mixture/drag now reaches actual particles with mass, momentum,
  nodal energy and angular-momentum checks. Twenty-one GPU scenarios pass twice
  across two runs; the failed constant-NaN test injection is preserved. Five
  repeated pressure/phase intervals pass twice with exact mass/U-S and fault
  recovery. Five default composite scenarios pass twice. Surface/history coverage,
  remaining laws, live enrollment and actual plume remain; only G5/G7 accepted.
  Evidence: `air-chain-cross-transport-20261119/verification.md`.

- Inherited phase-volume data now carries gas/condensed volume and all three
  gradients through adjacent 2:1 restriction. Fourteen native scenarios pass
  twice through six levels (231.574 s across two runs), preserving volume,
  affine moments, cohort identity and the exact operator transpose; corrupt and zero-volume/nonzero-gradient
  inputs reject. Scalar EOS occupancy remains a separate format. Cross-level
  force/reflux consumption and actual room-air plume remain; only G5/G7
  accepted. Evidence: `air-chain-phase-moments-20261119/verification.md`.

- Original native S9-C mixture/drag now runs in the chain and repeated
  pressure/phase intervals, with momentum/heat checks, exact mass/U-S and
  fault recovery through six levels. Native topology is built before P2G;
  empty levels retain exact zero authority. Cross-level transport, surface/
  buoyancy verification, live enrollment and actual plume remain. Only G5/G7
  accepted. Evidence: `air-chain-native-transport-20261119/verification.md`.

- Original-source pressure now runs inside repeated private energy/phase
  intervals. Six native scenarios pass twice through six levels, with actual
  on/off velocity differences, exact mass/U-S, complete fault rollback and
  clock recovery; zero GPU errors. Resident environmental guards remain until
  remaining transport/mixture/surface laws and live enrollment are composed.
  No plume acceptance; only G5/G7 accepted. Evidence:
  `air-chain-pressure-interval-20261119/verification.md`.

- Original EOS pressure now reaches every native level through its retained
  transpose and one bounded consumer lifetime. Twelve 3/4/6-level native cases
  pass twice (465.029 s), including populated/coarse-only fields and complete
  fault rollback; zero GPU errors. 199 host checks and build pass. Resident
  interval pressure-energy/phase closure, remaining laws and actual room-air
  plume remain. Only G5/G7 accepted. Evidence:
  `air-chain-pressure-family-20261119/verification.md`.

- The original gas EOS/free-volume owner now consumes adjacent-chain occupancy
  through six levels. Twelve native cases pass twice (192.846 s), including
  aerosol/CSR per-cell equivalence, coarse-only volume and middle-link faults;
  zero GPU errors. 157 host checks and build pass. Child arenas follow existing
  retirement without new fences. All-level pressure-force adoption, nonempty
  exact-history coverage and actual plume remain. Only G5/G7 accepted.
  Evidence: `air-chain-eos-volume-20261119/verification.md`.

- Adjacent-chain volume restriction and its exact pressure transpose now pass
  twelve native scenarios twice through six levels, with conserved volume/work,
  fault rejection and zero GPU errors. A coarse-only test found and fixed a
  parent-union live-prefix overflow. 174 host tests, build and seven native G2P
  regressions twice pass. EOS/pressure adoption, auxiliary
  occupancy and actual plume remain. Only G5/G7 accepted. Evidence:
  `air-chain-volume-adjoint-20261119/`.

- Existing gas-boundary pressure now reaches the chain mechanics runner with
  canonical work receipts and whole-chain CFL rollback. Five two-level cases
  pass twice; three pass again after the product-source provenance guard.
  Seven multilevel G2P regressions pass twice; 441 host tests and build pass.
  N-level gas-volume projection/pressure adjoint, full interval integration and
  actual room-air plume remain. Only G5/G7 accepted. Evidence:
  `air-chain-local-laws-20261119/`.

- Native multilevel batches now enter the existing real ComputeManager and
  StateManager with matching retained buffers and accepted GPU time. Normal
  evolution, energy-fault recovery and rejected-commit cleanup pass twice;
  370 host tests, four publication regressions twice and build pass. Worker/
  scene enrollment and required laws still precede actual room-air plume proof.
  Only G5/G7 accepted. Evidence: `air-chain-resident-admission-20261119/`.

- The final private chain state now publishes through the existing spatial
  successor owner with accepted GPU time. Four phase/fault cases pass twice;
  intermediate allocations retire before the next batch. Five auxiliary cases
  pass twice with publication and twice without; 234 host tests and build pass.
  Resident ComputeManager/StateManager admission and live scene enrollment
  remain, followed by required pressure/mixture/surface laws and plume proof.
  Only G5/G7 accepted. Evidence: `air-chain-public-admission-20261119/verification.md`.

- Complete private intervals now retain combined phase groups at fixed capacity,
  with exact inventory checks, whole-state rollback and accepted GPU time.
  Five three-attempt native sequences pass twice; 146 host tests, five ordinary
  regressions twice and build pass. Desktop presets advance but show no proven
  steam plume. Next: existing resident state/clock publication and live-runner
  enrollment, preserving auxiliary families and newly emitted products.
  G2 remains open; only G5/G7 accepted. Evidence:
  `air-chain-residual-phase-continuation-20261119/verification.md`.

- Retained products now enter genuine four-slot phase groups and pass native
  fusion/vaporization and exact mass/U-S checks. Five phase cases and six thermal
  regression cases pass twice, zero GPU errors; 167 host checks and build pass.
  Next: phase-successor persistence and whole-interval rollback, then reaction/
  clock/state admission and plume evidence. G2 and all architecture goals remain
  open; only G5/G7 accepted. Evidence: `air-chain-residual-phase-20261119/verification.md`.

- Populated retained products now consume canonical thermal exchange and carry
  updated state/thermo/exact energy into repeated mechanics. Six GPU thermal
  cases and two three-attempt recovery sequences pass twice, including exact
  combined U-S conservation, conduction/radiation isolation and complete fault
  rollback. 371 host checks and build pass. Next: authenticated four-slot phase
  lineages and reaction consumers, then full interval/clock admission and actual
  plume proof. Only G5/G7 accepted; all architecture goals remain open. Evidence:
  `air-chain-residual-thermal-20261119/verification.md`.

- Carrier and populated-history mechanics successors now persist together with
  exact heat accounting and original-state rollback. 16 GPU cases and two
  three-attempt recovery sequences pass twice; final history verdicts survive
  caller-control reuse. 861 host checks, 14 final ownership checks, build and
  affected ordinary-chain regressions pass. Next: full thermal/phase/reaction
  integration and interval/clock admission, then room-air plume proof. Only
  G5/G7 accepted; G1 deferred; remaining G/A goals open. Evidence:
  `air-chain-residual-handoff-20261119/verification.md`.

- Canonical retained products now run through native multilevel P2G/forces/G2P
  using an authenticated combined source and exact GPU mass copies. 13 motion
  cases pass twice, including gravity, elastic shear and complete mechanical
  rejection rollback. Six repeated-step regressions pass, three repeated on
  final source; 812 broader host checks, eight focused ownership tests and
  build pass. Next: carrier/history successor handoff with exact energy/work
  closure and repeated populated evolution, then actual plume proof. Only
  G5/G7 accepted; G2 and A1–A6 stay open. Evidence:
  `air-chain-residual-motion-20261119/verification.md`.

- Canonical residual history now retains full state/thermo/mechanics and exact
  quantities, preserving deformation/APIC through carry and rollback. 38 GPU
  cases pass twice, 19 inventory cases twice, four repeated-step scenarios
  twice, 517 host tests and build pass. Next: native spatial/P2G/G2P transport;
  populated mechanics still rejects. No new G2 or architecture acceptance.
  Evidence: `air-chain-residual-physical-20261119/verification.md`.

- Whole-step conservation now includes canonical residual mass and U-S with
  carriers/parcels/sinks, including reaction-disabled carry. A real one-quantum
  energy fault rejects, rolls back and then recovers; 13 affected continuation
  scenarios pass twice, plus 19 populated-inventory cases twice, 517 host tests
  and build. Next: native spatial/mechanics transport of populated history.
  Physical residual admission still rejects. No new G2 or A1–A6 acceptance.
  Evidence: `air-chain-residual-inventory-20261119/verification.md`.

- Canonical reaction history now compacts, carries and restores exact mass/U/S
  records with GPU counts and private ownership. Fifteen GPU history cases
  pass twice; eight actual private-chain scenarios pass twice (empty histories).
  Count shrink/growth corruption is now rejected. 517 host tests and build pass.
  Next: complete history inventory reduction and native mechanics transport;
  mass-bearing simulation steps still reject. Only G5/G7 accepted, all A1–A6
  open. Evidence: `air-chain-residual-history-20261119/verification.md`.

- Private reaction residual production now retains exact mass, U and S.
  Eight GPU producer cases pass twice; eight affected repeated-step scenarios
  pass twice with zero GPU errors. 512 host tests and build pass. Mass-bearing
  continuation still rejects: next are canonical history compaction/merge,
  native transport and whole-step inventory/rollback, followed by optical
  handover, accepted publication and actual plume proof. Only G5/G7 accepted;
  no architecture goal closed. Evidence:
  `air-chain-residual-ledger-20261119/verification.md`.

- Multilevel finite walls now use paired canonical energy packets and a
  separate retained successor, with whole-step wall rollback. Eleven GPU
  scenarios pass twice; three 4,097-contributor reduction checks pass signed
  cancellation, sub-microjoule heat and overflow. 281 host tests, 62 final
  ownership tests, build, ledger/parcel regression and legacy wall checks pass.
  The single-level canonical route still refuses until wall admission exists.
  Six desktop images show three presets rendering/advancing without page
  errors; plume/optics/cadence acceptance remains open. The desktop scope is
  inactive after returning143 on teardown. Next: multilevel state/clock
  admission, wall/parcel handover and repeated evolution, then plume proof.
  No new G2 or A1–A6 acceptance. Evidence:
  `air-chain-finite-walls-20261119/`.

- Multilevel parcels now use a separate captured successor with complete
  carrier/parcel/sink conservation and rejection rollback. Ten GPU scenarios
  twice, wet-wall deposition/rollback twice, eighteen large-inventory cases,
  277 host tests and build pass. Reaction/refinement regression also passes
  22 scenarios twice. Three desktop presets render and advance with no
  page/console errors; cadence/motion proof and plume acceptance remain open.
  Next: finite walls, resident state/clock admission and repeated evolution,
  then actual plume proof. No new G2 or A1–A6 acceptance.
  Evidence: `air-chain-parcels-20261119/verification.md`.

- Multilevel refinement now has retained validation, genuine final mass/energy,
  phase checks before redistribution, exact global conservation and complete
  rejection rollback. Eleven GPU scenarios pass twice, zero errors; 646 host
  tests and build pass. Evidence: `air-chain-refinement-20261119/verification.md`.
  Next: parcels/sinks and finite walls, live state/clock admission, repeated
  multilevel evolution and actual plume proof. G2/A1–A6 remain open.

Start with [the November handoff](handoff-2026-11-17.md) and
[implementation status](implementation-status.md).

- [G5 is accepted](done/g5-reservation.md): 81 tests; all original criteria pass.
- [G7 is accepted](done/g7-release-audit.md): eight tests and the offline report;
  all original criteria pass. Other campaign targets remain open; G1 deferred.
- Multilevel phase transfer now retains successor exact mass/energy and rejects
  the whole batch on phase or projection errors. Iron/water fusion and water
  liquid/gas plateau cases pass with exact budgets; failed batches restore all
  physical/mass/energy rows. Regression18 scenarios twice and extended phase9
  twice pass, zero GPU errors; 599 host tests pass, one opt-in skip; build passes.
  Evidence: `air-chain-phase-20261119/`. Next: reaction-plus-phase rollback,
  remaining writers, live state/clock admission, repeated evolution and plume.
  Only G5/G7 accepted; no new G2 or architecture acceptance.
- Canonical integer-energy closure now passes seven GPU scenarios twice
  (122.9 s); the previous five closure scenarios also pass twice. All GPU errors
  are zero; 587 host tests and build pass. Contact heat is recorded, cross-level
  pair energy is exact, and late failures restore physical and ledger state.
  Evidence: `air-chain-ledger-20261119/`. Next: phase/reaction successor mass
  rollback, remaining writers, resident state/clock admission and actual plume.
  G2 and all architecture goals remain open.
- Multilevel thermal/refresh closure candidates now pass five GPU cases twice
  (86.9 s, zero GPU errors), plus 538 host tests and build. Contact heat reaches
  temperature; upstream, late-stage and missing-output faults restore the whole
  physical/exact-quantity family. Original caller dt and producer retention are
  enforced. Exact thermal conductivity bindings/capacity and refresh-validation
  lifetime are repaired. Evidence: `air-chain-closure-20261119/`.
  Canonical integer-energy/phase/reaction/parcel/finite-wall integration and
  resident state/clock admission remain, followed by repeated evolution and
  actual plume proof. Candidate publication stays pending; G2/A5 remain open.
- Multilevel G2P now returns one coherent particle candidate, with all-level
  energy receipts and whole-batch physical/exact-quantity rollback. Seven GPU
  scenarios pass twice, zero errors (125.4 s); 451 host tests and build pass.
  Contact heat reaches particle internal energy. Evidence: `air-chain-g2p-20261119/`.
  Next: actual post-mechanics energy/thermo closure and runner enrollment,
  required phase/mixture laws and room-air plume. Only G5/G7 remain accepted.
- Native velocity/heat publication now passes: eight GPU scenarios, two
  cycles each, zero GPU errors (167.1 s). Corrections reach actual native
  velocity rows and heat sidecars through the existing grid-update receipt
  lifecycle. CFL faults and unconsumed pressure obligations reject the chain.
  All-level reservations, early-retirement refusal and submit-failure handling
  pass host checks; 353 host tests and normal build pass. Evidence:
  `air-chain-native-state-20261119/`. Next: one coherent multilevel G2P result,
  production runner and required phase/fine-scale law integration, then
  room-air/plume acceptance. Native heat is not yet particle thermo heat.
- Exact P2G producer/timestep binding now passes. The force/correction path
  requires real submitted producers for every native level and rechecks them
  at submission. Clones, missing/reordered levels, changed pressure/grid/source
  inputs, mismatched timestep and superseded producers are rejected. Seven
  native GPU scenarios pass two cycles each (149.8 s, zero GPU errors); 353
  host tests pass. The CFL case now uses the same timestep in P2G and correction.
  Evidence: `air-chain-publication-20261119/`. Next: native velocity/heat
  publication and G2P, with all-level mutation ownership and existing
  pressure/phase accounting, then production runner and room-air/plume proof.
- Coarsest force and downward correction proposals now pass GPU gates for
  force-off, gravity, static walls and normal contact through six levels.
  Linear momentum and the transported nodal energy budget are conserved by
  the transfer; dissipated kinetic energy remains available for heat. A final
  control rejects the whole chain if even one level fails. Seven scenarios,
  two cycles each, pass in 148.0 s with zero GPU errors. Host tests: 131 pass,
  one opt-in skip; normal build passes. Evidence: `air-chain-correction-20261119/`.
  Next: exact per-level P2G/dt provenance and native velocity/heat publication
  through the existing grid-update/G2P lifecycle, preserving fine-scale laws,
  then production runner and phase/room-air integration. The new operators
  still write proposals only; G2/A5 and the full campaign remain open.
- All-pair transaction authority and GPU composite restriction now pass. The
  combined state carries mass, momentum, mass gradients and a transported
  kinetic-energy budget through empty intermediate levels; it keeps native
  and inherited state distinct. Native 2/3/4/6-level tests plus overlapping
  six-level fluid fields pass two lifecycle cycles each (89.2 s), including
  stale-state rejection. 131 focused host tests pass (one opt-in skip); normal
  build passes. Six-level phase-moment/receipt cache capacity is fixed too.
  Next: force update, conservative downward correction/reflux and G2P, then
  phase/contact/heat consumers and actual room-air/plume proof. The new state
  is not yet enrolled in the production chain runner; G2/A5 remain open.
  Evidence: `air-chain-authority-20261119/` under the ICC cache.
- Multilevel topology now carries inherited fine fields through empty middle
  levels. Native GPU checks pass for 2/3/4/6 levels, including two build/release
  cycles, partition/first-moment invariants, capacity and stale-source refusal.
  All-pair submission/cleanup and six-level cache capacity are repaired.
  107 host tests and the normal build pass. The chain physics runner is still
  missing; this closes a topology prerequisite, not G2 or an architecture goal.
  Evidence: `air-level-chain-20261119/` under the ICC cache.
- Actual Iron Ice now refines coarse gas at condensed interfaces. The previous
  27-node center query missed every interface; the physical-support query finds
  them using occupied ranges in the admitted GPU dictionary.
- A three-schedule/six-step room-air run commits with 56 active split spares,
  176 gas carriers (80 nitrogen), and zero fixed-record/GPU errors. Refinement
  remains opt-in. Total preset conservation and visible plume remain unproven.
- Eleven native worker scenarios pass, including a neighbor beyond the old
  stencil, merge-back, capacity, material and conservation checks. 269 relevant
  host tests and the normal build pass.
- Next: complete coarse-air/multilevel and mixture representation, then
  contact/heat coupling and actual G2 plume acceptance. The new gate proves
  real-preset splitting and continuation, not full first-class-air acceptance.
- Evidence: `air-interface-preset-20261119/` under the ICC cache. Headed desktop
  screenshots were black; no visual claim. The earlier timed probe split 28
  spares but failed its four-step assertion after completing only two steps.
- Slice 1c/A5 stay open. No commit, push, merge or Pages build; existing dirty
  work is preserved.

# Historical status - 2026-10-24

Start at [plan/handoff-2026-10-24.md](handoff-2026-10-24.md). Branch `main`
has local campaign commits through the handoff; nothing is pushed, merged or
built for Pages (the user's publication hold still stands).

- G1, visible cadence on all six presets: failed acceptance on 2026-09-13.
  The user has delayed it until architecture work makes it feasible. It is not
  finished, and the 2026-09-04 two-water result below is not G1 completion.
- G2, conserved steam/aerosol plumes: active at full scope (user, 2026-10-24).
  3 of 6 child items are done; the next is `activation-energy-exchange`.
- G3-G7 and A1-A6: not started. Campaign definitions are in
  [plan/todo/seven-goal-campaign.md](todo/seven-goal-campaign.md).
- Verified 2026-10-24: 5,151 pass / 75 opt-in skip / 0 fail; build passes.

# Superseded status - 2026-09-04 AKDT

Branch `main`, Goal 2 worktree based on `5686fa8`. The active seven-goal order
and evidence are maintained in `plan/todo/README.md` and
`plan/implementation-status.md`; the July records below are historical.

Goal 1 meets its agreed 54 Hz visual-throughput floor on both large water
presets. Goal 2's generalized conserved-optics producer and aggregate volume
renderer pass focused tests and the six-preset desktop rendering check; all
twelve images were inspected. Visible steam/aerosol at longer horizons remains
unproven, so Goal 2 and its relevant transport plans are still open. Goals 3-7
have not been completed.

Live trusted HTTPS: `https://fastbox.tail5c077c.ts.net:5173/`.

# Historical audit status - 2026-07-10 18:13 AKDT

Branch `SS`, reviewed at `d5319c2` plus the standard-scenario audit slice.

- Fable's reaction/gas/radiation work is substantive, but SOL-0 through SOL-6
  coherent-solid work remains unstarted. The third SS level remains on hold.
- The SPH drawer now has shared water-cycle, molten-iron/ice, sodium/water, and
  cesium/fluorine presets. The same immutable records drive the standard test.
- Standard evidence is no-full resident WebGPU plus a fixed 5,184-byte GPU
  reduction. No particle-state or thermo buffer is mapped.
- The seven-scenario run fails production presentation: the native canvas is
  surface-like initially and uniform after the first refresh; 109 destroyed
  indirect-buffer submissions were recorded. A shared offscreen bind-group
  defect was fixed, and offscreen validation passes, but that is not visible
  acceptance.
- Quantitative result: Cs/F is strongly exothermic and cools; water vapor does
  not rise/condense; Fe cools too little and steam does not rise; Na/H2O forms
  products and heats but misses the hydrogen-rise gate. Time-zero GPU capture
  is still absent.
- The reordered objectives and performance findings are in
  `plan/todo/sol-critic.md`. No physics optimization was implemented.

# Session status — 2026-07-10 (surface-lane + physics run)

Branch `SS`, tip `0b0520c`. Full suite on tip: **993 pass / 0 fail**, all four
SS e2e gates green. Live server: https://<vpn-host>:5173 (main tree; port 5179+
fork servers are gone).

## Surface-lane (task #4) — done items
1. Sphere-PBR parity port (GGX, scene lights, split-sum env, ACES) — b8a744b
2. PBR transmission, zero artistic alpha — f266aa3/e5dc503
3. Vertex-budget clamp; extraction uncapped to full res — ec5a01f + 09bf72c
4. Field resolution ceiling 64 → 96 (smoother, no fps cost) — ccca280
5. Per-fragment emissive temperature (molten core vs cooled crust) — 0b1e285
6. Water refraction + transmission energy conservation (milky-blob fix) — e99c410
7. Sphere-lane gas colors (bank warm-inputs defer to derived optics) — 59a798a
8. Background-image env reflections + T^4 emission above 2200 K — f7a6965
9. Splash-shard velocity-dispersion law (spray → droplets, coherent drops
   bit-identical) — b77a7af

**Task #4 CLOSED (0b0520c):** GGX-exact env prefiltering landed (linear-light
importance sampling, 176 ms build, lobe-shape unit tests); refraction
hit-case tinting proven unnecessary (screen copy is already env-lit by
construction — documented so it stops reappearing); sphere-lane emissive now
follows the same T^4 law as the surface lane. Only mild top-face terracing
remains, parked with the on-hold task #7 (finer SS level), as is true
sub-resolution sheet breakup.

## Physics landed this run
- SS two-level explosion fix (CFL-consistent prolongation) — 3f5b2d9
- Gauge ideal-gas pressure, gas expansion floor, twin separation — 3e89418
- Frozen-particle fix (phase-volume wall shells → half-grid-cell) — 885ef85
- Per-pair contact conduction support — 21dfa94
- Gas product placement (H2 exists; products stay at interface) — 7382e0b
- Interface-flux reaction extent law (Na: 8 ms blast → 1.73 kg/s sustained,
  exact stoichiometry) — ef2d45e
- Radiative transfer (Kirchhoff emissivity, Stefan-Boltzmann invariant;
  Cs+F ignition-at-range, ~200x the original reaction rate) — 8b38c43
- E2e environment fix (worktree vite fs.allow) — fa3d6fb

## Open
- Task #7 third SS grid level: ON HOLD per user (2026-07-10)
- Cosmetic surface-lane leftovers above
- Watch item: one-time canvas-click race on gate 6116 under CPU load

10. Surface-lane closeout: GGX env prefilter + T^4 sphere emissive parity — 0b0520c
