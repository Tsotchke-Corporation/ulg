# Cosmic UFO Explorer, Visitable Asteroids & Comets, Deformable MLS-MPM & Kardashev II–III Roadmap

> **Status:** Phase 1 shipped (`de7fc5f2`); Phase 2+ hardened 2026-11-25 for full implementation (`plan/todo/`).
> **Invariants:** Star Spec v0.4 zero planet/body-name hacks; 100% GPU-native; dormant-zero when idle; `<= 2` submits/substep; `0` hot-loop CPU readbacks; clean OPFS/IDB persistence.

---

## 1. Persistent OPFS / IndexedDB Sparse Crater Tile Save & 1-Submit GPU Replay (`surfaceCraterTileStore.js`)

- Mirror ULG's proven OPFS → IndexedDB → Memory storage architecture (`polytopeAtlasPersistentCache.js:295-487`) in `src/runtime/astrophysics/surfaceCraterTileStore.js` (OPFS root `ulg-surface-craters-v1`, IDB store `crater-tiles`).
- Key every sparse patch deterministically by `${universeSeed >>> 0}:${systemId}:${bodyId}:${tileX}_${tileZ}` matching the `768 m` deformable patch span (`surfaceDeformationMpmGpu.js`).
- Lift the silent `MAX_CRATER_STAMPS = 96` drop cap to `512` compact 36-byte deterministic stamp records (`< 18 KB/tile`), flushing asynchronously (debounced 2 s after weapon firing stops, on `exitSurfaceView()`, and on `pagehide` — zero hot-loop `mapAsync`!).
- Add parallel GPU compute entry point `replay_crater_stamps` (`@workgroup_size(8, 8)`) in `surfaceDeformationMpmGpu.js` so re-landing reconstructs the exact deformed `deformBuf` (`dh, tempK, melt, char`) in **1 dispatch (`< 0.2 ms`)**.
- Broadcast the same compact 36-byte stamp record over `ufoMultiplayerMesh.js` (`broadcastCraterStamp`) so remote peers see craters live with `< 50 bytes/event`.

---

## 2. Visitable, Landable, Mineable & Shatterable Asteroids & Comets (`L2` Micro-Gravity Surface + Space Weapons)

- **Origin:** User request: *"we still can't actually visit asteroids or comets yet either. or shoot them with missles and laswers or collect their resources or drop probes or rovers on them."*
- **Click, Focus & `🛸 Visit / Land` on Any Asteroid or Comet (`ulgUniversesPhysics.js`, `ulgUniversesDemo.js`, `planetarySurfaceVehiclesGpu.js`):**
  - Clicking any Main-Belt / Kuiper asteroid or active comet in `L2` (or selecting via system body list) focuses it in 3D and enables `🛸 Visit / Land` (and scroll-in auto-entry) into a **micro-gravity vacuum surface session** (`g = G M / R² ~ 0.001–0.08 m/s²`, low-gravity ballistic Rover hops & thrusters, irregular craggy monolithic/rubble-pile relief, zero atmosphere drag, high-velocity ejecta escape).
  - **Active Comet Outgassing Jets:** When `body.isComet` (volatile `H₂O`/`CO₂`/`CH₄` ice exposed to solar flux above sublimation $T_\text{sub}$), emit live GPU gas+dust sublimation geysers from sunlit vents driving anti-solar ion/dust coma particles!
  - **Full Sandbox Arsenal on Asteroids & Comets:**
    - Shoot them with **EM Laser, Guided Missiles, and Antimatter Beam** BOTH up close in micro-gravity surface view AND from `L2`/`L4` orbital space (wiring real ray-sphere hit detection + thermal ablation + resource yield in `ulgUniversesDemo.js`!).
    - **Harvest Resources:** Tractor beam (`T`) & mining lasers extract real body-derived `metals`, `silicates`, `volatiles` (comet water/organics), and `exotics` directly into the player's Kardashev inventory.
    - **Deploy Von Neumann Probes & Rovers:** Beam down the 6-wheel Rover (`R` / button — with micro-gravity RCS downforce/thruster hops!) or deploy self-replicating Von Neumann Probes directly onto asteroid/comet regolith!

---

## 3. High-Power Antimatter → `tidalRocheDisruptionGpu.js` Catastrophic Fragmentation

