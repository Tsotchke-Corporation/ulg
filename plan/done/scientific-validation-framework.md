# First-Principles Scientific Validation & Calibration Layer (Post-G7 Cross-Scale Audit Framework)

> **Status:** Active Priority #1 (`plan/todo/` — framework live at `de7fc5f2`, calibration & benchmark expansion hardened 2026-11-25 against live code audit).
> **Foundation:** Builds on accepted G7 (`plan/done/g7-release-audit.md`) and `src/tools/scientificValidationFramework.js` (`522` baseline observables, `173/522 = 33.1%` pre-calibration), preserving `advisory: true`, `runtimeAuthority: false`, `blocksWorkflow: false`, `scientificValidation: false` — strictly general first-principles physics, zero per-element or per-material lookup hacks.

---

## 1. Verified Root-Cause Physics Calibration Plan (Zero Material Hacks)

Every calibration below fixes a genuine mathematical or physical modeling bug in ULG's general first-principles equations:

### 1.1 Nuclear Structure (`src/runtime/nuclear/nuclearStructureGpu.js` — JS & WGSL in lockstep)
1. **Beta-Stability Valley & `qEC` Sign Fix (`:78-114`, `:221-245`, WGSL `:426-459`):**
   - Fix `qEC` electron-mass sign bug at `:236` (`-(M_NEUTRON - M_PROTON - M_ELECTRON)` instead of `+ M_ELECTRON`).
   - Add standard Myers–Swiatecki / Kirson Wigner `T = 0` congruence energy `-37.0 * |N - Z| / A` with calibrated LDM constants (`a_V=15.80, a_S=17.80, a_C=0.711, a_A=22.70, a_P=11.18`) and tightened Strutinsky shell width (`1.15 + 0.022 * m`, amplitude `2.4 MeV`).
   - Reject nucleon drip-line unbound nuclides and select `mostStableMassNumberForZ(Z)` at the bottom of the isobaric beta-stability valley rather than fixed-`Z` `B/A` (fixing `C-14 -> C-12`, `Si-32 -> Si-28`, `Pb-198 -> Pb-206`, `U-226 -> U-236` while preserving `tripleAlphaJPerKgHe ∈ [5.0e13, 9.5e13]`).
2. **Finite Nuclear Charge Radius (`nuclearChargeRadiusFm`, `:120-128`, `:536`, `:797`):**
   - Replace double-counted `rHalf = 1.23 A^{1/3}` + constant skin floor (`>= 1.944 fm`) with point-nucleon `c = max(0, 1.128 A^{1/3} - 0.89 A^{-1/3})`, vanishing-core skin taper `aDiff = 0.523 (1 - exp(-c/1.15))`, exact A-body center-of-mass recoil `(1 - 1/A)`, and finite proton charge radius convolution `r_p = 0.8414 fm` (`He-4: 2.29 -> 1.62 fm`, `C-12: 2.77 -> 2.42 fm`, `Pb-208: 5.47 fm`, `11/11` AME2020 PASS).

### 1.2 Elemental Bulk DFT, Cohesive Energy, Actinide `5f` Repulsion & MD (`periodicBulkDftWebGpu.js`, `elementMdClosureWebGpu.js`)
1. **Fix Unreferenced Jellium `E_coh` Ceiling (`periodicBulkDftWebGpu.js:449`):** Stop taking `0.45 * |E_solid|` relative to fully ionized `M^{zv+}` (which pinned `86/118` elements at `11.0 eV` -> `T_b = 10,613 K`); compute true cohesive energy `E_coh = E_sp_coh + max(0, -eBand_eq)` with Dirac relativistic `6s²` inert-pair suppression (`Hg`).
2. **Fix Actinide `5f` Collapse (`:231-234`, `:330-339`):** Add mandatory `4f`/`5f` core Pauli repulsion wall (`+0.28 * wF * (fOcc/14 + 0.40) * (rF0/rWs)^6`) alongside `f`-band attraction and derive `rc` from valence shell electron count instead of fixed `0.88 * total` (eliminating `180,000 kg/m³` `Pu/Am/Bk` collapse and restoring finite `B_0`).
3. **Fix `vdw-fcc` Geometry & Kirkwood Polarizability + Molecular Nonmetal Classification (`:50-54, :204, :346, :356`):**
   - Fix FCC `rNN = rWs * 1.80941` (exact `(16π/3)^{1/3}/√2`, eliminating `1.82×` density overshoot).
   - Fix Kirkwood `zv` cancellation bug + PBE SIE correction on `I_1`.
   - Include `3p^3 / 3p^4 / 4p^4` (`P`, `S`, `Se`) in `isMolecularNonmetal`.
   - Scale Friedel `d`-bandwidth to physical `4.5–8 eV` (fixing `Fe`/`W` `B_0` & `Θ_D` overshoot) + `s-d` hybridization cohesion for closed `d^{10} s^1` noble metals (`Cu/Ag/Au`).
   - In `elementMdClosureWebGpu.js:215-216`, lower cryogenic vaporization floor `1500 -> 50 J/mol` and use `104 J/(mol·K)` metallic Trouton entropy (`88` for `vdw-fcc`).

