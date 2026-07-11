# ULG Solver And Law Inventory

Snapshot: 2026-07-10, branch `SS`, commit `c072c10`.

## Reading Rules

This inventory is derived from executable source, WGSL entry points, tests,
and the active plans. A name in a descriptor or todo is not enough to count as
an implementation.

Status terms:

- **Runtime:** executable in the current browser/runtime path.
- **Oracle:** executable CPU/reference path used for evidence, fallback, or
  lower-level derivation; it is not the desired hot-loop authority.
- **Reduced:** executable, but deliberately approximate, incomplete, or not
  scientifically validated for the full claimed domain.
- **Kernel suite:** individual GPU stages execute, but the intended complete
  solver still has missing representation, sparsity, coupling, or authority
  work.
- **Metadata only:** a law graph or service descriptor exists without an
  independently promoted solver.
- **Missing:** no executable implementation of the planned solver/law exists.

`Implemented` does not mean scientifically validated. Most material,
chemistry, continuum, and Schroeder outputs still carry false scientific or
full-physics validation flags.

Rendering, cache management, scheduling, admission, and diagnostics are not
physics solvers. Their important boundaries are called out separately.

## Implemented Solvers

### Closure And Carrier Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Flat closure-law graph evaluator | CPU oracle and WebGPU runtime | Executes `tableLinear` and `tableStep` graph nodes with domain/status rows. It is not yet a general arithmetic or differential law compiler. | `src/runtime/closureLawGraph.js` |
| Two-body closure carrier | CPU oracle | One-dimensional velocity-Verlet integration over a sampled pair closure, with invariant and domain-exit evidence. | `src/runtime/carrierRuntime.js` |
| Two-body WebGPU carrier | WebGPU reduced runtime with CPU fallback/parity | GPU version of the same toy two-body carrier, not SPH, MPM, or a production material solver. | `src/runtime/webgpuCarrierKernel.js` |

`spatialHash.js`, `edgeMessages.js`, `observers.js`, and
`fieldClosureSamples.js` are implemented operator primitives, not standalone
solvers.

### Atomic And Electronic Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Radial Kohn-Sham atom | CPU oracle | All-electron radial LDA SCF on the original radial grid. | `solveKohnShamAtom()` in `src/runtime/electronicStructure/radialKohnSham.js` |
| Log-grid multi-shell Kohn-Sham atom | CPU oracle | Multi-shell all-electron LDA used by the general element path. | `solveKohnShamAtomLog()` and `solveKohnShamAtomConfig()` in `radialKohnSham.js` |
| Spin-polarized atomic LSDA | CPU oracle | Separate spin channels and Hund-like moments. | `solveKohnShamAtomLSDA()` in `radialKohnSham.js` |
| Koelling-Harmon scalar-relativistic atom | CPU oracle | Scalar-relativistic radial states and SCF; no spin-orbit/full-Dirac solve. | `radialStatesKH()`, `solveKohnShamAtomKH()`, and `solveAtom()` in `radialKohnSham.js` |
| Uniform electron gas | CPU analytic solver | Thomas-Fermi kinetic, Dirac exchange, Chachiyo correlation fitted to Ceperley-Alder QMC, spin scaling, energy, and pressure. | `src/runtime/electronicStructure/uniformElectronGas.js` |
| Jellium/Ashcroft simple-metal cold curve | CPU reduced solver | Madelung plus empty-core pseudopotential equilibrium radius, density, cohesion, and bulk modulus. Reliable mainly for simple metals. | `src/runtime/electronicStructure/jelliumCohesion.js` |

