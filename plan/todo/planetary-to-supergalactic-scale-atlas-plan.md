# Planetary, Stellar, Galactic & Supergalactic Scale-Atlas Plan (`10⁺⁶ m → 10⁺²⁵ m`)

- **Effective:** 2026-11-23 AKST (Updated with live status through `c09644f8` — Priority 5 implemented & Vulkan/WebRTC-verified)
- **Active routing:** [`plan/CURRENT-PLAN.md`](../CURRENT-PLAN.md)
- **Associated ICC Oracle:** `ulg-gate5-planetary-to-supergalactic` (see [`.icc/completion-oracles.yaml`](../../.icc/completion-oracles.yaml))
- **Prerequisites:** Gate 0 (`gpuMath` `fft3dWebGpu` + unified `SS` Scale Atlas multipole + `peercompute-core`), Gate 1 (Nuclear & Atomic closures), Gate 2 (Convex Polytope Atlas), Gate 3 (Unified SS Continuum)
- **Live Implementation Status (`c09644f8`):**
  - **DONE & Vulkan/WebRTC-verified:** 5A (`planetaryStructureGpu.js`), 5B (`stellarNucleosynthesisBridge.js` using Gate 1 `(Z, A)` nuclear Q-values + RK4 Lane–Emden `n=1.5, 3.0`), 5C (`galacticIsmCoolingGpu.js` with Gate 1 atomic line cooling + translation-invariant DM/star/ISM/Paczyński–Wiita SMBH), **Canonical `SchroederScaleAtlas` Multipole Gravity Unification (`c09644f8`):** `scaleAtlasAstrophysicsGravityBridge.js` wired into BOTH `selfGravitatingHydroGpu.js` (stellar hydro) & `cosmicQuantumGpuKernels.js` (binary galaxies) with exact Newton's 3rd Law reciprocity (`momentumRelError < 1e-4`) and `+5000` translation invariance (`< 1e-4`), **5D Hybrid FLRW TreePM (`c09644f8`):** `supergalacticTreePmGpu.js` coupling long-range Gate 0B `fft3dWebGpu.js` PM + short-range `3×3×3` Gaussian-split peculiar-density sub-cell Tree (periodic translation invariance `< 1e-3`, sharper supercluster halo collapse in `supergalactic.html`, `cosmicQuantumZoomDemo.js` FLRW upgrade), and **Real 2-Browser-Context WebRTC `RTCDataChannel` Multi-Host TreePM (`tests/priority5ScaleAtlasAndWebRtcTreePm.native.test.mjs`)** with signaling WS closed, G5 `ReservationLedger` CAS tile leases, exact global mass conservation, and fail-closed peer-loss tile reassignment.
  - **REMAINING OPEN WORK:** Physical 2-machine WAN/TURN TreePM validation once `agy` delivers `../peercompute` extensions, retire internal octree fallback path inside `selfGravitatingHydroGpu.js` / `cosmicQuantumGpuKernels.js` once full multi-chart per-particle P2P force back-scatter is unified, and capture formal reviewed `ulg.campaign.receipt.v1`.

---

## 1. Strategic Principle: One Engine Across 40 Orders of Magnitude

ULG does **not** build disconnected astrophysics demo silos. Every macroscopic and cosmological regime from planetary cores (`10⁺⁶ m`) to supergalactic cosmic-web filaments (`10⁺²⁵ m`) must run on the **exact same GPU primitives and closure contracts** built in Gates 0–3:

1. **Zero Private Bespoke Octrees:** Retire private 2-tier octrees inside `src/runtime/sph/selfGravitatingHydroGpu.js` and `src/demos/cosmicQuantumGpuKernels.js`; all gravitational long-range solvers share the canonical **`SchroederScaleAtlas` multipole / FMM engine** (`schroederSpatialScaleAtlasGpu.js` + `schroederSpatialScaleAtlasMultipoleGpu.js`) with floating-origin double-chart coordinates so `10⁺²⁵ m` does not suffer `f32` catastrophic cancellation.
2. **Reuse `gpuMath` Across Scales:** The exact same **`fft3dWebGpu.js`** (Gate 0B) that solves periodic Poisson/Hartree potentials in `10⁻⁹ m` Bulk Solid DFT solves the long-range periodic gravitational potential in `10⁺²⁵ m` Cosmological TreePM!
3. **Representative Sub-Simulations + Gate 1–2 Polytope Atlases (Never Simulate Every Atom in a Star):** A star contains `~10⁵⁷` atoms and a galaxy contains `~10¹¹` stars; ULG bridges these scales through **representative sub-simulations** compiled into accuracy-tiered **Convex Polytope Atlases** (`tier-1-quantitative`, `tier-2-representative-effective`, `tier-3-theoretical-envelope`). Planetary cores/mantles/oceans query Gate 2 Polytope Atlases (`Fe-Ni`, silicates, `H₂O`, `H₂/He`); stellar macro-parcels query Gate 1 nuclear networks & Fermi–Dirac/radiation plasma polytopes; galactic ISM cooling queries Gate 1 atomic line-emission closures!
4. **Zero Scripted Astrophysics Animations:** Every orbit, collapse, bounce, spiral density wave, merger tide, and cosmic-web filament emerges live from GPU equations of motion and conserved ledgers (strict Star Spec translation & Galilean/comoving invariance).

---

## 2. Stage 5A — Planetary Interiors, Atmospheres & Orbital Dynamics (`10⁺⁶ m → 10⁺¹³ m`)

- **What exists today:** Live GPU `planetary-nbody@1` Keplerian integrator in `src/demos/cosmicQuantumGpuKernels.js` (energy rel err `8.7e-5`, angular momentum rel err `7.2e-8` verified on Vulkan).
- **What we build:**
  - **Polytope-Atlas Planetary Structure Solver:** Feed Gate 2 high-pressure `(T, P)` Polytope Atlases (`Fe`, `MgSiO₃`/`SiO₂`, `H₂O`, `H₂`/`He`) into hydrostatic equilibrium `dP/dr = -G M(r) ρ(P,T) / r²` to derive emergent mass-radius curves, core-mantle differentiation, high-pressure ice polymorphs, and planetary magnetic dynamo scaling (using Gate 1 `Fe-Ni` electrical conductivity `σ(T, P)`!).
  - **Symplectic GPU N-Body & Giant-Impact Hydro:** Upgrade `planetary-nbody@1` to symplectic Wisdom–Holman / Leapfrog on the shared `SchroederScaleAtlas` multipole, coupling to Gate 3 continuum hydro for tidal heating, Roche-limit disruption, and giant-impact accretion with exact `2^-149` species/mass conservation.
  - **Live GPU Visualizations:** Multi-body orbital systems with real GPU-integrated trajectories, cut-away 3D planetary interior thermal/pressure/phase shells driven by the Polytope Atlas, and real impact hydrodynamics.

---

## 3. Stage 5B — Stellar Structure, Nucleosynthesis & Compact Remnants (`10⁺⁸ m → 10⁺¹⁷ m`)

