# Living Worlds: Reversed-Z Dynamic Surface Sky, `±6 km` Clipmap, Tectonics/Oceans/Exotic Weather, Emergent Seasons/Flora, Xenobiology, Civilizations & Visible L4 Global CFD

> **Status:** Active Priority #3 (`plan/todo/` — hardened 2026-11-25 against live code + `planetgen`/`hyperborea` audit).
> **Invariants:** Star Spec v0.4 zero planet/material-name hacks; 100% GPU-native; `<= 6` storage buffers per shader stage (`<= 8` WebGPU baseline cap); `<= 2` submits/frame; `0` hot-loop CPU readbacks; Safari/Metal-safe WGSL (`smoothstep(lo, hi, x)`, `pow(max(0, x), y)`).

---

## 1. Reversed-Z Infinite Far Plane (`depth32float`) & Precision-Safe Celestial Sky

- **Projection (`ulgUniversesDemo.js`):** Replace forward-Z `[0, 1]` projection with `mat4PerspectiveReversedZInfiniteWebGpu(fovY, aspect, near)` (`m[10] = 0, m[11] = -1, m[14] = near`, `ndcZ = near / d`).
- **Renderer (`ulgUniversesRenderer.js`):** Upgrade offscreen `depthTex` to `'depth32float'`, `depthClearValue: 0.0`, `depthCompare: 'greater-equal'` across all 7 depth-tested pipelines; set `BACKDROP_WGSL` & `SURFACE_SKY_WGSL` `z = 0.0`; set `LIT_SPHERE_WGSL` corona/atmo depth `1e-6` and fix `f32` ray-sphere cancellation (`let perp = ro - rd * b; let disc = r*r - dot(perp, perp);`).
- **Picker Compatibility (`gpuEntityPickerWebGpu.js`):** Add `reversedZ` bit (`bit 1` of `params.offset_lo.w`) so forward-Z labs (`elements/organic/life`) remain untouched while `universes.html` picks cleanly in Reversed-Z.
- **Monotonic Sky Proxy Shell:** Map every live N-body object $j \ne \text{focusIdx}$ (1–3 host suns, moons, parent gas giant, sibling planets, planetary rings) into the rotating surface `(East, Up, South)` tangent frame on a monotonic shell $R_\text{sky}(d_j) = 25{,}000 + 28{,}000 \log_{10}(1 + d_j / 10^6) \in [25\text{ km}, 220\text{ km}]$ with exact angular radius $\alpha_j = R_j / d_j$, giving real mountain occlusion, moon-eclipsing-sun depth ordering, daytime Rayleigh veil, and rotating Milky Way night backdrop.

---

## 2. Live Surface N-Body Kinematics, Multi-Star Eclipses & Emergent Seasons

- **Coupled N-Body Stepping (`ulgUniversesPhysics.js:2080`):** Step `solarEngine` 1 substep/frame (`< 0.06 ms`) during `surfaceActive`, with interactive **Surface Time-Warp** (`1× .. 10⁶×`) so players can watch real sunrises, golden-crimson Chapman-airmass sunsets, transiting moons, ring arches, solar eclipses, and seasonal snowline shifts in seconds.
- **Physical Spin & Obliquity (`solarSystemNBodyGpu.js`, `causalNebularSystemGenerator.js`):** Add real `axialObliquityDeg`, `spinAxisLonDeg`, `rotationPeriodHr`, and `tidallyLocked` to the real Solar System catalog and derive them causally from giant-impact obliquity & tidal-locking timescale ($\tau_\text{tide} \propto a^6 / M_*^2$) in procedural nebular systems.
- **Multi-Star & Eclipses (`SurfaceEnvUniforms`, `@group(0) @binding(1)` on surface passes):** Support up to `3` live host suns with exact circle-circle eclipse occultation `f_occ` against closer orbiting bodies.
- **Emergent Milankovitch Seasons (Zero Hardcoded Switches):** Compute subsolar declination $\sin\delta = \hat{\mathbf{p}} \cdot \hat{\mathbf{s}}_\text{ecl}$, daily-mean insolation $\bar{Q}(\phi, \delta)$, thermal-inertia-lagged $T_\text{sea}(t)$, lapse-rate snowline $h_\text{snow}(t) = (T_\text{sea}(t) - T_\text{melt}) / \Gamma_\text{lapse}$ against the active surface solvent's real $T_\text{melt}$ (`H₂O: 273.15 K`, `CH₄: 90.7 K`, `NH₃: 195.4 K`, `H₂SO₄: 283.5 K`), and freeze-thaw `iceCoverFrac` (freezes ocean waves & unlocks Rover driving across frozen winter seas!).

---

## 3. `±6 km` 2-Ring GPU Clipmap, `planetgen` Tectonics/Erosion, GPU Ocean Waves & Exotic Weather

- **Storage Buffer Budget Locked (`<= 6 <= 8`):**
  - `planetarySurfaceVehiclesGpu.js`: `4` existing + `@binding(5) ocean_field` + `@binding(6) tectonic_field` = `6` storage buffers; pack both clipmap rings (`±600 m` deformable inner ring `cell=9.5 m` + `±6,000 m` mountain-range outer ring `cell=95 m` with seam skirts = `33,282` verts) into ONE `terrain_verts` buffer.