### Molecular And Atomistic Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Restricted Hartree-Fock | CPU oracle | STO-3G molecular SCF for the parameterized basis set. | `rhf()` in `src/runtime/electronicStructure/molecularHartreeFock.js` |
| Unrestricted Hartree-Fock | CPU oracle | Open-shell UHF with multiplicity control. | `uhf()` in `molecularHartreeFock.js` |
| MP2 correlation | CPU oracle | Closed-shell MP2 correction on the RHF solution. | `mp2()` in `molecularHartreeFock.js` |
| Molecular geometry optimizer | CPU reduced solver | Numerical gradients plus backtracking/internal-coordinate handling. | `optimizeGeometry()` in `molecularHartreeFock.js` |
| Molecular vibration solver | CPU reduced solver | Finite-difference Hessian, mass weighting, and normal-mode eigenvalues. | `vibrationalFrequencies()` in `molecularHartreeFock.js` |
| Born-Oppenheimer molecular dynamics | CPU reduced solver | Velocity-Verlet nuclear motion on numerical electronic-energy gradients. | `bornOppenheimerMD()` in `molecularHartreeFock.js` |
| All-element molecular energy solver | CPU reduced solver | Atomic Kohn-Sham descriptors feeding a universal Morse-like pair Hamiltonian and saturation term for Z=1..118. It is broad coverage, not quantitative quantum chemistry. | `src/runtime/electronicStructure/allElementMolecularSolver.js` |
| Classical pair-potential molecular dynamics | CPU oracle | Periodic-box NVE/NVT velocity-Verlet, virial pressure, velocity-rescaling thermostat, and diffusion/energy samples. | `src/runtime/md/mdEngine.js` |
| Pair potential and fit solvers | CPU oracle/reduced | Lennard-Jones, tabulated potentials, Morse potential, and Morse fitting including the MoonLab H2 curve. | `src/runtime/md/pairPotential.js`, `src/runtime/md/potentialFitting.js` |
| Condensed-property scan solvers | CPU oracle | EOS scans, equilibrium density, bulk modulus, diffusion, heat capacity, and melting scans over the MD engine. | `src/runtime/md/propertyEstimators.js` |

### Material And Thermodynamic Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Element material closure derivation | CPU reduced solver | Atomic DFT plus jellium or radial packing, Debye/Lindemann/Richards/Poisson reductions, and optical inputs for elements. | `deriveElementProperties()` and `elementMaterialClosure()` in `src/runtime/material/elementClosures.js` |
| Formula/compound material derivation | CPU reduced solver | Formula parsing, formula geometry, molecular/all-element energies, ideal-gas rows, condensed density/modulus estimates, and phase-transition estimates. | `src/runtime/material/materialDerivation.js`, `src/runtime/material/compoundClosure.js` |
| Phase equilibrium and enthalpy inversion | CPU runtime and GPU table consumer | Stable phase from temperature or specific energy, energy-to-temperature inversion, and latent-plateau lever-rule fractions. | `src/runtime/material/phaseEquilibrium.js`, `src/runtime/material/thermoState.js`, `src/runtime/sph/sphThermalGpuKernel.js` |
| Gruneisen thermal expansion closure | CPU reduced solver | Thermal expansion and density as a function of temperature; this is not a complete shock Mie-Gruneisen EOS. | `src/runtime/material/gruneisenEos.js` |
| Thermodynamic scenario preflight | CPU analysis solver | Energy/mass feasibility checks for the configured phase scenario. It does not advance the live simulation. | `src/runtime/thermoPreflight.js`, `src/runtime/material/thermodynamicPreflight.js` |
| Optical closure derivation and lookup | CPU derivation plus WebGPU lookup | CPU derives spectral/PBR rows; WebGPU looks up packed rows. The lower-level optical derivation is not GPU-native. | `src/runtime/material/opticalClosure.js`, `src/runtime/material/opticalGpuBuffers.js` |

### Continuum And Multiphysics Solvers

