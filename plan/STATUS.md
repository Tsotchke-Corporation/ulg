# Current status — 2026-11-22 AKST

**Active plan:** Read [`plan/CURRENT-PLAN.md`](CURRENT-PLAN.md) first (single
authoritative routing document).

- **2026-11-22 Four-Track Roadmap Execution (`Tracks A–E` COMPLETE on `feat/multilevel-schroeder-hierarchy`, publication hold strictly maintained — local commits only, no push, no merge to `main`, no `docs/` Pages build):**
  - **Track A (`643789b6`, Audit Hygiene):** Resolved all 12 medium `shell-hardening` findings across `scratch/burst-ab.sh`, `scratch/burst-ab2.sh`, and `scratch/live-rate-ab.sh` (`set -euo pipefail`, `mktemp`, `trap`, atomic `mv`).
  - **Track B (`643789b6`, Phase 6 True `webgpu-derived` Material Resolvers):** Added native WGSL `@workgroup_size(128)` parallel 81-wavelength Drude–Lorentz + spin-orbit interband + Frank–Tamm Cherenkov + CIE 1931/sRGB optical resolver (`src/runtime/material/opticalResolverWebGpu.js`) and native WGSL radial Kohn–Sham Hartree + PBE-GGA XC + density + spin-orbit quadrature solver (`src/runtime/electronicStructure/radialKohnShamWebGpu.js`), wired into `src/runtime/material/materialResolverPipeline.js` (`resolverStatus: 'webgpu-derived'`) and `materialResolverManifest.js` (`validationFlags` strictly `false`). Verified host tests (`14/14`) + native Vulkan `tests/webgpuMaterialResolvers.native.test.mjs` (`0` GPU errors, Cu/Ag/Au/Hg sRGB parity `< 2e-3`, Cherenkov parity `< 1e-3`, He/O/Au PBE+SO energy parity `< 5e-3`).
  - **Track C1 (`e5ec7a56`, Live SPH Studio Relativistic Hg/Br & Phase 8 Nuclear/Cherenkov Bridge):** Created `src/runtime/sph/sphNuclearCherenkovBridge.js` (nucleon-conserving isotope ledger, decay thermal deposition, medium IOR & Compton/beta speed, fail-closed Frank–Tamm Cherenkov closure `scientificValidation: false`), added validated optional `isotope` field (`U-238`, `Co-60`, `Cs-137`, `H-3`) in `sphInitialBodies.js`, wired into `sphPhaseDemo.js`, `ulgSimStudioModel.js` (`STUDIO_CUSTOM_TEMPLATES`: `mercury-water-drop` & `cherenkov-pool` without touching `SPH_PHASE_SCENARIO_PRESETS`), and `ulgSimStudioApp.js`. Verified `37/37` host tests + Wayland Chrome Vulkan visual checks on liquid `Hg` in water (`48` steps, `36.0 states/s`, `0` errors) and `Co-60` Cherenkov pool (`52` steps, `θ=37.4°`, `β=0.944 > 0.750`, nucleon conservation rel error `2.05e-16`, `0` errors).
  - **Track C2 (`66d8caba`, Cosmic ↔ Quantum 38-OOM Demo Upgrades):** Built true WebGPU 3D volumetric orbital raymarcher (`src/demos/volumetricOrbitalRaymarcher.js`, `Data3DTexture` + `three/tsl` front-to-back raymarching for `total-density`, `s`, `p_z`, `d_z2`, `d_xy`, `f_xyz` with honest provenance labels), wired Phase 6 `webgpu-derived` pipeline, CI-NEB `H₂O` linear inversion reaction-coordinate scrubber (`Ea = 3.04 eV`) + Polytope wireframe overlay, live zero-copy WebGPU `1,024`-particle `continuum-micro-sph@1` engine + `residentGpuPresenter.js` `continuum-material` palette (`0 B/frame` readback), and fixed `THREE.Sprite._geometry` disposal safety in `cosmicQuantumZoomDemo.js`. Verified `8/8` host tests + Wayland Chrome visual sweep (`0` console warnings, `0` errors across atomic `total-density`, `d_z2` signed cyan/magenta lobes, molecular CI-NEB saddle, and continuum `Hg` micro-SPH droplet) + native Vulkan `tests/cosmicQuantumZeroCopyAndBarnesHut.native.test.mjs` (`32,768` Barnes–Hut `226.2 ms / 10 steps`, `1,024` zero-copy Continuum Micro-SPH, `webgpu-3d-volumetric-raymarcher`, cross-chart multipole `0` error, `errors: []`).
  - **Track D1 (`c2865424`, Phase 7 Quantitative Bulk DFT & Multi-Reference CAS(2,2) / PUHF):** Created `src/runtime/electronicStructure/periodicBulkDft.js` (Monkhorst–Pack $k$-point Bloch plane-wave pseudopotential bulk DFT solver for `fcc`/`bcc`/`diamond` crystals using KS-derived noble-gas core radii + RPA/Lindhard screening + PBE-GGA XC + exact 3rd-order Birch–Murnaghan EOS fit + G7 advisory NIST/CRC benchmark suite: `16.8%` mean absolute lattice error across `Na, Al, Si, Fe, Cu, Ag, Au, Pb` with zero per-element fitting and honest `scientificValidation: false, g7Advisory: true`). Added full 3-CSF singlet `cas22()` (exact RHF consistency `< 1e-9 Ha`, natural orbital occupations, diradical character) and Yamaguchi spin-projected `puhf()` + broken-symmetry singlet seeding & `<S^2>` reporting in `src/runtime/electronicStructure/molecularHartreeFock.js` (smooth covalent dissociation for `H2`, `F2`, `N2`). Verified `tests/phase7QuantitativeDftAndCas22.test.mjs` (`5/5` PASS).
  - **Track D2 (`2123c088`, Phase 9 Cross-Repo Convergence & Phase 11 Live 3-Browser Distributed Proof):** Created `src/services/crossRepoConvergenceAdapter.js` (verbatim ABI parity with sibling `../eshkols-in-space/integration/ulg.mjs`, 2M-body Barnes–Hut memory budget fail-closed gate, live `../peercompute` contract validator, MoonLab v1.2.0 / ABI 0.6.0 reduced-scope complex64 parity envelope, Eshkol WASM/AD manifest) and `src/services/cosmicQuantumPeerTask.js`, wired `startLiveClientDerivationPeerMesh` into `cosmicQuantumZoomDemo.js`. Verified `tests/crossRepoConvergence.test.mjs` (`3/3` PASS) + real **4-context Playwright distributed proof** `tests/phase11ThreeBrowserDistributed.native.test.mjs` (Requester + 2 Responders + Observer over live TCP WebSocket `localPeerRelayServer`, 2-of-2 quorum derivation of liquid `Hg`, `22` observer envelopes, disconnect fail-closed `ERR_CLIENT_PEER_QUORUM_UNAVAILABLE`, replacement Responder 3 auto-recovery deriving solid `Au`, `errors: []`).
  - **Track E (Full Verification, GPU Probes, Roadmap Target & ICC Reindex):**
    - **Full Host Suite (`node --test --test-concurrency=8 tests/*.test.mjs`):** **`6,162 pass / 0 fail / 0 cancelled`** (`184` opt-in native skips, `6,346` total).
    - **Native Vulkan GPU Matrix (`ULG_RUN_NATIVE_WEBGPU=1 --test-concurrency=1`):** **`4/4` PASS** (`webgpuMaterialResolvers`, `cosmicQuantumGpu`, `cosmicQuantumZeroCopyAndBarnesHut`, `phase11ThreeBrowserDistributed`, `0` GPU/page errors).
    - **Production Build (`npm run build`):** PASS (`4.57 s`).
    - **Official Section 3 GPU Probes (`scripts/gpuprobe.sh`, `CPUQuota=50%`, `S0_RESIDENT_PERF=1`, `exit=0`, `gpuErrors: []`, `page errors: 0`):** `track-e-water-budget` (`608` steps, `20.84 steps/s`, stepping GPU mean `21.7%`, `submits/step 2.13`, `computePasses/step 16.01`, `dispatchIndirect/step 0.77`, `mapAsync/step 0`, `pipelines 0`) and `track-e-iron-budget` (`60` steps, stepping GPU mean `20.4%`, physics dispatches `-20%` (`540.8 → 435.4`), `dispatchIndirect/step 9.87 <= 16`, `createBuffer -43%`, `bindGroups -44%`, `pipelines 0`, with decoupled presentation-only render passes `27.07/step` inflating combined device `submits/step 5.23` under 50% CPU throttling).
    - **New Multiscale Roadmap Target Logged:** Added [`plan/todo/hydrogen-nebula-to-star-fusion-bridge-plan.md`](todo/hydrogen-nebula-to-star-fusion-bridge-plan.md) specifying the first-principles **Hydrogen Nebula → Protostar → Quantum Hydrogen / pp-Chain Fusion → Supernova & Compact Remnants** emergent simulation bridge.

