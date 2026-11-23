# ULG Foundation-First Plan: Periodic Table First-Principles Material Engine, Reaction Feedback Loop & Polytope Atlas

- **Effective:** 2026-11-23 AKST (Updated with live status at `d687b37e`)
- **Active routing:** [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md)
- **Associated ICC Oracles:** `ulg-gate0-foundation-arch`, `ulg-gate1-periodic-table-engine`, `ulg-gate2-reactions-and-polytope-atlas` (see [`.icc/completion-oracles.yaml`](../../.icc/completion-oracles.yaml))
- **Live Implementation Status (`d687b37e`):**
  - **DONE & Vulkan-verified:** Gate 0A (`peercomputeCore.js`, `dist/` `117.5 MB → 35 MB`), Gate 0B (`src/runtime/gpuMath/`: eigensolver, 3D FFT+Poisson, GPU MD, adaptive polytope Chebyshev), Gate 0C (`materialFoundationAbi.js` + `evaluatePolytopeAtlasWgsl` + slanted `A x <= b` registry), Gate 1 (`Z=1..118` nuclear/atomic/bulk/EM/MD engine + `elements.json` `118/118` + `elements-lab.html` 6 live tabs), Gate 2 (`molecularHartreeFockWebGpu`, `recursiveCompoundPipeline`, Eshkol AD + MoonLab 5-slot Triad GPU `polytopeAtlasBuilder`, `foundation-polytope-atlas.json`).
  - **REMAINING OPEN WORK:**
    1. **End-to-End `(Z, A)` Isotope & Isotopologue Support (HIGH PRIORITY):** Nuclear layer (`nuclearStructureGpu.js`) & stellar nucleosynthesis already support arbitrary `(Z, A)`, and atomic DFT receives `R_nuc(A)`, **but** bulk density/Debye/MD (`periodicBulkDftWebGpu.js`, `elementMdClosureWebGpu.js`) still read natural-abundance `ATOMIC_MASS_U[Z-1]`, `formula.js` / `recursiveCompoundPipeline.js` cannot yet parse isotopologues (`D2O`, `[2H]2O`, `14CO2`, `235UF6`, `60Co`), `nuclearCherenkovClosure.js` still hardcodes 4 isotopes instead of querying `nuclearStructureGpu.js`, and `elements-lab.html` needs an interactive `(A, N)` isotope picker + clickable Chart of Nuclides.
    2. **Gate 0D Zero-Churn completion** (`iron-ice` `<= 25` passes / `<= 2` submits / `0` host `workDone`, `water-realtime` K-step boundary pacing `>= 1.0x` RT, 1 canonical contact law, 63-limb retirement).
    3. **Gate 1–2 Deep Physics & Formal Receipts:** GPU CI-NEB reaction barrier visualizer, 4-component Dirac–KS / `DFT+U` refinements, migrating legacy `compounds.json` off `reference-fallback`, and formal `ulg.campaign.receipt.v1` capture.

---

## 1. Strategic Mandate & Why This Unifies ULG

ULG's long-term mission is unchanged: a **first-principles, browser-native WebGPU multiscale physics engine** (Star Spec v0.4 + Schroeder Simulation `SS` + Tier 0–3 Closure Economy + PeerCompute/Eshkol/MoonLab Triad) where macroscopic behavior emerges from activated physical laws and validity-bounded closures rather than hand-coded material presets.

What changes now is **execution order**. Attempting to run multi-material continuum SPH scenes (`iron-ice-quench`, `sodium-water`, `cesium-fluorine`, etc.) while `data/material-properties/elements.json` is missing all 7 noble gases (`Z = 2, 10, 18, 36, 54, 86, 118`), `compounds.json` is `15/15` `reference-fallback`, bulk DFT and molecular HF still run on CPU JS, nuclear/electromagnetic/magnetic/conductivity closures are incomplete, and the continuum step loop churns `16+` buffers and `40+` bind groups per step puts the roof on before pouring the slab.

**We scope immediate work to getting the architectural and scientific foundation right from the bottom up:**