| Solver | Backend/status | Current scope | Source |
| --- | --- | --- | --- |
| Conservative SPH/PBF phase carrier | CPU oracle | Cubic-spline density, symmetric pressure/energy, Monaghan viscosity, kick-drift-kick integration, optional density projection, reduced solid grouping/contact, and phase-aware EOS. | `src/runtime/sph/sphOperators.js`, `src/runtime/sph/sphPhaseCarrier.js` |
| MLS-MPM/APIC carrier | CPU oracle | Quadratic B-spline P2G/G2P, APIC affine transfer, pressure fluid stress, fixed-corotated solid elasticity, Newtonian viscosity, gravity, walls, and phase-derived constitutive state. | `src/runtime/sph/mlsMpmCarrier.js` |
| Resident MLS-MPM/APIC solver | WebGPU runtime | Particle-parallel P2G, grid update, G2P, fused/split resident steps, retained buffers, compact summaries, thermal/reaction sidecars, and admitted pressure impulses. This is the default mechanics path. | `sphGridGpuKernel.js`, `sphGridUpdateGpuKernel.js`, `sphG2pGpuKernel.js`, `sphMlsMpmGpuStep.js` |
| MLS-MPM mechanics predictor and constitutive refresh | CPU oracle plus WebGPU runtime | Predicts/refreshes phase-dependent mechanics rows and reset state after thermal/reaction changes. These are stages of the resident MLS-MPM solver, not separate continuum methods. | `sphMechanicsGpuKernel.js`, `sphMechanicsRefreshGpuKernel.js` |
| Thermal and phase transport | CPU oracle plus WebGPU runtime | Pair conduction, six wall reservoirs, pair/ambient graybody radiation, temperature/phase response, and latent-energy updates. | `src/runtime/sph/thermalPhase.js`, `src/runtime/sph/sphThermalGpuKernel.js` |
| Reaction/product conversion | CPU oracle plus WebGPU runtime | Contact-pair proposals, balanced stoichiometric extent, reactant consumption, product placement, heat release, gas/product ledgers, phase reset, and atom/charge/mass diagnostics. | `src/runtime/sph/reactiveChemistry.js`, `src/runtime/sph/sphReactionGpuKernel.js`, `src/runtime/sph/sphReactionGpuSummary.js` |
| Pressure/interface force-row solver | WebGPU runtime with CPU helpers | Particle-bin contact kinematics, material-interface normal/area rows, local gas-cell pressure input, cubic-barrier/damping/inertial contact pressure, and force rows admitted into grid update. | `src/runtime/sph/sphPressureInterfaceGpuKernel.js` |
| Local material-interface source field | WebGPU partial runtime | Source-local GPU splat produces retained interface candidates efficiently, but the default GPU pressure/force consumer is not yet wired end to end. | `src/runtime/sph/sphMaterialInterfaceSourceFieldLocalGpu.js` |
| Spatial gas ledger and gas-cell EOS producer | CPU calculation plus GPU-retained upload | Builds positioned gas ledgers and applies an ideal-gas cell law. The current `webgpu` backend uploads CPU-derived rows; it is not a WGSL EOS solve. | stage functions in `src/runtime/sph/sphMlsMpmGpuStep.js` |

### Schroeder Simulation Kernel Suite

The following WebGPU stages are implemented and tested. They constitute a
two-level experimental/kernel suite, not a completed scale-independent
Schroeder solver:

- Assignment/indexing: level assignment, active-node list, phase-volume
  overlay index, bucket index, and sorted active-node index.
- Law traversal: local law queues and neighbor-candidate traversal, including
  reaction and pressure/interface masks/source spans.
- Cross-level grid work: restriction, prolongation, velocity-delta
  prolongation, cross-level coupling candidates, transfers, conservation
  summaries, pending state deltas, and admitted state-delta merge.
- Hierarchy aggregation: contribution materialization, phase-volume target
  aggregates, keyed/bucket aggregate-node reduction, far-aggregate candidates,
  force summaries, diagnostic summaries, law consumers, gas deltas/imports,
  and admitted far-force application.
- Phase-volume/storage: migration decisions, split/merge proposals and admitted
  apply rows, allocation, free-list/slot assignment, materialization, level
  updates, count summaries, and order-preserving compaction.
- Orchestration: same-level mechanics and the two-level mechanics step.

Two-level thermal and reaction sidecars execute. Equivalent authoritative
two-level pressure/interface continuation is still missing. Far-field gravity
rows can be computed and admission-gated, but they are not the normal mounted
self-gravity authority. The far radiation, plasma, and gas consumers are
read-only/proxy scalar responses; they are not radiation transport, Maxwell,
MHD, PIC, or plasma evolution.

Primary executable entry points are the `runSchroeder*WebGpu()` exports in:

- `src/runtime/sph/schroederHierarchyGpu.js`
- `src/runtime/sph/schroederCrossLevelCouplingGpu.js`
- `src/runtime/sph/schroederParticleStorageCountGpu.js`
- `src/runtime/sph/schroederParticleStorageCompactionGpu.js`

The suite remains **partial** because active-node/candidate storage is not yet
truly sparse in cost, only two levels are exercised, several rows are
proposal/admission artifacts, and the full variable-support and general
split/merge policy is unfinished.

## Implemented Physical Laws And Closures

### Electronic And Molecular Laws