- **2026-11-21 High Sync Rate, Hot-Loop GPU Pooling, Mobile Studio Fix & Pages Release (deployed to `main` & GitHub Pages):**
  - **Adaptive Interactive Visual Sync & Motion Damping:** Added `resolveSphAdaptiveSyncScheduleStepCount()` in `src/visualization/sphPhaseDemoMount.js` (burst-aligned `minSteps = 4`, constant on reactive target-authority lanes) wired automatically in Studio (`src/visualization/ulgSimStudioApp.js`), smooth ease-out shader motion damping (`dampedIsosurfaceShaderMotionAgeS` in `src/services/workerOwnedIsosurfacePresenter.js`), short-schedule mid-batch flush gating (`src/services/ulgOffscreenRender.worker.js`), and persistent lane-record periodic A3/G6 pacing (`src/services/ulgMechanicsResidentStage.worker.js`, protocol-valid `'deferred-capacity'` skip between 16-step ticks).
  - **Multi-Law GPU Throughput & A2 Multi-Family Keying:** Keyed A2 incremental CSR snapshots by `(sourceFamilyId, sortMode)` with multi-arena skip sets in `src/runtime/sph/schroederSpatialEpochGpu.js` (lifting `cesium-fluorine` A2 hit rate from 69% -> **97.8%** and holding `iron-ice-quench`/`water-cycle`/`sodium-water` at **98.8%–99.7%**); pooled hot-loop real-GPU buffers & cached bind groups across `sphThermalGpuKernel.js`, `sphMechanicsRefreshGpuKernel.js`, `sphPhaseCarrierTransferGpu.js`, `sphDispersedMediumOpticsProducerGpu.js`, `sphGridUpdateGpuKernel.js`, `schroederHierarchyGpu.js`, `sphPostMechanicsGasStateGpu.js`, and `nativeSurfaceTemperatureWgsl.js`.
  - **Mobile Studio Rendering Fix:** Fixed collapsed/invisible mobile modal tabs in `src/visualization/ulgSimStudioStyles.css` (`flex: 0 0 auto` + `overflow-y: hidden` on `.ulg-modal-tabs`/header/footer, `min-height: 0` on `.ulg-modal-body`, hidden touch scrollbars, `100dvh`, `viewport-fit=cover` in `index.html`, safe-area insets, HUD collision truncation, `16px` mobile inputs, single-column mobile grids). Verified visually across `390×844`, `360×740`, and `844×390` (`0` errors).
  - **Live WebGPU Verification (`0` page/console/GPU errors):** `sodium-water` real sync `0.17 -> 6.32 Hz` (**37.2×**) and throughput `10.6 -> 25.3 steps/s` (**+139%**); `iron-ice-quench` `2.00 -> 7.27 Hz` (`29.1 steps/s`, `1.84 submits/step`); `water-cycle` `3.32 -> 10.48 Hz` (`41.9 steps/s`); `water-realtime` `7.64 -> 22.14 Hz` (`88.6 steps/s`, `1.83 submits/step`); `cesium-fluorine` `2.32 Hz` (`9.3 steps/s`, 97.8% A2). Official `gpuprobe.sh` Section 3 gates (`sync-water-budget`, `sync-iron-budget`) exit `0`, `gpuErrors: []`, `xid: []`; `1,172/1,172` affected host tests pass; updated `README.md` documenting Eshkol & Moonlab Triad integration; built & verified GitHub Pages (`docs/`).

