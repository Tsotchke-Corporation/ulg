# ULG Physics Gap Survey & First-Principles Organic Chemistry + Emergent Biology Integration Plan

- **Date:** 2026-11-25 AKST
- **Authority:** Subordinate to [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md) & [`AGENTS.md`](../../AGENTS.md) (Star Spec v0.4, Universal Law Graph general-law thesis, GPU-native validation, zero `@workgroup_size(1)` additions, zero private 4,096-bucket hashes, zero species/material/preset physics hacks).
- **Status:** **ACTIVE IMPLEMENTATION PLAN**

---

## 1. Comprehensive Physics & Chemistry Gap Survey Across ULG's 40-OOM Span

ULG now spans `10⁻¹⁵ m` (Woods–Saxon nuclei + Visscher α-tunneling) through `10⁻¹⁰..10⁻⁸ m` (`Z=1..118` 4-comp Dirac–KS, bulk DFT, 2D/3D optical FDTD, sLLG magnetism, Drude–Boltzmann transport, closed-shell RHF/CI-NEB, 20-compound inorganic Polytope Atlas, LJ/EAM/SW MD), `10⁻⁶..10⁺² m` (Schroeder `SS` + MLS-MPM + exact `2^-149` ledgers + coherent elasto-plastic/fracturing solids + composite DLM particle-rigid dynamics + refraction/Cherenkov), and `10⁺⁶..10⁺²⁵ m` (16-node Astrophysical & Planetary Surface Universal Law Graph + Cosmic Epoch Spine `z=1100 → +5 Gyr`).

Auditing live `src/runtime/`, `ulg-gpu-abi/`, and all three flagship demos (`index.html`, `elements-lab.html`, `universes.html`) identifies the **6 glaring large physics gaps**, ranked by architectural impact:

| Priority | Missing Domain | Scale Span | Why It Is a Glaring Gap Today |
|---|---|---|---|
| **P0 (CRITICAL)** | **Organic Chemistry** | `10⁻¹⁰ → 10⁻⁸ m` | Only `CH4` and complete combustion exist. `buildMolecularSeedGeometryBohr` caps at 12 single-center atoms; `molecularDynamicsWebGpu.js` lacks covalent bond orders, dihedral torsions, `sp/sp²/sp³` hybridization, `π`-conjugation/aromaticity, chirality (`R/S`, `E/Z`), open-shell radicals, mechanistic organic reactions (`SN2`, `E2`, carbonyl, amide/ester, Diels–Alder, polymerization), and dielectric solvation / `pK_a` proton transfer. |
| **P0 (CRITICAL)** | **Biochemistry, Molecular Biophysics & Emergent Biology** | `10⁻⁹ → 10⁻² m` | **0% implemented across the entire repo** — leaves the mesoscale matter-to-life bridge completely empty: no prebiotic autocatalytic RAF sets, no amphiphilic lipid bilayer/protocell self-assembly, no heteropolymer/protein folding or pocket catalysis, no complementary template replication / Eigen error threshold / Darwinian selection, no chemiosmotic proton-motive force & ATP bioenergetics, no PNP/Hodgkin–Huxley excitable membranes, and no Turing reaction-diffusion morphogenesis or chemotactic active matter. |
| **P1** | **Macroscopic 3D Maxwell FDTD & Kinetic PIC Plasma** | `10⁻⁶ → 10⁺¹² m` | Optical FDTD is 2D slab (`128×128`) or single-atom 3D; nebular MHD is fluid-only. Missing general 3D continuum Maxwell FDTD (waveguides, eddy currents, radiation pressure) and kinetic Vlasov–Maxwell PIC plasma (Landau damping, collisionless reconnection, Debye sheaths). |
| **P1** | **Quantum Many-Body Condensates & Topological Matter** | `10⁻¹⁰ → 10⁻² m` | Only effective two-fluid BCS fraction exists. Missing Gross–Pitaevskii (GPE) BEC/superfluid quantized vortices, Ginzburg–Landau Type-II Abrikosov flux lattices / Meissner expulsion, and Berry-curvature / Chern topological edge states. |
| **P2** | **Non-Newtonian Soft Matter, Multi-Level Wetting/Capillarity & Compressible Shock Hydro** | `10⁻⁶ → 10⁺² m` | Surface tension is default-OFF single-level only; continuum fluid is weakly-compressible Tait. Missing Oldroyd-B/FENE-P viscoelastic polymers, liquid-crystal nematic Q-tensors, Marangoni capillarity, and Godunov/Riemann stiff shock detonation hydro. |
| **P2** | **3D Spherical Mantle Tectonics, Core Geodynamo MHD & Radiation Transport / 3+1 GR** | `10⁻¹⁵ / 10⁺³ → 10⁺¹⁰ m` | Planetary interior is 1D radial; core dynamo is parametric. Missing 3D visco-plastic mantle convection / plate subduction, self-consistent spherical MHD dynamo reversals, neutron/gamma transport, and 3+1 BSSN numerical relativity. |

