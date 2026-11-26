# Mesoscale Continuum Lab (`index.html` / MLS-MPM Studio) Performance & Physics Overhaul

> **Status:** Active Priority #2 (`plan/todo/` — hardened 2026-11-25 against live code audit).
> **Origin:** Consolidates user requests from `step 7598` (water clumping like gnocchi + heavy solids failing to sink), `step 7618` (water refracting objects in front of it instead of only inside/behind it), and `step 19124` (revisit MLS-MPM lab to dramatically improve real-world interactive speed & functionality).
> **Invariants:** Preserves Star Spec v0.4 (zero material/preset hacks, GPU-native, 9-limb `2^-149` exact ledgers), Gate 3 Section 3 hard GPU budgets (`<= 2` submits/step, `<= 16` indirect/step, `0` per-step host waits, `<= 25` active passes, `water-realtime >= 1.0x RT`), Gate 4 decoupled `>= 54 Hz` presentation, and Gate 6 zero private 4,096-bucket hashes.

---

## 1. Water Refraction Foreground-Occlusion Fix (`nativeRefractionTransportWgsl.js`, `nativeSurfaceMaterialWgsl.js`, `sphPhaseScene.js`)

### Root Causes Verified in Live Code
1. **Hyperbolic perspective NDC depth vs fixed `epsilon = 1.0e-4` (`nativeSurfaceMaterialWgsl.js:237-265`, `nativeRefractionTransportWgsl.js:262-317`):**
   - Camera uses `PerspectiveCamera(46, aspect, 0.05, 500)` (`sphPhaseScene.js:1087`, `|dd/dz| = near / z^2`). Comparing raw `[0, 1]` NDC depth against `1.0e-4` accepts foreground objects **2–45 cm IN FRONT OF water** at `z = 3..15 m` (missed by existing ortho identity-VP test).
   - `refraction_rear_surface_admitted` (`nativeRefractionTransportWgsl.js:147`) rejects thin valid water sheets `< 2 cm` at `z = 10 m` using fixed `1.0e-5` NDC threshold.
2. **Page-native wireframe ordering & missing Z-remap (`sphPhaseScene.js:10968-10972, 10998, 19872, 12564`):**
   - Wireframe shader skips `clip.z = clip.z * 0.5 + clip.w * 0.5`, draws with `depthWriteEnabled: false` *before* `scene_color_copy`, and validation depth texture omits `COPY_SRC`.
3. **3× redundant identical RGB refraction lookups (`nativeSurfaceMaterialWgsl.js:606-629, 760-764`):** Scalar `refractive_index` executes `refracted_path_to_back_plane` + depth-rejected sampling 3 identical times (36 texture loads/fragment).

### Concrete Implementation Plan
- Add `refraction_linear_eye_depth(depth_01, inv_vp)` to `nativeRefractionTransportWgsl.js` using existing `camera_data.inverse_view_projection` (`inv_vp[2].w`, `inv_vp[3].w`), with exact orthographic fallback when `abs(inv_vp[2].w) <= 1e-7` so existing native tests stay exact.
- Linearize both `surface_front_depth` and the 4 `opaque_scene_depth` texels in `sample_refracted_scene_color_at_uv`, applying metric tolerance `lin_eps = max(front_lin * 5.0e-4, 1.0e-4)` (~0.3–3 mm instead of 10–45 cm).
- Relax `refraction_rear_surface_admitted` NDC epsilon to `1.0e-7` (world-space `rear_distance_m > 1.0e-6` already guards metric thickness).
- Collapse identical scalar-IOR RGB refraction calls into 1 lookup (3× fewer texture loads/fragment) and update `tests/nativeSurfaceMaterialWgsl.test.mjs` snapshot deliberately.
- Fix `sphPhaseScene.js`: add WebGPU Z-remap on wireframe, move `drawSphNativeSurfaceBoxWireframe` after `refractivePass` (inside `vaporPass`), add `COPY_SRC` to validation depth texture.
- **Verification:** Extend `tests/nativeRefractionForegroundRejection.native.test.mjs` with a perspective `PerspectiveCamera(46, 1, 0.05, 500)` test at `z = 7 m` placing a bright solid occluder `5 cm` in front of water (`0.000` bleed) and an object behind water (accurate Snell shift).

---

## 2. Interactive Speed & Responsiveness Overhaul (`index.html` Studio)

### Verified Interactive Wall-Clock Bottlenecks
1. **Per-substep `waitForPresentationSubmitTurn(..., { force: true })` lockout (`ulgMechanicsResidentStage.worker.js:13220-13246, 15579, 15656`; `workerOwnedIsosurfacePresenter.js:958-1002`):** Forces `drainActivePresentationFence` + `1..3` display frames (`16.7–50 ms` stall per substep!) plus 2 more `force: true` stalls at schedule end.
2. **Submit burst batching hard-clamped to `1` (`ulgMechanicsResidentStage.worker.js:13960-13966`):** Overrides `submitBurstSteps: '4'` to `1` whenever canonical presentation is active.
3. **Macrotask `setTimeout(0)` clamps + frequent `96³` MC rebuilds (`workerOwnedIsosurfacePresenter.js:2240, 2446, 2180-2530`):** Two `setTimeout(0)` (`>= 4 ms` browser timer clamp) + dual fence drains per `buildFrame`.
4. **Main-thread dual-rAF & `JSON.stringify` churn (`sphPhaseDemoMount.js:5872, 7119, 12771-12786, 13006`):** `tick()` recomputes execution policy/signatures at 60–120 Hz while a worker schedule is already pending; `fpsLoop()` runs `JSON.stringify` every frame; adaptive schedule pins `minSteps/warmupMaxSteps = 4`.