- **2026-11-21 Architecture Completion & Release Sprint (`M1`–`M7` COMPLETE, GitHub Pages built, merged to `main` and pushed):**
  - **M1 (`37f2c9b3`, General Arbitrary Periodic-Table Element Pairings & Reaction Energy Authority):** Enforced strict f32 Debye thermal graph monotonicity in `sphThermalGpuKernel.js`, case-deduplicated material keys in `sphPhaseDemo.js`, lifted ideal-gas mixture formation enthalpy and fractional atom balance in `sphReferenceReactionTable.js` / `sphReactionEnergyAuthority.js`, and generalized binary covalent synthesis with N≡N triple-bond gating in `reactionCandidates.js`. Verified 48/48 periodic-table probe (24 vacuum + 24 humid room air), `tests/periodicTablePairingsAdmission.test.mjs`, and live Wayland Chrome visual checks on `C+O` and `K+Br` in room air (`0` errors).
  - **M2 (`7d930f05`, A2 Live GPU Incremental Spatial CSR Migration on V2 ActiveSource & GPU-Authored Counts):** Extended `schroederIncrementalSpatialMigrationGpu.js` (`detect_departed_members`, 8 storage buffers `<= 8` WebGPU minimum, 17 single-pass dispatches, V2 `active_source_view` admission + plus-one reverse encoding, V1 GPU-authored `logicalSourceCountAuthority` buffer copy, per-target-arena params buffers & cached bind groups) and enabled live V1/V2 incremental migration in `schroederSpatialEpochGpu.js`. Verified native Vulkan `tests/schroederIncrementalSpatialMigration.native.test.mjs` (`11.7×` speedup at `N = 103,831`, bit-exact V1/V1-GPU-count/V2 births/deaths/level-jumps).
  - **M3 (`8e74fba0`, A1 Multi-Law Hot-Path Pooling & 60 Hz Participating-Medium Advection):** Added `createCachedExplicitBindGroup` + zero-allocation `bindingSignature` in `webgpuComputeLayout.js`, wired cached bind groups across MLS-MPM/thermal/mechanics/phase/reaction kernels, pooled transient MLS-MPM buffers (`sphMlsMpmGpuStep.js`), hoisted SHA-256 scratch & zero-allocation checks (`schroederAuthorityFingerprint.js`, `schroederTargetScheduleAuthority.js`), and added 60 Hz GPU semi-Lagrangian velocity-field plume advection in `sphParticipatingMediumGpu.js` + `workerOwnedIsosurfacePresenter.js`.
  - **M4 (`df958f32`, A3 G4-Cell Thermal/Phase Regional Closures & A4 6-Closure 2-D Gas Response Tables):** Added GPU-resident A3 G4-cell thermal/phase regional closure lane (`sphThermalRegionalClosureGpu.js`, 8 spatial octants with strict `(phaseId, materialId)` regime gating and Stefan-Boltzmann `(T/300)^4` fitting/lookup under G5 `ReservationLedger` CAS in 1 schedule-boundary pass) wired into `ulgMechanicsResidentStage.worker.js` and `sphPhaseScene.js`. Expanded A4 2-D `(T, P)` Chebyshev response functions (`gasResponseFunctions.js`) from 2 to 6 closures per gas-capable material (`density`, `soundSpeed`, `dynamicViscosity`, `thermalConductivity`, `acousticImpedance`, `volumetricHeatCapacity`) with enforced partial-derivative signs, `<= 1e-5` held-out residual bounds, strict in-box `rf_eval`, and live GPU table upload. Verified native Vulkan `gasResponseFunctions.native.test.mjs` and `regionalClosureSamplerGpu.native.test.mjs` (`0` violations).
  - **M5 (`ccf4cbae`, A5 Simulation Studio SOL-4/5/6 Exposure & 2-Level First-Class Air Enrollment):** Exposed per-body Mechanics Carrier (`auto` / `rigid` / `deformable` / `continuum`), Cohesive Fracture & Refreeze (`SOL-5`), Multilevel Solid Proxies (`SOL-6`), strictly 2-level First-Class Air (`airTwoLevel=1`, `L0/L1` with acoustic CFL timestep and implicit-atmosphere stand-in retired), and live A2–A6 Diagnostics across `ulgSimStudioModel.js`, `ulgSimStudioApp.js`, `sphPhaseDemoMount.js`, `sphPhaseDemo.js`, and `schroederSolidRigidLane.js`. Eliminated duplicate solid metaballs on explicit SOL-4 deformable carriers (`workerOwnedIsosurfacePresenter.js`) and closed four two-level exact-energy-ledger room-air lifecycle gaps across `sphSpatialGasLedgerEosGpu.js`, `schroederCrossLevelCouplingGpu.js`, `sphGpuBuffers.js`, `sphMlsMpmPostMechanicsClosure.js`, and `schroederHierarchyGpu.js`. Verified native Vulkan SOL-4/5/6 suites (`3/3` PASS) and Wayland Chrome checks on SOL-4 deformable Cu (`80` steps, `sol4Steps=80`, watertight mesh) and 2-level First-Class Air (`16` steps, `a2: 79 incremental hits`, `a3Thermal: 4`, `a4: 72 GPU fns`, `0` errors).
  - **M6 (`aae7b4b2`, A6 Cross-Machine PeerCompute Network Transport):** Factored clean derivation peer transports in `src/services/clientDerivationPeers.js` (`createBroadcastChannelTransport`, `createRelaySignalingTransport` with WebSocket signaling + automatic WebRTC `RTCDataChannel` P2P upgrade + signaling fallback, `createPeerComputeNetworkManagerTransport`, `createHybridDerivationTransport`), added strict `requireRemotePeer` fail-closed debt enforcement in `warmClosureMissBridge.js`, and wired `peerRelay`/`peerRoom` configuration & diagnostics in Studio/Scene/Mount. Verified `25/25` host tests (WebRTC DataChannel 2-of-2 quorum, `ERR_CLIENT_PEER_ABSENT` replica promotion, fail-closed `remoteDebt` + rejoin recovery, PeerCompute `NetworkManager` quorum + handler cleanup) and `2/2` native browser A6 suites (`a6ClientDerivation.native.test.mjs`, `a6RemoteClosureMissBridge.native.test.mjs`, `gpuErrors: []`).
  - **M7 (`98b5c137`, Full Verification, Section 3 GPU Budgets, Wayland Visual Matrix & Pages Release):**
    - Pre-allocated A2 incremental scratch/atomics/per-arena params buffers at spatial runtime creation, guarded `preferredSkipArena` by `incrementalPlanSkipReason(plan)` on lane Reset, and keyed cached `TextEncoder` by constructor identity.
    - **Full Host Test Suite:** `node --test --test-concurrency=8 tests/*.test.mjs` — **6,063 pass / 0 fail / 0 cancelled** (168 opt-in native skips, 6,231 total).
    - **Section 3 GPU Budget Probes (`scripts/gpuprobe.sh`, `CPUQuota=50%`, `errors: []`, `gpuErrors: []`):**
      - `final-iron-budget` (`96` steps, `5.65 steps/s`, stepping GPU mean `12.9%`): **`submits/step 1.97` (`<=2`)**, **`computePasses/step 24.79` (`<=25`)**, **`dispatchIndirect/step 8.88` (`<=16`)**, `mapAsync/step 0.14`, `pipelines 0`.
      - `final-water-budget` (`1,232` steps, `76.99 steps/s`, stepping GPU mean `26.5%`): **`submits/step 0.59` (`<=2`)**, **`computePasses/step 10.65` (`<=25`)**, **`dispatchIndirect/step 0.19` (`<=16`)**, `mapAsync/step 0`, `pipelines 0`.
    - **Sequential Wayland Desktop Chrome Visual Matrix (all 8 PNGs visually inspected, `pageErrors: []`, `consoleErrors: []`):** `studio-empty` (zero-allocation landing, Play/Step hidden), `iron-ice-paused` (`t=0.001s`, `1` step, Play/Step shown only when visual-ready), `iron-ice-playing` (`177` steps, `a2: 352/354 = 99.4%` incremental, `a3Thermal: 12`, `a4: 5×6`, `a5: SOL-5+SOL-6`, `a6: adopted 1`), `studio-display-a6` (Display tab + A6 WebRTC/Relay UI), `sodium-water` (`256` steps, `a2: 504/512 = 98.4%`, `a4: 7×6`, `a6: adopted 1`), `water-cycle` (`176` steps, `a2: 350/352 = 99.4%`, `a3Thermal: 11`, `a6: adopted 1`), `water-realtime` (`288` steps, `t=2.304s`, `a3: 18`, `a3Thermal: 18`), `cesium-fluorine` (`32` steps, `a2: 159` incremental hits on 2-level SS, `a4: 7×6`, `a6: adopted 1`).
    - **GitHub Pages Build & Release:** `npm run build && npm run build:pages` (incl. `scripts/verify-pages-build.mjs`) PASS; merged `feat/arch-sprint-live-wiring` into `main`, pushed `origin main`, and completed full ICC reindex.

