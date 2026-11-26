# Mesoscale Continuum Lab (`index.html` / MLS-MPM Studio) Performance & Physics Overhaul

> **Status:** Planned Priority #2 (`plan/todo/`).
> **Origin:** Consolidates `big dog`'s requests from `step 7598` (water clumping like gnocchi + heavy solids not sinking), `step 7618` (water refracting objects in front of it instead of only inside/behind it), and `step 19124` (revisit MLS-MPM lab to dramatically improve real-world interactive speed & functionality).

---

## 1. Problems to Solve

1. **Interactive Responsiveness & Real Wall-Clock Speed (`index.html` Studio):**
   - While isolated `water-realtime` batch probes clear `1.2–1.3× RT` in headless benchmarks, interactive Studio sessions across rich multi-material presets (`iron-ice-quench`, `sodium-water`, `cesium-fluorine`, `water-cycle`, custom scenes) still feel slow in browser interaction.
   - **Action:** Capture a complete GPU + main-thread + worker flamegraph profile across all 5 presets (`S0_RESIDENT_PERF=1 S0_ATTRIBUTION=1`):
     - Eliminate any remaining main-thread stall, redundant worker serialization, over-frequent marching-cubes / isosurface extraction, or unnecessary readback waits.
     - Tune adaptive `K`-substep batching per `queue.submit`, persistent zero-churn bind groups, and decoupled render-vs-physics cadence so Studio feels butter-smooth (`>= 60 Hz` camera & UI responsiveness + visibly fast fluid/solid motion!).
2. **Water Refraction Foreground-Occlusion Bug (`src/visualization/sphPhaseScene.js`):**
   - **Bug:** The screen-space refraction pass currently samples the opaque scene color buffer at refracted UV coordinates without checking whether the sampled opaque pixel lies **in front of** the water surface (`z_opaque < z_water`), causing foreground solid objects positioned *in front* of the water to get distorted/refracted through the water behind them!
   - **Fix:** Bind the opaque-scene depth texture (`sceneDepthTex`) into the water refraction fragment pass and perform a strict depth test at `uv_refracted`: if `depth_opaque(uv_refracted) < depth_water`, fall back cleanly to un-refracted `uv` (or mask out foreground occluders) so ONLY objects **inside or behind** the liquid volume are optically refracted!
   - **Verification:** Add a dedicated native Vulkan invariance test placing a bright contrasting solid bar strictly **in front** of a water tank and verifying zero pixel distortion on the foreground object while an object **behind** the tank shifts accurately by Snell's Law (`n = 1.333`).
3. **Eliminating Fluid "Gnocchi" Clumping & Realistic Dense-Solid Sinking (Dynamic Volume LOD + MLS-MPM Coupling):**
   - **Root Cause:** Coarse continuum parcel radii + surface-tension/cohesion over-clumping create large blobby droplets ("gnocchi") whose excluded volume prevents dense rigid/coherent solids (e.g. iron spheres/blocks) from smoothly displacing fluid and sinking under Archimedes buoyancy (`ρ_solid > ρ_fluid`).
   - **Fix:**
     - Promote `SchroederScaleAtlas` **Dynamic Hierarchy LOD** around solid–fluid interfaces so active liquid–solid boundaries automatically refine to finer continuum resolution while quiescent bulk stays coarse & fast!
     - Re-calibrate continuum pressure-stiffness / FLIP unilateral solid–fluid slip (`sphMlsMpmGpuStep.js`) and marching-cubes isosurface smoothing radius against empirical water surface tension (`72.8 mN/m`) and Archimedes settling velocity (`v_t`) under the new Scientific Validation Framework.
     - Add a clear UI **Resolution / Speed / Quality** preset selector (`Fast 60 FPS` / `Balanced` / `High-Res 100K`) + clean scene tools inside `index.html`.