```text
Phase 0: Architectural Foundation (Do First)
  ├─ 0A. peercompute-core slim split (cut 83 MB ort-wasm bloat from dist/)
  ├─ 0B. Reusable WebGPU Numerical Substrate (src/runtime/gpuMath/: eigensolver, 3D FFT, GPU MD, GPU Chebyshev)
  ├─ 0C. Canonical Material-Bundle & Polytope-Atlas ABI (Nuclear + Atomic + EM + Solid + MD + Polytopes)
  └─ 0D. Continuum Zero-Churn Step Loop hygiene (prereq before continuum Gates 3–4)
          │
          ▼
Gate 1 (Track P1): Complete Periodic Table First-Principles Engine (Z = 1..118)
  + Real Live WebGPU Visualizations of Every Quantum / Nuclear / EM / Lattice / MD Simulation
  ├─ P1.1 Nuclear Physics (Z=1..118 + isotopes: finite nucleus, B(Z,A), shell/pairing, decay/WKB, spin/moments)
  ├─ P1.2 Relativistic All-Electron Atomic QM on WebGPU (Dirac/KH + SO + spin-PBE + finite nucleus + QED shifts)
  ├─ P1.3 Electromagnetism, Magnetism, Optics & Bulk Solid DFT on WebGPU (bands, DOS, Fermi surface, χ, σ, ε(ω), Φ, T_c)
  ├─ P1.4 Statistical Mechanics, Phonons & Live WebGPU MD (T_m, T_b, C_p, α_V, ΔH, ρ_liq, η, k, γ)
  └─ P1.5 Full Z = 1..118 Sweep & Offline G7 Advisory Scorecards (retire reference-fallback rows)
          │
          ▼
Gate 2 (Track P2 → P3): Chemical Reactions → Compound Feedback Loop → Convex Polytope Atlas
  ├─ P2.1 GPU Molecular Electronic Structure (RHF/UHF/UMP2/CAS(2,2)/CI-NEB on gpuMath)
  ├─ P2.2 Generalized Reaction Discovery, Barriers & Thermochemistry (A + B → C + D)
  ├─ P2.3 Recursive Compound Feedback: feed C, D straight back into P1.2–P1.4 (zero hardcoded compound tables!)
  └─ P3.1–P3.3 Piecewise-Convex (T, P, ...) Polytope Atlas + GPU Chebyshev Tier-1 Tables + 3D Atlas Visualizer
          │
          ▼
Gates 3 & 4: Macroscopic Continuum Engine (SS / MLS-MPM / Studio) Consuming the Polytope Atlas
  └─ Tier-0/1 GPU atlas lookup + Tier-2 A3 regional sampling + Tier-3 A6 PeerCompute miss derivation
```

---

## 2. Phase 0 — Architectural Prerequisites (Build Before Scaling Solvers)

Building `Z = 1..118` nuclear, relativistic atomic, periodic DFT, molecular HF, and MD solvers without shared GPU numerical primitives and a unified ABI would duplicate shader boilerplate and recreate CPU bottlenecks. **Phase 0 builds the shared spine once:**

### 0A. `peercompute-core` Slim Entrypoint Split
- **Problem:** `../peercompute/peercompute/package.json` aliases `"peercompute-diffusion-ort": "npm:onnxruntime-web@1.31.1"`, pulling `83+ MB` (`71%`) of unused `ort-wasm-*.wasm` into ULG's `dist/` (`117.5 MB` total).
- **Fix:** Expose a clean `peercompute-core` entrypoint exporting only `NodeKernel`, `ComputeManager`, `StateManager`, `ReservationLedger`, `DataState`, `GPUHubManager`, `NetworkManager`, `SolverRegistry`, `PlacementAdmissionPolicy`, `RemoteResultQuorumValidator`, `GpuResidentLaneManager`, `serviceOrchestration`, and `LocalArtifactCache` — with zero AI-inference (`onnxruntime-web`, `@huggingface/transformers`, `@wllama`, diffusion/sf3d) imports.
- **Target:** ULG `dist/` drops from `117.5 MB` to `~34 MB` with zero `ort-wasm` assets and clean static portability.

### 0B. Shared WebGPU Numerical Substrate (`src/runtime/gpuMath/`)
Every solver in Gates 1–2 needs four core GPU-resident mathematical engines. Build and unit/Vulkan-verify these once as reusable WGSL modules:
1. **`batchedSymmetricEigensolverGpu.js`:** Batched Jacobi / Householder–QL symmetric & Hermitian dense eigensolver (`N = 8..256` per workgroup/dispatch) — powers GPU Hartree–Fock / CAS(2,2), periodic plane-wave Bloch diagonalization, and generalized radial basis solvers with zero CPU readbacks.
2. **`fft3dWebGpu.js`:** Batched Radix-2 3D FFT/IFFT (`32³` / `64³` complex64 grids) — powers periodic bulk DFT Hartree/Poisson potential, real-space/reciprocal-space XC transforms, and Ewald electrostatics.
3. **`molecularDynamicsWebGpu.js`:** GPU-resident cell-list + Velocity-Verlet + Nosé–Hoover thermostat + Berendsen/Parrinello–Rahman barostat supporting pair (Morse/Buckingham/LJ/Coulomb-Wolf), embedded-atom (EAM), and 3-body angular (Stillinger–Weber / Tersoff) potentials + GPU-resident MSD, RDF `g(r)`, stress-autocorrelation (Green–Kubo viscosity), heat-flux autocorrelation, and virial pressure reductions (`0` hot-loop CPU readbacks).
4. **`chebyshevPolytopeFitGpu.js`:** Extend existing [`src/runtime/material/responseFunctionFitGpu.js`](../../src/runtime/material/responseFunctionFitGpu.js) to 1D/2D/3D tensor-product Chebyshev fitting on convex polytopes (`A x <= b`) with held-out residual, monotonicity, and sign-preservation checks on GPU.