- **2026-11-21 Architecture Live-Wiring Sprint (`Arch-1`–`Arch-7` COMPLETE on `feat/arch-sprint-live-wiring`, publication hold maintained):**
  - **Arch-1 (`8b91854e`, Physical Reaction Energy Authority & Balanced `2 H2 + O2 -> 2 H2O`):** Updated `hydrogenOxygenReaction()` in `src/runtime/sph/reactionDiscovery.js` with exact balanced NIST-JANAF stoichiometry (`-571,660 J/mol-extent`, `targetPhase: 'liquid'`), added case-insensitive lookup and non-circular initial term inspection in `src/runtime/sph/sphReferenceReactionTable.js`, and automatically promoted multi-phase condensable caloric products to `buildSphReferenceReactionTable` (`sphReactionEnergyAuthority`) in `src/runtime/sph/sphStaticTableInputs.js`. Eliminated the 19% initialization block on custom `H + O` in humid room air (`83/83` host tests PASS).
  - **Arch-2 (`27efdd47`, A2 Live Incremental Spatial CSR Migration):** Exported target-arena 1-pass encoder `createSchroederIncrementalSpatialMigrationEncoder` in `src/runtime/sph/schroederIncrementalSpatialMigrationGpu.js`, registered it via zero-circularity factory registration from `src/runtime/sph/schroederHierarchyGpu.js` into `src/runtime/sph/schroederSpatialEpochGpu.js` across immutable arena rings (`arenaCount >= 2`) with fail-closed fallback and `lastSkipReason` diagnostics. Verified `120/120` host tests + native Vulkan `tests/schroederIncrementalSpatialMigration.native.test.mjs` (`12.69×` speedup at `N = 103,831` carriers, `0.267 ms` vs `3.383 ms`, `diffs: []`).
  - **Arch-3 & Arch-4 (`e18e0d7d`, A3 Live GPU Regional Closure Lane & A4 2-D Gas Response Functions):** Coalesced `regionalClosureSamplerGpu.js` (`encodeRegionalClosureEvaluate`) into 1 compute pass, wired `createRegionalClosureWorkerLane` + GPU member packing + schedule-boundary G5 CAS adoption directly into `src/runtime/sph/sphImplicitPressureGpu.js` & `src/runtime/sph/sphMlsMpmGpuStep.js`, created `src/runtime/material/gasResponseFunctions.js` (strict in-box 2-D Chebyshev `density(T, P)` and `soundSpeed(T, P)` with physical partial-derivative signs and zero extrapolation), wired clone-safe packing & GPU table upload into `src/runtime/sph/sphMechanicsMaterialTable.js` & `src/runtime/sph/sphMechanicsRefreshGpuKernel.js`, and propagated compact worker `architectureStatus` back to `scene.userData` via `src/services/ulgMechanicsResidentStage.worker.js` & `src/visualization/sphPhaseScene.js`. Verified `26/26` host tests + native Vulkan `regionalClosureSamplerGpu.native.test.mjs`, `sphImplicitPressureGpu.native.test.mjs`, and new `gasResponseFunctions.native.test.mjs` (`validation: null`, GPU matches CPU to `<1e-5`, out-of-box `ok = 0`).
  - **Arch-5 (`0f915699`, A5 Live Wiring of SOL-4 / SOL-5 / SOL-6 Solids):** Wired SOL-5 cohesive fracture/topology (`schroederSolidFractureGpu.js`) and SOL-6 multilevel 2:1 surface proxies & double-float chart origins (`schroederSolidMultilevelGpu.js`) into the single shared compute pass of `src/runtime/sph/schroederSolidRigidLane.js` (`0` extra passes); admitted `mechanicsMode: 'deformable'` in `src/runtime/sphInitialBodies.js`, built offset-aware explicit material-space deformable surface carriers (`schroederSolidDeformableShapeGpu.js`) in `src/runtime/sphPhaseDemo.js` → `sphGpuBuffers.js` → `sphMlsMpmGpuStep.js` → `src/services/workerOwnedIsosurfacePresenter.js`. Verified `48/48` host solid tests + all 5 native Vulkan SOL-0/3/4/5/6 suites (`0` GPU errors).
  - **Arch-6 (`cfebda27`, A6 Live PeerCompute Derivation Peer Mesh & Cold-Start HF Fix):** Added `startLiveClientDerivationPeerMesh` (`BroadcastChannel` PeerCompute `NodeKernel` responder + automatic 2-of-2 quorum requester when sibling tabs exist, solo local warm-worker fallback) in `src/services/clientDerivationPeers.js`, wired into `src/visualization/sphPhaseScene.js` with clean teardown; made `regionalClosureWorkerLane.js` HMR-safe via `Symbol.for`; capped synchronous pure-JS STO-3G RHF/UHF at `<= 24` basis functions in `src/runtime/material/materialDerivation.js` & `src/runtime/sph/reactionDiscovery.js` (routing 4-atom Period-3 clusters like `AlCl3` to the fast all-element tight-binding solver, cutting `Al + Cl` cold discovery **49.5 s → 1.1 s**, **45× faster**). Verified `a6LiveMeshAndColdStart.test.mjs` + all 3 native browser A6 tests (`a6WarmClosureMissBridge`, `a6RemoteClosureMissBridge`, `a6ClientDerivation` — `3/3` PASS).
  - **Arch-7 (Full Verification, Section 3 GPU Budgets & Wayland Desktop Visual Matrix):**
    - Updated `scripts/step0-baseline-probe.mjs` to launch via the Studio `?preset=<scenario>&autoplay=1` URL and `#ulg-play-btn`.
    - **Section 3 GPU Budget Gates (`scripts/gpuprobe.sh`, `CPUQuota=50%`, `gpuErrors: []`, `errors: []`):**
      - `iron-ice-quench` (`128` steps, `7.27 steps/s`): **`submits/step 1.55` (`<=2`)**, **`computePasses/step 23.17` (`<=25`)**, **`dispatchIndirect/step 8.50` (`<=16`)**, `mapAsync/step 0.13`, `pipelines 0`.
      - `water-realtime` (`912` steps, `53.63 steps/s`, live A3 regional closure lane): **`submits/step 0.41` (`<=2`)**, **`computePasses/step 10.86` (`<=25`)**, **`dispatchIndirect/step 0.20` (`<=16`)**, `mapAsync/step 0`, `pipelines 0`.
    - **Sequential Wayland Desktop Chrome Visual Matrix (all 7 PNGs visually inspected, `0` page/console/HTTP errors):** `studio-empty` (zero-allocation landing), custom `H + O` in humid room air (`t = 0.016 → 0.080 s`, `160` steps, `a4: 10 materials / 20 fns GPU`, `a6Bridge: adopted 1`, `a6PeerMesh: active`), `iron-ice-quench` (`t = 0.032 → 0.160 s`, `320` steps, `a5: SOL-5+SOL-6 active`), `sodium-water` (`t = 0.128 → 0.256 s`, `256` steps), `water-realtime` (`t = 0.512 → 4.096 s`, `512` steps, `a3: 32 schedules evaluated & adopted`), `cesium-fluorine` (`t = 0.003 → 0.010 s`, `48` steps), `water-cycle` (`t = 0.032 → 0.152 s`, `304` steps).
    - **Full Host Suite & Build:** `node --test --test-concurrency=8 tests/*.test.mjs` — **6,053 pass / 0 fail** (167 opt-in native skips, 6,220 total); `npm run build` PASS. Publication hold maintained (local commits on `feat/arch-sprint-live-wiring` only; no push, no merge to `main`, no Pages rebuild).