- Lift the flat `1e14 W` weapon cap (`ufoWeaponsAndPhysicsGpu.js:210`, `planetarySurfaceVehiclesGpu.js:1868`, `universes.html:1184`) to scale continuously with the player's Kardashev reactor tier (`Tier 1: 1e12 W -> Tier 5: 1e26 W`), and compute physical annihilation rate `massRateKgS = powerW / (2 c²)` (`50%` prompt coupling).
- Compute every body's real physical binding energy $U_\text{bind} = \frac{3}{5}\frac{GM^2}{R} + \frac{4}{3}\pi R^3 \sigma_\text{coh}$ (zero body-name hacks!).
- Extend `src/runtime/astrophysics/tidalRocheDisruptionGpu.js` with `mode: 'catastrophic-shatter'` (`modeCode = 4u`, `4,096–8,192` self-gravitating incandescent fragments expanding at $v_\text{ej} = \sqrt{2(E - U_\text{bind})/M}$ into a cooling debris torus).
- When cumulative delivered energy reaches `E_delivered >= 0.85 * U_bind` (from space or surface antimatter strike on an asteroid, comet, or small moon), cleanly ascend to orbit if landed and promote smoothly to live `catastrophic-shatter` GPU fragmentation!

---

## 4. Kardashev II–III Dyson Swarm (`tau_Dyson` Dimming + IR Glow) & Multi-System Logistic Von Neumann Fleet

- Replace the 28-element flat `state.probes` cap (`ufoMultiplayerMesh.js:266-381`) with a per-system deterministic ledger `systems: Map<systemKey, SystemFleetState>` using exact closed-form logistic growth:
  $$N(t + \Delta t) = \frac{K}{1 + \frac{K - N}{\max(1, N)} e^{-r_\text{eff} \Delta t}}$$
  scaling smoothly from `1 -> 10^12` collectors across star systems with `<= 64` visual 3D drones in the active system.
- At `f_cover > 0.25` (Kardashev `~1.8+`), automatically launch interstellar colony seed waves (`0.05..0.15 c`) to nearest neighbor systems in `L1` and render pulsing geodesic colonization links in `L1` (`orbitPipe`), progressing smoothly through **Type II (Dyson Swarm)** and **Type III (Galactic Swarm + SMBH Penrose extraction)**.
- In `LIT_SPHERE_WGSL` (`kind == 0u`), pass `tau_Dyson = -ln(1 - f_cover)` (packed cleanly alongside `T_eff`) to attenuate visible photosphere brightness by `exp(-tau_Dyson)`, draw rotating multi-inclination orbital collector bands, and emit `350–500 K` thermodynamic waste-heat infrared glow (visible in IR on the P4 EM Sensor Stack!).

---

## 5. Generalized GPU SE(3) DLM Rigid-Body Boulders (`surfaceDeformationMpmGpu.js` + `particleRigidDynamicsGpu.js`)

- Replace CPU Euler boulder integration and per-frame CPU `Float32Array` vertex rebuilds (`surfaceDeformationMpmGpu.js:497-542, 685-839`) with ULG's canonical GPU SE(3) symplectic quaternion solver (`createRigidBodyDynamicsGpu` in `src/runtime/sph/particleRigidDynamicsGpu.js`):
  - 6-sphere composite boulder colliders with exact principal inertia `(I1, I2, I3)`.
  - 3 lightweight GPU passes in the same single command encoder (`+0` submits, `0` CPU readbacks):
    1. `compute_boulder_terrain_wrench` (`@workgroup_size(64)`): Hertz–Mindlin terrain + `deform_field` contact, Coulomb friction, tractor spring-damper, crater shockwave impulse.
    2. `couple_mpm_boulders` (`@workgroup_size(64)`, gated on `mpmActive`): two-way momentum transfer between active MPM ejecta grid and boulders.
    3. `skin_boulder_meshes` (`@workgroup_size(64)`): transforms template icosahedron vertices directly into `boulderVertBuf` (`STORAGE | VERTEX`).

---

## 6. Verification Plan

- Unit tests: OPFS/IDB/Memory crater tile store round-trip, closed-form logistic Von Neumann conservation & Dyson `tau_Dyson`, gravitational binding energy `U_bind` shatter trigger, asteroid/comet micro-gravity parameters & comet outgassing flux.
- Native Vulkan + hand-driven Playwright tests: blast craters → exit → re-land → craters persisted; click & visit asteroid/comet → shoot laser/missile/antimatter → mine resources → deploy probe & rover → shatter asteroid into GPU `tidalRocheDisruptionGpu` debris; watch GPU DLM boulders tumble into crater; verify Dyson `tau_Dyson` star dimming & IR glow!
