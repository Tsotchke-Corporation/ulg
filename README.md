# ULG — First-Principles Multiscale Physics Engine

**ULG** is a browser-native, WebGPU physics engine built from first principles using the **Schroeder Spatial (SS)** method. Instead of scripting canned material constants, fake smoke emitters, or hand-tuned shaders, ULG derives mechanical, thermal, chemical, and optical behavior bottom-up from atomic, electronic, and quantum physics and evolves fluids, coherent solids, phase transitions, and reactive plumes in real time.

- **Live Demo (GitHub Pages):** [https://tsotchke-corporation.github.io/ulg/](https://tsotchke-corporation.github.io/ulg/)
- **Distributed Compute Fabric (PeerCompute):** [https://github.com/MetaverseJS/peercompute](https://github.com/MetaverseJS/peercompute)
- **Mathematical & AD Closure Compiler (Eshkol):** [https://github.com/tsotchke/eshkol](https://github.com/tsotchke/eshkol)
- **Quantum Simulation & Reference Engine (Moonlab):** [https://github.com/tsotchke/moonlab](https://github.com/tsotchke/moonlab)

---

## Quick Start

```bash
npm install
npm run dev          # Start the local WebGPU Simulation Studio
npm test             # Run the host verification suite
npm run build        # Build the production app bundle
npm run build:pages  # Build and verify the GitHub Pages bundle in docs/
```

Opening the app drops straight into an **empty, zero-allocation viewport** (no workers, GPU buffers, or particles are allocated until you launch). Click the **`☰`** button in the top right (desktop or mobile) to open the Simulation Setup modal:

1. **Choose a preset** or assemble custom material bodies from all 118 elements and compounds in a container whose floor center is locked at `(0, 0, 0)`.
2. **Stage edits safely** — changing bodies, container size, walls, atmosphere, per-body solid mechanics carrier (`Auto`, `Rigid`, `Deformable SOL-4`, `Continuum`), 2-level First-Class Air, or physical laws never restarts or disturbs a running simulation until you click **Launch / Relaunch**.
3. **Inspect live physics** rendered through unified GPU marching-cubes isosurfaces, adaptive burst-aligned visual synchronization with damped GPU motion smoothing, and participating-medium volumetric optics, with live architecture diagnostics tucked behind a dedicated toggle.

### Built-In Scenarios

| Scenario | Materials | What It Demonstrates |
| --- | --- | --- |
| **Iron–Ice Quench** | `Fe` (1850 K) + `H₂O` ice (233 K) | Coherent rigid ice solid rendered via GPU isosurface, thermal conduction, exact-ledger melt release, and rising volumetric steam |
| **Sodium in Water** | `Na` + `H₂O` in room air | Exothermic alkali-metal reaction (`Na + H₂O -> NaOH + H₂`), product placement, heat release, and reaction smoke/vapor plume |
| **Cesium + Fluorine** | `Cs` + `F` | Multi-level Schroeder Spatial coupling across an energetic halogen-alkali reaction front |
| **Water Cycle** | `H₂O` + heated floor / cooled ceiling | Evaporation, buoyancy-driven vapor transport, and condensation in an enclosed thermal gradient |
| **Water Dam Break** | `H₂O` (4,608 carriers) | High-throughput resident GPU MLS-MPM/APIC free-surface liquid flow with marching-cubes isosurface rendering |

---

## The Triad Architecture: ULG, Eshkol, Moonlab & PeerCompute

ULG is part of a four-piece multiscale scientific computing stack where each engine owns the scale and mathematical primitive it is best suited for:

```text
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      ULG (WebGPU Multiscale Runtime)                    │
  │  Schroeder Spatial hierarchy · MLS-MPM/APIC · coherent solids (SOL-0..6)│
  │  exact 2^-149 ledgers · dynamic law dormancy · GPU isosurfaces & optics │
  └───────────────────────────┬──────────────────────────┬──────────────────┘
                              │ closure misses &         │ schedule admission,
                              │ regional response fits   │ G5 CAS leases &
                              ▼                          │ P2P quorum routing
  ┌────────────────────────────────────────┐   ┌─────────▼──────────────────┐
  │  Eshkol (Mathematical & AD Engine)     │   │  PeerCompute Fabric        │
  │  github.com/tsotchke/eshkol            │   │  github.com/MetaverseJS/   │
  │  • Warm browser WASM VM worker         │   │  peercompute               │
  │  • Compiler-native exact AD (no FD)    │   │  • ComputeManager / GPUHub │
  │  • EOS stiffness dP/dρ & response fits │   │  • StateManager / CAS      │
  │  • Compiled higher-order closures      │   │  • BroadcastChannel +      │
  └────────────────────┬───────────────────┘   │    WebRTC DataChannel mesh │
                       │ quantum pin &         └─────────┬──────────────────┘
                       │ reference contracts             │
                       ▼                                 │
  ┌────────────────────────────────────────┐             │
  │  Moonlab (Quantum Simulator)           │◄────────────┘
  │  github.com/tsotchke/moonlab           │
  │  • Warm browser WASM/WebGPU worker     │
  │  • State vector, tensor networks, VQE  │
  │  • Quantum-scale chemistry & spectral  │
  │    probes + strong-field references    │
  └────────────────────────────────────────┘
```

### How Eshkol Powers ULG
[**Eshkol**](https://github.com/tsotchke/eshkol) is a Scheme-based programming language for mathematical computing where **automatic differentiation is a compiler primitive**, delivering exact derivatives without finite-difference approximation. Inside ULG:
- **Live Warm WASM Worker (`eshkol-warm-vm.worker.js`):** Stays resident in the browser (and on remote PeerCompute peers) so closure misses resolve without cold VM reloads, with fail-closed S-expression validation and crash/respawn recovery.
- **Exact-Derivative Closure Derivation:** Drives automatic-differentiation derivations of equation-of-state stiffness (`dP/dρ` cross-checked to `<= 3.6e-16` relative error) that feed ULG's GPU semi-implicit pressure solver (`sphImplicitPressureGpu.js`) and regional response tables.
- **Higher-Order & Frontier Closure Compilation:** Provides compiled closure bundles and host-import execution boundaries (such as staged magnetar closure handlers via `npm run stage:service-assets`) so new physical regimes compile down to verified closure tables rather than hand-coded JS branches.

### How Moonlab Powers ULG
[**Moonlab**](https://github.com/tsotchke/moonlab) is a full-stack quantum simulator spanning dense state-vector simulation (up to 32+ qubits), tensor networks, quantum chemistry/VQE with native autograd, and browser WASM/WebGPU bindings. Inside ULG:
- **Live Warm WebGPU Quantum Worker (`moonlab-warm-webgpu.worker.js`):** Executes quantum closure probes directly on the browser's WebGPU/WASM stack under PeerCompute G5 CAS reservations (`warmClosureMissBridge.js`), with verified complex64 WebGPU parity tracking.
- **Bottom-of-Scale Quantum Authority & Calibrated References:** Anchors ULG's multiscale ladder at the quantum and extreme-field end—supplying calibrated quantum/relativistic reference contracts (including normalized magnetar reference suites) and providing the live execution backend for future correlated quantum-chemistry and strong-field closure misses.
- **Peer-Distributed Quorum Execution:** Both Eshkol and Moonlab warm workers plug into ULG's **PeerCompute** derivation peer mesh (`BroadcastChannel`, signaling relay, and WebRTC `RTCDataChannel` P2P) with 2-of-2 quorum validation, epoch fencing, and fail-closed remote debt tracking.

---

## Core Idea: Physics From First Principles

Conventional physics engines treat material behavior as artist-authored metadata: water has hardcoded density `1000`, metal has a hand-picked shader color, and steam is an uncoupled sprite emitter.

ULG replaces hardcoded properties with a **bottom-up closure chain**:

1. **Atomic, Electronic & Quantum Structure** — Starting from atomic number $Z$, electron configuration, and chemical formula, ULG solves radial Kohn-Sham DFT (including spin-polarized LSDA and scalar-relativistic Koelling-Harmon orbitals), molecular Hartree-Fock / all-element electronic models, and Moonlab quantum probes.
2. **Derived Material & Thermodynamic Closures** — Cohesive energies, equilibrium densities, bulk and shear moduli, Debye heat capacities, Lindemann melting points, Clausius-Clapeyron boiling curves, Gruneisen thermal expansion, Eshkol-AD stiffness responses, and 2-D `(T, P)` Chebyshev gas response tables are derived into bounded GPU closure tables.
3. **Stoichiometric Chemistry** — Arbitrary contacting periodic-table pairings check atom- and charge-balanced reaction pathways, computing reaction enthalpies, limiting-reagent conversion, bank-anchored product closures, product species creation, and thermal release.
4. **Derived Optics & Volumetric Rendering** — Metallic reflectance (Drude-Lorentz), thermal incandescence (Planck blackbody integrated to CIE/sRGB), liquid transmission (Beer-Lambert), and vapor/aerosol visibility (Rayleigh/Mie scattering and droplet optical state) are computed from the same physical state that drives mechanics.

When a material or reaction closure is missing or moves outside its valid domain, ULG flags or resolves the miss through its closure derivation pipeline (locally or via Eshkol/Moonlab PeerCompute peers) rather than fabricating unphysical constants.

---

## The Schroeder Spatial (SS) Method

Bridging microscopic material structure and macroscopic continuum or astrophysical dynamics requires a discretization that does not waste compute on empty space, uniform interiors, or inactive physics. The **Schroeder Spatial (SS)** method combines four architectural mechanisms in one GPU-resident hierarchy:

1. **Adaptive Multi-Level Spatial Cells (`N`-level hierarchy)**
   Space is partitioned into nested dyadic spatial levels. High-resolution cells concentrate along phase boundaries, solid-fluid interfaces, and reactive fronts, while quieter or distant volumes coarsen into conservative aggregate nodes that transmit far-field effects without all-to-all pair loops.
2. **Scale-Adaptive Dynamic Law Activation**
   Every active spatial node carries bitmasks for physical law families (mechanics, thermal transport, phase change, radiation, chemistry). Dormant cells—such as isothermal bulk water far from a reaction front or boiling threshold—skip inactive kernels cleanly through compacted GPU indirect-dispatch law queues instead of executing redundant work.
3. **Exact Conservation & Cross-Level Reflux**
   Mass, momentum, and energy exchanged across grid levels, wall reservoirs, chemical reactions, and rigid-to-fluid melt release are tracked in an exact fixed-point integer ledger (`2^-149` quantum floor). Cross-level restriction, prolongation, and reflux prevent artificial energy drift across resolution boundaries.
4. **Unified GPU Residence & Presentation**
   Particle-grid MLS-MPM/APIC mechanics, coherent solid bodies, single-pass incremental GPU spatial CSR indexing, thermal/reaction sidecars, marching-cubes isosurface extraction, and 60 Hz advected participating-medium volumetric raymarching stay GPU-resident on WebGPU inside a decoupled worker-owned presentation lane.

---

## Current Implementation Status

ULG is under active engineering development. The table below distinguishes what runs live in the browser today from staged contracts and future physics milestones. A file-level audit of every solver and gap is maintained in [`plan/solver-law-inventory.md`](plan/solver-law-inventory.md).

### Live & Verified Today

| Subsystem | Current Capability |
| --- | --- |
| **Electronic, Atomic & Quantum Derivation** | All-electron radial Kohn-Sham DFT (LDA, spin-polarized LSDA, Koelling-Harmon scalar-relativistic), uniform electron gas (Dirac exchange + Chachiyo QMC correlation), jellium/Ashcroft cohesion, RHF/UHF/MP2 molecular SCF, all-element ($Z=1..118$) compound derivation, and live warm Eshkol AD + Moonlab WebGPU workers. |
| **Material, Phase & Optical Closures** | Element and compound closure generation, bank-anchored product closures, piecewise phase enthalpy ladders with latent-heat plateaus, A3 regional pressure & thermal/phase closures, A4 6-closure 2-D `(T, P)` Chebyshev gas tables, Drude-Lorentz metal optics, Beer-Lambert liquid absorption, Planck blackbody incandescence, and Rayleigh/Mie droplet optics. |
| **Resident WebGPU Mechanics** | Particle-parallel MLS-MPM/APIC (`P2G` / grid update / `G2P`) with pooled write-through submit bursts, compute-pass coalescing, multi-SM parallel Jacobi contact cleanup, queue-ordered hot-loop buffer pooling, and sustained `>1x` real-time / `>60 Hz` presentation verified up to 103k+ carriers. |
| **Coherent Solids (`SOL-0`–`SOL-6`)** | GPU-binned `SE(3)` coherent rigid solids with solid-solid and solid-fluid wrench coupling, exact-ledger melt release, direct GPU splatting into unified solid isosurfaces, explicit deformable solid surfaces (`SOL-4`), cohesive fracture & refreeze (`SOL-5`), and multilevel proxy/orbital coupling (`SOL-6`) exposed directly in Simulation Studio. |
| **Thermal, Chemistry & Exact Ledgers** | Energy-conserving pair conduction, finite-heat-capacity and fixed-temperature 6-face walls, graybody thermal radiation, general periodic-table atom/charge-balanced reactive chemistry with product/gas placement, G6 GPU caloric thermal-potential fitting, and a `2^-149` exact mass/energy accounting ledger. |
| **Schroeder Spatial Hierarchy** | Single-pass GPU incremental spatial CSR migration (`97.8%–99.7%` hit rate across presets, keyed by source family & sort mode), zero-indirect simultaneous multi-level SS cross-transport, 2-level First-Class Air enrollment, and compacted per-node dynamic law activation & dormancy across thermal, phase, radiation, and reaction lanes. |
| **Unified Rendering, Sync & Mobile Studio** | Worker-owned OffscreenCanvas WebGPU presenter, burst-aligned adaptive visual sync (`6–22+ Hz` committed geometry updates with damped GPU motion smoothing), unified fluid + solid GPU marching-cubes isosurfaces, 60 Hz advected participating-medium steam/smoke raymarching, staged Launch/Relaunch Studio UI, zero-allocation startup, and full mobile portrait/landscape responsiveness. |
| **Distributed Triad Closure Bridge** | Content-addressed closure registry, browser localStorage persistence, warm browser WASM/WebGPU Eshkol & Moonlab closure miss bridge under PeerCompute G5 CAS reservations, and cross-machine `BroadcastChannel` + WebSocket signaling + WebRTC `RTCDataChannel` P2P quorum routing with epoch fencing and remote debt tracking. |

### Known Current Limitations

- **Hierarchy depth:** Live studio scenes currently enroll 1-level or 2-level SS hierarchies (`L0/L1`); generalizing the live interactive chain and coordinate representation to arbitrary 3+ level sparse hierarchies (toward 40 orders of magnitude) is the immediate next milestone.
- **Derivation locality:** Atomic/molecular/optical closure derivation runs in supervised CPU/WASM workers (or remote Eshkol/Moonlab PeerCompute peers) and uploads packed tables to WebGPU; full GPU-native Kohn-Sham and SCF derivation kernels are planned.
- **Continuum & chemistry depth:** Capillary surface-tension curvature force, full nonequilibrium nucleation/droplet-size evolution kinetics, transition-state (NEB) barrier search, and stiff/shock Mie-Gruneisen equations of state are still planned.
- **Scientific validation posture:** Reduced electronic/compound closures are designed for broad all-element generality and still carry conservative non-validated scientific metadata flags pending higher-order DFT/periodic-crystal benchmarks.
- **Frontier physics families:** Full Maxwell electromagnetism, MHD, kinetic PIC plasma, nuclear/isotope transport, and general-relativistic gravity do not yet have full local ULG runtime solvers (Eshkol and Moonlab currently provide readiness probes, calibrated reference artifacts, and staged magnetar closure/handler contracts).

---

## Multiscale Architecture: Quantum to Supergalactic Scale

ULG's long-term goal is a single coherent simulation framework spanning **40 orders of magnitude**—from sub-nanometer quantum interactions ($10^{-15}\,\text{m}$) up to supergalactic structure ($10^{25}\,\text{m}$, ~133 dyadic spatial levels)—without rewriting the engine per scale.

The unifying principle is **closure-coupled hierarchical refinement**:

```text
  Lower Scale (Fine SS Levels / Moonlab Quantum & Eshkol AD Workers / PeerCompute Peers)
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
| **1. Quantum & Atomic** | $10^{-15}$ – $10^{-9}\,\text{m}$ | Radial/relativistic DFT, molecular SCF/MP2, multireference bond breaking, nuclear & isotope cross-sections, [Moonlab](https://github.com/tsotchke/moonlab) quantum kernels | On-demand closure generator; produces atomic, binding, ionization, and spectral tables | **Active** (DFT/SCF/all-element + live Moonlab WebGPU worker); nuclear & full-Dirac planned |
| **2. Molecular & Condensed Matter** | $10^{-9}$ – $10^{-4}\,\text{m}$ | Atomistic MD, periodic crystals/phonons, reaction-path transition states, nucleation & aerosol microphysics, [Eshkol](https://github.com/tsotchke/eshkol) AD stiffness & response closures | Supplies continuum EOS, viscosity, thermal conductivity, reaction kinetics, and fracture closures | **Active** (MD/compound/optical closures + live Eshkol AD worker); periodic DFT & NEB planned |
| **3. Continuum, Solids & Chemistry** | $10^{-4}$ – $10^{3}\,\text{m}$ | MLS-MPM/APIC fluids, coherent rigid & deformable/fracturing solids, phase change, reactive chemistry, volumetric optics, EM coupling | Multi-level GPU-resident SS grid + incremental CSR carriers + exact-ledger reflux + dynamic law dormancy | **Live Engine** (default WebGPU browser demo) |
| **4. Planetary & Geophysical** | $10^{3}$ – $10^{8}\,\text{m}$ | Body-spanning SS levels with local coordinate rebasing (`SOL-6`), hierarchical multipole self-gravity, planetary-interior shock EOS, atmosphere & MHD | Coarse orbital/planetary cells dynamically refine around impacts, crusts, atmospheres, and plumes | **Prototype** (`SOL-6` proxy/orbital + far-aggregate gravity kernels) |
| **5. Stellar & Compact Objects** | $10^{8}$ – $10^{12}\,\text{m}$ | Relativistic EOS, spectral radiation transport, kinetic PIC plasma, GRMHD magnetospheres, thermonuclear reaction networks | [Eshkol](https://github.com/tsotchke/eshkol) compiled closure operators + [Moonlab](https://github.com/tsotchke/moonlab) quantum/relativistic references coupled to SS macro cells | **Staged Triad Contracts** (Eshkol/Moonlab magnetar handlers & probes) |
| **6. Galactic & Supergalactic** | $10^{12}$ – $10^{25}\,\text{m}$ | Deep sparse `N`-level hierarchical gravity (multipole tree / Poisson), cosmological expansion, baryonic gas & dark-matter dynamics, stellar-feedback sub-grid closures | Arbitrary-depth sparse SS hierarchy (~133 dyadic levels) partitioned across [PeerCompute](https://github.com/MetaverseJS/peercompute) peer meshes | **Roadmap** |

---

## Roadmap

### Near Term
- Generalize the live Schroeder Spatial hierarchy from 2 levels to **3+ sparse dyadic levels** with chart-anchored coordinates engineered to scale across 40 orders of magnitude (~133 levels).
- Accelerate multi-law thermodynamic, mechanics-field, and contact throughput (eliminating redundant radix sorts and per-commit GPU allocations on dense thermal/reactive scenes).
- Complete GPU-native continuum closures: capillary surface-tension curvature force, resident droplet nucleation/condensation kinetics, and stiff/shock Mie-Gruneisen equations of state.

### Mid Term
- Add periodic solid-state DFT, analytic molecular gradients, NEB reaction barriers, and deeper Eshkol/Moonlab GPU-accelerated closure synthesis.
- Enable live planetary-scale (`SOL-6`) scenarios with local floating-origin chart rebasing, hierarchical multipole self-gravity, and PeerCompute multi-peer spatial tile sharing.

### Long Term
- Couple full Maxwell/MHD, kinetic PIC plasma, spectral radiation transport, and relativistic gravity into the SS dynamic law registry.
- Scale out peer-to-peer distributed multiscale worlds over [PeerCompute](https://github.com/MetaverseJS/peercompute), allowing simulations to zoom seamlessly from reactive surface chemistry to planetary, stellar, and supergalactic regimes under one conserved spatial hierarchy.

---

## Repository & Architecture References

- **Live WebGPU Demo:** [https://tsotchke-corporation.github.io/ulg/](https://tsotchke-corporation.github.io/ulg/)
- **PeerCompute Distributed Runtime:** [https://github.com/MetaverseJS/peercompute](https://github.com/MetaverseJS/peercompute)
- **Eshkol Mathematical & AD Compiler:** [https://github.com/tsotchke/eshkol](https://github.com/tsotchke/eshkol)
- **Moonlab Quantum Simulator:** [https://github.com/tsotchke/moonlab](https://github.com/tsotchke/moonlab)
- **GPU ABI & Closure Table Contract:** [`ulg-gpu-abi/README.md`](ulg-gpu-abi/README.md)
- **Detailed Solver & Law Inventory:** [`plan/solver-law-inventory.md`](plan/solver-law-inventory.md)
- **Service Asset Staging (Moonlab / Eshkol):** run `npm run stage:service-assets` to populate local `public/service-assets/` bundles for Triad worker probes and warm closure handlers.