- **2026-11-20 Architectural G+A Campaign Continuation (Arch Milestones M1–M6 COMPLETE on `feat/ulg-ga-consolidation`, publication hold maintained):**
  - **Arch M1 (`6369f25e`, G4 Live Hot-Loop Phase & Radiation Dormancy Wiring):** Wired live GPU phase-change and radiative envelope dormancy (`schroederPhaseRadiationDormancyGpu.js`) directly into the canonical hot step loops (`sphMlsMpmPostMechanicsClosure.js` / `schroederHierarchyGpu.js` / `lawActivationReceiptRing.js`) and gated preset `<select>` readiness until mount listeners bind in `sphPhaseDemoMount.js`, resolving transient boot race on `cesium-fluorine`.
  - **Arch M2 (`a4100f24`, A1 100k+ Real-Time Bulk Substrate & >60 Hz Presentation):** Optimized `sphImplicitPressureGpu.js` (RED.E.ADD + `2×2×2` super-cell spatial sorting, `3.28 ms/step` across `2,518` steps) and QoS temporal presentation continuity in `ulgOffscreenRender.worker.js`. Verified on Wayland desktop Chrome (`/home/cos/.cache/icc/repos/ulg/arch-m2-a1-100k/desktop-sweep/a1-desktop-matrix.json`): **`103,831` live carriers** on `water-realtime-100k` sustain **`1.433×` real-time** (`127.1` physics steps/s, **`89.2` presented states/s**, **`118.17 Hz`** UI rAF, `maxGap 25.1 ms`, `0` errors); `bulk-water-100k` sustains `190.9` physics steps/s and `116.36 Hz` UI rAF; all 6 default presets verified alongside.
  - **Arch M3 (`5638d336`, A2 Single-Pass GPU Incremental Spatial CSR Migration):** Added `src/runtime/sph/schroederIncrementalSpatialMigrationGpu.js` (`16` dispatches in `1` compute pass, `7 <= 8` storage bindings) maintaining bit-identical `SCHROEDER_SPATIAL_EPOCH_DIRECTORY_ABI` v1 CSR directories across immutable arena rings (`arenaCount >= 2`) with Euclidean displacement (`||dx||/h <= margin`) and $L_\infty \le 1$ cell-jump certificates, GPU `STATUS_FAIL_CLOSED` + `[0,0,0]` consumer dispatch sealing, and automatic fallback rebuild (`stepWithTrustedFallback`). Verified on Vulkan (`tests/schroederIncrementalSpatialMigration.native.test.mjs`): `diffs: []` bit-exact equivalence across 0%–45% churn, capacity changes, and adversarial 12-cell jumps; **`9.43×–9.67×` faster** than full `u32x5` radix (`2.08×–2.13×` faster than bounded-atlas radix) at `N = 103,831` carriers (`0.325–0.333 ms` vs `3.142 ms` / `0.692 ms`).
  - **Arch M4 (`2f96484b`, G2 Conserved Rising Steam/Reaction Plumes & `2^-149` Rigid-Melt Audit):** Extended `scripts/step0-baseline-probe.mjs` and `scripts/g2-ledger-audit.mjs` (`plan/todo/g2-integer-ledger-proposal.md`) to audit rigid-solid melt release in the 9-limb `2^-149` exact mass and `Σ(U − S)` ledgers. Verified live (`/home/cos/.cache/icc/repos/ulg/arch-m4-g2/`): `sodium-water` (`448` steps, `massExact: true`, `energyBudgetExact: true`, `+275,129.48 J`, `68.38 g NaOH`, `1.72 g H2`, `414` deliveries across `23` generations, `untracedDeliveries: 0`) and `iron-ice-quench` (`512` steps, `massExact: true`, `energyBudgetExact: true`, `32` melted rigid ice members, `3.49 g` steam, `72` condensate parcels), plus 4-checkpoint Wayland desktop Chrome visual sequences (`g2-desktop-sequences.json`, 8 PNGs inspected).
  - **Arch M5 (`a3543569`, A5 Deformable Surfaces SOL-4, Cohesive Fracture/Refreeze SOL-5 & Multilevel/Orbital Coupling SOL-6):** Added `schroederSolidDeformableShapeGpu.js` (8-neighbor partition-of-unity material-space closed surface carrier advected from `MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT` `F00..F22` + fixed-corotated/von Mises elasto-plastic MLS-MPM + buoyancy), `schroederSolidFractureGpu.js` (cohesive bond cleavage + Griffith energy + parallel pointer-jumping connected components + conservative multi-body Jacobi split & supercooled liquid->solid refreeze), and `schroederSolidMultilevelGpu.js` (single-owner `L=0/1/2` 2:1 surface proxy quadtree + `1.25e6 m` double-float chart rebasing + symplectic two-body orbit with zero-kick `12×12` local planetary tangent patch). Verified on Vulkan (`schroederSolidDeformableShape.native.test.mjs`, `schroederSolidFracture.native.test.mjs`, `schroederSolidMultilevel.native.test.mjs`, `schroederSpatialLevelChain.native.test.mjs` across `2/3/4/6` SS levels, and all 4 G3/SOL-2/3 native gates) + Wayland desktop WebGPU PNGs (`/home/cos/.cache/icc/repos/ulg/arch-m5-a5/`).
  - **Arch M6 (`77d51ae5`, A6 Multi-Peer PeerCompute Remote Warm Closure Derivation):** Upgraded `warmClosureMissBridge.js` (`v2`), `clientDerivationPeers.js`, `clientWarmDerivationTask.js` (HMR-safe singleton worker state), and `sphPhaseScene.js` so live ULG Eshkol-AD EOS stiffness misses and MoonLab WebGPU GHZ probes execute across multi-page `BroadcastChannel` PeerCompute `NodeKernel` responders with 2-of-2 quorum validation, `ERR_CLIENT_PEER_ABSENT` replica promotion, `cancelMiss` + `sourceChanged` epoch fencing, and explicit `remoteDebt` on total responder outage (zero silent CPU hot-state fallback) clearing on responder rejoin (`tests/a6RemoteClosureMissBridge.native.test.mjs`, `tests/a6ClientDerivation.native.test.mjs`, `tests/a6WarmClosureMissBridge.native.test.mjs` — `6/6` PASS).