---

## 2. Core Thesis & Star-Spec Anti-Shortcut Architectural Rules

Every organic-chemistry and emergent-biology module MUST strictly obey ULG's Star Spec v0.4 & General-Law Thesis:

1. **Zero species/molecule/organism name hacks:** Never write `if (mol === 'benzene')`, `if (residue === 'ALA')`, `if (base === 'ATP')`, or scripted cell-division animations. Every structure and behavior must emerge from **general continuous physical descriptors** derived from Gate 1 elements & universal laws:
   - Atomic valence capacity, Pauling electronegativity `χ_i`, chemical hardness `η_i`, covalent & vdW radii `r_cov, r_vdw`, hybridization orbital count (`sp` / `sp²` / `sp³`), bond order `b_ij`, partial charge `q_i`, H-bond donor/acceptor polarity, and hydrophobic solvation free energy `ΔG_solv`.
2. **Unify onto `UNIVERSAL_LAW_GRAPH_NODES` & `LAW_ADAPTER_CONTRACT`:**
   - Extend `FUNDAMENTAL_LAW_FAMILIES` in `src/runtime/universalLawGraph.js` with `CHEMICAL_BONDING` (`chemical-bonding`), `SOFT_MATTER_BIOPHYSICS` (`soft-matter-biophysics`), and `REACTION_DIFFUSION_ACTIVE` (`reaction-diffusion-active`).
   - Register every new law with full `LAW_ADAPTER_CONTRACT` metadata (`CANONICAL_SS_EPOCH`, `0` private 4,096-bucket hashes, explicit reads/writes/accumulates, `validityDomain`, `scientificValidation: false`), and state-driven `evaluateActivation(physicalState)` so organic/bio laws remain strictly dormant (`0` dispatches) in inorganic/astrophysical regimes.
3. **100% WebGPU Compute & Direct Zero-Copy Rendering:**
   - Parallel `@workgroup_size(64)` / `@workgroup_size(8, 8)` compute shaders (`0` new `@workgroup_size(1)` kernels — preserving the `<= 233` permanent ratchet).
   - Reuse ULG's shared numerical spine (`batchedSymmetricEigensolverGpu.js`, `fft3dWebGpu.js`, `SimulationModuleRegistry`, `ClosureRegistry`) and single-submit direct WebGPU rendering (`rgba16float` HDR + ACES, `cameraAutoSpin: false` default).
4. **Falsifiable Physical Invariant Tests (Breaks Hacks!):**
   - Every law must ship with explicit null-limit & invariance proofs:
     - **Aromaticity:** `4n+2` cyclic `π`-rings (`N=6`, benzene-like) yield strictly lower `π`-energy per electron than `4n` anti-aromatic rings (`N=4`) directly from GPU Hückel eigensolver!
     - **Chirality:** Exact mirror reflection `(x, y, z) -> (-x, y, z)` flips signed tetrahedral stereocenter determinant (`R <-> S`) while keeping scalar energy bit-identical!
     - **Solvation & `pK_a`:** Increasing dielectric constant `ε_r` from `1` (vacuum) → `78.4` (water) lowers ionic transition-state / dissociation energy continuously (`ΔG_Born ∝ (1 - 1/ε_r)`).
     - **Membrane Self-Assembly:** Turning hydrophobic coupling `ε_hp = 0` prevents bilayer/vesicle clustering; enabling `ε_hp > 0` spontaneously assembles amphiphilic clusters/bilayers from random gas!
     - **Enzyme Catalysis & Folding:** Heating above `T_melt` unfolds the hydrophobic core and destroys pocket electrostatic barrier lowering (`k_cat` collapses back to uncatalyzed rate)!
     - **Eigen Error Threshold:** Increasing thermal copy mutation rate `μ` across `μ_crit = ln(σ)/L` transitions sharp quasispecies survival into error catastrophe!
     - **Chemiosmosis & Excitability:** Zero proton gradient `Δp = 0` yields strictly `0` ATP synthesis; zero voltage-gated `Na⁺` conductance `g_Na = 0` suppresses action-potential propagation!
     - **Active Matter & Morphogenesis:** Turning off self-propulsion `v_0 = 0` or chemical gradient `∇c = 0` collapses chemotactic drift strictly to unbiased thermal diffusion!

---

## 3. Two-Wave Implementation Roadmap & Flagship WebGPU Demos

