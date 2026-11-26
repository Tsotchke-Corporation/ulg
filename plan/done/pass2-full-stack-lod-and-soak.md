# Pass 2 Full-Stack Deep Visual LOD, L0 Big Bang Expansion, L3 3D GPU MLS-MPM Stellar Fusion, Control Fixes & Hand-Driven Playwright Soak

> **Status:** Active Campaign Pillar (`plan/todo/` — authored 2026-11-25 from full-stack audit + user directives).
> **Origin:** Consolidates user requests for: (1) true 3D GPU MLS-MPM + nuclear physics Stellar Fusion LOD (`L3`), (2) proper physical FLRW Big Bang fireball & metric expansion (`L0`), (3) deep visual LOD & control-bug elimination across ALL 5 flagship demos (`index.html`, `elements-lab.html`, `universes.html`, `organic-lab.html`, `life-lab.html`), and (4) genuine **hand-driven** Playwright testing driving mouse, wheel, keyboard, sliders, and buttons across every demo to catch real usability & physics bugs.

---

## 1. L0 Physical FLRW Big Bang Fireball & Metric Expansion (`cosmicWebTreePmGpu.js`, `ulgUniversesPhysics.js`, `ulgUniversesRenderer.js`)

- Clicking `💥 Big Bang` (or setting cosmic time `t -> 0` / `z -> 1090`) must evolve a **true physical expanding universe** rather than a static-box density fade:
  - Start compact at physical scale factor $a(t_0) \ll 1$ as an incandescent primordial baryon-photon plasma fireball (`T(z) = 2.7255 / a(t)`, shifting continuously from blinding blue-white plasma → golden recombination glow at $z \approx 1100$ → Dark Ages infrared/21 cm → Reionization first Pop-III stars → modern Cosmic Web filaments!).
  - Render particle coordinates at true physical expanding positions $\mathbf{r}_\text{phys}(t) = a(t)\,\mathbf{x}_\text{comoving}$ (expanding smoothly outward across the viewport as cosmic time advances from `10⁻⁴ Gyr -> 13.8 Gyr`, with live HUD displaying real `a(t)`, redshift `z`, `T_CMB(z)`, and expanding physical Mpc scale!).
  - Visual LOD upgrade on `L0` (`PARTICLE_CLOUD_WGSL` mode 0): soft volumetric `shape = 1` dark-matter filaments + `shape = 2` velocity-aligned filament infall streaks + crisp luminous golden-white baryon superclusters + hot X-ray cluster halos.

---

## 2. L3 True 3D GPU MLS-MPM Stellar Fusion & Convective Plasma (`src/runtime/astrophysics/stellarMlsMpmFusionGpu.js`)

- **First-Principles Multiscale LOD Exemplar:** Couple ULG's Gate 1 nuclear physics (`stellarNucleosynthesisBridge.js`: exact `pp`-chain `Q = 26.73 MeV`, CNO `T^16`, triple-α `3⁴He -> ¹²C`, `C/O/Si` burning) directly into a dedicated **3D GPU MLS-MPM compressible self-gravitating stellar plasma solver** (`32³` Eulerian MPM grid + `8,192–16,384` plasma material points, `@workgroup_size(64)`, `<= 2` submits/step, zero CPU readbacks):
  - **Self-gravity + Radiation/Ideal-Gas EOS:** Radial hydrostatic gravity $g(r) = -G M(<r)/r^2$ balancing $P = \frac{\rho k_B T}{\mu m_p} + \frac{1}{3} a_\text{rad} T^4$.
  - **Live Nuclear Core Burn & Composition Advection:** Core parcels at $T > 10^7\text{ K}$ fuse `X_H -> X_He -> X_Z` via exact Gate 1 rates, depositing volumetric nuclear energy $\Delta u = \epsilon_\text{nuc}(\rho, T, X)\,\Delta t$ into the MPM grid!
  - **Emergent Convective Plumes & Photospheric Granulation:** Nuclear heating drives real Rayleigh–Bénard buoyant hot plasma plumes rising from the radiative-convective boundary to the photosphere (where Stefan–Boltzmann surface cooling $\propto \sigma T^4$ radiates energy away and cool dense downdrafts sink back down!), visible directly on `L3` as a 3D cutaway/translucent boiling fusion star with live composition & core-temperature telemetry + coronal streamers & sunspots!

---

## 3. Global 2-Pass Kawase HDR Bloom & `ULG Universes` Deep Visual LOD (`L0..L7`)

- **2-Pass Thresholded Kawase HDR Bloom + ACES** on existing `rgba16float` targets in all 3 renderers (`ulgUniversesRenderer.js`, `chemBioWebGpuRenderer.js`, `elementsLabWebGpuRenderer.js`).
- **Universes P0 Bug Fixes:**
  - Dedicated `spaceMeshCamBuf` fixing the corrupt `sky_hor=(128,64,0)` yellow fog on space UFOs & probes (`ulgUniversesRenderer.js:1986, 2423, 2574`).
  - Real `±0.5 * IPD` stereo eye offset in Stereo SBS VR (`ulgUniversesRenderer.js:2623`).
  - Input hardening (`ulgUniversesDemo.js`): `pointercancel` & `activePointerId` tracking, continuous per-frame `joyLookEl` integration while held steady, `window blur` stuck-key reset, `!e.repeat` on `KeyX`.