### Concrete Implementation Plan
- **P2.1:** Remove unconditional `force: true` in `ulgMechanicsResidentStage.worker.js:13220-13246, 15579, 15656`; yield only at burst boundaries when `recentPresentationGpuCompleteMs >= 8.0` or presentation is starving (`> 16.67 ms` since last presented frame).
- **P2.2:** Allow dynamic `effectiveStepsPerFlush = 2..4` when render GPU time `< 8 ms` (falling back to `1` only if render exceeds `10 ms`).
- **P2.3:** Replace `setTimeout(resolve, 0)` in `workerOwnedIsosurfacePresenter.js` with `MessageChannel`/`queueMicrotask` yields, and smoothly throttle heavy `96³` marching-cubes rebuilds when `workerNativeSurfaceMotionWgsl` is extrapolating at `60–120 Hz`.
- **P2.4:** Short-circuit `tick()` when `pendingMlsMpmResidentStepsSignature != null`, remove per-frame `JSON.stringify` in `fpsLoop`, lift adaptive `minSteps/warmupMaxSteps` cleanly from `4` to `8..16`, and expose a clean Studio **Speed / Quality** preset selector (`Fast 60 FPS` / `Balanced` / `High-Res`).
- **Verification:** Run `scripts/gpuprobe.sh` on `water-realtime`, `iron-ice-quench`, `sodium-water`, `water-cycle`, and `cesium-fluorine` (`CPUQuota=50%`) verifying higher wall-clock throughput while preserving Gate 3 budgets & Gate 4 `>= 54 Hz` decoupled presentation.

---

## 3. Eliminating Water "Gnocchi" Clumping & Realistic Heavy-Solid Sinking

### Root Causes Verified in Live Code
1. **Water "gnocchi" clumping:**
   - Liquid `J` drifts multiplicatively to `1.001..1.05` (`P_gauge = 0` pressureless dust) and is never reconciled with grid density `rho_grid = (sum w_pi m_i) / dx^3`; `mlsMpmParticleSeparationComputeWgsl` (`relaxation = 0.5`) then packs particles into discrete crystal lumps.
   - `ulg-gpu-abi/src/sphRenderWgsl.js:1039` uses singular `strength / (1e-6 + dist2) - subtract` Blinn metaballs that spike in clusters and pinch off between separated particles.
   - `sphPhaseSceneContracts.js:14073` hardcodes `material === 'h2o' && phase === 'liquid'` (Star Spec Rule 1 violation).
2. **Heavy solids failing to sink:**
   - **Continuum solids (`sphMlsMpmGpuStep.js:4433-4448`):** `runCachedSphSolidLiquidVelocitySeparationStep` runs *after* single-field `P2G -> Grid -> G2P` already locked solid & liquid velocities together (infinite no-slip + rear-wake suction!).
   - **Rigid solids (`schroederSolidFluidContactGpu.js:78-123, 227-241`):** Simultaneous Jacobi contacts sum 4–12 member impulses per fluid particle and 50–200 impulses onto the rigid body without contact-multiplicity normalization, bouncing heavy solids on top of water.

### Concrete Implementation Plan (Zero Extra Submits, Zero Private Grids)
- **Gnocchi Physics Fix:** In G2P (`ulg-gpu-abi/src/mlsMpmWgsl.js:2523-2540`, `+0` passes), compute `rho_grid` from the already-loaded 27-node stencil mass and gently reconcile interior compressed/well-supported liquid `J` (`sum_w_m / (rho0 * dx^3) >= 0.85`, `beta = 0.06`) while keeping `P_gauge >= 0` cavitation cutoff intact. Lower liquid-liquid separation relaxation `0.5 -> 0.2` (`sphGpuBuffers.js:86`) with gentle `normal_velocity_damping = 0.05`.
- **Gnocchi Isosurface Fix:** Change `sphPhaseSceneContracts.js:14073` from `material === 'h2o' && phase === 'liquid'` to universal `phase === 'liquid'`. Replace the singular `1/(1e-6 + dist2)` kernel in `ulg-gpu-abi/src/sphRenderWgsl.js:1039` + `sphRenderGpuKernel.js:3259` with a smooth bounded `C²` compact kernel (Wendland `W(q) = (1-q)^4 (1+4q)` scaled cleanly to existing isolation threshold) eliminating both `1/r²` blowup and inter-particle pinch-off.
- **Continuum Solid Sinking Fix:** Upgrade `sphSolidLiquidVelocitySeparationGpu.js` + `sphMlsMpmGpuStep.js` to separate mixed-node solid & liquid momenta using pre-lock velocities so only unilateral normal approach `(v_l - v_s)·n < 0` couples while tangential slip & rear-wake separation stay free (preserving existing standalone stage contract for `gate6PhaseCUnifiedContinuum.native.test.mjs`).
- **Rigid Solid Sinking Fix:** In `schroederSolidFluidContactGpu.js`, add atomic per-particle & per-body contact-count normalization (`omega = 1 / max(1, count)`) inside the existing rigid-lane compute pass (`+0` submits, `+0` extra passes) with softened submerged Baumgarte penetration speed and free tangential slip so dense iron/lead/gold solids cleave smoothly downward while displacing water upward.
- **Verification:** Add live Vulkan sinking + fluid-continuity tests (`heavy Fe block sinks monotonically through H₂O with upward water displacement and < 1e-3 momentum conservation`) + full existing Gate 3/4/6 Vulkan tests + hand-driven Playwright check on `index.html`.
