# First-Principles Scientific Validation & Calibration Layer (Post-G7 Cross-Scale Audit Framework)

> **Status:** Planned Priority #1 (`plan/todo/`).
> **Foundation:** Builds directly on accepted G7 (`plan/done/g7-release-audit.md`, `src/tools/scienceReleaseAudit.js`, `scripts/science-release-audit.mjs`), preserving the Star Spec hard rule that empirical audits remain **strictly offline, operator-side, and advisory** (`advisory: true`, `runtimeAuthority: false`, `blocksWorkflow: false`) — never a curve-fitting lookup table or runtime admission gate.

---

## 1. Objective

Today, G7 audits static entries in `data/material-properties/elements.json` against cached PubChem & NIST atomic weights snapshots. This initiative expands G7 into a **live simulation-output validation and tuning framework** that actually executes ULG's WebGPU & first-principles physics engines across every scale (`10⁻¹⁵ m → 10⁺²⁵ m`), compares simulated physical observables against immutable public empirical reference datasets, and produces actionable diagnostic scorecards pinpointing **which physical terms need deeper modeling** (never ad-hoc material hacks!).

---

## 2. Target Validation Suites & Public Reference Databases

| Domain & Scale | Live ULG Simulator Audited | Immutable Public Reference Datasets | Key Audited Observables |
|---|---|---|---|
| **Nuclear (`10⁻¹⁵ m`)** | `periodicTableEngineWebGpu` (`Z=1..118`, `(Z, A)` isotopes) + Visscher TDSE | **AME2020** (Atomic Mass Evaluation), **NuDat 3 / NNDC** | Binding energy per nucleon `B(Z, A)/A`, charge radius `R_ch`, α/β/EC `Q`-values, shell magic gaps |
| **Atomic & Optical (`10⁻¹⁰ m`)** | Dirac–KS SCF + 3D TD-KS/FDTD + optical dispersion | **NIST ASD** (Atomic Spectra Database), **NIST SRD 144**, **CODATA 2022** | First ionization energy `IE₁`, covalent/vdW radii, static polarizability `α`, relativistic color (`Au`/`Ag`/`Cu`/`Cs`), refractive index `n(λ)` & extinction `k(λ)` |
| **Bulk Solids & Phase (`10⁻⁹ m`)** | Bulk Periodic DFT + 100K WebGPU MD + Gate 2 Polytope Atlas | **Materials Project**, **CRC Handbook**, **NIST Chemistry WebBook** | Equilibrium crystal class (`fcc`/`bcc`/`hcp`/`diamond`), lattice constant `a₀`, mass density `ρ₀`, bulk modulus `B₀`, `T_melt`, `T_boil`, heat capacity `C_p`, enthalpy of fusion/vaporization, band gap `E_g` |
| **Chemistry & Reactions (`10⁻¹⁰ m`)** | WebGPU RHF + CI-NEB + `organicChemistryGpu` (`QEq`, `pK_a`, Hückel, `V(θ)`) | **PubChem**, **NIST WebBook**, **CCCBDB** | Equilibrium bond lengths & angles, dipole moments, reaction enthalpies `ΔH_rxn`, activation barriers `E_a`, organic `pK_a`, conformational barriers (butane/cyclohexane/Sulflower) |
| **Continuum Fluid & Solid (`10⁻³..10⁺² m`)** | `index.html` MLS-MPM / SS Continuum Engine | **IAPWS-95** (Water EOS), **NIST REFPROP**, classic analytical benchmarks | Hydrostatic density/pressure profiles, sound speed `c_s`, buoyancy/Archimedes sinking of dense solids, Stefan melting/freezing front speed, exact `2^-149` mass/energy conservation |
| **Biophysics (`10⁻⁹..10⁻⁴ m`)** | `life-lab.html` (`biopolymerFoldingGpu`, `vesicle`, `hodgkinHuxley`) | **RCSB PDB**, **Hodgkin & Huxley (1952)** | Radius of gyration `R_g` scaling (`N^0.33` globular vs `N^0.59` IDP), contact-order folding kinetics, action potential peak (`+30..+40 mV`), threshold & refractory period |
| **Planetary, Stellar & Cosmological (`10⁺⁶..10⁺²⁵ m`)** | `universes.html` (Hydrostatic Interiors, Lane–Emden/Fusion, TOV, TreePM `P(k)`) | **PREM** (Earth interior), **NASA Planetary Fact Sheets**, **MESA / Gaia DR3**, **Planck 2018 / CAMB** | Core pressure/density & Moment-of-Inertia `I/(MR²)`, Main-Sequence Mass–Luminosity–Radius (`L ∝ M^3.5`), Chandrasekhar & TOV NS mass limits, linear growth `D(z)` & matter power spectrum `P(k)` |

---

## 3. Framework Architecture

1. **Immutable Provenance Snapshot Store (`scripts/science-snapshot-ingest.mjs`):**
   - Extend existing SHA-256 + read-only manifest ingestion to all new reference parsers (AME2020, NIST ASD, NIST WebBook, Materials Project export, PREM, NASA Fact Sheets, Planck `P(k)`).
2. **Unified Live Validation Harness (`src/tools/scientificValidationFramework.js` & `scripts/run-scientific-validation.mjs`):**
   - Runs headless host + native Vulkan probes across declared physics suites, emitting one standardized `ulg.science.validation.v1` JSON + Markdown report.
   - Tracks **accuracy tier**, **signed error**, **median absolute percentage error (MAPE)**, **worst outliers**, and **regression diffs** against the previous verified baseline!
3. **Physics-Root-Cause Triage & Calibration Ledger:**
   - Automatically groups outliers by **missing physical law / closure approximation** rather than by element name (e.g., *"3d/5d transition metal `T_melt` overshoot → anharmonic phonon / d-band cohesion refinement"*, *"noble-gas `T_boil` → dispersion `C_6 / r^6` London term"*, *"actinide `5f` density → DFT+U / 4-component Dirac–KS"*).
   - Surfaces live **Advisory Validation Scorecard** inside an operator panel / `plan/validation-scorecard.md` (with `scientificValidation: false` honestly preserved until independent domain accuracy thresholds are met).

---

## 4. Acceptance & Verification Plan

- Offline execution (`globalThis.fetch` throws) verified by unit tests.
- Every dataset verifies cryptographic manifest SHA-256 + unit normalization.
- Live Vulkan validation run produces real quantitative MAPE tables across all 7 domains (`Nuclear`, `Atomic/Optical`, `Bulk/Phase`, `Chemistry`, `Continuum`, `Biophysics`, `Astrophysics`) with zero curve-fitting hacks.
