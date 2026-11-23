# Hydrogen Nebula to Star Formation, Fusion & Compact Remnants Bridge Plan

Date: 2026-11-22 AKST  
Status: Planned High-Priority Multiscale Target  
Related: [`cosmic-to-quantum-continuous-zoom-demo-plan.md`](cosmic-to-quantum-continuous-zoom-demo-plan.md), [`overarching-completion-plan.md`](overarching-completion-plan.md)

## Target Vision

Demonstrate ULG's core multiscale thesis end-to-end: **representative first-principles quantum samples driving macroscopic N-body + continuum self-gravitating dynamics so that star formation, thermonuclear fusion ignition, hydrostatic equilibrium, and late-stage stellar death (supernovae, neutron stars, black holes) emerge rather than being scripted.**

Rather than hand-coding a "turn particle into a star at radius $R$" rule, a sparse cold molecular hydrogen (`H₂`) nebula evolved under WebGPU Barnes–Hut gravity + Schroeder Spatial hydrodynamics queries ULG's bottom-up quantum/nuclear closure pipeline as local density $\rho$ and temperature $T$ cross physical regimes:

1. **Cold Molecular Hydrogen Nebula (`10^14 – 10^17 m`, `10 – 100 K`, `n ~ 10^2 – 10^6 cm^-3`)**
   - Representative macro-particles sample `H₂` ro-vibrational levels & dissociation energy from ULG's first-principles molecular solver (`molecularHartreeFock.js` `CAS(2,2)` / `6-31G(d)` + vibrational modes).
   - Radiative cooling ($\Lambda(T, \rho)$) removes gravitational contraction heat, driving Jeans instability ($M > M_J(\rho, T)$) and hierarchical fragmentation inside the `SchroederScaleAtlas` Barnes–Hut octree (`eshkols-in-space` 2M-body ABI + `schroederSpatialScaleAtlasMultipoleGpu.js`).

2. **Protostellar Core Collapse, `H₂` Dissociation & Saha Ionization (`10^9 – 10^13 m`, `10^3 – 10^5 K`)**
   - Rising optical depth traps infrared radiation (first hydrostatic Larson core).
   - At `~2,000 K`, endothermic `H₂ -> 2 H` dissociation absorbs thermal energy, dropping $\gamma_{\text{eff}} < 4/3$ and triggering second dynamic collapse into a protostar.
   - At `~10^4 K`, first-principles atomic hydrogen ionization potential (`radialKohnSham.js`, `13.6 eV`) drives the Saha ionization equilibrium (`H <-> p+ + e-`), transitioning the EOS from neutral molecular gas to ionized Coulomb plasma + Kramers/Thomson radiative opacity.

3. **Quantum Tunneling & Thermonuclear pp-Chain Ignition (`10^7 – 10^9 m`, `T_c ~ 10^7 K`, `rho_c ~ 10^2 g/cm^3`)**
   - Extends Phase 8 (`src/runtime/material/nuclearCherenkovClosure.js`) with Gamow-peak Coulomb-barrier quantum tunneling cross-sections ($\sigma(E) = \frac{S(E)}{E} e^{-\sqrt{E_G/E}}$) and exact nucleon/lepton-conserving nuclear reaction networks:
     - **pp-chain:** `p + p -> ²H + e+ + ν_e`, `²H + p -> ³He + γ`, `³He + ³He -> ⁴He + 2p` (`Q = 26.73 MeV` per `⁴He`, minus neutrino escape fraction).
     - **Deuterium burning** (`~10^6 K`) and **CNO / triple-alpha** (`~10^8 K`) channels for higher-mass cores.
   - Nuclear energy deposition $\varepsilon_{\text{nuc}}(\rho, T, X_H)$ feeds directly into the exact `2^-149` energy ledger (`Σ(U - S)`), halting gravitational contraction automatically when radiative + convective luminosity balances self-gravity (**emergent Main-Sequence hydrostatic equilibrium**).
   - Photospheric blackbody + line opacity derives emergent stellar color and luminosity directly via Phase 6 `opticalResolverWebGpu.js` (Planck CIE 1931 -> sRGB).

4. **Future Frontier: Red Giant Shell Burning, Core-Collapse Supernovae & Compact Remnants**
   - **Hydrogen exhaustion -> Helium core contraction:** Degenerate Fermi–Dirac electron pressure ($P_e(\rho)$ derived from relativistic uniform electron gas / `uniformElectronGas.js`) supports white-dwarf cores up to the Chandrasekhar limit (`~1.4 M_sun`).
   - **Core-collapse supernova & nucleosynthesis:** Iron-peak core photo-disintegration & electron capture trigger core bounce, shock breakout, neutrino heating, and r-process / α-chain enrichment seeding the next generation of the nebula with heavy elements (`C`, `O`, `Fe`, `Au`, `U`).
   - **Neutron stars & Black holes:** Relativistic TOV hydrostatic equilibrium (connecting to ULG's staged Moonlab/Eshkol magnetar reference contracts) and event-horizon geodesic trapping (`R_s = 2GM/c^2`) inside floating-origin `SchroederScaleAtlas` charts.

## Architecture Integration Points

- **Representative Sampling & Polytope Caching:** Instead of running quantum/nuclear solvers per SPH/N-body particle, cells query content-addressed Eshkol A4 Chebyshev polytopes over `(log rho, log T, X_H, X_He)` populated on demand via PeerCompute A6 quorum workers when collapse enters a previously unvisited `(rho, T)` decade.
- **Scale Continuity:** Lives seamlessly on ULG's `SchroederScaleAtlas` (spanning `10^-11 m` H atom -> `10^0 m` plasma parcel -> `10^9 m` stellar radius -> `10^17 m` molecular cloud -> `10^21 m` host galaxy) using the exact same `SimulationModuleRegistry` + zero-copy `residentBufferLease` pipeline already proven in `/cosmic-quantum.html`.
- **Governance:** Every derived EOS, opacity, Gamow tunneling rate, and stellar structure diagnostic carries explicit `validation: { scientificValidation: false, fullPhysicsValidation: false }` until benchmarked against MESA / Lane–Emden / solar-model G7 advisory tables.