- **2026-11-20 Slice 3.1 (G1 Decoupled Presentation Reassessment & Final Release Audit — ALL PHASES 1–3 COMPLETE on `feat/ulg-ga-consolidation`, publication hold maintained):**
  - Resolved five live-preset and full-suite issues uncovered during the 6-preset desktop sweep and 6,184-test audit:
    1. Threaded `reactionsRequested` (`lawr=1`) from `src/visualization/sphPhaseDemoMount.js` into `src/runtime/sphPhaseDemo.js` so authoritative dynamic reaction activation (initial `physicalLawGroups.reactions === false` at `t = 0`) still screens reactive solids (`Na`, `Cs`) onto the continuum chemistry lane while admitting cold inert ice (`Fe/H2O`) to the coherent rigid lane.
    2. Added `resolveDiscoveredProductTermsWithPhasePolicy()` in `src/runtime/sph/reactionDiscovery.js` so multi-phase bank-anchored products (`FeO`, `NaOH`, `CsF`, oxides) emit their standard-state / 298.15 K `targetPhase`, eliminating `status: 254 (missingProductPhasePolicy)` and unlocking live exothermic ignition on `sodium-water` and `cesium-fluorine` plus NIST-JANAF `FeO(solid)` reference compilation (`Fe-018.html`).
    3. Eliminated ~970 redundant synchronous Vulkan pipeline compiles per 10 s on two-level `cesium-fluorine` CFL rollbacks by unwrapping `createBufferTrackingDevice`'s ephemeral `Proxy` via `Symbol.for('ulg.webgpu.rawDevice')` in `src/runtime/webgpuComputeLayout.js` and adding per-`GPUDevice` `WeakMap` pipeline caches in `src/runtime/sph/schroederSpatialMechanicsFieldPairGpu.js` (17 pipelines) and `src/runtime/webgpuRadixScanUnique.js` (`createRadixGpuCountPipelines`, 10 pipelines × 4 arenas), cutting `cesium-fluorine` max frame gap **2,483 ms → 34.9 ms** (**71×**) and lifting UI rAF **12.99 Hz → 60.75 Hz**.
    4. Promoted Slice 1.2's `contactCleanupPasses: '16'` / `contactInnerRounds: '1'` into `COMMON_RUNTIME` and set `sdt: '0.0002'` on `cesium-fluorine` in `src/runtime/sphPhaseScenarioPresets.js` so real 3-phase `CsF` boiling expansion stays inside the 8-child adaptive two-level reflux budget.
    5. Fixed `reactionLedgerMode` in `src/runtime/sph/sphMlsMpmPostMechanicsClosure.js` to exclude explicit `reactionTable.energyAuthority` tables (matching `sphReactionGpuKernel.js`), restored `stateDeltaMergeAdmission` consumer-gating in `src/runtime/sph/schroederHierarchyGpu.js`, and aligned catch ordering in `src/visualization/sphPhaseScene.js`.
  - **Sequential Real-Desktop Chrome G1 Sweep (all 6 configured presets, zero opt-in flags, all 6 PNGs visually inspected under `~/.cache/icc/repos/ulg/slice3-1-g1-visual/`):**
    - `water-cycle`: **60.14 Hz** measured UI rAF (HUD 59.6 Hz, maxGap 24.6 ms), 63.6 steps/s (`sim t 0.016→0.176 s`), G6 hits 51,072, A6 adopted 1, Pause/Cam/Reset PASS, 0 errors.
    - `iron-ice-quench`: **60.31 Hz** measured UI rAF (HUD 58.8 Hz, maxGap 19.8 ms), 31.9 steps/s (`sim t 0.016→0.136 s`), sharp Z-buffered rigid ice under glowing molten iron cap, G6 hits 47,787, A6 adopted 1, Pause/Cam/Reset PASS, 0 errors.
    - `sodium-water`: **59.77 Hz** measured UI rAF (HUD 60.8 Hz, maxGap 58.3 ms), 63.8 steps/s (`sim t 0.128→0.320 s`), live glowing exothermic Na–H2O ignition band, G6 hits 49,390, A6 adopted 1, Pause/Cam/Reset PASS, 0 errors.
    - `cesium-fluorine`: **60.75 Hz** measured UI rAF (HUD 58.8 Hz, maxGap 34.9 ms), 15.9 steps/s (`sim t 0.016→0.029 s`), live glowing exothermic CsF ignition front on two-level SS, G6 hits 6,671, A6 adopted 1, Pause/Cam/Reset PASS, 0 errors.
    - `bulk-water`: **57.96 Hz** measured UI rAF (HUD 57.5 Hz, maxGap 18.6 ms), 126.8 steps/s (`sim t 0.128→0.768 s`), 32,776-particle collapsing water dam-break, Pause/Cam/Reset PASS, 0 errors.
    - `water-realtime`: **57.91 Hz** measured UI rAF (HUD 57.6 Hz, maxGap 18.8 ms), 127.1 steps/s (`sim t 1.024→8.192 s`, **1.19× real-time**), 36,864-particle dam-break splash, Pause/Cam/Reset PASS, 0 errors.
  - **Full Host Suite & Build:** `node --test --test-concurrency=8 tests/*.test.mjs` — **6,024 pass / 0 fail** (160 opt-in native skips, 6,184 total); `npm run build` PASS in 3.16 s. Publication hold respected (local commits on `feat/ulg-ga-consolidation` only; no push, no merge to `main`, no Pages build).