### 0C. Canonical Material-Bundle & Polytope-Atlas ABI
Lock two versioned schemas in `ulg-gpu-abi` so Gate 1, Gate 2, live visualizations, and Gate 3 continuum lanes speak one exact binary + JSON contract:
- **`ulg.material-property-bundle.v1`:** Unified per-element / per-compound bundle with 5 explicit physical domain blocks, each carrying SI units, validity regime, uncertainty bounds, generator fingerprint, and provenance status (`webgpu-derived`, `reduced-estimate`, `blocked` — never unlabeled constants):
  1. `nuclear` (`Z, A`, binding energy `B(Z,A)`, mass excess, nuclear charge radius `R_nuc`, spin/parity `I^π`, nuclear magnetic moment `μ_I`, stability & decay channels `α/β±/EC/SF`, Q-values, WKB half-life, radiation/Cherenkov parameters).
  2. `atomic` (relativistic orbital spectrum `ε_{nlj}`, radial wavefunctions `R_{nl}(r)`, spin-polarized densities `ρ_↑, ρ_↓`, total spin `2S` & Hund moment, ionization potentials `I_1..I_k`, electron affinity `EA`, static dipole polarizability `α_0`, Bader/vdW & covalent radii).
  3. `electromagnetic` (band gap `E_g`, DOS at Fermi level `g(E_F)`, Fermi energy `E_F`, work function `Φ`, electrical conductivity `σ(T)` / resistivity `ρ_e(T)`, static & frequency-dependent dielectric tensor `ε(ω)`, complex optical index `n(λ), k(λ)`, normal reflectance `R_0(λ)`, CIE 1931 / sRGB color, magnetic phase `dia/para/ferro/antiferro`, magnetic susceptibility `χ(T)`, saturation magnetization `M_s`, Curie/Néel temperature estimate `T_C/T_N`, superconducting `T_c` estimate).
  4. `mechanical` (lowest free-energy crystal structure & space group, lattice parameters `a, b, c`, solid equilibrium density `ρ_0`, cohesive energy `E_coh`, Birch–Murnaghan `K_0, K_0'`, elastic constants `C_11, C_12, C_44`, Voigt–Reuss–Hill shear modulus `G`, Poisson ratio `ν`, sound speeds `c_L, c_T`, Debye temperature `Θ_D`).
  5. `thermodynamic` (`C_v(T), C_p(T)`, thermal expansion `α_V(T)`, melting point `T_m`, boiling point `T_b`, triple & critical point estimates, latent heats `ΔH_fus, ΔH_vap`, liquid density `ρ_liq(T, P)`, dynamic viscosity `η(T)`, thermal conductivity `k(T)`, surface tension `γ(T)`).
- **`ulg.polytope-atlas.v1`:** Upgrades [`src/runtime/material/materialPolytopeRegistry.js`](../../src/runtime/material/materialPolytopeRegistry.js) from 2D rectangular boxes to true **piecewise-convex half-space polytopes (`A x <= b`)** with arbitrary slanted phase-boundary facets (Clausius–Clapeyron `dP/dT = ΔH / (T ΔV)`, solid-solid polymorph lines, critical/ionization boundaries), bound GPU Chebyshev coefficient buffers, held-out residual certificates, and fail-closed `out-of-domain` signaling.

### 0D. Continuum Engine "Zero-Churn Step Loop" Sprint *(Prerequisite for Gates 3–4)*
*(Independent of building the standalone Elements Lab in Gates 1–2, mandatory before resuming Continuum Gates 3–4.)*
- Eliminate per-step GPU allocation & host-sync churn measured on `iron-ice-quench` (`36.59` encoders, `16.03` `createBuffer`, `40.51` `createBindGroup`, `3.26` `workDone`, `0.35` `mapAsync`, `32` compute passes/step → Section 3 targets: `<= 2` submits, `0` host waits, `<= 25` passes, `0` steady-state buffer/bindGroup allocations).
- Deduplicate the 5 overlapping iron-ice contact responses down to 1 canonical GPU contact authority and retire legacy contact tests pinning duplicates.
- Fix `thermalPotential`'s live `deferred-capacity` stall (`0` consumer hits on `iron-ice-quench`).
- Migrate `sphPhaseCarrierTransferGpu.js` off disabled 63-limb `sphExactRational*` (`71` refs / `33` files) onto 9-limb `2^-149` and delete dead 63-limb modules + production-bundled CPU test mirrors.

---

## 3. Gate 1 (Track P1) — Complete Periodic Table First-Principles Engine & Live Quantum Visualization Demo

**Flagship Deliverable:** An interactive, GPU-native **First-Principles Periodic Table & Materials Lab** (`elements-lab.html`, cross-linked with Studio, Cosmic ↔ Quantum, and Stellar Genesis) where clicking **any element `Z = 1..118`** runs (or loads provenance-verified cached results of) the real first-principles GPU physics chain and renders **live, data-driven WebGPU visualizations directly from GPU simulation buffers** — zero scripted animations, zero hardcoded per-element look-up cheats.

