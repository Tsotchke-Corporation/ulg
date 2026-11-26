# Living Worlds: Dynamic Surface Sky (Log Depth Buffer), Exotic Oceans & Weather, Emergent Seasons/Flora, Xenobiology & Civilizations

> **Status:** Planned Priority #3 (`plan/todo/`).
> **References:** Inspired by sibling architectures in `../peercompute/demos/planetgen` (tectonics, erosion, GPU ocean waves/currents, weather) and `../peercompute/demos/hyperborea` (shared time anchor, emergent seasons, snow/ice freeze-thaw, procedural trees/biomes), implemented 100% natively in WebGPU under ULG's Star Spec zero-hack physics rules.

---

## 1. Dynamic Solar System Sky from Planet Surface + Logarithmic / Reversed-Z Depth Buffer

- **Goal:** Standing on a planet's surface (in UFO, Rover, or Drone) must feel like living inside the live N-body solar system!
- **Physics & Rendering Upgrades:**
  - **Logarithmic / Reversed-Z Depth Buffer (`@builtin(frag_depth)` / reversed `z ∈ [1, 0]`):** Eliminates `f32` z-fighting across `0.2 m` (Rover wheels / cockpit glass) → `2 km` (mountain horizons) → `10⁹ m` (moons, planetary rings) → `10¹² m` (host single/binary/trinary suns & sibling planets).
  - **Live Planetary Spin & Orbital Sky Kinematics:** Drive surface `sun_dir` directly from the live `solarEngine` N-body vectors transformed into the rotating planet's surface tangent frame `(lat, lon, axialTilt, spinPhase)` — producing genuine **sunrises, golden-crimson Rayleigh sunsets, eclipses, binary/trinary multi-star shadows, night stars/Milky Way, orbiting moons, and planetary rings arching across the sky**!
  - **Even Farther View Distance:** Expand terrain beyond the current `±608 m` (`cellSizeM = 9.5 m`) using a **2-ring GPU clipmap / concentric LOD terrain mesh** (`±600 m` high-res deformable inner ring + `±6,000 m` geological mountain-range outer ring) so distant mountain chains & coastlines stretch authentically to the planetary horizon!

---

## 2. PlanetGen-Inspired Inter- & Intra-World Diversity + GPU Ocean Waves & Exotic Hydrology

- **Procedural Plate Tectonics & Hydraulic Erosion (`worldgen.js` ideas on GPU):**
  - Generate distinct continental plates, subduction mountain chains, rift valleys, river drainage basins, continental shelves, deserts, archipelagos, and polar ice caps so **every Earth-like world looks genuinely unique** AND walking/flying across one planet transitions seamlessly across biomes.
- **True GPU Ocean Waves & Wind-Driven Currents (`OceanComputeSystem.js` ideas on WebGPU):**
  - Replace purely analytical water ripples with a live GPU wave-spectrum / shallow-water height + current velocity field coupled to ULG's `32×24×32` 3D CFD surface wind (`u_wind, w_wind`), driving real traveling wave crests, whitecap foam, shoreline surf, and buoyant craft/boulder drift!
- **Exotic Multi-Species Weather & Liquids (Zero Planet-Name Hacks!):**
  - Derive precipitation, lakes, rivers, and storm physics directly from local `(T, P, composition)` vs Gate 2 Polytope vapor-pressure curves:
    - **Earth-like (`273–373 K`, `H₂O`):** Liquid water oceans, rain, snow, cumulus thunderheads, rainbows.
    - **Titan-like Cryo-Worlds (`90–112 K`, `CH₄/C₂H₆`):** Liquid methane/ethane seas with slow low-gravity waves, hydrocarbon rivers, and cold methane rain!
    - **Venus-like Hot Acid Worlds (`450–740 K`, `H₂SO₄/CO₂`):** Dense supercritical atmosphere with high-altitude sulfuric acid virga & volcanic lightning.
    - **Ultra-Hot Lava / Exoplanets (`> 1,600 K`, `SiO₂/Fe`):** Silicate/iron vapor clouds and incandescent rock rain!

---

## 3. Hyperborea-Inspired Emergent Seasons, Trees/Flora & Structures

- **Emergent Seasons from Orbital Mechanics:**
  - Compute seasonal insolation strictly from `(axialObliquity, orbitalTrueAnomaly, eccentricity, latitude)` — zero hardcoded "Winter/Summer" switches!
  - Dynamically shift seasonal temperature, snowline elevation, frozen-vs-open liquid lakes (walkable/drivable ice in winter, waves in summer — inspired by `hyperborea`!), polar cap extent, and vegetation pigment phenology.
- **GPU-Instanced Emergent Flora, Biomes & Structures:**
  - Populate suitable biome niches (moisture + temperature + soil chemistry + stellar photon flux) with GPU-instanced trees, canopy groves, alien flora morphologies, and geological structures (basalt columns, crystal spires, hydrothermal vents).

---

## 4. Biology Lab (`life-lab.html`) → Alien Xenobiology Coupling

- **Closed-Loop Planet-to-Bio Synthesis:**
  - Feed any planet's real physical environment `(T, P, g, solvent ∈ {H₂O, CH₄, NH₃, H₂SO₄}, atmospheric gases, stellar peak λ_max, radiation flux)` into ULG's Emergent Biology engine to derive plausible **alien biochemistries**:
    - Membrane chemistry (phospholipid bilayers in liquid `H₂O` vs azotosome acrylonitrile membranes in liquid `CH₄`!).
    - Photosynthetic / chemosynthetic pigments matched to the host star's actual Planck spectrum (green chlorophyll under G-stars, dark red/black pigments under cool M-dwarfs, UV-shielded carotenoids under F-stars!).
    - Structural biomechanics scaled by local gravity `g` and atmospheric density `ρ_atm` (tall wispy canopies in low-`g` dense air vs stout armored organisms in high-`g` super-Earths).
  - Allow sampling any alien organism directly with the UFO/Rover tractor beam to open its live biochemistry inside `life-lab.html`!

---

## 5. Emergent Planetary Civilizations & Tech-Level Progression

- Worlds whose geological stability, age, and xenobiology sustain complex life can emergently develop **indigenous civilizations** parameterized by a continuous physical **Tech Level / Kardashev sub-index (`0.0 → 1.0+`)**:
  - **Pre-Industrial (`K < 0.5`):** Coastal/riverine agrarian settlements, campfires/architectural clusters in fertile valleys.
  - **Industrial / Information (`0.5 <= K < 0.8`):** Night-side city light grids visible from orbit, atmospheric technosignature gases, localized thermal islands, and narrowband radio transmissions detectable on the EM Sensor Stack!
  - **Interplanetary / Kardashev I (`K >= 0.8`):** Orbital rings, solar collector arrays, fusion-plume traffic, and spaceports interacting cleanly with the player's Explorer UFO & Von Neumann probes!