- **2026-11-19 Slice 2.4 (A6 — Warm Browser WASM/WebGPU Eshkol & MoonLab Workers Wired to Live Misses — Phase 2 Complete):**
  - Hardened `src/services/clientWarmDerivationTask.js` with per-service FIFO request serialization (preventing stdout interleaving), full listener/timer cleanup, bounded timeouts, and automatic termination + respawn recovery counters (`terminateWarmWorker`, `getWarmDerivationResidency`).
  - Hardened `public/workers/eshkol-warm-vm.worker.js` fail-closed parsing: rejected unbalanced/truncated S-expressions (`assertBalancedSexp`), expanded error-line detection, and tightened `lastNumber` so empty lines (`Number("") === 0`) or prose lines never silently masquerade as numeric closure samples.
  - Updated `src/runtime/material/regionalClosureWorkerLane.js` to use PeerCompute `ReservationLedger`'s real CAS `reserve/attach/commit/cancel/retire` API, and created `src/runtime/material/warmClosureMissBridge.js` (`createWarmClosureMissBridge`) connecting non-blocking Eshkol-AD EOS stiffness misses and MoonLab WebGPU quantum probes over G5 CAS `ReservationLedger` slots with deduplication, capacity deferral, failure cancellation + retry recovery, and schedule-boundary adoption into `regionalClosureWorkerLane` + `updateSphImplicitPressureStiffnessTable`.
  - Wired `createWarmClosureMissBridge` into `src/visualization/sphPhaseScene.js` at the worker schedule boundary (with clean teardown and `scene.userData.sphA6ClosureBridgeStatus` / `globalThis.__ulgA6ClosureBridgeStatus` telemetry).
  - Verified: 5/5 host tests (`tests/warmClosureMissBridge.test.mjs`, `tests/regionalClosureWorkerLane.test.mjs`) + `npm run build` (2.15s) PASS; real-browser native test `ULG_RUN_NATIVE_A6=1 node --test tests/a6WarmClosureMissBridge.native.test.mjs` PASS (Eshkol warm reuse `spawns: 1, loads: 1, calls: 2`, AD cross-check `<= 3.59e-16`, `implicitPressureUpdates: 3`; MoonLab WebGPU warm reuse `spawns: 1, loads: 1, calls: 2, nativeAccelerated: 1, probSum: 0.99999994`; malformed expression rejected cleanly + crash/termination recovery `spawnsAfterCrash: 2, recoveries: 1, finalLedgerActive: 0`, 0 page/GPU errors); live default scene check (`iron-ice-quench` & `water-realtime`) proved live Slice 1.5 `no-valid-fit` envelope miss triggering warm Eshkol WASM+WebGPU derivation (`277.8 ms` incl. `204.4 ms` cold VM load, G5 `reserved: 1, committed: 1, retired: 1`, schedule-boundary `adopted: 1`, subsequent `cacheHits: 1`, `fallback: null`, 0 page errors).

