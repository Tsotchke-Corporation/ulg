# ULG — First-Principles Multiscale Physics Engine

**ULG** is a browser-native, WebGPU physics engine built from first principles using the **Schroeder Spatial (SS)** method. Instead of scripting canned material constants, fake smoke emitters, or hand-tuned shaders, ULG derives mechanical, thermal, chemical, and optical behavior bottom-up from atomic and electronic physics and evolves fluids, coherent solids, phase transitions, and reactive plumes in real time.

- **Live Demo (GitHub Pages):** [https://tsotchke-corporation.github.io/ulg/](https://tsotchke-corporation.github.io/ulg/)
- **Distributed Compute Fabric (PeerCompute):** [https://github.com/MetaverseJS/peercompute](https://github.com/MetaverseJS/peercompute)

---

## Quick Start

```bash
npm install
npm run dev          # Start the local WebGPU Simulation Studio
npm test             # Run the host verification suite
npm run build        # Build the production app bundle
npm run build:pages  # Build and verify the GitHub Pages bundle in docs/
```

Opening the app drops straight into an **empty, zero-allocation viewport** (no workers, GPU buffers, or particles are allocated until you launch). Click the **`☰`** button in the top right to open the Simulation Setup modal:

1. **Choose a preset** or assemble custom material bodies from all 118 elements and compounds in a container whose floor center is locked at `(0, 0, 0)`.
2. **Stage edits safely** — changing bodies, container size, walls, atmosphere, or physical laws never restarts or disturbs a running simulation until you click **Launch / Relaunch**.
3. **Inspect live physics** rendered through unified GPU marching-cubes isosurfaces and participating-medium volumetric optics, with diagnostics kept tucked behind a dedicated toggle.

### Built-In Scenarios

| Scenario | Materials | What It Demonstrates |
| --- | --- | --- |
| **Iron–Ice Quench** | `Fe` (1850 K) + `H₂O` ice (233 K) | Coherent rigid ice solid rendered via GPU isosurface, thermal conduction, exact-ledger melt release, and rising volumetric steam |
| **Sodium in Water** | `Na` + `H₂O` in room air | Exothermic alkali-metal reaction (`Na + H₂O -> NaOH + H₂`), product placement, heat release, and reaction smoke/vapor plume |
| **Cesium + Fluorine** | `Cs` + `F` | Two-level Schroeder Spatial coupling across an energetic halogen-alkali reaction front |
| **Water Cycle** | `H₂O` + heated floor / cooled ceiling | Evaporation, buoyancy-driven vapor transport, and condensation in an enclosed thermal gradient |
| **Water Dam Break** | `H₂O` (4,608 carriers) | High-throughput resident GPU MLS-MPM/APIC free-surface liquid flow with marching-cubes isosurface rendering |

---

## Core Idea: Physics From First Principles

Conventional physics engines treat material behavior as artist-authored metadata: water has hardcoded density `1000`, metal has a hand-picked shader color, and steam is an uncoupled sprite emitter.

ULG replaces hardcoded properties with a **bottom-up closure chain**:

1. **Atomic & Electronic Structure** — Starting from atomic number $Z$, electron configuration, and chemical formula, ULG solves radial Kohn-Sham DFT (including spin-polarized LSDA and scalar-relativistic Koelling-Harmon orbitals) and molecular Hartree-Fock / all-element electronic models.
2. **Derived Material & Thermodynamic Closures** — Cohesive energies, equilibrium densities, bulk and shear moduli, Debye heat capacities, Lindemann melting points, Clausius-Clapeyron boiling curves, Gruneisen thermal expansion, and latent-heat enthalpy ladders are derived into bounded GPU closure tables.
3. **Stoichiometric Chemistry** — Contacting bodies check atom- and charge-balanced reaction pathways, computing reaction enthalpies, limiting-reagent conversion, product species creation, and thermal release.
4. **Derived Optics & Volumetric Rendering** — Metallic reflectance (Drude-Lorentz), thermal incandescence (Planck blackbody integrated to CIE/sRGB), liquid transmission (Beer-Lambert), and vapor/aerosol visibility (Rayleigh/Mie scattering and droplet optical state) are computed from the same physical state that drives mechanics.

When a material or reaction closure is missing or moves outside its valid domain, ULG flags or resolves the miss through its closure derivation pipeline rather than fabricating unphysical constants.

---

## The Schroeder Spatial (SS) Method

Bridging microscopic material structure and macroscopic continuum or astrophysical dynamics requires a discretization that does not waste compute on empty space, uniform interiors, or inactive physics. The **Schroeder Spatial (SS)** method combines four architectural mechanisms in one GPU-resident hierarchy:

1. **Adaptive Multi-Level Spatial Cells (`N`-level hierarchy)**
   Space is partitioned into nested dyadic spatial levels. High-resolution cells concentrate along phase boundaries, solid-fluid interfaces, and reactive fronts, while quieter or distant volumes coarsen into conservative aggregate nodes that transmit far-field effects without all-to-all pair loops.
2. **Scale-Adaptive Dynamic Law Activation**
   Every active spatial node carries bitmasks for physical law families (mechanics, thermal transport, phase change, radiation, chemistry). Dormant cells—such as isothermal bulk water far from a reaction front or boiling threshold—skip inactive kernels cleanly through compacted per-node law queues instead of executing redundant work.
3. **Exact Conservation & Cross-Level Reflux**
   Mass, momentum, and energy exchanged across grid levels, wall reservoirs, chemical reactions, and rigid-to-fluid melt release are tracked in an exact fixed-point integer ledger (`2^-149` quantum floor). Cross-level restriction, prolongation, and reflux prevent artificial energy drift across resolution boundaries.
4. **Unified GPU Residence & Presentation**
   Particle-grid MLS-MPM/APIC mechanics, coherent solid bodies, incremental GPU spatial CSR indexing, thermal/reaction sidecars, marching-cubes isosurface extraction, and participating-medium volumetric raymarching stay GPU-resident on WebGPU inside a decoupled worker-owned presentation lane.

---

## Current Implementation Status

ULG is under active engineering development. The table below distinguishes what runs live in the browser today from implemented kernel suites and future physics milestones. A file-level audit of every solver and gap is maintained in [`plan/solver-law-inventory.md`](plan/solver-law-inventory.md).

### Live & Verified Today

| Subsystem | Current Capability |
| --- | --- |
| **Electronic & Atomic Derivation** | All-electron radial Kohn-Sham DFT (LDA, spin-polarized LSDA, Koelling-Harmon scalar-relativistic), uniform electron gas (Dirac exchange + Chachiyo QMC correlation), jellium/Ashcroft cohesion, RHF/UHF/MP2 molecular SCF, geometry optimization, vibrational frequencies, and all-element ($Z=1..118$) molecular/compound derivation. |
| **Material, Phase & Optical Closures** | Element and compound closure generation, bank-anchored product closures, piecewise phase enthalpy ladders with latent-heat plateaus, Gruneisen expansion, Drude-Lorentz metal optics, Beer-Lambert liquid absorption, Planck blackbody incandescence, and Rayleigh/Mie droplet optics for steam and smoke. |
| **Resident WebGPU Mechanics** | Particle-parallel MLS-MPM/APIC (`P2G` / grid update / `G2P`) with pooled write-through submit bursts, compute-pass coalescing, multi-SM parallel Jacobi contact cleanup, and sustained `>1x` real-time / `>60 Hz` presentation verified up to 103k+ carriers. |
| **Coherent Solids** | GPU-binned `SE(3)` coherent rigid solids (`SOL-0`–`SOL-3`) with solid-solid and solid-fluid wrench coupling, exact-ledger melt release into fluid carriers, and direct GPU splatting into the unified marching-cubes solid isosurface. GPU deformable solid surface (`SOL-4`), cohesive fracture/refreeze (`SOL-5`), and multilevel proxy/orbital coupling (`SOL-6`) kernels are implemented and tested. |
| **Thermal, Chemistry & Exact Ledgers** | Energy-conserving pair conduction, finite-heat-capacity and fixed-temperature 6-face walls, graybody thermal radiation, atom/charge-balanced reactive chemistry with product/gas placement, and a `2^-149` exact energy/mass accounting ledger. |
| **Schroeder Spatial Hierarchy** | Single-pass GPU incremental spatial CSR migration with displacement certificates, zero-indirect simultaneous multi-level SS cross-transport, compacted per-node dynamic law activation and dormancy across thermal/phase/radiation/reaction lanes. |
| **Unified Rendering & Studio UI** | Worker-owned OffscreenCanvas WebGPU presenter, unified GPU marching-cubes isosurfaces across fluids and coherent rigid solids, volumetric participating-medium steam/smoke raymarching, floor-centered container containment enforcement, staged Launch/Relaunch UI, and zero-allocation startup. |
| **Distributed & Triad Closure Bridge** | Content-addressed closure registry, browser localStorage persistence, warm browser WASM/WebGPU Eshkol & MoonLab closure miss bridge, and PeerCompute multi-peer responder routing with quorum failover, epoch fencing, and remote debt tracking. |

### Known Current Limitations

- **Derivation locality:** Atomic/molecular/optical closure derivation runs in supervised CPU/WASM workers (or remote PeerCompute peers) and uploads packed tables to WebGPU; full GPU-native Kohn-Sham and SCF derivation kernels are planned, not yet in the hot path.
- **Continuum & chemistry depth:** Capillary surface-tension curvature force, full nonequilibrium nucleation/droplet-size evolution kinetics, transition-state (NEB) barrier search, and stiff/shock Mie-Gruneisen equations of state are still planned.
- **Scientific validation posture:** Reduced electronic/compound closures are designed for broad all-element generality and still carry conservative non-validated scientific metadata flags pending higher-order DFT/periodic-crystal benchmarks.
- **Frontier physics families:** Full Maxwell electromagnetism, MHD, kinetic PIC plasma, nuclear/isotope transport, and general-relativistic gravity do not yet have full local ULG runtime solvers (Eshkol and MoonLab currently provide readiness probes, calibrated reference artifacts, and staged magnetar closure/handler contracts).

---

## Multiscale Architecture: Quantum to Supergalactic Scale

ULG's long-term goal is a single coherent simulation framework spanning **40 orders of magnitude**—from sub-nanometer quantum interactions up to supergalactic structure—without rewriting the engine per scale.

The unifying principle is **closure-coupled hierarchical refinement**:

```text
  Lower Scale (Fine SS Levels / Quantum & Atomistic Workers / PeerCompute Peers)
        │
        │  Derives bounded, conservative closures:
        │  EOS tables, transport coefficients, reaction rates,
        │  fracture laws, optical spectra, sub-grid feedback operators
        ▼
  Higher Scale (Coarse SS Levels / Continuum, Planetary, Stellar, Cosmological GPU Lanes)
        │
        │  Evolves active SS cells with dynamic law masks & exact reflux.
        │  When a cell exits its closure domain (shock, phase boundary,
        │  ignition, collapse), it emits a Closure Refresh Request downward
        │  or spawns finer local SS child levels.
        ▼
  PeerCompute Distributed Fabric (https://github.com/MetaverseJS/peercompute)
        │  Routes closure misses, tile ownership, and heavy sub-scale solves
        │  across connected WebGPU/WASM browser and native peers.
```

### Scale Progression

| Scale Regime | Length Scale | Governing Physics & Closures | SS Hierarchy Role | Status |
| --- | --- | --- | --- | --- |
| **1. Quantum & Atomic** | $10^{-15}$ – $10^{-9}\,\text{m}$ | Radial/relativistic DFT, molecular SCF/MP2, multireference bond breaking, nuclear & isotope cross-sections, MoonLab quantum kernels | On-demand closure generator; produces atomic, binding, ionization, and spectral tables | **Active** (DFT/SCF/all-element); nuclear & full-Dirac planned |
| **2. Molecular & Condensed Matter** | $10^{-9}$ – $10^{-4}\,\text{m}$ | Atomistic MD, periodic crystals/phonons, reaction-path transition states, nucleation & aerosol microphysics, crystal plasticity | Supplies continuum EOS, viscosity, thermal conductivity, reaction kinetics, and fracture closures | **Active** (MD/compound/optical closures); periodic DFT & NEB planned |
| **3. Continuum, Solids & Chemistry** | $10^{-4}$ – $10^{3}\,\text{m}$ | MLS-MPM/APIC fluids, coherent rigid & deformable/fracturing solids, phase change, reactive chemistry, volumetric optics, EM coupling | Multi-level GPU-resident SS grid + CSR carriers + exact-ledger reflux + dynamic law dormancy | **Live Engine** (default WebGPU browser demo) |
| **4. Planetary & Geophysical** | $10^{3}$ – $10^{8}\,\text{m}$ | Body-spanning SS levels with local coordinate rebasing (`SOL-6`), hierarchical multipole self-gravity, planetary-interior shock EOS, atmosphere & MHD | Coarse orbital/planetary cells dynamically refine around impacts, crusts, atmospheres, and plumes | **Prototype** (`SOL-6` proxy/orbital + far-aggregate gravity kernels) |
| **5. Stellar & Compact Objects** | $10^{8}$ – $10^{12}\,\text{m}$ | Relativistic EOS, spectral radiation transport, kinetic PIC plasma, GRMHD magnetospheres, thermonuclear reaction networks | Eshkol compiled closure operators + MoonLab quantum/relativistic references coupled to SS macro cells | **Staged Triad Contracts** (Eshkol/MoonLab magnetar handlers & probes) |
| **6. Galactic & Supergalactic** | $10^{12}$ – $10^{25}\,\text{m}$ | Deep sparse `N`-level hierarchical gravity (multipole tree / Poisson), cosmological expansion, baryonic gas & dark-matter dynamics, stellar-feedback sub-grid closures | Arbitrary-depth sparse SS hierarchy partitioned across [PeerCompute](https://github.com/MetaverseJS/peercompute) peer meshes | **Roadmap** |

---

## Roadmap

### Near Term
- Complete GPU-native continuum closures: capillary surface-tension curvature force, end-to-end GPU gas-cell EOS, and resident droplet nucleation/condensation kinetics.
- Promote all four resident law families (`mechanics`, `thermal-phase`, `reaction-product-gas`, `pressure-interface`) from pass-DAG children to independently scheduled SS law executors.
- Wire `SOL-4` deformable surfaces and `SOL-5` cohesive fracture/refreeze into live interactive presets alongside rigid solids.
- Move closure-table compilation and atomic/electronic derivation progressively onto WebGPU and warm PeerCompute worker pools.

### Mid Term
- Generalize the Schroeder Spatial hierarchy beyond two active levels to arbitrary sparse `N`-level refinement/coarsening driven by interface, shock, and reaction-front estimators.
- Add periodic solid-state DFT, analytic molecular gradients, NEB reaction barriers, and stiff/shock Mie-Gruneisen equations of state.
- Enable live planetary-scale (`SOL-6`) scenarios with local floating-origin chart rebasing, hierarchical multipole self-gravity, and PeerCompute multi-peer spatial tile sharing.

### Long Term
- Couple full Maxwell/MHD, kinetic PIC plasma, spectral radiation transport, and relativistic gravity into the SS dynamic law registry.
- Scale out peer-to-peer distributed multiscale worlds over [PeerCompute](https://github.com/MetaverseJS/peercompute), allowing simulations to zoom seamlessly from reactive surface chemistry to planetary, stellar, and supergalactic regimes under one conserved spatial hierarchy.

---

## Repository & Architecture References

- **Live WebGPU Demo:** [https://tsotchke-corporation.github.io/ulg/](https://tsotchke-corporation.github.io/ulg/)
- **PeerCompute Distributed Runtime:** [https://github.com/MetaverseJS/peercompute](https://github.com/MetaverseJS/peercompute)
- **GPU ABI & Closure Table Contract:** [`ulg-gpu-abi/README.md`](ulg-gpu-abi/README.md)
- **Detailed Solver & Law Inventory:** [`plan/solver-law-inventory.md`](plan/solver-law-inventory.md)
- **Service Asset Staging (MoonLab / Eshkol):** run `npm run stage:service-assets` to populate local `public/service-assets/` bundles for Triad worker probes and warm closure handlers.