- Nonrelativistic radial Kohn-Sham DFT with LDA exchange/correlation.
- Spin-density LSDA and electron-configuration/Hund occupancy handling.
- Koelling-Harmon scalar-relativistic radial correction.
- Thomas-Fermi uniform-electron-gas kinetic energy.
- Dirac exchange and Chachiyo correlation fitted to Ceperley-Alder QMC,
  including spin scaling.
- Hartree-Fock Coulomb/exchange in RHF and UHF form.
- Closed-shell second-order Moller-Plesset correlation.
- Born-Oppenheimer nuclear motion on electronic potential-energy surfaces.
- Lennard-Jones 12-6, tabulated pair, and Morse pair potentials.
- Maxwell-Boltzmann velocity initialization, equipartition temperature,
  velocity-Verlet integration, virial pressure, and velocity-rescaling NVT.

### Bulk, Thermodynamic, And Phase Laws

- Jellium kinetic/exchange/correlation plus ionic Madelung and Ashcroft
  empty-core pseudopotential cold curves.
- Debye temperature, heat capacity, and internal energy; Dulong-Petit high-T
  limit.
- Ideal-gas density, pressure inputs, `Cp/Cv/gamma`, molecular rotational and
  vibrational heat capacity, Einstein-like gas energy segments, and zero-point
  energy.
- Gruneisen thermal expansion and temperature-dependent density.
- Lindemann melting estimate and isotropic Poisson-ratio shear reduction.
- Richards fusion entropy, Trouton vaporization entropy, and
  Clausius-Clapeyron pressure-dependent boiling.
- Piecewise phase enthalpy ladders, latent-heat plateaus, and lever-rule phase
  fractions.

`plasma` can appear as a phase/table label, but no plasma dynamics solver is
implemented.

### Continuum Mechanics Laws

- Uniform external Newtonian gravity.
- Cubic-spline SPH density and symmetric pressure/internal-energy operators.
- Monaghan artificial viscosity in the CPU SPH oracle.
- Phase-aware weakly-compressible EOS:
  - Tait/Cole pressure for condensed phases with a bounded tensile branch;
  - reduced linear gas pressure about phase rest density;
  - ideal-gas sound speed derived from `gamma R T / M`.
- MLS-MPM/APIC quadratic B-spline particle/grid transfers.
- Weakly-compressible fluid Cauchy stress `-pI`.
- Fixed-corotated hyperelastic solid stress with phase-derived Lame parameters.
- Newtonian deviatoric viscous stress plus closure/artificial viscosity.
- Cubic-barrier wall contact and material-interface elastic, damping, and
  inertial contact-pressure response.
- Gas buoyancy from phase-density contrast in the CPU/reference demo path; the
  resident GPU mechanics path has no equivalent steam convection/buoyancy law.
- Hydrostatic pressure initialization/optional reduced SPH hydrostatic field.

### Thermal And Radiation Laws

- Energy-conserving pair conduction in the CPU and GPU thermal paths.
- Dirichlet heat exchange with six independently heated/cooled wall
  reservoirs and an explicit wall-energy ledger.
- Pairwise graybody radiative exchange with geometric view area.
- Stefan-Boltzmann exchange with the ambient environment.
- Planck blackbody spectrum integrated through CIE 1931 to sRGB for
  incandescence.

The implemented radiation laws cover thermal emission/exchange only. They are
not particle, neutron, gamma, or spectral radiation transport solvers.

### Chemistry Laws And Rules

- Exact formula atom counting and charge/atom-balanced stoichiometric rows.
- Active-metal plus liquid-water family producing hydroxide plus hydrogen.
- Metal/fuel oxidation, hydrogen/oxygen combustion, charge-balanced binary
  ionic synthesis, and a conservative binary-product fallback.
- Endpoint reaction enthalpy from RHF/UHF or the all-element reduced molecular
  solver when accepted; provisional heuristic signs remain explicitly marked.
- Contact/phase/temperature gating, limiting-reagent extent, mass-conserving
  reactant consumption, product/gas placement, and heat release.
- Sedenion periodic-table scope is implemented as a candidate/admission policy,
  not as a physical force or kinetics law.

### Optical Laws And Closures