### 1.3 Compound Crystal Packing, Dielectric `ε_r` & Optical Index `n(550 nm)` (`recursiveCompoundPipeline.js`, `opticalResolverWebGpu.js`)
1. **Intermolecular vdW & Shell-Stripped Ionic Radii (`recursiveCompoundPipeline.js:534-604`):**
   - Molecular solids/liquids: Bondi non-bonded vdW envelope `r_vdW = r_cov + 0.85 Å` with directional H-bond tetrahedral packing (`η_HB ≈ 0.44` when `hasH && hasNOF`, `η_vdW ≈ 0.54` otherwise) -> `H₂O ~ 990`, `NH₃ ~ 690`, `CH₄ ~ 405 kg/m³`.
   - Ionic crystals: shell-stripped Pauling cation radii, expanded anion radii, stoichiometric formal charges `z_+ z_-`, and Pauling radius-ratio gate (`r_+/r_- < 0.732 -> rocksalt-B1` over `cscl-B2`).
2. **Dielectric `ε_r` Separation (`:775`):** Never apply gas-phase rotational dipole `18 μ²` to rigid ionic/covalent solids (`Al₂O₃: 24,600 -> ~9`, `NaCl: 2,930 -> ~5.9`); use **Penn electronic `ε_∞` + Lyddane–Sachs–Teller ionic lattice polarizability** for ionic/covalent crystals and exact quadratic **Kirkwood–Onsager** (with H-bond `g_K ≈ 2.6`) for polar molecular liquids (`H₂O ~ 78`).
3. **Optical Gap & `n(550 nm)` (`:495, :561`):** Derive condensed molecular optical gap from bounded Koopmans `-ε_HOMO` instead of STO-3G virtual LUMO; include open-`d` charge-transfer gap reduction for transition-metal oxides (`Fe₂O₃`); evaluate Penn / Lorentz–Lorenz refractive index `n(550 nm)` and feed into `OPTICAL_RESOLVER_MODE_BAND_GAP`.

### 1.4 Smooth Radiative/Convective Stellar Evolution (`src/runtime/astrophysics/cosmicEpochState.js:164-200`)
- Replace discontinuous `M = 2.0` piecewise `lumMs` with smooth `C^∞` convective-to-Kramers-to-Thomson + Eddington-capped ZAMS luminosity, convective-core `μ^4` MS brightening, and fuel-conserving `tauMsGyr ∝ M / L` (bringing Vega `2.135 M☉` into empirical agreement while preserving Sun, Proxima, Red Giant, White Dwarf, NS, and BH regimes).

---

## 2. Live WebGPU Atlas Refresh & Expanded Cross-Scale Benchmarks

1. Re-run `scripts/material-properties/generate-foundation-atlas-webgpu.mjs` (bounded `MemoryMax=3G`, `CPUQuota=50%`) to refresh `data/material-properties/foundation-polytope-atlas.json` (`schemaVersion: 2`, `118` elements + `20` compounds including live `SiO₂ cristobalite-C9`, zero `KBr`/`GeO2`, zero `reference-fallback`).
2. Expand `src/tools/scientificValidationFramework.js` to audit **4 additional real physics domains** offline & live:
   - **Continuum Water EOS & Hydrodynamics** (IAPWS-95 density/sound-speed/vaporization vs ULG continuum material closure + Stefan melt scaling).
   - **Biophysics Kinetics & Scaling** (Flory `R_g ~ N^0.33` globular vs `N^0.59` IDP, Hodgkin–Huxley `+30..+40 mV` AP peak & refractory period, duplex `T_m`).
   - **PREM Planetary Interiors** (Earth core/mantle pressure, central density, and `I/(MR²)` from Gate 5 hydrostatic interior solver).
   - **Relativistic Optical Dispersion (`Au`, `Ag`, `Cu`, `Cs`)** (Drude-interband visible reflectance / relativistic gold color shift).
3. Regenerate `plan/validation-scorecard.md` via `node scripts/run-scientific-validation.mjs`, verify massive empirical agreement uplift across all domains, and ensure ALL existing Gate 1–6 & `scientificValidationFramework` tests stay 100% green.
