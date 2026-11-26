# ULG Cross-Scale Scientific Validation & Calibration Scorecard

- **Schema:** `ulg.science.validation.v1` (Generated: `2026-11-26T10:43:40.436Z`)
- **Policy:** `advisory: true`, `runtimeAuthority: false`, `blocksWorkflow: false`, `scientificValidation: false` (offline empirical diagnostic only — never a runtime gate or lookup table)
- **Atlas Backend:** `webgpu-vulkan-live-z118-full-md-full-chebyshev`
- **Cached G7 Snapshots Verified:** `nist-atomic-weights`, `pubchem-periodic-table` (integrity ok: `true`, faults: `0`)
- **Overall Empirical Audit:** **339/551 agrees (61.5%)** · 212 deviations · 0 missing

## 1. Per-Domain Quantitative Summary (`10⁻¹⁵ m → 10⁺²⁵ m`)

| Domain | Evaluated | Agree | Deviate | Agreement % | Median |Err| % | Median Bias % | Top Outlier |
|---|---:|---:|---:|---:|---:|---:|---|
| 1. Nuclear Structure (10^-15 m) | 23 | 23 | 0 | 100.0% | 1.1% | +0.1% | — |
| 2. Atomic Weights (NIST SRD 144, Z=1..118) | 94 | 84 | 10 | 89.4% | 0.9% | -0.7% | Li atomicMass: sim 6.01 vs ref 6.97 u |
| 3. Elemental Solids, Crystals & Phase Transitions (PubChem/CRC) | 323 | 138 | 185 | 42.7% | 41.2% | -18.6% | He T_melt: sim 10.1 vs ref 0.95 K |
| 4. Compound Thermodynamics, Dielectric & Optics (NIST WebBook) | 48 | 31 | 17 | 64.6% | 12.4% | +6.6% | CO2 epsilon_r: sim 3.76 vs ref 1.6 1 |
| 5. Organic Chemistry & Biophysics (Huckel/pKa/Mitchell) | 7 | 7 | 0 | 100.0% | 3.0% | +0.0% | — |
| 6. Planetary Gravity & Stratified Atmospheres (NASA Fact Sheets) | 29 | 29 | 0 | 100.0% | 0.8% | +0.0% | — |
| 7. Stellar Evolution & Lambda-CDM Cosmology (IAU/Planck 2018) | 7 | 7 | 0 | 100.0% | 1.9% | -0.0% | — |
| 8. Relativistic Kerr/BZ, Roche & Binary Astrophysics | 6 | 6 | 0 | 100.0% | 0.0% | -0.0% | — |
| 9. Xenobiology, Photobiology, Redox & Evolutionary Allometry | 7 | 7 | 0 | 100.0% | 3.7% | +3.7% | — |
| 10. Universal Law Graph (32 Nodes) & 40-OOM Schroeder SS Tree | 7 | 7 | 0 | 100.0% | 0.0% | +0.0% | — |

## 2. Physics-Root-Cause Calibration Triage (Ranked by Impact)

These groups identify **underlying physical closure approximations** to refine — never per-element or per-material lookup overrides:

### 1. Elemental Melting & Boiling Points (`T_melt` / `T_boil` from cohesive energy & MD)
- **Deviations:** 123 · **Median |Err|:** 60.1% · **Median Bias:** -46.7%
- **Top Examples:** He `T_melt` (10.1 vs 0.95 K, +959.1%); Sn `T_melt` (3280 vs 505 K, +548.4%); As `T_boil` (4230 vs 887 K, +376.9%)
- **First-Principles Tuning Action:** Calibrate bulk cohesive energy E_coh (currently overestimated in 3d/4d/5d metals) and add anharmonic Lindemann/coexistence entropy terms.

### 2. Elemental Bulk DFT Density (`periodicTableEngineWebGpu.js` -> `foundation-polytope-atlas.json`)
- **Deviations:** 54 · **Median |Err|:** 50.6% · **Median Bias:** -48.3%
- **Top Examples:** Li `magneticPhase` (diamagnetic vs paramagnetic class, +100%); C `magneticPhase` (paramagnetic vs diamagnetic class, +100%); Na `magneticPhase` (diamagnetic vs paramagnetic class, +100%)
- **First-Principles Tuning Action:** Add London dispersion (vdW-D3) for noble gases/molecular halogens and spin-polarized d/f exchange for transition/actinide metals.

### 3. Hydrogen-Bonded & Molecular Crystal Packing (`H2O`, `NH3`, `CH4`)
- **Deviations:** 15 · **Median |Err|:** 59.7% · **Median Bias:** +57.8%
- **Top Examples:** CO2 `epsilon_r` (3.76 vs 1.6 1, +135.1%); H4C `C_p` (7770 vs 3480 J/(kg*K), +123.4%); CO2 `C_p` (1700 vs 846 J/(kg*K), +101%)
- **First-Principles Tuning Action:** Replace close-packed molecular-fcc (CN=12) fallback with directional H-bond tetrahedral coordination (CN=4 for ice Ih) and Kirkwood g_K dipolar correlation for polar liquid dielectric epsilon_r.

### 4. Solid Bulk Modulus & Debye Temperature
- **Deviations:** 6 · **Median |Err|:** 102.9% · **Median Bias:** +87.2%
- **Top Examples:** Si `B0` (459 vs 98 GPa, +368.7%); C `B0` (1090 vs 442 GPa, +146.9%); Al `B0` (162 vs 76 GPa, +112.8%)
- **First-Principles Tuning Action:** Tighten Murnaghan/Birch-Murnaghan curvature from spin-polarized DFT cohesion so B_0 & theta_D match Metals/Covalent solids.

### 5. Nuclear Binding & Shell Closure (`nuclearStructureGpu.js`)
- **Deviations:** 10 · **Median |Err|:** 5.2% · **Median Bias:** -4.2%
- **Top Examples:** Li `atomicMass` (6.01 vs 6.97 u, -13.7%); Be `atomicMass` (8.01 vs 9.01 u, -11.2%); B `atomicMass` (10 vs 10.8 u, -7.4%)
- **First-Principles Tuning Action:** Refine surface-symmetry & Strutinsky pairing terms for light (A<=16) and doubly-magic nuclides.

### 6. Molecular Optical Gap & Refractive Index (RHF minimal basis)
- **Deviations:** 4 · **Median |Err|:** 19.5% · **Median Bias:** +19.5%
- **Top Examples:** Au `relativisticGoldShift` (false vs true class, +100%); Ag `neutralSilverReflectance` (false vs true class, +100%); O3Al2 `n(550nm)` (2.21 vs 1.77 1, +25.2%)
- **First-Principles Tuning Action:** Include diffuse polarization basis functions / GW-scissors self-energy correction to remove ~2x STO-3G RHF HOMO-LUMO gap overshoot and improve n(550 nm).