- Drude and Drude-Lorentz metal dielectric/reflectance/skin-depth response.
- Scalar-relativistic interband oscillator generation from atomic orbitals.
- Beer-Lambert absorption/transmission for water and compounds.
- Rayleigh gas scattering and reduced Mie/Rayleigh droplet extinction.
- Saturation-pressure/supersaturation-derived reduced water-droplet optical
  state.
- Molecular electronic-band absorption, band-gap absorption, Fresnel/IOR PBR
  mapping, and spectral-response to CIE/sRGB integration.

These are optical/material closures and render inputs, not a Maxwell field
solver.

## Implemented Numerical Policies That Are Not Laws

The following behavior exists but must not be described as a fundamental law:

- global sound-speed/modulus scaling to satisfy the interactive CFL limit;
- CFL velocity limiting and compact-summary planning;
- liquid tensile/cavitation pressure floors;
- PBF-like density projection in the CPU SPH oracle;
- liquid velocity diffusion, wall damping, free-surface relaxation, and
  particle-separation passes;
- CPU SPH solid AABB grouping/support correction;
- phase-volume hysteresis, refinement-pressure masks, allocation admission,
  and Schroeder storage policies;
- renderer surface hysteresis and optical visibility gates.

## Law Graph Status

`createUlgResidentLawFamilyDescriptors()` publishes four named law families:

1. `ulg-mls-mpm-mechanics-law`
2. `ulg-thermal-phase-law`
3. `ulg-reaction-product-gas-law`
4. `ulg-pressure-interface-law`

Their underlying stages execute inside the resident pass DAG, but each
descriptor declares `runtime: metadata` and
`executableStatus: metadata-only-pass-dag-child`. None should be counted as an
independently promoted authoritative solver yet. The current promotion order
is mechanics, thermal/phase, reaction/product/gas, then pressure/interface.

Source: `createUlgResidentLawFamilyDescriptors()` in
`src/runtime/peercomputeBrowserResidentHost.js`.

## Live SPH Demo Law Toggles

`src/runtime/sphPhaseDemo.js` currently exposes these independently selectable
groups:

- Implemented and default-on: `mechanics`, `gravity`, `eos`, `pressure`,
  `thermal`, `reactions`, and `viscosity`.
- Pending and default-off: `surfaceTension`.
- Mechanics defaults to the resident `mlsmpm` path; `sph` selects the CPU
  reference path.

The UI/query keys are `lawmech`, `lawg`, `laweos`, `lawp`, `lawt`, `lawr`,
`lawv`, and `lawst` in `src/visualization/sphPhaseDemoMount.js`.

## Planned Or Missing Solvers And Laws

### Explicitly Missing In The Live Demo

- **Surface-tension curvature solver:** the property row and toggle exist, but
  `sphPhaseDemo.js` explicitly reports it as unimplemented. There is no CSF,
  curvature, pair-potential, or free-energy surface-tension force.
- **General GPU-native gas-cell EOS:** local ideal-gas cells are computed on
  CPU and uploaded; no WGSL EOS producer currently derives those rows.
- **End-to-end source-local GPU pressure consumer:** the efficient retained
  material-interface source field exists, but its force consumer is not wired
  as one resident GPU-to-GPU path.
- **Resident steam buoyancy/convection and pressure-work closure:** the CPU demo
  has a density-contrast buoyancy acceleration, but the resident GPU route
  lacks the equivalent gas rise, venting, and convection law.

### Coherent Solid Solvers, All Unstarted

- **SOL-0:** body/member/contact/shape schemas and compact GPU invariants.
- **SOL-1:** objective `SE(3)` rigid-body frame, inertia/wrench integration,
  and direct resident mesh transform.
- **SOL-2:** solid-solid proxy contact with equal/opposite force and torque,
  plus derived friction/restitution behavior.
- **SOL-3:** solid-liquid mixed-cell velocity, pressure, and viscous traction
  reduced into body wrench.
- **SOL-4:** persistent material-space deformable surface, plasticity, and
  objective grid-crossing representation.
- **SOL-5:** admitted melting, solidification, fracture, and component
  merge/split topology.
- **SOL-6:** body-spanning levels, local charts/rebasing, far-field moments,
  and planetary/orbital mechanics.

The existing fixed-corotated particle elasticity and CPU solid-group contact
do not satisfy any of these coherent-body slices.

### Adaptive MLS-MPM And Schroeder Gaps