### Stage P1.1 — Nuclear Physics Foundation (`Z = 1..118` + Isotopes)
- **What we already have:** `nuclearCherenkovClosure.js` (4 isotopes `U-238, Co-60, Cs-137, H-3` + Frank–Tamm Cherenkov) and `hydrogenStellarClosure.js` (stellar `pp/CNO/3α/Fe` fusion).
- **What we build (WebGPU-first, general across all `(Z, A)`):**
  - **Nuclear binding & stability (`src/runtime/nuclear/nuclearStructureGpu.js`):** Microscopic-macroscopic Weizsäcker Liquid-Drop + Strutinsky quantum shell-correction (magic numbers `2, 8, 20, 28, 50, 82, 126`) + odd-even pairing model over the full `(Z, N)` chart (`Z = 1..118`, `A = 1..300`), computing binding energy `B(Z, A)`, mass excess, neutron/proton drip lines, most-stable isotope `A*(Z)`, and Q-values for `α`, `β⁻`, `β⁺`, electron capture (`EC`), and spontaneous fission (`SF`).
  - **Finite-size nuclear potential & Woods–Saxon single-particle shells:** 2-parameter Fermi charge distribution `ρ_nuc(r) = ρ_0 / (1 + exp((r − R_nuc)/a))` with `R_nuc(A)` feeding **directly** into Stage P1.2 relativistic atomic DFT (crucial for heavy/superheavy `Z >= 70` finite-nucleus level shifts!), plus Woods–Saxon + spin-orbit nuclear shell levels giving ground-state nuclear spin `I`, parity `π`, and Schmidt nuclear magnetic moment `μ_I`.
  - **Decay kinetics & radiation:** WKB Gamow barrier tunneling integral for `α`-decay and spontaneous fission half-lives, Fermi `β`-decay phase-space scaling, decay-chain tracing, and Frank–Tamm Cherenkov / stopping-power closures.
  - **Real Live GPU Visualizations:**
    1. Live 3D WebGPU volumetric nuclear nucleon density `ρ_p(r), ρ_n(r)` + Woods–Saxon nuclear orbital slice.
    2. Live 2D/3D GPU Chart of Nuclides `(N, Z)` colored directly from computed `B(Z,A)/A` and dominant decay channel with clickable isotope inspector.
    3. Live WKB Gamow potential barrier & tunneling transmission curve computed from the live nuclear Coulomb + Woods–Saxon potential.