### Wave A — Organic Chemistry Engine (`src/runtime/organic/`) & Flagship **`organic-lab.html`**

**3 Canonical WebGPU Law Modules (Universal Law Graph Nodes #17–19):**
1. **`src/runtime/organic/organicMolecularGraphGpu.js`** (`organic-molecular-graph-hybridization@1`):
   - General multi-center molecular graph topology & 3D coordinate generator (arbitrary chains, branches, cycloalkanes, conjugated polyenes, aromatic rings, heterocycles, amino acids, nucleotides, lipids, and custom user-built graphs from `H, C, N, O, F, P, S, Cl, Br`).
   - Automatic `sp` / `sp²` / `sp³` hybridization inference, signed-volume 3D stereocenter (`R`/`S`) & alkene (`E`/`Z`) detection.
   - **GPU Extended-Hückel / `π`-MO Eigensolver** (directly using `batchedSymmetricEigensolverGpu.js`!) computing molecular orbital eigenvalues, HOMO–LUMO gap, UV-Vis `λ_max`, bond orders, and Hückel `4n+2` resonance stabilization energy.
   - **GPU QEq Charge Equilibration** solving `Σ J_ij q_j + χ_i = μ` (with `Σ q_i = Q_tot`) directly from Gate 1 electronegativity & hardness to output live atomic partial charges and molecular dipole moment!
2. **`src/runtime/organic/reactiveBondOrderMdGpu.js`** (`reactive-bond-order-md@1`):
   - Live 3D WebGPU reactive molecular dynamics engine (`@workgroup_size(64)`): continuous Tersoff/REBO-style bond-order stretch, angle bend, periodic dihedral torsions (`V_n(1 + cos(nφ - γ))`), improper out-of-plane planarity, directional `D–H···A` hydrogen bonding, screened Coulomb electrostatics with continuous Generalized-Born dielectric constant `ε_r`, and Langevin thermostat.
   - Live reaction-trajectory & conformational dynamics: ethane/butane torsional scans, cyclohexane chair–boat inversion, `SN2` backside Walden umbrella inversion, `E2` elimination, carbonyl nucleophilic addition, peptide/ester condensation, Diels–Alder `[4+2]` cycloaddition, and radical chain polymerization!
3. **`src/runtime/organic/acidBaseCatalysisGpu.js`** (`acid-base-catalysis-kinetics@1`):
   - First-principles `pK_a` & Brønsted–Lowry proton-transfer solver derived from QEq conjugate-base charge delocalization + inductive/resonance stabilization + Born solvation `ε_r`, generating continuous `pH 0..14` speciation & titration curves.
   - 2D/3D WebGPU **Prebiotic & Autocatalytic Chemical Reaction Network (`128×128` spatial reaction-diffusion + mass-action)** supporting Miller–Urey/Strecker prebiotic synthesis, Belousov–Zhabotinsky chemical oscillators, and **Frank Chiral Symmetry Breaking** (`ee(t) → ±100%` from symmetric racemic noise!).

**Flagship App: `organic-lab.html` ("ULG Organic Chemistry Lab"):**
- Matches `elements-lab.html` 3-column scientific workbench polish: left collapsible sections (Molecular Structure & Aromaticity, Conformational & Stereochem MD, Reactive Mechanisms & Polymerization, Solvation / `pK_a` & Autocatalytic Networks), custom SMILES-like/builder controls (temperature `T`, solvent dielectric `ε_r`, `pH`, chiral mirror button, reaction drive), pure-WebGPU 3D renderer (lit atoms, continuous bond-order cylinders, glowing `π`-MO orbital lobes, ESP dipole coloring, H-bond vectors, and 2D/3D spatial autocatalytic fields), and right dock with **3 live 2D scientific plots** (MO Energy & UV-Vis Spectrum, Dihedral/Reaction Coordinate `ΔG(ξ)`, and `pH` Speciation / Enantiomeric Excess `ee(t)`), full Provenance Inspector, and `ⓘ About` modals!

---

### Wave B — Emergent Biology & Biophysics Engine (`src/runtime/biology/`) & Flagship **`life-lab.html`**

**5 Canonical WebGPU Law Modules (Universal Law Graph Nodes #20–24):**
1. **`src/runtime/biology/amphiphileMembraneGpu.js`** (`amphiphile-membrane-self-assembly@1`):
   - Live 3D WebGPU coarse-grained amphiphile MD (`2,048–4,096` head-tail-tail lipid beads + solvent/osmolyte forces): spontaneous hydrophobic self-assembly from disordered soup → micelles → planar bilayers → **closed 3D protocell vesicles**, Helfrich curvature tracking, osmotic swelling, and chemically fueled vesicle budding/division!
2. **`src/runtime/biology/biopolymerFoldingGpu.js`** (`biopolymer-folding-catalysis@1`):
   - Live 3D WebGPU heteropolymer chain Langevin MD (arbitrary sequence of Hydrophobic `H`, Polar `P`, Positive `+`, Negative `−` monomers): backbone bond/angle/Ramachandran `(φ,ψ)` torsions, directional backbone H-bonding, hydrophobic core collapse into α-helices, β-sheets, and globular folds, PLUS **live 3D catalytic binding pocket** computing substrate transition-state electrostatic stabilization `ΔΔG‡` and Michaelis–Menten turnover `v([S])` dynamically from pocket geometry (denatures cleanly above `T_melt`!).
3. **`src/runtime/biology/templateReplicationGpu.js`** (`template-replication-evolution@1`):
   - Live WebGPU complementary H-bond + `π`-stacking oligomer physics + **parallel population quasispecies / protocell replication engine**: strand hybridization & UV/thermal melting curve `T_m`, template-directed copying with physical thermal error rate `μ(T)`, emergent **Eigen Error Threshold** (`μ_crit`), and protocell-encapsulated Darwinian fitness ascent!
4. **`src/runtime/biology/membraneBioenergeticsGpu.js`** (`chemiosmotic-bioenergetics-electrophysiology@1`):
   - Live WebGPU **Transmembrane Chemiosmotic Proton-Motive Force (`Δp = Δψ - 2.3(RT/F)ΔpH`) + Rotary ATP-Synthase Mechanochemical Coupling** AND **2D/3D Excitable Membrane Field (`128×128` Hodgkin–Huxley / PNP Ion-Channel Cable & Spiral Action-Potential Waves)** with live ion conductance knobs (`g_Na`, `g_K`, `H⁺` gradient, uncoupler protonophore)!
5. **`src/runtime/biology/morphogenesisActiveMatterGpu.js`** (`reaction-diffusion-active-matter@1`):
   - Live WebGPU **Reaction-Diffusion Morphogenesis** (`128×128` activator-inhibitor Turing patterns: spots, stripes, labyrinths, axial morphogen thresholds) **coupled directly** to **2,048–4,096 live Chemotactic Active-Matter Agents / Protocells** exhibiting run-and-tumble chemotaxis up nutrient gradients, quorum-sensing collective waves, and contractile active-gel clustering!

**Flagship App: `life-lab.html` ("ULG Biophysics & Emergent Life Lab"):**
- Matches `elements-lab.html` & `universes.html` flagship polish: 3-column WebGPU scientific workbench spanning all 5 mesoscale emergence layers (`Amphiphiles & Protocells → Biopolymer Folding & Catalysis → Template Replication & Evolution → Chemiosmosis & Excitable Membranes → Turing Morphogenesis & Active Matter`), interactive biophysical knobs (`T`, hydrophobic `ε_hp`, sequence editor, mutation rate `μ`, `ΔpH` / `g_Na`, activator/inhibitor diffusion `D_u/D_v`, active propulsion `v_0`), pure direct-WebGPU 3D/2D renderer (zero Three.js, 1 submit/frame), **3 live 2D scientific plots** (e.g., Hydrophobic Order / Radius of Gyration `R_g(t)`, Ramachandran `(φ, ψ)` & Folding Funnel / Melting `T_m`, Quasispecies Fitness & Eigen Threshold, Action Potential `V_m(t)` & ATP Flux, Turing `P(k)` & Chemotactic Drift), full Law-Graph provenance inspector, and cross-navigation links across all 5 ULG flagship apps (`index.html`, `elements-lab.html`, `organic-lab.html`, `life-lab.html`, `universes.html`)!

---

## 4. Verification & Acceptance Checklist (Per Wave)

1. `validateUniversalLawGraphContracts()` passes with `0` errors, `0` private-grid debt, and `0` new `@workgroup_size(1)` kernels across all new modules (`<= 233` ratchet).
2. Host unit test suites (`tests/organicChemistryLaws.test.mjs`, `tests/emergentBiologyLaws.test.mjs`) verify every analytic physical law & null-limit invariant.
3. Live headless Vulkan WebGPU native suites (`tests/organicLab.native.test.mjs`, `tests/lifeLab.native.test.mjs`) run sequentially (`--test-concurrency=1`, `MemoryMax=4G`, `CPUQuota=50%`), prove live GPU motion (`changedPixelCount`), zero GPU/page/console errors, capture full PNG suites across every lab mode, visually inspect every PNG via `read_file`, fix all visual/physics critiques, and confirm `KERNEL_CLEAN`.
4. Update `vite.config.mjs` & `vite.pages.config.mjs` (do NOT run `npm run build:pages` or touch `docs/` until authorized by **big dog**).