- **One-Shot GPU Tectonics & Hydraulic Erosion (`src/runtime/astrophysics/surfaceTectonicsErosionGpu.js`, `3` storage buffers, `< 2.5 ms` once on landing):**
  - `256×256` Voronoi tectonic plates (12–24 plates with subduction uplift, rifts, shear faults) + 48 parallel GPU shallow-water/thermal-flux erosion passes producing `tectonic_field` `(elevNorm, riverMask, moisture, soilClass)` — giving every terrestrial world distinct continents, canyons, river valleys, archipelagos, deserts, and multi-biome transitions!
- **Live GPU Ocean Waves & Exotic Hydrology (`src/runtime/astrophysics/surfaceOceanWaveGpu.js`, `4` storage buffers, `0.12 ms/frame`, `0` CPU readback):**
  - `128×128` ping-pong wave PDE forced by live `32×24×32` 3D CFD surface wind rotated by hemispheric Ekman angle `±45° * sign(lat)`, craft/boulder/missile splash impulses, and wave celerity scaled by $\sqrt{g}$ (slow towering waves on low-$g$ `CH₄` cryo-seas vs brisk chop on Earth `H₂O` oceans, dormant when dry or frozen!).
  - Derive precipitation & cloud optics strictly from `(T, P, composition)`: `H₂O` rain/snow, `CH₄/C₂H₆` cryo-rain/hydrocarbon seas, `H₂SO₄` acid virga & lightning, `SiO₂/Fe` incandescent silicate rain.

---

## 4. Visible Global Spherical Atmospheric CFD & Smooth Filamentary Polar Aurorae (`L4` Orbital Planets)

- **Origin:** Live screenshot feedback from `big dog` (`uploaded_media_1795667151349.jpg`): orbital planets currently show blurry low-detail bands, blocky beaded aurora rings, and blown-out yellow UFO fog (`cosmicMeshBg` uniform bug).
- **Fix & Upgrade (`planetaryAtmosphereCfdGpu.js`, `ulgUniversesRenderer.js` `LIT_SPHERE_WGSL`):**
  - Fix the `cosmicMeshBg` corrupt uniform binding immediately (dedicated `spaceMeshCamBuf` with `sky_hor = 0, opt_depth = 0, isMagmaOcean = 0`) and clean orbital UFO framing so it never bleeds into the bottom edge.
  - Upgrade live GPU spherical atmospheric CFD advection + vorticity readout (`128×64`+) with crisp sharp baroclinic jet-stream filaments, swirling cyclonic storm eyes, rotating multi-layer cloud shadows on terrestrial oceans/continents, and real visibly-moving banded Rossby waves on gas/ice giants (`LIT_SPHERE_WGSL` high-contrast bicubic/sharpened sampling + cloud-top relief lighting!).
  - Replace the blocky beaded polar aurora ring with smooth multi-ribbon filamentary Birkeland curtain arcs (`sin(lat, lon, t)` domain-warped vertical rays with oxygen `557.7 nm` emerald / `630 nm` crimson / Jovian UV-violet emission determined by atmospheric gas species).

---

## 5. GPU-Instanced Emergent Flora, Alien Xenobiology (`life-lab.html` Bridge) & Emergent Civilizations

- **GPU Flora & Settlement Placement (`src/runtime/astrophysics/surfaceFloraPlacementGpu.js`, `3` storage buffers + `SURFACE_FLORA_INSTANCED_WGSL` `1` storage buffer, 1 instanced draw call):**
  - Places up to `1,024` instanced world-appropriate canopies/trees/alien stalks (Euler buckling height $H \propto (9.81/g)^{0.45}$, pigment matched to host star Wien peak $\lambda_\text{peak}(T_\text{eff})$, seasonal phenology/snow cover) plus emergent indigenous civilization structures (coastal settlements, towers, orbital collectors) driven by a continuous physical Tech/Kardashev sub-index `civTechK ∈ [0, 1.0+]`.
  - From `L4` orbit, industrial+ civilizations (`civTechK >= 0.5`) display coherent coastal/valley night-side city light networks and narrowband radio technosignatures on the P4 EM Sensor Stack!
- **Planet-to-Biology Lab Coupling (`src/runtime/biology/xenobiologySynthesizer.js` + `lifeLabDemo.js`):**
  - Fix 3 latent parameter bugs in `lifeLabDemo.js` (`:614` `epsHp -> hydrophobicCoupling`, `:627-628` `epsHp/epsHBond -> hydrophobicCoupling/hBondStrength`, `:643` `initMode -> initSpiral`) and lower `amphiphileMembraneGpu.js` `minTempK` from `100 K -> 75 K` for Titan `94 K` `CH₄` azotosomes.
  - Map any planet's `(T, P, g, rhoAtm, solvent, stellarTeffK, uvFlux)` to canonical GPU membrane/folding/Eigen/bioenergetics/morphogenesis parameters; add `🧬 Open in Life Lab ↗` button on alien flora/biosphere samples (`./life-lab.html?xeno=1&...`) and 5 built-in Xenobiology Planet Presets inside `life-lab.html`.

---

## 6. Verification Plan

- Unit tests: Reversed-Z projection & picker math, ecliptic-to-surface tangent frame + eclipse occultation + Milankovitch season snowline/freeze-thaw, `xenobiologySynthesizer.js` across `H₂O`/`CH₄`/`NH₃`/`H₂SO₄` & M/G/F stars.
- Native Vulkan tests: `universes.html` surface Reversed-Z sunrise/sunset + moving celestial bodies + `±6 km` horizon + GPU tectonics/ocean waves + instanced flora/civs + `L4` visible spherical CFD & filamentary aurora + `life-lab.html?xeno=1` live boot (`0` GPU/console errors, sequential frames visually verified).