*(Extends [`hydrogen-nebula-to-star-fusion-bridge-plan.md`](hydrogen-nebula-to-star-fusion-bridge-plan.md).)*
- **What exists today:** `stellar-genesis.html`, translation-invariant GPU `self-gravitating-hydro@1` (`0.000000%` off-origin peak temp diff, twin-lobe binary, 18 M☉ core-collapse bounce), and `hydrogenStellarClosure.js` (`H₂` CAS(2,2) + `H` KS ionization + Fermi–Dirac degeneracy + `pp/CNO/3α/Fe` burn + `ClosureRegistry` 2D table).
- **What we build:**
  - **Unify Gravity onto `SchroederScaleAtlas` Multipole:** Replace the private octree in `selfGravitatingHydroGpu.js` with the canonical SS Scale Atlas multipole + adaptive multi-level SS core refinement (`10¹⁷ m` nebula → `10⁹ m` stellar core → `10⁴ m` proto-neutron core across nested Scale Atlas charts).
  - **Full Gate 1 Nuclear Reaction Network Integration:** Drive `pp`-chain, CNO cycle, triple-α, α-capture chain (`C → O → Ne → Mg → Si → Fe-56`), endothermic `Fe-56` photodisintegration, neutronization (`p + e⁻ → n + ν_e`), and `r`-process seed enrichment directly from Stage P1.1 `nuclearStructureGpu.js` binding energies `B(Z, A)` and WKB Gamow rates with exact nucleon/lepton conservation.
  - **Radiative/Convective Transport & Compact Remnants:** Flux-limited radiative diffusion + Schwarzschild convective mixing, Chandrasekhar degenerate white-dwarf support, relativistic TOV neutron-star EOS closure (linking to MoonLab/Eshkol nuclear-matter contracts), and event-horizon geodesic trapping (`R_s = 2GM/c²`).
  - **G7 Advisory Verification:** Offline Lane–Emden polytrope (`n = 1.5, 3`) and MESA solar/massive-star profile comparisons (`scientificValidation: false` until reviewed).

---

## 4. Stage 5C — Galactic Dynamics, Dark Matter Halos & ISM Physics (`10⁺¹⁷ m → 10⁺²² m`)

- **What exists today:** GPU `32,768`-body translation-invariant `cosmicBarnesHutOctreeWgsl` (`bhTransMaxDiff 4.5e-6`, `226.2 ms / 10 steps` on Vulkan) in `src/demos/cosmicQuantumGpuKernels.js`.
- **What we build:**
  - **Unify Galactic Gravity onto Canonical SS Scale Atlas Multipole / FMM:** Replace the private Barnes–Hut octree with the shared `SS` Scale Atlas multipole supporting `10⁵–10⁶+` collisionless dark-matter + stellar particles (`10⁴–10⁵` per browser GPU, scaling further via Stage 5D PeerCompute partitioning).
  - **Coupled Compressible ISM Gas & Gate 1 Atomic Cooling:** Couple dark-matter + star N-body to compressible SS hydro ISM gas cooled by **Gate 1 atomic & ionic line-emission cooling curves `Λ(T, Z)`** (`H, He, C, N, O, Fe` derived from Stage P1.2 atomic transitions!), driving Jeans-unstable molecular clouds, emergent spiral density waves, galactic tidal tails, and supernova metallicity feedback back into the ISM!
  - **Central Supermassive Black Hole (SMBH) & Accretion:** Paczyński–Wiita / Kerr effective relativistic potential + radiative accretion feedback inside nested floating-origin Scale Atlas charts.
  - **Live GPU Visualizations:** Zero-copy resident GPU rendering of multi-component galaxies (dark-matter halo, stellar populations colored via Gate 1 Planck/blackbody closures, ionized/molecular ISM gas emission, and tidal mergers).

---

## 5. Stage 5D — Supergalactic Cosmology & Large-Scale Structure (`10⁺²² m → 10⁺²⁵ m`)

