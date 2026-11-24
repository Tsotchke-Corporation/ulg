// First-Principles Documentation & Explanations for ULG Material Physics Lab
// (`src/demos/elementsLabSimDocs.js`).
//
// Powers the `?` Help / About ULG modal and every individual simulation's
// `ⓘ About` button across all 24 live WebGPU simulations in `elements-lab.html`.

export const ULG_LINKS = Object.freeze({
  githubUlg: 'https://github.com/Tsotchke-Corporation/ulg',
  githubPeerCompute: 'https://github.com/MetaverseJS/peercompute',
  githubEshkol: 'https://github.com/tsotchke/eshkol',
  githubMoonlab: 'https://github.com/tsotchke/moonlab',
  demos: Object.freeze([
    {
      href: './index.html',
      title: 'Studio Continuum',
      scale: '10⁻³ → 10⁺² m',
      desc: 'Interactive macroscopic 3D WebGPU MLS-MPM fluid, phase transitions, volumetric optics, and reactive continuum studio.'
    },
    {
      href: './cosmic-quantum.html',
      title: 'Cosmic ↔ Quantum',
      scale: '10⁻¹⁵ → 10⁺²⁵ m',
      desc: 'Unified 40-order-of-magnitude scale explorer connecting quantum closures to planetary, stellar, galactic, and cosmic scales.'
    },
    {
      href: './stellar-genesis.html',
      title: 'Stellar Genesis',
      scale: '10⁺⁸ → 10⁺¹¹ m',
      desc: 'Live WebGPU thermonuclear fusion networks, Lane–Emden hydrostatic structure, and stellar core evolution.'
    },
    {
      href: './supergalactic.html',
      title: 'Supergalactic TreePM ↗',
      scale: '10⁺²² → 10⁺²⁵ m',
      desc: '1-submit FLRW 3D-FFT TreePM cosmic web, live GPU matter power spectrum P(k), and PeerCompute WebRTC partitioning.'
    }
  ])
});

export const ABOUT_ULG_DOC = Object.freeze({
  title: 'About ULG & the Material Physics Lab',
  subtitle: 'Universal Law Graph — First-Principles Browser-Native WebGPU Multiscale Physics',
  whatIsThisLab:
    'This interactive Material Physics Lab runs live WebGPU compute shaders directly on your GPU to derive physical matter from first principles across the entire periodic table (Z = 1..118), arbitrary (Z, A) isotopes, multi-species crystals, chemical reactions, vibrational spectra, reactive molecular dynamics, and 3D thermodynamic phase polytopes. No hardcoded per-element color tables or canned preset animations are used: Gold turns yellow from relativistic spin-orbit contraction, Cesium turns pale gold from its screened low-density Drude plasma edge, Lead turns superconducting below T_c, and H₂O bends light via real-time Maxwell–FDTD.',
  whatIsUlg:
    'ULG (Universal Law Graph) is a first-principles multiscale physics engine spanning 40 orders of magnitude — from atomic nuclei (10⁻¹⁵ m) through atoms, crystals, chemistry, macroscopic fluids and solids (10⁻⁶..10⁺² m), planets, stars, galaxies, and supergalactic cosmic structure (10⁺²⁵ m). Rather than simulating 10²⁶ individual atoms in a macroscopic scene, ULG runs representative sub-simulations at scale S−1 (like the live GPU engines in this lab) and compiles their outputs and strict validity envelopes into Convex Polytope Atlases (A x ≤ b + GPU Chebyshev tables) that scale S evaluates in nanoseconds on the GPU.',
  architectureBullets: Object.freeze([
    'Star Spec Physics-First: Macroscopic behavior emerges strictly from activated laws and validity-bounded closures — never from hardcoded material branches.',
    'Schroeder Simulation (SS) Scale Atlas: One GPU-resident hierarchical spatial epoch serving near-field mechanics, cross-level coupling, multipole far-field gravity, solids, and rendering.',
    'Tier 0–3 Closure Economy: Fast bulk substrate (Tier 0), fail-closed cached Chebyshev polytopes (Tier 1), representative on-demand GPU sampling (Tier 2), and warm WASM/WebGPU derivation (Tier 3).',
    'The ULG Triad: PeerCompute handles distributed scheduling, leases, and peer sync; Eshkol compiles higher-order automatic derivatives and closures; Moonlab provides quantum reference states and correlations.'
  ]),
  honestyNote:
    'All runtime derivations in this lab run live on your browser GPU and are transparently labeled scientificValidation: false; offline NIST/CODATA/AME2020/CRC comparisons in the Graphs & Data panel are strictly advisory.'
});

