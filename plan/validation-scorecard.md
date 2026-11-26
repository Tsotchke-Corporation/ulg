# ULG Cross-Scale Scientific Validation & Calibration Scorecard

- **Schema:** `ulg.science.validation.v1` (Generated: `2026-11-26T03:55:34.370Z`)
- **Policy:** `advisory: true`, `runtimeAuthority: false`, `blocksWorkflow: false`, `scientificValidation: false` (offline empirical diagnostic only — never a runtime gate or lookup table)
- **Atlas Backend:** `webgpu-vulkan-live-z118-full-md-full-chebyshev`
- **Cached G7 Snapshots Verified:** `nist-atomic-weights`, `pubchem-periodic-table` (integrity ok: `true`, faults: `0`)
- **Overall Empirical Audit:** **173/522 agrees (33.1%)** · 349 deviations · 0 missing

## 1. Per-Domain Quantitative Summary (`10⁻¹⁵ m → 10⁺²⁵ m`)

| Domain | Evaluated | Agree | Deviate | Agreement % | Median |Err| % | Median Bias % | Top Outlier |
|---|---:|---:|---:|---:|---:|---:|---|
| 1. Nuclear Structure (10^-15 m) | 23 | 21 | 2 | 91.3% | 4.8% | +4.8% | He-4 R_ch: sim 2.29 vs ref 1.68 fm |
| 2. Atomic Weights (NIST SRD 144, Z=1..118) | 94 | 50 | 44 | 53.2% | 2.7% | -1.8% | C atomicMass: sim 14 vs ref 12 u |
| 3. Elemental Solids, Crystals & Phase Transitions (PubChem/CRC) | 321 | 50 | 271 | 15.6% | 104.2% | +104.2% | P T_boil: sim 10600 vs ref 554 K |
| 4. Compound Thermodynamics, Dielectric & Optics (NIST WebBook) | 45 | 14 | 31 | 31.1% | 51.3% | +9.1% | O3Al2 epsilon_r: sim 24600 vs ref 9.8 1 |
| 5. Organic Chemistry & Biophysics (Huckel/pKa/Mitchell) | 5 | 5 | 0 | 100.0% | 3.0% | -3.0% | — |
| 6. Planetary Gravity & Stratified Atmospheres (NASA Fact Sheets) | 27 | 27 | 0 | 100.0% | 0.7% | +0.0% | — |
| 7. Stellar Evolution & Lambda-CDM Cosmology (IAU/Planck 2018) | 7 | 6 | 1 | 85.7% | 1.8% | -0.0% | Vega(2.14Msun) L_star: sim 18.1 vs ref 40.1 L_sun |

## 2. Physics-Root-Cause Calibration Triage (Ranked by Impact)

These groups identify **underlying physical closure approximations** to refine — never per-element or per-material lookup overrides:

### 1. Elemental Melting & Boiling Points (`T_melt` / `T_boil` from cohesive energy & MD)
- **Deviations:** 181 · **Median |Err|:** 149% · **Median Bias:** +149%
- **Top Examples:** P `T_boil` (10600 vs 554 K, +1817%); Hg `T_boil` (10600 vs 630 K, +1585%); S `T_boil` (10600 vs 718 K, +1378.7%)
- **First-Principles Tuning Action:** Calibrate bulk cohesive energy E_coh (currently overestimated in 3d/4d/5d metals) and add anharmonic Lindemann/coexistence entropy terms.

### 2. Elemental Bulk DFT Density (`periodicTableEngineWebGpu.js` -> `foundation-polytope-atlas.json`)
- **Deviations:** 81 · **Median |Err|:** 84.8% · **Median Bias:** +79.9%
- **Top Examples:** Bk `density` (1.80e+5 vs 14000 kg/m^3, +1186.8%); Am `density` (1.66e+5 vs 13700 kg/m^3, +1111.5%); Pu `density` (1.62e+5 vs 19800 kg/m^3, +715.5%)
- **First-Principles Tuning Action:** Add London dispersion (vdW-D3) for noble gases/molecular halogens and spin-polarized d/f exchange for transition/actinide metals.

### 3. Hydrogen-Bonded & Molecular Crystal Packing (`H2O`, `NH3`, `CH4`)
- **Deviations:** 27 · **Median |Err|:** 92.9% · **Median Bias:** +68.3%
- **Top Examples:** O3Al2 `epsilon_r` (24600 vs 9.8 1, +250874%); NaCl `epsilon_r` (2930 vs 5.9 1, +49547%); CO2 `epsilon_r` (115 vs 1.6 1, +7071.5%)
- **First-Principles Tuning Action:** Replace close-packed molecular-fcc (CN=12) fallback with directional H-bond tetrahedral coordination (CN=4 for ice Ih) and Kirkwood g_K dipolar correlation for polar liquid dielectric epsilon_r.

### 4. Nuclear Binding & Shell Closure (`nuclearStructureGpu.js`)
- **Deviations:** 44 · **Median |Err|:** 4.5% · **Median Bias:** -4%
- **Top Examples:** C `atomicMass` (14 vs 12 u, +16.5%); Si `atomicMass` (32 vs 28.1 u, +13.8%); S `atomicMass` (36 vs 32.1 u, +12.1%)
- **First-Principles Tuning Action:** Refine surface-symmetry & Strutinsky pairing terms for light (A<=16) and doubly-magic nuclides.

### 5. Solid Bulk Modulus & Debye Temperature
- **Deviations:** 9 · **Median |Err|:** 87.3% · **Median Bias:** -65.2%
- **Top Examples:** W `B0` (1650 vs 310 GPa, +433.8%); Si `B0` (267 vs 98 GPa, +172%); Fe `B0` (452 vs 170 GPa, +165.8%)
- **First-Principles Tuning Action:** Tighten Murnaghan/Birch-Murnaghan curvature from spin-polarized DFT cohesion so B_0 & theta_D match Metals/Covalent solids.

### 6. Molecular Optical Gap & Refractive Index (RHF minimal basis)
- **Deviations:** 4 · **Median |Err|:** 15% · **Median Bias:** -15%
- **Top Examples:** O3Fe2 `n(550nm)` (1.54 vs 2.94 1, -47.5%); H4C `n(550nm)` (1.09 vs 1.29 1, -15.7%); H3N `n(550nm)` (1.14 vs 1.32 1, -14.2%)
- **First-Principles Tuning Action:** Include diffuse polarization basis functions / GW-scissors self-energy correction to remove ~2x STO-3G RHF HOMO-LUMO gap overshoot and improve n(550 nm).

### 7. Finite Nuclear Charge Radius (`nuclearChargeRadiusFm`)
- **Deviations:** 2 · **Median |Err|:** 24.6% · **Median Bias:** +24.6%
- **Top Examples:** He-4 `R_ch` (2.29 vs 1.68 fm, +37%); C-12 `R_ch` (2.77 vs 2.47 fm, +12.3%)
- **First-Principles Tuning Action:** Refine 2-parameter Fermi skin thickness a_0 / r_0 scaling (r_0 ~ 1.18 fm vs 1.25 fm for heavy Z).

### 8. Lambda-CDM Cosmology & Stellar Evolutionary Scaling (`cosmicEpochState.js`)
- **Deviations:** 1 · **Median |Err|:** 54.8% · **Median Bias:** -54.8%
- **Top Examples:** Vega(2.14Msun) `L_star` (18.1 vs 40.1 L_sun, -54.8%)
- **First-Principles Tuning Action:** Extend mass-luminosity / main-sequence radius scaling across low-mass M-dwarf convective interiors and high-mass radiative stars.