- **What exists today:** Placeholder static cosmic-web stop in `cosmicQuantumZoomDemo.js` (non-evolving geometry).
- **What we build — Real First-Principles Expanding-Universe GPU Simulation:**
  - **Comoving FLRW Cosmological Time Integrator:** Evolve scale factor `a(t)` via the Friedmann equation `H(a) = H_0 √(Ω_r a⁻⁴ + Ω_m a⁻³ + Ω_k a⁻² + Ω_Λ)` with exact drift-kick-drift symplectic integration in comoving coordinates (`x = r / a`, canonical momentum `p = a² m dx/dt`).
  - **GPU TreePM Solver (`fft3dWebGpu` + `SS` Scale Atlas Multipole):**
    - **Long-range Periodic Gravity (PM):** Cloud-in-Cell (`CIC`) mass assignment onto a `64³`/`128³` periodic comoving grid → **`fft3dWebGpu.js` (from Gate 0B!)** solves `∇²Φ = 4π G a² (ρ − ρ̄)` in `k`-space with Gaussian short/long force split → finite-difference / `ik` force interpolation back to particles!
    - **Short-range Non-Linear Gravity (Tree):** Canonical **`SS` Scale Atlas multipole** resolves dense virialized halo cores and subhalos below the PM mesh scale.
  - **Primordial Initial Conditions (`Zel'dovich Approximation` on GPU):** Generate physically grounded Gaussian random density perturbations from a primordial scale-invariant + Eisenstein–Hu transfer-function power spectrum `P(k)` in `k`-space via `fft3dWebGpu.js` at high redshift (`z ~ 50–100`), then evolve forward to `z = 0` so **real dark-matter filaments, superclusters, halos, and cosmic voids emerge dynamically** (zero procedural mesh fakes!).
  - **Coupled Baryonic Gas & Reionization Feedback:** Optional two-fluid dark-matter + baryonic gas (using Gate 1 `H/He` Saha ionization & primordial recombination cooling) tracking the warm-hot intergalactic medium (`WHIM`) along filaments.
  - **Distributed Multi-Host PeerCompute Scaling (`distributed-peercompute-network-stack-plan.md`):** Partition large cosmological / galactic spatial domains across multiple WebGPU browser peers over PeerCompute WebRTC/WSS/STUN/TURN (`peercompute-core` from Gate 0A), exchanging only compact ghost-slab / multipole boundary summaries at schedule boundaries under G5 CAS & epoch fencing!
  - **Live GPU Visualizations:** Real-time 3D WebGPU volumetric + zero-copy particle rendering of evolving cosmic-web filaments (`z = 100 → 0`), live power spectrum `P(k)` & halo mass function `dn/dM` GPU reductions, and seamless 40-OOM logarithmic Scale Atlas zoom from a `10⁺²⁵ m` supercluster filament down into a host galaxy → star → planet → lab continuum → crystal lattice → atom → `10⁻¹⁵ m` nucleus!

---

## 6. Scientific Honesty & Computational Boundaries (Gate 5)

| Scale / Domain | Browser WebGPU First-Principles Method | Honest Scope Boundary & G7 Advisory Targets |
|---|---|---|
| **Planetary (`10⁺⁶–10⁺¹³ m`)** | Polytope-Atlas hydrostatic interiors + symplectic Scale Atlas N-body + tidal/impact hydro | Full 3D geodynamo MHD & billion-year mantle convection timescales are subgrid/parametrized; G7 advisory checks against PREM (Earth) & NASA planetary mass-radius data. |
| **Stellar (`10⁺⁸–10⁺¹⁷ m`)** | Self-gravitating SS hydro + Gate 1 nuclear networks + Fermi–Dirac/radiation EOS + FLD transport | Full 3D neutrino Boltzmann transport & general-relativistic MHD core collapse require supercomputers; effective neutrino heating + TOV closure flagged honestly (`scientificValidation: false`), benchmarked offline against Lane–Emden & MESA. |
| **Galactic (`10⁺¹⁷–10⁺²² m`)** | Scale Atlas multipole N-body (`10⁵–10⁶` particles) + compressible ISM hydro + Gate 1 atomic cooling | Individual stars (`~10¹¹` per galaxy) are represented as macro-particles (`~10⁵–10⁶ M☉` per particle) with subgrid IMF/SN feedback; validated via rotation curves, Tully–Fisher scaling, and virial/angular-momentum conservation. |
| **Supergalactic (`10⁺²²–10⁺²⁵ m`)** | FLRW comoving TreePM (`fft3dWebGpu` + SS multipole) from Zel'dovich `P(k)` ICs + optional baryon WHIM + PeerCompute domain split | Single-GPU particle count (`64³–128³` = `262k–2.1M` particles) resolves superclusters & massive halos (`> 10¹² M☉`), not dwarf galaxies simultaneously without multi-peer PeerCompute zoom-in charts; G7 advisory checks against linear growth factor `D(z)`, `P(k)`, and Press–Schechter / Sheth–Tormen halo mass function. |