export const SIMULATION_DOCS = Object.freeze({
  'nuclear:tdse': {
    title: 'Nuclear Fermi Density & α-Decay TDSE',
    scale: '10⁻¹⁵ m (Nuclear)',
    moduleKey: 'nuclear-tunneling-tdse@1',
    whatYouSee:
      'A 3D volumetric rendering of the active nucleus (proton/neutron Fermi charge distribution and nuclear skin) paired with a live 1D quantum wavepacket bouncing inside the nuclear potential well and tunneling through the Coulomb barrier.',
    gpuPhysics:
      'Solves the semi-empirical liquid-drop + shell-corrected nuclear binding energy B(Z, A), finite charge radius R_nuc, and evolves a 1D time-dependent Schrödinger equation (TDSE) on WebGPU using a norm-preserving symplectic Visscher leapfrog integrator.',
    whyInUlg:
      'Nuclear masses, finite charge radii, spin/parity, and Q-values anchor the very bottom rung (10⁻¹⁵ m) of ULG’s 40-OOM Scale Ladder — feeding isotopic mass shifts in chemistry/phonons, nuclear hyperfine coupling, and stellar fusion energetics.',
    tryThis: [
      'Select U-235 or Po-212 in the Periodic Table to watch barrier height and WKB α-tunneling probability respond to Q_α.',
      'Click any nuclide on the Chart of Nuclides plot in the Graphs & Data dock to jump straight to that (Z, A) isotope.',
      'Lower Sim Speed to 0.25× or click ⏭ +1 to watch the α-wavepacket reflect and leak through the Coulomb barrier step by step.'
    ]
  },
  'nuclear:fission': {
    title: '3D Bohr–Wheeler Quadrupole Fission',
    scale: '10⁻¹⁵ m (Nuclear)',
    moduleKey: 'nuclear-fission-ldm@1',
    whatYouSee:
      'A live 3D raymarched nuclear density volume deforming smoothly from a sphere (β₂ = 0) through an elongated prolate saddle (β*) to necking and binary scission (β₂ > 1.0), alongside the Bohr–Wheeler surface-vs-Coulomb barrier curve.',
    gpuPhysics:
      'Computes the nuclear fissility parameter x = E_Coulomb / (2 E_surface), solves the quadrupole/hexadecapole liquid-drop deformation energy landscape E(β₂), and rasterizes the 3D deformed Woods–Saxon nucleon density directly on WebGPU.',
    whyInUlg:
      'Demonstrates how macroscopic nuclear stability and actinide fission barriers emerge directly from competing short-range strong-force surface tension and long-range Coulomb repulsion — without hardcoded fission tables.',
    tryThis: [
      'Load ²³⁵U (Z=92, A=235) and click Play Fission or drag the β₂ slider past Saddle β* to see necking and scission.',
      'Compare U-235 (low barrier E_f ≈ 3 MeV) against Fe-56 (enormous barrier — iron sits at the peak of nuclear stability!).'
    ]
  },
  'nuclear:bateman': {
    title: 'Bateman Radioactive Decay Chain',
    scale: '10⁻¹⁵ m → macro time',
    moduleKey: 'nuclear-decay-ledger@1',
    whatYouSee:
      'The parent nucleus volume alongside exact nucleon-conserving parent → daughter → granddaughter population curves plotted in multiples of the primary half-life.',
    gpuPhysics:
      'Constructs the α/β⁻/β⁺/EC decay network directly from first-principles Q-values and integrates the coupled Bateman rate equations with strict nucleon conservation.',
    whyInUlg:
      'Powers radiogenic heating in planetary interiors (Gate 5) and isotope inventory conservation across long-timescale nuclear and astrophysical simulations.',
    tryThis: [
      'Try Co-60 (Z=27, A=60) or U-235 (Z=92, A=235) to see multi-step daughter growth and decay curves in the Graphs & Data dock.'
    ]
  },
  'atomic:cloud': {
    title: '3D Relativistic Dirac–KS Orbital Cloud',
    scale: '10⁻¹⁰ m (Atomic QM)',
    moduleKey: 'quantum-orbital-cloud@1',
    whatYouSee:
      'Up to 500,000 Monte Carlo points sampled directly on the GPU from the active atom’s exact 3D Kohn–Sham probability density |ψ_{n,l,m}(r, θ, φ)|², colored by alternating radial nodal shells or ±ψ wavefunction phase.',
    gpuPhysics:
      'Solves the finite-nucleus Koelling–Harmon scalar-relativistic + spin-orbit radial Kohn–Sham SCF equations on WebGPU (zero per-SCF CPU readbacks), then samples (r, θ, φ) via inverse-CDF binary search on the GPU. Supports live static Stark electric-field polarization (α₀) and matched-grid ΔSCF cation ionization (I₁).',
    whyInUlg:
      'Atomic orbital wavefunctions, radii, spin-orbit splittings, and polarizabilities are the sole inputs to ULG’s crystal DFT, optical spectra, magnetism, and chemical bonding engines.',
    tryThis: [
      'Drag the n slider or switch l and m to inspect s spheres, p dumbbells, d cloverleafs, and f octupoles with crisp radial nodal shells.',
      'Drag Stark E to polarize the electron cloud and measure induced dipole moment, or click Ionize −1e⁻ (ΔSCF) to watch the cation shell contract on the GPU.'
    ]
  },
  'atomic:volume': {
    title: 'Volumetric 3D Atomic Spin & Charge Density',
    scale: '10⁻¹⁰ m (Atomic QM)',
    moduleKey: 'quantum-orbital-cloud@1',
    whatYouSee:
      'A smooth 3D WebGPU raymarched volume of the atom’s total electron charge and unpaired-spin density distribution.',
    gpuPhysics:
      'Uploads the converged GPU Kohn–Sham radial density ρ(r) and angular valence envelope into a 3D storage volume and raymarches it directly on the GPU.',
    whyInUlg:
      'Visualizes total electron screening and shell compactness that govern core polarizability, atomic volume, and interatomic repulsion in solids and molecules.',
    tryThis: [
      'Toggle Relativistic+SO on heavy elements like Au (Z=79) or switch XC between PBE GGA, LDA, and Bare Z to see screening expand the cloud.'
    ]
  },
  'crystal:photon-shell': {
    title: '2D Maxwell–ADE-FDTD Optical Slab (Snell & Metal Color)',
    scale: '10⁻⁹ → 10⁻⁷ m (Optics)',
    moduleKey: 'photon-shell-fdtd@1',
    whatYouSee:
      'An oblique Gaussian photon wavepacket hitting a slab of the active element or backfed compound containing 20 driven 3D atomic shells: watch metals reflect color-selectively (Gold reflects red/green and absorbs blue!) and dielectrics like H₂O refract according to Snell’s law.',
    gpuPhysics:
      'Runs a 4-channel (610nm R, 535nm G, 440nm B, plus tunable λ) 128×128 time-symmetric symplectic Yee–Taflove 2D Maxwell–ADE-FDTD solver on WebGPU coupled to Drude free-electron currents and Dirac–KS Lorentz interband oscillators.',
    whyInUlg:
      'Proves that metallic luster, color (Au gold, Cu copper, Cs pale gold, Ag silver), and dielectric refraction emerge directly from live Maxwell wave equations + quantum electronic structure.',
    tryThis: [
      'Select Au (Gold) and toggle Relativistic (Au) OFF vs ON — watch Gold turn into Silver when relativistic 5d–6s contraction is disabled!',
      'Backfeed H₂O from Chemistry and slow Sim Speed to 0.25× to watch the oblique wave bend inside water and match Snell’s law.'
    ]
  },
  'crystal:lattice': {
    title: '3D Multi-Species Crystal Unit Cell',
    scale: '10⁻⁹ m (Condensed Matter)',
    moduleKey: 'periodic-bulk-dft@1',
    whatYouSee:
      'An interactive 3D ball-and-stick crystal unit cell showing distinct ionic/covalent species sizes, CPK or formal-charge (±) coloring, and nearest-neighbor coordination bonds.',
    gpuPhysics:
      'Derives equilibrium Bravais lattice symmetry (fcc, bcc, hcp, diamond, vdw-fcc) and multi-species Wyckoff prototypes (rocksalt-B1, CsCl-B2, zincblende-B3, fluorite-C1, rutile-C4, corundum-D51) directly from atomic radii, electronegativity ionicity, and Birch–Murnaghan GPU bulk DFT.',
    whyInUlg:
      'Crystal symmetry and lattice constants determine elastic moduli, density, slip systems, and phonon spectra used in ULG’s continuum solids.',
    tryThis: [
      'Click NaCl Crystal in Quick Showcases and toggle between CPK Species and Formal Charge (±) to inspect alternating Na⁺ / Cl⁻ coordination.'
    ]
  },
  'crystal:bloch': {
    title: '3D Periodic Bloch Density & Electronic Bands',
    scale: '10⁻⁹ m (Solid-State DFT)',
    moduleKey: 'periodic-bulk-dft@1',
    whatYouSee:
      'A 3D volumetric rendering of the periodic crystal’s ground-state Bloch charge density reconstructed by WebGPU 3D FFT, paired with Brillouin-zone band dispersion E(k), Fermi level E_F, and electronic density of states g(E).',
    gpuPhysics:
      'Solves 17 high-symmetry k-point plane-wave Bloch Hamiltonians in one batched WebGPU symmetric eigensolver dispatch and transforms eigenvectors to real space using ULG’s shared 3D Radix-2 GPU FFT.',
    whyInUlg:
      'Separates metals (g(E_F) > 0, zero gap) from semiconductors and insulators (finite band gap), feeding conductivity, magnetism, superconductivity, and optics.',
    tryThis: [
      'Compare a metal like Cu or Fe against a semiconductor like Si (Z=14) in the Graphs & Data panel to see the band gap open at E_F.'
    ]
  },
  'crystal:tdks-atom': {
    title: '3D Self-Consistent Maxwell–Kohn–Sham (Photon ↔ Orbital)',
    scale: '10⁻¹⁰ m (Quantum Optics)',
    moduleKey: 'quantum-tdks-maxwell3d@1',
    whatYouSee:
      'A true 3D volumetric raymarch of a live vector electromagnetic wavepacket (E_tot, E_inc, and scattered multipole wave E_scatt = E_tot − E_inc) striking and deforming a 180,000-point 3D Dirac–KS electron orbital cloud in real time.',
    gpuPhysics:
      'Projects the active orbital’s exact 3D radial wavefunction u_nl(r) and spherical harmonic Y_lm(θ, φ) into a 32³ anisotropic susceptibility tensor χ_ij(r) on WebGPU, steps coupled 3D vector Yee Maxwell curl equations with semi-implicit Lorentz–Bloch polarization P(r,t) and absorption E·J, and dynamically flexes every electron point from the live 3D polarization field.',
    whyInUlg:
      'Demonstrates genuine light-matter geometry coupling: orbital nodal planes stay strictly zero, 2p_y dumbbells obey dipole polarization selection rules (E_y vs E_z), and anisotropic d/f lobes generate real cross-polarized multipole scattering.',
    tryThis: [
      'Set Orbital to 2p_y Dumbbell and switch Pol between E_y (parallel to lobes) and E_z (perpendicular) to observe dipole selection-rule scattering!',
      'Switch Field View to Scattered E_scatt and orbit 360° in 3D at 0.25× slow-motion to inspect pure multipole scattering shells.'
    ]
  },
  'crystal:spin-llg': {
    title: '3D Stochastic LLG Spin-Lattice Magnetism',
    scale: '10⁻⁹ m (Magnetism)',
    moduleKey: 'spin-lattice-llg@1',
    whatYouSee:
      'A 3D crystal lattice of live magnetic spin arrows colored by M_z orientation (red +z, blue −z), forming ferromagnetic domains, Néel alternating antiferromagnetic checkerboards, or thermally disordered paramagnets.',
    gpuPhysics:
      'Integrates the 3D stochastic Landau–Lifshitz–Gilbert (sLLG) equation ds_i/dt = −γ/(1+α²)[s_i × H_eff + α s_i × (s_i × H_eff)] on WebGPU with a Heun predictor-corrector using Stoner-derived exchange coupling J, anisotropy K, external field B_z, and Langevin thermal fluctuations.',
    whyInUlg:
      'Connects microscopic spin-orbit & Stoner exchange physics to emergent Curie/Néel phase transitions (T_C / T_N), hysteresis loops M(B), and macroscopic magnetic permeability.',
    tryThis: [
      'Load Fe Magnet and click Sweep B to trace a live ferromagnetic hysteresis loop in the Graphs & Data panel, then click Heat > T_c to melt magnetic order.',
      'Select Cr (Z=24) to watch spontaneous alternating antiferromagnetic Néel ordering!'
    ]
  },
  'crystal:transport': {
    title: '3D Electron Transport, Semiconductors & BCS Superconductivity',
    scale: '10⁻⁹ m (Transport)',
    moduleKey: 'electron-transport-gpu@1',
    whatYouSee:
      '1,024 live charge carriers drifting through a 3D crystal under an electric field E: normal electrons scatter off thermal phonons (flashing red), while below T_c cyan Cooper pairs flow frictionlessly with zero scattering!',
    gpuPhysics:
      'Runs a 3D WebGPU Drude–Boltzmann carrier integrator with Bloch–Grüneisen electron-phonon scattering, thermal intrinsic carrier activation across band gaps, and McMillan–Hopfield BCS superconducting condensate fraction.',
    whyInUlg:
      'Derives temperature-dependent electrical conductivity σ(T), resistivity ρ(T), and superconducting critical temperatures T_c directly from bulk DFT bands and Debye phonons.',
    tryThis: [
      'Click Pb Supercond in Quick Showcases and click Cryo T < T_c to watch Lead condense into frictionless cyan Cooper pairs (ρ = 0 Ω·m)!',
      'Click Si Semi and slide Temperature from 80 K up to 900 K to watch thermal e⁻/h⁺ carriers flood the conduction band.'
    ]
  },
  'md:equilibrium': {
    title: 'Live 3D WebGPU Molecular Dynamics & Phonons',
    scale: '10⁻⁸ m (Atomistic MD)',
    moduleKey: 'md-mechanical-probe@1',
    whatYouSee:
      'Hundreds of live interacting atoms rendered zero-copy directly from WebGPU storage buffers (colored by kinetic energy), alongside live Radial Distribution Function g(r), Mean-Squared Displacement (MSD), and Phonon VDOS plots.',
    gpuPhysics:
      'Integrates Velocity-Verlet molecular dynamics on WebGPU with Morse/EAM/Lennard-Jones/Stillinger–Weber potentials fitted from bulk DFT, Berendsen thermostat, optional NPT barostat (thermal expansion α_V), and GPU reductions for pressure, g(r), and VACF.',
    whyInUlg:
      'Representative MD cells bridge atomic DFT up to macroscopic continuum equations of state, melting/boiling coexistence curves, and Polytope Atlases.',
    tryThis: [
      'Click Solid, Melt, and Vapor presets (or drag Temperature T) to watch crystalline Bragg peaks in g(r) melt into a liquid and evaporate into gas!',
      'Drop Sim Speed to 0.25× to watch individual atomic vibrations with a 4× finer Verlet timestep.'
    ]
  },
  'md:strain': {
    title: 'MD Mechanical Stress–Strain Tensor (K, G, ν)',
    scale: '10⁻⁸ m (Nanomechanics)',
    moduleKey: 'md-mechanical-probe@1',
    whatYouSee:
      'A live 3D crystal cell undergoing affine uniaxial compression, tension, or shear deformation with lateral NPT Poisson relaxation and live virial stress-strain curves.',
    gpuPhysics:
      'Applies exact affine deformation tensors to GPU atomic coordinates and periodic box vectors, measuring the full 6-component microscopic virial stress tensor P_αβ directly on WebGPU.',
    whyInUlg:
      'Directly measures bulk modulus K, shear modulus G, and Poisson’s ratio ν for ULG’s continuum solid-mechanics solvers.',
    tryThis: [
      'Click Compress −3%, Stretch +3%, or Shear γ_xy +4% and watch diagonal stress P_xx and lateral Poisson contraction respond live!'
    ]
  },
  'md:acoustic': {
    title: 'Acoustic Crystal Bar (Longitudinal v_L & Transverse v_T)',
    scale: '10⁻⁸ m (Acoustics)',
    moduleKey: 'md-mechanical-probe@1',
    whatYouSee:
      'An elongated 3:1 3D crystal bar carrying live longitudinal compression (P-wave) or transverse shear (S-wave) pulses across 8 spatial velocity slabs.',
    gpuPhysics:
      'Injects localized momentum wavepackets into the GPU MD lattice and tracks real-time mechanical wave propagation across the bar.',
    whyInUlg:
      'Validates emergent sound speeds c_L and c_T against elastic constants C_11 and C_44 used in macroscopic shock and acoustic solvers.',
    tryThis: [
      'Lower Sim Speed to 0.25× and click Fire P-Wave (v_L) or Fire S-Wave (v_T) to watch the acoustic wavefront travel down the crystal bar.'
    ]
  },
  'md:shear': {
    title: 'NEMD Couette Shear Viscosity (η)',
    scale: '10⁻⁸ m (Transport NEMD)',
    moduleKey: 'md-nemd-transport@1',
    whatYouSee:
      'A 3D fluid/solid slab driven in opposite directions at the top and bottom boundary walls, creating a live linear Couette velocity gradient v_x(y).',
    gpuPhysics:
      'Applies non-equilibrium boundary wall momentum forcing on WebGPU and computes dynamic shear viscosity η = |σ_xy| / (dv_x/dy) directly from the off-diagonal GPU virial stress.',
    whyInUlg:
      'Supplies first-principles fluid viscosity η(T, ρ) to ULG’s continuum MLS-MPM Navier–Stokes solvers without empirical viscosity tables.',
    tryThis: [
      'Heat the specimen above T_m (click Melt) to see a clean linear fluid shear profile form in the slab velocity plot.'
    ]
  },
  'md:thermal': {
    title: 'NEMD Hot/Cold Slab Thermal Conductivity (κ_ph)',
    scale: '10⁻⁸ m (Heat Transport)',
    moduleKey: 'md-nemd-transport@1',
    whatYouSee:
      'A 3D crystal/liquid held hot on the left slab and cold on the right slab (atoms glowing warm orange-red on the hot side and cool blue on the cold side) with a live spatial temperature profile T(x).',
    gpuPhysics:
      'Maintains dual hot/cold slab thermostats on WebGPU, meters exact heat flux J_q = ΔQ / (2 A Δt), and derives phonon thermal conductivity κ_ph = J_q / |dT/dx| via Fourier’s law.',
    whyInUlg:
      'Feeds first-principles thermal conductivity into ULG’s continuum heat-conduction and quench simulations (e.g., Iron Ice Quench).',
    tryThis: [
      'Adjust target T and open Graphs & Data to inspect the 8-slab spatial temperature gradient T(x) and live κ_ph readout.'
    ]
  },
  'md:surface': {
    title: 'Free-Surface Vacuum Slab (Surface Tension γ)',
    scale: '10⁻⁸ m (Interfaces)',
    moduleKey: 'md-nemd-transport@1',
    whatYouSee:
      'A condensed 3D slab suspended between two vacuum interfaces along Z, showing surface atomic relaxation, evaporation at high T, and interface tension.',
    gpuPhysics:
      'Computes the microscopic Kirkwood–Buff mechanical surface tension γ = (L_z / 2)[½(P_xx + P_yy) − P_zz] directly from the anisotropic GPU virial stress tensor.',
    whyInUlg:
      'Derives surface tension γ(T) for droplets, bubbles, and phase interfaces in ULG’s macroscopic continuum renderer and solver.',
    tryThis: [
      'Heat near T_m (Melt) to observe free-surface capillary fluctuations and occasional surface atoms evaporating into the vacuum gap.'
    ]
  },
  'compound:molecule': {
    title: '3D Quantum Molecule, Wiberg Bonds & MEP',
    scale: '10⁻¹⁰ m (Quantum Chemistry)',
    moduleKey: 'molecular-rhf-gpu@1',
    whatYouSee:
      'A 3D WebGPU molecule with exact single/double/triple cylinders sized by Wiberg bond order, CPK or Mulliken electrostatic potential (MEP δ⁻ red ↔ δ⁺ blue) atom coloring, a 3D electric dipole arrow μ, and optional Total ρ / HOMO / LUMO orbital cloud.',
    gpuPhysics:
      'Solves closed-shell Restricted Hartree–Fock (RHF) self-consistent field equations on WebGPU using a Slater-shielded valence STO-3G effective core potential covering all Z = 1..118, then computes exact Löwdin–Wiberg bond orders and Mulliken charges.',
    whyInUlg:
      'Derives molecular geometry, bond energies, dipole moments, and polarizability for arbitrary newly discovered reaction products, which can then be backfed into every crystal, optical, MD, and Polytope simulation.',
    tryThis: [
      'Try H₂O (bent polar single bonds, μ > 1 D) and CO₂ (linear double bonds, Wiberg order ~2.0, μ = 0) or derive any formula like NH3, CH4, or NaCl.',
      'Toggle MEP (±q) and Orbital Cloud (HOMO / LUMO) to inspect nucleophilic vs electrophilic regions.'
    ]
  },
  'compound:reaction-path': {
    title: 'GPU CI-NEB Reaction Path (A + B → TS‡ → C + D)',
    scale: '10⁻¹⁰ m (Reaction Kinetics)',
    moduleKey: 'molecular-reaction-path@1',
    whatYouSee:
      'An interactive 3D molecular encounter complex transitioning from Reactants (ξ = 0) through the Transition State saddle point (TS‡) to Products (ξ = 1), with live bond breaking/forming cylinders and Eyring/Arrhenius k(T) plots.',
    gpuPhysics:
      'Assembles atom-conserved 3D encounter complexes and relaxes a multi-image Climbing-Image Nudged Elastic Band (CI-NEB) chain directly via GPU RHF energy & force evaluations to determine activation barrier E_a and reaction enthalpy ΔH.',
    whyInUlg:
      'Computes first-principles activation barriers and rate constants k(T) that govern reactive chemistry chambers and macroscopic exothermic continuum reactions (like Na + H₂O).',
    tryThis: [
      'Click HCl+NaOH or Na+H₂O in the Reaction Combiner, then scrub ξ or click Play Path / Jump TS‡ to watch old bonds break as new bonds form.'
    ]
  },
  'compound:vibrations': {
    title: 'GPU Geometry Optimization & Vibrational Normal Modes',
    scale: '10⁻¹⁰ m (IR / Raman Spectroscopy)',
    moduleKey: 'molecular-vibrations-gpu@1',
    whatYouSee:
      'Live 3D normal-mode vibrational animations (stretching and bending) of the relaxed molecule, paired with harmonic IR/Raman stick spectra and zero-point energy (ZPE).',
    gpuPhysics:
      'Relaxes atomic coordinates via GPU RHF gradients, builds the finite-difference GPU Hessian matrix, projects out exact 5 (linear) or 6 (nonlinear) Eckart translational/rotational null modes, and diagonalizes the mass-weighted dynamical matrix.',
    whyInUlg:
      'Quantifies molecular zero-point energy, heat capacity, infrared signatures, and kinetic isotope effects (e.g., H₂O vs D₂O).',
    tryThis: [
      'Derive H2O, switch to Vibrations, pick symmetric/asymmetric stretch vs bend modes, and toggle H→D Isotope Shift to watch frequencies drop by ~1/√2!'
    ]
  },
  'compound:reactive-md': {
    title: '3D WebGPU Reactive Chemistry MD Chamber',
    scale: '10⁻⁸ m (Chemical Kinetics)',
    moduleKey: 'reactive-chemistry-md@1',
    whatYouSee:
      'A 3D collision chamber of reactant molecules (A + B) colliding, flashing when they clear the activation barrier E_a, converting into products (C + D) with strict 1:1 stoichiometry, and releasing exothermic heat.',
    gpuPhysics:
      'Runs an all-GPU @workgroup_size(64) multi-species molecular collision and Arrhenius/Eyring mutual-nearest-neighbor reaction kernel seeded with barriers E_a and enthalpies ΔH from ULG’s GPU CI-NEB solver.',
    whyInUlg:
      'Links microscopic quantum reaction barriers to macroscopic reaction kinetics, ignition runaway, catalysis, and thermal feedback.',
    tryThis: [
      'Click ⚡ Ignition Spark to trigger exothermic chain conversion, or toggle Catalyst (−48% E_a) to see the reaction ignite at much lower temperature!'
    ]
  },
  'polytope:3d-surface': {
    title: '3D Convex Polytope Phase Surface (T, P, ρ)',
    scale: '10⁻⁶ → 10⁺⁷ m (Closure Atlas)',
    moduleKey: 'chebyshev-polytope-atlas@1',
    whatYouSee:
      'An orbitable 3D WebGPU phase-density relief surface over (log₁₀ T, log₁₀ P) with height = log₁₀ ρ: crisp vertical Clausius–Clapeyron phase cliffs separating Solid, Liquid, Gas, and Supercritical regions, a hatched fail-closed baseplate outside valid polytopes, and a glowing vertical GPU probe pin.',
    gpuPhysics:
      'Evaluates ULG’s exact inline WGSL `eval_polytope_atlas_2d` half-space classifier (A x ≤ b) and 2D tensor Chebyshev polynomials directly inside the WebGPU shader — identical math to ULG’s continuum and planetary interior solvers.',
    whyInUlg:
      'This is the master bridge of ULG’s Scale Ladder: every element and discovered compound compiles into a fail-closed Convex Polytope Atlas that macroscopic continuum and planetary engines evaluate in nanoseconds on the GPU.',
    tryThis: [
      'Switch between Lab 10 GPa and Planetary 1 TPa regimes, drag log₁₀T / log₁₀P, or click Fail-Closed Test to verify out-of-domain queries refuse silent extrapolation!'
    ]
  },
  'polytope:2d-facets': {
    title: '2D Exact Convex Polytope Facet Map',
    scale: '10⁻⁶ → 10⁺⁷ m (Closure Atlas)',
    moduleKey: 'chebyshev-polytope-atlas@1',
    whatYouSee:
      'A top-down exact 2D (log₁₀ T, log₁₀ P) phase map displaying every convex polytope cell’s half-space boundaries (A x ≤ b), iso-density contours, and live hover/click GPU probe cursor.',
    gpuPhysics:
      'Runs the exact GPU half-space membership test and Chebyshev density evaluation at every pixel and at the interactive cursor point.',
    whyInUlg:
      'Lets you inspect exact polytope domain coverage, bisected phase-boundary refinements, and fail-closed margins directly.',
    tryThis: [
      'Hover or click anywhere across the solid, liquid, gas, and supercritical polytope cells to read live GPU density and exact boundary margin.'
    ]
  },
  'polytope:residual-map': {
    title: 'Chebyshev Closure Residual Error Map (%)',
    scale: '10⁻⁶ → 10⁺⁷ m (Verification)',
    moduleKey: 'chebyshev-polytope-atlas@1',
    whatYouSee:
      'A quantitative error heatmap comparing the Tier-1 GPU Chebyshev polytope surrogate directly against the underlying first-principles equation of state across the entire (T, P) domain.',
    gpuPhysics:
      'Evaluates |ρ_Chebyshev − ρ_EOS| / ρ_EOS pixel-by-pixel across every interior polytope cell to verify approximation accuracy and locate high-curvature regions near phase transitions.',
    whyInUlg:
      'Enforces Star Spec Rule 2: closures carry explicit accuracy bounds and never hide approximation error from higher-scale solvers.',
    tryThis: [
      'Compare Lab 10 GPa vs Planetary 1 TPa residual maps to see where bisection tightens the fit along phase coexistence curves.'
    ]
  }
});

export function getSimulationDoc(tab, subView) {
  const key = `${tab}:${subView}`;
  if (SIMULATION_DOCS[key]) return SIMULATION_DOCS[key];
  const fallbackKey = Object.keys(SIMULATION_DOCS).find((k) => k.startsWith(`${tab}:`));
  return SIMULATION_DOCS[fallbackKey] || SIMULATION_DOCS['nuclear:tdse'];
}