- Per-particle support radius and normalized variable-support P2G/G2P.
- The `ocean-tiled-experimental` P2G policy has no tiled kernel and falls back;
  `resident-scatter` is the implemented backend.
- Bounded support tiers and conservation-safe general adaptive split/merge.
- Truly compact unique active nodes and byte-bounded CSR/global neighbor
  arenas instead of particle-proportional candidate reservations.
- Complete cross-level affine/angular/internal-energy reflux invariants.
- General third-and-higher levels; the third level is currently on hold.
- Production refine/coarsen policy at interfaces, walls, reactions, and high
  gradients.
- Portable cross-peer rematerialization of adopted particle storage without
  raw `GPUBuffer` transfer.

### Chemistry And Phase Gaps

- Derived activation barriers and rate constants; current runtime primarily
  uses temperature/contact thresholds.
- NEB or dimer transition-state search and minimum-energy paths.
- General reaction-network competition, reversible equilibrium, catalysis,
  aqueous solvation, electrochemistry, and validated oxidation-state choice.
- Body/component-aware chemistry and exposed-area reaction quadrature; current
  products do not preserve coherent body/topology identity.
- Open-shell UMP2 and multireference bond-breaking chemistry.
- General species diffusion/mixing and closure-derived reaction kinetics.
- Nonequilibrium phase kinetics, homogeneous/heterogeneous nucleation,
  condensation/evaporation mass transfer, and resident droplet-size evolution.
  Current steam microphysics is a reduced optical state, not this solver.

### Electronic, Molecular, And Bulk Fidelity Gaps

- GGA/PBE and LDA+U or equivalent transition-metal treatment.
- Spin-orbit coupling and a full Dirac atomic solver beyond scalar KH.
- Larger molecular bases, polarization/diffuse functions, broader element
  coverage, and ECPs for heavy atoms.
- UMP2, CASSCF or spin-projected bond-breaking treatment.
- Analytic gradients/Hessians for molecular optimization and dynamics.
- Periodic DFT with k-points, phonons, quasiharmonic free energy, and
  quantitative solid/liquid bulk closures.
- The planned material-polytope response registry and adaptive property-fit
  pipeline.
- A high-fidelity stiff/shock EOS beyond the interactive weakly-compressible
  Tait/linear-gas model.
- General Gibbs/free-energy phase minimization beyond the ordered enthalpy
  ladder and local lever-rule response.

### GPU Material Resolver Gaps

- WebGPU radial Kohn-Sham, LSDA, KH, tridiagonal eigensolver, Hartree/XC, and
  SCF iteration kernels.
- WebGPU RHF/UHF/MP2/all-element molecular, geometry, vibration, and BOMD
  kernels.
- GPU-native element/formula property derivation, thermal graph construction,
  EOS row derivation, viscosity/transport closure derivation, reaction
  energetics, and optical spectral derivation.
- A general closure-law graph beyond table-linear/table-step sampling.
- Removal of main-thread/CPU table packing from the runtime material hot path.

### Frontier Laws With No ULG Solver

- Isotope inventory, radioactive decay, fission, fusion, daughter products,
  neutron/gamma/charged-particle transport, ionization, radiolysis, and energy
  deposition.
- Cherenkov source generation and spectral transport.
- General electromagnetic/Maxwell field solve, MHD, and kinetic PIC plasma.
- Long-range Newtonian N-body/Poisson gravity beyond constant local gravity and
  the partial Schroeder far-aggregate machinery.
- Relativistic orbital dynamics, GR/GRMHD, and the planned astrophysical law
  families.
- Finite-capacity conductive wall solids; current wall heat boundaries are
  fixed-temperature reservoirs.

MoonLab and Eshkol currently contribute readiness probes, reference artifacts,
and closure/handler contracts. Their staged magnetar MHD, PIC, radiation, and
relativistic records are not local ULG implementations of those solvers.

## Non-Solver Compute Paths

For completeness, ULG also implements GPU render-field construction,
marching-cubes/tetrahedral surface extraction, indirect draw metadata, optical
lookup, compact diagnostics, retained-buffer authority/admission, and
PeerCompute stage scheduling. These are important compute systems but are not
additional physical laws or solvers. The production WebGPU surface lifecycle
failure documented in `plan/todo/sol-critic.md` is therefore a renderer
correctness blocker, not a missing physics law.