- **Universes Scale LOD Polish:**
  - `L1` Spiral Galaxy: dark carbonaceous dust-lane absorption pass + soft volumetric bulge (`shape = 1`) + O-B/H II knot bloom.
  - `L2` Systems & Exotics: analytical planet-on-ring eclipse shadow + Henyey–Greenstein scattering (`DISK_WGSL`), MRI sheared Kerr disk + Doppler beaming + `shape = 2` relativistic jet streaks, `shape = 1` cryo/impact plumes.
  - `L3` Stars & Nebulae: coronal streamer rays & prominences + sunspots/faculae + volumetric `shape = 1` H II / planetary nebula / SNR billows + `shape = 2` MHD jets.
  - `L5..L7`: cavity AO + Schlick Fresnel on `MD_SPHERE_WGSL`; IGN 64-step `NUCLEAR_VOL_WGSL` with proper nucleon depth occlusion.

---

## 4. Elements Lab (`elements-lab.html`) & Organic / Life Labs (`organic-lab.html`, `life-lab.html`) Deep LOD & P0 Control Fixes

- **Elements Lab P0 Bug Fixes & Pass 2 LOD (`elementsLabDemo.js`, `elementsLabWebGpuRenderer.js`, `nuclearStructureGpu.js`):**
  - Stop destroying `#ctrl-lambda` and `#ctrl-neb-xi` DOM mid-drag; remove duplicate CI-NEB loop; fix broken `renderVolume3D` zoom (`camDist` uniform); fix 3D Polytope ray-heightfield click probe; sync `api.setCamera` with `orbitControls`; update `#ctrl-spin-b` thumb during sweep; guard async derivations with monotonic token; DPR-scale 2D plots; cache hot per-frame bind groups.
  - Visual LOD: HDR bloom + ACES, IGN-jittered `48³` volumetric orbitals with `∇ρ` Fresnel lobes + octant cutaway, real-depth 180K TD-KS cloud + IGN wavefield, world-lit 100K MD crystal with cavity AO & crystallographic cutaway slice, continuous Cassini-oval `40³` fission with scission neutron burst (no `beta <= 0.98` snap!), `128²` smooth 3D Polytope with per-fragment normals & live `mdPressurePa` beacon.
- **Organic & Life Labs P0 Bug Fixes & Pass 2 LOD (`organicLabDemo.js`, `lifeLabDemo.js`, `chemBioWebGpuRenderer.js`):**
  - Enable alpha blending on `orgBondPipe` (H-bonds & vdW contacts); guard async GPU session dispose against in-flight steps; fix BZ/RAF HUD labels; fix incomplete Reset buttons & `api.setParams` DOM sync + the 3 latent `lifeLabDemo.js` parameter mismatch bugs; close `help-popover` on outside click / `Escape`; DPR-scale 2D plots; double-buffer non-blocking contact map readbacks.
  - Visual LOD: HDR bloom + ACES, analytical `@builtin(frag_depth)` impostor spheres (`ORG_ATOM_WGSL`, `BIO_BEAD_WGSL`), true GPU-extruded 3D Catmull-Rom protein backbone ribbons & dashed H-bond ladders (`BIO_LINK_WGSL`), lipid hydrophilic/hydrophobic bilayer shading + interactive Vesicle Cutaway (`clipZ`), `128×128` central-difference 2D RD/HH planes with live click-to-seed GPU brush!

---

## 5. Mandatory Real Hand-Driven Playwright Full-Stack Soak (`tests/handDrivenFullStackSoak.native.test.mjs`)

- Drive EVERY ONE of the 5 flagship pages (`index.html`, `elements-lab.html`, `universes.html`, `organic-lab.html`, `life-lab.html`) strictly through **real user inputs** (`page.mouse.move/down/up/wheel`, `page.keyboard.down/up` for `WASD/QE/Space/Ctrl/V/T/X/G`, real slider pointer drags, real DOM clicks) across multi-second soak sequences:
  1. **`index.html` (MLS-MPM Studio):** Orbit drag, zoom wheel, switch presets (`water-realtime`, `iron-ice-quench`, `sodium-water`), toggle Pause/Play/Reset, verify smooth frame rate, continuous non-gnocchi liquid surface, heavy solid sinking, and zero foreground refraction bleed.
  2. **`elements-lab.html`:** Switch all 6 tabs, wheel-zoom on 3D volumetric orbital (proving zoom now works!), drag `#ctrl-lambda` mid-drag without losing focus, click 3D Polytope surface accurately, scrub continuous fission, run Chemistry Combiner.
  3. **`universes.html`:** Click `💥 Big Bang` and watch physical expansion; click `L1 → L2 → L3` and verify 3D MLS-MPM stellar fusion convection; click `L4` gas giant & Earth-like planet verifying visible global CFD + smooth aurora + zero blown-out yellow UFO; click & visit an **Asteroid/Comet** (shoot laser/missile/antimatter, harvest, deploy probe & Rover, shatter!); land on Earth-like & Titan surfaces — hand-drive UFO (`WASD/Space/Ctrl/Q/E`), drag Dual-Caret EM Sensor slider to Thermal IR & back, run Surface Time-Warp watching sunrise/sunset & moving moons, drive Rover across waves/ice, open `🧬 Life Lab` from alien flora sample!
  4. **`organic-lab.html`:** Drag orbit, click Sulflower atoms (live tracking!), switch `Ball & Stick / CPK / Licorice`, click 2D BZ/Frank plane to seed waves, switch modes rapidly (verifying zero GPU dispose race).
  5. **`life-lab.html`:** Drag vesicle `clipZ` cutaway slider, watch 3D protein ribbon fold, click 2D HH/Turing plane to fire action-potential spiral, load Titan `CH₄` azotosome & M-Dwarf xenobiology presets, click Reset buttons verifying complete state & slider sync.
- Inspect captured sequential screenshots visually and fix EVERY real bug uncovered before closing `/goal`!