### Stage P1.2 — Relativistic All-Electron Atomic Quantum Mechanics (`Z = 1..118`, 100% WebGPU)
- **What we already have:** `solveAtomFullWebGpu` in [`radialKohnShamWebGpu.js`](../../src/runtime/electronicStructure/radialKohnShamWebGpu.js) (100% GPU-resident LDA SCF with `0` per-SCF CPU readbacks), CPU `radialKohnSham.js` (PBE-GGA, LSDA spin-polarized, Koelling–Harmon scalar-relativistic, spin-orbit), and [`volumetricOrbitalRaymarcher.js`](../../src/demos/volumetricOrbitalRaymarcher.js) (`Data3DTexture` WebGPU volumetric raymarcher).
- **What we build:**
  - Upgrade `solveAtomFullWebGpu` to **full 4-component radial Dirac–Kohn–Sham** (automatically unifying scalar-relativistic contraction + exact `j = l ± 1/2` spin-orbit splitting!) with **finite nuclear charge potential `V_nuc(r)` from Stage P1.1**, **spin-polarized PBE-GGA / SCAN** (Hund's rule ground-state spin densities `ρ_↑(r), ρ_↓(r)`), and **Uehling/Welton QED radiative shift** for heavy/superheavy `Z >= 50`.
  - Compute per-element ionization energies `I_1, I_2` (`ΔSCF` on GPU), electron affinity `EA`, static polarizability `α_0` (coupled-perturbed/Sternheimer response on GPU → feeds London `C_6` dispersion!), Bader `0.001 e/a_0³` & covalent radii, and **ab-initio norm-conserving pseudopotentials** automatically generated from the converged Dirac–KS atom to feed Stage P1.3!
  - **Real Live GPU Visualizations:**
    1. Live 3D WebGPU volumetric orbital raymarching of real solved `R_{nlj}(r) Y_{lm}(θ, φ)` (selectable subshell, total density `ρ(r)`, **spin density `ρ_↑ − ρ_↓`**, and radial node cross-section slicer).
    2. Live GPU radial probability `4πr²ρ(r)`, effective potential `V_eff(r)`, and real-time SCF iteration energy-convergence trace as the GPU solves the atom!

### Stage P1.3 — Electromagnetism, Magnetism, Optics & Bulk Solid DFT (`Z = 1..118`, 100% WebGPU)
- **What we already have:** CPU [`periodicBulkDft.js`](../../src/runtime/electronicStructure/periodicBulkDft.js) (Monkhorst–Pack Bloch plane-wave pseudopotential + Birch–Murnaghan for `fcc/bcc/diamond`, `16.8%` mean lattice error on 9 elements) and GPU [`opticalResolverWebGpu.js`](../../src/runtime/material/opticalResolverWebGpu.js) (81-wavelength Drude–Lorentz + SO interband + CIE sRGB).
- **What we build (`src/runtime/electronicStructure/periodicBulkDftWebGpu.js` + `src/runtime/material/electromagneticClosureWebGpu.js`):**
  - Move periodic plane-wave pseudopotential DFT onto `gpuMath` (`fft3dWebGpu` + `batchedSymmetricEigensolverGpu`), using the norm-conserving pseudopotentials generated in Stage P1.2 + **meta-GGA (`mBJ`/`SCAN`)** for semiconductor band gaps + **spin-polarized LSDA/PBE + `DFT+U`** for `3d/4f/5f` magnetism!
  - Evaluate candidate crystal structures (`fcc, bcc, hcp, diamond, sc, graphite/layered, diatomic/molecular vdW` with London `C_6` dispersion from Stage P1.2) and select the **lowest free-energy ground-state lattice** automatically!
  - Derive from the converged Bloch states `(ε_{nk}, ψ_{nk})`:
    - **Mechanical/Elastic:** `a_0, ρ_0, E_coh`, Birch–Murnaghan `K_0, K_0'`, deformed-cell elastic tensor `C_11, C_12, C_44` → shear modulus `G`, Poisson ratio `ν`, sound velocities `c_L, c_T`, Debye `Θ_D`.
    - **Electronic & Electrical:** Band structure `E_n(k)` along high-symmetry Brillouin paths, DOS `g(E)`, band gap `E_g`, Fermi energy `E_F`, work function `Φ`, electrical conductivity `σ(T)` & resistivity `ρ_e(T)` (Drude plasma frequency `ω_p` from Fermi-surface velocity + Bloch–Grüneisen electron-phonon scattering + intrinsic semiconductor carrier density `n_i(T)`), and McMillan–Allen–Dynes superconducting `T_c` estimate.
    - **Magnetic:** Ground-state spin magnetization `M_s` (`μ_B/atom`), Stoner instability criterion `I·g(E_F) > 1` (ferromagnetism in `Fe, Co, Ni, Gd`, antiferromagnetism in `Cr, Mn`), Pauli paramagnetic + Larmor diamagnetic + Curie–Weiss susceptibility `χ(T)`, and mean-field Curie/Néel temperature estimate `T_C / T_N`.
    - **Optical / Dielectric:** Kubo–Greenwood interband + Drude intraband complex dielectric function `ε(ω) = ε_1(ω) + i ε_2(ω)` over UV–Vis–IR → complex index `n(λ), k(λ)`, Fresnel reflectance `R_0(λ)`, absorption `α(λ)`, static dielectric constant `ε_r`, and CIE 1931 / sRGB color directly on GPU!
  - **Real Live GPU Visualizations:**
    1. Live 3D WebGPU volumetric **crystal unit-cell Bloch electron density `ρ(r)` & spin-magnetization `m(r)`** inside the periodic crystal lattice (showing real metallic electron sea, covalent `sp³` bonds in `C/Si`, or `d`-orbital spin polarization in `Fe`).
    2. Live GPU **Brillouin-zone Band Structure `E_n(k)` + Spin-Resolved DOS `g_↑(E), g_↓(E)`** and **3D WebGPU Fermi Surface** isosurface!
    3. Live GPU **Complex Dielectric `ε_1(ω), ε_2(ω)` / Reflectance `R(λ)` / Spectral Color Swatch** rendered from the live Kubo–Greenwood solver.

### Stage P1.4 — Statistical Mechanics, Phonons & Live WebGPU MD (`Z = 1..118`)
- **What we already have:** CPU `src/runtime/md/` (`mdEngine.js`, `pairPotential.js` with Chapman–Enskog `μ(T)` & Modified Eucken `k(T)`, `potentialFitting.js`, `propertyEstimators.js`).
- **What we build:**
  - Fit ab-initio interatomic potentials (EAM for metals, Stillinger–Weber/Tersoff for covalent `C/Si/Ge`, Morse/Buckingham + `C_6` dispersion for noble gases & molecular elements) **directly from Stage P1.2–P1.3 DFT binding curves, elastic moduli, and atomic polarizabilities** — zero per-element hand-tuned parameters.
  - Run **live WebGPU Molecular Dynamics** (`molecularDynamicsWebGpu.js`, 1,024–4,096 atoms) + Quasi-Harmonic Debye phonon free energy `F_vib(V, T)`:
    - Solid thermal expansion `α_V(T)` and heat capacity `C_v(T), C_p(T)` (electronic Sommerfeld + phonon + anharmonic MD).
    - **Two-phase solid-liquid coexistence MD** for melting point `T_m` and enthalpy of fusion `ΔH_fus` (replacing crude Lindemann guesses!).
    - **Liquid-vapor slab MD + Clausius–Clapeyron** for boiling point `T_b`, vapor pressure `P_vap(T)`, latent heat `ΔH_vap`, liquid density `ρ_liq(T, P)`, and surface tension `γ(T)` (Kirkwood–Buff normal/tangential stress integral).
    - **Green–Kubo / Einstein–Helfand GPU reductions** for liquid viscosity `η(T)` and thermal conductivity `k(T)` (+ Wiedemann–Franz electronic `k_e(T)` from `σ(T)` in metals, and Chapman–Enskog + Modified Eucken in dilute gas!).
  - **Real Live GPU Visualizations:**
    1. Live **3D WebGPU Atomic Molecular Dynamics viewport** rendering actual GPU-simulated crystal vibrations, solid-liquid melting interface, liquid diffusion, and surface evaporation directly from the resident MD `GPUBuffer` (`0` CPU particle copies).
    2. Live GPU radial distribution function `g(r)`, velocity autocorrelation / phonon DOS `g_ph(ω)`, and live `(T, P)` coexistence curve.

### Stage P1.5 — Complete `Z = 1..118` Audit & G7 Advisory Scorecard
- Close the 7 missing noble gases (`He, Ne, Ar, Kr, Xe, Rn, Og`) and run all **118 elements** end-to-end through P1.1 → P1.4.
- Regenerate `data/material-properties/elements.json` as a provenance-bound warm cache with **zero `reference-fallback` physics cheats** (every property labeled honestly with its exact `webgpu-derived` or `reduced-estimate` generator fingerprint and uncertainty).
- Run the **G7 Offline Advisory Benchmark Suite** against cached immutable NIST / CODATA / AME2020 / Materials Project / CRC snapshots, publishing an honest per-element, per-property accuracy report (never hiding errors, never making G7 a runtime gate).

---

## 4. Gate 2 (Tracks P2 & P3) — Chemical Reactions → Recursive Compound Feedback Loop → Convex Polytope Atlas

### Track P2 — First-Principles Chemical Reactions & Recursive Compound Feedback
1. **Stage P2.1 — GPU Molecular Quantum Chemistry (`src/runtime/electronicStructure/molecularHartreeFockWebGpu.js`):**
   - Port `molecularHartreeFock.js` (RHF, UHF, UMP2, 3-CSF `CAS(2,2)`, Yamaguchi `PUHF`, analytic nuclear gradients, harmonic Hessian/vibrational frequencies, and `CI-NEB` transition-state search) onto `gpuMath` (`batchedSymmetricEigensolverGpu` + GPU 2-electron repulsion integral `ERI` engine).
2. **Stage P2.2 — Generalized Reaction Discovery & Kinetics (`src/runtime/chemistry/`):**
   - Given any pair/set of elements or compounds (`A + B`), discover balanced stoichiometries (`reactionCandidates.js` + Sedenion prioritization — never dropping balanced candidates), optimize reactant/product/transition-state geometries on GPU, and compute `ΔH_rxn`, `ΔG(T)`, equilibrium constant `K_eq(T)`, and activation barrier `E_a`.
   - **Real Live GPU Visualization:** Live 3D WebGPU volumetric molecular orbital / total electron density & bond-breaking evolution along the live CI-NEB reaction coordinate + live reaction energy profile.
3. **Stage P2.3 — Closed Compound Feedback Loop (The Core Breakthrough):**
   - **Every resultant compound (`C, D, ...`, e.g., `H₂O, NaOH, CsF, NaCl, FeO, Fe₂O₃, CO₂, NH₃, H₂, CH₄, ...`) feeds AUTOMATICALLY back into Stages P1.2–P1.4!**
   - **Molecular compounds** (`H₂O, CO₂, NH₃, HF, H₂, ...`): GPU molecular HF/DFT PES + dipole/quadrupole/polarizability → fitted polarizable/3-body molecular force field → **Stage P1.4 WebGPU MD** (liquid density, melting/boiling, `C_p`, viscosity, surface tension) + IR/UV-Vis vibrational & electronic **Stage P1.3 dielectric/optical closure** (so `H₂O`'s blue O-H overtone absorption and IOR emerge from the same pipeline!).
   - **Ionic & covalent crystalline compounds** (`NaCl, CsF, MgO, FeO, NaOH, SiO₂, ...`): Evaluate canonical crystal prototypes (`NaCl/B1, CsCl/B2, ZnS/B3, CaF₂, Rutile, Corundum, Perovskite, Layered`) in **Stage P1.3 GPU Periodic Bulk DFT** → select lowest free-energy crystal → Born–Mayer–Huggins / EAM / Tersoff potential fit → **Stage P1.4 WebGPU MD** → full mechanical, electromagnetic, optical, and thermodynamic bundle!
   - **Result:** Retire `compounds.json`'s `15/15` `reference-fallback` rows and replace [`src/runtime/material/compoundClosure.js`](../../src/runtime/material/compoundClosure.js)'s crude additive reactant-blend approximations with true recursive first-principles compound derivations!

### Track P3 — Per-Material & Per-Compound Convex Polytope Atlas
Once an element (`Z = 1..118`) or reaction-derived compound has validated Layer 0–4 closures, compile it into a **Convex Polytope Atlas** so the continuum engine never pays DFT/MD cost in the hot loop:

1. **Stage P3.1 — Phase-Boundary Discovery & Convex Polytope Decomposition (`ulg.polytope-atlas.v1`):**
   - Trace phase coexistence curves from Stage P1.4 (`P_melt(T)`, `P_vap(T)`, sublimation `P_sub(T)`, solid-solid polymorph boundaries, supercritical crossover, and Saha ionization boundary) over `(T, log10 P)` (plus optional external magnetic field `B` or composition `x` for mixtures).
   - Decompose each single-phase region into non-overlapping **convex polytopes (`A x <= b`)** with explicit slanted half-space facets, vertices, phase/crystal-structure metadata, and closure-hash invalidation keys.
2. **Stage P3.2 — GPU Chebyshev Fitting & Residual Certification (`chebyshevPolytopeFitGpu.js`):**
   - Sample the validated lower-level closures at Chebyshev nodes inside each polytope; fit compact GPU polynomial response coefficients for every property family (EOS `ρ, P, K, G`, thermo `U, H, S, C_p`, transport `η, k, σ, γ`, EM/optical `ε, n, k, χ`, nuclear decay).
   - Enforce strict acceptance gates on held-out interior & facet-boundary points: max relative residual `< tolerance`, positivity (`ρ > 0, C_p > 0, K > 0, η >= 0`), thermodynamic stability (`∂P/∂ρ > 0`), and monotonicity. If residuals concentrate near a boundary, **automatically bisect the polytope** and refit!
   - **Fail-closed contract:** Queries outside `A x <= b` NEVER silently extrapolate — they return `'outside-domain'` and trigger Tier-2 (A3) or Tier-3 (A6 PeerCompute/Eshkol/MoonLab) derivation to synthesize and admit a new polytope at the next schedule boundary.
3. **Stage P3.3 — Interactive 3D Polytope Atlas Visualizer & Continuum Integration:**
   - Render the actual convex `(T, log10 P, property)` polytope surfaces, phase facets, sample nodes, residual heatmaps, and live cursor membership/margin diagnostics in `elements-lab.html`.
   - Pack accepted polytope atlas tables directly into ULG Studio's Tier-1 GPU material buffers (`MaterialRegistry` + `triadClosureGpuRegistry.js`), closing the full loop back into ULG's macroscopic continuum engine!

---

## 5. Representative Sub-Simulation & Accuracy-Tier Contract

ULG achieves 40 orders of magnitude by **representative sub-simulations feeding Polytope Atlases**, never by simulating every individual atom in a macroscopic block or star (`10⁵⁷` atoms): each scale `S` runs bounded representative GPU micro-simulations at scale `S−1` (1 nucleus → 1 relativistic atom → 1–8 atom periodic Bloch cell → `1,024–4,096`-atom MD volume), certifies held-out residuals inside convex polytopes (`A x <= b`), and stamps every closure and polytope artifact with an explicit **Accuracy Tier**:

- **`tier-1-quantitative` (`~0.1–10%` G7 advisory band):** Direct GPU derivations (nuclear `B(Z,A)` & `R_nuc`, Dirac–KS total energies/radii, simple/transition metal `a_0/ρ_0`, exact stoichiometric/nucleon/mass/energy conservation).
- **`tier-2-representative-effective` (`~10–35%` G7 advisory band):** Principled representative sub-simulations (`mBJ/SCAN` + `DFT+U` gaps & magnetism, Kubo–Greenwood/Bloch–Grüneisen EM/transport, DFT-fitted coexistence & Green–Kubo WebGPU MD for `T_m, T_b, η, k, γ`, CI-NEB reaction barriers & canonical compound crystal prototypes).
- **`tier-3-theoretical-envelope` (explicit uncertainty / theoretical prediction):** Zero experimental bulk reference exists or fundamental exascale/cell-size walls apply (`Z = 101..118` superheavies, 50–105 atom exotic polymorphs `α-Mn`/`β-B`/`Pu`, strongly correlated `5f` DMFT actinides, Lattice QCD). Always stamped `scientificValidation: false` with explicit blockers.

| Physics Domain | Accuracy Tier | Browser-Tractable First-Principles Method (WebGPU) | Honest Expected Accuracy (G7 Advisory) | Fundamental Physics Wall / Explicit Scope Boundary |
|---|---|---|---|---|
| **Nuclear Binding & Stability (`Z=1..118`)** | `tier-1` (`B, R_nuc`) / `tier-2` (WKB `t_{1/2}`) | Microscopic-macroscopic LDM + Strutinsky quantum shells + pairing + Woods–Saxon levels + WKB Gamow tunneling | `B(Z,A)`: `~0.1–0.5%` (`1–3 MeV`); `R_nuc`: `~2–5%`; decay modes: high; half-lives: ~1–3 orders of magnitude (log-scale WKB) | Exact **ab-initio Lattice QCD** (quarks/gluons) requires exascale supercomputers; fine excited nuclear spectra & resonant neutron cross-sections remain ENDF/B advisory territory. |
| **Relativistic Atomic QM (`Z=1..118`)** | `tier-1` (`Z=1..100`) / `tier-3` (`Z>100` fine CI) | 4-component radial Dirac–KS + spin-polarized PBE/SCAN + finite nucleus + Uehling/Welton QED | Total energy `< 0.5%`; orbital radii `~2–5%`; `I_1` `~5–10%`; relativistic `Au` color & `Hg` liquid contraction captured cleanly | Multi-reference CI / full Breit+QED fine-structure splittings in open `4f/5f` shells & `Z > 100` superheavies have `~0.1–0.5 eV` residual error; flagged in uncertainty. |
| **Solid Lattice, Elastic & Band Structure** | `tier-1` (`a_0, ρ_0`) / `tier-2` (`K, E_g`) / `tier-3` (exotic polymorphs) | GPU periodic plane-wave pseudopotential DFT + `mBJ/SCAN` + spin-polarized `DFT+U` across canonical Bravais/vdW lattices | Simple/transition metals & semiconductors: `a_0` `~1–4%`, `ρ_0` `~3–10%`, `K` `~10–20%`, `E_g` `~10–25%` (`mBJ`), `Fe/Co/Ni/Gd` ferromagnetism emergent | Complex low-symmetry 50–105 atom unit cells (`α-Mn`, `β-B`, `Pu` 6 allotropes, `S_8`) & strongly correlated `5f` DMFT actinides cannot be predicted exhaustively from `Z` alone in real time; evaluate canonical reduced cells and tag uncertainty honestly. |
| **EM, Conductivity & Optics** | `tier-2` | GPU Kubo–Greenwood + Drude `ε(ω)`, Bloch–Grüneisen `σ(T)`, Stoner/Curie–Weiss `χ(T)` | Optical colors & trends high; `σ(300K)` within factor `1.5–3×` (defect/impurity sensitive); magnetic phase (`dia/para/ferro`) qualitatively right, `T_C` within `~20–40%` | Room-temperature resistivity of semiconductors/alloys depends exponentially on defect/doping ppm; superconducting `T_c` for unconventional/cuprate/heavy-fermion phases is beyond McMillan–Allen–Dynes. |
| **Melting, Boiling, Liquids & Transport** | `tier-2` (`Z=1..100`) / `tier-3` (`Z=101..118`) | DFT-fitted pair/EAM/3-body/polarizable potentials + live representative WebGPU coexistence & Green–Kubo MD + QHA phonons | Noble gases, simple metals, ionic salts, small molecules: `T_m/T_b/ρ_liq` `~5–20%`, `η/k/γ` `~15–35%` | Directional `d/f` refractory melts (`W, Re, Os`) & anomalous H-bonded liquids need 3-body/polarizable terms; **superheavy elements `Z = 101..118`** decay in milliseconds–seconds and have **zero experimental bulk properties** (`tier-3-theoretical-envelope`, `scientificValidation: false`). |
| **Chemical Reactions & Compounds** | `tier-1` (stoich) / `tier-2` (barriers/compounds) | GPU RHF/UHF/UMP2/CAS(2,2)/CI-NEB + canonical ionic/covalent crystal prototypes + representative MD feedback | Balanced stoichiometry exact; reaction enthalpies `~10–30 kJ/mol`; compound closures qualitative-to-quantitative without hardcoded tables | Blind evolutionary crystal-structure prediction for arbitrary unknown multi-element phases (`A_x B_y C_z`) is outside real-time browser scope; canonical prototype screening + molecular MD covers primary chemistry cleanly. |

---

## 6. Execution Sequence & Verification Discipline

Every stage in Phase 0, Gate 1, and Gate 2 must pass four checks before advancing:
1. **Star Spec Anti-Shortcut Check:** Zero per-element/per-compound physics `if` branches, zero scripted animations, zero CPU-only hot-loop fallback claimed as `webgpu-derived`.
2. **GPU-Native Invariant & Conservation Suite (`ULG_RUN_NATIVE_WEBGPU=1 --test-concurrency=1`):** Exact nucleon/charge conservation, quantum normalization/orthogonality, variational energy descent, thermodynamic stability (`K > 0, C_v > 0`), MD energy/momentum conservation, polytope fail-closed out-of-domain rejection, `0` GPU/Xid errors.
3. **Sequential Visual Verification:** Inspect live screenshots of every real WebGPU visualization (nuclear density, atomic 3D orbitals/spin density, crystal Bloch density/bands/Fermi surface, live MD crystal/melting, reactive orbital evolution, 3D Polytope Atlas) — never accept unit tests alone.
4. **Offline G7 Advisory Scorecard:** Log honest median/max deviations against cached NIST/CODATA/AME2020/Materials Project snapshots without hiding outliers or blocking on scientific perfection.