- **2026-11-19 Slice 2.3 (G4 — Compacted Per-Node Dynamic Law Activation Across All 4 Law Families):**
  - Extended `src/runtime/sph/schroederThermalDormancyGpu.js` and `src/runtime/sph/schroederReactionDormancyGpu.js` to emit compacted `activeIndicesBuffer` and GPU `indirectDispatchBuffer` (`[ceil(active/64), 1, 1, active]`, yielding `[0, 1, 1, 0]` zero-work witness when quiescent), coalesced each into a single WebGPU compute pass, and added optional per-source G6/A4 temperature uncertainty (`T + dT`) to reaction dormancy.
  - Created `src/runtime/sph/schroederPhaseRadiationDormancyGpu.js` implementing single-pass GPU phase-change dormancy (uncertainty-padded `[T - dT - ε, T + dT + ε]` vs material melt/boil windows + coexistence guard) and global+wall radiative envelope dormancy (using factored `diff_pow4(a, b) = |a - b| (a + b) (a^2 + b^2)` with exact `d == 0` guard to avoid f32 catastrophic cancellation and Vulkan/PTX FMA contraction), each emitting compacted `activeIndicesBuffer` and `indirectDispatchBuffer`.
  - Extended `src/runtime/sph/lawActivationReceiptRing.js` to record all 4 law families (`thermal`, `reaction`, `phase`, `radiation`) and exposed `activeIndicesBuffer` / `indirectDispatchBuffer` on `schroederSpatialThermalProposalsGpu.js` and `schroederSpatialReactionDiscoveryProposalGpu.js`.
  - Verified: all G4 host tests (`lawActivationReceiptRing.test.mjs`, `schroederSpatialThermalProposalsGpu.test.mjs`, `schroederSpatialReactionDiscoveryProposalGpu.test.mjs`) + `npm run build` PASS; native Vulkan `tests/schroederThermalDormancy.native.test.mjs` (D1–D4) PASS; new native Vulkan `tests/schroederG4DynamicLawActivation.native.test.mjs` PASS across all 4 gates: literal zero-work witness (`indirect == [0, 1, 1, 0]`, `0` executed GPU threads via `dispatchWorkgroupsIndirect` across all 4 laws + `zeroWorkSteps: 1, exact: true` in receipt ring), GPU A/B bit-identity at `ε = 0` (`mismatches: 0`, `10.7×`–`32×` thread reductions), conservative G6/A4 uncertainty activation, and 5 periodic-table element-pair spot checks (`Na+Cl`, `Cu+Ag`, `Li+F`, `Fe+Ni`, `K+Br`) derived from live `elementMaterialClosure` + `discoverReactions`; live Section 3 probe (`slice2-3-iron-budget`, `CPUQuota=50%`) passed (`submits/step 1.76`, `computePasses/step 23.52`, `dispatchIndirect/step 9.49`, `gpuErrors: []`).

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
